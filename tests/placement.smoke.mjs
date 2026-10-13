/* Setting out the pieces by hand (engine/placement.js): the rows a side
   may use, the mirror, a piece set down where another stands (swapped
   when it fits the squares just left, or to the bench), Put it back,
   turning, the half switch, missing squares, a safe start, and Same as
   last time for either side.

   node tests/placement.smoke.mjs */
import { setBoardDimensions, setMissingSquares, setBlackHoles, setActiveLaws } from "../engine/constants.js";
import { initialPiecesFor } from "../engine/rules.js";
import { piecesClash } from "../engine/shapes.js";
import { zoneRows, startSetOut, targets, place, putBack, turn, setHalf, readiness, keep, restore, canRestore, mirrorOf } from "../engine/placement.js";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const at = (so, id) => so.pieces.find((p) => p.id === id) || null;
// Every piece on the board has its mirror where it should be, and no two clash.
const mirroredWell = (so) => so.pieces.every((p) => { const m = mirrorOf(p); const q = at(so, m.id); return q && q.row === m.row && q.col === m.col && q.w === m.w && q.h === m.h && (q.vox || "") === (m.vox || ""); });
const noClash = (so) => so.pieces.every((a, i) => so.pieces.every((b, j) => i >= j || !piecesClash(a, b)));

setBoardDimensions(10, 10);
setMissingSquares([]); setBlackHoles([]);
setActiveLaws({ splitMovement: false, splitThree: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false, shoving: false });

console.log("the rows");
check("Dark's back three rows on a 10x10 board: 0-2", JSON.stringify(zoneRows("dark", false)) === "[0,3]");
check("Light's: 7-9", JSON.stringify(zoneRows("light", false)) === "[7,10]");
check("anywhere in my half: 0-4 and 5-9", JSON.stringify(zoneRows("dark", true)) === "[0,5]" && JSON.stringify(zoneRows("light", true)) === "[5,10]");
check("with 9 rows the middle row is nobody's", JSON.stringify(zoneRows("dark", true, 9)) === "[0,4]" && JSON.stringify(zoneRows("light", true, 9)) === "[5,9]");

console.log("the standard opening, set out by Dark");
let so = startSetOut(initialPiecesFor(10, 10), "dark");
check("both sides on the board, the other side Dark's mirror", so.pieces.length === 10 && mirroredWell(so) && noClash(so));
check("ready to begin as it is", readiness(so).ok);
const tur = at(so, "dark-turrito");
const t = targets(so, "dark-turrito");
check(`the Turrito can be set on every square of the back three rows (${t.length})`, t.length === 30 && t.every((a) => a.row >= 0 && a.row <= 2));
// A free square.
const free = t.find((a) => !so.pieces.some((p) => piecesClash({ ...tur, row: a.row, col: a.col }, p)));
so = place(so, "dark-turrito", free.row, free.col);
check("set on a free square, the computer's Turrito mirrors it", at(so, "dark-turrito").row === free.row && at(so, "dark-turrito").col === free.col && mirroredWell(so) && noClash(so));
// Onto the Flaco: a Flaco can't fit the Turrito's one square, so it waits on the bench.
const fl = at(so, "dark-flaco");
so = place(so, "dark-turrito", fl.row, fl.col);
check("set where the Flaco stands: the Flaco to the bench, its mirror off the board too", !!so && so.bench.map((p) => p.id).join() === "dark-flaco" && !at(so, "dark-flaco") && !at(so, "light-flaco") && mirroredWell(so) && noClash(so));
check("...and Begin waits for it", readiness(so).reason === "bench");
check("Put it back: not while the Turrito stands on its squares", putBack(so, "dark-flaco") === null);
{
  // The Turrito off its squares again: now it can go back.
  const tfree = targets(so, "dark-turrito").find((a) => !so.pieces.some((p) => piecesClash({ ...at(so, "dark-turrito"), row: a.row, col: a.col }, p)) && !piecesClash({ ...at(so, "dark-turrito"), row: a.row, col: a.col }, fl));
  const so3 = putBack(place(so, "dark-turrito", tfree.row, tfree.col), "dark-flaco");
  check("...and once they're free, it goes back where it stood", !!so3 && so3.bench.length === 0 && at(so3, "dark-flaco").row === fl.row && at(so3, "dark-flaco").col === fl.col && mirroredWell(so3) && noClash(so3));
}
const back = targets(so, "dark-flaco").find((a) => !so.pieces.some((p) => piecesClash({ ...fl, row: a.row, col: a.col }, p)));
so = place(so, "dark-flaco", back.row, back.col);
check("the Flaco set out from the bench: bench empty, mirrored", !!so && so.bench.length === 0 && !!at(so, "dark-flaco") && !!at(so, "light-flaco") && mirroredWell(so) && noClash(so));
// A swap: the Cabeza onto the Turrito, both one square.
const cab = at(so, "dark-cabeza"), tu = at(so, "dark-turrito");
so = place(so, "dark-cabeza", tu.row, tu.col);
check("the Cabeza set on the Turrito: they swap squares, nothing benched", at(so, "dark-cabeza").row === tu.row && at(so, "dark-cabeza").col === tu.col && at(so, "dark-turrito").row === cab.row && at(so, "dark-turrito").col === cab.col && so.bench.length === 0 && mirroredWell(so));
{
  // The Flaco (two squares, rows 0-1 of column 3) onto the Turrito set
  // beside it at row 0, column 2: the Turrito takes the square the Flaco
  // left nearest it, row 0 of column 3.
  let s2 = place(startSetOut(initialPiecesFor(10, 10), "dark"), "dark-turrito", 0, 2);
  s2 = s2 && place(s2, "dark-flaco", 0, 2);
  const t2 = s2 && at(s2, "dark-turrito");
  check("the Flaco set on the Turrito: the Turrito takes a square the Flaco left", !!t2 && s2.bench.length === 0 && t2.row === 0 && t2.col === 3 && mirroredWell(s2) && noClash(s2), JSON.stringify(t2));
}
check("nothing out of its rows", place(so, "dark-turrito", 3, 0) === null);

