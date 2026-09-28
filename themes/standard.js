/* Standard theme: the game at home.

   They went to the store, ended up buying a copy, and brought it home:
   the same folding walnut-and-maple board and wooden blocks as on
   Tienda's display table (themes/wood-set.js), now on a walnut coffee
   table in the sunken conversation pit of a mid-seventies den, on a
   rainy weeknight — paneled walls, shag, a fire going in the fieldstone
   fireplace, amber swag lamps (themes/den-room.js, den-fx.js), and the
   sound of the room (den-audio.js).

   The menus are the room's: warm card stock and chocolate ink, the
   title in a soft, heavy seventies serif, the rules set as the booklet
   that came in the box. The side buttons wear the pieces' own wood.

   Standard is also Nova's first theme (apps/unified.jsx), and its phone
   layout takes its colours from COLORS here (chassis/MobileShell.jsx). */

import * as THREE from "three";
import { quality } from "./tienda-quality.js";
import { createWoodSet, EDGE_RADIUS as SET_EDGE_RADIUS, OUTLINE_Y_OFFSET } from "./wood-set.js";
import { createAudio as createDenAudio } from "./den-audio.js";
import { createDenEffects } from "./den-fx.js";
import { RX as ROOM_RX, RZ as ROOM_RZ, CEIL as ROOM_CEIL, PIT_FLOOR as ROOM_PIT_FLOOR } from "./den-room.js";

/* ------------------------------------------------------------ the room's colours */

// Avocado, harvest gold, burnt orange, walnut and cream: the colours of
// the den, a little dimmed by lamplight.
export const DEN = {
  chocolate: "#3A2415",
  walnut: "#5C3A21",
  rust: "#9C4A26",
  burntOrange: "#C0632C",
  harvestGold: "#D3A13B",
  avocado: "#6B7536",
  cream: "#F3E7CD",
  card: "#EADBBB",
};

export const COLORS = {
  // The menus: warm card stock, chocolate ink.
  cream: DEN.cream,
  creamAlt: "#E6D5B2",
  charcoal: DEN.chocolate,
  slate: "#7A5A3C",
  slateSoft: "rgba(122, 90, 60, 0.30)",
  slateFaint: "rgba(122, 90, 60, 0.10)",
  pageBg: "#2A1C12",
  pageBgDeep: "#1A120B",
  // The pieces: walnut for Dark, olive ash for Light.
  bodyDark: "#4A2C1C",
  bodyLight: "#D9B77E",
};

// The title: Fraunces at its softest and heaviest reads like the rounded
// display faces of the period.
export const titleFontFamily = "'Fraunces', serif";
// The camera sits a little lower than the default (0.86), so the room
// shows behind the pit; a little lower again on a tall screen.
export const viewPitch = typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.25 ? 1.08 : 1.0;

export const HEX = {
  cream: 0xf3e7cd,
  charcoal: 0x2a1a10, // the slab's edge lines: the board's dark edge
  slate: 0x7a5a3c,
  pieceLight: 0xd9b77e,
  pieceDark: 0x4a2c1c,
  // Pivot arrows and similar accents the chassis colours per side.
  glowCyan: 0xd3a13b,
  glowAmber: 0xf3e7cd,
  structureEdge: 0xd3a13b,
};

export const EDGE_RADIUS = SET_EDGE_RADIUS;
// The shell's at-rest lift, stripped before a roll (wood-set.js SHELL_LIFT).
export const outlineYOffset = OUTLINE_Y_OFFSET;
// A room to look round (user: panning felt far too tight): the camera may
// come in closer and wander off the board into the den, walls to the pit
// floor (chassis: theme.freeCamera; other themes keep the board in view).
// And out as far as the room goes (the user: "zoom like literally all the
// way to the ceiling, and not have it act weird"): the camera stops at the
// walls and the ceiling (`room`, the den's box inside them),
// sliding in along its line of sight rather than going through.
export const freeCamera = {
  zoomMin: 4.5, zoomMax: 140, reach: 70, yMin: -8, yMax: 30,
  // The Room view (a button, and the phone's menu): up above the den,
  // the roof off, the whole room below (chassis roomView).
  dollhouse: { radius: 150, phi: 0.68 },
  // Clear of what stands against the walls (the shelves, the console,
  // the fireplace) and under the ceiling's beams (3 deep).
  room: { x: [-ROOM_RX + 9, ROOM_RX - 9], y: [ROOM_PIT_FLOOR + 1.5, ROOM_CEIL - 4.2], z: [-ROOM_RZ + 9, ROOM_RZ - 9] },
};

