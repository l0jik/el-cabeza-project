/* Luna: the game as a moon base (user, after the rounds of mock-ups:
   "Let's go ahead and deploy this now into Theme Switcher. I think it's
   ready").

   The board is a levelled stretch of the lunar surface, its squares
   marked out on the ground, studs lit at the corners; craters all round,
   hills far off, the Earth low over the horizon, the Milky Way across
   the black sky (luna-ground.js, luna-sky.js). Each piece is a building
   of the base at its exact game size (luna-models.js): the light side
   white with orange, the dark side charcoal with gold, lit windows, now
   and then a face at one; the Cabeza a glass dome over a kitchen garden,
   people at work in it. Each side's buildings are joined by inflatable
   corridors of their own, laid again after every move: they deflate as a
   building moves and inflate along the new routes (luna-corridors.js,
   luna-fx.js). A low sun, long shadows; dust thrown up where a piece
   lands. The sound is the inside of the base: air handlers, the radio
   (luna-audio.js).

   Everything plugs into the shared chassis the same way Plano does (see
   ARCHITECTURE.md). The chassis's own board plate is hidden: the ground
   is the board. */

import * as THREE from "three";
import { DISC_DIAM, DISC_H, CABEZA_SCALE } from "../engine/constants.js";
import { buildingFor } from "./luna-models.js";

/* ------------------------------------------------------------ palette */

export const COLORS = {
  // A dark UI: the panel the black of the sky, its ink lunar white.
  cream: "#11151C",
  creamAlt: "#171C25",
  charcoal: "#E8ECF2",
  slate: "#9AA6B6",
  slateSoft: "rgba(232, 236, 242, 0.3)",
  slateFaint: "rgba(232, 236, 242, 0.12)",
  pageBg: "#05070B",
  pageBgDeep: "#020305",
  accentDark: "#E0B030", // the dark side's gold
  accentLight: "#FF7A1A", // the light side's orange
  accentDanger: "#FF5A3A",
  bodyDark: "#2C3038",
  bodyLight: "#ECEEF0",
  inkOnAccent: "#0B0D12",
};

export const titleFontFamily = "'Jost', 'Futura', 'Century Gothic', 'Trebuchet MS', sans-serif";
export const mastheadScale = 1;

export const HEX = {
  cream: 0x11151c,
  charcoal: 0xe8ecf2,
  slate: 0x9aa6b6,
  pieceLight: 0xeceef0,
  pieceDark: 0x2c3038,
  // Pivot arrows and the like, per side: gold for the dark side, orange for the light.
  glowCyan: 0xe0b030,
  glowAmber: 0xff7a1a,
  structureEdge: 0xe8ecf2,
};

export const EDGE_RADIUS = 0.04;
// No outline: the buildings stand on their own.
export const outlineYOffset = 0;

export const modalBackdrop = "rgba(2, 4, 8, 0.62)";
export const modalSurface = "rgba(14, 18, 26, 0.96)";
export const canvasGradientStart = "#05070B";
export const canvasGradientEnd = "#000000";

/* The lights the chassis makes: the key is the sun (low, warm; luna-fx.js
   moves it down toward the horizon), the fill the Earth's light (cool,
   faint), the hemisphere what the ground throws back. No air, so no
   ambient. */
export const lights = {
  ambient: { color: 0xffffff, intensity: 0 },
  hemi: { sky: 0x2a3240, ground: 0x0a0a0a, intensity: 0.36 },
  key: { color: 0xfff4e6, intensity: 2.3 },
  fill: { color: 0x9ab8ff, intensity: 0.25 },
  back: { color: 0xffffff, intensity: 0 },
};
// Down to near the ground, so the sky and the Earth come up over the hills (the chassis keeps 1.25).
export const maxPitch = 1.4;

/* ------------------------------------------------------------ board */

/* The chassis's plate is hidden (luna-fx.js); the ground is the board. The
   plate's texture and materials are still asked for: a blank, unseen. */
export function makeBoardTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 4;
  return new THREE.CanvasTexture(c);
}
export const boardTextureFollowsSize = false;
export function buildSlabMaterials() {
  const m = () => new THREE.MeshBasicMaterial({ visible: false });
  return [m(), m(), m(), m(), m(), m()];
}
export function makeGrid() {
  return new THREE.Group();
}

/* ------------------------------------------------------------ pieces */

/* The chassis's piece is the hit target, unseen; the building rides on it
   (a child, so it moves and rolls with it). The Cabeza's target is as
   tall as its dome, so a tap on the dome finds it. */
const HIDDEN = () => new THREE.MeshBasicMaterial({ visible: false });
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  let g = geo;
  const side = isDark ? "dark" : "light";
  if (isDisc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2, hh = 0.45, base = (DISC_H * CABEZA_SCALE) / 2;
    g = new THREE.CylinderGeometry(r, r, hh, 40); g.translate(0, hh / 2 - base, 0);
    geo.dispose();
  }
  const mesh = new THREE.Mesh(g, HIDDEN());
  mesh.position.set(center.x, y, center.z);
  mesh.userData = { pieceId: piece.id, kind: "piece", isDark };
  const building = buildingFor(piece, side);
  building.position.set(0, -y, 0);
  building.rotation.set(0, 0, 0);
  mesh.add(building);
  mesh.userData.building = building;
  if (piece.id) PLAY.carriers.set(piece.id, mesh);
  const shell = new THREE.Mesh(new THREE.BufferGeometry(), HIDDEN());
  shell.position.set(center.x, y, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell", isDark };
  return { mesh, shell };
}

