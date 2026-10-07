/* Parrish theme: a painted world in motion.

   The user's brief: a painterly technique where live-action footage of the
   pieces and board, nature, and imagery after Maxfield Parrish is edited
   and animated through rotoscoping and stop-motion so it moves like an
   oil painting (Loving Vincent's hand-painted rotoscoping). The user's
   references for the style, motif, palette and feeling: Enya's "Orinoco
   Flow" video (the singer clean and photographic over loose, expressive
   painted worlds of sea, surf, sky, flowers, a ship, the moon; high-key,
   airy, misty) and her "Watermark" cover (crimson leaves, weathered
   plaster, the name in a fine lowercase hand, a darker edge).

   Here (user: no theme, zero theme; the board and pieces "are a part of
   the painting, that move"): the board and its pieces float in a world of
   pure abstract paint (themes/parrish-scene.js), in one of two palettes,
   Orinoco's airy blues and creams or Watermark's wine, crimson and ruddy
   browns (themes/parrish-looks.js, ?look=), and every frame of all of it
   is repainted (themes/parrish-paint.js): the world in big palette-knife
   sweeps with accents, the board and pieces in smaller strokes in the
   palette's own colours, and a moving piece leaves a dissolving, painted
   afterimage, as things move in the video. Two ways of moving
   (?motion=stop|boil): by default stop-motion, the whole picture a new
   painting eight times a second and held between (the video's own
   rhythm), or the strokes repainted eight times a second over smooth
   motion.

   The menus: ivory print stock and deep blue ink, Cinzel for headings,
   Cormorant Garamond for the rest; the masthead is the user's own
   lettering of "el cabeza", painted into the picture. The sound is the sea's own (themes/parrish-audio.js), with a place for the
   user's recording. */

import * as THREE from "three";
import { quality } from "./tienda-quality.js";
import { createWoodSet, EDGE_RADIUS as SET_EDGE_RADIUS, OUTLINE_Y_OFFSET } from "./wood-set.js";
import { parrishEnv, createParrishEffects } from "./parrish-scene.js";
import { MUSIC_URL, INTRO_URL, HUMS_URL, HUMS_LEVEL, EVENING_URL, SOUNDTRACK_TITLE } from "./parrish-audio.js";
import { look, lookName, lookTitle } from "./parrish-looks.js";
// The user's "el cabeza" lettering, its outline traced exactly from their
// artwork (a mask: never redrawn), and the paint that fills it, one for
// each palette.
import TITLE_MASK from "../assets/parrish/title-mask.webp";
// End turn's stroke (tools/parrish_button_stroke.py): one steady pass,
// straight along its length, the bristles lifting off at the end (user).
import BUTTON_STROKE from "../assets/parrish/button-stroke.webp";
import TITLE_PAINT_ORINOCO from "../assets/parrish/title-paint-orinoco.webp";
import TITLE_PAINT_WATERMARK from "../assets/parrish/title-paint-watermark.webp";
// The menus' paint (tools/parrish_menu_art.py): each palette's ground, a
// panel's ragged painted edge, and a button's single brush stroke.
import MENU_PAINT_ORINOCO from "../assets/parrish/menu-paint-orinoco.webp";
import MENU_PAINT_WATERMARK from "../assets/parrish/menu-paint-watermark.webp";
import MENU_EDGE from "../assets/parrish/menu-edge.webp";
import MENU_BRUSH from "../assets/parrish/menu-brush.webp";
import STROKE_ORINOCO_PAINT from "../assets/parrish/menu-stroke-orinoco-paint.webp";
import STROKE_ORINOCO_GLAZE from "../assets/parrish/menu-stroke-orinoco-glaze.webp";
import STROKE_WATERMARK_PAINT from "../assets/parrish/menu-stroke-watermark-paint.webp";
import STROKE_WATERMARK_GLAZE from "../assets/parrish/menu-stroke-watermark-glaze.webp";
import STROKE_ORINOCO_PAINT_1 from "../assets/parrish/menu-stroke-orinoco-paint-1.webp";
import STROKE_ORINOCO_PAINT_2 from "../assets/parrish/menu-stroke-orinoco-paint-2.webp";
import STROKE_ORINOCO_PAINT_3 from "../assets/parrish/menu-stroke-orinoco-paint-3.webp";
import STROKE_ORINOCO_GLAZE_1 from "../assets/parrish/menu-stroke-orinoco-glaze-1.webp";
import STROKE_ORINOCO_GLAZE_2 from "../assets/parrish/menu-stroke-orinoco-glaze-2.webp";
import STROKE_ORINOCO_GLAZE_3 from "../assets/parrish/menu-stroke-orinoco-glaze-3.webp";
import STROKE_WATERMARK_PAINT_1 from "../assets/parrish/menu-stroke-watermark-paint-1.webp";
import STROKE_WATERMARK_PAINT_2 from "../assets/parrish/menu-stroke-watermark-paint-2.webp";
import STROKE_WATERMARK_PAINT_3 from "../assets/parrish/menu-stroke-watermark-paint-3.webp";
import STROKE_WATERMARK_GLAZE_1 from "../assets/parrish/menu-stroke-watermark-glaze-1.webp";
import STROKE_WATERMARK_GLAZE_2 from "../assets/parrish/menu-stroke-watermark-glaze-2.webp";
import STROKE_WATERMARK_GLAZE_3 from "../assets/parrish/menu-stroke-watermark-glaze-3.webp";

// Which of the two palettes (?look=orinoco|watermark; parrish-looks.js).
const LOOK = look();
const DARK = lookName() === "watermark";

/* ------------------------------------------------------------ the palette */

// The palette: a deep sea-blue ink, gold, ivory, and the cover's crimson.
export const PARRISH = {
  blue: "#1D2C5E",      // the ink
  cobalt: "#2348A8",
  azure: "#5B8FD8",
  gold: "#C9963B",
  amber: "#E8B75A",
  peach: "#F2C5A0",
  ivory: "#F4EAD5",
  marble: "#EADCC0",
  umber: "#5A3A22",
  crimson: "#8E1420",
};

