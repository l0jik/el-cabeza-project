/* The Monolith's move markers, five to choose from (user: "the potential
   move placement markers when you select a piece, I don't like those on
   the monolith. Show me 5 other options what we can choose. Something
   that might be thematic."). Each from the world the Monolith stands in,
   each with its crush (the opponent's Cabeza under it: drawn out to the
   square's corners and past its edges, where the Cabeza leaves the rock
   showing):

     cupring  cup-and-ring marks, the neolithic carving: a cup pecked into
              the rock, two rings round it, a channel running out of it
              back toward the stone that's coming; a crush, three rings
              and four cups at the corners, the pecking glowing like
              embers
     hand     a hand stencilled in red ochre, as on the walls of the Cueva
              de las Manos in Patagonia: the hand's shape left bare in a
              cloud of sprayed pigment, its fingers pointing the way the
              stone goes; a crush, a deeper red sprayed wide round the
              square, four hands at its corners reaching in
     fire     firelight on the stone: a warm pool, flickering, embers
              rising from it; a crush, hotter and wider, the rock's cracks
              glowing in its corners
     beam     light falling through the stones onto the square, as the
              sun through a stone circle's gate: a pale shaft over it, its
              floor lit, dust turning in it; a crush, the last of the sun,
              red
     margin   the square's edge freshly dressed, a mason's drafted margin:
              a band chiselled smooth round it, the tool's strokes across
              it, the middle left rough; a crush, the band in ember and a
              cross cut deep from corner to corner

   Painted once on canvases (the carving's depth as a normal map, so the
   moon lights its walls) and kept for every marker after: the same
   pattern every time, not chance. Which one: ?marker=<name> on the Lab's
   page to try each (markerKind), else the spec's. */
import * as THREE from "three";
import { SQUARE_SIZE, GHOST_SCALE } from "../../engine/constants.js";

export const MONOLITH_MARKERS = {
  cupring: "Cup and ring",
  hand: "Ochre hands",
  fire: "Firelight",
  beam: "Light through the stones",
  margin: "Dressed margin",
};

/* The marker the Monolith draws: ?marker=<one of MONOLITH_MARKERS> on the
   page, to try them; else `fallback` (the spec's). */
export function markerKind(fallback) {
  try {
    const k = new URLSearchParams(window.location.search).get("marker");
    if (k && Object.prototype.hasOwnProperty.call(MONOLITH_MARKERS, k)) return k;
  } catch (e) { /* no page: the spec's */ }
  return fallback;
}

/* ---------------------------------------------------------------- helpers */

function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// (A glow gone to nothing before its sheet's edge, so no edge shows.)
const edgeFade = (s, px, py) => { const e = Math.min(px, s.W - 1 - px, py, s.H - 1 - py) / PPU; return e >= 0.08 ? 1 : e <= 0 ? 0 : (e / 0.08) * (e / 0.08) * (3 - 2 * (e / 0.08)); };
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Pixels to a world unit on every sheet (a square is ~300 across).
const PPU = 300;
const CELL = SQUARE_SIZE * GHOST_SCALE;

/* The squares a footprint covers, their middles from its middle. */
function cellsOf(hx, hz) {
  const nx = Math.max(1, Math.round((2 * hx) / CELL)), nz = Math.max(1, Math.round((2 * hz) / CELL));
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push({ x: (i - (nx - 1) / 2) * SQUARE_SIZE, z: (j - (nz - 1) / 2) * SQUARE_SIZE, i, j });
  return { nx, nz, list: out };
}

/* A sheet over the footprint and `pad` round it: its canvas, a height
   field (0 the rock's face, below it negative), and world (x, z) from the
   marker's middle to pixels. */
function sheet(hx, hz, pad) {
  const W = Math.round((hx + pad) * 2 * PPU), H = Math.round((hz + pad) * 2 * PPU);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  return { c, W, H, X: (x) => W / 2 + x * PPU, Y: (z) => H / 2 + z * PPU, h: new Float32Array(W * H), hx, hz, pad };
}

