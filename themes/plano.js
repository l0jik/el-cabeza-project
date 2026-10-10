/* Plano: the game drawn as a blueprint (user, choosing it from the city
   mock-ups: "Let's definitely go with the blueprints version... Make a
   full full world for this one that we can add to the theme switcher").

   White line work on cyanotype blue, readable before anything else. The
   board is a plaza on the plan, its squares ruled in white and lettered
   round the edge like a drawing's grid (A, B, C... across, 1, 2, 3...
   down). The pieces are massing models with their elevations drawn on:
   the light side white masses lined in navy, the dark side deep blue
   lined in white with their roofs hatched, so the two sides never blur.
   Legal moves are marked in red pencil, the way a drawing's revisions
   are. Round the board, on the same sheet, the city: streets with their
   kerbs, lanes and crossings, blocks of quiet buildings, trees, and life
   in the streets (cars, bikes, a tram, people walking): plano-city.js,
   hung on the board by plano-fx.js. The sound is a drafting room over a
   far-off city (plano-audio.js).

   Everything plugs into the shared chassis the same way Cromo does (see
   ARCHITECTURE.md). */

import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE,
} from "../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth, makePolycubeGeometry, voxCubeCenters } from "../engine/geometry.js";
import { parseVox } from "../engine/shapes.js";

/* ------------------------------------------------------------ palette */

export const PAPER = "#1d4c8a"; // the sheet: cyanotype blue
export const PAPER_DEEP = "#163d72";
export const PLAZA = "#2a5d9e"; // the board's squares, a shade lighter than the sheet
export const INK = "#eef6ff"; // the line work
export const PALE = "#dbe9f8"; // the light side's masses
export const NAVY = "#0f2a52"; // lines drawn on the white masses
export const HATCHED = "#163f75"; // the dark side's masses
export const PENCIL = "#ff8f73"; // red pencil: moves, revisions

export const COLORS = {
  // A dark UI: the panel is a deep blue sheet, its ink white.
  cream: "#163a6b",
  creamAlt: "#1b4479",
  charcoal: "#EEF6FF",
  slate: "#A9C6EC",
  slateSoft: "rgba(220, 236, 255, 0.32)",
  slateFaint: "rgba(220, 236, 255, 0.12)",
  pageBg: PAPER,
  pageBgDeep: "#0f2a52",
  accentDark: "#8EC2FF", // the dark (blue) side's accent
  accentLight: "#FFFFFF", // the light (white) side's
  accentDanger: PENCIL,
  bodyDark: HATCHED,
  bodyLight: PALE,
  inkOnAccent: "#0F2A52",
};

export const titleFontFamily = "'Architects Daughter', 'IBM Plex Mono', monospace";
export const mastheadScale = 1.05;

export const HEX = {
  cream: 0x163a6b,
  charcoal: 0xeef6ff, // the slab's edge lines: white line work
  slate: 0xa9c6ec,
  pieceLight: 0xcfe0f4,
  pieceDark: 0x0d2548,
  // Pivot arrows and the like, per side.
  glowCyan: 0x8ec2ff,
  glowAmber: 0xffffff,
  structureEdge: 0xeef6ff,
};

// Crisp corners: a drawing's boxes, not soft blocks.
export const EDGE_RADIUS = 0.022;
const OUTLINE_T = 0.017;
// The shell's floor sits a hair above the board (as Cromo's, wood-set.js).
const SHELL_LIFT = 0.003;
export const outlineYOffset = OUTLINE_T + SHELL_LIFT;

export const modalBackdrop = "rgba(6, 18, 42, 0.6)";
export const modalSurface = "rgba(22, 58, 108, 0.97)";
export const canvasGradientStart = "#2a5c9c";
export const canvasGradientEnd = "#163d72";

// Flat, even light, as a drawing has: a high ambient, a soft key for the
// faces to read as solids, very little else.
export const lights = {
  ambient: { color: 0xffffff, intensity: 0.5 },
  hemi: { sky: 0xeaf3ff, ground: 0x1d4c8a, intensity: 0.42 },
  key: { color: 0xffffff, intensity: 0.78 },
  fill: { color: 0xdfeaff, intensity: 0.24 },
  back: { color: 0xffffff, intensity: 0.18 },
};

