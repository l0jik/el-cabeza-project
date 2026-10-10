/* Noir's traffic (user: "Occasionally have a post-war sedan or coupe, most
   notably 4-door sedans and low-slung coupes produced by American
   manufacturers like Ford, Buick, Cadillac, Chevrolet, and Chrysler
   between 1935 and 1950"): now and then one of the cars of noir-cars.js
   comes along the ring street round the board, turns into one of the
   board's streets, drives it from end to end and turns out onto the ring
   street the far side; or goes by on the ring street alone. One at a time,
   at a city pace, its headlamps lighting the wet street ahead of it, the
   tail lamps glowing behind, a little shadow of its own under it.

   - The board's streets (a lane each, BOARD_STREET wide, noir-city.js) are
     one-way, every other one the other way. A street a building stands
     across (a piece on two squares either side of it, touching the ground
     on both) is closed, and so is one by a missing square or a black hole.
     No car turns in while a piece moves, and one on the board fades away
     if a piece moves (where it goes isn't known until it lands).
   - On the ring street the cars keep to the right.
   - A car casts no shadow (a moving caster would have the shadows drawn
     again every frame: chassis/shadow-watch.js) and never takes a tap. It
     comes and goes dissolving (an ordered dither, as the city's buildings
     clear out of the view), so nothing pops in or out.

   Test hook (window.__EC_TEST_HOOKS__, set up by noir-fx.js):
   __NOIR_TRAFFIC__ — state(), closed() (the streets shut), spawn({street,
   kind, paint, ring, at}), pace(ms) (the wait between cars), freeze(on). */

import * as THREE from "three";
import { BOARD_ROWS, BOARD_COLS, OFF_X, OFF_Z, SQUARE_SIZE, MISSING_SQUARES, BLACK_HOLES } from "../engine/constants.js";
import { groundCellsOf } from "../engine/shapes.js";
import { buildCar, prepareCar, CAR_KINDS, CAR_PAINTS } from "./noir-cars.js";
import { glowTex } from "./noir-city.js";

// The ring street round the slab (noir-city.js: RING 1.9 wide from the slab's
// edge, its middle 0.95 out); a lane each side of the middle.
const RING_MID = 0.95, LANE = 0.3;
const SPEED = 0.62, TURN_SPEED = 0.38, RING_SPEED = 0.78;
const FADE = 0.7; // the length of road a car dissolves in over, in and out

let seed = 4711;
const NO_TAP = () => {};
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];

/* ------------------------------------------------------------ dissolving */

function dissolving(mat, uFade) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = uFade;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uFade;\nfloat carB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }\nfloat carB4(vec2 a){ return carB2(0.5 * a) * 0.25 + carB2(a); }")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (carB4(gl_FragCoord.xy) >= uFade) discard;");
  };
  mat.customProgramCacheKey = () => "noir-car-dissolve";
  return mat;
}

/* ------------------------------------------------------------ the route */

// A route: a run of points (straight runs, quarter turns), walked by length.
function route() {
  const pts = []; // [x, z, length so far, speed]
  let len = 0;
  const add = (x, z, v) => {
    if (pts.length) { const p = pts[pts.length - 1]; len += Math.hypot(x - p[0], z - p[1]); }
    pts.push([x, z, len, v]);
  };
  return {
    line(x0, z0, x1, z1, v) { const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25)); for (let i = pts.length ? 1 : 0; i <= n; i++) add(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, v); },
    pts, get length() { return len; },
  };
}
// Where along the route a length falls: the place, the heading, the speed there.
function along(r, s) {
  const P = r.pts;
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][2] <= s) lo = m; else hi = m; }
  const a = P[lo], b = P[hi], u = b[2] > a[2] ? Math.min(1, Math.max(0, (s - a[2]) / (b[2] - a[2]))) : 0;
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, dx: b[0] - a[0], dz: b[1] - a[1], v: a[3] + (b[3] - a[3]) * u };
}

/* ------------------------------------------------------------ the traffic */

/* EX, EZ: the slab's half sizes. compile(): has the renderer make the
   shaders for what's in the scene (a car's first drive would wait on them). */
