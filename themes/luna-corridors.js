/* Luna's corridors: each side's buildings joined into a network of its
   own, worked out from wherever the pieces stand, so it is laid again
   after every move (user: "each side's own corridors, re-routed every
   move"). Inflatable tubes (round in section: user, "Put the round
   inflatable tubes back as well"), ribbed at the pinches, a stripe of the
   side's accent along the top; at every turn or branch the chosen
   interchange (user: "number 91 neutral interchange, but make it a little
   bit smaller"): a squircle drum with a band and a low dome, a lamp on
   it; collars where a tube meets a wall or a drum. Where the two sides'
   corridors cross, both run into a grey interchange banded in both sides'
   colours. A building no corridor can reach stands on its own, a beacon
   on its roof.

   routeCorridors: the plan (pure, no three.js). buildCorridors: the
   meshes, in three groups (each side's, and the crossings'), each part
   marked for luna-fx.js to deflate and inflate. */

import * as THREE from "three";
import { SQUARE_SIZE } from "../engine/constants.js";
import { PAL, std, shade, mesh, glowSprite, loft, sqPts, sqDomeGeo, PS } from "./luna-models.js";

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // N S W E as [dRow, dCol]
const AXIS = [0, 0, 1, 1];

/* A side's network grows out from its Cabeza: the cheapest way from what
   is already joined to the next building (few turns, sharing corridors
   already laid, keeping a square off the other side's buildings). It may
   cross the other side's corridor only straight over a straight run of
   it, never turn or branch there. Buildings side by side are joined by a
   short neck across the gap. */
