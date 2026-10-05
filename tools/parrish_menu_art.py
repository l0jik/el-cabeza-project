"""Parrish's menus, painted (user: "all menus for Orinoco & Watermark must
have theme appropriate artistic updates made").

Four pictures, made here so they can be made again:

  menu-paint-orinoco.webp     a panel's ground: ivory laid in loose,
  menu-paint-watermark.webp   overlapping brush strokes (pale cream, warm
                              light, now and then a breath of sky blue) for
                              Orinoco; wine and madder over umber, a little
                              rose and old gold, for Watermark. Seamless, so
                              a tall panel can repeat it.
  menu-edge.webp              a panel's edge, painted: an alpha mask whose
                              border is the ragged, dragged end of a brush
                              (CSS -webkit-mask-box-image, sliced 64 px).
  menu-brush.webp             a button: one stroke of a loaded flat brush,
                              its ends dry and split into bristle streaks,
                              its body a little uneven (mask, sliced 0/96
                              px, so any width keeps its ends).

    python3 tools/parrish_menu_art.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/parrish")
rng = np.random.default_rng(7)


def noise1(n, scale, octaves=3):
    """Smooth 1-D noise in [-1, 1]."""
    out = np.zeros(n)
    for o in range(octaves):
        k = max(2, int(n / scale * 2 ** o))
        pts = rng.uniform(-1, 1, k + 1)
        out += np.interp(np.linspace(0, k, n), np.arange(k + 1), pts) / 2 ** o
    return out / np.abs(out).max()


def paint_strokes(img, n, colors, length, width, angle, angle_var, alpha):
    """Brush strokes laid straight onto the ground, seamlessly (wrapped)."""
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for _ in range(n):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        a = angle + rng.normal(0, angle_var)
        L, Wd = length * rng.uniform(0.6, 1.3), width * rng.uniform(0.6, 1.4)
        col = np.array(colors[rng.integers(len(colors))]) * rng.uniform(0.94, 1.05)
        ca, sa = np.cos(a), np.sin(a)
        # wrapped distance, for a seamless tile
        dx = (xx - cx + W / 2) % W - W / 2
        dy = (yy - cy + H / 2) % H - H / 2
        u = dx * ca + dy * sa
        v = -dx * sa + dy * ca
        inside = (np.abs(u) < L / 2) & (np.abs(v) < Wd / 2)
        if not inside.any():
            continue
        # bristle streaks along it, the tail drying out
        t = (u + L / 2) / L
        streak = 0.75 + 0.25 * np.sin(v / Wd * np.pi * rng.uniform(5, 11) + rng.uniform(0, 6))
        edge = np.clip((Wd / 2 - np.abs(v)) / (Wd * 0.18), 0, 1)
        dry = np.clip((1 - t) / 0.35, 0, 1) ** 0.6
        m = inside * edge * streak * (0.35 + 0.65 * dry) * alpha
        img[:] = img * (1 - m[..., None]) + col * m[..., None]
    return img


def ground(base, layers, size=512):
    img = np.ones((size, size, 3)) * np.array(base)
    for spec in layers:
        paint_strokes(img, **spec)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    return im.filter(ImageFilter.GaussianBlur(0.9))


def edge_mask(size=256):
    """An alpha mask, opaque inside, its border a dragged brush's ragged end
    (each side's edge wanders on its own; the corners round where they meet)."""
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    sides = []
    for dist, coord in ((yy, xx), (size - 1 - yy, xx), (xx, yy), (size - 1 - xx, yy)):
        n = noise1(size, 40, 4) * 0.55 + noise1(size, 7, 2) * 0.45
        sides.append(dist - (22 + np.interp(coord, np.arange(size), n) * 10))
    # a soft minimum, so the corners round off rather than spike
    k = 6.0
    d = -k * np.log(sum(np.exp(-s_ / k) for s_ in sides))
    a = np.clip((d + 5) / 9, 0, 1)
    # dry-brush gaps just inside the edge
    streaks = rng.uniform(0, 1, (size, size))
    streaks = np.array(Image.fromarray((streaks * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255
    near = np.clip(1 - d / 12, 0, 1) * (d > -4)
    a = a * (1 - near * np.clip((0.5 - streaks) * 3, 0, 1) * 0.7)
    return alpha_mask(a)


def alpha_mask(a):
    """White, its alpha the mask (CSS masks read the alpha channel)."""
    a = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
    im = Image.new("RGBA", a.size, (255, 255, 255, 255))
    im.putalpha(a)
    return im


def brush_mask(w=640, h=128):
    """One stroke of a flat brush: its body a little uneven, its ends dry,
    split into bristle streaks."""
    x = np.linspace(0, 1, w)
    top = 0.16 + noise1(w, 90, 3) * 0.05
    bot = 0.84 + noise1(w, 90, 3) * 0.05
    yy = np.linspace(0, 1, h)[:, None]
    body = np.clip((yy - top) / 0.05, 0, 1) * np.clip((bot - yy) / 0.05, 0, 1)
    # the bristles: streaks along the stroke
    rows = np.array([noise1(w, 220, 2) for _ in range(h)]) * 0.5 + 0.5
    bristle = np.repeat(rng.uniform(0, 1, (h, 1)), w, 1) * 0.6 + rows * 0.4
    # the ends: the paint gives out unevenly, bristle by bristle
    reach_l = 0.03 + bristle[:, :1] * 0.11
    reach_r = 0.97 - bristle[:, :1] * 0.12
    ends = np.clip((x[None] - reach_l) / 0.03, 0, 1) * np.clip((reach_r - x[None]) / 0.04, 0, 1)
    body = body * ends * (0.86 + 0.14 * rows)
    return alpha_mask(body)


def main():
    orinoco = ground((0.955, 0.925, 0.850), [
        dict(n=240, colors=[(0.985, 0.965, 0.905), (0.925, 0.880, 0.770), (0.965, 0.925, 0.820)], length=150, width=26, angle=0.55, angle_var=0.25, alpha=0.55),
        dict(n=70, colors=[(0.84, 0.88, 0.93), (0.93, 0.86, 0.70)], length=110, width=16, angle=0.6, angle_var=0.4, alpha=0.45),
        dict(n=110, colors=[(1.0, 0.99, 0.96)], length=70, width=10, angle=0.5, angle_var=0.3, alpha=0.5),
    ])
    watermark = ground((0.215, 0.062, 0.078), [
        dict(n=240, colors=[(0.30, 0.075, 0.09), (0.19, 0.055, 0.06), (0.33, 0.115, 0.09)], length=150, width=26, angle=0.55, angle_var=0.25, alpha=0.55),
        dict(n=80, colors=[(0.42, 0.13, 0.14), (0.27, 0.15, 0.09)], length=110, width=16, angle=0.6, angle_var=0.4, alpha=0.4),
        dict(n=45, colors=[(0.52, 0.36, 0.20), (0.50, 0.23, 0.25)], length=60, width=8, angle=0.5, angle_var=0.4, alpha=0.3),
    ])
    orinoco.save(os.path.join(OUT, "menu-paint-orinoco.webp"), quality=82)
    watermark.save(os.path.join(OUT, "menu-paint-watermark.webp"), quality=82)
    edge_mask().save(os.path.join(OUT, "menu-edge.webp"), lossless=True)
    brush_mask().save(os.path.join(OUT, "menu-brush.webp"), lossless=True)
    for n in ("menu-paint-orinoco.webp", "menu-paint-watermark.webp", "menu-edge.webp", "menu-brush.webp"):
        print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, "KB")


if __name__ == "__main__":
    main()
