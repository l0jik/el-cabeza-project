/* Standard theme: palette, piece-edge rounding, and board visuals.
   Extracted from el_cabeza_3d.jsx. Everything here is intentionally
   theme-owned rather than shared — Standard and Neon deliberately
   render the board and pieces differently (see themes/neon.js for the
   contrast: bloom textures, additive blending, a dark palette). */

import * as THREE from "three";
import { BOARD_SIZE, SLAB, MARGIN, SQUARE_SIZE, OFF, DISC_DIAM, DISC_H, PIECE_SCALE } from "../engine/constants.js";
import { makeRoundedBox } from "../engine/geometry.js";
import { createWoodPercussion } from "../scripts/wood-impact-synth.js";

/* Outline thickness for the silhouette-shell technique below, in world
   units. Standard-only: Neon uses a different outline technique (see
   themes/neon.js's buildPieceVisual) that needs no equivalent
   constant. */
const OUTLINE_T = 0.016;

/* The chassis's roll animation strips this from a shell's Y position
   before it enters a pivot rotation (the shell's at-rest offset would
   otherwise rotate WITH the piece, dipping it below the board mid-roll
   — see chassis/ElCabeza3D.jsx's animateStep). Neon's shell carries no
   such offset (see themes/neon.js), so its value there is 0 — the
   chassis always applies `theme.outlineYOffset ?? 0` unconditionally
   rather than branching on which theme is active. */
export const outlineYOffset = OUTLINE_T;

export const COLORS = {
  /* Lightened from #FDFBF7 — a deliberate, if necessarily small, push:
     the starting value was already close to white, so there's limited
     room to move without losing the warm ivory character entirely.
     This is also the "Light" player's theme color throughout the UI
     (buttons, indicators, the win placard), not just the board surface
     — the two were always the same value and are kept that way here,
     so the board and its own side's UI chrome don't drift apart into
     two different creams. */
  cream: "#FFFEFC",
  creamAlt: "#F2ECDF",
  charcoal: "#242424",
  slate: "#4A5568",
  slateSoft: "rgba(74, 85, 104, 0.22)",
  slateFaint: "rgba(74, 85, 104, 0.12)",
  /* Outer page background — the area outside the app card itself, NOT
     the board. Deliberately a separate name from HEX.wood (the actual
     3D board-edge color, still light): the two happened to be close in
     value before, and giving this its own distinct name here removes
     any risk of future confusion between "the board's own wood tone"
     and "the backdrop behind the whole app," now that they're also
     visually distinct (dark brownish-gray vs. the board's own light
     wood). */
  pageBg: "#4A4038",
  pageBgDeep: "#332B24",
  /* Player chip FILL colors — a theme-agnostic pair chassis reads for
     any "which player is this" swatch (e.g. the move-log column
     headers), so it never has to assume charcoal=dark/cream=light
     itself. In Standard those literally are the ink/surface pair
     above; Neon's own charcoal/cream are inverted for its dark UI, so
     it defines this pair separately (see themes/neon.js). */
  bodyDark: "#242424",
  bodyLight: "#FFFEFC",
};

/* The masthead title and modal-header display face. Declared
   explicitly (chassis would fall back to this same value anyway) so
   both themes' font choice is visible in one place. */
export const titleFontFamily = "'Fraunces', serif";

export const HEX = {
  /* Kept identical to COLORS.cream, same reasoning as that comment —
     currently unused by any actual Three.js material (the board
     texture is drawn via Canvas 2D with the CSS string COLORS.cream
     directly), but kept in sync regardless so the two never quietly
     diverge if something starts reading this later. */
  cream: 0xfffefc,
  /* Light pieces are deliberately darker than the board cream: at
     0xfdfbf7 they were the same value as the squares beneath them, so
     neither their silhouette nor their shaded faces could register. */
  /* 0xe4dac6 darkened 10% (each channel x0.9), then brightened 2%
     (each channel x1.02) per feedback that the darkened tone read
     slightly too dim against the board. */
  pieceLight: 0xd1c8b6,
  charcoal: 0x242424,
  slate: 0x4a5568,
  wood: 0xddceaf,
};

/* Edge rounding, in board units where one square = 1 inch. 0.125 = a
   1/8" roundover. This is the single number to tune. */
export const EDGE_RADIUS = 0.0625;

