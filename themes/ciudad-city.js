/* Ciudad's city round the board, in the board's frame (it hangs on the
   chassis's boardGroup, so it turns with the board) and sized from the
   slab (rebuilt when the board changes size).

   As the mock-ups' city round the board (scratch city.js, the ground and
   its mix): glass towers, punched stone, mid-century ribbon windows and
   board-marked concrete, in whites, greys and grey-blues, low by the
   board and taller further out, going on into the haze.

   - The ground: a street just off each edge of the board, then a grid of
     streets and blocks (asphalt, a dashed line down each, the kerbs, the
     crossings near the board), the blocks paved; here and there a block
     a park with its trees, a plaza, a car park. The lamps' pools on the
     streets at night.
   - The buildings: a block in lots, a building a lot, every face of a
     style in one geometry (its windows from a tile of that style, lit by
     plan at night: ciudad-models.js PLAN_GLSL, each building a plan of
     its own). A building standing between the camera and the board
     dissolves there (as Noir's do).
   - The lamps: posts on the board's edge and on the corners near it,
     their heads glowing at night.
   - roofAt(x, z): the roofs' height there, for the camera to keep above. */

import * as THREE from "three";
import {
  FACADE, STYLE_GRID, OFFICE, planMaterial, FOCUS, PLAN_U, sink, quad, geoOf, cv, tex, col, shade, glowTex, rnd as mrnd, farDim,
} from "./ciudad-models.js";
import { edgeLamps } from "./ciudad.js";

const PITCH = 2.92, SW = 0.36, EXTENT = 46;
// The city's own faces (the mock-ups' mix for the white and grey-blue city).
const MIX = [
  { style: "glass", pal: { mullion: "#9aa2a8", glass: "#6a7a86", glassHi: "#b0bec8", spandrel: "#7a8a96", roof: "#8a9096" }, minH: 1.5, maxH: 6 },
  { style: "punch", pal: { wall: "#dcdad4", glass: "#4e5e6a", glassHi: "#9aaab4", roof: "#b8b6b0" }, minH: 1.0, maxH: 4.5 },
  { style: "midmod", pal: { wall: "#c8ccd0", glass: "#3a4a56", glassHi: "#8a9aa6", panels: ["#c8ccd0", "#9aa8b2", "#c8ccd0", "#b0b8be"], roof: "#a8acb0" }, minH: 1.2, maxH: 4 },
  { style: "brutal", pal: { wall: "#a8a6a0", glass: "#2a3036", glassHi: "#56677a", roof: "#8a8882" }, minH: 0.8, maxH: 3 },
];
const GROUND = "#9a978e", STREET_C = "#3c3e41", LINE_C = "#d8d0c0";
const LEAVES = ["#5f7e4a", "#6a8a52", "#567446", "#728e58", "#4e6a3e"];

let seed = 9301;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];

/* The roofs' material, dissolving where they stand in the view as the
   facades do (planMaterial's see). */
