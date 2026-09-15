/* Neon theme: palette, piece-edge rounding, board visuals, the
   Anomaly random-setup generator, the position-tension reading used to
   drive ambient audio, and the full Web Audio ambient/SFX engine.
   Extracted from el-cabeza-neon-3d.html.

   createSoundscape is fully self-contained (no engine or other theme
   dependencies) — it only touches the Web Audio API — so it is kept
   whole rather than split further. Everything else here mirrors
   themes/standard.js's shape (COLORS/HEX/EDGE_RADIUS/makeBoardTexture/
   makeGrid) plus Neon-exclusive additions with no Standard equivalent
   (PIECE_ORIENTATIONS/generateAnomalySetup for the Anomaly button,
   computeTension for the ambient hum, makeGridGlowTexture for the
   bloom pass). */

import React from "react";
import * as THREE from "three";
import { BOARD_SIZE, SLAB, MARGIN, SQUARE_SIZE, OFF, GRID_EXTENT, GOAL_ROW, PIECE_SCALE } from "../engine/constants.js";
import { opponentOf, cabezaInDanger } from "../engine/ai.js";

/* Everything visual in this experimental skin lives in these two
   objects (COLORS for the DOM/CSS layer, HEX for the Three.js scene
   just below) plus a handful of Three.js material constants marked
   "theme:" in comments near their use. Nothing outside these islands
   was touched — every rule, AI weight, camera constant, and state
   handler is byte-for-byte the same as the original light build. To
   restore the original look, swap these two objects (and the marked
   material lines) back; nothing else needs to change.

   The four neutral roles (surface/surfaceAlt/ink/inkMuted) keep their
   ORIGINAL names (cream/creamAlt/charcoal/slate) so every existing
   style rule that already reads COLORS.cream or COLORS.charcoal just
   inherits the new dark values automatically — only the handful of
   spots that used charcoal/cream to mean "Dark player" / "Light
   player" specifically (see accentDark/accentLight below) were
   re-pointed at the new dedicated player-accent tokens, since blindly
   inverting lightness on a shared token would have made both players'
   chips read as "ink vs. surface" instead of two distinct hues. */
export const COLORS = {
  /* Card / panel surface — was near-white, now the near-black glass
     the whole UI sits on. */
  cream: "#0B0F14",
  creamAlt: "#10151C",
  /* Primary ink — was near-black text on a light card, now a cool
     ice-white for text/borders on the new dark surfaces. */
  charcoal: "#D9E7EC",
  /* Secondary/muted ink — kept the same relative role, shifted cool. */
  slate: "#5C7A88",
  slateSoft: "rgba(93, 197, 227, 0.22)",
  slateFaint: "rgba(93, 197, 227, 0.10)",
  /* Outer page background, behind the app card. */
  pageBg: "#080B12",
  pageBgDeep: "#020305",
  /* New: dedicated player-identity accents. Player chips, the current-
     player dot, and the win placard read these directly instead of
     the ink/surface pair above, so "whose piece is this" stays a
     single, consistent hue per side rather than a light/dark
     inversion that a dark theme would otherwise muddy. */
  accentDark: "#4DE8FF", // Dark player's glow/halo — electric cyan
  accentLight: "#FFB454", // Light player's glow/halo — warm amber
  accentDanger: "#FF3D7A", // capture/crush warning, distinct from both players
  /* Player chip FILL colors — matched to the actual rendered piece
     materials (see HEX.charcoal/HEX.pieceLight in the 3D scene) rather
     than the saturated accent hues above. Every player-colored circle
     or button uses one of these for its fill and the matching accent
     above only as a border/box-shadow halo, so a UI chip reads as "the
     piece, glowing" instead of "a solid accent-colored swatch." */
  bodyDark: "#0D1116",
  bodyLight: "#FFFFFF",
  /* Near-black text placed ON TOP of a bright/pale fill (player chips)
     for guaranteed contrast. */
  inkOnAccent: "#06090D",
};

/* The masthead title and modal-header display face — chassis falls
   back to Standard's Fraunces when a theme doesn't set this. */
export const titleFontFamily = "'Chakra Petch', sans-serif";

export const HEX = {
  /* Kept in sync with COLORS.cream, same reasoning as before. */
  cream: 0x0b0f14,
  /* Light piece body — cool pale steel instead of warm tan, so its
     amber emissive edge (see the piece-material build effect) reads
     as a deliberate accent rather than fighting the base color. */
  pieceLight: 0xb9c4ce,
  /* Dark piece body. Also still used for the grid's outer border line
     — see makeGrid, unchanged call site, new value. */
  charcoal: 0x0d1116,
  /* Grid line color — dim, desaturated steel-blue; opacity is turned
     down at the call site too, since a tinted line reads busier than
     a neutral gray one at the same alpha. */
  slate: 0x24414c,
  /* Slab side material — was light wood, now a near-black voxel body;
     roughness/metalness are adjusted at the call site for a faint
     brushed-metal sheen. */
  wood: 0x11151c,
  /* New: the two per-player neon rim colors, used on the piece outline
     shell (the existing silhouette trick — see build-pieces) and on
     the move/ghost indicator lines, so a piece's glow and the move
     options it's showing share one hue per side. */
  glowCyan: 0x4de8ff,
  glowAmber: 0xffb454,
  /* Per feedback, the Light piece OUTLINE specifically uses a darker,
     more saturated orange than the body's own pale amber accent above
     — distinct color, not just a dimmed version of glowAmber. */
  glowAmberOutline: 0xcc5c0e,
  /* New: capture-move indicator color — distinct from both player
     accents so "this move captures" reads as its own signal. */
  glowMagenta: 0xff3d7a,
  /* New: neutral structural edge color for the board's own border —
     deliberately dimmer/cooler than either player accent, so the
     board itself still reads as neutral architecture, not as
     belonging to one side. */
  structureEdge: 0x3f6472,
};

/* Edge rounding, in board units where one square = 1 inch. 0.125 = a
   1/8" roundover. This is the single number to tune. */
export const EDGE_RADIUS = 0.03;

/* Each type's possible footprints — every way its physical block can
   be stood on the board. Turrito and Opa are true cubes (1x1x1 and
   2x2x2) and Cabeza is a disc, so each has exactly one orientation;
   Flaco (a 1x1x2 block) and Chato (a 1x2x2 block) each have a repeated
   pair of dimensions plus one different one, so each has exactly 3
   distinct standing orientations — which axis (w, h, or z) gets the
   odd-one-out size. Per feedback, the ANOMALY generator below picks
   one of these per piece too, not just a position — e.g. Flaco
   "standing upright" is its {w:1,h:1,z:2} orientation, Chato "laying
   down" is its {w:2,h:2,z:1} one. Movement itself needs no changes for
   this: rolling is already fully generic over whatever w/h/z a piece
   currently has (that's how Opa's 2x2 and Turrito's 1x1 already
   coexist under the same rules), so a reoriented Flaco just moves
   exactly like any other piece with a 1x1 footprint and z:2 height
   already would. */
/* The crawling voxel mass (see spawnCrawlWave in mountAmbientEffects)
   is built on a finer sub-grid than the board's own squares — each
   voxel is sized so exactly CRAWL_SUB x CRAWL_SUB of them tile one
   board square. */
const CRAWL_SUB = 3;
const CRAWL_VOXEL = SQUARE_SIZE / CRAWL_SUB;

/* A soft round falloff (opaque center fading smoothly to transparent)
   used to paint the weight-pulse squares as a diffuse bloom rather
   than a hard-edged rectangle. Generated once and shared. */
function makeSoftGlowTexture() {
  const RES = 256;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(RES / 2, RES / 2, 0, RES / 2, RES / 2, RES / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, RES, RES);
  return new THREE.CanvasTexture(canvas);
}

export const PIECE_ORIENTATIONS = {
  flaco: [
    { w: 1, h: 2, z: 1 },
    { w: 2, h: 1, z: 1 },
    { w: 1, h: 1, z: 2 },
  ],
  turrito: [{ w: 1, h: 1, z: 1 }],
  cabeza: [{ w: 1, h: 1, z: 1 }],
  chato: [
    { w: 1, h: 2, z: 2 },
    { w: 2, h: 1, z: 2 },
    { w: 2, h: 2, z: 1 },
  ],
  opa: [{ w: 2, h: 2, z: 2 }],
};

export function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* theme: the ANOMALY button (setup-phase only, see its JSX) generates a
   fresh random opening layout that's rotationally symmetrical — each
   side's own five pieces confined entirely to its own back two rows,
   and Light's arrangement is always the exact 180-degree rotation of
   Dark's (the same piece type sitting at the point-reflected cell).
   Only Dark's five pieces are ever actually placed/randomized; Light's
   are derived by reflecting each one through the board's center
   (row -> BOARD_SIZE - row - h, col -> BOARD_SIZE - col - w). That's
   what GUARANTEES the symmetry and both sides' row confinement at
   once, rather than generating and separately validating two halves —
   reflecting a cell that's within Dark's rows {0,1} always lands
   within Light's rows {BOARD_SIZE-2, BOARD_SIZE-1}, automatically.
   Bigger pieces are placed first (greedy) since they're the most
   constrained; only 10 of the 20 cells in the 2-row band ever need to
   be filled, so a handful of shuffled retries is enough to succeed
   essentially every time. */
export function generateAnomalySetup() {
  const types = ["opa", "chato", "flaco", "turrito", "cabeza"];
  for (let attempt = 0; attempt < 300; attempt++) {
    const occupied = new Set();
    const placed = [];
    let ok = true;
    for (const type of types) {
      const orientations = PIECE_ORIENTATIONS[type];
      const { w, h, z } = orientations[Math.floor(Math.random() * orientations.length)];
      const rowOptions = [];
      for (let row = 0; row <= 2 - h; row++) rowOptions.push(row);
      const colOptions = [];
      for (let col = 0; col <= BOARD_SIZE - w; col++) colOptions.push(col);
      const rowOrder = shuffledIndices(rowOptions.length).map((i) => rowOptions[i]);
      const colOrder = shuffledIndices(colOptions.length).map((i) => colOptions[i]);
      let placedThis = false;
      for (const row of rowOrder) {
        for (const col of colOrder) {
          let free = true;
          for (let r = row; r < row + h && free; r++) {
            for (let c = col; c < col + w; c++) {
              if (occupied.has(r * BOARD_SIZE + c)) { free = false; break; }
            }
          }
          if (free) {
            for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) occupied.add(r * BOARD_SIZE + c);
            placed.push({ type, row, col, w, h, z });
            placedThis = true;
            break;
          }
        }
        if (placedThis) break;
      }
      if (!placedThis) { ok = false; break; }
    }
    if (ok) {
      const pieces = [];
      placed.forEach((p) => {
        pieces.push({ id: `dark-${p.type}`, type: p.type, owner: "dark", row: p.row, col: p.col, w: p.w, h: p.h, z: p.z });
        pieces.push({
          id: `light-${p.type}`,
          type: p.type,
          owner: "light",
          row: BOARD_SIZE - p.row - p.h,
          col: BOARD_SIZE - p.col - p.w,
          w: p.w,
          h: p.h,
          z: p.z,
        });
      });
      return pieces;
    }
  }
  return createInitialPieces(); // astronomically unlikely fallback
}

/* theme: a 0-1 "tension" reading of the current position, purely for
   the ambient hum's resonance rate (see audioRef.current.setTension) —
   never read by the AI or the rules. Combines, for each side's Cabeza:
   whether it's actually in danger of being crushed this move (full
   tension), a softer proximity-based ramp as any enemy piece merely
   gets physically closer (a rough, cheap proxy for "closer to being
   in danger" without a full move-legality lookahead), and how close it
   is to its own goal row ("about to win"). Takes the maximum across
   both sides and both conditions, since this is atmosphere for
   whoever's watching, not a per-player signal. */
export function computeTension(pieces) {
  let tension = 0;
  ["dark", "light"].forEach((owner) => {
    const cabeza = pieces.find((p) => p.type === "cabeza" && p.owner === owner);
    if (!cabeza) {
      tension = 1; // already crushed — as tense as it gets
      return;
    }
    const oppPlayer = opponentOf(owner);

    const dangerNow = cabezaInDanger(pieces, owner) ? 1 : 0;
    let minDist = Infinity;
    pieces.forEach((p) => {
      if (p.owner !== oppPlayer || p.type === "cabeza") return;
      const d = Math.max(Math.abs(p.row - cabeza.row), Math.abs(p.col - cabeza.col));
      if (d < minDist) minDist = d;
    });
    const proximityTension = minDist === Infinity ? 0 : Math.max(0, 1 - minDist / 3);
    tension = Math.max(tension, dangerNow, proximityTension * 0.7);

    const distToGoal = Math.abs(GOAL_ROW[owner] - cabeza.row);
    const winTension = Math.max(0, 1 - distToGoal / 3);
    tension = Math.max(tension, winTension);
  });
  return Math.min(1, tension);
}

export function makeBoardTexture() {
  const RES = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  const pxPerUnit = RES / SLAB;
  const pad = MARGIN * pxPerUnit;
  const squarePx = SQUARE_SIZE * pxPerUnit;

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, RES, RES);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const isGoal = r === 0 || r === BOARD_SIZE - 1;
      if (isGoal) {
        /* theme: a faint cyan wash instead of neutral gray — still the
           same functional marker (the two win-condition rows), just in
           the accent hue instead of a plain tint. */
        ctx.fillStyle = "rgba(77, 232, 255, 0.05)";
        ctx.fillRect(pad + c * squarePx, pad + r * squarePx, squarePx, squarePx);
      }
    }
  }

  /* theme: a very subtle radial vignette, purely a texture draw — gives
     the slab a faint sense of architectural depth (brighter center,
     darker toward the frame) without touching any geometry, raycasting,
     or the grid lines drawn as real 3D objects on top of this. */
  const vignette = ctx.createRadialGradient(RES / 2, RES / 2, RES * 0.2, RES / 2, RES / 2, RES * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, RES, RES);

  return new THREE.CanvasTexture(canvas);
}

/* A blurred copy of the grid+border pattern, baked into a texture via
   canvas 2D's own shadowBlur (a genuine gaussian-ish blur around each
   stroke) rather than just raising a crisp line's opacity again. This
   is what gives the grid actual "bloom" — a soft halo around each
   line — without a real WebGL post-process bloom pass, which the
   plain UMD three.js build loaded here doesn't include. */
export function makeGridGlowTexture() {
  const RES = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  const pxPerUnit = RES / GRID_EXTENT;
  ctx.lineCap = "round";
  ctx.shadowColor = "#4de8ff";
  ctx.shadowBlur = 32.2; // +15% per feedback ("increase glow / bloom of ... lattice lines 15%")
  ctx.strokeStyle = "rgba(130,228,255,0.9775)";
  ctx.lineWidth = 2.53; // +15%
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const p = i * SQUARE_SIZE * pxPerUnit;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, RES);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(RES, p);
    ctx.stroke();
  }
  ctx.shadowBlur = 38;
  ctx.strokeStyle = "rgba(150,235,255,0.95)";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, RES - 6, RES - 6);
  return new THREE.CanvasTexture(canvas);
}

/* theme: a world-space shader decal was tried here to make grid lines
   show through every piece regardless of size (a real limitation of
   plain depth-compositing transparency on short, small-footprint
   pieces) — reverted per feedback: it sampled the grid pattern by
   world X/Z on every fragment regardless of which face it belonged
   to, so a piece's SIDE faces (spanning a range of Y at one X/Z
   column) picked up the flat top-down grid pattern too, reading as a
   constant wireframe embossed on/inside the piece rather than genuine
   see-through, and much more visible on dark pieces than light ones
   by sheer contrast. Pieces are plain, ordinary transparency again —
   see the material below. */
