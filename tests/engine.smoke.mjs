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

// ---- Slide always costs TWO action points ----
// The AI's turn generator is the ground truth for the budget rule.
const slidePieces = [
  { id: "t", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 2 },
  { id: "cd", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 2 },
  { id: "cl", type: "cabeza", owner: "light", row: 7, col: 7, w: 1, h: 1, z: 2 },
];

// A normal 2-point turn: a slide spends BOTH points, so it can only ever
// be a one-move turn — no slide+continue exists.
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });
const t2 = generateTurns(slidePieces, "dark");
const slideStop2 = t2.filter((t) => t.dirs.length === 1 && isSlideKey(t.dirs[0]));
const slideCont2 = t2.filter((t) => t.dirs.length >= 2 && t.dirs.some(isSlideKey));
console.log("[2-pt] slide-only turns:", slideStop2.length, "| slide+continue turns:", slideCont2.length);
if (slideStop2.length === 0) throw new Error("A single slide should be a valid 2-point turn");
if (slideCont2.length !== 0) throw new Error("In a 2-point turn a slide spends the whole turn — nothing should chain after it");

// A 3-point turn ("3 Actions"): a slide (2) leaves one point, so a slide
// then a single roll chains — and a roll then a slide too.
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: true });
const t3 = generateTurns(slidePieces, "dark");
const slideThenRoll = t3.filter((t) => t.dirs.length === 2 && isSlideKey(t.dirs[0]) && !isSlideKey(t.dirs[1]));
const noSlideSlide = t3.every((t) => t.dirs.filter(isSlideKey).length <= 1);
const noTripleAfterSlide = t3.every((t) => !(t.dirs.length === 3 && t.dirs.some(isSlideKey)));
console.log("[3-pt] slide-then-roll turns:", slideThenRoll.length);
if (slideThenRoll.length === 0) throw new Error("With 3 Actions a slide should leave one point for a follow-up roll");
if (!noSlideSlide) throw new Error("Two slides cost 4 points — impossible within a 3-point budget");
if (!noTripleAfterSlide) throw new Error("A slide costs 2, so a slide can never sit in a 3-move (3x1) turn");

// Opa (base budget 1) can't afford a slide in a plain Slide game, but the
// "3 Actions" law grants it the +1 too (1 -> 2), so with both laws on Opa
// can slide like every other piece.
const opaPieces = [
  { id: "o", type: "opa", owner: "dark", row: 4, col: 4, w: 2, h: 2, z: 2 },
  { id: "cd", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 2 },
  { id: "cl", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 2 },
];
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });
const opaPlain = generateTurns(opaPieces, "dark").filter((t) => t.dirs.some(isSlideKey));
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: true });
const opa3 = generateTurns(opaPieces, "dark").filter((t) => t.dirs.some(isSlideKey));
console.log("[Opa] slide turns — plain Slide:", opaPlain.length, "| Slide+3Actions:", opa3.length);
if (opaPlain.length !== 0) throw new Error("Opa (1 point) should not be able to slide without 3 Actions");
if (opa3.length === 0) throw new Error("With 3 Actions, Opa should get a 2-point budget and be able to slide");
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });

console.log("\nSMOKE TEST PASSED");
