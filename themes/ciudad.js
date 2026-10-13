/* Ciudad: the game played in the city of the glass towers and cranes
   mock-ups (user: "implement city as it currently is. Maybe just have a
   toggle switch to switch between the different times of day. It's all
   essentially the same map ... they can basically play in that city and
   change the time of day that they're playing").

   The board is a district of the city: every line of the grid a street
   (asphalt, a dashed line down the middle, crossings at every corner), every
   square a block (its kerb, its paving); a crossing's stripes along each
   goal row's street; the columns lettered and the rows numbered in road
   paint round the edge. On the free blocks the city goes on: parks, lawns,
   plazas, a subway entrance, a court, a building site or two with a tall
   crane on it, a steel frame going up (ciudad-lots.js); a building that
   moves onto one takes its block. Each piece is a building at its exact
   game size (ciudad-models.js): one side white, the other grey-blue, each
   piece a model and a tint of its own; the 1x3 all glass; the Cabeza a
   round stone hall under a glass dome. Round the board the city goes on
   into the haze (ciudad-city.js), its streets alive with cars, buses,
   bikes and people (ciudad-life.js).

   Five times of day, one map (ciudad-time.js): Morning, Afternoon, Golden
   Hour, Overcast and 10 PM, picked with the switch at the top right
   (ciudad-hud.js), kept for next time. At night the windows are lit by
   plan, the lamps and the cars' lamps on, the cranes' beacons and the
   towers' crowns burning (ciudad-fx.js). The sound is the city's at that
   hour (ciudad-audio.js).

   Everything plugs into the shared chassis as Noir and Luna do (see
   ARCHITECTURE.md). */

import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, CABEZA_SCALE,
} from "../engine/constants.js";
import { buildingFor, PLAN_U, col } from "./ciudad-models.js";
import { HUD_CSS } from "./ciudad-hud.js";
import { quality } from "./tienda-quality.js";

/* ------------------------------------------------------------ palette */

// The board by day (the mock-ups' "blocks" board, round 8's colours).
export const ASPHALT = "#30323a", CURB = "#c4c2bc", WALK = "#bcbab4", LINE = "#d8d0c0", ZEBRA = "#ddd6c6", EDGE = "#34363c";
// A street, from kerb to kerb, on every line of the grid (and a paved block a square).
export const STREET = 0.17;

export const COLORS = {
  // A light UI, the city's own white and grey-blue: the panels the white
  // of the light side's walls, the ink the dark side's slate.
  cream: "#F4F4F0",
  creamAlt: "#E6E7E2",
  charcoal: "#24313D",
  slate: "#5E6E7E",
  slateSoft: "rgba(36, 49, 61, 0.30)",
  slateFaint: "rgba(36, 49, 61, 0.10)",
  pageBg: "#AEB6BD",
  pageBgDeep: "#3E4C5A",
  accentDark: "#3E4E5E", // Slate's grey-blue
  accentLight: "#7D8D9A", // Chalk's, a shade the white ink reads on
  accentDanger: "#D8442E", // a crane's beacon
  bodyDark: "#5A6A78",
  bodyLight: "#ECEAE4",
  inkOnAccent: "#FFFFFF",
};

// Overpass: the face of the road signs (Highway Gothic, redrawn), for the
// title and the big buttons; its mono for the small print.
export const titleFontFamily = "'Overpass', 'Arial Narrow', Arial, sans-serif";
export const mastheadScale = 1.0;

export const HEX = {
  cream: 0xf4f4f0,
  charcoal: 0x24313d,
  slate: 0x5e6e7e,
  pieceLight: 0xeceae4,
  pieceDark: 0x5a6a78,
  // Pivot arrows and the like, per side.
  glowCyan: 0x9fc2e0,
  glowAmber: 0xffd28a,
  structureEdge: 0x24313d,
};

export const EDGE_RADIUS = 0.02;
// No outline: the buildings stand on their own.
export const outlineYOffset = 0;

export const modalBackdrop = "rgba(30, 40, 52, 0.45)";
export const modalSurface = "rgba(244, 244, 240, 0.97)";
export const canvasGradientStart = "#C9CFD4";
export const canvasGradientEnd = "#8E979F";

