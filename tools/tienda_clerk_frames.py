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


# The order form you hand over, in the clerk's hand in "Sure thing!"
# (user): a prop of the game's own form (themes/tienda-overlay.js
# OrderForm: aged cream paper, the department line in red, ORDER FORM in
# heavy black over a rule, the dark section band, the ruled rows with their
# quantities in blue, the red stamp), drawn large, then set into the frame
# standing up in his palm, leaning back a little, his thumb in front of it.
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"
# "Sure thing!": his open hand taken out; in its place his own hand from
# the walk-away frame (real, curled, the same light), scaled and turned to
# his wrist here, closed round the form; the form behind his hand and arm,
# against his palm, rising up beside his arm. (Frame coordinates, after
# CROP; done before the table's spread goes over, so the appliances stay
# in front of his hand.)
OPEN_HAND = (74, 266, 152, 326)  # where the open hand was (skin in here goes)
GO_HAND = (104, 194, 140, 250)   # the walk-away frame: his curled right hand and the end of his forearm
GO_WRIST = (122.0, 206.0)        # its wrist's middle there
SURE_WRIST = (105.5, 271.0)      # and where it joins his arm here
HAND_SCALE = 1.65
HAND_TURN = 6.0                  # degrees (his forearm leans a little here)
SURE_SHEET = [(109, 257), (155, 251), (161, 316), (116, 323)]  # the form: TL, TR, BR, BL (its left edge through the pinch between his thumb and fingers)
FOREARM = (80, 196, 136, 278)    # his forearm here (stays in front of the form)


# "I'll go check on that...": the form carried in his hanging right hand,
# its top corner pinched in the gap between his thumb and fingers (x
# 124-126, y 228-236: the floor shows through it), his thumb in front of
# it; it hangs below, turned a little (so narrower than flat).
HANG_SHEET = [(124.5, 229), (142, 233), (140, 283), (121, 279)]  # TL (in the pinch), TR, BR, BL


