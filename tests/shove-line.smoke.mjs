/* Shoving set to push pieces behind too (ACTIVE_LAWS.shoveChain; user:
   "this rule that can be toggled will allow you to push however many
   blocks are in the path behind it, as long as the total number of cubes
   is less than the pushing piece"), on random boards: Turritos, Flacos,
   Chatos, Opas, flat L's and Arcos (the shapes that wrap round others),
   with and without a pair of singularities and two Missing Squares. Every
   legal shove leaves every piece on the board, none clashing, none on a
   Missing Square or left on a singularity; it pushes fewer cubes than the
   mover, only along the move, only the other side's when set to only
   opponents, and nothing but a Turrito or Cabeza through a singularity.
   And every shove legal with pieces behind blocking is the same one with
   them pushed too.
     node tests/shove-line.smoke.mjs */
import { legalMovesFor, applyShoves, inBounds } from "../engine/rules.js";
import { piecesClash, cubeCount, groundCellsOf } from "../engine/shapes.js";
import { setActiveLaws, setBlackHoles, setMissingSquares, setBoardDimensions } from "../engine/constants.js";
import { VANILLA_LAWS } from "../engine/replay.js";

let failed = 0;
const fail = (label, detail) => { failed++; if (failed <= 8) console.log(`  FAIL ${label} — ${JSON.stringify(detail)}`); };