/* ------------------------------------------------------------ board */

/* The plaza: the squares a shade lighter than the sheet, a faint quarter
   grid in each, the goal rows hatched, the lines ruled white, a double
   border, the columns lettered and the rows numbered in bubbles round the
   edge, crop marks at the corners. */
export function makeBoardTexture() {
  const RES = 2048, px = RES / SLAB_MAX;
  const W = Math.round(SLAB_X * px), H = Math.round(SLAB_Z * px);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const pad = MARGIN * px, sq = SQUARE_SIZE * px, gw = BOARD_COLS * sq, gh = BOARD_ROWS * sq;
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  // the sheet's own faint grid, as on the city round it
  g.strokeStyle = "rgba(238,246,255,0.06)"; g.lineWidth = 1.2;
  for (let x = pad % (sq / 4); x < W; x += sq / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = pad % (sq / 4); y < H; y += sq / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = PLAZA; g.fillRect(pad, pad, gw, gh);
  // quarter lines inside the squares
  g.strokeStyle = "rgba(238,246,255,0.09)"; g.lineWidth = 1.4;
  for (let k = 1; k < BOARD_COLS * 4; k++) if (k % 4) { const x = pad + (k * sq) / 4; g.beginPath(); g.moveTo(x, pad); g.lineTo(x, pad + gh); g.stroke(); }
  for (let k = 1; k < BOARD_ROWS * 4; k++) if (k % 4) { const y = pad + (k * sq) / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(pad + gw, y); g.stroke(); }
  // the goal rows: hatched
  g.save(); g.strokeStyle = "rgba(238,246,255,0.2)"; g.lineWidth = 2;
  for (const y0 of [pad, pad + gh - sq]) {
    g.beginPath(); g.rect(pad, y0, gw, sq); g.clip();
    for (let t = -sq; t < gw + sq; t += sq / 7) { g.beginPath(); g.moveTo(pad + t, y0 + sq); g.lineTo(pad + t + sq, y0); g.stroke(); }
    g.restore(); g.save(); g.strokeStyle = "rgba(238,246,255,0.2)"; g.lineWidth = 2;
  }
  g.restore();
  // the squares' lines
  g.strokeStyle = "rgba(238,246,255,0.92)"; g.lineWidth = Math.max(3, sq * 0.022);
  g.beginPath();
  for (let i = 0; i <= BOARD_COLS; i++) { const x = pad + i * sq; g.moveTo(x, pad); g.lineTo(x, pad + gh); }
  for (let i = 0; i <= BOARD_ROWS; i++) { const y = pad + i * sq; g.moveTo(pad, y); g.lineTo(pad + gw, y); }
  g.stroke();
  // the border, doubled
  g.lineWidth = Math.max(6, sq * 0.045); g.strokeRect(pad, pad, gw, gh);
  g.lineWidth = Math.max(2, sq * 0.014); const inset = pad * 0.18; g.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  // bubbles round the edge: letters across, numbers down (both sides)
  const r = Math.min(pad * 0.3, sq * 0.27), font = (s) => `600 ${Math.round(s)}px 'IBM Plex Mono', 'DejaVu Sans Mono', monospace`;
  const bubble = (x, y, label) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = PAPER; g.fill(); g.lineWidth = Math.max(2, r * 0.12); g.strokeStyle = "rgba(238,246,255,0.9)"; g.stroke();
    g.fillStyle = "rgba(238,246,255,0.95)"; g.font = font(r * (label.length > 1 ? 0.95 : 1.15)); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, x, y + r * 0.06);
  };
  // Each player reads the edge nearest them the right way up: the near
  // edge and the left side as drawn, the far edge and the right side
  // turned round for the player across the table.
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const turned = (x, y, label) => { g.save(); g.translate(x, y); g.rotate(Math.PI); bubble(0, 0, label); g.restore(); };
  for (let i = 0; i < BOARD_COLS; i++) { const x = pad + (i + 0.5) * sq; turned(x, pad * 0.52, letters[i]); bubble(x, H - pad * 0.52, letters[i]); }
  for (let j = 0; j < BOARD_ROWS; j++) { const y = pad + (j + 0.5) * sq; bubble(pad * 0.52, y, String(BOARD_ROWS - j)); turned(W - pad * 0.52, y, String(BOARD_ROWS - j)); }
  // crop marks at the corners
  g.strokeStyle = "rgba(238,246,255,0.8)"; g.lineWidth = Math.max(2, sq * 0.012);
  for (const [x, y] of [[pad * 0.52, pad * 0.52], [W - pad * 0.52, pad * 0.52], [pad * 0.52, H - pad * 0.52], [W - pad * 0.52, H - pad * 0.52]]) {
    const k = r * 0.9; g.beginPath(); g.moveTo(x - k, y); g.lineTo(x + k, y); g.moveTo(x, y - k); g.lineTo(x, y + k); g.stroke();
    g.beginPath(); g.arc(x, y, k * 0.55, 0, Math.PI * 2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
// The board's lettering follows its size (rows and columns change).
export const boardTextureFollowsSize = true;

export function buildSlabMaterials(boardTex) {
  // Drawn, not lit: the sheet's blues exactly as painted. The pieces'
  // shadows fall on a shadow-only layer over it (plano-fx.js).
  const top = new THREE.MeshBasicMaterial({
    map: boardTex, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
  });
  const side = () => new THREE.MeshBasicMaterial({ color: PAPER_DEEP, toneMapped: false });
  return [side(), side(), top, side(), side(), side()];
}

export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];
  for (let i = 0; i <= BOARD_COLS; i++) { const x = i * SQUARE_SIZE - OFF_X; lines.push(x, 0, -OFF_Z, x, 0, OFF_Z); }
  for (let i = 0; i <= BOARD_ROWS; i++) { const z = i * SQUARE_SIZE - OFF_Z; lines.push(-OFF_X, 0, z, OFF_X, 0, z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.55 }));
  gridLines.name = "ec-grid-lines";
  gridLines.position.y = 0.05; // clears the top face's polygon offset (see themes/standard.js)
  group.add(gridLines);
  const b = [-OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, OFF_Z, OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, -OFF_Z];
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
  const border = new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  border.position.y = 0.06;
  group.add(border);
  return group;
}

