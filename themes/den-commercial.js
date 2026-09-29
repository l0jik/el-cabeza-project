/* The late-night commercial on the den's television (den-tv.js plays it,
   den-fx.js calls it up): back out of Singularity for the first time in
   Nova, the set is on and this is what's showing. A community-access
   infomercial, 1975, made for about eleven dollars by people who believe
   in it completely: hand-cut letters, a star wipe, a drop shadow that
   missed, a pawn run off the screen, a crown drawn in marker, a thumb in
   the shot, and Dale, standing by.

   It says what just happened (the Singularity opened the special
   orders) and where to go for them (the store). The sound for it is
   den-audio.js's tvCommercial, cued to CUES below.

   Drawn in a 512 x 384 frame (the screen's 4:3) on a power-of-two canvas,
   at 12 frames a second (it's videotape, and not good videotape), with
   the tape's faults over the top: the picture rolling at the cuts, a
   tracking band, a line of dropout now and then, the colours a little
   apart. */

import * as THREE from "three";

export const COMMERCIAL_MS = 33900;

// The scenes, in seconds from the top (the sound follows these).
export const CUES = {
  slate: 0, title: 2.2, chess: 5.6, stamp: 7.0, flee: 7.6, king: 9.2, orders: 12.4,
  items: [13.2, 14.0, 14.8], assembly: 15.8, best: 17.0, sortOf: 19.5, dealer: 20.6, standing: 22.0,
  price: 24.8, only: 25.9, brandNew: 26.9, close: 28.3, never: 29.9, credit: 32.0, snow: 33.3,
};

