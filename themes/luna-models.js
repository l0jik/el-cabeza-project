/* Luna's buildings: every piece a building of the moon base, at its exact
   game size (user, after the rounds of mock-ups: "Let's go ahead and
   deploy this now into Theme Switcher. I think it's ready").

   Ported from the mock-ups' renderer (the all-squircle base the user
   signed off): one roundover for every piece built of cubes (squircle
   corners on straight walls, a rounded top edge), one storey of rounded
   ports a level with an accent stripe, the windows lit a whole floor or a
   corner run at a time, now and then a face at a lit window; the light
   side white with orange, the dark side charcoal with gold. Nothing is
   cylindrical: odd pieces' columns, standing pieces, the Cabeza and its
   glass dome are squircles in plan. The roof's gear (plant box, skylight,
   mast and dish; the Turrito's hatch) only where nothing stands over the
   piece (luna-fx.js hides it under an overhang).

   The Cabeza is a habitat dome on a base in its side's colours, a kitchen
   garden inside it: planter beds round a fruit tree, someone walking in,
   someone kneeling at a bed, someone picking, a basket. The people are
   one smooth body each (distance fields of tapered capsules, meshed with
   surface nets), skin tones across the human range.

   Each building is made once per piece and pose and kept (the chassis
   rebuilds a piece's mesh on every move but disposes only the mesh's and
   shell's own geometry and material; these are children). */

import * as THREE from "three";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";
import { makeRoundedBox } from "../engine/geometry.js";

export const PS = PIECE_SCALE;
export const CAB_D = DISC_DIAM * CABEZA_SCALE;
export const CAB_H = DISC_H * CABEZA_SCALE;

/* ------------------------------------------------------------ palette */

export const PAL = {
  light: { wall: "#eceef0", glass: "#1a2a3a", accent: "#ff7a1a", roof: "#e2e4e6" },
  dark: { wall: "#2c3038", glass: "#0e1620", accent: "#e0b030", roof: "#24272e" },
};
// The scene's settings (the mock-ups' preset): how much of the base is lit,
// how bright the windows, how often a face at one.
const LIT = 0.55, WINDOW_GLOW = 1.3, FACES = 0.14;
const LIT_WARM = ["#ffd9a0", "#ffcf88", "#ffe6c0", "#ffc070"];

/* ------------------------------------------------------------ small tools */

let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];
// Colours as given: the page renders in sRGB (luna-fx.js), as the mock-ups did.
export const col = (c) => new THREE.Color(c);
export function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
export function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
export const shade = (hex, k) => { const c = col(hex); c.multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return "#" + c.getHexString(); };
// A hash of its own for the windows and the people, so they don't depend on the order things are built in.
export const folkHash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// Materials of plain colour, shared.
const MATS = new Map();
export function std(c, o = {}) {
  const key = c + JSON.stringify(o);
  let m = MATS.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.8, metalness: 0.05, ...o }); MATS.set(key, m); }
  return m;
}
export function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function boxM(w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }

