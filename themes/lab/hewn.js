/* Rough-hewn stone (user, of the Monolith: "No, the blocks, themselves
   need to be rough-hewn, not perfect looking"). A block split and dressed
   by hand, never machined: its faces a little uneven, its edges and
   corners knocked off, unevenly, as a hammer leaves them. The pieces and
   the land's great stones and rubble are all made by hewnBox, the
   Cabeza's disc by hewnDisc.

   Every point of the surface is moved inward only (a hewn piece never
   reaches past its squares), by an amount that's a function of where the
   point is and nothing else, so the corners and edges, which a box's
   faces each have their own copy of, move as one and the stone stays
   whole. The pattern is seeded (the same stone every visit) and set in
   the stone's own frame (`turn`): a piece that rolls keeps its own chips
   and its own grain, carried over by scene.js from the turn the roll gave
   it. */
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

/* A seeded stream of numbers in 0..1 (mulberry32). */
function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Where flakes came off a block: planes in the stone's own frame, each
   across one of its corners and slanted to run out along one of that
   corner's edges (a flake comes off an arris, it isn't a corner sawn
   square), no deeper than `depth` and reaching no further than `reach`
   along an edge (nor across most of the edge it runs along, so two never
   meet). `ext` is the stone's half-size in its own frame. */
function flakePlanes(count, depth, reach, ext, seed) {
  const R = stream(seed ^ 0x2c1b3c6d);
  const corners = [];
  for (let c = 0; c < 8; c++) corners.push([c & 1 ? 1 : -1, c & 2 ? 1 : -1, c & 4 ? 1 : -1]);
  for (let i = corners.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [corners[i], corners[j]] = [corners[j], corners[i]]; }
  const out = [];
  for (let k = 0; k < Math.min(count, 8); k++) {
    const s = corners[k], along = Math.floor(R() * 3);
    const w = [0, 1, 2].map((i) => (i === along ? 0.22 + R() * 0.3 : 0.65 + R() * 0.35));
    const n = new THREE.Vector3(s[0] * w[0], s[1] * w[1], s[2] * w[2]).normalize();
    const nn = [n.x, n.y, n.z];
    let dd = depth * (0.6 + R() * 0.4);
    for (let i = 0; i < 3; i++) dd = Math.min(dd, Math.abs(nn[i]) * Math.min(reach, ext[i] * (i === along ? 0.9 : 0.6)));
    out.push({ n, o: n.x * s[0] * ext[0] + n.y * s[1] * ext[1] + n.z * s[2] * ext[2] - dd });
  }
  return out;
}

/* A point read turned off the stone's axes, for its noise: value noise
   sliced along its lattice's planes, as a block's faces and a disc's
   would slice it, shows the lattice's squares (and a line down the
   middle of every face). An orthonormal turn, so the noise's scale is
   kept. */
const SK = [0, 0, 0], SK2 = [0, 0, 0];
function skew(x, y, z, out) {
  out[0] = 0.6 * x + 0.48 * y + 0.64 * z;
  out[1] = -0.8 * x + 0.36 * y + 0.48 * z;
  out[2] = -0.8 * y + 0.6 * z;
  return out;
}

/* The stone's own colours, a tint (near 1) over its material's colour,
   at a point in its own frame (so they roll with it): `fresh` 0..1 where
   new stone shows (a flake's scar, a knocked arris), `hollow` -1..1 how
   far the face is in there.
     sandstone  bedding through the whole stone, bands of warmer and
                paler sand, a little tilted and wavy; desert varnish in
                streaks down it; fresh stone paler, the varnish gone
     basalt     a paler, greyer weathered rind in patches, a fine
                mottle; fresh stone darker and bluer */