// The menus, painted (styleSheet below): Orinoco's on ivory with
// Parrish-blue ink; Watermark's on wine, its ink the cream of its light.
const MENU = DARK
  ? { paper: "#3A0F14", paperAlt: "#4A161B", ink: "#F1E2C4", muted: "#C9A78A", mutedRgb: "201, 167, 138", gold: "#C8964A",
      paint: "#E3CB98", paintInk: "#3A0C12", glaze: "rgba(214, 160, 84, 0.24)", shade: "rgba(12, 2, 4, 0.6)" }
  : { paper: PARRISH.ivory, paperAlt: PARRISH.marble, ink: PARRISH.blue, muted: "#5A6A9A", mutedRgb: "90, 106, 154", gold: "#B8862E",
      paint: "#24418F", paintInk: "#F6E7C1", glaze: "rgba(232, 183, 90, 0.3)", shade: "rgba(8, 14, 38, 0.5)" };

export const COLORS = {
  cream: MENU.paper,
  creamAlt: MENU.paperAlt,
  charcoal: MENU.ink,
  slate: MENU.muted,
  slateSoft: `rgba(${MENU.mutedRgb}, 0.30)`,
  slateFaint: `rgba(${MENU.mutedRgb}, 0.10)`,
  // A picked button: a stroke of the palette's own paint.
  selected: MENU.paint,
  selectedInk: MENU.paintInk,
  pageBg: DARK ? "#140405" : "#0E1A3D",
  pageBgDeep: DARK ? "#0A0203" : "#081128",
  // The pieces: the set's walnut for Dark, olive ash for Light.
  bodyDark: "#4A2C1C",
  bodyLight: "#D9B77E",
};

// Roman capitals, as Parrish lettered his calendars.
// The menus' headings in Cinzel; the masthead is the user's own lettering
// of "el cabeza" (styleSheet below).
export const titleFontFamily = "'Cinzel', 'Trajan Pro', Georgia, serif";
// The masthead before a game 1.3 times the shared size (user); the corner
// badge during play has its own (.ec-masthead-relocated below).
export const mastheadScale = 1.3;
// The corner badge during play, stronger than the shared 0.22 watermark
// (user: 0.264, 0.42, 0.53, 0.62, 0.55, then settled on 42%).
export const mastheadBadgeOpacity = 0.42;
// The dock's piece, in the corner during a game: enough of it to see
// against the terrace.
export const dockCornerOpacity = 0.8; // (user: 20% more than the 0.6 it was)
// The camera a little lower than the default (0.86), so the colonnade and
// the pool's sky show behind the board; lower again on a tall screen.
export const viewPitch = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25 ? 1.14 : 1.1;

export const HEX = {
  cream: 0xf4ead5,
  charcoal: 0x2a1a10, // the slab's edge lines (hidden: the plinth's top takes them)
  slate: 0x5a6a9a,
  pieceLight: 0xd9b77e,
  pieceDark: 0x4a2c1c,
  // Pivot arrows and similar accents the chassis colours per side.
  glowCyan: 0xe8b75a,
  glowAmber: 0xf4ead5,
  structureEdge: 0xe8b75a,
};

export const EDGE_RADIUS = SET_EDGE_RADIUS;
// The shell's at-rest lift, stripped before a roll (wood-set.js SHELL_LIFT).
export const outlineYOffset = OUTLINE_Y_OFFSET;

export const modalBackdrop = DARK ? "rgba(14, 3, 5, 0.6)" : "rgba(8, 14, 38, 0.55)";
export const modalSurface = DARK ? "rgba(58, 15, 20, 0.98)" : "rgba(246, 236, 214, 0.98)";
// Shown only until the terrace is up: the sky at dusk.
export const canvasGradientStart = LOOK.bg;
export const canvasGradientEnd = DARK ? "#140405" : "#3E7FA8";

/* Soft, high daylight over the sea: a pale key (moved each frame with the
   board: parrish-scene.js), the sky's blue and the sea's green from above
   and below, a cool fill, a faint warm back light. */
export const lights = {
  ambient: DARK ? { color: 0xffe8e0, intensity: 0.1 } : { color: 0xf4f6ff, intensity: 0.16 },
  hemi: DARK ? { sky: 0xd8b0a0, ground: 0x4a1a14, intensity: 0.55 } : { sky: 0xd6e6ff, ground: 0x9ccfc8, intensity: 0.7 },
  key: { color: 0xfff4e2, intensity: 1.05 },
  fill: { color: 0xc8dcff, intensity: 0.35 },
  back: { color: 0xffe2d0, intensity: 0.3 },
};

/* ------------------------------------------------------------ the set */

/* The board, the blocks, the move markers and the board's features are
   the store's copy (themes/wood-set.js), reflecting the terrace. */
