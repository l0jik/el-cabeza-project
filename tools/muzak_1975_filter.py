#!/usr/bin/env python3
"""muzak_1975_filter.py - clean tracks -> a worn background-music tape
played over a 1975 suburban mall's public-address system.

Signal chain, in the order the sound actually travelled in 1975:

  1. THE TAPE (recorded at the music service, played back in the mall's
     equipment room):
       mono fold-down (background-music tapes and PA feeds were mono)
       -> harmonic saturation: soft clipping of the mid-range peaks
          (mid pre-emphasis, asymmetric tanh, matching de-emphasis)
       -> tape hiss: low-passed white noise, 48 dB under the programme
       -> wow (0.6 Hz, 0.25 %) and flutter (14 Hz, 0.12 %) by
          time-varying resampling of the tape's read position
  2. THE PA LINE:
       -> microphone-priority ducking: random -3.5 dB dips with 200 ms
          linear ramps
  3. THE CEILING SPEAKERS:
       -> 4th-order Butterworth band-pass, 250 Hz - 4.5 kHz
       -> +3.5 dB resonant peak across 1.2 - 1.8 kHz (the paper cone's
          boxy, metallic mid-range)
  4. THE ATRIUM:
       -> 45 ms slapback off the concrete and tile, 15 % wet
       -> diffuse atrium reverb: a synthesised stereo impulse response,
          RT60 2.6 s, heavily damped above 3 kHz, 22 % wet

Every stage keeps the signal as a 1-D float64 array of the same length
(mono) until the reverb, which returns an (n, 2) array; lengths are
asserted at each step. Output lengths are held within 1:30 - 3:00.

Usage:  python3 muzak_1975_filter.py [--input input_tracks]
                                      [--output mall_master_1975]
                                      [--bitrate 256k]
"""
import importlib
import subprocess
import sys


