/* Noir: the game as a night in a film noir city (user: "work on film noir
   now", after the mock-ups 30 and 50-52: Venetian Blinds, The
   Searchlights, The Last El).

   Black and white, as the films were, with one colour in the whole city:
   a red HOTEL sign. The board is a block of wet street at night: each
   square a slab of pavement darkened by the rain, puddles that catch the
   light, the kerbs between them pale, a crossing's stripes along each
   goal row, the street lamps' pools on the asphalt round the edge. Each
   piece is a tenement at its exact game size (noir-models.js): the dark
   side soot-black brick trimmed in pale stone, the light side pale
   limestone, windows lit behind venetian blinds (now and then a figure
   at one), fire escapes, cornices, water towers on the roofs; the Cabeza
   a newsstand with a street clock. Round the board the city goes on in
   the rain: blocks of lit windows into the fog, lamps, searchlights
   crossing the clouds, the El on its trestle with a lit train going by,
   steam from a manhole; grain and a vignette over it all, as on a print
   of the film (noir-fx.js). The sound is the street at night in the
   rain (noir-audio.js).

   Everything plugs into the shared chassis the same way Plano and Luna
   do (see ARCHITECTURE.md). */

import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, CABEZA_SCALE,
} from "../engine/constants.js";
import { buildingFor, NEON } from "./noir-models.js";
import { lampSpots } from "./noir-city.js";

/* ------------------------------------------------------------ palette */

export const ASPHALT = "#0d0d0e";
export const PAVE = "#1f1f20";
export const KERB = "#a8a8a8";

export const COLORS = {
  // A dark UI: the panel the black of the night street, its ink the
  // white of a film's title cards; the one red is the HOTEL sign's.
  cream: "#121213",
  creamAlt: "#19191a",
  charcoal: "#ECECEC",
  slate: "#A2A2A2",
  slateSoft: "rgba(236, 236, 236, 0.3)",
  slateFaint: "rgba(236, 236, 236, 0.12)",
  pageBg: "#0B0B0C",
  pageBgDeep: "#050505",
  accentDark: "#B8B8B8", // Shadow's silver-grey
  accentLight: "#FFFFFF", // Silver's white
  accentDanger: NEON,
  bodyDark: "#2B2B2B",
  bodyLight: "#C4C4C4",
  inkOnAccent: "#0B0B0C",
};

export const titleFontFamily = "'Bebas Neue', 'Oswald', 'Arial Narrow', Impact, sans-serif";
export const mastheadScale = 1.1;

export const HEX = {
  cream: 0x121213,
  charcoal: 0xececec,
  slate: 0xa2a2a2,
  pieceLight: 0xc4c4c4,
  pieceDark: 0x2b2b2b,
  // Pivot arrows and the like, per side.
  glowCyan: 0xb8b8b8,
  glowAmber: 0xffffff,
  structureEdge: 0xececec,
};

export const EDGE_RADIUS = 0.02;
// No outline: the buildings stand on their own.
export const outlineYOffset = 0;

export const modalBackdrop = "rgba(0, 0, 0, 0.62)";
export const modalSurface = "rgba(18, 18, 19, 0.97)";
export const canvasGradientStart = "#0B0B0C";
export const canvasGradientEnd = "#000000";

/* The lights the chassis makes: the key is the moon through a break in
   the cloud (high, cold, hard shadows), the fill the city's glow off the
   low cloud, the back a rim to cut the buildings out of the night. The
   lamps and windows are their own light (noir-fx.js, noir-models.js). */
export const lights = {
  ambient: { color: 0xffffff, intensity: 0.03 },
  hemi: { sky: 0x4a4a50, ground: 0x0a0a0a, intensity: 0.28 },
  key: { color: 0xf2f4ff, intensity: 1.65 },
  fill: { color: 0xcfd4dc, intensity: 0.12 },
  back: { color: 0xffffff, intensity: 0.5 },
};
// Down to the street (the chassis keeps 1.25), to look up at the buildings
// as the films did.
export const maxPitch = 1.36;
/* Room to walk the streets round the board (as Luna's wide field, user:
   "The field, the panning field, needs to be increased dramatically"): the
   view may go 26 from the middle; the camera itself keeps inside the city
   (the room box), short of where its blocks give out in the fog. */