// A soft glow, for lamps.
let GLOW_T = null;
export function glowSprite(color, size, opacity = 0.8) {
  if (!GLOW_T) { const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); GLOW_T = tex(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_T, color: col(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); s.castShadow = false; return s;
}

function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

/* ------------------------------------------------------------ facades */

/* Which windows are lit (user: "it can't be every other light ... maybe
   an entire floor might be on, or an entire floor's lights might be off,
   or one corner of a building's lights are on, and then the rest are
   off"): each floor all on or all dark, or one run of bays lit round a
   corner; now and then the same corner lit all the way up. Each floor's
   light one colour. */
let LIT_K = 0, FOLK_K = 0;
function litPlan(bays, floors) {
  const k = ++LIT_K, h = (n) => folkHash(k * 7919 + n), plan = [], cols = [];
  const run = (n) => { const len = Math.max(2, Math.round(bays * (0.18 + 0.32 * h(n)))), at = Math.floor(h(n + 1) * bays); return (b) => (b - at + bays) % bays < len; };
  const corner = h(1) < 0.25 ? run(3) : null;
  for (let f = 0; f < floors; f++) {
    cols.push(LIT_WARM[Math.floor(h(200 + f) * LIT_WARM.length)]);
    const r = h(10 + f);
    if (corner) plan.push(corner);
    else if (r < LIT * 0.55) plan.push(() => true);
    else if (r < LIT * 0.55 + (1 - LIT) * 0.6) plan.push(() => false);
    else plan.push(run(30 + f * 2));
  }
  return { on: (f, b) => plan[f](b), color: (f) => cols[f] };
}
// A face at a lit window: head and shoulders dark against the light, soft as through glass.
function windowFace(x, e, X0, Y0, w, h) {
  const v = (k) => folkHash(FOLK_K * 13 + k), mx = X0 + w * (0.22 + 0.56 * v(1)), by = Y0 + h, s2 = 0.8 + 0.45 * v(2), hr = h * 0.15 * s2, sw = w * 0.2 * s2, lean = (v(3) - 0.5) * hr * 0.8;
  for (const [c, fill] of [[x, "rgba(12,15,20,0.95)"], [e, "rgba(14,10,6,0.88)"]]) {
    c.save(); roundRect(c, X0, Y0, w, h, 6); c.clip(); c.filter = "blur(0.7px)"; c.fillStyle = fill;
    c.beginPath(); c.ellipse(mx, by + h * 0.08, sw, h * 0.36 * s2, 0, Math.PI, 0); c.fill();
    c.fillRect(mx - hr * 0.42 + lean * 0.3, by - h * 0.36 * s2, hr * 0.84, h * 0.12);
    c.beginPath(); c.ellipse(mx + lean, by - h * 0.36 * s2 - hr * 0.95, hr * 0.86, hr * 1.05, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}
/* One storey of windows a game level (the Turrito "seems too tall" with
   three): a band of rounded ports a storey, the accent stripe under it. */
function facadeMoon(x, e, bays, floors, cw, ch, pal) {
  x.fillStyle = pal.wall; x.fillRect(0, 0, bays * cw, floors * ch);
  const L = litPlan(bays, floors);
  for (let f = 0; f < floors; f++) {
    x.strokeStyle = shade(pal.wall, 0.88); x.lineWidth = 1;
    for (let b = 0; b < bays; b++) x.strokeRect(b * cw + 0.5, f * ch + 0.5, cw - 1, ch - 1);
    x.fillStyle = pal.accent; x.fillRect(0, f * ch + ch * 0.72, bays * cw, ch * 0.03);
    for (let b = 0; b < bays; b++) {
      if ((b * 7 + f * 3) % 6 === 5) continue;
      const X0 = b * cw + cw * 0.15, Y0 = f * ch + ch * 0.38, w = cw * 0.7, h = ch * 0.2;
      x.fillStyle = shade(pal.wall, 0.62); roundRect(x, X0 - 2, Y0 - 2, w + 4, h + 4, 7); x.fill();
      x.fillStyle = pal.glass; roundRect(x, X0, Y0, w, h, 6); x.fill();
      if (e && L.on(f, b)) { e.fillStyle = L.color(f); roundRect(e, X0, Y0, w, h, 6); e.fill(); if (folkHash(++FOLK_K) < FACES) windowFace(x, e, X0, Y0, w, h); }
    }
  }
}
const BAY = PS / 3, FLOOR = PS;
function facadeMat(fw, fh, pal) {
  const bays = Math.max(1, Math.round(fw / BAY)), floors = Math.max(1, Math.round(fh / FLOOR)), cw = 40, ch = 120;
  const c = cv(bays * cw, floors * ch), x = c.getContext("2d"), e = cv(bays * cw, floors * ch), ex = e.getContext("2d");
  ex.fillStyle = "#000"; ex.fillRect(0, 0, e.width, e.height);
  facadeMoon(x, ex, bays, floors, cw, ch, pal);
  return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.9, metalness: 0.05, emissive: col("#ffffff"), emissiveMap: tex(e), emissiveIntensity: WINDOW_GLOW });
}

/* ------------------------------------------------------------ plans and bodies */

const PLAN = {
  // straight sides, each corner a quarter of a squircle of radius rc
  sqrect: (hx, hz, rc, n) => (x, z) => { const ax = Math.abs(x), az = Math.abs(z); if (ax > hx + 1e-9 || az > hz + 1e-9) return false; const dx = Math.max(ax - (hx - rc), 0) / rc, dz = Math.max(az - (hz - rc), 0) / rc; return dx ** n + dz ** n <= 1 + 1e-9; },
  squircle: (hx, hz, n) => (x, z) => Math.abs(x / hx) ** n + Math.abs(z / hz) ** n <= 1,
};
// The plan's outline, found along rays from the middle (the plans are all star-shaped about it).
function planOutline(inside, M) {
  const pts = [];
  for (let j = 0; j < M; j++) {
    const a = (j / M) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
    let t = 0; while (t < 2 && inside(t * ux, t * uz)) t += 0.01;
    let lo = Math.max(0, t - 0.01), hi = t;
    for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (inside(m * ux, m * uz)) lo = m; else hi = m; }
    pts.push([lo * ux, lo * uz]);
  }
  return pts;
}
function outlineNormals(pts) {
  const n = pts.length;
  return pts.map((p, i) => { const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n]; let x = b[1] - a[1], z = -(b[0] - a[0]); const l = Math.hypot(x, z) || 1; x /= l; z /= l; if (x * p[0] + z * p[1] < 0) { x = -x; z = -z; } return [x, z]; });
}
const insetPts = (pts, nrm, d) => pts.map((p, j) => [p[0] - nrm[j][0] * d, p[1] - nrm[j][1] * d]);
const perimeter = (pts) => pts.reduce((s, p, j) => s + Math.hypot(p[0] - pts[(j + 1) % pts.length][0], p[1] - pts[(j + 1) % pts.length][1]), 0);
// Rings of an outline joined into one surface; u runs round by length, v up the rings.
export function loft(rings) {
  const M = rings[0].pts.length, pos = [], uv = [], idx = [], base = rings[0].pts, len = [0];
  for (let j = 1; j <= M; j++) len.push(len[j - 1] + Math.hypot(base[j % M][0] - base[j - 1][0], base[j % M][1] - base[j - 1][1]));
  rings.forEach((rg, i) => { for (let j = 0; j <= M; j++) { const p = rg.pts[j % M]; pos.push(p[0], rg.y, p[1]); uv.push(len[j] / len[M], i / Math.max(1, rings.length - 1)); } });
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; // one normal for the seam's two copies of a point
  for (let i = 0; i < rings.length; i++) { const a = i * (M + 1), b = a + M, x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
  return g;
}
export function capGeo(pts) { const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); g.rotateX(-Math.PI / 2); return g; }
const area = (pts) => Math.abs(pts.reduce((s, p, j) => s + p[0] * pts[(j + 1) % pts.length][1] - pts[(j + 1) % pts.length][0] * p[1], 0)) / 2;

/* One body from a plan: walls with the facade wrapped round, a top that
   rounds in (o.edge: how far in and how far up), a flat roof; the accent
   at the foot, a metal ring at each storey line, the accent under the top. */
function planBody(inside, Y, pal, side, o = {}) {
  const g = new THREE.Group(), M = o.M || 144, pts = planOutline(inside, M), nrm = outlineNormals(pts);
  const [eh, ev] = o.edge || [0, 0], wallH = Y - ev;
  const skin = std(pal.wall, { roughness: 0.5, metalness: 0.1 });
  g.add(mesh(loft([{ pts, y: 0 }, { pts, y: wallH }]), facadeMat(perimeter(pts), wallH, pal)));
  if (o.bottom) { const bc = capGeo(pts); bc.rotateX(Math.PI); g.add(mesh(bc, skin)); }
  let top = pts, topY = wallH;
  if (eh > 0) {
    const K = 10, rings = [];
    for (let k = 0; k <= K; k++) { const f = (k / K) * Math.PI / 2; rings.push({ pts: insetPts(pts, nrm, eh * (1 - Math.cos(f))), y: wallH + ev * Math.sin(f) }); }
    g.add(mesh(loft(rings), skin));
    top = rings[K].pts; topY = rings[K].y;
  }
  if (area(top) > 0.003) g.add(mesh(capGeo(top), skin, 0, topY, 0));
  const band = (y, h, m, out = 0.008) => g.add(mesh(loft([{ pts: insetPts(pts, nrm, -out), y }, { pts: insetPts(pts, nrm, -out), y: y + h }]), m));
  if (o.base !== false) band(0.05, 0.035, std(pal.accent, { roughness: 0.5 }));
  const ringM = std(shade(pal.wall, side === "light" ? 0.72 : 1.7), { metalness: 0.45, roughness: 0.4 });
  for (const y of o.bands || []) if (y < wallH - 0.03) band(y - 0.011, 0.022, ringM, 0.006);
  if (o.topBand) band(wallH - 0.05, 0.03, std(pal.accent, { roughness: 0.5 }));
  g.userData.top = { y: topY, flat: area(top) > 0.003 };
  g.userData.inside = inside;
  return g;
}

