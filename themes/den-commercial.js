/* The late-night commercial on the den's television (den-tv.js plays it,
   den-fx.js calls it up): back out of Singularity for the first time in
   Nova, the set is on and this is what's showing. A community-access
   infomercial, 1975, made for about eleven dollars by people who believe
   in it completely: hand-cut letters, a star wipe, a drop shadow that
   missed, a pawn run off the screen, a crown drawn in marker, a thumb in
   the shot, and Dale, standing by.

   It says what just happened (the Singularity opened the special
   orders) and where to go for them (the store). The sound for it is
   den-ad-audio.js (played by den-audio.js's tvCommercial), cued to CUES
   below; the voices are the user's own recordings, each starting a
   little ahead of its words on screen (CUES.chessVoice, checkersVoice,
   voice, kings).

   Drawn in a 512 x 384 frame (the screen's 4:3) on a power-of-two canvas,
   at 24 frames a second, the picture clean (user: it had got too dirty,
   too messy, too garbled): one drop shadow throughout, a quick dissolve
   at each cut; then shown through an analog set (user: more of that, but
   never so you can't see what's going on): smear, ghost, a little colour
   bleed, scanlines, light snow, a soft tracking band, the odd slipping
   line, dark corners (createCommercial's analog()). The jokes
   stay (the thumb, Dale, the stamp); so do the Singularity's subliminal
   frames. */

import * as THREE from "three";

export const COMMERCIAL_MS = 46400;

// The scenes, in seconds from the top (the sound follows these). (Redone
// clean, user: the tape faults out, 24 fps, dissolves at the cuts; NEW FOR
// 1975 a second longer (everything after it a second later); each voice a
// little ahead of its words on screen.)
export const CUES = {
  slate: 0, title: 2.2, chess: 5.6, stamp: 6.8, chessVoice: 6.45, flee: 8.6,
  checker: 9.0, checkersVoice: 9.75, stamp2: 10.1, flee2: 11.8,
  king: 12.4, voice: 12.25, orders: 17.6,
  items: [18.4, 19.2, 20], assembly: 21, best: 22.2, sortOf: 24.7, dealer: 25.8, standing: 27.2,
  price: 30, only: 31.1, brandNew: 32.1, close: 35.4, never: 37, credit: 39.1, kings: 38.75, snow: 45.8,
  // Subliminal frames of the Singularity's black hole (two frames each at
  // 24 fps; the last two, four), spliced in where nobody at Canal 99 put them.
  flash: [6.45, 19.55, 23.45, 37.75, 42.15],
};

