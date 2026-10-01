#!/usr/bin/env python3
"""The revisited store's dialogue frames, from the user's two storyboard
sheets (assets/tienda/storyboard/: clerk-sheet.jpg, manager-sheet.png, each
4 x 2 cells of 384 x 512).

    python3 tools/tienda_clerk_frames.py [--debug DIR]

Writes assets/tienda/clerk/<name>.jpg for themes/tienda-overlay.js
(ClerkScene).

The user's rule: the table and everything on it stays exactly the same in
every frame. So one appliance spread (coffee maker, can opener, crock-pot,
toaster, blender, mixer), cut from the clerk sheet's "Yeah, I'm sorry" cell,
is laid over the table in every frame, and whatever each cell had there
(its own arrangement, the El Cabeza demo on the manager sheet) is filled
over first. The user's marker strokes (the boxes grouping cells to merge,
the scribble through the cut cell) are painted out.
"""
import argparse
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SB = os.path.join(ROOT, "assets", "tienda", "storyboard")
OUT = os.path.join(ROOT, "assets", "tienda", "clerk")
CW, CH = 384, 512
# Inside the sheets' white gutters and under the strokes along the clerk
# cells' tops (no cell has a clean top edge to lend). The manager cells,
# unmarked, are framed 22 px higher, and the spread laid 22 px higher in
# them, so it sits at the same place in every frame.
CROP = {"c": (8, 30, 376, 504), "m": (8, 8, 376, 482)}
SPREAD_DY = {"c": 0, "m": -22}

# The frames, in order: (output name, sheet, cell index 0-7).
CELLS = {
    "clerk-hello": ("c", 0), "clerk-sure": ("c", 1),
    "clerk-go": ("c", 2), "clerk-back": ("c", 3),
    "clerk-hmm": ("c", 4), "clerk-sorry": ("c", 5),
    "clerk-phone": ("c", 7),
    **{f"manager-{i + 1}": ("m", i) for i in range(8)},
}


def cells():
    a = np.array(Image.open(os.path.join(SB, "clerk-sheet.jpg")).convert("RGB"))
    b = np.array(Image.open(os.path.join(SB, "manager-sheet.png")).convert("RGB"))
    out = {}
    for name, (sheet, i) in CELLS.items():
        s = a if sheet == "c" else b
        r, c = divmod(i, 4)
        out[name] = s[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW].copy()
    return out


def markup(img, name):
    """The user's marker strokes: flat, saturated yellow, green, blue (and
    red, only at the phone cell's left edge, where the scribble next door
    spilled over; the coffee maker is red too)."""
    f = img.astype(int)
    R, G, B = f[..., 0], f[..., 1], f[..., 2]
    yellow = (R > 215) & (G > 205) & (B < 110)
    green = (G > 120) & (G - R > 60) & (G - B > 40)
    blue = (B > 170) & (B - R > 110) & (B - G > 25)
    m = yellow | green | blue
    if name == "clerk-phone":
        red = (R > 190) & (G < 110) & (B < 100)
        red[:, 16:] = False
        m |= red
    return cv2.dilate(m.astype(np.uint8) * 255, np.ones((5, 5), np.uint8), iterations=3)


def strong(img, name):
    """The strokes themselves, undilated."""
    f = img.astype(int)
    R, G, B = f[..., 0], f[..., 1], f[..., 2]
    m = ((R > 215) & (G > 205) & (B < 110)) | ((G > 120) & (G - R > 60) & (G - B > 40)) | ((B > 170) & (B - R > 110) & (B - G > 25))
    return cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0


def clean_column(col):
    """A bubble column with its letters taken out: the outline top and
    bottom kept, paper between."""
    dark = col.min(axis=1) < 120
    ys = np.nonzero(dark)[0]
    out = col.copy()
    if len(ys) < 2:
        return out
    top = ys[0]
    while top + 1 < len(col) and dark[top + 1]:
        top += 1
    bot = ys[-1]
    while bot - 1 > 0 and dark[bot - 1]:
        bot -= 1
    inner = col[top + 1:bot]
    paper = np.median(inner[inner.min(axis=1) > 200], axis=0) if (inner.min(axis=1) > 200).any() else np.array([245, 240, 228])
    out[top + 3:bot - 2] = paper
    return out


