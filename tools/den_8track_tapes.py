#!/usr/bin/env python3
"""Eight 8-track tapes for the den's stereo console (themes/standard.js
DEN_TRACKS, medium "8track").

The user asked for the 8-track to be filled with eight tapes, composed
here rather than borrowed: each is an original instrumental in a style
you'd have found in a 1970s tape rack (easy listening, disco, soft rock,
bossa nova, funk, West Coast pop, space synth, organ lounge), played by a
small synthesizer written below (electric piano, piano, organ, nylon and
electric guitar, bass, strings, brass, flute, vibes, analogue synths and
drums), then put through an 8-track cartridge's treatment:

  - the program-change "ka-chunk" at the top (the cartridge is an endless
    loop, so it plays again each time round, as the real thing did),
  - 3 3/4 ips tape: about 50 Hz - 10.5 kHz, a head bump near 100 Hz, the
    top a little dull,
  - tape saturation (soft, a touch of compression),
  - the 8-track's wobble: wow at ~0.4 Hz and flutter at ~7.5 Hz, both a
    little worse than a turntable's, and a faint scrape flutter,
  - crosstalk: the next program bleeding through faintly (the four
    stereo programs sit side by side on quarter-inch tape),
  - a dropout or two (a thin patch of oxide),
  - tape hiss, kept low (the user found the record's hiss too much),
  - a narrower stereo field, the lows in mono.

Output: assets/den/8track_<n>.mp3 (n = 1..8), each about 70-80 s.
Usage: python3 tools/den_8track_tapes.py [--only N] [--dry]
"""
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from pedalboard import Pedalboard, Reverb, Compressor, PeakFilter, HighShelfFilter, Chorus, Delay, Limiter, Phaser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from console_1974_turntable import db, band_pass, wow_flutter, pink_noise, stereo_field  # noqa: E402

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "den")

# ------------------------------------------------------------------ pitch

PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
      "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
QUAL = {
    "maj7": [0, 4, 7, 11], "maj9": [0, 4, 7, 11, 14], "m7": [0, 3, 7, 10], "m9": [0, 3, 7, 10, 14],
    "m11": [0, 3, 7, 10, 14, 17], "7": [0, 4, 7, 10], "9": [0, 4, 7, 10, 14], "13": [0, 4, 10, 14, 21],
    "7b9": [0, 4, 7, 10, 13], "7#9": [0, 4, 7, 10, 15], "7sus": [0, 5, 7, 10], "9sus": [0, 5, 7, 10, 14],
    "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "69": [0, 4, 7, 9, 14], "dim7": [0, 3, 6, 9], "m7b5": [0, 3, 6, 10],
    "": [0, 4, 7], "m": [0, 3, 7], "sus": [0, 5, 7], "add9": [0, 4, 7, 14],
}


def hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def parse_chord(sym):
    """'Ebmaj7' -> (root pc, intervals, bass pc); 'A/C#' has its own bass."""
    bass = None
    if "/" in sym:
        sym, b = sym.split("/")
        bass = PC[b]
    root = sym[:2] if len(sym) > 1 and sym[1] in "#b" else sym[:1]
    q = sym[len(root):]
    return PC[root], QUAL[q], (PC[root] if bass is None else bass)


def near(pc, target):
    """The midi note of pitch class pc nearest to target."""
    m = target - ((target - pc) % 12)
    return m + 12 if target - m > 6 else m


def voicing(sym, center, rootless=False, spread=False):
    root, iv, _ = parse_chord(sym)
    tones = iv[1:] if rootless and len(iv) > 3 else iv
    notes = sorted({near((root + i) % 12, center + (5 if spread and k % 2 else 0)) for k, i in enumerate(tones)})
    return notes


def chord_pcs(sym):
    root, iv, _ = parse_chord(sym)
    return [(root + i) % 12 for i in iv]


SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "dorian": [0, 2, 3, 5, 7, 9, 10], "minor": [0, 2, 3, 5, 7, 8, 10],
          "mixo": [0, 2, 4, 5, 7, 9, 10]}

# ---------------------------------------------------------------- helpers


def env_ar(n, a, dur, r):
    """Attack a s, hold to dur, then an exponential release (time constant r)."""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = t > dur
    e[rel] *= np.exp(-(t[rel] - dur) / max(r, 1e-4))
    return e


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    return signal.sosfilt(signal.butter(order, fc, "lowpass", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "highpass", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], "bandpass", fs=SR, output="sos"), x)


def saw(f, t, rng=None):
    ph = (f * t + (rng.uniform() if rng is not None else 0.0)) % 1.0
    return 2.0 * ph - 1.0


def bl_saw(f, t, top=9000.0):
    """A band-limited sawtooth (additive, harmonics up to `top`)."""
    k = max(1, int(top / f))
    out = np.zeros_like(t)
    for i in range(1, k + 1):
        out += np.sin(2 * np.pi * f * i * t) / i
    return out * (2 / np.pi)


def bl_square(f, t, top=9000.0):
    k = max(1, int(top / f))
    out = np.zeros_like(t)
    for i in range(1, k + 1, 2):
        out += np.sin(2 * np.pi * f * i * t) / i
    return out * (4 / np.pi)


# ------------------------------------------------------------ instruments
# Each takes (midi, duration s, velocity 0..1, rng) and returns mono audio.


def ep(m, dur, vel, rng, bright=1.0):
    """A Fender Rhodes: two-operator FM, the bark on a hard hit, the tine's ping."""
    f = hz(m)
    T = dur + 1.6
    n = int(T * SR)
    t = np.arange(n) / SR
    idx = (0.5 + 2.0 * vel * bright) * np.exp(-t * 4.0) + 0.22 * bright
    car = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    bark = 0.18 * vel * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 7)
    tine = (0.07 * vel * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 70)) if f * 14 < 16000 else 0
    decay = np.exp(-t / (1.9 * (261.0 / f) ** 0.35))
    return (car + bark + tine) * decay * env_ar(n, 0.002, dur, 0.09) * (0.35 + 0.65 * vel)


def piano(m, dur, vel, rng):
    """An upright-ish piano: stiff-string partials, two strings a hair apart, the hammer."""
    f = hz(m)
    T = dur + 2.2
    n = int(T * SR)
    t = np.arange(n) / SR
    B = 0.0004
    out = np.zeros(n)
    bright = 0.5 + 0.8 * vel
    for k in range(1, 11):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 15000:
            break
        a = (1.0 / k ** 1.2) * (bright ** (k / 3))
        tau = 3.2 * (261.0 / f) ** 0.4 / (1 + 0.35 * k)
        det = 1 + 0.0007 * (1 if k % 2 else -1)
        out += a * np.exp(-t / tau) * (np.sin(2 * np.pi * fk * t) + 0.8 * np.sin(2 * np.pi * fk * det * t + 0.3))
    ham = bp(rng.standard_normal(n), 800, 4000) * np.exp(-t * 90) * 0.15 * vel
    return (out * 0.35 + ham) * env_ar(n, 0.001, dur, 0.18) * (0.3 + 0.7 * vel)


def organ(m, dur, vel, rng, draw=(0.6, 1.0, 0.8, 0.5, 0.0, 0.35, 0.0, 0.25, 0.3), perc=True):
    """A tonewheel organ: drawbars 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1',
    third-harmonic percussion, key click."""
    ratios = (0.5, 1.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0)
    f = hz(m)
    T = dur + 0.12
    n = int(T * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, lvl in zip(ratios, draw):
        if lvl and f * r < 15000:
            out += lvl * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28))
    if perc:
        out += 0.9 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 5.0)
    click = hp(rng.standard_normal(n), 2000) * np.exp(-t * 400) * 0.25
    return (out * 0.22 + click) * env_ar(n, 0.004, dur, 0.02)


