/* The AI must see a crush that takes two rolls. A reported Medium game
   was lost this way: the AI walked its Cabeza alone into Dark's blocks and
   left it where a Flaco could roll west, then south onto it — a threat
   the evaluation only counted when it took a single roll. */
import { setActiveLaws, setBlackHoles, setMissingSquares } from "../engine/constants.js";
import { cabezaInDanger, cabezaThreats, crushLine, cabezaEscapes, evaluatePosition, findBestAiTurn, generateTurns, AI_DIFFICULTY, placeKey } from "../engine/ai.js";
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

// A forced crush at a one-turn search: Light's Cabeza is cornered (two
// missing squares above it), so after Dark's Turrito rolls west twice,
// every Light reply leaves it in the Turrito's reach. The AI must see
// that the threat can't be answered and play it.
setActiveLaws({ splitMovement: false, slide: false, threeActions: false, shoving: false, cantileverPivot: false });
setMissingSquares([{ row: 8, col: 0 }, { row: 8, col: 1 }]);
{
  const net = [cab("dark-cabeza", "dark", 0, 9), cube("dark-turrito", "dark", 9, 4), cab("light-cabeza", "light", 9, 0), cube("light-turrito", "light", 0, 0)];
  // Threats and room to run weighed at nothing, so only the forced-crush
  // search can tell W.W from any other turn.
  const blind = { ...AI_DIFFICULTY.medium, maxDepth: 1, jitter: 0, openingJitter: 0, threatBonus: 0, cabezaSafety: 0 };
  const without = await findBestAiTurn(net, "dark", { ...blind, forcedCrush: false }, 0, 10, {});
  const plan = await findBestAiTurn(net, "dark", { ...blind, forcedCrush: true }, 0, 10, {});
  check(`a threat with no answer is found and played (played ${plan.pieceId} ${plan.dirs.join(".")}; without the search, ${without.pieceId} ${without.dirs.join(".")})`,
    plan.pieceId === "dark-turrito" && plan.dirs.join(".") === "W.W" && !(without.pieceId === "dark-turrito" && without.dirs.join(".") === "W.W"));
}
setMissingSquares([]);

// Putting a piece straight back where it stood a turn ago costs it, in a
// game where the AI searches one turn (here 3 Actions): the same quiet
// opening, the same settings without noise, but the square the first
// choice would put its piece on is one it just left. In the classic game
// it costs nothing (it cost Medium strength there).
for (const fast of [true, false]) {
  setActiveLaws({ threeActions: fast });
  const opening = createInitialPieces();
  const quiet = { ...AI_DIFFICULTY.medium, maxDepth: 1, jitter: 0, openingJitter: 0 };
  const first = await findBestAiTurn(opening, "dark", quiet, 0, 10, {});
  const board = opening.map((p) => ({ ...p }));
  const turn = generateTurns(board, "dark").find((t) => !t.steps && t.pieceId === first.pieceId && t.dirs.join() === first.dirs.join());
  for (const m of turn.moves) Object.assign(turn.piece, m.candidate);
  const again = await findBestAiTurn(opening, "dark", quiet, 0, 10, {}, { [first.pieceId]: [placeKey(turn.piece)] });
  const same = again.pieceId === first.pieceId && again.dirs.join() === first.dirs.join();
  check(fast
    ? `3 Actions: a piece isn't put back where it just stood (${first.pieceId} ${first.dirs.join(".")}, then ${again.pieceId} ${again.dirs.join(".")})`
    : `the classic game: no put-back cost (${first.pieceId} ${first.dirs.join(".")} both times)`, fast ? !same : same);
}
setActiveLaws({ threeActions: false });

// The check alert (chassis): which enemy pieces could crush a Cabeza on
// their next turn, by name, from the position as it stands; the pieces
// passed in are left as they were.
{
  const two = twoRoll.map((p) => ({ ...p }));
  const before = JSON.stringify(two);
  const t = cabezaThreats(two, "light");
  check(`the check alert names the block two rolls away (${JSON.stringify(t)})`, t.length === 1 && t[0].attacker === "dark-turrito" && t[0].cabeza === "light-cabeza");
  check("...and leaves the pieces as they were", JSON.stringify(two) === before);
  check("nothing in reach, no check", cabezaThreats(far, "light").length === 0);
  check("the other side's Cabeza isn't in check here", cabezaThreats(two, "dark").length === 0);
  // The user's video: a light Hombro lying over a dark Flaco, the dark
  // Cabeza two squares east past a Turrito. With the Turrito there, no
  // check (its arm can't come down through it); without it, the Hombro.
  const hombro = { id: "light-hombro", type: "hombro", owner: "light", row: 0, col: 3, w: 2, h: 2, z: 2, vox: "0,0,0;0,0,1;0,1,1;1,0,1" };
  const flaco = { id: "dark-flaco", type: "flaco", owner: "dark", row: 0, col: 4, w: 1, h: 2, z: 1 };
  const video = [hombro, flaco, cube("dark-turrito", "dark", 0, 5), cab("dark-cabeza", "dark", 0, 6), cab("light-cabeza", "light", 9, 9)];
  check("the video's Hombro, the Turrito in the way: no check", cabezaThreats(video, "dark").length === 0);
  const open = video.filter((p) => p.id !== "dark-turrito");
  const o = cabezaThreats(open, "dark");
  check(`...the Turrito gone: the Hombro has the Cabeza in check (${JSON.stringify(o)})`, o.length === 1 && o[0].attacker === "light-hombro");
  // Show me: the line it crushes by, move by move.
  const hl = crushLine(open, "light-hombro", "dark-cabeza");
  check(`Show me: the Hombro's line is one tumble east onto the Cabeza (${JSON.stringify(hl && hl.map((s) => [s.dir, s.kind, s.to.col]))})`, !!hl && hl.length === 1 && hl[0].dir === "E" && hl[0].kind === "roll" && hl[0].from.col === 3 && hl[0].to.col === 5);
  const tl = crushLine(twoRoll, "dark-turrito", "light-cabeza");
  check(`...the Turrito's, two rolls, the second onto it (${JSON.stringify(tl && tl.map((s) => [s.dir, s.to.row, s.to.col]))})`, !!tl && tl.length === 2 && tl[1].to.row === 4 && tl[1].to.col === 4 && tl[0].to.row + tl[0].to.col === 7);
  check("...none where it can't reach", crushLine(video, "light-hombro", "dark-cabeza") === null);
  // The safe squares: where the Cabeza can get to this turn, safe or not.
  const esc = cabezaEscapes(twoRoll, "light-cabeza", 2);
  const safe = esc.filter((e) => e.safe), unsafe = esc.filter((e) => !e.safe);
  check(`the Cabeza's squares this turn, safe and not (${esc.length}: ${safe.length} safe)`, esc.length >= 4 && safe.length >= 1 && unsafe.length >= 1 && !esc.some((e) => e.row === 4 && e.col === 4));
  check("...each safe one really out of reach", safe.every((e) => cabezaThreats(twoRoll.map((p) => (p.id === "light-cabeza" ? { ...p, row: e.row, col: e.col } : p)), "light").length === 0));
  check("...and none with no actions left", cabezaEscapes(twoRoll, "light-cabeza", 0).length === 0);
}

if (failed) { console.log(`AI THREATS: ${failed} FAILED`); process.exit(1); }
console.log("AI THREATS PASSED");
