/* Parrish's world: a marble court at the golden hour, after Maxfield
   Parrish.

   The board stands on a marble plinth in the middle of a long, still
   reflecting pool (the pool holds the sky: the cobalt, the lit clouds,
   the columns, the pieces themselves), in a paved court. Colonnades
   under a plain entablature run down both long sides, and the two ends
   are open: a balustrade, and beyond it the view, so each player looks
   down the pool between the columns, as in Parrish's "Daybreak". Urns
   of flowers at the pool's corners; tall cypresses and great oaks rising
   from the slope below the balustrade. Beyond: a valley with a lake,
   ranges of blue mountains with the sun on their snow, towering cumulus
   lit gold and peach, and over it all Parrish's deep blue.

   A painter's liberty: the painted horizon lies well below eye level, so
   from where a player sits the sky, the mountains and the clouds rise
   straight above the balustrade (from where the camera is, the real one
   would be out of the picture above the board).

   All of it hangs off the chassis's boardGroup, so it turns with the
   board (walking round it), and the sun with it: the chassis's lights
   are moved each frame to where the painted sun is, so the shadows fall
   the way the light comes. It is rebuilt if the board changes size.

   The frame is drawn through parrish-paint.js (the chassis's render
   hook): the pool's reflection first, then the scene, then the paint. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_THICKNESS } from "../engine/constants.js";
import { createPainter } from "./parrish-paint.js";

/* ------------------------------------------------------------ the light */

// The painted horizon's drop below eye level (radians), and the sun in
// the painted sky's own terms (low over its horizon, east-southeast of
// the board: off the players' right hand at the start, so the clouds
// ahead are lit from the side). The key light comes from the same side,
// higher, so the shadows on the board stay short and readable.
const DROP = 0.27;
export const SUN_DIR = new THREE.Vector3(0.84, 0.16, 0.52).normalize();
const KEY_DIR = new THREE.Vector3(0.84, 0.62, 0.42).normalize();
const FILL_DIR = new THREE.Vector3(-0.6, 0.4, 0.7).normalize();
const BACK_DIR = new THREE.Vector3(-0.45, 0.35, -0.82).normalize();

/* ------------------------------------------------------------ small helpers */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function noise2(seed) {
  const p = new Uint8Array(512);
  const r = rng(seed);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const fade = (t) => t * t * (3 - 2 * t);
  const h = (x, y) => p[p[x & 255] + (y & 255)] / 255;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/* ------------------------------------------------------------ marble */

/* Warm white marble: a soft cloudy ground and a few long grey-gold
   veins (the sine of a turbulence, the classic way). */
let MARBLE = null;
function marbleTexture() {
  if (MARBLE) return MARBLE;
  const S = 512;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  const img = g.createImageData(S, S);
  const n = noise2(41);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let turb = 0, amp = 1, f = 3;
    for (let o = 0; o < 4; o++) { turb += amp * n(u * f * 2.2, v * f * 2.2); amp *= 0.5; f *= 2; }
    const vein = Math.pow(Math.abs(Math.sin((u * 2.6 + v * 1.1 + turb * 1.8) * Math.PI)), 0.18);
    const cloud = n(u * 5, v * 5) * 0.5 + n(u * 13, v * 13) * 0.25;
    const k = 0.9 + cloud * 0.14;
    const i = (y * S + x) * 4;
    // Ivory, warmed; the veins a soft grey with a little gold.
    img.data[i] = (238 * k) * vein + 168 * (1 - vein);
    img.data[i + 1] = (228 * k) * vein + 156 * (1 - vein);
    img.data[i + 2] = (206 * k) * vein + 134 * (1 - vein);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  MARBLE = new THREE.CanvasTexture(c);
  MARBLE.wrapS = MARBLE.wrapT = THREE.RepeatWrapping;
  return MARBLE;
}

/* The court's paving: large slabs in a few warm tones, fine joints. */
let PAVING = null;
function pavingTexture() {
  if (PAVING) return PAVING;
  const S = 1024, N = 4;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  const r = rng(7), n = noise2(19);
  const tile = S / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const tone = 0.9 + r() * 0.12;
    g.fillStyle = `rgb(${Math.round(232 * tone)},${Math.round(212 * tone)},${Math.round(180 * tone)})`;
    g.fillRect(i * tile, j * tile, tile, tile);
  }
  const img = g.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = 0.92 + n(x / 60, y / 60) * 0.1 + n(x / 9, y / 9) * 0.04;
    const i = (y * S + x) * 4;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "rgba(120,96,70,0.55)"; g.lineWidth = 3;
  for (let k = 0; k <= N; k++) { g.beginPath(); g.moveTo(k * tile, 0); g.lineTo(k * tile, S); g.stroke(); g.beginPath(); g.moveTo(0, k * tile); g.lineTo(S, k * tile); g.stroke(); }
  PAVING = new THREE.CanvasTexture(c);
  PAVING.wrapS = PAVING.wrapT = THREE.RepeatWrapping;
  return PAVING;
}

/* What the lacquer, the brass and the marble reflect: the golden hour
   round the court, painted (a cobalt sky, the gold low down where the
   sun is, the pale stone below). */
