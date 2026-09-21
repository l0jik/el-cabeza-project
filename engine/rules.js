/* Core move/board rules for El Cabeza. Verified byte-for-byte identical
   between the Standard and Neon theme sources before extraction — see
   build/scratch/. Pure logic: no React, no Three.js, no DOM. */

import { BOARD_ROWS, BOARD_COLS, ROLL_DIRS, STEP_DIRS, ACTIVE_LAWS, slideKey, BLACK_HOLES } from "./constants.js";

/* Dark's half of the opening setup, with columns expressed RELATIVE to
   the leftmost of the four columns the formation occupies, so the whole
   thing can be re-centred on a board of any width. At the 10-wide
   default the offset below works out to 3, reproducing the original
   hardcoded columns (3,4,5,6 / opa at 4) exactly. */
const DARK_SETUP = [
  { id: "dark-flaco", type: "flaco", row: 0, relCol: 0, w: 1, h: 2, z: 1 },
  { id: "dark-turrito", type: "turrito", row: 0, relCol: 1, w: 1, h: 1, z: 1 },
  { id: "dark-cabeza", type: "cabeza", row: 0, relCol: 2, w: 1, h: 1, z: 1 },
  { id: "dark-chato", type: "chato", row: 0, relCol: 3, w: 1, h: 2, z: 2 },
  { id: "dark-opa", type: "opa", row: 1, relCol: 1, w: 2, h: 2, z: 2 },
];

/* Light is the 180° rotation of Dark (row -> ROWS-row-h, col ->
   COLS-col-w), which is what makes the opening position rotationally
   symmetric at any board size rather than a second hand-placed table
   that would have to be re-derived per size. Listed in this order, and
   emitted after Dark's, purely to keep createInitialPieces' output
   array order byte-identical to the original hardcoded version — see
   the order assertion in tests/board-size.smoke.mjs. */
const LIGHT_ORDER = ["chato", "opa", "cabeza", "turrito", "flaco"];

const SETUP_WIDTH = 4; // columns Dark's formation spans

export function createInitialPieces() {
  const colOffset = Math.floor((BOARD_COLS - SETUP_WIDTH) / 2);
  const dark = DARK_SETUP.map((p) => ({
    id: p.id,
    type: p.type,
    owner: "dark",
    row: p.row,
    col: p.relCol + colOffset,
    w: p.w,
    h: p.h,
    z: p.z,
  }));
  const light = LIGHT_ORDER.map((type) => {
    const d = dark.find((p) => p.type === type);
    return {
      id: "light-" + type,
      type,
      owner: "light",
      row: BOARD_ROWS - d.row - d.h,
      col: BOARD_COLS - d.col - d.w,
      w: d.w,
      h: d.h,
      z: d.z,
    };
  });
  return [...dark, ...light];
}

export function cellsOf(piece) {
  const cells = [];
  for (let r = piece.row; r < piece.row + piece.h; r++) {
    for (let c = piece.col; c < piece.col + piece.w; c++) cells.push([r, c]);
  }
  return cells;
}

export function getPieceAt(pieces, row, col) {
  return (
    pieces.find(
      (p) => row >= p.row && row < p.row + p.h && col >= p.col && col < p.col + p.w
    ) || null
  );
}

export function rollBlock(piece, dir) {
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

export function inBounds(piece) {
  return (
    piece.row >= 0 &&
    piece.col >= 0 &&
    piece.row + piece.h <= BOARD_ROWS &&
    piece.col + piece.w <= BOARD_COLS
  );
}

/* Black Hole Squares LAW (SINGULARITY_DESIGN.md): BLACK_HOLES is either
   [] (law off) or exactly the two paired squares pickBlackHoleSquares
   below placed. blackHoleAt/otherBlackHole are trivial when empty —
   .find on [] is always undefined — which is what keeps every caller
   below a no-op with the law off. */
function blackHoleAt(row, col) {
  return BLACK_HOLES.find((b) => b.row === row && b.col === col) || null;
}
function otherBlackHole(square) {
  return BLACK_HOLES.length === 2 ? BLACK_HOLES.find((b) => b !== square) : null;
}

/* A candidate's fate w.r.t. black holes: blocked outright, passes
   through untouched, or is redirected (wormhole entry) to the paired
   square. ONLY a candidate whose ENTIRE footprint is exactly one cell,
   sitting exactly on a hole, can enter — "no partial/failed-entry" and
   "route around it" (the design doc's words for a multi-cell piece)
   cash out to: any overlap at all with a hole cell blocks a >1-cell
   footprint outright, since such a footprint can never coincide with a
   single hole-cell exactly, so it can never legally "enter." */
function blackHoleVerdict(candidate) {
  const cells = cellsOf(candidate);
  const hit = cells.map(([r, c]) => blackHoleAt(r, c)).find(Boolean);
  if (!hit) return { blocked: false, teleportTo: null };
  if (cells.length === 1) {
    const other = otherBlackHole(hit);
    if (other) return { blocked: false, teleportTo: other };
  }
  return { blocked: true, teleportTo: null };
}

/* The piece-occupancy-only half of landing legality, factored out of
   evaluateBlockLanding so a wormhole's teleport destination (itself a
   black hole cell — see evaluateBlockLanding below) can be checked
   against THIS, not the public function, and so never re-triggers
   blackHoleVerdict on the far end. Recursing into the public function
   there would detect "landing exactly on a hole cell" a second time and
   try to teleport back to where the piece just came from. */
function pieceOccupancyVerdict(pieces, candidate) {
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

export function evaluateBlockLanding(pieces, candidate) {
  if (!inBounds(candidate)) return { legal: false, crushes: null };
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked) return { legal: false, crushes: null };
  if (bh.teleportTo) {
    // Wormhole entry: "evaluated under the exact same landing-legality
    // check every other move already uses" (SINGULARITY_DESIGN.md) —
    // the far square is checked for plain piece occupancy only, a real
    // crush included, exactly like any other landing.
    const landed = { ...candidate, row: bh.teleportTo.row, col: bh.teleportTo.col };
    const verdict = pieceOccupancyVerdict(pieces, landed);
    return verdict.legal ? { ...verdict, teleportsTo: bh.teleportTo } : { legal: false, crushes: null };
  }
  return pieceOccupancyVerdict(pieces, candidate);
}

/* Random-but-fair placement for the Black Hole Squares LAW: a uniformly
   random empty cell, paired with its 180-degree rotation partner — the
   exact same point-symmetry createInitialPieces already uses for
   Dark/Light mirroring above (row -> rows-row-h, col -> cols-col-w),
   which is what "rotationally-symmetric locations relative to each
   other" means here. Bounded retries rather than an exhaustive search:
   a board packed enough that no valid pair exists at all is exceedingly
   rare, and degrading to "law has no effect this game" ([]) is a
   reasonable fallback rather than something worth more engineering. */
export function pickBlackHoleSquares(pieces, rows, cols, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const r2 = rows - 1 - r;
    const c2 = cols - 1 - c;
    if (r === r2 && c === c2) continue; // odd-dimension center coincidence -- can't hold two holes on one square
    if (getPieceAt(pieces, r, c) || getPieceAt(pieces, r2, c2)) continue;
    return [{ row: r, col: c }, { row: r2, col: c2 }];
  }
  return [];
}