/* Each legal move: a landing pad marked on the ground, its edge a fine
   line of light with brighter corners, a faint wash inside; a crush in
   warning orange, the pad struck through. Laid over the ground's contour
   (the heights from luna-ground.js, through PLAY.ground). */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group(), mats = [], geos = [];
  const ground = PLAY.ground ? PLAY.ground.at : () => 0, y0 = ground(cx, cz);
  const lift = (x, z) => ground(cx + x, cz + z) - y0 + 0.014;
  const color = isCrush ? 0xff6a3a : 0x9ad8ff;
  const strip = (ax, az, bx, bz, w) => {
    // a strip from a to b, w wide, cut into short pieces so it follows the ground
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2), n = Math.max(1, Math.ceil(l / 0.06)), pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + dx * t, z = az + dz * t;
      pos.push(x + nx, lift(x + nx, z + nz), z + nz, x - nx, lift(x - nx, z - nz), z - nz);
      if (i) { const v = (i - 1) * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    }
    return { pos, idx };
  };
  const add = (parts, opacityK) => {
    const pos = [], idx = [];
    parts.forEach((p) => { const base = pos.length / 3; pos.push(...p.pos); idx.push(...p.idx.map((i) => i + base)); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, side: THREE.DoubleSide, toneMapped: false });
    mat.userData.k = opacityK; mats.push(mat); geos.push(geo);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 4; group.add(m);
  };
  const ix = hx * 0.86, iz = hz * 0.86, w = isCrush ? 0.05 : 0.03, cl = Math.min(ix, iz) * 0.42, cw = w * 1.9;
  add([strip(-ix, -iz, ix, -iz, w), strip(ix, -iz, ix, iz, w), strip(ix, iz, -ix, iz, w), strip(-ix, iz, -ix, -iz, w)], 0.7);
  // the corners brighter and heavier: the pad's set-out marks
  const corners = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(strip(sx * ix, sz * iz, sx * (ix - cl), sz * iz, cw), strip(sx * ix, sz * iz, sx * ix, sz * (iz - cl), cw));
  if (isCrush) corners.push(strip(-ix * 0.55, -iz * 0.55, ix * 0.55, iz * 0.55, 0.045), strip(ix * 0.55, -iz * 0.55, -ix * 0.55, iz * 0.55, 0.045));
  add(corners, 1);
  // a faint wash inside, so the square reads at a glance
  const wash = { pos: [], idx: [] }, nW = 8;
  for (let j = 0; j <= nW; j++) for (let i = 0; i <= nW; i++) { const x = -ix + (2 * ix * i) / nW, z = -iz + (2 * iz * j) / nW; wash.pos.push(x, lift(x, z) - 0.002, z); }
  for (let j = 0; j < nW; j++) for (let i = 0; i < nW; i++) { const a = j * (nW + 1) + i, b = a + 1, c = a + nW + 1, d = c + 1; wash.idx.push(a, c, b, b, c, d); }
  add([wash], isCrush ? 0.2 : 0.13);
  group.position.set(cx, y0, cz);
  let target = 0;
  return {
    root: group,
    setOpacity(v) { target = v; mats.forEach((m) => { m.opacity = v * m.userData.k; }); },
    tick(now) {
      const breathe = 0.86 + 0.14 * Math.sin((now || 0) / 420);
      mats.forEach((m) => { m.opacity = target * m.userData.k * breathe; });
    },
    dispose() { geos.forEach((gg) => gg.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/* ------------------------------------------------------------ the game, for the scene */

// What luna-fx.js needs to know of the game: the pieces where they stand
// (for the corridors, the ground and the roof gear), the piece picked up,
// each piece's carrier mesh (to tell when one is moving), the ground.
export const PLAY = { pieces: null, selectedId: null, carriers: new Map(), ground: null };
export function useSetupExtras({ game, pieces }) {
  PLAY.selectedId = game ? game.selectedId : null;
  if (pieces) PLAY.pieces = pieces;
  return {};
}

/* ------------------------------------------------------------ words, fonts, UI */

/* The dock, in mission control's words (chassis DOCK_WORDS). The flight
   rules are what NASA calls its book of what to do when. */
export const dockWords = {
  views: ["Ground", "Orbit", "Base"],
  endGame: "End mission",
  newGame: "New mission",
  moveLog: "Mission log",
  plainRules: "Flight rules",
  nextGame: "Next mission",
  endedCaption: "Mission scrubbed.",
  wonCaption: "Base secured.",
};

export function renderGlobalDefs() {
  return null;
}

/* Fonts: Jost (a geometric sans of the space age, in the spirit of the
   mission patches' Futura) for the title and the big buttons, IBM Plex
   Mono for the small print, as telemetry. The big button a lit orange
   switch. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  .ec-title { color: #E8ECF2; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; }
  [data-dock-role="primary"] { font-family: 'Jost', 'Futura', 'Century Gothic', sans-serif !important; font-weight: 600 !important; letter-spacing: 0.18em !important; text-transform: uppercase;
    color: #0B0D12 !important; background: #FF7A1A !important; border: 1px solid #FFB07A !important; border-radius: 6px !important;
    box-shadow: 0 0 0 3px rgba(255,122,26,0.18), 0 0 18px rgba(255,122,26,0.35) !important; }
  [data-dock-role="caption"] { font-family: 'IBM Plex Mono', monospace !important; font-style: normal !important; letter-spacing: 0.16em; text-transform: uppercase; font-size: 11px !important; color: #9AA6B6 !important; }
`;

/* ------------------------------------------------------------ scene life, sound, names */

export { mountAmbientEffects } from "./luna-fx.js";
// The reality's name, at the top of the info panel's This game tab, as in
// the Other realities menu (themes/realities.js WORLDS).
export const realityName = "Luna";
export { createAudio, hasAudio } from "./luna-audio.js";
// The in-game menu offers a switch for the cost badges on the move markers.
export const moveCostToggle = true;

import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("luna");
export const pointsGlow = pointsGlowFor("luna");
