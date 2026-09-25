/* Tienda theme: a discount department store, a weeknight in the fall of
   1975, about half past seven.

   The board is a demonstration set on a table in the store's center
   court, where the two main aisles cross: a folding hardwood board,
   walnut and maple squares under a lacquer finish, brass clasps on the
   frame, and hand-finished wooden blocks (walnut for Dark, olive ash for
   Light). Around it is the store itself (themes/tienda-store.js): vinyl
   tile, a drop ceiling of fluorescent troffers, shelving running off in
   four directions, printed department signs, a wall of television sets,
   checkout lanes up front with one register open. There are almost no
   customers. Ceiling speakers play instrumental arrangements
   (themes/tienda-audio.js).

   The look is meant to be ordinary, not retro: mass-produced materials,
   flat fluorescent light, colours that are slightly dirty and faded. The
   menus are printed matter of the period (a box lid, a catalog order
   form, register tape), not screens.

   Plugs into the shared chassis like Cromo and Lluvia: board, grid,
   pieces and move markers through the usual hooks; the store, its
   lights and the period menus from mountAmbientEffects
   (themes/tienda-fx.js) and renderExtraOverlays
   (themes/tienda-overlay.js). */

import React from "react";
import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE,
} from "../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";
import { quality } from "./tienda-quality.js";

/* ------------------------------------------------------------ period palette */

/* The colours of the place: appliance and upholstery colours of the
   time, the paper and paint of a store, all a little faded. Everything
   else in the theme takes its colours from here. */
export const PERIOD = {
  chocolate: "#3B2618",
  brown: "#5A3E2B",
  walnut: "#5C3A21",
  tobacco: "#7A5230",
  rust: "#9C4A26",
  burntOrange: "#C0632C",
  harvestGold: "#D3A13B",
  mustard: "#C9A227",
  avocado: "#6B7536",
  olive: "#5E6130",
  institutionalGreen: "#A3B79B",
  dustyBlue: "#7D95A6",
  mutedTeal: "#4E7C78",
  vinylRed: "#A33F33",
  beige: "#D8C6A5",
  tan: "#BFA27A",
  grayBeige: "#B8AE9C",
  cream: "#EFE4CB",
  offWhite: "#F0EADB",
  paper: "#EDE3C9",
  ink: "#2E2118",
};

export const COLORS = {
  // The menus are paper: cream stock, brown ink.
  cream: "#ECE1C6",
  creamAlt: "#E2D5B5",
  charcoal: PERIOD.ink,
  slate: "#6E5D4A",
  slateSoft: "rgba(110, 93, 74, 0.30)",
  slateFaint: "rgba(110, 93, 74, 0.10)",
  pageBg: "#2B2219",
  pageBgDeep: "#1A140F",
  // Player colours: a harvest-gold sticker for Dark, a cream one for
  // Light (the cost badges and the points counter use them).
  accentDark: PERIOD.harvestGold,
  accentLight: "#F3E8CF",
  accentDanger: PERIOD.vinylRed,
  bodyDark: "#4A2C1C",
  bodyLight: "#D9B77E",
  inkOnAccent: PERIOD.ink,
};

// The title is set like the game's own advertising: a high-contrast
// serif, all capitals.
export const titleFontFamily = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";
export const mastheadScale = 0.56;
// The camera looks a little lower than the other themes' (0.86), so the
// store shows behind the table.
// On a tall, narrow screen the board sits farther off to fit its width,
// so the camera tips a little further again to keep the store in view.
export const viewPitch = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25 ? 1.12 : 1.04;

export const HEX = {
  cream: 0xece1c6,
  charcoal: 0x2a1a10, // the slab's edge lines and top ring: the board's dark edge
  slate: 0x6e5d4a,
  pieceLight: 0xd9b77e,
  pieceDark: 0x4a2c1c,
  // Pivot arrows and similar accents the chassis colours per side.
  glowCyan: 0xd3a13b,
  glowAmber: 0xf3e8cf,
  structureEdge: 0xd3a13b,
};

export const EDGE_RADIUS = 0.055;
const OUTLINE_T = 0.009;
export const outlineYOffset = OUTLINE_T;

