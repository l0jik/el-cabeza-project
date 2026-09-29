#!/usr/bin/env python3
"""The den's 8-track tapes: the user's own tracks, put on a cartridge.

    python3 tools/den_8track_treatment.py IN1.mp3 IN2.mp3 ... [--seed 1975]

Each input becomes assets/den/8track_<n>.mp3 (n in the order given), for
the stereo console's 8-track (themes/standard.js DEN_TRACKS, medium
"8track"; build/build.js copies them beside the page). The titles and
artists come from the source's title tag ("Artist - Title").

The treatment, in order (pedalboard with numpy and scipy; ffmpeg in and
out; the helpers are the record's, tools/console_1974_turntable.py):

 1. 3 3/4 ips tape: about 50 Hz - 10.5 kHz, the head bump near 100 Hz
    (+2.5 dB) and the top a little dull (-2.5 dB shelf from 6.5 kHz).
 2. Tape saturation: a soft tanh, a touch of compression.
 3. A narrower stereo field (75%), the lows below 120 Hz in mono.
 4. Crosstalk: the next program on the tape bleeding through faintly
    (dull, in mono, 40 dB down), as the four stereo programs sat side by
    side on quarter-inch tape.
 5. The 8-track's wobble: wow at 0.4 Hz (0.22%) and flutter at 7.5 Hz
    (0.11%), a little worse than the turntable's, and a faint scrape
    flutter.
 6. A dropout or two (a thin patch of oxide).
 7. Mastering: the music brought forward by a gentle limiter until it
    sits at the record's loudness (about -10 LUFS integrated; the record
    is -9.1), peaks at -1 dBFS.
 8. Tape hiss, kept low (-64 dBFS RMS, where the record's hiss ended up
    after the user found the first one "80% hiss").
 9. The program-change "ka-chunk" at the top; the cartridge is an endless
    loop, so it comes round again each time, as the real thing did.
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from pedalboard import Pedalboard, PeakFilter, HighShelfFilter, Limiter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from console_1974_turntable import db, decode, band_pass, wow_flutter, pink_noise, hiss, stereo_field  # noqa: E402

SR = 48000
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "den")
TARGET_LUFS = -10.0
HISS_DB = -64.0


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x, axis=-1)


def lp(x, fc):
    return signal.sosfiltfilt(signal.butter(2, fc, "lowpass", fs=SR, output="sos"), x, axis=-1)


def hp(x, fc):
    return signal.sosfiltfilt(signal.butter(2, fc, "highpass", fs=SR, output="sos"), x, axis=-1)


def lufs(x):
    """Integrated loudness (EBU R128) by ffmpeg's ebur128 filter."""
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(np.ascontiguousarray(x.T.astype(np.float32)).tobytes())
        tmp = f.name
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                              "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    finally:
        os.unlink(tmp)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", out)
    return float(m[-1]) if m else -70.0


def master(x):
    """The music forward: a gentle limiter, peaks at -1 dBFS, lowered until
    the loudness reaches the target (or the limiter's 9 dB of reach)."""
    thr = -3.0
    for _ in range(6):
        y = Pedalboard([Limiter(threshold_db=thr, release_ms=150.0)])(x.astype(np.float32), SR)
        y = y / (np.max(np.abs(y)) + 1e-9) * db(-1.0)
        l = lufs(y)
        if l >= TARGET_LUFS - 0.3 or thr <= -9.0:
            break
        thr = max(-9.0, thr - (TARGET_LUFS - l))
    return y.astype(np.float32), l, thr


def clunk(rng):
    """The program change: the head stepping over, a solenoid's thunk."""
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 62 * t) * np.exp(-t * 22) * 0.5
    thump += np.sin(2 * np.pi * 131 * t) * np.exp(-t * 35) * 0.25
    click = bp(rng.standard_normal(n), 900, 5000) * np.exp(-t * 140) * 0.35
    rattle = bp(rng.standard_normal(n), 2500, 7000) * np.exp(-np.maximum(0, t - 0.05) * 40) * (t > 0.05) * 0.06
    y = (thump + click + rattle) * db(-9)
    return np.stack([y, y * 0.92])


