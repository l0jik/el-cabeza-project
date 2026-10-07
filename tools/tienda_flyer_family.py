#!/usr/bin/env python3
"""The picture on the store's "Try it!" flyer (themes/tienda-overlay.js): an
imaginary 1975 family fawning over a boxed El Cabeza, looking ridiculous
(user). Drawn as the period's ads and game boxes drew their families:
flat colour, an inked line, cel shadows; Dad in a powder-blue leisure suit
holding the box up like a trophy against a harvest-gold sunburst, Mom
swooning, the boy gasping with his hands on his cheeks, the girl
starry-eyed with her hands clasped, and the dog adoring it too. The box is
the store's own (tienda-textures.js lidPainter): walnut brown, the den
photograph in a gold frame, EL CABEZA in Bodoni, the price-gun sticker.

    python3 tools/tienda_flyer_family.py

Draws tools/tienda_flyer_family.svg, renders it in Chromium
(tools/svg_render.mjs; both removed after, unless --keep), then prints it: the plates a hair out of register,
the ink spread a little into the sheet, a little mottle. Writes
assets/tienda/flyer-family.jpg; the flyer's paper (tools/tienda_flyer_paper.py)
goes over it on the page.
"""
import base64
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageFilter

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
SVG = os.path.join(TOOLS, "tienda_flyer_family.svg")
RAW = os.path.join(TOOLS, ".tienda_flyer_family.png")
OUT = os.path.join(ROOT, "assets", "tienda", "flyer-family.jpg")
BOX_ART = os.path.join(ROOT, "assets", "tienda", "box-art.jpg")

W, H = 480, 1100

INK = "#2A1A10"
SKIN, SKIN_SH, SKIN_HI = "#F1C29A", "#DC9C72", "#FBDDBF"
BLUSH = "#EC7F68"
MOUTH, TONGUE, TEETH = "#5C1D14", "#D2645A", "#FFFDF6"
EYE_W = "#FFFDF6"
DAD_HAIR, DAD_HAIR_HI = "#4B2E1B", "#6E4628"
SUIT, SUIT_SH, SUIT_HI = "#8DB6D9", "#6A93B8", "#B7D4EB"
SHIRT, SHIRT_SH, SHIRT_DOT = "#D8642A", "#A9471B", "#F2A24A"
GOLD, GOLD_SH = "#E3AE45", "#A8772A"
MOM_HAIR, MOM_HAIR_SH, MOM_HAIR_HI = "#E2B25E", "#B98234", "#F6D894"
SWEATER, SWEATER_SH = "#7D8B3B", "#5C6827"
LIPS = "#C8452E"
SON_HAIR, SON_HAIR_SH = "#7A4422", "#55301A"
TEE, TEE_SH, TEE_RING, TEE_S1, TEE_S2 = "#E9B23A", "#C48E22", "#6B3A1E", "#E07B22", "#B4451F"
GIRL_HAIR, GIRL_HAIR_SH = "#9A4220", "#6E2C14"
DRESS, DRESS_SH, COLLAR = "#E07B22", "#B65A14", "#FBF3E1"
YARN = "#7D8B3B"
DOG, DOG_SH, DOG_WHITE, DOG_EAR = "#C98A4B", "#9C6430", "#FBF3E1", "#5E3A20"
RAY1, RAY2 = "#F8E9B6", "#F0C55A"
BOX, BOX_SIDE, BOX_GOLD, BOX_CREAM = "#3B2618", "#24170D", "#D3A13B", "#EFE4CB"


def f(n):
    return ("%.2f" % n).rstrip("0").rstrip(".")


def attrs(**a):
    out = []
    for k, v in a.items():
        if v is None:
            continue
        out.append('%s="%s"' % (k.rstrip("_").replace("_", "-"), v))
    return " ".join(out)


def path(d, fill="none", stroke=INK, sw=3, **a):
    return "<path d=\"%s\" %s/>" % (d, attrs(fill=fill, stroke=stroke if sw else "none", stroke_width=f(sw) if sw else None, **a))


def ellipse(cx, cy, rx, ry, fill="none", stroke=INK, sw=3, **a):
    return "<ellipse %s/>" % attrs(cx=f(cx), cy=f(cy), rx=f(rx), ry=f(ry), fill=fill, stroke=stroke if sw else "none", stroke_width=f(sw) if sw else None, **a)


def circle(cx, cy, r, **a):
    return ellipse(cx, cy, r, r, **a)


def g(children, transform=None, **a):
    return "<g %s>%s</g>" % (attrs(transform=transform, **a), "".join(children))


def catmull(pts, n=10):
    """A smooth curve through the points (Catmull-Rom), sampled."""
    pts = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (np.array(p, float) for p in pts[i - 1:i + 3])
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(np.array(pts[-2], float))
    return out


def limb(pts, widths, cap_start=True, cap_end=True):
    """A limb (a sleeve, an arm, a leg) as a closed outline round a smooth
    centreline, its width going from widths[0] to widths[-1] along it."""
    c = catmull(pts)
    n = len(c)
    ws = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(widths)), widths)
    left, right = [], []
    for i in range(n):
        a = c[max(0, i - 1)]
        b = c[min(n - 1, i + 1)]
        t = b - a
        t = t / (np.linalg.norm(t) + 1e-9)
        nrm = np.array([-t[1], t[0]])
        left.append(c[i] + nrm * ws[i] / 2)
        right.append(c[i] - nrm * ws[i] / 2)
    poly = list(left)
    if cap_end:
        t = c[-1] - c[-2]
        a0 = math.atan2(t[1], t[0])
        for k in range(1, 8):
            a = a0 + math.pi / 2 - math.pi * k / 8
            poly.append(c[-1] + np.array([math.cos(a), math.sin(a)]) * ws[-1] / 2)
    poly += right[::-1]
    if cap_start:
        t = c[1] - c[0]
        a0 = math.atan2(t[1], t[0]) + math.pi
        for k in range(1, 8):
            a = a0 + math.pi / 2 - math.pi * k / 8
            poly.append(c[0] + np.array([math.cos(a), math.sin(a)]) * ws[0] / 2)
    return "M" + " L".join("%s %s" % (f(p[0]), f(p[1])) for p in poly) + " Z"


