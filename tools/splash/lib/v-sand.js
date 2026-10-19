/* Version 2, "Sand": the picture breaks into half a million grains (one for
   each 2 x 2 pixels) that lift off, swirl and settle into the poster. Each
   grain lands where a grain of about its own brightness belongs, in a ring
   about as far out as it started, so the swirl stays a swirl:
     v1  a whirlpool round the hexagon
     v2  a flatter one, drawn out sideways like the rays
     v5  a squarer one, round the four squares
   The middle of the board goes first; the poster forms from its middle out. */
import { W, H, V1, V2, V5, posterCanvas } from "./posters.js";
import { BOARD, REST } from "./board.js";
import { clamp, lerp, span, smooth, easeInOut, rng, hex, fbm } from "./anim.js";

const DURATION = 5.6;
const GW = W / 2, GH = H / 2, N = GW * GH; // grains, one per 2 x 2 block
const CENTRE = { v1: V1.C, v2: V2.C, v5: [V5.x + V5.S / 2, V5.y + V5.S / 2] };
// How the swirl is shaped: positions from (r, angle) and back.
const SHAPE = {
  v1: { to: (r, a) => [r * Math.cos(a), r * Math.sin(a)], from: (x, y) => [Math.hypot(x, y), Math.atan2(y, x)] },
  v2: { to: (r, a) => [r * Math.cos(a), 0.5 * r * Math.sin(a)], from: (x, y) => [Math.hypot(x, y / 0.5), Math.atan2(y / 0.5, x)] },
  v5: {
    to: (r, a) => { const c = Math.cos(a), s = Math.sin(a), n = (c ** 4 + s ** 4) ** 0.25; return [(r * c) / n, (r * s) / n]; },
    from: (x, y) => [(x ** 4 + y ** 4) ** 0.25, Math.atan2(y, x)],
  },
};
const EMPTY = { v1: "#1E130D", v2: V2.bg, v5: V5.paper };

const PLANS = {};
function pixels(cv) { return new Uint32Array(cv.getContext("2d").getImageData(0, 0, W, H).data.buffer.slice(0)); }