/* The roundover for every piece built of cubes: squircle corners on
   straight walls, a rounded top edge, between the oval first try and the
   hard-squared second (user: "make the Chato slightly less squared,
   somewhere in between the two. That should be the default roundover for
   all modular cube or polygon pieces"). */
const ROUNDOVER = { rc: 0.62, n: 4.2, edge: [0.11, 0.12] };
const roundPlan = (hx, hz) => PLAN.sqrect(hx, hz, Math.min(hx, hz, ROUNDOVER.rc), ROUNDOVER.n);
const roundEdge = (Y) => ROUNDOVER.edge.map((v) => Math.min(v, Y * 0.45));

/* Squircles (user: "nothing should be cylindrical. Everything should be
   squircle"): an outline, a capped prism of one, a dome every level of
   which is one, a ring along one. */
export const SQN = 4.2;
export const sqF = (a, n = SQN) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), 1 / n);
export const sqPts = (R, n = SQN, M = 72) => Array.from({ length: M }, (_, j) => { const a = (j / M) * Math.PI * 2, f = R * sqF(a, n); return [Math.cos(a) * f, Math.sin(a) * f]; });
export function sqPrism(R, h, mat, n = SQN) {
  const g = new THREE.Group(), pts = sqPts(R, n);
  g.add(mesh(loft([{ pts, y: -h / 2 }, { pts, y: h / 2 }]), mat));
  const t = capGeo(pts); t.translate(0, h / 2, 0); g.add(mesh(t, mat));
  const b = capGeo(pts); b.rotateX(Math.PI); b.translate(0, -h / 2, 0); g.add(mesh(b, mat));
  return g;
}
export function sqDomeGeo(R, k = 1, n = SQN) {
  const geo = new THREE.SphereGeometry(1, 72, 20, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = sqF(Math.atan2(z, x), n); p.setXYZ(i, x * f * R, y * k * R, z * f * R); }
  geo.computeVertexNormals();
  return geo;
}
export const sqRingGeo = (R, tube, n = SQN) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sqPts(R, n, 56).map(([x, z]) => new THREE.Vector3(x, 0, z)), true), 112, tube, 6, true);

/* The roof's gear, inside the footprint: a rounded plant box, a skylight,
   a small dish on a mast (the dish drawn on both faces). */
function roofKit(kit, X, Z, y, pal) {
  const box = std(shade(pal.wall, 0.82), { roughness: 0.5, metalness: 0.2 }), white = std("#d9dde2", { metalness: 0.4, roughness: 0.4 });
  kit.add(mesh(makeRoundedBox(Math.min(0.3, X * 0.36), 0.08, Math.min(0.22, Z * 0.3), 0.03), box, -X * 0.18, y + 0.04, Z * 0.16));
  kit.add(mesh(makeRoundedBox(Math.min(0.26, X * 0.3), 0.02, Math.min(0.18, Z * 0.26), 0.008), std("#0e1a28", { roughness: 0.1, metalness: 0.5, emissive: col("#9ad8ff"), emissiveIntensity: 0.5 }), X * 0.16, y + 0.01, -Z * 0.18));
  kit.add(boxM(0.012, 0.16, 0.012, white, X * 0.22, y + 0.08, Z * 0.22));
  const dish = mesh(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), std("#d9dde2", { metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }), X * 0.22, y + 0.17, Z * 0.22);
  dish.rotation.x = -0.9; kit.add(dish);
}

/* Odd pieces, from the game's own cube list: a column of cubes rising from
   the ground is a squircle column (it stops under a row laid across its
   top, as an arch's legs under the lintel); every row of two or more
   cubes side by side is a pod at its level; a cube on its own takes the
   Turrito's squircle. The parts overlap into one building of the piece's
   exact shape. */
function voxBody(vox, w, h, z, pal, side) {
  const cubes = vox.split(";").map((s) => s.split(",").map(Number)), has = new Set(cubes.map((c) => c.join(",")));
  const X = w * PS, Z = h * PS, at = (x, y) => [-X / 2 + PS * (x + 0.5), -Z / 2 + PS * (y + 0.5)];
  const g = new THREE.Group(), ground = [], used = new Set(), m = 0.02;
  const runs = [];
  for (let l = 0; l < z; l++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; ) { if (!has.has(`${x},${y},${l}`)) { x++; continue; } let x2 = x; while (has.has(`${x2 + 1},${y},${l}`)) x2++; if (x2 > x) runs.push({ l, axis: "x", a: x, b: x2, at: y }); x = x2 + 1; }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; ) { if (!has.has(`${x},${y},${l}`)) { y++; continue; } let y2 = y; while (has.has(`${x},${y2 + 1},${l}`)) y2++; if (y2 > y) runs.push({ l, axis: "y", a: y, b: y2, at: x }); y = y2 + 1; }
  }
  const inRun = (x, y, l) => runs.some((R) => R.l === l && (R.axis === "x" ? R.at === y && x >= R.a && x <= R.b : R.at === x && y >= R.a && y <= R.b));
  const sits = (x, y, l) => has.has(`${x},${y},${l + 1}`);
  const place = (obj, x, z0, y) => { obj.position.set(x, y, z0); g.add(obj); };
  // columns: from the ground, two or more high, or holding something up
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (!has.has(`${x},${y},0`)) continue;
    let top = 0; while (has.has(`${x},${y},${top + 1}`)) top++;
    let l2 = top; if (top > 0 && inRun(x, y, top)) l2 = top - 1;
    if (top === 0) continue;
    const open = l2 === top, H = (l2 + 1) * PS, [cx, cz] = at(x, y);
    const q = PS / 2 - m, plan = roundPlan(q, q), Hc = H + (open ? 0 : 0.02);
    place(planBody(plan, Hc, pal, side, { edge: open ? roundEdge(Hc) : [0, 0], topBand: true, bands: [] }), cx, cz, 0);
    for (let k = 0; k <= l2; k++) used.add(`${x},${y},${k}`);
    ground.push(((ox, oz) => (px, pz) => plan(px - ox, pz - oz))(cx, cz));
  }
  // pods: every row of two or more, at its level, rounding over on top where nothing stands on it
  for (const R of runs) {
    const n = R.b - R.a + 1, [x0, z0] = R.axis === "x" ? at(R.a, R.at) : at(R.at, R.a), [x1, z1] = R.axis === "x" ? at(R.b, R.at) : at(R.at, R.b);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (R.axis === "x" ? n * PS : PS) / 2 - m, hz = (R.axis === "x" ? PS : n * PS) / 2 - m;
    let open = true; for (let k = R.a; k <= R.b; k++) { const [xx, yy] = R.axis === "x" ? [k, R.at] : [R.at, k]; if (sits(xx, yy, R.l)) open = false; used.add(`${xx},${yy},${R.l}`); }
    const inside = roundPlan(hx, hz);
    place(planBody(inside, PS, pal, side, { edge: open ? roundEdge(PS) : [0, 0], base: R.l === 0, topBand: true, bands: [], bottom: R.l > 0 }), cx, cz, R.l * PS);
    if (R.l === 0) ground.push(((ox, oz) => (px, pz) => inside(px - ox, pz - oz))(cx, cz));
  }
  // a cube on its own
  for (const [x, y, l] of cubes) {
    if (used.has(`${x},${y},${l}`)) continue;
    const [cx, cz] = at(x, y), hh = PS / 2 - 0.012, inside = roundPlan(hh, hh), top = !sits(x, y, l);
    place(planBody(inside, PS, pal, side, { edge: top ? roundEdge(PS) : [0, 0], base: l === 0, topBand: true, bands: [], bottom: l > 0 }), cx, cz, l * PS);
    if (l === 0) ground.push(((ox, oz) => (px, pz) => inside(px - ox, pz - oz))(cx, cz));
  }
  g.userData.inside = (px, pz) => ground.some((f) => f(px, pz));
  return g;
}