export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];

  for (let i = 0; i <= BOARD_SIZE; i++) {
    const p = i * SQUARE_SIZE - OFF;
    lines.push(p, 0, -OFF, p, 0, OFF);
    lines.push(-OFF, 0, p, OFF, 0, p);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(
    geo,
    /* theme: additive blending is what actually reads as "glowing"
       against the dark board — brightness stacks where lines cross
       instead of just sitting at a flat alpha, which is the cheapest
       real glow available without a post-process bloom pass.
       depthWrite: false keeps the glow from fighting the grid's own
       later-drawn siblings (border, pieces) in the depth buffer. */
    new THREE.LineBasicMaterial({
      color: HEX.slate,
      transparent: true,
      opacity: 0.507, // +15%, then a further +5% per feedback ("increase all neon glow 5%")
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  gridLines.position.y = 0.004;
  /* theme: fixes a real bug reported as an "unexpected lighting
     continuity issue" when panning/rotating the camera with
     translucent pieces on the board. Three.js sorts same-renderOrder
     transparent objects by distance from camera, and this group's own
     bounding-sphere distance (the whole board, one object) versus any
     given piece's distance can flip which one is judged "farther" as
     the camera moves — when that flip happens, whichever object draws
     second changes, and since order affects the blended result, the
     piece's apparent brightness/grid visibility visibly jumps at that
     crossover, reading as a discontinuity rather than a smooth reveal.
     A fixed, negative renderOrder here (see also border/glow below)
     makes the whole grid group always draw before any piece
     regardless of distance, removing the flip entirely. */
  gridLines.renderOrder = -10;
  group.add(gridLines);

  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -OFF, 0, -OFF, OFF, 0, -OFF,
        OFF, 0, -OFF, OFF, 0, OFF,
        OFF, 0, OFF, -OFF, 0, OFF,
        -OFF, 0, OFF, -OFF, 0, -OFF,
      ],
      3
    )
  );
  const border = new THREE.LineSegments(
    borderGeo,
    /* theme: the board's defining edge, in the neutral structural-glow
       color rather than solid ink — this is the one line most worth
       spending the "thin luminous edge" language on, so it also gets
       the additive treatment above. */
    new THREE.LineBasicMaterial({
      color: HEX.structureEdge,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  border.position.y = 0.006;
  border.renderOrder = -10; // see gridLines.renderOrder comment above
  group.add(border);

  /* theme: the actual bloom halo — a soft-blurred copy of the same
     pattern, sitting just above the crisp lines, additively blended so
     it only ever brightens, never obscures. */
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_EXTENT, GRID_EXTENT),
    new THREE.MeshBasicMaterial({
      map: makeGridGlowTexture(),
      transparent: true,
      opacity: 0.7245, // +15%, then a further +5% per feedback ("increase all neon glow 5%")
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.009;
  glow.renderOrder = -10; // see gridLines.renderOrder comment above
  group.add(glow);

  return group;
}

/* Builds a piece's body mesh and its outline shell. Deliberately a
   different technique from themes/standard.js's buildPieceVisual, not
   the same function with different colors: the body here is
   translucent (a "digital glass" read), which is exactly what makes
   Standard's inflated-silhouette shell technique break (self-
   overlapping bevel geometry z-fights against itself once the
   material is translucent, see the depthWrite:false comment below) —
   Neon traces EdgesGeometry on a simplified sharp-cornered proxy
   instead. */
/* No at-rest Y offset on Neon's shell (see buildPieceVisual below —
   it's positioned at the same y as the body), so the chassis's roll
   animation has nothing to strip here. Kept as an explicit 0 rather
   than omitted, so `theme.outlineYOffset ?? 0` reads as "this theme
   deliberately has none" rather than "this theme forgot to declare
   one." */
export const outlineYOffset = 0;

/* Modal chrome — see themes/standard.js's modalBackdrop/modalSurface
   for why these are dedicated tokens rather than derived from
   COLORS.cream inline. Values match Neon's own original Info-overlay
   styling (a near-black backdrop and panel, not cream-with-opacity). */
export const modalBackdrop = "rgba(2,4,8,0.6)";
export const modalSurface = "rgba(8,11,16,0.88)";

/* Endpoints of the canvas mount's own radial-gradient background. */
export const canvasGradientStart = "#141A22";
export const canvasGradientEnd = "#05070a";

/* True: the chassis's Sound On/Off control is meaningful for this
   theme (see themes/standard.js's hasAudio for why this is declared
   metadata rather than a chassis branch). */
export const hasAudio = true;
export function createAudio() {
  return createSoundscape();
}

/* Neon's ambient visual FX — title flicker/spark/letter-burn, the turn
   halo's slow breathing pulse, VHS glitch (regular + rare Scanimate/
   Vidicon-burn variants), localized jitter-tear, board arcs, the
   crawling voxel mass, the floor wave, and the digital-interior/
   voxel-shatter piece effects — plus the move-triggered weight-pulse/
   landing-shockwave/glitch-burst effects animateStep calls directly.
   Ported from el-cabeza-neon-3d.html's scene-setup effect and its
   five separate ambient-effect useEffects, consolidated into one
   mountAmbientEffects call per ARCHITECTURE.md's plugin contract.

   `t` (= three.current) is captured once, matching the original's own
   assumption that three.current is mutated in place after the chassis
   creates it (never reassigned wholesale) — every property added here
   (fxItems, pulseSquare, etc.) is visible to the chassis's own
   animateStep through that same object. */
export function mountAmbientEffects(refs, helpers) {
  const { titleRef, titleWrapRef, turnHaloRef, turnLabelRef, cardRef, fxOverlayRef } = refs;
  const { three, windingDownRef, audio } = helpers;
  const t = three.current;

  const fxGroup = new THREE.Group();
  const weightGroup = new THREE.Group();
  t.boardGroup.add(weightGroup, fxGroup);
  t.weightGroup = weightGroup;
  t.fxGroup = fxGroup;
  t.fxItems = [];
  t.digitalGlitchItems = [];
  t.voxelShatterItems = [];
  t.crawlMassItems = [];
  t.shockwaveItems = [];
  t.landingParticleItems = [];
  let lastLandingParticleTickAt = null;
  t.softGlowTex = makeSoftGlowTexture();
  const voxelDummy = new THREE.Object3D(); // scratch object reused every frame for instance-matrix writes

  function spawnGlitchBurst(pos, color) {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const size = 0.03 + Math.random() * 0.05;
      const geo = new THREE.PlaneGeometry(size, size * (0.3 + Math.random() * 0.5));
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.5,
        0.02 + Math.random() * 0.3,
        pos.z + (Math.random() - 0.5) * 0.5
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      t.fxGroup.add(mesh);
      t.fxItems.push({ mesh, born: performance.now(), life: 180 + Math.random() * 220, peak: 0.55 + Math.random() * 0.35 });
    }
  }
  t.spawnGlitchBurst = spawnGlitchBurst;

  /* theme: a soft, oversized bloom over one square (or a piece's whole
     multi-square footprint) that fades in then out — `mode: "release"`
     dims it (weight lifting off), `mode: "apply"` brightens it (weight
     landing) in the mover's own accent color. Reworked from a hard-
     edged flat-color quad to a soft radial texture, sized well beyond
     the actual footprint and capped at a low peak opacity, per
     feedback that the landing glow read as too bright and sharp-
     lined — this is meant to be felt more than clearly seen. */
  function pulseSquare(row, col, w, h, mode, accentColor) {
    const cx = (col + w / 2) * SQUARE_SIZE - OFF;
    const cz = (row + h / 2) * SQUARE_SIZE - OFF;
    const isApply = mode === "apply";
    const sizeMul = isApply ? 1.9 : 1.4;
    const geo = new THREE.PlaneGeometry(w * SQUARE_SIZE * sizeMul, h * SQUARE_SIZE * sizeMul);
    const mat = new THREE.MeshBasicMaterial({
      map: t.softGlowTex,
      color: isApply ? accentColor || HEX.glowCyan : 0x000000,
      transparent: true,
      opacity: 0,
      blending: isApply ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.011, cz);
    t.weightGroup.add(mesh);
    t.fxItems.push({
      mesh,
      born: performance.now(),
      life: isApply ? 650 : 420,
      peak: isApply ? 0.2 : 0.3,
      envelope: "pulse",
    });
  }
  t.pulseSquare = pulseSquare;

  /* theme: the landing IMPACT shockwave/bloom — redesigned per
     feedback into a real Rayleigh-surface-wave simulation traveling
     through the board's own grid mesh, rather than a simple
     expanding outline. A Rayleigh wave is a surface wave whose
     displacement propagates outward from an impact point and decays
     with both distance and time — modeled here as a literal
     per-vertex vertical (Y) displacement of the actual grid LINES
     around the landing footprint (sampled at fine sub-steps along
     each real horizontal/vertical grid line within 2 squares of the
     footprint), animated in the tick loop below as a traveling,
     Gaussian-windowed sine pulse whose distance is measured with a
     Chebyshev-style "distance outside the footprint rectangle"
     metric — NOT Euclidean radius — so the wavefront it rides
     propagates outward following the grid's own orthogonal
     horizontal/vertical lines rather than expanding as a circle,
     exactly as specified. Bloom (the quick footprint-sized flash) is
     unchanged from last round. Range still defaults to 0.5 squares
     and scales with mass (w*h*z, mass^0.25) exactly as before, now
     used as the wave's spatial decay length rather than a hard
     geometry cutoff — a heavier piece's ripple carries visibly
     farther before fading, a lighter piece's dies out faster, which
     is the physically-correct way "impact energy" should affect a
     real decaying wave. "Subtle randomizations" per feedback: wave
     speed, amplitude, and duration all vary a little per instance. */
  function spawnLandingShockwave(row, col, w, h, z, accentColor) {
    const cx = (col + w / 2) * SQUARE_SIZE - OFF;
    const cz = (row + h / 2) * SQUARE_SIZE - OFF;
    const baseW = w * SQUARE_SIZE;
    const baseH = h * SQUARE_SIZE;
    const mass = Math.max(1, w * h * z);
    const rangeSquares = 0.5 * Math.pow(mass, 0.25);
    const decayLength = rangeSquares * SQUARE_SIZE;

    // Quick rectangular bloom fill — a flat, untextured additive
    // plane at the footprint's own size (not round, per spec).
    const bloomMat = new THREE.MeshBasicMaterial({
      color: accentColor || HEX.glowCyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bloom = new THREE.Mesh(new THREE.PlaneGeometry(baseW, baseH), bloomMat);
    bloom.rotation.x = -Math.PI / 2;
    bloom.position.set(cx, 0.013, cz);
    t.weightGroup.add(bloom);

    // Sample the real grid lines within K squares of the footprint,
    // each broken into fine sub-steps (so the traveling wave has
    // enough resolution to show real curvature, not a jagged
    // zig-zag), built directly as LineSegments pairs (independent
    // segments, not one connected strip — otherwise stitching
    // multiple separate grid lines into one buffer would draw
    // spurious diagonals between them).
    const K = 2;
    const xMin = col * SQUARE_SIZE - OFF, xMax = (col + w) * SQUARE_SIZE - OFF;
    const zMin = row * SQUARE_SIZE - OFF, zMax = (row + h) * SQUARE_SIZE - OFF;
    const spanXMin = Math.max(-OFF, xMin - K * SQUARE_SIZE);
    const spanXMax = Math.min(OFF, xMax + K * SQUARE_SIZE);
    const spanZMin = Math.max(-OFF, zMin - K * SQUARE_SIZE);
    const spanZMax = Math.min(OFF, zMax + K * SQUARE_SIZE);
    const STEP = 0.08;

    // Chebyshev-style "distance outside the footprint rectangle" —
    // 0 anywhere inside/on the footprint, growing outward along
    // straight orthogonal offset contours (a rounded-rectangle-ish
    // front, never a circle) rather than Euclidean radius.
    const distOutside = (x, zc) => {
      const dx = x < xMin ? xMin - x : x > xMax ? x - xMax : 0;
      const dz = zc < zMin ? zMin - zc : zc > zMax ? zc - zMax : 0;
      return Math.max(dx, dz);
    };

    const positions = [];
    const distances = [];
    const addLine = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.max(1, Math.round(len / STEP));
      let prevX = x0, prevZ = z0, prevD = distOutside(x0, z0);
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        const x = x0 + (x1 - x0) * f;
        const zc = z0 + (z1 - z0) * f;
        const d = distOutside(x, zc);
        positions.push(prevX, 0, prevZ, x, 0, zc);
        distances.push(prevD, d);
        prevX = x; prevZ = zc; prevD = d;
      }
    };
    for (let r = row - K; r <= row + h + K; r++) {
      const lz = r * SQUARE_SIZE - OFF;
      if (lz >= -OFF && lz <= OFF) addLine(spanXMin, lz, spanXMax, lz);
    }
    for (let c = col - K; c <= col + w + K; c++) {
      const lx = c * SQUARE_SIZE - OFF;
      if (lx >= -OFF && lx <= OFF) addLine(lx, spanZMin, lx, spanZMax);
    }

    const rippleGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.Float32BufferAttribute(new Float32Array(positions), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    rippleGeo.setAttribute("position", posAttr);
    const rippleMat = new THREE.LineBasicMaterial({
      color: accentColor || HEX.glowCyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ripple = new THREE.LineSegments(rippleGeo, rippleMat);
    t.weightGroup.add(ripple);

    // Per feedback ("must be toned down & slowed down & proportional
    // to the weight/size of the piece") — every intensity/speed
    // parameter below is now keyed off massFactor (0 for the
    // lightest pieces, up to 3 for Opa) rather than a fixed
    // baseline: lighter pieces get a barely-there ripple, heavier
    // ones a more visible (but still restrained) one, and all of
    // them are quieter and slower than before across the board.
    const massFactor = Math.log2(mass);
    t.shockwaveItems.push({
      bloom,
      bloomMat,
      ripple,
      rippleMat,
      posAttr,
      distances,
      born: performance.now(),
      duration: 1100 + massFactor * 220 + Math.random() * 300,
      bloomPeak: (0.14 + massFactor * 0.055) * (0.85 + Math.random() * 0.3),
      ripplePeak: (0.18 + massFactor * 0.07) * (0.85 + Math.random() * 0.3),
      waveSpeed: 1.3 + massFactor * 0.15 + Math.random() * 0.3, // world units/sec — much slower than before
      wavelength: SQUARE_SIZE * 0.3,
      sigma: SQUARE_SIZE * 0.24,
      amplitude: (0.022 + massFactor * 0.012) * (0.85 + Math.random() * 0.3),
      decayLength,
      decayTau: 0.55 + massFactor * 0.15, // how long the ripple lingers before fully damping out
    });
  }
  t.spawnLandingShockwave = spawnLandingShockwave;

  /* theme: the same landing-impact debris shed used for the move
     indicator's own corner-bracket reticle (see buildMoveIndicator),
     now applied to a tumbling piece's own landing — small glowing
     chips, differently sized, scattering outward under a bit of
     gravity and burning out fast. "Sometimes", not guaranteed, same as
     the reticle's own version, so it reads as a debris flourish rather
     than a fixed cue tied to the game rules. Count and size scale with
     the piece's own mass — the same w*h*z/massFactor convention
     spawnLandingShockwave already uses — so Opa kicks up a real
     handful and Turrito barely sparks. */
  function spawnLandingParticles(row, col, w, h, z, accentColor) {
    if (Math.random() > 0.6) return;
    const cx = (col + w / 2) * SQUARE_SIZE - OFF;
    const cz = (row + h / 2) * SQUARE_SIZE - OFF;
    const mass = Math.max(1, w * h * z);
    const massFactor = Math.log2(mass);
    const count = Math.round(3 + massFactor * 3 + Math.random() * 2);
    const color = accentColor || HEX.glowCyan;
    for (let i = 0; i < count; i++) {
      const size = (0.014 + Math.random() * 0.032) * (0.8 + massFactor * 0.18);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 1.0) * (0.85 + massFactor * 0.12);
      mesh.position.set(cx, 0.02, cz);
      t.fxGroup.add(mesh);
      t.landingParticleItems.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 0.8 + Math.random() * 0.8,
        floorY: 0.02,
        born: performance.now(),
        life: 260 + Math.random() * 260,
      });
    }
  }
  t.spawnLandingParticles = spawnLandingParticles;

  /* theme: an occasional bolt of electricity between two random
     pieces currently on the board — a rare, atmospheric flourish, not
     tied to any move. Reads live piece MESH positions from pieceGroup
     each time it fires (rather than the React `pieces` state, which
     this once-on-mount effect can't see fresh), so it always reflects
     whatever is actually on the board at that moment, captures
     included. Purely decorative: it never reads or writes game
     state, only THREE.js objects it created itself.

     Per feedback, one random STYLE among several is picked each time
     this fires — same frequency as before, more variety in what
     actually appears — rather than always the same jagged zigzag.
     Every style stays off-white (0xdff6ff) with at most a cyan-tinted
     halo layer as an accent, per feedback that color itself should
     stay downplayed regardless of which named idea (Snapping Spark,
     Plasma Ribbon, etc.) inspired a given style's SHAPE/behavior. */
  function makeArcLine(positions, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.LineSegments(geo, mat);
    t.fxGroup.add(line);
    return line;
  }

  // A single jagged strand between posA/posB — the shared geometry
  // behind Snapping Spark, Pulsing Discharge, Intermittent Contact,
  // and (doubled up) Chaotic Discharge; only each style's ENVELOPE
  // (and, for Chaotic Discharge, strand count) actually differs.
  function jaggedStrandPositions(posA, posB, jitterScale) {
    const dx = posB.x - posA.x, dz = posB.z - posA.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len; // perpendicular to A->B, for the kink/branch direction

    // More segments, and jitter applied perpendicular to the strand
    // (plus a little along it) rather than a diagonal random offset —
    // per feedback ("more jagged, erratic") this reads as the bolt
    // actually kinking back and forth, not just a wavier line.
    const segments = 7 + Math.floor(Math.random() * 4);
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      const perp = i > 0 && i < segments ? (Math.random() - 0.5) * 0.55 * jitterScale : 0;
      const along = i > 0 && i < segments ? (Math.random() - 0.5) * 0.12 * jitterScale : 0;
      pts.push(
        posA.x + dx * f + nx * perp + (dx / len) * along,
        0.12 + Math.random() * 0.35,
        posA.z + dz * f + nz * perp + (dz / len) * along
      );
    }
    const positions = [];
    for (let i = 0; i < segments; i++) {
      positions.push(
        pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
        pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]
      );
    }

    // Branching forks, per feedback ("branching lightning bolt-like"):
    // 1-2 short spurs peeling off the main strand at a random interior
    // vertex, angled away from the main path and tapering toward a
    // point — real lightning's forward-branching character, which a
    // single kinked line alone doesn't give.
    const branchCount = Math.random() < 0.6 ? 1 : 2;
    for (let b = 0; b < branchCount; b++) {
      const originIdx = 1 + Math.floor(Math.random() * (segments - 1));
      let bx = pts[originIdx * 3], by = pts[originIdx * 3 + 1], bz = pts[originIdx * 3 + 2];
      const branchSegs = 2 + Math.floor(Math.random() * 2);
      const side = Math.random() < 0.5 ? 1 : -1;
      const branchLen = len * (0.12 + Math.random() * 0.16);
      for (let s = 1; s <= branchSegs; s++) {
        const f = s / branchSegs;
        const spread = (0.3 + Math.random() * 0.3) * side * branchLen * f;
        const forward = branchLen * f * 0.6;
        const nbx = pts[originIdx * 3] + (dx / len) * forward + nx * spread;
        const nby = 0.1 + Math.random() * 0.3;
        const nbz = pts[originIdx * 3 + 2] + (dz / len) * forward + nz * spread;
        positions.push(bx, by, bz, nbx, nby, nbz);
        bx = nbx; by = nby; bz = nbz;
      }
    }

    return positions;
  }

  // A smooth curved sample along posA -> posB, bowed sideways by
  // `bow` at the midpoint (a simple quadratic-bezier-style offset) —
  // Plasma Ribbon (a gentle, near-straight wave) and Magnetically
  // Driven Arc (a much more pronounced single bow) both build on
  // this, just with very different bow/sample counts.
  function curvedStrandPositions(posA, posB, bow, samples) {
    const mx = (posA.x + posB.x) / 2, mz = (posA.z + posB.z) / 2;
    const dx = posB.x - posA.x, dz = posB.z - posA.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len; // perpendicular to A->B, for the bow offset
    const ctrlX = mx + nx * bow, ctrlZ = mz + nz * bow;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      // Quadratic bezier through (posA, control, posB).
      const omf = 1 - f;
      const x = omf * omf * posA.x + 2 * omf * f * ctrlX + f * f * posB.x;
      const z = omf * omf * posA.z + 2 * omf * f * ctrlZ + f * f * posB.z;
      pts.push(x, 0.14 + Math.sin(f * Math.PI) * 0.18, z);
    }
    const positions = [];
    for (let i = 0; i < samples; i++) {
      positions.push(
        pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
        pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]
      );
    }
    return positions;
  }

  // A short helical/spiral path winding around the A->B axis —
  // Rotating Helix. The "rotating" character reads as the shape of a
  // multi-turn spiral itself rather than an actual live rotation
  // animation — at this effect's ~200-400ms lifetime, a real twist
  // wouldn't be perceptible anyway.
  function helixStrandPositions(posA, posB, turns, radius, samples) {
    const dx = posB.x - posA.x, dz = posB.z - posA.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len; // along A->B
    const nx = -uz, nz = ux; // perpendicular, the spiral's own radial direction
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      const angle = f * Math.PI * 2 * turns;
      const r = radius * Math.sin(f * Math.PI); // tapers to a point at both ends
      const px = posA.x + ux * len * f + nx * Math.cos(angle) * r;
      const pz = posA.z + uz * len * f + nz * Math.cos(angle) * r;
      pts.push(px, 0.14 + Math.sin(angle) * r, pz);
    }
    const positions = [];
    for (let i = 0; i < samples; i++) {
      positions.push(
        pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
        pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]
      );
    }
    return positions;
  }

  const ARC_STYLES = [
    // Snapping Spark: the original jagged zigzag, one quick clean pulse.
    (posA, posB) => {
      const life = 200 + Math.random() * 180;
      const line = makeArcLine(jaggedStrandPositions(posA, posB, 1), 0xdff6ff);
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.8, envelope: "pulse" });
    },
    // Plasma Ribbon: a smooth, gently wavy curve (barely bowed, many
    // samples) rather than a jagged strand, held a touch longer so
    // its smoothness actually reads.
    (posA, posB) => {
      const life = 260 + Math.random() * 200;
      const bow = (Math.random() - 0.5) * 0.5;
      const line = makeArcLine(curvedStrandPositions(posA, posB, bow, 10), 0xdff6ff);
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.75, envelope: "pulse" });
    },
    // Chaotic Discharge: 2-3 jagged strands firing together between
    // the same two points, each its own independent random path —
    // messier/denser than a single Snapping Spark.
    (posA, posB) => {
      const life = 200 + Math.random() * 160;
      const strandCount = 2 + Math.floor(Math.random() * 2);
      for (let s = 0; s < strandCount; s++) {
        const line = makeArcLine(jaggedStrandPositions(posA, posB, 1.3), 0xdff6ff);
        t.fxItems.push({ mesh: line, born: performance.now() + s * 15, life, peak: 0.6, envelope: "pulse" });
      }
    },
    // Rotating Helix: the spiral path above, cyan-tinted (this
    // effect's one deliberate accent, per "possible tinges... of the
    // NEON cyan color motif") rather than plain off-white.
    (posA, posB) => {
      const life = 260 + Math.random() * 180;
      const line = makeArcLine(helixStrandPositions(posA, posB, 2.5, 0.16, 24), 0x9fe9ff);
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.75, envelope: "pulse" });
    },
    // Pulsing Discharge: the jagged strand again, but strobing through
    // several rapid pulses instead of one smooth rise-fall.
    (posA, posB) => {
      const life = 320 + Math.random() * 160;
      const line = makeArcLine(jaggedStrandPositions(posA, posB, 1), 0xdff6ff);
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.8, envelope: "multipulse", pulses: 3 });
    },
    // Magnetically Driven Arc: one pronounced single bow to the side,
    // as if deflected by a field, rather than a straight or jagged path.
    (posA, posB) => {
      const life = 220 + Math.random() * 180;
      const dx = posB.x - posA.x, dz = posB.z - posA.z;
      const span = Math.hypot(dx, dz);
      const bow = (0.35 + Math.random() * 0.35) * span * (Math.random() < 0.5 ? -1 : 1);
      const line = makeArcLine(curvedStrandPositions(posA, posB, bow, 14), 0xdff6ff);
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.8, envelope: "pulse" });
    },
    // Intermittent Contact: a "loose connector" — 2-3 short random ON
    // windows within its lifetime rather than any smooth fade at all.
    (posA, posB) => {
      const life = 380 + Math.random() * 200;
      const line = makeArcLine(jaggedStrandPositions(posA, posB, 0.8), 0xdff6ff);
      const windowCount = 2 + Math.floor(Math.random() * 2);
      const flickerWindows = [];
      for (let w = 0; w < windowCount; w++) {
        const start = Math.random() * 0.8;
        flickerWindows.push([start, Math.min(1, start + 0.05 + Math.random() * 0.08)]);
      }
      t.fxItems.push({ mesh: line, born: performance.now(), life, peak: 0.85, envelope: "flicker", flickerWindows });
    },
  ];

  function spawnArc(posA, posB) {
    const style = ARC_STYLES[Math.floor(Math.random() * ARC_STYLES.length)];
    style(posA, posB);
  }

  let arcTimer;
  function fireArc() {
    if (windingDownRef.current) return; // stop spawning new ones once a win fires
    const meshPieces = t.pieceGroup.children.filter((c) => c.userData.kind === "piece");
    if (meshPieces.length >= 2) {
      const a = meshPieces[Math.floor(Math.random() * meshPieces.length)];
      let b = a;
      for (let guard = 0; guard < 6 && b === a; guard++) {
        b = meshPieces[Math.floor(Math.random() * meshPieces.length)];
      }
      if (b !== a) {
        spawnArc(a.position, b.position);
        audio.playArc();
      }
    }
    arcTimer = setTimeout(fireArc, 13333 + Math.random() * 25000); // unchanged frequency — variety, not more of them, per feedback
  }
  /* Interlocking blocks that visibly RECONFIGURE as the mass moves,
     like current finding its own path — "stray electrons traversing a
     microchip." Spawns a fast SERIES of independent, short-lived voxel
     clusters ("generations") timed along one path from corner to
     corner: each is its own random flood-fill (so consecutive
     generations are never quite the same shape — that difference IS
     the morphing), anchored a little further along the path than the
     last with a bit of lateral jitter (an electron finding its own
     way, not a ruler-straight slide), and overlapping its neighbors'
     fade in/out so the mass reads as continuous despite no single mesh
     ever translating. Floods across the same CRAWL_SUB-finer sub-grid
     (see CRAWL_SUB/CRAWL_VOXEL). */
  const CRAWL_GRID = BOARD_SIZE * CRAWL_SUB;
  function pickCrawlMassVoxels(count, anchorR, anchorC) {
    const startR = anchorR != null ? anchorR : Math.floor(Math.random() * CRAWL_GRID);
    const startC = anchorC != null ? anchorC : Math.floor(Math.random() * CRAWL_GRID);
    const seen = new Set([startR + "," + startC]);
    const cells = [[startR, startC]];
    const frontier = [[startR, startC]];
    const dirs4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (cells.length < count && frontier.length) {
      const idx = Math.floor(Math.random() * frontier.length);
      const [r, c] = frontier[idx];
      const shuffled = dirs4.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let extended = false;
      for (const [dr, dc] of shuffled) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= CRAWL_GRID || nc < 0 || nc >= CRAWL_GRID) continue;
        const key = nr + "," + nc;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push([nr, nc]);
        frontier.push([nr, nc]);
        extended = true;
        break;
      }
      if (!extended) frontier.splice(idx, 1); // dead end — stop growing from here
    }
    return cells;
  }

  // Timers for every generation queued by the CURRENT spawnCrawlWave
  // call, so a win (or unmount, via dispose() below) can cancel a
  // whole in-flight crossing rather than only stopping the next one
  // from being scheduled. Cleared and emptied at the start of every
  // fresh spawnCrawlWave call too — only one crossing is ever in
  // flight at a time.
  let crawlStepTimers = [];

  // One generation: a single random flood-fill cluster, anchored at
  // (anchorR, anchorC), that fades in, holds briefly, and fades out —
  // exactly the old per-item envelope, just no longer translating
  // (see the crawlMassItems tick loop below). Each cell gets its own
  // random peak-brightness multiplier ("brightness, opacity
  // variance"), so a generation doesn't pulse as one flat block.
  function spawnCrawlGeneration(anchorR, anchorC, lifeMs) {
    const voxels = pickCrawlMassVoxels(22 + Math.floor(Math.random() * 22), anchorR, anchorC); // 22-43 voxels per generation
    if (voxels.length < 12) return; // boxed in near an edge — skip this one generation, the rest of the crossing carries on

    const avgR = voxels.reduce((s, [r]) => s + r, 0) / voxels.length;
    const avgC = voxels.reduce((s, [, c]) => s + c, 0) / voxels.length;
    const centerX = (avgC + 0.5) * CRAWL_VOXEL - OFF;
    const centerZ = (avgR + 0.5) * CRAWL_VOXEL - OFF;
    if (Math.abs(centerX) > OFF || Math.abs(centerZ) > OFF) return; // drifted off the playable board — skip silently

    const group = new THREE.Group();
    group.position.set(centerX, 0, centerZ);
    const materials = [];
    voxels.forEach(([r, c]) => {
      const lx = (c - avgC) * CRAWL_VOXEL;
      const lz = (r - avgR) * CRAWL_VOXEL;
      const cellBrightness = 0.55 + Math.random() * 0.45; // per-cell variance, not a uniform block

      // Per feedback ("more blur and glow and bloom... as if not
      // completely able to be seen, [as if] the board itself is not
      // purely transparent"): a third, much larger and dimmer bloom
      // layer underneath everything else, for the soft light-scatter
      // a hazy/frosted surface would actually produce — the halo
      // alone read as a tighter glow, not genuine bloom spread.
      const bloomSize = CRAWL_VOXEL * 3.5; // slightly larger per feedback
      const bloomMat = new THREE.MeshBasicMaterial({
        map: t.softGlowTex,
        color: 0x8fe8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const bloom = new THREE.Mesh(new THREE.PlaneGeometry(bloomSize, bloomSize), bloomMat);
      bloom.rotation.x = -Math.PI / 2;
      bloom.position.set(lx, 0.010, lz);
      group.add(bloom);

      // The halo, enlarged from before for a softer spread — pulled
      // back from an initial 1.7x per feedback that too much round
      // glow was itself rounding off the squares' own shape; the new
      // bloom layer above now carries most of the extra spread.
      const haloSize = CRAWL_VOXEL * 1.4; // slightly larger per feedback
      const haloMat = new THREE.MeshBasicMaterial({
        map: t.softGlowTex,
        color: 0x8fe8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(haloSize, haloSize), haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(lx, 0.012, lz);
      group.add(halo);

      // The square itself — reverted back to an untextured flat fill
      // per feedback: putting the round soft-glow texture on the
      // core too (the previous pass) read as the squares themselves
      // turning into circles, not just gaining bloom around them. The
      // new bloom layer above and the enlarged halo below are what
      // now carry all the actual blur/glow — the core's own job is
      // just to keep the mass legible as a grid of squares, capped
      // well under fully opaque so it still doesn't look like solid,
      // fully-visible geometry.
      const coreSize = CRAWL_VOXEL * 0.95; // slightly larger per feedback
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xd6f9ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(new THREE.PlaneGeometry(coreSize, coreSize), coreMat);
      core.rotation.x = -Math.PI / 2;
      core.position.set(lx, 0.014, lz);
      group.add(core);

      // Overall ceiling pulled down another 10% per feedback ("the
      // brightest is too bright... but I do want the [per-cell]
      // variance to be present") — applied as a flat multiplier on
      // top of the existing per-cell random range, so the SPREAD
      // between dim and bright cells stays exactly as wide, just
      // scaled down together. Reduced a further 15% (0.9 -> 0.765)
      // per feedback to dim the whole crawling swarm overall.
      const BRIGHTNESS_CEILING = 0.26; // dimmed a further 60% (0.65 -> 0.26) per feedback
      materials.push({
        bloom: bloomMat, halo: haloMat, core: coreMat,
        bloomPeak: (0.28 + Math.random() * 0.12) * cellBrightness * BRIGHTNESS_CEILING,
        haloPeak: (0.55 + Math.random() * 0.15) * cellBrightness * BRIGHTNESS_CEILING,
        // Capped well under fully opaque per feedback ("not
        // completely able to be seen") — was 0.85-1.0.
        corePeak: (0.55 + Math.random() * 0.15) * cellBrightness * BRIGHTNESS_CEILING,
        // Small per-voxel timing offset for the fade envelope (see the
        // crawlMassItems tick loop) — makes individual pixels within a
        // generation light up and die out a beat apart from their
        // neighbors instead of the whole cluster fading as one flat
        // block, for a true "crawling" pixel-fade feel.
        phase: (Math.random() * 2 - 1) * 0.12,
      });
    });
    t.weightGroup.add(group);

    t.crawlMassItems.push({ group, born: performance.now(), duration: lifeMs, materials });
  }

  // One full corner-to-corner crossing: schedules a generation every
  // STEP_MS along a straight path between two (inset, so the first/
  // last flood-fills have room to grow) board corners, each anchor
  // jittered a couple voxels off the straight line so the path itself
  // wanders slightly rather than reading as a ruler-drawn line.
  // steps*STEP_MS totals the requested "~3 seconds... corner to the
  // other," with per-crossing variance for interest.
  function spawnCrawlWave() {
    crawlStepTimers.forEach(clearTimeout);
    crawlStepTimers = [];

    const inset = 3;
    const cornerPts = [
      [inset, inset], [inset, CRAWL_GRID - 1 - inset],
      [CRAWL_GRID - 1 - inset, inset], [CRAWL_GRID - 1 - inset, CRAWL_GRID - 1 - inset],
    ];
    const a = cornerPts[Math.floor(Math.random() * cornerPts.length)];
    let b = a;
    while (b === a) b = cornerPts[Math.floor(Math.random() * cornerPts.length)];

    // Slowed a further 40% per feedback (was 3200-4200ms / 270ms step).
    const duration = (3200 + Math.random() * 1000) * 1.4;
    const STEP_MS = 270 * 1.4;
    const GEN_LIFE_MS = STEP_MS * 2.4; // consecutive generations overlap, so the mass never visibly gaps
    const steps = Math.max(3, Math.round(duration / STEP_MS));

    // Occasionally hesitates before a step instead of advancing on a
    // perfectly metronomic beat — per feedback ("it may sometimes even
    // pause to think about which way it wants to move"). A ~25% chance
    // per step of a longer-than-usual gap before it, rather than a
    // fixed i*STEP_MS schedule.
    let elapsed = 0;
    for (let i = 0; i < steps; i++) {
      if (i > 0) elapsed += Math.random() < 0.25 ? STEP_MS * (0.8 + Math.random() * 1.6) : STEP_MS;
      const delay = elapsed;
      const timer = setTimeout(() => {
        if (windingDownRef.current) return;
        const along = steps <= 1 ? 0 : i / (steps - 1);
        const jitter = () => (Math.random() * 2 - 1) * 1.5;
        const anchorR = Math.round(a[0] + (b[0] - a[0]) * along + jitter());
        const anchorC = Math.round(a[1] + (b[1] - a[1]) * along + jitter());
        spawnCrawlGeneration(
          Math.max(0, Math.min(CRAWL_GRID - 1, anchorR)),
          Math.max(0, Math.min(CRAWL_GRID - 1, anchorC)),
          GEN_LIFE_MS
        );
      }, delay);
      crawlStepTimers.push(timer);
    }
  }

  let crawlTimer;
  function fireCrawl() {
    if (windingDownRef.current) return; // stop spawning new ones once a win fires
    spawnCrawlWave();
    // Widened further per feedback (was 35000-100000ms) to make the
    // crawling mass cross the board less often still — only how often
    // a new crossing starts, not the crossing itself.
    crawlTimer = setTimeout(fireCrawl, 55000 + Math.random() * 95000);
  }
  /* theme: a rare, large-scale directional brightness wave that
     sweeps across most of the board's surface — a much bigger,
     softer cousin of the small crawling square wave above, reading
     as a broad "digital brightness interpolation" pass over the
     floor (roughly 50-100 of the board's ~100 cells, depending on
     BOARD_SIZE) rather than a thin trail of a handful of dots.
     Travels in a fully randomized direction each time, and uses the
     same fxItems lifecycle as everything else. */
  function spawnFloorWave() {
    /* Rebuilt per feedback: the near-full-cell planes were reading
       as blown-out gaussian blobs rather than distinct squares.
       Shrunk each cell's mark down to the same "miniature square"
       scale as the small crawling wave above (so the soft-glow
       texture reads as a crisp point of bloom, not a blur), raised
       peak brightness ~40%, and added sparse connecting traces
       between some adjacent active cells so the wave reads as
       "interconnected groups of squares" traveling together rather
       than a field of isolated dots. */
    const angle = Math.random() * Math.PI * 2;
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };

    const active = new Map(); // "r,c" -> cell data, so adjacency lookups below are O(1)
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (Math.random() < 0.15) continue; // "somewhat randomized" coverage, not a perfectly uniform wipe
        const cx = (c + 0.5) * SQUARE_SIZE - OFF;
        const cz = (r + 0.5) * SQUARE_SIZE - OFF;
        active.set(`${r},${c}`, { r, c, cx, cz, proj: cx * dir.x + cz * dir.z });
      }
    }
    const cells = Array.from(active.values());
    if (cells.length < 50) return; // too sparse to read as a coherent wave — skip silently

    let minP = Infinity, maxP = -Infinity;
    cells.forEach((cell) => {
      if (cell.proj < minP) minP = cell.proj;
      if (cell.proj > maxP) maxP = cell.proj;
    });
    const span = Math.max(0.0001, maxP - minP);
    const waveDuration = 1800 + Math.random() * 1000; // total time for the wave to cross the board
    const now0 = performance.now();
    const bornOf = new Map();

    cells.forEach((cell) => {
      const travelFrac = (cell.proj - minP) / span;
      const born = now0 + travelFrac * waveDuration + Math.random() * 90; // small per-cell jitter — "somewhat randomized"
      bornOf.set(`${cell.r},${cell.c}`, born);

      // A miniature square, not a near-full-cell blob.
      const size = SQUARE_SIZE * (0.3 + Math.random() * 0.16);
      const geo = new THREE.PlaneGeometry(size, size);
      const mat = new THREE.MeshBasicMaterial({
        map: t.softGlowTex,
        color: HEX.structureEdge,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cell.cx, 0.012, cell.cz);
      t.weightGroup.add(mesh);
      t.fxItems.push({
        mesh,
        born,
        life: 650 + Math.random() * 250, // overlaps neighbors' timing into a soft gradient front rather than a hard line
        peak: 0.14 + Math.random() * 0.08, // ~40% brighter than before (was 0.1-0.16)
        envelope: "pulse",
      });
    });

    // Sparse connecting traces between some adjacent active cells —
    // not every neighbor gets one, so the squares read as loosely
    // "interconnected groups" rather than either isolated dots or a
    // solid connected grid.
    cells.forEach((cell) => {
      [[0, 1], [1, 0]].forEach(([dr, dc]) => {
        const key = `${cell.r + dr},${cell.c + dc}`;
        const other = active.get(key);
        if (!other || Math.random() < 0.55) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([cell.cx, 0.013, cell.cz, other.cx, 0.013, other.cz], 3)
        );
        const mat = new THREE.LineBasicMaterial({
          color: HEX.structureEdge,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const line = new THREE.LineSegments(geo, mat);
        t.weightGroup.add(line);
        t.fxItems.push({
          mesh: line,
          born: Math.min(bornOf.get(`${cell.r},${cell.c}`), bornOf.get(key)),
          life: 500 + Math.random() * 200,
          peak: 0.07 + Math.random() * 0.04, // dimmer than the squares — a faint connective trace, not competing for attention
          envelope: "pulse",
        });
      });
    });
  }

  let floorWaveTimer;
  function fireFloorWave() {
    if (windingDownRef.current) return; // stop spawning new ones once a win fires
    spawnFloorWave();
    floorWaveTimer = setTimeout(fireFloorWave, 75000 + Math.random() * 90000);
  }
  /* theme: the digital-interior piece effect, rebuilt from scratch
     per feedback — the previous version just read as "pieces
     randomly lighting up." This one is a genuine traveling x-ray
     scan: a wave passes sequentially through a short, spatially-
     coherent run of pieces, and at each one, TWO real WebGL clipping
     planes sweep upward through the piece's own volume (see
     renderer.localClippingEnabled above), progressively uncovering
     an internal 3D lattice as they pass and closing it again behind
     them — an actual moving scan window through the geometry, not
     just an opacity fade. The piece's own exterior simultaneously
     dips toward translucency (never touching its position or
     geometry) so the interior reads through it. Set
     DIGITAL_GLITCH_ENABLED to false to disable this effect
     independently of every other ambient effect. */
  const DIGITAL_GLITCH_ENABLED = true;

  // theme: per feedback, redesigned a third time — "the entire piece
  // topology must exhibit close grid mesh look... the Opa might have
  // 30 bars per face... distribute proportionately to all other
  // pieces," then reduced to ~15 bars per feedback that the interior
  // was too tight/dense to read. Reusing the piece's own real render geometry (previous
  // round) was topologically accurate but nowhere near dense enough
  // — makeRoundedBox's flat faces are each a single quad with no
  // internal subdivision, so most of a box piece's surface showed no
  // grid lines at all. This instead builds a dedicated, purpose-built
  // PROXY geometry sized to the piece's exact real dimensions but
  // with deliberately high face subdivision — a BoxGeometry (or a
  // CylinderGeometry for the disc) with explicit width/height/depth
  // segment counts — so every face genuinely is a close grid mesh,
  // not just its edges. Segment counts are computed from one shared
  // density (BARS_PER_UNIT), calibrated so Opa's own 1.6-unit faces
  // land on ~30 segments exactly, then applied to every other piece's
  // own real per-axis dimensions — a smaller piece gets proportionately
  // fewer bars at the SAME spacing, not the same fixed 30. Scaled to
  // 0.97 so it sits just inside the body's own surface — avoids
  // coincident-geometry flicker against the body without meaningfully
  // changing the read. Glowing nodes are sampled from the wireframe's
  // own vertices at a fixed stride (deterministic, not random) rather
  // than floating at arbitrary points, so they land on real grid
  // junctions too.
  function buildDigitalInterior(mesh) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const fullW = bb.max.x - bb.min.x;
    const fullH = bb.max.y - bb.min.y;
    const fullD = bb.max.z - bb.min.z;
    const sy = Math.max(0.05, fullH * 0.7);
    const halfY = sy / 2;
    const margin = halfY * 0.12 + 0.06;
    const isDiscShape = mesh.geometry.type === "CylinderGeometry";

    // topPlane starts fully closed (nothing visible); bottomPlane
    // starts fully open. Animating topPlane's constant up sweeps a
    // reveal in from the bottom; later animating bottomPlane's
    // constant down closes it again from the bottom, so the visible
    // band as a whole travels upward through the piece over time.
    const topPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -halfY - margin);
    const bottomPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), halfY + margin);
    const clippingPlanes = [topPlane, bottomPlane];

    const group = new THREE.Group();
    const lineMaterials = [];
    const pointMaterials = [];
    const SCALE = 0.97;

    // Opa (the biggest piece, a 2x2x2-scale cube = 1.6 world units
    // per axis) is the "~11 bars per longest face" reference (halved
    // from an original 30 per feedback that the wireframe interior
    // read too tight/dense to discern, then reduced further from 15
    // per feedback to bring the mesh/skeleton density down further
    // still); every other piece's segment count is that same
    // bars-per-unit density applied to its own real dimensions —
    // computed from the piece's OWN current bounding box below, so a
    // smaller piece (or a smaller face of the same piece in a
    // different roll orientation) gets proportionately fewer bars at
    // the same spacing, never the same fixed count regardless of size.
    const BARS_PER_UNIT = 11 / (2 * PIECE_SCALE);
    const segFor = (unitLength) => Math.max(3, Math.min(48, Math.round(unitLength * BARS_PER_UNIT)));

    let proxyGeo;
    if (isDiscShape) {
      const radius = fullW / 2;
      proxyGeo = new THREE.CylinderGeometry(radius, radius, fullH, segFor(fullW), Math.max(2, segFor(fullH)));
    } else {
      proxyGeo = new THREE.BoxGeometry(fullW, fullH, fullD, segFor(fullW), segFor(fullH), segFor(fullD));
    }
    const wireGeo = new THREE.WireframeGeometry(proxyGeo);
    proxyGeo.dispose();
    const wireMat = new THREE.LineBasicMaterial({
      color: HEX.glowCyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      clippingPlanes,
    });
    wireMat.userData.baseOpacity = 0.45;
    const wireLine = new THREE.LineSegments(wireGeo, wireMat);
    wireLine.scale.setScalar(SCALE);
    group.add(wireLine);
    lineMaterials.push(wireMat);

    // Deterministic stride sample of the wireframe's own vertex
    // positions — real topology junctions, not arbitrary points.
    const wirePos = wireGeo.attributes.position;
    const nodePositions = [];
    const STRIDE = 27; // much denser wireframe now — a wider stride keeps nodes sparse/purposeful rather than a solid cloud
    for (let i = 0; i < wirePos.count; i += STRIDE) {
      nodePositions.push(wirePos.getX(i) * SCALE, wirePos.getY(i) * SCALE, wirePos.getZ(i) * SCALE);
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions, 3));
    const nodeMat = new THREE.PointsMaterial({
      color: 0xeaffff,
      size: 0.032,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      clippingPlanes,
    });
    nodeMat.userData.baseOpacity = 0.65;
    group.add(new THREE.Points(nodeGeo, nodeMat));
    pointMaterials.push(nodeMat);

    return { group, topPlane, bottomPlane, halfY, margin, lineMaterials, pointMaterials };
  }

  /* theme: volumetric voxelization / orthogonal displacement — per
     feedback, a second "digital glitch" payload alongside the
     wireframe interior above (spawnDigitalGlitchWave below now picks
     one or the other per piece, same rarity/scheduling as before).
     Subdivides the piece into a uniform grid of small solid cubes
     (a THREE.InstancedMesh, not one mesh per cube — this stays cheap
     even at a few hundred instances) whose aggregate matches the
     piece's own macro-shape: for the disc, any cube whose center
     falls outside the actual circular footprint is simply excluded,
     so the aggregate still reads as round rather than a plain box.
     Density is proportional to size (Opa's own 1.6-unit axis gets
     ~7 voxels per axis; smaller pieces/axes get proportionately
     fewer at the same spacing), coarser than the wireframe effect's
     own bar density since these are solid volume cubes, not a
     surface line grid. Cubes inherit the parent piece's own color/
     emissive/roughness/metalness directly from its live material.

     Per feedback, "the direction this effect flows through the
     piece should be randomized": one of the piece's own three local
     axes is picked at random as the flow direction, each cube's
     position along that axis sets WHEN its jostle window opens (a
     sweep from one side to the other, not everything moving at
     once), and "the entire piece doesn't necessarily have to
     experience it" — a random 55-95% coverage means some cubes are
     simply excluded and never move. Each active cube's own
     displacement is drawn independently per X/Y/Z axis (orthogonal
     jitter, not diagonal drift), animated in the tick loop as a
     single damped bounce out and back — "sudden mechanical jostling
     ... before returning them to a stable state." */
  function buildVoxelShatter(mesh) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const fullW = bb.max.x - bb.min.x;
    const fullH = bb.max.y - bb.min.y;
    const fullD = bb.max.z - bb.min.z;
    const isDiscShape = mesh.geometry.type === "CylinderGeometry";

    const VOXELS_PER_UNIT = 7 / (2 * PIECE_SCALE); // Opa's own axis length -> ~7 voxels/axis
    const countFor = (len) => Math.max(2, Math.min(9, Math.round(len * VOXELS_PER_UNIT)));
    const nx = countFor(fullW), ny = countFor(fullH), nz = countFor(fullD);
    const vx = fullW / nx, vy = fullH / ny, vz = fullD / nz;
    const radius = fullW / 2;

    const centers = [];
    for (let ix = 0; ix < nx; ix++) {
      const cx = bb.min.x + (ix + 0.5) * vx;
      for (let iy = 0; iy < ny; iy++) {
        const cy = bb.min.y + (iy + 0.5) * vy;
        for (let iz = 0; iz < nz; iz++) {
          const cz = bb.min.z + (iz + 0.5) * vz;
          if (isDiscShape && Math.hypot(cx, cz) > radius) continue;
          centers.push({ x: cx, y: cy, z: cz, ix, iy, iz });
        }
      }
    }

    const axisPick = Math.floor(Math.random() * 3);
    const axisKey = axisPick === 0 ? "ix" : axisPick === 1 ? "iy" : "iz";
    const axisCount = axisPick === 0 ? nx : axisPick === 1 ? ny : nz;
    const flipped = Math.random() < 0.5;
    const coverage = 0.55 + Math.random() * 0.4;

    const mat = mesh.material;
    const voxelGeo = new THREE.BoxGeometry(vx * 0.86, vy * 0.86, vz * 0.86); // slight gaps between cubes
    const voxelMat = new THREE.MeshStandardMaterial({
      color: mat.color ? mat.color.clone() : 0xffffff,
      emissive: mat.emissive ? mat.emissive.clone() : 0x000000,
      emissiveIntensity: mat.emissiveIntensity || 0,
      roughness: mat.roughness != null ? mat.roughness : 0.5,
      metalness: mat.metalness != null ? mat.metalness : 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const inst = new THREE.InstancedMesh(voxelGeo, voxelMat, Math.max(1, centers.length));
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const voxels = centers.map((c, idx) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      const axisIdx = c[axisKey];
      const frac = axisCount <= 1 ? 0 : axisIdx / (axisCount - 1);
      const phase = flipped ? 1 - frac : frac;
      const active = Math.random() < coverage;
      const offset = active
        ? {
            x: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9) * vx,
            y: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9) * vy,
            z: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9) * vz,
          }
        : { x: 0, y: 0, z: 0 };
      return { center: c, phase, active, offset };
    });
    inst.instanceMatrix.needsUpdate = true;

    return { inst, voxels, voxelMat };
  }

  function spawnDigitalGlitchWave() {
    const meshPieces = t.pieceGroup.children.filter((c) => c.userData.kind === "piece");
    if (meshPieces.length < 3) return;

    // Build a spatially-coherent run via greedy nearest-neighbor
    // chaining from a random start, so the wave travels through
    // pieces that are actually "reasonably close together" rather
    // than a purely random scatter across the whole board.
    const runLength = Math.min(meshPieces.length, 3 + Math.floor(Math.random() * 5)); // 3-7
    const remaining = meshPieces.slice();
    const run = [remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]];
    while (run.length < runLength && remaining.length) {
      const last = run[run.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((m, i) => {
        const d = last.position.distanceToSquared(m.position);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      run.push(remaining.splice(bestIdx, 1)[0]);
    }
    if (run.length < 3) return; // couldn't find enough pieces nearby — skip silently

    if (Math.random() < 0.5) run.reverse(); // randomize direction of travel

    const now0 = performance.now();
    const stepGap = 260 + Math.random() * 200; // randomized timing between pieces
    run.forEach((mesh, i) => {
      // Per feedback, a second payload (volumetric voxelization) now
      // shares this same run/scheduling — each piece in the run
      // independently gets one or the other.
      if (Math.random() < 0.5) {
        const shatter = buildVoxelShatter(mesh);
        shatter.inst.position.copy(mesh.position);
        shatter.inst.rotation.copy(mesh.rotation);
        t.fxGroup.add(shatter.inst);
        t.voxelShatterItems.push({
          mesh,
          inst: shatter.inst,
          voxelMat: shatter.voxelMat,
          voxels: shatter.voxels,
          born: now0 + i * stepGap,
          life: 700 + Math.random() * 300,
          sweepSpread: 0.7,
          exteriorDip: 0.6 + Math.random() * 0.2,
          origTransparent: mesh.material.transparent,
          origOpacity: mesh.material.opacity,
        });
        return;
      }
      const interior = buildDigitalInterior(mesh);
      interior.group.position.copy(mesh.position);
      interior.group.rotation.copy(mesh.rotation);
      t.fxGroup.add(interior.group);
      t.digitalGlitchItems.push({
        mesh,
        wire: interior.group,
        topPlane: interior.topPlane,
        bottomPlane: interior.bottomPlane,
        halfY: interior.halfY,
        margin: interior.margin,
        lineMaterials: interior.lineMaterials,
        pointMaterials: interior.pointMaterials,
        born: now0 + i * stepGap,
        // +5% per feedback ("when the wire frames are exposed increase
        // duration of show by 5%") — was 620 + rand*260.
        life: 651 + Math.random() * 273,
        exteriorDip: 0.55 + Math.random() * 0.2, // substantial — the interior needs to actually read through it
        origTransparent: mesh.material.transparent,
        origOpacity: mesh.material.opacity,
      });
    });
  }

  let digitalGlitchTimer;
  function fireDigitalGlitch() {
    if (windingDownRef.current) return; // stop spawning new ones once a win fires
    if (DIGITAL_GLITCH_ENABLED) spawnDigitalGlitchWave();
    digitalGlitchTimer = setTimeout(fireDigitalGlitch, 45000 + Math.random() * 75000);
  }


  /* ---- DOM-based effects (title flicker/spark/letter, turn halo,
     VHS glitch, rare Scanimate/Vidicon, jitter-tear) ---- */
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Splits the masthead's text into one span per character
     (".ec-letter") so per-letter effects — the existing phosphor-flash
     dim/undim in fireLetter below, and the new raster-tear effect —
     have individual elements to grab, instead of one plain text node.
     Runs once, synchronously, at mount: titleRef always holds exactly
     the static "EL CABEZA" text at that point, so there's no reactive
     content to preserve or resync later. */
  (function splitTitleIntoLetters() {
    const el = titleRef.current;
    if (!el || el.querySelector(".ec-letter")) return;
    const text = el.textContent;
    el.textContent = "";
    for (const ch of text) {
      // A space wrapped alone in a display:inline-block span collapses
      // to zero width (CSS trims edge whitespace inside its own inline
      // formatting context) — leave spaces as plain text nodes between
      // the letter spans instead of wrapping them.
      if (ch === " ") {
        el.appendChild(document.createTextNode(" "));
        continue;
      }
      const span = document.createElement("span");
      span.className = "ec-letter";
      span.textContent = ch;
      el.appendChild(span);
    }
  })();

  const FLICKER_CLASSES = ["ec-title-flicker", "ec-title-flicker-b", "ec-title-flicker-c"];
  let flickerTimer, letterTimer, sparkTimer, haloTimer, vhsTimer, rareTimer, jitterTimer, mastheadJitterTimer, letterTearTimer, verticalHoldTimer;

  const fireFlicker = () => {
    if (windingDownRef.current) return;
    const el = titleRef.current;
    if (el) {
      FLICKER_CLASSES.forEach((c) => el.classList.remove(c));
      void el.offsetWidth;
      const cls = FLICKER_CLASSES[Math.floor(Math.random() * FLICKER_CLASSES.length)];
      el.style.animationDuration = (0.7 + Math.random() * 0.9).toFixed(2) + "s";
      el.classList.add(cls);
    }
    audio.playFlicker();
    flickerTimer = setTimeout(fireFlicker, 7000 + Math.random() * 24000);
  };

  const fireLetter = () => {
    if (windingDownRef.current) return;
    const container = titleRef.current;
    const letters = container ? container.querySelectorAll(".ec-letter") : null;
    if (letters && letters.length) {
      const el = letters[Math.floor(Math.random() * letters.length)];
      const hold = 250 + Math.random() * 900;
      el.style.transition = "opacity 200ms ease";
      el.style.opacity = "0.05";
      setTimeout(() => {
        el.style.transition = "opacity 420ms ease";
        el.style.opacity = "1";
      }, hold);
    }
    letterTimer = setTimeout(fireLetter, 6000 + Math.random() * 15000);
  };

  const fireSpark = () => {
    if (windingDownRef.current) return;
    const wrap = titleWrapRef.current;
    if (wrap) {
      const count = Math.random() < 0.25 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const el = document.createElement("span");
        el.className = "ec-spark";
        el.style.left = (12 + Math.random() * 76) + "%";
        el.style.top = (30 + Math.random() * 55) + "%";
        el.style.setProperty("--ec-spark-dx", (Math.random() * 18 - 9).toFixed(1) + "px");
        el.style.setProperty("--ec-spark-dy", (-6 - Math.random() * 16).toFixed(1) + "px");
        wrap.appendChild(el);
        setTimeout(() => el.remove(), 700);
      }
    }
    audio.playArc();
    sparkTimer = setTimeout(fireSpark, 18000 + Math.random() * 34000);
  };

  const pulseHalo = () => {
    const el = turnHaloRef.current;
    if (el) {
      const intensity = 0.35 + Math.random() * 1.55;
      el.style.setProperty("--ec-halo-intensity", intensity.toFixed(2));
    }
    haloTimer = setTimeout(pulseHalo, 3500 + Math.random() * 6500);
  };

  const GLITCH_CLASSES = ["ec-vhs-glitch", "ec-vhs-glitch-b", "ec-vhs-glitch-c", "ec-vhs-glitch-d", "ec-vhs-glitch-e", "ec-vhs-glitch-f"];

  // The 4 new CRT-aberration profiles — an ADDITIONAL, separately-
  // scheduled rotation, not merged into GLITCH_CLASSES above, per
  // feedback ("do not replace them, just add new ones"). Fires on the
  // card alone, with no overlay flash and no glitch audio cue —
  // fireVhs's own ec-vhs-overlay-active flash and audio.playGlitch()
  // are exactly the harsher pairing these calmer, smooth-ease effects
  // were built to be an alternative to; coupling them to the same
  // overlay/cue would undercut that.
  const CRT_ABERRATION_CLASSES = ["ec-chromatic-ghost", "ec-degauss", "ec-phosphor-trail", "ec-curvature-ripple"];
  let crtAberrationTimer;
  function fireCrtAberration() {
    if (windingDownRef.current) return;
    const card = cardRef.current;
    if (card) {
      CRT_ABERRATION_CLASSES.forEach((c) => card.classList.remove(c));
      void card.offsetWidth;
      const cls = CRT_ABERRATION_CLASSES[Math.floor(Math.random() * CRT_ABERRATION_CLASSES.length)];
      card.classList.add(cls);
    }
    crtAberrationTimer = setTimeout(fireCrtAberration, 45000 + Math.random() * 60000);
  }
  const fireVhs = () => {
    if (windingDownRef.current) return;
    const card = cardRef.current;
    const overlay = fxOverlayRef.current;
    if (card && overlay) {
      GLITCH_CLASSES.forEach((c) => card.classList.remove(c));
      overlay.classList.remove("ec-vhs-overlay-active");
      void card.offsetWidth;
      const cls = GLITCH_CLASSES[Math.floor(Math.random() * GLITCH_CLASSES.length)];
      card.classList.add(cls);
      overlay.classList.add("ec-vhs-overlay-active");
    }
    audio.playGlitch();
    // Interval widened ~30% (x1.43) per feedback ("reduce screen
    // flashing, seizure-inducing animations by 30%") — was 57143 +
    // rand*107143. The GLITCH_CLASSES themselves (rapid hard-cut
    // opacity/filter swings) are the sharpest flash risk in the whole
    // theme, so frequency is the first, safe lever; swapping their
    // actual look for new, gentler CRT-aberration profiles is a
    // separate design pass, not done here.
    vhsTimer = setTimeout(fireVhs, 81714 + Math.random() * 153234);
  };

  const RARE_CLASSES = ["ec-scanimate", "ec-vidicon-burn"];
  const fireRare = () => {
    if (windingDownRef.current) return;
    const card = cardRef.current;
    if (card) {
      RARE_CLASSES.forEach((c) => card.classList.remove(c));
      void card.offsetWidth;
      const cls = RARE_CLASSES[Math.floor(Math.random() * RARE_CLASSES.length)];
      card.classList.add(cls);
    }
    audio.playGlitch();
    // Widened ~30% per the same feedback — was 240000 + rand*300000.
    rareTimer = setTimeout(fireRare, 343200 + Math.random() * 429000);
  };

  // Per feedback, a jitter must never land on a button that isn't
  // actually visible right now — e.g. the dock panel's own buttons
  // while it's closed (the panel fades via opacity/pointerEvents
  // rather than unmounting), or a conditionally-shown button like the
  // Singularity reveal before it appears. Checks the element's own box
  // plus every ancestor up to <body> for display/visibility/opacity,
  // since a hidden ANCESTOR (the closed dock panel itself) is the
  // common case, not just the button's own style.
  const isVisibleForGlitch = (el) => {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  };

  const JITTER_CLASSES = ["ec-jitter-tear", "ec-jitter-tear-b"];
  const fireJitter = () => {
    if (windingDownRef.current) return;
    const candidates = [titleWrapRef.current, turnLabelRef.current];
    const buttons = [...document.querySelectorAll(".ec-btn")].filter(isVisibleForGlitch);
    if (buttons.length) candidates.push(buttons[Math.floor(Math.random() * buttons.length)]);
    const pool = candidates.filter(Boolean);
    if (pool.length) {
      const el = pool[Math.floor(Math.random() * pool.length)];
      JITTER_CLASSES.forEach((c) => el.classList.remove(c));
      void el.offsetWidth;
      const cls = JITTER_CLASSES[Math.floor(Math.random() * JITTER_CLASSES.length)];
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 260);
    }
    jitterTimer = setTimeout(fireJitter, 11000 + Math.random() * 16000);
  };

  /* Dedicated, more frequent jitter for the masthead specifically —
     separate from fireJitter above (which only picks the title 1-in-3
     times, shared with the turn label and buttons). Reuses the same
     JITTER_CLASSES/keyframes, just fired on its own, tighter cadence. */
  const fireMastheadJitter = () => {
    if (windingDownRef.current) return;
    const el = titleWrapRef.current;
    if (el) {
      JITTER_CLASSES.forEach((c) => el.classList.remove(c));
      void el.offsetWidth;
      const cls = JITTER_CLASSES[Math.floor(Math.random() * JITTER_CLASSES.length)];
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 260);
    }
    mastheadJitterTimer = setTimeout(fireMastheadJitter, 3000 + Math.random() * 4000);
  };

  /* Occasional single-letter raster tear: picks one of the masthead's
     per-character spans (see splitTitleIntoLetters above) and tears
     just that glyph, rather than the whole title jittering together —
     reads as one character's own signal briefly failing. */
  const fireLetterTear = () => {
    if (windingDownRef.current) return;
    const container = titleRef.current;
    const letters = container ? container.querySelectorAll(".ec-letter") : null;
    if (letters && letters.length) {
      const el = letters[Math.floor(Math.random() * letters.length)];
      el.classList.remove("ec-letter-tear");
      void el.offsetWidth;
      el.classList.add("ec-letter-tear");
      setTimeout(() => el.classList.remove("ec-letter-tear"), 150);
      audio.playGlitch();
    }
    letterTearTimer = setTimeout(fireLetterTear, 9000 + Math.random() * 13000);
  };

  /* Vertical hold instability: the whole masthead row briefly rolls
     and snaps back, the way an old CRT loses vertical sync — rarer
     and more dramatic than the jitter/tear above, so it reads as a
     distinct kind of malfunction rather than more of the same. */
  const fireVerticalHold = () => {
    if (windingDownRef.current) return;
    const el = titleWrapRef.current;
    if (el) {
      el.classList.remove("ec-vertical-hold");
      void el.offsetWidth;
      el.classList.add("ec-vertical-hold");
      setTimeout(() => el.classList.remove("ec-vertical-hold"), 500);
      audio.playGlitch();
    }
    // Widened per feedback ("the visual effect that causes it to jump
    // to a larger size randomly needs to be decreased in frequency") —
    // was 18000 + rand*22000.
    verticalHoldTimer = setTimeout(fireVerticalHold, 30000 + Math.random() * 36000);
  };

  if (!reduceMotion) {
    // Masthead/UI effects run from mount — not gated on Begin Game,
    // since they're not board FX (per the original's own reasoning for
    // why arc/crawl/floorWave/digitalGlitch ARE gated but these aren't).
    flickerTimer = setTimeout(fireFlicker, 5000 + Math.random() * 9000);
    letterTimer = setTimeout(fireLetter, 4000 + Math.random() * 9000);
    sparkTimer = setTimeout(fireSpark, 14000 + Math.random() * 16000);
    haloTimer = setTimeout(pulseHalo, 1200 + Math.random() * 2000);
    jitterTimer = setTimeout(fireJitter, 6000 + Math.random() * 9000);
    mastheadJitterTimer = setTimeout(fireMastheadJitter, 3000 + Math.random() * 4000);
    letterTearTimer = setTimeout(fireLetterTear, 6000 + Math.random() * 10000);
    verticalHoldTimer = setTimeout(fireVerticalHold, 16000 + Math.random() * 20000);
  }

  return {
    armOnBegin() {
      if (!reduceMotion) {
        // Widened ~30% per feedback ("reduce screen flashing... by
        // 30%") — was 25714 + rand*35714.
        vhsTimer = setTimeout(fireVhs, 36771 + Math.random() * 51071);
        rareTimer = setTimeout(fireRare, 128700 + Math.random() * 214500); // widened ~30% — was 90000 + rand*150000
        crtAberrationTimer = setTimeout(fireCrtAberration, 45000 + Math.random() * 60000);
      }
      arcTimer = setTimeout(fireArc, 8333 + Math.random() * 11667);
      // 2.5x the old 8000-20000ms window (== the old rate * 0.4) — see
      // fireCrawl's own reschedule above for the full reasoning.
      crawlTimer = setTimeout(fireCrawl, 20000 + Math.random() * 30000);
      floorWaveTimer = setTimeout(fireFloorWave, 40000 + Math.random() * 50000);
      if (DIGITAL_GLITCH_ENABLED) {
        digitalGlitchTimer = setTimeout(fireDigitalGlitch, 30000 + Math.random() * 40000);
      }
    },

    restart() {
      if (!reduceMotion) {
        flickerTimer = setTimeout(fireFlicker, 5000 + Math.random() * 9000);
        letterTimer = setTimeout(fireLetter, 4000 + Math.random() * 9000);
        sparkTimer = setTimeout(fireSpark, 14000 + Math.random() * 16000);
        // Widened ~30% per feedback ("reduce screen flashing... by
        // 30%") — was 25714 + rand*35714.
        vhsTimer = setTimeout(fireVhs, 36771 + Math.random() * 51071);
        rareTimer = setTimeout(fireRare, 343200 + Math.random() * 429000); // widened ~30% — was 240000 + rand*300000
        crtAberrationTimer = setTimeout(fireCrtAberration, 45000 + Math.random() * 60000);
        jitterTimer = setTimeout(fireJitter, 11000 + Math.random() * 16000);
        mastheadJitterTimer = setTimeout(fireMastheadJitter, 3000 + Math.random() * 4000);
        letterTearTimer = setTimeout(fireLetterTear, 9000 + Math.random() * 13000);
        verticalHoldTimer = setTimeout(fireVerticalHold, 18000 + Math.random() * 22000);
      }
      arcTimer = setTimeout(fireArc, 8333 + Math.random() * 11667);
      // Same 2.5x widening as armOnBegin above.
      crawlTimer = setTimeout(fireCrawl, 20000 + Math.random() * 30000);
      floorWaveTimer = setTimeout(fireFloorWave, 40000 + Math.random() * 50000);
      if (DIGITAL_GLITCH_ENABLED) {
        digitalGlitchTimer = setTimeout(fireDigitalGlitch, 30000 + Math.random() * 40000);
      }
    },

    tick(now) {
  const fxItems = t.fxItems;
  if (fxItems && fxItems.length) {
    for (let i = fxItems.length - 1; i >= 0; i--) {
      const item = fxItems[i];
      /* Real bug fixed here: this used to be Math.min(...,1) with
         no lower clamp. For anything pre-scheduled with a `born`
         more than one `life` in the future (any run in the crawl
         wave beyond its first few cells, and nearly every cell of
         the large floor wave, whose stagger is seconds long
         against a life of well under a second), t started well
         below -1. Math.sin(Math.PI * t) is periodic, so for
         t < -1 it swings back to POSITIVE — those items flashed
         visibly the instant they were spawned, well before their
         real born time, rather than staying invisible until then.
         Clamping the lower bound to 0 makes "not born yet" reliably
         render as opacity 0, which is what made the crawl wave (and
         the floor wave) read as a garbled flash instead of a clean
         traveling sequence. */
      const t = Math.max(0, Math.min((now - item.born) / item.life, 1));
      let opacity;
      if (item.envelope === "pulse") {
        opacity = Math.sin(Math.PI * t) * item.peak;
      } else if (item.envelope === "multipulse") {
        // Several rapid full pulses across the same lifetime, each
        // individually rising and falling — "Pulsing Discharge": a
        // strobing arc rather than one smooth rise-fall.
        const pulses = item.pulses || 3;
        opacity = Math.abs(Math.sin(Math.PI * t * pulses)) * item.peak * (1 - t * 0.3);
      } else if (item.envelope === "flicker") {
        // A handful of random ON windows within the lifetime — "loose
        // contact" — rather than any smooth curve at all. Windows are
        // fixed at spawn time (item.flickerWindows), not re-rolled
        // every frame, so the same item flickers the same way from
        // every observer/frame instead of buzzing randomly.
        const on = item.flickerWindows.some(([start, end]) => t >= start && t < end);
        opacity = on ? item.peak : 0;
      } else {
        opacity = (1 - t) * item.peak;
      }
      item.mesh.material.opacity = Math.max(0, opacity);
      if (t >= 1) {
        item.mesh.parent && item.mesh.parent.remove(item.mesh);
        item.mesh.geometry && item.mesh.geometry.dispose();
        item.mesh.material && item.mesh.material.dispose();
        fxItems.splice(i, 1);
      }
    }
  }

  /* Landing-impact debris (see spawnLandingParticles) — real position
     motion (outward scatter + gravity), not just an opacity fade, so
     it needs its own physics dt rather than fxItems' simpler
     life-fraction envelope. Tracked via actual elapsed time between
     tick() calls rather than an assumed frame rate: this environment's
     own render loop has been observed running well under 60fps under
     load, and a fixed-dt step would make particles crawl in slow
     motion whenever frames are sparse while their (real-time-based)
     fade raced on unchanged. */
  const landingParticleItems = t.landingParticleItems;
  if (landingParticleItems && landingParticleItems.length) {
    const pdt = lastLandingParticleTickAt ? Math.min((now - lastLandingParticleTickAt) / 1000, 0.05) : 0.016;
    lastLandingParticleTickAt = now;
    for (let i = landingParticleItems.length - 1; i >= 0; i--) {
      const p = landingParticleItems[i];
      const age = now - p.born;
      if (age >= p.life) {
        p.mesh.parent && p.mesh.parent.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        landingParticleItems.splice(i, 1);
        continue;
      }
      p.vy -= 5.5 * pdt;
      p.mesh.position.x += p.vx * pdt;
      p.mesh.position.z += p.vz * pdt;
      p.mesh.position.y = Math.max(p.floorY, p.mesh.position.y + p.vy * pdt);
      p.mesh.material.opacity = 0.9 * (1 - age / p.life);
    }
  } else {
    lastLandingParticleTickAt = null; // resync cleanly next time a burst spawns, rather than one big dt jump
  }

  /* theme: the digital-interior piece effect — an actual traveling
     x-ray scan. Two real clipping planes sweep upward through each
     piece's own lattice geometry: topPlane opens the reveal from
     the bottom during the first ~45% of the piece's own timeline,
     then bottomPlane closes it again from the bottom during the
     last ~45%, so the visible "window" of lattice itself travels
     upward through the volume rather than the whole lattice
     fading in and out uniformly. The piece's exterior dips toward
     translucency in parallel (never touching its position or
     geometry) so the interior actually reads through it, and each
     lattice material gets its own small random flicker — the
     "as though energized" cue — layered on top of the shared
     rise/fall envelope. */
  const digitalGlitchItems = t.digitalGlitchItems;
  if (digitalGlitchItems && digitalGlitchItems.length) {
    for (let i = digitalGlitchItems.length - 1; i >= 0; i--) {
      const item = digitalGlitchItems[i];
      const localT = (now - item.born) / item.life;
      if (localT < 0) continue; // wave hasn't reached this piece yet
      const tt = Math.min(localT, 1);
      const envelope = Math.sin(Math.PI * tt); // rises then falls, 0 at both ends

      if (!item.mesh.material.transparent) item.mesh.material.transparent = true;
      item.mesh.material.opacity = 1 - envelope * item.exteriorDip;

      const growT = Math.min(tt / 0.45, 1);
      const shrinkT = Math.max(0, Math.min((tt - 0.55) / 0.45, 1));
      const openC = item.halfY + item.margin;
      const closedC = -item.halfY - item.margin;
      item.topPlane.constant = closedC + (openC - closedC) * growT;
      item.bottomPlane.constant = openC + (closedC - openC) * shrinkT;

      item.lineMaterials.forEach((mat) => {
        mat.opacity = envelope * mat.userData.baseOpacity * (0.8 + Math.random() * 0.3);
      });
      item.pointMaterials.forEach((mat) => {
        mat.opacity = envelope * mat.userData.baseOpacity * (0.8 + Math.random() * 0.3);
      });

      if (tt >= 1) {
        item.mesh.material.opacity = item.origOpacity;
        item.mesh.material.transparent = item.origTransparent;
        item.wire.parent && item.wire.parent.remove(item.wire);
        item.wire.traverse((c) => {
          c.geometry && c.geometry.dispose();
          c.material && c.material.dispose();
        });
        digitalGlitchItems.splice(i, 1);
      }
    }
  }

  /* theme: volumetric voxelization/orthogonal displacement — see
     buildVoxelShatter above for how the grid and per-cube
     activation/offsets are built; this just animates what's
     already been precomputed. Each cube's own "jostle window"
     opens at a time set by its phase (the randomized flow
     direction/sweep) and lasts the remainder of the piece's own
     life span; within that window it plays one damped bounce out
     to its randomized offset and back to rest — sin() for the
     out-and-back shape, exp() decay so it settles rather than
     oscillating indefinitely. Inactive cubes (outside the random
     coverage fraction) never move at all. */
  const voxelShatterItems = t.voxelShatterItems;
  if (voxelShatterItems && voxelShatterItems.length) {
    for (let i = voxelShatterItems.length - 1; i >= 0; i--) {
      const item = voxelShatterItems[i];
      const localT = (now - item.born) / item.life;
      if (localT < 0) continue; // wave hasn't reached this piece yet
      const tt = Math.min(localT, 1);
      const envelope = Math.sin(Math.PI * tt);

      if (!item.mesh.material.transparent) item.mesh.material.transparent = true;
      item.mesh.material.opacity = 1 - envelope * item.exteriorDip;
      item.voxelMat.opacity = envelope * 0.92;

      for (let v = 0; v < item.voxels.length; v++) {
        const voxel = item.voxels[v];
        let bounce = 0;
        if (voxel.active) {
          const winStart = voxel.phase * item.sweepSpread;
          const winLen = Math.max(0.05, 1 - winStart);
          const winT = Math.max(0, Math.min((tt - winStart) / winLen, 1));
          bounce = Math.sin(Math.PI * winT) * Math.exp(-winT * 1.6);
        }
        voxelDummy.position.set(
          voxel.center.x + voxel.offset.x * bounce,
          voxel.center.y + voxel.offset.y * bounce,
          voxel.center.z + voxel.offset.z * bounce
        );
        voxelDummy.updateMatrix();
        item.inst.setMatrixAt(v, voxelDummy.matrix);
      }
      item.inst.instanceMatrix.needsUpdate = true;

      if (tt >= 1) {
        item.mesh.material.opacity = item.origOpacity;
        item.mesh.material.transparent = item.origTransparent;
        item.inst.parent && item.inst.parent.remove(item.inst);
        item.inst.geometry.dispose();
        item.inst.material.dispose();
        voxelShatterItems.splice(i, 1);
      }
    }
  }

  /* theme: the crawling voxel mass — see spawnCrawlWave/
     spawnCrawlGeneration above for the full redesign. Each entry here
     is now one static "generation": a fixed-position flood-fill
     cluster that only ever fades in, holds, and fades out — it never
     translates itself. The mass's apparent MOVEMENT is entirely an
     emergent effect of many overlapping generations, each spawned a
     little further along the path than the last (see spawnCrawlWave),
     which is also what makes the shape genuinely reconfigure as it
     goes rather than one fixed silhouette sliding. */
  const crawlMassItems = t.crawlMassItems;
  if (crawlMassItems && crawlMassItems.length) {
    for (let i = crawlMassItems.length - 1; i >= 0; i--) {
      const item = crawlMassItems[i];
      const frac = Math.max(0, Math.min((now - item.born) / item.duration, 1));

      item.materials.forEach(({ bloom, halo, core, bloomPeak, haloPeak, corePeak, phase }) => {
        // Each voxel's own envelope is nudged by its stored phase, so
        // cells within the same generation don't all light up/die out
        // in lockstep — see spawnCrawlGeneration's phase comment.
        const pf = Math.max(0, Math.min(frac - phase, 1));
        let envelope;
        if (pf < 0.25) envelope = pf / 0.25;
        else if (pf > 0.6) envelope = Math.max(0, (1 - pf) / 0.4);
        else envelope = 1;
        bloom.opacity = envelope * bloomPeak;
        halo.opacity = envelope * haloPeak;
        core.opacity = envelope * corePeak;
      });

      if (frac >= 1) {
        item.group.parent && item.group.parent.remove(item.group);
        item.group.traverse((c) => {
          c.geometry && c.geometry.dispose();
          c.material && c.material.dispose();
        });
        crawlMassItems.splice(i, 1);
      }
    }
  }

  const shockwaveItems = t.shockwaveItems;
  if (shockwaveItems && shockwaveItems.length) {
    for (let i = shockwaveItems.length - 1; i >= 0; i--) {
      const item = shockwaveItems[i];
      const frac = Math.max(0, Math.min((now - item.born) / item.duration, 1));
      const elapsedSec = (now - item.born) / 1000;

      // Bloom: a quick flash at the footprint itself, gone well
      // before the ripple finishes traveling/decaying.
      const bloomFrac = Math.min(1, frac / 0.35);
      item.bloomMat.opacity = item.bloomPeak * Math.max(0, 1 - bloomFrac) * (bloomFrac < 1 ? 1 : 0);

      // Rayleigh ripple: a traveling, Gaussian-windowed sine pulse
      // per vertex, keyed on each vertex's precomputed "distance
      // outside the footprint" — the wavefront position advances
      // outward at waveSpeed, amplitude decays both with distance
      // (decayLength) and with elapsed time, exactly like a real
      // surface wave losing energy as it propagates.
      const wavefront = item.waveSpeed * elapsedSec;
      const globalDecay = Math.exp(-elapsedSec / item.decayTau);
      const arr = item.posAttr.array;
      const distances = item.distances;
      const twoPiOverLambda = (2 * Math.PI) / item.wavelength;
      const invTwoSigmaSq = 1 / (2 * item.sigma * item.sigma);
      for (let v = 0; v < distances.length; v++) {
        const d = distances[v];
        const delta = d - wavefront;
        const pulse = Math.exp(-(delta * delta) * invTwoSigmaSq);
        const spatialDecay = Math.exp(-d / item.decayLength);
        const y = item.amplitude * pulse * spatialDecay * globalDecay * Math.sin(delta * twoPiOverLambda);
        arr[v * 3 + 1] = y;
      }
      item.posAttr.needsUpdate = true;
      item.rippleMat.opacity = item.ripplePeak * Math.max(0, 1 - frac);

      if (frac >= 1) {
        [item.bloom, item.ripple].forEach((obj) => {
          obj.parent && obj.parent.remove(obj);
          obj.geometry && obj.geometry.dispose();
          obj.material && obj.material.dispose();
        });
        shockwaveItems.splice(i, 1);
      }
    }
  }

    },

    dispose() {
      clearTimeout(flickerTimer);
      clearTimeout(letterTimer);
      clearTimeout(sparkTimer);
      clearTimeout(haloTimer);
      clearTimeout(vhsTimer);
      clearTimeout(rareTimer);
      clearTimeout(crtAberrationTimer);
      clearTimeout(jitterTimer);
      clearTimeout(mastheadJitterTimer);
      clearTimeout(letterTearTimer);
      clearTimeout(verticalHoldTimer);
      clearTimeout(arcTimer);
      clearTimeout(crawlTimer);
      crawlStepTimers.forEach(clearTimeout);
      clearTimeout(floorWaveTimer);
      clearTimeout(digitalGlitchTimer);
    },
  };
}

