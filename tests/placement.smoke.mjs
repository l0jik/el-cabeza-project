/* Placing the pieces manually (engine/placement.js): the rows a side
   may use, the mirror, a piece set down where another stands (swapped
   when it fits the squares just left, or to the bench), Put it back,
   turning (every way round a piece can stand), the half switch, missing
   squares, a safe start, and Same as last time for either side.

   node tests/placement.smoke.mjs */
import { setBoardDimensions, setMissingSquares, setBlackHoles, setActiveLaws } from "../engine/constants.js";
import { initialPiecesFor } from "../engine/rules.js";
import { piecesClash } from "../engine/shapes.js";
import { zoneRows, startSetOut, targets, place, putBack, turn, setHalf, readiness, keep, restore, canRestore, mirrorOf, setOutPoses, turnsWhileSettingOut } from "../engine/placement.js";
import { PIECE_ORIENTATIONS } from "../engine/anomaly.js";
import { parseVox, voxKey } from "../engine/shapes.js";

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
{
  // Up to the middle of a short board, a Cabeza a turn's walk from the far
  // row: with 3 actions it would win on the first move (user: pieces
  // "anywhere on your side of the board").
  setBoardDimensions(6, 6);
  let w = setHalf(startSetOut(initialPiecesFor(6, 6), "dark"), true);
  const free = (so, r, c) => !so.pieces.some((p) => r >= p.row && r < p.row + p.h && c >= p.col && c < p.col + p.w);
  // (Its column clear to the far row: the mirror has nothing there.)
  const col = [0, 1, 2, 3, 4, 5].find((c) => [3, 4, 5].every((r) => free(w, r, c)) && free(w, 2, c));
  w = col == null ? null : place(w, "dark-cabeza", 2, col);
  setActiveLaws({ threeActions: true });
  const r3 = w && readiness(w);
  check("3 actions: a Cabeza that could walk to the far row on the first move: Begin waits, it ringed", !!r3 && r3.reason === "walk" && r3.ids && r3.ids.length === 1 && /cabeza/.test(r3.ids[0]), JSON.stringify(r3));
  setActiveLaws({ threeActions: false });
  const r2 = w && readiness(w);
  check("...2 actions, three rows away: ready", !!r2 && r2.ok, JSON.stringify(r2));
  // A layout already past the back three rows opens in the half.
  const deep = initialPiecesFor(10, 10).map((p) => (p.id === "dark-turrito" ? { ...p, row: 4 } : p.id === "light-turrito" ? { ...p, row: 5 } : p));
  setBoardDimensions(10, 10);
  check("pieces laid out past the back three rows open the set-out in the half", startSetOut(deep, "dark", false).half === true && startSetOut(initialPiecesFor(10, 10), "dark", false).half === false);
  setActiveLaws({ splitMovement: false, splitThree: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false, shoving: false });
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

console.log("every way round it can stand");
{
  // (User, a video of placing an Arco Ancho: "it is not showing all
  // possible placement iterations ... there are other possible positions
  // that are not being offered". Turn had only the shuffle's three.)
  const key = (o) => `${o.w}x${o.h}x${o.z}:${o.vox ? voxKey(parseVox(o.vox)) : ""}`;
  const ancho = setOutPoses("arcoAncho");
  check("the Arco Ancho: all 12 ways round, the shuffle's first", ancho.length === 12 && new Set(ancho.map(key)).size === 12 && key(ancho[0]) === key(PIECE_ORIENTATIONS.arcoAncho[0]));
  check("...standing lengthwise toward the other side among them, and opening sideways", ancho.some((o) => o.w === 1 && o.h === 4 && o.z === 2) && ancho.some((o) => o.w === 2 && o.h === 4 && o.z === 1));
  check("...its quarter turn next (standing across, then lengthwise)", ancho[1].w === 1 && ancho[1].h === 4 && ancho[1].z === 2);
  check("every shuffle pose is one of them, for every piece", Object.entries(PIECE_ORIENTATIONS).every(([t, l]) => l.every((o) => setOutPoses(t).some((q) => key(q) === key(o)))));
  check("no start balanced on one cube: the Codo's 8, the Hombro's 4, the Cruce's 6, the Rayo's 8", setOutPoses("codo").length === 8 && setOutPoses("hombro").length === 4 && setOutPoses("cruce").length === 6 && setOutPoses("rayo").length === 8
    && ["codo", "hombro", "cruce", "rayo"].every((t) => setOutPoses(t).every((o) => parseVox(o.vox).filter((c) => c[2] === 0).length >= 2)));
  check("...but the Zeta's own, as drawn, and those turned a quarter (12 in all)", setOutPoses("zeta").length === 12);
  check("the Arco Chico and Alto 12 each; boxes as they were", setOutPoses("arcoChico").length === 12 && setOutPoses("arcoAlto").length === 12 && setOutPoses("flaco").length === 3 && setOutPoses("block2x3").length === 6 && setOutPoses("turrito").length === 1);
  check("a Cabeza and a Turrito don't turn", !turnsWhileSettingOut({ type: "cabeza" }) && !turnsWhileSettingOut({ type: "turrito" }) && turnsWhileSettingOut({ type: "arcoAncho" }));

  // The video's board: 13 across, 14 long, anywhere in my half (7 rows).
  setBoardDimensions(14, 13);
  const o0 = PIECE_ORIENTATIONS.arcoAncho[0];
  const roster = [
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 8, w: 1, h: 1, z: 1 },
    { id: "dark-arco", type: "arcoAncho", owner: "dark", row: 0, col: 2, w: o0.w, h: o0.h, z: o0.z, vox: o0.vox },
  ];
  const cycle = (half) => {
    let s = startSetOut(roster.map((p) => ({ ...p })), "dark", half);
    const seen = [key(at(s, "dark-arco"))];
    let ok = true;
    for (let i = 0; i < 14; i++) {
      s = turn(s, "dark-arco");
      if (!s) { ok = false; break; }
      const a = at(s, "dark-arco");
      if (!a || !mirroredWell(s) || !noClash(s) || s.bench.length) ok = false;
      seen.push(key(a));
      if (key(a) === seen[0]) break;
    }
    return { ok, seen };
  };
  const inHalf = cycle(true);
  check("anywhere in my half: Turn goes through all 12 and back round", inHalf.ok && inHalf.seen.length === 13 && new Set(inHalf.seen).size === 12, String(inHalf.seen.length));
  const inRows = cycle(false);
  check("in the back three rows: the 8 that fit (none 4 rows deep), and back round", inRows.ok && inRows.seen.length === 9 && new Set(inRows.seen).size === 8, String(inRows.seen.length));
  // Turned lengthwise where a black hole is: under its span it stands
  // over it (only its feet are on the board)...
  setBlackHoles([{ row: 2, col: 2 }, { row: 11, col: 10 }]);
  let s = turn(startSetOut(roster.map((p) => ({ ...p })), "dark", true), "dark-arco");
  let a = s && at(s, "dark-arco");
  check("turned lengthwise with a black hole under its span: it stands over it", !!a && a.w === 1 && a.h === 4 && a.row === 0 && a.col === 2 && mirroredWell(s) && noClash(s), JSON.stringify(a));
  // ...under a foot, it stands at the nearest place it can instead.
  setBlackHoles([{ row: 3, col: 2 }, { row: 10, col: 10 }]);
  s = turn(startSetOut(roster.map((p) => ({ ...p })), "dark", true), "dark-arco");
  a = s && at(s, "dark-arco");
  check("...with one under a foot: moved to the nearest place it can stand", !!a && a.w === 1 && a.h === 4 && !(a.row === 0 && a.col === 2) && Math.abs(a.row) + Math.abs(a.col - 2) <= 1 && mirroredWell(s) && noClash(s), JSON.stringify(a));
  setBlackHoles([]);
  setBoardDimensions(10, 10);
}

console.log("Light setting out (the player on Light's side)");
let lo = startSetOut(initialPiecesFor(10, 10), "light");
const lt = at(lo, "light-turrito");
const lfree = targets(lo, "light-turrito").find((a) => !lo.pieces.some((p) => piecesClash({ ...lt, row: a.row, col: a.col }, p)));
lo = place(lo, "light-turrito", lfree.row, lfree.col);
check("Light's Turrito set in rows 7-9, Dark's mirrors it", lfree.row >= 7 && at(lo, "light-turrito").row === lfree.row && mirroredWell(lo) && noClash(lo));

console.log(fails ? `\n${fails} check(s) failed` : "\nall placement checks passed");
process.exit(fails ? 1 : 0);
