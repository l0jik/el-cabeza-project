/* Noir's city round the board, in the board's frame (it hangs on the
   chassis's boardGroup, so it turns with the board) and sized from the
   slab (rebuilt when the board changes size).

   - The street: a ring of asphalt round the board, then a grid of streets
     and blocks out into the fog; pavements with their kerbs, crossings,
     lane marks, puddles that catch the light, the lamps' pools.
   - The blocks: tenements and lofts, brick and stone in four greys, their
     windows lit here and there (a third near, fewer far off), low by the
     board so the game stays in view and taller further out to a
     skyline; water towers on the roofs nearby. Every face of a kind in
     one geometry: a handful of draw calls for the lot.
   - The El: an elevated line on its steel trestle down one street, a lit
     train along it now and then.
   - The lamps: cast-iron posts on the corners, their heads glowing.

   Everything a building's game piece has (noir-models.js) at the city's
   scale: a window a bay of a quarter unit, four to a floor. */

import * as THREE from "three";
import { BOARD_ROWS, BOARD_COLS, OFF_X, OFF_Z, MARGIN, SQUARE_SIZE } from "../engine/constants.js";
import { towerParts, TOWER_MATS, hash } from "./noir-models.js";

const ASPHALT = "#0d0d0e", WALK = "#1c1c1d", KERB = "#6e6e6e";
// The city's faces: dark brick, grey brick, pale stone, grey stone.
const FACES = [
  { wall: "#222222", brick: true, trim: "#6e6e6e" },
  { wall: "#383838", brick: true, trim: "#848484" },
  { wall: "#989898", brick: false, trim: "#b8b8b8" },
  { wall: "#5c5c5c", brick: false, trim: "#868686" },
];
const CELL = 0.25; // a window bay, and a floor
const TILE = 16; // cells a facade texture holds each way

let seed = 919;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function tex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* A tile of facade: TILE bays by TILE floors, the windows lit by `lit`. */
function facadeTile(f, lit, px) {
  const S = TILE * px, c = cv(S, S), x = c.getContext("2d"), ec = cv(S, S), e = ec.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, S, S);
  x.fillStyle = f.wall; x.fillRect(0, 0, S, S);
  if (f.brick) { for (let y = 0, r = 0; y < S; y += 2, r++) for (let X = (r % 2) * 2; X < S; X += 4) { x.fillStyle = shadeOf(f.wall, rr(0.82, 1.15)); x.fillRect(X, y, 3.4, 1.5); } }
  else for (let i = 0; i < S * S * 0.05; i++) { x.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"; x.fillRect(rnd() * S, rnd() * S, 1, 1); }
  for (let fl = 0; fl < TILE; fl++) {
    x.fillStyle = f.trim; x.globalAlpha = 0.55; x.fillRect(0, fl * px + px - 1.5, S, 1.2); x.globalAlpha = 1;
    // whole floors and runs lit together, as people are home or not
    const floorLit = rnd() < 0.25 ? lit * 2.2 : lit * 0.7;
    for (let b = 0; b < TILE; b++) {
      const X0 = b * px + px * 0.28, w = px * 0.44, Y0 = fl * px + px * 0.17, h = px * 0.62;
      x.fillStyle = "#0b0b0b"; x.fillRect(X0, Y0, w, h);
      if (rnd() < floorLit) {
        e.fillStyle = ["#f0f0f0", "#dcdcdc", "#c4c4c4"][Math.floor(rnd() * 3)]; e.fillRect(X0, Y0, w, h);
        if (px >= 12) { e.fillStyle = "#000"; for (let t = Y0 + 1.5; t < Y0 + h; t += 2.5) e.fillRect(X0, t, w, 0.9); }
      }
    }
  }
  return { map: tex(c), emissiveMap: tex(ec) };
}
function shadeOf(hex, k) { const c = new THREE.Color(hex).multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return "#" + c.getHexString(); }