def repair_bubble(img, raw, comp, cut):
    """A bubble whose right end is under a stroke: its left end, letters
    taken out and mirrored, closes it again as far past the last visible
    letter as the first letter sits from its left edge."""
    ys, xs = np.nonzero(comp)
    L, T, B = xs.min(), ys.min(), ys.max()
    xc = int(np.nonzero(cut[T:B + 1].any(axis=0))[0].min())  # where the stroke starts
    if xc <= L + 40:
        return img
    inside = np.zeros_like(comp)
    inside[T + 6:B - 5, L + 6:xc] = comp[T + 6:B - 5, L + 6:xc]
    letters = inside & (raw.min(axis=2) < 110)
    lx = np.nonzero(letters.any(axis=0))[0]
    if not len(lx):
        return img
    pad = lx.min() - L
    r_new = min(CROP["c"][2] - 2, lx.max() + pad)  # closed inside the frame
    E = 20
    y0, y1 = max(0, T - 4), min(CH, B + 6)
    end = raw[y0:y1, L - 3:L + E].copy()
    for j in range(end.shape[1]):
        end[:, j] = clean_column(end[:, j])
    end = end[:, ::-1]
    # From where the stroke starts to the new end: a clean column, repeated.
    col = clean_column(raw[y0:y1, xc - 3])
    for x in range(xc - 2, max(xc - 2, r_new - E + 1)):
        keep = cut[y0:y1, x]
        img[y0:y1, x][keep] = col[keep]
    x0 = r_new - E
    ew = min(end.shape[1], CW - x0)
    region = img[y0:y1, x0:x0 + ew]
    # The mirrored end over the fill (and the background beyond it), but
    # never over the letters still showing.
    endm = (end[:, :ew].min(axis=2) < 235) | (end[:, :ew].min(axis=2) > 200)
    endm &= cut[y0:y1, x0:x0 + ew] | (np.arange(ew)[None, :] + x0 >= xc)
    region[endm] = end[:, :ew][endm]
    return img


# Which cells lend their background to which: the merged pair's partner
# first (its edges then match through the crossfade), then the rest.
# The SAVE sign stands nearer than the shelves, so no other cell can lend
# it in the right place: where a stroke cut through it, the whole sign
# comes from the partner (its sign then matches through the crossfade).
# And the partner's own hands are not lent.
SIGN = {"clerk-hello": (0, 100, 70, 250), "clerk-hmm": (0, 100, 50, 210)}
SLIDE_SIGN = {"clerk-go": (0, 136, 70, 290)}
HANDS = {"clerk-sorry": [(22, 240, 90, 282)], "clerk-sure": [(40, 250, 140, 350)], "clerk-back": [(80, 60, 210, 512)]}
PARTNER = {"clerk-hello": "clerk-sure", "clerk-sure": "clerk-hello", "clerk-go": "clerk-back",
           "clerk-back": "clerk-go", "clerk-hmm": "clerk-sorry", "clerk-sorry": "clerk-hmm"}


def align(src, dst):
    """The homography carrying src onto dst, from the background (ORB
    features, RANSAC throws out the people, who move)."""
    orb = cv2.ORB_create(3000)
    g1, g2 = cv2.cvtColor(src, cv2.COLOR_RGB2GRAY), cv2.cvtColor(dst, cv2.COLOR_RGB2GRAY)
    k1, d1 = orb.detectAndCompute(g1, None)
    k2, d2 = orb.detectAndCompute(g2, None)
    if d1 is None or d2 is None:
        return None
    ms = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d1, d2), key=lambda m: m.distance)[:400]
    if len(ms) < 12:
        return None
    p1 = np.float32([k1[m.queryIdx].pt for m in ms])
    p2 = np.float32([k2[m.trainIdx].pt for m in ms])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 3.0)
    return H if H is not None and inl.sum() >= 12 else None


def bubbles(img):
    """The speech bubbles (big near-white shapes up top, with their
    outline and tail): never lent to another cell."""
    white = (img.min(axis=2) > 222).astype(np.uint8)
    white[300:] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(white, 8)
    m = np.zeros_like(white)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 1500:
            m[lab == i] = 1
    return cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=3) > 0


