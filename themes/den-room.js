/* The den: where the copy bought at the store is played, a family room of
   the mid-seventies on a weeknight, the lamps on and rain on the glass.

   Scale as Tienda's: one board square is one unit, about 5 cm (a foot is
   6.1 units). The board sits on a low walnut coffee table in the middle
   of a sunken conversation pit: built-in sofas in rust corduroy round
   three sides, two steps up on the fourth, burnt-orange shag underfoot.
   Up at the room's floor, avocado shag and walls of walnut paneling:

     north   the fieldstone fireplace, a fire going, the sunburst clock on
             the chimney (it keeps the real time), shelves either side
     east    the sliding glass door onto the dark yard, rain running down
             it, the drapes drawn back; a velvet club chair and an arc lamp
     south   the television set (off), the stereo console, a landscape in
             oils over it, a lamp
     west    the accent wall's flowered paper, a long credenza, two lamps,
             a big abstract, a macramé hanger in the corner
     up      popcorn plaster between walnut beams, two amber swag lamps
             hanging over the pit

   Light is baked, as the store's is: the room is unlit (MeshBasicMaterial)
   with the lamps' light painted into its vertex colours, each lamp a
   warm pool falling off with distance and facing. That keeps a room full
   of lamps cheap on a phone, and the same from every side as the board
   (and the room with it) turns. Only the coffee table and what's on it
   are lit like the board. The fire, the lamps' glow and the rain move
   (den-fx.js animates them).

   The room is built round the board's size (the table and the pit grow
   with it); den-fx.js rebuilds it when the board changes. Walls and the
   ceiling are groups of their own, so whichever the camera has gone
   behind can step aside. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLAB_THICKNESS } from "../engine/constants.js";
import { makeRoundedBox } from "../engine/geometry.js";
import { quality } from "./tienda-quality.js";
import { canvasTexture, repaint, lidPainter } from "./tienda-textures.js";
import { paintWood } from "./wood-set.js";
import * as TX from "./den-textures.js";
import boxArtUrl from "../assets/tienda/box-art.jpg";

export const FT = 6.1;
export const TABLE_H = 8.4; // pit floor to the coffee table's top (17 in)
export const PIT_DEPTH = 7.2; // three steps of about 5 in
export const PIT_FLOOR = -SLAB_THICKNESS - TABLE_H;
export const FLOOR = PIT_FLOOR + PIT_DEPTH;
export const CEIL = FLOOR + 49; // 8 ft
export const RX = 100, RZ = 88; // the walls: |x| = RX, |z| = RZ

/* The lamps, in the board's frame: where each is, its colour and
   strength, and its reach (the distance at which its light has fallen to
   half). The fire burns brightest; the window gives a little cool light. */
const WARM = [1.0, 0.72, 0.42], AMBER = [1.0, 0.6, 0.26], FIRE = [1.0, 0.45, 0.16], MOON = [0.42, 0.52, 0.72];
export const LAMPS = [
  { name: "swag-nw", p: [-25, FLOOR + 29, -23], c: AMBER, i: 1.0, r: 24 },
  { name: "swag-se", p: [23, FLOOR + 27, 25], c: AMBER, i: 0.95, r: 24 },
  { name: "credenza-n", p: [-90, FLOOR + 22, -26], c: WARM, i: 0.85, r: 20 },
  { name: "credenza-s", p: [-90, FLOOR + 22, 26], c: WARM, i: 0.85, r: 20 },
  { name: "stereo", p: [44, FLOOR + 24, 81], c: WARM, i: 0.8, r: 18 },
  { name: "arc", p: [66, FLOOR + 29, -31], c: WARM, i: 0.9, r: 22 },
  { name: "fire", p: [0, FLOOR + 8, -79], c: FIRE, i: 1.25, r: 28 },
  { name: "window", p: [104, FLOOR + 22, 0], c: MOON, i: 0.3, r: 46 },
];
const AMBIENT = [0.13, 0.095, 0.07];

/* ------------------------------------------------------------ geometry helpers */

const segs = (len, step) => Math.max(1, Math.round(len / step));

// A box of w x h x d centred at (x, y, z), turned ry about y; big faces
// are cut every `step` units so the baked light can vary across them.
function box(w, h, d, x, y, z, { ry = 0, step = 12, round = 0 } = {}) {
  const geo = round > 0 ? makeRoundedBox(w, h, d, round, 3) : new THREE.BoxGeometry(w, h, d, segs(w, step), segs(h, step), segs(d, step));
  const m = new THREE.Matrix4().makeRotationY(ry);
  m.setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}
// A flat rectangle: facing "+y" (floor), "-y" (ceiling), "+z", "-z", "+x", "-x".
function rect(w, h, facing, x, y, z, step = 6) {
  const geo = new THREE.PlaneGeometry(w, h, segs(w, step), segs(h, step));
  const R = {
    "+y": new THREE.Matrix4().makeRotationX(-Math.PI / 2),
    "-y": new THREE.Matrix4().makeRotationX(Math.PI / 2),
    "+z": new THREE.Matrix4(),
    "-z": new THREE.Matrix4().makeRotationY(Math.PI),
    "+x": new THREE.Matrix4().makeRotationY(Math.PI / 2),
    "-x": new THREE.Matrix4().makeRotationY(-Math.PI / 2),
  }[facing];
  geo.applyMatrix4(R);
  geo.translate(x, y, z);
  return geo;
}
function cyl(rTop, rBot, h, x, y, z, seg = 16, open = false) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  geo.translate(x, y, z);
  return geo;
}

// UVs from world position, by the face's direction, `tile` units to one
// repeat: walls and floors read as one surface however they're cut.
function planarUV(geo, tile) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

