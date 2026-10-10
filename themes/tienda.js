/* Tienda theme: a discount department store, a weeknight in the fall of
   1975, about half past seven.

   The board is a demonstration set on a table in the store's center
   court, where the two main aisles cross: a folding hardwood board,
   walnut and maple squares under a lacquer finish, brass clasps on the
   frame, and hand-finished wooden blocks (walnut for Dark, olive ash for
   Light). Around it is the store itself (themes/tienda-store.js): vinyl
   tile, a drop ceiling of fluorescent troffers, shelving running off in
   four directions, printed department signs, a wall of television sets,
   checkout lanes up front with one register open. There are almost no
   customers. Ceiling speakers play instrumental arrangements
   (themes/tienda-audio.js).

   The look is meant to be ordinary, not retro: mass-produced materials,
   flat fluorescent light, colours that are slightly dirty and faded. The
   menus are printed matter of the period (a box lid, a catalog order
   form, register tape), not screens.

   Plugs into the shared chassis like Cromo and Lluvia: board, grid,
   pieces and move markers through the usual hooks; the store, its
   lights and the period menus from mountAmbientEffects
   (themes/tienda-fx.js) and renderExtraOverlays
   (themes/tienda-overlay.js). */

import React from "react";
import * as THREE from "three";
import { quality } from "./tienda-quality.js";
import { createWoodSet, paintWood as setPaintWood, WOODS as SET_WOODS, EDGE_RADIUS as SET_EDGE_RADIUS, OUTLINE_Y_OFFSET } from "./wood-set.js";
import { createAudio as createStoreAudio } from "./tienda-audio.js";

/* ------------------------------------------------------------ period palette */

/* The colours of the place: appliance and upholstery colours of the
   time, the paper and paint of a store, all a little faded. Everything
   else in the theme takes its colours from here. */
export const PERIOD = {
  chocolate: "#3B2618",
  brown: "#5A3E2B",
  walnut: "#5C3A21",
  tobacco: "#7A5230",
  rust: "#9C4A26",
  burntOrange: "#C0632C",
  harvestGold: "#D3A13B",
  mustard: "#C9A227",
  avocado: "#6B7536",
  olive: "#5E6130",
  institutionalGreen: "#A3B79B",
  dustyBlue: "#7D95A6",
  mutedTeal: "#4E7C78",
  vinylRed: "#A33F33",
  beige: "#D8C6A5",
  tan: "#BFA27A",
  grayBeige: "#B8AE9C",
  cream: "#EFE4CB",
  offWhite: "#F0EADB",
  paper: "#EDE3C9",
  ink: "#2E2118",
};

export const COLORS = {
  // The menus are paper: cream stock, brown ink.
  cream: "#ECE1C6",
  creamAlt: "#E2D5B5",
  charcoal: PERIOD.ink,
  slate: "#6E5D4A",
  slateSoft: "rgba(110, 93, 74, 0.30)",
  slateFaint: "rgba(110, 93, 74, 0.10)",
  pageBg: "#2B2219",
  pageBgDeep: "#1A140F",
  // Player colours: a harvest-gold sticker for Dark, a cream one for
  // Light (the cost badges and the points counter use them).
  accentDark: PERIOD.harvestGold,
  accentLight: "#F3E8CF",
  accentDanger: PERIOD.vinylRed,
  bodyDark: "#4A2C1C",
  bodyLight: "#D9B77E",
  inkOnAccent: PERIOD.ink,
};

// The rules leaflet is a newspaper circular (see styleSheet): black ink
// and one spot red on newsprint.
const NEWS = { paper: "#E2D8BD", ink: "#28231F", red: "#A8321F", redInk: "#B0382A" };
export const rulesColors = { accentDark: NEWS.red, charcoal: NEWS.ink, slate: "#5A5046", slateSoft: "rgba(60,48,36,0.28)" };

// The title is set like the game's own advertising: a high-contrast
// serif, all capitals.
export const titleFontFamily = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";
export const mastheadScale = 0.56;
// The camera looks a little lower than the other themes' (0.86), so the
// store shows behind the table.
// On a tall, narrow screen the board sits farther off to fit its width,
// so the camera tips a little further again to keep the store in view.
export const viewPitch = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25 ? 1.12 : 1.04;

export const HEX = {
  cream: 0xece1c6,
  charcoal: 0x2a1a10, // the slab's edge lines and top ring: the board's dark edge
  slate: 0x6e5d4a,
  pieceLight: 0xd9b77e,
  pieceDark: 0x4a2c1c,
  // Pivot arrows and similar accents the chassis colours per side.
  glowCyan: 0xd3a13b,
  glowAmber: 0xf3e8cf,
  structureEdge: 0xd3a13b,
};