def ks_pluck(m, dur, vel, rng, bright=0.5, decay=0.997, pick=0.25, damp=0.08):
    """Karplus-Strong string, tuned exactly by resampling."""
    f = hz(m)
    N = max(2, int(SR / f))
    f_act = SR / (N + 0.5)
    T = dur + 1.2
    n = int(T * SR * f / f_act) + N + 2
    burst = rng.uniform(-1, 1, N)
    burst = signal.lfilter([1 - bright * 0.9 + 0.05], [1, -(bright * 0.9 - 0.05)], burst) if bright < 1 else burst
    p = int(N * pick)
    if p > 0:
        burst = burst - np.roll(burst, p) * 0.9
    out = np.zeros(n)
    out[:N] = burst
    prev = burst
    i = N
    while i < n:
        nxt = decay * 0.5 * (prev + np.concatenate(([prev[-1]], prev[:-1])))
        k = min(N, n - i)
        out[i:i + k] = nxt[:k]
        prev = nxt
        i += N
    # resample to the exact pitch
    L = int(T * SR)
    pos = np.arange(L) * (f / f_act)
    y = np.interp(pos, np.arange(n), out)
    y *= env_ar(L, 0.0005, dur, damp)
    return y * (0.3 + 0.7 * vel) * 0.8


def nylon(m, dur, vel, rng):
    return lp(ks_pluck(m, dur, vel, rng, bright=0.35, decay=0.996, pick=0.18, damp=0.12), 3500)


def eguitar(m, dur, vel, rng):
    return ks_pluck(m, dur, vel, rng, bright=0.65, decay=0.998, pick=0.12, damp=0.1)


def clav(m, dur, vel, rng):
    y = ks_pluck(m, dur, vel, rng, bright=0.95, decay=0.992, pick=0.08, damp=0.025)
    return hp(y, 280) * 1.3


def bass(m, dur, vel, rng, tone=700.0, upright=False):
    f = hz(m)
    T = dur + 0.35
    n = int(T * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t + 0.5)
    edge = lp(bl_saw(f, t, 3000), tone) * (0.25 if upright else 0.45)
    decay = np.exp(-t * (1.6 if upright else 0.9))
    thump = np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 30) * (0.5 if upright else 0.25)
    y = (body * 0.7 + edge + thump) * decay * env_ar(n, 0.004 if not upright else 0.012, dur, 0.05)
    return y * (0.4 + 0.6 * vel)


def moog_bass(m, dur, vel, rng):
    f = hz(m)
    T = dur + 0.2
    n = int(T * SR)
    t = np.arange(n) / SR
    x = bl_saw(f, t, 6000) * 0.6 + bl_square(f * 1.003, t, 6000) * 0.4
    bright = lp(x, 2400) * np.exp(-t * 14)
    dark = lp(x, 380)
    return (dark + bright * 0.7) * env_ar(n, 0.003, dur, 0.04) * (0.4 + 0.6 * vel)


def pad(m, dur, vel, rng, cutoff=2600.0, attack=0.35, release=0.7, detune=7.0, vib=0.0):
    """Ensemble strings / a synth pad: detuned band-limited saws, filtered."""
    f = hz(m)
    T = dur + release * 3
    n = int(T * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for c in (-detune, 0.0, detune):
        fc = f * 2 ** (c / 1200)
        if vib:
            ph = 2 * np.pi * np.cumsum(fc * (1 + vib * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6)))) / SR
            k = max(1, int(8000 / fc))
            out += sum(np.sin(ph * i) / i for i in range(1, k + 1)) * (2 / np.pi)
        else:
            out += bl_saw(fc, t + rng.uniform(0, 0.01), 8000)
    out = lp(out / 3, cutoff, 2)
    return out * env_ar(n, attack, dur, release) * (0.4 + 0.6 * vel)


def brass(m, dur, vel, rng):
    """A brass section stab: harmonics that open up just after the attack."""
    f = hz(m)
    T = dur + 0.25
    n = int(T * SR)
    t = np.arange(n) / SR
    open_ = np.minimum(1.0, t / 0.05)
    out = np.zeros(n)
    for k in range(1, 16):
        if f * k > 12000:
            break
        out += (1.0 / k) * open_ ** (k / 3) * np.sin(2 * np.pi * f * k * (1 + 0.002 * np.sin(2 * np.pi * 5 * t)) * t)
    return out * env_ar(n, 0.02, dur, 0.06) * (0.4 + 0.6 * vel) * 0.5


def flute(m, dur, vel, rng):
    f = hz(m)
    T = dur + 0.2
    n = int(T * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.minimum(1, np.maximum(0, (t - 0.22) / 0.3))
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    breath = bp(rng.standard_normal(n), f * 0.9, f * 4) * 0.12
    chiff = bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t * 60) * 0.2
    return (tone + breath + chiff) * env_ar(n, 0.05, dur, 0.08) * (0.4 + 0.6 * vel) * 0.6


def vibes(m, dur, vel, rng):
    f = hz(m)
    T = dur + 2.5
    n = int(T * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 8)
    y *= np.exp(-t * 1.1) * (1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t)))
    return y * env_ar(n, 0.001, dur + 0.4, 0.3) * (0.3 + 0.7 * vel) * 0.5


def synth_lead(m, dur, vel, rng, prev=None, glide=0.06):
    """A monophonic analogue lead with a little glide from the last note."""
    f = hz(m)
    T = dur + 0.25
    n = int(T * SR)
    t = np.arange(n) / SR
    f0 = hz(prev) if prev is not None else f
    fr = f + (f0 - f) * np.exp(-t / glide)
    fr *= 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.4)
    ph = np.cumsum(fr) / SR
    x = 2 * (ph % 1.0) - 1 + 0.5 * (2 * ((ph * 1.004) % 1.0) - 1)
    x = lp(x, 3200, 2)
    return x * env_ar(n, 0.01, dur, 0.1) * (0.4 + 0.6 * vel) * 0.35


def arp_pluck(m, dur, vel, rng):
    f = hz(m)
    T = dur + 0.3
    n = int(T * SR)
    t = np.arange(n) / SR
    x = bl_saw(f, t, 9000) + 0.5 * bl_square(f * 0.5, t, 6000)
    bright = lp(x, 5000) * np.exp(-t * 18)
    dark = lp(x, 700) * np.exp(-t * 5)
    return (bright + dark) * env_ar(n, 0.002, dur, 0.05) * (0.3 + 0.7 * vel) * 0.35


# ----------------------------------------------------------------- drums


def kick(vel, rng, tight=False):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 95 * np.exp(-t * (38 if tight else 28))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * (11 if tight else 8))
    y += hp(rng.standard_normal(n), 3000) * np.exp(-t * 300) * 0.15
    return y * vel


def snare(vel, rng, bright=1.0):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * 0.55
    nz = bp(rng.standard_normal(n), 1200, 7000 * bright) * np.exp(-t * 16)
    return (tone + nz * 0.9) * vel


def ghost(vel, rng):
    return snare(vel * 0.25, rng, 0.7)


def rim(vel, rng):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 90) + bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t * 120) * 0.6
    return y * vel * 0.6


def hat(vel, rng, open_=False):
    n = int((0.45 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    metal = sum(np.sign(np.sin(2 * np.pi * fr * t)) for fr in (317, 431, 569, 773, 911, 1187))
    y = hp(metal * 0.3 + rng.standard_normal(n), 7000) * np.exp(-t * (6 if open_ else 55))
    return y * vel * 0.35


def ride(vel, rng):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    # A cymbal's many inharmonic modes (a fixed set per kit, so it's the
    # same cymbal every hit), each decaying at its own rate, over a wash.
    kit = np.random.default_rng(77)
    metal = np.zeros(n)
    for fr in kit.uniform(2400, 9500, 48):
        metal += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t * kit.uniform(2.5, 9.0))
    wash = hp(rng.standard_normal(n), 4000) * np.exp(-t * 4.5)
    y = hp(metal * 0.05 + wash * 0.55, 2500)
    y += hp(rng.standard_normal(n), 5000) * np.exp(-t * 60) * 0.45
    return y * vel * 0.22


def brush_tap(vel, rng):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 1800, 7000) * np.exp(-t * 14) * vel * 0.45


