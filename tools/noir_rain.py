"""Noir's rain, as a recording (user: "Noir's rain sound is still not right.
It's just too, it's like white noise").

The rain in Noir was noise: white noise through a band, steady, the same
everywhere. Real rain is made of drops. This makes a steady rain on a city
street at night out of what that rain is made of, each placed somewhere
left or right, near or far (no outside recordings can be fetched from
where this is built, so it's made here, and can be made again):

  near drops   ~55 a second on the wet pavement close by: each a sharp
               tick and a little spray, bigger drops lower and louder;
  the patter   ~400 a second further off, smaller and duller;
  puddles      ~9 a second land in water: a tick and a short bubble
               "plink" that rises as it closes (1.5-5 kHz);
  drips        four of them, each at its own pace: two into puddles, one
               on a fire escape's iron, one on a canvas awning;
  a downspout  water running out onto the street: a trickle of tiny
               bubbles and a low gurgle, off to the right;
  an awning    the rain drumming on canvas, off to the left;
  the wash     what's left of all the rain further away, dark (under
               1.6 kHz) and well under the rest;
  the street   the facades' first echoes and a short tail.

The rain comes and goes a little (a gust every so often: more drops, a
louder wash). Dark, as an old picture's soundtrack is (the top rolled away from about
5 kHz; the steady part under 1.6 kHz): the brightness is in the drops,
not in a hiss.

48 s rendered, the last 4 s crossfaded over the first, so it loops with no
seam: 44 s, stereo, 48 kHz, its average level -20 dBFS (the game sets its
place in the mix: themes/noir-audio.js). -> assets/noir/rain.mp3

    FFMPEG=/path/to/ffmpeg python3 tools/noir_rain.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/noir/rain.mp3")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 48000
LEN = 48.0
XF = 4.0
N = int(LEN * SR)
rng = np.random.default_rng(1947)


def sos(kind, f, order=2):
    return butter(order, f, kind, fs=SR, output="sos")


def band(x, lo=None, hi=None, order=2):
    if lo:
        x = sosfilt(sos("highpass", lo, order), x, axis=0)
    if hi:
        x = sosfilt(sos("lowpass", hi, order), x, axis=0)
    return x


def pink(n):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    X /= np.sqrt(np.maximum(f, 20))
    y = np.fft.irfft(X, n)
    return y / np.std(y)


def drift(rate_hz):
    """A slowly wandering curve (mean 0, sd 1), changing about rate_hz times a second."""
    k = int(LEN * rate_hz) + 4
    pts = rng.standard_normal(k)
    # (Shaped at 500 points a second, then drawn out to the full rate.)
    cr = 500
    tc = np.arange(int(LEN * cr) + 1) / cr
    x = np.interp(tc * rate_hz, np.arange(k), pts)
    w = np.hanning(max(3, int(cr / rate_hz)))
    x = fftconvolve(x, w / w.sum(), mode="same")
    x = np.interp(np.arange(N) / SR, tc, x)
    return (x - x.mean()) / (x.std() + 1e-12)


# The gusts: the rain heavier for a while, then easing.
GUST = np.clip(1 + 0.22 * drift(0.06) + 0.08 * drift(0.25), 0.6, 1.5)


def times(rate):
    """Moments for events at `rate` a second, more of them in a gust."""
    peak = rate * GUST.max()
    t = np.sort(rng.uniform(0, N, rng.poisson(peak * LEN)).astype(int))
    keep = rng.uniform(0, 1, len(t)) < GUST[t] / GUST.max()
    return t[keep]


def place(out, at, g, pan):
    """Add a mono event g at sample `at`, panned (-1..1, equal power)."""
    a = (pan + 1) * np.pi / 4
    e = min(len(g), len(out) - at)
    if e <= 0:
        return
    out[at:at + e, 0] += g[:e] * np.cos(a)
    out[at:at + e, 1] += g[:e] * np.sin(a)


def decay(m, tau):
    return np.exp(-np.arange(m) / max(1.0, tau))


def far(g, d):
    """Distance d (m): quieter and duller."""
    return sosfilt(sos("lowpass", min(9000, 8800 / (1 + 0.22 * d))), g) / d


def unit(x):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def bubble(f0, tau, rise, level):
    """A drop into water: a tick, then the bubble ringing as it closes (its pitch rising)."""
    m = int(tau * 6 * SR)
    t = np.arange(m) / SR
    f = f0 * (1 + rise * t / (tau * 6))
    g = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    c = int(0.0007 * SR)
    g[:c] += rng.standard_normal(c) * np.exp(-np.arange(c) / (c / 3)) * 0.6
    return g * level


def near_drops():
    out = np.zeros((N, 2))
    for at in times(55):
        s = rng.lognormal(0, 0.45)  # the drop's size
        d = rng.uniform(1, 6)
        m1 = int(SR * rng.uniform(0.0006, 0.0016))
        click = rng.standard_normal(m1) * decay(m1, m1 / 3)
        m2 = int(SR * rng.uniform(0.006, 0.018) * min(2, s))
        spray = rng.standard_normal(m2) * decay(m2, m2 / 4) * 0.22
        g = np.zeros(max(m1, m2))
        g[:m1] += click
        g[:m2] += spray
        fc = np.clip(rng.uniform(1200, 3200) / s ** 0.5, 700, 4500)
        g = sosfilt(butter(1, [fc / 1.9, fc * 1.9], "bandpass", fs=SR, output="sos"), g)
        if s > 0.9:
            # a bigger drop lands with a little weight: a dull splat under the tick
            m3 = int(SR * rng.uniform(0.003, 0.008))
            body = band(rng.standard_normal(m3), 300, 1100) * decay(m3, m3 / 4) * 0.5 * (s - 0.8)
            g[:min(len(g), m3)] += body[:min(len(g), m3)]
        place(out, at, far(g, d) * 0.3 * s ** 1.5, rng.uniform(-1, 1))
    return out


def patter():
    """Many small drops further off: a few kinds of drop, each a train of moments."""
    out = np.zeros((N, 2))
    for _ in range(12):
        L, R = np.zeros(N), np.zeros(N)
        for at in times(400 / 12):
            a = rng.lognormal(-0.4, 0.6)
            p = (rng.uniform(-1, 1) + 1) * np.pi / 4
            L[at] += a * np.cos(p)
            R[at] += a * np.sin(p)
        m = int(SR * rng.uniform(0.004, 0.01))
        k = rng.standard_normal(m) * decay(m, m / rng.uniform(4, 7))
        fc = rng.uniform(900, 2600)
        k = sosfilt(butter(1, [fc / 2, fc * 1.7], "bandpass", fs=SR, output="sos"), k)
        k = sosfilt(sos("lowpass", rng.uniform(2200, 3200)), k)
        out[:, 0] += fftconvolve(L, k)[:N]
        out[:, 1] += fftconvolve(R, k)[:N]
    return out


def puddles():
    out = np.zeros((N, 2))
    for at in times(9):
        r = rng.uniform(0.6, 2.2) / 1000  # the bubble's radius
        f0 = 3.26 / r
        tau = rng.uniform(0.003, 0.009) * (r * 1000) ** 0.3
        d = rng.uniform(1.5, 9)
        g = bubble(f0, tau, rng.uniform(0.2, 0.9), rng.lognormal(-0.3, 0.6))
        place(out, at, far(g, d), rng.uniform(-1, 1))
    return out


def drips():
    out = np.zeros((N, 2))

    def source(pan, period, jitter, d, make):
        t = rng.uniform(0, period)
        pace = 1 + 0.15 * drift(0.03)
        while t < LEN:
            at = int(t * SR)
            place(out, at, far(make(), d), pan)
            t += period * pace[min(at, N - 1)] * rng.uniform(1 - jitter, 1 + jitter)

    def metal():
        m = int(0.25 * SR)
        t = np.arange(m) / SR
        g = sum(a * np.sin(2 * np.pi * f * rng.uniform(0.99, 1.01) * t) * np.exp(-t / dk)
                for f, a, dk in [(2350, 1, 0.09), (3870, 0.5, 0.05), (6120, 0.22, 0.03)])
        c = int(0.0006 * SR)
        g[:c] += rng.standard_normal(c) * 0.5
        return g * 0.16 * rng.uniform(0.7, 1.2)

    def canvas():
        m = int(0.03 * SR)
        g = band(rng.standard_normal(m), 220, 700) * decay(m, 0.005 * SR)
        return g * 1.2 * rng.uniform(0.7, 1.2)

    source(-0.65, 0.85, 0.18, 3, lambda: bubble(rng.uniform(980, 1250), 0.012, 0.5, 0.55 * rng.uniform(0.7, 1.2)))
    source(0.4, 1.45, 0.15, 4, metal)
    source(0.75, 0.42, 0.25, 5, lambda: bubble(rng.uniform(1700, 2300), 0.006, 0.6, 0.35 * rng.uniform(0.6, 1.2)))
    source(-0.3, 2.3, 0.2, 2.5, canvas)
    return out


def downspout(pan=0.55, d=5):
    trickle = np.zeros(N)
    for at in times(120):
        g = bubble(rng.uniform(700, 2600), rng.uniform(0.0015, 0.004), 0.5, rng.lognormal(-1, 0.6))
        e = min(len(g), N - at)
        trickle[at:at + e] += g[:e]
    trickle = band(trickle, 500, 3000)
    gurgle = band(rng.standard_normal(N), 150, 600) * (0.5 + 0.5 * np.abs(drift(6)) ** 1.5)
    mono = unit(trickle) + 0.5 * unit(gurgle)
    mono = far(mono, d)
    a = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)


def awning():
    out = np.zeros((N, 2))
    for pan, modes in [(-0.6, [(310, 14), (520, 18), (760, 20)]), (-0.4, [(345, 15), (580, 18), (820, 22)])]:
        x = np.zeros(N)
        for at in times(18):
            x[at] += rng.lognormal(0, 0.5)
        x = fftconvolve(x, rng.standard_normal(int(0.0008 * SR)))[:N]
        y = np.zeros(N)
        for f, q in modes:
            bw = f / q
            y += sosfilt(butter(1, [f - bw / 2, f + bw / 2], "bandpass", fs=SR, output="sos"), x)
        y = far(y, 3)
        a = (pan + 1) * np.pi / 4
        out[:, 0] += y * np.cos(a)
        out[:, 1] += y * np.sin(a)
    return out


def wash():
    w = np.stack([band(pink(N), 100, 1600) for _ in range(2)], 1)
    return w * GUST[:, None]


def street(x):
    """The facades' first echoes, then a short dark tail."""
    y = x.copy()
    for ms, g, side in [(11, 0.32, 1), (19, 0.26, 0), (29, 0.2, 1), (43, 0.14, 0), (61, 0.1, 1)]:
        k = int(ms * SR / 1000)
        e = band(x[:-k, 1 - side], None, 3500) * g
        y[k:, side] += e
    L = int(0.9 * SR)
    ir = np.stack([band(rng.standard_normal(L), 150, 2800) * decay(L, 0.17 * SR) for _ in range(2)], 1)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)
    return y + wet * 0.22 * np.std(x) / (np.std(wet) + 1e-12)