export const woodSet = createWoodSet({ env: parrishEnv, quality, lights });
// The squares are painted into the board's texture, so the chassis paints
// it again when the board changes size.
export const boardTextureFollowsSize = true;
export const makeBoardTexture = woodSet.makeBoardTexture;
// The board writes alpha 0.75 (the pieces 1): the paint tells them apart,
// so only a moving piece leaves an afterimage (parrish-paint.js).
const boardAlpha = (m) => { m.opacity = 0.75; m.transparent = false; return m; };
export const buildSlabMaterials = (tex) => woodSet.buildSlabMaterials(tex).map(boardAlpha);
export const makeGrid = () => { const g = woodSet.makeGrid(); g.traverse((o) => { if (o.material && !o.material.transparent) boardAlpha(o.material); }); return g; };
export const buildPieceVisual = woodSet.buildPieceVisual;
// The move markers (user: the set's beige ones were hard to tell from the
// board): in Orinoco one of the painting's own lighter blues, in Watermark
// one of the crimsons of its sky, on a wider band than the set's and with a
// faint wash of the colour across the square, so they hold up through the
// paint; a dark edge under them as the set has it. A capture's marker
// stays the set's own design (an inner square too); in Watermark it's in
// the painting's gold, so it can't be mistaken for the red ones.
const MARKER = DARK ? { main: 0xe6283f, edge: 0x2e060c, wash: 0.36 } : { main: 0x5fa2f0, edge: 0x1f2f58, wash: 0.34 };
const CRUSH_GOLD = 0xe8b75a, CRUSH_EDGE = 0x2a0a0c;
export const buildMoveIndicator = (opts) => {
  if (opts.isCrush) return DARK ? paintedMarker(opts, { main: CRUSH_GOLD, edge: CRUSH_EDGE, wash: 0.22, inner: true }) : woodSet.buildMoveIndicator(opts);
  return paintedMarker(opts, MARKER);
};
function paintedMarker({ cx, cz, hx, hz }, c) {
  const group = new THREE.Group();
  const mats = [], geos = [];
  const add = (geo, color, base, lift) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false });
    mat.userData.base = base;
    const m = new THREE.Mesh(geo, mat); m.position.y = lift;
    mats.push(mat); geos.push(geo); group.add(m);
  };
  const frame = (ix, iz, w) => {
    const pos = [], idx = [];
    const o = [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]], inn = [[-ix + w, -iz + w], [ix - w, -iz + w], [ix - w, iz - w], [-ix + w, iz - w]];
    for (let i = 0; i < 4; i++) {
      const p = o[i], q = o[(i + 1) % 4], r = inn[(i + 1) % 4], t = inn[i], v = i * 4;
      pos.push(p[0], 0, p[1], q[0], 0, q[1], r[0], 0, r[1], t[0], 0, t[1]);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return geo;
  };
  const wash = new THREE.PlaneGeometry(hx * 1.7, hz * 1.7); wash.rotateX(-Math.PI / 2);
  add(wash, c.main, c.wash, 0.0005);
  add(frame(hx * 0.92, hz * 0.92, 0.13), c.edge, 0.75, 0);
  add(frame(hx * 0.92 - 0.02, hz * 0.92 - 0.02, 0.09), c.main, 1, 0.001);
  if (c.inner) {
    add(frame(hx * 0.6, hz * 0.6, 0.09), c.edge, 0.75, 0);
    add(frame(hx * 0.6 - 0.015, hz * 0.6 - 0.015, 0.06), c.main, 1, 0.001);
  }
  group.position.set(cx, 0.03, cz);
  return {
    root: group,
    setOpacity(v) { mats.forEach((m) => { m.opacity = v * m.userData.base; }); },
    tick() {},
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}
export const buildMissingSquareVisual = woodSet.buildMissingSquareVisual;
export const buildBlackHoleVisual = woodSet.buildBlackHoleVisual;

/* The buttons and chips that stand for a side wear that side's wood, as
   in Tienda and the den (chassis: theme.sideSurface). */
export function sideSurface(side) {
  const dark = side === "dark";
  const url = woodSet.woodSwatch(dark);
  if (!url) return null;
  return dark
    ? { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyDark}`, color: "#F6EAD2", textShadow: "0 1px 1px rgba(18,9,3,0.9), 0 0 4px rgba(18,9,3,0.55)" }
    : { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyLight}`, color: "#23150A", textShadow: "0 0 2px rgba(255,246,228,0.95), 0 0 5px rgba(255,246,228,0.6)" };
}

/* ------------------------------------------------------------ sound and the scene */

// The reality's name, at the top of the info panel's This game tab; the
// same name as the Other realities menu (themes/realities.js WORLDS).
// (The look's own name, user: "Tá muid beo" or "Go deo na ndeor".)
export const realityName = lookTitle();
export { createAudio, hasAudio } from "./parrish-audio.js";
// The dock's sound button (and the phone menu) offers these, each on its
// own (chassis: theme.soundChannels): the place (with the opening and the
// close of "Orinoco Flow"), the pieces, and the look's soundtrack
// (parrish-audio.js).
export const soundChannels = [
  // (Both looks: the place, the opening and the close on the one slider;
  // no Music slider. User, Watermark then Orinoco.)
  EVENING_URL
    ? { key: "nature", label: "The evening", hint: "The wind in the trees, the opening and the close" }
    : { key: "nature", label: "The terrace", hint: HUMS_URL ? "The breeze, the birds, the pool, the opening and the close" : "The breeze, the birds, the pool" },
  ...(!EVENING_URL && !HUMS_URL && (MUSIC_URL || INTRO_URL) ? [{ key: "music", label: "Music", hint: MUSIC_URL ? "The recording" : "The opening" }] : []),
  { key: "pieces", label: "Pieces", hint: "The wood on the board" },
  // The look's soundtrack, its slider starting low (parrish-audio.js).
  ...(HUMS_URL ? [{ key: "hums", label: "Soundtrack", hint: SOUNDTRACK_TITLE, level: HUMS_LEVEL }] : []),
];
// The in-game menu offers a switch for the cost badges on the move
// markers (chassis: theme.moveCostToggle).
export const moveCostToggle = true;

export const mountAmbientEffects = createParrishEffects(woodSet, { quality });

/* No pre-game setup extras. */
export function renderSetupExtras() {
  return null;
}

/* The dock's floating piece is drawn by a renderer of its own, not through
   the paint; it gets a touch of the same life: its edges wander a little,
   redrawn eight times a second (an SVG turbulence whose seed steps). */
export function renderGlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true" focusable="false">
      <filter id="parrish-paint-edge" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="1" result="n">
          <animate attributeName="seed" values="1;2;3;4;5;6;7;8" dur="1s" calcMode="discrete" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/* ------------------------------------------------------------ the menus' look */

/* The dock, in the painter's words (chassis DOCK_WORDS). */
export const dockWords = {
  views: ["At the easel", "From above"],
  endGame: "Lay down the brush",
  newGame: "A fresh canvas",
  moveLog: "The sketchbook",
  plainRules: "The plain rules",
  nextGame: "Another canvas",
  endedCaption: "Left unfinished, for now.",
  wonCaption: "The last stroke. Well played.",
};

