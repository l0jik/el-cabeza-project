/* Why a move is refused (engine/why-not.js; user: "when attempting to
   make a move that's not allowed, for whatever reason, a pop-up should
   appear with an explanation"). First the user's own clip, the Lab's
   yellow Cruce by the pink one: its slide right refused for weight (both
   Cruces have 4 cubes), then, after it rolled a row down, for cost (the
   push out from under the arm is 3 actions, 1 left), the X over the
   pink pieces where they stand. Then random boards under every law
   setting: every slide the rules refuse gets a named reason (never the
   catch-all), every one they allow gets none, and a piece with no move
   at all says so, with what blocks it.
     node tests/why-not.smoke.mjs */
import { legalMovesFor, rollBlock } from "../engine/rules.js";
import { whyNotSlide, whyNoMove } from "../engine/why-not.js";
import { piecesClash, groundCellsOf } from "../engine/shapes.js";
import { setActiveLaws, setBlackHoles, setMissingSquares, setBoardDimensions, slideKey, plainKeyOf, STEP_DIRS, ROLL_DIRS, setOpeningTurn } from "../engine/constants.js";
import { VANILLA_LAWS } from "../engine/replay.js";

let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else { failed++; console.log(`  FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
};
const quiet = { fails: 0 };
const fail = (label, detail) => { quiet.fails++; failed++; if (quiet.fails <= 8) console.log(`  FAIL ${label} — ${JSON.stringify(detail)}`); };

// ---- The user's clip (Lab, Neo-Brutalism; 2 actions, slides, shoving on slides, only opponents) ----
setBoardDimensions(10, 10);
setMissingSquares([]);
setBlackHoles([{ row: 3, col: 0 }, { row: 7, col: 6 }]);
setActiveLaws({ ...VANILLA_LAWS, slide: true, shoving: true, shoveOnRolls: false, shoveOwn: false, shoveChain: false, blackHoleSquares: true });
const P = (id, type, owner, row, col, w, h, z, vox) => ({ id, type, owner, row, col, w, h, z, ...(vox ? { vox } : {}) });
const clip = [
  P("light-cruce", "cruce", "light", 4, 3, 3, 2, 1, "1,0,0;0,1,0;1,1,0;2,1,0"),
  P("dark-cruce", "cruce", "dark", 5, 6, 1, 2, 3, "0,0,0;0,0,1;0,0,2;0,1,1"),
  P("dark-cabeza", "cabeza", "dark", 6, 6, 1, 1, 1),
  P("light-1x3", "block1x3", "light", 4, 6, 3, 1, 1),
  P("light-cabeza", "cabeza", "light", 6, 2, 1, 1, 1),
  P("dark-turrito", "turrito", "dark", 0, 7, 1, 1, 1),
];
{
  const cruce = clip[0];
  const r = whyNotSlide(clip, cruce, "E", 2);
  check("the clip, at the start: the slide right is refused for weight", r && r.code === "heavy", r);
  check("...the pink Cruce, 4 cubes against 4", r && r.mass === 4 && r.cubes === 4 && r.pushed.length === 1 && r.pushed[0].id === "dark-cruce", r);
  check("...the X on its square, over its three cubes", r && JSON.stringify(r.cells) === "[[5,6]]" && r.top === 3, r);
  check("...and a slide the rules allow gets no reason", whyNotSlide(clip, cruce, "W", 2) === null && !!legalMovesFor(clip, cruce, 2)[slideKey("W")]);
  // The roll a row down, one action spent.
  const rolled = rollBlock(cruce, "S");
  const after = clip.map((p) => (p.id === cruce.id ? rolled : p));
  const c = whyNotSlide(after, rolled, "E", 1);
  check("after the roll: refused for cost", c && c.code === "cost", c);
  check("...3 actions (slide 2, push 1), 1 left, pushing the pink Cabeza", c && c.cost === 3 && c.base === 2 && c.push === 1 && c.left === 1 && c.pushed.length === 1 && c.pushed[0].id === "dark-cabeza", c);
  check("...the X on the Cabeza's square, over the arm above it", c && JSON.stringify(c.cells) === "[[6,6]]" && c.top === 2, c);
  check("...with 3 actions it'd go: no reason", whyNotSlide(after, rolled, "E", 3) === null);
  check("...nor any piece with moves left gets a no-move reason", whyNoMove(after, rolled, 1) === null);
}

// ---- Reasons one at a time ----
{
  const turrito = P("t", "turrito", "light", 0, 0, 1, 1, 1);
  const lone = [turrito, P("k", "cabeza", "dark", 9, 9, 1, 1, 1)];
  setBlackHoles([]);
  setActiveLaws({ ...VANILLA_LAWS, slide: true });
  let r = whyNotSlide(lone, turrito, "N", 2);
  check("off the board: the edge, the X past it", r && r.code === "edge" && JSON.stringify(r.cells) === "[[-1,0]]", r);
  r = whyNotSlide(lone, turrito, "E", 1);
  check("a slide with 1 action left: cost 2", r && r.code === "cost" && r.cost === 2 && r.left === 1 && !r.pushed.length, r);
  setOpeningTurn(0);
  setActiveLaws({ punto: true });
  r = whyNotSlide(lone, turrito, "E", 1);
  check("...on the game's first turn with Punto: said so", r && r.firstTurnShort === true, r);
  setOpeningTurn(-1);
  setActiveLaws({ punto: false });
  setMissingSquares([{ row: 0, col: 1 }, { row: 9, col: 8 }]);
  r = whyNotSlide(lone, turrito, "E", 2);
  check("onto a missing square: missing, the X on it", r && r.code === "missing" && JSON.stringify(r.cells) === "[[0,1]]", r);
  setMissingSquares([]);
  // In the way, nothing pushed in this game.
  const two = [turrito, P("o", "turrito", "dark", 0, 1, 1, 1, 1), P("k", "cabeza", "dark", 9, 9, 1, 1, 1)];
  r = whyNotSlide(two, turrito, "E", 2);
  check("a piece in the way, pushing off: in the way, no pushing", r && r.code === "inTheWay" && r.why === "noPushing" && r.blockers[0].id === "o", r);
  // A slide onto the other side's lone Cabeza: slides don't crush.
  const ontoCabeza = [turrito, P("k", "cabeza", "dark", 0, 1, 1, 1, 1)];
  r = whyNotSlide(ontoCabeza, turrito, "E", 2);
  check("a slide onto the other side's Cabeza: slides don't crush", r && r.code === "noCrushBySlide", r);
  // Pushing on: too heavy (a Turrito into a Turrito, 1 against 1).
  setActiveLaws({ shoving: true, shoveOwn: true });
  r = whyNotSlide(two, turrito, "E", 3);
  check("shoving on, equal cubes: too heavy", r && r.code === "heavy" && r.mass === 1 && r.cubes === 1, r);
  // Only opponents: your own piece in the way.
  setActiveLaws({ shoveOwn: false });
  const mine = [P("f", "flaco", "light", 0, 0, 2, 1, 1), P("t2", "turrito", "light", 0, 2, 1, 1, 1), P("k", "cabeza", "dark", 9, 9, 1, 1, 1)];
  r = whyNotSlide(mine, mine[0], "E", 3);
  check("only opponents, your own piece in the way: own", r && r.code === "own" && r.blockers[0].id === "t2", r);
  // No room: a Flaco pushing a Turrito against the edge.
  setActiveLaws({ shoveOwn: true });
  const edge = [P("f", "flaco", "light", 0, 7, 2, 1, 1), P("t2", "turrito", "dark", 0, 9, 1, 1, 1), P("k", "cabeza", "dark", 9, 0, 1, 1, 1)];
  r = whyNotSlide(edge, edge[0], "E", 3);
  check("the pushed piece at the edge: no room, edge, the X past it", r && r.code === "noRoom" && r.behind === "edge" && JSON.stringify(r.cells) === "[[0,10]]", r);
  // No room: a piece behind (lines aren't pushed).
  const behind = [P("f", "flaco", "light", 0, 3, 2, 1, 1), P("t2", "turrito", "dark", 0, 5, 1, 1, 1), P("t3", "turrito", "dark", 0, 6, 1, 1, 1), P("k", "cabeza", "dark", 9, 0, 1, 1, 1)];
  r = whyNotSlide(behind, behind[0], "E", 3);
  check("a piece behind the pushed one: no room, the piece behind", r && r.code === "noRoom" && r.behind === "piece" && r.blocker.id === "t3", r);
  // Set to push the line: then the two Turritos together (2) against the Flaco (2): too heavy.
  setActiveLaws({ shoveChain: true });
  r = whyNotSlide(behind, behind[0], "E", 3);
  check("pushing the line: the line too heavy, said as a line", r && r.code === "heavy" && r.mass === 2 && r.line === true, r);
  setActiveLaws({ shoveChain: false });
  // Diagonals: never pushed.
  setActiveLaws({ diagonalSlide: true });
  const diag = [P("c", "chato", "dark", 4, 3, 1, 2, 2), P("t", "turrito", "light", 3, 4, 1, 1, 1), P("k", "cabeza", "light", 9, 9, 1, 1, 1)];
  r = whyNotSlide(diag, diag[0], "NE", 3);
  check("a diagonal into a piece, shoving on: never pushed on a diagonal", r && r.code === "diagonalPush", r);
  // A Cabeza boxed in: what's round it.
  setActiveLaws({ ...VANILLA_LAWS });
  const boxedK = [P("k", "cabeza", "light", 0, 0, 1, 1, 1), P("a", "turrito", "light", 0, 1, 1, 1, 1), P("b", "turrito", "light", 1, 0, 1, 1, 1), P("c", "turrito", "dark", 1, 1, 1, 1, 1)];
  r = whyNoMove(boxedK, boxedK[0], 2);
  check("a boxed-in Cabeza: boxed, the edge and the pieces round it", r && r.code === "boxed" && r.reasons.some((x) => x.code === "edge") && r.reasons.some((x) => x.code === "inTheWay" && x.why === "cabeza"), r);
  // An Opa with one action: cost.
  const opa = [P("o", "opa", "light", 4, 4, 2, 2, 2), P("k", "cabeza", "dark", 9, 9, 1, 1, 1)];
  r = whyNoMove(opa, opa[0], 1);
  check("an Opa with one action left: an Opa move costs 2", r && r.code === "cost" && r.opa && r.cost === 2 && r.left === 1, r);
}

// ---- Random boards, every law setting ----
let seed = 20261102;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const SHAPES = [
  { type: "turrito", w: 1, h: 1, z: 1 }, { type: "turrito", w: 1, h: 1, z: 1 }, { type: "cabeza", w: 1, h: 1, z: 1 },
  { type: "flaco", w: 1, h: 1, z: 2 }, { type: "flaco", w: 2, h: 1, z: 1 }, { type: "flaco", w: 1, h: 2, z: 1 },
  { type: "chato", w: 1, h: 2, z: 2 }, { type: "chato", w: 2, h: 2, z: 1 }, { type: "opa", w: 2, h: 2, z: 2 },
  { type: "codo", w: 2, h: 2, z: 1, vox: "0,0,0;1,0,0;0,1,0" }, { type: "hombro", w: 3, h: 2, z: 1, vox: "0,0,0;1,0,0;2,0,0;2,1,0" },
  { type: "cruce", w: 3, h: 2, z: 1, vox: "1,0,0;0,1,0;1,1,0;2,1,0" }, { type: "cruce", w: 1, h: 2, z: 3, vox: "0,0,0;0,0,1;0,0,2;0,1,1" },
  { type: "arcoChico", w: 3, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,1;2,0,0" },
];
const onAny = (p, list) => groundCellsOf(p).some(([r, c]) => list.some((h) => h.row === r && h.col === c));
const sq = () => ({ row: Math.floor(rnd() * 10), col: Math.floor(rnd() * 10) });
const SETTINGS = [
  { shoving: false },
  { shoving: true, shoveOnRolls: true, shoveOwn: true },
  { shoving: true, shoveOnRolls: false, shoveOwn: false },
  { shoving: true, shoveOwn: true, shoveChain: true },
  { shoving: true, shoveOwn: false, shoveChain: true, diagonalSlide: true },
];
let refusals = 0, allowed = 0, noMove = 0;
const codes = {};
for (const setting of SETTINGS) {
  for (const withHoles of [false, true]) {
    for (let b = 0; b < 250; b++) {
      const holes = [], missing = [];
      if (withHoles) {
        while (holes.length < 2) { const h = sq(); if (!holes.some((x) => x.row === h.row && x.col === h.col)) holes.push(h); }
        while (missing.length < 2) { const m = sq(); if (![...holes, ...missing].some((x) => x.row === m.row && x.col === m.col)) missing.push(m); }
      }
      setBlackHoles(holes);
      setMissingSquares(missing);
      setActiveLaws({ ...VANILLA_LAWS, slide: true, threeActions: rnd() < 0.5, blackHoleSquares: withHoles, ...setting });
      const pieces = [];
      const n = 8 + Math.floor(rnd() * 12);
      for (let tries = 0; pieces.length < n && tries < 500; tries++) {
        const s = pick(SHAPES);
        const p = { id: `p${pieces.length}`, owner: rnd() < 0.5 ? "dark" : "light", row: Math.floor(rnd() * (10 - s.h + 1)), col: Math.floor(rnd() * (10 - s.w + 1)), ...s };
        if (pieces.some((q) => piecesClash(p, q)) || onAny(p, holes) || onAny(p, missing)) continue;
        pieces.push(p);
      }
      for (const piece of pieces) {
        const remaining = 1 + Math.floor(rnd() * 3);
        const moves = legalMovesFor(pieces, piece, remaining);
        const dirs = [...ROLL_DIRS, ...(setting.diagonalSlide ? Object.keys(STEP_DIRS).filter((d) => !ROLL_DIRS.includes(d)) : [])];
        for (const dir of dirs) {
          const r = whyNotSlide(pieces, piece, dir, remaining);
          const legal = Object.keys(moves).some((k) => plainKeyOf(k) === slideKey(dir));
          if (piece.type === "cabeza") { if (r !== null) fail("a Cabeza's step is no slide", { piece, dir, r }); continue; }
          if (legal) { allowed++; if (r !== null) fail("an allowed slide got a reason", { piece, dir, r, setting }); continue; }
          refusals++;
          if (!r) { fail("a refused slide got no reason", { piece, dir, setting }); continue; }
          codes[r.code] = (codes[r.code] || 0) + 1;
          if (r.code === "blocked") fail("a refused slide fell to the catch-all", { piece, dir, setting, pieces, holes, missing });
          if (!Array.isArray(r.cells) || !r.cells.length) fail("a refusal with nowhere to put the X", { piece, dir, r });
        }
        const none = !Object.keys(moves).length;
        const w = whyNoMove(pieces, piece, remaining);
        if (none !== !!w) fail("no-move reason when there are moves (or none when there aren't)", { piece, remaining, w, moves: Object.keys(moves) });
        if (w) {
          noMove++;
          if (w.code === "boxed" && !w.reasons.length) fail("a boxed piece with no reasons", { piece, setting });
          if (w.code === "boxed" && w.reasons.some((x) => x.code === "blocked")) fail("a boxed piece's reason fell to the catch-all", { piece, w });
        }
      }
    }
  }
}
console.log(`  (random boards: ${refusals} refused slides named, ${allowed} allowed, ${noMove} pieces with no move; ${JSON.stringify(codes)})`);
check("every refused slide on the random boards named, every allowed one left alone", quiet.fails === 0, `${quiet.fails} failures`);
check("every kind of reason met at least once", ["cost", "edge", "missing", "inTheWay", "heavy", "own", "noRoom", "diagonalPush", "holeTooBig"].every((c) => codes[c] > 0), codes);

console.log(failed === 0 ? "\nWHY-NOT SMOKE PASSED" : `\nWHY-NOT SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
