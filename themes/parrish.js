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
import { MUSIC_URL } from "./parrish-audio.js";
import { look, lookName } from "./parrish-looks.js";
// The user's "el cabeza" lettering, its outline traced exactly from their
// artwork (a mask: never redrawn), and the paint that fills it, one for
// each palette.
import TITLE_MASK from "../assets/parrish/title-mask.webp";
import TITLE_PAINT_ORINOCO from "../assets/parrish/title-paint-orinoco.webp";
import TITLE_PAINT_WATERMARK from "../assets/parrish/title-paint-watermark.webp";

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

export const COLORS = {
  // The menus: ivory print stock, Parrish-blue ink.
  cream: PARRISH.ivory,
  creamAlt: PARRISH.marble,
  charcoal: PARRISH.blue,
  slate: "#5A6A9A",
  slateSoft: "rgba(90, 106, 154, 0.30)",
  slateFaint: "rgba(90, 106, 154, 0.10)",
  pageBg: "#0E1A3D",
  pageBgDeep: "#081128",
  // The pieces: the set's walnut for Dark, olive ash for Light.
  bodyDark: "#4A2C1C",
  bodyLight: "#D9B77E",
};

// Roman capitals, as Parrish lettered his calendars.
// The menus' headings in Cinzel; the masthead is the user's own lettering
// of "el cabeza" (styleSheet below).
export const titleFontFamily = "'Cinzel', 'Trajan Pro', Georgia, serif";
export const mastheadScale = 1;
// The dock's piece, in the corner during a game: enough of it to see
// against the terrace.
export const dockCornerOpacity = 0.6;
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

