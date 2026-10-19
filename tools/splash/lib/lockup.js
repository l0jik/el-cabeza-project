/* The title over the splash videos and their posters: EL CABEZA, then NOVA
   (user: "remove the taglines from all of them. The only text that should
   be on there is ... initially just the word El Cabeza ... then ... an
   additional splash of the added word Nova. Make these look refined and
   classy"). EL CABEZA starts in one place in every treatment, clear of the
   opening's board, and where NOVA needs the room it rises to make it as
   NOVA comes in.

   NOVA's treatments (user: "I need several versions that show Nova to be
   more prominent"):
     hairline   small and light between two hairline rules (the first one)
     larger     the same, twice the size
     twolines   in EL CABEZA's own capitals, as tall, in the poster's orange
     leads      very large, EL CABEZA stepping up above it, smaller
     signature  "Nova" in a large Bodoni italic, written in
     pieces     spelled with the game's pieces, the user's recipe: a Rayo on
                its side, the Cabeza, a Codo on its corner, an Arco Alto
     banner     cut out of a band of the poster's orange

   drawTitle(ctx, id, s) draws the current treatment at any point of its
   coming in. s (each 0..1; the default, the title at rest):
     cabeza  EL CABEZA coming up: in from nothing as its letters close in
     nova    NOVA's entrance (each treatment its own)
     sheen   a glint of light passing over the name, left to right
     ink     from the light ink (over the opening's dark table) to the
             poster's own (5's dark ink on its paper)
     halo    a soft shade round the name, for while the picture moves under it */
import { W } from "./size.js";

// EL CABEZA at rest, and where it is from the first frame (the opening's board ends at y 1403).
export const TITLE = { base: 1562, width: 776, track: 0.06 };

/* Each poster's inks. light: the name's colour over a dark ground (the
   opening's table), where a poster's own ink is dark (5, on paper); cut:
   the ground's own colour, for letters cut out of a band. */
