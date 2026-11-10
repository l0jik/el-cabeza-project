/* The Monolith's land: the Lab's second direction, in Bauhaus's place
   (user: "we're getting rid of Bauhaus and replacing it with something
   imposing & neolithic monoliths", with a picture: great dark stones on a
   cracked, barren plain at dusk, a crescent moon, a long shadow coming at
   you; of the land they were after, the jointed rock of Muley Point, Utah,
   "imposing unreal topography & terrain ... as if being viewed from
   ground level").

   Then (user): "I don't want just the board to spin ... when you rotate
   the board the entire 3D world rotates instead of just the board"; "the
   board to be chiseled into the surface of the ground"; "the megaliths of
   all different shapes that represent the different types of pieces in
   the game to be represented in the landscape ... natural formations of
   rocks ... like a natural landscape you feel like you're in"; "make the
   background ones more varied, and make sure that all the different
   shapes of the pieces, including Cabeza Nova, are represented".

   So the land hangs on the chassis's board group, as the den's room and
   Luna's ground do: the chassis turns the board, never the camera, and
   the whole place turns with it, sky and moon too; the key, fill and back
   lights are turned with it (tick), so a shadow stays where it falls.

     - The board a part of the ground (user: "Make the board a seamless
       part of the ground"; "... with the symmetry of the lines, albeit
       extremely crooked and jagged, chiseled into the ground itself"):
       the chassis's slab, outline and grid hidden; a plateau of
       fractured polygonal plates round it, the board's floor one plate
       of the same rock, level, its edge as irregular as the rest, the
       grid chiseled into it; past the plateau's edge, blocks broken down
       the slope to the plain, rolling out to a horizon the fog takes
       (monolith-ground.js). Built again when the board changes size.
     - Every piece of the game, the standard five and Cabeza Nova's ten,
       stands in the land as natural rock (rockforms.js), each side's
       behind its own end: basalt beyond Dark's, sandstone beyond Light's
       (a weak device gets each shape once). Between them and beyond, a
       land of other rock, angular as the user asked ("Sharp, fractured
       rock surfaces ... Massive angular boulders. Naturally sculpted
       stone corridors"): capped spires, fins, a faceted dome, balanced
       blocks, angular boulders fallen together, a free arch, jointed
       blocks, corridors, jagged ridgelines, and mesas and buttes on the
       horizon.
     - Their long shadows on the ground, away from the dusk, stopped short
       of the platform; rubble and scree.
     - The sky: the last of the dusk low over Dark's end, the night coming
       over, a crescent moon, the first stars, low cloud.

   Nothing tall stands within the camera's reach: the room it's kept in
   (specs.js camera.freeCamera.room, ROOM_HALF each way, above
   ROOM_FLOOR) has every rock outside it or under its floor. The
   formations are built a few at a time after the land comes up (one
   frame's work each), so a switch to the Monolith never stalls. All of it
   painted and modelled here, from fixed seeds: the same land every
   visit. */
import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLAB_X, SLAB_Z, BOARD_COLS, BOARD_ROWS, SQUARE_SIZE } from "../../engine/constants.js";
import { rng } from "./paint.js";
import { quality } from "../tienda-quality.js";
import { hewnBox } from "./hewn.js";
import { cubesSdf, weathered, rockGeometry, rockMaterial, STONE, noise3, sdRoundBox, sdEllipsoid, sdColumn, smin, smax } from "./rockforms.js";
import { grooveSheet, plateField } from "./monolith-ground.js";
import { BENCH_GAP, BENCH_ROOM } from "../../chassis/set-out.js";

// The camera's room (specs.js camera.freeCamera.room) and how far out the
// tall rock must stand to be outside it at every corner.
export const ROOM_HALF = 24;
export const ROOM_FLOOR = 0.9;
export const ROOM_CLEAR = Math.ceil(ROOM_HALF * Math.SQRT2 + 3);
const R_OUT = 170; // the ground's edge, past the sky's (the fog takes it)
const SKY_R = 150;
const UP = new THREE.Vector3(0, 1, 0);
// The moon: low over Dark's end, a little to the right of a player's line
// (the read-out takes the left), where a low view sees it. MOON_A is its
// bearing as planLand reckons one (x = cos a, z = sin a).
const MOON = new THREE.Vector3(0.32, 0.12, -0.94).normalize();
const MOON_A = Math.atan2(MOON.z, MOON.x);

export const LAND = {
  sky: { zenith: "#0B0E16", high: "#161B29", mid: "#262B3F", glow: "#C98E93", glowWarm: "#E2A98A", band: "#4A4656" },
  fog: 0x3e3c4b,
};

const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const shared = (tex) => { tex.__shared = true; return tex; };
const CACHE = {};

/* ---------------------------------------------------------------- painted */

