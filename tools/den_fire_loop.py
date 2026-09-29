#!/usr/bin/env python3
"""The den's fire: a recorded fireplace, cut to a seamless loop and made
warm, as heard from across a small-to-medium room.

    python3 tools/den_fire_loop.py IN.mp3 [-o assets/den/fire_loop.mp3]
        [--start 290] [--length 70]

The source the user chose is freesound_community's "Aachen burning
fireplace crackling fire" (11:54, 24 kHz stereo). Over its length the
fire burns down; the steadiest stretch of a full fire is from about 4:50
(--start 290), picked by loudness per second: the window whose level
varies least, with no low thumps above its usual rumble.

The chain (pedalboard with numpy; ffmpeg for the MP3 in and out):

 1. Mono. The fire is one thing in one place; den-audio.js pans it to the
    side of the room it's on and brings it nearer or farther.
 2. Warm. A high-pass at 50 Hz (rumble), +1.5 dB low shelf at 180 Hz (the
    body of the burning), -2 dB at 3 kHz and -6 dB high shelf from
    4.5 kHz, low-pass at 7.5 kHz: the crackle stays, its hiss and glare go.
 3. Even. A gentle compressor (2.5:1 from -24 dBFS) so the pops don't
    jump out over the burning.
 4. The room. A small-to-medium, soft room (paneling, shag, a sofa):
    pedalboard Reverb, room 0.3, damping 0.75, wet 0.14, run over the cut
    with a few seconds either side so its tail carries across the loop.
 5. Level. To about -20 dBFS RMS, peaks eased under -1.5 dBFS (soft knee).
 6. The loop. The cut's last 3 s crossfade (equal power) into its first
    3 s; then a quarter second of the loop's own end before it and its
    own start after it, so a decoder that keeps or drops the MP3's
    encoder delay loops it seamlessly between 0.25 s and 0.25 s + length
    (den-audio.js FIRE_LOOP).
"""
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np
from pedalboard import (Compressor, HighShelfFilter, HighpassFilter, LowShelfFilter,
                        LowpassFilter, PeakFilter, Pedalboard, Reverb)

SR = 24000
PAD = 0.25
XF = 3.0


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("-o", "--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "den", "fire_loop.mp3"))
    ap.add_argument("--start", type=float, default=290)
    ap.add_argument("--length", type=float, default=70)
    a = ap.parse_args()

    x = load(a.src)
    pre = 4.0
    s0 = int((a.start - pre) * SR)
    s1 = int((a.start + a.length + XF + pre) * SR)
    if s0 < 0 or s1 > len(x):
        sys.exit("the cut runs off the recording")
    seg = x[s0:s1]

    board = Pedalboard([
        HighpassFilter(50),
        LowShelfFilter(cutoff_frequency_hz=180, gain_db=1.5, q=0.7),
        PeakFilter(cutoff_frequency_hz=3000, gain_db=-2.0, q=0.9),
        HighShelfFilter(cutoff_frequency_hz=4500, gain_db=-6.0, q=0.7),
        LowpassFilter(7500),
        Compressor(threshold_db=-24, ratio=2.5, attack_ms=8, release_ms=180),
        Reverb(room_size=0.3, damping=0.75, wet_level=0.14, dry_level=0.9, width=0.0),
    ])
    y = board(seg[None, :], SR)[0]
    # Drop the pre-roll (the reverb has filled by then).
    y = y[int(pre * SR):]
    L, X = int(a.length * SR), int(XF * SR)
    body, tail = y[:L].copy(), y[L:L + X]
    # The end crossfades into the start: equal power.
    t = np.linspace(0, np.pi / 2, X)
    body[:X] = body[:X] * np.sin(t) + tail * np.cos(t)

    rms = np.sqrt(np.mean(body ** 2))
    body *= 10 ** (-20 / 20) / rms
    # Peaks eased under -1.5 dBFS with a soft knee (sample by sample, so
    # the loop stays seamless).
    c = 10 ** (-1.5 / 20)
    body = body / (1 + (np.abs(body) / c) ** 6) ** (1 / 6)

    p = int(PAD * SR)
    out = np.concatenate([body[-p:], body, body[:p]]).astype(np.float32)
    with tempfile.NamedTemporaryFile(suffix=".f32") as f:
        out.tofile(f.name)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", f.name,
                        "-c:a", "libmp3lame", "-b:a", "80k", a.out], check=True)
    print(f"{a.out}: {len(out) / SR:.2f} s (loop {PAD} .. {PAD + a.length} s), rms -20 dBFS, peak {20 * np.log10(np.abs(out).max()):.1f} dBFS")


if __name__ == "__main__":
    main()
