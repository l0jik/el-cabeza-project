/* The three posters the splash videos end on: versions 1, 2 and 5 of the
   user's collage of twenty, redrawn as clean vector art for a phone held
   upright (1080 x 1920) so they stay sharp at full screen (user: "Redraw
   them sharp").

     v1  a hexagon of cubes on a sunburst
     v2  a faceted hexagon, rays to the sides
     v5  four squares of stripes and arcs

   No taglines, and the only words are the name (user: "remove the taglines
   from all of them. The only text that should be on there is ... initially
   just the word El Cabeza ... then ... an additional splash of the added
   word Nova. Make these look refined and classy"): the title is drawn over
   the artwork (lockup.js), not into it, so the videos can bring it in on its
   own.

   Everything is drawn from geometry kept here (centres, radii, the room
   of cubes, the rings), so the videos can take a poster apart and build
   it up again from the same numbers. */
import { W, H } from "./size.js";
import { drawTitle } from "./lockup.js";
export { W, H };
const D2R = Math.PI / 180;

export const hexPoints = (cx, cy, r) => [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (-90 + 60 * i) * D2R;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}); // top, upper right, lower right, bottom, lower left, upper left

export function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// A wedge from (cx, cy) between two angles (degrees, 0 = straight up, clockwise).
export function wedge(ctx, cx, cy, a0, a1, r = 4000) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 6));
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * D2R;
    ctx.lineTo(cx + r * Math.sin(a), cy - r * Math.cos(a));
  }
  ctx.closePath();
}

/* ---------------- v1: the hexagon of cubes ---------------- */

export const V1 = {
  C: [540, 792],
  R: 392, // the dark frame's outer radius
  ringOut: 352, ringIn: 344, // the orange-brown line inside the frame
  room: 335, // the room of cubes: a 3 x 3 x 3 corner seen from above
  bg: "#22150F",
  frame: "#2A1A12",
  ring: "#9C5427",
  line: "#2A1A12",
  // Wedges from the hexagon's centre, degrees from straight up, mirrored.
  rays: [
    [0, 38, "#EEA74B"],
    [38, 60, "#E38832"],
    [60, 82, "#D25726"],
    [82, 104, "#A54D22"],
    [104, 128, "#71361A"],
    [128, 180, "#22150F"], // the dark road the title stands on
  ],
  top: "#E9B877", right: "#C46B2F", leftLit: "#8E4B26", leftDark: "#2B1B12",
  wallL: "#B4612C", wallR: "#C5733A",
  floorA: "#E7BD81", floorB: "#C77538",
  // Column heights of the staircase in the room's corner, h[x][y].
  heights: [[3, 2, 0], [2, 1, 0], [1, 0, 0]],
};
V1.s = V1.room / 3;
// The room's 3D point (x along the lower right, y along the lower left, z up) on screen.
V1.iso = (x, y, z, o = V1.C, s = V1.s) => [o[0] + (x - y) * s * Math.cos(30 * D2R), o[1] + (x + y) * s * 0.5 - z * s];

export function v1Rays(ctx, reveal = 1) {
  const [cx, cy] = V1.C;
  ctx.fillStyle = V1.bg;
  ctx.fillRect(0, 0, W, H);
  for (const [a0, a1, col] of V1.rays) {
    ctx.fillStyle = col;
    for (const sgn of [1, -1]) {
      // reveal: each wedge opens from its lower edge up, the lowest first
      const span = (a1 - a0) * Math.min(1, Math.max(0, reveal));
      if (span <= 0) continue;
      const b1 = a1, b0 = a1 - span;
      wedge(ctx, cx, cy, sgn * b0, sgn * b1);
      ctx.fill();
    }
  }
}

// The cubes, back to front, each with the faces a viewer can see.
export function v1Cubes(h = V1.heights) {
  const out = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < h[x][y]; z++) out.push({ x, y, z, top: z === h[x][y] - 1 });
  out.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
  return out;
}

export function v1CubeFaces(c, h = V1.heights) {
  const { x, y, z } = c;
  const H3 = (i, j) => (i < 3 && j < 3 ? h[i][j] : 0);
  const faces = [];
  if (z === H3(x, y) - 1) faces.push({ k: "top", pts: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], col: V1.top });
  if (H3(x + 1, y) <= z) faces.push({ k: "right", pts: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], col: V1.right });
  if (H3(x, y + 1) <= z) faces.push({ k: "left", pts: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], col: y >= 1 && z === H3(x, y) - 1 ? V1.leftLit : V1.leftDark });
  return faces;
}