export const freeCamera = { reach: 26, yMin: -0.5, yMax: 6, room: { x: [-40, 40], y: [-1, 120], z: [-40, 40] } };

/* ------------------------------------------------------------ board */

let bseed = 1717;
const brnd = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;
const brr = (a, b) => a + (b - a) * brnd();

/* The block, drawn: the street round it (the margin) asphalt with its
   kerb and gutter; each square a slab of pavement, joints in it, darker
   with the wet in places, puddles; the kerbs between the squares pale;
   a crossing's stripes along each goal row's outer edge; the columns
   lettered and rows numbered on the street in road paint; the lamps'
   pools. Three canvases the same size: the colour, how rough (the
   puddles shine) and the glow (the lamps' pools, lit whatever the moon). */
export function makeBoardTexture() {
  bseed = 1717;
  const RES = 2048, px = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * px), H = Math.round(SLAB_Z * px);
  // (the roughness and the glow at half the colour's detail: three full
  // canvases would be a lot for a phone; puddles and pools are soft)
  const mk = (k) => { const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k); return c; };
  const c = mk(1), g = c.getContext("2d"), rc = mk(0.5), r = rc.getContext("2d"), ec = mk(0.5), e = ec.getContext("2d");
  r.scale(0.5, 0.5); e.scale(0.5, 0.5);
  const pad = MARGIN * px, sq = SQUARE_SIZE * px, gw = BOARD_COLS * sq, gh = BOARD_ROWS * sq;
  const U = (x) => (x + SLAB_X / 2) * px, V = (z) => (z + SLAB_Z / 2) * px;
  // the street
  g.fillStyle = ASPHALT; g.fillRect(0, 0, W, H);
  for (let i = 0; i < (W * H) / 90; i++) { g.fillStyle = brnd() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.18)"; g.fillRect(brnd() * W, brnd() * H, 2, 2); }
  r.fillStyle = "rgb(140,140,140)"; r.fillRect(0, 0, W, H);
  e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
  // the squares: pavement slabs
  for (let j = 0; j < BOARD_ROWS; j++) for (let i = 0; i < BOARD_COLS; i++) {
    const x0 = pad + i * sq, y0 = pad + j * sq, k = brr(0.9, 1.08);
    g.fillStyle = shadeHex(PAVE, k); g.fillRect(x0, y0, sq, sq);
    r.fillStyle = "rgb(175,175,175)"; r.fillRect(x0, y0, sq, sq);
    // the wet: darker drifts across the slab
    for (let n = 0; n < 4; n++) {
      const gx = x0 + brnd() * sq, gy = y0 + brnd() * sq, gr = sq * brr(0.15, 0.4), grd = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grd.addColorStop(0, "rgba(0,0,0,0.22)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(x0, y0, sq, sq);
    }
    // slab joints: the square cut in four
    g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = Math.max(1.5, sq * 0.008);
    g.beginPath(); g.moveTo(x0 + sq / 2, y0); g.lineTo(x0 + sq / 2, y0 + sq); g.moveTo(x0, y0 + sq / 2); g.lineTo(x0 + sq, y0 + sq / 2); g.stroke();
    // grit
    for (let n = 0; n < sq * 0.6; n++) { g.fillStyle = brnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.25)"; g.fillRect(x0 + brnd() * sq, y0 + brnd() * sq, 2, 2); }
    // a puddle on one square in three: dark, and mirror-smooth in the roughness
    if (brnd() < 0.36) {
      const n = 1 + (brnd() < 0.35 ? 1 : 0);
      for (let q = 0; q < n; q++) {
        const cx = x0 + sq * brr(0.22, 0.78), cy = y0 + sq * brr(0.22, 0.78), rx = sq * brr(0.07, 0.15), ry = sq * brr(0.04, 0.09), rot = brr(0, Math.PI);
        g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(1, ry / rx);
        const pg = g.createRadialGradient(0, 0, 0, 0, 0, rx); pg.addColorStop(0, "rgba(4,4,5,0.42)"); pg.addColorStop(0.75, "rgba(4,4,5,0.3)"); pg.addColorStop(1, "rgba(4,4,5,0)");
        g.fillStyle = pg; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
        g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
        r.fillStyle = "rgb(30,30,30)"; r.beginPath(); r.ellipse(cx, cy, rx, ry, rot, 0, 7); r.fill();
      }
    }
    // a manhole now and then
    if (brnd() < 0.07) {
      const cx = x0 + sq * brr(0.3, 0.7), cy = y0 + sq * brr(0.3, 0.7), mr = sq * 0.11;
      g.fillStyle = "#161616"; g.beginPath(); g.arc(cx, cy, mr, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 2; g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.08)"; for (let t = -mr * 0.7; t <= mr * 0.7; t += mr * 0.35) { g.beginPath(); g.moveTo(cx - mr * 0.75, cy + t); g.lineTo(cx + mr * 0.75, cy + t); g.stroke(); }
    }
  }
  // the crossings: road-paint stripes along each goal row's outer edge
  g.fillStyle = "rgba(225,225,225,0.55)"; r.fillStyle = "rgb(120,120,120)";
  const bandH = sq * 0.16, stripe = sq / 6;
  for (const y0 of [pad + sq * 0.03, pad + gh - sq * 0.03 - bandH]) {
    for (let x = pad + stripe * 0.25; x < pad + gw - stripe * 0.5; x += stripe) { g.fillRect(x, y0, stripe * 0.55, bandH); r.fillRect(x, y0, stripe * 0.55, bandH); }
  }
  // the kerbs between the squares: pale, a little worn
  g.strokeStyle = KERB; g.lineWidth = Math.max(2.5, sq * 0.022); g.globalAlpha = 0.55;
  g.beginPath();
  for (let i = 0; i <= BOARD_COLS; i++) { const x = pad + i * sq; g.moveTo(x, pad); g.lineTo(x, pad + gh); }
  for (let j = 0; j <= BOARD_ROWS; j++) { const y = pad + j * sq; g.moveTo(pad, y); g.lineTo(pad + gw, y); }
  g.stroke(); g.globalAlpha = 1;
  // the outer kerb, heavier, and the gutter's shadow outside it
  g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = Math.max(6, sq * 0.05); g.strokeRect(pad - sq * 0.045, pad - sq * 0.045, gw + sq * 0.09, gh + sq * 0.09);
  g.strokeStyle = "#c4c4c4"; g.lineWidth = Math.max(4, sq * 0.04); g.strokeRect(pad, pad, gw, gh);
  // the columns lettered and the rows numbered on the street, in road paint
  // (each reads the right way up from its own end of the board)
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", fs = Math.round(Math.min(pad * 0.62, sq * 0.3));
  g.fillStyle = "rgba(230,230,230,0.7)"; g.font = `${fs}px 'Bebas Neue', 'Oswald', Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const paint = (x, y, s, turn) => { g.save(); g.translate(x, y); if (turn) g.rotate(Math.PI); g.fillText(s, 0, fs * 0.06); g.restore(); };
  for (let i = 0; i < BOARD_COLS; i++) { const x = pad + (i + 0.5) * sq; paint(x, pad * 0.5, letters[i], true); paint(x, H - pad * 0.5, letters[i], false); }
  for (let j = 0; j < BOARD_ROWS; j++) { const y = pad + (j + 0.5) * sq; paint(pad * 0.5, y, String(BOARD_ROWS - j), false); paint(W - pad * 0.5, y, String(BOARD_ROWS - j), true); }
  // the lamps' pools: on the glow (lit whatever the moon), a touch on the colour
  for (const [lx, lz] of lampSpots()) {
    const cx = U(lx), cy = V(lz), R = sq * 1.7;
    const grd = e.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, "rgba(120,118,112,1)"); grd.addColorStop(0.35, "rgba(52,51,48,1)"); grd.addColorStop(1, "rgba(0,0,0,1)");
    e.globalCompositeOperation = "lighter"; e.fillStyle = grd; e.fillRect(cx - R, cy - R, R * 2, R * 2); e.globalCompositeOperation = "source-over";
  }
  const map = new THREE.CanvasTexture(c); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc); rough.anisotropy = 8;
  const glow = new THREE.CanvasTexture(ec); glow.encoding = THREE.sRGBEncoding;
  map.userData = { rough, glow };
  return map;
}
function shadeHex(hex, k) { const cc = new THREE.Color(hex).multiplyScalar(k); return "#" + cc.getHexString(); }
// The board's lettering follows its size (rows and columns change).
export const boardTextureFollowsSize = true;

export function buildSlabMaterials(boardTex) {
  const extra = (boardTex && boardTex.userData) || {};
  const top = new THREE.MeshStandardMaterial({
    map: boardTex, roughnessMap: extra.rough || null, roughness: 1, metalness: 0.05,
    emissive: new THREE.Color(0xffffff), emissiveMap: extra.glow || null, emissiveIntensity: extra.glow ? 0.85 : 0,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  // the sides: the kerbstone the block stands on
  const side = () => new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 });
  return [side(), side(), top, side(), side(), side()];
}

/* The squares' lines again, fine, over the painted kerbs: they hold up at
   a distance where the texture blurs. */
export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];
  for (let i = 0; i <= BOARD_COLS; i++) { const x = i * SQUARE_SIZE - OFF_X; lines.push(x, 0, -OFF_Z, x, 0, OFF_Z); }
  for (let i = 0; i <= BOARD_ROWS; i++) { const z = i * SQUARE_SIZE - OFF_Z; lines.push(-OFF_X, 0, z, OFF_X, 0, z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0.18 }));
  gridLines.name = "ec-grid-lines";
  gridLines.position.y = 0.05; // clears the top face's polygon offset (see themes/standard.js)
  group.add(gridLines);
  return group;
}

/* ------------------------------------------------------------ pieces */

/* The chassis's piece is the hit target, unseen; the building rides on it
   (a child, so it moves and rolls with it). The Cabeza's target is as tall
   as its newsstand's dome, so a tap on the dome finds it. */
const HIDDEN = () => new THREE.MeshBasicMaterial({ visible: false });
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  let g = geo;
  const side = isDark ? "dark" : "light";
  if (isDisc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2, hh = 0.42, base = (DISC_H * CABEZA_SCALE) / 2;
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
  const shell = new THREE.Mesh(new THREE.BufferGeometry(), HIDDEN());
  shell.position.set(center.x, y, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell", isDark };
  return { mesh, shell };
}

/* Each legal move: a pool of light on the square, as from a lamp just
   out of shot, and its edge in thin white; a crush in the HOTEL sign's
   red, the square struck through. */
let POOL_T = null;
function poolTexture() {
  if (POOL_T) return POOL_T;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.5, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
  POOL_T = new THREE.CanvasTexture(c);
  return POOL_T;
}
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group(), mats = [], geos = [];
  const color = isCrush ? new THREE.Color(NEON) : new THREE.Color(0xf4f4f4);
  const basic = (k, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, ...extra }); m.userData.k = k; mats.push(m); return m; };
  const flat = (geo, mat, y) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 4; m.raycast = () => {}; group.add(m); return m; };
  // the pool
  flat(new THREE.PlaneGeometry(hx * 2.3, hz * 2.3), basic(isCrush ? 0.5 : 0.42, { map: poolTexture(), blending: THREE.AdditiveBlending }), 0.012);
  // the edge: four thin strips, the corners heavier
  const ix = hx * 0.86, iz = hz * 0.86, w = isCrush ? 0.045 : 0.026;
  const strip = (x, z, sx, sz) => { const s = flat(new THREE.PlaneGeometry(sx, sz), basic(0.85), 0.016); s.position.x = x; s.position.z = z; };
  strip(0, -iz, ix * 2 + w, w); strip(0, iz, ix * 2 + w, w); strip(-ix, 0, w, iz * 2 + w); strip(ix, 0, w, iz * 2 + w);
  if (isCrush) {
    for (const a of [Math.PI / 4, -Math.PI / 4]) { const s = flat(new THREE.PlaneGeometry(Math.hypot(ix, iz) * 1.3, 0.05), basic(0.9), 0.017); s.rotation.z = a; }
  }
  group.position.set(cx, 0, cz);
  let target = 0;
  return {
    root: group,
    setOpacity(v) { target = v; mats.forEach((m) => { m.opacity = v * m.userData.k; }); },
    tick(now) {
      // a lamp's light breathes a little in the rain
      const breathe = 0.88 + 0.12 * Math.sin((now || 0) / 520);
      mats.forEach((m) => { m.opacity = target * m.userData.k * breathe; });
    },
    dispose() { geos.forEach((gg) => gg.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/* ------------------------------------------------------------ the game, for the scene */

// What noir-fx.js needs to know of the game: the piece picked up.
export const PLAY = { pieces: null, selectedId: null };
export function useSetupExtras({ game, pieces }) {
  PLAY.selectedId = game ? game.selectedId : null;
  if (pieces) PLAY.pieces = pieces;
  return {};
}

/* ------------------------------------------------------------ words, fonts, UI */

/* The dock, in a film set's words (chassis DOCK_WORDS): the move log is
   the script, the plain rules the Production Code (the rulebook every
   film of the time was shot under), a finished game the end title. */
export const dockWords = {
  views: ["Wide shot", "Bird's-eye", "Set"],
  endGame: "Cut",
  newGame: "Another take",
  moveLog: "The script",
  replay: "Run a reel",
  plainRules: "Production code",
  nextGame: "Next scene",
  endedCaption: "Fade out.",
  wonCaption: "The End.",
};

export function renderGlobalDefs() {
  return null;
}

/* Fonts: Bebas Neue (the tall condensed capitals of a film's title cards
   and its posters) for the title and the big buttons, Courier Prime (the
   screenplay's typewriter face) for the small print. The big button a
   title card: white on black, a thin white rule round it. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Courier+Prime:wght@400;700&display=swap');
  .ec-title { color: #F2F2F2; letter-spacing: 0.16em; text-shadow: 0 0 18px rgba(255,255,255,0.18); }
  [data-dock-role="primary"] { font-family: 'Bebas Neue', 'Oswald', Impact, sans-serif !important; font-weight: 400 !important; font-size: 19px !important; letter-spacing: 0.2em !important;
    color: #F2F2F2 !important; background: #0B0B0C !important; border: 1px solid #F2F2F2 !important; border-radius: 0 !important;
    box-shadow: 0 0 0 3px #0B0B0C, 0 0 0 4px rgba(242,242,242,0.45) !important; }
  [data-dock-role="caption"] { font-family: 'Courier Prime', 'Courier New', monospace !important; font-style: normal !important; letter-spacing: 0.06em; font-size: 12px !important; color: #A2A2A2 !important; }
`;

/* ------------------------------------------------------------ scene life, sound, names */

export { mountAmbientEffects } from "./noir-fx.js";
// The reality's name, at the top of the info panel's This game tab.
export const realityName = "Noir";
export { createAudio, hasAudio } from "./noir-audio.js";
// The in-game menu offers a switch for the cost badges on the move markers.
export const moveCostToggle = true;

import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("noir");
export const pointsGlow = pointsGlowFor("noir");
