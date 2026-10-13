/* The City Hall rotunda's ten (user: "Give me 10 different City Hall
   Rotunda Cabeza Piece design options"): the round civic hall under a
   dome, ten ways, from the Renaissance to now. Each on its one square, in
   its side's colours (Chalk's whites, Slate's grey-blues), lit at night,
   facing +z (the light side's turned round, ciudad-cabezas.js
   cabezaFor). ?cabeza=<id> plays with one. */

import * as THREE from "three";
import { std, col, glassy, TIMED, cv, tex } from "./ciudad-models.js";
import { R, tones, mk, litGlass, litMat, lathe, sphereAt, glowAt, done, headGeo, clockFace } from "./ciudad-cabeza-kit.js";

const TAU = Math.PI * 2;

/* ------------------------------------------------------------ parts */

// Steps: discs one on another, each [radius, height], from the ground up;
// the top's height back.
function steps(b, list, m, seg = 56) {
  let y = 0;
  for (const [r, h] of list) { b.cyl(r, r, h, seg, m, 0, y + h / 2, 0); y += h; }
  return y;
}
// A column: its base, its shaft (a little narrower up top), its capital.
function column(b, x, z, y0, h, r, shaftM, capM) {
  b.cyl(r * 1.45, r * 1.45, h * 0.05, 8, capM, x, y0 + h * 0.025, z);
  b.cyl(r * 0.88, r, h * 0.9, 8, shaftM, x, y0 + h * 0.5, z);
  b.box(r * 2.6, h * 0.05, r * 2.6, capM, x, y0 + h * 0.975, z);
}
// n columns in a ring of radius r.
function colonnade(b, n, r, y0, h, cr, shaftM, capM, a0 = 0) {
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; column(b, Math.sin(a) * r, Math.cos(a) * r, y0, h, cr, shaftM, capM); }
}
// Windows (or slots, or doors) round a drum: n of them, w by h, centred at y.
function drumWindows(b, n, r, y, w, h, m, a0 = 0, d = 0.012) {
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; b.box(w, h, d, m, Math.sin(a) * r, y, Math.cos(a) * r, [0, a, 0]); }
}
// A dome: half a sphere of radius r, k times as tall, its rim at y; with an
// eye open at the top (the angle it leaves, from the top) if asked.
function domeGeo(r, k, y, eye = 0, seg = 48) {
  const g = new THREE.SphereGeometry(r, seg, 18, 0, TAU, eye, Math.PI / 2 - eye);
  g.scale(1, k, 1); g.translate(0, y, 0);
  return g;
}
// Ribs down a dome, rim to top (or to its eye).
function domeRibs(b, n, r, k, y, tube, m, a0 = 0, eye = 0) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.TorusGeometry(r + tube * 0.4, tube, 4, 28, Math.PI / 2 - eye);
    g.rotateY(a0 + (i / n) * TAU); g.scale(1, k, 1); g.translate(0, y, 0);
    b.geo(g, m);
  }
}
// A ring round a dome at a height (th: the angle from the top).
function domeRing(b, r, k, y, th, tube, m) {
  const g = new THREE.TorusGeometry(r * Math.sin(th) + tube * 0.4, tube, 4, 56);
  g.rotateX(Math.PI / 2); g.translate(0, y + k * r * Math.cos(th), 0);
  b.geo(g, m);
}
// A balustrade round: a rail on top, one at the foot, balusters between.
function balustrade(b, r, y, h, n, m) {
  for (const yy of [y + 0.003, y + h]) b.geo(new THREE.TorusGeometry(r, 0.0035, 4, 64).rotateX(Math.PI / 2).translate(0, yy, 0), m);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; b.cyl(0.0028, 0.0034, h, 5, m, Math.sin(a) * r, y + h / 2, Math.cos(a) * r); }
}
// A pediment: a low triangle w wide and hp high, d deep, its foot at y,
// centred at z (then the whole turned by ry about the upright).
function pediment(b, w, hp, d, y, z, m, ry = 0) {
  const g = new THREE.CylinderGeometry(1, 1, d, 3);
  g.rotateX(-Math.PI / 2); // (the point up, its length along z)
  g.scale(w / Math.sqrt(3), hp / 1.5, 1);
  g.translate(0, y + hp / 3, z);
  if (ry) g.rotateY(ry);
  b.geo(g, m);
}
// (x, z) turned by a about the upright, as rotateY turns it.
const turn = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
// A little figure (a statue): a robe, a head.
function figure(b, x, y, z, h, m) {
  b.cyl(h * 0.1, h * 0.17, h * 0.66, 8, m, x, y + h * 0.33, z);
  b.geo(sphereAt(h * 0.13, x, y + h * 0.78, z, 8, 6), m);
}
// A flag in the side's colour on a pole from y.
function flag(b, t, x, y, z, h = 0.2) {
  b.cyl(0.004, 0.004, h, 6, std("#9aa0a6", { metalness: 0.6, roughness: 0.4 }), x, y + h / 2, z);
  b.box(0.085, 0.05, 0.004, std(t.L ? "#f6f4ee" : "#5a6a78", { roughness: 0.9 }), x + 0.045, y + h - 0.034, z);
}
// A dome washed in light at night (its own material: the glow follows the hour).
function flood(c, lit, night = 0.22, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.42, metalness: 0.2, emissive: col(lit), emissiveIntensity: 0, ...o });
  if ((o.metalness ?? 0.2) >= 0.3) glassy(m);
  TIMED.add((n) => { m.emissiveIntensity = night * n; });
  return m;
}
const capM = (t) => std(t.trim, { roughness: 0.55 });