/* A piece's building, its foot at y = 0, its middle at x = z = 0, in the
   piece's own box (w across, h deep, z high). The roof's gear in a group
   of its own (userData.kit), hidden by the scene under an overhang. */
function pieceBuilding(piece, side) {
  const pal = PAL[side], X = piece.w * PS, Y = piece.z * PS, Z = piece.h * PS, kit = new THREE.Group();
  kit.name = "luna-kit";
  let g;
  if (piece.vox) g = voxBody(piece.vox, piece.w, piece.h, piece.z, pal, side);
  else if (piece.type === "turrito") {
    // the Turrito is a cube: the roundover filling its square, one storey of windows, a hatch on a flat roof
    const q = X / 2 - 0.012;
    g = planBody(roundPlan(q, q), Y, pal, side, { edge: roundEdge(Y), topBand: true, bands: [] });
    if (g.userData.top.flat) {
      const ty = g.userData.top.y;
      kit.add(sqPrism(0.105, 0.012, std(pal.accent, { roughness: 0.5 })).translateY(ty + 0.006), sqPrism(0.095, 0.025, std(shade(pal.wall, side === "light" ? 0.85 : 1.4), { roughness: 0.5 })).translateY(ty + 0.0125));
    }
  } else {
    const standing = Y >= Math.max(X, Z) - 0.01, m = 0.02, hx = X / 2 - m, hz = Z / 2 - m, e = roundEdge(Y), bands = [];
    for (let y = PS; y < Y - 0.05; y += PS) bands.push(y);
    g = planBody(roundPlan(hx, hz), Y, pal, side, { edge: e, topBand: true, bands: standing ? bands : [] });
    if (g.userData.top.flat) {
      if (standing) roofKit(kit, X * 0.62, Z * 0.62, g.userData.top.y, pal);
      else roofKit(kit, X - 2 * e[0] - 0.1, Z - 2 * e[0] - 0.1, g.userData.top.y, pal);
    }
  }
  g.add(kit);
  g.userData.kit = kit;
  return g;
}

/* ------------------------------------------------------------ the Cabeza */

/* The habitat dome, a garden glowing inside; its base in the side's own
   colours (white with an orange band, charcoal with a gold one), the dome
   a little smaller so a ring of the base shows round it from above too.
   Just glass, no frame (user: "get rid of the birdcage look ... just give
   it maybe some more sheen"): a soft bright rim where the glass turns
   away from the eye. */
