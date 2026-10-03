"""The revelation's music (themes/den-ending.js), from the user's
recording, "Completion" (assets/den/src/completion.mp3, 3 minutes, in A
/ F#m: D, E, Bm, D, F#m, A, C#m, about 8 s a chord).

1. assets/den/void-music.mp3: its first 56.1 s, the length of the void
   scene from the white to the black (which lands on the change from the
   F#m to the A, 56 s in), the music itself easing out over the black,
   and through all of it a long reverb (user: more long-tail reverb): a
   room of ~8 s in the lows, ~4.5 s in the highs, 40 ms before it, kept
   ringing ~9 s on past the black, into the crawl.

2. assets/den/crawl-drone.mp3: for the crawl, on the black (user:
   something like it, much more toned down, that doesn't change; almost
   a vibration): the next chord (the A over E, 56.5-62.5 s) frozen: its
   average spectrum, given fresh random phases frame by frame (a held,
   breathing wash with no movement in it), its top taken off, through the
   same room; 24 s, looping seamlessly (its end crossfaded into its
   start). The page plays it quietly, with a slow swell and a faint
   shiver on it.

    python3 tools/den_void_music.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, fftconvolve

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "completion.mp3")
OUT_MUSIC = os.path.join(ROOT, "assets", "den", "void-music.mp3")
OUT_DRONE = os.path.join(ROOT, "assets", "den", "crawl-drone.mp3")
SR = 44100
CUT = 56.1            # the black (den-ending.js BLACK[1])
FADE = (54.6, 56.6)   # the music easing out over the black
TAIL = 9.0            # the room ringing on after it
FREEZE = (56.5, 62.5)
DRONE_S = 24.0


def load():
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-ar", str(SR), "-ac", "2", w], check=True)
        _, x = wavfile.read(w)
    return x.astype(np.float32) / 32768


def save(x, path, kbps):
    pk = np.abs(x).max()
    if pk > 0.89:
        x = x * (0.89 / pk)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "o.wav")
        wavfile.write(w, SR, (x * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", path], check=True)


def room(seconds=10.0, rt_low=8.0, rt_high=4.5, pre=0.04, seed=3):
    """A stereo impulse: decorrelated noise, decaying slower in the lows
    than the highs (two bands, each its own decay), after a short gap."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros((n + int(pre * SR), 2), np.float32)
    lo = butter(2, 900, "low", fs=SR, output="sos")
    hi = butter(2, 900, "high", fs=SR, output="sos")
    for c in range(2):
        nz = rng.standard_normal(n).astype(np.float32)
        a = sosfiltfilt(lo, nz) * np.exp(-6.91 * t / rt_low)
        b = sosfiltfilt(hi, nz) * np.exp(-6.91 * t / rt_high)
        env = 1 - np.exp(-t / 0.012)   # (a soft onset: no click)
        out[int(pre * SR):, c] = (a + 0.7 * b) * env
    return out / np.sqrt((out ** 2).sum() / 2)


def reverb(dry, ir, wet_db):
    wet = np.stack([fftconvolve(dry[:, c], ir[:, c])[: len(dry)] for c in range(2)], 1).astype(np.float32)
    rd = np.sqrt(np.mean(dry[np.abs(dry).max(1) > 0.003] ** 2))
    rw = np.sqrt(np.mean(wet[np.abs(wet).max(1) > 0.003] ** 2)) or 1
    return dry + wet * (rd / rw) * 10 ** (wet_db / 20)


def level(x, db):
    loud = x[np.abs(x).max(1) > 0.01]
    rms = np.sqrt(np.mean(loud ** 2)) if len(loud) else 1
    return x * (10 ** (db / 20) / max(rms, 1e-6))


def music(x, ir):
    n = int((CUT + TAIL) * SR)
    dry = np.zeros((n, 2), np.float32)
    end = int(FADE[1] * SR)
    dry[:end] = x[:end]
    a, b = int(FADE[0] * SR), end
    dry[a:b] *= (np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2)[:, None]
    out = reverb(dry, ir, -5.0)
    # (The tail's last two seconds eased to nothing.)
    m = int(2.0 * SR)
    out[-m:] *= np.linspace(1, 0, m)[:, None] ** 2
    return level(out, -17.0)


def drone(x, ir):
    seg = x[int(FREEZE[0] * SR):int(FREEZE[1] * SR)]
    N, H = 8192, 2048
    win = np.hanning(N).astype(np.float32)
    rng = np.random.default_rng(11)
    total = int((DRONE_S + 4.0) * SR)
    out = np.zeros((total + N, 2), np.float32)
    for c in range(2):
        frames = [np.abs(np.fft.rfft(seg[i:i + N, c] * win)) for i in range(0, len(seg) - N, H)]
        mag = np.mean(frames, 0)
        for i in range(0, total, H):
            ph = np.exp(1j * rng.uniform(0, 2 * np.pi, len(mag)))
            out[i:i + N, c] += np.fft.irfft(mag * ph).astype(np.float32) * win
    out = out[:total]
    # Toned down: the top off, the very bottom off.
    out = sosfiltfilt(butter(2, 1400, "low", fs=SR, output="sos"), out, axis=0)
    out = sosfiltfilt(butter(2, 50, "high", fs=SR, output="sos"), out, axis=0).astype(np.float32)
    out = reverb(out, ir, -3.0)
    # Seamless: the last 4 s crossfaded into the first 4 s.
    L, X = int(DRONE_S * SR), int(4.0 * SR)
    r = np.sin(np.linspace(0, np.pi / 2, X))[:, None] ** 2
    loop = out[:L].copy()
    loop[:X] = out[L:L + X] * (1 - r) + out[:X] * r
    return level(loop, -20.0)


def main():
    x = load()
    ir = room()
    m = music(x, ir)
    save(m, OUT_MUSIC, 128)
    d = drone(x, ir)
    save(d, OUT_DRONE, 96)
    print(f"music {len(m) / SR:.1f} s -> {OUT_MUSIC}; drone {len(d) / SR:.1f} s loop -> {OUT_DRONE}")


if __name__ == "__main__":
    main()