export const EDGE_RADIUS = SET_EDGE_RADIUS;
// The shell's at-rest lift, stripped before a roll (wood-set.js SHELL_LIFT).
export const outlineYOffset = OUTLINE_Y_OFFSET;
// The extras (pieces past the five, laws, the board's cuts) wait for the
// Singularity's first visit (engine/journey.js): the rules cards and the
// order form offer the classic game until then.
export const lockExtrasUntilSingularity = true;
// No "This game" tab in the rules in the store (user).
export const rulesTabsHidden = ["game"];
// The store to look round (as the den): closer zoom, further out (far
// enough to go round the advertisement's stand and see it from behind),
// and the camera may wander off the board into the aisles (chassis:
// theme.freeCamera).
export const freeCamera = { zoomMin: 4.5, zoomMax: 82, reach: 60, yMin: -14, yMax: 30, dollhouse: { radius: 82, phi: 0.6 } };

export const modalBackdrop = "rgba(26, 18, 11, 0.55)";
export const modalSurface = "rgba(236, 225, 198, 0.98)";
// Shown only while the store loads.
export const canvasGradientStart = "#CFC4AA";
export const canvasGradientEnd = "#6E6250";

/* Fluorescent light from above: cool and a little green, flat, with a
   warm bounce off the floor. Low contrast on purpose. */
export const lights = {
  ambient: { color: 0xfff4e2, intensity: 0.14 },
  hemi: { sky: 0xeef3e2, ground: 0x7a6650, intensity: 0.46 },
  key: { color: 0xf3f6ea, intensity: 0.78 },
  fill: { color: 0xfff0da, intensity: 0.22 },
  back: { color: 0xe4eee4, intensity: 0.26 },
};

/* ------------------------------------------------------------ reflections */

/* What lacquer and brass reflect: rows of fluorescent troffers overhead,
   the beige walls and coloured shelving around the horizon, the vinyl
   floor below. A painted panorama given to each material as its envMap
   (as Cromo does), so the setup screen's own small renderer sees it
   too. */
