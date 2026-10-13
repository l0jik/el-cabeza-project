/* The tools the city's Cabezas are made with (ciudad-cabezas.js, the
   eleven; ciudad-rotundas.js, the City Hall rotunda's ten), shared. */

import * as THREE from "three";
import { DISC_DIAM, CABEZA_SCALE } from "../engine/constants.js";
import { FAMILY, builder, std, col, glassy, TIMED, nightGlow, cv, tex, cellPx, seedOf } from "./ciudad-models.js";
import { timeId, timeOf, onTimeChange } from "./ciudad-time.js";

// (from the engine, not ciudad-models.js: that module imports the
// Cabezas, and a value of its read as this one loads isn't there yet; R
// came out NaN and every part sized by it went missing)
export const R = (DISC_DIAM * CABEZA_SCALE) / 2;

/* ------------------------------------------------------------ small tools */

// A side's colours for its Cabeza.
export function tones(side) {
  const F = FAMILY[side], L = side === "light";
  return {
    F, L,
    stone: L ? F.slab : F.walls[0], // the main stone: Chalk's white, Slate's grey-blue
    stone2: L ? F.walls[2] : F.walls[3], // steps, bases
    trim: L ? "#ffffff" : F.walls[2], // posts, rails, eaves
    accent: F.accents[0], // roofs, domes
    glass: F.glasses[0],
  };
}
export const mk = (side, name) => builder(seedOf(`cab-${name}-${side}`), "midmod", FAMILY[side], side, cellPx());
// Glass lit from within: a little by day, warmly at night.
export function litGlass(c, lit = "#ffe0b0", day = 0.1, night = 0.7, o = {}) {
  const m = glassy(new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.1, metalness: 0.45, emissive: col(lit), emissiveIntensity: day, ...o }));
  TIMED.add((n) => { m.emissiveIntensity = day + night * n; });
  return m;
}
// A thing that shines at night (a bulb, a lamp, a light bank, a lit face).
export function litMat(c, lit, day = 0.05, night = 1.2, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.5, emissive: col(lit), emissiveIntensity: day, ...o });
  TIMED.add((n) => { m.emissiveIntensity = day + night * n; });
  return m;
}
// A rod from a to c (legs, braces, rails, jets).
export function rodGeo(a, c, r, seg = 6) {
  const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c), d = C.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
  g.translate((A.x + C.x) / 2, (A.y + C.y) / 2, (A.z + C.z) / 2);
  return g;
}
// A ring of a profile turned round the upright (a basin, a kerb, a bowl).
export const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
export const sphereAt = (r, x, y, z, ws = 10, hs = 8) => { const g = new THREE.SphereGeometry(r, ws, hs); g.translate(x, y, z); return g; };
export const glowAt = (b, color, size, x, y, z, k = 0.8) => { const s = nightGlow(color, size, k); s.position.set(x, y, z); b.extra(s); };
export const done = (b, top) => { const g = b.finish(); g.userData.top = top; return g; };

// Many small parts as one geometry (what moves as one: a ring of horses).
export function mergeAll(list) {
  // (positions, normals and uvs, as the builder's parts are merged)
  const geos = list.map((g) => { if (!g.index) return g; const q = g.toNonIndexed(); g.dispose(); return q; });
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

// A head: the city's namesake (the fountain's, the bust's).
export function headGeo() {
  // a unit sphere pushed into a head: the face toward +z
  const g = new THREE.SphereGeometry(1, 56, 40), p = g.attributes.position, v = new THREE.Vector3();
  const bump = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const { x, y, z } = v, front = Math.max(0, z), f2 = front * front;
    let r = 1;
    r += 0.2 * bump(x, y, 0, -0.08, 0.15, 0.24) * front ** 4; // the nose
    r += 0.06 * bump(x, y, 0, 0.26, 0.6, 0.08) * f2; // the brow
    r -= 0.075 * (bump(x, y, -0.33, 0.1, 0.15, 0.1) + bump(x, y, 0.33, 0.1, 0.15, 0.1)) * f2; // the eyes
    r += 0.035 * bump(x, y, 0, -0.42, 0.2, 0.05) * f2; // the lips
    r += 0.05 * bump(x, y, 0, -0.66, 0.24, 0.1) * f2; // the chin
    r += 0.07 * Math.exp(-((y / 0.16) ** 2) - (((z + 0.08) / 0.18) ** 2)) * Math.abs(x) ** 6; // the ears
    let sx = 0.8, sz = 0.92;
    if (y < 0) sx *= 1 - 0.3 * Math.min(1, -y) * (0.45 + 0.55 * front); // the jaw, narrower
    if (z < 0) sz *= 1.06; // the back of the head, fuller
    p.setXYZ(i, x * sx * r, y * r, z * sz * r);
  }
  g.computeVertexNormals();
  return g;
}

/* Clock faces that tell the hour the city's at (the time of day picked). */
export const CLOCKS = new Set();
export function drawClock(c, clock) {
  const x = c.getContext("2d"), s = c.width, m = /(\d+):(\d+)/.exec(clock) || [0, 12, 0], H = +m[1] % 12, M = +m[2];
  x.fillStyle = "#2f3b47"; x.fillRect(0, 0, s, s);
  x.beginPath(); x.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); x.fillStyle = "#f7f5ee"; x.fill();
  x.strokeStyle = "#2f3b47"; x.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.lineWidth = i % 3 ? s * 0.018 : s * 0.034; x.beginPath(); x.moveTo(s / 2 + Math.sin(a) * s * 0.36, s / 2 - Math.cos(a) * s * 0.36); x.lineTo(s / 2 + Math.sin(a) * s * 0.41, s / 2 - Math.cos(a) * s * 0.41); x.stroke(); }
  const hand = (a, len, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.sin(a) * len, s / 2 - Math.cos(a) * len); x.stroke(); };
  hand(((H + M / 60) / 12) * Math.PI * 2, s * 0.22, s * 0.05);
  hand((M / 60) * Math.PI * 2, s * 0.33, s * 0.03);
  x.fillStyle = "#2f3b47"; x.beginPath(); x.arc(s / 2, s / 2, s * 0.035, 0, Math.PI * 2); x.fill();
}
onTimeChange((id) => CLOCKS.forEach(({ c, t }) => { drawClock(c, timeOf(id).clock); t.needsUpdate = true; }));
// A face for a clock: its canvas drawn for the hour now, and again when
// the hour's changed.
export function clockFace(px = 128) {
  const c = cv(px, px), t = tex(c);
  drawClock(c, timeOf(timeId()).clock); CLOCKS.add({ c, t });
  return t;
}
