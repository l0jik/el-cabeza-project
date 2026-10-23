/* Five more posters for the splash videos, from the user's sheet of ten
   EL CABEZA NOVA logos (user: "Give me 5 more splash videos using what you
   already have and then incorporating this selections from this image as
   well. At the end, have Nova pulsing in a subtle way."). Each is one of the
   logos' emblems redrawn for a phone held upright: a disc split down the
   middle, dark stone on the left and gold on the right, blocks standing on a
   line, a thin upright line through it all.

     L1  "Classic"  (the sheet's first)    cream paper, a dark block and a gold one
     L2  "Orbit"    (second)               black, an orbit round the disc and its planet
     L3  "Star"     (third)                deep green, a gold rim and a star on the line
     L4  "Stripes"  (seventh)              cream, the disc in black and gold stripes
     L5  "Horizon"  (ninth)                brown, a double ring and lines out to the sides

   As with the other posters the title isn't in the artwork: lockup.js draws
   EL CABEZA and NOVA over it. Everything is drawn from the numbers kept here
   (centre, radius, the line the blocks stand on, the blocks' faces), so the
   videos can build each emblem up from the same parts. */
import { W, H, LAND } from "./size.js";
import { clamp, lerp, smooth, rng, fbm, noise3, canvas } from "./anim.js";

const D2R = Math.PI / 180;

/* Each emblem. C: the disc's centre, R: its radius, base: the line the
   blocks stand on (the disc is cut there unless whole), lines: the line
   colour and width. Blocks: back to front, each its faces left to right:
   [x0, x1, kind, height at x0, height at x1, edge], x in R from the middle
   and heights in R up from the base; edge: "line", "paper" or the logo's
   own (none on 1). axis: the upright line's ends, in R from the centre
   (down is +). */
