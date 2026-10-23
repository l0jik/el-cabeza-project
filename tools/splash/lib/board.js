/* The user's photo of their board (1647 x 1666, straight down, a lamp to the
   right): where its squares and pieces are, the board with the pieces
   lifted off (each square under a piece replaced by an empty one of the same
   colour from the same column), each piece as its own cut-out, and the
   opening frame (the board on a dark table). */
import { W, H } from "./posters.js";
import { LAND } from "./size.js";

// The playable 10 x 10: grid-line centres in the photo.
export const XS = [107, 243, 387, 534, 681, 822, 964, 1108, 1255, 1399, 1534];
export const YS = [115, 263, 406, 553, 701, 843, 991, 1138, 1278, 1422, 1557];
// The dark border ring round it and the frame's edge.
export const RING = { x0: 28, x1: 1604, y0: 35, y1: 1638 };
export const PHOTO = { w: 1647, h: 1666 };

// Pieces: side, which (the game's five a side: the Cabeza is the disc, the
// Opa the big 2 x 2, the Turrito the small cube, the Flaco and the taller
// Chato the 1 x 2s), box in the photo (x0, y0, x1, y1), corner radius.
export const PIECES = [
  { side: "light", kind: "flaco", box: [542, 110, 655, 360], r: 12 },
  { side: "light", kind: "turrito", box: [692, 90, 802, 232], r: 12 },
  { side: "light", kind: "cabeza", circle: [891.5, 171.5, 57] },
  { side: "light", kind: "chato", box: [985, 52, 1112, 342], r: 12 },
  { side: "light", kind: "opa", box: [718, 228, 942, 505], r: 14 },
  { side: "dark", kind: "opa", box: [723, 1168, 948, 1392], r: 14 },
  { side: "dark", kind: "flaco", box: [538, 1322, 657, 1552], r: 12 },
  { side: "dark", kind: "cabeza", circle: [751, 1500, 57] },
  { side: "dark", kind: "turrito", box: [850, 1442, 962, 1556], r: 10 },
  { side: "dark", kind: "chato", box: [977, 1317, 1097, 1535], r: 12 },
];
for (const p of PIECES) {
  if (p.circle) { const [cx, cy, r] = p.circle; p.box = [cx - r, cy - r, cx + r, cy + r]; }
  p.cx = (p.box[0] + p.box[2]) / 2;
  p.cy = (p.box[1] + p.box[3]) / 2;
}

// Squares under the pieces (and their shadows, cast to the left): [col, row].
const UNDER = [[3, 0], [3, 1], [4, 0], [5, 0], [6, 0], [6, 1], [4, 1], [5, 1], [4, 2], [5, 2],
  [4, 7], [5, 7], [4, 8], [5, 8], [3, 8], [3, 9], [4, 9], [5, 9], [6, 8], [6, 9], [2, 8], [2, 9]];
// The ring's cells over cols 3, 4 and 6 at the top, from cols 1, 8 and 9.
const RING_FIX = [[3, 1], [4, 8], [6, 9]];

// At rest in the frame: the whole photo, 980 wide, centred at (540, 900);
// on the wide frame 820 wide on the left, where the emblem comes.
export const REST = LAND ? { w: 820, cx: 530, cy: 540 } : { w: 980, cx: 540, cy: 900 };
REST.k = REST.w / PHOTO.w;
REST.h = PHOTO.h * REST.k;
REST.x = REST.cx - REST.w / 2;
REST.y = REST.cy - REST.h / 2;
export const toFrame = (px, py) => [REST.x + px * REST.k, REST.y + py * REST.k];

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export const BOARD = { photo: null, clean: null, pieces: [], start: null, ground: null };

function roundRect(ctx, x0, y0, x1, y1, r) {
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r);
}

