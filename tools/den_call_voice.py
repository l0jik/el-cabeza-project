"""Big Glutts on the line (themes/den-call.js): the caller's three lines,
made from the user's two-second recording of indistinct chatter
(assets/den/src/call-chatter.ogg; user: cut it up and alter it, make it
more unintelligible, match the cadence of the conversation).

The voice in the recording is cut into syllable grains at the dips in its
loudness. There are few of those, so overlapping windows through the voiced
stretches are taken too. Each line is then built syllable by syllable to its own words'
counts (the same count den-call.js uses for its timing), every syllable a
grain picked at random, about half of them played backwards (the voice's
own sound, no words left in it), each nudged in pitch: the line starting
a little high and falling through it, a question rising at its end, the
stressed syllable of a word a touch louder. Short gaps between words,
longer at commas, longer still at an ellipsis. Then a little muffled (an
earpiece pressed to the other end), and levelled.

The three lines go into one file, one per SLOT seconds (CALL_VOICE in
den-call.js gives each one's length), written to assets/den/call-voice.mp3.

    python3 tools/den_call_voice.py
"""
import os
import re
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "den", "src", "call-chatter.ogg")
OUT = os.path.join(ROOT, "assets", "den", "call-voice.mp3")
SR = 24000
SLOT = 8.0
LINES = [
    "Oh, good news! This is Big Glutts. We actually found the pieces you were looking for.",
    "Oh. You do?",
    "Well… you can come get these for free, if you like. We're sorry for any inconvenience.",
]


def load():
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "x.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-ac", "1", "-ar", str(SR), w], check=True)
        sr, x = wavfile.read(w)
    return x.astype(np.float32) / 32768


def grains(x):
    """Syllable-sized pieces of the voice: split at the dips in a smoothed
    loudness, kept if they're 70-320 ms and loud enough."""
    h = int(SR * 0.005)
    env = np.array([np.sqrt(np.mean(x[i:i + h] ** 2)) for i in range(0, len(x) - h, h)])
    k = np.ones(7) / 7
    env = np.convolve(env, k, mode="same")
    top = env.max()
    voiced = env > top * 0.1
    out = []
    i = 0
    n = len(env)
    while i < n:
        if not voiced[i]:
            i += 1
            continue
        j = i
        while j < n and voiced[j]:
            j += 1
        # Within a voiced run, cut at local minima well below their peaks.
        cuts = [i]
        for m in range(i + 14, j - 14):
            if env[m] == env[m - 10:m + 11].min() and env[m] < 0.6 * max(env[cuts[-1]:m].max(), 1e-9) and m - cuts[-1] >= 14:
                cuts.append(m)
        cuts.append(j)
        for a, b in zip(cuts[:-1], cuts[1:]):
            dur = (b - a) * h / SR
            if 0.07 <= dur <= 0.32 and env[a:b].max() > top * 0.25:
                out.append(x[a * h:b * h].copy())
            elif dur > 0.32:  # too long: halve it
                mid = (a + b) // 2
                for aa, bb in ((a, mid), (mid, b)):
                    if env[aa:bb].max() > top * 0.25:
                        out.append(x[aa * h:bb * h].copy())
        i = j
    # (Six or so of those in two seconds: too few, they'd be heard to
    # repeat. More, overlapping: windows of 110-190 ms stepped every 30 ms
    # through the voiced stretches, each starting near a dip if one's close.)
    rng = np.random.default_rng(7)
    loud = np.repeat(voiced, h)[:len(x)]
    for s0 in range(0, len(x) - int(SR * 0.19), int(SR * 0.03)):
        L = int(SR * rng.uniform(0.11, 0.19))
        if loud[s0:s0 + L].mean() > 0.85:
            out.append(x[s0:s0 + L].copy())
    return out


def syllables(w):
    w = re.sub(r"e$", "", re.sub(r"[^a-z]", "", w.lower()))
    return max(1, len(re.findall(r"[aeiouy]+", w)))


def repitch(g, semis):
    """Resampled: higher and shorter, or lower and longer."""
    r = 2 ** (semis / 12)
    n = max(8, int(len(g) / r))
    return np.interp(np.linspace(0, len(g) - 1, n), np.arange(len(g)), g).astype(np.float32)


def faded(g, ms=12):
    f = min(len(g) // 3, int(SR * ms / 1000))
    g = g.copy()
    ramp = np.sin(np.linspace(0, np.pi / 2, f)) ** 2
    g[:f] *= ramp
    g[-f:] *= ramp[::-1]
    return g


def build(text, G, rng):
    words = text.split()
    total = sum(syllables(w) for w in words)
    question = text.rstrip().endswith("?")
    out = [np.zeros(int(SR * 0.05), np.float32)]
    k = 0
    last = -1
    for wi, w in enumerate(words):
        n = syllables(w)
        stress = rng.integers(0, n)
        for si in range(n):
            pick = rng.integers(0, len(G))
            if pick == last:
                pick = (pick + 1) % len(G)
            last = pick
            g = G[pick]
            if rng.random() < 0.5:
                g = g[::-1]
            # Short words are quick; nothing over ~0.22 s a syllable.
            want = rng.uniform(0.13, 0.22) if n > 1 else rng.uniform(0.15, 0.25)
            frac = k / max(1, total - 1)
            semis = 1.4 - 2.8 * frac + rng.uniform(-0.8, 0.8)
            if question and k >= total - 2:
                semis += 3.5 if k == total - 1 else 1.5
            g = repitch(g, semis)
            if len(g) > int(SR * want):
                s0 = rng.integers(0, len(g) - int(SR * want) + 1)
                g = g[s0:s0 + int(SR * want)]
            g = faded(g) * (1.0 if si == stress else 0.72)
            # (Each syllable runs a little into the next, as speech does.)
            if out and len(out[-1]) > int(SR * 0.02) and rng.random() < 0.6:
                ov = int(SR * 0.015)
                prev = out.pop()
                joined = np.concatenate([prev[:-ov], prev[-ov:] + g[:ov], g[ov:]])
                out.append(joined)
            else:
                out.append(g)
            k += 1
        tail = w[-1]
        if "…" in w:
            gap = 0.42
        elif tail == ",":
            gap = 0.24
        elif tail in ".!?" and wi < len(words) - 1:
            gap = 0.32
        else:
            gap = rng.uniform(0.02, 0.06)
        out.append(np.zeros(int(SR * gap), np.float32))
    y = np.concatenate(out)
    # A little muffled and smeared: the other end's earpiece, a hand over it.
    y = sosfiltfilt(butter(2, 2600, "low", fs=SR, output="sos"), y)
    y = sosfiltfilt(butter(1, 180, "high", fs=SR, output="sos"), y)
    smear = np.zeros_like(y)
    d = int(SR * 0.021)
    smear[d:] = y[:-d] * 0.18
    y = y + smear
    return y / (np.abs(y).max() + 1e-9) * 0.7


def main():
    x = load()
    G = grains(x)
    print(f"{len(G)} grains from {len(x) / SR:.2f} s")
    rng = np.random.default_rng(1975)
    take = np.zeros(int(SR * SLOT * len(LINES)), np.float32)
    lens = []
    for i, t in enumerate(LINES):
        y = build(t, G, rng)
        assert len(y) < SR * SLOT, (t, len(y) / SR)
        take[int(i * SLOT * SR):int(i * SLOT * SR) + len(y)] = y
        lens.append(round(len(y) / SR, 2))
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, "v.wav")
        wavfile.write(w, SR, (take * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", "64k", OUT], check=True)
    print("lines (s):", lens)


if __name__ == "__main__":
    main()
