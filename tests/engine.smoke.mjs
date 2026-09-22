import { createInitialPieces, legalMovesFor, sameState, pairLog } from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY, evaluatePosition, generateTurns } from "../engine/ai.js";
import { pieceCenter, makeRoundedBox, pivotFor } from "../engine/geometry.js";
import { BOARD_ROWS, BOARD_COLS, setActiveLaws, isSlideKey } from "../engine/constants.js";

const pieces = createInitialPieces();
console.log("pieces:", pieces.length, "board:", BOARD_ROWS + "x" + BOARD_COLS);

const cabeza = pieces.find((p) => p.id === "dark-cabeza");
const moves = legalMovesFor(pieces, cabeza);
console.log("dark-cabeza legal moves:", Object.keys(moves));

console.log("evaluatePosition(dark):", evaluatePosition(pieces, "dark"));

const turn = await findBestAiTurn(pieces, "dark", AI_DIFFICULTY.easy, 0, 0);
console.log("AI (easy) chosen turn:", turn && { pieceId: turn.pieceId, dirs: turn.dirs });

const geo = makeRoundedBox(0.8, 0.8, 0.8, 0.0625);
console.log("makeRoundedBox vertex count:", geo.attributes.position.count);

const pivot = pivotFor(pieces[0], "E");
console.log("pivotFor sample:", pivot.point.toArray(), pivot.angle);

console.log("pairLog([]):", pairLog([]));
console.log("sameState self-check:", sameState(pieces[0], pieces[0]));

// ---- Slide costs ONE action point, not the whole turn ----
// With the Slide law on, a piece must be able to slide and then still
// take a further action within its budget (roll or another slide) — the
// AI's own turn generator is the ground truth for that.
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });
const slidePieces = [
  { id: "t", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 2 },
  { id: "cd", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 2 },
  { id: "cl", type: "cabeza", owner: "light", row: 7, col: 7, w: 1, h: 1, z: 2 },
];
const slideTurns = generateTurns(slidePieces, "dark");
const slideThenMore = slideTurns.filter((t) => t.dirs.length >= 2 && isSlideKey(t.dirs[0]));
const slideStop = slideTurns.filter((t) => t.dirs.length === 1 && isSlideKey(t.dirs[0]));
console.log("slide+continue turns:", slideThenMore.length, "| slide-then-stop turns:", slideStop.length);
if (slideThenMore.length === 0) throw new Error("Slide should cost one action point and allow a further step, but no slide+continue turn was generated");
if (slideStop.length === 0) throw new Error("Stopping after a single slide should still be a valid turn");
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });

console.log("\nSMOKE TEST PASSED");
