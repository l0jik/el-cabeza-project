/* The den: where the copy bought at the store is played, a family room of
   the mid-seventies on a weeknight, the lamps on and rain on the glass.

   Scale as Tienda's: one board square is one unit, about 5 cm (a foot is
   6.1 units). The board sits on a low mosaic-topped coffee table in the middle
   of a sunken conversation pit: built-in sofas in rust corduroy round
   three sides, two steps up on the fourth, burnt-orange shag underfoot.
   Up at the room's floor, avocado shag and walls of walnut paneling:

     north   the fieldstone fireplace, a fire going, the sunburst clock on
             the chimney (it keeps the real time), shelves either side
     east    the sliding glass door onto the dark yard, rain running down
             it, the drapes drawn back; a velvet club chair and an arc lamp
     south   the television, a walnut color console of 1975 (den-tv.js,
             its power knob turns it on); the stereo console (turntable and
             8-track, cabinet speakers with woven grilles, trailing plants,
             an amber-glass ashtray; buildConsole), a landscape in oils over
             it, a lamp; left of it as you face it, the doorway out, its
             door open onto a dim hall
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
import { buildTelevision } from "./den-tv.js";
import boxArtUrl from "../assets/tienda/box-art.jpg";
import bookCoverUrl from "../assets/den/book-cover.jpg";
import bookTailUrl from "../assets/den/book-tail.jpg";
import bookForeUrl from "../assets/den/book-fore.jpg";

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
  { name: "stereo", p: [34, FLOOR + 26, 80], c: WARM, i: 0.8, r: 18 },
  { name: "hall", p: [69, FLOOR + 40, RZ + 18], c: WARM, i: 0.55, r: 15 },
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
    hallPaper: tex(TX.hallPaper(), true),
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
    hallPaper: baked(T.hallPaper),
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
    rubberLeaf: baked(null, { color: 0x3c6a2e, side: THREE.DoubleSide }),
    sheath: baked(null, { color: 0xa2473c }),
    pot: baked(null, { color: 0xb45a2a }),
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
  // The west side's run is a seat's depth short of each corner (its seats
  // are); its two end cushions reach on into the corner, up to the north
  // and south backs, so there's no gap there (user).
  {
    const len = PH * 2 - SD * 2, reach = SD - backD - 0.3 - 0.4;
    const n = Math.max(2, Math.round(len / 15)), w0 = len / n;
    for (let i = 0; i < n; i++) {
      const end = i === 0 ? -1 : i === n - 1 ? 1 : 0;
      const w = w0 - 0.4 + (end ? reach : 0), u = -len / 2 + w0 * (i + 0.5) + end * reach / 2;
      B.add(M.cord, box(backD, backH, w, -PH + backD / 2 + 0.3, seatTop + backH / 2 - 0.4, u, { round: 1.4 }), { group: "sofaW", tile: TX.CORD_TILE });
    }
  }
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

  /* ---- the south wall: the television, the stereo console, the doorway ---- */
  const wallS = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "wallS", tile, ...opts });
  // The doorway out of the den, to the left of the console as you face
  // it from the pit (user: the opposite side of the room from the glass
  // door), its door standing open onto a dim hall.
  const DX0 = 60, DX1 = 78, DH = 41, WT = 5, doorW = DX1 - DX0, doorC = (DX0 + DX1) / 2;
  wallS(rect(RX + DX0, CEIL - FLOOR, "-z", (-RX + DX0) / 2, (yF + yC) / 2, RZ, 6), M.panel, TX.PANEL_TILE);
  wallS(rect(RX - DX1, CEIL - FLOOR, "-z", (DX1 + RX) / 2, (yF + yC) / 2, RZ, 6), M.panel, TX.PANEL_TILE);
  wallS(rect(doorW, CEIL - FLOOR - DH, "-z", doorC, (yF + DH + yC) / 2, RZ, 6), M.panel, TX.PANEL_TILE);
  wallS(box(RX + DX0, 2, 0.6, (-RX + DX0) / 2, yF + 1, RZ - 0.3), M.darkWood, 16);
  wallS(box(RX - DX1, 2, 0.6, (DX1 + RX) / 2, yF + 1, RZ - 0.3), M.darkWood, 16);
  // The wall's thickness in the opening, and a walnut casing round it.
  wallS(rect(WT, DH, "+x", DX0, yF + DH / 2, RZ + WT / 2, 4), M.panel, TX.PANEL_TILE);
  wallS(rect(WT, DH, "-x", DX1, yF + DH / 2, RZ + WT / 2, 4), M.panel, TX.PANEL_TILE);
  wallS(rect(doorW, WT, "-y", doorC, yF + DH, RZ + WT / 2, 4), M.panel, TX.PANEL_TILE);
  const cw = 1.4;
  wallS(box(cw, DH + cw, 0.7, DX0 - cw / 2, yF + (DH + cw) / 2, RZ - 0.35), M.walnut, 16);
  wallS(box(cw, DH + cw, 0.7, DX1 + cw / 2, yF + (DH + cw) / 2, RZ - 0.35), M.walnut, 16);
  wallS(box(doorW + cw * 2, cw, 0.7, doorC, yF + DH + cw / 2, RZ - 0.35), M.walnut, 16);
  // The hall beyond: the shag runs on, papered walls, a light overhead,
  // a small framed print at the end.
  const HZ0 = RZ + WT, HZ1 = RZ + 34, HX0 = 40, HX1 = RX;
  wallS(rect(HX1 - HX0, HZ1 - HZ0, "+y", (HX0 + HX1) / 2, yF, (HZ0 + HZ1) / 2, 6), M.shagRoom, TX.SHAG_TILE);
  wallS(rect(HX1 - HX0, CEIL - FLOOR, "-z", (HX0 + HX1) / 2, (yF + yC) / 2, HZ1, 6), M.hallPaper, TX.HALL_PAPER_TILE);
  wallS(rect(HX1 - HX0, HZ1 - HZ0, "-y", (HX0 + HX1) / 2, yC, (HZ0 + HZ1) / 2, 8), M.ceil, TX.CEIL_TILE, { floorShade: false });
  wallS(rect(HZ1 - HZ0, CEIL - FLOOR, "+x", HX0, (yF + yC) / 2, (HZ0 + HZ1) / 2, 6), M.hallPaper, TX.HALL_PAPER_TILE);
  wallS(rect(HZ1 - HZ0, CEIL - FLOOR, "-x", HX1, (yF + yC) / 2, (HZ0 + HZ1) / 2, 6), M.hallPaper, TX.HALL_PAPER_TILE);
  wallS(box(HX1 - HX0, 2, 0.6, (HX0 + HX1) / 2, yF + 1, HZ1 - 0.3), M.darkWood, 16);
  wallS(box(16, 12, 1, doorC + 4, yF + 24, HZ1 - 0.5), M.gold, 6);
  const hallPrint = new THREE.PlaneGeometry(13.4, 9.4); hallPrint.rotateY(Math.PI); hallPrint.translate(doorC + 4, yF + 24, HZ1 - 1.05);
  wallS(hallPrint, M.landscape, null, { k: 0.9 });
  const hallLight = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), M.bulb);
  hallLight.rotation.x = Math.PI / 2; hallLight.position.set(69, yC - 0.3, RZ + 18);
  B.mesh(hallLight, "wallS");
  // The door, swung open into the hall against its jamb; a brass knob.
  wallS(box(1, DH - 0.6, doorW - 0.8, DX0 + 0.9, yF + (DH - 0.6) / 2, HZ0 + (doorW - 0.8) / 2 + 0.2), M.walnut, 12);
  wallS(new THREE.SphereGeometry(0.55, 10, 8).translate(DX0 + 2, yF + 18.5, HZ0 + doorW - 3.2), M.brass, 4);
  // The television (den-tv.js): a 1975 color console, lit like the stereo
  // and turned on by its power knob.
  const tv = buildTelevision(yF, RZ);
  B.groups.wallS.add(tv.group);
  // Records leaning on the east speaker's side.
  const rec = new THREE.BoxGeometry(0.7, 12.5, 12); rec.rotateZ(-0.13); rec.translate(51.4, yF + 6.25, RZ - 7.2);
  wallS(rec, M.sleeves, null);
  // The landscape over the console, in a gilt frame.
  wallS(box(40, 28, 1.4, 18, yF + 31, RZ - 0.7), M.gold, 8);
  const land = new THREE.PlaneGeometry(36, 24); land.rotateY(Math.PI); land.translate(18, yF + 31, RZ - 1.45);
  wallS(land, M.landscape, null, { k: 1.25 });
  // The lamp at the console's end: a gourd-shaped ceramic base, a pleated shade.
  tableLamp(B, "wallS", M, 34, yF + 16, RZ - 8);
  // The console itself (lit, and close enough to look at: buildConsole).
  const stereo = buildConsole(yF, RZ);
  B.groups.wallS.add(stereo.group);

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
  // The chair is built in its own frame (x across, z out of its front,
  // y from the floor), then turned `chR` to face the room: a skirted base
  // on four walnut feet, the back and the two rolled arms standing on it
  // the full depth, a seat cushion between the arms and a back cushion
  // against the back.
  const chX = 70, chZ = -40, chR = -0.5;
  const cc = Math.cos(chR), cs = Math.sin(chR);
  const part = (mat, w, h, d, lx, ly, lz, round, tile) =>
    B.add(mat, box(w, h, d, chX + lx * cc + lz * cs, yF + ly, chZ - lx * cs + lz * cc, { round, ry: chR }), tile ? { tile } : undefined);
  const CW = 15, CD = 14, AW = 3.2, BT = 3.2, FT = 0.7;
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => part(M.walnut, 1.2, FT, 1.2, sx * (CW / 2 - 1.2), FT / 2, sz * (CD / 2 - 1.2), 0)));
  part(M.velvet, CW, 4.4, CD, 0, FT + 2.2, 0, 1.2, 6);
  part(M.velvet, CW, 13.4, BT, 0, FT + 6.7, -CD / 2 + BT / 2, 1.5, 6);
  [-1, 1].forEach((s) => part(M.velvet, AW, 9, CD, s * (CW / 2 - AW / 2), FT + 4.5, 0, 1.5, 6));
  const inW = CW - AW * 2 - 0.2, inBack = -CD / 2 + BT;
  part(M.velvet, inW, 2.2, CD / 2 - inBack + 0.4, 0, FT + 4.4 + 1.1, (CD / 2 + 0.4 + inBack) / 2, 1, 6);
  part(M.velvet, inW, 6.6, 2.4, 0, FT + 6.6 + 3.3, inBack + 1.2, 1.1, 6);
  // Beside it (the side away from the lamp): a walnut end table of the
  // period, the user's ask, "a small, era correct table next to the
  // chair": a square top with a softened edge a little over the arm's
  // height, four round tapered legs, a shelf low down between them.
  const etX = -(CW / 2 + 6), etZ = 0.8, etTop = 10.8;
  part(M.walnut, 9.2, 0.8, 9.2, etX, etTop - 0.4, etZ, 0.3, 5);
  part(M.walnut, 7.4, 0.45, 7.4, etX, 3.2, etZ, 0.15, 5);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const lx = etX + sx * 3.7, lz = etZ + sz * 3.7;
    const leg = new THREE.CylinderGeometry(0.34, 0.2, etTop - 0.8, 10);
    leg.translate(chX + lx * cc + lz * cs, yF + (etTop - 0.8) / 2, chZ - lx * cs + lz * cc);
    B.add(M.walnut, leg, { tile: 4 });
  });
  /* On it, the book the user asked for, from their own photograph:
     "Abstract Strategy: How the Masses Are Demanding the Future... Now!",
     by Dr. Alistair Finch-Hatton. The photo shows it at an angle; the
     cover and the two page edges it shows (the tail with its red ribbon,
     the fore-edge) were squared up from it (assets/den/book-*.jpg). A
     hardcover about 7.5 x 9.5 in and 2 in thick, lying a little askew,
     its ribbon trailing out onto the table. */
  let bookPlace = null, bookSize = null; // for the tap and the camera's visit (below)
  {
    const bookTex = (url) => { const t = tex(new THREE.TextureLoader().load(url)); t.anisotropy = 4; return t; };
    const coverMat = baked(bookTex(bookCoverUrl));
    const tailMat = baked(bookTex(bookTailUrl));
    const foreMat = baked(bookTex(bookForeUrl));
    const spineMat = baked(null, { color: 0xc98a3a });
    const ribbonMat = baked(null, { color: 0xb3262b, side: THREE.DoubleSide });
    const BW = 3.8, BL = 4.75, BT = 1.0;
    const bx = etX + 0.4, bz = etZ - 0.2;
    const place = new THREE.Matrix4().makeRotationY(chR + 0.32);
    place.setPosition(chX + bx * cc + bz * cs, yF + etTop + 0.005, chZ - bx * cs + bz * cc);
    bookPlace = place.clone(); bookSize = { w: BW, l: BL, t: BT };
    const face = (geo, mat) => { geo.applyMatrix4(place); B.add(mat, geo); };
    face(new THREE.PlaneGeometry(BW, BL).rotateX(-Math.PI / 2).translate(0, BT, 0), coverMat);
    face(new THREE.PlaneGeometry(BW, BT).translate(0, BT / 2, BL / 2), tailMat);
    face(new THREE.PlaneGeometry(BW, BT).rotateY(Math.PI).translate(0, BT / 2, -BL / 2), tailMat);
    const fore = new THREE.PlaneGeometry(BL, BT);
    { const uv = fore.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } // head at the image's left
    face(fore.rotateY(Math.PI / 2).translate(BW / 2, BT / 2, 0), foreMat);
    face(new THREE.PlaneGeometry(BL, BT).rotateY(-Math.PI / 2).translate(-BW / 2, BT / 2, 0), spineMat);
    // The ribbon, out of the tail's pages about a fifth of the way from the spine.
    face(new THREE.PlaneGeometry(0.28, 1.2).rotateX(-Math.PI / 2).rotateY(0.25).translate(-BW / 2 + 0.95, 0.012, BL / 2 + 0.5), ribbonMat);
  }
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
  // A rubber plant by the glass (rubberPlant below).
  rubberPlant(B, M, RX - 10, yF, 38);

  /* ---- the ceiling, its beams, the swag lamps ---- */
  const ceil = (geo, mat, tile, opts = {}) => B.add(mat, geo, { group: "ceiling", tile, ...opts });
  ceil(rect(RX * 2, RZ * 2, "-y", 0, yC, 0, 8), M.ceil, TX.CEIL_TILE, { floorShade: false });
  for (let z = -66; z <= 66; z += 22) ceil(box(RX * 2, 3, 3.6, 0, yC - 1.5, z, { step: 16 }), M.walnut, 16, { floorShade: false });
  const swags = [];
  // The swag lamps hang in the room, not in the ceiling's group: when the
  // camera rises past the ceiling and it steps aside (the roof off), the
  // globes stay, their cords with them (user: they vanished).
  LAMPS.filter((L) => L.name.startsWith("swag")).forEach((L) => {
    const [x, y, z] = L.p;
    // The cord runs on up well past the ceiling (user: from high up with the
    // ceiling stepped aside, it shouldn't be seen to stop), so the room
    // reads as taller than it is; the fog takes its far end.
    const cordTop = yC + 400;
    B.add(M.black, cyl(0.12, 0.12, cordTop - y - 3, x, (cordTop + y + 3) / 2, z, 5), { group: "core", tile: 4, floorShade: false });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(3.3, 20, 14), M.globe);
    globe.position.set(x, y, z);
    B.mesh(globe, "core");
    B.add(M.brass, cyl(1.2, 0.8, 1.2, x, y + 3.6, z, 10), { group: "core", tile: 4, floorShade: false });
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
  glowAt(LAMPS[0].p, 16, "core"); glowAt(LAMPS[1].p, 16, "core");
  glowAt([-RX + 5, FLOOR + 21, -26], 18, "wallW", 0.45); glowAt([-RX + 5, FLOOR + 21, 26], 18, "wallW", 0.45);
  glowAt([34, FLOOR + 26.8, RZ - 8], 16, "wallS", 0.45);
  glowAt([69, CEIL - 2, RZ + 18], 12, "wallS", 0.4);
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

  /* ---- the lamps are switches: focus (den-fx.js) ----
     Each of them on its own: the lamp on the stereo console, the two on
     the credenza, and the two amber globes hanging from the ceiling (not
     the arc lamp by the chair: the user's word). Unseen shapes round each
     to catch a tap (the lamps are baked into the room's merged meshes);
     each knows the group it stands in, so a lamp whose wall or ceiling
     has stepped aside out of the camera's way can't be tapped. */
  const lampPickables = [];
  {
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(hidden);
    const catcher = (geo, lampGroup, x, y, z) => {
      const m = new THREE.Mesh(geo, hidden);
      m.position.set(x, y, z);
      m.userData.focusLamp = true;
      m.userData.lampGroup = lampGroup;
      disposables.push(geo);
      group.add(m);
      lampPickables.push(m);
    };
    // A table lamp (tableLamp: its base from y, its shade up to y + 13.8).
    const tableLampAt = (lampGroup, x, y, z) => catcher(new THREE.BoxGeometry(10.5, 14.5, 10.5), lampGroup, x, y + 7, z);
    tableLampAt("wallS", 34, yF + 16, RZ - 8);
    tableLampAt("wallW", crX, yF + 14.5, -26);
    tableLampAt("wallW", crX, yF + 14.5, 26);
    LAMPS.filter((L) => L.name.startsWith("swag")).forEach((L) => catcher(new THREE.SphereGeometry(4.6, 12, 8), "core", L.p[0], L.p[1], L.p[2]));
  }

  /* ---- the book by the chair: a tap takes the camera to it (den-fx.js) ----
     An unseen box a little bigger than it catches the tap; its pose (in
     the room's frame) tells the camera where to look: the cover's centre,
     which way is up on the page (the book's head, -z in its own frame: the
     tail, with the ribbon, is +z) and how big it is. */
  const bookPickables = [];
  let bookFocus = null;
  if (bookPlace) {
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(hidden);
    const g = new THREE.BoxGeometry(bookSize.w + 0.5, bookSize.t + 0.5, bookSize.l + 0.5).translate(0, bookSize.t / 2, 0);
    g.applyMatrix4(bookPlace);
    disposables.push(g);
    const m = new THREE.Mesh(g, hidden);
    m.userData.book = true;
    group.add(m);
    bookPickables.push(m);
    const rot = new THREE.Matrix4().extractRotation(bookPlace);
    bookFocus = {
      center: new THREE.Vector3(0, bookSize.t, 0).applyMatrix4(bookPlace),
      head: new THREE.Vector3(0, 0, -1).applyMatrix4(rot).normalize(), // the cover's top, on the table
      across: new THREE.Vector3(1, 0, 0).applyMatrix4(rot).normalize(),
      halfW: bookSize.w / 2, halfL: bookSize.l / 2,
    };
  }

  /* ---- the coffee table and what's on it (lit like the board) ---- */
  const table = buildCoffeeTable(TW, boardSpan);
  group.add(table.group);

  let lastNow = 0;
  return {
    group,
    groups: B.groups,
    TW, PH,
    table,
    lamp: { pickables: lampPickables },
    book: { pickables: bookPickables, focus: bookFocus },
    stereo,
    tv,
    // The fireplace's mouth, where its sound comes from (den-fx.js).
    firePoint: new THREE.Vector3(0, FLOOR + 8, -RZ + 3),
    /* Each frame: the fire, the lamps' breath, the rain, the clock, the
       stereo (`music`: { open, playing }), and whichever walls the camera
       has gone behind stepping aside. */
    animate(now, camLocal, music = {}) {
      const t = now / 1000;
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now;
      stereo.animate(dt, music);
      table.animate(t, camLocal);
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
          // Only close behind it, where its back would fill the view. From
          // across the room (zoomed out, circling), it's part of the room:
          // taking it away left a hole in the pit (the user's video).
          if (along - backFront > 22) return false;
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
    repaint() { table.repaint(); tv.repaint(); },
    dispose() {
      // The merged meshes and the ones added whole (the fire, the globes...).
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      disposables.forEach((d) => d && d.dispose && d.dispose());
      table.dispose();
      stereo.dispose();
      tv.dispose();
    },
  };
}

/* The stereo console on the south wall, built to be looked at up close
   (the camera comes over to it when music is chosen; den-fx.js): lit by
   the scene's lights and its own lamp, not baked like the rest of the room.

   A long walnut cabinet on tapered legs. Set into its top, a turntable
   under a smoked acrylic lid that lifts when you come over; in its face,
   the receiver's amber dial and the 8-track deck's slot with its four
   program lights. Either side, a walnut cabinet speaker with a woven
   grille: on the left (as the player sees it, by the arc lamp) a heartleaf
   philodendron, its vines trailing down over the cloth, on the right a
   studio-pottery bottle vase. On top,
   a heavy amber-glass ashtray
   and the sleeve of the record on the turntable.

   `focus`: where the camera looks from and at (den-local). `pickables`:
   the machines, each carrying userData.music ("record" or "8track"), for
   a tap in the room to open the music menu. */
function buildConsole(yF, RZ) {
  const q = quality();
  const group = new THREE.Group();
  group.name = "den-console";
  const disposables = [];
  const lit = (o) => { const m = q.physical ? new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }) : new THREE.MeshLambertMaterial(o); disposables.push(m); return m; };
  const add = (geo, mat, parent = group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); disposables.push(geo); return m; };
  const CX = 18, CZ = RZ - 7, FRONT = CZ - 5, TOP = yF + 16, WELL = yF + 14.8;

  // Walnut with a straight grain, running along the cabinet.
  const grain = canvasTexture(512, 256, (g, W, H) => paintWood(g, 0, 0, W, H, { base: "#5C3A22", grain: "#2C180C", figure: "#48301C", horizontal: true, seed: 71, density: 0.7 }));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  disposables.push(grain);
  const walnut = lit({ map: grain, color: 0xead6c2, roughness: 0.4 });
  const walnutDark = lit({ color: 0x2e1b0f, roughness: 0.6 });
  // Metals without much metalness: there's nothing in the room for them
  // to mirror (no environment map), and a fully metallic surface with
  // nothing to reflect renders black.
  const brass = lit({ color: 0xd8b25a, roughness: 0.28, metalness: q.physical ? 0.35 : 0 });
  const chrome = lit({ color: 0xdedcd6, roughness: 0.2, metalness: q.physical ? 0.3 : 0 });
  const black = lit({ color: 0x151311, roughness: 0.45 });
  // Brushed aluminium, for the receiver's face.
  const brushed = canvasTexture(256, 128, (g, W, H) => {
    g.fillStyle = "#BFBDB6"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "40,38,34"},${0.03 + Math.random() * 0.06})`; g.fillRect(0, y, W, 1); }
  });
  disposables.push(brushed);
  const alu = lit({ map: brushed, color: 0xf0eee8, roughness: 0.34, metalness: q.physical ? 0.25 : 0 });

  /* ---- the cabinet ---- */
  add(new THREE.BoxGeometry(46, 11.8, 10).translate(CX, yF + 3 + 5.9, CZ), walnut);
  add(new THREE.BoxGeometry(13, 1.2, 10).translate(1.5, WELL + 0.6, CZ), walnut);
  add(new THREE.BoxGeometry(17, 1.2, 10).translate(32.5, WELL + 0.6, CZ), walnut);
  add(new THREE.BoxGeometry(16, 1.2, 1.5).translate(16, WELL + 0.6, FRONT + 0.75), walnut);
  add(new THREE.BoxGeometry(16, 1.2, 1.5).translate(16, WELL + 0.6, CZ + 4.25), walnut);
  [[-3, -3.6], [39, -3.6], [-3, 3.6], [39, 3.6]].forEach(([x, dz]) => add(new THREE.CylinderGeometry(0.55, 0.32, 3, 10).translate(x, yF + 1.5, CZ + dz), walnutDark));
  // Two cabinet doors either side of the receiver, brass pulls.
  [1.8, 34.2].forEach((x) => {
    add(new THREE.BoxGeometry(13.4, 10.4, 0.4).translate(x, yF + 9, FRONT - 0.15), walnut);
    add(new THREE.BoxGeometry(0.5, 2.6, 0.4).translate(x + (x < CX ? 5.4 : -5.4), yF + 9.4, FRONT - 0.5), brass);
  });
  /* ---- the receiver and the 8-track deck ---- */
  add(new THREE.BoxGeometry(17, 10.4, 0.4).translate(CX, yF + 9, FRONT - 0.15), alu);
  // The dial: an amber-lit window with its scale and a red pointer.
  const dialTex = canvasTexture(512, 96, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "#3B2206"); grad.addColorStop(0.5, "#6E4412"); grad.addColorStop(1, "#3B2206");
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = "#F7D79A"; g.font = `600 ${Math.round(H * 0.2)}px 'IBM Plex Sans', Arial, sans-serif`; g.textAlign = "center";
    ["88", "92", "96", "100", "104", "108"].forEach((t, i) => g.fillText(t, W * (0.08 + i * 0.168), H * 0.34));
    ["530", "700", "900", "1100", "1400", "1600"].forEach((t, i) => g.fillText(t, W * (0.08 + i * 0.168), H * 0.9));
    g.fillStyle = "rgba(247,215,154,0.75)";
    for (let i = 0; i <= 50; i++) g.fillRect(W * (0.05 + i * 0.018), H * (i % 5 ? 0.46 : 0.42), 1.5, H * (i % 5 ? 0.08 : 0.16));
    g.font = `700 ${Math.round(H * 0.14)}px 'IBM Plex Sans', Arial, sans-serif`; g.fillText("FM", W * 0.975, H * 0.34); g.fillText("AM", W * 0.975, H * 0.9);
  }, { scale: false });
  disposables.push(dialTex);
  const dialMat = new THREE.MeshBasicMaterial({ map: dialTex, color: 0x6a5a48, fog: true });
  disposables.push(dialMat);
  add(new THREE.PlaneGeometry(14, 2.5).rotateY(Math.PI).translate(CX, yF + 12.4, FRONT - 0.38), dialMat);
  add(new THREE.BoxGeometry(0.12, 2.3, 0.05).translate(CX + 2.6, yF + 12.4, FRONT - 0.43), lit({ color: 0xc8281c, roughness: 0.4 }));
  [[0, 1.4, 14.6, 0.3], [0, -1.4, 14.6, 0.3], [-7.15, 0, 0.3, 3.1], [7.15, 0, 0.3, 3.1]].forEach(([dx, dy, w, h]) => add(new THREE.BoxGeometry(w, h, 0.2).translate(CX + dx, yF + 12.4 + dy, FRONT - 0.45), chrome));
  // Knobs: volume, balance, bass, treble.
  [11.6, 13.9, 22.1, 24.4].forEach((x) => {
    add(new THREE.CylinderGeometry(0.72, 0.78, 0.7, 20).rotateX(Math.PI / 2).translate(x, yF + 9.1, FRONT - 0.7), chrome);
    add(new THREE.BoxGeometry(0.1, 0.5, 0.05).translate(x, yF + 9.4, FRONT - 1.07), black);
  });
  // The 8-track slot in its chrome bezel, the PROGRAM button, the four lights.
  add(new THREE.BoxGeometry(5.8, 1.9, 0.3).translate(CX, yF + 6.3, FRONT - 0.45), chrome);
  add(new THREE.PlaneGeometry(5, 1.1).rotateY(Math.PI).translate(CX, yF + 6.3, FRONT - 0.61), black);
  const button = add(new THREE.BoxGeometry(1.3, 0.8, 0.5).translate(CX - 5.2, yF + 6.3, FRONT - 0.55), black);
  button.userData.music = "8track";
  const progMats = [0, 1, 2, 3].map(() => { const m = new THREE.MeshBasicMaterial({ color: 0x3a1a0a, fog: true }); disposables.push(m); return m; });
  progMats.forEach((m, i) => add(new THREE.PlaneGeometry(0.42, 0.34).rotateY(Math.PI).translate(CX + 3.9 + i * 0.62, yF + 6.3, FRONT - 0.37), m));
  // An 8-track cartridge, in the slot while one plays.
  const cartTex = canvasTexture(256, 128, (g, W, H) => {
    g.fillStyle = "#16120F"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#E8C466"; g.fillRect(W * 0.08, H * 0.18, W * 0.84, H * 0.64);
    g.fillStyle = "#6B2A12"; g.font = `800 ${Math.round(H * 0.24)}px 'Bodoni Moda', Georgia, serif`; g.textAlign = "center"; g.fillText("STEREO 8", W / 2, H * 0.58);
  }, { scale: false });
  disposables.push(cartTex);
  const cart = add(new THREE.BoxGeometry(4.6, 0.95, 5.2), [black, black, lit({ map: cartTex, roughness: 0.5 }), black, black, black]);
  cart.position.set(CX, yF + 6.3, FRONT + 1.6);
  cart.visible = false;
  const faceplate = group.children.find((m) => m.material === alu);
  if (faceplate) faceplate.userData.music = "8track";

  /* ---- the turntable, in the well in the top ---- */
  const tt = new THREE.Group();
  group.add(tt);
  add(new THREE.BoxGeometry(15.6, 0.7, 6.8).translate(16, WELL + 0.35, CZ), lit({ color: 0x1e1b18, roughness: 0.35 }), tt).userData.music = "record";
  // The platter, its strobe edge, the record on it (the label's own
  // colours, the grooves catching the light).
  const platter = new THREE.Group();
  platter.position.set(13.8, WELL + 0.7, CZ);
  tt.add(platter);
  add(new THREE.CylinderGeometry(3.05, 3.05, 0.5, 48, 1, true).translate(0, 0.25, 0), chrome, platter);
  const recTex = canvasTexture(512, 512, (g, W) => {
    const c = W / 2;
    g.fillStyle = "#0C0B0B"; g.beginPath(); g.arc(c, c, c, 0, 6.28); g.fill();
    for (let r = c * 0.36; r < c * 0.98; r += 1.6) { g.strokeStyle = `rgba(255,255,255,${0.025 + (Math.sin(r * 0.9) + 1) * 0.02})`; g.lineWidth = 0.8; g.beginPath(); g.arc(c, c, r, 0, 6.28); g.stroke(); }
    [0.55, 0.72, 0.86].forEach((f) => { g.strokeStyle = "rgba(0,0,0,0.9)"; g.lineWidth = 2.5; g.beginPath(); g.arc(c, c, c * f, 0, 6.28); g.stroke(); });
    const lg = g.createRadialGradient(c, c, 0, c, c, c * 0.33); lg.addColorStop(0, "#F0C04A"); lg.addColorStop(1, "#D08A1E");
    g.fillStyle = lg; g.beginPath(); g.arc(c, c, c * 0.33, 0, 6.28); g.fill();
    g.fillStyle = "#6B1E0E"; g.font = `700 ${Math.round(W * 0.045)}px 'Bodoni Moda', Georgia, serif`; g.textAlign = "center"; g.fillText("STEREO", c, c - W * 0.08);
    g.font = `500 ${Math.round(W * 0.028)}px 'IBM Plex Sans', Arial, sans-serif`; g.fillText("33⅓ RPM", c, c + W * 0.11);
    // A highlight across the vinyl, where the lamp's light falls.
    const hl = g.createLinearGradient(0, 0, W, W); hl.addColorStop(0.35, "rgba(255,255,255,0)"); hl.addColorStop(0.5, "rgba(255,240,220,0.08)"); hl.addColorStop(0.65, "rgba(255,255,255,0)");
    g.fillStyle = hl; g.beginPath(); g.arc(c, c, c * 0.98, 0, 6.28); g.arc(c, c, c * 0.34, 0, 6.28, true); g.fill();
  }, { scale: false });
  disposables.push(recTex);
  const disc = add(new THREE.CircleGeometry(2.95, 48).rotateX(-Math.PI / 2).translate(0, 0.52, 0), lit({ map: recTex, roughness: 0.28 }), platter);
  disc.userData.music = "record";
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8).translate(0, 0.8, 0), chrome, platter);
  // The tonearm: a chrome tube on its pivot at the back right, the
  // headshell at the end; it swings out over the record to play.
  const pivot = new THREE.Vector3(19.8, WELL + 0.7, CZ + 2.4);
  add(new THREE.CylinderGeometry(0.55, 0.65, 0.9, 16).translate(pivot.x, pivot.y + 0.45, pivot.z), black, tt);
  const arm = new THREE.Group();
  arm.position.set(pivot.x, pivot.y + 1.05, pivot.z);
  tt.add(arm);
  const ARM = 5.4;
  add(new THREE.CylinderGeometry(0.09, 0.09, ARM, 10).rotateX(Math.PI / 2).translate(0, 0, -ARM / 2), chrome, arm);
  add(new THREE.BoxGeometry(0.6, 0.18, 1.1).translate(0, -0.05, -ARM - 0.3), black, arm);
  add(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12).rotateX(Math.PI / 2).translate(0, 0, 0.9), chrome, arm); // the counterweight
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8).translate(pivot.x - 0.1, pivot.y + 0.4, pivot.z - 3.2), chrome, tt); // the arm rest
  // Swing angles: at rest by its post, and playing (the stylus in the
  // record's lead-in, 2.7 from the spindle).
  const REST = 0;
  let PLAY = 0;
  for (let a = 0; a < 1.2; a += 0.002) {
    const tipX = pivot.x - Math.sin(a) * ARM, tipZ = pivot.z - Math.cos(a) * ARM;
    if (Math.hypot(tipX - platter.position.x, tipZ - platter.position.z) < 2.7) { PLAY = a; break; }
  }
  // The smoked lid, hinged at the back.
  const lidHinge = new THREE.Group();
  lidHinge.position.set(16, TOP, CZ + 3.5);
  tt.add(lidHinge);
  const smoked = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
  disposables.push(smoked);
  const lid = add(new THREE.BoxGeometry(15.8, 1.6, 7).translate(0, 0.8, -3.5), smoked, lidHinge);
  lid.renderOrder = 2;
  lid.userData.music = "record";

  /* ---- the speakers: a plant on the left, pottery on the right ---- */
  const cloth = TX.grilleCloth(); cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping; cloth.repeat.set(2, 4); disposables.push(cloth);
  const clothMat = lit({ map: cloth, color: 0xe8d8c0, roughness: 0.95 });
  const leafGeo = heartLeaf();
  disposables.push(leafGeo);
  const plants = [];
  // As the player sees the console (from the pit, facing the south wall),
  // den x runs right to left: x 46 is the left-hand speaker, x -10 the
  // right. The user first asked for the pottery on the left, then to swap
  // them: the arc lamp and the vase side by side threw the room's balance
  // off, so the plant is on the left (by the lamp) and the vase on the right.
  [[46, "philodendron"], [-10, "pottery"]].forEach(([sx, kind], si) => {
    const sz = CZ + 0.5, sFront = sz - 3.75;
    add(new THREE.BoxGeometry(7, 1, 6.5).translate(sx, yF + 0.5, sz), walnutDark);
    add(new THREE.BoxGeometry(8, 16, 7.5).translate(sx, yF + 9, sz), walnut);
    add(new THREE.PlaneGeometry(6.6, 14.4).rotateY(Math.PI).translate(sx, yF + 9, sFront - 0.03), clothMat);
    // A thin walnut frame round the cloth.
    [[0, 7.45, 8, 0.7], [0, -7.45, 8, 0.7], [-3.65, 0, 0.7, 15.6], [3.65, 0, 0.7, 15.6]].forEach(([dx, dy, w, h]) => add(new THREE.BoxGeometry(w, h, 0.4).translate(sx + dx, yF + 9 + dy, sFront - 0.12), walnut));
    if (kind === "pottery") {
      // Not a second plant (the two read as the same one): a studio-
      // pottery bottle vase of the period, a dark tenmoku glaze run down
      // over a speckled oatmeal body, the foot left raw (glazeTexture).
      const vasePts = [[0, 0], [1.25, 0], [1.45, 0.12], [1.5, 0.3], [2.05, 1.2], [2.35, 2.3], [2.3, 3.3], [1.95, 4.3], [1.3, 5.2], [0.75, 5.9], [0.6, 6.5], [0.62, 7.1], [0.82, 7.4], [0.72, 7.52], [0.48, 7.2], [0, 7.2]].map(([r, h]) => new THREE.Vector2(r, h));
      const glaze = glazeTexture();
      disposables.push(glaze);
      add(new THREE.LatheGeometry(vasePts, 40).translate(sx - 0.4, yF + 17, sz + 0.4), lit({ map: glaze, roughness: 0.22 }));
      return;
    }
    // The pot: glazed stoneware in harvest gold.
    const potPts = [[0, 0], [1.6, 0], [2.2, 0.4], [2.6, 2.6], [2.8, 3.3], [2.55, 3.35], [2.35, 2.9], [0, 2.9]].map(([r, h]) => new THREE.Vector2(r, h));
    add(new THREE.LatheGeometry(potPts, 24).translate(sx, yF + 17, sz), lit({ color: 0xb07a2a, roughness: 0.28 }));
    add(new THREE.CircleGeometry(2.45, 20).rotateX(-Math.PI / 2).translate(sx, yF + 17 + 2.95, sz), lit({ color: 0x3a2616, roughness: 0.95 }));
    plants.push(trailingPlant({ x: sx, y: yF + 17 + 3, z: sz, front: sFront, kind, seed: 17 + si * 31, floorY: yF + 3, leafGeo, disposables }));
  });
  plants.forEach((p) => group.add(p));

  /* ---- on top: the ashtray, the record's sleeve ---- */
  const trayPts = [[0, 0], [1.9, 0], [2.2, 0.25], [2.25, 1.0], [2.1, 1.15], [1.35, 1.1], [1.1, 0.55], [0, 0.5]].map(([r, h]) => new THREE.Vector2(r, h));
  const trayGeo = new THREE.LatheGeometry(trayPts, 40);
  { // Four rests notched into the rim.
    const pos = trayGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y < 0.9) continue;
      const a = Math.atan2(z, x), notch = Math.pow(Math.max(0, Math.cos(a * 4)), 24);
      pos.setY(i, y - notch * 0.42);
    }
    trayGeo.computeVertexNormals();
  }
  const amber = new THREE.MeshStandardMaterial({ color: 0xc86f14, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.8, emissive: 0x3a1602, emissiveIntensity: 0.6 });
  disposables.push(amber);
  const tray = add(trayGeo.translate(1.8, TOP, CZ - 0.6), amber);
  tray.renderOrder = 2;
  const sleeveTex = canvasTexture(256, 256, (g, W) => {
    const bg = g.createLinearGradient(0, 0, W, W); bg.addColorStop(0, "#D8742A"); bg.addColorStop(1, "#7A2E14");
    g.fillStyle = bg; g.fillRect(0, 0, W, W);
    g.strokeStyle = "rgba(250,220,160,0.85)"; g.lineWidth = W * 0.035;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(W * 0.5, W * 1.05, W * (0.25 + i * 0.12), Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    g.fillStyle = "#FBE7C0"; g.font = `700 ${Math.round(W * 0.1)}px 'Bodoni Moda', Georgia, serif`; g.textAlign = "center"; g.fillText("Sunset Drive", W / 2, W * 0.2);
  }, { scale: false });
  disposables.push(sleeveTex);
  add(new THREE.BoxGeometry(6.3, 0.1, 6.3).rotateY(0.08).translate(27.6, TOP + 0.05, CZ - 0.2), [black, black, lit({ map: sleeveTex, roughness: 0.6 }), black, black, black]);

  // The console's lamp, lighting it from the east end.
  const lamp = new THREE.PointLight(0xffc27a, 1.15, 62, 2);
  lamp.position.set(34, yF + 25, CZ - 3);
  group.add(lamp);

  // The parts that never move or change are merged, one mesh per material:
  // the console is dozens of pieces but only a handful of draw calls.
  {
    const byMat = new Map();
    group.children.filter((m) => m.isMesh && !m.userData.music && m !== cart && !Array.isArray(m.material)).forEach((m) => {
      m.updateMatrix();
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      Object.keys(flat.attributes).forEach((k) => { if (!["position", "normal", "uv"].includes(k)) flat.deleteAttribute(k); });
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(flat);
      group.remove(m);
    });
    byMat.forEach((geos, mat) => {
      const merged = geos.length > 1 ? BufferGeometryUtils.mergeBufferGeometries(geos, false) : geos[0];
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      disposables.push(merged);
      group.add(new THREE.Mesh(merged, mat));
    });
  }
  group.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; } });
  const pickables = [];
  group.traverse((o) => { if (o.isMesh && o.userData.music) pickables.push(o); });

  let lidA = 0, armA = REST, spin = 0;
  return {
    group,
    pickables,
    // Where the camera goes to look (den-local): in front of the console,
    // up above the pit's south sofa, the speakers either side in view.
    focus: { target: new THREE.Vector3(CX, yF + 11, CZ), eye: new THREE.Vector3(CX, yF + 27, CZ - 58) },
    /* Each frame: `open` (the camera is over here, or a record plays) lifts
       the lid; `playing` ("record" or "8track") spins the platter and
       swings the arm in, or seats a cartridge and lights its program. */
    animate(dt, { open, playing }) {
      const k = 1 - Math.exp(-dt * 3);
      lidA += ((open || playing === "record" ? -1.15 : 0) - lidA) * k;
      lidHinge.rotation.x = lidA;
      armA += ((playing === "record" ? PLAY : REST) - armA) * k;
      arm.rotation.y = armA;
      if (playing === "record") { spin -= dt * (Math.PI * 2 * 33.333) / 60; platter.rotation.y = spin; }
      cart.visible = playing === "8track";
      progMats.forEach((m, i) => m.color.setHex(playing === "8track" && i === 0 ? 0xffb34a : 0x3a1a0a));
      dialMat.color.setHex(playing ? 0xffffff : 0x6a5a48);
    },
    dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); },
  };
}

/* A heart-shaped leaf, its stem at the origin and its tip along +y, a
   little folded along the midrib. */
function heartLeaf() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.bezierCurveTo(-0.12, -0.04, -0.46, 0.0, -0.46, 0.32);
  s.bezierCurveTo(-0.46, 0.62, -0.18, 0.82, 0, 1.0);
  s.bezierCurveTo(0.18, 0.82, 0.46, 0.62, 0.46, 0.32);
  s.bezierCurveTo(0.46, 0.0, 0.12, -0.04, 0, 0.08);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -0.14 * Math.pow(p.getX(i) / 0.46, 2));
  g.computeVertexNormals();
  return g;
}

/* A trailing houseplant in its pot at (x, y, z): a crown of leaves, and
   vines that run forward over the speaker's front edge (`front`) and hang
   down the grille. The golden pothos is splashed with yellow; the
   heartleaf philodendron is a deep glossy green with smaller leaves. */
/* The bottle vase's glaze, painted along the lathe (u around, v up the
   profile): the raw buff clay of the foot, a speckled oatmeal body, and a
   dark tenmoku from the shoulder up, running down in drips with a rusty
   edge where it thins. */
function glazeTexture() {
  return canvasTexture(256, 256, (g, W, H) => {
    let s = 1975;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const y = (v) => (1 - v) * H; // the canvas runs top down, v bottom up
    g.fillStyle = "#CDBB98"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) { g.fillStyle = r() < 0.7 ? "rgba(92,64,40,0.5)" : "rgba(250,244,228,0.5)"; g.fillRect(r() * W, r() * H, 1.4, 1.4); }
    g.fillStyle = "#B08E68"; g.fillRect(0, y(0.07), W, H);
    // The dark glaze's lower edge: a slow wave with drips hanging from it.
    const edge = [];
    for (let x = 0; x <= W; x += 4) edge.push([x, 0.5 + Math.sin((x / W) * Math.PI * 6) * 0.03 + (r() - 0.5) * 0.02]);
    const run = (color, drop) => {
      g.fillStyle = color;
      g.beginPath(); g.moveTo(0, 0);
      edge.forEach(([x, v]) => g.lineTo(x, y(v - drop)));
      g.lineTo(W, 0); g.closePath(); g.fill();
    };
    run("#9A5A22", 0.025);
    run("#3B2314", 0);
    for (let i = 0; i < 16; i++) {
      const x = r() * W, v0 = 0.5, len = 0.06 + r() * 0.16, w = 3 + r() * 6;
      g.fillStyle = "#8E4E1E"; g.beginPath(); g.ellipse(x, y(v0 - len), w * 0.7, w * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3B2314"; g.fillRect(x - w / 2, y(v0), w, y(v0 - len) - y(v0));
      g.beginPath(); g.ellipse(x, y(v0 - len), w / 2, w * 0.6, 0, 0, Math.PI * 2); g.fill();
    }
    // A glint of iron in the dark glaze.
    for (let i = 0; i < 300; i++) { g.fillStyle = "rgba(170,110,50,0.35)"; g.fillRect(r() * W, r() * y(0.55), 1.2, 1.2); }
  });
}

function trailingPlant({ x, y, z, front, kind, seed, floorY, leafGeo, disposables }) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const q = quality();
  const pothos = kind === "pothos";
  const mat = q.physical
    ? new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: pothos ? 0.5 : 0.3 })
    : new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const stemMat = q.physical ? new THREE.MeshStandardMaterial({ color: 0x4d6a2a, roughness: 0.6 }) : new THREE.MeshLambertMaterial({ color: 0x4d6a2a });
  disposables.push(mat, stemMat);
  const plant = new THREE.Group();
  plant.name = `den-${kind}`;
  const leaves = []; // [position, direction the tip points, size]
  const stems = [];
  // Vines: out of the pot, over the front edge, down the cloth.
  const vines = pothos ? 6 : 5;
  for (let v = 0; v < vines; v++) {
    const spread = (v / (vines - 1) - 0.5) * 6.4 + (rnd() - 0.5) * 0.8;
    const drop = 5 + rnd() * (pothos ? 9 : 7);
    const endY = Math.max(floorY, y - 1.5 - drop);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + spread * 0.25, y + 0.2, z - 0.6),
      new THREE.Vector3(x + spread * 0.6, y - 0.3, front + 0.4),
      new THREE.Vector3(x + spread * 0.85, y - 2.2, front - 0.35),
      new THREE.Vector3(x + spread + (rnd() - 0.5) * 1.2, (y - 2.2 + endY) / 2, front - 0.5 - rnd() * 0.3),
      new THREE.Vector3(x + spread * 1.1 + (rnd() - 0.5) * 1.6, endY, front - 0.7 - rnd() * 0.5),
    ]);
    stems.push(new THREE.TubeGeometry(curve, 24, 0.055, 4, false));
    const len = curve.getLength(), step = pothos ? 0.95 : 0.8;
    for (let d = 0.6; d < len; d += step * (0.85 + rnd() * 0.3)) {
      const t = d / len, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const side = (Math.floor(d / step) % 2 ? 1 : -1);
      // Hanging leaves turn their faces to the room, tips down and out.
      const dir = new THREE.Vector3(side * 0.7 + (rnd() - 0.5) * 0.4, -0.6 + tan.y * 0.3, -0.5 - rnd() * 0.4).normalize();
      leaves.push([p, dir, (pothos ? 1.05 : 0.85) * (0.75 + rnd() * 0.45) * (1 - t * 0.25)]);
    }
  }
  // The crown: leaves spraying up and out of the pot.
  for (let i = 0; i < (pothos ? 16 : 14); i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 1.8;
    const p = new THREE.Vector3(x + Math.cos(a) * r, y + 0.3 + rnd() * 1.2, z + Math.sin(a) * r);
    const dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.5 + rnd() * 0.5, Math.sin(a) * 0.8 - 0.3).normalize();
    leaves.push([p, dir, (pothos ? 1.15 : 0.9) * (0.8 + rnd() * 0.4)]);
  }
  const stemGeo = BufferGeometryUtils.mergeBufferGeometries(stems, false);
  stems.forEach((g) => g.dispose());
  disposables.push(stemGeo);
  plant.add(new THREE.Mesh(stemGeo, stemMat));
  const inst = new THREE.InstancedMesh(leafGeo, mat, leaves.length);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), col = new THREE.Color(), roll = new THREE.Quaternion();
  leaves.forEach(([p, dir, size], i) => {
    qt.setFromUnitVectors(up, dir);
    roll.setFromAxisAngle(dir, (rnd() - 0.5) * 1.4);
    qt.premultiply(roll);
    sc.set(size, size, size);
    m4.compose(p, qt, sc);
    inst.setMatrixAt(i, m4);
    if (pothos) { const gold = rnd(); col.setRGB(0.3 + gold * 0.45, 0.48 + gold * 0.28, 0.14 + gold * 0.08); }
    else { const v = 0.8 + rnd() * 0.3; col.setRGB(0.2 * v, 0.42 * v, 0.14 * v); }
    inst.setColorAt(i, col);
  });
  plant.add(inst);
  return plant;
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
/* A rubber plant (Ficus elastica) in an avocado-glazed pot on its saucer:
   the user found the old one (a pot with a cluster of blades floating
   over it, nothing joining them) wrong. Three woody stems rise out of the
   soil, leaning a little apart; big oval leaves, dark and glossy, stand
   off them one after another round the stem (the golden angle), largest
   low down, each on a short stalk, cupped and drooping at the tip; at
   each stem's top, the rosy sheath of the next leaf unfurling. */
function ovalLeaf(L, W) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 10);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k) + 0.5, v = p.getY(k) + 0.5;
    // A short stalk, then the blade: widest just below the middle, a
    // blunt point at the tip.
    const blade = v < 0.08 ? 0.07 : Math.pow(Math.sin(Math.PI * Math.min(1, (v - 0.08) / 0.92) * 0.97 + 0.05), 0.7);
    const x = (u - 0.5) * W * blade;
    const across = (u - 0.5) * 2;
    p.setXYZ(k, x, v * L, -across * across * W * 0.09 * blade - v * v * L * 0.14);
  }
  g.computeVertexNormals();
  return g;
}
function rubberPlant(B, M, x, yF, z) {
  // The pot and its saucer, the soil.
  const saucer = [[0, 0], [4.3, 0], [4.8, 0.55], [4.6, 0.65], [4.1, 0.3], [0, 0.3]].map(([r, h]) => new THREE.Vector2(r, h));
  B.add(M.ceramicGreen, new THREE.LatheGeometry(saucer, 28).translate(x, yF, z));
  const potPts = [[0, 0], [2.9, 0], [3.05, 0.25], [3.7, 6.3], [4.3, 6.5], [4.35, 7.35], [3.95, 7.45], [3.8, 6.95], [0, 6.95]].map(([r, h]) => new THREE.Vector2(r, h));
  B.add(M.ceramicGreen, new THREE.LatheGeometry(potPts, 28).translate(x, yF + 0.3, z));
  const soilY = yF + 0.3 + 6.7;
  B.add(M.soot, new THREE.CircleGeometry(3.78, 24).rotateX(-Math.PI / 2).translate(x, soilY, z));
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const stems = [
    { h: 26, a: 0.3, lean: 0.12, base: [0.4, -0.3] },
    { h: 20, a: 2.4, lean: 0.2, base: [-0.8, 0.6] },
    { h: 15, a: 4.4, lean: 0.26, base: [0.6, 0.9] },
  ];
  const m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  let turn = rnd() * Math.PI * 2;
  stems.forEach((st) => {
    const bx = x + st.base[0], bz = z + st.base[1];
    const ox = Math.cos(st.a) * st.lean, oz = Math.sin(st.a) * st.lean;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, soilY - 0.5, bz),
      new THREE.Vector3(bx + ox * st.h * 0.25, soilY + st.h * 0.3, bz + oz * st.h * 0.25),
      new THREE.Vector3(bx + ox * st.h * 0.6, soilY + st.h * 0.7, bz + oz * st.h * 0.6),
      new THREE.Vector3(bx + ox * st.h * 0.8, soilY + st.h, bz + oz * st.h * 0.8),
    ]);
    // The stem, thinner as it rises (two tubes: the woody foot, the rest).
    const len = curve.getLength();
    B.add(M.bark, new THREE.TubeGeometry(curve, 20, 0.3, 6, false), { tile: 3 });
    // The sheath at the top: a slim rosy spike along the stem's way.
    const top = curve.getPointAt(1), tan = curve.getTangentAt(1);
    const sheath = new THREE.ConeGeometry(0.28, 2.2, 8);
    sheath.translate(0, 1.1, 0);
    sheath.applyMatrix4(m4.makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, tan)));
    sheath.translate(top.x, top.y, top.z);
    B.add(M.sheath, sheath);
    // Leaves up the upper two-thirds of the stem.
    for (let d = len * 0.25; d < len - 0.6; d += 1.15 + rnd() * 0.4) {
      const t = d / len, p = curve.getPointAt(t);
      turn += 2.4 + (rnd() - 0.5) * 0.3;
      const rise = 0.6 + t * 0.5 + (rnd() - 0.5) * 0.2; // the higher, the more upright
      const dir = new THREE.Vector3(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise)).normalize();
      // The face: up off the leaf's line, then turned a little about it,
      // so the blades show their faces round the room, not their edges.
      const nrm = up.clone().addScaledVector(dir, -dir.y).normalize().applyAxisAngle(dir, (rnd() - 0.5) * 1.3);
      const right = new THREE.Vector3().crossVectors(dir, nrm).normalize();
      const L = (6.2 - t * 2.6) * (0.85 + rnd() * 0.25);
      const leaf = ovalLeaf(L, L * 0.5);
      leaf.applyMatrix4(m4.makeBasis(right, dir, nrm));
      leaf.translate(p.x, p.y, p.z);
      B.add(M.rubberLeaf, leaf, { tile: 4, floorShade: false });
    }
  });
}

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

/* The coffee table: a thick top of earth-tone ceramic mosaic in a teak
   frame (the user's pick, number 11 of eleven 1970s tops rendered in the
   room) on a recessed plinth, lit by the
   scene's lights like the board, so the board's shadow falls on it. On
   it, beside the board: the box the game came in, the rules leaflet, a
   mug of coffee on its saucer (a spoon on the rim), a tumbler of scotch
   on the rocks, a bowl of snack mix. */
function buildCoffeeTable(TW, boardSpan) {
  const q = quality();
  const group = new THREE.Group();
  group.name = "den-table";
  const disposables = [];
  const lit = (o) => { const m = q.physical ? new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }) : new THREE.MeshLambertMaterial(o); disposables.push(m); return m; };
  const mk = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; group.add(m); disposables.push(geo); return m; };
  const topY = -SLAB_THICKNESS;
  let steamRef = null; // the coffee's steam (below)
  /* Small glazed ceramic tiles in earth tones, 40 by 40 on cream grout,
     shading from harvest gold at the middle through orange and rust to
     brown at the edges (a little scatter, seeded, so the rings aren't
     hard), each with a glint of glaze along its top; a teak frame round
     them. The board covers the middle; the gold shows round it. */
  const topTex = canvasTexture(1024, 1024, (g, W) => {
    let seed = 7;
    const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = 40, m = W * 0.043, c = (W - 2 * m) / n, gap = c * 0.055;
    g.fillStyle = "#5C3B22"; g.fillRect(0, 0, W, W);
    g.fillStyle = "#D8CDB6"; g.fillRect(m, m, W - 2 * m, W - 2 * m);
    const pal = ["#6B6B2E", "#8A7A2C", "#C98A2A", "#C2622A", "#8E3B1E", "#5A3420"];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const d = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5) / (n * 0.7);
      const k = Math.max(0, Math.min(pal.length - 1, Math.floor(d * pal.length + (R() - 0.5) * 1.6)));
      const x = m + i * c + gap, y = m + j * c + gap, w = c - gap * 2;
      g.fillStyle = pal[k]; g.fillRect(x, y, w, w);
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(x, y, w, w * 0.35);
    }
  });
  disposables.push(topTex);
  const mosaicTop = lit({ map: topTex, color: 0xb4a690, roughness: 0.3 });
  const teakSide = lit({ color: 0x5c3b22, roughness: 0.55 });
  mk(new THREE.BoxGeometry(TW, 1.1, TW).translate(0, topY - 0.55, 0), [teakSide, teakSide, mosaicTop, teakSide, teakSide, teakSide]);
  // The plinth, always in the top's shade: a little darker, and it takes no
  // shadows from the key light, whose shadow map (kept tight round the
  // board) ends partway across it and cut the top's shadow off in a hard
  // line that slid about as the view turned (the user's video).
  const plinthMat = lit({ color: 0x3d2414, roughness: 0.6 });
  mk(new THREE.BoxGeometry(TW - 6, TABLE_H - 1.1, TW - 6).translate(0, PIT_FLOOR + (TABLE_H - 1.1) / 2, 0), plinthMat).receiveShadow = false;
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
  // The rules are a link: a tap on the leaflet (or the box it came in)
  // opens them (den-fx.js pickScene "rules"), a "?" over it under the mouse.
  leaflet.userData.rules = true;
  boxMesh.userData.rules = true;
  // A mug of coffee on its saucer, a spoon laid on the saucer's rim; a
  // tumbler of scotch on the rocks on a cork coaster.
  const cork = lit({ color: 0x9a7048, roughness: 0.9 });
  const glassMat = (o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.06, metalness: 0, transparent: true, depthWrite: false, ...o }); disposables.push(m); return m; };
  /* The saucer's glaze: avocado, darker on the rim, with rings of harvest
     gold and cream round the inside of the dish (a seventies set). Painted
     along the lathe's profile (its v runs point to point, i / 9: the
     underside to 0.44, the outer rim to 0.56, the rim's top to 0.67, its
     inner slope to 0.78, the dish to 0.89, the well to 1). */
  const saucerTex = canvasTexture(8, 512, (g, W, H) => {
    const band = (v0, v1, c) => { g.fillStyle = c; g.fillRect(0, (1 - v1) * H, W, (v1 - v0) * H + 1); };
    band(0, 1, "#56631F"); // avocado
    band(0.44, 0.67, "#434E19"); // the rim, darker
    band(0.79, 0.805, "#C99A2E"); // harvest gold
    band(0.818, 0.828, "#E6D8AE"); // cream
    band(0.84, 0.855, "#C99A2E");
    band(0.889, 1, "#5F6D24"); // the well, a touch lighter
  }, { scale: false });
  disposables.push(saucerTex);
  const saucerGlaze = lit({ map: saucerTex, roughness: 0.34 });
  const coffee = lit({ color: 0x2a1508, roughness: 0.12 });
  const steel = lit({ color: 0xd4d2cc, roughness: 0.22, metalness: q.physical ? 0.3 : 0, side: THREE.DoubleSide });
  {
    const x = mid - 0.6, z = TW / 2 - 3.6;
    // The saucer: a shallow dish with a well for the mug's foot. Its top
    // face (saucerTop below) is what the spoon lies on.
    const sp = [[0, 0], [0.62, 0], [0.66, 0.08], [0.72, 0.05], [1.38, 0.16], [1.52, 0.3], [1.46, 0.34], [1.3, 0.24], [0.7, 0.12], [0, 0.12]].map(([r, h]) => new THREE.Vector2(r, h));
    mk(new THREE.LatheGeometry(sp, 32).translate(x, topY, z), saucerGlaze, true);
    const saucerTop = (r) => (r <= 0.7 ? 0.12 : r <= 1.3 ? 0.12 + ((r - 0.7) / 0.6) * 0.12 : 0.24 + ((r - 1.3) / 0.16) * 0.1);

    /* The mug: a stacking stoneware mug of the mid-seventies (the user's
       photograph): straight-sided in a speckled oatmeal glaze, a narrower
       foot to stack on, a band round its middle of interlocking
       three-armed Ys pressed in and glazed dark brown with a rust edge, a
       rust glaze breaking at the rim and the foot, and a C-shaped strap
       handle. Its handle is turned toward the board's edge. */
    const speckle = canvasTexture(512, 256, (g, W, H) => {
      let s = 11; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      g.fillStyle = "#E4CF72"; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${60 + R() * 40},${40 + R() * 25},${20 + R() * 15},${0.25 + R() * 0.45})`; g.fillRect(R() * W, R() * H, 1 + R() * 1.6, 1 + R() * 1.6); }
    }, { scale: false });
    disposables.push(speckle);
    speckle.wrapS = THREE.RepeatWrapping;
    const oatmeal = lit({ map: speckle, color: 0xe2cc78, roughness: 0.38 }); // a mustard-yellow oatmeal
    const rust = lit({ color: 0xa4582a, roughness: 0.4 });
    // The band: Ys packed on a hex lattice, alternately up and down so
    // their arms interlock; 11 repeats round, seamless.
    const band = canvasTexture(1024, 256, (g, W, H) => {
      g.fillStyle = "#E4CF72"; g.fillRect(0, 0, W, H);
      const cw = W / 11, ch = H / 2.6, arm = cw * 0.5, lw = cw * 0.2;
      const y = (cx, cy, up) => {
        for (const a of up ? [-90, 30, 150] : [90, -30, -150]) {
          const r = (a * Math.PI) / 180;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(r) * arm, cy + Math.sin(r) * arm); g.stroke();
        }
      };
      const pass = (style, width, dx, dy) => {
        g.strokeStyle = style; g.lineWidth = width; g.lineCap = "butt"; g.lineJoin = "miter";
        for (let row = -1; row < 5; row++) for (let col = -1; col <= 11; col++) {
          const up = (row + col) % 2 === 0;
          const cx = col * cw + (row % 2 ? cw / 2 : 0) + dx, cy = row * ch + ch * 0.35 + dy;
          y(cx, cy, up);
        }
      };
      pass("rgba(164,88,42,0.9)", lw * 1.55, 0, 0); // the rust where the glaze breaks at the edges
      pass("#3B2A1C", lw, 0, 0); // the pressed-in arms, dark brown
      pass("rgba(255,244,210,0.18)", lw * 0.35, -lw * 0.25, -lw * 0.25); // a glint on the ridge
    }, { scale: false });
    disposables.push(band);
    band.wrapS = THREE.RepeatWrapping;
    const bandMat = lit({ map: band, color: 0xe2cc78, roughness: 0.42 });
    const y0 = topY + 0.12; // the saucer's well
    // The body: the stacking foot (narrower), the step out, straight
    // sides to a rolled rim, and the inside.
    const mp = [[0, 0], [0.58, 0], [0.61, 0.04], [0.61, 0.3], [0.7, 0.36], [0.72, 0.42], [0.72, 1.9], [0.7, 1.96], [0.66, 1.94], [0.64, 1.7], [0.64, 0.46], [0, 0.46]].map(([r, h]) => new THREE.Vector2(r, h));
    mk(new THREE.LatheGeometry(mp, 36).translate(x, y0, z), oatmeal, true);
    // The band of Ys, standing just proud of the wall; a rust line at the
    // rim and at the foot.
    mk(new THREE.CylinderGeometry(0.735, 0.735, 1.0, 36, 1, true).translate(x, y0 + 1.08, z), bandMat);
    mk(new THREE.CylinderGeometry(0.724, 0.724, 0.06, 36, 1, true).translate(x, y0 + 1.87, z), rust);
    mk(new THREE.CylinderGeometry(0.614, 0.614, 0.05, 36, 1, true).translate(x, y0 + 0.06, z), rust);
    // The handle: a flat strap bent into a C, its ends into the wall.
    const cShape = new THREE.Shape();
    const ro = 0.5, ri = 0.33, a0 = -1.95, a1 = 1.95;
    cShape.absarc(0, 0, ro, a0, a1, false);
    cShape.absarc(0, 0, ri, a1, a0, true);
    const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 18 });
    // Drawn upright in x-y, open toward -x (the mug), the strap's width
    // along z: centred on that width, then set against the wall.
    cGeo.translate(0, 0, -0.08);
    cGeo.translate(0.72 + 0.12, 1.1, 0);
    cGeo.rotateY(-0.9);
    cGeo.translate(x, y0, z);
    mk(cGeo, oatmeal, true);
    // The coffee, a little below the lip.
    mk(new THREE.CircleGeometry(0.64, 32).rotateX(-Math.PI / 2).translate(x, y0 + 1.68, z), coffee);
    /* Steam off it, just a hint: it's hot. One upright sheet, turned to
       face the camera each frame (table.animate), a small shader of
       drifting wisps: faint, thinning as they rise, gone at the sheet's
       edges. */
    const steamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float t = uTime * 0.35, y = vUv.y;
          // Two wisps winding up, each swaying and breaking as it rises.
          float sway = (n(vec2(y * 2.2 - t, 3.1)) - 0.5) * 0.5 * y;
          float w1 = exp(-pow((vUv.x - 0.42 - sway) / (0.07 + y * 0.12), 2.0));
          float w2 = exp(-pow((vUv.x - 0.6 + sway * 0.8) / (0.06 + y * 0.1), 2.0));
          float breakup = smoothstep(0.35, 0.75, n(vec2(vUv.x * 5.0, y * 4.0 - t * 2.4)));
          float a = (w1 + w2 * 0.8) * breakup * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.45, 1.0, y));
          gl_FragColor = vec4(vec3(0.94, 0.92, 0.88), a * 0.26);
        }`,
    });
    const steam = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4).translate(0, 1.2, 0), steamMat);
    steam.position.set(x, y0 + 1.7, z);
    steam.renderOrder = 2;
    group.add(steam);
    disposables.push(steamMat, steam.geometry);
    steamRef = { mesh: steam, x, z };

    /* The teaspoon, lying in the saucer beside the mug: its bowl down on
       the dish's slope, its handle across to the rim and resting on it,
       the end just over; the weight inside its two resting points, so it
       lies as a spoon would (it used to sit with its bowl inside the
       mug's foot and its handle through the rim). Built along its own +x:
       the bowl's rim at y = 0 (its bottom 0.07 below), the handle a flat
       tapered strip from the bowl to a rounded end. */
    const spoon = new THREE.Group();
    const bowlGeo = new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.55, 0.35, 1);
    spoon.add(new THREE.Mesh(bowlGeo, steel));
    const hs = new THREE.Shape();
    hs.moveTo(0.26, -0.035); hs.lineTo(0.62, -0.03); hs.quadraticCurveTo(1.2, -0.05, 1.5, -0.075);
    hs.absarc(1.5, 0, 0.075, -Math.PI / 2, Math.PI / 2, false);
    hs.quadraticCurveTo(1.2, 0.05, 0.62, 0.03); hs.lineTo(0.26, 0.035); hs.closePath();
    const handleGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.028, bevelEnabled: false, curveSegments: 10 });
    handleGeo.rotateX(Math.PI / 2); handleGeo.translate(0, 0.014, 0); // flat, its middle at the bowl's rim
    spoon.add(new THREE.Mesh(handleGeo, steel));
    disposables.push(bowlGeo, handleGeo);
    spoon.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // Where it lies: the bowl's centre rb out from the mug's axis, at an
    // angle round from the handle; the spoon crosses the rim (r 1.46) at
    // its handle, sc along. From that, its heading and its slight tilt.
    // (The mug's handle points at angle 0.9 in x-z; the spoon's bowl sits
    // across from it.)
    const rb = 1.1, sc = 1.32, rimR = 1.46, rimTop = 0.34, ab = 0.9 + Math.PI + 0.35;
    const cb = new THREE.Vector2(Math.cos(ab), Math.sin(ab)).multiplyScalar(rb); // (x, z)
    const cosB = (rimR * rimR - rb * rb - sc * sc) / (2 * sc * rb);
    const beta = Math.acos(Math.max(-1, Math.min(1, cosB)));
    const dir = new THREE.Vector2(Math.cos(ab + beta), Math.sin(ab + beta)); // (x, z)
    /* Settle it: the dish slopes across the bowl's width too, so placing
       it by the bowl's centre alone left an edge of the bowl a hair under
       the glaze (the saucer showed through it: the user's screenshot).
       For each tilt, lift it by exactly what keeps every vertex of it on
       or above the saucer's top (saucerTop, the rim's outer fall past
       1.46, the table beyond), then keep the tilt at which its balance
       point, 0.55 along, sits lowest: where a spoon comes to rest, on two
       points. (The saucer's facets lie on the profile at their edges and
       inside it between, so the profile is the highest the glaze gets.) */
    const surfaceAt = (r) => (r <= 1.46 ? saucerTop(r) : r <= 1.52 ? rimTop - ((r - 1.46) / 0.06) * 0.04 : 0);
    const verts = [];
    [bowlGeo, handleGeo].forEach((g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) verts.push(new THREE.Vector3().fromBufferAttribute(p, i)); });
    const yaw = Math.atan2(-dir.y, dir.x);
    const e = new THREE.Euler(), m4 = new THREE.Matrix4(), w = new THREE.Vector3(), bal = new THREE.Vector3();
    let best = null;
    for (let tl = -0.12; tl <= 0.3; tl += 0.004) {
      m4.makeRotationFromEuler(e.set(0, yaw, tl));
      let lift = -Infinity;
      for (const v of verts) {
        w.copy(v).applyMatrix4(m4);
        lift = Math.max(lift, surfaceAt(Math.hypot(cb.x + w.x, cb.y + w.z)) - w.y);
      }
      const balY = lift + bal.set(0.55, 0, 0).applyMatrix4(m4).y;
      if (!best || balY < best.balY - 1e-6) best = { tl, lift, balY };
    }
    spoon.position.set(x + cb.x, topY + best.lift + 0.002, z + cb.y);
    spoon.rotation.set(0, yaw, best.tl);
    group.add(spoon);
  }
  {
    const x = -mid + 1.2, z = TW / 2 - 4.6;
    mk(new THREE.CylinderGeometry(1.05, 1.05, 0.14, 24).translate(x, topY + 0.07, z), cork);
    const y0 = topY + 0.14;
    // A heavy rocks glass: a thick base, straight sides.
    const tumbler = glassMat({ color: 0xf4efe6, opacity: 0.22 });
    const base = glassMat({ color: 0xe8e2d6, opacity: 0.55 });
    mk(new THREE.CylinderGeometry(0.86, 0.84, 0.42, 28).translate(x, y0 + 0.21, z), base, true).renderOrder = 2;
    const wall = mk(new THREE.CylinderGeometry(0.9, 0.86, 1.95, 28, 1, true).translate(x, y0 + 0.975, z), tumbler, true);
    wall.renderOrder = 3;
    mk(new THREE.TorusGeometry(0.88, 0.045, 6, 28).rotateX(Math.PI / 2).translate(x, y0 + 1.95, z), glassMat({ color: 0xffffff, opacity: 0.4 })).renderOrder = 3;
    // The scotch, amber, a couple of fingers of it.
    const scotch = glassMat({ color: 0xb8651a, opacity: 0.78, roughness: 0.04 });
    const surf = 0.42 + 0.9; // the whisky's surface above the coaster
    mk(new THREE.CylinderGeometry(0.82, 0.8, 0.9, 28).translate(x, y0 + 0.42 + 0.45, z), scotch).renderOrder = 1;
    // Ice: three cubes floating in it, only their tops (a tenth of a cube
    // to a quarter) above the surface (the user: "more submerged"). They're
    // drawn first and write depth, so the whisky tints what's under the
    // surface and not what's above it.
    const ice = glassMat({ color: 0xeef4f8, opacity: 0.62, roughness: 0.18, depthWrite: true });
    [[0.3, 0.2, 0.35, 0.08], [-0.28, 0.12, -0.6, 0.13], [0.02, -0.34, 0.9, 0.05]].forEach(([dx, dz, ry, above]) => {
      const c = mk(makeRoundedBox(0.62, 0.58, 0.62, 0.08, 2).rotateY(ry).rotateX(0.2 * dx).translate(x + dx, y0 + surf + above - 0.29, z + dz), ice);
      c.renderOrder = 0;
    });
  }
  // A teak bowl heaped with snack mix: peanuts, little pretzels, cereal
  // squares and rye chips, each its own piece so it reads from the sofa.
  const teak = lit({ color: 0x8a5a30, roughness: 0.5, side: THREE.DoubleSide });
  const bowlPts = [[0, 0], [1.1, 0.04], [1.8, 0.45], [2.1, 1.1], [2.02, 1.14]].map(([r, h]) => new THREE.Vector2(r, h));
  const bx = mid - 0.2, bz = -TW / 2 + 4.2;
  const bowl = mk(new THREE.LatheGeometry(bowlPts, 24), teak, true);
  bowl.position.set(bx, topY, bz);
  {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // A mound: the heap's height at a distance r from the middle.
    const heapY = (r) => topY + 0.3 + 0.95 * Math.sqrt(Math.max(0, 1 - (r / 1.85) * (r / 1.85)));
    // `reach`: how far a piece sticks out from its middle, turned any way.
    const kinds = [
      { n: 70, geo: new THREE.SphereGeometry(0.16, 8, 6).scale(1.55, 0.95, 1), mat: lit({ color: 0xc89a5c, roughness: 0.55 }), vary: 0.12, reach: 0.25 },
      { n: 16, geo: new THREE.TorusKnotGeometry(0.16, 0.045, 32, 5, 2, 3).scale(1.5, 1, 0.55), mat: lit({ color: 0x7a3e14, roughness: 0.4 }), vary: 0.08, reach: 0.32 },
      { n: 30, geo: new THREE.BoxGeometry(0.34, 0.1, 0.34), mat: lit({ color: 0xc9a060, roughness: 0.7 }), vary: 0.15, reach: 0.25 },
      { n: 10, geo: new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), mat: lit({ color: 0x8f5a2c, roughness: 0.65 }), vary: 0.1, reach: 0.26 },
    ];
    // The bowl's inside at a height h above its foot (its lathe profile):
    // it narrows toward the foot, so a piece near the edge sitting low
    // went through the wall (the user: "snacks protruding from the
    // exterior of the bowl"). Each piece stays inside the wall at the
    // height of its own lowest point.
    const wallR = (h) => {
      if (h <= bowlPts[0].y) return 0;
      for (let k = 1; k < bowlPts.length; k++) {
        const a = bowlPts[k - 1], b = bowlPts[k];
        if (h <= b.y) return a.x + ((b.x - a.x) * (h - a.y)) / Math.max(1e-6, b.y - a.y);
      }
      return bowlPts[bowlPts.length - 1].x;
    };
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    kinds.forEach(({ n, geo, mat, vary, reach }) => {
      disposables.push(geo);
      const inst = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        let r = Math.sqrt(rnd()) * 1.75;
        const sink = rnd() * 0.25;
        const s = 0.85 + rnd() * 0.3;
        const ext = reach * s;
        // Pulled in until it clears the wall at its lowest point (the heap
        // rises toward the middle, so moving in only lifts it).
        for (let k = 0; k < 6; k++) {
          const low = heapY(r) - sink - topY - ext;
          const room = wallR(Math.max(0, low)) - 0.06 - ext;
          if (r <= room) break;
          r = Math.max(0, Math.min(r - 0.05, room));
        }
        const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
        pos.set(x, heapY(r) - sink, z);
        e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); qt.setFromEuler(e);
        sc.set(s, s, s);
        m4.compose(pos, qt, sc); inst.setMatrixAt(i, m4);
        const v = 1 - vary / 2 + rnd() * vary; col.setRGB(v, v, v); inst.setColorAt(i, col);
      }
      inst.castShadow = true; inst.receiveShadow = true;
      group.add(inst);
    });
  }

  return {
    group,
    rules: { pickables: [leaflet, boxMesh], leaflet },
    // Each frame: the steam drifts, and turns to face the camera (camLocal:
    // the camera in the board's frame, the table's too but for focus's drop).
    animate(t, camLocal) {
      if (!steamRef) return;
      steamRef.mesh.material.uniforms.uTime.value = t;
      if (camLocal) steamRef.mesh.rotation.y = Math.atan2(camLocal.x - steamRef.x, camLocal.z - steamRef.z);
    },
    repaint() { repaint(lid); },
    dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); },
  };
}
