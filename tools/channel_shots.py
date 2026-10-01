"""The channel pictures (tools/channel_shots.mjs) made small: 512 x 384
JPEGs (the den's screen is drawn at that size), assets/den/channels/<id>.jpg."""
import glob
import os
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "den", "channels")
for p in sorted(glob.glob(os.path.join(D, "*.png"))):
    im = Image.open(p).convert("RGB").resize((512, 384), Image.LANCZOS)
    im.save(p[:-4] + ".jpg", quality=82, optimize=True, progressive=True)
    os.remove(p)
    print(os.path.basename(p)[:-4])
