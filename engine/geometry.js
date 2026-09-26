/* Shared piece/camera geometry math for El Cabeza's 3D engine.
   Verified byte-for-byte identical between the Standard and Neon theme
   sources before extraction (see build/scratch/). Depends on THREE
   (assumed global, matching both original sources' own usage) and on
   the shared board constants. setGhostLineTarget lives here too even
   though it touches a Three.js object directly, since it has no
   game-rule content of its own — pure animation-state bookkeeping
   shared by both themes' ghost-move indicators. */

import * as THREE from "three";
import { SQUARE_SIZE, OFF_X, OFF_Z, PIECE_SCALE, CABEZA_SCALE, DISC_H, SLAB_Z } from "./constants.js";
import { PIECE_META } from "./constants.js";
import { parseVox } from "./shapes.js";

/* `root` is a theme-built move-indicator's root object (see
   theme.buildMoveIndicator in themes/standard.js and themes/neon.js) —
   a plain Mesh/LineSegments for Standard, a Group for Neon's multi-bar
   bracket. Reads/writes userData.currentOpacity rather than
   root.material.opacity directly so this stays agnostic to which:
   the chassis tick loop is what actually applies the interpolated
   value each frame, via root.userData.indicator.setOpacity(). */
export function setGhostLineTarget(root, target, fadingOut) {
  root.userData.opacityFrom = root.userData.currentOpacity ?? 0;
  root.userData.opacityTo = target;
  root.userData.opacityStart = performance.now();
  if (fadingOut) root.userData.fadingOut = true;
}

/* --------------------------- geometry ----------------------------- */
export function pieceCenter(p) {
  return {
    x: (p.col + p.w / 2) * SQUARE_SIZE - OFF_X,
    y: (p.z * PIECE_SCALE) / 2, // height is a piece property, independent of square spacing
    z: (p.row + p.h / 2) * SQUARE_SIZE - OFF_Z,
  };
}

/* Resting Y for a piece's mesh: half its scaled height, so it sits on
   the board rather than sinking into it. */
export function restingY(p) {
  return PIECE_META[p.type].shape === "disc"
    ? (DISC_H * CABEZA_SCALE) / 2
    : (p.z * PIECE_SCALE) / 2;
}

