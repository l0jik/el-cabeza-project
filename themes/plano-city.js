/* Plano's city: the sheet round the board, and the life in its streets.

   Everything here is in the board's own frame (it hangs on the chassis's
   boardGroup, so it turns with the board) and is sized from the board
   (EX, EZ: half the slab's width and depth), so a bigger or smaller board
   gets its city laid out round it again.

   - The sheet: one great plane of cyanotype paper with its faint grid,
     out to where the fog takes it.
   - The plan: one canvas laid on the sheet round the board: a ring of
     streets just off the board's edge and another further out, each with
     kerbs, lane lines, bike lanes, zebra crossings, stop lines and painted
     arrows; the north street given over to the tram (rails and sleepers);
     a bus bay; paving dots on the walks; the plots; a park with its pond
     and paths; a schoolyard's court; the streets named after the pieces;
     a few dimension strings.
   - The blocks: quiet massing (blue, white edges, floor lines), held low
     near the board so they never hide it, and faded to a drawn outline
     whenever one stands between the camera and the board.
   - Trees: a trunk and a canopy drawn as a ring, its plan dashed below.
   - Life: cars and vans, bikes, people on every walk, runners round the
     pond, a tram at its stop, a bus in its bay, a café terrace, shoppers
     at the market, children in the schoolyard. The moving ones are
     instanced, one draw per kind, and placed every frame from the clock
     (each lane a pattern of things travelling at its own speed). */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const PAPER = "#1d4c8a", INK = "#eef6ff", NAVY = "#0f2a52", PENCIL = "#ff8f73";
// The city's blocks, drawn flat in three tones of the sheet's blue (a lit
// top, two shaded sides), so they stay behind the game's white and blue pieces.
const TOP = new THREE.Color("#2f62a2"), SIDE_A = new THREE.Color("#22508c"), SIDE_B = new THREE.Color("#1a447c");
const RW = 0.5, SW = 0.3; // half a carriageway, a walk

let seed = 4141;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[Math.floor(rnd() * a.length)];

/* The paper's faint grid, as a repeating tile (a square of the board's
   own size every major line). */
function paperTile(sq) {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d"), s = 512 / (sq * 4);
  x.fillStyle = PAPER; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const g = x.createRadialGradient(rnd() * 512, rnd() * 512, 0, rnd() * 512, rnd() * 512, rr(40, 160));
    g.addColorStop(0, rnd() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,10,40,0.035)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  }
  x.strokeStyle = "rgba(238,246,255,0.07)"; x.lineWidth = 1;
  for (let k = 0; k <= 16; k++) { const p = (k * sq * s) / 4; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 512); x.moveTo(0, p); x.lineTo(512, p); x.stroke(); }
  x.strokeStyle = "rgba(238,246,255,0.13)"; x.lineWidth = 1.6;
  for (let k = 0; k <= 4; k++) { const p = k * sq * s; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 512); x.moveTo(0, p); x.lineTo(512, p); x.stroke(); }
  return c;
}

