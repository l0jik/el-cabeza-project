import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  El Cabeza — 3D                                                     */
/*                                                                     */
/*  Rules layer is unchanged from the 2D build: every block is a box    */
/*  w x h x z, and pivoting over an edge swaps z with the axis being    */
/*  rolled over. In 3D that pivot is animated literally — the piece     */
/*  tips over its contact edge, so the change in height and footprint   */
/*  is something you watch rather than infer.                           */
/*                                                                     */
/*  World axes: +x = columns, +z = rows (south), +y = up.               */
/* ------------------------------------------------------------------ */

/* App version — Semantic Versioning (MAJOR.MINOR.PATCH). MAJOR is
   reserved for a genuinely fundamental rework (data model, rendering
   architecture, that scale of change) rather than "a lot happened";
   MINOR for new capability that doesn't break anything existing;
   PATCH for fixes and small tweaks. Per standing instruction, this is
   now bumped automatically whenever a change to this file warrants
   it — no need to ask each time — with the INFO overlay's footer (see
   showInfoOverlay further down) updated to match in the same edit, so
   the two can never quietly drift apart. v1.0.0 marks this becoming a
   fully playable game — 3D board, full rules engine, working minimax
   AI — earlier in this project's history, before v1.7.0's responsive
   flex-fill layout (this file's version at the time this scheme was
   introduced). */
const APP_VERSION = "1.39.0";

const BOARD_SIZE = 10;
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
const MARGIN_OLD = 0.7;
const SLAB = BOARD_SIZE + MARGIN_OLD * 2; // 11.4, fixed regardless of the split below
const MARGIN = MARGIN_OLD * 0.6; // 0.42 — the 40% cumulative decrease
const SQUARE_SIZE = (SLAB - MARGIN * 2) / BOARD_SIZE; // 1.056 world units/square
/* The slab's vertical thickness (its Y dimension — SLAB above is its
   footprint, X/Z). Reduced 25% from its original 0.5. slab.position.y
   in the scene-setup effect is derived from this (-SLAB_THICKNESS / 2)
   rather than a second hardcoded number, so the two can't drift out of
   sync — that position keeps the slab's TOP surface sitting at
   y = 0 regardless of thickness, since every piece and the grid itself
   are positioned relative to that surface, not the slab's center. */
const SLAB_THICKNESS = 0.375;
const GRID_EXTENT = BOARD_SIZE * SQUARE_SIZE;
const OFF = GRID_EXTENT / 2;
/* Every piece is scaled by the same factor, so true proportions are kept
   (a Turrito stays a cube, a Flaco stays 1:1:2) while a gap opens up
   between each piece and the square it occupies. */
const PIECE_SCALE = 0.8;
const DISC_DIAM = 1.0304; // 0.896 x 1.15 — diameter only, height unchanged below
const DISC_H = 0.246;
/* Silhouette rim thickness, in board units. */
const OUTLINE_T = 0.016;
/* Move outlines sit wider than the piece that would land there, so the
   dashed rule reads as a target square rather than as the piece's own
   edge. */
const GHOST_SCALE = 0.94;
/* Duration of a move-indicator's opacity transition, in ms — both
   directions (appearing and disappearing). "Quick" per an explicit
   request: fast enough to read as responsive rather than as a
   deliberate animation in its own right. */
const GHOST_FADE_MS = 130;
/* Retargets a ghostLine's opacity fade without resetting the mesh
   itself — always starts from whatever the mesh is CURRENTLY rendering
   (not from its old target), so re-targeting mid-fade (e.g. a
   fade-in interrupted by the set becoming stale before it finishes)
   continues smoothly from the visible value rather than jumping. */
function setGhostLineTarget(mesh, target, fadingOut) {
  mesh.userData.opacityFrom = mesh.material.opacity;
  mesh.userData.opacityTo = target;
  mesh.userData.opacityStart = performance.now();
  if (fadingOut) mesh.userData.fadingOut = true;
}
/* Edge rounding, in board units where one square = 1 inch. 0.125 = a
   1/8" roundover. This is the single number to tune. */
const EDGE_RADIUS = 0.0625;
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
const ROLL_MS = 500;
/* Matches ROLL_MS rather than its own number — a flat glide at a
   different pace than the rolls would still read as inconsistent even
   without the vertical arc that used to make it look like a hop. */
const SLIDE_MS = ROLL_MS;
/* How fast the rendered camera catches up to where input wants it.
   Higher = snappier/less lag, lower = smoother/more float. */
const CAMERA_DAMPING = 9;
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
const RESET_CAMERA_DAMPING = 6;
const RESET_TRANSITION_MS = 1000;
/* Raw drag-to-radians sensitivity, lowered from the original 0.006/0.005
   — combined with CAMERA_DAMPING above, this is the "decreased touch
   sensitivity plus acceleration" fix together. */
const ORBIT_SENS_THETA = 0.0046;
const ORBIT_SENS_PHI = 0.0038;
/* Cumulative pointer travel (px) required before a single-pointer touch
   is treated as an actual drag — both for starting to rotate the board
   (onMove) and for telling a drag apart from a tap on release (wasDrag).
   One shared threshold for both so they can't disagree with each other. */
const DRAG_DEAD_ZONE_PX = 10;
/* Camera distance bounds — every zoom clamp (wheel, pinch, and the
   Top-Down View button's "50%") reads from these two, so they can't
   drift out of sync with each other. */
const ZOOM_MIN = 9;
const ZOOM_MAX = 34;

const COLORS = {
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
};

const HEX = {
  /* Kept identical to COLORS.cream, same reasoning as that comment —
     currently unused by any actual Three.js material (the board
     texture is drawn via Canvas 2D with the CSS string COLORS.cream
     directly), but kept in sync regardless so the two never quietly
     diverge if something starts reading this later. */
  cream: 0xfffefc,
  /* Light pieces are deliberately darker than the board cream: at
     0xfdfbf7 they were the same value as the squares beneath them, so
     neither their silhouette nor their shaded faces could register. */
  /* 0xe4dac6 darkened 10% (each channel x0.9). */
  pieceLight: 0xcdc4b2,
  charcoal: 0x242424,
  slate: 0x4a5568,
  wood: 0xddceaf,
};

const PIECE_META = {
  cabeza: { label: "C", name: "Cabeza", shape: "disc", maxSteps: 2 },
  turrito: { label: "T", name: "Turrito", shape: "block", maxSteps: 2 },
  opa: { label: "O", name: "Opa", shape: "block", maxSteps: 1 },
  flaco: { label: "F", name: "Flaco", shape: "block", maxSteps: 2 },
  chato: { label: "Ch", name: "Chato", shape: "block", maxSteps: 2 },
};

const GOAL_ROW = { dark: BOARD_SIZE - 1, light: 0 };

const ROLL_DIRS = ["N", "E", "S", "W"];
const STEP_DIRS = {
  N: [-1, 0],
  NE: [-1, 1],
  E: [0, 1],
  SE: [1, 1],
  S: [1, 0],
  SW: [1, -1],
  W: [0, -1],
  NW: [-1, -1],
};

/* ---------------------------- rules ------------------------------- */

/* Rolling W exactly inverts rolling E (and N/S likewise): from the
   rolled state, col+w−z returns the original col and the dimension swap
   reverses. So an undo is the recorded directions, inverted, played
   backwards — no separate reverse transform is needed. */
const INVERSE_DIR = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
  NE: "SW",
  SW: "NE",
  NW: "SE",
  SE: "NW",
};

function createInitialPieces() {
  return [
    { id: "dark-flaco", type: "flaco", owner: "dark", row: 0, col: 3, w: 1, h: 2, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 5, w: 1, h: 1, z: 1 },
    { id: "dark-chato", type: "chato", owner: "dark", row: 0, col: 6, w: 1, h: 2, z: 2 },
    { id: "dark-opa", type: "opa", owner: "dark", row: 1, col: 4, w: 2, h: 2, z: 2 },
    { id: "light-chato", type: "chato", owner: "light", row: 8, col: 3, w: 1, h: 2, z: 2 },
    { id: "light-opa", type: "opa", owner: "light", row: 7, col: 4, w: 2, h: 2, z: 2 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 4, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
    { id: "light-flaco", type: "flaco", owner: "light", row: 8, col: 6, w: 1, h: 2, z: 1 },
  ];
}

function cellsOf(piece) {
  const cells = [];
  for (let r = piece.row; r < piece.row + piece.h; r++) {
    for (let c = piece.col; c < piece.col + piece.w; c++) cells.push([r, c]);
  }
  return cells;
}

function getPieceAt(pieces, row, col) {
  return (
    pieces.find(
      (p) => row >= p.row && row < p.row + p.h && col >= p.col && col < p.col + p.w
    ) || null
  );
}

function rollBlock(piece, dir) {
  const { row, col, w, h, z } = piece;
  switch (dir) {
    case "E":
      return { ...piece, col: col + w, w: z, z: w };
    case "W":
      return { ...piece, col: col - z, w: z, z: w };
    case "S":
      return { ...piece, row: row + h, h: z, z: h };
    case "N":
      return { ...piece, row: row - z, h: z, z: h };
    default:
      return piece;
  }
}

function inBounds(piece) {
  return (
    piece.row >= 0 &&
    piece.col >= 0 &&
    piece.row + piece.h <= BOARD_SIZE &&
    piece.col + piece.w <= BOARD_SIZE
  );
}

function evaluateBlockLanding(pieces, candidate) {
  if (!inBounds(candidate)) return { legal: false, crushes: null };
  const hits = [];
  for (const [r, c] of cellsOf(candidate)) {
    const occupant = getPieceAt(pieces, r, c);
    if (occupant && occupant.id !== candidate.id && !hits.includes(occupant)) hits.push(occupant);
  }
  if (hits.length === 0) return { legal: true, crushes: null };
  if (hits.length === 1 && hits[0].type === "cabeza" && hits[0].owner !== candidate.owner) {
    return { legal: true, crushes: hits[0] };
  }
  return { legal: false, crushes: null };
}

function legalRolls(pieces, piece) {
  const out = {};
  for (const dir of ROLL_DIRS) {
    const candidate = rollBlock(piece, dir);
    const verdict = evaluateBlockLanding(pieces, candidate);
    if (verdict.legal) out[dir] = { candidate, crushes: verdict.crushes };
  }
  return out;
}

function legalCabezaSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const r = piece.row + dr;
    const c = piece.col + dc;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
    const occupant = getPieceAt(pieces, r, c);
    if (occupant && occupant.id !== piece.id) continue;
    out[dir] = { candidate: { ...piece, row: r, col: c }, crushes: null };
  }
  return out;
}

function legalMovesFor(pieces, piece) {
  return piece.type === "cabeza" ? legalCabezaSteps(pieces, piece) : legalRolls(pieces, piece);
}

function pairLog(entries) {
  const rows = [];
  let current = null;
  for (const entry of entries) {
    if (entry.player === "dark") {
      if (current) rows.push(current);
      current = { n: rows.length + 1, dark: entry, light: null };
    } else {
      if (!current) current = { n: rows.length + 1, dark: null, light: null };
      current.light = entry;
      rows.push(current);
      current = null;
    }
  }
  if (current) rows.push(current);
  return rows;
}

/* Same "not a move" check the game engine enforces in settleTurn — kept
   at module scope so both places read one definition, not two that
   could quietly drift apart. */
function sameState(a, b) {
  return a.row === b.row && a.col === b.col && a.w === b.w && a.h === b.h && a.z === b.z;
}

/* ------------------------------ AI --------------------------------- */
/* Everything below is pure — no React, no Three.js. It only knows the
   game through the same functions a human's clicks already go through
   (legalMovesFor, rollBlock's inverses via sameState). The one thing it
   has that a click doesn't is generateTurns: a human plays one step at
   a time and the UI chains them, but the AI has to evaluate a whole
   turn — 1 step, or 2 — before it can compare options against each
   other, so it needs the complete tree up front. */

const AI_WIN_SCORE = 1_000_000;
/* How many turns count as "the opening" for AI move-variety purposes —
   see openingJitter in AI_DIFFICULTY and findBestAiTurn. */
const AI_OPENING_TURNS = 6;

function opponentOf(player) {
  return player === "dark" ? "light" : "dark";
}

/* Can any of the opponent's blocks crush `owner`'s Cabeza THIS move,
   from this exact position? Factored out so both evaluatePosition's
   leaf scoring and minimaxSearch's tie-break (see below) share one
   definition rather than two copies that could drift apart. */
function cabezaInDanger(pieces, owner) {
  const cabeza = pieces.find((p) => p.type === "cabeza" && p.owner === owner);
  if (!cabeza) return true; // already gone — about as "in danger" as it gets
  const oppPlayer = opponentOf(owner);
  for (const p of pieces) {
    if (p.owner !== oppPlayer || p.type === "cabeza") continue;
    const moves = legalMovesFor(pieces, p);
    for (const dir in moves) {
      if (moves[dir].crushes && moves[dir].crushes.id === cabeza.id) return true;
    }
  }
  return false;
}

/* Every complete legal turn available to `player` from this position:
   one piece, either a single step/roll or two chained together,
   exactly mirroring what the UI itself allows (see PIECE_META.maxSteps
   and the commit logic in the component). Two-step chains that land
   back on the turn's own starting square and orientation are excluded
   here for the same reason the engine voids them live — see sameState
   — so the AI never wastes a search branch, let alone an actual turn,
   considering a move that isn't really a move. */
function generateTurns(pieces, player) {
  const turns = [];

  for (const piece of pieces) {
    if (piece.owner !== player) continue;
    const maxSteps = PIECE_META[piece.type].maxSteps;
    const firstMoves = legalMovesFor(pieces, piece);

    for (const [dir1, move1] of Object.entries(firstMoves)) {
      let afterStep1 = pieces.map((p) => (p.id === piece.id ? move1.candidate : p));
      if (move1.crushes) afterStep1 = afterStep1.filter((p) => p.id !== move1.crushes.id);

      const wins1 =
        !move1.crushes &&
        piece.type === "cabeza" &&
        move1.candidate.row === GOAL_ROW[piece.owner];
      const terminal1 = !!move1.crushes || wins1;

      // Stopping after this single step is always itself a complete,
      // valid candidate turn — a human can always choose "Stop here"
      // even when a second step would be available, and the AI needs
      // that same option on the table, not just the deepest chain.
      turns.push({
        pieceId: piece.id,
        dirs: [dir1],
        resultingPieces: afterStep1,
        crushes: !!move1.crushes,
        wins: wins1,
      });

      if (terminal1 || maxSteps < 2) continue;

      const secondMoves = legalMovesFor(afterStep1, move1.candidate);
      for (const [dir2, move2] of Object.entries(secondMoves)) {
        if (sameState(piece, move2.candidate)) continue; // net-zero round trip — not a real turn

        let afterStep2 = afterStep1.map((p) => (p.id === piece.id ? move2.candidate : p));
        if (move2.crushes) afterStep2 = afterStep2.filter((p) => p.id !== move2.crushes.id);

        turns.push({
          pieceId: piece.id,
          dirs: [dir1, dir2],
          resultingPieces: afterStep2,
          crushes: !!move2.crushes,
          wins:
            !move2.crushes &&
            piece.type === "cabeza" &&
            move2.candidate.row === GOAL_ROW[piece.owner],
        });
      }
    }
  }

  return turns;
}

/* Scores a position from `forPlayer`'s point of view — higher is
   better for them, regardless of whose turn it actually is. This is
   the part that's genuinely hand-tuned rather than derived, and the
   most likely thing to need adjusting once this is actually played
   against.

   `weights` layers optional positional terms on top of the base score
   (progress/mobility/crush-threat below always apply regardless).
   Every term under DEFAULT_EVAL_WEIGHTS defaults to 0 — meaning "off,
   evaluates identically to before this existed" — and only becomes
   live when a difficulty's config actually sets it, so a tier that
   doesn't ask for one of these behaves exactly as it did previously. */
const DEFAULT_EVAL_WEIGHTS = {
  blockAdvance: 0,
  turritoBonus: 0,
  wall: 0,
  centrality: 0,
};

function evaluatePosition(pieces, forPlayer, weights = DEFAULT_EVAL_WEIGHTS) {
  const oppPlayer = opponentOf(forPlayer);
  const myCabeza = pieces.find((p) => p.type === "cabeza" && p.owner === forPlayer);
  const oppCabeza = pieces.find((p) => p.type === "cabeza" && p.owner === oppPlayer);

  // A missing Cabeza means it was crushed on some earlier ply of the
  // search itself (not necessarily the position actually on screen).
  if (!myCabeza) return -AI_WIN_SCORE;
  if (!oppCabeza) return AI_WIN_SCORE;

  // Progress toward each side's own goal row — dominant term, since
  // reaching it wins outright regardless of anything else on the board.
  const myProgress = forPlayer === "dark" ? myCabeza.row : BOARD_SIZE - 1 - myCabeza.row;
  const oppProgress = oppPlayer === "dark" ? oppCabeza.row : BOARD_SIZE - 1 - oppCabeza.row;
  let score = (myProgress - oppProgress) * 12;

  // Mobility: total legal rolls/steps available across each side's
  // pieces right now. Cheap proxy for "how much flexibility does this
  // side actually have" — a block rolled into a dead corner is worth
  // less than its mere presence on the board suggests.
  let myMobility = 0;
  let oppMobility = 0;
  for (const p of pieces) {
    const count = Object.keys(legalMovesFor(pieces, p)).length;
    if (p.owner === forPlayer) myMobility += count;
    else oppMobility += count;
  }
  score += (myMobility - oppMobility) * 1.5;

  // Immediate threat: can any enemy block crush my Cabeza on its very
  // next move, from this exact position? A real search finds this
  // organically at enough depth, but folding it into the leaf score too
  // gives even a shallow (Easy-mode) search genuine defensive sense
  // rather than none at all.
  if (cabezaInDanger(pieces, forPlayer)) score -= 4000;

  /* Everything below is off unless a difficulty's config turns it on
     (see AI_DIFFICULTY). Mobility above already rewards "more legal
     moves than the opponent" in general, but it has no opinion on
     WHERE a piece sits or what it's actually accomplishing there —
     these terms are what give block development, infiltration, and
     blocking real positional value beyond raw move-count, so a search
     that weighs them doesn't just default to whichever move happens to
     advance the Cabeza's dominant progress term the most. */

  if (weights.blockAdvance || weights.turritoBonus) {
    // Block development: the same "rows advanced from home" idea the
    // Cabeza's progress term uses, applied to the other four pieces
    // too, so a block still sitting on the back row reads as a worse
    // position than the identical piece several rows forward — not
    // merely neutral, the way it does today. Turrito gets an extra
    // per-square rate on top of the base one: it's the one piece small
    // enough (1x1) to thread through gaps the bigger blocks can't, so
    // pushing it forward aggressively is worth more than the same
    // advance from Opa or Chato, not just as much.
    for (const p of pieces) {
      if (p.type === "cabeza") continue;
      const rowsAdvanced = p.owner === "dark" ? p.row : BOARD_SIZE - 1 - p.row;
      const rate = weights.blockAdvance + (p.type === "turrito" ? weights.turritoBonus : 0);
      score += (p.owner === forPlayer ? 1 : -1) * rowsAdvanced * rate;
    }
  }

  if (weights.wall) {
    // Corridor coverage, not proximity to the enemy Cabeza's CURRENT
    // square. An earlier version of this measured "is one of my
    // pieces near wherever the Cabeza happens to be standing right
    // now" — which rewards a piece for merely having already started
    // near the Cabeza's home square, and gives it no reason to move
    // once the Cabeza heads somewhere else, or worse, no reason to
    // move at all while the Cabeza hasn't committed a direction yet.
    // That's backwards: the danger of an open lane exists BEFORE a
    // Cabeza starts using it, not just once it's already standing in
    // it. This instead finds the WIDEST gap between my own blockers
    // across the full width of the corridor the enemy Cabeza still has
    // to cross (every row between its current one and its own goal
    // row — with no committed column yet, any of them is still fair
    // game). A three-column-wide hole on one edge costs real points
    // the moment it exists, regardless of whether anything has
    // actually walked into it yet.
    const corridorGap = (owner, enemyCabeza, enemyGoalRow) => {
      const inBand = (r) =>
        enemyGoalRow > enemyCabeza.row
          ? r >= enemyCabeza.row && r <= enemyGoalRow
          : r <= enemyCabeza.row && r >= enemyGoalRow;
      const cols = pieces
        .filter((p) => p.owner === owner && p.type !== "cabeza")
        .filter((p) => inBand(p.row + (p.h - 1) / 2))
        .map((p) => p.col + (p.w - 1) / 2)
        .sort((a, b) => a - b);
      const marks = [-1, ...cols, BOARD_SIZE];
      let gap = 0;
      for (let i = 1; i < marks.length; i++) gap = Math.max(gap, marks[i] - marks[i - 1] - 1);
      return gap; // 0 = fully covered, up toward BOARD_SIZE = wide open
    };
    const myGap = corridorGap(forPlayer, oppCabeza, GOAL_ROW[oppPlayer]);
    const oppGap = corridorGap(oppPlayer, myCabeza, GOAL_ROW[forPlayer]);
    // A gap of MINE is bad for me (subtracts); the SAME gap sitting on
    // the opponent's side is an opportunity for my own Cabeza to run
    // through, so it adds — this is what gives the term both a
    // defensive and an aggressive side, not just a defensive one.
    score += (oppGap - myGap) * weights.wall;
  }

  if (weights.centrality) {
    // Zone control: a central piece has more of the board reachable
    // from it than the same piece pinned against an edge or corner —
    // true for a block's roll directions and doubly true for the
    // Cabeza, whose diagonal options get clipped outright near a wall.
    const center = (BOARD_SIZE - 1) / 2;
    const maxDist = Math.hypot(center, center);
    let value = 0;
    for (const p of pieces) {
      const pr = p.row + (p.h - 1) / 2;
      const pc = p.col + (p.w - 1) / 2;
      const central = 1 - Math.hypot(pr - center, pc - center) / maxDist;
      value += (p.owner === forPlayer ? 1 : -1) * central;
    }
    score += value * weights.centrality;
  }

  return score;
}

