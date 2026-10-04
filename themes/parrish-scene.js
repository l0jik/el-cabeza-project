/* Parrish's world, after the user's reference (Enya's "Orinoco Flow",
   1988: the singer clean and photographic over painted worlds; user: "the
   style, motif, color palette, and overall feeling"):

   the board and its pieces are the subject, kept clean, standing on a
   pale stone pillar that rises out of the sea; flowers at its corners
   (roses, sweet peas, daisies) and white butterflies about it. Round it
   the world the paint is laid over: turquoise shallows breaking white on
   dark rocks, deepening to cobalt, misty toward the horizon; a soft, high
   sky of cloud with a pale moon in it; an old ship under sail going
   slowly round. High-key and airy: creams, sky blues, turquoise, sage,
   touches of rose.

   The subject and the world are told apart for the paint
   (parrish-paint.js) by the alpha the scene writes: the board, pieces,
   pillar's top, flowers and butterflies write 1, everything else 0
   (opaque materials at opacity 0 still draw their colour, alpha 0).

   A painter's liberty: the sea falls away with distance (a tight
   curvature) and the painted horizon lies below eye level, so from where
   a player sits the sea's edge and the sky come into the top of the
   picture.

   All of it hangs off the chassis's boardGroup, so it turns with the
   board, and the light with it. Rebuilt if the board changes size. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_THICKNESS } from "../engine/constants.js";
import { createPainter } from "./parrish-paint.js";

/* ------------------------------------------------------------ the light */

// The painted horizon's drop below eye level (radians); the sun (soft,
// fairly high) and the moon, in the painted sky's own terms.
const DROP = 0.27;
export const SUN_DIR = new THREE.Vector3(0.62, 0.6, 0.5).normalize();
const MOON_DIR = new THREE.Vector3(-0.42, 0.3, -0.86).normalize();
const KEY_DIR = new THREE.Vector3(0.62, 0.72, 0.42).normalize();
const FILL_DIR = new THREE.Vector3(-0.6, 0.45, 0.65).normalize();
const BACK_DIR = new THREE.Vector3(-0.45, 0.4, -0.8).normalize();

// The sea's level, and how fast it falls away from the pillar.
const WATER_Y = -2.2;
const CURVE_FROM = 18, CURVE_K = 0.012;
export function seaY(r) { const f = Math.max(r - CURVE_FROM, 0); return WATER_Y - f * f * CURVE_K; }

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

/* Weathered plaster for the pillar, as the wall behind the singer on the
   "Watermark" cover (user): grey stone mottled with a teal-green patina,
   umber stains, chalky pale patches, fine dark cracks. */
let STONE = null;
function stoneTexture() {
  if (STONE) return STONE;
  const S = 512;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  const img = g.createImageData(S, S);
  const n = noise2(41), m = noise2(77);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const big = n(u * 4, v * 4) * 0.6 + n(u * 11, v * 11) * 0.3 + n(u * 40, v * 40) * 0.1;
    const patina = Math.max(0, Math.min(1, (m(u * 3 + 7, v * 3 + 2) - 0.48) * 4));
    const stain = Math.max(0, Math.min(1, (n(u * 2.2 + 9, v * 2.2 + 4) - 0.6) * 5));
    const chalk = Math.max(0, Math.min(1, (m(u * 9 + 1, v * 9 + 5) - 0.66) * 6));
    let r = 168 + big * 52, gg = 166 + big * 50, b = 156 + big * 46;
    r = r * (1 - patina * 0.4) + 104 * patina * 0.4; gg = gg * (1 - patina * 0.4) + 150 * patina * 0.4; b = b * (1 - patina * 0.4) + 140 * patina * 0.4;
    r = r * (1 - stain * 0.3) + 110 * stain * 0.3; gg = gg * (1 - stain * 0.3) + 84 * stain * 0.3; b = b * (1 - stain * 0.3) + 70 * stain * 0.3;
    r += chalk * 30; gg += chalk * 30; b += chalk * 28;
    const i = (y * S + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Cracks: a few wandering hairlines.
  const rr = rng(5);
  g.strokeStyle = "rgba(48,46,44,0.55)"; g.lineWidth = 1.2;
  for (let k = 0; k < 14; k++) {
    let x = rr() * S, y = rr() * S, a = rr() * Math.PI * 2;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 30; j++) { a += (rr() - 0.5) * 0.9; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); }
    g.stroke();
  }
  STONE = new THREE.CanvasTexture(c);
  STONE.wrapS = STONE.wrapT = THREE.RepeatWrapping;
  return STONE;
}

