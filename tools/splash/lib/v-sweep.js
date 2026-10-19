/* Version 4, "Sweep": each poster's own motif carries it in.
     v1  the sunburst opens like a fan from the road up both sides to meet at
         the top, while the board shrinks into the hexagon and melts into it
     v2  the board bursts apart along the rays, sideways first, the slices
         flying out to show the poster underneath
     v5  the rings swing in round their corners like wipers, the stripes drop
         in from above and rise from below, and the paper spreads out */
import { W, H, V1, V2, V5, wedge, posterCanvas } from "./posters.js";
import { BOARD, REST } from "./board.js";
import { clamp, lerp, span, smooth, easeIn, easeOut, easeInOut, backOut } from "./anim.js";

const DURATION = 5.2;
const D2R = Math.PI / 180;

// The photo as it is, held still until it starts to move.
function rest(ctx) {
  ctx.drawImage(BOARD.start, 0, 0);
}

/* ---------------- v1: the fan ---------------- */

// Each half of the fan, its folds along the poster's own ray edges (degrees from straight up).
const FAN_LEFT = [-180, -154, -128, -104, -82, -60, -38, -19, 0];

function sweepV1(ctx, t) {
  if (t < 0.75) return rest(ctx);
  const P = posterCanvas("v1");
  const [cx, cy] = V1.C;
  const e = easeInOut(span(t, 0.75, 2.95));
  ctx.drawImage(BOARD.ground, 0, 0);
  // the fan: each slice turns about the hexagon's middle from the fold at the bottom
  const slices = [];
  for (let i = 0; i < FAN_LEFT.length - 1; i++) {
    const a0 = FAN_LEFT[i], a1 = FAN_LEFT[i + 1];
    slices.push({ a0, a1, rot: (-180 - a0) * (1 - e) }); // left half, opening clockwise toward the top
    slices.push({ a0: -a1, a1: -a0, rot: (180 + a0) * (1 - e) }); // its mirror on the right
  }
  // the bottom slices first, those that travel furthest last (on top)
  slices.sort((a, b) => Math.abs(a.rot) - Math.abs(b.rot));
  const appear = smooth(span(t, 0.75, 1.05));
  const boardK = easeInOut(span(t, 1.45, 3.0)), boardFade = smooth(span(t, 2.55, 3.05));
  ctx.save();
  ctx.globalAlpha = appear;
  for (const sl of slices) {
    const b0 = sl.a0 + sl.rot, b1 = sl.a1 + sl.rot;
    // a shadow ahead of the slice on what's underneath
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.55 * (1 - e * e)})`;
    ctx.shadowBlur = 36;
    ctx.shadowOffsetX = 10 * Math.sign(sl.a0 + sl.a1);
    ctx.shadowOffsetY = 6;
    wedge(ctx, cx, cy, b0, b1, 2400);
    ctx.fillStyle = "#1a100b";
    ctx.fill();
    ctx.restore();
    ctx.save();
    wedge(ctx, cx, cy, b0, b1, 2400);
    ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(sl.rot * D2R); ctx.translate(-cx, -cy);
    ctx.drawImage(P, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  // the board on top, the fan opening round it; it shrinks into the hexagon and melts into it
  if (boardFade < 1) {
    const s = lerp(1, 0.66, boardK), r = lerp(0, 30, boardK) * D2R;
    const bx = lerp(REST.cx, cx, boardK), by = lerp(REST.cy, cy, boardK);
    ctx.save();
    ctx.globalAlpha = 1 - boardFade;
    ctx.translate(bx, by); ctx.rotate(r); ctx.scale(s, s); ctx.translate(-REST.cx, -REST.cy);
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
    ctx.drawImage(BOARD.photo, REST.x, REST.y, REST.w, REST.h);
    ctx.restore();
  }
  const fin = smooth(span(t, 3.05, 3.4));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(P, 0, 0); ctx.globalAlpha = 1; }
}

/* ---------------- v2: the burst ---------------- */

function sweepV2(ctx, t) {
  if (t < 0.75) return rest(ctx);
  const P = posterCanvas("v2");
  const [cx, cy] = V2.C;
  // underneath: the poster, settling from a touch large
  const settle = easeOut(span(t, 0.9, 3.0));
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(lerp(1.08, 1, settle), lerp(1.08, 1, settle)); ctx.translate(-cx, -cy);
  ctx.drawImage(P, 0, 0);
  ctx.restore();
  // a flash of light from the middle as it splits
  const flash = Math.sin(Math.PI * span(t, 0.8, 1.6));
  // the board in slices round the hexagon's middle, flying out along them: the level ones first
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a0 = (360 * i) / N, a1 = (360 * (i + 1)) / N, mid = ((a0 + a1) / 2) * D2R; // from straight up, clockwise
    const sideways = Math.abs(Math.sin(mid)); // 1 for the level slices
    const t0 = 0.85 + 0.55 * (1 - sideways) + 0.03 * (i % 3);
    const f = easeIn(span(t, t0, t0 + 1.05));
    if (f >= 1) continue;
    const dx = Math.sin(mid) * 1900 * f, dy = -Math.cos(mid) * 1900 * f;
    const spin = (i % 2 ? 1 : -1) * 14 * f * D2R;
    ctx.save();
    ctx.translate(cx + dx, cy + dy); ctx.rotate(spin); ctx.translate(-cx, -cy);
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.6 * Math.min(1, f * 4)})`;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 18;
    wedge(ctx, cx, cy, a0, a1, 2400);
    ctx.fillStyle = "#120c08";
    ctx.fill();
    ctx.restore();
    wedge(ctx, cx, cy, a0, a1, 2400);
    ctx.clip();
    ctx.drawImage(BOARD.start, 0, 0);
    ctx.restore();
  }
  if (flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 700);
    g.addColorStop(0, `rgba(255,214,150,${0.55 * flash})`);
    g.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* ---------------- v5: wipers, stripes, paper ---------------- */