/* A box with every edge and corner eased: the exact Minkowski sum of
   a box and a sphere, so all 12 edges and 8 corners share one radius
   and the extents are exactly sx x sy x sz.

   Built by parameterising a sphere and DUPLICATING the rings that sit
   on the octant boundaries (the equator, and the four azimuth
   quarter-lines). Each octant's samples are offset to its own corner
   of the inner box, so those duplicated rings automatically bridge
   into the flat faces and the cylindrical edge fillets. The practical
   consequence is that `seg` controls ONLY fillet smoothness — the flat
   faces stay perfectly flat and full-size no matter how low it goes.

   Two earlier versions were wrong in instructive ways, both caught by
   measuring against the real geometry rather than by eye:

   1. An ExtrudeGeometry version extruded a rounded rectangle with
      bevelSize = radius, assuming the bevel insets the end caps. It
      does the opposite — bevelSize expands the body OUTWARD in the
      shape plane. Height was right, but the footprint was inflated by
      2 * bevelSize: makeRoundedBox(0.8, 0.8, 0.8) measured
      0.925 x 0.800 x 0.925. Invisible at rest, but a roll rotates the
      OLD geometry 90 degrees (bringing the correct 0.800 height into a
      horizontal axis) and then rebuilds it at 0.925, so pieces snapped
      15.6% wider the instant they landed.

   2. A sphere-swept version built on a uniform BoxGeometry grid fixed
      the size but looked like a squircle. With seg=6 on a 0.8 box the
      grid pitch is 0.133 while the fillet is only 0.0625 wide, so the
      last flat vertex landed at 0.267 when the flat face should reach
      0.3375 — the rounding started early and smeared across one huge
      quad, and smooth normals over that span read as a bulge.

   Verified for this version: extents exact for cubes and prisms alike;
   the flat top face reaches +/-0.33750 against an ideal of 0.33750;
   max deviation from the true rounded-box silhouette is 0.05% of a
   piece at seg=8 (1190 triangles, cheaper than the 5604-vertex
   ExtrudeGeometry it replaces); and a piece rotated 90 degrees matches
   a freshly rebuilt one to 4.7e-4 world units, which is sub-pixel.
   Any change here should be re-measured the same way — matching
   extents alone is not sufficient, the rotated and rebuilt solids must
   also agree, or landings will snap again.

   Default lowered 8 -> 6 (per-quadrant sample count): the fillet's
   sagitta — a segment's own max deviation from the true circular arc
   it approximates, r*(1-cos((pi/2/seg)/2)) — is EXACTLY what seg
   controls, independent of piece size, since radius here is a fixed
   per-theme constant (EDGE_RADIUS) never scaled to a piece's own w/h/z.
   That means there's no such thing as a piece "too big" or "too small"
   for a given seg the way there is for the digital-interior wireframe's
   own bars-per-unit density elsewhere in this codebase (see
   buildDigitalInterior in themes/neon.js) — every piece shares the
   exact same fillet geometry regardless of footprint, so one constant
   already suits all of them, and the only question is how low it can
   go before the facets show. At seg=6 the sagitta is ~0.066% of a
   0.8-unit piece for Standard's radius (0.0625) and ~0.032% for Neon's
   (0.03) — both comfortably under seg=8's own already-invisible 0.05%
   baseline in absolute terms, while cutting the exterior shell/body
   geometry from 648 to 392 vertices (1228 to 732 triangles) per piece,
   confirmed via engine/geometry.js's own extent/rotation invariants
   still holding exactly at seg=6 (only the fillet's own facet count
   changes; the flat faces and reported extents are untouched by seg at
   any value, per this function's own construction). Left as an
   explicit named default rather than per-call-site tuning, since both
   themes' fixed radii land well inside the same safe margin. */
