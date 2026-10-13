/* The city's Cabeza (user: "What is the Cabeza piece for the city maps
   supposed to be? Give me 10 other city appropriate options"; then "Show me
   the 10 options for the city's cabeza"): the round glass pavilion it is
   now, and the ten. Each keeps to its one square, low and round as the
   standard game's disc is, in its side's colours (Chalk's whites, Slate's
   grey-blues), and lit at night. ?cabeza=<name> plays with one. The
   rotunda's ten (user: "Give me 10 different City Hall Rotunda Cabeza
   Piece design options") are in ciudad-rotundas.js, listed after it; the
   sixth, the glass dome, is the one played (user: "The cabeza for city
   maps themes will be number 6, glass dome").

   Made as the buildings are (ciudad-models.js builder: the parts merged
   by material); what turns or tells the time is a mesh of its own. */

import * as THREE from "three";
import { FAMILY, builder, std, col, glassy, TIMED, cv, tex, cellPx, seedOf } from "./ciudad-models.js";
import { R, tones, mk, litGlass, litMat, rodGeo, lathe, sphereAt, glowAt, done, mergeAll, headGeo, clockFace } from "./ciudad-cabeza-kit.js";
import { ROTUNDAS } from "./ciudad-rotundas.js";

/* ------------------------------------------------------------ the eleven */

/* The glass pavilion (the first played): a glass drum under a flat disc
   roof, twelve thin columns round it, the light inside. */
function pavilion(side) {
  const F = FAMILY[side], b = builder(seedOf(`cab-${side}`), "midmod", F, side, cellPx()), r = R, h = 0.128;
  const slab = side === "light" ? F.slab : F.walls[0];
  b.cyl(r * 0.98, r, 0.04, 48, std(slab, { roughness: 0.6 }), 0, 0.02, 0);
  const glass = litGlass(F.glasses[0], "#ffe0b0", 0.12, 0.68, { roughness: 0.08, metalness: 0.5 });
  b.cyl(r * 0.78, r * 0.78, h, 48, glass, 0, 0.04 + h / 2, 0);
  const colM = std(slab, { roughness: 0.5 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.cyl(0.01, 0.01, h, 8, colM, Math.cos(a) * r * 0.9, 0.04 + h / 2, Math.sin(a) * r * 0.9); }
  b.cyl(r * 1.05, r * 1.05, 0.035, 56, std(F.accents[0], { roughness: 0.5 }), 0, 0.04 + h + 0.0175, 0);
  return done(b, 0.04 + h + 0.035);
}

/* 1. City hall rotunda: two steps, a drum with tall windows (lit at
   night) and pilasters between, a cornice, a shallow dome in the side's
   accent, a lit lantern, a flag in the side's colour. */
function rotunda(side) {
  const t = tones(side), b = mk(side, "rotunda");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.7 }), domeM = std(t.accent, { roughness: 0.42, metalness: 0.35 });
  b.cyl(R, R, 0.03, 56, stone2M, 0, 0.015, 0);
  b.cyl(R * 0.88, R * 0.88, 0.03, 56, stoneM, 0, 0.045, 0);
  const dr = R * 0.68, dh = 0.17, y0 = 0.06;
  b.cyl(dr, dr, dh, 48, stoneM, 0, y0 + dh / 2, 0);
  const win = litGlass(t.glass, "#ffd9a0", 0.03, 0.95);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, a2 = a + Math.PI / 12;
    b.box(0.042, 0.105, 0.012, win, Math.sin(a) * dr, y0 + 0.078, Math.cos(a) * dr, [0, a, 0]);
    b.box(0.016, dh - 0.016, 0.014, stone2M, Math.sin(a2) * (dr + 0.004), y0 + dh / 2, Math.cos(a2) * (dr + 0.004), [0, a2, 0]);
  }
  b.cyl(dr + 0.03, dr + 0.03, 0.024, 48, stone2M, 0, y0 + dh + 0.012, 0);
  const dome = new THREE.SphereGeometry(dr * 0.97, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.6, 1); dome.translate(0, y0 + dh + 0.024, 0);
  b.geo(dome, domeM);
  const top = y0 + dh + 0.024 + dr * 0.97 * 0.6;
  b.cyl(0.036, 0.04, 0.05, 16, litGlass(t.glass, "#ffe6c0", 0.05, 1.1), 0, top + 0.02, 0);
  b.cyl(0.048, 0.048, 0.012, 16, stone2M, 0, top + 0.05, 0);
  const cap = new THREE.SphereGeometry(0.042, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(0, top + 0.056, 0);
  b.geo(cap, domeM);
  b.cyl(0.004, 0.004, 0.2, 6, std("#9aa0a6", { metalness: 0.6, roughness: 0.4 }), 0, top + 0.16, 0);
  b.box(0.085, 0.05, 0.004, std(t.L ? "#f6f4ee" : "#5a6a78", { roughness: 0.9 }), 0.045, top + 0.232, 0);
  glowAt(b, "#ffd9a0", 0.9, 0, y0 + 0.08, 0, 0.32);
  return done(b, top + 0.26);
}