def clean_all(raw):
    """The marker strokes filled from the other cells' background, aligned;
    what no cell can lend, painted in."""
    masks = {k: markup(v, k) for k, v in raw.items()}
    out = {}
    for k, img in raw.items():
        m = masks[k] > 0
        if not m.any():
            out[k] = img
            continue
        img = img.copy()
        if k in SIGN:
            x0, y0, x1, y1 = SIGN[k]
            m = m.copy()
            m[y0:y1, x0:x1] = True
        todo = m.copy()
        donors = [PARTNER[k]] if k in PARTNER else []
        donors += [d for d in raw if d != k and d not in donors and d.startswith(k.split("-")[0])]
        # Each donor aligned, with what it can lend: never its own strokes,
        # bubbles, or the sheet's white margins round it.
        lent, lent_names = [], []
        inner = np.zeros((CH, CW), bool)
        inner[7:CH - 7, 7:CW - 7] = True
        for d in donors:
            H = align(raw[d], img)
            if H is None:
                continue
            warped = cv2.warpPerspective(raw[d], H, (CW, CH), flags=cv2.INTER_LINEAR)
            lend = (masks[d] == 0) & ~bubbles(raw[d]) & inner
            for x0, y0, x1, y1 in HANDS.get(d, []):
                lend[y0:y1, x0:x1] = False
            ok = cv2.warpPerspective(lend.astype(np.uint8) * 255, H, (CW, CH), flags=cv2.INTER_NEAREST) > 0
            lent.append((warped, ok))
            lent_names.append(d)
        # What most cells show at each point (the store stays put and the
        # people don't): used only to judge the donors, never pasted (the
        # cells don't line up exactly, and a blend ghosts the signs).
        med = None
        if len(lent) >= 3:
            W = np.stack([w.astype(np.float32) for w, _ in lent])
            W[~np.stack([ok for _, ok in lent])] = np.nan
            with np.errstate(all="ignore"):
                med = np.nanmedian(W, axis=0)
        # Stroke by stroke (each connected piece): the donor that matches
        # the cell best just around it and shows the store (not a passing
        # arm) inside it; the next best for what's left.
        n, lab = cv2.connectedComponents(todo.astype(np.uint8))
        for i in range(1, n):
            piece = lab == i
            ring = (cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8), iterations=3) > 0) & ~m
            def err(w_ok):
                w, ok = w_ok
                r = ring & ok
                if r.sum() < 30 or (piece & ok).sum() < 0.5 * piece.sum():
                    return 1e9
                e = np.abs(w[r].astype(int) - img[r].astype(int)).mean()
                if med is not None:
                    q = piece & ok & ~np.isnan(med).any(axis=2)
                    if q.any():
                        e += 0.6 * np.abs(w[q].astype(np.float32) - med[q]).mean()
                return e
            # The partner first (same camera, and the pair crossfades), then
            # the rest, best first.
            # (Only the partner, where there is one: the others' cameras
            # differ, and a patch from them shows; what it can't lend is
            # painted in.)
            if k in PARTNER and lent and lent_names[0] == PARTNER[k]:
                # (The walk-away pair's cameras differ: the partner first,
                # the best of the rest after it.)
                order = lent[:1] + (sorted(lent[1:], key=err) if k == "clerk-go" else [])
            else:
                order = sorted(lent, key=err)
            for w, ok in order:
                take = piece & todo & ok
                img[take] = w[take]
                todo &= ~take
        # The walk-away cell's sign: its partner's, slid (not warped) until
        # it lines up with what shows of this one (the sign stands at the
        # same spot in both; the background behind it doesn't).
        if k in SLIDE_SIGN:
            x0, y0, x1, y1 = SLIDE_SIGN[k]
            d = raw[PARTNER[k]]
            vis = ~m[y0:y1, x0:x1]
            best = None
            for dy in range(-20, 21):
                for dx in range(-40, 41):
                    ys0, xs0 = y0 + dy, x0 + dx
                    if xs0 < 0 or ys0 < 0 or xs0 + (x1 - x0) > CW or ys0 + (y1 - y0) > CH:
                        continue
                    patch = d[ys0:ys0 + (y1 - y0), xs0:xs0 + (x1 - x0)]
                    e = np.abs(patch[vis].astype(int) - raw[k][y0:y1, x0:x1][vis].astype(int)).mean()
                    if best is None or e < best[0]:
                        best = (e, dx, dy)
            _, dx, dy = best
            img[y0:y1, x0:x1] = d[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            todo[y0:y1, x0:x1] = False
            m = m.copy()
            m[y0:y1, x0:x1] = True  # (its edges softened below)
        if todo.any():
            img = cv2.inpaint(img, todo.astype(np.uint8) * 255, 6, cv2.INPAINT_TELEA)
        # Where a stroke crossed the cell's own bubble: the bubble as it
        # was up to the stroke itself (the widened mask gave back), then
        # its end closed again (the right-hand ones), or its paper carried
        # to the frame's edge (the tops, cropped away anyway).
        st = strong(raw[k], k)
        white = (raw[k].min(axis=2) > 222) & ~m
        white[300:] = False
        n, lab, stats, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] <= 1500:
                continue
            ys, xs = np.nonzero(lab == i)
            hull = np.zeros((CH, CW), np.uint8)
            cv2.fillConvexPoly(hull, cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32)), 1)
            box = cv2.dilate(hull, np.ones((9, 9), np.uint8), iterations=2) > 0
            give = box & m & ~st
            img[give] = raw[k][give]
            near = cv2.dilate(hull, np.ones((5, 5), np.uint8), iterations=3) > 0
            cut = st & near
            if not cut.any():
                continue
            if xs.max() > CW * 0.55 and np.nonzero(cut.any(axis=0))[0].min() > xs.mean():
                img = repair_bubble(img, raw[k], lab == i, cv2.dilate(st.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
            else:
                paper = np.median(raw[k][(lab == i)], axis=0)
                img[(hull > 0) & st] = paper.astype(np.uint8)
        # Soften the seams where lent background meets the cell's own.
        edge = cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)) & ~cv2.erode(m.astype(np.uint8), np.ones((7, 7), np.uint8))
        blur = cv2.GaussianBlur(img, (7, 7), 0)
        img[edge > 0] = blur[edge > 0]
        out[k] = img
    return out