console.log("turning");
const f0 = at(so, "dark-flaco");
const so2 = turn(so, "dark-flaco");
check("the Flaco turned to its next pose, mirrored", !!so2 && (() => { const f = at(so2, "dark-flaco") || so2.bench.find((p) => p.id === "dark-flaco"); return f && `${f.w}${f.h}${f.z}` !== `${f0.w}${f0.h}${f0.z}`; })() && mirroredWell(so2) && noClash(so2));
check("a Turrito has one pose: no turn", turn(so, "dark-turrito") === null);

console.log("anywhere in my half");
let sh = setHalf(so, true);
const tt = targets(sh, "dark-turrito");
check(`its squares now reach the middle (row ${Math.max(...tt.map((a) => a.row))})`, Math.max(...tt.map((a) => a.row)) === 4);
sh = place(sh, "dark-turrito", 4, 0);
check("set in row 5 (the middle), mirrored into row 6 for Light", at(sh, "dark-turrito").row === 4 && at(sh, "light-turrito").row === 5 && mirroredWell(sh));
sh = setHalf(sh, false);
check("switched off again: the Turrito out of its rows waits on the bench", sh.bench.some((p) => p.id === "dark-turrito") && !at(sh, "dark-turrito") && !at(sh, "light-turrito"));

console.log("missing squares and black holes");
setMissingSquares([{ row: 1, col: 1 }]);
check("no square under a piece may be missing", !targets(so, "dark-turrito").some((a) => a.row === 1 && a.col === 1));
setMissingSquares([]);
setBlackHoles([{ row: 2, col: 2 }, { row: 7, col: 7 }]);
check("...nor a black hole", !targets(so, "dark-turrito").some((a) => a.row === 2 && a.col === 2));
setBlackHoles([]);
// A square marked by hand on the other side only: the mirror can't land on it.
setMissingSquares([{ row: 8, col: 8 }]);
check("...nor under its mirror (a missing square on the other side, unpaired)", !targets(so, "dark-turrito").some((a) => a.row === 1 && a.col === 1) && targets(so, "dark-turrito").some((a) => a.row === 1 && a.col === 2));
setMissingSquares([]);

console.log("a safe start");
{
  // Up to the middle: the Opa right in front of the Light Cabeza could
  // crush it on the first move.
  let d = setHalf(startSetOut(initialPiecesFor(10, 10), "dark"), true);
  d = place(d, "dark-cabeza", 4, 0);
  d = place(d, "dark-opa", 3, 8);
  check("a Cabeza the other side can crush on the first move: Begin waits", !!d && readiness(d).reason === "danger", JSON.stringify(readiness(d || { bench: [], pieces: [] })));
}

console.log("Same as last time");
const saved = keep(so);
const fresh = startSetOut(initialPiecesFor(10, 10), "dark");
check("kept for the same roster and board", canRestore(saved, fresh));
const re = restore(saved, fresh);
check("...and set out again exactly", !!re && so.pieces.every((p) => { const q = at(re, p.id); return q && q.row === p.row && q.col === p.col && q.w === p.w && q.h === p.h; }));
const asLight = restore(saved, startSetOut(initialPiecesFor(10, 10), "light"));
check("...the same set-out for a player on Light's side, turned round", !!asLight && so.pieces.every((p) => { const q = at(asLight, p.id); return q && q.row === p.row && q.col === p.col; }));
setBoardDimensions(12, 10);
check("not onto a different board", !canRestore(saved, startSetOut(initialPiecesFor(12, 10), "dark"), 12, 10));
setBoardDimensions(10, 10);
check("not onto a different roster", !canRestore(saved, startSetOut(initialPiecesFor(10, 10).filter((p) => !/turrito/.test(p.id)), "dark")));

console.log("Light setting out (the player on Light's side)");
let lo = startSetOut(initialPiecesFor(10, 10), "light");
const lt = at(lo, "light-turrito");
const lfree = targets(lo, "light-turrito").find((a) => !lo.pieces.some((p) => piecesClash({ ...lt, row: a.row, col: a.col }, p)));
lo = place(lo, "light-turrito", lfree.row, lfree.col);
check("Light's Turrito set in rows 7-9, Dark's mirrors it", lfree.row >= 7 && at(lo, "light-turrito").row === lfree.row && mirroredWell(lo) && noClash(lo));

console.log(fails ? `\n${fails} check(s) failed` : "\nall placement checks passed");
process.exit(fails ? 1 : 0);
