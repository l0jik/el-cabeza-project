"""The dread under the walk down the hall (themes/den-hall.js PULL_FILES walk,
drag), from the recordings in assets/hall/src/ (CREDITS.md says whose each
is). The user, of the walk's first sound (the man reacting all the way,
things knocked over): "We have to redo the sound for the walking to the
hallway animation. I don't like it"; what was off, "His voice, The crashing
things"; what it should be, "Building dread": a rising drone and a
heartbeat, the room's sound warping, a few sharp hits, little or no voice;
and dragged in, the third time, "the same way, made faster and rougher".

Five sets, each a walk and a drag, all on the same moments of the walk:

  1 Heartbeat     a dark drone climbing all the way, a heartbeat coming in
                  slow and quickening to the doorway; a hit at the
                  doorframe, a braam as the rift comes into view; in the
                  calm the drone falls away and the heartbeat's all there
                  is, until it stops; then the eruption.
  2 The house     the house itself: a bowed drone sagging lower, a slow
                  breathing swell, creaks and groans pitched down round
                  you, the doorframe cracking, a long groan in the calm.
  3 Shepard       a tone that rises and rises and never arrives (a
                  Shepard-Risset glissando), sub pulses with the heart,
                  bowed metal as the rift comes into view; it stops dead in
                  the calm and comes back screaming up at the eruption.
  4 Pressure      the air thickening: a rumble rising, everything muffling
                  as if your ears were filling, a ringing; the doorframe
                  pops your ears, a glass sting at the rift; almost silence
                  in the calm, the ringing and the heart.
  5 Live wire     a transformer's hum climbing and fraying, crackles
                  gathering, arcs for hits, the flicker of a dying tube.

Every set, the click is time 0 (the drag's is its own start); the den's own
sound bending away is the game's (den-audio.js hallPull), the footsteps,
the crackle with the flashes, the hum and the force field are the game's,
and so is the shout at the end (with its preverb and echo): the dread
leaves room for the shout (under it, its middle comes down) and stops as
the white takes you.

    FFMPEG=/path/to/ffmpeg python3 tools/hall_dread.py          the set in the game
    FFMPEG=... python3 tools/hall_dread.py --set 3               another, into the game
    FFMPEG=... python3 tools/hall_dread.py --all --out DIR       every set, DIR/set1 ... set5

The game's set is SET below. Each file: stereo, LEAD of silence first
(den-hall.js finds the first sound), LAME VBR.
"""
import argparse
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt, sosfiltfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("HALL_DREAD_SRC", os.path.join(ROOT, "assets/hall/src"))
OUT = os.path.join(ROOT, "assets/hall")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 44100
LEAD = 0.1
SET = 1

# The walk's moments (den-hall.js; the walk's clock from the click, s): the
# doorframe, round the turn, the rift full in view, standing still, the
# eruption, the shout's preverb heard, the shout, the white takes you. The
# drag's, in its own seconds (the walk 1.7 times as fast, then straight on
# to the eruption).
WALK = dict(door=6.95, turn=7.2, reveal=8.9, still=10.2, erupt=12.6, pre=13.29, scream=15.09, end=16.2)
DRAG = dict(door=4.09, turn=4.24, reveal=5.24, still=6.0, erupt=6.4, pre=7.09, scream=8.89, end=10.0)

# The recordings (freesound.org, CC0 unless said): key -> file in SRC.
FILES = {
    "werra": "werra-eerie-dark-drone-soundscape-249985",
    "reacthor": "reacthor-drone-of-suspense-130982",
    "harmonic": "harmonicmess-dark-tension-drone-826597",
    "bowedrone": "ceich93-drone-bowedcybmal-266414",
    "windrone": "echocinematics-dark-drone-wind-and-static-133979",
    "bowedlow": "bendavisdrumguygmailcom-bowed-cymbal-1-low-215571",
    "glass": "bjcurlee-wine-glass-ringing-singing-396293",
    "heart": "cloud10-heartbeat-97-bpm-688735",
    "boom": "harrisonlace-dsgnstngr-basic-trailer-boom-impact-816376",
    "braamhit": "vykroft-braam-hit-431316",
    "braam": "unfa-braam-647712",
    "brass": "brktkrgll-apocalyptic-cinematic-brass-braam-impact-856173",
    "impact": "deleteduser3277771-cinematic-impact-177242",
    "lowhit": "audiopapkin-very-low-frequency-impact-541029",
    "revcrash": "deleteduser7146007-reverse-crash-cymbal-projection-383903",
    "revglass": "burnttoys-cymbal-reversed-glassy-resonance-9523",
    "riser": "xkeril-another-long-riser-789102",
    "uneasy": "kanaizo-uneasy-riser-1-751209",
    "rumble": "woodingp-low-rumble-new-2-83517",
    "rumble2": "danielsoniii-rumble-bass-68396",
    "rumble3": "lennartgreen-low-rumble-loopable-ambiance-638914",
    "creaks": "peridactyloptrix-slow-wooden-creaks-x5-218163",
    "door": "brighella-door-creak-5-long-196152",
    "metal": "loafdv-long-metal-creak-238289",
    "bigdoor": "jemburyturner-big-door-creak-273466",
    "squeaks": "avstudent-loud-slow-squeaks-849999",
    "suction": "hazelr1ver-suction-tube-with-fade-in-and-pop-855977",
    "transformer": "kyles-hum-electric-transformer-in-large-room2-453445",
    "mains": "tosha73-electric-power-transformer-495710",
    "buzz": "smokinghotdog-electric-buzz-584241",
    "crackle": "ihitokage-low-electricity-crackling-238598",
    "crackhi": "ihitokage-electricity-crackling-with-hight-pitch-238596",
    "tube": "yoh-bad-fluorescent-lamp-clicks-259733",
}
# The long ones are kept as excerpts (as far as the game's set reads them),
# each from EXCERPT[key] seconds into its recording: loaded, it's put back
# where it was (silence before). Any other set's recordings: from
# freesound.org (the number at the end of each name), into SRC.
EXCERPT = {"werra": 1.5, "harmonic": 0.0, "glass": 1.5, "rumble": 1.5}
_cache = {}


