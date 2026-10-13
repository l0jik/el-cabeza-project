/* Ciudad's life in the streets: the traffic and the people (the mock-ups'
   citylife, set moving).

   - Round the board, the city's streets: cars and buses in both lanes
     (keeping right), bikes, people walking the pavements; each lane a
     pattern of things travelling at its own pace, placed every frame from
     the clock (as Plano's): one draw a kind.
   - On the board's own streets, a few small cars, and people waiting at
     the corners of the free blocks. A street a building stands across is
     shut: its cars fade away (and come back when it's open again); none
     drive while a building moves; people on a block a building has taken
     go.
   - At night every car has its lamps on, two white ahead and two red
     behind, and the buses are lit inside.
   - Nothing here casts a shadow (a moving caster would have the shadows
     drawn again every frame) or takes a tap. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOARD_ROWS, BOARD_COLS, SQUARE_SIZE, OFF_X, OFF_Z } from "../engine/constants.js";
import { col, glowTex } from "./ciudad-models.js";

const CAR_COLS = ["#a85a4a", "#d8d0c0", "#3a3a3e", "#5a6e84", "#c4a056", "#7a7e80", "#e8e2d4", "#6a8296"];
const CLOTHES = ["#3a3631", "#6a5240", "#5f8682", "#a85a4a", "#c4a056", "#d8d0c0", "#4e5458", "#7a6a8a", "#2e3a4a"];
// the people span the human range of skin (the rule for every scene)
const SKINS = ["#f1d3bd", "#e0b896", "#c8946c", "#a8724e", "#7f5236", "#5c3a26", "#3f281a"];
const SQ = SQUARE_SIZE;

let seed = 6151;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const merge = (geos) => { const m = BufferGeometryUtils.mergeBufferGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q))); geos.forEach((q) => q.dispose()); return m; };

export function createLife({ EX, EZ, tier, city }) {
  seed = 6151;
  const group = new THREE.Group(); group.name = "ciudad-life";
  const low = tier === "low", owned = [];
  const keep = (o) => { owned.push(o); return o; };
  const { xs, zs, SW, GY } = city.streets;

  /* ---------------- the kinds: each one or more instanced parts (one draw each) */
  // parts: [geometry, material, colour of the item's own or a fixed one]
  const glassM = keep(new THREE.MeshStandardMaterial({ color: col("#2a3238"), roughness: 0.2, metalness: 0.4 }));
  const plainM = () => keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2 }));
  const busLitM = keep(new THREE.MeshStandardMaterial({ color: col("#2a3238"), roughness: 0.3, metalness: 0.2, emissive: col("#ffe2a8"), emissiveIntensity: 0 }));
  const kinds = {
    car: { parts: [[merge([box(0.11, 0.028, 0.05, 0, 0.02, 0)]), plainM(), "own"], [merge([box(0.06, 0.02, 0.046, -0.005, 0.043, 0)]), glassM, null]], len: 0.11, w: 0.05, lamp: 0.024, items: [] },
    bus: { parts: [[merge([box(0.27, 0.06, 0.06, 0, 0.036, 0), box(0.27, 0.006, 0.061, 0, 0.068, 0)]), plainM(), "own"], [merge([box(0.25, 0.018, 0.062, 0, 0.05, 0)]), busLitM, null]], len: 0.27, w: 0.06, lamp: 0.022, items: [] },
    bike: { parts: [[merge([box(0.03, 0.003, 0.003, 0, 0.014, 0), new THREE.TorusGeometry(0.008, 0.0016, 4, 12).translate(-0.014, 0.009, 0), new THREE.TorusGeometry(0.008, 0.0016, 4, 12).translate(0.014, 0.009, 0)]), plainM(), "#22252a"], [merge([box(0.009, 0.016, 0.008, 0, 0.026, 0)]), plainM(), "own"], [merge([new THREE.SphereGeometry(0.005, 8, 6).translate(0.002, 0.038, 0)]), plainM(), "skin"]], len: 0, items: [] },
    person: { parts: [[merge([box(0.008, 0.014, 0.006, 0, 0.007, 0)]), plainM(), "#2e2e32"], [merge([box(0.012, 0.017, 0.008, 0, 0.022, 0)]), plainM(), "own"], [merge([new THREE.SphereGeometry(0.0055, 8, 6).translate(0, 0.036, 0)]), plainM(), "skin"]], len: 0, items: [] },
  };
  const add = (kind, item) => { kinds[kind].items.push(item); return item; };

  /* A lane: things every p along it, travelling at v (units a second), s their size. */
  function lane(ax, az, bx, bz, kind, v, gap, s, y, extra = {}) {
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, yaw = -Math.atan2(dz, dx);
    const n = Math.max(1, Math.round(L / gap)), p = L / n, phase = rnd() * p;
    for (let k = 0; k < n; k++) {
      const kd = typeof kind === "function" ? kind() : kind, base = phase + k * p;
      add(kd, {
        s, y, color: kd === "bus" ? "#c4a056" : kd === "car" ? pick(CAR_COLS) : pick(CLOTHES), skin: pick(SKINS), ...extra,
        pos: (t) => { const d = ((base + v * t) % L + L) % L; return [ax + dx * d, az + dz * d, yaw, d, L]; },
      });
    }
  }

  /* ---------------- round the board: the city's streets */
  const R = low ? 16 : 22, lw = SW * 0.24;
  const near = (c) => Math.abs(c) < R;
  const carOrBus = () => (rnd() < 0.08 ? "bus" : "car");
  for (const x of xs) if (near(x)) {
    // keeping right: down the street (+z) on its west side seen from the south... each lane its own way
    lane(x + lw, -R, x + lw, R, carOrBus, rr(0.55, 0.8), rr(4.5, 7.5), 1.45, GY);
    lane(x - lw, R, x - lw, -R, carOrBus, rr(0.55, 0.8), rr(4.5, 7.5), 1.45, GY);
    if (rnd() < 0.5) lane(x + SW * 0.42, -R, x + SW * 0.42, R, "bike", rr(0.2, 0.28), rr(6, 11), 1.6, GY);
  }
  for (const z of zs) if (near(z)) {
    lane(R, z + lw, -R, z + lw, carOrBus, rr(0.55, 0.8), rr(4.5, 7.5), 1.45, GY);
    lane(-R, z - lw, R, z - lw, carOrBus, rr(0.55, 0.8), rr(4.5, 7.5), 1.45, GY);
    if (rnd() < 0.5) lane(-R, z - SW * 0.42, R, z - SW * 0.42, "bike", rr(0.2, 0.28), rr(6, 11), 1.6, GY);
  }
  // people on the pavements near the board
  const RP = low ? 9 : 13;
  for (const x of xs) if (Math.abs(x) < RP + EX) for (const sgn of [-1, 1]) { const o = SW / 2 + 0.07; lane(x + sgn * o, sgn * -RP - EZ, x + sgn * o, sgn * (RP + EZ), "person", rr(0.05, 0.08), rr(1.6, 3.2), 2.0, GY + 0.004); }
  for (const z of zs) if (Math.abs(z) < RP + EZ) for (const sgn of [-1, 1]) { const o = SW / 2 + 0.07; lane(sgn * (RP + EX), z + sgn * o, -sgn * (RP + EX), z + sgn * o, "person", rr(0.05, 0.08), rr(1.6, 3.2), 2.0, GY + 0.004); }

  /* ---------------- on the board: its streets (a lane each way down every line), people at the corners */
  const boardLanes = [];
  const bl = (kind, ax, az, bx, bz, v, gap, s, line) => {
    const before = kinds[kind].items.length;
    lane(ax, az, bx, bz, kind, v, gap, s, 0);
    const its = kinds[kind].items.slice(before);
    its.forEach((it) => { it.board = line; it.fade = 1; });
    boardLanes.push(...its);
  };
  for (let i = 0; i <= BOARD_COLS; i++) {
    const x = i * SQ - OFF_X;
    if (rnd() < 0.55) bl("car", x + 0.042, -OFF_Z - 0.3, x + 0.042, OFF_Z + 0.3, rr(0.3, 0.42), rr(4, 7), 1.5, { axis: "x", i });
    if (rnd() < 0.55) bl("car", x - 0.042, OFF_Z + 0.3, x - 0.042, -OFF_Z - 0.3, rr(0.3, 0.42), rr(4, 7), 1.5, { axis: "x", i });
  }
  for (let j = 0; j <= BOARD_ROWS; j++) {
    const z = j * SQ - OFF_Z;
    if (rnd() < 0.55) bl("car", OFF_X + 0.3, z + 0.042, -OFF_X - 0.3, z + 0.042, rr(0.3, 0.42), rr(4, 7), 1.5, { axis: "z", j });
    if (rnd() < 0.55) bl("car", -OFF_X - 0.3, z - 0.042, OFF_X + 0.3, z - 0.042, rr(0.3, 0.42), rr(4, 7), 1.5, { axis: "z", j });
  }
  // people in twos and threes at the corners of the blocks, waiting to cross
  const corners = [];
  for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) {
    if (rnd() > (low ? 0.16 : 0.26)) continue;
    const cx = (c + 0.5) * SQ - OFF_X, cz = (r + 0.5) * SQ - OFF_Z, e = (SQ - 0.17) / 2 - 0.035, sx = rnd() < 0.5 ? -1 : 1, sz = rnd() < 0.5 ? -1 : 1;
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const x = cx + sx * e + rr(-0.025, 0.025), z = cz + sz * e + rr(-0.025, 0.025), yaw = rnd() * 6.28;
      corners.push(add("person", { s: 1.7, y: 0, color: pick(CLOTHES), skin: pick(SKINS), r, c, fade: 1, pos: () => [x, z, yaw] }));
    }
  }

  /* ---------------- the instanced parts */
  const meshes = [];
  for (const [name, k] of Object.entries(kinds)) {
    if (!k.items.length) continue;
    k.meshes = k.parts.map(([geo, mat, how]) => {
      keep(geo);
      const im = new THREE.InstancedMesh(geo, mat, k.items.length);
      k.items.forEach((it, i) => { const c = how === "own" ? it.color : how === "skin" ? it.skin : how; if (c) im.setColorAt(i, col(c)); });
      im.castShadow = false; im.receiveShadow = true; im.raycast = () => {}; im.frustumCulled = false; im.name = `ciudad-${name}`;
      group.add(im); meshes.push(im);
      return im;
    });
  }
  /* The cars' lamps at night: two white ahead, two red behind, each a point
     of light (one draw for the heads, one for the tails). */
  const cars = [...kinds.car.items.map((it) => [it, kinds.car]), ...kinds.bus.items.map((it) => [it, kinds.bus])];
  const headPos = new Float32Array(cars.length * 2 * 3), tailPos = new Float32Array(cars.length * 2 * 3);
  const lampPts = (arr, color, size) => {
    const g = keep(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const m = keep(new THREE.PointsMaterial({ map: glowTex(), color: col(color), size, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.raycast = () => {}; pts.visible = false; group.add(pts);
    return pts;
  };
  const heads = lampPts(headPos, "#fff2d0", 0.13), tails = lampPts(tailPos, "#ff3424", 0.08);

  /* ---------------- each frame */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p3 = new THREE.Vector3(), sc = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let closed = new Set(), taken = new Set(), lastPieces = null, night = 0, boardOn = 1;
  // which of the board's streets a building stands across, which blocks are taken
  function read(pieces) {
    closed = new Set(); taken = new Set();
    for (const p of pieces || []) {
      const h = p.h || 1, w = p.w || 1;
      for (let r = p.row; r < p.row + h; r++) for (let c = p.col; c < p.col + w; c++) taken.add(`${r},${c}`);
      for (let j = p.row + 1; j < p.row + h; j++) closed.add(`z${j}`); // a street along z between its rows
      for (let i = p.col + 1; i < p.col + w; i++) closed.add(`x${i}`);
    }
  }
  function place(t, dt) {
    let hi = 0;
    for (const k of Object.values(kinds)) {
      if (!k.meshes) continue;
      k.items.forEach((it, i) => {
        const P = it.pos(t);
        let f = 1;
        if (it.board) {
          const shut = closed.has(it.board.axis === "x" ? `x${it.board.i}` : `z${it.board.j}`);
          const want = shut ? 0 : boardOn;
          it.fade += (want - it.fade) * Math.min(1, dt * 4);
          f = it.fade;
          // (they come and go at the board's edge, not in the middle of it)
          if (P) { const d = P[3], L = P[4]; f *= Math.min(1, d / 0.35, (L - d) / 0.35); }
        } else if (it.r !== undefined) {
          const want = taken.has(`${it.r},${it.c}`) ? 0 : 1;
          it.fade += (want - it.fade) * Math.min(1, dt * 3);
          f = it.fade;
        } else if (P && P[4]) {
          const d = P[3], L = P[4]; f = Math.min(1, d / 0.6, (L - d) / 0.6);
        }
        if (!P || f < 0.02) { k.meshes.forEach((im) => im.setMatrixAt(i, zero)); if (k.len) { for (const arr of [headPos, tailPos]) arr.fill(-999, (hi) * 6, (hi) * 6 + 6); hi++; } return; }
        q.setFromAxisAngle(UP, P[2]); p3.set(P[0], it.y, P[1]); const s = it.s * f; sc.set(s, s, s);
        m4.compose(p3, q, sc);
        k.meshes.forEach((im) => im.setMatrixAt(i, m4));
        if (k.len) {
          // the lamps: in the item's own frame, +x ahead
          const half = (k.len / 2) * s, wd = k.w * 0.34 * s, y = it.y + k.lamp * s, c = Math.cos(P[2]), sn = -Math.sin(P[2]);
          const at = (arr, ax, az) => { arr[hi * 6] = P[0] + c * ax - sn * az; arr[hi * 6 + 1] = y; arr[hi * 6 + 2] = P[1] + sn * ax + c * az; arr[hi * 6 + 3] = P[0] + c * ax + sn * az; arr[hi * 6 + 4] = y; arr[hi * 6 + 5] = P[1] + sn * ax - c * az; };
          // (two at a time: a pair either side of the middle)
          at(headPos, half + 0.006 * s, wd); at(tailPos, -half - 0.004 * s, wd);
          hi++;
        }
      });
      k.meshes.forEach((im) => { im.instanceMatrix.needsUpdate = true; });
    }
    if (night > 0.01) { heads.geometry.attributes.position.needsUpdate = true; tails.geometry.attributes.position.needsUpdate = true; }
  }
  let lastT = 0;
  return {
    group,
    night(n) {
      night = n;
      heads.material.opacity = n; tails.material.opacity = n * 0.9; heads.visible = tails.visible = n > 0.01;
      busLitM.emissiveIntensity = 0.85 * n;
    },
    /* now (ms), the pieces, whether a building is moving. */
    tick(now, pieces, moving) {
      if (pieces !== lastPieces) { lastPieces = pieces; read(pieces); }
      const t = now / 1000, dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t;
      boardOn += ((moving ? 0 : 1) - boardOn) * Math.min(1, dt * 5);
      place(t, dt);
    },
    test() { return { cars: kinds.car.items.length, buses: kinds.bus.items.length, people: kinds.person.items.length, boardCars: boardLanes.length, shut: [...closed] }; },
    dispose() { meshes.forEach((m) => m.dispose && m.dispose()); owned.forEach((o) => o.dispose && o.dispose()); },
  };
}
