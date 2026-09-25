/* Everything painted in Tienda's store: the vinyl floor tile, the ceiling
   tile and troffer lenses, the shelves of goods, the printed signs, the
   walls, the box art, the clock and the television picture.

   All of it is drawn on canvases at load (no image files except the
   game's own advertising), at a size scaled to the device's tier. The
   look is printed and painted, not photographic: flat colours, a limited
   palette per piece, slightly imperfect registration, faded. */

import * as THREE from "three";
import { quality } from "./tienda-quality.js";

export const SIGN_FONT = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
export const TYPE_FONT = "'Courier Prime', 'Courier New', Courier, monospace";
export const SERIF = "'Bodoni Moda', 'Didot', Georgia, serif";

/* ------------------------------------------------------------ helpers */

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
export const tone = (h, k) => rgba(hex(h).map((v) => Math.max(0, Math.min(255, v * k))));

/* A canvas of (w x h) at the tier's scale (always a power of two, so it
   can repeat and mipmap on WebGL1), painted by paint(g, W, H). */
export function canvasTexture(w, h, paint, { repeat = false, scale = true } = {}) {
  const k = scale ? quality().texScale : 1;
  const pot = (v) => Math.pow(2, Math.round(Math.log2(Math.max(16, v * k))));
  const W = pot(w), H = pot(h);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  paint(g, W, H);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  t.userData = { paint, canvas: c };
  return t;
}
// Repaints a texture made above (after the fonts arrive, say).
export function repaint(t) {
  if (!t || !t.userData || !t.userData.paint) return;
  const c = t.userData.canvas, g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  t.userData.paint(g, c.width, c.height);
  t.needsUpdate = true;
}

// Text with optional tracking (letter-spacing), fitted to maxWidth.
export function text(g, str, x, y, { font, size, weight = 700, color, align = "center", spacing = 0, maxWidth = 0, baseline = "middle", italic = false }) {
  let s = size;
  const setFont = () => { g.font = `${italic ? "italic " : ""}${weight} ${s}px ${font}`; };
  setFont();
  const measure = () => g.measureText(str).width + spacing * s * (str.length - 1);
  if (maxWidth) while (measure() > maxWidth && s > 6) { s *= 0.94; setFont(); }
  g.fillStyle = color;
  g.textBaseline = baseline;
  const total = measure();
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  if (!spacing) {
    g.textAlign = "left";
    g.fillText(str, cx, y);
    return s;
  }
  g.textAlign = "left";
  for (const ch of str) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + spacing * s;
  }
  return s;
}

// Speckle a region with fine dots (vinyl tile chips, paper, paint).
function speckle(g, x, y, w, h, n, colors, r, sizeMax = 2.2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = 0.6 + r() * sizeMax;
    g.fillRect(x + r() * w, y + r() * h, s, s * (0.6 + r() * 0.8));
  }
}

/* ------------------------------------------------------------ floor and ceiling */

/* Vinyl composition tile, 12 inches, 8 x 8 tiles per repeat: an off-white
   field with coloured chips, each tile a shade apart, fine seams, and a
   little wear. `base` sets the colour (the main aisles are tan). */
export function floorTile(base, chips, seed) {
  return canvasTexture(1024, 1024, (g, W) => {
    const r = rng(seed);
    const t = W / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const k = 0.96 + r() * 0.07;
      g.fillStyle = tone(base, k);
      g.fillRect(i * t, j * t, t, t);
      speckle(g, i * t, j * t, t, t, t * t * 0.018, chips.map((c) => c + "88"), r, 0.9 * (W / 1024));
      // Directional marbling the tile makers put in, faint.
      g.fillStyle = `rgba(90,70,50,${0.02 + r() * 0.03})`;
      for (let m = 0; m < 3; m++) g.fillRect(i * t + r() * t, j * t, t * 0.08, t);
    }
    // Seams.
    g.strokeStyle = "rgba(70,55,40,0.28)"; g.lineWidth = Math.max(1, W / 1024);
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, W); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(W, i * t); g.stroke(); }
    // Scuffs: black heel marks and a grey cart track.
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(30,24,20,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 2;
      const x = r() * W, y = r() * W, a = r() * 6.28, l = 6 + r() * 26;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { repeat: true });
}

/* 2 x 4 foot acoustic tile in its T-bar grid: fissured, pinholed, one
   repeat covers 4 x 2 tiles (8 x 8 feet). */