def load(key):
    """A recording, decoded at SR, stereo."""
    if key in _cache: return _cache[key]
    base = os.path.join(SRC, FILES[key])
    path = next((base + e for e in (".wav", ".ogg", ".mp3", ".hq.mp3", ".lq.mp3") if os.path.exists(base + e)), None)
    off = 0.0
    if not path and key in EXCERPT and os.path.exists(base + "-excerpt.ogg"): path, off = base + "-excerpt.ogg", EXCERPT[key]
    if not path: raise FileNotFoundError(f"{base}: get it from freesound.org/s/{FILES[key].rsplit('-', 1)[1]}")
    if path.endswith(".wav"):
        x, sr = sf.read(path, always_2d=True); assert sr == SR
    else:
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, "x.wav")
            subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", path, "-ar", str(SR), "-ac", "2", wav], check=True)
            x, _ = sf.read(wav, always_2d=True)
    if off: x = np.concatenate([np.zeros((n_of(off), 2)), x])
    _cache[key] = x
    return x


# ---- shaping ----
def n_of(t): return int(round(t * SR))


def cut(x, a, b=None): return x[n_of(a):(n_of(b) if b is not None else len(x))].copy()


def curve(points, n, t0=0.0):
    """Points [(t, v)] (seconds from t0) as a value per sample, held flat
    before the first and after the last."""
    ts, vs = zip(*points)
    return np.interp(t0 + np.arange(n) / SR, ts, vs)


def dbv(d): return 10 ** (np.asarray(d) / 20)


def gain(x, points, t0=0.0):
    """Gain in dB along points, t0: where x starts on their clock."""
    return x * dbv(curve(points, len(x), t0))[:, None]


def fade(x, fin=0.005, fout=0.02):
    x = x.copy(); a, b = min(n_of(fin), len(x)), min(n_of(fout), len(x))
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x


def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def peak_db(x): return 20 * np.log10(np.abs(x).max() + 1e-12)


def at_rms(x, d): return x * dbv(d - rms_db(x))


def at_peak(x, d): return x * dbv(d - peak_db(x))


def pan(x, p):
    """x made one voice and set to one side (p -1..1), equal power."""
    a = (p + 1) * np.pi / 4
    m = x.mean(1)
    return np.stack([m * np.cos(a), m * np.sin(a)], 1) * np.sqrt(2)


def width(x, w):
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    return np.stack([m + w * s, m - w * s], 1)


def filt(x, kind, f, order=2, zero_phase=False):
    sos = butter(order, f, kind, fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=0) if zero_phase else sosfilt(sos, x, axis=0)


def tv_filter(x, kind, points, t0=0.0, block=256):
    """A second-order filter whose corner moves along points (Hz), its state
    carried from block to block."""
    fc = curve(points, len(x), t0)
    y = np.zeros_like(x); zi = np.zeros((1, 2, x.shape[1]))
    for i in range(0, len(x), block):
        f = float(np.clip(fc[i], 20, SR / 2 - 200))
        sos = butter(2, f, kind, fs=SR, output="sos")
        y[i:i + block], zi = sosfilt(sos, x[i:i + block], axis=0, zi=zi)
    return y


def sat(x, drive):
    return np.tanh(x * drive) / np.tanh(drive)


def thicken(x, drive=4.0, above=180, mix=0.6):
    """Harmonics for a low sound, so a phone's speaker can tell it's there:
    the sound driven hard, only what's above `above` of that added back."""
    peak = np.abs(x).max() + 1e-9
    h = filt(sat(x / peak, drive) * peak, "highpass", above, 2)
    return x + mix * h


def loop_to(x, n, xf=0.6):
    """x repeated (equal-power crossfades of xf) to n samples."""
    if len(x) >= n: return x[:n].copy()
    k = n_of(xf); out = x.copy()
    w = np.linspace(0, np.pi / 2, k)[:, None]
    while len(out) < n:
        head = out[-k:] * np.cos(w) + x[:k] * np.sin(w)
        out = np.concatenate([out[:-k], head, x[k:]])
    return out[:n]


