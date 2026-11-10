/* The Monolith's ground near the board: the board a part of it (user:
   "Make the board a seamless part of the ground"; "The game board itself
   must also seem as if it is jagged and natural looking. Right now it
   looks like an actual game board is just placed on the ground, but I want
   it to look more like ... a part of the contour of the earth itself, with
   the symmetry of the lines, albeit extremely crooked and jagged, chiseled
   into the ground itself"; and of the land: "Polygonal stone formations",
   "Jagged ridgelines and fractured plateaus", "Fossilized-looking
   terrain", "Interlocking rock formations", "Sharp, fractured rock
   surfaces").

   - A plateau of fractured rock in polygonal plates (a Voronoi of
     scattered points), each a slab with its edges broken off, a crack
     between it and the next, stepping up a little from the board's floor
     and rising toward the plateau's edge; past it, blocks broken off down
     the slope to the plain. The board's floor is one plate of the same
     rock, level, its edge as irregular as the rest (it takes in every
     plate the board and its set-out bench need), so nothing marks where
     a board would stop.
   - The grid chiseled into that floor: each line a groove wandering and
     jagged, wide and narrow, its edges chipped, a spall broken out here
     and there, a pit where two meet, hairline cracks running off; one
     wall lit and one in shade as the moon's light falls on them (the light
     turns with the land, so the painting always agrees with it); the two
     goal rows worn a shade darker. Painted on a sheet laid over the floor,
     clear everywhere but the grooves.

   Plain functions of the board's size, from fixed seeds: the same ground
   every visit, built again when the board changes size. */
import * as THREE from "three";
import { noise3 } from "./rockforms.js";

/* A seeded stream of numbers in 0..1. */
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
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const n1 = (t, seed) => noise3(t, 0.37, 0.71, seed);

/* ---------------------------------------------------------------- the grid */

/* The grooves, painted: a canvas texture over the grid (and `M` round it),
   its size in units [W, D]. cols x rows squares of `sq`, the grid centred
   on the origin; `detail` the device's (0 coarser). */