def star(cx, cy, r, k=0.22, rot=0):
    """A four-pointed sparkle."""
    pts = []
    for i in range(8):
        a = rot + math.pi * i / 4 - math.pi / 2
        rr = r if i % 2 == 0 else r * k
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return "M" + " L".join("%s %s" % (f(x), f(y)) for x, y in pts) + " Z"


# ------------------------------------------------------------------ the scene

BOX_C = (240, 196)
BOX_ROT = -6
BOX_W, BOX_H = 340, 170


def background():
    cx, cy = BOX_C
    out = ['<rect width="%d" height="%d" fill="%s"/>' % (W, H, RAY1)]
    n = 30
    R = 2400
    for i in range(n):
        if i % 2:
            continue
        a0 = 2 * math.pi * i / n + 0.05
        a1 = 2 * math.pi * (i + 1) / n + 0.05
        out.append(path("M%s %s L%s %s L%s %s Z" % (f(cx), f(cy), f(cx + R * math.cos(a0)), f(cy + R * math.sin(a0)), f(cx + R * math.cos(a1)), f(cy + R * math.sin(a1))), fill=RAY2, sw=0))
    out.append('<circle cx="%s" cy="%s" r="300" fill="url(#glow)"/>' % (f(cx), f(cy)))
    return "".join(out)


def sparkles():
    out = []
    for (x, y, r, rot) in [(46, 92, 22, 0.1), (432, 84, 16, -0.2), (448, 330, 20, 0.15), (30, 360, 14, 0), (412, 18, 10, 0.3), (70, 20, 9, 0)]:
        out.append(path(star(x, y, r, rot=rot), fill="#FFFDF2", stroke=INK, sw=2))
    for (x, y, r) in [(18, 214, 3.5), (462, 214, 4), (120, 336, 3), (388, 340, 3.5), (250, 20, 3)]:
        out.append(circle(x, y, r, fill="#FFFDF2", stroke=INK, sw=1.6))
    return "".join(out)


def box_art_uri():
    with open(BOX_ART, "rb") as fh:
        return "data:image/jpeg;base64," + base64.b64encode(fh.read()).decode()


def game_box():
    """The store's box (tienda-textures.js lidPainter), held up lid-out,
    seen a little from below (its underside a band of dark board)."""
    w, h = BOX_W, BOX_H
    x0, y0 = -w / 2, -h / 2
    px, py, pw, ph = x0 + w * 0.06, y0 + h * 0.1, w * 0.52, h * 0.8
    tx = x0 + w * 0.79
    out = [
        # The underside, seen from below.
        path("M%s %s L%s %s L%s %s L%s %s Z" % (f(x0), f(-y0), f(-x0), f(-y0), f(-x0 - 6), f(-y0 + 20), f(x0 + 6), f(-y0 + 20)), fill=BOX_SIDE, sw=3.5),
        '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="3.5"/>' % (f(x0), f(y0), f(w), f(h), BOX, INK),
        '<clipPath id="lidphoto"><rect x="%s" y="%s" width="%s" height="%s"/></clipPath>' % (f(px), f(py), f(pw), f(ph)),
        '<image href="%s" x="%s" y="%s" width="%s" height="%s" preserveAspectRatio="xMidYMid slice" clip-path="url(#lidphoto)"/>' % (box_art_uri(), f(px), f(py), f(pw), f(ph)),
        '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2.4"/>' % (f(px), f(py), f(pw), f(ph), BOX_GOLD),
        '<text x="%s" y="%s" class="lid" font-size="%s">EL</text>' % (f(tx), f(y0 + h * 0.3), f(h * 0.16)),
        '<text x="%s" y="%s" class="lid" font-size="%s" textLength="%s" lengthAdjust="spacingAndGlyphs">CABEZA</text>' % (f(tx), f(y0 + h * 0.47), f(h * 0.16), f(w * 0.33)),
        '<rect x="%s" y="%s" width="%s" height="2.2" fill="%s"/>' % (f(x0 + w * 0.64), f(y0 + h * 0.57), f(w * 0.3), BOX_GOLD),
        '<text x="%s" y="%s" class="tag" font-size="%s" textLength="%s" lengthAdjust="spacingAndGlyphs">A Game of Unparalleled Intention</text>' % (f(tx), f(y0 + h * 0.67), f(h * 0.05), f(w * 0.3)),
        '<text x="%s" y="%s" class="small" font-size="%s" textLength="%s" lengthAdjust="spacingAndGlyphs">2 PLAYERS · AGES 10 TO ADULT</text>' % (f(tx), f(y0 + h * 0.8), f(h * 0.036), f(w * 0.28)),
        '<rect x="%s" y="%s" width="%s" height="%s" fill="#F4EFE2" stroke="#BFB49E" stroke-width="0.8"/>' % (f(x0 + w * 0.84), f(y0 + h * 0.06), f(w * 0.13), f(h * 0.1)),
        '<text x="%s" y="%s" class="price" font-size="%s">7.97</text>' % (f(x0 + w * 0.905), f(y0 + h * 0.135), f(h * 0.06)),
        # A gleam across the lid's varnish.
        path("M%s %s L%s %s L%s %s L%s %s Z" % (f(x0 + 20), f(y0), f(x0 + 70), f(y0), f(x0 + 10), f(-y0), f(x0 - 40), f(-y0)), fill="#FFFFFF", sw=0, opacity="0.12", clip_path="url(#lidclip)"),
    ]
    clip = '<clipPath id="lidclip"><rect x="%s" y="%s" width="%s" height="%s"/></clipPath>' % (f(x0), f(y0), f(w), f(h))
    return g([clip] + out, transform="translate(%s %s) rotate(%s)" % (f(BOX_C[0]), f(BOX_C[1]), f(BOX_ROT)))


def box_point(u, v):
    """A point on the lid (u, v in -1..1) in the picture."""
    a = math.radians(BOX_ROT)
    x, y = u * BOX_W / 2, v * BOX_H / 2
    return (BOX_C[0] + x * math.cos(a) - y * math.sin(a), BOX_C[1] + x * math.sin(a) + y * math.cos(a))