/* Alpha-beta minimax over generateTurns. `player` is whoever moves at
   this node (alternates every ply); `aiPlayer` is fixed for the whole
   search and is who every leaf is scored for — maximizing when it's
   aiPlayer's node, minimizing at the opponent's. `deadline` is a
   performance.now() timestamp, checked before recursing so a search
   that's running long can bail out cleanly rather than run away.

   `rootBias`, when present, nudges which of several genuinely
   comparable turns get chosen right here at THIS decision — it is
   deliberately never forwarded into the recursive call below, so it
   only ever touches the AI's own actual choice, never how any
   hypothetical line further down the tree gets valued. That keeps
   tactics (spotting threats, following a winning line, etc.) exactly
   as sharp as before; it only shapes style at the root. It's also
   never allowed to outweigh survival: a turn that pulls `player`'s own
   Cabeza out of immediate danger is exempt from both bias terms below,
   the same way a genuine crush/win already was — a real game showed a
   two-step Cabeza escape (the only move that actually reached safety)
   losing out to a one-step move that merely LOOKED comparable once
   twoStepBias knocked it down, which is exactly backwards.

   Ties (not just comparable-but-distinct scores) get their own
   resolution too — see the tie-break below the main comparison. Two
   turns scoring EXACTLY the same is normal in a forced loss, where
   every remaining option shares the same terminal value; without an
   explicit tie-break, whichever turn happened to be generated first
   wins by pure iteration-order luck, which is how an already-doomed
   Cabeza could end up ignored in favor of an unrelated piece even
   though moving it changed nothing about the actual outcome.

   `weights` is different: it's genuine position evaluation (see
   evaluatePosition), not a style nudge, so it DOES thread through every
   recursive call below — using a different value system at different
   plies would make minimax's own comparisons incoherent. */
function minimaxSearch(pieces, player, aiPlayer, depth, alpha, beta, deadline, rootBias = null, weights = DEFAULT_EVAL_WEIGHTS) {
  if (performance.now() > deadline) {
    return { score: evaluatePosition(pieces, aiPlayer, weights), turn: null, timedOut: true };
  }

  const turns = generateTurns(pieces, player);
  if (turns.length === 0 || depth === 0) {
    return { score: evaluatePosition(pieces, aiPlayer, weights), turn: null, timedOut: false };
  }

  const maximizing = player === aiPlayer;

  /* Move ordering: crush/win turns first (unchanged — costs nothing
     extra, since generateTurns already flags these), THEN every
     remaining candidate ranked by a quick static evaluation of its own
     resulting position — the same evaluatePosition used at the leaves,
     just also called once up front to rank candidates before recursing
     into them, rather than only at the bottom of the tree.

     This was genuinely missing before, not just theoretically
     incomplete: crush/win ordering alone gives alpha-beta nothing to
     work with for the vast majority of turns, which is exactly the
     case a corridor-closing move falls into — it isn't a crush, isn't
     a win, so it sat wherever generateTurns happened to produce it,
     un-ranked, alongside every pointless option. Verified with an
     actual benchmark against the real reported game's position (not
     just reasoned about): on that position, at matched time budgets,
     the OLD ordering was still reporting a mild -46.8 at depth 5 after
     255,014 nodes, while THIS ordering had already found a
     near-certain loss for the side ignoring the gap (-1,000,002) at
     that same depth using barely 38,680 nodes — a full ply earlier
     than the old ordering ever found it (depth 6). It also completed
     depth 4 outright inside the same time budget the old ordering
     timed out on. Since iterative deepening discards any depth that
     times out mid-search (see findBestAiTurn) and falls back to
     whatever depth DID finish, that gap compounds: OLD's incomplete
     depth 4 gets thrown away in favor of a depth-3 answer that hasn't
     seen the danger at all, while this ordering's depth 4 completes
     and is used directly.

     The scoring itself uses decorate-sort-undecorate — each candidate
     is evaluated exactly once up front, not re-evaluated on every
     pairwise comparison a naive sort comparator would trigger. That
     wasn't a micro-optimization: an earlier version that scored inside
     the comparator itself measured roughly 8x the per-node cost of the
     crush/win-only sort; scoring once up front brought that down to
     roughly 2.6x, which is what let the reduced node count from better
     pruning actually win out in wall-clock time rather than being
     eaten by ordering overhead. */
  const scoredTurns = turns.map((t) => ({
    turn: t,
    terminal: !!(t.crushes || t.wins),
    orderScore: t.crushes || t.wins ? 0 : evaluatePosition(t.resultingPieces, aiPlayer, weights),
  }));
  scoredTurns.sort((a, b) => {
    if (a.terminal !== b.terminal) return a.terminal ? -1 : 1;
    if (a.terminal) return 0; // both terminal -- no further ranking needed between them
    return maximizing ? b.orderScore - a.orderScore : a.orderScore - b.orderScore;
  });
  turns.splice(0, turns.length, ...scoredTurns.map((s) => s.turn));

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestTurn = null;
  let timedOut = false;

  /* Computed once, not per-turn: whether `player`'s own Cabeza is
     ALREADY in immediate danger before any of these candidates are
     even considered. Used below to exempt a turn that actually
     resolves that danger from the style biases — see the rootBias
     block. */
  const dangerBeforeMove = rootBias ? cabezaInDanger(pieces, player) : false;

  for (const turn of turns) {
    let score;
    if (turn.crushes || turn.wins) {
      // Terminal within this ply. depth is folded in as a small
      // tiebreak — not to decide who wins, only to prefer a faster win
      // and a more-delayed loss among otherwise-equal outcomes. Never
      // biased below — a genuinely decisive turn is never suppressed
      // for the sake of style.
      const sign = player === aiPlayer ? 1 : -1;
      score = sign * (AI_WIN_SCORE + depth);
    } else {
      const child = minimaxSearch(
        turn.resultingPieces,
        opponentOf(player),
        aiPlayer,
        depth - 1,
        alpha,
        beta,
        deadline,
        null, // rootBias intentionally NOT passed through — see comment above.
        weights // weights DOES thread through — evaluation must stay consistent at every ply.
      );
      score = child.score;
      if (child.timedOut) timedOut = true;

      if (rootBias) {
        // A turn that actually resolves an existing threat to my own
        // Cabeza is exempt from both biases below — same principle as
        // the crush/win carve-out above (a genuinely necessary move is
        // never suppressed for the sake of style), just extended to
        // cover "stops my Cabeza from being captured" as well as
        // "captures/wins outright". Without this, a two-step escape
        // that's the ONLY move actually reaching safety could still
        // lose to a one-step move that merely LOOKS comparable once
        // twoStepBias knocks it down — style should never outweigh
        // survival.
        const resolvesDanger = dangerBeforeMove && !cabezaInDanger(turn.resultingPieces, player);

        if (!resolvesDanger) {
          // Prefer a single movement over automatically chaining the
          // second one, unless the second movement is worth enough on
          // its own merits to overcome the nudge.
          if (turn.dirs.length === 2) score -= rootBias.twoStepBias;

          // The more turns in a row the AI has already spent walking
          // its own Cabeza, the more it's nudged toward using
          // something else this time — scales with the streak so an
          // isolated Cabeza move costs little, but leaning on it turn
          // after turn costs progressively more.
          const movedPiece = pieces.find((p) => p.id === turn.pieceId);
          if (movedPiece && movedPiece.type === "cabeza") {
            score -= rootBias.cabezaRepeatBias * rootBias.cabezaStreak;
          }
        }

        /* Root-only score noise, the fix for the AI opening with the
           same moves every single game. The search is otherwise
           completely deterministic: identical position in, identical
           move out — and the starting position is identical every
           game, so Medium replayed its opening verbatim forever.

           Sized against the real score scale rather than picked at
           random: one row of block advancement is 0.8, a point of
           mobility is 1.5, so a jitter of ~2 reshuffles moves the
           engine already considers near-equivalent while leaving any
           genuinely better move on top. It CANNOT trade away a real
           threat — a Cabeza in danger is -4000 and a win is 1e6, both
           orders of magnitude beyond anything this can move. That's
           what keeps the variety smart rather than just noisy.

           Skipped entirely at terminal scores, which preserves the
           exact-tie path below: forced-loss positions where every
           option scores the same sentinel value rely on `score ===
           bestScore` still matching, and continuous noise would make
           that comparison essentially never true. */
        if (rootBias.jitter > 0 && Math.abs(score) < AI_WIN_SCORE) {
          score += (Math.random() * 2 - 1) * rootBias.jitter;
        }
      }
    }

    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestTurn = turn;
    } else if (score === bestScore && bestTurn) {
      // Tie-break for otherwise-identical outcomes — most commonly a
      // forced loss the search can't avoid or delay any further,
      // where every remaining option scores the exact same terminal
      // value. Without this, the FIRST such turn generated wins by
      // default (strict inequality above never re-triggers on a tie),
      // which is how a Cabeza that's already lost no matter what can
      // still end up ignored in favor of moving some unrelated piece
      // — nothing in the raw score says otherwise once every path
      // leads to the same sentinel value. This prefers whichever tied
      // option doesn't leave `player`'s own Cabeza needlessly sitting
      // in immediate danger. It can't change a truly forced result,
      // but the AI keeps visibly trying rather than abandoning the
      // threatened piece — and a human (or another AI) doesn't always
      // find the correct follow-through even when one exists.
      const stayedSafe = !cabezaInDanger(turn.resultingPieces, player);
      const bestWasSafe = !cabezaInDanger(bestTurn.resultingPieces, player);
      if (stayedSafe && !bestWasSafe) {
        bestScore = score;
        bestTurn = turn;
      }
    }

    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
    if (beta <= alpha) break; // prune — the rest of this branch can't change the outcome

    if (timedOut) break;
  }

  return { score: bestScore, turn: bestTurn, timedOut };
}

/* Iterative deepening: search depth 1, then 2, then 3… until either
   maxDepth or timeBudgetMs runs out. A deeper attempt that times out
   mid-search is discarded outright rather than trusted — an alpha-beta
   search cut off partway through can be badly wrong about the branches
   it never finished looking at, so only a FULLY completed depth's
   answer is ever used. This is what keeps a "Hard" search from ever
   being able to freeze the tab: worst case, it just quietly falls back
   to whatever depth it did finish in time.

   `cabezaStreak` is how many of the AI's own most recent consecutive
   turns moved its Cabeza, supplied by the caller (see aiCabezaStreakRef
   in the component) — it's real game history, not something derivable
   from `pieces` alone, so it has to be threaded in rather than computed
   here. Turned into a rootBias only when the difficulty tier actually
   sets nonzero bias knobs, so Easy/Medium build `null` and run exactly
   as before.

   blockAdvance/turritoBonus/wall/centrality are the positional-weight
   knobs read by evaluatePosition (see DEFAULT_EVAL_WEIGHTS) — built
   into a `weights` object every time regardless of difficulty, since
   evaluatePosition already treats all-zero as "off"; a tier that
   doesn't set any of them just gets the same all-zero object Easy and
   Medium always have. */
function findBestAiTurn(
  pieces,
  aiPlayer,
  {
    maxDepth,
    timeBudgetMs,
    twoStepBias = 0,
    cabezaRepeatBias = 0,
    blockAdvance = 0,
    turritoBonus = 0,
    wall = 0,
    centrality = 0,
    jitter = 0,
    openingJitter = 0,
  },
  cabezaStreak = 0,
  turnIndex = 0
) {
  const deadline = performance.now() + timeBudgetMs;
  /* Openings get extra noise on top of the baseline. The opening is
     where determinism was most glaring — every other position has
     already diverged by whatever the human did, but turn one is
     identical in every single game, so that's exactly where the same
     jitter buys the most variety. It decays to the baseline once the
     game has its own shape. */
  const effectiveJitter = jitter + (turnIndex < AI_OPENING_TURNS ? openingJitter : 0);
  const rootBias =
    twoStepBias || cabezaRepeatBias || effectiveJitter
      ? { twoStepBias, cabezaRepeatBias, cabezaStreak, jitter: effectiveJitter }
      : null;
  const weights = { blockAdvance, turritoBonus, wall, centrality };
  let best = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() > deadline) break;
    const result = minimaxSearch(pieces, aiPlayer, aiPlayer, depth, -Infinity, Infinity, deadline, rootBias, weights);
    if (result.timedOut && depth > 1) break;
    if (result.turn) best = result.turn;
    if (Math.abs(result.score) >= AI_WIN_SCORE) break; // forced win/loss found — deeper search can't change that
  }

  return best;
}

/* Each tier raised roughly a step or two from the original pass, on
   both maxDepth AND timeBudgetMs together — bumping maxDepth alone
   would have done nothing, since the actual branching factor here is
   around 180 turns per position, which makes depth 3 already several
   million positions before pruning. The move-ordering step above helps
   real depth get reached inside these budgets, but these numbers are
   still ceilings the search reaches for, not guarantees — see
   findBestAiTurn: whatever a difficulty doesn't finish in time, it
   quietly falls back to the last depth that did complete.

   maxDepth/timeBudgetMs raised again here, per an explicit request to
   increase look-ahead across all three tiers, more so at higher tiers,
   specifically to get more of the full piece complement into play
   (deeper search is what lets the AI see a block's payoff far enough
   ahead to look worth choosing over the Cabeza — see the reasoning
   below on why depth alone, even before this round, already mattered
   for that). Both numbers moved together again for the same reason as
   the first pass: maxDepth is a ceiling the time-bounded search reaches
   for, not a guarantee, so raising it without also raising the time
   budget would very likely have changed nothing in practice.

   The scaling is deliberately front-loaded toward Hard: Easy +1 ply
   (2->3, time +50%), Medium +2 ply (4->6, time +67%), Hard +3 ply
   (6->9, time +100%) — both the depth increase and the proportional
   time increase get larger at each higher tier, matching "the higher
   the tier, the more look-ahead" directly rather than just scaling
   everything by the same factor.

   Worth being direct about the uncertainty here: with a branching
   factor this large, each additional ply of REAL depth costs roughly
   an order of magnitude more search even with alpha-beta pruning and
   move ordering, not a small constant amount — so doubling Hard's time
   budget is not the same guarantee as "Hard now reliably searches 3
   plies deeper." It should reach further in practice; exactly how much
   further depends on how well move ordering prunes in actual positions,
   which isn't something verifiable without live profiling in a running
   browser. Real play is what should confirm or further calibrate these,
   the same as every other number on this page.

   twoStepBias / cabezaRepeatBias (see the rootBias handling in
   minimaxSearch) push back on the AI leaning on its Cabeza turn after
   turn instead of developing its blocks, without ever touching a
   genuinely necessary continuation or a real crush/win.

   Hard gets both: a deep, well-tuned search finds a legitimate second
   movement, or another Cabeza slide, correct often enough that it stops
   looking like a choice and starts looking like a habit.

   Easy gets cabezaRepeatBias too, and set higher than Hard's — turns
   out a SHALLOW search leans on the Cabeza even harder, not less: at
   depth 2 there's no lookahead to make a block's positional value
   legible at all, so the Cabeza — the only piece that ever moves the
   dominant goal-progress term — is nearly the only thing that ever
   looks like a good move. Left alone this reads as the Cabeza being
   used almost exclusively; the stronger bias forces real rotation onto
   the blocks after a turn or two. twoStepBias is left at 0 for Easy,
   since chaining both movements wasn't the reported problem there.

   Medium was left at 0 for everything until now — untouched, same as
   Easy was before its own pass, until real play flagged the identical
   "rides the Cabeza" pattern here too. Depth 4 sits genuinely between
   Easy's 2 and Hard's 6: deep enough to see a block's consequences
   play out across two of its own turns (Easy's depth 2 can barely see
   past the opponent's immediate reply), but nowhere near Hard's
   6-ply view. That's why this isn't just "copy Hard's numbers down a
   notch" — Medium gets cabezaRepeatBias plus blockAdvance/turritoBonus
   specifically, not the full four-weight suite. The reported problem
   is which piece gets moved, not overall strategic depth, and
   blockAdvance/turritoBonus are the two terms that directly reward
   developing something other than the Cabeza; wall (corridor defense)
   and centrality (board position) are broader positional sense that
   nobody's flagged an issue with here, so they stay at 0 rather than
   being tuned on spec. cabezaRepeatBias sits at 11, closer to Easy's
   12 than Hard's 9 — Medium's positional weights are real but partial
   (two terms, not four), so the bias still needs to carry more of the
   load than it does for Hard, just not as much as when it was the
   ONLY mechanism Easy had. blockAdvance/turritoBonus themselves are
   scaled down from Hard's 1.4/1.6 to 0.8/0.9 — enough to be a genuine,
   felt reason to develop a block, not enough to make Medium's judgment
   read as Hard's. As with every number on this page, first pass, not
   derived — real play calibrates further from here. */
const AI_DIFFICULTY = {
  easy: {
    label: "Easy",
    maxDepth: 3,
    timeBudgetMs: 450,
    twoStepBias: 0,
    cabezaRepeatBias: 12,
    blockAdvance: 0,
    turritoBonus: 0,
    wall: 0,
    centrality: 0,
    /* Easy is already loose; a wide jitter suits it and keeps it from
       being memorisable either. */
    jitter: 2.5,
    openingJitter: 2.0,
  },
  medium: {
    label: "Medium",
    /* Raised again (6->8, 1500->2200ms) on the theory that search
       depth, not just the wall weight above, contributed to missing
       the reported corridor gap. Worth being precise about what this
       does and doesn't fix: wall is a STATIC term — it's evaluated at
       whatever position the search happens to be looking at, shallow
       or deep, so a shallow search was never literally blind to a
       gap's existence once wall stopped being 0. What deeper search
       adds instead is better judgment about whether leaving a gap open
       is actually worth it — seeing further into what the opponent
       does with it before deciding a block's own advancement credit
       outweighs covering that gap, rather than trading that off
       looking only a couple of turns ahead. A real, plausible
       contributor to the original failure, just a different mechanism
       than "couldn't see the gap at all." */
    maxDepth: 8,
    timeBudgetMs: 2200,
    twoStepBias: 0,
    cabezaRepeatBias: 11,
    blockAdvance: 0.8,
    turritoBonus: 0.9,
    /* Added after simulating a real reported game move-by-move (exact
       piece positions reconstructed from the log, not just move
       counts). Dark's blocks left a persistent gap on the board's
       right side — the corridorGap metric this weight multiplies
       measured it at 3.5 columns wide from turn 16 onward, the entire
       second half of the game — while Dark spent turns 21-26
       repeatedly shuffling its Flaco in the opposite corner. Light's
       Cabeza walked straight through that gap for an uncontested,
       six-turn winning run. With wall at 0, Medium's evaluation had no
       term that could see this at all: blockAdvance/turritoBonus only
       reward a block for advancing toward ITS OWN goal, never for
       covering the enemy Cabeza's corridor, so there was nothing in
       the position that made repositioning toward that gap look better
       than the block-advancement credit Flaco was already earning
       further left.

       2.0 rather than Hard's (now 4) wall: scaled down by roughly the
       same ratio already used for blockAdvance/turritoBonus above
       (Hard's 1.4/1.6 became 0.8/0.9 here, ~57%) — enough to give a
       wide-open corridor real, felt weight against the
       block-advancement terms it now has to compete with, not enough
       to make Medium's positional judgment read as Hard's. */
    wall: 2.0,
    centrality: 0,
    /* The tier this was actually reported on. 1.8 is a bit over two
       rows of block advancement (0.8 each) and just over one point of
       mobility (1.5), so moves the search rates within a couple of
       points of each other genuinely trade places between games, while
       anything clearly better still wins. openingJitter takes the
       first six turns to 4.8, which is where the repetition was most
       obvious and where the position is identical every game. */
    jitter: 1.8,
    openingJitter: 3.0,
  },
  hard: {
    label: "Hard",
    /* Raised again (9->11, 3000->4300ms) — same reasoning as Medium's
       depth increase above: not because wall's existence depends on
       search depth, but because deeper search should better judge
       whether an open corridor is worth trading away against other
       opportunities, by actually seeing further into how the opponent
       would exploit it rather than weighing that tradeoff only a
       couple of turns out. */
    maxDepth: 11,
    timeBudgetMs: 4300,
    twoStepBias: 10,
    cabezaRepeatBias: 9,
    blockAdvance: 1.4,
    turritoBonus: 1.6,
    /* Set to 4 per explicit instruction, replacing the 5.0 this was
       raised to last round. Worth noting plainly rather than silently:
       that was a reasoned-but-unverified extrapolation from Medium's
       evidence-backed 2.0, and this round's request for 4 supersedes
       it directly — not a further calibration of that same number, a
       different target value. Still meaningfully above the original
       3.5, and still without a Hard-tier game log demonstrating this
       specific failure the way Medium's 2.0 has behind it; real
       Hard-tier play remains what should confirm or further adjust
       this, same as the depth numbers above. */
    wall: 4,
    centrality: 0.8,
    /* Deliberately the smallest of the three. Hard's whole point is
       playing the best move it can find, so noise here is limited to
       breaking pure repetition — well under one row of its own
       advancement weight (1.4), so it only ever separates moves this
       tier already rates as effectively equal. The opening still gets
       a little more, since that is the one position guaranteed
       identical every game. */
    jitter: 0.5,
    openingJitter: 1.2,
  },
};

