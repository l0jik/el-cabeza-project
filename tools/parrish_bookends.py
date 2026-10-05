"""Parrish's opening and closing music, each laid in a long hall.

  intro  the user's opening of "Orinoco Flow" (assets/parrish/src/
         orinoco-beginning.mp3, 10.8 s; user: "add reverb and extend the
         tail on this one, allowing the decay to complete fully, 3
         seconds"): the hall dies away about 60 dB in 2.8 s, and 3 s more
         are added after the music's cut for it -> assets/parrish/intro.mp3
  outro  the user's end of "Orinoco Flow" (src/orinoco-end.mp3, 10.5 s;
         user: "add reverb and extend the tail on this one, the decay
         completes even if already back in the theme switcher"): a longer
         hall (about 6.5 s), 7 s more after the cut -> assets/parrish/outro.mp3

Both stop on a cut in the recording. The hall is a stereo impulse of
decaying noise (its highs dying first, after a 35 ms pre-delay, left and
right drawn apart), the wet mixed under the dry; the dry's last 0.2 s
faded so the cut doesn't click, and the hall rings on past it, faded to
nothing over the last stretch. The game plays them (themes/parrish-audio.js:
the intro on the first tap, the outro when the switcher opens).

    python3 tools/parrish_bookends.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
PRE = 0.035
# name: (source, out, RT60 s, tail s, wet, final fade s)
PIECES = {
    "intro": ("assets/parrish/src/orinoco-beginning.mp3", "assets/parrish/intro.mp3", 2.8, 3.0, 0.38, 0.8),
    "outro": ("assets/parrish/src/orinoco-end.mp3", "assets/parrish/outro.mp3", 6.5, 7.0, 0.42, 1.5),
}


def hall(rng, RT60):
    n, pre = int(SR * (RT60 + 0.5)), int(SR * PRE)
    ir = np.zeros((n, 2))
    t = np.arange(n - pre) / SR
    for ch in range(2):
        x = rng.standard_normal(n - pre)
        # The highs die first: a one-pole low-pass whose corner falls with time.
        lp, v = np.empty_like(x), 0.0
        a = 0.5 * np.exp(-t / (RT60 / 4)) + 0.06
        for i in range(len(x)):
            v += a[i] * (x[i] - v)
            lp[i] = v
        ir[pre:, ch] = lp * np.exp(-6.9 * t / RT60) * np.minimum(1, t / 0.01)
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def render(src, out_path, RT60, TAIL, WET, FADE):
    SRC, OUT = os.path.join(ROOT, src), os.path.join(ROOT, out_path)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", SRC, "-ar", str(SR), "-ac", "2", wav], check=True)
        dry, _ = sf.read(wav, dtype="float64")
    f = int(0.2 * SR)
    dry[-f:] *= np.linspace(1, 0, f)[:, None]
    ir = hall(np.random.default_rng(11), RT60)
    n = len(dry) + int(TAIL * SR)
    wet = np.zeros((n, 2))
    for c in range(2):
        w = fftconvolve(dry[:, c], ir[:, c])[:n]
        wet[:len(w), c] = w
    out = np.zeros((n, 2))
    out[:len(dry)] += dry
    out += wet * WET * np.abs(dry).max() / (np.abs(wet).max() + 1e-9) * 1.6
    g = int(FADE * SR)
    out[-g:] *= np.linspace(1, 0, g)[:, None] ** 2
    out *= 0.89 / np.abs(out).max()
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "o.wav")
        sf.write(wav, out, SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", OUT], check=True)
    print(f"{OUT}: {n / SR:.1f} s")


def main():
    for args in PIECES.values():
        render(*args)


if __name__ == "__main__":
    main()