/* Ambient-FX CSS: title-flicker/spark keyframes, the hover glow, VHS
   glitch (all six profiles) plus its scanline/static overlay, the two
   rarer Scanimate/Vidicon-burn flourishes, and localized jitter-tear.
   Ported from el-cabeza-neon-3d.html's two <style> blocks (the outer
   page head and the inline JSX one), skipping the handful of rules
   that duplicate what the chassis's own base stylesheet already
   provides (box-sizing, .ec-btn transitions, .ec-btn-invert:hover).
   The Singularity button's own CSS is NOT included here — see
   renderSetupExtras below for why that's still pending. */
export const styleSheet = `
  /* Chakra Petch is the masthead/UI display face this theme is built
     around (see the "EL CABEZA" h1 and button labels below) — it was
     being lost silently (falling back to plain sans-serif) because
     nothing in the build actually loaded it; the chassis's own base
     stylesheet only @imports the Standard theme's fonts (Fraunces/IBM
     Plex). Importing it here, the same way, is theme-owned and
     applies to every build that mounts this theme (standalone Neon
     and the unified app alike). */
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;500;600;700&display=swap');
  /* Permanent CRT ghosting on the masthead glyphs themselves — not an
     overlay div, but a scanline pattern clipped directly to the
     letterforms via background-clip: text, plus a faint RGB-fringe
     "persistence" ghost via text-shadow. Always on, independent of
     the power-grid flicker (which still just toggles this element's
     opacity, dimming the ghosted glyphs along with everything else),
     the rare sparks, and the hold-gesture CRT transition elsewhere.
     Falls back to plain solid glyphs — no scanlines, no clipping — in
     any browser without background-clip: text support; the ghost
     text-shadow alone still applies there. */
  .ec-title {
    position: relative;
    text-shadow:
      0 0 1px rgba(77, 232, 255, 0.22),
      0.6px 0 0 rgba(77, 232, 255, 0.16),
      -0.6px 0 0 rgba(255, 255, 255, 0.10);
  }
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    /* Targets .ec-letter too: the masthead's text is split into one
       span per character on mount (see mountAmbientEffects) so the
       raster-tear effect below can grab individual letters, which
       moves the actual glyphs out of .ec-title's own text run and
       into its children — background never inherits, so each letter
       needs this applied directly, not just the (by then textless)
       wrapper. */
    .ec-title, .ec-title .ec-letter {
      background-color: currentColor;
      background-image: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0px, rgba(0, 0, 0, 0.5) 1px, transparent 1px, transparent 3px);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
  /* Restrained hover glow — the one new interaction cue this theme adds.
     Purely cosmetic (box-shadow only); no layout, timing, or hit-testing
     is touched, so it cannot affect what a click actually does. */
  .ec-btn:hover:not(:disabled) {
    box-shadow: 0 0 0 1px rgba(77, 232, 255, 0.35), 0 0 14px rgba(77, 232, 255, 0.16);
  }
  @media (prefers-reduced-motion: reduce) {
    .ec-btn:hover:not(:disabled) { box-shadow: none; }
  }
  /* Irregular power-grid flicker on the title. Restarted imperatively
     (class removed, reflowed, re-added) at randomized intervals rather
     than looped in CSS, so the flicker itself never falls into a
     detectable rhythm — see the title-flicker effect in the component. */
  @keyframes ec-title-flicker {
    0%   { opacity: 1; }
    4%   { opacity: 0.32; }
    7%   { opacity: 1; }
    11%  { opacity: 0.55; }
    12%  { opacity: 1; }
    38%  { opacity: 1; }
    41%  { opacity: 0.4; }
    44%  { opacity: 0.9; }
    46%  { opacity: 1; }
    100% { opacity: 1; }
  }
  .ec-title-flicker { animation: ec-title-flicker 1.1s linear 1; }
  /* Two further variants with different dip counts/timing — the
     scheduler picks one of the three at random each time (see the
     title effect), so "the flicker" is never quite the same shape
     twice in a row, on top of its already-randomized interval. */
  @keyframes ec-title-flicker-b {
    0%   { opacity: 1; }
    5%   { opacity: 0.15; }
    8%   { opacity: 1; }
    9%   { opacity: 0.5; }
    13%  { opacity: 1; }
    60%  { opacity: 1; }
    63%  { opacity: 0.25; }
    66%  { opacity: 1; }
    100% { opacity: 1; }
  }
  @keyframes ec-title-flicker-c {
    0%   { opacity: 1; }
    3%   { opacity: 0.6; }
    6%   { opacity: 1; }
    22%  { opacity: 1; }
    25%  { opacity: 0.1; }
    27%  { opacity: 0.7; }
    29%  { opacity: 0.2; }
    32%  { opacity: 1; }
    100% { opacity: 1; }
  }
  .ec-title-flicker-b { animation-name: ec-title-flicker-b; animation-timing-function: linear; animation-iteration-count: 1; }
  .ec-title-flicker-c { animation-name: ec-title-flicker-c; animation-timing-function: linear; animation-iteration-count: 1; }
  @media (prefers-reduced-motion: reduce) {
    .ec-title-flicker, .ec-title-flicker-b, .ec-title-flicker-c { animation: none; }
  }
  /* A single spark: a tiny bright point that flashes and drifts off
     before fading, spawned near the title at rare, irregular
     intervals — see spawnSpark in the title effect. */
  @keyframes ec-spark {
    0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
    18%  { opacity: 1; transform: translate(0, 0) scale(1); }
    100% { opacity: 0; transform: translate(var(--ec-spark-dx, 6px), var(--ec-spark-dy, -10px)) scale(0.7); }
  }
  .ec-spark {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #f2fdff;
    box-shadow: 0 0 5px 1px rgba(150, 235, 255, 0.95), 0 0 12px 3px rgba(77, 232, 255, 0.5);
    pointer-events: none;
    animation: ec-spark 600ms ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .ec-spark { display: none; }
  }


        /* theme: rare analog signal-degradation flourish — a brief
           horizontal jitter/tear plus a color-phase wobble on the board
           mount itself (a live DOM element, so this genuinely displaces
           and re-tints the WebGL canvas underneath, not a copy of it),
           paired with a scanline+static overlay flash. See the glitch
           effect for scheduling. */
        @keyframes ec-vhs-glitch {
          0%   { transform: translate(0, 0); filter: none; }
          10%  { transform: translate(-3px, 0); filter: hue-rotate(12deg) saturate(1.5); }
          20%  { transform: translate(3px, 0); filter: hue-rotate(-10deg) saturate(1.4); }
          28%  { transform: translate(-1px, 1px); opacity: 0.82; }
          36%  { transform: translate(0, 0); opacity: 1; filter: none; }
          55%  { transform: translate(2px, 0); filter: hue-rotate(-6deg); }
          64%  { transform: translate(0, 0); filter: none; }
          100% { transform: translate(0, 0); filter: none; }
        }
        .ec-vhs-glitch { animation: ec-vhs-glitch 420ms steps(1, end) 1; }

        /* Profile B: vertical sync roll + line/frame displacement —
           a vertical jump plus a couple of horizontally-offset clipped
           bands, approximating a torn/rolled frame. steps(1,end) makes
           this a sequence of jump-cuts rather than a smooth animation,
           which is also why clip-path polygons/insets with different
           shapes across stops need no matching vertex count. */
        @keyframes ec-vhs-glitch-b {
          0%   { transform: translateY(0); clip-path: none; }
          12%  { transform: translateY(-14px); }
          24%  { transform: translateY(10px); clip-path: inset(0 0 55% 0); }
          30%  { transform: translateY(10px) translateX(4px); clip-path: inset(45% 0 0 0); }
          38%  { transform: translateY(-4px) translateX(-3px); clip-path: none; }
          46%  { transform: translateY(0); }
          100% { transform: translateY(0); clip-path: none; }
        }
        .ec-vhs-glitch-b { animation: ec-vhs-glitch-b 460ms steps(1, end) 1; }

        /* Profile C: signal breakup — brief invert flashes (digital
           corruption/bit errors), a contrast/brightness spike
           (overshoot), and a near-blackout dip (brief signal loss). */
        @keyframes ec-vhs-glitch-c {
          0%   { filter: none; opacity: 1; }
          10%  { filter: invert(1) saturate(2); }
          16%  { filter: none; opacity: 0.15; }
          22%  { filter: contrast(2.2) brightness(1.4); opacity: 1; }
          30%  { filter: none; }
          50%  { filter: invert(1); opacity: 0.3; }
          58%  { filter: none; opacity: 1; }
          100% { filter: none; opacity: 1; }
        }
        .ec-vhs-glitch-c { animation: ec-vhs-glitch-c 500ms steps(1, end) 1; }

        /* Profile D: horizontal sync distortion / tracking distortion —
           the image bends and tears in shifting horizontal bands
           (skewX plus banded clip-path insets), rather than the
           whole-frame roll of profile B or the plain left-right jitter
           of profile A. */
        @keyframes ec-vhs-glitch-d {
          0%   { transform: skewX(0deg) translateX(0); clip-path: none; }
          8%   { transform: skewX(6deg) translateX(-6px); clip-path: inset(10% 0 60% 0); }
          16%  { transform: skewX(-8deg) translateX(8px); clip-path: inset(55% 0 15% 0); }
          24%  { transform: skewX(3deg) translateX(-3px); clip-path: inset(30% 0 40% 0); }
          32%  { transform: skewX(0deg) translateX(0); clip-path: none; }
          50%  { transform: skewX(-4deg) translateX(5px); clip-path: inset(0 0 70% 0); }
          58%  { transform: skewX(0deg) translateX(0); clip-path: none; }
          100% { transform: skewX(0deg) translateX(0); clip-path: none; }
        }
        .ec-vhs-glitch-d { animation: ec-vhs-glitch-d 480ms steps(1, end) 1; }

        /* Profile E: wavy raster distortion / video turbulence / analog
           signal ripple — the two genuine per-pixel warp filters above,
           alternated, plus a gentle skewY/scaleY sweep so the whole
           card reads as organically bending rather than just jittering
           in place. */
        @keyframes ec-vhs-glitch-e {
          0%   { filter: none; transform: skewY(0deg) scaleY(1); }
          14%  { filter: url(#ec-warp-a); transform: skewY(1.2deg) scaleY(1.01); }
          28%  { filter: url(#ec-warp-b); transform: skewY(-1.6deg) scaleY(0.99); }
          42%  { filter: url(#ec-warp-a); transform: skewY(0.8deg) scaleY(1.01); }
          56%  { filter: none; transform: skewY(-0.6deg) scaleY(1); }
          70%  { filter: url(#ec-warp-b); transform: skewY(1deg) scaleY(1); }
          84%  { filter: none; transform: skewY(0deg) scaleY(1); }
          100% { filter: none; transform: skewY(0deg) scaleY(1); }
        }
        .ec-vhs-glitch-e { animation: ec-vhs-glitch-e 560ms steps(1, end) 1; }

        /* Profile F: a full-card wave/warp that blends rapidly through
           several distinct warp shapes in quick succession — the two
           warp filters and alternating skew directions cycle every
           ~35-70ms, so it reads as one shape morphing straight into
           the next rather than a single held distortion. */
        @keyframes ec-vhs-glitch-f {
          0%   { filter: none; transform: skewX(0) skewY(0) scale(1); }
          7%   { filter: url(#ec-warp-a); transform: skewX(4deg) skewY(-2deg) scale(1.008); }
          14%  { filter: url(#ec-warp-b); transform: skewX(-5deg) skewY(2deg) scale(0.992); }
          21%  { filter: url(#ec-warp-a) hue-rotate(8deg); transform: skewX(3deg) skewY(-3deg) scale(1.01); }
          28%  { filter: url(#ec-warp-b); transform: skewX(-6deg) skewY(1deg) scale(0.99); }
          35%  { filter: url(#ec-warp-a); transform: skewX(2deg) skewY(2deg) scale(1.006); }
          42%  { filter: none; transform: skewX(-3deg) skewY(-1deg) scale(0.996); }
          49%  { filter: url(#ec-warp-b) saturate(1.4); transform: skewX(4deg) skewY(3deg) scale(1.01); }
          56%  { filter: url(#ec-warp-a); transform: skewX(-2deg) skewY(-2deg) scale(0.995); }
          63%  { filter: none; transform: skewX(1deg) skewY(1deg) scale(1); }
          100% { filter: none; transform: skewX(0) skewY(0) scale(1); }
        }
        .ec-vhs-glitch-f { animation: ec-vhs-glitch-f 520ms steps(1, end) 1; }

        /* theme: two new, much-rarer full-card flourishes (see the
           dedicated scheduler below — separate from and far less
           frequent than the regular VHS glitch rotation above).

           ec-scanimate: a Scanimate-style analog video synthesizer
           pass — the 1970s analog computer systems (Scanimate, the
           Rutt-Etra, Paik-Abe) that generated broadcast graphics by
           warping and color-cycling a live video signal. Reuses the
           existing #ec-warp-a/#ec-warp-b turbulence displacement
           filters (liquid, not glitchy, distortion) combined with a
           full hue-rotate sweep and a slow vertical roll/stretch. Uses
           smooth ease timing rather than the other profiles' hard
           steps(1,end) cuts — this is meant to read as a flowing,
           synthesized image, not a broken one. */
        @keyframes ec-scanimate {
          0%   { filter: hue-rotate(0deg) saturate(1); transform: translateY(0) scaleY(1); }
          20%  { filter: hue-rotate(60deg) url(#ec-warp-b) saturate(1.5); transform: translateY(-3px) scaleY(1.008); }
          40%  { filter: hue-rotate(140deg) url(#ec-warp-a) saturate(1.8); transform: translateY(2px) scaleY(0.994); }
          60%  { filter: hue-rotate(220deg) url(#ec-warp-b) saturate(1.6); transform: translateY(-2px) scaleY(1.006); }
          80%  { filter: hue-rotate(300deg) url(#ec-warp-a) saturate(1.3); transform: translateY(1px) scaleY(0.998); }
          100% { filter: hue-rotate(360deg) saturate(1); transform: translateY(0) scaleY(1); }
        }
        .ec-scanimate { animation: ec-scanimate 900ms ease-in-out 1; }

        /* ec-vidicon-burn: an old analog camera Vidicon tube's own two
           signature faults, combined — "burn" (a bright image scorches
           a temporary ghost/negative afterimage into the tube's
           photoconductive surface, read here as a brief partial
           invert()) and "deflection overload" (the beam-steering
           circuit overdriven, read as a horizontal stretch spike plus
           a bloom of brightness/contrast and a comet-tail streak via
           an offset drop-shadow trailing the over-bright image).
           steps(1,end), unlike Scanimate above — this is a sudden
           electrical fault, not a flowing image. */
        @keyframes ec-vidicon-burn {
          0%   { filter: brightness(1) contrast(1) invert(0); transform: scaleX(1); }
          8%   { filter: brightness(2.2) contrast(1.6) invert(0.15) drop-shadow(14px 0 rgba(77,232,255,0.5)); transform: scaleX(1.05); }
          16%  { filter: brightness(2.6) contrast(1.8) invert(0.25) drop-shadow(22px 0 rgba(77,232,255,0.4)); transform: scaleX(1.09); }
          28%  { filter: brightness(1.4) contrast(1.2) invert(0.1) drop-shadow(10px 0 rgba(77,232,255,0.25)); transform: scaleX(1.02); }
          45%  { filter: brightness(1.1) contrast(1.05) invert(0.04); transform: scaleX(0.995); }
          70%  { filter: brightness(1) contrast(1) invert(0); transform: scaleX(1); }
          100% { filter: brightness(1) contrast(1) invert(0); transform: scaleX(1); }
        }
        .ec-vidicon-burn { animation: ec-vidicon-burn 650ms steps(1, end) 1; }

        /* Four new CRT-aberration flourishes, per feedback asking for
           "new, not-yet-tried" additions alongside (not replacing)
           the glitch profiles above, kept to smooth ease timing
           throughout rather than the hard steps(1,end) cuts those
           use — deliberately calmer/lower flash-risk, since the same
           feedback separately asked to reduce flashing overall. Not
           yet wired into any scheduler; these are for review first. */

        /* Chromatic Aberration Ghosting: a brief RGB channel split —
           red and cyan fringes drift apart and re-converge, like a
           CRT's electron guns drifting out of alignment. Pure
           drop-shadow color fringing, no displacement, so it stays
           gentle. */
        @keyframes ec-chromatic-ghost {
          0%   { filter: drop-shadow(0 0 0 transparent) drop-shadow(0 0 0 transparent); }
          35%  { filter: drop-shadow(2.5px 0 0 rgba(255,70,70,0.4)) drop-shadow(-2.5px 0 0 rgba(70,255,255,0.4)); }
          65%  { filter: drop-shadow(1.4px 0 0 rgba(255,70,70,0.22)) drop-shadow(-1.4px 0 0 rgba(70,255,255,0.22)); }
          100% { filter: drop-shadow(0 0 0 transparent) drop-shadow(0 0 0 transparent); }
        }
        .ec-chromatic-ghost { animation: ec-chromatic-ghost 900ms ease-in-out 1; }

        /* Degauss Wobble: the classic "press degauss on an old CRT"
           moment — a magnetic bulge that ripples through as a
           decaying scale/skew oscillation plus a brief brightness
           flex, then settles back to normal. No cut at any point. */
        @keyframes ec-degauss {
          0%   { transform: scale(1, 1) skewX(0deg); filter: brightness(1); }
          14%  { transform: scale(1.015, 0.985) skewX(0.5deg); filter: brightness(1.09); }
          30%  { transform: scale(0.99, 1.018) skewX(-0.35deg); filter: brightness(0.95); }
          46%  { transform: scale(1.008, 0.994) skewX(0.18deg); filter: brightness(1.04); }
          62%  { transform: scale(0.997, 1.005) skewX(-0.08deg); filter: brightness(0.99); }
          80%  { transform: scale(1.001, 0.999) skewX(0.02deg); filter: brightness(1.005); }
          100% { transform: scale(1, 1) skewX(0deg); filter: brightness(1); }
        }
        .ec-degauss { animation: ec-degauss 1100ms ease-in-out 1; }

        /* Phosphor Persistence Trail: a soft breathing smear, as if
           slow-decay phosphor is briefly failing to fully resolve the
           image — blur rises and falls once, smoothly, with a
           matching light dip in opacity, never fully losing the
           image. */
        @keyframes ec-phosphor-trail {
          0%   { filter: blur(0px); opacity: 1; }
          25%  { filter: blur(1.6px); opacity: 0.86; }
          55%  { filter: blur(2.6px); opacity: 0.74; }
          80%  { filter: blur(1px); opacity: 0.92; }
          100% { filter: blur(0px); opacity: 1; }
        }
        .ec-phosphor-trail { animation: ec-phosphor-trail 950ms ease-out 1; }

        /* Screen Curvature Ripple: a genuine liquid displacement wave
           (reusing the existing ec-warp-a/b turbulence filters, same
           technique as ec-scanimate above) rather than a jitter —
           reads as the screen's own curvature briefly flexing, not a
           broken signal. */
        @keyframes ec-curvature-ripple {
          0%   { filter: none; }
          35%  { filter: url(#ec-warp-a); }
          65%  { filter: url(#ec-warp-b); }
          100% { filter: none; }
        }
        .ec-curvature-ripple { animation: ec-curvature-ripple 850ms ease-in-out 1; }

        @keyframes ec-vhs-overlay {
          0%   { opacity: 0; }
          10%  { opacity: 0.55; }
          22%  { opacity: 0.1; }
          30%  { opacity: 0.4; }
          46%  { opacity: 0.05; }
          60%  { opacity: 0.3; }
          100% { opacity: 0; }
        }
        .ec-vhs-overlay-active { animation: ec-vhs-overlay 420ms steps(1, end) 1; }

        /* theme: localized text/button jitter-tear — see the scheduler
           effect above. clip-path insets slice the element horizontally
           at a shifting offset each step, combined with a small
           translate, for a quick "tearing" read rather than a smooth
           wobble; steps(1, end) keeps every step a hard cut, matching
           the VHS glitch profiles' snappiness instead of easing between
           positions. */
        @keyframes ec-jitter-tear {
          0%   { transform: translate(0, 0); clip-path: inset(0 0 0 0); }
          15%  { transform: translate(-3px, 1px); clip-path: inset(10% 0 60% 0); }
          30%  { transform: translate(2px, -1px); clip-path: inset(55% 0 15% 0); }
          45%  { transform: translate(-2px, 0); clip-path: inset(0 0 0 0); }
          60%  { transform: translate(3px, 1px); clip-path: inset(30% 0 40% 0); }
          75%  { transform: translate(-1px, -1px); clip-path: inset(0 0 0 0); }
          100% { transform: translate(0, 0); clip-path: inset(0 0 0 0); }
        }
        .ec-jitter-tear { animation: ec-jitter-tear 160ms steps(1, end) 1; }
        @keyframes ec-jitter-tear-b {
          0%   { transform: translate(0, 0) skewX(0deg); clip-path: inset(0 0 0 0); }
          20%  { transform: translate(4px, -1px) skewX(2deg); clip-path: inset(40% 0 20% 0); }
          40%  { transform: translate(-3px, 1px) skewX(-1deg); clip-path: inset(5% 0 70% 0); }
          60%  { transform: translate(2px, 0) skewX(1deg); clip-path: inset(0 0 0 0); }
          80%  { transform: translate(-2px, -1px) skewX(0deg); clip-path: inset(60% 0 5% 0); }
          100% { transform: translate(0, 0) skewX(0deg); clip-path: inset(0 0 0 0); }
        }
        .ec-jitter-tear-b { animation: ec-jitter-tear-b 190ms steps(1, end) 1; }

        /* theme: per-letter raster tear — see fireLetterTear. Each
           masthead character is its own span (split on mount), so this
           targets exactly one glyph at a time rather than the whole
           title: a sharp horizontal displacement plus a clip-path
           slice, snappier and more localized than the whole-title
           jitter-tear above. */
        .ec-letter { display: inline-block; }
        @keyframes ec-letter-tear {
          0%   { transform: translate(0, 0) skewX(0deg); clip-path: inset(0 0 0 0); }
          20%  { transform: translate(-5px, 2px) skewX(-4deg); clip-path: inset(45% 0 10% 0); }
          40%  { transform: translate(6px, -1px) skewX(3deg); clip-path: inset(5% 0 65% 0); }
          60%  { transform: translate(-4px, 1px) skewX(-2deg); clip-path: inset(0 0 0 0); }
          80%  { transform: translate(3px, 0) skewX(1deg); clip-path: inset(60% 0 8% 0); }
          100% { transform: translate(0, 0) skewX(0deg); clip-path: inset(0 0 0 0); }
        }
        .ec-letter-tear { animation: ec-letter-tear 130ms steps(1, end) 1; position: relative; z-index: 2; }

        /* theme: vertical hold instability — the whole masthead briefly
           rolls/jumps the way an old CRT does when it loses vertical
           sync, then snaps back. Applied to titleWrapRef (the row, not
           the text itself) so it carries the sparks/hold-zone along
           with it rather than just the glyphs. steps(1, end) again for
           a hard, digital snap between positions rather than a smooth
           roll. */
        @keyframes ec-vertical-hold {
          0%   { transform: translateY(0) scaleY(1); }
          10%  { transform: translateY(-14px) scaleY(1.08); }
          22%  { transform: translateY(9px) scaleY(0.94); }
          35%  { transform: translateY(-5px) scaleY(1.03); }
          50%  { transform: translateY(3px) scaleY(0.98); }
          65%  { transform: translateY(-2px) scaleY(1.01); }
          100% { transform: translateY(0) scaleY(1); }
        }
        .ec-vertical-hold { animation: ec-vertical-hold 480ms cubic-bezier(0.3, 0, 0.4, 1) 1; transform-origin: center top; }

        @media (prefers-reduced-motion: reduce) {
          .ec-vhs-glitch, .ec-vhs-glitch-b, .ec-vhs-glitch-c, .ec-vhs-glitch-d, .ec-vhs-glitch-e, .ec-vhs-glitch-f, .ec-vhs-overlay-active, .ec-jitter-tear, .ec-jitter-tear-b, .ec-scanimate, .ec-vidicon-burn, .ec-letter-tear, .ec-vertical-hold, .ec-chromatic-ghost, .ec-degauss, .ec-phosphor-trail, .ec-curvature-ripple { animation: none !important; }
        }

  .ec-fx-overlay {
    mix-blend-mode: screen;
    background: repeating-linear-gradient(rgba(180,235,255,0.5) 0px, rgba(180,235,255,0.5) 1px, transparent 1px, transparent 3px);
  }
  .ec-fx-overlay-inner {
    filter: url(#ec-static);
    opacity: 0.5;
  }

  /* SINGULARITY: only ever mounted once actually revealed (see
     renderSetupExtras) -- no more hidden/black-on-black resting state,
     so from the moment it exists it fades in briefly and then pulses
     on its own, no hover needed. The glow itself is two layers: a
     halo well outside the button's own box (an "event horizon" bleed,
     not a contained button glow) and the text's own shifting glow,
     both driven by the same slow, uneven color-cycle so the whole
     thing reads as one strange light source rather than a static
     control with a glow slapped on. Sized entirely from its flex-column
     parent (see the awaitingBegin block) rather than any fixed pixel
     target, so it always spans exactly the Anomaly/Begin Game row's
     own width above it. */
  .ec-singularity-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 5.5 / 1;
    min-height: 42px;
    background: #000000;
    border: 1.5px solid rgba(77, 232, 255, 0.18);
    box-sizing: border-box;
    padding: 8px 16px;
    overflow: visible;
    cursor: pointer;
    opacity: 0;
    animation: ec-singularity-appear 900ms ease-out forwards;
  }
  @keyframes ec-singularity-appear {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  /* The plasma halo: an oversized, blurred, color-cycling glow behind
     the text that spills well past the button's own edges (overflow
     above is visible, not hidden, specifically so this isn't clipped)
     -- an event horizon around the button, not a glow contained by it. */
  .ec-singularity-halo {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 150%;
    height: 320%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: screen;
    animation: ec-singularity-halo-mono 14s ease-in-out 0.9s infinite, ec-singularity-plasma 6s ease-in-out 0.9s infinite;
  }
  @keyframes ec-singularity-halo-mono {
    0%   { background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 46%, rgba(230,240,245,0.10) 54%, rgba(230,240,245,0) 66%); }
    8%   { background: radial-gradient(circle, rgba(215,219,224,0.42) 0%, rgba(215,219,224,0.16) 15%, rgba(215,219,224,0) 28%, rgba(215,219,224,0) 44%, rgba(200,205,210,0.08) 52%, rgba(200,205,210,0) 64%); }
    16%  { background: radial-gradient(circle, rgba(122,128,136,0.2) 0%, rgba(122,128,136,0) 22%, rgba(122,128,136,0) 40%, transparent 60%); }
    22%  { background: radial-gradient(circle, transparent 0%, transparent 100%); }
    30%  { background: radial-gradient(circle, rgba(195,200,206,0.35) 0%, rgba(195,200,206,0.14) 15%, rgba(195,200,206,0) 28%, rgba(195,200,206,0) 44%, rgba(180,185,190,0.07) 52%, rgba(180,185,190,0) 64%); }
    38%  { background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.26) 17%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 48%, rgba(230,240,245,0.12) 56%, rgba(230,240,245,0) 70%); }
    44%  { background: radial-gradient(circle, rgba(205,249,255,0.5) 0%, rgba(77,232,255,0.2) 16%, rgba(77,232,255,0) 30%, rgba(77,232,255,0) 46%, rgba(77,232,255,0.1) 54%, rgba(77,232,255,0) 66%); }
    50%  { background: radial-gradient(circle, rgba(138,143,150,0.18) 0%, rgba(138,143,150,0) 20%, transparent 60%); }
    58%  { background: radial-gradient(circle, transparent 0%, transparent 100%); }
    66%  { background: radial-gradient(circle, rgba(236,239,242,0.4) 0%, rgba(236,239,242,0.16) 15%, rgba(236,239,242,0) 28%, rgba(236,239,242,0) 44%, rgba(220,225,230,0.08) 52%, rgba(220,225,230,0) 64%); }
    74%  { background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 46%, rgba(230,240,245,0.1) 54%, rgba(230,240,245,0) 66%); }
    82%  { background: radial-gradient(circle, rgba(107,112,120,0.16) 0%, rgba(107,112,120,0) 20%, transparent 60%); }
    90%  { background: radial-gradient(circle, transparent 0%, transparent 100%); }
    96%  { background: radial-gradient(circle, rgba(185,190,197,0.38) 0%, rgba(185,190,197,0.15) 15%, rgba(185,190,197,0) 28%, rgba(185,190,197,0) 44%, rgba(170,175,180,0.07) 52%, rgba(170,175,180,0) 64%); }
    100% { background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 46%, rgba(230,240,245,0.10) 54%, rgba(230,240,245,0) 66%); }
  }
  @keyframes ec-singularity-plasma {
    0%   { transform: translate(-50%, -50%) scale(1); filter: blur(2px); }
    25%  { transform: translate(-50%, -50%) scale(1.05); filter: blur(3px); }
    50%  { transform: translate(-50%, -50%) scale(0.96); filter: blur(1.6px); }
    75%  { transform: translate(-50%, -50%) scale(1.03); filter: blur(2.4px); }
    100% { transform: translate(-50%, -50%) scale(1); filter: blur(2px); }
  }
  .ec-singularity-text {
    position: relative;
    z-index: 1;
    font-family: 'Chakra Petch', sans-serif;
    font-size: clamp(13px, 3.2vw, 24px);
    letter-spacing: 0.16em;
    line-height: 1;
    white-space: nowrap;
    color: #ffffff;
    font-weight: 400;
    text-shadow:
      0 0 0.06em #ffffff, 0 0 0.22em #ffffff,
      0 0 0.55em rgba(255, 255, 255, 0.9),
      0 0 1.3em rgba(255, 255, 255, 0.7),
      0 0 2.6em rgba(255, 255, 255, 0.5),
      0 0 4.2em rgba(255, 255, 255, 0.32);
    pointer-events: none;
    opacity: 0;
    animation: ec-singularity-text-appear 900ms ease-out forwards, ec-singularity-mono 14s ease-in-out 0.9s infinite;
  }
  @keyframes ec-singularity-text-appear {
    from { opacity: 0; filter: blur(10px); }
    to   { opacity: 1; filter: blur(0); }
  }
  /* The same uneven cycle as the halo (white -> dim grays -> a near-
     black "gone dark" moment -> a cyan flash -> repeat) so the text
     and its surrounding bleed always shift together. */
  @keyframes ec-singularity-mono {
    0%   { color: #ffffff; text-shadow: 0 0 0.06em #ffffff, 0 0 0.22em #ffffff, 0 0 0.55em rgba(255,255,255,0.9), 0 0 1.3em rgba(255,255,255,0.7), 0 0 2.6em rgba(255,255,255,0.5), 0 0 4.2em rgba(255,255,255,0.32); }
    8%   { color: #d7dbe0; text-shadow: 0 0 0.05em #d7dbe0, 0 0 0.18em #d7dbe0, 0 0 0.42em rgba(215,219,224,0.8), 0 0 0.9em rgba(215,219,224,0.55), 0 0 1.8em rgba(215,219,224,0.35); }
    16%  { color: #7a8088; text-shadow: 0 0 0.04em #7a8088, 0 0 0.1em rgba(122,128,136,0.5); }
    22%  { color: #161616; text-shadow: none; }
    30%  { color: #c3c8ce; text-shadow: 0 0 0.05em #c3c8ce, 0 0 0.2em #c3c8ce, 0 0 0.5em rgba(195,200,206,0.7), 0 0 1.1em rgba(195,200,206,0.45); }
    38%  { color: #ffffff; text-shadow: 0 0 0.07em #ffffff, 0 0 0.26em #ffffff, 0 0 0.65em rgba(255,255,255,0.95), 0 0 1.5em rgba(255,255,255,0.75), 0 0 3em rgba(255,255,255,0.55), 0 0 4.8em rgba(255,255,255,0.35); }
    44%  { color: #cdf9ff; text-shadow: 0 0 0.06em #cdf9ff, 0 0 0.2em #7ff1ff, 0 0 0.5em rgba(77,232,255,0.75), 0 0 1.2em rgba(77,232,255,0.5), 0 0 2.4em rgba(77,232,255,0.3); }
    50%  { color: #8a8f96; text-shadow: 0 0 0.04em #8a8f96, 0 0 0.12em rgba(138,143,150,0.45); }
    58%  { color: #141414; text-shadow: none; }
    66%  { color: #eceff2; text-shadow: 0 0 0.05em #eceff2, 0 0 0.18em #eceff2, 0 0 0.45em rgba(236,239,242,0.75), 0 0 1em rgba(236,239,242,0.5); }
    74%  { color: #ffffff; text-shadow: 0 0 0.06em #ffffff, 0 0 0.22em #ffffff, 0 0 0.55em rgba(255,255,255,0.9), 0 0 1.3em rgba(255,255,255,0.65), 0 0 2.7em rgba(255,255,255,0.4); }
    82%  { color: #6b7078; text-shadow: 0 0 0.04em #6b7078, 0 0 0.1em rgba(107,112,120,0.4); }
    90%  { color: #181818; text-shadow: none; }
    96%  { color: #b9bec5; text-shadow: 0 0 0.05em #b9bec5, 0 0 0.2em #b9bec5, 0 0 0.5em rgba(185,190,197,0.7), 0 0 1.1em rgba(185,190,197,0.45); }
    100% { color: #ffffff; text-shadow: 0 0 0.06em #ffffff, 0 0 0.22em #ffffff, 0 0 0.55em rgba(255,255,255,0.9), 0 0 1.3em rgba(255,255,255,0.7), 0 0 2.6em rgba(255,255,255,0.5), 0 0 4.2em rgba(255,255,255,0.32); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ec-singularity-btn { opacity: 1; animation: none; }
    .ec-singularity-halo { animation: none; background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 46%, rgba(230,240,245,0.10) 54%, rgba(230,240,245,0) 66%); }
    .ec-singularity-text { opacity: 1; filter: none; animation: none; }
  }
`;