/* A crimson leaf, as the cover's: five-lobed, deep red darkening to
   wine at its edges, its veins darker still. */
let LEAF = null;
function leafTexture() {
  if (LEAF) return LEAF;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  g.translate(64, 70);
  const lobes = [[-1.57, 58], [-0.75, 46], [-2.39, 46], [0.2, 30], [-3.34, 30]];
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
    let rad = 14;
    lobes.forEach(([la, len]) => { const d = Math.atan2(Math.sin(a - la), Math.cos(a - la)); rad = Math.max(rad, len * Math.exp(-d * d * 9)); });
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  const grd = g.createRadialGradient(0, -6, 4, 0, -6, 62);
  grd.addColorStop(0, "#C42A30"); grd.addColorStop(0.6, "#8E1420"); grd.addColorStop(1, "#4E0A14");
  g.fillStyle = grd; g.fill();
  g.strokeStyle = "rgba(50,6,12,0.7)"; g.lineWidth = 1.6;
  lobes.forEach(([la, len]) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(la) * len * 0.85, Math.sin(la) * len * 0.85); g.stroke(); });
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 40); g.stroke();
  LEAF = new THREE.CanvasTexture(c);
  return LEAF;
}

/* What the lacquer and the wood reflect: a soft sky over a turquoise sea. */
let ENV = null;
export function parrishEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#5E86C8");
  grad.addColorStop(0.3, "#9DBEE6");
  grad.addColorStop(0.48, "#E8EEEE");
  grad.addColorStop(0.52, "#BFE0DA");
  grad.addColorStop(0.7, "#4FA3B4");
  grad.addColorStop(1, "#1F4F82");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, col) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  [[0.08, 0.3], [0.27, 0.22], [0.45, 0.33], [0.63, 0.25], [0.82, 0.31]].forEach(([u, v]) => blob(u * W, v * H, 90, 40, "rgba(255,252,244,0.85)"));
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
float ringN(float az, float k, vec2 o) { return fbm(vec2(cos(az), sin(az)) * k + o); }
`;

/* The dome, in the painted sky's own terms (its horizon uDrop below eye
   level). Writes alpha 0: it's the world, not the subject. */
const SKY_VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
precision highp float;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uTime;
uniform float uDrop;
varying vec3 vDir;
${NOISE_GLSL}
vec3 skyGrad(float el) {
  float e = clamp(el / 1.2, 0.0, 1.0);
  vec3 hor = vec3(0.74, 0.84, 0.92), mid = vec3(0.55, 0.71, 0.9), zen = vec3(0.3, 0.47, 0.8);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, e));
  return mix(c, zen, smoothstep(0.25, 0.9, e));
}
void main() {
  vec3 d0 = normalize(vDir);
  float az = atan(d0.x, -d0.z);
  float el = asin(clamp(d0.y, -1.0, 1.0)) + uDrop;
  vec3 d = vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
  float sunDot = max(dot(d, normalize(uSun)), 0.0);
  vec3 col;
  if (el >= 0.0) {
    col = skyGrad(el) + vec3(1.0, 0.94, 0.8) * pow(sunDot, 6.0) * 0.25;
    // The moon, pale, its seas faint blue-grey, a haze round it.
    vec3 md = normalize(uMoon);
    float ma = acos(clamp(dot(d, md), -1.0, 1.0));
    vec3 mx = normalize(cross(md, vec3(0.0, 1.0, 0.0))), my = cross(mx, md);
    vec2 mp = vec2(dot(d, mx), dot(d, my)) / 0.07;
    float disc = 1.0 - smoothstep(0.065, 0.071, ma);
    float mare = fbm(mp * 2.2 + 3.0);
    vec3 moon = mix(vec3(0.97, 0.97, 0.94), vec3(0.74, 0.78, 0.84), smoothstep(0.5, 0.75, mare) * 0.8);
    col += vec3(0.95, 0.96, 1.0) * exp(-ma * 9.0) * 0.18;
    col = mix(col, moon, disc);
    // Soft cumulus everywhere above, drifting: cream where the light is,
    // blue-grey and a little mauve in their shadow.
    vec2 p = d.xz / (d.y + 0.22) * 1.3 + vec2(uTime * 0.008, uTime * 0.003);
    float cl = fbm(p * 0.8);
    float sh = fbm(p * 0.8 + normalize(uSun.xz) * 0.08);
    float cov = smoothstep(0.5, 0.74, cl) * smoothstep(0.0, 0.1, el);
    float lit = clamp(0.55 + (cl - sh) * 5.0, 0.0, 1.0);
    vec3 cc = mix(mix(vec3(0.54, 0.6, 0.78), vec3(0.68, 0.56, 0.7), 0.35), vec3(0.97, 0.95, 0.91), lit);
    col = mix(col, cc, cov * 0.92);
    // Banks of cloud along the horizon, and the haze.
    float H = 0.04 + 0.22 * smoothstep(0.4, 0.8, ringN(az, 1.7, vec2(3.1, 1.7)));
    float bank = smoothstep(0.0, 0.03, H + (fbm(vec2(az * 8.0, el * 10.0)) - 0.5) * 0.1 - el);
    col = mix(col, mix(vec3(0.72, 0.76, 0.86), vec3(0.95, 0.94, 0.92), clamp(el / max(H, 0.01), 0.0, 1.0)), bank * 0.6);
    col = mix(col, vec3(0.86, 0.9, 0.93), (1.0 - smoothstep(0.0, 0.04, el)) * 0.45);
  } else {
    // The far sea: cobalt under the haze, white caps in long streaks.
    float far = smoothstep(-0.25, 0.0, el);
    col = mix(vec3(0.12, 0.33, 0.62), vec3(0.6, 0.78, 0.86), far * far);
    float caps = smoothstep(0.7, 0.9, fbm(vec2(az * 40.0, el * 300.0) + vec2(uTime * 0.05, 0.0)));
    col = mix(col, vec3(0.95, 0.97, 0.98), caps * 0.5 * (1.0 - far));
    col = mix(col, vec3(0.92, 0.94, 0.94), smoothstep(-0.03, 0.0, el) * 0.7);
  }
  gl_FragColor = vec4(col, 0.0);
}`;