export const modalBackdrop = "rgba(26, 18, 11, 0.55)";
export const modalSurface = "rgba(236, 225, 198, 0.98)";
// Shown only while the store loads.
export const canvasGradientStart = "#CFC4AA";
export const canvasGradientEnd = "#6E6250";

/* Fluorescent light from above: cool and a little green, flat, with a
   warm bounce off the floor. Low contrast on purpose. */
export const lights = {
  ambient: { color: 0xfff4e2, intensity: 0.14 },
  hemi: { sky: 0xeef3e2, ground: 0x7a6650, intensity: 0.46 },
  key: { color: 0xf3f6ea, intensity: 0.78 },
  fill: { color: 0xfff0da, intensity: 0.22 },
  back: { color: 0xe4eee4, intensity: 0.26 },
};

/* ------------------------------------------------------------ reflections */

/* What lacquer and brass reflect: rows of fluorescent troffers overhead,
   the beige walls and coloured shelving around the horizon, the vinyl
   floor below. A painted panorama given to each material as its envMap
   (as Cromo does), so the setup screen's own small renderer sees it
   too. */
let ENV = null;
export function storeEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#d9d8cc"); // the ceiling tile
  grad.addColorStop(0.36, "#c9c2ae");
  grad.addColorStop(0.47, "#b6aa90"); // walls and shelving at the horizon
  grad.addColorStop(0.53, "#8f8068");
  grad.addColorStop(0.62, "#c2b69c"); // the waxed floor, catching the lights
  grad.addColorStop(1, "#9d917a");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Shelving and signs round the horizon: blocks of period colour.
  let s = 5;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cols = [PERIOD.harvestGold, PERIOD.avocado, PERIOD.burntOrange, PERIOD.dustyBlue, PERIOD.brown, PERIOD.cream, PERIOD.vinylRed, PERIOD.mutedTeal];
  for (let x = 0; x < W; x += 6 + rnd() * 18) {
    g.globalAlpha = 0.5 + rnd() * 0.4;
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.fillRect(x, H * (0.44 + rnd() * 0.03), 4 + rnd() * 14, H * (0.03 + rnd() * 0.05));
  }
  g.globalAlpha = 1;
  // Troffers: bright rectangles in rows, foreshortening toward the horizon.
  for (let row = 0; row < 7; row++) {
    const el = 88 - row * 11; // elevation of this row
    const y = ((90 - el) / 180) * H;
    const hh = Math.max(2, 16 - row * 2);
    const n = 6 + row * 3;
    for (let i = 0; i < n; i++) {
      const x = ((i + (row % 2) * 0.5) / n) * W;
      const w = Math.max(6, 60 - row * 7);
      const lg = g.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
      lg.addColorStop(0, "rgba(246,250,238,0.75)"); lg.addColorStop(0.5, "rgba(252,255,246,1)"); lg.addColorStop(1, "rgba(246,250,238,0.75)");
      g.fillStyle = lg;
      g.fillRect(x - w / 2, y - hh / 2, w, hh);
    }
  }
  // Their reflections in the waxed floor, soft streaks.
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(250,250,240,${0.12 + rnd() * 0.12})`;
    g.fillRect(rnd() * W, H * (0.58 + rnd() * 0.08), 30 + rnd() * 50, 3 + rnd() * 5);
  }
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ small helpers */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const shade = ([r, g, b], k) => [r * k, g * k, b * k];

/* Wood drawn in 2D: a base colour, long wavy grain lines, a few darker
   figure streaks, and fine pores. `horizontal` picks the grain direction.
   Used for the board's squares and frame, and the store's tables. */
export function paintWood(g, x, y, w, h, { base, grain, figure, horizontal = true, seed = 1, density = 1 }) {
  const r = rng(seed);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = css(rgb(base)); g.fillRect(x, y, w, h);
  const along = horizontal ? w : h, across = horizontal ? h : w;
  const lines = Math.max(6, Math.round((across / 3.2) * density));
  const bc = rgb(base), gc = rgb(grain), fc = rgb(figure || grain);
  // Broad colour bands first (the figure), then the fine grain lines.
  for (let i = 0; i < Math.max(2, lines / 7); i++) {
    const o = r() * across, bw = across * (0.05 + r() * 0.14);
    g.fillStyle = css(r() < 0.5 ? shade(bc, 0.86) : shade(bc, 1.07), 0.35 + r() * 0.3);
    if (horizontal) g.fillRect(x, y + o, w, bw); else g.fillRect(x + o, y, bw, h);
  }
  for (let i = 0; i < lines; i++) {
    const o = (i + r() * 0.8) * (across / lines);
    const amp = across * (0.004 + r() * 0.012), freq = (1.5 + r() * 3) / along * Math.PI * 2, ph = r() * 6.28;
    const dark = r() < 0.72;
    g.strokeStyle = css(dark ? gc : shade(bc, 1.12), dark ? 0.18 + r() * 0.34 : 0.14 + r() * 0.16);
    g.lineWidth = Math.max(0.6, across / lines * (dark ? 0.25 + r() * 0.35 : 0.15));
    g.beginPath();
    for (let t = 0; t <= along; t += Math.max(3, along / 60)) {
      const d = o + Math.sin(t * freq + ph) * amp + Math.sin(t * freq * 2.7 + ph * 1.7) * amp * 0.35;
      if (horizontal) (t === 0 ? g.moveTo(x + t, y + d) : g.lineTo(x + t, y + d));
      else (t === 0 ? g.moveTo(x + d, y + t) : g.lineTo(x + d, y + t));
    }
    g.stroke();
  }
  // Figure: a few long darker streaks.
  for (let i = 0; i < 2 + r() * 3; i++) {
    const o = r() * across;
    g.strokeStyle = css(fc, 0.12 + r() * 0.18);
    g.lineWidth = across * (0.008 + r() * 0.02);
    g.beginPath();
    for (let t = 0; t <= along; t += Math.max(4, along / 40)) {
      const d = o + Math.sin(t / along * 5 + i) * across * 0.03;
      if (horizontal) (t === 0 ? g.moveTo(x + t, y + d) : g.lineTo(x + t, y + d));
      else (t === 0 ? g.moveTo(x + d, y + t) : g.lineTo(x + d, y + t));
    }
    g.stroke();
  }
  // Pores: short dark ticks along the grain.
  const pores = Math.round((w * h) / 90 * density);
  for (let i = 0; i < pores; i++) {
    g.fillStyle = css(gc, 0.1 + r() * 0.18);
    const px = x + r() * w, py = y + r() * h;
    if (horizontal) g.fillRect(px, py, 2 + r() * 5, 0.8); else g.fillRect(px, py, 0.8, 2 + r() * 5);
  }
  g.restore();
}

/* ------------------------------------------------------------ board */

const WOOD = {
  maple: { base: "#B8935E", grain: "#8A6538", figure: "#A5804E" },
  walnut: { base: "#744429", grain: "#3E2415", figure: "#58331E" },
  frame: { base: "#4E2F1A", grain: "#26160C", figure: "#3A2213" },
};

/* The folding board's top: walnut and maple squares, each square's grain
   turned a quarter from its neighbours' (inlaid veneer), a light and a
   dark stringing line round the field, a walnut frame, and the fold
   across the middle. Colour, plus a roughness map (the lacquer is a
   touch duller in the seam and the stringing) hung on
   userData.roughnessMap for buildSlabMaterials. */
export function makeBoardTexture() {
  const q = quality();
  const RES = q.boardTexture; // 1024 on low-end devices, 2048 elsewhere
  const ppu = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * ppu), H = Math.round(SLAB_Z * ppu);
  const col = document.createElement("canvas"); col.width = W; col.height = H;
  const rough = document.createElement("canvas"); rough.width = W; rough.height = H;
  const g = col.getContext("2d"), r = rough.getContext("2d");
  const pad = MARGIN * ppu, sq = SQUARE_SIZE * ppu;

  // The frame: grain running round it (along the long edges).
  paintWood(g, 0, 0, W, H, { ...WOOD.frame, horizontal: true, seed: 3, density: 0.8 });
  paintWood(g, 0, 0, pad, H, { ...WOOD.frame, horizontal: false, seed: 4, density: 0.8 });
  paintWood(g, W - pad, 0, pad, H, { ...WOOD.frame, horizontal: false, seed: 5, density: 0.8 });

  // The squares.
  for (let rr = 0; rr < BOARD_ROWS; rr++) {
    for (let cc = 0; cc < BOARD_COLS; cc++) {
      const dark = (rr + cc) % 2 === 1;
      const x = pad + cc * sq, y = pad + rr * sq;
      paintWood(g, x, y, sq + 0.6, sq + 0.6, { ...(dark ? WOOD.walnut : WOOD.maple), horizontal: (rr + cc) % 4 < 2, seed: 100 + rr * 31 + cc * 7, density: 0.9 });
    }
  }
  // Fine glue lines between the squares, just darker than the wood.
  g.strokeStyle = "rgba(40,24,14,0.35)"; g.lineWidth = Math.max(1, ppu * 0.008);
  g.beginPath();
  for (let cc = 0; cc <= BOARD_COLS; cc++) { const x = pad + cc * sq; g.moveTo(x, pad); g.lineTo(x, pad + BOARD_ROWS * sq); }
  for (let rr = 0; rr <= BOARD_ROWS; rr++) { const y = pad + rr * sq; g.moveTo(pad, y); g.lineTo(pad + BOARD_COLS * sq, y); }
  g.stroke();

  // Stringing round the field: a dark line, then a pale holly line outside it.
  const ring = (inset, lw, style) => { g.strokeStyle = style; g.lineWidth = lw; g.strokeRect(pad - inset, pad - inset, BOARD_COLS * sq + inset * 2, BOARD_ROWS * sq + inset * 2); };
  ring(ppu * 0.012, ppu * 0.016, "rgba(30,17,9,0.9)");
  ring(ppu * 0.05, ppu * 0.022, "rgba(232,214,176,0.85)");
  ring(ppu * 0.075, ppu * 0.01, "rgba(30,17,9,0.6)");

  // The fold, across the middle of the board between two ranks.
  const foldY = Math.round(H / 2);
  g.fillStyle = "rgba(24,14,8,0.55)"; g.fillRect(0, foldY - ppu * 0.008, W, ppu * 0.016);
  g.fillStyle = "rgba(255,240,210,0.16)"; g.fillRect(0, foldY + ppu * 0.008, W, ppu * 0.006);

  // Wear: a slightly paler, rubbed area in the centre of the field, from use.
  const wear = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.45);
  wear.addColorStop(0, "rgba(255,240,215,0.05)"); wear.addColorStop(1, "rgba(255,240,215,0)");
  g.fillStyle = wear; g.fillRect(0, 0, W, H);

  // Roughness: satin lacquer, duller along the seam, the glue lines and the edges.
  r.fillStyle = "rgb(92,92,92)"; r.fillRect(0, 0, W, H);
  const n = rng(9);
  for (let i = 0; i < 900; i++) { r.fillStyle = `rgba(${n() < 0.5 ? "255,255,255" : "0,0,0"},0.05)`; r.fillRect(n() * W, n() * H, 4 + n() * 30, 2 + n() * 12); }
  r.strokeStyle = "rgb(170,170,170)"; r.lineWidth = Math.max(1.5, ppu * 0.012);
  r.beginPath();
  for (let cc = 0; cc <= BOARD_COLS; cc++) { const x = pad + cc * sq; r.moveTo(x, pad); r.lineTo(x, pad + BOARD_ROWS * sq); }
  for (let rr = 0; rr <= BOARD_ROWS; rr++) { const y = pad + rr * sq; r.moveTo(pad, y); r.lineTo(pad + BOARD_COLS * sq, y); }
  r.stroke();
  r.fillStyle = "rgb(190,190,190)"; r.fillRect(0, foldY - ppu * 0.012, W, ppu * 0.024);

  const tex = new THREE.CanvasTexture(col);
  const rtex = new THREE.CanvasTexture(rough);
  tex.userData = { roughnessMap: rtex };
  return tex;
}

// The board's sides: the frame's walnut edge, grain running along it.
let EDGE_TEX = null;
function edgeTexture() {
  if (EDGE_TEX) return EDGE_TEX;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 64;
  const g = c.getContext("2d");
  paintWood(g, 0, 0, 1024, 64, { ...WOOD.frame, horizontal: true, seed: 21, density: 1.2 });
  // The edge of the veneer at the top, and the seam where the two halves meet
  // at the hinge side, in the middle of the long edge.
  g.fillStyle = "rgba(255,230,190,0.18)"; g.fillRect(0, 0, 1024, 3);
  g.fillStyle = "rgba(20,12,6,0.4)"; g.fillRect(0, 61, 1024, 3);
  EDGE_TEX = new THREE.CanvasTexture(c);
  EDGE_TEX.wrapS = THREE.RepeatWrapping;
  return EDGE_TEX;
}

function lacquer(extra) {
  const q = quality();
  const base = { roughness: 0.42, metalness: 0, envMap: storeEnv(), envMapIntensity: 0.55, ...extra };
  return q.physical ? new THREE.MeshPhysicalMaterial({ clearcoat: 0.55, clearcoatRoughness: 0.28, ...base }) : new THREE.MeshStandardMaterial(base);
}

export function buildSlabMaterials(boardTex) {
  const top = lacquer({
    map: boardTex,
    roughnessMap: boardTex.userData && boardTex.userData.roughnessMap,
    roughness: 1,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  const side = () => lacquer({ map: edgeTexture(), roughness: 0.5 });
  return [side(), side(), top, side(), side(), side()];
}

/* No drawn grid: the squares are the grid. Only a hairline round the
   field, where the dark stringing is, so the edge stays crisp at a
   grazing angle. */
export function makeGrid() {
  const group = new THREE.Group();
  const b = [-OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, OFF_Z, OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, -OFF_Z];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
  const border = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1e1109, transparent: true, opacity: 0.55 }));
  border.position.y = 0.05; // clears the top face's polygon offset (see themes/standard.js)
  group.add(border);
  return group;
}

/* ------------------------------------------------------------ pieces */

/* The blocks are real wood, grain and all: a procedural 3D wood in the
   fragment shader, sampled at the block's own (object-space) position,
   so end grain shows rings and the long faces show stripes, and the
   grain turns with the block as it rolls. The chassis rebuilds a
   piece's mesh after every move (axis-aligned again), so each piece's
   accumulated turn is kept here (grainTurns, updated by tienda-fx.js
   when a roll lands) and the new mesh samples its wood through it: the
   grain carries on from where the roll left it. */

export const WOODS = {
  dark: { light: "#4E2F1B", dark: "#24130A", streak: "#3A2213", ringFreq: 7.5, gloss: 0.5 }, // walnut
  light: { light: "#B08A55", dark: "#6E4E28", streak: "#957343", ringFreq: 5.5, gloss: 0.45 }, // olive ash
};
export const grainTurns = new Map(); // pieceId -> THREE.Matrix3 (object -> original block frame)

const WOOD_PARS = `
  uniform vec3 uWoodLight, uWoodDark, uWoodStreak;
  uniform float uRingFreq;
  uniform vec3 uGrainOffset;
  varying vec3 vWoodPos;
  float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float wNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  // Returns the wood colour at p; grain runs along x, the log's axis
  // sits off to one side so the rings show as arcs.
  vec3 woodAt(vec3 p, out float latewood) {
    vec3 q = p + uGrainOffset;
    // Cathedral figure: the rings wander along the block's length.
    float warp = wNoise(q * vec3(0.45, 2.4, 2.4)) * 0.7 + wNoise(q * vec3(1.1, 7.0, 7.0)) * 0.2;
    float r = length(q.yz - vec2(-2.6, 1.3)) + warp * 0.22 + sin(q.x * 1.3) * 0.04;
    float ring = fract(r * uRingFreq);
    latewood = smoothstep(0.62, 0.84, ring) * (1.0 - smoothstep(0.9, 1.0, ring));
    float fibre = wNoise(vec3(q.x * 2.0, q.y * 60.0, q.z * 60.0)) * 0.6 + wNoise(vec3(q.x * 0.9, q.y * 22.0, q.z * 22.0)) * 0.4;
    float streak = smoothstep(0.6, 0.92, wNoise(vec3(q.x * 0.3, q.y * 4.0, q.z * 4.0)));
    vec3 c = mix(uWoodLight, uWoodDark, latewood * 0.42 + (fibre - 0.5) * 0.34);
    c = mix(c, uWoodStreak, streak * 0.4);
    return c;
  }