// The menus' shared pieces (styleSheet).
const PAPER = DARK ? MENU_PAINT_WATERMARK : MENU_PAINT_ORINOCO;
const STROKE = DARK ? { paint: STROKE_WATERMARK_PAINT, glaze: STROKE_WATERMARK_GLAZE } : { paint: STROKE_ORINOCO_PAINT, glaze: STROKE_ORINOCO_GLAZE };
// Four strokes of each (user: the buttons' paint "all too much the same"):
// a button takes one by its data-stroke (the gate's, fixed per button) or
// else by its place in its row. Pictures only, nothing runs.
const STROKES = DARK
  ? { paint: [STROKE_WATERMARK_PAINT, STROKE_WATERMARK_PAINT_1, STROKE_WATERMARK_PAINT_2, STROKE_WATERMARK_PAINT_3], glaze: [STROKE_WATERMARK_GLAZE, STROKE_WATERMARK_GLAZE_1, STROKE_WATERMARK_GLAZE_2, STROKE_WATERMARK_GLAZE_3] }
  : { paint: [STROKE_ORINOCO_PAINT, STROKE_ORINOCO_PAINT_1, STROKE_ORINOCO_PAINT_2, STROKE_ORINOCO_PAINT_3], glaze: [STROKE_ORINOCO_GLAZE, STROKE_ORINOCO_GLAZE_1, STROKE_ORINOCO_GLAZE_2, STROKE_ORINOCO_GLAZE_3] };
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
const GOLD = (a) => `rgba(${rgbOf(MENU.gold)}, ${a})`;
const PAINT = (a) => `rgba(${rgbOf(MENU.paint)}, ${a})`;
const PANELS = [
  '[data-testid="dock-panel"]', '[data-testid="sound-menu"]', '[data-testid="music-panel"]', '[data-testid="info-overlay"] > div',
  '[data-testid="movelog-sheet"]', '[data-testid="victory-placard"]', '[data-testid="new-game-choice"]', '[data-testid="piece-card"]',
  ".rg-choose", ".rg-sheet", ".rg-pick-box",
].join(", ");