/* 2. Bandstand: an eight-sided platform, eight slim posts, a rail with
   balusters (open at the steps), a peaked eight-sided roof, bulbs along
   the eaves that light at night. */
function bandstand(side) {
  const t = tones(side), b = mk(side, "band");
  const oct = (r, h, y, m) => { const g = new THREE.CylinderGeometry(r, r, h, 8); g.rotateY(Math.PI / 8); g.translate(0, y, 0); b.geo(g, m); };
  const postM = std(t.trim, { roughness: 0.5 }), stone2M = std(t.stone2, { roughness: 0.75 });
  oct(R * 0.99, 0.03, 0.015, stone2M);
  oct(R * 0.9, 0.05, 0.055, std(t.stone, { roughness: 0.7 }));
  const y0 = 0.08, ph = 0.17, pr = R * 0.8, corner = (i) => (i / 8) * Math.PI * 2 + Math.PI / 8;
  for (let i = 0; i < 8; i++) b.cyl(0.011, 0.011, ph, 8, postM, Math.cos(corner(i)) * pr, y0 + ph / 2, Math.sin(corner(i)) * pr);
  for (let i = 0; i < 8; i++) {
    if (i === 1) continue; // the opening, over the steps
    const p0 = [Math.cos(corner(i)) * pr, Math.sin(corner(i)) * pr], p1 = [Math.cos(corner(i + 1)) * pr, Math.sin(corner(i + 1)) * pr];
    b.geo(rodGeo([p0[0], y0 + 0.058, p0[1]], [p1[0], y0 + 0.058, p1[1]], 0.005, 4), postM);
    for (let k = 1; k < 5; k++) { const f = k / 5; b.box(0.005, 0.056, 0.005, postM, p0[0] + (p1[0] - p0[0]) * f, y0 + 0.028, p0[1] + (p1[1] - p0[1]) * f); }
  }
  // the steps up, at the opening
  const sa = (corner(1) + corner(2)) / 2;
  for (let k = 0; k < 2; k++) b.box(0.13, 0.026, 0.05, stone2M, Math.cos(sa) * (R * 0.92 + k * 0.035), 0.013 + (1 - k) * 0.026, Math.sin(sa) * (R * 0.92 + k * 0.035), [0, -sa + Math.PI / 2, 0]);
  oct(R * 0.99, 0.02, y0 + ph + 0.002, postM);
  const roof = new THREE.ConeGeometry(R * 0.99, 0.13, 8); roof.rotateY(Math.PI / 8); roof.translate(0, y0 + ph + 0.012 + 0.065, 0);
  b.geo(roof, std(t.accent, { roughness: 0.6 }));
  b.cyl(0.003, 0.012, 0.06, 6, std("#c8c2b4", { metalness: 0.6, roughness: 0.35 }), 0, y0 + ph + 0.142 + 0.03, 0);
  // the bulbs strung along the eaves' outer edge (seen from above too)
  const bulb = litMat("#f4ead8", "#ffd08a", 0.08, 2.4), Rc = R * 0.99;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8, a1 = a0 + Math.PI / 4, am = (a0 + a1) / 2, off = 0.007;
    for (let k = 0; k < 4; k++) {
      const f = k / 4, x = Math.cos(a0) * Rc * (1 - f) + Math.cos(a1) * Rc * f + Math.cos(am) * off, z = Math.sin(a0) * Rc * (1 - f) + Math.sin(a1) * Rc * f + Math.sin(am) * off;
      b.geo(sphereAt(0.0075, x, y0 + ph + 0.002, z, 6, 4), bulb);
    }
  }
  glowAt(b, "#ffd08a", 0.95, 0, y0 + ph * 0.55, 0, 0.42);
  return done(b, y0 + ph + 0.2);
}

/* 3. Carousel: a round platform, a wooden floor, a striped canopy and
   valance, a ring of horses on brass poles going slowly round, bulbs
   under the valance at night. */