/* Seen through: a building standing between the camera and what it looks
   at (the view's target, uFocus) dissolves there, in a cone round the
   line of sight widening toward the board, its edge dithered, so a block
   behind you never fills the view (as Plano's fade, for whole merged
   meshes: done per fragment). */
export const FOCUS = { value: new THREE.Vector3() };
function seeThrough(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFocus = FOCUS;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeeP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSeeP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uFocus; varying vec3 vSeeP;\nfloat seeB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }\nfloat seeB4(vec2 a){ return seeB2(0.5 * a) * 0.25 + seeB2(a); }")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        {
          // a narrow cone: only what really stands in the way (a wide one cut
          // the tops off blocks the view passed well over)
          vec3 seg = uFocus - cameraPosition; float L = length(seg); vec3 dir = seg / max(L, 1e-4);
          float t = dot(vSeeP - cameraPosition, dir);
          if (t > 0.0 && t < L - 1.5) {
            float d = length(vSeeP - (cameraPosition + dir * t)), r = 1.3 + 0.045 * t;
            float edge = smoothstep(r, r - 0.35, d);
            if (seeB4(gl_FragCoord.xy) < edge) discard; // an ordered dither at the edge
          }
        }`);
  };
  mat.customProgramCacheKey = () => "noir-see-through";
  return mat;
}

/* Quads into per-material arrays (positions, normals, uvs). */
function sink() { return { pos: [], nor: [], uv: [] }; }
function quad(s, a, b, c, d, n, uv) {
  // a b c d counter-clockwise seen from outside; two triangles
  const P = [a, b, c, a, c, d], U = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
  for (let i = 0; i < 6; i++) { s.pos.push(P[i][0], P[i][1], P[i][2]); s.nor.push(n[0], n[1], n[2]); s.uv.push(U[i][0], U[i][1]); }
}
function geoOf(s) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(s.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(s.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(s.uv, 2));
  g.computeBoundingSphere();
  return g;
}
// A building's four faces and roof into the sinks; the facade's windows
// stay a quarter unit whatever the size, offset by whole cells.
function building(sides, roofs, x0, x1, z0, z1, h, k) {
  const ou = Math.floor(rnd() * TILE) / TILE, ov = Math.floor(rnd() * TILE) / TILE, T = TILE * CELL;
  const fu = (len) => len / T, fv = h / T;
  const s = sides;
  // +z face (x0..x1), -z face, +x face (z1..z0), -x face
  let L = x1 - x0;
  quad(s, [x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], [[ou, ov], [ou + fu(L), ov], [ou + fu(L), ov + fv], [ou, ov + fv]]);
  quad(s, [x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], [[ou + 0.37, ov], [ou + 0.37 + fu(L), ov], [ou + 0.37 + fu(L), ov + fv], [ou + 0.37, ov + fv]]);
  L = z1 - z0;
  quad(s, [x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], [[ou + 0.61, ov], [ou + 0.61 + fu(L), ov], [ou + 0.61 + fu(L), ov + fv], [ou + 0.61, ov + fv]]);
  quad(s, [x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], [[ou + 0.13, ov], [ou + 0.13 + fu(L), ov], [ou + 0.13 + fu(L), ov + fv], [ou + 0.13, ov + fv]]);
  const R = 0.35;
  quad(roofs, [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], [[x0 * R, z1 * R], [x1 * R, z1 * R], [x1 * R, z0 * R], [x0 * R, z0 * R]]);
  // a parapet's coping round the top: a thin band of the roof sink
  const c = 0.03;
  quad(roofs, [x0 - c, h - 0.035, z1 + c], [x1 + c, h - 0.035, z1 + c], [x1 + c, h + 0.01, z1 + c], [x0 - c, h + 0.01, z1 + c], [0, 0, 1], [[0, 0], [0.1, 0], [0.1, 0.02], [0, 0.02]]);
  quad(roofs, [x1 + c, h - 0.035, z0 - c], [x0 - c, h - 0.035, z0 - c], [x0 - c, h + 0.01, z0 - c], [x1 + c, h + 0.01, z0 - c], [0, 0, -1], [[0, 0], [0.1, 0], [0.1, 0.02], [0, 0.02]]);
  quad(roofs, [x1 + c, h - 0.035, z1 + c], [x1 + c, h - 0.035, z0 - c], [x1 + c, h + 0.01, z0 - c], [x1 + c, h + 0.01, z1 + c], [1, 0, 0], [[0, 0], [0.1, 0], [0.1, 0.02], [0, 0.02]]);
  quad(roofs, [x0 - c, h - 0.035, z0 - c], [x0 - c, h - 0.035, z1 + c], [x0 - c, h + 0.01, z1 + c], [x0 - c, h + 0.01, z0 - c], [-1, 0, 0], [[0, 0], [0.1, 0], [0.1, 0.02], [0, 0.02]]);
  return k;
}

/* ------------------------------------------------------------ the city */

export function buildCity({ EX, EZ, tier }) {
  seed = 919;
  const group = new THREE.Group(); group.name = "noir-city";
  const owned = { geos: [], mats: [], texs: [] };
  const keepG = (g) => { owned.geos.push(g); return g; }, keepM = (m) => { owned.mats.push(m); return m; }, keepT = (t) => { owned.texs.push(t); return t; };
  const low = tier === "low";

  /* the plan: a ring street round the board, then blocks */
  const RING = 1.9, STREET = 1.7, BLOCK = 4.4, EXTENT = 46;
  const clearX = EX + RING, clearZ = EZ + RING;
  const bands = (clear) => { const out = []; for (let a = clear; a < EXTENT; a += BLOCK + STREET) out.push([a, Math.min(EXTENT, a + BLOCK)]); return out; };
  const bx = bands(clearX), bz = bands(clearZ);
  const xs = [...bx.map(([a, b]) => [-b, -a]).reverse(), [-clearX + RING, clearX - RING], ...bx];
  const zs = [...bz.map(([a, b]) => [-b, -a]).reverse(), [-clearZ + RING, clearZ - RING], ...bz];
  // the El runs down the second street on the -x side
  const elX = -(clearX + BLOCK + STREET / 2);

  /* ---------------- the ground: streets, walks, crossings, puddles, the lamps' pools */
  // (the roughness at half the colour's detail, the lamps' soft pools at a
  // quarter: three canvases this size would be a lot for a phone)
  const GPX = low ? 10 : 16, GS = EXTENT * 2, GW = Math.round(GS * GPX);
  const gc = cv(GW, GW), g = gc.getContext("2d"), rc = cv(GW / 2, GW / 2), r = rc.getContext("2d"), ec = cv(GW / 4, GW / 4), e = ec.getContext("2d");
  r.scale(0.5, 0.5); e.scale(0.25, 0.25);
  const U = (v) => (v + EXTENT) * GPX;
  g.fillStyle = ASPHALT; g.fillRect(0, 0, GW, GW);
  for (let i = 0; i < GW * GW * 0.012; i++) { g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.2)"; g.fillRect(rnd() * GW, rnd() * GW, 2, 2); }
  r.fillStyle = "rgb(150,150,150)"; r.fillRect(0, 0, GW, GW);
  e.fillStyle = "#000"; e.fillRect(0, 0, GW, GW); // (both scaled: GW is their whole width too)
  const blocks = [];
  for (const [x0, x1] of xs) for (const [z0, z1] of zs) {
    const isBoard = x0 < 0 && x1 > 0 && z0 < 0 && z1 > 0;
    if (isBoard) continue;
    blocks.push({ x0, x1, z0, z1 });
    // the walk round the block, its kerb
    g.fillStyle = WALK; g.fillRect(U(x0) - 0.35 * GPX, U(z0) - 0.35 * GPX, (x1 - x0 + 0.7) * GPX, (z1 - z0 + 0.7) * GPX);
    g.strokeStyle = KERB; g.lineWidth = Math.max(1, GPX * 0.06); g.strokeRect(U(x0) - 0.35 * GPX, U(z0) - 0.35 * GPX, (x1 - x0 + 0.7) * GPX, (z1 - z0 + 0.7) * GPX);
    r.fillStyle = "rgb(185,185,185)"; r.fillRect(U(x0) - 0.35 * GPX, U(z0) - 0.35 * GPX, (x1 - x0 + 0.7) * GPX, (z1 - z0 + 0.7) * GPX);
  }
  // the board's own kerb and walk round the slab; the board's streets go
  // on out across it to the ring street
  g.fillStyle = WALK; g.fillRect(U(-EX) - 0.3 * GPX, U(-EZ) - 0.3 * GPX, (2 * EX + 0.6) * GPX, (2 * EZ + 0.6) * GPX);
  g.strokeStyle = KERB; g.lineWidth = Math.max(1, GPX * 0.06); g.strokeRect(U(-EX) - 0.3 * GPX, U(-EZ) - 0.3 * GPX, (2 * EX + 0.6) * GPX, (2 * EZ + 0.6) * GPX);
  {
    const half = BOARD_STREET / 2, out = 0.38;
    const asphalt = (x0, z0, x1, z1) => { g.fillStyle = ASPHALT; g.fillRect(U(x0), U(z0), (x1 - x0) * GPX, (z1 - z0) * GPX); r.fillStyle = "rgb(150,150,150)"; r.fillRect(U(x0), U(z0), (x1 - x0) * GPX, (z1 - z0) * GPX); };
    for (let i = 0; i <= BOARD_COLS; i++) { const x = i * SQUARE_SIZE - OFF_X; asphalt(x - half, -EZ - out, x + half, -EZ); asphalt(x - half, EZ, x + half, EZ + out); }
    for (let j = 0; j <= BOARD_ROWS; j++) { const z = j * SQUARE_SIZE - OFF_Z; asphalt(-EX - out, z - half, -EX, z + half); asphalt(EX, z - half, EX + out, z + half); }
  }
  // lane marks down the middle of every street, crossings at the corners
  g.fillStyle = "rgba(210,210,210,0.35)";
  const mids = (bandsArr) => { const m = []; for (let i = 0; i < bandsArr.length - 1; i++) m.push((bandsArr[i][1] + bandsArr[i + 1][0]) / 2); return m; };
  const mx = mids(xs), mz = mids(zs);
  for (const x of mx) for (let z = -EXTENT; z < EXTENT; z += 1.1) g.fillRect(U(x) - 0.03 * GPX, U(z), 0.06 * GPX, 0.5 * GPX);
  for (const z of mz) for (let x = -EXTENT; x < EXTENT; x += 1.1) g.fillRect(U(x), U(z) - 0.03 * GPX, 0.5 * GPX, 0.06 * GPX);
  g.fillStyle = "rgba(220,220,220,0.45)";
  for (const x of mx) for (const z of mz) {
    for (let k = -3; k <= 3; k++) {
      g.fillRect(U(x) + k * 0.22 * GPX - 0.06 * GPX, U(z) - (STREET / 2 + 0.25) * GPX, 0.12 * GPX, 0.4 * GPX);
      g.fillRect(U(x) - (STREET / 2 + 0.25) * GPX, U(z) + k * 0.22 * GPX - 0.06 * GPX, 0.4 * GPX, 0.12 * GPX);
    }
  }
  // puddles, smooth in the roughness
  for (let i = 0; i < (low ? 140 : 320); i++) {
    const px = rr(-EXTENT, EXTENT), pz = rr(-EXTENT, EXTENT);
    if (Math.abs(px) < EX + 0.3 && Math.abs(pz) < EZ + 0.3) continue;
    const rx = rr(0.1, 0.36) * GPX, ry = rr(0.05, 0.16) * GPX, rot = rr(0, 3.14);
    g.fillStyle = "rgba(5,5,6,0.4)"; g.beginPath(); g.ellipse(U(px), U(pz), rx, ry, rot, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 1; g.stroke();
    r.fillStyle = "rgb(25,25,25)"; r.beginPath(); r.ellipse(U(px), U(pz), rx, ry, rot, 0, 7); r.fill();
  }
  // the lamps: on every corner of the near blocks, and down the far streets
  const lamps = [];
  for (const b of blocks) {
    const near = Math.max(Math.abs((b.x0 + b.x1) / 2) - EX, Math.abs((b.z0 + b.z1) / 2) - EZ) < 14;
    if (!near && rnd() < 0.55) continue;
    for (const [x, z] of [[b.x0 - 0.18, b.z0 - 0.18], [b.x1 + 0.18, b.z1 + 0.18]]) lamps.push([x, z]);
  }
  for (const [x, z] of lamps) {
    const R = 1.6 * GPX, grd = e.createRadialGradient(U(x), U(z), 0, U(x), U(z), R);
    grd.addColorStop(0, "rgba(110,108,104,1)"); grd.addColorStop(0.4, "rgba(40,39,37,1)"); grd.addColorStop(1, "rgba(0,0,0,1)");
    e.globalCompositeOperation = "lighter"; e.fillStyle = grd; e.fillRect(U(x) - R, U(z) - R, R * 2, R * 2); e.globalCompositeOperation = "source-over";
  }
  const groundMat = keepM(new THREE.MeshStandardMaterial({
    map: keepT(tex(gc, true, false)), roughnessMap: keepT(tex(rc, false, false)), roughness: 1, metalness: 0.05,
    emissive: new THREE.Color(0xffffff), emissiveMap: keepT(tex(ec, true, false)), emissiveIntensity: 0.85,
  }));
  const ground = new THREE.Mesh(keepG(new THREE.PlaneGeometry(GS, GS)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.012; ground.receiveShadow = true; ground.raycast = () => {}; ground.name = "noir-ground";
  group.add(ground);
  // and the plain dark ground on beyond it, out under the skyline, so no
  // edge ever shows: the fog takes it
  const outer = new THREE.Mesh(keepG(new THREE.RingGeometry(EXTENT * 0.98, 260, 64, 1)), keepM(new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.9, metalness: 0 })));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.raycast = () => {};
  group.add(outer);

  /* ---------------- the blocks */
  const tilePx = low ? 8 : 16;
  const faceMats = FACES.map((f, i) => {
    const t = facadeTile(f, i === 0 ? 0.3 : 0.24, tilePx);
    keepT(t.map); keepT(t.emissiveMap);
    return keepM(seeThrough(new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1, roughness: f.brick ? 0.92 : 0.8, metalness: 0 })));
  });
  const roofC = cv(64, 64), rx = roofC.getContext("2d");
  rx.fillStyle = "#262626"; rx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) { rx.fillStyle = shadeOf("#262626", rr(0.75, 1.3)); rx.fillRect(rnd() * 64, rnd() * 64, rr(2, 8), rr(2, 8)); }
  const roofMat = keepM(seeThrough(new THREE.MeshStandardMaterial({ map: keepT(tex(roofC)), roughness: 0.95, metalness: 0 })));
  const sinks = FACES.map(() => sink()), roofs = sink();
  const towerSpots = [];
  // every building's footprint and height, for roofAt (the camera keeps above them)
  const lots = [];
  for (const b of blocks) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const d = Math.max(Math.abs(cx) - EX, Math.abs(cz) - EZ); // how far from the board's edge
    const near = d < 8, mid = d < 18;
    // the block in lots: two or three along x, two along z
    const nxL = rnd() < 0.5 ? 2 : 3, nzL = 2;
    for (let i = 0; i < nxL; i++) for (let j = 0; j < nzL; j++) {
      if (rnd() < 0.06) continue; // a vacant lot
      const lx0 = b.x0 + ((b.x1 - b.x0) * i) / nxL, lx1 = b.x0 + ((b.x1 - b.x0) * (i + 1)) / nxL;
      const lz0 = b.z0 + ((b.z1 - b.z0) * j) / nzL, lz1 = b.z0 + ((b.z1 - b.z0) * (j + 1)) / nzL;
      const inset = 0.02;
      // low by the board (the game stays in view), taller further out
      const floors = near ? Math.round(rr(4, 11)) : mid ? Math.round(rr(7, 20)) : Math.round(rr(10, 34));
      const h = floors * CELL;
      const f = Math.floor(rnd() * FACES.length);
      building(sinks[f], roofs, lx0 + inset, lx1 - inset, lz0 + inset, lz1 - inset, h, f);
      lots.push([lx0, lx1, lz0, lz1, h]);
      if (d < 16 && rnd() < 0.35) towerSpots.push([(lx0 + lx1) / 2 + rr(-0.3, 0.3), h, (lz0 + lz1) / 2 + rr(-0.3, 0.3)]);
    }
  }
  // the skyline beyond: towers further out, into the fog, the city going on
  for (let k = 0, n = low ? 36 : 64; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rr(-0.04, 0.04), d = rr(EXTENT + 8, EXTENT + 48), w = rr(2.5, 6.5), dd = rr(2.5, 6.5);
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = Math.round(rr(24, 88)) * CELL;
    building(sinks[rnd() < 0.6 ? 0 : 1], roofs, x - w / 2, x + w / 2, z - dd / 2, z + dd / 2, h, 0);
    lots.push([x - w / 2, x + w / 2, z - dd / 2, z + dd / 2, h]);
  }
  // a coarse grid over them: each cell lists the buildings touching it
  const GC = 3, grid = new Map(), cellOf = (v) => Math.floor(v / GC);
  lots.forEach((L, i) => {
    for (let cx = cellOf(L[0] - 0.5); cx <= cellOf(L[1] + 0.5); cx++) for (let cz = cellOf(L[2] - 0.5); cz <= cellOf(L[3] + 0.5); cz++) {
      const k = cx + "," + cz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
    }
  });
  // the height of the roofs at (x, z) in the board's frame, with a little room round each
  const roofAt = (x, z, pad = 0.35) => {
    const list = grid.get(cellOf(x) + "," + cellOf(z));
    let h = 0;
    if (list) for (const i of list) { const L = lots[i]; if (x > L[0] - pad && x < L[1] + pad && z > L[2] - pad && z < L[3] + pad && L[4] > h) h = L[4]; }
    return h;
  };
  sinks.forEach((s, i) => { if (!s.pos.length) return; const m = new THREE.Mesh(keepG(geoOf(s)), faceMats[i]); m.castShadow = true; m.receiveShadow = true; m.raycast = () => {}; group.add(m); });
  const roofMesh = new THREE.Mesh(keepG(geoOf(roofs)), roofMat); roofMesh.receiveShadow = true; roofMesh.raycast = () => {}; group.add(roofMesh);

  /* ---------------- water towers on the near roofs (instanced) */
  const T = towerParts(), S = 2.2; // the city's towers a little bigger than a piece's
  const towerMeshes = [];
  for (const part of ["iron", "wood", "roof"]) {
    const im = new THREE.InstancedMesh(T[part], TOWER_MATS[part](), Math.max(1, towerSpots.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(S, S, S), p = new THREE.Vector3();
    towerSpots.forEach(([x, y, z], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i * 7 + 3) * 6.28); p.set(x, y, z); m4.compose(p, q, sc); im.setMatrixAt(i, m4); });
    im.count = towerSpots.length; im.castShadow = true; im.raycast = () => {};
    group.add(im); towerMeshes.push(im);
  }

  /* ---------------- the El: a steel trestle down one street, the deck, the rails */
  const iron = keepM(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7, metalness: 0.35 }));
  const EL_Y = 2.3, EL_W = 1.15, elParts = [];
  const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); elParts.push(b.toNonIndexed()); b.dispose(); };
  for (let z = -EXTENT; z <= EXTENT; z += 1.6) {
    for (const sx of [-1, 1]) box(0.06, EL_Y, 0.06, elX + (sx * EL_W) / 2, EL_Y / 2, z);
    box(EL_W + 0.1, 0.07, 0.06, elX, EL_Y - 0.05, z); // the bent across
    for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.025, 0.6, 0.025); b.rotateZ(sx * 0.5); b.translate(elX + sx * (EL_W / 2 - 0.15), EL_Y - 0.25, z); elParts.push(b.toNonIndexed()); b.dispose(); }
  }
  for (const sx of [-1, 1]) box(0.08, 0.16, EXTENT * 2, elX + (sx * EL_W) / 2, EL_Y + 0.02, 0); // the girders
  box(EL_W + 0.12, 0.03, EXTENT * 2, elX, EL_Y + 0.11, 0); // the deck
  for (const sx of [-0.22, 0.22]) box(0.025, 0.03, EXTENT * 2, elX + sx, EL_Y + 0.14, 0); // the rails
  const elGeo = keepG(BufferGeometryMerge(elParts));
  const elIron = keepM(seeThrough(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7, metalness: 0.35 })));
  const el = new THREE.Mesh(elGeo, elIron); el.castShadow = true; el.receiveShadow = true; el.raycast = () => {}; el.name = "noir-el";
  group.add(el);
  // the train: six cars, their windows lit, a headlight
  const carC = cv(256, 64), cx2 = carC.getContext("2d"), carE = cv(256, 64), ce = carE.getContext("2d");
  cx2.fillStyle = "#1c1c1d"; cx2.fillRect(0, 0, 256, 64); ce.fillStyle = "#000"; ce.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 10; i++) { const X = 10 + i * 24; cx2.fillStyle = "#0b0b0b"; cx2.fillRect(X, 16, 16, 20); ce.fillStyle = rnd() < 0.85 ? "#ececec" : "#9a9a9a"; ce.fillRect(X, 16, 16, 20); }
  cx2.fillStyle = "#3a3a3a"; cx2.fillRect(0, 44, 256, 3);
  const carMat = keepM(new THREE.MeshStandardMaterial({ map: keepT(tex(carC, true, false)), emissiveMap: keepT(tex(carE, true, false)), emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.1, roughness: 0.6, metalness: 0.2 }));
  const carTop = keepM(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
  const train = new THREE.Group(); train.name = "noir-train";
  const CAR = 1.45, CARS = 6;
  for (let i = 0; i < CARS; i++) {
    const g2 = keepG(new THREE.BoxGeometry(0.5, 0.42, CAR - 0.06));
    // the sides take the window strip; the ends and roof plain
    const m = new THREE.Mesh(g2, [carMat, carMat, carTop, carTop, carTop, carTop]);
    m.rotation.y = 0; m.position.set(0, 0.21, i * CAR); m.castShadow = true; m.raycast = () => {};
    train.add(m);
  }
  const head = new THREE.Sprite(keepM(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  head.scale.set(0.9, 0.9, 1); head.position.set(0, 0.22, -0.75); train.add(head);
  train.position.set(elX, EL_Y + 0.15, 0); train.visible = false;
  group.add(train);

  /* ---------------- the lamps: posts and glowing heads */
  const postGeo = keepG(BufferGeometryMerge([
    (() => { const c = new THREE.CylinderGeometry(0.012, 0.018, 0.42, 6); c.translate(0, 0.21, 0); return c.toNonIndexed(); })(),
    (() => { const c = new THREE.CylinderGeometry(0.03, 0.035, 0.04, 6); c.translate(0, 0.02, 0); return c.toNonIndexed(); })(),
    (() => { const c = new THREE.ConeGeometry(0.04, 0.05, 6); c.translate(0, 0.46, 0); return c.toNonIndexed(); })(),
  ]));
  const allLamps = [...lamps, ...lampSpots()];
  const posts = new THREE.InstancedMesh(postGeo, iron, allLamps.length);
  const m4 = new THREE.Matrix4();
  allLamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); posts.setMatrixAt(i, m4); });
  posts.castShadow = true; posts.raycast = () => {};
  group.add(posts);
  // the heads: one draw of glowing points
  const hp = new Float32Array(allLamps.length * 3);
  allLamps.forEach(([x, z], i) => hp.set([x, 0.43, z], i * 3));
  const hg = keepG(new THREE.BufferGeometry()); hg.setAttribute("position", new THREE.BufferAttribute(hp, 3));
  const heads = new THREE.Points(hg, keepM(new THREE.PointsMaterial({ map: glowTex(), color: 0xfff6e6, size: 0.55, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  heads.raycast = () => {}; heads.name = "noir-lamp-heads";
  group.add(heads);

  /* ---------------- life: the train going by now and then */
  const RUN = EXTENT * 2 + CAR * CARS, SPEED = 5.2, PERIOD = 46;
  let lastPass = -1;
  function tick(t) {
    const k = t % PERIOD, run = (k * SPEED);
    if (run < RUN + 6) {
      train.visible = true;
      const dir = Math.floor(t / PERIOD) % 2 ? 1 : -1; // up the line, then back down
      train.position.z = dir > 0 ? -EXTENT - CAR * CARS + run : EXTENT - run;
      train.rotation.y = dir > 0 ? Math.PI : 0;
      lastPass = Math.floor(t / PERIOD);
    } else train.visible = false;
    return lastPass;
  }

  return {
    group,
    elX,
    roofAt,
    // where the train is (for the sound), or null
    train: () => (train.visible ? train.position : null),
    tick,
    dispose() {
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose && o.dispose(); });
      owned.geos.forEach((q) => q.dispose()); owned.mats.forEach((q) => q.dispose()); owned.texs.forEach((q) => q.dispose());
    },
  };
}

/* The board's streets (noir.js paints them, noir-traffic.js drives them):
   one down every line of the grid, this wide, and on out across the
   border; the walk round each block inside its square. */
export const BOARD_STREET = 0.18;
export const BOARD_WALK = 0.05;

/* Where the street lamps stand round the board's edge: on the walk round
   the district, at the corners and along the sides between them (by a
   column's letter, clear of the streets going out). noir.js draws their
   pools on the board. */
export function lampSpots() {
  const k = (BOARD_STREET / 2 + MARGIN) / 2, ex = OFF_X + k, ez = OFF_Z + k, out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push([sx * ex, sz * ez]);
  const nx = Math.max(0, Math.round(BOARD_COLS / 4) - 1), nz = Math.max(0, Math.round(BOARD_ROWS / 4) - 1);
  // (a column's middle, then 0.3 of a square in toward the board's middle:
  // between its letter and the next street)
  const by = (v, off, n) => { const i = Math.min(n - 1, Math.max(0, Math.floor((v + off) / SQUARE_SIZE))); return (i + (v < 0 ? 0.8 : 0.2)) * SQUARE_SIZE - off; };
  for (let i = 1; i <= nx; i++) { const x = by(-OFF_X + (2 * OFF_X * i) / (nx + 1), OFF_X, BOARD_COLS); out.push([x, -ez], [x, ez]); }
  for (let i = 1; i <= nz; i++) { const z = by(-OFF_Z + (2 * OFF_Z * i) / (nz + 1), OFF_Z, BOARD_ROWS); out.push([-ex, z], [ex, z]); }
  return out;
}

function BufferGeometryMerge(parts) {
  // positions, normals and uvs of non-indexed parts, one after another
  let n = 0; parts.forEach((p) => { n += p.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
    o += p.attributes.position.count; p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

let GLOW = null;
export function glowTex() {
  if (!GLOW) {
    const c = cv(64, 64), x = c.getContext("2d"), grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,0.5)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    GLOW = new THREE.CanvasTexture(c);
  }
  return GLOW;
}
