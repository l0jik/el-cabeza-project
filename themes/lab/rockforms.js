/* Natural rock, modelled (user, of the Monolith: "make everything ...
   more like natural looking as far as like natural formations of rocks";
   "make sure that all the different shapes of the pieces, including
   Cabeza Nova, are represented as well"; "make the background ones more
   varied").

   Each formation is a distance function: for any point, how far it is
   from the rock's surface (negative inside). Natural shapes are easy to
   say that way and to combine. A piece's shape is its cubes' box with
   the empty cells worn out of it (an arch's opening, an L's corner,
   rounded where they meet), its edges rounded off, its faces pitted, the
   soft layers eaten back between the hard ones, joints split down
   through it, a notch worn in at its foot. The land's other formations
   (mesas, buttes, capped spires, fins, domes, balanced rocks, boulder
   heaps, a free arch, jointed blocks) are said the same way.

   The surface is found on a grid (surface nets: a point in each cell the
   surface passes through, joined into faces), shaded smooth, and
   coloured point by point: the stone's own colour in bands, desert
   varnish streaked down its walls, lichen on what faces up, its hollows
   darker (measured with the same distance function). One material draws
   every rock: its texture laid on from three sides (triplanar) in the
   rock's own frame, so it doesn't slide over the stone as the land
   turns. */
import * as THREE from "three";

/* Smooth value noise, 0..1, from a table (a permutation and a value a
   lattice point): a few lookups a corner, no allocation, fast enough to
   ask a hundred thousand times as a land is built. A seed shifts where
   in the lattice a stone reads from. */
const PERM = new Uint8Array(512), VAL = new Float32Array(256);
(() => {
  let s = 20261110;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) VAL[i] = r();
})();
export function noise3(x, y, z, seed = 0) {
  x += (seed % 997) * 7.31; y += (seed % 991) * 3.17; z += (seed % 983) * 5.13;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const A = PERM[X] + Y, B = PERM[X + 1] + Y;
  const AA = PERM[A] + Z, AB = PERM[A + 1] + Z, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  const a0 = VAL[PERM[AA]], b0 = VAL[PERM[BA]], c0 = VAL[PERM[AB]], d0 = VAL[PERM[BB]];
  const a1 = VAL[PERM[AA + 1]], b1 = VAL[PERM[BA + 1]], c1 = VAL[PERM[AB + 1]], d1 = VAL[PERM[BB + 1]];
  const x00 = a0 + (b0 - a0) * u, x10 = c0 + (d0 - c0) * u, x01 = a1 + (b1 - a1) * u, x11 = c1 + (d1 - c1) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/* ------------------------------------------------------------ distances */

export function sdBox(x, y, z, hx, hy, hz) {
  const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz;
  const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
}
export const sdRoundBox = (x, y, z, hx, hy, hz, r) => sdBox(x, y, z, hx - r, hy - r, hz - r) - r;
export function sdEllipsoid(x, y, z, rx, ry, rz) {
  // (a bound, good near the surface: enough for a grid's sign)
  const k0 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz));
  const k1 = Math.sqrt((x * x) / (rx ** 4) + (y * y) / (ry ** 4) + (z * z) / (rz ** 4));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
// A round column on y, radius r, from y0 to y1, its edges rounded by e.
export function sdColumn(x, y, z, r, y0, y1, e = 0) {
  const dx = Math.hypot(x, z) - (r - e), dy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - e);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - e;
}
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function fbm(x, y, z, seed) {
  return noise3(x, y, z, seed) * 0.55 + noise3(x * 2.07, y * 2.07, z * 2.07, seed + 101) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3, seed + 211) * 0.15;
}

/* The weather on a shape: pits and bumps (wear), the soft layers worn
   back between the hard (strata: their spacing and depth), joints
   (vertical cracks of a width, at given planes), a notch worn in near
   the ground. Away from the surface the shape's own distance is given
   (the weather never moves the surface further than `reach`). */
