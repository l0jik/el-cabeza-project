/* Theme Lab: procedural surfaces, painted on canvas.

   Every board in the lab is painted here rather than loaded: printed
   paper, cold-pressed paper, enamel, brushed aluminium, board-formed
   concrete, parchment, anodised aluminium, flat paint, pure white and a
   weathered composite. Nothing is fetched and nothing depends on the
   network. The board painter follows the live board size (rows and
   columns are the engine's live bindings), so a custom-sized board is
   painted to its own proportions, never stretched. */

import * as THREE from "three";
import { BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MAX, MARGIN, SQUARE_SIZE } from "../../engine/constants.js";

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};

/* Canvas text drawn before a web font has arrived is drawn in a
   fallback face. Every painted texture registers how to paint itself;
   once the direction's fonts have loaded, each is painted again on its
   own canvas and re-uploaded. */
const REPAINT = new Set();
function track(tex, paint) {
  tex.__repaint = paint;
  REPAINT.add(tex);
  tex.addEventListener("dispose", () => REPAINT.delete(tex));
  return tex;
}
export function repaintWhenFontsReady(spec) {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const fams = [spec.typography.display, spec.typography.body, spec.typography.mono];
  const loads = [];
  fams.forEach((f) => ["400", "700", "900"].forEach((w) => loads.push(document.fonts.load(`${w} 40px ${f}`).catch(() => null))));
  return Promise.all(loads).then(() => document.fonts.ready).then(() => {
    REPAINT.forEach((t) => { try { t.__repaint(); t.needsUpdate = true; } catch (e) { /* a canvas gone */ } });
  });
}

/* A small tile of grain, used as a repeating pattern: cheap to make
   once, cheap to paint with. kind picks the character of the grain. */
const TILES = new Map();
function grainTile(kind, seed = 7) {
  const key = `${kind}:${seed}`;
  if (TILES.has(key)) return TILES.get(key);
  const S = 256;
  const c = canvasOf(S, S);
  const g = c.getContext("2d");
  const r = rng(seed);
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    let v = 0, a = 0;
    if (kind === "paper") { v = r() < 0.5 ? 0 : 255; a = r() * 10; }
    else if (kind === "fiber") { v = 90; a = r() < 0.03 ? 22 : r() * 7; }
    else if (kind === "concrete") { v = r() * 255; a = 22 + r() * 18; }
    else if (kind === "brushH") { v = 255 * (0.5 + 0.5 * Math.sin(y * 0.9 + r() * 0.8)); a = 10 + r() * 8; }
    else if (kind === "stain") { v = 60; a = r() * 5; }
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = a;
    void x;
  }
  g.putImageData(img, 0, 0);
  TILES.set(key, c);
  return c;
}

function pattern(g, kind, seed) {
  return g.createPattern(grainTile(kind, seed), "repeat");
}

/* The board's canvas and the mapping from board squares to pixels,
   matching the slab's own aspect (see themes/standard.js). */
function boardCanvas() {
  const RES = 2048;
  const pxPerUnit = RES / SLAB_MAX;
  const c = canvasOf(Math.round(SLAB_X * pxPerUnit), Math.round(SLAB_Z * pxPerUnit));
  const g = c.getContext("2d");
  const pad = MARGIN * pxPerUnit;
  const sq = SQUARE_SIZE * pxPerUnit;
  const cell = (r, col) => ({ x: pad + col * sq, y: pad + r * sq, s: sq });
  return { c, g, pad, sq, cell, W: c.width, H: c.height };
}

const colName = (c) => {
  let s = "", n = c;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};
export const squareName = (row, col) => `${colName(col)}${BOARD_ROWS - row}`;

function speckle(g, W, H, n, color, rmin, rmax, seed) {
  const r = rng(seed);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc(r() * W, r() * H, rmin + r() * (rmax - rmin), 0, Math.PI * 2);
    g.fill();
  }
}

function blotches(g, W, H, n, rgb, amax, seed, scale = 0.25) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = (0.05 + r() * scale) * Math.max(W, H);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${rgb},${(r() * amax).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
}

/* ------------------------------------------------------------ boards */

