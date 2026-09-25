/* Cromo theme: polished steel on a monolith.

   The board is the top face of one massive cube, in either of two
   stones the player picks before a game: TUNGSTEN (heavy, grey, brushed
   and polished) or SHUNGITE (black, glassy, with a faint silvery
   lustre). The cube runs far below the playing surface and fades into
   the dark, so the board reads as the top of something enormous rather
   than a plate on a table. Pieces are machined steel: mirror chrome for
   Light, warm gunmetal for Dark.

   Everything here plugs into the shared chassis the same way Standard
   and Neon do (see ARCHITECTURE.md). The pieces the chassis builds (the
   slab, the grid, the pieces) get Cromo's materials through the usual
   hooks; the parts only Cromo has (the cube below the slab, the light
   sweep, the landing shimmer) are added to the live scene from
   mountAmbientEffects, which the chassis already hands the scene to.

   Metal needs something to reflect. A small studio panorama (a dark
   gradient room with a few softboxes) is painted on a canvas and given
   to every Cromo material as its envMap, rather than set once as the
   scene's environment: the setup screen's floating piece is drawn by a
   second renderer with its own scene, and a panorama texture (unlike a
   prefiltered render target) works in both. */

import React from "react";
import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, SLAB_THICKNESS, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE,
} from "../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";

/* ------------------------------------------------------------ palette */

export const COLORS = {
  // Dark UI, as Neon's: cream is the panel surface, charcoal the ink.
  cream: "#121315",
  creamAlt: "#17181B",
  charcoal: "#E6E8EC",
  slate: "#8D9199",
  slateSoft: "rgba(164, 168, 176, 0.26)",
  slateFaint: "rgba(164, 168, 176, 0.10)",
  pageBg: "#0B0B0C",
  pageBgDeep: "#050505",
  accentDark: "#B7AD9C", // warm gunmetal highlight
  accentLight: "#FFFFFF", // chrome
  accentDanger: "#D8583F",
  bodyDark: "#5A5347",
  bodyLight: "#F2F3F5",
  inkOnAccent: "#0D0E10",
};

export const titleFontFamily = "'Michroma', 'Barlow', sans-serif";
export const mastheadScale = 0.82; // Michroma is very wide

export const HEX = {
  cream: 0x121315,
  charcoal: 0x2a2c30, // the slab's edge lines (hidden under the monolith) and top ring
  slate: 0x8d9199,
  pieceLight: 0xf2f3f5,
  pieceDark: 0x6a6255,
  // Pivot arrows and similar accents the chassis colours per side.
  glowCyan: 0xd9cfbf,
  glowAmber: 0xffffff,
  structureEdge: 0xe6e8ec,
};

export const EDGE_RADIUS = 0.07;
const OUTLINE_T = 0.011;
export const outlineYOffset = OUTLINE_T;

export const modalBackdrop = "rgba(5,5,6,0.62)";
export const modalSurface = "rgba(20,21,24,0.97)";
export const canvasGradientStart = "#2C2E33";
export const canvasGradientEnd = "#0B0B0C";

export const lights = {
  ambient: { color: 0xffffff, intensity: 0.06 },
  hemi: { sky: 0xe9eef5, ground: 0x1a1a1a, intensity: 0.32 },
  key: { color: 0xffffff, intensity: 1.35 },
  fill: { color: 0xeef2f8, intensity: 0.32 },
  back: { color: 0xffffff, intensity: 0.42 },
};

/* ------------------------------------------------------------ stones */

