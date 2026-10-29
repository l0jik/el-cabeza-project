/* The slide's path: what a drag lights on a piece it would slide (user,
   2026-10-29, of the slide-arrow lab's five: "go with arrow 4, path"). An
   arrow on the board from the piece's face (or corner, on a diagonal)
   onto the squares it moves into, each of them outlined and faintly
   filled, all of it drawn over everything, so no piece hides it. The old
   arrow sat at the piece's foot, inside it: behind a tall piece, or
   pointing away from the camera, it couldn't be seen.

   Built in the board's own space (a child of boardGroup turns with it),
   in the old arrow's colours: its glow, its dark body as the outline.
   chassis/arrow-lab.js draws its other versions with the same shapes. */
import * as THREE from "three";
import { SQUARE_SIZE } from "../engine/constants.js";
import { pieceCenter } from "../engine/geometry.js";
import { maskAt } from "../engine/shapes.js";

export const GLOW = 0x66d9ff, INK = 0x0a1a20;

export const mat = (color, extra) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

// A flat arrow lying on the board's plane along +x, from x0 to x1: shaft
// w wide, head hw wide and hl long; grown by m all round (its outline).
export function flatArrow(x0, x1, w, hw, hl, material, m = 0) {
  const s = new THREE.Shape();
  const a = x0 - m, tip = x1 + m * 1.6, neck = Math.max(a + 0.01, x1 - hl - m * 0.4);
  const sw = w / 2 + m, hh = hw / 2 + m * 1.2;
  s.moveTo(a, -sw); s.lineTo(neck, -sw); s.lineTo(neck, -hh); s.lineTo(tip, 0); s.lineTo(neck, hh); s.lineTo(neck, sw); s.lineTo(a, sw); s.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), material);
  mesh.rotation.x = -Math.PI / 2; // the shape's plane onto the board's (its +y to the board's -z)
  return mesh;
}

// A frame round a rectangle on the board's plane (centred), t thick.
export function frame(w, h, t, material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + t, -h / 2 + t); hole.lineTo(-w / 2 + t, h / 2 - t); hole.lineTo(w / 2 - t, h / 2 - t); hole.lineTo(w / 2 - t, -h / 2 + t); hole.closePath();
  s.holes.push(hole);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Drawn over everything, in this order among themselves.
export const onTop = (o, order) => o.traverse((x) => {
  if (!x.isMesh) return;
  x.material.depthTest = false;
  x.material.depthWrite = false;
  x.material.transparent = true;
  x.renderOrder = order;
  x.frustumCulled = false;
});

export function dispose(o) {
  o.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); x.material.dispose(); } });
  if (o.parent) o.parent.remove(o);
}

// The middle of the piece's face the way it slides (its corner on a
// diagonal).
export function leading(p, dr, dc) {
  const c = pieceCenter(p);
  return { x: c.x + (dc * p.w * SQUARE_SIZE) / 2, z: c.z + (dr * p.h * SQUARE_SIZE) / 2 };
}

/* The path for `piece` sliding [dr, dc] to `candidate` (where it lands;
   one square on if not given). Its userData.slidePath.cells: how many
   squares it outlines. */
export function buildSlidePath(piece, [dr, dc], candidate) {
  const g = new THREE.Group();
  const land = candidate || { ...piece, row: piece.row + dr, col: piece.col + dc };
  const a = leading(piece, dr, dc), b = leading(land, dr, dc);
  const len = Math.max(0.35, Math.hypot(b.x - a.x, b.z - a.z) - 0.12);
  const arrow = new THREE.Group();
  const back = flatArrow(0, len, 0.2, 0.56, 0.36, mat(INK, { side: THREE.DoubleSide }), 0.06);
  const face = flatArrow(0, len, 0.2, 0.56, 0.36, mat(GLOW, { side: THREE.DoubleSide }));
  face.position.y = 0.002;
  arrow.add(back, face);
  arrow.position.set(a.x, 0.03, a.z);
  arrow.rotation.y = Math.atan2(-dr, dc);
  // The squares it moves into (not those it keeps; an odd shape's empty
  // corners neither), each outlined.
  const cell = SQUARE_SIZE - 0.08;
  let cells = 0;
  for (let r = land.row; r < land.row + land.h; r++) for (let c = land.col; c < land.col + land.w; c++) {
    if (!maskAt(land, r, c) || maskAt(piece, r, c)) continue;
    const mid = pieceCenter({ row: r, col: c, w: 1, h: 1, z: 1 });
    const box = new THREE.Group();
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), mat(GLOW, { transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2;
    const rimBack = frame(cell + 0.04, cell + 0.04, 0.12, mat(INK, { side: THREE.DoubleSide }));
    const rim = frame(cell, cell, 0.07, mat(GLOW, { side: THREE.DoubleSide }));
    rim.position.y = 0.002;
    box.add(fill, rimBack, rim);
    box.position.set(mid.x, 0.02, mid.z);
    onTop(fill, 38); onTop(rimBack, 39); onTop(rim, 40);
    g.add(box);
    cells++;
  }
  onTop(back, 41); onTop(face, 42);
  g.add(arrow);
  g.userData.slidePath = { cells };
  return g;
}