export function ceilingTile() {
  return canvasTexture(512, 512, (g, W) => {
    const r = rng(77);
    g.fillStyle = "#E3E0D4"; g.fillRect(0, 0, W, W);
    const tw = W / 4, th = W / 2; // a tile: 2 ft across, 4 ft along
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = tone("#E3E0D4", 0.97 + r() * 0.05); g.fillRect(i * tw, j * th, tw, th);
      // Fissures: short dark worms.
      for (let k = 0; k < 90; k++) {
        g.strokeStyle = `rgba(120,112,95,${0.18 + r() * 0.25})`; g.lineWidth = 0.8 + r();
        const x = i * tw + r() * tw, y = j * th + r() * th;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 7, y + (r() - 0.5) * 7); g.lineTo(x + (r() - 0.5) * 9, y + (r() - 0.5) * 9); g.stroke();
      }
      speckle(g, i * tw, j * th, tw, th, 260, ["rgba(110,100,85,0.35)", "rgba(150,140,120,0.3)"], r, 1.2);
    }
    // The T-bar grid, off-white enamel with a shadow line.
    g.fillStyle = "#D2CEC2";
    for (let i = 0; i <= 4; i++) g.fillRect(i * tw - 2, 0, 4, W);
    for (let j = 0; j <= 2; j++) g.fillRect(0, j * th - 2, W, 4);
    g.fillStyle = "rgba(90,85,75,0.25)";
    for (let i = 0; i <= 4; i++) g.fillRect(i * tw + 2, 0, 1.5, W);
    for (let j = 0; j <= 2; j++) g.fillRect(0, j * th + 2, W, 1.5);
  }, { repeat: true });
}

/* A 2 x 4 troffer: a white enamel frame round a prismatic acrylic lens,
   the two tubes showing through as brighter bands. */
export function troffer() {
  return canvasTexture(256, 128, (g, W, H) => {
    g.fillStyle = "#CFCDC4"; g.fillRect(0, 0, W, H);
    const m = W * 0.03;
    const lg = g.createLinearGradient(0, m, 0, H - m);
    lg.addColorStop(0, "#E9EDE2"); lg.addColorStop(0.28, "#FAFCF4"); lg.addColorStop(0.38, "#F2F5EA"); lg.addColorStop(0.62, "#F2F5EA"); lg.addColorStop(0.72, "#FAFCF4"); lg.addColorStop(1, "#E9EDE2");
    g.fillStyle = lg; g.fillRect(m, m, W - 2 * m, H - 2 * m);
    // The prism pattern: a fine grid of tiny pyramids.
    g.fillStyle = "rgba(200,205,190,0.22)";
    for (let x = m; x < W - m; x += 4) g.fillRect(x, m, 1, H - 2 * m);
    for (let y = m; y < H - m; y += 4) g.fillRect(m, y, W - 2 * m, 1);
  });
}

// A soft pool of light, for the fixtures' reflections in the waxed floor.
export function glowSpot() {
  return canvasTexture(128, 256, (g, W, H) => {
    const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    rg.addColorStop(0, "rgba(255,255,248,1)"); rg.addColorStop(0.5, "rgba(255,255,248,0.35)"); rg.addColorStop(1, "rgba(255,255,248,0)");
    g.setTransform(1, 0, 0, H / W, 0, 0);
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
  }, { scale: false });
}
// A soft dark blob, for contact shadows on the floor.
export function shadowBlob() {
  return canvasTexture(128, 128, (g, W) => {
    const rg = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    rg.addColorStop(0, "rgba(40,30,20,0.85)"); rg.addColorStop(0.55, "rgba(40,30,20,0.4)"); rg.addColorStop(1, "rgba(40,30,20,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
  }, { scale: false });
}
// A long soft shadow strip (under a shelf run), dark along its middle.
export function shadowStrip() {
  return canvasTexture(64, 64, (g, W) => {
    const lg = g.createLinearGradient(0, 0, 0, W);
    lg.addColorStop(0, "rgba(40,30,20,0)"); lg.addColorStop(0.3, "rgba(40,30,20,0.55)"); lg.addColorStop(0.7, "rgba(40,30,20,0.55)"); lg.addColorStop(1, "rgba(40,30,20,0)");
    g.fillStyle = lg; g.fillRect(0, 0, W, W);
  }, { scale: false });
}

/* ------------------------------------------------------------ goods */

/* Box fronts of the period, invented, none of them real brands: a flat
   colour field, a band, a title in a sign face or a script, a simple
   printed illustration. Drawn into a 4 x 4 atlas; the goods on the
   shelves and in the court are instances that pick a tile. */
const BOXES = [
  { title: "FAMILY BINGO", sub: "75 Cards · 2 to 12 Players", bg: "#C0632C", band: "#EFE4CB", ink: "#3B2618", art: "dots" },
  { title: "WORD HUNT", sub: "The Crossword Game", bg: "#6B7536", band: "#D3A13B", ink: "#F0EADB", art: "tiles" },
  { title: "STOCK EXCHANGE", sub: "Buy · Sell · Trade", bg: "#2F4F5E", band: "#EFE4CB", ink: "#F0EADB", art: "bars" },
  { title: "SPACE STATION", sub: "Ages 8 to Adult", bg: "#1F2A3A", band: "#C0632C", ink: "#F3E3B5", art: "rocket" },
  { title: "CROSSROADS", sub: "A Game of Travel", bg: "#D3A13B", band: "#5A3E2B", ink: "#3B2618", art: "roads" },
  { title: "DETECTIVE", sub: "Solve the Mystery", bg: "#3E3A36", band: "#A33F33", ink: "#EFE4CB", art: "glass" },
  { title: "BASEBALL", sub: "All-Star Edition", bg: "#4E7C78", band: "#EFE4CB", ink: "#F0EADB", art: "diamond" },
  { title: "AUTO RACE", sub: "Electric Track Set", bg: "#A33F33", band: "#F0EADB", ink: "#F0EADB", art: "checks" },
  { title: "CHINESE CHECKERS", sub: "Metal Board · Marbles", bg: "#7D95A6", band: "#3B2618", ink: "#F0EADB", art: "star" },
  { title: "DOMINOES", sub: "Double Six · 28 Pieces", bg: "#EFE4CB", band: "#3B2618", ink: "#3B2618", art: "domino" },
  { title: "JIGSAW PUZZLE", sub: "1000 Pieces · Mountain Lake", bg: "#5E6130", band: "#EFE4CB", ink: "#F0EADB", art: "lake" },
  { title: "MAGIC SET", sub: "50 Tricks", bg: "#5A2E4A", band: "#D3A13B", ink: "#F3E3B5", art: "wand" },
  { title: "TOASTER", sub: "2-Slice · Harvest Gold", bg: "#D3A13B", band: "#5A3E2B", ink: "#3B2618", art: "toaster" },
  { title: "HAND MIXER", sub: "5 Speeds · Avocado", bg: "#6B7536", band: "#EFE4CB", ink: "#F0EADB", art: "mixer" },
  { title: "PERCOLATOR", sub: "10 Cup · Automatic", bg: "#9C4A26", band: "#EFE4CB", ink: "#F0EADB", art: "pot" },
  { title: "EL CABEZA", sub: "A Game of Unparalleled Intention", bg: "#3B2618", band: "#D3A13B", ink: "#EFE4CB", art: "cabeza" },
];
export const BOX_TILES = BOXES.length;
export const GAME_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15];
export const HOUSEWARE_TILES = [12, 13, 14];