/* ------------------------------------------------------------ pieces */

/* A piece's drawing, laid on its faces: the box's own edges, a line at
   each floor, the windows as small rectangles, and on the dark side the
   roof hatched at 45 degrees. A round piece (the Cabeza) is a rotunda:
   its columns drawn down the drum and rings on its roof. An odd-shaped
   piece keeps to its outline. The geometry for each shape is made once
   and kept (the chassis rebuilds a piece's mesh on every move and
   disposes only the mesh's and shell's own; these are children). */
const FLOOR = PIECE_SCALE / 3, BAY = 0.21, HATCH = 0.12;
const LINE_GEO = new Map();
function detailGeometry(piece, isDark, isDisc) {
  const key = isDisc ? `disc|${isDark}` : piece.vox ? `vox|${isDark}|${JSON.stringify(piece.vox)}` : `box|${isDark}|${piece.w}|${piece.h}|${piece.z}`;
  if (LINE_GEO.has(key)) return LINE_GEO.get(key);
  const L = [], HL = []; // the elevations; the roof's hatching
  if (isDisc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2, hh = (DISC_H * CABEZA_SCALE) / 2, e = 0.004;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, x = Math.cos(a) * (r + e), z = Math.sin(a) * (r + e); L.push(x, -hh, z, x, hh, z); }
    for (const [rr, y] of [[r * 0.72, hh + e], [r * 0.42, hh + e], [r + e, hh * 0.35], [r + e, -hh * 0.35]]) for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2, b = ((k + 1) / 48) * Math.PI * 2; L.push(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(b) * rr, y, Math.sin(b) * rr); }
    // dark: the roof hatched at 45 degrees, each line cut at the rim
    if (isDark) for (let t = -r * 1.4; t < r * 1.4; t += HATCH) { const disc = 2 * r * r - t * t; if (disc <= 0) continue; const x1 = (t - Math.sqrt(disc)) / 2, x2 = (t + Math.sqrt(disc)) / 2; HL.push(x1, hh + e, x1 - t, x2, hh + e, x2 - t); }
  } else if (piece.vox) {
    const src = makePolycubeGeometry(piece, PIECE_SCALE), eg = new THREE.EdgesGeometry(src, 10);
    L.push(...eg.attributes.position.array); src.dispose(); eg.dispose();
    /* The drawing on an odd piece as on a box (user: "Have the newer pieces
       been rendered in the blueprint style yet? It doesn't seem like they
       have been"; they had only their outline): on every outside wall of
       every cube its floors and windows, a line where a wall runs on up
       past a level (the outline leaves that out), and on the dark side
       every roof hatched, the hatching one pattern across the piece. */
    const cubes = parseVox(piece.vox), solid = new Set(cubes.map((c) => c.join(","))), centers = voxCubeCenters(piece, PIECE_SCALE);
    const S = PIECE_SCALE, h = S / 2, e = 0.004, fl = Math.max(1, Math.round(S / FLOOR)), FH = S / fl, bays = Math.max(2, Math.round(S / BAY)), bw = S / bays;
    const X = piece.w * S, Z = piece.h * S;
    cubes.forEach(([x, y, l], i) => {
      const [cx, cy, cz] = centers[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (solid.has(`${x + dx},${y + dy},${l}`)) continue; // a wall inside the piece
        const at = (t, yy) => (dx ? [cx + dx * (h + e), yy, cz + t] : [cx + t, yy, cz + dy * (h + e)]);
        for (let f = 1; f < fl; f++) { const yy = cy - h + f * FH; L.push(...at(-h, yy), ...at(h, yy)); }
        if (solid.has(`${x},${y},${l + 1}`) && !solid.has(`${x + dx},${y + dy},${l + 1}`)) L.push(...at(-h, cy + h), ...at(h, cy + h));
        for (let f = 0; f < fl; f++) for (let b = 0; b < bays; b++) {
          const x0 = -h + b * bw + bw * 0.26, x1 = x0 + bw * 0.48, y0 = cy - h + f * FH + FH * 0.3, y1 = y0 + FH * 0.42;
          L.push(...at(x0, y0), ...at(x1, y0), ...at(x1, y0), ...at(x1, y1), ...at(x1, y1), ...at(x0, y1), ...at(x0, y1), ...at(x0, y0));
        }
      }
      if (isDark && !solid.has(`${x},${y},${l + 1}`)) {
        const x0 = cx - h, x1 = cx + h, z0 = cz - h, z1 = cz + h, top = cy + h + e;
        for (let t = -(X + Z) / 2 + HATCH / 2; t < (X + Z) / 2; t += HATCH) {
          const lo = Math.max(x0, z0 + t), hi = Math.min(x1, z1 + t);
          if (hi > lo) HL.push(lo, top, lo - t, hi, top, hi - t);
        }
      }
    });
  } else {
    const X = piece.w * PIECE_SCALE, Y = piece.z * PIECE_SCALE, Z = piece.h * PIECE_SCALE, e = 0.004;
    const box = new THREE.BoxGeometry(X, Y, Z), eg = new THREE.EdgesGeometry(box, 20);
    L.push(...eg.attributes.position.array); box.dispose(); eg.dispose();
    const floors = Math.max(1, Math.round(Y / FLOOR));
    for (const [w, d, sx] of [[X, Z / 2 + e, 0], [X, -Z / 2 - e, 0], [Z, X / 2 + e, 1], [Z, -X / 2 - e, 1]]) {
      const at = (t, y) => (sx ? [d, y, t] : [t, y, d]);
      const bays = Math.max(2, Math.round(w / BAY));
      for (let f = 1; f < floors; f++) { const y = -Y / 2 + (f * Y) / floors; L.push(...at(-w / 2, y), ...at(w / 2, y)); }
      for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
        const bw = w / bays, x0 = -w / 2 + b * bw + bw * 0.26, x1 = x0 + bw * 0.48, y0 = -Y / 2 + (f * Y) / floors + (Y / floors) * 0.3, y1 = y0 + (Y / floors) * 0.42;
        L.push(...at(x0, y0), ...at(x1, y0), ...at(x1, y0), ...at(x1, y1), ...at(x1, y1), ...at(x0, y1), ...at(x0, y1), ...at(x0, y0));
      }
    }
    if (isDark) for (let t = -(X + Z) / 2 + HATCH / 2; t < (X + Z) / 2; t += HATCH) {
      const lo = Math.max(-X / 2, t - Z / 2), hi = Math.min(X / 2, t + Z / 2);
      if (hi > lo) HL.push(lo, Y / 2 + e, lo - t, hi, Y / 2 + e, hi - t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(L, 3));
  let hatch = null;
  if (HL.length) { hatch = new THREE.BufferGeometry(); hatch.setAttribute("position", new THREE.Float32BufferAttribute(HL, 3)); }
  const out = { geo, hatch };
  LINE_GEO.set(key, out);
  return out;
}

