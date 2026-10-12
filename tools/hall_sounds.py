"""The hall's recorded sounds (user: when the player's pulled from the den
into the hall, "audio of someone being pulled, somewhat unwillingly,
although curious... stuff should sound like it's being knocked over, but
it's not total chaos... some forcefield like noise... Whenever the user
turn right after passing through the doorframe, they see the strange
objects on the wall flashing around, so there should be an expression of
extreme shock or confusion... increasingly sound a bit panicky"), made
from the recordings in assets/hall/src/ (CREDITS.md says whose each is):

  voice.mp3   the man, Iceofdoom's "buddy" (CC BY 4.0: the About card
              credits him), one voice throughout, each take in its own
              VOICE_SLOT seconds (themes/den-hall.js VOICE): "Whoah, no
              way" (curious), a startled "Ah", two deep "Ugh"s and a grunt
              (pulled, resisting), a gasp and a "Huh?" (the turn, the rift),
              "Phew" (it dies down) and "Ahh!!!" (it erupts).
  things.mp3  the force taking hold (LilMati's force field swell) and what
              it pulls over on the way, each in its own THING_SLOT seconds:
              a shelf of cups rattling, a table shaking, papers flying, a
              chair scraping, books falling, a vase rolling off, a body
              against the doorframe and a hand slapping it.
  field.mp3   humanoide9000's "Force Field": a hum with pulses that come
              faster, a seamless 20 s loop (padded as Noir's loops are).
  breath.mp3  casiba842's scared heavy breathing, 20 s of it getting
              harder (louder and faster as it goes), for the panic.

Every cut has a short fade in and out, a high-pass under the voice's
lowest (80 Hz; 50 for the things), and its loudest 0.3 s at -14 dBFS
(the loops: their average at -20); the game sets the mix.

    FFMPEG=/path/to/ffmpeg python3 tools/hall_sounds.py
"""
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

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

VOICE = [  # name, file, from, to (seconds in the recording)
    ("whoa", "iceofdoom-whoah-no-way-846331.ogg", 0.80, 2.85),
    ("ah", "iceofdoom-grunts-surprised-breaths-575815.ogg", 3.40, 3.95),
    ("ugh1", "iceofdoom-ugh-575727.ogg", 0.10, 0.90),
    ("ugh2", "iceofdoom-ugh-575727.ogg", 1.08, 1.85),
    ("grunt", "iceofdoom-grunts-surprised-breaths-575815.ogg", 30.00, 30.45),
    ("gasp", "iceofdoom-grunts-surprised-breaths-575815.ogg", 19.85, 21.30),
    ("huh", "iceofdoom-grunts-surprised-breaths-575815.ogg", 30.80, 31.40),
    ("phew", "iceofdoom-phew-575723.ogg", 0.12, 1.58),
    ("scream", "iceofdoom-ahh-scream-385819.ogg", 0.02, 1.26),
]
THINGS = [  # name, file, from, to, fade in, fade out
    ("engage", "lilmati-force-field-01-702771.ogg", 0.00, 3.00, 0.01, 0.6),
    ("rattle", "nick121087-cup-shelf-rattling-232244.ogg", 1.50, 5.00, 0.5, 0.8),
    ("table", "yannsauvin-dinner-table-shaking-778107.ogg", 2.40, 5.80, 0.4, 0.8),
    ("papers", "mickdow-paper-flutter-320913.ogg", 14.00, 17.20, 0.3, 0.9),
    ("chair", "kyles-chair-scrape-455673.ogg", 1.90, 4.70, 0.02, 0.3),
    ("books", "mindlesstrails-books-falling-509531.ogg", 3.40, 4.70, 0.01, 0.2),
    ("vase", "martian-vase-rolling-drops-335887.ogg", 0.36, 1.40, 0.01, 0.15),
    ("bump", "jawbutch-body-wall-impact-344402.ogg", 0.24, 0.85, 0.005, 0.15),
    ("slap", "soundscape-leuphana-flat-hand-wall-210258.ogg", 4.56, 4.92, 0.005, 0.08),
]


def load(name):
    """A source, decoded at 44.1 kHz, as mono."""
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", os.path.join(SRC, name), "-ar", str(SR), "-ac", "2", wav], check=True)
        x, _ = sf.read(wav, always_2d=True)
    return x.mean(1)


def cut(x, a, b):
    return x[int(a * SR):int(b * SR)].copy()


def hp(x, f, order=2):
    return sosfiltfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def fades(x, fin, fout):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
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


def slotted(takes, slot, hp_at):
    """Each take in its own `slot` seconds, LEAD in."""
    out = np.zeros(int(slot * SR * len(takes)))
    for i, t in enumerate(takes):
        name, f, a, b = t[:4]
        fin, fout = (t[4], t[5]) if len(t) > 4 else (0.01, 0.08)
        x = fades(hp(cut(load(f), a, b), hp_at), fin, fout)
        x = at_db(x, -14, loudest(x))
        assert len(x) <= (slot - LEAD - 0.05) * SR, (name, len(x) / SR)
        s = int((i * slot + LEAD) * SR)
        out[s:s + len(x)] = x
        print(f"  {name:7s} slot {i}: {len(x) / SR:.2f} s")
    return out


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
    print("voice"); write(slotted(VOICE, VOICE_SLOT, 80), "voice.mp3", 4)
    print("things"); write(slotted(THINGS, THING_SLOT, 50), "things.mp3", 4)
    # The field: 3-25 s of it (past its own start, before its end), a 20 s
    # loop with a 2 s crossfade, its average at -20 dBFS.
    f = hp(cut(load("humanoide9000-force-field-422245.ogg"), 3.0, 25.0), 40)
    loop = loop_of(f, 20.0, 2.0)
    write(padded(at_db(loop, -20, np.sqrt(np.mean(loop ** 2)))), "field.mp3", 5)
    # The breathing: 14-34 s, as it gets harder; its average at -20 dBFS.
    b = fades(hp(cut(load("casiba842-scared-heavy-breathing-554307.ogg"), 14.0, 34.0), 80), 0.4, 0.6)
    write(at_db(b, -20, np.sqrt(np.mean(b ** 2))), "breath.mp3", 5)


if __name__ == "__main__":
    main()
