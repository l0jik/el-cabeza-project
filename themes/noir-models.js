/* Noir's buildings: every piece a tenement of the night city at its exact
   game size (user: "work on film noir now", after the mock-ups 30 and
   50-52: Venetian Blinds, The Searchlights, The Last El).

   Ported from the mock-ups' renderer (city.js: the noir facade, the
   water tower, the fire escape, the HOTEL sign, the newsstand Cabeza),
   in black and white as the films were: the dark side soot-black brick
   with pale stone at every floor, window and corner (the quoins), so a
   dark building never reads as a black mass (the user's complaint about
   Minimal Mono's black pieces); the light side pale limestone. Windows
   four to a cube's width and four floors to its height, a third of them
   lit behind venetian blinds, now and then a figure at one. A fire
   escape down the side of anything three floors or more, a cornice, and
   on the taller roofs a wooden water tower on its legs. One sign, the
   only colour in the city: HOTEL in red neon down the corner of the
   light side's Chato.

   The Cabeza is a round newsstand on its corner (the papers racked round
   its drum, a dome with a finial), a street clock on a cast-iron post
   beside it: black enamel for the dark side, white for the light.

   Each building is made once per piece and pose and kept (the chassis
   rebuilds a piece's mesh on every move but disposes only the mesh's and
   shell's own geometry and material; these are children). */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";

export const PS = PIECE_SCALE;
export const CAB_D = DISC_DIAM * CABEZA_SCALE;
export const CAB_H = DISC_H * CABEZA_SCALE;

/* ------------------------------------------------------------ palette */

// Neutral greys only: the films were black and white. The one colour
// (the HOTEL sign's red) is NEON below.
export const PAL = {
  dark: { wall: "#2b2b2b", brick: true, trim: "#9a9a9a", glass: "#0a0a0a", roof: "#232323", cornice: "#8c8c8c", kiosk: "#141414", kioskInk: "#e8e8e8" },
  light: { wall: "#c4c4c4", brick: false, trim: "#e4e4e4", glass: "#0e0e0e", roof: "#6e6e6e", cornice: "#ececec", kiosk: "#e2e2e2", kioskInk: "#151515" },
};
export const NEON = "#ff2a2a";
const IRON = "#121212";
// How much of the city is up at this hour, and how its windows are lit.
const LIT = 0.34, LIT_TONES = ["#f4f4f4", "#e6e6e6", "#d2d2d2"];

/* ------------------------------------------------------------ small tools */

// A hash per building, so its windows don't depend on the order things are built in.
export const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const reseed = (n) => { seed = (n % 2147483646) + 1; for (let i = 0; i < 4; i++) rnd(); };

export const col = (c) => new THREE.Color(c);
export function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
export function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
export const shade = (hex, k) => { const c = col(hex); c.multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return "#" + c.getHexString(); };

const MATS = new Map();
export function std(c, o = {}) {
  const key = c + JSON.stringify(o);
  let m = MATS.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.85, metalness: 0.02, ...o }); MATS.set(key, m); }
  return m;
}
export function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function boxM(w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }

// A soft glow, for lamps and the neon.
let GLOW_T = null;
export function glowSprite(color, size, opacity = 0.8) {
  if (!GLOW_T) { const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); GLOW_T = tex(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_T, color: col(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.set(size, size, 1); s.castShadow = false; s.raycast = () => {}; return s;
}

// Boxes in one geometry (an iron frame, a tower's legs): one draw call each.
function boxGeo(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function merged(geos) {
  const m = BufferGeometryUtils.mergeBufferGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q)));
  geos.forEach((q) => q.dispose());
  return m;
}

/* ------------------------------------------------------------ facades */

/* Windows four to a cube's width, four floors to its height (the
   mock-ups' noir grid: a bay and a floor PS/4 each). */
const BAYS = 4, FLOORS = 4, CELL = 40; // px a bay (and a floor) on the facade canvases
const BAY = PS / BAYS, FLOOR = PS / FLOORS;

