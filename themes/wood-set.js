/* The game as sold in 1975: the folding hardwood board (walnut and maple
   squares under lacquer, a walnut frame, brass latches and hinges) and the
   hand-finished wooden blocks (walnut for Dark, olive ash for Light). The
   copy on Tienda's display table and the one taken home to the den
   (Standard) are the same set: this module draws it for both.

   createWoodSet({ env, quality, lights }) gives one theme its set: env()
   is what the lacquer and brass reflect (the store, or the den), quality()
   the device tier (tienda-quality.js), lights the room's light rig (for
   the side buttons' wood swatches). The theme hands the chassis the
   set's board texture, slab materials, grid, pieces, move markers and
   board features; its scene code adds the brass and keeps the grain
   turning with the rolls (followGrain). */

import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE, OFF_X, OFF_Z, SLAB_THICKNESS,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE,
} from "../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";

export const EDGE_RADIUS = 0.055;
export const OUTLINE_T = 0.009;

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

/* ------------------------------------------------------------ the woods */

const WOOD = {
  maple: { base: "#B8935E", grain: "#8A6538", figure: "#A5804E" },
  walnut: { base: "#744429", grain: "#3E2415", figure: "#58331E" },
  frame: { base: "#4E2F1A", grain: "#26160C", figure: "#3A2213" },
};

export const WOODS = {
  dark: { light: "#4E2F1B", dark: "#24130A", streak: "#3A2213", ringFreq: 7.5, gloss: 0.5 }, // walnut
  light: { light: "#B08A55", dark: "#6E4E28", streak: "#957343", ringFreq: 5.5, gloss: 0.45 }, // olive ash
};

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

/* ------------------------------------------------------------ one theme's set */