function stoneTint(kind, q, fresh, hollow, seed, out) {
  let r = 1, g = 1, b = 1;
  const [ux, uy, uz] = skew(q.x, q.y, q.z, SK);
  if (kind === "sandstone") {
    const bed = q.y + 0.1 * q.x + 0.06 * q.z + 0.07 * (noise3(ux * 1.4, uy * 1.4, uz * 1.4, seed + 41) - 0.5);
    const k = step(0.28, 0.72, noise3(bed * 3.6, 1.7, 4.2, seed + 43));
    r = 1.0 + 0.08 * k; g = 0.93 + 0.13 * k; b = 0.84 + 0.2 * k;
    const v = step(0.58, 0.86, noise3(ux * 2.6, q.y * 0.8, uz * 2.6, seed + 47)) * 0.5 * (1 - fresh);
    r *= 1 - 0.26 * v; g *= 1 - 0.32 * v; b *= 1 - 0.38 * v;
    r += (1.1 - r) * fresh * 0.8; g += (1.05 - g) * fresh * 0.8; b += (0.97 - b) * fresh * 0.8;
  } else if (kind === "basalt") {
    // (The rind a grey, not a brown: the dusk's light warms it enough.)
    const rind = step(0.45, 0.85, noise3(ux * 1.8, uy * 1.8, uz * 1.8, seed + 51)) * 0.5 * (1 - fresh);
    const mottle = 1 + 0.12 * (noise3(ux * 4.4, uy * 4.4, uz * 4.4, seed + 53) - 0.5);
    r = (1 + 0.2 * rind) * mottle; g = (1 + 0.2 * rind) * mottle; b = (1 + 0.19 * rind) * mottle;
    r += (0.8 - r) * fresh * 0.85; g += (0.85 - g) * fresh * 0.85; b += (0.96 - b) * fresh * 0.85;
  }
  const dark = 1 - 0.1 * hollow;
  out[0] = r * dark; out[1] = g * dark; out[2] = b * dark;
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
             own frame too
     flakes  how many flakes came off its arrises (flakePlanes): flat
             scars, flakeDepth deep at most and flakeReach long
     stone   "sandstone" | "basalt": its own colours as a vertex colour
             (stoneTint; the material has to have vertexColors on) */
export function hewnBox(w, h, d, { seed = 1, seg = 0.25, rough = 0.03, chip = 0.1, chipW = 0.15, freq = 3, turn = null, taper = 0, slant = null, uvUnit = 1, flakes = 0, flakeDepth = 0, flakeReach = 0, stone = null } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.ceil(w / seg)), Math.max(2, Math.ceil(h / seg)), Math.max(2, Math.ceil(d / seg)));
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const back = turn ? turn.clone().invert() : null;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3(), dir = new THREE.Vector3(), t = new THREE.Vector3();
  // (Its half-size in its own frame: a cube's turn only swaps the axes.)
  const ext = new THREE.Vector3(hx, hy, hz); if (back) ext.applyQuaternion(back);
  const cuts = flakes > 0 && flakeDepth > 0 ? flakePlanes(flakes, flakeDepth, flakeReach || Infinity, [Math.abs(ext.x), Math.abs(ext.y), Math.abs(ext.z)], seed) : [];
  const col = stone ? new Float32Array(pos.count * 3) : null, tint = [1, 1, 1];
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
    // A flake's scar: what stood past its plane laid flat on it (moved in
    // along the plane's normal, so never out of the squares).
    let fresh = chip > 0 ? Math.min(1, knock / chip) * 0.45 : 0;
    if (cuts.length) {
      t.copy(p); if (back) t.applyQuaternion(back);
      let cut = false;
      for (const c of cuts) { const s = c.n.dot(t) - c.o; if (s > 0) { t.addScaledVector(c.n, -s); cut = true; } }
      if (cut) { fresh = 1; p.copy(t); if (turn) p.applyQuaternion(turn); }
    }
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
    if (col) {
      stoneTint(stone, q, fresh, Math.max(-1, Math.min(1, (f - 0.5) * 2.5)), seed, tint);
      col[i * 3] = tint[0]; col[i * 3 + 1] = tint[1]; col[i * 3 + 2] = tint[2];
    }
  }
  if (col) geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/* A hewn disc, radius r and height h (the Cabeza's): its rim knocked
   about, its faces dressed flat in the middle (where the spiral is
   pecked) and rougher toward the rim. */
export function hewnDisc(r, h, { seed = 1, rough = 0.02, chip = 0.05, chipW = 0.06, freq = 6, segments = 56, stone = null } = {}) {
  const hh = h / 2, pts = [];
  // The profile, top to bottom: the face out to the rim, the rim, the
  // other face back to the axis (LatheGeometry turns it round).
  const face = [0.0001, 0.22, 0.42, 0.6, 0.72, 0.8, 0.87, 0.93, 0.975, 1];
  face.forEach((k) => pts.push(new THREE.Vector2(r * k, hh)));
  for (let i = 1; i < 6; i++) pts.push(new THREE.Vector2(r, hh - (h * i) / 6));
  face.slice().reverse().forEach((k) => pts.push(new THREE.Vector2(r * k, -hh)));
  // (LatheGeometry wants the profile bottom to top for its faces to face out.)
  pts.reverse();
  const geo = new THREE.LatheGeometry(pts, segments);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  // (The surface's texture a few times round, not stretched once round.)
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3);
  const p = new THREE.Vector3(), q = new THREE.Vector3(), dir = new THREE.Vector3();
  const col = stone ? new Float32Array(pos.count * 3) : null, tint = [1, 1, 1];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    q.copy(p);
    const rho = Math.hypot(p.x, p.z);
    const side = 1 - step(0, chipW, r - rho), cap = 1 - step(0, chipW, hh - Math.abs(p.y));
    skew(p.x, p.y, p.z, SK2);
    const fx = SK2[0] * freq, fy = SK2[1] * freq, fz = SK2[2] * freq;
    // (A face's middle dressed flat: the mark is pecked into it.)
    const dressed = cap * (1 - step(0.74 * r, 0.9 * r, rho));
    const f = fbm(fx, fy, fz, seed);
    const knock = chip * side * cap * (0.35 + 0.65 * noise3(fx * 1.6, fy * 1.6 + 9.7, fz * 1.6, seed + 5));
    const m = rough * f * (1 - dressed) + knock;
    dir.set(rho > 1e-6 ? (side * p.x) / rho : 0, cap * Math.sign(p.y), rho > 1e-6 ? (side * p.z) / rho : 0);
    if (dir.lengthSq() > 1e-9) p.addScaledVector(dir.normalize(), -m);
    pos.setXYZ(i, p.x, p.y, p.z);
    // (Its colours by the point as the lathe drew it, before the knocks,
    // so the seam's two copies of a point take the same.)
    if (col) {
      stoneTint(stone, q, chip > 0 ? Math.min(1, knock / chip) * 0.6 : 0, Math.max(-1, Math.min(1, (f - 0.5) * 2.5)) * (1 - dressed), seed, tint);
      col[i * 3] = tint[0]; col[i * 3 + 1] = tint[1]; col[i * 3 + 2] = tint[2];
    }
  }
  if (col) geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // (The seam where the lathe closes: the two copies of each point given
  // one normal between them, as three's own lathe does, or it shows.)
  const nor = geo.attributes.normal.array, base = segments * pts.length * 3, n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  for (let j = 0; j < pts.length * 3; j += 3) {
    n1.fromArray(nor, j); n2.fromArray(nor, base + j);
    n1.add(n2).normalize();
    n1.toArray(nor, j); n1.toArray(nor, base + j);
  }
  return geo;
}