/* ------------------------------------------------------------ the ten */

/* 1. Tempietto: a ring of sixteen columns round the hall on three steps,
   a balustrade round the roof of the colonnade, a drum above with its
   windows, a dome ribbed in the trim, a lantern and its ball. */
function tempietto(side) {
  const t = tones(side), b = mk(side, "tempietto");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.7 }), trimM = capM(t);
  const y0 = steps(b, [[R, 0.022], [R * 0.93, 0.022], [R * 0.86, 0.022]], stone2M);
  const ch = 0.15, cr = R * 0.56;
  b.cyl(cr, cr, ch, 48, stoneM, 0, y0 + ch / 2, 0);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 0.95);
  drumWindows(b, 8, cr, y0 + ch * 0.48, 0.05, 0.1, win, TAU / 16);
  colonnade(b, 16, R * 0.77, y0, ch, 0.011, stoneM, trimM);
  const ey = y0 + ch;
  b.cyl(R * 0.81, R * 0.81, 0.028, 56, stone2M, 0, ey + 0.014, 0);
  balustrade(b, R * 0.78, ey + 0.028, 0.03, 40, trimM);
  const dy = ey + 0.028, dh = 0.075;
  b.cyl(cr, cr, dh, 48, stoneM, 0, dy + dh / 2, 0);
  drumWindows(b, 8, cr, dy + dh / 2, 0.034, 0.045, win);
  drumWindows(b, 8, cr + 0.004, dy + dh / 2, 0.012, dh, stone2M, TAU / 16, 0.014);
  b.cyl(cr + 0.016, cr + 0.016, 0.016, 48, stone2M, 0, dy + dh + 0.008, 0);
  const domeY = dy + dh + 0.016, k = 0.86, dr = cr * 0.98;
  b.geo(domeGeo(dr, k, domeY), std(t.accent, { roughness: 0.42, metalness: 0.3 }));
  domeRibs(b, 16, dr, k, domeY, 0.0045, trimM);
  const top = domeY + dr * k;
  b.cyl(0.03, 0.034, 0.045, 12, litGlass(t.glass, "#ffe6c0", 0.05, 1.1), 0, top + 0.016, 0);
  b.geo(domeGeo(0.04, 0.8, top + 0.038), std(t.accent, { roughness: 0.42, metalness: 0.3 }));
  b.geo(sphereAt(0.014, 0, top + 0.08, 0, 10, 8), std("#c8c2b4", { metalness: 0.65, roughness: 0.3 }));
  glowAt(b, "#ffd9a0", 0.85, 0, y0 + 0.07, 0, 0.3);
  return done(b, top + 0.095);
}

/* 2. Pantheon: the drum behind a deep porch of columns under a pediment,
   steps up to it; a stepped saucer dome with its eye open to the sky, the
   eye lit from within at night. */
