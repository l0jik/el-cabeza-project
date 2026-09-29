/* The den's surfaces, painted on canvases at load (no image files but
   the box lid's art): walnut paneling, shag carpet, fieldstone, the
   sofas' corduroy, plaid, the accent wall's paper, two paintings, a shelf
   of books, drapes, the night outside the glass door and the rain on it,
   the sunburst clock over the mantel.

   Every texture is a power of two at the device tier's scale
   (tienda-textures.js canvasTexture), and the ones laid over walls and
   floors repeat, mapped by world position (den-room.js), so a wall reads
   as one piece of paneling however it's cut. */

import { canvasTexture, rng } from "./tienda-textures.js";
import { paintWood } from "./wood-set.js";

const TAU = Math.PI * 2;

// Draws `fn(dx, dy)` at an offset and at each wrapped copy, so marks that
// cross an edge of a repeating texture carry on from the opposite edge.
function wrapped(W, H, x, y, reach, fn) {
  const xs = [0], ys = [0];
  if (x < reach) xs.push(W); if (x > W - reach) xs.push(-W);
  if (y < reach) ys.push(H); if (y > H - reach) ys.push(-H);
  xs.forEach((dx) => ys.forEach((dy) => fn(dx, dy)));
}

/* ------------------------------------------------------------ walls */

/* Walnut-stained plank paneling: planks of a few widths with a V-groove
   between them, each its own run of grain, one a shade off from the
   next. Repeats across; covers PANEL_TILE units of wall. */
export const PANEL_TILE = 48;
const PLANKS = [
  { base: "#6A4127", grain: "#3A2214", figure: "#51311D" },
  { base: "#5C3820", grain: "#321D10", figure: "#4A2C18" },
  { base: "#71472B", grain: "#3E2415", figure: "#58361F" },
  { base: "#633D24", grain: "#361F11", figure: "#4D2E1A" },
];
export function paneling() {
  return canvasTexture(1024, 1024, (g, W, H) => {
    const r = rng(1974);
    const widths = [];
    let total = 0;
    while (total < W * 0.9) { const w = Math.round(W * (0.075 + r() * 0.06)); widths.push(w); total += w; }
    const k = W / total; // stretch to fill exactly, so the planks tile
    let x = 0;
    widths.forEach((w0, i) => {
      const w = i === widths.length - 1 ? W - x : Math.round(w0 * k);
      paintWood(g, x, 0, w, H, { ...PLANKS[Math.floor(r() * PLANKS.length)], horizontal: false, seed: 700 + i * 13, density: 0.75 });
      // Pecky marks: a few short dark pockets along the grain.
      for (let p = 0; p < 2 + r() * 3; p++) {
        g.fillStyle = `rgba(28,15,7,${0.25 + r() * 0.3})`;
        const px = x + w * (0.2 + r() * 0.6), py = r() * H;
        g.beginPath(); g.ellipse(px, py, W * 0.0025, H * (0.01 + r() * 0.02), 0, 0, TAU); g.fill();
      }
      // The V-groove at the plank's left edge: a dark line, a lit lip.
      const gw = Math.max(2, W * 0.004);
      g.fillStyle = "rgba(18,10,5,0.9)"; g.fillRect(x, 0, gw, H);
      g.fillStyle = "rgba(255,214,160,0.14)"; g.fillRect(x + gw, 0, Math.max(1, gw * 0.5), H);
      x += w;
    });
  }, { repeat: true });
}

/* The accent wall's paper: big harvest-gold and burnt-orange daisies on
   brown, with smaller cream ones between, as the refs' sitting room. */
