"""The register tape's sounds for Nova's purchase (apps/novaStory.jsx,
apps/unifiedTransition.jsx playRegister), from the user's recordings:

  receipt-print.mp3  a taxi meter's paper printer: its first six bursts
                     (one or two lines of tape each), faster (1.35x, pitch
                     with it: a smaller, quicker printer; user: 1.2x, then
                     a tad faster), so the tape prints in the recording's
                     own rhythm.
  receipt-tear.mp3   a receipt torn off against the cutter: the one hard
                     rip (user: two rips sounded at the end; the second
                     swipe, the receipt drawn away, is gone).

Both high-passed under 120 Hz, faded at the cuts, and levelled to the same
loudness. The burst times below are copied into novaStory.jsx
(PRINT_BURSTS), which prints the lines on them.

  python3 tools/story_receipt.py <taxi-paper-meter.mp3> <receipt-paper-swipe.mp3>
"""
import subprocess, sys
import numpy as np

SR = 44100
RATE = 1.35
PRINT_SPAN = (0.0, 4.72)                     # the first six bursts
BURSTS = [(0.04, 0.54), (0.68, 1.37), (1.49, 2.19), (2.31, 3.02), (3.12, 3.84), (4.04, 4.64)]
TEAR = (1.10, 1.80)                          # the hard swipe (its peak ~0.37 s in)


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
    save(level(tear, -22.0), "assets/story/receipt-tear.mp3")
    print("print bursts (s, in the file):", [(round(x / RATE, 3), round(y / RATE, 3)) for x, y in BURSTS])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
