"""The lost card's hand (themes/neon-singularity.js LostNudge), from the
user's wireframe hand: cropped to the hand, the black taken out (alpha from
brightness), recoloured toward the Singularity's cyan; and a skin-toned
silhouette of the same hand, for the skin falling away into the lines.

python3 tools/lost_hand.py <source.png>"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src = Image.open(sys.argv[1]).convert("RGB")
a = np.asarray(src).astype(np.float32) / 255.0
lum = a.max(axis=2)  # the lines are saturated blue: the brightest channel
ys, xs = np.where(lum > 0.18)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
pad = 12
x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
x1, y1 = min(a.shape[1] - 1, x1 + pad), min(a.shape[0] - 1, y1 + pad)
a, lum = a[y0:y1 + 1, x0:x1 + 1], lum[y0:y1 + 1, x0:x1 + 1]

W = 420
H = round(a.shape[0] * W / a.shape[1])
def scaled(arr):
    return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
L = scaled(lum)

# The wire: alpha from brightness, coloured from deep cyan-blue to near white
# (the sphere's #66d9ff in the middle).
alpha = np.clip((L - 0.06) / 0.55, 0, 1) ** 0.85
lo, mid, hi = np.array([30, 120, 255]), np.array([102, 217, 255]), np.array([225, 252, 255])
t = np.clip(L / 0.9, 0, 1)[..., None]
rgb = np.where(t < 0.55, lo + (mid - lo) * (t / 0.55), mid + (hi - mid) * ((t - 0.55) / 0.45))
wire = np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)
Image.fromarray(wire, "RGBA").save("assets/neon/lost-hand-wire.webp", quality=84, method=6)

# The skin: the hand filled in (lines closed up, holes filled), shaded a
# little by the lines' own light, edges softened.
mask = L > 0.12
mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)), iterations=1)
mask = ndimage.binary_fill_holes(mask)
mask = ndimage.binary_opening(mask, structure=np.ones((3, 3)))
soft = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32) / 255.0
shade = np.asarray(Image.fromarray((L * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255.0
base = np.array([206, 150, 120], dtype=np.float32)
skin_rgb = np.clip(base[None, None, :] * (0.72 + 0.55 * shade[..., None]), 0, 255)
skin = np.dstack([skin_rgb, soft[..., None] * 255]).astype(np.uint8)
Image.fromarray(skin, "RGBA").save("assets/neon/lost-hand-skin.webp", quality=84, method=6)
print(W, H)