const SHEEN_VS = "varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }";
const SHEEN_FS = "uniform vec3 tint; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(tint * f * k, f * k); }";
function cabezaBuilding(side, seedN) {
  const pal = PAL[side], g = new THREE.Group(), r = CAB_D / 2, bh = 0.1, dr = r * 0.8;
  const baseM = std(pal.wall, { metalness: 0.15, roughness: 0.5 }), acc = std(pal.accent, { metalness: 0.2, roughness: 0.45 });
  g.add(mesh(loft([{ pts: sqPts(r * 1.03), y: 0 }, { pts: sqPts(r), y: bh }]), baseM));
  const cap = capGeo(sqPts(r)); cap.translate(0, bh, 0); g.add(mesh(cap, baseM));
  g.add(mesh(loft([{ pts: sqPts(r * 1.035), y: bh * 0.45 - 0.013 }, { pts: sqPts(r * 1.035), y: bh * 0.45 + 0.013 }]), acc));
  g.userData.inside = (x, z) => Math.abs(x / r) ** SQN + Math.abs(z / r) ** SQN <= 1;
  garden(g, side, bh, dr, seedN);
  const dome = new THREE.Mesh(sqDomeGeo(dr), new THREE.MeshStandardMaterial({ color: col("#d8ecff"), transparent: true, opacity: 0.21, roughness: 0.05, metalness: 0.2, emissive: col("#7ac8ff"), emissiveIntensity: 0.25 }));
  dome.position.y = bh; dome.castShadow = false; dome.renderOrder = 1; g.add(dome);
  const sheen = new THREE.Mesh(sqDomeGeo(dr * 1.003), new THREE.ShaderMaterial({
    uniforms: { tint: { value: col("#eef7ff") }, k: { value: 0.6 } }, vertexShader: SHEEN_VS, fragmentShader: SHEEN_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sheen.position.y = bh; sheen.renderOrder = 2; sheen.castShadow = false; g.add(sheen);
  g.add(mesh(sqRingGeo(dr, 0.024), acc, 0, bh, 0));
  return g;
}

/* ------------------------------------------------------------ people */

/* The figure's body as one smooth surface (user: "ensure the top of the
   legs nestle within the lower portion of the torso seamlessly"; no ball
   joints; slim hips, a flat front). Torso, arms, legs, neck and hands are
   distance fields of tapered capsules, joined by smooth unions only where
   they meet; meshed with surface nets, shaded by the field's gradient.
   One mesh a pose, kept; the suit and skin colours go on per vertex. */
const FIG_CACHE = new Map();
const FIG_STEP = 0.011; // the mesh's grid, coarser than the mock-ups' (the people are small on the board)
function figureBody(Q, k, eva) {
  const key = JSON.stringify([Q.legs, Q.arms, Q.lean, k, eva ? 1 : 0]), hit = FIG_CACHE.get(key);
  if (hit) return hit;
  const V = (x, y, z) => new THREE.Vector3(x, y, z), X1 = V(1, 0, 0), down = () => V(0, -1, 0);
  const prim = (a, b2, ra, rb, sz = 1) => { const az = a[2] / sz, dx = b2[0] - a[0], dy = b2[1] - a[1], dz = b2[2] / sz - az, L2 = dx * dx + dy * dy + dz * dz; return { ax: a[0], ay: a[1], az, dx, dy, dz, iL2: L2 > 1e-12 ? 1 / L2 : 0, ra, rb, sz }; };
  const capD = (q, x, y, z) => { const px = x - q.ax, py = y - q.ay, pz = z / q.sz - q.az; let t = (px * q.dx + py * q.dy + pz * q.dz) * q.iL2; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = px - q.dx * t, qy = py - q.dy * t, qz = pz - q.dz * t; return Math.sqrt(qx * qx + qy * qy + qz * qz) - (q.ra + (q.rb - q.ra) * t); };
  const smin = (a2, b2, kk) => { if (kk <= 1e-6) return a2 < b2 ? a2 : b2; const h = Math.max(kk - Math.abs(a2 - b2), 0) / kk; return (a2 < b2 ? a2 : b2) - h * h * kk * 0.25; };
  const fall = (dx, dy, dz, R) => { const t = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / R); return t * t * (3 - 2 * t); };
  const torso = [prim([-0.03 * k, 0.025, 0], [0.03 * k, 0.025, 0], 0.064 * k, 0.064 * k, 0.68), prim([0, 0.04, 0], [0, 0.14, 0], 0.086 * k, 0.088 * k, 0.6),
    prim([0, 0.15, 0], [0, 0.205, 0], 0.096 * k, 0.11 * k, 0.66), prim([-0.07 * k, 0.272, 0], [0.07 * k, 0.272, 0], 0.046 * k, 0.046 * k, 0.78)];
  const neck = prim([0, 0.3, 0], [0, 0.41, 0], 0.031 * k, 0.029 * k);
  const legs = [], hips = [], shoes = [], pts = [];
  [-1, 1].forEach((sd, i) => {
    const [hx, kx] = Q.legs[i], hip = V(sd * 0.052 * k, 0.5, 0), knee = hip.clone().add(down().applyAxisAngle(X1, hx).multiplyScalar(0.24)), ankle = knee.clone().add(down().applyAxisAngle(X1, hx + kx).multiplyScalar(0.23));
    // the thighs flattened front to back, their tops started up inside the belly (user: "they have butts ... on the front")
    const top2 = hip.clone().add(down().applyAxisAngle(X1, hx).multiplyScalar(-0.035));
    legs.push([prim([top2.x * 0.95, top2.y, top2.z], [knee.x, knee.y, knee.z], 0.049 * k, 0.044 * k, 0.84), prim([knee.x, knee.y, knee.z], [ankle.x, ankle.y + 0.025, ankle.z], 0.044 * k, 0.038 * k)]);
    hips.push(hip); shoes.push({ ankle, rot: hx + kx }); pts.push(hip, knee, ankle);
  });
  const arms = [], hands = [], sho = [], joints = [], cl = Math.cos(Q.lean), sl = Math.sin(Q.lean);
  const toBody = (p) => V(p.x, 0.5 + p.y * cl - p.z * sl, p.y * sl + p.z * cl);
  [-1, 1].forEach((sd, i) => {
    const [sx, sz, ex] = Q.arms[i], R = new THREE.Euler(sx, 0, sz), sh = V(sd * 0.1 * k, 0.27, 0), d1 = down().applyEuler(R), d2 = down().applyAxisAngle(X1, ex).applyEuler(R);
    const el = sh.clone().add(d1.clone().multiplyScalar(0.215)), wr = el.clone().add(d2.clone().multiplyScalar(0.175)), tip = wr.clone().add(d2.clone().multiplyScalar(0.065));
    arms.push([prim([sh.x, sh.y + 0.012, sh.z], [el.x, el.y, el.z], 0.042 * k, 0.033 * k), prim([el.x, el.y, el.z], [wr.x, wr.y, wr.z], 0.033 * k, 0.029 * k)]);
    hands.push(prim([wr.x, wr.y, wr.z], [tip.x, tip.y, tip.z], 0.027 * k, 0.022 * k)); sho.push(sh); joints.push({ sh, d1 });
    pts.push(toBody(sh), toBody(el), toBody(wr), toBody(tip));
  });
  for (const p of [[0.13, 0.02], [-0.13, 0.02], [0.13, 0.28], [-0.13, 0.28], [0, 0.42], [0, -0.06]]) pts.push(toBody(V(p[0] * k, p[1], 0)));
  // out[0] the body, out[1] the suit's parts alone, out[2] the bare skin's
  const parts = (x, y, z, out) => {
    const ly = y - 0.5, wy = ly * cl + z * sl, wz = -ly * sl + z * cl;
    let S = capD(torso[0], x, wy, wz);
    for (let i = 1; i < 4; i++) S = smin(S, capD(torso[i], x, wy, wz), 0.05);
    for (let i = 0; i < 2; i++) { const L = legs[i], h = hips[i]; S = smin(S, Math.min(capD(L[0], x, y, z), capD(L[1], x, y, z)), 0.045 * fall(x - h.x, y - h.y, z - h.z, 0.17)); }
    for (let i = 0; i < 2; i++) { const A = arms[i], s2 = sho[i]; S = smin(S, Math.min(capD(A[0], x, wy, wz), capD(A[1], x, wy, wz)), 0.04 * fall(x - s2.x, wy - s2.y, wz - s2.z, 0.11)); }
    const N = capD(neck, x, wy, wz), Hd = Math.min(capD(hands[0], x, wy, wz), capD(hands[1], x, wy, wz));
    if (eva) { S = smin(S, N, 0.03); out[1] = S; out[2] = Hd; out[0] = smin(S, Hd, 0.012); }
    else { out[1] = S; out[2] = Math.min(N, Hd); out[0] = smin(smin(S, N, 0.03), Hd, 0.012); }
    return out[0];
  };
  const h = FIG_STEP, M = 0.12, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of pts) { const c = [p.x, p.y, p.z]; for (let a2 = 0; a2 < 3; a2++) { lo[a2] = Math.min(lo[a2], c[a2] - M); hi[a2] = Math.max(hi[a2], c[a2] + M); } }
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1, [x0, y0, z0] = lo;
  const f = new Float32Array(nx * ny * nz), out = [0, 0, 0], FI = (i, j, q) => i + nx * (j + ny * q), CI = (i, j, q) => i + (nx - 1) * (j + (ny - 1) * q);
  for (let q = 0; q < nz; q++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[FI(i, j, q)] = parts(x0 + i * h, y0 + j * h, z0 + q * h, out);
  // surface nets: a vertex in every cell the surface passes through, at the mean of its edge crossings
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), pos = [], v = new Float32Array(8);
  for (let q = 0; q < nz - 1; q++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = f[FI(i + (c & 1), j + ((c >> 1) & 1), q + ((c >> 2) & 1))]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let a2 = 0; a2 < 8; a2++) for (const bit of [1, 2, 4]) {
      if (a2 & bit) continue;
      const c2 = a2 | bit, va = v[a2], vb = v[c2]; if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += (a2 & 1) + ((c2 & 1) - (a2 & 1)) * t; sy += ((a2 >> 1) & 1) + (((c2 >> 1) & 1) - ((a2 >> 1) & 1)) * t; sz += ((a2 >> 2) & 1) + (((c2 >> 2) & 1) - ((a2 >> 2) & 1)) * t; n++;
    }
    cell[CI(i, j, q)] = pos.length / 3; pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (q + sz / n) * h);
  }
  const idx = [];
  const quad = (a2, b2, c2, d2, axis, outPos) => {
    if (a2 < 0 || b2 < 0 || c2 < 0 || d2 < 0) return;
    const ux = pos[3 * c2] - pos[3 * a2], uy = pos[3 * c2 + 1] - pos[3 * a2 + 1], uz = pos[3 * c2 + 2] - pos[3 * a2 + 2], wx2 = pos[3 * d2] - pos[3 * b2], wy2 = pos[3 * d2 + 1] - pos[3 * b2 + 1], wz2 = pos[3 * d2 + 2] - pos[3 * b2 + 2];
    const nn = [uy * wz2 - uz * wy2, uz * wx2 - ux * wz2, ux * wy2 - uy * wx2][axis];
    if ((nn > 0) !== outPos) idx.push(a2, d2, c2, a2, c2, b2); else idx.push(a2, b2, c2, a2, c2, d2);
  };
  for (let q = 0; q < nz; q++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const in0 = f[FI(i, j, q)] < 0;
    if (i < nx - 1 && j > 0 && q > 0 && j < ny - 1 && q < nz - 1 && (f[FI(i + 1, j, q)] < 0) !== in0) quad(cell[CI(i, j - 1, q - 1)], cell[CI(i, j, q - 1)], cell[CI(i, j, q)], cell[CI(i, j - 1, q)], 0, in0);
    if (j < ny - 1 && i > 0 && q > 0 && i < nx - 1 && q < nz - 1 && (f[FI(i, j + 1, q)] < 0) !== in0) quad(cell[CI(i - 1, j, q - 1)], cell[CI(i - 1, j, q)], cell[CI(i, j, q)], cell[CI(i, j, q - 1)], 1, in0);
    if (q < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && (f[FI(i, j, q + 1)] < 0) !== in0) quad(cell[CI(i - 1, j - 1, q)], cell[CI(i, j - 1, q)], cell[CI(i, j, q)], cell[CI(i - 1, j, q)], 2, in0);
  }
  const nv = pos.length / 3, nrm = new Float32Array(nv * 3), skinW = new Float32Array(nv), e = h * 0.5;
  for (let i = 0; i < nv; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    const gx = parts(x + e, y, z, out) - parts(x - e, y, z, out), gy = parts(x, y + e, z, out) - parts(x, y - e, z, out), gz = parts(x, y, z + e, out) - parts(x, y, z - e, out), l = Math.hypot(gx, gy, gz) || 1;
    nrm[3 * i] = gx / l; nrm[3 * i + 1] = gy / l; nrm[3 * i + 2] = gz / l;
    parts(x, y, z, out); skinW[i] = Math.min(1, Math.max(0, 0.5 + (out[1] - out[2]) / 0.008));
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); geo.setIndex(idx);
  const res = { geo, skinW, shoes, joints };
  FIG_CACHE.set(key, res);
  return res;
}
// skin tones across the whole human range, in three bands; hair
export const SKIN = [["#eccab2", "#e6b896", "#d9a57f"], ["#c98f62", "#ad7449", "#93603b"], ["#744528", "#583320", "#3f2416"]];
export const HAIR = ["#141110", "#2b1d15", "#4a3020", "#7a4a26", "#b88a4a", "#9c3f20", "#d8d2c8"];
export const PERSON_H = 0.165; // a hair smaller than the mock-ups' first people (user)
const SHOE_GEO = new THREE.SphereGeometry(1, 14, 8);
/* A little person, one unit tall scaled to o.h, facing +z, feet at the
   origin. Poses: "stand", "walk", "kneel" (tending the bed in front),
   "reach" (picking from a tree in front), "carry" (a basket at the
   waist). o.eva: a white suit, a helmet with a gold visor, a pack, a band
   of the side's colour on each arm. Skin and hair as the colours they are
   (converted to linear, or every tone shows lighter than given). */
