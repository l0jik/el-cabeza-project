/* Noir's motorcars: the sedans and coupes of the city's streets (user:
   "Occasionally have a post-war sedan or coupe, most notably 4-door
   sedans and low-slung coupes produced by American manufacturers like
   Ford, Buick, Cadillac, Chevrolet, and Chrysler between 1935 and 1950").

   Each is drawn from its side elevation, as a draughtsman would: the body's
   line from bumper to bumper extruded across its width and rounded at the
   edges; the cabin above it in the body's paint, the windows set into it
   as dark panes, the windshield in two with the body showing between them
   as its centre bar; the fenders separate pontoons standing proud of the
   doors (the cars were built that way until the '49 Ford's slab sides);
   chrome where it was: bumpers and their guards, grilles, headlamp rims,
   hubcaps, whitewalls.

   - sedan41: a four-door sedan of '41 (Cadillac Series 62, Buick
     Roadmaster): a long hood, the egg-crate grille wide and low, skirts
     over the rear wheels, a notchback trunk.
   - fastback46: the '46 Chevrolet Fleetline Aerosedan (Buick's Sedanet
     the same idea): two doors, the roof sweeping down unbroken to the
     rear bumper, three chrome speedlines on every fender.
   - coupe40: the low '40 Ford De Luxe coupe: the pointed prow and its
     grille, a long hood, a short cabin, a long deck, running boards.
   - shoebox49: the '49 Ford Custom four-door, the first with slab sides:
     no fenders of its own, a bar across the grille with the bullet in the
     middle, a chrome spear down the side.
   - airflow37: the Chrysler Airflow: the round nose and the waterfall
     grille down it, the lamps flush, a fastback, skirted rear wheels.
   - taxi: the '41 sedan in a pale paint, a checker band at the waist and a
     lit TAXI sign on the roof.

   The city is black and white: the paint is a grey, black mostly, the
   lamps a warm white and the tail lamps a pale glow (the HOTEL sign keeps
   the city's one red). Built in metres, then scaled to the street. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const CAR_KINDS = ["sedan41", "fastback46", "coupe40", "shoebox49", "airflow37", "taxi"];
// Their paint: black above all, as most cars of the time were; then the
// darker greys, a pale one now and then (a cream or a light blue, in the
// film's black and white).
export const CAR_PAINTS = ["#0b0b0c", "#0b0b0c", "#0b0b0c", "#1d1d1f", "#2c2c2e", "#4a4a4c", "#6d6d70", "#9a9a9c"];

const PI = Math.PI;

/* ------------------------------------------------------------ the models

   In metres, x forward from the middle of the car, y up from the road, z
   across. Outlines are lists of [x, y, corner radius]; a wheel's opening
   is [x, y, "arch", radius, from, to] (angles, the way the outline runs).
   - body: the side elevation, waist to sill, nose to tail.
   - cabin: the glasshouse's side elevation (its foot sunk into the body);
     round: how round its edges are. wind/back: the windshield's and the
     back light's line [from, to] and how much of it is glass [s0, s1].
     windows: the side windows as spans of x (the cabin's outline, drawn
     in by its rounding and a frame, gives their shape), from the sill up.
   - front/rear: the fenders' elevations (rear without an opening: a skirt).
   - wheels: front and rear axle x, the tyre's radius, the track's half.
   - head/tail: the lamps [x, y, z] (z mirrored), radius.
   - bumper: front and rear x, height. */