function boxArt(g, x, y, w, h, b, r) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = b.bg; g.fillRect(x, y, w, h);
  // The box's side colour on the left strip (the atlas's u 0..0.08 are
  // used for a box's sides, so they carry the band colour).
  g.fillStyle = b.band; g.fillRect(x, y, w * 0.08, h);
  const cx = x + w * 0.56, cy = y + h * 0.62, s = Math.min(w, h);
  g.fillStyle = b.band; g.strokeStyle = b.band; g.lineWidth = s * 0.03;
  switch (b.art) {
    case "dots": for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + w * 0.22 + i * w * 0.15, y + h * 0.5 + j * h * 0.14, s * 0.045, 0, 6.28); g.fill(); } break;
    case "tiles": for (let i = 0; i < 5; i++) { g.fillRect(x + w * 0.2 + i * w * 0.14, y + h * 0.55, w * 0.11, w * 0.11); } g.fillStyle = b.bg; text(g, "WORD", x + w * 0.55, y + h * 0.61, { font: SIGN_FONT, size: s * 0.07, color: b.bg, weight: 900, spacing: 0.9 }); break;
    case "bars": for (let i = 0; i < 6; i++) g.fillRect(x + w * 0.2 + i * w * 0.11, y + h * (0.86 - 0.05 * i - r() * 0.08), w * 0.07, h * (0.05 * i + 0.08)); break;
    case "rocket": g.beginPath(); g.moveTo(cx, y + h * 0.4); g.lineTo(cx + s * 0.07, y + h * 0.75); g.lineTo(cx - s * 0.07, y + h * 0.75); g.closePath(); g.fill(); for (let i = 0; i < 30; i++) g.fillRect(x + r() * w, y + h * 0.35 + r() * h * 0.6, 2, 2); break;
    case "roads": g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.9); g.lineTo(x + w * 0.9, y + h * 0.5); g.moveTo(x + w * 0.3, y + h * 0.45); g.lineTo(x + w * 0.7, y + h * 0.95); g.stroke(); break;
    case "glass": g.beginPath(); g.arc(cx - s * 0.05, cy - s * 0.02, s * 0.12, 0, 6.28); g.stroke(); g.beginPath(); g.moveTo(cx + s * 0.04, cy + s * 0.07); g.lineTo(cx + s * 0.16, cy + s * 0.18); g.stroke(); break;
    case "diamond": g.beginPath(); g.moveTo(cx, y + h * 0.42); g.lineTo(cx + s * 0.2, cy); g.lineTo(cx, y + h * 0.95); g.lineTo(cx - s * 0.2, cy); g.closePath(); g.stroke(); break;
    case "checks": for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(x + w * 0.1 + i * w * 0.07, y + h * 0.78 + j * h * 0.07, w * 0.07, h * 0.07); break;
    case "star": for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + k * Math.PI + (i / 3) * Math.PI * 2; const px = cx + Math.cos(a) * s * 0.2, py = cy + Math.sin(a) * s * 0.2; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); } break;
    case "domino": for (let i = 0; i < 3; i++) { g.fillRect(x + w * 0.2 + i * w * 0.22, y + h * 0.5, w * 0.12, h * 0.36); } break;
    case "lake": g.fillStyle = b.band; g.beginPath(); g.moveTo(x, y + h * 0.75); g.lineTo(x + w * 0.35, y + h * 0.42); g.lineTo(x + w * 0.6, y + h * 0.68); g.lineTo(x + w * 0.8, y + h * 0.48); g.lineTo(x + w, y + h * 0.72); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.fill(); g.fillStyle = "#7D95A6"; g.fillRect(x, y + h * 0.8, w, h * 0.2); break;
    case "wand": g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(cx - s * 0.2, cy + s * 0.2); g.lineTo(cx + s * 0.12, cy - s * 0.12); g.stroke(); for (let i = 0; i < 12; i++) g.fillRect(cx + (r() - 0.3) * s * 0.4, cy + (r() - 0.7) * s * 0.4, 3, 3); break;
    case "toaster": g.fillRect(cx - s * 0.18, cy - s * 0.1, s * 0.36, s * 0.24); g.fillStyle = b.bg; g.fillRect(cx - s * 0.12, cy - s * 0.1, s * 0.07, s * 0.04); g.fillRect(cx + s * 0.04, cy - s * 0.1, s * 0.07, s * 0.04); break;
    case "mixer": g.fillRect(cx - s * 0.16, cy - s * 0.12, s * 0.3, s * 0.12); g.fillRect(cx - s * 0.1, cy, s * 0.02, s * 0.18); g.fillRect(cx - s * 0.02, cy, s * 0.02, s * 0.18); break;
    case "pot": g.fillRect(cx - s * 0.1, cy - s * 0.18, s * 0.2, s * 0.36); g.fillRect(cx + s * 0.1, cy - s * 0.1, s * 0.07, s * 0.04); break;
    case "cabeza": g.fillStyle = "#6B4329"; g.fillRect(x + w * 0.2, y + h * 0.55, w * 0.62, h * 0.36); g.fillStyle = "#D8BC8A"; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(x + w * 0.2 + i * w * 0.0775, y + h * 0.55 + j * h * 0.09, w * 0.0775, h * 0.09); break;
    default: break;
  }
  // Title band at the top, and the title.
  g.fillStyle = b.band; g.fillRect(x + w * 0.08, y + h * 0.08, w * 0.92, h * 0.03);
  const serif = b.art === "cabeza";
  text(g, b.title, x + w * 0.54, y + h * 0.25, { font: serif ? SERIF : SIGN_FONT, size: h * 0.15, weight: serif ? 700 : 900, color: b.ink, maxWidth: w * 0.84, italic: !serif && r() < 0.3 });
  text(g, b.sub, x + w * 0.54, y + h * 0.4, { font: SIGN_FONT, size: h * 0.065, weight: 600, color: b.ink, maxWidth: w * 0.8 });
  // Fading and handling: a lighter wash at one corner.
  const fade = g.createLinearGradient(x, y, x + w, y + h);
  fade.addColorStop(0, "rgba(255,248,230,0.12)"); fade.addColorStop(1, "rgba(255,248,230,0)");
  g.fillStyle = fade; g.fillRect(x, y, w, h);
  g.restore();
}

