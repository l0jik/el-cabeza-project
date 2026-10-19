/* The title over the splash videos and their posters: EL CABEZA, then NOVA
   (user: "remove the taglines from all of them. The only text that should
   be on there is ... initially just the word El Cabeza ... then ... an
   additional splash of the added word Nova. Make these look refined and
   classy"). EL CABEZA is there from the first frame, clear of the opening's
   board. Once the poster settles NOVA comes in: a spark on the line, the
   hairline rules running out from it and parting, the word opening out of
   the middle into focus in a soft bloom; EL CABEZA rises a little to make
   room for it. NOVA is three times the size it first had (user, of six
   other treatments: "No, just stop. Go back to the original Nova ... It can
   show up as it normally has before, but it needs to get much larger").

   drawTitle(ctx, id, s) draws it at any point of its coming in. s (each
   0..1; the default, the title at rest):
     cabeza  EL CABEZA coming up: in from nothing as its letters close in
     nova    NOVA's entrance
     sheen   a glint of light passing over EL CABEZA, left to right
     ink     from the light ink (over the opening's dark table) to the
             poster's own (5's dark ink on its paper)
     halo    a soft shade round the name, for while the picture moves under it
     pulse   NOVA breathing once it's in (the logo posters only; user: "At
             the end, have Nova pulsing in a subtle way"): a slow swell of
             light behind it and in its letters, a hair larger, then back */
import { W } from "./size.js";

// EL CABEZA at rest, and where it is from the first frame (the opening's board ends at y 1403).
export const TITLE = { base: 1562, width: 776, track: 0.06 };

/* Each poster's inks. light: the name's colour over a dark ground (the
   opening's table), where a poster's own ink is dark (5, on paper). The
   logo posters (logos.js) take their logos' own: black or cream for the
   name, NOVA in gold; and NOVA breathes at the end (pulse). */