export function personFig(o = {}) {
  const g = new THREE.Group(), b = new THREE.Group(), eva = !!o.eva, k = eva ? 1.25 : 1, pose = o.pose || "stand";
  g.add(b); g.scale.setScalar(o.h ?? PERSON_H);
  const asIs = (m) => { m.color.convertSRGBToLinear(); return m; };
  const suit = std(eva ? "#eceef0" : o.suit || "#ff7a1a", { roughness: 0.65 }), skinM = asIs(new THREE.MeshStandardMaterial({ color: col(o.skin || "#c99a76"), roughness: 0.75 })), boot = std(eva ? "#9aa0a7" : "#2a2c30", { roughness: 0.7 });
  const Q = { legs: [[0, 0], [0, 0]], arms: [[0.05, -0.19, -0.15], [0.05, 0.19, -0.15]], lean: 0, drop: 0, tilt: 0 };
  if (pose === "walk") Object.assign(Q, { drop: 0.03, legs: [[-0.42, 0.12], [0.38, 0.4]], arms: [[0.38, -0.19, -0.25], [-0.42, 0.19, -0.45]], lean: 0.06 });
  if (pose === "kneel") Object.assign(Q, { drop: 0.235, legs: [[-1.45, 1.45], [0.12, 1.45]], arms: [[-1.0, -0.12, -0.35], [-0.75, 0.12, -0.55]], lean: 0.5, tilt: 0.2 });
  if (pose === "reach") Object.assign(Q, { arms: [[-2.5, -0.25, -0.2], [-2.2, 0.25, -0.35]], lean: -0.05, tilt: -0.35 });
  if (pose === "carry") Object.assign(Q, { arms: [[-0.3, -0.24, -1.25], [-0.3, 0.24, -1.25]] });
  b.position.y = -Q.drop;
  const V = (x, y, z) => new THREE.Vector3(x, y, z), X1 = V(1, 0, 0), F = figureBody(Q, k, eva), n = F.skinW.length, rgb = new Float32Array(n * 3), cs = suit.color, ck = (eva ? boot : skinM).color;
  for (let i = 0; i < n; i++) { const w = F.skinW[i]; rgb[3 * i] = cs.r + (ck.r - cs.r) * w; rgb[3 * i + 1] = cs.g + (ck.g - cs.g) * w; rgb[3 * i + 2] = cs.b + (ck.b - cs.b) * w; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", F.geo.attributes.position); geo.setAttribute("normal", F.geo.attributes.normal); geo.setIndex(F.geo.index); geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  b.add(mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide })));
  for (const { ankle, rot } of F.shoes) { const shoe = mesh(SHOE_GEO, boot); shoe.scale.set(0.044 * k, 0.03, 0.078 * k); shoe.rotation.x = rot; shoe.position.copy(ankle).add(V(0, 0, 1).applyAxisAngle(X1, rot).multiplyScalar(0.03)).add(V(0, 0.004, 0)); b.add(shoe); }
  const waist = new THREE.Group(); waist.position.y = 0.5; waist.rotation.x = Q.lean; b.add(waist);
  if (eva && o.band) for (const { sh, d1 } of F.joints) { const band = mesh(new THREE.CylinderGeometry(0.046 * k, 0.046 * k, 0.03, 14, 1, true), std(o.band, { roughness: 0.5, side: THREE.DoubleSide })); band.position.copy(sh).add(d1.clone().multiplyScalar(0.09)); band.quaternion.setFromUnitVectors(V(0, 1, 0), d1.clone().normalize()); waist.add(band); }
  const head = new THREE.Group(); head.position.y = 0.405; head.rotation.x = Q.tilt; waist.add(head);
  if (eva) {
    head.add(mesh(new THREE.SphereGeometry(0.11, 20, 16), std("#f2f3f5", { roughness: 0.35 }), 0, 0.06, 0));
    head.add(mesh(new THREE.SphereGeometry(0.112, 20, 12, Math.PI / 2 - 0.95, 1.9, 0.75, 1.15), std("#d4a54a", { metalness: 1, roughness: 0.18 }), 0, 0.06, 0));
    waist.add(mesh(makeRoundedBox(0.24, 0.3, 0.12, 0.04), std("#e2e4e8", { roughness: 0.5 }), 0, 0.17, -0.12));
  } else {
    // the head a touch large, so a face reads at this size; the hair a cap on the crown and a fall behind, the face open
    const hairM = asIs(new THREE.MeshStandardMaterial({ color: col(o.hair || "#2a221c"), roughness: 0.85 })), hd = mesh(new THREE.SphereGeometry(0.086, 18, 14), skinM, 0, 0.075, 0); hd.scale.set(0.93, 1.06, 0.98); head.add(hd);
    head.add(mesh(new THREE.SphereGeometry(0.091, 18, 6, 0, Math.PI * 2, 0, 0.72), hairM, 0, 0.081, -0.004));
    head.add(mesh(new THREE.SphereGeometry(0.0905, 18, 8, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0.6, o.long ? 1.35 : 0.85), hairM, 0, 0.081, -0.004));
  }
  if (pose === "carry") {
    b.add(mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.09, 16, 1, true), std("#b08a52", { roughness: 0.9, side: THREE.DoubleSide }), 0, 0.55, 0.24));
    for (let i = 0; i < 4; i++) b.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), std(["#d63c2a", "#f08a24", "#6fb03a", "#e8c63a"][i], { roughness: 0.5 }), (i % 2 - 0.5) * 0.08, 0.6, 0.24 + (i < 2 ? -0.03 : 0.03)));
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  return g;
}