export function boxAtlas() {
  return canvasTexture(1024, 1024, (g, W) => {
    const r = rng(31), t = W / 4;
    BOXES.forEach((b, i) => boxArt(g, (i % 4) * t, Math.floor(i / 4) * t, t, t * 0.62, b, r));
    // The lower part of each tile is the box's top and ends: plain board,
    // in its colour, with a printed stripe.
    BOXES.forEach((b, i) => {
      const x = (i % 4) * t, y = Math.floor(i / 4) * t + t * 0.62;
      g.fillStyle = b.bg; g.fillRect(x, y, t, t * 0.38);
      g.fillStyle = b.band; g.fillRect(x, y + t * 0.16, t, t * 0.05);
    });
  });
}

/* One shelving section's face, 4 feet by 5.5 feet, three variants side by
   side (the runs repeat the strip): steel uprights, a kick plate, four
   shelves with price channels and tags, and the goods, drawn as rows of
   boxes in the department's colours. */
const DEPT_GOODS = {
  games: { colors: ["#C0632C", "#6B7536", "#2F4F5E", "#D3A13B", "#A33F33", "#7D95A6", "#3B2618", "#EFE4CB", "#5A2E4A", "#4E7C78"], kind: "flat" },
  toys: { colors: ["#A33F33", "#D3A13B", "#4E7C78", "#EFE4CB", "#C0632C", "#7D95A6", "#6B7536"], kind: "upright" },
  housewares: { colors: ["#D3A13B", "#6B7536", "#9C4A26", "#EFE4CB", "#B8AE9C", "#5A3E2B"], kind: "cartons" },
  records: { colors: ["#2F4F5E", "#A33F33", "#D3A13B", "#1F2A3A", "#EFE4CB", "#5A2E4A", "#6B7536", "#C0632C"], kind: "sleeves" },
  sporting: { colors: ["#A33F33", "#2F4F5E", "#EFE4CB", "#D3A13B", "#6B7536"], kind: "upright" },
};
export function shelfFace(dept, seed) {
  const goods = DEPT_GOODS[dept] || DEPT_GOODS.games;
  return canvasTexture(1024, 512, (g, W, H) => {
    const r = rng(seed);
    const secW = W / 3;
    // Pegboard back: almond enamel with holes.
    g.fillStyle = "#CFC4AA"; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(70,60,45,0.35)";
    const hs = Math.max(2, W / 170);
    for (let x = hs * 2; x < W; x += hs * 4) for (let y = hs * 2; y < H; y += hs * 4) g.fillRect(x, y, hs * 0.6, hs * 0.6);
    const shelfY = [0.9, 0.68, 0.46, 0.24].map((v) => v * H); // shelf tops, bottom to top
    const kick = H * 0.93;
    for (let s = 0; s < 3; s++) {
      const x0 = s * secW;
      // Goods on each shelf.
      shelfY.forEach((sy, i) => {
        const room = (i === 0 ? H * 0.2 : H * 0.2);
        let x = x0 + secW * 0.02;
        const bay = goods.colors;
        const facing = Math.floor(r() * bay.length);
        while (x < x0 + secW * 0.98) {
          const col = bay[(facing + Math.floor(r() * 3)) % bay.length];
          let bw, bh;
          if (goods.kind === "flat") { bw = secW * (0.2 + r() * 0.12); bh = room * (0.15 + r() * 0.12); }
          else if (goods.kind === "sleeves") { bw = secW * 0.02; bh = room * 0.72; }
          else if (goods.kind === "cartons") { bw = secW * (0.12 + r() * 0.1); bh = room * (0.45 + r() * 0.35); }
          else { bw = secW * (0.08 + r() * 0.08); bh = room * (0.5 + r() * 0.4); }
          bw = Math.min(bw, x0 + secW * 0.98 - x);
          // Stacks of flat games, several high.
          const stack = goods.kind === "flat" ? 2 + Math.floor(r() * 4) : 1;
          for (let k = 0; k < stack; k++) {
            const yy = sy - bh * (k + 1);
            if (yy < sy - room * 0.95) break;
            g.fillStyle = col; g.fillRect(x, yy, bw - 1, bh - 1);
            g.fillStyle = "rgba(255,248,230,0.35)"; g.fillRect(x + bw * 0.1, yy + bh * 0.25, bw * 0.6, Math.max(1, bh * 0.14));
            g.fillStyle = "rgba(20,12,6,0.25)"; g.fillRect(x, yy + bh - 2, bw - 1, 2);
          }
          x += bw + (goods.kind === "sleeves" ? 0.5 : 1 + r() * 3);
          // Now and then a gap where something sold out.
          if (r() < 0.06) x += secW * 0.08;
        }
        // The shelf: a lip with a price channel and paper tags.
        g.fillStyle = "#B8AE9C"; g.fillRect(x0, sy, secW, H * 0.022);
        g.fillStyle = "#8E8472"; g.fillRect(x0, sy + H * 0.022, secW, H * 0.006);
        for (let k = 0; k < 4; k++) {
          g.fillStyle = r() < 0.2 ? "#F2D26B" : "#F4EFE2";
          g.fillRect(x0 + secW * (0.08 + k * 0.24 + r() * 0.05), sy + H * 0.003, secW * 0.07, H * 0.016);
        }
      });
      // Uprights between sections.
      g.fillStyle = "#A9A08E"; g.fillRect(x0, 0, secW * 0.018, H);
      g.fillStyle = "rgba(40,30,20,0.25)"; g.fillRect(x0 + secW * 0.018, 0, 2, H);
    }
    // Kick plate.
    g.fillStyle = "#4A3A2C"; g.fillRect(0, kick, W, H - kick);
    g.fillStyle = "rgba(255,245,225,0.08)"; g.fillRect(0, kick, W, 2);
  }, { repeat: true });
}