const STONE_KEY = "el-cabeza:cromo-stone";
export const STONES = {
  tungsten: {
    label: "Tungsten",
    // Top face: brushed, polished grey metal.
    base: [128, 131, 136], streak: 0.07, fleck: 0,
    groove: "rgba(12,12,14,0.92)", grooveLight: "rgba(236,240,246,0.55)", goalTint: "rgba(255,255,255,0.05)",
    topMetal: 1, topRough: [0.26, 0.4], topClear: 0.15,
    side: 0x8b8e94, sideMetal: 1, sideRough: 0.3, sideClear: 0,
    env: 1.35,
    gridColor: 0x141518, gridOpacity: 0.42, borderColor: 0xe6e9ee, borderOpacity: 0.5,
  },
  shungite: {
    label: "Shungite",
    // Top face: black glassy stone, mottled, with silvery flecks.
    base: [28, 29, 32], streak: 0, fleck: 0.5,
    groove: "rgba(0,0,0,0.9)", grooveLight: "rgba(205,210,220,0.42)", goalTint: "rgba(210,215,225,0.045)",
    topMetal: 0.35, topRough: [0.14, 0.34], topClear: 0.85,
    side: 0x19191c, sideMetal: 0.4, sideRough: 0.2, sideClear: 0.8,
    env: 1.2,
    gridColor: 0xc9cdd5, gridOpacity: 0.2, borderColor: 0xd5d9e0, borderOpacity: 0.42,
  },
};
function loadStone() {
  try {
    const v = window.localStorage.getItem(STONE_KEY);
    if (v && STONES[v]) return v;
  } catch (e) { /* storage blocked */ }
  return "tungsten";
}
let stoneKey = typeof window !== "undefined" ? loadStone() : "tungsten";
const stone = () => STONES[stoneKey];

/* ------------------------------------------------------------ studio env */

let ENV = null;
function studioEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#6a6c72");
  grad.addColorStop(0.36, "#3a3c41");
  grad.addColorStop(0.5, "#24252a");
  grad.addColorStop(0.58, "#16171a");
  grad.addColorStop(0.8, "#1d1e22"); // a dim studio floor, for the cube's sides to mirror
  grad.addColorStop(1, "#0a0a0b");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Softboxes: [azimuth deg, elevation deg, width deg, height deg, level].
  // A big overhead panel (what the tops of the pieces see), a long strip
  // behind it, and tall strips around the horizon for the cube's sides.
  const boxes = [
    [0, 84, 360, 12, 0.85], [0, 62, 150, 16, 1], [-90, 22, 9, 46, 0.95], [95, 18, 34, 30, 0.8], [180, 8, 80, 5, 0.9],
    [32, 12, 6, 26, 1], [-150, 30, 18, 10, 0.55], [-40, 4, 4, 30, 0.75], [140, 6, 5, 34, 0.7], [-120, 2, 3, 22, 0.6], [70, 0, 3, 20, 0.55],
    // Low strips and floor bounce, seen in the cube's vertical faces.
    [90, -22, 70, 5, 0.5], [-90, -30, 60, 4, 0.42], [0, -26, 50, 4, 0.45], [180, -24, 90, 5, 0.5], [45, -48, 120, 10, 0.18], [-135, -50, 110, 10, 0.16],
  ];
  boxes.forEach(([az, el, w, h, lv]) => {
    const x = ((az + 180) / 360) * W, y = ((90 - el) / 180) * H, bw = (w / 360) * W, bh = (h / 180) * H;
    const soft = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
    soft.addColorStop(0, `rgba(255,255,255,${0.55 * lv})`);
    soft.addColorStop(0.5, `rgba(255,255,255,${lv})`);
    soft.addColorStop(1, `rgba(255,255,255,${0.55 * lv})`);
    g.fillStyle = soft;
    g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    if (x - bw / 2 < 0) g.fillRect(x - bw / 2 + W, y - bh / 2, bw, bh);
    if (x + bw / 2 > W) g.fillRect(x - bw / 2 - W, y - bh / 2, bw, bh);
  });
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ board */