export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  const mat = new THREE.MeshStandardMaterial({ color: isDark ? HEX.pieceDark : HEX.pieceLight, roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pieceId: piece.id, kind: "piece", isDark };
  // its drawing: white on the blue masses, navy on the white ones
  const det = detailGeometry(piece, isDark, isDisc);
  const lines = new THREE.LineSegments(det.geo, new THREE.LineBasicMaterial({ color: isDark ? 0xeef6ff : 0x0f2a52, transparent: true, opacity: isDark ? 0.62 : 0.72 }));
  lines.castShadow = false; lines.raycast = () => {};
  mesh.add(lines);
  if (det.hatch) { const h = new THREE.LineSegments(det.hatch, new THREE.LineBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.42 })); h.castShadow = false; h.raycast = () => {}; mesh.add(h); }
  // the outline: a heavier line round the whole mass, white or navy
  const shellGeo = isDisc
    ? new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, (DISC_DIAM * CABEZA_SCALE) / 2 + OUTLINE_T, DISC_H * CABEZA_SCALE + OUTLINE_T * 2, 48)
    : piece.vox
      ? makePolycubeSmooth(piece, PIECE_SCALE, EDGE_RADIUS + OUTLINE_T, OUTLINE_T)
      : makeRoundedBox(piece.w * PIECE_SCALE + OUTLINE_T * 2, piece.z * PIECE_SCALE + OUTLINE_T * 2, piece.h * PIECE_SCALE + OUTLINE_T * 2, EDGE_RADIUS + OUTLINE_T);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: isDark ? 0xeef6ff : 0x0f2a52, side: THREE.BackSide, shadowSide: THREE.BackSide }));
  shell.castShadow = true;
  shell.position.set(center.x, y + OUTLINE_T + SHELL_LIFT, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell", isDark };
  return { mesh, shell };
}

