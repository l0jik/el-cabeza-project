"""The den's set messing up (themes/den-audio.js tvHaunt): the user's
recording of a TV glitching (assets/den/src/tv-glitch-6245.mp3, from
Freesound), made ready to be cut into pieces in the game.

The recording is a digital glitch clipped hard: it slams between the two
rails (louder than full scale) with hiss riding on them, and in a few
places it's held flat on a rail for a tenth of a second or more (no
sound, only a click at each end). Those are found (20 ms windows with
nothing moving in them) and cut out, the edges crossfaded; what's left
has its rumble taken off (60 Hz), is brought down to a sane level (about
-18 dBFS RMS, the peaks softly held under -1 dBFS), and written mono at
24 kHz to assets/den/tv-glitch.mp3. The game plays slices of it at random
through the set's small speaker, mixed in with its own made sounds.

    python3 tools/den_tv_glitch.py
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "tv-glitch-6245.mp3")
OUT = os.path.join(ROOT, "assets", "den", "tv-glitch.mp3")
SR = 24000


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def slabs(a, win=int(SR * 0.02)):
    """Windows held flat on a rail (nothing moving in them): the slabs."""
    n = len(a) // win
    bad = np.array([a[i * win:(i + 1) * win].std() < 0.01 for i in range(n)])
    return bad, win


def main():
    a = load(SRC)
    bad, win = slabs(a)
    # Runs of good windows, kept; each joined to the next with a 10 ms crossfade.
    keep, start = [], None
    for i, b in enumerate(bad):
        if not b and start is None:
            start = i
        if (b or i == len(bad) - 1) and start is not None:
            end = i if b else i + 1
            if end - start >= 3:
                keep.append(a[start * win:end * win])
            start = None
    xf = int(SR * 0.01)
    out = keep[0]
    for k in keep[1:]:
        ramp = np.linspace(0, 1, xf)
        out = np.concatenate([out[:-xf], out[-xf:] * (1 - ramp) + k[:xf] * ramp, k[xf:]])
    out = sosfiltfilt(butter(4, 60, "highpass", fs=SR, output="sos"), out)
    out *= 10 ** (-18 / 20) / np.sqrt((out ** 2).mean())
    lim = 10 ** (-1 / 20)
    out = lim * np.tanh(out / lim)
    fade = int(SR * 0.005)
    out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "g.wav")
        wavfile.write(wav, SR, (out * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "96k", OUT], check=True)
    print(f"{len(a) / SR:.2f} s in, {bad.sum()} slab windows cut, {len(out) / SR:.2f} s out -> {OUT}")


if __name__ == "__main__":
    main()