/* ------------------------------------------------------------ the sea */

/* A wide disc of sea round the pillar, falling away with distance (so its
   edge meets the painted horizon), its swell moving. Turquoise shallows
   round the pillar and the rocks, cobalt further out, white caps, and the
   surf: foam that churns and breaks in pulses where the water meets
   stone. Alpha 0: the world. */
const SEA_VERT = `
uniform float uTime;
uniform float uCurveFrom;
uniform float uCurveK;
varying vec3 vWorld;
varying vec2 vXZ;
varying float vR;
void main() {
  vec3 p = position;
  float r = length(p.xz);
  float f = max(r - uCurveFrom, 0.0);
  p.y -= f * f * uCurveK;
  float swell = smoothstep(10.0, 22.0, r);
  p.y += (sin(p.x * 0.11 + uTime * 0.55) * 0.14 + sin(p.z * 0.085 - uTime * 0.42) * 0.12) * swell;
  vXZ = position.xz;
  vR = r;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SEA_FRAG = `
precision highp float;
uniform float uTime;
uniform vec2 uPillar;
uniform vec3 uRocks[8];
varying vec3 vWorld;
varying vec2 vXZ;
varying float vR;
${NOISE_GLSL}
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 q = vXZ;
  float dist = sdBox(q, uPillar);
  for (int i = 0; i < 8; i++) dist = min(dist, length(q - uRocks[i].xy) - uRocks[i].z);
  float shallow = 1.0 - smoothstep(0.0, 10.0, dist);
  vec3 col = mix(vec3(0.13, 0.38, 0.62), vec3(0.08, 0.24, 0.52), smoothstep(12.0, 40.0, vR));
  col = mix(col, vec3(0.3, 0.62, 0.68), shallow * 0.7);
  // Moving streaks of light and dark across the water, and white caps.
  float w1 = vnoise(q * vec2(0.16, 0.45) + vec2(uTime * 0.22, uTime * 0.08));
  col *= 0.9 + 0.2 * w1;
  float caps = smoothstep(0.74, 0.92, vnoise(q * 0.32 + vec2(uTime * 0.28, -uTime * 0.18)) * (0.55 + 0.6 * w1));
  col = mix(col, vec3(0.88, 0.92, 0.94), caps * 0.45);
  // The surf.
  float pulse = 0.5 + 0.5 * sin(uTime * 0.9 - dist * 0.8);
  float churn = vnoise(q * 0.8 + vec2(uTime * 0.6, -uTime * 0.45)) * 0.6 + vnoise(q * 2.1 - uTime * 0.8) * 0.4;
  float near = 1.0 - smoothstep(0.0, 2.4 + 2.0 * pulse, dist);
  float foam = near * smoothstep(0.3, 0.62, churn + 0.35 * (1.0 - smoothstep(0.0, 1.0, dist)));
  col = mix(col, vec3(0.88, 0.92, 0.94), clamp(foam, 0.0, 1.0) * 0.9);
  // The sky in it, seen low; the haze toward the horizon.
  vec3 V = normalize(cameraPosition - vWorld);
  col = mix(col, vec3(0.7, 0.8, 0.9), pow(1.0 - max(V.y, 0.0), 3.0) * 0.4);
  col = mix(col, vec3(0.74, 0.84, 0.92), smoothstep(26.0, 40.0, vR) * 0.4);
  gl_FragColor = vec4(col, 0.0);
}`;

/* ------------------------------------------------------------ the things in it */

// Materials for the world write alpha 0 (opacity 0, opaque).
const world = (m) => { m.opacity = 0; m.transparent = false; return m; };

/* A rock: a lumpy, dark slate boulder, half in the water. */
function buildRock(r, size, mat) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position;
  const n = noise2(Math.floor(r() * 1000));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 0.72 + 0.5 * n(x * 1.7 + 5, z * 1.7 + y * 1.3 + 5) + 0.12 * n(x * 5 + 9, y * 5 + 2);
    pos.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(size * (0.9 + r() * 0.4), size * (0.7 + r() * 0.6), size * (0.9 + r() * 0.4));
  m.rotation.y = r() * Math.PI * 2;
  return m;
}

/* An old ship under sail: a dark wooden hull, three masts, square sails
   bellied with wind, the rigging. Bow toward +x. */
function buildShip(mats) {
  const g = new THREE.Group();
  const prof = new THREE.Shape();
  prof.moveTo(-8, 3.4); prof.lineTo(-8.4, 1.4); prof.lineTo(-6.6, 0); prof.lineTo(5.4, 0); prof.lineTo(8.6, 1.6); prof.lineTo(9.8, 3.6); prof.lineTo(6, 3.0); prof.lineTo(-8, 3.4);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: 3.4, bevelEnabled: false, curveSegments: 1 }), mats.hull);
  hull.position.z = -1.7;
  g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.3, 3.5), mats.trim);
  stripe.position.set(0.3, 2.4, 0);
  g.add(stripe);
  const masts = [[-4.2, 13], [0.6, 16], [5.2, 12]];
  const ropes = [];
  masts.forEach(([x, h]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, h, 6), mats.hull);
    mast.position.set(x, 3 + h / 2, 0);
    g.add(mast);
    [[0.42, 0.9], [0.74, 0.7]].forEach(([at, w]) => {
      const sw = 5.6 * w, sh = h * 0.27;
      const sg = new THREE.PlaneGeometry(sw, sh, 6, 4);
      const sp = sg.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const u = sp.getX(i) / (sw / 2), v = sp.getY(i) / (sh / 2);
        sp.setZ(i, (1 - u * u) * (1 - 0.3 * v * v) * 0.9);
      }
      sg.computeVertexNormals();
      const sail = new THREE.Mesh(sg, mats.sail);
      sail.rotation.y = Math.PI / 2;
      sail.position.set(x + 0.25, 3 + h * at, 0);
      g.add(sail);
      ropes.push(x, 3 + h * at + sh / 2, 0, x, 3 + h * at + sh / 2, 0);
    });
    ropes.push(x, 3 + h, 0, -8, 3.4, 0, x, 3 + h, 0, 9.8, 3.6, 0);
  });
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 5), mats.hull);
  bow.rotation.z = -Math.PI / 2.6;
  bow.position.set(11.5, 4.8, 0);
  g.add(bow);
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.Float32BufferAttribute(ropes, 3));
  g.add(new THREE.LineSegments(rg, mats.rope));
  return g;
}

/* Flowers for a corner of the pillar: roses (coral, rose, red), sweet peas
   (lavender, mauve), daisies, and their leaves. */
function buildFlowers(r, mats) {
  const g = new THREE.Group();
  const leaf = new THREE.IcosahedronGeometry(0.16, 0);
  const rose = new THREE.IcosahedronGeometry(0.11, 1);
  const pea = new THREE.IcosahedronGeometry(0.06, 0);
  const petal = new THREE.CircleGeometry(0.09, 8);
  const eye = new THREE.CircleGeometry(0.035, 6);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, rr = r() * 0.55;
    const m = new THREE.Mesh(leaf, mats.leaf);
    m.position.set(Math.cos(a) * rr, 0.05 + r() * 0.16, Math.sin(a) * rr);
    m.scale.set(1, 0.5, 1.4);
    m.rotation.y = r() * 6;
    g.add(m);
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, rr = r() * 0.45;
    const m = new THREE.Mesh(rose, mats.roses[i % mats.roses.length]);
    m.position.set(Math.cos(a) * rr, 0.2 + r() * 0.14, Math.sin(a) * rr);
    m.scale.set(1, 0.8, 1);
    g.add(m);
  }
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2, rr = 0.2 + r() * 0.45;
    const m = new THREE.Mesh(pea, mats.peas[i % mats.peas.length]);
    m.position.set(Math.cos(a) * rr, 0.24 + r() * 0.22, Math.sin(a) * rr);
    g.add(m);
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, rr = 0.25 + r() * 0.35;
    const d = new THREE.Group();
    const p = new THREE.Mesh(petal, mats.daisy); d.add(p);
    const e = new THREE.Mesh(eye, mats.eye); e.position.z = 0.005; d.add(e);
    d.position.set(Math.cos(a) * rr, 0.26 + r() * 0.12, Math.sin(a) * rr);
    d.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.8;
    g.add(d);
  }
  return g;
}

/* A white butterfly: two wings (a painted canvas: white, a dusting of
   lemon, dark tips and a spot), flapping. */
let WING = null;
function wingTexture() {
  if (WING) return WING;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#FBFAF2";
  g.beginPath(); g.moveTo(4, 64); g.bezierCurveTo(20, 4, 110, 0, 124, 30); g.bezierCurveTo(126, 56, 96, 66, 70, 66); g.bezierCurveTo(104, 80, 112, 112, 84, 124); g.bezierCurveTo(52, 128, 18, 96, 4, 64); g.fill();
  const lg = g.createRadialGradient(10, 64, 4, 10, 64, 90); lg.addColorStop(0, "rgba(232,226,160,0.8)"); lg.addColorStop(1, "rgba(232,226,160,0)");
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = lg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(60,62,70,0.85)"; g.beginPath(); g.ellipse(112, 24, 16, 12, 0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(78, 40, 7, 0, Math.PI * 2); g.fill();
  WING = new THREE.CanvasTexture(c);
  return WING;
}
function buildButterfly(mat) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.42, 0.42);
  geo.translate(0.21, 0, 0);
  geo.rotateX(-Math.PI / 2);
  const right = new THREE.Mesh(geo, mat);
  const left = new THREE.Mesh(geo, mat);
  left.scale.x = -1;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), new THREE.MeshLambertMaterial({ color: 0x3a3a40 }));
  body.rotation.x = Math.PI / 2;
  g.add(right, left, body);
  g.userData = { right, left };
  return g;
}

/* ------------------------------------------------------------ the world */

function buildWorld(sky) {
  const group = new THREE.Group();
  group.name = "parrish-world";
  const geos = new Set(), mats = new Set();
  const keep = (o) => { o.traverse((m) => { if (m.geometry) geos.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x)); }); return o; };
  const r = rng(1988);

  // The pillar: its top (the subject's, with the board) and its body going
  // down into the sea (the world's).
  const pw = SLAB_X + 2.4, pd = SLAB_Z + 2.4;
  const stoneTop = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTexture(), roughness: 0.9, metalness: 0, envMap: parrishEnv(), envMapIntensity: 0.12 });
  const stoneBody = world(new THREE.MeshStandardMaterial({ color: 0xe6e2da, map: stoneTexture(), roughness: 0.8, metalness: 0 }));
  const cap = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.4, pd), stoneTop);
  cap.position.y = -SLAB_THICKNESS - 0.2;
  cap.receiveShadow = true;
  group.add(cap);
  const bodyH = 14;
  const body = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.6, bodyH, pd - 0.6), stoneBody);
  body.position.y = -SLAB_THICKNESS - 0.4 - bodyH / 2;
  body.receiveShadow = true;
  group.add(body);

  // Flowers at the pillar's corners, outside the board.
  const fm = {
    leaf: new THREE.MeshStandardMaterial({ color: 0x6f9a6a, roughness: 0.85, flatShading: true }),
    roses: [0xf08a7a, 0xe8607a, 0xc8283a, 0xf6b8b0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
    peas: [0xb59ad8, 0xd8a8d0, 0x9a7cc8].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
    daisy: new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.8, side: THREE.DoubleSide }),
    eye: new THREE.MeshStandardMaterial({ color: 0xf2c33c, roughness: 0.8, side: THREE.DoubleSide }),
  };
  const fx = pw / 2 - 0.55, fz = pd / 2 - 0.55;
  [[fx, fz], [-fx, fz], [fx, -fz], [-fx, -fz]].forEach(([x, z]) => {
    const f = buildFlowers(r, fm);
    f.position.set(x, -SLAB_THICKNESS, z);
    f.scale.setScalar(1.6);
    group.add(f);
  });

  // The sea.
  const rocks = [];
  const rockMat = world(new THREE.MeshStandardMaterial({ color: 0x3c4652, roughness: 0.9, metalness: 0, flatShading: true }));
  [[0.5, 17, 2.6], [1.3, 21, 3.6], [2.2, 15.5, 1.8], [2.9, 26, 4.2], [3.7, 19, 2.4], [4.4, 24, 3.2], [5.3, 16.5, 2.2], [5.9, 29, 4.8]].forEach(([a, d, s]) => {
    const rock = buildRock(r, s, rockMat);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    rock.position.set(x, seaY(d) - s * 0.25, z);
    group.add(rock);
    rocks.push(new THREE.Vector3(x, z, s * 0.95));
  });
  const seaGeo = new THREE.RingGeometry(0.5, 420, 160, 90);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCurveFrom: { value: CURVE_FROM }, uCurveK: { value: CURVE_K }, uPillar: { value: new THREE.Vector2((pw - 0.6) / 2, (pd - 0.6) / 2) }, uRocks: { value: rocks } },
    vertexShader: SEA_VERT, fragmentShader: SEA_FRAG,
  });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = WATER_Y;
  sea.frustumCulled = false;
  sea.name = "parrish-sea";
  group.add(sea);

  // The ship, sailing round.
  const shipMats = {
    hull: world(new THREE.MeshStandardMaterial({ color: 0x5a3c28, roughness: 0.8 })),
    trim: world(new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.6 })),
    sail: world(new THREE.MeshStandardMaterial({ color: 0xf4eedf, roughness: 0.9, side: THREE.DoubleSide })),
    rope: world(new THREE.LineBasicMaterial({ color: 0x3a3028 })),
  };
  const ship = buildShip(shipMats);
  group.add(ship);

  // The butterflies.
  const bmat = new THREE.MeshLambertMaterial({ map: wingTexture(), side: THREE.DoubleSide, alphaTest: 0.5 });
  const butterflies = [0, 1, 2].map((i) => {
    const b = buildButterfly(bmat);
    b.userData.phase = i * 2.1 + r() * 3;
    b.userData.speed = 0.13 + r() * 0.06;
    group.add(b);
    return b;
  });

  // Crimson leaves drifting down past the pillar (the "Watermark" cover).
  const lmat = new THREE.MeshLambertMaterial({ map: leafTexture(), side: THREE.DoubleSide, alphaTest: 0.5 });
  const lgeo = new THREE.PlaneGeometry(0.95, 0.95);
  const leaves = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const l = new THREE.Mesh(lgeo, lmat);
    l.userData = { phase: r() * 100, a0: r() * Math.PI * 2, rad: 0.6 + r() * 0.5, spin: 0.6 + r() * 0.8, fall: 0.22 + r() * 0.14 };
    group.add(l);
    return l;
  });

  group.add(sky);
  keep(group);
  geos.delete(sky.geometry); mats.delete(sky.material);
  return {
    group, sea, seaMat, ship, butterflies, leaves, half: [pw / 2, pd / 2],
    dispose() { group.remove(sky); geos.forEach((g) => g.dispose()); mats.forEach((m) => { if (m.map && m.map !== stoneTexture() && m.map !== wingTexture() && m.map !== leafTexture()) m.map.dispose(); m.dispose(); }); },
  };
}

/* ------------------------------------------------------------ the effects */

const RAW = (() => { try { return new URLSearchParams(window.location.search).get("paint") === "raw"; } catch (e) { return false; } })();

export function createParrishEffects(woodSet, { quality }) {
  return function mountAmbientEffects(refs, { three }) {
    let attachedTo = null, scene = null, brass = null, dims = "";
    let painter = null;
    let farBefore = null;
    const keyBase = { key: null, fill: null, back: null };

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 64, 32),
      new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN_DIR.clone() }, uMoon: { value: MOON_DIR.clone() }, uTime: { value: 0 }, uDrop: { value: DROP } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    sky.name = "parrish-sky";

    function build() {
      const t = three.current;
      if (scene) { if (scene.group.parent) scene.group.parent.remove(scene.group); scene.dispose(); scene = null; }
      if (brass) { if (brass.group.parent) brass.group.parent.remove(brass.group); brass.dispose(); brass = null; }
      scene = buildWorld(sky);
      brass = woodSet.buildBrass();
      t.boardGroup.add(scene.group, brass.group);
      dims = `${SLAB_X}x${SLAB_Z}`;
    }

    /* The pixel ratio. A painting needs no more than about one pixel to
       the screen's point (the strokes are wider than any pixel), and every
       pixel costs several passes: capped by the device's tier, lowered a
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
      // The slab's box outline would draw over the pillar's top.
      const edges = t.boardGroup.getObjectByName("ec-slab-edges");
      if (edges) edges.visible = false;
      if (t.camera && farBefore == null) { farBefore = t.camera.far; t.camera.far = 2400; t.camera.updateProjectionMatrix(); }
      if (!painter) painter = createPainter(t.renderer, { quality });
      if (t.lights && !keyBase.key) {
        ["key", "fill", "back"].forEach((k) => { if (t.lights[k]) keyBase[k] = t.lights[k].position.clone(); });
      }
      return true;
    }

    const yAxis = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    const boardPos = new THREE.Vector3(), focusRange = [20, 60];
    // The light goes round with the world: the chassis's lights follow it.
    function placeLights() {
      const t = three.current;
      if (!t.lights) return;
      const yaw = t.boardGroup.rotation.y;
      const set = (light, dir, dist) => { if (light) light.position.copy(tmp.copy(dir).applyAxisAngle(yAxis, yaw).multiplyScalar(dist)); };
      set(t.lights.key, KEY_DIR, 15);
      set(t.lights.fill, FILL_DIR, 13);
      set(t.lights.back, BACK_DIR, 13);
    }
    // The ship sails slowly round (a lap in about five minutes), rising
    // and dipping on the swell; the butterflies wander round the pillar,
    // never over the board.
    const SHIP_R = 48;
    function move(nowS) {
      if (!scene) return;
      const a = nowS * 0.021 + 1.2;
      const s = scene.ship;
      s.position.set(Math.cos(a) * SHIP_R, seaY(SHIP_R) - 0.6 + Math.sin(nowS * 0.7) * 0.25, Math.sin(a) * SHIP_R);
      s.rotation.set(Math.sin(nowS * 0.6) * 0.03, -a - Math.PI / 2, Math.sin(nowS * 0.8 + 1) * 0.05);
      const [hx, hz] = scene.half;
      scene.butterflies.forEach((b) => {
        const p = b.userData.phase, sp = b.userData.speed;
        const th = nowS * sp + p;
        const rx = hx + 1.6 + Math.sin(nowS * 0.31 + p) * 1.2, rz = hz + 1.6 + Math.cos(nowS * 0.27 + p * 1.7) * 1.2;
        b.position.set(Math.cos(th) * rx, 0.9 + Math.sin(nowS * 0.9 + p) * 0.6 + Math.sin(nowS * 2.3 + p) * 0.15, Math.sin(th) * rz);
        b.rotation.y = -th + Math.PI;
        const flap = 0.15 + 1.0 * Math.abs(Math.sin(nowS * 11 + p * 3));
        b.userData.right.rotation.z = flap;
        b.userData.left.rotation.z = -flap;
      });
      // The leaves: each drifts down a slow spiral outside the board,
      // tumbling, and starts again from above when it reaches the sea.
      const R0 = Math.hypot(hx, hz);
      scene.leaves.forEach((l) => {
        const u = l.userData;
        const cyc = 7 / u.fall;
        const tt = (nowS + u.phase) % cyc;
        const lap = Math.floor((nowS + u.phase) / cyc);
        const a = u.a0 + lap * 2.4 + tt * 0.22;
        const rad = R0 * (0.95 + u.rad * 0.6) + Math.sin(tt * 0.7) * 0.8;
        l.position.set(Math.cos(a) * rad, 4.2 - tt * u.fall + Math.sin(tt * 1.3) * 0.3, Math.sin(a) * rad);
        l.rotation.set(tt * u.spin, tt * u.spin * 0.7 + u.phase, Math.sin(tt * 1.7) * 0.8);
      });
    }

    let last = performance.now();
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__PARRISH__ = () => ({ painter: painter ? { ...painter.stats } : null, terrace: !!scene, mode: painter ? painter.mode : null });
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
        if (scene) scene.seaMat.uniforms.uTime.value = now / 1000;
        placeLights();
        move(now / 1000, dt);
        woodSet.followGrain(t);
        govern(now);
      },
      // The frame through the paint (the chassis's render hook).
      render(r, scn, camera) {
        if (!painter || !scene) return false;
        // (?paint=raw: the footage, unpainted, for comparing.)
        if (RAW) return painter.paint(r, scn, camera, null, true);
        const t = three.current;
        boardPos.setFromMatrixPosition(t.boardGroup.matrixWorld);
        const D = camera.position.distanceTo(boardPos), RB = Math.hypot(SLAB_X, SLAB_Z) / 2;
        focusRange[0] = D + RB * 1.1; focusRange[1] = D + RB * 3.5;
        return painter.paint(r, scn, camera, null);
      },
      dispose() {
        const t = three.current;
        if (scene && scene.group.parent) scene.group.parent.remove(scene.group);
        if (brass && brass.group.parent) brass.group.parent.remove(brass.group);
        if (scene) scene.dispose();
        if (brass) brass.dispose();
        sky.geometry.dispose(); sky.material.dispose();
        if (painter) painter.dispose();
        if (t && t.camera && farBefore != null) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
        if (t && t.lights) ["key", "fill", "back"].forEach((k) => { if (keyBase[k] && t.lights[k]) t.lights[k].position.copy(keyBase[k]); });
        if (t && t.renderer && prBefore != null) { t.renderer.setPixelRatio(prBefore); const sz = t.getMountSize && t.getMountSize(); if (sz) t.renderer.setSize(sz.w, sz.h); }
      },
    };
  };
}