/* Each legal move: a frame in red pencil on the square, its corners
   ticked like a drawing's set-out marks; a crush is struck through with
   a cross as well. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group();
  const mats = [], geos = [];
  const quad = (pos) => {
    const geo = new THREE.BufferGeometry(), idx = [];
    for (let i = 0; i < pos.length / 12; i++) { const v = i * 4; idx.push(v, v + 2, v + 1, v, v + 3, v + 2); }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: isCrush ? 0xff6a4d : 0xff8f73, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false });
    mats.push(mat); geos.push(geo); group.add(new THREE.Mesh(geo, mat));
  };
  const bar = (ax, az, bx, bz, w) => {
    // a strip from a to b, w wide, flat on the board
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2);
    return [ax + nx, 0, az + nz, bx + nx, 0, bz + nz, bx - nx, 0, bz - nz, ax - nx, 0, az - nz];
  };
  const ix = hx * 0.86, iz = hz * 0.86, w = isCrush ? 0.075 : 0.058, pos = [];
  pos.push(...bar(-ix, -iz, ix, -iz, w), ...bar(ix, -iz, ix, iz, w), ...bar(ix, iz, -ix, iz, w), ...bar(-ix, iz, -ix, -iz, w));
  // set-out ticks just past each corner
  const k = 0.07;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(...bar(sx * ix, sz * (iz + k), sx * ix, sz * (iz + w / 2), w * 0.7), ...bar(sx * (ix + k), sz * iz, sx * (ix + w / 2), sz * iz, w * 0.7));
  if (isCrush) pos.push(...bar(-ix * 0.62, -iz * 0.62, ix * 0.62, iz * 0.62, 0.04), ...bar(ix * 0.62, -iz * 0.62, -ix * 0.62, iz * 0.62, 0.04));
  quad(pos);
  // a light wash of red pencil inside the frame, so the square reads at a glance
  const tint = new THREE.Mesh(new THREE.PlaneGeometry(ix * 2 - w, iz * 2 - w), new THREE.MeshBasicMaterial({ color: isCrush ? 0xff6a4d : 0xff8f73, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false }));
  tint.rotation.x = -Math.PI / 2; tint.position.y = -0.001; group.add(tint); geos.push(tint.geometry);
  const tintMat = tint.material;
  group.position.set(cx, 0.03, cz);
  return {
    root: group,
    setOpacity(v) { mats.forEach((m) => { m.opacity = v; }); tintMat.opacity = v * (isCrush ? 0.2 : 0.14); },
    tick() {},
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); tintMat.dispose(); },
  };
}

/* ------------------------------------------------------------ the game, for the scene */