export const PAPER_TILE = 30;
export function floralPaper() {
  return canvasTexture(512, 512, (g, W, H) => {
    const r = rng(1972);
    g.fillStyle = "#5E3A22"; g.fillRect(0, 0, W, H);
    // A faint printed ground texture.
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "30,16,8" : "140,96,60"},0.08)`; g.fillRect(r() * W, r() * H, 2, 2); }
    const flower = (cx, cy, R, petals, petal, centre, ring) => wrapped(W, H, cx, cy, R * 1.2, (dx, dy) => {
      g.save(); g.translate(cx + dx, cy + dy);
      for (let i = 0; i < petals; i++) {
        g.rotate(TAU / petals);
        g.fillStyle = petal; g.strokeStyle = "rgba(40,22,10,0.55)"; g.lineWidth = R * 0.04;
        g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.46, R * 0.2, 0, 0, TAU); g.fill(); g.stroke();
      }
      g.fillStyle = ring; g.beginPath(); g.arc(0, 0, R * 0.32, 0, TAU); g.fill();
      g.fillStyle = centre; g.beginPath(); g.arc(0, 0, R * 0.18, 0, TAU); g.fill();
      g.restore();
    });
    const big = [["#C0632C", "#3B2618", "#E9C77A"], ["#D3A13B", "#3B2618", "#9C4A26"], ["#9C4A26", "#EFE4CB", "#D3A13B"]];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const [p, c, ring] = big[(row + col) % 3];
      flower((col + (row % 2) * 0.5) * (W / 3) + W / 6, row * (H / 3) + H / 6, W * 0.13, 8, p, c, ring);
    }
    for (let i = 0; i < 9; i++) flower(r() * W, r() * H, W * 0.05, 6, "#EFE4CB", "#9C4A26", "#D3A13B");
  }, { repeat: true });
}

/* The hall's paper, a different print from the room's daisies (user: the
   paper through the open door shouldn't match the den's): 1970s mod
   geometry, interlocking rings of avocado and harvest gold on a cream
   ground, a small burnt-orange dot at each heart. */
export const HALL_PAPER_TILE = 16;
export function hallPaper() {
  return canvasTexture(512, 512, (g, W, H) => {
    const r = rng(1974);
    g.fillStyle = "#EAE0C4"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "120,100,60" : "255,250,235"},0.07)`; g.fillRect(r() * W, r() * H, 2, 2); }
    const N = 4, cell = W / N, R = cell * 0.62;
    const ring = (cx, cy, rad, width, color) => wrapped(W, H, cx, cy, rad + width, (dx, dy) => {
      g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.arc(cx + dx, cy + dy, rad, 0, TAU); g.stroke();
    });
    // Two offset grids of rings, so each overlaps its neighbours.
    for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
      const cx = (col + 0.5) * cell, cy = (row + 0.5) * cell;
      ring(cx, cy, R, cell * 0.075, "#6B7A34");
      ring(cx, cy, R * 0.72, cell * 0.05, "#C99A2E");
    }
    for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
      const cx = col * cell, cy = row * cell;
      ring(cx, cy, R * 0.34, cell * 0.06, "#C99A2E");
      wrapped(W, H, cx, cy, cell * 0.12, (dx, dy) => { g.fillStyle = "#B5562A"; g.beginPath(); g.arc(cx + dx, cy + dy, cell * 0.085, 0, TAU); g.fill(); });
    }
  }, { repeat: true });
}

/* Fieldstone: rounded stones of greys, tans and browns laid in dark
   mortar, each lit a little from above. */
export const STONE_TILE = 22;
export function fieldstone() {
  return canvasTexture(512, 512, (g, W, H) => {
    const r = rng(1968);
    g.fillStyle = "#3F3831"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "20,16,12" : "110,100,88"},0.25)`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    const tones = ["#8E857A", "#A39A8C", "#7A6E62", "#B3A48E", "#6E655B", "#9C8A74", "#857563", "#A89078", "#6A5E52"];
    const N = 5, cell = W / N;
    for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
      const cx = (col + 0.5 + (r() - 0.5) * 0.3 + (row % 2) * 0.4) * cell, cy = (row + 0.5 + (r() - 0.5) * 0.25) * cell;
      const R = cell * (0.42 + r() * 0.08), sq = 0.75 + r() * 0.35;
      const pts = [];
      for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; const rr = R * (0.82 + r() * 0.2); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * sq]); }
      const tone = tones[Math.floor(r() * tones.length)];
      wrapped(W, H, cx, cy, R * 1.1, (dx, dy) => {
        g.save(); g.translate(cx + dx, cy + dy);
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
        g.fillStyle = tone; g.fill();
        g.save(); g.clip();
        const lg = g.createLinearGradient(-R, -R, R * 0.6, R);
        lg.addColorStop(0, "rgba(255,240,215,0.22)"); lg.addColorStop(0.55, "rgba(0,0,0,0)"); lg.addColorStop(1, "rgba(0,0,0,0.35)");
        g.fillStyle = lg; g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
        for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "30,24,18" : "220,210,190"},${0.08 + r() * 0.1})`; g.fillRect((r() - 0.5) * R * 2, (r() - 0.5) * R * 2, 2, 2); }
        g.restore();
        g.strokeStyle = "rgba(20,16,12,0.6)"; g.lineWidth = 2.5; g.stroke();
        g.restore();
      });
    }
  }, { repeat: true });
}

/* ------------------------------------------------------------ floors */

/* Shag: thousands of short curled tufts over the backing, a little
   lighter at their tips. Two colourways: avocado for the room, and the
   pit's burnt orange. */
