/* Version 5, "Build": the board itself turns into the poster's shapes.
     v1: the camera turns the board to an isometric corner; the light pieces
         slide into a staircase and rise as cubes, the walls fold up, the
         floor becomes the room's tiles, the frame and the sunburst come in.
     v2: the board grows into a cube seen corner-on; a cube half its size
         turns out of it, the triangle draws itself, the rays shoot out.
     v5: the pieces lift away; the board's squares slide into stripes and
         bend into rings, the table turns to paper. */
import { W, H, V1, V2, V5, posterCanvas, hexPoints, poly, wedge, v1Frame, v2Fans, v5Stripes, v5Rings } from "./posters.js";
import { BOARD, XS, YS, REST, PHOTO, drawStart } from "./board.js";
import { clamp, lerp, span, smooth, smoother, easeIn, easeOut, easeInOut, backOut, hex, mix, mixRgb, rgb, canvas } from "./anim.js";
import { makeCam, superellipse, drawPrism, planeXform, pathPts, ISO_EPS } from "./iso3d.js";

const k = REST.k;
const kx = k, ky = ((XS[10] - XS[0]) * k) / (YS[10] - YS[0]); // the playable 10 x 10 made exactly square
const BW = PHOTO.w * kx, BH = PHOTO.h * ky; // the board in world units
const SQ = (XS[10] - XS[0]) * kx / 10; // one square
const CENTER = [BW / 2, BH / 2, 0];

// The camera at rest: straight down, as the photo sits in the opening frame.
function restCam(t) {
  return { phi: 0, eps: 90, sigma: 1 + 0.012 * Math.min(1, t / 0.8), pivot: CENTER, screen: [REST.cx, REST.cy], yScale: k / ky };
}
const blendCam = (a, b, u, uz = u) => ({
  phi: lerp(a.phi, b.phi, u), eps: lerp(a.eps, b.eps, u), sigma: lerp(a.sigma, b.sigma, uz),
  pivot: [0, 1, 2].map((i) => lerp(a.pivot[i], b.pivot[i], uz)), screen: [0, 1].map((i) => lerp(a.screen[i], b.screen[i], uz)), yScale: lerp(a.yScale, b.yScale, u),
});

// Pieces in world units: centre, half sizes, shape exponent, height.
function worldPieces() {
  return BOARD.pieces.map((p) => ({
    ...p,
    wx: p.cx * kx, wy: p.cy * ky,
    a: ((p.box[2] - p.box[0]) / 2) * kx, b: ((p.box[3] - p.box[1]) / 2) * ky,
    pe: p.circle ? 2 : 9,
    h0: (p.kind === "opa" ? 0.62 : 0.48) * SQ,
    wood: p.side === "light" ? [hex("#C9A574"), hex("#8F6E48")] : [hex("#7A4A2A"), hex("#4A2C18")],
  }));
}