// A small, fast value noise for the stone surfaces.
function noise2(seed) {
  const p = new Uint8Array(512);
  let s = seed >>> 0;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const fade = (t) => t * t * (3 - 2 * t);
  const h = (x, y) => p[p[x & 255] + (y & 255)] / 255;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/* The top face: colour on one canvas, roughness on a second (hung on the
   returned texture as userData.roughnessMap for buildSlabMaterials). The
   grid is engraved in both — a dark groove with a lit lower lip, rougher
   than the polished squares — and also drawn as line geometry by
   makeGrid, which stays crisp at grazing angles. */
export function makeBoardTexture() {
  const st = stone();
  const RES = 2048;
  const pxPerUnit = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * pxPerUnit), H = Math.round(SLAB_Z * pxPerUnit);
  const col = document.createElement("canvas"); col.width = W; col.height = H;
  const rough = document.createElement("canvas"); rough.width = W; rough.height = H;
  const g = col.getContext("2d"), r = rough.getContext("2d");
  const n = noise2(stoneKey === "tungsten" ? 12 : 29);

  // Base colour and roughness, pixel by pixel on a reduced grid, then
  // scaled up: the stone's large-scale variation.
  const S = 256, img = g.createImageData(S, S), rimg = r.createImageData(S, S);
  const [br, bg, bb] = st.base;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    let k, rv;
    if (stoneKey === "tungsten") {
      // Brushed along the columns: long, thin streaks.
      const s = n(u * 3, v * 180) * 0.6 + n(u * 14, v * 420) * 0.4;
      k = 0.9 + (s - 0.5) * st.streak * 3;
      rv = st.topRough[0] + (st.topRough[1] - st.topRough[0]) * s;
    } else {
      // Conchoidal mottling: soft, broad, low-contrast.
      const s = n(u * 5, v * 5) * 0.55 + n(u * 17, v * 17) * 0.3 + n(u * 60, v * 60) * 0.15;
      k = 0.82 + s * 0.4;
      rv = st.topRough[0] + (st.topRough[1] - st.topRough[0]) * (1 - s);
    }
    img.data[i] = br * k; img.data[i + 1] = bg * k; img.data[i + 2] = bb * k; img.data[i + 3] = 255;
    const rr = Math.max(0, Math.min(255, rv * 255));
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rr; rimg.data[i + 3] = 255;
  }
  const tmp = document.createElement("canvas"); tmp.width = tmp.height = S;
  tmp.getContext("2d").putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(tmp, 0, 0, W, H);
  tmp.getContext("2d").putImageData(rimg, 0, 0);
  r.drawImage(tmp, 0, 0, W, H);

  // Fine brushing on tungsten: hairline streaks at full resolution.
  if (st.streak) {
    let s = 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * W, len = 60 + rnd() * 700, y0 = rnd() * H;
      g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.05})` : `rgba(0,0,0,${0.02 + rnd() * 0.06})`;
      g.fillRect(x, y0, 1, len);
    }
  }
  // Silvery flecks in shungite.
  if (st.fleck) {
    let s = 3;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(215,220,230,${0.08 + rnd() * 0.3 * st.fleck})`;
      const x = rnd() * W, y = rnd() * H, d = rnd() < 0.85 ? 1 : 2;
      g.fillRect(x, y, d, d);
    }
  }

  const pad = MARGIN * pxPerUnit, sq = SQUARE_SIZE * pxPerUnit;
  // Goal rows: a faint polished band.
  g.fillStyle = st.goalTint;
  g.fillRect(pad, pad, BOARD_COLS * sq, sq);
  g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq, BOARD_COLS * sq, sq);

  // Engraving: groove, then the lit lip just below it.
  const groove = (ctx, style, lw, off) => {
    ctx.strokeStyle = style; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let c = 0; c <= BOARD_COLS; c++) { const x = pad + c * sq + off; ctx.moveTo(x, pad); ctx.lineTo(x, pad + BOARD_ROWS * sq); }
    for (let rr = 0; rr <= BOARD_ROWS; rr++) { const y = pad + rr * sq + off; ctx.moveTo(pad, y); ctx.lineTo(pad + BOARD_COLS * sq, y); }
    ctx.stroke();
  };
  groove(g, st.groove, 6, 0);
  groove(g, st.grooveLight, 1.4, 3.6);
  groove(r, "rgb(215,215,215)", 7, 0); // the groove is matte

  const tex = new THREE.CanvasTexture(col);
  const rtex = new THREE.CanvasTexture(rough);
  tex.userData = { roughnessMap: rtex };
  return tex;
}

function sideMaterial(vertexColors) {
  const st = stone();
  return new THREE.MeshPhysicalMaterial({
    color: st.side, metalness: st.sideMetal, roughness: st.sideRough,
    clearcoat: st.sideClear, clearcoatRoughness: 0.12,
    envMap: studioEnv(), envMapIntensity: st.env,
    vertexColors: !!vertexColors,
  });
}