/* Cuts into the height field. */
// A pecked dent: a bowl `r` across at (x, z), `depth` deep.
function dent(s, x, z, r, depth) {
  const cx = s.X(x), cy = s.Y(z), R = r * PPU;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(s.W - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(s.H - 1, Math.ceil(cy + R));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const d = Math.hypot(px - cx, py - cy) / R;
    if (d < 1) { const i = py * s.W + px, v = -depth * Math.pow(1 - d * d, 1.4); if (v < s.h[i]) s.h[i] = v; }
  }
}
// A groove along a path of points, `w` its half-width, pecked: a run of
// dents along it, each its own size and depth.
function peckAlong(s, pts, w, depth, R, step = 0.55) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / (w * step)));
    for (let t = 0; t < n; t++) {
      const f = (t + R() * 0.6) / n;
      dent(s, ax + (bx - ax) * f + (R() - 0.5) * w * 0.5, az + (bz - az) * f + (R() - 0.5) * w * 0.5, w * (0.8 + R() * 0.55), depth * (0.75 + R() * 0.45));
    }
  }
}
// (`R` given: the ring a little out of round, as a hand pecks it.)
const ringPts = (x, z, r, R = null, n = 72) => {
  const p1 = R ? R() * 6.3 : 0, p2 = R ? R() * 6.3 : 0, w1 = R ? 0.02 + R() * 0.03 : 0, w2 = R ? R() * 0.025 : 0;
  const pts = [];
  for (let k = 0; k <= n; k++) { const a = (Math.PI * 2 * k) / n, rr = r * (1 + w1 * Math.sin(2 * a + p1) + w2 * Math.sin(5 * a + p2)); pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]); }
  return pts;
};

