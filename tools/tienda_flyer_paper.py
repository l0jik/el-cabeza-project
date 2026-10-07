#!/usr/bin/env python3
"""The paper of the store's "Try it!" flyer (themes/tienda-overlay.js), as a
1975 Sunday circular's was: a preprint on supercalendered groundwood stock
(SC: 50-70% mechanical pulp, 15-30% filler, uncoated, pressed glossy
between hot rollers; ISO brightness 62-70 against newsprint's 57-63, so a
warm, faintly grey white; thin, 40-60 g/m2, so the other side shows
through), folded in half to go inside the paper.

    python3 tools/tienda_flyer_paper.py

Writes two layers the flyer lays over its sheet, both stretched to it:

  assets/tienda/flyer-paper.webp  multiplied over everything (white leaves
      it be): the sheet's tone, its formation (the cloudiness of a
      groundwood sheet), its grain, shives (the dark specks and splinters
      of unseparated fibre bundles a mechanical pulp leaves in the sheet,
      lying along the web), and the reverse page showing through, mirrored
      and softened by the paper between (another page of the circular:
      a headline band, the photographs' blocks, big prices, small print).
  assets/tienda/flyer-ink.webp    screened over everything (black leaves it
      be), so it only shows where there's ink: the missing dots of
      printing on a rough groundwood sheet (small pale specks in the
      solids, where the paper didn't take the ink) and the ink cracked
      white along the fold (FOLD, the same place the CSS draws the crease).
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
FONTS = os.path.join(TOOLS, "fonts")
OUT_PAPER = os.path.join(ROOT, "assets", "tienda", "flyer-paper.webp")
OUT_INK = os.path.join(ROOT, "assets", "tienda", "flyer-ink.webp")

W, H = 640, 860
FOLD = 0.47  # the crease, as a share of the height (tienda-overlay.js --fold)
TONE = np.array([242, 237, 225], np.float32) / 255  # SC stock, about ISO 65
rng = np.random.default_rng(1975)


def noise(w, h, scale, octaves=4):
    """Smooth value noise in 0..1, features about `scale` px across."""
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(1, scale / (2 ** o))
        gw, gh = int(w / s) + 3, int(h / s) + 3
        g = Image.fromarray((rng.uniform(0, 1, (gh, gw)) * 255).astype(np.uint8), "L")
        g = g.resize((int(gw * s), int(gh * s)), Image.BICUBIC).crop((0, 0, w, h))
        out += amp * (np.asarray(g, np.float32) / 255)
        tot += amp
        amp *= 0.5
    return out / tot


def font(name, size, weight=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if weight:
        f.set_variation_by_name(weight)
    return f


def back_page():
    """The circular's other side, as ink density (0 paper, 1 solid): a
    toys page, laid out as the front is (another store's week of sales)."""
    S = 2  # drawn at twice the size
    im = Image.new("L", (W * S, H * S), 0)
    d = ImageDraw.Draw(im)
    # The headline band and its words.
    d.rectangle([0, 30 * S, W * S, 150 * S], fill=235)
    d.text((34 * S, 50 * S), "Toyland", font=font("Shrikhand-Regular.ttf", 64 * S), fill=40)
    d.text((W * S - 200 * S, 70 * S), "SAVE!", font=font("LibreFranklin.ttf", 50 * S, "Black"), fill=40)
    # Three rows of items: a photograph's block, a price, a few lines.
    heavy = font("LibreFranklin.ttf", 40 * S, "Black")
    small = font("LibreFranklin.ttf", 14 * S, "Bold")
    prices = ["$3.47", "$1.88", "$12.97", "$5.66", "$2.29", "$8.88"]
    for row in range(3):
        y0 = 180 + row * 220
        for col in range(2):
            x0 = 30 + col * 310
            # The photograph: mid-dark, with a lighter subject in it.
            d.rectangle([x0 * S, y0 * S, (x0 + 150) * S, (y0 + 170) * S], fill=150 + 30 * ((row + col) % 2))
            d.ellipse([(x0 + 30) * S, (y0 + 40) * S, (x0 + 120) * S, (y0 + 150) * S], fill=95)
            d.text(((x0 + 160) * S, (y0 + 2) * S), "NEW", font=small, fill=200)
            d.text(((x0 + 160) * S, (y0 + 26) * S), prices[row * 2 + col], font=heavy, fill=215)
            for k in range(5):
                lw = 120 - 18 * (k % 3)
                d.rectangle([(x0 + 162) * S, (y0 + 100 + k * 13) * S, (x0 + 162 + lw) * S, (y0 + 106 + k * 13) * S], fill=120)
    # The foot: the store's name, reversed out of a band.
    d.rectangle([0, (H - 70) * S, W * S, (H - 20) * S], fill=210)
    im = im.resize((W, H), Image.LANCZOS)
    # Seen from the front: mirrored, and softened by the sheet between.
    im = im.transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(1.6))
    return np.asarray(im, np.float32) / 255


def shives(a):
    """Dark specks and splinters, mostly along the web (here, across)."""
    im = Image.fromarray(np.zeros((H * 2, W * 2), np.uint8), "L")
    d = ImageDraw.Draw(im)
    for _ in range(46):
        x, y = rng.uniform(0, W * 2), rng.uniform(0, H * 2)
        L = rng.uniform(2, 11) if rng.uniform() < 0.7 else rng.uniform(1, 2.5)
        ang = rng.normal(0, 0.45)
        dx, dy = np.cos(ang) * L, np.sin(ang) * L
        d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=int(rng.uniform(120, 230)), width=int(rng.choice([1, 1, 2])))
    im = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.3))
    return np.asarray(im, np.float32) / 255


def paper():
    form = noise(W, H, 34)
    grain = noise(W, H, 2.2, 2)
    k = 1.0 - 0.035 * (form - 0.5) * 2 - 0.022 * (grain - 0.5) * 2
    k = k - 0.06 * back_page()
    sh = shives(k)
    rgb = np.ones((H, W, 3), np.float32) * TONE * k[..., None]
    # (The shives a greyed brown.)
    rgb = rgb * (1 - sh[..., None] * np.array([0.42, 0.47, 0.52], np.float32))
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")
    img.save(OUT_PAPER, "WEBP", quality=82, method=6)
    print("wrote", OUT_PAPER, os.path.getsize(OUT_PAPER), "bytes")


def ink():
    a = np.zeros((H, W), np.float32)
    # Missing dots: small pale specks, thicker where the sheet is rough.
    rough = noise(W, H, 60, 3)
    p = 0.0024 * (0.4 + rough)
    hit = rng.uniform(0, 1, (H, W)) < p
    a[hit] = rng.uniform(0.3, 0.7, hit.sum())
    # The fold: the ink cracked white along the crease, broken.
    fy = FOLD * H
    yy = np.arange(H)[:, None].astype(np.float32)
    band = np.exp(-((yy - fy) / 1.1) ** 2)
    along = noise(W, 1, 3, 2)[0][None, :]
    crack = band * np.clip((along - 0.35) * 2.2, 0, 1) * 0.85
    crack = crack * (rng.uniform(0, 1, (H, W)) < 0.75)
    a = np.maximum(a, crack)
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.35))
    rgb = Image.merge("RGB", (img, img, img))
    rgb.save(OUT_INK, "WEBP", quality=80, method=6)
    print("wrote", OUT_INK, os.path.getsize(OUT_INK), "bytes")


if __name__ == "__main__":
    paper()
    ink()