export function v1Room(ctx, o = V1.C, s = V1.s, opt = {}) {
  const P = (x, y, z) => V1.iso(x, y, z, o, s);
  const lw = opt.lineWidth ?? 5;
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = V1.line;
  const face = (pts, col) => {
    poly(ctx, pts.map((p) => P(...p)));
    ctx.fillStyle = col;
    ctx.fill();
    ctx.stroke();
  };
  // walls and floor
  face([[0, 0, 0], [0, 3, 0], [0, 3, 3], [0, 0, 3]], V1.wallL);
  face([[0, 0, 0], [3, 0, 0], [3, 0, 3], [0, 0, 3]], V1.wallR);
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) face([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], (x + y) % 2 ? V1.floorB : V1.floorA);
  for (const c of v1Cubes()) for (const f of v1CubeFaces(c)) face(f.pts, f.col);
}

export function v1Frame(ctx, scale = 1) {
  const [cx, cy] = V1.C;
  poly(ctx, hexPoints(cx, cy, V1.R * scale));
  ctx.fillStyle = V1.frame;
  ctx.fill();
  poly(ctx, hexPoints(cx, cy, V1.ringOut * scale));
  ctx.fillStyle = V1.ring;
  ctx.fill();
  poly(ctx, hexPoints(cx, cy, V1.ringIn * scale));
  ctx.fillStyle = V1.frame;
  ctx.fill();
}

export function drawV1(ctx, opt = {}) {
  v1Rays(ctx, opt.rays ?? 1);
  v1Frame(ctx);
  v1Room(ctx);
}

/* ---------------- v2: the faceted hexagon ---------------- */

export const V2 = {
  C: [540, 780],
  R: 318,
  bg: "#2A1811",
  line: "#24140D",
  // Each fan's stripes, top to bottom; the left fan is the mirror.
  fan: ["#7A3A1B", "#D4552A", "#E8912F", "#EEAA48", "#EBCDA0", "#EEAA48", "#E8912F", "#D4552A", "#8E4620"],
  spread: 40, // half-angle of each fan, degrees from the horizontal
};
{
  const [cx, cy] = V2.C, R = V2.R;
  const [T, UR, LR, B, LL, UL] = hexPoints(cx, cy, R);
  const [Ti, URi, LRi, Bi, LLi, ULi] = hexPoints(cx, cy, R / 2);
  V2.pts = { T, UR, LR, B, LL, UL, Ti, URi, LRi, Bi, LLi, ULi, C: [cx, cy] };
  // The facets: [points, colour]
  V2.facets = [
    [[T, UL, LL], "#E8962F"], // left of the triangle
    [[T, LR, UR], "#D7552A"], // right of the triangle
    [[LL, B, LR], "#7C401F"], // under it
    [[T, Ti, ULi], "#EBA03C"],
    [[T, URi, Ti], "#8A4521"],
    [[ULi, LLi, LL], "#E3A453"],
    [[LL, LLi, Bi], "#8B4622"],
    [[URi, LR, LRi], "#D35A2B"],
    [[LRi, LR, Bi], "#C9562A"],
    [[Ti, ULi, LLi, [cx, cy]], "#EAC593"], // the small cube: its light face
    [[Ti, URi, LRi, [cx, cy]], "#C9502B"],
    [[[cx, cy], LLi, Bi, LRi], "#7E3F1E"],
  ];
}

export function v2Fans(ctx, reach = 1) {
  const [cx, cy] = V2.C;
  const n = V2.fan.length, sp = V2.spread;
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      // angle from the horizontal, -sp at the top to +sp at the bottom
      const a0 = -sp + (2 * sp * i) / n, a1 = -sp + (2 * sp * (i + 1)) / n;
      const r = 1400 * reach;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const a of [a0, a1]) ctx.lineTo(cx + side * r * Math.cos(a * D2R), cy + r * Math.sin(a * D2R));
      ctx.closePath();
      ctx.fillStyle = V2.fan[i];
      ctx.fill();
    }
    ctx.strokeStyle = V2.line;
    ctx.lineWidth = 5;
    for (let i = 0; i <= n; i++) {
      const a = (-sp + (2 * sp * i) / n) * D2R;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + side * 1400 * reach * Math.cos(a), cy + 1400 * reach * Math.sin(a));
      ctx.stroke();
    }
  }
}

export function v2Emblem(ctx, opt = {}) {
  ctx.lineJoin = "round";
  ctx.lineWidth = opt.lineWidth ?? 7;
  ctx.strokeStyle = V2.line;
  for (const [pts, col] of V2.facets) {
    poly(ctx, pts);
    ctx.fillStyle = col;
    ctx.fill();
  }
  for (const [pts] of V2.facets) {
    poly(ctx, pts);
    ctx.stroke();
  }
  poly(ctx, hexPoints(V2.C[0], V2.C[1], V2.R));
  ctx.stroke();
}

export function drawV2(ctx, opt = {}) {
  ctx.fillStyle = V2.bg;
  ctx.fillRect(0, 0, W, H);
  v2Fans(ctx, opt.fans ?? 1);
  v2Emblem(ctx);
}

/* ---------------- v5: stripes and arcs ---------------- */

