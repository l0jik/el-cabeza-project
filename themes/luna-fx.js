/* Luna's scene life: the ground the board is part of (luna-ground.js), the
   sky (luna-sky.js), the low sun, the corridors, dust, and the life
   round the base.

   - The chassis's board plate is hidden; the lunar surface takes its
     place, hung on the chassis's boardGroup so it turns with the board,
     and made again if the board changes size.
   - The sky stays put as the board turns, with the sun: the key light is
     moved down toward the horizon (long shadows), the fill to the Earth's
     side (earthshine). The page renders in sRGB, as the mock-ups did.
   - The corridors: when a building moves, its side's tubes deflate; when
     the pieces have come to rest, the ground under the board is settled
     round them and each side's network laid again, the tubes inflating
     along the new routes (one that hasn't changed just stays).
   - The roof's gear is hidden on a piece with another standing over it.
   - Where a piece lands, dust thrown up in slow arcs (no air: it falls
     as it was thrown).
   - Round the board: a lander on its pad, a rover with its tracks, a dish,
     solar arrays, boulders, suited walkers and their footprints.

   All of it rebuilds or disposes cleanly; nothing here touches play. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SQUARE_SIZE, OFF_X, OFF_Z, BOARD_ROWS, BOARD_COLS, MISSING_SQUARES, BLACK_HOLES } from "../engine/constants.js";
import { pieceCenter } from "../engine/geometry.js";
import { quality } from "./tienda-quality.js";
import { PLAY } from "./luna.js";
import { createGround } from "./luna-ground.js";
import { createSky, EARTH_DIR } from "./luna-sky.js";
import { routeCorridors, buildCorridors, disposeCorridors, networkKey } from "./luna-corridors.js";
import { footprintOf, coveredIds, personFig, personH, std, mesh, boxM, glowSprite, col, cv, tex, PAL } from "./luna-models.js";

// The sun: low (18 degrees; the mock-ups' 12 threw the tall pieces' shadows across the whole board), from the
// board's right as the player first sees it, a little toward them.
const SUN_DIR = new THREE.Vector3(12, 3.95, 2.0).normalize();
const PLATE = new Set(["ec-slab", "ec-slab-edges", "ec-top-ring", "ec-grid"]);

/* ---- life round the base ---- */
function props(group, at) {
  let s = 2024; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * rnd();
  const put = (o) => { group.add(o); return o; };
  const EX = OFF_X + 0.9, EZ = OFF_Z + 0.9, offBoard = (x, z, pad = 0) => Math.abs(x) > EX + pad || Math.abs(z) > EZ + pad;
  // boulders strewn about, none on the board
  const rock = std("#8a8780", { roughness: 0.95 }), rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, d = rr(7, 26), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!offBoard(x, z, 0.6)) continue;
    const r = rr(0.05, d < 12 ? 0.22 : 0.45) * (d > 14 && rnd() < 0.12 ? 2.4 : 1), b = mesh(rockGeo, rock, x, at(x, z) + r * 0.3, z);
    b.scale.set(r, r * rr(0.5, 0.9), r); b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); put(b);
  }
  // The vehicles at half the mock-ups' size, in scale with the people now they're smaller (a person stands a seventh
  // of the lander's height, a third of the rover's).
  // a lander on its pad: gold-foil descent stage on four legs, the grey ascent stage on top, a ladder
  {
    const x = -10.6, z = -2.2, g = new THREE.Group(); g.position.set(x, at(x, z), z); g.rotation.y = -0.5; g.scale.setScalar(0.5); put(g);
    g.add(mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.03, 40), std("#a9a69e", { roughness: 0.95 }), 0, 0.015, 0));
    const ring = mesh(new THREE.TorusGeometry(0.95, 0.025, 6, 48), new THREE.MeshBasicMaterial({ color: col("#ff7a1a") }), 0, 0.035, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
    const foil = std("#c9a23a", { metalness: 0.9, roughness: 0.35 }), grey = std("#b8bcc2", { metalness: 0.4, roughness: 0.5 }), dark = std("#2a2c30", { roughness: 0.6 });
    const ds = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 8), foil, 0, 0.42, 0); ds.rotation.y = Math.PI / 8; g.add(ds);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, lx = Math.cos(a), lz = Math.sin(a);
      const leg = boxM(0.025, 0.6, 0.025, grey, lx * 0.46, 0.26, lz * 0.46); leg.rotation.set(lz * 0.5, 0, -lx * 0.5); g.add(leg);
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 12), grey, lx * 0.6, 0.03, lz * 0.6));
    }
    g.add(boxM(0.46, 0.3, 0.4, grey, 0, 0.7, 0), boxM(0.2, 0.14, 0.05, dark, 0, 0.72, 0.22));
    for (const [lx, ly, lz, c] of [[0.24, 0.72, 0.21, "#ff3a2a"], [-0.24, 0.72, 0.21, "#7aff8a"]]) { const sp = glowSprite(c, 0.18, 0.9); sp.position.set(lx, ly, lz); g.add(sp); }
  }
  // a pressurised rover, its tracks laid on the dust behind it, sitting on the slope where it's parked
  {
    const x = 7.4, z = -5.0, ry = 2.9, S = 0.55, g = new THREE.Group(); put(g);
    const ax = Math.cos(ry), az = -Math.sin(ry), bx = Math.sin(ry), bz = Math.cos(ry);
    const hF = at(x + ax * 0.3 * S, z + az * 0.3 * S), hB = at(x - ax * 0.3 * S, z - az * 0.3 * S), hR = at(x + bx * 0.22 * S, z + bz * 0.22 * S), hL = at(x - bx * 0.22 * S, z - bz * 0.22 * S);
    g.position.set(x, (hF + hB + hR + hL) / 4, z); g.rotation.order = "YZX"; g.rotation.set(-Math.atan2(hR - hL, 0.44 * S), ry, Math.atan2(hF - hB, 0.6 * S)); g.scale.setScalar(S);
    const white = std("#e6e8ea", { roughness: 0.5 }), dark = std("#1c1e22", { roughness: 0.8 }), glass = std("#0e1a28", { roughness: 0.1, metalness: 0.5 }), band = std("#ff7a1a", { roughness: 0.5 });
    const R = 0.13, Lc = 0.42, y0 = 0.3;
    const cab = mesh(new THREE.CylinderGeometry(R, R, Lc, 28), white, 0, y0, 0); cab.rotation.z = Math.PI / 2; g.add(cab);
    const back = mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), white, -Lc / 2, y0, 0); back.rotation.z = Math.PI / 2; g.add(back);
    const nose = mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass, Lc / 2, y0, 0); nose.rotation.z = -Math.PI / 2; g.add(nose);
    const stripe = mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 0.025, 28, 1, true), band, -0.06, y0, 0); stripe.rotation.z = Math.PI / 2; g.add(stripe);
    g.add(boxM(0.62, 0.05, 0.34, dark, 0, 0.13, 0));
    for (const wx of [-0.24, 0, 0.24]) for (const sg of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18), dark, wx, 0.08, sg * 0.2); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(boxM(0.012, 0.26, 0.012, white, -0.2, y0 + R + 0.1, 0.05));
    const dish = mesh(new THREE.SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), std("#e6e8ea", { roughness: 0.5, side: THREE.DoubleSide }), -0.2, y0 + R + 0.24, 0.05); dish.rotation.x = -0.7; g.add(dish);
    const lamp = glowSprite("#e8f4ff", 0.4, 0.9); lamp.position.set(0.4, 0.28, 0); g.add(lamp);
    const tm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sg of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80, a = 0.6 * t, lx = -0.3 * S - t * 8, lz = sg * 0.2 * S + Math.sin(a * 3) * t * 1.4; pts.push([x + ax * lx + bx * lz, z + az * lx + bz * lz]); }
      const pos = [], idx = [];
      pts.forEach(([tx, tz], k) => {
        const [qx, qz] = pts[Math.min(k + 1, pts.length - 1)], [ox, oz] = pts[Math.max(k - 1, 0)], l = Math.hypot(qx - ox, qz - oz) || 1, nx = (-(qz - oz) / l) * 0.03 * S, nz = ((qx - ox) / l) * 0.03 * S;
        for (const sd of [-1, 1]) { const vx = tx + nx * sd, vz = tz + nz * sd; pos.push(vx, at(vx, vz) + 0.006, vz); }
        if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
      });
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      const tr = new THREE.Mesh(geo, tm); tr.castShadow = false; put(tr);
    }
  }
  // rows of solar panels on posts, tilted to the low sun
  {
    const panel = std("#1c2f6b", { metalness: 0.6, roughness: 0.25 }), post = std("#c8ccd0", { metalness: 0.5 });
    const S = 0.65;
    for (const [x0, z0, cols, rows] of [[-12.0, 5.4, 6, 4], [7.4, -11.0, 8, 3]]) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = x0 + i * 0.7 * S, z = z0 + j * 0.62 * S;
      put(boxM(0.025 * S, 0.28 * S, 0.025 * S, post, x, at(x, z) + 0.14 * S, z));
      const pn = boxM(0.6 * S, 0.012, 0.4 * S, panel, x, at(x, z) + 0.3 * S, z); pn.rotation.x = -0.8; put(pn);
    }
  }
  // a big dish
  {
    const x = -9.6, z = 7.8, s2 = 1.7, m = std("#e2e4e6", { metalness: 0.35, roughness: 0.45 }), g = new THREE.Group(); g.position.set(x, at(x, z), z); put(g);
    g.add(mesh(new THREE.CylinderGeometry(0.05 * s2, 0.09 * s2, 0.95 * s2, 10), m, 0, 0.475 * s2, 0));
    const pv = new THREE.Group(); pv.position.y = 0.95 * s2; pv.rotation.order = "YXZ"; pv.rotation.set(-0.6, 0.8, 0);
    const bowl = mesh(new THREE.SphereGeometry(0.7 * s2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3.2), std("#eef0f2", { metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }), 0, 0.7 * s2, 0);
    bowl.rotation.x = Math.PI; pv.add(bowl, mesh(new THREE.CylinderGeometry(0.01 * s2, 0.01 * s2, 0.5 * s2, 6), m, 0, 0.25 * s2, 0));
    g.add(pv);
  }
  // suited walkers, their prints in the dust behind them
  const printM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), printGeo = new THREE.CircleGeometry(0.0105, 10);
  [{ at: [6.9, -4.3], from: [7.3, -4.9], side: "dark" }, { at: [-10.0, -2.7], from: [-10.4, -3.1], side: "light" }, { at: [-6.6, 6.9], from: [-7.4, 7.3], side: "light" }].forEach((w, n) => {
    const [x, z] = w.at, [x0, z0] = w.from, dx = x - x0, dz = z - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    const f = personFig({ pose: "walk", eva: true, h: personH(900 + n), band: PAL[w.side].accent }); f.position.set(x, at(x, z), z); f.rotation.y = ry; put(f);
    for (let t = 0.07, i = 0; t < L - 0.04; t += 0.054, i++) {
      const sd = i % 2 ? 1 : -1, ux = dx / L, uz = dz / L, px = x0 + ux * t + uz * sd * 0.016, pz = z0 + uz * t - ux * sd * 0.016;
      const pr = new THREE.Mesh(printGeo, printM); pr.position.set(px, at(px, pz) + 0.004, pz); pr.rotation.order = "YXZ"; pr.rotation.set(-Math.PI / 2, ry, 0); pr.scale.set(1, 1.8, 1); put(pr);
    }
  });
}

