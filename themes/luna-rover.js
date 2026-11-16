/* Luna's rover, out and about (user, of the rover that stood parked by the
   base: "I want to see this rover slowly driving around, and I guess
   occasionally a driver or a second passenger get out and, I don't know,
   harvest some moon rock or something. Have it go all over the place.").

   - Where it may go: a grid over the ground round the base (cells of 0.25,
     out to 22 from the middle), shut where the board is (with a margin
     round it), where anything stands (the lander, the dish, the solar
     rows, the walkers, every boulder, each with room for the rover round
     it) and where the ground's too steep or broken (a crater's wall). Only
     the open ground it can reach from where it starts is ever a goal.
   - Where it goes: one leg after another, each to the part of the ground
     (eight sectors round the middle) it has spent least time in, so it
     goes all over; the way found on the grid (A*), pulled straight where
     it can be, smoothed (a centripetal Catmull-Rom curve) and checked
     clear again, starting the way it faces. A slow drive (0.16 a second),
     slower on the bends, easing to a stop.
   - On the ground: its height and its tilt from the ground under its
     wheels, eased like a suspension; its tracks laid behind it as it goes
     (the last few hundred units of them kept); a little dust off the back
     wheels. Out past where the sun's shadows are drawn (the shadow box
     covers the board and a little round it), a soft shadow of its own
     under it and under each of the crew, long, away from the low sun, so
     it doesn't float.
   - Every few legs it drives to a rock and stops: the amber beacon on its
     roof blinks; one of the crew (sometimes two) climbs out at the back
     hatch, walks round to the rock, kneels at it a while (puffs of dust
     where they work) and stands with a sample case, the other standing by
     to watch; they walk back, get in, and it drives on.

   All in the board's own frame (luna-fx.js hangs it with the props).
   Nothing here touches play.

   Test hooks: window.__LUNA_ROVER__() its state; a number in
   window.__LUNA_ROVER_WARP__ runs its time that much faster. */

import * as THREE from "three";
import { OFF_X, OFF_Z } from "../engine/constants.js";
import { std, mesh, boxM, glowSprite, personFig, personH, PAL, cv, tex } from "./luna-models.js";

const CELL = 0.25, REACH = 22;
const S = 0.55;                  // the rover's scale (in scale with the people: a person stands a third of its height)
const SPEED = 0.16, ACCEL = 0.06, BRAKE = 0.05, PIVOT = 0.6;
const WALK = 0.11, STRIDE_S = 0.3;
const BODY = 0.2;                // the rover, round its middle
// A cell is open with nothing standing within this of its middle: the rover's own reach and a cell's half
// diagonal (0.18), so wherever on a way through open cells it is, nothing's within BODY of its middle.
const HALF_DIAG = CELL * Math.SQRT1_2, PAD = BODY + HALF_DIAG;
const STEEP = 0.3;               // the slope (and broken ground) it keeps off
const SECTORS = 8;
const TRACK_STEP = 0.04, TRACK_CAP = 6000;
const START = { x: 7.4, z: -5.0, ry: 2.9 }; // where it stood parked
const hooks = () => typeof window !== "undefined" && !!window.__EC_TEST_HOOKS__;

let PUFF_T = null, BLOB_T = null;
function blobTexture() {
  if (BLOB_T) return BLOB_T;
  const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.6, "rgba(0,0,0,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (BLOB_T = tex(c, false));
}
function puffTexture() {
  if (PUFF_T) return PUFF_T;
  const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(200,196,188,0.9)"); g.addColorStop(0.5, "rgba(180,176,168,0.35)"); g.addColorStop(1, "rgba(160,156,148,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (PUFF_T = tex(c));
}

/* ---- the rover itself, as it stood (luna-fx.js's), with a beacon and tail lights ---- */
function roverModel() {
  const g = new THREE.Group(), own = [];
  const keep = (m) => { own.push(m.geometry); return m; };
  const white = std("#e6e8ea", { roughness: 0.5 }), dark = std("#1c1e22", { roughness: 0.8 }), glass = std("#0e1a28", { roughness: 0.1, metalness: 0.5 }), band = std("#ff7a1a", { roughness: 0.5 });
  const R = 0.13, Lc = 0.42, y0 = 0.3;
  const cab = keep(mesh(new THREE.CylinderGeometry(R, R, Lc, 28), white, 0, y0, 0)); cab.rotation.z = Math.PI / 2; g.add(cab);
  const back = keep(mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), white, -Lc / 2, y0, 0)); back.rotation.z = Math.PI / 2; g.add(back);
  // the hatch, a ring on the back
  const hatch = keep(mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 24), std("#9aa0a7", { roughness: 0.5 }), -Lc / 2 - R * 0.86, y0 - 0.01, 0)); hatch.rotation.y = Math.PI / 2; g.add(hatch);
  const nose = keep(mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass, Lc / 2, y0, 0)); nose.rotation.z = -Math.PI / 2; g.add(nose);
  const stripe = keep(mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 0.025, 28, 1, true), band, -0.06, y0, 0)); stripe.rotation.z = Math.PI / 2; g.add(stripe);
  g.add(keep(boxM(0.62, 0.05, 0.34, dark, 0, 0.13, 0)));
  const wheels = [];
  for (const wx of [-0.24, 0, 0.24]) for (const sg of [-1, 1]) {
    const w = keep(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18), dark, wx, 0.08, sg * 0.2)); w.rotation.x = Math.PI / 2; g.add(w);
    // a pale hub off the middle, so the wheel's turning shows
    const hub = keep(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 8), std("#9aa0a7", { roughness: 0.5 }), 0.035, 0, 0)); w.add(hub); wheels.push(w);
  }
  g.add(keep(boxM(0.012, 0.26, 0.012, white, -0.2, y0 + R + 0.1, 0.05)));
  const dish = keep(mesh(new THREE.SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), std("#e6e8ea", { roughness: 0.5, side: THREE.DoubleSide }), -0.2, y0 + R + 0.24, 0.05)); dish.rotation.x = -0.7; g.add(dish);
  const lamp = glowSprite("#e8f4ff", 0.4, 0.9); lamp.position.set(0.4, 0.28, 0); g.add(lamp);
  const tails = [-1, 1].map((sg) => { const t = glowSprite("#ff3a2a", 0.1, 0.7); t.position.set(-0.33, 0.2, sg * 0.07); g.add(t); return t; });
  const beaconCap = keep(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), std("#ffb43a", { roughness: 0.3, emissive: new THREE.Color("#ff9a1a"), emissiveIntensity: 0.4 }), 0.06, y0 + R + 0.012, 0)); g.add(beaconCap);
  const beacon = glowSprite("#ffb43a", 0.32, 0); beacon.position.set(0.06, y0 + R + 0.04, 0); g.add(beacon);
  return { g, wheels, beacon, sprites: [lamp, ...tails, beacon], own };
}

