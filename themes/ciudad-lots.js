/* Ciudad's free blocks: the city goes on between the buildings (user,
   round 6: "variety in the blocks between streets ... parks, art, subway,
   construction, plazas, courts"; round 8: "a construction site or two with
   really, really tall cranes ... They just can't look like the buildings";
   "Partially constructed I-beam structure skeleton can be in one of the
   blank game board squares as City flavor").

   - When a game is set out, about half the free blocks get a lot, drawn
     on the board (ciudad.js BOARD_PAINT) with its low relief on top so it
     never reads as a piece: a park (a grove, a pond, a path), a lawn, a
     plaza with its fountain, a subway entrance (glass canopies, the red
     globe), a court, a building site (hoarding, a digger, a hut).
   - The cranes (user: "Cranes heights don't always have to be the same.
     If a building moves onto a square with a crane, it obviously will
     disappear. Try to keep cranes as far from other pieces as possible,
     but once placed it remains in that square until displaced by a
     playing piece moving into its square"): two building sites on the
     free squares farthest from every piece (and from each other), each
     with a tower crane of its own height, 4 to 7 cubes; now and then a
     crane swings its jib round. At night their beacons burn red and the
     cab is lit.
   - A steel frame going up on the next farthest square: red-oxide
     I-sections, decks on the lower floors, a brace, beams waiting on the
     ground; at night a string of bulbs round its second floor and someone
     at work with a welder up top.
   - A building moving onto a lot's block takes it, and the lot goes on
     elsewhere (user: "whenever one of those is destroyed, that same piece
     that gets run over needs to reappear somewhere else on the map"): the
     block under the building plain paving again, and the same lot (its
     trees, its crane, its frame) on a free block, growing up out of the
     ground there. A crane's site and the frame go as far from the pieces
     as can be, as they were laid out; any other lot to a block a square
     clear of them if there is one. Only with no free block left is it
     gone. A new game lays the lots out afresh. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOARD_ROWS, BOARD_COLS, SQUARE_SIZE, OFF_X, OFF_Z, PIECE_SCALE, MISSING_SQUARES, BLACK_HOLES } from "../engine/constants.js";
import { col, glowTex } from "./ciudad-models.js";
import { BOARD_PAINT, STREET } from "./ciudad.js";

const PS = PIECE_SCALE, SQ = SQUARE_SIZE;
const LOT_TYPES = ["park", "lawn", "park", "plaza", "lawn", "park", "subway", "plaza", "lawn", "court", "construction", "park"];
const LEAVES = ["#5f7e4a", "#6a8a52", "#567446", "#728e58", "#4e6a3e"];
const TREE_KINDS = ["round", "round", "cluster", "oval", "round", "cluster", "flat", "round", "blossom", "autumn", "oval", "cluster"];
const TREE_COLS = { blossom: ["#dcc6c2", "#e6d4cc"], autumn: ["#c89a5e", "#b8844e", "#caa868"] };
const CRANE_COLOR = "#d4aa3a", FRAME_COLOR = "#8e4a36";

let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];

/* ------------------------------------------------------------ the squares */

// Every square a piece's block covers.
function covered(pieces) {
  const s = new Set();
  for (const p of pieces || []) for (let r = p.row; r < p.row + (p.h || 1); r++) for (let c = p.col; c < p.col + (p.w || 1); c++) s.add(`${r},${c}`);
  return s;
}
const offBoard = () => {
  const s = new Set();
  for (const m of MISSING_SQUARES || []) s.add(`${m.row ?? m[0]},${m.col ?? m[1]}`);
  for (const b of BLACK_HOLES || []) s.add(`${b.row ?? b[0]},${b.col ?? b[1]}`);
  return s;
};
// The n free squares farthest from every piece (its nearest square counts), apart from each other too.
function farSites(pieces, n, avoid, taken) {
  const cells = []; for (const k of taken) cells.push(k.split(",").map(Number));
  const has = (list, r, c) => list.some(([a, b]) => a === r && b === c), out = [];
  for (let k = 0; k < n; k++) {
    let best = null, bd = -1;
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) {
      if (taken.has(`${r},${c}`) || avoid.has(`${r},${c}`) || has(out, r, c)) continue;
      const dP = cells.length ? Math.min(...cells.map(([a, b]) => Math.hypot(a - r, b - c))) : 99;
      const dS = out.length ? Math.min(...out.map(([a, b]) => Math.hypot(a - r, b - c))) / 2 : 99;
      const d = Math.min(dP, dS) + 0.001 * (((r * 7 + c * 3) % 5) / 5);
      if (d > bd) { bd = d; best = [r, c]; }
    }
    if (best) out.push(best);
  }
  return out;
}

/* ------------------------------------------------------------ the lots, drawn */