/* --------------------------- geometry ----------------------------- */

function pieceCenter(p) {
  return {
    x: (p.col + p.w / 2) * SQUARE_SIZE - OFF,
    y: (p.z * PIECE_SCALE) / 2, // height is a piece property, independent of square spacing
    z: (p.row + p.h / 2) * SQUARE_SIZE - OFF,
  };
}

/* Resting Y for a piece's mesh: half its scaled height, so it sits on
   the board rather than sinking into it. */
function restingY(p) {
  return PIECE_META[p.type].shape === "disc"
    ? (DISC_H * PIECE_SCALE) / 2
    : (p.z * PIECE_SCALE) / 2;
}

/* A box with every edge and corner eased: the exact Minkowski sum of
   a box and a sphere, so all 12 edges and 8 corners share one radius
   and the extents are exactly sx x sy x sz.

   Built by parameterising a sphere and DUPLICATING the rings that sit
   on the octant boundaries (the equator, and the four azimuth
   quarter-lines). Each octant's samples are offset to its own corner
   of the inner box, so those duplicated rings automatically bridge
   into the flat faces and the cylindrical edge fillets. The practical
   consequence is that `seg` controls ONLY fillet smoothness — the flat
   faces stay perfectly flat and full-size no matter how low it goes.

   Two earlier versions were wrong in instructive ways, both caught by
   measuring against the real geometry rather than by eye:

   1. An ExtrudeGeometry version extruded a rounded rectangle with
      bevelSize = radius, assuming the bevel insets the end caps. It
      does the opposite — bevelSize expands the body OUTWARD in the
      shape plane. Height was right, but the footprint was inflated by
      2 * bevelSize: makeRoundedBox(0.8, 0.8, 0.8) measured
      0.925 x 0.800 x 0.925. Invisible at rest, but a roll rotates the
      OLD geometry 90 degrees (bringing the correct 0.800 height into a
      horizontal axis) and then rebuilds it at 0.925, so pieces snapped
      15.6% wider the instant they landed.

   2. A sphere-swept version built on a uniform BoxGeometry grid fixed
      the size but looked like a squircle. With seg=6 on a 0.8 box the
      grid pitch is 0.133 while the fillet is only 0.0625 wide, so the
      last flat vertex landed at 0.267 when the flat face should reach
      0.3375 — the rounding started early and smeared across one huge
      quad, and smooth normals over that span read as a bulge.

   Verified for this version: extents exact for cubes and prisms alike;
   the flat top face reaches +/-0.33750 against an ideal of 0.33750;
   max deviation from the true rounded-box silhouette is 0.05% of a
   piece at seg=8 (1190 triangles, cheaper than the 5604-vertex
   ExtrudeGeometry it replaces); and a piece rotated 90 degrees matches
   a freshly rebuilt one to 4.7e-4 world units, which is sub-pixel.
   Any change here should be re-measured the same way — matching
   extents alone is not sufficient, the rotated and rebuilt solids must
   also agree, or landings will snap again. */
function makeRoundedBox(sx, sy, sz, radius, seg = 8) {
  const r = Math.min(radius, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4);
  const ix = sx / 2 - r;
  const iy = sy / 2 - r;
  const iz = sz / 2 - r;

  const us = [];
  const uq = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k <= seg; k++) {
      us.push((q * Math.PI) / 2 + (k / seg) * (Math.PI / 2));
      uq.push(q);
    }
  }
  const vs = [];
  const vh = [];
  for (let h = 0; h < 2; h++) {
    for (let k = 0; k <= seg; k++) {
      vs.push((h * Math.PI) / 2 + (k / seg) * (Math.PI / 2));
      vh.push(h);
    }
  }

  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const W = us.length;
  const H = vs.length;

  for (let j = 0; j < H; j++) {
    const v = vs[j];
    const sgnY = vh[j] === 0 ? 1 : -1;
    for (let i = 0; i < W; i++) {
      const u = us[i];
      const q = uq[i];
      const nx = Math.sin(v) * Math.cos(u);
      const ny = Math.cos(v);
      const nz = Math.sin(v) * Math.sin(u);
      const sgnX = q === 0 || q === 3 ? 1 : -1;
      const sgnZ = q === 0 || q === 1 ? 1 : -1;
      pos.push(ix * sgnX + r * nx, iy * sgnY + r * ny, iz * sgnZ + r * nz);
      nor.push(nx, ny, nz);
      uv.push(i / (W - 1), 1 - j / (H - 1));
    }
  }
  /* i wraps modulo W: the last azimuth column (u = 2pi, -z side) has to
     bridge back to the first (u = 0, +z side) or the +x edge fillet is
     left open. Stopping at W-1 left exactly that gap. */
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) {
      const i2 = (i + 1) % W;
      const a = j * W + i;
      const b = j * W + i2;
      const c = (j + 1) * W + i;
      const d = (j + 1) * W + i2;
      idx.push(a, b, c, b, d, c);
    }
  }

  /* Flat face caps. Each pole is a single point on the sphere but maps
     to the FOUR corners of a flat face, and no quad in the loop above
     spans between them — without these two triangles per face the top
     and bottom are open and you see straight into the piece. */
  const capT = [0, 1, 2, 3].map((q) => q * (seg + 1));
  const capB = [0, 1, 2, 3].map((q) => (H - 1) * W + q * (seg + 1));
  idx.push(capT[0], capT[2], capT[1], capT[0], capT[3], capT[2]);
  idx.push(capB[0], capB[1], capB[2], capB[0], capB[2], capB[3]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* Where a ray from (camY, camZ), in direction (dirY, dirZ), crosses the
   board's plane (Y=0), moving forward from the camera. Two genuinely
   different failure modes here, which must NOT be conflated:

   1. dirY >= 0 (level or pointing up): a real, common case at grazing
      pitch — the ray genuinely never reaches the ground going forward,
      because the visible ground has no far boundary in that direction.
      This is the horizon, and correctly extends to +-Infinity.

   2. dirY < 0 (pointing down) but the crossing point works out behind
      the camera (t < 0): this means camY and dirY share a sign — the
      camera has already passed below the board's plane and this ray
      points even further away from it, not toward it. This ray sees
      NONE of the board, which is the opposite of case 1's "sees an
      unbounded amount of it." Conflating the two was a real bug: when
      both of a frustum's edge rays hit this case at once, treating
      both as +-Infinity made the visible span appear to cover the
      ENTIRE board (max span minus min span = the whole width), which
      reported 100% board visibility for a camera looking directly
      AWAY from the board — verified by tracing the actual numbers at
      near-top-down pitch with a deeply negative vertical offset, where
      overlap incorrectly snapped back up to 1.0 after having correctly
      approached 0.

   Returns null for case 2 specifically, so the caller can tell the two
   apart rather than treating every non-forward-hit the same way. */
function rayHitBoardPlaneY0(camY, camZ, dirY, dirZ) {
  if (dirY >= -1e-9) return dirZ >= 0 ? Infinity : -Infinity;
  const t = -camY / dirY;
  if (t < 0) return null;
  return camZ + t * dirZ;
}

/* Fraction of the board's own width (measured along the camera's
   forward/back axis) that overlaps the visible ground, for a given
   orbit radius/pitch and a PURELY VERTICAL target offset ty (this
   assumes zero horizontal pan — horizontal drift is handled entirely
   separately, see the XZ clamp in the render loop, and the two are
   independent by design, not combined into one budget).

   No camera-height floor here (an earlier version had one, at 0.75
   then 0.1) — that was working around the rayHitBoardPlaneY0 bug
   described above by refusing to evaluate the geometry at all once the
   camera got close to the board, rather than fixing the actual
   miscalculation. With that fixed at its root, the camera is free to
   go to or below board level (per explicit confirmation this is fine
   for the "top" pan direction, which is the only one that can ever
   reach this), and this function's own math correctly reports
   dwindling then zero visibility rather than needing an artificial cutoff.

   Verified numerically (not just derived) against a wide grid of
   radius/phi/ty before being relied on: the true relationship here is
   NOT symmetric between panning up and down, and does not reduce to a
   clean closed form the way the horizontal case does, so this
   evaluates the actual ray-plane geometry directly rather than
   approximating it. A prior attempt at a closed-form approximation
   here (maxPanDistance / sin(phi)) was checked against this exact
   function and found to allow as little as 0% board visibility while
   reporting success — every downward-panning test case failed it
   outright, since it had no way to notice the camera going
   underground. That formula and this replacement should never be
   confused for equivalent; only this one is checked against the real
   geometry. */
function boardVerticalOverlapFraction(radius, phi, ty, halfFovRad) {
  const camY = ty + radius * Math.cos(phi);
  const camZ = radius * Math.sin(phi);
  const dY = -Math.cos(phi);
  const dZ = -Math.sin(phi);
  const cos = Math.cos(halfFovRad);
  const sin = Math.sin(halfFovRad);
  // The frustum's two extreme rays in this vertical cross-section,
  // found by rotating the boresight by +-halfFovRad.
  const nY = dY * cos - dZ * sin,
    nZ = dY * sin + dZ * cos; // steeper ("near") edge
  const fY = dY * cos + dZ * sin,
    fZ = -dY * sin + dZ * cos; // shallower ("far") edge
  const zNear = rayHitBoardPlaneY0(camY, camZ, nY, nZ);
  const zFar = rayHitBoardPlaneY0(camY, camZ, fY, fZ);
  // Either edge unable to see the board's plane at all (case 2 above)
  // means the board isn't visible via that edge — not "unboundedly
  // visible." Must be checked before the min/max span below, since
  // null can't meaningfully participate in that comparison.
  if (zNear === null || zFar === null) return 0;
  const lo = Math.min(zNear, zFar);
  const hi = Math.max(zNear, zFar);
  const half = SLAB / 2;
  const overlap = Math.max(0, Math.min(half, hi) - Math.max(-half, lo));
  return overlap / SLAB;
}


/* Bisects for the largest |ty|, in whichever direction ty already
   points, that still keeps at least minFraction of the board visible.
   target.y = 0 is always safely above the floor (confirmed across the
   full radius/phi grid this was validated against), so it's always a
   valid "known-safe" starting bracket regardless of which direction
   needs to be searched. Returns ty unchanged in the common case where
   it's already within bounds — this only does any real work on a
   frame where a drag, zoom, or tilt change just pushed it out. */
function clampVerticalTarget(ty, radius, phi, halfFovRad, minFraction) {
  if (boardVerticalOverlapFraction(radius, phi, ty, halfFovRad) >= minFraction) return ty;
  let lo = 0,
    hi = ty;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (boardVerticalOverlapFraction(radius, phi, mid, halfFovRad) >= minFraction) lo = mid;
    else hi = mid;
  }
  return lo;
}

/* The pivot edge and rotation for a roll, in world space.
   The piece is smaller than its square, so its contact edge sits inset
   from the grid line. Hinging on the grid line would make the piece
   appear to float; hinging on its own edge lands it short of the target
   by the gap it left behind plus the gap it must open on arrival, so
   that residual is carried as a translation across the same tween. */
function pivotFor(piece, dir) {
  const { row, col, w, h, z } = piece;
  const S = PIECE_SCALE;
  /* Square-index position now scales by SQUARE_SIZE; the piece's own
     contact-edge offset (below, ± w*S/2 etc.) does not — that's the
     piece's real physical edge, sized independently of square spacing. */
  const cx = (col + w / 2) * SQUARE_SIZE - OFF;
  const cz = (row + h / 2) * SQUARE_SIZE - OFF;
  const alongX = dir === "E" || dir === "W";
  /* Re-derived for a general square size: rotating the piece about its
     own contact edge lands its center at (old center) ± (w+z)/2 * S.
     The square-grid rules, separately, place the landing center at
     (old center) ± (w+z)/2 * SQUARE_SIZE. The gap between those two is
     the translation carried alongside the rotation. When SQUARE_SIZE
     was implicitly 1, this reduces to the original (1-S) form. */
  const residual = ((SQUARE_SIZE - S) * ((alongX ? w : h) + z)) / 2;

  switch (dir) {
    case "E":
      return {
        point: new THREE.Vector3(cx + (w * S) / 2, 0, cz),
        axis: new THREE.Vector3(0, 0, 1),
        angle: -Math.PI / 2,
        dirVec: new THREE.Vector3(1, 0, 0),
        residual,
      };
    case "W":
      return {
        point: new THREE.Vector3(cx - (w * S) / 2, 0, cz),
        axis: new THREE.Vector3(0, 0, 1),
        angle: Math.PI / 2,
        dirVec: new THREE.Vector3(-1, 0, 0),
        residual,
      };
    case "S":
      return {
        point: new THREE.Vector3(cx, 0, cz + (h * S) / 2),
        axis: new THREE.Vector3(1, 0, 0),
        angle: Math.PI / 2,
        dirVec: new THREE.Vector3(0, 0, 1),
        residual,
      };
    case "N":
      return {
        point: new THREE.Vector3(cx, 0, cz - (h * S) / 2),
        axis: new THREE.Vector3(1, 0, 0),
        angle: -Math.PI / 2,
        dirVec: new THREE.Vector3(0, 0, -1),
        residual,
      };
    default:
      return null;
  }
}