function stripes(a, c, n) {
  const k = cv(256, 16), x = k.getContext("2d");
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? c : a; x.fillRect((i * 256) / n, 0, 256 / n + 1, 16); }
  return tex(k);
}
function carousel(side) {
  const t = tones(side), b = mk(side, "carousel");
  const canvasM = new THREE.MeshStandardMaterial({ map: stripes(t.L ? "#ffffff" : t.stone, t.L ? t.accent : "#e9ebec", 24), roughness: 0.85, side: THREE.DoubleSide });
  const brass = std("#cdb88a", { metalness: 0.7, roughness: 0.3 });
  b.cyl(R * 0.99, R * 0.99, 0.035, 56, std(t.stone2, { roughness: 0.75 }), 0, 0.0175, 0);
  b.cyl(R * 0.93, R * 0.93, 0.016, 56, std(t.L ? "#d9cfbd" : "#7d8790", { roughness: 0.85 }), 0, 0.043, 0);
  const y0 = 0.051, ph = 0.16;
  b.cyl(0.034, 0.034, ph, 16, std(t.accent, { roughness: 0.5, metalness: 0.3 }), 0, y0 + ph / 2, 0);
  const val = new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.036, 48, 1, true); val.translate(0, y0 + ph + 0.018, 0);
  b.geo(val, canvasM);
  const cone = new THREE.ConeGeometry(R * 1.0, 0.13, 48, 1, true); cone.translate(0, y0 + ph + 0.036 + 0.065, 0);
  b.geo(cone, canvasM);
  b.cyl(0.006, 0.012, 0.05, 8, brass, 0, y0 + ph + 0.166 + 0.02, 0);
  const bulb = litMat("#f4ead8", "#ffd08a", 0.08, 2.4);
  // (round the canopy's rim, seen from above too, and under the valance)
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; b.geo(sphereAt(0.0072, Math.cos(a) * R * 1.0, y0 + ph + 0.04, Math.sin(a) * R * 1.0, 6, 4), bulb); }
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; b.geo(sphereAt(0.0065, Math.cos(a) * R * 0.95, y0 + ph - 0.003, Math.sin(a) * R * 0.95, 6, 4), bulb); }
  // the horses: one mesh, turning
  const poles = [], bodies = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rr2 = R * 0.66, x = Math.cos(a) * rr2, z = Math.sin(a) * rr2, up = 0.055 + (i % 2 ? 0.025 : 0);
    poles.push(rodGeo([x, y0, z], [x, y0 + ph, z], 0.0035, 5));
    const along = new THREE.Matrix4().makeRotationY(-a), place = (g, dx, dy, dz, rz = 0) => { g.rotateZ(rz); g.translate(dx, dy, dz); g.applyMatrix4(along); g.translate(x, y0 + up, z); bodies.push(g); };
    // (the body runs along the ring: its length on the local z)
    place(new THREE.BoxGeometry(0.022, 0.03, 0.07), 0, 0, 0);
    place(new THREE.BoxGeometry(0.016, 0.042, 0.018), 0, 0.03, 0.03, 0);
    place(new THREE.BoxGeometry(0.014, 0.016, 0.03), 0, 0.05, 0.042);
    for (const [lx, lz] of [[-0.007, -0.026], [0.007, -0.026], [-0.007, 0.026], [0.007, 0.026]]) place(new THREE.BoxGeometry(0.006, 0.04, 0.006), lx, -0.03, lz);
  }
  const ring = new THREE.Group();
  const pm = new THREE.Mesh(mergeAll(poles), brass), hm = new THREE.Mesh(mergeAll(bodies), std(t.L ? "#fbfaf6" : "#dfe3e6", { roughness: 0.45 }));
  for (const m of [pm, hm]) { m.raycast = () => {}; m.castShadow = false; ring.add(m); }
  // (turned as it's drawn: a full turn in about 25 s)
  const turn = function () { ring.rotation.y = performance.now() * 0.00025; ring.updateMatrix(); ring.matrixWorld.multiplyMatrices(ring.parent.matrixWorld, ring.matrix); for (const m of ring.children) m.matrixWorld.multiplyMatrices(ring.matrixWorld, m.matrix); };
  pm.onBeforeRender = turn;
  b.extra(ring);
  glowAt(b, "#ffd08a", 1.0, 0, y0 + ph * 0.6, 0, 0.4);
  return done(b, y0 + ph + 0.21);
}