# The spread in the source cell (x, y in the cell): everything from y 400
# down is appliance and table; above that, each appliance's outline.
SPREAD_TOP = 400
SPREAD_SHAPES = [
    [(4, 352), (10, 345), (97, 345), (102, 352), (102, 401), (4, 401)],  # coffee maker
    [(100, 385), (104, 374), (115, 369), (115, 351), (158, 349), (161, 368), (188, 371), (193, 382), (193, 401), (100, 401)],  # can opener, the gadget behind it
    [(172, 401), (172, 398), (178, 390), (200, 385), (213, 377), (231, 377), (246, 385), (270, 390), (277, 398), (277, 401)],  # crock-pot
    [(221, 362), (231, 351), (306, 351), (317, 361), (317, 401), (221, 401)],  # toaster
    [(309, 306), (313, 301), (336, 301), (339, 297), (350, 297), (353, 301), (377, 301), (381, 306), (381, 401), (310, 401), (313, 393), (318, 376), (310, 331)],  # blender
]


def spread_layer(src):
    """RGBA: the source cell's spread, the rest clear. The table's front
    below the source's marker stroke is extended down from the rows above."""
    img = src.copy()
    # Rows under the stroke along the bottom: the table's front edge,
    # carried down from just above it.
    edge = 492
    for y in range(edge, CH):
        img[y] = img[edge - 1 - min(y - edge, 12)]
    # Its right-hand stroke: the last clean columns carried out.
    for x in range(376, CW):
        img[:, x] = img[:, 375]
    a = Image.new("L", (CW, CH), 0)
    d = ImageDraw.Draw(a)
    d.rectangle([0, SPREAD_TOP, CW, CH], fill=255)
    for poly in SPREAD_SHAPES:
        d.polygon(poly, fill=255)
    a = a.filter(ImageFilter.GaussianBlur(0.9))
    return np.dstack([img, np.array(a)])