def ensure(module, pip_name=None):
    """Import `module`, installing it with pip first if it's missing."""
    try:
        return importlib.import_module(module)
    except ImportError:
        print(f"installing {pip_name or module} ...", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", pip_name or module])
        return importlib.import_module(module)


ensure("numpy")
ensure("scipy")
if sys.version_info >= (3, 13):
    ensure("audioop", "audioop-lts")  # pydub needs audioop, gone from 3.13's stdlib
ensure("pydub")

import argparse
import math
import os
import re
import shutil
import zlib

import numpy as np
from pydub import AudioSegment
from scipy import signal

# ------------------------------------------------------------------ settings
SR = 44100                      # working and output sample rate

# 1970s ceiling / horn speaker
BP_LOW_HZ, BP_HIGH_HZ, BP_ORDER = 250.0, 4500.0, 4
PEAK_LO_HZ, PEAK_HI_HZ, PEAK_GAIN_DB = 1200.0, 1800.0, 3.5

# tape machine
HISS_SNR_DB = 48.0              # hiss sits 48 dB under the programme
HISS_LOWPASS_HZ = 5000.0        # oxide high-frequency loss (gentle, 1st order)
WOW_HZ, WOW_DEPTH = 0.6, 0.0025         # 0.25 % speed (= pitch) deviation
FLUTTER_HZ, FLUTTER_DEPTH = 14.0, 0.0012  # 0.12 %
SAT_DRIVE = 1.8                 # tanh drive at the normalised programme peak
SAT_BIAS = 0.06                 # asymmetry: a little 2nd harmonic, as tape has
SAT_EMPHASIS_DB = 4.0           # mid pre-emphasis so the mid peaks clip first

# atrium
SLAP_MS, SLAP_WET = 45.0, 0.15
RT60_S, DAMP_HZ, RT60_HIGH_S = 2.6, 3000.0, 0.7
PREDELAY_S = 0.028
REVERB_WET = 0.22

# PA microphone priority ducking
DUCK_DB, DUCK_RAMP_S = -3.5, 0.200
DUCK_HOLD_S = (1.2, 5.5)        # how long a microphone stays keyed
DUCK_GAP_S = (16.0, 48.0)       # time between keyings

# output
MIN_S, MAX_S = 90.0, 180.0
TARGET_RMS_DBFS = -19.0
PEAK_CEILING_DBFS = -1.0


# ------------------------------------------------------------------ helpers
def natural_key(name):
    """Sort '2 x.mp3' before '10 x.mp3'."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def db(x):
    return 10.0 ** (x / 20.0)


def active_rms(x, sr=SR):
    """RMS of the programme, ignoring silences (50 ms frames within 40 dB of the loudest)."""
    frame = int(0.05 * sr)
    n = len(x) // frame * frame
    if n == 0:
        return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
    fr = np.sqrt(np.mean(x[:n].reshape(-1, frame) ** 2, axis=1))
    keep = fr > fr.max() * db(-40)
    return float(np.sqrt(np.mean(fr[keep] ** 2)) + 1e-12)


def stereo_rms(y):
    """Active RMS of an (n, 2) signal, the channels' power averaged."""
    return float(np.sqrt((active_rms(y[:, 0]) ** 2 + active_rms(y[:, 1]) ** 2) / 2.0))


def peaking_biquad(f0, gain_db, q, sr=SR):
    """RBJ cookbook peaking EQ; the -gain version is its exact inverse."""
    a = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * math.pi * f0 / sr
    alpha = math.sin(w0) / (2.0 * q)
    b = np.array([1 + alpha * a, -2 * math.cos(w0), 1 - alpha * a])
    den = np.array([1 + alpha / a, -2 * math.cos(w0), 1 - alpha / a])
    return b / den[0], den / den[0]


def load(path):
    """Decode to float64 mono at SR, shape (n,)."""
    seg = AudioSegment.from_file(path)
    seg = seg.set_sample_width(2)
    raw = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    x = raw.reshape(-1, seg.channels)
    mono = x.mean(axis=1)  # the PA feed is mono
    if seg.frame_rate != SR:
        g = math.gcd(SR, seg.frame_rate)
        mono = signal.resample_poly(mono, SR // g, seg.frame_rate // g)
    return np.ascontiguousarray(mono), seg.frame_rate, seg.channels


def fit_duration(x, tail_s):
    """Hold the finished track (programme + reverb tail) within MIN_S..MAX_S."""
    n = len(x)
    max_prog = int((MAX_S - tail_s) * SR)
    if n > max_prog:  # too long: cut, with a 3 s fade as a tape would be edited
        x = x[:max_prog].copy()
        f = int(3.0 * SR)
        x[-f:] *= np.linspace(1.0, 0.0, f)
    min_prog = int(MIN_S * SR)
    if len(x) < min_prog:  # too short: loop it with a 2 s crossfade, as a tape loop
        xf = int(2.0 * SR)
        out = x.copy()
        while len(out) < min_prog:
            ramp = np.linspace(0.0, 1.0, xf)
            join = out[-xf:] * (1 - ramp) + x[:xf] * ramp
            out = np.concatenate([out[:-xf], join, x[xf:]])
        x = out
    return x


# ------------------------------------------------------------------ 1. tape
def tape_saturation(x):
    """Soft-clip the mid-range peaks: pre-emphasise the mids, saturate, de-emphasise."""
    f0 = math.sqrt(PEAK_LO_HZ * PEAK_HI_HZ)
    b_up, a_up = peaking_biquad(f0, SAT_EMPHASIS_DB, 0.7)
    b_dn, a_dn = peaking_biquad(f0, -SAT_EMPHASIS_DB, 0.7)
    y = signal.lfilter(b_up, a_up, x)
    peak = np.percentile(np.abs(y), 99.9) + 1e-12
    y = y / peak
    y = np.tanh(SAT_DRIVE * (y + SAT_BIAS)) - math.tanh(SAT_DRIVE * SAT_BIAS)
    y = y / math.tanh(SAT_DRIVE)
    y = signal.lfilter(b_dn, a_dn, y) * peak
    return y


def tape_hiss(x, rng):
    """Low-passed white noise, HISS_SNR_DB under the programme's active RMS."""
    noise = rng.standard_normal(len(x))
    b, a = signal.butter(1, HISS_LOWPASS_HZ, btype="low", fs=SR)
    noise = signal.lfilter(b, a, noise)
    noise *= active_rms(x) * db(-HISS_SNR_DB) / (np.sqrt(np.mean(noise ** 2)) + 1e-12)
    return x + noise


def wow_and_flutter(x, rng):
    """Read the tape at a speed that wanders: resample along a modulated position."""
    n = len(x)
    t = np.arange(n) / SR
    # Wow: 0.6 Hz, its rate drifting a little (a capstan and a worn pinch roller).
    drift = signal.resample(rng.standard_normal(max(4, int(t[-1] / 4) + 2)), n) * 0.04
    wow_phase = 2 * math.pi * WOW_HZ * np.cumsum(1.0 + drift) / SR + rng.uniform(0, 2 * math.pi)
    wow = WOW_DEPTH * np.sin(wow_phase)
    # Flutter: 14 Hz, its depth jittering (tape scrape, a sticky guide).
    jitter = np.abs(signal.resample(rng.standard_normal(max(4, int(t[-1] * 3))), n))
    jitter = 0.65 + 0.35 * np.clip(jitter / (jitter.max() + 1e-12), 0, 1)
    flutter = FLUTTER_DEPTH * jitter * np.sin(2 * math.pi * FLUTTER_HZ * t + rng.uniform(0, 2 * math.pi))
    speed = 1.0 + wow + flutter
    pos = np.concatenate([[0.0], np.cumsum(speed[:-1])])
    pos = np.clip(pos, 0.0, n - 1.0)
    y = np.interp(pos, np.arange(n, dtype=np.float64), x)
    assert y.shape == x.shape
    return y


# ------------------------------------------------------------------ 2. PA line
def pa_ducking(x, rng):
    """Random -3.5 dB dips, 200 ms linear ramps: a microphone keyed elsewhere."""
    n = len(x)
    gain = np.ones(n)
    low = db(DUCK_DB)
    ramp = int(DUCK_RAMP_S * SR)
    at = rng.uniform(6.0, 20.0)
    events = []
    while True:
        hold = rng.uniform(*DUCK_HOLD_S)
        s = int(at * SR)
        e = s + 2 * ramp + int(hold * SR)
        if e >= n - SR:
            break
        gain[s:s + ramp] = np.linspace(1.0, low, ramp)
        gain[s + ramp:e - ramp] = low
        gain[e - ramp:e] = np.linspace(low, 1.0, ramp)
        events.append((round(at, 1), round(hold, 1)))
        at += hold + rng.uniform(*DUCK_GAP_S)
    return x * gain, events


# ------------------------------------------------------------------ 3. speakers
def ceiling_speaker(x):
    sos = signal.butter(BP_ORDER, [BP_LOW_HZ, BP_HIGH_HZ], btype="bandpass", fs=SR, output="sos")
    y = signal.sosfilt(sos, x)
    f0 = math.sqrt(PEAK_LO_HZ * PEAK_HI_HZ)          # ~1.47 kHz
    q = f0 / (PEAK_HI_HZ - PEAK_LO_HZ)               # the peak spans 1.2-1.8 kHz
    b, a = peaking_biquad(f0, PEAK_GAIN_DB, q)
    return signal.lfilter(b, a, y)


# ------------------------------------------------------------------ 4. atrium
def slapback(x):
    d = int(SLAP_MS / 1000.0 * SR)
    late = np.zeros_like(x)
    late[d:] = x[:-d]
    b, a = signal.butter(1, 3500.0, btype="low", fs=SR)  # concrete keeps little top
    late = signal.lfilter(b, a, late)
    return (1.0 - SLAP_WET) * x + SLAP_WET * late


def atrium_ir(rng):
    """Stereo impulse response: pre-delay, a few hard early reflections, then a
    diffuse exponential tail whose band above DAMP_HZ dies far sooner."""
    length = int((PREDELAY_S + RT60_S * 1.2) * SR)
    t = np.arange(length) / SR
    lp = signal.butter(4, DAMP_HZ, btype="low", fs=SR, output="sos")
    hp = signal.butter(4, DAMP_HZ, btype="high", fs=SR, output="sos")
    irs = []
    for ch in range(2):
        noise = rng.standard_normal(length)
        low = signal.sosfilt(lp, noise) * np.exp(-6.9078 * t / RT60_S)
        high = signal.sosfilt(hp, noise) * np.exp(-6.9078 * t / RT60_HIGH_S) * 0.35
        ir = low + high
        onset = np.clip((t - PREDELAY_S) / 0.06, 0.0, 1.0)  # the tail builds up over 60 ms
        ir *= onset ** 1.5
        ir[: int(PREDELAY_S * SR)] = 0.0
        # Early reflections: floor, storefront glass, the far balcony (hollow),
        # each a little above the tail that's building up around it.
        top = np.max(np.abs(ir))
        for i, (ms, g) in enumerate(((31, 1.1), (47 + 6 * ch, 0.9), (73 - 5 * ch, 0.75), (109, 0.55), (151 + 9 * ch, 0.4))):
            k = int(ms / 1000.0 * SR)
            ir[k] += g * top * (1 if (i + ch) % 2 else -1)
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
        irs.append(ir)
    return irs


def atrium_reverb(x, rng):
    """Returns (n + tail, 2): the dry mono centre plus the decorrelated room."""
    irs = atrium_ir(rng)
    tail = len(irs[0]) - 1
    n_out = len(x) + tail
    dry = np.concatenate([x, np.zeros(tail)])
    wet = np.stack([signal.oaconvolve(x, ir, mode="full") for ir in irs], axis=1)
    assert wet.shape == (n_out, 2) and dry.shape == (n_out,)
    wet *= active_rms(dry) / (stereo_rms(wet) + 1e-12)               # wet at the dry's level...
    out = (1.0 - REVERB_WET) * dry[:, None] + REVERB_WET * wet       # ...then 22 % of the mix
    return out


# ------------------------------------------------------------------ the chain
def process(path, out_path, bitrate):
    name = os.path.splitext(os.path.basename(path))[0]
    rng = np.random.default_rng(zlib.crc32(name.encode()))  # same result every run
    x, src_sr, src_ch = load(path)
    src_s = len(x) / SR
    tail_s = PREDELAY_S + RT60_S * 1.2
    x = fit_duration(x, tail_s)
    n = len(x)

    x = tape_saturation(x);          assert len(x) == n
    x = tape_hiss(x, rng);           assert len(x) == n
    x = wow_and_flutter(x, rng);     assert len(x) == n
    x, dips = pa_ducking(x, rng);    assert len(x) == n
    x = ceiling_speaker(x);          assert len(x) == n
    x = slapback(x);                 assert len(x) == n
    y = atrium_reverb(x, rng)        # (n + tail, 2)

    # Let the room ring out, then a short fade; never past MAX_S.
    end = min(len(y), int(MAX_S * SR))
    y = y[:end]
    fade = int(0.8 * SR)
    y[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None]
    y[: int(0.01 * SR)] *= np.linspace(0.0, 1.0, int(0.01 * SR))[:, None]

    # Level: the same loudness for every track on the loop, peaks under -1 dBFS.
    y *= db(TARGET_RMS_DBFS) / stereo_rms(y)
    pk = np.max(np.abs(y))
    if pk > db(PEAK_CEILING_DBFS):
        y *= db(PEAK_CEILING_DBFS) / pk

    # 16-bit with TPDF dither, then MP3.
    dither = (np.random.default_rng(1).random(y.shape) - np.random.default_rng(2).random(y.shape)) / 32768.0
    pcm = np.clip(np.round((y + dither) * 32767.0), -32768, 32767).astype("<i2")
    seg = AudioSegment(data=np.ascontiguousarray(pcm).tobytes(), sample_width=2, frame_rate=SR, channels=2)
    title = re.sub(r"^\d+[_ -]*", "", name).replace("_", " ")
    seg.export(out_path, format="mp3", bitrate=bitrate,
               tags={"title": title, "album": "Mall Master 1975", "comment": "treated with muzak_1975_filter.py"})
    out_s = len(y) / SR
    assert MIN_S <= out_s <= MAX_S, out_s
    return {"in": f"{src_s:6.1f}s {src_sr} Hz {src_ch}ch", "out": f"{out_s:6.1f}s", "dips": dips,
            "peak_dbfs": round(20 * math.log10(np.max(np.abs(y)) + 1e-12), 1)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default="input_tracks")
    ap.add_argument("--output", default="mall_master_1975")
    ap.add_argument("--bitrate", default="256k")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed to decode and encode MP3 (pydub uses it)")
    files = sorted((f for f in os.listdir(args.input) if f.lower().endswith(".mp3")), key=natural_key)
    if not files:
        sys.exit(f"no .mp3 files in {args.input}/")
    os.makedirs(args.output, exist_ok=True)
    print(f"{len(files)} track(s): {args.input}/ -> {args.output}/  ({args.bitrate})")
    for f in files:
        info = process(os.path.join(args.input, f), os.path.join(args.output, f), args.bitrate)
        print(f"  {f}\n    in {info['in']}  ->  out {info['out']}  peak {info['peak_dbfs']} dBFS"
              f"  PA dips at {', '.join(f'{a}s ({h}s)' for a, h in info['dips'])}", flush=True)


if __name__ == "__main__":
    main()
