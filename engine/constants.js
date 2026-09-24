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
  opa: { label: "O", name: "Opa", shape: "block", maxSteps: 2 },
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
  // MATTER's first odd-shaped piece: three cubes in an L (see
  // engine/shapes.js — its cubes ride along on the piece as `vox`). It
  // rolls for one point like the Chato/Flaco/Turrito, can rest standing,
  // flat, or balanced on one cube with the rest held out over the next
  // square, and crushes a Cabeza only with a cube that comes down ON it.
  codo: { label: "Co", name: "Codo", shape: "block", maxSteps: 2 },
  // The Arco: an arch with an opening that whatever fits can stand in
  // (a Cabeza under it is sheltered, like under a Codo's overhang). One
  // MATTER counter plus a size choice for the whole game; each size is
  // its own shape, so its own type. One point per roll.
  //   Chico: 5 cubes, 3 wide x 2 tall, opening 1 wide
  //   Alto:  7 cubes, 3 wide x 3 tall, opening 1 wide x 2 tall
  //   Ancho: 6 cubes, 4 wide x 2 tall, opening 2 wide
  arcoChico: { label: "AC", name: "Arco Chico", shape: "block", maxSteps: 2 },
  arcoAlto: { label: "AA", name: "Arco Alto", shape: "block", maxSteps: 2 },
  arcoAncho: { label: "AN", name: "Arco Ancho", shape: "block", maxSteps: 2 },
};

/* The Arco's three sizes, in MATTER's size choice: the key stored in
   the sphere's selections -> the piece type it places. */
export const ARCO_SIZES = [
  { key: "chico", type: "arcoChico", label: "Chico" },
  { key: "alto", type: "arcoAlto", label: "Alto" },
  { key: "ancho", type: "arcoAncho", label: "Ancho" },
];

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

/* SINGULARITY_DESIGN.md Part 2's LAWS — five independent toggles, all
   off by default so a normal (non-Singularity) game is completely
   unaffected. Mutable via setActiveLaws the same way board dimensions
   are: a plain object REPLACED (not mutated) on change, so importers
   holding the live binding see the new object. Only reachable today
   via the sphere's own LAWS menu (themes/neon-singularity.js) at
   Begin Game time — see finalizeSingularityBegin. */
export let ACTIVE_LAWS = {
  splitMovement: false,
  slide: false,
  diagonalSlide: false,
  blackHoleSquares: false,
  cantileverPivot: false,
  threeActions: false,
  // Shoving LAW: a bigger piece (more cubes) moving into a smaller one
  // pushes it along instead of being blocked — see tryShove in rules.js.
  // Its two game-start settings ride along here too: shoveFar = push as
  // far as the shoving piece travels (else 1 square); shoveOnRolls =
  // rolls shove as well as slides (else slides only).
  shoving: false,
  shoveFar: false,
  shoveOnRolls: false,
};

export function setActiveLaws(partial) {
  ACTIVE_LAWS = { ...ACTIVE_LAWS, ...partial };
  return ACTIVE_LAWS;
}

/* Black Hole Squares LAW placement: [] when the law is off (the
   default), or exactly two {row,col} squares once
   pickBlackHoleSquares (rules.js) has placed them for the current
   Singularity game — see rules.js's blackHoleVerdict/
   evaluateBlockLanding for how they redirect a move. Same mutable-
   module-state pattern as ACTIVE_LAWS/BOARD_ROWS: REPLACED (not
   mutated) on change, so a live-binding importer (rules.js, the AI
   worker) sees the update with no call-site changes; the worker's own
   module instance is set independently (engine/ai-worker.js), same as
   setActiveLaws/setBoardDimensions already are. */
export let BLACK_HOLES = [];

export function setBlackHoles(list) {
  BLACK_HOLES = list;
  return BLACK_HOLES;
}

/* Missing Squares TOPOLOGIES option: [] when off (the default), or
   one to five mirrored pairs of {row,col} squares once pickMissingSquares (rules.js) has
   placed them for the current Singularity game. Unlike Black Hole
   Squares these are simply impassable — no wormhole redirect, just a
   square no move may ever land its footprint on (see rules.js's
   missingSquareAt/evaluateBlockLanding/translatedCandidate). Same
   mutable-module-state pattern as BLACK_HOLES, for the same reason: a
   live-binding importer (rules.js, the AI worker) sees an update with no
   call-site changes; the worker's own module instance is set
   independently (engine/ai-worker.js), same as setBlackHoles already is. */
