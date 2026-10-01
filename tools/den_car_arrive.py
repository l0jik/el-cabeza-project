"""The car arriving at Big Glutts (themes/den-trip.js), from the user's
recording (assets/den/src/car-arrive-stop-door.mp3, a freesound.org
community recording: a car driving up, accelerating, slowing to a stop,
the engine off, the door opened and shut).

The user: not so much of the first part; fade in to about the halfway
point and keep it all the way to the end; dress it up, make it fit. So:
from 6.5 s, fading in to full by 8.3 s (half way), as it comes nearer
duller to brighter (a 1.5 kHz-lowpassed copy crossfaded back to the
clean one: distance closing, the leaving recording's going in reverse);
then the stop (~10 s), the engine off (~11), the door open (~12.4) and
shut (~13.8) to the end. Band 50 Hz - 9 kHz, levelled as the leaving one
(loud parts ~-16 dBFS rms, peaks under -1 dB), a short fade at the very
end. Heard from the trip's T.arrive (9.8 s): the door shuts as the store
finishes fading up, just before "What the...!??". Written to
assets/den/car-arrive.mp3 (CAR_ARRIVE_URL in den-trip.js).

    python3 tools/den_car_arrive.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "car-arrive-stop-door.mp3")
OUT = os.path.join(ROOT, "assets", "den", "car-arrive.mp3")
SR = 44100
START, FULL = 6.5, 8.3


def load():
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-ar", str(SR), "-ac", "2", w], check=True)
        _, x = wavfile.read(w)
    return x.astype(np.float32) / 32768


def main():
    x = load()
    dark = sosfiltfilt(butter(2, 1500, "low", fs=SR, output="sos"), x, axis=0).astype(np.float32)
    a = int(START * SR)
    seg, dk = x[a:].copy(), dark[a:]
    t = START + np.arange(len(seg)) / SR
    k = np.clip((t - START) / (FULL - START), 0, 1)[:, None]
    k = k * k * (3 - 2 * k)
    seg = (seg * k + dk * (1 - k)) * (k ** 1.3)
    # (The recording's own silence at the end: a short fade into it.)
    end = int(0.25 * SR)
    seg[-end:] *= np.linspace(1, 0, end)[:, None]
    seg = sosfiltfilt(butter(2, 50, "high", fs=SR, output="sos"), seg, axis=0)
    seg = sosfiltfilt(butter(2, 9000, "low", fs=SR, output="sos"), seg, axis=0)
    loud = np.abs(seg).max(1) > 0.02
    rms = np.sqrt(np.mean(seg[loud] ** 2))
    seg *= 10 ** (-16 / 20) / max(rms, 1e-6)
    pk = np.abs(seg).max()
    if pk > 0.89:
        seg *= 0.89 / pk
    # Trim the recording's dead silence after the door.
    alive = np.nonzero(np.abs(seg).max(1) > 10 ** (-60 / 20))[0]
    seg = seg[:alive[-1] + int(0.1 * SR)]
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "o.wav")
        wavfile.write(w, SR, (seg * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", "96k", OUT], check=True)
    print(f"{len(seg) / SR:.2f} s -> {OUT}")


if __name__ == "__main__":
    main()