function seeRoof(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFocus = FOCUS; shader.uniforms.uNight = PLAN_U.uNight;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeeP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSeeP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uFocus; uniform float uNight; varying vec3 vSeeP;\nfloat seeB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }\nfloat seeB4(vec2 a){ return seeB2(0.5 * a) * 0.25 + seeB2(a); }")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.42, uNight);")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        { vec3 seg = uFocus - cameraPosition; float L = length(seg); vec3 dir = seg / max(L, 1e-4); float t = dot(vSeeP - cameraPosition, dir);
          if (t > 0.0 && t < L - 1.5) { float d = length(vSeeP - (cameraPosition + dir * t)), r = 1.3 + 0.045 * t; if (seeB4(gl_FragCoord.xy) < smoothstep(r, r - 0.35, d)) discard; } }`);
  };
  mat.customProgramCacheKey = () => "ciudad-see-roof";
  return mat;
}

/* A tile of a style's facade: 6 bays by 12 floors, its windows' shapes
   beside it. */
function facadeTile(m, cell) {
  const c = cv(6 * cell, 12 * cell), x = c.getContext("2d"), mc = cv(6 * cell, 12 * cell), mm = mc.getContext("2d");
  mm.fillStyle = "#000"; mm.fillRect(0, 0, mc.width, mc.height);
  FACADE[m.style](x, mm, 6, 12, cell, cell, m.pal);
  const map = tex(c), mask = tex(mc);
  for (const t of [map, mask]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, mask };
}

export function buildCity({ EX, EZ, tier }) {
  seed = 9301;
  const group = new THREE.Group(); group.name = "ciudad-city";
  const owned = { geos: [], mats: [], texs: [] };
  const keepG = (g) => { owned.geos.push(g); return g; }, keepM = (m) => { owned.mats.push(m); return m; }, keepT = (t) => { owned.texs.push(t); return t; };
  const low = tier === "low";

  /* the plan: a street just off each edge of the board, then the grid out */
  const firstX = EX + 0.34, firstZ = EZ + 0.34;
  const lines = (first) => { const out = [first]; for (let a = first + PITCH; a < EXTENT; a += PITCH) out.push(a); return [...out.map((v) => -v).reverse(), ...out]; };
  const xs = lines(firstX), zs = lines(firstZ);
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i] + SW / 2, x1 = xs[i + 1] - SW / 2, z0 = zs[j] + SW / 2, z1 = zs[j + 1] - SW / 2;
    if (x0 < 0 && x1 > 0 && z0 < 0 && z1 > 0) continue; // the board
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const ring = Math.max(Math.abs(cx) - EX, Math.abs(cz) - EZ); // how far from the board's edge
    blocks.push({ x0, x1, z0, z1, cx, cz, ring, d: Math.hypot(cx, cz) });
  }
  // what each block is: by the board low things (so the board stays in
  // view), further out the city
  const LOTS = ["park", "plaza", "park", "parking", "lawn"];
  for (const b of blocks) {
    if (b.ring < 3.2) b.kind = rnd() < 0.62 ? pick(LOTS) : "low";
    else b.kind = rnd() < 0.86 ? "city" : pick(LOTS);
  }

  /* ---------------- the ground: streets, kerbs, crossings, lots, the lamps' pools */
  const GPX = low ? 10 : 16, GS = EXTENT * 2, GW = Math.round(GS * GPX);
  const gc = cv(GW, GW), g = gc.getContext("2d"), ec = cv(GW / 4, GW / 4), e = ec.getContext("2d");
  e.scale(0.25, 0.25);
  const U = (v) => (v + EXTENT) * GPX;
  g.fillStyle = STREET_C; g.fillRect(0, 0, GW, GW);
  { const a = new Path2D(), b2 = new Path2D(); for (let i = 0; i < GW * GW * 0.01; i++) (rnd() < 0.5 ? a : b2).rect(rnd() * GW, rnd() * GW, 2, 2); g.fillStyle = "rgba(255,255,255,0.04)"; g.fill(a); g.fillStyle = "rgba(0,0,0,0.12)"; g.fill(b2); }
  e.fillStyle = "#000"; e.fillRect(0, 0, GW, GW);
  const rect = (x0, z0, x1, z1) => [U(x0), U(z0), (x1 - x0) * GPX, (z1 - z0) * GPX];
  for (const b of blocks) {
    // the kerb, the walk, the block's own ground
    g.fillStyle = "#c4c2bc"; g.fillRect(...rect(b.x0, b.z0, b.x1, b.z1));
    g.fillStyle = GROUND; g.fillRect(...rect(b.x0 + 0.04, b.z0 + 0.04, b.x1 - 0.04, b.z1 - 0.04));
    if (b.kind === "park" || b.kind === "lawn") {
      g.fillStyle = "#86a06a"; g.fillRect(...rect(b.x0 + 0.2, b.z0 + 0.2, b.x1 - 0.2, b.z1 - 0.2));
      g.strokeStyle = "#d2c8ae"; g.lineWidth = Math.max(1.5, 0.08 * GPX); g.beginPath();
      if (b.kind === "park") { g.moveTo(U(b.x0 + 0.2), U(b.z1 - 0.6)); g.bezierCurveTo(U(b.cx), U(b.z1 - 0.8), U(b.cx), U(b.z0 + 0.8), U(b.x1 - 0.2), U(b.z0 + 0.6)); }
      else { g.moveTo(U(b.x0 + 0.2), U(b.cz)); g.lineTo(U(b.x1 - 0.2), U(b.cz)); }
      g.stroke();
      if (b.kind === "park") { g.fillStyle = "#7894a2"; g.beginPath(); g.ellipse(U(b.x0 + (b.x1 - b.x0) * 0.3), U(b.z0 + (b.z1 - b.z0) * 0.32), 0.38 * GPX, 0.24 * GPX, 0.3, 0, 7); g.fill(); }
    } else if (b.kind === "plaza") {
      g.fillStyle = "#d8ccb6"; g.fillRect(...rect(b.x0 + 0.1, b.z0 + 0.1, b.x1 - 0.1, b.z1 - 0.1));
      for (let r = 1.0, i = 0; r > 0.3; r -= 0.14, i++) { g.strokeStyle = i % 2 ? "#c0b298" : "#e6dcc8"; g.lineWidth = 0.07 * GPX; g.beginPath(); g.arc(U(b.cx), U(b.cz), r * GPX, 0, 7); g.stroke(); }
      g.fillStyle = "#7894a2"; g.beginPath(); g.arc(U(b.cx), U(b.cz), 0.24 * GPX, 0, 7); g.fill();
    } else if (b.kind === "parking") {
      g.fillStyle = "#4a4c50"; g.fillRect(...rect(b.x0 + 0.1, b.z0 + 0.1, b.x1 - 0.1, b.z1 - 0.1));
      g.strokeStyle = "rgba(232,228,220,0.8)"; g.lineWidth = 1;
      for (let x = b.x0 + 0.25; x < b.x1 - 0.2; x += 0.2) { g.beginPath(); g.moveTo(U(x), U(b.z0 + 0.15)); g.lineTo(U(x), U(b.z0 + 0.7)); g.moveTo(U(x), U(b.z1 - 0.7)); g.lineTo(U(x), U(b.z1 - 0.15)); g.stroke(); }
    }
  }
  // the board's own walk round its edge; the board's streets on out to the first street
  g.fillStyle = "#c4c2bc"; g.fillRect(...rect(-EX - 0.17, -EZ - 0.17, EX + 0.17, EZ + 0.17));
  // the dashed line down every street, the crossings by the board
  {
    const dashes = new Path2D(), lw = Math.max(1, 0.03 * GPX);
    for (const x of xs) for (let z = -EXTENT; z < EXTENT; z += 0.5) dashes.rect(U(x) - lw / 2, U(z), lw, 0.26 * GPX);
    for (const z of zs) for (let x = -EXTENT; x < EXTENT; x += 0.5) dashes.rect(U(x), U(z) - lw / 2, 0.26 * GPX, lw);
    g.fillStyle = LINE_C; g.globalAlpha = 0.55; g.fill(dashes); g.globalAlpha = 1;
    const zeb = new Path2D(), st = 0.05 * GPX;
    for (const x of xs) for (const z of zs) {
      if (Math.max(Math.abs(x) - EX, Math.abs(z) - EZ) > 9) continue;
      for (let k = -3; k <= 3; k++) {
        zeb.rect(U(x) + k * 0.1 * GPX - st / 2, U(z) - (SW / 2 + 0.22) * GPX, st, 0.16 * GPX); zeb.rect(U(x) + k * 0.1 * GPX - st / 2, U(z) + (SW / 2 + 0.06) * GPX, st, 0.16 * GPX);
        zeb.rect(U(x) - (SW / 2 + 0.22) * GPX, U(z) + k * 0.1 * GPX - st / 2, 0.16 * GPX, st); zeb.rect(U(x) + (SW / 2 + 0.06) * GPX, U(z) + k * 0.1 * GPX - st / 2, 0.16 * GPX, st);
      }
    }
    g.fillStyle = "#ddd6c6"; g.globalAlpha = 0.8; g.fill(zeb); g.globalAlpha = 1;
  }
  // the lamps: on the board's edge, on the corners near it
  const lamps = [...edgeLamps()];
  for (const x of xs) for (const z of zs) {
    const ring = Math.max(Math.abs(x) - EX, Math.abs(z) - EZ);
    if (ring > 14 || (ring > 6 && rnd() < 0.5)) continue;
    lamps.push([x + SW / 2 + 0.08, z + SW / 2 + 0.08]);
  }
  e.globalCompositeOperation = "lighter";
  for (const [x, z] of lamps) {
    const R = 1.1 * GPX, grd = e.createRadialGradient(U(x), U(z), 0, U(x), U(z), R);
    grd.addColorStop(0, "rgba(255,207,138,0.55)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    e.fillStyle = grd; e.fillRect(U(x) - R, U(z) - R, R * 2, R * 2);
  }
  e.globalCompositeOperation = "source-over";
  const groundMat = keepM(new THREE.MeshStandardMaterial({
    map: keepT(tex(gc)), roughness: 0.95, metalness: 0,
    emissive: new THREE.Color(0xffffff), emissiveMap: keepT(tex(ec)), emissiveIntensity: 1,
  }));
  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = PLAN_U.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.24, uNight);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight;");
  };
  groundMat.customProgramCacheKey = () => "ciudad-ground";
  farDim(groundMat); // (the lamps' pools fainter the farther off)
  const GY = -0.06;
  const ground = new THREE.Mesh(keepG(new THREE.PlaneGeometry(GS, GS)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = GY; ground.receiveShadow = true; ground.raycast = () => {}; ground.name = "ciudad-ground";
  group.add(ground);
  // the plain ground beyond, under the haze, so no edge ever shows
  const outerMat = keepM(new THREE.MeshStandardMaterial({ color: col("#6e6c66"), roughness: 1, metalness: 0 }));
  outerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = PLAN_U.uNight;
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uNight;").replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.2, uNight);");
  };
  outerMat.customProgramCacheKey = () => "ciudad-ground-out";
  const outer = new THREE.Mesh(keepG(new THREE.RingGeometry(EXTENT * 0.98, 260, 64, 1)), outerMat);
  outer.rotation.x = -Math.PI / 2; outer.position.y = GY - 0.01; outer.raycast = () => {};
  group.add(outer);

  /* ---------------- the buildings */
  const cell = low ? 20 : 32;
  const kinds = MIX.flatMap((m, mi) => [0, 1].map((v) => {
    const t = facadeTile(m, cell); keepT(t.map); keepT(t.mask);
    const isGlass = !!OFFICE[m.style];
    const mat = keepM(planMaterial(new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.mask, roughness: isGlass ? 0.3 : 0.85, metalness: isGlass ? 0.4 : 0.05 }), { kind: isGlass ? 0 : 1, pal: 2, see: true, dim: 0.62 }));
    return { m, mi, v, mat, s: sink() };
  }));
  const roofs = new Map(); // roof colour -> sink
  const roofSink = (c) => roofs.get(c) || roofs.set(c, sink()).get(c);
  const lots = []; // every building's footprint and height, for roofAt
  let bi = 0;
  const building = (x0, x1, z0, z1, h, k) => {
    const G = STYLE_GRID[k.m.style], s = k.s, sd = 50 + (bi++ % 900);
    const ou = Math.floor(rnd() * 6) / 6, ov = Math.floor(rnd() * 12) / 12, floors = Math.max(1, Math.round(h / G.floor)), H = floors * G.floor;
    const faces = [
      // +z, -z, +x, -x: corners counter-clockwise from outside, its length
      [[[x0, GY, z1], [x1, GY, z1], [x1, GY + H, z1], [x0, GY + H, z1]], [0, 0, 1], x1 - x0],
      [[[x1, GY, z0], [x0, GY, z0], [x0, GY + H, z0], [x1, GY + H, z0]], [0, 0, -1], x1 - x0],
      [[[x1, GY, z1], [x1, GY, z0], [x1, GY + H, z0], [x1, GY + H, z1]], [1, 0, 0], z1 - z0],
      [[[x0, GY, z0], [x0, GY, z1], [x0, GY + H, z1], [x0, GY + H, z0]], [-1, 0, 0], z1 - z0],
    ];
    faces.forEach(([P, n, L], fi) => {
      const bays = L / G.bay, n2 = Math.max(1, Math.floor(bays * G.units)), u0 = ou + fi * 0.37, u1 = u0 + bays / 6, v0 = ov, v1 = ov + floors / 12;
      quad(s, P, n, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [[0, floors, fi, n2], [bays * G.units, floors, fi, n2], [bays * G.units, 0, fi, n2], [0, 0, fi, n2]], sd);
    });
    // the roof, a coping round it
    const rs = roofSink(k.m.pal.roof), y = GY + H, c = 0.025, R = 1.2;
    quad(rs, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[x0 * R, z1 * R], [x1 * R, z1 * R], [x1 * R, z0 * R], [x0 * R, z0 * R]]);
    const cop = [[[x0 - c, y - 0.03, z1 + c], [x1 + c, y - 0.03, z1 + c], [x1 + c, y + 0.02, z1 + c], [x0 - c, y + 0.02, z1 + c], [0, 0, 1]],
      [[x1 + c, y - 0.03, z0 - c], [x0 - c, y - 0.03, z0 - c], [x0 - c, y + 0.02, z0 - c], [x1 + c, y + 0.02, z0 - c], [0, 0, -1]],
      [[x1 + c, y - 0.03, z1 + c], [x1 + c, y - 0.03, z0 - c], [x1 + c, y + 0.02, z0 - c], [x1 + c, y + 0.02, z1 + c], [1, 0, 0]],
      [[x0 - c, y - 0.03, z0 - c], [x0 - c, y - 0.03, z1 + c], [x0 - c, y + 0.02, z1 + c], [x0 - c, y + 0.02, z0 - c], [-1, 0, 0]]];
    for (const q of cop) quad(rs, q.slice(0, 4), q[4], [[0, 0], [0.1, 0], [0.1, 0.02], [0, 0.02]]);
    lots.push([x0, x1, z0, z1, H]);
  };
  const trees = []; // [x, z, size, colour]
  for (const b of blocks) {
    if (b.kind === "park" || b.kind === "lawn") {
      const n = b.kind === "park" ? (low ? 7 : 12) : 4;
      for (let i = 0; i < n * 3 && trees.length < 2000; i++) {
        const x = rr(b.x0 + 0.3, b.x1 - 0.3), z = rr(b.z0 + 0.3, b.z1 - 0.3);
        if (b.kind === "park" && Math.hypot((x - (b.x0 + (b.x1 - b.x0) * 0.3)) / 0.5, (z - (b.z0 + (b.z1 - b.z0) * 0.32)) / 0.36) < 1) continue;
        trees.push([x, z, rr(1.3, 2.0), pick(LEAVES)]);
        if (trees.filter((t) => t[0] >= b.x0 && t[0] <= b.x1 && t[1] >= b.z0 && t[1] <= b.z1).length >= n) break;
      }
      continue;
    }
    if (b.kind === "plaza" || b.kind === "parking") continue;
    // the block in lots, along its longer side; a building a lot
    const longX = (b.x1 - b.x0) >= (b.z1 - b.z0), n = b.kind === "low" ? 2 : rnd() < 0.35 ? 1 : rnd() < 0.6 ? 2 : 3;
    const inset = 0.1, gap = 0.08;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      let x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
      if (longX) { const a = x0, w = x1 - x0; x0 = a + w * t0 + (i ? gap / 2 : 0); x1 = a + w * t1 - (i < n - 1 ? gap / 2 : 0); }
      else { const a = z0, w = z1 - z0; z0 = a + w * t0 + (i ? gap / 2 : 0); z1 = a + w * t1 - (i < n - 1 ? gap / 2 : 0); }
      // now and then a lot set back, or a little smaller than its lot
      if (rnd() < 0.3) { const sx = (x1 - x0) * rr(0, 0.12), sz = (z1 - z0) * rr(0, 0.12); x0 += sx; x1 -= sx * 0.5; z0 += sz * 0.5; z1 -= sz; }
      const k = kinds[Math.floor(rnd() * kinds.length)], M = k.m;
      let h = rr(M.minH, M.maxH);
      if (b.kind === "low") h = Math.min(h, rr(0.6, 1.1));
      else if (b.d < 14) h *= 0.7;
      else if (b.d > 24) h *= rr(1, 1.35);
      building(x0, x1, z0, z1, h, k);
    }
  }
  for (const k of kinds) {
    if (!k.s.pos.length) continue;
    const m = new THREE.Mesh(keepG(geoOf(k.s)), k.mat); m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
    group.add(m);
  }
  for (const [c, s] of roofs) {
    // (fine grit, a seam now and then: the roofs seen from above read as roofs, not camouflage)
    const cc = cv(128, 128), x = cc.getContext("2d");
    x.fillStyle = c; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) { x.globalAlpha = rr(0.05, 0.14); x.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; x.fillRect(rnd() * 128, rnd() * 128, rr(1, 2.2), rr(1, 2.2)); }
    x.globalAlpha = 0.12; x.fillStyle = "#000"; for (let y = 0; y < 128; y += 43) x.fillRect(0, y, 128, 1); x.globalAlpha = 1;
    const t = keepT(tex(cc)); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(keepG(geoOf(s)), keepM(seeRoof(new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 }))));
    m.receiveShadow = true; m.castShadow = true; m.raycast = () => {};
    group.add(m);
  }
  // a coarse grid over them: each cell lists the buildings touching it
  const GC = 3, grid = new Map(), cellOf = (v) => Math.floor(v / GC);
  lots.forEach((L, i) => {
    for (let cx = cellOf(L[0] - 0.5); cx <= cellOf(L[1] + 0.5); cx++) for (let cz = cellOf(L[2] - 0.5); cz <= cellOf(L[3] + 0.5); cz++) {
      const k = cx + "," + cz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
    }
  });
  const roofAt = (x, z, pad = 0.35) => {
    const list = grid.get(cellOf(x) + "," + cellOf(z));
    let h = 0;
    if (list) for (const i of list) { const L = lots[i]; if (x > L[0] - pad && x < L[1] + pad && z > L[2] - pad && z < L[3] + pad && L[4] > h) h = L[4]; }
    return h;
  };

  /* ---------------- the parks' trees (instanced: trunks, crowns) */
  if (trees.length) {
    const trunkG = keepG(new THREE.CylinderGeometry(0.012, 0.018, 0.12, 6).translate(0, 0.06, 0));
    const crownG = keepG(new THREE.SphereGeometry(0.09, 10, 8).translate(0, 0.19, 0));
    const trunks = new THREE.InstancedMesh(trunkG, keepM(new THREE.MeshStandardMaterial({ color: col("#6a5440"), roughness: 0.9 })), trees.length);
    const crowns = new THREE.InstancedMesh(crownG, keepM(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 })), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    trees.forEach(([x, z, k, c], i) => {
      p.set(x, GY, z); s.set(k, k * rr(0.9, 1.2), k); m4.compose(p, q, s);
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, col(c));
    });
    for (const im of [trunks, crowns]) { im.castShadow = true; im.receiveShadow = true; im.raycast = () => {}; group.add(im); }
  }

  /* ---------------- the lamps: posts and heads (lit at night) */
  const postGeo = keepG(mergeParts([
    new THREE.CylinderGeometry(0.01, 0.015, 0.5, 6).translate(0, 0.25, 0),
    new THREE.BoxGeometry(0.09, 0.012, 0.016).translate(0.04, 0.5, 0),
    new THREE.BoxGeometry(0.05, 0.02, 0.03).translate(0.08, 0.495, 0),
  ]));
  const posts = new THREE.InstancedMesh(postGeo, keepM(new THREE.MeshStandardMaterial({ color: col("#3a3e44"), roughness: 0.5, metalness: 0.5 })), lamps.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  const heads = new Float32Array(lamps.length * 3);
  lamps.forEach(([x, z], i) => {
    // the arm out over the street from the corner (toward the board's own streets at the edge)
    const a = Math.atan2(-z, -x); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    p3.set(x, 0, z); m4.compose(p3, q, one); posts.setMatrixAt(i, m4);
    heads.set([x + Math.cos(a) * 0.08, 0.48, z + Math.sin(a) * 0.08], i * 3);
  });
  posts.castShadow = true; posts.raycast = () => {}; group.add(posts);
  const hg = keepG(new THREE.BufferGeometry()); hg.setAttribute("position", new THREE.BufferAttribute(heads, 3));
  const headMat = keepM(farDim(new THREE.PointsMaterial({ map: glowTex(), color: col("#ffd9a0"), size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), "a"));
  const headPts = new THREE.Points(hg, headMat); headPts.raycast = () => {}; headPts.visible = false; headPts.name = "ciudad-lamp-heads";
  group.add(headPts);

  return {
    group,
    roofAt,
    // the streets, for the traffic (ciudad-life.js): their middles each way, how wide, how far out
    streets: { xs, zs, SW, EXTENT, GY, blocks },
    night(n) { headMat.opacity = n; headPts.visible = n > 0.01; },
    tick() {},
    dispose() {
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose && o.dispose(); });
      owned.geos.forEach((q2) => q2.dispose()); owned.mats.forEach((q2) => q2.dispose()); owned.texs.forEach((q2) => q2.dispose());
    },
  };
}

function mergeParts(parts) {
  let n = 0; const nis = parts.map((p) => (p.index ? p.toNonIndexed() : p)); nis.forEach((p) => { n += p.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of nis) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; p.dispose(); }
  parts.forEach((p) => p.dispose());
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}
