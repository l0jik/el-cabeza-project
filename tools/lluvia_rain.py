"""Lluvia's rain, as a recording (user: the rain "is way too loud ... even
change to an audio clip of rain that's not so intense").

Steady, gentle rain on a city street at night, made here so it can be made
again (no outside recordings can be fetched from where this is built):

  the bed     soft pink noise, the highs rolled off (a dark, distant
              wash rather than a hiss), breathing a little over ~10 s;
  the patter  ~70 tiny, dull taps a second, far off and low-passed: the
              texture of many drops rather than of noise;
  near drops  ~5 a second: a click and a short rising bubble "plink"
              (1.6-4 kHz), each placed somewhere left or right, most of
              them quiet, a few nearer;
  the awning  now and then a heavier drop on cloth or metal, low and dull;
  the street  a short, soft room around it all.

44 s rendered, the last 4 s crossfaded over the first, so it loops with
no seam: 40 s, stereo, 48 kHz, its average level -20 dBFS (the game sets
its place in the mix: themes/lluvia-city.js). -> assets/lluvia/rain.mp3

    python3 tools/lluvia_rain.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/lluvia/rain.mp3")
SR = 48000
LEN = 44.0
XF = 4.0
rng = np.random.default_rng(11)


def band(x, lo=None, hi=None, order=2):
    if lo:
        x = sosfilt(butter(order, lo, "highpass", fs=SR, output="sos"), x, axis=0)
    if hi:
        x = sosfilt(butter(order, hi, "lowpass", fs=SR, output="sos"), x, axis=0)
    return x


def pink(n):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    X /= np.sqrt(np.maximum(f, 20))
    y = np.fft.irfft(X, n)
    return y / np.std(y)


def place(out, at, g, pan):
    """Add a mono event g at sample `at`, panned (-1..1, equal power)."""
    a = (pan + 1) * np.pi / 4
    e = min(len(g), len(out) - at)
    if e <= 0:
        return
    out[at:at + e, 0] += g[:e] * np.cos(a)
    out[at:at + e, 1] += g[:e] * np.sin(a)


def main():
    n = int(LEN * SR)
    out = np.zeros((n, 2))
    t = np.arange(n) / SR
    # the bed: dark pink noise, decorrelated left and right, breathing
    breathe = 1 + 0.18 * np.sin(2 * np.pi * t / 10.3) + 0.1 * np.sin(2 * np.pi * t / 4.1 + 1)
    for c in range(2):
        out[:, c] += band(pink(n), 180, 2400) * 0.05 * breathe
    # the patter: many tiny dull taps, far off
    k = int(70 * LEN)
    for at in rng.integers(0, n, k):
        m = int(rng.uniform(0.002, 0.005) * SR)
        g = rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 4)) * rng.lognormal(-3.6, 0.5)
        place(out, at, g, rng.uniform(-0.9, 0.9))
    out = band(out, 300, 3200)
    # near drops: a click and a rising bubble
    k = int(5 * LEN)
    for at in rng.integers(0, n, k):
        d = rng.uniform(0.006, 0.02)
        m = int(d * SR)
        tt = np.arange(m) / SR
        f0 = rng.uniform(1600, 4000)
        f = f0 * (1 + 0.6 * tt / d)  # a bubble's pitch rises as it closes
        ph = 2 * np.pi * np.cumsum(f) / SR
        g = np.sin(ph) * np.exp(-tt / (d / 3)) * 0.6
        click = int(0.0008 * SR)
        g[:click] += rng.standard_normal(click) * 0.5
        lvl = rng.lognormal(-3.4, 0.6)
        place(out, at, band(g, 500, 6000) * lvl, rng.uniform(-1, 1))
    # the awning: heavier, duller drops
    k = int(0.7 * LEN)
    for at in rng.integers(0, n, k):
        m = int(0.025 * SR)
        g = band(rng.standard_normal(m), 250, 900) * np.exp(-np.arange(m) / (m / 5))
        place(out, at, g * rng.lognormal(-2.9, 0.4), rng.uniform(-0.7, 0.7))
    # the street: a short, soft room
    L = int(0.7 * SR)
    ir = np.stack([band(rng.standard_normal(L), 200, 3000) * np.exp(-np.arange(L) / (0.12 * SR)) for _ in range(2)], 1)
    wet = np.stack([fftconvolve(out[:, c], ir[:, c])[:n] for c in range(2)], 1)
    out = out + wet * 0.25 * np.std(out) / (np.std(wet) + 1e-12)
    # the loop
    x = int(XF * SR)
    w = np.linspace(0, np.pi / 2, x)[:, None]
    loop = np.concatenate([out[-x:] * np.cos(w) + out[:x] * np.sin(w), out[x:-x]])
    loop *= 10 ** (-20 / 20) / np.sqrt(np.mean(loop ** 2))
    loop /= max(1.0, np.abs(loop).max() / 10 ** (-1 / 20))
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "r.wav")
        sf.write(wav, loop, SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "128k", OUT], check=True)
    print(f"{OUT}: {len(loop) / SR:.1f} s, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
