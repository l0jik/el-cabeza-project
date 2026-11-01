"""The story's captions' face (themes/faces.js, set "caption"): Fraunces,
soft (user: "go with option C, Fraunces soft, for the captions"), as
Google Fonts serves it, cut at the two settings the captions use:

  the line (apps/novaStory.jsx .ns-caption): upright, weight 600,
    optical size 40, SOFT 100
  the second line (.ns-sub): italic, weight 400, optical size 14,
    SOFT 100

so the page fetches about 55 KB, not the 344 KB of the variable font
(the same letters: drawn side by side in Chromium they differ only in a
few edge pixels). Each in two files, latin and Vietnamese letters, split
as Google splits them; themes/faces.js gives each its unicode-range.
Into assets/fonts; build/build.js puts them beside the pages. Fraunces is
under the SIL Open Font License (assets/fonts/OFL-Fraunces.txt).

Needs fontTools and brotli (pip install fonttools brotli).

  python3 tools/caption_face.py
  python3 tools/caption_face.py --upright 600,40 --italic 400,14   (weight,optical size)
"""
import argparse
import io
import os
import re
import ssl
import sys
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fonts")
# The request the options page made (every axis but WONK, which Google
# then pins at its default).
CSS = ("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@"
       "0,9..144,100..900,0..100;1,9..144,100..900,0..100&display=swap")
# A browser's, so the sheet lists woff2 files split by script.
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
SUBSETS = {"latin": "", "vietnamese": "-vietnamese"}


def fetch(url):
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        return r.read()


def faces(css):
    # /* latin */ @font-face { font-style: italic; ... src: url(...); unicode-range: ...; }
    for m in re.finditer(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        body = m.group(2)
        yield {
            "subset": m.group(1),
            "style": re.search(r"font-style:\s*(\w+)", body).group(1),
            "url": re.search(r"url\((https://[^)]+)\)", body).group(1),
            "range": re.search(r"unicode-range:\s*([^;]+);", body).group(1).strip(),
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--upright", default="600,40", help="weight,optical size of the line")
    ap.add_argument("--italic", default="400,14", help="weight,optical size of the second line")
    ap.add_argument("--soft", type=float, default=100)
    a = ap.parse_args()
    at = {"normal": [float(v) for v in a.upright.split(",")], "italic": [float(v) for v in a.italic.split(",")]}
    css = fetch(CSS).decode("utf-8")
    done = 0
    for f in faces(css):
        if f["subset"] not in SUBSETS:
            continue
        wght, opsz = at[f["style"]]
        font = TTFont(io.BytesIO(fetch(f["url"])))
        cut = instancer.instantiateVariableFont(font, {"opsz": opsz, "wght": wght, "SOFT": a.soft})
        cut.flavor = "woff2"
        name = "fraunces-soft" + ("-italic" if f["style"] == "italic" else "") + SUBSETS[f["subset"]] + ".woff2"
        cut.save(os.path.join(OUT, name))
        print(f"{name}: {f['style']} {wght:g}, opsz {opsz:g}, SOFT {a.soft:g}, {os.path.getsize(os.path.join(OUT, name))} bytes")
        print(f"  unicode-range (themes/faces.js): {f['range']}")
        done += 1
    if done != 4:
        sys.exit(f"expected 4 faces (latin and Vietnamese, upright and italic), made {done}")


if __name__ == "__main__":
    main()