function pantheon(side) {
  const t = tones(side), b = mk(side, "pantheon");
  const stoneM = std(t.stone, { roughness: 0.72 }), stone2M = std(t.stone2, { roughness: 0.72 }), trimM = capM(t);
  const zc = -0.07, pr = 0.26; // the drum's middle, behind; its radius
  b.cyl(R * 0.97, R * 0.97, 0.04, 56, stone2M, 0, 0.02, 0);
  const y0 = 0.04, dh = 0.15;
  b.cyl(pr, pr, dh, 48, stoneM, 0, y0 + dh / 2, zc);
  b.cyl(pr + 0.01, pr + 0.01, 0.016, 48, stone2M, 0, y0 + dh + 0.008, zc);
  b.cyl(pr, pr, 0.03, 48, stoneM, 0, y0 + dh + 0.031, zc);
  // the dome's stepped rings, then the saucer, its eye open
  let y = y0 + dh + 0.046;
  for (const [f, h] of [[0.98, 0.016], [0.9, 0.014], [0.82, 0.012]]) { b.cyl(pr * f, pr * f, h, 48, stone2M, 0, y + h / 2, zc); y += h; }
  const dome = domeGeo(pr * 0.86, 0.5, y - 0.03, 0.24); dome.translate(0, 0, zc);
  b.geo(dome, new THREE.MeshStandardMaterial({ color: col(t.accent), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide }));
  const eyeY = y - 0.03 + pr * 0.86 * 0.5 * Math.cos(0.24);
  const inside = new THREE.CircleGeometry(pr * 0.86 * Math.sin(0.24), 24); inside.rotateX(-Math.PI / 2); inside.translate(0, eyeY - 0.03, zc);
  b.geo(inside, litMat("#2c3238", "#ffd29a", 0.02, 1.6));
  glowAt(b, "#ffd29a", 0.32, 0, eyeY + 0.02, zc, 0.6);
  // the porch: a block joining it to the drum, eight columns, the beam, the pediment
  const pz = 0.3, pw = 0.36, pd = 0.17, ch = 0.15;
  b.box(0.3, dh + 0.03, 0.14, stoneM, 0, y0 + (dh + 0.03) / 2, 0.17);
  b.box(0.06, 0.1, 0.006, litGlass(t.glass, "#ffd9a0", 0.05, 1.0), 0, y0 + 0.05, 0.243);
  for (let i = 0; i < 8; i++) column(b, -0.155 + (i * 0.31) / 7, pz + 0.07, y0, ch, 0.0105, stoneM, trimM);
  for (const x of [-0.155, 0.155]) for (const z of [pz - 0.005, pz - 0.07]) column(b, x, z, y0, ch, 0.0105, stoneM, trimM);
  b.box(pw, 0.026, pd, stone2M, 0, y0 + ch + 0.013, pz);
  pediment(b, pw + 0.01, 0.07, pd, y0 + ch + 0.026, pz, stoneM);
  return done(b, eyeY + 0.01);
}

/* 3. Capitol: a hall on two steps, a colonnade round the drum, an attic,
   a tall dome ribbed and ringed, a lantern of columns, a statue on top;
   at night the dome washed in light. */
function capitol(side) {
  const t = tones(side), b = mk(side, "capitol");
  const stoneM = std(t.stone, { roughness: 0.68 }), stone2M = std(t.stone2, { roughness: 0.7 }), trimM = capM(t);
  const y0 = steps(b, [[R, 0.02], [R * 0.92, 0.02]], stone2M);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 0.95);
  b.cyl(0.3, 0.3, 0.08, 56, stoneM, 0, y0 + 0.04, 0);
  drumWindows(b, 16, 0.3, y0 + 0.042, 0.028, 0.044, win);
  b.cyl(0.31, 0.31, 0.012, 56, stone2M, 0, y0 + 0.086, 0);
  const py = y0 + 0.092, ph = 0.1;
  b.cyl(0.235, 0.235, ph, 48, stoneM, 0, py + ph / 2, 0);
  drumWindows(b, 12, 0.235, py + ph * 0.5, 0.026, 0.058, win, TAU / 24);
  colonnade(b, 24, 0.27, py, ph, 0.0075, stoneM, trimM);
  b.cyl(0.285, 0.285, 0.016, 56, stone2M, 0, py + ph + 0.008, 0);
  balustrade(b, 0.276, py + ph + 0.016, 0.02, 48, trimM);
  const ay = py + ph + 0.016, ah = 0.04;
  b.cyl(0.22, 0.22, ah, 48, stoneM, 0, ay + ah / 2, 0);
  drumWindows(b, 16, 0.22, ay + ah / 2, 0.02, 0.018, win);
  const domeY = ay + ah, dr = 0.212, k = 1.22;
  b.geo(domeGeo(dr, k, domeY), flood(t.L ? "#f4f2ec" : t.F.walls[2], "#fff2dc", 0.2, { roughness: 0.45 }));
  domeRibs(b, 16, dr, k, domeY, 0.004, trimM, 0, 0.2);
  for (const th of [1.18, 0.86]) domeRing(b, dr, k, domeY, th, 0.0035, trimM);
  const top = domeY + dr * k * Math.cos(0.2);
  // the lantern: a ring of columns round a lit drum, a cap
  b.cyl(0.045, 0.045, 0.01, 16, stone2M, 0, top + 0.005, 0);
  b.cyl(0.028, 0.028, 0.05, 12, litGlass(t.glass, "#ffe6c0", 0.05, 1.2), 0, top + 0.035, 0);
  colonnade(b, 8, 0.04, top + 0.01, 0.05, 0.0035, stoneM, trimM);
  b.geo(domeGeo(0.046, 0.9, top + 0.06), std(t.accent, { roughness: 0.42, metalness: 0.3 }));
  figure(b, 0, top + 0.1, 0, 0.055, std(t.L ? "#c9ccc8" : "#3e4a56", { roughness: 0.4, metalness: 0.5 }));
  glowAt(b, "#ffe6c0", 0.25, 0, top + 0.035, 0, 0.8);
  return done(b, top + 0.155);
}

/* 4. Palladian (the Villa Rotonda's way): a square hall, a porch of
   columns and a pediment on every side with steps up to it, a low roof,
   the dome low in the middle; a statue on each pediment's point. */