# ------------------------------------------------------------------ Dad

def dad_body():
    """The leisure suit: powder blue, wide lapels, white top-stitching;
    the shirt open on a gold medallion; the dagger collar out over the
    lapels."""
    out = []
    # The jacket, shoulders to the frame's foot (the others stand in front).
    out.append(path("M150 560 C150 520 178 500 222 494 L278 494 C322 500 350 520 350 560 L362 1100 L138 1100 Z", fill=SUIT, sw=3.5))
    # Its shadow side.
    out.append(path("M150 560 C150 600 156 700 160 1100 L138 1100 Z", fill=SUIT_SH, sw=0))
    # The shirt in the V.
    out.append(path("M222 494 L278 494 L262 640 L250 664 L238 640 Z", fill=SHIRT, sw=3))
    # Chest hair, and the medallion on its chain.
    out.append(path("M238 520 C244 516 256 516 262 520 C258 540 242 540 238 520 Z", fill=DAD_HAIR, sw=0))
    out.append(path("M236 506 C238 540 246 562 250 572 C254 562 262 540 264 506", stroke=GOLD, sw=2.2))
    out.append(circle(250, 582, 12, fill=GOLD, stroke=GOLD_SH, sw=2.4))
    out.append(path(star(250, 582, 7, k=0.45, rot=0.4), fill="#FCE7A0", sw=0))
    # The lapels: wide, peaked.
    out.append(path("M222 494 C214 520 206 560 200 600 L236 646 L232 600 L250 664 C238 620 230 560 226 494 Z", fill=SUIT_HI, sw=3))
    out.append(path("M278 494 C286 520 294 560 300 600 L264 646 L268 600 L250 664 C262 620 270 560 274 494 Z", fill=SUIT_HI, sw=3))
    # The dagger collar, out over them.
    out.append(path("M224 492 L190 540 L214 548 L238 506 Z", fill=SHIRT, sw=3))
    out.append(path("M276 492 L310 540 L286 548 L262 506 Z", fill=SHIRT, sw=3))
    # Top-stitching.
    out.append(path("M206 584 L232 618 M294 584 L268 618", stroke="#F4FAFF", sw=1.4, stroke_dasharray="4 4"))
    # A button, low, as they wore them.
    out.append(circle(250, 720, 6, fill=SUIT_SH, sw=2))
    return "".join(out)


def dad_arms_back():
    """The arms, raised, the jacket's sleeves riding up them (a fold or
    two), the shirt's orange cuffs, his hands under the box's corners."""
    l_hand = box_point(-0.9, 0.98)
    r_hand = box_point(0.9, 0.98)
    out = []
    lpts = [(178, 556), (138, 476), (116, 410), (l_hand[0] + 6, l_hand[1] + 34)]
    rpts = [(322, 556), (362, 474), (384, 404), (r_hand[0] - 6, r_hand[1] + 34)]
    for pts, s in ((lpts, 1), (rpts, -1)):
        out.append(path(limb(pts, [70, 56, 50, 44], cap_end=False), fill=SUIT, sw=3.6))
        # The shadow down the inside of the arm, in the screen's dots.
        inner = [(x + s * 14, y) for (x, y) in pts]
        out.append(path(limb(inner, [22, 18, 16, 12], cap_end=False), fill="url(#dots-suit)", sw=0))
        # Folds at the elbow.
        ex, ey = pts[2]
        out.append(path("M%s %s c%s -6 %s -6 %s -2" % (f(ex - 18), f(ey + 4), f(8), f(18), f(26)), stroke=SUIT_SH, sw=2.2))
        out.append(path("M%s %s c%s -5 %s -5 %s -1" % (f(ex - 12), f(ey + 16), f(6), f(14), f(20)), stroke=SUIT_SH, sw=2))
    for (hx, hy), s in ((l_hand, 1), (r_hand, -1)):
        out.append(path(limb([(hx + 6 * s, hy + 46), (hx + 4 * s, hy + 24)], [46, 44], cap_end=False), fill=SHIRT, sw=3))
        out.append(path("M%s %s L%s %s" % (f(hx - 18 + 6 * s), f(hy + 36), f(hx + 20 + 6 * s), f(hy + 34)), stroke=SHIRT_SH, sw=2))
        # The back of the hand, under the corner.
        out.append(path("M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s C%s %s %s %s %s %s Z" % (
            f(hx - 22), f(hy + 26), f(hx - 26), f(hy + 8), f(hx - 18), f(hy - 6), f(hx), f(hy - 8),
            f(hx + 18), f(hy - 6), f(hx + 26), f(hy + 8), f(hx + 22), f(hy + 26),
            f(hx + 8), f(hy + 32), f(hx - 8), f(hy + 32), f(hx - 22), f(hy + 26)), fill=SKIN, sw=3))
    return "".join(out)


def dad_fingers():
    """His fingers curled up over the lid's lower corners, in front of it,
    and his thumbs along its ends."""
    out = []
    for s in (-1, 1):
        for k in range(4):
            u = s * (0.94 - 0.068 * k)
            reach = 0.74 - 0.05 * (k in (1, 2))
            p0 = box_point(u, 1.08)
            p1 = box_point(u, reach)
            out.append(path(limb([p0, p1], [14.5, 12.5]), fill=SKIN, sw=2.4))
            tip = box_point(u, reach + 0.05)
            out.append(path("M%s %s l%s %s" % (f(tip[0] - 3.5), f(tip[1] + 1), f(7), f(-0.7)), stroke=SKIN_SH, sw=1.3))
    return "".join(out)