def order_form_art(w=448, h=592):
    from PIL import ImageFont
    rng = np.random.default_rng(1975)
    paper = np.zeros((h, w, 3), np.float32) + np.array([240, 230, 206], np.float32)
    # Age: a soft mottle, a couple of foxing spots, darker toward the edges.
    mott = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 24)
    paper += (mott / (np.abs(mott).max() + 1e-6))[..., None] * np.array([6, 7, 10], np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    paper -= (np.clip(1 - edge / 36, 0, 1) ** 2)[..., None] * np.array([16, 20, 28], np.float32)
    for cx, cy, r in [(380, 120, 9), (70, 430, 7)]:
        d = np.hypot(xx - cx, yy - cy)
        paper -= (np.clip(1 - d / r, 0, 1) ** 0.7)[..., None] * np.array([16, 24, 36], np.float32)
    im = Image.fromarray(np.clip(paper, 0, 255).astype(np.uint8))
    g = ImageDraw.Draw(im)
    INK, RED, BLUE = (40, 30, 24), (154, 59, 48), (38, 58, 140)
    TYPE, FINE, RULE = (92, 78, 66), (168, 154, 134), (176, 160, 134)
    f = lambda path, size: ImageFont.truetype(path, size)
    m = 30
    g.text((m, 26), "GAMES & HOBBY DEPT. \u00b7 1975", font=f(FONT, 19), fill=RED)
    g.text((m - 3, 50), "ORDER FORM", font=f(FONT, 60), fill=INK)
    g.rectangle([m, 122, w - m, 127], fill=INK)
    # The section band.
    g.rectangle([m, 142, w - m, 176], fill=(51, 37, 27))
    g.text((m + 12, 148), "1 \u00b7 PIECES", font=f(FONT, 20), fill=(236, 226, 204))
    # The rows: the item (type too small to read, as a line of grey), the
    # quantity box with a figure in blue ink.
    names = [0.36, 0.30, 0.26, 0.32, 0.28]
    qty = ["1", "1", "2", "1", "3"]
    for i, (nw, q) in enumerate(zip(names, qty)):
        y = 188 + i * 50
        g.rectangle([m + 4, y + 12, m + 50, y + 17], fill=FINE)  # stock no.
        g.rectangle([m + 66, y + 9, m + 66 + int(nw * w), y + 18], fill=TYPE)  # name
        g.rectangle([m + 66, y + 27, m + 66 + int(nw * w * 1.25), y + 31], fill=FINE)  # description
        bx = w - m - 58
        g.rectangle([bx, y + 6, bx + 50, y + 40], outline=INK, width=3)
        g.text((bx + 15, y + 6), q, font=f(MONO, 30), fill=BLUE)
        g.line([m, y + 48, w - m, y + 48], fill=RULE, width=2)
    # The foot: the rule, a signature in blue.
    g.rectangle([m, h - 104, w - m, h - 100], fill=INK)
    g.text((m, h - 90), "SIGNED", font=f(FONT, 16), fill=RED)
    pts = [(m + 84 + i * 8, h - 66 + 8 * np.sin(i * 1.3) - i * 0.5) for i in range(22)]
    g.line(pts, fill=BLUE, width=4, joint="curve")
    # The red stamp by the signature, at a slant, faint and uneven.
    st = Image.new("L", (250, 74), 0)
    sd = ImageDraw.Draw(st)
    sd.rectangle([4, 4, 245, 69], outline=255, width=6)
    sd.text((18, 14), "STORE ORDER", font=f(FONT, 37), fill=255)
    st = st.rotate(9, expand=True, resample=Image.BICUBIC)
    a = np.array(st).astype(np.float32) / 255 * (0.5 + 0.35 * rng.random(st.size[::-1]))
    a = np.clip(cv2.GaussianBlur(a, (0, 0), 1.0), 0, 1)
    arr = np.array(im).astype(np.float32)
    ox, oy = w - st.size[0] - 22, h - st.size[1] - 18
    region = arr[oy:oy + st.size[1], ox:ox + st.size[0]]
    region[:] = region * (1 - a[..., None]) + np.array(RED, np.float32) * a[..., None]
    return arr.astype(np.uint8)


def _skin(reg):
    R, G, B = reg[..., 0].astype(int), reg[..., 1].astype(int), reg[..., 2].astype(int)
    return (R > 140) & (R - G > 30) & (R - B > 40)


def _capsule(xx, yy, p0, p1, r):
    """Signed distance to a capsule from p0 to p1, radius r."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
    return np.hypot(xx - (x0 + t * dx), yy - (y0 + t * dy)) - r


def lift_hand(go):
    """His curled right hand from the walk-away frame (GO_HAND), off the
    floor it was shot against: (colour, alpha) at that frame's size. The
    floor behind it is estimated by painting the hand out; each pixel's
    share of hand is how far it is from that floor; its colour is the floor
    taken back out (on the faintest edge pixels, his skin's). The forearm
    fades in over its top 14 px (it joins his own arm there)."""
    H_, W_ = go.shape[:2]
    x0, y0, x1, y1 = GO_HAND
    reg = go[y0:y1, x0:x1]
    f = reg.astype(np.float32)
    core = _skin(reg).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(core, 8)
    if n > 1:
        core = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    wide = cv2.dilate(core, np.ones((3, 3), np.uint8), iterations=3)
    # How far each pixel is from the floor toward his skin (the slit of
    # floor between thumb and fingers comes out as floor, as it should).
    floor = np.median(f[wide == 0], axis=0)
    skinc = np.median(f[core > 0], axis=0)
    axis = skinc - floor
    tproj = ((f - floor) @ axis) / (axis @ axis)
    a = np.clip((tproj - 0.18) / 0.55, 0, 1) * (wide > 0)
    # (Solid where it's surely hand: his pale highlights included.)
    solid = cv2.erode(core, np.ones((2, 2), np.uint8)) > 0
    a[solid] = 1
    a = cv2.GaussianBlur(a, (0, 0), 0.4)
    a *= np.clip(np.arange(y1 - y0, dtype=np.float32)[:, None] / 14, 0, 1)
    fg = floor + (f - floor) / np.maximum(a, 0.5)[..., None]
    w = np.clip((a - 0.25) / 0.5, 0, 1)[..., None]
    fg = skinc * (1 - w) + np.clip(fg, 0, 255) * w
    # (Round the hand, its own skin colour, not black: the scale-up and the
    # sharpening after it then ring on nothing at its edge.)
    a = cv2.erode(a, np.ones((2, 2), np.uint8))
    C = np.zeros((H_, W_, 3), np.float32) + skinc; C[y0:y1, x0:x1] = fg * (a[..., None] > 0.02) + skinc * (a[..., None] <= 0.02)
    A = np.zeros((H_, W_), np.float32); A[y0:y1, x0:x1] = a
    return C, A, skinc


def hold_order_form(img, partner=None, go=None):
    """'Sure thing!': the open hand out, the form in, his real hand round
    it (see the constants above)."""
    H_, W_ = img.shape[:2]
    base = img.copy()
    # His skin here (the forearm, near the wrist: the back of a hand is
    # the forearm's colour, not the palm's).
    fx0, fy0, fx1, fy1 = FOREARM
    freg = img[fy0:fy1, fx0:fx1]
    fsk = _skin(freg)
    skin_here = np.median(freg[fsk].reshape(-1, 3).astype(np.float32)[-400:], axis=0)
    # The open hand out (its skin in OPEN_HAND below the wrist), the
    # background painted back from round it: the "Hi there" frame (the same
    # camera) where it shows no hand of its own, the rest painted in.
    x0, y0, x1, y1 = OPEN_HAND
    hand = np.zeros((H_, W_), np.uint8)
    hand[y0:y1, x0:x1] = _skin(base[y0:y1, x0:x1])
    hand[:274] = 0
    hand = cv2.dilate(hand, np.ones((3, 3), np.uint8), iterations=2) > 0
    if partner is not None:
        ok = np.zeros((H_, W_), bool)
        ok[y0:y1, x0:x1] = ~cv2.dilate(_skin(partner[y0:y1, x0:x1]).astype(np.uint8), np.ones((5, 5), np.uint8), iterations=2).astype(bool)
        take = hand & ok
        base[take] = partner[take]
        hand &= ~take
    base = cv2.inpaint(base, hand.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    out = base.astype(np.float32)
    # The form: up beside his arm, against his palm, its foot in his hand;
    # lit from above, its shadow on him.
    art = order_form_art().astype(np.float32)
    ah, aw = art.shape[:2]
    art *= np.linspace(1.0, 0.86, ah, dtype=np.float32)[:, None, None] * np.array([1.0, 0.97, 0.92], np.float32)
    small = art
    for _ in range(2):
        small = cv2.resize(small, (small.shape[1] // 2, small.shape[0] // 2), interpolation=cv2.INTER_AREA)
    sh_, sw_ = small.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [sw_, 0], [sw_, sh_], [0, sh_]]), np.float32(SURE_SHEET))
    sheet = cv2.GaussianBlur(cv2.warpPerspective(small, M, (W_, H_), flags=cv2.INTER_AREA), (0, 0), 0.45)
    alpha = cv2.GaussianBlur(cv2.warpPerspective(np.ones((sh_, sw_), np.float32), M, (W_, H_), flags=cv2.INTER_LINEAR), (0, 0), 0.45)
    shd = cv2.GaussianBlur(np.roll(np.roll(alpha, 3, axis=1), 2, axis=0), (0, 0), 2.2) * 0.35
    out *= (1 - shd)[..., None]
    out = out * (1 - alpha[..., None]) + sheet * alpha[..., None]
    # His forearm back in front of it (his own pixels).
    arm = np.zeros((H_, W_), np.uint8)
    arm[fy0:fy1, fx0:fx1] = fsk
    n, lab, st, _ = cv2.connectedComponentsWithStats(arm, 8)
    if n > 1:
        arm = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    arm = cv2.morphologyEx(arm, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    am = cv2.GaussianBlur(arm.astype(np.float32), (0, 0), 0.6)
    ash = cv2.GaussianBlur(np.roll(np.roll(am, 3, axis=1), 2, axis=0), (0, 0), 1.6) * alpha * 0.4
    out *= (1 - ash * (1 - am))[..., None]
    out = out * (1 - am[..., None]) + img.astype(np.float32) * am[..., None]
    # His hand: lifted from the walk-away frame, its colour brought to his
    # skin here, scaled and turned about its wrist onto his wrist here.
    if go is not None:
        C, A, skinc = lift_hand(go)
        C *= (skin_here / np.maximum(skinc, 1))[None, None, :]
        Mr = cv2.getRotationMatrix2D(GO_WRIST, HAND_TURN, HAND_SCALE)
        Mr[:, 2] += np.array(SURE_WRIST) - np.array(GO_WRIST)
        Cw = cv2.warpAffine(C, Mr, (W_, H_), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        Aw = np.clip(cv2.warpAffine(A, Mr, (W_, H_), flags=cv2.INTER_LINEAR), 0, 1)
        # A touch of sharpening back after the scale-up, and the photo's grain.
        Cw = np.clip(Cw + 0.6 * (Cw - cv2.GaussianBlur(Cw, (0, 0), 1.2)), 0, 255)
        Cw += np.random.default_rng(11).normal(0, 2.2, Cw.shape) * Aw[..., None]
        hs = cv2.GaussianBlur(np.roll(np.roll(Aw, 3, axis=1), 3, axis=0), (0, 0), 2.0) * 0.42
        out *= (1 - hs * (1 - Aw))[..., None]
        out = out * (1 - Aw[..., None]) + Cw * Aw[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def hang_order_form(img):
    """'I'll go check on that...': the form behind his hand, its corner in
    the pinch between thumb and fingers, hanging below; his hand (lifted
    off the floor as for 'Sure thing!', lift_hand) back over it, so the
    gap shows the paper's edge and his thumb lies across its margin."""
    H_, W_ = img.shape[:2]
    art = order_form_art().astype(np.float32)
    ah, aw = art.shape[:2]
    art *= np.linspace(0.96, 0.84, ah, dtype=np.float32)[:, None, None] * np.array([0.98, 0.95, 0.89], np.float32)
    small = art
    for _ in range(3):
        small = cv2.resize(small, (small.shape[1] // 2, small.shape[0] // 2), interpolation=cv2.INTER_AREA)
    sh_, sw_ = small.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [sw_, 0], [sw_, sh_], [0, sh_]]), np.float32(HANG_SHEET))
    sheet = cv2.GaussianBlur(cv2.warpPerspective(small, M, (W_, H_), flags=cv2.INTER_AREA), (0, 0), 0.35)
    alpha = cv2.GaussianBlur(cv2.warpPerspective(np.ones((sh_, sw_), np.float32), M, (W_, H_), flags=cv2.INTER_LINEAR), (0, 0), 0.4)
    # The bend where it hangs from the pinch: its near side a touch
    # brighter, the far side turned from the light.
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
    sheet *= (1.03 - 0.12 * np.clip((xx - 121) / 21, 0, 1))[..., None]
    out = img.astype(np.float32)
    sh = cv2.GaussianBlur(np.roll(np.roll(alpha, 4, axis=1), 3, axis=0), (0, 0), 2.6) * 0.2
    out *= (1 - sh)[..., None]
    out = out * (1 - alpha[..., None]) + sheet * alpha[..., None]
    # His hand back over it (only where there's sheet behind; elsewhere
    # the photo is untouched), and its shadow on the paper.
    C, A, _ = lift_hand(img)
    A = A * (alpha > 0.02)
    hs = cv2.GaussianBlur(np.roll(np.roll(A, 2, axis=1), 2, axis=0), (0, 0), 1.3) * alpha * 0.4
    out *= (1 - hs * (1 - A))[..., None]
    out = out * (1 - A[..., None]) + C * A[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


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
        if name == "clerk-sure":
            # (Before the spread goes over: the appliances stay in front.)
            cx0, cy0, cx1, cy1 = CROP[sheet]
            fr = lambda k: cleaned[k][cy0:cy1, cx0:cx1]
            img = img.copy()
            img[cy0:cy1, cx0:cx1] = hold_order_form(fr("clerk-sure"), fr("clerk-hello"), fr("clerk-go"))
        out = over(img, layer, dy=SPREAD_DY[sheet])
        im = Image.fromarray(out).crop(CROP[sheet])
        if name == "clerk-go":
            im = Image.fromarray(hang_order_form(np.array(im)))
        im.save(os.path.join(OUT, f"{name}.jpg"), quality=86, optimize=True, progressive=True)
        if a.debug:
            os.makedirs(a.debug, exist_ok=True)
            Image.fromarray(img).save(os.path.join(a.debug, f"{name}-clean.png"))
    print("frames:", ", ".join(cleaned))


if __name__ == "__main__":
    main()
