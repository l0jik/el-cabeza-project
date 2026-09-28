#!/usr/bin/env python3
"""A mid-tier 1974 wooden stereo console turntable, as a signal chain.

    python3 tools/console_1974_turntable.py IN.mp3 [-o 1974_console_master.mp3]
        [--crackle crackle.wav] [--crackle-url URL ...] [--seed 1974]

The chain, in order (pedalboard with numpy and scipy; ffmpeg through
subprocess for the MP3 in and out):

 1. EQ and cabinet resonance. A band-pass that cuts hard below 40 Hz (the
    rumble filter) and above 11 kHz (the stylus's limit): 8th-order
    Butterworth sections, zero-phase. Then a +3 dB bell at 150 Hz
    (pedalboard PeakFilter) for the wooden cabinet's muddy resonance.
 2. Stereo field. Everything below 150 Hz summed to mono (a 4th-order
    Linkwitz-Riley split, as a vinyl cutting lathe needs), and the rest
    narrowed to 50% width (mid/side, side halved): speakers built into one
    cabinet.
 3. Wow and flutter. Two sine pitch modulations through a moving
    fractional delay line: wow at 0.55 Hz (a stretched belt, a warped
    record; 33 1/3 rpm turns at 0.556 Hz), 0.14% peak; flutter at 4.5 Hz
    (the motor), 0.05% peak. Both inside what a mid-tier deck of the day
    measured (about 0.1% WRMS).
 4. Amplifier saturation. An early-seventies solid-state amp pushed a
    little past its headroom: driven about 4 dB into a soft tanh curve
    (pedalboard Distortion), with a slight asymmetry for its second
    harmonic, then brought back down.
 5. Surface noise. A continuous bed of pink noise at -45 dBFS RMS (the
    preamp's hiss), and a vinyl crackle/pop bed over the whole track,
    band-limited like everything else the stylus reads.

    The crackle is meant to be a downloaded recording: pass --crackle with
    a local file, or --crackle-url (tried in turn). If none can be had
    (this script was first run where the network policy blocked every
    sound library), it falls back to a crackle modelled on real vinyl
    surface noise, and says so: fine dust ticks (a Poisson rain, bright
    and short, mostly in the vertical groove, so partly out of phase
    between the channels), rarer and duller pops, a scratch that ticks
    once a revolution for a while, and a faint surface hash breathing with
    the record's turn.

Writes the MP3 (LAME V2 via ffmpeg) with the source's title and artist.
"""

import argparse
import os
import subprocess
import sys
import tempfile
import urllib.request

import numpy as np
from scipy import signal
from pedalboard import Pedalboard, PeakFilter, Distortion, Gain

RPM = 100.0 / 3.0  # 33 1/3


def db(x):
    return 10.0 ** (x / 20.0)


# ---------------------------------------------------------------- in and out

def decode(path, sr=None):
    """Any audio file to float32 (channels, samples) with ffmpeg."""
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2"]
    if sr:
        cmd += ["-ar", str(sr)]
    cmd += ["pipe:1"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()
    return x


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate:format_tags=title,artist",
                          "-of", "default=nw=1", path], check=True, capture_output=True, text=True).stdout
    info = {}
    for line in out.splitlines():
        k, _, v = line.partition("=")
        info[k.replace("TAG:", "")] = v
    return int(info.get("sample_rate", 44100)), info.get("title", ""), info.get("artist", "")


def encode_mp3(x, sr, path, title, artist):
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(np.ascontiguousarray(x.T.astype(np.float32)).tobytes())
        tmp = f.name
    try:
        cmd = ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", tmp,
               "-codec:a", "libmp3lame", "-q:a", "2"]
        if title:
            cmd += ["-metadata", f"title={title}"]
        if artist:
            cmd += ["-metadata", f"artist={artist}"]
        cmd += ["-metadata", "comment=1974 console turntable treatment", path]
        subprocess.run(cmd, check=True)
    finally:
        os.unlink(tmp)


# ------------------------------------------------------------------ 1. EQ

def band_pass(x, sr, lo=40.0, hi=11000.0):
    sos = signal.butter(8, [lo, hi], btype="bandpass", fs=sr, output="sos")
    return signal.sosfiltfilt(sos, x, axis=-1).astype(np.float32)


def cabinet(x, sr):
    board = Pedalboard([PeakFilter(cutoff_frequency_hz=150.0, gain_db=3.0, q=0.9)])
    return board(x, sr)


# -------------------------------------------------------------- 2. stereo

def lr4_split(x, sr, fc=150.0):
    """Linkwitz-Riley 4th order: two cascaded 2nd-order Butterworths per side."""
    lo = signal.butter(2, fc, btype="lowpass", fs=sr, output="sos")
    hi = signal.butter(2, fc, btype="highpass", fs=sr, output="sos")
    low = signal.sosfilt(lo, signal.sosfilt(lo, x, axis=-1), axis=-1)
    high = signal.sosfilt(hi, signal.sosfilt(hi, x, axis=-1), axis=-1)
    return low, high


