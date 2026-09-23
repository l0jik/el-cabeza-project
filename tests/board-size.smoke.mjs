/* Exercises the board-dimension parameterisation at sizes OTHER than
   the 10x10 default.

   Why this file exists: at 10x10 every X value equals its Z counterpart
   and rows equal cols, so a rows/cols or X/Z mix-up anywhere in the
   refactor is completely invisible — every other test in this suite
   would still pass with the two swapped. Everything here therefore runs
   on a deliberately NON-SQUARE board, where a swap changes the answer.

   Node-only, no browser: pure engine assertions. */

import {
  BOARD_ROWS, BOARD_COLS, SQUARE_SIZE, OFF_X, OFF_Z, SLAB_X, SLAB_Z,
  SLAB_MAX, SLAB_MIN, GRID_EXTENT_X, GRID_EXTENT_Z, GOAL_ROW,
  ZOOM_MAX_FOR_BOARD, ZOOM_MAX, MIN_BOARD_DIM, MAX_BOARD_DIM,
  setBoardDimensions, getBoardDimensions,
} from "../engine/constants.js";
import { createInitialPieces, inBounds, legalMovesFor, cellsOf, getPieceAt } from "../engine/rules.js";
import { pieceCenter } from "../engine/geometry.js";

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
  }
}

/* ---------- 1. the default board is untouched by all of this ---------- */
console.log("default 10x10 geometry matches the pre-refactor constants:");
check("BOARD_ROWS/COLS are 10/10", BOARD_ROWS === 10 && BOARD_COLS === 10);
check("SQUARE_SIZE is 1.056", Math.abs(SQUARE_SIZE - 1.056) < 1e-12, String(SQUARE_SIZE));
check("SLAB_X === SLAB_Z === 11.4", Math.abs(SLAB_X - 11.4) < 1e-9 && Math.abs(SLAB_Z - 11.4) < 1e-9);
check("OFF_X === OFF_Z === 5.28", Math.abs(OFF_X - 5.28) < 1e-9 && Math.abs(OFF_Z - 5.28) < 1e-9);
check("GRID_EXTENT_X/Z === 10.56", Math.abs(GRID_EXTENT_X - 10.56) < 1e-9 && Math.abs(GRID_EXTENT_Z - 10.56) < 1e-9);
check("GOAL_ROW is {dark:9, light:0}", GOAL_ROW.dark === 9 && GOAL_ROW.light === 0);
check("ZOOM_MAX_FOR_BOARD equals the tuned ZOOM_MAX", Math.abs(ZOOM_MAX_FOR_BOARD - ZOOM_MAX) < 1e-9);

/* The original hardcoded opening layout, byte for byte. The parametric
   generator has to reproduce this EXACTLY at 10x10 — same pieces, same
   squares, same array order — or the default game has silently changed. */