export const modalBackdrop = "rgba(20, 12, 6, 0.5)";
export const modalSurface = "rgba(243, 231, 205, 0.98)";
// Shown only until the room is up.
export const canvasGradientStart = "#4A3322";
export const canvasGradientEnd = "#1A120B";

/* Lamplight: warm and low, from above the pit (the swag lamps), with the
   fire's orange coming in behind. Enough to play by, not more. */
export const lights = {
  ambient: { color: 0xfff0dc, intensity: 0.14 },
  hemi: { sky: 0xffeedb, ground: 0x4a3420, intensity: 0.44 },
  key: { color: 0xfff1de, intensity: 0.95 },
  fill: { color: 0xffdcb4, intensity: 0.24 },
  back: { color: 0xffb070, intensity: 0.22 },
};

/* ------------------------------------------------------------ reflections */

/* What the lacquer and the brass reflect: the den round the pit — lamp
   glow in amber pools, dark paneling, the fire, the green shag, the
   night in the glass door. A painted panorama, as Tienda's store. */
let ENV = null;
export function denEnv() {
  if (ENV) return ENV;
  const W = 1024, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#3C2E22"); // the popcorn ceiling, lamp-lit
  grad.addColorStop(0.32, "#4A3424");
  grad.addColorStop(0.44, "#2A190E"); // paneling at the horizon
  grad.addColorStop(0.53, "#3A2413");
  grad.addColorStop(0.6, "#3A4018"); // the shag
  grad.addColorStop(1, "#22260E");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // The lamps, the fire and the swag globes round the horizon and above.
  const blob = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
  blob(W * 0.25, H * 0.44, 70, "rgba(255,150,70,0.9)"); // the fire
  blob(W * 0.5, H * 0.38, 46, "rgba(255,210,150,0.8)");
  blob(W * 0.62, H * 0.4, 40, "rgba(255,210,150,0.7)");
  blob(W * 0.86, H * 0.39, 44, "rgba(255,205,145,0.75)");
  blob(W * 0.1, H * 0.2, 36, "rgba(255,170,80,0.85)"); // the swags
  blob(W * 0.6, H * 0.18, 36, "rgba(255,170,80,0.85)");
  // The glass door: a dark blue pane.
  g.fillStyle = "rgba(20,32,50,0.9)"; g.fillRect(W * 0.72, H * 0.3, W * 0.08, H * 0.2);
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ the set */

/* The board, the blocks, the move markers and the board's features are
   the store's copy (themes/wood-set.js), reflecting the den. */
export const woodSet = createWoodSet({ env: denEnv, quality, lights });
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
   in Tienda (chassis: theme.sideSurface): cream ink on walnut, near-black
   with a pale halo on olive ash. Flat colours without WebGL. */
export function sideSurface(side) {
  const dark = side === "dark";
  const url = woodSet.woodSwatch(dark);
  if (!url) return null;
  return dark
    ? { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyDark}`, color: "#F6EAD2", textShadow: "0 1px 1px rgba(18,9,3,0.9), 0 0 4px rgba(18,9,3,0.55)" }
    : { background: `url(${url}) center / cover no-repeat, ${COLORS.bodyLight}`, color: "#23150A", textShadow: "0 0 2px rgba(255,246,228,0.95), 0 0 5px rgba(255,246,228,0.6)" };
}

/* ------------------------------------------------------------ sound and the scene */

export const hasAudio = true;
export const createAudio = () => createDenAudio();
// The dock's sound button (and the phone menu) offers these, each switched
// on its own (chassis: theme.soundChannels; den-audio.js setChannelMuted).
export const soundChannels = [
  { key: "room", label: "The room", hint: "The fire, the clock, the rain" },
  // Its own key: channel choices carry between pages, and Tienda's "music"
  // is the store's ceiling speakers, not this.
  { key: "stereo", label: "Music", hint: "The record player and the 8-track" },
  { key: "pieces", label: "Pieces", hint: "The wood on the board" },
];

/* The stereo console's music (chassis: theme.music, the music panel). The
   records and tapes are the user's to choose: they'll send the tracks.
   Each track: { id, title, artist, medium: "record" | "8track", url },
   the url an asset bundled with the page. Until then each source shows
   that it's empty. Tests can lend a few (window.__DEN_TEST_TRACKS__). */
const DEN_TRACKS = [];
export const music = {
  title: "The stereo",
  hint: "Records and tapes on the console",
  channel: "stereo", // picking a track switches this channel back on
  sources: [
    { key: "record", label: "Record player", empty: "No records yet" },
    { key: "8track", label: "8-track", empty: "No tapes yet" },
  ],
  tracks: () => (typeof window !== "undefined" && window.__EC_TEST_HOOKS__ && window.__DEN_TEST_TRACKS__) || DEN_TRACKS,
};
// The in-game menu offers a switch for the cost badges on the move
// markers (chassis: theme.moveCostToggle, the costs-toggle button).
export const moveCostToggle = true;

export const mountAmbientEffects = createDenEffects(woodSet);

/* No pre-game setup extras, and no SVG filter defs. */
export function renderSetupExtras() {
  return null;
}
export function renderGlobalDefs() {
  return null;
}

/* ------------------------------------------------------------ the menus' look */

/* The chassis's menus in the room's colours: its panels are card stock
   already (COLORS); here the title is set soft and heavy, what floats
   over the room (the corner controls, the points, the notes) gets a
   scrap of card to read against the dark, and the rules are the booklet
   from the box: cream stock inside a printed double rule, the headings
   in the box's own Bodoni. The box lid's lettering needs Bodoni Moda,
   Libre Franklin and Courier Prime too (den-room.js paints it). */
export const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..900,0..100,0..1&family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700&family=Libre+Franklin:wght@500;700&family=Courier+Prime:wght@400;700&display=swap');
  /* The television's visit (den-fx.js): the title and the dock's piece
     step aside while the camera is over at the set. */
  @keyframes ec-tv-step-aside { from { opacity: 1; } to { opacity: 0; } }
  html.ec-tv-visit .ec-title, html.ec-tv-visit canvas[data-testid="dock-piece-canvas"] { animation: ec-tv-step-aside 0.5s ease both; pointer-events: none; }
  html, body { overscroll-behavior: none; background: #1a120b; }
  [style*="Fraunces"] { font-variation-settings: "SOFT" 100, "WONK" 1; }
  .ec-title {
    color: #F3E2BE !important;
    font-weight: 800 !important;
    font-variation-settings: "SOFT" 100, "WONK" 1, "opsz" 144;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 0 rgba(40, 22, 10, 0.55), 0 0 22px rgba(255, 160, 80, 0.35) !important;
  }
  [data-testid="dock-panel"] {
    background-color: ${DEN.cream} !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border: 1px solid rgba(58,36,21,0.35) !important;
    box-shadow: 0 14px 34px rgba(12,6,2,0.55) !important;
  }
  /* Over the room: a scrap of card behind anything that floats on it. */
  [data-testid="how-to-play"], button[aria-label$="full screen"], [data-testid="room-view-corner"] {
    background: rgba(243,231,205,0.92) !important; color: ${DEN.chocolate} !important;
    border-radius: 999px !important; box-shadow: 0 2px 8px rgba(12,6,2,0.4);
  }
  [data-testid="how-to-play"] { padding: 0 12px 0 8px !important; height: 30px !important; bottom: 22px !important; }
  button[aria-label$="full screen"] { width: 30px !important; height: 30px !important; bottom: 22px !important; }
  [data-testid="room-view-corner"] { width: 30px !important; height: 30px !important; bottom: 60px !important; left: 18px !important; opacity: 0.85 !important; }
  [data-testid="points-counter"] {
    color: ${DEN.chocolate} !important;
    background: rgba(243,231,205,0.92); padding: 5px 12px 5px 13px; border-radius: 999px;
    box-shadow: 0 2px 8px rgba(12,6,2,0.4);
  }
  [data-testid="unused-points-note"] {
    color: ${DEN.chocolate} !important; background: rgba(243,231,205,0.94); padding: 6px 12px; border-radius: 999px;
  }
  /* The rules: the booklet that came in the box. */
  [data-testid="info-overlay"] > div {
    background: #F4E9CF !important;
    border: none !important; border-radius: 2px !important;
    box-shadow: inset 0 0 0 8px #F4E9CF, inset 0 0 0 9px rgba(58,36,21,0.6), inset 0 0 0 12px #F4E9CF, inset 0 0 0 13px rgba(58,36,21,0.35), 0 24px 60px rgba(8,4,1,0.55) !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  [data-testid="info-overlay"] h2 {
    font-family: 'Bodoni Moda', 'Didot', Georgia, serif !important; font-weight: 700 !important;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  /* The rule is drawn under the page's text (inset shadows), so the text
     scrolls inside it, not over it into the margin: the scrolling part
     stops short of the rule, its last lines fading as they reach it. */
  [data-testid="info-overlay"] [data-testid="info-body"] {
    margin-bottom: 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 14px), transparent);
  }
  [data-testid="movelog-sheet"], [data-testid="victory-placard"], [data-testid="new-game-choice"] {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
`;