export function weathered(base, { seed = 1, wear = 0.3, freq = 0.25, layer = 1.6, strata = 0.2, tilt = 0, joints = [], notch = 0, notchAt = 0.6, cuts = [], fresh = 1 } = {}) {
  const reach = wear + strata + notch + 0.6;
  return (x, y, z) => {
    let d = base(x, y, z);
    const d0 = d;
    // Fractures: the stone broken off along planes (each [nx, ny, nz, o]:
    // what lies past n·p = o is gone), flat faces and crisp edges, as
    // rock breaks.
    for (let i = 0; i < cuts.length; i++) { const c = cuts[i]; const k = c[0] * x + c[1] * y + c[2] * z - c[3]; if (k > d) d = k; }
    if (d > reach || d < -reach) return d;
    // (`fresh` < 1: a break, where it's the face, less worn than the skin
    // round it, going over to it smoothly at the break's edge.)
    const w = fresh === 1 ? wear : wear * (1 - (1 - fresh) * Math.min(1, Math.max(0, (d - d0) / wear)));
    d += w * (fbm(x * freq, y * freq, z * freq, seed) - 0.5) * 2;
    // (and a finer roughness on that: rock, not clay)
    d += w * 0.4 * (noise3(x * freq * 5.3, y * freq * 5.3, z * freq * 5.3, seed + 17) - 0.5) * 2;
    if (strata) {
      // Soft layers eaten back: a band a layer wide, its depth varying.
      const yy = y + tilt * x + 0.8 * (noise3(x * 0.04, 0, z * 0.04, seed + 7) - 0.5) * layer;
      const s = 0.5 + 0.5 * Math.sin((yy / layer) * Math.PI * 2);
      // (A soft layer a thin band, eaten back; the hard ones between stand.)
      d += strata * Math.pow(s, 8) * (0.5 + 0.9 * noise3(x * 0.1, yy * 0.3, z * 0.1, seed + 9));
    }
    for (const j of joints) {
      // A crack: the plane through (j.x, j.z) facing (j.nx, j.nz), j.w wide.
      const s = Math.abs((x - j.x) * j.nx + (z - j.z) * j.nz) - j.w;
      if (y > (j.from ?? -1e9)) d = smax(d, -s, j.w * 1.2);
    }
    if (notch) d += notch * Math.exp(-(((y - notchAt) / 0.9) ** 2)) * (0.7 + 0.6 * noise3(x * 0.15, 0, z * 0.15, seed + 3));
    return d;
  };
}

/* A shape of cubes (each [x, up, depth], whole numbers) as one block of
   rock, C units a cube, its base on y = 0 and centred on x and z: the
   cubes' box with every empty cell worn out of it, rounded where it
   meets the rest (an arch's opening comes out an arch). Empty cells on
   the box's edge are worn out past it, so nothing is left standing
   proud there. `round` rounds every edge. */
export function cubesSdf(cells, C, round) {
  const nx = 1 + Math.max(...cells.map((c) => c[0])), ny = 1 + Math.max(...cells.map((c) => c[1])), nz = 1 + Math.max(...cells.map((c) => c[2]));
  const W = nx * C, H = ny * C, D = nz * C;
  const solid = new Set(cells.map((c) => c.join(",")));
  const empties = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (solid.has(`${i},${j},${k}`)) continue;
    // The cell's box, pushed out through the shape's own edge where it lies on it.
    let x0 = i * C, x1 = (i + 1) * C, y0 = j * C, y1 = (j + 1) * C, z0 = k * C, z1 = (k + 1) * C;
    if (i === 0) x0 -= C; if (i === nx - 1) x1 += C;
    if (j === 0) y0 -= C; if (j === ny - 1) y1 += C;
    if (k === 0) z0 -= C; if (k === nz - 1) z1 += C;
    empties.push([(x0 + x1) / 2 - W / 2, (y0 + y1) / 2, (z0 + z1) / 2 - D / 2, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2]);
  }
  const sdf = (x, y, z) => {
    let d = sdRoundBox(x, y - H / 2, z, W / 2, H / 2, D / 2, round);
    for (const [cx, cy, cz, hx, hy, hz] of empties) d = smax(d, -sdBox(x - cx, y - cy, z - cz, hx, hy, hz), round * 1.3);
    return d;
  };
  return { sdf, size: [W, H, D] };
}

