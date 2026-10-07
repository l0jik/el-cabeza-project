"""The End turn button's brush stroke, as a mask (assets/parrish/
button-stroke.webp; themes/parrish.js masks the side's wood with it).

User: "a real paintbrush stroke won't have such wavy lines horizontally ...
the ends where the bristles lift off the canvas ... serrated ... but the
long portion of the stroke itself should be relatively straight ... you're
not moving your hand up and down." So: one steady pass, left to right. Its
long edges run nearly straight (a slow drift of a pixel or two, and the
odd stray bristle), the paint dragged into fine streaks along it; the
loaded start is blunt and a little ragged, and the end breaks up into
bristle tips of different lengths where the brush lifts.

Only the alpha matters (it's a mask). Run: python3 tools/parrish_button_stroke.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/parrish/button-stroke.webp")
W, H = 720, 168
rng = np.random.default_rng(1975)


def smooth_noise(n, scale, amp):
    """1-D value noise: n samples, features every `scale` samples."""
    k = int(np.ceil(n / scale)) + 3
    pts = rng.uniform(-1, 1, k)
    x = np.arange(n) / scale
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return amp * (pts[i] * (1 - f) + pts[i + 1] * f)


x = np.arange(W)[None, :].astype(float)
y = np.arange(H)[:, None].astype(float)
u = x / (W - 1)

# The band: centred, its edges a steady line with only a slow drift.
mid = H * 0.5 + smooth_noise(W, 260, 1.6)[None, :]
half = H * 0.34 + smooth_noise(W, 200, 1.2)[None, :]
# (A little fuller where it's loaded, a touch thinner as it runs out.)
half = half * (1.02 - 0.06 * u)
d = np.abs(y - mid) - half
band = np.clip(0.5 - d / 1.6, 0, 1)

# Bristles: each row of the stroke is a bristle's track, with its own
# start and end. The start is blunt (a few pixels of play); the end is
# where the bristles lift: each runs out at its own place, longer ones in
# the middle of the brush, so the tail is serrated.
rows = H
row_pos = (np.arange(rows) - H * 0.5) / (H * 0.36)  # -1..1 across the brush
start = 0.03 + 0.012 * np.abs(row_pos) ** 2 + rng.uniform(0, 0.012, rows)
# Neighbouring bristles clump: smooth the lift-off a little across rows.
lift = 0.86 + 0.07 * (1 - row_pos ** 2) + rng.normal(0, 0.035, rows)
lift = np.convolve(lift, np.ones(3) / 3, mode="same")
lift = np.clip(lift, 0.74, 0.985)
s = start[:, None]
e = lift[:, None]
ends = np.clip((u - s) / 0.006, 0, 1) * np.clip((e - u) / 0.012, 0, 1)

# Dry-brush streaks: per-row density along the stroke (dragged paint),
# thinning toward the end, a few rows going dry early near the edges.
streak = 0.82 + 0.18 * rng.uniform(0, 1, (rows, 1))
grain = np.cumsum(rng.normal(0, 1, (rows, W)), axis=1)
grain = (grain - grain.mean(axis=1, keepdims=True)) / (grain.std(axis=1, keepdims=True) + 1e-6)
dry = np.clip(0.9 + 0.12 * grain * (0.3 + 0.7 * u), 0, 1)
edge_rows = np.abs(row_pos)[:, None] > 0.8
dry = np.where(edge_rows & (u > 0.6 + 0.3 * rng.uniform(0, 1, (rows, 1))), dry * 0.35, dry)

alpha = band * ends * streak * dry
# A stray bristle or two just outside the edge, along the run.
for _ in range(5):
    r = int(H * 0.5 + rng.choice([-1, 1]) * (H * 0.36 + rng.uniform(1, 4)))
    a0, a1 = sorted(rng.uniform(0.15, 0.9, 2))
    if 0 <= r < H:
        alpha[r, int(a0 * W):int(a1 * W)] = np.maximum(alpha[r, int(a0 * W):int(a1 * W)], 0.55)

img = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6))
rgba = Image.new("RGBA", (W, H), (255, 255, 255, 0))
rgba.putalpha(img)
rgba.save(OUT, "WEBP", quality=90, method=6)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