/* 4. The head itself: a round fountain, a giant head on a plinth in it
   (Chalk's in white stone, Slate's in grey-blue bronze), six jets arching
   in from the rim, the water and the head lit from below at night. */
function head(side) {
  const t = tones(side), b = mk(side, "head");
  const stoneM = std(t.stone, { roughness: 0.6 }), stone2M = std(t.stone2, { roughness: 0.7 });
  b.geo(lathe([[R - 0.036, 0], [R, 0], [R, 0.07], [R - 0.012, 0.078], [R - 0.036, 0.07], [R - 0.036, 0.022]]), stoneM);
  const water = glassy(new THREE.MeshStandardMaterial({ color: col("#5d8299"), roughness: 0.08, metalness: 0.55, emissive: col("#7cc0f0"), emissiveIntensity: 0 }));
  TIMED.add((n) => { water.emissiveIntensity = 0.22 * n; });
  b.cyl(R - 0.036, R - 0.036, 0.05, 56, water, 0, 0.035, 0);
  b.box(0.17, 0.1, 0.17, stone2M, 0, 0.11, 0);
  b.box(0.19, 0.016, 0.19, stoneM, 0, 0.168, 0);
  // (lit from below at night; its own material, the light its own)
  const headM = t.L
    ? new THREE.MeshStandardMaterial({ color: col("#f1eee7"), roughness: 0.38, emissive: col("#fff0d8"), emissiveIntensity: 0 })
    : glassy(new THREE.MeshStandardMaterial({ color: col("#4c5966"), roughness: 0.34, metalness: 0.78, emissive: col("#cfe0f4"), emissiveIntensity: 0 }));
  TIMED.add((n) => { headM.emissiveIntensity = (t.L ? 0.16 : 0.12) * n; });
  b.cyl(0.046, 0.056, 0.05, 20, headM, 0, 0.176 + 0.025, 0);
  const hg = headGeo(); hg.scale(0.125, 0.152, 0.14);
  hg.translate(0, 0.176 + 0.045 + 0.152, 0);
  b.geo(hg, headM);
  const spray = new THREE.MeshStandardMaterial({ color: col("#dcebf4"), roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false, emissive: col("#9fd4ff"), emissiveIntensity: 0 });
  TIMED.add((n) => { spray.emissiveIntensity = 0.6 * n; });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(c * (R - 0.045), 0.075, s * (R - 0.045)), new THREE.Vector3(c * 0.25, 0.28, s * 0.25), new THREE.Vector3(c * 0.12, 0.07, s * 0.12));
    b.geo(new THREE.TubeGeometry(curve, 14, 0.0045, 5), spray);
  }
  glowAt(b, "#a8d8ff", 0.8, 0, 0.08, 0, 0.3);
  return done(b, 0.176 + 0.045 + 0.152 * 2.1);
}

/* 5. Planetarium: a white dome (Slate's grey-blue) on a low drum with a
   glass band, the observing slit up its side lit at night, a canopy over
   the door. */
function planetarium(side) {
  const t = tones(side), b = mk(side, "planet");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.75 }), trimM = std(t.trim, { roughness: 0.5 });
  b.cyl(R * 0.97, R * 0.99, 0.024, 56, stone2M, 0, 0.012, 0);
  const dr = R * 0.74;
  b.cyl(dr + 0.014, dr + 0.014, 0.05, 56, stoneM, 0, 0.024 + 0.025, 0);
  b.cyl(dr + 0.016, dr + 0.016, 0.02, 56, litGlass(t.glass, "#ffe0b0", 0.08, 0.85), 0, 0.024 + 0.022, 0);
  const dome = new THREE.SphereGeometry(dr, 56, 24, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, 0.074, 0);
  b.geo(dome, std(t.L ? "#f5f4ef" : t.F.walls[2], { roughness: 0.32, metalness: 0.12 }));
  const slit = new THREE.SphereGeometry(dr + 0.003, 4, 18, Math.PI * 0.75 - 0.075, 0.15, 0.04, Math.PI / 2 - 0.08); slit.translate(0, 0.074, 0);
  b.geo(slit, litMat("#252b33", "#ffd9a0", 0, 1.8, { roughness: 0.3 }));
  b.cyl(0.03, 0.03, 0.012, 16, trimM, 0, 0.074 + dr + 0.004, 0);
  // the door's canopy, toward the front
  b.box(0.13, 0.012, 0.075, trimM, 0, 0.088, dr + 0.045);
  b.cyl(0.004, 0.004, 0.064, 6, trimM, -0.055, 0.056, dr + 0.075); b.cyl(0.004, 0.004, 0.064, 6, trimM, 0.055, 0.056, dr + 0.075);
  b.box(0.07, 0.05, 0.006, litGlass(t.glass, "#ffe0b0", 0.12, 0.9), 0, 0.049, dr + 0.012);
  return done(b, 0.074 + dr + 0.01);
}

