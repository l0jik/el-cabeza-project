/* The AI must see a crush that takes two rolls. A reported Medium game
   was lost this way: the AI walked its Cabeza alone into Dark's blocks and
   left it where a Flaco could roll west, then south onto it — a threat
   the evaluation only counted when it took a single roll. */
import { setActiveLaws, setBlackHoles, setMissingSquares } from "../engine/constants.js";
import { cabezaInDanger, evaluatePosition, findBestAiTurn, generateTurns, AI_DIFFICULTY, placeKey } from "../engine/ai.js";
import { createInitialPieces } from "../engine/rules.js";
import { generateAnomalySetup } from "../engine/anomaly.js";

let failed = 0;
function check(name, ok) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed++;
}

setActiveLaws({ splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, threeActions: false, shoving: false, cantileverPivot: false });
setBlackHoles([]);
setMissingSquares([]);

const cube = (id, owner, row, col) => ({ id, type: "turrito", owner, row, col, w: 1, h: 1, z: 1 });
const cab = (id, owner, row, col) => ({ id, type: "cabeza", owner, row, col, w: 1, h: 1, z: 1 });

// Dark's cube at (3,3) reaches (4,4) only by two rolls (south, then east).
const twoRoll = [cab("dark-cabeza", "dark", 0, 9), cube("dark-turrito", "dark", 3, 3), cab("light-cabeza", "light", 4, 4), cube("light-turrito", "light", 9, 0)];
check("a Cabeza two rolls from an enemy block is in danger", cabezaInDanger(twoRoll, "light"));
check("the evaluation reads it as lost when Dark moves next", evaluatePosition(twoRoll, "light", undefined, "dark") < -10000);

// Out of reach: three squares away diagonally needs more than two rolls.
const far = twoRoll.map((p) => (p.id === "light-cabeza" ? { ...p, row: 6, col: 6 } : p));
check("a Cabeza out of two-roll reach is not", !cabezaInDanger(far, "light"));
check("...and the evaluation doesn't read it as lost", evaluatePosition(far, "light", undefined, "dark") > -10000);

// Light to move, its Cabeza hanging to the two-roll crush: Medium's
// settings must move it (or otherwise make it safe), not ignore it.
const turn = await findBestAiTurn(twoRoll, "light", { maxDepth: 2, timeBudgetMs: 1500, cabezaRepeatBias: 11, pieceRepeatBias: 6, blockAdvance: 0.8, wall: 2, beam: 8 }, 3, 10);
const chosen = generateTurns(twoRoll.map((p) => ({ ...p })), "light").find((t) => t.pieceId === turn.pieceId && t.dirs.join() === turn.dirs.join());
const after = twoRoll.map((p) => ({ ...p }));
{
  const piece = after.find((p) => p.id === chosen.pieceId);
  for (const m of chosen.moves) Object.assign(piece, m.candidate);
}
check(`the AI (to move, Cabeza streak 3) gets its Cabeza out of reach — played ${turn.pieceId} ${turn.dirs.join(".")}`, !cabezaInDanger(after, "light"));

/* The whole turn, with "3 Actions" (a reported Medium game: Slides, Split
   Movement, 3 Actions). Dark's Turrito crushed Light's Cabeza with three
   rolls south, the turn after Medium walked the Cabeza into their reach:
   the AI only ever looked two rolls ahead. */