// A figure at a lit window, cut out against the blinds: a head, shoulders,
// now and then a hat's brim (the city's detectives) or a woman's hair.
function silhouette(e, X0, Y0, w, h) {
  const cx = X0 + w * rr(0.35, 0.65), base = Y0 + h, hr = w * 0.17;
  e.fillStyle = "#000";
  e.beginPath(); e.ellipse(cx, base, w * 0.36, h * 0.2, 0, Math.PI, 0); e.fill(); // shoulders
  e.beginPath(); e.arc(cx, base - h * 0.32, hr, 0, Math.PI * 2); e.fill(); // head
  const k = rnd();
  if (k < 0.45) { e.fillRect(cx - hr * 1.9, base - h * 0.32 - hr * 0.9, hr * 3.8, hr * 0.32); e.fillRect(cx - hr * 1.05, base - h * 0.32 - hr * 1.65, hr * 2.1, hr * 0.9); } // a fedora
  else if (k < 0.75) { e.beginPath(); e.ellipse(cx, base - h * 0.28, hr * 1.35, hr * 1.25, 0, Math.PI * 1.05, Math.PI * 1.95); e.fill(); } // hair to the shoulders
}

/* One face of a building: its brick or stone, a stone sill course at every
   floor, each window with a lintel and a sill, a third of them lit behind
   venetian blinds (some blinds half up), the ground floor a shopfront when
   the face comes down to the street, quoins up the corners of the brick,
   a cornice band along the top when it's the roof's edge. Returns the
   colour and the glow (lit windows) canvases. */