/* The lights the chassis makes, as the morning has them; the time of day
   sets them every change (ciudad-fx.js): the key is the sun (or the moon),
   the hemisphere the sky's light and the ground's; the others kept low so
   the hour's own light rules. */
export const lights = {
  ambient: { color: 0xffffff, intensity: 0.0 },
  hemi: { sky: 0xdce6f0, ground: 0x7a7468, intensity: 0.55 },
  key: { color: 0xfff4e4, intensity: 2.4 },
  fill: { color: 0xdce6f0, intensity: 0.08 },
  back: { color: 0xffffff, intensity: 0.12 },
};
// Down toward the street, to look up at the towers.
export const maxPitch = 1.32;
/* Room to walk the streets round the board (as Noir's): the view may go
   22 from the middle; the camera itself keeps inside the city. */
export const freeCamera = { reach: 22, yMin: -0.5, yMax: 6, room: { x: [-34, 34], y: [-1, 120], z: [-34, 34] } };

/* ------------------------------------------------------------ the board */

let bseed = 2651;
const brnd = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;
const brr = (a, b) => a + (b - a) * brnd();

/* The board, drawn as the district's streets: every line of the grid a
   street (STREET wide, a dashed line down its middle), going on out
   across the border; each square a block, its kerb and its paving in
   flags; crossings' stripes round every corner; a crossing's stripes the
   length of each goal row's street; the columns lettered and the rows
   numbered in road paint on the asphalt round the edge (each the right
   way up from its own end). Two canvases: the colour, and the glow (the
   lamps' pools at the corners, lit only at night). */