def dad_head():
    """Looking up at it, adoring: brows up, eyes rolled up to it, a grin
    under a big horseshoe moustache; the blow-dried hair of the day over
    his ears, the sideburns long."""
    o = []
    # The neck, the head tipped back a little: under the jaw in shadow.
    o.append(path("M-21 46 C-22 60 -24 72 -26 80 L26 80 C24 72 22 60 21 46 Z", fill=SKIN, sw=3))
    o.append(path("M-23 54 C-12 68 12 68 23 54 L25 72 C12 79 -12 79 -25 72 Z", fill=SKIN_SH, sw=0, opacity="0.8"))
    for sd in (-1, 1):
        o.append(ellipse(sd * 55, 8, 9, 15, fill=SKIN, sw=3))
    face = "M0 -60 C32 -60 54 -40 54 -8 C54 20 46 40 32 54 C22 62 10 66 0 66 C-10 66 -22 62 -32 54 C-46 40 -54 20 -54 -8 C-54 -40 -32 -60 0 -60 Z"
    o.append(path(face, fill=SKIN, sw=3.6))
    o.append(path("M-54 -8 C-54 20 -46 40 -32 54 C-42 38 -46 18 -45 -8 Z", fill=SKIN_SH, sw=0, opacity="0.7"))
    for sd in (-1, 1):
        o.append(ellipse(sd * 33, 16, 10, 5.5, fill=BLUSH, sw=0, opacity="0.45"))
    # The hair: full and rounded, parted, swept across, over his ears.
    o.append(path("M-63 20 C-76 -18 -66 -72 -20 -86 C12 -94 54 -86 66 -54 C76 -30 74 -2 63 20 C59 8 57 -2 55 -12 C50 -38 34 -52 12 -54 C-6 -48 -26 -52 -42 -42 C-51 -34 -55 -22 -55 -12 C-57 0 -59 10 -63 20 Z", fill=DAD_HAIR, sw=3.6))
    o.append(path("M-50 -54 C-30 -72 0 -80 34 -72", stroke=DAD_HAIR_HI, sw=3))
    o.append(path("M-56 -30 C-46 -52 -22 -64 6 -66", stroke=DAD_HAIR_HI, sw=2.2))
    o.append(path("M40 -64 C52 -54 60 -40 62 -24", stroke=DAD_HAIR_HI, sw=2.2))
    # The sideburns, long and tapering.
    for sd in (-1, 1):
        o.append(path("M%s -14 C%s 8 %s 24 %s 38 C%s 26 %s 10 %s -12 Z" % (f(sd * 53.5), f(sd * 53), f(sd * 50), f(sd * 46), f(sd * 43), f(sd * 41), f(sd * 41)), fill=DAD_HAIR, sw=2.2))
    # Brows, way up.
    o.append(path("M-40 -27 C-31 -39 -15 -40 -7 -31", stroke=DAD_HAIR, sw=6.5))
    o.append(path("M7 -31 C15 -40 31 -39 40 -27", stroke=DAD_HAIR, sw=6.5))
    # Eyes rolled up to the box.
    for sd in (-1, 1):
        cx = sd * 22
        o.append('<clipPath id="dadeye%d"><ellipse cx="%s" cy="-11" rx="11.5" ry="9"/></clipPath>' % (sd + 1, f(cx)))
        o.append(ellipse(cx, -11, 11.5, 9, fill=EYE_W, sw=2.6))
        o.append(g([circle(cx + 1, -16.5, 6.2, fill="#4A3020", sw=0), circle(cx + 1, -16.5, 3.1, fill=INK, sw=0)], clip_path="url(#dadeye%d)" % (sd + 1)))
        o.append(circle(cx + 3, -18.5, 1.8, fill="#FFFFFF", sw=0))
        o.append(path("M%s -12 C%s -22 %s -22 %s -12" % (f(cx - 12.5), f(cx - 6), f(cx + 6), f(cx + 12.5)), stroke=INK, sw=2.8))
        o.append(path("M%s -1 C%s 2 %s 2 %s -1" % (f(cx - 8), f(cx - 3), f(cx + 3), f(cx + 8)), stroke=SKIN_SH, sw=1.6))
    o.append(path("M-1 -5 C-3 5 -11 13 -7 18 C-3 21 6 21 10 16", fill="none", sw=2.6))
    o.append(path("M-5 17 C-3 15 -1 15 0 17 M4 17 C5 15 7 15 8 17", stroke=SKIN_SH, sw=2))
    # The grin: open, teeth, the moustache over it.
    o.append(path("M-19 34 C-8 37 8 37 19 34 C15 54 -15 54 -19 34 Z", fill=MOUTH, sw=3))
    o.append(path("M-17 34.5 C-6 37.5 6 37.5 17 34.5 L15.5 40.5 C5 43 -5 43 -15.5 40.5 Z", fill=TEETH, sw=0))
    o.append(ellipse(0, 48, 7.5, 3.6, fill=TONGUE, sw=0))
    o.append(path("M-29 31 C-23 20 -9 18 0 22 C9 18 23 20 29 31 C31 38 29 48 26 56 C21 48 17 38 9 35 C4 34 -4 34 -9 35 C-17 38 -21 48 -26 56 C-29 48 -31 38 -29 31 Z", fill=DAD_HAIR, sw=2.6))
    o.append(path("M-19 26 C-13 24 -6 24 -2 26 M2 26 C6 24 13 24 19 26", stroke=DAD_HAIR_HI, sw=1.6))
    o.append(path("M-3 60 C-1 63 1 63 3 60", stroke=SKIN_SH, sw=2))
    return g(o, transform="translate(250 410) rotate(3) scale(1.08)")


# ------------------------------------------------------------------ Mom