function plan(id) {
  if (PLANS[id]) return PLANS[id];
  const src = pixels(BOARD.start), dst = pixels(posterCanvas(id));
  const [ox, oy] = CENTRE[id], sh = SHAPE[id];
  const lum = (px, b) => {
    const x = (b % GW) * 2, y = Math.floor(b / GW) * 2, i = y * W + x;
    let s = 0;
    for (const j of [i, i + 1, i + W, i + W + 1]) { const c = px[j]; s += (c & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + ((c >> 16) & 255) * 0.11; }
    return s / 4;
  };
  const polar = (b) => sh.from((b % GW) * 2 + 1 - ox, Math.floor(b / GW) * 2 + 1 - oy);
  const sR = new Float32Array(N), sA = new Float32Array(N), sL = new Float32Array(N);
  const dR = new Float32Array(N), dA = new Float32Array(N), dL = new Float32Array(N);
  for (let b = 0; b < N; b++) {
    [sR[b], sA[b]] = polar(b); sL[b] = lum(src, b);
    [dR[b], dA[b]] = polar(b); dL[b] = lum(dst, b);
  }
  // Rings of equal count, out from the centre; in each, dark grains to dark places.
  const bySR = Array.from({ length: N }, (_, i) => i).sort((a, b) => sR[a] - sR[b]);
  const byDR = Array.from({ length: N }, (_, i) => i).sort((a, b) => dR[a] - dR[b]);
  const BANDS = 40, per = Math.ceil(N / BANDS);
  const from = new Int32Array(N), to = new Int32Array(N);
  const rankS = new Float32Array(N), rankD = new Float32Array(N);
  for (let k = 0; k < BANDS; k++) {
    const a = bySR.slice(k * per, (k + 1) * per).sort((x, y) => sL[x] - sL[y]);
    const d = byDR.slice(k * per, (k + 1) * per).sort((x, y) => dL[x] - dL[y]);
    for (let i = 0; i < a.length; i++) { from[k * per + i] = a[i]; to[k * per + i] = d[i]; }
  }
  for (let i = 0; i < N; i++) { rankS[bySR[i]] = i / N; rankD[byDR[i]] = i / N; }
  const r = rng(11);
  const P = {
    from, to, src, dst,
    r0: new Float32Array(N), a0: new Float32Array(N), r1: new Float32Array(N), da: new Float32Array(N),
    td: new Float32Array(N), ta: new Float32Array(N), swell: new Float32Array(N), cs: new Uint32Array(N), cd: new Uint32Array(N),
  };
  const avg = (px, b) => {
    const x = (b % GW) * 2, y = Math.floor(b / GW) * 2, i = y * W + x;
    let R = 0, G = 0, B = 0;
    for (const j of [i, i + 1, i + W, i + W + 1]) { const c = px[j]; R += c & 255; G += (c >> 8) & 255; B += (c >> 16) & 255; }
    return (255 << 24) | ((B >> 2) << 16) | ((G >> 2) << 8) | (R >> 2);
  };
  for (let i = 0; i < N; i++) {
    const s = from[i], d = to[i];
    P.r0[i] = sR[s]; P.a0[i] = sA[s]; P.r1[i] = dR[d];
    let da = dA[d] - sA[s];
    da = ((da % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    P.da[i] = da + Math.PI * (0.35 + 0.5 * r()); // always the same way round, some a little further
    // the board goes in drifts, not grain by grain: a smooth noise in the timing, a little grit on top
    const sx = (s % GW) * 2, sy = Math.floor(s / GW) * 2, dx = (d % GW) * 2, dy = Math.floor(d / GW) * 2;
    P.td[i] = 0.75 + 0.85 * rankS[s] + 0.32 * (fbm(sx / 140, sy / 140, 1.7) + 0.5) + 0.025 * r();
    P.ta[i] = 2.3 + 1.15 * rankD[d] + 0.3 * (fbm(dx / 160, dy / 160, 4.2) + 0.5) + 0.025 * r();
    P.swell[i] = 0.06 + 0.12 * r();
    P.cs[i] = avg(src, s); P.cd[i] = avg(dst, d);
  }
  return (PLANS[id] = P);
}

let IM = null;
function frameSand(ctx, id, t) {
  if (t < 0.72) {
    ctx.drawImage(BOARD.start, 0, 0); // the photo as it is, held still until it starts to move
    return;
  }
  const P = plan(id);
  if (!IM) IM = ctx.createImageData(W, H);
  const out = new Uint32Array(IM.data.buffer);
  // what's between: the table giving way to the poster's ground
  const e0 = hex("#120C08"), e1 = hex(EMPTY[id]), m = smooth(span(t, 1.8, 3.4));
  out.fill((255 << 24) | (Math.round(lerp(e0[2], e1[2], m)) << 16) | (Math.round(lerp(e0[1], e1[1], m)) << 8) | Math.round(lerp(e0[0], e1[0], m)));
  const [ox, oy] = CENTRE[id], sh = SHAPE[id];
  const { from, to, src, dst } = P;
  const put = (x, y, c, size) => {
    const xi = x | 0, yi = y | 0;
    for (let dy = 0; dy < size; dy++) {
      const yy = yi + dy;
      if (yy < 0 || yy >= H) continue;
      const row = yy * W;
      for (let dx = 0; dx < size; dx++) { const xx = xi + dx; if (xx >= 0 && xx < W) out[row + xx] = c; }
    }
  };
  const flying = [];
  for (let i = 0; i < N; i++) {
    if (t < P.td[i]) {
      // still lying in the picture: its own four pixels
      const b = from[i], x = (b % GW) * 2, y = ((b / GW) | 0) * 2, j = y * W + x;
      out[j] = src[j]; out[j + 1] = src[j + 1]; out[j + W] = src[j + W]; out[j + W + 1] = src[j + W + 1];
    } else if (t >= P.ta[i]) {
      // landed: the poster's own four pixels
      const b = to[i], x = (b % GW) * 2, y = ((b / GW) | 0) * 2, j = y * W + x;
      out[j] = dst[j]; out[j + 1] = dst[j + 1]; out[j + W] = dst[j + W]; out[j + W + 1] = dst[j + W + 1];
    } else flying.push(i);
  }
  // the grains in the air, each drawn along the way it went since the last frame (a streak, not dots)
  const pos = (i, tt) => {
    const u = clamp((tt - P.td[i]) / (P.ta[i] - P.td[i]));
    const e = easeInOut(u), lift = Math.sin(Math.PI * u);
    const [x, y] = sh.to(lerp(P.r0[i], P.r1[i], e) * (1 + P.swell[i] * lift), P.a0[i] + P.da[i] * e);
    return [ox + x - 1, oy + y - 1, u, lift];
  };
  for (const i of flying) {
    const [x1, y1, u, lift] = pos(i, t), [x0, y0] = pos(i, t - 1 / 60);
    const cs = P.cs[i], cd = P.cd[i];
    const f = smooth((u - 0.2) / 0.65), glow = 1 + 0.22 * lift;
    const R = Math.min(255, lerp(cs & 255, cd & 255, f) * glow), G = Math.min(255, lerp((cs >> 8) & 255, (cd >> 8) & 255, f) * glow), B = Math.min(255, lerp((cs >> 16) & 255, (cd >> 16) & 255, f) * glow);
    const c = (255 << 24) | (B << 16) | (G << 8) | R;
    const n = Math.min(12, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
    for (let k = 0; k < n; k++) put(lerp(x0, x1, k / n), lerp(y0, y1, k / n), c, 2);
    put(x1, y1, c, lift > 0.35 ? 3 : 2);
  }
  ctx.putImageData(IM, 0, 0);
}

export const sand = { duration: DURATION, frame: frameSand };