export function createTraffic({ EX, EZ, compile }) {
  const group = new THREE.Group(); group.name = "noir-traffic";
  const glowMat = (opacity, color = 0xfff4dc) => new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  let SHADOW_T = null;
  const shadowTex = () => {
    if (SHADOW_T) return SHADOW_T;
    const c = document.createElement("canvas"); c.width = 64; c.height = 32;
    const x = c.getContext("2d"), grd = x.createRadialGradient(32, 16, 0, 32, 16, 30);
    grd.addColorStop(0, "rgba(0,0,0,0.85)"); grd.addColorStop(0.6, "rgba(0,0,0,0.5)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = grd; x.fillRect(0, 0, 64, 32);
    SHADOW_T = new THREE.CanvasTexture(c);
    return SHADOW_T;
  };

  /* A car, ready to drive: the model, its own materials (to dissolve on
     their own), the lamps' glows, the beam on the road, its shadow. */
  function makeRig(kind, paint, roof) {
    const model = buildCar(kind, paint, roof);
    const uFade = { value: 0 };
    const mats = [];
    model.traverse((o) => { if (o.isMesh) { o.material = dissolving(o.material.clone(), uFade); mats.push(o.material); o.raycast = NO_TAP; } });
    const rig = new THREE.Group(); rig.name = "noir-car"; rig.add(model);
    const info = model.userData.car;
    const flat = (w, l, mat, x, y = 0.004) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(l, w), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, 0); m.renderOrder = 2; m.raycast = NO_TAP; rig.add(m); return m; };
    const shadowM = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const shadow = flat(info.width * 1.25, info.len * 1.05, shadowM, 0, 0.002);
    shadow.renderOrder = 1;
    const beamM = glowMat(0), beam = flat(info.width * 2.0, info.len * 1.7, beamM, info.len * 0.5 + info.len * 0.75);
    const heads = info.head.map(([x, y, z]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff4dc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.position.set(x + 0.004, y, z); s.scale.set(0.07, 0.07, 1); s.raycast = NO_TAP; rig.add(s); return s; });
    const tails = info.tail.map(([x, y, z]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xc8c8c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.position.set(x - 0.004, y, z); s.scale.set(0.035, 0.035, 1); s.raycast = NO_TAP; rig.add(s); return s; });
    // and the same lamps as points the same size on the screen however far
    // off (from high over the board a car is its lights going down a street)
    const point = (x, y, z, size, color) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: false })); s.position.set(x, y, z); s.scale.set(size, size, 1); s.raycast = NO_TAP; rig.add(s); return s; };
    const headPts = info.head.map(([x, y, z]) => point(x + 0.006, y, z, 0.011, 0xfff4dc));
    const tailPts = info.tail.map(([x, y, z]) => point(x - 0.006, y, z, 0.007, 0xbdbdbd));
    rig.visible = false;
    group.add(rig);
    return {
      rig, kind, paint, info,
      fade(v) {
        uFade.value = v;
        shadowM.opacity = 0.55 * v; beamM.opacity = 0.32 * v;
        heads.forEach((s) => { s.material.opacity = 0.95 * v; });
        tails.forEach((s) => { s.material.opacity = 0.6 * v; });
        headPts.forEach((s) => { s.material.opacity = 0.9 * v; });
        tailPts.forEach((s) => { s.material.opacity = 0.55 * v; });
      },
      dispose() {
        // (the model's shape is its kind's, kept by noir-cars.js)
        group.remove(rig);
        mats.forEach((m) => m.dispose());
        [shadow, beam].forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
        [...heads, ...tails, ...headPts, ...tailPts].forEach((s) => s.material.dispose());
      },
    };
  }

  /* ---------------- which streets are open */

  // A street's segment between two squares is closed by a building over
  // both (the same piece on the ground either side), or by a missing
  // square or a black hole beside it. Vertical street i runs between
  // columns i-1 and i; across street j between rows j-1 and j.
  function closed(pieces) {
    const owner = new Map(), gone = new Set();
    (pieces || []).forEach((p) => { try { groundCellsOf(p).forEach(([r, c]) => owner.set(r * 1000 + c, p.id)); } catch (e) { /* a piece mid-change */ } });
    [...(MISSING_SQUARES || []), ...(BLACK_HOLES || [])].forEach((s) => gone.add(s.row * 1000 + s.col));
    const at = (r, c) => owner.get(r * 1000 + c);
    const v = [], h = [];
    for (let i = 0; i <= BOARD_COLS; i++) {
      let shut = false;
      for (let r = 0; r < BOARD_ROWS && !shut; r++) {
        const a = i > 0 ? at(r, i - 1) : undefined, b = i < BOARD_COLS ? at(r, i) : undefined;
        if (a !== undefined && a === b) shut = true;
        if ((i > 0 && gone.has(r * 1000 + i - 1)) || (i < BOARD_COLS && gone.has(r * 1000 + i))) shut = true;
      }
      v.push(shut);
    }
    for (let j = 0; j <= BOARD_ROWS; j++) {
      let shut = false;
      for (let c = 0; c < BOARD_COLS && !shut; c++) {
        const a = j > 0 ? at(j - 1, c) : undefined, b = j < BOARD_ROWS ? at(j, c) : undefined;
        if (a !== undefined && a === b) shut = true;
        if ((j > 0 && gone.has((j - 1) * 1000 + c)) || (j < BOARD_ROWS && gone.has(j * 1000 + c))) shut = true;
      }
      h.push(shut);
    }
    return { v, h };
  }

  /* ---------------- the routes */

  /* Down the board's street: along the ring street toward it, a quarter
     turn in, the street end to end, a quarter turn out onto the ring street
     the far side, and on along it. In the street's own frame: u the way
     it runs, w to the right of that (so a right turn in comes from -w). */
  function crossRoute(vertical, index, dir, inRight, outRight) {
    const E = vertical ? EZ : EX, line = vertical ? index * SQUARE_SIZE - OFF_X : index * SQUARE_SIZE - OFF_Z;
    // (u, w) to the board's x, z: +u is `dir` along the street, +w its right
    const toXZ = (u, w) => (vertical ? [line - w * dir, u * dir] : [u * dir, line + w * dir]);
    const r = route();
    const seg = (u0, w0, u1, w1, v) => { const [x0, z0] = toXZ(u0, w0), [x1, z1] = toXZ(u1, w1); r.line(x0, z0, x1, z1, v); };
    // an arc about (cu, cw), its angle from +u toward +w
    const arc = (cu, cw, R, a0, a1, v) => {
      for (let i = 1, n = 12; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n, [x, z] = toXZ(cu + R * Math.cos(a), cw + R * Math.sin(a)), p = r.pts[r.pts.length - 1];
        r.line(p[0], p[1], x, z, v);
      }
    };
    const RUN = 3.2, edge = 0.15;
    // in: turning right, it comes along the near lane from +w; left, along the far lane from -w
    const sIn = inRight ? 1 : -1, uIn = -E - RING_MID + sIn * LANE, Rin = -E - edge - uIn;
    seg(uIn, sIn * (Rin + RUN), uIn, sIn * Rin, RING_SPEED);
    arc(uIn + Rin, sIn * Rin, Rin, Math.PI, Math.PI + (sIn * Math.PI) / 2, TURN_SPEED);
    // the street, end to end
    seg(-E - edge, 0, E + edge, 0, SPEED);
    // out: right onto the near lane, toward +w; left onto the far lane, toward -w
    const sOut = outRight ? 1 : -1, uOut = E + RING_MID - sOut * LANE, Rout = uOut - E - edge;
    arc(E + edge, sOut * Rout, Rout, (-sOut * Math.PI) / 2, 0, TURN_SPEED);
    seg(uOut, sOut * Rout, uOut, sOut * (Rout + RUN), RING_SPEED);
    return r;
  }
  // By on the ring street, one side, keeping to the right.
  function ringRoute(vertical, side, dir) {
    const r = route(), L = (vertical ? EZ : EX) + 4.5;
    const across = side * ((vertical ? EX : EZ) + RING_MID) + (vertical ? -dir : dir) * LANE;
    if (vertical) r.line(across, -L * dir, across, L * dir, RING_SPEED);
    else r.line(-L * dir, across, L * dir, across, RING_SPEED);
    return r;
  }

  /* ---------------- driving

     Between cars the next one is made ready (its shape, its materials, the
     shaders for them) a moment after the last has gone, so it only has to
     appear when its time comes. */

  const rigs = []; // cars made, kept to drive again
  let car = null, plan = null, nextAt = 0, readyAt = 0, pace = null, lastClosed = null, frozen = false;
  const tmp = new THREE.Vector3();

  function rigFor(kind, paint, roof) {
    let rg = rigs.find((x) => !x.busy && x.kind === kind && (kind === "taxi" || x.paint === paint));
    if (!rg) {
      prepareCar(kind);
      rg = makeRig(kind, paint, roof);
      rigs.push(rg);
      // keep a few, the oldest idle one let go
      if (rigs.length > 4) { const i = rigs.findIndex((x) => !x.busy && x !== rg); if (i >= 0) { rigs[i].dispose(); rigs.splice(i, 1); } }
    }
    rg.busy = true;
    return rg;
  }
  let prepMs = 0;
  function prepare(opts = {}) {
    const t0 = performance.now();
    const kind = opts.kind || (rnd() < 0.1 ? "taxi" : pick(CAR_KINDS.filter((k) => k !== "taxi")));
    const paint = opts.paint || pick(CAR_PAINTS), roof = rnd() < 0.18 ? pick(CAR_PAINTS) : undefined;
    plan = { kind, paint, rg: rigFor(kind, paint, roof) };
    if (compile) { plan.rg.rig.visible = true; plan.rg.fade(0); try { compile(); } catch (e) { /* drawn when it comes */ } plan.rg.rig.visible = false; }
    prepMs = performance.now() - t0;
  }

  function spawn(pieces, opts = {}) {
    const cl = closed(pieces);
    lastClosed = cl;
    const open = [];
    cl.v.forEach((shut, i) => { if (!shut) open.push([true, i]); });
    cl.h.forEach((shut, j) => { if (!shut) open.push([false, j]); });
    const ring = opts.ring != null ? opts.ring : opts.street ? false : (!open.length || rnd() < 0.3);
    if (plan && ((opts.kind && opts.kind !== plan.kind) || (opts.paint && opts.paint !== plan.paint))) { plan.rg.busy = false; plan = null; }
    if (!plan) prepare(opts);
    let r, street = null;
    if (ring) {
      const vertical = rnd() < 0.5;
      r = ringRoute(vertical, rnd() < 0.5 ? -1 : 1, rnd() < 0.5 ? -1 : 1);
    } else {
      const [vertical, index] = opts.street || pick(open);
      // one-way, every other street the other way
      const dir = index % 2 ? -1 : 1;
      r = crossRoute(vertical, index, dir, rnd() < 0.5, rnd() < 0.5);
      street = { vertical, index, dir };
    }
    const rg = plan.rg;
    plan = null;
    car = { rg, r, s: opts.at ? opts.at * r.length : 0, street, leaving: 0 };
    rg.rig.visible = true;
    place(car);
  }

  function place(c) {
    const at = along(c.r, c.s), rig = c.rg.rig;
    // the slab's top is the street; the ring street 12 mm lower, a ramp between
    const out = Math.max(Math.abs(at.x) - EX, Math.abs(at.z) - EZ);
    rig.position.set(at.x, -0.012 * Math.min(1, Math.max(0, out / 0.1)), at.z);
    if (at.dx || at.dz) rig.rotation.y = Math.atan2(-at.dz, at.dx);
    const L = c.r.length, k = Math.min(1, c.s / FADE, (L - c.s) / FADE) * (c.leaving ? Math.max(0, 1 - (performance.now() - c.leaving) / 500) : 1);
    c.rg.fade(Math.max(0, k));
    return at;
  }

  function finish() {
    if (!car) return;
    car.rg.rig.visible = false; car.rg.fade(0); car.rg.busy = false;
    car = null;
    const now = performance.now();
    nextAt = now + (pace != null ? pace : 6000 + rnd() * 12000);
    readyAt = now + Math.min(1500, pace != null ? 0 : 1500);
  }

  let lastNow = 0;
  return {
    group,
    /* now (ms), the pieces on the board, whether one is moving */
    tick(now, pieces, moving) {
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now;
      if (!nextAt) { nextAt = now + 3000 + rnd() * 5000; readyAt = now + 1500; }
      if (!car) {
        if (!plan && now >= readyAt && !moving) prepare();
        else if (plan && now >= nextAt && !moving) spawn(pieces);
        return;
      }
      // a piece moving while this one is on the board: it goes
      if (moving && car.street && !car.leaving) {
        const at = along(car.r, car.s);
        if (Math.abs(at.x) < EX + 0.3 && Math.abs(at.z) < EZ + 0.3) car.leaving = performance.now();
      }
      const v = along(car.r, car.s).v;
      if (!frozen) car.s += v * dt;
      place(car);
      if (car.s >= car.r.length || (car.leaving && performance.now() - car.leaving > 520)) finish();
    },
    test: {
      state: () => {
        let c = null;
        if (car) {
          const at = along(car.r, car.s), rig = car.rg.rig;
          rig.getWorldPosition(tmp);
          let shadows = false, taps = false;
          rig.traverse((o) => { if (o.castShadow) shadows = true; if ((o.isMesh || o.isSprite) && o.raycast !== NO_TAP) taps = true; });
          c = { kind: car.rg.kind, x: at.x, z: at.z, world: [tmp.x, tmp.y, tmp.z], s: car.s, length: car.r.length, street: car.street, leaving: !!car.leaving, visible: rig.visible, castShadow: shadows, takesTaps: taps };
        }
        return { car: c, closed: lastClosed, built: rigs.length, ready: plan ? plan.kind : null, prepMs, nextIn: car ? null : Math.max(0, nextAt - performance.now()) };
      },
      spawn: (pieces, opts) => { if (car) finish(); spawn(pieces, opts || {}); },
      pace: (ms) => { pace = ms; nextAt = performance.now() + (ms || 0); readyAt = performance.now(); },
      freeze: (on) => { frozen = !!on; },
      route: (vertical, index, dir, inRight, outRight) => crossRoute(vertical, index, dir, inRight, outRight).pts.map((p) => [p[0], p[1]]),
      ring: (vertical, side, dir) => ringRoute(vertical, side, dir).pts.map((p) => [p[0], p[1]]),
      closed: (pieces) => closed(pieces),
    },
    dispose() {
      rigs.forEach((x) => x.dispose()); rigs.length = 0; car = null; plan = null;
      if (SHADOW_T) { SHADOW_T.dispose(); SHADOW_T = null; }
    },
  };
}