let ENV = null;
export function parrishEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#16307A");
  grad.addColorStop(0.3, "#3A6CC8");
  grad.addColorStop(0.47, "#A9CDE4");
  grad.addColorStop(0.5, "#F2D7A6");
  grad.addColorStop(0.53, "#C9B48F");
  grad.addColorStop(0.75, "#B49C78");
  grad.addColorStop(1, "#5E5040");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, col) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  // The sun's side, and lit clouds round the horizon.
  const sunU = (Math.atan2(SUN_DIR.x, -SUN_DIR.z) / (Math.PI * 2) + 0.5) * W;
  blob(sunU, H * 0.46, 150, 70, "rgba(255,214,150,0.95)");
  [[0.1, 0.4], [0.3, 0.38], [0.52, 0.41], [0.7, 0.37], [0.88, 0.4]].forEach(([u, v]) => blob(u * W, v * H, 70, 38, "rgba(255,236,214,0.7)"));
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ the sky */

const NOISE_GLSL = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(11.3, 7.7); a *= 0.5; } return s; }
// Noise round the horizon that meets itself all the way round.
float ringN(float az, float k, vec2 o) { return fbm(vec2(cos(az), sin(az)) * k + o); }
`;

/* The dome: the sky, the clouds, the mountains, the valley, drawn in the
   painted sky's own terms (its horizon uDrop below eye level). Colours
   are given as they're to be seen (the dome isn't tone mapped). */
const SKY_VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
precision highp float;
uniform vec3 uSun;
uniform float uTime;
uniform float uDrop;
varying vec3 vDir;
${NOISE_GLSL}
vec3 skyGrad(float el, float sunDot) {
  float e = clamp(el / 1.25, 0.0, 1.0);
  vec3 zen = vec3(0.07, 0.19, 0.5), mid = vec3(0.15, 0.37, 0.76), hor = vec3(0.6, 0.78, 0.88);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, e));
  c = mix(c, zen, smoothstep(0.22, 0.85, e));
  c = mix(c, vec3(1.0, 0.8, 0.52), pow(sunDot, 5.0) * (1.0 - smoothstep(0.0, 0.45, e)) * 0.8);
  return c;
}
void main() {
  vec3 d0 = normalize(vDir);
  float az = atan(d0.x, -d0.z);
  float el = asin(clamp(d0.y, -1.0, 1.0)) + uDrop;
  vec3 d = vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
  vec3 sunD = normalize(uSun);
  float sunDot = max(dot(d, sunD), 0.0);
  float sunAz = atan(sunD.x, -sunD.z);
  float facing = cos(az - sunAz);
  vec3 col = skyGrad(el, sunDot);
  col += vec3(1.0, 0.86, 0.62) * (pow(sunDot, 900.0) * 4.0 + pow(sunDot, 60.0) * 0.35);
  // High cirrus, gold toward the sun.
  if (el > 0.02) {
    vec2 p = d.xz / (d.y + 0.12) * 1.2;
    float ci = fbm(p * vec2(0.8, 2.6) + vec2(uTime * 0.004, 0.0));
    float cir = smoothstep(0.56, 0.82, ci) * smoothstep(0.02, 0.2, el) * (1.0 - smoothstep(0.7, 1.3, el));
    col = mix(col, mix(vec3(1.0, 0.93, 0.86), vec3(1.0, 0.7, 0.52), pow(sunDot, 1.5)), cir * 0.45);
  }
  // Towering cumulus along the horizon: tops lit cream and peach where
  // the sun falls on them, lavender in their own shadow, the ones toward
  // the sun dark with a gold edge.
  float H = 0.05 + 0.6 * pow(smoothstep(0.42, 0.85, ringN(az, 1.6, vec2(3.1, 1.7))), 1.3);
  float puff = fbm(vec2(az * 9.0, el * 11.0) + vec2(uTime * 0.003, 0.0));
  float puff2 = fbm(vec2(az * 23.0, el * 25.0) + 5.0);
  float top = H + (puff - 0.5) * 0.13 + (puff2 - 0.5) * 0.045;
  float cloud = smoothstep(0.0, 0.02, top - el) * smoothstep(-0.03, 0.02, el);
  float lit = clamp(0.5 + (puff - fbm(vec2(az * 9.0 - 0.18 * sign(sin(az - sunAz)), el * 11.0 - 0.1))) * 3.2 + 0.3 * smoothstep(-0.14, 0.0, el - top), 0.0, 1.0);
  vec3 front = mix(vec3(0.86, 0.66, 0.6), vec3(1.0, 0.93, 0.8), lit);
  vec3 back = mix(vec3(0.38, 0.39, 0.6), vec3(0.72, 0.58, 0.62), lit);
  vec3 cc = mix(front, back, smoothstep(-0.3, 0.85, facing));
  float rim = smoothstep(0.0, 0.012, top - el) * (1.0 - smoothstep(0.012, 0.04, top - el));
  cc += vec3(1.0, 0.74, 0.34) * rim * pow(max(facing, 0.0), 2.0) * 0.9;
  col = mix(col, cc, cloud);
  // The far range: blue-violet, its snow lit gold where it faces away
  // from the sun (the alpenglow), its feet lost in the haze.
  vec3 hz = vec3(0.6, 0.74, 0.86);
  float m1 = 0.018 + 0.1 * pow(ringN(az, 3.4, vec2(9.0, 2.0)), 1.5) + 0.03 * (1.0 - abs(2.0 * ringN(az, 7.0, vec2(1.0, 8.0)) - 1.0));
  if (el < m1) {
    float snow = smoothstep(m1 - 0.022, m1 - 0.004, el) * smoothstep(0.06, 0.1, m1);
    vec3 mc = mix(vec3(0.36, 0.4, 0.68), vec3(0.42, 0.45, 0.72), smoothstep(m1 - 0.06, m1, el));
    mc = mix(mc, vec3(0.86, 0.6, 0.58), 0.3 * max(-facing, 0.0));
    mc = mix(mc, vec3(1.0, 0.87, 0.72), snow * 0.85);
    mc = mix(mc, hz, 0.5 * (1.0 - smoothstep(-0.02, m1 * 0.7, el)));
    col = mc;
  }
  // A nearer range, darker, its ridge caught by the sun.
  float m2 = 0.004 + 0.05 * pow(ringN(az, 5.0, vec2(4.0, 6.0)), 1.3);
  if (el < m2) {
    vec3 mc = vec3(0.17, 0.25, 0.47);
    mc = mix(mc, vec3(0.95, 0.66, 0.4), smoothstep(m2 - 0.008, m2, el) * pow(max(facing, 0.0), 1.5) * 0.7);
    mc = mix(mc, hz * 0.85, 0.35 * (1.0 - smoothstep(-0.03, m2, el)));
    col = mc;
  }
  // The near hills, wooded.
  float m3 = -0.012 + 0.03 * ringN(az, 8.0, vec2(2.0, 3.0));
  if (el < m3) {
    vec3 mc = mix(vec3(0.09, 0.17, 0.19), vec3(0.15, 0.24, 0.2), fbm(vec2(az * 40.0, el * 60.0)));
    mc = mix(mc, vec3(0.7, 0.55, 0.3), smoothstep(m3 - 0.006, m3, el) * max(facing, 0.0) * 0.6);
    col = mc;
  }
  // The valley below: a lake holding the sky, woods, haze toward the far side.
  if (el < -0.012) {
    float lakeBand = smoothstep(-0.14, -0.06, el) * (1.0 - smoothstep(-0.03, -0.015, el));
    float lake = lakeBand * smoothstep(0.42, 0.6, ringN(az, 2.2, vec2(5.0, 5.0)));
    vec3 woods = mix(vec3(0.06, 0.12, 0.11), vec3(0.11, 0.2, 0.16), fbm(vec2(az * 30.0, el * 30.0)));
    woods = mix(woods, hz * 0.8, 0.55 * smoothstep(-0.3, -0.02, el));
    vec3 water = skyGrad(-el * 3.0, sunDot) * 0.8 + vec3(1.0, 0.8, 0.5) * pow(sunDot, 40.0) * 0.4;
    col = mix(woods, water, lake);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------ the pool */

const WATER_VERT = `
uniform mat4 uTexMatrix;
varying vec4 vRefl;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vRefl = uTexMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = `
precision highp float;
uniform sampler2D tRefl;
uniform float uTime;
varying vec4 vRefl;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec2 p = vWorld.xz * 0.45;
  vec2 rip = vec2(vnoise(p + uTime * 0.05) - 0.5, vnoise(p * 1.3 - uTime * 0.04 + 9.0) - 0.5);
  vec4 uv = vRefl;
  uv.xy += rip * 0.03 * uv.w;
  vec3 refl = texture2DProj(tRefl, uv).rgb;
  vec3 V = normalize(cameraPosition - vWorld);
  // Dark, still water: the reflection strongest where it's seen low.
  float fres = 0.36 + 0.64 * pow(1.0 - max(V.y, 0.0), 2.2);
  vec3 deep = vec3(0.04, 0.1, 0.13);
  vec3 col = mix(deep, refl * 0.9, fres);
  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------ the architecture */

function marbleMat(tint = 0xffffff, repeat = 1) {
  let map = marbleTexture();
  if (repeat !== 1) { map = map.clone(); map.needsUpdate = true; map.repeat.set(repeat, repeat); }
  return new THREE.MeshStandardMaterial({ color: tint, map, roughness: 0.62, metalness: 0, envMap: parrishEnv(), envMapIntensity: 0.25 });
}

/* A column: a fluted shaft with a little entasis, a moulded base, a
   Doric-like capital. Height h, lower radius r. */
function buildColumn(h, r, mat) {
  const g = new THREE.Group();
  const shaftH = h * 0.84;
  const shaft = new THREE.CylinderGeometry(r * 0.84, r, shaftH, 40, 10, false);
  const pos = shaft.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const rad = Math.hypot(x, z);
    if (rad < 1e-4) continue;
    const a = Math.atan2(z, x);
    const ent = 1 + 0.035 * Math.sin(Math.PI * (y / shaftH + 0.5));
    const flute = 1 - 0.045 * (0.5 - 0.5 * Math.cos(a * 20));
    pos.setX(i, x * ent * flute); pos.setZ(i, z * ent * flute);
  }
  shaft.computeVertexNormals();
  const sm = new THREE.Mesh(shaft, mat);
  sm.position.y = h * 0.07 + shaftH / 2;
  sm.castShadow = true;
  g.add(sm);
  const base = new THREE.LatheGeometry([
    new THREE.Vector2(r * 1.35, 0), new THREE.Vector2(r * 1.35, h * 0.025), new THREE.Vector2(r * 1.22, h * 0.03),
    new THREE.Vector2(r * 1.24, h * 0.045), new THREE.Vector2(r * 1.08, h * 0.06), new THREE.Vector2(r * 1.02, h * 0.07),
  ], 40);
  g.add(new THREE.Mesh(base, mat));
  const cap = new THREE.LatheGeometry([
    new THREE.Vector2(r * 0.86, 0), new THREE.Vector2(r * 0.92, h * 0.012), new THREE.Vector2(r * 1.18, h * 0.045),
    new THREE.Vector2(r * 1.24, h * 0.06),
  ], 40);
  const cm = new THREE.Mesh(cap, mat);
  cm.position.y = h * 0.07 + shaftH;
  g.add(cm);
  const abacus = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, h * 0.035, r * 2.6), mat);
  abacus.position.y = h * 0.07 + shaftH + h * 0.06 + h * 0.0175;
  g.add(abacus);
  return g;
}

/* An urn on a pedestal, overflowing with leaves and flowers. */
function buildUrn(mat, leafMat, flowerMats, r) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), mat);
  ped.position.y = 1.1;
  g.add(ped);
  const capb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), mat);
  capb.position.y = 2.3;
  g.add(capb);
  const prof = [[0, 0], [0.62, 0], [0.62, 0.14], [0.36, 0.24], [0.3, 0.5], [0.7, 0.82], [0.88, 1.15], [0.8, 1.4], [0.58, 1.52], [0.68, 1.62], [0.64, 1.7], [0.0, 1.7]];
  const urn = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * 1.25, y * 1.25)), 32), mat);
  urn.position.y = 2.42;
  g.add(urn);
  const top = 2.42 + 1.7 * 1.25;
  const leaf = new THREE.IcosahedronGeometry(0.55, 1);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, rr = r() * 0.95;
    const m = new THREE.Mesh(leaf, leafMat);
    m.position.set(Math.cos(a) * rr, top + 0.2 + r() * 0.9 - rr * 0.35, Math.sin(a) * rr);
    m.scale.setScalar(0.7 + r() * 0.7);
    g.add(m);
  }
  const fl = new THREE.IcosahedronGeometry(0.2, 0);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, rr = 0.4 + r() * 0.8;
    const m = new THREE.Mesh(fl, flowerMats[i % flowerMats.length]);
    m.position.set(Math.cos(a) * rr, top + 0.6 + r() * 0.9, Math.sin(a) * rr);
    g.add(m);
  }
  return g;
}

/* A tree: a trunk and a crown of leaf clusters (a broad oak, or a tall
   cypress). */
function buildTree(kind, scale, leafMat, barkMat, r) {
  const g = new THREE.Group();
  const H = (kind === "cypress" ? 26 : 20) * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.9 * scale, H * 0.55, 8), barkMat);
  trunk.position.y = H * 0.27;
  g.add(trunk);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const n = kind === "cypress" ? 22 : 34;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(blob, leafMat);
    if (kind === "cypress") {
      const y = H * (0.18 + 0.8 * (i / n));
      const w = 2.2 * scale * Math.sin(Math.PI * Math.min(1, (i + 2) / n)) + 0.5 * scale;
      m.position.set((r() - 0.5) * w * 0.5, y, (r() - 0.5) * w * 0.5);
      m.scale.set(w, 2.4 * scale, w);
    } else {
      const a = r() * Math.PI * 2, rr = r() * 6 * scale, y = H * (0.55 + r() * 0.4);
      m.position.set(Math.cos(a) * rr, y - rr * 0.25, Math.sin(a) * rr * 0.8);
      m.scale.setScalar((2.6 + r() * 2) * scale);
    }
    g.add(m);
  }
  return g;
}

/* The whole court, sized to the board. Returns { group, water, waterMat,
   fades, dispose }; `fades` are the things that step aside when they'd
   stand between the camera and the board. */
function buildTerrace(sky) {
  const group = new THREE.Group();
  group.name = "parrish-terrace";
  const geos = new Set(), mats = new Set();
  const keep = (o) => { o.traverse((m) => { if (m.geometry) geos.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x)); }); return o; };
  const r = rng(1975);
  const hx = SLAB_X / 2, hz = SLAB_Z / 2;
  const WATER_Y = -2.2;
  const FLOOR_Y = WATER_Y + 0.55;   // the paving
  const PX = hx + 5.5, PZ = hz + 8.5; // the pool's half sizes
  const RIM = 1.3;                  // its kerb
  const CX = PX + RIM + 5.5;        // the colonnades, at x = ±CX
  const CZ = PZ + RIM + 1.5;        // running from z = -CZ to CZ
  const TX = CX + 6, TZ = CZ + 6.5; // the court's edge
  const COL_H = 15;

  const marble = marbleMat(0xffffff, 1);
  const marbleWarm = marbleMat(0xf3e2c6, 2);
  mats.add(marble); mats.add(marbleWarm);
  const box = (w, h, d, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = shadow;
    group.add(m);
    return m;
  };

  // The plinth the board stands on, rising from the pool.
  const pw = SLAB_X + 0.9, pd = SLAB_Z + 0.9;
  const plinthH = -SLAB_THICKNESS - WATER_Y + 0.6;
  box(pw, plinthH, pd, marble, 0, -SLAB_THICKNESS - 0.32 - plinthH / 2, 0);
  box(pw + 0.5, 0.32, pd + 0.5, marble, 0, -SLAB_THICKNESS - 0.16, 0);
  box(pw + 0.7, 0.5, pd + 0.7, marble, 0, WATER_Y + 0.1, 0, false);

  // The water, with the reflection's matrix and texture filled in each frame.
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { tRefl: { value: null }, uTexMatrix: { value: new THREE.Matrix4() }, uTime: { value: 0 } },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
  });
  mats.add(waterMat);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PX * 2, PZ * 2), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.name = "parrish-pool";
  group.add(water);

  // The kerb round the pool, with a coping on top.
  const kerbH = FLOOR_Y + 0.4 - (WATER_Y - 0.4), kerbY = (FLOOR_Y + 0.4 + WATER_Y - 0.4) / 2;
  [[0, PZ + RIM / 2, PX * 2 + RIM * 2, RIM], [0, -PZ - RIM / 2, PX * 2 + RIM * 2, RIM], [PX + RIM / 2, 0, RIM, PZ * 2], [-PX - RIM / 2, 0, RIM, PZ * 2]].forEach(([x, z, w, d]) => {
    box(w, kerbH, d, marble, x, kerbY, z);
    box(w + 0.2, 0.14, d + 0.2, marble, x, FLOOR_Y + 0.47, z);
  });

  // The paving, from the kerb out to the edge (a slab with the pool cut out).
  const outline = new THREE.Shape([new THREE.Vector2(-TX, -TZ), new THREE.Vector2(TX, -TZ), new THREE.Vector2(TX, TZ), new THREE.Vector2(-TX, TZ)]);
  const hp = PX + RIM - 0.05, hq = PZ + RIM - 0.05;
  outline.holes.push(new THREE.Path([new THREE.Vector2(-hp, -hq), new THREE.Vector2(-hp, hq), new THREE.Vector2(hp, hq), new THREE.Vector2(hp, -hq)]));
  const floorGeo = new THREE.ShapeGeometry(outline);
  const fp = floorGeo.attributes.position, fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / 9, fp.getY(i) / 9);
  const floorMat = new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.75, metalness: 0, envMap: parrishEnv(), envMapIntensity: 0.15 });
  mats.add(floorMat);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  group.add(floor);

  // The walls the court stands on, warm stone going down into the haze
  // (walls only: a block would cover the pool).
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x9a826a, roughness: 0.95, metalness: 0 });
  mats.add(cliffMat);
  [[0, TZ - 0.5, TX * 2, 1], [0, -TZ + 0.5, TX * 2, 1], [TX - 0.5, 0, 1, TZ * 2], [-TX + 0.5, 0, 1, TZ * 2]].forEach(([x, z, w, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 46, d), cliffMat);
    wall.position.set(x, FLOOR_Y - 23.05, z);
    group.add(wall);
  });

  // The balustrade round the edge: balusters between piers, a rail, a sill.
  const balProf = [[0, 0], [0.32, 0], [0.32, 0.1], [0.18, 0.18], [0.16, 0.35], [0.3, 0.62], [0.33, 0.78], [0.16, 1.02], [0.14, 1.12], [0.26, 1.2], [0.26, 1.3], [0, 1.3]];
  const balGeo = new THREE.LatheGeometry(balProf.map(([x, y]) => new THREE.Vector2(x, y)), 10);
  geos.add(balGeo);
  const BX = TX - 0.7, BZ = TZ - 0.7;
  const spots = [];
  const side = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.0);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      // Every eighth a pier instead.
      if (i % 8 === 0) { box(1.0, 2.0, 1.0, marbleWarm, x0 + (x1 - x0) * u, FLOOR_Y + 1.0, z0 + (z1 - z0) * u); continue; }
      spots.push([x0 + (x1 - x0) * u, z0 + (z1 - z0) * u]);
    }
  };
  side(-BX, -BZ, BX, -BZ); side(BX, -BZ, BX, BZ); side(BX, BZ, -BX, BZ); side(-BX, BZ, -BX, -BZ);
  const bal = new THREE.InstancedMesh(balGeo, marbleWarm, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { m4.makeTranslation(x, FLOOR_Y + 0.3, z); bal.setMatrixAt(i, m4); });
  group.add(bal);
  [[-BX, BX, -BZ, -BZ], [-BX, BX, BZ, BZ], [-BX, -BX, -BZ, BZ], [BX, BX, -BZ, BZ]].forEach(([x0, x1, z0, z1]) => {
    const w = Math.max(0.8, Math.abs(x1 - x0) + 0.8), d = Math.max(0.8, Math.abs(z1 - z0) + 0.8);
    box(w, 0.3, d, marbleWarm, (x0 + x1) / 2, FLOOR_Y + 0.15, (z0 + z1) / 2);
    box(w, 0.24, d, marbleWarm, (x0 + x1) / 2, FLOOR_Y + 1.72, (z0 + z1) / 2);
  });
  [[-BX, -BZ], [BX, -BZ], [BX, BZ], [-BX, BZ]].forEach(([x, z]) => box(1.2, 2.2, 1.2, marbleWarm, x, FLOOR_Y + 1.1, z));

  // The colonnades down both long sides, each bay (a column and its
  // stretch of entablature) stepping aside on its own when it would
  // stand between the camera and the board.
  const fades = [];
  const NB = Math.max(5, Math.round((CZ * 2) / 4.8) + 1);
  const bay = (CZ * 2) / (NB - 1);
  [-1, 1].forEach((sx) => {
    // The stylobate the columns stand on.
    box(3.4, 0.35, CZ * 2 + 3.4, marbleWarm, sx * CX, FLOOR_Y + 0.17, 0);
    for (let k = 0; k < NB; k++) {
      const z = -CZ + k * bay;
      const mat = marbleMat(0xffffff, 1);
      mats.add(mat);
      const g = new THREE.Group();
      const col = buildColumn(COL_H, 0.95, mat);
      col.position.y = 0.35;
      g.add(col);
      // Its stretch of the entablature: architrave, frieze, cornice.
      const len = bay + (k === 0 || k === NB - 1 ? 1.7 : 0);
      const off = k === 0 ? -0.85 : k === NB - 1 ? 0.85 : 0;
      const ent = (w, h, d, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(0, y, off); g.add(m); };
      ent(2.3, 1.0, len, COL_H + 0.35 + 0.5);
      ent(2.1, 1.1, len, COL_H + 0.35 + 1.55);
      ent(2.9, 0.45, len + 0.1, COL_H + 0.35 + 2.33);
      g.position.set(sx * CX, FLOOR_Y, z);
      group.add(g);
      fades.push({ obj: g, mats: [mat], x: sx * CX, z, rad: 1.6, op: 1 });
    }
  });

  // Urns at the pool's corners.
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x35532f, roughness: 0.9, flatShading: true });
  const flowerMats = [0xe98a72, 0xf3c25d, 0xf2e7d4, 0xd96a8a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  mats.add(leafMat); flowerMats.forEach((m) => mats.add(m));
  const ux = PX + RIM + 2.2, uz = PZ + RIM + 2.2;
  [[ux, uz], [-ux, uz], [ux, -uz], [-ux, -uz]].forEach(([x, z]) => {
    const u = buildUrn(marble, leafMat, flowerMats, r);
    u.position.set(x, FLOOR_Y, z);
    group.add(u);
  });

  // Trees on the slope below the edge, their crowns over the balustrade:
  // cypresses flanking the view at each open end, oaks behind the
  // colonnades. Each its own leaves, to step aside on its own.
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 });
  mats.add(barkMat);
  const trees = [
    ["cypress", 1.0, TX - 3.5, -(TZ + 4)], ["cypress", 0.85, TX - 7.5, -(TZ + 6)], ["cypress", 0.95, -(TX - 4), -(TZ + 4.5)],
    ["cypress", 1.05, TX - 4, TZ + 4.5], ["cypress", 0.9, -(TX - 3.5), TZ + 4], ["cypress", 0.8, -(TX - 8), TZ + 6.5],
    ["oak", 1.2, TX + 6, -TZ * 0.4], ["oak", 1.05, TX + 7, TZ * 0.45], ["oak", 1.15, -(TX + 6.5), TZ * 0.1], ["oak", 0.95, -(TX + 6), -TZ * 0.7],
  ];
  trees.forEach(([kind, s, x, z]) => {
    const leaf = new THREE.MeshStandardMaterial({ color: kind === "cypress" ? 0x24402a : 0x2c4728, roughness: 0.92, flatShading: true });
    mats.add(leaf);
    const t = buildTree(kind, s, leaf, barkMat, r);
    t.position.set(x, FLOOR_Y - 12, z);
    group.add(t);
    fades.push({ obj: t, mats: [leaf], x, z, rad: kind === "cypress" ? 3 : 7, op: 1 });
  });

  // The dome.
  group.add(sky);
  keep(group);
  geos.delete(sky.geometry); mats.delete(sky.material);
  return {
    group, water, waterMat, fades, WATER_Y,
    dispose() { group.remove(sky); geos.forEach((g) => g.dispose()); mats.forEach((m) => { if (m.map && m.map !== marbleTexture() && m.map !== pavingTexture()) m.map.dispose(); m.dispose(); }); },
  };
}

/* ------------------------------------------------------------ the effects */

const RAW = (() => { try { return new URLSearchParams(window.location.search).get("paint") === "raw"; } catch (e) { return false; } })();

export function createParrishEffects(woodSet, { quality }) {
  return function mountAmbientEffects(refs, { three }) {
    let attachedTo = null, terrace = null, brass = null, dims = "";
    let painter = null;
    let farBefore = null;
    const keyBase = { key: null, fill: null, back: null };

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 64, 32),
      new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uDrop: { value: DROP } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    sky.name = "parrish-sky";

    // The pool's reflection: a camera mirrored in the water's plane.
    const reflRT = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    const mirrorCam = new THREE.PerspectiveCamera();
    const plane = new THREE.Plane(), clip = new THREE.Vector4(), qv = new THREE.Vector4();
    const nrm = new THREE.Vector3(), mirrorPt = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), tgt = new THREE.Vector3(), rotM = new THREE.Matrix4();
    const texM = new THREE.Matrix4(), bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    const rsize = new THREE.Vector2();

    function reflect(r, camera) {
      if (!terrace) return;
      const water = terrace.water;
      r.getDrawingBufferSize(rsize);
      const w = Math.max(2, Math.round(rsize.x * 0.32)), h = Math.max(2, Math.round(rsize.y * 0.32));
      if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
      water.updateMatrixWorld();
      mirrorPt.setFromMatrixPosition(water.matrixWorld);
      nrm.set(0, 1, 0);
      camPos.setFromMatrixPosition(camera.matrixWorld);
      look.subVectors(mirrorPt, camPos);
      if (look.dot(nrm) > 0) return; // under the water: nothing to see
      look.reflect(nrm).negate().add(mirrorPt);
      rotM.extractRotation(camera.matrixWorld);
      tgt.set(0, 0, -1).applyMatrix4(rotM).add(camPos);
      tgt.subVectors(mirrorPt, tgt).reflect(nrm).negate().add(mirrorPt);
      mirrorCam.position.copy(look);
      mirrorCam.up.set(0, 1, 0).applyMatrix4(rotM).reflect(nrm);
      mirrorCam.lookAt(tgt);
      mirrorCam.far = camera.far; mirrorCam.near = camera.near;
      mirrorCam.updateMatrixWorld();
      mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
      texM.copy(bias).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse).multiply(water.matrixWorld);
      // Only what's above the water: the near plane tilted onto it.
      plane.setFromNormalAndCoplanarPoint(nrm, mirrorPt).applyMatrix4(mirrorCam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const P = mirrorCam.projectionMatrix.elements;
      qv.x = (Math.sign(clip.x) + P[8]) / P[0];
      qv.y = (Math.sign(clip.y) + P[9]) / P[5];
      qv.z = -1;
      qv.w = (1 + P[10]) / P[14];
      clip.multiplyScalar(2 / clip.dot(qv));
      P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1 - 0.003; P[14] = clip.w;
      terrace.waterMat.uniforms.uTexMatrix.value.copy(texM);
      terrace.waterMat.uniforms.tRefl.value = reflRT.texture;
      const scene = three.current.scene;
      water.visible = false;
      const autoShadow = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(reflRT);
      r.clear();
      r.render(scene, mirrorCam);
      r.shadowMap.autoUpdate = autoShadow;
      water.visible = true;
    }

    function build() {
      const t = three.current;
      if (terrace) { if (terrace.group.parent) terrace.group.parent.remove(terrace.group); terrace.dispose(); terrace = null; }
      if (brass) { if (brass.group.parent) brass.group.parent.remove(brass.group); brass.dispose(); brass = null; }
      terrace = buildTerrace(sky);
      brass = woodSet.buildBrass();
      t.boardGroup.add(terrace.group, brass.group);
      dims = `${SLAB_X}x${SLAB_Z}`;
    }

    /* The pixel ratio. A painting needs no more than about one pixel to
       the screen's point (the strokes are wider than any pixel), and every
       pixel costs three passes: capped by the device's tier, and lowered a
       step when the frames run slow, raised again when there's room (as
       the den does, den-fx.js govern). */
    const q = quality();
    const PR = q.tier === "low" ? { cap: 1, floor: 0.7 } : q.tier === "mid" ? { cap: 1.25, floor: 0.85 } : { cap: 1.5, floor: 1 };
    let pr = 1, prBefore = null;
    const frameTimes = [];
    let lastFrameAt = 0, lastJudged = 0, lastRaise = 0, settleUntil = 0;
    function setPixelRatio(v) {
      const t = three.current;
      if (!t || !t.renderer) return;
      pr = Math.max(PR.floor, Math.min(v, PR.cap, window.devicePixelRatio || 1));
      t.renderer.setPixelRatio(pr);
      const sz = t.getMountSize && t.getMountSize();
      if (sz) t.renderer.setSize(sz.w, sz.h);
      settleUntil = performance.now() + 1500;
      frameTimes.length = 0;
      if (typeof window !== "undefined") window.__PARRISH_PIXEL_RATIO__ = pr;
    }
    function govern(now) {
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      if (document.hidden || now < settleUntil || dt <= 0 || dt > 250) return;
      frameTimes.push(dt);
      if (frameTimes.length > 120) frameTimes.shift();
      if (now - lastJudged < 2000 || frameTimes.length < 60) return;
      lastJudged = now;
      const sorted = frameTimes.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const slow = sorted[Math.floor(sorted.length * 0.9)];
      if (median > 1000 / 42 && pr > PR.floor + 0.01) setPixelRatio(pr - 0.15);
      else if (slow < 1000 / 56 && pr < Math.min(PR.cap, window.devicePixelRatio || 1) - 0.01 && now - lastRaise > 8000) { lastRaise = now; setPixelRatio(pr + 0.1); }
    }

    function attach() {
      const t = three.current;
      if (!t || !t.boardGroup || !t.renderer) return false;
      if (attachedTo !== t.boardGroup) {
        attachedTo = t.boardGroup;
        dims = "";
        if (prBefore == null) { prBefore = t.renderer.getPixelRatio(); setPixelRatio(Math.min(window.devicePixelRatio || 1, PR.cap)); }
        if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__PARRISH_THREE__ = t; // tests: read the scene
      }
      if (dims !== `${SLAB_X}x${SLAB_Z}`) build();
      // The slab's box outline would draw over the plinth's top.
      const edges = t.boardGroup.getObjectByName("ec-slab-edges");
      if (edges) edges.visible = false;
      if (t.camera && farBefore == null) { farBefore = t.camera.far; t.camera.far = 2400; t.camera.updateProjectionMatrix(); }
      if (!painter) painter = createPainter(t.renderer, { quality });
      if (t.lights && !keyBase.key) {
        ["key", "fill", "back"].forEach((k) => { if (t.lights[k]) keyBase[k] = t.lights[k].position.clone(); });
      }
      return true;
    }

    const yAxis = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), camLocal = new THREE.Vector3();
    const boardPos = new THREE.Vector3(), focusRange = [20, 60];
    // The sun goes round with the court: the chassis's lights follow it.
    function placeLights() {
      const t = three.current;
      if (!t.lights) return;
      const yaw = t.boardGroup.rotation.y;
      const set = (light, dir, dist) => { if (light) light.position.copy(tmp.copy(dir).applyAxisAngle(yAxis, yaw).multiplyScalar(dist)); };
      set(t.lights.key, KEY_DIR, 15);
      set(t.lights.fill, FILL_DIR, 13);
      set(t.lights.back, BACK_DIR, 13);
    }
    /* What would stand between the camera and the board (a bay of the
       colonnade, a tree) fades away while it would: anything within reach
       of the line from the camera to the board's middle, the reach
       widening toward the board as the board does. */
    const R_BOARD = () => Math.hypot(SLAB_X, SLAB_Z) / 2;
    function fadeBlockers(dtSec) {
      const t = three.current;
      if (!terrace || !t.camera) return;
      camLocal.copy(t.camera.position);
      t.boardGroup.worldToLocal(camLocal);
      const cx = camLocal.x, cz = camLocal.z, L2 = cx * cx + cz * cz, RB = R_BOARD();
      terrace.fades.forEach((f) => {
        let block = false;
        if (L2 > 1) {
          const u = ((f.x - cx) * -cx + (f.z - cz) * -cz) / L2; // 0 at the camera, 1 at the board's middle
          if (u > -0.05 && u < 1) {
            const qx = cx - cx * u, qz = cz - cz * u;
            block = Math.hypot(f.x - qx, f.z - qz) < f.rad + 0.8 + u * RB;
          }
        }
        const goal = block ? 0.06 : 1;
        f.op += (goal - f.op) * Math.min(1, dtSec * 5);
        const tr = f.op < 0.995;
        f.mats.forEach((m) => {
          if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
          m.opacity = f.op;
        });
        f.obj.visible = f.op > 0.02;
      });
    }

    let last = performance.now();
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__PARRISH__ = () => ({ painter: painter ? { ...painter.stats } : null, terrace: !!terrace, mode: painter ? painter.mode : null, faded: terrace ? terrace.fades.filter((f) => f.op < 0.5).length : 0 });
    }

    return {
      armOnBegin() {},
      restart() {},
      tick(now) {
        if (!attach()) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const t = three.current;
        sky.material.uniforms.uTime.value = now / 1000;
        if (terrace) terrace.waterMat.uniforms.uTime.value = now / 1000;
        placeLights();
        fadeBlockers(dt);
        woodSet.followGrain(t);
        govern(now);
      },
      // The frame through the paint (the chassis's render hook).
      render(r, scene, camera) {
        if (!painter || !terrace) return false;
        // (?paint=raw: the footage, unpainted, for comparing.)
        if (RAW) { reflect(r, camera); r.setRenderTarget(null); r.render(scene, camera); return true; }
        // Fine strokes from the board's near edge to a little past its far
        // one, loosening out over the court.
        const t = three.current;
        boardPos.setFromMatrixPosition(t.boardGroup.matrixWorld);
        const D = camera.position.distanceTo(boardPos), RB = R_BOARD();
        focusRange[0] = D + RB * 1.1; focusRange[1] = D + RB * 3.5;
        return painter.paint(r, scene, camera, (rr) => reflect(rr, camera), focusRange);
      },
      dispose() {
        const t = three.current;
        if (terrace && terrace.group.parent) terrace.group.parent.remove(terrace.group);
        if (brass && brass.group.parent) brass.group.parent.remove(brass.group);
        if (terrace) terrace.dispose();
        if (brass) brass.dispose();
        sky.geometry.dispose(); sky.material.dispose();
        reflRT.dispose();
        if (painter) painter.dispose();
        if (t && t.camera && farBefore != null) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
        if (t && t.lights) ["key", "fill", "back"].forEach((k) => { if (keyBase[k] && t.lights[k]) t.lights[k].position.copy(keyBase[k]); });
        if (t && t.renderer && prBefore != null) { t.renderer.setPixelRatio(prBefore); const sz = t.getMountSize && t.getMountSize(); if (sz) t.renderer.setSize(sz.w, sz.h); }
      },
    };
  };
}
