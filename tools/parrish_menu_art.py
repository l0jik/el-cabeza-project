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
  menu-stroke-<look>-paint/   that stroke painted, in each palette's paint
  -glaze.webp                 and glaze, its bristle ridges catching the
                              light: drawn behind a button's words (CSS
                              border-image), never cutting them.
  menu-stroke-<look>-paint-   three more strokes (user: the buttons' paint
  1/2/3.webp, -glaze-1/2/3    "all too much the same"): 1 laid on loaded
                              and dragged dry, rising a little; 2 two
                              passes, their ends forked; 3 dry at the
                              start, flicked up at the end. The ends stay
                              in the 110 px the CSS slices, so any width
                              keeps them.

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


def brush_variant(kind, w=640, h=128):
    """Another stroke of the same brush (see brush_mask); its own seed, so
    the first four pictures come out as before."""
    r = np.random.default_rng(100 + kind)
    x = np.linspace(0, 1, w)
    yy = np.linspace(0, 1, h)[:, None]

    def n1(scale, octaves=3):
        out = np.zeros(w)
        for o in range(octaves):
            k = max(2, int(w / scale * 2 ** o))
            pts = r.uniform(-1, 1, k + 1)
            out += np.interp(np.linspace(0, k, w), np.arange(k + 1), pts) / 2 ** o
        return out / np.abs(out).max()

    def band(top, bot, soft=0.05):
        return np.clip((yy - top) / soft, 0, 1) * np.clip((bot - yy) / soft, 0, 1)

    rows = np.array([n1(220, 2) for _ in range(h)]) * 0.5 + 0.5
    bristle = np.repeat(r.uniform(0, 1, (h, 1)), w, 1) * 0.6 + rows * 0.4
    if kind == 1:
        # loaded at the start (a blunt, round end), dragged dry and rising
        rise = -0.07 * x
        top = 0.15 + rise + n1(110) * 0.04 + 0.02 * x
        bot = 0.86 + rise + n1(110) * 0.04 - 0.03 * x
        body = band(top[None], bot[None])
        cy = (yy - 0.5) / 0.36
        reach_l = 0.035 + 0.05 * np.clip(np.abs(cy), 0, 1) ** 2 + bristle[:, :1] * 0.02
        reach_r = 0.975 - bristle[:, :1] * 0.15
        ends = np.clip((x[None] - reach_l) / 0.015, 0, 1) * np.clip((reach_r - x[None]) / 0.05, 0, 1)
        body = body * ends * (0.84 + 0.16 * rows)
    elif kind == 2:
        # two passes, one over the other: forked ends, a thinner seam
        a1 = band((0.11 + n1(90) * 0.04)[None], (0.62 + n1(90) * 0.04)[None])
        a2 = band((0.40 + n1(90) * 0.04)[None], (0.89 + n1(90) * 0.04)[None])
        l1 = 0.02 + bristle[:, :1] * 0.08; r1 = 0.905 - bristle[:, :1] * 0.06
        l2 = 0.09 + bristle[:, :1] * 0.07; r2 = 0.985 - bristle[:, :1] * 0.08
        e1 = np.clip((x[None] - l1) / 0.03, 0, 1) * np.clip((r1 - x[None]) / 0.04, 0, 1)
        e2 = np.clip((x[None] - l2) / 0.03, 0, 1) * np.clip((r2 - x[None]) / 0.04, 0, 1)
        p1, p2 = a1 * e1 * 0.92, a2 * e2 * 0.92
        body = np.clip(p1 + p2 - p1 * p2 * 1.15, 0, 1) * (0.84 + 0.16 * rows)
    else:
        # dry at the start, deeply split; flicked up at the end
        flick = -0.2 * np.clip((x - 0.85) / 0.15, 0, 1) ** 2
        top = 0.17 + n1(70) * 0.06 + flick
        bot = 0.83 + n1(70) * 0.06 + flick * 0.8
        body = band(top[None], bot[None], 0.06)
        reach_l = 0.02 + bristle[:, :1] ** 1.6 * 0.15
        reach_r = 0.98 - bristle[:, :1] * 0.06
        ends = np.clip((x[None] - reach_l) / 0.05, 0, 1) * np.clip((reach_r - x[None]) / 0.025, 0, 1)
        body = body * ends * (0.82 + 0.18 * rows)
    return alpha_mask(body)


def painted_stroke(mask, color, alpha, seed):
    """A stroke of paint in one colour: the brush's shape (mask), its
    bristles' ridges catching the light and its furrows darker, a little
    thinner paint towards the dry end."""
    r = np.random.default_rng(seed)
    a = np.asarray(mask.split()[-1], dtype=float) / 255
    h, w = a.shape
    ridges = np.array([noise1(w, 160, 2) for _ in range(h)])
    ridges = np.repeat(r.uniform(-1, 1, (h, 1)), w, 1) * 0.6 + ridges * 0.4
    light = 1 + 0.10 * ridges + 0.06 * np.linspace(0.5, -0.5, h)[:, None]
    rgb = np.clip(np.array(color)[None, None, :] * light[..., None], 0, 1)
    thin = 0.86 + 0.14 * np.clip(1 - np.linspace(0, 1, w)[None, :] * 0.6 + ridges * 0.2, 0, 1)
    out = np.dstack([rgb, np.clip(a * alpha * thin, 0, 1)])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


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
    brush = brush_mask()
    brush.save(os.path.join(OUT, "menu-brush.webp"), lossless=True)
    # The buttons' strokes, painted behind their words (CSS border-image,
    # so a stroke never cuts its letters): each palette's own paint, and a
    # thin glaze for the quiet ones.
    strokes = {
        "menu-stroke-orinoco-paint.webp": ((0.141, 0.255, 0.561), 1.0),    # cobalt #24418F
        "menu-stroke-orinoco-glaze.webp": ((0.91, 0.72, 0.35), 0.42),      # amber
        "menu-stroke-watermark-paint.webp": ((0.89, 0.796, 0.596), 1.0),   # cream #E3CB98
        "menu-stroke-watermark-glaze.webp": ((0.84, 0.63, 0.33), 0.32),    # old gold
    }
    for i, (n, (col, al)) in enumerate(strokes.items()):
        painted_stroke(brush, col, al, 20 + i).save(os.path.join(OUT, n), quality=90)
    for kind in (1, 2, 3):
        b = brush_variant(kind)
        for i, (n, (col, al)) in enumerate(strokes.items()):
            painted_stroke(b, col, al, 40 + 10 * kind + i).save(os.path.join(OUT, n.replace(".webp", f"-{kind}.webp")), quality=90)
    for n in ("menu-paint-orinoco.webp", "menu-paint-watermark.webp", "menu-edge.webp", "menu-brush.webp", *strokes):
        print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, "KB")


if __name__ == "__main__":
    main()
