"""Noir's recorded sounds, made from the recordings in assets/noir/src/
(where CREDITS.md says whose each is, and its licence):

  the rain    (user: "make sure you get some better rain sounds"; it was
              made of drops here, and before that of noise) two recordings
              together: kyles's "rain medium on street pavement" (CC0), a
              steady stereo rain with every drop in it, twice through; and
              under it, 3 dB down, craigsmith's "G39-22-Rain on Concrete"
              (CC0), one of the Hollywood studios' own rain effects from the
              1930s-60s, made wide (the right channel the same rain 23.7 s
              on). Both cut below 200 Hz, where their hum is (the old
              transfer's mains and machine, 59-182 Hz; a tone at 68-71 Hz in
              the other), with a few narrow notches above it; the top rolled
              away above about 6.5 kHz, as an old picture's sound is; the
              whole a seamless 57 s loop, the tops of its hundred or so
              loudest ticks rounded off. -> assets/noir/rain.mp3
  the thunder craigsmith's "R30-30-Classic Thunder Clap" and one clap of
              his "G46-12-Thunderclap Fox" (CC0), each from its crack to the
              end of its roll. -> thunder-1.mp3, thunder-2.mp3
  the engine  lonemonk's "1951 Mercury-Idle and Throttle" (CC BY 4.0: the
              About card credits it), a 255 cu in flathead V8, the engine of
              the 1939-51 Fords and Mercurys: its steady idle (2-8 s), a
              seamless loop, the game pitching it up with the car's speed ->
              car-engine.mp3; and the smooth rev at 41.5-43.95 s, for a car
              pulling out of a turn, starting at the pitch the loop has at
              street speed -> car-rev.mp3
  the tyres   Breviceps's "Passing Car (Wet road)" (CC0, user: "use the CC0
              Breviceps one"), taken at about 100 km/h: the spray of its
              tyres on the wet road after it has gone by (2.85-5.2 s), its
              fall taken out so it holds steady, slowed to city speed (x0.62,
              lower and softer), looped. -> car-tyres.mp3

  the sirens  a police car's mechanical siren of the 1930s-50s (a motor
              spinning a rotor: it winds up to a scream and growls down as
              it slows), three ways: craigsmith's "S06-04 Old mechanical
              police siren" (CC0, from the Hollywood studios' library), its
              two goes, a wind-up and fall (1.6-13.4 s) -> siren-2.mp3, and
              a wind-up, hold and the long growl down (13.45 s to the end)
              -> siren-1.mp3; and CGEffex's "Old Police Siren" (CC BY 4.0:
              the About card credits it), an old one run off a car battery,
              its first half minute, the chase: pulsed up and down, then
              wound down -> siren-3.mp3. Each its loudest 2 s at -14 dBFS,
              cut below 100 Hz and above 9 kHz; the game puts them far off.

A loop's file is the loop with 0.3 s of its own end before it and of its
own start after it, so whichever sample the game finds first, the content
round its loop points runs on unbroken (themes/noir-audio.js takes the
loop as from the first sound + 0.3 s to the last sound - 0.3 s).

    FFMPEG=/path/to/ffmpeg python3 tools/noir_sounds.py [rain thunder engine tyres siren]
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, iirnotch, resample_poly, sosfiltfilt, filtfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/noir/src")
OUT = os.path.join(ROOT, "assets/noir")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 48000
PAD = 0.3


def load(name):
    """A source, decoded at 48 kHz, as mono."""
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", "2", wav], check=True)
        x, sr = sf.read(wav, always_2d=True)
    return x.mean(1)


def cut(x, a, b):
    return x[int(a * SR):int(b * SR)].copy()


def hp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "highpass", fs=SR, output="sos"), x, axis=0)


def lp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x, axis=0)


def notch(x, f, q=25):
    b, a = iirnotch(f, q, fs=SR)
    return filtfilt(b, a, x, axis=0)


def rms(x):
    return np.sqrt(np.mean(x ** 2))


def to_db(x, db):
    return x * (10 ** (db / 20) / rms(x))


def soft_peaks(x, knee_db=18, room_db=4):
    """The tops of the loudest ticks (a drop right by the microphone)
    rounded off above `knee_db` over the average, to `room_db` more at the
    most, so the whole needn't be turned down for a few of them."""
    t = rms(x) * 10 ** (knee_db / 20)
    c = t * 10 ** (room_db / 20)
    a = np.abs(x)
    big = a > t
    out = x.copy()
    out[big] = np.sign(x[big]) * (t + (c - t) * np.tanh((a[big] - t) / (c - t)))
    return out


def fades(x, fin=0.01, fout=0.05):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a) if x.ndim == 1 else np.linspace(0, 1, a)[:, None]
    if b:
        x[-b:] *= np.linspace(1, 0, b) if x.ndim == 1 else np.linspace(1, 0, b)[:, None]
    return x


def loop_of(seg, length, xf):
    """seg (length + xf long) made a seamless loop `length` long: its last
    xf crossfaded (equal power) over its first."""
    n, x = int(length * SR), int(xf * SR)
    w = np.linspace(0, np.pi / 2, x)
    if seg.ndim > 1:
        w = w[:, None]
    head = seg[n:n + x] * np.cos(w) + seg[:x] * np.sin(w)
    return np.concatenate([head, seg[x:n]])


