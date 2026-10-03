"""The Singularity's first visit, after the ring (themes/neon-unease.js
createDrone, LostNudge in neon-singularity.js): the user's recording of an
industrial pulse drone (assets/neon/src/industrial-pulse-drone-27456.mp3,
from Freesound), made into a loop.

The recording holds steady for about 25 s and then fades out over its
last eight. The steady part (0.5 to 25 s) is made to loop: its last 3 s
crossfaded (equal power) into its first 3 s. It's levelled to about
-16 dBFS RMS. Then a second of the loop's end is put before it and a
second of its start after it, so a player looping from 1 s to 1 s + LOOP
plays across the joins on the loop's own sound, whatever the decoder does
at the file's very ends (an mp3 is padded there). Stereo, 24 kHz, to
assets/neon/sphere-drone.mp3; LOOP (seconds) is printed, and
createDrone's DRONE_LOOP has to match it.

    python3 tools/neon_sphere_drone.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "neon", "src", "industrial-pulse-drone-27456.mp3")
OUT = os.path.join(ROOT, "assets", "neon", "sphere-drone.mp3")
SR = 24000
A, B, XF, PAD = 0.5, 25.0, 3.0, 1.0


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, 2)


def main():
    a = load(SRC)
    s = a[int(A * SR):int(B * SR)]
    xf = int(XF * SR)
    t = np.linspace(0, np.pi / 2, xf)[:, None]
    loop = np.concatenate([s[xf:-xf], s[-xf:] * np.cos(t) + s[:xf] * np.sin(t)])
    loop *= 10 ** (-16 / 20) / np.sqrt((loop ** 2).mean())
    loop = 0.95 * np.tanh(loop / 0.95)
    pad = int(PAD * SR)
    out = np.concatenate([loop[-pad:], loop, loop[:pad]])
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "d.wav")
        wavfile.write(wav, SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "96k", OUT], check=True)
    print(f"LOOP = {len(loop) / SR:.4f} s (from {PAD} s) -> {OUT}")


if __name__ == "__main__":
    main()
