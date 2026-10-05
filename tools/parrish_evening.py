#!/usr/bin/env python3
"""Watermark's evening: the user's recording of wind in the trees with
birds (freesound_community "forest wind and birds" 6881, 3:16, 24 kHz
stereo), its hiss taken down and made into a seamless loop.

    python3 tools/parrish_evening.py IN.mp3 [-o assets/parrish/evening.mp3]

User: "The mid-range and high end hiss and like the white noise kind of
sound, we need to kind of turn that down." The recording is very quiet
(about -53 dBFS RMS), so lifting it to the game's level lifts its hiss
with it. Above ~1.5 kHz the hiss is a steady layer (its level barely
moves from second to second) while the birds rise ~10 dB over it, so:

 1. De-hiss. A soft spectral gate above 1.2 kHz (STFT, 2048 / 512): each
    frequency's steady floor is its 35th-percentile level over the whole
    recording; what sits near that floor is turned down by up to 12 dB
    (more the higher it is, 1.2 kHz -> 6 kHz), what rises well above it
    (the birds, a gust in the leaves) passes. The gain is smoothed over
    time and frequency so nothing chirps or warbles.
 2. Warm. +1.5 dB low shelf at 220 Hz (the wind's body), -2.5 dB at
    2.2 kHz, -5 dB high shelf from 3.5 kHz, low-pass 7 kHz, high-pass
    45 Hz (handling rumble).
 3. Even. A gentle compressor (2:1 from -30 dBFS) so a gust doesn't jump.
 4. Level. About -22 dBFS RMS (the game sets its place in the mix:
    parrish-audio.js EVENING_LEVEL), peaks under -1.5 dBFS.
 5. The loop. The last 4 s crossfade (equal power) into the first 4 s;
    then a quarter second of the loop's own end before it and its own
    start after it, so it loops seamlessly between 0.25 s and
    0.25 s + length whatever the decoder does with the MP3's padding
    (parrish-audio.js EVENING_LOOP).

Stereo is kept: the wind moves across the trees.
"""
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np
import librosa
import soundfile as sf
from pedalboard import (Compressor, HighShelfFilter, HighpassFilter, LowShelfFilter,
                        LowpassFilter, PeakFilter, Pedalboard)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XF = 4.0
PAD = 0.25


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-"],
                         capture_output=True, check=True).stdout
    sr = int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate",
                             "-of", "csv=p=0", path], capture_output=True, check=True, text=True).stdout.strip())
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy(), sr


def dehiss(ch, sr):
    n_fft, hop = 2048, 512
    S = librosa.stft(ch, n_fft=n_fft, hop_length=hop)
    mag = np.abs(S)
    f = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    floor = np.percentile(mag, 35, axis=1, keepdims=True) + 1e-12
    # How far down the floor goes, by frequency: none below 1.2 kHz, 12 dB by 6 kHz.
    depth_db = np.clip((f - 1200) / (6000 - 1200), 0, 1) * 12.0
    min_gain = 10 ** (-depth_db / 20)[:, None]
    # Soft mask: 0 at the floor, 1 at 3x (about +10 dB) above it.
    r = mag / floor
    t = np.clip((r - 1.0) / 2.0, 0, 1)
    t = t * t * (3 - 2 * t)
    gain = min_gain + (1 - min_gain) * t
    # Smooth over time (~70 ms) and a little over frequency.
    from scipy.ndimage import uniform_filter
    gain = uniform_filter(gain, size=(3, 5), mode="nearest")
    out = librosa.istft(S * gain, hop_length=hop, length=len(ch))
    return out.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("-o", "--out", default=os.path.join(ROOT, "assets/parrish/evening.mp3"))
    a = ap.parse_args()

    x, sr = load(a.src)
    x = np.stack([dehiss(c, sr) for c in x])
    board = Pedalboard([
        HighpassFilter(45),
        LowShelfFilter(cutoff_frequency_hz=220, gain_db=1.5),
        PeakFilter(cutoff_frequency_hz=2200, gain_db=-2.5, q=0.8),
        HighShelfFilter(cutoff_frequency_hz=3500, gain_db=-5.0),
        LowpassFilter(7000),
    ])
    x = board(x, sr)
    # Level before the compressor, so its threshold means the same thing.
    rms = np.sqrt((x ** 2).mean())
    x = x * (10 ** (-26 / 20) / rms)
    x = Pedalboard([Compressor(threshold_db=-30, ratio=2.0, attack_ms=40, release_ms=600)])(x, sr)
    rms = np.sqrt((x ** 2).mean())
    x = x * (10 ** (-22 / 20) / rms)
    peak = np.abs(x).max()
    lim = 10 ** (-1.5 / 20)
    if peak > lim:
        x = np.tanh(x / lim) * lim

    # Seamless loop: the tail crossfades into the head.
    n = x.shape[1]
    xf = int(XF * sr)
    th = np.linspace(0, np.pi / 2, xf)
    head, tail = x[:, :xf], x[:, n - xf:]
    joined = tail * np.cos(th) + head * np.sin(th)
    loop = np.concatenate([joined, x[:, xf:n - xf]], axis=1)
    pad = int(PAD * sr)
    full = np.concatenate([loop[:, -pad:], loop, loop[:, :pad]], axis=1)

    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "e.wav")
        sf.write(wav, full.T, sr)
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "96k", a.out], check=True)
    print(f"{a.out}: loop {loop.shape[1] / sr:.2f} s (+{PAD} s each side), {sr} Hz, "
          f"rms {20 * np.log10(np.sqrt((loop ** 2).mean())):.1f} dBFS", file=sys.stderr)


if __name__ == "__main__":
    main()
