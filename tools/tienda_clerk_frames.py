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
# "Sure thing!": his open hand taken out and a fist painted in its place,
# closed round the sheet's bunched bottom edge, the sheet fanning up out of
# it toward you. (Frame coordinates, after CROP.)
FIST_AT = (88, 268)        # the fist's little canvas, top-left
FIST_SIZE = 48
OPEN_HAND = (74, 266, 152, 326)  # where the open hand was (skin in here goes)
SHEET_TOP, SHEET_BOT = 212, 284  # the sheet's rows, top to where it enters the fist
SHEET_X_TOP = (84, 146)    # its width up top
SHEET_X_BOT = (97, 131)    # gathered into the fist
SHEET_TILT = -4.0          # degrees, about the fist
# "I'll go check on that...": the sheet hanging from his hand as he walks.
HANG_FINGERS = (108, 224, 134, 246)  # his fingers (in front of its top edge)
HANG_QUAD = [(104, 235), (137, 238), (134, 283), (99, 279)]


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


def paint_fist(skin, tex, size=FIST_SIZE, ss=6, k=FIST_SIZE / 44):
    """A right fist closed round something upright, seen from the curled
    fingers' side: four fingers stacked (index on top), each rounded, with
    its crease and its knuckle at the left (the back of the hand turning
    away), the fingertips curled into the palm on the right over the heel
    of the hand; the thumb across the top of them, nail and all. Lit from
    above and to the left, and carrying the real skin's grain and blotch
    (tex, a patch of his own palm). Painted ss times over size and brought
    down (RGBA, size x size)."""
    n = size * ss
    yy, xx = (np.mgrid[0:n, 0:n].astype(np.float32) + 0.5) / ss / k  # (drawn on a 44 grid)
    skin = np.array(skin, np.float32)
    # His skin's own variation: the palm patch, mirrored to fill, kept only
    # for its detail (divided by its own blur).
    t = tex.astype(np.float32)
    t = np.concatenate([t, t[:, ::-1]], 1); t = np.concatenate([t, t[::-1]], 0)
    reps = (int(np.ceil(size / t.shape[0])) + 1, int(np.ceil(size / t.shape[1])) + 1, 1)
    t = np.tile(t, reps)[:size, :size]
    detail = t / (cv2.GaussianBlur(t, (0, 0), 3) + 1)
    detail = cv2.resize(np.clip(detail, 0.8, 1.2), (n, n), interpolation=cv2.INTER_CUBIC)
    col = np.zeros((n, n, 3), np.float32)
    a = np.zeros((n, n), np.float32)
    occ = np.zeros((n, n), np.float32)
    def lay(d, rgb, soft=0.7):
        m = np.clip(0.5 - d / soft, 0, 1)
        # (a shadow just round each part, on what's under it)
        occ[:] = np.maximum(occ * (1 - m), np.exp(-np.maximum(d, 0) / 1.1) * (d > 0) * a)
        col[:] = col * (1 - m[..., None]) + rgb * m[..., None]
        a[:] = np.maximum(a, m)
        return m
    light = np.clip(1.07 - 0.008 * (xx - 6) - 0.011 * (yy - 6), 0.8, 1.1)[..., None]
    def rrect(cx, cy, hw, hh, r):
        qx, qy = np.maximum(np.abs(xx - cx) - (hw - r), 0), np.maximum(np.abs(yy - cy) - (hh - r), 0)
        return np.hypot(qx, qy) - r
    # The hand's mass behind the fingers, with the heel of the palm low on
    # the right, where the fingertips curl in.
    lay(np.minimum(rrect(21, 21, 15, 15.5, 8), rrect(31, 30, 7, 6, 5)), skin * 0.8 * light)
    fingers = [((7.6, 12.0), (33.0, 12.8), 3.7), ((7.0, 18.6), (34.2, 19.3), 3.8),
               ((7.8, 25.2), (33.4, 25.8), 3.6), ((9.6, 31.3), (30.4, 31.8), 3.1)]
    for i, (p0, p1, r) in enumerate(fingers):
        d = _capsule(xx, yy, p0, p1, r)
        cy = (p0[1] + p1[1]) / 2
        v = np.clip((yy - cy) / r, -1, 1)
        u = np.clip((xx - p0[0]) / (p1[0] - p0[0]), 0, 1)
        shade = 1.0 + 0.15 * (-v) - 0.28 * np.clip(v, 0, 1) ** 1.5
        shade *= 1.0 - 0.24 * np.clip((u - 0.74) / 0.26, 0, 1) ** 1.3   # tips curling in
        shade *= 1.0 + 0.10 * np.exp(-((u - 0.06) / 0.08) ** 2) * (v < 0.3)  # knuckle
        shade *= 1.0 - 0.05 * np.exp(-((u - 0.45) / 0.05) ** 2)            # the middle joint's line
        tint = np.array([1.0, 0.985 - 0.01 * i, 0.985 - 0.01 * i], np.float32)
        m = lay(d, skin * tint * shade[..., None] * light)
        crease = np.exp(-((d + 0.25) / 0.6) ** 2) * (v > 0.15)
        col[:] *= (1 - 0.38 * crease * m)[..., None]
    # The thumb across the top, from its base on the left to its tip on the
    # middle finger; its nail.
    t0, t1 = (3.6, 13.5), (26.5, 9.3)
    d = _capsule(xx, yy, t0, t1, 4.3)
    v = np.clip((yy - 11.4) / 4.3, -1, 1)
    m = lay(d, skin * np.array([1.01, 0.965, 0.96], np.float32) * (1.0 + 0.16 * (-v) - 0.25 * np.clip(v, 0, 1) ** 1.5)[..., None] * light)
    col[:] *= (1 - 0.4 * np.exp(-((d + 0.2) / 0.65) ** 2) * (v > 0.05) * m)[..., None]
    ang = np.arctan2(t1[1] - t0[1], t1[0] - t0[0])
    rx, ry = (xx - 24.0) * np.cos(ang) + (yy - 9.6) * np.sin(ang), -(xx - 24.0) * np.sin(ang) + (yy - 9.6) * np.cos(ang)
    nm = np.clip((1 - (rx / 2.6) ** 2 - (ry / 2.1) ** 2) * 3, 0, 1) * m
    col[:] = col * (1 - 0.5 * nm[..., None]) + np.array([236, 206, 196], np.float32) * 0.5 * nm[..., None]
    # The real skin's grain; the shadows where parts meet; the rim turning away.
    col *= detail
    col *= (1 - 0.16 * occ)[..., None]
    edge = np.clip(1 - np.abs(cv2.GaussianBlur(a, (0, 0), 1.0 * ss) - 0.5) * 2, 0, 1) * (a > 0.5)
    col *= (1 - 0.07 * edge)[..., None]
    rgba = np.dstack([np.clip(col, 0, 255), a * 255])
    return cv2.resize(rgba, (size, size), interpolation=cv2.INTER_AREA)


