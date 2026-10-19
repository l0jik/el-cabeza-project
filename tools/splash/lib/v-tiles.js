/* Version 1, "Tiles": the picture is cut along the board's own squares into
   wooden tiles, and each tile flips over to show its piece of the poster:
     v1  a ripple out from the hexagon's middle, each tile tipping outward
     v2  out to the sides from the middle, as the rays run
     v5  quarter by quarter: the stripes' tiles turn on upright hinges, the
         rings' on level ones
   The title isn't in the tiles: it's over them (title.js). */
import * as THREE from "../../../node_modules/three/build/three.module.js";
import { W, H, V1, V2, V5, posterCanvas } from "./posters.js";
import { BOARD, XS, YS, REST } from "./board.js";
import { clamp, lerp, span, smooth, easeInOut, rng, canvas } from "./anim.js";

const k = REST.k;
// The board's squares at rest, continued across the frame.
const PX = REST.x + XS[0] * k, PY = REST.y + YS[0] * k;
const DX = ((XS[10] - XS[0]) * k) / 10, DY = ((YS[10] - YS[0]) * k) / 10;
const DEPTH = 12, CAM_D = 2600;

let R = null; // the renderer and its scene, made once
const SCENES = {};

function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  const cam = new THREE.PerspectiveCamera((2 * Math.atan(H / 2 / CAM_D) * 180) / Math.PI, W / H, 100, 6000);
  R = { r, cam };
  return R;
}

const VERT = `
varying vec2 vUv; varying vec3 vN;
void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform sampler2D map; uniform vec3 L; uniform vec3 tint; uniform float useMap;
varying vec2 vUv; varying vec3 vN;
void main() {
  vec3 c = useMap > 0.5 ? texture2D(map, vUv).rgb : tint;
  // lit so a tile lying flat shows its picture exactly; tipped to the lamp it brightens, away it darkens
  float d = max(dot(normalize(vN), L), 0.0) / L.z;
  gl_FragColor = vec4(c * clamp(d, 0.3, 1.28), 1.0);
}`;
const LIGHT = new THREE.Vector3(-0.38, 0.46, 0.8).normalize();

function material(tex, tint = [0.16, 0.1, 0.06]) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { map: { value: tex }, L: { value: LIGHT }, tint: { value: new THREE.Vector3(...tint) }, useMap: { value: tex ? 1 : 0 } },
  });
}

function texture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

// The flip for each tile: when, about which axis (in the picture's plane), by poster.
function plan(id, cx, cy) {
  const j = rng(Math.round(cx * 7 + cy * 13))() - 0.5;
  if (id === "v1") {
    const [ox, oy] = V1.C;
    const d = Math.hypot(cx - ox, cy - oy);
    return { s: 0.75 + 2.1 * (d / 1250) + 0.12 * j, dir: d < 1 ? [1, 0] : [(cx - ox) / d, (cy - oy) / d] };
  }
  if (id === "v2") {
    const [ox, oy] = V2.C;
    return { s: 0.75 + 1.7 * (Math.abs(cx - ox) / 560) + 0.5 * (Math.abs(cy - oy) / 1100) + 0.1 * j, dir: [cx < ox ? -1 : 1, 0] };
  }
  // v5: quarter by quarter round the square, then the paper about it
  const { x, y, S, q } = V5;
  const inside = cx > x && cx < x + S && cy > y && cy < y + S;
  if (!inside) {
    const d = Math.max(x - cx, cx - (x + S), y - cy, cy - (y + S), 0);
    const ox = x + S / 2, oy = y + S / 2, dd = Math.hypot(cx - ox, cy - oy) || 1;
    return { s: 2.2 + 0.9 * (d / 500) + 0.1 * j, dir: [(cx - ox) / dd, (cy - oy) / dd] };
  }
  const right = cx > x + q, low = cy > y + q;
  const key = low ? (right ? "br" : "bl") : right ? "tr" : "tl";
  const start = { tl: 0.75, tr: 1.15, br: 1.55, bl: 1.95 }[key];
  if (key === "tl" || key === "br") {
    // stripes: across the quarter, upright hinges
    const f = (cx - (x + (right ? q : 0))) / q;
    return { s: start + 0.6 * (key === "tl" ? f : 1 - f) + 0.08 * j, dir: [key === "tl" ? 1 : -1, 0] };
  }
  // rings: out from the corner, level hinges
  const [ox, oy] = key === "tr" ? [x + S, y] : [x, y + S];
  const d = Math.hypot(cx - ox, cy - oy) / (q * 1.42);
  return { s: start + 0.6 * d + 0.08 * j, dir: [0, key === "tr" ? 1 : -1] };
}

