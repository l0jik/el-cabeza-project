/* Luna's ground: no plate under the board (user: the board is part of the
   lunar surface). One surface of regolith runs from the board out to the
   horizon, swelling, pocked with craters (bowls, raised rims, the fresh
   ones bright), hills rising far off. The board is a levelled stretch of
   it with the squares marked out on the ground: worn lines, a stud at
   every corner, lit, a firmer line round the edge; a few old shallow
   craters still show through.

   The board has a contour of its own (user: "too flat ... we need some
   contour ... sometimes a portion of a building might have a small berm
   of moon dust up against it"; then "Yes, now I see the contour on the
   game board. That's good"): a low roll of the ground across the squares,
   a level pad under each building, and against some sides of some
   buildings a bank of dust. The pads and banks go with the buildings, so
   the board's ground is settled again after every move (update).

   Everything in the board's own frame (luna-fx.js hangs it on the
   chassis's boardGroup, so it turns with the board). */

import * as THREE from "three";
import { OFF_X, OFF_Z, SLAB_X, SLAB_Z, SQUARE_SIZE, BOARD_ROWS, BOARD_COLS } from "../engine/constants.js";
import { cv, tex, col, PS, CAB_D } from "./luna-models.js";

/* ---- gradient noise (Perlin), for the board's roll and the banks' unevenness ---- */
const PERM = (() => { const p = []; for (let i = 0; i < 256; i++) p.push(i); let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; } return Uint8Array.from([...p, ...p]); })();
const pfade = (t) => t * t * t * (t * (t * 6 - 15) + 10), plerp = (a, b, t) => a + (b - a) * t;
const pgrad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
function pnoise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = pfade(x), v = pfade(y), w = pfade(z), P = PERM;
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return plerp(plerp(plerp(pgrad(P[AA], x, y, z), pgrad(P[BA], x - 1, y, z), u), plerp(pgrad(P[AB], x, y - 1, z), pgrad(P[BB], x - 1, y - 1, z), u), v),
    plerp(plerp(pgrad(P[AA + 1], x, y, z - 1), pgrad(P[BA + 1], x - 1, y, z - 1), u), plerp(pgrad(P[AB + 1], x, y - 1, z - 1), pgrad(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
export const pfbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { s += a * pnoise(x * f + k * 17.1, y * f - k * 9.3, z * f + k * 5.7); n += a; a *= 0.5; f *= 2.03; } return 0.5 + 0.75 * (s / n); };
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* The regolith's own texture: grey dust, specks of light and dark, small pocks. */
function regolithTexture() {
  let s = 777; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * rnd();
  const c = cv(1024, 1024), x = c.getContext("2d");
  x.fillStyle = "#6f6c66"; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 30000; i++) { x.globalAlpha = rr(0.03, 0.08); x.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; const sz = rr(1, 3); x.fillRect(rnd() * 1024, rnd() * 1024, sz, sz); }
  x.globalAlpha = 1;
  for (let i = 0; i < 200; i++) {
    const cx = rnd() * 1024, cy = rnd() * 1024, r = rr(4, 22) * (rnd() < 0.1 ? 2.5 : 1);
    x.fillStyle = "rgba(0,0,0,0.16)"; x.beginPath(); x.arc(cx + r * 0.12, cy + r * 0.12, r, 0, 7); x.fill();
    x.strokeStyle = "rgba(255,255,255,0.2)"; x.lineWidth = Math.max(1, r * 0.12); x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12);
  return t;
}

/* The squares marked out on the ground: worn lines, a stud at every corner
   (lit), a firmer line round the edge. A canvas the board's size. */
function boardMarks(SX, SZ) {
  const S = Math.max(SX, SZ), W = Math.round((2048 * SX) / S), H = Math.round((2048 * SZ) / S), k = W / SX;
  const c = cv(W, H), x = c.getContext("2d"), e = cv(W, H), ex = e.getContext("2d");
  const U = (v) => (v + SX / 2) * k, V = (v) => (v + SZ / 2) * k, lw = Math.max(2, 3 * 0.008 * k);
  const line = (g, x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  ex.fillStyle = "#000"; ex.fillRect(0, 0, W, H);
  x.strokeStyle = "#cfd1d3"; x.lineCap = "round"; x.lineWidth = lw; x.globalAlpha = 0.55;
  for (let i = 0; i <= BOARD_COLS; i++) { const v = U(-OFF_X + i * SQUARE_SIZE); line(x, v, V(-OFF_Z), v, V(OFF_Z)); }
  for (let j = 0; j <= BOARD_ROWS; j++) { const v = V(-OFF_Z + j * SQUARE_SIZE); line(x, U(-OFF_X), v, U(OFF_X), v); }
  x.globalAlpha = 0.8; x.lineWidth = lw * 1.8; x.strokeRect(U(-OFF_X) - lw * 3, V(-OFF_Z) - lw * 3, U(OFF_X) - U(-OFF_X) + lw * 6, V(OFF_Z) - V(-OFF_Z) + lw * 6);
  x.globalAlpha = 1;
  for (let i = 0; i <= BOARD_COLS; i++) for (let j = 0; j <= BOARD_ROWS; j++) {
    const cx = U(-OFF_X + i * SQUARE_SIZE), cy = V(-OFF_Z + j * SQUARE_SIZE), r = 0.032 * k;
    x.fillStyle = "#3a3b3d"; x.beginPath(); x.arc(cx, cy, r * 1.35, 0, 7); x.fill();
    x.fillStyle = "#e9ecef"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    const g = ex.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2); g.addColorStop(0, "rgba(154,216,255,0.95)"); g.addColorStop(0.35, "rgba(154,216,255,0.4)"); g.addColorStop(1, "rgba(154,216,255,0)");
    ex.fillStyle = g; ex.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  }
  return { map: tex(c), emissiveMap: tex(e) };
}

export function createGround(tier) {
  let s = 4242; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * rnd();
  const group = new THREE.Group(); group.name = "luna-ground";
  // vertices close together by the board, further apart out to the horizon: x = sign(u)(A|u| + K|u|^3)
  const SEG = tier === "high" ? 560 : tier === "mid" ? 420 : 300, A = 14.4, EXT = 72, K = EXT - A, NV = SEG + 1;
  const xs = new Float32Array(NV);
  for (let i = 0; i < NV; i++) { const u = (i / SEG) * 2 - 1, a = Math.abs(u); xs[i] = Math.sign(u) * (A * a + K * a ** 3); }
  const idx = (x) => { let lo = 0, hi = SEG; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } return lo; };
  const N2 = NV * NV, HS = new Float32Array(N2), Bri = new Float32Array(N2), IB = new Float32Array(N2), RL = new Float32Array(N2), H = new Float32Array(N2), HB = new Float32Array(N2), FL = new Float32Array(N2), BM = new Float32Array(N2);
  const waves = [[38, 0.42], [17, 0.2], [9, 0.09], [5, 0.035], [3, 0.012]].map(([L, amp]) => [rr(0, Math.PI * 2), rr(0, Math.PI * 2), L, amp]);
  const swell = (x, z) => { let v = 0; for (const [a, ph, L, amp] of waves) v += amp * Math.sin((x * Math.cos(a) + z * Math.sin(a)) * ((Math.PI * 2) / L) + ph); return v; };
  // 0 on the board (and a pad round it), rising to 1 a little way off
  const pad = 0.5, blend = 3.4, level = (x, z) => smooth01((Math.max(Math.abs(x) - OFF_X, Math.abs(z) - OFF_Z) - pad) / blend);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const x = xs[i], z = xs[j], r = Math.hypot(x, z), a = Math.atan2(z, x), far = smooth01((r - 26) / 36);
    HS[j * NV + i] = swell(x, z) + far * (1.5 + 1.2 * Math.sin(a * 5 + 1.3) * Math.sin(a * 3.1 + 0.4) + 0.6 * swell(x * 0.23, z * 0.23));
    Bri[j * NV + i] = 1 + 0.12 * swell(x * 0.6 + 13, z * 0.6 - 7);
  }
  // craters: mostly small, a few big, thick about the board; one in five fresh, with a bright rim
  const crater = (cx, cz, R, d, rimH, fresh, darken = 0.05) => {
    const ext = R * 2.3, i0 = idx(cx - ext), i1 = Math.min(SEG, idx(cx + ext) + 1), j0 = idx(cz - ext), j1 = Math.min(SEG, idx(cz + ext) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = Math.hypot(xs[i] - cx, xs[j] - cz) / R, k = j * NV + i;
      if (q < 1) { HS[k] += rimH - (d + rimH) * (1 - q * q); Bri[k] -= darken * (1 - q * q); }
      else if (q < 2.3) HS[k] += rimH * Math.exp(-(((q - 1) / 0.42) ** 2));
      if (fresh) Bri[k] += fresh * Math.exp(-(((q - 1.04) / 0.32) ** 2));
    }
  };
  const nNear = tier === "low" ? 260 : 430, nFar = tier === "low" ? 180 : 300;
  for (let k = 0; k < nNear + nFar; k++) {
    const near = k < nNear, rad = near ? 24 * Math.sqrt(rnd()) : rr(24, 66), a = rnd() * Math.PI * 2, cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
    const R = 0.16 + (near ? (rad < 12 ? 1.4 : 3.2) : 6) * rnd() ** 3.4, d = R * rr(0.18, 0.3);
    crater(cx, cz, R, d, d * 0.3, rnd() < 0.2 ? rr(0.1, 0.22) : 0);
  }
  // the board levelled: the swell and the craters taken down to nothing on it, the ground there paler and even
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i, x = xs[i], z = xs[j], l = level(x, z);
    HS[k] *= l; Bri[k] = Bri[k] * l + (1.02 + 0.8 * (Bri[k] - 1)) * (1 - l);
    IB[k] = 1 - l;
    if (IB[k] > 0) RL[k] = IB[k] * ((pfbm(x * 0.33 + 4.1, 1.7, z * 0.33 - 2.3, 3) - 0.5) * 2 * 0.045 + (pfbm(x * 1.1 - 7, 3.3, z * 1.1 + 5, 2) - 0.5) * 0.045 * 0.5);
  }
  // old craters on the board itself, worn shallow: a dip of a centimetre or so, a darker floor, a paler ring
  for (let k = 0; k < 13; k++) {
    const R = rr(0.25, 1.3), cx = rr(-OFF_X + 0.3, OFF_X - 0.3), cz = rr(-OFF_Z + 0.3, OFF_Z - 0.3);
    crater(cx, cz, R, 0.02 + 0.01 * R, 0.005, rr(0.12, 0.22), 0.22);
  }
  // the region the board's contour touches: rows and columns with any of it
  let j0 = SEG, j1 = 0, i0 = SEG, i1 = 0;
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) if (IB[j * NV + i] > 0) { j0 = Math.min(j0, j); j1 = Math.max(j1, j); i0 = Math.min(i0, i); i1 = Math.max(i1, i); }
  for (let k = 0; k < N2; k++) { FL[k] = 1; HB[k] = HS[k] + RL[k]; H[k] = HB[k]; }

  const pos = new Float32Array(N2 * 3), nrm = new Float32Array(N2 * 3), uv = new Float32Array(N2 * 2), colr = new Float32Array(N2 * 3), tile = 140 / 12;
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i, b = Math.max(0.55, Math.min(1.35, Bri[k]));
    pos[k * 3] = xs[i]; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = xs[j];
    uv[k * 2] = xs[i] / tile; uv[k * 2 + 1] = -xs[j] / tile;
    colr[k * 3] = colr[k * 3 + 1] = colr[k * 3 + 2] = b;
  }
  // normals from the heights' slopes (the same way everywhere, so a re-settled patch has no seam)
  const normalsRows = (ja, jb) => {
    for (let j = ja; j <= jb; j++) for (let i = 0; i < NV; i++) {
      const il = Math.max(0, i - 1), ir = Math.min(SEG, i + 1), jl = Math.max(0, j - 1), jr = Math.min(SEG, j + 1);
      const dx = (H[j * NV + ir] - H[j * NV + il]) / (xs[ir] - xs[il]), dz = (H[jr * NV + i] - H[jl * NV + i]) / (xs[jr] - xs[jl]), l = Math.hypot(dx, 1, dz), k = (j * NV + i) * 3;
      nrm[k] = -dx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -dz / l;
    }
  };
  normalsRows(0, SEG);
  const ind = new Uint32Array(SEG * SEG * 6);
  for (let j = 0, n = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * NV + i, b = a + 1, c = a + NV, d = c + 1; ind.set([a, c, b, b, c, d], n); n += 6; }
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3), nrmA = new THREE.BufferAttribute(nrm, 3);
  posA.setUsage(THREE.DynamicDrawUsage); nrmA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posA); geo.setAttribute("normal", nrmA); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setAttribute("color", new THREE.BufferAttribute(colr, 3));
  geo.setIndex(new THREE.BufferAttribute(ind, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), EXT * 1.5);
  const groundTex = regolithTexture();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 0.97, metalness: 0 }));
  terrain.receiveShadow = true; terrain.castShadow = false; terrain.name = "luna-terrain"; terrain.raycast = () => {};
  group.add(terrain);

  const at = (x, z, arr = H) => {
    const i = idx(Math.max(-EXT, Math.min(EXT - 1e-4, x))), j = idx(Math.max(-EXT, Math.min(EXT - 1e-4, z)));
    const fx = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))), fz = Math.max(0, Math.min(1, (z - xs[j]) / (xs[j + 1] - xs[j])));
    const h = (ii, jj) => arr[jj * NV + ii];
    return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fz) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fz;
  };

  // the marks, draped over the ground a hair above it
  const SX = SLAB_X, SZ = SLAB_Z, MS = Math.max(SX, SZ), mx = Math.round((260 * SX) / MS), mz = Math.round((260 * SZ) / MS);
  const mPos = new Float32Array((mx + 1) * (mz + 1) * 3), mUv = new Float32Array((mx + 1) * (mz + 1) * 2), mNrm = new Float32Array((mx + 1) * (mz + 1) * 3), mInd = [];
  for (let j = 0; j <= mz; j++) for (let i = 0; i <= mx; i++) { const k = j * (mx + 1) + i; mPos[k * 3] = -SX / 2 + (i / mx) * SX; mPos[k * 3 + 2] = -SZ / 2 + (j / mz) * SZ; mUv[k * 2] = i / mx; mUv[k * 2 + 1] = 1 - j / mz; }
  for (let j = 0; j < mz; j++) for (let i = 0; i < mx; i++) { const a = j * (mx + 1) + i, b = a + 1, c = a + mx + 1, d = c + 1; mInd.push(a, c, b, b, c, d); }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3)); mGeo.setAttribute("normal", new THREE.BufferAttribute(mNrm, 3)); mGeo.setAttribute("uv", new THREE.BufferAttribute(mUv, 2)); mGeo.setIndex(mInd);
  const mk = boardMarks(SX, SZ);
  const marks = new THREE.Mesh(mGeo, new THREE.MeshStandardMaterial({ map: mk.map, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, emissive: col("#ffffff"), emissiveMap: mk.emissiveMap, emissiveIntensity: 1 }));
  marks.receiveShadow = true; marks.renderOrder = 1; marks.name = "luna-board-marks"; marks.raycast = () => {};
  group.add(marks);
  const drapeMarks = () => {
    const e = 0.02;
    for (let k = 0; k < mPos.length / 3; k++) {
      const x = mPos[k * 3], z = mPos[k * 3 + 2];
      mPos[k * 3 + 1] = at(x, z) + 0.003;
      const dx = (at(x + e, z) - at(x - e, z)) / (2 * e), dz = (at(x, z + e) - at(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
      mNrm[k * 3] = -dx / l; mNrm[k * 3 + 1] = 1 / l; mNrm[k * 3 + 2] = -dz / l;
    }
    mGeo.attributes.position.needsUpdate = true; mGeo.attributes.normal.needsUpdate = true; mGeo.computeBoundingSphere();
  };
  drapeMarks();

  /* The board's ground settled round the pieces where they stand: a level
     pad under each building, the low roll everywhere else, and banks of
     dust against some of their sides (which sides, and how high, is the
     piece's own: it keeps them as it moves). */
  function update(pieces) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NV + i; FL[k] = 1; BM[k] = 0; }
    for (const p of pieces) {
      const round = p.type === "cabeza", cx = (p.col + p.w / 2) * SQUARE_SIZE - OFF_X, cz = (p.row + p.h / 2) * SQUARE_SIZE - OFF_Z;
      const hx = round ? CAB_D / 2 : (p.w * PS) / 2, hz = round ? CAB_D / 2 : (p.h * PS) / 2, sd = hashStr(String(p.id));
      const hs = (q) => { let h = Math.imul(sd + q * 40503, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return ((h >>> 0) % 1000) / 1000; };
      const sides = [0, 1, 2, 3].map((q) => (hs(q) < 0.45 ? 0.045 + 0.045 * hs(q + 10) : 0)), seed = (sd % 997) * 0.37;
      const reach = 0.75, ia = Math.max(i0, idx(cx - hx - reach)), ib = Math.min(i1, idx(cx + hx + reach) + 1), ja = Math.max(j0, idx(cz - hz - reach)), jb = Math.min(j1, idx(cz + hz + reach) + 1);
      for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
        const k = j * NV + i; if (IB[k] <= 0) continue;
        const dx = xs[i] - cx, dz = xs[j] - cz;
        let d, side;
        if (round) { d = Math.hypot(dx, dz) - hx; side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3); }
        else { const ox = Math.abs(dx) - hx, oz = Math.abs(dz) - hz; d = Math.max(ox, oz) > 0 ? Math.hypot(Math.max(ox, 0), Math.max(oz, 0)) : Math.max(ox, oz); side = ox > oz ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3); }
        const f = smooth01((d - 0.02) / 0.32); if (f < FL[k]) FL[k] = f;
        const a = sides[side];
        // a soft bank: tucked under the wall, cresting a little out from it, running out gently
        if (a && d > -0.08 && d < 0.7) { const along = side < 2 ? xs[j] : xs[i], wob = 0.6 + 0.8 * pfbm(along * 1.4 + seed, seed, 0.5, 2), bm = a * wob * Math.exp(-(((d - 0.07) / 0.2) ** 2)) * smooth01((d + 0.08) / 0.14); if (bm > BM[k]) BM[k] = bm; }
      }
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NV + i; HB[k] = HS[k] + RL[k] * FL[k]; H[k] = HB[k] + IB[k] * BM[k]; pos[k * 3 + 1] = H[k]; }
    normalsRows(Math.max(0, j0 - 1), Math.min(SEG, j1 + 1));
    const ra = Math.max(0, j0 - 1) * NV * 3, rc = (Math.min(SEG, j1 + 1) - Math.max(0, j0 - 1) + 1) * NV * 3;
    posA.updateRange.offset = ra; posA.updateRange.count = rc; posA.needsUpdate = true;
    nrmA.updateRange.offset = ra; nrmA.updateRange.count = rc; nrmA.needsUpdate = true;
    drapeMarks();
  }

  return {
    group,
    // the ground's height at a point on the board's frame; base: without the banks of dust
    at: (x, z) => at(x, z, H),
    base: (x, z) => at(x, z, HB),
    update,
    dims: `${SLAB_X}x${SLAB_Z}`,
    dispose() {
      group.parent && group.parent.remove(group);
      geo.dispose(); terrain.material.dispose(); groundTex.dispose();
      mGeo.dispose(); marks.material.map.dispose(); marks.material.emissiveMap.dispose(); marks.material.dispose();
    },
  };
}