export function makeBoardTexture() {
  const RES = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  const pxPerUnit = RES / SLAB; // pixels per world unit — SLAB is unchanged
  const pad = MARGIN * pxPerUnit; // border thickness in pixels (uses the smaller MARGIN)
  const squarePx = SQUARE_SIZE * pxPerUnit; // each drawn square is now SQUARE_SIZE units wide

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, RES, RES);

  /* Every square is this same uniform cream — no alternating checker
     fill here anymore. Goal-row tinting still runs per-square below,
     but that's a different thing: a functional marker of the two
     win-condition rows (every square within a goal row gets the same
     tint as its neighbors), not a decorative light/dark pattern. */
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const isGoal = r === 0 || r === BOARD_SIZE - 1;
      if (isGoal) {
        ctx.fillStyle = "rgba(74, 85, 104, 0.055)";
        ctx.fillRect(pad + c * squarePx, pad + r * squarePx, squarePx, squarePx);
      }
    }
  }

  /* Grid lines are drawn as real geometry, not painted here — at
     grazing camera angles a mipmapped hairline disappears. Coordinate
     labels (1-10 / A-J) have been removed from the border entirely. */

  return new THREE.CanvasTexture(canvas);
}

/* Grid as line geometry: resolution-independent, so it stays crisp at
   any zoom and any camera pitch. */
export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];

  /* Every internal line (i = 0..BOARD_SIZE) drawn at one uniform
     opacity — no separate "major" tier for the center-bisecting lines
     (i = 5) or the two edge lines (i = 0, BOARD_SIZE) the way an
     earlier version had. The edges get their own distinct emphasis
     from the charcoal border drawn below regardless, so a second,
     heavier-opacity copy of the grid line sitting exactly underneath
     it was never doing anything visible there anyway — it was only
     ever the center cross that this bucketing was actually making
     look heavier than the rest of the grid. */
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const p = i * SQUARE_SIZE - OFF;
    lines.push(p, 0, -OFF, p, 0, OFF);
    lines.push(-OFF, 0, p, OFF, 0, p);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: HEX.slate, transparent: true, opacity: 0.3 })
  );
  /* Raised from 0.004 — the slab's own top-face material carries a
     view-angle-dependent polygonOffset push (see buildSlabMaterials'
     own comment: ~0.012 world units overhead, up to ~0.03 at a grazing
     angle) meant to guarantee these exact lines win the depth test
     against it. 0.004 is comfortably UNDER even that smallest push, so
     as phi swept through its range during a drag's own deceleration
     ease, the two could cross — read as the grid flickering in and out
     right at the board surface. Clearing the full range with margin,
     not just the overhead case, removes the crossing entirely rather
     than narrowing when it happens. */
  gridLines.position.y = 0.05;
  group.add(gridLines);

  /* Crisp charcoal border around the playing area. */
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
    new THREE.LineBasicMaterial({ color: HEX.charcoal, transparent: true, opacity: 0.8 })
  );
  border.position.y = 0.06; // same reasoning as gridLines above, kept above it
  group.add(border);

  return group;
}

/* Builds a piece's body mesh and its outline shell, given the piece's
   own edge radius (EDGE_RADIUS above) is already baked into `geo`
   wherever the caller built it the same way. Kept as one hook per
   ARCHITECTURE.md: Standard's opaque body + inflated back-face
   silhouette shell is a genuinely different technique from Neon's
   translucent body + traced-edge outline (see themes/neon.js), not
   the same function with different colors. */
/* Modal chrome (backdrop dimming, panel surface) for the chassis's
   shared popups (Move Log, Info, Victory placard). A separate token
   from COLORS.cream rather than deriving it inline, since these need
   their own alpha and — for Neon — a materially different base color,
   not just cream-with-opacity. */
export const modalBackdrop = "rgba(36,24,10,0.45)";
export const modalSurface = "rgba(253,251,247,0.96)";

/* Endpoints of the canvas mount's own radial-gradient background
   (the middle stop is COLORS.creamAlt, already theme-derived). */
export const canvasGradientStart = "#FFFDF9";
export const canvasGradientEnd = "#E9E1D2";

/* Real, if deliberately minimal, audio: physically-modeled wooden-
   piece impact sounds on landing (see scripts/wood-impact-synth.js
   for the acoustic model itself), nothing else. Every other cue
   (select, capture, win, ambient...) stays a no-op, same as before —
   Standard's identity is a quiet, classic wooden board, not a full
   soundscape to match Neon's. hasAudio lets the chassis show a real
   Sound On/Off control now that muting it actually does something. */
