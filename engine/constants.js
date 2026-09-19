/* Shared board/camera/animation constants for El Cabeza's 3D engine.
   Verified byte-for-byte identical (after stripping comments) between
   the Standard and Neon theme sources before being extracted here —
   see build/scratch/ for the diff. The one genuine per-theme constant,
   EDGE_RADIUS (piece bevel radius), lives in each theme file instead,
   since Standard and Neon deliberately use different values (0.0625 vs
   0.03). */

/* Board dimensions are a RUNTIME parameter, not a fixed constant — see
   setBoardDimensions() below and SINGULARITY_DESIGN.md's TOPOLOGIES
   section. They're `let` exports on purpose: ES module imports are live
   bindings, so every module that does `import { BOARD_ROWS } from
   "./constants.js"` sees the updated value after setBoardDimensions()
   runs, with no call-site changes and no getter indirection. Verified
   to survive esbuild's IIFE bundling, which is how this ships.

   Rows and cols are deliberately SEPARATE rather than one square
   BOARD_SIZE: a non-square board (9x12, 10x11) is an explicit goal, and
   a single conflated value is exactly how a rows-vs-cols mix-up would
   hide. At the 10x10 default the two are equal, so such a mix-up is
   invisible at the default size — tests/board-size.smoke.mjs exists to
   catch it by exercising a deliberately non-square board.

   A Worker has its own module instance of this file and therefore its
   own copy of these, untouched by the main thread's setBoardDimensions()
   — engine/ai-worker.js applies the dimensions carried on each request
   before searching. */
export let BOARD_ROWS = 10;
export let BOARD_COLS = 10;

/* Hard bounds. 20 is the ceiling per the TOPOLOGIES design decision; 6
   is the floor because the classic starting layout needs 4 columns of
   pieces plus two rows per side and stops being sensible below that. */
export const MIN_BOARD_DIM = 6;
export const MAX_BOARD_DIM = 20;

/* Border reduced from the historical MARGIN_OLD baseline in two rounds
   now: 20% first, then a further reduction to a cumulative 40% off
   that same baseline. The overall board footprint (SLAB) is held fixed
   at its old value both times, so the space the border gives up is
   exactly the space the grid gains — this isn't a free size increase,
   it's a reallocation, and it composes the same way a second time as
   it did the first. Squares grow to 1.056 world units each as a
   result; see SQUARE_SIZE below. Piece geometry is NOT built from
   SQUARE_SIZE (see PIECE_SCALE) so pieces stay their old absolute size
   and simply sit with more visible margin inside their now-larger
   squares. */
export const MARGIN_OLD = 0.7;

export const MARGIN = MARGIN_OLD * 0.6;

/* Now a genuine constant rather than something derived from the board's
   size. A square is a fixed 1.056 world units whatever the board's
   dimensions are, so a bigger board is physically bigger (and the
   camera pulls back further — see ZOOM_MAX) instead of squeezing the
   same plate into more, smaller squares, which would shrink every
   piece's apparent size along with it. The literal value is exactly
   what the old (SLAB - MARGIN*2) / BOARD_SIZE produced at 10x10, so
   the default board's geometry is unchanged to the last decimal. */
export const SQUARE_SIZE = (10 + MARGIN_OLD * 2 - MARGIN * 2) / 10;

/* The slab's vertical thickness (its Y dimension — SLAB above is its
   footprint, X/Z). Reduced 25% from its original 0.5. slab.position.y
   in the scene-setup effect is derived from this (-SLAB_THICKNESS / 2)
   rather than a second hardcoded number, so the two can't drift out of
   sync — that position keeps the slab's TOP surface sitting at
   y = 0 regardless of thickness, since every piece and the grid itself
   are positioned relative to that surface, not the slab's center. */
export const SLAB_THICKNESS = 0.375;

/* All dimension-dependent geometry, split by axis: X follows columns,
   Z follows rows (the board lies in the XZ plane, +Z toward Light's
   end). At the 10x10 default every X value equals its Z counterpart —
   which is exactly why an X/Z mix-up can't be caught at the default
   size, and why the non-square smoke test exists.

   SLAB_* is the physical plate's footprint: the grid plus its border on
   each side. SLAB_MAX/SLAB_MIN are conveniences for camera math that
   wants the board's largest or smallest extent without caring which
   axis it came from. */
export let GRID_EXTENT_X = BOARD_COLS * SQUARE_SIZE;
export let GRID_EXTENT_Z = BOARD_ROWS * SQUARE_SIZE;

export let OFF_X = GRID_EXTENT_X / 2;
export let OFF_Z = GRID_EXTENT_Z / 2;

export let SLAB_X = GRID_EXTENT_X + MARGIN * 2;
export let SLAB_Z = GRID_EXTENT_Z + MARGIN * 2;