let ENV = null;
export function storeEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#d9d8cc"); // the ceiling tile
  grad.addColorStop(0.36, "#c9c2ae");
  grad.addColorStop(0.47, "#b6aa90"); // walls and shelving at the horizon
  grad.addColorStop(0.53, "#8f8068");
  grad.addColorStop(0.62, "#c2b69c"); // the waxed floor, catching the lights
  grad.addColorStop(1, "#9d917a");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Shelving and signs round the horizon: blocks of period colour.
  let s = 5;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cols = [PERIOD.harvestGold, PERIOD.avocado, PERIOD.burntOrange, PERIOD.dustyBlue, PERIOD.brown, PERIOD.cream, PERIOD.vinylRed, PERIOD.mutedTeal];
  for (let x = 0; x < W; x += 6 + rnd() * 18) {
    g.globalAlpha = 0.5 + rnd() * 0.4;
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.fillRect(x, H * (0.44 + rnd() * 0.03), 4 + rnd() * 14, H * (0.03 + rnd() * 0.05));
  }
  g.globalAlpha = 1;
  // Troffers: bright rectangles in rows, foreshortening toward the horizon.
  for (let row = 0; row < 7; row++) {
    const el = 88 - row * 11; // elevation of this row
    const y = ((90 - el) / 180) * H;
    const hh = Math.max(2, 16 - row * 2);
    const n = 6 + row * 3;
    for (let i = 0; i < n; i++) {
      const x = ((i + (row % 2) * 0.5) / n) * W;
      const w = Math.max(6, 60 - row * 7);
      const lg = g.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
      lg.addColorStop(0, "rgba(246,250,238,0.75)"); lg.addColorStop(0.5, "rgba(252,255,246,1)"); lg.addColorStop(1, "rgba(246,250,238,0.75)");
      g.fillStyle = lg;
      g.fillRect(x - w / 2, y - hh / 2, w, hh);
    }
  }
  // Their reflections in the waxed floor, soft streaks.
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(250,250,240,${0.12 + rnd() * 0.12})`;
    g.fillRect(rnd() * W, H * (0.58 + rnd() * 0.08), 30 + rnd() * 50, 3 + rnd() * 5);
  }
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ small helpers */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/* ------------------------------------------------------------ the set */

/* The board, the blocks, the move markers and the board's features are
   the game's own (themes/wood-set.js, shared with the den in Standard):
   here they reflect the store. */
export const woodSet = createWoodSet({ env: storeEnv, quality, lights });
export const paintWood = setPaintWood;
export const WOODS = SET_WOODS;
// The squares are painted into the board's texture, so the chassis paints
// it again when the board changes size.
export const boardTextureFollowsSize = true;
export const makeBoardTexture = woodSet.makeBoardTexture;
export const buildSlabMaterials = woodSet.buildSlabMaterials;
export const makeGrid = woodSet.makeGrid;
export const grainTurns = woodSet.grainTurns;
export const woodMaterial = woodSet.woodMaterial;
export const buildPieceVisual = woodSet.buildPieceVisual;
export const buildMoveIndicator = woodSet.buildMoveIndicator;
export const buildMissingSquareVisual = woodSet.buildMissingSquareVisual;
export const buildBlackHoleVisual = woodSet.buildBlackHoleVisual;

export function renderGlobalDefs() {
  return null;
}

/* ------------------------------------------------------------ the menus' look */

/* Fonts of the period's printed matter: Bodoni for the title (the game's
   own ads), a Franklin Gothic for signs and labels, Courier for anything
   typed or printed by a machine. The chassis draws its menus with IBM
   Plex; they are re-set here in these, and its glassy panels become
   card stock. */
/* The leaflet's edge: brittle newsprint, flaked here and there, torn a
   little where the folds meet the edge (a fold is where newsprint gives
   first), and a corner gone. A clip-path polygon whose points are a
   percentage of the sheet plus a few pixels, so the damage stays the
   same size on a phone and a desktop. */
function tornEdge() {
  const r = rng(1975);
  const P = (xp, xd, yp, yd) => `calc(${xp.toFixed(2)}% + ${xd.toFixed(1)}px) calc(${yp.toFixed(2)}% + ${yd.toFixed(1)}px)`;
  // a: how far along the edge (%, in the direction of travel), s: px
  // along it, i: px in from it. Clockwise from the top left.
  const EDGES = [
    ["top", (a, s2, i) => P(a, s2, 0, i)],
    ["right", (a, s2, i) => P(100, -i, a, s2)],
    ["bottom", (a, s2, i) => P(100 - a, -s2, 100, -i)],
    ["left", (a, s2, i) => P(0, i, 100 - a, -s2)],
  ];
  // Tears at the fold ends: [a, depth px, lean px]. The folds run across
  // at a third and two thirds, and down the middle.
  const TEARS = { top: [[21, 4, 1], [50, 6, 2]], right: [[33.33, 4, -1], [66.67, 12, -3]], bottom: [[50, 8, -2], [83, 5, 1.5]], left: [[66.67, 9, 3]] };
  const pts = [];
  EDGES.forEach(([name, at]) => {
    if (name === "bottom") { pts.push(EDGES[1][1](100, -7, 0.5), at(0, 6, 0.4)); } // the chipped corner
    else pts.push(at(0, 0, 0.4));
    const tears = TEARS[name].slice();
    for (let a = 2; a < 100; a += 2) {
      while (tears.length && tears[0][0] <= a) {
        const [ta, depth, lean] = tears.shift();
        pts.push(at(ta, -1.6, 0.2), at(ta, lean, depth), at(ta, 1.3, 0.2));
      }
      if (r() < 0.1) {
        const d = 2 + r() * 2.2;
        pts.push(at(a, -2.6, 0.3), at(a, -1.1, d), at(a, 1.3, d * 0.8), at(a, 2.6, 0.3));
      } else pts.push(at(a, 0, r() * 1.2));
    }
  });
  return `polygon(${pts.join(",")})`;
}
const TORN = tornEdge();

/* The dock, said in the store (chassis DOCK_WORDS). */
export const dockWords = {
  views: ["Your side", "From above", "The aisle"],
  endGame: "Put them down",
  newGame: "Set up the demo again",
  moveLog: "Register tape",
  replay: "Replay a game",
  plainRules: "Plain rules",
  nextGame: "Next customer",
  endedCaption: "Please leave pieces on the board.",
  wonCaption: "Nice game. Complete set $7.97, aisle 9.",
};

export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700;6..96,800&family=Libre+Franklin:wght@400;500;600;700;800;900&family=Courier+Prime:wght@400;700&display=swap');
  html, body { overscroll-behavior: none; background: #1a140f; }
  [style*="IBM Plex Mono"] { font-family: 'Courier Prime', 'Courier New', Courier, monospace !important; }
  [style*="IBM Plex Sans"] { font-family: 'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif !important; }
  [style*="Fraunces"] { font-family: 'Bodoni Moda', Georgia, serif !important; }
  .ec-title {
    font-weight: 700 !important;
    color: ${PERIOD.ink} !important;
    letter-spacing: 0.05em;
    text-shadow: none !important;
    background: #efe5cc;
    padding: 0.06em 0.34em 0.02em;
    border: 1px solid rgba(46,33,24,0.55);
    box-shadow: 0 0 0 4px #efe5cc, 0 0 0 5px rgba(46,33,24,0.35), 0 6px 14px rgba(20,12,6,0.35);
  }
  .ec-masthead-relocated .ec-title { box-shadow: 0 0 0 2px #efe5cc, 0 0 0 3px rgba(46,33,24,0.35), 0 3px 8px rgba(20,12,6,0.3); }
  /* The menu card: cream stock with a printed rule, not frosted glass. */
  [data-testid="dock-panel"] {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border-radius: 3px !important;
    background-color: #ece1c6 !important;
    background-image: var(--tienda-paper) !important;
    border: 1px solid rgba(46,33,24,0.55) !important;
    box-shadow: inset 0 0 0 4px #ece1c6, inset 0 0 0 5px rgba(46,33,24,0.28), 0 10px 26px rgba(20,12,6,0.45) !important;
  }
  .ec-btn { border-radius: 2px !important; letter-spacing: 0.08em; }
  .ec-btn:active { transform: translateY(1px); }
  [data-testid="piece-card"], [data-testid="info-overlay"] > div, [data-testid="new-game-choice"] {
    background-image: var(--tienda-paper) !important;
    border-radius: 3px !important;
  }
  [data-testid="piece-card"] { border: 1px solid rgba(46,33,24,0.5) !important; }
  /* The move log is register tape: narrow, whiter paper, typed, torn off. */
  [data-testid="movelog-sheet"] {
    width: min(360px, 92vw) !important; background: #F4F0E4 !important; backdrop-filter: none !important;
    background-image: var(--tienda-paper) !important; border: none !important; border-radius: 0 !important;
    box-shadow: 0 18px 40px rgba(20,12,6,0.45) !important; padding-bottom: 34px !important;
    -webkit-mask: linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 14px 10px repeat-x;
    mask: linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 14px 10px repeat-x;
  }
  [data-testid="movelog-sheet"] h2 { font-family: 'Courier Prime', monospace !important; font-weight: 700 !important; letter-spacing: 0.2em !important; border-bottom: 1px dashed rgba(46,33,24,0.6); padding-bottom: 10px; }
  [data-testid="movelog-sheet"] table, [data-testid="movelog-sheet"] td, [data-testid="movelog-sheet"] th { font-family: 'Courier Prime', monospace !important; }
  /* The win card: a printed sign with a red band. */
  [data-testid="victory-placard"] { background-image: var(--tienda-paper) !important; border-radius: 2px !important; border: 1px solid rgba(46,33,24,0.55) !important; overflow: hidden; }
  [data-testid="victory-placard"]::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 12px; background: ${PERIOD.vinylRed}; }
  /* Action points: a punched tally tag on the table, legible on wood. */
  [data-testid="points-counter"] {
    color: ${PERIOD.ink} !important; font-weight: 700;
    background: #ece1c6; background-image: var(--tienda-paper);
    padding: 5px 11px 5px 12px; border: 1px solid rgba(46,33,24,0.5); border-radius: 2px;
    box-shadow: 0 3px 8px rgba(20,12,6,0.35);
  }
  [data-testid="points-counter"] > span:first-of-type { opacity: 0.8 !important; }
  /* (Its points are the chassis's embers, in the store's own light:
     points-glow.js.) */
  /* The corner controls sit over wood, floor or the dark under the
     table, so they're printed on a scrap of card to read on any of it. */
  [data-testid="how-to-play"], button[aria-label$="full screen"], [data-testid="room-view-corner"] {
    background: rgba(236,225,198,0.9) !important; color: ${PERIOD.ink} !important;
    border-radius: 2px !important; box-shadow: 0 2px 6px rgba(20,12,6,0.3);
  }
  /* Where the chassis puts each (--ec-corner-bottom: in a row, or stacked
     on a phone), 4 px up to centre the smaller card on it. */
  [data-testid="how-to-play"] { padding: 0 10px 0 7px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important; }
  button[aria-label$="full screen"] { width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important; }
  /* The house as faint as the full-screen card below it (user: ghost it
     too); a hover or focus lifts it, as the chassis does for that one. */
  [data-testid="room-view-corner"] { width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 60px) + 4px) !important; opacity: 0.22 !important; transition: opacity 0.5s ease !important; }
  [data-testid="room-view-corner"]:hover, [data-testid="room-view-corner"]:focus-visible { opacity: 0.8 !important; }
  /* In the Room view already: the house goes grey, spent, and fainter still. */
  [data-testid="room-view-corner"][data-active="true"] { background: rgba(160,152,138,0.6) !important; color: rgba(40,32,24,0.5) !important; box-shadow: none !important; opacity: 0.16 !important; }
  [data-testid="room-view-corner"][data-active="true"]:hover { opacity: 0.45 !important; }
  /* Rules: a newspaper circular of 1975, the store's own insert from the
     Sunday paper, folded in three to go in the box and handled since.
     Groundwood newsprint gone yellow, browner and brittle at the edges;
     soft black ink that spreads a little into the fibres, and one spot
     red, a touch off register; a screened tint; the ad on the back
     showing through; the folds worn where they cross.
     The sheet's own marks (fibres, stains, the folds across it, the back
     showing through) are on the part that scrolls and travel with the
     words (user: the creases stayed put while the text slid behind
     them); what holds still is what a sheet sliding under the thumb
     keeps: the fold down the middle and the browned edges. */
  [data-testid="info-overlay"] > div {
    background-color: ${NEWS.paper} !important;
    background-image: none !important;
    border: none !important; border-radius: 0 !important;
    box-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    clip-path: ${TORN};
    isolation: isolate;
    text-shadow: 0 0 0.45px rgba(40,35,31,0.65);
  }
  /* Held still over it all: the fold down the middle (a straight line,
     the same wherever the sheet is), and the browned, handled edges. */
  [data-testid="info-overlay"] > div::after {
    content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background:
      linear-gradient(90deg, transparent calc(50% - 12px), rgba(90,65,35,0.06) calc(50% - 1px), rgba(72,52,30,0.24) 50%, rgba(252,247,232,0.42) calc(50% + 1px), rgba(252,247,232,0.07) calc(50% + 4px), transparent calc(50% + 14px));
    box-shadow: inset 0 0 0 1px rgba(128,90,40,0.22), inset 0 0 22px rgba(160,112,44,0.34), inset 0 0 70px rgba(176,132,62,0.16);
  }
  /* The masthead's paper (it doesn't scroll): fibres and a stain. */
  [data-testid="info-overlay"] > div > div:first-child {
    background-image:
      radial-gradient(ellipse 60% 120% at 88% 8%, rgba(176,128,52,0.16), transparent 70%),
      var(--tienda-newsprint, linear-gradient(transparent, transparent));
    background-size: auto, 320px 320px;
  }
  /* The rest of the sheet, which scrolls: its fibres, its stains, the
     letter fold's two creases across it (a valley, then a ridge, at its
     thirds) and where they cross the middle fold, all painted on the
     scrolled content (background-attachment: local), so they move with
     the words. */
  [data-testid="info-body"] {
    position: relative; isolation: isolate;
    background-color: ${NEWS.paper};
    background-image:
      radial-gradient(circle 10px at 50% 33.33%, rgba(248,242,224,0.6), transparent),
      radial-gradient(circle 9px at 50% 66.67%, rgba(248,242,224,0.55), transparent),
      linear-gradient(180deg,
        transparent calc(33.33% - 14px), rgba(90,65,35,0.07) calc(33.33% - 1px), rgba(72,52,30,0.26) 33.33%, rgba(252,247,232,0.46) calc(33.33% + 1px), rgba(252,247,232,0.08) calc(33.33% + 4px), transparent calc(33.33% + 12px),
        transparent calc(66.67% - 12px), rgba(252,247,232,0.08) calc(66.67% - 4px), rgba(252,247,232,0.42) calc(66.67% - 1px), rgba(72,52,30,0.24) 66.67%, rgba(90,65,35,0.07) calc(66.67% + 1px), transparent calc(66.67% + 14px)),
      linear-gradient(180deg, rgba(255,252,240,0.035) 0 33.33%, rgba(80,58,28,0.04) 33.33% 66.67%, rgba(255,252,240,0.02) 66.67%),
      radial-gradient(ellipse 55% 30% at 6% 92%, rgba(168,120,48,0.13), transparent 70%),
      radial-gradient(ellipse 40% 18% at 80% 46%, rgba(176,128,52,0.07), transparent 70%),
      var(--tienda-newsprint, linear-gradient(transparent, transparent));
    background-size: auto, auto, auto, auto, auto, auto, 320px 320px;
    background-attachment: local;
  }
  /* The back of the sheet, showing through: placed in the scrolled
     content, so it goes by with it. */
  [data-testid="info-body"]::before {
    content: "SALE\\A$2.97\\A\\A  Men's Knit\\A  Shirts\\A\\ASAVE 30%\\A\\A  Prices good\\A  thru Sat.";
    position: absolute; left: 0; right: 0; top: 40px; z-index: -1; pointer-events: none; overflow: hidden;
    padding: 0 9%; white-space: pre; transform: scaleX(-1);
    font: 900 44px/1.02 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif;
    color: rgba(40,32,24,0.05); text-shadow: none; filter: blur(0.8px);
  }
  /* Masthead: a red band with the words reversed out of it, fading off in
     a halftone screen; the name in heavy black with a red drop, not quite
     on register; an Oxford rule (thick and thin) under it. */
  [data-testid="info-overlay"] > div > div:first-child { padding-top: 20px !important; }
  [data-testid="info-overlay"] > div > div:first-child::before {
    content: "IN-STORE DEMONSTRATION  \\2022  HOW TO PLAY  \\2022  NO CHARGE";
    display: block; margin: 0 -16px 14px; padding: 6px 8px 20px;
    font: 800 10px/1.3 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif; letter-spacing: 0.18em; text-align: center;
    color: ${NEWS.paper}; text-shadow: none;
    background:
      linear-gradient(${NEWS.redInk}, ${NEWS.redInk}) 0 0 / 100% calc(100% - 14px) no-repeat,
      radial-gradient(circle, ${NEWS.redInk} 1.3px, transparent 1.55px) 0 calc(100% - 10px) / 4px 4px repeat-x,
      radial-gradient(circle, ${NEWS.redInk} 0.9px, transparent 1.15px) 2px calc(100% - 6px) / 4px 4px repeat-x,
      radial-gradient(circle, ${NEWS.redInk} 0.5px, transparent 0.75px) 0 calc(100% - 2px) / 4px 4px repeat-x;
  }
  [data-testid="info-overlay"] > div > div:first-child > h2 {
    font-family: 'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif !important;
    font-weight: 900 !important; font-size: clamp(30px, 8vw, 42px) !important; line-height: 0.92 !important;
    letter-spacing: -0.015em !important; color: ${NEWS.ink} !important; margin: 0 0 2px !important;
    text-shadow: 1.3px 1px 0 rgba(176,56,42,0.6), 0 0 0.5px rgba(40,35,31,0.7);
  }
  [data-testid="info-overlay"] > div > div:first-child > h2::after {
    content: "The Game of Unparalleled Intention";
    display: block; margin-top: 7px; font: italic 600 13px/1.2 'Libre Franklin', Arial, sans-serif; letter-spacing: 0.01em;
    text-shadow: 0 0 0.45px rgba(40,35,31,0.65);
  }
  [data-testid="info-overlay"] > div > div:first-child > h2 + div {
    width: auto !important; height: 2px !important; background: transparent !important;
    border-top: 3px solid ${NEWS.ink}; border-bottom: 1px solid ${NEWS.ink}; margin: 10px 0 12px !important;
  }
  [data-testid="info-overlay"] [role="tablist"] { gap: 2px 12px !important; margin-bottom: 16px !important; }
  [data-testid="info-overlay"] [role="tab"] {
    font-family: 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif !important; font-weight: 800 !important;
    font-size: 11px !important; letter-spacing: 0.1em !important; color: ${NEWS.ink} !important; opacity: 0.6;
  }
  [data-testid="info-overlay"] [role="tab"][aria-selected="true"] { opacity: 1; border-bottom: 2px solid ${NEWS.redInk} !important; }
  [data-testid="info-overlay"] [role="tab"]:focus-visible { outline: 1px dashed ${NEWS.ink}; outline-offset: 2px; }
  /* The side heads in the copy: bold caps in the red. */
  [data-testid="info-body"] [style*="IBM Plex Mono"] {
    font-family: 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif !important; font-weight: 800 !important;
    letter-spacing: 0.08em !important; font-variant-numeric: tabular-nums;
  }
  [data-testid="info-body"] { scrollbar-width: thin; scrollbar-color: rgba(40,32,24,0.35) transparent; }
  [data-testid="info-body"]::-webkit-scrollbar { width: 6px; }
  [data-testid="info-body"]::-webkit-scrollbar-thumb { background: rgba(40,32,24,0.3); }
  @media (max-width: 480px) {
    [data-testid="info-overlay"] > div > div { padding-left: 20px !important; padding-right: 20px !important; }
    [data-testid="info-overlay"] > div > div:first-child::before { content: "HOW TO PLAY  \\2022  NO CHARGE"; margin: 0 -10px 12px; letter-spacing: 0.14em; }
    [data-testid="info-body"]::before { font-size: 34px; }
  }
  /* Fixed controls clear of a phone's notch and home bar (the page is
     laid out edge to edge: viewport-fit=cover). */
  [data-testid="dock-panel"] { margin-bottom: env(safe-area-inset-bottom); }
  [data-testid="how-to-play"] { margin-bottom: env(safe-area-inset-bottom); margin-left: env(safe-area-inset-left); }
  [data-testid="points-counter"], [data-testid="unused-points-note"] { margin-bottom: env(safe-area-inset-bottom); }
  [data-testid="piece-card"] { margin-bottom: env(safe-area-inset-bottom); margin-left: env(safe-area-inset-left); }
  .ec-title { margin-top: env(safe-area-inset-top); }
  @media (prefers-reduced-motion: reduce) { .ec-btn:active { transform: none; } }

  /* The dock by the moment: a price-tag red for the big button, the
     register's typewriter for its line. */
  [data-dock-role="primary"] { background: #A8321F !important; color: #F6EEDA !important; border: 2px solid #2E2118 !important;
    font-family: 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif !important; font-weight: 800 !important; letter-spacing: 0.14em !important;
    box-shadow: 3px 3px 0 #2E2118 !important; border-radius: 2px !important; }
  [data-dock-role="caption"] { font-family: 'Courier Prime', 'Courier New', monospace !important; font-style: normal !important; color: #2E2118 !important; font-size: 13px !important; }
  [data-dock-role="link"] { font-family: 'IBM Plex Mono', monospace !important; }
`;

