/* The game's pieces as model files, built by the game itself: the same
   geometry the chassis puts on the board (engine/geometry.js: the
   Cabeza's disc, a rounded box, or a smoothed polycube from the cube
   lists in engine/anomaly.js and engine/shapes.js), at the game's own
   scale (engine/constants.js PIECE_SCALE, CABEZA_SCALE, DISC_DIAM,
   DISC_H, SQUARE_SIZE) with the 1975 set's bevel (themes/wood-set.js
   EDGE_RADIUS). tools/export_pieces.mjs bundles this, opens it headless
   and asks for each piece as glTF (binary), OBJ and STL.

   The project has no modelled files: every piece is generated from
   these numbers, so this is where a .glb/.obj/.stl comes from.

   window.exportPiece({ type, pose, material }) ->
     { glb: base64, obj: string, stl: base64, dims: { w, h, z, vox } }
   window.exportSet({ pieces: [{ type, pose, col, row, mat }] }) -> { glb: base64 } */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { SQUARE_SIZE, OFF_X, OFF_Z, PIECE_META } from "../../engine/constants.js";
import { PIECE_ORIENTATIONS } from "../../engine/anomaly.js";
import { restingY } from "../../engine/geometry.js";
import { WOODS } from "../../themes/wood-set.js";
import { geometryFor } from "./harness.js";

// The set's woods as flat colours (the grain itself is a shader,
// themes/wood-set.js WOOD_PARS, which no model format carries).
function materialFor(kind) {
  if (kind === "dark") return new THREE.MeshStandardMaterial({ name: "walnut", color: new THREE.Color(WOODS.dark.light), roughness: 0.5, metalness: 0 });
  if (kind === "brass") return new THREE.MeshStandardMaterial({ name: "brass", color: 0xc9a24a, metalness: 1, roughness: 0.34 });
  return new THREE.MeshStandardMaterial({ name: "olive-ash", color: new THREE.Color(WOODS.light.light), roughness: 0.45, metalness: 0 });
}

function pieceFor(type, pose) {
  const o = typeof pose === "object" ? pose : PIECE_ORIENTATIONS[type][pose || 0];
  return { id: type, type, owner: "light", row: 0, col: 0, w: o.w, h: o.h, z: o.z, ...(o.vox ? { vox: o.vox } : {}) };
}

// A piece's mesh, its footprint's centre at the origin and its base on
// y = 0 (the board's surface), as the chassis rests it.
function meshFor(p, mat) {
  const mesh = new THREE.Mesh(geometryFor(p), materialFor(mat));
  mesh.name = p.type;
  mesh.position.set(0, restingY(p), 0);
  return mesh;
}

const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const glb = (obj) => new Promise((resolve, reject) => { try { new GLTFExporter().parse(obj, (r) => resolve(b64(r)), { binary: true }); } catch (e) { reject(e); } });

window.exportPiece = async function exportPiece({ type, pose, material }) {
  const p = pieceFor(type, pose);
  const scene = new THREE.Scene();
  scene.name = PIECE_META[type].name;
  const mesh = meshFor(p, material || "light");
  scene.add(mesh);
  const obj = new OBJExporter().parse(scene);
  const stl = b64(new STLExporter().parse(scene, { binary: true }).buffer);
  return { glb: await glb(scene), obj, stl, dims: { w: p.w, h: p.h, z: p.z, vox: p.vox || null } };
};

window.exportSet = async function exportSet({ pieces }) {
  const scene = new THREE.Scene();
  scene.name = "El Cabeza pieces";
  for (const q of pieces) {
    const p = pieceFor(q.type, q.pose);
    const mesh = meshFor(p, q.mat);
    mesh.name = `${q.type}-${q.mat}`;
    // on its squares (col, row), as the chassis places a piece
    mesh.position.x = (q.col + p.w / 2) * SQUARE_SIZE - OFF_X;
    mesh.position.z = (q.row + p.h / 2) * SQUARE_SIZE - OFF_Z;
    scene.add(mesh);
  }
  return { glb: await glb(scene) };
};

window.__EXPORT_READY__ = true;