def glide(x, semis, dur):
    """x played at a rate that moves its pitch along semis [(t, semitones)]
    over dur seconds of output (a tape run faster or slower; looped first if
    it would run out)."""
    n = n_of(dur); rate = 2 ** (curve(semis, n) / 12)
    pos = np.concatenate([[0.0], np.cumsum(rate[:-1])])
    if pos[-1] + 2 >= len(x): x = loop_to(x, int(pos[-1]) + SR)
    i = pos.astype(int); f = (pos - i)[:, None]
    return x[i] * (1 - f) + x[i + 1] * f


def room(seed=3, secs=2.4, bright=6000, pre=0.012):
    """A dark, wide space: two channels of noise dying away (exponentially,
    the top going first), to convolve with."""
    rng = np.random.default_rng(seed); n = n_of(secs); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (secs / 6.9))[:, None]
    ir = tv_filter(ir, "lowpass", [(0, bright), (secs, 600)])
    ir = np.concatenate([np.zeros((n_of(pre), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum() / 2)


_rooms = {}


def verb(x, wet=0.3, secs=2.4, bright=6000, seed=3):
    key = (secs, bright, seed)
    if key not in _rooms: _rooms[key] = room(seed, secs, bright)
    ir = _rooms[key]
    w = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + w * wet * 0.35


def place(out, x, t, g=0.0):
    """x added into out from t (s), at g dB."""
    i = n_of(t)
    if i < 0: x = x[-i:]; i = 0
    j = min(len(out), i + len(x))
    if j > i: out[i:j] += x[:j - i] * dbv(g)


def bed(n): return np.zeros((n, 2))


# ---- the heart ----
_beats = None


def beats():
    """The heart's two sounds (lub, dub), each its own cut of Cloud-10's
    recording, faded, thickened for small speakers."""
    global _beats
    if _beats is None:
        h = load("heart")
        lub = fade(cut(h, 1.22, 1.47), 0.004, 0.08)
        dub = fade(cut(h, 1.55, 1.78), 0.004, 0.08)
        _beats = [at_peak(thicken(b, 5.0, 160, 0.9), -1.0) for b in (lub, dub)]
    return _beats


def heartbeat(n, t0, t1, bpm, level, muffle=None, skip=()):
    """The heart from t0 to t1 at bpm [(t, beats a minute)], level [(t, dB
    at its loudest)]; muffle: a low-pass corner [(t, Hz)]; skip: beats left
    out (their times, near enough)."""
    lub, dub = beats(); out = bed(n); t = t0
    while t < t1:
        b = float(np.interp(t, *zip(*bpm)))
        if not any(abs(t - s) < 0.2 for s in skip):
            g = float(np.interp(t, *zip(*level)))
            gap = float(np.interp(b, [55, 160], [0.33, 0.2]))
            place(out, lub, t, g)
            place(out, dub, t + gap, g - 3.5)
        t += 60.0 / b
    if muffle: out = tv_filter(out, "lowpass", muffle)
    return out


# ---- a tone that never stops rising ----
def shepard(n, rate, level, centre=380.0, spread=1.0, seed=5):
    """A Shepard-Risset glissando: tones an octave apart all gliding up at
    rate [(t, octaves a second)], each fading in at the bottom and out at
    the top (a bell of loudness round `centre`), two detuned voices a side.
    level [(t, dB)] of its RMS."""
    rng = np.random.default_rng(seed)
    r = curve(rate, n); up = np.cumsum(r) / SR
    out = bed(n); base, octs = 27.5, 9
    for side in range(2):
        for v, cents in enumerate((-6, 6)):
            ph0 = rng.uniform(0, 2 * np.pi, octs)
            acc = np.zeros(n)
            for k in range(octs):
                o = (k + up + v * 0.002) % octs
                f = base * 2 ** o * 2 ** ((cents + (3 if side else -3)) / 1200)
                a = np.exp(-0.5 * (np.log2(f / centre) / spread) ** 2)
                ph = ph0[k] + np.cumsum(2 * np.pi * f / SR)
                acc += a * (np.sin(ph) + 0.25 * np.sin(2 * ph + 0.3))
            out[:, side] += acc
    out = at_rms(out, -20)
    return gain(out, [(t, d + 20) for t, d in level])


def noise_riser(n, t0, t1, f0, f1, level, seed=9):
    """Noise through a band rising from f0 to f1 between t0 and t1, its
    level [(t, dB)]."""
    rng = np.random.default_rng(seed); x = rng.standard_normal((n, 2)) * 0.2
    x = tv_filter(x, "lowpass", [(t0, f0 * 1.6), (t1, f1 * 1.6)])
    x = tv_filter(x, "highpass", [(t0, f0 * 0.6), (t1, f1 * 0.6)])
    return gain(at_rms(x, -20), [(t, d + 20) for t, d in level])


def duck_mid(x, t0, t1, d, lo=300, hi=5000):
    """The middle (where the shout is) taken down by d dB from t0 to t1,
    eased in and out over 0.15 s."""
    band = filt(filt(x, "highpass", lo, 2, True), "lowpass", hi, 2, True)
    k = curve([(t0 - 0.15, 0), (t0, 1), (t1, 1), (t1 + 0.1, 0)], len(x))
    return x - band * (1 - dbv(-d)) * k[:, None]


def end_at(x, t, f=0.03):
    """Silent from t (the white), a short fade into it."""
    x = x.copy(); i = n_of(t); k = n_of(f)
    x[i:] = 0
    x[max(0, i - k):i] *= np.linspace(1, 0, min(k, i))[:, None]
    return x


def lift(points, d, until, ease=0.6):
    """Level points [(t, dB)] d dB louder up to `until`, as they were from
    `ease` s after."""
    return [(t, v + d * float(np.clip((until + ease - t) / ease, 0, 1))) for t, v in points]


def drone(key, a, b, dur, semis, level, lp=None, hp=None, wide=1.0, thick=0.0):
    """A drone: key's [a, b] looped to fill, pitch along semis, its RMS
    along level [(t, dB)], a moving low-pass; thick: harmonics added (for
    small speakers)."""
    x = cut(load(key), a, b)
    x = glide(x, semis, dur)
    if thick: x = thicken(x, 3.0, 250, thick)
    if hp: x = filt(x, "highpass", hp, 2)
    if lp: x = tv_filter(x, "lowpass", lp)
    x = width(at_rms(x, -20), wide)
    return gain(x, [(t, d + 20) for t, d in level])


def hit(key, a=0.0, b=None, semis=0.0, peak=-6.0, lp=None, hp=None, thick=0.0):
    x = cut(load(key), a, b)
    if semis: x = glide(x, [(0, semis)], len(x) / SR / 2 ** (semis / 12) - 0.01)
    if hp: x = filt(x, "highpass", hp, 2)
    if lp: x = filt(x, "lowpass", lp, 2)
    if thick: x = thicken(x, 4.0, 160, thick)
    return at_peak(fade(x, 0.002, 0.15), peak)


def riser_into(key, at_end, length, peak, semis=0.0, src_end=None):
    """A reversed cymbal (or any swell) whose end lands on at_end: its last
    `length` seconds (up to src_end in the recording)."""
    x = load(key); e = src_end if src_end is not None else len(x) / SR
    x = cut(x, max(0, e - length), e)
    if semis: x = glide(x, [(0, semis)], len(x) / SR / 2 ** (semis / 12) - 0.01)
    return at_end - len(x) / SR, at_peak(fade(x, 0.3, 0.01), peak)


# ---- the sets ----
def set1(T, drag):
    """Heartbeat."""
    n = n_of(T["end"] + 0.3); out = bed(n); e = T["end"]
    D, R, E = T["door"], T["reveal"], T["erupt"]
    if not drag:
        semis = [(0, -2), (D, 0), (R, 2), (T["still"], 2), (E, 3), (e, 14)]
        lvl = [(0, -42), (3, -34), (D, -28), (R, -25), (T["still"], -27), (10.8, -40), (11.8, -34), (E, -24), (15.4, -17), (e, -15)]
        lp = [(0, 1200), (D, 2400), (R, 4500), (T["still"], 3000), (10.8, 900), (E, 5000), (e, 9000)]
        lvl = lift(lvl, 5, T["still"])
        heart = heartbeat(n, 1.1, e, [(1.1, 58), (4, 70), (D, 88), (R, 104), (T["still"], 100), (11.6, 96), (E, 132), (14.5, 150)],
                          lift([(1.1, -40), (4, -33), (D, -27), (R, -24), (T["still"], -18), (11.6, -17), (E, -24), (14.4, -30), (15.5, -40)], 2.5, T["still"] - 0.6), skip=(12.05,))
    else:
        semis = [(0, 0), (D, 4), (R, 6), (E, 8), (e, 16)]
        lvl = [(0, -30), (D, -24), (R, -21), (E, -20), (8.8, -16), (e, -14)]
        lp = [(0, 1800), (D, 4500), (E, 6000), (e, 10000)]
        heart = heartbeat(n, 0.15, e, [(0, 118), (D, 146), (E, 165), (e, 175)], [(0, -27), (D, -23), (E, -24), (8.4, -32), (9.5, -42)])
    dr = drone("werra", 2.0, 23.0, e + 0.3, semis, lvl, lp=lp, hp=40, wide=1.2, thick=0.5)
    if drag: dr = sat(dr * 1.6, 1.8) / 1.6
    out += dr
    sub = drone("harmonic", 0.5, 18.5, e + 0.3, [(0, 0)], [(t, d - 4) for t, d in lvl], lp=[(0, 180)])
    out += sub
    out += heart
    # Into the doorframe, and the hit.
    t, x = riser_into("revcrash", D, 2.2 if not drag else 1.4, -22, src_end=8.46); place(out, x, t)
    place(out, hit("boom", peak=-9, thick=0.5), D)
    place(out, hit("lowhit", peak=-12), D)
    # The rift in view: the braam (its swell lands on the moment).
    place(out, hit("braamhit", peak=-8, thick=0.4), R - 0.765)
    if not drag:
        # The calm: a thin glass whine over the heart.
        g = drone("glass", 2.0, 14.0, e + 0.3, [(0, 7)], [(0, -80), (T["still"], -60), (10.8, -38), (E - 0.3, -36), (E, -60)], lp=[(0, 6000)])
        out += g
    # Into the eruption: a reversed glass rising into it, then it all.
    t, x = riser_into("revglass", E, 1.3, -18); place(out, x, t)
    place(out, hit("braam", peak=-5, thick=0.4), E)
    place(out, hit("impact", 0.9, None, peak=-9), E - 0.3)
    rum = drone("rumble", 2.0, 40.0, e + 0.3, [(0, 0)], [(0, -90), (E - 0.05, -90), (E, -24), (e, -15)], lp=[(0, 300)])
    out += rum
    out += noise_riser(n, E, e, 400, 7000, [(0, -90), (E, -40), (e - 0.4, -19), (e, -17)])
    return finish(out, T)


def set2(T, drag):
    """The house turns."""
    n = n_of(T["end"] + 0.3); out = bed(n); e = T["end"]
    D, R, E = T["door"], T["reveal"], T["erupt"]
    if not drag:
        semis = [(0, -5), (D, -6), (R, -7), (T["still"], -8), (E, -8), (e, 2)]
        lvl = lift([(0, -40), (3, -33), (D, -28), (R, -25), (T["still"], -30), (11.4, -32), (E, -22), (e, -16)], 4, T["still"])
    else:
        semis = [(0, -6), (D, -8), (E, -9), (e, 3)]
        lvl = [(0, -29), (D, -24), (E, -20), (e, -15)]
    dr = drone("bowedrone", 2.0, 47.0, e + 0.3, semis, lvl, lp=[(0, 1600), (D, 2400), (e, 6000)], hp=35, wide=1.3, thick=0.5)
    # (It breathes: a slow swell, deeper as it goes.)
    breath = 1 + curve([(0, 0.15), (R, 0.35), (e, 0.2)], n_of(e + 0.3)) * np.sin(2 * np.pi * (0.16 if not drag else 0.32) * np.arange(n_of(e + 0.3)) / SR - np.pi / 2)
    out += dr * breath[:, None]
    out += drone("rumble3", 5.0, 40.0, e + 0.3, [(0, 0)], [(t, d - 3) for t, d in lvl], lp=[(0, 220)])
    # The heart, low and close.
    if not drag: out += heartbeat(n, 2.0, e, [(2, 56), (D, 74), (R, 84), (E, 120)], lift([(2, -42), (D, -33), (R, -30), (T["still"], -27), (E, -32), (14.5, -44)], 2, T["still"] - 0.6), muffle=[(0, 900)])
    else: out += heartbeat(n, 0.3, e, [(0, 104), (D, 128), (e, 150)], [(0, -30), (D, -27), (E, -30), (9, -42)], muffle=[(0, 900)])
    # The house round you: creaks and groans, pitched down, in a room.
    creak = lambda a, b, s, p, g, pk: pan(verb(hit("creaks", a, b, semis=s, peak=pk, hp=90), 0.45, 2.8, 5000), p)
    groan = lambda a, b, s, p, pk: pan(verb(hit("door", a, b, semis=s, peak=pk, hp=70, lp=4000), 0.5, 3.2, 4000), p)
    if not drag:
        place(out, creak(4.6, 6.9, -4, -0.7, 0, -30), 1.6)
        place(out, groan(3.0, 6.5, -6, 0.6, -29), 3.6)
        place(out, creak(9.6, 11.8, -5, 0.2, 0, -26), 5.4)
        place(out, groan(8.0, 12.0, -7, 0.5, -26), R - 1.4)
        place(out, groan(14.0, 19.5, -9, -0.4, -27), 10.4)
        place(out, creak(12.5, 14.5, -6, 0.7, 0, -28), 11.7)
    else:
        place(out, creak(4.6, 6.9, -3, -0.7, 0, -26), 0.6)
        place(out, groan(3.0, 6.5, -5, 0.6, -24), 1.9)
        place(out, creak(9.6, 11.8, -4, 0.3, 0, -23), 3.0)
        place(out, groan(8.0, 12.0, -6, -0.5, -22), R - 1.0)
    # The doorframe cracking: the metal's snap pitched down, the boom.
    place(out, pan(hit("metal", 0.0, 1.2, semis=-5, peak=-12, hp=100), 0.4), D - 0.02)
    place(out, hit("boom", peak=-10, thick=0.5), D)
    # The rift: the brass braam and a big door's groan.
    place(out, hit("brass", peak=-8, thick=0.4), R - 0.05)
    place(out, pan(verb(hit("bigdoor", 1.2, 4.6, semis=-5, peak=-20, hp=80), 0.5, 3.0, 4000), -0.3), R + 0.1)
    # The eruption: a creak run backwards into it, the braam, the rumble.
    rc = hit("creaks", 9.6, 11.8, semis=-3, peak=-18, hp=90)[::-1]
    place(out, verb(rc, 0.4), E - len(rc) / SR)
    place(out, hit("braam", peak=-5, thick=0.4), E)
    place(out, hit("lowhit", peak=-10), E)
    out += drone("rumble", 2.0, 40.0, e + 0.3, [(0, 0)], [(0, -90), (E - 0.05, -90), (E, -23), (e, -15)], lp=[(0, 300)])
    out += noise_riser(n, E, e, 250, 5000, [(0, -90), (E, -42), (e - 0.4, -20), (e, -18)])
    return finish(out, T)


def set3(T, drag):
    """Shepard."""
    n = n_of(T["end"] + 0.3); out = bed(n); e = T["end"]
    D, R, E, St = T["door"], T["reveal"], T["erupt"], T["still"]
    if not drag:
        rate = [(0, 0.05), (D, 0.12), (R, 0.2), (St, 0.25), (E, 0.3), (e, 0.75)]
        lvl = lift([(0, -40), (3, -33), (D, -28), (R, -24), (St - 0.05, -23)], 7, St) + [(St, -90), (11.6, -90), (12.2, -40), (E, -24), (e, -15)]
    else:
        rate = [(0, 0.2), (D, 0.35), (E, 0.5), (e, 0.9)]
        lvl = [(0, -29), (D, -24), (E, -21), (e, -14)]
    sh = shepard(n, rate, lvl, centre=420 if not drag else 520)
    if not drag:
        # (Stopping dead: the last 0.3 s before it drops away, its pitch falling.)
        sh[n_of(St):] *= 0
    out += verb(sh, 0.25, 2.0, 7000)
    # Sub pulses with the heart, and the heart.
    hb = [(1.5, 60), (D, 84), (R, 100), (St, 92), (E, 140)] if not drag else [(0, 120), (D, 150), (e, 172)]
    hl = lift([(1.5, -40), (D, -32), (R, -30), (St, -24), (E, -28), (14.5, -40)], 2, St - 0.6) if not drag else [(0, -30), (D, -27), (E, -30), (9, -42)]
    out += heartbeat(n, 1.5 if not drag else 0.2, e, hb, hl)
    pulse = bed(n); t = 1.5 if not drag else 0.2
    while t < e:
        b = float(np.interp(t, *zip(*hb)))
        k = np.arange(n_of(0.22)) / SR
        th = np.sin(2 * np.pi * (50 + 30 * np.exp(-k / 0.03)) * k) * np.exp(-k / 0.07)
        place(pulse, np.stack([th, th], 1), t, float(np.interp(t, *zip(*hl))) + 1)
        t += 60 / b
    out += thicken(pulse, 3.0, 150, 0.5)
    # The doorframe: a sharp metal snap and the boom.
    place(out, pan(hit("metal", 0.0, 0.9, semis=2, peak=-14, hp=200), -0.3), D - 0.01)
    place(out, hit("boom", peak=-10, thick=0.5), D)
    # The rift: bowed metal swelling up to it, then the braam.
    bm = verb(hit("bowedlow", 0.6, 6.0, semis=1, peak=-16), 0.4, 3.0, 6000)
    if not drag: bm = gain(bm, [(0, 0), (St - R + 1.8, 0), (St - R + 2.1, -60)])
    place(out, bm, R - 2.0)
    place(out, hit("braamhit", peak=-9, thick=0.4), R - 0.765)
    if not drag:
        # The calm: nothing but the heart and a faint ring.
        out += drone("glass", 2.0, 14.0, e + 0.3, [(0, 12)], [(0, -90), (St + 0.4, -90), (11.0, -42), (E, -40), (E + 0.2, -90)], lp=[(0, 7000)])
    t, x = riser_into("revcrash", E, 1.6 if not drag else 1.0, -18, src_end=8.46); place(out, x, t)
    place(out, hit("braam", peak=-5, thick=0.4), E)
    place(out, hit("impact", 0.9, None, peak=-10), E - 0.3)
    out += drone("rumble2", 1.0, 29.0, e + 0.3, [(0, 0)], [(0, -90), (E - 0.05, -90), (E, -24), (e, -16)], lp=[(0, 260)])
    return finish(out, T)


def set4(T, drag):
    """Pressure."""
    n = n_of(T["end"] + 0.3); out = bed(n); e = T["end"]
    D, R, E, St = T["door"], T["reveal"], T["erupt"], T["still"]
    if not drag:
        lvl = lift([(0, -40), (3, -32), (D - 0.05, -27), (D, -34), (R, -25), (St, -30), (10.6, -48), (11.6, -44), (E, -24), (e, -16)], 1.5, St)
        muffle = [(0, 3000), (D - 0.3, 900), (D, 260), (D + 0.6, 260), (R - 0.4, 1800), (R, 3200), (St, 1500), (10.6, 400), (E, 5000), (e, 9000)]
    else:
        lvl = [(0, -29), (D - 0.05, -23), (D, -30), (R, -22), (E, -20), (e, -14)]
        muffle = [(0, 2000), (D - 0.2, 700), (D, 250), (D + 0.4, 260), (R, 2500), (E, 5000), (e, 9000)]
    # The pressure: rumble and a low band of noise, swelling; all of it
    # muffled more and more, as if your ears were filling.
    p = drone("rumble2", 1.0, 29.0, e + 0.3, [(0, 0)], [(t, d + 2) for t, d in lvl], lp=[(0, 300)])
    p += drone("uneasy", 0.2, 15.5, e + 0.3, [(0, -2), (R, 1), (e, 6)], lvl, hp=40)
    p += noise_riser(n, 0, e, 120, 700, [(t, d - 2) for t, d in lvl], seed=4)
    out += tv_filter(p, "lowpass", muffle)
    # The heart, inside your head.
    hb = [(1.2, 64), (D, 86), (R, 98), (St, 96), (E, 136)] if not drag else [(0, 116), (D, 148), (e, 170)]
    hl = lift([(1.2, -38), (D, -30), (R, -28), (St, -22), (E, -27), (14.5, -40)], 1, St - 0.6) if not drag else [(0, -28), (D, -25), (E, -29), (9, -42)]
    out += heartbeat(n, 1.2 if not drag else 0.2, e, hb, hl, muffle=[(0, 700)])
    # The ringing: two thin tones, the higher wavering.
    k = np.arange(n) / SR
    ring = 0.5 * np.sin(2 * np.pi * 6200 * k + 0.4 * np.sin(2 * np.pi * 0.7 * k)) + 0.3 * np.sin(2 * np.pi * 3100 * k)
    rl = [(0, -90), (3, -60), (D, -46), (R, -44), (St, -40), (10.6, -34), (E, -36), (E + 0.3, -90)] if not drag else [(0, -70), (D, -42), (E, -38), (E + 0.3, -90)]
    out += gain(np.stack([ring, ring * 0.9], 1) * 0.5, [(t, d + 6) for t, d in rl])
    # The doorframe: the ears pop (the pop on the moment), a dull thump.
    t, x = riser_into("suction", D, 1.4, -14, src_end=2.29); place(out, x, t)
    place(out, hit("suction", 2.24, 2.46, peak=-12), D - 0.04)
    place(out, hit("lowhit", peak=-11), D)
    # The rift: a reversed glass rising into a glass sting, and a braam.
    t, x = riser_into("revglass", R, 1.2, -16); place(out, x, t)
    place(out, hit("glass", 0.0, 5.0, semis=5, peak=-15, hp=300), R)
    place(out, hit("brass", peak=-10, thick=0.4), R)
    # The eruption: the pressure let go all at once.
    t, x = riser_into("revcrash", E, 1.4 if not drag else 0.9, -17, src_end=8.46); place(out, x, t)
    place(out, hit("braam", peak=-5, thick=0.4), E)
    place(out, hit("impact", 0.9, None, peak=-9), E - 0.3)
    out += noise_riser(n, E, e, 500, 8000, [(0, -90), (E, -30), (e - 0.4, -18), (e, -17)], seed=11)
    return finish(out, T)


def set5(T, drag):
    """Live wire."""
    n = n_of(T["end"] + 0.3); out = bed(n); e = T["end"]
    D, R, E, St = T["door"], T["reveal"], T["erupt"], T["still"]
    if not drag:
        semis = [(0, -1), (D, 1), (R, 3), (St, 3), (E, 4), (e, 14)]
        lvl = lift([(0, -40), (3, -33), (D, -28), (R, -25), (St, -28), (10.6, -42), (11.8, -38), (E, -24), (e, -16)], 2, St)
    else:
        semis = [(0, 1), (D, 4), (E, 6), (e, 16)]
        lvl = [(0, -29), (D, -24), (E, -21), (e, -15)]
    hum = drone("transformer", 1.0, 27.0, e + 0.3, semis, lvl, lp=[(0, 2400), (R, 5000)], hp=60, wide=1.2)
    drive = curve([(0, 1.2), (D, 2.5), (R, 4.0), (E, 6.0)] if not drag else [(0, 3.0), (E, 7.0)], len(hum))
    pk = np.abs(hum).max() + 1e-9
    hum = np.tanh(hum / pk * drive[:, None]) / np.tanh(drive[:, None]) * pk
    # (Now and then it drops out, like a bad connection, more as it goes.)
    rng = np.random.default_rng(21); gate = np.ones(len(hum)); t = 2.0
    while t < e - 0.5:
        if t > (5.0 if not drag else 1.0): gate[n_of(t):n_of(t + rng.uniform(0.03, 0.09))] = 0.15
        t += rng.uniform(0.25, 1.1) if not drag else rng.uniform(0.12, 0.5)
    gate = np.convolve(gate, np.ones(64) / 64, "same")
    out += hum * gate[:, None]
    out += drone("buzz", 1.5, 20.0, e + 0.3, [(0, 0)], [(t, d - 8) for t, d in lvl], hp=50)
    out += drone("harmonic", 0.5, 18.5, e + 0.3, [(0, 0)], [(t, d - 5) for t, d in lvl], lp=[(0, 180)])
    # The crackle gathering: the recording gated in bursts, denser and denser.
    cr = loop_to(cut(load("crackle"), 0.5, 17.0), n)
    env = np.zeros(n); t = 0.8 if not drag else 0.1
    while t < e:
        d = rng.uniform(0.04, 0.25); env[n_of(t):n_of(t + d)] = 1
        t += float(np.interp(t, [0, D, E, e], [1.4, 0.6, 0.25, 0.08] if not drag else [0.4, 0.2, 0.1, 0.06])) * rng.uniform(0.5, 1.5)
    env = np.convolve(env, np.ones(220) / 220, "same")
    out += gain(at_rms(cr, -20) * env[:, None], [(t, d - 2) for t, d in lvl])
    # The flicker of a dying tube, at first.
    place(out, gain(at_rms(cut(load("tube"), 0.3, 6.0), -36), [(0, 0), (4.0, 0), (5.7, -30)]), 0.4 if not drag else 0.0)
    # The heart.
    hb = [(1.6, 62), (D, 84), (R, 100), (St, 96), (E, 134)] if not drag else [(0, 118), (D, 146), (e, 170)]
    hl = lift([(1.6, -40), (D, -31), (R, -29), (St, -23), (E, -28), (14.5, -40)], 1, St - 0.6) if not drag else [(0, -28), (D, -25), (E, -29), (9, -42)]
    out += heartbeat(n, 1.6 if not drag else 0.15, e, hb, hl)
    # The hits are arcs: a burst of the sharp crackle with each.
    arc = lambda a, pk: at_peak(fade(cut(load("crackhi"), a, a + 0.5), 0.002, 0.25), pk)
    place(out, arc(2.0, -11), D - 0.03)
    place(out, hit("boom", peak=-10, thick=0.5), D)
    place(out, arc(6.0, -9), R - 0.05)
    place(out, hit("braamhit", peak=-9, thick=0.4), R - 0.765)
    t, x = riser_into("revcrash", E, 1.5 if not drag else 1.0, -18, src_end=8.46); place(out, x, t)
    place(out, arc(9.5, -8), E - 0.02)
    place(out, hit("braam", peak=-5, thick=0.4), E)
    place(out, hit("impact", 0.9, None, peak=-10), E - 0.3)
    out += drone("rumble", 2.0, 40.0, e + 0.3, [(0, 0)], [(0, -90), (E - 0.05, -90), (E, -24), (e, -16)], lp=[(0, 300)])
    return finish(out, T)


SETS = {1: set1, 2: set2, 3: set3, 4: set4, 5: set5}
# Each set's level (dB), so that walked in, all of it together (the game's
# own sounds with it) is about as loud whichever it is.
TRIM = {1: (-4.5, -4.2), 2: (-4.6, -3.9), 3: (-2.8, -1.6), 4: (-5.0, -3.5), 5: (-7.4, -5.7)}
NAMES = {1: "Heartbeat", 2: "The house turns", 3: "Shepard", 4: "Pressure", 5: "Live wire"}


def finish(out, T):
    """Room for the shout (its preverb and the shout itself), and silent
    from the white on."""
    out = duck_mid(out, T["pre"] + 0.6, T["scream"], 4)
    out = duck_mid(out, T["scream"] - 0.1, T["end"], 10)
    out = gain(out, [(0, 0), (T["scream"] - 0.25, 0), (T["scream"] - 0.05, -4)])
    return end_at(out, T["end"])


def limit(x, ceiling=-1.5, look=0.003, release=0.08):
    """Only the peaks over `ceiling` (dBFS) brought down to it: a gain that
    comes down a little ahead of each (look) and comes back up slowly."""
    thr = dbv(ceiling); a = np.abs(x).max(1)
    need = np.minimum(1.0, thr / np.maximum(a, 1e-9))
    k = n_of(look)
    need = np.minimum.reduce([np.roll(need, -i) for i in range(0, k + 1, max(1, k // 8))])
    g = np.empty_like(need); r = np.exp(-1 / (release * SR)); cur = 1.0
    for i in range(len(need)):
        cur = need[i] if need[i] < cur else need[i] + (cur - need[i]) * r
        g[i] = cur
    return x * g[:, None]


def write(x, path, q=4):
    x = np.concatenate([np.zeros((n_of(LEAD), 2)), x])
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        sf.write(wav, x, SR, subtype="PCM_16")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", str(q), path], check=True)
    print(f"{path}: {len(x) / SR:.2f} s, {os.path.getsize(path) // 1024} KB, peak {peak_db(x):.1f} dBFS")


def render(k, folder, names=("dread-walk.mp3", "dread-drag.mp3"), wavs=False):
    os.makedirs(folder, exist_ok=True)
    for T, drag, name in ((WALK, False, names[0]), (DRAG, True, names[1])):
        x = fade(limit(SETS[k](T, drag) * dbv(TRIM[k][drag]), -1.5), 0.02, 0.0)
        # (The first sound at once: den-hall.js takes it for the click.)
        x[:n_of(0.004)] += 3e-4 * np.sign(np.sin(np.arange(n_of(0.004)) * 0.7))[:, None]
        if wavs: sf.write(os.path.join(folder, name.replace(".mp3", ".wav")), x, SR, subtype="FLOAT")
        write(x, os.path.join(folder, name))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", type=int, default=SET)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--wavs", action="store_true")
    a = ap.parse_args()
    if a.all:
        for k in SETS: render(k, os.path.join(a.out, f"set{k}"), ("el-cabeza-hall-dread-walk.mp3", "el-cabeza-hall-dread-drag.mp3"), a.wavs)
    else:
        render(a.set, a.out or OUT, wavs=a.wavs)


if __name__ == "__main__":
    main()