setActiveLaws({ threeActions: true, slide: true, splitMovement: true });
const threeRoll = [cab("dark-cabeza", "dark", 0, 9), cube("dark-turrito", "dark", 2, 4), cab("light-cabeza", "light", 5, 4), cube("light-turrito", "light", 9, 0)];
check("3 Actions: a Cabeza three rolls from an enemy Turrito is in danger", cabezaInDanger(threeRoll, "light"));
check("...and the evaluation reads it as lost when Dark moves next", evaluatePosition(threeRoll, "light", undefined, "dark") < -10000);
const fourAway = threeRoll.map((p) => (p.id === "light-cabeza" ? { ...p, row: 6 } : p));
check("...four rolls away it is not", !cabezaInDanger(fourAway, "light") && evaluatePosition(fourAway, "light", undefined, "dark") > -10000);
// Light to move, its Cabeza safe four rows from the Turrito: every step
// forward walks into the three-roll reach. Medium must not take one, even
// looking only at its own turn: that's all it had time for in the
// reported game (Split Movement and 3 Actions make hundreds of turns a side).
for (let i = 0; i < 3; i++) {
  const plan = await findBestAiTurn(fourAway, "light", { ...AI_DIFFICULTY.medium, maxDepth: 1 }, 0, 10, {});
  const board = fourAway.map((p) => ({ ...p }));
  const played = generateTurns(board, "light").find((t) => (t.steps
    ? t.steps.map((st) => st.pieceId + ":" + st.dir).join() === (plan.steps || []).map((st) => st.pieceId + ":" + st.dir).join()
    : !plan.steps && t.pieceId === plan.pieceId && t.dirs.join() === plan.dirs.join()));
  for (const st of played.steps || played.moves.map((m) => ({ piece: played.piece, move: m }))) Object.assign(st.piece, st.move.candidate);
  // Judged by every turn Dark could reply with, not by the AI's own check.
  const crushable = generateTurns(board, "dark").some((t) => t.crushes && t.endsGame);
  check(`Medium (3 Actions) keeps its Cabeza out of the Turrito's three rolls — played ${(plan.steps || [{ pieceId: plan.pieceId, dir: plan.dirs.join(".") }]).map((st) => st.pieceId.replace("light-", "") + " " + st.dir).join(", ")}`, !crushable);
}
// A Cabeza three steps from its goal row on an open board walks home in
// one turn with 3 Actions (not with two): the side to move wins there.
const nearHome = [cab("dark-cabeza", "dark", 6, 5), cube("dark-turrito", "dark", 0, 0), cab("light-cabeza", "light", 9, 1), cube("light-turrito", "light", 9, 9)];
check("3 Actions: an enemy Cabeza three steps from home, its side to move, reads as lost", evaluatePosition(nearHome, "light", undefined, "dark") < -10000);
check("...and as won the other way round", evaluatePosition(nearHome, "dark", undefined, "dark") > 10000);
setActiveLaws({ threeActions: false });
check("with two points a turn it isn't", evaluatePosition(nearHome, "light", undefined, "dark") > -10000);
// Random openings under 3 Actions: a standing 2x3 rolls three rows at a
// time, so a shuffle could leave a Cabeza where the first move crushes it.
setActiveLaws({ threeActions: true, slide: true, splitMovement: true, cantileverPivot: true, shoving: true, shoveOnRolls: false });
{
  const roster = [{ type: "rayo", count: 1 }, { type: "block2x3", count: 1 }, { type: "chato", count: 1 }, { type: "turrito", count: 1 }, { type: "cabeza", count: 1 }, { type: "block1x3", count: 1 }];
  let instant = 0;
  for (let i = 0; i < 30; i++) {
    const opening = generateAnomalySetup(roster);
    if (generateTurns(opening, "dark").some((t) => t.crushes && t.endsGame)) instant++;
  }
  check(`no random opening lets the first move crush a Cabeza (${instant} of 30)`, instant === 0);
}
setActiveLaws({ threeActions: false, slide: false, splitMovement: false, cantileverPivot: false, shoving: false });

// Putting a piece straight back where it stood a turn ago costs it: the
// same quiet opening, the same settings without noise, but the square
// the first choice would put its piece on is one it just left.
{
  const opening = createInitialPieces();
  const quiet = { ...AI_DIFFICULTY.medium, maxDepth: 2, jitter: 0, openingJitter: 0 };
  const first = await findBestAiTurn(opening, "dark", quiet, 0, 10, {});
  const board = opening.map((p) => ({ ...p }));
  const turn = generateTurns(board, "dark").find((t) => !t.steps && t.pieceId === first.pieceId && t.dirs.join() === first.dirs.join());
  for (const m of turn.moves) Object.assign(turn.piece, m.candidate);
  const again = await findBestAiTurn(opening, "dark", quiet, 0, 10, {}, { [first.pieceId]: [placeKey(turn.piece)] });
  check(`a piece isn't put back where it just stood (${first.pieceId} ${first.dirs.join(".")}, then ${again.pieceId} ${again.dirs.join(".")})`,
    !(again.pieceId === first.pieceId && again.dirs.join() === first.dirs.join()));
}

if (failed) { console.log(`AI THREATS: ${failed} FAILED`); process.exit(1); }
console.log("AI THREATS PASSED");