// The board's top: the clean photo laid on the slab's top face.
function boardTop(ctx, cam, src) {
  ctx.save();
  planeXform(ctx, cam, 0, 0, 0, kx, ky);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

function slabSides(ctx, cam, x0, y0, x1, y1, z0, z1, colX, colY, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const faces = [
    [[1, 0], [[x1, y0], [x1, y1]], colX],
    [[0, 1], [[x1, y1], [x0, y1]], colY],
    [[-1, 0], [[x0, y1], [x0, y0]], colY],
    [[0, -1], [[x0, y0], [x1, y0]], colX],
  ];
  for (const [[nx, ny], [[ax, ay], [bx, by]], col] of faces) {
    if (!cam.faces(nx, ny, 0)) continue;
    pathPts(ctx, [cam.proj(ax, ay, z0), cam.proj(bx, by, z0), cam.proj(bx, by, z1), cam.proj(ax, ay, z1)]);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.restore();
}

// A soft glint of the lamp sliding over the board as it turns.
function glint(ctx, cam, amount, pos) {
  if (amount <= 0) return;
  ctx.save();
  pathPts(ctx, [cam.proj(0, 0), cam.proj(BW, 0), cam.proj(BW, BH), cam.proj(0, BH)]);
  ctx.clip();
  const a = cam.proj(lerp(-BW * 0.3, BW * 1.3, pos), 0), b = cam.proj(lerp(-BW * 0.3, BW * 1.3, pos) + BW * 0.25, BH);
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, "rgba(255,230,190,0)");
  g.addColorStop(0.5, `rgba(255,230,190,${0.22 * amount})`);
  g.addColorStop(1, "rgba(255,230,190,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------------- v1 ---------------- */

const D1 = [XS[0] * kx, YS[0] * ky, 0]; // the room's deep corner: the playable area's top left
const L1 = (XS[10] - XS[0]) * kx / 3; // one cube
const ISO1 = { phi: 45, eps: ISO_EPS, sigma: V1.s / (Math.sqrt(2 / 3) * L1), pivot: D1, screen: V1.C, yScale: 1 };
// Which light piece becomes which column (x, y): the Opa, the biggest, the tallest at the back.
const TARGET1 = { opa: [0, 0], flaco: [0, 1], turrito: [1, 1], cabeza: [1, 0], chato: [2, 0] };
const ORDER1 = ["opa", "flaco", "cabeza", "turrito", "chato"];

function buildV1(ctx, t) {
  if (t < 0.6) return drawStart(ctx, t);
  const u = easeInOut(span(t, 0.75, 2.15)), uz = easeInOut(span(t, 0.75, 2.25));
  const cam = makeCam(blendCam(restCam(t), ISO1, u, uz));
  const D = D1, L = L1;
  const fFloor = smooth(span(t, 1.95, 2.8)); // the photo becomes the room's floor
  const fWalls = span(t, 2.05, 2.95);
  const fFrame = span(t, 2.55, 3.35);
  const fBg = smooth(span(t, 1.9, 2.5));
  const out = 1 - smooth(span(t, 2.1, 2.9)); // the board's border and sides

  // the table, then the road and the rays
  ctx.drawImage(BOARD.ground, 0, 0);
  if (fBg > 0) { ctx.globalAlpha = fBg; ctx.fillStyle = V1.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  raysV1(ctx, t);
  // the dark frame, growing out from the room's edge with a little give
  if (fFrame > 0) {
    ctx.save();
    ctx.globalAlpha = smooth(fFrame * 2.5);
    const [cx, cy] = V1.C, s = lerp(V1.room / V1.R, 1, backOut(fFrame, 1.4));
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    v1Frame(ctx);
    ctx.restore();
  }
  // the back walls rise from the floor's back edges
  if (fWalls > 0) wallsV1(ctx, cam, backOut(fWalls, 0.9), smooth(fWalls * 4));

  // the board: its sides and border go as it becomes the floor
  slabSides(ctx, cam, 0, 0, BW, BH, -44, 0, "#5C3A22", "#3E2616", out);
  ctx.save();
  if (out < 1) {
    // only the playable square stays
    const P = (x, y) => cam.proj(x, y, 0);
    const keep = new Path2D();
    [[0, 0], [BW, 0], [BW, BH], [0, BH]].forEach(([x, y], i) => (i ? keep.lineTo(...P(x, y)) : keep.moveTo(...P(x, y))));
    keep.closePath();
    ctx.globalAlpha = out;
    ctx.save();
    ctx.clip(keep);
    boardTop(ctx, cam, BOARD.clean);
    ctx.restore();
    ctx.globalAlpha = 1;
    const sq = new Path2D();
    [[D[0], D[1]], [D[0] + 3 * L, D[1]], [D[0] + 3 * L, D[1] + 3 * L], [D[0], D[1] + 3 * L]].forEach(([x, y], i) => (i ? sq.lineTo(...P(x, y)) : sq.moveTo(...P(x, y))));
    sq.closePath();
    ctx.clip(sq);
  }
  boardTop(ctx, cam, BOARD.clean);
  ctx.restore();
  glint(ctx, cam, smooth(span(t, 0.8, 1.2)) * (1 - smooth(span(t, 1.7, 2.1))), span(t, 0.8, 2.1));
  if (fFloor > 0) {
    const P = (x, y) => cam.proj(x, y, 0);
    ctx.save();
    ctx.lineJoin = "round";
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      // the tiles come in from the front corner back
      const a = smooth(span(fFloor * 1.7 - (4 - i - j) * 0.17, 0, 0.4));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      pathPts(ctx, [P(D[0] + i * L, D[1] + j * L), P(D[0] + (i + 1) * L, D[1] + j * L), P(D[0] + (i + 1) * L, D[1] + (j + 1) * L), P(D[0] + i * L, D[1] + (j + 1) * L)]);
      ctx.fillStyle = (i + j) % 2 ? V1.floorB : V1.floorA;
      ctx.fill();
      ctx.strokeStyle = V1.line;
      ctx.lineWidth = 5 * a;
      ctx.stroke();
    }
    ctx.restore();
  }

  // the pieces: the dark ones sink into the board, the light ones become the staircase
  const items = [];
  for (const p of worldPieces()) {
    if (p.side === "dark") {
      const s = easeIn(span(t, 0.8, 1.5));
      if (s >= 1) continue;
      items.push({ depth: cam.depth(p.wx, p.wy, 0), draw: () => pieceAsPrism(ctx, cam, p, { x: p.wx, y: p.wy, a: p.a, b: p.b, pe: p.pe, z0: 0, z1: p.h0 * (1 - s), alpha: 1 - smooth(span(s, 0.6, 1)), m: 0 }) });
      continue;
    }
    const [ti, tj] = TARGET1[p.kind];
    const n = ORDER1.indexOf(p.kind);
    // first each slides into its square, swelling to fill it; then they rise, one after another
    const m = span(t, 1.2 + 0.1 * n, 2.6 + 0.1 * n);
    const slide = easeInOut(span(m, 0, 0.55));
    const hT = V1.heights[ti][tj] * L;
    const tx = D[0] + (ti + 0.5) * L, ty = D[1] + (tj + 0.5) * L;
    const lift = 0.12 * L * Math.sin(Math.PI * span(m, 0, 0.55));
    const st = {
      x: lerp(p.wx, tx, slide), y: lerp(p.wy, ty, slide),
      a: lerp(p.a, L / 2, slide), b: lerp(p.b, L / 2, slide),
      pe: Math.exp(lerp(Math.log(p.pe), Math.log(80), smooth(span(m, 0.05, 0.5)))),
      z0: lift, z1: 0, m, col: [ti, tj],
    };
    st.z1 = st.z0 + lerp(p.h0 * lerp(1, 0.6, slide), hT, backOut(span(m, 0.45, 1), 1.3));
    items.push({ depth: cam.depth(st.x, st.y, (st.z0 + st.z1) / 2), draw: () => pieceAsPrism(ctx, cam, p, st) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  // (the opening photo, its pieces' own shadows and all, gives way to the model of it)
  const op = 1 - span(t, 0.6, 0.75);
  if (op > 0) { ctx.globalAlpha = op; drawStart(ctx, t); ctx.globalAlpha = 1; }

  // the poster itself settles over everything
  const fin = smooth(span(t, 3.45, 3.8));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(posterCanvas("v1", { title: false }), 0, 0); ctx.globalAlpha = 1; }
}

function pieceAsPrism(ctx, cam, p, st) {
  const m = st.m ?? 0;
  // once all but square, a true box (its corners sharp, its edges drawn)
  const foot = st.pe > 40 ? [[st.x - st.a, st.y - st.b], [st.x + st.a, st.y - st.b], [st.x + st.a, st.y + st.b], [st.x - st.a, st.y + st.b]] : superellipse(st.x, st.y, st.a, st.b, st.pe, 64);
  const toPoster = smooth(span(m, 0.35, 0.95));
  const [ti, tj] = st.col || [0, 0];
  const rightC = hex(V1.right), leftC = hex(tj >= 1 ? V1.leftLit : V1.leftDark), topC = hex(V1.top);
  ctx.save();
  ctx.globalAlpha = st.alpha ?? 1;
  drawPrism(ctx, cam, foot, st.z0, st.z1, {
    side: (nx, ny) => {
      // lit from the right as in the photo; the poster's faces as it becomes a cube
      const f = clamp(0.5 + 0.5 * (nx - ny));
      const wood = mixRgb(p.wood[1], p.wood[0], f);
      const post = mixRgb(leftC, rightC, smooth(span(f, 0.3, 0.7)));
      return rgb(mixRgb(wood, post, toPoster));
    },
    top: rgb(mixRgb(mixRgb(p.wood[0], [255, 240, 220], 0.1), topC, toPoster)),
    topImage: toPoster < 1 ? (c) => {
      // the piece's own top from the photo, stretched to its new footprint
      c.globalAlpha *= 1 - toPoster;
      const [x0, y0, x1, y1] = p.box;
      const sx = (2 * st.a) / ((x1 - x0) * kx), sy = (2 * st.b) / ((y1 - y0) * ky);
      planeXform(c, cam, st.x - st.a - (x0 - p.ox) * kx * sx, st.y - st.b - (y0 - p.oy) * ky * sy, st.z1, kx * sx, ky * sy);
      c.drawImage(p.sprite, 0, 0);
    } : null,
    stroke: V1.line,
    lineWidth: 5 * smooth(span(m, 0.5, 0.9)),
    strokeSides: smooth(span(m, 0.7, 1)),
  });
  ctx.restore();
}

function wallsV1(ctx, cam, f, alpha) {
  const D = D1, L = L1, h = 3 * L * f;
  const P = (x, y, z) => cam.proj(x, y, z);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = V1.line;
  pathPts(ctx, [P(D[0], D[1], 0), P(D[0], D[1] + 3 * L, 0), P(D[0], D[1] + 3 * L, h), P(D[0], D[1], h)]);
  ctx.fillStyle = V1.wallL;
  ctx.fill();
  ctx.stroke();
  pathPts(ctx, [P(D[0], D[1], 0), P(D[0] + 3 * L, D[1], 0), P(D[0] + 3 * L, D[1], h), P(D[0], D[1], h)]);
  ctx.fillStyle = V1.wallR;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// The sunburst: each ray shoots out from behind the hexagon, the top one first.
function raysV1(ctx, t) {
  const [cx, cy] = V1.C;
  V1.rays.slice(0, -1).forEach(([a0, a1, col], i) => {
    const r = easeOut(span(t, 2.25 + 0.11 * i, 2.95 + 0.11 * i));
    if (r <= 0) return;
    ctx.fillStyle = col;
    for (const sgn of [1, -1]) {
      wedge(ctx, cx, cy, sgn * a0, sgn * a1, lerp(V1.room * 0.9, 2300, r));
      ctx.fill();
    }
  });
}

/* ---------------- v2 ---------------- */

/* The board grows down into a cube seen corner-on (its outline is the
   poster's hexagon); the pieces line up on its near quarter, which sinks
   into the cube and leaves a corner-shaped hollow: the small inverted cube
   at the poster's middle. Then lines run from each face's far corner to the
   hollow's corners, the faces flatten into the poster's facets, and the
   rays shoot out. */
const A2 = BW; // the cube's edge
const ISO2 = { phi: 45, eps: ISO_EPS, sigma: V2.R / (Math.sqrt(2 / 3) * A2), pivot: [BW, BH, 0], screen: V2.C, yScale: 1 };
// Where each piece lines up on the near quarter: light in a row behind, dark in front.
const LINEUP2 = {
  light: { flaco: [0.565, 0.62], turrito: [0.64, 0.62], cabeza: [0.715, 0.62], chato: [0.795, 0.62], opa: [0.885, 0.6] },
  dark: { flaco: [0.565, 0.82], cabeza: [0.64, 0.84], turrito: [0.715, 0.84], chato: [0.795, 0.82], opa: [0.885, 0.82] },
};

function buildV2(ctx, t) {
  if (t < 0.6) return drawStart(ctx, t);
  const u = easeInOut(span(t, 0.75, 2.15)), uz = easeInOut(span(t, 0.75, 2.25));
  const cam = makeCam(blendCam(restCam(t), ISO2, u, uz));
  const Z = lerp(44, A2, easeInOut(span(t, 1.15, 2.25)));
  const d = (A2 / 2) * easeInOut(span(t, 1.95, 2.6)); // the near quarter sinking
  const h2 = A2 / 2, X0 = BW / 2, Y0 = BH / 2;

  ctx.drawImage(BOARD.ground, 0, 0);
  const fBg = smooth(span(t, 2.3, 2.9));
  if (fBg > 0) { ctx.globalAlpha = fBg; ctx.fillStyle = V2.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // the rays shoot out to the sides, the middle stripe first
  fansV2(ctx, t);

  // the cube: its two near faces, then the board on top
  slabSides(ctx, cam, 0, 0, BW, BH, -Z, 0, "#5C3A22", "#3E2616");
  boardTop(ctx, cam, BOARD.clean);
  glint(ctx, cam, smooth(span(t, 0.8, 1.2)) * (1 - smooth(span(t, 1.7, 2.1))), span(t, 0.8, 2.1));

  // the pieces, lining up on the near quarter
  const pcs = worldPieces().map((p) => {
    const [fx, fy] = LINEUP2[p.side][p.kind];
    const n = (p.side === "light" ? 0 : 5) + ["flaco", "turrito", "cabeza", "chato", "opa"].indexOf(p.kind);
    const m = easeInOut(span(t, 0.95 + 0.06 * n, 1.75 + 0.06 * n));
    const hop = 0.5 * SQ * Math.sin(Math.PI * m);
    const sink = span(t, 1.95, 2.45);
    return { p, x: lerp(p.wx, fx * BW, m), y: lerp(p.wy, fy * BH, m), z0: hop, h: p.h0 * (1 - easeIn(sink)), alpha: 1 - smooth(span(sink, 0.55, 1)) };
  });
  const drawPieces = (zBase) => {
    const list = pcs.filter((q) => q.alpha > 0 && q.h > 0.5).map((q) => ({ q, depth: cam.depth(q.x, q.y, zBase + q.z0) }));
    list.sort((a, b) => a.depth - b.depth);
    for (const { q } of list) pieceAsPrism(ctx, cam, q.p, { x: q.x, y: q.y, a: q.p.a, b: q.p.b, pe: q.p.pe, z0: zBase + q.z0, z1: zBase + q.z0 + q.h, alpha: q.alpha, m: 0 });
  };

  if (d <= 0) drawPieces(0);
  else {
    // the hollow: the near quarter's block going down into the cube
    const P = (x, y, z) => cam.proj(x, y, z);
    const hole = [P(X0, Y0, 0), P(BW, Y0, 0), P(BW, Y0, -h2), P(BW, BH, -h2), P(X0, BH, -h2), P(X0, BH, 0)];
    ctx.save();
    pathPts(ctx, hole);
    ctx.clip();
    pathPts(ctx, [P(X0, Y0, 0), P(X0, BH, 0), P(X0, BH, -h2), P(X0, Y0, -h2)]);
    ctx.fillStyle = "#B8875A"; // the cut wood, lit
    ctx.fill();
    pathPts(ctx, [P(X0, Y0, 0), P(BW, Y0, 0), P(BW, Y0, -h2), P(X0, Y0, -h2)]);
    ctx.fillStyle = "#8A603D";
    ctx.fill();
    // the block: its top is the board's near quarter, its near faces the cube's
    slabSides(ctx, cam, X0, Y0, BW, BH, -d - h2, -d, "#5C3A22", "#3E2616");
    ctx.save();
    pathPts(ctx, [P(X0, Y0, -d), P(BW, Y0, -d), P(BW, BH, -d), P(X0, BH, -d)]);
    ctx.clip();
    ctx.save();
    planeXform(ctx, cam, 0, 0, -d, kx, ky);
    ctx.drawImage(BOARD.clean, 0, 0);
    ctx.restore();
    ctx.restore();
    drawPieces(-d);
    ctx.restore();
  }
  const op = 1 - span(t, 0.6, 0.75);
  if (op > 0) { ctx.globalAlpha = op; drawStart(ctx, t); ctx.globalAlpha = 1; }

  // the figure: lines from each face's far corner, then the faces flatten into facets
  figureV2(ctx, t);
  const fin = smooth(span(t, 3.9, 4.2));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(posterCanvas("v2", { title: false }), 0, 0); ctx.globalAlpha = 1; }
}

function figureV2(ctx, t) {
  const Pt = V2.pts;
  const lineT = span(t, 2.45, 3.05), fillT = span(t, 2.65, 3.35);
  if (lineT <= 0) return;
  // the facets, each as its lines close round it
  const order = [3, 4, 5, 6, 7, 8, 0, 1, 2, 9, 10, 11];
  ctx.save();
  order.forEach((fi, i) => {
    const a = smooth(span(fillT * 1.8 - i * 0.07, 0, 0.45));
    if (a <= 0) return;
    const [pts, col] = V2.facets[fi];
    ctx.globalAlpha = a;
    poly(ctx, pts);
    ctx.fillStyle = col;
    ctx.fill();
  });
  ctx.restore();
  // the construction lines, from the three far corners out to the hollow's corners
  const lines = [
    [Pt.T, Pt.ULi], [Pt.T, Pt.Ti], [Pt.T, Pt.URi],
    [Pt.LL, Pt.ULi], [Pt.LL, Pt.LLi], [Pt.LL, Pt.Bi],
    [Pt.LR, Pt.URi], [Pt.LR, Pt.LRi], [Pt.LR, Pt.Bi],
  ];
  ctx.save();
  ctx.strokeStyle = V2.line;
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  lines.forEach(([a, b], i) => {
    const k = easeInOut(span(lineT * 1.6 - (i % 3) * 0.12 - Math.floor(i / 3) * 0.08, 0, 0.6));
    if (k <= 0) return;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(lerp(a[0], b[0], k), lerp(a[1], b[1], k));
    ctx.stroke();
  });
  // the hollow's own edges and the outline, drawn in with the first lines
  ctx.globalAlpha = smooth(lineT * 3);
  ctx.lineJoin = "round";
  for (const pts of [[Pt.Ti, Pt.URi, Pt.LRi, Pt.Bi, Pt.LLi, Pt.ULi]]) { poly(ctx, pts); ctx.stroke(); }
  ctx.beginPath();
  for (const q of [Pt.Ti, Pt.LLi, Pt.LRi]) { ctx.moveTo(Pt.C[0], Pt.C[1]); ctx.lineTo(q[0], q[1]); }
  ctx.stroke();
  poly(ctx, hexPoints(V2.C[0], V2.C[1], V2.R));
  ctx.stroke();
  ctx.restore();
}

function fansV2(ctx, t) {
  const [cx, cy] = V2.C;
  const n = V2.fan.length, sp = V2.spread;
  ctx.save();
  for (let i = 0; i < n; i++) {
    // from the middle stripe out
    const r = easeOut(span(t, 3.05 + 0.07 * Math.abs(i - (n - 1) / 2), 3.6 + 0.07 * Math.abs(i - (n - 1) / 2)));
    if (r <= 0) continue;
    const a0 = -sp + (2 * sp * i) / n, a1 = -sp + (2 * sp * (i + 1)) / n;
    const R = lerp(V2.R * 0.8, 1400, r);
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const a of [a0, a1]) ctx.lineTo(cx + side * R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180));
      ctx.closePath();
      ctx.fillStyle = V2.fan[i];
      ctx.fill();
      ctx.strokeStyle = V2.line;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------------- v5 ---------------- */

/* The pieces lift off and fly away; the board slides to the poster's square
   and the table turns to paper; the board's fold opens into the gap between
   the rows; two quarters' columns slide into the stripes, the other two
   quarters' squares bend into the rings, and their colours come in. */
const PLAY = { x: REST.x + XS[0] * k, y: REST.y + YS[0] * k, w: (XS[10] - XS[0]) * k, h: (YS[10] - YS[0]) * k };
let SQ5 = null; // the board's playable square at the poster's size, and its pixels
function sq5() {
  if (SQ5) return SQ5;
  const c = canvas(V5.S, V5.S);
  c.getContext("2d").drawImage(BOARD.clean, XS[0], YS[0], XS[10] - XS[0], YS[10] - YS[0], 0, 0, V5.S, V5.S);
  SQ5 = { c, px: c.getContext("2d").getImageData(0, 0, V5.S, V5.S).data };
  return SQ5;
}
// Columns to stripes: each of a quarter's five columns ends as [from, to] of the stripes (two share one).
const COLS5 = {
  tl: [[0, 0.315, 0], [0.315, 0.472, 1], [0.472, 0.6015, 2], [0.6015, 0.731, 2], [0.731, 1, 3]],
  br: [[0, 0.27, 0], [0.27, 0.399, 1], [0.399, 0.528, 1], [0.528, 0.685, 2], [0.685, 1, 3]],
};

function buildV5(ctx, t) {
  if (t < 0.6) return drawStart(ctx, t);
  const S = sq5();
  const q = V5.q;
  // where the playable square is: from where it lies on the board to the poster's square
  const mv = easeInOut(span(t, 1.0, 1.9));
  const bx = lerp(PLAY.x, V5.x, mv), by = lerp(PLAY.y, V5.y, mv), bw = lerp(PLAY.w, V5.S, mv), bh = lerp(PLAY.h, V5.S, mv);
  const sx = bw / PLAY.w, sy = bh / PLAY.h;

  // the table, the paper spreading out from under the board
  ctx.drawImage(BOARD.ground, 0, 0);
  const paper = easeInOut(span(t, 1.1, 2.3));
  if (paper > 0) {
    // spreading out from under the board like light, a soft edge ahead of it
    const cx = bx + bw / 2, cy = by + bh / 2, r = lerp(380, 1500, paper), soft = 260;
    const g = ctx.createRadialGradient(cx, cy, Math.max(0, r - soft), cx, cy, r);
    g.addColorStop(0, V5.paper);
    g.addColorStop(1, "rgba(242,214,176,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // the whole board while it still has its border and frame
  const rim = 1 - smooth(span(t, 1.15, 1.75));
  if (rim > 0) {
    ctx.save();
    ctx.globalAlpha = rim;
    const x = bx - XS[0] * k * sx, y = by - YS[0] * k * sy;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 22;
    ctx.drawImage(BOARD.clean, x, y, PHOTO.w * k * sx, PHOTO.h * k * sy);
    ctx.restore();
  }
  // the four quarters, the fold opening into the gap
  const gap = V5.gap * easeInOut(span(t, 1.8, 2.25));
  const qh = (bh - gap) / 2;
  const Q = {
    tl: [bx, by, bw / 2, qh, 0, 0], tr: [bx + bw / 2, by, bw / 2, qh, q, 0],
    bl: [bx, by + qh + gap, bw / 2, qh, 0, q], br: [bx + bw / 2, by + qh + gap, bw / 2, qh, q, q],
  };
  const bend = smoother(span(t, 2.05, 3.0)), ringIn = span(t, 2.6, 3.45);
  for (const key of ["tl", "tr", "bl", "br"]) {
    const [x, y, w, h, ox, oy] = Q[key];
    if (key === "tl" || key === "br") stripesV5(ctx, t, key, S, x, y, w, h, ox, oy);
    else ctx.drawImage(ringsV5(key, S, bend, ringIn), x, y, w, h);
  }
  // the half-moons over the stripes
  const dIn = easeOut(span(t, 3.0, 3.6));
  if (dIn > 0) for (const key of ["tl", "br"]) {
    const [x, y, w, h] = Q[key];
    const d = V5[key + "D"];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(x + d.cx * w, y + h / 2, d.rx * w * dIn, h * 0.487, 0, d.side < 0 ? Math.PI / 2 : -Math.PI / 2, d.side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = V5.shade;
    ctx.fill();
    ctx.restore();
  }

  // the pieces lift off and fly away, the light ones up, the dark ones down
  BOARD.pieces.forEach((p, i) => {
    const t0 = 0.7 + 0.05 * i;
    const lift = easeOut(span(t, t0, t0 + 0.25));
    const fly = easeIn(span(t, t0 + 0.15, t0 + 0.95));
    if (fly >= 1) return;
    const up = p.side === "light" ? -1 : 1;
    const dx = (p.cx - PHOTO.w / 2) * k * 0.6 * fly, dy = up * 1500 * fly;
    ctx.save();
    const [fx, fy] = [REST.x + p.cx * k, REST.y + p.cy * k];
    ctx.translate(fx + dx, fy + dy);
    ctx.rotate(up * (p.cx > PHOTO.w / 2 ? 1 : -1) * 0.5 * fly);
    ctx.translate(-fx, -fy);
    drawPieceLifted(ctx, p, lift);
    ctx.restore();
  });
  const op = 1 - span(t, 0.6, 0.72);
  if (op > 0) { ctx.globalAlpha = op; drawStart(ctx, t); ctx.globalAlpha = 1; }

  const fin = smooth(span(t, 3.6, 3.95));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(posterCanvas("v5", { title: false }), 0, 0); ctx.globalAlpha = 1; }
}

function drawPieceLifted(ctx, p, lift) {
  const kk = k * (1 + 0.14 * lift);
  const cx = REST.x + p.cx * k, cy = REST.y + p.cy * k - 24 * lift;
  const w = p.sprite.width * kk, h = p.sprite.height * kk;
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${0.5 * lift})`;
  ctx.shadowBlur = 8 + 36 * lift;
  ctx.shadowOffsetX = -12 * lift;
  ctx.shadowOffsetY = 30 * lift;
  ctx.drawImage(p.sprite, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// A quarter of columns sliding into stripes, their colours dropping in square by square.
function stripesV5(ctx, t, key, S, x, y, w, h, ox, oy) {
  const cols = COLS5[key], q = V5.q;
  const slide = easeInOut(span(t, 2.0, 2.85));
  for (let c = 0; c < 5; c++) {
    const [e0, e1, si] = cols[c];
    const x0 = x + w * lerp(c / 5, e0, slide), x1 = x + w * lerp((c + 1) / 5, e1, slide);
    const col = V5[key][si][2];
    for (let r = 0; r < 5; r++) {
      const y0 = y + (h * r) / 5, y1 = y + (h * (r + 1)) / 5;
      ctx.drawImage(S.c, ox + (c * q) / 5, oy + (r * q) / 5, q / 5, q / 5, x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5);
      // top to bottom on the left, bottom to top on the right
      const rr = key === "tl" ? r : 4 - r;
      const a = smooth(span(t, 2.15 + 0.1 * rr + 0.035 * c, 2.55 + 0.1 * rr + 0.035 * c));
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.fillRect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// A quarter of squares bending into rings round its corner (pixel by pixel), then the rings' colours.
const RINGBUF = {};
function ringsV5(key, S, bend, ringIn) {
  const q = Math.round(V5.q);
  if (!RINGBUF[key]) { const c = canvas(q, q); RINGBUF[key] = { c, g: c.getContext("2d"), im: c.getContext("2d").createImageData(q, q) }; }
  const { c, g, im } = RINGBUF[key];
  const out = im.data, src = S.px, SW = V5.S;
  const rings = (key === "tr" ? V5.trRings : V5.blRings).map(([r, col]) => [r, hex(col)]);
  const black = hex(V5.black);
  const ringCol = (r) => { for (const [rr, col] of rings) if (r < rr) return col; return black; };
  for (let j = 0; j < q; j++) {
    for (let i = 0; i < q; i++) {
      // distances from the quarter's corner along its two edges
      const u = key === "tr" ? q - 0.5 - i : i + 0.5, v = key === "tr" ? j + 0.5 : q - 0.5 - j;
      const linf = Math.max(u, v), l2 = Math.hypot(u, v);
      const rho = lerp(linf, l2, bend);
      const f = rho / (linf || 1);
      const us = u * f, vs = v * f;
      let R, G, B;
      if (Math.max(us, vs) > q) { [R, G, B] = black; }
      else {
        // back into the board square's pixels
        const sx = key === "tr" ? SW - us : us, sy = key === "tr" ? vs : SW - vs;
        const x0 = Math.min(SW - 2, Math.max(0, Math.floor(sx - 0.5))), y0 = Math.min(SW - 2, Math.max(0, Math.floor(sy - 0.5)));
        const fx = clamp(sx - 0.5 - x0), fy = clamp(sy - 0.5 - y0);
        const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
        R = (src[i00] * (1 - fx) + src[i10] * fx) * (1 - fy) + (src[i01] * (1 - fx) + src[i11] * fx) * fy;
        G = (src[i00 + 1] * (1 - fx) + src[i10 + 1] * fx) * (1 - fy) + (src[i01 + 1] * (1 - fx) + src[i11 + 1] * fx) * fy;
        B = (src[i00 + 2] * (1 - fx) + src[i10 + 2] * fx) * (1 - fy) + (src[i01 + 2] * (1 - fx) + src[i11 + 2] * fx) * fy;
      }
      // the rings' colours, from the corner out
      const a = smooth((ringIn * 1.6 - (l2 / q) * 0.55) / 0.45);
      if (a > 0) { const rc = ringCol(l2 / q); R += (rc[0] - R) * a; G += (rc[1] - G) * a; B += (rc[2] - B) * a; }
      const o = (j * q + i) * 4;
      out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ---------------- the version ---------------- */

export const build = {
  settle: (id) => ({ v1: 3.8, v2: 4.2, v5: 3.95 })[id],
  frame(ctx, id, t) {
    if (id === "v1") return buildV1(ctx, t);
    if (id === "v2") return buildV2(ctx, t);
    if (id === "v5") return buildV5(ctx, t);

  },
};