function drawFacade(bays, floors, side, o = {}) {
  const pal = PAL[side], W = bays * CELL, H = floors * CELL;
  const c = cv(W, H), x = c.getContext("2d"), ec = cv(W, H), e = ec.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
  x.fillStyle = pal.wall; x.fillRect(0, 0, W, H);
  if (pal.brick) {
    for (let y = 0, r = 0; y < H; y += 4, r++) for (let X = (r % 2) * 4 - 4; X < W; X += 8) { x.fillStyle = shade(pal.wall, rr(0.78, 1.16)); x.fillRect(X, y, 7, 3); }
  } else {
    // ashlar: faint joints a half floor apart, the stone speckled
    for (let i = 0; i < (W * H) / 14; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"; x.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    x.fillStyle = "rgba(0,0,0,0.1)";
    for (let y = CELL / 2, r = 0; y < H; y += CELL / 2, r++) { x.fillRect(0, y, W, 1); for (let X = (r % 2) * CELL * 0.75; X < W; X += CELL * 1.5) x.fillRect(X, y - CELL / 2, 1, CELL / 2); }
  }
  const ground = o.ground ? floors - 1 : -1; // the bottom row of the canvas, if it's at the street
  for (let f = 0; f < floors; f++) {
    const top = f * CELL;
    // the sill course: a stone band at every floor
    x.fillStyle = pal.trim; x.globalAlpha = pal.brick ? 0.85 : 0.6; x.fillRect(0, top + CELL - 3, W, 2.5); x.globalAlpha = 1;
    if (f === ground) {
      // a shopfront: one wide window over the bays but the door's, lit or dark
      const lit = rnd() < 0.55, d0 = Math.floor(rnd() * bays) * CELL;
      x.fillStyle = shade(pal.trim, 0.8); x.fillRect(2, top + CELL * 0.12, W - 4, CELL * 0.1); // the sign band
      x.fillStyle = pal.glass; x.fillRect(4, top + CELL * 0.26, W - 8, CELL * 0.6);
      if (lit) {
        e.fillStyle = pick2(LIT_TONES); e.fillRect(4, top + CELL * 0.26, W - 8, CELL * 0.6);
        e.fillStyle = "#000"; for (let X = 4 + CELL * 0.33; X < W - 6; X += CELL * 0.66) e.fillRect(X, top + CELL * 0.26, 1.5, CELL * 0.6); // the mullions
      }
      x.fillStyle = "#050505"; x.fillRect(d0 + CELL * 0.32, top + CELL * 0.3, CELL * 0.36, CELL * 0.7); e.fillStyle = "#000"; e.fillRect(d0 + CELL * 0.32, top + CELL * 0.3, CELL * 0.36, CELL * 0.7); // the door
      continue;
    }
    for (let b = 0; b < bays; b++) {
      const X0 = b * CELL + CELL * 0.28, w = CELL * 0.44, Y0 = top + CELL * 0.17, h = CELL * 0.62;
      x.fillStyle = pal.trim; x.fillRect(X0 - 3, Y0 - 4, w + 6, 3.5); x.fillRect(X0 - 2, Y0 + h, w + 4, 2.5); // lintel, sill
      x.fillStyle = pal.glass; x.fillRect(X0, Y0, w, h);
      if (rnd() < LIT) {
        e.fillStyle = pick2(LIT_TONES); e.fillRect(X0, Y0, w, h);
        // venetian blinds, some of them half up
        const down = rnd() < 0.3 ? h * rr(0.3, 0.6) : h;
        e.fillStyle = "#000"; for (let t = Y0 + 2; t < Y0 + down; t += 3) e.fillRect(X0, t, w, 1.2);
        if (rnd() < 0.09) silhouette(e, X0, Y0, w, h);
      } else if (rnd() < 0.5) {
        // a dark window with its blind down catches a little light
        x.fillStyle = "rgba(255,255,255,0.05)"; for (let t = Y0 + 2; t < Y0 + h; t += 3) x.fillRect(X0, t, w, 1);
      }
    }
  }
  // quoins: pale stones up the corners of the brick, long and short in turn
  if (pal.brick && o.quoins !== false) {
    x.fillStyle = pal.trim;
    for (let y = 0, k = 0; y < H; y += CELL / 3, k++) { const l = k % 2 ? 9 : 14; x.fillRect(0, y + 1, l, CELL / 3 - 2); x.fillRect(W - l, y + 1, l, CELL / 3 - 2); }
  }
  // the cornice band under the roof's edge, dentils under it
  if (o.top) {
    x.fillStyle = pal.cornice; x.fillRect(0, 0, W, 6);
    x.fillStyle = shade(pal.cornice, 0.6); for (let X = 2; X < W; X += 6) x.fillRect(X, 6, 3, 3);
  }
  return { c, ec };
}
const pick2 = (a) => a[Math.floor(rnd() * a.length)];

function facadeMat(bays, floors, side, o) {
  const { c, ec } = drawFacade(bays, floors, side, o);
  return new THREE.MeshStandardMaterial({
    map: tex(c), emissiveMap: tex(ec), emissive: col("#ffffff"), emissiveIntensity: 1.05,
    roughness: PAL[side].brick ? 0.92 : 0.8, metalness: 0,
  });
}

// The roofs: tar, a few patches and seams.
const ROOF_T = {};
function roofMat(side) {
  if (!ROOF_T[side]) {
    const c = cv(128, 128), x = c.getContext("2d"), base = PAL[side].roof;
    x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { x.fillStyle = shade(base, rr(0.8, 1.2)); x.fillRect(rnd() * 128, rnd() * 128, rr(2, 10), rr(2, 10)); }
    x.fillStyle = shade(base, 0.7); for (let y = 0; y < 128; y += 32) x.fillRect(0, y, 128, 1);
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    ROOF_T[side] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });
  }
  return ROOF_T[side];
}
const HIDDEN_FACE = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });

/* A box of the city, its four faces drawn for its own size. `faces`
   says which are hidden against a neighbour (an odd piece's columns). */
function facadeBox(X, Y, Z, side, o = {}) {
  const floors = Math.max(1, Math.round(Y / FLOOR)), bx = Math.max(1, Math.round(X / BAY)), bz = Math.max(1, Math.round(Z / BAY));
  const hid = o.hidden || {};
  const face = (bays, key) => (hid[key] ? HIDDEN_FACE : facadeMat(bays, floors, side, { ground: o.ground, top: o.top !== false, quoins: o.quoins }));
  const mats = [face(bz, "px"), face(bz, "nx"), o.top === false ? HIDDEN_FACE : roofMat(side), HIDDEN_FACE, face(bx, "pz"), face(bx, "nz")];
  const g = new THREE.BoxGeometry(X, Y, Z);
  // the roof's texture at a constant scale whatever the box
  const uv = g.attributes.uv;
  for (let i = 8; i < 12; i++) uv.setXY(i, uv.getX(i) * X * 1.4, uv.getY(i) * Z * 1.4);
  const m = mesh(g, mats);
  m.userData.ownsMaterials = true;
  return m;
}