`;

function woodMaterial({ isDark, pieceId }) {
  const w = isDark ? WOODS.dark : WOODS.light;
  const q = quality();
  const mat = q.physical
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.46, metalness: 0, clearcoat: w.gloss, clearcoatRoughness: 0.32, envMap: storeEnv(), envMapIntensity: 0.5 })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, envMap: storeEnv(), envMapIntensity: 0.55 });
  const turn = grainTurns.get(pieceId) || new THREE.Matrix3();
  const seed = hashString(pieceId || "x");
  const uniforms = {
    uWoodLight: { value: new THREE.Color(w.light) },
    uWoodDark: { value: new THREE.Color(w.dark) },
    uWoodStreak: { value: new THREE.Color(w.streak) },
    uRingFreq: { value: w.ringFreq },
    uGrainOffset: { value: new THREE.Vector3(((seed & 255) / 255) * 7, (((seed >> 8) & 255) / 255) * 1.5, (((seed >> 16) & 255) / 255) * 1.5) },
    uGrainTurn: { value: turn.clone() },
  };
  mat.userData.wood = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n uniform mat3 uGrainTurn;\n varying vec3 vWoodPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vWoodPos = uGrainTurn * position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + WOOD_PARS)
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "float latewood; vec4 diffuseColor = vec4( woodAt(vWoodPos, latewood), opacity );"
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + latewood * 0.12, 0.0, 1.0);"
      );
  };
  // One program for every wood piece (the uniforms differ, not the code).
  mat.customProgramCacheKey = () => "tienda-wood";
  return mat;
}

/* A block of wood, and a thin dark silhouette shell (Standard's
   technique) so a piece on a square of its own wood still reads. */
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  const mat = woodMaterial({ isDark, pieceId: piece.id });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pieceId: piece.id, kind: "piece" };

  const shellGeo = isDisc
    ? new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, (DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, DISC_H * CABEZA_SCALE + OUTLINE_T * 2, 40)
    : piece.vox
      ? makePolycubeSmooth(piece, PIECE_SCALE, EDGE_RADIUS + OUTLINE_T, OUTLINE_T)
      : makeRoundedBox(piece.w * PIECE_SCALE + OUTLINE_T * 2, piece.z * PIECE_SCALE + OUTLINE_T * 2, piece.h * PIECE_SCALE + OUTLINE_T * 2, EDGE_RADIUS + OUTLINE_T);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: isDark ? 0x120a05 : 0x2c1a0e, side: THREE.BackSide, shadowSide: THREE.BackSide }));
  shell.castShadow = true;
  shell.position.set(center.x, y + OUTLINE_T, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell" };
  return { mesh, shell };
}

/* ------------------------------------------------------------ move markers */

/* Where a piece can go: a frame like a brass inlay, gold with a dark
   edge so it reads on maple and walnut alike. A crush is a heavier frame
   in faded red with a second one inside. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group();
  const mats = [], geos = [];
  const frame = (ix, iz, w, color, lift) => {
    const pos = [], idx = [];
    const o = [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]], inn = [[-ix + w, -iz + w], [ix - w, -iz + w], [ix - w, iz - w], [-ix + w, iz - w]];
    for (let i = 0; i < 4; i++) {
      const a = o[i], b = o[(i + 1) % 4], c = inn[(i + 1) % 4], d = inn[i], v = i * 4;
      pos.push(a[0], lift, a[1], b[0], lift, b[1], c[0], lift, c[1], d[0], lift, d[1]);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false });
    mats.push(mat); geos.push(geo);
    group.add(new THREE.Mesh(geo, mat));
  };
  const main = isCrush ? 0xb04a3a : 0xe2b54e;
  const w = isCrush ? 0.07 : 0.05;
  frame(hx * 0.92, hz * 0.92, w + 0.03, 0x24150b, 0); // the dark edge, under
  frame(hx * 0.92 - 0.015, hz * 0.92 - 0.015, w, main, 0.001);
  if (isCrush) {
    frame(hx * 0.62, hz * 0.62, 0.06, 0x24150b, 0);
    frame(hx * 0.62 - 0.012, hz * 0.62 - 0.012, 0.036, main, 0.001);
  }
  group.position.set(cx, 0.03, cz);
  return {
    root: group,
    setOpacity(v) { mats.forEach((m) => { m.opacity = v * 0.95; }); },
    tick() {},
    dispose() { geos.forEach((gg) => gg.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

export function renderGlobalDefs() {
  return null;
}

/* ------------------------------------------------------------ the menus' look */

/* Fonts of the period's printed matter: Bodoni for the title (the game's
   own ads), a Franklin Gothic for signs and labels, Courier for anything
   typed or printed by a machine. The chassis draws its menus with IBM
   Plex; they are re-set here in these, and its glassy panels become
   card stock. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700;6..96,800&family=Libre+Franklin:wght@400;500;600;700;800;900&family=Courier+Prime:wght@400;700&display=swap');
  html, body { overscroll-behavior: none; background: #1a140f; }
  [style*="IBM Plex Mono"] { font-family: 'Courier Prime', 'Courier New', Courier, monospace !important; }
  [style*="IBM Plex Sans"] { font-family: 'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif !important; }
  [style*="Fraunces"] { font-family: 'Bodoni Moda', Georgia, serif !important; }
  .ec-title {
    font-weight: 700 !important;
    color: ${PERIOD.ink} !important;
    letter-spacing: 0.05em;
    text-shadow: none !important;
    background: #efe5cc;
    padding: 0.06em 0.34em 0.02em;
    border: 1px solid rgba(46,33,24,0.55);
    box-shadow: 0 0 0 4px #efe5cc, 0 0 0 5px rgba(46,33,24,0.35), 0 6px 14px rgba(20,12,6,0.35);
  }
  .ec-masthead-relocated .ec-title { box-shadow: 0 0 0 2px #efe5cc, 0 0 0 3px rgba(46,33,24,0.35), 0 3px 8px rgba(20,12,6,0.3); }
  /* The menu card: cream stock with a printed rule, not frosted glass. */
  [data-testid="dock-panel"] {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border-radius: 3px !important;
    background-color: #ece1c6 !important;
    background-image: var(--tienda-paper) !important;
    border: 1px solid rgba(46,33,24,0.55) !important;
    box-shadow: inset 0 0 0 4px #ece1c6, inset 0 0 0 5px rgba(46,33,24,0.28), 0 10px 26px rgba(20,12,6,0.45) !important;
  }
  .ec-btn { border-radius: 2px !important; letter-spacing: 0.08em; }
  .ec-btn:active { transform: translateY(1px); }
  [data-testid="piece-card"], [data-testid="info-overlay"] > div, [data-testid="new-game-choice"] {
    background-image: var(--tienda-paper) !important;
    border-radius: 3px !important;
  }
  [data-testid="piece-card"] { border: 1px solid rgba(46,33,24,0.5) !important; }
  @media (prefers-reduced-motion: reduce) { .ec-btn:active { transform: none; } }
`;

/* ------------------------------------------------------------ setup row */

/* Begin Game shares its row with the catalog's order form (custom rules,
   see tienda-overlay.js). */
export function renderSetupExtras({ beginGameButton, openOrderForm }) {
  const h = React.createElement;
  return h(
    "div",
    { style: { display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap", width: "100%" } },
    h("button", {
      key: "order", type: "button", className: "ec-btn ec-btn-invert", "data-testid": "tienda-order-form",
      title: "Custom rules: order the pieces, laws and board you want from the catalog",
      onClick: openOrderForm,
      style: {
        flex: "1 1 0", minWidth: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
        color: COLORS.charcoal, background: "transparent", border: `1.5px solid ${COLORS.charcoal}`, padding: "9px 10px", cursor: "pointer",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      },
    }, "Custom rules"),
    beginGameButton
  );
}

export { useSetupExtras, renderExtraOverlays } from "./tienda-overlay.js";
export { mountAmbientEffects } from "./tienda-fx.js";
export { createAudio, hasAudio } from "./tienda-audio.js";
// The in-game menu offers a switch for the cost badges on the move
// markers (chassis: theme.moveCostToggle, the costs-toggle button).
export const moveCostToggle = true;
