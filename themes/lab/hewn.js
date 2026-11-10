/* Rough-hewn stone (user, of the Monolith: "No, the blocks, themselves
   need to be rough-hewn, not perfect looking"): a block split and dressed
   by hand, never machined, its faces a little uneven, its edges and
   corners knocked off unevenly, as a hammer leaves them. The land's
   rubble is made by hewnBox. (The pieces were too, until the user asked
   for them "more rough cut": they're cut by roughcut.js now. seedOf and
   snapTurn here still serve them.)

   Every point of the surface is moved inward only, by an amount that's a
   function of where the point is and nothing else, so the corners and
   edges, which a box's faces each have their own copy of, move as one and
   the stone stays whole. The pattern is seeded (the same stone every
   visit) and can be set in the stone's own frame (`turn`). */
import * as THREE from "three";

// A lattice value, 0..1, for an integer point and a seed.
function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const ease = (t) => t * t * (3 - 2 * t);
/* Smooth value noise in three dimensions, 0..1. */
export function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = ease(x - ix), fy = ease(y - iy), fz = ease(z - iz);
  const v = (a, b, c) => hash3(ix + a, iy + b, iz + c, seed);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(v(0, 0, 0), v(1, 0, 0), fx), lerp(v(0, 1, 0), v(1, 1, 0), fx), fy),
    lerp(lerp(v(0, 0, 1), v(1, 0, 1), fx), lerp(v(0, 1, 1), v(1, 1, 1), fx), fy),
    fz,
  );
}
/* Three octaves of it: broad unevenness with smaller under it. */
function fbm(x, y, z, seed) {
  return (noise3(x, y, z, seed) * 0.57 + noise3(x * 2.03, y * 2.03, z * 2.03, seed + 101) * 0.29 + noise3(x * 4.1, y * 4.1, z * 4.1, seed + 211) * 0.14);
}
const step = (a, b, x) => ease(Math.min(1, Math.max(0, (x - a) / (b - a))));
/* A seed from a name (a piece's id). */
export function seedOf(name) {
  let h = 2166136261;
  for (const ch of String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/* A turn snapped to the nearest of a cube's 24 (a roll's quarter turns
   add up exactly, never drifting); anything that isn't near one is no
   turn at all. */
export function snapTurn(q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
  const r = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]].map((v) => (Math.abs(v) > 0.7 ? Math.sign(v) : Math.abs(v) < 0.3 ? 0 : NaN));
  const ok = r.every((v) => Number.isFinite(v)) && [0, 3, 6].every((c) => Math.abs(r[c]) + Math.abs(r[c + 1]) + Math.abs(r[c + 2]) === 1);
  if (!ok) return q.identity();
  const mat = new THREE.Matrix4().set(r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1);
  if (mat.determinant() < 0) return q.identity();
  return q.setFromRotationMatrix(mat);
}

/* A point read turned off the stone's axes, for its noise: value noise
   sliced along its lattice's planes, as a block's faces and a disc's
   would slice it, shows the lattice's squares (and a line down the
   middle of every face). An orthonormal turn, so the noise's scale is
   kept. */
const SK2 = [0, 0, 0];
function skew(x, y, z, out) {
  out[0] = 0.6 * x + 0.48 * y + 0.64 * z;
  out[1] = -0.8 * x + 0.36 * y + 0.48 * z;
  out[2] = -0.8 * y + 0.6 * z;
  return out;
}

/* A hewn block w x h x d (x, y, z), centred, as a BoxGeometry worked
   over:
     seg     the most a facet spans (finer for a small stone)
     rough   how far a face wanders in, at most
     chip    how far an edge is knocked in at most (a corner further)
     chipW   how far in from an edge the knocks reach
     freq    the unevenness's scale: about this many hollows a unit
     turn    the stone's own frame (a Quaternion), for a piece that rolls
     taper   narrower toward the top by this share (a standing stone)
     slant   [x, z]: the top cut on a slope
     uvUnit  the surface texture's repeat, in units, set in the stone's
             own frame too */
export function hewnBox(w, h, d, { seed = 1, seg = 0.25, rough = 0.03, chip = 0.1, chipW = 0.15, freq = 3, turn = null, taper = 0, slant = null, uvUnit = 1 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.ceil(w / seg)), Math.max(2, Math.ceil(h / seg)), Math.max(2, Math.ceil(d / seg)));
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const back = turn ? turn.clone().invert() : null;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    q.copy(p); if (back) q.applyQuaternion(back);
    // How near each face the point lies (1 on it), sharp for the knocks'
    // reach and a little softer for the way it's pushed.
    const dx = hx - Math.abs(p.x), dy = hy - Math.abs(p.y), dz = hz - Math.abs(p.z);
    const near = [1 - step(0, chipW, dx), 1 - step(0, chipW, dy), 1 - step(0, chipW, dz)];
    const sorted = near.slice().sort((a, b) => b - a);
    const edge = sorted[1], corner = sorted[2];
    skew(q.x, q.y, q.z, SK2);
    const fx = SK2[0] * freq, fy = SK2[1] * freq, fz = SK2[2] * freq;
    const f = fbm(fx, fy, fz, seed);
    const knock = chip * edge * (0.3 + 0.7 * noise3(fx * 1.7 + 17.3, fy * 1.7, fz * 1.7, seed + 7))
      + chip * 0.7 * corner * noise3(fx * 2.3, fy * 2.3 + 31.1, fz * 2.3, seed + 13);
    const m = rough * f + knock;
    const sw = chipW * 1.6;
    dir.set(Math.sign(p.x) * (1 - step(0, sw, dx)), Math.sign(p.y) * (1 - step(0, sw, dy)), Math.sign(p.z) * (1 - step(0, sw, dz)));
    if (dir.lengthSq() > 1e-9) p.addScaledVector(dir.normalize(), -m);
    if (taper || slant) {
      const k = (p.y + hy) / h;
      if (taper) { p.x *= 1 - taper * k; p.z *= 1 - taper * k; }
      if (slant) p.y += k * (slant[0] * p.x + slant[1] * p.z);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
    // The texture by the face as the stone itself has it.
    n.fromBufferAttribute(nor, i); if (back) n.applyQuaternion(back);
    const ax = Math.abs(n.x) > 0.5 ? 0 : Math.abs(n.y) > 0.5 ? 1 : 2;
    const c = [q.x, q.y, q.z];
    uv.setXY(i, c[(ax + 1) % 3] / uvUnit, c[(ax + 2) % 3] / uvUnit);
  }
  geo.computeVertexNormals();
  return geo;
}
