/* Parrish theme: an oil painting in motion, at the golden hour.

   The user's brief: live footage of the pieces and the board, of nature,
   and of imagery after Maxfield Parrish, edited and animated through
   rotoscoping and stop-motion so that it moves like an oil painting.

   The "footage" is the live scene: the store's wooden set
   (themes/wood-set.js) on a marble plinth in a reflecting pool, on a
   terrace at the golden hour, a colonnade behind it, urns of flowers,
   great trees, a valley, blue mountains with the sun on their snow, gold
   and peach cumulus, and over everything Parrish's cobalt
   (themes/parrish-scene.js). Every frame of it is painted over as oil on
   canvas before it reaches the screen (themes/parrish-paint.js): the
   colours laid along the brush's flow, broad and fine dabs with their
   bristles and raised paint, a broken umber outline, the canvas's weave.
   Two ways of moving (?motion=boil|stop): the strokes boil, repainted
   twelve times a second over smooth motion, or the whole picture is
   stop-motion, a new painting twelve times a second.

   The menus are a fine art print's: ivory stock, Parrish-blue ink, the
   title in Roman capitals (Cinzel) as on his calendars and posters, the
   rest in Cormorant Garamond, gold for the accents. The sound is the
   terrace's own (themes/parrish-audio.js), with a place for the user's
   recording. */

import { quality } from "./tienda-quality.js";
import { createWoodSet, EDGE_RADIUS as SET_EDGE_RADIUS, OUTLINE_Y_OFFSET } from "./wood-set.js";
import { parrishEnv, createParrishEffects } from "./parrish-scene.js";
import { MUSIC_URL } from "./parrish-audio.js";

/* ------------------------------------------------------------ the palette */

// The painter's colours: his blue, the light's gold, ivory marble, umber.
export const PARRISH = {
  blue: "#1D2C5E",      // the ink: the deep of his skies
  cobalt: "#2348A8",
  azure: "#5B8FD8",
  gold: "#C9963B",
  amber: "#E8B75A",
  peach: "#F2C5A0",
  ivory: "#F4EAD5",
  marble: "#EADCC0",
  umber: "#5A3A22",
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
export const titleFontFamily = "'Cinzel', 'Trajan Pro', Georgia, serif";
export const mastheadScale = 0.9; // Cinzel's capitals run wide
// The dock's piece, in the corner during a game: enough of it to see
// against the terrace.
export const dockCornerOpacity = 0.6;
// The camera a little lower than the default (0.86), so the colonnade and
// the pool's sky show behind the board; lower again on a tall screen.
export const viewPitch = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25 ? 1.1 : 1.04;

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
export const canvasGradientStart = "#2348A8";
export const canvasGradientEnd = "#0E1A3D";

/* The golden hour: a warm low sun (the key, moved each frame to where the
   painted sun is: parrish-scene.js), the blue sky over everything (the
   hemisphere), a cool fill from the sky's side, a peach back light. */
export const lights = {
  ambient: { color: 0xfff1dc, intensity: 0.08 },
  hemi: { sky: 0x8fb0ff, ground: 0xc9a070, intensity: 0.5 },
  key: { color: 0xffd9a0, intensity: 1.2 },
  fill: { color: 0x9db8ff, intensity: 0.35 },
  back: { color: 0xffb38a, intensity: 0.35 },
};

/* ------------------------------------------------------------ the set */

/* The board, the blocks, the move markers and the board's features are
   the store's copy (themes/wood-set.js), reflecting the terrace. */
export const woodSet = createWoodSet({ env: parrishEnv, quality, lights });
// The squares are painted into the board's texture, so the chassis paints
// it again when the board changes size.
export const boardTextureFollowsSize = true;
export const makeBoardTexture = woodSet.makeBoardTexture;
export const buildSlabMaterials = woodSet.buildSlabMaterials;
export const makeGrid = woodSet.makeGrid;
export const buildPieceVisual = woodSet.buildPieceVisual;
export const buildMoveIndicator = woodSet.buildMoveIndicator;
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
   redrawn twelve times a second (an SVG turbulence whose seed steps). */
export function renderGlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true" focusable="false">
      <filter id="parrish-paint-edge" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="1" result="n">
          <animate attributeName="seed" values="1;2;3;4;5;6;7;8;9;10;11;12" dur="1s" calcMode="discrete" repeatCount="indefinite" />
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
  html, body { overscroll-behavior: none; background: #0E1A3D; }
  /* The title: Roman capitals in gold leaf over the sky. */
  .ec-title {
    background: linear-gradient(180deg, #FFF3D6 0%, #F2D293 46%, #C9963B 58%, #F6E2B0 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent !important;
    font-weight: 700 !important; letter-spacing: 0.08em;
    filter: drop-shadow(0 2px 0 rgba(14, 26, 61, 0.55)) drop-shadow(0 0 14px rgba(255, 196, 120, 0.35));
  }
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