const W = 512, H = 384, FPS = 24;
const DISSOLVE = 0.22; // (seconds, at each cut)

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const easeOut = (u) => 1 - Math.pow(1 - clamp01(u), 3);
const easeBack = (u) => { u = clamp01(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

const MONO = "'Courier Prime', 'Courier New', monospace";
const SANS = "'Libre Franklin', 'Arial Black', Arial, sans-serif";
const SERIF = "'Bodoni Moda', Georgia, serif";

// Text with the colours a little apart (the tape's chroma) and, if asked,
// the drop shadow somebody set by eye.
// Text, clean (user: no more colour fringing), with a hard drop shadow
// where one's asked for (always down and right, the same everywhere).
function say(g, str, x, y, { font, color = "#fff", shadow = null, align = "center" }) {
  g.font = font; g.textAlign = align; g.textBaseline = "middle";
  if (shadow) { g.fillStyle = shadow; g.fillText(str, x + 4, y + 4); }
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
    const wob = Math.sin(t * 2 + i * 1.7) * 0.04 + (i % 2 ? 0.05 : -0.05);
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
  // Glitter, twinkling (each star on its own slow beat).
  for (let i = 0; i < 9; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1);
    if (tw < 0.35) continue;
    g.globalAlpha = tw;
    g.fillStyle = "#fff"; star(g, 40 + hash(i) * (W - 80), 30 + hash(i + 50) * (H - 60), (4 + hash(i + 9) * 5) * tw, 4, 0.3); g.fill();
    g.globalAlpha = 1;
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

// The rest of the set, as cheaply drawn: a rook and the king.
function rook(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#1c1c1c";
  g.fillRect(-24, -62, 48, 14);
  [-24, -6, 12].forEach((cx) => g.fillRect(cx, -76, 12, 14));
  g.beginPath(); g.moveTo(-18, -48); g.lineTo(18, -48); g.lineTo(24, 30); g.lineTo(-24, 30); g.closePath(); g.fill();
  g.fillRect(-36, 30, 72, 14); g.fillRect(-42, 44, 84, 10);
  g.fillStyle = "rgba(255,255,255,0.22)"; g.fillRect(-12, -44, 5, 60);
  g.restore();
}
function kingPiece(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#1c1c1c";
  g.fillRect(-4, -118, 8, 30); g.fillRect(-14, -108, 28, 8); // the cross
  g.beginPath(); g.moveTo(-26, -86); g.quadraticCurveTo(0, -100, 26, -86); g.lineTo(18, -60); g.lineTo(-18, -60); g.closePath(); g.fill();
  g.fillRect(-28, -62, 56, 9);
  g.beginPath(); g.moveTo(-16, -53); g.lineTo(16, -53); g.lineTo(26, 30); g.lineTo(-26, 30); g.closePath(); g.fill();
  g.fillRect(-38, 30, 76, 14); g.fillRect(-44, 44, 88, 10);
  g.fillStyle = "rgba(255,255,255,0.22)"; g.fillRect(-10, -50, 5, 70);
  g.restore();
}

// A red checker, as cheaply drawn as the pawn.
function checker(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#6e0f12"; g.beginPath(); g.ellipse(0, 12, 70, 24, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#c21f26"; g.beginPath(); g.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,0,0,0.55)"; g.lineWidth = 3;
  [52, 36].forEach((r) => { g.beginPath(); g.ellipse(0, 0, r, r * 0.34, 0, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(-24, -8, 14, 4, -0.2, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Two people at a card table over a checkerboard, both asleep, Z's rising.
function sleepers(g, x, y, t) {
  g.save(); g.translate(x, y);
  // The table and the board on it.
  g.fillStyle = "#6b4526"; g.fillRect(-120, 34, 240, 14); g.fillRect(-104, 48, 10, 70); g.fillRect(94, 48, 10, 70);
  g.save(); g.translate(0, 22); g.scale(1, 0.4);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { g.fillStyle = (r + c) % 2 ? "#1c1c1c" : "#b3261e"; g.fillRect(-60 + c * 20, -60 + r * 20, 20, 20); }
  [[-50, -50], [-10, -30], [30, -50], [-30, 30], [10, 10], [50, 50]].forEach(([cx, cy], i) => { g.fillStyle = i < 3 ? "#e8e0d0" : "#d0282c"; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill(); });
  g.restore();
  // The two of them, slumped over it, breathing slowly.
  [[-1, "#d9772b", "#8a8a8a"], [1, "#2f7f7a", "#5a3a22"]].forEach(([side, shirt, hair], i) => {
    const breathe = Math.sin(t * 2 + i * 1.7) * 2;
    const bx = side * 95;
    g.fillStyle = shirt;
    g.beginPath(); g.moveTo(bx - 30, 118); g.lineTo(bx - 24, 40 + breathe); g.quadraticCurveTo(bx, 28 + breathe, bx + 24, 40 + breathe); g.lineTo(bx + 30, 118); g.closePath(); g.fill();
    // The arm on the table, the head down on it.
    g.fillStyle = shirt; g.fillRect(bx - side * 40 - 22, 26 + breathe, 44, 12);
    const hx = bx - side * 26, hy = 14 + breathe;
    g.fillStyle = "#e8b48a"; g.beginPath(); g.ellipse(hx, hy, 17, 15, side * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair; g.beginPath(); g.ellipse(hx + side * 6, hy - 7, 15, 9, side * 0.5, 0, Math.PI * 2); g.fill();
    // Closed eyes.
    g.strokeStyle = "#3a2418"; g.lineWidth = 2; g.beginPath(); g.arc(hx - side * 6, hy + 2, 3.5, 0.2, Math.PI - 0.2); g.stroke();
    // Z's, rising and drifting, one after another.
    for (let k = 0; k < 3; k++) {
      const u = ((t * 0.55 + k / 3 + i * 0.17) % 1);
      const zx = hx + side * (10 + u * 34) + Math.sin(u * 6 + k) * 6, zy = hy - 22 - u * 90;
      g.globalAlpha = Math.min(1, u * 4) * (1 - u);
      say(g, "Z", zx, zy, { font: `900 ${14 + u * 18}px ${SANS}`, color: "#ffffff", shadow: "#000" });
      g.globalAlpha = 1;
    }
  });
  g.restore();
}

// The rubber stamp, slammed down: a red circle and a slash. (size: its
// radius; the chess set's is big enough to take in the whole set.)
function stampMark(g, st, y, size = 92) {
  const s = st < 0.15 ? 1.8 - st * 5.3 : 1;
  g.save(); g.translate(W / 2, y); g.rotate(-0.18); g.scale(s, s);
  g.strokeStyle = "rgba(214,30,30,0.9)"; g.lineWidth = 14 * size / 92;
  g.beginPath(); g.arc(0, 0, size, 0, Math.PI * 2); g.stroke();
  const d = size * 0.7;
  g.beginPath(); g.moveTo(-d, -d); g.lineTo(d, d); g.stroke();
  g.restore();
}
// The same stamp's bar, slammed across a word to strike it out.
function strikeOut(g, st, x, y, w) {
  const s = st < 0.15 ? 1.6 - st * 4 : 1;
  g.save(); g.translate(x, y); g.rotate(-0.08); g.scale(s, s);
  g.strokeStyle = "rgba(214,30,30,0.92)"; g.lineWidth = 9; g.lineCap = "round";
  g.beginPath(); g.moveTo(-w / 2, 2); g.lineTo(w / 2, -2); g.stroke();
  g.restore();
}

// "Take a hike, chess!" (the set run off), then "Get outta here,
// Checkers!" (a checker slides in, is stamped, and goes the same way).
function chess(g, t) {
  g.fillStyle = "#cfc9b8"; g.fillRect(0, 0, W, H);
  // The checkerboard backdrop, a bedsheet with squares painted on.
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { if ((r + c) % 2) { g.fillStyle = "#8f8876"; g.fillRect(c * 64, r * 64, 64, 64); } }
  g.fillStyle = "rgba(20,16,10,0.25)"; g.fillRect(0, 0, W, H);
  const T = CUES.chess;
  const at = (k) => t - (CUES[k] - T);
  const lines = (a, b, shake) => {
    say(g, a, W / 2 + shake, H * 0.855, { font: `900 32px ${SANS}`, color: "#ffe23a", shadow: "#000", shadowAt: [4, 4] });
    say(g, b, W / 2 - shake, H * 0.95, { font: `900 34px ${SANS}`, color: "#ffe23a", shadow: "#000", shadowAt: [4, 4] });
  };
  if (at("checker") < 0) {
    say(g, "TIRED OF...", W / 2, H * 0.14, { font: `900 30px ${SANS}`, color: "#fff", shadow: "#000", shadowAt: [3, 4] });
    /* The whole of chess, not just a pawn (user: "bag on chess more"): a
       rook, the king and the pawn, sitting there smug; the stamp comes
       down over the lot and through the word itself; then the set's run
       off the screen. CHESS? stays up the whole time. */
    const flee = at("flee");
    const off = flee > 0 ? flee * 700 + Math.pow(flee, 2) * 3000 : 0;
    const set = [[W * 0.32, rook, 0.8], [W * 0.5, kingPiece, 0.74], [W * 0.68, pawn, 0.85]];
    set.forEach(([x, draw, sc], i) => {
      const px = x - off * (1 + i * 0.12);
      if (px < -90) return;
      draw(g, px, H * 0.6, sc);
      if (flee > 0) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3; for (let k = 0; k < 3; k++) { const yy = H * 0.44 + k * 20 + i * 4; g.beginPath(); g.moveTo(px + 46, yy); g.lineTo(px + 46 + 50 + k * 12, yy); g.stroke(); } }
    });
    say(g, "CHESS?", W / 2, H * 0.27, { font: `900 46px ${SERIF}`, color: "#fff", shadow: "#000", shadowAt: [3, 3] });
    const st = at("stamp");
    if (st > 0) {
      strikeOut(g, st, W / 2, H * 0.27, 190);
      if (flee <= 0) stampMark(g, st, H * 0.61, 90);
      lines("TAKE A HIKE,", "CHESS!", 0);
    }
    return;
  }
  /* ...and checkers. The camera: in close on the two of them asleep over
     their game (and a slow push in), then, over a second, out to the
     whole table (user). The words are laid over the picture, as the
     station's character generator did: they don't zoom with it. */
  const ck = at("checker");
  const zo = clamp01((ck - 0.55) / 1.0), ze = zo * zo * (3 - 2 * zo);
  const zoom = (2.15 + 0.12 * clamp01(ck / 0.55)) * (1 - ze) + ze;
  const fx = W * 0.5, fy = H * 0.57 + 6; // (between their heads)
  g.save();
  g.translate(W / 2, H / 2); g.scale(zoom, zoom);
  g.translate(-(fx + (W / 2 - fx) * ze), -(fy + (H / 2 - fy) * ze));
  g.fillStyle = "#cfc9b8"; g.fillRect(0, 0, W, H);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { if ((r + c) % 2) { g.fillStyle = "#8f8876"; g.fillRect(c * 64, r * 64, 64, 64); } }
  g.fillStyle = "rgba(20,16,10,0.25)"; g.fillRect(0, 0, W, H);
  // A couple over a game of checkers, both of them fast asleep.
  const flee2 = at("flee2");
  const cx = flee2 > 0 ? W * 0.5 + Math.pow(flee2, 2) * 1100 : W * 0.5;
  if (cx < W + 170) {
    sleepers(g, cx, H * 0.57, Math.max(0, ck));
    if (flee2 > 0) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const yy = H * 0.5 + i * 18; g.beginPath(); g.moveTo(cx - 140, yy); g.lineTo(cx - 140 - 60 - i * 12, yy); g.stroke(); } }
  }
  g.restore();
  say(g, "AND...", W / 2, H * 0.14, { font: `900 30px ${SANS}`, color: "#fff", shadow: "#000" });
  const st2 = at("stamp2");
  if (st2 <= 0) say(g, "CHECKERS?", W / 2, H * 0.3, { font: `900 34px ${SERIF}`, color: "#fff", shadow: "#000", shadowAt: [3, 3] });
  else {
    if (flee2 <= 0) stampMark(g, st2, H * 0.56);
    lines("GET OUTTA HERE,", "CHECKERS!", 0);
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
  const flick = Math.floor(t * 2) % 2;
  say(g, "EL CABEZA", W / 2, H * 0.14, { font: `900 44px ${SERIF}`, color: flick ? "#ffe23a" : "#ffffff", shadow: "#000", shadowAt: [4, 5] });
  // (The words come up with the voice's: "...is the new king!")
  if (t > 1.7) say(g, "IS THE NEW KING!", W / 2, H * 0.9, { font: `900 34px ${SERIF}`, color: flick ? "#ffffff" : "#ffe23a", shadow: "#000", shadowAt: [4, 5] });
  for (let i = 0; i < 6; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.9);
    if (tw < 0.3) continue;
    g.globalAlpha = tw;
    g.fillStyle = "#fff9c0"; star(g, W * (0.12 + 0.76 * hash(i + 21)), H * (0.25 + 0.5 * hash(i + 44)), 7 * tw, 4, 0.28); g.fill();
    g.globalAlpha = 1;
  }
}

function orders(g, t) {
  // A blue backdrop (the chroma key they didn't know how to key).
  g.fillStyle = "#1438c8"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(40,90,255,0.14)"; for (let y = 0; y < H; y += 8) g.fillRect(0, y, W, 3);
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
    // (It shoves over for NEW FOR 1975.)
    const side = easeOut((t - (CUES.brandNew - CUES.price)) / 0.3);
    g.save(); g.translate(W * (0.5 - 0.22 * side), H * (0.58 - 0.02 * side)); g.rotate(-0.08); g.scale(k * (1 - 0.18 * side), k * (1 - 0.18 * side));
    g.fillStyle = "#d0101a"; star(g, 0, 0, 118, 16, 0.84, 0); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 4; star(g, 0, 0, 104, 16, 0.84, 0); g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 20px ${SANS}`; g.fillText("ONLY", 0, -44);
    g.font = `900 64px ${SANS}`; g.fillText("$7", -18, 10);
    g.font = `900 32px ${SANS}`; g.fillText("97", 44, -4);
    g.fillRect(28, 12, 34, 4);
    g.restore();
  }
  // NEW FOR 1975: a big starburst that strobes through every colour the
  // station's character generator had, with a ring of chaser bulbs.
  const b = t - (CUES.brandNew - CUES.price);
  if (b > 0) {
    const strobe = Math.floor(b * 3) % 4; // (a steady flash through its colours)
    const [fill, ink, ring] = [["#1438c8", "#ffffff", "#ffe23a"], ["#ffe23a", "#d0101a", "#1438c8"], ["#d0101a", "#ffe23a", "#ffffff"], ["#1fae3a", "#ffffff", "#d0101a"]][strobe];
    const pop = b < 0.22 ? easeBack(b / 0.22) : 1 + Math.sin(b * 9) * 0.035;
    g.save(); g.translate(W * 0.7, H * 0.62); g.rotate(-0.18 + Math.sin(b * 3) * 0.04); g.scale(pop, pop);
    // Flashing rays behind it.
    if (strobe % 2 === 0) { g.fillStyle = "rgba(255,255,255,0.55)"; star(g, 0, 0, 175, 12, 0.35, b); g.fill(); }
    g.fillStyle = ring; star(g, 0, 0, 132, 18, 0.8); g.fill();
    g.fillStyle = fill; star(g, 0, 0, 120, 18, 0.8); g.fill();
    // The chaser bulbs.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, on = (i + Math.floor(b * 8)) % 3 === 0;
      g.fillStyle = on ? "#fffbe0" : "rgba(60,40,0,0.5)";
      g.beginPath(); g.arc(Math.cos(a) * 92, Math.sin(a) * 92, on ? 5 : 3.5, 0, Math.PI * 2); g.fill();
    }
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.35)"; g.font = `900 28px ${SANS}`; g.fillText("NEW", 3, -38 + 3);
    g.fillStyle = ink; g.fillText("NEW", 0, -38);
    g.font = `900 17px ${SANS}`; g.fillText("FOR", 0, -12);
    g.fillStyle = "rgba(0,0,0,0.35)"; g.font = `900 54px ${SANS}`; g.fillText("1975!", 4, 28 + 4);
    g.fillStyle = ink; g.fillText("1975!", 0, 28);
    g.restore();
  }
}

// "Get yours now... if not, you never will!" (it goes a bit dark there).
function close(g, t, f) {
  const n = t - (CUES.never - CUES.close);
  if (n < 0) {
    g.fillStyle = "#d0121c"; g.fillRect(0, 0, W, H);
    const dots = Math.min(3, Math.floor(t * 2.4));
    say(g, "GET YOURS", W / 2, H * 0.4, { font: `900 46px ${SANS}`, color: "#fff", shadow: "#400", shadowAt: [4, 5] });
    say(g, "NOW" + ".".repeat(dots), W / 2, H * 0.58, { font: `900 56px ${SANS}`, color: "#ffe23a", shadow: "#400", shadowAt: [4, 5] });
    return;
  }
  // The turn: black, a slow push in, the words as if someone meant them.
  g.fillStyle = "#030303"; g.fillRect(0, 0, W, H);
  const z = 1 + n * 0.06;
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z);
  say(g, "IF NOT,", 0, -34, { font: `700 26px ${SERIF}`, color: "#cfc8b8" });
  if (n > 0.55) { g.globalAlpha = Math.min(1, (n - 0.55) * 3); say(g, "YOU NEVER WILL!", 0, 12, { font: `900 34px ${SERIF}`, color: "#e8e2d2" }); g.globalAlpha = 1; }
  g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 300);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.75)");
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

function credit(g, t) {
  g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
  say(g, "Paid for by the Friends of El Cabeza", W / 2, H * 0.36, { font: `700 16px ${MONO}`, color: "#d8d4c6" });
  say(g, "CANAL 99", W / 2, H * 0.46, { font: `700 13px ${MONO}`, color: "#9a9688" });
  // "The new king!" three times over it, each a little further gone (the
  // character generator's echo, to go with the voice's).
  const k = CUES.kings - CUES.credit;
  [0, 1.5, 3.0].forEach((d, i) => {
    const u = t - k - d - 0.35;
    if (u <= 0) return;
    g.globalAlpha = Math.max(0, (1 - i * 0.3) * Math.min(1, u * 4) * (1 - Math.max(0, u - 2.2) * 0.5));
    say(g, "the new king!", W / 2 + (i - 1) * 30, H * (0.6 + i * 0.1), { font: `italic 700 ${24 - i * 3}px ${SERIF}`, color: "#f5c518" });
    g.globalAlpha = 1;
  });
}

/* The Singularity, for one frame: a black hole on the starfield, its
   photon ring and the lensed disc in Neon's colours, and the word. */
function blackHole(g, f) {
  g.fillStyle = "#010103"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const b = hash(i * 3.3 + 1);
    g.fillStyle = `rgba(${200 + b * 55},${210 + b * 45},255,${0.25 + b * 0.6})`;
    g.fillRect(hash(i * 7.1) * W, hash(i * 1.9 + 4) * H, b > 0.85 ? 2 : 1, b > 0.85 ? 2 : 1);
  }
  const cx = W / 2 + (hash(f) - 0.5) * 16, cy = H * 0.46, R = 58;
  g.save(); g.translate(cx, cy);
  // The disc, edge-on, brighter on the side coming toward us.
  const disc = g.createLinearGradient(-190, 0, 190, 0);
  disc.addColorStop(0, "rgba(102,217,255,0.95)"); disc.addColorStop(0.5, "rgba(170,110,255,0.75)"); disc.addColorStop(1, "rgba(90,60,200,0.35)");
  g.strokeStyle = disc;
  [[190, 26, 10], [160, 20, 6], [226, 32, 3]].forEach(([rx, ry, lw]) => { g.lineWidth = lw; g.beginPath(); g.ellipse(0, 0, rx, ry, -0.08, 0, Math.PI * 2); g.stroke(); });
  // The far side of the disc, bent up over the top by the hole.
  g.lineWidth = 9; g.strokeStyle = "rgba(150,120,255,0.7)";
  g.beginPath(); g.ellipse(0, -4, R * 1.55, R * 1.3, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // The photon ring, and the shadow inside it.
  const ring = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.35);
  ring.addColorStop(0, "rgba(220,240,255,0)"); ring.addColorStop(0.25, "rgba(220,240,255,0.95)"); ring.addColorStop(0.5, "rgba(102,217,255,0.5)"); ring.addColorStop(1, "rgba(102,217,255,0)");
  g.fillStyle = ring; g.beginPath(); g.arc(0, 0, R * 1.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // The near side of the disc, across the front of the shadow.
  g.lineWidth = 7; g.strokeStyle = disc;
  g.beginPath(); g.ellipse(0, 0, 190, 26, -0.08, 0.05, Math.PI - 0.05); g.stroke();
  g.restore();
  say(g, "S I N G U L A R I T Y", W / 2, H * 0.86, { font: `600 22px 'Chakra Petch', ${MONO}`, color: "#66d9ff" });
}

/* The same frame on its own (den-tv.js: flashed on the dead set while it
   lures, before the commercial has ever aired), as the tube's texture. */
export function createSingularityFrame() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  blackHole(g, 3);
  const texture = new THREE.CanvasTexture(c);
  return { texture, dispose: () => texture.dispose() };
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
  /* The analog set (user: more of it, but never so much you can't see
     what's going on): the picture composed first (pic), then shown with
     a little composite smear and a faint ghost, red and blue bleeding a
     pixel or two either side, scanlines, a light snow, a soft tracking
     band drifting up now and then, the odd line slipping, and the tube's
     darker corners. */
  const mk = (w, h) => { const k = document.createElement("canvas"); k.width = w; k.height = h; return k; };
  const pic = mk(W, H), pg = pic.getContext("2d");
  const tint = mk(W, H), tg = tint.getContext("2d");
  const scan = mk(W, H);
  { const q = scan.getContext("2d"); q.fillStyle = "rgba(0,0,0,0.16)"; for (let y = 0; y < H; y += 2) q.fillRect(0, y, W, 1); }
  const snows = [0, 1, 2, 3].map((n) => {
    const k = mk(W / 2, H / 2), q = k.getContext("2d"), im = q.createImageData(W / 2, H / 2);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.floor(hash(i * 0.013 + n * 91.7) * 255); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    q.putImageData(im, 0, 0); return k;
  });
  const vig = (() => { const k = mk(W, H), q = k.getContext("2d"); const r = q.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.68); r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,0,0.42)"); q.fillStyle = r; q.fillRect(0, 0, W, H); return k; })();
  function bleed(color, dx, alpha) {
    tg.globalCompositeOperation = "copy"; tg.drawImage(pic, 0, 0);
    tg.globalCompositeOperation = "multiply"; tg.fillStyle = color; tg.fillRect(0, 0, W, H);
    tg.globalCompositeOperation = "source-over";
    g.globalCompositeOperation = "screen"; g.globalAlpha = alpha; g.drawImage(tint, dx, 0);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  function analog(t, f) {
    // (The hold: a hair of jitter, now and then.)
    const jy = hash(Math.floor(t * 3)) < 0.18 ? (hash(f * 1.3) < 0.5 ? 1 : -1) : 0;
    g.drawImage(pic, 0, jy);
    g.globalAlpha = 0.3; g.drawImage(pic, 1.5, jy); // the smear
    g.globalAlpha = 0.07; g.drawImage(pic, 13, jy); // the ghost
    g.globalAlpha = 1;
    bleed("#ff2a2a", 2, 0.16);
    bleed("#2a6cff", -2, 0.14);
    g.drawImage(scan, 0, 0);
    g.globalAlpha = 0.07; g.drawImage(snows[f % 4], 0, 0, W, H); g.globalAlpha = 1;
    // The tracking band, drifting up: soft, a few seconds in every nine.
    if (t % 9 > 5.5) {
      const by = H - ((t % 9) - 5.5) / 3.5 * (H + 30);
      g.globalAlpha = 0.16; g.drawImage(snows[(f + 1) % 4], 0, 0, W / 2, 6, 0, by, W, 12);
      g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(0, by - 6, W, 24);
    }
    // A line slipping sideways, rarely, briefly.
    if (hash(Math.floor(t * 4) * 1.7) < 0.12) {
      const y = Math.floor(hash(Math.floor(t * 4) * 3.1) * (H - 8)), dx = (hash(f) < 0.5 ? -1 : 1) * (3 + hash(f * 2.3) * 4);
      g.drawImage(pic, 0, y, W, 3, dx, y + jy, W, 3);
    }
    g.drawImage(vig, 0, 0);
  }

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
    // A frame that shouldn't be there.
    if (CUES.flash.some((c, i) => { const k = f - Math.floor(c * FPS); return k >= 0 && k < (i >= 3 ? 4 : 2); })) blackHole(s, f);
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
    /* Clean (user): no rolling, tearing, tracking band or dropout. At each
       cut, a quick dissolve from the scene before (painted as it was the
       moment before the cut), so it flows. */
    const cuts = [CUES.chess, CUES.king, CUES.orders, CUES.best, CUES.dealer, CUES.price, CUES.close, CUES.credit];
    const cut = cuts.find((k) => t >= k && t - k < DISSOLVE);
    paintScene(t, f);
    pg.drawImage(scene, 0, 0);
    if (cut != null) {
      paintScene(cut - 0.001, f);
      pg.globalAlpha = 1 - (t - cut) / DISSOLVE;
      pg.drawImage(scene, 0, 0);
      pg.globalAlpha = 1;
    }
    analog(t, f);
    texture.needsUpdate = true;
  }

  return {
    texture,
    draw,
    reset() { lastFrame = -1; },
    dispose() { texture.dispose(); },
  };
}