def over(dst, layer, dx=0, dy=0, scale=1.0):
    L = Image.fromarray(layer, "RGBA")
    if scale != 1.0:
        L = L.resize((round(CW * scale), round(CH * scale)), Image.LANCZOS)
    base = Image.fromarray(dst).convert("RGBA")
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ox = round((CW - L.width) / 2) + dx
    oy = CH - L.height + dy
    canvas.paste(L, (ox, oy))
    return np.array(Image.alpha_composite(base, canvas).convert("RGB"))


# "Sure thing!" (user, round 5): the frame as it was, and over it the
# user's own photo of your hand holding the order form out to him
# (storyboard/offer-hand.png, cut out on alpha). Its form's four corners
# are set onto a quad tilted back toward his open palm, so the photo's
# own slight lean is carried on and foreshortened; the hand below the
# form comes on in by the same mapping, larger as it nears the lens and
# off the bottom of the shot. Near the camera, so it's a touch soft, in
# the store's warm light.
OFFER_SRC = [(144, 71), (833, 98), (919, 1379), (18, 1379)]   # the photo's form: TL, TR, BR, BL
OFFER_DST = [(84, 300), (154, 298), (186, 428), (58, 432)]    # where they land: its top just under his palm, your wrist off the bottom


def offer_order_form(img):
    H_, W_ = img.shape[:2]
    ph = np.array(Image.open(os.path.join(SB, "offer-hand.png")).convert("RGBA")).astype(np.float32)
    # (Shrunk most of the way first, so the warp has little left to drop.)
    k = 3
    ph = cv2.resize(ph, (ph.shape[1] // k, ph.shape[0] // k), interpolation=cv2.INTER_AREA)
    src = np.float32(OFFER_SRC) / k
    M = cv2.getPerspectiveTransform(src, np.float32(OFFER_DST))
    rgb, a = ph[..., :3], ph[..., 3] / 255.0
    pm = cv2.warpPerspective(rgb * a[..., None], M, (W_, H_), flags=cv2.INTER_AREA)
    aw = cv2.warpPerspective(a, M, (W_, H_), flags=cv2.INTER_AREA)
    # Near the lens: softer toward the bottom (the hand), crisp by him.
    yy = np.mgrid[0:H_, 0:W_][0].astype(np.float32)
    near = np.clip((yy - 360) / 110, 0, 1)
    soft_p, soft_a = cv2.GaussianBlur(pm, (0, 0), 1.3), cv2.GaussianBlur(aw, (0, 0), 1.3)
    pm = pm * (1 - near[..., None]) + soft_p * near[..., None]
    aw = aw * (1 - near) + soft_a * near
    col = pm / np.maximum(aw, 1e-3)[..., None]
    # The store's light: warm, a little dimmer than the photo's.
    col *= np.array([1.0, 0.94, 0.84], np.float32) * 0.93
    out = img.astype(np.float32)
    # A faint shadow it throws on what's under it.
    shd = cv2.GaussianBlur(np.roll(aw, 8, axis=0), (0, 0), 6) * 0.2
    out *= (1 - shd)[..., None]
    out = out * (1 - aw[..., None]) + col * aw[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


# "I'll go check on that for you real quick!" (user, from their own
# pictures, storyboard/clerk-go-photos.jpg: three shots of him walking off
# with the form; they picked the wide one, the left panel, with the same
# table and SAVE sign as the other frames). The panel, cropped to the
# frame's shape (GO_PHOTO_CROP: x, y, width in the panel), and the line in
# a bubble over the dark window, upper left, its tail to him: the bubble
# drawn fresh (cream, ink outline, rounded), its lettering the old frame's
# own (lifted off its bubble, GO_TEXT_BOX, so the font is every frame's).
GO_PHOTO_PANEL = (0, 0, 824, 1024)
GO_PHOTO_CROP = (28, 0, 794)
GO_TEXT_BOX = (257, 17, 368, 84)
GO_BUBBLE = (88, 50)          # its centre
GO_TAIL = (186, 84)           # where its tail points: by his head
BUBBLE_PAPER = np.array([246, 240, 228], np.float32)
BUBBLE_INK = np.array([22, 20, 20], np.float32)


def bubble_text(frame):
    """The lettering of a frame's bubble (GO_TEXT_BOX) as coverage, 0..1."""
    x0, y0, x1, y1 = GO_TEXT_BOX
    lum = frame[y0:y1, x0:x1].astype(np.float32).mean(2)
    paper, ink = np.percentile(lum, 90), np.percentile(lum, 2)
    t = np.clip((paper - lum) / (paper - ink), 0, 1)
    t[t < 0.12] = 0
    ys, xs = np.nonzero(t > 0.3)
    t = t[max(ys.min() - 1, 0):ys.max() + 2, max(xs.min() - 1, 0):xs.max() + 2]
    th, tw = t.shape
    t[int(th * 0.68):, int(tw * 0.72):] = 0  # (the old bubble's own edge there, not lettering)
    return t


def speech_bubble(img, text, centre, tail):
    H_, W_ = img.shape[:2]
    th, tw = text.shape
    cx, cy = centre
    bw, bh = tw + 26, th + 22
    S = 4
    m = Image.new("L", (W_ * S, H_ * S), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([(cx - bw / 2) * S, (cy - bh / 2) * S, (cx + bw / 2) * S, (cy + bh / 2) * S],
                        radius=int(min(bw, bh) * 0.48 * S), fill=255)
    vx, vy = tail[0] - cx, tail[1] - cy
    n = np.hypot(vx, vy); ux, uy = vx / n, vy / n; px, py = -uy, ux
    bx, by = cx + ux * bh * 0.25, cy + uy * bh * 0.25
    d.polygon([((bx + px * 9) * S, (by + py * 9) * S), (tail[0] * S, tail[1] * S),
               ((bx - px * 1.8) * S, (by - py * 1.8) * S)], fill=255)
    fill = np.array(m.resize((W_, H_), Image.LANCZOS)).astype(np.float32) / 255
    edge = np.array(m.filter(ImageFilter.MaxFilter(11)).resize((W_, H_), Image.LANCZOS)).astype(np.float32) / 255
    out = img.astype(np.float32)
    out = out * (1 - edge[..., None]) + BUBBLE_INK * edge[..., None]
    out = out * (1 - fill[..., None]) + BUBBLE_PAPER * fill[..., None]
    t = np.zeros((H_, W_), np.float32)
    ox, oy = int(round(cx - tw / 2)), int(round(cy - th / 2)) - 1
    t[oy:oy + th, ox:ox + tw] = text
    out = out * (1 - t[..., None]) + BUBBLE_INK * t[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def go_from_photo(old_frame):
    W_, H_ = old_frame.shape[1], old_frame.shape[0]
    px0, py0, _, _ = GO_PHOTO_PANEL
    x0, y0, w = GO_PHOTO_CROP
    h = w * H_ / W_
    photo = Image.open(os.path.join(SB, "clerk-go-photos.jpg")).convert("RGB")
    shot = np.array(photo.crop((px0 + x0, py0 + y0, px0 + x0 + w, py0 + y0 + h)).resize((W_, H_), Image.LANCZOS))
    return speech_bubble(shot, bubble_text(old_frame), GO_BUBBLE, GO_TAIL)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug")
    a = ap.parse_args()
    raw = cells()
    cleaned = clean_all(raw)
    layer = spread_layer(cleaned["clerk-sorry"])
    os.makedirs(OUT, exist_ok=True)
    for name, img in cleaned.items():
        sheet = CELLS[name][0]
        out = over(img, layer, dy=SPREAD_DY[sheet])
        im = Image.fromarray(out).crop(CROP[sheet])
        if name == "clerk-sure":
            im = Image.fromarray(offer_order_form(np.array(im)))
        if name == "clerk-go":
            im = Image.fromarray(go_from_photo(np.array(im)))
        im.save(os.path.join(OUT, f"{name}.jpg"), quality=86, optimize=True, progressive=True)
        if a.debug:
            os.makedirs(a.debug, exist_ok=True)
            Image.fromarray(img).save(os.path.join(a.debug, f"{name}-clean.png"))
    print("frames:", ", ".join(cleaned))


if __name__ == "__main__":
    main()
