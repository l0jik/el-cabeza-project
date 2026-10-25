#!/usr/bin/env python3
"""An Opus twin beside every recording the game ships (user: "Let's go
with Opus, a safer quality").

    npm run build && FFMPEG=/path/to/ffmpeg python3 tools/opus_twins.py [--force]

Each MP3 in dist/ is matched by content to its source in assets/, and an
Ogg Opus file is written beside that source with the same name (.opus):
build/build.js copies it beside the MP3 in dist/, and chassis/sound-files.js
plays it wherever the browser can play Opus, the MP3 everywhere else
(iPhones and iPads before iOS 18.4, Safari before macOS 15.4).

"A safer quality": two thirds of the MP3's own average bitrate, never under
32 kbps mono or 64 kbps stereo (Opus sounds about as good as MP3 at half
the bits; two thirds leaves room). VBR, the channels as the MP3's, no tags.
Opus always runs at 48 kHz and its decoders take off its pre-skip, so a
file starts and ends where its MP3 did: the loops, the stabs' slices and
the den spot's sync keep their times.

A twin newer than its source is left alone (--force writes it again).
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    err = subprocess.run([FFMPEG, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", err)
    secs = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    mono = bool(re.search(r"Audio: .*\bmono\b", err))
    return secs, mono


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    dist = os.path.join(ROOT, "dist")
    if not os.path.isdir(dist):
        sys.exit("no dist/: run npm run build first")
    sources = {}
    for base, _, files in os.walk(os.path.join(ROOT, "assets")):
        for f in files:
            if f.lower().endswith(".mp3"):
                p = os.path.join(base, f)
                sources.setdefault(md5(p), p)
    done, total_mp3, total_opus = set(), 0, 0
    for f in sorted(os.listdir(dist)):
        if not f.endswith(".mp3"):
            continue
        src = sources.get(md5(os.path.join(dist, f)))
        if not src:
            sys.exit(f"{f}: no source in assets/ with the same content")
        if src in done:
            continue
        done.add(src)
        out = src[:-4] + ".opus"
        secs, mono = probe(src)
        kbps = max(32 if mono else 64, round(os.path.getsize(src) * 8 / 1000 / secs * 2 / 3))
        if a.force or not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
            subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-map_metadata", "-1", "-vn", "-ac", "1" if mono else "2",
                            "-c:a", "libopus", "-b:a", f"{kbps}k", "-vbr", "on", "-application", "audio", out], check=True)
        total_mp3 += os.path.getsize(src)
        total_opus += os.path.getsize(out)
        print(f"{os.path.relpath(out, ROOT)}: {kbps} kbps {'mono' if mono else 'stereo'}, "
              f"{os.path.getsize(src) / 1024:.0f} KB -> {os.path.getsize(out) / 1024:.0f} KB")
    print(f"{len(done)} recordings: {total_mp3 / 1048576:.1f} MB as MP3, {total_opus / 1048576:.1f} MB as Opus")


main()
