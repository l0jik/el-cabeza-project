/* Version 3, "Liquid": a warp morph. The board's outline flows into the
   poster's (its square into the hexagon for 1 and 2, onto the four squares
   for 5) while ripples run out from the middle and the poster's colours
   seep in through the wood in blots, a warm edge ahead of them. The frame's
   edges stay put; everything between bends smoothly (a thin-plate spline
   through matched points: the board's corners and edges to the poster's). */
import * as THREE from "../../../node_modules/three/build/three.module.js";
import { W, H, V1, V2, V5, hexPoints, posterCanvas } from "./posters.js";
import { BOARD, REST } from "./board.js";
import { clamp, lerp, span, smooth, easeInOut } from "./anim.js";

const GX = 90, GY = 160; // the mesh, in quads

// The board's outline at rest: corners, edge midpoints and quarter points, and its centre.
function boardPoints() {
  const x0 = REST.x, x1 = REST.x + REST.w, y0 = REST.y, y1 = REST.y + REST.h, cx = REST.cx, cy = REST.cy;
  const L = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  const TL = [x0, y0], TR = [x1, y0], BR = [x1, y1], BL = [x0, y1];
  return {
    ring: [TL, L(TL, TR, 0.25), L(TL, TR, 0.5), L(TL, TR, 0.75), TR, L(TR, BR, 0.25), L(TR, BR, 0.5), L(TR, BR, 0.75),
      BR, L(BR, BL, 0.25), L(BR, BL, 0.5), L(BR, BL, 0.75), BL, L(BL, TL, 0.25), L(BL, TL, 0.5), L(BL, TL, 0.75)],
    c: [cx, cy],
  };
}
// The same sixteen points on the poster's outline, in the same order (top left, along the top, ...).
function posterPoints(id) {
  const L = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  if (id === "v5") {
    const x0 = V5.x, y0 = V5.y, x1 = V5.x + V5.S, y1 = V5.y + V5.S;
    const TL = [x0, y0], TR = [x1, y0], BR = [x1, y1], BL = [x0, y1];
    return { ring: [TL, L(TL, TR, 0.25), L(TL, TR, 0.5), L(TL, TR, 0.75), TR, L(TR, BR, 0.25), L(TR, BR, 0.5), L(TR, BR, 0.75), BR, L(BR, BL, 0.25), L(BR, BL, 0.5), L(BR, BL, 0.75), BL, L(BL, TL, 0.25), L(BL, TL, 0.5), L(BL, TL, 0.75)], c: [V5.x + V5.S / 2, V5.y + V5.S / 2] };
  }
  const E = id === "v1" ? V1 : V2;
  const [T, UR, LR, B, LL, UL] = hexPoints(E.C[0], E.C[1], E.R);
  // the board's top edge folds up into the hexagon's peak, its bottom down into the point
  return { ring: [UL, L(UL, T, 0.5), T, L(T, UR, 0.5), UR, L(UR, LR, 0.25), L(UR, LR, 0.5), L(UR, LR, 0.75), LR, L(LR, B, 0.5), B, L(B, LL, 0.5), LL, L(LL, UL, 0.25), L(LL, UL, 0.5), L(LL, UL, 0.75)], c: E.C };
}

// A thin-plate spline from points a to points b (frame pixels).
function tps(a, b) {
  const n = a.length, S = 1 / 1000;
  const U = (r2) => (r2 < 1e-12 ? 0 : r2 * Math.log(r2) * 0.5);
  const M = n + 3;
  const A = Array.from({ length: M }, () => new Float64Array(M));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { const dx = (a[i][0] - a[j][0]) * S, dy = (a[i][1] - a[j][1]) * S; A[i][j] = U(dx * dx + dy * dy); }
    A[i][n] = 1; A[i][n + 1] = a[i][0] * S; A[i][n + 2] = a[i][1] * S;
    A[n][i] = 1; A[n + 1][i] = a[i][0] * S; A[n + 2][i] = a[i][1] * S;
  }
  const solve = (rhs) => {
    const m = A.map((row, i) => [...row, rhs[i]]);
    for (let c = 0; c < M; c++) {
      let p = c;
      for (let r = c + 1; r < M; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      [m[c], m[p]] = [m[p], m[c]];
      for (let r = 0; r < M; r++) {
        if (r === c) continue;
        const f = m[r][c] / m[c][c];
        for (let k = c; k <= M; k++) m[r][k] -= f * m[c][k];
      }
    }
    return m.map((row, i) => row[M] / row[i]);
  };
  const wx = solve([...b.map((p) => p[0] * S), 0, 0, 0]), wy = solve([...b.map((p) => p[1] * S), 0, 0, 0]);
  return (x, y) => {
    const X = x * S, Y = y * S;
    let fx = wx[n] + wx[n + 1] * X + wx[n + 2] * Y, fy = wy[n] + wy[n + 1] * X + wy[n + 2] * Y;
    for (let i = 0; i < n; i++) { const dx = X - a[i][0] * S, dy = Y - a[i][1] * S, u = U(dx * dx + dy * dy); fx += wx[i] * u; fy += wy[i] * u; }
    return [fx / S, fy / S];
  };
}