/* 6. Clock kiosk: a round newsstand, its window lit, a flat roof, and up
   on a post a four-faced clock that tells the hour the city's at (the
   time of day picked; its faces lit at night). */
function kiosk(side) {
  const t = tones(side), b = mk(side, "kiosk");
  const stoneM = std(t.stone, { roughness: 0.7 }), stone2M = std(t.stone2, { roughness: 0.75 }), trimM = std(t.trim, { roughness: 0.5 }), roofM = std(t.accent, { roughness: 0.55, metalness: 0.2 });
  b.cyl(R * 0.8, R * 0.82, 0.024, 48, stone2M, 0, 0.012, 0);
  const kr = R * 0.56;
  b.cyl(kr, kr, 0.04, 40, stoneM, 0, 0.044, 0);
  b.cyl(kr - 0.006, kr - 0.006, 0.075, 40, litGlass(t.glass, "#ffe2b0", 0.14, 0.9), 0, 0.064 + 0.0375, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.cyl(0.004, 0.004, 0.075, 5, trimM, Math.cos(a) * (kr - 0.003), 0.1015, Math.sin(a) * (kr - 0.003)); }
  b.cyl(kr, kr, 0.032, 40, trimM, 0, 0.139 + 0.016, 0);
  b.cyl(kr + 0.05, kr + 0.04, 0.018, 40, roofM, 0, 0.171 + 0.009, 0);
  const cone = new THREE.ConeGeometry(kr + 0.02, 0.05, 40); cone.translate(0, 0.189 + 0.025, 0); b.geo(cone, roofM);
  b.cyl(0.011, 0.015, 0.1, 10, std(t.L ? "#5e6e7e" : "#2f3b47", { roughness: 0.4, metalness: 0.4 }), 0, 0.214 + 0.05, 0);
  const cs = 0.082, cy = 0.314 + cs / 2, ft = clockFace();
  const fm = new THREE.MeshStandardMaterial({ map: ft, emissive: col("#fff2d8"), emissiveMap: ft, emissiveIntensity: 0.02, roughness: 0.4 });
  TIMED.add((n) => { fm.emissiveIntensity = 0.02 + 0.85 * n; });
  const caseM = std(t.L ? "#5e6e7e" : "#2f3b47", { roughness: 0.4, metalness: 0.4 });
  const clock = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, cs), [fm, fm, caseM, caseM, fm, fm]);
  clock.position.set(0, cy, 0); clock.castShadow = true; clock.raycast = () => {};
  b.extra(clock);
  const pyr = new THREE.ConeGeometry(cs * 0.76, 0.034, 4); pyr.rotateY(Math.PI / 4); pyr.translate(0, cy + cs / 2 + 0.017, 0);
  b.geo(pyr, caseM);
  return done(b, cy + cs / 2 + 0.034);
}

/* 7. Roundabout monument: a kerbed island of grass, a gravel ring, an
   obelisk on a stepped base, low shrubs round it, a ring of lamps lit at
   night. */
