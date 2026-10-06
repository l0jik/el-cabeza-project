"""Parrish's soundtracks, one a look, each the user's own: Watermark's
"Cathedral Hums" (user: "use this as background track while playing
Watermark ... very low on the overall audio mix so as to not be
distracting", with its own slider), and Orinoco's "Dodhéanta an Ghrian"
(user: "the soundtrack for Orinoco. Volume sliders the same as
Watermark").

The game loops it, so it's made to loop here: its last 8 s laid over its
first 8 s with an equal-power crossfade, so the end flows into the start
with no seam (the file is that much shorter: 218 s -> 210 s). The cover
picture in the upload is left out. Stereo, 48 kHz, 128 kb/s.

    python3 tools/parrish_hums.py [watermark|orinoco]   (default: watermark)
"""
import os
import sys
import subprocess
import tempfile

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKS = {
    "watermark": ("assets/parrish/src/cathedral-hums.mp3", "assets/parrish/hums.mp3"),
    "orinoco": ("assets/parrish/src/dodheanta-an-ghrian.mp3", "assets/parrish/soundtrack-orinoco.mp3"),
}
SR = 48000
XFADE = 8.0


def main():
    look = sys.argv[1] if len(sys.argv) > 1 else "watermark"
    SRC, OUT = (os.path.join(ROOT, p) for p in TRACKS[look])
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", SRC, "-map", "0:a", "-ac", "2", "-ar", str(SR), wav], check=True)
        y, _ = sf.read(wav, dtype="float64")
        n = int(XFADE * SR)
        t = np.linspace(0, np.pi / 2, n)[:, None]
        head, tail = y[:n], y[-n:]
        # the loop: the tail fading out over the head fading in, then the rest
        loop = np.concatenate([tail * np.cos(t) + head * np.sin(t), y[n:-n]])
        loop /= max(1.0, np.abs(loop).max() / 10 ** (-1 / 20))
        out = os.path.join(d, "l.wav")
        sf.write(out, loop, SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", out, "-c:a", "libmp3lame", "-b:a", "128k", OUT], check=True)
    print(f"{OUT}: {len(loop) / SR:.1f} s, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
