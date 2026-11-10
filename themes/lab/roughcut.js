/* Rough-cut stones: the Monolith's pieces (user: "The pieces on the board
   must be more rough cut than they currently are"; of the whole land:
   "Sharp, fractured rock surfaces", "Irregular geometric rock
   structures", "Polygonal stone formations", "Massive angular boulders").

   A piece is cut out of its own cubes the way the land's formations are
   (rockforms.js): the cubes as one block (an L's corner, an arch's
   opening worn out of it), broken along a score of planes (big facets
   off its corners and arrises, its faces split off true, more on a bigger
   face), pitted, its breaks fresher than its skin, and never past its own
   squares (its box bounds it); its arrises sharp, where the planes meet.
   Shaded flat, facet by facet; its colours baked point by point at the
   stone's own scale (bands, varnish down what stood upright, lichen on
   what faced up, its hollows darker). The Cabeza is a round stone cut the same way, and
   carries no mark (user: "Remove the spirals off of the cabeza pieces").

   Each stone is cut once, in its own frame (the first pose it's seen in),
   and kept. A piece that rolls gets the same stone turned: the turn the
   roll gave it, or failing that whichever of a cube's 24 turns puts its
   cubes where they now are, so its facets, colours and grain go over with
   it (the grain too: the material reads it off the stone's own frame,
   `stonePos`). */
import * as THREE from "three";
import { cubesSdf, weathered, surfaceNets, sdBox, sdColumn, noise3, STONE, stoneColour } from "./rockforms.js";

/* A seeded stream of numbers in 0..1. */
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

/* A piece's cubes in its mesh's frame: [x (its columns), up, depth (its
   rows)], whole numbers from its box's corner. */
export function cellsOf(piece) {
  if (piece.vox) return String(piece.vox).split(";").map((t) => { const [x, y, l] = t.split(",").map(Number); return [x, l, y]; });
  const out = [];
  for (let x = 0; x < piece.w; x++) for (let u = 0; u < piece.z; u++) for (let d = 0; d < piece.h; d++) out.push([x, u, d]);
  return out;
}

/* Their centres, the box's middle at the origin, `S` a cube. */
function centresOf(cells, S) {
  const nx = 1 + Math.max(...cells.map((c) => c[0])), ny = 1 + Math.max(...cells.map((c) => c[1])), nz = 1 + Math.max(...cells.map((c) => c[2]));
  return cells.map(([x, u, d]) => [(x + 0.5 - nx / 2) * S, (u + 0.5 - ny / 2) * S, (d + 0.5 - nz / 2) * S]);
}
const keyOf = (x, y, z, S) => `${Math.round((x * 2) / S)},${Math.round((y * 2) / S)},${Math.round((z * 2) / S)}`;

/* A cube's 24 turns, as quaternions. */
const TURNS = (() => {
  const out = [], m = new THREE.Matrix4();
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) for (let s = 0; s < 8; s++) {
    const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
    const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) r[i][p[i]] = sg[i];
    m.set(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1);
    if (m.determinant() > 0) out.push(new THREE.Quaternion().setFromRotationMatrix(m));
  }
  return out;
})();

/* Whether turning the stone's cubes by `q` puts them where `now` are. */
function puts(q, centres, now, S) {
  const v = new THREE.Vector3();
  for (const c of centres) { v.set(c[0], c[1], c[2]).applyQuaternion(q); if (!now.has(keyOf(v.x, v.y, v.z, S))) return false; }
  return true;
}
/* The turn from a stone's own pose to the piece's now: the first of
   `tries` that fits, else any of the 24 that does; null if none (it's
   another shape: cut it afresh). */
export function turnTo(stone, piece, tries = []) {
  if (stone.disc) return new THREE.Quaternion();
  const now = new Set(centresOf(cellsOf(piece), stone.S).map(([x, y, z]) => keyOf(x, y, z, stone.S)));
  if (now.size !== stone.centres.length) return null;
  for (const q of [...tries, ...TURNS]) if (q && puts(q, stone.centres, now, stone.S)) return q.clone();
  return null;
}

/* Its arrises sharp (rock breaks so, and a mason's pitching leaves them
   so): a point where two or three of its planes meet (its breaks, or a
   break and the block's own face) goes onto all of them, the least way.
   Meshed, they'd come out rounded off by a cell; a break's face, and the
   weathered skin no break touched, are left as the mesh has them.
   `block` the stone before its breaks; `inside` keeps a point in its
   bounds. */