function makeBoardTexture() {
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
function makeGrid() {
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
  gridLines.position.y = 0.004;
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
  border.position.y = 0.006;
  group.add(border);

  return group;
}

/* --------------------------- component ---------------------------- */

export default function ElCabeza3D() {
  const mountRef = useRef(null);
  const three = useRef({});
  const anim = useRef(null);
  const commitRef = useRef(null);
  /* Always-fresh reference to beginMove, reassigned every render (same
     pattern as commitRef). Needed because the AI's continuation logic
     fires from a setTimeout — by the time that callback actually runs,
     a beginMove closure captured at the moment the timer was scheduled
     would still see the stale `busy: true` from the step that's still
     finishing, and its own guard would silently refuse to start the
     next roll. Reading beginMoveRef.current at call time instead always
     gets whatever render most recently ran. */
  const beginMoveRef = useRef(null);
  /* The AI's fully-decided turn for its current move, set once when it
     starts thinking and cleared the moment that turn ends for any
     reason (crush, goal, running out of steps, or the AI choosing to
     stop early). null whenever no AI turn is in flight. */
  const aiDirsRef = useRef(null);
  /* How many of the AI's own most recent consecutive turns moved its
     Cabeza — real history that findBestAiTurn has no other way to see,
     since it only ever looks at the current `pieces` snapshot. Fed into
     findBestAiTurn on every AI decision, then updated right after a
     turn is chosen (see the orchestration effect below); reset to 0 on
     New Game so a fresh game never inherits it from the last one. Only
     Hard difficulty actually reads this (see AI_DIFFICULTY), but it
     costs nothing to keep updated regardless of difficulty. */
  const aiCabezaStreakRef = useRef(0);
  /* cam.current holds where input WANTS the camera — set instantly and
     directly by drag, wheel, and pinch. The camera actually reads from
     cam.current.view, which chases those goals every frame at a fixed
     rate (see tick()). That separation is what removes the twitchiness:
     without it, every raw pointer sample was applied to the camera
     immediately, so any jitter in the input showed up immediately too. */
  const cam = useRef({
    theta: 0,
    phi: 0.86,
    radius: 17,
    target: new THREE.Vector3(0, 0, 0),
    view: { theta: 0, phi: 0.86, radius: 17, target: new THREE.Vector3(0, 0, 0) },
  });
  /* A performance.now() deadline: while now() is before this, tick()
     uses RESET_CAMERA_DAMPING instead of the normal CAMERA_DAMPING.
     Set once, in handleReset, right when the post-reset camera move
     is kicked off; 0 (its initial value) is always in the past, so
     normal interactive damping is what's active the rest of the time
     with no extra guard needed. */
  const resetTransitionUntilRef = useRef(0);

  const [pieces, setPieces] = useState(createInitialPieces);
  const [currentPlayer, setCurrentPlayer] = useState("dark");
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoverShadow, setHoverShadow] = useState(null);
  const [stepsUsed, setStepsUsed] = useState(0);
  const [turnSnapshot, setTurnSnapshot] = useState(null);
  const [pendingNotation, setPendingNotation] = useState([]);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("playing");
  /* Every completed turn, oldest first, each entry holding full state
     from immediately BEFORE that turn started plus what's needed to
     animate it backward: which piece moved, the direction sequence it
     took, and any piece it crushed (which has to be resurrected, since
     its mesh no longer exists once "build pieces" runs without it).
     Distinct from turnSnapshot, which only covers a turn still in
     progress and is cleared the instant that turn settles.

     This is what powers "Undo Turn": walk back through real game
     history, one full turn at a time, all the way to the start of the
     game if wanted, on either side, against a Human or an AI opponent.
     Captured at every point a turn actually completes (see endTurn,
     and the crush/goal branches in commitRef.current, which bypass
     endTurn entirely) and trimmed from the end as entries are
     consumed by an undo — this is real history, not a single-slot
     snapshot. */
  const [turnHistory, setTurnHistory] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState("");
  /* Opens automatically the moment a game ends (see the effect below),
     not on every render where status happens to already be "finished" —
     the dependency array means it only fires on the actual transition,
     so dismissing the placard (the X, backdrop click, or Escape) sticks
     until New Game, rather than being immediately forced open again. */
  const [showVictoryPlacard, setShowVictoryPlacard] = useState(false);
  useEffect(() => {
    if (status === "finished") setShowVictoryPlacard(true);
  }, [status]);
  /* Brief "Copied" feedback after handleCopyLog succeeds — reverts on
     its own after a couple seconds, no dismiss needed. */
  const [logCopied, setLogCopied] = useState(false);
  /* Same, for when handleCopyLog's clipboard attempt AND its fallback
     both fail — a visible signal on failure, not just the button
     silently staying at "Copy Log" forever, which reads identically to
     the button being broken. */
  const [logCopyFailed, setLogCopyFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  /* null = two-player. "dark"/"light" = that color is AI-controlled. */
  const [aiPlayer, setAiPlayer] = useState(null);
  /* Which color moves first in Human vs Human games — toggled by
     re-clicking the already-selected Human button (see the opponent
     row below). Only read at New Game, when aiPlayer is guaranteed
     null (New Game always lands back in Human mode), so it never needs
     to be reconciled against an AI-opponent choice; AI games keep
     their existing fixed Dark-first behavior regardless of this. Left
     unreset by New Game itself — it's a standing preference, same as
     aiDifficulty. */
  const [humanStartSide, setHumanStartSide] = useState("dark");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiThinking, setAiThinking] = useState(false);
  /* Every game — Human vs Human included — now needs an explicit Begin
     Game press before anything can move, not just an AI-opponent game.
     Nothing is allowed to act (not the AI, not a human click, not even
     Dark moving first) until the person presses it — see selectOpponent
     and handleReset, which both re-arm this to false, and the Begin
     Game button itself, which is the only thing that sets it true. */
  const [gameArmed, setGameArmed] = useState(false);
  const awaitingBegin = !gameArmed;

  /* Easter egg: clicking the "EL CABEZA" title (only the text itself,
     not the header around it) reveals a small INFO button that fades in
     next to it, stays for 4 seconds, then fades back out — see
     handleTitleClick below and infoBtnTimerRef. Clicking INFO opens the
     about-the-game overlay. */
  const [infoBtnVisible, setInfoBtnVisible] = useState(false);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const infoBtnTimerRef = useRef(null);

  function handleTitleClick() {
    setInfoBtnVisible(true);
    // Re-clicking the title while the button is already showing just
    // restarts its 4-second clock, rather than letting an earlier timer
    // hide it out from under a still-fresh reveal.
    if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    infoBtnTimerRef.current = setTimeout(() => setInfoBtnVisible(false), 4000);
  }

  function handleInfoButtonClick() {
    if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    setInfoBtnVisible(false);
    setShowInfoOverlay(true);
  }

  useEffect(() => {
    return () => {
      if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showInfoOverlay) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowInfoOverlay(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInfoOverlay]);

  useEffect(() => {
    if (!showVictoryPlacard) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowVictoryPlacard(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showVictoryPlacard]);

  function selectOpponent(value) {
    setAiPlayer(value);
    setGameArmed(false); // switching opponent type always re-requires Begin Game, Human included
  }

  /* The Human button does double duty: from an AI mode, it switches
     back to Human vs Human (same as selectOpponent(null) always did).
     Already IN Human mode, a re-click has nothing left to "select", so
     it instead toggles which color starts the next game — the button
     being disabled by the same lock condition as the rest of the row
     is what keeps this to "before a game begins". */
  function handleHumanButtonClick() {
    if (aiPlayer !== null) selectOpponent(null);
    else setHumanStartSide((prev) => (prev === "dark" ? "light" : "dark"));
  }

  const isPlaying = status === "playing";
  const turnLocked = stepsUsed > 0;
  /* True from the moment a game is begun (awaitingBegin cleared) until
     it concludes — the window where the Opponent row and the move
     record are hidden to declutter the board, and End Active Game
     relocates up next to Top-Down View. Reverts on its own the instant
     the game ends (isPlaying goes false), bringing both sections and
     the button's original spot back for reviewing the finished game
     and picking a new opponent — no separate state needed. */
  const declutter = !awaitingBegin && isPlaying;
  /* Distinct from declutter above: declutter is specifically about
     hiding the Opponent row and Record section, true only during
     ACTIVE play. This is about whether a live action button sits up
     here next to Top-Down View at all — true for both "playing" (End
     Active Game) and the new "ended" state (Reset Game), but false
     once a game concludes via an actual win. A real win already gets
     its own reset control from the bottom Record row's New Game button
     and the victory placard; showing a second, differently-labeled
     button up here too in that case would just be redundant. */
  const showTopButton = !awaitingBegin && status !== "finished";

  const selectedPiece = pieces.find((p) => p.id === selectedId) || null;
  const hoveredPiece = pieces.find((p) => p.id === hoveredId) || null;
  const activePiece = selectedPiece || hoveredPiece;

  const maxSteps = activePiece ? PIECE_META[activePiece.type].maxSteps : 0;
  const stepsRemaining = activePiece
    ? maxSteps - (activePiece.id === selectedId ? stepsUsed : 0)
    : 0;

  const shadows =
    isPlaying &&
    !busy &&
    activePiece &&
    activePiece.owner === currentPlayer &&
    currentPlayer !== aiPlayer && // the AI moves without narrating its options on the board
    stepsRemaining > 0
      ? legalMovesFor(pieces, activePiece)
      : {};
  const shadowEntries = Object.entries(shadows);

  /* ------------------------- scene setup ------------------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    /* Back to PCFSoftShadowMap after VSMShadowMap turned out to cost
       more than expected. The reasoning that led to VSM undersold what
       "once, in a separate pass" actually meant: that blur pass runs
       every frame the shadow map updates (Three.js defaults to
       recomputing it continuously), not a one-time setup cost — so
       pairing it with mapSize 4096 (4x the texels to blur) and
       blurSamples 16 (2x the samples per texel) meant a real,
       continuous per-frame cost, most visible exactly where it was
       reported: dragging the camera, which forces a fresh render every
       frame with nothing to amortize it against. PCF's softening is
       inline instead — a handful of extra samples taken at the exact
       point being shaded, during the render that's happening anyway —
       which is why it doesn't carry the same recurring full-texture
       cost. mapSize stays at 4096 below; that resolution bump is cheap
       under PCF specifically, since it's still just a depth-only
       render target, not the input to a per-frame blur pass. */
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /* Tone mapping, added after measuring the actual rendered output
       during a roll: the light pieces' lit faces were reaching 255 —
       pure white, and BRIGHTER than the board's own 251 — while no
       tone mapping was configured at all. With NoToneMapping (the
       default) anything the lighting drives above 1.0 is simply
       clamped, so those faces weren't just bright, they were CLIPPED:
       a flat, featureless patch with no shading gradient across it.

       That matters for the deformation problem specifically. Smooth
       shading gradients across a face are the primary cue the eye
       uses to read a solid as rotating rather than changing shape.
       When the face presented to the key light blows out to a flat
       white patch that also matches the board's value, the piece
       loses both its shading cue AND its contrast against the
       background in the same instant, leaving only a thin outline —
       which is exactly the condition under which a geometrically
       correct rigid rotation reads as the object growing or
       deforming. A rough estimate of the top face's irradiance puts
       it near 1.2 against a ceiling of 1.0, so roughly the top 20% of
       the piece's tonal range was being thrown away.

       ACES filmic rolls highlights off smoothly instead of clamping
       them, so that range is preserved as gradient rather than
       flattened. Exposure is lifted slightly above 1 because ACES
       darkens midtones on its own; 1.15 keeps overall brightness
       close to what it was, with the change concentrated where it was
       needed (the highlights). Both lines revert cleanly together if
       the filmic look isn't wanted. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    /* Ambient light hits every face equally, so it is precisely what
       flattens a cube. Keep it low and let directional lights at
       differing azimuths give each vertical face its own value. None is
       axis-aligned with the grid — a light square-on to the board would
       shade two opposite faces identically.
       History on these two numbers: darkened 15% earlier, then raised
       5% here specifically to lighten shadows — ambient/hemisphere are
       the only lights that reach a square the key light can't see past
       an occluding piece, so they're the correct lever for shadow
       brightness specifically, as opposed to key intensity or shadow
       bias/radius, which would also change how bright the directly-lit
       faces look. Net effect versus the original values: ambient
       0.24 -> 0.2142 (-10.75%), hemisphere 0.34 -> 0.30345 (-10.75%). */
    /* All five lights below scaled down 10% together here — a uniform
       cut, not another shadow-specific lift like the ambient/hemisphere
       change earlier. This compresses the whole range: the brightest lit
       faces aren't as intense, so the shadows read as less severe by
       comparison even though their own absolute level isn't the thing
       being changed this time. Scaling every light by the same factor
       keeps the relative balance between them intact — that balance is
       what makes each face shade distinctly instead of flattening. */
    scene.add(new THREE.AmbientLight(0xffffff, 0.19278)); // 0.2142 * 0.9
    const hemi = new THREE.HemisphereLight(0xffffff, 0xa8946f, 0.273105); // 0.30345 * 0.9
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff6e8, 1.08); // 1.2 * 0.9
    key.position.set(9, 13, 5);
    key.castShadow = true;
    /* 4096, up from 2048 — this is a depth-only render pass (no
       shading, no textures sampled), so for a scene this simple —
       ten pieces and a board, not an open world — doubling it is a
       trivial GPU cost. Combined with the already-tight ±11 frustum
       below, this is real added texel density, not resolution spent
       on empty space the frustum doesn't even cover. */
    key.shadow.mapSize.set(4096, 4096);
    /* This light and its frustum stay fixed in world space now that the
       board (not the camera) is what turns — see boardGroup below. A
       square board spun to 45° has a bounding diagonal of roughly
       SLAB*sqrt(2) ≈ 16.1, half of that ≈ 8.1, comfortably inside this
       already-existing ±11 margin. Worth knowing before shrinking this:
       it needs to cover the board at every possible heading, not just
       the heading it happens to be at when this is being read. */
    /* Tightened from +/-11 to +/-9.5. This is free resolution, not a
       trade-off: the frustum only has to contain everything that
       casts or receives, and that works out to 9.05 — the slab's
       bounding circle as it rotates about Y (11.4 * sqrt(2) / 2 =
       8.06) plus what the tallest piece adds along the light
       direction (1.6 * sin(38.4 deg) = 0.99). +/-11 was covering
       ~2 units of empty space on every side and paying for it in
       texel size. At 4096 across, +/-11 gives 0.00537 world units per
       texel; +/-9.5 gives 0.00464, a 14% finer shadow map for
       nothing. That headroom is what makes the lower normalBias below
       safe. +/-9.5 keeps 0.45 units of margin over the 9.05
       requirement, so nothing clips. */
    key.shadow.camera.left = -9.5;
    key.shadow.camera.right = 9.5;
    key.shadow.camera.top = 9.5;
    key.shadow.camera.bottom = -9.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.bias = 0;
    /* Zero, not the original -0.0012 — and this is the value that
       actually matters for the white line at a piece's base.

       History worth keeping, because the two knobs below were confused
       with each other for several rounds. bias and normalBias were
       escalated together (-0.0012 -> 0, and 0.02 -> 0.15) while
       chasing that line, then both restored together once a separate
       z-fighting cause was found and fixed via the slab's
       polygonOffset. Restoring both brought the line straight back,
       even though the polygonOffset was UNCHANGED and if anything
       stronger — which isolates the cause cleanly: the line needs both
       the slab offset AND zero depth bias. The z-fighting diagnosis
       was real but only half the story.

       Mechanically these two do different jobs, which is why they
       should never be moved as a pair again. A negative depth bias is
       a flat offset applied to every shadow comparison, so it pushes
       a shadow away from its caster uniformly — classic peter-panning,
       and at a piece's base that reads as exactly this: a thin strip
       of lit board between the piece and where its shadow starts.
       Zero removes that gap. normalBias, below, offsets along the
       surface normal instead and is the correct tool for acne; it was
       the one at fault for shadows detaching at 0.15, not this. */
    key.shadow.normalBias = 0.004;
    /* Lowered from 0.02 after a white line reappeared at piece bases
       specifically when zoomed in with the board panned down.

       normalBias offsets the shadow lookup along the RECEIVING
       surface's normal. On the board that offset is vertical, and with
       the key light at (9, 13, 5) a vertical offset converts to a
       horizontal one at 0.79x — so the shadow retreats from the piece
       casting it by normalBias * 0.79. At 0.02 that is 0.0158 world
       units, about 1.5% of a board square, and it is a FIXED
       world-space distance: invisible at normal zoom because it is a
       fraction of a pixel, but magnified into a several-pixel band of
       fully-lit board once the camera is close. Panning down doesn't
       cause it; it just puts the piece bases where you're looking
       straight at them. Pixel-scanning the reported frames confirmed
       it — full board brightness (215-222) sitting between a piece's
       dark outline and the start of its own shadow.

       0.02 was also simply larger than the job needs. Against this
       shadow map (4096 over a 22-unit frustum, so 0.00537 units per
       texel) it was 3.7 texels of offset, where 1-2 texels is the
       usual range for suppressing acne. 0.008 is 1.5 texels — still
       comfortably in that range, and it cuts the gap by 60% to 0.0063
       units.

       With bias at 0, this still carries the anti-acne job alone. If
       speckle ever appears on lit surfaces (the Cabeza's curved
       cylinder is the likeliest place, since a flat depth bias handles
       continuously-varying normals poorly), raise THIS a little rather
       than reintroducing negative bias — negative bias detaches every
       shadow uniformly and would bring the original white line back
       with it. Note the direct trade-off, now that it is measured:
       every increase here widens the contact gap by 0.79x the amount
       added, so it is worth staying near the low end of what actually
       works.

       Lowered 0.008 -> 0.004 after measuring the remaining line
       directly. Pixel-scanning a close zoom showed the sequence
       piece(156) -> outline(128) -> SPIKE(198-202) -> shadowed
       board(176): a sliver ~25 levels brighter than the board around
       it, 1-2px at ~187 px per world unit, so ~0.008 world units.
       That matched this value's own horizontal shadow retreat
       (0.008 * 0.792 = 0.0063) closely enough to identify it as the
       dominant term — it is a shadow-map contact gap, which is why it
       only shows against shadow, the one place a lit sliver has
       contrast to stand out against. Halving this halves that retreat
       to 0.0032. Safe to go this low only because the shadow camera
       above was tightened at the same time: 0.004 is 0.86 texels at
       the new 0.00464 texel size, versus 0.74 at the old one. */
    /* 1.6, down from 3.5. With the shell now casting and normalBias at
       0.008, this became the dominant remaining term in the white line
       at piece bases. radius is a PCF blur measured in shadow-map
       texels: at 3.5 texels (3.5 * 0.00537 = 0.019 world units) the
       penumbra faded the shadow out before it reached the piece, so
       the board immediately under a piece read as fully lit. Measuring
       a reported frame put the lit gap at ~2px where the scale was
       ~112px per world unit — 0.018 units, matching the blur width
       almost exactly, and roughly 3x the normalBias contribution
       (0.0063). 1.6 texels is 0.0086 units, which brings the penumbra
       under the outline's own width so the shadow meets the piece.

       Why it only ever showed on LIGHT pieces: the gap is identical on
       both, but dark pieces use a mid-grey shell (0x6f6f6f) while
       light pieces use near-black charcoal, so only the light ones
       frame that lit gap at maximum contrast.

       Shadows are correspondingly crisper. If they now read as too
       hard, raise this back toward 2.5 rather than past it — every
       texel added here puts ~0.005 world units of lit board back
       between a piece and its shadow. */
    key.shadow.radius = 1.6;
    scene.add(key);

    /* Fill sits roughly perpendicular to the key in plan, so the two
       faces the key rakes get different values from each other. */
    const fill = new THREE.DirectionalLight(0xf4f7ff, 0.378); // 0.42 * 0.9
    fill.position.set(-7, 5, 10);
    scene.add(fill);

    /* A dim back light keeps the two faces turned away from both from
       collapsing into the same silhouette-dark tone. */
    const back = new THREE.DirectionalLight(0xffffff, 0.18); // 0.2 * 0.9
    back.position.set(-5, 4, -11);
    scene.add(back);

    /* Board slab */
    const boardTex = makeBoardTexture();
    boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const slabGeo = new THREE.BoxGeometry(SLAB, SLAB_THICKNESS, SLAB);
    const slabMats = [
      new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 }),
      /* polygonOffset lives here, on the board's top face, and only
         here. This is the one surface every piece must sort against
         but that never sorts against a sibling of its own, which is
         what makes it the right place: biasing pieces instead broke
         ordering BETWEEN pieces (a farther mesh beating a nearer
         piece's outline shell), and biasing nothing left the white
         line at a piece's base.
         The earlier corner-line failure was not this value's fault.
         slabEdges (formerly a LineSegments wireframe of this same box)
         included the four vertical corner edges running down the
         slab's thickness. Those edges rise to exactly y=0, coplanar
         with this face, and line primitives do NOT receive a face's
         polygon offset (three.js enables GL_POLYGON_OFFSET_FILL only),
         so pushing this face back let them win and show through an
         opaque surface. That was the whole corner-line bug — the
         offset value was never the problem, those four line segments
         were. slabEdges is now built without them (see below), so this
         face can carry the bias it needs.

         16/16 cleared the white line at normal camera angles but the
         corner lines came back at a steep pitch (camera.phi can reach
         0.012 rad, near edge-on — see the drag clamp). Root cause:
         polygonOffsetFactor scales with the surface's DEPTH SLOPE
         relative to the camera, which has no upper bound as a surface
         approaches edge-on, while polygonOffsetUnits is close to a
         constant regardless of view angle. Raising VERTICAL_GAP last
         round chased the symptom without fixing this — factor's
         contribution can still outgrow any fixed gap at a steep enough
         angle. Rebalanced from 16/16 to 3/34 (same rough total at the
         camera's default angle, so the white-line fix this exists for
         is undisturbed) so the offset stays governed mostly by the
         bounded term and can't blow up at grazing angles. If the white
         line or the corner lines reappear again, raise UNITS, not
         FACTOR — factor is the one with no ceiling. */
      new THREE.MeshStandardMaterial({
        map: boardTex,
        roughness: 0.72,
        polygonOffset: true,
        /* Reduced again (was units 40, then 8) after two further
           reports: the white line still faintly visible at rest
           (most noticeable in shadow, where the contrast against a
           darker surrounding board makes a small remaining gap easier
           to see) and a slight sinking appearance. Both are consistent
           with this offset now being LARGER than it needs to be,
           rather than not large enough — the at-rest gap this exists
           to paper over should be exactly zero now that the shell
           carries its own precise OUTLINE_T offset at rest, and this
           same round's fix (stripping that offset before the shell
           enters a roll's pivot — see the roll-branch reparenting
           above) means the shell no longer carries a problematic
           offset into rotation at all, only the much smaller,
           mid-air-only penetration a perfectly symmetric shell has
           always had. Both of this offset's original jobs are mostly
           gone, so there's little reason for it to still be doing much
           work. Kept at a small nonzero value rather than removed
           entirely as pure insurance against floating-point-level
           z-fighting exactly at the y=0 boundary — a real,
           renderer-level effect, not a logical gap, that no amount of
           geometric precision in the scene's own numbers can rule out
           by itself.

           Being direct about the confidence level here, since this is
           the third round adjusting this same value: this is a
           reasoned reduction given what should now be true
           geometrically, not a re-derivation of the grazing-angle
           interaction that was wrong twice before. If either symptom
           persists, that interaction is still not well understood
           analytically and needs another empirical look rather than a
           fourth guess at this number. */
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 3,
      }),
      new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: HEX.wood, roughness: 0.85 }),
    ];
    const slab = new THREE.Mesh(slabGeo, slabMats);
    slab.position.y = -SLAB_THICKNESS / 2;
    slab.receiveShadow = true;

    /* Built explicitly rather than from EdgesGeometry(slabGeo). The
       full box wireframe includes four vertical corner segments that
       run the slab's whole thickness and terminate at exactly y=0 —
       coplanar with the top face. Since three.js enables only
       GL_POLYGON_OFFSET_FILL, those lines never receive the top face's
       polygon offset, so once that face is pushed back they win the
       depth test and appear as short vertical lines through an opaque
       surface at each corner. That was the corner-line bug.

       The verticals are kept (they define the slab's silhouette from
       low camera angles) but stopped VERTICAL_GAP short of the top
       face instead of touching it, which removes the coplanarity
       without removing the visual edge. The top and bottom rings are
       unchanged: the top ring is meant to coincide with the top face's
       perimeter (that's the crisp board border) and reads correctly
       there.

       VERTICAL_GAP raised 0.012 -> 0.06 after the corner lines came
       back. The gap has to beat the top face's polygon offset in WORLD
       units, and that offset is not a fixed distance: polygonOffsetFactor
       multiplies the surface's depth SLOPE, which grows sharply as the
       board is viewed at a shallow angle. So the face is pushed back
       much further when the camera is low than when it is overhead, and
       0.012 only cleared the overhead case. At this camera distance the
       grazing-angle push works out around 0.03 world units, so 0.06
       carries roughly 2x margin across the pitch range. It is 16% of
       SLAB_THICKNESS, so the vertical stops just shy of meeting the top
       ring — not perceptible at play zoom, and only visible at all from
       low angles where the slab's side is in view.

       If this ever recurs, do NOT just raise this number again: the
       better lever is splitting the offset, dropping
       polygonOffsetFactor (the slope-scaled term that misbehaves at
       grazing angles) while raising polygonOffsetUnits (the constant
       term), since the gap this offset actually needs to cover — a
       piece's outline shell dipping below the board — is a roughly
       fixed world-space amount that does not depend on view angle. */
    const halfSlab = SLAB / 2;
    const topY = SLAB_THICKNESS / 2;
    const botY = -SLAB_THICKNESS / 2;
    const VERTICAL_GAP = 0.06;
    const slabCorners = [
      [-halfSlab, -halfSlab],
      [halfSlab, -halfSlab],
      [halfSlab, halfSlab],
      [-halfSlab, halfSlab],
    ];
    const edgePts = [];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = slabCorners[i];
      const [x2, z2] = slabCorners[(i + 1) % 4];
      // top ring
      edgePts.push(x1, topY, z1, x2, topY, z2);
      // bottom ring
      edgePts.push(x1, botY, z1, x2, botY, z2);
      // vertical, stopping short of the top face
      edgePts.push(x1, botY, z1, x1, topY - VERTICAL_GAP, z1);
    }
    const slabEdgeGeo = new THREE.BufferGeometry();
    slabEdgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePts, 3));
    const slabEdges = new THREE.LineSegments(
      slabEdgeGeo,
      new THREE.LineBasicMaterial({ color: HEX.charcoal, transparent: true, opacity: 0.45 })
    );
    slabEdges.position.copy(slab.position);

    const pieceGroup = new THREE.Group();
    const ghostGroup = new THREE.Group();

    /* Everything that should turn together — the slab, the grid, every
       piece, every footprint indicator — lives under one group. Camera
       and lights are NOT children of it: the viewer and the lamp stay
       put in world space, and this group spins beneath them, which is
       what makes each piece's shadow sweep as its facing to the fixed
       light changes, the way a lazy Susan looks under a fixed lamp. */
    const boardGroup = new THREE.Group();
    boardGroup.add(slab, slabEdges, makeGrid(), pieceGroup, ghostGroup);
    scene.add(boardGroup);

    three.current = {
      scene,
      camera,
      renderer,
      boardGroup,
      pieceGroup,
      ghostGroup,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
    };

    /* ---- camera positioning ---- */
    /* Reads the DAMPED view, never the raw input goal — see cam.current
       above. Called once per frame from tick(), after the goal has been
       eased toward.
       The camera itself only ever has two real degrees of freedom now:
       pitch (phi, how steeply you're looking down) and distance
       (radius) — its compass bearing is permanently fixed, always due
       "south" of the target. What used to be the camera's orbit angle
       (theta) now drives boardGroup.rotation.y instead, so heading
       changes turn the board rather than moving the viewer. The
       negation is not arbitrary: rotating the scene by +a with a fixed
       camera produces the same image as the old camera-orbits-by-(-a)
       formula did, so this preserves the exact drag direction that was
       already tuned — if it ever feels backwards, this one sign is the
       whole fix. */
    function applyCamera() {
      const { phi, radius, target, theta } = cam.current.view;
      camera.position.set(target.x, target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi));
      camera.lookAt(target);
      boardGroup.rotation.y = -theta;
    }
    three.current.applyCamera = applyCamera;
    applyCamera();

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      /* No trailing `false` here: that argument tells three.js to skip
         setting the canvas's CSS width/height, leaving them driven by
         its width/height attributes instead — which setSize scales by
         devicePixelRatio for a sharp drawing buffer. Nothing else in
         this component sets the canvas's CSS size, so on any display
         where devicePixelRatio isn't exactly 1 (most screens today),
         the canvas was rendering at up to 2x its container's size and
         getting cropped to the top-left by this element's
         overflow: hidden — which reads as the board being shifted
         out of center, even though the camera was aiming at the exact
         center of its own (oversized) frame the whole time. */
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- render loop ---- */
    let raf;
    let last = performance.now();
    function tick(now) {
      /* Clamped, not raw. The AI's move search runs synchronously and can
         block the main thread for hundreds of milliseconds — JS is
         single-threaded, so this loop simply can't tick at all while
         that's happening. The instant it finishes and starts the AI's
         first roll, the next frame's raw (now - last) would be the
         entire blocked duration, which is already bigger than the
         roll's whole 300ms — so the animation would complete on its
         first processed frame instead of playing. It wouldn't look
         unsmooth so much as not happen at all, just jump to the end.
         Capping dt at a generous 100ms (well above any normal frame,
         comfortably below any real animation's duration) fixes this
         and any other cause of a stalled frame the same way, not just
         this one call site. */
      const dt = Math.min(now - last, 100);
      last = now;

      const goal = cam.current;
      const view = goal.view;

      /* At least 20% of the board must always stay within the visible
         frame, at any pan position, any zoom level, any camera tilt,
         and any spin — a fixed, unconditional floor, not just a limit
         on how far a single drag can go. Enforced on the GOAL here,
         every frame, rather than only at the moment of a pan: radius
         and phi can change independently afterward (wheel, pinch,
         drag-to-tilt), and a pan that satisfied this at one zoom/tilt
         could otherwise become invalid at another without ever being
         re-checked. Two independent limits, not one shared budget —
         being at the horizontal limit doesn't reduce how far vertical
         drift is separately allowed to go, and vice versa.

         HORIZONTAL (XZ): a circular clamp on the goal's distance from
         the board's own center, which is the origin — the board is
         square and centered there, so a symmetric radius is the
         natural fit.

         groundHalfSpan approximates the ground-plane distance from
         dead-center-of-view to the edge of the vertical FOV as if the
         camera were looking straight down (radius * tan(halfFOV)).
         That's the SMALLEST such span across the actual pitch range —
         a grazing view shows MORE ground in the far direction, not
         less — so applying it uniformly in every horizontal direction
         is deliberately conservative: it can be somewhat stricter than
         strictly necessary in some directions, but can never let the
         board go further off-screen than intended in any of them.

         maxPanDistance is solved from requiring the overlap between
         the board's own span and the visible span to be at least 20%
         of the board's width: boardHalfExtent*(1-2*0.20), plus the
         visible half-span itself. */
      const MIN_VISIBLE_FRACTION = 0.2;
      /* Stricter floor applied only when panning the board toward the
         BOTTOM of frame (positive target.y) — see the VERTICAL block
         below. More than double the base 20%: validated this reduces
         how far positive target.y can reach by roughly 15-20% across
         the tested radius/phi grid, tightening the direction reported
         as allowing the board to pan out of the play area at
         near-horizontal pitch. */
      const BOTTOM_MIN_VISIBLE_FRACTION = 0.45;
      /* Required visible fraction when panning the board toward the TOP
         of frame (negative target.y) — see the VERTICAL block below.
         Lower than the horizontal clamp's 20%, per explicit request:
         with the rayHitBoardPlaneY0 bug fixed (see that function's
         comment) and the camera now free to approach or pass below
         board level, this is the only thing governing how far the
         board can pan toward the top — there's no longer a separate
         camera-height floor doing part of the job. */
      const TOP_MIN_VISIBLE_FRACTION = 0.15;
      const halfFovRad = (camera.fov / 2) * (Math.PI / 180);
      const groundHalfSpan = goal.radius * Math.tan(halfFovRad);
      const maxPanDistance = (SLAB / 2) * (1 - 2 * MIN_VISIBLE_FRACTION) + groundHalfSpan;
      const panDistSq = goal.target.x * goal.target.x + goal.target.z * goal.target.z;
      if (panDistSq > maxPanDistance * maxPanDistance) {
        const panK = maxPanDistance / Math.sqrt(panDistSq);
        goal.target.x *= panK;
        goal.target.z *= panK;
      }

      /* VERTICAL (Y): panBy's vertical drag component moves target
         along the camera's own tilted up-vector, not world-up, so it
         can carry target.y off the board's actual plane (y=0) — a
         failure mode the horizontal clamp above cannot see at all,
         since it only looks at x/z.

         This calls the exact, numerically-validated model (see
         boardVerticalOverlapFraction / clampVerticalTarget, defined
         near pivotFor) rather than a closed-form approximation. That
         matters here specifically: an earlier attempt at a simple
         formula (maxPanDistance / sin(phi), on the theory that a
         vertical drift's on-screen effect scales with sin(phi)) was
         checked against the real ray-plane geometry across a full
         radius/phi grid and failed EVERY test — panning down always
         reported 0% board visibility while the formula still called it
         safe, because it had no way to notice the camera itself
         descending to or below board level. The true relationship is
         asymmetric between panning up and down and doesn't reduce to
         one clean expression, which is exactly why this is solved
         numerically per-frame against the actual geometry (24
         bisection steps against a couple of trig calls each — trivial
         cost) instead of approximated.

         The required visible fraction is ALSO asymmetric, deliberately
         — confirmed by directly projecting the board's center to
         screen space: positive target.y moves the board toward the
         BOTTOM of frame, negative toward the TOP.

         TOP_MIN_VISIBLE_FRACTION (15%) replaces what used to be an
         artificial camera-height floor. That floor was a workaround
         for a genuine bug in rayHitBoardPlaneY0 (see its own comment):
         at near-top-down pitch with a sufficiently negative target.y,
         two failure modes that needed to be treated oppositely — a ray
         genuinely reaching the horizon, versus a ray whose camera has
         already passed below the board and is looking away from it —
         were being conflated, which could make the board register as
         100% visible while the camera looked directly away from it.
         With that fixed at the root, the camera is free to go to or
         below board level (confirmed acceptable), governed by nothing
         but this function's own, now-correct output — no artificial
         floor needed or present. BOTTOM_MIN_VISIBLE_FRACTION (45%)
         applies only to the bottom direction, unchanged from before. */
      const verticalMinFraction = goal.target.y > 0 ? BOTTOM_MIN_VISIBLE_FRACTION : TOP_MIN_VISIBLE_FRACTION;
      goal.target.y = clampVerticalTarget(goal.target.y, goal.radius, goal.phi, halfFovRad, verticalMinFraction);

      /* Ease the rendered camera toward wherever input currently wants it.
         1 - e^(-dt/1000 * damping) is frame-rate independent: the same
         visual catch-up speed whether the tab is doing 30fps or 120fps,
         rather than a per-frame constant that would feel different
         across devices. damping itself isn't always the same constant
         — see RESET_CAMERA_DAMPING above for why a reset briefly uses a
         slower one. */
      const damping = now < resetTransitionUntilRef.current ? RESET_CAMERA_DAMPING : CAMERA_DAMPING;
      const k = 1 - Math.exp((-dt / 1000) * damping);
      /* Theta accumulates without bound as the board is spun, so a
         plain (goal - view) difference could be several full turns —
         e.g. recentring after a long session would spin past the target
         several times before settling. Wrapping the difference into
         [-PI, PI) always takes the short way round instead. */
      const rawDiff = goal.theta - view.theta;
      const wrapped = ((rawDiff % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      view.theta += wrapped * k;
      view.phi += (goal.phi - view.phi) * k;
      view.radius += (goal.radius - view.radius) * k;
      view.target.lerp(goal.target, k);
      applyCamera();

      const a = anim.current;
      if (a) {
        a.elapsed += dt;
        const t = Math.min(a.elapsed / a.duration, 1);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        /* Residual eased separately from rotation, but — critically —
           on a curve that ARRIVES AT ZERO VELOCITY, same as rotation
           does. This is the fix for pieces appearing to spring or snap
           to a slightly longer shape just after landing.

           The residual is a horizontal "catch-up" slide needed only
           because a piece's own size (PIECE_SCALE) is deliberately
           smaller than the square grid it moves across (SQUARE_SIZE);
           it is roughly a third of a piece's own size, so how it
           arrives is very visible. It was moved off rotation's curve
           to concentrate it toward landing, which helped — but the
           curves used (t^3, then t^2) both have MAXIMUM velocity at
           t=1. Both endpoints reached 1, so the piece landed in the
           right place, but it was still travelling at full speed the
           instant the animation ended and then stopped dead. A
           velocity discontinuity along the direction of travel reads
           exactly as a snap to a longer shape at the moment of
           landing.

           That also explains why only rolling pieces showed it and the
           Cabeza never did: the Cabeza slides via lerpVectors on the
           rotation easing below, whose velocity decays to zero, and it
           has no residual at all. Only rolls carry one.

           smoothstep(t)^2 keeps the backloading exactly — it is 0.25
           at the midpoint, identical to t^2 — while its derivative at
           t=1 is 0, matching rotation's. Same distance, same
           destination, same duration, same late-weighting; the only
           thing that changes is that it decelerates into the landing
           instead of slamming into it. Any future curve here must
           satisfy f(0)=0, f(1)=1, and f'(1)=0. */
        const smoothstep = t * t * (3 - 2 * t);
        const residualE = smoothstep * smoothstep;

        if (a.kind === "roll") {
          a.pivot.setRotationFromAxisAngle(a.axis, a.angle * e);
          a.pivot.position.copy(a.base).addScaledVector(a.dirVec, a.residual * residualE);
        } else {
          /* Flat glide, no vertical arc — the Cabeza slides rather than
             rolls, so it has no physical reason to lift off the board. */
          a.carrier.position.lerpVectors(a.from, a.to, e);
        }

        if (t >= 1) {
          const done = a.onComplete;
          anim.current = null;
          done && done();
        }
      }

      /* Ghost (move-indicator) opacity fades — a fixed GHOST_FADE_MS
         transition toward whatever userData.opacityTo currently is,
         driven by the same clamped `now` used everywhere else in this
         loop. Both directions are handled the same way: appearing
         (opacityFrom 0 -> a hot/cold target) and disappearing
         (whatever it currently is -> 0), and re-targeting mid-fade
         (hover moving to a different direction before the previous
         target was ever reached) works for free, since this always
         re-reads elapsed time against opacityStart rather than
         assuming a fade runs to completion uninterrupted. A handful of
         objects at most (one per legal-move direction), so this is
         cheap even though it runs every frame. */
      if (ghostGroup) {
        for (let i = ghostGroup.children.length - 1; i >= 0; i--) {
          const c = ghostGroup.children[i];
          if (c.userData.kind !== "ghostLine") continue;
          const { opacityFrom, opacityTo, opacityStart, fadingOut } = c.userData;
          if (opacityStart === undefined) continue;
          const e = Math.min((now - opacityStart) / GHOST_FADE_MS, 1);
          c.material.opacity = opacityFrom + (opacityTo - opacityFrom) * e;
          if (fadingOut && e >= 1) {
            ghostGroup.remove(c);
            c.geometry && c.geometry.dispose();
            c.material && c.material.dispose();
          }
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  /* ------------------------ build pieces ------------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t.pieceGroup) return;
    if (anim.current) return; // mid-animation the moving mesh is live

    const group = t.pieceGroup;
    while (group.children.length) {
      const c = group.children.pop();
      c.geometry && c.geometry.dispose();
      c.material && c.material.dispose();
    }

    pieces.forEach((p) => {
      const meta = PIECE_META[p.type];
      const isDark = p.owner === "dark";
      const isDisc = meta.shape === "disc";
      const center = pieceCenter(p);
      const y = restingY(p);

      const geo = isDisc
        ? new THREE.CylinderGeometry(
            (DISC_DIAM * PIECE_SCALE) / 2,
            (DISC_DIAM * PIECE_SCALE) / 2,
            DISC_H * PIECE_SCALE,
            40
          )
        : makeRoundedBox(
            p.w * PIECE_SCALE,
            p.z * PIECE_SCALE,
            p.h * PIECE_SCALE,
            EDGE_RADIUS
          );

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
      mesh.userData = { pieceId: p.id, kind: "piece" };
      group.add(mesh);

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
            p.w * PIECE_SCALE + OUTLINE_T * 2,
            p.z * PIECE_SCALE + OUTLINE_T * 2,
            p.h * PIECE_SCALE + OUTLINE_T * 2,
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
      /* The shell casts, not just the mesh. The shell IS the piece's
         visible silhouette (it's the black outline), and it is
         OUTLINE_T larger on every side than the mesh. With only the
         mesh casting, the shadow's edge sat 0.016 world units inside
         the drawn outline, leaving a thin band of lit board between a
         piece and its own shadow. Constant in world space, so
         invisible at normal zoom and magnified into a visible bright
         line when zoomed in — and 2.5x larger than the residual
         normalBias gap, so it was the dominant term all along.
         Casting from the shell makes the shadow's silhouette match
         the outline the player actually sees. */
      shell.castShadow = true;
      /* y + OUTLINE_T, restored. This exactly fixes the shell
         penetrating the board at rest — its own growth is symmetric
         (OUTLINE_T added on every side), so centered at the mesh's own
         y it would sit exactly OUTLINE_T below the board; shifting up
         by that same amount puts its extra growth entirely above the
         piece, flush with y=0, with zero remaining gap. No depth-buffer
         approximation involved, so it doesn't degrade at any camera
         angle the way polygonOffset does.

         This WAS reverted once already, and it's worth being precise
         about why restoring it here doesn't reopen that: the earlier
         bug was that this same offset, carried through a roll's pivot
         rotation, no longer means "up" once the piece lands facing a
         new direction — a rigidity simulation confirmed the shell dips
         to -OUTLINE_T right at landing. But that dip lives entirely in
         the ANIMATED shell mid-roll, and this effect (the one setting
         the offset) is guarded against running while anim.current is
         set — it only ever builds the settled state. The instant a
         roll completes, this same effect discards whatever the
         animation was carrying and rebuilds a fresh shell from this
         exact math for the new orientation. So this offset never
         survives into a rotation; it only ever has to describe the
         piece's CURRENT, resting orientation, which is exactly the
         case it's correct for. The roll-time dip is real but brief —
         see the reduced polygonOffset on the slab's top material,
         which now only has to cover that transient, not carry the
         persistent at-rest case too. */
      shell.position.set(center.x, y + OUTLINE_T, center.z);
      shell.userData = { pieceId: p.id, kind: "shell" };
      group.add(shell);
    });
  }, [pieces]);

  /* ------------------------ build ghosts ------------------------- */
  /* A content signature for the current landing set. Rebuilding on
     entry count alone was both flickery and wrong: hovering a different
     piece with the same number of legal moves would have left stale
     footprints on the board. */
  const shadowSig = shadowEntries
    .map(([dir, m]) => {
      const c = m.candidate;
      return `${dir}:${c.row},${c.col},${c.w},${c.h},${c.z}${m.crushes ? "!" : ""}`;
    })
    .join("|");

  useEffect(() => {
    const t = three.current;
    if (!t.ghostGroup) return;

    const group = t.ghostGroup;
    /* Hit-planes (invisible raycast targets) are removed immediately,
       always — regardless of whether the visual line for the same
       direction is about to fade out below. They exist purely for
       picking, and a stale one left interactive during a fade would
       mean the board could still respond to clicking/hovering a target
       that no longer corresponds to the current selection or hover —
       exactly the class of bug this whole feature is fixing. */
    group.children
      .filter((c) => c.userData.kind === "ghost")
      .forEach((c) => {
        group.remove(c);
        c.geometry && c.geometry.dispose();
        c.material && c.material.dispose();
      });

    /* Existing ghostLines are never reused by matching `dir` across a
       shadowSig change — a "N" ghost for one piece and a "N" ghost for
       a different piece sit at entirely different candidate squares,
       so treating them as the same object would risk visibly snapping
       a line to a new position instead of cross-fading. Every existing
       line is retargeted to fade OUT here, unconditionally, and every
       entry below always creates a brand-new line to fade IN — a
       coincidental exact repeat would at worst cross-fade a line with
       an identical one sitting on top of it, which is invisible. */
    group.children
      .filter((c) => c.userData.kind === "ghostLine")
      .forEach((c) => setGhostLineTarget(c, 0, true));

    shadowEntries.forEach(([dir, move]) => {
      const cand = move.candidate;
      const isCrush = !!move.crushes;
      const cx = (cand.col + cand.w / 2) * SQUARE_SIZE - OFF;
      const cz = (cand.row + cand.h / 2) * SQUARE_SIZE - OFF;

      /* Invisible hit target. A dashed line is a poor raycast target —
         thin, and full of gaps — so picking is done against a plane
         that is present but draws nothing. */
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(
          cand.w * SQUARE_SIZE * GHOST_SCALE,
          cand.h * SQUARE_SIZE * GHOST_SCALE
        ),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      hit.rotation.x = -Math.PI / 2;
      hit.position.set(cx, 0.02, cz);
      hit.userData = { dir, kind: "ghost", isCrush };
      group.add(hit);

      /* Dashed outline. A filled patch competes with the pieces' own
         cast shadows; a dashed rule reads as notation instead. */
      const hx = (cand.w * SQUARE_SIZE * GHOST_SCALE) / 2;
      const hz = (cand.h * SQUARE_SIZE * GHOST_SCALE) / 2;
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

      const line = new THREE.LineSegments(
        geo,
        new THREE.LineDashedMaterial({
          color: HEX.charcoal,
          dashSize: isCrush ? 0.16 : 0.1,
          gapSize: isCrush ? 0.05 : 0.075,
          transparent: true,
          opacity: 0,
        })
      );
      line.computeLineDistances();
      line.position.set(cx, 0.025, cz);
      line.userData = { dir, kind: "ghostLine", isCrush };
      /* Starts invisible and is immediately targeted to fade up to its
         real (hot/cold) opacity — see the hover-emphasis effect just
         below, which computes that value the same way it always has.
         This is what makes a newly-hovered or newly-selected piece's
         indicators fade IN instead of appearing instantly. */
      setGhostLineTarget(line, isCrush ? 0.8 : 0.5, false);
      group.add(line);
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [shadowSig]);

  /* Hover emphasis retargets the fade rather than setting opacity
     directly — sliding between footprints must not re-create meshes,
     and must not pop straight to the new value either, now that this
     is animated. Skips any line already fading out (from the effect
     above): its target is 0 regardless of hover state, since it no
     longer belongs to the current selection/hover at all. */
  useEffect(() => {
    const t = three.current;
    if (!t.ghostGroup) return;
    t.ghostGroup.children.forEach((c) => {
      if (c.userData.kind !== "ghostLine" || c.userData.fadingOut) return;
      const isHot = c.userData.dir === hoverShadow;
      const target = c.userData.isCrush ? (isHot ? 1 : 0.8) : isHot ? 0.95 : 0.5;
      if (c.userData.opacityTo !== target) setGhostLineTarget(c, target, false);
    });
  }, [hoverShadow, shadowSig]);

  /* --------------------------- moves ----------------------------- */
  const makeEntry = useCallback(
    (piece, dirs, mark) => ({
      player: piece.owner,
      notation: `${PIECE_META[piece.type].label}: ${dirs.join(".")}`,
      mark: mark || "",
    }),
    []
  );

  const endTurn = useCallback((nextLog, turnEntry) => {
    if (turnEntry) setTurnHistory((prev) => [...prev, turnEntry]);
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    setCurrentPlayer((prev) => (prev === "dark" ? "light" : "dark"));
    if (nextLog) setLog(nextLog);
  }, []);

  /* A piece that rolls out and back — E then W, N then S, or a Cabeza
     stepping out and returning — lands on exactly the square and
     orientation it started the turn in. That's not a move, it's the
     turn's starting position with extra steps spent getting nowhere, so
     it doesn't get logged and the turn does not pass. Every OTHER
     two-step combination (same direction twice, or mixing row/col axes
     via a diagonal-ish corner turn) genuinely changes at least one of
     row/col/w/h/z, so this check only ever fires on a true round trip —
     see rollBlock: E followed by W is the one pairing that's a literal
     algebraic inverse of itself. sameState itself now lives at module
     scope, alongside the other pure rules functions — the AI's turn
     generator (below) needs the exact same definition of "not a move"
     that the game engine enforces here, not a second copy that could
     drift out of sync with it. */
  function settleTurn(currentPieceState, notation) {
    const origin = turnSnapshot && turnSnapshot.find((p) => p.id === currentPieceState.id);
    aiDirsRef.current = null; // whichever branch below runs, this turn is over
    if (origin && sameState(origin, currentPieceState)) {
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      return; // currentPlayer untouched, log untouched — as if this turn never happened
    }
    endTurn([...log, makeEntry(currentPieceState, notation)], {
      pieces: turnSnapshot || pieces,
      currentPlayer,
      log,
      status: "playing",
      winner: null,
      winReason: "",
      pieceId: currentPieceState.id,
      dirs: notation,
      crushedPiece: null,
    });
  }

  /* Commit runs after the animation lands, so board state and the
     rendered pose never disagree. */
  commitRef.current = (piece, dir, move) => {
    const notation = [...(piece.id === selectedId ? pendingNotation : []), dir];
    let nextPieces = pieces.map((p) => (p.id === piece.id ? move.candidate : p));

    if (move.crushes) {
      nextPieces = nextPieces.filter((p) => p.id !== move.crushes.id);
      setPieces(nextPieces);
      setLog([...log, makeEntry(piece, notation, "\u00d7")]);
      setTurnHistory((prev) => [
        ...prev,
        {
          pieces: turnSnapshot || pieces,
          currentPlayer,
          log,
          status: "playing",
          winner: null,
          winReason: "",
          pieceId: piece.id,
          dirs: notation,
          crushedPiece: move.crushes,
        },
      ]);
      setStatus("finished");
      setWinner(currentPlayer);
      setWinReason("Cabeza crushed");
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setBusy(false);
      aiDirsRef.current = null;
      return;
    }

    if (piece.type === "cabeza" && move.candidate.row === GOAL_ROW[piece.owner]) {
      setPieces(nextPieces);
      setLog([...log, makeEntry(piece, notation, "\u2726")]);
      setTurnHistory((prev) => [
        ...prev,
        {
          pieces: turnSnapshot || pieces,
          currentPlayer,
          log,
          status: "playing",
          winner: null,
          winReason: "",
          pieceId: piece.id,
          dirs: notation,
          crushedPiece: null,
        },
      ]);
      setStatus("finished");
      setWinner(currentPlayer);
      setWinReason("Cabeza reached the far edge");
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setBusy(false);
      aiDirsRef.current = null;
      return;
    }

    setPieces(nextPieces);
    setTurnSnapshot(turnSnapshot || pieces);
    setPendingNotation(notation);
    setHoverShadow(null);

    const used = (piece.id === selectedId ? stepsUsed : 0) + 1;
    const stillHasMoves = Object.keys(legalMovesFor(nextPieces, move.candidate)).length > 0;

    if (used >= PIECE_META[piece.type].maxSteps || !stillHasMoves) {
      settleTurn(move.candidate, notation);
    } else {
      setSelectedId(piece.id);
      setHoveredId(piece.id);
      setStepsUsed(used);
    }
    setBusy(false);
  };

  /* Animates one step from an explicit piece state. Kept separate from
     the rules so it can drive playback in either direction — forward for
     a move, inverted for an undo. On completion the parts are re-attached
     to the piece group with their world pose preserved, which is what
     lets steps be chained without a rebuild in between. */
  const animateStep = useCallback((state, dir, onDone) => {
    const t = three.current;
    const parts = t.pieceGroup.children.filter((c) => c.userData.pieceId === state.id);
    if (!parts.length) {
      onDone();
      return;
    }

    /* Reparented onto boardGroup, not scene: the temporary pivot/carrier
       must inherit the board's current rotation, or a piece mid-animation
       while the board is spun to some heading would ignore that heading
       entirely and animate as if the board were still at zero. attach()
       in bake() already accounts for whatever transform boardGroup has
       at completion time, since attach() preserves world pose across a
       reparent regardless of the new parent's transform.

       A later attempt tried explicitly snapping each part's rotation to
       (0,0,0) and position to freshly-computed values here, reasoning
       it would eliminate tiny floating-point drift from attach()'s
       matrix math. That was wrong, and visibly so: the mesh's actual
       geometry isn't rebuilt with the piece's new, post-roll dimensions
       until the next "build pieces" React cycle runs — the 90° pivot
       rotation IS the mechanism making the old, still-unswapped-
       dimension geometry visually read as the new orientation in the
       meantime. Zeroing that rotation stripped away the only thing
       making the shape correct, leaving a piece that looked flattened
       — a real, confirmed regression, reverted outright. Whatever is
       causing the edge-flash-near-landing artifact this was trying to
       fix, it isn't this. */
    const bake = (carrier) => {
      carrier.updateMatrixWorld(true);
      parts.forEach((c) => t.pieceGroup.attach(c));
      t.boardGroup.remove(carrier);
      onDone();
    };

    if (PIECE_META[state.type].shape === "disc") {
      const [dr, dc] = STEP_DIRS[dir];
      const from = pieceCenter(state);
      const to = pieceCenter({ ...state, row: state.row + dr, col: state.col + dc });
      const fromVec = new THREE.Vector3(from.x, 0, from.z);

      const carrier = new THREE.Object3D();
      carrier.position.copy(fromVec);
      t.boardGroup.add(carrier);
      parts.forEach((c) => {
        c.position.sub(fromVec);
        carrier.add(c);
      });

      anim.current = {
        kind: "slide",
        carrier,
        from: fromVec.clone(),
        to: new THREE.Vector3(to.x, 0, to.z),
        elapsed: 0,
        duration: SLIDE_MS,
        onComplete: () => bake(carrier),
      };
      return;
    }

    const pv = pivotFor(state, dir);
    const pivot = new THREE.Object3D();
    pivot.position.copy(pv.point);
    t.boardGroup.add(pivot);
    parts.forEach((c) => {
      if (c.userData.kind === "shell") {
        /* Strip the at-rest +OUTLINE_T offset before this shell enters
           the roll. That offset is correct for a piece sitting still
           (see build-pieces, shell.position.set) — but this object
           already carries it from the moment the previous "build
           pieces" pass created it, and reparenting onto the pivot
           below would rotate that offset along with the piece for the
           whole animation. A rigidity simulation of this exact pivot
           math already proved what that does: the shell dips as far as
           -OUTLINE_T below the board, worse the closer the animation
           gets to landing — the original edge-flash bug this offset
           was reverted for once before. Restoring the offset at rest
           didn't reintroduce that bug at the FINAL frame (the shell is
           always discarded and rebuilt fresh once a roll completes),
           but it does reappear DURING the roll, since animateStep
           picks up whatever offset the shell already has at the
           moment the roll starts. Subtracting it here makes the shell
           enter the rotation symmetric — matching the mesh, safe
           through any rotation — and "build pieces" gives it back the
           correct offset fresh once this roll ends and rebuilds at
           rest. */
        c.position.y -= OUTLINE_T;
      }
      c.position.sub(pv.point);
      pivot.add(c);
    });

    anim.current = {
      kind: "roll",
      pivot,
      base: pv.point.clone(),
      dirVec: pv.dirVec,
      residual: pv.residual,
      axis: pv.axis,
      angle: pv.angle,
      elapsed: 0,
      duration: ROLL_MS,
      onComplete: () => bake(pivot),
    };
  }, []);

  const beginMove = useCallback(
    (piece, dir) => {
      if (!piece || anim.current || busy) return;
      const move = legalMovesFor(pieces, piece)[dir];
      if (!move) return;

      const t = three.current;
      setBusy(true);
      while (t.ghostGroup.children.length) t.ghostGroup.children.pop();

      animateStep(piece, dir, () => commitRef.current(piece, dir, move));
    },
    [pieces, busy, animateStep]
  );
  beginMoveRef.current = beginMove;

  /* Drives the AI's entire turn from the outside, without commitRef.current
     needing to know AI exists at all. Two situations, both handled by
     the same effect since they share every guard:

     1. It just became the AI's turn (stepsUsed === 0, nothing queued):
        run the search, remember the whole chosen turn, and kick off its
        first step through the exact same beginMove a click would use.

     2. A step the AI already started just finished animating and the
        engine left the turn open (stepsUsed > 0, something queued):
        either continue to the AI's next queued direction, or — if the
        AI's plan only called for what's already been played, even
        though a second step is physically available — end the turn
        right there, the same way a human pressing "Stop here" would.

     Both branches defer through setTimeout + beginMoveRef/settleTurn
     rather than acting immediately: busy is still true from the step
     that just committed (state updates aren't visible synchronously
     within the same callback that triggered them), so calling beginMove
     directly here would hit its own guard and silently do nothing. The
     delay also happens to be exactly what keeps the AI's moves from
     feeling instant and robotic. */
  useEffect(() => {
    if (!isPlaying || busy || anim.current || currentPlayer !== aiPlayer || awaitingBegin) return;

    if (stepsUsed === 0 && !aiDirsRef.current) {
      setAiThinking(true);
      const timer = setTimeout(() => {
        const turn = findBestAiTurn(
          pieces,
          aiPlayer,
          AI_DIFFICULTY[aiDifficulty],
          aiCabezaStreakRef.current,
          log.length // turns played so far — drives the opening jitter boost
        );
        setAiThinking(false);
        if (!turn) return; // no legal turn at all — shouldn't normally happen
        aiDirsRef.current = turn;
        const piece = pieces.find((p) => p.id === turn.pieceId);
        if (piece) {
          aiCabezaStreakRef.current = piece.type === "cabeza" ? aiCabezaStreakRef.current + 1 : 0;
          beginMoveRef.current(piece, turn.dirs[0]);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    if (stepsUsed > 0 && aiDirsRef.current) {
      const { pieceId, dirs } = aiDirsRef.current;
      if (stepsUsed < dirs.length) {
        const timer = setTimeout(() => {
          const piece = pieces.find((p) => p.id === pieceId);
          if (piece) beginMoveRef.current(piece, dirs[stepsUsed]);
        }, 500);
        return () => clearTimeout(timer);
      }
      const piece = pieces.find((p) => p.id === pieceId);
      aiDirsRef.current = null;
      if (piece) settleTurn(piece, pendingNotation);
    }
  }, [currentPlayer, aiPlayer, isPlaying, busy, stepsUsed, pieces, aiDifficulty, pendingNotation, awaitingBegin, log]);

  /* --------------------------- input ----------------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t.renderer) return;
    const el = t.renderer.domElement;

    /* One input model. Touch fires BOTH pointer and touch events, so
       handling pinch on touchmove while rotate ran on pointermove meant
       a two-finger gesture rotated and zoomed at once from conflicting
       deltas — the artifacting. Tracking live pointers here makes the
       two gestures mutually exclusive. */
    const active = new Map();
    let dragging = false;
    /* Stays false until cumulative pointer travel since the down event
       crosses DRAG_DEAD_ZONE_PX — see onMove. Every touch carries a few
       pixels of contact-point jitter even when the finger is meant to be
       held still, and without a dead zone that jitter was reaching
       cam.current directly, so the board visibly rotated on almost every
       tap. Below the threshold, moves are tracked (moved still
       accumulates, for wasDrag below) but never reach the camera at all. */
    let dragArmed = false;
    /* Latched at pointerdown when Option/Alt is held, and held for the
       whole gesture rather than re-read on every move. Re-reading would
       let the mode flip mid-drag if the key were released, which reads
       as the board jumping between panning and rotating. Latching means
       a gesture is decided the moment it starts and stays that way
       until release, which is what makes it feel predictable. */
    let altPanning = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let pinchDist = 0;
    let panAnchor = null;

    function pick(ev, opts = {}) {
      const rect = el.getBoundingClientRect();
      t.pointer.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      t.raycaster.setFromCamera(t.pointer, t.camera);

      const ghostHits = t.raycaster.intersectObjects(
        t.ghostGroup.children.filter((c) => c.userData.kind === "ghost"),
        false
      );
      const pieceHits = t.raycaster.intersectObjects(
        t.pieceGroup.children.filter((c) => c.userData.kind === "piece"),
        false
      );
      const nearestGhost = ghostHits[0];
      const nearestPiece = pieceHits[0];

      /* opts.respectDepth is for HOVER only (see onMove) — whichever
         hit is genuinely nearer the camera wins, instead of a ghost
         always taking priority regardless of what's actually on top.
         That's what makes a previously-hovered piece's ghosts
         correctly clear the instant the cursor is actually over
         something else, including a crush target sitting right on the
         ghost's own square.

         The default (used by CLICK, below) deliberately keeps the
         older "ghost always wins" behavior instead. A ghost's
         hit-plane sits almost exactly on its candidate square
         (GHOST_SCALE = 0.94), and for a crush move that square is
         occupied by the piece about to be crushed — clicking directly
         on that piece is the natural way to confirm "crush this one",
         and it has to keep registering as hitting the ghost and
         executing the move, not as trying to select an enemy piece and
         silently doing nothing. Depth-correctness fixes a hover bug;
         it would break this if applied to clicking too. */
      if (opts.respectDepth) {
        if (nearestGhost && (!nearestPiece || nearestGhost.distance < nearestPiece.distance)) {
          return { type: "ghost", dir: nearestGhost.object.userData.dir };
        }
        if (nearestPiece) return { type: "piece", id: nearestPiece.object.userData.pieceId };
        return null;
      }

      if (nearestGhost) return { type: "ghost", dir: nearestGhost.object.userData.dir };
      if (nearestPiece) return { type: "piece", id: nearestPiece.object.userData.pieceId };
      return null;
    }

    function pinchSpan() {
      const pts = [...active.values()];
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    function pinchMid() {
      const pts = [...active.values()];
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }

    /* Translates the orbit target across the camera's own screen plane,
       so two fingers moving together (rather than apart) slide the whole
       board rather than rotating or zooming it. Distance scales with how
       far the camera already is, so panning feels the same whether
       zoomed in tight or pulled back. */
    /* Reads the camera's own matrix, not the board's — correct as-is
       even with a spinning board, since the camera (unlike boardGroup)
       never rotates with heading anymore. Panning always shifts the
       fixed viewer's own screen-relative aim point, independent of
       whatever heading the board currently happens to be at. */
    function panBy(dxPx, dyPx) {
      const { camera } = t;
      const dist =
        cam.current.radius * Math.tan((camera.fov / 2) * (Math.PI / 180));
      const scale = (2 * dist) / el.clientHeight;

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);

      cam.current.target
        .addScaledVector(right, -dxPx * scale)
        .addScaledVector(up, dyPx * scale);
    }

    function onDown(ev) {
      active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      el.setPointerCapture && el.setPointerCapture(ev.pointerId);

      if (active.size === 1) {
        dragging = true;
        dragArmed = false;
        /* pointerType check is belt-and-braces: a touch contact won't
           carry altKey anyway, so excluding it here simply guarantees
           the touch paths below are reached in exactly the same states
           they were before this existed.

           Right-click (button 2) is a second, independent trigger for
           the exact same pan mode as Alt+left-click — both are decided
           right here, once, at the start of the gesture, into the same
           boolean. Nothing downstream (onMove's pan branch, onUp's
           click suppression, onCancel's cleanup) re-derives this from
           ev.altKey or ev.button again; they only ever read the
           latched value, so extending what sets it to true is the only
           change this needs — the rest of the pan behavior (including
           bypassing the drag dead zone in onMove) is inherited for
           free, identically to how Alt-drag already works. */
        altPanning = (!!ev.altKey || ev.button === 2) && ev.pointerType !== "touch";
        moved = 0;
        lastX = ev.clientX;
        lastY = ev.clientY;
        el.style.cursor = "grabbing";
      } else {
        /* A second finger cancels the rotate outright rather than
           blending into it. */
        dragging = false;
        altPanning = false;
        pinchDist = active.size === 2 ? pinchSpan() : 0;
        panAnchor = active.size === 2 ? pinchMid() : null;
      }
    }

    function onMove(ev) {
      if (active.has(ev.pointerId)) {
        active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }

      if (active.size >= 2) {
        if (active.size === 2) {
          const d = pinchSpan();
          if (pinchDist && d > 0) {
            cam.current.radius = Math.max(
              ZOOM_MIN,
              Math.min(ZOOM_MAX, cam.current.radius * (pinchDist / d))
            );
          }
          pinchDist = d;

          const mid = pinchMid();
          if (panAnchor) {
            panBy(mid.x - panAnchor.x, mid.y - panAnchor.y);
          }
          panAnchor = mid;
        }
        return;
      }

      if (dragging) {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        lastX = ev.clientX;
        lastY = ev.clientY;

        if (altPanning) {
          /* Same panBy the two-finger touch gesture uses, with the raw
             deltas passed through identically, so a mouse pan and a
             touch pan move the board the same distance in the same
             direction — the board follows the pointer. It writes to
             cam.current.target, the damped GOAL, so this inherits the
             render loop's existing easing and the pan feels like every
             other camera move rather than a separate mechanism.

             Intentionally ahead of the dragArmed dead zone below: that
             threshold exists to reject contact-point jitter from a
             finger meant to be held still, which cannot apply to a
             deliberate modifier-held mouse drag. Skipping it means the
             board tracks the cursor from the very first pixel of
             movement instead of swallowing the first ~10px. `moved`
             still accumulates, so the release path below still sees
             this as a drag and suppresses the click.

             Rotation (theta/phi) is never touched on this branch, and
             zoom/radius is not referenced at all, so a pan cannot
             disturb either. */
          panBy(dx, dy);
          return;
        }

        if (!dragArmed) {
          // Still inside the dead zone — this is contact-point jitter
          // from a held-still touch, not an intentional drag, so it
          // never reaches the camera. The first move that finally
          // crosses the threshold is swallowed too rather than applied
          // as a catch-up jump; rotation starts cleanly from wherever
          // the finger is the moment it's actually dragging.
          if (moved > DRAG_DEAD_ZONE_PX) dragArmed = true;
          return;
        }
        /* These only move the GOAL (cam.current); the render loop damps
           the actual view toward it every frame, which is what removes
           the raw, sample-for-sample twitchiness a direct 1:1 mapping had.
           theta here still uses the same sign it always did — dragging
           right still decreases it. What changed is downstream, in
           applyCamera: theta used to swing the camera around the board,
           now it spins the board itself (with a sign flip there), which
           is what reproduces the identical drag-right-feels-right
           direction players already learned, just via a fixed camera and
           a turning board instead of the other way around. */
        cam.current.theta -= dx * ORBIT_SENS_THETA;
        /* Lower bound is a hair above zero rather than zero itself: at
           exactly vertical the view direction is parallel to the camera's
           up vector and lookAt has no defined roll, which snaps the view. */
        cam.current.phi = Math.max(
          0.012,
          Math.min(1.45, cam.current.phi - dy * ORBIT_SENS_PHI)
        );
        return;
      }

      if (busy || !isPlaying || currentPlayer === aiPlayer || awaitingBegin) return;
      const hit = pick(ev, { respectDepth: true });
      if (hit && hit.type === "ghost") {
        el.style.cursor = "pointer";
        setHoverShadow((prev) => (prev === hit.dir ? prev : hit.dir));
        /* This was the actual bug: hitting a ghost returned here
           without ever touching hoveredId, so whatever piece was
           hovered before stayed hovered — and its whole preview stayed
           visible — for as long as the cursor remained anywhere inside
           that ghost's hit-plane, including areas the piece's own body
           doesn't cover. The fix isn't which hit wins (that's what
           respectDepth above already addresses, for when a DIFFERENT
           piece occludes a ghost) — it's that touching a ghost at all,
           on its own, was never a reason to keep hoveredId as it was.
           Only literal, direct contact with a piece's own mesh should
           keep its preview alive; leaving the piece for ANYTHING else
           — a different piece, empty board, or the piece's own ghost
           tiles — clears it, matching "leaving the piece, at all,
           should make the indicators disappear" exactly. Harmless to
           apply unconditionally (not just when nothing is selected):
           once a piece IS selected, hoveredId no longer affects what's
           shown at all, since selectedPiece already takes priority —
           see activePiece — so clearing it here has no visible effect
           in that case either way. */
        if (!turnLocked) setHoveredId((prev) => (prev === null ? prev : null));
        return;
      }
      setHoverShadow((prev) => (prev === null ? prev : null));

      if (hit && hit.type === "piece") {
        const p = pieces.find((x) => x.id === hit.id);
        const hoverable = !turnLocked && p && p.owner === currentPlayer;
        el.style.cursor = hoverable ? "pointer" : "grab";
        /* Resolves to the correct target every time a piece is hit —
           this piece if it's hoverable, otherwise null — rather than
           only ever setting hoveredId and silently leaving a stale
           value in place the rest of the time. That gap is what let a
           previously-hovered piece's ghosts keep showing after the
           mouse moved onto some other, non-hoverable piece. Guarded on
           !turnLocked to match the no-hit fallback below: once a piece
           is actually selected, hoveredId no longer affects what's
           shown (selectedPiece already takes priority — see
           activePiece), so there's nothing to correct while locked. */
        if (!turnLocked) {
          setHoveredId((prev) => {
            const next = hoverable ? p.id : null;
            return prev === next ? prev : next;
          });
        }
        return;
      }

      el.style.cursor = "grab";
      if (!turnLocked) setHoveredId((prev) => (prev === null ? prev : null));
    }

    function onUp(ev) {
      const wasMulti = active.size >= 2;
      const wasAltPan = altPanning;
      active.delete(ev.pointerId);
      el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
      el.style.cursor = "grab";

      /* Lifting one finger of a pinch must not resume a rotate from a
         stale anchor — that produced a jump. */
      if (active.size < 2) {
        pinchDist = 0;
        panAnchor = null;
      }
      if (active.size === 0) {
        dragging = false;
        altPanning = false;
      }
      if (wasMulti) return;

      const wasDrag = moved > DRAG_DEAD_ZONE_PX;
      dragging = false;
      /* wasAltPan is checked explicitly rather than leaning on wasDrag:
         a deliberate but very short pan can finish under the movement
         threshold, and without this it would fall through and
         select/deselect a piece on release. An Option/Alt drag is never
         a click. */
      if (wasAltPan || wasDrag || busy || !isPlaying || currentPlayer === aiPlayer || awaitingBegin) return;

      const hit = pick(ev);
      if (hit && hit.type === "ghost" && activePiece) {
        beginMove(activePiece, hit.dir);
      } else if (hit && hit.type === "piece" && !turnLocked) {
        const p = pieces.find((x) => x.id === hit.id);
        if (p && p.owner === currentPlayer) {
          setSelectedId((prev) => (prev === p.id ? null : p.id));
        }
      } else if (!hit && !turnLocked) {
        setSelectedId(null);
      }
    }

    function onCancel(ev) {
      active.delete(ev.pointerId);
      if (active.size < 2) {
        pinchDist = 0;
        panAnchor = null;
      }
      if (active.size === 0) {
        dragging = false;
        altPanning = false; // an interrupted gesture must not leave the board latched in pan mode
      }
      el.style.cursor = "grab";
    }

    function onWheel(ev) {
      ev.preventDefault();
      cam.current.radius = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, cam.current.radius + ev.deltaY * 0.014)
      );
    }

    /* Right-click is now a pan trigger (see onDown), so the browser's
       native context menu must never appear on this element at all —
       unconditionally, not just while a drag is in progress. preventDefault()
       on the contextmenu event itself is the standard, sufficient way
       to suppress it; it doesn't depend on which mouse button pattern
       or platform triggered the menu. */
    function onContextMenu(ev) {
      ev.preventDefault();
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [pieces, currentPlayer, turnLocked, activePiece, busy, isPlaying, beginMove, aiPlayer, awaitingBegin]);

  /* --------------------------- actions --------------------------- */
  /* With the standalone rotate buttons gone, this is the only reset
     affordance left, so it clears everything a drag or pinch could have
     changed: heading, pitch, distance, and any pan offset. */
  /* Snaps the pan target to board-center on both the input goal and the
     rendered view, bypassing the usual damping. Centering is a
     correction, not a camera move — it should be true the instant the
     button is pressed, not something that eases into place over the
     next few frames while a prior pan is still visibly off-center. */
  function snapToCenter() {
    cam.current.target.set(0, 0, 0);
    cam.current.view.target.set(0, 0, 0);
  }

  function recenterView() {
    /* Pitch and distance are still camera moves. Heading (theta) is now
       applied to the board's own rotation instead of the camera's orbit
       — see applyCamera — so setting it here spins the board to bring
       the current player's home edge toward the fixed viewer, rather
       than swinging the viewer around a fixed board. Either way, all
       three still glide through the render loop's damping; only
       centering (snapToCenter) is instant. */
    cam.current.theta = currentPlayer === "dark" ? Math.PI : 0;
    cam.current.phi = 0.86;
    cam.current.radius = 17;
    snapToCenter();
  }

  function topDownView(facePlayer = currentPlayer) {
    /* Same heading rule as Current Player View: snap to whichever of the
       two canonical facings — Dark-top/Light-bottom (0) or
       Light-top/Dark-bottom (π) — puts facePlayer's own edge toward the
       fixed viewer, never some arbitrary in-between angle left over
       from free dragging. Defaults to currentPlayer for the button's
       own click handler (unchanged behavior there), but takes an
       explicit override for handleReset: currentPlayer there is still
       the PREVIOUS game's value the instant this runs — setCurrentPlayer
       is async, so reading the closure directly would target whichever
       side finished last game, not whichever side (humanStartSide) the
       fresh one is actually about to start with. The render loop's
       existing shortest-path wrapping (see tick()) still animates the
       turn via whichever direction is shorter, so this never spins
       further than it has to to reach the correct side. Pitch and zoom
       are what actually distinguish this button from Current Player
       View. */
    cam.current.theta = facePlayer === "dark" ? Math.PI : 0;
    cam.current.phi = 0.012; // matches the drag clamp's near-vertical limit
    /* Zoom convention: 0% = fully zoomed out (ZOOM_MAX, farthest), 100% =
       fully zoomed in (ZOOM_MIN, closest) — the same direction "zoom" has
       in a photo viewer or a map, where a higher percentage means bigger
       and closer. 70% sits 70% of the way from MAX down to MIN. */
    const ZOOM_PCT = 0.7;
    cam.current.radius = ZOOM_MAX - ZOOM_PCT * (ZOOM_MAX - ZOOM_MIN);
    snapToCenter();
  }

  function handleStopHere() {
    // Guards the human-facing entry point only — the AI's own orchestration
    // effect calls settleTurn directly, bypassing this, so its own
    // deliberate "stop after one step" still works during its turn.
    // busy/anim.current guard added to match handleUndoTurn right below —
    // without it, this button is visible and clickable during the SECOND
    // roll of a two-step turn (stepsUsed > 0 by then), and clicking it
    // ends the turn while that roll's own animation is still in flight,
    // before its own commit logic has had a chance to run.
    if (!selectedPiece || stepsUsed === 0 || busy || anim.current || currentPlayer === aiPlayer || awaitingBegin) return;
    settleTurn(selectedPiece, pendingNotation);
  }
  function handleUndoTurn() {
    if (!turnSnapshot || busy || anim.current || currentPlayer === aiPlayer || awaitingBegin) return;

    const restore = () => {
      setPieces(turnSnapshot);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setBusy(false);
    };

    const moving = pieces.find((p) => p.id === selectedId);
    if (!moving || pendingNotation.length === 0) {
      restore();
      return;
    }

    const t = three.current;
    setBusy(true);
    while (t.ghostGroup.children.length) t.ghostGroup.children.pop();
    setHoverShadow(null);

    /* Walk the turn backwards, inverting each recorded direction. */
    const steps = [...pendingNotation].reverse().map((d) => INVERSE_DIR[d]);

    const run = (i, state) => {
      if (i >= steps.length) {
        restore();
        return;
      }
      const dir = steps[i];
      animateStep(state, dir, () => {
        const next =
          PIECE_META[state.type].shape === "disc"
            ? {
                ...state,
                row: state.row + STEP_DIRS[dir][0],
                col: state.col + STEP_DIRS[dir][1],
              }
            : rollBlock(state, dir);
        run(i + 1, next);
      });
    };

    run(0, moving);
  }
  function handleUndoLastTurn() {
    if (turnHistory.length === 0 || busy || aiThinking || turnLocked || anim.current || awaitingBegin) return;

    /* Collect the batch of entries to undo, most recent first. Against
       an AI opponent, keep walking past any entry the AI itself played
       — the point of this button is recovering from the HUMAN's own
       careless move, and landing on "it's the AI's turn again" without
       having touched the human's actual last decision wouldn't do
       that; it would just hand the human a turn they didn't ask to
       take back. Walking further back until an entry the human
       actually played is found means one click always lands at a
       point where it's genuinely the human's turn to decide again.
       Against a Human opponent (aiPlayer === null) every entry already
       satisfies this on the first check, so this reduces to a plain
       single-turn undo — there's no one to skip past. */
    const stack = [...turnHistory];
    const batch = [];
    while (stack.length > 0) {
      const entry = stack.pop();
      batch.push(entry);
      if (aiPlayer === null || entry.currentPlayer !== aiPlayer) break;
    }
    if (batch.length === 0) return;
    const target = batch[batch.length - 1]; // oldest entry in the batch — final restore target

    const t = three.current;
    setBusy(true);
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    while (t.ghostGroup.children.length) t.ghostGroup.children.pop();

    const finish = () => {
      setPieces(target.pieces);
      setCurrentPlayer(target.currentPlayer);
      setLog(target.log);
      setStatus(target.status);
      setWinner(target.winner);
      setWinReason(target.winReason);
      setShowVictoryPlacard(false); // only ever auto-shown on finish, never auto-hidden
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      aiDirsRef.current = null;
      setTurnHistory(stack); // whatever's left once the whole batch is removed
      setBusy(false);
    };

    /* Processes one batch entry's turn backward, then recurses to the
       next (older) one. workingPieces is threaded through explicitly,
       same reasoning as handleUndoTurn's run() above: mid-chain state
       updates exist to keep the THREE.js scene in sync via the
       "build pieces" effect, never to be read back as the source of
       truth for what happens next. */
    const processEntry = (idx, workingPieces) => {
      if (idx >= batch.length) {
        finish();
        return;
      }
      const entry = batch[idx];
      const steps = [...entry.dirs].reverse().map((d) => INVERSE_DIR[d]);

      const animateBack = (basePieces) => {
        const moving = basePieces.find((p) => p.id === entry.pieceId);
        if (!moving) {
          // Should not happen for a well-formed history, but fail soft
          // rather than throw if it ever does.
          processEntry(idx + 1, basePieces);
          return;
        }
        const runStep = (i, state) => {
          if (i >= steps.length) {
            processEntry(idx + 1, basePieces.map((p) => (p.id === state.id ? state : p)));
            return;
          }
          const dir = steps[i];
          animateStep(state, dir, () => {
            const next =
              PIECE_META[state.type].shape === "disc"
                ? { ...state, row: state.row + STEP_DIRS[dir][0], col: state.col + STEP_DIRS[dir][1] }
                : rollBlock(state, dir);
            runStep(i + 1, next);
          });
        };
        runStep(0, moving);
      };

      if (entry.crushedPiece) {
        /* The crushed piece's mesh was disposed the moment "build
           pieces" last ran without it — animateStep can't roll a piece
           back that has no mesh to find (see its own !parts.length
           guard, which would silently no-op). Add it back to React
           state first and let that same effect rebuild it, THEN
           animate the crushing piece's own reversal. The short delay
           is the same deferred-continuation pattern the AI
           orchestration effect already uses elsewhere in this file —
           a state update from synchronous code is reliably flushed
           and rendered before a setTimeout callback fires, so the
           rebuild is done well before this continues. */
        const withResurrected = [...workingPieces, entry.crushedPiece];
        setPieces(withResurrected);
        setTimeout(() => animateBack(withResurrected), 60);
      } else {
        animateBack(workingPieces);
      }
    };

    processEntry(0, pieces);
  }
  function handleReset() {
    /* If a roll or slide is mid-flight, force it to a clean stop before
       anything else. Without this: anim.current stays set through the
       setPieces call below, so the "build pieces" effect's own guard
       (mid-animation the moving mesh is live) skips its rebuild — but
       the interrupted animation is still running and will still reach
       its own completion callback moments later, which then calls
       commitRef.current using piece/move references captured back when
       THIS move began, before the reset. That splices one leftover
       piece, at a stale position, into what should have been a clean
       fresh board — not merely a visual gap, but New Game silently not
       actually resetting everything it claims to. Tearing the carrier
       down directly here (rather than just blocking the click) is what
       keeps New Game working as an immediate escape hatch regardless of
       what's happening on the board the instant it's pressed. */
    if (anim.current) {
      const t = three.current;
      const carrier = anim.current.pivot || anim.current.carrier;
      if (carrier && t.boardGroup) {
        carrier.children.forEach((c) => {
          c.geometry && c.geometry.dispose();
          c.material && c.material.dispose();
        });
        t.boardGroup.remove(carrier);
      }
      anim.current = null;
    }
    setPieces(createInitialPieces());
    setCurrentPlayer(humanStartSide); // New Game always lands in Human mode, so this is always the relevant preference
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    setTurnHistory([]);
    setLog([]);
    setStatus("playing");
    setWinner(null);
    setWinReason("");
    setShowVictoryPlacard(false);
    setLogCopied(false);
    setLogCopyFailed(false);
    aiDirsRef.current = null;
    aiCabezaStreakRef.current = 0;
    setAiThinking(false);
    setAiPlayer(null); // New Game always starts back at Human vs Human
    setGameArmed(false); // every fresh game — Human included — now waits on Begin Game
    resetTransitionUntilRef.current = performance.now() + RESET_TRANSITION_MS;
    topDownView(humanStartSide); // same camera reset as Top-Down View, but eased slower and facing the side about to actually move first
  }

  /* Plain-text export of the move log, for copying out of the game
     entirely — e.g. pasting a completed game elsewhere for analysis.
     Reuses pairLog exactly as the display table does, so the exported
     text and what's on screen can never drift apart into two separate
     formats. Deliberately simple (one line per turn, minimal
     punctuation) rather than a structured format — nothing currently
     reads this back into the game, so there's no parser to satisfy,
     just a person or a paste target reading plain lines. */
  function handleCopyLog() {
    const rows = pairLog(log);
    const lines = rows.map((row) => {
      const dark = row.dark ? `${row.dark.notation}${row.dark.mark ? " " + row.dark.mark : ""}` : "\u2014";
      const light = row.light ? `${row.light.notation}${row.light.mark ? " " + row.light.mark : ""}` : "\u2014";
      return `${row.n}. Dark: ${dark} | Light: ${light}`;
    });
    const summary =
      status === "finished" && winner
        ? `Result: ${winner === "dark" ? "Dark" : "Light"} wins${winReason ? " \u2014 " + winReason : ""}`
        : status === "ended"
        ? "Game ended manually, no winner"
        : "";
    const text = [summary, "", ...lines].join("\n");

    function announce(ok) {
      if (ok) {
        setLogCopied(true);
        setTimeout(() => setLogCopied(false), 2000);
      } else {
        setLogCopyFailed(true);
        setTimeout(() => setLogCopyFailed(false), 2500);
      }
    }

    /* execCommand("copy") fallback. Deprecated, but deliberately kept:
       it works by selecting real DOM text and asking the browser to
       copy the current selection, which generally only needs a user
       gesture — it doesn't depend on the clipboard-write permissions
       policy the modern async API requires, which is exactly the grant
       a sandboxed embed (this artifact's own iframe) may not have. */
    function fallbackCopy() {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    /* The actual bug that made this button do nothing: navigator.clipboard
       can be undefined entirely in a sandboxed iframe (which is how this
       artifact runs) if clipboard-write isn't granted by the host's
       permissions policy — not merely reject, but be missing outright.
       Accessing .writeText on undefined throws SYNCHRONOUSLY, before any
       Promise exists, so a .catch() on the end of the chain never runs;
       the throw happens before that chain is even built. This whole
       attempt needs its own try/catch to see that failure at all, which
       the previous version didn't have. */
    try {
      navigator.clipboard.writeText(text).then(
        () => announce(true),
        () => announce(fallbackCopy())
      );
    } catch (e) {
      announce(fallbackCopy());
    }
  }

  /* Distinct from handleReset on purpose: this stops the game — no
     further moves, matching the same isPlaying gate every other
     interaction guard already checks — WITHOUT wiping pieces, the
     move log, or the opponent/difficulty settings. The board stays
     exactly as it stood, and status:"ended" is what brings the
     Opponent row and Record section back (see declutter, which keys
     off isPlaying and doesn't care which non-"playing" state this is)
     so the game just played is still there to review. Only actually
     pressing Reset Game (handleReset, unchanged) clears any of that.
     Guarded the same way Stop Here / Undo Turn already are — a click
     mid-animation is simply ignored rather than freezing a half-rolled
     piece. */
  function handleEndActiveGame() {
    if (!isPlaying || busy || anim.current) return;
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    // A pending AI "thinking" timer gets cleared automatically once
    // isPlaying flips (its own effect's cleanup handles that — see the
    // orchestration effect), but the timer never gets to run its own
    // setAiThinking(false) when that happens, so it's cleared here
    // explicitly to avoid a stuck "(AI) thinking…" status.
    setAiThinking(false);
    aiDirsRef.current = null;
    setStatus("ended");
  }

  const statusText = status === "finished"
    ? `${winner === "dark" ? "Dark" : "Light"} wins \u00b7 ${winReason}`
    : status === "ended"
    ? "Game ended"
    : aiThinking
    ? `${currentPlayer === "dark" ? "Dark" : "Light"} (AI) thinking\u2026`
    : activePiece && activePiece.owner === currentPlayer
    ? `${PIECE_META[activePiece.type].name} \u00b7 ${stepsRemaining} ${
        activePiece.type === "cabeza" ? "step" : "roll"
      }${stepsRemaining === 1 ? "" : "s"} left`
    : currentPlayer === "dark"
    ? "Dark to move"
    : "Light to move";

  return (
    <div
      style={{
        /* dvh, not vh: accounts for mobile browsers showing/hiding
           their own address-bar chrome dynamically, so this is always
           the actual visible height, not occasionally too tall (vh on
           iOS Safari famously counts space the address bar is
           currently covering). Exactly this height, not just a
           minimum — see alignItems below for why. */
        height: "100dvh",
        width: "100%",
        display: "flex",
        /* stretch, not center: the card now fills this exact height
           (see its own flexDirection:"column" below) and its ONE
           flex-grow child — the canvas — absorbs whatever space is
           actually left after every other section's natural size is
           accounted for. That's what makes "maximize the playing
           area" and "reflow without clipping" the same mechanism
           instead of two separate problems: nothing here ever needs
           to shrink-to-fit-content vertically, so there's nothing left
           to clip. (This also retires the old "safe center" workaround
           for exactly that clipping failure mode — once nothing is
           sized by centering a taller-than-container box, that failure
           mode no longer exists to guard against.) overflowY stays on
           as the last-resort fallback for a genuinely impossible
           combination — every section at its natural size plus the
           canvas at its own minHeight floor still exceeding a very
           short viewport — where the whole page scrolls rather than
           anything clipping silently. */
        alignItems: "stretch",
        justifyContent: "center",
        overflowY: "auto",
        padding: "12px 16px",
        background: `linear-gradient(160deg, ${COLORS.pageBg} 0%, ${COLORS.pageBgDeep} 100%)`,
        fontFamily: "'IBM Plex Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .ec-btn:focus-visible { outline: 2px solid ${COLORS.slate}; outline-offset: 2px; }
        .ec-btn { transition: background-color 0.15s ease, color 0.15s ease; }
        @media (prefers-reduced-motion: reduce) { .ec-btn { transition: none !important; } }
        /* Pure-CSS hover-invert for the New Game / End Active Game
           button — replaces a prior onMouseEnter/onMouseLeave approach
           that mutated the DOM directly, which could desync from
           React's own style bookkeeping across the Begin Game <->
           New Game/End Active Game swap (same element position, no
           key) and leave a stale, mismatched style stuck in place. */
        .ec-btn-invert:hover { background: ${COLORS.charcoal}; color: ${COLORS.cream}; }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 780,
          background: COLORS.cream,
          border: `1px solid ${COLORS.slateSoft}`,
          boxShadow: "0 24px 60px rgba(36,24,10,0.18)",
          padding: "18px 24px 16px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          /* The card is a flex ITEM of the stretched outer wrapper
             above, so by default it already sizes to fill the
             available height — this is here defensively, matching the
             same "let a flex-in-flex chain actually shrink instead of
             being blocked by a child's natural min-size" reasoning
             behind the canvas's own minHeight further down (though
             that one sets a real floor rather than 0, since the canvas
             — unlike this card — should never shrink away entirely). */
          minHeight: 0,
        }}
      >
        {/* Hidden trigger: only a tight box around the glyphs themselves
            is clickable — deliberately no cursor/hover change, so
            there's no visual hint this does anything. The h1 itself is
            block-level (full row width) and carries its own padding
            below the text for layout spacing, so the click handler goes
            on an inline span instead: an inline element's hit box only
            ever covers its actual text run, not the row or the padding
            around it. */}
        <div style={{ textAlign: "center", marginBottom: 4, flexShrink: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              /* clamp, not a fixed 31 — 7vw only overtakes the 31px
                 ceiling below roughly 440px of viewport width, so this
                 is a no-op on every desktop and most phone widths; it
                 only softens the title on genuinely narrow screens
                 instead of letting it force a wider layout than the
                 card actually has room for. */
              fontSize: "clamp(22px, 7vw, 31px)",
              lineHeight: 1,
              letterSpacing: "0.02em",
              color: COLORS.charcoal,
              paddingBottom: 18,
            }}
          >
            <span onClick={handleTitleClick}>EL CABEZA</span>
          </h1>
        </div>

        <button
          className="ec-btn"
          onClick={handleInfoButtonClick}
          style={{
            ...ghostButtonStyle(),
            position: "absolute",
            top: 18,
            right: 24,
            opacity: infoBtnVisible ? 1 : 0,
            pointerEvents: infoBtnVisible ? "auto" : "none",
            transition: "opacity 0.3s ease, background-color 0.15s ease, color 0.15s ease",
          }}
        >
          Info
        </button>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            /* Fixed height, not padding-driven. The Stop here / Undo turn
               buttons are taller than the status text, so without this
               the row would grow when they appeared mid-turn and shrink
               when the turn ended. That no longer risks shifting the
               whole page the way it used to (the card doesn't resize
               based on its own content anymore — see the flex
               architecture above), but it would still mean the canvas
               below quietly resizing on almost every turn as this row's
               height flickered, which is its own small distraction
               worth avoiding during normal play. */
            height: 36,
            padding: "0 14px",
            marginBottom: 6,
            border: `1px solid ${isPlaying ? COLORS.slateSoft : COLORS.charcoal}`,
            background: COLORS.creamAlt,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                flexShrink: 0,
                borderRadius: "50%",
                background: currentPlayer === "dark" ? COLORS.charcoal : COLORS.cream,
                border: `1.5px solid ${COLORS.charcoal}`,
              }}
            />
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {statusText}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexShrink: 0,
              /* Reserved width: these buttons appear and disappear mid-turn,
                 and without a fixed slot their arrival resizes the card and
                 shifts the canvas. */
              minWidth: 186,
              justifyContent: "flex-end",
            }}
          >
            {isPlaying && turnLocked && currentPlayer !== aiPlayer && shadowEntries.length > 0 && (
              <button className="ec-btn" onClick={handleStopHere} style={playerButtonStyle(currentPlayer)}>
                Stop here
              </button>
            )}
            {isPlaying && turnLocked && currentPlayer !== aiPlayer && (
              <button className="ec-btn" onClick={handleUndoTurn} style={ghostButtonStyle()}>
                Undo move
              </button>
            )}
            {!turnLocked && !awaitingBegin && turnHistory.length > 0 && (
              <button
                className="ec-btn"
                onClick={handleUndoLastTurn}
                disabled={busy || aiThinking || !!anim.current}
                style={{
                  ...ghostButtonStyle(),
                  opacity: busy || aiThinking || anim.current ? 0.5 : 1,
                  cursor: busy || aiThinking || anim.current ? "default" : "pointer",
                }}
              >
                Undo turn
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={mountRef}
          style={{
            width: "100%",
            border: `1px solid ${COLORS.slateSoft}`,
            background: `radial-gradient(circle at 50% 35%, #FFFDF9 0%, ${COLORS.creamAlt} 70%, #E9E1D2 100%)`,
            overflow: "hidden",
            /* The one element in this card that actually absorbs
               layout change: grows to claim whatever's left after
               every other section takes its natural height, and
               shrinks the same way when a section (the Opponent row,
               the Record section, Stop here/Undo turn) appears or
               disappears — this is what "maximize the playing area"
               and "reflow without abrupt shifting" both come down to
               in practice. minHeight is a real floor, not 0 — small
               enough to fit a constrained landscape-mobile viewport,
               never so small the board becomes unusable; if every
               section at its natural size plus this floor still
               doesn't fit, the outer wrapper's overflowY is the
               fallback (the whole page scrolls, nothing clips).
               Three.js already reads this element's live measured size
               on every resize (see the ResizeObserver in the
               scene-setup effect) and recalculates the camera's aspect
               ratio accordingly, so nothing on the rendering side
               needed to change for this to work — it was always ready
               for a size it wasn't previously being given. */
            flex: "1 1 auto",
            minHeight: 280,
          }}
        />

        {/* View controls */}
        <div
          style={{
            display: "grid",
            /* Single column normally; a second auto-sized one opens up
               whenever showTopButton has a live action button to show
               here (End Active Game while playing, Reset Game once
               manually ended — see declutter/showTopButton above for
               why those aren't quite the same condition). Grid over
               absolute positioning specifically because grid cells
               can't overlap by construction — an absolutely positioned
               button vertically centered via top:50% reads its
               position off the row's OWN height, which changes if
               Current Player View / Top-Down View ever wrap onto two
               lines on a narrow screen, and centering against a moving
               target is exactly how "zero overlap" stops being
               guaranteed. A grid's second column simply reserves this
               button its own space up front instead. */
            gridTemplateColumns: showTopButton ? "1fr auto" : "1fr",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            <button className="ec-btn" onClick={recenterView} style={ghostButtonStyle()}>
              Current Player View
            </button>
            <button className="ec-btn" onClick={() => topDownView()} style={ghostButtonStyle()}>
              Top-Down View
            </button>
          </div>
          {showTopButton && (
            /* Relocated from the Record row below (hidden while
               declutter is true — see there). The grid's second
               column lands it at the row's right edge, the same
               horizontal endpoint the Record row's own
               justifyContent:"space-between" always gave it — a
               vertical relocation, not a horizontal one. Stays in this
               same spot through both "playing" and "ended" — it's the
               SAME button morphing from one action to the next, not a
               different control appearing — only actually
               disappearing once a real win hands the reset action off
               to the bottom row + victory placard instead. */
            <button
              className="ec-btn ec-btn-invert"
              onClick={status === "ended" ? handleReset : handleEndActiveGame}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "9px 16px",
                cursor: "pointer",
                justifySelf: "end",
              }}
            >
              {status === "ended" ? "Reset Game" : "End Active Game"}
            </button>
          )}
        </div>

        {/* Opponent settings — hidden while declutter is true, see there */}
        {!declutter && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.slate,
              marginRight: 2,
            }}
          >
            Opponent
          </span>
          <button
            className="ec-btn"
            disabled={busy || aiThinking || turnLocked}
            onClick={handleHumanButtonClick}
            style={{
              ...playerButtonStyle(humanStartSide),
              /* Opacity reads selection, not lock state — same reasoning
                 as the AI buttons below: this row is an always-visible
                 readout of the current opponent setting, so the active
                 option can't fade along with the ones it isn't. */
              opacity: aiPlayer === null ? 1 : 0.35,
              cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
            }}
          >
            Human
          </button>
          {[
            { label: "AI", value: "dark", side: "dark" },
            { label: "AI", value: "light", side: "light" },
          ].map((opt) => {
            const isActive = aiPlayer === opt.value;
            const locked = busy || aiThinking || turnLocked;
            return (
              <button
                key={opt.value}
                className="ec-btn"
                disabled={locked}
                onClick={() => selectOpponent(opt.value)}
                style={{
                  ...aiSideButtonStyle(opt.side),
                  /* Opacity reads selection, not lock state — this row is
                     meant to work as an always-visible readout of the
                     current game's opponent setting, including mid-turn,
                     so the active option can't be allowed to fade along
                     with the two it isn't. Only the cursor (and the
                     disabled attribute itself) communicates whether a
                     click would currently do anything. */
                  opacity: isActive ? 1 : 0.35,
                  cursor: locked ? "default" : "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}

          {aiPlayer && (
            <>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  margin: "0 2px 0 6px",
                }}
              >
                Difficulty
              </span>
              {Object.entries(AI_DIFFICULTY).map(([key, cfg]) => (
                <button
                  key={key}
                  className="ec-btn"
                  disabled={busy || aiThinking || turnLocked}
                  onClick={() => setAiDifficulty(key)}
                  style={{
                    ...toggleButtonStyle(aiDifficulty === key),
                    opacity: busy || aiThinking || turnLocked ? 0.5 : 1,
                    cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </>
          )}
        </div>
        )}

        {/* Record — hidden while declutter is true (its own button
            relocates up next to Top-Down View in that state; see
            above), so the whole section, move log included, goes away
            together rather than leaving an empty shell behind. */}
        {!declutter && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.slateSoft}`,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "26px 104px 104px",
                gap: "0 10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.slate,
                paddingBottom: 5,
                borderBottom: `1px solid ${COLORS.slateFaint}`,
              }}
            >
              <span>#</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.charcoal, border: `1px solid ${COLORS.charcoal}` }}
                />
                Dark
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cream, border: `1px solid ${COLORS.charcoal}` }}
                />
                Light
              </span>
            </div>

            {/* Fixed height, not max-height. Without this the log would
                grow taller with every move played, and since the canvas
                is what actually absorbs a taller card now (see the flex
                architecture above), an ever-growing log would mean the
                canvas quietly shrinking turn after turn through an
                entire game — worth avoiding even though it's no longer
                the old "re-centers the whole card" judder. */}
            <div
              style={{
                height: 66,
                overflowY: "auto",
                marginTop: 2,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                lineHeight: 1.3,
                color: COLORS.charcoal,
              }}
            >
              {log.length === 0 ? (
                <p
                  style={{
                    margin: "6px 0 0",
                    color: COLORS.slate,
                    fontStyle: "italic",
                  }}
                >
                  Hover over or tap piece to see movement options
                </p>
              ) : (
                pairLog(log).map((row, i, arr) => {
                  const isLast = i === arr.length - 1;
                  return (
                    <div
                      key={row.n}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "26px 104px 104px",
                        gap: "0 10px",
                        padding: "1px 0",
                        borderBottom: isLast ? "1px solid transparent" : "1px solid rgba(74, 85, 104, 0.10)",
                      }}
                    >
                      <span style={{ color: COLORS.slate }}>{String(row.n).padStart(2, "0")}</span>
                      <span style={{ background: isLast && !row.light && row.dark ? COLORS.slateFaint : "transparent" }}>
                        {row.dark ? `${row.dark.notation}${row.dark.mark ? " " + row.dark.mark : ""}` : "\u2014"}
                      </span>
                      <span style={{ background: isLast && row.light ? COLORS.slateFaint : "transparent" }}>
                        {row.light ? `${row.light.notation}${row.light.mark ? " " + row.light.mark : ""}` : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {awaitingBegin ? (
            /* Colored by currentPlayer, same styling language as "Stop
               here" elsewhere — showing filled charcoal (Dark's color,
               since Dark always moves first) is the visual confirmation
               of who's about to move once pressed, whether that's an
               AI or a human. Doesn't touch the board at all: the reset
               already happened (or the game hasn't started), this only
               flips gameArmed so play — AI or human, either side — is
               finally allowed to begin.

               key="begin" (and "newgame" below) force React to treat
               this and the New Game/End Active Game button as fully
               distinct elements rather than reusing one DOM node across
               the swap — see the CSS comment above for why that reuse
               was risky with the old imperative hover handlers. */
            <button
              key="begin"
              className="ec-btn"
              onClick={() => setGameArmed(true)}
              style={{
                ...playerButtonStyle(currentPlayer),
                fontSize: 11,
                letterSpacing: "0.14em",
                padding: "9px 16px",
                flexShrink: 0,
              }}
            >
              Begin Game
            </button>
          ) : status === "ended" ? (
            /* Copy Log is the only control here now — a manual end has
               no winner to report, but the move log itself is still
               worth being able to pull out. Reset Game (up next to
               Top-Down View, via showTopButton) remains the way to
               actually start over from this state; this button doesn't
               duplicate that, it's a new, separate action. */
            <button
              key="copylog-ended"
              className="ec-btn ec-btn-invert"
              onClick={handleCopyLog}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "9px 16px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {logCopied ? "Copied" : logCopyFailed ? "Copy failed" : "Copy Log"}
            </button>
          ) : (
            /* Only reachable now once a game has actually concluded
               via a real win — "ended" (a manual stop) is handled
               by the branch above instead, and while a game is still
               being played declutter hides this whole section, with
               the live "End Active Game" button up next to Top-Down
               View in its place. So this can only ever read
               "New Game" here.

               Copy Log now sits alongside it — both are post-game-only
               actions, so they share this one flex-item slot in the
               space-between row rather than needing a layout change. */
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                key="copylog-finished"
                className="ec-btn ec-btn-invert"
                onClick={handleCopyLog}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: COLORS.charcoal,
                  background: "transparent",
                  border: `1.5px solid ${COLORS.charcoal}`,
                  padding: "9px 16px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {logCopied ? "Copied" : logCopyFailed ? "Copy failed" : "Copy Log"}
              </button>
              <button
                key="newgame"
                className="ec-btn ec-btn-invert"
                onClick={handleReset}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: COLORS.charcoal,
                  background: "transparent",
                  border: `1.5px solid ${COLORS.charcoal}`,
                  padding: "9px 16px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                New Game
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Hidden-page overlay: opened only via the INFO button revealed by
          clicking the title. Backdrop click and Escape both close it;
          clicking inside the sheet itself does not (stopPropagation).
          Always mounted (never conditionally rendered) so opacity can
          actually transition on the way in AND out — the same fade
          speed/pattern already used for the INFO button reveal itself,
          rather than a hard cut. */}
      <div
        onClick={() => setShowInfoOverlay(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(36,24,10,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 1000,
          opacity: showInfoOverlay ? 1 : 0,
          pointerEvents: showInfoOverlay ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "clamp(280px, 75%, 560px)",
              aspectRatio: "8.5 / 11",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "rgba(253,251,247,0.93)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${COLORS.slateSoft}`,
              boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
              padding: "40px 34px 32px",
              boxSizing: "border-box",
            }}
          >
            <button
              onClick={() => setShowInfoOverlay(false)}
              aria-label="Close"
              className="ec-btn"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1.5px solid ${COLORS.charcoal}`,
                background: "transparent",
                color: COLORS.charcoal,
                fontSize: 13,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h2
              style={{
                margin: "0 0 10px",
                textAlign: "center",
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: "0.04em",
                color: COLORS.charcoal,
              }}
            >
              EL CABEZA
            </h2>
            <div
              style={{
                width: 36,
                height: 1,
                background: COLORS.charcoal,
                margin: "0 auto 26px",
              }}
            />

            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 14.5,
                lineHeight: 1.7,
                color: COLORS.charcoal,
              }}
            >
              <p style={{ margin: "0 0 16px" }}>
                In a parallel universe, this game is as famous as Checkers and
                as respected and cherished as Chess or Go. However, in our
                universe, by chance or misfortune, it has been relegated to
                the dustbin of history. Regardless of the reasons one might
                suggest to explain its obscurity, it remains ultimately
                ineffable how Cabeza has languished in near-anonymity for
                almost 50 years.
              </p>

              <p
                style={{
                  margin: "0 0 16px",
                  fontStyle: "italic",
                  color: COLORS.slate,
                }}
              >
                It&rsquo;s not the game&rsquo;s fault&hellip;
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Cabeza is not an ancient game depicted on priceless artifacts
                from antiquity, nor does it trace its origins to a mysterious
                progenitor, yet it&rsquo;s entirely understandable to mistake
                it for such. The surprisingly rudimentary components coupled
                with the unremarkable square-grid playing field seem to
                foreshadow a mechanical, mundane exercise at best. But
                you&rsquo;re soon thrown off-balance at how quickly
                you&rsquo;ve become captivated by the emergent complexity
                hidden in plain sight&hellip;
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Developed sometime prior to 1977, amidst a steady stream of
                abstract strategy board games, Cabeza was never officially
                published for reasons unknown. It was, however, fully
                described in a 1987 issue of the Argentine gaming magazine{" "}
                <em>Revista Humor y Juegos</em>, with such vivid detail that
                one could believe it had actually been released. Yet, the
                article itself clarifies that El Cabeza had not yet been
                published, however over the years DIY, physical versions
                have been produced by enthusiasts.
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Each player commands five pieces: a small cube, a large cube,
                a small rectangular prism, a large rectangular prism, and a
                small disc, set up at opposite ends of a 10x10 board in a
                rotationally symmetrical arrangement. Only one piece moves
                per turn. To win, advance the disc, the Cabeza, to the
                opponent&rsquo;s back row, or use one of the
                other four pieces to land on, or &lsquo;crush,&rsquo; the
                opponent&rsquo;s Cabeza.
              </p>

              <p style={{ margin: 0 }}>
                The game&rsquo;s real novelty is in how the polyhedra move.
                Every piece rolls along its edges, one or two squares at a
                time, orthogonally, and may change direction between rolls
                &mdash; except the large cube, whose bulk allows only a
                single roll, covering two squares at once. The Cabeza alone
                can also move diagonally, up to two squares. The cubes roll
                predictably; the two prisms don&rsquo;t, tumbling erratically
                as they travel &mdash; and it&rsquo;s that contrast between
                the reliable and the erratic that keeps a fresh tactical
                puzzle arriving almost every turn.
              </p>
            </div>

            <div
              style={{
                width: 36,
                height: 1,
                background: COLORS.slateSoft,
                margin: "26px auto 14px",
              }}
            />
            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                color: COLORS.slate,
              }}
            >
              This digital implementation by Ted Ortmann, August 2026
              &middot; v{APP_VERSION}
            </p>
          </div>
        </div>

      {/* Victory placard: opens automatically the instant a game ends
          (see the status-watching effect above). Same always-mounted +
          opacity-fade pattern as the info overlay, at 0.3s to match.
          Backdrop click, the X, or Escape all dismiss it WITHOUT
          resetting the game — the finished board is still there to
          look at, and the bottom New Game / Begin button still works
          either way — so this is a convenience shortcut, not the only
          path forward. */}
      <div
        onClick={() => setShowVictoryPlacard(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(36,24,10,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 1100,
          opacity: showVictoryPlacard ? 1 : 0,
          pointerEvents: showVictoryPlacard ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(90%, 400px)",
            background: COLORS.cream,
            border: `1px solid ${COLORS.slateSoft}`,
            boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
            padding: "44px 32px 32px",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <button
            onClick={() => setShowVictoryPlacard(false)}
            aria-label="Close"
            className="ec-btn"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${COLORS.charcoal}`,
              background: "transparent",
              color: COLORS.charcoal,
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ✕
          </button>

          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: winner === "dark" ? COLORS.charcoal : COLORS.cream,
              border: `2px solid ${COLORS.charcoal}`,
              marginBottom: 18,
            }}
          />

          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 34,
              letterSpacing: "0.02em",
              color: COLORS.charcoal,
            }}
          >
            {winner === "dark" ? "DARK WINS" : "LIGHT WINS"}
          </h2>

          <p
            style={{
              margin: "0 0 28px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.slate,
            }}
          >
            {winReason}
          </p>

          <button
            className="ec-btn"
            onClick={handleReset}
            style={{
              ...playerButtonStyle(winner),
              fontSize: 11,
              letterSpacing: "0.14em",
              padding: "10px 24px",
            }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

const MINI_BUTTON_BASE = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "6px 10px",
  cursor: "pointer",
  border: `1.5px solid ${COLORS.charcoal}`,
};

function playerButtonStyle(player) {
  const isDark = player === "dark";
  return {
    ...MINI_BUTTON_BASE,
    background: isDark ? COLORS.charcoal : COLORS.cream,
    color: isDark ? COLORS.cream : COLORS.charcoal,
  };
}

function ghostButtonStyle() {
  return {
    ...MINI_BUTTON_BASE,
    background: "transparent",
    color: COLORS.slate,
    borderColor: COLORS.slateSoft,
  };
}

/* For a row of mutually-exclusive choices (opponent type, difficulty) —
   the selected option reads as filled/committed, the rest sit quiet. */
function toggleButtonStyle(active) {
  return active
    ? { ...MINI_BUTTON_BASE, background: COLORS.charcoal, color: COLORS.cream }
    : ghostButtonStyle();
}

/* For the two compact "AI" opponent buttons — selected reuses the same
   filled player coloring as playerButtonStyle (Stop here uses it too),
   so a glance tells you which side, if any, is AI-controlled without
   needing the label to spell it out. Unselected keeps a hint of the
   color in the text rather than going fully neutral, since "AI" alone
   gives no other way to tell the two buttons apart at rest. */
/* AI side buttons: pill-shaped, and fully colored for their side at ALL
   times — charcoal-filled/cream-text for Dark, cream-filled/charcoal-
   text-and-border for Light — not just when selected. That persistence
   is the point: a toggle button's fill appears and disappears with
   selection, so it can't double as "this is what Dark/Light actually
   looks like." Selection is communicated purely by opacity, applied at
   the call site, same as every other button in this row.
   The rounded shape is what keeps a solid-charcoal-filled Dark button
   from being visually interchangeable with Human-active — also solid
   charcoal, also cream text, but rectangular. Round reads as "a player-
   color chip" instead, echoing the small circular dots already used for
   exactly that purpose in the status bar and the move record's Dark/
   Light column headers — the same visual idea reused, not a new one. */
function aiSideButtonStyle(side) {
  const isDark = side === "dark";
  return {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "6px 14px",
    cursor: "pointer",
    borderRadius: 999,
    border: `1.5px solid ${COLORS.charcoal}`,
    background: isDark ? COLORS.charcoal : COLORS.cream,
    color: isDark ? COLORS.cream : COLORS.charcoal,
  };
}