let seed = 20261023;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const SHAPES = [
  { type: "turrito", w: 1, h: 1, z: 1 }, { type: "turrito", w: 1, h: 1, z: 1 }, { type: "turrito", w: 1, h: 1, z: 1 },
  { type: "flaco", w: 1, h: 1, z: 2 }, { type: "flaco", w: 2, h: 1, z: 1 }, { type: "flaco", w: 1, h: 2, z: 1 },
  { type: "chato", w: 1, h: 2, z: 2 }, { type: "chato", w: 2, h: 1, z: 2 }, { type: "chato", w: 2, h: 2, z: 1 },
  { type: "opa", w: 2, h: 2, z: 2 }, { type: "opa", w: 2, h: 2, z: 2 },
  { type: "codo", w: 2, h: 2, z: 1, vox: "0,0,0;1,0,0;0,1,0" }, { type: "codo", w: 2, h: 2, z: 1, vox: "0,0,0;1,0,0;1,1,0" },
  { type: "codo", w: 2, h: 2, z: 1, vox: "0,1,0;1,1,0;1,0,0" }, { type: "codo", w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" },
  { type: "hombro", w: 3, h: 2, z: 1, vox: "0,0,0;1,0,0;2,0,0;2,1,0" }, { type: "hombro", w: 2, h: 3, z: 1, vox: "0,0,0;0,1,0;0,2,0;1,2,0" },
  { type: "arcoChico", w: 3, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,1;2,0,0" }, { type: "arcoChico", w: 1, h: 3, z: 2, vox: "0,0,0;0,0,1;0,1,1;0,2,1;0,2,0" },
];
const DIRS = { E: [0, 1], W: [0, -1], S: [1, 0], N: [-1, 0] };
const onAny = (p, list) => groundCellsOf(p).some(([r, c]) => list.some((h) => h.row === r && h.col === c));
const sq = () => ({ row: Math.floor(rnd() * 10), col: Math.floor(rnd() * 10) });
const sorted = (a) => JSON.stringify([...(a || [])].sort((x, y) => (x.id < y.id ? -1 : 1)));

setBoardDimensions(10, 10);
for (const withHoles of [false, true]) {
  let shoves = 0, lines = 0, through = 0;
  for (let b = 0; b < 1500; b++) {
    const holes = [], missing = [];
    if (withHoles) {
      while (holes.length < 2) { const h = sq(); if (!holes.some((x) => x.row === h.row && x.col === h.col)) holes.push(h); }
      while (missing.length < 2) { const m = sq(); if (![...holes, ...missing].some((x) => x.row === m.row && x.col === m.col)) missing.push(m); }
    }
    setBlackHoles(holes);
    setMissingSquares(missing);
    const pieces = [];
    const n = 8 + Math.floor(rnd() * 10);
    for (let tries = 0; pieces.length < n && tries < 400; tries++) {
      const s = pick(SHAPES);
      const p = { id: `p${pieces.length}`, owner: rnd() < 0.5 ? "dark" : "light", row: Math.floor(rnd() * (10 - s.h + 1)), col: Math.floor(rnd() * (10 - s.w + 1)), ...s };
      if (pieces.some((q) => piecesClash(p, q)) || onAny(p, holes) || onAny(p, missing)) continue;
      pieces.push(p);
    }
    const own = rnd() < 0.5;
    const laws = { ...VANILLA_LAWS, slide: true, threeActions: true, shoving: true, shoveOnRolls: true, shoveOwn: own, blackHoleSquares: withHoles };
    const of = (q) => pieces.find((x) => x.id === q.id);
    for (const mover of pieces) {
      setActiveLaws({ ...laws, shoveChain: false });
      const blocking = legalMovesFor(pieces, mover, 3);
      setActiveLaws({ ...laws, shoveChain: true });
      const pushing = legalMovesFor(pieces, mover, 3);
      for (const [key, m] of Object.entries(blocking)) {
        if (m.shoves && (!pushing[key] || sorted(pushing[key].shoves) !== sorted(m.shoves))) fail("a shove with pieces behind blocking isn't the same pushed too", { key, mover, blocking: m.shoves, pushing: pushing[key] && pushing[key].shoves, pieces });
      }
      for (const [key, m] of Object.entries(pushing)) {
        if (!m.shoves) continue;
        shoves++;
        const after = applyShoves(pieces.map((q) => (q.id === mover.id ? { ...q, ...m.candidate, id: q.id, owner: q.owner, type: q.type } : q)), m.shoves);
        if (after.some((q) => !inBounds(q))) fail("a piece pushed off the board", { key, mover, shoves: m.shoves });
        if (after.some((q) => onAny(q, missing))) fail("a piece pushed onto a Missing Square", { key, mover, shoves: m.shoves, missing });
        if (after.some((q) => onAny(q, holes))) fail("a piece left on a singularity", { key, mover, shoves: m.shoves, holes });
        for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) if (piecesClash(after[i], after[j])) fail("two pieces in one place", { key, a: after[i].id, b: after[j].id, mover, shoves: m.shoves, pieces });
        if (m.shoves.reduce((t, q) => t + cubeCount(of(q)), 0) >= cubeCount(mover)) fail("as many cubes pushed as the mover has", { key, mover, shoves: m.shoves });
        if (!own && m.shoves.some((q) => of(q).owner === mover.owner)) fail("one of your own pushed, set to only opponents", { key, mover, shoves: m.shoves });
        if (m.shoves.some((q) => q.teleports && !["turrito", "cabeza"].includes(of(q).type))) fail("a big piece through a singularity", { key, shoves: m.shoves });
        through += m.shoves.some((q) => q.teleports) ? 1 : 0;
        const d = DIRS[key.replace(/^slide-/, "")];
        if (d) for (const q of m.shoves) {
          if (q.teleports) continue;
          const p = of(q), dr = q.row - p.row, dc = q.col - p.col;
          if ((d[0] === 0 && dr !== 0) || (d[1] === 0 && dc !== 0) || !((d[0] ? dr / d[0] : dc / d[1]) >= 1)) fail("a piece pushed off the line of the move", { key, q, p });
        }
        const landing = { ...mover, ...m.candidate };
        if (m.shoves.some((q) => !piecesClash(landing, of(q)))) lines++;
      }
    }
  }
  console.log(`  ${withHoles ? "with singularities and Missing Squares" : "open boards"}: ${shoves} shoves, ${lines} pushing a line, ${through} through a singularity`);
  if (!lines) fail("no line was ever pushed", { withHoles });
}

setBlackHoles([]);
setMissingSquares([]);
setActiveLaws({ ...VANILLA_LAWS });
if (failed) { console.log(`\n${failed} SHOVE-LINE CHECK(S) FAILED`); process.exit(1); }
console.log("\nSHOVE LINE SMOKE PASSED");