export const hasAudio = true;
export function createAudio() {
  let ctx = null;
  let master = null; // the one node playLanding's cues route through, so setMuted controls all of them
  let wood = null;
  let muted = false;

  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      wood = createWoodPercussion(ctx, master);
    } catch (e) {
      ctx = null; // Web Audio unavailable — game stays fully playable, just silent
    }
  }

  function ensureStarted() {
    ensureGraph();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  return {
    ensureStarted,
    beginGameFadeIn: ensureStarted, // no ambient bed to fade in — just needs the graph built/resumed inside Begin Game's own click
    setZoom() {},
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : 1;
    },
    setTension() {}, beginFadeOut() {}, resetWindDown() {},
    playSelect() {}, playDeselect() {},
    /* volume is piece.w * piece.h * piece.z (unitless grid multipliers,
       1 for the smallest piece up to 8 for Opa) — the same single
       scalar Neon's own playLanding(mass) already uses for its pitch
       hierarchy. Converted to real-world-ish units via cube-root
       scaling for the physical size (mass scales with volume, size
       scales with its cube root) rather than a linear guess, so the
       biggest and smallest pieces don't collapse to nearly the same
       synthesized size. Velocity/contact angle aren't available from
       this single call site, so they're randomized within a range
       that reads as "a solid piece settling flat onto the board,"
       rather than always sounding identical. */
    playLanding(volume) {
      ensureGraph();
      if (!wood) return;
      const v = Math.max(0.5, volume || 1);
      wood.playImpact({
        sizeM: 0.020 + 0.010 * Math.cbrt(v),
        massKg: 0.025 + 0.012 * v,
        velocityMS: 0.6 + Math.random() * 0.6,
        contactFrac: 0.6 + Math.random() * 0.3,
      });
    },
    playCapture() {},
    playWin() {}, playMenu() {}, fadeOutMenu() {}, playPowerOn() {},
    playPowerOff() {}, playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {},
    playDockOpen() {}, playDockClose() {},
    dispose() {
      if (ctx) { try { ctx.close(); } catch (e) {} }
    },
  };
}

/* No ambient visual FX of its own — every hook is a no-op. The chassis
   still calls these unconditionally at every lifecycle point. */
export function mountAmbientEffects() {
  return { armOnBegin() {}, restart() {}, tick() {}, dispose() {} };
}

/* Standard's own stylesheet is empty — its look needs no extra
   keyframes or hover treatments beyond what the chassis already
   provides. */
export const styleSheet = "";

/* No pre-game setup extras (Neon's Anomaly/Singularity have no
   Standard equivalent). */
export function renderSetupExtras() {
  return null;
}

/* No global SVG filter defs (Neon's VHS-glitch warp filters have no
   Standard equivalent). */
export function renderGlobalDefs() {
  return null;
}

/* Scene lighting: color/intensity only. Every light's position, shadow
   config, and cast/receive behavior is identical between themes and
   lives in the chassis (see ARCHITECTURE.md) — this is a plain data
   table, not a hook, because the chassis owns the light RIG and only
   ever asks a theme for these per-light overrides. */
export const lights = {
  ambient: { color: 0xffffff, intensity: 0.19278 },
  hemi: { sky: 0xffffff, ground: 0xa8946f, intensity: 0.273105 },
  key: { color: 0xfff6e8, intensity: 1.08 },
  fill: { color: 0xf4f7ff, intensity: 0.378 },
  back: { color: 0xffffff, intensity: 0.18 },
};

/* The slab's six BoxGeometry face materials, given the already-built
   board texture. A theme hook (not a shared function with parameters)
   because Neon's top face uses MeshPhysicalMaterial's clearcoat layer
   for a glossy sheen — a different material class, not just different
   numbers — while Standard's is a plain MeshStandardMaterial throughout.
   polygonOffset on the top face is chassis-owned tuning (it papers
   over a z-fighting concern shared by both themes' slab geometry, not
   a visual choice), so themes only ever set it exactly as shown here. */