/* ------------------------------------------------------------ iron and wood */

/* A fire escape down a face (built against the +z face of a box W wide,
   turned to the face it's for): a landing at every floor from the second
   up, its railing and posts, the stairs between landings switching back
   and forth, the drop ladder hanging over the street. One geometry. */
function fireEscapeGeo(Wf, Y) {
  const parts = [], w = Math.min(Wf * 0.62, 0.48), d = 0.085, x0 = 0, step = FLOOR * 2;
  let k = 0;
  for (let y = FLOOR * 1.02; y < Y - FLOOR * 0.9; y += step, k++) {
    parts.push(boxGeo(w, 0.007, d, x0, y, d / 2)); // the landing
    parts.push(boxGeo(w, 0.005, 0.005, x0, y + 0.055, d)); // the rail
    for (let px = -w / 2; px <= w / 2 + 1e-6; px += w / 6) parts.push(boxGeo(0.004, 0.055, 0.004, x0 + px, y + 0.0275, d));
    for (const sx of [-1, 1]) parts.push(boxGeo(0.004, 0.055, d, x0 + (sx * w) / 2, y + 0.0275, d / 2));
    if (y + step < Y - FLOOR * 0.9) {
      const run = w * 0.78, rise = step, len = Math.hypot(run, rise), a = Math.atan2(rise, run) * (k % 2 ? 1 : -1);
      parts.push(boxGeo(len, 0.006, d * 0.55, x0, y + rise / 2, d * 0.45, 0, 0, a));
    }
  }
  // the drop ladder from the first landing
  const ly = FLOOR * 1.02, lx = x0 + w / 2 - 0.03;
  for (const sx of [-0.018, 0.018]) parts.push(boxGeo(0.004, ly * 0.62, 0.004, lx + sx, ly - (ly * 0.62) / 2, d * 0.8));
  for (let y = ly - 0.03; y > ly * 0.42; y -= 0.035) parts.push(boxGeo(0.036, 0.003, 0.003, lx, y, d * 0.8));
  return merged(parts);
}

/* The wooden water tank on its iron legs, a conical roof, two hoops: the
   shape of every New York roof in the films. Made once, shared. */
let TOWER = null;
// The tower's parts as geometries (iron, wood, roof, height), for the
// city's roofs to instance (noir-city.js).
export function towerParts() {
  if (!TOWER) {
    const r = 0.1, legH = 0.12, tankH = 0.19;
    const iron = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) iron.push(boxGeo(0.012, legH, 0.012, sx * r * 0.62, legH / 2, sz * r * 0.62));
    iron.push(boxGeo(r * 1.4, 0.008, 0.008, 0, legH * 0.5, r * 0.62), boxGeo(r * 1.4, 0.008, 0.008, 0, legH * 0.5, -r * 0.62));
    for (const y of [legH + 0.05, legH + 0.14]) { const t = new THREE.TorusGeometry(r + 0.003, 0.004, 4, 20); t.rotateX(Math.PI / 2); t.translate(0, y, 0); iron.push(t); }
    const tank = new THREE.CylinderGeometry(r, r, tankH, 18, 1, true); tank.translate(0, legH + tankH / 2, 0);
    const floor = new THREE.CylinderGeometry(r, r, 0.01, 18); floor.translate(0, legH + 0.005, 0);
    const roof = new THREE.ConeGeometry(r + 0.012, 0.09, 18); roof.translate(0, legH + tankH + 0.045, 0);
    TOWER = { iron: merged(iron), wood: merged([tank, floor]), roof: roof.toNonIndexed(), h: legH + tankH + 0.09 };
  }
  return TOWER;
}
export const TOWER_MATS = {
  iron: () => std(IRON, { roughness: 0.6, metalness: 0.4 }),
  wood: () => std("#4c4b49", { roughness: 0.95, side: THREE.DoubleSide }),
  roof: () => std("#2e2e2e", { roughness: 0.8 }),
};
function waterTower() {
  towerParts();
  const g = new THREE.Group();
  g.add(mesh(TOWER.iron, std(IRON, { roughness: 0.6, metalness: 0.4 })));
  g.add(mesh(TOWER.wood, std("#4c4b49", { roughness: 0.95, side: THREE.DoubleSide })));
  g.add(mesh(TOWER.roof, std("#2e2e2e", { roughness: 0.8 })));
  return g;
}