function sharpen(pos, cuts, block, cell, inside) {
  const tol = cell * 0.6, e = cell * 0.2, ks = new Float64Array(cuts.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2], b = block(x, y, z);
    let top = b;
    for (let c = 0; c < cuts.length; c++) { const q = cuts[c]; ks[c] = q[0] * x + q[1] * y + q[2] * z - q[3]; if (ks[c] > top) top = ks[c]; }
    const act = [];
    for (let c = 0; c < cuts.length; c++) if (ks[c] > top - tol) act.push(c);
    if (!act.length) continue;
    act.sort((a, c) => ks[c] - ks[a]);
    const N = [], K = [];
    for (const c of act.slice(0, 3)) { N.push(cuts[c]); K.push(ks[c]); }
    if (N.length < 3 && b > top - tol) {
      const gx = block(x + e, y, z) - block(x - e, y, z), gy = block(x, y + e, z) - block(x, y - e, z), gz = block(x, y, z + e) - block(x, y, z - e), l = Math.hypot(gx, gy, gz);
      if (l > 1e-9) { N.push([gx / l, gy / l, gz / l]); K.push(b); }
    }
    let d = null;
    for (let m = N.length; m >= 2 && !d; m--) d = leastMove(N.slice(0, m), K.slice(0, m));
    if (!d || Math.hypot(d[0], d[1], d[2]) > tol * 1.6) continue;
    const p = inside([x - d[0], y - d[1], z - d[2]]);
    pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
  }
}
/* The least move d with n_j · d = k_j for each plane j (d = Σ λ_j n_j),
   or null where the planes are near parallel. */
function leastMove(N, K) {
  const m = N.length, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const G = N.map((a) => N.map((b) => dot(a, b)));
  let lam;
  if (m === 2) {
    const det = G[0][0] * G[1][1] - G[0][1] * G[1][0];
    if (Math.abs(det) < 0.05) return null;
    lam = [(K[0] * G[1][1] - G[0][1] * K[1]) / det, (G[0][0] * K[1] - G[1][0] * K[0]) / det];
  } else {
    const det3 = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const det = det3(G);
    if (Math.abs(det) < 0.02) return null;
    lam = [0, 1, 2].map((j) => det3(G.map((row, r) => row.map((v, c) => (c === j ? K[r] : v)))) / det);
  }
  const d = [0, 0, 0];
  for (let j = 0; j < m; j++) for (let a = 0; a < 3; a++) d[a] += lam[j] * N[j][a];
  return d;
}

/* A stone's colours at its own scale: rockforms' stoneColour read at
   `k` times the point (its bands a few to a cube), its hollows darker. */
function colourAt(st, x, y, z, nx, ny, nz, ao, seed, k) {
  return stoneColour(st, x * k, y * k, z * k, nx, ny, nz, ao, seed);
}

/* Cut a stone. `cells` its cubes ([x, up, depth]), `S` a cube's size, or
   `disc` { r, h } for the Cabeza; `stone` "basalt" | "sandstone";
   `detail` the device's (0 coarser). Returns { geo, centres, S, disc }:
   geo centred on its box, with position, normal, color, a blank uv, and
   stonePos/stoneNrm (its own frame, kept through any turn). */
