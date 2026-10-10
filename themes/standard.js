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
// The dock's piece, in the corner during a game: more of it, against the
// den's dark panelling (user: hard to see at the chassis's 0.35).
export const dockCornerOpacity = 0.6;
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
  dollhouse: { radius: 118, phi: 0.78 },
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

// The reality's name, at the top of the info panel's This game tab (user);
// the same names as the Other realities menu (themes/realities.js WORLDS).
export const realityName = "The Den, 1975";
export const hasAudio = true;
export const createAudio = () => createDenAudio();
// The dock's sound button (and the phone menu) offers these, each switched
// on its own (chassis: theme.soundChannels; den-audio.js setChannelMuted).
export const soundChannels = [
  { key: "room", label: "The room", hint: "The fire and the clock" },
  // Its own key: channel choices carry between pages, and Tienda's "music"
  // is the store's ceiling speakers, not this.
  { key: "stereo", label: "Music", hint: "The record player and the 8-track" },
  { key: "pieces", label: "Pieces", hint: "The wood on the board" },
];

/* The stereo console's music (chassis: theme.music, the music panel). The
   records and tapes are the user's to choose. Each track: { id, title,
   artist, medium: "record" | "8track", url }, the url a file beside the
   page (build/build.js DEN_RECORDS: fetched when it's played, not inside
   the page). A source with none shows that it's empty. Tests can lend a
   few (window.__DEN_TEST_TRACKS__).
   The records are already a record: each track is put through
   tools/console_1974_turntable.py (a 1974 wooden console: 40 Hz-11 kHz,
   the cabinet's 150 Hz, mono lows and half-width highs, wow and flutter,
   the amp a little hot, the preamp's hiss and the surface's crackle). */
const DEN_TRACKS = [
  { id: "dangerous-dashing", title: "Dangerous Dashing", artist: "influentialdistortion257", medium: "record", url: "el-cabeza-den-record-1.mp3", treated: true },
  // The 8-track's tapes: the user's tracks, each put on a cartridge by
  // tools/den_8track_treatment.py (3 3/4 ips band and head bump, tape
  // saturation, wow and flutter, crosstalk, a dropout, low hiss, the
  // program-change clunk). (They used to loop, each round again until
  // stopped; now every track plays once and the next comes on, in a
  // shuffled order that repeats: the chassis's playTrack, user.)
  { id: "tape-interesting-plus", title: "Interesting Plus", artist: "Charlie C. & the Fresh Heaven Denizens", medium: "8track", url: "el-cabeza-den-tape-1.mp3", treated: true },
  { id: "tape-late-night-chef", title: "Late Night Chef the Ultimate Grilling Machine", artist: "Weiss Haus Trio", medium: "8track", url: "el-cabeza-den-tape-2.mp3", treated: true },
  { id: "tape-the-longest-song", title: "The Longest Song", artist: "Seven Minutes of Euphoria", medium: "8track", url: "el-cabeza-den-tape-3.mp3", treated: true },
  { id: "tape-permafrost-in-your-bed", title: "Permafrost in your Bed", artist: "Subtle Silence Serenity", medium: "8track", url: "el-cabeza-den-tape-4.mp3", treated: true },
  { id: "tape-parse", title: "Parse", artist: "Rudimentary Pennies", medium: "8track", url: "el-cabeza-den-tape-5.mp3", treated: true },
];
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

