/* Lluvia theme: tech-noir, in the rain.

   The board is a slab of wet black asphalt floating over a living city:
   the city itself (themes/lluvia-city.js, the same engine as the Lluvia
   design boards) runs behind the game, down a rain-soaked avenue of
   neon, kanji and a few Vietnamese signs, spinners crossing overhead.
   Rain falls around the board and dimples its puddles; pieces are neon
   glass, cyan for Dark and magenta for Light, each outlined like a tube
   sign; legal moves are marked in sodium yellow. Thunder in the score
   lights the sky.

   Plugs into the shared chassis the same way Standard, Neon and Cromo do
   (see ARCHITECTURE.md): board, grid and pieces through the usual hooks,
   everything Lluvia-only (the city, the rain, the lightning) from
   mountAmbientEffects (themes/lluvia-fx.js). The sound is the city's own
   score with the game's cues built from its instruments
   (themes/lluvia-audio.js). */

import React from "react";
import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE,
} from "../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";
import { LluviaOverlay, defaultSelections } from "./lluvia-overlay.js";

/* ------------------------------------------------------------ palette */

export const PINK = "#FF3DBB", CYAN = "#23E6FF", AMBER = "#FFB347", SODIUM = "#FFF27A";

export const COLORS = {
  cream: "#0C0A10",
  creamAlt: "#110D17",
  charcoal: "#E9E4F2",
  slate: "#8D86A0",
  slateSoft: "rgba(185, 178, 200, 0.24)",
  slateFaint: "rgba(185, 178, 200, 0.10)",
  pageBg: "#05040A",
  pageBgDeep: "#020104",
  accentDark: CYAN,
  accentLight: PINK,
  accentDanger: AMBER,
  bodyDark: "#0B3B47",
  bodyLight: "#FFD0EF",
  inkOnAccent: "#140A1C",
};

export const titleFontFamily = "'Saira Extra Condensed', 'Saira Condensed', sans-serif";
export const mastheadScale = 1.2;

export const HEX = {
  cream: 0x0c0a10,
  charcoal: 0xff5ac8, // the slab's edge lines and top ring: its pink neon rim
  slate: 0x8d86a0,
  pieceDark: 0x0fb4d6,
  pieceLight: 0xd92a9e,
  glowCyan: 0x23e6ff,
  glowAmber: 0xff3dbb,
  structureEdge: 0xfff27a,
};

export const EDGE_RADIUS = 0.08;
const OUTLINE_T = 0.014;
export const outlineYOffset = OUTLINE_T;

export const modalBackdrop = "rgba(3,2,6,0.62)";
export const modalSurface = "rgba(14,9,4,0.95)";
// The city covers these; they show only while it loads.
export const canvasGradientStart = "#1a1030";
export const canvasGradientEnd = "#05040a";

export const lights = {
  ambient: { color: 0x6b5fa8, intensity: 0.12 },
  hemi: { sky: 0x6b5fa8, ground: 0x050409, intensity: 0.42 },
  key: { color: 0xb9c4ff, intensity: 0.62 },
  fill: { color: 0xff5ac8, intensity: 0.34 },
  back: { color: 0x23e6ff, intensity: 0.4 },
};

/* ------------------------------------------------------------ the neon night */

// What the wet surfaces and glass pieces reflect: a violet night with
// big signs in pink, cyan and amber, and a horizon of small city lights.
let ENV = null;
export function nightEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1a1030"); grad.addColorStop(0.47, "#150d22"); grad.addColorStop(0.53, "#0a0812"); grad.addColorStop(1, "#020203");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  let s = 11;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const LIGHTS = ["#ff3dbb", "#23e6ff", "#ffb347", "#fff27a", "#9fb4ff", "#ffffff"];
  for (let i = 0; i < 900; i++) {
    g.fillStyle = LIGHTS[Math.floor(rnd() * LIGHTS.length)];
    g.globalAlpha = 0.25 + rnd() * 0.6;
    g.fillRect(rnd() * W, H * (0.4 + rnd() * 0.12), 1 + rnd() * 2, 1 + rnd() * 3);
  }
  g.globalAlpha = 1;
  const panels = [["#ff2fb4", -70, 15, 30, 22, 1], ["#23e6ff", 60, 18, 26, 26, 1], ["#ffb347", 170, 10, 40, 8, 0.9], ["#ffffff", 0, 70, 30, 8, 0.4], ["#ff2fb4", 120, 30, 8, 30, 0.8], ["#23e6ff", -140, 22, 12, 18, 0.7]];
  panels.forEach(([col, az, el, w, h, a]) => {
    const x = ((az + 180) / 360) * W, y = ((90 - el) / 180) * H, bw = (w / 360) * W, bh = (h / 180) * H;
    g.globalAlpha = a; g.fillStyle = col;
    g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
  });
  g.globalAlpha = 1;
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ board */