// What plano-fx.js needs to know of the game: the piece picked up, which
// it draws round in red pencil. Filled from the chassis's game facts.
export const PLAY = { selectedId: null };
export function useSetupExtras({ game }) {
  PLAY.selectedId = game ? game.selectedId : null;
  return {};
}

/* ------------------------------------------------------------ words, fonts, UI */

/* The dock, said in a drawing office's words (chassis DOCK_WORDS). */
export const dockWords = {
  views: ["Street", "Plan", "Site"],
  endGame: "Roll up the plans",
  newGame: "A fresh sheet",
  moveLog: "Revision log",
  replay: "Replay a sheet",
  plainRules: "General notes",
  nextGame: "Next sheet",
  endedCaption: "Plans rolled up.",
  wonCaption: "Approved.",
};

export function renderGlobalDefs() {
  return null;
}

/* Fonts: Architects Daughter (an architect's hand lettering) for the
   title and the big buttons, IBM Plex Mono for the drawing's small print.
   The title in white line, the big button stamped like a title block. */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  .ec-title { color: #EEF6FF; letter-spacing: 0.04em; text-shadow: 0 0 1px rgba(238,246,255,0.6); }
  [data-dock-role="primary"] { font-family: 'Architects Daughter', 'IBM Plex Mono', monospace !important; letter-spacing: 0.12em !important;
    color: #0F2A52 !important; background: #EEF6FF !important; border: 2px solid #EEF6FF !important; border-radius: 0 !important;
    box-shadow: 0 0 0 3px #1d4c8a, 0 0 0 4.5px rgba(238,246,255,0.7) !important; }
  [data-dock-role="caption"] { font-family: 'IBM Plex Mono', monospace !important; font-style: normal !important; letter-spacing: 0.18em; text-transform: uppercase; font-size: 11px !important; color: #A9C6EC !important; }
`;

/* ------------------------------------------------------------ scene life, sound, names */

export { mountAmbientEffects } from "./plano-fx.js";
// The reality's name, at the top of the info panel's This game tab, as in
// the Other realities menu (themes/realities.js WORLDS).
export const realityName = "Plano";
export { createAudio, hasAudio } from "./plano-audio.js";
// The in-game menu offers a switch for the cost badges on the move markers.
export const moveCostToggle = true;

import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("plano");
export const pointsGlow = pointsGlowFor("plano");
