"""The lost card's hand (themes/neon-singularity.js LostNudge), from the
user's wireframe hand (tools/lost-hand-source.png, their second picture):
cropped to the hand, the black taken out (alpha from brightness), recoloured
toward the Singularity's cyan; a flesh hand modelled from the same shape for
the skin to fall away from (the silhouette filled, rounded by its distance
from the edge, lit from the upper left, warm in the shadows, the wire's
folds kept faintly as creases and knuckles); and the index fingertip alone,
turned to point up, for the fingertips a touch leaves.

python3 tools/lost_hand.py [source.png]"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src = Image.open(sys.argv[1] if len(sys.argv) > 1 else "tools/lost-hand-source.png").convert("RGB")
full = np.asarray(src).astype(np.float32) / 255.0
lum_full = full.max(axis=2)  # the lines are saturated blue: the brightest channel


def blur(arr, r):
    return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0


def wire_rgba(L):
    alpha = np.clip((L - 0.07) / 0.5, 0, 1) ** 0.85
    lo, mid, hi = np.array([30, 120, 255]), np.array([102, 217, 255]), np.array([225, 252, 255])
    t = np.clip(L / 0.9, 0, 1)[..., None]
    rgb = np.where(t < 0.55, lo + (mid - lo) * (t / 0.55), mid + (hi - mid) * ((t - 0.55) / 0.45))
    return np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)


ys, xs = np.where(lum_full > 0.2)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
pad = 10
x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
x1, y1 = min(full.shape[1] - 1, x1 + pad), min(full.shape[0] - 1, y1 + pad)
lum = lum_full[y0:y1 + 1, x0:x1 + 1]

W = 480
H = round(lum.shape[0] * W / lum.shape[1])
L = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
Image.fromarray(wire_rgba(L), "RGBA").save("assets/neon/lost-hand-wire.webp", quality=86, method=6)

# The flesh hand. The silhouette: the lines closed up, and only the small
# holes filled (the gap under the curled fingers stays open).
mask = blur(L, 1.2) > 0.1
mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)), iterations=2)
holes = ndimage.binary_fill_holes(mask) & ~mask
lab, n = ndimage.label(holes)
if n:
    sizes = ndimage.sum(holes, lab, range(1, n + 1))
    small = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < 900])
    mask |= small
mask = ndimage.binary_opening(mask, structure=np.ones((3, 3)))
# Its roundness: distance in from the edge, eased like a cylinder's
# section, at two sizes (a finger's, the palm's).
d = ndimage.distance_transform_edt(mask)
def dome(R):
    u = np.clip(d / R, 0, 1)
    return np.sqrt(u * (2 - u))
h = ndimage.gaussian_filter(0.6 * dome(10.0) + 0.9 * dome(34.0), 1.8)
# Where the wire's brightest outlines run (a finger over the palm, the
# thumb's edge), the flesh turns away: a groove, so the fingers part.
outline = blur(np.clip((L - 0.5) / 0.4, 0, 1), 2.0)
h = h - 0.22 * outline
gy, gx = np.gradient(ndimage.gaussian_filter(h, 0.9))
nrm = np.dstack([-gx * 9, -gy * 9, np.ones_like(h)])
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
light = np.array([-0.5, -0.65, 0.57]); light /= np.linalg.norm(light)
diff = np.clip((nrm * light).sum(axis=2), 0, 1)
half = np.array([-0.25, -0.35, 0.9]); half /= np.linalg.norm(half)
spec = np.clip((nrm * half).sum(axis=2), 0, 1) ** 30
# Knuckle folds, faintly, from where the wire's lines bunch.
fold = np.clip(blur(L, 2.0) - blur(L, 6.0), 0, 1)
shade = np.clip(0.18 + 0.95 * diff - 0.35 * fold - 0.3 * outline, 0, 1.15)[..., None]
dark, mid_c, light_c = np.array([92, 48, 40.0]), np.array([190, 124, 96.0]), np.array([242, 198, 168.0])
skin_rgb = np.where(shade < 0.6, dark + (mid_c - dark) * (shade / 0.6), mid_c + (light_c - mid_c) * np.clip((shade - 0.6) / 0.5, 0, 1))
# Warm at the edges (light through the skin), a soft sheen on top.
rim = np.exp(-d / 2.2)[..., None]
skin_rgb = skin_rgb * (1 - 0.3 * rim) + np.array([200, 92, 78.0]) * 0.3 * rim
skin_rgb = np.clip(skin_rgb + spec[..., None] * 55, 0, 255)
soft = blur(mask.astype(np.float32), 1.1)
skin = np.dstack([skin_rgb, soft[..., None] * 255]).astype(np.uint8)
Image.fromarray(skin, "RGBA").save("assets/neon/lost-hand-skin.webp", quality=86, method=6)

# (The fingertip each touch used to leave, lost-tip-wire.webp, was taken
# out at the user's request; only the hand and its skin are made now.)
print("hand", W, H)
