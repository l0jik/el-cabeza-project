import { createInitialPieces, legalMovesFor, sameState, pairLog, turnContinues, evaluateBlockLanding, pickMissingSquares, pickBlackHoleSquares, pickMissingSquarePairs, missingSquaresKeepPath, initialPiecesFor, getPieceAt } from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY, evaluatePosition, generateTurns } from "../engine/ai.js";
import { setBlackHoles, setMissingSquares, turnBudget, MAX_PIECES_PER_TURN, moveCost } from "../engine/constants.js";
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
// buildMissingSquaresPlacement) and its path guard: a 2x3 board has three
// mirror pairs, (0,0)/(1,2), (0,1)/(1,1) and (0,2)/(1,0). The middle pair
// would cut the board in two, and reserving the first must then leave
// only the third.
for (let i = 0; i < 50; i++) {
  const avoidedPair = pickMissingSquares([], 2, 3, [{ row: 0, col: 0 }]);
  const avoidedSet = new Set(avoidedPair.map((p) => `${p.row},${p.col}`));
  if (!(avoidedSet.has("0,2") && avoidedSet.has("1,0")))
    throw new Error(`pickMissingSquares must skip a reserved pair and a board-splitting pair, got ${JSON.stringify(avoidedPair)}`);
}
console.log("[missing squares] pickMissingSquares respects its avoid list");

// The path guard itself: missing squares may never wall any square off.
if (!missingSquaresKeepPath([], 3, 3)) throw new Error("an empty board keeps a path");
if (missingSquaresKeepPath([{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }], 3, 3))
  throw new Error("a full column of missing squares splits the board");
if (missingSquaresKeepPath([{ row: 0, col: 1 }, { row: 1, col: 0 }], 3, 3))
  throw new Error("a corner boxed in by two missing squares is walled off");
if (!missingSquaresKeepPath([{ row: 0, col: 1 }, { row: 2, col: 1 }], 3, 3))
  throw new Error("two missing squares with a gap between them keep a path");
console.log("[missing squares] path guard detects walled-off squares");

// Up to five pairs (ten squares): every square distinct, mirrored in
// pairs, off the opening pieces, and never walling off the board — down
// to the 6x6 minimum.
for (const [rows, cols] of [[6, 6], [8, 8], [7, 9], [20, 20]]) {
  const pieces = initialPiecesFor(rows, cols);
  for (let i = 0; i < 60; i++) {
    const count = 1 + (i % 5);
    const squares = pickMissingSquarePairs(pieces, rows, cols, count);
    if (squares.length !== count * 2) throw new Error(`expected ${count} pairs on ${rows}x${cols}, got ${squares.length / 2}`);
    const keys = new Set(squares.map((q) => `${q.row},${q.col}`));
    if (keys.size !== squares.length) throw new Error(`duplicate missing squares on ${rows}x${cols}`);
    for (let j = 0; j < squares.length; j += 2) {
      const [a, b] = [squares[j], squares[j + 1]];
      if (b.row !== rows - 1 - a.row || b.col !== cols - 1 - a.col) throw new Error("missing squares must come in mirrored pairs");
    }
    if (squares.some((q) => getPieceAt(pieces, q.row, q.col))) throw new Error("a missing square landed on an opening piece");
    if (!missingSquaresKeepPath(squares, rows, cols)) throw new Error(`missing squares walled off part of a ${rows}x${cols} board`);
  }
}
console.log("[missing squares] up to five mirrored pairs, off the pieces, always leaving a path");

// Black Holes never land in either side's back two rows (random placement),
// checked across board heights down to the 6-row minimum.
for (const rows of [6, 7, 10, 20]) {
  for (let i = 0; i < 200; i++) {
    const pair = pickBlackHoleSquares([], rows, 8);
    if (pair.length !== 2) throw new Error(`no black hole pair found on a ${rows}-row board`);
    for (const h of pair) if (h.row < 2 || h.row > rows - 3) throw new Error(`black hole in a back row: ${JSON.stringify(h)} on ${rows} rows`);
  }
}
console.log("[black holes] never placed in either side's back two rows");

