/* The front page's pieces, drawn by the game itself (user: "anything
   that's rendered in the front page image has to be per spec pieces
   that are only found in the game. Nothing can be invented ... I don't
   want the sizes to be all screwed up"): the engine's shapes
   (engine/anomaly.js PIECE_ORIENTATIONS, the same cube lists the rules
   use), the chassis's geometry (engine/geometry.js, PIECE_SCALE and the
   Cabeza's disc exactly as ElCabeza3D builds them), the 1975 set's wood
   and brass (themes/wood-set.js, the den's and the store's blocks and
   board). tools/front_pieces.mjs bundles this, opens it headless and
   asks for each composition as a PNG with a clear background.

   window.renderFront(spec) -> data URL
     spec.size [w, h], spec.dpr
     spec.camera { kind: "top" | "persp", az, el, pad, fov }
     spec.board: true draws the folding hardwood board under the pieces
     spec.ground: a shadow catcher's opacity (0 for none)
     spec.pieces [{ type, pose, col, row, mat }] mat: light | dark | brass | black | stone */
import * as THREE from "three";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H, SQUARE_SIZE, SLAB_X, SLAB_Z, SLAB_THICKNESS, OFF_X, OFF_Z, PIECE_META } from "../../engine/constants.js";
import { PIECE_ORIENTATIONS } from "../../engine/anomaly.js";
import { makeRoundedBox, makePolycubeSmooth, restingY } from "../../engine/geometry.js";
import { piecesClash } from "../../engine/shapes.js";
import { createWoodSet, EDGE_RADIUS, OUTLINE_Y_OFFSET } from "../../themes/wood-set.js";

const quality = () => ({ tier: "high", dprCap: 2, dprFloor: 1, shadowMap: 4096, boardTexture: 2048, texScale: 1, physical: true, detail: 2, tvWall: true });

/* What the lacquer reflects: a warm room, a broad soft light above, the
   rest dim (the den's panorama is painted for the den; this is enough
   for stills). */
let ENV = null;
function environment(renderer) {
  if (ENV) return ENV;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#6a5a48"); grd.addColorStop(0.45, "#2a2018"); grd.addColorStop(1, "#0a0806");
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#fff4e0"; g.fillRect(260, 30, 500, 90);
  g.fillStyle = "#ffd9a0"; g.fillRect(40, 140, 80, 180);
  g.fillStyle = "#ffe8c8"; g.fillRect(860, 150, 60, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(renderer);
  ENV = pm.fromEquirectangular(tex).texture;
  pm.dispose(); tex.dispose();
  return ENV;
}

// The chassis's geometry for a piece in a pose (ElCabeza3D.jsx, the
// mesh's own): the disc, a smoothed polycube, or a rounded box.
function geometryFor(p) {
  if (PIECE_META[p.type].shape === "disc") return new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2, (DISC_DIAM * CABEZA_SCALE) / 2, DISC_H * CABEZA_SCALE, 48);
  return p.vox ? makePolycubeSmooth(p, PIECE_SCALE, EDGE_RADIUS) : makeRoundedBox(p.w * PIECE_SCALE, p.z * PIECE_SCALE, p.h * PIECE_SCALE, EDGE_RADIUS);
}

function otherMaterial(kind, env) {
  if (kind === "brass") return new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1.1 }); // the set's own brass (wood-set.js buildBrass)
  if (kind === "black") return new THREE.MeshPhysicalMaterial({ color: 0x141210, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMap: env, envMapIntensity: 0.5 });
  if (kind === "stone") return new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.9, metalness: 0, envMap: env, envMapIntensity: 0.15 });
  return null;
}

let renderer = null;
function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.getElementById("c");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // (no output encoding, as the chassis: the woods were tuned for it)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

