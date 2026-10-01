"""The car leaving for Big Glutts (themes/den-trip.js), from the user's
recording (assets/den/src/car-start-drive-away.mp3, a freesound.org
community recording: a car door, getting in, the door shut, the key, the
starter, the engine catching with a rev or two, idling, then pulling away
through first gear and on).

The user: after the first acceleration, fade it right off, and treat it
so it fits. The trip's card fades as it starts, it's black by 7.35 s and
the arrival is heard from 9.8 s, so it's tightened to end before that:

  1.0-3.5 s    the door, getting in, the door shut
  3.7-8.1 s    the key, the starter cranking, the catch and its revs,
               into the idle
  9.0-11.6 s   the idle's end and the first acceleration away, fading out
               from 10.5 s as the car goes, duller as it goes (the highs
               rolled off from 8 kHz to 1.5 kHz: distance), gone by 11.6

joined with 60 ms crossfades; the whole gently band-limited (50 Hz -
9 kHz) and levelled to the trip's other sounds. Written to
assets/den/car-away.mp3 (CAR_AWAY_URL in den-trip.js).

    python3 tools/den_car_away.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "car-start-drive-away.mp3")
OUT = os.path.join(ROOT, "assets", "den", "car-away.mp3")
SR = 44100
SEGMENTS = [(1.0, 3.5), (3.7, 8.1), (9.0, 11.6)]
XF = 0.06
FADE = (10.5, 11.6)  # source seconds: the last segment's fade out


def load():
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-ar", str(SR), "-ac", "2", w], check=True)
        _, x = wavfile.read(w)
    return x.astype(np.float32) / 32768


def main():
    x = load()
    # The going: a darker copy of the last stretch, crossfaded in as it fades.
    dark = sosfiltfilt(butter(2, 1500, "low", fs=SR, output="sos"), x, axis=0).astype(np.float32)
    out = None
    for si, (a, b) in enumerate(SEGMENTS):
        seg = x[int(a * SR):int(b * SR)].copy()
        if si == len(SEGMENTS) - 1:
            t = a + np.arange(len(seg)) / SR
            k = np.clip((t - FADE[0]) / (FADE[1] - FADE[0]), 0, 1)[:, None]
            seg = seg * (1 - k) + dark[int(a * SR):int(b * SR)] * k
            seg *= ((1 - k) ** 1.6)
        if out is None:
            out = seg
            continue
        n = int(XF * SR)
        r = np.sin(np.linspace(0, np.pi / 2, n))[:, None] ** 2
        out = np.concatenate([out[:-n], out[-n:] * (1 - r) + seg[:n] * r, seg[n:]])
    # A short fade in at the head (it starts on the door's first sounds).
    h = int(0.08 * SR)
    out[:h] *= np.linspace(0, 1, h)[:, None]
    out = sosfiltfilt(butter(2, 50, "high", fs=SR, output="sos"), out, axis=0)
    out = sosfiltfilt(butter(2, 9000, "low", fs=SR, output="sos"), out, axis=0)
    # Levelled: loud passages about -16 dBFS rms, peaks kept under -1 dB.
    rms = np.sqrt(np.mean(out[np.abs(out).max(1) > 0.02] ** 2))
    out *= 10 ** (-16 / 20) / max(rms, 1e-6)
    pk = np.abs(out).max()
    if pk > 0.89:
        out *= 0.89 / pk
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "o.wav")
        wavfile.write(w, SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", "96k", OUT], check=True)
    print(f"{len(out) / SR:.2f} s -> {OUT}")


if __name__ == "__main__":
    main()