export function routeCorridors(pieces, opts = {}) {
  const R = opts.rows || 10, C = opts.cols || 10, key = (r, c) => r * C + c, inb = (r, c) => r >= 0 && r < R && c >= 0 && c < C;
  const occ = Array.from({ length: R }, () => Array(C).fill(-1));
  pieces.forEach((p, i) => { for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) if (inb(r, c)) occ[r][c] = i; });
  const blocked = new Set((opts.blocked || []).map(([r, c]) => key(r, c)));
  const free = (r, c) => inb(r, c) && occ[r][c] < 0 && !blocked.has(key(r, c));
  const net = { light: new Map(), dark: new Map() };
  const open = (side, r, c, d) => { const k = key(r, c); if (!net[side].has(k)) net[side].set(k, new Set()); net[side].get(k).add(d); };
  const straightRun = (side, r, c) => { const s = net[side].get(key(r, c)); return s && s.size === 2 && AXIS[[...s][0]] === AXIS[[...s][1]] ? AXIS[[...s][0]] : -1; };
  const links = [], stranded = [];
  for (const side of ["light", "dark"]) {
    const other = side === "light" ? "dark" : "light";
    const mine = pieces.map((_, i) => i).filter((i) => pieces[i].owner === side);
    if (!mine.length) continue;
    const joined = new Set([mine.find((i) => pieces[i].type === "cabeza") ?? mine[0]]);
    const nearOther = (r, c) => DIRS.some(([dr, dc]) => inb(r + dr, c + dc) && occ[r + dr][c + dc] >= 0 && pieces[occ[r + dr][c + dc]].owner !== side);
    // the squares a piece stands on (an odd piece's arch opening or overhang is no door)
    const cells = (i) => { const p = pieces[i], out = [], g0 = p.vox ? new Set(p.vox.split(";").map((t) => t.split(",").map(Number)).filter((q) => q[2] === 0).map((q) => `${q[1]},${q[0]}`)) : null; for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) if (inb(r, c) && (!g0 || g0.has(`${r - p.row},${c - p.col}`))) out.push([r, c]); return out; };
    const onGround = (i, r, c) => cells(i).some(([a, b]) => a === r && b === c);
    let guard = 0;
    while (joined.size < mine.length && guard++ < 64) {
      let best = null;
      for (const i of mine) if (!joined.has(i)) for (const [r, c] of cells(i)) DIRS.forEach(([dr, dc]) => {
        const j = inb(r + dr, c + dc) ? occ[r + dr][c + dc] : -1;
        if (j >= 0 && joined.has(j) && onGround(j, r + dr, c + dc) && (!best || best.cost > 0.5)) best = { cost: 0.5, piece: i, path: [], from: { piece: j, cell: [r + dr, c + dc] }, to: { piece: i, cell: [r, c] } };
      });
      if (!best) {
        const dist = new Map(), prev = new Map(), heap = [];
        const push = (r, c, d, cost, from) => { const k = key(r, c) * 5 + (d + 1); if (dist.has(k) && dist.get(k) <= cost) return; dist.set(k, cost); prev.set(k, from); heap.push([cost, r, c, d, k]); };
        for (const j of joined) for (const [r, c] of cells(j)) DIRS.forEach(([dr, dc], d) => {
          if (free(r + dr, c + dc) && !net[other].has(key(r + dr, c + dc))) push(r + dr, c + dc, d, 1 + (nearOther(r + dr, c + dc) ? 0.35 : 0), { start: { piece: j, cell: [r, c] } });
        });
        for (const [k] of net[side]) { const r = Math.floor(k / C), c = k % C; if (!net[other].has(k)) push(r, c, -1, 0, { start: { junction: [r, c] } }); }
        const targets = new Map();
        for (const i of mine) if (!joined.has(i)) for (const [r, c] of cells(i)) DIRS.forEach(([dr, dc], d) => {
          const rr = r - dr, cc = c - dc;
          if (free(rr, cc)) { const k = key(rr, cc); if (!targets.has(k)) targets.set(k, []); targets.get(k).push([i, [r, c], d]); }
        });
        let found = null;
        while (heap.length) {
          let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
          const [cost, r, c, d, sk] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
          if (dist.get(sk) < cost) continue;
          if (found && cost >= found.cost) break;
          const k = key(r, c), crossing = net[other].has(k);
          if (targets.has(k) && !crossing) for (const [i, cell, din] of targets.get(k)) {
            const tc = cost + 1 + (d >= 0 && din !== d ? 0.7 : 0);
            if (!found || tc < found.cost) found = { cost: tc, piece: i, end: sk, to: { piece: i, cell }, din };
          }
          DIRS.forEach(([dr, dc], nd) => {
            if (crossing && nd !== d) return;
            const nr = r + dr, nc = c + dc;
            if (!free(nr, nc)) return;
            const nk = key(nr, nc);
            let step = 1 + (d >= 0 && nd !== d ? 0.7 : 0) + (nearOther(nr, nc) ? 0.35 : 0);
            if (net[other].has(nk)) { if (net[side].has(nk) || straightRun(other, nr, nc) !== 1 - AXIS[nd]) return; step += 2.5; }
            else if (net[side].has(nk)) step -= 0.7;
            push(nr, nc, nd, cost + step, { prev: sk });
          });
        }
        if (!found) { for (const i of mine) if (!joined.has(i)) stranded.push({ side, piece: i }); break; }
        const path = [];
        let k = found.end, from = null;
        while (true) { const pr = prev.get(k), cell = Math.floor(k / 5); path.unshift([Math.floor(cell / C), cell % C]); if (pr.start) { from = pr.start; break; } k = pr.prev; }
        best = { cost: found.cost, piece: found.piece, path, from, to: found.to };
      }
      const pts = [best.from.piece != null ? best.from.cell : null, ...best.path, best.to.cell];
      const seq = best.from.junction ? [best.from.junction, ...best.path.slice(1), best.to.cell] : pts;
      for (let a = 0; a + 1 < seq.length; a++) {
        if (!seq[a] || !seq[a + 1]) continue;
        const [r0, c0] = seq[a], [r1, c1] = seq[a + 1], d = DIRS.findIndex(([dr, dc]) => dr === r1 - r0 && dc === c1 - c0);
        if (d < 0) continue;
        if (free(r0, c0)) open(side, r0, c0, d);
        if (free(r1, c1)) open(side, r1, c1, d ^ 1);
      }
      best.side = side;
      best.crossings = best.path.filter(([r, c]) => net[other].has(key(r, c))).map(([r, c]) => [r, c]);
      links.push(best);
      joined.add(best.piece);
    }
  }
  return { links, net, stranded, rows: R, cols: C };
}

/* ------------------------------------------------------------ the meshes */