export function buildCity({ EX, EZ, sq, gx = EX, gz = EZ, renderer, tier = "high", fonts }) {
  seed = 4141;
  const group = new THREE.Group();
  group.name = "plano-city";
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  const low = tier === "low", mid = tier === "mid";

  /* ---------------------------------------------------- the sheet */
  {
    const t = keep(new THREE.CanvasTexture(paperTile(sq)));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    const tile = sq * 4, size = 320;
    // the sheet's major lines run on from the board's own
    t.repeat.set(size / tile, size / tile); t.offset.set(((((gx - size / 2) / tile) % 1) + 1) % 1, ((((-gz - size / 2) / tile) % 1) + 1) % 1);
    const m = keep(new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    const g = keep(new THREE.PlaneGeometry(size, size));
    const sheet = new THREE.Mesh(g, m);
    sheet.rotation.x = -Math.PI / 2; sheet.position.y = -0.006; sheet.name = "plano-sheet";
    group.add(sheet);
  }

  /* ---------------------------------------------------- the plan */
  const xR = EX + SW + RW, zR = EZ + SW + RW, xO = EX + 8.8, zO = EZ + 8.8;
  const NS = [-xO, -xR, xR, xO], EW = [-zO, -zR, zR, zO], TRAM_Z = -zR;
  const R = Math.max(xO, zO) + 2.4, RES = low ? 2048 : mid ? 3072 : 4096, PX = RES / (2 * R);
  const plan = document.createElement("canvas"); plan.width = plan.height = RES;
  const pg = plan.getContext("2d");
  const P2 = (x, z) => [(x + R) * PX, (z + R) * PX];
  const hand = () => (fonts && fonts.hand) || "'Architects Daughter', 'DejaVu Sans Mono', monospace";
  const mono = () => (fonts && fonts.mono) || "'IBM Plex Mono', 'DejaVu Sans Mono', monospace";
  const treesPlan = [];
  let flipped = false; // the lettering turned round for a camera on the board's far side

  function drawPlan() {
    const g = pg;
    g.clearRect(0, 0, RES, RES);
    const line = (pts, w, color = INK, dash = null) => { g.save(); g.strokeStyle = color; g.lineWidth = w * (PX / 102); if (dash) g.setLineDash(dash.map((d) => d * PX)); g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P2(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.restore(); };
    const rect = (x0, z0, x1, z1, fill, stroke, w = 2) => { const [a, b] = P2(x0, z0), [c, d] = P2(x1, z1); if (fill) { g.fillStyle = fill; g.fillRect(a, b, c - a, d - b); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w * (PX / 102); g.strokeRect(a, b, c - a, d - b); } };
    const text = (s, x, z, size, o = {}) => { g.save(); const [a, b] = P2(x, z); g.translate(a, b); g.rotate((o.rot || 0) + (flipped ? Math.PI : 0)); g.font = `${o.weight || ""} ${size * PX}px ${o.font || hand()}`; g.fillStyle = o.color || INK; g.textAlign = o.align || "center"; g.textBaseline = "middle"; if (o.spacing && "letterSpacing" in g) g.letterSpacing = `${o.spacing * PX}px`; g.fillText(s, 0, 0); g.restore(); };
    const circle = (x, z, r, stroke, w = 2, fill = null, dash = null) => { const [a, b] = P2(x, z); g.save(); if (dash) g.setLineDash(dash.map((d) => d * PX)); g.beginPath(); g.arc(a, b, r * PX, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w * (PX / 102); g.stroke(); } g.restore(); };
    const arrow = (x, z, ang, len) => {
      const dx = Math.cos(ang), dz = Math.sin(ang), nx = -dz, nz = dx, h = len * 0.4;
      const pts = [[x - (dx * len) / 2 + nx * 0.025, z - (dz * len) / 2 + nz * 0.025], [x + dx * (len / 2 - h) + nx * 0.025, z + dz * (len / 2 - h) + nz * 0.025], [x + dx * (len / 2 - h) + nx * 0.07, z + dz * (len / 2 - h) + nz * 0.07], [x + (dx * len) / 2, z + (dz * len) / 2], [x + dx * (len / 2 - h) - nx * 0.07, z + dz * (len / 2 - h) - nz * 0.07], [x + dx * (len / 2 - h) - nx * 0.025, z + dz * (len / 2 - h) - nz * 0.025], [x - (dx * len) / 2 - nx * 0.025, z - (dz * len) / 2 - nz * 0.025]];
      g.save(); g.fillStyle = INK; g.beginPath(); pts.forEach(([a, b], i) => { const [u, v] = P2(a, b); i ? g.lineTo(u, v) : g.moveTo(u, v); }); g.closePath(); g.fill(); g.restore();
    };
    const dim = (x0, z0, x1, z1, off, label) => {
      const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L, nx = -dz, nz = dx, sg = Math.sign(off) || 1;
      const a = [x0 + nx * off, z0 + nz * off], b = [x1 + nx * off, z1 + nz * off];
      line([[x0 + nx * 0.06 * sg, z0 + nz * 0.06 * sg], [a[0] + nx * 0.12 * sg, a[1] + nz * 0.12 * sg]], 1.6);
      line([[x1 + nx * 0.06 * sg, z1 + nz * 0.06 * sg], [b[0] + nx * 0.12 * sg, b[1] + nz * 0.12 * sg]], 1.6);
      line([a, b], 1.8);
      for (const p of [a, b]) line([[p[0] - (dx + nx) * 0.07, p[1] - (dz + nz) * 0.07], [p[0] + (dx + nx) * 0.07, p[1] + (dz + nz) * 0.07]], 3);
      text(label, (a[0] + b[0]) / 2 + nx * 0.17 * sg, (a[1] + b[1]) / 2 + nz * 0.17 * sg, 0.2, { rot: Math.atan2(dz, dx), font: mono() });
    };
    const inBoardX = (v) => Math.abs(v) < EX, inBoardZ = (v) => Math.abs(v) < EZ;
    // carriageways a shade deeper than the plots
    for (const c of NS) rect(c - RW, -R, c + RW, R, "rgba(6,22,56,0.32)");
    for (const c of EW) rect(-R, c - RW, R, c + RW, "rgba(6,22,56,0.32)");
    // kerbs, bike lanes, centre lines, between the crossings
    for (const c of NS) for (const s of [-1, 1]) {
      const segs = []; let a0 = -R; for (const e of EW) { segs.push([a0, e - RW]); a0 = e + RW; } segs.push([a0, R]);
      for (const [a, b] of segs) { line([[c + s * RW, a], [c + s * RW, b]], 3.4); line([[c + s * (RW - 0.12), a], [c + s * (RW - 0.12), b]], 1.6, "rgba(238,246,255,0.7)", [0.12, 0.08]); line([[c + s * (RW + SW), a], [c + s * (RW + SW), b]], 2); }
      for (const [a, b] of segs) if (s === 1 && b - a > 2) line([[c, a + 0.9], [c, b - 0.9]], 2.4, INK, [0.3, 0.22]);
    }
    for (const c of EW) for (const s of [-1, 1]) {
      const segs = []; let a0 = -R; for (const e of NS) { segs.push([a0, e - RW]); a0 = e + RW; } segs.push([a0, R]);
      for (const [a, b] of segs) { line([[a, c + s * RW], [b, c + s * RW]], 3.4); if (c !== TRAM_Z) line([[a, c + s * (RW - 0.12)], [b, c + s * (RW - 0.12)]], 1.6, "rgba(238,246,255,0.7)", [0.12, 0.08]); line([[a, c + s * (RW + SW)], [b, c + s * (RW + SW)]], 2); }
      for (const [a, b] of segs) if (s === 1 && c !== TRAM_Z && b - a > 2) line([[a + 0.9, c], [b - 0.9, c]], 2.4, INK, [0.3, 0.22]);
    }
    // the tram street: rails and sleepers
    for (const s of [-1, 1]) line([[-R, TRAM_Z + s * 0.08], [R, TRAM_Z + s * 0.08]], 2.6);
    for (let x = -R; x < R; x += 0.12) line([[x, TRAM_Z - 0.12], [x, TRAM_Z + 0.12]], 1.2, "rgba(238,246,255,0.45)");
    text("TRAM ONLY", EX * 0.62, TRAM_Z + 0.33, 0.17, { font: mono(), spacing: 0.03 });
    // crossings: zebras on every arm, stop lines, arrows before them
    for (const cx of NS) for (const cz of EW) for (const s of [-1, 1]) {
      for (let k = -RW + 0.06; k < RW - 0.04; k += 0.13) { rect(cx + k, cz + s * (RW + 0.08), cx + k + 0.07, cz + s * (RW + 0.42), INK); rect(cx + s * (RW + 0.08), cz + k, cx + s * (RW + 0.42), cz + k + 0.07, INK); }
      line([[cx + s * 0.02, cz + s * (RW + 0.5)], [cx + s * RW, cz + s * (RW + 0.5)]], 3.2);
      if (cz !== TRAM_Z) line([[cx + s * (RW + 0.5), cz - s * 0.02], [cx + s * (RW + 0.5), cz - s * RW]], 3.2);
      // each arrow points the way its lane's traffic runs, into the crossing: the lane west of a north-south
      // street's centre carries traffic south (+z), the east one north (user: cars were going against the arrows)
      arrow(cx - s * 0.19, cz - s * (RW + 1.0), s > 0 ? Math.PI / 2 : -Math.PI / 2, 0.36);
      if (cz !== TRAM_Z) arrow(cx + s * (RW + 1.0), cz - s * 0.19, s > 0 ? Math.PI : 0, 0.36);
    }
    // bike symbols
    for (const c of NS) for (let z = -R + 2; z < R; z += 4.2) if (!EW.some((e) => Math.abs(z - e) < RW + SW + 0.3)) for (const s of [-1, 1]) { const x = c + s * (RW - 0.06); circle(x, z - 0.06, 0.035, INK, 1.6); circle(x, z + 0.06, 0.035, INK, 1.6); line([[x, z - 0.06], [x, z + 0.06]], 1.6); }
    // the bus bay on the east street
    line([[xR + RW, -EZ * 0.62], [xR + RW + 0.2, -EZ * 0.58], [xR + RW + 0.2, -EZ * 0.2], [xR + RW, -EZ * 0.16]], 3.4);
    text("BUS", xR + RW + 0.1, -EZ * 0.39, 0.16, { font: mono(), rot: Math.PI / 2, spacing: 0.02 });
    // paving dots on the walks
    g.fillStyle = "rgba(238,246,255,0.16)";
    for (let x = -R; x < R; x += 0.18) for (let z = -R; z < R; z += 0.18) {
      if (inBoardX(x) && inBoardZ(z)) continue;
      const onWalk = NS.some((c) => Math.abs(Math.abs(x - c) - RW - SW / 2) < SW / 2) || EW.some((c) => Math.abs(Math.abs(z - c) - RW - SW / 2) < SW / 2);
      if (onWalk) { const [a, b] = P2(x, z); g.fillRect(a - 1, b - 1, 2.2, 2.2); }
    }
    // the plots
    const bx = [[-xO + RW + SW, -xR - RW - SW], [-EX, EX], [xR + RW + SW, xO - RW - SW]], bz = [[-zO + RW + SW, -zR - RW - SW], [-EZ, EZ], [zR + RW + SW, zO - RW - SW]];
    for (const [x0, x1] of bx) for (const [z0, z1] of bz) { if (x0 === -EX && z0 === -EZ) continue; rect(x0, z0, x1, z1, null, "rgba(238,246,255,0.7)", 2.2); }
    // the park (south of the board): a pond, its paths, a name
    const pcx = -EX * 0.2, pcz = (zR + RW + SW + zO - RW - SW) / 2, prx = Math.min(EX * 0.4, 2.3), prz = Math.min(1.35, (zO - zR) * 0.2);
    g.save(); { const [a, b] = P2(pcx, pcz); g.beginPath(); g.ellipse(a, b, prx * PX, prz * PX, 0.08, 0, Math.PI * 2); g.fillStyle = "rgba(6,22,56,0.38)"; g.fill(); g.strokeStyle = INK; g.lineWidth = 3 * (PX / 102); g.stroke(); for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(a + 0.4 * PX, b - 0.1 * PX, (0.3 + k * 0.3) * PX, (0.12 + k * 0.16) * PX, 0.08, 0.3, 2.4); g.strokeStyle = "rgba(238,246,255,0.4)"; g.lineWidth = 1.4 * (PX / 102); g.stroke(); } } g.restore();
    for (const off of [-0.09, 0.09]) line(Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return [pcx + Math.cos(a) * (prx + 0.55 + off), pcz + Math.sin(a) * (prz + 0.45 + off)]; }), 2);
    for (const off of [-0.08, 0.08]) line([[-EX, zR + RW + SW + 1.4 + off], [-EX * 0.5, zR + RW + SW + 2.1 + off], [pcx - prx - 0.4, pcz - prz * 0.2 + off]], 2);
    text("PARQUE DEL TURRITO", pcx, pcz + prz + 1.05, 0.36, { spacing: 0.03 });
    // the schoolyard's court (east)
    { const cx = (xR + RW + SW + xO - RW - SW) / 2 + 0.4, cz = -EZ * 0.22; rect(cx - 1.6, cz - 1.1, cx + 1.6, cz + 1.1, null, INK, 2.4); line([[cx, cz - 1.1], [cx, cz + 1.1]], 1.8); circle(cx, cz, 0.36, INK, 1.8); circle(cx - 1.6, cz, 0.5, INK, 1.6); circle(cx + 1.6, cz, 0.5, INK, 1.6); text("ESCUELA", cx + 0.3, EZ * 0.74, 0.36, { spacing: 0.03 }); }
    text("MERCADO", -(xR + RW + SW + xO - RW - SW) / 2, EZ * 0.8, 0.36, { spacing: 0.03 });
    // the streets, named after the pieces
    text("AV. DE LA CABEZA", xR, EZ * 0.55, 0.3, { rot: Math.PI / 2, spacing: 0.04 });
    text("CALLE DEL OPA", -xR, EZ * 0.55, 0.3, { rot: -Math.PI / 2, spacing: 0.04 });
    text("PASEO DEL FLACO", -EX * 0.45, zR, 0.3, { spacing: 0.04 });
    text("RAMBLA DEL TRAM", -EX * 0.5, TRAM_Z - 0.3, 0.26, { spacing: 0.04 });
    text("PLAZA DE LA CABEZA", 0, EZ + 0.16, 0.2, { font: mono(), spacing: 0.05 });
    // dimension strings: the board across, a street's width
    dim(-gx, -EZ - 0.02, gx, -EZ - 0.02, -0.62, (gx * 2 * 20).toFixed(2));
    dim(xR - RW - SW, zR + RW + SW + 1.2, xR + RW + SW, zR + RW + SW + 1.2, -0.01, "32.00");
    // tree plans: each canopy's outline, dashed
    for (const [x, z, k] of treesPlan) circle(x, z, k * 0.7, "rgba(238,246,255,0.5)", 1.6, null, [0.05, 0.05]);
  }
  const planTex = keep(new THREE.CanvasTexture(plan));
  planTex.anisotropy = aniso;
  {
    const m = keep(new THREE.MeshBasicMaterial({ map: planTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    const geo = keep(new THREE.PlaneGeometry(2 * R, 2 * R));
    const p = new THREE.Mesh(geo, m); p.rotation.x = -Math.PI / 2; p.position.y = -0.004; p.renderOrder = -5; p.name = "plano-plan";
    group.add(p);
  }

  /* ---------------------------------------------------- the blocks */
  const OCC = [], blocks = [];
  function building(x, z, X, Y, Z, o = {}) {
    const geo = keep(new THREE.BoxGeometry(X, Y, Z)); geo.translate(0, Y / 2, 0);
    { // faces: +x, -x, +y, -y, +z, -z, four vertices each
      const tones = [SIDE_B, SIDE_A, TOP, TOP, SIDE_A, SIDE_B], cols = [];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) cols.push(tones[f].r, tones[f].g, tones[f].b);
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    }
    const fillM = keep(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
    const mesh = new THREE.Mesh(geo, fillM);
    const L = Array.from(new THREE.EdgesGeometry(geo, 20).attributes.position.array), e = 0.003;
    if (o.floors !== false) {
      const floors = Math.max(1, Math.round(Y / 0.29));
      for (let f = 1; f < floors; f++) { const y = (f * Y) / floors; L.push(-X / 2 - e, y, Z / 2 + e, X / 2 + e, y, Z / 2 + e, -X / 2 - e, y, -Z / 2 - e, X / 2 + e, y, -Z / 2 - e, X / 2 + e, y, -Z / 2 - e, X / 2 + e, y, Z / 2 + e, -X / 2 - e, y, -Z / 2 - e, -X / 2 - e, y, Z / 2 + e); }
    }
    if (o.saw) for (let k = 0; k <= 8; k++) { const xx = -X / 2 + (k * X) / 8; if (k < 8) L.push(xx, Y, -Z / 2, xx + X / 8, Y + 0.22, -Z / 2, xx + X / 8, Y + 0.22, -Z / 2, xx + X / 8, Y, -Z / 2, xx, Y, Z / 2, xx + X / 8, Y + 0.22, Z / 2, xx + X / 8, Y + 0.22, Z / 2, xx + X / 8, Y, Z / 2, xx + X / 8, Y + 0.22, -Z / 2, xx + X / 8, Y + 0.22, Z / 2); }
    const lg = keep(new THREE.BufferGeometry()); lg.setAttribute("position", new THREE.Float32BufferAttribute(L, 3));
    const lineM = keep(new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.72 }));
    const lines = new THREE.LineSegments(lg, lineM); lines.raycast = () => {};
    const b = new THREE.Group(); b.add(mesh, lines); b.position.set(x, 0, z); if (o.ry) b.rotation.y = o.ry;
    mesh.raycast = () => {};
    group.add(b);
    OCC.push([x - X / 2, z - Z / 2, x + X / 2, z + Z / 2]);
    blocks.push({ x, z, r: Math.hypot(X, Z) / 2, h: Y, fillM, lineM, fade: 1 });
    return b;
  }
  const occupied = (x, z, pad = 0.1) => OCC.some(([a, b, c, d]) => x > a - pad && x < c + pad && z > b - pad && z < d + pad);
  const BX0 = xR + RW + SW, BX1 = xO - RW - SW, BZ0 = zR + RW + SW, BZ1 = zO - RW - SW, bw = BX1 - BX0, bd = BZ1 - BZ0;
  // north: a perimeter block round a courtyard (low on the board's side)
  {
    const z0 = -BZ1, z1 = -BZ0, w = 2 * EX;
    building(-w * 0.32, z0 + 0.7, w * 0.3, 1.5, 1.4); building(0, z0 + 0.7, w * 0.3, 1.25, 1.4); building(w * 0.32, z0 + 0.7, w * 0.3, 1.8, 1.4);
    building(-EX + 0.7, (z0 + z1) / 2, 1.4, 1.2, (z1 - z0) * 0.55); building(EX - 0.7, (z0 + z1) / 2, 1.4, 1.35, (z1 - z0) * 0.55);
    building(-w * 0.22, z1 - 0.7, w * 0.32, 0.95, 1.2); building(w * 0.22, z1 - 0.7, w * 0.32, 1.05, 1.2);
  }
  // north-west: a tower on a plinth, far from the board
  building(-(BX0 + BX1) / 2, -(BZ0 + BZ1) / 2, bw * 0.6, 0.45, bd * 0.6); building(-(BX0 + BX1) / 2 - bw * 0.1, -(BZ0 + BZ1) / 2 - bd * 0.1, bw * 0.3, 3.6, bd * 0.3, { floors: true });
  // north-east: apartments round the café's corner
  building(BX1 - bw * 0.25, -(BZ0 + BZ1) / 2 - bd * 0.1, bw * 0.45, 1.6, bd * 0.75); building(BX0 + bw * 0.3, -BZ1 + bd * 0.18, bw * 0.3, 1.25, bd * 0.25);
  // west: the market hall with its sawtooth roof, stalls in front
  { const cx = -(BX0 + BX1) / 2, hall = building(cx, -EZ * 0.18, bw * 0.68, 0.62, Math.min(2.2, EZ * 0.42), { floors: false, saw: true }); void hall;
    for (let k = 0; k < 6; k++) building(cx - bw * 0.3 + k * bw * 0.11, EZ * 0.42, bw * 0.075, 0.18, 0.4, { floors: false }); }
  // east: the school, an L of two wings
  building((BX0 + BX1) / 2 + 0.6, EZ * 0.42, bw * 0.66, 0.85, 1.6); building(BX0 + 0.9, EZ * 0.08, 1.4, 0.85, 2.0);
  // south-west and south-east: housing
  building(-(BX0 + BX1) / 2, BZ0 + 0.9, bw * 0.72, 1.2, 1.4); building(-BX1 + 0.9, (BZ0 + BZ1) / 2 + 0.6, 1.6, 1.0, bd * 0.5); building(-BX0 - 1.0, BZ1 - 1.2, 1.8, 1.4, 2.2);
  building((BX0 + BX1) / 2, BZ0 + 0.85, bw * 0.62, 1.5, 1.4); building(BX1 - 0.95, (BZ0 + BZ1) / 2 + 0.5, 1.8, 2.2, bd * 0.4); building(BX0 + 1.1, BZ1 - 1.1, 2.0, 1.1, 2.0);
  // the shelters: the tram's on the board's walk, the bus's at its bay
  building(-EX * 0.4, -EZ - 0.24, 1.6, 0.16, 0.18, { floors: false }); building(xR + RW + SW - 0.08, -EZ * 0.39, 0.14, 0.16, 1.0, { floors: false });

  /* ---------------------------------------------------- trees */
  const treeTex = keep((() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.strokeStyle = INK; x.lineWidth = 5; x.beginPath(); for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2, r = 50 + Math.sin(a * 7) * 4; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fillStyle = "rgba(29,76,138,0.88)"; x.fill(); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(64, 30); x.lineTo(64, 98); x.moveTo(30, 64); x.lineTo(98, 64); x.stroke(); return new THREE.CanvasTexture(c); })());
  const treeM = keep(new THREE.SpriteMaterial({ map: treeTex, transparent: true, alphaTest: 0.3, toneMapped: false })), trunks = [];
  function tree(x, z, k = 0.26) {
    if (occupied(x, z, 0.05) || (Math.abs(x) < EX + 0.1 && Math.abs(z) < EZ + 0.1)) return;
    trunks.push(x, 0, z, x, k * 1.1, z);
    const s = new THREE.Sprite(treeM); s.scale.set(k * 1.6, k * 1.6, 1); s.position.set(x, k * 1.5, z); s.raycast = () => {}; group.add(s);
    treesPlan.push([x, z, k]);
  }
  const STEP = low ? 2.2 : 1.6;
  for (const c of NS) for (let z = -R + 0.6; z < R; z += STEP) if (!EW.some((e) => Math.abs(z - e) < RW + SW + 0.2)) for (const s of [-1, 1]) tree(c + s * (RW + SW - 0.08), z, 0.22);
  for (const c of EW) for (let x = -R + 0.6; x < R; x += STEP) if (!NS.some((e) => Math.abs(x - e) < RW + SW + 0.2)) for (const s of [-1, 1]) tree(x, c + s * (RW + SW - 0.08), 0.22);
  { const pcx = -EX * 0.2, pcz = (BZ0 + BZ1) / 2, prx = Math.min(EX * 0.4, 2.3), prz = Math.min(1.35, (zO - zR) * 0.2);
    for (let i = 0; i < (low ? 26 : 46); i++) { const x = rr(-EX + 0.3, EX - 0.3), z = rr(BZ0 + 0.3, BZ1 - 0.3), pond = ((x - pcx) / (prx + 0.3)) ** 2 + ((z - pcz) / (prz + 0.3)) ** 2 < 1, path = Math.abs(((x - pcx) / (prx + 0.55)) ** 2 + ((z - pcz) / (prz + 0.45)) ** 2 - 1) < 0.14; if (!pond && !path) tree(x, z, rr(0.26, 0.4)); } }
  for (let i = 0; i < 9; i++) tree(rr(-EX * 0.5, EX * 0.5), rr(-BZ1 + 1.6, -BZ0 - 1.6), rr(0.26, 0.36));
  { const tg = keep(new THREE.BufferGeometry()); tg.setAttribute("position", new THREE.Float32BufferAttribute(trunks, 3)); const t = new THREE.LineSegments(tg, keep(new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.85 }))); t.raycast = () => {}; group.add(t); }

  /* ---------------------------------------------------- life */
  const KINDS = {};
  const merge = (geos) => { const m = BufferGeometryUtils.mergeBufferGeometries(geos.map((q) => q.toNonIndexed())); geos.forEach((q) => q.dispose()); return keep(m); };
  const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const PERSON = () => merge([new THREE.CylinderGeometry(0.014, 0.018, 0.053, 6).translate(0, 0.0265, 0), new THREE.SphereGeometry(0.016, 8, 6).translate(0, 0.071, 0)]);
  KINDS.car = { geo: merge([boxAt(0.24, 0.055, 0.12, 0, 0.045, 0), boxAt(0.125, 0.045, 0.108, -0.01, 0.095, 0)]), outline: 1.1, items: [] };
  KINDS.van = { geo: merge([boxAt(0.3, 0.1, 0.13, 0, 0.068, 0), boxAt(0.06, 0.05, 0.12, 0.13, 0.06, 0)]), outline: 1.1, items: [] };
  KINDS.person = { geo: PERSON(), outline: 0, items: [] };
  KINDS.bike = { geo: merge([boxAt(0.1, 0.012, 0.012, 0, 0.03, 0), new THREE.CylinderGeometry(0.03, 0.03, 0.008, 10).rotateX(Math.PI / 2).translate(-0.045, 0.03, 0), new THREE.CylinderGeometry(0.03, 0.03, 0.008, 10).rotateX(Math.PI / 2).translate(0.045, 0.03, 0), new THREE.CylinderGeometry(0.013, 0.016, 0.05, 6).translate(0, 0.07, 0), new THREE.SphereGeometry(0.015, 8, 6).translate(0, 0.11, 0)]), outline: 0, items: [] };
  const add = (name, pos, color) => KINDS[name].items.push({ pos, color });
  const density = low ? 0.5 : mid ? 0.75 : 1;
  function lane(ax, az, bx, bz, name, v, slots, colors) {
    // things repeating every p along a lane, travelling at v
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, p = v * 8 / density, n = Math.ceil(L / p) + 1, yaw = -Math.atan2(dz, dx);
    for (const o of slots) for (let k = 0; k < n; k++) {
      const base = o * p + k * p, nm = typeof name === "function" ? name() : name;
      add(nm, (t) => { const s = (((base + v * t) % (n * p)) + n * p) % (n * p) - p * 0.5; return s >= 0 && s <= L ? [ax + dx * s, az + dz * s, yaw] : null; }, pick(colors));
    }
  }
  const CARS = ["#e8f1fc", "#e8f1fc", "#e8f1fc", "#cfe2f7", "#ffe08a"], PEOPLE = ["#eef6ff", "#eef6ff", "#eef6ff", "#ffd9a0", "#bfe0ff", "#ffb8a8"];
  const carName = () => (rnd() < 0.14 ? "van" : "car");
  for (const c of NS) {
    lane(c - 0.19, -R, c - 0.19, R, carName, rr(0.55, 0.75), [rr(0, 0.5), rr(0.5, 1)], CARS);
    lane(c + 0.19, R, c + 0.19, -R, carName, rr(0.55, 0.75), [rr(0, 0.5), rr(0.5, 1)], CARS);
    lane(c - 0.43, -R, c - 0.43, R, "bike", rr(0.2, 0.28), [rr(0, 1)], PEOPLE); lane(c + 0.43, R, c + 0.43, -R, "bike", rr(0.2, 0.28), [rr(0, 1)], PEOPLE);
  }
  for (const c of EW) {
    if (c === TRAM_Z) { lane(-R, c + 0.36, R, c + 0.36, "bike", 0.24, [0.2, 0.7], PEOPLE); lane(R, c - 0.36, -R, c - 0.36, "bike", 0.26, [0.5], PEOPLE); continue; }
    lane(-R, c + 0.19, R, c + 0.19, carName, rr(0.55, 0.75), [rr(0, 0.5), rr(0.5, 1)], CARS);
    lane(R, c - 0.19, -R, c - 0.19, carName, rr(0.55, 0.75), [rr(0, 0.5), rr(0.5, 1)], CARS);
    lane(-R, c + 0.43, R, c + 0.43, "bike", rr(0.2, 0.28), [rr(0, 1)], PEOPLE); lane(R, c - 0.43, -R, c - 0.43, "bike", rr(0.2, 0.28), [rr(0, 1)], PEOPLE);
  }
  for (const c of NS) for (const s of [-1, 1]) { lane(c + s * (RW + 0.09), -R, c + s * (RW + 0.09), R, "person", rr(0.06, 0.08), [rr(0, 1)], PEOPLE); lane(c + s * (RW + 0.2), R, c + s * (RW + 0.2), -R, "person", rr(0.06, 0.08), [rr(0, 1)], PEOPLE); }
  for (const c of EW) for (const s of [-1, 1]) { lane(-R, c + s * (RW + 0.09), R, c + s * (RW + 0.09), "person", rr(0.06, 0.08), [rr(0, 1)], PEOPLE); lane(R, c + s * (RW + 0.2), -R, c + s * (RW + 0.2), "person", rr(0.06, 0.08), [rr(0, 1)], PEOPLE); }
  { // runners round the pond
    const pcx = -EX * 0.2, pcz = (BZ0 + BZ1) / 2, prx = Math.min(EX * 0.4, 2.3) + 0.55, prz = Math.min(1.35, (zO - zR) * 0.2) + 0.45;
    for (const [gap, dir, off] of [[1.3, 1, 0], [1.9, -1, 0.07]]) {
      const Lp = Math.PI * (3 * (prx + prz) - Math.sqrt((3 * prx + prz) * (prx + 3 * prz))), k = Math.max(3, Math.round(Lp / gap)), w = ((2 * Math.PI) / (k * 8)) * dir, o0 = rnd() * 6.28;
      for (let j = 0; j < k; j++) add("person", (t) => { const a = o0 + (j * 2 * Math.PI) / k + w * t; return [pcx + Math.cos(a) * (prx - off), pcz + Math.sin(a) * (prz - off), 0]; }, pick(PEOPLE));
    }
  }
  const still = (x, z, color) => { if (!occupied(x, z, 0.02) && !(Math.abs(x) < EX && Math.abs(z) < EZ)) add("person", () => [x, z, 0], color || pick(PEOPLE)); };
  { // the tram at its stop, its platform; the bus in its bay, its queue
    const tm = keep(new THREE.MeshStandardMaterial({ color: "#e8f1fc", roughness: 1 })), te = keep(new THREE.LineBasicMaterial({ color: NAVY }));
    const tx0 = -EX * 0.4 - 1.0;
    for (let k = 0; k < 3; k++) {
      const seg = keep(new THREE.BoxGeometry(0.68, 0.17, 0.2)); seg.translate(tx0 + k * 0.72, 0.1, TRAM_Z);
      const m = new THREE.Mesh(seg, tm); m.raycast = () => {}; group.add(m);
      const eg = keep(new THREE.EdgesGeometry(seg)); const l = new THREE.LineSegments(eg, te); l.raycast = () => {}; group.add(l);
    }
    for (let i = 0; i < 10; i++) still(rr(-EX * 0.4 - 0.8, -EX * 0.4 + 0.8), -EZ - rr(0.08, 0.28));
    const bus = keep(new THREE.BoxGeometry(0.17, 0.2, 0.62)); bus.translate(xR + RW + 0.1, 0.11, -EZ * 0.39);
    const bm = new THREE.Mesh(bus, keep(new THREE.MeshStandardMaterial({ color: "#ffe08a", roughness: 1 }))); bm.raycast = () => {}; group.add(bm);
    const be = new THREE.LineSegments(keep(new THREE.EdgesGeometry(bus)), te); be.raycast = () => {}; group.add(be);
    for (let i = 0; i < 6; i++) still(xR + RW + 0.27, -EZ * 0.39 - 0.3 + i * 0.12);
  }
  { // the café terrace on the north-east corner: tables under umbrellas, people sitting
    const ux = [], tableM = keep(new THREE.MeshStandardMaterial({ color: "#e8f1fc", roughness: 1 }));
    for (let i = 0; i < 8; i++) {
      const x = BX0 + 0.35 + (i % 4) * 0.46, z = -BZ0 - 0.4 - Math.floor(i / 4) * 0.52;
      const t2 = keep(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10)); t2.translate(x, 0.05, z); const tm2 = new THREE.Mesh(t2, tableM); tm2.raycast = () => {}; group.add(tm2);
      const um = new THREE.ConeGeometry(0.17, 0.07, 8, 1, true); um.translate(x, 0.25, z); ux.push(...new THREE.EdgesGeometry(um, 1).attributes.position.array, x, 0.05, z, x, 0.22, z); um.dispose();
      for (let s2 = 0; s2 < 2 + (i % 2); s2++) { const a = s2 * 2.4 + i; add("person", () => [x + Math.cos(a) * 0.11, z + Math.sin(a) * 0.11, 0], pick(PEOPLE)); }
    }
    const ug = keep(new THREE.BufferGeometry()); ug.setAttribute("position", new THREE.Float32BufferAttribute(ux, 3)); const ul = new THREE.LineSegments(ug, keep(new THREE.LineBasicMaterial({ color: INK }))); ul.raycast = () => {}; group.add(ul);
  }
  for (let i = 0; i < (low ? 14 : 26); i++) still(rr(-BX1 + 0.4, -BX0 - 0.4), rr(EZ * 0.48, EZ * 0.62));
  for (let i = 0; i < (low ? 10 : 20); i++) still(rr(BX0 + 0.6, BX1 - 0.4), rr(-EZ * 0.42, -EZ * 0.02), pick(["#ffd9a0", "#bfe0ff", "#eef6ff", "#ffb8a8"]));
  for (let i = 0; i < (low ? 8 : 14); i++) still(rr(-EX + 0.4, EX - 0.4), rr(BZ0 + 0.2, BZ0 + 1.6));
  // one instanced mesh per kind (and a navy outline round the cars)
  const UP = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0), v3 = new THREE.Vector3();
  const outlined = (geo, k) => { const o = geo.clone(); o.computeBoundingBox(); const c = new THREE.Vector3(); o.boundingBox.getCenter(c); o.translate(-c.x, -c.y, -c.z); o.scale(k, k * 1.12, k); o.translate(c.x, c.y, c.z); return keep(o); };
  for (const k of Object.values(KINDS)) {
    if (!k.items.length) continue;
    k.mesh = new THREE.InstancedMesh(k.geo, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })), k.items.length);
    k.items.forEach((it, i) => k.mesh.setColorAt(i, new THREE.Color(it.color)));
    k.mesh.raycast = () => {}; k.mesh.frustumCulled = false; group.add(k.mesh);
    if (k.outline) { k.out = new THREE.InstancedMesh(outlined(k.geo, k.outline), keep(new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide })), k.items.length); k.out.raycast = () => {}; k.out.frustumCulled = false; group.add(k.out); }
  }
  function placeLife(t) {
    for (const k of Object.values(KINDS)) {
      if (!k.mesh) continue;
      for (let i = 0; i < k.items.length; i++) {
        const p = k.items[i].pos(t);
        if (p) { q.setFromAxisAngle(UP, p[2]); m4.compose(v3.set(p[0], 0, p[1]), q, one); } else m4.copy(zero);
        k.mesh.setMatrixAt(i, m4); if (k.out) k.out.setMatrixAt(i, m4);
      }
      k.mesh.instanceMatrix.needsUpdate = true; if (k.out) k.out.instanceMatrix.needsUpdate = true;
    }
  }

  drawPlan(); planTex.needsUpdate = true;
  placeLife(0);

  /* The blocks between the camera and the board fade to their drawn
     outline (a drawing's hidden-line convention, and the board stays in
     full view whatever the angle). camLocal: the camera in the board's
     frame. */
  const toCam = new THREE.Vector2();
  function fadeBlocks(camLocal) {
    toCam.set(camLocal.x, camLocal.z); const cd = toCam.length() || 1; toCam.divideScalar(cd);
    const camH = Math.max(0.5, camLocal.y);
    for (const b of blocks) {
      const d = Math.hypot(b.x, b.z) || 1, cosA = (b.x * toCam.x + b.z * toCam.y) / d;
      // where the sightline from the camera to the board's near edge passes over this block
      const along = Math.min(cd, d), sight = camH * Math.max(0, (along - Math.min(EX, EZ)) / Math.max(0.1, cd - Math.min(EX, EZ)));
      const inFront = cosA > 0.55 && d < cd && b.h > sight * 0.85;
      const target = inFront ? 0.14 : 1;
      b.fade += (target - b.fade) * 0.15;
      b.fillM.opacity = b.fade; b.fillM.depthWrite = b.fade > 0.98; b.lineM.opacity = 0.35 + 0.37 * b.fade;
    }
  }

  return {
    group,
    // Redraw the plan once the lettering's fonts have arrived.
    redraw() { drawPlan(); planTex.needsUpdate = true; },
    tick(nowSec, camLocal) {
      placeLife(nowSec);
      if (camLocal) {
        fadeBlocks(camLocal);
        // the plan's words turn to face the camera's side of the board
        const want = flipped ? camLocal.z < 1.5 : camLocal.z < -1.5;
        if (want !== flipped) { flipped = want; drawPlan(); planTex.needsUpdate = true; }
      }
    },
    dispose() {
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose && o.dispose(); });
      disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* gone */ } });
      disposables.length = 0;
    },
  };
}
