"""The hall's recorded sounds: the pull down the hall (themes/den-hall.js),
as the user chose it from five whole sets (set 5: "Let's go with number 5
for the hull pull, but that glass break right near the very end, we need to
remove that and lower the ruckus just a hair"), made from the recordings in
assets/hall/src/ (CREDITS.md says whose each is):

  voice.mp3   the man, one voice throughout, no grunting and no panting
              (user: "Less grunting, less panting... More surprise and
              ruckus sounds"): dersuperanton's reactions, "Huh?", "Hey!",
              "Wow!", "Ahhh!", "Uh-oh" and a hit as he's thrown against the
              doorframe; and his shout as he's taken, LittleRobotSoundFactory's
              "Scream_Male_03". Each take in its own VOICE_SLOT seconds.
  things.mp3  the force taking hold (LilMati's force field swell) and what
              it throws about on the way, each in its own THING_SLOT
              seconds: the table shaking, a tray of things, a whoosh, tins,
              papers, metal coming down, a pot in the kitchen (far off: low-
              passed here), the chair, a box, boards, the vase, the body
              against the doorframe and a hand slapping it, a stumble, a
              swoosh, a wooden thing settling, tins far off; and at the
              eruption, wood smashing, debris and a rush past.
  field.mp3   humanoide9000's "Force Field": a hum with pulses that come
              faster, a seamless 20 s loop (padded as Noir's loops are).
  pre.mp3     the shout's preverb (user: "Add 1.7 sec. preverb to all ending
              yells before being sucked into the void"): the shout's own
              echo room (den-hall.js echoRoom's recipe) run backwards, so it
              swells up into the shout for PRE seconds, the mirror of the
              echo it rings with after. Stereo, PRE_LEAD of silence first.

Every cut has a short fade in and out, a high-pass under the voice's
lowest (80 Hz; 50 for the things), and its loudest 0.3 s at -14 dBFS
(the loop: its average at -20); the game sets the mix.

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
# Where each take sits (themes/den-hall.js reads the same slots): it starts
# LEAD seconds into its slot, so a decoder's own silence at the very start
# never cuts into it.
VOICE_SLOT, THING_SLOT, LEAD = 2.5, 4.0, 0.1
# The preverb (themes/den-hall.js PRE, PRE_LEAD).
PRE, PRE_LEAD = 1.7, 0.1

VOICE = [  # name, file, from, to (seconds in the recording; None: all of it)
    ("huh", "dersuperanton-huh-eh-man-437649.ogg", None, None),
    ("hey", "dersuperanton-hey-voice-434463.ogg", None, None),
    ("wow", "dersuperanton-wow-voice-437660.ogg", None, None),
    ("ahh", "dersuperanton-ahhh-surprise-man-voice-437663.ogg", None, None),
    ("uhoh", "dersuperanton-cartoon-oh-oh-435883.ogg", None, None),
    ("hit", "dersuperanton-getting-hit-damage-scream-437650.ogg", None, None),
    ("scream", "littlerobotsoundfactory-scream-male-03-270474.ogg", 0.0, 1.11),
]
THINGS = [  # name, file, from, to, fade in, fade out[, low-pass: far off]
    ("engage", "lilmati-force-field-01-702771.ogg", 0.00, 3.00, 0.01, 0.6),
    ("table", "yannsauvin-dinner-table-shaking-778107.ogg", 2.40, 5.80, 0.4, 0.8),
    ("tray", "rossbell-wooden-tray-objects-falling-389430.ogg", 0.30, 2.40, 0.005, 0.4),
    ("whoosh", "henkonen-whooshes-757256.ogg", 0.15, 0.45, 0.005, 0.1),
    ("cans", "jho3000-cans-in-a-pile-falling-693515.ogg", 0.55, 2.10, 0.005, 0.3),
    ("papers", "mickdow-paper-flutter-320913.ogg", 14.00, 17.20, 0.3, 0.9),
    ("metal", "craigsmith-metal-objects-hitting-and-fall-675477.ogg", 0.60, 2.60, 0.005, 0.4),
    ("pot", "daddoit-pot-crash-50048.ogg", 0.45, 4.20, 0.005, 0.6, 3200),
    ("chair", "kyles-chair-scrape-455673.ogg", 1.90, 4.70, 0.02, 0.3),
    ("box", "vsokorelos-cardboard-box-drop-346169.ogg", 0.45, 1.60, 0.005, 0.3),
    ("boards", "lampeight-wood-panel-debris-clatter-400643.ogg", 0.10, 3.00, 0.005, 0.5),
    ("vase", "martian-vase-rolling-drops-335887.ogg", 0.36, 1.40, 0.01, 0.15),
    ("bump", "jawbutch-body-wall-impact-344402.ogg", 0.24, 0.85, 0.005, 0.15),
    ("slap", "soundscape-leuphana-flat-hand-wall-210258.ogg", 4.56, 4.92, 0.005, 0.08),
    ("stumble", "petebarry-the-gilligan-stumble-493794.ogg", 1.80, 2.75, 0.005, 0.2),
    ("swoosh", "danjocross-several-low-fast-swooshes-507470.ogg", 2.10, 2.45, 0.005, 0.1),
    ("woodfall", "craigsmith-wooden-object-falls-675976.ogg", 0.00, 0.70, 0.005, 0.2),
    ("cansfar", "jho3000-cans-in-a-pile-falling-693515.ogg", 0.55, 2.10, 0.005, 0.3, 2500),
    ("smash", "rutgermuller-wood-metal-chain-smash-hall-104003.ogg", 0.10, 1.60, 0.005, 0.3),
    ("debris", "xkeril-big-falling-debris-crash-703247.ogg", 0.00, 2.00, 0.005, 0.4),
    ("whizz", "keus92-whizzing-by-2-506907.mp3", 0.85, 3.30, 0.005, 0.4),
]


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
    print("voice"); v, made = slotted(VOICE, VOICE_SLOT, 80); write(v, "voice.mp3", 4)
    print("things"); write(slotted(THINGS, THING_SLOT, 50)[0], "things.mp3", 4)
    # The preverb comes from the shout as it was cut, at the level it's
    # in the voice file.
    print("pre"); write(preverb(made["scream"]), "pre.mp3", 4)
    # The field: 3-25 s of it (past its own start, before its end), a 20 s
    # loop with a 2 s crossfade, its average at -20 dBFS.
    f = hp(cut(load("humanoide9000-force-field-422245.ogg"), 3.0, 25.0), 40)
    loop = loop_of(f, 20.0, 2.0)
    write(padded(at_db(loop, -20, np.sqrt(np.mean(loop ** 2)))), "field.mp3", 5)


if __name__ == "__main__":
    main()