export let SLAB_MAX = Math.max(SLAB_X, SLAB_Z);
export let SLAB_MIN = Math.min(SLAB_X, SLAB_Z);

/* Every piece is scaled by the same factor, so true proportions are kept
   (a Turrito stays a cube, a Flaco stays 1:1:2) while a gap opens up
   between each piece and the square it occupies. */
export const PIECE_SCALE = 0.8;

export const DISC_DIAM = 1.0304;

export const DISC_H = 0.246;

/* Move outlines sit wider than the piece that would land there, so the
   dashed rule reads as a target square rather than as the piece's own
   edge. */
export const GHOST_SCALE = 0.94;

/* Duration of a move-indicator's opacity transition, in ms — both
   directions (appearing and disappearing). "Quick" per an explicit
   request: fast enough to read as responsive rather than as a
   deliberate animation in its own right. */
export const GHOST_FADE_MS = 130;

/* 500, raised from 300 as a deliberate test of the warping perception.
   A simulation of the projected silhouette showed the shape change is
   pure rigid rotation (unavoidable and geometrically correct), but at
   300ms it peaks at ~4.1% of the piece's size PER FRAME — fast enough
   that the eye can read it as deformation rather than rotation. The
   same motion over 500ms is ~30 frames instead of ~18, dropping the
   peak to ~2.5%/frame without altering the geometry at all. The same
   simulation ruled out the other suspects: FOV has literally zero
   effect on the silhouette's aspect ratio (focal length scales screen
   width and height equally), camera distance is near-irrelevant
   (14.1% vs 14.6% swing across the whole zoom range), and the
   residual translation contributes ~0.25 points. Camera pitch is the
   only stronger lever (31.7% swing near top-down vs 2.9% from a low
   angle), but that changes how the whole game reads, not just rolls. */
export const ROLL_MS = 500;

/* Matches ROLL_MS rather than its own number — a flat glide at a
   different pace than the rolls would still read as inconsistent even
   without the vertical arc that used to make it look like a hop. */
export const SLIDE_MS = ROLL_MS;

/* How fast the rendered camera catches up to where input wants it.
   Higher = snappier/less lag, lower = smoother/more float. */
export const CAMERA_DAMPING = 9;

/* A New Game / End Active Game reset can swing the board up to 180°
   in one motion (whichever side the fresh game needs facing down),
   not the small nudge CAMERA_DAMPING is tuned for — at 9, even that
   full swing is ~95% settled within a third of a second, which reads
   as a snap for a rotation that size, especially landing at the exact
   moment the pieces themselves repopulate instantly. RESET_CAMERA_DAMPING
   is a separate, slower rate used only for the brief window right after
   a reset (see resetTransitionUntilRef / tick()) — everything else
   about the easing math is identical, just unhurried for this one
   specific, deliberately "settling" moment. First tried at 4 (~1.15s to
   99%), which read as sluggish rather than just softened; 6 (~0.77s to
   99%) is the adjustment — still clearly slower than the interactive
   rate, just not dragging on. RESET_TRANSITION_MS is that window's
   length, set comfortably longer than this rate's own ~99%-converged
   time so the switch back to the fast rate at the end is never itself
   visible as a speed change. */
export const RESET_CAMERA_DAMPING = 6;

export const RESET_TRANSITION_MS = 1000;

/* Raw drag-to-radians sensitivity, lowered from the original 0.006/0.005
   — combined with CAMERA_DAMPING above, this is the "decreased touch
   sensitivity plus acceleration" fix together. */
export const ORBIT_SENS_THETA = 0.0046;

export const ORBIT_SENS_PHI = 0.0038;

/* Cumulative pointer travel (px) required before a single-pointer touch
   is treated as an actual drag — both for starting to rotate the board
   (onMove) and for telling a drag apart from a tap on release (wasDrag).
   One shared threshold for both so they can't disagree with each other. */
export const DRAG_DEAD_ZONE_PX = 10;

/* Camera distance bounds — every zoom clamp (wheel, pinch, and the
   Top-Down View button's "50%") reads from these two, so they can't
   drift out of sync with each other. */
export const ZOOM_MIN = 9;

/* Raised from 34 (~+20%) so the board can pull back further before
   hitting its zoom-out limit, then raised again from 41 (~+34%) per
   feedback asking for the ability to zoom out even further, making the
   board noticeably smaller on screen than either previous limit
   allowed. */
export const ZOOM_MAX = 55;