function palladian(side) {
  const t = tones(side), b = mk(side, "palladian");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.72 }), trimM = capM(t);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 0.95);
  b.cyl(R * 0.99, R * 0.99, 0.02, 56, std(t.L ? "#e6e2d8" : "#4a5664", { roughness: 0.85 }), 0, 0.01, 0);
  const a = 0.2, bh = 0.16, y0 = 0.02;
  b.box(2 * a, bh, 2 * a, stoneM, 0, y0 + bh / 2, 0);
  b.box(2 * a + 0.012, 0.014, 2 * a + 0.012, stone2M, 0, y0 + bh + 0.007, 0);
  for (let s = 0; s < 4; s++) {
    const ry = (s * Math.PI) / 2;
    // the windows either side of the porch
    for (const x of [-0.145, 0.145]) for (const yy of [y0 + 0.05, y0 + 0.12]) {
      const [wx, wz] = turn(x, a + 0.003, ry);
      b.box(0.034, yy < y0 + 0.1 ? 0.06 : 0.032, 0.006, win, wx, yy, wz, [0, ry, 0]);
    }
    // the porch: its floor, four columns, the beam, the pediment, the steps
    const [fx, fz] = turn(0, a + 0.06, ry);
    b.box(0.25, 0.04, 0.12, stone2M, fx, y0 + 0.02, fz, [0, ry, 0]);
    for (let i = 0; i < 4; i++) { const [cx, cz] = turn(-0.09 + i * 0.06, a + 0.095, ry); column(b, cx, cz, y0 + 0.04, 0.12, 0.0095, stoneM, trimM); }
    const [ex, ez] = turn(0, a + 0.06, ry);
    b.box(0.25, 0.02, 0.12, stone2M, ex, y0 + 0.17, ez, [0, ry, 0]);
    pediment(b, 0.26, 0.055, 0.12, y0 + 0.18, a + 0.06, stoneM, ry);
    const [gx, gz] = turn(0, a + 0.115, ry);
    figure(b, gx, y0 + 0.235, gz, 0.035, stoneM);
    for (let k = 0; k < 3; k++) { const [kx, kz] = turn(0, a + 0.13 + k * 0.025, ry); b.box(0.2, 0.04 - k * 0.013, 0.025, stone2M, kx, y0 + (0.04 - k * 0.013) / 2, kz, [0, ry, 0]); }
  }
  // the low roof, its drum, the dome, the lantern
  const roof = new THREE.ConeGeometry(a * Math.SQRT2 + 0.01, 0.06, 4); roof.rotateY(Math.PI / 4); roof.translate(0, y0 + bh + 0.014 + 0.03, 0);
  b.geo(roof, std(t.accent, { roughness: 0.6 }));
  const dy = y0 + bh + 0.044;
  b.cyl(0.11, 0.11, 0.03, 32, stoneM, 0, dy + 0.015, 0);
  b.geo(domeGeo(0.108, 0.55, dy + 0.03), std(t.accent, { roughness: 0.45, metalness: 0.25 }));
  const top = dy + 0.03 + 0.108 * 0.55;
  b.cyl(0.018, 0.02, 0.03, 10, litGlass(t.glass, "#ffe6c0", 0.05, 1.1), 0, top + 0.012, 0);
  b.geo(domeGeo(0.024, 0.8, top + 0.027), std(t.accent, { roughness: 0.45, metalness: 0.25 }));
  glowAt(b, "#ffd9a0", 0.7, 0, y0 + 0.08, 0, 0.3);
  return done(b, top + 0.05);
}

/* 5. Open rotunda (the Palace of Fine Arts' way): an island in a round
   pool, sixteen tall columns in pairs carrying a ring and a dome open
   beneath, and under it, on a plinth, the head itself; at night the
   columns lit from their feet, the head lit, the water glowing. */
