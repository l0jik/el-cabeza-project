"""Parrish's piece sounds, cut from the user's two recordings of
instrumental stabs (assets/parrish/src/instrumental-stab-1.mp3 and
instrumental-stab.mp3; user: "cut them up into very, very small pieces to
use as piece movement sounds").

Both are dense passages of music (a stab every ~0.16 s and ~0.22 s, over
pads and a bass), so the pieces are the cleanest single hits in them,
found by how sharply each one rises over what came just before it:

  notes   the first file's opening five seconds: lone pitched stabs with
          no bass under them (D5, C4, C#5, F3; and one D#4 from the
          second file): picking a piece up, putting it down.
  thumps  hits with the bass in them: a piece landing (pitched in the game
          by the face it lands on).
  ticks   bright, unpitched hits, a few hundredths of a second each: the
          piece on its way, scattered through the move.
  crash   one longer, full hit: a capture.

Each piece is cut from 4 ms before its attack (where it first reaches a
third of its height: some of the notes swell in), faded in over 2 ms, held,
then faded out (a raised cosine over its last 65%), brought to -1 dBFS at
its peak, and laid one after another (with 0.25 s of silence between) in
one mono 48 kHz file, assets/parrish/piece-stabs.mp3. The game decodes it
once and plays the slices (themes/parrish-audio.js STABS: each slice's
start and length, printed below; the game also finds each slice's first
sound itself, so an encoder's delay can't shift them).

    python3 tools/parrish_stabs.py
"""
import json
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {
    "a": os.path.join(ROOT, "assets/parrish/src/instrumental-stab-1.mp3"),
    "b": os.path.join(ROOT, "assets/parrish/src/instrumental-stab.mp3"),
}
OUT = os.path.join(ROOT, "assets/parrish/piece-stabs.mp3")
SR = 48000
GAP = 0.25

# name: (file, onset s, length ms) - onsets found by attack contrast
# (librosa onset strength, backtracked), see the docstring.
PIECES = [
    ("noteD5", "a", 0.155, 120),
    ("noteC4", "a", 1.130, 120),
    ("noteCs5", "a", 2.135, 110),
    ("noteD5b", "a", 2.780, 110),
    ("noteF3", "a", 3.455, 140),
    ("noteDs4", "b", 2.415, 120),
    ("thump1", "a", 12.365, 160),
    ("thump2", "a", 25.540, 160),
    ("thump3", "a", 17.635, 160),
    ("thump4", "a", 22.910, 160),
    ("tick1", "a", 25.865, 45),
    ("tick2", "a", 17.955, 45),
    ("tick3", "a", 23.225, 45),
    ("tick4", "a", 12.685, 45),
    ("tick5", "a", 39.035, 40),
    ("crash", "a", 39.720, 420),
]


def load(path):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), wav], check=True)
        y, _ = sf.read(wav, dtype="float64")
    return y


def attack(y, t):
    """Where the hit really strikes: the first point, within 0.12 s of the
    onset found, at which its envelope reaches a third of its height."""
    s = max(0, int(t * SR))
    w = np.abs(y[s:s + int(0.12 * SR)])
    k = int(0.002 * SR)
    env = np.convolve(w, np.ones(k) / k, mode="same")
    return (s + int(np.argmax(env >= env.max() / 3))) / SR


def cut(y, t, ms):
    s = max(0, int((attack(y, t) - 0.004) * SR))
    n = int(ms / 1000 * SR)
    g = y[s:s + n].copy()
    env = np.ones(n)
    fi = int(0.002 * SR)
    env[:fi] = np.linspace(0, 1, fi)
    fo = int(n * 0.65)
    env[n - fo:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, fo)))
    g *= env
    g -= g.mean() * env  # no step at the ends
    return g / (np.abs(g).max() + 1e-9) * 10 ** (-1 / 20)


def main():
    src = {k: load(p) for k, p in SRC.items()}
    parts, table, pos = [np.zeros(int(0.1 * SR))], {}, 0.1
    for name, f, t, ms in PIECES:
        g = cut(src[f], t, ms)
        table[name] = [round(pos, 4), round(len(g) / SR, 4)]
        parts += [g, np.zeros(int(GAP * SR))]
        pos += len(g) / SR + GAP
    y = np.concatenate(parts)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "s.wav")
        sf.write(wav, y, SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", OUT], check=True)
    print(json.dumps(table))
    print(f"{OUT}: {pos:.2f} s, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
