"""Parrish's closing music (user: "use this as [closing] music when
Orinoco or Watermark are closed. Add reverb and extend the tail on this
one, the decay completes even if already back in the theme switcher").

The user's recording of the end of "Orinoco Flow"
(assets/parrish/src/orinoco-end.mp3, 10.5 s) stops on a cut, on a full
hit. Here it's laid into a long hall: a stereo impulse of decaying noise
(its highs dying first, about 6.5 s to fall 60 dB, after a 35 ms
pre-delay, left and right drawn apart), the wet mixed under the dry; the
dry's last 0.2 s faded so the cut doesn't click, and the hall rings on
past it for about 7 s more, faded to nothing at the very end. Written to
assets/parrish/outro.mp3 (the game plays it when the switcher opens over
the page, themes/parrish-audio.js).

    python3 tools/parrish_outro.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/parrish/src/orinoco-end.mp3")
OUT = os.path.join(ROOT, "assets/parrish/outro.mp3")
SR = 48000
RT60, PRE, TAIL, WET = 6.5, 0.035, 7.0, 0.42


def hall(rng):
    n, pre = int(SR * (RT60 + 0.5)), int(SR * PRE)
    ir = np.zeros((n, 2))
    t = np.arange(n - pre) / SR
    for ch in range(2):
        x = rng.standard_normal(n - pre)
        # The highs die first: a one-pole low-pass whose corner falls with time.
        lp, v = np.empty_like(x), 0.0
        a = 0.5 * np.exp(-t / 1.6) + 0.06
        for i in range(len(x)):
            v += a[i] * (x[i] - v)
            lp[i] = v
        ir[pre:, ch] = lp * np.exp(-6.9 * t / RT60) * np.minimum(1, t / 0.01)
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def main():
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", SRC, "-ar", str(SR), "-ac", "2", wav], check=True)
        dry, _ = sf.read(wav, dtype="float64")
    f = int(0.2 * SR)
    dry[-f:] *= np.linspace(1, 0, f)[:, None]
    ir = hall(np.random.default_rng(11))
    n = len(dry) + int(TAIL * SR)
    wet = np.zeros((n, 2))
    for c in range(2):
        w = fftconvolve(dry[:, c], ir[:, c])[:n]
        wet[:len(w), c] = w
    out = np.zeros((n, 2))
    out[:len(dry)] += dry
    out += wet * WET * np.abs(dry).max() / (np.abs(wet).max() + 1e-9) * 1.6
    g = int(1.5 * SR)
    out[-g:] *= np.linspace(1, 0, g)[:, None] ** 2
    out *= 0.89 / np.abs(out).max()
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "o.wav")
        sf.write(wav, out, SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", OUT], check=True)
    print(f"{OUT}: {n / SR:.1f} s")


if __name__ == "__main__":
    main()