// ---- AI Split Movement: with the law on, the AI's candidate turns
// include two-piece turns, and every one of them is a turn a human could
// legally play — replayed step by step on a fresh copy, each step is a
// legal move for its piece with the shared bank's remaining points, the
// bank is never overspent, at most two distinct pieces move, and both
// actually end up changed. Generating them never disturbs the position.
function replaySplit(start, turn, budget) {
  const board = start.map((p) => ({ ...p }));
  let used = 0;
  const moved = new Set();
  for (const st of turn.steps) {
    const q = board.find((p) => p.id === st.pieceId);
    if (!q) throw new Error(`split step names a missing piece ${st.pieceId}`);
    const move = legalMovesFor(board, q, budget - used)[st.dir];
    if (!move) throw new Error(`illegal split step ${st.pieceId} ${st.dir} after ${used} points: ${JSON.stringify(turn.steps.map((x) => x.pieceId + ":" + x.dir))}`);
    used += moveCost(move);
    moved.add(q.id);
    Object.assign(q, move.candidate);
    if (move.crushes) board.splice(board.findIndex((p) => p.id === move.crushes.id), 1);
  }
  if (used > budget) throw new Error(`split turn overspent the bank (${used} > ${budget})`);
  if (moved.size !== 2) throw new Error(`split turn moved ${moved.size} pieces`);
  return board;
}
for (const threeActions of [false, true]) {
  // Slides on alongside 3 Actions: a slide (2 points) then another piece's roll (1).
  setActiveLaws({ splitMovement: true, threeActions, slide: threeActions, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false });
  let position = createInitialPieces().map((p) => ({ ...p }));
  let player = "light";
  let splitSeen = 0;
  for (let ply = 0; ply < 12; ply++) {
    const before = JSON.stringify(position);
    const turns = generateTurns(position, player);
    if (JSON.stringify(position) !== before) throw new Error("generateTurns must leave the position exactly as it found it");
    for (const t of turns.filter((t) => t.steps)) {
      replaySplit(position, t, turnBudget());
      splitSeen++;
    }
    // Advance by a random non-terminal turn to reach varied positions.
    const pool = turns.filter((t) => !t.endsGame);
    if (!pool.length) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    position = pick.steps
      ? replaySplit(position, pick, turnBudget())
      : (() => {
          const b = position.map((p) => ({ ...p }));
          const q = b.find((p) => p.id === pick.pieceId);
          for (const mv of pick.moves) { Object.assign(q, mv.candidate); if (mv.crushes) b.splice(b.findIndex((p) => p.id === mv.crushes.id), 1); }
          return b;
        })();
    player = player === "light" ? "dark" : "light";
  }
  if (!splitSeen) throw new Error(`no two-piece turns generated with Split Movement on (threeActions=${threeActions})`);
  console.log(`[split movement] ${splitSeen} AI two-piece turns replayed legally (3 Actions + Slide ${threeActions ? "on" : "off"})`);
}
// Without the law, no two-piece turns at all.
setActiveLaws({ splitMovement: false, threeActions: false });
if (generateTurns(createInitialPieces().map((p) => ({ ...p })), "light").some((t) => t.steps))
  throw new Error("two-piece turns must only exist under Split Movement");
// The AI's actual pick under the law is a playable plan.
setActiveLaws({ splitMovement: true, threeActions: false });
{
  const start = createInitialPieces();
  const plan = await findBestAiTurn(start, "dark", { ...AI_DIFFICULTY.easy, timeBudgetMs: 400 }, 0, 10);
  if (!plan) throw new Error("the AI found no turn under Split Movement");
  if (plan.steps) replaySplit(start, plan, turnBudget());
  console.log(`[split movement] AI plan under the law is playable: ${JSON.stringify(plan.steps || plan.dirs)}`);
}
setActiveLaws({ splitMovement: false, threeActions: false });