/* The normal map of a height field (OpenGL's: green up the texture). */
function normalsOf(s, strength) {
  const c = document.createElement("canvas");
  c.width = s.W; c.height = s.H;
  const g = c.getContext("2d"), img = g.createImageData(s.W, s.H), d = img.data, h = s.h, W = s.W, H = s.H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const dx = (h[y * W + Math.min(W - 1, x + 1)] - h[y * W + Math.max(0, x - 1)]) * 0.5 * strength;
    const dy = (h[Math.min(H - 1, y + 1) * W + x] - h[Math.max(0, y - 1) * W + x]) * 0.5 * strength;
    let nx = -dx, ny = dy, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* A carving's colour: fresh stone where it's cut (paler than the
   weathered face round it), stronger the deeper, its pecks speckled.
   `tint(depth, x, y)` gives [r, g, b] and a strength. */
function paintCut(s, tint, R) {
  const g = s.c.getContext("2d"), img = g.createImageData(s.W, s.H), d = img.data;
  for (let i = 0; i < s.W * s.H; i++) {
    const depth = -s.h[i];
    if (depth <= 0.004) continue;
    const [r, gg, b, k] = tint(depth, i % s.W, (i / s.W) | 0);
    const sp = 0.85 + 0.3 * R();
    d[i * 4] = Math.min(255, r * sp); d[i * 4 + 1] = Math.min(255, gg * sp); d[i * 4 + 2] = Math.min(255, b * sp);
    d[i * 4 + 3] = 255 * clamp01(k * smooth(0.004, 0.09, depth));
  }
  g.putImageData(img, 0, 0);
}

const texOf = (canvas, color = true) => {
  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 4;
  if (!color) t.generateMipmaps = true;
  return t;
};

/* A soft round dot, for embers and dust. */
let DOT = null;
function dotTexture() {
  if (DOT) return DOT;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  DOT = new THREE.CanvasTexture(c);
  return DOT;
}

/* Painted once for each kind, footprint and crush, kept for the page. */
const SHEETS = new Map();
function cached(key, make) {
  if (!SHEETS.has(key)) SHEETS.set(key, make());
  return SHEETS.get(key);
}
const footKey = (hx, hz) => `${Math.round(hx * 100)}x${Math.round(hz * 100)}`;

/* ------------------------------------------------------------- the five */

/* Cup and ring: a cup in each square, rings round it, a channel out of it
   (toward `back`, where the stone comes from) and between the cups of a
   piece that covers more than one. */
function cupringSheet(hx, hz, crush, back) {
  const pad = crush ? 0.12 : 0.04, s = sheet(hx, hz, pad), R = stream(crush ? 0xc0ffee : 0x5eed + Math.round(hx * 10) * 7 + Math.round(hz * 10));
  const { list } = cellsOf(hx, hz);
  const rings = crush ? [0.19, 0.29, 0.39] : [0.18, 0.29];
  for (const c of list) {
    dent(s, c.x, c.z, 0.085, 1.0);
    for (const r of rings) peckAlong(s, ringPts(c.x, c.z, r, R), 0.024, 0.55, R);
  }
  // The channel: out of the cup through its rings, the way the stone comes.
  const a = Math.atan2(back.z, back.x);
  for (const c of list) peckAlong(s, [[c.x + Math.cos(a) * 0.09, c.z + Math.sin(a) * 0.09], [c.x + Math.cos(a) * (rings.at(-1) + 0.06), c.z + Math.sin(a) * (rings.at(-1) + 0.06)]], 0.026, 0.6, R);
  // Cup to cup, along the squares of a long stone.
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const p = list[i], q = list[j];
    if (Math.abs(Math.hypot(p.x - q.x, p.z - q.z) - SQUARE_SIZE) < 0.01) peckAlong(s, [[p.x, p.z], [q.x, q.z]], 0.024, 0.55, R);
  }
  if (crush) {
    // Four cups at its corners, each with a ring, past the Cabeza's edge.
    const ex = hx - 0.11, ez = hz - 0.11;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { dent(s, sx * ex, sz * ez, 0.06, 0.9); peckAlong(s, ringPts(sx * ex, sz * ez, 0.1, R), 0.018, 0.5, R); }
  }
  // Fresh stone in the cuts; a crush's glowing.
  paintCut(s, (depth) => (crush ? [255, 150 + 50 * clamp01(1 - depth), 80, 1] : [206 + 14 * clamp01(depth), 190 + 12 * clamp01(depth), 158, 0.9]), R);
  return { color: s.c, normal: normalsOf(s, 8), w: s.W / PPU, d: s.H / PPU };
}

/* A hand's outline: palm, four fingers, a thumb; `len` wrist to
   fingertip, pointing up the canvas (-y) from (cx, cy), turned `rot`. */
function handPath(g, cx, cy, len, rot, R) {
  g.save();
  g.translate(cx, cy); g.rotate(rot);
  const u = len / 10;
  g.beginPath();
  // The palm and wrist.
  g.ellipse(0, 1.0 * u, 2.3 * u, 2.6 * u, 0, 0, Math.PI * 2);
  g.rect(-1.5 * u, 2.4 * u, 3 * u, 2.6 * u);
  // Fingers: little, ring, middle, index; then the thumb, out to the side.
  const F = [[-1.75, 3.0, -0.2], [-0.6, 3.9, -0.07], [0.6, 4.2, 0.03], [1.7, 3.7, 0.16]];
  for (const [x, l, a] of F) {
    g.save(); g.translate(x * u, -0.6 * u); g.rotate(a + (R() - 0.5) * 0.08);
    const w = 0.52 * u, L = l * u * (0.95 + R() * 0.1);
    g.moveTo(-w, 0); g.lineTo(-w, -L + w); g.arc(0, -L + w, w, Math.PI, 0); g.lineTo(w, 0); g.closePath();
    g.restore();
  }
  g.save(); g.translate(2.0 * u, 1.6 * u); g.rotate(0.95);
  { const w = 0.6 * u, L = 3.4 * u; g.moveTo(-w, 0); g.lineTo(-w, -L + w); g.arc(0, -L + w, w, Math.PI, 0); g.lineTo(w, 0); g.closePath(); }
  g.restore();
  g.restore();
}
/* Pigment sprayed round (x, z), `r` across: a cloud thinning out, its
   specks; `rgb` its colour, `k` how thick. */