def brush_swish(dur, vel, rng):
    n = int(dur * SR)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return bp(rng.standard_normal(n), 2000, 7000) * shape * vel * 0.035


def clap(vel, rng):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for d in (0.0, 0.011, 0.023):
        e += np.exp(-np.maximum(0, t - d) * 180) * (t >= d)
    e += np.exp(-np.maximum(0, t - 0.03) * 18) * (t >= 0.03) * 0.5
    return nz * e * vel * 0.6


def conga(vel, rng, high=False):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f0 = 330 if high else 215
    f = f0 * (1 + 0.25 * np.exp(-t * 40))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    y += bp(rng.standard_normal(n), 800, 3000) * np.exp(-t * 120) * 0.3
    return y * vel * 0.5


def shaker(vel, rng):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * t / t[-1]) ** 2
    return bp(rng.standard_normal(n), 4500, 12000) * shape * vel * 0.18


def tamb(vel, rng):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    jing = sum(np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) for fr in (5200, 6300, 7700, 9100))
    return hp(jing * 0.3 + rng.standard_normal(n), 6000) * np.exp(-t * 14) * vel * 0.2


def tom(vel, rng, pitch=110):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.3 * np.exp(-t * 25))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * vel * 0.8


# ------------------------------------------------------------------ song


class Song:
    def __init__(self, bpm, seed, swing=0.0, beats=4):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.beats = beats
        self.swing = swing
        self.rng = np.random.default_rng(seed)
        self.buses = {}
        self.fx = {}
        self.chords = []  # (start beat, symbol)
        self.sections = []  # (name, start bar, bars)
        self.bar = 0

    # timeline
    def section(self, name, prog, bars=None):
        """prog: [(symbol, beats), ...] repeated to fill `bars`."""
        total = sum(b for _, b in prog)
        bars = bars or int(total / self.beats)
        start = self.bar * self.beats
        pos = 0
        while pos < bars * self.beats:
            for sym, b in prog:
                if pos >= bars * self.beats:
                    break
                self.chords.append((start + pos, sym))
                pos += b
        self.sections.append((name, self.bar, bars))
        self.bar += bars
        return self.bar - bars

    def chord_at(self, beat):
        cur = self.chords[0][1]
        for b, s in self.chords:
            if b <= beat + 1e-6:
                cur = s
            else:
                break
        return cur

    def sec(self, name):
        return [(s, n) for nm, s, n in self.sections if nm == name]

    @property
    def length(self):
        return self.bar * self.beats * self.spb

    def time(self, beat, human=0.006):
        frac = beat % 1.0
        b = beat
        if self.swing and abs(frac - 0.5) < 1e-6:
            b += self.swing / 6.0
        if self.swing and abs(frac - 0.25) < 1e-6:
            b += self.swing / 12.0
        if self.swing and abs(frac - 0.75) < 1e-6:
            b += self.swing / 12.0
        return b * self.spb + (self.rng.normal(0, human) if human else 0.0)

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, int((self.length + 6) * SR)))
        return self.buses[name]

    def add(self, name, x, t, pan=0.0, gain=1.0):
        buf = self.bus(name)
        i = max(0, int(t * SR))
        k = min(len(x), buf.shape[1] - i)
        if k <= 0:
            return
        a = (pan + 1) * np.pi / 4
        buf[0, i:i + k] += x[:k] * np.cos(a) * gain
        buf[1, i:i + k] += x[:k] * np.sin(a) * gain

    def note(self, name, inst, m, beat, beats, vel, pan=0.0, gain=1.0, human=0.006, **kw):
        dur = beats * self.spb
        x = inst(m, dur, vel, self.rng, **kw)
        self.add(name, x, self.time(beat, human), pan, gain)

    def hit(self, name, drum, beat, vel, pan=0.0, gain=1.0, human=0.004, **kw):
        self.add(name, drum(vel * (1 + self.rng.normal(0, 0.06)), self.rng, **kw), self.time(beat, human), pan, gain)


# ------------------------------------------------------------- generators


def comp(song, name, inst, start_bar, bars, pattern, center, pan=0.0, gain=1.0, rootless=True, per=1, **kw):
    """Chord comping: pattern [(beat, beats, vel)] over `per` bars, voiced near center."""
    B = song.beats
    for b in range(0, bars, per):
        for beat, ln, vel in pattern:
            at = (start_bar + b) * B + beat
            if at >= (start_bar + bars) * B:
                continue
            sym = song.chord_at(at)
            for m in voicing(sym, center, rootless=rootless):
                song.note(name, inst, m, at, ln, vel * (0.9 + 0.2 * song.rng.uniform()), pan, gain, **kw)


def bassline(song, name, inst, start_bar, bars, pattern, center=40, gain=1.0, **kw):
    """pattern: [(beat, beats, vel, step)] step 'R' root, '5' fifth, 'O' octave, '3', 'b7',
    'A' chromatic approach to the next chord's root."""
    B = song.beats
    for b in range(bars):
        for beat, ln, vel, step in pattern:
            at = (start_bar + b) * B + beat
            sym = song.chord_at(at)
            root, iv, bpc = parse_chord(sym)
            r = near(bpc, center)
            if step == "R":
                m = r
            elif step == "O":
                m = r + 12
            elif step == "5":
                m = r + 7 if r + 7 <= center + 9 else r - 5
            elif step == "3":
                m = r + iv[1]
            elif step == "b7":
                m = r + 10 if r + 10 <= center + 9 else r - 2
            elif step == "A":
                nxt = song.chord_at((start_bar + b + 1) * B)
                tr = near(parse_chord(nxt)[2], center)
                m = tr + (1 if song.rng.uniform() < 0.5 else -1)
            else:
                m = r
            song.note(name, inst, m, at, ln, vel, 0.0, gain, **kw)


def walking(song, name, inst, start_bar, bars, center=38, gain=1.0, **kw):
    B = song.beats
    prev = None
    for b in range(bars):
        at0 = (start_bar + b) * B
        sym = song.chord_at(at0)
        root, iv, bpc = parse_chord(sym)
        r = near(bpc, center if prev is None else prev)
        r = r + 12 if r < 28 else (r - 12 if r > 50 else r)
        nxt = parse_chord(song.chord_at(at0 + B))[2]
        target = near(nxt, r)
        line = [r, r + iv[1] if song.rng.uniform() < 0.5 else r + 7, r + 7 if song.rng.uniform() < 0.6 else r + iv[1],
                target + (1 if target < r + 5 else -1)]
        # a two-chord bar: the second chord on beat 3
        sym3 = song.chord_at(at0 + 2)
        if sym3 != sym:
            r3 = near(parse_chord(sym3)[2], r + 5)
            line[2] = r3
            line[3] = target + (1 if song.rng.uniform() < 0.5 else -1)
        for i, m in enumerate(line):
            song.note(name, inst, m, at0 + i, 0.95, 0.8 if i == 0 else 0.68, 0.0, gain, **kw)
        prev = line[-1]


