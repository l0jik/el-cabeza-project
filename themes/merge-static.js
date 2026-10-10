/* Fewer things to draw, the same picture (user: "move forward with all",
   after the efficiency review found Luna drawing about 590 objects a
   frame, its pieces built of some 26 parts each).

   mergeStatic(root): inside `root`, the plain parts (meshes with one
   ordinary material of their own: opaque, no shader added to it, no
   children, nothing marked to keep apart) that look the same (the same
   material settings, the same shadow flags and draw order, the same
   kinds of vertex data) are baked, in their places, into one geometry
   each, and the parts removed. A group the theme shows or hides as a
   whole (userData.mergeRoot) is merged on its own, so it still can. For
   a model that's finished and never has a part moved: run once, before
   it's first drawn. */
import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const PLAIN = new Set(["MeshStandardMaterial", "MeshPhysicalMaterial", "MeshLambertMaterial", "MeshPhongMaterial", "MeshBasicMaterial"]);
const NO_HOOK = THREE.Material.prototype.onBeforeCompile;
const NO_KEY = THREE.Material.prototype.customProgramCacheKey;
const NO_RENDER_HOOK = THREE.Object3D.prototype.onBeforeRender;
const NO_AFTER_HOOK = THREE.Object3D.prototype.onAfterRender;

// A material's settings as a key: textures by identity, colours by value
// (not toJSON, which would encode every painted texture as an image).
const SKIP = new Set(["uuid", "name", "id", "version", "userData", "_listeners"]);
function lookOf(m) {
  const out = [m.type];
  for (const k of Object.keys(m).sort()) {
    if (SKIP.has(k)) continue;
    const v = m[k];
    if (typeof v === "function") continue;
    if (v && v.isTexture) out.push(`${k}:${v.uuid}`);
    else if (v && v.isColor) out.push(`${k}:${v.getHex()}`);
    else if (v && (v.isVector2 || v.isVector3 || v.isEuler)) out.push(`${k}:${v.toArray().join(",")}`);
    else if (v === null || v === undefined || typeof v !== "object") out.push(`${k}:${v}`);
    else out.push(`${k}:${JSON.stringify(v)}`);
  }
  return out.join("|");
}
function layoutOf(geo) {
  const a = Object.keys(geo.attributes).sort().map((k) => `${k}:${geo.attributes[k].itemSize}:${geo.attributes[k].normalized ? 1 : 0}`);
  return `${a.join(",")}|${geo.index ? "i" : "n"}|${Object.keys(geo.morphAttributes).length}`;
}
function plain(o) {
  const m = o.material;
  return o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && !o.children.length && !o.userData.noMerge
    && o.onBeforeRender === NO_RENDER_HOOK && o.onAfterRender === NO_AFTER_HOOK && !o.customDepthMaterial && !o.customDistanceMaterial
    && m && !Array.isArray(m) && PLAIN.has(m.type) && !m.transparent && m.visible
    && m.onBeforeCompile === NO_HOOK && m.customProgramCacheKey === NO_KEY
    && o.geometry && o.geometry.isBufferGeometry && o.geometry.attributes.position && !o.geometry.groups.length
    && !Object.keys(o.geometry.morphAttributes).length;
}

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const bake = new THREE.Matrix4();
  // This group's own parts; a merge root inside it is done on its own,
  // as is a group drawn in an order of its own, and a hidden one is left
  // as it is. (Not a mirrored part: three turns a mirrored mesh's faces
  // round as it draws it, and baked in they'd be inside out.)
  const visit = (o) => {
    for (const c of o.children.slice()) {
      if (!c.visible) continue;
      if (c !== root && (c.userData.mergeRoot || (c.isGroup && c.renderOrder))) { mergeStatic(c); continue; }
      if (plain(c) && bake.multiplyMatrices(toRoot, c.matrixWorld).determinant() > 0) {
        const key = `${lookOf(c.material)}|${c.castShadow ? 1 : 0}${c.receiveShadow ? 1 : 0}|${c.renderOrder}|${c.frustumCulled ? 1 : 0}|${c.layers.mask}|${layoutOf(c.geometry)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      } else visit(c);
    }
  };
  visit(root);
  let merged = 0;
  for (const parts of buckets.values()) {
    if (parts.length < 2) continue;
    const geos = parts.map((p) => p.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, p.matrixWorld)));
    const geo = BufferGeometryUtils.mergeBufferGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geo) continue;
    // How many points each part brought, in order: what samples a part's
    // points (the dock's outline, ElCabeza3D.jsx) does so part by part.
    geo.userData.parts = parts.map((p) => p.geometry.attributes.position.count);
    const first = parts[0];
    const one = new THREE.Mesh(geo, first.material);
    one.castShadow = first.castShadow; one.receiveShadow = first.receiveShadow; one.renderOrder = first.renderOrder;
    one.frustumCulled = first.frustumCulled; one.layers.mask = first.layers.mask;
    one.name = "merged";
    for (const p of parts) p.parent.remove(p);
    root.add(one);
    merged += parts.length - 1;
  }
  // (Groups left empty go too.)
  const prune = (o) => { for (const c of o.children.slice()) { prune(c); if (c.type === "Group" && !c.children.length && !c.userData.mergeRoot && !Object.keys(c.userData).length) o.remove(c); } };
  if (merged) prune(root);
  return merged;
}