/* ------------------------------------------------------------ setup row */

/* In the store the game isn't bought yet, only tried on the demonstration
   table (user): "Try a Game". At home it's Begin Game again. */
export function beginLabel(x) {
  return x && x.story && x.story.mode === "home" ? null : "Try a Game";
}

/* Begin Game shares its row with the catalog's order form (custom rules,
   see tienda-overlay.js). */
/* In Nova's story (story: apps/unified.jsx) the store's button opens the
   catalog of the five pieces, and the game can be bought and taken home
   from a row beneath; at home the row is Custom rules again, with the way
   back to the store and a fresh start under it. */
export function renderSetupExtras({ beginGameButton, openOrderForm, story, specialOpen }) {
  const h = React.createElement;
  const store = !!story && story.mode === "store";
  const home = !!story && story.mode === "home";
  // Until the Singularity's been visited, the catalog's page (look only)
  // stands in for Custom rules everywhere (tienda-overlay.js).
  const catalogOnly = store || !specialOpen;
  const quiet = {
    flex: "1 1 0", minWidth: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
    color: COLORS.charcoal, background: "transparent", border: `1.5px solid ${COLORS.charcoal}`, padding: "9px 10px", cursor: "pointer",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
  const row = h(
    "div",
    { key: "row", style: { display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap", width: "100%" } },
    h("button", {
      key: "order", type: "button", className: "ec-btn ec-btn-invert", "data-testid": "tienda-order-form",
      title: catalogOnly ? "The catalog's page of the pieces in the box" : "Custom rules: order the pieces, laws and board you want from the catalog",
      onClick: openOrderForm,
      style: quiet,
    }, catalogOnly ? "See the pieces" : "Custom rules"),
    // (td-try-game: what the store's idle nudge lights, tienda-overlay.js.)
    store ? React.cloneElement(beginGameButton, { className: `${beginGameButton.props.className || ""} td-try-game`, "data-testid": "tienda-try-game" }) : beginGameButton
  );
  if (!store && !home) return row;
  const link = (key, label, onClick, testid) => h("button", {
    key, type: "button", "data-testid": testid, onClick,
    style: { background: "transparent", border: "none", padding: "8px 2px", minHeight: 36, cursor: "pointer", color: COLORS.charcoal, whiteSpace: "nowrap",
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "min(11px, 2.9vw)", letterSpacing: "0.03em", textDecoration: "underline", textUnderlineOffset: 3 },
  }, label);
  // After the whole story the store has never heard of the game: another
  // copy is the clerk's scene, and then all that's left is to go home.
  const after = store && story.after && story.after();
  const confused = after && clerkConfusedNow();
  const gone = home && story.storeGone && story.storeGone();
  const realities = home && !!story.realities && !!story.realities();
  const buyStyle = { ...quiet, flex: "0 0 auto", width: "100%", background: COLORS.charcoal, color: COLORS.cream || "#F4EEDC" };
  const under = store
    ? (confused || after
      ? h("button", {
          key: "buy", type: "button", className: "ec-btn", "data-testid": confused ? "story-go-home-confused" : "story-purchase",
          onClick: confused ? story.onGoHomeConfused : story.onPurchase,
          style: buyStyle,
        }, confused ? "Go home, confused." : "Purchase another copy · $7.97")
      // (Before it's bought: into the cart, then to the register; user:
      // nothing about "your order" in the store, tienda-shopping.js.)
      : h(CartButton, { key: "buy", story, style: buyStyle }))
    // One line, however narrow the phone (the type shrinks a little): on
    // two, the dock's panel ran past its height and scrolled, and the
    // second line slid under its corner switches (user's screenshot). No
    // "Restart story" in it: that's only at the very bottom of the theme
    // switcher (user).
    : h("div", { key: "links", style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "nowrap", width: "100%" } },
        !gone && link("store", "Back to the store", story.onBackToStore, "story-back-to-store"),
        // After the story's end: every other version of the game (Nova).
        realities && link("realities", "Other realities", story.onRealities, "story-realities"));
  // Back after the story the table has no game on it: only the purchase
  // (which is the clerk's scene), no Custom rules or Begin Game.
  if (after) return h("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" } }, under);
  // (At home with the store gone and the story not yet over, no links.)
  if (home && gone && !realities) return row;
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%" } }, row, under);
}