export function buildSlabMaterials(boardTex) {
  const st = stone();
  const top = new THREE.MeshPhysicalMaterial({
    map: boardTex,
    roughnessMap: boardTex.userData && boardTex.userData.roughnessMap,
    roughness: 1,
    metalness: st.topMetal,
    clearcoat: st.topClear, clearcoatRoughness: 0.08,
    envMap: studioEnv(), envMapIntensity: st.env,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  top.userData.cromoRole = "top";
  const mats = [sideMaterial(), sideMaterial(), top, sideMaterial(), sideMaterial(), sideMaterial()];
  mats.forEach((m, i) => { if (i !== 2) m.userData.cromoRole = "side"; });
  return mats;
}

export function makeGrid() {
  const st = stone();
  const group = new THREE.Group();
  const lines = [];
  for (let i = 0; i <= BOARD_COLS; i++) { const x = i * SQUARE_SIZE - OFF_X; lines.push(x, 0, -OFF_Z, x, 0, OFF_Z); }
  for (let i = 0; i <= BOARD_ROWS; i++) { const z = i * SQUARE_SIZE - OFF_Z; lines.push(-OFF_X, 0, z, OFF_X, 0, z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: st.gridColor, transparent: true, opacity: st.gridOpacity });
  gridMat.userData.cromoRole = "grid";
  const gridLines = new THREE.LineSegments(geo, gridMat);
  gridLines.position.y = 0.05; // clears the top face's polygon offset (see themes/standard.js)
  group.add(gridLines);

  const b = [-OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, OFF_Z, OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, -OFF_Z];
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
  const borderMat = new THREE.LineBasicMaterial({ color: st.borderColor, transparent: true, opacity: st.borderOpacity });
  borderMat.userData.cromoRole = "border";
  const border = new THREE.LineSegments(bGeo, borderMat);
  border.position.y = 0.06;
  group.add(border);
  return group;
}

/* ------------------------------------------------------------ pieces */

/* Machined steel. A thin dark silhouette shell (Standard's technique)
   keeps two chrome pieces side by side from melting into one mirror. */
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: isDark ? HEX.pieceDark : HEX.pieceLight,
    metalness: 1,
    roughness: isDark ? 0.24 : 0.07,
    clearcoat: isDark ? 0.5 : 0,
    clearcoatRoughness: 0.18,
    envMap: studioEnv(),
    envMapIntensity: isDark ? 1.5 : 1.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pieceId: piece.id, kind: "piece" };

  const shellGeo = isDisc
    ? new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, (DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, DISC_H * CABEZA_SCALE + OUTLINE_T * 2, 48)
    : piece.vox
      ? makePolycubeSmooth(piece, PIECE_SCALE, EDGE_RADIUS + OUTLINE_T, OUTLINE_T)
      : makeRoundedBox(piece.w * PIECE_SCALE + OUTLINE_T * 2, piece.z * PIECE_SCALE + OUTLINE_T * 2, piece.h * PIECE_SCALE + OUTLINE_T * 2, EDGE_RADIUS + OUTLINE_T);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide, shadowSide: THREE.BackSide }));
  shell.castShadow = true;
  shell.position.set(center.x, y + OUTLINE_T, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell" };
  return { mesh, shell };
}

/* A polished inlay frame for each legal move, lying on the board; a
   crush is a heavier frame with a second one inside it. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group();
  const mats = [];
  const frame = (ix, iz, w) => {
    const pos = [], idx = [];
    const o = [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]], inn = [[-ix + w, -iz + w], [ix - w, -iz + w], [ix - w, iz - w], [-ix + w, iz - w]];
    for (let i = 0; i < 4; i++) {
      const a = o[i], b = o[(i + 1) % 4], c = inn[(i + 1) % 4], d = inn[i], v = i * 4;
      pos.push(a[0], 0, a[1], b[0], 0, b[1], c[0], 0, c[1], d[0], 0, d[1]);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    mats.push(mat);
    group.add(new THREE.Mesh(geo, mat));
    return geo;
  };
  const geos = [frame(hx * 0.9, hz * 0.9, isCrush ? 0.05 : 0.028)];
  if (isCrush) geos.push(frame(hx * 0.62, hz * 0.62, 0.028));
  group.position.set(cx, 0.03, cz);
  return {
    root: group,
    setOpacity(v) { mats.forEach((m) => { m.opacity = v * 0.85; }); },
    tick() {},
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/* ------------------------------------------------------------ stone switch */

/* Re-dresses the live board in the chosen stone: the slab's faces, the
   monolith below it, the grid lines, and a freshly painted top. */
