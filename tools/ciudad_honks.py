"""The City's horns: honks cut from real recordings of New York traffic and
of single cars (assets/ciudad/src/, CREDITS.md), laid one after another
in one file the game plays them out of (user: "The city needs more like
gridlock traffic sound with honking and stuff like that, like you know,
in like downtown New York or something like that, but not overwhelming").

Each source's honks are found where its horn band (300 Hz - 3.2 kHz)
stands 11 dB or more over the source's own street (7 dB in the
recordings of streets, and the far honk), a horn being a
sustained note: at least 0.12 s of it, gaps under 0.3 s kept inside one
honk (a double honk, a lean on it with a stutter), at most 2.4 s of a long
one (faded out). Each is cut with 30 ms before it and 120 ms after, faded
in and out, high-passed at 120 Hz (the street under it stays the game's
own), and set to the same loudness at its loudest 50 ms (-12 dBFS); the
game gives each its own distance. The craigsmith jam (a studio's many
horns at once) is cut in chorus bursts of 1.8 s.

    -> assets/ciudad/honks.mp3, and tools prints HONKS, the table for
       themes/ciudad-audio.js: [start, length, kind] each, in seconds.

    FFMPEG=/path/to/ffmpeg python3 tools/ciudad_honks.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/ciudad/src")
OUT = os.path.join(ROOT, "assets/ciudad/honks.mp3")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 48000
GAP = 0.35  # silence between honks in the file

# (file, windows to look in (None: all of it), kind; a street's and the
# far honk's stand less far over their own street: 7 dB)
SOURCES = [
    ("honking-horns-in-traffic-jasonlee3071-865956.ogg", None, "car"),
    ("horn-irritated-driver-wanaki-569613.ogg", None, "lean"),
    ("car-horn-honk-devern-349922.ogg", None, "car"),
    ("car-horn-distant-brooklyn-brett-butter-553150.ogg", None, "far"),
    ("double-car-horn-mudflea2-705723.ogg", None, "car"),
    ("car-horn-keweldog-182474.ogg", None, "car"),
    ("car-horn-legnalegna55-545015.ogg", None, "car"),
    ("w41st-8th-ave-eyesplice-759088.ogg", [(0.0, 12.4)], "street"),
    ("traffic-horns-engines-trp-616589.ogg", [(0.5, 10.5), (45.0, 48.0)], "street"),
]
CHORUS = ("many-car-horns-traffic-jam-craigsmith-675208.ogg", "jam")


def load(name):
    x, sr = sf.read(os.path.join(SRC, name), always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    return x


def band(x):
    return sosfiltfilt(butter(4, [300, 3200], btype="bandpass", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfiltfilt(butter(2, f, btype="highpass", fs=SR, output="sos"), x)


def envelope_db(x, win=0.03):
    n = int(win * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(n) / n, mode="same") + 1e-12)
    return 20 * np.log10(e)


def events(x, over=11.0, min_len=0.12, merge=0.3, longest=2.4):
    e = envelope_db(band(x))
    floor = np.percentile(e, 30)
    on = e > floor + over
    out, i, n = [], 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            out.append([i / SR, j / SR])
            i = j
        else:
            i += 1
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] < merge:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, min(b, a + longest)) for a, b in merged if b - a >= min_len]


def cut(x, a, b, pre=0.03, post=0.12):
    s, e = max(0, int((a - pre) * SR)), min(len(x), int((b + post) * SR))
    y = hp(x[s:e].copy(), 120)
    fi, fo = int(0.012 * SR), int(0.09 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    # loudest 50 ms at -12 dBFS
    w = int(0.05 * SR)
    peak = np.sqrt(np.max(np.convolve(y ** 2, np.ones(w) / w, mode="valid")) + 1e-12)
    return y * (10 ** (-12 / 20) / peak)


def main():
    honks = []
    for name, windows, kind in SOURCES:
        x = load(name)
        for a0, b0 in windows or [(0, len(x) / SR)]:
            seg = x[int(a0 * SR):int(b0 * SR)]
            for a, b in events(seg, over=7.0 if kind in ("street", "far") else 11.0):
                honks.append((cut(seg, a, b), kind, name))
    x = load(CHORUS[0])
    for a, b in events(x, over=8, merge=0.6, longest=1.8):
        if b - a >= 0.6:
            honks.append((cut(x, a, b), CHORUS[1], CHORUS[0]))
    parts, table, t = [], [], 0.0
    for y, kind, name in honks:
        parts += [y, np.zeros(int(GAP * SR))]
        table.append([round(t, 3), round(len(y) / SR, 3), kind])
        t += len(y) / SR + GAP
    mix = np.concatenate(parts)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "h.wav")
        sf.write(wav, mix, SR)
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "96k", OUT], check=True)
    print(f"{len(table)} honks, {t:.1f} s -> {OUT}")
    print("const HONKS = " + str(table).replace("'", '"') + ";")


if __name__ == "__main__":
    main()