export function createWoodSet({ env, quality, lights }) {

  /* The folding board's top: walnut and maple squares, each square's grain
     turned a quarter from its neighbours' (inlaid veneer), a light and a
     dark stringing line round the field, a walnut frame, and the fold
     across the middle. Colour, plus a roughness map (the lacquer is a
     touch duller in the seam and the stringing) hung on
     userData.roughnessMap for buildSlabMaterials. */

  function makeBoardTexture() {
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
    const base = { roughness: 0.42, metalness: 0, envMap: env(), envMapIntensity: 0.55, ...extra };
    return q.physical ? new THREE.MeshPhysicalMaterial({ clearcoat: 0.55, clearcoatRoughness: 0.28, ...base }) : new THREE.MeshStandardMaterial(base);
  }

  function buildSlabMaterials(boardTex) {
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
  function makeGrid() {
    const group = new THREE.Group();
    const b = [-OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, -OFF_Z, OFF_X, 0, OFF_Z, OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, OFF_Z, -OFF_X, 0, -OFF_Z];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
    const border = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1e1109, transparent: true, opacity: 0.55 }));
    border.position.y = 0.05; // clears the top face's polygon offset (see themes/standard.js)
    group.add(border);
    return group;
  }

  /* The blocks are real wood, grain and all: a procedural 3D wood in the
     fragment shader, sampled at the block's own (object-space) position,
     so end grain shows rings and the long faces show stripes, and the
     grain turns with the block as it rolls. The chassis rebuilds a
     piece's mesh after every move (axis-aligned again), so each piece's
     accumulated turn is kept here (grainTurns, updated by tienda-fx.js
     when a roll lands) and the new mesh samples its wood through it: the
     grain carries on from where the roll left it. */

  const grainTurns = new Map(); // pieceId -> THREE.Matrix3 (object -> original block frame)


  function woodMaterial({ isDark, pieceId }) {
    const w = isDark ? WOODS.dark : WOODS.light;
    const q = quality();
    const mat = q.physical
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.46, metalness: 0, clearcoat: w.gloss, clearcoatRoughness: 0.32, envMap: env(), envMapIntensity: 0.5 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, envMap: env(), envMapIntensity: 0.55 });
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
  function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
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

  /* Where a piece can go: a frame like a brass inlay, gold with a dark
     edge so it reads on maple and walnut alike. A crush is a heavier frame
     in faded red with a second one inside. */
  function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
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

  /* A missing square: the square cut clean out of the board. Looking in,
     the four walls show the board's plywood (its plies in stripes, the lit
     wall lighter, the one in shadow darker) and at the bottom, in the
     board's shadow, the display table's Formica. Painted on a flush square
     (the board itself isn't cut), so it reads the same from every side. */
  let CUT_TEX = null;
  function cutTexture() {
    if (CUT_TEX) return CUT_TEX;
    const S = 256, d = Math.round(S * 0.17);
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const r = rng(1975);
    // The floor: the table's walnut-pattern Formica, deep in shadow.
    g.fillStyle = "#2b1c11"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${95 + r() * 30},${62 + r() * 20},${36 + r() * 12},${0.25 + r() * 0.2})`;
      g.lineWidth = 1 + r() * 2;
      const y = d + r() * (S - 2 * d);
      g.beginPath(); g.moveTo(d, y);
      for (let x = d; x <= S - d; x += 12) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
      g.stroke();
    }
    const floorShade = g.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.5);
    floorShade.addColorStop(0, "rgba(0,0,0,0.15)"); floorShade.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = floorShade; g.fillRect(d, d, S - 2 * d, S - 2 * d);
    // The walls: plywood plies, stripes parallel to the board's face.
    const plies = ["#C9A878", "#8E6A40", "#B99562", "#6E4E2C", "#C4A070", "#8A653A", "#B08A58"];
    const wall = (pts, horizontal, shade) => {
      g.save();
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
      const n = plies.length;
      for (let k = 0; k < n; k++) {
        g.fillStyle = plies[k];
        const t0 = (k / n) * d, t1 = ((k + 1) / n) * d;
        if (horizontal === "top") g.fillRect(0, t0, S, t1 - t0 + 0.5);
        if (horizontal === "bottom") g.fillRect(0, S - t1, S, t1 - t0 + 0.5);
        if (horizontal === "left") g.fillRect(t0, 0, t1 - t0 + 0.5, S);
        if (horizontal === "right") g.fillRect(S - t1, 0, t1 - t0 + 0.5, S);
      }
      g.fillStyle = `rgba(20,12,6,${shade})`; g.fillRect(0, 0, S, S);
      g.restore();
    };
    wall([[0, 0], [S, 0], [S - d, d], [d, d]], "top", 0.05);
    wall([[S, 0], [S, S], [S - d, S - d], [S - d, d]], "right", 0.3);
    wall([[0, 0], [d, d], [d, S - d], [0, S]], "left", 0.38);
    wall([[0, S], [d, S - d], [S - d, S - d], [S, S]], "bottom", 0.55);
    // The cut edge of the veneer: a bright lip where the light catches it.
    g.strokeStyle = "rgba(255,236,200,0.55)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(1.5, S - 1.5); g.lineTo(1.5, 1.5); g.lineTo(S - 1.5, 1.5); g.stroke();
    g.strokeStyle = "rgba(20,12,6,0.6)";
    g.beginPath(); g.moveTo(S - 1.5, 1.5); g.lineTo(S - 1.5, S - 1.5); g.lineTo(1.5, S - 1.5); g.stroke();
    CUT_TEX = new THREE.CanvasTexture(c);
    return CUT_TEX;
  }
  function buildMissingSquareVisual({ center }) {
    const size = SQUARE_SIZE * 0.985;
    const mat = new THREE.MeshBasicMaterial({ map: cutTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(center.x, 0.004, center.z);
    m.name = "tienda-cut-square";
    return m;
  }

  /* A black hole: a pocket let into the board, lined with black felt, with
     a brass ring round its mouth, like the ball traps of the tabletop games
     of the time. The two of a pair look alike. */
  let POCKET_TEX = null;
  function pocketTexture() {
    if (POCKET_TEX) return POCKET_TEX;
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const r = rng(419);
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); g.clip();
    const felt = g.createRadialGradient(S * 0.46, S * 0.44, S * 0.04, S / 2, S / 2, S / 2);
    felt.addColorStop(0, "#030202"); felt.addColorStop(0.65, "#0c0806"); felt.addColorStop(1, "#24170f");
    g.fillStyle = felt; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${60 + r() * 40},${40 + r() * 30},${30 + r() * 20},${0.04 + r() * 0.06})`;
      g.fillRect(r() * S, r() * S, 1, 1);
    }
    // The far lip of the pocket catching a little light.
    g.strokeStyle = "rgba(120,86,52,0.35)"; g.lineWidth = 6;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    POCKET_TEX = new THREE.CanvasTexture(c);
    return POCKET_TEX;
  }
  function buildBlackHoleVisual({ center, radius }) {
    const q = quality();
    const group = new THREE.Group();
    group.name = "tienda-pocket";
    const pocket = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshBasicMaterial({ map: pocketTexture(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 })
    );
    pocket.rotation.x = -Math.PI / 2;
    pocket.position.set(center.x, 0.004, center.z);
    const brass = q.physical
      ? new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.34, envMap: env(), envMapIntensity: 1.1 })
      : new THREE.MeshLambertMaterial({ color: 0xc9a24a });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.04, radius * 0.085, 12, 56), brass);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.z = 0.55; // a low, flat ring
    ring.position.set(center.x, 0.012, center.z);
    ring.castShadow = true;
    group.add(pocket, ring);
    return group;
  }


  /* Brass on the board's frame: latch plates at the middle of the two long
     edges, and the hinge barrels at the ends of the fold. */
  function buildBrass() {
    const q = quality();
    const group = new THREE.Group();
    group.name = "wood-set-brass";
    const mat = q.physical
      ? new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.34, envMap: env(), envMapIntensity: 1.1 })
      : new THREE.MeshLambertMaterial({ color: 0xc9a24a });
    const y = -SLAB_THICKNESS / 2;
    const plate = (x, z, ry) => {
      const g = new THREE.BoxGeometry(1.1, SLAB_THICKNESS * 0.62, 0.05);
      const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; group.add(m);
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.09), mat); k.position.set(x, y + 0.02, z); k.rotation.y = ry; group.add(k);
    };
    plate(0, SLAB_Z / 2 + 0.025, 0);
    plate(0, -SLAB_Z / 2 - 0.025, 0);
    [-1, 1].forEach((s) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.3, 12), mat);
      c.rotation.x = Math.PI / 2; c.position.set(s * (SLAB_X / 2 + 0.07), y + SLAB_THICKNESS * 0.1, 0); group.add(c);
    });
    return {
      group,
      dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); mat.dispose(); },
    };
  }

  /* Wood grain that follows a roll. The chassis rebuilds a piece's mesh
     after every move; when a piece's new mesh replaces one that ended
     turned, the turn is kept in grainTurns and the new mesh's wood is
     sampled through it. Call every frame with the chassis's three refs. */
  const seen = new Map(); // pieceId -> { mesh, rel: THREE.Quaternion }
  const qBoard = new THREE.Quaternion(), qMesh = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), m3 = new THREE.Matrix3();
  function snapTurn(quat) {
    mTmp.makeRotationFromQuaternion(quat);
    const e = mTmp.elements;
    // Round to the nearest quarter-turn rotation; identity means no roll.
    let identity = true;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const v = Math.round(e[c * 4 + r]);
      e[c * 4 + r] = v;
      if (v !== (r === c ? 1 : 0)) identity = false;
    }
    return identity ? null : m3.setFromMatrix4(mTmp).clone();
  }
  function followGrain(t) {
    if (!t.pieceGroup || !t.boardGroup) return;
    t.boardGroup.getWorldQuaternion(qBoard).invert();
    const live = new Set();
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId;
      live.add(id);
      const rec = seen.get(id);
      if (rec && rec.mesh !== o) {
        // A new mesh for this piece: if the old one ended turned, the
        // block rolled; carry the grain through the turn.
        const R = snapTurn(rec.rel);
        if (R) {
          const prev = grainTurns.get(id) || new THREE.Matrix3();
          const next = prev.clone().multiply(R.transpose());
          grainTurns.set(id, next);
          const u = o.material && o.material.userData && o.material.userData.wood;
          if (u) u.uGrainTurn.value.copy(next);
        }
      }
      o.getWorldQuaternion(qMesh);
      const rel = qBoard.clone().multiply(qMesh);
      seen.set(id, { mesh: o, rel });
    });
    // Pieces gone (crushed, or a new game): forget them.
    seen.forEach((v, id) => { if (!live.has(id)) seen.delete(id); });
  }

  /* A strip of each side's wood, for the buttons and chips that stand for
     a side (chassis: theme.sideSurface): the long face of a block, square
     on, in the pieces' own material under the room's lights and the
     game's renderer settings, so the button is the piece's wood. Taken
     once per side (one short-lived context each), as a data URL; null
     without WebGL, and the buttons keep their flat colours. */
  const SWATCH_W = 480, SWATCH_H = 120;
  const swatches = {};
  function woodSwatch(isDark) {
    const k = isDark ? "dark" : "light";
    if (k in swatches) return swatches[k];
    swatches[k] = null;
    let renderer = null, geo = null, mat = null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = SWATCH_W; canvas.height = SWATCH_H;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(SWATCH_W, SWATCH_H, false);
      // As the game's renderer (chassis/ElCabeza3D.jsx).
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor(0x000000, 0);
      const L = lights;
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(L.ambient.color, L.ambient.intensity));
      scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
      const key = new THREE.DirectionalLight(L.key.color, L.key.intensity); key.position.set(-3, 6, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(L.fill.color, L.fill.intensity); fill.position.set(5, 2, 3); scene.add(fill);
      const back = new THREE.DirectionalLight(L.back.color, L.back.intensity); back.position.set(2, 4, -5); scene.add(back);
      // 2.4 x 0.6 of wood, lying where a block's front face would.
      const aspect = SWATCH_W / SWATCH_H, hh = 0.3;
      geo = new THREE.PlaneGeometry(hh * 2 * aspect, hh * 2);
      geo.translate(0.35, 0.1, 0.4);
      mat = woodMaterial({ isDark, pieceId: `swatch-${k}` });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-0.35, -0.1, -0.4);
      scene.add(mesh);
      const camera = new THREE.OrthographicCamera(-hh * aspect, hh * aspect, hh, -hh, 0.1, 10);
      camera.position.set(0, 0, 3);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      swatches[k] = canvas.toDataURL("image/jpeg", 0.86);
    } catch (e) {
      swatches[k] = null;
    } finally {
      if (geo) geo.dispose();
      if (mat) mat.dispose();
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    }
    return swatches[k];
  }

  return {
    makeBoardTexture, buildSlabMaterials, makeGrid,
    grainTurns, woodMaterial, buildPieceVisual, buildMoveIndicator,
    buildMissingSquareVisual, buildBlackHoleVisual,
    buildBrass, followGrain, woodSwatch,
  };
}