def stereo_field(x, sr, width=0.5, mono_below=150.0):
    low, high = lr4_split(x, sr, mono_below)
    mono = low.mean(axis=0, keepdims=True).repeat(2, axis=0)
    mid = (high[0] + high[1]) * 0.5
    side = (high[0] - high[1]) * 0.5 * width
    narrow = np.stack([mid + side, mid - side])
    return (mono + narrow).astype(np.float32)


# ------------------------------------------------------- 3. wow and flutter

def wow_flutter(x, sr, wow_hz=0.55, wow_pct=0.14, flutter_hz=4.5, flutter_pct=0.05, seed=0):
    """A moving fractional delay: its rate of change is the speed error.

    For a delay d(t) = A sin(2 pi f t), the pitch deviates by 2 pi f A
    (as a fraction), so A = pct / 100 / (2 pi f)."""
    rng = np.random.default_rng(seed)
    n = x.shape[1]
    t = np.arange(n) / sr
    a_wow = wow_pct / 100.0 / (2 * np.pi * wow_hz)
    a_fl = flutter_pct / 100.0 / (2 * np.pi * flutter_hz)
    ph1, ph2 = rng.uniform(0, 2 * np.pi, 2)
    d = a_wow * np.sin(2 * np.pi * wow_hz * t + ph1) + a_fl * np.sin(2 * np.pi * flutter_hz * t + ph2)
    base = a_wow + a_fl + 0.002  # keep the read point behind the write point
    pos = (t - base - d) * sr
    pos = np.clip(pos, 0, n - 1)
    i0 = np.floor(pos).astype(np.int64)
    i1 = np.minimum(i0 + 1, n - 1)
    fr = (pos - i0).astype(np.float32)
    out = x[:, i0] * (1 - fr) + x[:, i1] * fr
    return out.astype(np.float32)


# ----------------------------------------------------------- 4. saturation

def amp_saturation(x, sr, drive_db=4.0):
    peak = np.max(np.abs(x)) + 1e-9
    x = x / peak * db(-3.0)  # the amp's nominal level
    # A touch of asymmetry (the output stage): second harmonic.
    x = x + 0.04 * x * np.abs(x)
    board = Pedalboard([Distortion(drive_db=drive_db), Gain(gain_db=-drive_db * 0.6)])
    y = board(x.astype(np.float32), sr)
    return y.astype(np.float32)


# ------------------------------------------------------------ 5. noise

def pink_noise(n, rng):
    """Pink (1/f) noise by shaping white noise's spectrum."""
    white = rng.standard_normal(n)
    spec = np.fft.rfft(white)
    f = np.arange(spec.size)
    f[0] = 1
    spec /= np.sqrt(f)
    p = np.fft.irfft(spec, n)
    return p / np.sqrt(np.mean(p ** 2))


def hiss(n, rng, level_db=-45.0):
    a = pink_noise(n, rng)
    b = pink_noise(n, rng)
    # Each channel's own preamp, a little shared (the power supply).
    l = 0.85 * a + 0.15 * b
    r = 0.85 * b + 0.15 * a
    bed = np.stack([l, r])
    bed /= np.sqrt(np.mean(bed ** 2))
    return (bed * db(level_db)).astype(np.float32)


def fetch_crackle(urls, sr):
    for url in urls:
        try:
            with tempfile.NamedTemporaryFile(delete=False) as f:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (console-1974)"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    f.write(r.read())
                tmp = f.name
            c = decode(tmp, sr)
            os.unlink(tmp)
            if c.shape[1] > sr:
                print(f"crackle: downloaded {url}")
                return c
        except Exception as e:  # blocked, missing, not audio
            print(f"crackle: couldn't get {url} ({e.__class__.__name__}: {e})")
    return None