export const SCHEME = {
  v1: { ink: "#F3D4A2", light: "#F3D4A2", nova: "#DE8631", rule: "#C8762E", glow: [255, 190, 112], sheen: "#FFF4DE", cut: "#22150F", ground: "dark" },
  v2: { ink: "#F3D4A2", light: "#F3D4A2", nova: "#DE8631", rule: "#C8762E", glow: [255, 190, 112], sheen: "#FFF4DE", cut: "#2A1811", ground: "dark" },
  v5: { ink: "#1E1611", light: "#F3D4A2", nova: "#C9742E", rule: "#C9742E", glow: [214, 112, 40], sheen: "#D98A3A", cut: "#F2D6B0", ground: "light" },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const span01 = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;
const easeOutQuart = (v) => 1 - (1 - clamp01(v)) ** 4;
const easeOutExpo = (v) => (v >= 1 ? 1 : 1 - 2 ** (-10 * clamp01(v)));
const easeInOut = (v) => { v = clamp01(v); return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2; };
const backOut = (v, k = 1.4) => { v = clamp01(v) - 1; return 1 + v * v * ((k + 1) * v + k); };
const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t))).join(",")})`; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const CINZEL = (size) => `700 ${size}px Cinzel`;
const JOSEFIN = (size) => `300 ${size}px 'Josefin Sans'`;
const BODONI = (size) => `italic 500 ${size}px 'Bodoni Moda'`;

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

/* EL CABEZA with its baseline at `base`, k times its size at rest, its
   letters `track` ems apart. */
function cabeza(ctx, sc, s, base, k = 1, track = TITLE.track) {
  const c = s.cabeza ?? 1, ink = s.ink ?? 1, halo = s.halo ?? 0;
  const size = fit(ctx, "EL CABEZA", CINZEL, TITLE.width, TITLE.track) * k;
  const word = layout(ctx, "EL CABEZA", CINZEL(size), (track + 0.12 * (1 - easeOut(c))) * size, W / 2);
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
function glint(ctx, sc, sh, word, strength = 1) {
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
  ctx.globalAlpha = (sc.ground === "dark" ? 0.75 : 0.5) * strength * Math.sin(Math.PI * sh);
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
   len, rule (thickness). */
function ruledNova(ctx, sc, n, o) {
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
    ctx.font = word.font;
    ctx.fillStyle = sc.nova;
    ctx.globalAlpha = a;
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    for (const l of word.out) ctx.fillText(l.ch, l.x, y + o.size * 0.36);
    ctx.restore();
  }
}

/* Letters coming up one after another, rising a little out of a blur.
   order: each letter's place in the sequence. */
function risingWord(ctx, n, word, base, color, o = {}) {
  const t0 = o.from ?? 0.14, step = o.step ?? 0.09, len = o.len ?? 0.46, rise = o.rise ?? 26, blur0 = o.blur ?? 6;
  ctx.save();
  ctx.font = word.font;
  ctx.fillStyle = color;
  word.out.forEach((l, i) => {
    const at = t0 + step * (o.order ? o.order[i] : i);
    const u = span01(n, at, at + len);
    if (u <= 0) return;
    const blur = blur0 * (1 - smooth(u));
    ctx.globalAlpha = smooth(u * 1.4);
    ctx.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
    const sc = o.scale ? lerp(o.scale, 1, easeOut(u)) : 1;
    if (sc !== 1) {
      const w = ctx.measureText(l.ch).width;
      ctx.save();
      ctx.translate(l.x + w / 2, base);
      ctx.scale(sc, sc);
      ctx.fillText(l.ch, -w / 2, rise * (1 - easeOut(u)));
      ctx.restore();
    } else ctx.fillText(l.ch, l.x, base + rise * (1 - easeOut(u)));
  });
  ctx.restore();
}

/* NOVA spelled with the game's pieces, as front page 10 has it (the user's
   recipe: "one of the S shape or Z shape pieces on its side at an angle ...
   a cabeza for the O ... the elbow piece at resting on its corner"): a Rayo
   on its side, the Cabeza (a disc, a little raised), a Codo on its corner,
   an Arco Alto standing, its opening down. In squares of side u; the two
   blocks in one ink, the disc and the arch in the orange, as the two woods
   are two colours. Each rises into place, turning a little, one after
   another. */
const PIECES = [
  { w: 2, h: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]], ink: true },
  { w: 1.99, h: 1.99, disc: true, lift: 0.5 },
  { w: 2.83, h: 2.12, cells: [[0, 0], [0, 1], [1, 1]], turn: -45, ink: true },
  { w: 3, h: 3, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [2, 1], [2, 2]] },
];
function piecesNova(ctx, sc, n, u, bottom) {
  const gap = 0.55 * u, total = PIECES.reduce((a, p) => a + p.w * u, 0) + gap * (PIECES.length - 1);
  let x = W / 2 - total / 2;
  bloom(ctx, sc, W / 2, bottom - 1.5 * u, 520, 170, bloomCurve(n, 0.4, 1) * 0.8);
  PIECES.forEach((p, i) => {
    const pw = p.w * u, ph = p.h * u, at = 0.18 + 0.13 * i;
    const t = span01(n, at, at + 0.42);
    if (t <= 0) { x += pw + gap; return; }
    // (up from below, clear of the name above)
    const drop = 80 * (1 - backOut(t, 1.2)), turn = (i % 2 ? 1 : -1) * 14 * (1 - easeOut(t)) * (Math.PI / 180);
    const cx = x + pw / 2, top = bottom - ph - (p.lift || 0) * u;
    ctx.save();
    ctx.globalAlpha = smooth(t * 2.2);
    ctx.fillStyle = p.ink ? sc.ink : sc.nova;
    ctx.translate(cx, top + ph / 2 + drop);
    ctx.rotate(turn);
    if (p.disc) {
      ctx.beginPath();
      ctx.arc(0, 0, pw / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (p.turn) {
        // the Codo's 2 x 2 box, turned about its middle: its middle 1.42 squares up from the line
        ctx.translate(0, -0.36 * u);
        ctx.rotate((p.turn * Math.PI) / 180);
        ctx.beginPath();
        for (const [cxu, cyu] of p.cells) ctx.rect((cxu - 1) * u - 0.5, (cyu - 1) * u - 0.5, u + 1, u + 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        for (const [cxu, cyu] of p.cells) ctx.rect(cxu * u - pw / 2 - 0.5, cyu * u - ph / 2 - 0.5, u + 1, u + 1);
        ctx.fill();
      }
    }
    ctx.restore();
    x += pw + gap;
  });
}

export const STYLES = {
  hairline: {
    len: 1.5,
    sheen: [0.5, 1.3],
    draw(ctx, sc, s) {
      const word = cabeza(ctx, sc, s, TITLE.base);
      glint(ctx, sc, s.sheen ?? 0, word);
      if ((s.nova ?? 1) > 0) ruledNova(ctx, sc, s.nova ?? 1, { y: 1650, size: 48, track: 0.66, gap: 30, len: 150, rule: 2 });
    },
  },
  larger: {
    len: 1.6,
    draw(ctx, sc, s) {
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.5));
      const word = cabeza(ctx, sc, s, lerp(TITLE.base, 1510, m));
      glint(ctx, sc, s.sheen ?? 0, word);
      if (n > 0) ruledNova(ctx, sc, n, { y: 1640, size: 100, track: 0.42, gap: 40, len: 118, rule: 3 });
    },
  },
  twolines: {
    len: 1.7,
    draw(ctx, sc, s) {
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.5));
      const word = cabeza(ctx, sc, s, lerp(TITLE.base, 1500, m));
      glint(ctx, sc, s.sheen ?? 0, word);
      if (n <= 0) return;
      const base = 1662, nova = layout(ctx, "NOVA", CINZEL(word.size), 0.36 * word.size, W / 2);
      const capMid = base - word.size * 0.35;
      bloom(ctx, sc, W / 2, capMid, 470, 130, bloomCurve(n, 0.3, 1));
      risingWord(ctx, n, nova, base, sc.nova, { from: 0.12, step: 0.09, len: 0.48, rise: 30, blur: 7 });
      // two short hairlines either side, drawn out after the letters
      const r = easeOutExpo(span01(n, 0.55, 0.95)), gi = nova.full / 2 + 34, len = 86 * r;
      if (len > 0) {
        ctx.fillStyle = sc.rule;
        ctx.fillRect(W / 2 - gi - len, capMid - 1, len, 2);
        ctx.fillRect(W / 2 + gi, capMid - 1, len, 2);
      }
    },
  },
  leads: {
    len: 1.9,
    sheen: [0.8, 1.5],
    draw(ctx, sc, s) {
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.55));
      cabeza(ctx, sc, s, lerp(TITLE.base, 1418, m), lerp(1, 0.46, m), lerp(TITLE.track, 0.3, m));
      if (n <= 0) return;
      const size = fit(ctx, "NOVA", JOSEFIN, 790, 0.06), base = 1724;
      const nova = layout(ctx, "NOVA", JOSEFIN(size), 0.06 * size, W / 2);
      bloom(ctx, sc, W / 2, base - size * 0.36, 620, 220, bloomCurve(n, 0.34, 1));
      risingWord(ctx, n, nova, base, sc.nova, { from: 0.2, step: 0.1, len: 0.55, rise: 0, blur: 12, order: [1, 0, 0, 1], scale: 1.08 });
      glint(ctx, sc, s.sheen ?? 0, { ...nova, base, size: size * 0.75 }, 0.8);
    },
  },
  signature: {
    len: 1.8,
    draw(ctx, sc, s) {
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.5));
      const word = cabeza(ctx, sc, s, lerp(TITLE.base, 1486, m));
      glint(ctx, sc, s.sheen ?? 0, word);
      if (n <= 0) return;
      const size = 236, base = 1742;
      const nova = layout(ctx, "Nova", BODONI(size), 0.01 * size, W / 2);
      const w0 = nova.x0 - 30, w1 = nova.x0 + nova.full + 60;
      const front = lerp(w0, w1 + 90, easeInOut(span01(n, 0.1, 0.78)));
      bloom(ctx, sc, W / 2, base - size * 0.3, 520, 170, bloomCurve(n, 0.4, 1));
      // the word, written in: seen through a soft edge that runs left to right
      const top = base - size, h = Math.ceil(size * 1.3);
      const c = sigCanvas(h);
      const g = c.getContext("2d");
      g.clearRect(0, 0, W, c.height);
      g.globalCompositeOperation = "source-over";
      g.font = nova.font;
      g.fillStyle = g.strokeStyle = sc.nova;
      // (Bodoni's hairlines all but vanish this large: a stroke gives them body)
      g.lineWidth = 4.5;
      g.lineJoin = "round";
      for (const l of nova.out) { g.fillText(l.ch, l.x, base - top); g.strokeText(l.ch, l.x, base - top); }
      g.globalCompositeOperation = "destination-in";
      const gr = g.createLinearGradient(front - 90, 0, front, 0);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, c.height);
      ctx.drawImage(c, 0, top);
      // a point of light running ahead of the ink
      const run = smooth(span01(n, 0.08, 0.16)) * (1 - smooth(span01(n, 0.66, 0.82)));
      if (run > 0) spark(ctx, Math.min(front - 50, w1), base - size * 0.32, sc.ground === "dark" ? 70 : 40, run * 0.9, sc.glow, sc.ground === "dark");
    },
  },
  pieces: {
    len: 1.8,
    draw(ctx, sc, s) {
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.5));
      const word = cabeza(ctx, sc, s, lerp(TITLE.base, 1462, m));
      glint(ctx, sc, s.sheen ?? 0, word);
      if (n > 0) piecesNova(ctx, sc, n, 64, 1760);
    },
  },
  banner: {
    len: 1.8,
    draw(ctx, sc, s) {
      // (the name rises first, then the band opens under it)
      const n = s.nova ?? 1, m = easeInOut(span01(n, 0, 0.36));
      const word = cabeza(ctx, sc, s, lerp(TITLE.base, 1494, m));
      if (n <= 0) { glint(ctx, sc, s.sheen ?? 0, word); return; }
      const top = 1556, bh = 116, bw = TITLE.width * easeOutExpo(span01(n, 0.3, 0.78));
      const flash = smooth(span01(n, 0.26, 0.31)) * (1 - smooth(span01(n, 0.34, 0.6)));
      if (flash > 0) spark(ctx, W / 2, top + bh / 2, sc.ground === "dark" ? 90 : 46, flash, sc.glow, sc.ground === "dark");
      if (bw > 0.5) {
        ctx.fillStyle = sc.nova;
        ctx.fillRect(W / 2 - bw / 2, top, bw, bh);
      }
      const size = 74, nova = layout(ctx, "NOVA", CINZEL(size), 0.6 * size, W / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(W / 2 - bw / 2, top, bw, bh);
      ctx.clip();
      risingWord(ctx, n, nova, top + bh / 2 + size * 0.35, sc.cut, { from: 0.5, step: 0.07, len: 0.36, rise: 14, blur: 4 });
      // the glint, across the band and its letters
      const sh = s.sheen ?? 0;
      if (sh > 0 && sh < 1) {
        const bx = W / 2 - TITLE.width / 2 - 200 + (TITLE.width + 400) * easeInOut(sh);
        const gr = ctx.createLinearGradient(bx - 110, top + bh, bx + 110 + bh * 0.35, top);
        const a = (sc.ground === "dark" ? 0.38 : 0.3) * Math.sin(Math.PI * sh);
        gr.addColorStop(0, "rgba(255,246,228,0)");
        gr.addColorStop(0.5, `rgba(255,246,228,${a})`);
        gr.addColorStop(1, "rgba(255,246,228,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(W / 2 - TITLE.width / 2, top, TITLE.width, bh);
      }
      ctx.restore();
    },
  },
};
let sigC = null;
function sigCanvas(h) {
  if (!sigC || sigC.height < h + 4) { sigC = document.createElement("canvas"); sigC.width = W; sigC.height = h + 4; }
  return sigC;
}

let STYLE = "hairline";
export const styleName = () => STYLE;
export const styleLen = () => STYLES[STYLE].len;
// When the glint crosses, in lengths of the entrance after it starts.
export const styleSheen = () => STYLES[STYLE].sheen || [0.6, 1.35];
export function setStyle(name) {
  if (!STYLES[name]) throw new Error(`no title style ${name}`);
  STYLE = name;
}

export function drawTitle(ctx, id, s = {}) {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  STYLES[STYLE].draw(ctx, SCHEME[id], s);
  ctx.restore();
}