// ---- Shoving LAW ----
// The rule: a piece rolling or sliding into pieces whose cubes, all
// together, are fewer than its own pushes them. A slide pushes them one
// square; a roll pushes them just past where it lands. Anything behind a
// pushed piece blocks (lines are never pushed); several pieces side by
// side in the way are all pushed. A shove costs 1 point more.
{
  const LAWS_OFF = { splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false, shoving: false };
  const P = (id, type, row, col, w, h, z, owner = "dark") => ({ id, type, owner, row, col, w, h, z });
  const shoveCheck = (label, cond, detail) => { if (!cond) throw new Error(`[shoving] ${label}${detail ? " — " + detail : ""}`); };
  const moved = (m, id) => m && m.shoves && m.shoves.find((q) => q.id === id);
  const chato = P("ch", "chato", 4, 3, 1, 2, 2); // 4 cubes, rows 4-5
  const turrito = P("tu", "turrito", 4, 4, 1, 1, 1, "light"); // 1 cube, east of the Chato
  const opa = P("op", "opa", 4, 2, 2, 2, 2); // 8 cubes, rows 4-5, cols 2-3
  const standingFlaco = P("fl", "flaco", 4, 4, 1, 1, 2, "light"); // 2 cubes, as tall as the Opa
  let m;

  setActiveLaws({ ...LAWS_OFF, slide: true, threeActions: true });
  shoveCheck("without the law a slide into a piece is blocked", !legalMovesFor([chato, turrito], chato, 3)["slide-E"]);

  // Slides: exactly one square.
  setActiveLaws({ ...LAWS_OFF, slide: true, threeActions: true, shoving: true });
  m = legalMovesFor([chato, turrito], chato, 3)["slide-E"];
  shoveCheck("a slide into a lighter piece pushes it one square", m && m.shoves.length === 1 && moved(m, "tu").col === 5 && moved(m, "tu").row === 4, JSON.stringify(m));
  shoveCheck("a shoving slide costs 3 points", moveCost(m) === 3);
  shoveCheck("with only 2 points left it isn't offered", !legalMovesFor([chato, turrito], chato, 2)["slide-E"]);
  m = legalMovesFor([opa, standingFlaco], opa, 3)["slide-E"];
  shoveCheck("an Opa slides into a standing Flaco (as tall as it) and pushes it one square", m && moved(m, "fl").col === 5, JSON.stringify(m));
  shoveCheck("equal mass can't shove", !legalMovesFor([P("f1", "flaco", 4, 3, 1, 2, 1), P("f2", "flaco", 4, 4, 1, 2, 1, "light")], P("f1", "flaco", 4, 3, 1, 2, 1), 3)["slide-E"]);
  const flat = P("bk", "block2x3", 4, 2, 2, 2, 1); // 4 cubes, flat
  shoveCheck("height doesn't count: a flat piece pushes a taller, lighter one", !!legalMovesFor([flat, standingFlaco], flat, 3)["slide-E"]);
  shoveCheck("...and a tall piece can't push a lower, heavier one", !legalMovesFor([P("t", "flaco", 4, 3, 1, 1, 2), P("lo", "chato", 4, 4, 2, 2, 1, "light")], P("t", "flaco", 4, 3, 1, 1, 2), 3)["slide-E"]);
  shoveCheck("a line can't be pushed: a piece behind the pushed one blocks", !legalMovesFor([chato, turrito, P("t2", "turrito", 4, 5, 1, 1, 1)], chato, 3)["slide-E"]);
  // Side by side: everything in the way is pushed, if lighter all together.
  const tur = P("t1", "turrito", 4, 4, 1, 1, 1, "light"), cab = P("cb", "cabeza", 5, 4, 1, 1, 1);
  m = legalMovesFor([opa, tur, cab], opa, 3)["slide-E"];
  shoveCheck("a Turrito and a Cabeza side by side are both pushed one square", m && m.shoves.length === 2 && moved(m, "t1").col === 5 && moved(m, "cb").col === 5, JSON.stringify(m));
  shoveCheck("...but not if anything is behind either of them", !legalMovesFor([opa, tur, cab, P("x", "turrito", 5, 5, 1, 1, 1)], opa, 3)["slide-E"]);
  shoveCheck("masses add up: two Flacos side by side (2 + 2) aren't lighter than a Chato (4)",
    !legalMovesFor([chato, P("a", "flaco", 4, 4, 1, 1, 2, "light"), P("b", "flaco", 5, 4, 1, 1, 2, "light")], chato, 3)["slide-E"]);
  shoveCheck("nothing is pushed off the board", !legalMovesFor([P("ch", "chato", 4, 8, 1, 2, 2), P("tu", "turrito", 4, 9, 1, 1, 1, "light")], P("ch", "chato", 4, 8, 1, 2, 2), 3)["slide-E"]);
  setMissingSquares([{ row: 4, col: 5 }]);
  shoveCheck("nothing is pushed onto a Missing Square", !legalMovesFor([chato, turrito], chato, 3)["slide-E"]);
  setMissingSquares([]);
  m = legalMovesFor([chato, P("cf", "cabeza", 4, 4, 1, 1, 1)], chato, 3)["slide-E"];
  shoveCheck("a Cabeza can be shoved", moved(m, "cf"));

  // Black Holes: a Turrito drops through; a Flaco is blocked.
  setActiveLaws({ ...LAWS_OFF, slide: true, threeActions: true, shoving: true, blackHoleSquares: true });
  setBlackHoles([{ row: 4, col: 5 }, { row: 7, col: 7 }]);
  m = legalMovesFor([chato, turrito], chato, 3)["slide-E"];
  shoveCheck("a shoved Turrito drops into a Black Hole and comes out past the pair", moved(m, "tu") && moved(m, "tu").teleports && moved(m, "tu").row === 7 && moved(m, "tu").col === 6, JSON.stringify(m));
  shoveCheck("a Flaco can't be shoved into a Black Hole", !legalMovesFor([chato, P("fs", "flaco", 4, 4, 1, 1, 2, "light")], chato, 3)["slide-E"]);
  setBlackHoles([]);

  // Rolls: pushed just past where the roller lands.
  setActiveLaws({ ...LAWS_OFF, shoving: true, threeActions: true });
  m = legalMovesFor([opa, standingFlaco], opa, 3).E;
  shoveCheck("an Opa rolling into a standing Flaco pushes it just past its landing (2 squares)", m && moved(m, "fl").col === 6 && moved(m, "fl").row === 4, JSON.stringify(m));
  shoveCheck("...for 3 points (an Opa move 2, the shove 1)", moveCost(m) === 3);
  shoveCheck("...so not on a 2-point turn", !legalMovesFor([opa, standingFlaco], opa, 2).E);
  m = legalMovesFor([opa, P("far", "turrito", 4, 5, 1, 1, 1, "light")], opa, 3).E;
  shoveCheck("a piece in the far half of the landing goes 1 square, just past it", m && moved(m, "far").col === 6, JSON.stringify(m));
  m = legalMovesFor([opa, tur, cab], opa, 3).E;
  shoveCheck("an Opa rolling into a Turrito and a Cabeza side by side pushes both past its landing", m && m.shoves.length === 2 && moved(m, "t1").col === 6 && moved(m, "cb").col === 6, JSON.stringify(m));
  shoveCheck("a line inside the landing can't be pushed", !legalMovesFor([opa, P("l1", "turrito", 4, 4, 1, 1, 1, "light"), P("l2", "turrito", 4, 5, 1, 1, 1, "light")], opa, 3).E);
  shoveCheck("a piece where the pushed one must go blocks the roll", !legalMovesFor([opa, standingFlaco, P("bh", "turrito", 4, 6, 1, 1, 1)], opa, 3).E);
  shoveCheck("...one further on doesn't", !!legalMovesFor([opa, standingFlaco, P("bh", "turrito", 4, 7, 1, 1, 1)], opa, 3).E);
  const chatoTall = P("ct", "chato", 4, 3, 1, 1, 2); // 2 cubes standing, rolls E to cols 4-5
  m = legalMovesFor([chatoTall, P("t3", "turrito", 4, 4, 1, 1, 1, "light")], chatoTall, 2).E;
  shoveCheck("a shoving roll costs 2 points", m && moveCost(m) === 2 && moved(m, "t3").col === 6, JSON.stringify(m));
  const enemyCab = P("ec", "cabeza", 4, 4, 1, 1, 1, "light");
  m = legalMovesFor([chatoTall, enemyCab], chatoTall, 2).E;
  shoveCheck("a roll onto a lone enemy Cabeza is still a crush", m && m.crushes && !m.shoves, JSON.stringify(m));

  // The AI sees shoves (several pieces at once too), and applying/undoing
  // them restores the board exactly.
  setActiveLaws({ ...LAWS_OFF, slide: true, threeActions: true, shoving: true });
  const board = [{ ...opa }, { ...tur }, { ...cab, owner: "light", id: "lcb" }, P("dc", "cabeza", 0, 0, 1, 1, 1), P("lc", "cabeza", 9, 9, 1, 1, 1, "light")];
  const before = JSON.stringify(board);
  const turns = generateTurns(board, "dark");
  shoveCheck("the AI's candidate turns include a shove of two pieces", turns.some((t) => t.moves.some((mv) => mv.shoves && mv.shoves.length === 2)));
  shoveCheck("generating them leaves the board untouched", JSON.stringify(board) === before);
  const plan = await findBestAiTurn(board, "dark", { ...AI_DIFFICULTY.easy, timeBudgetMs: 300 }, 0, 10);
  shoveCheck("the AI still finds a turn with Shoving on", !!plan);
  setActiveLaws(LAWS_OFF);
  console.log("[shoving] lighter-in-total pieces pushed; slide 1, roll clear of landing; side by side yes, lines no; mass not height; holes, edges, Missing Squares; +1 point; crushes intact; AI sees it");
}

