"""The front page's pictures, packed for the web: assets/front/*.png (the
renders from tools/front_pieces.mjs, clear backgrounds, large) -> WebP
with alpha, no wider than 1800 px. The PNGs stay out of the repository;
the WebPs are what the pages use (build/build.js copies them to dist/front/).

    python3 tools/front_pack.py
"""
import glob, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "assets", "front")
MAX = 1800
for png in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    im = Image.open(png).convert("RGBA")
    bbox = im.getbbox()  # (trimmed to what's drawn, a margin kept)
    if bbox:
        m = 24
        im = im.crop((max(0, bbox[0] - m), max(0, bbox[1] - m), min(im.width, bbox[2] + m), min(im.height, bbox[3] + m)))
    if max(im.size) > MAX:
        im.thumbnail((MAX, MAX), Image.LANCZOS)
    out = png[:-4] + ".webp"
    im.save(out, "WEBP", quality=86, method=6)
    print(f"{os.path.basename(out)}: {im.width}x{im.height}, {os.path.getsize(out) // 1024} KB")