// The top of a run: overstock cartons, brown and dusty.
export function shelfTop() {
  return canvasTexture(256, 256, (g, W) => {
    const r = rng(9);
    g.fillStyle = "#8E7E64"; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = tone("#B39A72", 0.85 + r() * 0.25);
      const w = 30 + r() * 60, h = 30 + r() * 60;
      g.fillRect(r() * W, r() * W, w, h);
      g.fillStyle = "rgba(60,45,30,0.3)"; g.fillRect(r() * W, r() * W, w * 0.9, 3);
    }
  }, { repeat: true });
}

/* ------------------------------------------------------------ signs */

/* A small atlas packer: signs are drawn once into one big canvas and the
   sign meshes use their own rectangle of it (one draw call for all). */
export function signAtlas(signs, size = 2048) {
  const k = quality().texScale;
  const S = Math.pow(2, Math.round(Math.log2(size * Math.max(0.5, k))));
  const scale = S / size;
  // Shelf packing, tallest first.
  const order = signs.map((s, i) => i).sort((a, b) => signs[b].h - signs[a].h);
  let x = 0, y = 0, rowH = 0;
  const rects = new Array(signs.length);
  order.forEach((i) => {
    const w = Math.ceil(signs[i].w * scale), h = Math.ceil(signs[i].h * scale);
    if (x + w > S) { x = 0; y += rowH + 2; rowH = 0; }
    rects[i] = { x, y, w, h };
    x += w + 2; rowH = Math.max(rowH, h);
  });
  const tex = canvasTexture(S, S, (g) => {
    signs.forEach((s, i) => {
      const rc = rects[i];
      g.save();
      g.translate(rc.x, rc.y);
      g.scale(rc.w / s.w, rc.h / s.h);
      s.paint(g, s.w, s.h);
      g.restore();
    });
  }, { scale: false });
  const uv = rects.map((rc) => ({ u0: rc.x / S, v0: 1 - (rc.y + rc.h) / S, u1: (rc.x + rc.w) / S, v1: 1 - rc.y / S }));
  return { tex, uv };
}