const CFG = { r: 0.09, nodeK: 2.1, hubK: 2.1 };
const MATS = {};
function mats(side) {
  if (MATS[side]) return MATS[side];
  const pal = PAL[side];
  return (MATS[side] = {
    body: std(pal.wall, { roughness: 0.45, metalness: 0.15 }),
    rib: std(shade(pal.wall, side === "light" ? 0.78 : 1.7), { roughness: 0.4, metalness: 0.5 }),
    accent: std(pal.accent, { roughness: 0.5 }),
  });
}
// shapes every corridor shares, made once
const SHARED = {};
function shared() {
  if (SHARED.rib) return SHARED;
  const r = CFG.r;
  SHARED.rib = new THREE.TorusGeometry(r * 0.88, 0.012, 6, 22); SHARED.rib.rotateX(Math.PI / 2);
  SHARED.collar = new THREE.CylinderGeometry(r * 1.32, r * 1.32, 0.06, 22);
  SHARED.ball = new THREE.SphereGeometry(r * 0.999, 18, 12);
  const K = CFG.nodeK, k = K / 2.6, R = r * K, h = r * 2 + 0.12 * k * k, bp = sqPts(R + 0.006);
  SHARED.node = { R, h, k, drum: loft([{ pts: sqPts(R), y: 0 }, { pts: sqPts(R), y: h }]), band: loft([{ pts: bp, y: h * 0.6 - 0.017 * k }, { pts: bp, y: h * 0.6 + 0.017 * k }]), dome: sqDomeGeo(R, 0.4) };
  const RH = r * CFG.hubK, kh = RH / (r * 2.6), hh = r * 2 + 0.12 * kh * kh, hp = sqPts(RH + 0.006), band = (y) => loft([{ pts: hp, y: y - 0.015 * kh }, { pts: hp, y: y + 0.015 * kh }]);
  SHARED.hub = { R: RH, h: hh, k: kh, drum: loft([{ pts: sqPts(RH), y: 0 }, { pts: sqPts(RH), y: hh }]), bandLo: band(hh * 0.42), bandHi: band(hh * 0.72), dome: sqDomeGeo(RH, 0.4) };
  SHARED.grey = std("#9aa0a7", { metalness: 0.35, roughness: 0.45 });
  SHARED.mast = new THREE.BoxGeometry(0.016, 0.22, 0.016);
  SHARED.beacon = new THREE.SphereGeometry(0.03, 12, 8);
  return SHARED;
}
const OWN = "lunaOwn"; // geometry made for one build, disposed with it

// a frame from a to b: y along the run, z as near straight up as it can be, x across
function runFrame(a, b) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), L = dir.length(); dir.normalize();
  const up = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)).normalize(), x = new THREE.Vector3().crossVectors(dir, up);
  const G = new THREE.Group(); G.position.copy(A).add(B).multiplyScalar(0.5); G.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, up));
  G.userData.inflate = "radial";
  return [G, L];
}
// the inflatable's bulging segments, round in section, a rib at each pinch, the stripe along the top
function arm(out, Mt, a, b) {
  const [G, L] = runFrame(a, b), r = CFG.r, S = shared();
  if (L < 0.01) return;
  const nb = Math.max(1, Math.round(L / 0.15)), prof = [];
  for (let i = 0; i <= nb * 8; i++) { const t = i / (nb * 8), k = Math.abs(Math.sin(t * nb * Math.PI)); prof.push(new THREE.Vector2(r * (0.86 + 0.16 * k ** 0.6), -L / 2 + t * L)); }
  const lathe = new THREE.LatheGeometry(prof, 22); lathe.userData[OWN] = true;
  G.add(mesh(lathe, Mt.body));
  for (let i = 0; i <= nb; i++) G.add(mesh(S.rib, Mt.rib, 0, -L / 2 + (i / nb) * L, 0));
  const stripe = new THREE.BoxGeometry(0.024, L * 0.98, 0.008); stripe.userData[OWN] = true;
  G.add(mesh(stripe, Mt.accent, 0, 0, r * 1.0));
  out.add(G);
}
function collar(out, Mt, x, y, z, d) {
  const [dr, dc] = DIRS[d], [G] = runFrame([x - dc * 0.03, y, z - dr * 0.03], [x + dc * 0.03, y, z + dr * 0.03]);
  G.add(mesh(shared().collar, Mt.accent)); out.add(G);
}
function node(out, Mt, x, y, z) {
  const S = shared().node, G = new THREE.Group();
  G.position.set(x, y, z); G.userData.inflate = "whole";
  G.add(mesh(S.drum, Mt.body), mesh(S.band, Mt.accent), mesh(S.dome, Mt.body, 0, S.h, 0));
  const lamp = glowSprite("#ffd27a", 0.22 * S.k, 0.8); lamp.position.set(0, S.h + S.R * 0.4 + 0.03 * S.k, 0); G.add(lamp);
  out.add(G);
  return S.R;
}
function neutralHub(out, x, y, z) {
  const S = shared().hub, G = new THREE.Group();
  G.position.set(x, y, z); G.userData.inflate = "whole";
  G.add(mesh(S.drum, shared().grey), mesh(S.bandLo, mats("light").accent), mesh(S.bandHi, mats("dark").accent), mesh(S.dome, shared().grey, 0, S.h, 0));
  const lamp = glowSprite("#ffd27a", 0.22 * S.k, 0.8); lamp.position.set(0, S.h + S.R * 0.4 + 0.03 * S.k, 0); G.add(lamp);
  out.add(G);
}

