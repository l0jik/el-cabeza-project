"""The hall's recorded sounds round the dread (themes/den-hall.js; the
dread itself, tools/hall_dread.py), from the recordings in assets/hall/src/
(CREDITS.md says whose each is). The man reacting all the way and the
things knocked over (set 5 of five, then "We have to redo the sound for the
walking to the hallway animation. I don't like it": "His voice, The
crashing things") are gone; what's left:

  scream.mp3  his shout as he's taken, LittleRobotSoundFactory's
              "Scream_Male_03", LEAD in.
  field.mp3   humanoide9000's "Force Field": a hum with pulses that come
              faster, a seamless 20 s loop (padded as Noir's loops are).
  pre.mp3     the shout's preverb (user: "Add 1.7 sec. preverb to all ending
              yells before being sucked into the void"): the shout's own
              echo room (den-hall.js echoRoom's recipe) run backwards, so it
              swells up into the shout for PRE seconds, the mirror of the
              echo it rings with after. Stereo, PRE_LEAD of silence first.

Every cut has a short fade in and out, a high-pass under the voice's
lowest (80 Hz), and its loudest 0.3 s at -14 dBFS (the loop: its average
at -20); the game sets the mix.

    FFMPEG=/path/to/ffmpeg python3 tools/hall_sounds.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, sosfilt, sosfiltfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/hall/src")
OUT = os.path.join(ROOT, "assets/hall")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 44100
PAD = 0.3
# Where the shout starts (themes/den-hall.js reads the same): LEAD seconds
# in, so a decoder's own silence at the very start never cuts into it.
SLOT, LEAD = 2.5, 0.1
# The preverb (themes/den-hall.js PRE, PRE_LEAD).
PRE, PRE_LEAD = 1.7, 0.1

# name, file, from, to (seconds in the recording)
SCREAM = ("scream", "littlerobotsoundfactory-scream-male-03-270474.ogg", 0.0, 1.11)


def load(name):
    """A source, decoded at 44.1 kHz, as mono."""
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", "2", wav], check=True)
        x, _ = sf.read(wav, always_2d=True)
    return x.mean(1)


def cut(x, a, b):
    if a is None: return x.copy()
    return x[int(a * SR):int(b * SR)].copy()


def hp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def fades(x, fin, fout):
    x = x.copy()
    a, b = int(fin * SR), int(min(fout, len(x) / SR / 3) * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x


def loudest(x, secs=0.3):
    n = max(1, int(secs * SR))
    if len(x) <= n: return np.sqrt(np.mean(x ** 2))
    c = np.cumsum(np.concatenate([[0.0], x ** 2]))
    return np.sqrt((c[n:] - c[:-n]).max() / n)


def at_db(x, db, level):
    return x * (10 ** (db / 20) / level)


def write(x, name, q):
    """Variable bit rate (LAME -q `q`): the slots' silence costs next to
    nothing."""
    path = os.path.join(OUT, name)
    peak = np.abs(x).max()
    if peak > 0.98: x = x * (0.98 / peak)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        sf.write(wav, x, SR, subtype="PCM_16")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", str(q), path], check=True)
    print(f"{path}: {len(x) / SR:.2f} s, {os.path.getsize(path) // 1024} KB")


def take(t, hp_at):
    """One take, cut, high-passed, faded and levelled (and, far off, low-
    passed after, so it's quieter for it)."""
    name, f, a, b = t[:4]
    fin, fout = (t[4], t[5]) if len(t) > 5 else (0.01, 0.08)
    x = fades(hp(cut(load(f), a, b), hp_at), fin, fout)
    x = at_db(x, -14, loudest(x))
    if len(t) > 6: x = sosfilt(butter(2, t[6], "lowpass", fs=SR, output="sos"), x)
    return x


def slotted(takes, slot, hp_at):
    """Each take in its own `slot` seconds, LEAD in."""
    out = np.zeros(int(slot * SR * len(takes)))
    made = {}
    for i, t in enumerate(takes):
        x = take(t, hp_at)
        assert len(x) <= (slot - LEAD - 0.05) * SR, (t[0], len(x) / SR)
        s = int((i * slot + LEAD) * SR)
        out[s:s + len(x)] = x
        made[t[0]] = x
        print(f"  {t[0]:8s} slot {i}: {len(x) / SR:.2f} s")
    return out, made


def echo_room(seed=7):
    """den-hall.js echoRoom, made the same way (its random wash seeded): a
    wash of noise dying away and darkening, echoes in it going from side to
    side, each fainter and duller, 1.7 s long, its last 0.15 s faded out,
    scaled to unit energy."""
    rng = np.random.default_rng(seed); E = 1.7; n = int(round(E * SR)); gap = 0.21
    echoes = [gap * (j + 1) for j in range(int(1.6 / gap))]; room = np.zeros((2, n)); peak = 0
    for c in range(2):
        x = rng.uniform(-1, 1, n); t = np.arange(n) / SR; w = 1 - t / E
        bright = lfilter([0.6], [1, -0.4], x); dark = lfilter([0.12], [1, -0.88], x)
        d = 0.45 * (bright * w + 2.2 * dark * (1 - w)) * np.exp(-t / 0.95)
        for j, at in enumerate(echoes):
            g = 0.55 * 0.84 ** j * (1 if j % 2 == c else 0.42)
            fc = 5000 - 3800 * j / (len(echoes) - 1); a = np.exp(-2 * np.pi * fc / SR); i0 = int(round(at * SR))
            k = np.arange(min(400, n - i0)); d[i0:i0 + len(k)] += 30 * g * (1 - a) * a ** k
        fN = int(round(0.15 * SR)); d[n - fN:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(fN) / fN)
        room[c] = d; peak = max(peak, np.sqrt((d ** 2).sum()))
    return room / peak


def preverb(shout):
    """The shout's preverb, as den-hall.js plays the shout (LEAD in, 0.05 s
    after): the shout run backwards through its echo room and turned round
    again, sent most from its start (1 down to 0.3 over it; the echo after
    is sent most from its end), at 0.75, rising straight from nothing over
    the PRE seconds before the shout, on top of the room's own swell; at its
    height about 6 dB under the shout. Stereo, PRE_LEAD of silence first:
    played from PRE + PRE_LEAD before the shout's take starts, it ends with
    it."""
    x = np.concatenate([np.zeros(int(LEAD * SR)), shout, np.zeros(int(0.05 * SR))])
    send = np.interp(np.arange(len(x)) / SR, [LEAD, LEAD + len(shout) / SR], [1.0, 0.3])
    room = echo_room()
    wet = np.stack([np.convolve((x * send)[::-1], room[c])[::-1] for c in range(2)], 1) * 0.75
    back = room.shape[1] - 1
    wet *= np.clip((np.arange(len(wet)) - int(LEAD * SR)) / back, 0, 1)[:, None]
    return np.concatenate([np.zeros((int(PRE_LEAD * SR), 2)), wet])


def loop_of(seg, length, xf):
    """seg (length + xf long) made a seamless loop `length` long: its last
    xf crossfaded (equal power) over its first."""
    n, x = int(length * SR), int(xf * SR)
    w = np.linspace(0, np.pi / 2, x)
    head = seg[n:n + x] * np.cos(w) + seg[:x] * np.sin(w)
    return np.concatenate([head, seg[x:n]])


def padded(loop):
    p = int(PAD * SR)
    return np.concatenate([loop[-p:], loop, loop[:p]])


def main():
    print("scream"); v, made = slotted([SCREAM], SLOT, 80); write(v, "scream.mp3", 4)
    # The preverb comes from the shout as it was cut, at the level it's
    # in its file.
    print("pre"); write(preverb(made["scream"]), "pre.mp3", 4)
    # The field: 3-25 s of it (past its own start, before its end), a 20 s
    # loop with a 2 s crossfade, its average at -20 dBFS.
    f = hp(cut(load("humanoide9000-force-field-422245.ogg"), 3.0, 25.0), 40)
    loop = loop_of(f, 20.0, 2.0)
    write(padded(at_db(loop, -20, np.sqrt(np.mean(loop ** 2)))), "field.mp3", 5)


if __name__ == "__main__":
    main()
