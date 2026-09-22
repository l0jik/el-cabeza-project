import { createInitialPieces, legalMovesFor, sameState, pairLog } from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY, evaluatePosition, generateTurns } from "../engine/ai.js";
import { setBlackHoles } from "../engine/constants.js";
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

// An Opa move (roll or slide) costs two points, so an Opa NEVER moves
// more than once in a turn — not even with a 3-point "3 Actions" budget.
// Its 2-point budget also lets it slide in a plain Slide game.
const opaPieces = [
  { id: "o", type: "opa", owner: "dark", row: 4, col: 4, w: 2, h: 2, z: 2 },
  { id: "cd", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 2 },
  { id: "cl", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 2 },
];
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });
let opaTurns = generateTurns(opaPieces, "dark").filter((t) => t.pieceId === "o");
const opaPlainSlide = opaTurns.filter((t) => t.dirs.some(isSlideKey)).length;
const opaPlainMulti = opaTurns.filter((t) => t.dirs.length > 1).length;
console.log("[Opa] plain Slide — slide turns:", opaPlainSlide, "| multi-move turns:", opaPlainMulti);
if (opaPlainSlide === 0) throw new Error("A base-game Opa should be able to slide (2-point budget)");
if (opaPlainMulti !== 0) throw new Error("An Opa must never move more than once in a turn");
setActiveLaws({ slide: true, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: true });
opaTurns = generateTurns(opaPieces, "dark").filter((t) => t.pieceId === "o");
const opa3Multi = opaTurns.filter((t) => t.dirs.length > 1).length;
console.log("[Opa] Slide + 3 Actions — multi-move turns:", opa3Multi);
if (opa3Multi !== 0) throw new Error("Even with a 3-point budget, an Opa must never move more than once");
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });

// A Cabeza can NEVER crush another Cabeza — normally or via a wormhole.
// A block still crushes a lone enemy Cabeza.
setBlackHoles([]);
const cabA = { id: "dc", type: "cabeza", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 1 };
const cabB = { id: "lc", type: "cabeza", owner: "light", row: 5, col: 6, w: 1, h: 1, z: 1 };
const cabVsCab = Object.values(legalMovesFor([cabA, cabB], cabA)).filter((m) => m.crushes).length;
const blkVsCab = Object.values(legalMovesFor([{ id: "dt", type: "turrito", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 2 }, cabB], { id: "dt", type: "turrito", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 2 })).filter((m) => m.crushes && m.crushes.id === "lc").length;
console.log("[crush] Cabeza-onto-Cabeza crushes:", cabVsCab, "| block-onto-Cabeza crushes:", blkVsCab);
if (cabVsCab !== 0) throw new Error("A Cabeza must never be able to crush another Cabeza");
if (blkVsCab === 0) throw new Error("A block must still be able to crush a lone enemy Cabeza");
// Wormhole variant: a Cabeza whose ejection square holds an enemy Cabeza
// cannot enter that wormhole at all (no crush, no teleport onto it).
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: true, cantileverPivot: false, splitMovement: false, threeActions: false });
setBlackHoles([{ row: 5, col: 4 }, { row: 4, col: 5 }]); // W entry ejects to (4,6)
const wormCab = { id: "dc2", type: "cabeza", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 1 };
const wormEnemy = { id: "lc2", type: "cabeza", owner: "light", row: 4, col: 6, w: 1, h: 1, z: 1 };
const wormCrush = Object.values(legalMovesFor([wormCab, wormEnemy], wormCab)).filter((m) => m.teleports && m.crushes).length;
if (wormCrush !== 0) throw new Error("A Cabeza must not wormhole-crush an enemy Cabeza at the ejection square");
setBlackHoles([]);
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });

console.log("\nSMOKE TEST PASSED");