const PAINTERS = {
  swissPrint(spec, b) {
    const { g, W, H, pad, sq, cell } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    g.fillStyle = pattern(g, "paper", 3); g.fillRect(0, 0, W, H);
    // The two goal rows: a single red rule where each begins.
    g.fillStyle = spec.colors.accentPrimary;
    const t = Math.max(3, sq * 0.035);
    g.fillRect(pad, pad + sq - t / 2, BOARD_COLS * sq, t);
    g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq - t / 2, BOARD_COLS * sq, t);
    // Registration: a red square at the origin corner.
    g.fillRect(pad * 0.28, pad * 0.28, pad * 0.34, pad * 0.34);
    // Column and row numbers in the margin, small and exact.
    g.fillStyle = "#000";
    g.font = `700 ${Math.round(pad * 0.36)}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    g.textBaseline = "middle";
    for (let c2 = 0; c2 < BOARD_COLS; c2++) {
      g.textAlign = "left";
      g.fillText(colName(c2), cell(0, c2).x + sq * 0.06, pad * 0.52);
    }
    for (let r2 = 0; r2 < BOARD_ROWS; r2++) {
      g.textAlign = "center";
      g.fillText(String(BOARD_ROWS - r2).padStart(2, "0"), pad * 0.5, cell(r2, 0).y + sq * 0.5);
    }
    void H;
  },

  bauhausPaper(spec, b) {
    const { g, W, H, pad, sq } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    g.fillStyle = pattern(g, "fiber", 11); g.fillRect(0, 0, W, H);
    // Architectural zones: quarter circles from two corners of the field,
    // a triangle wedge from a third, faint, under everything.
    const fx = pad, fy = pad, fw = BOARD_COLS * sq, fh = BOARD_ROWS * sq;
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    g.globalAlpha = 0.13;
    g.fillStyle = spec.colors.accentTertiary;
    g.beginPath(); g.arc(fx + fw, fy + fh * 0.5, fh * 0.34, 0, Math.PI * 2); g.fill();
    g.fillStyle = spec.colors.accentSecondary;
    g.beginPath(); g.moveTo(fx, fy + fh); g.lineTo(fx + fw * 0.42, fy + fh); g.lineTo(fx, fy + fh * 0.58); g.fill();
    g.fillStyle = spec.colors.accentPrimary;
    g.fillRect(fx + fw * 0.08, fy + fh * 0.06, fw * 0.16, fw * 0.16);
    g.restore();
    // Goal rows: a band of each side's colour, printed flat.
    g.globalAlpha = 0.2;
    g.fillStyle = spec.colors.pieceDark; g.fillRect(fx, fy + fh - sq, fw, sq);
    g.fillStyle = spec.colors.pieceLight; g.fillRect(fx, fy, fw, sq);
    g.globalAlpha = 1;
    // The margin: charcoal, a cut edge.
    g.strokeStyle = spec.colors.textPrimary; g.lineWidth = pad * 0.16;
    g.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad);
  },

  destijlField(spec, b) {
    const { g, W, H, pad, sq } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    g.fillStyle = pattern(g, "paper", 21); g.fillRect(0, 0, W, H);
    // The frame is where the primaries live: long blocks, one per side,
    // separated by black; the playing fields stay white.
    const fw = BOARD_COLS * sq, fh = BOARD_ROWS * sq;
    g.fillStyle = spec.colors.pieceLight; g.fillRect(0, 0, W * 0.62, pad); // light's end (top): blue
    g.fillStyle = spec.colors.accentTertiary; g.fillRect(W * 0.62, 0, W * 0.38, pad);
    g.fillStyle = spec.colors.pieceDark; g.fillRect(W * 0.3, H - pad, W * 0.7, pad); // dark's end (bottom): red
    g.fillStyle = spec.colors.accentTertiary; g.fillRect(0, H - pad, W * 0.3, pad * 1);
    g.fillStyle = "#0E0E0E";
    g.fillRect(W * 0.62 - pad * 0.12, 0, pad * 0.24, pad);
    g.fillRect(W * 0.3 - pad * 0.12, H - pad, pad * 0.24, pad);
    // Goal rows: the fields a shade cooler, enamel over a different base.
    g.fillStyle = "rgba(20,30,60,0.045)";
    g.fillRect(pad, pad, fw, sq); g.fillRect(pad, pad + fh - sq, fw, sq);
  },

  brushedDiagonal(spec, b) {
    const { g, W, H, pad, sq } = b;
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#C7CDD3"); base.addColorStop(0.5, "#AEB5BD"); base.addColorStop(1, "#C3C9CF");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // The brushing runs at 45°: the counter-composition in the metal itself.
    const r = rng(404);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 4);
    const D = Math.hypot(W, H);
    for (let i = 0; i < 2600; i++) {
      const y = (r() - 0.5) * D, x = (r() - 0.5) * D, len = 40 + r() * 400;
      g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.08})` : `rgba(40,48,58,${0.03 + r() * 0.06})`;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }
    g.restore();
    // Goal rows: orange hatching at 45°.
    const fw = BOARD_COLS * sq;
    [0, BOARD_ROWS - 1].forEach((row) => {
      g.save(); g.beginPath(); g.rect(pad, pad + row * sq, fw, sq); g.clip();
      g.strokeStyle = spec.colors.accentPrimary; g.globalAlpha = 0.34; g.lineWidth = sq * 0.05;
      for (let x = -sq; x < fw + sq; x += sq * 0.24) { g.beginPath(); g.moveTo(pad + x, pad + row * sq + sq); g.lineTo(pad + x + sq, pad + row * sq); g.stroke(); }
      g.restore();
    });
    // A single diagonal axis across the whole plate, machined in.
    g.strokeStyle = "rgba(28,33,39,0.22)"; g.lineWidth = pad * 0.08;
    g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke();
  },

  concrete(spec, b) {
    const { g, W, H, pad, sq, cell } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    blotches(g, W, H, 26, "60,58,54", 0.16, 91);
    blotches(g, W, H, 14, "235,232,225", 0.14, 92);
    g.fillStyle = pattern(g, "concrete", 5); g.fillRect(0, 0, W, H);
    // Board-formed: the plank seams and a little grain of the formwork.
    const r = rng(77);
    const plank = sq * 0.52;
    for (let y = 0; y < H; y += plank) {
      g.fillStyle = "rgba(40,38,35,0.18)"; g.fillRect(0, y, W, 2.2);
      for (let k = 0; k < 24; k++) {
        g.strokeStyle = `rgba(70,66,60,${0.03 + r() * 0.05})`; g.lineWidth = 1;
        const yy = y + r() * plank;
        g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(W * 0.3, yy + (r() - 0.5) * 6, W * 0.6, yy + (r() - 0.5) * 6, W, yy); g.stroke();
      }
    }
    // Pores and aggregate.
    speckle(g, W, H, 2400, "rgba(30,28,26,0.35)", 0.6, 2.4, 13);
    speckle(g, W, H, 900, "rgba(220,216,208,0.4)", 0.6, 2.8, 14);
    // Goal rows: darker, as if cast in a second pour.
    const fw = BOARD_COLS * sq;
    g.fillStyle = "rgba(40,38,34,0.16)";
    g.fillRect(pad, pad, fw, sq); g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq, fw, sq);
    // Stencilled coordinates in every square.
    g.fillStyle = "rgba(24,22,20,0.4)";
    g.font = `800 ${Math.round(sq * 0.15)}px 'JetBrains Mono', 'Courier New', monospace`;
    g.textAlign = "left"; g.textBaseline = "top";
    for (let r2 = 0; r2 < BOARD_ROWS; r2++) for (let c2 = 0; c2 < BOARD_COLS; c2++) {
      const q = cell(r2, c2);
      g.fillText(squareName(r2, c2), q.x + sq * 0.07, q.y + sq * 0.07);
    }
    g.font = `800 ${Math.round(pad * 0.42)}px 'JetBrains Mono', monospace`;
    g.fillStyle = "rgba(24,22,20,0.55)";
    g.fillText("GOAL / LIGHT", pad, pad * 0.3);
    g.textBaseline = "bottom"; g.fillText("GOAL / DARK", pad, H - pad * 0.26);
  },

  parchment(spec, b) {
    const { g, W, H, pad, sq, cell } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    blotches(g, W, H, 10, "190,160,110", 0.12, 55);
    g.fillStyle = pattern(g, "fiber", 17); g.fillRect(0, 0, W, H);
    // Goal rows: a heavy red rule and a hairline, the way a page opens.
    const fw = BOARD_COLS * sq;
    g.fillStyle = spec.colors.accentPrimary;
    g.fillRect(pad, pad + sq - sq * 0.05, fw, sq * 0.05);
    g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq, fw, sq * 0.05);
    // Margin coordinates, typeset.
    g.fillStyle = spec.colors.textPrimary;
    g.font = `900 ${Math.round(pad * 0.5)}px 'Archivo', 'Helvetica Neue', Arial, sans-serif`;
    g.textBaseline = "middle"; g.textAlign = "center";
    for (let c2 = 0; c2 < BOARD_COLS; c2++) g.fillText(colName(c2), cell(0, c2).x + sq / 2, H - pad / 2);
    g.textAlign = "center";
    for (let r2 = 0; r2 < BOARD_ROWS; r2++) g.fillText(String(BOARD_ROWS - r2), pad / 2, cell(r2, 0).y + sq / 2);
    void W;
  },

  anodized(spec, b) {
    const { g, W, H, pad, sq, cell } = b;
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#26406A"); base.addColorStop(1, "#1D3356");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    g.fillStyle = pattern(g, "brushH", 9); g.fillRect(0, 0, W, H);
    // Micro-engraved square codes, top left of each square.
    g.fillStyle = "rgba(190,208,236,0.42)";
    g.font = `500 ${Math.round(sq * 0.11)}px 'Share Tech Mono', 'Courier New', monospace`;
    g.textAlign = "left"; g.textBaseline = "top";
    for (let r2 = 0; r2 < BOARD_ROWS; r2++) for (let c2 = 0; c2 < BOARD_COLS; c2++) {
      const q = cell(r2, c2);
      g.fillText(squareName(r2, c2), q.x + sq * 0.06, q.y + sq * 0.06);
    }
    // Goal rows: a safety-yellow double rule at the row's inner edge.
    const fw = BOARD_COLS * sq;
    g.fillStyle = spec.colors.accentPrimary;
    [[pad + sq, -1], [pad + (BOARD_ROWS - 1) * sq, 1]].forEach(([y, s]) => {
      g.fillRect(pad, y - (s < 0 ? sq * 0.05 : 0), fw, sq * 0.03);
      g.fillRect(pad, y + s * sq * 0.06 - (s < 0 ? sq * 0.05 : 0), fw, sq * 0.012);
    });
    // Margin: engraved scale ticks.
    g.fillStyle = "rgba(190,208,236,0.5)";
    for (let c2 = 0; c2 <= BOARD_COLS * 4; c2++) {
      const x = pad + (c2 * sq) / 4, long = c2 % 4 === 0;
      g.fillRect(x - 0.8, H - pad * (long ? 0.62 : 0.4), 1.6, pad * (long ? 0.36 : 0.18));
      g.fillRect(x - 0.8, pad * (long ? 0.26 : 0.22), 1.6, pad * (long ? 0.36 : 0.18));
    }
    g.font = `500 ${Math.round(pad * 0.28)}px 'Share Tech Mono', monospace`;
    g.textBaseline = "middle";
    g.fillText("EL CABEZA · FIELD UNIT 10-A", pad, pad * 0.14 + 4);
  },

  flatPaint(spec, b) {
    const { g, W, H, pad, sq } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    const fw = BOARD_COLS * sq;
    g.fillStyle = "#B6F2D2";
    g.fillRect(pad, pad, fw, sq); g.fillRect(pad, pad + (BOARD_ROWS - 1) * sq, fw, sq);
    // Checker in a second lavender, flat: this style likes a pattern.
    g.fillStyle = "#CDBEFF";
    for (let r2 = 1; r2 < BOARD_ROWS - 1; r2++) for (let c2 = 0; c2 < BOARD_COLS; c2++) {
      if ((r2 + c2) % 2) g.fillRect(pad + c2 * sq, pad + r2 * sq, sq, sq);
    }
    // The margin: black.
    g.fillStyle = "#000"; g.fillRect(0, 0, W, pad * 0.5); g.fillRect(0, H - pad * 0.5, W, pad * 0.5);
    g.fillRect(0, 0, pad * 0.5, H); g.fillRect(W - pad * 0.5, 0, pad * 0.5, H);
  },

  pureWhite(spec, b) {
    const { g, W, H, pad, sq } = b;
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, H);
    // The goal rows are known by four ticks at their ends, nothing else.
    g.fillStyle = "rgba(0,0,0,0.5)";
    const fw = BOARD_COLS * sq, t = Math.max(2, sq * 0.012), l = sq * 0.18;
    [pad + sq, pad + (BOARD_ROWS - 1) * sq].forEach((y) => {
      g.fillRect(pad - l - sq * 0.08, y - t / 2, l, t);
      g.fillRect(pad + fw + sq * 0.08, y - t / 2, l, t);
    });
    void W; void H;
  },

  composite(spec, b) {
    const { g, W, H, pad, sq, cell } = b;
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    blotches(g, W, H, 22, "120,108,92", 0.14, 301);
    blotches(g, W, H, 8, "150,80,40", 0.08, 302, 0.12);
    g.fillStyle = pattern(g, "concrete", 8); g.fillRect(0, 0, W, H);
    // Scratches, running with use.
    const r = rng(303);
    for (let i = 0; i < 260; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI, l = 10 + r() * 90;
      g.strokeStyle = `rgba(${r() < 0.5 ? "255,255,250" : "60,54,46"},${0.06 + r() * 0.12})`; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // Goal rows: a cadmium strip (light's goal) and an industrial yellow
    // strip (dark's goal) painted along the outer edge, worn.
    const fw = BOARD_COLS * sq;
    g.fillStyle = spec.colors.accentPrimary; g.fillRect(pad, pad, fw, sq * 0.16);
    g.fillStyle = spec.colors.accentSecondary; g.fillRect(pad, pad + BOARD_ROWS * sq - sq * 0.16, fw, sq * 0.16);
    g.globalCompositeOperation = "destination-out";
    speckle(g, W, H, 700, "rgba(0,0,0,0.5)", 0.8, 3, 304);
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = spec.colors.boardSurface; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    // Stencilled coordinates, mono, in each square's lower right.
    g.fillStyle = "rgba(43,43,43,0.36)";
    g.font = `600 ${Math.round(sq * 0.105)}px 'Martian Mono', 'Courier New', monospace`;
    g.textAlign = "right"; g.textBaseline = "bottom";
    for (let r2 = 0; r2 < BOARD_ROWS; r2++) for (let c2 = 0; c2 < BOARD_COLS; c2++) {
      const q = cell(r2, c2);
      g.fillText(squareName(r2, c2), q.x + sq * 0.93, q.y + sq * 0.95);
    }
    // Rust bloom in from the edges.
    const edge = g.createLinearGradient(0, 0, 0, pad * 1.2);
    edge.addColorStop(0, "rgba(120,62,28,0.2)"); edge.addColorStop(1, "rgba(120,62,28,0)");
    g.fillStyle = edge; g.fillRect(0, 0, W, pad * 1.2);
    void H;
  },
};