function openRotunda(side) {
  const t = tones(side), b = mk(side, "open");
  const stoneM = std(t.stone, { roughness: 0.66 }), stone2M = std(t.stone2, { roughness: 0.72 }), trimM = capM(t);
  b.geo(lathe([[R - 0.03, 0], [R, 0], [R, 0.034], [R - 0.008, 0.04], [R - 0.03, 0.034], [R - 0.03, 0.01]], 64), stone2M);
  const water = glassy(new THREE.MeshStandardMaterial({ color: col("#5d8299"), roughness: 0.08, metalness: 0.55, emissive: col("#7cc0f0"), emissiveIntensity: 0 }));
  TIMED.add((n) => { water.emissiveIntensity = 0.2 * n; });
  b.cyl(R - 0.03, R - 0.03, 0.026, 64, water, 0, 0.013, 0);
  const y0 = steps(b, [[0.285, 0.03], [0.265, 0.02]], stone2M);
  const ch = 0.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    for (const d of [-0.085, 0.085]) { const aa = a + d; column(b, Math.sin(aa) * 0.235, Math.cos(aa) * 0.235, y0, ch, 0.0105, stoneM, trimM); }
    glowAt(b, "#ffe2b8", 0.2, Math.sin(a) * 0.235, y0 + 0.03, Math.cos(a) * 0.235, 0.55);
  }
  const ey = y0 + ch;
  b.geo(lathe([[0.205, ey], [0.262, ey], [0.262, ey + 0.03], [0.205, ey + 0.03], [0.205, ey]], 56), stone2M);
  b.geo(domeGeo(0.245, 0.78, ey + 0.03), new THREE.MeshStandardMaterial({ color: col(t.accent), roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
  domeRibs(b, 8, 0.245, 0.78, ey + 0.03, 0.005, trimM, TAU / 16);
  const top = ey + 0.03 + 0.245 * 0.78;
  b.geo(sphereAt(0.02, 0, top + 0.012, 0, 10, 8), trimM);
  // the head, on its plinth, lit at night
  b.box(0.07, 0.06, 0.07, stone2M, 0, y0 + 0.03, 0);
  const headM = new THREE.MeshStandardMaterial({ color: col(t.L ? "#f1eee7" : "#4c5966"), roughness: t.L ? 0.4 : 0.32, metalness: t.L ? 0 : 0.7, emissive: col("#fff0d8"), emissiveIntensity: 0 });
  if (!t.L) glassy(headM);
  TIMED.add((n) => { headM.emissiveIntensity = (t.L ? 0.2 : 0.14) * n; });
  const hg = headGeo(); hg.scale(0.045, 0.055, 0.05); hg.translate(0, y0 + 0.06 + 0.055, 0);
  b.geo(hg, headM);
  glowAt(b, "#ffe8c8", 0.3, 0, y0 + 0.1, 0, 0.5);
  return done(b, top + 0.03);
}

/* 6. Glass dome (the Reichstag's way): a stone hall, two floors of
   windows, a roof terrace and its rail; on it a dome of glass ribbed and
   ringed in steel, two ramps spiralling up inside it round a cone of
   mirrors; at night the dome lit from within. */
function glassDome(side) {
  const t = tones(side), b = mk(side, "glassdome");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.72 }), trimM = capM(t);
  const steel = std(t.L ? "#e9ecee" : "#9aa6b0", { roughness: 0.35, metalness: 0.55 });
  const y0 = steps(b, [[R, 0.02]], stone2M);
  const hr = 0.36, hh = 0.14;
  b.cyl(hr, hr, hh, 64, stoneM, 0, y0 + hh / 2, 0);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 0.9);
  drumWindows(b, 24, hr, y0 + 0.038, 0.03, 0.04, win);
  drumWindows(b, 24, hr, y0 + 0.095, 0.03, 0.04, win);
  b.cyl(hr + 0.01, hr + 0.01, 0.014, 64, stone2M, 0, y0 + hh + 0.007, 0);
  const ty = y0 + hh + 0.014;
  b.geo(new THREE.TorusGeometry(hr - 0.004, 0.003, 4, 72).rotateX(Math.PI / 2).translate(0, ty + 0.022, 0), steel);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; b.cyl(0.002, 0.002, 0.022, 4, steel, Math.sin(a) * (hr - 0.004), ty + 0.011, Math.cos(a) * (hr - 0.004)); }
  const dr = 0.2;
  b.cyl(dr + 0.012, dr + 0.012, 0.012, 48, stone2M, 0, ty + 0.006, 0);
  const domeY = ty + 0.012;
  const glass = litGlass(t.glass, "#ffe6c0", 0.02, 0.32, { transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.05, side: THREE.DoubleSide });
  b.geo(domeGeo(dr, 1, domeY, 0.16), glass);
  domeRibs(b, 24, dr, 1, domeY, 0.0028, steel, 0, 0.16);
  for (const th of [1.32, 1.08, 0.84, 0.6, 0.38]) domeRing(b, dr, 1, domeY, th, 0.0026, steel);
  domeRing(b, dr, 1, domeY, 0.16, 0.006, steel);
  // inside: the cone of mirrors, point down; the two ramps
  const mirror = glassy(new THREE.MeshStandardMaterial({ color: col("#cfd6dc"), metalness: 1, roughness: 0.12, emissive: col("#ffe2b8"), emissiveIntensity: 0 }));
  TIMED.add((n) => { mirror.emissiveIntensity = 0.5 * n; });
  const cone = new THREE.ConeGeometry(0.07, 0.17, 24); cone.rotateX(Math.PI); cone.translate(0, domeY + 0.09, 0);
  b.geo(cone, mirror);
  for (const a0 of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const s = i / 64, yy = 0.012 + s * 0.15, rr = Math.sqrt(Math.max(0, dr * dr - yy * yy)) * 0.88, a = a0 + s * 2.2 * Math.PI;
      pts.push(new THREE.Vector3(Math.sin(a) * rr, domeY + yy, Math.cos(a) * rr));
    }
    b.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.005, 4), steel);
  }
  glowAt(b, "#ffe6c0", 0.55, 0, domeY + 0.09, 0, 0.45);
  return done(b, domeY + dr * Math.cos(0.16) + 0.006);
}