def eight_track(x, seed, bleed):
    rng = np.random.default_rng(seed)
    x = x.astype(np.float32)
    # 1. 3 3/4 ips: the band, the head bump, a dull top.
    x = band_pass(x, SR, 50.0, 10500.0)
    x = Pedalboard([PeakFilter(cutoff_frequency_hz=100.0, gain_db=2.5, q=0.8), HighShelfFilter(cutoff_frequency_hz=6500.0, gain_db=-2.5)])(x, SR)
    # 2. Tape saturation.
    x = x / (np.max(np.abs(x)) + 1e-9) * db(-6)
    x = np.tanh(1.1 * x) / np.tanh(1.1)
    # 3. The field.
    x = stereo_field(x.astype(np.float32), SR, width=0.75, mono_below=120.0)
    # 4. Crosstalk: the neighbouring program, faint and dull, in mono.
    if bleed is not None:
        b = bleed.mean(axis=0)
        b = np.roll(b, int(rng.uniform(5, 20) * SR))[: x.shape[1]]
        if len(b) < x.shape[1]:
            b = np.pad(b, (0, x.shape[1] - len(b)))
        b = lp(hp(b, 200), 2500) / (np.max(np.abs(b)) + 1e-9) * db(-40)
        x = x + b[None, :]
    # 5. The wobble.
    x = wow_flutter(x.astype(np.float32), SR, wow_hz=0.4, wow_pct=0.22, flutter_hz=7.5, flutter_pct=0.11, seed=seed)
    x = wow_flutter(x, SR, wow_hz=23.0, wow_pct=0.02, flutter_hz=31.0, flutter_pct=0.015, seed=seed + 1)
    # 6. A dropout or two.
    n = x.shape[1]
    g = np.ones(n)
    for _ in range(int(rng.integers(1, 3))):
        c = int(rng.uniform(0.15, 0.9) * n)
        w = int(rng.uniform(0.05, 0.12) * SR)
        i = np.arange(max(0, c - w), min(n, c + w))
        g[i] *= 1 - 0.45 * np.exp(-((i - c) / (w / 2.5)) ** 2)
    x = x * g
    # 7. Mastering.
    x, loud, thr = master(x)
    # 8. The hiss under it.
    x = x + hiss(n, rng, SR, HISS_DB)
    # 9. The program change at the top; the loop comes round to it again.
    fade_in = np.minimum(1.0, np.arange(n) / (0.03 * SR))
    x = np.concatenate([clunk(rng), x * fade_in], axis=1)
    x[:, -int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    peak = np.max(np.abs(x))
    if peak > db(-0.5):
        x = x / peak * db(-0.5)
    return x.astype(np.float32), loud, thr


def names(path):
    """'Artist - Title' from the title tag (or the file name)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=title", "-of", "default=nw=1:nk=1", path],
                         capture_output=True, text=True).stdout.strip()
    s = out or re.sub(r"^[0-9a-f]{8}-", "", os.path.splitext(os.path.basename(path))[0]).replace("_", " ")
    artist, _, title = s.partition(" - ")
    return (title or s).strip(), (artist if title else "").strip()


def encode(x, path, title, artist):
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(np.ascontiguousarray(np.clip(x, -1, 1).T.astype(np.float32)).tobytes())
        tmp = f.name
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                        "-codec:a", "libmp3lame", "-q:a", "4", "-cutoff", "11000",
                        "-metadata", f"title={title}", "-metadata", f"artist={artist}",
                        "-metadata", "comment=El Cabeza den 8-track (tools/den_8track_treatment.py)", path], check=True)
    finally:
        os.unlink(tmp)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--seed", type=int, default=1975)
    a = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    raw = [decode(p, SR) for p in a.inputs]
    for i, p in enumerate(a.inputs):
        title, artist = names(p)
        y, loud, thr = eight_track(raw[i], a.seed + i, raw[(i + 1) % len(raw)] if len(raw) > 1 else None)
        out = os.path.join(OUT_DIR, f"8track_{i + 1}.mp3")
        encode(y, out, title, artist)
        print(f"{i + 1}: {title} ({artist}) -> {out}  {y.shape[1] / SR:.1f} s, {loud:.1f} LUFS (limiter {thr:.1f} dB)", flush=True)


if __name__ == "__main__":
    main()
