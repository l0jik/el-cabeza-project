/* The store around the board.

   Scale: one board square is one unit, about 5 cm, so a foot is about
   6.1 units. The board sits on a display table in the center court,
   where the two main aisles cross; the court is kept clear far enough out
   that the camera, at its widest zoom, never reaches a shelf.

     x: west (-) to east (+); z: the back wall (-) to the front windows (+)
     center court |x|,|z| < 64; main aisles |z| < 40 and |x| < 40
     north-east  games and puzzles     north-west  toys
     south-east  records, tapes, TV    south-west  housewares
     front (z ~ 245) checkout lanes, one open; windows onto the lot
     back wall   customer service, layaway, rest rooms, a clock

   Lighting is baked, not computed: everything out here is unlit
   (MeshBasicMaterial) with its shading painted into vertex colours —
   brighter on top, darker toward the floor — which is how a room under
   a ceiling full of fluorescent tubes looks, and what keeps the store
   cheap enough for a phone. It also means the store looks the same from
   every side as the board turns (the chassis's lights stay fixed while
   the board group, and the store with it, rotates). Only the table and
   what's on it are lit like the board, so the board's shadow falls on
   them. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLAB_THICKNESS } from "../engine/constants.js";
import { quality } from "./tienda-quality.js";
import {
  rng, canvasTexture, repaint, floorTile, ceilingTile, troffer, glowSpot, shadowBlob, shadowStrip,
  boxAtlas, GAME_TILES, HOUSEWARE_TILES, shelfFace, shelfTop, signAtlas, deptSign, aisleSign, saleCard,
  wallTexture, lidPainter, tentCard, formicaWalnut, paintClock, paintTv, paintNight, text, SIGN_FONT, TYPE_FONT, SERIF,
} from "./tienda-textures.js";
import boxArtUrl from "../assets/tienda/box-art.jpg";
import adUrl from "../assets/tienda/ad-couple.jpg";

export const FT = 6.1;
export const TABLE_H = 15;
export const FLOOR = -SLAB_THICKNESS - TABLE_H;
export const CEIL = FLOOR + 82;
const XW = 430, ZB = 410, ZF = 300; // walls
const COURT = 64, AISLE = 40;
const GD = 20, GH = 33, SEC = 4 * FT, PITCH = GD + 34; // gondola depth/height, section length, run spacing

/* ------------------------------------------------------------ geometry helpers */

// Baked light: brighter on top, darker low down, a little less on the
// undersides, from the fixtures overhead.
function bake(geo, { k = 1, floorDark = 0.72, top = 1, side = 0.86, bottom = 0.6, tint = [1, 1, 1] } = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i), y = pos.getY(i);
    let v = ny > 0.5 ? top : ny < -0.5 ? bottom : side + 0.03 * nor.getZ(i) + 0.02 * nor.getX(i);
    const hgt = Math.max(0, Math.min(1, (y - FLOOR) / 26));
    if (ny <= 0.5) v *= floorDark + (1 - floorDark) * Math.sqrt(hgt);
    v *= k;
    cols[i * 3] = v * tint[0]; cols[i * 3 + 1] = v * tint[1]; cols[i * 3 + 2] = v * tint[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return geo;
}
// A vertical plane w x h, centred at (x, y, z), facing the direction ry
// (0 faces +z). uv scaled by (su, sv) and offset.
function vplane(w, h, x, y, z, ry, su = 1, sv = 1, ou = 0, ov = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  g.rotateY(ry); g.translate(x, y, z);
  return g;
}
function hplane(w, d, x, y, z, down = false, su = 1, sv = 1) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); g.translate(x, y, z);
  return g;
}
function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
function merge(list) {
  if (!list.length) return null;
  const g = BufferGeometryUtils.mergeBufferGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g;
}
// Unlit, baked, fogged: the store's standard material.
function flat(map, extra) {
  return new THREE.MeshBasicMaterial({ map: map || null, vertexColors: true, toneMapped: false, fog: true, ...extra });
}
function loadImage(url, onload) {
  const img = new Image();
  img.onload = onload;
  img.src = url;
  return img;
}

/* ------------------------------------------------------------ the store */