/* ---- dust where a piece lands ---- */
let DUST_T = null;
function dustTexture() {
  if (DUST_T) return DUST_T;
  const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(200,196,188,0.9)"); g.addColorStop(0.5, "rgba(180,176,168,0.35)"); g.addColorStop(1, "rgba(160,156,148,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (DUST_T = tex(c));
}

export function mountAmbientEffects(refs, { three }) {
  const tier = quality().tier || "high";
  let ground = null, sky = null, props0 = null, attachedTo = null, dims = "", renderPrev = null, scenePrev = null;
  let lastPieces = null, covered = new Set(), selRing = null, selFor = "";
  const NET = { light: { group: null, key: "", s: 1, anim: null, pending: null }, dark: { group: null, key: "", s: 1, anim: null, pending: null }, cross: { group: null, key: "", s: 1, anim: null, pending: null } };
  const dust = [];
  const sun = new THREE.Vector3();

  function setScale(group, s) {
    if (!group) return;
    group.visible = s > 0.11;
    group.children.forEach((c) => {
      if (c.userData.inflate === "radial") c.scale.set(s, 1, s);
      else if (c.userData.inflate === "whole") c.scale.setScalar(s);
    });
  }
  function animate(N, to, dur, now) { if (N.anim && N.anim.to === to) return; if (!N.anim && Math.abs(N.s - to) < 1e-3) return; N.anim = { from: N.s, to, t0: now, dur }; }

  function buildWorld(t) {
    if (ground) ground.dispose();
    if (props0) { props0.parent && props0.parent.remove(props0); props0 = null; }
    ground = createGround(tier);
    t.boardGroup.add(ground.group);
    props0 = new THREE.Group(); props0.name = "luna-props";
    props(props0, ground.at);
    t.boardGroup.add(props0);
    PLAY.ground = ground;
    dims = `${SLAB_X}x${SLAB_Z}`;
    lastPieces = null; // settle again on the new ground
    for (const k in NET) { if (NET[k].group) disposeCorridors({ g: NET[k].group }); if (NET[k].pending) disposeCorridors({ g: NET[k].pending }); NET[k] = { group: null, key: "", s: 1, anim: null, pending: null }; }
  }

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup || !t.scene || !t.renderer) return false;
    if (attachedTo !== t.boardGroup) {
      attachedTo = t.boardGroup; dims = "";
      if (!renderPrev) {
        renderPrev = { enc: t.renderer.outputEncoding, exp: t.renderer.toneMappingExposure };
        t.renderer.outputEncoding = THREE.sRGBEncoding; t.renderer.toneMappingExposure = 1.05;
      }
      if (!sky) { sky = createSky({ tier, pixelRatio: t.renderer.getPixelRatio() }); t.scene.add(sky.group); }
      scenePrev = { fog: t.scene.fog }; t.scene.fog = null;
      t.spawnLandingParticles = spawnDust;
    }
    if (dims !== `${SLAB_X}x${SLAB_Z}`) buildWorld(t);
    // the sun low in the sky, the earthshine from the Earth's side
    if (t.lights) {
      const L = t.lights;
      sun.copy(SUN_DIR).multiplyScalar(25); if (!L.key.position.equals(sun)) L.key.position.copy(sun);
      if (L.fill) L.fill.position.copy(EARTH_DIR).multiplyScalar(20);
    }
    // the chassis's plate, unseen: the ground is the board
    for (const c of t.boardGroup.children) if (PLATE.has(c.name) && c.visible) c.visible = false;
    return true;
  }

  // a piece of the game is on its way somewhere (its carrier taken off the board's piece group into a roll or slide)
  function movingSides(t) {
    const out = new Set();
    if (!PLAY.pieces) return out;
    for (const p of PLAY.pieces) { const m = PLAY.carriers.get(p.id); if (m && m.parent && m.parent !== t.pieceGroup) out.add(p.owner); }
    return out;
  }

  function settle(now) {
    const t = three.current, pieces = PLAY.pieces;
    lastPieces = pieces;
    ground.update(pieces);
    covered = coveredIds(pieces);
    const blocked = [...(MISSING_SQUARES || []), ...(BLACK_HOLES || [])].map((s2) => [s2.row, s2.col]);
    const plan = routeCorridors(pieces, { rows: BOARD_ROWS, cols: BOARD_COLS, blocked });
    const groups = buildCorridors(pieces, plan, {
      at: (r, c) => [(c + 0.5) * SQUARE_SIZE - OFF_X, (r + 0.5) * SQUARE_SIZE - OFF_Z],
      foot: (p) => footprintOf(p, pieceCenter(p)),
      ground: ground.base,
    });
    const keys = { light: networkKey(plan, "light"), dark: networkKey(plan, "dark") };
    keys.cross = keys.light + "#" + keys.dark;
    for (const k of ["light", "dark", "cross"]) {
      const N = NET[k], G = groups[k];
      t.boardGroup.add(G);
      if (N.pending) { disposeCorridors({ g: N.pending }); N.pending = null; }
      if (!N.group) { N.group = G; N.s = 0.11; setScale(G, 0.11); animate(N, 1, 650, now); }
      else if (N.key !== k + keys[k] || N.s < 0.99 || (N.anim && N.anim.to < 1)) { N.pending = G; G.visible = false; animate(N, 0.11, 220, now); }
      else { disposeCorridors({ g: N.group }); N.group = G; setScale(G, 1); }
      N.key = k + keys[k];
    }
  }

  function tickCorridors(now) {
    for (const k in NET) {
      const N = NET[k];
      if (N.anim) {
        const u = Math.min(1, (now - N.anim.t0) / N.anim.dur), inflating = N.anim.to > N.anim.from;
        // inflating: a little past round, then settling (easeOutBack); deflating: going quickly at the end
        const e = inflating ? 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2) : u * u;
        N.s = N.anim.from + (N.anim.to - N.anim.from) * e;
        if (u >= 1) { N.s = N.anim.to; N.anim = null; }
        setScale(N.group, N.s);
      }
      if (N.pending && !N.anim && N.s <= 0.12) {
        disposeCorridors({ g: N.group }); N.group = N.pending; N.pending = null; N.group.visible = true;
        N.s = 0.11; setScale(N.group, 0.11); animate(N, 1, 650, now);
      }
    }
  }

  function spawnDust(row, col, w, h) {
    const t = three.current; if (!t || !attachedTo) return;
    const cx = (col + w / 2) * SQUARE_SIZE - OFF_X, cz = (row + h / 2) * SQUARE_SIZE - OFF_Z, hx = (w * 0.87) / 2, hz = (h * 0.87) / 2, n = tier === "low" ? 14 : 26;
    for (let i = 0; i < n; i++) {
      // a point round the foot of the building, thrown outward and up
      const side = Math.floor(Math.random() * 4), u = Math.random() * 2 - 1;
      const px = side < 2 ? cx + (side ? hx : -hx) : cx + u * hx, pz = side < 2 ? cz + u * hz : cz + (side === 2 ? hz : -hz);
      const ox = px - cx, oz = pz - cz, ol = Math.hypot(ox, oz) || 1, sp = 0.5 + Math.random() * 0.9;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTexture(), color: 0xbab6ae, transparent: true, opacity: 0, depthWrite: false }));
      const y = (ground ? ground.at(px, pz) : 0) + 0.03; s.position.set(px, y, pz);
      const size = 0.06 + Math.random() * 0.08; s.scale.set(size, size, 1);
      attachedTo.add(s);
      dust.push({ s, vx: (ox / ol) * sp, vz: (oz / ol) * sp, vy: 0.35 + Math.random() * 0.8, y0: y, born: performance.now(), life: 1.1 + Math.random() * 0.7, size });
    }
  }
  function tickDust(now, dt) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i], age = (now - d.born) / 1000;
      if (age >= d.life) { d.s.parent && d.s.parent.remove(d.s); d.s.material.dispose(); dust.splice(i, 1); continue; }
      d.vy -= 1.62 * dt;
      d.s.position.x += d.vx * dt; d.s.position.z += d.vz * dt; d.s.position.y = Math.max(d.y0 - 0.02, d.s.position.y + d.vy * dt);
      const u = age / d.life; d.s.material.opacity = (u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9) * 0.55;
      const g = d.size * (1 + u * 0.8); d.s.scale.set(g, g, 1);
    }
  }

  // the piece picked up: a ring of its side's light on the ground round it (a circle round the Cabeza)
  function ringPts(hx, hz, rc, n = 18) {
    const pts = [];
    for (const [sx, sz, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI * 1.5]]) {
      const ox = sx * (hx - rc), oz = sz * (hz - rc);
      for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([ox + Math.cos(a) * rc, oz + Math.sin(a) * rc]); }
    }
    return pts;
  }
  function tickSelection(t, moving) {
    const id = PLAY.selectedId, p = id && PLAY.pieces ? PLAY.pieces.find((q) => q.id === id) : null;
    const key = p && !moving.size ? `${p.id}|${p.row}|${p.col}|${p.w}|${p.h}` : "";
    if (key === selFor) { if (selRing) selRing.material.opacity = 0.6 + 0.25 * Math.sin(performance.now() / 300); return; }
    selFor = key;
    if (selRing) { selRing.parent && selRing.parent.remove(selRing); selRing.geometry.dispose(); selRing.material.dispose(); selRing = null; }
    if (!p || !ground || !attachedTo) return;
    const c = pieceCenter(p), round = p.type === "cabeza", w = 0.035;
    const outline = round ? Array.from({ length: 96 }, (_, j) => { const a = (j / 96) * Math.PI * 2; return [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; })
      : ringPts((p.w * 0.87) / 2 + 0.08, (p.h * 0.87) / 2 + 0.08, 0.22);
    const n = outline.length, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const [x0, z0] = outline[i % n], [xa, za] = outline[(i - 1 + n) % n], [xb, zb] = outline[(i + 1) % n];
      let nx = zb - za, nz = -(xb - xa); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * x0 + nz * z0 < 0) { nx = -nx; nz = -nz; }
      for (const d of [-w / 2, w / 2]) { const x = c.x + x0 + nx * d, z = c.z + z0 + nz * d; pos.push(x, ground.at(x, z) + 0.016, z); }
      if (i) { const v = (i - 1) * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    selRing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col(PAL[p.owner].accent), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, toneMapped: false }));
    selRing.renderOrder = 4; selRing.raycast = () => {};
    attachedTo.add(selRing);
  }

  let last = 0;
  const camLocal = new THREE.Vector3();
  return {
    // Tilted right down and zoomed in, the camera could sink into a hill by the board: kept clear of the ground under it.
    cameraOverride(camera) {
      if (!ground || !attachedTo) return;
      camLocal.copy(camera.position); attachedTo.worldToLocal(camLocal);
      const need = ground.at(camLocal.x, camLocal.z) + 0.9;
      if (camera.position.y < need) { camera.position.y = need; camera.updateMatrixWorld(); if (sky) sky.tick(camera); }
    },
    armOnBegin() { attach(); },
    restart() {},
    tick(now) {
      if (!attach()) return;
      const t = three.current, dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (sky && t.camera) sky.tick(t.camera);
      const moving = movingSides(t);
      // a building on its way: its side's tubes go down
      if (moving.size) for (const sd of moving) { animate(NET[sd], 0.11, 240, now); animate(NET.cross, 0.11, 240, now); }
      else if (PLAY.pieces && PLAY.pieces !== lastPieces) settle(now);
      tickCorridors(now);
      // the roof's gear only where nothing stands over the piece
      if (PLAY.pieces) for (const p of PLAY.pieces) { const m = PLAY.carriers.get(p.id), b = m && m.userData.building, k = b && b.userData.kit; if (k) k.visible = !covered.has(p.id); }
      tickDust(now, dt);
      tickSelection(t, moving);
      // the chassis's flat marks on the board (the check alert's squares and ghosts, black holes, missing squares)
      // lifted over the board's contour, so the dust doesn't swallow half of one
      if (ground) for (const grp of [t.checkGroup, t.holeGroup, t.missingGroup]) if (grp) for (const c of grp.children) {
        const k = c.userData && c.userData.kind;
        if (grp === t.checkGroup && k !== "check-square" && k !== "check-ghost") continue;
        if (c.userData.lunaY0 === undefined) c.userData.lunaY0 = c.position.y;
        const x = c.position.x, z = c.position.z, e = 0.45;
        c.position.y = c.userData.lunaY0 + Math.max(ground.at(x, z), ground.at(x - e, z - e), ground.at(x + e, z - e), ground.at(x - e, z + e), ground.at(x + e, z + e), 0);
      }
    },
    dispose() {
      const t = three.current;
      dust.forEach((d) => { d.s.parent && d.s.parent.remove(d.s); d.s.material.dispose(); }); dust.length = 0;
      for (const k in NET) { if (NET[k].group) disposeCorridors({ g: NET[k].group }); if (NET[k].pending) disposeCorridors({ g: NET[k].pending }); }
      if (selRing) { selRing.parent && selRing.parent.remove(selRing); selRing.geometry.dispose(); selRing.material.dispose(); selRing = null; }
      if (ground) { ground.dispose(); ground = null; }
      if (props0) { props0.parent && props0.parent.remove(props0); props0 = null; }
      if (sky) { sky.dispose(); sky = null; }
      PLAY.ground = null;
      if (t) {
        if (t.renderer && renderPrev) { t.renderer.outputEncoding = renderPrev.enc; t.renderer.toneMappingExposure = renderPrev.exp; }
        if (t.scene && scenePrev) t.scene.fog = scenePrev.fog;
        if (t.spawnLandingParticles === spawnDust) t.spawnLandingParticles = null;
        if (t.boardGroup) for (const c of t.boardGroup.children) if (PLATE.has(c.name)) c.visible = true;
      }
      renderPrev = null;
    },
  };
}