function sweepV5(ctx, t) {
  if (t < 0.75) return rest(ctx);
  const P = posterCanvas("v5");
  rest(ctx);
  const bx = V5.x, by = V5.y, S = V5.S;
  // the paper spreads out round the square (not over it: the square comes in its own way)
  const paper = easeInOut(span(t, 1.5, 2.9));
  if (paper > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx + S / 2, by + S / 2, lerp(300, 1500, paper), 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(bx, by, S, S);
    ctx.clip("evenodd");
    ctx.drawImage(P, 0, 0);
    ctx.restore();
  }
  // a piece of the poster (the meet of its paths), moved, with a shadow under it
  const piece = (paths, xf, shadow) => {
    ctx.save();
    xf(ctx);
    ctx.save();
    for (let i = 0; i < paths.length - 1; i++) { paths[i](ctx); ctx.clip("evenodd"); }
    ctx.shadowColor = `rgba(0,0,0,${shadow})`;
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 14;
    paths[paths.length - 1](ctx);
    ctx.fillStyle = "#000";
    ctx.fill("evenodd");
    ctx.restore();
    for (const p of paths) { p(ctx); ctx.clip("evenodd"); }
    ctx.drawImage(P, 0, 0);
    ctx.restore();
  };
  // stripes: down from above on the left, up from below on the right
  for (const key of ["tl", "br"]) {
    const [x, y, w, h] = V5.quads[key];
    V5[key].forEach(([a, b], i) => {
      const t0 = (key === "tl" ? 0.8 : 1.4) + 0.13 * i;
      const k = backOut(span(t, t0, t0 + 0.7), 1.2);
      if (k <= 0) return;
      const off = (key === "tl" ? -1 : 1) * (1 - k) * 1300;
      piece([(c) => { c.beginPath(); c.rect(x + a * w, y, (b - a) * w, h); }], (c) => c.translate(0, off), 0.45 * (1 - Math.min(1, k) ** 2) + 0.05);
    });
  }
  // rings: each band swings in round its corner, the inner ones first
  for (const key of ["tr", "bl"]) {
    const [x, y, w, h] = V5.quads[key];
    const rings = key === "tr" ? V5.trRings : V5.blRings;
    const [ox, oy] = key === "tr" ? [x + w, y] : [x, y + h];
    const radii = [0, ...rings.map((r) => r[0] * V5.q), 2 * V5.q];
    for (let i = 0; i < radii.length - 1; i++) {
      const t0 = (key === "tr" ? 1.1 : 1.7) + 0.1 * i;
      const k = backOut(span(t, t0, t0 + 0.75), 1.1);
      if (k <= 0) continue;
      const rot = (key === "tr" ? 1 : -1) * (1 - k) * 100 * D2R;
      const r0 = radii[i], r1 = radii[i + 1];
      piece([
        (c) => { c.beginPath(); c.rect(x, y, w, h); },
        (c) => { c.beginPath(); c.arc(ox, oy, r1, 0, Math.PI * 2); if (r0 > 0) { c.moveTo(ox + r0, oy); c.arc(ox, oy, r0, 0, Math.PI * 2); } },
      ], (c) => { c.translate(ox, oy); c.rotate(rot); c.translate(-ox, -oy); }, 0.4 * (1 - Math.min(1, k)) + 0.04);
    }
  }
  const fin = smooth(span(t, 3.2, 3.55));
  if (fin > 0) { ctx.globalAlpha = fin; ctx.drawImage(P, 0, 0); ctx.globalAlpha = 1; }
}

export const sweep = {
  duration: DURATION,
  frame(ctx, id, t) {
    if (id === "v1") return sweepV1(ctx, t);
    if (id === "v2") return sweepV2(ctx, t);
    return sweepV5(ctx, t);
  },
};