export const SHAG_TILE = 20;
const SHAGS = {
  avocado: { seed: 11, base: "#3D4619", tufts: ["#6B7536", "#5E6B2E", "#7C8640", "#4F5A22", "#8A9450", "#556025"], tip: "rgba(200,205,140,0.35)" },
  rust: { seed: 17, base: "#6E2E12", tufts: ["#B0552A", "#C0632C", "#9C4A26", "#D07A3A", "#8A3E1C", "#C86E30"], tip: "rgba(245,190,120,0.35)" },
  gold: { seed: 23, base: "#7A5518", tufts: ["#D3A13B", "#C9A227", "#B8862E", "#E0B652", "#A87A22"], tip: "rgba(255,230,160,0.35)" },
};
export function shag(kind) {
  const p = SHAGS[kind] || SHAGS.avocado;
  return canvasTexture(512, 512, (g, W, H) => {
    const r = rng(p.seed);
    g.fillStyle = p.base; g.fillRect(0, 0, W, H);
    g.lineCap = "round";
    // A first pass of fine, short fibres fills the backing in; a second
    // of longer curled tufts lies over it.
    const n = Math.round((W * H) / 14);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, fine = i < n * 0.55;
      const len = W * (fine ? 0.008 + r() * 0.01 : 0.014 + r() * 0.02), a = r() * TAU, bend = (r() - 0.5) * len * 0.8;
      const x2 = Math.cos(a) * len, y2 = Math.sin(a) * len;
      g.globalAlpha = fine ? 0.55 : 0.8;
      g.strokeStyle = p.tufts[Math.floor(r() * p.tufts.length)];
      g.lineWidth = W * (fine ? 0.0025 : 0.003 + r() * 0.003);
      wrapped(W, H, x, y, len + 2, (dx, dy) => {
        g.beginPath(); g.moveTo(x + dx, y + dy);
        g.quadraticCurveTo(x + dx + x2 / 2 - Math.sin(a) * bend, y + dy + y2 / 2 + Math.cos(a) * bend, x + dx + x2, y + dy + y2);
        g.stroke();
        if (!fine && i % 3 === 0) { g.fillStyle = p.tip; g.fillRect(x + dx + x2 - 1, y + dy + y2 - 1, 2, 2); }
      });
    }
    g.globalAlpha = 1;
  }, { repeat: true });
}

// The ceiling: white popcorn plaster.
export const CEIL_TILE = 12;
export function popcorn() {
  return canvasTexture(256, 256, (g, W, H) => {
    const r = rng(5);
    g.fillStyle = "#E3D9C4"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5200; i++) {
      const s = 1 + r() * 2.6;
      g.fillStyle = r() < 0.55 ? `rgba(255,250,236,${0.25 + r() * 0.4})` : `rgba(120,104,82,${0.12 + r() * 0.18})`;
      g.beginPath(); g.arc(r() * W, r() * H, s, 0, TAU); g.fill();
    }
  }, { repeat: true });
}

/* ------------------------------------------------------------ fabric */

/* Wide-wale corduroy (the pit's built-in sofas): ribs running down the
   seat and back, a soft sheen on each. */
export const CORD_TILE = 6;
export function corduroy(base = "#A4481F") {
  return canvasTexture(256, 256, (g, W, H) => {
    const r = rng(31);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const wales = 16, p = W / wales;
    for (let i = 0; i < wales; i++) {
      const lg = g.createLinearGradient(i * p, 0, (i + 1) * p, 0);
      lg.addColorStop(0, "rgba(40,12,4,0.45)"); lg.addColorStop(0.35, "rgba(255,190,140,0.14)");
      lg.addColorStop(0.6, "rgba(255,190,140,0.08)"); lg.addColorStop(1, "rgba(40,12,4,0.5)");
      g.fillStyle = lg; g.fillRect(i * p, 0, p, H);
    }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "30,10,4" : "255,200,160"},0.05)`; g.fillRect(r() * W, r() * H, 1, 3); }
  }, { repeat: true });
}

// Plaid (the armchair and the ottoman): brown ground, rust, gold and cream bands.
export const PLAID_TILE = 7;
export function plaid() {
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = "#5A3A22"; g.fillRect(0, 0, W, H);
    const bands = [[0.0, 0.22, "rgba(192,99,44,0.55)"], [0.3, 0.06, "rgba(211,161,59,0.6)"], [0.42, 0.02, "rgba(239,228,203,0.55)"], [0.55, 0.16, "rgba(156,74,38,0.5)"], [0.78, 0.05, "rgba(211,161,59,0.45)"], [0.9, 0.02, "rgba(239,228,203,0.45)"]];
    bands.forEach(([at, w, c]) => { g.fillStyle = c; g.fillRect(at * W, 0, w * W, H); g.fillRect(0, at * H, W, w * H); });
    // The weave: fine diagonal twill.
    g.strokeStyle = "rgba(20,10,4,0.12)"; g.lineWidth = 1;
    for (let d = -H; d < W; d += 4) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + H, H); g.stroke(); }
  }, { repeat: true });
}

// Velvet in avocado (the lounge chair by the glass door) or gold.
export function velvet(base = "#5E6B2E") {
  return canvasTexture(128, 128, (g, W, H) => {
    const r = rng(41);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "20,24,6" : "230,236,170"},0.07)`; g.fillRect(r() * W, r() * H, 2, 2); }
  }, { repeat: true });
}

