import { createInitialPieces, legalMovesFor, sameState, pairLog, turnContinues, evaluateBlockLanding, pickMissingSquares } from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY, evaluatePosition, generateTurns } from "../engine/ai.js";
import { setBlackHoles, setMissingSquares, turnBudget, MAX_PIECES_PER_TURN } from "../engine/constants.js";
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

// ---- Split Movement bank sizing ----
// turnBudget() is the whole-turn action-point bank the Split Movement law
// spends across up to MAX_PIECES_PER_TURN pieces: 2 normally, 3 with "3
// Actions". (The engine only sizes the bank/cap; the cross-piece spending
// itself is driven in the chassis for the human player.)
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: true, threeActions: false });
if (turnBudget() !== 2) throw new Error("Split Movement alone is a 2-point bank");
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: true, threeActions: true });
if (turnBudget() !== 3) throw new Error("Split Movement + 3 Actions is a 3-point bank");
if (MAX_PIECES_PER_TURN !== 2) throw new Error("At most two pieces may move in a turn");
console.log("[split] bank 2/3 and 2-piece cap OK");

// turnContinues is the single "is there another move?" rule the live game
// and AI both defer to. Board: an Opa plus a Turrito (both Dark) with the
// two Cabezas parked out of the way. Budget 3 (Split + 3 Actions).
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: true, threeActions: true });
const contPieces = [
  { id: "o", type: "opa", owner: "dark", row: 4, col: 4, w: 2, h: 2, z: 2 },
  { id: "t", type: "turrito", owner: "dark", row: 1, col: 1, w: 1, h: 1, z: 2 },
  { id: "cd", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 2 },
  { id: "cl", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 2 },
];
const contOpa = contPieces[0];
const contT = contPieces[1];
// Opa just rolled (used 2 of 3). It can't move again (its cheapest move is
// 2, only 1 left), but with Split Movement the Turrito can spend the last
// point — so the turn stays open.
if (turnContinues(contPieces, "dark", ["o"], contOpa, 2, 3, true) !== true)
  throw new Error("Split: after an Opa roll a different piece may still take the leftover point");
// Same position WITHOUT Split Movement: the Opa is done and no other piece
// may join, so the turn ends.
if (turnContinues(contPieces, "dark", ["o"], contOpa, 2, 3, false) !== false)
  throw new Error("Without Split Movement a spent Opa ends the turn");
// The 2-piece cap: two distinct pieces have already moved, so no third may
// start even though a point remains.
if (turnContinues(contPieces, "dark", ["o", "t"], contOpa, 2, 3, true) !== false)
  throw new Error("At most two distinct pieces may move, even with a point left");
// A spent bank always ends the turn, Split or not.
if (turnContinues(contPieces, "dark", ["o"], contOpa, 3, 3, true) !== false)
  throw new Error("A spent bank ends the turn");
// A piece that can still move itself keeps the turn open with or without Split.
if (turnContinues(contPieces, "dark", ["t"], contT, 1, 3, false) !== true)
  throw new Error("A piece with a legal move and points left continues its own turn");
console.log("[split] turnContinues: Opa+leftover, no-split, 2-piece cap, spent-bank OK");
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });

// ---- Missing Squares TOPOLOGIES option: unlike Black Hole Squares,
// simply impassable — no wormhole, no teleport, no crush. A candidate
// whose footprint overlaps one at all is illegal, checked at both
// chokepoints every move type funnels through. ----
// A Cabeza step directly onto one is refused; other directions stay legal.
setMissingSquares([{ row: 5, col: 6 }]);
const missCab = { id: "mc", type: "cabeza", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 1 };
const missMoves = legalMovesFor([missCab], missCab);
if (missMoves.E) throw new Error("A Cabeza must not be able to step onto a Missing Square");
if (!missMoves.W) throw new Error("A Cabeza's other directions must stay legal near a Missing Square");
console.log("[missing squares] Cabeza step onto a missing square refused, others OK");

// A block's landing footprint overlapping one at all is illegal (any
// overlap, not just an exact single-cell match — unlike a black hole,
// which requires an exact 1-cell fit to redirect).
setMissingSquares([{ row: 3, col: 3 }, { row: 3, col: 4 }]);
const missBlock = { id: "mb", type: "chato", owner: "dark", row: 3, col: 3, w: 2, h: 1, z: 2 };
const missBlockVerdict = evaluateBlockLanding([], missBlock, [0, 1]);
if (missBlockVerdict.legal) throw new Error("A block landing on a Missing Square must be illegal");
const clearBlockVerdict = evaluateBlockLanding([], { ...missBlock, row: 6, col: 6 }, [0, 1]);
if (!clearBlockVerdict.legal) throw new Error("A block landing clear of any Missing Square must stay legal");
console.log("[missing squares] block landing overlap refused, clear landing OK");

// A wormhole must not eject a piece onto a Missing Square either — same
// "checked wherever a candidate is checked" reasoning as the crush test
// above, just for the ejection square instead of the hole itself.
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: true, cantileverPivot: false, splitMovement: false, threeActions: false });
setBlackHoles([{ row: 5, col: 4 }, { row: 4, col: 5 }]); // W entry ejects to (4,6)
setMissingSquares([{ row: 4, col: 6 }]);
const wormMissCab = { id: "dc4", type: "cabeza", owner: "dark", row: 5, col: 5, w: 1, h: 1, z: 1 };
const wormMissMoves = legalMovesFor([wormMissCab], wormMissCab);
if (wormMissMoves.W) throw new Error("A wormhole must not eject a piece onto a Missing Square");
setBlackHoles([]);
setMissingSquares([]);
setActiveLaws({ slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, splitMovement: false, threeActions: false });
console.log("[missing squares] wormhole ejection onto a missing square refused");

// pickMissingSquares' own avoid list (used to keep it off Black Hole
// Squares' cells when both are active — see themes/neon-singularity.js's
// buildPairedSquarePlacement): a 2x2 board has exactly two possible
// mirror pairs, (0,0)/(1,1) and (0,1)/(1,0) — reserving the first must
// deterministically leave only the second.
const avoidedPair = pickMissingSquares([], 2, 2, [{ row: 0, col: 0 }]);
const avoidedSet = new Set(avoidedPair.map((p) => `${p.row},${p.col}`));
if (!(avoidedSet.has("0,1") && avoidedSet.has("1,0")))
  throw new Error(`pickMissingSquares must skip a reserved pair, got ${JSON.stringify(avoidedPair)}`);
console.log("[missing squares] pickMissingSquares respects its avoid list");

console.log("\nSMOKE TEST PASSED");