const SPECS = {
  sedan41: {
    taper: [[1.7, 2.8, 0.16], [-1.9, -2.8, 0.12]],
    wheels: { f: 1.55, r: -1.65, R: 0.38, track: 0.8 },
    BW: 1.74, FW: 2.0, CW: 1.5, round: 0.13,
    body: [[-2.66, 0.4, 0.08], [-2.78, 0.84, 0.25], [-2.45, 1.08, 0.3], [-1.78, 1.14, 0.2], [0.6, 1.14, 0.06], [2.28, 1.08, 0.3], [2.74, 0.92, 0.2], [2.78, 0.5, 0.08], [2.6, 0.4, 0.04], [1.55, 0.4, "arch", 0.48, 0, PI], [-1.65, 0.4, "arch", 0.48, 0, PI]],
    cabin: [[0.76, 1.02], [0.02, 1.58, 0.16], [-1.3, 1.62, 0.3], [-2.15, 1.02]], cabRound: 0.1, sill: 1.21,
    wind: [[0.6, 1.14], [0.02, 1.58], 0.04, 0.77], back: [[-1.3, 1.62], [-1.98, 1.14], 0.4, 0.92, 0.42],
    windows: [[-0.45, 0.9], [-2.6, -0.56]],
    front: [[0.7, 0.42, 0.04], [0.98, 0.96, 0.4], [1.62, 1.06, 0.5], [2.42, 0.98, 0.3], [2.74, 0.72, 0.2], [2.64, 0.42, 0.06], [1.55, 0.4, "arch", 0.5, 0, PI]],
    rear: [[-0.98, 0.42, 0.04], [-1.18, 0.86, 0.35], [-1.78, 1.0, 0.5], [-2.48, 0.86, 0.3], [-2.74, 0.56, 0.16], [-2.58, 0.42, 0.06]],
    fenderW: 0.34,
    head: [2.7, 0.8, 0.83, 0.105], tail: [-2.7, 0.64, 0.84, 0.05],
    grille: { tex: "egg", w: 1.25, h: 0.36, x: 2.79, y: 0.66 },
    hood: [[0.7, 1.136], [1.95, 1.092]], ornament: true,
    bumper: [2.86, -2.86, 0.45],
  },
  fastback46: {
    taper: [[1.6, 2.62, 0.16], [-1.6, -2.66, 0.18]],
    wheels: { f: 1.42, r: -1.52, R: 0.37, track: 0.78 },
    BW: 1.7, FW: 1.94, CW: 1.48, round: 0.13,
    body: [[-2.5, 0.4, 0.06], [-2.64, 0.72, 0.2], [-2.32, 0.95, 0.3], [-1.6, 1.1, 0.25], [0.55, 1.1, 0.06], [2.12, 1.04, 0.3], [2.56, 0.9, 0.2], [2.6, 0.48, 0.08], [2.44, 0.4, 0.04], [1.42, 0.4, "arch", 0.47, 0, PI], [-1.52, 0.4, "arch", 0.47, 0, PI]],
    // the roof sweeping down to the tail in one line
    cabin: [[0.7, 0.98], [0.0, 1.54, 0.16], [-0.72, 1.58, 0.55], [-2.42, 0.9, 0.1]], cabRound: 0.1, sill: 1.17,
    wind: [[0.55, 1.1], [0.0, 1.54], 0.04, 0.76], back: [[-0.72, 1.58], [-2.42, 0.9], 0.33, 0.56, 0.36],
    windows: [[-0.6, 0.9], [-1.5, -0.7]],
    front: [[0.66, 0.42, 0.04], [0.9, 0.92, 0.4], [1.5, 1.02, 0.5], [2.24, 0.94, 0.3], [2.58, 0.7, 0.2], [2.48, 0.42, 0.06], [1.42, 0.4, "arch", 0.49, 0, PI]],
    rear: [[-0.86, 0.42, 0.04], [-1.06, 0.84, 0.35], [-1.6, 0.97, 0.5], [-2.32, 0.82, 0.3], [-2.58, 0.52, 0.16], [-2.42, 0.42, 0.06], [-1.52, 0.4, "arch", 0.49, PI, 0]],
    fenderW: 0.32,
    head: [2.5, 0.78, 0.79, 0.1], tail: [-2.52, 0.6, 0.8, 0.045],
    grille: { tex: "bars", w: 1.15, h: 0.34, x: 2.62, y: 0.64 },
    hood: [[0.65, 1.098], [1.85, 1.056]], ornament: true,
    // the Fleetline's three speedlines on every fender
    speedlines: [[1.98, 2.38, 0.6], [-2.04, -2.3, 0.55]],
    bumper: [2.68, -2.66, 0.44],
  },
  coupe40: {
    taper: [[1.2, 2.45, 0.3], [-1.4, -2.45, 0.14]],
    wheels: { f: 1.42, r: -1.42, R: 0.36, track: 0.74 },
    BW: 1.6, FW: 1.86, CW: 1.38, round: 0.12,
    // a long hood, a short cabin, a long deck; the nose ends in the prow
    body: [[-2.3, 0.42, 0.06], [-2.42, 0.7, 0.2], [-2.1, 0.95, 0.3], [-1.05, 1.08, 0.25], [0.5, 1.1, 0.06], [2.16, 1.06, 0.2], [2.36, 0.98, 0.1], [2.42, 0.6, 0.1], [2.3, 0.42, 0.04], [1.42, 0.42, "arch", 0.46, 0, PI], [-1.42, 0.42, "arch", 0.46, 0, PI]],
    cabin: [[0.64, 0.98], [0.06, 1.47, 0.14], [-0.5, 1.5, 0.32], [-1.47, 0.98]], cabRound: 0.09, sill: 1.17,
    wind: [[0.5, 1.1], [0.06, 1.47], 0.05, 0.74], back: [[-0.5, 1.5], [-1.28, 1.08], 0.38, 0.76, 0.32],
    windows: [[-0.62, 0.9], [-1.6, -0.72]],
    front: [[0.72, 0.44, 0.04], [0.94, 0.94, 0.38], [1.48, 1.04, 0.45], [2.2, 0.98, 0.3], [2.46, 0.74, 0.18], [2.36, 0.44, 0.06], [1.42, 0.42, "arch", 0.48, 0, PI]],
    rear: [[-0.8, 0.44, 0.04], [-0.98, 0.84, 0.32], [-1.48, 0.98, 0.45], [-2.12, 0.84, 0.3], [-2.38, 0.56, 0.15], [-2.24, 0.44, 0.06], [-1.42, 0.42, "arch", 0.48, PI, 0]],
    fenderW: 0.3,
    head: [2.38, 0.84, 0.76, 0.095], tail: [-2.33, 0.64, 0.78, 0.045],
    prow: { x: 2.4, tip: 0.17, half: 0.3, y0: 0.5, y1: 0.95 },
    hood: [[0.6, 1.097], [2.0, 1.064]],
    runningBoard: [-0.78, 0.7],
    bumper: [2.6, -2.48, 0.46],
  },
  shoebox49: {
    taper: [[2.0, 2.54, 0.07], [-2.0, -2.54, 0.06]],
    wheels: { f: 1.42, r: -1.48, R: 0.36, track: 0.78 },
    BW: 1.84, FW: 0, CW: 1.52, round: 0.07,
    // one slab from end to end: no fenders of its own
    body: [[-2.44, 0.4, 0.06], [-2.52, 0.92, 0.12], [-2.3, 1.04, 0.1], [-1.7, 1.06, 0.12], [0.72, 1.06, 0.06], [2.3, 1.02, 0.12], [2.5, 0.94, 0.1], [2.52, 0.48, 0.08], [2.4, 0.4, 0.04], [1.42, 0.4, "arch", 0.46, 0, PI], [-1.48, 0.4, "arch", 0.46, 0, PI]],
    cabin: [[0.89, 0.94], [0.2, 1.5, 0.14], [-1.12, 1.52, 0.3], [-1.95, 0.94]], cabRound: 0.09, sill: 1.12,
    wind: [[0.74, 1.06], [0.2, 1.5], 0.04, 0.78], back: [[-1.12, 1.52], [-1.78, 1.06], 0.4, 0.9, 0.5],
    windows: [[-0.38, 1.0], [-2.2, -0.48]],
    head: [2.5, 0.82, 0.68, 0.1], tail: [-2.5, 0.8, 0.72, 0.05],
    grille: { tex: "mouth", w: 1.25, h: 0.26, x: 2.535, y: 0.66 }, bullet: [2.58, 0.66],
    hood: [[0.8, 1.058], [2.15, 1.026]],
    spear: [-2.2, 2.2, 0.95],
    bumper: [2.6, -2.56, 0.44],
  },
  airflow37: {
    taper: [[1.0, 2.62, 0.34], [-1.6, -2.62, 0.2]],
    wheels: { f: 1.6, r: -1.48, R: 0.37, track: 0.8 },
    BW: 1.84, FW: 0, CW: 1.5, round: 0.14,
    body: [[-2.48, 0.4, 0.06], [-2.6, 0.7, 0.25], [-2.2, 1.0, 0.35], [-1.5, 1.12, 0.3], [0.5, 1.12, 0.06], [1.9, 1.06, 0.4], [2.52, 0.78, 0.45], [2.6, 0.5, 0.12], [2.44, 0.4, 0.04], [1.6, 0.4, "arch", 0.47, 0, PI], [-1.48, 0.4, "arch", 0.47, 0, PI]],
    cabin: [[0.65, 1.0], [0.1, 1.56, 0.2], [-0.75, 1.6, 0.55], [-2.3, 0.92]], cabRound: 0.12, sill: 1.19,
    wind: [[0.532, 1.12], [0.1, 1.56], 0.05, 0.66], back: [[-0.75, 1.6], [-2.3, 0.92], 0.36, 0.6, 0.34],
    windows: [[-0.5, 0.9], [-1.5, -0.6]],
    // the rear wheels under skirts, the front fenders blended into the nose
    rear: [[-0.88, 0.42, 0.04], [-1.06, 0.84, 0.32], [-1.6, 0.98, 0.45], [-2.3, 0.82, 0.3], [-2.54, 0.54, 0.16], [-2.4, 0.42, 0.06]],
    fenderW: 0.3, fenderZ: 0.84,
    head: [2.47, 0.84, 0.56, 0.1], tail: [-2.55, 0.66, 0.66, 0.045],
    waterfall: { y0: 0.52, y1: 1.0, half: 0.3 },
    hood: [[0.6, 1.116], [1.65, 1.075]],
    spear: [-0.5, 1.05, 0.93],
    bumper: [2.66, -2.62, 0.45],
  },
};
SPECS.taxi = { ...SPECS.sedan41, taxi: true };
const lengthOf = (S) => S.bumper[0] - S.bumper[1] + 0.15;
// The longest of them (the sedan) from bumper to bumper on the board.
export const CAR_LENGTH = 0.3;
export const CAR_SCALE = CAR_LENGTH / lengthOf(SPECS.sedan41);

