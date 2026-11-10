/* The Monolith's land: the Lab's second direction, in Bauhaus's place
   (user: "we're getting rid of Bauhaus and replacing it with something
   imposing & neolithic monoliths", with a picture: great dark stones
   standing and leaning on a cracked, barren plain at dusk, a crescent
   moon, a long shadow coming at you; and, of the land they were after:
   "the formations are natural, but somehow create imposing unreal
   topography & terrain ... as if being viewed from ground level"; the
   stones of Muley Point, Utah, the rock split into blocks along its own
   joints).

   The board is set on a shelf of the plain's own rock. Round it:
     - the plain: cracked stone, the cracks running square as the rock's
       joints do, out to a horizon the fog takes;
     - the stones: blocks split from the bedrock, standing, leaning,
       fallen, stacked and broken. Two kinds, as the two sides are:
       basalt beyond Dark's end (the far side from the player's own seat),
       sandstone beyond Light's, the two mixed at the flanks. The great
       ones stand from ROOM_CLEAR out, past the box the camera is kept in
       (specs.js camera.freeCamera.room), and the boulders inside it are
       all lower than the camera may go, so no view is ever inside a
       stone;
     - their long shadows on the plain, cast away from the dusk;
     - rubble at their feet and over the plain;
     - the sky: the last of the dusk low over Dark's end, the night coming
       over, a crescent moon, the first stars, low cloud.
   All painted on canvases here, nothing fetched, and made from fixed
   seeds: the same land every visit. A weak device (tienda-quality.js
   detail 0) gets smaller textures and less rubble, the same stones. */
import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../../engine/constants.js";
import { rng } from "./paint.js";
import { mergeStatic } from "../merge-static.js";
import { quality } from "../tienda-quality.js";
import { hewnBox } from "./hewn.js";