export function cutStone({ cells = null, disc = null, S = 1, stone = "basalt", seed = 1, detail = 1 }) {
  const R = stream(seed ^ 0x51ed270b);
  const st = STONE[stone] || STONE.basalt;
  let W, H, D, base, corners;
  if (disc) {
    W = D = disc.r * 2; H = disc.h;
    base = (x, y, z) => sdColumn(x, y, z, disc.r, -H / 2, H / 2, H * 0.08);
    corners = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; corners.push([Math.cos(a) * disc.r, H / 2, Math.sin(a) * disc.r], [Math.cos(a) * disc.r, -H / 2, Math.sin(a) * disc.r]); }
  } else {
    const blk = cubesSdf(cells, S, S * 0.025);
    [W, H, D] = blk.size;
    base = (x, y, z) => blk.sdf(x, y + H / 2, z);
    corners = [];
    for (const [i, j, k] of cells) for (let a = 0; a < 8; a++) corners.push([(i + (a & 1)) * S - W / 2, (j + ((a >> 1) & 1)) * S - H / 2, (k + ((a >> 2) & 1)) * S - D / 2]);
  }
  const unit = disc ? disc.h * 1.6 : S;
  // A bigger stone broke in bigger pieces.
  const big = disc ? 1 : Math.sqrt(Math.min(W, H, D) / S);
  const support = (n) => { let h = -Infinity; for (const p of corners) h = Math.max(h, p[0] * n[0] + p[1] * n[1] + p[2] * n[2]); return h; };
  // The planes it broke along: big facets off its corners and arrises
  // (off a disc, round its rim), and each face split a little off true
  // into a few facets of its own.
  const cuts = [];
  const cut = (n, depth) => { const l = Math.hypot(n[0], n[1], n[2]); n = n.map((v) => v / l); cuts.push([n[0], n[1], n[2], support(n) - depth]); };
  const sgn = () => (R() < 0.5 ? -1 : 1);
  if (!disc) {
    // Its corners, broken off unevenly.
    for (let c = 0; c < 8; c++) cut([(c & 1 ? 1 : -1) + (R() - 0.5) * 0.9, (c & 2 ? 1 : -1) + (R() - 0.5) * 0.9, (c & 4 ? 1 : -1) + (R() - 0.5) * 0.9], unit * big * (0.1 + R() * 0.15));
    // Its arrises: long facets down an edge, some deep, some a sliver.
    for (let c = 0; c < 12; c++) {
      const ax = c % 3, v = [sgn(), sgn(), sgn()];
      v[ax] = (R() - 0.5) * 0.5;
      cut(v, unit * big * (0.05 + R() * 0.13));
    }
    // Each face split into facets off true, as a mason's pitching
    // leaves it: more on a bigger face.
    const dims = [W / S, H / S, D / S];
    for (let f = 0; f < 6; f++) {
      const ax = f >> 1, side = f & 1 ? 1 : -1, area = dims[(ax + 1) % 3] * dims[(ax + 2) % 3];
      for (let k = 0, n = 2 + Math.floor(R() * 2) + Math.round(area * 0.6); k < n; k++) {
        const v = [(R() - 0.5) * 0.7, (R() - 0.5) * 0.7, (R() - 0.5) * 0.7];
        v[ax] = side;
        cut(v, unit * (0.02 + R() * 0.07));
      }
    }
  } else {
    for (let c = 0; c < 16; c++) { const a = R() * Math.PI * 2, t = (R() - 0.5) * 1.8; cut([Math.cos(a), t, Math.sin(a)], unit * (0.08 + R() * 0.2)); }
    for (let c = 0; c < 10; c++) { const a = R() * Math.PI * 2, t = 0.1 + R() * 0.3; cut([Math.cos(a) * t, c & 1 ? 1 : -1, Math.sin(a) * t], unit * (0.02 + R() * 0.07)); }
  }
  // (Set a little in from its box, so its pits and lumps have room both
  // ways: a face pushed out against the box came out sawn flat.)
  const inset = unit * 0.035;
  const block = (x, y, z) => base(x, y, z) + inset;
  // (Its breaks fresh: a third as worn as the skin no break touched.)
  const rough = weathered(block, { seed, wear: unit * 0.03, freq: 2.2 / unit, layer: unit * 0.3, strata: stone === "sandstone" ? unit * 0.018 : 0, cuts, fresh: 0.3 });
  // (Never past its own squares: its box, or its disc, bounds it.)
  const bound = disc ? (x, y, z) => sdColumn(x, y, z, disc.r, -H / 2, H / 2) : (x, y, z) => sdBox(x, y, z, W / 2, H / 2, D / 2);
  const f = (x, y, z) => Math.max(rough(x, y, z), bound(x, y, z));
  const cell = unit / (detail === 0 ? 8 : 11), pad = cell * 1.5;
  const { positions, indices } = surfaceNets(f, [-W / 2 - pad, -H / 2 - pad, -D / 2 - pad], [W / 2 + pad, H / 2 + pad, D / 2 + pad], cell);
  sharpen(positions, cuts, block, cell, disc
    ? (p) => { const r = Math.hypot(p[0], p[2]), k = r > disc.r ? disc.r / r : 1; return [p[0] * k, Math.min(H / 2, Math.max(-H / 2, p[1])), p[2] * k]; }
    : (p) => [Math.min(W / 2, Math.max(-W / 2, p[0])), Math.min(H / 2, Math.max(-H / 2, p[1])), Math.min(D / 2, Math.max(-D / 2, p[2]))]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const n = positions.length / 3, nor = geo.attributes.normal.array, col = new Float32Array(n * 3);
  const step = unit * 0.28, k = 3.2 / unit;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    const ao = Math.min(1, Math.max(0, 0.35 + f(x + nx * step, y + ny * step, z + nz * step) / step));
    // (A little more of the stone's grain in its colour: flecks.)
    const fleck = 0.92 + 0.16 * noise3(x * 9 / unit, y * 9 / unit, z * 9 / unit, seed + 29);
    const [r, g, b] = colourAt(st, x, y, z, nx, ny, nz, ao, seed, k);
    col[i * 3] = r * fleck; col[i * 3 + 1] = g * fleck; col[i * 3 + 2] = b * fleck;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.setAttribute("stonePos", new THREE.BufferAttribute(positions.slice(), 3));
  geo.setAttribute("stoneNrm", new THREE.BufferAttribute(nor.slice(), 3));
  return { geo, centres: disc ? [] : centresOf(cells, S), S, disc: !!disc };
}

/* The stones' material: vertex colours under a grain laid on from three
   sides in the stone's own frame (stonePos, stoneNrm: it rolls with the
   stone), shaded flat. `scale` repeats a unit. */
export function stoneMaterial(map, scale) {
  const mat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 stonePos;\nattribute vec3 stoneNrm;\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTriPos = stonePos;\nvTriNrm = stoneNrm;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;\nuniform float uTriScale;")
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec3 triW = pow(abs(normalize(vTriNrm)), vec3(4.0));
        triW /= (triW.x + triW.y + triW.z);
        vec4 triX = texture2D(map, vTriPos.zy * uTriScale);
        vec4 triY = texture2D(map, vTriPos.xz * uTriScale);
        vec4 triZ = texture2D(map, vTriPos.xy * uTriScale);
        vec4 texelColor = mapTexelToLinear(triX * triW.x + triY * triW.y + triZ * triW.z);
        diffuseColor *= texelColor;
      #endif`);
  };
  mat.customProgramCacheKey = () => "lab-rough-stone";
  return mat;
}