def mom():
    """Swooning, as in the pictures: the back of one hand to her brow, the
    other on her heart, eyes shut, a tear of joy; feathered hair, gold
    hoops, an avocado turtleneck."""
    o = []
    # Hair behind: big, to the shoulders, the ends flipped out.
    o.append(path("M-86 -10 C-96 -70 -50 -112 4 -110 C60 -108 98 -66 88 -8 C84 20 92 44 106 60 C86 70 66 60 60 46 L-60 46 C-66 60 -86 70 -106 60 C-92 44 -84 20 -86 -10 Z", fill=MOM_HAIR, sw=3.6))
    o.append(path("M-86 -10 C-84 20 -92 44 -106 60 C-86 68 -70 60 -64 48 C-74 34 -78 12 -76 -14 Z", fill="url(#dots-hair)", sw=0))
    o.append(path("M88 -8 C84 20 92 44 106 60 C88 68 72 60 66 48 C76 34 80 12 78 -14 Z", fill="url(#dots-hair)", sw=0))
    # Shoulders and the turtleneck.
    o.append(path("M-86 150 C-86 104 -58 86 -24 80 L24 80 C58 86 86 104 86 150 L86 330 L-86 330 Z", fill=SWEATER, sw=3.6))
    o.append(path("M-86 150 C-86 106 -68 92 -52 86 C-62 112 -66 160 -66 330 L-86 330 Z", fill="url(#dots-sweater)", sw=0))
    o.append(path("M-26 52 L-28 92 C-10 100 10 100 28 92 L26 52 Z", fill=SWEATER, sw=3))
    for k in range(6):
        x = -20 + k * 8
        o.append(path("M%s 56 L%s 92" % (f(x), f(x - 1)), stroke=SWEATER_SH, sw=1.8))
    # The long chain and pendant.
    o.append(path("M-18 92 C-12 126 -4 150 0 160 C4 150 12 126 18 92", stroke=GOLD, sw=2))
    o.append(ellipse(0, 168, 7, 10, fill=GOLD, stroke=GOLD_SH, sw=2))
    # The face.
    face = "M0 -58 C27 -58 44 -40 44 -12 C44 16 35 38 21 50 C13 56 6 58 0 58 C-6 58 -13 56 -21 50 C-35 38 -44 16 -44 -12 C-44 -40 -27 -58 0 -58 Z"
    o.append(path(face, fill=SKIN, sw=3.6))
    o.append(path("M-44 -12 C-44 16 -35 38 -21 50 C-31 34 -35 14 -35 -12 Z", fill=SKIN_SH, sw=0, opacity="0.6"))
    for sd in (-1, 1):
        o.append(ellipse(sd * 25, 18, 10, 6, fill=BLUSH, sw=0, opacity="0.55"))
    # Eyes shut, lashes long, blue on the lids; the brows lifted.
    for sd in (-1, 1):
        cx = sd * 17
        o.append(path("M%s -1 C%s -8 %s -8 %s -1" % (f(cx - 9), f(cx - 3), f(cx + 3), f(cx + 9)), stroke="#7FB2D6", sw=5, opacity="0.75"))
        o.append(path("M%s 0 C%s 7 %s 7 %s 0" % (f(cx - 10), f(cx - 4), f(cx + 4), f(cx + 10)), stroke=INK, sw=3))
        for k, dx in enumerate((-6, 0, 6)):
            o.append(path("M%s %s l%s 5" % (f(cx + dx), f(4.6 + (k == 1) * 0.8), f(dx * 0.25 + sd * 0.8)), stroke=INK, sw=1.8))
        o.append(path("M%s -17 C%s -26 %s -26 %s -16" % (f(cx - 11), f(cx - 4), f(cx + 4), f(cx + 11)), stroke="#8A5A2A", sw=2.6))
    # A tear of joy.
    o.append(path("M26 8 C22 16 22 22 26 23 C30 22 30 16 26 8 Z", fill="#CFE8F6", sw=1.8))
    o.append(path("M0 2 C-2 12 -6 18 -2 21 C0 22 3 22 5 20", stroke=SKIN_SH, sw=2.4))
    # The dreamy smile.
    o.append(path("M-14 32 C-6 37 6 37 14 32 C10 43 -10 43 -14 32 Z", fill=LIPS, sw=2.4))
    o.append(path("M-12 33 C-4 36.5 4 36.5 12 33", stroke="#8E2618", sw=1.6))
    # The front of the hair: feathered back in wings from a centre part,
    # the wings' feathers drawn in.
    for sd in (-1, 1):
        o.append(path("M4 -106 C%s -106 %s -86 %s -50 C%s -28 %s -8 %s 10 L%s -2 L%s 9 L%s -6 L%s 4 C%s -12 %s -26 %s -34 C%s -42 %s -46 %s -47 C%s -47 4 -46 4 -50 Z" % (
            f(sd * 34 + 4), f(sd * 68), f(sd * 76), f(sd * 80), f(sd * 76), f(sd * 66),
            f(sd * 61), f(sd * 57), f(sd * 53), f(sd * 50),
            f(sd * 48), f(sd * 46), f(sd * 40), f(sd * 32), f(sd * 20), f(sd * 10), f(sd * 4)), fill=MOM_HAIR, sw=3))
    for sd in (-1, 1):
        o.append(path("M%s -92 C%s -82 %s -64 %s -44" % (f(sd * 14), f(sd * 40), f(sd * 52), f(sd * 56)), stroke=MOM_HAIR_HI, sw=2.8))
        o.append(path("M%s -76 C%s -66 %s -50 %s -30" % (f(sd * 20), f(sd * 34), f(sd * 44), f(sd * 48)), stroke=MOM_HAIR_SH, sw=2))
        o.append(path("M%s -40 C%s -30 %s -16 %s -4" % (f(sd * 66), f(sd * 70), f(sd * 70), f(sd * 64)), stroke=MOM_HAIR_SH, sw=2))
        o.append(path("M%s 10 C%s 24 %s 40 %s 56" % (f(sd * 84), f(sd * 86), f(sd * 92), f(sd * 100)), stroke=MOM_HAIR_SH, sw=2))
    # Gold hoops.
    for sd in (-1, 1):
        o.append(circle(sd * 46, 34, 11, fill="none", stroke=GOLD, sw=3.4))
    # The hand on her heart.
    o.append(path("M14 128 C10 112 18 100 32 100 C46 100 54 110 52 124 C50 138 36 146 26 144 C18 142 15 136 14 128 Z", fill=SKIN, sw=2.8))
    for k in range(3):
        o.append(path("M%s %s l%s %s" % (f(24 + k * 8), f(104 + k * 1.5), f(2), f(16)), stroke=SKIN_SH, sw=1.6))
    o.append(path(limb([(70, 210), (56, 168), (36, 134)], [34, 30, 26], cap_end=False), fill=SWEATER, sw=3))
    # The other arm up, the back of its hand to her brow.
    o.append(path(limb([(-74, 110), (-104, 40), (-62, -34)], [36, 30, 26], cap_end=False), fill=SWEATER, sw=3.4))
    o.append(path(limb([(-80, 104), (-100, 52)], [12, 10]), fill="url(#dots-sweater)", sw=0))
    o.append(path("M-70 -26 C-66 -46 -46 -60 -24 -58 C-8 -56 0 -48 -2 -40 C-6 -34 -18 -34 -24 -30 C-34 -24 -46 -14 -58 -14 C-66 -14 -72 -18 -70 -26 Z", fill=SKIN, sw=2.8))
    for k in range(3):
        o.append(path("M%s %s C%s %s %s %s %s %s" % (f(-40 + k * 9), f(-54 + k * 2), f(-36 + k * 9), f(-48 + k * 2), f(-32 + k * 9), f(-44 + k * 2), f(-30 + k * 9), f(-40 + k * 2)), stroke=SKIN_SH, sw=1.5))
    return g(o, transform="translate(134 614) rotate(-14)")