export function makeBoardTexture() {
  bseed = 2651;
  const RES = quality().tier === "low" ? 1024 : 2048, px = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * px), H = Math.round(SLAB_Z * px);
  const mk = (k) => { const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k); return c; };
  const c = mk(1), g = c.getContext("2d"), ec = mk(0.5), e = ec.getContext("2d");
  e.scale(0.5, 0.5);
  const U = (x) => (x + SLAB_X / 2) * px, V = (z) => (z + SLAB_Z / 2) * px;
  const sw = STREET * px, hs = sw / 2, sq = SQUARE_SIZE * px;
  const gx = Array.from({ length: BOARD_COLS + 1 }, (_, i) => U(i * SQUARE_SIZE - OFF_X)), gy = Array.from({ length: BOARD_ROWS + 1 }, (_, j) => V(j * SQUARE_SIZE - OFF_Z));

  // the asphalt, everywhere first, its grit
  g.fillStyle = ASPHALT; g.fillRect(0, 0, W, H);
  {
    const a = new Path2D(), b = new Path2D(), n = (W * H) / 60;
    for (let i = 0; i < n; i++) (brnd() < 0.5 ? a : b).rect(brnd() * W, brnd() * H, brr(1, 2.6), brr(1, 2.6));
    g.fillStyle = "rgba(255,255,255,0.05)"; g.fill(a); g.fillStyle = "rgba(0,0,0,0.14)"; g.fill(b);
  }
  e.fillStyle = "#000"; e.fillRect(0, 0, W, H);

  // the blocks: the kerb round each, the paving inside in flags, a little wear
  const kerb = 0.025 * px, flag = 0.11 * px, tones = [];
  const block = (j, i) => {
    const x0 = gx[i] + hs, y0 = gy[j] + hs, s = sq - sw, joints = new Path2D(), wear = new Path2D();
    g.fillStyle = CURB; g.fillRect(x0, y0, s, s);
    g.fillStyle = shadeSRGB(WALK, tones[j * BOARD_COLS + i]); g.fillRect(x0 + kerb, y0 + kerb, s - 2 * kerb, s - 2 * kerb);
    for (let t = flag; t < s - kerb * 1.5; t += flag) { joints.moveTo(x0 + t, y0 + kerb); joints.lineTo(x0 + t, y0 + s - kerb); joints.moveTo(x0 + kerb, y0 + t); joints.lineTo(x0 + s - kerb, y0 + t); }
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = Math.max(1, px * 0.006); g.stroke(joints);
    for (let k = 0; k < 90; k++) wear.rect(x0 + brnd() * s, y0 + brnd() * s, brr(1, 2.2), brr(1, 2.2));
    g.fillStyle = "rgba(0,0,0,0.035)"; g.fill(wear);
    return { x: x0, y: y0, s };
  };
  for (let j = 0; j < BOARD_ROWS; j++) for (let i = 0; i < BOARD_COLS; i++) { tones.push(brr(0.97, 1.03)); block(j, i); }

  // the streets' dashed lines, down the middle of every street, from the edge in
  const dashL = 0.13 * px, gap = 0.11 * px, lw = Math.max(1.5, 0.015 * px), dashes = new Path2D();
  const a0 = 0.15 * px;
  for (const x of gx) for (let t = a0; t < H - a0; t += dashL + gap) dashes.rect(x - lw / 2, t, lw, Math.min(dashL, H - a0 - t));
  for (const y of gy) for (let t = a0; t < W - a0; t += dashL + gap) dashes.rect(t, y - lw / 2, Math.min(dashL, W - a0 - t), lw);
  g.fillStyle = LINE; g.fill(dashes);
  // the crossings: stripes across each street round every corner
  {
    const zeb = new Path2D(), n = 6, st = sw / (n * 2 - 1), o = sw * 0.55, L = sw * 0.5;
    for (const cx of gx) for (const cy of gy) for (let k = 0; k < n; k++) {
      const t = -sw / 2 + k * 2 * st;
      zeb.rect(cx + t, cy - o - L, st, L * 0.8); zeb.rect(cx + t, cy + o + L * 0.2, st, L * 0.8);
      zeb.rect(cx - o - L, cy + t, L * 0.8, st); zeb.rect(cx + o + L * 0.2, cy + t, L * 0.8, st);
    }
    g.fillStyle = ZEBRA; g.fill(zeb);
  }
  // the goal rows: a crossing's stripes the length of each one's outer street
  {
    const band = new Path2D(), bh = sw * 0.78, stripe = sq / 7;
    for (const yc of [gy[0], gy[BOARD_ROWS]]) for (let x = gx[0] + stripe * 0.3; x < gx[BOARD_COLS] - stripe * 0.4; x += stripe) band.rect(x, yc - bh / 2, stripe * 0.5, bh);
    g.fillStyle = "rgba(232,228,218,0.9)"; g.fill(band);
  }
  // the columns lettered and the rows numbered in road paint round the edge
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", band2 = gy[0] - hs, fs = Math.round(Math.min(band2 * 0.62, sq * 0.24));
  g.fillStyle = "rgba(236,232,222,0.78)"; g.font = `700 ${fs}px 'Overpass', 'Arial Narrow', Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const paint = (x, y, s, turn) => { g.save(); g.translate(x, y); if (turn) g.rotate(Math.PI); g.fillText(s, 0, fs * 0.06); g.restore(); };
  for (let i = 0; i < BOARD_COLS; i++) { const x = (gx[i] + gx[i + 1]) / 2; paint(x, band2 * 0.5, letters[i], true); paint(x, H - band2 * 0.5, letters[i], false); }
  for (let j = 0; j < BOARD_ROWS; j++) { const y = (gy[j] + gy[j + 1]) / 2; paint(band2 * 0.5, y, String(BOARD_ROWS - j), false); paint(W - band2 * 0.5, y, String(BOARD_ROWS - j), true); }

  // the lamps' pools at the corners (every other one inside), lit at night
  e.globalCompositeOperation = "lighter";
  for (let i = 1; i < BOARD_COLS; i++) for (let j = 1; j < BOARD_ROWS; j++) {
    if (i % 2 || j % 2) continue;
    const cx = gx[i], cy = gy[j], R = 0.75 * px, grd = e.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, "rgba(255,207,138,0.42)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    e.fillStyle = grd; e.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  // and round the edge, under the lamps on the walk round the board
  for (const [x, z] of edgeLamps()) {
    const cx = U(x), cy = V(z), R = 0.9 * px, grd = e.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, "rgba(255,214,150,0.5)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    e.fillStyle = grd; e.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  e.globalCompositeOperation = "source-over";

  const map = new THREE.CanvasTexture(c); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
  const glow = new THREE.CanvasTexture(ec); glow.encoding = THREE.sRGBEncoding;
  map.userData = { glow };
  /* The free blocks' lots are painted on this (ciudad-lots.js): a block
     back to its plain paving, or the rectangle a lot is drawn in (rows
     from the far end of the canvas, as the board's own are). */
  BOARD_PAINT.tex = map; BOARD_PAINT.ctx = g; BOARD_PAINT.rows = BOARD_ROWS; BOARD_PAINT.cols = BOARD_COLS;
  BOARD_PAINT.plain = (r, cI) => block(r, cI);
  BOARD_PAINT.lotRect = (r, cI) => { const x0 = gx[cI] + hs, y0 = gy[r] + hs, s = sq - sw, m = 0.03 * px; return { x: x0 + m, y: y0 + m, s: s - 2 * m }; };
  return map;
}
// The board's canvas, for the lots to be painted on (set by makeBoardTexture).
export const BOARD_PAINT = { tex: null, ctx: null, rows: 0, cols: 0, plain: null, lotRect: null };
// (a colour scaled as it shows: for the paving's slight variety)
function shadeSRGB(hex, k) { const cc = new THREE.Color(hex).multiplyScalar(k); cc.r = Math.min(1, cc.r); cc.g = Math.min(1, cc.g); cc.b = Math.min(1, cc.b); return "#" + cc.getHexString(); }
// The board's lettering follows its size (rows and columns change).
export const boardTextureFollowsSize = true;

/* Where the lamps stand round the board (ciudad-city.js puts their posts
   there): on the border at the corners and along each side. */
export function edgeLamps() {
  const k = (STREET / 2 + MARGIN) / 2 + 0.02, ex = OFF_X + k, ez = OFF_Z + k, out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push([sx * ex, sz * ez]);
  const nx = Math.max(0, Math.round(BOARD_COLS / 3) - 1), nz = Math.max(0, Math.round(BOARD_ROWS / 3) - 1);
  for (let i = 1; i <= nx; i++) { const x = -OFF_X + (2 * OFF_X * i) / (nx + 1); const xs = Math.round((x + OFF_X) / SQUARE_SIZE) * SQUARE_SIZE - OFF_X + SQUARE_SIZE * 0.5; out.push([xs, -ez], [xs, ez]); }
  for (let i = 1; i <= nz; i++) { const z = -OFF_Z + (2 * OFF_Z * i) / (nz + 1); const zs = Math.round((z + OFF_Z) / SQUARE_SIZE) * SQUARE_SIZE - OFF_Z + SQUARE_SIZE * 0.5; out.push([-ex, zs], [ex, zs]); }
  return out;
}

/* The board's top: the streets' colours, darker by night (the paving and
   asphalt as the 10 PM mock-ups drew them), the lamps' pools glowing then;
   the sides the kerbstone it stands on. */
export const BOARD_MATS = { top: null };
export function buildSlabMaterials(boardTex) {
  const extra = (boardTex && boardTex.userData) || {};
  const top = new THREE.MeshStandardMaterial({
    map: boardTex, roughness: 0.92, metalness: 0,
    emissive: new THREE.Color(0xffffff), emissiveMap: extra.glow || null, emissiveIntensity: extra.glow ? 1 : 0,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  top.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = PLAN_U.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.3, uNight);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight * 0.9;");
  };
  top.customProgramCacheKey = () => "ciudad-board";
  BOARD_MATS.top = top;
  const side = () => new THREE.MeshStandardMaterial({ color: col(EDGE), roughness: 0.85 });
  return [side(), side(), top, side(), side(), side()];
}

/* No lines of our own over the streets: the streets are the grid. */
export function makeGrid() {
  return new THREE.Group();
}

/* ------------------------------------------------------------ pieces */

/* The chassis's piece is the hit target, unseen; the building rides on it
   (a child, so it moves and rolls with it). The Cabeza's target is as tall
   as the Cabeza it is (the glass dome, or the one tried, ciudad-cabezas.js). */
const HIDDEN = () => new THREE.MeshBasicMaterial({ visible: false });
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  let g = geo;
  const side = isDark ? "dark" : "light";
  const building = buildingFor(piece, side);
  if (isDisc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2, hh = Math.max(0.24, (building.userData.top || 0) + 0.02), base = (DISC_H * CABEZA_SCALE) / 2;
    g = new THREE.CylinderGeometry(r, r, hh, 40); g.translate(0, hh / 2 - base, 0);
    geo.dispose();
  }
  const mesh = new THREE.Mesh(g, HIDDEN());
  mesh.position.set(center.x, y, center.z);
  mesh.userData = { pieceId: piece.id, kind: "piece", isDark };
  building.position.set(0, -y, 0);
  building.rotation.set(0, 0, 0);
  mesh.add(building);
  mesh.userData.building = building;
  const shell = new THREE.Mesh(new THREE.BufferGeometry(), HIDDEN());
  shell.position.set(center.x, y, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell", isDark };
  return { mesh, shell };
}

/* Each legal move: the block marked out as a parking bay is, a white line
   round it, its corners heavier, a faint wash inside; a crush a box
   junction, the block hatched across in the cranes' yellow. Drawn as its
   own light, so it reads by day and by night. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group(), mats = [], geos = [];
  const color = isCrush ? new THREE.Color("#f2c230") : new THREE.Color(0xf4f6f8);
  const basic = (k, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, ...extra }); m.userData.k = k; mats.push(m); return m; };
  const flat = (geo, mat, y) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 4; m.raycast = () => {}; group.add(m); return m; };
  // the wash
  flat(new THREE.PlaneGeometry(hx * 1.72, hz * 1.72), basic(isCrush ? 0.2 : 0.16), 0.012);
  // the line round it, the corners heavier
  const ix = hx * 0.86, iz = hz * 0.86, w = isCrush ? 0.04 : 0.024, cw2 = w * 1.9, cl = Math.min(ix, iz) * 0.42;
  const strip = (x, z, sx, sz, k = 0.9) => { const s = flat(new THREE.PlaneGeometry(sx, sz), basic(k), 0.016); s.position.x = x; s.position.z = z; };
  strip(0, -iz, ix * 2 + w, w); strip(0, iz, ix * 2 + w, w); strip(-ix, 0, w, iz * 2 + w); strip(ix, 0, w, iz * 2 + w);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strip(sx * (ix - cl / 2), sz * iz, cl, cw2, 1); strip(sx * ix, sz * (iz - cl / 2), cw2, cl, 1); }
  if (isCrush) {
    // the box junction's criss-cross
    const d = Math.hypot(ix, iz) * 2;
    for (const t of [-0.5, 0, 0.5]) for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const s = flat(new THREE.PlaneGeometry(d * (1 - Math.abs(t) * 0.9), 0.03), basic(0.85), 0.017);
      s.rotation.z = a; s.position.x = (a > 0 ? 1 : -1) * t * ix * 0.7; s.position.z = t * iz * 0.7;
    }
  }
  group.position.set(cx, 0, cz);
  let target = 0;
  return {
    root: group,
    setOpacity(v) { target = v; mats.forEach((m) => { m.opacity = v * m.userData.k; }); },
    tick(now) {
      const breathe = 0.86 + 0.14 * Math.sin((now || 0) / 480);
      mats.forEach((m) => { m.opacity = target * m.userData.k * breathe; });
    },
    dispose() { geos.forEach((gg) => gg.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/* ------------------------------------------------------------ the game, for the scene */

// What ciudad-fx.js needs to know of the game: the pieces, the one picked
// up, whether a game is being set out.
export const PLAY = { pieces: null, selectedId: null, awaitingBegin: true, isPlaying: false, turns: 0 };
export function useSetupExtras({ game, pieces, awaitingBegin, isPlaying }) {
  PLAY.selectedId = game ? game.selectedId : null;
  PLAY.awaitingBegin = !!awaitingBegin;
  PLAY.isPlaying = !!isPlaying;
  PLAY.turns = game ? game.turns : 0;
  if (pieces) PLAY.pieces = pieces;
  return { ciudad: true, awaitingBegin, isPlaying };
}

/* ------------------------------------------------------------ words, fonts, UI */

/* The dock, in the city's words (chassis DOCK_WORDS): the move log the
   city's record, the plain rules its zoning code, a won game a ribbon
   cut. */
// The corner menu's look (chassis/corner-menu.js): a street sign.
export const cornerMenu = "ciudad";
export const dockWords = {
  views: ["Street", "Aerial", "Skyline"],
  endGame: "Call it a day",
  newGame: "Break ground",
  moveLog: "City record",
  replay: "Replay a record",
  plainRules: "Zoning code",
  nextGame: "Break new ground",
  endedCaption: "Work stopped.",
  wonCaption: "Ribbon cut.",
};

export function renderGlobalDefs() {
  return null;
}

/* Fonts: Overpass (the road signs' own face) for the title and the big
   buttons, Overpass Mono for the small print. The big button a street's
   name sign: white on the slate's blue, a thin white rule just inside its
   edge, its corners rounded as the signs' are. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;800&family=Overpass+Mono:wght@400;600&display=swap');
  .ec-title { color: #F7F7F4; letter-spacing: 0.14em; font-weight: 800; text-shadow: 0 1px 0 rgba(36,49,61,0.35), 0 0 22px rgba(36,49,61,0.25); }
  [data-dock-role="primary"] { font-family: 'Overpass', 'Arial Narrow', Arial, sans-serif !important; font-weight: 800 !important; font-size: 16px !important; letter-spacing: 0.12em !important; text-transform: uppercase;
    color: #FFFFFF !important; background: #2F4458 !important; border: none !important; border-radius: 7px !important;
    box-shadow: inset 0 0 0 2px #2F4458, inset 0 0 0 3.5px rgba(255,255,255,0.92), 0 6px 16px rgba(20,30,40,0.25) !important; }
  [data-dock-role="caption"] { font-family: 'Overpass Mono', 'DejaVu Sans Mono', monospace !important; font-style: normal !important; letter-spacing: 0.04em; font-size: 12px !important; color: #5E6E7E !important; }
${HUD_CSS}
`;