export const PIECE_META = {
  cabeza: { label: "C", name: "Cabeza", shape: "disc", maxSteps: 2 },
  turrito: { label: "T", name: "Turrito", shape: "block", maxSteps: 2 },
  opa: { label: "O", name: "Opa", shape: "block", maxSteps: 1 },
  flaco: { label: "F", name: "Flaco", shape: "block", maxSteps: 2 },
  chato: { label: "Ch", name: "Chato", shape: "block", maxSteps: 2 },
  // MATTER's two rectangular new piece types (SINGULARITY_DESIGN.md
  // Part 2) — plain boxes, so they need no new rules: rollBlock/
  // evaluateBlockLanding already generalize over any {w,h,z}, and every
  // theme's own piece geometry is already built generically from a
  // piece's current w/h/z (see buildPieceVisual). Only reachable via a
  // MATTER roster chosen on the Singularity sphere — createInitialPieces'
  // fixed five and the plain Anomaly button never place these.
  block1x3: { label: "1x3", name: "1×3 Block", shape: "block", maxSteps: 2 },
  block2x3: { label: "2x3", name: "2×3 Block", shape: "block", maxSteps: 2 },
};

/* Dark advances toward the highest row index, Light toward 0. Mutable
   alongside the rest: the object is REPLACED (not mutated in place) by
   setBoardDimensions, so importers holding the live binding see the new
   object rather than a stale one. */
export let GOAL_ROW = { dark: BOARD_ROWS - 1, light: 0 };

/* Camera pull-back ceiling, scaled to the board it has to frame. The
   old flat 55 was tuned by eye against a 10x10 plate specifically (see
   the history in the ZOOM_MAX comment above); a 20x20 board is double
   that footprint in each direction and simply would not fit on screen
   at any allowed zoom if the ceiling stayed fixed. Scaling by the
   board's largest extent keeps the tuned-by-feel framing at 10x10
   (SLAB_MAX is 11.4 there, so this reproduces 55 exactly) and grows it
   proportionally from there. ZOOM_MIN is untouched: how close you may
   get to a piece has nothing to do with how many squares surround it. */
export let ZOOM_MAX_FOR_BOARD = ZOOM_MAX;

/* Recomputes every dimension-dependent value above. Split out so the
   initial module-load values and every later change run through the
   exact same derivation rather than two copies that could drift. */
function recomputeBoardGeometry() {
  GRID_EXTENT_X = BOARD_COLS * SQUARE_SIZE;
  GRID_EXTENT_Z = BOARD_ROWS * SQUARE_SIZE;
  OFF_X = GRID_EXTENT_X / 2;
  OFF_Z = GRID_EXTENT_Z / 2;
  SLAB_X = GRID_EXTENT_X + MARGIN * 2;
  SLAB_Z = GRID_EXTENT_Z + MARGIN * 2;
  SLAB_MAX = Math.max(SLAB_X, SLAB_Z);
  SLAB_MIN = Math.min(SLAB_X, SLAB_Z);
  GOAL_ROW = { dark: BOARD_ROWS - 1, light: 0 };
  ZOOM_MAX_FOR_BOARD = ZOOM_MAX * (SLAB_MAX / (10 + MARGIN_OLD * 2));
}

/* The one supported way to change the board's dimensions. Clamps to
   [MIN_BOARD_DIM, MAX_BOARD_DIM] and floors to integers rather than
   throwing: a malformed size should degrade to a playable board, not
   take the whole app down mid-setup. Call before building a scene or
   generating a starting layout — every derived value above updates
   together, and callers holding live bindings need no notification. */
export function setBoardDimensions(rows, cols) {
  const clamp = (n, fallback) => {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(MAX_BOARD_DIM, Math.max(MIN_BOARD_DIM, v));
  };
  BOARD_ROWS = clamp(rows, BOARD_ROWS);
  BOARD_COLS = clamp(cols, BOARD_COLS);
  recomputeBoardGeometry();
  return { rows: BOARD_ROWS, cols: BOARD_COLS };
}

/* For handing the current dimensions across a boundary that doesn't
   share this module instance — notably the AI worker. */
export function getBoardDimensions() {
  return { rows: BOARD_ROWS, cols: BOARD_COLS };
}

export const ROLL_DIRS = ["N", "E", "S", "W"];

export const STEP_DIRS = {
  N: [-1, 0],
  NE: [-1, 1],
  E: [0, 1],
  SE: [1, 1],
  S: [1, 0],
  SW: [1, -1],
  W: [0, -1],
  NW: [-1, -1],
};

/* Rolling W exactly inverts rolling E (and N/S likewise): from the
   rolled state, col+w−z returns the original col and the dimension swap
   reverses. So an undo is the recorded directions, inverted, played
   backwards — no separate reverse transform is needed. */
export const INVERSE_DIR = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
  NE: "SW",
  SW: "NE",
  NW: "SE",
  SE: "NW",
};