const W = 512, H = 384, FPS = 12;

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);
const easeBack = (u) => { u = clamp01(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

const MONO = "'Courier Prime', 'Courier New', monospace";
const SANS = "'Libre Franklin', 'Arial Black', Arial, sans-serif";
const SERIF = "'Bodoni Moda', Georgia, serif";

// Text with the colours a little apart (the tape's chroma) and, if asked,
// the drop shadow somebody set by eye.
function say(g, str, x, y, { font, color = "#fff", shadow = null, shadowAt = [5, 5], align = "center", smear = 1.6 }) {
  g.font = font; g.textAlign = align; g.textBaseline = "middle";
  if (shadow) { g.fillStyle = shadow; g.fillText(str, x + shadowAt[0], y + shadowAt[1]); }
  g.globalAlpha = 0.35;
  g.fillStyle = "#ff2a2a"; g.fillText(str, x - smear, y);
  g.fillStyle = "#2ad4ff"; g.fillText(str, x + smear, y);
  g.globalAlpha = 1;
  g.fillStyle = color; g.fillText(str, x, y);
}

function star(g, x, y, r, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points, rr = i % 2 ? r * inner : r;
    g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

/* ------------------------------------------------------------ the scenes */

function slate(g, t) {
  g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
  say(g, "PAID PROGRAMMING", W / 2, H * 0.42, { font: `700 30px ${MONO}`, color: "#e8e6dc" });
  say(g, "CANAL 99  ·  COMMUNITY ACCESS", W / 2, H * 0.53, { font: `700 15px ${MONO}`, color: "#b9b6aa" });
  if (t > 0.5) say(g, "The views expressed are, frankly, correct.", W / 2, H * 0.64, { font: `italic 400 12px ${MONO}`, color: "#8d8a80" });
}

function title(g, t, f) {
  // A sunset nobody asked for.
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#e0287a"); bg.addColorStop(0.55, "#ff8a1e"); bg.addColorStop(1, "#ffd23a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // The starburst, turning a little.
  g.save(); g.translate(W / 2, H * 0.47); g.rotate(t * 0.35);
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(255,240,120,0.22)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 420, (i * Math.PI) / 8, ((i + 1) * Math.PI) / 8); g.closePath(); g.fill(); }
  g.restore();
  // The letters, cut out of construction paper, one after another.
  const word = "EL CABEZA!";
  const paper = ["#1b6fd1", "#1f9e45", "#d62a2a", "#7c3cc7", "#f2c200", "#e05a12", "#138a8a", "#c21f6b", "#2e7d32", "#d62a2a"];
  const cw = 44, x0 = W / 2 - (word.length * cw) / 2 + cw / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch === " ") continue;
    const u = (t - 0.35 - i * 0.12) / 0.4;
    if (u <= 0) continue;
    const s = easeBack(u);
    const wob = Math.sin(t * 3 + i * 1.7) * 0.06 + (hash(i + 3) - 0.5) * 0.18;
    g.save();
    g.translate(x0 + i * cw, H * 0.43 + Math.sin(t * 4 + i) * 2);
    g.rotate(wob); g.scale(s, s);
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(-19 + 4, -27 + 5, 38, 54);
    g.fillStyle = paper[i]; g.fillRect(-19, -27, 38, 54);
    g.fillStyle = "#fffdf2"; g.font = `900 40px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, 0, 2);
    g.restore();
  }
  if (t > 1.9) {
    const k = easeOut((t - 1.9) / 0.3);
    g.globalAlpha = k;
    say(g, "★ THE GAME ★", W / 2, H * 0.68, { font: `900 26px ${SANS}`, color: "#fff45a", shadow: "#1a0c24", shadowAt: [7, 6] });
    g.globalAlpha = 1;
  }
  // Glitter, where the glitter landed.
  for (let i = 0; i < 9; i++) {
    if (hash(i * 7 + f) < 0.55) continue;
    g.fillStyle = "#fff"; star(g, 40 + hash(i) * (W - 80), 30 + hash(i + 50) * (H - 60), 4 + hash(i + 9) * 5, 4, 0.3); g.fill();
  }
}

function pawn(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#1c1c1c";
  g.beginPath(); g.arc(0, -58, 20, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-14, -40); g.lineTo(14, -40); g.lineTo(24, 30); g.lineTo(-24, 30); g.closePath(); g.fill();
  g.fillRect(-26, -44, 52, 8);
  g.fillRect(-36, 30, 72, 14); g.fillRect(-42, 44, 84, 10);
  g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(-9, -70, 5, 14);
  g.restore();
}

function chess(g, t) {
  g.fillStyle = "#cfc9b8"; g.fillRect(0, 0, W, H);
  // The checkerboard backdrop, a bedsheet with squares painted on.
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { if ((r + c) % 2) { g.fillStyle = "#8f8876"; g.fillRect(c * 64, r * 64, 64, 64); } }
  g.fillStyle = "rgba(20,16,10,0.25)"; g.fillRect(0, 0, W, H);
  const T = CUES.chess;
  say(g, "TIRED OF...", W / 2, H * 0.14, { font: `900 30px ${SANS}`, color: "#fff", shadow: "#000", shadowAt: [3, 4] });
  // The pawn: sits there, smug; then it's run off the screen.
  const flee = t - (CUES.flee - T);
  const px = flee > 0 ? W * 0.5 - Math.pow(flee, 2) * 900 : W * 0.5;
  if (px > -80) {
    pawn(g, px, H * 0.58, 1.25);
    if (flee > 0) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const yy = H * 0.42 + i * 22; g.beginPath(); g.moveTo(px + 50, yy); g.lineTo(px + 50 + 60 + i * 12, yy); g.stroke(); } }
  }
  if (t < CUES.stamp - T) say(g, "CHESS?", W / 2, H * 0.3, { font: `900 34px ${SERIF}`, color: "#fff", shadow: "#000", shadowAt: [3, 3] });
  // The stamp.
  const st = t - (CUES.stamp - T);
  if (st > 0) {
    const s = st < 0.15 ? 1.8 - st * 5.3 : 1;
    g.save(); g.translate(W / 2, H * 0.52); g.rotate(-0.18); g.scale(s, s);
    g.strokeStyle = "rgba(214,30,30,0.9)"; g.lineWidth = 14;
    g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(-64, -64); g.lineTo(64, 64); g.stroke();
    g.restore();
    const shake = st < 0.5 ? (hash(Math.floor(st * 30)) - 0.5) * 8 : 0;
    say(g, "GET OUTTA HERE,", W / 2 + shake, H * 0.83, { font: `900 32px ${SANS}`, color: "#ffe23a", shadow: "#000", shadowAt: [4, 4] });
    say(g, "CHESS!", W / 2 - shake, H * 0.93, { font: `900 34px ${SANS}`, color: "#ffe23a", shadow: "#000", shadowAt: [4, 4] });
  }
}

function king(g, t, f) {
  const bg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 340);
  bg.addColorStop(0, "#5b2ca8"); bg.addColorStop(1, "#140828");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // The Cabeza, a wooden disc, turning (a cardboard cut-out on a lazy Susan).
  const sx = Math.cos(t * 2.4);
  g.save(); g.translate(W / 2, H * 0.55 + Math.sin(t * 3) * 4);
  g.scale(Math.max(0.08, Math.abs(sx)), 1);
  g.fillStyle = "#5a3418"; g.beginPath(); g.ellipse(0, 12, 70, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#a8743e"; g.beginPath(); g.ellipse(0, 0, 70, 26, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(70,40,15,0.6)"; g.lineWidth = 2;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(0, 0, 70 - i * 16, 26 - i * 6, 0, 0, Math.PI * 2); g.stroke(); }
  // The crown, drawn in marker on shirt cardboard, taped on.
  g.translate(0, -30 + Math.sin(t * 6) * 3);
  g.fillStyle = "#f5c518"; g.strokeStyle = "#8a5a00"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-40, 0); g.lineTo(-44, -44); g.lineTo(-22, -20); g.lineTo(0, -52); g.lineTo(22, -20); g.lineTo(44, -44); g.lineTo(40, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#e0203a"; [-26, 0, 26].forEach((x) => { g.beginPath(); g.arc(x, -9, 5, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = "#c9c9c9"; g.fillRect(-8, 2, 16, 8); // the tape
  g.restore();
  const flick = Math.floor(t * 6) % 2;
  say(g, "CABEZA", W / 2, H * 0.14, { font: `900 44px ${SERIF}`, color: flick ? "#ffe23a" : "#ffffff", shadow: "#000", shadowAt: [4, 5] });
  say(g, "IS KING!", W / 2, H * 0.9, { font: `900 38px ${SERIF}`, color: flick ? "#ffffff" : "#ffe23a", shadow: "#000", shadowAt: [4, 5] });
  for (let i = 0; i < 6; i++) {
    if (hash(i * 13 + f) < 0.5) continue;
    g.fillStyle = "#fff9c0"; star(g, W * (0.12 + 0.76 * hash(i + 21)), H * (0.25 + 0.5 * hash(i + 44)), 7, 4, 0.28); g.fill();
  }
}

function orders(g, t) {
  // A blue backdrop (the chroma key they didn't know how to key).
  g.fillStyle = "#1438c8"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(40,90,255,0.35)"; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  say(g, "NOW TAKING", W / 2, H * 0.14, { font: `900 26px ${SANS}`, color: "#ffffff", shadow: "#000a40", shadowAt: [4, 4] });
  say(g, "SPECIAL ORDERS!", W / 2, H * 0.27, { font: `900 38px ${SANS}`, color: "#ffe23a", shadow: "#000a40", shadowAt: [5, 5] });
  const T = CUES.orders;
  ["NEW PIECES", "NEW LAWS", "NEW BOARDS"].forEach((s, i) => {
    const u = (t - (CUES.items[i] - T)) / 0.25;
    if (u <= 0) return;
    const x = W * 0.22 + (1 - easeOut(u)) * W;
    g.fillStyle = "#ffe23a"; star(g, x - 28, H * (0.45 + i * 0.13), 13); g.fill();
    say(g, s, x, H * (0.45 + i * 0.13), { font: `900 28px ${SANS}`, color: "#ffffff", align: "left", shadow: "#000a40", shadowAt: [3, 3] });
  });
  if (t > CUES.assembly - T) say(g, "(some assembly required)", W * 0.62, H * 0.9, { font: `italic 400 14px ${MONO}`, color: "#c8d4ff" });
}

function best(g, t) {
  g.fillStyle = "#050505"; g.fillRect(0, 0, W, H);
  const line1 = "The best thing", line2 = "you didn't know existed";
  const n = Math.floor(t * 18);
  const a = line1.slice(0, n), b = line2.slice(0, Math.max(0, n - line1.length));
  say(g, a, W / 2, H * 0.36, { font: `700 30px ${SERIF}`, color: "#f3eee0" });
  say(g, b, W / 2, H * 0.49, { font: `700 30px ${SERIF}`, color: "#f3eee0" });
  if (n < line1.length + line2.length && Math.floor(t * 4) % 2) { g.fillStyle = "#f3eee0"; g.fillRect(W / 2 + g.measureText(b || a).width / 2 + 4, H * (b ? 0.49 : 0.36) - 13, 12, 26); }
  // The afterthought, added in the edit bay with a different machine.
  const s = t - (CUES.sortOf - CUES.best);
  if (s > 0) {
    g.save(); g.translate(W * 0.64, H * 0.66); g.rotate(-0.12 + Math.sin(s * 9) * 0.02);
    say(g, "...sort of!!", 0, 0, { font: `italic 700 28px ${SANS}`, color: "#ff3b3b" });
    g.strokeStyle = "#ff3b3b"; g.lineWidth = 3; g.beginPath(); g.moveTo(-80, 20); g.quadraticCurveTo(0, 30, 82, 16); g.stroke();
    g.restore();
  }
}

function dealer(g, t, f) {
  g.fillStyle = "#1a1612"; g.fillRect(0, 0, W, H);
  // A card, held up to the camera by someone just out of shot.
  const bob = Math.sin(t * 1.3) * 3 + Math.sin(t * 5.1) * 1;
  g.save(); g.translate(W / 2, H / 2 + bob); g.rotate(-0.035 + Math.sin(t * 0.9) * 0.01); g.scale(0.9, 0.9);
  g.fillStyle = "#f1e7c8"; g.fillRect(-222, -168, 444, 336);
  g.strokeStyle = "#b23a1f"; g.lineWidth = 5; g.strokeRect(-210, -156, 420, 312);
  g.fillStyle = "#2a1a10"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 16px ${MONO}`; g.fillText("ASK FOR IT BY NAME", 0, -126);
  g.font = `900 34px ${SERIF}`; g.fillStyle = "#b23a1f"; g.fillText("EL CABEZA", 0, -86);
  g.font = `900 22px ${SANS}`; g.fillStyle = "#2a1a10"; g.fillText("SPECIAL ORDERS", 0, -52);
  g.font = `400 15px ${MONO}`; g.fillText("at the Games & Hobby Dept.", 0, -20);
  g.fillText("of your participating dealer", 0, 0);
  g.font = `700 20px ${MONO}`; g.fillText("or call KLondike 5-0199", 0, 38);
  const st = t - (CUES.standing - CUES.dealer);
  if (st > 0 && Math.floor(st * 2.5) % 2 === 0) { g.font = `900 17px ${SANS}`; g.fillStyle = "#b23a1f"; g.fillText("OPERATORS ARE STANDING BY*", 0, 84); }
  if (st > 0.8) { g.font = `italic 400 11px ${MONO}`; g.fillStyle = "#6b5a48"; g.fillText("*Operator is Dale. Dale is standing by.", 0, 130); }
  g.restore();
  // The thumb.
  g.fillStyle = "#d59a78"; g.beginPath(); g.ellipse(58, H - 42 + bob, 34, 52, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e9b89a"; g.beginPath(); g.ellipse(70, H - 78 + bob, 16, 12, 0.5, 0, Math.PI * 2); g.fill();
  if (hash(f) < 0.08) { g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(0, 0, W, H); }
}

// "El Cabeza... only $7.97... brand new for 1975!"
function price(g, t, f) {
  g.fillStyle = "#ffd400"; g.fillRect(0, 0, W, H);
  // Sunburst stripes from behind the tag, the cheapest way to say "value".
  g.save(); g.translate(W * 0.5, H * 0.58); g.rotate(-t * 0.25);
  for (let i = 0; i < 20; i++) if (i % 2) { g.fillStyle = "rgba(255,120,0,0.35)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 460, (i * Math.PI) / 10, ((i + 1) * Math.PI) / 10); g.closePath(); g.fill(); }
  g.restore();
  const dots = Math.min(3, Math.floor(t * 3));
  say(g, "EL CABEZA" + ".".repeat(dots), W / 2, H * 0.15, { font: `900 38px ${SERIF}`, color: "#b8141c", shadow: "#5a2a00", shadowAt: [3, 4] });
  const o = t - (CUES.only - CUES.price);
  if (o > 0) {
    // The price tag, slammed down.
    const k = o < 0.18 ? 2.2 - (o / 0.18) * 1.2 : 1 + Math.sin(o * 7) * 0.02;
    g.save(); g.translate(W * 0.5, H * 0.58); g.rotate(-0.08); g.scale(k, k);
    g.fillStyle = "#d0101a"; star(g, 0, 0, 118, 16, 0.84, 0); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 4; star(g, 0, 0, 104, 16, 0.84, 0); g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 20px ${SANS}`; g.fillText("ONLY", 0, -44);
    g.font = `900 64px ${SANS}`; g.fillText("$7", -18, 10);
    g.font = `900 32px ${SANS}`; g.fillText("97", 44, -4);
    g.fillRect(28, 12, 34, 4);
    g.restore();
  }
  const b = t - (CUES.brandNew - CUES.price);
  if (b > 0) {
    g.save(); g.translate(W * 0.83, H * 0.83); g.rotate(-0.3 + Math.sin(b * 5) * 0.04);
    const pop = b < 0.15 ? b / 0.15 : 1;
    g.scale(pop, pop);
    g.fillStyle = "#1438c8"; star(g, 0, 0, 62, 12, 0.78); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 14px ${SANS}`; g.fillText("BRAND NEW", 0, -14);
    g.font = `900 13px ${SANS}`; g.fillText("FOR", 0, 2);
    g.font = `900 22px ${SANS}`; g.fillText("1975!", 0, 20);
    g.restore();
  }
  if (hash(f * 0.3) < 0.1) { g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, 0, W, H); }
}

// "Get yours now... if not, you never will!" (it goes a bit dark there).
function close(g, t, f) {
  const n = t - (CUES.never - CUES.close);
  if (n < 0) {
    g.fillStyle = Math.floor(t * 4) % 2 ? "#c8101a" : "#e8141f"; g.fillRect(0, 0, W, H);
    const dots = Math.min(3, Math.floor(t * 2.4));
    say(g, "GET YOURS", W / 2, H * 0.4, { font: `900 46px ${SANS}`, color: "#fff", shadow: "#400", shadowAt: [4, 5] });
    say(g, "NOW" + ".".repeat(dots), W / 2, H * 0.58, { font: `900 56px ${SANS}`, color: "#ffe23a", shadow: "#400", shadowAt: [4, 5] });
    return;
  }
  // The turn: black, a slow push in, the words as if someone meant them.
  g.fillStyle = "#030303"; g.fillRect(0, 0, W, H);
  const z = 1 + n * 0.06;
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z);
  say(g, "IF NOT,", 0, -34, { font: `700 26px ${SERIF}`, color: "#cfc8b8", smear: 1 });
  if (n > 0.55) say(g, "YOU NEVER WILL!", 0, 12, { font: `900 34px ${SERIF}`, color: "#e8e2d2", smear: 2.4 });
  g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 300);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.75)");
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  if (hash(f * 1.9) < 0.15) { g.fillStyle = "rgba(160,0,0,0.12)"; g.fillRect(0, 0, W, H); }
}