export let MISSING_SQUARES = [];

export function setMissingSquares(list) {
  MISSING_SQUARES = list;
  return MISSING_SQUARES;
}

/* A turn's action-point budget: 2 by default, 3 with the "3 Actions Per
   Turn" law. Uniform across every piece now — including Opa. Opa isn't
   kept to a smaller budget any more; instead an Opa MOVE costs two points
   (see moveCost), which is what keeps it to a single move per turn while
   still letting it slide. `type` is accepted (and ignored) so existing
   per-type call sites keep working. */
export function maxStepsFor(type) {
  const base = PIECE_META[type].maxSteps;
  return ACTIVE_LAWS.threeActions ? base + 1 : base;
}

/* The whole turn's action-point bank, independent of any one piece: 2 by
   default, 3 with "3 Actions Per Turn". Every piece now shares the same
   base budget (maxSteps 2), so this equals maxStepsFor(anyType) — but it's
   named for what it is at the TURN level, which is where the Split Movement
   law spends it: under Split Movement the bank is spent across up to
   MAX_PIECES_PER_TURN distinct pieces instead of committing it all to one.
   Without Split Movement a turn is always one piece and this is simply that
   piece's budget. */
export function turnBudget() {
  return ACTIVE_LAWS.threeActions ? 3 : 2;
}

/* The hard ceiling on how many DISTINCT pieces may move in a single turn,
   and only ever reached under the Split Movement law — a normal turn moves
   exactly one piece. Two is fixed by the design regardless of how many
   points the bank holds: a 3-point Split turn can be one Opa roll (2) plus a
   different piece's roll (1), but never a third piece. */
export const MAX_PIECES_PER_TURN = 2;

/* A Slide always costs TWO action points (a roll costs one). So in a
   normal 2-point turn a slide consumes the whole turn, while with "3
   Actions Per Turn" (a 3-point turn) it leaves exactly one point — room
   for a single follow-up roll ("a slide and an additional roll"). A piece
   can only slide when it has at least this many points left this turn. */
export const SLIDE_COST = 2;

/* An Opa MOVE always costs two action points — a roll as well as a slide.
   Opa is the 2x2x2 cube: one physical roll already carries it two squares
   (rollBlock moves it by its own width), so its move is worth two points.
   With a 2-point budget that's a whole normal turn; with "3 Actions" (3
   points) it's one Opa move plus one point left over — which, once the
   turn can be split across pieces (the Split Movement law), another piece
   can spend. Either way an Opa can never move more than once in a turn. */
export const OPA_MOVE_COST = 2;

// The action-point cost of a given move: a Slide (any piece) or ANY Opa
// move costs two; a normal roll or Cabeza step costs one. A wormhole
// teleport is handled separately as turn-ending, not by point cost.
export function moveCost(move) {
  if (!move) return 1;
  // A shove (Shoving LAW) adds SHOVE_COST on top of the move itself.
  const extra = move.shoves ? SHOVE_COST : 0;
  if (move.isSlide) return SLIDE_COST + extra;
  if (move.candidate && move.candidate.type === "opa") return OPA_MOVE_COST + extra;
  return 1 + extra;
}

/* What pushing another piece adds to a move's cost (Shoving LAW). */
export const SHOVE_COST = 1;

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

/* Slide LAW key vocabulary (SINGULARITY_DESIGN.md): a block piece can
   have both a roll and a slide available in the same on-screen
   direction (rollBlock and STEP_DIRS share the 4 cardinal letters), so
   legalMovesFor (rules.js) keys a slide as this prefix + the STEP_DIRS
   direction rather than the bare letter, to merge both into one dict
   without either overwriting the other. Centralized here, not
   re-typed at each call site, since the prefix has to agree exactly
   between where a slide key is BUILT (rules.js) and where it's later
   pulled back apart (chassis, to replay a slide's translate-only
   animation and to undo one). */
export const SLIDE_KEY_PREFIX = "slide-";
export const isSlideKey = (key) => key.startsWith(SLIDE_KEY_PREFIX);
export const slideKey = (dir) => SLIDE_KEY_PREFIX + dir;
export const baseDirOfSlideKey = (key) => key.slice(SLIDE_KEY_PREFIX.length);

/* Every slide key needs its own inverse for undo's backward replay,
   derived from the plain table above so the two can't drift apart. */
for (const dir of Object.keys(STEP_DIRS)) {
  INVERSE_DIR[slideKey(dir)] = slideKey(INVERSE_DIR[dir]);
}