// A department sign: screen-printed letters on a painted panel with a
// border line, the colours faded a little unevenly.
export function deptSign(title, sub, bg, ink) {
  return (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const fade = g.createLinearGradient(0, 0, w, h);
    fade.addColorStop(0, "rgba(255,250,235,0.1)"); fade.addColorStop(1, "rgba(0,0,0,0.06)");
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
    g.strokeStyle = ink; g.lineWidth = h * 0.035; g.strokeRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14);
    text(g, title, w / 2, sub ? h * 0.43 : h * 0.53, { font: SIGN_FONT, size: h * (sub ? 0.4 : 0.5), weight: 800, color: ink, spacing: 0.06, maxWidth: w * 0.86 });
    if (sub) text(g, sub, w / 2, h * 0.76, { font: SIGN_FONT, size: h * 0.16, weight: 600, color: ink, spacing: 0.12, maxWidth: w * 0.8 });
  };
}
// An aisle marker: a number in a circle and what's down the aisle.
export function aisleSign(num, lines) {
  return (g, w, h) => {
    g.fillStyle = "#EFE8D6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#4F6B78"; g.fillRect(0, 0, w, h * 0.34);
    text(g, `AISLE ${num}`, w / 2, h * 0.18, { font: SIGN_FONT, size: h * 0.2, weight: 800, color: "#F2ECDD", spacing: 0.1 });
    lines.forEach((l, i) => text(g, l, w / 2, h * (0.49 + i * 0.15), { font: SIGN_FONT, size: h * 0.105, weight: 700, color: "#3B2618", spacing: 0.08, maxWidth: w * 0.88 }));
    g.strokeStyle = "#4F6B78"; g.lineWidth = h * 0.02; g.strokeRect(0, 0, w, h);
  };
}
// A hand-lettered sale card: marker on card stock.
export function saleCard(top, price, note, color = "#A33F33") {
  return (g, w, h) => {
    g.fillStyle = "#F4EEDC"; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.fillRect(0, 0, w, h * 0.26);
    text(g, top, w / 2, h * 0.14, { font: SIGN_FONT, size: h * 0.17, weight: 900, color: "#F4EEDC", spacing: 0.08, maxWidth: w * 0.9, italic: true });
    text(g, price, w / 2, h * 0.56, { font: SIGN_FONT, size: h * 0.34, weight: 900, color, maxWidth: w * 0.9 });
    if (note) text(g, note, w / 2, h * 0.86, { font: TYPE_FONT, size: h * 0.09, weight: 700, color: "#3B2618", maxWidth: w * 0.9 });
  };
}

/* ------------------------------------------------------------ walls */

/* A wall, painted once as a long strip: drywall paint above a wainscot
   band and a vinyl cove base, with what hangs on it (letters, doors,
   signs) drawn in by `extras(g, W, H, u)`, where u is pixels per world
   unit on both axes (so lettering keeps its shape). The canvas is a
   power of two tall; only the top `vSpan` of it is painted, and the
   wall's plane maps just that part (see tienda-store.js). */