export const LOGO = {
  L1: {
    name: "Classic", C: [540, 872], R: 372, cut: 0.93,
    ground: { c0: "#F1E9D8", c1: "#DACBAE", empty: "#E6DCC6", at: [540, 900], r: 1350, mott: 0.05, fleck: [122, 96, 62], flecks: 2600 },
    stone: { lo: [15, 13, 12], hi: [168, 163, 154], speck: 0.004, seed: 11 },
    gold: { lo: [118, 72, 32], mid: [199, 145, 79], hi: [236, 193, 121], seed: 12, kind: "leaf" },
    line: "#1E1B17", lw: 3, edge: null,
    axis: [-1.27, 1.15], axisOver: true, baseline: [-1, 1],
    blocks: [
      [[-0.41, 0, "dark", 0.69, 0.69]],
      [[0, 0.4, "gold", 0.55, 0.55]],
    ],
  },
  L2: {
    name: "Orbit", C: [540, 943], R: 315, cut: 0.87,
    ground: { c0: "#171512", c1: "#060505", empty: "#0F0E0C", at: [540, 900], r: 1250, mott: 0.035, fleck: [255, 240, 214], flecks: 900 },
    stone: { lo: [14, 13, 12], hi: [116, 112, 104], speck: 0.03, seed: 21 },
    gold: { lo: [124, 82, 36], mid: [205, 157, 88], hi: [241, 205, 137], seed: 22, kind: "leaf" },
    line: "#C9A063", lw: 2.5, edge: "#D6AE6C",
    axis: [-1.5, -0.04], baseline: [-1.32, 1.32], feet: [[-1.22, -0.6], [0.6, 1.2]],
    orbit: { inner: { c: [0, 0.14], r: 1.28 }, outer: { c: [0, 0.02], r: 1.43 }, planet: -20, pr: 0.08 },
    blocks: [
      [[-0.17, 0.04, "gold", 0.97, 0.9], [0.04, 0.38, "dark", 0.9, 0.8]],
      [[-0.55, -0.25, "dark", 0.52, 0.52], [-0.25, -0.15, "gold", 0.52, 0.48]],
    ],
  },
  L3: {
    name: "Star", C: [540, 925], R: 372, cut: 0.79,
    ground: { c0: "#1F3A2B", c1: "#081310", empty: "#15291F", at: [540, 880], r: 1300, mott: 0.05, fleck: [220, 236, 214], flecks: 700 },
    stone: { lo: [9, 13, 11], hi: [112, 116, 101], speck: 0.006, seed: 31 },
    gold: { lo: [112, 76, 36], mid: [188, 142, 78], hi: [232, 194, 126], seed: 32, kind: "brushed" },
    line: "#C59C5E", lw: 2.5, edge: "#CDA466",
    axis: [-1.19, 0.2], baseline: [-1.2, 1.2], rim: 3,
    star: { y: -1.19, a: 0.078, b: 0.052 },
    blocks: [
      [[0.02, 0.43, "dark", 0.87, 0.87]],
      [[-0.46, -0.19, "dark", 0.59, 0.59]],
      [[-0.19, 0.21, "gold", 0.59, 0.59]],
    ],
  },
  L4: {
    name: "Stripes", C: [540, 895], R: 370, cut: 0.9,
    ground: { c0: "#F0E8D6", c1: "#D9CAAD", empty: "#E5DBC5", at: [540, 900], r: 1350, mott: 0.05, fleck: [122, 96, 62], flecks: 2600 },
    stone: { lo: [20, 18, 16], hi: [34, 31, 28], speck: 0, seed: 41 },
    gold: { lo: [148, 103, 52], mid: [206, 160, 94], hi: [234, 199, 133], seed: 42, kind: "leaf" },
    line: "#1E1B17", lw: 3, edge: null,
    axis: [-1.21, 0.107], baseline: [-1, 1.03],
    stripes: { pitch: 36, light: 5, dark: 4, gap: 0.03 },
    blocks: [
      [[-0.36, -0.07, "cream", 0.82, 0.82]],
      [[-0.07, 0.25, "black", 0.8, 0.77]],
      [[0.11, 0.4, "black", 0.41, 0.41, "paper"]],
    ],
  },
  L5: {
    // (On the wide frame, on the left: the name's on the right.)
    name: "Horizon", C: LAND ? [530, 520] : [540, 860], R: LAND ? 290 : 320, cut: 1.18, whole: true, ghost: true,
    ground: { c0: "#5E452D", c1: "#21160D", empty: "#3E2C1C", at: LAND ? [610, 520] : [540, 820], r: LAND ? 1500 : 1300, mott: 0.045, fine: true, fleck: [236, 206, 150], flecks: 1400 },
    stone: { lo: [17, 12, 9], hi: [96, 79, 58], speck: 0.012, seed: 51, fleckGold: true },
    gold: { lo: [112, 80, 42], mid: [184, 146, 90], hi: [230, 198, 140], seed: 52, kind: "leaf", aged: true },
    line: "#C9A46A", lw: 2.5, edge: "#D2AD72",
    axis: [-1.41, 0.29], baseline: [-1.35, 1.35],
    rings: [1.04, 1.09],
    hairlines: [[-0.14, -1.34, -1.04], [0.04, -1.55, -1.04], [-0.04, -1.0, -0.38], [0.04, 1.04, 1.55], [0.22, 1.04, 1.36]],
    blocks: [
      [[0.02, 0.28, "dark", 1.41, 1.41]],
      [[-0.5, -0.24, "dark", 0.89, 0.89], [-0.24, 0.05, "gold", 0.89, 0.89]],
      [[0.04, 0.38, "gold", 0.56, 0.56], [0.38, 0.55, "dark", 0.56, 0.56]],
    ],
  },
};
for (const L of Object.values(LOGO)) L.base = L.C[1] + L.cut * L.R;
export const isLogo = (id) => id in LOGO;

// Frame pixels from the emblem's own units (x from the middle in R, y down from the centre in R).
export const at = (L, u, v) => [L.C[0] + u * L.R, L.C[1] + v * L.R];

/* ---------------- textures, made once ---------------- */