// Throw pillows: big 70s flowers on brown, and a zigzag.
export function pillowPrint(kind = 0) {
  return canvasTexture(128, 128, (g, W, H) => {
    if (kind === 1) {
      g.fillStyle = "#EFE4CB"; g.fillRect(0, 0, W, H);
      const cols = ["#9C4A26", "#D3A13B", "#3B2618"];
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = cols[i % 3]; g.lineWidth = W * 0.07;
        g.beginPath();
        for (let x = 0; x <= W; x += W / 8) g.lineTo(x, (i + 0.5) * (H / 6) + ((x / (W / 8)) % 2 ? -1 : 1) * H * 0.04);
        g.stroke();
      }
      return;
    }
    g.fillStyle = "#4A2C1C"; g.fillRect(0, 0, W, H);
    const flower = (cx, cy, R, c) => {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.fillStyle = c; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, R * 0.42, R * 0.22, a, 0, TAU); g.fill(); }
      g.fillStyle = "#EFE4CB"; g.beginPath(); g.arc(cx, cy, R * 0.22, 0, TAU); g.fill();
    };
    flower(W * 0.5, H * 0.5, W * 0.36, "#C0632C");
    flower(W * 0.12, H * 0.12, W * 0.18, "#D3A13B"); flower(W * 0.88, H * 0.88, W * 0.18, "#D3A13B");
    flower(W * 0.88, H * 0.12, W * 0.14, "#9C4A26"); flower(W * 0.12, H * 0.88, W * 0.14, "#9C4A26");
  });
}

/* Drapes: heavy, with a stylised flower print in rust, gold and brown,
   and the folds shaded in. Repeats across. */
