/* The shape system (engine/shapes.js): odd-shaped pieces made of unit
   cubes, rolling by turning their cubes, and three-dimensional
   occupancy (overhangs, pieces sheltering underneath). Uses a 3-cube L
   (the Codo's shape) as the test piece. Box pieces must behave exactly
   as before — the rest of the suite covers that. */
import { rollBlock, legalMovesFor, evaluateBlockLanding, sameState } from "../engine/rules.js";
import { parseVox, voxKey, groundCellsOf, piecesClash, rollSweepClashes, maskAt, cubeCount } from "../engine/shapes.js";
import { setBoardDimensions, setMissingSquares, setBlackHoles, setActiveLaws, STEP_DIRS } from "../engine/constants.js";

let failures = 0;
const check = (label, cond, detail) => {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && detail ? " — " + detail : ""}`);
};

setBoardDimensions(10, 10);
setActiveLaws({ splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false });

// Standing L: two cubes side by side, one on top of the west one.
//   front view:  ■
//                ■ ■
const STANDING = voxKey([[0, 0, 0], [1, 0, 0], [0, 0, 1]]);
const L = (over) => ({ id: "L", type: "chato", owner: "dark", row: 5, col: 5, w: 2, h: 1, z: 2, vox: STANDING, ...over });

// ---- rolling turns the cubes rigidly, and undoes exactly ----
{
  let ok = true;
  const seen = new Set();
  const frontier = [L()];
  seen.add(frontier[0].vox + "|" + frontier[0].w + frontier[0].h + frontier[0].z);
  while (frontier.length) {
    const p = frontier.pop();
    for (const [dir, back] of [["E", "W"], ["W", "E"], ["S", "N"], ["N", "S"]]) {
      const q = rollBlock(p, dir);
      const cubes = parseVox(q.vox);
      if (cubes.length !== 3) ok = false;
      // tight box: every face has a cube, every cube inside the box
      if (cubes.some(([x, y, l]) => x < 0 || y < 0 || l < 0 || x >= q.w || y >= q.h || l >= q.z)) ok = false;
      if (![...Array(q.w).keys()].every((x) => cubes.some((c) => c[0] === x))) ok = false;
      if (![...Array(q.z).keys()].every((l) => cubes.some((c) => c[2] === l))) ok = false;
      if (!groundCellsOf(q).length) ok = false; // never floating
      if (!sameState(rollBlock(q, back), p)) ok = false; // exact inverse
      const key = q.vox + "|" + q.w + q.h + q.z;
      if (!seen.has(key)) { seen.add(key); frontier.push({ ...q, row: 5, col: 5 }); }
    }
  }
  check("every roll keeps 3 cubes in a tight box, touches the board, and undoes exactly", ok);
  check(`the L reaches all 12 distinct resting poses by rolling (found ${seen.size})`, seen.size === 12);
}

// ---- a balanced pose: one cube on the board, the rest held over the next square ----
// Rolling the standing L east: x' = l, l' = w-1-x.
const balanced = rollBlock(L(), "E");
check("rolling the standing L east balances it on one cube", groundCellsOf(balanced).length === 1,
  JSON.stringify({ vox: balanced.vox, ground: groundCellsOf(balanced) }));
const [footR, footC] = groundCellsOf(balanced)[0];
const underC = footC === balanced.col ? balanced.col + 1 : balanced.col;
check("the square beside the foot is free at board level and covered above",
  (maskAt(balanced, footR, underC) & 1) === 0 && maskAt(balanced, footR, underC) !== 0);

// ---- 3D occupancy: a Cabeza under the overhang is sheltered, not hit ----
const cabezaUnder = { id: "cu", type: "cabeza", owner: "light", row: footR, col: underC, w: 1, h: 1, z: 1 };
check("a Cabeza under the overhang doesn't clash with it", !piecesClash(balanced, cabezaUnder));
check("a 2-tall piece there does clash", piecesClash(balanced, { ...cabezaUnder, id: "t2", type: "flaco", z: 2 }));
{
  const v = evaluateBlockLanding([cabezaUnder], { ...balanced, id: "L" }, [0, 1]);
  check("landing with the overhang over an enemy Cabeza is legal and NOT a crush", v.legal && !v.crushes, JSON.stringify(v));
  const onFoot = { ...cabezaUnder, col: footC };
  const v2 = evaluateBlockLanding([onFoot], { ...balanced, id: "L" }, [0, 1]);
  check("landing the foot cube on an enemy Cabeza is a crush", v2.legal && v2.crushes && v2.crushes.id === "cu", JSON.stringify(v2));
}
// A Cabeza can step in under the overhang (its step is a plain translate).
{
  const standingFree = { ...balanced };
  const cab = { id: "cab", type: "cabeza", owner: "light", row: footR + 1, col: underC, w: 1, h: 1, z: 1 };
  const moves = legalMovesFor([standingFree, cab], cab);
  check("a Cabeza can step in under the overhang", !!moves.N, JSON.stringify(Object.keys(moves)));
}

// ---- Missing Squares / Black Holes: only the squares a piece stands on count ----
{
  const land = { ...balanced };
  setMissingSquares([{ row: footR, col: underC }]);
  check("the overhang may hang over a Missing Square", evaluateBlockLanding([], land, [0, 1]).legal);
  setMissingSquares([{ row: footR, col: footC }]);
  check("the foot may not stand on a Missing Square", !evaluateBlockLanding([], land, [0, 1]).legal);
  setMissingSquares([]);
  setBlackHoles([{ row: footR, col: footC }, { row: 0, col: 0 }]);
  const v = evaluateBlockLanding([], land, [0, 1]);
  check("an odd-shaped piece never drops into a Black Hole, even balanced on one cube", !v.legal && !v.teleportsTo, JSON.stringify(v));
  setBlackHoles([{ row: footR, col: underC }, { row: 0, col: 0 }]);
  check("but its overhang may hang over one", evaluateBlockLanding([], land, [0, 1]).legal);
  setBlackHoles([]);
}

// ---- the roll's swept path: nothing tips through a sheltered piece ----
{
  const cab = { ...cabezaUnder, owner: "dark" }; // friendly, so no crush question
  const under = { id: "tu", type: "turrito", owner: "dark", row: footR, col: underC, w: 1, h: 1, z: 1 };
  const bal = { ...balanced };
  // The Turrito under the overhang can't roll out from under it — its top
  // edge would swing up through the overhang.
  const dirAway = underC > footC ? "E" : "W";
  const tMoves = legalMovesFor([bal, under], under);
  check(`a Turrito under the overhang can't roll out (${dirAway}) through it`, !tMoves[dirAway], JSON.stringify(Object.keys(tMoves)));
  check("the sweep check itself reports that clash", rollSweepClashes([bal, under], under, dirAway));
  // With nothing near, no sweep clash.
  check("an open-board roll has no sweep clash", !rollSweepClashes([bal], bal, "N") && !rollSweepClashes([bal], bal, "S"));
  // The balanced L rolling back over its own sheltered piece: its foot cube
  // swings over the top, sweeping through the space above the sheltered
  // square (the overhang's column) — which is clear, since the sheltered
  // piece is only 1 tall. Rolling away the other way, the foot tips through
  // nothing either. Both depend on real geometry, not the footprint.
  const blocked = legalMovesFor([bal, cab], bal);
  check("the balanced L still has legal rolls with a Cabeza sheltered under it", Object.keys(blocked).length > 0, JSON.stringify(Object.keys(blocked)));
}

check("cube counts: the L is 3, a 2x2x2 box is 8, a Cabeza 1",
  cubeCount(L()) === 3 && cubeCount({ w: 2, h: 2, z: 2 }) === 8 && cubeCount({ w: 1, h: 1, z: 1 }) === 1);

// Box pieces are untouched: no vox, full columns.
check("a box still fills every level of its footprint", maskAt({ row: 0, col: 0, w: 2, h: 1, z: 3 }, 0, 1) === 0b111);

if (failures) { console.log(`\nSHAPES SMOKE TEST FAILED (${failures})`); process.exit(1); }
console.log("\nSHAPES SMOKE TEST PASSED");
