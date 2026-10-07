#!/usr/bin/env python3
"""The photograph on the store's "Try it!" flyer (themes/tienda-overlay.js):
the user's picture of a 1970s family in a department store at the
holidays, Dad holding up the boxed El Cabeza, the children agog.

    python3 tools/tienda_flyer_photo.py [original.png]

Given the original, keeps it as assets/tienda/src/flyer-photo-source.jpg;
then prints it as the circular's press would have, onto supercalendered
groundwood stock (tools/tienda_flyer_paper.py): the blacks never quite
black (the ink on that sheet holds a density of about 1.3), the colour a
touch flatter and warmer, the plates a hair out of register, the ink spread
a little into the sheet. Writes assets/tienda/flyer-photo.jpg; the flyer's
paper goes over it on the page.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
SRC = os.path.join(ROOT, "assets", "tienda", "src", "flyer-photo-source.jpg")
OUT = os.path.join(ROOT, "assets", "tienda", "flyer-photo.jpg")
WIDTH = 1100


def main():
    if len(sys.argv) > 1:
        os.makedirs(os.path.dirname(SRC), exist_ok=True)
        Image.open(sys.argv[1]).convert("RGB").save(SRC, quality=92, optimize=True)
        print("kept", SRC, os.path.getsize(SRC), "bytes")
    im = Image.open(SRC).convert("RGB")
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    # Flatter and warmer, as the ink sits in a groundwood sheet.
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = lum + (a - lum) * 0.93
    a = a * np.array([1.0, 0.985, 0.95], np.float32)
    # The blacks a dark brown-grey: the most ink the sheet will hold.
    floor = np.array([30, 25, 22], np.float32) / 255
    a = floor + (1 - floor) * a
    # Out of register by a hair: magenta one way, yellow the other.
    c, m, y = 1 - a[..., 0], 1 - a[..., 1], 1 - a[..., 2]
    m = np.roll(m, 1, axis=1)
    y = np.roll(y, 1, axis=0)
    a = np.stack([1 - c, 1 - m, 1 - y], -1)
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(0.4))
    img.save(OUT, quality=84, optimize=True, progressive=True)
    print("wrote", OUT, img.size, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