/* 7. Art Deco: a drum of fins with tall windows between, set back twice,
   four clock faces round the second (telling the hour the city's at), a
   stepped crown with a lit band and a beacon. */
function deco(side) {
  const t = tones(side), b = mk(side, "deco");
  const stoneM = std(t.stone, { roughness: 0.62 }), stone2M = std(t.stone2, { roughness: 0.66 }), trimM = capM(t);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 1.0);
  const y0 = steps(b, [[R, 0.02], [R * 0.9, 0.02]], stone2M);
  const tiers = [[0.29, 0.2, 20], [0.225, 0.07, 16], [0.165, 0.11, 0]];
  let y = y0;
  for (const [r, h, fins] of tiers) {
    b.cyl(r - 0.01, r - 0.01, h, 48, fins ? win : stoneM, 0, y + h / 2, 0);
    if (fins) for (let i = 0; i < fins; i++) { const a = (i / fins) * TAU; b.box(0.022, h, 0.03, stoneM, Math.sin(a) * (r - 0.012), y + h / 2, Math.cos(a) * (r - 0.012), [0, a, 0]); }
    if (fins) b.cyl(r - 0.005, r - 0.005, 0.018, 48, stoneM, 0, y + 0.009, 0);
    b.cyl(r + 0.004, r + 0.004, 0.014, 48, stone2M, 0, y + h - 0.007, 0);
    y += h;
  }
  // four clock faces round the last
  const ft = clockFace(), face = new THREE.MeshStandardMaterial({ map: ft, emissive: col("#fff2d8"), emissiveMap: ft, emissiveIntensity: 0.02, roughness: 0.4 });
  TIMED.add((n) => { face.emissiveIntensity = 0.02 + 0.85 * n; });
  const cs = 0.088, cy = y - 0.11 / 2 - 0.005, cr = 0.165;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU, g = new THREE.PlaneGeometry(cs, cs);
    g.rotateY(a); g.translate(Math.sin(a) * (cr + 0.012), cy, Math.cos(a) * (cr + 0.012));
    b.geo(g, face);
    b.box(cs + 0.016, cs + 0.016, 0.012, trimM, Math.sin(a) * (cr + 0.004), cy, Math.cos(a) * (cr + 0.004), [0, a, 0]);
  }
  // the crown: stepped, a lit band, the beacon
  const band = litMat(t.L ? "#e8edf0" : "#7e8e9a", "#ffe6c0", 0.06, 1.6);
  b.cyl(0.13, 0.13, 0.016, 40, stone2M, 0, y + 0.008, 0);
  b.cyl(0.1, 0.1, 0.02, 40, band, 0, y + 0.026, 0);
  b.cyl(0.085, 0.085, 0.016, 40, stoneM, 0, y + 0.044, 0);
  b.cyl(0.05, 0.06, 0.03, 24, stone2M, 0, y + 0.067, 0);
  const beacon = litMat("#f2efe6", "#fff0d0", 0.2, 2.2);
  b.geo(sphereAt(0.018, 0, y + 0.094, 0, 12, 10), beacon);
  glowAt(b, "#fff0d0", 0.22, 0, y + 0.094, 0, 0.85);
  return done(b, y + 0.112);
}

/* 8. Concrete (the Brutalists' way): board-marked concrete, the hall a
   ring of deep piers with its glass set back between them, a heavy ring
   overhanging it with small deep windows, a shallow coffered dome. */
