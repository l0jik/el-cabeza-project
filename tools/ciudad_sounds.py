"""The City's recorded sound: the city at each of its hours, made from the
recordings in assets/ciudad/src/ (where CREDITS.md says whose each is, its
licence, and how it came: by way of the Scaper library's and the Blanket
app's sounds, freesound.org itself being out of reach). User: "go online
and find like city sounds, that ambient city sounds that would be
appropriate for each time"; then "find real sounds, not synthesized for
the city".

  morning    (8:40 AM) the city park in Tel Aviv at its quietest (yonts,
             CC0; its first 46 s, before something comes up loud), its
             birds and more in the trees over it (a wood thrush's morning,
             kvgarlic, CC0; below 1.2 kHz taken out, the wood's own hush,
             and an insect's steady drone at 4.8 kHz),
             and the traffic far off (street level in New York,
             gezortenplotz, CC BY 3.0; dulled above 900 Hz).
             -> assets/ciudad/city-morning.mp3
  afternoon  (2:10 PM) a busy street walked down (street scene 3, saphe,
             CC BY 4.0), more cars (New York), people along the high street
             under it (Gandia, jormarp, CC0). -> city-afternoon.mp3
  golden     (7:05 PM) the high street of Gandia at seven in the evening,
             people out walking and talking (CC0), the traffic lighter and
             further off (street scene 3, dulled), the thrush far off.
             -> city-golden.mp3
  overcast   (3:30 PM) a street at work (street scene 1, saphe, CC BY 4.0:
             two men's tools, cars, a tram going by), the wind over it
             (felix.blume, CC0), the traffic further off. -> city-overcast.mp3
  night      (10 PM) the traffic far off and low (New York, dulled to a
             roar), the park at night (yonts), crickets in it (Lisa
             Redfern, public domain), a restaurant still open (stephan,
             public domain). -> city-night.mp3

Each hour one seamless stereo loop: each layer made a loop of the hour's
length on its own (its last XF crossfaded, equal power, over its first; a
short recording laid end to end first, overlapped), a mono one made wide
without anything in it heard twice (the right channel the same loop some
seconds on, as Noir's rain, would put a tram or a horn through twice: here
its twin with every frequency's phase turned at random, round the loop so
it stays seamless, shared between the two as their difference), the
layers set against each other by their loudness and summed. The file is
the loop with PAD of its own end before it and of its start after it, as
Noir's loops are (themes/ciudad-audio.js loops from the first sound + PAD
to the last - PAD). The hours' loudness apart as the city is (the night
7 dB under the afternoon); the game sets them all against its own sounds.

    FFMPEG=/path/to/ffmpeg python3 tools/ciudad_sounds.py [morning afternoon golden overcast night]
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, filtfilt, iirnotch, sosfiltfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/ciudad/src")
OUT = os.path.join(ROOT, "assets/ciudad")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 48000
PAD = 0.3
XF = 4.0
KBPS = 96

PARK = "city-park-tel-aviv-yonts-268903.ogg"
STREET3 = "street-scene-3-saphe-173955.ogg"
STREET1 = "street-scene-1-saphe-150993.ogg"
GANDIA = "high-street-of-gandia-jormarp-207208.ogg"
NYC = "nyc-street-level-gezortenplotz-44796.ogg"
THRUSH = "wood-thrush-morning-kvgarlic-156826.ogg"
WIND = "wind-in-a-field-felix-blume-217506.ogg"
CRICKETS = "crickets-at-night-lisa-redfern.ogg"
RESTAURANT = "restaurant-ambiance-stephan.ogg"
# Downtown New York from a hotel window, its traffic held up and horns
# going far and near (TRP, CC0; freesound.org itself in reach again by
# then, so straight from its previews): the gridlock under every hour
# (user: "The city needs more like gridlock traffic sound with honking
# ... like in downtown New York ... but not overwhelming"). The honks
# nearer are the game's own, one at a time (tools/ciudad_honks.py).
GRIDLOCK = "city-distant-hotel-window-trp-715663.ogg"


def load(name):
    """A source decoded at SR, two channels (a mono one doubled)."""
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", "2", wav], check=True)
        x, _ = sf.read(wav, always_2d=True)
    return x


def mono(x):
    return x.mean(1)


def cut(x, a, b):
    return x[int(a * SR):int(b * SR)].copy()


def hp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "highpass", fs=SR, output="sos"), x, axis=0)


def lp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x, axis=0)


def notch(x, f, q=12):
    b, a = iirnotch(f, q, fs=SR)
    return filtfilt(b, a, x, axis=0)


def rms(x):
    return np.sqrt(np.mean(x ** 2))


def to_db(x, db):
    return x * (10 ** (db / 20) / rms(x))


def eq_power(n, ndim):
    w = np.linspace(0, np.pi / 2, n)
    return (np.cos(w), np.sin(w)) if ndim == 1 else (np.cos(w)[:, None], np.sin(w)[:, None])


def loop_of(seg, length):
    """seg (at least length + XF long) made a seamless loop `length` long:
    its last XF crossfaded (equal power) over its first."""
    n, x = int(length * SR), int(XF * SR)
    assert len(seg) >= n + x, f"{len(seg) / SR:.1f} s is short of {length + XF:.1f} s"
    out_w, in_w = eq_power(x, seg.ndim)
    head = seg[n:n + x] * out_w + seg[:x] * in_w
    return np.concatenate([head, seg[x:n]])


def laid_end_to_end(x, length, overlap=1.0):
    """A short recording laid end to end, each time over the last's final
    `overlap` (equal power), until it's `length` long."""
    n, o = int(length * SR), int(overlap * SR)
    out = x.copy()
    out_w, in_w = eq_power(o, x.ndim)
    while len(out) < n:
        out = np.concatenate([out[:-o], out[-o:] * out_w + x[:o] * in_w, x[o:]])
    return out[:n]