function credit(g, t) {
  g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
  say(g, "Paid for by the Friends of El Cabeza", W / 2, H * 0.46, { font: `700 16px ${MONO}`, color: "#d8d4c6" });
  say(g, "CANAL 99", W / 2, H * 0.56, { font: `700 13px ${MONO}`, color: "#9a9688" });
}

/* ------------------------------------------------------ the whole thing */

export function createCommercial() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  const scene = document.createElement("canvas");
  scene.width = W; scene.height = H;
  const s = scene.getContext("2d");
  const texture = new THREE.CanvasTexture(c);
  let lastFrame = -1;

  // Which scene, and how far into it (s), for t in seconds.
  function paintScene(t, f) {
    s.save();
    if (t < CUES.title) slate(s, t);
    else if (t < CUES.chess) {
      // The star wipe, from the slate.
      const u = (t - CUES.title) / 0.5;
      if (u < 1) {
        slate(s, t);
        s.save(); star(s, W / 2, H / 2, easeOut(u) * 420, 5, 0.42); s.clip();
        title(s, t - CUES.title, f);
        s.restore();
      } else title(s, t - CUES.title, f);
    } else if (t < CUES.king) chess(s, t - CUES.chess);
    else if (t < CUES.orders) king(s, t - CUES.king, f);
    else if (t < CUES.best) orders(s, t - CUES.orders);
    else if (t < CUES.dealer) best(s, t - CUES.best);
    else if (t < CUES.price) dealer(s, t - CUES.dealer, f);
    else if (t < CUES.close) price(s, t - CUES.price, f);
    else if (t < CUES.credit) close(s, t - CUES.close, f);
    else credit(s, t - CUES.credit);
    s.restore();
  }

  function draw(tSec) {
    const f = Math.floor(tSec * FPS);
    if (f === lastFrame) return;
    lastFrame = f;
    const t = f / FPS;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
    if (t >= CUES.snow) {
      for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 4) { const v = Math.floor(hash(x * 0.37 + y * 1.31 + f * 17.3) * 230); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 4, 3); }
      texture.needsUpdate = true;
      return;
    }
    paintScene(t, f);
    // The picture rolls at the cuts (vertical hold), then settles.
    const cuts = [CUES.title, CUES.chess, CUES.king, CUES.orders, CUES.best, CUES.dealer, CUES.price, CUES.close, CUES.credit];
    let roll = t < 0.6 ? (1 - t / 0.6) * H * 0.7 : 0;
    cuts.forEach((k, i) => { const d = t - k; if (d >= 0 && d < 0.35 && i % 2 === 0) roll = Math.max(roll, (1 - d / 0.35) * H * 0.25); });
    const oy = Math.round(roll) % H;
    g.drawImage(scene, 0, oy);
    if (oy) { g.drawImage(scene, 0, oy - H); g.fillStyle = "#000"; g.fillRect(0, oy - 6, W, 8); }
    // A line or two torn sideways.
    for (let i = 0; i < 3; i++) {
      if (hash(f * 3.1 + i) > 0.35) continue;
      const y = Math.floor(hash(f + i * 9.7) * H), hgt = 2 + Math.floor(hash(f + i) * 5), dx = (hash(f * 1.7 + i) - 0.5) * 30;
      g.drawImage(scene, 0, y, W, hgt, dx, y + oy, W, hgt);
    }
    // The tracking band, drifting up the picture now and then.
    const band = (t * 0.23) % 1;
    if (t % 9 < 2.4) {
      const by = H - band * 4.2 * H % (H + 40);
      for (let x = 0; x < W; x += 6) { const v = hash(x + f * 5.3); if (v > 0.5) { g.fillStyle = `rgba(255,255,255,${(v - 0.5) * 0.9})`; g.fillRect(x, by + hash(x * 2 + f) * 10, 6, 2); } }
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, by, W, 12);
    }
    // Dropout: a white fleck.
    if (hash(f * 0.77) < 0.12) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(hash(f * 2.2) * W, hash(f * 4.4) * H, 20 + hash(f) * 60, 1); }
    texture.needsUpdate = true;
  }

  return {
    texture,
    draw,
    reset() { lastFrame = -1; },
    dispose() { texture.dispose(); },
  };
}