export const SCHEME = {
  v1: { ink: "#F3D4A2", light: "#F3D4A2", nova: "#DE8631", rule: "#C8762E", glow: [255, 190, 112], sheen: "#FFF4DE", ground: "dark" },
  v2: { ink: "#F3D4A2", light: "#F3D4A2", nova: "#DE8631", rule: "#C8762E", glow: [255, 190, 112], sheen: "#FFF4DE", ground: "dark" },
  v5: { ink: "#1E1611", light: "#F3D4A2", nova: "#C9742E", rule: "#C9742E", glow: [214, 112, 40], sheen: "#D98A3A", ground: "light" },
  L1: { ink: "#1C1916", light: "#F3D4A2", nova: "#8E6A32", rule: "#8E6A32", glow: [200, 150, 76], sheen: "#C99A4B", ground: "light", pulse: true },
  L2: { ink: "#EFE5D2", light: "#EFE5D2", nova: "#D4A65E", rule: "#B98D4C", glow: [238, 186, 108], sheen: "#FFF1D6", ground: "dark", pulse: true },
  L3: { ink: "#F0E7D4", light: "#F0E7D4", nova: "#D3A862", rule: "#B99050", glow: [232, 188, 112], sheen: "#FFF3DA", ground: "dark", pulse: true },
  L4: { ink: "#1A1714", light: "#F3D4A2", nova: "#8C6830", rule: "#8C6830", glow: [200, 150, 76], sheen: "#C99A4B", ground: "light", pulse: true },
  L5: { ink: "#EBCB93", light: "#EBCB93", nova: "#CFA35E", rule: "#C29A5C", glow: [240, 192, 116], sheen: "#FFF0D2", ground: "dark", pulse: true },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const span01 = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;
const easeOutQuart = (v) => 1 - (1 - clamp01(v)) ** 4;
const easeOutExpo = (v) => (v >= 1 ? 1 : 1 - 2 ** (-10 * clamp01(v)));
const easeInOut = (v) => { v = clamp01(v); return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2; };
const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t))).join(",")})`; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const CINZEL = (size) => `700 ${size}px Cinzel`;
const JOSEFIN = (size) => `300 ${size}px 'Josefin Sans'`;

/* Letters laid out with their own kerning (each prefix's width) plus a
   tracking in pixels, centred on cx. */
function layout(ctx, text, font, track, cx) {
  ctx.font = font;
  ctx.letterSpacing = "0px";
  const full = ctx.measureText(text).width + track * (text.length - 1);
  const x0 = cx - full / 2;
  const out = [];
  for (let i = 0; i < text.length; i++) out.push({ ch: text[i], x: x0 + ctx.measureText(text.slice(0, i)).width + track * i });
  return { full, x0, out, font };
}

// The size that sets text `width` wide at a tracking of `track` ems.
const fits = {};
function fit(ctx, text, fontFn, width, track) {
  const key = `${text}|${fontFn(100)}|${width}|${track}`;
  if (fits[key]) return fits[key];
  ctx.font = fontFn(100);
  ctx.letterSpacing = "0px";
  const w = ctx.measureText(text).width / 100;
  return (fits[key] = width / (w + track * (text.length - 1)));
}

// EL CABEZA with its baseline at `base`.
function cabeza(ctx, sc, s, base) {
  const c = s.cabeza ?? 1, ink = s.ink ?? 1, halo = s.halo ?? 0;
  const size = fit(ctx, "EL CABEZA", CINZEL, TITLE.width, TITLE.track);
  const word = layout(ctx, "EL CABEZA", CINZEL(size), (TITLE.track + 0.12 * (1 - easeOut(c))) * size, W / 2);
  const alpha = smooth(c * 1.25);
  if (alpha > 0) {
    ctx.save();
    ctx.font = word.font;
    ctx.fillStyle = mixHex(sc.light, sc.ink, ink);
    if (halo > 0) {
      const lightInk = sc.ground === "dark" || ink < 0.5;
      ctx.shadowColor = lightInk ? `rgba(12,7,4,${0.78 * halo * alpha})` : `rgba(242,214,176,${0.75 * halo * alpha})`;
      ctx.shadowBlur = 30;
    }
    ctx.globalAlpha = alpha;
    for (const l of word.out) ctx.fillText(l.ch, l.x, base);
    ctx.restore();
  }
  return { ...word, base, size };
}

/* A glint over a word: its letters again, in light, seen through a band
   that crosses them left to right. */
let glintCanvas = null;
function glint(ctx, sc, sh, word) {
  if (!(sh > 0 && sh < 1)) return;
  const top = Math.floor(word.base - word.size * 1.05), h = Math.ceil(word.size * 1.35);
  if (!glintCanvas || glintCanvas.height < h + 4) { glintCanvas = document.createElement("canvas"); glintCanvas.width = W; glintCanvas.height = h + 4; }
  const g = glintCanvas.getContext("2d");
  g.clearRect(0, 0, W, glintCanvas.height);
  g.globalCompositeOperation = "source-over";
  g.font = word.font;
  g.fillStyle = sc.sheen;
  for (const l of word.out) g.fillText(l.ch, l.x, word.base - top);
  g.globalCompositeOperation = "destination-in";
  const e = easeInOut(sh), bx = word.x0 - 220 + (word.full + 440) * e, wide = Math.max(90, word.size * 0.8);
  const gr = g.createLinearGradient(bx - wide, h, bx + wide + h * 0.35, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(0.5, "rgba(0,0,0,1)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, glintCanvas.height);
  ctx.save();
  ctx.globalAlpha = (sc.ground === "dark" ? 0.75 : 0.5) * Math.sin(Math.PI * sh);
  ctx.drawImage(glintCanvas, 0, top);
  ctx.restore();
}

// A point of light: white-hot in the middle on a dark ground, the glow's colour on a light one.
function spark(ctx, x, y, r, a, glow, dark) {
  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "source-over";
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  if (dark) {
    gr.addColorStop(0, `rgba(255,250,240,${a})`);
    gr.addColorStop(0.12, rgba(glow, 0.85 * a));
    gr.addColorStop(0.4, rgba(glow, 0.22 * a));
  } else {
    gr.addColorStop(0, rgba(glow, 0.95 * a));
    gr.addColorStop(0.1, rgba(glow, 0.6 * a));
    gr.addColorStop(0.4, rgba(glow, 0.12 * a));
  }
  gr.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

// A soft bloom of light, an ellipse rx by ry round (x, y).
function bloom(ctx, sc, x, y, rx, ry, a) {
  if (a <= 0) return;
  const dark = sc.ground === "dark";
  ctx.save();
  ctx.globalCompositeOperation = dark ? "screen" : "source-over";
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const k = dark ? 0.5 : 0.1;
  gr.addColorStop(0, rgba(sc.glow, k * a));
  gr.addColorStop(0.4, rgba(sc.glow, k * 0.38 * a));
  gr.addColorStop(1, rgba(sc.glow, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
  ctx.restore();
}
const bloomCurve = (n, peak = 0.24, fade = 1) => smooth(span01(n, 0.04, peak)) * (1 - smooth(span01(n, peak + 0.04, fade)));

/* NOVA in light letters between two rules: a spark on the line, the rules
   running out from it and parting, the word opening out of the middle into
   focus, a soft bloom behind. o: y (the line), size, track (ems), gap,
   len, rule (thickness). p: the breath once it's in (0..1). */
function ruledNova(ctx, sc, n, o, p = 0) {
  const cx = W / 2, y = o.y, dark = sc.ground === "dark", glow = sc.glow, k = o.size / 48;
  const rest = layout(ctx, "NOVA", JOSEFIN(o.size), o.track * o.size, cx);
  const gi = rest.full / 2 + o.gap;
  bloom(ctx, sc, cx, y, 560 * Math.sqrt(k), 146 * Math.sqrt(k), bloomCurve(n, 0.24, 1));
  const outer = (gi + o.len) * easeOutExpo(span01(n, 0.02, 0.6));
  const inner = gi * easeInOut(span01(n, 0.16, 0.62));
  if (outer > inner) {
    ctx.fillStyle = sc.rule;
    ctx.fillRect(cx - outer, y - o.rule / 2, outer - inner, o.rule);
    ctx.fillRect(cx + inner, y - o.rule / 2, outer - inner, o.rule);
  }
  const run = smooth(span01(n, 0.02, 0.07)) * (1 - smooth(span01(n, 0.32, 0.62)));
  if (run > 0) for (const x of [cx - outer, cx + outer]) spark(ctx, x, y, (dark ? 34 : 22) * Math.sqrt(k), run * (dark ? 0.9 : 0.75), glow, dark);
  const flash = smooth(span01(n, 0, 0.06)) * (1 - smooth(span01(n, 0.08, 0.4)));
  if (flash > 0) spark(ctx, cx, y, (dark ? 90 : 46) * Math.sqrt(k), flash * (dark ? 1 : 0.8), glow, dark);
  const a = smooth(span01(n, 0.16, 0.6));
  if (a > 0) {
    const open = easeOutQuart(span01(n, 0.12, 0.86));
    const word = layout(ctx, "NOVA", JOSEFIN(o.size), (0.1 + (o.track - 0.1) * open) * o.size, cx);
    const blur = 7 * k * (1 - smooth(span01(n, 0.14, 0.74)));
    ctx.save();
    if (p > 0) { const s = 1 + 0.012 * p; ctx.translate(cx, y); ctx.scale(s, s); ctx.translate(-cx, -y); }
    ctx.font = word.font;
    ctx.fillStyle = sc.nova;
    ctx.globalAlpha = a;
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    for (const l of word.out) ctx.fillText(l.ch, l.x, y + o.size * 0.36);
    if (p > 0) {
      // the breath: the letters lighter, a soft glow round them
      const dark = sc.ground === "dark";
      ctx.fillStyle = sc.sheen;
      ctx.globalAlpha = (dark ? 0.3 : 0.62) * p;
      ctx.shadowColor = rgba(sc.glow, (dark ? 0.65 : 0.5) * p);
      ctx.shadowBlur = (dark ? 28 : 20) * p;
      for (const l of word.out) ctx.fillText(l.ch, l.x, y + o.size * 0.36);
    }
    ctx.restore();
  }
}

// The breath's light behind NOVA and along its rules.
function breath(ctx, sc, p, o) {
  if (!(p > 0)) return;
  const cx = W / 2, k = o.size / 48;
  bloom(ctx, sc, cx, o.y, 470 * Math.sqrt(k), 120 * Math.sqrt(k), (sc.ground === "dark" ? 0.62 : 0.5) * p);
  const word = layout(ctx, "NOVA", JOSEFIN(o.size), o.track * o.size, cx), gi = word.full / 2 + o.gap;
  ctx.save();
  ctx.fillStyle = sc.sheen;
  ctx.globalAlpha = 0.35 * p;
  ctx.fillRect(cx - gi - o.len, o.y - o.rule / 2, o.len, o.rule);
  ctx.fillRect(cx + gi, o.y - o.rule / 2, o.len, o.rule);
  ctx.restore();
}

// NOVA: its line, size, letter-spacing (ems), the rules' gap, length and thickness.
const NOVA = { y: 1612, size: 150, track: 0.3, gap: 36, len: 120, rule: 3 };
// EL CABEZA's baseline once NOVA is in (it starts at TITLE.base).
const CABEZA_UP = 1478;

export function drawTitle(ctx, id, s = {}) {
  const sc = SCHEME[id], n = s.nova ?? 1;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const word = cabeza(ctx, sc, s, lerp(TITLE.base, CABEZA_UP, easeInOut(span01(n, 0, 0.4))));
  glint(ctx, sc, s.sheen ?? 0, word);
  breath(ctx, sc, s.pulse ?? 0, NOVA);
  if (n > 0) ruledNova(ctx, sc, n, NOVA, s.pulse ?? 0);
  ctx.restore();
}