/* ------------------------------------------------------------ scene life, sound, names */

export { mountAmbientEffects } from "./ciudad-fx.js";
export { renderExtraOverlays } from "./ciudad-hud.js";
// The reality's name, at the top of the info panel's This game tab.
export const realityName = "Ciudad";
export { createAudio, hasAudio } from "./ciudad-audio.js";
// The sound menu's sliders (chassis: theme.soundChannels; ciudad-audio.js setChannelLevel).
export const soundChannels = [
  { key: "city", label: "The city", hint: "Real streets recorded, a different one each hour" },
  { key: "pieces", label: "Pieces", hint: "The buildings moving, landing, crushing" },
];
// The city's recordings credited on the About card (assets/ciudad/src/CREDITS.md).
export const soundCredits = "The city’s sounds are recordings of real streets, from freesound.org (by way of the Scaper library’s and the Blanket app’s sounds), looped and mixed by the hour: the morning, a city park in Tel Aviv by yonts (CC0) and a wood thrush’s morning by kvgarlic (CC0); the traffic, “NYC_street leve02l” by gezortenplotz (freesound.org/s/44796), CC BY 3.0; the afternoon’s busy street and the overcast street at work with its tram, “street scene 3” and “street scene 1” by saphe (freesound.org/s/173955, freesound.org/s/150993), CC BY 4.0; the evening, the high street of Gandia by jormarp (CC0); the wind, felix.blume (CC0); at night, crickets by Lisa Redfern and a restaurant by stephan (soundbible.com, public domain).";
// The in-game menu offers a switch for the cost badges on the move markers.
export const moveCostToggle = true;

import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("ciudad");
export const pointsGlow = pointsGlowFor("ciudad");