/* ------------------------------------------------------------ the HOTEL sign */

/* A blade sign down a building's corner: HOTEL in red neon tubes, a dark
   enamel blade, the glow round it. Drawn unlit (it is its own light). */
function hotelSign(h) {
  const c = cv(64, 320), x = c.getContext("2d");
  x.fillStyle = "#0b0b0b"; x.fillRect(0, 0, 64, 320);
  x.strokeStyle = "#3a3a3a"; x.lineWidth = 4; x.strokeRect(3, 3, 58, 314);
  x.font = "bold 44px 'Bebas Neue', 'Oswald', Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  "HOTEL".split("").forEach((l, i) => {
    const y = 36 + i * 62;
    x.shadowColor = NEON; x.shadowBlur = 14; x.fillStyle = "#ff6a5a"; x.fillText(l, 32, y);
    x.shadowBlur = 0; x.fillStyle = "#ffe0da"; x.globalAlpha = 0.55; x.fillText(l, 32, y); x.globalAlpha = 1;
  });
  // the blade stands out from the wall along x; its two faces look along z
  const g = new THREE.Group(), w = 0.13, d = 0.03, edge = std("#0b0b0b");
  const face = new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [edge, edge, edge, edge, face, face]);
  blade.position.x = w / 2;
  g.add(blade);
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.012, 0.012), std(IRON), 0.01, h / 2 - 0.02, 0), mesh(new THREE.BoxGeometry(0.02, 0.012, 0.012), std(IRON), 0.01, -h / 2 + 0.02, 0));
  for (const k of [-0.32, 0, 0.32]) { const s = glowSprite(NEON, 0.42, 0.42); s.position.set(w / 2, k * h, 0); g.add(s); }
  g.userData.neon = true;
  return g;
}

/* ------------------------------------------------------------ the pieces */