// The dusk lies this way (Dark's end of the board, -z), low on the horizon.
const DUSK = new THREE.Vector3(0, 0, -1);
// The land's own palette (the sides' stones are the spec's pieces).
// The great stones stand from here out (their nearest faces beyond the
// corners of the camera's room, specs.js); the boulders inside it are no
// taller than BOULDER_TOP above the board's top.
export const ROOM_CLEAR = 38;
export const BOULDER_TOP = 0.3;
export const LAND = {
  sky: { zenith: "#0B0E16", high: "#161B29", mid: "#262B3F", glow: "#C98E93", glowWarm: "#E2A98A", band: "#4A4656" },
  fog: 0x3e3c4b,
  plain: 0x57534e,
  basalt: 0x2f3136,
  sandstone: 0xa58c6c,
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
      g.lineWidth = w; g.strokeStyle = `rgba(28,26,24,${a})`; g.stroke();
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

/* --------------------------------------------------------------- shapes */

/* A great stone, hewn (hewn.js; user: "the blocks, themselves need to be
   rough-hewn, not perfect looking"): its faces wandering in by up to a
   tenth of its thickness, its edges and corners broken back, a standing
   one narrower toward its top and its top cut on a slant. The texture
   keeps one size on every face (4 units a repeat). */
function stoneGeometry(w, h, d, R, { standing = false } = {}) {
  const t = Math.min(w, h, d);
  return hewnBox(w, h, d, {
    seed: Math.floor(R() * 1e9), seg: quality().detail === 0 ? 1.3 : 0.75,
    rough: 0.08 + t * 0.06, chip: 0.1 + t * 0.13, chipW: 0.25 + t * 0.2, freq: 0.42,
    taper: standing ? 0.05 + R() * 0.1 : 0, slant: standing ? [(R() - 0.5) * 0.5, (R() - 0.5) * 0.3] : null, uvUnit: 4,
  });
}

/* The land round the board. `below` is the underside of the board's
   slab; the plain lies a little lower (GROUND) and the board's shelf
   rises from it. Returns { group, fog }: the fog a function, made fresh
   for each mount (ambient.js sets it on the scene and puts back the one
   before). */
export function buildMonolithLand({ below }) {
  const group = new THREE.Group();
  group.name = "lab-monolith-land";
  const q = quality();
  const R = rng(20261110);
  const GROUND = below - 0.55; // the plain; the board's shelf rises from it
  const HX = SLAB_X / 2, HZ = SLAB_Z / 2;

  /* The sky and the moon: never fogged, never tone mapped (as painted). */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.name = "monolith-sky"; sky.renderOrder = -10; sky.userData.noMerge = true;
  group.add(sky);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false, transparent: true, toneMapped: false }));
  // Low over Dark's end, a little to the right of a player's line (the
  // read-out takes the left), where a low view sees it.
  moon.position.copy(new THREE.Vector3(0.32, 0.12, -0.94).normalize().multiplyScalar(138));
  moon.scale.setScalar(26); moon.name = "monolith-moon"; moon.renderOrder = -9;
  group.add(moon);

  /* The plain. */
  const plainTex = plainTexture().clone(); plainTex.needsUpdate = true; plainTex.repeat.set(26, 26); plainTex.__shared = false;
  const plain = new THREE.Mesh(new THREE.CircleGeometry(152, 72), new THREE.MeshStandardMaterial({ color: LAND.plain, map: plainTex, roughness: 1, metalness: 0 }));
  plain.rotation.x = -Math.PI / 2; plain.position.y = GROUND; plain.receiveShadow = true; plain.name = "monolith-plain"; plain.userData.noMerge = true;
  group.add(plain);

  const stoneTex = stoneTexture();
  const mats = {
    basalt: new THREE.MeshStandardMaterial({ color: LAND.basalt, map: stoneTex, roughness: 0.96, metalness: 0 }),
    sandstone: new THREE.MeshStandardMaterial({ color: LAND.sandstone, map: stoneTex, roughness: 0.98, metalness: 0 }),
  };

  /* The board's shelf: a slab of the plain's rock a little wider than the
     board, its edge broken. */
  {
    const pts = [], n = 44, ax = HX + 0.9, az = HZ + 0.9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      // A rounded square, the corners chipped, each point a little in or out.
      const k = 1 / Math.max(Math.abs(c), Math.abs(s));
      const jitter = 0.18 + R() * 0.55;
      pts.push(new THREE.Vector2(c * k * (ax + jitter) * (Math.abs(c) > 0.98 || Math.abs(s) > 0.98 ? 1 : 0.985), s * k * (az + jitter) * (Math.abs(c) > 0.98 || Math.abs(s) > 0.98 ? 1 : 0.985)));
    }
    const shelf = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.56, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0x55534f, map: stoneTex, roughness: 0.97 }));
    shelf.rotation.x = Math.PI / 2; shelf.position.y = below; shelf.receiveShadow = true; shelf.castShadow = false; shelf.name = "monolith-shelf"; shelf.userData.noMerge = true;
    group.add(shelf);
  }

  /* The stones. Every placement is kept clear of the board and its shelf,
     and only the low ones come in near (a camera within the ring sees the
     board past them). */
  const stones = new THREE.Group(); stones.name = "monolith-stones";
  group.add(stones);
  const shadows = []; // [x, z, width, length, angle]
  const kindAt = (x, z) => (z < -10 ? "basalt" : z > 10 ? "sandstone" : R() < 0.5 ? "basalt" : "sandstone");
  // Set into the ground: the four lowest corners of the block, as it's
  // turned, at least `sink` under the plain, so no corner of a leaning or
  // fallen stone stands off it.
  const corner = new THREE.Vector3(), turn = new THREE.Matrix4();
  const seat = (m, w, h, d, sink) => {
    turn.makeRotationFromEuler(m.rotation);
    const ys = [];
    for (let i = 0; i < 8; i++) ys.push(corner.set((i & 1 ? 0.5 : -0.5) * w, (i & 2 ? 0.5 : -0.5) * h, (i & 4 ? 0.5 : -0.5) * d).applyMatrix4(turn).y);
    ys.sort((a, b) => a - b);
    return GROUND - ys[3] - sink;
  };
  const block = (x, z, w, h, d, { rotY = 0, leanX = 0, leanZ = 0, sink = 0.35, kind, standing = false } = {}) => {
    const m = new THREE.Mesh(stoneGeometry(w, h, d, R, { standing }), mats[kind || kindAt(x, z)]);
    m.rotation.set(leanX, rotY, leanZ);
    m.position.set(x, seat(m, w, h, d, sink), z);
    m.castShadow = true; m.receiveShadow = true;
    stones.add(m);
    return m;
  };
  // A long shadow away from the dusk, kept off the board.
  const shadowOf = (x, z, w, h) => {
    if (h < 3) return;
    const away = new THREE.Vector2(-DUSK.x, -DUSK.z).normalize();
    // How far it may run before it would reach the board's shelf.
    let len = h * 2.3;
    for (let s = 0; s < len; s += 0.5) {
      const px = x + away.x * s, pz = z + away.y * s;
      if (Math.abs(px) < HX + 3 && Math.abs(pz) < HZ + 3) { len = Math.max(0, s - 1.5); break; }
    }
    if (len > 2) shadows.push([x, z, w * 1.1, len]);
  };

  // The great stones: a ring of them, sector by sector, out past the camera.
  const SECTORS = 24;
  for (let i = 0; i < SECTORS; i++) {
    const a = (i / SECTORS) * Math.PI * 2 + R() * 0.18;
    const far = R() < 0.4;
    const rad = far ? ROOM_CLEAR + 20 + R() * 30 : ROOM_CLEAR + R() * 16;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const kind = kindAt(x, z);
    const pick = R();
    const rotY = R() * Math.PI;
    if (pick < 0.36) {
      // A standing slab, tall.
      const w = 3 + R() * 4, d = 2 + R() * 3, h = 12 + R() * 16;
      block(x, z, w, h, d, { rotY, leanX: (R() - 0.5) * 0.08, leanZ: (R() - 0.5) * 0.08, kind, standing: true });
      shadowOf(x, z, w, h);
    } else if (pick < 0.56) {
      // A great block, near a cube.
      const s = 7 + R() * 6;
      block(x, z, s * (0.9 + R() * 0.3), s * (0.8 + R() * 0.4), s * (0.9 + R() * 0.3), { rotY, kind, sink: 0.6 });
      shadowOf(x, z, s, s);
    } else if (pick < 0.72) {
      // A leaning slab, propped on a shorter block under the side it
      // leans to (a turn about its own z takes its top toward its -x, for
      // a lean the right way round; the prop's near face meets the slab's
      // at the prop's top).
      const w = 3 + R() * 3, d = 2 + R() * 2, h = 14 + R() * 10;
      const lean = (0.18 + R() * 0.2) * (R() < 0.5 ? -1 : 1), L = Math.abs(lean), sg = Math.sign(lean);
      const sink = 0.5, hp = h * 0.32, wp = w * 0.9;
      block(x, z, w, h, d, { rotY, leanZ: lean, kind, sink, standing: true });
      const face = -(w / 2) * Math.cos(L) + (h / 2) * Math.sin(L) - (hp + w * Math.sin(L) + sink) * Math.tan(L);
      const off = (face - wp / 2) * sg;
      block(x + Math.cos(rotY) * off, z - Math.sin(rotY) * off, wp, hp, d * 1.2, { rotY: rotY + 0.1, kind });
      shadowOf(x, z, w, h * 0.9);
    } else if (pick < 0.86) {
      // A column of stacked blocks, each a little askew, each sitting on
      // the one below.
      let top = 0;
      const w = 4 + R() * 3, d = 3 + R() * 3;
      for (let k = 0; k < 2 + Math.floor(R() * 2); k++) {
        const h = 5 + R() * 6;
        const m = block(x + (R() - 0.5) * 0.8, z + (R() - 0.5) * 0.8, w * (1 - k * 0.08), h, d * (1 - k * 0.08), { rotY: rotY + (R() - 0.5) * 0.12, leanX: k ? (R() - 0.5) * 0.05 : 0, kind, sink: 0.4 });
        if (k) m.position.y = GROUND + top + h / 2 - 0.08;
        top = m.position.y - GROUND + h / 2;
      }
      shadowOf(x, z, w, top);
    } else {
      // A fallen slab, flat on its face, one end a little raised, half sunk.
      const w = 3 + R() * 3, h = 12 + R() * 10, d = 2.5 + R() * 2;
      block(x, z, w, h, d, { rotY, leanX: Math.PI / 2 - 0.12, kind, sink: d * 0.35 });
    }
  }
  // Boulders nearer in, low and broad, none higher than BOULDER_TOP.
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2, rad = 13 + R() * 18;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) < HX + 3 && Math.abs(z) < HZ + 3) continue;
    const s = 1.2 + R() * 2.2;
    const m = block(x, z, s * (1 + R() * 0.8), 0.5 + R() * 0.6, s * (0.8 + R() * 0.7), { rotY: R() * Math.PI, leanX: (R() - 0.5) * 0.16, leanZ: (R() - 0.5) * 0.16, sink: 0.15 });
    m.updateMatrixWorld(true);
    const top = new THREE.Box3().setFromObject(m).max.y;
    if (top > BOULDER_TOP) m.position.y -= top - BOULDER_TOP;
  }
  mergeStatic(stones);

  /* The long shadows, baked into one mesh. */
  if (shadows.length) {
    const pos = [], uvs = [], idx = [];
    const away = new THREE.Vector2(-DUSK.x, -DUSK.z).normalize(), side = new THREE.Vector2(-away.y, away.x);
    shadows.forEach(([x, z, w, len], i) => {
      const y = GROUND + 0.02 + i * 0.0005;
      const p0x = x - side.x * w / 2, p0z = z - side.y * w / 2, p1x = x + side.x * w / 2, p1z = z + side.y * w / 2;
      // Widening a little as it goes.
      const e0x = p0x + away.x * len - side.x * w * 0.3, e0z = p0z + away.y * len - side.y * w * 0.3;
      const e1x = p1x + away.x * len + side.x * w * 0.3, e1z = p1z + away.y * len + side.y * w * 0.3;
      pos.push(p0x, y, p0z, p1x, y, p1z, e1x, y, e1z, e0x, y, e0z);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      const b = i * 4;
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const sh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    sh.name = "monolith-shadows"; sh.renderOrder = 1; sh.userData.noMerge = true;
    group.add(sh);
  }

  /* Rubble: at the stones' feet and over the plain, never on the shelf;
     broken stone, three shapes of it, each knocked about more than the
     great stones are. */
  {
    const n = q.detail === 0 ? 160 : 420;
    const SHAPES = [0, 1, 2].map((k) => hewnBox(1, 1, 1, { seed: 9100 + k, seg: 0.2, rough: 0.08, chip: 0.2, chipW: 0.32, freq: 2.2, uvUnit: 1 }));
    const both = { basalt: [], sandstone: [] };
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rad = 10 + Math.pow(R(), 0.7) * 90;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.abs(x) < HX + 2 && Math.abs(z) < HZ + 2) continue;
      const s = 0.12 + Math.pow(R(), 2.2) * (rad > 30 ? 2.4 : 0.9);
      dummy.position.set(x, GROUND + s * 0.3, z);
      dummy.rotation.set(R() * 0.6, R() * Math.PI, R() * 0.6);
      dummy.scale.set(s * (0.7 + R() * 0.8), s * (0.4 + R() * 0.6), s * (0.7 + R() * 0.8));
      dummy.updateMatrix();
      both[kindAt(x, z)].push(dummy.matrix.clone());
    }
    for (const [kind, list] of Object.entries(both)) {
      SHAPES.forEach((geo, k) => {
        const mine = list.filter((_, i) => i % SHAPES.length === k);
        if (!mine.length) return;
        const im = new THREE.InstancedMesh(geo, mats[kind], mine.length);
        mine.forEach((m, i) => im.setMatrixAt(i, m));
        im.name = `monolith-rubble-${kind}`; im.receiveShadow = true; im.userData.noMerge = true;
        group.add(im);
      });
    }
  }
  return {
    group,
    fog: () => new THREE.Fog(LAND.fog, 34, 148),
  };
}
