/* The AI must see a crush that takes two rolls. A reported Medium game
   was lost this way: the AI walked its Cabeza alone into Dark's blocks and
   left it where a Flaco could roll west, then south onto it — a threat
   the evaluation only counted when it took a single roll. */
import { setActiveLaws, setBlackHoles, setMissingSquares } from "../engine/constants.js";
import { cabezaInDanger, evaluatePosition, findBestAiTurn, generateTurns } from "../engine/ai.js";

let failed = 0;
function check(name, ok) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed++;
}

setActiveLaws({ splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, threeActions: false, shoving: false, shoveFar: false, shoveOnRolls: false, cantileverPivot: false });
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

if (failed) { console.log(`AI THREATS: ${failed} FAILED`); process.exit(1); }
console.log("AI THREATS PASSED");