function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
// A lot drawn flat on its block (the mock-ups' drawLot).
function drawLot(x, X0, Y0, S, t) {
  const k = S / 170, cx = X0 + S / 2, cy = Y0 + S / 2;
  x.save(); x.beginPath(); x.rect(X0, Y0, S, S); x.clip();
  const dots = (n, cols, a0, a1, s0, s1) => { for (let i = 0; i < n; i++) { x.globalAlpha = rr(a0, a1); x.fillStyle = pick(cols); x.fillRect(X0 + rnd() * S, Y0 + rnd() * S, rr(s0, s1) * k, rr(s0, s1) * k); } x.globalAlpha = 1; };
  if (t === "park" || t === "lawn") {
    x.fillStyle = "#86a06a"; x.fillRect(X0, Y0, S, S);
    x.globalAlpha = 0.06; x.fillStyle = "#ffffff"; for (let u = 0; u < S; u += 18 * k) x.fillRect(X0 + u, Y0, 9 * k, S); x.globalAlpha = 1;
    dots(70, ["#6e8a56", "#98ae78"], 0.15, 0.35, 2, 5);
    x.strokeStyle = "#d2c8ae"; x.lineWidth = 9 * k; x.lineCap = "round"; x.beginPath();
    if (t === "lawn") { x.moveTo(X0 - 4, Y0 + S * 0.62); x.lineTo(X0 + S + 4, Y0 + S * 0.62); } else { x.moveTo(X0 - 4, Y0 + S * 0.78); x.bezierCurveTo(X0 + S * 0.4, Y0 + S * 0.74, X0 + S * 0.5, Y0 + S * 0.26, X0 + S + 4, Y0 + S * 0.22); }
    x.stroke();
    if (t === "park") { x.fillStyle = "#7894a2"; x.beginPath(); x.ellipse(X0 + S * 0.28, Y0 + S * 0.3, S * 0.14, S * 0.09, 0.3, 0, 7); x.fill(); x.strokeStyle = "#cbc1a8"; x.lineWidth = 3 * k; x.stroke(); }
  } else if (t === "plaza") {
    x.fillStyle = "#d8ccb6"; x.fillRect(X0, Y0, S, S);
    for (let r = S * 0.72, i = 0; r > S * 0.2; r -= 12 * k, i++) { x.strokeStyle = i % 2 ? "#c0b298" : "#e6dcc8"; x.lineWidth = 6 * k; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
    x.fillStyle = "#b8a888"; x.beginPath(); x.arc(cx, cy, S * 0.2, 0, 7); x.fill();
    x.fillStyle = "#7894a2"; x.beginPath(); x.arc(cx, cy, S * 0.16, 0, 7); x.fill();
    x.strokeStyle = "rgba(255,255,255,0.5)"; x.lineWidth = 2 * k; for (const r of [0.05, 0.1]) { x.beginPath(); x.arc(cx, cy, S * r, 0, 7); x.stroke(); }
  } else if (t === "subway") {
    x.fillStyle = "#d2cbbd"; x.fillRect(X0, Y0, S, S);
    x.globalAlpha = 0.25; x.strokeStyle = "#8a826e"; x.lineWidth = 1; for (let u = 8 * k; u < S; u += 16 * k) { x.beginPath(); x.moveTo(X0 + u, Y0); x.lineTo(X0 + u, Y0 + S); x.moveTo(X0, Y0 + u); x.lineTo(X0 + S, Y0 + u); x.stroke(); } x.globalAlpha = 1;
    for (const [ax, ay] of [[0.14, 0.18], [0.56, 0.6]]) {
      const w = S * 0.3, h = S * 0.16; x.fillStyle = "#2e2e32"; x.fillRect(X0 + S * ax, Y0 + S * ay, w, h);
      x.strokeStyle = "#5a5a62"; x.lineWidth = 1.6 * k; for (let u = 5 * k; u < w; u += 6 * k) { x.beginPath(); x.moveTo(X0 + S * ax + u, Y0 + S * ay); x.lineTo(X0 + S * ax + u, Y0 + S * ay + h); x.stroke(); }
    }
    x.fillStyle = "#7a7a80"; for (let i = 0; i < 7; i++) x.fillRect(X0 + S * 0.62 + i * 5 * k, Y0 + S * 0.16, 3 * k, S * 0.18);
  } else if (t === "construction" || t === "frame") {
    x.fillStyle = "#8e7a5e"; x.fillRect(X0, Y0, S, S); dots(180, ["#74624c", "#a4907a", "#62523e"], 0.2, 0.5, 2, 5);
    x.strokeStyle = "rgba(60,40,24,0.55)"; x.lineWidth = 3 * k; for (const d of [-7, 7]) { x.beginPath(); x.moveTo(X0, cy + d * k + 20 * k); x.bezierCurveTo(X0 + S * 0.4, cy + d * k - 10 * k, X0 + S * 0.6, cy + d * k + 40 * k, X0 + S, cy + d * k); x.stroke(); }
    x.fillStyle = "#5a4430"; x.fillRect(X0 + S * 0.12, Y0 + S * 0.12, S * 0.5, S * 0.42); x.fillStyle = "#463422"; x.fillRect(X0 + S * 0.17, Y0 + S * 0.17, S * 0.4, S * 0.32);
    x.fillStyle = "#3a2a1c"; for (let i = 0; i < 4; i++) x.fillRect(X0 + S * (0.2 + i * 0.1), Y0 + S * 0.2, 2 * k, S * 0.26);
  } else if (t === "court") {
    x.fillStyle = "#62788a"; x.fillRect(X0, Y0, S, S); x.fillStyle = "#a87460"; x.fillRect(X0 + S * 0.08, Y0 + S * 0.14, S * 0.84, S * 0.72);
    x.strokeStyle = "#e8e2d4"; x.lineWidth = 2.6 * k; x.strokeRect(X0 + S * 0.1, Y0 + S * 0.16, S * 0.8, S * 0.68);
    x.beginPath(); x.moveTo(cx, Y0 + S * 0.16); x.lineTo(cx, Y0 + S * 0.84); x.stroke(); x.beginPath(); x.arc(cx, cy, S * 0.09, 0, 7); x.stroke();
    for (const sx of [0.1, 0.9]) { x.beginPath(); x.arc(X0 + S * sx, cy, S * 0.17, sx < 0.5 ? -1.5708 : 1.5708, sx < 0.5 ? 1.5708 : 4.7124); x.stroke(); }
  }
  x.restore();
}

/* ------------------------------------------------------------ parts */

const MATS = new Map();
function std(c, o = {}) {
  const key = c + JSON.stringify(o);
  let m = MATS.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.8, metalness: 0.05, ...o }); m.userData.shared = true; MATS.set(key, m); }
  return m;
}
// A lot's relief, gathered by material and merged: one mesh a material.
function partsOf() {
  const parts = new Map(), extra = [];
  const add = (geo, mat) => { const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); (parts.get(mat) || parts.set(mat, []).get(mat)).push(g); };
  return {
    box(w, h, d, mat, x, y, z, rot) { const g = new THREE.BoxGeometry(w, h, d); if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(x, y, z); add(g, mat); },
    geo(g, mat) { add(g, mat); },
    extra(o) { extra.push(o); },
    group(cast = true) {
      const grp = new THREE.Group();
      for (const [mat, geos] of parts) {
        const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos), mat);
        geos.forEach((q) => q.dispose());
        m.castShadow = cast && !mat.transparent; m.receiveShadow = true; m.raycast = () => {};
        grp.add(m);
      }
      extra.forEach((o) => grp.add(o));
      return grp;
    },
  };
}