export function grooveSheet({ cols, rows, sq, detail = 1, M = 0.32 }) {
  const W = cols * sq + M * 2, D = rows * sq + M * 2;
  const ppu = Math.min(detail === 0 ? 92 : 168, 2048 / Math.max(W, D));
  const cw = Math.round(W * ppu), ch = Math.round(D * ppu);
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  g.lineCap = "round"; g.lineJoin = "round";
  // Land units to the canvas: x across, z down (the sheet's top is the
  // land's -z, Dark's end).
  const X = (x) => (x + W / 2) * ppu, Y = (z) => (z + D / 2) * ppu;
  const ox = (cols * sq) / 2, oz = (rows * sq) / 2;
  const R = stream(0x6b2c5e1);

  // The goal rows, worn a shade darker, their edges as uneven as the rest.
  g.fillStyle = "rgba(16,13,11,0.13)";
  for (const r of [0, rows - 1]) {
    const z0 = -oz + r * sq;
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const x = -ox + (i / 40) * cols * sq; g.lineTo(X(x), Y(z0 + 0.03 * (n1(x * 3.1, 401 + r) - 0.5))); }
    for (let i = 40; i >= 0; i--) { const x = -ox + (i / 40) * cols * sq; g.lineTo(X(x), Y(z0 + sq + 0.03 * (n1(x * 3.1, 431 + r) - 0.5))); }
    g.closePath(); g.fill();
  }

  /* A line's path: from (x0, z0) to (x1, z1), wandering off true (a slow
     wander; on it a jagged run, straight a little way and then off at
     another angle, as a crack goes; now and then a kink), its width
     there. */
  function path(x0, z0, x1, z1, seed, border) {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, px = -uz, pz = ux;
    const n = Math.ceil(len / 0.045), dt = len / n, pts = [];
    let kink = 0, zig = 0, slope = 0, run = 0;
    for (let i = 0; i <= n; i++) {
      const t = i * dt;
      if ((run -= dt) <= 0) {
        run = 0.05 + R() * 0.12; slope = (R() - 0.5) * 1.4;
        if (Math.abs(zig) > 0.03) slope = -Math.sign(zig) * Math.abs(slope); // (back toward true)
      }
      zig = Math.max(-0.05, Math.min(0.05, zig + slope * dt));
      if (R() < 0.06) kink += (R() - 0.5) * 0.05;
      kink *= 0.93;
      const off = 0.08 * (n1(t * 1.25, seed) - 0.5) * 2 + zig + kink;
      const w = (border ? 0.1 : 0.062) * (0.6 + 0.8 * n1(t * 2.2, seed + 23)) * (0.85 + 0.3 * R());
      pts.push({ x: x0 + ux * t + px * off, z: z0 + uz * t + pz * off, w, px, pz });
    }
    return pts;
  }
  const lines = [];
  for (let i = 0; i <= cols; i++) { const x = -ox + i * sq, b = i === 0 || i === cols; lines.push(path(x, -oz - (b ? 0.05 : 0.02), x, oz + (b ? 0.05 : 0.02), 501 + i * 7, b)); }
  for (let j = 0; j <= rows; j++) { const z = -oz + j * sq, b = j === 0 || j === rows; lines.push(path(-ox - (b ? 0.05 : 0.02), z, ox + (b ? 0.05 : 0.02), z, 701 + j * 7, b)); }

  // The light's way across the sheet: the moon's from +x and +z, so a
  // groove's wall on the -x and -z side faces it, the other is in shade.
  const L = [-0.62, -0.78];
  const stroke = (pts, colour, k, shift) => {
    g.strokeStyle = colour;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], s = (a.px * L[0] + a.pz * L[1]) >= 0 ? 1 : -1;
      const sh = shift * s;
      g.lineWidth = Math.max(1, (a.w + b.w) * 0.5 * k * ppu);
      g.beginPath();
      g.moveTo(X(a.x + a.px * a.w * sh), Y(a.z + a.pz * a.w * sh));
      g.lineTo(X(b.x + b.px * b.w * sh), Y(b.z + b.pz * b.w * sh));
      g.stroke();
    }
  };
  // The groove: fresh stone round it where the chisel broke the weathered
  // skin (paler), its shaded wall and floor, its core, the lit wall.
  // (The fresh stone only here and there along it, as the skin broke.)
  for (const pts of lines) {
    for (let i = 0; i < pts.length - 1; i += 6) {
      const a = Math.max(0, n1(pts[i].x * 2.3 + pts[i].z * 1.7, 811) - 0.35) * 0.24;
      if (a > 0.01) stroke(pts.slice(i, i + 7), `rgba(246,238,224,${a.toFixed(3)})`, 2.4, 0.2);
    }
  }
  for (const pts of lines) stroke(pts, "rgba(4,4,6,0.5)", 1.2, -0.16);
  for (const pts of lines) stroke(pts, "rgba(30,27,24,0.78)", 0.9, 0.0);
  for (const pts of lines) stroke(pts, "rgba(8,8,9,0.85)", 0.5, -0.18);
  for (const pts of lines) stroke(pts, "rgba(240,231,214,0.46)", 0.3, 0.4);
  // Its edges chipped: small flakes off either lip, dark in their hollow,
  // a lit rim where the light catches them; now and then a spall.
  for (const pts of lines) {
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      if (R() > 0.55) continue;
      const side = R() < 0.5 ? -1 : 1, big = R() < 0.07;
      const r = (big ? 0.04 + R() * 0.04 : 0.012 + R() * 0.022);
      const cx = p.x + p.px * side * (p.w * 0.5 + r * 0.35), cz = p.z + p.pz * side * (p.w * 0.5 + r * 0.35);
      const k = 4 + Math.floor(R() * 3), a0 = R() * Math.PI * 2;
      g.beginPath();
      for (let v = 0; v < k; v++) { const a = a0 + (v / k) * Math.PI * 2, rr = r * (0.55 + R() * 0.6); g.lineTo(X(cx + Math.cos(a) * rr), Y(cz + Math.sin(a) * rr)); }
      g.closePath();
      g.fillStyle = big ? "rgba(14,12,11,0.62)" : "rgba(14,12,11,0.7)"; g.fill();
      if (big) { g.strokeStyle = "rgba(235,226,210,0.22)"; g.lineWidth = Math.max(1, ppu * 0.008); g.stroke(); }
    }
  }
  // A pit where two meet, worn a little deeper: where the two wandering
  // lines cross, not where a straight grid's would.
  const near = (pts, key, v) => { let best = pts[0]; for (const q of pts) if (Math.abs(q[key] - v) < Math.abs(best[key] - v)) best = q; return best; };
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const x = near(lines[i], "z", -oz + j * sq).x + 0.01 * (R() - 0.5), z = near(lines[cols + 1 + j], "x", -ox + i * sq).z + 0.01 * (R() - 0.5), r = 0.03 + R() * 0.025;
    g.beginPath();
    for (let v = 0; v < 6; v++) { const a = (v / 6) * Math.PI * 2 + R(), rr = r * (0.6 + R() * 0.6); g.lineTo(X(x + Math.cos(a) * rr), Y(z + Math.sin(a) * rr)); }
    g.closePath(); g.fillStyle = "rgba(10,9,8,0.55)"; g.fill();
  }
  // Hairline cracks off the grooves, wandering into the squares.
  g.lineWidth = Math.max(1, ppu * 0.006);
  for (let k = 0, n = Math.round(cols * rows * 0.6); k < n; k++) {
    const pts = lines[Math.floor(R() * lines.length)], p = pts[Math.floor(R() * pts.length)];
    let x = p.x, z = p.z, a = Math.atan2(p.pz, p.px) + (R() < 0.5 ? 0 : Math.PI) + (R() - 0.5) * 1.2;
    const len = 0.08 + R() * 0.3;
    g.strokeStyle = `rgba(10,9,8,${(0.25 + R() * 0.25).toFixed(3)})`;
    g.beginPath(); g.moveTo(X(x), Y(z));
    for (let t = 0; t < len; t += 0.025) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 0.025; z += Math.sin(a) * 0.025; g.lineTo(X(x), Y(z)); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return { tex, W, D };
}