/* The two per-pixel warp filters (video-turbulence/wavy-raster VHS
   profiles E/F) and the static-noise filter the FX overlay uses need
   real <filter> elements in the DOM, not just CSS — SVG filters can't
   be expressed as pure CSS. Rendered once, globally, since every
   profile that references url(#ec-warp-a) etc. needs it available
   regardless of which element is currently glitching. */
/* React.createElement, not JSX — this file stays plain ES modules
   (loadable directly by Node for the smoke tests in tests/) rather
   than requiring a JSX transform outside the build step. */
export function renderGlobalDefs() {
  const h = React.createElement;
  return h(
    "svg",
    { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
    h(
      "defs",
      null,
      h(
        "filter",
        { id: "ec-static" },
        h("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", stitchTiles: "stitch", result: "noise" }),
        h("feColorMatrix", { in: "noise", type: "matrix", values: "0 0 0 0 0.7  0 0 0 0 0.92  0 0 0 0 1  0 0 0 0.9 0" })
      ),
      h(
        "filter",
        { id: "ec-warp-a", x: "-20%", y: "-20%", width: "140%", height: "140%" },
        h("feTurbulence", { type: "turbulence", baseFrequency: "0.008 0.05", numOctaves: "2", seed: "3", result: "ec-warp-a-noise" }),
        h("feDisplacementMap", { in: "SourceGraphic", in2: "ec-warp-a-noise", scale: "26", xChannelSelector: "R", yChannelSelector: "G" })
      ),
      h(
        "filter",
        { id: "ec-warp-b", x: "-20%", y: "-20%", width: "140%", height: "140%" },
        h("feTurbulence", { type: "turbulence", baseFrequency: "0.015 0.02", numOctaves: "1", seed: "9", result: "ec-warp-b-noise" }),
        h("feDisplacementMap", { in: "SourceGraphic", in2: "ec-warp-b-noise", scale: "34", xChannelSelector: "R", yChannelSelector: "B" })
      )
    )
  );
}