export const modalBackdrop = "rgba(8, 14, 38, 0.55)";
export const modalSurface = "rgba(246, 236, 214, 0.98)";
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
// The move markers: in Orinoco, one of the painting's own lighter blues
// (user: the beige ones were hard to tell from the board), on a wider band
// than the set's and with a faint wash of the blue across the square, so
// they hold up through the paint; the dark edge under them as the set has
// it. A capture's marker, and Watermark's, stay the set's own.
const MARKER_BLUE = 0x5fa2f0, MARKER_EDGE = 0x1f2f58;
export const buildMoveIndicator = (opts) => {
  if (DARK || opts.isCrush) return woodSet.buildMoveIndicator(opts);
  const { cx, cz, hx, hz } = opts;
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
  add(wash, MARKER_BLUE, 0.34, 0.0005);
  add(frame(hx * 0.92, hz * 0.92, 0.13), MARKER_EDGE, 0.75, 0);
  add(frame(hx * 0.92 - 0.02, hz * 0.92 - 0.02, 0.09), MARKER_BLUE, 1, 0.001);
  group.position.set(cx, 0.03, cz);
  return {
    root: group,
    setOpacity(v) { mats.forEach((m) => { m.opacity = v * m.userData.base; }); },
    tick() {},
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
};
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
export const realityName = "Parrish";
export { createAudio, hasAudio } from "./parrish-audio.js";
// The dock's sound button (and the phone menu) offers these, each on its
// own (chassis: theme.soundChannels). The music only once the user's
// recording is in (parrish-audio.js MUSIC_URL): no slider for nothing.
export const soundChannels = [
  { key: "nature", label: "The terrace", hint: "The breeze, the birds, the pool" },
  ...(MUSIC_URL ? [{ key: "music", label: "Music", hint: "The recording" }] : []),
  { key: "pieces", label: "Pieces", hint: "The wood on the board" },
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
  .ec-title {
    display: inline-block; vertical-align: middle; width: 4.6em; height: calc(4.6em / 3.1504);
    overflow: hidden; white-space: nowrap; color: transparent !important; text-shadow: none !important;
    background:
      linear-gradient(158deg, rgba(255, 255, 255, ${DARK ? "0.1" : "0.16"}) 0%, rgba(255, 255, 255, 0) 42%, rgba(${DARK ? "40, 8, 10, 0.18" : "40, 50, 90, 0.12"}) 100%),
      url(${DARK ? TITLE_PAINT_WATERMARK : TITLE_PAINT_ORINOCO}) 0 0 / 130% auto;
    -webkit-mask: url(${TITLE_MASK}) center / contain no-repeat; mask: url(${TITLE_MASK}) center / contain no-repeat;
    animation: parrish-title-paint 2s steps(16) infinite;
    opacity: ${DARK ? 0.93 : 0.97};
  }
  @keyframes parrish-title-paint { from { background-position: 0 0, 0% 20%; } to { background-position: 0 0, 22% 34%; } }
  h1:has(> .ec-title) {
    filter: ${DARK
      ? "drop-shadow(0 0.025em 0.04em rgba(18, 3, 5, 0.75)) drop-shadow(0 0 0.28em rgba(236, 196, 150, 0.16))"
      : "drop-shadow(0 0 0.02em rgba(255, 250, 238, 0.95)) drop-shadow(0 0 0.06em rgba(250, 244, 228, 0.6)) drop-shadow(0 0.04em 0.12em rgba(20, 30, 70, 0.25))"};
  }
  @media (prefers-reduced-motion: reduce) { .ec-title { animation: none; } }
  /* The dock's piece: its edges wander like paint (renderGlobalDefs). */
  canvas[data-testid="dock-piece-canvas"] { filter: url(#parrish-paint-edge); }
  @media (prefers-reduced-motion: reduce) { canvas[data-testid="dock-piece-canvas"] { filter: none; } }
  [data-testid="dock-panel"] {
    background-color: ${PARRISH.ivory} !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(201, 150, 59, 0.55) !important;
    box-shadow: inset 0 0 0 3px ${PARRISH.ivory}, inset 0 0 0 4px rgba(29, 44, 94, 0.25), 0 14px 34px rgba(8, 14, 38, 0.5) !important;
  }
  /* Over the painting: a scrap of ivory behind anything that floats on it. */
  button[aria-label$="full screen"] {
    background: rgba(244, 234, 213, 0.9) !important; color: ${PARRISH.blue} !important;
    border-radius: 999px !important; box-shadow: 0 2px 8px rgba(8, 14, 38, 0.4);
    width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important;
  }
  /* Fully there (user: the chassis's faint 0.22, then 0.7, weren't
     enough), its icon heavier; still gone when something covers the
     corner, a little quieter in focus mode. */
  button[aria-label$="full screen"][style*="visibility: visible"] { opacity: 1 !important; background: rgba(250, 243, 228, 0.97) !important; box-shadow: 0 0 0 1px rgba(29, 44, 94, 0.35), 0 2px 8px rgba(8, 14, 38, 0.45) !important; }
  button[aria-label$="full screen"][style*="visibility: visible"][data-dim="true"] { opacity: 0.6 !important; }
  button[aria-label$="full screen"] svg { stroke-width: 2.6; }
  [data-testid="points-counter"] {
    color: ${PARRISH.blue} !important; background: rgba(244, 234, 213, 0.92); padding: 5px 12px 5px 13px; border-radius: 999px;
    box-shadow: 0 2px 8px rgba(8, 14, 38, 0.4);
  }
  [data-testid="unused-points-note"] {
    color: ${PARRISH.blue} !important; background: rgba(244, 234, 213, 0.94); padding: 6px 12px; border-radius: 999px;
  }
  /* The rules: a print on its mat, a gold fillet and a blue keyline. */
  [data-testid="info-overlay"] > div {
    background: #F6ECD6 !important;
    border: none !important; border-radius: 2px !important;
    box-shadow: inset 0 0 0 8px #F6ECD6, inset 0 0 0 9px rgba(201, 150, 59, 0.85), inset 0 0 0 12px #F6ECD6, inset 0 0 0 13px rgba(29, 44, 94, 0.35), 0 24px 60px rgba(8, 14, 38, 0.55) !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  [data-testid="info-overlay"] h2 {
    font-family: 'Cinzel', Georgia, serif !important; font-weight: 700 !important; letter-spacing: 0.08em;
  }
  [data-testid="info-overlay"] [data-testid="info-body"] {
    margin-bottom: 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
  }
  [data-testid="movelog-sheet"], [data-testid="victory-placard"], [data-testid="new-game-choice"] {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }

  /* The dock by the moment (chassis DOCK_WORDS): the big button in
     Parrish blue with gold capitals, a fine gold rule inside it. */
  [data-dock-role="primary"] { font-family: 'Cinzel', Georgia, serif !important; font-weight: 700 !important; font-size: 15px !important;
    letter-spacing: 0.16em !important; text-transform: uppercase !important; color: #F2D293 !important;
    background: linear-gradient(180deg, #2A4290 0%, ${PARRISH.blue} 100%) !important; border: 1px solid ${PARRISH.gold} !important; border-radius: 2px !important;
    box-shadow: inset 0 0 0 3px ${PARRISH.blue}, inset 0 0 0 4px rgba(232, 183, 90, 0.6), 0 6px 16px rgba(8, 14, 38, 0.4) !important; padding: 12px 18px !important; }
  [data-dock-role="primary"]:active { transform: translateY(1px); }
  [data-dock-role="caption"] { font-family: 'Cormorant Garamond', Georgia, serif !important; font-style: italic !important; font-weight: 600 !important;
    font-size: 17px !important; color: #8A5A1E !important; letter-spacing: 0.01em; }
`;