function pieceBuilding(piece, side) {
  const X = piece.w * PS, Y = piece.z * PS, Z = piece.h * PS, m = 0.012;
  const g = new THREE.Group(), n = strHash(`${piece.id}|${piece.w}|${piece.h}|${piece.z}`);
  reseed(n);
  const body = facadeBox(X - 2 * m, Y, Z - 2 * m, side, { ground: true });
  body.position.y = Y / 2;
  g.add(body);
  // the cornice: a stone ledge round the roof, its shadow under it (its top
  // a hair under the roof's, so the two never fight over the same plane)
  const cor = boxM(X - 2 * m + 0.035, 0.03, Z - 2 * m + 0.035, std(PAL[side].cornice, { roughness: 0.75 }), 0, Y - 0.019, 0);
  g.add(cor);
  // a low parapet behind it
  const par = std(shade(PAL[side].wall, PAL[side].brick ? 1 : 0.92), { roughness: 0.9 });
  for (const [w, d, x, z] of [[X - 2 * m, 0.02, 0, (Z - 2 * m) / 2 - 0.01], [X - 2 * m, 0.02, 0, -(Z - 2 * m) / 2 + 0.01], [0.02, Z - 2 * m, (X - 2 * m) / 2 - 0.01, 0], [0.02, Z - 2 * m, -(X - 2 * m) / 2 + 0.01, 0]]) g.add(boxM(w, 0.04, d, par, x, Y + 0.02, z));
  const floors = Math.round(Y / FLOOR), standing = Y >= Math.max(X, Z) - 0.01;
  // the roof: a stair bulkhead, a chimney or two, and on most standing ones the tank
  const roofMatS = std(shade(PAL[side].roof, 1.15), { roughness: 0.9 });
  const bx = (hash(n + 1) - 0.5) * (X - 0.3), bz = (hash(n + 2) - 0.5) * (Z - 0.3);
  g.add(boxM(0.14, 0.1, 0.12, roofMatS, bx, Y + 0.05, bz));
  g.add(boxM(0.04, 0.09, 0.04, std(shade(PAL[side].wall, 0.8)), -bx * 0.8 + 0.05, Y + 0.045, -bz * 0.8));
  if ((standing && hash(n + 3) < 0.75) || (X * Z > PS * PS * 1.5 && hash(n + 3) < 0.4)) {
    const t = waterTower(); t.position.set(-bx * 0.6, Y + 0.002, bz * 0.6 + 0.04); t.rotation.y = hash(n + 4) * 6.28; g.add(t);
  }
  // a fire escape down one side of anything three floors or more
  if (floors >= 3) {
    const onX = Z >= X ? hash(n + 5) < 0.75 : hash(n + 5) < 0.25, sgn = hash(n + 6) < 0.5 ? 1 : -1;
    const Wf = onX ? Z - 2 * m : X - 2 * m;
    const fe = mesh(fireEscapeGeo(Wf, Y), std(IRON, { roughness: 0.6, metalness: 0.4 }));
    if (onX) { fe.rotation.y = (sgn * Math.PI) / 2; fe.position.x = sgn * ((X - 2 * m) / 2); }
    else { fe.rotation.y = sgn > 0 ? 0 : Math.PI; fe.position.z = sgn * ((Z - 2 * m) / 2); }
    fe.position.x += onX ? 0 : (hash(n + 7) - 0.5) * Math.max(0, X - 0.6);
    fe.position.z += onX ? (hash(n + 7) - 0.5) * Math.max(0, Z - 0.6) : 0;
    fe.castShadow = true;
    g.add(fe);
  }
  // the one sign in town (as the mock-ups had it)
  if (side === "light" && piece.type === "chato" && Y > FLOOR * 3) {
    const h = Math.min(Y * 0.7, 1.0), s = hotelSign(h);
    s.position.set((X - 2 * m) / 2, Y - h / 2 - 0.08, (Z - 2 * m) / 2 - 0.08);
    g.add(s);
  }
  return g;
}

/* An odd-shaped piece: a column of the city on each of its cubes' squares
   (one box for every unbroken run of cubes up it, so an arch's lintel
   is a bridge between towers), each face drawn but those pressed against a
   neighbour. */