/* ---------------------------------------------------------------- plates */

// A convex polygon (points [x, z], each edge i from p[i] to p[i+1] tagged
// with the cell across it) clipped to the side of the line through m
// away from d, edges along the cut tagged `tag`.
function clipPoly(poly, tags, d, m, tag) {
  const out = [], outTags = [];
  const f = (p) => (p[0] - m[0]) * d[0] + (p[1] - m[1]) * d[1];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], fa = f(a), fb = f(b), t = tags[i];
    const cross = () => { const k = fa / (fa - fb); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
    if (fa <= 0 && fb <= 0) { out.push(a); outTags.push(t); }
    else if (fa <= 0 && fb > 0) { out.push(a); outTags.push(t); out.push(cross()); outTags.push(tag); }
    else if (fa > 0 && fb <= 0) { out.push(cross()); outTags.push(t); }
  }
  return { poly: out, tags: outTags };
}
// A convex polygon taken in by `by` along the edges that `which` picks.
function insetPoly(poly, tags, by, which = () => true) {
  let p = poly, t = tags;
  for (let i = 0; i < poly.length; i++) {
    if (!which(tags[i])) continue;
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    // (Outward normal of a counter-clockwise polygon in x, z.)
    const nx = ez / l, nz = -ex / l;
    const r = clipPoly(p, t, [nx, nz], [a[0] - nx * by, a[1] - nz * by], tags[i]);
    p = r.poly; t = r.tags;
    if (p.length < 3) break;
  }
  return { poly: p, tags: t };
}
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const centroid = (p) => { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; };
// Does a convex polygon meet the rectangle |x| <= rx, |z| <= rz?
function meetsRect(p, rx, rz) {
  const axes = [[1, 0], [0, 1]];
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; axes.push([b[1] - a[1], a[0] - b[0]]); }
  const rect = [[-rx, -rz], [rx, -rz], [rx, rz], [-rx, rz]];
  for (const [ax, az] of axes) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of p) { const v = q[0] * ax + q[1] * az; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
    for (const q of rect) { const v = q[0] * ax + q[1] * az; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/* The plates: Voronoi cells of points scattered over the land round the
   board (|x|, |z| up to `E`), sorted into the floor (every cell the
   rectangle rx by rz meets: the board and its bench), the plateau (out to
   `edgeAt(x, z)` from that rectangle) and the broken slope beyond (`slope`
   wide, the plates sitting on `groundAt`). Returns one geometry (position,
   color, a blank uv), the floor's cells, and a height lookup for things set
   on the plates. */
export function plateField({ rx, rz, edgeAt, groundAt, colourAt, detail = 1, E = 40, slope = 7 }) {
  const R = stream(0x2b9d71c3);
  const s = detail === 0 ? 2.8 : 2.15;
  const seeds = [];
  // (Some points dropped away from the board, so the plates come in every
  // size: where one's gone, its neighbours take its ground.)
  for (let gx = -E; gx <= E; gx += s) for (let gz = -E; gz <= E; gz += s) {
    const x = gx + (R() - 0.5) * s * 0.95, z = gz + (R() - 0.5) * s * 0.95;
    const away = Math.hypot(Math.max(Math.abs(x) - rx, 0), Math.max(Math.abs(z) - rz, 0));
    if (away > 3 && R() < 0.3) continue;
    seeds.push([x, z]);
  }
  // (A hash of the seeds for their neighbours.)
  const cellOf = new Map(), key = (x, z) => `${Math.floor(x / s)},${Math.floor(z / s)}`;
  seeds.forEach((p, i) => { const k = key(p[0], p[1]); if (!cellOf.has(k)) cellOf.set(k, []); cellOf.get(k).push(i); });
  const near = (p) => {
    const out = [], cx = Math.floor(p[0] / s), cz = Math.floor(p[1] / s);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const l = cellOf.get(`${cx + a},${cz + b}`); if (l) out.push(...l); }
    return out;
  };
  const outFromRect = (x, z) => Math.hypot(Math.max(Math.abs(x) - rx, 0), Math.max(Math.abs(z) - rz, 0));
  const cells = seeds.map((p, i) => {
    const L = s * 2.2;
    let r = { poly: [[p[0] - L, p[1] - L], [p[0] + L, p[1] - L], [p[0] + L, p[1] + L], [p[0] - L, p[1] + L]], tags: [-1, -1, -1, -1] };
    for (const j of near(p)) {
      if (j === i) continue;
      const q = seeds[j], d = [q[0] - p[0], q[1] - p[1]];
      if (d[0] * d[0] + d[1] * d[1] > L * L * 4) continue;
      r = clipPoly(r.poly, r.tags, d, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], j);
      if (r.poly.length < 3) break;
    }
    return { i, seed: p, poly: r.poly, tags: r.tags };
  });
  const kind = new Array(seeds.length).fill("none");
  for (const c of cells) {
    if (c.poly.length < 3) continue;
    const [cx, cz] = centroid(c.poly), d = outFromRect(cx, cz), edge = edgeAt(cx, cz);
    if (meetsRect(c.poly, rx, rz)) kind[c.i] = "floor";
    else if (d < edge) kind[c.i] = "plateau";
    else if (d < edge + slope && Math.hypot(cx, cz) < E - s * 1.5) kind[c.i] = "slope";
  }
  const pos = [], col = [], tops = new Map();
  const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c[0], c[1], c[2]); };
  const tri = (a, b, c, k) => { push(a[0], a[1], a[2], k); push(b[0], b[1], b[2], k); push(c[0], c[1], c[2], k); };
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  for (const c of cells) {
    const K = kind[c.i];
    if (K === "none" || c.poly.length < 3) continue;
    // (Counter-clockwise, as x and z run.)
    let poly = c.poly, tags = c.tags;
    if (area(poly) < 0) { poly = poly.slice().reverse(); tags = tags.slice(0, -1).reverse().concat(tags.slice(-1)); }
    const [cx, cz] = centroid(poly), d = outFromRect(cx, cz), edge = edgeAt(cx, cz);
    const r = stream(0x9e3779b9 ^ (c.i * 2654435761));
    if (K === "floor") {
      // The board's floor: level at 0, one with the floor cells beside it
      // (no crack between), a crack and a wall where a plate begins.
      const inset = insetPoly(poly, tags, 0.035, (t) => t < 0 || kind[t] !== "floor");
      const p = inset.poly;
      if (p.length < 3) continue;
      for (let i = 1; i < p.length - 1; i++) {
        const k = (q) => colourAt(q[0], 0, q[1], 0);
        const a = [p[0][0], 0, p[0][1]], b = [p[i][0], 0, p[i][1]], e = [p[i + 1][0], 0, p[i + 1][1]];
        push(a[0], 0, a[2], k(p[0])); push(e[0], 0, e[2], k(p[i + 1])); push(b[0], 0, b[2], k(p[i]));
      }
      for (let i = 0; i < p.length; i++) {
        const t = inset.tags[i];
        if (!(t < 0 || kind[t] !== "floor")) continue;
        const a = p[i], b = p[(i + 1) % p.length], kc = shade(colourAt(a[0], 0, a[1], 0), 0.62);
        tri([a[0], 0, a[1]], [a[0], -0.9, a[1]], [b[0], -0.9, b[1]], kc);
        tri([a[0], 0, a[1]], [b[0], -0.9, b[1]], [b[0], 0, b[1]], kc);
      }
      tops.set(c.i, { h: 0, tx: 0, tz: 0, cx, cz, floor: true });
      continue;
    }
    // A plate: its top, tilted a little (more down the slope), its rim
    // broken off unevenly, its walls down into the crack. Now and then one
    // is gone (a pit to the crack's floor), one split in two, one stood
    // up higher than the rest, a block.
    if (K === "plateau" && d > 4 && r() < 0.05) continue;
    let h, tx, tz;
    if (K === "plateau") {
      h = 0.03 + 0.1 * ease(d / 2.5) + 0.4 * ease((d - 1) / 9) * (0.3 + 0.7 * r()) + (r() - 0.35) * 0.1 * ease(d / 3);
      if (d > 3 && r() < 0.08) h += 0.15 + r() * 0.2;
      h = Math.max(0.02, Math.min(h, 0.7));
      const tilt = d > 2 && r() < 0.25 ? 0.16 : 0.05;
      tx = (r() - 0.5) * tilt; tz = (r() - 0.5) * tilt;
    } else {
      h = groundAt(cx, cz) + 0.12 + r() * 0.45;
      const away = Math.atan2(cz, cx);
      tx = Math.cos(away) * -(0.06 + r() * 0.18) + (r() - 0.5) * 0.08; tz = Math.sin(away) * -(0.06 + r() * 0.18) + (r() - 0.5) * 0.08;
    }
    const gap = 0.03 + Math.min(0.09, d * 0.004) + r() * 0.025;
    const whole = insetPoly(poly, tags, gap).poly;
    if (whole.length < 3) continue;
    // (Split: the two halves along a line through it, a crack between,
    // each its own height.)
    const parts = [];
    if (d > 1.5 && r() < 0.28 && Math.abs(area(whole)) > 1.2) {
      const a = r() * Math.PI, dir = [Math.cos(a), Math.sin(a)], m = centroid(whole), w = gap * 0.8;
      const one = clipPoly(whole, whole.map(() => -1), dir, [m[0] - dir[0] * w, m[1] - dir[1] * w], -1).poly;
      const two = clipPoly(whole, whole.map(() => -1), [-dir[0], -dir[1]], [m[0] + dir[0] * w, m[1] + dir[1] * w], -1).poly;
      if (one.length >= 3) parts.push([one, 0]);
      if (two.length >= 3) parts.push([two, (r() - 0.4) * 0.14]);
    } else parts.push([whole, 0]);
    for (const [outer, dh] of parts) {
      const hp = Math.max(0.02, h + dh);
      const bevel = 0.05 + r() * 0.08, drop = 0.025 + r() * 0.05;
      const inner = insetPoly(outer, outer.map(() => -1), bevel).poly;
      const yAt = (q, dy = 0) => hp + tx * (q[0] - cx) + tz * (q[1] - cz) + dy;
      const rim = outer.map((q) => [q[0], yAt(q, -drop + (r() - 0.5) * 0.03), q[1]]);
      const top = (inner.length >= 3 ? inner : outer).map((q) => [q[0], yAt(q, (r() - 0.5) * 0.012), q[1]]);
      const base = Math.min(...rim.map((q) => q[1])) - 0.9 - (K === "slope" ? 0.6 : 0);
      const kTop = colourAt(cx, hp, cz, d), kc = shade(kTop, 0.84 + r() * 0.3);
      for (let i = 1; i < top.length - 1; i++) tri(top[0], top[i + 1], top[i], kc);
      if (inner.length >= 3) {
        // The rim broken off round it: a band from the outline down to it.
        // (The inset has the outline's corners, maybe begun at another: a
        // strip of quads when they match, else each edge to the nearest.)
        const kr = shade(kc, 1.08);
        if (top.length === rim.length) {
          let off = 0, bd = Infinity;
          for (let k = 0; k < top.length; k++) {
            let dd = 0;
            for (let i = 0; i < rim.length; i++) { const q = top[(i + k) % top.length]; dd += (q[0] - rim[i][0]) ** 2 + (q[2] - rim[i][2]) ** 2; }
            if (dd < bd) { bd = dd; off = k; }
          }
          for (let i = 0; i < rim.length; i++) {
            const a0 = rim[i], b0 = rim[(i + 1) % rim.length], ta = top[(i + off) % top.length], tb = top[(i + 1 + off) % top.length];
            tri(a0, tb, b0, kr); tri(a0, ta, tb, kr);
          }
        } else {
          for (let i = 0; i < rim.length; i++) {
            const a0 = rim[i], b0 = rim[(i + 1) % rim.length], m = [(a0[0] + b0[0]) / 2, (a0[2] + b0[2]) / 2];
            let best = 0, bd = Infinity;
            top.forEach((q, j) => { const dd = (q[0] - m[0]) ** 2 + (q[2] - m[1]) ** 2; if (dd < bd) { bd = dd; best = j; } });
            tri(a0, top[best], b0, kr);
          }
        }
      }
      const kw = shade(kc, 0.6);
      for (let i = 0; i < rim.length; i++) {
        const a0 = rim[i], b0 = rim[(i + 1) % rim.length];
        tri(a0, [a0[0], base, a0[2]], [b0[0], base, b0[2]], kw);
        tri(a0, [b0[0], base, b0[2]], b0, kw);
      }
      const t = tops.get(c.i) || { cx, cz, floor: false, parts: [] };
      t.parts.push({ h: hp, tx, tz, poly: outer });
      tops.set(c.i, t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.computeVertexNormals();
  // What's under (x, z): the plate there and its top's height (null in a
  // crack, off the plates, or on the floor when `floor` is false).
  const inside = (q, x, z) => { for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; } return true; };
  const plateAt = (x, z) => {
    let best = -1, bd = Infinity;
    for (const j of near([x, z])) { const q = seeds[j], dd = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (dd < bd) { bd = dd; best = j; } }
    const t = tops.get(best);
    if (!t) return null;
    if (t.floor) return { h: 0, floor: true };
    const p = t.parts.find((q) => inside(q.poly, x, z));
    if (!p) return null;
    return { h: p.h + p.tx * (x - t.cx) + p.tz * (z - t.cz), floor: false };
  };
  const floorCells = cells.filter((c) => kind[c.i] === "floor").map((c) => c.poly);
  return { geo, floorCells, plateAt, count: tops.size };
}