def modelled_crackle(n, sr, rng):
    """Vinyl surface noise, built from what it's made of."""
    out = np.zeros((2, n), dtype=np.float64)
    dur = n / sr
    rev = 60.0 / RPM

    def burst(length, bright):
        k = np.arange(length)
        imp = rng.standard_normal(length) * np.exp(-k / (length / (5.0 if bright else 2.5)))
        return imp

    # Dust: a Poisson rain of tiny ticks, bright and short.
    for tt in np.cumsum(rng.exponential(1 / 9.0, int(dur * 12))):
        if tt >= dur:
            break
        i = int(tt * sr)
        length = int(rng.uniform(0.00015, 0.0006) * sr) + 2
        amp = db(rng.uniform(-44, -30))
        b = burst(length, True) * amp
        # Mostly vertical groove motion: partly out of phase L/R.
        w = rng.uniform(-1, 1)
        l, r = 1 + 0.3 * w, -(0.35 + 0.4 * rng.random()) * (1 - 0.3 * w)
        j = min(n, i + length)
        out[0, i:j] += b[: j - i] * l
        out[1, i:j] += b[: j - i] * r
    # Pops: rarer, duller, a little louder.
    for tt in np.cumsum(rng.exponential(1 / 0.35, int(dur * 0.6) + 2)):
        if tt >= dur:
            break
        i = int(tt * sr)
        length = int(rng.uniform(0.001, 0.004) * sr) + 4
        amp = db(rng.uniform(-30, -21))
        b = burst(length, False) * amp
        pan = rng.uniform(0.6, 1.0)
        j = min(n, i + length)
        out[0, i:j] += b[: j - i] * pan
        out[1, i:j] += b[: j - i] * (1.6 - pan)
    # A scratch: once a revolution, for a stretch in the middle of the side.
    s0 = rng.uniform(0.25, 0.45) * dur
    for k in range(int(rng.uniform(14, 26))):
        tt = s0 + k * rev
        if tt >= dur:
            break
        i = int(tt * sr)
        length = int(0.0012 * sr)
        b = burst(length, False) * db(-27 + rng.uniform(-3, 2))
        j = min(n, i + length)
        out[0, i:j] += b[: j - i]
        out[1, i:j] += b[: j - i] * 0.8
    # The groove's faint hash, breathing with the turn.
    hash_ = rng.standard_normal((2, n))
    sos = signal.butter(2, [1200, 7000], btype="bandpass", fs=sr, output="sos")
    hash_ = signal.sosfilt(sos, hash_, axis=-1)
    hash_ /= np.sqrt(np.mean(hash_ ** 2))
    t = np.arange(n) / sr
    breathe = 1 + 0.35 * np.sin(2 * np.pi * (RPM / 60) * t + rng.uniform(0, 6.3))
    out += hash_ * db(-58) * breathe
    # The ticks ring a little in the cartridge (a soft resonance near 4 kHz).
    sos = signal.butter(2, [2500, 9000], btype="bandpass", fs=sr, output="sos")
    ring = signal.sosfilt(sos, out, axis=-1)
    return (0.55 * out + 0.45 * ring).astype(np.float32)


def crackle_bed(n, sr, rng, local=None, urls=()):
    c = None
    if local:
        c = decode(local, sr)
        print(f"crackle: using {local}")
    if c is None and urls:
        c = fetch_crackle(urls, sr)
    if c is None:
        print("crackle: no recording to be had; using the modelled vinyl crackle")
        return modelled_crackle(n, sr, rng), "modelled"
    # A recording: loop it (crossfaded) over the whole track, at a level
    # where its pops land around -24 dBFS.
    fade = int(0.25 * sr)
    reps = int(np.ceil(n / max(1, c.shape[1] - fade))) + 1
    ramp = np.linspace(0, 1, fade, dtype=np.float32)
    bed = c.copy()
    for _ in range(reps):
        head = c.copy()
        head[:, :fade] *= ramp
        bed[:, -fade:] *= ramp[::-1]
        bed = np.concatenate([bed[:, :-fade], bed[:, -fade:] + head[:, :fade], head[:, fade:]], axis=1)
        if bed.shape[1] >= n:
            break
    bed = bed[:, :n]
    bed *= db(-24) / (np.percentile(np.abs(bed), 99.9) + 1e-9)
    return bed.astype(np.float32), "recording"


# ------------------------------------------------------------------ main

DEFAULT_CRACKLE_URLS = [
    # Openly licensed vinyl crackle recordings, tried in turn.
    "https://upload.wikimedia.org/wikipedia/commons/4/4e/Vinyl_crackle.ogg",
    "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4e/Vinyl_crackle.ogg/Vinyl_crackle.ogg.mp3",
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--output", default="1974_console_master.mp3")
    ap.add_argument("--crackle", help="a local vinyl crackle recording to use")
    ap.add_argument("--crackle-url", action="append", default=None, help="a crackle recording to download (repeatable)")
    ap.add_argument("--seed", type=int, default=1974)
    a = ap.parse_args()

    sr, title, artist = probe(a.input)
    rng = np.random.default_rng(a.seed)
    x = decode(a.input, sr)
    print(f"read {a.input}: {x.shape[1] / sr:.1f} s at {sr} Hz")

    x = band_pass(x, sr)                      # 1. rumble filter + stylus limit
    x = cabinet(x, sr)                        #    the cabinet's 150 Hz
    x = stereo_field(x, sr)                   # 2. mono lows, half-width highs
    x = wow_flutter(x, sr, seed=a.seed)       # 3. belt and motor
    x = amp_saturation(x, sr)                 # 4. the amp, a little hot
    n = x.shape[1]
    x = x + hiss(n, rng)                      # 5. the preamp's hiss
    crackle, kind = crackle_bed(n, sr, rng, a.crackle, a.crackle_url or DEFAULT_CRACKLE_URLS)
    x = x + band_pass(crackle, sr)            #    the record's surface, read by the same stylus

    peak = np.max(np.abs(x))
    x = x / peak * db(-1.0)
    encode_mp3(x, sr, a.output, title, artist)
    print(f"wrote {a.output} ({kind} crackle)")


if __name__ == "__main__":
    sys.exit(main())
