#!/usr/bin/env python3
"""The revisited store's standee: a 1975 department-store ad for the same
six appliances that sit on the Games table in the storyboard photographs
(tools/tienda_clerk_frames.py), photographed from the same spread.

    python3 tools/tienda_housewares_ad.py

Writes assets/tienda/ad-housewares.jpg (the standee's 15 x 33.4 card, see
themes/tienda-store.js). Faces in tools/fonts (SIL Open Font License):
Shrikhand for the headline, Bodoni Moda italic, Libre Franklin, Courier
Prime, the last three the store's own.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tienda_clerk_frames as frames  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
OUT = os.path.join(ROOT, "assets", "tienda", "ad-housewares.jpg")

W, H = 1280, 2850  # drawn at twice the size, then halved
PAPER = (242, 231, 203)
INK = (59, 38, 24)
GOLD = (227, 174, 69)
AVOCADO = (110, 123, 46)
ORANGE = (196, 80, 42)
CREAM = (248, 240, 220)
RED = (178, 52, 38)

ITEMS = [
    ("Automatic Drip Coffeemaker", "$24.88"),
    ("Electric Can Opener", "$12.88"),
    ("5-Quart Slow Cooker", "$19.88"),
    ("Two-Slice Chrome Toaster", "$16.88"),
    ("14-Speed Blender", "$29.88"),
    ("Portable Hand Mixer", "$11.88"),
]


def font(name, size, weight=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if weight:
        f.set_variation_by_name(weight)
    return f


def centered(d, y, text, f, fill, cx=W / 2, shadow=None):
    w = d.textlength(text, font=f)
    if shadow:
        d.text((cx - w / 2 + shadow[0], y + shadow[1]), text, font=f, fill=shadow[2])
    d.text((cx - w / 2, y), text, font=f, fill=fill)


def burst(d, cx, cy, r0, r1, n, fill):
    pts = []
    for i in range(n * 2):
        a = np.pi * i / n - np.pi / 2
        r = r1 if i % 2 == 0 else r0
        pts.append((cx + r * np.cos(a), cy + r * np.sin(a)))
    d.polygon(pts, fill=fill)


def spread_photo():
    """The appliance spread off the clerk sheet, as the frames lay it."""
    raw = frames.cells()
    clean = frames.clean_all({k: v for k, v in raw.items() if k.startswith("clerk")})
    layer = frames.spread_layer(clean["clerk-sorry"])
    im = Image.fromarray(layer, "RGBA").crop((0, 292, 380, 505))
    return im


def main():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # The head: brown, the headline in gold, then the stripes.
    d.rectangle([0, 0, W, 560], fill=INK)
    centered(d, 70, "Come home to", font("BodoniModa-Italic.ttf", 104, "Medium Italic"), CREAM)
    centered(d, 200, "Harvest", font("Shrikhand-Regular.ttf", 210), GOLD, shadow=(8, 10, (24, 14, 8)))
    centered(d, 385, "Gold!", font("Shrikhand-Regular.ttf", 150), GOLD, shadow=(8, 10, (24, 14, 8)))
    for i, c in enumerate([ORANGE, GOLD, AVOCADO]):
        d.rectangle([0, 560 + i * 34, W, 560 + (i + 1) * 34], fill=c)

    # The photograph, on its panel.
    ph = spread_photo()
    pw = W - 140
    ph = ph.resize((pw, round(ph.height * pw / ph.width)), Image.LANCZOS)
    panel_top = 720
    d.rounded_rectangle([50, panel_top - 20, W - 50, panel_top + ph.height + 20], radius=26, fill=(214, 196, 160))
    img.paste(ph, (70, panel_top), ph)
    d.rounded_rectangle([50, panel_top - 20, W - 50, panel_top + ph.height + 20], radius=26, outline=INK, width=6)
    y = panel_top + ph.height + 60

    # The line under it.
    centered(d, y, "The complete countertop collection,", font("BodoniModa-Italic.ttf", 58, "Medium Italic"), INK)
    centered(d, y + 74, "in the colors of the season.", font("BodoniModa-Italic.ttf", 58, "Medium Italic"), INK)
    y += 190

    # The price list, with dot leaders.
    name_f = font("LibreFranklin.ttf", 50, "SemiBold")
    price_f = font("CourierPrime-Bold.ttf", 56)
    for name, price in ITEMS:
        d.text((90, y), name, font=name_f, fill=INK)
        nw = d.textlength(name, font=name_f)
        pw2 = d.textlength(price, font=price_f)
        x = 90 + nw + 18
        while x < W - 90 - pw2 - 22:
            d.ellipse([x, y + 40, x + 7, y + 47], fill=INK)
            x += 20
        d.text((W - 90 - pw2, y - 4), price, font=price_f, fill=RED)
        y += 92
    y += 20

    # The colors, as swatches.
    sw = [("Harvest Gold", GOLD), ("Avocado", AVOCADO), ("Burnt Orange", ORANGE), ("Almond", (232, 219, 190))]
    lab_f = font("LibreFranklin.ttf", 30, "Bold")
    for i, (lab, c) in enumerate(sw):
        cx = 180 + i * 307
        d.ellipse([cx - 58, y, cx + 58, y + 116], fill=c, outline=INK, width=5)
        centered(d, y + 132, lab.upper(), lab_f, INK, cx=cx)
    y += 220

    # The burst, over the photograph's top corner, on the wall above the
    # coffeemaker (clear of every appliance).
    bx, by = 330, panel_top - 10
    burst(d, bx, by, 132, 182, 18, RED)
    burst(d, bx, by, 112, 156, 18, GOLD)
    centered(d, by - 74, "ALL SIX", font("LibreFranklin.ttf", 40, "Black"), INK, cx=bx)
    centered(d, by - 34, "$99", font("Shrikhand-Regular.ttf", 86), RED, cx=bx - 8)
    centered(d, by + 60, "97", font("LibreFranklin.ttf", 30, "Black"), INK, cx=bx)

    # The foot: the store.
    foot = min(max(y + 20, H - 470), H - 450)
    d.rectangle([0, foot, W, H], fill=INK)
    for i, c in enumerate([AVOCADO, GOLD, ORANGE]):
        d.rectangle([0, foot + i * 20, W, foot + (i + 1) * 20], fill=c)
    centered(d, foot + 100, "Big Glutts", font("Shrikhand-Regular.ttf", 150), GOLD, shadow=(6, 8, (24, 14, 8)))
    centered(d, foot + 290, "HOUSEWARES · AISLE 4", font("LibreFranklin.ttf", 54, "Bold"), CREAM)
    centered(d, foot + 356, "Charge it on Big Glutts Easy Credit", font("BodoniModa-Italic.ttf", 44, "Medium Italic"), (214, 196, 160))

    # Printed: halved, a little soft, a little grain, the paper warm at
    # the edges.
    img = img.resize((W // 2, H // 2), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32)
    rng = np.random.default_rng(1975)
    a += rng.normal(0, 3.2, a.shape[:2])[..., None]
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    r = np.hypot((xx / a.shape[1] - 0.5) * 1.6, yy / a.shape[0] - 0.5)
    a *= (1 - 0.12 * np.clip(r - 0.35, 0, 1))[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))
    img.save(OUT, quality=84, optimize=True, progressive=True)
    print(OUT, img.size)


if __name__ == "__main__":
    main()