# ------------------------------------------------------------------ the boy

def son():
    """Gasping: hands flat on his cheeks, elbows out, mouth an O, eyes up at
    it; a bowl cut and a ringer tee with a stripe across it."""
    o = []
    # His upper arms first, under the tee's sleeves.
    for sd in (-1, 1):
        o.append(path(limb([(sd * 58, 96), (sd * 80, 146)], [32, 29], cap_end=False), fill=SKIN, sw=3))
    # The tee: the body and its short sleeves, out over the upper arms.
    o.append(path("M-60 100 C-60 84 -44 74 -22 70 L22 70 C44 74 60 84 60 100 L84 132 L66 150 L62 140 L66 400 L-66 400 L-62 140 L-66 150 L-84 132 Z", fill=TEE, sw=3.6))
    o.append(path("M-60 100 L-84 132 L-66 150 L-62 140 L-64 400 L-48 400 L-50 110 Z", fill="url(#dots-tee)", sw=0))
    o.append(path("M-64 176 L64 176 L64 194 L-64 194 Z", fill=TEE_S1, sw=0))
    o.append(path("M-64 194 L64 194 L65 210 L-65 210 Z", fill=TEE_S2, sw=0))
    o.append(path("M-84 132 L-66 150", stroke=TEE_RING, sw=7))
    o.append(path("M84 132 L66 150", stroke=TEE_RING, sw=7))
    o.append(path("M-22 70 C-14 84 14 84 22 70", stroke=TEE_RING, sw=7))
    # The neck.
    o.append(path("M-16 44 L-16 76 C-8 82 8 82 16 76 L16 44 Z", fill=SKIN, sw=3))
    # The face, round.
    face = "M0 -52 C28 -52 44 -34 44 -6 C44 24 26 48 0 48 C-26 48 -44 24 -44 -6 C-44 -34 -28 -52 0 -52 Z"
    o.append(path(face, fill=SKIN, sw=3.6))
    o.append(path("M-44 -6 C-44 24 -26 48 0 48 C-24 40 -36 22 -36 -6 Z", fill=SKIN_SH, sw=0, opacity="0.55"))
    for (x, y) in [(-22, 8), (-17, 12), (-25, 13), (20, 8), (25, 12), (17, 12)]:
        o.append(circle(x, y, 1.4, fill="#B86A44", sw=0))
    for sd in (-1, 1):
        cx = sd * 16
        o.append('<clipPath id="soneye%d"><ellipse cx="%s" cy="-10" rx="9" ry="11"/></clipPath>' % (sd + 1, f(cx)))
        o.append(ellipse(cx, -10, 9, 11, fill=EYE_W, sw=2.6))
        o.append(g([circle(cx - 1, -16, 5.5, fill="#5A3A22", sw=0), circle(cx - 1, -16, 2.8, fill=INK, sw=0)], clip_path="url(#soneye%d)" % (sd + 1)))
        o.append(circle(cx + 1, -18, 1.6, fill="#FFFFFF", sw=0))
        o.append(path("M%s -30 C%s -36 %s -36 %s -31" % (f(cx - 8), f(cx - 3), f(cx + 3), f(cx + 8)), stroke=SON_HAIR_SH, sw=3))
    o.append(path("M-2 0 C-3 6 -5 10 -2 12 C0 13 3 12 4 11", stroke=SKIN_SH, sw=2.2))
    o.append(ellipse(0, 28, 8, 11, fill=MOUTH, sw=2.8))
    o.append(ellipse(0, 34, 5, 3, fill=TONGUE, sw=0))
    # The bowl cut, straight across the brows.
    o.append(path("M-48 4 C-54 -44 -28 -66 0 -66 C28 -66 54 -44 48 4 C46 -6 44 -14 40 -22 L-40 -22 C-44 -14 -46 -6 -48 4 Z", fill=SON_HAIR, sw=3.6))
    for x in (-30, -18, -6, 6, 18, 30):
        o.append(path("M%s -22 L%s -40" % (f(x), f(x + 2)), stroke=SON_HAIR_SH, sw=1.8))
    o.append(path("M-30 -56 C-14 -62 10 -62 28 -56", stroke="#9A5C30", sw=2.6))
    # His forearms up from the elbows, his hands flat on his cheeks.
    for sd in (-1, 1):
        o.append(path(limb([(sd * 80, 150), (sd * 72, 106), (sd * 52, 58)], [30, 27, 24], cap_end=False), fill=SKIN, sw=3))
        hand = "M%s 62 C%s 46 %s 22 %s 4 C%s -6 %s -8 %s -2 C%s 16 %s 40 %s 62 Z" % (
            f(sd * 58), f(sd * 56), f(sd * 50), f(sd * 44), f(sd * 42), f(sd * 34), f(sd * 32), f(sd * 34), f(sd * 36), f(sd * 42))
        o.append(path(hand, fill=SKIN, sw=2.8))
        for k in range(3):
            o.append(path("M%s %s L%s %s" % (f(sd * (37 + k * 5)), f(6 + k * 3), f(sd * (41 + k * 5)), f(30 + k * 3)), stroke=SKIN_SH, sw=1.6))
    return g(o, transform="translate(380 708) rotate(6)")


# ------------------------------------------------------------------ the girl

