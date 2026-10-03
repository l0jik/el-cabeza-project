"""The void's pad (themes/den-ending.js, the revelation): the user's
recording of an evolving drone pad (assets/den/src/evolving-drone-pad-
51339.mp3, from Freesound), from its 2-minute mark (user: fade it in from
around there), mixed in over the scene's own low hum.

From 2:00 to 3:50 (it fades out after that), 5 s faded in at the start
and 8 s out at the end, levelled to about -20 dBFS RMS with the peaks
softly held under -3 dBFS. Stereo, 24 kHz, to assets/den/void-pad.mp3
(served as el-cabeza-den-void-pad.mp3). The game cuts its lows on a
phone and limits the whole, so nothing here is filtered.

    python3 tools/den_void_pad.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "evolving-drone-pad-51339.mp3")
OUT = os.path.join(ROOT, "assets", "den", "void-pad.mp3")
SR = 24000
A, B, FIN, FOUT = 120.0, 230.0, 5.0, 8.0


def main():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, 2)
    x = a[int(A * SR):int(B * SR)].copy()
    n = len(x)
    fi, fo = int(FIN * SR), int(FOUT * SR)
    x[:fi] *= (np.sin(np.linspace(0, np.pi / 2, fi)) ** 2)[:, None]
    x[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
    body = x[fi:-fo]
    x *= 10 ** (-20 / 20) / np.sqrt((body ** 2).mean())
    lim = 10 ** (-3 / 20)
    x = lim * np.tanh(x / lim)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "p.wav")
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "112k", OUT], check=True)
    print(f"{n / SR:.1f} s from {A:.0f} s -> {OUT}")


if __name__ == "__main__":
    main()