/* Local state/handlers for the pre-game setup screen's Neon-exclusive
   extras (the Anomaly button, the Singularity hover-hold reveal and
   its info popup). A REAL React hook — not a plain function — because
   it needs useState/useRef/useEffect, and the chassis calls it
   unconditionally every render (see chassis/ElCabeza3D.jsx) so that's
   safe despite living in a theme module. `awaitingBegin`/`pieces`/
   `setPieces` are chassis state, passed in because handleAnomaly needs
   to write pieces and the Singularity hold timer only makes sense
   during setup. */
export function useSetupExtras({ awaitingBegin, setPieces, audio }) {
  const [singularityRevealed, setSingularityRevealed] = React.useState(false);
  const [showSingularityInfo, setShowSingularityInfo] = React.useState(false);
  const singularityHoldRef = React.useRef(null);
  const singularityHideTimerRef = React.useRef(null);

  function handleAnomaly() {
    // Setup-phase-only random layout generator (see its button, gated
    // on awaitingBegin) — just swaps piece positions, nothing else
    // about game state, so clicking it repeatedly is fine: each click
    // is an independent fresh randomization.
    if (!awaitingBegin) return;
    audio.playAnomaly();
    setPieces(generateAnomalySetup());
  }

  /* The Phantom Reveal button auto-hides 10s after it appears
     (mirroring the masthead's own Info-button reveal/auto-hide).
     Re-holding Anomaly (the same 4s discovery gesture) brings it back
     and restarts this countdown; opening its info panel pauses the
     countdown while reading, then gives it a fresh 10s once closed. */
  function beginSingularityHold() {
    clearTimeout(singularityHoldRef.current);
    singularityHoldRef.current = setTimeout(() => {
      setSingularityRevealed(true);
      clearTimeout(singularityHideTimerRef.current);
      singularityHideTimerRef.current = setTimeout(() => setSingularityRevealed(false), 10000);
    }, 4000);
  }
  function cancelSingularityHold() {
    clearTimeout(singularityHoldRef.current);
  }

  function openSingularityInfo() {
    clearTimeout(singularityHideTimerRef.current);
    setShowSingularityInfo(true);
    audio.playSingularityOpen();
  }
  function closeSingularityInfo() {
    setShowSingularityInfo(false);
    clearTimeout(singularityHideTimerRef.current);
    singularityHideTimerRef.current = setTimeout(() => setSingularityRevealed(false), 10000);
    audio.playSingularityClose();
  }

  React.useEffect(() => {
    return () => {
      clearTimeout(singularityHoldRef.current);
      clearTimeout(singularityHideTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!showSingularityInfo) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeSingularityInfo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSingularityInfo]);

  return {
    handleAnomaly,
    singularityRevealed,
    showSingularityInfo,
    beginSingularityHold,
    cancelSingularityHold,
    openSingularityInfo,
    closeSingularityInfo,
  };
}

/* The pre-game row: Anomaly sits beside the chassis-supplied Begin Game
   button; the Singularity phantom button (once revealed) sits below
   both. Takes over the whole row/column rather than just appending
   after Begin Game, since Anomaly has to sit BEFORE it. */
export function renderSetupExtras({ beginGameButton, handleAnomaly, beginSingularityHold, cancelSingularityHold, singularityRevealed, openSingularityInfo }) {
  const h = React.createElement;
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, flexShrink: 0 } },
    h(
      "div",
      { style: { display: "flex", gap: 8, flexShrink: 0 } },
      h(
        "button",
        {
          key: "anomaly",
          className: "ec-btn ec-btn-invert",
          onClick: handleAnomaly,
          onMouseEnter: beginSingularityHold,
          onMouseLeave: cancelSingularityHold,
          onTouchStart: beginSingularityHold,
          onTouchEnd: cancelSingularityHold,
          onTouchCancel: cancelSingularityHold,
          title: "Generate a random, rotationally-symmetric opening layout",
          style: {
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.charcoal,
            background: "transparent",
            border: `1.5px solid ${COLORS.charcoal}`,
            padding: "9px 16px",
            cursor: "pointer",
            flex: "1 0 auto",
          },
        },
        "Anomaly"
      ),
      beginGameButton
    ),
    singularityRevealed &&
      h(
        "div",
        { className: "ec-singularity-btn", onClick: openSingularityInfo, title: "???" },
        h("div", { className: "ec-singularity-halo", "aria-hidden": "true" }),
        h("span", { className: "ec-singularity-text" }, "SINGULARITY")
      )
  );
}

/* The Singularity info popup — a standalone, always-mounted modal (like
   the chassis's own Info overlay/Victory placard) rather than nested
   inside the setup row, so its own opacity transition works the same
   way theirs do. */
export function renderExtraOverlays(setupExtras) {
  if (!setupExtras) return null;
  const { showSingularityInfo, closeSingularityInfo } = setupExtras;
  const h = React.createElement;
  return h(
    "div",
    {
      onClick: closeSingularityInfo,
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(2,4,8,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        zIndex: 1050,
        opacity: showSingularityInfo ? 1 : 0,
        pointerEvents: showSingularityInfo ? "auto" : "none",
        transition: "opacity 0.3s ease",
      },
    },
    h(
      "div",
      {
        onClick: (e) => e.stopPropagation(),
        style: {
          position: "relative",
          width: "clamp(280px, 78%, 500px)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "rgba(4,6,10,0.92)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(77,232,255,0.28)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.7), 0 0 50px rgba(77,232,255,0.14)",
          padding: "40px 32px 30px",
          boxSizing: "border-box",
        },
      },
      h(
        "h2",
        {
          style: {
            margin: "0 0 6px",
            textAlign: "center",
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: 700,
            fontSize: 21,
            letterSpacing: "0.1em",
            color: "#00ffff",
            textShadow: "0 0 18px rgba(0,255,255,0.45)",
          },
        },
        "SINGULARITY PROTOCOL"
      ),
      h(
        "p",
        {
          style: {
            margin: "0 0 24px",
            textAlign: "center",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(77,232,255,0.65)",
          },
        },
        "Status: In Development"
      ),
      h(
        "div",
        { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, lineHeight: 1.7, color: "#cfd8dc" } },
        h(
          "p",
          { style: { margin: "0 0 16px" } },
          "An experimental rules variant, not yet playable. When it lands, entering the Singularity will open a distinct branch of the game with:"
        ),
        h(
          "ul",
          { style: { margin: "0 0 18px", paddingLeft: 20 } },
          h("li", { style: { marginBottom: 8 } }, "New piece types, each with movement rules of their own."),
          h(
            "li",
            { style: { marginBottom: 8 } },
            "A black hole variant: sections of the board become impassable, reshaping the battlefield mid-game."
          ),
          h("li", { style: { marginBottom: 0 } }, "User-defined board dimensions, rather than the fixed 10×10 grid.")
        ),
        h(
          "p",
          { style: { margin: 0, color: "rgba(207,216,220,0.7)", fontStyle: "italic" } },
          "Planned primarily as a Neon Cabeza branch, with a possible toggle to bring the same variant to standard El Cabeza's own theming once the rules themselves are finalized."
        )
      )
    )
  );
}

/* Scene lighting: color/intensity only — see themes/standard.js's
   `lights` for why this is a data table rather than a hook. The
   hemisphere's sky/ground colors shift from warm tan to a hazy
   cyan-over-near-black cast (distant city-glow rather than daylight),
   and the fill light carries a faint violet cast — the one place the
   "deep violet" accent shows up as ambient light rather than a UI
   color, so it stays atmosphere rather than decoration. */
export const lights = {
  ambient: { color: 0xffffff, intensity: 0.16 },
  hemi: { sky: 0x8fd8ff, ground: 0x05070a, intensity: 0.24 },
  key: { color: 0xcfe9ff, intensity: 1.02 },
  fill: { color: 0xb9a8ff, intensity: 0.34 },
  back: { color: 0xdfe8ff, intensity: 0.18 },
};

/* The slab's six BoxGeometry face materials. theme: MeshPhysicalMaterial's
   clearcoat layer on the top face, per feedback ("glossy sheen on the
   board surface") — a thin, fairly glossy lacquer coat over the same
   textured surface, rather than raising the base material's own
   reflectivity (which would also brighten/flatten the board texture's
   colors). Base roughness lowered a bit too so the underlying surface
   itself reads a touch less matte, with the clearcoat doing most of
   the "sheen" work via its own sharp highlight. */
export function buildSlabMaterials(boardTex) {
  const side = () => new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.55, metalness: 0.3 });
  return [
    side(),
    side(),
    new THREE.MeshPhysicalMaterial({
      map: boardTex,
      roughness: 0.55,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: 0,
      polygonOffsetUnits: 3,
    }),
    side(),
    side(),
    side(),
  ];
}