export function drapes() {
  return canvasTexture(256, 512, (g, W, H) => {
    const r = rng(52);
    g.fillStyle = "#B8752E"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += H / 8) for (let x = 0; x < W; x += W / 4) {
      const ox = ((y / (H / 8)) % 2) * (W / 8);
      g.fillStyle = "#7A3A18";
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.beginPath(); g.ellipse(x + ox + W / 8 + Math.cos(a) * 10, y + H / 16 + Math.sin(a) * 10, 9, 5, a, 0, TAU); g.fill(); }
      g.fillStyle = "#E4B85A"; g.beginPath(); g.arc(x + ox + W / 8, y + H / 16, 5, 0, TAU); g.fill();
    }
    // The folds: soft light and dark bands down the cloth.
    const folds = 6;
    for (let i = 0; i < folds; i++) {
      const lg = g.createLinearGradient(i * (W / folds), 0, (i + 1) * (W / folds), 0);
      lg.addColorStop(0, "rgba(30,12,4,0.45)"); lg.addColorStop(0.45, "rgba(255,220,170,0.12)"); lg.addColorStop(1, "rgba(30,12,4,0.45)");
      g.fillStyle = lg; g.fillRect(i * (W / folds), 0, W / folds, H);
    }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(20,8,2,${0.03 + r() * 0.04})`; g.fillRect(r() * W, r() * H, 1, 4); }
  }, { repeat: true });
}

/* ------------------------------------------------------------ pictures */

/* Over the stereo: a lake in the mountains at sundown, in oils, in the
   manner of the landscapes every den had. */
export function landscape() {
  return canvasTexture(512, 352, (g, W, H) => {
    const r = rng(1971);
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, "#2E4A5C"); sky.addColorStop(0.45, "#8A7A62"); sky.addColorStop(0.8, "#E0A04A"); sky.addColorStop(1, "#F2C878");
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.62);
    // Clouds, brushed.
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${230 + r() * 25},${170 + r() * 50},${110 + r() * 60},${0.18 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * W, H * (0.08 + r() * 0.34), W * (0.05 + r() * 0.1), H * (0.012 + r() * 0.02), 0, 0, TAU); g.fill(); }
    const ridge = (y0, amp, col, seed) => {
      const rr = rng(seed);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      let y = y0;
      for (let x = 0; x <= W; x += W / 40) { y = y0 - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.012 + seed))) - rr() * amp * 0.3; g.lineTo(x, y); }
      g.lineTo(W, H); g.closePath(); g.fill();
    };
    ridge(H * 0.6, H * 0.26, "#5D6A7A", 3);
    ridge(H * 0.62, H * 0.14, "#3F4C3E", 7);
    // The lake, and the sky in it.
    const lake = g.createLinearGradient(0, H * 0.62, 0, H * 0.82);
    lake.addColorStop(0, "#C88C44"); lake.addColorStop(1, "#2F4450");
    g.fillStyle = lake; g.fillRect(0, H * 0.62, W, H * 0.2);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,220,150,${0.1 + r() * 0.2})`; g.fillRect(r() * W, H * (0.63 + r() * 0.16), W * (0.02 + r() * 0.06), 1.5); }
    // The near shore: dark grass and a stand of pines.
    g.fillStyle = "#2A3322"; g.fillRect(0, H * 0.8, W, H * 0.2);
    for (let i = 0; i < 14; i++) {
      const x = r() < 0.5 ? r() * W * 0.3 : W * 0.72 + r() * W * 0.28, hgt = H * (0.25 + r() * 0.3), base = H * (0.84 + r() * 0.1);
      g.fillStyle = r() < 0.5 ? "#1E2A1C" : "#26331F";
      g.beginPath(); g.moveTo(x, base - hgt);
      for (let k = 0; k <= 6; k++) { const yy = base - hgt + (k / 6) * hgt; const ww = (k / 6) * hgt * 0.22; g.lineTo(x + ww, yy); g.lineTo(x + ww * 0.55, yy); }
      for (let k = 6; k >= 0; k--) { const yy = base - hgt + (k / 6) * hgt; const ww = (k / 6) * hgt * 0.22; g.lineTo(x - ww * 0.55, yy); g.lineTo(x - ww, yy); }
      g.closePath(); g.fill();
    }
    // Brush texture over it all.
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,240,210"},0.04)`; g.fillRect(r() * W, r() * H, 3 + r() * 6, 1.5); }
  });
}

/* Over the credenza: a big abstract in the colours of the room —
   quarter circles and bands, as in the sitting room of the refs. */
export function abstractArt() {
  return canvasTexture(512, 512, (g, W, H) => {
    g.fillStyle = "#EFE4CB"; g.fillRect(0, 0, W, H);
    const arcs = [[0, 0, 0.9, "#9C4A26"], [0, 0, 0.66, "#D3A13B"], [0, 0, 0.42, "#3B2618"], [1, 1, 0.8, "#C0632C"], [1, 1, 0.56, "#EFE4CB"], [1, 1, 0.36, "#6B7536"], [1, 0, 0.36, "#D3A13B"], [0, 1, 0.3, "#6B4226"]];
    arcs.forEach(([cx, cy, rr, c]) => { g.fillStyle = c; g.beginPath(); g.arc(cx * W, cy * H, rr * W, 0, TAU); g.fill(); });
    g.strokeStyle = "#3B2618"; g.lineWidth = W * 0.012;
    g.beginPath(); g.moveTo(0, H * 0.5); g.bezierCurveTo(W * 0.3, H * 0.2, W * 0.6, H * 0.9, W, H * 0.45); g.stroke();
  });
}

/* A shelf of books: spines of every period colour, a few gold bands,
   some leaning. One row; the room stacks them. */
