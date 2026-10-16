/* Black Hole Squares with two sets (user: "add the option to increase the
   number of black hole sets to 2 ... the player's piece will show the exit
   point at ... only the 2 that are on the other side of the board"):
   where a piece dropping into a hole may come out, the second way out as
   its own move key, shoves, placement, a replay code and the computer.
     node tests/black-hole-sets.smoke.mjs */
import {
  legalMovesFor, holeExits, pickBlackHoleSets, holesTouch, blackHoleRowAllowed, createInitialPieces,
} from "../engine/rules.js";
import {
  setActiveLaws, setBlackHoles, setBoardDimensions, plainKeyOf, isOtherExitKey, otherExitKey, baseDirOfSlideKey,
} from "../engine/constants.js";
import { encodeReplay, decodeReplay, checkReplay, VANILLA_LAWS } from "../engine/replay.js";
import { generateTurns, findBestAiTurn, AI_DIFFICULTY, cabezaThreats, evaluatePosition } from "../engine/ai.js";

let failed = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
};
const P = (id, type, row, col, w, h, z, owner = "dark") => ({ id, type, owner, row, col, w, h, z });
const at = (m) => m && `${m.candidate.row},${m.candidate.col}`;
const LAWS_OFF = { ...VANILLA_LAWS };

setBoardDimensions(10, 10);
setActiveLaws({ ...LAWS_OFF, blackHoleSquares: true });
// Two mirrored pairs on 10 x 10: A (3,2)-(6,7), B (2,6)-(7,3). A1 and B1
// are in the top half, A2 and B2 in the bottom.
const A1 = { row: 3, col: 2 }, A2 = { row: 6, col: 7 }, B1 = { row: 2, col: 6 }, B2 = { row: 7, col: 3 };
const FOUR = [A1, A2, B1, B2];
setBlackHoles(FOUR);

console.log("where a piece comes out");
const ex = (h) => holeExits(h).map((b) => `${b.row},${b.col}`).join(" ");
check("into A1: out of A2 (its partner) or B2, the far side's two", ex(A1) === "6,7 7,3", ex(A1));
check("into B2: out of B1 (its partner) or A1", ex(B2) === "2,6 3,2", ex(B2));
check("into A2: out of A1 or B1, never A2's own side", ex(A2) === "3,2 2,6", ex(A2));
setBlackHoles([A1, A2]);
check("one set: the other hole, as always", ex(A1) === "6,7");
setBlackHoles(FOUR);

console.log("the second way out is a move of its own");
const cab = P("c", "cabeza", 3, 1, 1, 1, 1);
let moves = legalMovesFor([cab], cab);
check("a Cabeza stepping E into A1 comes out W of A2 (plain key)", moves.E && moves.E.teleports && at(moves.E) === "6,6", at(moves.E));
check("...or W of B2 (E-x)", moves["E-x"] && moves["E-x"].teleports && at(moves["E-x"]) === "7,2", at(moves["E-x"]));
check("...and only that step has a second way out", Object.keys(moves).filter(isOtherExitKey).join() === "E-x", Object.keys(moves).join());
const diag = P("c", "cabeza", 2, 1, 1, 1, 1);
moves = legalMovesFor([diag], diag);
check("a diagonal step into a hole too (SE-x)", moves.SE && moves["SE-x"] && at(moves["SE-x"]) === "6,2", JSON.stringify(Object.keys(moves)));
const tur = P("t", "turrito", 3, 1, 1, 1, 1);
moves = legalMovesFor([tur], tur);
check("a Turrito rolling E into A1: both ways out", at(moves.E) === "6,6" && at(moves["E-x"]) === "7,2", `${at(moves.E)} / ${at(moves["E-x"])}`);
const block = P("b", "turrito", 6, 6, 1, 1, 1, "light");
moves = legalMovesFor([tur, block], tur);
check("the partner's way out taken by a piece: only the other set's is left", !moves.E && at(moves["E-x"]) === "7,2", JSON.stringify(Object.keys(moves)));
const cabFoe = P("x", "cabeza", 7, 2, 1, 1, 1, "light");
moves = legalMovesFor([tur, cabFoe], tur);
check("a Turrito coming out onto a lone enemy Cabeza crushes it (E-x)", moves["E-x"] && moves["E-x"].crushes && moves["E-x"].crushes.id === "x");
moves = legalMovesFor([cab, cabFoe], cab);
check("...a Cabeza can't come out onto one", !moves["E-x"] && !!moves.E);

setActiveLaws({ ...LAWS_OFF, blackHoleSquares: true, slide: true });
const flaco = P("f", "flaco", 3, 1, 1, 1, 2); // standing: a 1 x 1 footprint
moves = legalMovesFor([flaco], flaco);
check("a standing Flaco slides into A1: slide-E and slide-E-x", moves["slide-E"] && moves["slide-E"].teleports && moves["slide-E-x"] && moves["slide-E-x"].isSlide && at(moves["slide-E-x"]) === "7,2", JSON.stringify(Object.keys(moves)));
check("...its roll E doesn't drop in (it lies down across two squares)", !moves.E || !moves.E.teleports);
check("the key's direction reads through the mark", baseDirOfSlideKey("slide-E-x") === "E" && plainKeyOf("SE-x") === "SE" && otherExitKey("N") === "N-x" && plainKeyOf("slide-N") === "slide-N");