export async function loadBoard(url) {
  const img = await loadImage(url);
  const photo = document.createElement("canvas");
  photo.width = PHOTO.w;
  photo.height = PHOTO.h;
  photo.getContext("2d").drawImage(img, 0, 0);
  BOARD.photo = photo;

  // The clean board: each square under a piece from an empty one in its column, same colour.
  const clean = document.createElement("canvas");
  clean.width = PHOTO.w;
  clean.height = PHOTO.h;
  const c = clean.getContext("2d");
  c.drawImage(photo, 0, 0);
  const M = 6; // past the grid lines, feathered
  const px = photo.getContext("2d").getImageData(0, 0, PHOTO.w, PHOTO.h).data;
  // A cell's mean colour, inside its lines.
  const mean = (x0, y0, x1, y1) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let y = Math.round(y0 + 14); y < y1 - 14; y += 3) for (let x = Math.round(x0 + 14); x < x1 - 14; x += 3) {
      const i = (y * PHOTO.w + x) * 4;
      s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; n++;
    }
    return s.map((v) => v / n);
  };
  const under = new Set(UNDER.map(([c, r]) => `${c},${r}`));
  // What a square should look like where it lies: the same colour's squares either side in its row.
  const expected = (col, row) => {
    const near = [-2, 2, -4, 4].map((d) => col + d).filter((c) => c >= 0 && c < 10 && !under.has(`${c},${row}`)).slice(0, 2);
    const ms = near.map((c) => mean(XS[c], YS[row], XS[c + 1], YS[row + 1]));
    return ms[0].map((_, k) => ms.reduce((a, m) => a + m[k], 0) / ms.length);
  };
  const pasteCell = (sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, want = null) => {
    const tmp = document.createElement("canvas");
    const w = Math.round(dx1 - dx0 + 2 * M), h = Math.round(dy1 - dy0 + 2 * M);
    tmp.width = w;
    tmp.height = h;
    const t = tmp.getContext("2d");
    t.drawImage(photo, sx0 - M, sy0 - M, sx1 - sx0 + 2 * M, sy1 - sy0 + 2 * M, 0, 0, w, h);
    if (want) {
      // the copy's tone pulled to the light where it now lies (the lamp is to the right)
      const have = mean(sx0, sy0, sx1, sy1), gain = have.map((v, k) => want[k] / Math.max(1, v));
      const im = t.getImageData(0, 0, w, h);
      for (let i = 0; i < im.data.length; i += 4) for (let k = 0; k < 3; k++) im.data[i + k] = im.data[i + k] * gain[k];
      t.putImageData(im, 0, 0);
    }
    // feather the outer 4 px
    t.globalCompositeOperation = "destination-in";
    const f = 4;
    const gx = t.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(f / w, "rgba(0,0,0,1)"); gx.addColorStop(1 - f / w, "rgba(0,0,0,1)"); gx.addColorStop(1, "rgba(0,0,0,0)");
    t.fillStyle = gx;
    t.fillRect(0, 0, w, h);
    const gy = t.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, "rgba(0,0,0,0)"); gy.addColorStop(f / h, "rgba(0,0,0,1)"); gy.addColorStop(1 - f / h, "rgba(0,0,0,1)"); gy.addColorStop(1, "rgba(0,0,0,0)");
    t.fillStyle = gy;
    t.fillRect(0, 0, w, h);
    c.drawImage(tmp, dx0 - M, dy0 - M);
  };
  for (const [col, row] of UNDER) {
    // the nearest empty row (3..6) of the same colour, alternating so neighbours differ
    const cands = [3, 4, 5, 6].filter((r) => (r - row) % 2 === 0);
    const src = cands[(col + row) % cands.length];
    pasteCell(XS[col], YS[src], XS[col + 1], YS[src + 1], XS[col], YS[row], XS[col + 1], YS[row + 1], expected(col, row));
  }
  for (const [col, from] of RING_FIX) pasteCell(XS[from], RING.y0, XS[from + 1], YS[0], XS[col], RING.y0, XS[col + 1], YS[0]);
  BOARD.clean = clean;

  // Each piece cut out, with a soft edge.
  BOARD.pieces = PIECES.map((p) => {
    const pad = 6;
    const [x0, y0, x1, y1] = p.box;
    const w = Math.ceil(x1 - x0 + 2 * pad), h = Math.ceil(y1 - y0 + 2 * pad);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const t = cv.getContext("2d");
    t.filter = "blur(1.2px)";
    t.fillStyle = "#000";
    if (p.circle) { t.beginPath(); t.arc(p.circle[0] - x0 + pad, p.circle[1] - y0 + pad, p.circle[2], 0, Math.PI * 2); t.fill(); }
    else { roundRect(t, pad, pad, w - pad, h - pad, p.r); t.fill(); }
    t.filter = "none";
    t.globalCompositeOperation = "source-in";
    t.drawImage(photo, x0 - pad, y0 - pad, w, h, 0, 0, w, h);
    return { ...p, sprite: cv, ox: x0 - pad, oy: y0 - pad };
  });

  // The table under the board: dark, warm, lit from the board's side.
  const ground = document.createElement("canvas");
  ground.width = W;
  ground.height = H;
  const g = ground.getContext("2d");
  const rg = g.createRadialGradient(REST.cx + 120, REST.cy - 60, 80, REST.cx, REST.cy, 1250);
  rg.addColorStop(0, "#2a1b11");
  rg.addColorStop(0.55, "#170f0a");
  rg.addColorStop(1, "#090605");
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);
  BOARD.ground = ground;

  BOARD.start = drawStartCanvas();
  BOARD.startClean = drawStartCanvas({ clean: true });
}

// The board's drop shadow and the photo, into ctx at a transform.
export function drawBoardAt(ctx, src, x, y, w, h, shadow = 1) {
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.7 * shadow})`;
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 22;
    ctx.fillStyle = "#000";
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.restore();
  }
  ctx.drawImage(src, x, y, w, h);
}

function drawStartCanvas(opt = {}) {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.drawImage(BOARD.ground, 0, 0);
  drawBoardAt(ctx, opt.clean ? BOARD.clean : BOARD.photo, REST.x, REST.y, REST.w, REST.h);
  return cv;
}

// A piece's cut-out drawn where it lies on the board at rest, lifted by `lift` (0..1).
export function drawPiece(ctx, p, lift = 0, dx = 0, dy = 0, alpha = 1) {
  const k = REST.k * (1 + 0.12 * lift);
  const [fx, fy] = toFrame(p.cx, p.cy);
  const w = p.sprite.width * k, h = p.sprite.height * k;
  const cx = fx + dx, cy = fy + dy - 30 * lift;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (lift > 0) {
    ctx.shadowColor = `rgba(0,0,0,${0.55 * Math.min(1, lift * 1.5)})`;
    ctx.shadowBlur = 10 + 40 * lift;
    ctx.shadowOffsetX = -14 * lift;
    ctx.shadowOffsetY = 34 * lift;
  }
  ctx.drawImage(p.sprite, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// The opening: the board at rest, the camera easing in a touch.
export function drawStart(ctx, t = 0, push = 0.012) {
  const s = 1 + push * Math.min(1, t / 0.8);
  ctx.save();
  ctx.translate(REST.cx, REST.cy);
  ctx.scale(s, s);
  ctx.translate(-REST.cx, -REST.cy);
  ctx.drawImage(BOARD.start, 0, 0);
  ctx.restore();
}