window.renderFront = function renderFront(spec) {
  const r = getRenderer();
  const env = environment(r);
  const set = createWoodSet({ env: () => env, quality, lights: {} });
  const [W, H] = spec.size;
  r.setPixelRatio(spec.dpr || 1);
  r.setSize(W, H, false);
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  // The pieces, each on its squares (col, row), as the chassis places them.
  const placed = [];
  for (const q of spec.pieces) {
    const pose = typeof q.pose === "object" ? q.pose : PIECE_ORIENTATIONS[q.type][q.pose || 0];
    const p = { id: q.id || `${q.type}-${placed.length}`, type: q.type, owner: q.mat === "dark" ? "dark" : "light", row: q.row, col: q.col, w: pose.w, h: pose.h, z: pose.z, ...(pose.vox ? { vox: pose.vox } : {}) };
    // (a piece set down at an angle, as a hand would on a table, isn't
    // on the board's squares: no clash check for it, just room left)
    if (!q.rot) for (const o of placed) if (piecesClash(p, o)) throw new Error(`${p.id} clashes with ${o.id}`);
    if (!q.rot) placed.push(p);
    const geo = geometryFor(p);
    const center = { x: (p.col + p.w / 2) * SQUARE_SIZE - OFF_X, z: (p.row + p.h / 2) * SQUARE_SIZE - OFF_Z };
    const y = restingY(p) * (q.scale || 1) + (q.lift || 0);
    let mesh;
    if (q.mat === "light" || q.mat === "dark") {
      const v = set.buildPieceVisual({ piece: p, isDark: q.mat === "dark", isDisc: PIECE_META[p.type].shape === "disc", geo, center, y });
      mesh = v.mesh;
      group.add(v.shell);
    } else {
      mesh = new THREE.Mesh(geo, otherMaterial(q.mat, env));
      mesh.position.set(center.x, y, center.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
    }
    if (q.scale) { mesh.scale.setScalar(q.scale); group.children.forEach((o) => { if (o.userData && o.userData.pieceId === p.id && o.userData.kind === "shell") { o.scale.setScalar(q.scale); o.position.y = y + OUTLINE_Y_OFFSET; } }); }
    if (q.rot) {
      // turned about its own middle, on the spot
      const turn = (m) => { const c0 = new THREE.Vector3(center.x, 0, center.z); m.position.sub(c0); m.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(q.rot)); m.position.add(c0); m.rotation.y = THREE.MathUtils.degToRad(q.rot); };
      turn(mesh); group.children.forEach((o) => { if (o.userData && o.userData.pieceId === p.id && o.userData.kind === "shell") turn(o); });
    }
    group.add(mesh);
  }

  // The board (the folding hardwood one), or a shadow catcher that
  // leaves the background clear.
  if (spec.board) {
    const tex = set.makeBoardTexture();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SLAB_X, SLAB_THICKNESS, SLAB_Z), set.buildSlabMaterials(tex));
    slab.position.y = -SLAB_THICKNESS / 2;
    slab.receiveShadow = true;
    group.add(slab);
    group.add(set.makeGrid());
    if (set.buildBrass) { try { const b = set.buildBrass(); const o = b && (b.group || b.root || b); if (o && o.isObject3D) group.add(o); } catch (e) { /* none */ } }
  } else if (spec.ground !== 0) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: spec.ground == null ? 0.38 : spec.ground }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    group.add(catcher);
  }

  // The den's lamplight, from above and a little in front.
  const L = spec.light || {};
  scene.add(new THREE.AmbientLight(0xfff0dc, L.ambient == null ? 0.18 : L.ambient));
  scene.add(new THREE.HemisphereLight(0xffeedb, 0x4a3420, L.hemi == null ? 0.5 : L.hemi));
  const key = new THREE.DirectionalLight(0xfff1de, L.key == null ? 1.05 : L.key);
  const kd = L.keyDir || [-0.55, 1, 0.5];
  key.position.set(kd[0] * 30, kd[1] * 30, kd[2] * 30);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const fill = new THREE.DirectionalLight(0xffdcb4, L.fill == null ? 0.28 : L.fill);
  fill.position.set(18, 12, -10);
  const back = new THREE.DirectionalLight(0xffb070, L.back == null ? 0.22 : L.back);
  back.position.set(-10, 8, -22);
  scene.add(key, fill, back);

  // Framing: the pieces' bounds (the board's too, if drawn).
  const box = new THREE.Box3().setFromObject(group);
  if (!spec.board) { // the catcher is huge: bound the pieces alone
    box.makeEmpty();
    group.children.forEach((m) => { if (!(m.material instanceof THREE.ShadowMaterial)) box.expandByObject(m); });
  }
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const cam = spec.camera || { kind: "persp" };
  const pad = cam.pad == null ? 1.12 : cam.pad;
  let camera;
  if (cam.kind === "top") {
    const hw = Math.max(size.x, size.z * (W / H)) / 2 * pad, hh = hw * (H / W);
    camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 200);
    camera.position.set(c.x, 60, c.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(c.x, 0, c.z);
    // (a shadow box wide enough for the whole lay)
  } else if (cam.kind === "ortho") {
    // A three-quarter view without perspective (the user's reference's
    // isometric blocks; a long row seen whole): fitted by projection too.
    const az = cam.az == null ? Math.PI / 4 : cam.az, el = cam.el == null ? Math.atan(1 / Math.sqrt(2)) : cam.el;
    const aspect = W / H;
    camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 400);
    camera.position.set(c.x + 120 * Math.cos(el) * Math.sin(az), c.y + 120 * Math.sin(el), c.z + 120 * Math.cos(el) * Math.cos(az));
    camera.lookAt(c.x, c.y, c.z);
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let hx = 0, hy = 0;
    for (const sx of [box.min.x, box.max.x]) for (const sy of [box.min.y, box.max.y]) for (const sz of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(sx, sy, sz).project(camera);
      hx = Math.max(hx, Math.abs(v.x) * aspect); hy = Math.max(hy, Math.abs(v.y));
    }
    const half = Math.max(hy, hx / aspect) * pad; // the frustum's half-height that holds both
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
  } else {
    camera = new THREE.PerspectiveCamera(cam.fov || 30, W / H, 0.1, 500);
    const az = cam.az == null ? 0.62 : cam.az, el = cam.el == null ? 0.52 : cam.el;
    // Framed by projection: the box's corners on screen, the distance
    // scaled till the widest of them sits at the edge (less the pad).
    let dist = size.length() * 1.5;
    const place = () => {
      camera.position.set(c.x + dist * Math.cos(el) * Math.sin(az), c.y + dist * Math.sin(el), c.z + dist * Math.cos(el) * Math.cos(az));
      camera.lookAt(c.x, c.y + (cam.lookLift || 0), c.z);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let i = 0; i < 4; i++) {
      place();
      let m = 0;
      for (const sx of [box.min.x, box.max.x]) for (const sy of [box.min.y, box.max.y]) for (const sz of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(sx, sy, sz).project(camera);
        m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
      }
      dist *= m * pad;
    }
    place();
  }
  const sh = key.shadow.camera;
  const ext = Math.max(size.x, size.z) * 1.2 + 4;
  sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext; sh.near = 1; sh.far = 120;
  key.target.position.copy(c); scene.add(key.target);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 2;

  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  // (freed: the next composition starts clean)
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose()); });
  return url;
};
window.__FRONT_READY__ = true;