export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap');
  html, body { overscroll-behavior: none; background: ${DARK ? "#140405" : "#3E7FA8"}; }
  /* The title: Roman capitals in gold leaf over the sky. */
  /* The masthead: the user's lettering, its outline exactly theirs (the
     mask), presented as paint laid into the picture: filled with the
     palette's own paint, lit faintly from the upper left as the strokes
     are, its paint moving a little eight times a second as the world's
     does, and held in the world's light (the glow round the heading). The
     words stay underneath for screen readers. */
  .ec-title, .ec-rules-title {
    display: inline-block; vertical-align: middle; width: 4.6em; height: calc(4.6em / 3.1504);
    overflow: hidden; white-space: nowrap; color: transparent !important; text-shadow: none !important;
    background:
      linear-gradient(158deg, rgba(255, 255, 255, ${DARK ? "0.1" : "0.16"}) 0%, rgba(255, 255, 255, 0) 42%, rgba(${DARK ? "40, 8, 10, 0.18" : "40, 50, 90, 0.12"}) 100%),
      url(${DARK ? TITLE_PAINT_WATERMARK : TITLE_PAINT_ORINOCO}) 0 0 / 130% auto;
    -webkit-mask: url(${TITLE_MASK}) center / contain no-repeat; mask: url(${TITLE_MASK}) center / contain no-repeat;
    animation: parrish-title-paint 2s steps(16) infinite;
    opacity: ${DARK ? 0.93 : 0.97};
  }
  /* In the corner during play, half as big again (user: the minimized
     badges "seem too small"): the lettering's thin lowercase script read
     smaller than the other worlds' capitals at the same size, and came
     out narrower too (74 px wide to their 94 on a phone). */
  .ec-masthead-relocated .ec-title { width: 6.9em; height: calc(6.9em / 3.1504); }
  /* The rules card's heading in the same lettering (user), not the
     shared serif capitals. */
  .ec-rules-title { width: 8em; height: calc(8em / 3.1504); }
  h2:has(> .ec-rules-title) { line-height: 0; }
  @keyframes parrish-title-paint { from { background-position: 0 0, 0% 20%; } to { background-position: 0 0, 22% 34%; } }
  h1:has(> .ec-title) {
    filter: ${DARK
      ? "drop-shadow(0 0.025em 0.04em rgba(18, 3, 5, 0.75)) drop-shadow(0 0 0.28em rgba(236, 196, 150, 0.16))"
      : "drop-shadow(0 0 0.02em rgba(255, 250, 238, 0.95)) drop-shadow(0 0 0.06em rgba(250, 244, 228, 0.6)) drop-shadow(0 0.04em 0.12em rgba(20, 30, 70, 0.25))"};
  }
  @media (prefers-reduced-motion: reduce) { .ec-title, .ec-rules-title { animation: none; } }
  /* End turn, over the painting (user: painted, the piece's own wood
     showing): the side's wood, cut to a brush stroke of its own. */
  /* (Undo move beside it the same: the side's wood, user; their marks
     tell them apart.) */
  [data-testid="stop-here-float"], [data-testid="undo-move-float"] {
    -webkit-mask: url(${BUTTON_STROKE}) center / 100% 100% no-repeat; mask: url(${BUTTON_STROKE}) center / 100% 100% no-repeat;
    border: none !important; border-radius: 0 !important; box-shadow: none !important; outline-offset: 4px;
    padding: 13px 24px 14px !important; min-height: 46px !important;
    font: 600 12px/1 'Cinzel', Georgia, serif !important; letter-spacing: 0.11em !important; text-transform: uppercase;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
  /* The dock's piece: its edges wander like paint (renderGlobalDefs). */
  canvas[data-testid="dock-piece-canvas"] { filter: url(#parrish-paint-edge); }
  @media (prefers-reduced-motion: reduce) { canvas[data-testid="dock-piece-canvas"] { filter: none; } }
  /* Over the painting: a scrap of ivory behind anything that floats on it. */
  button[aria-label$="full screen"] {
    background: rgba(244, 234, 213, 0.9) !important; color: ${PARRISH.blue} !important;
    border-radius: 999px !important; box-shadow: 0 2px 8px rgba(8, 14, 38, 0.4);
    width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important;
  }
  /* The page goes full screen at the first tap (the chassis, every
     theme), and that's how it's meant to be seen: the button then rests
     at 60%, out of the way (below). Out of full screen, by choice, it's
     at 70% (user). Its icon heavier; still gone when something covers
     the corner, quieter in focus mode. */
  button[aria-label$="full screen"][style*="visibility: visible"] { opacity: 0.7 !important; background: rgba(250, 243, 228, 0.97) !important; box-shadow: 0 0 0 1px rgba(29, 44, 94, 0.35), 0 2px 8px rgba(8, 14, 38, 0.45) !important; }
  button[aria-label$="full screen"][style*="visibility: visible"][data-dim="true"] { opacity: 0.5 !important; }
  /* In full screen the button is just its arrows, like the Other
     realities planet above it: no ivory disc, the planet's ink, the
     planet's strength (0.5, 0.25 in focus mode). User: the disc at 60%
     was "still way too bright" on the painting; chose icon only. The
     dock's piece in the other corner steps back to 60% in full screen
     (its 0.8 out of it, dockCornerOpacity; user: "40% transparent or 60%
     opaque"). Full on hover only with a mouse: on a phone a tap leaves
     the button "hovered", which kept it at full strength. */
  button[aria-label="Exit full screen"][style*="visibility: visible"] {
    opacity: 0.5 !important; background: transparent !important; box-shadow: none !important; color: ${MENU.ink} !important;
  }
  button[aria-label="Exit full screen"][style*="visibility: visible"][data-dim="true"] { opacity: 0.25 !important; }
  button[aria-label="Exit full screen"][style] svg { stroke-width: 1.8; width: 19px; height: 19px; }
  @media (hover: hover) and (pointer: fine) {
    button[aria-label$="full screen"][style*="visibility: visible"]:hover { opacity: 1 !important; }
  }
  :root:fullscreen [data-dock-piece][style*="opacity: 0.8"] { opacity: 0.6 !important; }
  button[aria-label$="full screen"] svg { stroke-width: 2.6; }
  /* ---------------------------------------------------------- the menus, painted
     (user: "all menus for Orinoco & Watermark must have theme appropriate
     artistic updates"). Every panel is a swatch of the palette's paint,
     laid in loose strokes (Orinoco: ivory, warm light and a breath of sky;
     Watermark: wine and madder over umber), its edge the dragged, ragged
     end of the brush, with a gold fillet inside it as on Parrish's prints.
     Buttons are single strokes of a loaded flat brush: the big ones in the
     palette's own paint (cobalt; Watermark's cream), the rest a thin glaze.
     Headings in Cinzel's Roman capitals, the words in Cormorant. Pictures:
     tools/parrish_menu_art.py. */
  ${PANELS} {
    background: linear-gradient(158deg, rgba(255, 255, 255, ${DARK ? "0.05" : "0.12"}), rgba(255, 255, 255, 0) 45%, ${MENU.shade.replace(/[\d.]+\)$/, DARK ? "0.18)" : "0.06)")}),
      url(${PAPER}) 0 0 / 512px repeat, ${MENU.paper} !important;
    color: ${MENU.ink} !important;
    border: none !important; border-radius: 0 !important; box-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    -webkit-mask-box-image: url(${MENU_EDGE}) 64 fill / 16px stretch;
    mask-border: url(${MENU_EDGE}) 64 fill / 16px stretch;
    outline: 1px solid ${GOLD(0.62)} !important; outline-offset: -9px !important;
  }
  :is(${PANELS}) :is(h1, h2, h3, h4) { font-family: 'Cinzel', Georgia, serif !important; font-weight: 700 !important; letter-spacing: 0.08em !important; color: ${MENU.ink} !important; }
  :is(${PANELS}) :is(div, span, p, li, label, td, th, output, small, strong, em, b, i, a) { font-family: 'Cormorant Garamond', Georgia, serif !important; }
  :is(${PANELS}) :is(button, [role="button"], select) { font-family: 'Cinzel', Georgia, serif !important; }
  :is(${PANELS}) hr { border: none !important; height: 1px !important; background: linear-gradient(90deg, transparent, ${GOLD(0.6)} 12%, ${GOLD(0.6)} 88%, transparent) !important; }
  :is(${PANELS}) input[type="range"] { accent-color: ${MENU.paint}; }
  :is(${PANELS}) ::-webkit-scrollbar { width: 8px; }
  :is(${PANELS}) ::-webkit-scrollbar-thumb { background: ${GOLD(0.45)}; border-radius: 4px; }
  [data-testid="dock-panel"]::-webkit-scrollbar, [data-testid="movelog-sheet"]::-webkit-scrollbar { width: 8px; }
  [data-testid="dock-panel"]::-webkit-scrollbar-thumb, [data-testid="movelog-sheet"]::-webkit-scrollbar-thumb { background: ${GOLD(0.45)}; border-radius: 4px; }
  /* The status line: lettered, not typed. */
  :is(${PANELS}) :is([data-testid="turn-status"], [data-testid="turn-status"] *) { font-family: 'Cinzel', Georgia, serif !important; letter-spacing: 0.08em !important; color: ${MENU.ink} !important; }

  /* Buttons: strokes of a loaded brush, painted BEHIND their words
     (border-image, user: the first try, a mask, cut the letters of the
     small ones, Easy / Medium / Hard): each stroke reaches a little past
     its button, so the words always sit in the paint. The quiet ones a
     glaze; a picked one, and the big ones (Begin Game, Play, Nova), the
     palette's own paint. The wooden side buttons keep their wood; icon
     buttons and the dock's links stay as they are. */
  /* (Not a picked one: its paint, below, has to win; user: picking a
     difficulty "nothing changes".) */
  :is(${PANELS}) .ec-btn:not([data-dock-role="link"]):not([data-dock-role="primary"]):not([data-dock-role="begin"]):not(:has(> svg)):not([style*="url("]):not([aria-pressed]):not([style*="rgb(${rgbOf(MENU.paint)})"]),
  .rg-seg button:not([aria-pressed="false"]), .rg-step button, .rg-btn, .rg-small {
    background: none !important; box-shadow: none !important; border-radius: 0 !important;
    border-style: solid !important; border-color: transparent !important;
    border-image: var(--pr-glaze, url(${STROKE.glaze})) 0 110 fill / 0 20px / 2px 7px stretch !important;
    -webkit-mask-box-image: none !important; mask-border: none !important;
    color: ${MENU.ink} !important;
    padding-left: max(16px, 1.1em) !important; padding-right: max(16px, 1.1em) !important;
  }
  :is(${PANELS}) .ec-btn:not([data-dock-role]):not(:has(> svg)) { font-size: 11px !important; letter-spacing: 0.1em !important; font-weight: 700 !important; }
  :is(${PANELS}) .ec-btn:not([data-dock-role="link"]):not([data-dock-role="primary"]):not([data-dock-role="begin"]):not(:has(> svg)):hover, .rg-seg button:hover, .rg-step button:hover, .rg-btn:hover, .rg-small:hover { filter: brightness(${DARK ? 1.12 : 0.96}) saturate(1.1); }
  :is(${PANELS}) .ec-btn[style*="rgb(${rgbOf(MENU.paint)})"]:not([data-dock-role="link"]):not(:has(> svg)):not([style*="url("]), :is(${PANELS}) .ec-btn[aria-pressed="true"]:not([data-dock-role="link"]):not(:has(> svg)):not([style*="url("]),
  [data-dock-role="primary"], [data-dock-role="begin"], .rg-seg button[aria-pressed="true"], .rg-btn.go {
    background: none !important; box-shadow: none !important; border-radius: 0 !important;
    border-style: solid !important; border-color: transparent !important;
    border-image: var(--pr-paint, url(${STROKE.paint})) 0 110 fill / 0 22px / 2px 8px stretch !important;
    -webkit-mask-box-image: none !important; mask-border: none !important;
    color: ${MENU.paintInk} !important;
  }
  /* A choice not picked: its words only, quieter, over a thin dry line of
     the glaze so it still reads as something to tap (user: with both
     painted "it's hard to know which one is currently selected"). Only
     the picked one carries paint. */
  :is(${PANELS}) .ec-btn[aria-pressed="false"]:not(:has(> svg)):not([style*="url("]):not([style*="rgb(${rgbOf(MENU.paint)})"]), .rg-seg button[aria-pressed="false"] {
    border-image: none !important; -webkit-mask-box-image: none !important; mask-border: none !important;
    border-style: solid !important; border-color: transparent !important; border-radius: 0 !important; box-shadow: none !important;
    background: var(--pr-glaze, url(${STROKE.glaze})) center calc(100% - 5px) / 62% 5px no-repeat !important;
    color: ${MENU.muted} !important; text-shadow: none !important;
  }
  :is(${PANELS}) .ec-btn[aria-pressed="false"]:not(:has(> svg)):hover, .rg-seg button[aria-pressed="false"]:hover { color: ${MENU.ink} !important; background-size: 80% 6px !important; filter: none !important; }
  /* Which stroke: the gate's buttons say (data-stroke); the dock's go by
     their place in the row. */
  [data-stroke="1"], :is(${PANELS}) .ec-btn:not([data-stroke]):nth-child(4n+2) { --pr-paint: url(${STROKES.paint[1]}); --pr-glaze: url(${STROKES.glaze[1]}); }
  [data-stroke="2"], :is(${PANELS}) .ec-btn:not([data-stroke]):nth-child(4n+3) { --pr-paint: url(${STROKES.paint[2]}); --pr-glaze: url(${STROKES.glaze[2]}); }
  [data-stroke="3"], :is(${PANELS}) .ec-btn:not([data-stroke]):nth-child(4n+4) { --pr-paint: url(${STROKES.paint[3]}); --pr-glaze: url(${STROKES.glaze[3]}); }
  /* Icon buttons (Back): a faint gold square, no chassis box. */
  :is(${PANELS}) .ec-btn:has(> svg) { border-color: ${GOLD(0.4)} !important; background: none !important; color: ${MENU.ink} !important; border-radius: 0 !important; }
  /* The win's card: its New Game a stroke of the palette's paint too (the
     chassis gives it the winner's wood). */
  [data-testid="victory-placard"] .ec-btn[style*="url("] {
    background: none !important; box-shadow: none !important; border-radius: 0 !important; text-shadow: none !important;
    border-style: solid !important; border-color: transparent !important;
    border-image: var(--pr-paint, url(${STROKE.paint})) 0 110 fill / 0 22px / 2px 8px stretch !important;
    color: ${MENU.paintInk} !important; font-family: 'Cinzel', Georgia, serif !important; font-weight: 700 !important;
  }
  /* Small ones (8×8, the steppers): shorter ends. */
  .rg-seg button, .rg-step button, .rg-small { border-image-width: 0 10px !important; border-image-outset: 1px 3px !important; padding-left: 12px !important; padding-right: 12px !important; }
  .rg-step button { padding: 0 !important; }
  /* Easy's stroke clear of the arrow (user: the word and Easy ran
     together when the word stood there): a stroke reaches 7px past its
     button, past the row's gap. The word itself sits over the three
     (diffLabelAbove). */
  :is(${PANELS}) [data-ec-diff-group] { margin-left: 8px; }
  /* The sheet's choices bigger (user: "Computer plays Dark / Light" ran
     out of their strokes when the words took two lines): room above and
     below the words, so the stroke, stretched to the button, covers both
     lines; and on a narrow screen "How well it plays" above its three,
     not squeezed beside them. */
  .rg-seg button { min-height: 46px !important; padding: 11px 16px !important; line-height: 1.2 !important; border-image-outset: 4px 4px !important; }
  /* Who's playing: taller again (user: "Computer plays Walnut (dark)" on
     two lines wants more room in its stroke). */
  .rg-seg.rg-opp button { min-height: 66px !important; padding: 15px 18px !important; }
  @media (max-width: 560px) { .rg-sec .rg-row:has(> .rg-seg) { grid-template-columns: minmax(0, 1fr); row-gap: 6px; } }
  /* The camera views: two strokes side by side, no box round them. */
  :is(${PANELS}) [data-dock-role="views"] { border: none !important; border-radius: 0 !important; overflow: visible !important; gap: 10px; }
  /* The status line ("Dark to move"): a broad stroke of glaze, no box. */
  :is(${PANELS}) div:has(> [data-testid="turn-status"]) {
    background: none !important; border-style: solid !important; border-color: transparent !important; border-radius: 0 !important;
    border-image: url(${STROKE.glaze}) 0 110 fill / 0 28px / 3px 4px stretch !important;
  }
  /* The dock's icons: lettered in the gold of the captions. */
  :is(${PANELS}) :is([data-testid="sound-button"], [data-testid="points-toggle"], [data-testid="costs-toggle"], [data-testid="guide-toggle"]) { color: ${DARK ? "#E2B36E" : "#8A5A1E"} !important; }
  /* The gate's two big choices: swatches of paint, ragged all round. */
  .rg-big { border: none !important; border-radius: 0 !important; box-shadow: none !important; color: ${MENU.ink} !important;
    background: linear-gradient(${MENU.glaze}, ${MENU.glaze}) !important;
    -webkit-mask-box-image: url(${MENU_EDGE}) 64 fill / 13px stretch !important; mask-border: url(${MENU_EDGE}) 64 fill / 13px stretch !important; }
  .rg-big.rg-nova { color: ${MENU.paintInk} !important;
    background: linear-gradient(170deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.1)), linear-gradient(${PAINT(0.9)}, ${PAINT(0.9)}), url(${PAPER}) 0 0 / 512px, ${MENU.paint} !important; }
  .rg-big:hover { filter: brightness(${DARK ? 1.1 : 0.97}); }
  /* The dock's big button (chassis DOCK_WORDS) and Begin Game: broad
     strokes, gold-lettered on Orinoco's cobalt, wine-lettered on
     Watermark's cream. */
  [data-dock-role="primary"], [data-dock-role="begin"] { font-family: 'Cinzel', Georgia, serif !important; font-weight: 700 !important; font-size: 15px !important;
    letter-spacing: 0.16em !important; text-transform: uppercase !important; color: ${DARK ? MENU.paintInk : "#F2D293"} !important; text-shadow: none !important;
    padding: 14px 30px !important; }
  [data-dock-role="primary"]:hover, [data-dock-role="begin"]:hover { filter: brightness(${DARK ? 1.05 : 1.15}); }
  [data-dock-role="primary"]:active, [data-dock-role="begin"]:active { transform: translateY(1px); }
  [data-dock-role="caption"] { font-family: 'Cormorant Garamond', Georgia, serif !important; font-style: italic !important; font-weight: 600 !important;
    font-size: 17px !important; color: ${DARK ? "#E2B36E" : "#8A5A1E"} !important; letter-spacing: 0.01em; }
  :is(${PANELS}) [style*="text-decoration: underline"] { font-family: 'Cinzel', Georgia, serif !important; text-decoration-color: ${GOLD(0.7)} !important; color: ${MENU.ink} !important; }

  /* The rules: a print, matted. */
  [data-testid="info-overlay"] > div { outline-offset: -11px !important; box-shadow: inset 0 0 0 14px transparent, inset 0 0 0 15px rgba(${MENU.mutedRgb}, 0.35) !important; }
  [data-testid="info-overlay"] [data-testid="info-body"] {
    margin-bottom: 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
  }
  [data-testid="info-overlay"] [role="tab"], [data-testid="info-overlay"] [role="tablist"] button { font-family: 'Cinzel', Georgia, serif !important; letter-spacing: 0.08em !important; }
  [data-testid="info-overlay"] [role="tab"][aria-selected="true"] { color: ${MENU.ink} !important; border-color: ${GOLD(0.9)} !important; }

  /* The piece card: a small swatch, its fillet closer to the edge. */
  [data-testid="piece-card"] { padding: 12px 18px 13px !important; outline-offset: -6px !important; }
  /* Little scraps of the same paint over the painting. */
  [data-testid="points-counter"], [data-testid="unused-points-note"] {
    color: ${MENU.ink} !important; background: url(${PAPER}) 0 0 / 512px, ${MENU.paper} !important; padding: 6px 24px !important; border-radius: 0 !important;
    -webkit-mask-box-image: url(${MENU_BRUSH}) 0 96 fill / 0 18px stretch; mask-border: url(${MENU_BRUSH}) 0 96 fill / 0 18px stretch;
    font-family: 'Cinzel', Georgia, serif !important; letter-spacing: 0.06em; box-shadow: none !important;
  }
  [data-testid="points-counter"] *, [data-testid="unused-points-note"] * { font-family: inherit !important; }
  /* The counter smaller and quieter (user: "a bit too jarring", its
     words not fitting the paper): a narrow scrap, small type, smaller
     beads with a closer glow. */
  /* No paper behind it (user: "I like it more without the paper, like
     in Watermark"): the words and beads straight on the painting, a
     soft halo of the ground's own light keeping the words legible. */
  [data-testid="points-counter"] { font-size: 9.5px !important; letter-spacing: 0.1em !important; gap: 8px !important; padding: 5px 18px !important; opacity: 0.92;
    background: none !important; -webkit-mask-box-image: none !important; mask-border: none !important;
    text-shadow: 0 0 6px ${DARK ? "rgba(20, 4, 6, 0.9)" : "rgba(235, 244, 252, 0.95)"}, 0 0 2px ${DARK ? "rgba(20, 4, 6, 0.9)" : "rgba(235, 244, 252, 0.95)"}; }
  [data-testid="points-counter"] > span:last-of-type { gap: 6px !important; }
  [data-testid="points-counter"] [data-filled] { width: 10px !important; height: 10px !important; }
  [data-testid="points-counter"] [data-filled="true"] { animation: none !important; box-shadow: 0 0 0 1px color-mix(in srgb, var(--ec-ember) 50%, black), 0 0 4px 1px color-mix(in srgb, var(--ec-ember) 70%, transparent) !important; }

  /* The gate (Standard / Nova) and the Nova sheet: the palette's tokens,
     the same paint (themes/reality-gate.js). */
  .rg-layer {
    --rg-backdrop: ${DARK ? "rgba(14, 3, 5, 0.55)" : "rgba(8, 14, 38, 0.45)"} !important;
    --rg-surface: ${MENU.paper} !important; --rg-ink: ${MENU.ink} !important; --rg-muted: ${MENU.muted} !important;
    --rg-accent: ${MENU.paint} !important; --rg-accent-ink: ${MENU.paintInk} !important;
    --rg-line: ${GOLD(0.55)} !important; --rg-radius: 0px !important; --rg-shadow: none !important;
    --rg-cell-a: ${DARK ? "#E3CB98" : "#E8B75A"} !important; --rg-cell-b: ${DARK ? "#6E1E22" : "#2348A8"} !important;
  }
  .rg-choose { padding: 28px 26px 20px !important; gap: 14px !important; }
  .rg-big { padding: 18px 26px !important; min-height: 88px !important; }
  .rg-big:hover { transform: translateY(-1px); box-shadow: none !important; }
  .rg-big-t { font-family: 'Cinzel', Georgia, serif !important; }
  .rg-big-s { font-family: 'Cormorant Garamond', Georgia, serif !important; font-size: 16px !important; font-weight: 600 !important; }
  .rg-kicker, .rg-sec h3, .rg-side { font-family: 'Cinzel', Georgia, serif !important; color: ${DARK ? "#E2B36E" : "#8A5A1E"} !important; }
  .rg-link { font-family: 'Cormorant Garamond', Georgia, serif !important; font-style: italic; font-size: 17px !important; text-decoration-color: ${GOLD(0.7)} !important; color: ${MENU.ink} !important; }
  .rg-sheet { padding: 6px 4px 0; }
  .rg-head, .rg-foot { border-color: ${GOLD(0.45)} !important; }
  .rg-foot { background: transparent !important; padding-bottom: max(18px, env(safe-area-inset-bottom)) !important; }
  .rg-sec { border-bottom: none !important; background: linear-gradient(90deg, transparent, ${GOLD(0.45)} 15%, ${GOLD(0.45)} 85%, transparent) bottom / 100% 1px no-repeat; }
  .rg-step button { padding: 0 !important; width: 46px !important; }
  .rg-switch { background-image: linear-gradient(${MENU.glaze}, ${MENU.glaze}) !important; border-color: ${GOLD(0.6)} !important; }
  .rg-switch[aria-checked="true"] { background: ${MENU.paint} !important; border-color: ${MENU.paint} !important; }
  .rg-pic { background: radial-gradient(ellipse at 50% 60%, ${GOLD(0.22)}, transparent 70%) !important; }
  .rg-grid { border-color: ${GOLD(0.8)} !important; }

  /* Other realities, from here: the painting's own dusk behind the cards,
     each card a print in a gold frame. */
  .ec-realities {
    background: radial-gradient(ellipse at 50% 30%, ${DARK ? "rgba(74, 22, 27, 0.8), rgba(14, 3, 5, 0.96)" : "rgba(43, 72, 140, 0.78), rgba(8, 14, 38, 0.95)"} 72%) !important;
    color: ${DARK ? "#F1E2C4" : "#F4EAD5"} !important; font-family: 'Cormorant Garamond', Georgia, serif !important; font-size: 17px !important;
  }
  .ec-realities h2 { font-family: 'Cinzel', Georgia, serif !important; font-weight: 600 !important; letter-spacing: 0.22em !important; color: #F2D293 !important; }
  .ec-realities p.sub { font-style: italic; }
  .ec-realities li button { border: 1px solid ${GOLD(0.55)} !important; border-radius: 0 !important; background: ${DARK ? "rgba(58, 15, 20, 0.85)" : "rgba(16, 26, 62, 0.8)"} !important;
    box-shadow: inset 0 0 0 3px ${DARK ? "rgba(58, 15, 20, 0.85)" : "rgba(16, 26, 62, 0.8)"}, inset 0 0 0 4px ${GOLD(0.3)} !important; padding: 6px !important; }
  .ec-realities li button:hover, .ec-realities li button:focus-visible { border-color: ${GOLD(1)} !important; box-shadow: inset 0 0 0 3px transparent, inset 0 0 0 4px ${GOLD(0.5)}, 0 0 24px ${GOLD(0.35)} !important; }
  .ec-realities li button:focus-visible { outline-color: #F2D293 !important; }
  .ec-realities .name { font-family: 'Cinzel', Georgia, serif !important; color: #F2D293; }
  .ec-realities .here { color: #E8B75A !important; font-family: 'Cinzel', Georgia, serif !important; }
  .ec-realities .hold { background: ${GOLD(0.2)} !important; }
  .ec-realities .hold i { background: ${GOLD(0.85)} !important; }
  .ec-realities .restart { border-color: ${GOLD(0.45)} !important; border-radius: 0 !important; font-family: 'Cinzel', Georgia, serif !important; }
  .ec-realities .restart:hover, .ec-realities .restart:focus-visible { background: ${GOLD(0.12)} !important; }
`;

/* What the two sides are called here (user; themes/side-names.js). */
import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("parrish");
// The points counter's embers (points-glow.js), the look's own.
export const pointsGlow = pointsGlowFor(DARK ? "parrish-watermark" : "parrish-orinoco");
/* The dock's "Difficulty" over Easy, Medium and Hard, so the three fit
   beside the arrow on a phone (user: the word above, "kind of like the
   umbrella for those three"). */
export const diffLabelAbove = true;