// ---------- Cantilever Pivot LAW ----------
{
  const LAWS_OFF = { splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false, shoving: false };
  const ok = (label, cond, detail) => { if (!cond) throw new Error(`[pivot] ${label}${detail ? " — " + detail : ""}`); };
  const balanced = { id: "co", type: "codo", owner: "dark", row: 4, col: 4, w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1" };
  const standing = { id: "co", type: "codo", owner: "dark", row: 4, col: 4, w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,0" };
  const tall = { id: "tu", type: "turrito", owner: "light", row: 5, col: 5, w: 1, h: 1, z: 2 };
  const keys = (ps, p) => Object.keys(legalMovesFor(ps, p)).filter((k) => k.startsWith("pivot-")).sort().join(",");

  setActiveLaws(LAWS_OFF);
  ok("no pivots without the law", keys([balanced], balanced) === "");
  setActiveLaws({ ...LAWS_OFF, cantileverPivot: true });
  ok("a Codo balanced on one cube can pivot both ways", keys([balanced], balanced) === "pivot-ccw,pivot-cw", keys([balanced], balanced));
  ok("a standing Codo (two cubes down) can't pivot", keys([standing], standing) === "");
  ok("a box never pivots", keys([tall], tall) === "");
  ok("a 2-tall piece on the swept diagonal blocks that way only", keys([balanced, tall], balanced) === "pivot-ccw", keys([balanced, tall], balanced));
  const low = { ...tall, id: "cb", type: "cabeza", z: 1 };
  ok("a 1-tall piece never blocks (the arm passes over it)", keys([balanced, low], balanced) === "pivot-ccw,pivot-cw");
  const edge = { ...balanced, row: 0 }; // arm east on the top row: ccw would put it off the board
  ok("the arm can't end off the board", keys([edge], edge) === "pivot-cw", keys([edge], edge));
  const m = legalMovesFor([balanced], balanced)["pivot-cw"];
  ok("a pivot costs 1 point and crushes nothing", moveCost(m) === 1 && !m.crushes);
  const back = legalMovesFor([m.candidate], m.candidate)["pivot-ccw"].candidate;
  ok("pivoting back restores the piece exactly", sameState(back, balanced));
  const turns = generateTurns([balanced, { id: "dk", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 }, { id: "lk", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 }], "dark");
  ok("the AI's turn list includes pivots, and a half turn both ways round",
    turns.some((t) => t.dirs.join() === "pivot-cw,pivot-cw") && turns.some((t) => t.dirs.join() === "pivot-ccw,pivot-ccw"));
  setActiveLaws(LAWS_OFF);
  console.log("[pivot] one-cube stance only; both ways; swept diagonal blocks; 1-tall never blocks; stays on board; 1 point; exact inverse; AI sees it");
}

// ---- The move log pairs rounds in play order ----
// Light opening must not leave a "—" in Dark's slot on round 1 (it read as
// a skipped turn); a Light-opened log pairs Light-then-Dark.
{
  const e = (player, notation) => ({ player, notation });
  const lightFirst = pairLog([e("light", "a"), e("dark", "b"), e("light", "c"), e("dark", "d"), e("light", "x")]);
  if (lightFirst.length !== 3) throw new Error("Light-opened log: expected 3 rounds, got " + lightFirst.length);
  if (lightFirst[0].opener !== "light" || lightFirst[0].light.notation !== "a" || lightFirst[0].dark.notation !== "b") throw new Error("Light-opened round 1 should be Light a, Dark b");
  if (lightFirst[2].light.notation !== "x" || lightFirst[2].dark) throw new Error("A round the game ended in should hold only the opener's move");
  const darkFirst = pairLog([e("dark", "a"), e("light", "b"), e("dark", "c")]);
  if (darkFirst.length !== 2 || darkFirst[0].opener !== "dark" || darkFirst[0].light.notation !== "b" || darkFirst[1].light) throw new Error("Dark-opened log pairs Dark-then-Light, unchanged");
  console.log("[log] rounds pair from whoever opened");
}

console.log("\nSMOKE TEST PASSED");