console.log("shoves");
setActiveLaws({ ...LAWS_OFF, blackHoleSquares: true, slide: true, shoving: true, threeActions: true });
const chato = P("ch", "chato", 3, 0, 1, 1, 2);
const pushed = P("tu", "turrito", 3, 1, 1, 1, 1, "light");
const shove = legalMovesFor([chato, pushed], chato, 3);
const q = shove["slide-E"] && shove["slide-E"].shoves && shove["slide-E"].shoves.find((s) => s.id === "tu");
check("a Turrito shoved into A1 comes out of its partner, A2 (the pusher doesn't choose)", q && q.teleports && q.row === 6 && q.col === 6, JSON.stringify(shove["slide-E"]));
check("...no second shove key", !shove["slide-E-x"]);

console.log("placement");
const start = createInitialPieces();
let ok = true, apart = true, rowsOk = true, mirrored = true;
for (let i = 0; i < 300; i++) {
  const holes = pickBlackHoleSets(start, 10, 10, 2);
  if (holes.length !== 4) { ok = false; break; }
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    if (Math.floor(a / 2) !== Math.floor(b / 2) && holesTouch(holes[a], holes[b])) apart = false;
  }
  if (!holes.every((h) => blackHoleRowAllowed(h.row, 10))) rowsOk = false;
  if (holes[1].row !== 9 - holes[0].row || holes[1].col !== 9 - holes[0].col || holes[3].row !== 9 - holes[2].row || holes[3].col !== 9 - holes[2].col) mirrored = false;
}
check("two sets: four holes, every time", ok);
check("...in two mirrored pairs", mirrored);
check("...the two sets never touching (no hole comes out onto another)", apart);
check("...never in the back two rows", rowsOk);
const kept = pickBlackHoleSets(start, 10, 10, 2, [], [A1, A2]);
check("a pair already placed is kept, the second set added", kept.length === 4 && kept[0] === A1 && kept[1] === A2);
check("one set: two holes", pickBlackHoleSets(start, 10, 10, 1).length === 2);

console.log("a replay code");
setActiveLaws({ ...LAWS_OFF, blackHoleSquares: true });
setBlackHoles(FOUR);
const rec = {
  rows: 10, cols: 10, laws: { ...LAWS_OFF, blackHoleSquares: true }, holes: FOUR, missing: [],
  start: [cab, P("lc", "cabeza", 9, 9, 1, 1, 1, "light")], opener: "dark",
  turns: [[{ pieceId: "c", dir: "E-x" }], [{ pieceId: "lc", dir: "W" }]], winner: null,
};
const code = encodeReplay(rec);
const back = decodeReplay(code);
check("the code keeps all four holes", back && back.holes.length === 4);
check("...and the other set's way out", back && back.turns[0][0].dir === "E-x");
const played = checkReplay(back);
check("...and plays by the rules", played.ok, JSON.stringify(played));
const after = played.final && played.final.pieces.find((p) => p.id === "c");
check("...the Cabeza out of B2", after && after.row === 7 && after.col === 2, JSON.stringify(after));

console.log("the computer");
setActiveLaws({ ...LAWS_OFF, blackHoleSquares: true });
setBlackHoles(FOUR);
const turns = generateTurns([cab, P("lc", "cabeza", 9, 9, 1, 1, 1, "light")], "dark");
check("its turns include the other set's way out", turns.some((t) => (t.dirs || []).some(isOtherExitKey) || (t.steps || []).some((s) => isOtherExitKey(s.dir))), String(turns.length));
// A Turrito beside A1 can crush a Cabeza beside B2 (out of A1 by B2):
// the threat walk sees it with two sets, and not with A's pair alone.
{
  const board = [P("dc", "cabeza", 7, 2, 1, 1, 1), P("lt", "turrito", 3, 1, 1, 1, 1, "light"), P("lc", "cabeza", 9, 9, 1, 1, 1, "light")];
  setBlackHoles(FOUR);
  const four = cabezaThreats(board.map((p) => ({ ...p })), "dark");
  setBlackHoles([A1, A2]);
  const two = cabezaThreats(board.map((p) => ({ ...p })), "dark");
  setBlackHoles(FOUR);
  check("a crush through the other set's hole is a threat the computer (and the check alert) sees", four.length > 0 && two.length === 0, `${four.length} / ${two.length}`);
}
// A Cabeza's way home through a hole: out of B1, two rows from home, reads
// nearer than out of A1 alone.
{
  const board = [P("dc", "cabeza", 0, 0, 1, 1, 1), P("lc", "cabeza", 6, 8, 1, 1, 1, "light")];
  setBlackHoles([A1, A2]);
  const two = evaluatePosition(board.map((p) => ({ ...p })), "dark", undefined, "dark");
  setBlackHoles(FOUR);
  const four = evaluatePosition(board.map((p) => ({ ...p })), "dark", undefined, "dark");
  check("Light's Cabeza beside A2 reads nearer home with the other set's way out", four < two, `${four} vs ${two}`);
}
// Light's Cabeza beside A2, heading for row 0: B1's ways out (the other
// set's) are a row or two from home; A1's, three or more.
const runner = P("rc", "cabeza", 6, 8, 1, 1, 1, "light");
const t0 = Date.now();
const best = await findBestAiTurn([runner, P("dc", "cabeza", 0, 0, 1, 1, 1, "dark")], "light", { ...AI_DIFFICULTY.medium, timeBudgetMs: 600 });
const took = JSON.stringify(best && (best.steps || best.dirs));
check("it plays a two-set game, and takes the way out nearer home", !!best && /-x/.test(took), `${took} in ${Date.now() - t0} ms`);

setBlackHoles([]);
setActiveLaws({ ...LAWS_OFF });
if (failed) { console.log(`\n${failed} BLACK-HOLE-SETS CHECK(S) FAILED`); process.exit(1); }
console.log("\nBLACK HOLE SETS SMOKE PASSED");