/* ---- a binary heap of cells by cost ---- */
function heap() {
  const k = [], v = [];
  return {
    get size() { return k.length; },
    push(key, val) { k.push(key); v.push(val); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } },
    pop() {
      const top = v[0], lk = k.pop(), lv = v.pop();
      if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
      return top;
    },
  };
}

const lerpT = (a, b, ta, tb, t) => { const u = (t - ta) / (tb - ta); return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }; };
// a centripetal Catmull-Rom curve through the points, about `step` apart
function spline(P, step) {
  const out = [], Q = [P[0], ...P, P[P.length - 1]], d = (a, b) => Math.max(0.01, Math.sqrt(Math.hypot(b.x - a.x, b.z - a.z)));
  for (let i = 1; i < Q.length - 2; i++) {
    const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2], t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / step));
    for (let k = 0; k < n; k++) {
      const t = t1 + ((t2 - t1) * k) / n;
      const A1 = lerpT(p0, p1, 0, t1, t), A2 = lerpT(p1, p2, t1, t2, t), A3 = lerpT(p2, p3, t2, t3, t);
      out.push(lerpT(lerpT(A1, A2, 0, t2, t), lerpT(A2, A3, t1, t3, t), t1, t2, t));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
function chaikin(P, rounds = 3) {
  let A = P;
  for (let r = 0; r < rounds; r++) {
    const B = [A[0]];
    for (let i = 0; i < A.length - 1; i++) { const a = A[i], b = A[i + 1]; B.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 }); }
    B.push(A[A.length - 1]); A = B;
  }
  return A;
}
// the same line, its points `step` apart, with the distance along it
function resample(P, step) {
  const out = [{ x: P[0].x, z: P[0].z, s: 0 }];
  let s = 0, carry = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    let u = step - carry;
    while (u <= L) { s += step; out.push({ x: a.x + ((b.x - a.x) * u) / L, z: a.z + ((b.z - a.z) * u) / L, s }); u += step; }
    carry = L - (u - step);
  }
  const last = P[P.length - 1], end = out[out.length - 1], tail = Math.hypot(last.x - end.x, last.z - end.z);
  if (tail > 1e-4) out.push({ x: last.x, z: last.z, s: end.s + tail });
  return out;
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the heading (rotation.y) of the rover facing (dx, dz): its nose is its own +x
const headingOf = (dx, dz) => Math.atan2(-dz, dx);
// the people face their own +z
const facingOf = (dx, dz) => Math.atan2(dx, dz);

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
// sun: the sun's direction in the board's frame (it turns with the board); board: the group it hangs on; key: the
// sun's light (its shadow box), when there is one.
export function createRover({ at, obstacles, tier = "high", seed = 7177, sun = null, board = null, key = () => null }) {
  const built0 = clock();
  let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const group = new THREE.Group(); group.name = "luna-rover";
  const circles = obstacles.circles || [], rects = obstacles.rects || [];
  const BX = OFF_X + 1.6, BZ = OFF_Z + 1.6;
  const onBoard = (x, z, m = 0) => Math.abs(x) < BX + m && Math.abs(z) < BZ + m;
  // how far (x, z) is from the nearest thing standing, past its own size
  const clearOf = (x, z, skip = null) => {
    let d = Infinity;
    for (const c of circles) if (c !== skip) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
    for (const r of rects) d = Math.min(d, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1)));
    return d;
  };
  // the ground's slope there, and how broken (a crater's floor or rim against the ground round it)
  const roughAt = (x, z) => {
    const e = 0.2, h0 = at(x, z), a = at(x + e, z), b = at(x - e, z), c = at(x, z + e), d = at(x, z - e);
    return Math.max(Math.hypot(a - b, c - d) / (2 * e), Math.abs(h0 - (a + b + c + d) / 4) * 6);
  };

  /* ---- the grid: what's open, what it costs, what can be reached ---- */
  const N = Math.ceil((2 * REACH) / CELL), mid = (i) => -REACH + (i + 0.5) * CELL, cellOf = (v) => Math.max(0, Math.min(N - 1, Math.floor((v + REACH) / CELL)));
  const cost = new Float32Array(N * N).fill(Infinity);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = mid(i), z = mid(j);
    if (Math.hypot(x, z) > REACH - 0.6 || onBoard(x, z, HALF_DIAG) || clearOf(x, z) <= PAD) continue;
    const g = roughAt(x, z);
    // (dearer close by the board, so it doesn't circle it like a track: it goes by, and out again)
    const nearB = Math.max(0, 1 - Math.hypot(Math.max(Math.abs(x) - BX, 0), Math.max(Math.abs(z) - BZ, 0)) / 3);
    if (g < STEEP) cost[j * N + i] = 1 + 5 * g + 4 * nearB;
  }
  // the biggest stretch of open ground, joined up: all it's ever sent to
  const comp = new Int32Array(N * N).fill(-1);
  let best = -1, bestN = 0;
  for (let k0 = 0, id = 0; k0 < N * N; k0++) {
    if (cost[k0] === Infinity || comp[k0] >= 0) continue;
    const q = [k0]; comp[k0] = id;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % N, j = (k / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const kk = b * N + a; if (cost[kk] < Infinity && comp[kk] < 0) { comp[kk] = id; q.push(kk); } }
    }
    if (q.length > bestN) { bestN = q.length; best = id; }
    id++;
  }
  const reach = new Uint8Array(N * N);
  const cells = [];
  for (let k = 0; k < N * N; k++) if (comp[k] === best) { reach[k] = 1; cells.push(k); }
  const open = (x, z) => Math.hypot(x, z) < REACH && reach[cellOf(z) * N + cellOf(x)] === 1;
  const lineOpen = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.1)); for (let t = 0; t <= n; t++) { const u = t / n; if (!open(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u)) return false; } return true; };
  const nearestOpen = (x, z) => { let bk = -1, bd = Infinity; for (const k of cells) { const d = Math.hypot(mid(k % N) - x, mid((k / N) | 0) - z); if (d < bd) { bd = d; bk = k; } } return bk < 0 ? null : { x: mid(bk % N), z: mid((bk / N) | 0) }; };
  const sectorOf = (x, z) => Math.min(SECTORS - 1, Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * SECTORS));

  /* ---- the ways from a point, on the grid ---- */
  // One search (Dijkstra) from a, its cost to every cell it can reach: from it, the way to any of them, and how long.
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  const G_ = new Float32Array(N * N), CAME = new Int32Array(N * N), DONE = new Uint8Array(N * N);
  function flood(a) {
    const from = cellOf(a.z) * N + cellOf(a.x);
    if (!reach[from]) return null;
    G_.fill(Infinity); CAME.fill(-1); DONE.fill(0);
    const H = heap(); G_[from] = 0; H.push(0, from);
    while (H.size) {
      const cur = H.pop();
      if (DONE[cur]) continue; DONE[cur] = 1;
      const ci = cur % N, cj = (cur / N) | 0;
      for (const [di, dj, dd] of NB) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i; if (!reach[k] || DONE[k]) continue;
        if (di && dj && (!reach[cj * N + i] || !reach[j * N + ci])) continue; // no corner cut past something shut
        const ng = G_[cur] + dd * (cost[cur] + cost[k]) * 0.5;
        if (ng < G_[k]) { G_[k] = ng; CAME[k] = cur; H.push(ng, k); }
      }
    }
    return { a: { x: a.x, z: a.z }, from };
  }
  // the cells of the way from the flood's start to b (its ends the points themselves), or null
  function cellsTo(F, b) {
    const to = cellOf(b.z) * N + cellOf(b.x);
    if (!reach[to] || G_[to] === Infinity) return null;
    const out = [];
    for (let k = to, n = 0; k >= 0 && n < N * N; k = k === F.from ? -1 : CAME[k], n++) out.push({ x: mid(k % N), z: mid((k / N) | 0) });
    out.reverse();
    out[0] = { x: F.a.x, z: F.a.z }; out[out.length - 1] = { x: b.x, z: b.z };
    return out;
  }
  const lengthOf = (P) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z); return L; };
  // (the one-off at the start: the way from a to b)
  const astar = (a, b) => (flood(a) ? cellsTo({ a, from: cellOf(a.z) * N + cellOf(a.x) }, b) : null);
  // straight where it can be: from each point, as far on as the way's clear (reach doubled while it is, then halved back)
  function pull(P) {
    const out = [P[0]], last = P.length - 1;
    for (let i = 0; i < last;) {
      let ok = i + 1, step = 1;
      while (ok + step <= last && lineOpen(P[i], P[ok + step])) { ok += step; step *= 2; }
      for (step = Math.floor(step / 2); step >= 1; step = Math.floor(step / 2)) if (ok + step <= last && lineOpen(P[i], P[ok + step])) ok += step;
      out.push(P[ok]); i = ok;
    }
    return out;
  }
  const allOpen = (P) => P.every((p) => open(p.x, p.z));
  // From where it is, the way it faces: the start of a plan (one search from just ahead of it, if that's open).
  function planFrom(x, z, ry) {
    const start = { x, z }, fx = Math.cos(ry), fz = -Math.sin(ry), ahead = { x: x + fx * 0.45, z: z + fz * 0.45 };
    const lead = open(ahead.x, ahead.z) && lineOpen(start, ahead), F = flood(lead ? ahead : start);
    return F && { F, start, lead };
  }
  // the way there in cells, and how long it is (from the rover), or null
  function wayTo(PL, b) { const raw = cellsTo(PL.F, b); return raw && { raw, L: lengthOf(raw) + (PL.lead ? 0.45 : 0) }; }
  // the way smoothed for driving: the points 0.05 apart, or null
  function smooth(PL, raw) {
    const head = PL.lead ? [PL.start] : [];
    let P = resample(spline([...head, ...pull(raw)], 0.05), 0.05);
    if (!allOpen(P)) P = resample(chaikin([...head, ...pull(raw)]), 0.05);
    if (!allOpen(P)) P = resample(chaikin([...head, ...raw]), 0.05);
    return P.length > 1 ? P : null;
  }

  /* ---- the rover, its tracks, its dust ---- */
  const model = roverModel(), body = model.g;
  body.scale.setScalar(S); body.rotation.order = "YZX"; group.add(body);
  const trackM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const tracks = [-1, 1].map((side) => {
    const pos = new Float32Array(TRACK_CAP * 6), idx = new Uint16Array((TRACK_CAP - 1) * 6);
    for (let k = 0; k < TRACK_CAP - 1; k++) { const a = 2 * k; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k * 6); }
    const geo = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3);
    pa.setUsage(THREE.DynamicDrawUsage); geo.setAttribute("position", pa); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), REACH * 1.5);
    const m = new THREE.Mesh(geo, trackM); m.castShadow = false; m.receiveShadow = false; m.raycast = () => {}; m.name = "luna-rover-track"; group.add(m);
    return { side, pos, pa, geo, n: 0, lastX: null, lastZ: null, dirty: Infinity };
  });
  function trackAt(x, z, ry, force = false) {
    const fx = Math.cos(ry), fz = -Math.sin(ry), bx = Math.sin(ry), bz = Math.cos(ry);
    const rx = x - fx * 0.24 * S, rz = z - fz * 0.24 * S; // the back axle
    for (const T of tracks) {
      const cx = rx + bx * T.side * 0.2 * S, cz = rz + bz * T.side * 0.2 * S;
      if (!force && T.lastX !== null && Math.hypot(cx - T.lastX, cz - T.lastZ) < TRACK_STEP) continue;
      // full: the oldest stretch let go
      if (T.n === TRACK_CAP) { const drop = 600; T.pos.copyWithin(0, drop * 6, TRACK_CAP * 6); T.n -= drop; T.dirty = 0; }
      const w = 0.03 * S, o = T.n * 6;
      for (const [k, sg] of [[0, -1], [3, 1]]) { const vx = cx + bx * w * sg, vz = cz + bz * w * sg; T.pos[o + k] = vx; T.pos[o + k + 1] = at(vx, vz) + 0.006; T.pos[o + k + 2] = vz; }
      T.n++; T.lastX = cx; T.lastZ = cz; T.dirty = Math.min(T.dirty, o);
    }
  }
  // what's new in the tracks, sent up once a frame
  function flushTracks() {
    for (const T of tracks) {
      if (T.dirty === Infinity) continue;
      T.pa.updateRange.offset = T.dirty; T.pa.updateRange.count = T.n * 6 - T.dirty; T.pa.needsUpdate = true;
      T.geo.setDrawRange(0, Math.max(0, (T.n - 1) * 6)); T.dirty = Infinity;
    }
  }
  const puffs = [];
  function puff(x, z, vx, vz, vy, size, life, op) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0xbab6ae, transparent: true, opacity: 0, depthWrite: false }));
    const y = at(x, z) + 0.02; s.position.set(x, y, z); s.scale.set(size, size, 1); group.add(s);
    puffs.push({ s, vx, vz, vy, y0: y, age: 0, life, size, op });
  }
  function tickPuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.age += dt;
      if (p.age >= p.life) { group.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); continue; }
      p.vy -= 1.62 * dt; p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y = Math.max(p.y0 - 0.02, p.s.position.y + p.vy * dt);
      const u = p.age / p.life; p.s.material.opacity = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * p.op;
      const g = p.size * (1 + u); p.s.scale.set(g, g, 1);
    }
  }

  /* ---- the crew ---- */
  const POSES = { stand: { pose: "stand" }, walk: { pose: "walk" }, walk2: { pose: "walk2" }, kneel: { pose: "kneel" }, carry: { pose: "carry" }, walkC: { pose: "walk", carrying: true }, walk2C: { pose: "walk2", carrying: true } };
  const crew = ["dark", "light"].map((side, n) => {
    const g = new THREE.Group(); g.visible = false; g.name = `luna-rover-crew-${n}`; group.add(g);
    return { n, side, g, h: personH(4100 + n * 13), poses: {}, pose: null, steps: [], x: 0, z: 0, face: 0, walked: 0, out: false };
  });
  const poseOf = (c, name) => {
    let f = c.poses[name];
    if (!f) { f = personFig({ ...POSES[name], eva: true, h: c.h, band: PAL[c.side].accent }); f.visible = false; c.g.add(f); c.poses[name] = f; }
    return f;
  };
  const show = (c, name) => { if (c.pose === name) return; if (c.pose) c.poses[c.pose].visible = false; poseOf(c, name).visible = true; c.pose = name; };

  /* ---- shadows of its own, out past the sun's shadow box ---- */
  const away = sun ? new THREE.Vector2(-sun.x, -sun.z).normalize() : new THREE.Vector2(1, 0), lean = sun ? Math.max(0.15, sun.y / Math.hypot(sun.x, sun.z)) : 0.32;
  const blobGeo = new THREE.PlaneGeometry(1, 1), blobM = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const blobOf = (h, w) => { const m = new THREE.Mesh(blobGeo, blobM); m.raycast = () => {}; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.userData.len = h / lean; m.userData.w = w; group.add(m); return m; };
  const roverBlob = blobOf(0.26, 0.24), crewBlobs = crew.map((c) => blobOf(c.h * 1.15, 0.07));
  const UP = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), qTilt = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const yaw = Math.atan2(-away.y, away.x);
  qYaw.setFromAxisAngle(UP, yaw);
  // laid on the ground from (x, z), running away from the sun
  function lay(m, x, z, on) {
    m.visible = on;
    if (!on) return;
    const L = m.userData.len, cx = x + away.x * L * 0.42, cz = z + away.y * L * 0.42, e = 0.15;
    nrm.set(at(cx - e, cz) - at(cx + e, cz), 2 * e, at(cx, cz - e) - at(cx, cz + e)).normalize();
    qTilt.setFromUnitVectors(UP, nrm);
    m.quaternion.copy(qTilt).multiply(qYaw).multiply(qFlat);
    m.position.set(cx, at(cx, cz) + 0.008, cz); m.scale.set(L * 1.05, m.userData.w, 1);
  }
  const wpos = new THREE.Vector3();
  let blobOp = 0;
  // whether a point of the board's frame lies within the sun's shadow box (its own shadow drawn there)
  function inShadowBox(x, y, z) {
    const k = key();
    if (!k || !k.castShadow || !board) return false;
    const cam = k.shadow.camera;
    wpos.set(x, y, z); board.localToWorld(wpos); wpos.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    return Math.abs(wpos.x) < 0.9 && Math.abs(wpos.y) < 0.9 && Math.abs(wpos.z) < 1;
  }
  // built a few at a time after the start, so the first outing doesn't hold a frame up
  const warm = []; for (const c of crew) for (const name of Object.keys(POSES)) warm.push([c, name]);
  let warmAt = 0;

  /* ---- what it's doing ---- */
  const R = { x: START.x, z: START.z, ry: START.ry, v: 0, path: null, d: 0, stopAtEnd: false, brakeEnd: false, next: null, rock: null, phase: "drive", t: 0, y: 0, pitch: 0, roll: 0, odo: 0, sincePuff: 0, parkedAt: null };
  const stats = { legs: 0, stops: 0, outings: 0, pairs: 0, kneels: 0, minClear: Infinity, boardHits: 0, maxRadius: 0, visits: new Float64Array(SECTORS), sectorsSeen: new Set(), maxSpeed: 0, movedWhileOut: 0, worstLift: 0, log: [], planMs: 0, buildMs: 0 };
  let wanderSince = 0, outing = null;
  const rocks = circles.filter((c) => c.kind === "rock" && c.r >= 0.05 && c.r <= 0.3 && Math.hypot(c.x, c.z) > 8 && Math.hypot(c.x, c.z) < REACH - 1.5);
  const used = new Set();

  // a place in the sector it's been in least (not its own), and a stop by a rock now and then; from (x, z) facing ry
  function nextLeg(x, z, ry) {
    const PL = planFrom(x, z, ry);
    if (!PL) return null;
    const here = sectorOf(x, z), order = [...Array(SECTORS).keys()].filter((k) => k !== here).sort((a, b) => stats.visits[a] - stats.visits[b] + (rnd() - 0.5) * 2);
    const stop = wanderSince >= 2 || (wanderSince >= 1 && rnd() < 0.45) || stats.legs === 0;
    // (the first, a rock not far off, so an outing comes soon after the start)
    if (stats.legs === 0) {
      const near = rocks.filter((c) => { const dd = Math.hypot(c.x - x, c.z - z); return dd > 2.5 && dd < 7; }).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      for (const c of near.slice(0, 6)) { const leg = besideRock(PL, c, x, z); if (leg) return leg; }
    }
    // a stop: a rock within a hop, in the sectors it's been in least first
    if (stop) for (const sec of order) {
      const cand = rocks.filter((c) => { const dd = Math.hypot(c.x - x, c.z - z); return !used.has(c) && sectorOf(c.x, c.z) === sec && dd > 3 && dd < 12; });
      for (let tries = 0; tries < 6 && cand.length; tries++) {
        const leg = besideRock(PL, cand.splice(Math.floor(rnd() * cand.length), 1)[0], x, z);
        if (leg) return leg;
      }
    }
    // a hop of 4 to 11 to somewhere it's been least (its sector's time, a little chance in it), not hard by the board,
    // and not one it could only reach the long way round
    const hops = [];
    for (let tries = 0; tries < 80; tries++) {
      const k = cells[Math.floor(rnd() * cells.length)], gx = mid(k % N), gz = mid((k / N) | 0), dd = Math.hypot(gx - x, gz - z);
      if (dd < 4 || dd > 11 || Math.hypot(gx, gz) > REACH - 1.5) continue;
      // (behind it costs more: it sweeps on rather than turning back over its own tracks)
      const back = Math.max(0, -Math.cos(wrapA(headingOf(gx - x, gz - z) - ry)));
      hops.push({ x: gx, z: gz, dd, score: stats.visits[sectorOf(gx, gz)] + rnd() * 40 + (cost[k] - 1) * 30 + back * 90 });
    }
    hops.sort((a, b) => a.score - b.score);
    // (in a corner, every hop the long way round: the least roundabout of them)
    let fallback = null, worst = Infinity;
    for (const h of hops.slice(0, 16)) {
      const W = wayTo(PL, h);
      if (!W) continue;
      if (direct(W.L, h.dd)) { const P = smooth(PL, W.raw); if (P) return { P, rock: null }; }
      const over = W.L / h.dd;
      if (over < worst) { worst = over; fallback = W; }
    }
    if (fallback) { const P = smooth(PL, fallback.raw); if (P) return { P, rock: null }; }
    // (anywhere at all)
    for (let tries = 0; tries < 60; tries++) {
      const k = cells[Math.floor(rnd() * cells.length)], W = wayTo(PL, { x: mid(k % N), z: mid((k / N) | 0) }), P = W && smooth(PL, W.raw);
      if (P) return { P, rock: null };
    }
    return null;
  }
  // a way no more than so much longer than the straight line (not round the far side of the board)
  const direct = (L, dd) => L <= 1.7 * dd + 3;
  // a spot beside the rock to stop at, from which it's a clear walk to it
  function besideRock(PL, c, x, z) {
    for (let k = 0; k < 10; k++) {
      const a = rnd() * Math.PI * 2, dd = c.r + 0.5 + rnd() * 0.25, p = { x: c.x + Math.cos(a) * dd, z: c.z + Math.sin(a) * dd };
      if (!open(p.x, p.z) || clearOf((p.x + c.x) / 2, (p.z + c.z) / 2, c) < 0.08) continue;
      const W = wayTo(PL, p);
      if (W && direct(W.L, Math.hypot(p.x - x, p.z - z))) { const P = smooth(PL, W.raw); if (P) { used.add(c); return { P, rock: c }; } }
    }
    return null;
  }
  // facing well away from where the way starts: it turns on the spot first
  const turnFirst = (P, ry) => { const p0 = P[0], p1 = P[Math.min(P.length - 1, 6)]; return Math.abs(wrapA(headingOf(p1.x - p0.x, p1.z - p0.z) - ry)) > 0.35; };
  // (how long a plan takes, for the tests)
  const timedLeg = (x, z, ry) => { const t0 = clock(), leg = nextLeg(x, z, ry); stats.planMs = Math.max(stats.planMs, clock() - t0); return leg; };
  function beginLeg(leg = timedLeg(R.x, R.z, R.ry)) {
    R.next = null; R.brakeEnd = false;
    if (!leg) { R.phase = "wait"; R.t = 0; R.path = null; return; }
    R.path = leg.P; R.d = 0; R.rock = leg.rock; R.stopAtEnd = !!leg.rock; stats.legs++;
    const e = leg.P[leg.P.length - 1]; stats.log.push({ from: [+R.x.toFixed(1), +R.z.toFixed(1)], to: [+e.x.toFixed(1), +e.z.toFixed(1)], L: +e.s.toFixed(1), rock: !!leg.rock }); if (stats.log.length > 40) stats.log.shift();
    if (leg.rock) wanderSince = 0; else wanderSince++;
    if (turnFirst(R.path, R.ry)) { R.phase = "turn"; R.v = 0; } else R.phase = "drive";
  }
  // where along the path, and which way it runs there
  function pointAt(d) {
    const P = R.path, step = P[1].s - P[0].s || 0.05, i = Math.max(0, Math.min(P.length - 2, Math.floor(d / step)));
    const a = P[i], b = P[i + 1], u = Math.max(0, Math.min(1, (d - a.s) / (b.s - a.s || 1)));
    return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, i };
  }
  function headingAlong(d) {
    const P = R.path, L = P[P.length - 1].s, a = pointAt(Math.max(0, Math.min(L, d - 0.06))), b = pointAt(Math.max(0, Math.min(L, d + 0.06)));
    return Math.hypot(b.x - a.x, b.z - a.z) > 1e-5 ? headingOf(b.x - a.x, b.z - a.z) : R.ry;
  }

  /* ---- an outing to the rock ---- */
  // a point in the rover's own frame (lx forward, lz to its right), on the ground
  const local = (lx, lz) => { const fx = Math.cos(R.ry), fz = -Math.sin(R.ry), bx = Math.sin(R.ry), bz = Math.cos(R.ry); return { x: R.x + fx * lx + bx * lz, z: R.z + fz * lx + bz * lz }; };
  const toLocal = (p) => { const dx = p.x - R.x, dz = p.z - R.z, fx = Math.cos(R.ry), fz = -Math.sin(R.ry), bx = Math.sin(R.ry), bz = Math.cos(R.ry); return { lx: dx * fx + dz * fz, lz: dx * bx + dz * bz }; };
  // out of the hatch at the back, round the rover's side to `to`
  function walkOut(to) {
    const H = local(-0.27, 0), L = toLocal(to);
    if (L.lx < -0.27) return [H, to];
    const sg = L.lz >= 0 ? 1 : -1, P = local(-0.27, sg * 0.26), Q = local(Math.min(0.34, L.lx), sg * 0.26);
    return Math.hypot(Q.x - P.x, Q.z - P.z) > 0.05 ? [H, P, Q, to] : [H, P, to];
  }
  function beginOuting() {
    const c = R.rock, a = Math.atan2(R.z - c.z, R.x - c.x);
    // where the one with the sample kneels: the rock's near side, a little round toward the rover's flank
    const kn = { x: c.x + Math.cos(a + 0.35) * (c.r + 0.06), z: c.z + Math.sin(a + 0.35) * (c.r + 0.06) };
    const pair = rnd() < 0.45, first = crew[stats.outings % 2], second = crew[(stats.outings + 1) % 2];
    stats.outings++; if (pair) stats.pairs++;
    outing = { rock: c, kneel: kn, sampled: false, crew: pair ? [first, second] : [first], t: 0, puffAt: 0, doneAt: null };
    const there = walkOut(kn), back = [...there].reverse();
    first.steps = [{ wait: 1.0 }, { appear: true }, { walk: there }, { pose: "kneel", for: 5.5, face: c, work: true }, { pose: "carry", for: 0.7, face: c }, { walk: back, carry: true }, { vanish: true }];
    if (pair) {
      const side = { x: kn.x + Math.cos(a + 1.5) * 0.17, z: kn.z + Math.sin(a + 1.5) * 0.17 }, there2 = walkOut(side);
      second.steps = [{ wait: 1.7 }, { appear: true }, { walk: there2 }, { pose: "stand", until: "sampled", face: kn }, { walk: [...there2].reverse() }, { vanish: true }];
    }
    for (const m of outing.crew) { m.out = false; m.g.visible = false; m.walked = 0; }
  }
  function tickCrew(m, dt) {
    const st = m.steps[0];
    if (!st) return;
    if (st.wait !== undefined) { st.wait -= dt; if (st.wait <= 0) m.steps.shift(); return; }
    if (st.appear) {
      const H = local(-0.27, 0); m.x = H.x; m.z = H.z; m.face = facingOf(-Math.cos(R.ry), Math.sin(R.ry)); m.out = true; m.g.visible = true; show(m, "stand");
      m.g.position.set(m.x, at(m.x, m.z), m.z); m.g.rotation.y = m.face; m.steps.shift(); return;
    }
    if (st.vanish) { m.out = false; m.g.visible = false; m.steps.shift(); return; }
    if (st.walk) {
      const W = st.walk; st.i = st.i || 1;
      let left = WALK * dt;
      while (left > 0 && st.i < W.length) {
        const to = W[st.i], dx = to.x - m.x, dz = to.z - m.z, L = Math.hypot(dx, dz);
        if (L <= left) { m.x = to.x; m.z = to.z; left -= L; st.i++; continue; }
        m.x += (dx / L) * left; m.z += (dz / L) * left; m.face = facingOf(dx, dz); left = 0;
      }
      m.walked += WALK * dt;
      const stride = Math.floor(m.walked / (WALK * STRIDE_S)) % 2, ph = (m.walked / (WALK * STRIDE_S)) % 1;
      show(m, (stride ? "walk2" : "walk") + (st.carry ? "C" : ""));
      m.g.position.set(m.x, at(m.x, m.z) + 0.007 * Math.sin(Math.PI * ph), m.z); m.g.rotation.y = m.face;
      if (st.i >= W.length) m.steps.shift();
      return;
    }
    if (st.pose) {
      if (!st.begun) { st.begun = true; if (st.work) stats.kneels++; }
      show(m, st.pose);
      if (st.face) m.face = facingOf(st.face.x - m.x, st.face.z - m.z);
      m.g.position.set(m.x, at(m.x, m.z), m.z); m.g.rotation.y = m.face;
      // at work: puffs of dust where the rock's chipped
      if (st.work && outing) { outing.puffAt -= dt; if (outing.puffAt <= 0) { outing.puffAt = 1.1 + rnd() * 0.6; const c = outing.rock, a = Math.atan2(m.z - c.z, m.x - c.x); if (tier !== "low") for (let k = 0; k < 3; k++) puff(c.x + Math.cos(a) * c.r * 0.9, c.z + Math.sin(a) * c.r * 0.9, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08, 0.08 + rnd() * 0.1, 0.035, 0.9, 0.45); } }
      if (st.until) { if (outing && outing[st.until]) m.steps.shift(); return; }
      st.for -= dt;
      if (st.for <= 0) { if (st.work && outing) outing.sampled = true; m.steps.shift(); }
      return;
    }
  }

  /* ---- a step of the world ---- */
  function placeBody(dt, snap) {
    const fx = Math.cos(R.ry), fz = -Math.sin(R.ry), bx = Math.sin(R.ry), bz = Math.cos(R.ry);
    const hF = at(R.x + fx * 0.3 * S, R.z + fz * 0.3 * S), hB = at(R.x - fx * 0.3 * S, R.z - fz * 0.3 * S), hR = at(R.x + bx * 0.22 * S, R.z + bz * 0.22 * S), hL = at(R.x - bx * 0.22 * S, R.z - bz * 0.22 * S);
    const ty = (hF + hB + hR + hL) / 4, tp = Math.atan2(hF - hB, 0.6 * S), tr = -Math.atan2(hR - hL, 0.44 * S), k = snap ? 1 : 1 - Math.exp(-dt / 0.2);
    R.y += (ty - R.y) * k; R.pitch += (tp - R.pitch) * k; R.roll += (tr - R.roll) * k;
    body.position.set(R.x, R.y, R.z); body.rotation.set(R.roll, R.ry, R.pitch);
    stats.worstLift = Math.max(stats.worstLift, Math.abs(R.y - ty));
  }
  function step(dt, quiet = false) {
    if (R.phase === "turn") {
      const p0 = R.path[0], p1 = R.path[Math.min(R.path.length - 1, 6)], want = headingOf(p1.x - p0.x, p1.z - p0.z), da = wrapA(want - R.ry);
      R.ry += Math.sign(da) * Math.min(Math.abs(da), PIVOT * dt);
      if (Math.abs(da) < 0.02) R.phase = "drive";
      for (const w of model.wheels) w.rotation.y += (w.position.z > 0 ? 1 : -1) * PIVOT * dt * 2;
    } else if (R.phase === "drive" && R.path) {
      const P = R.path, L = P[P.length - 1].s, left = L - R.d;
      // the next leg, planned before it gets there: if it starts with a turn on the spot, it brakes for it
      if (!R.stopAtEnd && !R.next && left < 0.8) { const e = P[P.length - 1]; R.next = timedLeg(e.x, e.z, headingAlong(L)) || "none"; if (R.next !== "none" && turnFirst(R.next.P, headingAlong(L))) R.brakeEnd = true; }
      // slower round a bend: how far the way turns over the next stretch
      const bend = Math.abs(wrapA(headingAlong(Math.min(L, R.d + 0.5)) - headingAlong(R.d)));
      let want = SPEED * Math.max(0.4, 1 - bend * 0.9);
      if (R.stopAtEnd || R.brakeEnd) want = Math.min(want, Math.sqrt(2 * BRAKE * Math.max(0, left)));
      R.v += Math.max(-BRAKE * 2 * dt, Math.min(ACCEL * dt, want - R.v));
      // (all but there: the last hair taken, so it doesn't stand short of it)
      const settle = R.v < 0.004 && (R.stopAtEnd || R.brakeEnd) && left < 0.02;
      if (settle) R.v = 0;
      const go = settle ? left : Math.min(left, Math.max(0, R.v) * dt);
      R.d += go; R.odo += go;
      const p = pointAt(R.d); R.x = p.x; R.z = p.z; R.ry = headingAlong(R.d);
      for (const w of model.wheels) w.rotation.y -= (go / (0.08 * S)) * (w.position.z > 0 ? 1 : 1);
      if (go > 0) trackAt(R.x, R.z, R.ry);
      if (!quiet && tier !== "low" && R.v > 0.05) {
        R.sincePuff += dt;
        if (R.sincePuff > 0.22) {
          R.sincePuff = 0;
          const fx = Math.cos(R.ry), fz = -Math.sin(R.ry), bx = Math.sin(R.ry), bz = Math.cos(R.ry), sg = rnd() < 0.5 ? -1 : 1;
          puff(R.x - fx * 0.27 * S + bx * sg * 0.2 * S, R.z - fz * 0.27 * S + bz * sg * 0.2 * S, -fx * 0.05 + (rnd() - 0.5) * 0.04, -fz * 0.05 + (rnd() - 0.5) * 0.04, 0.12 + rnd() * 0.12, 0.05 + rnd() * 0.03, 1.1, 0.35);
        }
      }
      stats.visits[sectorOf(R.x, R.z)] += dt; stats.sectorsSeen.add(sectorOf(R.x, R.z));
      stats.maxSpeed = Math.max(stats.maxSpeed, R.v);
      if (left - go <= 1e-4) {
        if (R.stopAtEnd) { R.v = 0; R.phase = "parked"; R.t = 0; R.parkedAt = { x: R.x, z: R.z }; stats.stops++; beginOuting(); }
        else beginLeg(R.next && R.next !== "none" ? R.next : undefined);
      }
    } else if (R.phase === "parked") {
      R.t += dt;
      for (const m of outing.crew) tickCrew(m, dt);
      if (outing.crew.every((m) => !m.steps.length)) {
        if (outing.doneAt === null) outing.doneAt = R.t;
        if (R.t - outing.doneAt > 1.2) { outing = null; beginLeg(); }
      }
    } else if (R.phase === "wait") {
      R.t += dt; if (R.t > 3) beginLeg();
    }
    // the beacon blinks while it's stopped for the crew
    model.beacon.material.opacity = R.phase === "parked" ? (Math.sin(R.t * 7) > 0 ? 0.95 : 0.12) : 0;
    placeBody(dt, false);
    const cl = clearOf(R.x, R.z); if (cl < stats.minClear) stats.minClear = cl;
    if (onBoard(R.x, R.z)) stats.boardHits++;
    stats.maxRadius = Math.max(stats.maxRadius, Math.hypot(R.x, R.z));
    if (R.phase === "parked" && outing && outing.crew.some((m) => m.out) && (R.v > 0 || Math.hypot(R.x - R.parkedAt.x, R.z - R.parkedAt.z) > 1e-6)) stats.movedWhileOut++;
    tickPuffs(dt);
  }

  /* ---- the start: driving in, its tracks behind it ---- */
  {
    const s0 = open(START.x, START.z) ? { x: START.x, z: START.z } : nearestOpen(START.x, START.z) || { x: START.x, z: START.z };
    R.x = s0.x; R.z = s0.z;
    // the way it came: from a place some way off behind it, laid as tracks, arriving here moving the way it faces
    // (smoothed on the grid's own cells, so it keeps to open ground)
    const fx = Math.cos(R.ry), fz = -Math.sin(R.ry);
    for (let tries = 0; tries < 200; tries++) {
      const k = cells[Math.floor(rnd() * cells.length)], x = mid(k % N), z = mid((k / N) | 0), dd = Math.hypot(x - s0.x, z - s0.z);
      if (dd < 5 || dd > 9 || ((s0.x - x) * fx + (s0.z - z) * fz) / dd < (tries < 150 ? 0.5 : -1)) continue;
      const P = astar({ x, z }, s0);
      if (!P || P.length < 3) continue;
      const W = resample(chaikin(P), 0.05);
      for (let i = 1; i < W.length; i++) trackAt(W[i].x, W[i].z, headingOf(W[i].x - W[i - 1].x, W[i].z - W[i - 1].z));
      const a = W[Math.max(0, W.length - 8)], b = W[W.length - 1]; R.ry = headingOf(b.x - a.x, b.z - a.z); R.v = SPEED * 0.8;
      break;
    }
    beginLeg();
    placeBody(0, true);
    flushTracks();
    stats.buildMs = clock() - built0;
  }

  const api = {
    group,
    tick(now, dt) {
      // the crew's poses made a few at a time
      if (warm.length && now - warmAt > 350) { warmAt = now; const [c, name] = warm.shift(); poseOf(c, name); }
      const warp = hooks() && Number(window.__LUNA_ROVER_WARP__) > 0 ? Number(window.__LUNA_ROVER_WARP__) : 1;
      let T = dt * warp;
      while (T > 1e-6) { const h = Math.min(T, 1 / 30); step(h); T -= h; }
      flushTracks();
      // its own shadows, faded in out past the sun's shadow box, out within it
      const want = inShadowBox(R.x, R.y + 0.12, R.z) ? 0 : 0.6;
      blobOp += (want - blobOp) * Math.min(1, dt * 3);
      blobM.opacity = blobOp;
      const on = blobOp > 0.01;
      lay(roverBlob, R.x, R.z, on);
      crew.forEach((m, i) => lay(crewBlobs[i], m.x, m.z, on && m.out));
    },
    // (tests: its time run on by so many seconds at once, nothing drawn between)
    run(seconds) { let T = seconds; while (T > 1e-6) { const h = Math.min(T, 1 / 30); step(h, true); T -= h; } flushTracks(); return api.state(); },
    grid() { return { N, CELL, REACH, open: Array.from(reach), cost: Array.from(cost, (c) => (c === Infinity ? -1 : c)) }; },
    state() {
      return {
        x: R.x, z: R.z, y: R.y, ground: at(R.x, R.z), ry: R.ry, speed: R.v, phase: R.phase, odo: R.odo, legs: stats.legs, stops: stats.stops, outings: stats.outings, pairs: stats.pairs, kneels: stats.kneels,
        out: crew.filter((m) => m.out).length, poses: crew.map((m) => (m.out ? m.pose : null)), crewAt: crew.map((m) => (m.out ? { x: m.x, z: m.z } : null)),
        minClear: stats.minClear, boardHits: stats.boardHits, maxRadius: stats.maxRadius, sectors: [...stats.sectorsSeen].sort(), visits: [...stats.visits], maxSpeed: stats.maxSpeed, movedWhileOut: stats.movedWhileOut, worstLift: stats.worstLift,
        track: tracks.map((T) => T.n), beacon: model.beacon.material.opacity, blob: blobM.opacity, inShadowBox: inShadowBox(R.x, R.y + 0.12, R.z), warmLeft: warm.length, openCells: cells.length,
        rock: outing ? { x: outing.rock.x, z: outing.rock.z, r: outing.rock.r } : null, log: stats.log.slice(), planMs: stats.planMs, buildMs: stats.buildMs,
      };
    },
    dispose() {
      group.parent && group.parent.remove(group);
      for (const g of model.own) g.dispose();
      for (const sp of model.sprites) sp.material.dispose();
      for (const T of tracks) T.geo.dispose();
      trackM.dispose(); blobGeo.dispose(); blobM.dispose();
      puffs.forEach((p) => p.s.material.dispose()); puffs.length = 0;
      if (hooks() && window.__LUNA_ROVER__ === api.state) { delete window.__LUNA_ROVER__; delete window.__LUNA_ROVER_RUN__; delete window.__LUNA_ROVER_GRID__; }
    },
  };
  if (hooks()) { window.__LUNA_ROVER__ = api.state; window.__LUNA_ROVER_RUN__ = api.run; window.__LUNA_ROVER_GRID__ = api.grid; }
  return api;
}
