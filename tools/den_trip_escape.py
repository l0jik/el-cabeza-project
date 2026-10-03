"""Getting out of the closed Big Glutts (themes/den-trip.js), from the
user's recordings (freesound.org community): footsteps on debris
(assets/den/src/steps-on-debris.mp3), a car door opened and shut
(car-door-open-close.mp3), the car starting and pulling away
(car-start-drive-away.mp3, as tools/den_car_away.py), and a burnout's
peel-out (burnout.mp3, a Nissan Maxima: its 2-4 s, the user's pick).

One track, started with the first step back (TRACK_AT in den-trip.js), so
it can't drift from the camera:

  0.1, 1.9, 3.7 s   three slow steps backwards, one with each of the
                    camera's (isolated crunches from the walk, played at
                    0.92; user: they were too loud, jarring: now quiet,
                    soft, careful, the grit's top taken off)
  6.2 - 8.8 s       turning and running for the car (the walk's quickest
                    stretch, ~0.2 s a step, slowing at the car)
  8.7 - 9.9 s       the door: the handle, yanked open, in, slammed
  9.95 - 12.4 s     the key, a short crank, the catch and a rev (1.15x:
                    in a hurry; user: the car starting and away has to
                    come sooner)
  12.4 - 16.7 s     away, hard: the tyres peeling out (the burnout's
                    2-4 s, faded in and out, its squeal landing as the
                    car pulls away) and the acceleration, duller and
                    gone with distance

Everything levelled to the trip's other sounds; peaks under -1 dB.
Written to assets/den/trip-escape.mp3.

    python3 tools/den_trip_escape.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, resample_poly

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src")
OUT = os.path.join(ROOT, "assets", "den", "trip-escape.mp3")
SR = 44100

BACK_STEPS = [10.11, 24.00, 34.07]   # source onsets: isolated crunches
BACK_AT = [0.1, 1.9, 3.7]            # where they land in the track
RUN = [(116.95, 118.75), (122.05, 122.85)]
RUN_AT = 6.2
DOOR = [(0.72, 1.12), (1.50, 1.75), (2.82, 3.45)]
DOOR_AT = 8.7
START = (4.6, 7.4)
AWAY = (9.3, 14.2)
CAR_AT = 9.95
CAR_RATE = 1.15


def load(name, ch=2):
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", str(ch), w], check=True)
        _, x = wavfile.read(w)
    x = x.astype(np.float32) / 32768
    return x if x.ndim == 2 else np.stack([x, x], 1)


def cut(x, a, b):
    return x[int(a * SR):int(b * SR)].copy()


def fades(seg, fi=0.01, fo=0.05):
    n, m = int(fi * SR), int(fo * SR)
    seg[:n] *= np.linspace(0, 1, n)[:, None]
    seg[-m:] *= np.linspace(1, 0, m)[:, None] ** 1.5
    return seg


def join(parts, xf=0.04):
    out = parts[0]
    n = int(xf * SR)
    r = np.sin(np.linspace(0, np.pi / 2, n))[:, None] ** 2
    for p in parts[1:]:
        out = np.concatenate([out[:-n], out[-n:] * (1 - r) + p[:n] * r, p[n:]])
    return out


def rate(x, k):
    # Played k times as fast (and pitched with it, as tape would be).
    up, down = 100, int(round(100 * k))
    return resample_poly(x, up, down, axis=0).astype(np.float32)


def level(x, db):
    loud = x[np.abs(x).max(1) > 0.01]
    rms = np.sqrt(np.mean(loud ** 2)) if len(loud) else 1
    return x * (10 ** (db / 20) / max(rms, 1e-6))


def place(track, seg, at):
    i = int(at * SR)
    need = i + len(seg)
    if need > len(track):
        track = np.concatenate([track, np.zeros((need - len(track), 2), np.float32)])
    track[i:i + len(seg)] += seg
    return track


BURNOUT = (2.0, 4.0)   # the user's pick: the rev building, then the tyres
BURNOUT_PEEL = 1.1     # where in that the squeal breaks (source 3.1 s)


def main():
    steps = load("steps-on-debris.mp3")
    door = load("car-door-open-close.mp3")
    car = load("car-start-drive-away.mp3")
    burn = load("burnout.mp3")
    track = np.zeros((int(20.5 * SR), 2), np.float32)

    # Backwards: each crunch alone, slower, quiet and soft (careful): its
    # grit's top taken off, eased in rather than struck.
    soft = butter(2, 2200, "low", fs=SR, output="sos")
    for on, at in zip(BACK_STEPS, BACK_AT):
        seg = rate(cut(steps, on - 0.05, on + 0.6), 0.92)
        seg = fades(sosfiltfilt(soft, seg, axis=0).astype(np.float32), 0.03, 0.25)
        track = place(track, level(seg, -32), at - 0.05)
    # The run, slowing into the car.
    run = join([fades(cut(steps, a, b), 0.01, 0.03) for a, b in RUN], 0.05)
    k = np.ones(len(run))
    k[-int(0.7 * SR):] = np.linspace(1, 0.55, int(0.7 * SR))
    run = fades(run * k[:, None], 0.15, 0.12)
    track = place(track, level(run, -22), RUN_AT)
    # The door, hurried.
    d = join([fades(cut(door, a, b), 0.005, 0.03) for a, b in DOOR], 0.02)
    track = place(track, level(d, -17), DOOR_AT)
    # The car, in a hurry: started, then away hard, and gone.
    start = rate(cut(car, *START), CAR_RATE)
    away = rate(cut(car, *AWAY), CAR_RATE)
    n = len(away)
    tt = np.arange(n) / SR
    k = np.clip((tt - (len(away) / SR - 2.2)) / 2.2, 0, 1)[:, None]
    dark = sosfiltfilt(butter(2, 1200, "low", fs=SR, output="sos"), away, axis=0).astype(np.float32)
    away = (away * (1 - k) + dark * k) * ((1 - k) ** 1.6)
    c = join([fades(start, 0.05, 0.03), away], 0.08)
    track = place(track, level(c, -16), CAR_AT)
    # The peel-out: faded in over its rev, out over its last 0.6 s, the
    # squeal breaking just as the car pulls away.
    peel = fades(cut(burn, *BURNOUT), 0.35, 0.6)
    track = place(track, level(peel, -19), CAR_AT + len(start) / SR + 0.1 - BURNOUT_PEEL)

    out = sosfiltfilt(butter(2, 45, "high", fs=SR, output="sos"), track, axis=0)
    out = sosfiltfilt(butter(2, 10000, "low", fs=SR, output="sos"), out, axis=0)
    pk = np.abs(out).max()
    if pk > 0.89:
        out *= 0.89 / pk
    last = np.nonzero(np.abs(out).max(1) > 1e-4)[0][-1]
    out = out[:last + int(0.2 * SR)]
    with tempfile.TemporaryDirectory() as dd:
        w = os.path.join(dd, "o.wav")
        wavfile.write(w, SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", "96k", OUT], check=True)
    print(f"{len(out) / SR:.2f} s -> {OUT}; car {CAR_AT:.1f}-{CAR_AT + (len(start) + len(away)) / SR:.1f} s")


if __name__ == "__main__":
    main()