export function wallTexture(lengthUnits, heightUnits, { paint = "#D9CDB2", band = "#A9B79D", extras } = {}) {
  const k = quality().texScale;
  const W = Math.pow(2, Math.round(Math.log2(4096 * Math.max(0.5, k))));
  const u = W / lengthUnits;
  const Ht = Math.round(heightUnits * u);
  const H = Math.pow(2, Math.ceil(Math.log2(Ht)));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const painter = (g) => {
    const r = rng(Math.round(lengthUnits));
    g.fillStyle = paint; g.fillRect(0, 0, W, Ht);
    // Roller texture and the odd touch-up patch.
    for (let i = 0; i < 180; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,250,235" : "90,75,55"},0.035)`; g.fillRect(r() * W, r() * Ht, 20 + r() * 120, 6 + r() * 40); }
    // Wainscot band and cove base.
    const base = Ht - u * 1.2;
    g.fillStyle = band; g.fillRect(0, Ht - u * 22, W, u * 20.8);
    g.fillStyle = "rgba(60,50,35,0.25)"; g.fillRect(0, Ht - u * 22, W, 2);
    g.fillStyle = "#4A3A2C"; g.fillRect(0, base, W, Ht - base);
    if (extras) extras(g, W, Ht, u);
  };
  painter(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.userData = { paint: (g) => painter(g), canvas: c, vSpan: Ht / H };
  return t;
}

/* ------------------------------------------------------------ small objects */

/* The El Cabeza box lid, as stocked: dark brown board, the lounge
   photograph, the title in Bodoni, a gold band, a price sticker. `img`
   is the box art (an HTMLImageElement, may still be loading). */
export function lidPainter(img) {
  return (g, w, h) => {
    g.fillStyle = "#3B2618"; g.fillRect(0, 0, w, h);
    // Photo panel.
    const px = w * 0.06, py = h * 0.1, pw = w * 0.52, ph = h * 0.8;
    if (img && img.complete && img.naturalWidth) {
      const ir = img.naturalWidth / img.naturalHeight, pr = pw / ph;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (ir > pr) { sw = sh * pr; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / pr; sy = (img.naturalHeight - sh) * 0.55; }
      g.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);
    } else {
      g.fillStyle = "#5C3A21"; g.fillRect(px, py, pw, ph);
    }
    g.strokeStyle = "#D3A13B"; g.lineWidth = h * 0.012; g.strokeRect(px, py, pw, ph);
    const tx = w * 0.79;
    text(g, "EL", tx, h * 0.3, { font: SERIF, size: h * 0.16, weight: 700, color: "#EFE4CB" });
    text(g, "CABEZA", tx, h * 0.47, { font: SERIF, size: h * 0.16, weight: 700, color: "#EFE4CB", maxWidth: w * 0.36 });
    g.fillStyle = "#D3A13B"; g.fillRect(w * 0.64, h * 0.57, w * 0.3, h * 0.012);
    text(g, "A Game of Unparalleled Intention", tx, h * 0.66, { font: SERIF, size: h * 0.05, weight: 500, color: "#E9DCC0", maxWidth: w * 0.34, italic: true });
    text(g, "2 PLAYERS · AGES 10 TO ADULT", tx, h * 0.8, { font: SIGN_FONT, size: h * 0.035, weight: 700, color: "#D3A13B", maxWidth: w * 0.34, spacing: 0.1 });
    // Price-gun sticker.
    g.fillStyle = "#F4EFE2"; g.fillRect(w * 0.84, h * 0.06, w * 0.13, h * 0.1);
    text(g, "7.97", w * 0.905, h * 0.112, { font: TYPE_FONT, size: h * 0.055, weight: 700, color: "#6B2A22" });
  };
}

// The demonstration table's tent card.
export function tentCard(g, w, h) {
  g.fillStyle = "#F2EBD7"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#A33F33"; g.fillRect(0, 0, w, h * 0.3);
  text(g, "TRY IT!", w / 2, h * 0.16, { font: SIGN_FONT, size: h * 0.2, weight: 900, color: "#F2EBD7", spacing: 0.12, italic: true });
  text(g, "El Cabeza", w / 2, h * 0.43, { font: SERIF, size: h * 0.14, weight: 700, color: "#3B2618" });
  text(g, "Demonstration Game", w / 2, h * 0.58, { font: SIGN_FONT, size: h * 0.075, weight: 700, color: "#3B2618", spacing: 0.06 });
  text(g, "Please leave pieces on the board.", w / 2, h * 0.72, { font: TYPE_FONT, size: h * 0.06, weight: 400, color: "#3B2618", maxWidth: w * 0.9 });
  text(g, "Complete set $7.97 · Aisle 9", w / 2, h * 0.86, { font: TYPE_FONT, size: h * 0.06, weight: 700, color: "#6B2A22", maxWidth: w * 0.9 });
}

/* Formica: a printed walnut woodgrain, flatter and more regular than
   the real thing, repeating. */
export function formicaWalnut() {
  return canvasTexture(512, 512, (g, W) => {
    const r = rng(12);
    g.fillStyle = "#6E4A30"; g.fillRect(0, 0, W, W);
    // The printed grain: fine, even, repeating lines, a slightly flat look.
    for (let i = 0; i < 160; i++) {
      const y = r() * W, amp = 1.5 + r() * 4, f = 1 + Math.floor(r() * 2);
      g.strokeStyle = `rgba(${r() < 0.65 ? "52,31,17" : "132,94,62"},${0.12 + r() * 0.2})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) { const yy = y + Math.sin((x / W) * Math.PI * 2 * f + i) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
  }, { repeat: true });
}

/* The wall clock above the service desk: white face, black numerals and
   hands, red sweep second hand, drawn fresh each second. */
export function paintClock(g, S, date) {
  g.clearRect(0, 0, S, S);
  const c = S / 2, R = S * 0.47;
  g.fillStyle = "#3A3632"; g.beginPath(); g.arc(c, c, R, 0, 6.28); g.fill();
  g.fillStyle = "#F4F1E6"; g.beginPath(); g.arc(c, c, R * 0.9, 0, 6.28); g.fill();
  g.fillStyle = "#1E1B18";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    g.save(); g.translate(c, c); g.rotate(a);
    g.fillRect(-S * (big ? 0.012 : 0.004), -R * 0.86, S * (big ? 0.024 : 0.008), R * (big ? 0.12 : 0.05));
    g.restore();
  }
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    text(g, String(i), c + Math.sin(a) * R * 0.62, c - Math.cos(a) * R * 0.62, { font: SIGN_FONT, size: S * 0.085, weight: 700, color: "#1E1B18" });
  }
  const h = date.h % 12, m = date.m, s = date.s;
  const hand = (a, len, w, col) => { g.save(); g.translate(c, c); g.rotate(a); g.fillStyle = col; g.fillRect(-w / 2, -len, w, len + R * 0.1); g.restore(); };
  hand(((h + m / 60) / 12) * Math.PI * 2, R * 0.5, S * 0.03, "#1E1B18");
  hand(((m + s / 60) / 60) * Math.PI * 2, R * 0.74, S * 0.02, "#1E1B18");
  hand((s / 60) * Math.PI * 2, R * 0.8, S * 0.008, "#A8322A");
  g.fillStyle = "#1E1B18"; g.beginPath(); g.arc(c, c, S * 0.025, 0, 6.28); g.fill();
}

/* What's on the sets in the electronics department at half past seven: a
   local newscast, a man at a desk against a blue backdrop, a caption
   bar. Drawn small and soft, then given the tube's scan lines and a
   glow, so the CRT look stays on the screens and nowhere else. */
export function paintTv(g, W, H, t) {
  const roll = (t * 0.00004) % 1;
  g.fillStyle = "#2E4E7A"; g.fillRect(0, 0, W, H);
  const bg = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.7);
  bg.addColorStop(0, "#5D86B5"); bg.addColorStop(1, "#1D3558");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // The station's map graphic behind him.
  g.fillStyle = "rgba(210,225,240,0.25)"; g.fillRect(W * 0.62, H * 0.16, W * 0.28, H * 0.34);
  // The anchor: head, shoulders, a desk.
  const bob = Math.sin(t / 900) * H * 0.006;
  g.fillStyle = "#3A2E2A"; g.beginPath(); g.ellipse(W * 0.4, H * 0.64 + bob, W * 0.2, H * 0.22, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#C9A083"; g.beginPath(); g.ellipse(W * 0.4, H * 0.36 + bob, W * 0.07, H * 0.11, 0, 0, 6.28); g.fill();
  g.fillStyle = "#3B2A20"; g.beginPath(); g.ellipse(W * 0.4, H * 0.29 + bob, W * 0.075, H * 0.06, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#E9E1D1"; g.fillRect(W * 0.37, H * 0.47 + bob, W * 0.06, H * 0.12);
  g.fillStyle = "#6B4329"; g.fillRect(0, H * 0.74, W, H * 0.26);
  // Caption bar.
  g.fillStyle = "rgba(20,30,50,0.85)"; g.fillRect(0, H * 0.8, W, H * 0.12);
  text(g, "NEWS AT 7:30", W * 0.3, H * 0.86, { font: SIGN_FONT, size: H * 0.07, weight: 800, color: "#F0E8D0" });
  // The tube: scan lines, a rolling brighter band, glow at the centre,
  // darker corners.
  g.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  const band = ((roll * 1.4) % 1.4 - 0.2) * H;
  const lg = g.createLinearGradient(0, band - H * 0.1, 0, band + H * 0.1);
  lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.06)"); lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// The front windows at night: the dark lot, a few sodium lamps, the
// painted sale letters on the glass seen backwards from inside.
export function paintNight(g, W, H) {
  {
    const r = rng(4);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1B2230"); sky.addColorStop(0.55, "#232833"); sky.addColorStop(1, "#141414");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Sodium lamps across the lot, and their pools.
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.3 + r() * 0.4) * (W / 9), y = H * (0.42 + r() * 0.1);
      const rg = g.createRadialGradient(x, y, 0, x, y, H * 0.35);
      rg.addColorStop(0, "rgba(255,190,110,0.55)"); rg.addColorStop(1, "rgba(255,190,110,0)");
      g.fillStyle = rg; g.fillRect(x - H * 0.35, y - H * 0.35, H * 0.7, H * 0.7);
      g.fillStyle = "#FFD9A0"; g.fillRect(x - 2, y - 2, 4, 3);
    }
    // A couple of parked cars, just shapes.
    for (let i = 0; i < 5; i++) {
      const x = r() * W, w = W * 0.05;
      g.fillStyle = "#0E0F12"; g.fillRect(x, H * 0.66, w, H * 0.06); g.fillRect(x + w * 0.2, H * 0.62, w * 0.55, H * 0.05);
    }
    // Reflections of the store's own lights in the glass.
    g.fillStyle = "rgba(230,235,220,0.07)";
    for (let i = 0; i < 20; i++) g.fillRect(r() * W, H * (0.05 + r() * 0.2), W * 0.02, H * 0.012);
    // Backwards window lettering.
    g.save(); g.translate(W * 0.3, H * 0.3); g.scale(-1, 1);
    text(g, "SALE", 0, 0, { font: SIGN_FONT, size: H * 0.18, weight: 900, color: "rgba(230,200,120,0.45)", spacing: 0.1 });
    g.restore();
  }
}

/* Card stock for the menus: faint fibres and flecks on transparent, set
   as a CSS variable (--tienda-paper) the theme's stylesheet layers over
   the paper colour. Made once per page. */
export function ensurePaper() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.style.getPropertyValue("--tienda-paper")) return;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const r = rng(8);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "90,70,45" : "255,250,238"},${0.03 + r() * 0.05})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5); }
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(110,88,60,${0.04 + r() * 0.05})`; g.lineWidth = 0.6;
      const x = r() * 256, y = r() * 256, a = r() * 6.28, l = 4 + r() * 12;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    root.style.setProperty("--tienda-paper", `url(${c.toDataURL("image/png")})`);
  } catch (e) { /* plain paper colour, then */ }
}