def best_length(seg, near, xf, span=0.06):
    """The loop length near `near` whose crossfade lines up best (the end
    most like the start), for an engine's beat not to stumble at the seam."""
    x = int(xf * SR)
    a = seg[:x]
    best, bl = -2, near
    for n in range(int((near - span) * SR), int((near + span) * SR), 4):
        b = seg[n:n + x]
        c = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)
        if c > best:
            best, bl = c, n / SR
    return bl, best


def padded(loop):
    """The loop with PAD of its own end before it and of its start after it."""
    p = int(PAD * SR)
    return np.concatenate([loop[-p:], loop, loop[:p]])


def write(x, name, kbps):
    path = os.path.join(OUT, name)
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x * (0.98 / peak)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        sf.write(wav, x, SR, subtype="PCM_16")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", f"{kbps}k", path], check=True)
    ch = 1 if x.ndim == 1 else x.shape[1]
    print(f"{path}: {len(x) / SR:.2f} s, {ch} ch, {os.path.getsize(path) // 1024} KB")


def load_stereo(name):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", "2", wav], check=True)
        x, sr = sf.read(wav, always_2d=True)
    return x


def rain():
    L = 57.0
    # the old studio's rain on concrete, wide
    v = cut(load("rain-on-concrete-craigsmith-438639.ogg"), 6.0, 67.0)
    v = hp(v, 200, 4)
    for f in (301, 434.5, 484):
        v = notch(v, f)
    v = loop_of(v, L, 4.0)
    d = int(23.7 * SR)
    v = np.stack([v, np.roll(v, -d)], 1)
    # the pavement in stereo, a loop half as long, twice through
    k = load_stereo("rain-on-pavement-kyles-454143.ogg")[: int(35.4 * SR)]
    k = hp(k, 200, 4)
    for f in (229, 318.5, 687.5):
        k = notch(k, f)
    k = loop_of(k, L / 2, 4.0)
    k = np.concatenate([k, k])[: len(v)]
    mix = to_db(k, -20) + to_db(v, -23)
    mix = to_db(soft_peaks(to_db(lp(mix, 6500), -20)), -20)
    write(padded(mix), "rain.mp3", 128)


def thunder():
    a = cut(load("thunder-clap-craigsmith-486275.ogg"), 0.82, 10.5)
    a = fades(hp(a, 25), 0.005, 2.5)
    b = cut(load("thunderclap-fox-craigsmith-438749.ogg"), 47.15, 66.6)
    b = fades(hp(b, 25), 0.005, 3.0)
    # the same weight at the crack (its first 3 s)
    for x, name in ((a, "thunder-1.mp3"), (b, "thunder-2.mp3")):
        x = x * (10 ** (-16 / 20) / rms(x[: 3 * SR]))
        write(x, name, 96)


def engine():
    m = hp(load("mercury-idle-throttle-lonemonk-62566.ogg"), 28)
    seg = cut(m, 2.0, 8.0)
    n, c = best_length(seg, 5.0, 0.3)
    loop = to_db(loop_of(seg, n, 0.3), -18)
    print(f"engine loop {n:.4f} s (seam correlation {c:.3f})")
    write(padded(loop), "car-engine.mp3", 96)
    rev = cut(m, 41.5, 43.95)
    # its start as loud as the loop (it grows louder as it climbs)
    rev = rev * (rms(loop) / rms(rev[: int(0.3 * SR)]))
    write(fades(rev, 0.03, 0.12), "car-rev.mp3", 96)


def tyres():
    x = cut(load("passing-car-wet-road-breviceps-462862.ogg"), 2.85, 5.2)
    # its fall as the car goes away taken out: steady spray
    w = int(0.25 * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode="same")) + 1e-6
    x = x / env
    # slowed to city speed: 0.62 of the speed, so lower and longer
    x = resample_poly(x, 50, 31)
    x = lp(hp(x, 80), 5000)
    loop = to_db(loop_of(x, len(x) / SR - 0.45, 0.4), -20)
    write(padded(loop), "car-tyres.mp3", 96)


def loudest(x, secs=2.0):
    """The RMS of the loudest `secs` of x."""
    w = int(secs * SR)
    e = np.convolve(x ** 2, np.ones(w) / w, mode="valid")
    return np.sqrt(e.max())


def siren():
    def make(x, name):
        x = lp(hp(x, 100), 9000)
        x = x * (10 ** (-14 / 20) / loudest(x))
        write(fades(x, 0.02, 0.3), name, 80)
    m = load("siren-old-mechanical-police-craigsmith-675700.ogg")
    make(m[int(13.45 * SR):], "siren-1.mp3")
    make(cut(m, 1.6, 13.4), "siren-2.mp3")
    make(cut(load("old-police-siren-cgeffex-121902.ogg"), 0.4, 31.0), "siren-3.mp3")


if __name__ == "__main__":
    import sys
    only = sys.argv[1:]
    for step in (rain, thunder, engine, tyres, siren):
        if not only or step.__name__ in only:
            step()