function build(id) {
  if (SCENES[id]) return SCENES[id];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0806);
  const front = material(texture(BOARD.start)), back = material(texture(posterCanvas(id, { title: false }))), side = material(null, [0.17, 0.105, 0.06]);
  side.side = THREE.DoubleSide;
  const shadowTex = (() => {
    const c = canvas(64, 64), g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.85)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const tiles = [];
  const i0 = Math.floor(-PX / DX) - 1, i1 = Math.ceil((W - PX) / DX) + 1;
  const j0 = Math.floor(-PY / DY) - 1, j1 = Math.ceil((H - PY) / DY) + 1;
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const x0 = PX + i * DX, y0 = PY + j * DY, x1 = x0 + DX, y1 = y0 + DY;
    if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const p = plan(id, cx, cy);
    // the hinge: across the direction the tile tips (its far edge comes up first), kept to the
    // square's own axes and diagonals so that half a turn lands it back in its place
    const q8 = Math.round(Math.atan2(p.dir[1], p.dir[0]) / (Math.PI / 4)) * (Math.PI / 4);
    const ax = new THREE.Vector3(-Math.sin(q8), -Math.cos(q8), 0).normalize(); // picture y is down, the world's up
    tiles.push({ mesh: tileMesh(x0, y0, x1, y1, ax, front, back, side), cx, cy, ...p, ax });
  }
  for (const tl of tiles) scene.add(tl.mesh);
  // a shadow under each tile as it lifts, on its neighbours
  const shMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 });
  for (const tl of tiles) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(DX * 1.5, DY * 1.5), shMat.clone());
    m.position.set(tl.cx, -tl.cy, 0.6);
    m.renderOrder = 1;
    tl.shadow = m;
    scene.add(m);
  }
  return (SCENES[id] = { scene, tiles });
}

// A tile: a thin box whose top shows the opening picture and whose underside shows the poster,
// laid out so that after half a turn about `ax` it reads the right way up.
function tileMesh(x0, y0, x1, y1, ax, front, back, side) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
  const uvAt = (X, Y) => [X / W, 1 - Y / H]; // picture pixels to texture coordinates
  const pos = [], uv = [], nrm = [], idx = [];
  const groups = [];
  const quad = (pts, uvs, n, mat) => {
    const b = pos.length / 3;
    pts.forEach((p, i) => { pos.push(...p); uv.push(...uvs[i]); nrm.push(...n); });
    groups.push([idx.length, 6, mat]);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // local corners (world: x right, y up)
  const c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const zt = DEPTH / 2, zb = -DEPTH / 2;
  quad(c.map(([x, y]) => [x, y, zt]), c.map(([x, y]) => uvAt(cx + x, cy - y)), [0, 0, 1], 0);
  // the underside: each point shows the poster where it will land, mirrored across the hinge
  const mir = ([x, y]) => { const d = x * ax.x + y * ax.y; return [2 * d * ax.x - x, 2 * d * ax.y - y]; };
  const cb = [c[0], c[3], c[2], c[1]];
  quad(cb.map(([x, y]) => [x, y, zb]), cb.map((p) => { const [mx, my] = mir(p); return uvAt(cx + mx, cy - my); }), [0, 0, -1], 1);
  const sides = [[c[0], c[1], [0, -1, 0]], [c[1], c[2], [1, 0, 0]], [c[2], c[3], [0, 1, 0]], [c[3], c[0], [-1, 0, 0]]];
  for (const [a, b, n] of sides) quad([[...a, zb], [...b, zb], [...b, zt], [...a, zt]], [[0, 0], [1, 0], [1, 1], [0, 1]], n, 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  for (const [s, n, m] of groups) g.addGroup(s, n, m);
  const mesh = new THREE.Mesh(g, [front, back, side]);
  mesh.position.set(cx, -cy, -DEPTH / 2);
  return mesh;
}

const FLIP = 0.72;
function frameTiles(ctx, id, t) {
  if (t < 0.72) {
    ctx.drawImage(BOARD.start, 0, 0); // the photo as it is, held still until it starts to move
    return;
  }
  const { r, cam } = renderer();
  const { scene, tiles } = build(id);
  for (const tl of tiles) {
    const u = span(t, tl.s, tl.s + FLIP);
    // half a turn with a little overshoot that settles
    const e = easeInOut(u), settle = u >= 1 ? 0 : Math.sin(Math.PI * clamp((u - 0.62) / 0.38)) * 0.12 * (u > 0.62 ? 1 : 0);
    const ang = Math.PI * e + settle;
    const lift = Math.sin(Math.PI * u);
    tl.mesh.quaternion.setFromAxisAngle(tl.ax, ang);
    tl.mesh.position.z = -DEPTH / 2 + 70 * lift; // the face that shows lies in the picture's plane at rest
    tl.mesh.scale.setScalar(1 - 0.07 * lift);
    tl.shadow.material.opacity = 0.42 * lift;
    tl.shadow.position.set(tl.cx + 26 * lift, -tl.cy - 34 * lift, 0.6);
    tl.shadow.visible = lift > 0.01;
  }
  // the camera drifts a little while the tiles turn, and is back square at the end
  const w = Math.sin(Math.PI * span(t, 0.7, 4.3));
  cam.position.set(W / 2 + 70 * w, -H / 2 - 50 * w, CAM_D);
  cam.up.set(0, 1, 0);
  cam.lookAt(W / 2, -H / 2, 0);
  cam.updateProjectionMatrix();
  r.render(scene, cam);
  ctx.drawImage(r.domElement, 0, 0);
  // the poster itself, exactly, once every tile lies flat
  const fin = smooth(span(t, 4.05, 4.4));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(posterCanvas(id, { title: false }), 0, 0); ctx.globalAlpha = 1; }
}

// settle: when the poster is whole (the title's NOVA follows it)
export const tiles = { settle: () => 4.4, frame: frameTiles };