export function bookRow() {
  return canvasTexture(512, 128, (g, W, H) => {
    const r = rng(1966);
    g.fillStyle = "#2A1A0E"; g.fillRect(0, 0, W, H);
    const cols = ["#7A2E1E", "#3E5A3A", "#2E3E5A", "#8A6A2E", "#5A2E3E", "#6B7536", "#9C4A26", "#D3A13B", "#EFE4CB", "#3B2618", "#4E7C78", "#A33F33"];
    let x = 2;
    while (x < W - 6) {
      const w = W * (0.018 + r() * 0.03), h = H * (0.62 + r() * 0.34);
      if (r() < 0.06) { x += w * 0.8; continue; } // a gap
      const c = cols[Math.floor(r() * cols.length)];
      g.fillStyle = c; g.fillRect(x, H - h, w - 1, h);
      const lg = g.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0, "rgba(0,0,0,0.35)"); lg.addColorStop(0.4, "rgba(255,255,255,0.1)"); lg.addColorStop(1, "rgba(0,0,0,0.4)");
      g.fillStyle = lg; g.fillRect(x, H - h, w - 1, h);
      if (r() < 0.6) { g.fillStyle = "rgba(226,190,110,0.8)"; g.fillRect(x + 1, H - h + h * 0.12, w - 3, Math.max(1.5, h * 0.03)); g.fillRect(x + 1, H - h * 0.18, w - 3, Math.max(1.5, h * 0.03)); }
      if (r() < 0.5) { g.fillStyle = "rgba(240,230,200,0.5)"; g.fillRect(x + w * 0.35, H - h * 0.7, w * 0.25, h * 0.35); }
      x += w;
    }
  });
}

/* ------------------------------------------------------------ the night */

/* Through the glass door: the yard at night — a navy sky, a hedge and a
   tree against it, a neighbour's lit window far off. */
export function nightYard() {
  return canvasTexture(256, 512, (g, W, H) => {
    const r = rng(9);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0A1320"); sky.addColorStop(0.55, "#16212E"); sky.addColorStop(1, "#0C120E");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // A neighbour's lit window, far off through the rain: small and soft.
    const gl = g.createRadialGradient(W * 0.74, H * 0.63, 0, W * 0.74, H * 0.63, W * 0.07);
    gl.addColorStop(0, "rgba(255,196,120,0.55)"); gl.addColorStop(1, "rgba(255,196,120,0)");
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,206,140,0.7)"; g.fillRect(W * 0.725, H * 0.615, W * 0.03, H * 0.022);
    // The tree and the hedge, darker than the sky.
    g.fillStyle = "#070B08";
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H * 0.7 - Math.abs(Math.sin(x * 0.07)) * H * 0.04 - r() * 6);
    g.lineTo(W, H); g.closePath(); g.fill();
    for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(W * 0.25 + (r() - 0.5) * W * 0.5, H * (0.28 + r() * 0.3), 8 + r() * 22, 0, TAU); g.fill(); }
    g.fillRect(W * 0.23, H * 0.45, W * 0.04, H * 0.3);
  });
}

/* Rain running down the glass: streaks and beads, drawn light on clear,
   scrolled down the pane (den-fx.js). */