// The lamps' light, painted into the vertex colours.
function bake(geo, { k = 1, tint = [1, 1, 1], floorShade = true } = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let r = AMBIENT[0] + 0.035 * (0.5 + 0.5 * ny), g = AMBIENT[1] + 0.028 * (0.5 + 0.5 * ny), b = AMBIENT[2] + 0.02 * (0.5 + 0.5 * ny);
    for (const L of LAMPS) {
      const vx = L.p[0] - x, vy = L.p[1] - y, vz = L.p[2] - z;
      const d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const facing = (nx * vx + ny * vy + nz * vz) / d;
      const w = Math.max(0, (facing + 0.25) / 1.25); // a soft wrap, as cloth and plaster take light
      const att = 1 / (1 + (d / L.r) * (d / L.r));
      const e = L.i * w * att;
      r += L.c[0] * e; g += L.c[1] * e; b += L.c[2] * e;
    }
    // Low on a wall, and in the corners, a little darker.
    if (floorShade && Math.abs(ny) < 0.5) {
      const base = y < FLOOR - 0.5 ? PIT_FLOOR : FLOOR;
      const t = Math.max(0, Math.min(1, (y - base) / 9));
      const s = 0.62 + 0.38 * Math.sqrt(t);
      r *= s; g *= s; b *= s;
    }
    cols[i * 3] = r * k * tint[0]; cols[i * 3 + 1] = g * k * tint[1]; cols[i * 3 + 2] = b * k * tint[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return geo;
}

/* Geometry is gathered into buckets (one per material, per group) and
   merged, so the whole room is a few dozen draw calls. */
class Builder {
  constructor() {
    this.groups = {};
    ["core", "wallN", "wallE", "wallS", "wallW", "ceiling", "sofaN", "sofaS", "sofaW"].forEach((n) => { const g = new THREE.Group(); g.name = `den-${n}`; this.groups[n] = g; });
    this.buckets = new Map();
    this.disposables = [];
  }
  // Adds geometry drawn in `mat`: tile = world-UV repeat (null keeps the
  // geometry's own UVs), baked unless the material glows by itself.
  add(mat, geo, { group = "core", tile = null, k = 1, tint, floorShade } = {}) {
    if (tile) planarUV(geo, tile);
    if (!geo.attributes.uv) planarUV(geo, 10);
    if (mat.vertexColors) bake(geo, { k, tint, floorShade });
    const key = group + "|" + mat.uuid;
    if (!this.buckets.has(key)) this.buckets.set(key, { mat, group, geos: [] });
    this.buckets.get(key).geos.push(geo.index ? geo.toNonIndexed() : geo);
    if (geo.index) geo.dispose();
  }
  // Something that needs its own mesh (animated, transparent, lit).
  mesh(obj, group = "core") { this.groups[group].add(obj); return obj; }
  finish() {
    this.buckets.forEach(({ mat, group, geos }) => {
      const keep = ["position", "normal", "uv"].concat(mat.vertexColors ? ["color"] : []);
      geos.forEach((gg) => Object.keys(gg.attributes).forEach((a) => { if (!keep.includes(a)) gg.deleteAttribute(a); }));
      const merged = BufferGeometryUtils.mergeBufferGeometries(geos, false);
      geos.forEach((gg) => gg.dispose());
      const m = new THREE.Mesh(merged, mat);
      m.matrixAutoUpdate = false;
      this.groups[group].add(m);
      this.disposables.push(merged);
    });
    this.buckets.clear();
  }
}

/* ------------------------------------------------------------ the room */

export function buildDen(boardSpan) {
  const q = quality();
  const B = new Builder();
  const disposables = B.disposables;
  const tex = (t, repeatTile) => { disposables.push(t); if (repeatTile) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  // Baked (unlit, lamp-painted) materials.
  const baked = (map, extra = {}) => { const m = new THREE.MeshBasicMaterial({ map, vertexColors: true, fog: true, ...extra }); disposables.push(m); return m; };
  const glowing = (opts) => { const m = new THREE.MeshBasicMaterial({ fog: true, ...opts }); disposables.push(m); return m; };

  const T = {
    panel: tex(TX.paneling(), true),
    paper: tex(TX.floralPaper(), true),
    stone: tex(TX.fieldstone(), true),
    shagRoom: tex(TX.shag("avocado"), true),
    shagPit: tex(TX.shag("rust"), true),
    ceil: tex(TX.popcorn(), true),
    cord: tex(TX.corduroy(), true),
    plaid: tex(TX.plaid(), true),
    velvet: tex(TX.velvet(), true),
    drapes: tex(TX.drapes(), true),
    books: tex(TX.bookRow()),
    landscape: tex(TX.landscape()),
    abstract: tex(TX.abstractArt()),
    night: tex(TX.nightYard()),
    rain: tex(TX.rainStreaks(), true),
    sun: tex(TX.sunburst()),
    shade: tex(TX.lampShade()),
    grille: tex(TX.grilleCloth(), true),
    glow: tex(TX.glow()),
    shadow: tex(TX.contactShadow()),
    sleeves: tex(TX.sleeves()),
    pillowA: tex(TX.pillowPrint(0)),
    pillowB: tex(TX.pillowPrint(1)),
  };
  // Walnut for furniture and beams: the paneling's own planks read as
  // walnut boards at a smaller repeat.
  const M = {
    panel: baked(T.panel),
    paper: baked(T.paper),
    stone: baked(T.stone),
    shagRoom: baked(T.shagRoom),
    shagPit: baked(T.shagPit),
    ceil: baked(T.ceil),
    walnut: baked(T.panel, { color: 0xb08868 }),
    darkWood: baked(null, { color: 0x3a2213 }),
    cord: baked(T.cord),
    plaid: baked(T.plaid),
    velvet: baked(T.velvet),
    drapes: baked(T.drapes, { side: THREE.DoubleSide }),
    books: baked(T.books),
    landscape: baked(T.landscape),
    abstract: baked(T.abstract),
    gold: baked(null, { color: 0xc99a3e }),
    brass: baked(null, { color: 0xd8b25a }),
    chrome: baked(null, { color: 0xc8c8c8 }),
    bronze: baked(null, { color: 0x4a3a2a }),
    black: baked(null, { color: 0x151210 }),
    soot: baked(null, { color: 0x2a1c14 }),
    ceramicGold: baked(null, { color: 0xd3a13b }),
    ceramicOrange: baked(null, { color: 0xc0632c }),
    ceramicGreen: baked(null, { color: 0x6b7536 }),
    leaf: baked(null, { color: 0x3e5a2a, side: THREE.DoubleSide }),
    pot: baked(null, { color: 0xb45a2a }),
    grille: baked(T.grille),
    sleeves: baked(T.sleeves),
    pillowA: baked(T.pillowA),
    pillowB: baked(T.pillowB),
    bark: baked(null, { color: 0x3a2618 }),
    rope: baked(null, { color: 0xd8c8a0 }),
    marble: baked(null, { color: 0xe6e0d4 }),
    // Glowing: lit from within, not by the lamps.
    shade: glowing({ map: T.shade, color: 0xffe2b0, side: THREE.DoubleSide }),
    globe: glowing({ color: 0xffa24a }),
    bulb: glowing({ color: 0xfff1d0 }),
    ember: glowing({ color: 0xff6a1a }),
    night: glowing({ map: T.night, color: 0xb0b8c8 }),
    screen: glowing({ color: 0x070a09 }),
  };

  // The board's span sets the table and the pit.
  const TW = boardSpan + 16; // the coffee table's top (about 54 in square for the 10 x 10)
  const PH = TW / 2 + 22; // the pit's half-width: the table, legroom, the seats
  const yP = PIT_FLOOR, yF = FLOOR, yC = CEIL;

  /* ---- floors ---- */
  // The room's floor, round the pit.
  const floorRect = (x0, x1, z0, z1) => B.add(M.shagRoom, rect(x1 - x0, z1 - z0, "+y", (x0 + x1) / 2, yF, (z0 + z1) / 2, 6), { tile: TX.SHAG_TILE });
  floorRect(-RX, RX, -RZ, -PH);
  floorRect(-RX, RX, PH, RZ);
  floorRect(-RX, -PH, -PH, PH);
  floorRect(PH, RX, -PH, PH);
  // The pit's floor, and its walls up to the room's floor.
  B.add(M.shagPit, rect(PH * 2, PH * 2, "+y", 0, yP, 0, 5), { tile: TX.SHAG_TILE });
  B.add(M.panel, rect(PH * 2, PIT_DEPTH, "+z", 0, yP + PIT_DEPTH / 2, -PH, 4), { tile: TX.PANEL_TILE });
  B.add(M.panel, rect(PH * 2, PIT_DEPTH, "-z", 0, yP + PIT_DEPTH / 2, PH, 4), { tile: TX.PANEL_TILE });
  B.add(M.panel, rect(PH * 2, PIT_DEPTH, "+x", -PH, yP + PIT_DEPTH / 2, 0, 4), { tile: TX.PANEL_TILE });
  B.add(M.panel, rect(PH * 2, PIT_DEPTH, "-x", PH, yP + PIT_DEPTH / 2, 0, 4), { tile: TX.PANEL_TILE });
  // A walnut cap round the pit's edge.
  const cap = 2.4;
  B.add(M.walnut, box(PH * 2 + cap * 2, 0.6, cap, 0, yF + 0.3, -PH - cap / 2), { tile: 16 });
  B.add(M.walnut, box(PH * 2 + cap * 2, 0.6, cap, 0, yF + 0.3, PH + cap / 2), { tile: 16 });
  B.add(M.walnut, box(cap, 0.6, PH * 2, -PH - cap / 2, yF + 0.3, 0), { tile: 16 });
  B.add(M.walnut, box(cap, 0.6, PH * 2, PH + cap / 2, yF + 0.3, 0), { tile: 16 });

  /* ---- the built-in sofas: north, west and south sides of the pit ---- */
  const SD = 12; // seat depth
  const seatTop = yP + 8;
  // Upholstered platforms.
  B.add(M.cord, box(PH * 2, 5, SD, 0, yP + 2.5, -PH + SD / 2, { step: 8 }), { group: "sofaN", tile: TX.CORD_TILE, k: 0.95 });
  B.add(M.cord, box(PH * 2, 5, SD, 0, yP + 2.5, PH - SD / 2, { step: 8 }), { group: "sofaS", tile: TX.CORD_TILE, k: 0.95 });
  B.add(M.cord, box(SD, 5, PH * 2 - SD * 2, -PH + SD / 2, yP + 2.5, 0, { step: 8 }), { group: "sofaW", tile: TX.CORD_TILE, k: 0.95 });
  // Seat cushions, rounded, in runs along each side.
  const cushionRun = (len, place) => {
    const n = Math.max(2, Math.round(len / 15)), w = len / n;
    for (let i = 0; i < n; i++) place(-len / 2 + w * (i + 0.5), w - 0.4);
  };
  cushionRun(PH * 2, (u, w) => B.add(M.cord, box(w, 3.2, SD - 0.6, u, seatTop - 1.4, -PH + SD / 2, { round: 1.2 }), { group: "sofaN", tile: TX.CORD_TILE }));
  cushionRun(PH * 2, (u, w) => B.add(M.cord, box(w, 3.2, SD - 0.6, u, seatTop - 1.4, PH - SD / 2, { round: 1.2 }), { group: "sofaS", tile: TX.CORD_TILE }));
  cushionRun(PH * 2 - SD * 2, (u, w) => B.add(M.cord, box(SD - 0.6, 3.2, w, -PH + SD / 2, seatTop - 1.4, u, { round: 1.2 }), { group: "sofaW", tile: TX.CORD_TILE }));
  // Back cushions leaning on the pit's walls, their tops a little above
  // the room's floor.
  const backH = 10, backD = 4;
  cushionRun(PH * 2, (u, w) => B.add(M.cord, box(w, backH, backD, u, seatTop + backH / 2 - 0.4, -PH + backD / 2 + 0.3, { round: 1.4 }), { group: "sofaN", tile: TX.CORD_TILE }));
  cushionRun(PH * 2, (u, w) => B.add(M.cord, box(w, backH, backD, u, seatTop + backH / 2 - 0.4, PH - backD / 2 - 0.3, { round: 1.4 }), { group: "sofaS", tile: TX.CORD_TILE }));
  cushionRun(PH * 2 - SD * 2, (u, w) => B.add(M.cord, box(backD, backH, w, -PH + backD / 2 + 0.3, seatTop + backH / 2 - 0.4, u, { round: 1.4 }), { group: "sofaW", tile: TX.CORD_TILE }));
  // Throw pillows, tossed.
  // The print is laid on the pillow's own faces (UVs from its local
  // x and y) before it's turned and set down.
  const pillow = (mat, x, z, ry, group, tilt = 0.25) => {
    const g = makeRoundedBox(6, 6, 1.8, 0.8, 3);
    const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 6.2 + 0.5; uv[i * 2 + 1] = pos.getY(i) / 6.2 + 0.5; }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(-tilt));
    m.setPosition(x, seatTop + 3.2, z);
    g.applyMatrix4(m);
    B.add(mat, g, { group });
  };
  pillow(M.pillowA, -PH * 0.55, -PH + 5.5, 0.15, "sofaN");
  pillow(M.pillowB, PH * 0.35, -PH + 5.5, -0.2, "sofaN");
  pillow(M.pillowB, -PH * 0.3, PH - 5.5, Math.PI + 0.1, "sofaS");
  pillow(M.pillowA, PH * 0.6, PH - 5.5, Math.PI - 0.25, "sofaS");
  pillow(M.pillowA, -PH + 5.5, PH * 0.1, Math.PI / 2 + 0.2, "sofaW");
  // The steps up, on the east side.
  const stepW = 22;
  B.add(M.shagPit, box(6, 2.4, stepW, PH - 9, yP + 1.2, 0), { tile: TX.SHAG_TILE });
  B.add(M.shagPit, box(6, 4.8, stepW, PH - 3, yP + 2.4, 0), { tile: TX.SHAG_TILE });
  B.add(M.walnut, box(0.8, 0.5, stepW, PH - 12 + 0.4, yP + 2.4 + 0.25, 0), { tile: 16 });
  B.add(M.walnut, box(0.8, 0.5, stepW, PH - 6 + 0.4, yP + 4.8 + 0.25, 0), { tile: 16 });

  /* ---- the north wall: paneling, the fireplace, shelves ---- */
  const wallN = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "wallN", tile, ...opts });
  wallN(rect(RX * 2, CEIL - FLOOR, "+z", 0, (yF + yC) / 2, -RZ, 6), M.panel, TX.PANEL_TILE);
  // The chimney breast, fieldstone, round the firebox.
  const cz = -RZ + 2.5, fbW = 18, fbH = 13, hearthH = 3;
  wallN(box(13, yC - yF, 5, -15.5, (yF + yC) / 2, cz), M.stone, TX.STONE_TILE);
  wallN(box(13, yC - yF, 5, 15.5, (yF + yC) / 2, cz), M.stone, TX.STONE_TILE);
  wallN(box(fbW, yC - (yF + hearthH + fbH), 5, 0, (yC + yF + hearthH + fbH) / 2, cz), M.stone, TX.STONE_TILE);
  // The raised hearth, and the firebox: soot inside, logs on a grate.
  wallN(box(54, hearthH, 8, 0, yF + hearthH / 2, -RZ + 9), M.stone, TX.STONE_TILE);
  wallN(box(fbW, 0.4, 5, 0, yF + hearthH - 0.1, cz), M.soot, 8);
  wallN(rect(fbW, fbH, "+z", 0, yF + hearthH + fbH / 2, -RZ + 0.3, 3), M.soot, 8, { k: 1.4 });
  wallN(rect(5, fbH, "+x", -fbW / 2 + 0.05, yF + hearthH + fbH / 2, cz, 3), M.soot, 8, { k: 1.3 });
  wallN(rect(5, fbH, "-x", fbW / 2 - 0.05, yF + hearthH + fbH / 2, cz, 3), M.soot, 8, { k: 1.3 });
  wallN(rect(fbW, 5, "-y", 0, yF + hearthH + fbH - 0.05, cz, 3), M.soot, 8);
  const log = (x, y, z, len, ry, rz) => { const g = new THREE.CylinderGeometry(0.9, 1, len, 10); g.rotateZ(Math.PI / 2 + rz); g.rotateY(ry); g.translate(x, y, z); wallN(g, M.bark, 4, { k: 1.3 }); };
  log(0, yF + hearthH + 1.4, -RZ + 3, 13, 0.08, 0);
  log(-1, yF + hearthH + 3, -RZ + 2.4, 12, -0.12, 0.12);
  log(2, yF + hearthH + 2.6, -RZ + 3.8, 9, 0.5, -0.1);
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.6), M.ember);
  embers.rotation.x = -Math.PI / 2; embers.position.set(0, yF + hearthH + 0.35, -RZ + 3);
  B.mesh(embers, "wallN");
  // The mantel, and what's on it.
  wallN(box(52, 2.6, 4.5, 0, yF + 21.3, -RZ + 7.2), M.walnut, 16);
  const vase = (x, h, r, mat) => wallN(cyl(r * 0.7, r, h, x, yF + 22.6 + h / 2, -RZ + 7, 14), mat, 6);
  vase(-20, 5, 1.2, M.ceramicGold); vase(-16.5, 3, 1.4, M.ceramicOrange); vase(18, 6.5, 0.9, M.ceramicGreen);
  wallN(cyl(0.35, 0.35, 4, 14, yF + 24.6, -RZ + 7, 8), M.marble, 4);
  // The sunburst clock on the chimney, and its hands (they keep the time).
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: T.sun, transparent: true, fog: true, color: 0xd8b890 }));
  disposables.push(sun.geometry, sun.material);
  sun.position.set(0, yF + 34, -RZ + 5.08);
  B.mesh(sun, "wallN");
  const hand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.1); g.translate(0, len / 2 - 0.3, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2a1a0e, fog: true })); disposables.push(g, m.material); m.position.set(0, yF + 34, -RZ + 5.2); B.mesh(m, "wallN"); return m; };
  const hourHand = hand(1.6, 0.28), minuteHand = hand(2.3, 0.2);
  // Shelves either side of the chimney: a cabinet below, books above.
  [-1, 1].forEach((s) => {
    const x0 = s * 22, x1 = s * 58, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    wallN(box(w, 14, 8, cx, yF + 7, -RZ + 4), M.walnut, 16);
    wallN(box(w - 1, 0.5, 0.3, cx, yF + 9, -RZ + 8.1), M.darkWood, 16); // the doors' shadow line
    [yF + 14, yF + 24, yF + 34, yF + 43].forEach((y) => wallN(box(w, 0.8, 7, cx, y, -RZ + 3.5), M.walnut, 16));
    wallN(box(0.8, 29, 7, x1 - s * 0.4, yF + 28.5, -RZ + 3.5), M.walnut, 16);
    // Books on the lower two shelves, things on the top one.
    [yF + 14.4, yF + 24.4].forEach((y, i) => {
      const g = new THREE.PlaneGeometry(w - 3, 9);
      g.translate(cx + (i ? s * 2 : -s * 2), y + 4.5, -RZ + 5.5);
      wallN(g, M.books, null, { k: 1.05 });
      wallN(box(w - 3, 9, 5, cx + (i ? s * 2 : -s * 2), y + 4.5, -RZ + 2.9), M.darkWood, 8);
    });
    wallN(cyl(1.4, 2.2, 6, cx - s * 6, yF + 37.4, -RZ + 3.5, 14), s < 0 ? M.ceramicOrange : M.ceramicGold, 6);
    wallN(cyl(1.8, 1.2, 3.5, cx + s * 5, yF + 36.2, -RZ + 3.5, 14), M.ceramicGreen, 6);
  });
  wallN(box(RX * 2, 2, 0.6, 0, yF + 1, -RZ + 0.3), M.darkWood, 16); // baseboard

  /* ---- the east wall: the glass door onto the yard ---- */
  const wallE = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "wallE", tile, ...opts });
  const doorHalf = 24, doorH = 40;
  wallE(rect(RZ - doorHalf, CEIL - FLOOR, "-x", RX, (yF + yC) / 2, -(RZ + doorHalf) / 2, 6), M.panel, TX.PANEL_TILE);
  wallE(rect(RZ - doorHalf, CEIL - FLOOR, "-x", RX, (yF + yC) / 2, (RZ + doorHalf) / 2, 6), M.panel, TX.PANEL_TILE);
  wallE(rect(doorHalf * 2, CEIL - FLOOR - doorH, "-x", RX, (yF + doorH + yC) / 2, 0, 6), M.panel, TX.PANEL_TILE);
  // The yard, and the rain on the glass.
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(doorHalf * 2, doorH), M.night);
  yard.rotation.y = -Math.PI / 2; yard.position.set(RX + 0.6, yF + doorH / 2, 0);
  B.mesh(yard, "wallE");
  const rainMat = new THREE.MeshBasicMaterial({ map: T.rain, transparent: true, opacity: 0.55, depthWrite: false, fog: true, color: 0xc8d4e4 });
  disposables.push(rainMat);
  T.rain.repeat.set(3, 1.2);
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(doorHalf * 2, doorH), rainMat);
  rain.rotation.y = -Math.PI / 2; rain.position.set(RX + 0.2, yF + doorH / 2, 0);
  B.mesh(rain, "wallE");
  // The frame: dark bronze, a mullion down the middle.
  [[0, doorH, 1.2, 0, yF + doorH / 2], [0, doorH, 1.2, -doorHalf, yF + doorH / 2], [0, doorH, 1.2, doorHalf, yF + doorH / 2]].forEach(([, h, w, z, y]) => wallE(box(1.6, h, w, RX - 0.2, y, z), M.bronze, 8));
  wallE(box(1.6, 1.4, doorHalf * 2 + 1.2, RX - 0.2, yF + doorH + 0.7, 0), M.bronze, 8);
  wallE(box(1.6, 1.2, doorHalf * 2 + 1.2, RX - 0.2, yF + 0.6, 0), M.bronze, 8);
  // The drapes, drawn back either side: heavy folds.
  [-1, 1].forEach((s) => {
    const g = new THREE.PlaneGeometry(15, 45, 30, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.3) * 0.9);
    g.computeVertexNormals();
    g.rotateY(-Math.PI / 2);
    g.translate(RX - 2.6, yF + 22.8, s * (doorHalf + 7));
    wallE(g, M.drapes, null, { floorShade: false });
  });
  const rod = new THREE.CylinderGeometry(0.35, 0.35, doorHalf * 2 + 36, 8); rod.rotateX(Math.PI / 2); rod.translate(RX - 2.4, yF + 45.6, 0);
  wallE(rod, M.brass, 4);
  wallE(box(0.6, 2, RZ * 2, RX - 0.3, yF + 1, 0), M.darkWood, 16);

  /* ---- the south wall: the television, the stereo, a landscape ---- */
  const wallS = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "wallS", tile, ...opts });
  wallS(rect(RX * 2, CEIL - FLOOR, "-z", 0, (yF + yC) / 2, RZ, 6), M.panel, TX.PANEL_TILE);
  wallS(box(RX * 2, 2, 0.6, 0, yF + 1, RZ - 0.3), M.darkWood, 16);
  // The television: a walnut console on tapered legs, the screen (off),
  // a speaker grille, two knobs, rabbit ears on top.
  const tvX = -40, tvZ = RZ - 7;
  wallS(box(34, 17, 11, tvX, yF + 3 + 8.5, tvZ), M.walnut, 16);
  [[-15, -4], [15, -4], [-15, 4], [15, 4]].forEach(([dx, dz]) => wallS(cyl(0.5, 0.3, 3, tvX + dx, yF + 1.5, tvZ + dz, 8), M.darkWood, 4));
  const screen = new THREE.Mesh(makeRoundedBox(16, 12, 0.6, 1.4, 3), M.screen);
  screen.position.set(tvX - 6, yF + 12, tvZ - 5.6);
  B.mesh(screen, "wallS");
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ color: 0xffe6c0, transparent: true, opacity: 0.08, depthWrite: false, fog: true }));
  disposables.push(glare.geometry, glare.material);
  glare.rotation.y = Math.PI; glare.rotation.z = 0.25; glare.position.set(tvX - 7, yF + 15, tvZ - 5.95);
  B.mesh(glare, "wallS");
  const grilleTV = new THREE.PlaneGeometry(9, 12); grilleTV.rotateY(Math.PI); grilleTV.translate(tvX + 9.5, yF + 12, tvZ - 5.55);
  wallS(grilleTV, M.grille, null);
  [yF + 15, yF + 11].forEach((y) => { const k = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 12); k.rotateX(Math.PI / 2); k.translate(tvX + 3.2, y, tvZ - 5.8); wallS(k, M.chrome, 4); });
  [-1, 1].forEach((s) => { const a = new THREE.CylinderGeometry(0.08, 0.08, 12, 5); a.rotateZ(s * 0.5); a.translate(tvX + 6 + s * 3, yF + 20 + 5, tvZ); wallS(a, M.chrome, 4); });
  wallS(cyl(1.2, 1.2, 1.2, tvX + 6, yF + 20.6, tvZ, 10), M.black, 4);
  // A trailing pothos on the set.
  wallS(cyl(2, 1.5, 3, tvX - 11, yF + 21.5, tvZ, 12), M.ceramicGold, 6);
  leafCluster(B, "wallS", M.leaf, tvX - 11, yF + 24, tvZ, 4, 5, 1);
  // The stereo console, its lid shut, records leaning at its end.
  const stX = 24, stZ = RZ - 6.5;
  wallS(box(46, 13, 10, stX, yF + 3 + 6.5, stZ), M.walnut, 16);
  [-1, 1].forEach((s) => { const g = new THREE.PlaneGeometry(11, 9); g.rotateY(Math.PI); g.translate(stX + s * 16, yF + 9.5, stZ - 5.05); wallS(g, M.grille, null); });
  wallS(box(20, 0.6, 9, stX, yF + 16.3, stZ), M.darkWood, 8); // the lid's seam
  [[-21, -3.5], [21, -3.5], [-21, 3.5], [21, 3.5]].forEach(([dx, dz]) => wallS(cyl(0.5, 0.3, 3, stX + dx, yF + 1.5, stZ + dz, 8), M.darkWood, 4));
  const rec = new THREE.BoxGeometry(12, 12.5, 0.6); rec.rotateX(-0.12); rec.translate(stX + 30, yF + 6.25, stZ - 2);
  wallS(rec, M.sleeves, null);
  // The landscape over it, in a gilt frame.
  wallS(box(40, 28, 1.4, stX, yF + 31, RZ - 0.7), M.gold, 8);
  const land = new THREE.PlaneGeometry(36, 24); land.rotateY(Math.PI); land.translate(stX, yF + 31, RZ - 1.45);
  wallS(land, M.landscape, null, { k: 1.25 });
  // The lamp at the stereo's end: a gourd-shaped ceramic base, a pleated shade.
  tableLamp(B, "wallS", M, stX + 20, yF + 16.6, stZ);

  /* ---- the west wall: the flowered paper, the credenza, an abstract ---- */
  const wallW = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "wallW", tile, ...opts });
  wallW(rect(RZ * 2, CEIL - FLOOR, "+x", -RX, (yF + yC) / 2, 0, 6), M.paper, TX.PAPER_TILE);
  wallW(box(0.6, 2, RZ * 2, -RX + 0.3, yF + 1, 0), M.darkWood, 16);
  const crX = -RX + 5;
  wallW(box(10, 12, 66, crX, yF + 2.5 + 6, 0), M.walnut, 16);
  for (let i = -2; i <= 2; i++) wallW(box(0.2, 10, 0.3, crX + 5.05, yF + 8.5, i * 13.2), M.darkWood, 8);
  [-19.8, -6.6, 6.6, 19.8].forEach((z) => wallW(box(0.3, 2.2, 0.6, crX + 5.15, yF + 9, z), M.brass, 4));
  [[-30, -4], [30, -4], [-30, 4], [30, 4]].forEach(([dz, dx]) => wallW(cyl(0.5, 0.3, 2.5, crX + dx, yF + 1.25, dz, 8), M.darkWood, 4));
  tableLamp(B, "wallW", M, crX, yF + 14.5, -26);
  tableLamp(B, "wallW", M, crX, yF + 14.5, 26);
  wallW(box(1.2, 42, 42, -RX + 0.6, yF + 33, 0), M.darkWood, 8);
  const abs = new THREE.PlaneGeometry(40, 40); abs.rotateY(Math.PI / 2); abs.translate(-RX + 1.25, yF + 33, 0);
  wallW(abs, M.abstract, null, { k: 1.15 });
  // The macramé hanger in the north-west corner, a fern in it.
  const hx = -RX + 10, hz = -RZ + 10;
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const g = new THREE.CylinderGeometry(0.1, 0.1, 22, 4); g.translate(hx + Math.cos(a) * 1.2, yC - 11, hz + Math.sin(a) * 1.2); wallW(g, M.rope, 4); }
  wallW(cyl(3.2, 2.2, 4, hx, yC - 23, hz, 14), M.pot, 6);
  leafCluster(B, "wallW", M.leaf, hx, yC - 20, hz, 7, 10, 2);

  /* ---- the room's middle: a club chair and an arc lamp by the door ---- */
  const chX = 70, chZ = -40;
  B.add(M.velvet, box(12, 5, 12, chX, yF + 3.5, chZ, { round: 1.6, ry: -0.5 }), { tile: 6 });
  B.add(M.velvet, box(12, 11, 3.5, chX + Math.sin(-0.5) * 5.2, yF + 8, chZ + Math.cos(-0.5) * -5.2, { round: 1.4, ry: -0.5 }), { tile: 6 });
  [-1, 1].forEach((s) => B.add(M.velvet, box(3, 8, 12, chX + Math.cos(-0.5) * s * 6.5, yF + 5, chZ - Math.sin(-0.5) * s * 6.5, { round: 1.2, ry: -0.5 }), { tile: 6 }));
  B.add(M.plaid, box(10, 5, 9, chX - 12, yF + 2.5, chZ + 12, { round: 1.4, ry: -0.3 }), { tile: TX.PLAID_TILE });
  // The arc lamp: a marble block, a chrome arc, a dome over the chair.
  const lampBase = [84, yF, -46];
  B.add(M.marble, box(5, 4, 5, lampBase[0], yF + 2, lampBase[2]));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(lampBase[0], yF + 4, lampBase[2]), new THREE.Vector3(84, yF + 46, -40), new THREE.Vector3(66, yF + 32, -31));
  B.add(M.chrome, new THREE.TubeGeometry(curve, 24, 0.35, 6, false));
  const dome = new THREE.SphereGeometry(4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(66, yF + 30.5, -31);
  B.add(M.chrome, dome, { k: 1.1 });
  const arcBulb = new THREE.Mesh(new THREE.CircleGeometry(3.6, 18), M.bulb);
  arcBulb.position.set(66, yF + 30.45, -31); arcBulb.rotation.x = Math.PI / 2;
  B.mesh(arcBulb);
  // A rubber plant by the glass.
  B.add(M.pot, cyl(4, 3, 7, RX - 10, yF + 3.5, 38, 16));
  leafCluster(B, "core", M.leaf, RX - 10, yF + 13, 38, 9, 14, 3);

  /* ---- the ceiling, its beams, the swag lamps ---- */
  const ceil = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "ceiling", tile, ...opts });
  ceil(rect(RX * 2, RZ * 2, "-y", 0, yC, 0, 8), M.ceil, TX.CEIL_TILE, { floorShade: false });
  for (let z = -66; z <= 66; z += 22) ceil(box(RX * 2, 3, 3.6, 0, yC - 1.5, z, { step: 16 }), M.walnut, 16, { floorShade: false });
  const swags = [];
  LAMPS.filter((L) => L.name.startsWith("swag")).forEach((L) => {
    const [x, y, z] = L.p;
    ceil(cyl(0.12, 0.12, yC - y - 3, x, (yC + y + 3) / 2, z, 5), M.black, 4);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(3.3, 20, 14), M.globe);
    globe.position.set(x, y, z);
    B.mesh(globe, "ceiling");
    ceil(cyl(1.2, 0.8, 1.2, x, y + 3.6, z, 10), M.brass, 4);
    swags.push(globe);
  });

  /* ---- the lamps' glow (drawn additively over everything) ---- */
  const glows = [];
  const glowAt = (p, size, group, strength = 0.55) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffb870, transparent: true, opacity: strength, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    disposables.push(s.material);
    s.position.set(...p); s.scale.set(size, size, 1);
    B.mesh(s, group);
    glows.push({ s, base: strength });
    return s;
  };
  glowAt(LAMPS[0].p, 16, "ceiling"); glowAt(LAMPS[1].p, 16, "ceiling");
  glowAt([-RX + 5, FLOOR + 21, -26], 18, "wallW", 0.45); glowAt([-RX + 5, FLOOR + 21, 26], 18, "wallW", 0.45);
  glowAt([44, FLOOR + 23.4, RZ - 6.5], 16, "wallS", 0.45);
  glowAt([66, FLOOR + 29, -31], 14, "core", 0.5);
  const fireGlow = glowAt([0, FLOOR + 8, -RZ + 6], 26, "wallN", 0.5);
  fireGlow.material.color.set(0xff8a3a);

  /* ---- the fire: tongues of flame, drawn in a small shader ---- */
  const flames = [];
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float t = uTime;
        float turb = n(vec2(uv.x * 4.0, uv.y * 3.0 - t * 2.2)) * 0.6 + n(vec2(uv.x * 9.0, uv.y * 6.0 - t * 3.7)) * 0.4;
        float width = (1.0 - uv.y) * 0.42 + 0.04;
        float d = abs(uv.x - 0.5 + (turb - 0.5) * 0.28 * uv.y);
        float body = smoothstep(width, width * 0.25, d) * smoothstep(1.0, 0.2, uv.y + turb * 0.35);
        vec3 col = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.8, 0.35), smoothstep(0.1, 0.9, body));
        gl_FragColor = vec4(col * body * 1.3, body);
      }`,
  });
  disposables.push(flameMat);
  for (let i = 0; i < 4; i++) {
    const w = 5 + (i % 2) * 2, hgt = 8 + (i % 3) * 1.5;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), flameMat);
    disposables.push(f.geometry);
    f.position.set(-5 + i * 3.4, FLOOR + 3 + 1.2 + hgt / 2, -RZ + 3 + (i % 2) * 0.8);
    f.rotation.y = (i - 1.5) * 0.25;
    B.mesh(f, "wallN");
    flames.push(f);
  }
  if (!q.physical) flames.forEach((f, i) => { if (i % 2) f.visible = false; });

  B.finish();
  const group = new THREE.Group();
  group.name = "den-room";
  Object.values(B.groups).forEach((g) => group.add(g));

  /* ---- the coffee table and what's on it (lit like the board) ---- */
  const table = buildCoffeeTable(TW, boardSpan);
  group.add(table.group);

  return {
    group,
    groups: B.groups,
    TW, PH,
    table,
    /* Each frame: the fire, the lamps' breath, the rain, the clock, and
       whichever walls the camera has gone behind stepping aside. */
    animate(now, camLocal) {
      const t = now / 1000;
      flameMat.uniforms.uTime.value = t;
      const flick = 0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1 + 1.3) * 0.05 + Math.sin(t * 2.1) * 0.04;
      fireGlow.material.opacity = 0.5 * flick;
      embers.material.color.setRGB(1, 0.36 + 0.08 * flick, 0.08);
      T.rain.offset.y = (T.rain.offset.y + 0.0016) % 1;
      const d = new Date();
      const mins = d.getMinutes() + d.getSeconds() / 60;
      minuteHand.rotation.z = -(mins / 60) * Math.PI * 2;
      hourHand.rotation.z = -(((d.getHours() % 12) + mins / 60) / 12) * Math.PI * 2;
      if (camLocal) {
        /* A sofa side steps aside when its back stands between the camera
           and the board (a low camera pulled back past the pit's edge):
           where the line from the camera to the board crosses that side's
           seats, it's lower than the backs. */
        const backTop = seatTop + backH + 0.5, backFront = PH - backD - 0.3;
        // along: the camera's distance out from the middle toward that side;
        // across: along the side. The sight line from the camera to the
        // board crosses the plane `along = a` at a / along of the way.
        const blocks = (along, across) => {
          if (along <= PH - SD) return false; // the camera's over the pit, this side of the seats
          const hAt = (a) => camLocal.y * (a / along);
          const within = (a) => Math.abs(across * (a / along)) < PH + 2;
          if (along > backFront && hAt(backFront) < backTop && within(backFront)) return true;
          return hAt(PH - SD) < seatTop + 0.5 && within(PH - SD);
        };
        B.groups.sofaN.visible = !blocks(-camLocal.z, camLocal.x);
        B.groups.sofaS.visible = !blocks(camLocal.z, camLocal.x);
        B.groups.sofaW.visible = !blocks(-camLocal.x, camLocal.z);
        B.groups.wallN.visible = camLocal.z > -RZ + 6;
        B.groups.wallS.visible = camLocal.z < RZ - 6;
        B.groups.wallE.visible = camLocal.x < RX - 6;
        B.groups.wallW.visible = camLocal.x > -RX + 6;
        B.groups.ceiling.visible = camLocal.y < CEIL - 3;
      }
    },
    repaint() { table.repaint(); },
    dispose() {
      // The merged meshes and the ones added whole (the fire, the globes...).
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      disposables.forEach((d) => d && d.dispose && d.dispose());
      table.dispose();
    },
  };
}

/* A table lamp: a gourd-shaped ceramic base and a pleated drum shade
   glowing from inside. */
function tableLamp(B, group, M, x, y, z) {
  const pts = [[0, 0], [1.6, 0], [2.6, 1.2], [3, 3], [2.6, 5], [1.4, 6.6], [0.7, 7.6], [0.5, 8.4], [0, 8.4]].map(([r, h]) => new THREE.Vector2(r, h));
  const base = new THREE.LatheGeometry(pts, 16);
  base.translate(x, y, z);
  B.add(M.ceramicGold, base, { group, tile: 4 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.8, 6, 20, 1, true), M.shade);
  shade.position.set(x, y + 10.8, z);
  B.mesh(shade, group);
  const top = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), M.bulb);
  top.rotation.x = -Math.PI / 2; top.position.set(x, y + 13.75, z);
  B.mesh(top, group);
}

/* A plant: a clump of leaves, each a small bent blade, spraying up and
   out from (x, y, z). */
function leafCluster(B, group, mat, x, y, z, radius, count, seed) {
  let s = seed * 97 + 13;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, tilt = 0.4 + rnd() * 0.9, len = radius * (0.5 + rnd() * 0.6);
    const g = new THREE.PlaneGeometry(len * 0.38, len, 1, 3);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setZ(k, -Math.pow((yy + len / 2) / len, 2) * len * 0.35); p.setX(k, p.getX(k) * (1 - Math.abs(yy) / len)); }
    g.computeVertexNormals();
    g.translate(0, len / 2, 0);
    g.rotateX(tilt); g.rotateY(a);
    g.translate(x, y - len * 0.2, z);
    B.add(mat, g, { group, tile: 4, floorShade: false });
  }
}

/* The coffee table: a thick walnut top on a recessed plinth, lit by the
   scene's lights like the board, so the board's shadow falls on it. On
   it, beside the board: the box the game came in, its lid set under it,
   the rules leaflet, two glasses of iced tea on coasters, a bowl of
   party mix. */
function buildCoffeeTable(TW, boardSpan) {
  const q = quality();
  const group = new THREE.Group();
  group.name = "den-table";
  const disposables = [];
  const lit = (o) => { const m = q.physical ? new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }) : new THREE.MeshLambertMaterial(o); disposables.push(m); return m; };
  const mk = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; group.add(m); disposables.push(geo); return m; };
  const topY = -SLAB_THICKNESS;
  // Walnut planks, the grain running across, book-matched at the joints.
  const topTex = canvasTexture(1024, 1024, (g, W) => {
    const planks = 4, pw = W / planks;
    const tones = [{ base: "#5A3A24", grain: "#2E1A0E", figure: "#47301C" }, { base: "#553621", grain: "#2A170C", figure: "#43291A" }];
    for (let i = 0; i < planks; i++) {
      paintWood(g, 0, i * pw, W, pw + 1, { ...tones[i % 2], horizontal: true, seed: 40 + (i % 2), density: 0.6 });
      g.fillStyle = "rgba(18,10,4,0.55)"; g.fillRect(0, i * pw, W, Math.max(1.5, W * 0.0015));
    }
  });
  disposables.push(topTex);
  const walnutTop = lit({ map: topTex, color: 0xe8d8c4, roughness: 0.36 });
  const walnutSide = lit({ color: 0x4a2c18, roughness: 0.55 });
  mk(new THREE.BoxGeometry(TW, 1.1, TW).translate(0, topY - 0.55, 0), [walnutSide, walnutSide, walnutTop, walnutSide, walnutSide, walnutSide]);
  mk(new THREE.BoxGeometry(TW - 6, TABLE_H - 1.1, TW - 6).translate(0, PIT_FLOOR + (TABLE_H - 1.1) / 2, 0), walnutSide);
  // A soft shadow on the shag under the table.
  const blob = TX.contactShadow(); disposables.push(blob);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(TW + 8, TW + 8).rotateX(-Math.PI / 2).translate(0, PIT_FLOOR + 0.1, 0), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, fog: true }));
  group.add(shadow); disposables.push(shadow.geometry, shadow.material);

  // Room left beside the board, where the things go.
  const edge = boardSpan / 2 + 0.6, room = TW / 2 - edge; // about 7 units each side
  const mid = edge + room / 2;
  // The box, its lid back on (the board and the pieces are out), set
  // down at the far corner: the lid's art up.
  const boxImg = new Image();
  const lid = canvasTexture(512, 256, lidPainter(boxImg), { scale: false });
  boxImg.onload = () => repaint(lid);
  boxImg.src = boxArtUrl;
  disposables.push(lid);
  const lidMat = lit({ map: lid, roughness: 0.55 });
  const brownSide = lit({ color: 0x3b2618, roughness: 0.7 });
  const bl = 9, bw = 4.5, bh = 1.3;
  const boxMesh = mk(new THREE.BoxGeometry(bl, bh, bw), [brownSide, brownSide, lidMat, brownSide, brownSide, brownSide], true);
  boxMesh.position.set(-mid, topY + bh / 2, -TW / 2 + bw / 2 + 2);
  boxMesh.rotation.y = Math.PI / 2 + 0.16;
  // The rules leaflet, folded in three, beside it.
  const leafTex = canvasTexture(256, 192, (g, W, H) => {
    g.fillStyle = "#E2D8BD"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#28231F"; g.font = `700 ${Math.round(H * 0.13)}px 'Bodoni Moda', Georgia, serif`; g.textAlign = "center";
    g.fillText("EL CABEZA", W / 2, H * 0.2);
    g.fillStyle = "#A8321F"; g.fillRect(W * 0.2, H * 0.26, W * 0.6, H * 0.02);
    g.fillStyle = "rgba(40,35,31,0.55)";
    for (let c = 0; c < 2; c++) for (let l = 0; l < 9; l++) g.fillRect(W * (0.08 + c * 0.46), H * (0.36 + l * 0.065), W * (0.38 - (l % 4 === 3 ? 0.14 : 0)), H * 0.022);
    g.fillStyle = "rgba(20,12,6,0.12)"; g.fillRect(W / 3 - 1, 0, 2, H); g.fillRect((2 * W) / 3 - 1, 0, 2, H);
  }, { scale: false });
  disposables.push(leafTex);
  const leafMat = lit({ map: leafTex, roughness: 0.9, side: THREE.DoubleSide });
  const leaflet = mk(new THREE.PlaneGeometry(5.4, 4).rotateX(-Math.PI / 2), leafMat);
  leaflet.position.set(-mid + 0.4, topY + 0.03, -TW / 2 + bw + 6.4);
  leaflet.rotation.y = -0.35;
  // Two glasses of iced tea on cork coasters.
  const cork = lit({ color: 0x9a7048, roughness: 0.9 });
  const tea = lit({ color: 0x5e2a0a, roughness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });
  disposables.push(glass);
  const drink = (x, z) => {
    mk(new THREE.CylinderGeometry(1.05, 1.05, 0.14, 24).translate(x, topY + 0.07, z), cork);
    mk(new THREE.CylinderGeometry(0.62, 0.55, 2.1, 20).translate(x, topY + 0.14 + 1.05, z), tea);
    const g = mk(new THREE.CylinderGeometry(0.72, 0.62, 2.9, 20, 1, true).translate(x, topY + 0.14 + 1.45, z), glass, true);
    g.renderOrder = 2;
    // Ice, a little above the tea.
    const ice = lit({ color: 0xe8e4dc, roughness: 0.1 });
    [[0.2, 0.1], [-0.18, -0.15]].forEach(([dx, dz]) => mk(new THREE.BoxGeometry(0.45, 0.4, 0.45).rotateY(dx * 3).translate(x + dx, topY + 2.35, z + dz), ice));
  };
  drink(mid - 0.5, TW / 2 - 3.2);
  drink(-mid + 1.2, TW / 2 - 4.6);
  // A teak bowl of party mix: pretzels, cereal squares, nuts.
  const teak = lit({ color: 0x8a5a30, roughness: 0.5, side: THREE.DoubleSide });
  const bowlPts = [[0, 0], [1.1, 0.04], [1.8, 0.45], [2.1, 1.1], [2.02, 1.14]].map(([r, h]) => new THREE.Vector2(r, h));
  const bowl = mk(new THREE.LatheGeometry(bowlPts, 24), teak, true);
  bowl.position.set(mid - 0.2, topY, -TW / 2 + 4.2);
  const mixTex = canvasTexture(256, 256, (g, W) => {
    let s = 5;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.fillStyle = "#7A5226"; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * W, k = rnd();
      g.save(); g.translate(x, y); g.rotate(rnd() * 6.28);
      if (k < 0.35) { g.fillStyle = ["#C9A060", "#B8894A", "#D8B474"][i % 3]; g.fillRect(-7, -7, 14, 14); g.strokeStyle = "rgba(90,60,25,0.6)"; g.lineWidth = 1.5; g.strokeRect(-7, -7, 14, 14); g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke(); }
      else if (k < 0.6) { g.strokeStyle = "#8A4E1E"; g.lineWidth = 4; g.beginPath(); g.arc(-4, 0, 5, 0, 6.28); g.arc(4, 0, 5, 0, 6.28); g.stroke(); }
      else { g.fillStyle = ["#C08A4E", "#A8733C"][i % 2]; g.beginPath(); g.ellipse(0, 0, 6, 4, 0, 0, 6.28); g.fill(); }
      g.restore();
    }
  }, { scale: false });
  disposables.push(mixTex);
  const mixMat = lit({ map: mixTex, roughness: 0.8 });
  const mix = mk(new THREE.SphereGeometry(1.9, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.28, 1), mixMat);
  mix.position.set(mid - 0.2, topY + 0.95, -TW / 2 + 4.2);

  return {
    group,
    repaint() { repaint(lid); },
    dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); },
  };
}