/* ------------------------------------------------------------ surface nets */

const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/* The surface of `f` inside the box lo..hi, found on a grid of `cell`:
   positions (Float32Array) and triangles (indices), faces outward. */
export function surfaceNets(f, lo, hi, cell) {
  const nx = Math.max(3, Math.ceil((hi[0] - lo[0]) / cell) + 1), ny = Math.max(3, Math.ceil((hi[1] - lo[1]) / cell) + 1), nz = Math.max(3, Math.ceil((hi[2] - lo[2]) / cell) + 1);
  const sx = (hi[0] - lo[0]) / (nx - 1), sy = (hi[1] - lo[1]) / (ny - 1), sz = (hi[2] - lo[2]) / (nz - 1);
  const field = new Float32Array(nx * ny * nz);
  let q = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) field[q++] = f(lo[0] + i * sx, lo[1] + j * sy, lo[2] + k * sz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  const cx = nx - 1, cy = ny - 1;
  const cv = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = field[id(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      ax += CO[a][0] + (CO[b][0] - CO[a][0]) * t; ay += CO[a][1] + (CO[b][1] - CO[a][1]) * t; az += CO[a][2] + (CO[b][2] - CO[a][2]) * t; n++;
    }
    cv[cid(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + ax / n) * sx, lo[1] + (j + ay / n) * sy, lo[2] + (k + az / n) * sz);
  }
  const idx = [];
  const quad = (a, b, c, d) => { idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = field[id(i, j, k)], b = field[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    const q0 = cv[cid(i, j - 1, k - 1)], q1 = cv[cid(i, j, k - 1)], q2 = cv[cid(i, j, k)], q3 = cv[cid(i, j - 1, k)];
    if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue;
    if (a < 0) quad(q0, q1, q2, q3); else quad(q0, q3, q2, q1);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = field[id(i, j, k)], b = field[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    const q0 = cv[cid(i - 1, j, k - 1)], q1 = cv[cid(i, j, k - 1)], q2 = cv[cid(i, j, k)], q3 = cv[cid(i - 1, j, k)];
    if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue;
    if (a < 0) quad(q0, q3, q2, q1); else quad(q0, q1, q2, q3);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = field[id(i, j, k)], b = field[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    const q0 = cv[cid(i - 1, j - 1, k)], q1 = cv[cid(i, j - 1, k)], q2 = cv[cid(i, j, k)], q3 = cv[cid(i - 1, j, k)];
    if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue;
    if (a < 0) quad(q0, q1, q2, q3); else quad(q0, q3, q2, q1);
  }
  return { positions: new Float32Array(pos), indices: idx };
}

/* ------------------------------------------------------------ colour */

/* A stone's colours: dark and light for its bands, how many bands a
   unit (band), its varnish, and how much lichen it carries. */
export const STONE = {
  basalt: { dark: [0.19, 0.2, 0.22], light: [0.27, 0.28, 0.3], band: 0.55, varnish: [0.1, 0.1, 0.11], lichen: 0.35 },
  sandstone: { dark: [0.56, 0.46, 0.35], light: [0.7, 0.6, 0.46], band: 0.7, varnish: [0.27, 0.21, 0.16], lichen: 0.2 },
  redrock: { dark: [0.44, 0.31, 0.23], light: [0.6, 0.44, 0.32], band: 0.6, varnish: [0.22, 0.15, 0.12], lichen: 0.12 },
  cream: { dark: [0.6, 0.55, 0.45], light: [0.75, 0.69, 0.57], band: 0.5, varnish: [0.32, 0.27, 0.22], lichen: 0.25 },
  grey: { dark: [0.4, 0.39, 0.37], light: [0.52, 0.51, 0.48], band: 0.45, varnish: [0.17, 0.16, 0.15], lichen: 0.4 },
};
const LICHEN = [0.55, 0.6, 0.47];

/* The colour at a point of a stone: in its frame `p` (y up from its
   base), facing `n`, with `ao` (0 in a deep hollow, 1 in the open). */
export function stoneColour(st, x, y, z, nx, ny, nz, ao, seed) {
  // Bands of uneven thickness, wandering a little: two waves and noise.
  const bandPos = y * st.band + 1.6 * (noise3(x * 0.05, y * 0.02, z * 0.05, seed) - 0.5);
  const b = Math.min(1, Math.max(0, 0.5 + 0.3 * Math.sin(bandPos * Math.PI * 2) + 0.2 * Math.sin(bandPos * 5.1 + 1.3) + 0.35 * (noise3(x * 0.08, y * 0.9, z * 0.08, seed + 3) - 0.5)));
  const mott = 0.85 + 0.3 * noise3(x * 0.3, y * 0.3, z * 0.3, seed + 5);
  let r = (st.dark[0] + (st.light[0] - st.dark[0]) * b) * mott, g = (st.dark[1] + (st.light[1] - st.dark[1]) * b) * mott, bl = (st.dark[2] + (st.light[2] - st.dark[2]) * b) * mott;
  // Desert varnish down the walls: streaks running from the top down.
  const steep = 1 - Math.abs(ny);
  const streak = ease((noise3(x * 0.45, y * 0.035, z * 0.45, seed + 11) - 0.45) * 3.5) * steep;
  r += (st.varnish[0] - r) * streak * 0.45; g += (st.varnish[1] - g) * streak * 0.45; bl += (st.varnish[2] - bl) * streak * 0.45;
  // Lichen on what faces the sky.
  if (ny > 0.45) {
    const l = ease((noise3(x * 0.6, y * 0.6, z * 0.6, seed + 13) - 0.62) * 6) * st.lichen * ease((ny - 0.45) * 4);
    r += (LICHEN[0] - r) * l; g += (LICHEN[1] - g) * l; bl += (LICHEN[2] - bl) * l;
  }
  const shade = 0.42 + 0.58 * ao;
  return [r * shade, g * shade, bl * shade];
}

/* ------------------------------------------------------------ geometry */

/* A formation's geometry, placed: its surface (surface nets of `f` over
   lo..hi at `cell`), turned `rotY` and set at (px, py, pz) (or placed by
   `matrix`), coloured by `st`. Returns a BufferGeometry with position, normal, color and a
   blank uv (the material lays its texture on by position). */
export function rockGeometry(f, lo, hi, cell, { st, seed = 1, rotY = 0, px = 0, py = 0, pz = 0, matrix = null, clipBelow = -Infinity } = {}) {
  const { positions, indices } = surfaceNets(f, lo, hi, cell);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const n = positions.length / 3, nor = geo.attributes.normal.array, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    // Openness: how far the stone's own surface is a step out along the
    // normal (a hollow's walls are near, the open air far).
    const step = Math.max(cell * 2.5, 1.2);
    const ao = Math.min(1, Math.max(0, f(x + nx * step, y + ny * step, z + nz * step) / step));
    // (Darker toward the ground it stands in.)
    const foot = 0.75 + 0.25 * ease((y - clipBelow) / 2.5);
    const [r, g, b] = stoneColour(st, x, y, z, nx, ny, nz, ao * foot, seed);
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.applyMatrix4(matrix || new THREE.Matrix4().makeRotationY(rotY).setPosition(px, py, pz));
  return geo;
}

/* One material for every rock: vertex colours, under a grey detail
   texture laid on from three sides by position (in the mesh's own
   frame), `scale` repeats a unit. */
export function rockMaterial(map, scale = 0.12, extra = {}) {
  const mat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.96, metalness: 0, ...extra });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNrm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTriPos = position;\nvTriNrm = normal;");
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
  mat.customProgramCacheKey = () => "lab-rock-triplanar";
  return mat;
}