function boardTex(L) {
  const c = cv(8, 128), x = c.getContext("2d");
  x.fillStyle = L ? "#e3e1db" : "#66737f"; x.fillRect(0, 0, 8, 128);
  for (let i = 0; i < 16; i++) { x.fillStyle = L ? (i % 2 ? "#d9d7d0" : "#e8e6e0") : (i % 2 ? "#5e6b77" : "#6b7884"); x.fillRect(0, i * 8, 8, 7); }
  return tex(c);
}
function concrete(side) {
  const t = tones(side), b = mk(side, "concrete");
  const board = new THREE.MeshStandardMaterial({ map: boardTex(t.L), roughness: 0.92 });
  const plain = std(t.L ? "#dddbd4" : "#5f6c78", { roughness: 0.9 }), dark = std(t.L ? "#c9c6be" : "#4f5b66", { roughness: 0.9 });
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 1.0);
  b.cyl(R, R, 0.03, 64, dark, 0, 0.015, 0);
  const y0 = 0.03, h = 0.16;
  b.cyl(0.235, 0.235, h, 48, win, 0, y0 + h / 2, 0);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; b.box(0.052, h, 0.06, board, Math.sin(a) * 0.262, y0 + h / 2, Math.cos(a) * 0.262, [0, a, 0]); }
  // the overhanging ring, its deep little windows
  const ry = y0 + h, rh = 0.06;
  b.cyl(0.37, 0.35, rh, 64, board, 0, ry + rh / 2, 0);
  drumWindows(b, 36, 0.362, ry + rh * 0.5, 0.018, 0.026, win, 0, 0.01);
  for (let i = 0; i < 36; i++) { const a = ((i + 0.5) / 36) * TAU; b.box(0.012, rh, 0.022, plain, Math.sin(a) * 0.365, ry + rh / 2, Math.cos(a) * 0.365, [0, a, 0]); }
  // the dome: shallow, coffered
  const top = ry + rh, rs = 0.48, th = 0.66, cy = top - rs * Math.cos(th);
  const cap = new THREE.SphereGeometry(rs, 48, 10, 0, TAU, 0, th); cap.translate(0, cy, 0);
  b.geo(cap, plain);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.TorusGeometry(rs + 0.003, 0.007, 4, 16, th - 0.05);
    g.rotateZ(Math.PI / 2 - th); g.rotateY((i / 16) * TAU); g.translate(0, cy, 0);
    b.geo(g, dark);
  }
  for (const f of [0.35, 0.62, 0.9]) { const a = th * f; b.geo(new THREE.TorusGeometry(rs * Math.sin(a) + 0.003, 0.007, 4, 56).rotateX(Math.PI / 2).translate(0, cy + rs * Math.cos(a), 0), dark); }
  b.cyl(0.05, 0.05, 0.016, 24, litMat("#3a4148", "#ffe0b0", 0.02, 1.2), 0, cy + rs + 0.004, 0);
  // the way in: a slab of a canopy on two blades
  b.box(0.16, 0.014, 0.1, plain, 0, y0 + 0.1, 0.31);
  for (const x of [-0.07, 0.07]) b.box(0.012, 0.1, 0.09, board, x, y0 + 0.05, 0.31);
  for (const x of [-0.13, 0.13]) flag(b, t, x, 0.03, 0.36, 0.17);
  glowAt(b, "#ffd9a0", 0.7, 0, y0 + 0.08, 0, 0.3);
  return done(b, cy + rs + 0.012);
}

/* 9. Green roof: a glass hall under a planted dome, a path spiralling up
   it to the trees on top, lamps along the path at night. */
function greenRoof(side) {
  const t = tones(side), b = mk(side, "green");
  const stone2M = std(t.stone2, { roughness: 0.72 }), trimM = capM(t), pathM = std(t.L ? "#f4f2ec" : "#8a9aa6", { roughness: 0.8 });
  const y0 = steps(b, [[R, 0.02]], stone2M);
  const hr = 0.33, hh = 0.11;
  b.cyl(hr, hr, hh, 64, litGlass(t.glass, "#ffd9a0", 0.06, 0.9), 0, y0 + hh / 2, 0);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; b.box(0.006, hh, 0.008, trimM, Math.sin(a) * hr, y0 + hh / 2, Math.cos(a) * hr, [0, a, 0]); }
  b.cyl(hr + 0.012, hr + 0.012, 0.016, 64, trimM, 0, y0 + hh + 0.008, 0);
  const domeY = y0 + hh + 0.016, dr = 0.335, k = 0.6;
  b.geo(domeGeo(dr, k, domeY), std("#6f9a52", { roughness: 0.96 }));
  // the path: two and a half turns up, a little proud of the grass
  const pts = [], P = (th, a, off = 0.006) => new THREE.Vector3(Math.sin(th) * Math.sin(a) * (dr + off), domeY + k * (dr + off) * Math.cos(th), Math.sin(th) * Math.cos(a) * (dr + off));
  for (let i = 0; i <= 90; i++) { const s = i / 90; pts.push(P(Math.PI / 2 - 0.05 - s * 1.2, s * 2.5 * TAU)); }
  b.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0075, 4), pathM);
  const lamp = litMat("#f6f0e2", "#ffd9a0", 0.05, 2.0);
  for (let i = 1; i < 9; i++) { const s = i / 9, v = P(Math.PI / 2 - 0.05 - s * 1.2, s * 2.5 * TAU + 0.12, 0.018); b.geo(sphereAt(0.006, v.x, v.y, v.z, 6, 4), lamp); glowAt(b, "#ffd9a0", 0.06, v.x, v.y, v.z, 0.8); }
  // the trees: a ring of four and one on top
  const trunk = std("#7a6a58", { roughness: 0.9 }), leaf = std("#4f7a3e", { roughness: 0.95 }), leaf2 = std("#5d8a47", { roughness: 0.95 });
  const tree = (th, a, s, m) => { const v = P(th, a, 0); b.cyl(0.005 * s, 0.006 * s, 0.03 * s, 5, trunk, v.x, v.y + 0.015 * s, v.z); b.geo(sphereAt(0.028 * s, v.x, v.y + 0.045 * s, v.z, 10, 8), m); };
  tree(0, 0, 1.25, leaf);
  for (let i = 0; i < 4; i++) tree(0.62, (i / 4) * TAU + 0.5, 0.9, i % 2 ? leaf : leaf2);
  return done(b, domeY + dr * k + 0.07);
}

