"""Go deo na ndeor's (Watermark's) second song: the user's "Ná seas ag mo
uaigh is ná goil" (their Suno song, assets/parrish/src/na-seas-ag-mo-
uaigh.m4a), edited as they asked over four rounds (2026-10-11):

- 2:34.699-2:53.234 taken out (asked from 2:35.199, then "cutting the
  beginning of the removed section .3 seconds sooner", then ".2 seconds
  sooner").
- The music before the cut trails off into a hall: its send swells over
  the last 3 s, the music stops (a 150 ms fade) and the hall decays
  (RT60 8.5 s: "a slightly longer tail") through 3.4 s of otherwise
  silence ("4 second of silence", then ".6 seconds shorter").
- Then the last part comes in on its first note (2:53.234), "an emotional
  denouement", a 0.4 s breath of its own quiet pad faded up before it.
- Its end: the original stops dead while the music still sounds (about
  -33 dB), the click the user heard. The music fades over its last 1.2 s
  into the same hall, which rings on 4 s ("+2 seconds"), the last 1.5 s
  faded to nothing.
- Reverb over the whole song ("a bit more than before"): wet -15 dB,
  RT60 2.5 s, 24 ms pre-delay, the highs damped.
- Level: the same integrated loudness (ITU-R BS.1770) as the look's
  first song, assets/parrish/hums.mp3 ("Ôm Nhau Vĩnh Cửu"), which it
  follows in the soundtrack (user: "matching for audio levels").

Stereo, 48 kHz, 128 kb/s, as the other soundtracks. The reverbs are
noise under an envelope from a fixed seed, so a run makes the same file.

    python3 tools/parrish_na_seas.py      (FFMPEG=/path/to/ffmpeg if not on PATH)
"""
import os
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/parrish/src/na-seas-ag-mo-uaigh.m4a")
REF = os.path.join(ROOT, "assets/parrish/hums.mp3")
OUT = os.path.join(ROOT, "assets/parrish/na-seas.mp3")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
SR = 48000

A = 154.699     # the cut's start
B = 173.234     # the last part's first note
GAP = 3.4       # from the music stopping to the last part's note
END_TAIL = 4.0  # the hall ringing on after the song's last sound