/* The Cabeza's kitchen garden (user: "inject a little bit of human
   activity ... harvesting some of the food or tending to the crops"): a
   deck, three planter beds round a fruit tree, the gap toward the door;
   someone walking in, someone kneeling at a bed, someone picking from the
   tree with a full basket at their feet, all in their side's colour, one
   from each band of skin tones. */
const SUITS = { light: "#d9520a", dark: "#c48a0a" };
function garden(g, side, bh, dr, seedN) {
  let s0 = (4242 + seedN * 7919) >>> 0;
  const fr = () => (s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0) / 4294967296, fp = (a) => a[Math.floor(fr() * a.length)];
  const deck = std("#d6d0c2", { roughness: 0.85 }), bed = std("#cbc6bb", { roughness: 0.7 }), soil = std("#4a3a2c", { roughness: 1 });
  const leaf = ["#4f9a3e", "#3c7f34", "#6fbf4a", "#8fcf62"].map((c) => std(c, { roughness: 0.8 })), fruit = ["#d63c2a", "#f08a24", "#e8c63a"].map((c) => std(c, { roughness: 0.5 }));
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // the door toward the board's middle as the pieces start (the light side's toward -z, the dark side's toward +z)
  const th0 = side === "light" ? Math.PI : 0, thc = 0, at = (th, rho) => [Math.sin(th) * rho, Math.cos(th) * rho];
  put(mesh(capGeo(sqPts(dr - 0.006)), deck), 0, bh + 0.004, 0);
  for (const c of [th0 + Math.PI / 2, th0 + Math.PI, th0 + 1.5 * Math.PI]) {
    const span = 1.25, a0 = c - span / 2;
    put(mesh(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.2, 0.04), new THREE.Vector2(0.29, 0.04), new THREE.Vector2(0.29, 0)], 16, a0, span), bed), 0, bh, 0);
    put(mesh(new THREE.LatheGeometry([new THREE.Vector2(0.207, 0.041), new THREE.Vector2(0.283, 0.041)], 16, a0 + 0.02, span - 0.04), soil), 0, bh, 0);
    for (let i = 0; i < 6; i++) {
      const [px, pz] = at(a0 + ((i + 0.5) / 6) * span, 0.245), t = fr();
      if (t < 0.45) { put(mesh(new THREE.SphereGeometry(0.026, 10, 8), fp(leaf)), px, bh + 0.062, pz); for (let j = 0; j < 3; j++) put(mesh(new THREE.SphereGeometry(0.0075, 6, 5), fruit[0]), px + (fr() - 0.5) * 0.04, bh + 0.06 + fr() * 0.02, pz + (fr() - 0.5) * 0.04); }
      else if (t < 0.75) put(mesh(new THREE.ConeGeometry(0.018, 0.075, 8), fp(leaf)), px, bh + 0.078, pz);
      else { const m = put(mesh(new THREE.SphereGeometry(0.024, 10, 8), leaf[3]), px, bh + 0.052, pz); m.scale.y = 0.6; }
    }
  }
  put(mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.12, 8), std("#6a4a2e", { roughness: 0.9 })), 0, bh + 0.06, 0);
  put(mesh(new THREE.SphereGeometry(0.065, 14, 10), leaf[1]), 0, bh + 0.16, 0);
  for (let j = 0; j < 9; j++) { const a = fr() * Math.PI * 2, e = fr() * 1.2 - 0.3; put(mesh(new THREE.SphereGeometry(0.009, 6, 5), fruit[1]), Math.cos(a) * Math.cos(e) * 0.066, bh + 0.16 + Math.sin(e) * 0.066, Math.sin(a) * Math.cos(e) * 0.066); }
  // one person from each band of skin tones, in an order of its own
  const bands = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(fr() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }
  let nth = 0;
  const who = (pose) => personFig({ pose, suit: SUITS[side], skin: SKIN[bands[nth % 3]][(seedN + nth++) % 3], hair: fp(HAIR), long: fr() < 0.4 });
  const inGap = (a) => Math.abs(Math.atan2(Math.sin(a - th0), Math.cos(a - th0))) < 1.0;
  { const [x, z] = at(th0, 0.22); put(who("walk"), x, bh, z, th0 + Math.PI); }
  { let a = thc + 1.25; if (inGap(a)) a = thc - 1.25; const [x, z] = at(a, 0.15); put(who("kneel"), x, bh, z, a); }
  { let a = thc + Math.PI + 0.75; if (inGap(a)) a = thc + Math.PI - 0.75; const [x, z] = at(a, 0.125); put(who("reach"), x, bh, z, a + Math.PI);
    const [bx, bz] = at(a + 0.6, 0.15);
    put(mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.018, 12, 1, true), std("#b08a52", { roughness: 0.9, side: THREE.DoubleSide })), bx, bh + 0.009, bz);
    for (let i = 0; i < 4; i++) put(mesh(new THREE.SphereGeometry(0.0075, 6, 5), fruit[i % 3]), bx + (fr() - 0.5) * 0.02, bh + 0.018, bz + (fr() - 0.5) * 0.02); }
}