function noise2(seed) {
  const p = new Uint8Array(512);
  let s = seed >>> 0;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const fade = (t) => t * t * (3 - 2 * t);
  const h = (x, y) => p[p[x & 255] + (y & 255)] / 255;
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  n.fbm = (x, y, o) => { let sum = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < o; i++) { sum += n(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; } return sum / norm; };
  return n;
}
const puddleAt = (n, u, v) => Math.max(0, Math.min(1, (n.fbm(u * 3.2 + 4, v * 3.2 + 1, 4) - 0.5) * 9));

/* Wet asphalt: aggregate grain, broad puddles (darker, and glossy on the
   roughness map, so they mirror the signs), painted grid lines, and a
   few ring marks where drops have hit. */
export function makeBoardTexture() {
  const RES = 2048, pxPerUnit = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * pxPerUnit), H = Math.round(SLAB_Z * pxPerUnit);
  const col = document.createElement("canvas"); col.width = W; col.height = H;
  const rough = document.createElement("canvas"); rough.width = W; rough.height = H;
  const g = col.getContext("2d"), r = rough.getContext("2d");
  const n = noise2(61);
  const S = 384, img = g.createImageData(S, S), rimg = r.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    const agg = n(u * 240, v * 240), wet = puddleAt(n, u, v);
    let val = 30 + agg * 22 + (n.fbm(u * 8, v * 8, 3) - 0.5) * 16;
    val *= 1 - wet * 0.55;
    img.data[i] = val; img.data[i + 1] = val; img.data[i + 2] = val * 1.05 + 3; img.data[i + 3] = 255;
    const rv = 255 * (0.66 - wet * 0.6);
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
  }
  const tmp = document.createElement("canvas"); tmp.width = tmp.height = S;
  tmp.getContext("2d").putImageData(img, 0, 0);
  g.drawImage(tmp, 0, 0, W, H);
  tmp.getContext("2d").putImageData(rimg, 0, 0);
  r.drawImage(tmp, 0, 0, W, H);

  const pad = MARGIN * pxPerUnit, sq = SQUARE_SIZE * pxPerUnit;
  // Goal rows: a faint sodium wash, as if under a streetlight.
  g.fillStyle = "rgba(255,242,122,0.035)";
  g.fillRect(pad, pad, BOARD_COLS * sq, sq);
  g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq, BOARD_COLS * sq, sq);
  // Road paint for the grid: pale, a little worn.
  g.strokeStyle = "rgba(210,218,235,0.45)"; g.lineWidth = 3;
  g.beginPath();
  for (let c = 0; c <= BOARD_COLS; c++) { const x = pad + c * sq; g.moveTo(x, pad); g.lineTo(x, pad + BOARD_ROWS * sq); }
  for (let rr = 0; rr <= BOARD_ROWS; rr++) { const y = pad + rr * sq; g.moveTo(pad, y); g.lineTo(pad + BOARD_COLS * sq, y); }
  g.stroke();
  let s = 9;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.strokeStyle = "rgba(200,215,255,0.3)"; g.lineWidth = 1.5;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H;
    if (puddleAt(n, x / W, y / H) < 0.5) continue;
    const rr = 4 + rnd() * 16;
    g.beginPath(); g.ellipse(x, y, rr, rr * 0.9, 0, 0, Math.PI * 2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(col);
  tex.userData = { roughnessMap: new THREE.CanvasTexture(rough) };
  return tex;
}

export function buildSlabMaterials(boardTex) {
  const side = () => new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMap: nightEnv(), envMapIntensity: 1.2 });
  const top = new THREE.MeshPhysicalMaterial({
    map: boardTex,
    roughnessMap: boardTex.userData && boardTex.userData.roughnessMap,
    roughness: 1, metalness: 0.05,
    clearcoat: 0.7, clearcoatRoughness: 0.15,
    envMap: nightEnv(), envMapIntensity: 1.5,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  return [side(), side(), top, side(), side(), side()];
}

export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];
  for (let i = 0; i <= BOARD_COLS; i++) { const x = i * SQUARE_SIZE - OFF_X; lines.push(x, 0, -OFF_Z, x, 0, OFF_Z); }
  for (let i = 0; i <= BOARD_ROWS; i++) { const z = i * SQUARE_SIZE - OFF_Z; lines.push(-OFF_X, 0, z, OFF_X, 0, z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd2daeb, transparent: true, opacity: 0.26 }));
  gridLines.position.y = 0.05;
  group.add(gridLines);
  const b = [-OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, OFF_Z, OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, -OFF_Z];
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
  const border = new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ color: 0xff5ac8, transparent: true, opacity: 0.75 }));
  border.position.y = 0.06;
  group.add(border);
  return group;
}