function spray(s, g, x, z, r, rgb, k, R) {
  const cx = s.X(x), cy = s.Y(z), Rp = r * PPU;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Rp);
  gr.addColorStop(0, `rgba(${rgb},${0.85 * k})`); gr.addColorStop(0.55, `rgba(${rgb},${0.55 * k})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, cy, Rp, 0, Math.PI * 2); g.fill();
  for (let n = 0; n < 2600 * r * r * 4; n++) {
    const a = R() * Math.PI * 2, d = Math.pow(R(), 0.7) * Rp * 1.12, sz = 0.6 + R() * 1.6;
    g.fillStyle = `rgba(${rgb},${(0.25 + 0.6 * R()) * k * (1 - d / (Rp * 1.12))})`;
    g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, sz, sz);
  }
}
/* Ochre hands: one in each square, its fingers the way the stone goes. */
function handSheet(hx, hz, crush, ahead) {
  const pad = crush ? 0.3 : 0.12, s = sheet(hx, hz, pad), R = stream(crush ? 0xdeed : 0x0c4e + Math.round(hx * 10) * 5 + Math.round(hz * 10));
  const g = s.c.getContext("2d");
  const { list } = cellsOf(hx, hz);
  const RED = crush ? "150,28,18" : "146,40,22", DEEP = crush ? "112,20,14" : "120,30,18";
  const rot = Math.atan2(ahead.x, -ahead.z);
  if (crush) {
    // Wide round the square, so the red shows past the Cabeza.
    for (const c of list) spray(s, g, c.x, c.z, 0.78, DEEP, 0.8, R);
    // Four hands at its corners, reaching in, each in its own thick cloud.
    const ex = hx - 0.06, ez = hz - 0.06;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) spray(s, g, sx * ex * 0.97, sz * ez * 0.97, 0.27, RED, 1, R);
    g.globalCompositeOperation = "destination-out";
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.save(); g.shadowColor = "rgba(0,0,0,1)"; g.shadowBlur = 3; g.fillStyle = "rgba(0,0,0,0.95)";
      handPath(g, s.X(sx * ex), s.Y(sz * ez), 0.36 * PPU, Math.atan2(-sx, sz) + (R() - 0.5) * 0.2, R);
      g.fill(); g.restore();
    }
    g.globalCompositeOperation = "source-over";
  } else {
    for (const c of list) { spray(s, g, c.x, c.z, 0.5, RED, 1, R); spray(s, g, c.x, c.z, 0.34, DEEP, 0.55, R); }
    g.globalCompositeOperation = "destination-out";
    list.forEach((c, i) => {
      g.save(); g.shadowColor = "rgba(0,0,0,1)"; g.shadowBlur = 2.5; g.fillStyle = "rgba(0,0,0,0.95)";
      handPath(g, s.X(c.x) - ahead.x * 0.04 * PPU, s.Y(c.z) - ahead.z * 0.04 * PPU, 0.78 * PPU * (0.96 + 0.05 * (i % 2)), rot + (R() - 0.5) * 0.25, R);
      g.fill(); g.restore();
    });
    g.globalCompositeOperation = "source-over";
  }
  return { color: s.c, normal: null, w: s.W / PPU, d: s.H / PPU };
}

/* Firelight: a warm pool over the footprint, its edge uneven. */
function fireSheet(hx, hz, crush) {
  const pad = crush ? 0.42 : 0.2, s = sheet(hx, hz, pad), R = stream(crush ? 0xf12e : 0xf1e + Math.round(hx * 10));
  const g = s.c.getContext("2d"), img = g.createImageData(s.W, s.H), d = img.data;
  const lobes = Array.from({ length: 7 }, () => ({ a: R() * Math.PI * 2, k: 1 + Math.floor(R() * 4), f: 0.05 + R() * 0.08 }));
  const reach = crush ? 0.44 : 0.15;
  for (let py = 0; py < s.H; py++) for (let px = 0; px < s.W; px++) {
    const x = (px - s.W / 2) / PPU, z = (py - s.H / 2) / PPU;
    // Distance outside the footprint (rounded), wobbled.
    const qx = Math.max(0, Math.abs(x) - (hx - CELL / 2) - CELL * 0.1), qz = Math.max(0, Math.abs(z) - (hz - CELL / 2) - CELL * 0.1);
    const ang = Math.atan2(z, x);
    let wob = 0; for (const l of lobes) wob += Math.sin(ang * l.k + l.a) * l.f;
    const e = Math.hypot(qx, qz) / (CELL * 0.4 + reach) - wob * 0.6;
    const v = Math.pow(clamp01(1 - e), 1.6) * edgeFade(s, px, py);
    if (v <= 0) continue;
    const i = (py * s.W + px) * 4;
    // White-gold at the heart, orange, then red at its edge.
    const t = clamp01(v * 1.1);
    d[i] = 255; d[i + 1] = crush ? 60 + 110 * t * t : 88 + 92 * t * t; d[i + 2] = crush ? 18 + 36 * t * t * t : 22 + 50 * t * t * t;
    d[i + 3] = 255 * v * (crush ? 0.7 : 0.48);
  }
  g.putImageData(img, 0, 0);
  // A crush: the rock's cracks glowing in the corners.
  if (crush) {
    g.lineCap = "round";
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) {
        let x = sx * (hx * 0.62), z = sz * (hz * 0.62), a = Math.atan2(sz, sx) + (R() - 0.5) * 1.1;
        g.beginPath(); g.moveTo(s.X(x), s.Y(z));
        for (let t = 0; t < 9; t++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * 0.035; z += Math.sin(a) * 0.035; g.lineTo(s.X(x), s.Y(z)); }
        g.strokeStyle = "rgba(255,170,90,0.95)"; g.lineWidth = 2.6 - k * 0.5; g.stroke();
      }
    }
  }
  return { color: s.c, normal: null, w: s.W / PPU, d: s.H / PPU };
}

/* Light through the stones: the lit floor (a soft square of pale light
   on the footprint) and the shaft's own fall-off, bright at the floor. */
function beamFloorSheet(hx, hz, crush) {
  const pad = crush ? 0.36 : 0.16, s = sheet(hx, hz, pad);
  const g = s.c.getContext("2d"), img = g.createImageData(s.W, s.H), d = img.data;
  const col = crush ? [255, 120, 70] : [205, 222, 255];
  for (let py = 0; py < s.H; py++) for (let px = 0; px < s.W; px++) {
    const x = (px - s.W / 2) / PPU, z = (py - s.H / 2) / PPU;
    const ox = Math.max(0, Math.abs(x) - hx * 0.86), oz = Math.max(0, Math.abs(z) - hz * 0.86);
    const out = Math.hypot(ox, oz), rim = 0.8 + 0.2 * (1 - 0.86);
    const v = (out <= 0 ? 0.8 + 0.2 * (1 - Math.max(Math.abs(x) / hx, Math.abs(z) / hz)) : rim * Math.pow(clamp01(1 - out / pad), 2.2)) * edgeFade(s, px, py) * (0.55 + 0.45 * Math.exp(-((x * x) / (hx * hx) + (z * z) / (hz * hz)) * 1.6));
    if (v <= 0.002) continue;
    const i = (py * s.W + px) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255 * v * (crush ? 0.62 : 0.5);
  }
  g.putImageData(img, 0, 0);
  return { color: s.c, normal: null, w: s.W / PPU, d: s.H / PPU };
}
let SHAFT = null;
function shaftTexture() {
  if (SHAFT) return SHAFT;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const g = c.getContext("2d"), img = g.createImageData(64, 256), d = img.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const up = 1 - y / 255; // 1 at the top of the canvas, the shaft's top
    const across = 1 - Math.pow(Math.abs(x / 63 - 0.5) * 2, 4);
    const v = Math.pow(1 - up, 1.6) * across;
    const i = (y * 64 + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255 * v;
  }
  g.putImageData(img, 0, 0);
  SHAFT = new THREE.CanvasTexture(c);
  // (Once round each of the column's four faces.)
  SHAFT.wrapS = THREE.RepeatWrapping;
  SHAFT.repeat.set(4, 1);
  return SHAFT;
}

/* The dressed margin: a band round the footprint's edge, chiselled down a
   little, the strokes across it; a crush, a cross cut deep corner to
   corner too. */
function marginSheet(hx, hz, crush) {
  const pad = 0.03, s = sheet(hx, hz, pad), R = stream(crush ? 0x3a26 : 0x3a2 + Math.round(hx * 10) * 3 + Math.round(hz * 10));
  const band = crush ? 0.1 : 0.085, inX = hx - 0.012, inZ = hz - 0.012;
  const strokes = new Float32Array(4096); for (let k = 0; k < strokes.length; k++) strokes[k] = R();
  // (Its width uneven along the edge, spalls broken out of its inner edge
  // and chips off its outer: cut by hand.)
  const ph = Array.from({ length: 6 }, () => R() * 6.3);
  const spalls = Array.from({ length: 10 }, () => ({ at: R() * 4 - 2, w: 0.02 + R() * 0.05, d: 0.012 + R() * 0.03 }));
  const chips = Array.from({ length: 14 }, () => ({ at: R() * 4 - 2, w: 0.008 + R() * 0.02, d: 0.004 + R() * 0.012 }));
  const bump = (list, along) => { let m = 0; for (const q of list) { const t = 1 - Math.abs(along - q.at) / q.w; if (t > 0) m = Math.max(m, q.d * Math.sqrt(t)); } return m; };
  for (let py = 0; py < s.H; py++) for (let px = 0; px < s.W; px++) {
    const x = (px - s.W / 2) / PPU, z = (py - s.H / 2) / PPU;
    const dx = inX - Math.abs(x), dz = inZ - Math.abs(z);
    if (dx < 0 || dz < 0) continue;
    const e = Math.min(dx, dz);
    // (Which side: its own stretch of the wobble and the spalls.)
    const side = dx < dz ? (x > 0 ? 0 : 1) : (z > 0 ? 2 : 3), along = dx < dz ? z : x, at = along + side * 0.37;
    const bw = band * (0.86 + 0.1 * Math.sin(at * 7 + ph[side]) + 0.06 * Math.sin(at * 17 + ph[side + 2])) + bump(spalls, at);
    if (e > bw) continue;
    if (e < bump(chips, at)) continue;
    // Recessed, a crisp step at its inner edge, rounded off at the outer;
    // the chisel's strokes run across the band (along its width).
    const idx = Math.floor((along + 3) * 130) & 4095;
    const stroke = 0.6 + 0.4 * Math.sin(along * 380 + strokes[idx] * 6) * (0.5 + 0.5 * strokes[(idx + 7) & 4095]);
    const step = smooth(bw - 0.01, bw, e), lip = smooth(0, 0.012, e);
    s.h[py * s.W + px] = Math.min(s.h[py * s.W + px], -(0.32 + 0.1 * stroke) * (1 - step) * lip);
  }
  if (crush) {
    // The cross: two grooves corner to corner, deep, their edges chipped.
    for (const [sx] of [[1], [-1]]) {
      const pts = [];
      for (let k = 0; k <= 24; k++) { const f = k / 24 * 2 - 1; pts.push([f * (hx - 0.05) * sx + (R() - 0.5) * 0.006, f * (hz - 0.05) + (R() - 0.5) * 0.006]); }
      peckAlong(s, pts, 0.028, 1.0, R, 0.4);
    }
  }
  paintCut(s, (depth) => (crush ? [255, 138 + 60 * clamp01(1 - depth), 76, 1] : [204, 189, 160, 0.9]), R);
  return { color: s.c, normal: normalsOf(s, 9), w: s.W / PPU, d: s.H / PPU };
}

/* ------------------------------------------------------------- the marker */

/* The meshes for `kind` over a footprint (`hx`, `hz` its half-sizes, the
   marker's middle at the origin), `dir` the move's way ({ x, z }, a unit
   step on the board), `C` the spec's colours. Gives back { group, mats,
   geos, tick(now) }; a material's userData.k its share of the chassis's
   opacity. */
export function buildMonolithMarker(kind, { hx, hz, isCrush, dir }) {
  const group = new THREE.Group(), mats = [], geos = [];
  const v = { x: dir && (dir.x || dir.z) ? dir.x : 0, z: dir && (dir.x || dir.z) ? dir.z : -1 };
  const l = Math.hypot(v.x, v.z) || 1; v.x /= l; v.z /= l;
  const back = { x: -v.x, z: -v.z };
  const flat = (art, { y = 0.009, lit = true, emissive = false, add = false, k = 1, order = 3 } = {}) => {
    const geo = new THREE.PlaneGeometry(art.w, art.d);
    geos.push(geo);
    const map = art.tex || (art.tex = texOf(art.color));
    const opts = { map, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 };
    let mat;
    if (lit) {
      if (art.normal && !art.ntex) art.ntex = texOf(art.normal, false);
      mat = new THREE.MeshStandardMaterial({ ...opts, roughness: 0.94, metalness: 0, normalMap: art.ntex || null, normalScale: new THREE.Vector2(1, 1) });
      if (emissive) { mat.emissive = new THREE.Color(0xff7a3a); mat.emissiveMap = map; mat.emissiveIntensity = 0.75; }
    } else {
      mat = new THREE.MeshBasicMaterial({ ...opts, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    }
    mat.userData.k = k;
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = order;
    m.receiveShadow = lit;
    group.add(m);
    return m;
  };
  const key = `${kind}:${footKey(hx, hz)}:${isCrush ? 1 : 0}`;
  let tick = () => {};

  if (kind === "cupring") {
    const art = cached(`${key}:${Math.round(Math.atan2(back.z, back.x) * 10)}`, () => cupringSheet(hx, hz, isCrush, back));
    flat(art, { emissive: isCrush });
  } else if (kind === "hand") {
    const art = cached(`${key}:${Math.round(Math.atan2(v.x, v.z) * 10)}`, () => handSheet(hx, hz, isCrush, v));
    flat(art);
  } else if (kind === "fire") {
    const art = cached(key, () => fireSheet(hx, hz, isCrush));
    const pool = flat(art, { lit: false, add: true, y: 0.012 });
    // Embers rising from it.
    const { list } = cellsOf(hx, hz), n = list.length * (isCrush ? 12 : 7), R = stream(0xe3be + n);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seeds = [];
    for (let k = 0; k < n; k++) {
      const c = list[k % list.length];
      seeds.push({ x: c.x + (R() - 0.5) * hx * 0.9 / Math.max(1, cellsOf(hx, hz).nx), z: c.z + (R() - 0.5) * hz * 0.9 / Math.max(1, cellsOf(hx, hz).nz), p: R(), s: 0.16 + R() * 0.2, w: R() * 6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geos.push(geo);
    const pm = new THREE.PointsMaterial({ size: isCrush ? 0.07 : 0.055, map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true });
    mats.push(pm);
    const pts = new THREE.Points(geo, pm);
    pts.renderOrder = 4;
    group.add(pts);
    const base = isCrush ? [1, 0.42, 0.16] : [1, 0.62, 0.25];
    tick = (now) => {
      const t = now / 1000;
      // The pool flickers: two slow waves and a quick one.
      const f = 0.82 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1) + 0.08 * Math.sin(t * 17.1 + Math.sin(t * 3.7));
      pool.material.userData.flick = f;
      for (let k = 0; k < n; k++) {
        const e = seeds[k], u = (e.p + t * e.s) % 1;
        pos[k * 3] = e.x + Math.sin(t * 1.3 + e.w) * 0.03 * u;
        pos[k * 3 + 1] = 0.02 + u * (isCrush ? 0.75 : 0.55);
        pos[k * 3 + 2] = e.z + Math.cos(t * 1.1 + e.w) * 0.03 * u;
        const a = Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + e.w));
        col[k * 3] = base[0] * a; col[k * 3 + 1] = base[1] * a; col[k * 3 + 2] = base[2] * a;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    };
  } else if (kind === "beam") {
    const art = cached(key, () => beamFloorSheet(hx, hz, isCrush));
    flat(art, { lit: false, add: true, y: 0.012, k: 1 });
    // The shaft: a square column, open at its ends, fading upward.
    const H = isCrush ? 1.7 : 1.35, r = Math.SQRT2 * 0.88;
    const geo = new THREE.CylinderGeometry(r, r, H, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    geo.scale(hx, 1, hz);
    geo.translate(0, H / 2 + 0.01, 0);
    geos.push(geo);
    const mat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: isCrush ? 0xff7a4a : 0xb9cdf5, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    mat.userData.k = isCrush ? 0.8 : 0.62;
    mats.push(mat);
    const shaft = new THREE.Mesh(geo, mat);
    shaft.renderOrder = 4;
    group.add(shaft);
    // Dust turning in it.
    const n = cellsOf(hx, hz).list.length * 9, R = stream(0xd057 + n);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seeds = [];
    for (let k = 0; k < n; k++) seeds.push({ x: (R() - 0.5) * hx * 1.5, z: (R() - 0.5) * hz * 1.5, p: R(), s: 0.03 + R() * 0.05, w: R() * 6 });
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geos.push(dg);
    const dm = new THREE.PointsMaterial({ size: 0.03, map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true });
    mats.push(dm);
    const dust = new THREE.Points(dg, dm);
    dust.renderOrder = 4;
    group.add(dust);
    const base = isCrush ? [1, 0.55, 0.35] : [0.85, 0.9, 1];
    tick = (now) => {
      const t = now / 1000;
      mat.userData.flick = 0.9 + 0.1 * Math.sin(t * 0.9) * Math.sin(t * 1.7 + 2);
      for (let k = 0; k < n; k++) {
        const e = seeds[k], u = (e.p + t * e.s) % 1;
        pos[k * 3] = e.x + Math.sin(t * 0.4 + e.w) * 0.06;
        pos[k * 3 + 1] = 0.05 + (1 - u) * H * 0.85;
        pos[k * 3 + 2] = e.z + Math.cos(t * 0.33 + e.w) * 0.06;
        const a = Math.sin(u * Math.PI) * 0.8;
        col[k * 3] = base[0] * a; col[k * 3 + 1] = base[1] * a; col[k * 3 + 2] = base[2] * a;
      }
      dg.attributes.position.needsUpdate = true;
      dg.attributes.color.needsUpdate = true;
    };
  } else if (kind === "margin") {
    const art = cached(key, () => marginSheet(hx, hz, isCrush));
    flat(art, { emissive: isCrush });
  }
  return { group, mats, geos, tick };
}