export function legalRolls(pieces, piece) {
  const out = {};
  for (const dir of ROLL_DIRS) {
    const candidate = rollBlock(piece, dir);
    const verdict = evaluateBlockLanding(pieces, candidate);
    if (verdict.legal) {
      // A wormhole roll lands at the FAR hole, not the near mouth it
      // was rolled toward — the piece never visibly sits on the near
      // square. teleportsTo is only ever set when the law is on.
      out[dir] = verdict.teleportsTo
        ? { candidate: { ...candidate, row: verdict.teleportsTo.row, col: verdict.teleportsTo.col }, crushes: verdict.crushes, teleports: true }
        : { candidate, crushes: verdict.crushes };
    }
  }
  return out;
}

/* Shared by Cabeza's own always-on step and the Slide LAW's general
   version below: a pure one-cell translate. Off a Black Hole Squares
   mouth this never crushes, landing only on a fully empty footprint —
   but SINGULARITY_DESIGN.md is explicit that a wormhole entry is
   "evaluated under the exact same landing-legality check every other
   move already uses," crush included, so that one case defers entirely
   to evaluateBlockLanding rather than a third reimplementation of it.
   cellsOf generalizes the emptiness check across any w x h, not just
   the single cell a 1x1 Cabeza needs; for a 1x1 candidate the two are
   the same check. */
function translatedCandidate(pieces, piece, dr, dc) {
  const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
  if (!inBounds(candidate)) return null;
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked) return null;
  if (bh.teleportTo) {
    const verdict = evaluateBlockLanding(pieces, candidate);
    if (!verdict.legal) return null;
    return {
      candidate: { ...candidate, row: verdict.teleportsTo.row, col: verdict.teleportsTo.col },
      crushes: verdict.crushes,
      teleports: true,
    };
  }
  for (const [r, c] of cellsOf(candidate)) {
    const occupant = getPieceAt(pieces, r, c);
    if (occupant && occupant.id !== piece.id) return null;
  }
  return { candidate, crushes: null, teleports: false };
}

export function legalCabezaSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const move = translatedCandidate(pieces, piece, dr, dc);
    if (move) {
      out[dir] = move.teleports
        ? { candidate: move.candidate, crushes: move.crushes, teleports: true }
        : { candidate: move.candidate, crushes: null };
    }
  }
  return out;
}

/* The Slide LAW (SINGULARITY_DESIGN.md): "move one open adjacent
   square without rolling/reorienting, as a full turn action" —
   available to every piece, old and new, once enabled, not just
   Cabeza. Same translate primitive as legalCabezaSteps (crush only via
   a wormhole entry), generalized over any footprint. Left as its own
   function rather than folded unconditionally into legalMovesFor:
   Cabeza already has this exact movement as its unconditional baseline
   and must not gain a redundant, identically-keyed duplicate of it. */
export function legalSlideSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const move = translatedCandidate(pieces, piece, dr, dc);
    if (move) {
      out[dir] = move.teleports
        ? { candidate: move.candidate, crushes: move.crushes, isSlide: true, teleports: true }
        : { candidate: move.candidate, crushes: null, isSlide: true };
    }
  }
  return out;
}

export function legalMovesFor(pieces, piece) {
  if (piece.type === "cabeza") return legalCabezaSteps(pieces, piece);
  const rolls = legalRolls(pieces, piece);
  if (!ACTIVE_LAWS.slide) return rolls;
  // Prefixed keys (see slideKey/constants.js): a block piece's roll and
  // slide can legally coexist in the same cardinal direction (e.g. "E"
  // rolls it a full square-and-a-bit away while "slide-E" just nudges
  // it one cell), so the two dicts are merged rather than either
  // overwriting the other.
  const out = { ...rolls };
  for (const [dir, move] of Object.entries(legalSlideSteps(pieces, piece))) out[slideKey(dir)] = move;
  return out;
}

export function pairLog(entries) {
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
export function sameState(a, b) {
  return a.row === b.row && a.col === b.col && a.w === b.w && a.h === b.h && a.z === b.z;
}