def sheet_in_fist(art, W_, H_):
    """The order form, its bottom edge bunched into his fist and fanning
    up: each row of the sheet as wide as SHEET_X_TOP up top, narrowing
    into SHEET_X_BOT over the last part, with the folds of the gathering;
    tilted a little. Returns (rgb, alpha) at frame size."""
    ah, aw = art.shape[:2]
    small = cv2.resize(art.astype(np.float32), (aw // 4, ah // 4), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
    t = (yy - SHEET_TOP) / (SHEET_BOT - SHEET_TOP)
    g = np.clip((t - 0.7) / 0.3, 0, 1)
    g = g * g * (3 - 2 * g)  # gathering, over the last part
    L = SHEET_X_TOP[0] + (SHEET_X_BOT[0] - SHEET_X_TOP[0]) * g
    R = SHEET_X_TOP[1] + (SHEET_X_BOT[1] - SHEET_X_TOP[1]) * g
    u = (xx - L) / (R - L)
    inside = (t >= 0) & (t <= 1.08) & (u >= 0) & (u <= 1)
    mapx = (u * (sw - 1)).astype(np.float32)
    mapy = (np.clip(t, 0, 1) * (sh - 1)).astype(np.float32)
    rgb = cv2.remap(small, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # The folds where it's gathered: ridges and valleys running into the fist.
    folds = 1 + 0.16 * g * np.sin(u * np.pi * 7 + 0.6) - 0.05 * g
    # And the light: a touch darker toward the fist.
    rgb *= (folds * (1.0 - 0.10 * np.clip(t, 0, 1)))[..., None]
    alpha = inside.astype(np.float32)
    # Tilted about the fist.
    cx, cy = (SHEET_X_BOT[0] + SHEET_X_BOT[1]) / 2, SHEET_BOT
    M = cv2.getRotationMatrix2D((cx, cy), SHEET_TILT, 1.0)
    rgb = cv2.warpAffine(rgb, M, (W_, H_), flags=cv2.INTER_LINEAR)
    alpha = cv2.warpAffine(alpha, M, (W_, H_), flags=cv2.INTER_LINEAR)
    return rgb, alpha


def hold_order_form(img, partner=None):
    """'Sure thing!': the open hand out, the sheet in, the fist over it."""
    H_, W_ = img.shape[:2]
    base = img.copy()
    # Its skin, from the palm, for the fist.
    x0, y0, x1, y1 = OPEN_HAND
    reg = base[y0:y1, x0:x1]
    sk = _skin(reg)
    skin = np.median(reg[sk].reshape(-1, 3), axis=0) if sk.any() else np.array([222, 160, 145])
    tex = base[284:308, 102:128].copy()  # (his palm, for the grain)
    # The open hand out (its skin in OPEN_HAND below the wrist), the
    # background painted back from round it.
    hand = np.zeros((H_, W_), np.uint8)
    hand[y0:y1, x0:x1] = sk
    hand[:274] = 0  # (the forearm stays; the sheet and the fist cover the wrist)
    hand = cv2.dilate(hand, np.ones((3, 3), np.uint8), iterations=2) > 0
    # What was behind it: the "Hi there" frame (the same camera) where it
    # shows no hand of its own; the rest painted in from round it.
    if partner is not None:
        pr = partner[y0:y1, x0:x1]
        ok = np.zeros((H_, W_), bool)
        ok[y0:y1, x0:x1] = ~cv2.dilate(_skin(pr).astype(np.uint8), np.ones((5, 5), np.uint8), iterations=2).astype(bool)
        take = hand & ok
        base[take] = partner[take]
        hand &= ~take
    base = cv2.inpaint(base, hand.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    art = order_form_art()
    ah = art.shape[0]
    art = np.clip(art.astype(np.float32) * np.linspace(1.0, 0.9, ah, dtype=np.float32)[:, None, None] * np.array([1.0, 0.98, 0.94], np.float32), 0, 255)
    sheet, alpha = sheet_in_fist(art, W_, H_)
    sheet = cv2.GaussianBlur(sheet, (0, 0), 0.5)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.5)
    out = base.astype(np.float32)
    # The sheet's shadow on him, down and to the right.
    sh = cv2.GaussianBlur(np.roll(np.roll(alpha, 3, axis=1), 2, axis=0), (0, 0), 2.2) * 0.36
    out *= (1 - sh)[..., None]
    out = out * (1 - alpha[..., None]) + sheet * alpha[..., None]
    # The fist, over the sheet's gathered end.
    fist = paint_fist(skin * 0.97, tex)
    fx, fy = FIST_AT
    fa = cv2.GaussianBlur(fist[..., 3] / 255.0, (0, 0), 0.6)
    frgb = cv2.GaussianBlur(fist[..., :3], (0, 0), 0.75)
    frgb += np.random.default_rng(7).normal(0, 2.5, frgb.shape)  # the photo's grain
    F = np.zeros((H_, W_), np.float32); F[fy:fy + FIST_SIZE, fx:fx + FIST_SIZE] = fa
    C = np.zeros((H_, W_, 3), np.float32); C[fy:fy + FIST_SIZE, fx:fx + FIST_SIZE] = frgb
    # Its shadow on the sheet and on him.
    fs = cv2.GaussianBlur(np.roll(np.roll(F, 2, axis=1), 2, axis=0), (0, 0), 1.8) * 0.4
    out *= (1 - fs * (1 - F))[..., None]
    out = out * (1 - F[..., None]) + C * F[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def hang_order_form(img):
    """'I'll go check on that...': the form hanging from his right hand as
    he walks off, held by its top edge in his curled fingers (which stay
    in front of it), a little in his own shadow; its shadow on the floor
    beside it."""
    H_, W_ = img.shape[:2]
    art = order_form_art().astype(np.float32)
    ah, aw = art.shape[:2]
    art *= np.linspace(0.97, 0.84, ah, dtype=np.float32)[:, None, None] * np.array([0.97, 0.94, 0.88], np.float32)
    small = cv2.resize(art, (aw // 6, ah // 6), interpolation=cv2.INTER_AREA)
    sh_, sw_ = small.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [sw_, 0], [sw_, sh_], [0, sh_]]), np.float32(HANG_QUAD))
    sheet = cv2.warpPerspective(small, M, (W_, H_), flags=cv2.INTER_LINEAR)
    alpha = cv2.warpPerspective(np.ones((sh_, sw_), np.float32), M, (W_, H_), flags=cv2.INTER_LINEAR)
    sheet = cv2.GaussianBlur(sheet, (0, 0), 0.6)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.55)
    out = img.astype(np.float32)
    sh = cv2.GaussianBlur(np.roll(np.roll(alpha, 4, axis=1), 3, axis=0), (0, 0), 2.5) * 0.3
    out *= (1 - sh)[..., None]
    out = out * (1 - alpha[..., None]) + sheet * alpha[..., None]
    # His fingers back over its top edge.
    x0, y0, x1, y1 = HANG_FINGERS
    sk = np.zeros((H_, W_), np.uint8)
    sk[y0:y1, x0:x1] = _skin(img[y0:y1, x0:x1])
    sk = cv2.morphologyEx(sk, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    f = cv2.GaussianBlur(sk.astype(np.float32), (0, 0), 0.6)
    fs = np.roll(cv2.GaussianBlur(sk.astype(np.float32), (0, 0), 1.3), 2, axis=0) * alpha * 0.35
    out *= (1 - fs)[..., None]
    out = out * (1 - f[..., None]) + img.astype(np.float32) * f[..., None]
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
        out = over(img, layer, dy=SPREAD_DY[sheet])
        im = Image.fromarray(out).crop(CROP[sheet])
        if name == "clerk-sure":
            partner = np.array(Image.fromarray(over(cleaned["clerk-hello"], layer, dy=SPREAD_DY[sheet])).crop(CROP[sheet]))
            im = Image.fromarray(hold_order_form(np.array(im), partner))
        if name == "clerk-go":
            im = Image.fromarray(hang_order_form(np.array(im)))
        im.save(os.path.join(OUT, f"{name}.jpg"), quality=86, optimize=True, progressive=True)
        if a.debug:
            os.makedirs(a.debug, exist_ok=True)
            Image.fromarray(img).save(os.path.join(a.debug, f"{name}-clean.png"))
    print("frames:", ", ".join(cleaned))


if __name__ == "__main__":
    main()