function roundabout(side) {
  const t = tones(side), b = mk(side, "round");
  const stoneM = std(t.stone, { roughness: 0.6 }), stone2M = std(t.stone2, { roughness: 0.7 }), metal = std("#3a4450", { roughness: 0.45, metalness: 0.5 });
  b.geo(lathe([[R, 0], [R, 0.03], [R - 0.004, 0.036], [R - 0.03, 0.036], [R - 0.03, 0]]), std("#d6d4cc", { roughness: 0.8 }));
  b.cyl(R - 0.03, R - 0.03, 0.03, 56, std("#6f8c58", { roughness: 0.95 }), 0, 0.015, 0);
  const ring = new THREE.RingGeometry(0.19, 0.225, 56); ring.rotateX(-Math.PI / 2); ring.translate(0, 0.0305, 0); b.geo(ring, std("#d9d2c2", { roughness: 0.95 }));
  b.box(0.2, 0.024, 0.2, stone2M, 0, 0.042, 0);
  b.box(0.15, 0.04, 0.15, stoneM, 0, 0.074, 0);
  const ob = new THREE.CylinderGeometry(0.027, 0.043, 0.46, 4); ob.rotateY(Math.PI / 4); ob.translate(0, 0.094 + 0.23, 0);
  const obM = std(t.L ? "#f3f1eb" : "#4e5e6c", { roughness: t.L ? 0.45 : 0.3, metalness: t.L ? 0 : 0.2 });
  b.geo(ob, obM);
  const py = new THREE.ConeGeometry(0.027, 0.045, 4); py.rotateY(Math.PI / 4); py.translate(0, 0.094 + 0.46 + 0.0225, 0);
  b.geo(py, std(t.L ? "#c8ccc8" : "#8a9aa6", { roughness: 0.35, metalness: 0.5 }));
  const shrub = std("#4f6e43", { roughness: 0.95 });
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, g = sphereAt(0.024, Math.cos(a) * 0.3, 0.036, Math.sin(a) * 0.3, 8, 6); g.scale(1, 0.75, 1); b.geo(g, shrub); }
  const lamp = litMat("#f6f0e2", "#ffd9a0", 0.05, 2.0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * (R - 0.055), z = Math.sin(a) * (R - 0.055);
    b.cyl(0.004, 0.005, 0.1, 6, metal, x, 0.03 + 0.05, z);
    b.geo(sphereAt(0.012, x, 0.136, z, 8, 6), lamp);
    glowAt(b, "#ffd9a0", 0.14, x, 0.136, z, 0.75);
  }
  return done(b, 0.094 + 0.46 + 0.045);
}

/* 8. Water tower: a round tank on four splayed legs braced across, a
   conical roof, hoops round the tank, a catwalk at its foot; at night
   the tank washed in light from below and a red light on top. */
function waterTower(side) {
  const t = tones(side), b = mk(side, "tower");
  const steel = std(t.L ? "#6c7a86" : "#2f3b47", { roughness: 0.45, metalness: 0.55 }), roofM = std(t.accent, { roughness: 0.5, metalness: 0.3 });
  b.cyl(R * 0.82, R * 0.84, 0.022, 48, std(t.stone2, { roughness: 0.8 }), 0, 0.011, 0);
  const legTop = 0.32, foot = 0.19, head2 = 0.13;
  const leg = (i) => { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
  for (let i = 0; i < 4; i++) {
    const [c, s] = leg(i), [c2, s2] = leg(i + 1);
    b.geo(rodGeo([c * foot, 0.022, s * foot], [c * head2, legTop, s * head2], 0.011, 8), steel);
    b.box(0.03, 0.02, 0.03, std(t.stone2, { roughness: 0.8 }), c * foot, 0.032, s * foot);
    const rAt = (y) => foot + (head2 - foot) * ((y - 0.022) / (legTop - 0.022)), ra = rAt(0.06), rb = rAt(legTop - 0.03), rm = rAt(0.18);
    b.geo(rodGeo([c * ra, 0.06, s * ra], [c2 * rb, legTop - 0.03, s2 * rb], 0.004, 4), steel);
    b.geo(rodGeo([c2 * ra, 0.06, s2 * ra], [c * rb, legTop - 0.03, s * rb], 0.004, 4), steel);
    b.geo(rodGeo([c * rm, 0.18, s * rm], [c2 * rm, 0.18, s2 * rm], 0.005, 4), steel);
  }
  b.geo(rodGeo([0, 0.022, 0], [0, legTop, 0], 0.016, 8), steel);
  const tankR = 0.19, tankH = 0.19, ty = legTop + tankH / 2;
  const wash = new THREE.MeshStandardMaterial({ color: col(t.L ? "#ece8de" : "#546474"), roughness: 0.55, emissive: col("#ffe6c4"), emissiveIntensity: 0 });
  TIMED.add((n) => { wash.emissiveIntensity = 0.16 * n; });
  b.cyl(tankR, tankR, tankH, 40, wash, 0, ty, 0);
  for (const y of [legTop + 0.04, legTop + 0.095, legTop + 0.15]) b.cyl(tankR + 0.004, tankR + 0.004, 0.008, 40, roofM, 0, y, 0);
  b.cyl(tankR + 0.035, tankR + 0.035, 0.008, 40, steel, 0, legTop - 0.004, 0);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; b.cyl(0.0025, 0.0025, 0.04, 4, steel, Math.cos(a) * (tankR + 0.032), legTop + 0.016, Math.sin(a) * (tankR + 0.032)); }
  b.geo(new THREE.TorusGeometry(tankR + 0.032, 0.0025, 4, 40).rotateX(Math.PI / 2).translate(0, legTop + 0.036, 0), steel);
  const roof = new THREE.ConeGeometry(tankR + 0.014, 0.09, 40); roof.translate(0, legTop + tankH + 0.045, 0); b.geo(roof, roofM);
  const top = legTop + tankH + 0.09;
  b.cyl(0.003, 0.003, 0.05, 4, steel, 0, top + 0.025, 0);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: col("#ff2a1a") }));
  red.position.set(0, top + 0.054, 0); red.raycast = () => {}; b.extra(red);
  glowAt(b, "#ff3a28", 0.16, 0, top + 0.054, 0, 0.85);
  return done(b, top + 0.06);
}