def main():
    # Each part at its own place in the mix (dB against the near drops).
    parts = [
        (near_drops(), 0), (patter(), -2), (puddles(), -7), (drips(), -9),
        (downspout(), -13), (awning(), -12), (wash(), -7),
    ]
    out = sum(unit(p) * 10 ** (db / 20) for p, db in parts)
    out = street(out)
    # an old picture's soundtrack: the top rolled away (about -3 dB at
    # 5.5 kHz, -10 at 8)
    out = band(band(out, 50, 5500), None, 8000)
    # the loop
    x = int(XF * SR)
    w = np.linspace(0, np.pi / 2, x)[:, None]
    loop = np.concatenate([out[-x:] * np.cos(w) + out[:x] * np.sin(w), out[x:-x]])
    loop *= 10 ** (-20 / 20) / np.sqrt(np.mean(loop ** 2))
    # the rare tallest tick rounded off, not clipped
    t = 10 ** (-3 / 20)
    big = np.abs(loop) > t
    loop[big] = np.sign(loop[big]) * (t + (1 - t) * np.tanh((np.abs(loop[big]) - t) / (1 - t)))
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "r.wav")
        sf.write(wav, loop, SR, subtype="PCM_16")
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "128k", OUT], check=True)
        if os.environ.get("NOIR_RAIN_WAV"):
            sf.write(os.environ["NOIR_RAIN_WAV"], loop, SR, subtype="PCM_16")
    print(f"{OUT}: {len(loop) / SR:.1f} s, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