/* ------------------------------------------------------------ the pieces, for the chassis */

// A piece's building, made once per piece and pose and kept.
const BUILT = new Map();
let CAB_N = 0;
export function buildingFor(piece, side) {
  const key = piece.type === "cabeza" ? `${piece.id}|cab|${side}` : `${piece.id}|${side}|${piece.type}|${piece.w}|${piece.h}|${piece.z}|${piece.vox || ""}`;
  let b = BUILT.get(key);
  if (!b) {
    b = piece.type === "cabeza" ? cabezaBuilding(side, CAB_N++) : pieceBuilding(piece, side);
    b.userData.lunaBuilding = true;
    BUILT.set(key, b);
  }
  return b;
}

/* Where a piece stands, as the corridors and the ground see it: its
   middle on the board and whether a point (relative to the middle) is
   inside its walls at the ground. The same plans as the buildings. */
export function footprintOf(piece, center) {
  if (piece.type === "cabeza") { const r = CAB_D / 2; return { x: center.x, z: center.z, round: true, r, inside: (x, z) => Math.abs(x / r) ** SQN + Math.abs(z / r) ** SQN <= 1 }; }
  const X = piece.w * PS, Z = piece.h * PS;
  if (piece.vox) {
    const cells = piece.vox.split(";").map((s) => s.split(",").map(Number)).filter((c) => c[2] === 0), q = PS / 2 - 0.012;
    const f = roundPlan(q, q), parts = cells.map(([x, y]) => [-X / 2 + PS * (x + 0.5), -Z / 2 + PS * (y + 0.5)]);
    return { x: center.x, z: center.z, round: false, hx: X / 2, hz: Z / 2, cells: parts, inside: (px, pz) => parts.some(([cx, cz]) => f(px - cx, pz - cz)) || voxRowsInside(piece, X, Z, px, pz) };
  }
  const f = piece.type === "turrito" ? roundPlan(X / 2 - 0.012, Z / 2 - 0.012) : roundPlan(X / 2 - 0.02, Z / 2 - 0.02);
  return { x: center.x, z: center.z, round: false, hx: X / 2, hz: Z / 2, inside: f };
}
// a vox piece's ground-level rows (pods) as one stretch, so a corridor meets the pod's wall and not the gap between cubes
function voxRowsInside(piece, X, Z, px, pz) {
  const ground = new Set(piece.vox.split(";").map((s) => s.split(",").map(Number)).filter((c) => c[2] === 0).map((c) => `${c[0]},${c[1]}`));
  const cx = Math.floor((px + X / 2) / PS), cy = Math.floor((pz + Z / 2) / PS);
  if (!ground.has(`${cx},${cy}`)) return false;
  const hasX = ground.has(`${cx - 1},${cy}`) || ground.has(`${cx + 1},${cy}`), hasY = ground.has(`${cx},${cy - 1}`) || ground.has(`${cx},${cy + 1}`);
  if (!hasX && !hasY) return false;
  const lx = px + X / 2 - (cx + 0.5) * PS, lz = pz + Z / 2 - (cy + 0.5) * PS, e = PS / 2 - 0.02;
  return (hasX && Math.abs(lz) <= e) || (hasY && Math.abs(lx) <= e);
}

/* The cubes each piece fills, to find pieces with another standing over
   them (whose roof gear then goes: user, "a Turrito ... will have to fit
   underneath an overhang"). */
const cubesOf = (p) => (p.vox ? p.vox.split(";").map((c) => c.split(",").map(Number)) : Array.from({ length: p.w * p.h * p.z }, (_, i) => [i % p.w, Math.floor(i / p.w) % p.h, Math.floor(i / (p.w * p.h))])).map(([x, y, l]) => [p.row + y, p.col + x, l]);
export function coveredIds(pieces) {
  const CUBES = new Map(), out = new Set();
  pieces.forEach((p, i) => { if (p.type !== "cabeza") for (const [r, c, l] of cubesOf(p)) CUBES.set(`${r},${c},${l}`, i); });
  pieces.forEach((p, i) => {
    const under = p.type === "cabeza" ? !CUBES.has(`${p.row},${p.col},0`) && CUBES.has(`${p.row},${p.col},1`) : cubesOf(p).some(([r, c, l]) => { const o2 = CUBES.get(`${r},${c},${l + 1}`); return o2 !== undefined && o2 !== i; });
    if (under) out.add(p.id);
  });
  return out;
}

export { rnd, rr, pick };