/* 9. Subway entrance: a glass drum over the stair going down, the stair
   lit inside it, a flat roof and fascia, two green globe lamps on posts
   by the way in (lit a little by day, brightly at night). */
function stairTex() {
  const c = cv(128, 128), x = c.getContext("2d");
  x.fillStyle = "#c9c4b8"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#1c2228"; x.fillRect(30, 18, 68, 96);
  for (let i = 0; i < 9; i++) { const k = 1 - i / 10; x.fillStyle = `rgba(${Math.round(240 * k)},${Math.round(228 * k)},${Math.round(200 * k)},1)`; x.fillRect(34, 22 + i * 10, 60, 6); }
  x.fillStyle = "#8a8f94"; x.fillRect(28, 18, 3, 96); x.fillRect(97, 18, 3, 96);
  return tex(c);
}
function subway(side) {
  const t = tones(side), b = mk(side, "subway");
  const trimM = std(t.trim, { roughness: 0.5 }), roofM = std(t.accent, { roughness: 0.5, metalness: 0.25 }), metal = std("#2f3b47", { roughness: 0.4, metalness: 0.5 });
  b.cyl(R * 0.99, R * 0.99, 0.02, 56, std(t.stone2, { roughness: 0.8 }), 0, 0.01, 0);
  const dr = R * 0.56, dh = 0.15;
  const st = stairTex(), floor = new THREE.MeshStandardMaterial({ map: st, emissive: col("#ffe6c0"), emissiveMap: st, emissiveIntensity: 0.15, roughness: 0.8 });
  TIMED.add((n) => { floor.emissiveIntensity = 0.15 + 1.1 * n; });
  const disc = new THREE.CircleGeometry(dr - 0.004, 40); disc.rotateX(-Math.PI / 2); disc.translate(0, 0.0205, 0); b.geo(disc, floor);
  const glassM = litGlass(t.glass, "#ffe6c0", 0.05, 0.35, { transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.06 });
  b.cyl(dr, dr, dh, 40, glassM, 0, 0.02 + dh / 2, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.cyl(0.004, 0.004, dh, 5, trimM, Math.cos(a) * dr, 0.02 + dh / 2, Math.sin(a) * dr); }
  b.cyl(dr + 0.012, dr + 0.012, 0.026, 40, trimM, 0, 0.02 + dh + 0.013, 0);
  b.cyl(dr + 0.04, dr + 0.04, 0.014, 40, roofM, 0, 0.02 + dh + 0.033, 0);
  const globe = litMat("#4fb87e", "#5fe39a", 0.25, 1.6, { roughness: 0.25 });
  for (const sg of [-1, 1]) {
    const a = Math.PI / 2 + sg * 0.62, x = Math.cos(a) * (R - 0.06), z = Math.sin(a) * (R - 0.06);
    b.cyl(0.006, 0.008, 0.2, 8, metal, x, 0.02 + 0.1, z);
    b.geo(sphereAt(0.026, x, 0.02 + 0.2 + 0.024, z, 14, 10), globe);
    glowAt(b, "#5fe39a", 0.22, x, 0.244, z, 0.8);
  }
  return done(b, 0.02 + dh + 0.04);
}

/* 10. Little stadium: a round bowl of stands (rows of seats), the pitch
   in it, four floodlight masts in the square's corners lit at night. */