def wide(loop, seed):
    """A mono loop made stereo, nothing in it heard twice: its twin with
    every frequency's phase turned at random (a 43 ms all-pass, applied
    round the loop, so the twin is as seamless as the loop), the two
    channels the loop and the twin's share of it as their sum and
    difference (as wide as a pair of microphones a step apart hears a
    street, its events where they were, in the middle)."""
    rng = np.random.default_rng(seed)
    n = 2048
    ph = rng.uniform(-np.pi, np.pi, n // 2 + 1)
    ph[0] = ph[-1] = 0.0
    h = np.fft.irfft(np.exp(1j * ph), n)
    twin = np.fft.irfft(np.fft.rfft(loop) * np.fft.rfft(h, len(loop)), len(loop))
    twin *= rms(loop) / rms(twin)
    return np.stack([0.76 * loop + 0.65 * twin, 0.76 * loop - 0.65 * twin], 1)


def soft_peaks(x, knee_db=16, room_db=4):
    """The tops of the loudest moments (a car right by the microphone)
    rounded off above `knee_db` over the average, to `room_db` more at the
    most, so the whole needn't be turned down for a few of them."""
    t = rms(x) * 10 ** (knee_db / 20)
    c = t * 10 ** (room_db / 20)
    a = np.abs(x)
    big = a > t
    out = x.copy()
    out[big] = np.sign(x[big]) * (t + (c - t) * np.tanh((a[big] - t) / (c - t)))
    return out


def padded(loop):
    """The loop with PAD of its own end before it and of its start after it."""
    p = int(PAD * SR)
    return np.concatenate([loop[-p:], loop, loop[:p]])


def write(x, name):
    path = os.path.join(OUT, name)
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x * (0.98 / peak)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        sf.write(wav, x, SR, subtype="PCM_16")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", f"{KBPS}k", path], check=True)
    print(f"{path}: {len(x) / SR:.2f} s, {20 * np.log10(rms(x)):.1f} dBFS RMS, {os.path.getsize(path) // 1024} KB")


def hour(layers, length, level, name):
    """The hour's layers (each a loop `length` long, stereo, at its dB
    against the others) summed, the loudest moments rounded off, at
    `level` dBFS RMS."""
    mix = sum(to_db(x, db) for x, db in layers)
    mix = to_db(soft_peaks(to_db(mix, level)), level)
    write(padded(mix), name)


# ---- the layers ----
def park(length):
    x = hp(cut(mono(load(PARK)), 0.0, 46.0), 35)
    return wide(loop_of(x, length), 11)


def nyc(length, dull=None):
    x = load(NYC)
    x = laid_end_to_end(x, length + XF)
    if dull:
        x = lp(x, dull)
    return loop_of(hp(x, 30), length)


def thrush(length, low_cut=1200):
    x = cut(load(THRUSH), 0.0, length + XF)
    # (an insect's drone, steady through it, out: 4.83-4.86 kHz)
    return loop_of(notch(notch(hp(x, low_cut, 4), 4836), 4836), length)


def street3(length, dull=None):
    x = hp(cut(mono(load(STREET3)), 0.0, 60.0), 35)
    if dull:
        x = lp(x, dull)
    return wide(loop_of(x, length), 23)


def gandia(length, seed=37):
    x = hp(cut(mono(load(GANDIA)), 0.0, 60.0), 60)
    return wide(loop_of(x, length), seed)


def gridlock(length, dull=None, start=120.0):
    x = hp(cut(load(GRIDLOCK), start, start + length + XF), 40)
    if dull:
        x = lp(x, dull)
    return loop_of(x, length)


def morning():
    L = 42.0
    hour([(park(L), -30), (thrush(L), -35), (nyc(L, dull=900), -34), (gridlock(L, dull=1800, start=60.0), -31)], L, -24, "city-morning.mp3")


def afternoon():
    L = 56.0
    hour([(street3(L), -22), (nyc(L), -26), (gandia(L, 41), -30), (gridlock(L), -23)], L, -20, "city-afternoon.mp3")


def golden():
    L = 56.0
    hour([(gandia(L), -22), (street3(L, dull=2500), -29), (thrush(L, 1500), -38), (gridlock(L, start=240.0), -24)], L, -21, "city-golden.mp3")


def overcast():
    L = 40.8
    work = wide(loop_of(hp(cut(mono(load(STREET1)), 0.0, 45.0), 35), L), 53)
    wind = loop_of(hp(laid_end_to_end(load(WIND), L + XF), 40), L)
    hour([(work, -22), (wind, -27), (nyc(L, dull=1500), -31), (gridlock(L, dull=3000, start=300.0), -27)], L, -21, "city-overcast.mp3")


def night():
    L = 42.0
    crickets = loop_of(hp(cut(load(CRICKETS), 0.0, L + XF), 1800, 4), L)
    restaurant = loop_of(lp(hp(laid_end_to_end(load(RESTAURANT), L + XF), 120), 2500), L)
    hour([(nyc(L, dull=600), -28), (park(L), -31), (crickets, -40), (restaurant, -39), (gridlock(L, dull=900, start=360.0), -35)], L, -27, "city-night.mp3")


if __name__ == "__main__":
    import sys
    only = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    for step in (morning, afternoon, golden, overcast, night):
        if not only or step.__name__ in only:
            step()