export function buildStore() {
  const q = quality();
  const group = new THREE.Group();
  group.name = "tienda-store";
  const disposables = [];
  const signTextures = []; // repainted when the fonts arrive
  const add = (geo, mat, name) => {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    m.matrixAutoUpdate = false; m.updateMatrix();
    group.add(m);
    disposables.push(geo, mat);
    return m;
  };

  /* ---- floor ---- */
  const tileMain = floorTile("#E2D9C4", ["#9C8E78", "#B8A58A", "#7D7466", "#C9B894", "#A56F4F"], 3);
  const tileAisle = floorTile("#CDBA96", ["#8C7458", "#A98B66", "#6F604E", "#E0D0AC"], 5);
  const repPer = 8 * FT;
  const floorW = XW * 2, floorD = ZB + ZF;
  add(bake(hplane(floorW, floorD, 0, FLOOR, (ZF - ZB) / 2, false, floorW / repPer, floorD / repPer), { top: 0.96 }), flat(tileMain), "tienda-floor");
  // The main aisles' "racetrack": a tan tile band, a hair above the floor.
  const aisleMat = flat(tileAisle, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  add(merge([
    bake(hplane(floorW, AISLE * 2, 0, FLOOR, 0, false, floorW / repPer, (AISLE * 2) / repPer), { top: 0.96 }),
    bake(hplane(AISLE * 2, floorD, 0, FLOOR, (ZF - ZB) / 2, false, (AISLE * 2) / repPer, floorD / repPer), { top: 0.96 }),
  ]), aisleMat);
  disposables.push(tileMain, tileAisle);

  /* ---- ceiling, troffers, and their sheen on the waxed floor ---- */
  const ctile = ceilingTile();
  add(bake(hplane(floorW, floorD, 0, CEIL, (ZF - ZB) / 2, true, floorW / (8 * FT), floorD / (8 * FT)), { bottom: 0.9 }), flat(ctile), "tienda-ceiling");
  disposables.push(ctile);
  const trofTex = troffer(), spotTex = glowSpot();
  const trofGeo = new THREE.PlaneGeometry(4 * FT, 2 * FT); trofGeo.rotateX(Math.PI / 2);
  const cellsX = [], cellsZ = [];
  for (let x = -XW + 26; x < XW - 20; x += 6 * FT) cellsX.push(x);
  for (let z = -ZB + 26; z < ZF - 20; z += 8 * FT) cellsZ.push(z);
  const nT = cellsX.length * cellsZ.length;
  const trofMat = new THREE.MeshBasicMaterial({ map: trofTex, toneMapped: false, fog: true });
  const troffers = new THREE.InstancedMesh(trofGeo, trofMat, nT);
  troffers.name = "tienda-troffers";
  const sheenGeo = new THREE.PlaneGeometry(4 * FT * 1.1, 2 * FT * 2.6); sheenGeo.rotateX(-Math.PI / 2);
  const sheenMat = new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const sheen = new THREE.InstancedMesh(sheenGeo, sheenMat, nT);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const r = rng(17);
  let flickerIndex = 0, bestFlicker = Infinity;
  let i = 0;
  const trofBase = [];
  cellsZ.forEach((z) => cellsX.forEach((x) => {
    m4.makeTranslation(x, CEIL - 0.2, z);
    troffers.setMatrixAt(i, m4);
    m4.makeTranslation(x, FLOOR + 0.02, z);
    sheen.setMatrixAt(i, m4);
    // Tubes age differently: some a touch warmer, some greener, some dim.
    const k = 0.93 + r() * 0.07;
    col.setRGB(k * (0.98 + r() * 0.02), k, k * (0.93 + r() * 0.05));
    // One burned-out fixture, and one flickering one near the court,
    // up ahead of the default view.
    const dFlick = Math.hypot(x - 38, z + 62);
    if (dFlick < bestFlicker) { bestFlicker = dFlick; flickerIndex = i; }
    if (Math.abs(x + 122) < 18 && Math.abs(z + 110) < 24) col.setRGB(0.5, 0.5, 0.47);
    troffers.setColorAt(i, col); sheen.setColorAt(i, col);
    trofBase.push(col.clone());
    i++;
  }));
  troffers.instanceMatrix.needsUpdate = true;
  troffers.frustumCulled = false; sheen.frustumCulled = false;
  group.add(troffers, sheen);
  disposables.push(trofGeo, trofMat, sheenGeo, sheenMat, trofTex, spotTex);

  // A water-stained tile and a missing one, over toward the back.
  const stain = canvasTexture(64, 128, (g, W, H) => {
    const rg = g.createRadialGradient(W * 0.5, H * 0.55, 2, W * 0.5, H * 0.55, W * 0.5);
    rg.addColorStop(0, "rgba(150,110,60,0.22)"); rg.addColorStop(0.8, "rgba(150,110,60,0.3)"); rg.addColorStop(0.95, "rgba(120,85,45,0.45)"); rg.addColorStop(1, "rgba(120,85,45,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }, { scale: false });
  add(hplane(2 * FT, 4 * FT, -64, CEIL - 0.08, -140, true), new THREE.MeshBasicMaterial({ map: stain, transparent: true, depthWrite: false, toneMapped: false, fog: true }));
  add(hplane(2 * FT * 0.96, 4 * FT * 0.98, 170, CEIL - 0.08, -214, true), new THREE.MeshBasicMaterial({ color: 0x15130f, toneMapped: false, fog: true }));
  disposables.push(stain);

  /* ---- shelving runs ---- */
  const DEPTS = {
    ne: { dept: "games", sign: ["GAMES · PUZZLES", "HOBBY · CRAFT"], tiles: GAME_TILES },
    nw: { dept: "toys", sign: ["TOYS", "DOLLS · TRUCKS · BIKES"], tiles: GAME_TILES },
    se: { dept: "records", sign: ["RECORDS · TAPES", "TELEVISION · RADIO"], tiles: GAME_TILES },
    sw: { dept: "housewares", sign: ["HOUSEWARES", "SMALL APPLIANCES"], tiles: HOUSEWARE_TILES },
  };
  const faces = {}, faceGeos = {}, topGeos = [], endGeos = [], stripGeos = [];
  Object.values(DEPTS).forEach((d, k) => { if (!faces[d.dept]) { faces[d.dept] = shelfFace(d.dept, 40 + k * 13); faceGeos[d.dept] = []; } });
  const endcaps = []; // { x, z, facing (+1/-1 along z), dept, dist }
  const aisleSpots = []; // { x, z, facing, quadrant }
  const maxRuns = q.detail === 0 ? 4 : 7;
  const quadrants = [["ne", 1, -1], ["nw", -1, -1], ["se", 1, 1], ["sw", -1, 1]];
  quadrants.forEach(([key, sx, sz]) => {
    const d = DEPTS[key];
    for (let k = 0; k < maxRuns; k++) {
      const cx = sx * (AISLE + GD / 2 + k * PITCH);
      if (Math.abs(cx) + GD / 2 > XW - 40) break;
      const zStart = sz * (Math.abs(cx) - GD / 2 < COURT ? COURT + 8 : AISLE + 8);
      const zLimit = sz < 0 ? ZB - 46 : 212;
      let z0 = Math.abs(zStart);
      let seg = 0;
      while (z0 < zLimit - SEC) {
        const n = Math.min(sz < 0 ? 6 : 6, Math.floor((zLimit - z0) / SEC));
        if (n < 2) break;
        const L = n * SEC, zc = sz * (z0 + L / 2);
        const ou = ((k * 7 + seg * 3) % 3) / 3;
        const su = L / (3 * SEC);
        faceGeos[d.dept].push(
          bake(vplane(L, GH, cx + GD / 2, FLOOR + GH / 2, zc, Math.PI / 2, su, 1, ou)),
          bake(vplane(L, GH, cx - GD / 2, FLOOR + GH / 2, zc, -Math.PI / 2, su, 1, ou + 1 / 3)),
        );
        topGeos.push(bake(hplane(GD, L, cx, FLOOR + GH, zc, false, 1, L / 40), { top: 0.9 }));
        // Ends: the endcap's back panel (pegboard, a sign strip).
        endGeos.push(bake(vplane(GD, GH, cx, FLOOR + GH / 2, sz * z0, sz < 0 ? 0 : Math.PI)), bake(vplane(GD, GH, cx, FLOOR + GH / 2, sz * (z0 + L), sz < 0 ? Math.PI : 0)));
        stripGeos.push(hplane(GD + 9, L + 9, cx, FLOOR + 0.05, zc, false));
        endcaps.push({ x: cx, z: sz * z0, facing: -sz, dept: d, dist: Math.hypot(cx, z0) });
        endcaps.push({ x: cx, z: sz * (z0 + L), facing: sz, dept: d, dist: Math.hypot(cx, z0 + L) });
        z0 += L + 36;
        seg++;
      }
      // The aisle between this run and the next, where it meets the main aisle.
      aisleSpots.push({ x: cx + sx * PITCH / 2, z: sz * (AISLE + 4), facing: -sz, quadrant: key, k });
    }
  });
  Object.keys(faceGeos).forEach((dept) => { add(merge(faceGeos[dept]), flat(faces[dept])); disposables.push(faces[dept]); });
  const topTex = shelfTop();
  add(merge(topGeos), flat(topTex)); disposables.push(topTex);
  const endTex = canvasTexture(128, 256, (g, W, H) => {
    g.fillStyle = "#CFC4AA"; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(70,60,45,0.35)";
    for (let x = 4; x < W; x += 8) for (let y = 4; y < H; y += 8) g.fillRect(x, y, 1.4, 1.4);
    g.fillStyle = "#4A3A2C"; g.fillRect(0, H * 0.93, W, H * 0.07);
    g.fillStyle = "#A9A08E"; g.fillRect(0, 0, W * 0.05, H); g.fillRect(W * 0.95, 0, W * 0.05, H);
  });
  add(merge(endGeos), flat(endTex)); disposables.push(endTex);
  const stripTex = shadowStrip();
  add(merge(stripGeos), new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }));
  disposables.push(stripTex);

  /* ---- goods on the endcaps: instanced boxes from the box atlas ---- */
  const atlas = boxAtlas();
  signTextures.push(atlas);
  disposables.push(atlas);
  const productGeo = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv;
    // Faces: 0 +x, 1 -x (sides), 2 +y, 3 -y (top/bottom), 4 +z, 5 -z (front/back).
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v, u0 = uv.getX(i), v0 = uv.getY(i);
      if (f >= 4) uv.setXY(i, u0, 0.38 + v0 * 0.62);
      else if (f >= 2) uv.setXY(i, u0, v0 * 0.38);
      else uv.setXY(i, u0 * 0.08, 0.38 + v0 * 0.62);
    }
    return bake(g, { floorDark: 1, side: 0.84 });
  })();
  const productMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false, fog: true });
  productMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aTile;")
      .replace("#include <uv_vertex>", "#ifdef USE_UV\n vUv = uv * 0.25 + aTile;\n#endif");
  };
  const products = [];
  const shelfGeos = [];
  const place = (x, y, z, w, h, d, ry, tile, bright = 1) => {
    if (tile < 0) shelfGeos.push(bake(box(w, h, d, x, y, z, ry), { floorDark: 1, tint: [0.72, 0.69, 0.62] }));
    else products.push({ x, y, z, w, h, d, ry, tile, bright });
  };
  // Records stand in the racks as sleeves: the plain cream box front,
  // tinted, reads as an album cover at this distance.
  const SLEEVE = ["#2F4F5E", "#A33F33", "#D3A13B", "#6B7536", "#C0632C", "#5A2E4A", "#EFE4CB", "#7D95A6"];
  const nearCaps = endcaps.filter((e) => e.dist < (q.detail === 0 ? 170 : q.detail === 1 ? 260 : 340));
  const rr = rng(23);
  nearCaps.forEach((e) => {
    if (e.dept.dept === "records" && Math.abs(e.x) < AISLE + GD && e.facing < 0) return; // the TV display goes here
    const ry = e.facing > 0 ? 0 : Math.PI;
    const front = e.z + e.facing * 1.5;
    [4, 12, 20, 28].forEach((sy, si) => {
      // Shelf board.
      place(e.x, FLOOR + sy - 0.4, front + e.facing * 2.2, GD - 1, 0.6, 5.2, ry, -1, 0.8);
      const tiles = e.dept.tiles;
      if (e.dept.dept === "records") {
        for (let c = 0; c < 14; c++) products.push({ x: e.x - GD / 2 + 1.4 + c * 1.3, y: FLOOR + sy + 3.3, z: front + e.facing * 2.4, w: 0.3, h: 6.2, d: 6.2, ry: ry + Math.PI / 2 + (rr() - 0.5) * 0.15, tile: 9, tint: SLEEVE[Math.floor(rr() * SLEEVE.length)] });
      } else if (e.dept.dept === "housewares") {
        for (let c = 0; c < 3; c++) {
          const t = tiles[Math.floor(rr() * tiles.length)];
          place(e.x - GD / 2 + 3.6 + c * 6.2, FLOOR + sy + 3.3, front + e.facing * 2.4, 5.6, 6.6, 4.6, ry, t);
        }
      } else {
        const t = tiles[Math.floor(rr() * tiles.length)];
        for (let c = 0; c < 2; c++) {
          const stack = 2 + Math.floor(rr() * 3);
          for (let s = 0; s < stack; s++) place(e.x - GD / 4 + c * GD / 2, FLOOR + sy + 0.75 + s * 1.5, front + e.facing * 2.3, GD / 2 - 1, 1.45, 5, ry + (rr() - 0.5) * 0.06, si === 0 && c === 1 ? tiles[Math.floor(rr() * tiles.length)] : t);
        }
      }
    });
  });
  /* ---- sale displays down the middle of the main aisles ---- */
  // A pallet stacked with shipping cartons, a sale card on a stick. The
  // aisles run a long way; there are only a few of these, spaced out.
  const kraft = canvasTexture(128, 128, (g, W2) => {
    const r2 = rng(61);
    g.fillStyle = "#B08A5A"; g.fillRect(0, 0, W2, W2);
    for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(90,62,35,${0.05 + r2() * 0.08})`; g.fillRect(r2() * W2, r2() * W2, 20 + r2() * 40, 1); }
    g.fillStyle = "rgba(70,45,25,0.8)"; g.fillRect(W2 * 0.18, W2 * 0.4, W2 * 0.64, W2 * 0.08); g.fillRect(W2 * 0.3, W2 * 0.55, W2 * 0.4, W2 * 0.05);
    g.fillStyle = "rgba(60,40,22,0.35)"; g.fillRect(0, W2 * 0.46, W2, W2 * 0.06);
  }, { scale: false });
  disposables.push(kraft);
  const cartonGeos = [], palletGeos = [];
  const displays = [];
  [[0, -104], [0, -196], [0, 118], [118, 0], [-118, 0], [214, 0], [-214, 0], [0, -300]].forEach(([x, z], n) => {
    if (q.detail === 0 && n > 3) return;
    displays.push({ x, z, n });
    palletGeos.push(bake(box(13, 1.4, 13, x, FLOOR + 0.7, z), { tint: [0.62, 0.5, 0.36] }));
    const rows = 2 + (n % 2);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < rows; c++) {
      if (c === rows - 1 && a + b === 2 && n % 3 === 0) continue; // one carton gone
      cartonGeos.push(bake(box(6, 5, 6, x - 3.1 + a * 6.2 + (rr() - 0.5) * 0.4, FLOOR + 1.4 + 2.5 + c * 5.05, z - 3.1 + b * 6.2 + (rr() - 0.5) * 0.4, (rr() - 0.5) * 0.08), { floorDark: 0.85 }));
    }
  });
  add(merge(palletGeos), flat(null));
  add(merge(cartonGeos), flat(kraft));
  // The ball bin, the table's lower shelf and the court's stacks are added below.
  const courtExtras = [];

  /* ---- signs, all in one atlas ---- */
  const signs = [];
  const S = (w, h, paint) => { signs.push({ w, h, paint }); return signs.length - 1; };
  const deptColors = { ne: ["#B7572B", "#F1E6CE"], nw: ["#8E3A2E", "#F2E7D0"], se: ["#4F6F7A", "#F0E8D2"], sw: ["#6E7A3E", "#EFE5C8"] };
  const deptSignIdx = {};
  Object.entries(DEPTS).forEach(([key, d]) => { deptSignIdx[key] = S(512, 128, deptSign(d.sign[0], d.sign[1], deptColors[key][0], deptColors[key][1])); });
  const AISLE_LINES = {
    ne: [["BOARD GAMES", "PUZZLES · CARDS"], ["HOBBY KITS", "MODELS · PAINT"], ["CRAFTS", "YARN · FELT"], ["PARTY GOODS", "GIFT WRAP"], ["BOOKS", "COLORING BOOKS"], ["SEASONAL", ""], ["STATIONERY", "SCHOOL SUPPLIES"]],
    nw: [["DOLLS", "DOLL CLOTHES"], ["TRUCKS · CARS", "TRACK SETS"], ["OUTDOOR TOYS", "BALLS · BATS"], ["PRESCHOOL", "BLOCKS"], ["BIKES", "WAGONS"], ["TOY GUNS · CAPS", ""], ["BABY", "INFANTS' WEAR"]],
    se: [["RECORDS", "LP · 45"], ["8-TRACK TAPES", "CASSETTES"], ["RADIOS", "PHONOGRAPHS"], ["TELEVISION", "ANTENNAS"], ["CAMERAS", "FILM · FLASH"], ["CALCULATORS", "BATTERIES"], ["CLOCKS", "WATCHES"]],
    sw: [["SMALL APPLIANCES", ""], ["COOKWARE", "BAKEWARE"], ["GLASSWARE", "DISHES"], ["TABLE LINENS", "TOWELS"], ["CLEANING", "MOPS · PAILS"], ["STORAGE", "PLASTICWARE"], ["LAMPS", "LIGHT BULBS"]],
  };
  const aisleNum = { nw: 1, ne: 8, sw: 15, se: 22 };
  const aisleSignIdx = aisleSpots.map((a) => S(256, 128, aisleSign(aisleNum[a.quadrant] + a.k, (AISLE_LINES[a.quadrant][a.k] || ["", ""]).filter(Boolean))));
  const saleIdx = [
    S(256, 192, saleCard("SALE", "97¢", "Rubber balls · all sizes")),
    S(256, 192, saleCard("SPECIAL", "$3.97", "LP records · this week", "#4F6B78")),
    S(256, 192, saleCard("SAVE", "2 for $5", "Board games · selected", "#9C4A26")),
    S(256, 192, saleCard("NEW!", "$7.97", "El Cabeza · Aisle 9", "#3B2618")),
  ];
  const laneIdx = [];
  for (let n = 1; n <= 8; n++) laneIdx.push(S(64, 64, (g, w, h) => {
    const open = n === 3;
    g.fillStyle = open ? "#F4EEDC" : "#6E675C"; g.fillRect(0, 0, w, h);
    text(g, String(n), w / 2, h * 0.54, { font: SIGN_FONT, size: h * 0.7, weight: 800, color: open ? "#A33F33" : "#3A352E" });
  }));
  const exitIdx = S(128, 48, (g, w, h) => { g.fillStyle = "#2A2420"; g.fillRect(0, 0, w, h); text(g, "EXIT", w / 2, h * 0.55, { font: SIGN_FONT, size: h * 0.7, weight: 800, color: "#E0483A", spacing: 0.12 }); });
  const svcIdx = S(512, 96, deptSign("CUSTOMER SERVICE", "LAYAWAY · CREDIT · RETURNS", "#5A3E2B", "#E9C46A"));
  const thanksIdx = S(512, 64, (g, w, h) => { g.fillStyle = "#EFE8D6"; g.fillRect(0, 0, w, h); text(g, "THANK YOU — PLEASE COME AGAIN", w / 2, h * 0.55, { font: SIGN_FONT, size: h * 0.5, weight: 800, color: "#3B2618", spacing: 0.08, maxWidth: w * 0.94 }); });
  const hoursIdx = S(192, 160, (g, w, h) => {
    g.fillStyle = "#F4EEDC"; g.fillRect(0, 0, w, h);
    text(g, "STORE HOURS", w / 2, h * 0.14, { font: SIGN_FONT, size: h * 0.12, weight: 800, color: "#3B2618", spacing: 0.1 });
    ["Mon – Fri  9:30 – 9:30", "Saturday  9:30 – 9:30", "Sunday  12:00 – 6:00"].forEach((l, j) => text(g, l, w / 2, h * (0.4 + j * 0.18), { font: TYPE_FONT, size: h * 0.1, weight: 700, color: "#3B2618", maxWidth: w * 0.9 }));
  });
  const vendIdx = S(128, 256, (g, w, h) => {
    g.fillStyle = "#A8322A"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#F4EEDC"; g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.3);
    text(g, "ICE COLD", w / 2, h * 0.14, { font: SIGN_FONT, size: h * 0.07, weight: 900, color: "#A8322A", spacing: 0.1 });
    text(g, "Soft Drinks", w / 2, h * 0.27, { font: SERIF, size: h * 0.075, weight: 700, color: "#3B2618", italic: true });
    for (let j = 0; j < 6; j++) { g.fillStyle = ["#6B2A22", "#D3A13B", "#6B7536", "#2F4F5E", "#C0632C", "#5A3E2B"][j]; g.fillRect(w * 0.12, h * (0.42 + j * 0.07), w * 0.5, h * 0.05); g.fillStyle = "#D8D2C4"; g.fillRect(w * 0.68, h * (0.42 + j * 0.07), w * 0.18, h * 0.05); }
    text(g, "25¢", w * 0.5, h * 0.9, { font: SIGN_FONT, size: h * 0.08, weight: 800, color: "#F4EEDC" });
  });
  const standeeIdx = S(256, 128, (g, w, h) => {
    g.fillStyle = "#EFE4CB"; g.fillRect(0, 0, w, h);
    text(g, "NOW IN STOCK", w / 2, h * 0.3, { font: SIGN_FONT, size: h * 0.2, weight: 800, color: "#A33F33", spacing: 0.12 });
    text(g, "Games Dept. · Aisle 9", w / 2, h * 0.68, { font: TYPE_FONT, size: h * 0.16, weight: 700, color: "#3B2618" });
  });
  const { tex: atlasTex, uv: signUv } = signAtlas(signs, 2048);
  signTextures.push(atlasTex);
  disposables.push(atlasTex);
  const signGeos = [];
  // A sign mesh: a plane mapped to its atlas rectangle; double-sided signs
  // are two planes back to back, both reading forwards.
  const signPlane = (idx, w, h, x, y, z, ry, both = false, k = 1) => {
    const u = signUv[idx];
    const mk = (rot) => {
      const g = vplane(w, h, 0, 0, 0, 0);
      const uv = g.attributes.uv;
      for (let n = 0; n < uv.count; n++) uv.setXY(n, u.u0 + uv.getX(n) * (u.u1 - u.u0), u.v0 + uv.getY(n) * (u.v1 - u.v0));
      g.rotateY(rot); g.translate(x, y, z);
      return bake(g, { floorDark: 1, side: 0.95 * k });
    };
    signGeos.push(mk(ry));
    if (both) signGeos.push(mk(ry + Math.PI));
  };
  const rodGeos = [];
  const hang = (x, y, z, w, h, ry) => {
    const dx = Math.cos(ry) * w * 0.4, dz = -Math.sin(ry) * w * 0.4;
    [-1, 1].forEach((s) => rodGeos.push(bake(box(0.25, CEIL - (y + h / 2), 0.25, x + s * dx, (CEIL + y + h / 2) / 2, z + s * dz), { floorDark: 1 })));
  };
  // Department signs over the court's corners, facing the table.
  Object.entries(DEPTS).forEach(([key]) => {
    const [, sx, sz] = quadrants.find((qq) => qq[0] === key);
    const x = sx * 92, z = sz * 92, y = FLOOR + 60, ry = Math.atan2(-x, -z);
    signPlane(deptSignIdx[key], 64, 16, x, y, z, ry, true);
    hang(x, y, z, 64, 16, ry);
  });
  // Aisle markers where each aisle meets the main aisle.
  aisleSpots.forEach((a, n) => {
    if (Math.abs(a.x) > XW - 30) return;
    const ry = a.facing > 0 ? 0 : Math.PI, y = FLOOR + 55;
    signPlane(aisleSignIdx[n], 20, 10, a.x, y, a.z, ry, true);
    hang(a.x, y, a.z, 20, 10, ry);
  });

  /* ---- walls ---- */
  const H = CEIL - FLOOR;
  const backWall = wallTexture(XW * 2, H, {
    extras(g, W, Ht, u) {
      const X = (x) => (x + XW) * u, Y = (y) => Ht - (y - FLOOR) * u;
      // Service counter window and its surround.
      g.fillStyle = "#6B5440"; g.fillRect(X(-66), Y(FLOOR + 42), 132 * u, 30 * u);
      g.fillStyle = "#2B2621"; g.fillRect(X(-60), Y(FLOOR + 40), 120 * u, 24 * u);
      g.fillStyle = "rgba(230,225,205,0.18)"; g.fillRect(X(-58), Y(FLOOR + 38), 116 * u, 20 * u);
      // Double doors to the stock room, with their small windows.
      [150, 170].forEach((x) => {
        g.fillStyle = "#8E806A"; g.fillRect(X(x - 9.5), Y(FLOOR + 42), 19 * u, 42 * u);
        g.fillStyle = "#2B2621"; g.fillRect(X(x - 3), Y(FLOOR + 33), 6 * u, 6 * u);
        g.fillStyle = "#B8AE9C"; g.fillRect(X(x - 7), Y(FLOOR + 21), 14 * u, 1.2 * u);
      });
      text(g, "EMPLOYEES ONLY", X(160), Y(FLOOR + 47), { font: SIGN_FONT, size: 3 * u, weight: 800, color: "#5A3E2B", spacing: 0.1 });
      // Rest rooms down a short hall; the drinking fountain.
      g.fillStyle = "#3A342D"; g.fillRect(X(-190), Y(FLOOR + 44), 26 * u, 44 * u);
      text(g, "REST ROOMS  →", X(-177), Y(FLOOR + 50), { font: SIGN_FONT, size: 3.2 * u, weight: 800, color: "#3B2618", spacing: 0.08 });
      g.fillStyle = "#C9C3B6"; g.fillRect(X(-150), Y(FLOOR + 17), 9 * u, 6 * u);
      g.fillStyle = "#9A948A"; g.fillRect(X(-149), Y(FLOOR + 11), 7 * u, 11 * u);
      // Pay phone.
      g.fillStyle = "#5C6166"; g.fillRect(X(-100), Y(FLOOR + 34), 8 * u, 14 * u);
      g.fillStyle = "#1E1E1E"; g.fillRect(X(-98), Y(FLOOR + 31), 2 * u, 8 * u);
      text(g, "TELEPHONE", X(-96), Y(FLOOR + 38), { font: SIGN_FONT, size: 1.6 * u, weight: 800, color: "#F2ECDD" });
      // Big painted letters along the top.
      text(g, "LAYAWAY", X(-300), Y(FLOOR + 62), { font: SIGN_FONT, size: 9 * u, weight: 800, color: "#7A5230", spacing: 0.14 });
      text(g, "CATALOG DESK", X(300), Y(FLOOR + 62), { font: SIGN_FONT, size: 9 * u, weight: 800, color: "#7A5230", spacing: 0.14 });
    },
  });
  const frontWall = wallTexture(XW * 2, H, {
    paint: "#D6CCB4",
    extras(g, W, Ht, u) {
      const X = (x) => (x + XW) * u, Y = (y) => Ht - (y - FLOOR) * u;
      const win = document.createElement("canvas"); win.width = 2048; win.height = 256;
      paintNight(win.getContext("2d"), 2048, 256);
      g.drawImage(win, 0, 0, win.width, win.height, 0, Y(FLOOR + 50), W, 46 * u);
      // Mullions.
      g.fillStyle = "#9A9486";
      for (let x = -XW; x <= XW; x += 30) g.fillRect(X(x) - 0.7 * u, Y(FLOOR + 50), 1.4 * u, 46 * u);
      g.fillRect(0, Y(FLOOR + 50), W, 1.6 * u); g.fillRect(0, Y(FLOOR + 5), W, 1.6 * u);
      // Doors.
      [-70, 70].forEach((x) => {
        g.fillStyle = "rgba(40,45,55,0.9)"; g.fillRect(X(x - 18), Y(FLOOR + 44), 36 * u, 44 * u);
        g.fillStyle = "#B8B2A4"; g.fillRect(X(x - 18), Y(FLOOR + 24), 36 * u, 1.5 * u); g.fillRect(X(x) - 0.8 * u, Y(FLOOR + 44), 1.6 * u, 44 * u);
      });
    },
  });
  const sideWall = (letters, seed) => wallTexture(ZB + ZF, H, {
    paint: seed ? "#D4C8AC" : "#DACEB3",
    extras(g, W, Ht, u) {
      letters.forEach(([word, at]) => text(g, word, at * u, Ht - 62 * u, { font: SIGN_FONT, size: 9 * u, weight: 800, color: "#7A5230", spacing: 0.16 }));
      // Wall shelving under the letters.
      g.fillStyle = "#B4A98F"; g.fillRect(0, Ht - 36 * u, W, 34 * u);
      const rr2 = rng(seed + 3);
      for (let x = 0; x < W; x += 3 * u + rr2() * 5 * u) { g.fillStyle = ["#6B7536", "#9C4A26", "#D3A13B", "#5A3E2B", "#7D95A6", "#EFE4CB"][Math.floor(rr2() * 6)]; g.fillRect(x, Ht - (30 - rr2() * 4) * u, 2.6 * u, (8 + rr2() * 6) * u); g.fillRect(x, Ht - (16 - rr2() * 3) * u, 2.6 * u, (8 + rr2() * 5) * u); }
      g.fillStyle = "#8E8472"; g.fillRect(0, Ht - 20 * u, W, 1.2 * u); g.fillRect(0, Ht - 34 * u, W, 1.2 * u);
    },
  });
  const eastWall = sideWall([["SPORTING GOODS", 180], ["AUTOMOTIVE", 430], ["HARDWARE · PAINT", 620]], 1);
  const westWall = sideWall([["FABRICS · NOTIONS", 120], ["APPAREL", 360], ["SHOES", 560]], 0);
  [backWall, frontWall, eastWall, westWall].forEach((t) => signTextures.push(t));
  const wallMat = (t) => flat(t);
  const wall = (t, w, x, z, ry) => {
    const vs = t.userData.vSpan;
    add(bake(vplane(w, H, x, FLOOR + H / 2, z, ry, 1, vs, 0, 1 - vs)), wallMat(t));
  };
  wall(backWall, XW * 2, 0, -ZB, 0);
  wall(frontWall, XW * 2, 0, ZF, Math.PI);
  wall(eastWall, ZB + ZF, XW, (ZF - ZB) / 2, -Math.PI / 2);
  wall(westWall, ZB + ZF, -XW, (ZF - ZB) / 2, Math.PI / 2);
  disposables.push(backWall, frontWall, eastWall, westWall);
  signPlane(svcIdx, 120, 22, 0, FLOOR + 68, -ZB + 0.6, 0);
  signPlane(thanksIdx, 120, 15, 0, FLOOR + 62, ZF - 0.6, Math.PI);
  signPlane(exitIdx, 12, 4.5, -70, FLOOR + 50, ZF - 0.8, Math.PI);
  signPlane(exitIdx, 12, 4.5, 70, FLOOR + 50, ZF - 0.8, Math.PI);
  signPlane(hoursIdx, 12, 10, -96, FLOOR + 30, ZF - 0.8, Math.PI);

  /* ---- the service counter, the soda machine, the checkout lanes ---- */
  const fixGeos = [], darkGeos = [], metalGeos = [];
  fixGeos.push(bake(box(128, 17, 10, 0, FLOOR + 8.5, -ZB + 6), { tint: [0.62, 0.5, 0.4] }));
  fixGeos.push(bake(box(130, 1.2, 12, 0, FLOOR + 17.6, -ZB + 6), { tint: [0.84, 0.78, 0.66] }));
  // Soda machine: a red cabinet with its lit front from the sign atlas.
  darkGeos.push(bake(box(18, 36, 14, -122, FLOOR + 18, -ZB + 8), { tint: [0.66, 0.2, 0.17] }));
  signPlane(vendIdx, 16, 32, -122, FLOOR + 19, -ZB + 15.1, 0, false, 1.08);
  // Lanes: counter, register, a light pole with the lane number.
  for (let n = 0; n < 8; n++) {
    const x = -154 + n * 44, zc = 244;
    fixGeos.push(bake(box(9, 16, 34, x, FLOOR + 8, zc), { tint: [0.6, 0.47, 0.36] }));
    fixGeos.push(bake(box(9.6, 1, 35, x, FLOOR + 16.4, zc), { tint: [0.86, 0.8, 0.66] }));
    metalGeos.push(bake(box(8, 5.5, 7, x, FLOOR + 19.8, zc + 10), { tint: [0.8, 0.78, 0.72] }));
    metalGeos.push(bake(box(8, 2.5, 5, x, FLOOR + 23.4, zc + 9), { tint: [0.7, 0.69, 0.64] }));
    // Candy and gum rack at the lane's end.
    darkGeos.push(bake(box(8, 14, 3, x + 8, FLOOR + 7, zc - 12), { tint: [0.5, 0.42, 0.34] }));
    metalGeos.push(bake(box(0.6, 42, 0.6, x - 5.2, FLOOR + 21, zc + 17), { tint: [0.75, 0.74, 0.7] }));
    signPlane(laneIdx[n], 4.5, 4.5, x - 5.2, FLOOR + 44, zc + 17.4, 0, true, n === 2 ? 1.12 : 0.75);
  }
  add(merge(fixGeos), flat(null)); add(merge(darkGeos), flat(null)); add(merge(metalGeos), flat(null));

  /* ---- the court ---- */
  // The sale bin of rubber balls: a wire bin and a heap of balls.
  const ballGeo = new THREE.SphereGeometry(1.6, 12, 8);
  bake(ballGeo, { floorDark: 1, side: 0.9, bottom: 0.7 });
  const balls = new THREE.InstancedMesh(ballGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true }), 34);
  const ballCols = ["#B8392E", "#2F5D8A", "#D3A13B", "#B8392E", "#3F7A4A"];
  for (let n = 0; n < 34; n++) {
    const a = rr() * 6.28, rad = rr() * 6.5, lvl = n < 20 ? 0 : 1;
    m4.makeTranslation(44 + Math.cos(a) * rad, FLOOR + 11 + lvl * 2.6 + rr() * 1.2, -40 + Math.sin(a) * rad);
    balls.setMatrixAt(n, m4);
    balls.setColorAt(n, col.set(ballCols[n % ballCols.length]).multiplyScalar(0.92));
  }
  balls.frustumCulled = false;
  group.add(balls); disposables.push(ballGeo, balls.material);
  const binGeo = new THREE.CylinderGeometry(8.5, 8.5, 12, 24, 1, true); binGeo.translate(44, FLOOR + 6, -40);
  const binTex = canvasTexture(256, 64, (g, W2, H2) => { g.clearRect(0, 0, W2, H2); g.strokeStyle = "#C9C6BD"; g.lineWidth = 2; for (let x = 0; x < W2; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H2); g.stroke(); } for (let y = 2; y < H2; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W2, y); g.stroke(); } }, { scale: false });
  binTex.wrapS = THREE.RepeatWrapping; binTex.repeat.set(3, 1);
  add(bake(binGeo, { floorDark: 0.8 }), flat(binTex, { transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  disposables.push(binTex);
  signPlane(saleIdx[0], 9, 6.75, 44, FLOOR + 17, -40 + 8.6, 0, true);
  metalGeos.length = 0;
  metalGeos.push(bake(box(0.3, 5, 0.3, 44, FLOOR + 14, -40 + 8.6), { floorDark: 1 }));
  displays.forEach((d) => {
    const top = FLOOR + 1.4 + (2 + (d.n % 2)) * 5.05;
    const ry = Math.atan2(-d.x, -d.z);
    signPlane(saleIdx[2 + (d.n % 2)] ?? saleIdx[2], 8, 6, d.x, top + 7.5, d.z, ry, true);
    metalGeos.push(bake(box(0.3, 5, 0.3, d.x, top + 2.5, d.z), { floorDark: 1 }));
  });
  // The record bin in the south-east corner of the court.
  const recGeos = [bake(box(24, 10, 12, 52, FLOOR + 5, 48), { tint: [0.55, 0.4, 0.28] })];
  add(merge(recGeos), flat(null));
  for (let n = 0; n < 20; n++) products.push({ x: 42 + n * 1.05, y: FLOOR + 12.5, z: 48, w: 0.35, h: 7, d: 7.4, ry: Math.PI / 2 + (rr() - 0.5) * 0.12, tile: 9, tint: SLEEVE[n % SLEEVE.length] });
  signPlane(saleIdx[1], 9, 6.75, 52, FLOOR + 19, 48 - 6.2, Math.PI, true);
  // The display stand of the game's advertisement, facing the table.
  const adImg = loadImage(adUrl, () => { adTex.needsUpdate = true; });
  const adTex = new THREE.Texture(adImg);
  const adMat = new THREE.MeshBasicMaterial({ map: adTex, toneMapped: false, fog: true, color: 0xf2eee4 });
  const ad = add(vplane(15, 33.4, 0, 0, 0, 0), adMat);
  ad.matrixAutoUpdate = true;
  ad.position.set(-34, FLOOR + 2 + 16.7 + 7, -30);
  ad.rotation.y = Math.atan2(34, 30);
  const standGeos = [bake(box(16.4, 34.8, 1.2, 0, 0, -0.7), { tint: [0.55, 0.42, 0.3] }), bake(box(17, 7, 5, 0, -20.4, 0.8), { tint: [0.76, 0.62, 0.44] })];
  const stand = add(merge(standGeos), flat(null));
  stand.matrixAutoUpdate = true; stand.position.copy(ad.position); stand.rotation.copy(ad.rotation);
  signPlane(standeeIdx, 16, 8, 0, 0, 0, 0); // placed with the stand below
  const standeeSign = signGeos.pop();
  standeeSign.rotateY(ad.rotation.y); standeeSign.translate(ad.position.x + Math.sin(ad.rotation.y) * 3.4, FLOOR + 5.5, ad.position.z + Math.cos(ad.rotation.y) * 3.4);
  signGeos.push(standeeSign);
  disposables.push(adTex);
  // An empty shopping cart, left in the aisle.
  const cart = buildCart();
  cart.position.set(36, FLOOR, 24); cart.rotation.y = -0.7;
  group.add(cart);

  /* ---- the TV display at the records and TV endcap ---- */
  const tvCanvas = document.createElement("canvas");
  tvCanvas.width = q.tvWall ? 256 : 128; tvCanvas.height = tvCanvas.width * 0.75;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  paintTv(tvCanvas.getContext("2d"), tvCanvas.width, tvCanvas.height, 0);
  const tvMat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false, fog: true, color: 0xe8ecee });
  const cabGeos = [], screenGeos = [];
  const tvCapX = AISLE + GD / 2, tvCapZ = COURT + 8;
  [[-5, 12], [5, 12], [-5, 21], [5, 21]].forEach(([dx, y]) => {
    cabGeos.push(bake(box(9, 7.5, 7.5, tvCapX + dx, FLOOR + y + 3.75, tvCapZ - 4), { tint: [0.34, 0.3, 0.28] }));
    screenGeos.push(vplane(6.2, 4.7, tvCapX + dx - 0.6, FLOOR + y + 3.9, tvCapZ - 7.8, Math.PI));
  });
  // A console set on the floor beside it, in walnut veneer.
  cabGeos.push(bake(box(20, 11, 8, tvCapX - 22, FLOOR + 5.5 + 1.6, tvCapZ - 6), { tint: [0.48, 0.3, 0.19] }));
  cabGeos.push(bake(box(20, 1.6, 8, tvCapX - 22, FLOOR + 0.8, tvCapZ - 6), { tint: [0.2, 0.16, 0.13] }));
  screenGeos.push(vplane(10, 7.5, tvCapX - 24.5, FLOOR + 7.3, tvCapZ - 10.1, Math.PI));
  add(merge(cabGeos), flat(null));
  add(merge(screenGeos), tvMat);
  place(tvCapX, FLOOR + 11.6, tvCapZ - 4, GD - 1, 0.6, 7, 0, -1, 0.8);
  place(tvCapX, FLOOR + 20.6, tvCapZ - 4, GD - 1, 0.6, 7, 0, -1, 0.8);
  disposables.push(tvTex, tvMat);

  /* ---- the clock over the service desk ---- */
  const clockCanvas = document.createElement("canvas");
  clockCanvas.width = clockCanvas.height = 256;
  const clockTex = new THREE.CanvasTexture(clockCanvas);
  const clockMat = new THREE.MeshBasicMaterial({ map: clockTex, transparent: true, toneMapped: false, fog: true });
  add(vplane(11, 11, 0, FLOOR + 76, -ZB + 0.8, 0), clockMat);
  disposables.push(clockTex, clockMat);

  // Every sign, one mesh; rods and fixtures.
  add(merge(signGeos), flat(atlasTex));
  add(merge([...rodGeos, ...metalGeos]), flat(null, { color: 0xb9b5aa }));

  // Products: one instanced mesh for every box and shelf board.
  const pm = new THREE.InstancedMesh(productGeo, productMat, Math.max(1, products.length));
  const tiles = new Float32Array(Math.max(1, products.length) * 2);
  const qu = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  products.forEach((p, n) => {
    qu.setFromAxisAngle(yAxis, p.ry); sc.set(p.w, p.h, p.d); ps.set(p.x, p.y, p.z);
    m4.compose(ps, qu, sc);
    pm.setMatrixAt(n, m4);
    tiles[n * 2] = (p.tile % 4) * 0.25; tiles[n * 2 + 1] = 0.75 - Math.floor(p.tile / 4) * 0.25;
    if (p.tint) pm.setColorAt(n, col.set(p.tint).multiplyScalar(1.15));
    else pm.setColorAt(n, col.setRGB(p.bright || 1, p.bright || 1, p.bright || 1));
  });
  productGeo.setAttribute("aTile", new THREE.InstancedBufferAttribute(tiles, 2));
  pm.count = products.length;
  pm.frustumCulled = false;
  group.add(pm); disposables.push(productGeo, productMat);
  add(merge(shelfGeos), flat(null));

  /* ---- live parts ---- */
  let clockLast = -1;
  const start = Date.now();
  let tvLast = 0;
  const fl = { until: 0, next: performance.now() + 8000 + Math.random() * 8000 };
  return {
    group,
    flickerIndex,
    signTextures,
    // Called every frame: the clock, the TV picture, the flickering tube.
    animate(now, { onFlicker } = {}) {
      // The clock starts at 7:31 PM and keeps real time from there.
      const secs = Math.floor((Date.now() - start) / 1000) + (19 * 3600 + 31 * 60 + 12);
      if (secs !== clockLast) {
        clockLast = secs;
        paintClock(clockCanvas.getContext("2d"), 256, { h: Math.floor(secs / 3600) % 24, m: Math.floor(secs / 60) % 60, s: secs % 60 });
        clockTex.needsUpdate = true;
      }
      const tvEvery = q.tvWall ? 90 : 500;
      if (now - tvLast > tvEvery) {
        tvLast = now;
        paintTv(tvCanvas.getContext("2d"), tvCanvas.width, tvCanvas.height, now);
        tvTex.needsUpdate = true;
      }
      // One tube near the court fails to strike now and then: a few
      // quick drop-outs over a second or so, then steady again.
      if (now > fl.next) { fl.until = now + 700 + Math.random() * 900; fl.next = now + 14000 + Math.random() * 22000; onFlicker && onFlicker(fl.until - now); }
      let k = 1;
      if (now < fl.until) {
        const ph = Math.sin(now * 0.09) + Math.sin(now * 0.23 + 1.3);
        k = ph > 0.6 ? 0.45 : ph > -0.2 ? 1 : 0.8;
      }
      const base = trofBase[flickerIndex];
      if (base) {
        col.copy(base).multiplyScalar(k);
        troffers.setColorAt(flickerIndex, col); sheen.setColorAt(flickerIndex, col);
        troffers.instanceColor.needsUpdate = true; sheen.instanceColor.needsUpdate = true;
      }
    },
    // After the web fonts arrive: redraw everything with lettering.
    repaintSigns() { signTextures.forEach(repaint); },
    dispose() {
      disposables.forEach((d) => d && d.dispose && d.dispose());
      troffers.dispose(); sheen.dispose(); balls.dispose(); pm.dispose();
      cart.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}

/* A shopping cart of the time: a chrome wire basket on a frame, red
   plastic handle, four casters. Wire as thin boxes. */
function buildCart() {
  const g = new THREE.Group();
  const bars = [];
  const bar = (w, h, d, x, y, z) => bars.push(bake(box(w, h, d, x, y, z), { floorDark: 0.9, side: 0.9 }));
  const L = 17, W = 10.5, H0 = 9, H1 = 17;
  // Basket rim and floor.
  [[0, H1], [0, H0]].forEach(([, y]) => { bar(L, 0.18, 0.18, 0, y, -W / 2); bar(L, 0.18, 0.18, 0, y, W / 2); bar(0.18, 0.18, W, -L / 2, y, 0); bar(0.18, 0.18, W, L / 2, y, 0); });
  for (let x = -L / 2; x <= L / 2; x += 1.4) { bar(0.1, H1 - H0, 0.1, x, (H0 + H1) / 2, -W / 2); bar(0.1, H1 - H0, 0.1, x, (H0 + H1) / 2, W / 2); bar(0.1, 0.1, W, x, H0, 0); }
  for (let z = -W / 2; z <= W / 2; z += 1.4) { bar(0.1, H1 - H0, 0.1, -L / 2, (H0 + H1) / 2, z); bar(0.1, H1 - H0, 0.1, L / 2, (H0 + H1) / 2, z); }
  // Frame down to the wheels.
  [[-L / 2 + 1, -W / 2 + 1], [-L / 2 + 1, W / 2 - 1], [L / 2 - 1, -W / 2 + 1], [L / 2 - 1, W / 2 - 1]].forEach(([x, z]) => { bar(0.35, H0 - 1.4, 0.35, x, H0 / 2 + 0.7, z); });
  bar(L - 1, 0.35, 0.35, 0, 1.6, -W / 2 + 1); bar(L - 1, 0.35, 0.35, 0, 1.6, W / 2 - 1);
  // Handle posts.
  bar(0.35, 4, 0.35, L / 2 + 0.6, H1 + 1.8, -W / 2 + 0.5); bar(0.35, 4, 0.35, L / 2 + 0.6, H1 + 1.8, W / 2 - 0.5);
  const wire = new THREE.Mesh(merge(bars), new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xc9c8c2, toneMapped: false, fog: true }));
  g.add(wire);
  const handle = new THREE.Mesh(bake(box(0.9, 0.9, W - 0.6, L / 2 + 0.6, H1 + 3.8, 0), { floorDark: 1 }), new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xa3372c, toneMapped: false, fog: true }));
  g.add(handle);
  const wheels = [];
  [[-L / 2 + 1, -W / 2 + 1], [-L / 2 + 1, W / 2 - 1], [L / 2 - 1, -W / 2 + 1], [L / 2 - 1, W / 2 - 1]].forEach(([x, z]) => { const c = new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12); c.rotateX(Math.PI / 2); c.translate(x, 0.9, z); wheels.push(bake(c, { floorDark: 0.9 })); });
  g.add(new THREE.Mesh(merge(wheels), new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x2a2724, toneMapped: false, fog: true })));
  // Its shadow on the floor.
  const sh = new THREE.Mesh(hplane(L + 4, W + 4, 0, 0.06, 0), new THREE.MeshBasicMaterial({ map: shadowBlob(), transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, fog: true }));
  g.add(sh);
  return g;
}

/* ------------------------------------------------------------ the table */

/* The display table under the board: a walnut-pattern Formica top with
   an aluminium edge, chrome legs, a lower shelf of boxed sets; on top, a
   stack of boxed games at one end and a tent card at the other. Lit like
   the board (the board's shadow falls on it). Sized to the board, and
   rebuilt when the board changes size. */
export function buildTable(slabX, slabZ) {
  const q = quality();
  const group = new THREE.Group();
  group.name = "tienda-table";
  const disposables = [];
  // The board sits toward the front; the boxes and the card stand
  // behind it, where they never hide a square.
  // The chassis turns the board to face whichever side is to move, so
  // anything on the table stands at the two open ends, never in front
  // of or behind the board.
  const W = slabX + 15, D = slabZ + 5, BZ = 0;

  const topY = -SLAB_THICKNESS;
  const lit = (params) => {
    let m;
    if (q.physical) m = new THREE.MeshStandardMaterial(params);
    else { const { roughness, metalness, ...rest } = params; m = new THREE.MeshLambertMaterial(rest); }
    disposables.push(m); return m;
  };
  const formica = formicaWalnut(); formica.repeat.set(W / 7, D / 7); disposables.push(formica);
  const mk = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; group.add(m); disposables.push(geo); return m; };
  // Brushed aluminium T-molding round the edge: two bright lips and a
  // ribbed middle.
  const tmold = canvasTexture(16, 64, (g, W2, H2) => {
    g.fillStyle = "#8E8A80"; g.fillRect(0, 0, W2, H2);
    g.fillStyle = "#C9C6BC"; g.fillRect(0, 0, W2, H2 * 0.14); g.fillRect(0, H2 * 0.86, W2, H2 * 0.14);
    g.fillStyle = "rgba(60,58,52,0.5)"; for (let y = H2 * 0.24; y < H2 * 0.8; y += H2 * 0.09) g.fillRect(0, y, W2, H2 * 0.03);
  }, { scale: false });
  tmold.wrapS = THREE.RepeatWrapping; tmold.repeat.set(40, 1); disposables.push(tmold);
  const edge = lit({ map: tmold, roughness: 0.4, metalness: q.physical ? 0.4 : 0 });
  const topMat = lit({ map: formica, roughness: 0.5, color: 0xb9a48a });
  mk(box(W, 0.9, D, 0, topY - 0.45, -BZ), [edge, edge, topMat, edge, edge, edge], true);
  const chrome = lit({ color: 0xcfcdc6, roughness: 0.25, metalness: q.physical ? 0.8 : 0 });
  const legH = TABLE_H - 0.9;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => mk(box(0.9, legH, 0.9, sx * (W / 2 - 1.2), FLOOR + legH / 2, sz * (D / 2 - 1.2) - BZ), chrome));
  // Lower shelf with boxed stock.
  // (Under the top it's in shadow, so it isn't lit at all.)
  const under = new THREE.MeshBasicMaterial({ color: 0x2b2119, toneMapped: false, fog: true }); disposables.push(under);
  mk(box(W - 2, 0.6, D - 2, 0, FLOOR + 3, -BZ), under);
  const boxImg = new Image();
  const lid = canvasTexture(512, 256, lidPainter(boxImg), { scale: false });
  boxImg.onload = () => repaint(lid);
  boxImg.src = boxArtUrl;
  disposables.push(lid);
  const lidMat = lit({ map: lid, roughness: 0.6 });
  const sideMat = lit({ color: 0x3b2618, roughness: 0.7 });
  // Boxed sets: a folded board and ten pieces in a box about a foot
  // square, lid up, the lid's art toward the players.
  const bw = 4.5, bl = 9, bh = 1.1;
  const boxMats = [sideMat, sideMat, lidMat, sideMat, sideMat, sideMat];
  const addBox = (x, y, z, ry) => { const g = new THREE.BoxGeometry(bl, bh, bw); const m = mk(g, boxMats, true); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  const bxEnd = slabX / 2 + 1 + bw / 2;
  addBox(bxEnd, topY + bh / 2, 0.4, -Math.PI / 2 + 0.03);
  addBox(bxEnd + 0.15, topY + bh * 1.5, 0.2, -Math.PI / 2 - 0.05);
  const dimLid = new THREE.MeshBasicMaterial({ map: lid, color: 0x6a625a, toneMapped: false, fog: true }), dimSide = new THREE.MeshBasicMaterial({ color: 0x21170f, toneMapped: false, fog: true });
  disposables.push(dimLid, dimSide);
  const dimMats = [dimSide, dimSide, dimLid, dimSide, dimSide, dimSide];
  for (let n = 0; n < 4; n++) {
    const g = new THREE.BoxGeometry(bl, bh, bw); const m = mk(g, dimMats);
    m.position.set(-W / 4 + (n % 2) * 9.5, FLOOR + 3.3 + bh / 2 + Math.floor(n / 2) * bh, (n % 2 ? 1 : -1) * 3 - BZ); m.rotation.y = n * 0.04 - 0.02;
  }
  // The tent card: two leaves leaning together, printed outside, blank
  // inside, facing the players.
  const card = canvasTexture(256, 192, tentCard, { scale: false });
  disposables.push(card);
  const cardMat = lit({ map: card, roughness: 0.85 });
  const cardBack = lit({ color: 0xe9e0c8, roughness: 0.9, side: THREE.BackSide });
  const cx = -(slabX / 2 + 1.1 + 2.0), cz = 0;
  [1, -1].forEach((s) => {
    const g = new THREE.PlaneGeometry(3.4, 2.55);
    const m = mk(g, cardMat, true);
    m.position.set(cx, topY + 1.16, cz + s * 0.42);
    m.rotation.set(0, s > 0 ? 0 : Math.PI, 0);
    m.rotateX(-0.34);
    const b = new THREE.Mesh(g, cardBack); b.position.copy(m.position); b.quaternion.copy(m.quaternion); group.add(b);
  });
  // A soft shadow on the floor under the table.
  const blob = shadowBlob(); disposables.push(blob);
  const shadow = new THREE.Mesh(hplane(W + 10, D + 10, 0, FLOOR + 0.08, -BZ), new THREE.MeshBasicMaterial({ map: blob, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
  group.add(shadow); disposables.push(shadow.geometry, shadow.material);
  return {
    group,
    repaint() { repaint(lid); repaint(card); },
    dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); },
  };
}