const ORIGINAL_10x10 = [
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
check(
  "createInitialPieces() at 10x10 is byte-identical to the original hardcoded layout",
  JSON.stringify(createInitialPieces()) === JSON.stringify(ORIGINAL_10x10),
  JSON.stringify(createInitialPieces())
);

/* ---------- 2. a deliberately NON-SQUARE board ---------- */
console.log("\nnon-square board (14 rows x 8 cols):");
setBoardDimensions(14, 8);
check("getBoardDimensions reports 14x8", getBoardDimensions().rows === 14 && getBoardDimensions().cols === 8);
check("rows drive Z, cols drive X (OFF_Z > OFF_X)", OFF_Z > OFF_X, `OFF_X=${OFF_X} OFF_Z=${OFF_Z}`);
check("GRID_EXTENT_Z === rows * SQUARE_SIZE", Math.abs(GRID_EXTENT_Z - 14 * SQUARE_SIZE) < 1e-9);
check("GRID_EXTENT_X === cols * SQUARE_SIZE", Math.abs(GRID_EXTENT_X - 8 * SQUARE_SIZE) < 1e-9);
check("SLAB_MAX is the Z (row) side here", Math.abs(SLAB_MAX - SLAB_Z) < 1e-9);
check("SLAB_MIN is the X (col) side here", Math.abs(SLAB_MIN - SLAB_X) < 1e-9);
check("GOAL_ROW.dark tracks rows, not cols", GOAL_ROW.dark === 13, String(GOAL_ROW.dark));
check("ZOOM_MAX_FOR_BOARD grew with the bigger plate", ZOOM_MAX_FOR_BOARD > ZOOM_MAX);

const pieces = createInitialPieces();
check("still 10 pieces", pieces.length === 10);
check("every starting piece is in bounds", pieces.every(inBounds),
  JSON.stringify(pieces.filter((p) => !inBounds(p))));
check("no two starting pieces overlap", (() => {
  const seen = new Set();
  for (const p of pieces) {
    for (const [r, c] of cellsOf(p)) {
      const k = r + "," + c;
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  return true;
})());

const darkCabeza = pieces.find((p) => p.id === "dark-cabeza");
const lightCabeza = pieces.find((p) => p.id === "light-cabeza");
check("Light's setup is the 180° rotation of Dark's",
  lightCabeza.row === BOARD_ROWS - darkCabeza.row - darkCabeza.h &&
  lightCabeza.col === BOARD_COLS - darkCabeza.col - darkCabeza.w,
  `dark=(${darkCabeza.row},${darkCabeza.col}) light=(${lightCabeza.row},${lightCabeza.col})`);
check("the formation is centred on the narrower board",
  pieces.every((p) => p.col >= 0 && p.col + p.w <= BOARD_COLS),
  JSON.stringify(pieces.map((p) => [p.id, p.col, p.w])));

/* pieceCenter must map col->x and row->z. With rows != cols the two
   offsets differ, so a swap here shows up immediately. */
const corner = { row: 0, col: 0, w: 1, h: 1, z: 1, type: "turrito" };
const cc = pieceCenter(corner);
check("pieceCenter maps col->x against OFF_X", Math.abs(cc.x - (0.5 * SQUARE_SIZE - OFF_X)) < 1e-9, String(cc.x));
check("pieceCenter maps row->z against OFF_Z", Math.abs(cc.z - (0.5 * SQUARE_SIZE - OFF_Z)) < 1e-9, String(cc.z));
check("a corner piece's center is inside the plate",
  Math.abs(cc.x) < SLAB_X / 2 && Math.abs(cc.z) < SLAB_Z / 2);

/* Bounds must be asymmetric now: the last legal col is 7, the last
   legal row is 13. Testing both directions catches a swapped pair. */
check("col 7 is in bounds but col 8 is not",
  inBounds({ row: 0, col: 7, w: 1, h: 1, z: 1 }) && !inBounds({ row: 0, col: 8, w: 1, h: 1, z: 1 }));
check("row 13 is in bounds but row 14 is not",
  inBounds({ row: 13, col: 0, w: 1, h: 1, z: 1 }) && !inBounds({ row: 14, col: 0, w: 1, h: 1, z: 1 }));

/* A Cabeza in the far corner must not be offered moves off the board. */
const edgeCabeza = { id: "x", type: "cabeza", owner: "dark", row: 13, col: 7, w: 1, h: 1, z: 1 };
const edgeMoves = legalMovesFor([edgeCabeza], edgeCabeza);
check("no legal move from the far corner leaves the board",
  Object.values(edgeMoves).every((m) => inBounds(m.candidate)),
  JSON.stringify(Object.entries(edgeMoves).map(([d, m]) => [d, m.candidate.row, m.candidate.col])));
check("the far corner still has the 3 in-board diagonal/orthogonal steps",
  Object.keys(edgeMoves).length === 3, Object.keys(edgeMoves).join(","));

/* ---------- 3. bounds clamping ---------- */
console.log("\ndimension clamping:");
check(`oversize clamps to ${MAX_BOARD_DIM}`, setBoardDimensions(99, 99).rows === MAX_BOARD_DIM);
check(`undersize clamps to ${MIN_BOARD_DIM}`, setBoardDimensions(1, 1).cols === MIN_BOARD_DIM);
check("garbage input keeps the previous value", (() => {
  setBoardDimensions(12, 12);
  const r = setBoardDimensions("nonsense", undefined);
  return r.rows === 12 && r.cols === 12;
})());
check("fractional input floors", setBoardDimensions(11.9, 9.2).rows === 11);

/* ---------- 4. the maximum board is playable ---------- */
console.log(`\nmaximum board (${MAX_BOARD_DIM}x${MAX_BOARD_DIM}):`);
setBoardDimensions(MAX_BOARD_DIM, MAX_BOARD_DIM);
const bigPieces = createInitialPieces();
check("all pieces in bounds at max size", bigPieces.every(inBounds));
check("Dark's Cabeza still starts on row 0", bigPieces.find((p) => p.id === "dark-cabeza").row === 0);
check("Light's Cabeza starts on the last row",
  bigPieces.find((p) => p.id === "light-cabeza").row === MAX_BOARD_DIM - 1);
check("goal rows span the full board", GOAL_ROW.dark === MAX_BOARD_DIM - 1 && GOAL_ROW.light === 0);
/* NOT "every piece can move" — four pieces (each side's Turrito and
   Cabeza) start hemmed in by their own neighbours in the opening
   formation, and always have, at every board size. The meaningful
   property is that board size doesn't CHANGE which pieces are mobile
   at the start: the opening position should play the same whatever the
   plate it sits on. */
const mobileAt = (rows, cols) => {
  setBoardDimensions(rows, cols);
  const ps = createInitialPieces();
  return ps
    .filter((p) => Object.keys(legalMovesFor(ps, p)).length > 0)
    .map((p) => p.id)
    .sort()
    .join(",");
};
const mobileDefault = mobileAt(10, 10);
check("the same pieces are mobile at 20x20 as at 10x10",
  mobileAt(MAX_BOARD_DIM, MAX_BOARD_DIM) === mobileDefault, mobileDefault);
check("the same pieces are mobile on a non-square board too",
  mobileAt(14, 8) === mobileDefault, mobileAt(14, 8));
setBoardDimensions(MAX_BOARD_DIM, MAX_BOARD_DIM);
check("getPieceAt finds a piece at its own cell",
  getPieceAt(bigPieces, bigPieces[0].row, bigPieces[0].col) === bigPieces[0]);

// Restore the default so this file can't leak state into any other test
// that imports the same module instance.
setBoardDimensions(10, 10);

console.log(
  failures === 0
    ? "\nBOARD SIZE SMOKE TEST PASSED"
    : `\nBOARD SIZE SMOKE TEST FAILED (${failures} failure${failures === 1 ? "" : "s"})`
);
process.exit(failures === 0 ? 0 : 1);