/* The corridors for the pieces where they stand. `at(r, c)` the square's
   middle on the board, `foot(piece)` its footprint (luna-models.js
   footprintOf), `ground(x, z)` the ground's height there. */
export function buildCorridors(pieces, plan, { at, foot, ground }) {
  const groups = { light: new THREE.Group(), dark: new THREE.Group(), cross: new THREE.Group() };
  for (const k in groups) groups[k].name = `luna-corridors-${k}`;
  const C = plan.cols, r = CFG.r, yG = r + 0.026, S = shared();
  const pieceAt = (rr, cc) => pieces.find((p) => rr >= p.row && rr < p.row + p.h && cc >= p.col && cc < p.col + p.w);
  const FOOT = new Map(); pieces.forEach((p) => FOOT.set(p.id, foot(p)));
  const crossBy = { light: new Set(), dark: new Set() };
  plan.links.forEach((l) => l.crossings.forEach(([rr, cc]) => crossBy[l.side].add(rr * C + cc)));
  const allCross = new Set([...crossBy.light, ...crossBy.dark]);
  // where a run from a square's middle towards a building meets its wall
  const wallPoint = (cx, cz, tx, tz, f) => { for (let t = 0; t <= 1.0001; t += 0.005) { const x = cx + (tx - cx) * t, z = cz + (tz - cz) * t; if (f.inside(x - f.x, z - f.z)) return [x, z]; } return [tx, tz]; };
  const y0 = (x, z) => ground(x, z) + yG;
  const hubsDone = new Set();
  for (const side of ["light", "dark"]) {
    const out = groups[side], Mt = mats(side);
    for (const [k, dirs] of plan.net[side]) {
      const rr = Math.floor(k / C), cc = k % C, [cx, cz] = at(rr, cc), ds = [...dirs], straight = ds.length === 2 && (ds[0] ^ 1) === ds[1], yc = y0(cx, cz);
      if (allCross.has(k)) {
        // both sides run in to the grey interchange and stop at its wall
        const R = S.hub.R, stop = R * 0.92;
        for (const d of ds) { const [dr, dc] = DIRS[d], ex = cx + (dc * SQUARE_SIZE) / 2, ez = cz + (dr * SQUARE_SIZE) / 2; arm(out, Mt, [cx + dc * stop, yc, cz + dr * stop], [ex, y0(ex, ez), ez]); collar(out, Mt, cx + dc * (R + 0.02), yc, cz + dr * (R + 0.02), d); }
        if (!hubsDone.has(k)) { hubsDone.add(k); neutralHub(groups.cross, cx, ground(cx, cz), cz); }
        continue;
      }
      for (const d of ds) {
        const [dr, dc] = DIRS[d], nr = rr + dr, nc = cc + dc, pc = pieceAt(nr, nc), f = pc && FOOT.get(pc.id);
        if (f) {
          const [tx, tz] = at(nr, nc), [sx, sz] = wallPoint(cx, cz, tx, tz, f), ye = y0(sx, sz);
          arm(out, Mt, [cx, yc, cz], [sx + dc * 0.05, ye, sz + dr * 0.05]); collar(out, Mt, sx, ye, sz, d);
        } else { const ex = cx + (dc * SQUARE_SIZE) / 2, ez = cz + (dr * SQUARE_SIZE) / 2; arm(out, Mt, [cx, yc, cz], [ex, y0(ex, ez), ez]); }
      }
      if (!straight) { const R = node(out, Mt, cx, ground(cx, cz), cz); for (const d of ds) { const [dr, dc] = DIRS[d]; collar(out, Mt, cx + dc * (R + 0.02), yc, cz + dr * (R + 0.02), d); } }
      else { const b = mesh(S.ball, Mt.body, 0, 0, 0), G = new THREE.Group(); G.position.set(cx, yc, cz); G.userData.inflate = "whole"; G.add(b); out.add(G); }
    }
    // buildings side by side: a short neck straight across the gap
    for (const l of plan.links) if (l.side === side && !l.path.length) {
      const a = pieces.find((p, i) => i === l.from.piece), b = pieces.find((p, i) => i === l.to.piece);
      const fa = a && FOOT.get(a.id), fb = b && FOOT.get(b.id); if (!fa || !fb) continue;
      const [ax, az] = at(...l.from.cell), [bx, bz] = at(...l.to.cell);
      let t0 = 0, t1 = 1; for (let t = 0; t <= 1; t += 0.005) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (fa.inside(x - fa.x, z - fa.z)) t0 = t; }
      for (let t = 1; t >= 0; t -= 0.005) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (fb.inside(x - fb.x, z - fb.z)) t1 = t; }
      if (t1 - t0 < 0.02) continue;
      const P0 = [ax + (bx - ax) * (t0 - 0.04), 0, az + (bz - az) * (t0 - 0.04)], P1 = [ax + (bx - ax) * (t1 + 0.04), 0, az + (bz - az) * (t1 + 0.04)];
      P0[1] = y0(P0[0], P0[2]); P1[1] = y0(P1[0], P1[2]);
      arm(out, Mt, P0, P1);
      const d = DIRS.findIndex(([dr, dc]) => dr === Math.sign(l.to.cell[0] - l.from.cell[0]) && dc === Math.sign(l.to.cell[1] - l.from.cell[1]));
      if (d >= 0) {
        const c0 = [ax + (bx - ax) * t0, az + (bz - az) * t0], c1 = [ax + (bx - ax) * t1, az + (bz - az) * t1];
        collar(out, Mt, c0[0], y0(c0[0], c0[1]), c0[1], d); collar(out, Mt, c1[0], y0(c1[0], c1[1]), c1[1], d);
      }
    }
  }
  // a building no corridor can reach: on its own, a beacon on its roof
  for (const { side, piece } of plan.stranded) {
    const p = pieces[piece], f = p && FOOT.get(p.id); if (!f) continue;
    const top = p.type === "cabeza" ? 0.45 : p.z * PS + 0.05, G = new THREE.Group();
    G.position.set(f.x, top, f.z); G.userData.inflate = "whole";
    G.add(mesh(S.mast, std("#c8ccd0", { metalness: 0.5 }), 0, 0.11, 0), new THREE.Mesh(S.beacon, new THREE.MeshBasicMaterial({ color: 0xffb020 })).translateY(0.24));
    const sp = glowSprite("#ffb030", 0.42, 0.9); sp.position.y = 0.24; G.add(sp);
    groups[side].add(G);
  }
  return groups;
}
// Disposes what one build made for itself (the shared shapes and the materials stay).
export function disposeCorridors(groups) {
  for (const k in groups) {
    const g = groups[k];
    g.traverse((o) => {
      if (o.geometry && o.geometry.userData && o.geometry.userData[OWN]) o.geometry.dispose();
      if (o.isSprite && o.material) o.material.dispose();
    });
    if (g.parent) g.parent.remove(g);
  }
}

// A signature of a side's network, to tell whether a move changed it.
export function networkKey(plan, side) {
  const cells = [...plan.net[side]].map(([k, d]) => `${k}:${[...d].sort().join("")}`).sort().join(" ");
  const links = plan.links.filter((l) => l.side === side).map((l) => `${l.from.piece ?? "j"}>${l.to.piece}@${l.to.cell}`).sort().join(" ");
  const str = plan.stranded.filter((s) => s.side === side).map((s) => s.piece).join(",");
  return `${cells}|${links}|${str}`;
}
