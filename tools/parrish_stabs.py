"""Parrish's piece sounds, cut from the user's two recordings of
instrumental stabs (assets/parrish/src/instrumental-stab-1.mp3 and
instrumental-stab.mp3; user: "cut them up into very, very small pieces to
use as piece movement sounds").

The user's picks from the four selections offered (the cleanest single
hits in the two recordings, by how sharply each rises over what came just
before): fifteen lone notes, and two longer hits for the two ways a game
is won:

  set 1 (#1-6)    D5, C4, C#5, D5, F3 (the first file's quiet opening)
                  and D#4 (the second file's)
  set 1 #16       the full hit 39.7 s into the first file: a Cabeza
                  reaching the far side
  set 2 (#1-5)    B3, E4, C5, B3 (brighter) and D#3 (the second file's)
  set 3 (#3-6)    C4, D5 (first file), D4, C4 (second file)
  set 3 #20       the long stab 23.7 s into the second file: the last
                  Cabeza crushed

The game sorts the notes by pitch and gives each piece sound the notes for
its size, the deeper the bigger (themes/parrish-audio.js), and lays a long
hall reverb on all of it there.

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
    ("s1n1", "a", 0.155, 120),    # D5
    ("s1n2", "a", 1.130, 120),    # C4
    ("s1n3", "a", 2.135, 110),    # C#5
    ("s1n4", "a", 2.780, 110),    # D5
    ("s1n5", "a", 3.455, 140),    # F3
    ("s1n6", "b", 2.415, 120),    # D#4
    ("s2n1", "a", 1.795, 120),    # B3
    ("s2n2", "a", 26.055, 120),   # E4
    ("s2n3", "a", 4.950, 120),    # C5
    ("s2n4", "a", 12.885, 120),   # B3, brighter
    ("s2n5", "b", 2.855, 130),    # D#3
    ("s3n3", "a", 1.475, 120),    # C4
    ("s3n4", "a", 4.105, 120),    # D5
    ("s3n5", "b", 1.305, 120),    # D4
    ("s3n6", "b", 1.970, 120),    # C4
    ("winEdge", "a", 39.720, 420),     # set 1 #16
    ("winCapture", "b", 23.665, 380),  # set 3 #20
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