function standsTex(L) {
  // (down the slope: a row of seats, a step, the next row)
  const c = cv(8, 128), x = c.getContext("2d");
  x.fillStyle = L ? "#f2f1ec" : "#5e6e7e"; x.fillRect(0, 0, 8, 128);
  for (let i = 0; i < 10; i++) { x.fillStyle = L ? (i % 4 === 1 ? "#6f8596" : "#93a5b2") : (i % 4 === 1 ? "#d2d8dc" : "#a2b0ba"); x.fillRect(0, 3 + i * 12.5, 8, 8); }
  return tex(c);
}
function pitchTex() {
  const c = cv(256, 256), x = c.getContext("2d");
  for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? "#5f8f4e" : "#689a55"; x.fillRect(i * 25.6, 0, 26, 256); }
  x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 3;
  x.strokeRect(48, 70, 160, 116); x.beginPath(); x.moveTo(128, 70); x.lineTo(128, 186); x.stroke();
  x.beginPath(); x.arc(128, 128, 20, 0, Math.PI * 2); x.stroke();
  x.strokeRect(48, 104, 18, 48); x.strokeRect(190, 104, 18, 48);
  return tex(c);
}
function stadium(side) {
  const t = tones(side), b = mk(side, "stadium");
  const ri = R * 0.6, wallM = std(t.L ? "#f2f1ec" : "#5e6e7e", { roughness: 0.8 });
  b.geo(lathe([[R - 0.02, 0.112], [ri + 0.02, 0.04]], 56), new THREE.MeshStandardMaterial({ map: standsTex(t.L), roughness: 0.85 }));
  b.geo(lathe([[R, 0], [R, 0.116], [R - 0.02, 0.112]], 56), wallM);
  b.geo(lathe([[ri + 0.02, 0.04], [ri, 0.03], [ri, 0]], 56), wallM);
  const pt = pitchTex(), pitch = new THREE.MeshStandardMaterial({ map: pt, emissive: col("#ffffff"), emissiveMap: pt, emissiveIntensity: 0, roughness: 0.95 });
  TIMED.add((n) => { pitch.emissiveIntensity = 0.32 * n; });
  const pg = new THREE.CircleGeometry(ri, 48); pg.rotateX(-Math.PI / 2); pg.translate(0, 0.03, 0); b.geo(pg, pitch);
  const mast = std(t.L ? "#6c7a86" : "#2f3b47", { roughness: 0.45, metalness: 0.55 }), bank = litMat("#e6ecf2", "#f4f8ff", 0.05, 2.2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5;
    b.cyl(0.007, 0.01, 0.42, 6, mast, x, 0.21, z);
    const lb = new THREE.BoxGeometry(0.075, 0.04, 0.012); lb.rotateX(0.5); lb.rotateY(Math.atan2(-Math.cos(a), -Math.sin(a))); lb.translate(x * 0.96, 0.43, z * 0.96);
    b.geo(lb, bank);
    glowAt(b, "#f4f8ff", 0.3, x * 0.94, 0.43, z * 0.94, 0.85);
  }
  return done(b, 0.45);
}

/* ------------------------------------------------------------ which */

// (Made the first time it's asked for, not as this loads: the rotundas'
// module is in the models' import cycle, and its list may not be there
// yet when this one runs.)
let LIST = null;
export const cabezas = () => LIST || (LIST = [
  { id: "pavilion", name: "Glass pavilion", make: pavilion },
  { id: "rotunda", name: "City hall rotunda", make: rotunda },
  ...ROTUNDAS,
  { id: "bandstand", name: "Bandstand", make: bandstand },
  { id: "carousel", name: "Carousel", make: carousel },
  { id: "head", name: "The head, in a fountain", make: head },
  { id: "planetarium", name: "Planetarium", make: planetarium },
  { id: "kiosk", name: "Clock kiosk", make: kiosk },
  { id: "roundabout", name: "Roundabout monument", make: roundabout },
  { id: "watertower", name: "Water tower", make: waterTower },
  { id: "subway", name: "Subway entrance", make: subway },
  { id: "stadium", name: "Little stadium", make: stadium },
]);
let BY = null;
const byId = (id) => (BY || (BY = Object.fromEntries(cabezas().map((c) => [c.id, c]))))[id];
// ?cabeza=<id> (the ones to try), else the glass dome.
export const CABEZA_PLAYED = "glassdome";
export function cabezaKind() {
  try { const q = new URLSearchParams(window.location.search).get("cabeza"); if (q && byId(q)) return q; } catch (e) { /* not in a page */ }
  return CABEZA_PLAYED;
}
// Each side's faces the other's across the board: the models face +z (the
// dark side's way forward); the light side's turned round, in a group of
// its own (the theme sets the building's own rotation to none).
export function cabezaFor(side) {
  const g = byId(cabezaKind()).make(side);
  if (side !== "light") return g;
  const w = new THREE.Group();
  g.rotation.y = Math.PI;
  w.add(g); w.userData.top = g.userData.top;
  return w;
}
