/* Shared board/camera/animation constants for El Cabeza's 3D engine.
   Verified byte-for-byte identical (after stripping comments) between
   the Standard and Neon theme sources before being extracted here —
   see build/scratch/ for the diff. The one genuine per-theme constant,
   EDGE_RADIUS (piece bevel radius), lives in each theme file instead,
   since Standard and Neon deliberately use different values (0.0625 vs
   0.03). */

export const BOARD_SIZE = 10;

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

export const SLAB = BOARD_SIZE + MARGIN_OLD * 2;

export const MARGIN = MARGIN_OLD * 0.6;

export const SQUARE_SIZE = (SLAB - MARGIN * 2) / BOARD_SIZE;

/* The slab's vertical thickness (its Y dimension — SLAB above is its
   footprint, X/Z). Reduced 25% from its original 0.5. slab.position.y
   in the scene-setup effect is derived from this (-SLAB_THICKNESS / 2)
   rather than a second hardcoded number, so the two can't drift out of
   sync — that position keeps the slab's TOP surface sitting at
   y = 0 regardless of thickness, since every piece and the grid itself
   are positioned relative to that surface, not the slab's center. */
export const SLAB_THICKNESS = 0.375;

export const GRID_EXTENT = BOARD_SIZE * SQUARE_SIZE;

export const OFF = GRID_EXTENT / 2;

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
};

export const GOAL_ROW = { dark: BOARD_SIZE - 1, light: 0 };

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