export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  /* theme: a faint emissive core per player (cyan for Dark, amber
     for Light) — "glowing internal cores" from the brief — kept low
     (0.08-0.1) so it reads as an inner glow, not a lit-up toy; body
     color, geometry, and shadow behavior are all unchanged.
     Per feedback, the body is now semi-translucent (a "digital
     glass" read) — the solid neon rim shell built below stays
     fully opaque, so the piece keeps a crisp, legible silhouette
     even though its body can be partly seen through.

     depthWrite: false fixes a real bug reported on rolling pieces:
     makeRoundedBox's beveled edges are built from many small
     segments (seg=8), and while that self-overlapping/near-
     coincident geometry is invisible on an opaque material (two
     triangles at nearly the same depth just paint the same lit
     color over each other), it z-fights against ITSELF once the
     material is translucent — as the piece rotates during a roll,
     which of two coincident triangles wins the depth test flips
     frame to frame, so a strip of the surface intermittently
     fails the test and never gets drawn at all, reading as a dark
     "hole" sweeping across the piece. With depthWrite off, the
     body's own triangles no longer compete with each other for
     depth priority (they still correctly test against, and stay
     hidden behind, actually-opaque geometry like the board or
     another piece's shell, since depthTest is still on and the
     opaque pass renders first) — only the rare case of two
     translucent pieces overlapping in screen space could sort
     imperfectly against each other, which is far less visible
     than this was. */
  const mat = new THREE.MeshStandardMaterial({
    color: isDark ? HEX.charcoal : HEX.pieceLight,
    roughness: isDark ? 0.42 : 0.5,
    metalness: isDark ? 0.35 : 0.15,
    emissive: isDark ? HEX.glowCyan : HEX.glowAmber,
    emissiveIntensity: isDark ? 0.105 : 0.084,
    transparent: true,
    /* Light's opacity was reduced 2% (0.804 -> 0.788) per feedback,
       then Dark was raised to match that same level rather than the
       two colors sitting at visibly different translucency. */
    opacity: 0.788,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  /* theme: per feedback, permanently drops receiveShadow on the
     piece body (it still casts one onto the board/other pieces,
     keeping the grounded look) — this eliminates shadow acne from a
     surface receiving its own near-coincident cast shadow. */
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1; // explicitly after the grid's -10 — see buildGrid's renderOrder comment
  mesh.userData = { pieceId: piece.id, kind: "piece" };

  /* Box pieces trace a SIMPLIFIED PROXY (a plain sharp-cornered
     BoxGeometry at the piece's true outer dimensions) rather than
     their own beveled render geometry — makeRoundedBox has no sharp
     macro edges at all, so tracing it directly means either zero
     visible edges or ~700+ tiny ones through each rounded corner. The
     disc keeps tracing its own real geometry (a plain cylinder has
     genuinely sharp, non-tangent cap edges, so it was never the
     problem). */
  const outlineSourceGeo = isDisc
    ? geo
    : new THREE.BoxGeometry(piece.w * PIECE_SCALE, piece.z * PIECE_SCALE, piece.h * PIECE_SCALE);
  const edgesGeo = new THREE.EdgesGeometry(outlineSourceGeo, 10);
  if (!isDisc) outlineSourceGeo.dispose(); // the disc case reuses `geo`, the real body's own geometry — never dispose that one
  const shell = new THREE.LineSegments(
    edgesGeo,
    new THREE.LineBasicMaterial({
      // Light's outline uses a darker, more saturated orange
      // (glowAmberOutline) rather than the body's pale amber, and is
      // more transparent — a subtler accent than Dark's cyan rim.
      color: isDark ? HEX.glowCyan : HEX.glowAmberOutline,
      transparent: true,
      opacity: isDark ? 0.945 : 0.4,
      depthWrite: false,
    })
  );
  shell.position.set(center.x, y, center.z);
  /* Shares the body's own renderOrder rather than a separate later
     one, so Three's normal back-to-front transparent sort interleaves
     bodies and shells from DIFFERENT pieces by real camera distance —
     a uniformly later renderOrder for every shell would mean a nearer
     piece's body could never properly occlude a farther piece's
     outline no matter how much depth actually separated them. */
  shell.renderOrder = 1;
  shell.userData = { pieceId: piece.id, kind: "shell" };

  return { mesh, shell };
}

/* Move/legal-move indicator: a four-corner L-bracket "targeting
   reticle" — Neon's own replacement for Standard's dashed square,
   deliberately different rather than the same shape recolored (a
   dashed charcoal square reads as board-game notation; Standard's own
   HEX.charcoal happens to be near-black on Standard's cream board, but
   Neon's semantic "charcoal" — the Dark player's own near-black tone —
   sits on Neon's OWN near-black board, so reusing that shared chassis
   line was invisible here; this both fixes that and gives Neon a
   distinct sci-fi-HUD identity for it).

   Second full revision of the entrance, per feedback that the first
   (a vertical free-fall + spring-bounce from 2 units above the board)
   should be replaced outright: each corner now starts flat at board
   level already, offset 25% further out than its true corner, and
   slides inward (brisk ease-in/ease-out, no vertical motion at all)
   to land exactly on the corner. Arrival triggers a "targeting lock"
   flash: one quick opacity blink, then three true brightness strobes
   (an actual color-toward-white + halo boost, not just an opacity
   toggle) — kept subtle overall but always reading brighter than the
   board's own grid lines. The chassis owns WHEN this fades in/out or
   brightens on hover, exactly as Standard's does (see setOpacity());
   everything about HOW it looks and animates is owned entirely here.

   Each corner is now ONE flat L-shaped mesh (a 6-vertex hexagon: two
   rectangular arms sharing their own corner square), not two
   separate overlapping boxes — the previous version's two bars each
   reached fully into the vertex, so their rectangles doubled up right
   at the corner, reading as a bright overlap blob in a
   transparent/additive material. One contiguous shape has no seam to
   overlap at all, which is what actually delivers "crisper... no
   vertex overlap" rather than just thinning the old bars further. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  const sideX = hx * 2, sideZ = hz * 2;
  const segX = sideX * 0.22, segZ = sideZ * 0.22; // "22% of the square's own side length inward" — unchanged
  const THICKNESS = isCrush ? 0.03 : 0.024; // thinner again per feedback — was 0.041 / 0.034
  const RESTING_Y = 0.025; // fixed for the whole animation now — nothing moves vertically
  const SPREAD = 1.25; // "approximately 25% larger than their respective target corners" — was 1.75, and no longer paired with any vertical spawn height
  const SLIDE_MS = 160; // "quickly slide/move inward" — the whole approach, brisk ease-in/ease-out
  const BLINK_MS = 70; // the initial quick opacity blink's own half-step
  const STROBE_MS = 100; // each of the 3 brightness-strobe pulses (up + down)
  const STROBE_COUNT = 3;
  const GRAVITY = 5.5; // world units/s^2 pulling shed particles back down

  // Brisk, symmetric ease-in/ease-out for the slide — accelerates hard
  // off the spawn point, decelerates hard into the corner, rather than
  // easing only on one end the way a fall's landing-only ease did.
  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  // One corner's L-shaped flat hexagon: vertex at the mesh's own local
  // origin, arms extending toward (armX, 0) and (0, armZ) — signed, so
  // passing the corner's own inward direction directly (rather than a
  // magnitude the caller then has to flip) is what points the two arms
  // the right way without any separate mirroring/scale trick, and
  // without the winding-order sign flips a mirrored scale would cause
  // (material.side below is set to DoubleSide as a robustness
  // backstop regardless, since a hand-built triangle fan's winding
  // relative to "viewed from above" is easy to get backwards).
  function makeLGeometry(armX, armZ, thickness) {
    const verts = new Float32Array([
      0, 0, 0,
      armX, 0, 0,
      armX, 0, thickness,
      thickness, 0, thickness,
      thickness, 0, armZ,
      0, 0, armZ,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
    geo.computeVertexNormals();
    return geo;
  }

  // A single corner's L: a solid inner core plus a softer, wider
  // additive halo behind it — the "glowing, semi-transparent"
  // dual-layer look, same technique as the piece shells' own rim glow.
  // The halo shares the core's own vertex exactly (arms merely longer/
  // thicker by the same factor) so the two layers stay concentric
  // through the slide instead of drifting apart.
  function makeCorner(armX, armZ) {
    const core = new THREE.Mesh(
      makeLGeometry(armX, armZ, THICKNESS),
      new THREE.MeshBasicMaterial({
        color: HEX.glowCyan, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    const halo = new THREE.Mesh(
      makeLGeometry(armX * 1.6, armZ * 1.6, THICKNESS * 1.6),
      new THREE.MeshBasicMaterial({
        color: HEX.glowCyan, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    group.add(core, halo);
    return { core, halo };
  }

  // Each corner's L is built once, arms already at their true inward
  // length/direction — nothing about its SHAPE animates, only its
  // (shared core+halo) position, sliding from the spread-out spawn
  // point to the true corner.
  const corners = [];
  const cornerLandingPoints = [];
  [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
  ].forEach(([sx, sz]) => {
    const endX = sx * hx, endZ = sz * hz;
    const startX = sx * hx * SPREAD, startZ = sz * hz * SPREAD;
    cornerLandingPoints.push({ x: endX, z: endZ });
    const { core, halo } = makeCorner(-sx * segX, -sz * segZ); // arms point inward: opposite the corner's own sign
    corners.push({ core, halo, startX, startZ, endX, endZ });
  });

  // Landing-impact particles: a handful of small, differently-sized
  // glowing chips per corner that kick loose the instant that corner
  // touches down, scatter outward under a bit of gravity, and burn out
  // fast — a debris shed, not a persistent decoration. Independent of
  // the bars' own lifecycle: still ticking (and disposed) even after
  // the bracket itself is done animating.
  const particles = [];
  let particlesSpawned = false;

  function spawnParticles(cornerX, cornerZ) {
    const count = 4 + Math.floor(Math.random() * 3); // 4-6 per corner
    for (let i = 0; i < count; i++) {
      const size = 0.012 + Math.random() * 0.03; // "smaller, but different sized"
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({
          color: HEX.glowCyan,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.1;
      mesh.position.set(cornerX, RESTING_Y, cornerZ);
      group.add(mesh);
      particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 0.9 + Math.random() * 0.9,
        bornAt: performance.now(),
        lifeMs: 260 + Math.random() * 260,
      });
    }
  }

  let lastParticleTickAt = null;
  function tickParticles(now) {
    // Real elapsed time since the last particle update, not an assumed
    // frame rate — this environment's own render loop has been observed
    // running well under 60fps under load, and a fixed-dt physics step
    // would make particles crawl in slow motion whenever frames are
    // sparse while their (real-time-based) fade races ahead unchanged.
    const dt = lastParticleTickAt ? Math.min((now - lastParticleTickAt) / 1000, 0.05) : 0.016;
    lastParticleTickAt = now;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const ageMs = now - p.bornAt;
      if (ageMs >= p.lifeMs) {
        group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y = Math.max(RESTING_Y, p.mesh.position.y + p.vy * dt);
      p.mesh.material.opacity = 0.9 * (1 - ageMs / p.lifeMs);
    }
  }

  const spawnedAt = performance.now();
  let landed = false;
  // The opacity chassis's own setOpacity() last asked for — hover
  // emphasis and the ghost fade-in/out both drive this continuously,
  // but it's only actually APPLIED to the materials once the intro
  // sequence below is done with them (see setOpacity/applyFrame).
  let pendingOpacity = 0;

  // Timeline, each phase strictly after the last:
  //   0 .. SLIDE_MS            the inward slide (fading in as it goes)
  //   .. + BLINK_MS*2          one quick opacity blink (full -> dip -> full)
  //   .. + STROBE_MS*3         three true brightness strobes ("targeting lock")
  // then landed — chassis's own setOpacity() takes over from there.
  const BLINK_END = SLIDE_MS + BLINK_MS * 2;
  const STROBE_END = BLINK_END + STROBE_MS * STROBE_COUNT;
  const cyanColor = new THREE.Color(HEX.glowCyan);
  const whiteColor = new THREE.Color(0xffffff);
  const tmpColor = new THREE.Color();

  // v is the chassis's own 0-1 opacity request (hover emphasis, fade
  // in/out). Per feedback ("must be subtle, but brighter than
  // surrounding grid lines"), both layers are boosted well past a
  // literal 1:1 mapping of v — measured against a real screenshot
  // next to the board's own grid lines, a bare v (and the halo's
  // ratio used elsewhere in this file for unrelated effects) read as
  // DIMMER than the grid at v's resting value, the opposite of the
  // ask. The core stays a thin, subtle line (a mild boost, capped at
  // fully opaque); the halo — additive, so it actually glows against
  // the dark board rather than just overlaying flat color — carries
  // most of the "clearly brighter" read.
  function setCornersOpacity(v) {
    // A flat multiplier on v wasn't enough — even boosted, v's own
    // resting value (0.5, set by the chassis's hover-emphasis logic)
    // scaled down to something a screenshot still showed reading
    // dimmer than the grid. A floor lifts the resting case specifically
    // without flattening the hover/fade curve chassis is driving.
    const coreOp = Math.min(1, 0.35 + v * 0.9);
    const haloOp = Math.min(1, 0.25 + v * 1.1);
    corners.forEach(({ core, halo }) => {
      core.material.opacity = coreOp;
      halo.material.opacity = haloOp;
    });
  }

  function applyFrame(now) {
    // Clamped to 0: a rAF timestamp can land fractionally earlier than
    // this object's own creation-time performance.now() call (they're
    // captured on different ticks of the event loop), which would
    // otherwise send the slide backward for one frame.
    const elapsed = Math.max(0, now - spawnedAt);
    const slideT = Math.min(elapsed / SLIDE_MS, 1);
    const posE = easeInOutQuint(slideT);

    // Position slides in throughout, then never moves again — no
    // vertical motion at all, per feedback replacing the old fall.
    corners.forEach(({ core, halo, startX, startZ, endX, endZ }) => {
      const x = startX + (endX - startX) * posE;
      const z = startZ + (endZ - startZ) * posE;
      core.position.set(x, RESTING_Y, z);
      halo.position.set(x, RESTING_Y, z);
    });

    if (elapsed < SLIDE_MS) {
      // Fading in WHILE sliding (0 -> full exactly as it arrives)
      // rather than popping in at full opacity the instant it spawns.
      setCornersOpacity(slideT);
      return;
    }

    if (!particlesSpawned) {
      particlesSpawned = true;
      // "Sometimes" — each corner independently rolls its own chance
      // to shed debris the instant it arrives, so a given indicator
      // might kick loose particles at one, all four, or none of its
      // corners, rather than always firing identically at every one.
      cornerLandingPoints.forEach((c) => {
        if (Math.random() < 0.6) spawnParticles(c.x, c.z);
      });
    }

    if (elapsed < BLINK_END) {
      // One quick blink: dips toward (not all the way to) off, at the
      // blink's midpoint, then back to full — reads as a brief
      // "acquiring" flicker rather than the lock-on strobe itself.
      const blinkT = (elapsed - SLIDE_MS) / (BLINK_MS * 2);
      const dip = Math.sin(blinkT * Math.PI);
      const opacity = 1 - dip * 0.85;
      setCornersOpacity(opacity);
      return;
    }

    if (elapsed < STROBE_END) {
      // Three actual brightness pulses — the core color itself lerps
      // toward white at each peak (MeshBasicMaterial opacity alone
      // maxes out at "fully opaque cyan," which reads as no brighter
      // than the resting state; a real color shift plus a brighter
      // halo is what actually sells "brighter than the grid lines,"
      // kept subtle by capping how far toward white it goes). Halo
      // opacity also spikes at each peak, on top of its own boosted
      // base level while the strobe is active.
      const pulseT = ((elapsed - BLINK_END) % STROBE_MS) / STROBE_MS;
      const pulse = Math.sin(pulseT * Math.PI);
      tmpColor.copy(cyanColor).lerp(whiteColor, pulse * 0.5);
      corners.forEach(({ core, halo }) => {
        core.material.color.copy(tmpColor);
        core.material.opacity = 1;
        halo.material.opacity = 0.45 + pulse * 0.45;
      });
      return;
    }

    landed = true;
    corners.forEach(({ core }) => core.material.color.copy(cyanColor));
    setCornersOpacity(pendingOpacity);
  }
  applyFrame(spawnedAt); // first frame lands correctly even before any tick() call

  return {
    root: group,
    setOpacity(v) {
      pendingOpacity = v;
      if (landed) setCornersOpacity(v);
    },
    tick(now) {
      if (!landed) applyFrame(now);
      if (particles.length) tickParticles(now);
    },
    dispose() {
      corners.forEach(({ core, halo }) => {
        core.geometry.dispose();
        core.material.dispose();
        halo.geometry.dispose();
        halo.material.dispose();
      });
      particles.forEach((p) => {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
    },
  };
}

/* A synthesized ambient bed (Web Audio API, no external assets) plus a
   sparse, randomized layer of "machine is alive" micro-events, plus a
   handful of short gameplay cues. Entirely isolated from game state —
   every call site below is a single fire-and-forget method call from
   an existing state transition (select, move, capture, win, camera
   zoom); nothing in here can read or change what actually happens on
   the board, and if Web Audio is unavailable the game stays fully
   playable, just silent.

   Autoplay policies require a user gesture before any audio can
   start, so ensureStarted() is idempotent and cheap to call from
   anywhere — it's wired to the first pointer-down on the board. */
export function createSoundscape() {
  const MASTER_GAIN = Math.pow(10, 17 / 20); // +4dB, +10dB, then a further +3dB per feedback ("maximize the overall gain across every audio channel") — +17dB total, applied once at the final stage
  let ctx = null;
  let master = null; // overall output, respects mute
  let ambientGain = null; // hum + noise bed, scaled live by zoom
  let introGain = null; // 0->1 fade multiplier on the ambient bed only, see beginGameFadeIn
  let crackleGain = null; // silent until close to max zoom — see setZoom/startCrackle
  let crackleHissGain = null; // brown-noise bed under the crackle, same zoom curve at ~5% of its peak
  let eventsGain = null; // random micro-events
  let sfxGain = null; // gameplay cues — stays audible above the ambience
  let reverbNode = null; // short synthetic impulse, for the landing thud
  let cathedralReverb = null; // long synthetic impulse, built lazily for the choir stab only
  let choirMasterEnv = null; // the active choir stab's master gain, so an early close can cut it short
  let choirEndTime = 0; // ctx.currentTime at which the active choir stab naturally finishes
  let thudShaper = null; // crunch/distortion stage shared by landing thuds
  let muted = false;
  let started = false;
  let disposed = false;
  let windingDown = false; // true once a win fires — ambient schedulers stop re-arming, master gain fades to 0
  let wanderFn = null; // the hum's buzz-wander recursive step, stashed so resetWindDown can re-arm it after a win
  let grainFn = null; // the crackle's grain recursive step, stashed for the same reason
  let noiseBuffer = null;
  let brownNoiseBuffer = null;
  let scheduleTimer = null;
  let buzzWanderTimer = null;
  let crackleTimer = null;
  const recentEvents = [];
  // The hum's own "breathing" resonance LFOs — kept here so setTension
  // (see below) can speed them up live as a Cabeza gets closer to
  // danger or to winning, rather than only being set once at start.
  let humLfo1 = null;
  let humLfo2 = null;
  let humLfo1BaseFreq = 0;
  let humLfo2BaseFreq = 0;
  let tension = 0; // 0-1, settable before ensureStarted — applied once the hum actually starts

  const nowT = () => ctx.currentTime;

  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Brown (red) noise via leaky integration of white noise — each
     sample is a damped running sum of the last, which biases energy
     toward the low end for a warmer, duller hiss than the white-noise
     buffer above. Re-gained afterward since integration collapses the
     raw amplitude a great deal. */
  function makeBrownNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  /* A short synthetic impulse response — decaying noise, not a
     recording — for a ConvolverNode. Gives a percussive hit a sense
     of a small, hard room around it ("short reverb") without needing
     any external audio asset. */
  function makeImpulse(duration, decay) {
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function noiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function brownNoiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer;
    src.loop = true;
    return src;
  }

  /* Simple attack/hold/release envelope applied to a gain node. Every
     synthesized event below is built from this plus one or two
     oscillators/noise sources — the "simple components" the brief
     asks for, nothing sample-based. */
  function env(node, t0, attack, hold, release, peak) {
    node.gain.setValueAtTime(0, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + attack);
    node.gain.setValueAtTime(peak, t0 + attack + hold);
    node.gain.linearRampToValueAtTime(0, t0 + attack + hold + release);
  }

  /* A tanh soft-clip curve for the events bus's WaveShaper — gentle at
     low amplitude, increasingly rounded near the extremes. This is
     what turns a clean synthesized click or sweep into something with
     a bit of analog grit/asymmetry instead of a pristine tone. */
  function makeSoftClipCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = Math.tanh(amount) || 1;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / k;
    }
    return curve;
  }

  function pan(node) {
    if (!ctx.createStereoPanner) return node;
    const p = ctx.createStereoPanner();
    // Biased toward the edges rather than dead center, so an event
    // reads as coming from somewhere in the room, not from the board
    // itself — "the environment feels larger than the visible board."
    p.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.6);
    node.connect(p);
    return p;
  }

  function startHum() {
    /* Two slightly detuned low oscillators through a lowpass filter —
       the transformer-like beating comes from the detune itself, not
       from any rhythmic modulation layered on top. */
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 230; // opened slightly so the hum survives on speakers that roll off below ~150Hz
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;

    [55, 55.6].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.55;
      osc.connect(g).connect(humFilter);
      osc.start();
    });

    /* An octave-down sub oscillator underneath — the deep, felt-more-
       than-heard foundation that's closer to Vangelis/Blade-Runner-era
       sub-bass than the mid-low hum alone gives. */
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 27.5;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    sub.connect(subGain).connect(humFilter);
    sub.start();

    /* A very slow filter sweep on the hum's own tone color — distinct
       from the amplitude LFOs below, this one moves the lowpass cutoff
       itself, so the hum's timbre drifts warmer/brighter over a long,
       irregular cycle the way an analog pad slowly evolves rather than
       just getting louder/quieter. */
    const filterLfo = ctx.createOscillator();
    filterLfo.type = "sine";
    filterLfo.frequency.value = 1 / 47;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 55;
    filterLfo.connect(filterLfoGain).connect(humFilter.frequency);
    filterLfo.start();

    /* Slow "breathing" on the hum's own level — two independent,
       slow LFOs (an irrational-ish ratio to each other) summed onto
       the same gain param, so two non-aligning cycles beat against
       each other over a very long span, which is what reads as
       "irregular" rather than a single, eventually-recognizable
       breathing rate.

       Per feedback, their baseline rate is now 40% slower again to
       start (33.75s / 48.25s, was 20.25s / 28.95s), but setTension
       (see the public API below) can speed both up live — toward
       roughly their pre-slowdown rate at full tension — as a Cabeza
       gets closer to being crushed or to winning. References and base
       frequencies are kept in the outer closure so setTension can
       reach them after this function returns. */
    const lfo1 = ctx.createOscillator();
    lfo1.type = "sine";
    humLfo1BaseFreq = 1 / 135; // doubled period again per feedback (was 1/67.5)
    lfo1.frequency.value = humLfo1BaseFreq;
    const lfo1Gain = ctx.createGain();
    lfo1Gain.gain.value = 0.009;
    lfo1.connect(lfo1Gain).connect(humGain.gain);
    lfo1.start();
    humLfo1 = lfo1;

    const lfo2 = ctx.createOscillator();
    lfo2.type = "sine";
    humLfo2BaseFreq = 1 / 193; // doubled period again per feedback (was 1/96.5)
    lfo2.frequency.value = humLfo2BaseFreq;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 0.006;
    lfo2.connect(lfo2Gain).connect(humGain.gain);
    lfo2.start();
    humLfo2 = lfo2;

    applyTension(tension); // pick up any tension set before the hum existed

    humFilter.connect(humGain).connect(ambientGain);

    /* A faint band of filtered noise for circuitry hiss — turned down
       hard (was 0.004, now roughly a third of that) and, instead of
       sitting on one fixed band forever, its center frequency and
       level drift to a new random target on an irregular multi-second
       schedule, so the hiss itself has some life to it rather than
       reading as a static tone. Cut a further 30% per feedback (this
       is the ambient hiss, not the zoomed-in crackle's own separate
       hiss layer, which is untouched). */
    const buzz = noiseSource();
    const buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = "bandpass";
    buzzFilter.frequency.value = 1400;
    buzzFilter.Q.value = 0.6;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.00091;
    buzz.connect(buzzFilter).connect(buzzGain).connect(ambientGain);
    buzz.start();

    const wander = () => {
      if (disposed || windingDown) return;
      const t0 = nowT();
      buzzFilter.frequency.setTargetAtTime(900 + Math.random() * 1800, t0, 2.5);
      buzzGain.gain.setTargetAtTime(0.00042 + Math.random() * 0.00112, t0, 2.5);
      buzzWanderTimer = setTimeout(wander, 5000 + Math.random() * 9000);
    };
    wanderFn = wander;
    buzzWanderTimer = setTimeout(wander, 4000 + Math.random() * 6000);
  }

  /* A continuous crackling-resonance layer, always running but held at
     zero gain until setZoom pushes it up near maximum zoom. Built from
     bright, highpassed noise whose amplitude is modulated by a SECOND,
     heavily-lowpassed noise source (a "random slow wander" used as an
     irregular envelope) rather than a smooth oscillator — that's what
     makes it read as crackle/sizzle rather than a tremolo effect. */
  /* Rebuilt from scratch — the previous version (continuous filtered
     noise under a slow amplitude wobble) just read as a smooth "shhhh"
     no matter how it was tuned, because a CONTINUOUS noise bed can't
     sound granular; only discrete, separately-triggered grains can.
     This is real granular synthesis instead: a self-perpetuating
     stream of very short, independently-filtered noise grains fired
     at irregular random gaps, each one a genuine little pop/burst/tick
     rather than a slice of a continuous hiss. Density, per-grain
     amplitude, and per-grain filter character are all randomized
     independently, which is what produces "uneven amplitude and
     frequency" rather than a uniform texture. The grain loop runs
     continuously once started; crackleGain (the zoom-driven gate, see
     setZoom) is what makes it silent or present, not the loop itself
     stopping. */
  function startCrackle() {
    crackleGain = ctx.createGain();
    crackleGain.gain.value = 0; // driven entirely by setZoom

    function grain() {
      if (disposed || windingDown) return;
      const t0 = nowT();
      const flavor = Math.random();
      const src = noiseSource();
      const filt = ctx.createBiquadFilter();
      let dur;
      if (flavor < 0.45) {
        // Sharp little pop / microscopic static arc: brief, bright,
        // narrow-band.
        filt.type = "bandpass";
        filt.frequency.value = 2200 + Math.random() * 4500;
        filt.Q.value = 3 + Math.random() * 5;
        dur = 0.00067 + Math.random() * 0.00133; // another 50% faster on top of the earlier 3x
      } else if (flavor < 0.8) {
        // Gritty/raspy burst: lower, rougher, a touch longer.
        filt.type = "bandpass";
        filt.frequency.value = 500 + Math.random() * 1400;
        filt.Q.value = 1.2 + Math.random() * 2.5;
        dur = 0.00133 + Math.random() * 0.00313;
      } else {
        // Rare dry crack: wideband, slightly longer, the loudest of
        // the three flavors — an occasional harder discharge among
        // the smaller grains.
        filt.type = "highpass";
        filt.frequency.value = 900 + Math.random() * 1200;
        dur = 0.0022 + Math.random() * 0.00313;
      }
      const g = ctx.createGain();
      // Near-instant attack, short irregular decay — a pop/tick shape,
      // never a swell. Amplitude randomized per grain (0.35-1x) for
      // genuinely uneven loudness grain-to-grain.
      const peak = (0.35 + Math.random() * 0.65) * (flavor >= 0.8 ? 1.4 : 1);
      env(g, t0, 0.0004, 0.0005, dur, peak);
      src.connect(filt).connect(g).connect(crackleGain);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
      // Gap also 50% tighter again (on top of the earlier 3x cut) —
      // denser spacing plus the shorter grains above, per feedback
      // asking for another speed increase.
      crackleTimer = setTimeout(grain, 2.7 + Math.random() * 15.3);
    }
    grainFn = grain;
    grain();

    crackleGain.connect(ambientGain);

    /* A very faint, continuous brown-noise hiss underneath the crackle
       — warmer and duller than the white-noise grains, at roughly 5%
       of the crackle's own level (see setZoom, which drives both from
       the same exponential zoom curve so they rise and fall together).
       This is a bed, not a competing texture: it should be felt as
       warmth under the crackle more than heard as its own layer. */
    const hissSrc = brownNoiseSource();
    const hissFilt = ctx.createBiquadFilter();
    hissFilt.type = "lowpass";
    hissFilt.frequency.value = 900;
    crackleHissGain = ctx.createGain();
    crackleHissGain.gain.value = 0; // driven entirely by setZoom, alongside crackleGain
    hissSrc.connect(hissFilt).connect(crackleHissGain).connect(ambientGain);
    hissSrc.start();
  }

  /* ---- micro-events — each schedules one short, self-contained sound
     and lets it finish on its own; none of them hold a reference past
     their own envelope. ---- */
  function evTick() {
    /* A filtered noise click rather than a tuned oscillator — a square
       wave's strong harmonics are exactly what reads as a videogame
       "boop"; a narrow band of filtered noise reads as a tiny
       mechanical/electrical tick instead, with no clear pitch to latch
       onto. */
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1000 + Math.random() * 900;
    filt.Q.value = 1.2;
    const g = ctx.createGain();
    env(g, t0, 0.001, 0.003, 0.018, 0.016 + Math.random() * 0.012);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + 0.04);
  }

  function evStatic() {
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2500 + Math.random() * 3000;
    const g = ctx.createGain();
    const dur = 0.06 + Math.random() * 0.12;
    env(g, t0, 0.005, dur * 0.4, dur * 0.6, 0.02 + Math.random() * 0.012);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function evPowerFluctuation() {
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 58 + Math.random() * 20;
    const g = ctx.createGain();
    env(g, t0, 0.01, 0.03, 0.12, 0.018);
    osc.connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  function evChirp() {
    /* Per feedback ("upward glissando... sounds like a stupid whoop in
       a Nintendo game... far more other-worldly & sinister"): the old
       version always multiplied frequency UPWARD every step, which is
       exactly the ascending-tone gesture that reads as a cheerful
       videogame power-up no matter how it's jittered/darkened. Rewired
       so each step randomly goes up OR down (a real short-circuit
       misfire doesn't climb predictably), with a net bias toward
       ending LOWER than it started — an unstable signal guttering out,
       not powering up. Lower base range and darker filtering too. */
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const f0 = 130 + Math.random() * 110;
    let tCursor = t0;
    let f = f0;
    osc.frequency.setValueAtTime(f, tCursor);
    const steps = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < steps; i++) {
      tCursor += 0.012 + Math.random() * 0.02;
      const mult = 1.08 + Math.random() * 0.22;
      f *= Math.random() < 0.4 ? mult : 1 / mult; // biased toward net descent, never a clean climb
      osc.frequency.setValueAtTime(f * (0.95 + Math.random() * 0.1), tCursor);
    }
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 340; // darker — was 420
    const g = ctx.createGain();
    env(g, t0, 0.006, 0.02, 0.09, 0.012);

    const hiss = noiseSource();
    const hissFilt = ctx.createBiquadFilter();
    hissFilt.type = "bandpass";
    hissFilt.frequency.value = 900 + Math.random() * 600;
    hissFilt.Q.value = 2;
    const hissEnv = ctx.createGain();
    env(hissEnv, t0, 0.002, 0.01, 0.05, 0.006);

    osc.connect(filt).connect(g);
    hiss.connect(hissFilt).connect(hissEnv);
    const dest = pan(ctx.createGain());
    dest.connect(eventsGain);
    g.connect(dest);
    hissEnv.connect(dest);
    osc.start(t0);
    osc.stop(t0 + 0.18);
    hiss.start(t0);
    hiss.stop(t0 + 0.07);
  }

  function evRelayClick() {
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1400;
    filt.Q.value = 3;
    const g = ctx.createGain();
    env(g, t0, 0.001, 0.006, 0.02, 0.035);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + 0.04);
  }

  function evServoWhirr() {
    /* Per feedback ("upward glissando... sounds like a stupid whoop...
       far more other-worldly & sinister"): "revving up" toward a
       HIGHER target frequency is inherently a triumphant/ascending
       gesture no matter how it's jittered — so the target is now BELOW
       the start instead: a motor grinding down and stalling rather
       than successfully spinning up. */
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const dur = 0.5 + Math.random() * 0.6;
    let tCursor = t0;
    let f = 180 + Math.random() * 50;
    const fEnd = 65 + Math.random() * 35;
    osc.frequency.setValueAtTime(f, tCursor);
    const steps = 5 + Math.floor(Math.random() * 4);
    for (let i = 1; i <= steps; i++) {
      tCursor = t0 + (dur * i) / steps;
      f = f + (fEnd - f) * (0.3 + Math.random() * 0.5);
      osc.frequency.setValueAtTime(f * (0.94 + Math.random() * 0.12), tCursor);
    }
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 300; // darker — was 380
    const g = ctx.createGain();
    env(g, t0, 0.08, dur * 0.5, dur * 0.4, 0.012); // quieter — was 0.016
    osc.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  function evArc() {
    /* Completely rebuilt per feedback: this must sound like an actual
       punctuated 0.5-second blast of the SAME granular static used for
       the zoomed-in crackle (see startCrackle's grain()) — not its own
       separate design — and it must have no tonal "boop" layer at all
       (the previous version's low square-wave "thump" is gone
       entirely). Built by spawning a dense, bounded run of the
       crackle's own three grain flavors (sharp pop / gritty burst /
       rare dry crack — identical filter and duration ranges, same
       density) across a fixed ~500ms window, rather than recursively
       forever the way the ambient crackle does, with a soft fade at
       each end of the window so the blast has an edge instead of
       starting/stopping on a hard cut. The very first grain is forced
       to the loud "dry crack" flavor so there's a clear initiating
       strike, exactly like a real arc catching. */
    const t0 = nowT();
    // One shared stereo position for the whole event, so it reads as
    // one thing happening in one place rather than several unrelated
    // sounds.
    const panSpot = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (panSpot.pan) panSpot.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.6);
    panSpot.connect(eventsGain);

    const totalDur = 0.5;
    let cursor = 0;
    let first = true;
    while (cursor < totalDur) {
      const tG = t0 + cursor;
      const flavor = first ? 0.95 : Math.random(); // force the opening grain to the loud "dry crack" flavor
      first = false;
      const src = noiseSource();
      const filt = ctx.createBiquadFilter();
      let dur;
      // Each round of "pitch it up more" feedback kept multiplying these
      // center frequencies further (2x, then 3x/"200%", now another 2x)
      // until the top of the "sharp pop" range alone reached 40+kHz —
      // well past a real AudioContext's Nyquist ceiling (sampleRate/2,
      // e.g. 22050Hz at the common 44.1kHz rate). BiquadFilterNode.
      // frequency is spec-clamped to that ceiling, so a large chunk of
      // those draws were silently pinned at the same maximum regardless
      // of the ever-higher literal value, which is likely WHY it kept
      // reading as "not high enough" despite repeated increases — most
      // of each "increase" was invisible. Rebuilt to scale off the
      // actual Nyquist limit instead of a fixed literal, so every grain
      // now sits deliberately close to the true ceiling of what's
      // audible at all, with the three flavors still spread across
      // distinct bands for character.
      const nyquist = ctx.sampleRate / 2;
      if (flavor < 0.45) {
        // Sharp little pop / microscopic static arc — as bright as the
        // output can actually reproduce.
        filt.type = "bandpass";
        filt.frequency.value = nyquist * (0.62 + Math.random() * 0.33);
        filt.Q.value = 3 + Math.random() * 5;
        dur = 0.00067 + Math.random() * 0.00133;
      } else if (flavor < 0.8) {
        // Gritty/raspy burst — still well up in the top half of the
        // audible range, just a clear octave or so below the sharp pops.
        filt.type = "bandpass";
        filt.frequency.value = nyquist * (0.28 + Math.random() * 0.32);
        filt.Q.value = 1.2 + Math.random() * 2.5;
        dur = 0.00133 + Math.random() * 0.00313;
      } else {
        // Rare dry crack — a high shelf that passes nearly everything up
        // to the ceiling, the loudest and airiest flavor.
        filt.type = "highpass";
        filt.frequency.value = nyquist * (0.5 + Math.random() * 0.35);
        dur = 0.0022 + Math.random() * 0.00313;
      }
      // Soft fade in/out across the whole 0.5s window, applied as a
      // per-grain amplitude multiplier, so the blast has a shape
      // rather than a hard-edged start/stop.
      const posFrac = cursor / totalDur;
      const windowEnv = posFrac < 0.06 ? posFrac / 0.06 : posFrac > 0.82 ? Math.max(0, (1 - posFrac) / 0.18) : 1;
      const g = ctx.createGain();
      // Foreground-appropriate peak (this plays through eventsGain as
      // its own event, not the quiet ambient crackleGain bed), scaled
      // by the same per-flavor loudness bias the crackle itself uses.
      const peak = (0.045 + Math.random() * 0.05) * (flavor >= 0.8 ? 1.35 : 1) * windowEnv;
      env(g, tG, 0.0004, 0.0005, dur, peak);
      src.connect(filt).connect(g).connect(panSpot);
      src.start(tG);
      src.stop(tG + dur + 0.02);
      cursor += (2.7 + Math.random() * 15.3) / 1000; // identical grain spacing to the ambient crackle
    }
  }

  function evWhine() {
    /* Was a rising high-pitched sine sweep — a textbook "whistle,"
       which read as corny rather than ominous. Replaced with a low,
       descending resonant groan (noise through a narrow, downward-
       sweeping bandpass) — same rarity and role as a strange, brief
       instability, but dark and structural rather than a bright tone. */
    const t0 = nowT();
    const src = noiseSource();
    const dur = 0.7 + Math.random() * 0.6;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 9;
    filt.frequency.setValueAtTime(340 + Math.random() * 140, t0);
    filt.frequency.exponentialRampToValueAtTime(120 + Math.random() * 40, t0 + dur);
    const g = ctx.createGain();
    env(g, t0, dur * 0.25, dur * 0.25, dur * 0.5, 0.032);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  function evClunk() {
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.12);
    const g = ctx.createGain();
    env(g, t0, 0.001, 0.01, 0.15, 0.05);
    osc.connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  /* ---- added for variety: five more distinct event types, leaning
     further into the "distant machinery in a dark building" / Vangelis
     end of the palette rather than adding more clicks. ---- */

  function evMetallicRing() {
    // A struck-metal resonance — noise excites a very high-Q bandpass
    // and the ring is left to decay on its own.
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 260 + Math.random() * 500;
    filt.Q.value = 18 + Math.random() * 10;
    const g = ctx.createGain();
    const dur = 0.5 + Math.random() * 0.5;
    env(g, t0, 0.001, 0.01, dur, 0.03);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  function evDataBurst() {
    // A short flurry of tiny high clicks at irregular micro-timing —
    // reads as brief data/modem-like chatter rather than any single
    // clean tone.
    const t0 = nowT();
    const dest = pan(ctx.createGain());
    dest.connect(eventsGain);
    const count = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const tC = t0 + Math.random() * 0.22;
      const src = noiseSource();
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1800 + Math.random() * 2400;
      filt.Q.value = 4;
      const g = ctx.createGain();
      env(g, tC, 0.0003, 0.001, 0.006, 0.012 + Math.random() * 0.01);
      src.connect(filt).connect(g).connect(dest);
      src.start(tC);
      src.stop(tC + 0.02);
    }
  }

  function evPressureHiss() {
    // A soft swell and fade of highpassed noise — a distant valve or
    // pneumatic release, slower and gentler than the static event.
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 1200 + Math.random() * 800;
    const g = ctx.createGain();
    const dur = 0.7 + Math.random() * 0.6;
    env(g, t0, dur * 0.35, dur * 0.15, dur * 0.5, 0.022);
    src.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  function evSubPulse() {
    // A very low, short pulse — felt as much as heard, like something
    // large shifting load somewhere in the structure.
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 32 + Math.random() * 14;
    const g = ctx.createGain();
    env(g, t0, 0.02, 0.05, 0.3, 0.05);
    osc.connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + 0.45);
  }

  function evCapacitorCharge() {
    /* Per feedback ("upward glissando... sounds like a stupid whoop...
       far more other-worldly & sinister"): the pitch used to climb
       cleanly from 120 up to 340-500Hz — however much the gain
       envelope faltered, that rising sweep alone still reads as a
       classic videogame "power-up" gesture. Now the PITCH fails along
       with the level: it climbs only partway (to a modest, much lower
       ceiling), then drops sharply at the falter point and ends BELOW
       where it started — a charge attempt that collapses, not one
       that completes. */
    const t0 = nowT();
    const dur = 0.18 + Math.random() * 0.14;
    const falterAt = t0 + dur * (0.4 + Math.random() * 0.2);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(170 + Math.random() * 40, falterAt);
    osc.frequency.exponentialRampToValueAtTime(55 + Math.random() * 20, t0 + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 620; // darker — was 900
    const g = ctx.createGain();
    const peak = 0.02; // quieter — was 0.03
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak * 0.7, falterAt);
    g.gain.linearRampToValueAtTime(peak * 0.25, falterAt + 0.012); // the falter
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.9);
    // Per feedback ("all ambient sounds must fade to zero, not
    // experience cutoff") — was an instant setValueAtTime(0, ...) jump
    // right after the peak; now a real short decay instead.
    const release = 0.09;
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    g.gain.linearRampToValueAtTime(0, t0 + dur + release + 0.02);
    osc.connect(filt).connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.05);
  }

  function evSubWarble() {
    // A deep, wavering tone — a subwoofer-register whirr with a
    // wobbling pitch (vibrato) rather than a flat sustained note, like
    // something large slowly cycling under load.
    const t0 = nowT();
    const dur = 1.2 + Math.random() * 1.6;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 34 + Math.random() * 18;
    const vibrato = ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 3.5 + Math.random() * 3;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 4 + Math.random() * 5;
    vibrato.connect(vibratoDepth).connect(osc.frequency);
    vibrato.start(t0);
    vibrato.stop(t0 + dur + 0.1);
    const g = ctx.createGain();
    env(g, t0, dur * 0.25, dur * 0.45, dur * 0.3, 0.05);
    osc.connect(g);
    pan(g).connect(eventsGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  function evSwoosh() {
    /* Per feedback: a slow, deep (pitch-shifted down), multi-tonal wash
       that decrescendos — reads as something large sweeping past in
       the distance, not a discrete hit or a swelling drone. Several
       detuned low oscillators stacked at inharmonic-ish ratios give the
       "multi-tonal wash" (a cluster, not a clean chord); a near-instant
       attack followed by a long decay makes it loudest right at onset
       and fade away from there — a true decrescendo, the opposite
       shape from evSubWarble's swell-hold-fade. A slow stereo pan sweep
       from one side toward the other adds the sense of motion a
       "swoosh" implies, and the lowpass darkening further as it decays
       reinforces the fade rather than just the amplitude dropping. */
    const t0 = nowT();
    const dur = 3.2 + Math.random() * 2.4;
    const baseFreq = 46 + Math.random() * 26;
    const partials = [1, 1.5, 2.24, 2.98];

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1400, t0);
    filt.frequency.exponentialRampToValueAtTime(220, t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (panner.pan) {
      const panStart = Math.random() < 0.5 ? -1 : 1;
      panner.pan.setValueAtTime(panStart * (0.5 + Math.random() * 0.4), t0);
      panner.pan.linearRampToValueAtTime(-panStart * (0.5 + Math.random() * 0.4), t0 + dur);
    }

    partials.forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = baseFreq * mult;
      osc.detune.value = (Math.random() - 0.5) * 12;
      osc.connect(filt);
      osc.start(t0);
      osc.stop(t0 + dur + 0.2);
    });

    filt.connect(g).connect(panner).connect(eventsGain);
  }

  function evStutterPop() {
    /* Per feedback ("need more subtle electronics noises popping off
       randomly") — a rapid, irregular cluster of 2-4 ultra-brief
       filtered pops, each at its own random spectral position, packed
       into a tiny window. Quieter and shorter per-pop than evDataBurst
       (which reads as a distinct "flurry"), so this reads as a
       background circuit stuttering rather than a foreground event. */
    const t0 = nowT();
    const dest = pan(ctx.createGain());
    dest.connect(eventsGain);
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const tC = t0 + Math.random() * 0.09;
      const src = noiseSource();
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 500 + Math.random() * 4000;
      filt.Q.value = 3 + Math.random() * 4;
      const g = ctx.createGain();
      env(g, tC, 0.0003, 0.0005, 0.006, 0.009 + Math.random() * 0.007);
      src.connect(filt).connect(g).connect(dest);
      src.start(tC);
      src.stop(tC + 0.02);
    }
  }

  /* Weighted so the "very subtle/frequent" tier dominates heavily —
     roughly the brief's 90% environment / 10% strange-events split —
     and even that 10% leans toward its own quieter end (arc/whine/
     clunk are each rarer than chirp/relay/servo). */
  /* Rebalanced further toward the quiet, textural "very subtle /
     frequent" tier (tick/static/fluctuation, all noise- or sub-bass-
     based, no clear pitch) and away from the more tonal "less
     frequent" tier (chirp/relay/servo) — per feedback that the events
     read as too many clear "boops," this leans the odds so a genuine
     chirp or click is the rarer surprise, not the norm. */
  /* Rebalanced further, per feedback that events still read as "video
     game" sound effects rather than subtle background electrical
     misfires: the fully textural/noise-based tier (tick/static/
     fluctuation/subpulse/pressureHiss) weighted up further, the more
     tonal tier (chirp/servoWhirr/capacitorCharge — all retextured with
     jitter/stutter above, but still the most "eventful"-sounding of
     the set) weighted down further. */
  const EVENT_TABLE = [
    { fn: evTick, weight: 30 },
    { fn: evStatic, weight: 26 },
    { fn: evPowerFluctuation, weight: 20 },
    { fn: evSubPulse, weight: 12 },
    { fn: evPressureHiss, weight: 7 },
    { fn: evDataBurst, weight: 5 },
    { fn: evRelayClick, weight: 4 },
    { fn: evMetallicRing, weight: 4 },
    { fn: evSubWarble, weight: 4 },
    { fn: evCapacitorCharge, weight: 2 },
    { fn: evChirp, weight: 1 },
    { fn: evServoWhirr, weight: 1 },
    { fn: evArc, weight: 2 },
    { fn: evWhine, weight: 1 },
    { fn: evClunk, weight: 1 },
    { fn: evSwoosh, weight: 2 },
    { fn: evStutterPop, weight: 18 }, // per feedback — "more subtle electronics noises popping off randomly"
  ];
  const TOTAL_WEIGHT = EVENT_TABLE.reduce((s, e) => s + e.weight, 0);

  function pickEvent() {
    // Reject a repeat of either of the last two picks rather than
    // enforcing a rigid rotation — keeps it random without letting the
    // same tick/static pair land back-to-back too often.
    for (let attempt = 0; attempt < 6; attempt++) {
      let r = Math.random() * TOTAL_WEIGHT;
      let chosen = EVENT_TABLE[EVENT_TABLE.length - 1];
      for (const e of EVENT_TABLE) {
        if (r < e.weight) { chosen = e; break; }
        r -= e.weight;
      }
      if (!recentEvents.includes(chosen.fn)) return chosen;
    }
    return EVENT_TABLE[0];
  }

  function scheduleNext() {
    if (disposed || windingDown) return;
    // 4-14s baseline gap between events, occasionally stretched much
    // longer — the quiet stretches are as much a part of this as the
    // events themselves.
    let delay = 4000 + Math.random() * 10000;
    if (Math.random() < 0.15) delay += 15000 + Math.random() * 30000;
    scheduleTimer = setTimeout(() => {
      if (!disposed && ctx && ctx.state === "running") {
        const chosen = pickEvent();
        try { chosen.fn(); } catch (e) { /* a synthesis hiccup should never break the loop */ }
        recentEvents.push(chosen.fn);
        if (recentEvents.length > 2) recentEvents.shift();
      }
      scheduleNext();
    }, delay);
  }

  /* iOS Safari specifically needs more than ctx.resume() to reliably
     unlock real hardware audio output on the first gesture — a
     context can report state "running" while the device still plays
     nothing at all. Synchronously starting one genuinely silent
     buffer, right here inside the same user gesture, is the standard
     workaround most web audio libraries use for this; harmless (and
     a no-op in practice) on every other browser, where resume() alone
     already works. Wrapped in try/catch since a handful of very old
     WebKit builds throw on a 1-sample buffer rather than just
     ignoring it. */
  function unlockIosAudio() {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {}
  }

  /* Builds the audio graph (context + gain stages + shared buffers)
     without touching the ambient bed — idempotent and safe to call
     from anywhere that needs a one-off SFX to work (e.g. the
     Singularity reveal) even during setup, before ensureStarted()'s
     own gate (`!awaitingBegin`) would normally have built it. Kept
     entirely separate from the `started` flag below so calling this
     first never skips the ambient bed's own startup once the real
     ensureStarted() runs. */
  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      // Defensive: some browsers create a context suspended even inside
      // a user gesture. Harmless to call when already running.
      unlockIosAudio();
      if (ctx.state === "suspended") ctx.resume();
      master = ctx.createGain();
      // +14dB overall total (10^(14/20) ≈ 5.01) — a single multiplier on
      // the final stage, so every sound is raised by the same factor and
      // nothing shifts relative to anything else.
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(ctx.destination);

      /* theme: sits between the ambient bed (hum/crackle, and the
         random micro-events) and master, at 1 (no effect) by default.
         beginGameFadeIn() drops it to 0 and ramps it back up over 2s,
         so on first start the atmosphere swells in to whatever level
         setZoom already says is correct for the current camera
         distance, rather than starting there instantly. Deliberately
         NOT in the sfxGain path — gameplay cues (the power-on chime
         included) stay at their normal, immediate volume. */
      introGain = ctx.createGain();
      introGain.gain.value = 1;
      introGain.connect(master);

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.03; // scaled live by setZoom below
      ambientGain.connect(introGain);

      eventsGain = ctx.createGain();
      /* Lowered again per feedback: still reading as too "video-game"
         foreground sound effects rather than half-heard electrical
         misfires happening somewhere in the background — cut further
         on top of the per-event peak trims below. */
      eventsGain.gain.value = 0.525; // +25% per feedback ("maximize... every audio channel") — was 0.42
      /* Soft-clip distortion followed by a muffling lowpass — together
         these are what actually blur a clean oscillator/noise burst
         into something less legible as "a sound effect just played."
         Distortion first (adds a little grit/asymmetry), then the
         lowpass rounds off the harmonics that distortion just added,
         rather than leaving them bright and buzzy. Muffle lowered
         further (was 1500) so events sit further from the listener. */
      const eventsShaper = ctx.createWaveShaper();
      eventsShaper.curve = makeSoftClipCurve(2.3); // grittier, per "darker/grimdark" feedback
      eventsShaper.oversample = "2x";
      const eventsMuffle = ctx.createBiquadFilter();
      eventsMuffle.type = "lowpass";
      eventsMuffle.frequency.value = 1050; // duller/further-away than before (was 1500)
      eventsMuffle.Q.value = 0.4;
      eventsGain.connect(eventsShaper).connect(eventsMuffle).connect(introGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1.25; // +25% per feedback ("maximize the overall gain across every audio channel")
      sfxGain.connect(master);

      /* A short, dark synthetic impulse response for the piece-landing
         thud's "short reverb" — a burst of decaying noise, not a real
         recorded space, but enough to give a percussive hit a sense of
         a small, hard, enclosed room rather than landing completely
         dry. thudShaper adds the "crunchy/analog" grit that plain
         gain/filtering alone can't. */
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = makeImpulse(0.32, 2.8);
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.3;
      reverbNode.connect(reverbSend).connect(sfxGain);
      thudShaper = ctx.createWaveShaper();
      thudShaper.curve = makeSoftClipCurve(7.5); // "considerably more crunch" per feedback (was 5.2)
      thudShaper.oversample = "4x";

      noiseBuffer = makeNoiseBuffer();
      brownNoiseBuffer = makeBrownNoiseBuffer();
    } catch (e) {
      ctx = null; // Web Audio unavailable — game stays fully playable, just silent
    }
  }

  /* Mobile browsers (iOS Safari especially) can suspend an already-
     running AudioContext when the tab is backgrounded or the screen
     locks, and never resume it on their own — silently swallowing
     every cue queued afterward until something happens to call
     ensureStarted() again. Re-resume proactively the moment the page
     becomes visible again, so audio parity holds after a lock-screen
     round-trip on mobile the way it already does on desktop (which
     rarely suspends mid-session at all). */
  function onVisibilityChange() {
    if (ctx && document.visibilityState === "visible" && ctx.state === "suspended") {
      unlockIosAudio();
      ctx.resume();
    }
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function ensureStarted() {
    ensureGraph();
    if (!ctx) return;
    if (started) {
      if (ctx.state === "suspended") {
        unlockIosAudio();
        ctx.resume();
      }
      return;
    }
    started = true;
    startHum();
    startCrackle();
    scheduleNext();
  }

  /* Called once, from the Begin Game button and nowhere else: starts
     the engine (if this is the very first call, otherwise a cheap
     resume) and fades the ambient bed in from silence to whatever
     level setZoom already says is correct for the current camera
     distance, over 2 seconds. Gameplay cues (the power-on chime this
     is paired with, selection/landing/etc.) are NOT part of this fade
     — they route straight to master and play at their normal volume
     immediately, since they're deliberate UI feedback, not ambience. */
  function beginGameFadeIn() {
    ensureStarted();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // Snap master back up instantly (unramped) — this is the ONLY
    // place that undoes a previous beginFadeOut, so a fresh game
    // (whether the very first one or a NEW GAME after a win/manual
    // end) stays truly silent right up until this button is clicked,
    // never leaking back in early the way resetWindDown used to.
    if (master) {
      master.gain.cancelScheduledValues(t0);
      master.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, t0);
    }
    if (!introGain) return;
    introGain.gain.cancelScheduledValues(t0);
    introGain.gain.setValueAtTime(0, t0);
    introGain.gain.linearRampToValueAtTime(1, t0 + 2);
  }

  function setZoom(t) {
    // t: 0 (zoomed out) .. 1 (zoomed in close on the pieces). Ramped
    // via setTargetAtTime rather than stepped, so it reads as "the
    // machine sounds nearer" rather than as an operated volume knob.
    if (!ambientGain) return;
    // True exponential (geometric) interpolation, not linear or even a
    // power curve: level = baseline * (peak/baseline)^t. At t=0 (fully
    // zoomed out) that's baseline itself — near-silent. At the game's
    // actual default camera distance (roughly t=0.68) it lands around
    // a third of peak — present but modest. Approaching t=1 (maximum
    // zoom) it climbs the rest of the way to peak, with the growth
    // itself accelerating the whole way there rather than tapering
    // off, which is what makes it read as exponential rather than
    // just "gets louder."
    // Raised slightly (was 0.018-0.62) after the ambience read as
    // inaudible in practice — the shape (near-silent out, exponential
    // climb approaching max zoom) is unchanged, just with more overall
    // headroom.
    const clamped = Math.max(0, Math.min(1, t));
    /* Warped by an extra power curve (t^1.6) BEFORE the exponential
       mapping — this compounds with the exponential itself, holding
       the level down for more of the zoom range and making the final
       approach to max zoom noticeably steeper ("more exponential")
       rather than just uniformly climbing throughout. Peak also raised
       (0.7 -> 0.98) so full zoom is genuinely much louder, not just
       proportionally louder. */
    const warped = Math.pow(clamped, 1.6);
    const baseline = 0.038; // +20% per feedback ("maximize... every audio channel") — was 0.032
    const peak = 1.15; // +17% — was 0.98
    ambientGain.gain.setTargetAtTime(baseline * Math.pow(peak / baseline, warped), nowT(), 0.5);

    /* A crackling resonance that stays completely silent until zoom
       gets close to maximum, then ramps in sharply — see startCrackle
       for how the crackle texture itself is built. Squaring an
       already-clamped-to-0 ramp gives it a fast, late arrival rather
       than a gradual fade-in. */
    if (crackleGain) {
      // Same exponential shape as always (crackleT, squared); only the
      // peak scalars change here. Crackle cut a further 35%
      // (0.0324 -> 0.02106). The brown-noise hiss added alongside it
      // rides the identical shape at 5% of the crackle's own peak, so
      // the two rise and fall together rather than needing their own
      // separate curve.
      const crackleT = Math.max(0, (clamped - 0.7) / 0.3);
      const shape = Math.pow(crackleT, 2);
      const cracklePeak = 0.0324 * 0.65 * 0.7 * 1.2; // +20% per feedback ("maximize... every audio channel"); shape/hiss ratio untouched
      crackleGain.gain.setTargetAtTime(shape * cracklePeak, nowT(), 0.4);
      if (crackleHissGain) {
        crackleHissGain.gain.setTargetAtTime(shape * cracklePeak * 0.05, nowT(), 0.4);
      }
    }
  }

  /* Speeds up the hum's own "breathing" resonance LFOs as tension
     rises (0 = the slow baseline, 1 = a Cabeza is genuinely about to
     be crushed or about to win). Safe to call before the hum exists —
     the value is remembered and picked up once startHum runs. Ramped
     via setTargetAtTime rather than jumped, so a change in board state
     is felt as the hum gradually quickening rather than an audible
     jump cut. */
  function applyTension(value) {
    tension = Math.max(0, Math.min(1, value || 0));
    if (!ctx || !humLfo1 || !humLfo2) return;
    const FAST_MUL = 1.6; // at tension 1, only 60% faster than baseline, per feedback
    const f1 = humLfo1BaseFreq * (1 + tension * (FAST_MUL - 1));
    const f2 = humLfo2BaseFreq * (1 + tension * (FAST_MUL - 1));
    humLfo1.frequency.setTargetAtTime(f1, nowT(), 1.2);
    humLfo2.frequency.setTargetAtTime(f2, nowT(), 1.2);
  }

  function setMuted(m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.08);
  }

  /* Called once, right when a win fires OR the player manually ends the
     active game: stops every ambient scheduler from arming another
     event (scheduleNext/wander/grain all check `windingDown`, so
     whatever's already in flight is the last of it) and linearly
     fades the entire mix to silence over `seconds` (3 for a win, 2 for
     a manual end — see the two call sites) — a cue like the win tone,
     already playing through sfxGain, fades out along with everything
     else since it too passes through master. */
  function beginFadeOut(seconds) {
    if (windingDown) return; // idempotent — a second call (shouldn't happen) won't restart the fade
    windingDown = true;
    if (!master || !ctx) return;
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0);
    master.gain.setValueAtTime(master.gain.value, t0);
    master.gain.linearRampToValueAtTime(0, t0 + (seconds || 3));
  }

  /* Called from a fresh game (see the component's handleReset) to undo
     beginFadeOut: brings the master gain back up and re-arms the
     three ambient chains that stopped scheduling themselves during the
     wind-down (they returned early rather than calling setTimeout
     again, so simply flipping `windingDown` back off would not, on
     its own, revive a chain that's already dead). Safe to call even
     when nothing is winding down — it's a no-op then. */
  function resetWindDown(restoreVolume) {
    if (!windingDown) return;
    windingDown = false;
    // Two different callers need two different outcomes here. A fresh
    // game started via the end-game popup's NEW GAME button must stay
    // silent exactly like a fresh page load, right up until Begin Game
    // is clicked again — so by default this does NOT restore master's
    // level, just pins it at its current (silent, or silent-bound)
    // value so any in-flight fade-out ramp doesn't keep coasting toward
    // 0 forever. But undoing a game-ending move (see handleUndoLastTurn)
    // drops the player straight back into active play with no "Begin
    // Game" gate to bring the volume back up through — per feedback
    // ("I'm still playing... I want the sound to be back"), that caller
    // passes restoreVolume: true to bring master back up here directly,
    // via a brief ramp rather than an instant jump.
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      if (restoreVolume) {
        master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime + 0.6);
      }
    }
    if (!disposed) {
      scheduleNext();
      if (wanderFn) buzzWanderTimer = setTimeout(wanderFn, 4000 + Math.random() * 6000);
      if (grainFn) crackleTimer = setTimeout(grainFn, 2.7 + Math.random() * 15.3);
    }
  }

  /* ---- gameplay cues — simple by design, routed through sfxGain so
     they stay audible above the ambience per the brief. ---- */
  function cue(freqStart, freqEnd, dur, type, peak) {
    if (!ctx) return;
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.005, dur * 0.3, dur * 0.7, peak);
    osc.connect(g).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /* A genuine time-reversal of cue(freqStart, freqEnd, dur, type, peak)
     — per feedback ("END ACTIVE GAME should play the reverse audio of
     BEGIN GAME"), not just a different sound with a similar vibe. Both
     halves of cue() get flipped: the frequency sweep runs backwards
     (freqEnd -> freqStart instead of freqStart -> freqEnd), and the
     attack/hold/release envelope is mirrored end-to-end, so what was a
     quick attack + long release becomes a long swell-up + quick cutoff
     — exactly what playing the same clip backwards would sound like. */
  function reverseCue(freqStart, freqEnd, dur, type, peak) {
    if (!ctx) return;
    const t0 = nowT();
    const osc = ctx.createOscillator();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freqEnd, t0);
    if (freqStart) osc.frequency.exponentialRampToValueAtTime(freqStart, t0 + dur);
    const g = ctx.createGain();
    const attack = dur * 0.7; // cue()'s release, reversed into this cue's attack
    const hold = dur * 0.3; // same hold duration, same relative position
    /* Per feedback ("cuts off abruptly... should play out completely
       fading to 0; no hard cut-off"): a literal mirror of cue()'s own
       0.005s attack made for a near-instant snap-to-silence here,
       which reads as a hard cutoff rather than a fade. This is now a
       real, generous release instead of a literal reversal — the
       point ("this is what Begin Game sounds like backwards") still
       reads fine, since the swell-up attack is what actually carries
       that impression; the tail just needs to audibly fade now. */
    const release = Math.max(0.4, dur * 0.5);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    g.gain.linearRampToValueAtTime(0, t0 + attack + hold + release + 0.05);
    osc.connect(g).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + attack + hold + release + 0.1);
  }

  /* The CONNECT/DISCONNECT chimes' companion layer — a second, warbly
     "warped sine" voice (an LFO wobbling its own pitch) that plays
     alongside cue()/reverseCue()'s own sharper beep, restoring the
     two-layer "jibbering beeps + underlying warp" texture per
     feedback. Its own gain builds through the whole duration to a
     peak right at the very end (climaxing exactly as the cue itself
     finishes, not partway through) rather than cue()'s quick-attack/
     long-decay shape, so the pair reads as one event escalating
     together. `delay` (a random small fraction of dur, different each
     call — see playPowerOn/Off) offsets this voice's start relative to
     the main beep so the two never intertwine the same way twice. */
  function connectionCompanion(freqStart, freqEnd, dur, peak, delay) {
    if (!ctx) return;
    const t0 = nowT() + Math.max(0, delay);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 4 + Math.random() * 5; // warble rate, randomized per play
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freqStart * 0.18; // warble depth scales with the voice's own pitch
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.88); // builds all the way to the climax
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.06); // then a quick cutoff at the peak, not a lingering tail
    osc.connect(g).connect(sfxGain);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.12);
    lfo.stop(t0 + dur + 0.12);
  }

  /* CABEZA CRUSHED — per feedback, replaces the old flat downward
     cue() sweep with three layered "falling away" characteristics at
     once: a pitch sink (an ACCELERATING glide, slow-then-plunging,
     rather than one steady exponential ramp — reads as losing its
     footing, not a clean descending note), a plunging formant (a
     resonant bandpass whose own center frequency sinks in lockstep,
     giving the sawtooth a vocal, "ohh" -> collapsing quality instead of
     a bare buzz), and a downward Doppler decay (a slower lowpass that
     keeps darkening past where the formant settles, plus the amplitude
     itself fading out alongside the pitch rather than holding a flat
     sustain — a receding/sinking source loses loudness and high end
     together, not just pitch). Peak level (0.036) is unchanged from
     the last round's volume tuning — this is a character change, not
     another loudness pass. */
  function playCabezaCrush() {
    if (!ctx) return;
    const t0 = nowT();
    const dur = 0.45;
    const peak = 0.036;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(150, t0 + dur * 0.35); // slow start...
    osc.frequency.exponentialRampToValueAtTime(46, t0 + dur); // ...then plunges

    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = 6;
    formant.frequency.setValueAtTime(900, t0);
    formant.frequency.exponentialRampToValueAtTime(110, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3000, t0);
    lp.frequency.exponentialRampToValueAtTime(220, t0 + dur + 0.1);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.11, t0 + dur);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.12);

    osc.connect(formant).connect(lp).connect(g).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.15);
  }

  /* The info-panel "chirp" replacement: a massive, uncanny choir stab.
     Built entirely from oscillators/filters — no samples. An ensemble
     of many detuned voices per chord tone approximates choir thickness;
     two parallel narrow bandpass "formants" per voice give each a
     vowel-like ("ah") color instead of a bare tone; a dedicated,
     several-second synthetic reverb (built once, lazily, and reused —
     this one is far too long to regenerate on every call) stands in
     for an impossibly large space.

     The harmonic arc is entirely detune automation on a subset of
     voices flagged "wrong": they start aligned, drift to a subtle,
     almost-correct-but-not offset through the sustain (this is the
     90%+ "uncanny" portion), then converge back to true pitch in the
     last couple of seconds — right as the overall envelope is already
     well into its long decay — so the "beautiful resolution" arrives
     inside the fading tail, not as a separate loud event, and can
     plausibly go half-noticed. */
  function playChoirStab() {
    /* Reworked again per feedback: half the length again, still more
       reverb (a longer, gentler-decaying impulse plus a wetter mix),
       overall level cut by 55%, and the resolution pushed harder
       toward genuine assonance — now ALL voices (not just the two
       flagged "wrong") tighten from their chorus-width detune into a
       near-unison right at the turn, and the vibrato is calmed at the
       same moment, so the climax reads as the whole choir suddenly
       locking into a single pure, still chord rather than just the
       wrong notes quietly giving up. */
    if (!ctx) return;
    /* theme: the info-overlay chime is UI chrome, not game ambience —
       it should stay audible even right after a win/reset has pinned
       master toward silence (see beginFadeOut/resetWindDown above).
       Nudges master back up WITHOUT touching `windingDown` or
       re-arming the ambient schedulers, so the post-game hush is
       otherwise untouched; the next real resetWindDown()/
       beginGameFadeIn() call still runs exactly as before. */
    if (windingDown && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime + 0.15);
    }
    const t0 = nowT();
    const totalDur = 1.27; // was 1.82 — a further 30% cut per feedback

    if (!cathedralReverb) {
      cathedralReverb = ctx.createConvolver();
      // Longer and even more gently-decaying (was 7.5s/1.9) — with the
      // dry stab now much shorter, the tail needs to carry the sense
      // of scale on its own.
      cathedralReverb.buffer = makeImpulse(11.5, 1.25); // even longer/gentler — "add more reverb" again
      cathedralReverb.connect(sfxGain);
    }

    // Overall shape, rescaled to the new half-length duration: the
    // same proportions (substantial fade-in, brief hold through the
    // uncanny section, decay into the wetter tail), just compressed.
    const masterEnv = ctx.createGain();
    masterEnv.gain.setValueAtTime(0, t0);
    masterEnv.gain.linearRampToValueAtTime(1, t0 + 0.29);
    masterEnv.gain.setValueAtTime(1, t0 + 0.5);
    masterEnv.gain.linearRampToValueAtTime(0.45, t0 + 0.82);
    masterEnv.gain.linearRampToValueAtTime(0.0001, t0 + totalDur);

    // Handle for fadeOutChoir(): every voice's own gain is a fixed
    // constant (see voiceGain below) — masterEnv above is the ONLY
    // node shaping the stab's loudness over time.
    choirMasterEnv = masterEnv;
    choirEndTime = t0 + totalDur + 0.3;

    // A gentle safety limiter — this sums 24 voices, and a mild soft
    // clip here catches genuine peaks without adding audible crunch to
    // what's meant to be beautiful/ethereal (contrast the much harsher
    // curve used for the landing thud's deliberate crunch).
    const safety = ctx.createWaveShaper();
    safety.curve = makeSoftClipCurve(1.15);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.08; // trimmed further again — "add more reverb"
    const wetGain = ctx.createGain();
    wetGain.gain.value = 1.0; // "add more reverb" again — was 0.98
    masterEnv.connect(safety);
    safety.connect(dryGain).connect(sfxGain);
    safety.connect(wetGain).connect(cathedralReverb);

    // An open, ambiguous chord (add9/maj7-ish) spanning bass to
    // soprano register, for the "vast register spread" of a real
    // choir. Two tones are flagged "wrong" — each given its own subtle
    // target offset, sharp or flat, small enough to read as "almost
    // correct" rather than a clashing wrong note.
    const chordTones = [
      { freq: 130.81, wrong: false },              // C3 — bass
      { freq: 164.81, wrong: true, off: 42 },       // E3 — subtly sharp
      { freq: 196.0, wrong: false },                // G3
      { freq: 246.94, wrong: true, off: -33 },      // B3 — subtly flat
      { freq: 293.66, wrong: false },               // D4 (9th)
      { freq: 523.25, wrong: false },               // C5 — soprano register begins
      { freq: 659.25, wrong: true, off: 27 },       // E5 — subtly sharp
      { freq: 783.99, wrong: false },               // G5
    ];

    const unisonCount = 3;
    const levelMul = 0.15; // was 0.19 — a further 20% cut per feedback
    // The resolution moment, rescaled to the new, further-shortened duration.
    const resolveAt = t0 + 1.05;

    chordTones.forEach((tone) => {
      for (let u = 0; u < unisonCount; u++) {
        const osc = ctx.createOscillator();
        osc.type = u % 2 === 0 ? "sawtooth" : "triangle";
        osc.frequency.value = tone.freq;

        // Stable ensemble detune (chorus width) — present on every
        // voice, unrelated to the "wrongness" arc, but now also
        // tightened toward unison right at the resolution so the
        // WHOLE choir — not just the flagged-wrong tones — locks into
        // a single pure chord at the climax, for a stronger, more
        // deliberate swing into assonance.
        const ensembleDetune = (Math.random() * 2 - 1) * 9;
        osc.detune.setValueAtTime(ensembleDetune, t0);

        if (tone.wrong) {
          // Drift into wrongness through the attack, wander during the
          // (now much shorter) sustain, overshoot furthest right
          // before the turn, then swing back to pure tuning — the
          // overshoot just before resolving is what makes the turn
          // into consonance read as a transformation rather than the
          // wrongness simply fading out. Timings rescaled to the new
          // half-length duration.
          osc.detune.linearRampToValueAtTime(ensembleDetune + tone.off, t0 + 0.2);
          osc.detune.linearRampToValueAtTime(ensembleDetune + tone.off * 0.8, t0 + 0.41);
          osc.detune.linearRampToValueAtTime(ensembleDetune + tone.off * 1.35, t0 + 0.66);
          osc.detune.linearRampToValueAtTime(ensembleDetune * 0.5, t0 + 0.93);
          osc.detune.linearRampToValueAtTime(0, resolveAt); // the fleeting resolution
        } else {
          // Not flagged "wrong," but still carries the static ensemble
          // chorus width the whole way — tighten it to true unison at
          // the same resolution moment as the wrong voices, so the
          // pure tones audibly firm up into focus too, not just hold
          // steady while only the wrong ones resolve around them.
          osc.detune.setValueAtTime(ensembleDetune, t0 + 0.66);
          osc.detune.linearRampToValueAtTime(ensembleDetune * 0.35, t0 + 0.93);
          osc.detune.linearRampToValueAtTime(0, resolveAt);
        }

        // Slow vibrato on every voice for organic, breathing movement
        // — calmed sharply at the resolution moment so the climax
        // reads as the choir going still/pure rather than continuing
        // to waver even once it's "in tune."
        const vibrato = ctx.createOscillator();
        vibrato.type = "sine";
        vibrato.frequency.value = 4.2 + Math.random() * 1.6;
        const vibratoDepth = ctx.createGain();
        const baseVibratoDepth = 3 + Math.random() * 3;
        vibratoDepth.gain.setValueAtTime(baseVibratoDepth, t0);
        vibratoDepth.gain.setValueAtTime(baseVibratoDepth, t0 + 0.93);
        vibratoDepth.gain.linearRampToValueAtTime(baseVibratoDepth * 0.15, resolveAt);
        vibrato.connect(vibratoDepth).connect(osc.detune);
        vibrato.start(t0);
        vibrato.stop(t0 + totalDur);

        // Two parallel narrow bandpass resonances from the same
        // oscillator — a rough vowel ("ah") formant pair instead of a
        // bare tone.
        const formant1 = ctx.createBiquadFilter();
        formant1.type = "bandpass";
        formant1.frequency.value = 700 + (Math.random() * 60 - 30);
        formant1.Q.value = 5;
        const formant2 = ctx.createBiquadFilter();
        formant2.type = "bandpass";
        formant2.frequency.value = 1150 + (Math.random() * 80 - 40);
        formant2.Q.value = 6;

        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 0.07 * levelMul;

        osc.connect(formant1).connect(voiceGain);
        osc.connect(formant2).connect(voiceGain);

        if (ctx.createStereoPanner) {
          const voicePan = ctx.createStereoPanner();
          voicePan.pan.value = (Math.random() * 2 - 1) * 0.95; // extremely wide image
          voiceGain.connect(voicePan).connect(masterEnv);
        } else {
          voiceGain.connect(masterEnv);
        }

        osc.start(t0);
        osc.stop(t0 + totalDur + 0.3);
      }
    });
  }

  /* Plays a short, distinct "closing" choir tail — a few sine tones at
     the opening chord's own root frequencies — every time the Neon
     info overlay is dismissed (closed/backdrop-clicked/Escaped),
     regardless of whether the opening stab (see playChoirStab above)
     is still sustaining. Originally this only ever cut the STILL-
     PLAYING opening stab short and returned early once that stab had
     already finished on its own — since the opening stab's own total
     envelope is under 1.6s and an overlay is routinely left open
     longer than that before being closed, that early return meant
     "seems to fail more than works" for the closing cue specifically:
     most closes produced no sound at all. Unconditionally building
     this independent tail (cutting the still-live original stab short
     too, when there is one) is what makes closing produce audible
     content every time.

     The original 48 oscillators, when still live, keep whatever
     start()/stop() schedule playChoirStab already gave them —
     rescheduling a source node's stop() to a LATER time than one
     already given isn't reliably honored across engines (several just
     keep the earliest one), so extending those isn't a dependable way
     to stretch this out. Instead: (1) if the original stab is still
     live, its own master gain is pulled down to silence quickly (60ms,
     just enough to avoid a click) so it can't also keep sounding
     through to its natural end, and (2) this fresh, independent tail
     — start()/stop() scheduled just once, right here, for exactly
     fadeSeconds — is what actually plays, so there's always genuine
     audible content for the full requested duration regardless of how
     early or late the close happens. */
  function fadeOutChoir(fadeSeconds = 1.1) {
    if (!ctx) return;
    const now = ctx.currentTime;

    // 0.5 default: a reasonable mid-level stand-in for the now-common
    // case (the opening stab has already finished, so there's no live
    // gain left to read) — the actual case, when the stab is still
    // live, still reads its own real current level.
    let currentLevel = 0.5;
    if (choirMasterEnv && now < choirEndTime) {
      currentLevel = choirMasterEnv.gain.value;
      choirMasterEnv.gain.cancelScheduledValues(now);
      choirMasterEnv.gain.setValueAtTime(currentLevel, now);
      choirMasterEnv.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    }

    const tailGain = ctx.createGain();
    const tailPeak = Math.max(0.015, currentLevel * 0.05);
    tailGain.gain.setValueAtTime(0, now);
    tailGain.gain.linearRampToValueAtTime(tailPeak, now + 0.05);
    tailGain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
    tailGain.connect(sfxGain);
    if (cathedralReverb) {
      const tailWet = ctx.createGain();
      tailWet.gain.value = 0.6;
      tailGain.connect(tailWet).connect(cathedralReverb);
    }
    [130.81, 196.0, 293.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = i === 0 ? 1 : 0.5;
      osc.connect(voiceGain).connect(tailGain);
      osc.start(now);
      osc.stop(now + fadeSeconds + 0.1);
    });

    choirEndTime = now + fadeSeconds + 0.1;
  }

  /* A piece landing: a short filtered-noise thud (the impact transient)
     plus a low pitched body tone, both driven through the same crunch
     shaper and a short reverb send — replaces what was a clean rising
     triangle "boop." `mass` is the piece's own w*h*z volume (invariant
     across a roll, since rolling only permutes which dimension is
     which), so a larger piece genuinely lands lower and duller than a
     small one, not just louder. */
  function playLanding(mass) {
    /* Replaced entirely per feedback: this used to be a dirty,
       crunchy mechanical thud; now a crisp, brittle glass/ice crack —
       a short "tik—crrk" fracture rather than a "whump." Built from a
       tiny bright noise catch (the "tik"), a short cluster of very
       short narrow-bandpass noise grains (microscopic fractures
       propagating — the "crrk"), and a brief inharmonic partial
       "ring" (a struck-material resonance, not a struck-string
       harmonic series, so it doesn't read as a clean musical note).
       Deliberately skips thudShaper — that heavy distortion belongs
       to the old dirty-thud aesthetic and would just muddy the
       crispness this needs.

       Piece mass still drives pitch exactly as the "volume hierarchy"
       feedback requires: the same Opa/other levelMul split from
       before is unchanged, and mass still lowers the fundamental for
       bigger pieces — only the sonic character and the specific pitch
       mapping/curve changed.

       Per further feedback ("much higher pitched & more brittle"):
       the whole fundamental range was raised considerably, the
       granular/"tik" layers pushed brighter and given more resonance
       (higher Q), a fourth, higher shimmer partial added, every decay
       shortened a touch for extra snap, and the low-end layer trimmed
       back — brittle means thin and sharp, not weighty.

       Latest round: overall volume cut a further 25% (still split
       Opa/other, same hierarchy as before); the whole pitch curve
       raised again, equally for every piece size (a single multiplier
       on the base frequency, so the curve shape — and therefore the
       size-vs-pitch relationship — is unchanged, just shifted up); and
       roughly 30% of the time, the whole event is shifted a half step
       up or down AND given an easily-detectable tape-warble wobble
       (a fast, fairly deep detune wander across the note's own short
       life) on every pitched component, for an analog "wow and
       flutter" imperfection on some hits but not most.

       Latest: volume cut a further 60%, and the whole pitch curve
       raised 3x on top of everything above (again a single multiplier
       on the base frequency, so the size-vs-pitch relationship and
       every ratio/warble built on `fundamental` scale up with it
       automatically). */
    if (!ctx) return;
    const t0 = nowT();
    const m = Math.max(1, mass || 1);
    const isOpa = m >= 8;
    const levelMul = (isOpa ? 0.6 : 0.5) * 0.75 * 0.4; // unchanged hierarchy, each further cut 60% per feedback
    // ~30% of hits get a half-step pitch shift (up or down) plus a
    // tape-warble wobble applied to every pitched oscillator below.
    const hasVariation = Math.random() < 0.3;
    const halfStepMul = !hasVariation ? 1 : Math.random() < 0.5 ? Math.pow(2, 1 / 12) : Math.pow(2, -1 / 12);
    // Warbling notes get a little extra time so the wobble is actually
    // audible rather than clipped off — the other ~70% of hits are
    // completely unaffected by this.
    const warbleExtra = hasVariation ? 0.05 + Math.random() * 0.03 : 0;
    function applyWarble(param, dur) {
      if (!hasVariation) return;
      const depth = 7 + Math.random() * 4; // cents — 80% less detectable per feedback (was 35-55)
      param.setValueAtTime(0, t0);
      param.linearRampToValueAtTime(depth, t0 + dur * 0.22);
      param.linearRampToValueAtTime(-depth * 0.85, t0 + dur * 0.5);
      param.linearRampToValueAtTime(depth * 0.6, t0 + dur * 0.75);
      param.linearRampToValueAtTime(0, t0 + dur);
    }
    // Fundamental "ring" pitch — higher/thinner for small pieces,
    // deeper for large ones, raised again here (equally across every
    // piece size, via this one multiplier) on top of the earlier
    // brittleness pass. Per-hit jitter plus the inharmonic partials
    // below keep repeated hits, and different piece sizes, from ever
    // lining up into anything resembling a musical scale.
    const fundamental = 10200 * Math.pow(1 / m, 0.5) * (0.96 + Math.random() * 0.08) * halfStepMul; // 3400 x3 per feedback ("pitch-raised by a factor of 3")

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.5; // a little shimmer, not a cinematic tail — stays restrained
    dry.connect(sfxGain);
    wet.connect(reverbNode); // reverbNode's own send gain routes back into sfxGain

    // The "tik": an extremely short, very bright noise catch — the
    // instant the fracture starts.
    const tik = noiseSource();
    const tikFilt = ctx.createBiquadFilter();
    tikFilt.type = "highpass";
    tikFilt.frequency.value = 6400 + Math.random() * 1800; // brighter/brittler — was 5200-6800
    const tikEnv = ctx.createGain();
    env(tikEnv, t0, 0.0002, 0.0005, 0.006, 0.012 * levelMul);
    tik.connect(tikFilt).connect(tikEnv);
    tikEnv.connect(dry);
    tikEnv.connect(wet);
    tik.start(t0);
    tik.stop(t0 + 0.012);

    // The "crrk": a tight cluster of very short, narrow-bandpass noise
    // grains at irregular micro-offsets — microscopic fractures
    // propagating through the material, not one smooth burst. Center
    // frequency dips very slightly for bigger pieces so even this
    // granular texture leans a touch duller/heavier without losing
    // its glassy character.
    const grainCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < grainCount; i++) {
      const tG = t0 + Math.random() * 0.032;
      const gSrc = noiseSource();
      const gFilt = ctx.createBiquadFilter();
      gFilt.type = "bandpass";
      gFilt.frequency.value = (3400 + Math.random() * 4200) / Math.pow(m, 0.1); // brighter, and even less mass-dependent — brittle across all sizes
      gFilt.Q.value = 5 + Math.random() * 6; // higher resonance — more glassy/brittle ping, less noisy scrape
      const gEnv = ctx.createGain();
      const gDur = 0.0008 + Math.random() * 0.0018;
      env(gEnv, tG, 0.0002, 0.0003, gDur, (0.01 + Math.random() * 0.012) * levelMul);
      gSrc.connect(gFilt).connect(gEnv);
      gEnv.connect(dry);
      gEnv.connect(wet);
      gSrc.start(tG);
      gSrc.stop(tG + gDur + 0.01);
    }

    // The crystalline "ring": a few inharmonic (non-integer-ratio)
    // partials with a fast, glass-like decay — deliberately inharmonic
    // so it reads as struck glass/crystal rather than a tuned note,
    // even though the fundamental clearly tracks piece size.
    const partials = [
      { ratio: 1, peak: 0.02 },
      { ratio: 1.83, peak: 0.011 },
      { ratio: 2.76, peak: 0.007 },
      { ratio: 3.6, peak: 0.004 }, // added: a higher shimmer partial for extra brittleness
    ];
    partials.forEach(({ ratio, peak }, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = fundamental * ratio * (0.99 + Math.random() * 0.02);
      const pEnv = ctx.createGain();
      const dur = Math.max(0.016, 0.04 + Math.random() * 0.022 - i * 0.005) + warbleExtra; // shortened for snap; a touch longer only when warbling
      env(pEnv, t0, 0.0006, 0.002, dur, peak * levelMul);
      applyWarble(osc.detune, dur);
      osc.connect(pEnv);
      pEnv.connect(dry);
      pEnv.connect(wet);
      osc.start(t0);
      osc.stop(t0 + dur + 0.04);
    });

    // A trace of low-end presence underneath it all — trimmed back
    // further per "more brittle" feedback (brittle means thin and
    // sharp, not weighty), just enough that a large piece's crack
    // still feels a little deeper rather than merely louder. Its
    // frequency (half the fundamental) already falls with mass on its
    // own; peak amplitude does NOT change with mass, so bigger pieces
    // feel deeper, not bass-boosted.
    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = fundamental * 0.5;
    const lowEnv = ctx.createGain();
    const lowDur = 0.032 + warbleExtra;
    env(lowEnv, t0, 0.001, 0.003, lowDur, 0.006 * levelMul);
    applyWarble(low.detune, lowDur);
    low.connect(lowEnv);
    lowEnv.connect(dry);
    low.start(t0);
    low.stop(t0 + lowDur + 0.013);
  }

  /* Selection cue — was a clean tonal beep, replaced with a dry,
     dark, non-pitched click (filtered noise through the same crunch
     stage as the landing thud) so it registers as a small mechanical
     acknowledgment rather than a UI "bloop." Select and deselect share
     the same sound but at a slightly different filter center, so
     they're distinguishable without either one being a tone. */
  function sfxClick(centerFreq, peak) {
    if (!ctx) return;
    const t0 = nowT();
    const src = noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = centerFreq;
    filt.Q.value = 1.8;
    const g = ctx.createGain();
    env(g, t0, 0.001, 0.004, 0.03, peak);
    src.connect(filt).connect(g).connect(thudShaper).connect(sfxGain);
    src.start(t0);
    src.stop(t0 + 0.05);
  }

  /* Piece-selection cue, per feedback: replaced the filtered-noise
     click with an extremely high-pitched tonal "tink" — a clean sine
     (plus a quiet, slightly-detuned upper partial for a touch of
     metallic shimmer) sitting in the top ~10% of the normal 20Hz-20kHz
     human hearing range (~18-19kHz), with a near-instant attack and a
     very short decay so it reads as a tiny, thin contact tick rather
     than a tone you could hum. */
  function tink() {
    /* Per feedback: ~18kHz was inaudible in practice — that's well
       past where age-related high-frequency hearing loss (presbycusis)
       typically sets in, which starts eroding sensitivity above
       roughly 10-12kHz and climbs steeply from there, so most 50-60
       year old ears simply couldn't hear it at all, regardless of
       gain. Brought down to ~8.2-9.4kHz — still distinctly the
       highest, thinnest tone in the whole soundscape (every other
       piece sound tops out lower than this), but solidly inside the
       range ordinary aging hearing still perceives clearly. Peak
       nudged up slightly too, for margin. */
    if (!ctx) return;
    const t0 = nowT();
    const freq = 8200 + Math.random() * 1200; // ~8.2-9.4kHz
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t0, 0.0004, 0.0008, 0.018, 0.014);
    osc.connect(g).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.03);

    const partial = ctx.createOscillator();
    partial.type = "sine";
    partial.frequency.value = freq * 1.5; // inharmonic — metallic shimmer, not a clean octave
    const pg = ctx.createGain();
    env(pg, t0, 0.0004, 0.0004, 0.012, 0.005);
    partial.connect(pg).connect(sfxGain);
    partial.start(t0);
    partial.stop(t0 + 0.025);
  }

  return {
    ensureStarted,
    beginGameFadeIn,
    setZoom,
    setMuted,
    setTension: applyTension,
    beginFadeOut,
    resetWindDown,
    // Pitched down further and quieter still, per feedback — these
    // should now sit right at the edge of audible.
    playSelect: tink, // replaced with an extremely high-pitched tonal "tink" per feedback (was a 600Hz filtered-noise click)
    playDeselect: () => sfxClick(95, 0.009),
    playLanding,
    playCapture: playCabezaCrush, // pitch sink / plunging formant / downward Doppler decay, per feedback
    playWin: () => cue(440, 660, 0.5, "sine", 0.028), // halved, then -20% more per feedback (was 0.035)
    // ensureGraph() first, same reasoning as the Singularity sounds:
    // the Info overlay can be opened from the setup screen, before
    // ensureStarted()'s own `!awaitingBegin` gate would normally have
    // built the audio graph, and playChoirStab/fadeOutChoir silently
    // no-op without it (both guard on `if (!ctx) return`).
    playMenu: () => { ensureGraph(); playChoirStab(); },
    fadeOutMenu: () => { ensureGraph(); fadeOutChoir(); },
    // ensureGraph() + an explicit resume, same self-contained pattern
    // as playDockOpen/playSingularityOpen below — beginGameFadeIn()
    // (called right before this on desktop) already builds the graph,
    // but on mobile a backgrounded/locked screen can leave an existing
    // context suspended, and ensureGraph() alone no-ops once ctx
    // already exists, so it never resumed. Fixes the CONNECT chime
    // going silent on mobile.
    playPowerOn: () => {
      ensureGraph();
      if (ctx && ctx.state === "suspended") { unlockIosAudio(); ctx.resume(); }
      cue(70, 220, 0.7, "sine", 0.06);
      // Warped-sine companion, randomly offset so the two voices
      // intertwine differently every time (see connectionCompanion).
      connectionCompanion(140, 660, 0.7, 0.05, Math.random() * 0.25);
    },
    // Shorter and considerably louder than the initial version — per
    // feedback it wasn't being heard at all, most likely because a
    // reversed envelope's long, gentle swell-in (mirrored from
    // playPowerOn's quick attack) is much less perceptually salient
    // than a sharp attack at the same peak, especially competing
    // against the still-playing ambient bed and the simultaneous
    // master fade-out. Keeps the same reversed shape (still a swell-in
    // + quick cutoff, not a normal cue) but compressed and boosted so
    // it reliably cuts through both.
    // Same self-contained fix as playPowerOn above — the DISCONNECT
    // chime.
    playPowerOff: () => {
      ensureGraph();
      if (ctx && ctx.state === "suspended") { unlockIosAudio(); ctx.resume(); }
      reverseCue(70, 220, 0.4, "sine", 0.16);
      // Same companion as playPowerOn, pitched down to mirror the
      // DISCONNECT direction, own random intertwine offset.
      connectionCompanion(660, 140, 0.4, 0.09, Math.random() * 0.15);
    },
    playFlicker: () => { if (ctx && ctx.state === "running") evPowerFluctuation(); },
    playArc: () => { if (ctx && ctx.state === "running") evArc(); },
    playGlitch: () => { if (ctx && ctx.state === "running") { evDataBurst(); evStatic(); } },
    /* Singularity popup open/close — a wider, slower cousin of
       playPowerOn/Off's chime rather than a reuse of it, so entering
       the Singularity reads as its own, stranger event. ensureGraph()
       (not ensureStarted()) first: the Singularity can be discovered
       and opened during setup, before ensureStarted()'s own gate would
       normally have built the audio graph, and this must not also
       wake the ambient bed early.
       Starts at 70Hz, not 40 — below roughly 60Hz most laptop/phone
       speakers barely reproduce anything, so the original 40Hz start
       spent its whole attack phase effectively silent before the gain
       envelope had already peaked and started decaying. Gain roughly
       2.5x playPowerOn/Off's own, matching the precedent already set
       there ("boosted so it reliably cuts through" — see playPowerOff
       above): this needs to read clearly over ambience + gameplay SFX
       exactly like those do, not blend into near-silence. */
    playSingularityOpen: () => { ensureGraph(); cue(70, 900, 0.7, "sine", 0.16); },
    playSingularityClose: () => { ensureGraph(); reverseCue(70, 900, 0.5, "sine", 0.24); },
    /* Dock open/close — a very subtle low "vrrrt": a short, low,
       buzzy sawtooth descent (not a clean sine — the harmonics are
       what read as a mechanical whirr rather than a chime) and its
       true reverse. Deliberately quieter than every other cue here on
       open (this happens constantly, unlike the rarer Singularity/
       Info events) but boosted on close to actually read as audible,
       same reasoning as everywhere else in this file that pairs a
       subtle forward cue with a boosted reverse. */
    playDockOpen: () => { ensureGraph(); cue(60, 32, 0.24, "sawtooth", 0.025); },
    playDockClose: () => { ensureGraph(); reverseCue(60, 32, 0.3, "sawtooth", 0.05); },
    /* Anomaly button — a brief, high, rising square-wave blip: the
       squarewave's buzzy harmonics read as "electronic/scientific
       readout" rather than a musical chime, and the quick upward
       sweep gives it the feel of a scan or sensor ping rather than a
       generic UI click. ensureGraph() first, same reasoning as
       playDockOpen: Anomaly is only ever available during setup,
       before ensureStarted() would normally have built the graph. */
    // Cut 50% (0.045 -> 0.0225) and pitched up 300% (900-1600Hz ->
    // 3600-6400Hz) per feedback. That single smooth rising sweep then
    // read as "too much like a bird's peep" — a continuous glissande
    // is exactly what a chirp is. Replaced with two short FLAT
    // (unswept) tones stepping down, back to back, no slide between
    // them: a stepped "beep-boop" digital readout instead of one
    // whistled note. Second tone fires via ctx timing (t0 offset), not
    // a JS setTimeout, so it stays sample-accurate regardless of any
    // main-thread jank.
    playAnomaly: () => {
      ensureGraph();
      if (!ctx) return;
      const t0 = nowT();
      // Cut 50% (0.022 -> 0.011) and pitched up 2x (5200/2600 ->
      // 10400/5200) per feedback — still too loud/low.
      [
        { freq: 10400, start: 0, dur: 0.045 },
        { freq: 5200, start: 0.05, dur: 0.05 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = freq; // flat — no glissando, no chirp
        const g = ctx.createGain();
        env(g, t0 + start, 0.002, dur * 0.3, dur * 0.7, 0.011);
        osc.connect(g).connect(sfxGain);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.03);
      });
    },
    dispose: () => {
      disposed = true;
      if (scheduleTimer) clearTimeout(scheduleTimer);
      if (buzzWanderTimer) clearTimeout(buzzWanderTimer);
      if (crackleTimer) clearTimeout(crackleTimer);
      if (ctx) { try { ctx.close(); } catch (e) {} }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },
  };
}