/* ------------------------------------------------------------ materials (shared) */

const MATS = new Map(), GEOS = new Map();
function mat(key, make) { if (!MATS.has(key)) MATS.set(key, make()); return MATS.get(key); }
const paint = (hex) => mat(`paint${hex}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.3, metalness: 0.3 }));
const chrome = () => mat("chrome", () => new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.18, metalness: 0.85, emissive: 0x2a2a2a }));
const glass = () => mat("glass", () => new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.06, metalness: 0.7, emissive: 0x050506 }));
const rubber = () => mat("rubber", () => new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85, metalness: 0 }));
const whitewall = () => mat("whitewall", () => new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.6, metalness: 0 }));
const dark = () => mat("dark", () => new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, metalness: 0 }));
const lamp = () => mat("lamp", () => new THREE.MeshBasicMaterial({ color: 0xfff6e2, toneMapped: false }));
const tail = () => mat("tail", () => new THREE.MeshBasicMaterial({ color: 0x9a9a9a, toneMapped: false }));
let GRILLES = null;
function grilleMats() {
  if (GRILLES) return GRILLES;
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const mk = (draw) => {
    const c = canvas(128, 64), x = c.getContext("2d");
    x.fillStyle = "#050505"; x.fillRect(0, 0, 128, 64); x.fillStyle = "#dcdcdc"; draw(x);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 });
  };
  GRILLES = {
    // Cadillac's egg-crate
    egg: mk((x) => { for (let i = 0; i <= 12; i++) x.fillRect(i * 10.4, 0, 3, 64); for (let j = 0; j <= 4; j++) x.fillRect(0, j * 15, 128, 3); }),
    // Chevrolet's broad horizontal bars, a bar down the middle
    bars: mk((x) => { for (let j = 0; j < 4; j++) x.fillRect(0, 6 + j * 16, 128, 6); x.fillRect(61, 0, 6, 64); }),
    // Ford's prow: fine horizontal bars
    fine: mk((x) => { for (let j = 0; j < 11; j++) x.fillRect(0, 2 + j * 6, 128, 3); x.fillRect(0, 0, 3, 64); x.fillRect(125, 0, 3, 64); }),
    // the Airflow's waterfall: close vertical bars
    vert: mk((x) => { for (let i = 0; i < 18; i++) x.fillRect(2 + i * 7, 0, 3, 64); x.fillRect(0, 0, 128, 3); x.fillRect(0, 61, 128, 3); }),
    // the '49 Ford's: a single bar across the dark mouth
    mouth: mk((x) => { x.fillRect(0, 26, 128, 12); x.fillRect(0, 0, 128, 3); x.fillRect(0, 61, 128, 3); }),
    // the taxi's checker band
    check: (() => {
      const c = canvas(128, 16), x = c.getContext("2d");
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? "#0c0c0c" : "#e8e8e8"; x.fillRect(i * 8, j * 8, 8, 8); }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.1 });
    })(),
    sign: (() => {
      const c = canvas(128, 48), x = c.getContext("2d");
      x.fillStyle = "#e9e9e9"; x.fillRect(0, 0, 128, 48); x.fillStyle = "#101010";
      x.font = "bold 34px 'Bebas Neue', 'Oswald', Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("TAXI", 64, 26);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    })(),
  };
  return GRILLES;
}

/* ------------------------------------------------------------ drawing tools */

/* A closed outline through the points, each corner rounded by its radius
   ([x, y, r]); an arch ([x, y, "arch", radius, from, to]) is an arc about
   (x, y) between the two angles, for a wheel's opening. */
function outline(points) {
  const s = new THREE.Shape(), n = points.length;
  const P = (i) => points[(i + n) % n];
  const isArc = (p) => p[2] === "arch";
  let started = false;
  const go = (x, y) => { if (!started) { s.moveTo(x, y); started = true; } else s.lineTo(x, y); };
  for (let i = 0; i < n; i++) {
    const p = P(i);
    if (isArc(p)) {
      const [cx, cy, , r, a0, a1] = p;
      go(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
      s.absarc(cx, cy, r, a0, a1, a1 < a0);
      continue;
    }
    const r = p[2] || 0;
    const a = P(i - 1), b = P(i + 1);
    const ax = isArc(a) ? a[0] + a[3] * Math.cos(a[5]) : a[0], ay = isArc(a) ? a[1] + a[3] * Math.sin(a[5]) : a[1];
    const bx = isArc(b) ? b[0] + b[3] * Math.cos(b[4]) : b[0], by = isArc(b) ? b[1] + b[3] * Math.sin(b[4]) : b[1];
    if (!r) { go(p[0], p[1]); continue; }
    const la = Math.hypot(ax - p[0], ay - p[1]), lb = Math.hypot(bx - p[0], by - p[1]);
    const k = Math.min(r, la * 0.45, lb * 0.45);
    go(p[0] + ((ax - p[0]) / la) * k, p[1] + ((ay - p[1]) / la) * k);
    s.quadraticCurveTo(p[0], p[1], p[0] + ((bx - p[0]) / lb) * k, p[1] + ((by - p[1]) / lb) * k);
  }
  s.closePath();
  return s;
}
/* The outline drawn d further in all round (the rounding of a slab's
   edges adds d all round again, so the slab keeps the outline drawn):
   each corner moved in along its bisector, its rounding less by d; a
   wheel's opening (a cut into the outline) d larger. */
function inset(points, d) {
  const n = points.length, isArc = (p) => p[2] === "arch";
  const at = (i, end) => { const p = points[(i + n) % n]; return isArc(p) ? [p[0] + p[3] * Math.cos(end ? p[5] : p[4]), p[1] + p[3] * Math.sin(end ? p[5] : p[4])] : [p[0], p[1]]; };
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, y0] = at(i, true), [x1, y1] = at(i + 1, false); area += x0 * y1 - x1 * y0; }
  const ccw = area > 0;
  return points.map((p, i) => {
    if (isArc(p)) return [p[0], p[1], "arch", p[3] + d, p[4], p[5]];
    const [ax, ay] = at(i - 1, true), [bx, by] = at(i + 1, false);
    const nrm = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return ccw ? [-dy / l, dx / l] : [dy / l, -dx / l]; };
    const n1 = nrm(p[0] - ax, p[1] - ay), n2 = nrm(bx - p[0], by - p[1]);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const k = d / Math.max(0.45, mx * n1[0] + my * n1[1]);
    return [p[0] + mx * k, p[1] + my * k, Math.max(0, (p[2] || 0) - d)];
  });
}
/* The outline extruded across the car (z), `width` in all, centred on z0,
   every edge rounded by `round` (a pillowed section, as the cars of the
   time were pressed). */
function slab(points, width, round = 0.06, z0 = 0, seg = 10, taper = null) {
  // (a thin part, a fender's foot by its wheel, takes less rounding: as
  // much as leaves the outline drawn in without crossing itself)
  let b = Math.min(round, width * 0.45);
  while (b > 0.01 && !simple(outline(inset(points, b)).getPoints(4))) b *= 0.8;
  const g = new THREE.ExtrudeGeometry(outline(b > 0 ? inset(points, b) : points), { depth: Math.max(0.001, width - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: seg });
  g.translate(0, 0, z0 - (width - 2 * b) / 2);
  // seen from above, the nose and the tail drawn in round
  if (taper) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      for (const [x0, x1, k] of taper) {
        const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
        if (t > 0) p.setZ(i, z0 + (p.getZ(i) - z0) * (1 - k * t * t));
      }
    }
  }
  // shaded smooth across its facets
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  const m = BufferGeometryUtils.mergeVertices(g, 1e-4);
  g.dispose(); m.computeVertexNormals();
  return m;
}
// Whether the closed run of points crosses itself.
function simple(pts) {
  const n = pts.length - (pts[0].distanceTo(pts[pts.length - 1]) < 1e-9 ? 1 : 0);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = pts[j], d = pts[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  }
  return true;
}
// a flat plate of the polygon ([[x, y]]), t thick, centred on z
function plate(poly, t, z) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))), { depth: t, bevelEnabled: false });
  g.translate(0, 0, z - t / 2);
  return g;
}
/* A pane along the line from A to B in the side elevation (from s0 to s1
   of the way), across the car from z0 to z1, stood off the cabin by 8 mm.
   The line runs the way the cabin's outline does (up the windshield, down
   the back light), so the pane faces out. */
function slopePane(A, B, s0, s1, z0, z1) {
  const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), ox = (dy / l) * 0.008, oy = (-dx / l) * 0.008;
  const P = (s) => [A[0] + dx * s + ox, A[1] + dy * s + oy];
  const a = P(s0), b = P(s1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1], 3));
  g.computeVertexNormals();
  return g;
}
// a bar along the segment from p to q in the side elevation, h high, w across, at z
function bar(p, q, h, w, z = 0) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), g = new THREE.BoxGeometry(len, h, w);
  g.rotateZ(Math.atan2(q[1] - p[1], q[0] - p[0])); g.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z);
  return g;
}
const boxAt = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cylZ = (r, len, x, y, z, seg = 18) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(PI / 2); g.translate(x, y, z); return g; };
// a disc facing forward (+x), or back (dir -1)
function discX(r, x, y, z, seg = 16, dir = 1) { const g = new THREE.CircleGeometry(r, seg); g.rotateY(dir * PI / 2); g.translate(x, y, z); return g; }
// a plane facing forward, w across and h high, at (x, y, z)
function faceX(w, h, x, y, z) { const g = new THREE.PlaneGeometry(w, h); g.rotateY(PI / 2); g.translate(x, y, z); return g; }

/* A strip laid on the body's nose from y0 up to y1 (its outline at the
   middle of the car, ahead of xMin), `half` either side, 6 mm proud: a
   grille that follows the curve down the front. */
function noseStrip(body, y0, y1, half, xMin) {
  const run = outline(body).getPoints(12).map((v) => [v.x, v.y])
    .filter(([x, y]) => x > xMin && y >= y0 && y <= y1).sort((a, b) => b[1] - a[1])
    .filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.01);
  const n = run.length, pos = [], uv = [];
  // going down the front, outward is ahead: (-dy, dx)
  const lift = (i) => {
    const a = run[Math.max(0, i - 1)], b = run[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [run[i][0] - (dy / l) * 0.006, run[i][1] + (dx / l) * 0.006];
  };
  for (let i = 0; i < n - 1; i++) {
    const A = lift(i), B = lift(i + 1), va = 1 - i / (n - 1), vb = 1 - (i + 1) / (n - 1);
    pos.push(A[0], A[1], half, B[0], B[1], half, B[0], B[1], -half, A[0], A[1], half, B[0], B[1], -half, A[0], A[1], -half);
    uv.push(1, va, 1, vb, 0, vb, 1, va, 0, vb, 0, va);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// The polygon's part where f(point) >= 0 (Sutherland-Hodgman, one edge).
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
// The outline's points, anticlockwise, the last not repeating the first.
function polygon(points, d) {
  const pts = outline(inset(points, d)).getPoints(5).map((v) => [v.x, v.y]);
  const [f, l] = [pts[0], pts[pts.length - 1]];
  if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) pts.pop();
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return area < 0 ? pts.reverse() : pts;
}

/* ------------------------------------------------------------ the cars */

function partsOf(kind) {
  if (GEOS.has(kind)) return GEOS.get(kind);
  const S = SPECS[kind];
  const parts = new Map(); // what it's made of (a key: body, chrome, g:egg...) -> [geometry]
  const add = (m, g) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(g); };
  const body = "body", top = "top";
  const head = [], tails = [];
  const W = Math.max(S.BW, S.FW);

  // the body, its wheels' openings cut in
  add(body, slab(S.body, S.BW, S.round, 0, 10, S.taper));
  // the cabin; the windshield in two either side of its centre bar, the
  // back light, the side windows set into it
  add(top, slab(S.cabin, S.CW, S.cabRound));
  const edge = S.CW / 2 - S.cabRound - 0.02;
  const [wa, wb, w0, w1] = S.wind;
  add("glass", slopePane(wa, wb, w0, w1, 0.035, edge));
  add("glass", slopePane(wa, wb, w0, w1, -edge, -0.035));
  const [ba, bb, b0, b1, bh] = S.back;
  add("glass", slopePane(ba, bb, b0, b1, -bh, bh));
  const opening = polygon(S.cabin, S.cabRound + 0.035);
  for (const [xa, xb] of S.windows) {
    let w = [[xa, S.sill], [xb, S.sill], [xb, 3], [xa, 3]];
    for (let i = 0; i < opening.length && w.length; i++) {
      const a = opening[i], b = opening[(i + 1) % opening.length];
      w = clip(w, (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    }
    if (w.length >= 3) for (const s of [-1, 1]) add("glass", plate(w, 0.012, s * (S.CW / 2 + 0.004)));
  }

  for (const s of [-1, 1]) {
    // the fenders, proud of the doors; a skirt over a rear wheel
    const fz = S.fenderZ ?? S.FW / 2 - S.fenderW / 2;
    if (S.front) add(body, slab(S.front, S.fenderW, 0.13, s * fz));
    if (S.rear) add(body, slab(S.rear, S.fenderW, 0.13, s * fz));
    // the wheels: the tyre, the whitewall on its outer face, the hubcap
    const { R, track } = S.wheels;
    for (const x of [S.wheels.f, S.wheels.r]) {
      add("rubber", cylZ(R, 0.2, x, R, s * track));
      const ring = new THREE.RingGeometry(R * 0.5, R * 0.86, 22); if (s < 0) ring.rotateY(PI); ring.translate(x, R, s * (track + 0.103));
      add("whitewall", ring);
      const cap = new THREE.SphereGeometry(R * 0.44, 14, 6, 0, PI * 2, 0, PI / 2); cap.scale(1, 0.35, 1); cap.rotateX(s * PI / 2); cap.translate(x, R, s * (track + 0.105));
      add("chrome", cap);
    }
    // the headlamps, a chrome rim round each; the tail lamps
    const [hx, hy, hz, hr] = S.head;
    const rim = new THREE.TorusGeometry(hr, 0.022, 6, 18); rim.rotateY(PI / 2); rim.translate(hx, hy, s * hz);
    add("chrome", rim);
    add("lamp", discX(hr * 0.92, hx + 0.006, hy, s * hz));
    head.push([hx + 0.04, hy, s * hz]);
    const [tx, ty, tz, tr] = S.tail;
    add("tail", discX(tr, tx - 0.006, ty, s * tz, 12, -1));
    tails.push([tx - 0.03, ty, s * tz]);
    // chrome down the side: the '49's spear, the Airflow's strip
    if (S.spear) add("chrome", bar([S.spear[0], S.spear[2]], [S.spear[1], S.spear[2]], 0.03, 0.012, s * (S.BW / 2 + 0.004)));
    // the Fleetline's speedlines
    if (S.speedlines) for (const [x0, x1, y] of S.speedlines) for (let k = 0; k < 3; k++) add("chrome", bar([x0, y + k * 0.07], [x1, y + k * 0.07], 0.022, 0.01, s * (S.FW / 2 + 0.003)));
    // the coupe's running boards, a chrome edge along each
    if (S.runningBoard) {
      const [r0, r1] = S.runningBoard;
      add("dark", boxAt(r1 - r0, 0.04, 0.22, (r0 + r1) / 2, 0.46, s * (S.FW / 2 - 0.12)));
      add("chrome", bar([r0, 0.485], [r1, 0.485], 0.012, 0.012, s * (S.FW / 2 - 0.015)));
    }
    // the bumpers' guards
    for (const x of [S.bumper[0], S.bumper[1]]) add("chrome", boxAt(0.07, 0.3, 0.06, x + Math.sign(x) * 0.035, S.bumper[2] + 0.06, s * 0.42));
  }

  // the bumpers: a chrome bar, its ends wrapped
  for (const x of [S.bumper[0], S.bumper[1]]) {
    const blade = cylZ(0.075, W - 0.06, 0, 0, 0, 14); blade.scale(0.6, 1.35, 1); blade.translate(x, S.bumper[2], 0); add("chrome", blade);
    for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.075, 10, 8); e.scale(0.6, 1.35, 1); e.translate(x - Math.sign(x) * 0.02, S.bumper[2], s * (W / 2 - 0.03)); add("chrome", e); }
  }
  // the hood's chrome bar, its ornament at the front
  if (S.hood) {
    const [p, q] = S.hood;
    add("chrome", bar([p[0], p[1] + 0.01], [q[0], q[1] + 0.01], 0.025, 0.04));
    if (S.ornament) { const o = new THREE.ConeGeometry(0.035, 0.18, 6); o.rotateZ(-PI / 2); o.translate(q[0] + 0.06, q[1] + 0.03, 0); add("chrome", o); }
  }
  // the grille
  if (S.grille) { const g = S.grille; add("g:" + g.tex, faceX(g.w, g.h, g.x, g.y, 0)); }
  if (S.bullet) { const b = new THREE.SphereGeometry(0.1, 12, 10); b.scale(1.3, 1, 1); b.translate(S.bullet[0], S.bullet[1], 0); add("chrome", b); }
  // the coupe's prow: a wedge to a point, its grille on both faces, a chrome
  // spine up the point; the low catwalk grilles either side
  if (S.prow) {
    const { x, tip, half, y0, y1 } = S.prow;
    const wedge = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(x - 0.1, -half), new THREE.Vector2(x + tip, 0), new THREE.Vector2(x - 0.1, half)]), { depth: y1 - y0, bevelEnabled: false });
    // (the triangle drawn in x and z, stood up: its depth runs up)
    wedge.rotateX(-PI / 2); wedge.translate(0, y0, 0);
    add(body, wedge);
    const a = Math.atan2(tip + 0.1, half), len = Math.hypot(tip + 0.1, half);
    for (const s of [-1, 1]) {
      const p = new THREE.PlaneGeometry(len - 0.04, (y1 - y0) * 0.86);
      p.rotateY(PI / 2 - s * a);
      p.translate(x + tip - ((tip + 0.1) / 2) + Math.sin(PI / 2 - a) * 0.004, (y0 + y1) / 2 - 0.02, s * (half / 2 + Math.cos(PI / 2 - a) * 0.004));
      add("g:fine", p);
      const cw = new THREE.PlaneGeometry(0.3, 0.13); cw.rotateY(PI / 2 - s * 0.2); cw.translate(x + 0.04, 0.6, s * 0.52); add("g:fine", cw);
    }
    add("chrome", bar([x + tip + 0.004, y0 + 0.02], [x + tip + 0.004, y1 - 0.01], 0.02, 0.03));
  }
  // the Airflow's waterfall, down its round nose
  if (S.waterfall) { const f = S.waterfall; add("g:vert", noseStrip(S.body, f.y0, f.y1, f.half, S.wheels.f + 0.5)); }
  // underneath, dark
  add("dark", boxAt(S.bumper[0] - S.bumper[1] - 0.9, 0.2, S.BW - 0.2, (S.bumper[0] + S.bumper[1]) / 2, 0.32, 0));
  if (S.taxi) {
    // the checker band at the waist, the roof sign lit
    for (const s of [-1, 1]) { const b = new THREE.PlaneGeometry(1.6, 0.12); if (s < 0) b.rotateY(PI); b.translate(-0.15, 1.03, s * (S.BW / 2 + 0.006)); add("g:check", b); }
    add(top, boxAt(0.5, 0.05, 0.62, -0.55, 1.645, 0));
    add("g:sign", boxAt(0.46, 0.15, 0.22, -0.55, 1.745, 0));
  }

  // One geometry for each thing it's made of, kept for every car of the kind.
  const out = [];
  for (const [key, list] of parts) {
    // (texture coordinates only where there's a picture: the grilles, the band, the sign)
    const keepUv = key.startsWith("g:");
    const ready = list.map((g) => {
      const q = g.index ? g.toNonIndexed() : g;
      if (!keepUv && q.attributes.uv) q.deleteAttribute("uv");
      if (keepUv && !q.attributes.uv) q.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      return q;
    });
    const merged = BufferGeometryUtils.mergeBufferGeometries(ready, false);
    ready.forEach((q) => q.dispose()); list.forEach((g) => g.dispose());
    if (merged) out.push([key, merged]);
  }
  const k = CAR_SCALE, sc = (p) => p.map((v) => v * k);
  const rec = { parts: out, info: { kind, len: lengthOf(S) * k, width: W * k, head: head.map(sc), tail: tails.map(sc) } };
  GEOS.set(kind, rec);
  return rec;
}

/* A car of the kind, in the paint; a two-tone roof now and then. Its
   shape is made once for the kind (partsOf) and shared; each call gives a
   new set of meshes over it. */
export function buildCar(kind, paintHex, roofHex) {
  if (kind === "taxi") paintHex = roofHex = "#a9a9ab";
  const { parts, info } = partsOf(kind);
  const group = new THREE.Group();
  for (const [key, geo] of parts) {
    const mesh = new THREE.Mesh(geo, matFor(key, paintHex, roofHex || paintHex));
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.raycast = () => {};
    group.add(mesh);
  }
  group.scale.setScalar(CAR_SCALE);
  group.userData.car = { ...info, head: info.head.map((p) => [...p]), tail: info.tail.map((p) => [...p]) };
  return group;
}
// The kind's shape made ahead of its first car (it takes a moment).
export function prepareCar(kind) { partsOf(kind); }
function matFor(key, paintHex, roofHex) {
  if (key === "body") return paint(paintHex);
  if (key === "top") return paint(roofHex);
  if (key.startsWith("g:")) return grilleMats()[key.slice(2)];
  return { glass, rubber, whitewall, chrome, dark, lamp, tail }[key]();
}

export function disposeCars() {
  for (const { parts } of GEOS.values()) parts.forEach(([, g]) => g.dispose());
  GEOS.clear();
  for (const m of MATS.values()) m.dispose();
  MATS.clear();
  if (GRILLES) { for (const m of Object.values(GRILLES)) { if (m.map) m.map.dispose(); m.dispose(); } GRILLES = null; }
}