/* ------------------------------------------------------------ the lots */

export function createLots({ tier }) {
  const group = new THREE.Group(); group.name = "ciudad-lots";
  const low = tier === "low";
  const lots = new Map(); // "r,c" -> { type, grp, trees: [...], crane }
  let sig = "", made = false, treeMesh = null, trunkMesh = null, nightNow = 0;
  const nightFns = new Set(); // this layout's own night lights
  const pending = new Map(); // "r,c" -> when a building first stood on it
  const swing = []; // the cranes' slewing
  const grows = []; // lots moved, growing up on their new blocks: { L, t0 }

  // something lit only at night, for this layout
  const nightMat = (m, k = 1) => { m.transparent = true; m.opacity = 0; m.depthWrite = false; nightFns.add((n) => { m.opacity = n * k; m.visible = n > 0.01; }); return m; };
  const nightGlow = (color, size, k = 0.8) => {
    const s = new THREE.Sprite(nightMat(new THREE.SpriteMaterial({ map: glowTex(), color: col(color), blending: THREE.AdditiveBlending, toneMapped: false }), k));
    s.scale.set(size, size, 1); s.raycast = () => {}; return s;
  };

  /* -------- trees: one instanced draw for the trunks, one for the crowns */
  const trees = []; // { key, x, z, k, kind, color }
  function tree(key, x, z, k, kind) {
    const c = kind === "blossom" ? pick(TREE_COLS.blossom) : kind === "autumn" ? pick(TREE_COLS.autumn) : pick(LEAVES);
    // the crown's spheres: three in a cluster, one otherwise (as the mock-ups' treeAt)
    const balls = kind === "cluster" ? [0, 1, 2].map(() => [rr(-0.035, 0.035), rr(0, 0.025), rr(-0.035, 0.035), rr(0.045, 0.068)]) : null;
    trees.push({ key, x, z, k, kind, c, balls, r: rr(0.062, 0.08), sy: rr(0.85, 1) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.008, 0.012, 1, 6).translate(0, 0.5, 0), crownGeo = new THREE.SphereGeometry(1, 12, 9);
  const trunkMat = std("#6a5440", { roughness: 0.9 }), crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  // a tree's crown: its spheres, [x, y, z, sx, sy, sz, colour]
  function crownsOf(t) {
    const k = t.k, th = 0.07 * k * (t.kind === "flat" ? 1.5 : t.kind === "oval" ? 1.1 : 1);
    t.th = th;
    if (t.balls) return t.balls.map(([dx, dy, dz, r0]) => { const r = r0 * k; return [t.x + dx * k, th + r * 0.75 + dy * k, t.z + dz * k, r, r, r, t.c]; });
    if (t.kind === "oval") return [[t.x, th + 0.075 * k, t.z, 0.05 * k, 0.085 * k, 0.05 * k, t.c]];
    if (t.kind === "flat") return [[t.x, th + 0.02 * k, t.z, 0.098 * k, 0.036 * k, 0.098 * k, t.c]];
    const r = t.r * k;
    return [[t.x, th + r * 0.85, t.z, r, r * t.sy, r, t.c]];
  }
  function placeTrees() {
    for (const m of [treeMesh, trunkMesh]) if (m) { group.remove(m); m.dispose(); }
    treeMesh = trunkMesh = null;
    if (!trees.length) return;
    trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    treeMesh = new THREE.InstancedMesh(crownGeo, crownMat, trees.reduce((n, t) => n + crownsOf(t).length, 0));
    writeTrees(true);
    for (const m of [trunkMesh, treeMesh]) { m.castShadow = true; m.receiveShadow = true; m.raycast = () => {}; group.add(m); }
  }
  // Every tree where it stands, each grown t.grow of the way up from its
  // foot (a moved lot's come up with it; 1 when not given), and their
  // colours the first time.
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  function writeTrees(colours) {
    if (!trunkMesh || !treeMesh) return;
    let i = 0;
    trees.forEach((t, ti) => {
      const g = t.grow == null ? 1 : Math.max(0.001, t.grow), crowns = crownsOf(t);
      v3.set(t.x, 0, t.z); s3.set(t.k, t.th * g, t.k); m4.compose(v3, q0, s3); trunkMesh.setMatrixAt(ti, m4);
      for (const [x, y, z, sx, sy, sz, c] of crowns) {
        v3.set(t.x + (x - t.x) * g, y * g, t.z + (z - t.z) * g); s3.set(sx * g, sy * g, sz * g); m4.compose(v3, q0, s3);
        treeMesh.setMatrixAt(i, m4);
        if (colours) treeMesh.setColorAt(i, col(c));
        i++;
      }
    });
    trunkMesh.instanceMatrix.needsUpdate = true; treeMesh.instanceMatrix.needsUpdate = true;
    if (colours && treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;
  }

  /* -------- each lot's relief */
  function relief(key, t, cx, cz) {
    const P = partsOf(), hf = (SQ - STREET) / 2 - 0.05, S2 = hf * 2, at = (fx, fz) => [cx - hf + fx * S2, cz - hf + fz * S2];
    const tr = (x, z, s = 1, kind) => tree(key, x, z, s, kind || pick(TREE_KINDS));
    if (t === "lawn") {
      for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) { const [x, z] = at(rr(0.12, 0.88), rr(0.12, 0.5)); tr(x, z, rr(1.0, 1.5) * 1.25); }
    } else if (t === "park") {
      const n = 6 + Math.floor(rnd() * 4), [px, pz] = at(0.28, 0.3);
      for (let i = 0, k = 0; i < n * 4 && k < n; i++) { const [x, z] = at(rr(0.1, 0.9), rr(0.1, 0.9)); if (Math.hypot(x - px, z - pz) < hf * 0.36) continue; tr(x, z, rr(1.0, 1.45) * 1.25); k++; }
      for (const [fx, fz] of [[0.55, 0.5], [0.3, 0.72]]) { const [x, z] = at(fx, fz); P.box(0.06, 0.014, 0.018, std("#7a5a3a"), x, 0.012, z); }
    } else if (t === "plaza") {
      const ring = new THREE.TorusGeometry(hf * 0.42, 0.012, 6, 40); ring.rotateX(Math.PI / 2); ring.translate(cx, 0.012, cz); P.geo(ring, std("#b8a888", { roughness: 0.7 }));
      const jet = new THREE.CylinderGeometry(0.004, 0.016, 0.09, 8); jet.translate(cx, 0.045, cz); P.geo(jet, std("#e8f4ff", { transparent: true, opacity: 0.7, roughness: 0.1 }));
      for (const [fx, fz] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) { const [x, z] = at(fx, fz); P.box(0.05, 0.03, 0.05, std("#9a8e7a"), x, 0.015, z); tr(x, z, 0.85, "round"); }
    } else if (t === "subway") {
      const glass = std("#cfe4ee", { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.3 }), steel = std("#3a3e44", { metalness: 0.5, roughness: 0.4 });
      for (const [ax, ay] of [[0.14, 0.18], [0.56, 0.6]]) {
        const [x, z] = at(ax + 0.15, ay + 0.08), w = S2 * 0.3, d = S2 * 0.16, hgt = 0.07;
        P.box(w, 0.004, d, glass, x, hgt, z, [0, 0, 0.12]);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.005, hgt, 0.005, steel, x + (sx * w) / 2, hgt / 2, z + (sz * d) / 2);
        P.box(w, 0.025, 0.003, steel, x, 0.012, z - d / 2); P.box(0.003, 0.025, d, steel, x - w / 2, 0.012, z); P.box(0.003, 0.025, d, steel, x + w / 2, 0.012, z);
      }
      const [px, pz] = at(0.5, 0.42); const post = new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6); post.translate(px, 0.065, pz); P.geo(post, steel);
      const globeM = new THREE.MeshStandardMaterial({ color: col("#d8282a"), emissive: col("#d8282a"), emissiveIntensity: 0.3 });
      nightFns.add((n) => { globeM.emissiveIntensity = 0.3 + 1.2 * n; });
      const globe = new THREE.SphereGeometry(0.02, 12, 8); globe.translate(px, 0.14, pz); P.geo(globe, globeM);
    } else if (t === "construction") {
      const ply = std("#c8a878", { roughness: 0.9 }), yel = std("#e8b81b", { roughness: 0.5 }), dark = std("#2a2a2a");
      const e = hf - 0.02, hh = 0.06;
      P.box(e * 2, hh, 0.006, ply, cx, hh / 2, cz + e); P.box(e * 2, hh, 0.006, ply, cx, hh / 2, cz - e); P.box(0.006, hh, e * 2, ply, cx + e, hh / 2, cz); P.box(0.006, hh, e * 2, ply, cx - e, hh / 2, cz);
      P.box(e * 2, 0.008, 0.008, yel, cx, hh, cz + e); P.box(0.008, 0.008, e * 2, yel, cx + e, hh, cz);
      const [dx, dz] = at(0.62, 0.36); P.box(0.08, 0.02, 0.06, dark, dx, 0.01, dz); P.box(0.07, 0.04, 0.05, yel, dx, 0.04, dz); P.box(0.12, 0.012, 0.012, yel, dx - 0.07, 0.07, dz, [0, 0, -0.5]);
      const [mx, mz] = at(0.78, 0.8); for (let i = 0; i < 3; i++) P.box(0.09, 0.012, 0.03, std("#9a9a96"), mx, 0.006 + i * 0.013, mz);
      const [hx, hz] = at(0.25, 0.78); P.box(0.1, 0.05, 0.05, std("#f0f0ec"), hx, 0.025, hz); P.box(0.1, 0.008, 0.051, std("#2f6fd0"), hx, 0.035, hz);
    } else if (t === "frame") {
      // red-oxide I-sections on a three by three grid, beams round four floors, decks on the lower ones, three
      // columns on up toward a fifth, a cross brace, a bundle of beams waiting; the site's hoarding round it
      const steel = std(FRAME_COLOR, { roughness: 0.55, metalness: 0.35 }), deck = std("#bcbab4", { roughness: 0.85 });
      const ply = std("#c8a878", { roughness: 0.9 }), yel = std("#e8b81b", { roughness: 0.5 }), e = hf - 0.02, hh = 0.06;
      P.box(e * 2, hh, 0.006, ply, cx, hh / 2, cz + e); P.box(e * 2, hh, 0.006, ply, cx, hh / 2, cz - e); P.box(0.006, hh, e * 2, ply, cx + e, hh / 2, cz); P.box(0.006, hh, e * 2, ply, cx - e, hh / 2, cz);
      P.box(e * 2, 0.008, 0.008, yel, cx, hh, cz + e); P.box(0.008, 0.008, e * 2, yel, cx + e, hh, cz);
      const fl = PS / 4, s = hf * 0.6, grid = [-s, 0, s], f = 0.024, w = 0.006;
      const colAt = (x, z, h) => { P.box(f, h, w, steel, cx + x, h / 2, cz + z - f / 2); P.box(f, h, w, steel, cx + x, h / 2, cz + z + f / 2); P.box(w, h, f, steel, cx + x, h / 2, cz + z); };
      const beam = (along, b, y) => {
        const L = s * 2;
        if (along === "x") { P.box(L, w, f, steel, cx, y + f / 2, cz + b); P.box(L, w, f, steel, cx, y - f / 2, cz + b); P.box(L, f, w, steel, cx, y, cz + b); }
        else { P.box(f, w, L, steel, cx + b, y + f / 2, cz); P.box(f, w, L, steel, cx + b, y - f / 2, cz); P.box(w, f, L, steel, cx + b, y, cz); }
      };
      for (const x of grid) for (const z of grid) colAt(x, z, (x <= 0 && z <= 0 && x + z < 0) ? fl * 5 : fl * 4);
      for (let k = 1; k <= 4; k++) for (const b of grid) { if (k < 4 || b === -s) { beam("x", b, k * fl); beam("z", b, k * fl); } }
      for (const [k, part] of [[1, 1], [2, 1], [3, 0.5]]) { const D = s * 2 + f; P.box(D, 0.012, D * part, deck, cx, k * fl - f / 2 - 0.006, cz - D / 2 + (D * part) / 2); }
      const L = Math.hypot(s, fl * 2), a = Math.atan2(fl * 2, s);
      for (const sg of [1, -1]) P.box(0.006, 0.006, L, steel, cx + s + f / 2, fl, cz + s / 2, [sg * a, 0, 0]);
      for (let i = 0; i < 3; i++) P.box(s * 1.4, 0.011, 0.02, steel, cx - s * 0.15, 0.006 + i * 0.012, cz + s + f + 0.035);
      // at night: the site's string of bulbs round the second floor, a lamp on the hoarding, a welder up top
      const bulbM = nightMat(new THREE.MeshBasicMaterial({ color: col("#ffe6b0"), toneMapped: false })), yb = 2 * fl - f * 1.4;
      for (let i = 0; i <= 10; i++) {
        const t2 = -s + (2 * s) * (i / 10), sag = 0.012 * Math.sin(Math.PI * ((i % 5) / 5));
        for (const [bx, bz] of [[t2, s + f], [s + f, t2], [t2, -s - f]]) {
          const b2 = new THREE.SphereGeometry(0.0055, 6, 4); b2.translate(cx + bx, yb - sag, cz + bz); P.geo(b2, bulbM);
          if (i % 2 === 0) { const sp = nightGlow("#ffd890", 0.07, 0.6); sp.position.set(cx + bx, yb - sag, cz + bz); P.extra(sp); }
        }
      }
      const lampAt = [cx + e * 0.85, hh + 0.05, cz + e];
      P.box(0.006, 0.05, 0.006, std("#5a5d60"), lampAt[0], hh + 0.025, lampAt[2]);
      const ls = nightGlow("#ffe0a0", 0.22, 0.7); ls.position.set(...lampAt); P.extra(ls);
      const arc = nightGlow("#d8ecff", 0.3, 1); arc.position.set(cx - s, 4 * fl, cz - s); arc.userData.weld = true; P.extra(arc);
      const seg = []; for (let k = 0; k < 30; k++) { const a2 = rnd() * 6.28, r = rr(0.01, 0.09), len = rr(0.03, 0.22); seg.push(cx - s, 4 * fl, cz - s, cx - s + Math.cos(a2) * r, 4 * fl - len, cz - s + Math.sin(a2) * r); }
      const sg2 = new THREE.BufferGeometry(); sg2.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      const sparks = new THREE.LineSegments(sg2, nightMat(new THREE.LineBasicMaterial({ color: col("#ffb04a"), toneMapped: false }), 0.9)); sparks.userData.weld = true; sparks.raycast = () => {};
      P.extra(sparks);
    } else if (t === "court") {
      const w = std("#f4f4f2"), post = std("#3a3e44", { metalness: 0.5 });
      for (const fx of [0.1, 0.9]) {
        const [x, z] = at(fx, 0.5), s2 = fx < 0.5 ? 1 : -1;
        const pg = new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6); pg.translate(x - s2 * 0.02, 0.05, z); P.geo(pg, post);
        P.box(0.003, 0.03, 0.05, w, x, 0.1, z);
        const hoop = new THREE.TorusGeometry(0.012, 0.002, 6, 16); hoop.rotateX(Math.PI / 2); hoop.translate(x + s2 * 0.014, 0.09, z); P.geo(hoop, std("#e8603a"));
      }
    }
    return P.group();
  }

  /* -------- a tower crane: a lattice mast, the jib and its counter-jib, the cab, the hook; its beacons */
  function crane(cx, cz, h) {
    const steel = std(CRANE_COLOR, { metalness: 0.4, roughness: 0.5 }), P = partsOf(), mastH = h, s = 0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.02, mastH, 0.02, steel, (sx * s) / 2, mastH / 2, (sz * s) / 2);
    for (let y = 0; y < mastH - 0.05; y += s) for (const k of [0, 1, 2, 3]) {
      const sgn = k % 2 ? 1 : -1;
      if (k < 2) P.box(s * 1.414, 0.012, 0.012, steel, 0, y + s / 2, k === 0 ? -s / 2 : s / 2, [0, 0, (Math.PI / 4) * sgn]);
      else P.box(0.012, 0.012, s * 1.414, steel, k === 2 ? -s / 2 : s / 2, y + s / 2, 0, [(Math.PI / 4) * sgn, 0, 0]);
    }
    const jibL = rr(2.6, 3.2);
    for (const dz of [-0.06, 0.06]) P.box(jibL, 0.02, 0.02, steel, jibL / 2 - 1.2, mastH + 0.05, dz);
    P.box(jibL, 0.02, 0.02, steel, jibL / 2 - 1.2, mastH + 0.2, 0);
    for (let x = -1.2; x < jibL - 1.2; x += 0.2) P.box(0.25, 0.012, 0.012, steel, x + 0.1, mastH + 0.125, 0, [0, 0, (Math.round(x * 5) % 2 ? 1 : -1) * 0.9]);
    P.box(0.5, 0.3, 0.3, std("#7d7f82"), -1.1, mastH - 0.05, 0);
    P.box(0.012, 0.18, 0.012, steel, 0, mastH + 0.32, 0);
    const cabM = new THREE.MeshStandardMaterial({ color: col("#d6d8da"), roughness: 0.6, emissive: col("#ffe0a8"), emissiveIntensity: 0 });
    nightFns.add((n) => { cabM.emissiveIntensity = 0.9 * n; });
    P.box(0.25, 0.22, 0.2, cabM, 0.2, mastH - 0.12, 0);
    const hookX = rr(1.0, 1.8), hookY = rr(0.9, 1.5);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(hookX, mastH + 0.04, 0), new THREE.Vector3(hookX, hookY, 0)]), new THREE.LineBasicMaterial({ color: 0x222222 }));
    line.raycast = () => {}; P.extra(line);
    P.box(0.08, 0.1, 0.05, std("#e0b21b"), hookX, hookY - 0.05, 0);
    const redM = new THREE.MeshBasicMaterial({ color: col("#ff2a1a") });
    for (const [bx, by] of [[jibL - 1.2, mastH + 0.25], [-1.2, mastH + 0.25], [0, mastH + 0.42]]) {
      const red = new THREE.SphereGeometry(0.03, 10, 8); red.translate(bx, by, 0); P.geo(red, redM);
      const sp = nightGlow("#ff3a28", 0.42, 0.85); sp.position.set(bx, by, 0); P.extra(sp);
    }
    const g = P.group();
    g.userData.h = mastH;
    g.position.set(cx + 0.18, 0, cz - 0.16);
    g.rotation.y = rnd() * Math.PI * 2;
    swing.push({ g, from: g.rotation.y, to: g.rotation.y, t0: 0, next: 9000 + rnd() * 20000 });
    return g;
  }

  /* -------- laying the lots out for a game */
  function clear() {
    for (const L of lots.values()) { if (L.grp) { group.remove(L.grp); disposeGroup(L.grp); } if (L.crane) { group.remove(L.crane); disposeGroup(L.crane); } }
    lots.clear(); trees.length = 0; nightFns.clear(); pending.clear(); swing.length = 0; grows.length = 0;
  }
  function layOut(pieces) {
    clear();
    seed = 4242 + BOARD_ROWS * 31 + BOARD_COLS;
    const taken = covered(pieces), off = offBoard();
    const free = [];
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) if (!taken.has(`${r},${c}`) && !off.has(`${r},${c}`)) free.push([r, c]);
    // the cranes' sites first, then the frame's, then the lots as they fall
    const sites = farSites(pieces, 2, off, taken), avoid = new Set([...off, ...sites.map((q) => q.join(","))]);
    const frames = farSites(pieces, 1, avoid, taken);
    const plan = new Map();
    let bag = [];
    for (const [r, c] of free) {
      if (!bag.length) bag = LOT_TYPES.slice().sort(() => rnd() - 0.5);
      plan.set(`${r},${c}`, rnd() < 0.5 ? bag.pop() : null);
    }
    sites.forEach(([r, c]) => plan.set(`${r},${c}`, "construction"));
    frames.forEach(([r, c]) => plan.set(`${r},${c}`, "frame"));
    // the cranes' heights: each its own, 4 to 7 cubes' worth and more
    const heights = [rr(5.6, 7.0), rr(4.0, 5.2)];
    let ci = 0;
    for (const [key, type] of plan) {
      if (!type) continue;
      const [r, c] = key.split(",").map(Number), cx = (c + 0.5) * SQ - OFF_X, cz = (r + 0.5) * SQ - OFF_Z;
      const L = { type, r, c, grp: relief(key, type, cx, cz), crane: null };
      group.add(L.grp);
      if (type === "construction" && sites.some(([a, b]) => a === r && b === c)) { L.crane = crane(cx, cz, heights[ci++ % 2]); group.add(L.crane); }
      lots.set(key, L);
    }
    placeTrees();
    paint();
    nightFns.forEach((f) => f(nightNow));
    made = true;
  }
  // the lots on the board's own canvas: every block plain, then each lot drawn on its own
  function paint() {
    if (!BOARD_PAINT.ctx || BOARD_PAINT.rows !== BOARD_ROWS || BOARD_PAINT.cols !== BOARD_COLS) return;
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) BOARD_PAINT.plain(r, c);
    for (const L of lots.values()) { const q = BOARD_PAINT.lotRect(L.r, L.c); drawLot(BOARD_PAINT.ctx, q.x, q.y, q.s, L.type); }
    BOARD_PAINT.tex.needsUpdate = true;
    painted = BOARD_PAINT.tex;
  }
  let painted = null;
  const paintable = () => BOARD_PAINT.ctx && BOARD_PAINT.rows === BOARD_ROWS && BOARD_PAINT.cols === BOARD_COLS;
  /* A building has taken a lot's block: the lot goes on elsewhere, the
     block under the building plain again (see the top). Where: a block no
     piece covers, on the board, with no lot of its own; a crane's site or
     the frame as far from the pieces as can be (farSites, as laid out),
     any other lot one at least a square clear of them if there's one, else
     any. Null: no block left. */
  function siteFor(L, pieces) {
    const cov = covered(pieces), off = offBoard();
    if (L.crane || L.type === "frame") {
      const [site] = farSites(pieces, 1, new Set([...off, ...lots.keys()]), cov);
      return site || null;
    }
    const cells = [...cov].map((k) => k.split(",").map(Number)), free = [];
    for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) {
      const k = `${r},${c}`;
      if (cov.has(k) || off.has(k) || lots.has(k)) continue;
      free.push([r, c, cells.length ? Math.min(...cells.map(([a, b]) => Math.max(Math.abs(a - r), Math.abs(b - c)))) : 99]);
    }
    const clear = free.filter((f) => f[2] >= 2), from = clear.length ? clear : free;
    if (!from.length) return null;
    const [r, c] = from[Math.floor(rnd() * from.length)];
    return [r, c];
  }
  // The same lot, moved to [r, c]: its relief, its crane, its trees
  // shifted there, drawn on its new block (the old one plain), and grown
  // up from the ground (tick).
  function moveLot(L, key, [r, c], now) {
    const to = `${r},${c}`, dx = (c - L.c) * SQ, dz = (r - L.r) * SQ;
    if (paintable()) {
      BOARD_PAINT.plain(L.r, L.c);
      const q = BOARD_PAINT.lotRect(r, c); drawLot(BOARD_PAINT.ctx, q.x, q.y, q.s, L.type);
      BOARD_PAINT.tex.needsUpdate = true;
    }
    if (L.grp) { L.grp.position.x += dx; L.grp.position.z += dz; L.grp.scale.y = 0.001; }
    if (L.crane) { L.crane.position.x += dx; L.crane.position.z += dz; L.crane.scale.y = 0.001; }
    for (const t of trees) if (t.key === key) { t.key = to; t.x += dx; t.z += dz; t.grow = 0; }
    lots.delete(key); pending.delete(key);
    L.r = r; L.c = c; L.moves = (L.moves || 0) + 1;
    lots.set(to, L);
    writeTrees(false);
    grows.push({ L, key: to, t0: now });
  }
  function take(key, pieces, now) {
    const L = lots.get(key);
    if (!L) return;
    const site = pieces ? siteFor(L, pieces) : null;
    if (site) { moveLot(L, key, site, now); return; }
    if (L.grp) { group.remove(L.grp); disposeGroup(L.grp); }
    if (L.crane) { group.remove(L.crane); disposeGroup(L.crane); const i = swing.findIndex((w) => w.g === L.crane); if (i >= 0) swing.splice(i, 1); }
    lots.delete(key);
    for (let i = trees.length - 1; i >= 0; i--) if (trees[i].key === key) trees.splice(i, 1);
    placeTrees();
    if (paintable()) { BOARD_PAINT.plain(L.r, L.c); BOARD_PAINT.tex.needsUpdate = true; }
  }
  function disposeGroup(g) {
    g.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
  }

  return {
    group,
    /* Each frame, from the game: being set out, the lots follow the layout
       (a new game, a changed setup); in play, a lot a building has stood
       on a moment (it has landed) is taken, and goes on elsewhere. */
    update(play, now) {
      const pieces = play.pieces;
      if (!pieces) return;
      if (play.awaitingBegin || !made) {
        const s = `${BOARD_ROWS}x${BOARD_COLS}|` + pieces.map((p) => `${p.id}@${p.row},${p.col},${p.w},${p.h}`).join(";");
        if (s !== sig) { sig = s; layOut(pieces); return; }
      }
      // the board's canvas made again (a new size, a new page of it): the lots painted on afresh
      if (BOARD_PAINT.tex && BOARD_PAINT.tex !== painted) paint();
      if (play.awaitingBegin) return;
      const cov = covered(pieces);
      for (const key of [...lots.keys()]) {
        if (!cov.has(key)) { pending.delete(key); continue; }
        if (!pending.has(key)) pending.set(key, now);
        else if (now - pending.get(key) > 420) { pending.delete(key); take(key, pieces, now); }
      }
    },
    tick(now, n) {
      // a moved lot grows up on its new block: the ground's relief and its
      // trees in under a second, a crane's mast in two, eased in and out
      if (grows.length) {
        for (let i = grows.length - 1; i >= 0; i--) {
          const G = grows[i], u = Math.min(1, (now - G.t0) / 900), uc = Math.min(1, (now - G.t0) / 2000);
          const e = u * u * (3 - 2 * u), ec = uc * uc * (3 - 2 * uc);
          if (G.L.grp) G.L.grp.scale.y = Math.max(0.001, e);
          if (G.L.crane) G.L.crane.scale.y = Math.max(0.001, ec);
          for (const t of trees) if (t.key === G.key) t.grow = u >= 1 ? null : e;
          if (u >= 1 && uc >= 1) grows.splice(i, 1);
        }
        writeTrees(false);
      }
      // a crane swings its jib round now and then (slowly: the shadows follow)
      for (const w of swing) {
        if (!w.t0 && now > w.next) { w.t0 = now; w.from = w.g.rotation.y; w.to = w.from + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 1.4); }
        if (w.t0) {
          const u = Math.min(1, (now - w.t0) / 7000), k = u * u * (3 - 2 * u);
          w.g.rotation.y = w.from + (w.to - w.from) * k;
          if (u >= 1) { w.t0 = 0; w.next = now + 25000 + rnd() * 35000; }
        }
      }
      // the welder at work: the arc flickers, the sparks with it
      if (n > 0.01) for (const L of lots.values()) if (L.type === "frame" && L.grp) L.grp.traverse((o) => { if (o.userData.weld) o.material.opacity = n * (Math.random() < 0.18 ? 0.15 : 0.6 + 0.4 * Math.random()); });
    },
    night(n) { nightNow = n; nightFns.forEach((f) => f(n)); },
    test() { return { lots: [...lots.values()].map((L) => ({ type: L.type, row: L.r, col: L.c, crane: L.crane ? +L.crane.userData.h.toFixed(2) : 0, moves: L.moves || 0, trees: trees.filter((t) => t.key === `${L.r},${L.c}`).length, grown: !grows.some((G) => G.L === L) })), cranes: [...lots.values()].filter((L) => L.crane).map((L) => [L.r, L.c]) }; },
    dispose() { clear(); for (const m of [treeMesh, trunkMesh]) if (m) { group.remove(m); m.dispose(); } trunkGeo.dispose(); crownGeo.dispose(); crownMat.dispose(); },
  };
}