def decode(path):
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le",
                          "-ac", "2", "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def fftconv(sig, ir):
    n = len(sig) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    out = np.empty((n, 2))
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(sig[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:n]
    return out


rng = np.random.default_rng(1717)


def room_ir(rt60, length, predelay, damp_hi, damp_lo):
    """Noise under an exponential decay (-60 dB at rt60), each channel its
    own, the highs dying faster: a one-pole low-pass whose cutoff slides
    from damp_hi to damp_lo over the tail. Unit energy."""
    n = int(length * SR)
    t = np.arange(n) / SR
    env = 10 ** (-3 * t / rt60)
    fc = damp_hi * (damp_lo / damp_hi) ** (t / length)
    a = np.exp(-2 * np.pi * fc / SR)
    ir = np.zeros((n + int(predelay * SR), 2))
    for c in range(2):
        noise = rng.standard_normal(n)
        y = np.empty(n)
        s = 0.0
        for i in range(n):
            s = a[i] * s + (1 - a[i]) * noise[i]
            y[i] = s
        ir[int(predelay * SR):, c] = y * env
    return ir / np.sqrt((ir ** 2).sum() / 2)


def cos_out(n): return (np.cos(np.linspace(0, np.pi / 2, n)) ** 2)[:, None]
def sin_in(n): return (np.sin(np.linspace(0, np.pi / 2, n)) ** 2)[:, None]


def lufs(x):
    """Integrated loudness, ITU-R BS.1770-4 at 48 kHz: K-weighting (the
    head's shelf and the RLB high-pass, applied in the frequency domain),
    400 ms blocks every 100 ms, the -70 LUFS and -10 LU gates."""
    n = len(x)
    nfft = 1 << (n - 1).bit_length()
    w = np.exp(-1j * np.pi * np.arange(nfft // 2 + 1) / (nfft // 2))
    def resp(b, a): return (b[0] + b[1] * w + b[2] * w * w) / (a[0] + a[1] * w + a[2] * w * w)
    H = resp([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]) \
        * resp([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])
    y = np.empty_like(x)
    for c in range(2):
        y[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * H, nfft)[:n]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.array([(y[i:i + blk] ** 2).mean(axis=0).sum() for i in range(0, n - blk + 1, hop)])
    L = -0.691 + 10 * np.log10(np.maximum(p, 1e-20))
    g = p[L > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    return -0.691 + 10 * np.log10(p[(L > -70) & (L > rel)].mean())


def main():
    x = decode(SRC)
    hall = room_ir(rt60=8.5, length=9.0, predelay=0.03, damp_hi=8000.0, damp_lo=2500.0)

    def hall_trail(src_end, dry_fade, level_db):
        # the send swelling (smoothstep) over the last 3 s, the music's own
        # fade on it too; level_db under the music's last 0.5 s just after
        # it stops
        sw = int(3.0 * SR)
        s0 = src_end - sw
        u = np.linspace(0, 1, sw)
        src = x[s0:src_end] * (u * u * (3 - 2 * u))[:, None]
        src[-dry_fade:] *= cos_out(dry_fade)
        wet = fftconv(src, hall)
        lvl_dry = np.sqrt((x[src_end - int(0.5 * SR):src_end] ** 2).mean())
        lvl_wet = np.sqrt((wet[sw:sw + int(0.3 * SR)] ** 2).mean())
        return s0, wet * (lvl_dry * 10 ** (level_db / 20) / max(lvl_wet, 1e-12))

    ia, ib, n = int(round(A * SR)), int(round(B * SR)), len(x)
    G, ET = int(GAP * SR), int(END_TAIL * SR)
    # before the cut, trailing off (150 ms) into the hall
    F1 = int(0.15 * SR)
    pre = x[:ia].copy()
    pre[-F1:] *= cos_out(F1)
    s0, wet1 = hall_trail(ia, F1, -3.0)
    # the last part from its first note (a 0.4 s breath before it), its end
    # fading over 1.2 s into the hall
    PRE_ROLL, F2 = int(0.4 * SR), int(1.2 * SR)
    post = x[ib - PRE_ROLL:].copy()
    post[:PRE_ROLL] *= sin_in(PRE_ROLL)
    post[-F2:] *= cos_out(F2)
    e0, wet2 = hall_trail(n, F2, -3.0)
    # assembled
    p0 = ia + G - PRE_ROLL
    music_end = p0 + len(post)
    total = music_end + ET
    out = np.zeros((total, 2))
    out[:ia] += pre
    k = min(total, s0 + len(wet1)); out[s0:k] += wet1[:k - s0]
    out[p0:music_end] += post
    e_out = p0 + (e0 - (ib - PRE_ROLL))
    k = min(total, e_out + len(wet2)); out[e_out:k] += wet2[:k - e_out]
    # the reverb over the whole song
    ir = room_ir(rt60=2.5, length=3.2, predelay=0.024, damp_hi=6500.0, damp_lo=1600.0)
    lw = fftconv(out, ir)[:total]
    gain = 10 ** (-15 / 20) * np.sqrt((out[:music_end] ** 2).mean() / max((lw[:music_end] ** 2).mean(), 1e-12))
    mix = out + gain * lw
    f = int(1.5 * SR)
    mix[-f:] *= cos_out(f)
    # the first song's loudness
    ref = lufs(decode(REF))
    mine = lufs(mix)
    mix *= 10 ** ((ref - mine) / 20)
    pk = np.abs(mix).max()
    if pk > 0.891:
        mix *= 0.891 / pk
    # (The encoder takes about 0.45 dB off, as it did the first song: the
    # file is measured once made and made again if it's off, so the two
    # files, as the game plays them, match.)
    for _ in range(3):
        with tempfile.TemporaryDirectory() as d:
            raw = os.path.join(d, "x.f32")
            mix.astype(np.float32).tofile(raw)
            subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
                            "-c:a", "libmp3lame", "-b:a", "128k", OUT], check=True)
        got = lufs(decode(OUT))
        if abs(got - ref) < 0.05:
            break
        mix *= 10 ** ((ref - got) / 20)
    print(f"{os.path.relpath(OUT, ROOT)}: {len(mix) / SR:.2f} s; loudness {got:.2f} LUFS (the first song {ref:.2f}; "
          f"before matching {mine:.2f}); peak {20 * np.log10(np.abs(mix).max()):.2f} dBFS", file=sys.stderr)


if __name__ == "__main__":
    main()