export function paintBoard(spec) {
  const b = boardCanvas();
  const paint = () => { b.g.clearRect(0, 0, b.W, b.H); (PAINTERS[spec.board.paint] || PAINTERS.swissPrint)(spec, b); };
  paint();
  const tex = new THREE.CanvasTexture(b.c);
  tex.anisotropy = 8;
  return track(tex, paint);
}

/* ------------------------------------------------------------ ground sheets */

/* The large sheet the board sits on, for the directions whose
   composition carries on past the board (Swiss's printed sheet, New
   Typography's page, Corporate Swiss's console, Fusion's machine bed).
   Laid out in world units around the board, not in canvas pixels: the
   camera looks straight down, so what shows is a band to the right of
   the board on a wide screen and bands above and below it on a tall
   one. Everything that matters is set into those bands. S is the sheet's
   size in world units. */
export function paintGroundSheet(spec, kind, S) {
  const N = 2048;
  const c = canvasOf(N, N);
  const g = c.getContext("2d");
  const paint = () => drawGroundSheet(spec, kind, S, g, N);
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return track(tex, paint);
}
function drawGroundSheet(spec, kind, S, g, N) {
  g.clearRect(0, 0, N, N);
  const k = N / S;                       // pixels per world unit
  const X = (wx) => (wx / S + 0.5) * N;  // world x -> px
  const Z = (wz) => (wz / S + 0.5) * N;  // world z -> px (down the screen)
  const HX = SLAB_X / 2, HZ = SLAB_Z / 2;
  const RX = HX + 1.5;                    // the right-hand band starts here (clear of a phone's edge)
  const u = (w) => w * k;                 // a world length in px
  const col = spec.colors;
  if (kind === "typeSheet") {
    g.fillStyle = col.bgPrimary; g.fillRect(0, 0, N, N);
    g.fillStyle = pattern(g, "fiber", 23); g.fillRect(0, 0, N, N);
    // Right band: the title set vertically, a heavy red bar beside it.
    g.fillStyle = col.accentPrimary; g.fillRect(X(RX), Z(-HZ), u(0.35), u(SLAB_Z));
    g.save(); g.translate(X(RX + 0.6), Z(HZ)); g.rotate(-Math.PI / 2);
    g.fillStyle = col.textPrimary; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `900 ${Math.round(u(2.2))}px 'Archivo', 'Helvetica Neue', Arial, sans-serif`;
    g.fillText("EL CABEZA", 0, 0);
    g.font = `600 ${Math.round(u(0.36))}px 'Archivo', Arial, sans-serif`;
    g.fillText("A GAME OF UNPARALLELED INTENTION", u(0.05), u(2.35));
    g.fillText("TWO PLAYERS · ONE BOARD · NO CHANCE", u(0.05), u(2.85));
    g.restore();
    g.fillStyle = col.textPrimary; g.fillRect(X(RX + 3.7), Z(-HZ), u(0.08), u(SLAB_Z));
    // Above the board: a heavy rule and the plate's number, set small.
    g.fillStyle = col.textPrimary; g.fillRect(X(-HX), Z(-HZ - 0.35), u(SLAB_X), u(0.12));
    g.font = `800 ${Math.round(u(0.3))}px 'Archivo', Arial, sans-serif`;
    g.textAlign = "right"; g.textBaseline = "alphabetic"; g.fillStyle = col.accentPrimary;
    g.fillText("PLATE 06", X(HX), Z(-HZ - 0.5));
    g.textAlign = "left";
    // Below it: the running foot.
    g.font = `600 ${Math.round(u(0.3))}px 'Archivo', Arial, sans-serif`; g.textBaseline = "top";
    g.fillText("DIE NEUE TYPOGRAPHIE — BOARD PLATE Nº 1", X(-HX), Z(HZ + 0.45));
    g.fillStyle = col.accentPrimary; g.fillRect(X(-HX), Z(HZ + 0.3), u(1.4), u(0.1));
  } else if (kind === "console") {
    const base = g.createLinearGradient(0, 0, N, N);
    base.addColorStop(0, "#132542"); base.addColorStop(1, "#0C1A30");
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    g.fillStyle = pattern(g, "brushH", 12); g.fillRect(0, 0, N, N);
    // The bezel the board is set into, a few engraved rules deep.
    g.strokeStyle = "rgba(143,163,196,0.35)"; g.lineWidth = 2;
    for (let i = 1; i <= 4; i++) g.strokeRect(X(-HX - 0.15 * i), Z(-HZ - 0.15 * i), u(SLAB_X + 0.3 * i), u(SLAB_Z + 0.3 * i));
    // Right band: the unit's plate and its lamps.
    g.fillStyle = col.accentPrimary; g.fillRect(X(RX), Z(-HZ), u(2.6), u(0.12));
    g.fillStyle = "rgba(190,208,236,0.62)"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `500 ${Math.round(u(0.3))}px 'Share Tech Mono', monospace`;
    ["SYS 07", "FIELD UNIT 10-A", "MODEL EC-1964", "SER. 0407-1964", "", "PWR", "LINK", "GRID"].forEach((l, i) => g.fillText(l, X(RX), Z(-HZ + 0.4 + i * 0.5)));
    [[5, "#FFC400"], [6, "#46D38A"], [7, "#46D38A"]].forEach(([i, lamp]) => {
      g.fillStyle = lamp; g.beginPath(); g.arc(X(RX + 1.9), Z(-HZ + 0.55 + i * 0.5), u(0.11), 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = "rgba(190,208,236,0.62)";
    // Above and below: scale bars, and the maker's line.
    for (let i = 0; i <= 40; i++) { const x = -HX + (SLAB_X * i) / 40; g.fillRect(X(x), Z(-HZ - 0.9), 2, u(i % 5 ? 0.15 : 0.32)); }
    g.fillText("EL CABEZA INFORMATION SYSTEMS · DIVISION OF GAMES", X(-HX), Z(HZ + 0.5));
    g.fillStyle = col.accentPrimary; g.fillRect(X(HX - 2.4), Z(HZ + 0.52), u(2.4), u(0.12));
  } else if (kind === "sheet") {
    g.fillStyle = col.bgPrimary; g.fillRect(0, 0, N, N);
    g.fillStyle = pattern(g, "paper", 31); g.fillRect(0, 0, N, N);
    // The sheet's own field grid, very light, which the board sits on.
    g.strokeStyle = "rgba(0,0,0,0.07)"; g.lineWidth = 1.5;
    for (let w = -S / 2; w <= S / 2; w += SQUARE_SIZE * 2) { g.beginPath(); g.moveTo(X(w), 0); g.lineTo(X(w), N); g.stroke(); g.beginPath(); g.moveTo(0, Z(w)); g.lineTo(N, Z(w)); g.stroke(); }
    // Right band: a red square, the name, and trilingual captions set
    // flush left on the sheet's grid.
    g.fillStyle = col.accentPrimary; g.fillRect(X(RX), Z(-HZ), u(1.6), u(1.6));
    g.fillStyle = "#000"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `800 ${Math.round(u(0.95))}px 'Helvetica Neue', Helvetica, 'Inter Tight', Arial, sans-serif`;
    g.fillText("El", X(RX), Z(-HZ + 2.2)); g.fillText("Cabeza", X(RX), Z(-HZ + 3.1));
    g.font = `500 ${Math.round(u(0.26))}px 'Helvetica Neue', Helvetica, 'Inter Tight', Arial, sans-serif`;
    ["Spielbrett · Plateau · Board", "10 × 10 Felder · cases · squares", "2 Spieler · joueurs · players"].forEach((l, i) => g.fillText(l, X(RX), Z(-HZ + 4.6 + i * 0.42)));
    g.fillRect(X(RX), Z(-HZ + 4.35), u(3.2), 2);
    g.fillStyle = col.accentPrimary; g.fillRect(X(-HX), Z(HZ + 0.35), u(SLAB_X * 0.25), u(0.08));
    g.fillStyle = "#000"; g.fillText("Internationaler Typografischer Stil", X(-HX), Z(HZ + 0.55));
  } else if (kind === "machine") {
    g.fillStyle = "#2E2D2B"; g.fillRect(0, 0, N, N);
    g.fillStyle = pattern(g, "concrete", 41); g.fillRect(0, 0, N, N);
    blotches(g, N, N, 12, "10,10,10", 0.3, 42);
    const hazard = (x, y, w, hh) => {
      g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip();
      g.fillStyle = col.accentSecondary; g.fillRect(x, y, w, hh);
      g.fillStyle = "#1A1A1A";
      const step = Math.min(w, hh) * 1.2;
      for (let q = -Math.max(w, hh); q < Math.max(w, hh) * 2; q += step) { g.beginPath(); g.moveTo(x + q, y + hh); g.lineTo(x + q + step / 2, y + hh); g.lineTo(x + q + step / 2 + hh, y); g.lineTo(x + q + hh, y); g.fill(); }
      g.restore();
    };
    // Hazard strips just outside the frame, above and below, and a
    // vertical one down the right band.
    hazard(X(-HX - 0.5), Z(HZ + 0.75), u(SLAB_X + 1), u(0.32));
    hazard(X(-HX - 0.5), Z(-HZ - 1.07), u(SLAB_X + 1), u(0.32));
    hazard(X(RX + 0.2), Z(-HZ), u(0.32), u(SLAB_Z));
    g.fillStyle = "rgba(234,230,223,0.7)"; g.textAlign = "left"; g.textBaseline = "top";
    g.font = `600 ${Math.round(u(0.26))}px 'Martian Mono', monospace`;
    ["UNIT 10", "FUSION", "LOAD 16", "PCS", "", "SWISS", "STIJL", "BRUT"].forEach((l, i) => g.fillText(l, X(RX + 0.8), Z(-HZ + 0.2 + i * 0.46)));
    g.fillStyle = col.accentPrimary; g.fillRect(X(RX + 0.8), Z(-HZ + 4.1), u(1.8), u(0.16));
    g.font = `900 ${Math.round(u(1.5))}px 'Helvetica Neue', Helvetica, 'Schibsted Grotesk', Arial, sans-serif`;
    g.fillStyle = "rgba(234,230,223,0.85)"; g.fillText("10", X(RX + 0.75), Z(-HZ + 4.5));
  }
}

/* ------------------------------------------------------------ piece textures */

const PIECE_TEX = new Map();
/* A tileable surface map for a piece material: cast iron, concrete, a
   painted metal gone a little worn, a composite. Returned as a colour
   map to multiply over the material colour (so it stays near white). */
export function pieceSurface(kind) {
  if (!kind) return null;
  if (PIECE_TEX.has(kind)) return PIECE_TEX.get(kind);
  const S = 256;
  const c = canvasOf(S, S);
  const g = c.getContext("2d");
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, S, S);
  if (kind === "iron") {
    blotches(g, S, S, 14, "90,80,70", 0.4, 501, 0.3);
    speckle(g, S, S, 500, "rgba(40,36,32,0.35)", 0.4, 1.4, 502);
    blotches(g, S, S, 5, "150,80,40", 0.25, 503, 0.2);
  } else if (kind === "concrete") {
    blotches(g, S, S, 10, "110,106,100", 0.35, 511, 0.3);
    speckle(g, S, S, 700, "rgba(60,58,54,0.4)", 0.4, 1.6, 512);
  } else if (kind === "paintedMetal") {
    blotches(g, S, S, 8, "120,116,110", 0.25, 521, 0.25);
    speckle(g, S, S, 120, "rgba(180,170,150,0.7)", 0.4, 2, 522);
  } else if (kind === "composite") {
    blotches(g, S, S, 12, "140,128,110", 0.3, 531, 0.3);
    speckle(g, S, S, 300, "rgba(90,84,76,0.3)", 0.4, 1.2, 532);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  PIECE_TEX.set(kind, tex);
  return tex;
}

/* ------------------------------------------------------------ marks on pieces */

const MARKS = new Map();
/* The mark printed on a piece's top: drawn once per distinct mark and
   kept (a game has at most a few dozen). w/h are the face's proportions
   (a Flaco lying down has a long face). */
export function markTexture(spec, kind, { label, owner, type, square, w = 1, h = 1, isCabeza }) {
  const key = [spec.id, kind, label, owner, square, w, h, isCabeza].join("|");
  if (MARKS.has(key)) return MARKS.get(key);
  if (!MARK_KINDS.has(kind) || (kind === "cabezaYellow" && !isCabeza)) return null;
  const U = 128;
  const c = canvasOf(Math.round(U * w), Math.round(U * h));
  const g = c.getContext("2d");
  const paint = () => drawMark(spec, kind, { label, owner, type, square, isCabeza }, g, c.width, c.height);
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  MARKS.set(key, tex);
  return track(tex, paint);
}
const MARK_KINDS = new Set(["shape", "cabezaYellow", "diamond", "code", "glyph", "serial", "sticker", "idCoord"]);
function drawMark(spec, kind, { label, owner, type, square, isCabeza }, g, W, H) {
  const m = Math.min(W, H);
  const dark = owner === "dark";
  const col = spec.colors;
  const ink = dark ? col.inkOnDark : col.inkOnLight;
  g.clearRect(0, 0, W, H);
  g.textAlign = "center"; g.textBaseline = "middle";
  if (kind === "shape") {
    // Bauhaus: Dark is the circle, Light the square; the Cabeza, whose
    // capture ends the game, is the yellow triangle.
    g.fillStyle = isCabeza ? col.accentTertiary : ink;
    const s = m * 0.52;
    g.beginPath();
    if (isCabeza) { g.moveTo(W / 2, H / 2 - s * 0.5); g.lineTo(W / 2 + s * 0.52, H / 2 + s * 0.4); g.lineTo(W / 2 - s * 0.52, H / 2 + s * 0.4); }
    else if (dark) g.arc(W / 2, H / 2, s / 2, 0, Math.PI * 2);
    else g.rect(W / 2 - s / 2, H / 2 - s / 2, s, s);
    g.fill();
  } else if (kind === "cabezaYellow") {
    g.fillStyle = col.accentTertiary; g.fillRect(0, 0, W, H);
  } else if (kind === "diamond") {
    g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI / 4);
    const s = m * 0.34;
    g.fillStyle = isCabeza ? col.accentPrimary : dark ? col.accentPrimary : "#1C2127";
    g.fillRect(-s / 2, -s / 2, s, s);
    g.restore();
    g.strokeStyle = g.fillStyle; g.lineWidth = m * 0.03;
    g.beginPath(); g.moveTo(W * 0.12, H * 0.88); g.lineTo(W * 0.88, H * 0.12); g.stroke();
  } else if (kind === "code") {
    g.fillStyle = ink;
    g.font = `800 ${Math.round(m * 0.34)}px 'JetBrains Mono', 'Courier New', monospace`;
    g.fillText(`${dark ? "D" : "L"}/${label}`, W / 2, H / 2 - m * 0.12);
    g.font = `700 ${Math.round(m * 0.2)}px 'JetBrains Mono', monospace`;
    g.fillText(square, W / 2, H / 2 + m * 0.24);
  } else if (kind === "glyph") {
    g.fillStyle = isCabeza ? col.accentPrimary : ink;
    g.font = `900 ${Math.round(m * (label.length > 1 ? 0.58 : 0.8))}px 'Archivo', 'Helvetica Neue', Arial, sans-serif`;
    g.fillText(label, W / 2, H / 2 + m * 0.04);
  } else if (kind === "serial") {
    g.fillStyle = dark ? col.accentPrimary : "#0F1D33";
    g.beginPath(); g.arc(m * 0.18, m * 0.18, m * 0.06, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark ? "rgba(210,222,240,0.8)" : "rgba(15,29,51,0.8)";
    g.font = `500 ${Math.round(m * 0.17)}px 'Share Tech Mono', monospace`;
    g.fillText(`${dark ? "D" : "L"}-${type.slice(0, 3).toUpperCase()}`, W / 2, H / 2);
    g.fillText(square, W / 2, H / 2 + m * 0.2);
  } else if (kind === "sticker") {
    g.save(); g.translate(W / 2, H / 2); g.rotate(dark ? -0.12 : 0.1);
    const s = m * 0.64;
    g.fillStyle = "#000"; g.beginPath(); g.arc(m * 0.03, m * 0.03, s / 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.fill();
    g.lineWidth = m * 0.035; g.strokeStyle = "#000"; g.stroke();
    g.fillStyle = "#000";
    g.font = `400 ${Math.round(s * (label.length > 1 ? 0.42 : 0.56))}px 'Dela Gothic One', 'Arial Black', sans-serif`;
    g.fillText(label, 0, s * 0.03);
    g.restore();
  } else if (kind === "idCoord") {
    g.fillStyle = isCabeza ? col.accentPrimary : ink;
    g.font = `900 ${Math.round(m * (label.length > 1 ? 0.46 : 0.6))}px 'Helvetica Neue', Helvetica, 'Schibsted Grotesk', Arial, sans-serif`;
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(label, m * 0.1, H * 0.62);
    g.font = `600 ${Math.round(m * 0.15)}px 'Martian Mono', monospace`;
    g.fillText(square, m * 0.1, H * 0.86);
    g.fillRect(m * 0.1, H * 0.68, W - m * 0.2, m * 0.025);
  }
}