const hash = (x, y, s = 0) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// A canvas w x h painted pixel by pixel: fn(x, y, out) sets out to [r, g, b] (0..255).
function paint(w, h, fn, ox = 0, oy = 0) {
  const c = canvas(w, h), g = c.getContext("2d");
  const im = g.createImageData(w, h), d = im.data, o = [0, 0, 0];
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    fn(x + ox, y + oy, o);
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* Dark stone: black at the top, greying toward the lower left as if lit from
   below, mottled, with a dust of light specks (gold ones on 5). */
function stonePx(L, x, y, o) {
  const P = L.stone, u = (x - L.C[0]) / L.R, v = (y - L.C[1]) / L.R;
  let f = smooth((0.8 * v - 0.6 * u + 0.1) / 1.35) ** 1.25;
  f += 0.22 * fbm(x / 80, y / 80, P.seed, 3) + 0.08 * fbm(x / 13, y / 13, P.seed + 3, 2);
  f = clamp(f, 0, 1);
  let c = mix3(P.lo, P.hi, f);
  const s = hash(x, y, P.seed);
  if (P.speck && s > 1 - P.speck) {
    const k = (P.speck > 0.01 ? 0.08 : 0.18) + (P.speck > 0.01 ? 0.22 : 0.4) * ((s - (1 - P.speck)) / P.speck);
    c = mix3(c, P.fleckGold && hash(y, x, 7) > 0.5 ? [214, 170, 104] : [206, 200, 190], k);
  }
  const n = 4 * (hash(x, y, P.seed + 9) - 0.5);
  o[0] = c[0] + n; o[1] = c[1] + n; o[2] = c[2] + n;
}

/* Cellular noise at (x, y) (cells about one unit apart): the distances to the
   nearest point and the next, and the nearest one's own random value. */
function cells(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const dx = cx + hash(cx, cy, s) - x, dy = cy + hash(cy, cx, s + 1) - y, d = dx * dx + dy * dy;
    if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, s + 2); } else if (d < f2) f2 = d;
  }
  return [Math.sqrt(f1), Math.sqrt(f2), id];
}

/* Gold: leaf (crumpled: little flat facets each catching the light its own
   way, fine creases between, deeper toward the rim) or brushed (fine level
   streaks, a faint grain now and then). */
function goldPx(L, x, y, o, local = null) {
  const P = L.gold;
  const u = local ? local[0] : (x - L.C[0]) / L.R, v = local ? local[1] : (y - L.C[1]) / L.R;
  const rho = Math.hypot(u, v);
  let f;
  if (P.kind === "brushed") {
    // a sheen along a level band above the middle, fine streaks along x
    f = 0.48 - 0.16 * v - 0.12 * u + 0.2 * Math.exp(-(((v + 0.3) / 0.38) ** 2));
    f += 0.08 * fbm(x / 520, y / 3.4, P.seed, 3) + 0.08 * noise3(x / 64, y / 0.7, P.seed + 2);
    f += 0.06 * (hash(x >> 4, y, P.seed + 6) - 0.5);
  } else {
    f = 0.56 - 0.22 * v - 0.14 * u + 0.1 * fbm(x / 170, y / 170, P.seed + 9, 2);
    // the leaf crumpled: facets (warped cells) big and small, creases where cells meet
    const wx = x + 26 * fbm(x / 90, y / 90, P.seed + 1, 2), wy = y + 26 * fbm(x / 90, y / 90, P.seed + 2, 2);
    const [a1, b1, id1] = cells(wx / 46, wy / 46, P.seed + 3), [a2, b2, id2] = cells(wx / 17, wy / 17, P.seed + 4);
    f += 0.16 * (id1 - 0.5) + 0.07 * (id2 - 0.5) + 0.06 * fbm(x / 28, y / 28, P.seed + 8, 2);
    f += 0.1 * smooth(1 - (b1 - a1) / 0.07) - 0.045 * smooth(1 - (b2 - a2) / 0.1);
    if (P.aged) f += 0.12 * fbm(x / 45, y / 45, P.seed + 13, 3);
  }
  f += 0.04 * (hash(x, y, P.seed) - 0.5);
  if (!local) f -= 0.22 * smooth((rho - 0.72) / 0.28);
  const c = f < 0.5 ? mix3(P.lo, P.mid, clamp(f / 0.5)) : f < 1 ? mix3(P.mid, P.hi, (f - 0.5) / 0.5) : mix3(P.hi, [252, 236, 196], clamp((f - 1) / 0.3));
  o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
}

/* The two halves, unclipped, over a square about the disc 3.3 R wide (the
   videos show more of them than the disc while it forms): stone left of
   the middle, gold right of it. { canvas, x, y } (where it goes). */
