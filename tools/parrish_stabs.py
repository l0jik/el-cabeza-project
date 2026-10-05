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

And from a fifth selection (short phrases of one, two or three stabs from
the second file, the percussive passages left out; user: "more variety"),
ten more, cut as they were played to the user (from 4 ms before the first
stab's onset, faded out over their last 30%):

  set 5 #6, #7    single stabs, ~A4 (mellow) and ~A#5 (bright): two more
                  notes for the pieces
  set 5 #9-13     two stabs each: the biggest pieces' landings (#9 ~D4,
                  #12 ~D#3, #13 ~C4), the rules opening and closing (#10,
                  #11, the brighter pair)
  set 5 #21-23    three stabs each: Begin Game (#21), a game ended by hand
                  (#22), a capture (#23, the deepest, with the bass)

And a sixth harvest (user: "more sound variety for when the Turrito or
Cabeza pieces move", "with all the same treatments"): twelve more bright
single stabs, B4 to D#6, none of them used before, found by a finer onset
scan of both files (onset delta 0.02) and kept only if clean (percussive
energy under 6%, no low thump, no second stab inside the cut), at most two
per pitch: set 6 #1-12. Cut as hits, cleaned like the rest.

And a seventh (user: "more two and three note tone variations"): twelve
more phrases of two or three stabs, from the first file (its phrases had
never been looked at; the second's were all used or offered in set 5),
found as set 5's were, the percussive passages left out (no frame more
than 40% percussive, under 16% on average, at least 75% harmonic): six
bright (D5 to B4), two in the middle (G4), four deep with the bass (G2):
set 7 #1-12, cut as phrases, cleaned like the rest.

No audible percussion (user: "there should be no audible percussion
used", of the capture win, set 3 #20, which had a snare under it): every
longer cut is cleaned. Its sound is split into the sustained (harmonic)
and the struck (percussive) parts (librosa HPSS, a soft mask, margin 2),
and only the sustained part kept, with the percussive left 24 dB under
it, except for the first 12 ms, kept as cut, so the stab's own attack
stays crisp (but not for the capture win, whose snare lands with the stab). The single notes, cut from quiet passages, need nothing.

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

import librosa
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
    # set 5: phrases, cut as auditioned (onset - 4 ms, last 30% faded)
    ("s5n6", "b", 6.14, 200, "phrase"),     # one stab, ~A4, mellow
    ("s5n7", "b", 26.76, 200, "phrase"),    # one stab, ~A#5, bright
    ("s5p9", "b", 9.65, 440, "phrase"),     # two, ~D4
    ("s5p10", "b", 12.73, 430, "phrase"),   # two, bright (~A5)
    ("s5p11", "b", 19.53, 510, "phrase"),   # two, bright (~G5)
    ("s5p12", "b", 4.62, 410, "phrase"),    # two, ~D#3, mellow
    ("s5p13", "b", 1.53, 720, "phrase"),    # two, ~C4, mellow
    ("s5p21", "b", 0.63, 890, "phrase"),    # three, ~D4/A#4, mellow
    ("s5p22", "b", 35.94, 740, "phrase"),   # three, ~G2, mellow
    ("s5p23", "b", 3.72, 630, "phrase"),    # three, ~D#2, with the bass
    # set 6: more bright single stabs for the smallest pieces (the Turrito
    # and the Cabeza), found by a finer onset scan of both files
    ("s6n1", "a", 24.225, 120),    # D#6
    ("s6n2", "b", 8.785, 120),    # C6
    ("s6n3", "a", 24.900, 120),    # C6
    ("s6n4", "b", 22.160, 120),    # A5
    ("s6n5", "a", 3.120, 120),    # D#5
    ("s6n6", "a", 2.455, 120),    # D#5
    ("s6n7", "a", 34.120, 120),    # D5
    ("s6n8", "a", 4.440, 120),    # D5
    ("s6n9", "a", 38.075, 120),    # C5
    ("s6n10", "a", 8.415, 120),   # C5
    ("s6n11", "a", 18.145, 120),   # B4
    ("s6n12", "a", 18.485, 120),   # B4
    # set 7: more short phrases of two or three stabs (user: "it would
    # increase the variety if we did more two and three note tone
    # variations"), from the first file (the second's were all used or
    # offered in set 5), cut and cleaned as set 5's
    ("s7p1", "a", 6.92, 480, "phrase"),  # 3 stabs, ~D5, bright
    ("s7p2", "a", 7.91, 320, "phrase"),  # 2 stabs, ~D5, bright
    ("s7p3", "a", 27.19, 300, "phrase"),  # 2 stabs, ~C5, bright
    ("s7p4", "a", 41.37, 290, "phrase"),  # 2 stabs, ~C5, bright
    ("s7p5", "a", 7.41, 310, "phrase"),  # 2 stabs, ~B4, bright
    ("s7p6", "a", 9.89, 450, "phrase"),  # 3 stabs, ~B4, bright
    ("s7p7", "a", 40.71, 310, "phrase"),  # 2 stabs, ~G4, mid
    ("s7p8", "a", 40.37, 330, "phrase"),  # 2 stabs, ~G4, mid
    ("s7p9", "a", 11.01, 330, "phrase"),  # 2 stabs, ~G2, deep, with bass
    ("s7p10", "a", 21.29, 300, "phrase"), # 2 stabs, ~G2, deep, with bass
    ("s7p11", "a", 42.68, 300, "phrase"), # 2 stabs, ~G2, deep, with bass
    ("s7p12", "a", 16.31, 310, "phrase"), # 2 stabs, ~G2, deep, with bass
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


# The cuts whose sound is cleaned of percussion (see the docstring).
CLEAN = {"winEdge", "winCapture", "s3n5", "s3n6", "s5n7", "s5p10", "s5p11", "s5p12", "s5p13", "s5p21", "s5p22", "s5p23",
         *(f"s6n{i}" for i in range(1, 13)), *(f"s7p{i}" for i in range(1, 13))}


def unstruck(g, keep_attack=True):
    """The sustained part of a cut, the struck part left 24 dB under it;
    its first 12 ms as they were (the stab's own attack), unless a drum
    lands with the stab (the capture win's snare): then all of it."""
    n_fft, hop = 2048, 256
    D = librosa.stft(g, n_fft=n_fft, hop_length=hop)
    H, P = librosa.decompose.hpss(D, margin=2.0)
    out = librosa.istft(H + P * 10 ** (-24 / 20), hop_length=hop, length=len(g))
    if not keep_attack:
        return out
    k = int(0.012 * SR)
    fade = np.linspace(0, 1, int(0.006 * SR))
    out[:k] = g[:k]
    out[k:k + len(fade)] = g[k:k + len(fade)] * (1 - fade) + out[k:k + len(fade)] * fade
    return out


def cut(y, t, ms, kind="hit"):
    s = max(0, int(((t if kind == "phrase" else attack(y, t)) - 0.004) * SR))
    n = int(ms / 1000 * SR)
    g = y[s:s + n].copy()
    env = np.ones(n)
    fi = int(0.002 * SR)
    env[:fi] = np.linspace(0, 1, fi)
    fo = int(n * (0.3 if kind == "phrase" else 0.65))
    env[n - fo:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, fo)))
    g *= env
    g -= g.mean() * env  # no step at the ends
    return g / (np.abs(g).max() + 1e-9) * 10 ** (-1 / 20)


def main():
    src = {k: load(p) for k, p in SRC.items()}
    parts, table, pos = [np.zeros(int(0.1 * SR))], {}, 0.1
    for name, f, t, ms, *kind in PIECES:
        g = cut(src[f], t, ms, *kind)
        if name in CLEAN:
            g = unstruck(g, keep_attack=name != "winCapture")
            g = g / (np.abs(g).max() + 1e-9) * 10 ** (-1 / 20)
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