def girl():
    """Starry-eyed, hands clasped under her chin; pigtails tied with yarn,
    an orange dress with puffed sleeves and a white collar."""
    o = []
    o.append(path("M-58 110 C-58 86 -40 74 -20 68 L20 68 C40 74 58 86 58 110 L72 330 L-72 330 Z", fill=DRESS, sw=3.6))
    o.append(path("M-58 110 C-58 92 -50 82 -40 76 C-46 108 -50 150 -52 330 L-72 330 Z", fill="url(#dots-dress)", sw=0))
    # Puffed sleeves.
    for sd in (-1, 1):
        o.append(path("M%s 82 C%s 76 %s 82 %s 104 C%s 124 %s 132 %s 126 C%s 116 %s 98 %s 82 Z" % (
            f(sd * 40), f(sd * 60), f(sd * 76), f(sd * 76), f(sd * 76), f(sd * 64), f(sd * 52), f(sd * 44), f(sd * 42), f(sd * 40)), fill=DRESS, sw=3))
        o.append(path("M%s 92 C%s 104 %s 116 %s 124" % (f(sd * 58), f(sd * 62), f(sd * 62), f(sd * 58)), stroke=DRESS_SH, sw=2))
    o.append(path("M-34 64 C-30 86 -8 92 0 80 C8 92 30 86 34 64 C20 70 -20 70 -34 64 Z", fill=COLLAR, sw=3))
    # Pigtails, out each side.
    for sd in (-1, 1):
        o.append(path("M%s -10 C%s -20 %s -20 %s 4 C%s 26 %s 40 %s 52 C%s 40 %s 18 %s -2 Z" % (
            f(sd * 40), f(sd * 66), f(sd * 80), f(sd * 82), f(sd * 84), f(sd * 76), f(sd * 66), f(sd * 58), f(sd * 52), f(sd * 44)), fill=GIRL_HAIR, sw=3))
        o.append(path("M%s 8 C%s 20 %s 32 %s 42" % (f(sd * 68), f(sd * 72), f(sd * 72), f(sd * 68)), stroke=GIRL_HAIR_SH, sw=2))
        o.append(path("M%s -8 l%s -10 l%s 4 l%s 10 Z" % (f(sd * 46), f(sd * 10), f(sd * 8), f(sd * -8)), fill=YARN, sw=2.2))
        o.append(path("M%s -8 l%s -12 l%s -2 l%s 12 Z" % (f(sd * 46), f(sd * -2), f(sd * -9), f(sd * 2)), fill=YARN, sw=2.2))
    face = "M0 -48 C26 -48 40 -30 40 -4 C40 22 24 44 0 44 C-24 44 -40 22 -40 -4 C-40 -30 -26 -48 0 -48 Z"
    o.append(path(face, fill=SKIN, sw=3.6))
    o.append(path("M-40 -4 C-40 22 -24 44 0 44 C-22 36 -32 20 -32 -4 Z", fill=SKIN_SH, sw=0, opacity="0.5"))
    for sd in (-1, 1):
        o.append(ellipse(sd * 22, 14, 8, 5, fill=BLUSH, sw=0, opacity="0.6"))
    for sd in (-1, 1):
        cx = sd * 15
        o.append(ellipse(cx, -8, 10, 12, fill=INK, sw=0))
        o.append(ellipse(cx, -8, 8.2, 10.2, fill="#4A2A18", sw=0))
        o.append(path(star(cx + 2, -13, 5, k=0.3), fill="#FFFFFF", sw=0))
        o.append(circle(cx - 4, -2, 2, fill="#FFFFFF", sw=0))
        o.append(path("M%s -20 l-3 -4 M%s -21 l0 -5 M%s -20 l3 -4" % (f(cx - 6), f(cx), f(cx + 6)), stroke=INK, sw=1.8))
    o.append(path("M-1 2 C-2 6 -3 9 0 10 C2 10 3 9 4 8", stroke=SKIN_SH, sw=2))
    o.append(path("M-12 20 C-6 24 6 24 12 20 C10 32 -10 32 -12 20 Z", fill=MOUTH, sw=2.6))
    o.append(path("M-10 21 C-4 23.5 4 23.5 10 21 L9 24 C3 25.5 -3 25.5 -9 24 Z", fill=TEETH, sw=0))
    o.append(path("M-44 0 C-50 -40 -24 -60 0 -60 C24 -60 50 -40 44 0 C40 -14 36 -22 30 -28 C20 -22 8 -24 2 -32 C-6 -24 -22 -22 -32 -28 C-38 -20 -42 -10 -44 0 Z", fill=GIRL_HAIR, sw=3.6))
    o.append(path("M-22 -50 C-10 -55 10 -55 22 -50", stroke="#B85A30", sw=2.4))
    # Her arms in from the sleeves, her hands clasped under her chin.
    for sd in (-1, 1):
        o.append(path(limb([(sd * 60, 122), (sd * 50, 112), (sd * 16, 88)], [24, 22, 20], cap_end=False), fill=SKIN, sw=3))
    o.append(path("M-14 86 C-20 66 -14 46 0 44 C14 46 20 66 14 86 C8 92 -8 92 -14 86 Z", fill=SKIN, sw=2.8))
    o.append(path("M0 48 L0 88 M-6 56 C-3 58 3 58 6 56 M-7 66 C-3 68 3 68 7 66", stroke=SKIN_SH, sw=1.6))
    return g(o, transform="translate(118 878) rotate(-5)")


# ------------------------------------------------------------------ the dog