/* The same buttons for the phone layout's control bar (chassis/MobileShell.jsx),
   which Nova offers: the catalog (or, in the story's store, the page of
   the pieces and the purchase) on rows of their own below Begin Game. */
export function shellSetupActions({ openOrderForm, story, specialOpen }) {
  if (story && story.mode === "store") {
    // Back after the story: no game on the table, only the purchase.
    if (story.after && story.after()) {
      return [clerkConfusedNow()
        ? { key: "confused", label: "Go home, confused.", onClick: story.onGoHomeConfused, testid: "shell-go-home-confused", placement: "below" }
        : { key: "purchase", label: "Purchase another copy \u00b7 $7.97", onClick: story.onPurchase, testid: "shell-purchase", placement: "below" }];
    }
    return [
      { key: "see-pieces", label: "See the pieces", onClick: openOrderForm, testid: "shell-see-pieces", placement: "below", title: "The catalog's page of the pieces in the box" },
      clerkConfusedNow()
        ? { key: "confused", label: "Go home, confused.", onClick: story.onGoHomeConfused, testid: "shell-go-home-confused", placement: "below" }
        : { key: "purchase", label: cartCount() ? "Check out \u00b7 $7.97" : "Put one in the cart \u00b7 $7.97", onClick: () => (cartCount() ? story.onPurchase() : addToCart()), testid: "shell-purchase", placement: "below" },
    ];
  }
  if (!specialOpen) return [{ key: "see-pieces", label: "See the pieces", onClick: openOrderForm, testid: "shell-see-pieces", placement: "below", title: "The catalog's page of the pieces in the box" }];
  return [{ key: "custom-rules", label: "Custom rules \u203a", onClick: openOrderForm, testid: "shell-custom-rules", placement: "below", title: "Order the pieces, laws and board you want from the catalog" }];
}