function voxBuilding(piece, side) {
  const g = new THREE.Group(), n = strHash(`${piece.id}|${piece.vox}`);
  reseed(n);
  const cells = piece.vox.split(";").map((s) => s.split(",").map(Number));
  const has = new Set(cells.map((c) => c.join(",")));
  const X = piece.w * PS, Z = piece.h * PS;
  const cols = new Map();
  for (const [x, y, z] of cells) { const k = `${x},${y}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(z); }
  // each column the full width of its cube, so neighbours meet flush (no
  // slit between the towers of one piece)
  const W = PS;
  for (const [k, zs] of cols) {
    const [x, y] = k.split(",").map(Number);
    zs.sort((a, b) => a - b);
    const runs = [];
    for (const z of zs) { const r = runs[runs.length - 1]; if (r && z === r[1] + 1) r[1] = z; else runs.push([z, z]); }
    for (const [z0, z1] of runs) {
      const full = (dx, dy) => { for (let z = z0; z <= z1; z++) if (!has.has(`${x + dx},${y + dy},${z}`)) return false; return true; };
      const top = !has.has(`${x},${y},${z1 + 1}`);
      const box = facadeBox(W, (z1 - z0 + 1) * PS, W, side, {
        ground: z0 === 0, top,
        hidden: { px: full(1, 0), nx: full(-1, 0), pz: full(0, 1), nz: full(0, -1) },
      });
      box.position.set(-X / 2 + PS * (x + 0.5), ((z0 + z1 + 1) * PS) / 2, -Z / 2 + PS * (y + 0.5));
      g.add(box);
      // (the cornice is the band drawn along the top of each face: a
      // ledge per column would meet its neighbour's in the same planes)
    }
  }
  // a water tank on the highest roof
  let best = null;
  for (const [x, y, z] of cells) if (!has.has(`${x},${y},${z + 1}`) && (!best || z > best[2])) best = [x, y, z];
  if (best && hash(n + 9) < 0.7) { const t = waterTower(); t.position.set(-X / 2 + PS * (best[0] + 0.5), (best[2] + 1) * PS + 0.002, -Z / 2 + PS * (best[1] + 0.5)); t.rotation.y = hash(n + 10) * 6.28; g.add(t); }
  return g;
}

/* ------------------------------------------------------------ the Cabeza */

/* The newsstand: a drum racked round with the evening papers and the
   magazines, a NEWS band above them, a little window lit inside, a dome
   with a finial; beside it a street clock on a cast-iron post. Its own
   corner of pavement under it. Black enamel or white, by side. */
function newsTexture(side) {
  const pal = PAL[side], c = cv(512, 128), x = c.getContext("2d"), ec = cv(512, 128), e = ec.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, 512, 128);
  x.fillStyle = pal.kiosk; x.fillRect(0, 0, 512, 128);
  // the band: NEWS round the drum, twice
  x.fillStyle = pal.kioskInk; x.font = "bold 30px 'Bebas Neue', 'Oswald', Impact, sans-serif"; x.textBaseline = "middle"; x.textAlign = "center";
  for (const cx of [64, 192, 320, 448]) x.fillText(cx % 256 === 64 ? "NEWS" : "PAPERS", cx, 18);
  x.fillRect(0, 34, 512, 2);
  // the racks: papers folded, headlines in black, magazines with a cover face
  const heads = ["EXTRA", "MURDER", "STRIKE", "FOG", "RAID", "LATE", "FINAL", "SCANDAL"];
  for (let i = 0; i < 18; i++) {
    const X0 = 6 + i * 28, Y0 = 44 + (i % 2) * 4, w = 24, h = 34;
    x.fillStyle = i % 3 === 2 ? "#3a3a3a" : "#e9e9e9"; x.fillRect(X0, Y0, w, h);
    x.fillStyle = i % 3 === 2 ? "#cfcfcf" : "#111"; x.font = "bold 7px sans-serif"; x.fillText(heads[i % heads.length], X0 + w / 2, Y0 + 6);
    x.fillRect(X0 + 3, Y0 + 11, w - 6, 1); x.fillRect(X0 + 3, Y0 + 15, w - 9, 1); x.fillRect(X0 + 3, Y0 + 19, w - 6, 1);
  }
  // the window, lit
  x.fillStyle = "#050505"; x.fillRect(200, 84, 112, 38);
  e.fillStyle = "#e8e8e8"; e.fillRect(200, 84, 112, 38); e.fillStyle = "#000"; e.fillRect(254, 84, 3, 38);
  x.fillStyle = shade(pal.kiosk, side === "dark" ? 2.2 : 0.75); x.fillRect(0, 124, 512, 4);
  const t = tex(c); t.wrapS = THREE.RepeatWrapping;
  const te = tex(ec); te.wrapS = THREE.RepeatWrapping;
  return { map: t, emissiveMap: te };
}
const CLOCK_T = {};
function clockFace() {
  if (!CLOCK_T.t) {
    const c = cv(128, 128), x = c.getContext("2d");
    x.fillStyle = "#101010"; x.fillRect(0, 0, 128, 128);
    x.fillStyle = "#f1f1ec"; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.fill();
    x.strokeStyle = "#111"; x.lineWidth = 3; x.stroke();
    x.fillStyle = "#111";
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillRect(64 + Math.cos(a) * 46 - 2, 64 + Math.sin(a) * 46 - 2, 4, 4); }
    // ten to midnight
    x.lineCap = "round"; x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(-Math.PI / 2 - 0.09) * 30, 64 + Math.sin(-Math.PI / 2 - 0.09) * 30); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(-Math.PI / 2 - Math.PI / 3) * 44, 64 + Math.sin(-Math.PI / 2 - Math.PI / 3) * 44); x.stroke();
    CLOCK_T.t = new THREE.MeshStandardMaterial({ map: tex(c), emissive: col("#ffffff"), emissiveMap: tex(c), emissiveIntensity: 0.55, roughness: 0.4 });
  }
  return CLOCK_T.t;
}
function cabezaBuilding(side) {
  const pal = PAL[side], g = new THREE.Group(), r = CAB_D / 2;
  const enamel = std(pal.kiosk, { roughness: 0.45, metalness: 0.1 }), iron = std(IRON, { roughness: 0.5, metalness: 0.4 });
  // the pavement it stands on, kerbed
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.03, 48), std(side === "dark" ? "#3a3a3a" : "#9e9e9e", { roughness: 0.7 }), 0, 0.015, 0));
  const kerb = new THREE.Mesh(new THREE.TorusGeometry(r - 0.012, 0.012, 6, 64), std(side === "dark" ? "#7a7a7a" : "#d8d8d8", { roughness: 0.6 }));
  kerb.rotation.x = Math.PI / 2; kerb.position.y = 0.03; g.add(kerb);
  // the stand: the drum, the papers round it
  const dr = 0.215, dh = 0.27, cx = 0.07, cz = -0.04;
  const { map, emissiveMap } = newsTexture(side);
  const drumMat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: col("#ffffff"), emissiveIntensity: 0.9, roughness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(dr, dr, dh, 40, 1, true), drumMat, cx, 0.03 + dh / 2, cz));
  // a shelf ledge, the dome over it with its rim and finial
  const ledge = new THREE.Mesh(new THREE.TorusGeometry(dr + 0.01, 0.01, 6, 40), enamel); ledge.rotation.x = Math.PI / 2; ledge.position.set(cx, 0.03 + dh * 0.12, cz); g.add(ledge);
  g.add(mesh(new THREE.CylinderGeometry(dr + 0.035, dr + 0.035, 0.022, 40), enamel, cx, 0.03 + dh + 0.011, cz));
  const dome = mesh(new THREE.SphereGeometry(dr + 0.025, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), enamel, cx, 0.03 + dh + 0.022, cz); dome.scale.y = 0.62; g.add(dome);
  g.add(mesh(new THREE.SphereGeometry(0.018, 12, 8), iron, cx, 0.03 + dh + 0.022 + (dr + 0.025) * 0.62 + 0.012, cz));
  g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), iron, cx, 0.03 + dh + 0.022 + (dr + 0.025) * 0.62 + 0.04, cz));
  // the street clock: a fluted post, a double face, a lamp of a cap
  const px = -0.24, pz = 0.17, ph = 0.6;
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 12), iron, px, 0.055, pz));
  g.add(mesh(new THREE.CylinderGeometry(0.014, 0.02, ph, 10), iron, px, 0.03 + ph / 2, pz));
  const face = clockFace(), housing = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 28);
  const clock = new THREE.Mesh(housing, [iron, face, face]); clock.rotation.x = Math.PI / 2; clock.rotation.z = Math.PI / 2; clock.position.set(px, 0.03 + ph + 0.06, pz); clock.castShadow = true; g.add(clock);
  g.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), iron, px, 0.03 + ph + 0.145, pz));
  g.userData.top = 0.03 + dh + 0.022 + (dr + 0.025) * 0.62;
  return g;
}

/* ------------------------------------------------------------ the pieces, for the chassis */

// A piece's building, made once per piece and pose and kept.
const BUILT = new Map();
export function buildingFor(piece, side) {
  const key = piece.type === "cabeza" ? `${piece.id}|cab|${side}` : `${piece.id}|${side}|${piece.type}|${piece.w}|${piece.h}|${piece.z}|${piece.vox || ""}`;
  let b = BUILT.get(key);
  if (!b) {
    b = piece.type === "cabeza" ? cabezaBuilding(side) : piece.vox ? voxBuilding(piece, side) : pieceBuilding(piece, side);
    b.userData.noirBuilding = true;
    BUILT.set(key, b);
  }
  return b;
}