export function makeRoundedBox(sx, sy, sz, radius, seg = 6) {
  const r = Math.min(radius, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4);
  const ix = sx / 2 - r;
  const iy = sy / 2 - r;
  const iz = sz / 2 - r;

  const us = [];
  const uq = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k <= seg; k++) {
      us.push((q * Math.PI) / 2 + (k / seg) * (Math.PI / 2));
      uq.push(q);
    }
  }
  const vs = [];
  const vh = [];
  for (let h = 0; h < 2; h++) {
    for (let k = 0; k <= seg; k++) {
      vs.push((h * Math.PI) / 2 + (k / seg) * (Math.PI / 2));
      vh.push(h);
    }
  }

  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const W = us.length;
  const H = vs.length;

  for (let j = 0; j < H; j++) {
    const v = vs[j];
    const sgnY = vh[j] === 0 ? 1 : -1;
    for (let i = 0; i < W; i++) {
      const u = us[i];
      const q = uq[i];
      const nx = Math.sin(v) * Math.cos(u);
      const ny = Math.cos(v);
      const nz = Math.sin(v) * Math.sin(u);
      const sgnX = q === 0 || q === 3 ? 1 : -1;
      const sgnZ = q === 0 || q === 1 ? 1 : -1;
      pos.push(ix * sgnX + r * nx, iy * sgnY + r * ny, iz * sgnZ + r * nz);
      nor.push(nx, ny, nz);
      uv.push(i / (W - 1), 1 - j / (H - 1));
    }
  }
  /* i wraps modulo W: the last azimuth column (u = 2pi, -z side) has to
     bridge back to the first (u = 0, +z side) or the +x edge fillet is
     left open. Stopping at W-1 left exactly that gap. */
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) {
      const i2 = (i + 1) % W;
      const a = j * W + i;
      const b = j * W + i2;
      const c = (j + 1) * W + i;
      const d = (j + 1) * W + i2;
      idx.push(a, b, c, b, d, c);
    }
  }

  /* Flat face caps. Each pole is a single point on the sphere but maps
     to the FOUR corners of a flat face, and no quad in the loop above
     spans between them — without these two triangles per face the top
     and bottom are open and you see straight into the piece. */
  const capT = [0, 1, 2, 3].map((q) => q * (seg + 1));
  const capB = [0, 1, 2, 3].map((q) => (H - 1) * W + q * (seg + 1));
  idx.push(capT[0], capT[2], capT[1], capT[0], capT[3], capT[2]);
  idx.push(capB[0], capB[1], capB[2], capB[0], capB[2], capB[3]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* Odd-shaped pieces (engine/shapes.js): a piece built from unit cubes.
   Both builders are centered on the piece's bounding box, the same frame
   makeRoundedBox(w*S, z*S, h*S) uses for a box piece — so pieceCenter/
   restingY/pivotFor place and roll either kind identically. Axes: x =
   columns, y = up (levels), z = rows. Each cube is `unit` on a side and
   they sit edge to edge, so the whole shape spans the box exactly. */
export function voxCubeCenters(piece, unit) {
  const cubes = parseVox(piece.vox);
  return cubes.map(([x, y, l]) => [
    (x + 0.5) * unit - (piece.w * unit) / 2,
    (l + 0.5) * unit - (piece.z * unit) / 2,
    (y + 0.5) * unit - (piece.h * unit) / 2,
  ]);
}

/* Only the faces on the outside of the shape (a face shared by two of
   the piece's own cubes is skipped), as unit squares on the cube grid.
   Neighbouring squares in one plane share whole edges, so an
   EdgesGeometry of this traces just the shape's real outline — the
   corners and the silhouette, not a line between every pair of cubes. */
export function makePolycubeGeometry(piece, unit) {
  const cubes = parseVox(piece.vox);
  const solid = new Set(cubes.map((c) => c.join(",")));
  const centers = voxCubeCenters(piece, unit);
  const h = unit / 2;
  // [neighbour offset (x, y-row, l), face normal (X, Y, Z), 4 corners]
  const faces = [
    [[1, 0, 0], [1, 0, 0], [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]]],
    [[-1, 0, 0], [-1, 0, 0], [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]]],
    [[0, 0, 1], [0, 1, 0], [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]]],
    [[0, 0, -1], [0, -1, 0], [[-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]]],
    [[0, 1, 0], [0, 0, 1], [[h, -h, h], [h, h, h], [-h, h, h], [-h, -h, h]]],
    [[0, -1, 0], [0, 0, -1], [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]]],
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  cubes.forEach(([x, y, l], i) => {
    const [cx, cy, cz] = centers[i];
    for (const [[dx, dy, dl], n, corners] of faces) {
      if (solid.has(`${x + dx},${y + dy},${l + dl}`)) continue;
      const base = pos.length / 3;
      corners.forEach(([px, py, pz], k) => {
        pos.push(cx + px, cy + py, cz + pz);
        nor.push(n[0], n[1], n[2]);
        uv.push(k === 0 || k === 1 ? 0 : 1, k === 0 || k === 3 ? 0 : 1);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* A rounded cube per solid cube, merged into one geometry — for a theme
   whose pieces are opaque rounded solids (Standard). `grow` enlarges
   every cube by that much on each side, for a silhouette shell drawn
   behind the body; the cubes' shared inner walls sit inside the body and
   never show. */
export function makePolycubeRounded(piece, unit, radius, grow = 0) {
  const parts = voxCubeCenters(piece, unit).map(([cx, cy, cz]) => {
    const g = makeRoundedBox(unit + grow * 2, unit + grow * 2, unit + grow * 2, radius);
    g.translate(cx, cy, cz);
    return g;
  });
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (const g of parts) {
    const base = pos.length / 3;
    pos.push(...g.getAttribute("position").array);
    nor.push(...g.getAttribute("normal").array);
    uv.push(...g.getAttribute("uv").array);
    for (const i of g.getIndex().array) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* One seamless solid with rounded edges, like makeRoundedBox but for an
   odd shape: no groove or seam where its cubes meet. Every odd piece is
   flat (one cube thick along some axis), so the shape is its outline in
   that plane, pushed out to the thickness: flat faces, a quarter-round
   along every outside edge, a rounded corner at each outward corner and
   a crisp one at each inward corner. Normals are exact, so the flat
   faces shade flat and the rounds shade smooth. A shape that isn't flat
   (or has a hole) falls back to makePolycubeRounded. `grow` works as
   there: the solid is that much bigger on every side, with its rounds
   that much wider (for Standard's silhouette shell). */
export function makePolycubeSmooth(piece, unit, radius, grow = 0, seg = 6) {
  const centers = voxCubeCenters(piece, unit);
  const eq = (a, b) => Math.abs(a - b) < unit * 1e-3;
  const flat = [0, 1, 2].find((ax) => centers.every((c) => eq(c[ax], centers[0][ax])));
  if (flat === undefined) return makePolycubeRounded(piece, unit, radius, grow);
  // In-plane axes, ordered so (u x v) points along +flat.
  const [ua, va] = flat === 0 ? [1, 2] : flat === 1 ? [2, 0] : [0, 1];
  const minU = Math.min(...centers.map((c) => c[ua])) - unit / 2;
  const minV = Math.min(...centers.map((c) => c[va])) - unit / 2;
  const cells = new Set(centers.map((c) => `${Math.round((c[ua] - minU) / unit - 0.5)},${Math.round((c[va] - minV) / unit - 0.5)}`));
  const has = (i, j) => cells.has(`${i},${j}`);

  // The outline, counter-clockwise: each cell side with no neighbour
  // beyond it, directed so the cell is on its left.
  const next = new Map();
  let bad = false;
  const addEdge = (a, b) => { const k = a.join(","); if (next.has(k)) bad = true; next.set(k, b); };
  for (const key of cells) {
    const [i, j] = key.split(",").map(Number);
    if (!has(i, j - 1)) addEdge([i, j], [i + 1, j]);
    if (!has(i + 1, j)) addEdge([i + 1, j], [i + 1, j + 1]);
    if (!has(i, j + 1)) addEdge([i + 1, j + 1], [i, j + 1]);
    if (!has(i - 1, j)) addEdge([i, j + 1], [i, j]);
  }
  const loop = [];
  if (!bad) {
    const startKey = next.keys().next().value;
    let k = startKey;
    do { loop.push(k.split(",").map(Number)); k = next.get(k).join(","); } while (k !== startKey && loop.length <= next.size);
  }
  if (bad || loop.length !== next.size) return makePolycubeRounded(piece, unit, radius, grow);
  // Keep only the corners.
  const corners = loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });

  // c: how far the flat core sits inside the cube faces; r: the
  // round's radius (c + grow, so a grown shell shares the same core).
  const c = Math.max(0, Math.min(radius - grow, unit / 2 - 1e-4));
  const r = c + grow;
  const inner = unit / 2 - c;
  const mid = centers[0][flat];
  // The contour to sweep: each corner of the outline pulled in by r,
  // with the direction it is pushed back out along and its normal. An
  // outward corner fans out into an arc; an inward corner is one point
  // with two normals (a crease).
  const contour = [];
  const m = corners.length;
  for (let i = 0; i < m; i++) {
    const a = corners[(i + m - 1) % m], p = corners[i], b = corners[(i + 1) % m];
    const d1 = [Math.sign(p[0] - a[0]), Math.sign(p[1] - a[1])];
    const d2 = [Math.sign(b[0] - p[0]), Math.sign(b[1] - p[1])];
    const n1 = [d1[1], -d1[0]], n2 = [d2[1], -d2[0]];
    const at = [minU + p[0] * unit - (n1[0] + n2[0]) * c, minV + p[1] * unit - (n1[1] + n2[1]) * c];
    const convex = d1[0] * d2[1] - d1[1] * d2[0] > 0;
    if (convex) {
      const a0 = Math.atan2(n1[1], n1[0]);
      for (let k = 0; k <= seg; k++) {
        const ang = a0 + (k / seg) * (Math.PI / 2);
        const n = [Math.cos(ang), Math.sin(ang)];
        contour.push({ at, dir: n, n });
      }
    } else {
      const dir = [n1[0] + n2[0], n1[1] + n2[1]];
      contour.push({ at, dir, n: n1 }, { at, dir, n: n2 });
    }
  }

  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const put = (u, v, h, nu, nv, nh) => {
    const p = [0, 0, 0], n = [0, 0, 0];
    p[ua] = u; p[va] = v; p[flat] = mid + h;
    n[ua] = nu; n[va] = nv; n[flat] = nh;
    pos.push(...p); nor.push(...n);
    uv.push((u - minU) / unit, (v - minV) / unit);
    return pos.length / 3 - 1;
  };
  // Rings from the top face's rim, round the edge, down the side and
  // round the bottom edge.
  const rings = [];
  for (let k = 0; k <= seg; k++) rings.push((k / seg) * (Math.PI / 2));
  const ringsBottom = rings.slice().reverse().map((t) => Math.PI - t);
  const ringIdx = [...rings, ...ringsBottom].map((t) => {
    const sn = Math.sin(t), cs = Math.cos(t);
    const h = (cs >= 0 ? inner : -inner) + r * cs;
    return contour.map(({ at, dir, n }) => put(at[0] + dir[0] * r * sn, at[1] + dir[1] * r * sn, h, n[0] * sn, n[1] * sn, cs));
  });
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const N = (i) => [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]];
  const tri = (a, b, c) => {
    const pa = P(a), pb = P(b), pc = P(c);
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const x = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.hypot(x[0], x[1], x[2]);
    if (len < 1e-12) return;
    const na = N(a), nb = N(b), nc = N(c);
    const dot = x[0] * (na[0] + nb[0] + nc[0]) + x[1] * (na[1] + nb[1] + nc[1]) + x[2] * (na[2] + nb[2] + nc[2]);
    if (dot >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const L = contour.length;
  for (let j = 0; j + 1 < ringIdx.length; j++) {
    for (let e = 0; e < L; e++) {
      const a = ringIdx[j][e], b = ringIdx[j][(e + 1) % L], c = ringIdx[j + 1][(e + 1) % L], d = ringIdx[j + 1][e];
      tri(a, b, c); tri(a, c, d);
    }
  }
  // The two flat faces.
  const outline = corners.map((p, i) => {
    const a = corners[(i + m - 1) % m], b = corners[(i + 1) % m];
    const n1 = [Math.sign(p[1] - a[1]), -Math.sign(p[0] - a[0])], n2 = [Math.sign(b[1] - p[1]), -Math.sign(b[0] - p[0])];
    return new THREE.Vector2(minU + p[0] * unit - (n1[0] + n2[0]) * c, minV + p[1] * unit - (n1[1] + n2[1]) * c);
  });
  const faces = THREE.ShapeUtils.triangulateShape(outline, []);
  for (const side of [1, -1]) {
    const ids = outline.map((q) => put(q.x, q.y, side * (inner + r), 0, 0, side));
    for (const [a, b, c] of faces) tri(ids[a], ids[b], ids[c]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* Where a ray from (camY, camZ), in direction (dirY, dirZ), crosses the
   board's plane (Y=0), moving forward from the camera. Two genuinely
   different failure modes here, which must NOT be conflated:

   1. dirY >= 0 (level or pointing up): a real, common case at grazing
      pitch — the ray genuinely never reaches the ground going forward,
      because the visible ground has no far boundary in that direction.
      This is the horizon, and correctly extends to +-Infinity.

   2. dirY < 0 (pointing down) but the crossing point works out behind
      the camera (t < 0): this means camY and dirY share a sign — the
      camera has already passed below the board's plane and this ray
      points even further away from it, not toward it. This ray sees
      NONE of the board, which is the opposite of case 1's "sees an
      unbounded amount of it." Conflating the two was a real bug: when
      both of a frustum's edge rays hit this case at once, treating
      both as +-Infinity made the visible span appear to cover the
      ENTIRE board (max span minus min span = the whole width), which
      reported 100% board visibility for a camera looking directly
      AWAY from the board — verified by tracing the actual numbers at
      near-top-down pitch with a deeply negative vertical offset, where
      overlap incorrectly snapped back up to 1.0 after having correctly
      approached 0.

   Returns null for case 2 specifically, so the caller can tell the two
   apart rather than treating every non-forward-hit the same way. */
export function rayHitBoardPlaneY0(camY, camZ, dirY, dirZ) {
  if (dirY >= -1e-9) return dirZ >= 0 ? Infinity : -Infinity;
  const t = -camY / dirY;
  if (t < 0) return null;
  return camZ + t * dirZ;
}

/* Fraction of the board's own width (measured along the camera's
   forward/back axis) that overlaps the visible ground, for a given
   orbit radius/pitch and a PURELY VERTICAL target offset ty (this
   assumes zero horizontal pan — horizontal drift is handled entirely
   separately, see the XZ clamp in the render loop, and the two are
   independent by design, not combined into one budget).

   No camera-height floor here (an earlier version had one, at 0.75
   then 0.1) — that was working around the rayHitBoardPlaneY0 bug
   described above by refusing to evaluate the geometry at all once the
   camera got close to the board, rather than fixing the actual
   miscalculation. With that fixed at its root, the camera is free to
   go to or below board level (per explicit confirmation this is fine
   for the "top" pan direction, which is the only one that can ever
   reach this), and this function's own math correctly reports
   dwindling then zero visibility rather than needing an artificial cutoff.

   Verified numerically (not just derived) against a wide grid of
   radius/phi/ty before being relied on: the true relationship here is
   NOT symmetric between panning up and down, and does not reduce to a
   clean closed form the way the horizontal case does, so this
   evaluates the actual ray-plane geometry directly rather than
   approximating it. A prior attempt at a closed-form approximation
   here (maxPanDistance / sin(phi)) was checked against this exact
   function and found to allow as little as 0% board visibility while
   reporting success — every downward-panning test case failed it
   outright, since it had no way to notice the camera going
   underground. That formula and this replacement should never be
   confused for equivalent; only this one is checked against the real
   geometry. */
export function boardVerticalOverlapFraction(radius, phi, ty, halfFovRad) {
  const camY = ty + radius * Math.cos(phi);
  const camZ = radius * Math.sin(phi);
  const dY = -Math.cos(phi);
  const dZ = -Math.sin(phi);
  const cos = Math.cos(halfFovRad);
  const sin = Math.sin(halfFovRad);
  // The frustum's two extreme rays in this vertical cross-section,
  // found by rotating the boresight by +-halfFovRad.
  const nY = dY * cos - dZ * sin,
    nZ = dY * sin + dZ * cos; // steeper ("near") edge
  const fY = dY * cos + dZ * sin,
    fZ = -dY * sin + dZ * cos; // shallower ("far") edge
  const zNear = rayHitBoardPlaneY0(camY, camZ, nY, nZ);
  const zFar = rayHitBoardPlaneY0(camY, camZ, fY, fZ);
  // Either edge unable to see the board's plane at all (case 2 above)
  // means the board isn't visible via that edge — not "unboundedly
  // visible." Must be checked before the min/max span below, since
  // null can't meaningfully participate in that comparison.
  if (zNear === null || zFar === null) return 0;
  const lo = Math.min(zNear, zFar);
  const hi = Math.max(zNear, zFar);
  // SLAB_Z, not SLAB_X: this measures how much of the board the camera's
  // VERTICAL fov spans, and the camera looks down the board's Z axis.
  const half = SLAB_Z / 2;
  const overlap = Math.max(0, Math.min(half, hi) - Math.max(-half, lo));
  return overlap / SLAB_Z;
}

/* Bisects for the largest |ty|, in whichever direction ty already
   points, that still keeps at least minFraction of the board visible.
   target.y = 0 is always safely above the floor (confirmed across the
   full radius/phi grid this was validated against), so it's always a
   valid "known-safe" starting bracket regardless of which direction
   needs to be searched. Returns ty unchanged in the common case where
   it's already within bounds — this only does any real work on a
   frame where a drag, zoom, or tilt change just pushed it out. */
export function clampVerticalTarget(ty, radius, phi, halfFovRad, minFraction) {
  if (boardVerticalOverlapFraction(radius, phi, ty, halfFovRad) >= minFraction) return ty;
  let lo = 0,
    hi = ty;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (boardVerticalOverlapFraction(radius, phi, mid, halfFovRad) >= minFraction) lo = mid;
    else hi = mid;
  }
  return lo;
}

/* The pivot edge and rotation for a roll, in world space.
   The piece is smaller than its square, so its contact edge sits inset
   from the grid line. Hinging on the grid line would make the piece
   appear to float; hinging on its own edge lands it short of the target
   by the gap it left behind plus the gap it must open on arrival, so
   that residual is carried as a translation across the same tween. */
export function pivotFor(piece, dir) {
  const { row, col, w, h, z } = piece;
  const S = PIECE_SCALE;
  /* Square-index position now scales by SQUARE_SIZE; the piece's own
     contact-edge offset (below, ± w*S/2 etc.) does not — that's the
     piece's real physical edge, sized independently of square spacing. */
  const cx = (col + w / 2) * SQUARE_SIZE - OFF_X;
  const cz = (row + h / 2) * SQUARE_SIZE - OFF_Z;
  const alongX = dir === "E" || dir === "W";
  /* Re-derived for a general square size: rotating the piece about its
     own contact edge lands its center at (old center) ± (w+z)/2 * S.
     The square-grid rules, separately, place the landing center at
     (old center) ± (w+z)/2 * SQUARE_SIZE. The gap between those two is
     the translation carried alongside the rotation. When SQUARE_SIZE
     was implicitly 1, this reduces to the original (1-S) form. */
  const residual = ((SQUARE_SIZE - S) * ((alongX ? w : h) + z)) / 2;

  switch (dir) {
    case "E":
      return {
        point: new THREE.Vector3(cx + (w * S) / 2, 0, cz),
        axis: new THREE.Vector3(0, 0, 1),
        angle: -Math.PI / 2,
        dirVec: new THREE.Vector3(1, 0, 0),
        residual,
      };
    case "W":
      return {
        point: new THREE.Vector3(cx - (w * S) / 2, 0, cz),
        axis: new THREE.Vector3(0, 0, 1),
        angle: Math.PI / 2,
        dirVec: new THREE.Vector3(-1, 0, 0),
        residual,
      };
    case "S":
      return {
        point: new THREE.Vector3(cx, 0, cz + (h * S) / 2),
        axis: new THREE.Vector3(1, 0, 0),
        angle: Math.PI / 2,
        dirVec: new THREE.Vector3(0, 0, 1),
        residual,
      };
    case "N":
      return {
        point: new THREE.Vector3(cx, 0, cz - (h * S) / 2),
        axis: new THREE.Vector3(1, 0, 0),
        angle: -Math.PI / 2,
        dirVec: new THREE.Vector3(0, 0, -1),
        residual,
      };
    default:
      return null;
  }
}