export { useSetupExtras, renderExtraOverlays, resetLid, clerkConfused } from "./tienda-overlay.js";
import { useCart, addToCart, cartCount } from "./tienda-shopping.js";
// The store's buy button before it's bought: into the cart, then check out.
function CartButton({ story, style }) {
  const n = useCart();
  return React.createElement("button", {
    type: "button", className: "ec-btn", "data-testid": "story-purchase", "data-cart": n ? "full" : "empty",
    onClick: () => (n ? story.onPurchase() : addToCart()), style,
  }, n ? "Check out \u00b7 $7.97" : "Put one in the cart \u00b7 $7.97");
}
// Nova: the store after the whole story (appliances on the table, their ad on the standee).
export { setStoreRevisited } from "./tienda-store.js";
import { clerkConfused as clerkConfusedNow } from "./tienda-overlay.js";
export { mountAmbientEffects } from "./tienda-fx.js";
/* The buttons and chips that stand for a side wear that side's wood,
   the pieces' own grain (chassis: theme.sideSurface; the swatch is
   rendered from woodMaterial, wood-set.js woodSwatch). The ink
   is set for the wood: cream with a dark bed on walnut, near-black with
   a pale halo on olive ash. Flat colours if WebGL can't take a swatch. */
export function sideSurface(side) {
  const dark = side === "dark";
  const url = woodSet.woodSwatch(dark);
  if (!url) return null;
  return dark
    ? { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyDark}`, color: "#F6EAD2", textShadow: "0 1px 1px rgba(18,9,3,0.9), 0 0 4px rgba(18,9,3,0.55)" }
    : { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyLight}`, color: "#23150A", textShadow: "0 0 2px rgba(255,246,228,0.95), 0 0 5px rgba(255,246,228,0.6)" };
}
// The store's tape: a Muzak recording of the period (see tienda-audio.js).
// It's a file beside the page (the build copies it there), not inside it,
// so the page itself stays light on a phone; fetched once the store is
// up. Without it the store plays only its own arrangements.
// The store's reels, files beside the page (build/build.js): the 1974
// Muzak recording, then the user's five mall tracks (tienda-audio.js).
export const STORE_REELS = [
  "el-cabeza-tienda-muzak.mp3",
  "el-cabeza-tienda-reel-2.mp3",
  "el-cabeza-tienda-reel-3.mp3",
  "el-cabeza-tienda-reel-4.mp3",
  "el-cabeza-tienda-reel-5.mp3",
  "el-cabeza-tienda-reel-6.mp3",
];
// Their titles, for the sound menu's now-playing strip.
export const STORE_REEL_TITLES = [
  "Muzak, 1974",
  "Coupon Gloss Reverie",
  "Twilight at the Atrium",
  "Tuesday Morning at the Atrium",
  "Tuesday Night at the Emporium",
  "Midday Clearance Sale",
];
export const createAudio = () => createStoreAudio({ tapeUrls: STORE_REELS, tapeTitles: STORE_REEL_TITLES });
// The reality's name, at the top of the info panel's This game tab (user);
// the same names as the Other realities menu (themes/realities.js WORLDS).
export const realityName = "Big Glutts";
export { hasAudio } from "./tienda-audio.js";
// The dock's sound button opens a menu of these, each switched on its own
// (chassis: theme.soundChannels; tienda-audio.js setChannelMuted).
export const soundChannels = [
  { key: "music", label: "Music", hint: "The ceiling speakers" },
  { key: "store", label: "Store sounds", hint: "Lights, air, the far-off shoppers" },
  { key: "pieces", label: "Pieces", hint: "The wood, the paper, the register" },
];
// The in-game menu offers a switch for the cost badges on the move
// markers (chassis: theme.moveCostToggle, the costs-toggle button).
export const moveCostToggle = true;
// The visit goes full screen at the first tap, usually the one that opens
// the box (chassis: theme.fullscreenOnFirstTap; browsers need a tap first).
export const fullscreenOnFirstTap = true;

/* A drag turns the board one way wherever it begins (user: "if you drag
   from the top, the pivot or rotate is correct, but if you drop below the
   halfway point on the screen, it is reversed"): as from its far side,
   right turning it as it does from the top. Elsewhere the chassis's
   turntable rule stands (begun below the board's middle on screen, the
   near side follows the finger). The tilt's own flip here is the
   chassis's invertTilt (apps). */
export const dragTurnOneWay = true;

/* A new player's opponent (user: "a new player needs somebody to play
   against ... AI on easy ... the AI always be Ash"): with nothing saved
   on the device, the store's game is against the computer, on Easy,
   playing Ash (light; you're Walnut, and move first). Every new player
   starts here, and the chassis keeps the choice from then on (it's saved
   as the page comes up), so it holds at home and everywhere after, till
   it's changed (chassis: theme.defaultOpponent). */
export const defaultOpponent = { aiPlayer: "light", aiDifficulty: "easy" };

/* What the two sides are called here (user; themes/side-names.js). */
import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("tienda");
// The points counter's embers (points-glow.js).
export const pointsGlow = pointsGlowFor("tienda");