const VERT = `
attribute vec2 uvA; attribute vec2 uvB;
varying vec2 vA; varying vec2 vB;
void main() { vA = uvA; vB = uvB; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform sampler2D texA; uniform sampler2D texB; uniform float melt; uniform float time; uniform vec2 centre;
varying vec2 vA; varying vec2 vB;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 a = texture2D(texA, vA).rgb, b = texture2D(texB, vB).rgb;
  // the poster seeps in through blots that grow (a noise fixed to the poster, drifting a little)
  float n = fbm(vB * vec2(5.0, 8.9) + vec2(0.0, time * 0.15));
  // from the middle out, in blots
  float d = length((vB - centre) * vec2(1.0, 1.78));
  float front = melt * 1.9 - 0.2 - 0.55 * n - 0.75 * d;
  float m = smoothstep(0.0, 0.16, front);
  float edge = exp(-pow((front - 0.02) / 0.05, 2.0)) * (1.0 - step(0.999, melt));
  vec3 c = mix(a, b, m) + edge * vec3(0.32, 0.17, 0.05);
  gl_FragColor = vec4(c, 1.0);
}`;

let R = null;
const SCENES = {};
function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10); // x right, y up (picture y is -y)
  return (R = { r, cam });
}

function texture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

function build(id) {
  if (SCENES[id]) return SCENES[id];
  const bp = boardPoints(), pp = posterPoints(id);
  // the frame's own edge holds still
  const edge = [];
  for (let i = 0; i <= 8; i++) edge.push([(W * i) / 8, 0], [(W * i) / 8, H]);
  for (let j = 1; j < 16; j++) edge.push([0, (H * j) / 16], [W, (H * j) / 16]);
  const F = tps([...bp.ring, bp.c, ...edge], [...pp.ring, pp.c, ...edge]);
  const nv = (GX + 1) * (GY + 1);
  const A = new Float32Array(nv * 2), B = new Float32Array(nv * 2);
  const uvA = new Float32Array(nv * 2), uvB = new Float32Array(nv * 2);
  let v = 0;
  for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
    const x = (W * i) / GX, y = (H * j) / GY;
    let [fx, fy] = F(x, y);
    // the frame's edge exactly where it was
    if (i === 0 || i === GX) fx = x;
    if (j === 0 || j === GY) fy = y;
    A[v * 2] = x; A[v * 2 + 1] = y; B[v * 2] = fx; B[v * 2 + 1] = fy;
    uvA[v * 2] = x / W; uvA[v * 2 + 1] = 1 - y / H; uvB[v * 2] = fx / W; uvB[v * 2 + 1] = 1 - fy / H;
    v++;
  }
  const idx = [];
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
    const a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute("uvA", new THREE.BufferAttribute(uvA, 2));
  g.setAttribute("uvB", new THREE.BufferAttribute(uvB, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { texA: { value: texture(BOARD.start) }, texB: { value: texture(posterCanvas(id, { title: false })) }, melt: { value: 0 }, time: { value: 0 }, centre: { value: new THREE.Vector2(pp.c[0] / W, 1 - pp.c[1] / H) } },
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(g, mat));
  return (SCENES[id] = { scene, g, mat, A, B, nv, centre: pp.c, from: bp.c });
}

function frameLiquid(ctx, id, t) {
  if (t < 0.72) {
    ctx.drawImage(BOARD.start, 0, 0); // the photo as it is, held still until it starts to move
    return;
  }
  const { r, cam } = renderer();
  const S = build(id);
  const g = easeInOut(span(t, 0.75, 3.5)); // the shapes flowing
  const wave = Math.sin(Math.PI * span(t, 0.75, 3.3)) ** 2; // ripples and a slow whirl, gone at both ends
  const pos = S.g.attributes.position.array;
  const [cx0, cy0] = S.from, [cx1, cy1] = S.centre;
  const cx = lerp(cx0, cx1, g), cy = lerp(cy0, cy1, g);
  for (let v = 0; v < S.nv; v++) {
    let x = lerp(S.A[v * 2], S.B[v * 2], g), y = lerp(S.A[v * 2 + 1], S.B[v * 2 + 1], g);
    // nothing moves at the frame's edge
    const ex = Math.min(x, W - x) / 160, ey = Math.min(y, H - y) / 160, hold = clamp(Math.min(ex, ey));
    const dx = x - cx, dy = y - cy, rr = Math.hypot(dx, dy) || 1;
    const ring = 16 * wave * hold * Math.sin(rr * 0.032 - t * 7.5) * Math.exp(-rr / 900);
    const whirl = 0.2 * wave * hold * Math.exp(-rr / 520);
    const c = Math.cos(whirl), s = Math.sin(whirl);
    x = cx + (dx * c - dy * s) + (dx / rr) * ring;
    y = cy + (dx * s + dy * c) + (dy / rr) * ring;
    pos[v * 3] = x; pos[v * 3 + 1] = -y; pos[v * 3 + 2] = 0;
  }
  S.g.attributes.position.needsUpdate = true;
  S.mat.uniforms.melt.value = smooth(span(t, 1.35, 3.4));
  S.mat.uniforms.time.value = t;
  r.render(S.scene, cam);
  ctx.drawImage(r.domElement, 0, 0);
  const fin = smooth(span(t, 3.75, 4.15));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(posterCanvas(id, { title: false }), 0, 0); ctx.globalAlpha = 1; }
}

export const liquid = { settle: () => 4.15, frame: frameLiquid };