export function buildSlabMaterials(boardTex) {
  const side = () => new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 });
  return [
    side(),
    side(),
    new THREE.MeshStandardMaterial({
      map: boardTex,
      roughness: 0.72,
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
  const mat = new THREE.MeshStandardMaterial({
    color: isDark ? HEX.charcoal : HEX.pieceLight,
    roughness: isDark ? 0.48 : 0.58,
    metalness: 0.04,
    /* No polygonOffset here. Biasing pieces forward was tried and
       reverted: with every mesh pulled -8 and every shell -4, a
       FARTHER piece's mesh could beat a NEARER piece's shell
       wherever their depth difference was smaller than that 4-unit
       gap, so pieces behind punched their outlines through pieces
       in front. Offsets applied per-object break ordering BETWEEN
       those objects; the board is the only surface here that every
       piece must sort against but that never sorts against a
       sibling, which is why the bias belongs there (see the slab's
       top-face material) and not on the pieces. */
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pieceId: piece.id, kind: "piece" };

  /* Silhouette shell: the same solid grown by OUTLINE_T and drawn
     back-faces-only, so the piece itself covers all of it except a
     thin rim. This is what separates two light pieces sitting side
     by side — a rounded solid has no sharp edge for EdgesGeometry
     to trace, so an outline has to come from the silhouette. */
  const shellGeo = isDisc
    ? new THREE.CylinderGeometry(
        (DISC_DIAM * PIECE_SCALE) / 2 + OUTLINE_T,
        (DISC_DIAM * PIECE_SCALE) / 2 + OUTLINE_T,
        DISC_H * PIECE_SCALE + OUTLINE_T * 2,
        40
      )
    : makeRoundedBox(
        piece.w * PIECE_SCALE + OUTLINE_T * 2,
        piece.z * PIECE_SCALE + OUTLINE_T * 2,
        piece.h * PIECE_SCALE + OUTLINE_T * 2,
        EDGE_RADIUS + OUTLINE_T
      );

  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshBasicMaterial({
      color: isDark ? 0x6f6f6f : HEX.charcoal,
      side: THREE.BackSide,
      /* shadowSide must be set EXPLICITLY here, and must be
         BackSide. This shell casts a shadow (below), and the
         shadow map keeps whichever surface is nearest the light.
         three.js derives shadowSide from `side` when it isn't
         given, and for a BackSide material it picks FrontSide —
         which would record this shell's NEAR surface, sitting
         OUTLINE_T in front of the piece's own lit faces. Every
         piece would then test as being inside its own shadow and
         render fully dark. Recording the FAR surface instead puts
         the occluder behind the piece's lit faces, so the piece
         stays lit while the board beyond it is still shadowed.
         The silhouette is identical either way — front and back
         faces of a closed convex solid share one outline — which
         is exactly the property being exploited. */
      shadowSide: THREE.BackSide,
    })
  );
  /* The shell casts, not just the mesh — see themes/standard.js's
     original comment history for why (matches the shadow's drawn
     silhouette to the outline, not just the mesh's own edge). */
  shell.castShadow = true;
  /* y + OUTLINE_T so the shell's symmetric growth sits entirely above
     the piece, flush with y=0, rather than penetrating the board. */
  shell.position.set(center.x, y + OUTLINE_T, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell" };

  return { mesh, shell };
}

/* Move/legal-move indicator: a dashed square outline, reading as
   drafting notation rather than competing with a piece's own cast
   shadow (a filled patch would). The chassis owns WHEN this fades in,
   out, or brightens on hover (see setGhostLineTarget/opacity in
   chassis/ElCabeza3D.jsx) — this only owns HOW that opacity value gets
   drawn, via the returned setOpacity(). Neon's own implementation (see
   themes/neon.js) looks and animates entirely differently; this is the
   plain, static baseline this theme has always used. */
export function buildMoveIndicator({ cx, cz, hx, hz, isCrush }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -hx, 0, -hz, hx, 0, -hz,
        hx, 0, -hz, hx, 0, hz,
        hx, 0, hz, -hx, 0, hz,
        -hx, 0, hz, -hx, 0, -hz,
      ],
      3
    )
  );
  const material = new THREE.LineDashedMaterial({
    color: HEX.charcoal,
    dashSize: isCrush ? 0.16 : 0.1,
    gapSize: isCrush ? 0.05 : 0.075,
    transparent: true,
    opacity: 0,
  });
  const line = new THREE.LineSegments(geo, material);
  line.computeLineDistances();
  line.position.set(cx, 0.025, cz);

  return {
    root: line,
    setOpacity(v) {
      material.opacity = v;
    },
    tick() {},
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