function applyStoneToScene(t, monolith) {
  if (!t || !t.boardGroup) return;
  const st = stone();
  const slab = t.boardGroup.getObjectByName("ec-slab");
  if (slab && Array.isArray(slab.material)) {
    const tex = makeBoardTexture();
    if (t.renderer) tex.anisotropy = t.renderer.capabilities.getMaxAnisotropy();
    slab.material.forEach((m) => {
      if (m.userData.cromoRole === "top") {
        if (m.map) m.map.dispose();
        if (m.roughnessMap) m.roughnessMap.dispose();
        m.map = tex; m.roughnessMap = tex.userData.roughnessMap;
        m.metalness = st.topMetal; m.clearcoat = st.topClear; m.envMapIntensity = st.env;
        m.needsUpdate = true;
      } else if (m.userData.cromoRole === "side") {
        m.color.setHex(st.side); m.metalness = st.sideMetal; m.roughness = st.sideRough; m.clearcoat = st.sideClear; m.envMapIntensity = st.env;
      }
    });
  }
  if (monolith && monolith.material) {
    const m = monolith.material;
    m.color.setHex(st.side); m.metalness = st.sideMetal; m.roughness = st.sideRough; m.clearcoat = st.sideClear; m.envMapIntensity = st.env;
  }
  t.boardGroup.traverse((o) => {
    const m = o.material;
    if (!m || !m.userData) return;
    if (m.userData.cromoRole === "grid") { m.color.setHex(st.gridColor); m.opacity = st.gridOpacity; }
    if (m.userData.cromoRole === "border") { m.color.setHex(st.borderColor); m.opacity = st.borderOpacity; }
  });
}

// The live scene's switcher, installed by mountAmbientEffects.
let stoneListener = null;

export function setStone(key) {
  if (!STONES[key] || key === stoneKey) return;
  stoneKey = key;
  try { window.localStorage.setItem(STONE_KEY, key); } catch (e) { /* storage blocked */ }
  if (stoneListener) stoneListener();
}
export function getStone() {
  return stoneKey;
}

export function useSetupExtras({ audio }) {
  const [key, setKey] = React.useState(stoneKey);
  return {
    stone: key,
    toggleStone() {
      const next = key === "tungsten" ? "shungite" : "tungsten";
      setStone(next);
      setKey(next);
      audio && audio.playStone && audio.playStone(next);
    },
  };
}

/* Begin Game shares its row with the stone switch: a small swatch of the
   chosen stone and its name. */
export function renderSetupExtras({ beginGameButton, stone: key, toggleStone }) {
  const h = React.createElement;
  const st = STONES[key] || STONES.tungsten;
  const swatch = key === "shungite"
    ? "radial-gradient(circle at 35% 30%, #5a5c62, #111113 62%)"
    : "linear-gradient(160deg, #eef0f3 0%, #9a9da3 45%, #5f6268 55%, #c9ccd1 100%)";
  return h(
    "div",
    { style: { display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap", width: "100%" } },
    h(
      "button",
      {
        key: "stone",
        type: "button",
        className: "ec-btn ec-btn-invert",
        "data-testid": "cromo-stone",
        "aria-label": `Board stone: ${st.label}. Switch stone`,
        title: "Switch the monolith between tungsten and shungite",
        onClick: toggleStone,
        style: {
          flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          color: COLORS.charcoal, background: "transparent", border: `1.5px solid ${COLORS.charcoal}`, padding: "9px 12px", cursor: "pointer",
        },
      },
      h("span", { "aria-hidden": "true", style: { width: 12, height: 12, borderRadius: 2, background: swatch, boxShadow: "0 0 0 1px rgba(255,255,255,0.25)" } }),
      st.label
    ),
    beginGameButton
  );
}

export function renderGlobalDefs() {
  return null;
}

/* Fonts, and the chrome-lettered title (Michroma, a cold steel
   gradient). */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Michroma&family=Barlow:wght@400;500;600;700&display=swap');
  .ec-title {
    background: linear-gradient(180deg, #ffffff 0%, #d7dae0 44%, #8e939c 54%, #eceef2 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    letter-spacing: 0.06em;
  }
`;

/* ------------------------------------------------------------ scene life */

/* The scene effects (the monolith, light sweeps, landing shimmer) and the
   audio live in their own files; both are re-exported here so the app
   sees one theme module. */
export { mountAmbientEffects } from "./cromo-fx.js";
export { createAudio, hasAudio } from "./cromo-audio.js";

// For cromo-fx.js: re-dress the scene whenever the stone changes.
export function onStoneChange(fn) {
  stoneListener = fn;
}
export { applyStoneToScene, studioEnv, sideMaterial, stone as currentStone };