/* 10. Council saucer (the mid-century way, Toronto's): a podium with a
   ribbon of windows, its plaza; a saucer raised on a stem, its rim a band
   of glass lit at night; two curved wings of unequal height round it,
   concrete without and glass within. */
function saucer(side) {
  const t = tones(side), b = mk(side, "saucer");
  const stoneM = std(t.stone, { roughness: 0.6 }), stone2M = std(t.stone2, { roughness: 0.7 }), trimM = capM(t);
  const win = litGlass(t.glass, "#ffd9a0", 0.05, 0.95);
  b.cyl(R, R, 0.022, 64, stone2M, 0, 0.011, 0);
  b.cyl(R - 0.012, R - 0.012, 0.018, 64, win, 0, 0.031, 0);
  b.cyl(R, R, 0.012, 64, stoneM, 0, 0.046, 0);
  const py = 0.052;
  // the wings: concrete outside, glass inside, a cap, their ends
  const wing = (r0, r1, h, p0, pl) => {
    const out = new THREE.CylinderGeometry(r1, r1, h, 28, 1, true, p0, pl); out.translate(0, py + h / 2, 0); b.geo(out, std(t.L ? "#eeede8" : "#55626e", { roughness: 0.75, side: THREE.DoubleSide }));
    const inn = new THREE.CylinderGeometry(r0, r0, h, 28, 1, true, p0, pl); inn.translate(0, py + h / 2, 0); b.geo(inn, litGlass(t.glass, "#ffd9a0", 0.05, 0.85, { side: THREE.DoubleSide }));
    const cap = new THREE.RingGeometry(r0, r1, 28, 1, p0 - Math.PI / 2, pl); cap.rotateX(-Math.PI / 2); cap.translate(0, py + h, 0); b.geo(cap, stone2M);
    for (const p of [p0, p0 + pl]) b.box(0.006, h, r1 - r0, stone2M, Math.sin(p) * (r0 + r1) / 2, py + h / 2, Math.cos(p) * (r0 + r1) / 2, [0, p, 0]);
    for (let i = 1; i < 10; i++) { const p = p0 + (i / 10) * pl; b.box(0.004, h, 0.006, trimM, Math.sin(p) * (r1 + 0.002), py + h / 2, Math.cos(p) * (r1 + 0.002), [0, p, 0]); }
  };
  wing(0.36, 0.39, 0.2, -Math.PI / 2 - 0.85, 1.55);
  wing(0.36, 0.39, 0.13, Math.PI / 2 - 0.7, 1.55);
  // the stem, the saucer (up over the wings, to be seen), its band
  const rs = 0.44, th = 0.56, rim = py + 0.16, rr = rs * Math.sin(th), under = rim - 0.006 - rs * (1 - Math.cos(th));
  b.cyl(0.05, 0.065, under - py + 0.02, 24, trimM, 0, py + (under - py + 0.02) / 2, 0);
  const up = new THREE.SphereGeometry(rs, 48, 8, 0, TAU, 0, th); up.translate(0, rim + 0.006 - rs * Math.cos(th), 0);
  b.geo(up, std(t.L ? "#f6f5f0" : t.F.walls[2], { roughness: 0.45 }));
  const down = new THREE.SphereGeometry(rs, 48, 8, 0, TAU, 0, th); down.rotateX(Math.PI); down.translate(0, rim - 0.006 + rs * Math.cos(th), 0);
  b.geo(down, std(t.L ? "#e4e3dd" : t.F.walls[3], { roughness: 0.55 }));
  b.cyl(rr + 0.002, rr + 0.002, 0.012, 64, litGlass(t.glass, "#ffe6c0", 0.08, 1.1), 0, rim, 0);
  glowAt(b, "#ffe6c0", 0.6, 0, rim, 0, 0.35);
  flag(b, t, 0.2, py, 0.32, 0.2);
  return done(b, Math.max(rim + 0.006 + rs * (1 - Math.cos(th)), py + 0.2));
}

/* ------------------------------------------------------------ the list */

export const ROTUNDAS = [
  { id: "tempietto", name: "Rotunda: Tempietto", make: tempietto },
  { id: "pantheon", name: "Rotunda: Pantheon", make: pantheon },
  { id: "capitol", name: "Rotunda: Capitol", make: capitol },
  { id: "palladian", name: "Rotunda: Palladian", make: palladian },
  { id: "openrotunda", name: "Rotunda: open, over a pool", make: openRotunda },
  { id: "glassdome", name: "Rotunda: glass dome", make: glassDome },
  { id: "deco", name: "Rotunda: Art Deco clock", make: deco },
  { id: "concrete", name: "Rotunda: concrete", make: concrete },
  { id: "greenroof", name: "Rotunda: green roof", make: greenRoof },
  { id: "saucer", name: "Rotunda: council saucer", make: saucer },
];