export function rainStreaks() {
  return canvasTexture(256, 512, (g, W, H) => {
    const r = rng(77);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * H, len = H * (0.05 + r() * 0.2);
      g.strokeStyle = `rgba(210,225,240,${0.1 + r() * 0.2})`; g.lineWidth = 1 + r() * 1.5;
      wrapped(W, H, x, y, len, (dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + (r() - 0.5) * 3, y + dy + len); g.stroke(); });
    }
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = r() * H, s = 1 + r() * 2.5;
      g.fillStyle = `rgba(220,235,250,${0.2 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, s, s * 1.3, 0, 0, TAU); g.fill();
    }
  }, { repeat: true });
}

/* ------------------------------------------------------------ small things */

/* The sunburst clock over the mantel: brass rays of two lengths, beads
   at their tips, round a small face (the hands are separate, and keep
   the real time). Transparent round the rays. */
export function sunburst() {
  return canvasTexture(512, 512, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const c = W / 2;
    const brass = (x0, y0, x1, y1) => { const lg = g.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, "#F4D98C"); lg.addColorStop(0.5, "#B98A32"); lg.addColorStop(1, "#7A5518"); return lg; };
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, long = i % 2 === 0, R = W * (long ? 0.48 : 0.36);
      g.save(); g.translate(c, c); g.rotate(a);
      g.fillStyle = brass(0, -3, R, 3);
      g.beginPath(); g.moveTo(W * 0.12, -W * 0.006); g.lineTo(R, -W * 0.002); g.lineTo(R, W * 0.002); g.lineTo(W * 0.12, W * 0.006); g.closePath(); g.fill();
      g.fillStyle = "#E8C66A"; g.beginPath(); g.arc(R, 0, W * (long ? 0.014 : 0.01), 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = brass(c - W * 0.13, c - W * 0.13, c + W * 0.13, c + W * 0.13); g.beginPath(); g.arc(c, c, W * 0.13, 0, TAU); g.fill();
    g.fillStyle = "#F2E8CE"; g.beginPath(); g.arc(c, c, W * 0.105, 0, TAU); g.fill();
    g.fillStyle = "#3B2618";
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(c + Math.cos(a) * W * 0.09 - 2, c + Math.sin(a) * W * 0.09 - 2, 4, 4); }
  });
}

// A lamp's pleated fabric shade, lit from inside.
export function lampShade(tint = "#F2DDB0") {
  return canvasTexture(128, 128, (g, W, H) => {
    g.fillStyle = tint; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += W / 24) { g.fillStyle = "rgba(120,80,30,0.18)"; g.fillRect(x, 0, W / 64, H); }
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, "rgba(255,255,255,0.15)"); lg.addColorStop(1, "rgba(160,100,40,0.25)");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  });
}

// Speaker cloth on the stereo console: woven tan, a gold thread.
export function grilleCloth() {
  return canvasTexture(128, 128, (g, W, H) => {
    g.fillStyle = "#8C6A42"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(40,24,10,${y % 4 ? 0.2 : 0.08})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 2) { g.fillStyle = "rgba(255,230,180,0.06)"; g.fillRect(x, 0, 1, H); }
    g.fillStyle = "rgba(211,161,59,0.35)"; for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 1, H);
  }, { repeat: true });
}

// A soft round glow, for lamps and the fire (drawn additively).
export function glow() {
  return canvasTexture(128, 128, (g, W) => {
    const rg = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    rg.addColorStop(0, "rgba(255,236,200,1)"); rg.addColorStop(0.25, "rgba(255,190,110,0.55)"); rg.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
  }, { scale: false });
}

// A soft shadow under the coffee table and the furniture.
export function contactShadow() {
  return canvasTexture(128, 128, (g, W) => {
    const rg = g.createRadialGradient(W / 2, W / 2, W * 0.1, W / 2, W / 2, W / 2);
    rg.addColorStop(0, "rgba(12,6,2,0.65)"); rg.addColorStop(0.6, "rgba(12,6,2,0.3)"); rg.addColorStop(1, "rgba(12,6,2,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
  }, { scale: false });
}

// Record sleeves leaning by the stereo, in the colours of the day.
export function sleeves() {
  return canvasTexture(256, 64, (g, W, H) => {
    const r = rng(8);
    const cols = ["#C0632C", "#2E4A5C", "#D3A13B", "#6B7536", "#A33F33", "#EFE4CB", "#3B2618"];
    for (let i = 0; i < 4; i++) {
      const x = (i / 4) * W;
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, 0, W / 4, H);
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.arc(x + W / 8, H / 2, H * (0.2 + r() * 0.2), 0, TAU); g.fill();
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + W / 4 - 2, 0, 2, H);
    }
  });
}

/* ------------------------------------------------------------ the fire's logs */

/* Bark for the logs in the grate (user: make them look like wood): wavy
   ridges running along the log, broken into plates, grey-brown with worn
   tops, dark fissures between them, a little lichen; and round
   the half that sits over the fire (u 0.55-0.95, the underside once
   den-room.js lays the log down) charred black, crazed into scales, with
   a few cracks still glowing. Wraps round the log (u) and repeats along
   it (v). */
export function barkLog() {
  return canvasTexture(256, 512, (g, W, H) => {
    const r = rng(1971);
    // The fissures' dark first; the bark's ridges laid over it.
    g.fillStyle = "#211812"; g.fillRect(0, 0, W, H);
    const ridges = 14;
    g.lineCap = "round"; g.lineJoin = "round";
    for (let i = 0; i < ridges; i++) {
      const x0 = ((i + 0.5 + (r() - 0.5) * 0.4) / ridges) * W;
      const amp = 3 + r() * 5, f = (2 + Math.floor(r() * 3)) * (Math.PI * 2) / H, ph = r() * 6.3;
      const wide = (W / ridges) * (0.62 + r() * 0.22);
      const tone = [58 + r() * 12, 49 + r() * 9, 40 + r() * 7];
      // Each ridge in plates: segments broken by a crack across now and then.
      let y = 0;
      while (y < H) {
        const len = 90 + r() * 170, y1 = Math.min(H, y + len);
        const w = wide * (0.75 + r() * 0.35);
        [0, W, -W].forEach((ox) => {
          const path = (ww, col) => {
            g.strokeStyle = col; g.lineWidth = ww;
            g.beginPath();
            for (let yy = y + 2; yy <= y1 - 2; yy += 4) { const x = x0 + ox + amp * Math.sin(yy * f + ph) + (r() - 0.5) * 1.2; yy === y + 2 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
            g.stroke();
          };
          path(w, `rgb(${tone[0]},${tone[1]},${tone[2]})`);
          path(w * 0.5, `rgba(${tone[0] + 12},${tone[1] + 10},${tone[2] + 8},0.4)`); // the ridge's worn top
          path(w * 0.14, "rgba(140,128,112,0.12)");
        });
        y = y1 + 2 + r() * 5;
      }
    }
    // Fine grit and a little grey lichen, sparingly.
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${r() < 0.85 ? "0,0,0" : "120,124,100"},${0.08 + r() * 0.14})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 3); }
    // The side over the fire: charred, crazed into scales, a few cracks glowing.
    const c0 = 0.55 * W, c1 = 0.95 * W;
    const cg = g.createLinearGradient(c0 - 20, 0, c1 + 20, 0);
    cg.addColorStop(0, "rgba(8,6,5,0)"); cg.addColorStop(0.22, "rgba(8,6,5,0.92)"); cg.addColorStop(0.78, "rgba(8,6,5,0.92)"); cg.addColorStop(1, "rgba(8,6,5,0)");
    g.fillStyle = cg; g.fillRect(c0 - 20, 0, c1 - c0 + 40, H);
    for (let y = 0; y < H; y += 8 + r() * 6) for (let x = c0; x < c1; x += 9 + r() * 7) {
      g.strokeStyle = `rgba(0,0,0,${0.5 + r() * 0.4})`; g.lineWidth = 1.1;
      g.strokeRect(x, y, 8 + r() * 5, 6 + r() * 4);
      if (r() < 0.045) { g.fillStyle = `rgba(255,${90 + r() * 70},20,${0.6 + r() * 0.4})`; g.fillRect(x, y + 3, 5 + r() * 9, 1.4); }
      else if (r() < 0.2) { g.fillStyle = "rgba(92,88,82,0.3)"; g.fillRect(x + 2, y + 2, 4, 3); } // grey ash on a scale
    }
  }, { repeat: true });
}

/* A log's cut end: pale heartwood darkening to the sapwood, growth rings
   a little off-round, drying cracks out from the pith, then the bark's
   dark rim, charred at the edge. */
export function logEnd() {
  return canvasTexture(256, 256, (g, W, H) => {
    const r = rng(1972);
    const cx = W / 2 + (r() - 0.5) * 10, cy = H / 2 + (r() - 0.5) * 10, R = W / 2;
    g.fillStyle = "#1A120C"; g.fillRect(0, 0, W, H);
    const face = g.createRadialGradient(cx, cy, 2, cx, cy, R * 0.86);
    face.addColorStop(0, "#9A6E44"); face.addColorStop(0.5, "#B98C5E"); face.addColorStop(0.85, "#A5774B"); face.addColorStop(1, "#6E4A2C");
    g.fillStyle = face; g.beginPath(); g.arc(W / 2, H / 2, R * 0.86, 0, TAU); g.fill();
    // Growth rings.
    for (let i = 1; i < 30; i++) {
      const rr = (i / 30) * R * 0.84;
      g.strokeStyle = `rgba(90,56,28,${0.25 + r() * 0.3})`; g.lineWidth = 0.8 + r() * 1.4;
      g.beginPath();
      for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU, w = rr * (1 + 0.035 * Math.sin(a * 3 + i) + 0.02 * Math.sin(a * 5)); const x = cx + Math.cos(a) * w, y = cy + Math.sin(a) * w; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // Drying cracks from the pith.
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, len = R * (0.35 + r() * 0.45);
      g.strokeStyle = "rgba(30,18,10,0.85)"; g.lineWidth = 1.5 + r() * 1.5;
      g.beginPath(); g.moveTo(cx, cy);
      let x = cx, y = cy;
      for (let s = 1; s <= 6; s++) { const aa = a + (r() - 0.5) * 0.25; x = cx + Math.cos(aa) * (len * s) / 6; y = cy + Math.sin(aa) * (len * s) / 6; g.lineTo(x, y); }
      g.stroke();
    }
    // The pith.
    g.fillStyle = "#4A2E18"; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
    // The bark's rim, charred at its edge, and soot creeping in.
    g.strokeStyle = "#2A1C12"; g.lineWidth = R * 0.14; g.beginPath(); g.arc(W / 2, H / 2, R * 0.92, 0, TAU); g.stroke();
    const soot = g.createRadialGradient(W / 2, H / 2, R * 0.55, W / 2, H / 2, R);
    soot.addColorStop(0, "rgba(10,6,4,0)"); soot.addColorStop(0.8, "rgba(10,6,4,0.45)"); soot.addColorStop(1, "rgba(5,3,2,0.95)");
    g.fillStyle = soot; g.fillRect(0, 0, W, H);
  });
}