def dog():
    """A beagle, gazing up at it too, tongue out."""
    o = []
    o.append(path("M-60 60 C-66 20 -40 -6 0 -6 C40 -6 66 20 60 60 L70 200 L-70 200 Z", fill=DOG, sw=3.5))
    o.append(path("M-20 10 C-14 40 14 40 20 10 L28 200 L-28 200 Z", fill=DOG_WHITE, sw=3))
    # The head.
    o.append(path("M0 -78 C30 -78 46 -56 44 -28 C42 -2 26 20 0 22 C-26 20 -42 -2 -44 -28 C-46 -56 -30 -78 0 -78 Z", fill=DOG, sw=3.5))
    o.append(path("M-6 -76 C-10 -50 -16 -20 -14 0 C-6 8 6 8 14 0 C16 -20 10 -50 6 -76 Z", fill=DOG_WHITE, sw=0))
    o.append(path("M-30 -2 C-30 18 30 18 30 -2 C26 -18 -26 -18 -30 -2 Z", fill=DOG_WHITE, sw=3))
    # Ears, long.
    for s in (-1, 1):
        o.append(path("M%s -58 C%s -54 %s -20 %s 18 C%s 30 %s 30 %s 12 C%s -10 %s -40 %s -58 Z" % (
            f(s * 34), f(s * 60), f(s * 64), f(s * 58), f(s * 54), f(s * 44), f(s * 40), f(s * 38), f(s * 36), f(s * 34)), fill=DOG_EAR, sw=3))
    # Eyes up, adoring.
    for s in (-1, 1):
        cx = s * 16
        o.append(ellipse(cx, -40, 8, 8.5, fill=EYE_W, sw=2.4))
        o.append(circle(cx, -44, 5, fill=INK, sw=0))
        o.append(circle(cx + 1.5, -46, 1.5, fill="#FFFFFF", sw=0))
        o.append(path("M%s -54 C%s -58 %s -58 %s -54" % (f(cx - 8), f(cx - 3), f(cx + 3), f(cx + 8)), stroke=DOG_EAR, sw=2.6))
    # Nose and tongue.
    o.append(ellipse(0, -14, 9, 6, fill=INK, sw=0))
    o.append(circle(-3, -16, 1.6, fill="#FFFFFF", sw=0))
    o.append(path("M0 -8 L0 2 M-12 2 C-6 8 6 8 12 2", stroke=INK, sw=2.4))
    o.append(path("M-7 6 C-8 18 -4 26 0 26 C4 26 8 18 7 6 Z", fill="#E77B86", sw=2.4))
    o.append(path("M0 8 L0 20", stroke="#B8505C", sw=1.6))
    return g(o, transform="translate(262 1006) rotate(-4)")


def build_svg():
    style = """
      @font-face { font-family: 'Bodoni Moda'; font-weight: 700; src: url('fonts/BodoniModa-Bold-latin.woff2') format('woff2'); }
      @font-face { font-family: 'Bodoni Moda Italic'; src: url('fonts/BodoniModa-Italic.ttf'); }
      @font-face { font-family: 'Libre Franklin'; font-weight: 100 900; src: url('fonts/LibreFranklin.ttf'); }
      @font-face { font-family: 'Courier Prime'; font-weight: 700; src: url('fonts/CourierPrime-Bold.ttf'); }
      text { text-anchor: middle; dominant-baseline: middle; }
      .lid { font-family: 'Bodoni Moda', serif; font-weight: 700; fill: %s; }
      .tag { font-family: 'Bodoni Moda Italic', serif; font-style: italic; fill: #E9DCC0; }
      .small { font-family: 'Libre Franklin', sans-serif; font-weight: 700; fill: %s; letter-spacing: 0.1em; }
      .price { font-family: 'Courier Prime', monospace; font-weight: 700; fill: #6B2A22; }
      path, ellipse, rect { stroke-linejoin: round; stroke-linecap: round; }
    """ % (BOX_CREAM, BOX_GOLD)
    dots = "".join(
        '<pattern id="dots-%s" width="5.6" height="5.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.8" cy="2.8" r="%s" fill="%s"/></pattern>' % (k, r, c)
        for k, c, r in [("suit", SUIT_SH, 1.9), ("sweater", SWEATER_SH, 2.0), ("tee", TEE_SH, 2.0), ("dress", DRESS_SH, 2.0), ("hair", MOM_HAIR_SH, 1.9), ("dog", DOG_SH, 1.9)])
    defs = """<defs>
      <radialGradient id="glow"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.45" stop-color="#FFF8E0" stop-opacity="0.55"/><stop offset="1" stop-color="#FFF8E0" stop-opacity="0"/></radialGradient>
      <filter id="inked" x="-2%%" y="-2%%" width="104%%" height="104%%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="75" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter>
      %s
    </defs>""" % dots
    body = [
        background(),
        g([sparkles()], filter="url(#inked)"),
        g([dad_body(), dad_arms_back()], filter="url(#inked)"),
        game_box(),
        g([dad_fingers(), dad_head(), mom(), son(), girl(), dog()], filter="url(#inked)"),
    ]
    return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d"><style>%s</style>%s%s</svg>' % (W, H, W, H, style, defs, "".join(body))


def render():
    with open(SVG, "w") as fh:
        fh.write(build_svg())
    subprocess.run(["node", os.path.join(TOOLS, "svg_render.mjs"), SVG, RAW, "2"], check=True)


def print_it():
    """Printed: the plates a hair out of register (magenta one way, yellow
    the other, against the black's line), the ink spread a little into the
    groundwood, a little mottle."""
    im = Image.open(RAW).convert("RGB")
    a = np.asarray(im).astype(np.float32) / 255
    c, m, y = 1 - a[..., 0], 1 - a[..., 1], 1 - a[..., 2]
    k = np.minimum(np.minimum(c, m), y)
    c, m, y = c - k, m - k, y - k
    m = np.roll(m, (1, 2), axis=(0, 1))
    y = np.roll(y, (-2, -1), axis=(0, 1))
    rng = np.random.default_rng(75)
    hh, ww = k.shape
    mottle = Image.fromarray((rng.uniform(0, 1, (hh // 24 + 2, ww // 24 + 2)) * 255).astype(np.uint8), "L").resize((ww + 48, hh + 48), Image.BICUBIC).crop((0, 0, ww, hh))
    mottle = (np.asarray(mottle, np.float32) / 255 - 0.5) * 0.08
    out = np.stack([1 - np.clip(c + k, 0, 1), 1 - np.clip(m + k, 0, 1), 1 - np.clip(y + k, 0, 1)], -1)
    ink = 1 - out.mean(-1, keepdims=True)
    out = np.clip(out - mottle[..., None] * ink, 0, 1)
    img = Image.fromarray((out * 255).astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(0.7))
    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, quality=86, optimize=True, progressive=True)
    print("wrote", OUT, img.size, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    import sys
    render()
    print_it()
    # (The drawing and its raw render are only steps on the way; --keep
    # leaves them to look at.)
    if "--keep" not in sys.argv:
        os.remove(SVG)
        os.remove(RAW)
