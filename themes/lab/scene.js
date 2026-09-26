/* Theme Lab: the 3-D presentation of one design direction.

   The chassis asks a theme for its board (texture, slab materials,
   grid), its pieces, its legal-move markers, its black holes and missing
   squares. These are those hooks, driven by a spec from specs.js. They
   only decide how things look: where anything is, and whether a move is
   legal, the chassis and the engine decide. */

import * as THREE from "three";
import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_THICKNESS, SQUARE_SIZE, OFF_X, OFF_Z,
  DISC_DIAM, DISC_H, PIECE_SCALE, CABEZA_SCALE, PIECE_META,
} from "../../engine/constants.js";
import { makeRoundedBox, makePolycubeSmooth, voxCubeCenters } from "../../engine/geometry.js";
import { paintBoard, pieceSurface, markTexture, squareName, paintGroundSheet } from "./paint.js";

const hex = (css) => new THREE.Color(css).getHex();

/* Many flat or raised boxes as one geometry: grids made of real strips
   and bars stay one draw call. Each box: centre x/z, width (x), depth
   (z), height, and base y. The bottom face is left off (never seen). */
function boxesGeometry(boxes) {
  const pos = [], nor = [], idx = [];
  let v = 0;
  const quad = (a, b, c, d, n) => {
    pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) nor.push(...n);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  };
  boxes.forEach(({ x, z, w, d, h, y = 0 }) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = y, y1 = y + h;
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    if (h > 0) {
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* Every grid line (both directions, borders included) as boxes of the
   given width/height, lifted to y. */
function gridLines(width, height, y, { borders = true, skipInner = false } = {}) {
  const boxes = [];
  for (let i = 0; i <= BOARD_COLS; i++) {
    const edge = i === 0 || i === BOARD_COLS;
    if ((edge && !borders) || (!edge && skipInner)) continue;
    boxes.push({ x: i * SQUARE_SIZE - OFF_X, z: 0, w: width, d: OFF_Z * 2 + width, h: height, y });
  }
  for (let i = 0; i <= BOARD_ROWS; i++) {
    const edge = i === 0 || i === BOARD_ROWS;
    if ((edge && !borders) || (!edge && skipInner)) continue;
    boxes.push({ x: 0, z: i * SQUARE_SIZE - OFF_Z, w: OFF_X * 2 + width, d: width, h: height, y });
  }
  return boxes;
}

/* The colour of each ground's far underlay (its sheet's own base). */
const UNDERLAY = { console: "#0E1C33", machine: "#2A2927", diagonalPlanes: "#1C2127", plinth: "#8B877F", mondrian: "#F4F2EC" };

export function createScene(spec) {
  const C = spec.colors;
  const P = spec.pieces;
  const EDGE_RADIUS = P.edgeRadius;
  const OUT = P.outline ? P.outline.t : 0;

  /* ---------------- board */
  function makeBoardTexture() { return paintBoard(spec); }

  function buildSlabMaterials(boardTex) {
    const B = spec.board;
    const Top = B.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const top = new Top({
      map: boardTex, roughness: B.roughness ?? 0.8, metalness: B.metalness ?? 0,
      ...(B.clearcoat ? { clearcoat: B.clearcoat, clearcoatRoughness: 0.2 } : {}),
      polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 3,
    });
    const side = () => new THREE.MeshStandardMaterial({ color: B.sideColor, roughness: Math.min(1, (B.roughness ?? 0.8) + 0.05), metalness: B.metalness ?? 0 });
    return [side(), side(), top, side(), side(), side()];
  }

  function makeGrid() {
    const group = new THREE.Group();
    const G = spec.board.grid;
    const col = hex(C.boardGrid);
    const op = spec.board.gridOpacity;
    const add = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.receiveShadow = true; group.add(m); return m; };
    const flat = (o = op, c = col) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
    if (G === "hairline") {
      add(boxesGeometry(gridLines(0.012, 0, 0.05)), flat(), "grid-lines");
      add(boxesGeometry(gridLines(0.03, 0, 0.051, { skipInner: true })), flat(1), "grid-border");
    } else if (G === "ink") {
      add(boxesGeometry(gridLines(0.022, 0, 0.05)), flat(), "grid-lines");
      add(boxesGeometry(gridLines(0.05, 0, 0.051, { skipInner: true })), flat(1), "grid-border");
    } else if (G === "bars") {
      // De Stijl: the black structure stands up out of the enamel.
      const mat = new THREE.MeshPhysicalMaterial({ color: 0x0e0e0e, roughness: 0.3, clearcoat: 0.8 });
      const bars = add(boxesGeometry(gridLines(0.085, 0.07, 0)), mat, "grid-bars");
      bars.castShadow = true;
    } else if (G === "machined") {
      add(boxesGeometry(gridLines(0.018, 0, 0.05)), flat(0.75, 0x1c2127), "grid-lines");
      const hi = boxesGeometry(gridLines(0.008, 0, 0.051).map((b) => ({ ...b, x: b.x + 0.014, z: b.z + 0.014 })));
      add(hi, flat(0.5, 0xffffff), "grid-highlight");
    } else if (G === "groove") {
      add(boxesGeometry(gridLines(0.045, 0, 0.05)), flat(0.62, 0x1d1b19), "grid-lines");
      const hi = boxesGeometry(gridLines(0.012, 0, 0.051).map((b) => ({ ...b, x: b.x + 0.03, z: b.z + 0.03 })));
      add(hi, flat(0.28, 0xffffff), "grid-highlight");
    } else if (G === "engraved") {
      add(boxesGeometry(gridLines(0.01, 0, 0.05)), flat(op, 0xaec2e2), "grid-lines");
      add(boxesGeometry(gridLines(0.035, 0, 0.051, { skipInner: true })), flat(1, hex(C.accentPrimary)), "grid-border");
    } else if (G === "thick") {
      add(boxesGeometry(gridLines(0.06, 0, 0.05)), flat(1, 0x000000), "grid-lines");
    } else if (G === "crosshair") {
      // Only the crossings, as tiny crosses; the lines themselves are gone.
      const boxes = [];
      const arm = SQUARE_SIZE * 0.07, t = 0.008;
      for (let i = 0; i <= BOARD_COLS; i++) for (let j = 0; j <= BOARD_ROWS; j++) {
        const x = i * SQUARE_SIZE - OFF_X, z = j * SQUARE_SIZE - OFF_Z;
        boxes.push({ x, z, w: arm * 2, d: t, h: 0, y: 0.05 }, { x, z, w: t, d: arm * 2, h: 0, y: 0.05 });
      }
      add(boxesGeometry(boxes), flat(op, 0x000000), "grid-ticks");
    } else if (G === "channels") {
      // Fusion: deep structural channels, dark and raised, a Swiss-thin
      // measure line along each.
      const mat = new THREE.MeshStandardMaterial({ color: 0x252422, roughness: 0.7, metalness: 0.4 });
      const ch = add(boxesGeometry(gridLines(0.075, 0.055, 0)), mat, "grid-channels");
      ch.castShadow = true;
      add(boxesGeometry(gridLines(0.008, 0, 0.0565)), flat(0.9, hex(C.accentSecondary)), "grid-measure");
    }
    return group;
  }

  /* ---------------- pieces */
  function pieceMaterial(isDark) {
    const m = isDark ? P.dark : P.light;
    const Mat = m.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const mat = new Mat({
      color: m.color, roughness: m.roughness, metalness: m.metalness || 0,
      ...(m.clearcoat ? { clearcoat: m.clearcoat, clearcoatRoughness: 0.08 } : {}),
    });
    const tex = pieceSurface(m.texture);
    if (tex) mat.map = tex;
    return mat;
  }

  /* The face on top of a piece at rest, in its own frame: where to put
     the printed mark, and how big. */
  function topFace(piece, isDisc) {
    if (isDisc) return { x: 0, y: (DISC_H * CABEZA_SCALE) / 2, z: 0, w: DISC_DIAM * CABEZA_SCALE * 0.72, d: DISC_DIAM * CABEZA_SCALE * 0.72 };
    if (piece.vox) {
      const cs = voxCubeCenters(piece, PIECE_SCALE);
      const topY = Math.max(...cs.map((c) => c[1]));
      const c = cs.filter((q) => Math.abs(q[1] - topY) < 1e-4).sort((a, b) => a[2] - b[2] || a[0] - b[0])[0];
      return { x: c[0], y: c[1] + PIECE_SCALE / 2, z: c[2], w: PIECE_SCALE * 0.9, d: PIECE_SCALE * 0.9 };
    }
    return { x: 0, y: (piece.z * PIECE_SCALE) / 2, z: 0, w: piece.w * PIECE_SCALE * 0.9, d: piece.h * PIECE_SCALE * 0.9 };
  }

  function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
    const mesh = new THREE.Mesh(geo, pieceMaterial(isDark));
    mesh.position.set(center.x, y, center.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { pieceId: piece.id, kind: "piece" };

    if (P.mark) {
      const f = topFace(piece, isDisc);
      const meta = PIECE_META[piece.type] || { label: "?" };
      const tex = markTexture(spec, P.mark, {
        label: meta.label, owner: piece.owner, type: piece.type,
        square: Number.isFinite(piece.row) && Number.isFinite(piece.col) ? squareName(piece.row, piece.col) : "", w: Math.max(1, Math.round(f.w / f.d)), h: Math.max(1, Math.round(f.d / f.w)),
        isCabeza: piece.type === "cabeza",
      });
      if (tex) {
        const g2 = isDisc ? new THREE.CircleGeometry(f.w / 2, 40) : new THREE.PlaneGeometry(f.w, f.d);
        const m2 = new THREE.MeshStandardMaterial({
          map: tex, transparent: true, roughness: (isDark ? P.dark : P.light).roughness, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false,
        });
        const decal = new THREE.Mesh(g2, m2);
        decal.rotation.x = -Math.PI / 2;
        // Each side's marks read upright from its own end of the board.
        if (isDark) decal.rotation.z = Math.PI;
        decal.position.set(f.x, f.y + 0.002, f.z);
        decal.userData = { kind: "mark" };
        mesh.add(decal);
        mesh.addEventListener("removed", () => { g2.dispose(); m2.dispose(); });
      }
    }

    let shell;
    if (P.outline) {
      const T = OUT;
      const shellGeo = isDisc
        ? new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2 + T, (DISC_DIAM * CABEZA_SCALE) / 2 + T, DISC_H * CABEZA_SCALE + T * 2, 40)
        : piece.vox
          ? makePolycubeSmooth(piece, PIECE_SCALE, EDGE_RADIUS + T, T)
          : makeRoundedBox(piece.w * PIECE_SCALE + T * 2, piece.z * PIECE_SCALE + T * 2, piece.h * PIECE_SCALE + T * 2, EDGE_RADIUS + T);
      shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: isDark ? P.outline.dark : P.outline.light, side: THREE.BackSide, shadowSide: THREE.BackSide }));
      shell.castShadow = true;
      shell.position.set(center.x, y + T, center.z);
    } else {
      shell = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
      shell.position.set(center.x, y, center.z);
    }
    shell.userData = { pieceId: piece.id, kind: "shell" };
    return { mesh, shell };
  }

  /* ---------------- legal moves */
  const dirVec = (dir) => {
    const s = String(dir || "");
    const m = s.match(/(?:^|[^A-Za-z])([NS]?[EW]?)(?:$|[^A-Za-z])/) || s.match(/([NSEW]{1,2})$/);
    const d = (m && m[1]) || "";
    return { x: (d.includes("E") ? 1 : 0) - (d.includes("W") ? 1 : 0), z: (d.includes("S") ? 1 : 0) - (d.includes("N") ? 1 : 0) };
  };

  function buildMoveIndicator({ cx, cz, hx, hz, isCrush, dir }) {
    const root = new THREE.Group();
    root.position.set(cx, 0, cz);
    const mats = [], geos = [];
    const basic = (color, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, ...extra }); mats.push(m); return m; };
    const mesh = (geo, mat, y = 0.056) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.y = y; root.add(m); return m; };
    const flatGeo = (boxes) => boxesGeometry(boxes.map((b) => ({ h: 0, y: 0, ...b })));
    const accent = hex(C.accentPrimary);
    const K = spec.indicator;
    let tick = () => {};
    let level = 0;

    if (K === "corners") {
      // Swiss: four red corner marks, exact, no fill.
      const l = Math.min(hx, hz) * 0.42, t = isCrush ? 0.05 : 0.03;
      const bx = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        bx.push({ x: sx * (hx - l / 2), z: sz * (hz - t / 2), w: l, d: t }, { x: sx * (hx - t / 2), z: sz * (hz - l / 2), w: t, d: l });
      });
      mesh(flatGeo(bx), basic(accent));
      if (isCrush) mesh(flatGeo([{ x: 0, z: 0, w: hx * 0.5, d: 0.03 }, { x: 0, z: 0, w: 0.03, d: hz * 0.5 }]), basic(accent));
    } else if (K === "triangle") {
      // Bauhaus: a yellow triangle pointing the way the piece goes.
      const v = dirVec(dir);
      const s = Math.min(hx, hz) * (isCrush ? 1.2 : 0.95);
      const shape = new THREE.Shape();
      shape.moveTo(0, s * 0.62); shape.lineTo(s * 0.56, -s * 0.38); shape.lineTo(-s * 0.56, -s * 0.38); shape.closePath();
      const tri = mesh(new THREE.ShapeGeometry(shape), basic(isCrush ? hex(C.accentPrimary) : hex(C.accentTertiary)));
      tri.rotation.x = -Math.PI / 2;
      tri.rotation.z = Math.atan2(-v.x, -v.z) + Math.PI;
    } else if (K === "recess") {
      // De Stijl: the field sinks, lined in yellow.
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.9, d: hz * 1.9 }]), basic(0x0e0e0e, {}), 0.052);
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.7, d: hz * 1.7 }]), basic(isCrush ? hex(C.accentPrimary) : hex(C.accentTertiary)), 0.054);
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.45, d: hz * 1.45 }]), basic(0xf6f5f0), 0.056);
    } else if (K === "vector") {
      // Elementarism: a vector from the piece's side of the square, with
      // a parallelogram head, in signal orange.
      const v = dirVec(dir);
      const ang = Math.atan2(v.x, v.z);
      const L = Math.max(hx, hz) * 1.6, t = isCrush ? 0.07 : 0.045;
      const g = new THREE.Group(); g.rotation.y = ang; root.add(g);
      const shaft = new THREE.Mesh(boxesGeometry([{ x: 0, z: -L * 0.2, w: t, d: L * 0.8, h: 0, y: 0 }]), basic(accent));
      const head = new THREE.Shape();
      const hs = Math.min(hx, hz) * 0.42;
      head.moveTo(-hs, 0); head.lineTo(0, hs * 0.9); head.lineTo(hs, 0); head.lineTo(hs, -hs * 0.35); head.lineTo(0, hs * 0.55); head.lineTo(-hs, -hs * 0.35); head.closePath();
      const hg = new THREE.ShapeGeometry(head); geos.push(hg, shaft.geometry);
      const hm = new THREE.Mesh(hg, basic(accent)); hm.rotation.x = -Math.PI / 2; hm.position.z = L * 0.2;
      shaft.position.y = hm.position.y = 0.056;
      g.add(shaft, hm);
      const base = Math.atan2(1, 1);
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.4, d: 0.012 }]), basic(0x1c2127)).rotation.y = base;
    } else if (K === "block") {
      // Brutalism: a thick black frame, and a solid block for a crush.
      const t = isCrush ? hx : 0.09;
      mesh(boxesGeometry([
        { x: 0, z: -hz + t / 2, w: hx * 2, d: t, h: 0.03, y: 0 }, { x: 0, z: hz - t / 2, w: hx * 2, d: t, h: 0.03, y: 0 },
        { x: -hx + t / 2, z: 0, w: t, d: hz * 2, h: 0.03, y: 0 }, { x: hx - t / 2, z: 0, w: t, d: hz * 2, h: 0.03, y: 0 },
      ]), basic(isCrush ? hex(C.accentSecondary) : 0x111111), 0.05);
    } else if (K === "glyph") {
      // New Typography: a red square bullet and a rule, set on the page.
      const s = Math.min(hx, hz) * 0.36;
      mesh(flatGeo([{ x: 0, z: 0, w: s, d: s }]), basic(accent));
      mesh(flatGeo([{ x: 0, z: hz * 0.62, w: hx * 1.4, d: 0.02 }]), basic(0x141210));
      if (isCrush) mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.7, d: 0.05 }]), basic(accent));
    } else if (K === "brackets") {
      // Corporate Swiss: yellow bracket pairs and a centre tick.
      const t = 0.028, l = hz * 0.5;
      mesh(flatGeo([
        { x: -hx + t / 2, z: 0, w: t, d: l * 2 }, { x: -hx + 0.07, z: -l + t / 2, w: 0.14, d: t }, { x: -hx + 0.07, z: l - t / 2, w: 0.14, d: t },
        { x: hx - t / 2, z: 0, w: t, d: l * 2 }, { x: hx - 0.07, z: -l + t / 2, w: 0.14, d: t }, { x: hx - 0.07, z: l - t / 2, w: 0.14, d: t },
        { x: 0, z: 0, w: 0.12, d: t }, { x: 0, z: 0, w: t, d: 0.12 },
      ]), basic(isCrush ? 0xff5a36 : accent));
    } else if (K === "pop") {
      // Neo-brutalism: a mint tile with a black edge and a hard shadow.
      mesh(flatGeo([{ x: hx * 0.12, z: hz * 0.12, w: hx * 1.6, d: hz * 1.6 }]), basic(0x000000), 0.052);
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.6, d: hz * 1.6 }]), basic(0x000000), 0.054);
      mesh(flatGeo([{ x: 0, z: 0, w: hx * 1.45, d: hz * 1.45 }]), basic(isCrush ? hex(C.accentPrimary) : 0x9ff0c8), 0.056);
    } else if (K === "crosshair") {
      // Minimal Mono: a small cross; a crush adds a hairline ring.
      const a = Math.min(hx, hz) * 0.22;
      mesh(flatGeo([{ x: 0, z: 0, w: a * 2, d: 0.012 }, { x: 0, z: 0, w: 0.012, d: a * 2 }]), basic(0x000000));
      if (isCrush) { const rg = new THREE.RingGeometry(a * 1.5, a * 1.5 + 0.014, 48); const r = mesh(rg, basic(0x000000)); r.rotation.x = -Math.PI / 2; }
    } else if (K === "slide") {
      // Fusion: a plate slides out from under the board toward the square
      // as the marker comes up, a yellow tongue with a red index.
      const v = dirVec(dir);
      const plate = new THREE.Group(); root.add(plate);
      const pg = boxesGeometry([{ x: 0, z: 0, w: hx * 1.7, d: hz * 1.7, h: 0.02, y: 0 }]);
      const ig = boxesGeometry([{ x: 0, z: 0, w: hx * 0.5, d: 0.05, h: 0.001, y: 0.02 }]);
      geos.push(pg, ig);
      const pm = basic(isCrush ? hex(C.accentPrimary) : hex(C.accentSecondary));
      plate.add(new THREE.Mesh(pg, pm));
      const im = new THREE.Mesh(ig, basic(isCrush ? 0xf2b705 : hex(C.accentPrimary)));
      plate.add(im);
      plate.position.y = 0.035;
      const from = { x: -v.x * SQUARE_SIZE * 0.9, z: -v.z * SQUARE_SIZE * 0.9 };
      let shown = 0;
      tick = () => {
        shown += (level - shown) * 0.18;
        const k = 1 - Math.pow(1 - Math.min(1, shown), 3);
        plate.position.x = from.x * (1 - k);
        plate.position.z = from.z * (1 - k);
      };
    }

    return {
      root,
      // The chassis's hot/cold opacity (about 0.35 cold, 0.9 hot) is
      // pushed up: these markers are printed and painted things, and at
      // a third of their strength they read as stains.
      setOpacity(v) { level = v > 0.02 ? 1 : 0; mats.forEach((m) => { m.opacity = Math.min(1, v * 2.1); }); },
      tick(now) { tick(now); },
      dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); root.traverse((o) => { if (o.geometry && !geos.includes(o.geometry)) o.geometry.dispose(); }); },
    };
  }

  /* ---------------- black holes and missing squares, in the theme's terms */
  function buildBlackHoleVisual({ center, radius }) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color: hex(spec.id === "minimalMono" ? "#000000" : C.textPrimary === "#EAE6DF" ? "#111111" : C.textPrimary), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(center.x, 0.058, center.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.02, radius * 1.14, 48), new THREE.MeshBasicMaterial({ color: hex(C.accentPrimary) }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, 0.059, center.z);
    g.add(disc, ring);
    g.name = `lab-${spec.id}-hole`;
    return g;
  }
  function buildMissingSquareVisual({ center, size }) {
    const g = new THREE.Group();
    const s = size ?? SQUARE_SIZE;
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.98, s * 0.98), new THREE.MeshBasicMaterial({ color: hex(C.bgSecondary === "#FFFFFF" ? "#EDEDED" : C.bgSecondary), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(center.x, 0.057, center.z);
    const x = new THREE.Mesh(boxesGeometry([{ x: 0, z: 0, w: s * 0.9, d: 0.02, h: 0, y: 0 }]), new THREE.MeshBasicMaterial({ color: hex(C.textSecondary.startsWith("rgba") ? "#888888" : C.textSecondary) }));
    x.rotation.y = Math.PI / 4; x.position.set(center.x, 0.058, center.z);
    const x2 = x.clone(); x2.rotation.y = -Math.PI / 4;
    g.add(pit, x, x2);
    g.name = `lab-${spec.id}-missing`;
    return g;
  }

  /* ---------------- the ground: the composition the board is set into */
  function buildGround() {
    const group = new THREE.Group();
    group.name = `lab-${spec.id}-ground`;
    const below = -SLAB_THICKNESS - 0.002;
    const plane = (w, d, mat, y = below) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; group.add(m); return m; };
    const box = (x, z, w, d, h, color, y = below, extra = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
      m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
    };
    const R = Math.max(SLAB_X, SLAB_Z);
    const kind = spec.ground;
    // A far underlay in the direction's ground colour, so the setup
    // screen's low view never runs off the edge of a sheet.
    const under = new THREE.Mesh(new THREE.PlaneGeometry(R * 16, R * 16), new THREE.MeshBasicMaterial({ color: hex(UNDERLAY[kind] || C.bgPrimary) }));
    under.rotation.x = -Math.PI / 2; under.position.y = below - 0.05; group.add(under);
    if (kind === "sheet" || kind === "typeSheet" || kind === "console" || kind === "machine") {
      const size = R * 3.2;
      const tex = paintGroundSheet(spec, kind, size);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: kind === "console" ? 0.4 : 0.95, metalness: kind === "console" ? 0.5 : 0 });
      const p = plane(size, size, mat);
      if (kind === "machine") {
        // The board sits in a heavy charcoal frame with a red index bar.
        box(0, 0, SLAB_X + 0.9, SLAB_Z + 0.9, 0.12, 0x242322, below, { metalness: 0.3 });
        box(-SLAB_X / 2 - 0.3, 0, 0.12, SLAB_Z * 0.4, 0.2, hex(C.accentPrimary), below);
      }
      if (kind === "sheet") box(0, 0, SLAB_X + 0.12, SLAB_Z + 0.12, 0.004, 0x000000, below);
    } else if (kind === "bauhausForms") {
      plane(R * 4, R * 4, new THREE.MeshStandardMaterial({ color: hex(C.bgPrimary), roughness: 1 }));
      // Primary forms at different heights beside the board, as if it
      // were set on a workshop table among the preliminary course's
      // exercises: circle, square, triangle, and a charcoal bar.
      const HX = SLAB_X / 2, HZ = SLAB_Z / 2;
      const circ = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 64), new THREE.MeshStandardMaterial({ color: hex(C.accentPrimary), roughness: 0.6 }));
      circ.position.set(HX + 2.4, below + 0.15, -HZ + 1.6); circ.receiveShadow = circ.castShadow = true; group.add(circ);
      box(HX + 2.2, HZ - 1.4, 2.2, 2.2, 0.55, hex(C.accentSecondary), below, { roughness: 0.6 });
      const triS = new THREE.Shape(); triS.moveTo(0, 1.25); triS.lineTo(1.2, -0.8); triS.lineTo(-1.2, -0.8); triS.closePath();
      const tri = new THREE.Mesh(new THREE.ExtrudeGeometry(triS, { depth: 0.22, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: hex(C.accentTertiary), roughness: 0.6 }));
      tri.rotation.x = -Math.PI / 2; tri.position.set(HX + 2.3, below, 0.2); tri.castShadow = tri.receiveShadow = true; group.add(tri);
      box(0, -HZ - 1.1, SLAB_X * 0.6, 0.22, 0.12, 0x1f1d1b, below);
      box(-HX - 1.2, HZ - 1.2, 0.5, 2.4, 0.3, hex(C.accentPrimary), below, { roughness: 0.6 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 12, 64), new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.5 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, below + 0.08, HZ + 1.8); ring.castShadow = true; group.add(ring);
    } else if (kind === "mondrian") {
      plane(R * 4, R * 4, new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.6 }));
      // The board is one rectangle in a larger composition: black bars run
      // out from it, and three fields take the primaries.
      const k = 0x0e0e0e, bw = 0.16;
      box(0, -SLAB_Z / 2 - 1.4, R * 3.2, bw, 0.12, k); box(0, SLAB_Z / 2 + 0.9, R * 3.2, bw, 0.12, k);
      box(-SLAB_X / 2 - 1.1, 0, bw, R * 3.2, 0.12, k); box(SLAB_X / 2 + 2.2, 0, bw, R * 3.2, 0.12, k);
      box(-SLAB_X / 2 - 2.6, -SLAB_Z / 2 - 2.8, 2.8, 2.6, 0.06, hex(C.accentPrimary));
      box(SLAB_X / 2 + 3.6, SLAB_Z / 2 + 2.2, 2.6, 2.4, 0.06, hex(C.accentSecondary));
      box(SLAB_X / 2 + 3.6, -SLAB_Z / 2 - 0.5, 2.6, 1.6, 0.06, hex(C.accentTertiary));
    } else if (kind === "diagonalPlanes") {
      plane(R * 4, R * 4, new THREE.MeshStandardMaterial({ color: 0x1c2127, roughness: 0.5, metalness: 0.6 }));
      // Counter-composition: long planes crossing under the board at 45°.
      [[0, 0.1, 0x3a434d, R * 3.4, 1.4], [R * 0.2, 0.2, 0x2a3038, R * 2.6, 0.5], [-R * 0.9, 0.05, hex(C.accentPrimary), R * 1.6, 0.14]].forEach(([off, h, col, len, wid], i) => {
        const b = box(off, -off * 0.3, len, wid, h, col, below - 0.1, { metalness: 0.7, roughness: 0.35 });
        b.rotation.y = i === 2 ? -Math.PI / 4 : Math.PI / 4;
      });
    } else if (kind === "plinth") {
      plane(R * 4, R * 4, new THREE.MeshStandardMaterial({ color: 0x8b877f, roughness: 1, map: paintGroundSheetConcrete() }));
      box(0, 0, SLAB_X + 1.2, SLAB_Z + 1.2, 0.5, 0x9c988f, below - 0.5 + 0.001, { roughness: 1 });
      box(SLAB_X / 2 + 1.9, -SLAB_Z / 2 + 1.2, 1.2, 2.4, 1.6, 0xa39f96, below, { roughness: 1 });
    } else if (kind === "offsetSlab") {
      plane(R * 4, R * 4, new THREE.MeshBasicMaterial({ color: hex(C.bgPrimary) }));
      // The board's hard offset shadow: a black slab, down and to the right.
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_X, SLAB_Z), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      sh.rotation.x = -Math.PI / 2; sh.position.set(0.42, below + 0.003, 0.42); group.add(sh);
      [[-SLAB_X / 2 - 1.5, -SLAB_Z / 2 + 1, 0xff4f9a], [SLAB_X / 2 + 1.6, SLAB_Z / 2 - 1.4, 0x7b5cff], [SLAB_X / 2 + 1.2, -SLAB_Z / 2 - 0.4, 0xffe14d]].forEach(([x, z, col], i) => {
        const r = 0.8 + i * 0.2;
        const s2 = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: 0x000000 })); s2.rotation.x = -Math.PI / 2; s2.position.set(x + 0.14, below + 0.004, z + 0.14); group.add(s2);
        const s1 = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: col })); s1.rotation.x = -Math.PI / 2; s1.position.set(x, below + 0.006, z); group.add(s1);
      });
    } else {
      plane(R * 4, R * 4, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    }
    return group;
  }

  return {
    EDGE_RADIUS, outlineYOffset: OUT,
    makeBoardTexture, buildSlabMaterials, makeGrid, buildPieceVisual, buildMoveIndicator,
    buildBlackHoleVisual, buildMissingSquareVisual, buildGround, boxesGeometry,
  };
}

/* A concrete floor map for the Brutalist plinth's surroundings. */
let FLOOR = null;
function paintGroundSheetConcrete() {
  if (FLOOR) return FLOOR;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 512, 512);
  let s = 9;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(60,58,54,${r() * 0.25})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  g.strokeStyle = "rgba(40,38,34,0.35)"; g.lineWidth = 2;
  for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
  FLOOR = new THREE.CanvasTexture(c);
  FLOOR.wrapS = FLOOR.wrapT = THREE.RepeatWrapping;
  FLOOR.repeat.set(6, 6);
  FLOOR.__shared = true;
  return FLOOR;
}