// Stone faces: weathering streaks down, faint bedding across, mottling.
// Grey, so the material's colour makes it basalt or sandstone.
function stoneTexture() {
  if (CACHE.stone) return CACHE.stone;
  const S = quality().detail === 0 ? 256 : 512;
  const c = canvas(S, S), g = c.getContext("2d"), r = rng(4401);
  g.fillStyle = "#c9c7c3"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = S * (0.05 + r() * 0.22);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.5 ? "60,58,56" : "235,232,226";
    gr.addColorStop(0, `rgba(${v},${0.08 + r() * 0.14})`); gr.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Bedding: thin bands across.
  for (let y = 0; y < S; y += 6 + r() * 22) { g.fillStyle = `rgba(40,38,36,${0.05 + r() * 0.08})`; g.fillRect(0, y, S, 1 + r() * 2.5); }
  // Weathering: streaks running down from the top.
  for (let i = 0; i < 140; i++) {
    const x = r() * S, len = S * (0.1 + r() * 0.6), w = 0.5 + r() * 2.2;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(25,24,22,${0.1 + r() * 0.18})`); gr.addColorStop(1, "rgba(25,24,22,0)");
    g.fillStyle = gr; g.fillRect(x, r() * S * 0.3, w, len);
  }
  // Grain and pits.
  for (let i = 0; i < S * 22; i++) { g.fillStyle = r() < 0.5 ? `rgba(20,20,20,${r() * 0.25})` : `rgba(255,255,255,${r() * 0.18})`; g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (CACHE.stone = shared(t));
}

// Slickrock under foot (the plateau's plates and the board's floor): no
// way to it, as a flat of weathered rock has none; mottled, grained, pitted,
// a few short hairline cracks. Drawn to tile.
function slickTexture() {
  if (CACHE.slick) return CACHE.slick;
  const S = quality().detail === 0 ? 512 : 1024;
  const c = canvas(S, S), g = c.getContext("2d"), r = rng(6211);
  const tiled = (draw) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); draw(); g.restore(); } };
  g.fillStyle = "#c2bcb3"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = S * (0.03 + r() * 0.16), v = r() < 0.55 ? "86,80,74" : "232,226,216", a = 0.05 + r() * 0.11;
    tiled(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${v},${a})`); gr.addColorStop(1, `rgba(${v},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); });
  }
  // Weathering pits, a lit rim on the far side of each.
  for (let i = 0; i < S * 0.28; i++) {
    const x = r() * S, y = r() * S, rad = 0.7 + Math.pow(r(), 4) * S * 0.007, a = 0.12 + r() * 0.22;
    tiled(() => {
      g.fillStyle = `rgba(48,44,40,${a})`; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(245,240,230,0.1)"; g.beginPath(); g.arc(x + rad * 0.45, y + rad * 0.45, rad * 0.7, 0, Math.PI * 2); g.fill();
    });
  }
  // Short hairline cracks, wandering.
  for (let i = 0; i < 26; i++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    const pts = [[x, y]], n = 6 + Math.floor(r() * 14);
    for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * S * 0.012; y += Math.sin(a) * S * 0.012; pts.push([x, y]); }
    const w = 0.7 + r() * 0.9, al = 0.18 + r() * 0.22;
    tiled(() => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([px, py]) => g.lineTo(px, py)); g.lineWidth = w; g.strokeStyle = `rgba(36,33,30,${al})`; g.stroke(); });
  }
  for (let i = 0; i < S * 30; i++) { g.fillStyle = r() < 0.5 ? `rgba(30,28,26,${r() * 0.22})` : `rgba(255,252,246,${r() * 0.16})`; g.fillRect(r() * S, r() * S, 1 + r(), 1 + r()); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (CACHE.slick = shared(t));
}

// The plain: dust over stone, cracked square along the rock's joints, and
// finer cracks between. Drawn to tile (every line drawn again a tile over).
function plainTexture() {
  if (CACHE.plain) return CACHE.plain;
  const S = quality().detail === 0 ? 512 : 1024;
  const c = canvas(S, S), g = c.getContext("2d"), r = rng(9127);
  g.fillStyle = "#a9a49c"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, rad = S * (0.04 + r() * 0.14);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.55 ? "70,66,62" : "200,194,184";
    gr.addColorStop(0, `rgba(${v},${0.08 + r() * 0.12})`); gr.addColorStop(1, `rgba(${v},0)`);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.fillStyle = gr; g.save(); g.translate(ox, oy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
  }
  const crack = (pts, w, a) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (const [x, y] of pts.slice(1)) g.lineTo(x + ox, y + oy);
      g.lineWidth = w; g.strokeStyle = `rgba(28,26,24,${a * 0.62})`; g.stroke();
      g.beginPath(); g.moveTo(pts[0][0] + ox + 1.2, pts[0][1] + oy + 1.2);
      for (const [x, y] of pts.slice(1)) g.lineTo(x + ox + 1.2, y + oy + 1.2);
      g.lineWidth = Math.max(0.5, w * 0.4); g.strokeStyle = `rgba(235,230,220,${a * 0.35})`; g.stroke();
    }
  };
  // A wandering line from one point toward another.
  const wander = (x0, y0, x1, y1, steps, jit) => {
    const pts = [[x0, y0]];
    for (let k = 1; k <= steps; k++) { const f = k / steps; pts.push([x0 + (x1 - x0) * f + (r() - 0.5) * jit, y0 + (y1 - y0) * f + (r() - 0.5) * jit]); }
    return pts;
  };
  // The joints: long cracks nearly square to each other.
  for (let i = 0; i < 5; i++) { const y = r() * S; crack(wander(0, y, S, y + (r() - 0.5) * S * 0.1, 18, S * 0.012), 2.2 + r() * 1.4, 0.75); }
  for (let i = 0; i < 5; i++) { const x = r() * S; crack(wander(x, 0, x + (r() - 0.5) * S * 0.1, S, 18, S * 0.012), 2.2 + r() * 1.4, 0.75); }
  // Finer cracks between them, branching.
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, a = r() * Math.PI * 2, len = S * (0.03 + r() * 0.1);
    crack(wander(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 5, S * 0.008), 0.8 + r() * 1.2, 0.5);
  }
  // Grit.
  for (let i = 0; i < S * 30; i++) { g.fillStyle = r() < 0.5 ? `rgba(30,28,26,${r() * 0.22})` : `rgba(240,235,225,${r() * 0.16})`; g.fillRect(r() * S, r() * S, 1 + r() * 1.6, 1 + r() * 1.6); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (CACHE.plain = shared(t));
}

// The sky, wrapped round (u: all the way round, v: the zenith down to the
// nadir): the dusk's glow low toward Dark's end, the night over the rest,
// stars, low cloud. Below the horizon, the fog's own colour.
function skyTexture() {
  if (CACHE.sky) return CACHE.sky;
  const W = quality().detail === 0 ? 1024 : 2048, H = W / 2;
  const c = canvas(W, H), g = c.getContext("2d"), r = rng(5501), K = LAND.sky;
  const lin = g.createLinearGradient(0, 0, 0, H * 0.5);
  lin.addColorStop(0, K.zenith); lin.addColorStop(0.45, K.high); lin.addColorStop(0.8, K.mid); lin.addColorStop(1, K.band);
  g.fillStyle = lin; g.fillRect(0, 0, W, H * 0.5);
  g.fillStyle = `#${LAND.fog.toString(16).padStart(6, "0")}`; g.fillRect(0, H * 0.5, W, H * 0.5);
  // The dusk: three.js's sphere puts -z three quarters of the way round.
  const ux = 0.75 * W, hy = H * 0.5;
  for (const [rx, ry, col, a] of [[W * 0.34, H * 0.2, K.glow, 0.55], [W * 0.18, H * 0.09, K.glowWarm, 0.6], [W * 0.5, H * 0.32, "#6E6177", 0.35]]) {
    for (const ox of [-W, 0, W]) {
      g.save(); g.translate(ux + ox, hy); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, hexA(col, a)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, Math.PI, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  // Stars, thicker toward the zenith and away from the dusk.
  for (let i = 0; i < W * 0.9; i++) {
    const x = r() * W, y = Math.pow(r(), 1.6) * H * 0.42;
    const du = Math.min(Math.abs(x - ux), W - Math.abs(x - ux)) / W;
    if (y > H * 0.28 && du < 0.22 && r() < 0.85) continue;
    const s = r() < 0.04 ? 1.8 : 0.6 + r() * 0.9;
    g.fillStyle = `rgba(235,236,245,${0.25 + r() * 0.65})`; g.fillRect(x, y, s, s);
  }
  // Low cloud: long dark banks, lit underneath toward the dusk.
  for (let i = 0; i < 22; i++) {
    const x = r() * W, y = H * (0.3 + r() * 0.17), rx = W * (0.04 + r() * 0.1), ry = H * (0.008 + r() * 0.02);
    const du = Math.min(Math.abs(x - ux), W - Math.abs(x - ux)) / W;
    for (const ox of [-W, 0, W]) {
      g.save(); g.translate(x + ox, y); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(22,24,34,${0.55 + r() * 0.3})`); gr.addColorStop(1, "rgba(22,24,34,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      if (du < 0.2) {
        const lit = g.createRadialGradient(0, rx * 0.35, 0, 0, rx * 0.35, rx * 0.8);
        lit.addColorStop(0, hexA(K.glow, 0.28)); lit.addColorStop(1, hexA(K.glow, 0));
        g.fillStyle = lit; g.beginPath(); g.arc(0, rx * 0.35, rx * 0.8, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  return (CACHE.sky = shared(t));
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// A crescent moon with a faint halo.
function moonTexture() {
  if (CACHE.moon) return CACHE.moon;
  const S = 256, c = canvas(S, S), g = c.getContext("2d");
  const halo = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
  halo.addColorStop(0, "rgba(220,224,235,0.18)"); halo.addColorStop(1, "rgba(220,224,235,0)");
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  const m = canvas(S, S), mg = m.getContext("2d");
  mg.fillStyle = "#ECE8DD"; mg.beginPath(); mg.arc(S / 2, S / 2, S * 0.17, 0, Math.PI * 2); mg.fill();
  mg.globalCompositeOperation = "destination-out";
  mg.beginPath(); mg.arc(S / 2 + S * 0.07, S / 2 - S * 0.035, S * 0.165, 0, Math.PI * 2); mg.fill();
  g.drawImage(m, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return (CACHE.moon = shared(t));
}

// A long shadow on the plain: dark at its foot, gone at its end.
function shadowTexture() {
  if (CACHE.shadow) return CACHE.shadow;
  const c = canvas(64, 256), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(6,6,10,0.62)"); gr.addColorStop(0.55, "rgba(6,6,10,0.3)"); gr.addColorStop(1, "rgba(6,6,10,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, "rgba(0,0,0,1)"); side.addColorStop(0.12, "rgba(0,0,0,0)"); side.addColorStop(0.88, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = side; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  return (CACHE.shadow = shared(t));
}

/* ---------------------------------------------------------------- the ground */

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* The board's floor: the board and its set-out bench at either end, a
   little room round them (the floor plate takes in every plate this
   meets, so its own edge lies further out, as the plates fall). */
export function floorRect(hx, hz) {
  return [hx + 0.55, hz + BENCH_GAP + BENCH_ROOM + 0.45];
}
// How far a point lies out from the floor's rectangle (0 within it).
function outFromBoard(x, z, hx, hz) {
  const [rx, rz] = floorRect(hx, hz);
  const dx = Math.max(Math.abs(x) - rx, 0), dz = Math.max(Math.abs(z) - rz, 0);
  return Math.hypot(dx, dz);
}
// Where the plateau ends (P out from the floor), the slope below it (T
// wide), and how far each ledge drops: by direction, a ledge's own ragged
// line.
function ledgeLine(x, z) {
  const a = Math.atan2(z, x), c = Math.cos(a), s = Math.sin(a);
  return {
    P: 12 + 7 * (noise3(c * 1.3 + 4, s * 1.3, 0.5, 41) - 0.5) + 3 * (noise3(c * 4.2, s * 4.2, 1.5, 43) - 0.5),
    T: 6 + 5 * (noise3(c * 2.1, s * 2.1, 2.5, 47) - 0.5),
    d1: 1.3 + 0.9 * noise3(c * 3.1, s * 3.1, 3.5, 51),
    d2: 1.8 + 1.4 * noise3(c * 2.6, s * 2.6, 4.5, 53),
  };
}
/* The ground's height at (x, z) of the land, round a board hx by hz:
   under the plateau the floor of the cracks between its plates (the plates
   stand on it, monolith-ground.js), then its two ledges down (a steep
   face, scree at the foot), the plain rolling beyond. */
export function groundAt(x, z, hx, hz) {
  const d = outFromBoard(x, z, hx, hz);
  const { P, T, d1, d2 } = ledgeLine(x, z);
  let h = -0.5 + 0.05 * (noise3(x * 0.33, 0.7, z * 0.33, 61) - 0.5);
  h -= d1 * ease((d - P + 0.7) / 1.4) + d2 * ease((d - P - T + 1.1) / 2.2);
  const far = ease((d - P - T - 3) / 14);
  h += far * (2.4 * (noise3(x * 0.016, 1.1, z * 0.016, 67) - 0.5) + 0.9 * (noise3(x * 0.07, 2.1, z * 0.07, 71) - 0.5));
  return h;
}

// The land's own stone under foot: basalt toward Dark's end, sandstone
// toward Light's, a ragged line between; dust on the plain; under the
// plateau, the dark of the cracks.
function groundColour(x, y, z, d, P, slope) {
  const side = ease((z + 4 + 12 * (noise3(x * 0.04, 3.3, z * 0.04, 73) - 0.5)) / 10);
  let c = mix3([0.27, 0.28, 0.3], [0.74, 0.62, 0.48], side);
  c = mix3(c, [0.52, 0.41, 0.33], ease((d - P - 5) / 9) * 0.7);
  if (slope > 0.25) {
    const b = 0.5 + 0.5 * Math.sin(y * 2.6 + 3 * noise3(x * 0.05, 0, z * 0.05, 79));
    c = mix3(c, mix3([0.34, 0.27, 0.22], [0.66, 0.55, 0.43], b * (0.35 + 0.65 * side)), ease((slope - 0.25) * 2.5));
  }
  const m = (0.84 + 0.32 * noise3(x * 0.22, 0.3, z * 0.22, 83)) * (0.55 + 0.45 * ease((d - P + 0.5) / 1.5));
  return [c[0] * m, c[1] * m, c[2] * m];
}
/* The plateau's own rock, its plates and the board's floor alike: a pale,
   weathered slickrock round the board (dark and light stones both read
   on it), going over to the two stones further out, basalt toward Dark's
   end and sandstone toward Light's, a hint of each even under the board. */
function plateColour(x, y, z, d) {
  const side = ease((z + 14 * (noise3(x * 0.05, 5.3, z * 0.05, 91) - 0.5)) / 26 + 0.5);
  const stone = mix3([0.3, 0.31, 0.33], [0.7, 0.58, 0.45], side);
  let c = mix3([0.55, 0.52, 0.47], stone, 0.22 + 0.62 * ease((d - 1.5) / 9));
  const m = 0.88 + 0.24 * noise3(x * 0.4, 0.9, z * 0.4, 93) + 0.08 * (noise3(x * 2.1, 1.9, z * 2.1, 97) - 0.5);
  c = [c[0] * m, c[1] * m, c[2] * m];
  return c;
}

/* The ground as one mesh: rings from the board's own edge out to the
   land's edge, round in the end. Under the plateau it's the floor of
   the cracks between the plates (they stand on it: monolith-ground.js);
   past it, the slope and the plain. */
function terrainGeometry(hx, hz, detail) {
  const M = detail === 0 ? 168 : 296;
  const TAU = Math.PI * 2;
  let angles = Array.from({ length: M }, (_, j) => (j / M) * TAU);
  const corners = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]].map(([x, z]) => (Math.atan2(z, x) + TAU) % TAU);
  angles = angles.filter((a) => corners.every((c) => Math.min(Math.abs(a - c), TAU - Math.abs(a - c)) > (0.45 * TAU) / M)).concat(corners).sort((a, b) => a - b);
  const D = [0, 0.006, 0.1, 0.3, 0.6, 1, 1.5, 2.1, 2.8, 3.6, 4.5, 5.5, 6.6, 7.8, 9, 10.2, 11.4, 12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21,
    22.4, 24, 26, 28.5, 31.5, 35, 39, 44, 50, 57, 65, 74, 84, 95, 107, 120, 134, 145];
  const last = D[D.length - 1], A = angles.length;
  const pos = new Float32Array(D.length * A * 3), dist = new Float32Array(D.length * A), lip = new Float32Array(D.length * A);
  angles.forEach((a, j) => {
    const c = Math.cos(a), s = Math.sin(a);
    const r0 = Math.min(Math.abs(c) > 1e-9 ? hx / Math.abs(c) : Infinity, Math.abs(s) > 1e-9 ? hz / Math.abs(s) : Infinity);
    D.forEach((di, i) => {
      const r = i === 0 ? r0 : r0 + (di * (R_OUT - r0)) / last;
      const x = c * r, z = s * r, k = i * A + j;
      pos[k * 3] = x; pos[k * 3 + 1] = groundAt(x, z, hx, hz); pos[k * 3 + 2] = z;
      dist[k] = i === 0 ? 0 : outFromBoard(x, z, hx, hz);
      lip[k] = ledgeLine(x, z).P;
    });
  });
  const idx = [];
  for (let i = 0; i < D.length - 1; i++) for (let j = 0; j < A; j++) {
    const j1 = (j + 1) % A;
    const a = i * A + j, b = i * A + j1, c = (i + 1) * A + j1, d = (i + 1) * A + j;
    idx.push(a, b, d, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nor = geo.attributes.normal.array, col = new Float32Array(pos.length);
  for (let k = 0; k < D.length * A; k++) {
    const [r, g, b] = groundColour(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], dist[k], lip[k], 1 - nor[k * 3 + 1]);
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(D.length * A * 2), 2));
  return geo;
}

/* ---------------------------------------------------------------- the forms */

// The game's cube layouts ("x,row,height", engine/anomaly.js) as cells
// [x, up, depth]; a box of them.
const V = (s) => s.split(";").map((t) => t.split(",").map(Number)).map(([x, row, up]) => [x, up, row]);
const BOX = (w, up, d) => { const out = []; for (let x = 0; x < w; x++) for (let y = 0; y < up; y++) for (let z = 0; z < d; z++) out.push([x, y, z]); return out; };
/* Every piece in the game, the standard five and Cabeza Nova's ten, as
   the land's rock: its pose for Light's sandstone, then (where it has
   one) another for Dark's basalt. Standing, mostly, where the rock would:
   the Flaco and the 1×3 a pillar and a fallen column, the Chato a fin,
   the Turrito a block balanced on a pedestal, the Cabeza a disc stood on
   edge, the Codo an overhang, the Arcos arches, the Rayo stepped out
   over itself, the Zeta and the Cruce (a capped spire) balanced on one
   cube, the Hombro a corner with its spire. */
export const PIECE_FORMS = [
  ["cabeza", { disc: true }],
  ["turrito", { cells: BOX(1, 1, 1), pedestal: true }],
  ["opa", { cells: BOX(2, 2, 2) }],
  ["flaco", { cells: BOX(1, 2, 1) }, { cells: BOX(2, 1, 1), fallen: true }],
  ["chato", { cells: BOX(1, 2, 2) }],
  ["block1x3", { cells: BOX(1, 3, 1) }, { cells: BOX(3, 1, 1), fallen: true }],
  ["block2x3", { cells: BOX(3, 1, 2) }, { cells: BOX(3, 2, 1) }],
  ["codo", { cells: V("0,0,0;0,0,1;1,0,1"), face: true }],
  ["arcoChico", { cells: V("0,0,0;0,0,1;1,0,1;2,0,0;2,0,1"), face: true }],
  ["arcoAlto", { cells: V("0,0,0;0,0,1;0,0,2;1,0,2;2,0,0;2,0,1;2,0,2"), face: true }],
  ["arcoAncho", { cells: V("0,0,0;0,0,1;1,0,1;2,0,1;3,0,0;3,0,1"), face: true }],
  ["rayo", { cells: V("0,0,0;1,0,0;1,0,1;2,0,1"), face: true }],
  ["zeta", { cells: V("0,0,0;0,0,1;1,0,1;2,0,1;2,0,2"), face: true }],
  ["hombro", { cells: V("0,0,0;1,0,0;0,1,0;0,0,1") }],
  ["cruce", { cells: V("1,0,0;0,0,1;1,0,1;2,0,1"), face: true }],
];

/* A piece's form as rock: its distance function and size, its cube a
   C units. */
function pieceRock(pose, C, R) {
  if (pose.disc) {
    const r = C * 1.05, w = C * 0.32, e = Math.min(0.9, w * 0.35);
    const sdf = (x, y, z) => {
      const q = Math.hypot(y - r * 0.82, z) - (r - e), t = Math.abs(x) - (w - e);
      return Math.min(Math.max(q, t), 0) + Math.hypot(Math.max(q, 0), Math.max(t, 0)) - e;
    };
    return { sdf, size: [w * 2, r * 1.82, r * 2] };
  }
  const { sdf: cubes, size } = cubesSdf(pose.cells, C, C * (0.05 + R() * 0.04));
  if (!pose.pedestal) return { sdf: cubes, size };
  // A balanced rock: the block on a pedestal worn narrow under it.
  const ph = C * (0.75 + R() * 0.3);
  const sdf = (x, y, z) => {
    const ped = Math.hypot(x, z) - C * (0.26 + 0.12 * Math.max(0, (ph - y) / ph)) * (1 + 0.15 * Math.sin(y * 1.7));
    const p = Math.max(ped, y - ph - C * 0.2, -y - 1);
    return smin(cubes(x, y - ph, z), p, C * 0.25);
  };
  return { sdf, size: [size[0], size[1] + ph, size[2]] };
}

/* A block broken on every side: the planes of a random convex polytope
   round (cx, cy, cz), about r out (sx, sy, sz stretch it), as a distance
   (a bound, fine near the surface). Angular, flat-faced, as rock breaks. */
function polytope(R, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, n = 11) {
  const planes = [];
  for (let i = 0; i < n; i++) {
    // (A face a way; the first six roughly the box's, then any.)
    let v = i < 6 ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][i].map((c) => c + (R() - 0.5) * 0.5) : [R() - 0.5, R() - 0.5, R() - 0.5];
    const l = Math.hypot(v[0], v[1], v[2]);
    v = v.map((c) => c / l);
    // (Its distance out along that way, through the stretch.)
    const reach = r * Math.hypot(v[0] * sx, v[1] * sy, v[2] * sz) * (0.82 + R() * 0.3);
    planes.push([v[0], v[1], v[2], reach]);
  }
  return (x, y, z) => {
    let d = -Infinity;
    for (const [a, b, c, o] of planes) { const k = a * (x - cx) + b * (y - cy) + c * (z - cz) - o; if (k > d) d = k; }
    return d;
  };
}

/* The land's other rock, each kind its own distance function and size. */
const OTHER = {
  mesa(R) {
    const W = 16 + R() * 18, D = 12 + R() * 12, H = 10 + R() * 15;
    return { sdf: (x, y, z) => smin(sdRoundBox(x, y - H / 2, z, W / 2, H / 2, D / 2, 1.5), sdEllipsoid(x, y + H * 0.05, z, W / 2 + H * 0.4, H * 0.32, D / 2 + H * 0.4), H * 0.22), size: [W + H * 0.8, H, D + H * 0.8], layer: 2.2 + R() * 1.4, strata: 0.8, wear: 0.7 };
  },
  butte(R) {
    const W = 9 + R() * 8, D = 8 + R() * 7, H = 17 + R() * 16;
    return { sdf: (x, y, z) => smin(sdRoundBox(x, y - H / 2, z, W / 2, H / 2, D / 2, 1.6), sdEllipsoid(x, y + H * 0.04, z, W / 2 + H * 0.4, H * 0.3, D / 2 + H * 0.4), H * 0.2), size: [W + H * 0.8, H, D + H * 0.8], layer: 2 + R() * 1.2, strata: 0.75, wear: 0.6 };
  },
  spire(R) {
    // A capped spire (a hoodoo): a column waisted under a wider cap.
    const r = 1.3 + R() * 1.3, H = 10 + R() * 12, cr = r * (1.7 + R() * 0.5);
    return {
      sdf: (x, y, z) => {
        const waist = r * (1 - 0.35 * Math.exp(-(((y - H * 0.78) / (H * 0.12)) ** 2)) + 0.25 * Math.max(0, (H * 0.3 - y) / H));
        const col = Math.max(Math.hypot(x, z) - waist, y - H, -y - 1);
        return smin(col, sdEllipsoid(x, y - H, z, cr, r * 0.75, cr * 0.9), r * 0.4);
      },
      size: [cr * 2, H + r * 0.75, cr * 1.8], layer: 0.9 + R() * 0.5, strata: 0.45, wear: 0.25,
    };
  },
  fins(R) {
    // Fins: thin walls of rock side by side, joined at the foot.
    const n = 2 + Math.floor(R() * 3), t = 1.6 + R() * 1.4, L = 12 + R() * 12, H = 8 + R() * 8, gap = t * 2.4;
    const hs = Array.from({ length: n }, () => H * (0.7 + R() * 0.3));
    const W = (n - 1) * gap + t;
    return {
      sdf: (x, y, z) => {
        let d = Infinity;
        for (let i = 0; i < n; i++) d = Math.min(d, sdRoundBox(x - (i * gap - W / 2 + t / 2), y - hs[i] / 2, z, t / 2, hs[i] / 2, L / 2, t * 0.45));
        return smin(d, sdRoundBox(x, y, z, W / 2 + 1, 1.2, L / 2 + 1, 1), 1.4);
      },
      size: [W + 2, H, L + 2], layer: 1.2 + R() * 0.6, strata: 0.35, wear: 0.35,
    };
  },
  dome(R) {
    // A slickrock dome, its sandstone bedded at a slant, broken into facets.
    const rx = 9 + R() * 8, ry = 5 + R() * 4, rz = 8 + R() * 6;
    const facets = polytope(R, 0, -ry * 0.25, 0, 1, rx, ry, rz, 16);
    return { sdf: (x, y, z) => smax(sdEllipsoid(x, y + ry * 0.25, z, rx, ry, rz), facets(x, y, z), 0.6), size: [rx * 2, ry * 0.75, rz * 2], layer: 0.8 + R() * 0.5, strata: 0.25, tilt: 0.3 + R() * 0.4, wear: 0.3 };
  },
  balanced(R) {
    // A great angular block on a pedestal worn narrow under it.
    const br = 2.6 + R() * 2, ph = 3 + R() * 3, pr = br * 0.42;
    const cap = polytope(R, 0, ph + br * 0.75, 0, br, 1.2, 0.85, 1);
    const ped = polytope(R, 0, ph * 0.5, 0, 1, pr * 1.3, ph * 0.55, pr * 1.3, 9);
    return {
      sdf: (x, y, z) => Math.min(cap(x, y, z), Math.max(ped(x, y, z), Math.hypot(x, z) - pr * (1 + 0.5 * Math.max(0, (ph - y) / ph)), -y - 1)),
      size: [br * 2.6, ph + br * 1.7, br * 2.2], layer: 0.9, strata: 0.2, wear: 0.25,
    };
  },
  boulders(R) {
    // Massive angular boulders, fallen together: each a block broken on
    // every side, some leaning on the others.
    const n = 3 + Math.floor(R() * 4), parts = [];
    for (let i = 0; i < n; i++) {
      const r = 1.4 + R() * 2.6, a = R() * Math.PI * 2, d = R() * 4.5;
      parts.push(polytope(R, Math.cos(a) * d, r * (0.45 + R() * 0.3), Math.sin(a) * d, r, 0.9 + R() * 0.5, 0.6 + R() * 0.4, 0.9 + R() * 0.5));
    }
    return {
      sdf: (x, y, z) => { let d = Infinity; for (const f of parts) d = Math.min(d, f(x, y, z)); return d; },
      size: [18, 8, 18], layer: 1, strata: 0.1, wear: 0.2,
    };
  },
  corridor(R) {
    // A corridor worn through the rock: two walls, a narrow way between,
    // their faces broken, their tops ragged.
    const L = 16 + R() * 14, t = 2.4 + R() * 1.6, gap = 1.2 + R() * 1.4, H = 7 + R() * 7;
    const top = (x, side) => H * (0.78 + 0.22 * noise3(x * 0.25, side, 0.5, 131));
    const wall = (x, y, z, side) => {
      const cz = side * (gap / 2 + t / 2);
      return Math.max(sdRoundBox(x, y - H / 2, z - cz, L / 2, H / 2, t / 2, 0.5), y - top(x, side));
    };
    return {
      sdf: (x, y, z) => smin(Math.min(wall(x, y, z, -1), wall(x, y, z, 1)), sdRoundBox(x, y, z, L / 2 + 0.5, 0.8, gap / 2 + t + 0.5, 0.5), 0.8),
      size: [L + 1, H, gap + t * 2 + 1], layer: 1.1 + R() * 0.6, strata: 0.35, wear: 0.3, face: true,
    };
  },
  ridge(R) {
    // A jagged ridgeline: a long blade of rock, its crest in teeth.
    const L = 22 + R() * 16, w = 4 + R() * 3, H = 8 + R() * 8;
    const crest = (x) => H * (0.55 + 0.3 * noise3(x * 0.12, 3.3, 0.5, 141) + 0.18 * Math.abs(Math.sin(x * 0.9 + noise3(x * 0.3, 1.1, 0, 143) * 4)));
    return {
      sdf: (x, y, z) => {
        const hw = w / 2 * Math.max(0.15, 1 - Math.max(0, y) / (crest(x) * 1.05));
        return Math.max(Math.abs(z) - hw, y - crest(x), Math.abs(x) - L / 2, -y - 1) * 0.8;
      },
      size: [L, H * 1.05, w + 1], layer: 1.4 + R() * 0.8, strata: 0.3, wear: 0.3, face: true,
    };
  },
  arch(R) {
    // A free arch: a fin with a window worn through it.
    const L = 16 + R() * 8, t = 3 + R() * 2, H = 10 + R() * 5;
    return {
      sdf: (x, y, z) => smax(sdRoundBox(x, y - H / 2, z, L / 2, H / 2, t / 2, t * 0.4), -sdEllipsoid(x, y - H * 0.38, z, L * 0.3, H * 0.36, t * 3), 1),
      size: [L, H, t], layer: 1.3 + R() * 0.6, strata: 0.4, wear: 0.4, face: true,
    };
  },
  jointed(R) {
    // Muley Point's rock: a low shelf split into blocks along its joints.
    const W = 14 + R() * 12, D = 10 + R() * 10, H = 3 + R() * 3.5, s1 = 3 + R() * 2, s2 = 3 + R() * 2;
    const joints = [];
    for (let x = -W / 2 + s1; x < W / 2; x += s1 * (0.8 + R() * 0.4)) joints.push({ x, z: 0, nx: 1, nz: 0.08 * (R() - 0.5), w: 0.18 });
    for (let z = -D / 2 + s2; z < D / 2; z += s2 * (0.8 + R() * 0.4)) joints.push({ x: 0, z, nx: 0.08 * (R() - 0.5), nz: 1, w: 0.18 });
    return { sdf: (x, y, z) => sdRoundBox(x, y - H / 2, z, W / 2, H / 2, D / 2, 0.7), size: [W, H, D], layer: 0.9, strata: 0.25, wear: 0.3, joints };
  },
};
// The background's kinds, near and far, and how many of each.
const MID = ["spire", "spire", "spire", "spire", "fins", "fins", "dome", "balanced", "balanced", "boulders", "boulders", "boulders", "arch", "jointed", "jointed", "corridor", "corridor", "ridge"];
const FAR = ["mesa", "mesa", "mesa", "mesa", "butte", "butte", "butte", "butte", "ridge", "ridge"];

/* ---------------------------------------------------------------- the plan */

/* Where every formation stands and what it is, worked out at once (cheap:
   numbers only); the rock itself is built a few at a time after. Each is
   kept clear of the others, and of the camera's room: its nearest edge
   outside ROOM_CLEAR. */
function planLand(q) {
  const R = rng(20261110);
  const placed = [];
  const fits = (x, z, rho) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.rho + rho + 3);
  /* Nothing stands in the moon's way: it's low (a few degrees up) and
     drawn under all the rock, so anything on its bearing would hide it.
     Kept clear: its own breadth, the formation's, and some for a view
     from off the middle (the camera's orbit). */
  const underMoon = (a, r, rho) => Math.abs(Math.atan2(Math.sin(a - MOON_A), Math.cos(a - MOON_A))) < 0.18 + (rho + 3) / r;
  function place(rho, a0, a1, rMin, rMax, edge = SKY_R - 4) {
    for (let tries = 0; tries < 220; tries++) {
      const a = a0 + R() * (a1 - a0), r = Math.max(ROOM_CLEAR + rho + 2, rMin) + R() * Math.max(0, rMax - Math.max(ROOM_CLEAR + rho + 2, rMin));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (r + rho > edge || underMoon(a, r, rho)) continue;
      if (fits(x, z, rho)) return { x, z, a };
      if (tries > 150) rMax += 1.5;
    }
    return null;
  }
  const jobs = [];
  const sides = q.detail === 0 ? null : ["light", "dark"];
  PIECE_FORMS.forEach(([type, first, second], i) => {
    const forSides = sides || [i % 2 ? "dark" : "light"];
    for (const side of forSides) {
      const pose = side === "dark" && second ? second : first;
      const C = 5 + R() * 2.4;
      const { sdf, size } = pieceRock(pose, C, R);
      const rho = Math.hypot(size[0], size[2]) / 2 + (pose.fallen ? 2 : 0.8);
      // Each side's behind its own end: Light's toward +z, Dark's toward -z.
      const mid = side === "light" ? Math.PI / 2 : -Math.PI / 2;
      const spot = place(rho, mid - 1.25, mid + 1.25, 0, ROOM_CLEAR + rho + 34);
      if (!spot) continue;
      placed.push({ x: spot.x, z: spot.z, rho });
      // (A shape that reads face on turned to the board; the disc's flat side too.)
      const rotY = pose.disc ? Math.PI - spot.a + (R() - 0.5) * 0.5 : pose.face ? Math.atan2(-Math.cos(spot.a), -Math.sin(spot.a)) + (R() - 0.5) * 0.5 : R() * Math.PI * 2;
      jobs.push({
        label: `${type}:${side}`, type, side, kind: "piece", sdf, size, C, seed: 1000 + jobs.length * 37,
        st: side === "dark" ? STONE.basalt : STONE.sandstone, x: spot.x, z: spot.z, rho, rotY,
        lean: pose.fallen ? 0.12 + R() * 0.12 : (R() - 0.5) * 0.06, sink: pose.fallen ? C * 0.25 : 0.4 + R() * 0.6,
        weather: { wear: C * 0.03, freq: 1.5 / C, layer: 0.9 + R() * 0.8, strata: C * 0.04, notch: pose.fallen || pose.disc ? 0 : 0.3 + R() * 0.25, notchAt: 0.7 },
        joints: 1 + Math.floor(R() * 3),
      });
    }
  });
  // The rest of the land: near, every way between the pieces' ranks, in
  // stones of every kind; far, mesas and buttes on the horizon.
  const ST = [STONE.redrock, STONE.cream, STONE.sandstone, STONE.grey, STONE.redrock, STONE.basalt];
  const mids = q.detail === 0 ? MID.filter((_, i) => i % 2 === 0) : MID;
  const fars = q.detail === 0 ? FAR.filter((_, i) => i % 3 !== 2) : FAR;
  // (The far ones may reach past the sky's foot, out over the ground's last stretch, into the fog.)
  [...mids.map((k) => [k, 62, 112, SKY_R - 4]), ...fars.map((k) => [k, 112, 150, R_OUT - 4])].forEach(([kind, rMin, rMax, edge], i) => {
    const f = OTHER[kind](R);
    const rho = Math.hypot(f.size[0], f.size[2]) / 2 + 1;
    const spot = place(rho, 0, Math.PI * 2, rMin, rMax, edge);
    if (!spot) return;
    placed.push({ x: spot.x, z: spot.z, rho });
    // (Basalt where Dark's side is, the warm stones elsewhere.)
    const st = spot.z < -20 && R() < 0.5 ? STONE.basalt : ST[Math.floor(R() * ST.length)];
    const rotY = f.face ? Math.atan2(-Math.cos(spot.a), -Math.sin(spot.a)) + (R() - 0.5) * 0.6 : R() * Math.PI * 2;
    const joints = f.joints ? f.joints : null;
    jobs.push({
      label: `${kind}:${i}`, kind, sdf: f.sdf, size: f.size, C: Math.min(f.size[0], f.size[2], 8), seed: 5000 + i * 53, st, x: spot.x, z: spot.z, rho, rotY,
      lean: (R() - 0.5) * 0.04, sink: kind === "dome" ? 0 : 0.3 + R() * 0.5,
      weather: { wear: f.wear, freq: 0.22, layer: f.layer, strata: f.strata, tilt: f.tilt || 0, notch: kind === "spire" || kind === "balanced" ? 0 : 0.45, notchAt: 0.8 },
      jointList: joints, joints: joints ? 0 : kind === "mesa" || kind === "butte" ? 2 + Math.floor(R() * 2) : 0,
    });
  });
  return jobs;
}

/* One formation built: its rock, placed in the land, and its long shadow. */
function buildJob(job, q, hx, hz) {
  const { size } = job;
  const R = rng(job.seed);
  // Joints: vertical cracks through it, at planes across its footprint.
  const joints = job.jointList || Array.from({ length: job.joints }, () => {
    const a = R() * Math.PI;
    return { x: (R() - 0.5) * size[0] * 0.6, z: (R() - 0.5) * size[2] * 0.6, nx: Math.cos(a), nz: Math.sin(a), w: 0.09 + R() * 0.08, from: size[1] * (0.15 + R() * 0.4) };
  });
  // Fractures: planes that break off a corner or an edge (each bites a
  // little way into the side it faces), so its faces are flat and its
  // edges sharp, as broken rock's are.
  const cuts = [];
  for (let k = 0, n = job.kind === "piece" ? 5 + Math.floor(R() * 6) : 4 + Math.floor(R() * 6); k < n; k++) {
    let nx = R() - 0.5, ny = (R() - 0.3) * 0.9, nz = R() - 0.5;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const sup = Math.abs(nx) * size[0] / 2 + Math.abs(ny) * size[1] / 2 + Math.abs(nz) * size[2] / 2;
    cuts.push([nx, ny, nz, ny * (size[1] / 2) + sup * (0.8 - R() * 0.14)]);
  }
  const f = weathered(job.sdf, { seed: job.seed, ...job.weather, joints, cuts });
  const m = job.weather.wear + job.weather.strata + 1.2;
  // (A finer grid near and for the pieces, coarser far; coarser still on a weak device.)
  const cell = Math.max(job.kind === "piece" ? job.C / 7.5 : Math.max(size[0], size[1], size[2]) / 34, 0.45) * (q.detail === 0 ? 1.6 : 1);
  // Where it stands: its footprint's lowest ground, less how far it's sunk.
  let ground = Infinity;
  for (const [u, v] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ground = Math.min(ground, groundAt(job.x + (u * size[0]) / 2.5, job.z + (v * size[2]) / 2.5, hx, hz));
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(job.x, ground - job.sink, job.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, job.rotY, job.lean, "YXZ")),
    new THREE.Vector3(1, 1, 1),
  );
  const geo = rockGeometry(f, [-size[0] / 2 - m, -1.6, -size[2] / 2 - m], [size[0] / 2 + m, size[1] + m, size[2] / 2 + m], cell, { st: job.st, seed: job.seed, matrix, clipBelow: 0 });
  return { geo, shadow: shadowRibbon(job, ground, hx, hz) };
}

/* A long shadow on the ground, away from the dusk (+z), following the
   ground's rise and fall and stopped short of the platform. */
function shadowRibbon(job, ground, hx, hz) {
  const H = job.size[1];
  if (H < 6) return null;
  const w = Math.min(job.size[0], job.size[2]) * 0.9, L = Math.min(H * 1.7, 64), N = 14;
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const z = job.z + (L * k) / N, x = job.x;
    if (k > 1 && outFromBoard(x, z, hx, hz) < ledgeLine(x, z).P + 3) break;
    pts.push([x, z, k / N]);
  }
  if (pts.length < 3) return null;
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, z, t], k) => {
    const half = (w / 2) * (1 + 0.45 * t);
    for (const s of [-1, 1]) { const px = x + s * half; pos.push(px, groundAt(px, z, hx, hz) + 0.08, z); uv.push(s < 0 ? 0 : 1, t); }
    if (k) { const b = (k - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------------------------------------------------------------- the land */

// (The chassis's slab, its outline and the grid drawn over it: the board
// is the rock's own floor here, its grid chiseled in.)
const HIDE = new Set(["ec-slab", "ec-slab-edges", "ec-top-ring", "ec-grid"]);

/* The land: { group (hang it on the board group), fog(), tick(t, now),
   dispose() }. group.userData.formations lists what stands in it (each
   { kind, type, side }), group.userData.ready once it all does. */
export function createMonolithLand() {
  const q = quality();
  const group = new THREE.Group();
  group.name = "lab-monolith-land";
  group.userData.formations = [];
  group.userData.ready = false;
  group.userData.stats = { buildMs: 0, vertices: 0, batches: 0 }; // (the work the formations took, for tests and tuning)

  /* The sky and the moon: never fogged, never tone mapped (as painted). */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.name = "monolith-sky"; sky.renderOrder = -10;
  group.add(sky);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false, transparent: true, toneMapped: false }));
  moon.position.copy(MOON).multiplyScalar(SKY_R - 12);
  moon.scale.setScalar(26); moon.name = "monolith-moon"; moon.renderOrder = -9;
  group.add(moon);

  const groundMat = rockMaterial(plainTexture(), 1 / 12);
  // (The plateau's plates and the board's floor: one rock, shaded flat,
  // facet by facet.)
  const plateMat = rockMaterial(slickTexture(), 1 / 4.5, { flatShading: true });
  const grooveMat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // (Shaded flat, face by face: broken stone's facets and edges, where
  // smooth shading made every block look worn soft as clay.)
  const rockMat = rockMaterial(stoneTexture(), 1 / 7.5, { flatShading: true });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rubbleMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.97, metalness: 0 });
  // (Three shapes of broken stone, coarse: there are hundreds of them.)
  const RUBBLE = [0, 1, 2].map((k) => hewnBox(1, 1, 1, { seed: 9100 + k, seg: 0.34, rough: 0.08, chip: 0.2, chipW: 0.32, freq: 2.2, uvUnit: 1 }));

  /* The ground and the rubble on it, for the board's size now: the
     plain below, the plateau's plates and the board's floor
     (monolith-ground.js), the grid chiseled into it. */
  let ground = null, plates = null, grid = null, rubble = [], dims = "", hx = 0, hz = 0, plateAt = () => null;
  function buildGround() {
    hx = SLAB_X / 2; hz = SLAB_Z / 2; dims = `${SLAB_X}x${SLAB_Z}`;
    if (ground) { group.remove(ground); ground.geometry.dispose(); }
    if (plates) { group.remove(plates); plates.geometry.dispose(); }
    if (grid) { group.remove(grid); grid.geometry.dispose(); if (grooveMat.map) grooveMat.map.dispose(); }
    rubble.forEach((im) => { group.remove(im); im.dispose(); }); rubble = [];
    ground = new THREE.Mesh(terrainGeometry(hx, hz, q.detail), groundMat);
    ground.name = "monolith-ground"; ground.receiveShadow = true;
    group.add(ground);
    const [rx, rz] = floorRect(hx, hz);
    const field = plateField({
      rx, rz, detail: q.detail,
      edgeAt: (x, z) => ledgeLine(x, z).P,
      groundAt: (x, z) => groundAt(x, z, hx, hz),
      colourAt: (x, y, z, d) => plateColour(x, y, z, d),
    });
    plateAt = field.plateAt;
    plates = new THREE.Mesh(field.geo, plateMat);
    plates.name = "monolith-plates"; plates.receiveShadow = true; plates.castShadow = true;
    plates.userData.floorCells = field.floorCells; plates.userData.count = field.count;
    group.add(plates);
    const sheet = grooveSheet({ cols: BOARD_COLS, rows: BOARD_ROWS, sq: SQUARE_SIZE, detail: q.detail });
    grooveMat.map = sheet.tex; grooveMat.needsUpdate = true;
    grid = new THREE.Mesh(new THREE.PlaneGeometry(sheet.W, sheet.D), grooveMat);
    grid.rotation.x = -Math.PI / 2; grid.position.y = 0.003;
    grid.name = "monolith-grid"; grid.receiveShadow = true; grid.renderOrder = 2;
    group.add(grid);
    // Rubble: a little on the plateau's plates (never on the floor, nor in
    // a crack), scree and fallen blocks over the plain.
    const R = rng(7713), dummy = new THREE.Object3D(), lists = [[], [], []], colours = [[], [], []];
    const n = q.detail === 0 ? 170 : 420;
    for (let i = 0; i < n; i++) {
      const onPlateau = i < n * 0.3;
      const a = R() * Math.PI * 2, r = onPlateau ? Math.hypot(rx, rz) * 0.8 + R() * 16 : 30 + Math.pow(R(), 0.8) * 110;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, d = outFromBoard(x, z, hx, hz), P = ledgeLine(x, z).P;
      let y;
      if (onPlateau) {
        if (d < 0.6 || d > P - 1) continue;
        const under = plateAt(x, z);
        if (!under || under.floor) continue;
        y = under.h;
      } else {
        if (d < P + 8) continue;
        y = groundAt(x, z, hx, hz);
      }
      const s = onPlateau ? 0.08 + Math.pow(R(), 2) * 0.24 : 0.25 + Math.pow(R(), 2.4) * 2.2;
      dummy.position.set(x, y + s * 0.2, z);
      dummy.rotation.set(R() * 0.6, R() * Math.PI, R() * 0.6);
      dummy.scale.set(s * (0.7 + R() * 0.8), s * (0.4 + R() * 0.6), s * (0.7 + R() * 0.8));
      dummy.updateMatrix();
      const k = i % 3;
      lists[k].push(dummy.matrix.clone());
      const side = ease((z + 6) / 14);
      const c = mix3([0.3, 0.31, 0.34], [0.8, 0.66, 0.5], side);
      colours[k].push(new THREE.Color(c[0], c[1], c[2]));
    }
    lists.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(RUBBLE[k], rubbleMat, list.length);
      list.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, colours[k][i]); });
      im.name = "monolith-rubble"; im.receiveShadow = true;
      group.add(im); rubble.push(im);
    });
  }
  buildGround();

  /* The formations, a frame's work at a time. */
  const jobs = planLand(q);
  let alive = true, timer = null, at = 0;
  const batches = [];
  function buildSome() {
    timer = null;
    if (!alive) return;
    const t0 = performance.now(), geos = [], shadows = [];
    while (at < jobs.length && (performance.now() - t0 < 28 || !geos.length)) {
      const job = jobs[at++];
      const { geo, shadow } = buildJob(job, q, hx, hz);
      geos.push(geo);
      if (shadow) shadows.push(shadow);
      group.userData.formations.push({ kind: job.kind, type: job.type || null, side: job.side || null, x: job.x, z: job.z, rho: job.rho });
    }
    const rocks = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos, false), rockMat);
    geos.forEach((g) => g.dispose());
    group.userData.stats.vertices += rocks.geometry.attributes.position.count;
    group.userData.stats.batches++;
    rocks.name = "monolith-rocks";
    group.add(rocks); batches.push(rocks);
    if (shadows.length) {
      const sh = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(shadows, false), shadowMat);
      shadows.forEach((g) => g.dispose());
      sh.name = "monolith-shadows"; sh.renderOrder = 1;
      group.add(sh); batches.push(sh);
    }
    group.userData.stats.buildMs += performance.now() - t0;
    if (at < jobs.length) timer = setTimeout(buildSome, 0);
    else group.userData.ready = true;
  }
  timer = setTimeout(buildSome, 0);

  /* The lights, turned with the board (as Luna's sun): set where the
     chassis puts them, at the board's own heading. */
  let base = null;
  const tmp = new THREE.Vector3();
  const hidden = new Set();
  return {
    group,
    fog: () => new THREE.Fog(LAND.fog, 40, 148),
    tick(t) {
      if (`${SLAB_X}x${SLAB_Z}` !== dims) buildGround();
      for (const c of t.boardGroup.children) if (HIDE.has(c.name) && c.visible) { c.visible = false; hidden.add(c); }
      const L = t.lights;
      if (L && L.key) {
        if (!base) base = { key: L.key.position.clone(), fill: L.fill.position.clone(), back: L.back.position.clone() };
        const a = t.boardGroup.rotation.y;
        for (const k of ["key", "fill", "back"]) {
          tmp.copy(base[k]).applyAxisAngle(UP, a);
          if (!L[k].position.equals(tmp)) L[k].position.copy(tmp);
        }
        group.userData.lightsTurn = a;
      }
      group.userData.lightBase = base;
    },
    dispose(t) {
      alive = false;
      if (timer) clearTimeout(timer);
      if (t && t.lights && base) for (const k of ["key", "fill", "back"]) t.lights[k].position.copy(base[k]);
      hidden.forEach((c) => { c.visible = true; });
      RUBBLE.forEach((g) => g.dispose());
      if (grooveMat.map) grooveMat.map.dispose();
      [groundMat, plateMat, grooveMat, rockMat, shadowMat, rubbleMat].forEach((m) => m.dispose());
    },
  };
}