export const mountAmbientEffects = createDenEffects(woodSet, { viewPitch });
// The rules lie in the room: the leaflet on the coffee table opens them
// (den-fx.js), so there's no How to play in the corner.
export const rulesInRoom = true;
// No "This game" tab in the rules here (user): the classic game's own.
export const rulesTabsHidden = ["game"];
// Focus: the room dims and blurs away round the floating board (den-fx.js);
// the chassis gives the ways in and out (corner button, F, the dock's and
// the phone menu's switches), the den its own (a tap on a lamp: the
// console's, the credenza's two, or a ceiling globe).
export const focusMode = true;
// The extras (pieces past the five, laws, the board's cuts) wait for the
// Singularity's first visit (engine/journey.js).
export const lockExtrasUntilSingularity = true;

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
/* The dock, said in the den (chassis DOCK_WORDS). */
export const dockWords = {
  views: ["My side", "Overhead", "The room"],
  focus: "Lights low",
  endGame: "Call it a night",
  newGame: "Set them up again",
  moveLog: "Score pad",
  replay: "Replay a game",
  plainRules: "Back to the box rules",
  nextGame: "Next game",
  endedCaption: "We'll finish it some other time.",
  wonCaption: "That's the game. Good one.",
};

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
  button[aria-label$="full screen"], [data-testid="room-view-corner"], [data-testid="focus-corner"] {
    background: rgba(243,231,205,0.92) !important; color: ${DEN.chocolate} !important;
    border-radius: 999px !important; box-shadow: 0 2px 8px rgba(12,6,2,0.4);
  }
  /* Where the chassis puts each (--ec-corner-bottom: in a row, or stacked
     on a phone), 4 px up to centre the smaller card on it. */
  button[aria-label$="full screen"] { width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important; }
  [data-testid="room-view-corner"], [data-testid="focus-corner"] { width: 30px !important; height: 30px !important; bottom: calc(var(--ec-corner-bottom, 18px) + 4px) !important; opacity: 0.85 !important; }
  [data-testid="focus-corner"][data-on="true"] { background: ${DEN.chocolate} !important; color: rgba(243,231,205,0.96) !important; opacity: 1 !important; }
  /* In the Room view already: the house goes grey, spent, like a switch
     that's been thrown. */
  [data-testid="room-view-corner"][data-active="true"] { background: rgba(150,141,128,0.62) !important; color: rgba(58,44,34,0.55) !important; box-shadow: none !important; opacity: 0.6 !important; }
  /* The lights down (focus): the corner goes down with them, every card
     dimmed back into the dark; a hover brings one up to find it. */
  [data-dim="true"] { opacity: 0.32 !important; box-shadow: none !important; }
  [data-testid="room-view-corner"][data-active="true"][data-dim="true"] { opacity: 0.22 !important; }
  [data-testid="focus-corner"][data-on="true"][data-dim="true"] { opacity: 0.45 !important; }
  button[aria-label$="full screen"][data-dim="true"] { opacity: 0.14 !important; }
  [data-dim="true"]:hover, [data-dim="true"]:focus-visible, [data-testid="focus-corner"][data-dim="true"]:hover { opacity: 0.9 !important; }
  [data-testid="room-view-corner"][data-active="true"]:hover { opacity: 0.6 !important; }
  /* While the set's commercial plays (engine/journey.js
     setCommercialOn puts ec-commercial on the page; user): the lamp and
     the house ghost, and taps on them go nowhere until it's over. */
  html.ec-commercial [data-testid="room-view-corner"], html.ec-commercial [data-testid="focus-corner"], html.ec-commercial [data-testid="action-corner"] {
    opacity: 0.32 !important; box-shadow: none !important; pointer-events: none !important; transition: opacity 0.5s ease !important; }
  /* The masthead goes down with the lights too (the chassis puts
     ec-lights-down on the page while focus is on). */
  [data-masthead] > div { transition: filter 0.9s ease, opacity 0.9s ease; }
  html.ec-lights-down [data-masthead] > div { filter: brightness(0.32) saturate(0.6); opacity: 0.55; }
  /* The now-playing chip: the same scrap of card as the corner. */
  [data-testid="music-chip"] { background: rgba(243,231,205,0.92) !important; color: ${DEN.chocolate} !important; border-color: rgba(58,36,21,0.25) !important; box-shadow: 0 2px 8px rgba(12,6,2,0.4) !important; }
  [data-testid="music-chip"] input[type="range"] { accent-color: ${DEN.chocolate}; }
  /* The rules leaflet's "?" (den-fx.js): a scrap of card that pops up
     over the leaflet on the coffee table under the mouse. */
  .den-rules-hint {
    position: fixed; z-index: 30; pointer-events: none; left: -100px; top: -100px;
    transform: translate(-50%, calc(-100% - 14px)) scale(0.4); transform-origin: 50% 100%;
    opacity: 0; transition: opacity 0.14s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .den-rules-hint.on { opacity: 1; transform: translate(-50%, calc(-100% - 14px)) scale(1); }
  .den-rules-hint span {
    position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%;
    background: rgba(243,231,205,0.96); color: ${DEN.chocolate}; border: 1.5px solid ${DEN.chocolate};
    font: 700 17px/1 'IBM Plex Sans', sans-serif; box-shadow: 0 3px 10px rgba(12,6,2,0.45);
  }
  .den-rules-hint span::after {
    content: ""; position: absolute; left: 50%; bottom: -6px; width: 9px; height: 9px; margin-left: -4.5px;
    background: rgba(243,231,205,0.96); border-right: 1.5px solid ${DEN.chocolate}; border-bottom: 1.5px solid ${DEN.chocolate};
    transform: rotate(45deg);
  }
  @media (prefers-reduced-motion: reduce) { .den-rules-hint { transition: opacity 0.14s ease; } }
  /* Focus (den-fx.js): over the picture, everything outside an ellipse
     round the board darkened, and blurred where the device can take it
     (.blur); den-fx sets the clear rectangle (--ix0 --ix1 --iy0 --iy1, the soft edge --ox0 --ox1 --oy0 --oy1) and the
     opacity each frame. */
  .den-focus-veil {
    position: absolute; inset: 0; pointer-events: none; opacity: 0; visibility: hidden;
    /* 72% of the first darkening (user: 40% less, then a little darker;
       den-fx FOCUS_DARK); the blur at a fifth of what it was (user),
       and the clear part is the board's outline (den-fx sets its edges):
       two soft bands, across and down, laid over each other; dark outside
       either, clear inside both, so the board's corners stay clear. */
    background: rgba(7,4,3,0.518);
    -webkit-mask-image:
      linear-gradient(to right, #000 var(--ox0, 0px), transparent var(--ix0, 30%), transparent var(--ix1, 70%), #000 var(--ox1, 100%)),
      linear-gradient(to bottom, #000 var(--oy0, 0px), transparent var(--iy0, 30%), transparent var(--iy1, 70%), #000 var(--oy1, 100%));
    mask-image:
      linear-gradient(to right, #000 var(--ox0, 0px), transparent var(--ix0, 30%), transparent var(--ix1, 70%), #000 var(--ox1, 100%)),
      linear-gradient(to bottom, #000 var(--oy0, 0px), transparent var(--iy0, 30%), transparent var(--iy1, 70%), #000 var(--oy1, 100%));
    -webkit-mask-composite: source-over; mask-composite: add;
  }
  /* The book visit's way back (den-fx.js): a quiet line at the foot. */
  .den-book-hint {
    position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 30;
    pointer-events: none; opacity: 0; transition: opacity 0.4s ease;
    background: rgba(243,231,205,0.92); color: ${DEN.chocolate}; padding: 7px 14px; border-radius: 999px;
    font: 500 12.5px/1.2 'IBM Plex Sans', sans-serif; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(12,6,2,0.4);
  }
  .den-book-hint.on { opacity: 1; }
  .den-focus-veil.blur { background: rgba(7,4,3,0.432); backdrop-filter: blur(1.4px) saturate(0.7); -webkit-backdrop-filter: blur(1.4px) saturate(0.7); }
  /* The coffee table's extra blur (den-fx.js shapes it: the table's
     outline less the board and pieces). A blur alone: no darkening. */
  .den-table-blur {
    position: absolute; inset: 0; pointer-events: none; opacity: 0; visibility: hidden; background: transparent;
    backdrop-filter: blur(1.2px); -webkit-backdrop-filter: blur(1.2px);
    -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  }
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

  /* The dock by the moment (chassis DOCK_WORDS): the den's own way of
     putting it, a cream card with the decade's stripes for the big button. */
  [data-dock-role="primary"] { font-family: 'Caprasimo', 'Cooper Black', Georgia, serif !important; font-size: 18px !important; letter-spacing: 0.02em !important;
    text-transform: none !important; background: #4A2A14 !important; color: #F3E6C4 !important; border: none !important; border-radius: 999px !important;
    box-shadow: 0 4px 0 #B4451F, 0 6px 14px rgba(12,6,2,0.35) !important; padding: 11px 18px 12px !important; }
  [data-dock-role="primary"]:active { transform: translateY(2px); box-shadow: 0 2px 0 #B4451F !important; }
  [data-dock-role="caption"] { font-family: 'Caprasimo', 'Cooper Black', Georgia, serif !important; font-style: normal !important; font-size: 15px !important; color: #B4451F !important; }
`;

/* What the two sides are called here (user; themes/side-names.js). */
import { sideNamesFor } from "./side-names.js";
import { pointsGlowFor } from "./points-glow.js";
export const sideNames = sideNamesFor("standard");
// The points counter's embers (points-glow.js): firelight and lamplight.
export const pointsGlow = pointsGlowFor("standard");
