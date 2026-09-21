/* Core move/board rules for El Cabeza. Verified byte-for-byte identical
   between the Standard and Neon theme sources before extraction — see
   build/scratch/. Pure logic: no React, no Three.js, no DOM. */

import { BOARD_ROWS, BOARD_COLS, ROLL_DIRS, STEP_DIRS, ACTIVE_LAWS, slideKey } from "./constants.js";

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

export function evaluateBlockLanding(pieces, candidate) {
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

export function legalRolls(pieces, piece) {
  const out = {};
  for (const dir of ROLL_DIRS) {
    const candidate = rollBlock(piece, dir);
    const verdict = evaluateBlockLanding(pieces, candidate);
    if (verdict.legal) out[dir] = { candidate, crushes: verdict.crushes };
  }
  return out;
}

/* Shared by Cabeza's own always-on step and the Slide LAW's general
   version below: a pure one-cell translate, landing only on a fully
   empty footprint — no crush, unlike a roll or Black Hole Squares'
   teleport (evaluateBlockLanding). cellsOf generalizes the emptiness
   check across any w x h, not just the single cell a 1x1 Cabeza needs;
   for a 1x1 candidate the two are the same check. */
function translatedCandidate(pieces, piece, dr, dc) {
  const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
  if (!inBounds(candidate)) return null;
  for (const [r, c] of cellsOf(candidate)) {
    const occupant = getPieceAt(pieces, r, c);
    if (occupant && occupant.id !== piece.id) return null;
  }
  return candidate;
}

export function legalCabezaSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const candidate = translatedCandidate(pieces, piece, dr, dc);
    if (candidate) out[dir] = { candidate, crushes: null };
  }
  return out;
}

/* The Slide LAW (SINGULARITY_DESIGN.md): "move one open adjacent
   square without rolling/reorienting, as a full turn action" —
   available to every piece, old and new, once enabled, not just
   Cabeza. Same translate/no-crush primitive as legalCabezaSteps,
   generalized over any footprint. Left as its own function rather than
   folded unconditionally into legalMovesFor: Cabeza already has this
   exact movement as its unconditional baseline and must not gain a
   redundant, identically-keyed duplicate of it. */
export function legalSlideSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const candidate = translatedCandidate(pieces, piece, dr, dc);
    if (candidate) out[dir] = { candidate, crushes: null, isSlide: true };
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