export const V5 = {
  x: 110, y: 318, S: 860, gap: 9,
  paper: "#F2D6B0",
  black: "#1C1612",
  // Stripes as [from, to, colour], fractions of the square's width.
  tl: [[0, 0.315, "#D9532A"], [0.315, 0.472, "#EFC08F"], [0.472, 0.731, "#EE9B35"], [0.731, 1, "#7F8566"]],
  br: [[0, 0.27, "#D9532A"], [0.27, 0.528, "#EE9B35"], [0.528, 0.685, "#EFC08F"], [0.685, 1, "#7F8566"]],
  // The half-ellipse laid over each square of stripes: centre x, half-width, and which half.
  tlD: { cx: 0.472, rx: 0.222, side: -1 },
  brD: { cx: 0.528, rx: 0.222, side: 1 },
  shade: "rgba(52, 30, 14, 0.36)",
  // Rings out from a corner, [outer radius as a fraction of the square, colour]; black beyond the last.
  trRings: [[0.61, "#1C1612"], [0.74, "#8C8E78"], [0.81, "#B0462A"], [0.89, "#D9542A"], [0.98, "#EE9A35"], [1.09, "#F5DEC2"]],
  blRings: [[0.53, "#1C1612"], [0.66, "#BBAE8E"], [0.78, "#DA5A2D"], [0.83, "#B9472A"], [0.94, "#EE9A35"], [1.04, "#F5DEC2"]],
};
V5.q = V5.S / 2;
// Each square's box: x, y, size (the gap splits the top row from the bottom).
V5.quads = {
  tl: [V5.x, V5.y, V5.q, V5.q - V5.gap / 2],
  tr: [V5.x + V5.q, V5.y, V5.q, V5.q - V5.gap / 2],
  bl: [V5.x, V5.y + V5.q + V5.gap / 2, V5.q, V5.q - V5.gap / 2],
  br: [V5.x + V5.q, V5.y + V5.q + V5.gap / 2, V5.q, V5.q - V5.gap / 2],
};

export function v5Stripes(ctx, key, opt = {}) {
  const [x, y, w, h] = V5.quads[key];
  const stripes = V5[key];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (const [a, b, col] of stripes) {
    ctx.fillStyle = col;
    ctx.fillRect(x + a * w - 0.5, y, (b - a) * w + 1, h);
  }
  const d = V5[key + "D"];
  const k = opt.shade ?? 1;
  if (k > 0) {
    ctx.beginPath();
    const cx = x + d.cx * w, cy = y + h / 2, rx = d.rx * w, ry = h * 0.487 * k;
    ctx.ellipse(cx, cy, rx * k, ry, 0, d.side < 0 ? Math.PI / 2 : -Math.PI / 2, d.side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = V5.shade;
    ctx.fill();
  }
  ctx.restore();
}

export function v5Rings(ctx, key, opt = {}) {
  const [x, y, w, h] = V5.quads[key];
  const rings = key === "tr" ? V5.trRings : V5.blRings;
  const [ox, oy] = key === "tr" ? [x + w, y] : [x, y + h];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = V5.black;
  ctx.fillRect(x, y, w, h);
  for (let i = rings.length - 1; i >= 0; i--) {
    const [r, col] = rings[i];
    ctx.beginPath();
    ctx.arc(ox, oy, r * V5.q * (opt.scale ?? 1), 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.restore();
}

export function drawV5(ctx, opt = {}) {
  ctx.fillStyle = V5.paper;
  ctx.fillRect(0, 0, W, H);
  v5Stripes(ctx, "tl");
  v5Rings(ctx, "tr");
  v5Rings(ctx, "bl");
  v5Stripes(ctx, "br");
}

/* A fine print grain, the same every frame, laid over a finished poster. */
let grainCanvas = null;
export function grain(ctx, amount = 0.09) {
  if (!grainCanvas) {
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = W;
    grainCanvas.height = H;
    const g = grainCanvas.getContext("2d");
    const im = g.createImageData(W, H);
    let s = 1234567;
    for (let i = 0; i < W * H; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      const v = 128 + (((s >>> 8) & 255) - 128) * 0.55;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = amount;
  ctx.drawImage(grainCanvas, 0, 0);
  ctx.restore();
}

export const DRAW = { v1: drawV1, v2: drawV2, v5: drawV5 };

/* The whole poster into a new canvas (cached): the artwork with its grain,
   and the title over it (opt.title false: the artwork alone, what the
   videos morph into, the title coming in over them on its own). */
const cache = {};
export function posterCanvas(id, opt = {}) {
  const key = id + JSON.stringify(opt);
  if (cache[key]) return cache[key];
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  DRAW[id](ctx, opt);
  if (opt.grain !== false) grain(ctx);
  if (opt.title !== false) drawTitle(ctx, id);
  return (cache[key] = c);
}
