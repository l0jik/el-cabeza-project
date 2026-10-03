"""The register tape's sounds for Nova's purchase (apps/novaStory.jsx,
apps/unifiedTransition.jsx playRegister), from the user's recordings:

  receipt-print.mp3  a taxi meter's paper printer: its first six bursts
                     (one or two lines of tape each), a touch faster (1.2x,
                     pitch with it: a smaller, quicker printer), so the
                     tape prints in the recording's own rhythm.
  receipt-tear.mp3   a receipt torn off against the cutter (the hard swipe)
                     and, a moment after, drawn away (a softer one).

Both high-passed under 120 Hz, faded at the cuts, and levelled to the same
loudness. The burst times below are copied into novaStory.jsx
(PRINT_BURSTS), which prints the lines on them.

  python3 tools/story_receipt.py <taxi-paper-meter.mp3> <receipt-paper-swipe.mp3>
"""
import subprocess, sys
import numpy as np

SR = 44100
RATE = 1.2
PRINT_SPAN = (0.0, 4.72)                     # the first six bursts
BURSTS = [(0.04, 0.54), (0.68, 1.37), (1.49, 2.19), (2.31, 3.02), (3.12, 3.84), (4.04, 4.64)]
TEAR = (1.10, 1.95)                          # the hard swipe (its peak ~0.34 s in)
DRAW = (8.95, 9.65)                          # drawn away
DRAW_AT = 0.62                               # ...this far into the tear file
DRAW_GAIN = 0.6


def load(path, rate=1.0):
    af = f"asetrate={int(24000 * rate)},aresample={SR}" if rate != 1.0 else f"aresample={SR}"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-af", "highpass=f=120," + af, "-ac", "1", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def cut(x, a, b, fin=0.008, fout=0.06):
    y = x[int(a * SR):int(b * SR)].copy()
    ni, no = int(fin * SR), int(fout * SR)
    y[:ni] *= np.linspace(0, 1, ni)
    y[-no:] *= np.linspace(1, 0, no) ** 2
    return y


def level(y, rms_db=-24.0):
    act = y[np.abs(y) > 0.01 * np.abs(y).max()]
    g = 10 ** (rms_db / 20) / max(1e-9, np.sqrt(np.mean(act ** 2)))
    y = y * g
    pk = np.abs(y).max()
    return y * (0.7 / pk) if pk > 0.7 else y


def save(y, path):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-b:a", "96k", path],
                   input=y.astype(np.float32).tobytes(), check=True)


def main(meter, swipe):
    m = load(meter, RATE)
    a, b = PRINT_SPAN
    save(level(cut(m, a / RATE, b / RATE)), "assets/story/receipt-print.mp3")
    s = load(swipe)
    tear = cut(s, *TEAR, fin=0.03, fout=0.12)
    draw = cut(s, *DRAW, fin=0.04, fout=0.15) * DRAW_GAIN
    out = np.zeros(int(DRAW_AT * SR) + len(draw), np.float32)
    out[:len(tear)] += tear
    out[int(DRAW_AT * SR):] += draw
    save(level(out, -22.0), "assets/story/receipt-tear.mp3")
    print("print bursts (s, in the file):", [(round(x / RATE, 3), round(y / RATE, 3)) for x, y in BURSTS])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