/* ------------------------------------------------------------ pieces */

/* Neon glass: a translucent body lit from within, and a silhouette shell
   in the pale tube colour of its side, so every piece reads as a sign. */
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  const body = isDark ? HEX.pieceDark : HEX.pieceLight;
  const mat = new THREE.MeshPhysicalMaterial({
    color: body, emissive: body, emissiveIntensity: 0.14,
    roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
    transparent: true, opacity: 0.82,
    envMap: nightEnv(), envMapIntensity: 1.8,
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
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: isDark ? 0x7ff2ff : 0xff7fd6, side: THREE.BackSide, shadowSide: THREE.BackSide }));
  shell.castShadow = true;
  shell.position.set(center.x, y + OUTLINE_T, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell" };
  return { mesh, shell };
}

/* Legal moves in sodium yellow, like road markings; a crush is a heavier
   frame with a second one inside it. The frames breathe a little. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group();
  const mats = [], geos = [];
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
    const mat = new THREE.MeshBasicMaterial({ color: isCrush ? 0xffb347 : 0xfff27a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    mats.push(mat); geos.push(geo);
    group.add(new THREE.Mesh(geo, mat));
  };
  frame(hx * 0.9, hz * 0.9, isCrush ? 0.055 : 0.032);
  if (isCrush) frame(hx * 0.62, hz * 0.62, 0.032);
  group.position.set(cx, 0.03, cz);
  let target = 0;
  return {
    root: group,
    setOpacity(v) { target = v; },
    tick(now) {
      const breathe = 0.85 + 0.15 * Math.sin((now || 0) / 380);
      mats.forEach((m) => { m.opacity = target * breathe; });
    },
    dispose() { geos.forEach((gg) => gg.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

export function renderGlobalDefs() {
  return null;
}

/* Fonts (the city's signs need Dela Gothic One and Saira), and the title
   as a pink neon tube. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@400;500;600;700&family=Saira+Extra+Condensed:wght@600;700;800&family=Dela+Gothic+One&family=Special+Elite&family=VT323&display=swap');
  .ec-title {
    font-weight: 800 !important;
    color: #fff4fb !important;
    text-shadow: 0 0 4px rgba(255,255,255,0.8), 0 0 10px #ff3dbb, 0 0 22px #ff3dbb, 0 0 40px #ff3dbb;
    letter-spacing: 0.02em;
  }
`;

/* ------------------------------------------------------------ the opening and the city */

/* The opening (the descent) shows over a fresh page, and the city again
   from the setup row's CUSTOM RULES button, or from a finished game's
   "change the rules". The chosen settings live here so the city opens on
   whatever was set last. */
export function useSetupExtras(x) {
  const [overlay, setOverlay] = React.useState(() => (x.awaitingBegin ? "ready" : null));
  const selRef = React.useRef(null);
  if (!selRef.current) selRef.current = defaultSelections();
  React.useEffect(() => { if (!x.awaitingBegin && overlay) setOverlay(null); }, [x.awaitingBegin]);
  const reopenCity = (sel) => { if (sel) selRef.current = sel; setOverlay("city"); };
  return {
    ...x,
    lluviaOverlay: overlay,
    openCity: () => setOverlay("city"),
    closeOverlay: () => setOverlay(null),
    reopenCity,
    selRef,
  };
}

export function renderSetupExtras({ beginGameButton, openCity }) {
  const h = React.createElement;
  return h(
    "div",
    { style: { display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap", width: "100%" } },
    h("button", {
      key: "city", type: "button", className: "ec-btn ec-btn-invert", "data-testid": "lluvia-custom-rules",
      title: "Go down into the city and buy the rules", onClick: openCity,
      style: {
        flex: "1 1 0", minWidth: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "#ffd0ef", background: "rgba(255,61,187,0.08)", border: "1.5px solid rgba(255,61,187,0.8)", padding: "9px 12px", cursor: "pointer",
      },
    }, "Custom rules"),
    beginGameButton
  );
}

export function renderExtraOverlays(x) {
  if (!x || !x.lluviaOverlay || !x.awaitingBegin) return null;
  return React.createElement(LluviaOverlay, {
    key: `lluvia-${x.lluviaOverlay}`,
    start: x.lluviaOverlay,
    x,
    sel: x.selRef.current,
    onSelChange: (s) => { x.selRef.current = s; },
    onClose: x.closeOverlay,
  });
}

export { mountAmbientEffects } from "./lluvia-fx.js";
export { createAudio, hasAudio } from "./lluvia-audio.js";