def melody(song, start_bar, bars, key, mode, lo, hi, bank, seed, rest_p=0.0):
    """A tune: phrases of two bars, each a rhythm from `bank`; strong notes on
    chord tones, the rest stepping through the scale. Returns [(beat, beats, midi, vel)]
    relative to start_bar."""
    rng = np.random.default_rng(seed)
    scale = [(key + s) % 12 for s in SCALES[mode]]
    B = song.beats
    out = []
    prev = None
    rhythms = [bank[i] for i in rng.integers(0, len(bank), bars // 2)]
    # answer phrases echo the first: A A' B A''
    if len(rhythms) >= 4:
        rhythms[1] = rhythms[0]
    for ph in range(bars // 2):
        for i, (b, ln) in enumerate(rhythms[ph]):
            beat = ph * 2 * B + b
            sym = song.chord_at((start_bar) * B + beat)
            tones = chord_pcs(sym)
            strong = (b % 1.0 == 0 and int(b) % 2 == 0) or ln >= 1.5 or i == len(rhythms[ph]) - 1
            if prev is None:
                cands = [m for m in range(lo, hi + 1) if m % 12 in tones]
                m = cands[len(cands) // 2]
            elif strong:
                cands = [m for m in range(lo, hi + 1) if m % 12 in tones]
                cands.sort(key=lambda c: abs(c - prev) + rng.uniform(0, 1.5) + (3 if c == prev else 0))
                m = cands[0]
            else:
                deg = min(range(len(scale) * 6), key=lambda d: abs((d // 7) * 12 + scale[d % 7] + 12 * (lo // 12) - prev))
                step = rng.choice([-2, -1, -1, 1, 1, 2])
                d = deg + step
                m = (d // 7) * 12 + scale[d % 7] + 12 * (lo // 12)
                if m < lo or m > hi:
                    d = deg - step
                    m = (d // 7) * 12 + scale[d % 7] + 12 * (lo // 12)
                m = int(np.clip(m, lo, hi))
            vel = 0.75 + (0.15 if strong else 0) + rng.uniform(-0.05, 0.05)
            out.append((beat, ln, m, vel))
            prev = m
    return out


def play_melody(song, name, inst, notes, start_bar, pan=0.0, gain=1.0, legato=0.92, mono_prev=False, **kw):
    B = song.beats
    prev = None
    for beat, ln, m, vel in notes:
        if mono_prev:
            song.note(name, inst, m, start_bar * B + beat, ln * legato, vel, pan, gain, prev=prev, **kw)
        else:
            song.note(name, inst, m, start_bar * B + beat, ln * legato, vel, pan, gain, **kw)
        prev = m


def drums(song, start_bar, bars, pattern, name="drums", fill=None, fill_every=None):
    """pattern: {drum_fn_or_tuple: [(beat, vel), ...]}, one bar; `fill` in place of
    it every `fill_every` bars, or on the last bar when fill_every isn't given."""
    B = song.beats
    for b in range(bars):
        is_fill = fill is not None and ((fill_every and (b + 1) % fill_every == 0) or (not fill_every and b == bars - 1))
        pat = fill if is_fill else pattern
        for key, hits in pat.items():
            fn, kw, pan = key if isinstance(key, tuple) else (key, (), 0.0)
            for beat, vel in hits:
                at = (start_bar + b) * B + beat
                if at < (start_bar + bars) * B:
                    song.hit(name, fn, at, vel, pan, **dict(kw))


# -------------------------------------------------------------- bus fx


def tremolo(x, rate=4.5, depth=0.35):
    t = np.arange(x.shape[1]) / SR
    ph = 2 * np.pi * rate * t
    g = np.stack([1 - depth * (0.5 + 0.5 * np.sin(ph)), 1 - depth * (0.5 + 0.5 * np.sin(ph + np.pi))])
    return x * g


def leslie(x, rate=6.2):
    t = np.arange(x.shape[1]) / SR
    am = np.stack([0.8 + 0.2 * np.sin(2 * np.pi * rate * t), 0.8 + 0.2 * np.sin(2 * np.pi * rate * t + 1.9)])
    y = wow_flutter(x.astype(np.float32), SR, wow_hz=rate, wow_pct=0.35, flutter_hz=rate * 0.83, flutter_pct=0.1, seed=3)
    return y * am


def fx(x, board):
    return board(x.astype(np.float32), SR)


def mixdown(song, levels, reverb_send, room=0.35, bus_fx=None):
    n = max(b.shape[1] for b in song.buses.values())
    dry = np.zeros((2, n))
    send = np.zeros((2, n))
    for name, buf in song.buses.items():
        y = buf
        if bus_fx and name in bus_fx:
            y = bus_fx[name](y)
        g = levels.get(name, 1.0)
        dry[:, :y.shape[1]] += y * g
        send[:, :y.shape[1]] += y * g * reverb_send.get(name, 0.0)
    wet = Pedalboard([Reverb(room_size=room, damping=0.55, wet_level=1.0, dry_level=0.0, width=0.9)])(send.astype(np.float32), SR)
    out = dry + wet
    out = Pedalboard([Compressor(threshold_db=-14, ratio=1.8, attack_ms=15, release_ms=180)])(
        (out / (np.max(np.abs(out)) + 1e-9) * db(-4)).astype(np.float32), SR)
    # trim to the song's length plus a short ring-out
    end = int((song.length + 1.2) * SR)
    out = out[:, :end]
    fade = int(1.0 * SR)
    out[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    return out


# ================================================================ the tapes


def tape_1():
    """Sunday Drive on Route 9: easy listening. Rhodes, brushes, flute, strings."""
    s = Song(96, seed=101, swing=0.3)
    A = [("Fmaj7", 4), ("Em7", 2), ("A7", 2), ("Dm9", 4), ("G9", 4), ("Gm7", 4), ("C9", 4), ("Fmaj7", 2), ("Dm7", 2), ("Gm7", 2), ("C7", 2)]
    Bp = [("Bbmaj7", 4), ("Bbm6", 4), ("Am7", 4), ("D7b9", 4), ("Gm9", 4), ("C9", 4), ("Fmaj7", 4), ("C7sus", 2), ("C7", 2)]
    s.section("intro", [("Fmaj7", 4), ("Bbmaj7", 4)], 2)
    s.section("A", A, 8)
    s.section("B", Bp, 8)
    s.section("A", A, 8)
    s.section("tag", [("Fmaj7", 4), ("Bbmaj7", 4), ("Fmaj9", 8)], 4)
    pat = [(0, 1.4, 0.7), (1.5, 0.45, 0.55), (3, 0.9, 0.6)]
    comp(s, "ep", ep, 0, s.bar, pat, 62)
    bl = [(0, 1.4, 0.85, "R"), (1.5, 0.45, 0.6, "5"), (2, 1.4, 0.8, "5"), (3.5, 0.45, 0.6, "A")]
    bassline(s, "bass", bass, 2, s.bar - 2, bl, center=41)
    kit = {brush_tap: [(1, 0.7), (3, 0.75), (2.5, 0.3)], (hat, (), 0.3): [(1, 0.35), (3, 0.35)], kick: [(0, 0.35), (2.5, 0.2)]}
    for st, n in s.sec("A") + s.sec("B"):
        drums(s, st, n, kit)
        for b in range(n):
            s.add("drums", brush_swish(s.spb * 3.6, 0.9, s.rng), s.time((st + b) * 4, 0), 0.0)
    bank = [[(0, 1.5), (1.5, 0.5), (2, 1), (3, 1), (4, 3)], [(0.5, 0.5), (1, 1), (2, 1.5), (3.5, 0.5), (4, 2), (6, 1)],
            [(0, 1), (1, 0.5), (1.5, 0.5), (2, 2), (4, 1.5), (5.5, 2.5)], [(0, 2), (2, 1), (3, 1), (4, 4)]]
    tune = melody(s, s.sec("A")[0][0], 8, PC["F"], "major", 69, 84, bank, seed=11)
    for st, _ in s.sec("A"):
        play_melody(s, "lead", flute, tune, st, pan=-0.15)
    btune = melody(s, s.sec("B")[0][0], 8, PC["F"], "major", 67, 81, bank, seed=12)
    play_melody(s, "vibes", vibes, btune, s.sec("B")[0][0], pan=0.25)
    for st, n in s.sec("B"):
        comp(s, "strings", pad, st, n, [(0, 3.9, 0.6)], 60, pan=0.0, rootless=False, vib=0.002)
    return mixdown(s, {"ep": 0.55, "bass": 0.7, "drums": 0.6, "lead": 0.55, "vibes": 0.5, "strings": 0.22},
                   {"ep": 0.2, "lead": 0.3, "vibes": 0.35, "strings": 0.4, "drums": 0.1},
                   bus_fx={"ep": lambda x: tremolo(x, 4.3, 0.4)})


def tape_2():
    """Mirrorball Boulevard: disco. Four on the floor, octave bass, clav, strings, brass."""
    s = Song(118, seed=202)
    vamp = [("Am9", 4), ("D9", 4)]
    Bp = [("Fmaj7", 4), ("G6", 4), ("Em7", 4), ("Am9", 4), ("Dm9", 4), ("G13", 4), ("Cmaj7", 4), ("E7sus", 2), ("E7b9", 2)]
    s.section("intro", vamp, 4)
    s.section("A", vamp, 8)
    s.section("B", Bp, 8)
    s.section("A", vamp, 8)
    s.section("B", Bp, 8)
    four = {kick: [(0, 1), (1, 1), (2, 1), (3, 1)], (hat, (("open_", True),), 0.2): [(0.5, 0.7), (1.5, 0.7), (2.5, 0.7), (3.5, 0.7)],
            (hat, (), -0.2): [(i / 4, 0.35 if i % 2 else 0.5) for i in range(16)], clap: [(1, 0.8), (3, 0.8)]}
    intro = {kick: [(0, 1), (1, 1), (2, 1), (3, 1)], (hat, (), -0.2): [(i / 4, 0.4) for i in range(16)]}
    drums(s, 0, 4, intro)
    drums(s, 4, s.bar - 4, four)
    for st, n in s.sec("A") + s.sec("B"):
        drums(s, st, n, {(conga, (("high", True),), 0.5): [(0.75, 0.6), (2.75, 0.6), (3.5, 0.5)], (tamb, (), -0.5): [(1, 0.5), (3, 0.5)]}, name="perc")
    ob = [(i / 2, 0.42, 0.9 if i % 2 == 0 else 0.75, "R" if i % 2 == 0 else "O") for i in range(8)]
    bassline(s, "bass", bass, 4, s.bar - 4, ob, center=40, tone=1100)
    cl = [(0.25, 0.2, 0.7), (0.75, 0.2, 0.6), (1.5, 0.2, 0.7), (2.25, 0.2, 0.6), (2.75, 0.2, 0.7), (3.5, 0.2, 0.6)]
    for st, n in s.sec("A"):
        comp(s, "clav", clav, st, n, cl, 64, pan=0.3)
        for b in range(0, n, 2):
            comp(s, "brass", brass, st + b + 1, 1, [(3.0, 0.4, 0.8), (3.5, 0.9, 0.9)], 68, pan=-0.2)
    for st, n in s.sec("B"):
        comp(s, "strings", pad, st, n, [(0, 3.95, 0.7)], 64, rootless=False, cutoff=3800, attack=0.12, release=0.3)
    bank = [[(0, 0.5), (0.5, 0.5), (1, 1), (2, 1.5), (3.5, 0.5), (4, 2.5)], [(0, 1.5), (1.5, 1.5), (3, 1), (4, 1), (5, 1), (6, 2)],
            [(0.5, 0.5), (1, 0.5), (1.5, 1), (2.5, 1.5), (4, 3)]]
    tune = melody(s, s.sec("B")[0][0], 8, PC["C"], "major", 72, 88, bank, seed=21)
    for st, _ in s.sec("B"):
        play_melody(s, "lead", pad, tune, st, gain=1.0, cutoff=5500, attack=0.03, release=0.25, detune=9, vib=0.003)
    return mixdown(s, {"drums": 0.75, "perc": 0.45, "bass": 0.8, "clav": 0.42, "brass": 0.45, "strings": 0.35, "lead": 0.55},
                   {"strings": 0.4, "lead": 0.35, "brass": 0.25, "clav": 0.1, "drums": 0.05, "perc": 0.15}, room=0.45)


def tape_3():
    """Harvest Moon Motel: soft rock ballad. Piano, bass, brushed-back kit, organ, electric guitar."""
    s = Song(76, seed=303)
    A = [("D", 4), ("A/C#", 4), ("Bm", 4), ("G", 4), ("Em7", 4), ("A7sus", 2), ("A7", 2), ("D", 4), ("Dsus", 2), ("D", 2)]
    Bp = [("G", 4), ("A", 4), ("F#m7", 4), ("Bm", 4), ("Em7", 4), ("A7sus", 4)]
    s.section("intro", [("D", 4), ("G/D", 4)], 2)
    s.section("A", A, 8)
    s.section("B", Bp, 6)
    s.section("A", A, 8)
    s.section("out", [("G", 4), ("D", 4)], 2)
    for b in range(s.bar):
        at0 = b * 4
        for i in range(8):
            at = at0 + i * 0.5
            sym = s.chord_at(at)
            root, iv, bpc = parse_chord(sym)
            vo = voicing(sym, 62, rootless=False)
            m = vo[[0, 1, 2, 1, 0, 1, 2, 1][i] % len(vo)] + (12 if i in (2, 6) else 0)
            s.note("piano", piano, m, at, 0.9, 0.55 + (0.12 if i % 4 == 0 else 0), 0.1)
        s.note("piano", piano, near(parse_chord(s.chord_at(at0))[2], 43), at0, 3.8, 0.7, 0.1)
    bl = [(0, 1.9, 0.8, "R"), (2, 1.4, 0.7, "R"), (3.5, 0.45, 0.55, "5")]
    bassline(s, "bass", bass, 2, s.bar - 2, bl, center=40, tone=500)
    kit = {kick: [(0, 0.75), (2.5, 0.5)], (snare, (("bright", 0.7),), 0.0): [(2, 0.55)], (hat, (), 0.25): [(i / 2, 0.3) for i in range(8)]}
    for st, n in s.sec("A")[1:] + s.sec("B"):
        drums(s, st, n, kit, fill={kick: [(0, 0.7)], (snare, (("bright", 0.7),), 0.0): [(2, 0.5)],
                                   (tom, (("pitch", 140),), -0.3): [(3, 0.5), (3.25, 0.45)], (tom, (("pitch", 95),), 0.3): [(3.5, 0.55), (3.75, 0.5)]})
    for st, n in s.sec("B"):
        comp(s, "organ", organ, st, n, [(0, 3.95, 0.6)], 60, rootless=False, draw=(0.0, 0.0, 0.8, 0.6, 0.0, 0.3, 0, 0, 0), perc=False)
    bank = [[(0, 1), (1, 1), (2, 2), (4, 1.5), (5.5, 0.5), (6, 2)], [(0.5, 0.5), (1, 1.5), (2.5, 1.5), (4, 4)],
            [(0, 1.5), (1.5, 0.5), (2, 1), (3, 1), (4, 3)]]
    tune = melody(s, s.sec("A")[0][0], 8, PC["D"], "major", 64, 79, bank, seed=31)
    play_melody(s, "gtr", eguitar, tune, s.sec("A")[1][0], pan=-0.3, legato=1.0)
    btune = melody(s, s.sec("B")[0][0], 6, PC["D"], "major", 66, 81, bank, seed=32)
    play_melody(s, "gtr", eguitar, btune, s.sec("B")[0][0], pan=-0.3, legato=1.0)
    return mixdown(s, {"piano": 0.6, "bass": 0.65, "drums": 0.55, "organ": 0.28, "gtr": 0.55},
                   {"piano": 0.3, "gtr": 0.35, "organ": 0.3, "drums": 0.12}, room=0.5,
                   bus_fx={"gtr": lambda x: fx(x, Pedalboard([Chorus(rate_hz=0.8, depth=0.2, mix=0.35)])),
                           "organ": leslie})


def tape_4():
    """Lanai at Dusk: bossa nova. Nylon guitar, upright bass, rim and shaker, flute and vibes."""
    s = Song(132, seed=404)
    A = [("Cmaj9", 8), ("D9", 8), ("Dm9", 4), ("G13", 4), ("Em7", 2), ("A7b9", 2), ("Dm7", 2), ("G7", 2)]
    Bp = [("Fmaj7", 4), ("Fm6", 4), ("Em7", 4), ("A7b9", 4), ("Dm9", 4), ("G13", 4), ("Cmaj9", 4), ("G7sus", 4)]
    s.section("intro", [("Cmaj9", 4), ("Dm9", 2), ("G13", 2)], 4)
    s.section("A", A, 8)
    s.section("A", A, 8)
    s.section("B", Bp, 8)
    s.section("A", A, 8)
    s.section("tag", [("Cmaj9", 8)], 2)
    for b in range(s.bar):
        at0 = b * 4
        sym = s.chord_at(at0)
        r = near(parse_chord(sym)[2], 43)
        s.note("gtr", nylon, r, at0, 1.4, 0.75, -0.1)
        s.note("gtr", nylon, r + 7 if r + 7 < 52 else r - 5, at0 + 2, 1.4, 0.7, -0.1)
        hits = [0, 1.5, 3] if b % 2 == 0 else [0.5, 2, 3.5]
        for h in hits:
            for m in voicing(s.chord_at(at0 + h), 60, rootless=True):
                s.note("gtr", nylon, m, at0 + h, 0.45, 0.55, -0.1)
    bl = [(0, 1.45, 0.85, "R"), (1.5, 0.45, 0.6, "5"), (2, 1.45, 0.8, "5"), (3.5, 0.45, 0.6, "R")]
    bassline(s, "bass", bass, 4, s.bar - 4, bl, center=38, tone=450, upright=True)
    rimp = {(rim, (), 0.2): [(0, 0.7), (0.75, 0.6), (1.5, 0.7), (2.5, 0.6), (3.25, 0.65)],
            (shaker, (), 0.45): [(i / 2, 0.6 if i % 2 else 0.8) for i in range(8)], kick: [(0, 0.35), (1.5, 0.25), (2, 0.35), (3.5, 0.25)]}
    drums(s, 4, s.bar - 4, rimp)
    bank = [[(0, 1), (1, 0.5), (1.5, 1), (2.5, 1.5), (4, 4)], [(0.5, 0.5), (1, 1), (2, 0.5), (2.5, 1.5), (4, 1), (5, 3)],
            [(0, 2), (2, 1), (3, 1), (4, 2), (6, 2)]]
    tune = melody(s, s.sec("A")[0][0], 8, PC["C"], "major", 69, 86, bank, seed=41)
    for st, _ in s.sec("A"):
        play_melody(s, "lead", flute, tune, st, pan=0.2)
    btune = melody(s, s.sec("B")[0][0], 8, PC["C"], "major", 65, 81, bank, seed=42)
    play_melody(s, "vibes", vibes, btune, s.sec("B")[0][0], pan=0.35)
    return mixdown(s, {"gtr": 0.6, "bass": 0.7, "drums": 0.45, "lead": 0.55, "vibes": 0.5},
                   {"gtr": 0.2, "lead": 0.3, "vibes": 0.35, "drums": 0.1}, room=0.4)


def tape_5():
    """Stone Fox Strut: funk. Clav, bass, tight kit with ghost notes, brass, congas."""
    s = Song(102, seed=505, swing=0.15)
    s.section("intro", [("Em7", 4)], 2)
    s.section("A", [("Em7", 4)], 8)
    s.section("B", [("A9", 4)], 4)
    s.section("A", [("Em7", 4)], 8)
    s.section("C", [("C9", 4), ("B7#9", 4)], 4)
    s.section("A", [("Em7", 4)], 4)
    kit = {kick: [(0, 1), (0.75, 0.7), (2.5, 0.85), (3.25, 0.5)], (snare, (), 0.0): [(1, 0.95), (3, 0.95)],
           (ghost, (), 0.0): [(1.75, 1), (2.25, 1), (3.75, 1)], (hat, (), 0.25): [(i / 4, 0.55 if i % 2 == 0 else 0.3) for i in range(16)]}
    drums(s, 0, s.bar, kit, fill={kick: [(0, 1)], (snare, (), 0.0): [(1, 0.9), (2.5, 0.6), (2.75, 0.7), (3, 0.8), (3.25, 0.7), (3.5, 0.8), (3.75, 0.9)]}, fill_every=4)
    riff = [(0, 0.2, 0.95, "R"), (0.75, 0.2, 0.7, "O"), (1.5, 0.2, 0.8, "R"), (2, 0.2, 0.7, "b7"), (2.5, 0.2, 0.85, "R"),
            (3, 0.2, 0.6, "5"), (3.25, 0.2, 0.75, "O"), (3.75, 0.2, 0.7, "A")]
    bassline(s, "bass", bass, 2, s.bar - 2, riff, center=40, tone=1400)
    cl = [(0, 0.15, 0.8), (0.5, 0.12, 0.55), (0.75, 0.15, 0.7), (1.25, 0.12, 0.6), (1.5, 0.15, 0.75), (2.25, 0.12, 0.6),
          (2.5, 0.15, 0.8), (3.0, 0.12, 0.55), (3.5, 0.15, 0.75)]
    comp(s, "clav", clav, 2, s.bar - 2, cl, 62, pan=-0.3)
    for st, n in s.sec("A"):
        for b in range(1, n, 2):
            comp(s, "brass", brass, st + b, 1, [(2.5, 0.3, 0.8), (3.0, 0.3, 0.85), (3.5, 0.6, 0.95)], 70, pan=0.25, rootless=False)
    for st, n in s.sec("B") + s.sec("C"):
        comp(s, "brass", brass, st, n, [(0, 0.3, 0.9), (0.75, 1.8, 0.85)], 69, pan=0.25, rootless=False)
    drums(s, 2, s.bar - 2, {(conga, (("high", True),), 0.55): [(0.5, 0.6), (1.75, 0.5), (2.5, 0.6)], (conga, (), 0.45): [(3.5, 0.6), (3.75, 0.5)]}, name="perc")
    bank = [[(0, 0.5), (0.75, 0.25), (1, 1), (2.5, 0.5), (3, 1), (4, 0.5), (4.5, 1.5)], [(0.5, 0.5), (1, 0.5), (1.5, 1), (3, 1), (4.5, 2)]]
    tune = melody(s, s.sec("A")[1][0], 8, PC["E"], "dorian", 64, 76, bank, seed=51)
    play_melody(s, "lead", synth_lead, tune, s.sec("A")[1][0], pan=0.0, mono_prev=True)
    return mixdown(s, {"drums": 0.8, "bass": 0.8, "clav": 0.5, "brass": 0.45, "perc": 0.4, "lead": 0.5},
                   {"brass": 0.25, "clav": 0.08, "drums": 0.06, "perc": 0.15, "lead": 0.25}, room=0.3,
                   bus_fx={"clav": lambda x: fx(x, Pedalboard([Phaser(rate_hz=0.6, depth=0.5, mix=0.35)]))})


def tape_6():
    """Catalina Crossing: West Coast pop. Chorused Rhodes, synth lead, strings, busy bass."""
    s = Song(98, seed=606)
    A = [("Ebmaj7", 4), ("Dm7", 4), ("Cm9", 4), ("F9sus", 4), ("Ebmaj7", 4), ("Dm7", 2), ("G7b9", 2), ("Cm9", 4), ("F13", 4)]
    Bp = [("Gm9", 4), ("C9", 4), ("Fm9", 4), ("Bb13", 4), ("Ebmaj9", 4), ("Abmaj7", 4), ("Cm7", 4), ("F7sus", 4)]
    s.section("intro", [("Ebmaj7", 4), ("F9sus", 4)], 4)
    s.section("A", A, 8)
    s.section("B", Bp, 8)
    s.section("A", A, 8)
    s.section("tag", [("Ebmaj9", 4), ("F9sus", 4)], 2)
    pat = [(0, 0.9, 0.7), (1.5, 0.4, 0.55), (2.5, 1.2, 0.65), (3.75, 0.2, 0.45)]
    comp(s, "ep", ep, 0, s.bar, pat, 64, bright=0.8)
    bl = [(0, 0.45, 0.9, "R"), (0.75, 0.2, 0.6, "R"), (1.5, 0.45, 0.75, "5"), (2, 0.45, 0.8, "O"), (2.75, 0.2, 0.6, "5"), (3.5, 0.45, 0.7, "A")]
    bassline(s, "bass", bass, 4, s.bar - 4, bl, center=39, tone=900)
    kit = {kick: [(0, 0.95), (1.75, 0.5), (2.5, 0.75)], (snare, (), 0.0): [(1, 0.8), (3, 0.8)], (hat, (), 0.3): [(i / 4, 0.45 if i % 2 == 0 else 0.25) for i in range(16)]}
    fill = {kick: [(0, 0.9)], (snare, (), 0.0): [(1, 0.8)], (tom, (("pitch", 160),), -0.4): [(2, 0.6), (2.25, 0.55)],
            (tom, (("pitch", 120),), 0.0): [(2.5, 0.6), (2.75, 0.55)], (tom, (("pitch", 85),), 0.4): [(3, 0.7), (3.25, 0.6), (3.5, 0.65)]}
    drums(s, 4, s.bar - 4, kit)
    for st, n in s.sec("A") + s.sec("B"):
        drums(s, st + n - 1, 1, fill, name="fills")
    for st, n in s.sec("B"):
        comp(s, "strings", pad, st, n, [(0, 3.95, 0.6)], 67, rootless=False, cutoff=3200, vib=0.002)
    bank = [[(0, 1), (1, 0.5), (1.5, 1.5), (3, 1), (4, 2), (6, 1)], [(0.5, 0.5), (1, 1), (2, 1), (3, 1.5), (4.5, 3)],
            [(0, 0.5), (0.5, 0.5), (1, 2), (3, 0.5), (3.5, 0.5), (4, 3)]]
    tune = melody(s, s.sec("A")[0][0], 8, PC["Eb"], "major", 70, 84, bank, seed=61)
    for st, _ in s.sec("A"):
        play_melody(s, "lead", synth_lead, tune, st, mono_prev=True, pan=0.1)
    btune = melody(s, s.sec("B")[0][0], 8, PC["Eb"], "major", 72, 86, bank, seed=62)
    play_melody(s, "lead", synth_lead, btune, s.sec("B")[0][0], mono_prev=True, pan=0.1)
    return mixdown(s, {"ep": 0.55, "bass": 0.75, "drums": 0.65, "fills": 0.6, "strings": 0.25, "lead": 0.5},
                   {"ep": 0.25, "lead": 0.3, "strings": 0.4, "drums": 0.08, "fills": 0.12}, room=0.42,
                   bus_fx={"ep": lambda x: fx(x, Pedalboard([Chorus(rate_hz=0.7, depth=0.3, centre_delay_ms=8, mix=0.5)])),
                           "lead": lambda x: fx(x, Pedalboard([Delay(delay_seconds=60 / 98 * 0.75, feedback=0.25, mix=0.2)]))})


def tape_7():
    """Cassiopeia Relay: space synth. Sequenced arpeggio, pads, a drum machine, a gliding lead."""
    s = Song(112, seed=707)
    A = [("Am", 4), ("F", 4), ("C", 4), ("G", 4), ("Am", 4), ("F", 4), ("Dm", 4), ("E7", 4)]
    Bp = [("F", 4), ("G", 4), ("Em", 4), ("Am", 4), ("F", 4), ("G", 4), ("Esus", 4), ("E", 4)]
    s.section("intro", [("Am", 4), ("F", 4)], 4)
    s.section("A", A, 8)
    s.section("B", Bp, 8)
    s.section("A", A, 8)
    s.section("out", [("Am", 4), ("F", 4), ("Am", 8)], 4)
    for b in range(2, s.bar):
        for i in range(16):
            at = b * 4 + i / 4
            vo = voicing(s.chord_at(at), 57, rootless=False)
            seq = vo + [v + 12 for v in vo]
            idx = [0, 1, 2, 3, 4, 5, 4, 3][i % 8] % len(seq)
            s.note("arp", arp_pluck, seq[idx], at, 0.22, 0.75 if i % 4 == 0 else 0.55, 0.0, human=0.0)
    comp(s, "pad", pad, 0, s.bar, [(0, 3.98, 0.6)], 60, rootless=False, cutoff=1800, attack=0.8, release=1.5, detune=10)
    ob = [(i / 2, 0.4, 0.85, "R" if i % 2 == 0 else "O") for i in range(8)]
    bassline(s, "bass", moog_bass, 4, s.bar - 4, ob, center=38)
    dm = {(kick, (("tight", True),), 0.0): [(0, 1), (1, 0.9), (2, 1), (3, 0.9)], (snare, (("bright", 1.2),), 0.0): [(1, 0.7), (3, 0.7)],
          (hat, (), 0.3): [(i / 2 + 0.5, 0.5) for i in range(4)] + [(i / 2, 0.25) for i in range(4)]}
    for st, n in s.sec("B") + s.sec("A")[1:]:
        drums(s, st, n, dm)
    bank = [[(0, 2), (2, 1), (3, 1), (4, 4)], [(0, 1), (1, 1), (2, 2), (4, 1.5), (5.5, 2.5)], [(0, 3), (3, 1), (4, 4)]]
    tune = melody(s, s.sec("B")[0][0], 8, PC["A"], "minor", 69, 84, bank, seed=71)
    play_melody(s, "lead", synth_lead, tune, s.sec("B")[0][0], mono_prev=True, glide=0.12)
    tune2 = melody(s, s.sec("A")[1][0], 8, PC["A"], "minor", 69, 84, bank, seed=72)
    play_melody(s, "lead", synth_lead, tune2, s.sec("A")[1][0], mono_prev=True, glide=0.12)
    return mixdown(s, {"arp": 0.45, "pad": 0.4, "bass": 0.7, "drums": 0.55, "lead": 0.55},
                   {"arp": 0.2, "pad": 0.5, "lead": 0.35, "drums": 0.06}, room=0.7,
                   bus_fx={"arp": lambda x: fx(x, Pedalboard([Delay(delay_seconds=60 / 112 * 0.75, feedback=0.35, mix=0.3)])),
                           "lead": lambda x: fx(x, Pedalboard([Delay(delay_seconds=60 / 112, feedback=0.3, mix=0.25)])),
                           "pad": lambda x: fx(x, Pedalboard([Chorus(rate_hz=0.3, depth=0.4, mix=0.5)]))})


def tape_8():
    """Last Call at the Tiki Room: organ lounge. A twelve-bar in F, swung: organ, walking bass, ride, vibes."""
    s = Song(126, seed=808, swing=0.65)
    blues = [("F7", 4), ("Bb7", 4), ("F7", 4), ("Cm7", 2), ("F7", 2), ("Bb7", 4), ("Bdim7", 4), ("F7", 4), ("D7b9", 4),
             ("Gm7", 4), ("C7", 4), ("F7", 2), ("D7", 2), ("Gm7", 2), ("C7", 2)]
    s.section("intro", [("Gm7", 2), ("C7", 2)], 2)
    s.section("A", blues, 12)
    s.section("A", blues, 12)
    s.section("A", blues, 12)
    s.section("tag", [("Gm7", 2), ("C7", 2), ("F13", 4)], 2)
    walking(s, "bass", bass, 0, s.bar, center=38, tone=500, upright=True)
    swing = {(ride, (), 0.35): [(0, 0.7), (1, 0.75), (1.5, 0.5), (2, 0.7), (3, 0.75), (3.5, 0.5)],
             (hat, (), -0.2): [(1, 0.5), (3, 0.5)], kick: [(0, 0.25), (2, 0.2)], (ghost, (), 0.0): [(2.5, 1.2), (3.5, 0.8)]}
    drums(s, 0, s.bar, swing)
    pat = [(0.5, 0.35, 0.7), (1.5, 0.3, 0.55), (3, 0.9, 0.65)]
    comp(s, "organ", organ, 2, s.bar - 2, pat, 60, pan=-0.1)
    bank = [[(0, 0.5), (0.5, 1), (1.5, 0.5), (2, 1), (3, 0.5), (3.5, 1.5), (5, 1), (6, 2)], [(0, 1.5), (1.5, 0.5), (2, 2), (4, 0.5), (4.5, 0.5), (5, 3)],
            [(0.5, 0.5), (1, 0.5), (1.5, 0.5), (2, 0.5), (2.5, 1.5), (4, 4)]]
    first = s.sec("A")[0][0]
    tune = melody(s, first, 12, PC["F"], "mixo", 67, 82, bank, seed=81)
    play_melody(s, "lead", organ, tune, first, pan=0.1, draw=(0, 0, 0.9, 0.7, 0.5, 0.5, 0, 0, 0.2), perc=True)
    solo = melody(s, s.sec("A")[1][0], 12, PC["F"], "mixo", 65, 84, bank, seed=82)
    play_melody(s, "vibes", vibes, solo, s.sec("A")[1][0], pan=0.3)
    play_melody(s, "lead", organ, tune, s.sec("A")[2][0], pan=0.1, draw=(0, 0, 0.9, 0.7, 0.5, 0.5, 0, 0, 0.2), perc=True)
    return mixdown(s, {"bass": 0.75, "drums": 0.5, "organ": 0.35, "lead": 0.45, "vibes": 0.5},
                   {"organ": 0.2, "lead": 0.2, "vibes": 0.3, "drums": 0.08}, room=0.35,
                   bus_fx={"organ": leslie, "lead": leslie})


TAPES = [
    (tape_1, "Sunday Drive on Route 9", "The Del Mar Easy Strings"),
    (tape_2, "Mirrorball Boulevard", "Tony Varela Orchestra"),
    (tape_3, "Harvest Moon Motel", "Cedar & Pine"),
    (tape_4, "Lanai at Dusk", "Trio Mendes Alvarado"),
    (tape_5, "Stone Fox Strut", "The Velvet Hustle Band"),
    (tape_6, "Catalina Crossing", "Lindqvist & Shore"),
    (tape_7, "Cassiopeia Relay", "The Cassiopeia Ensemble"),
    (tape_8, "Last Call at the Tiki Room", "The Sam Kellerman Combo"),
]


# ============================================================ the 8-track


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
    # 3 3/4 ips: the band, the head bump, a dull top.
    x = band_pass(x, SR, 50.0, 10500.0)
    x = Pedalboard([PeakFilter(cutoff_frequency_hz=100.0, gain_db=2.5, q=0.8), HighShelfFilter(cutoff_frequency_hz=6500.0, gain_db=-2.5)])(x, SR)
    # Tape saturation.
    x = x / (np.max(np.abs(x)) + 1e-9) * db(-6)
    x = np.tanh(1.1 * x) / np.tanh(1.1)
    x = stereo_field(x.astype(np.float32), SR, width=0.75, mono_below=120.0)
    # Crosstalk: the neighbouring program, faint and dull, in mono.
    if bleed is not None:
        b = bleed.mean(axis=0)
        off = int(rng.uniform(5, 20) * SR)
        b = np.roll(b, off)[: x.shape[1]]
        if len(b) < x.shape[1]:
            b = np.pad(b, (0, x.shape[1] - len(b)))
        b = lp(hp(b, 200), 2500) / (np.max(np.abs(b)) + 1e-9) * db(-40)
        x = x + b[None, :]
    # The wobble.
    x = wow_flutter(x.astype(np.float32), SR, wow_hz=0.4, wow_pct=0.22, flutter_hz=7.5, flutter_pct=0.11, seed=seed)
    x = wow_flutter(x, SR, wow_hz=23.0, wow_pct=0.02, flutter_hz=31.0, flutter_pct=0.015, seed=seed + 1)
    # A dropout or two.
    n = x.shape[1]
    g = np.ones(n)
    for _ in range(int(rng.integers(1, 3))):
        c = int(rng.uniform(0.15, 0.9) * n)
        w = int(rng.uniform(0.05, 0.12) * SR)
        i = np.arange(max(0, c - w), min(n, c + w))
        g[i] *= 1 - 0.45 * np.exp(-((i - c) / (w / 2.5)) ** 2)
    x = x * g
    # Up to level, then the hiss under it (brighter than a record's surface).
    x = Pedalboard([Limiter(threshold_db=-1.5, release_ms=150.0)])(x.astype(np.float32), SR)
    x = x / (np.max(np.abs(x)) + 1e-9) * db(-1.2)
    h = np.stack([pink_noise(n, rng) * 0.6 + rng.standard_normal(n) * 0.4, pink_noise(n, rng) * 0.6 + rng.standard_normal(n) * 0.4])
    h = signal.sosfiltfilt(signal.butter(2, [400.0, 12000.0], "bandpass", fs=SR, output="sos"), h, axis=-1)
    h = h / np.sqrt(np.mean(h ** 2)) * db(-62)
    x = x + h
    # The program change at the top; the loop comes round to it again.
    c = clunk(rng)
    fade_in = np.minimum(1.0, np.arange(n) / (0.03 * SR))
    x = np.concatenate([c, x * fade_in], axis=1)
    x[:, -int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return x.astype(np.float32)


def encode(x, path, title, artist):
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(np.ascontiguousarray(np.clip(x, -1, 1).T.astype(np.float32)).tobytes())
        tmp = f.name
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp,
                        "-codec:a", "libmp3lame", "-q:a", "5", "-cutoff", "11000",
                        "-metadata", f"title={title}", "-metadata", f"artist={artist}",
                        "-metadata", "comment=El Cabeza den 8-track (tools/den_8track_tapes.py)", path], check=True)
    finally:
        os.unlink(tmp)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", type=int, default=0, help="render just tape N (1..8)")
    ap.add_argument("--dry", action="store_true", help="render without the 8-track treatment")
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    idx = [args.only - 1] if args.only else list(range(len(TAPES)))
    raw = {}
    for i in idx:
        fn, title, artist = TAPES[i]
        print(f"composing {i + 1}: {title} ({artist})", flush=True)
        raw[i] = fn()
    for i in idx:
        fn, title, artist = TAPES[i]
        nb = (i + 1) % len(TAPES)
        bleed = raw.get(nb)
        y = raw[i] if args.dry else eight_track(raw[i], 900 + i, bleed)
        path = os.path.join(OUT_DIR, f"8track_{i + 1}.mp3")
        encode(y, path, title, artist)
        print(f"  -> {path}  {y.shape[1] / SR:.1f} s", flush=True)


if __name__ == "__main__":
    main()