const HALVES = {};
export function halves(id) {
  if (HALVES[id]) return HALVES[id];
  const L = LOGO[id], E = Math.ceil(1.65 * L.R);
  const x0 = Math.max(0, L.C[0] - E), x1 = Math.min(W, L.C[0] + E), y0 = Math.max(0, L.C[1] - E), y1 = Math.min(H, L.C[1] + E);
  const cv = paint(x1 - x0, y1 - y0, (x, y, o) => (x < L.C[0] ? stonePx(L, x, y, o) : goldPx(L, x, y, o)), x0, y0);
  return (HALVES[id] = { canvas: cv, x: x0, y: y0 });
}

/* The ground: a light from behind the emblem fading to the edges, a soft
   mottling (paper, felt, leather), and fine flecks. */
const GROUNDS = {};
export function groundCanvas(id) {
  if (GROUNDS[id]) return GROUNDS[id];
  const L = LOGO[id], G = L.ground, c = canvas(W, H), g = c.getContext("2d");
  const rg = g.createRadialGradient(G.at[0], G.at[1], 0, G.at[0], G.at[1], G.r);
  rg.addColorStop(0, G.c0);
  rg.addColorStop(1, G.c1);
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);
  const q = 4, s = L.stone.seed + 100;
  const m = paint(W / q, H / q, (x, y, o) => {
    const v = 128 + 127 * clamp(G.mott * 9 * (G.fine ? 0.6 * fbm(x / 22, y / 22, s, 4) + 0.6 * fbm(x / 4, y / 4, s + 1, 2) : fbm(x / 34, y / 34, s, 4) + 0.4 * fbm(x / 7, y / 7, s + 1, 2)), -1, 1);
    o[0] = o[1] = o[2] = v;
  });
  g.save();
  g.globalCompositeOperation = "overlay";
  g.imageSmoothingQuality = "high";
  g.drawImage(m, 0, 0, W, H);
  g.restore();
  const r = rng(s);
  for (let i = 0; i < G.flecks; i++) {
    g.fillStyle = `rgba(${G.fleck.join(",")},${(0.05 + 0.12 * r()).toFixed(3)})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 0.5 + 1.1 * r() ** 2, 0, Math.PI * 2);
    g.fill();
  }
  return (GROUNDS[id] = c);
}

// A fine grit for the dark blocks, tiled.
let GRIT = null;
function grit(ctx) {
  if (!GRIT) {
    const c = paint(256, 256, (x, y, o) => { const v = 128 + 90 * (hash(x, y, 77) - 0.5) + 60 * noise3(x / 9, y / 9, 3); o[0] = o[1] = o[2] = v; });
    GRIT = ctx.createPattern(c, "repeat");
  }
  return GRIT;
}

// Gold for a block's face: its own patch of leaf or brushing, made once.
const FACES = {};
function goldFace(id, key, w, h, seed) {
  const k = `${id}|${key}`;
  if (FACES[k]) return FACES[k];
  const L = LOGO[id];
  const P = { ...L, gold: { ...L.gold, seed } };
  return (FACES[k] = paint(Math.ceil(w), Math.ceil(h), (x, y, o) => goldPx(P, x + seed * 37, y, o, [(x / w - 0.5) * 0.9 - 0.3, (y / h - 0.5) * 1.1 - 0.25])));
}

/* ---------------- the parts ---------------- */

export function drawGround(ctx, id) {
  ctx.drawImage(groundCanvas(id), 0, 0);
}

// The disc's outline (cut at the base unless whole), as the current path.
export function discPath(ctx, id, r = null) {
  const L = LOGO[id], [cx, cy] = L.C, R = r ?? L.R;
  ctx.beginPath();
  if (L.whole || L.cut >= R / L.R) { ctx.arc(cx, cy, R, 0, Math.PI * 2); return; }
  const a = Math.asin(clamp((L.base - cy) / R, -1, 1));
  ctx.arc(cx, cy, R, a, Math.PI - a, true);
  ctx.closePath();
}

// The disc: its two halves (and 4's stripes, 3's gold rim).
export function drawDisc(ctx, id) {
  const L = LOGO[id], [cx, cy] = L.C, R = L.R, h = halves(id);
  ctx.save();
  discPath(ctx, id);
  ctx.clip();
  ctx.drawImage(h.canvas, h.x, h.y);
  if (L.stripes) stripes(ctx, id);
  ctx.restore();
  if (L.rim) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, L.base);
    ctx.clip();
    ctx.strokeStyle = L.line;
    ctx.lineWidth = L.rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R + L.rim / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// 4: level bands, black with the paper between on the left, gold with dark lines on the right; paper either side of the line.
function stripes(ctx, id) {
  const L = LOGO[id], S = L.stripes, [cx, cy] = L.C, R = L.R, top = cy - R;
  ctx.fillStyle = "rgba(44,30,16,0.82)";
  for (let y = top + S.pitch; y < L.base; y += S.pitch) ctx.fillRect(cx, y - S.dark / 2, R + 2, S.dark);
  ctx.save();
  ctx.beginPath();
  for (let y = top + S.pitch; y < L.base; y += S.pitch) ctx.rect(cx - R - 2, y - S.light / 2, R + 2, S.light);
  ctx.rect(cx - S.gap * R, top - 2, 2 * S.gap * R, R * 2 + 4);
  ctx.clip();
  drawGround(ctx, id);
  ctx.restore();
}

/* The lines round the disc, f (0..1) how far each is drawn: the orbit (2)
   and the rings (5). */
export function drawRings(ctx, id, f = 1) {
  const L = LOGO[id], [cx, cy] = L.C, R = L.R;
  if (f <= 0) return;
  ctx.save();
  ctx.strokeStyle = L.line;
  ctx.lineWidth = L.lw;
  ctx.lineCap = "round";
  if (L.orbit) {
    const O = L.orbit, foot = L.base - 0.08 * R;
    for (const [arc, dir] of [[O.inner, -1], [O.outer, 1]]) {
      const ox = cx + arc.c[0] * R, oy = cy + arc.c[1] * R, r = arc.r * R;
      const end = Math.asin(clamp((foot - oy) / r, -1, 1)) / D2R; // where it meets the feet
      const a1 = dir > 0 ? end : 180 - end;
      const sweep = dir > 0 ? a1 + 90 : 270 - a1;
      ctx.beginPath();
      ctx.arc(ox, oy, r, -90 * D2R, (-90 + dir * sweep * f) * D2R, dir < 0);
      ctx.stroke();
    }
  }
  if (L.rings) for (const [i, k] of L.rings.entries()) {
    const g = clamp(f * 1.15 - 0.15 * i);
    if (g <= 0) continue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, k * R, -90 * D2R, (-90 + 360 * g) * D2R);
    ctx.stroke();
  }
  ctx.restore();
}
const span01 = (t, a, b) => clamp((t - a) / (b - a));

// 5: the level lines out to the sides (and one across the dark half), each drawn out from the ring as f goes 0..1.
export function drawHairlines(ctx, id, f = 1) {
  const L = LOGO[id], [cx, cy] = L.C, R = L.R;
  if (!L.hairlines || f <= 0) return;
  ctx.save();
  ctx.fillStyle = L.line;
  for (const [v, u0, u1] of L.hairlines) {
    const near = Math.abs(Math.abs(u0) - 1.04) < Math.abs(Math.abs(u1) - 1.04) ? u0 : u1, far = near === u0 ? u1 : u0;
    const ue = lerp(near, far, smooth(f));
    ctx.fillRect(cx + Math.min(near, ue) * R, cy + v * R - 1, Math.abs(ue - near) * R, 2);
  }
  ctx.restore();
}

// The upright line (down from the top as f goes 0..1), the base line (out from the middle), 2's feet, 3's star, 2's planet.
export function drawLines(ctx, id, f = 1, which = "all") {
  const L = LOGO[id], [cx, cy] = L.C, R = L.R;
  if (f <= 0) return;
  ctx.save();
  ctx.fillStyle = L.line;
  if (which !== "base") {
    const y0 = cy + L.axis[0] * R, y1 = cy + L.axis[1] * R;
    ctx.fillRect(cx - L.lw / 2, y0, L.lw, (y1 - y0) * clamp(f));
  }
  if (which !== "axis") {
    const [u0, u1] = L.baseline, g = clamp(f);
    ctx.fillRect(cx + u0 * R * g, L.base - L.lw / 2, (u1 - u0) * R * g, L.lw);
    if (L.feet) for (const [a, b] of L.feet) {
      const m = (a + b) / 2, h = ((b - a) / 2) * g;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(cx + (m - h) * R, L.base - 0.08 * R - 1, 2 * h * R, 2);
      ctx.globalAlpha = 1;
    }
  }
  if (which === "all") {
    if (L.star) star(ctx, id, smooth(span01(f, 0.6, 1)));
    if (L.orbit) planet(ctx, id, smooth(span01(f, 0.7, 1)));
  }
  ctx.restore();
}

// 3: a four-point star at the top of the line, with a glow.
export function star(ctx, id, k = 1, glow = 1) {
  if (k <= 0) return;
  const L = LOGO[id], S = L.star, [x, y] = at(L, 0, S.y), a = S.a * L.R * k, b = S.b * L.R * k, w = 0.16 * b;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const gr = ctx.createRadialGradient(x, y, 0, x, y, a * 2.2);
  gr.addColorStop(0, `rgba(255,226,170,${0.42 * glow * k})`);
  gr.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(x - a * 3, y - a * 3, a * 6, a * 6);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "#F4E2B8";
  ctx.beginPath();
  ctx.moveTo(x, y - a);
  ctx.quadraticCurveTo(x + w, y - w, x + b, y);
  ctx.quadraticCurveTo(x + w, y + w, x, y + a);
  ctx.quadraticCurveTo(x - w, y + w, x - b, y);
  ctx.quadraticCurveTo(x - w, y - w, x, y - a);
  ctx.fill();
  ctx.restore();
}

// 2: the planet on the outer orbit.
export function planet(ctx, id, k = 1) {
  if (k <= 0) return;
  const L = LOGO[id], O = L.orbit, R = L.R;
  const ox = L.C[0] + O.outer.c[0] * R, oy = L.C[1] + O.outer.c[1] * R, a = O.planet * D2R;
  const x = ox + O.outer.r * R * Math.cos(a), y = oy + O.outer.r * R * Math.sin(a), r = O.pr * R * k;
  ctx.save();
  ctx.shadowColor = `rgba(240,190,110,${0.55 * k})`;
  ctx.shadowBlur = 34;
  const gr = ctx.createRadialGradient(x - 0.35 * r, y - 0.4 * r, 0, x, y, r);
  gr.addColorStop(0, "#F6DCA4");
  gr.addColorStop(0.6, "#D6A55E");
  gr.addColorStop(1, "#A6743A");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* A block's faces as polygons in frame pixels: [[x, y] x 4] (top left, top
   right, bottom right, bottom left) with the face's kind. */
export function blockFaces(id, i) {
  const L = LOGO[id], [cx] = L.C, R = L.R;
  return L.blocks[i].map(([u0, u1, kind, h0, h1, edge]) => ({
    kind, edge: edge ?? (kind === "cream" ? "line" : null),
    pts: [[cx + u0 * R, L.base - h0 * R], [cx + u1 * R, L.base - h1 * R], [cx + u1 * R, L.base], [cx + u0 * R, L.base]],
  }));
}
// The block's box in frame pixels: [x0, y0, x1, y1].
export function blockBox(id, i) {
  const ps = blockFaces(id, i).flatMap((f) => f.pts);
  return [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
}

function facePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// One block, as it stands: a soft shadow to its right (the light is up to the left), then its faces.
export function drawBlock(ctx, id, i) {
  const L = LOGO[id], faces = blockFaces(id, i), dark = L.ground.c0 < "#8";
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, L.base);
  ctx.clip();
  ctx.shadowColor = dark ? "rgba(0,0,0,0.55)" : "rgba(40,26,12,0.32)";
  ctx.shadowBlur = 0.07 * L.R;
  ctx.shadowOffsetX = 0.03 * L.R;
  ctx.shadowOffsetY = -0.01 * L.R;
  ctx.fillStyle = "#000";
  for (const f of faces) { facePath(ctx, f.pts); ctx.fill(); }
  ctx.restore();
  faces.forEach(({ kind, pts, edge: e }, j) => {
    const x0 = pts[0][0], x1 = pts[1][0], y1 = Math.min(pts[0][1], pts[1][1]), yb = pts[2][1];
    const w = x1 - x0, h = yb - y1;
    ctx.save();
    facePath(ctx, pts);
    ctx.clip();
    if (kind === "gold") {
      ctx.drawImage(goldFace(id, `${i}.${j}`, w, h, L.gold.seed + 3 + 7 * i + j), x0, y1, w, h);
      facets(ctx, x0, y1, w, h);
      if (!L.edge) {
        // its sides a shade deeper, so it stands clear of the gold behind
        ctx.strokeStyle = "rgba(92,56,20,0.55)";
        ctx.lineWidth = 3;
        facePath(ctx, pts);
        ctx.stroke();
      }
    } else if (kind === "cream") {
      drawGround(ctx, id);
    } else {
      const gr = ctx.createLinearGradient(0, y1, 0, yb);
      gr.addColorStop(0, kind === "black" ? "#1B1916" : "#24201C");
      gr.addColorStop(1, "#0E0C0B");
      ctx.fillStyle = gr;
      ctx.fillRect(x0, y1, w, h);
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = grit(ctx);
      ctx.fillRect(x0, y1, w, h);
    }
    ctx.restore();
    // a light on the top edge, and the edges themselves
    ctx.save();
    ctx.lineJoin = "miter";
    const edge = e === "line" ? L.line : e === "paper" ? L.ground.c0 : L.edge;
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = e ? 3 : 1.6;
      facePath(ctx, pts);
      ctx.stroke();
    } else {
      ctx.strokeStyle = kind === "gold" ? "rgba(255,236,196,0.55)" : "rgba(255,240,214,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      ctx.lineTo(...pts[1]);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/* Facets on a gold face: its diagonals and the diamond through its sides'
   middles, each piece its own light; a tall face folds once, corner to
   corner. */
function facets(ctx, x, y, w, h) {
  const m = [x + w / 2, y + h / 2], T = [x + w / 2, y], Rr = [x + w, y + h / 2], B = [x + w / 2, y + h], Lf = [x, y + h / 2];
  const TL = [x, y], TR = [x + w, y], BR = [x + w, y + h], BL = [x, y + h];
  ctx.save();
  if (h > 1.6 * w) {
    ctx.fillStyle = "rgba(255,240,205,0.08)";
    ctx.beginPath(); ctx.moveTo(...TL); ctx.lineTo(...TR); ctx.lineTo(...BR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(60,34,10,0.1)";
    ctx.beginPath(); ctx.moveTo(...TL); ctx.lineTo(...BR); ctx.lineTo(...BL); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,232,186,0.3)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(...TL); ctx.lineTo(...BR); ctx.stroke();
    ctx.restore();
    return;
  }
  const tris = [[TL, T, m, 0.1], [T, TR, m, 0.04], [TR, Rr, m, -0.02], [Rr, BR, m, -0.1], [BR, B, m, -0.14], [B, BL, m, -0.06], [BL, Lf, m, 0.02], [Lf, TL, m, 0.08]];
  for (const [a, b, c, k] of tris) {
    ctx.fillStyle = k > 0 ? `rgba(255,240,205,${k})` : `rgba(60,34,10,${-k})`;
    ctx.beginPath();
    ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,232,186,0.3)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(...TL); ctx.lineTo(...BR);
  ctx.moveTo(...TR); ctx.lineTo(...BL);
  ctx.moveTo(...T); ctx.lineTo(...Rr); ctx.lineTo(...B); ctx.lineTo(...Lf); ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawBlocks(ctx, id) {
  LOGO[id].blocks.forEach((_, i) => drawBlock(ctx, id, i));
}

/* The whole poster (no title). opt.blocks / opt.lines / opt.rings false
   leave those out (the videos bring them in themselves). */
export function drawLogo(ctx, id, opt = {}) {
  const L = LOGO[id];
  drawGround(ctx, id);
  if (opt.rings !== false) drawRings(ctx, id);
  drawDisc(ctx, id);
  if (opt.rings !== false) drawHairlines(ctx, id);
  if (opt.lines !== false && !L.axisOver) drawLines(ctx, id, 1, "axis");
  if (opt.blocks !== false) drawBlocks(ctx, id);
  if (opt.lines !== false) {
    drawLines(ctx, id, 1, L.axisOver ? "all" : "base");
    if (!L.axisOver) { if (L.star) star(ctx, id); if (L.orbit) planet(ctx, id); }
  }
}

export const LOGO_DRAW = Object.fromEntries(Object.keys(LOGO).map((id) => [id, (ctx, opt) => drawLogo(ctx, id, opt)]));
