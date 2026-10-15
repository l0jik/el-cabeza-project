/* A bounded proof from the standard opening: can the attacker force a
   win (a crush, or the goal) within its first K turns, whatever the
   defender does? An AND/OR search over whole turns (the engine's own
   generateTurns, one end position each), with a sound distance bound
   (no piece can reach the Cabeza in time, even if the Cabeza walks
   toward it) and a table of settled positions.
     node forced.mjs <attacker: dark|light> <maxK> [seconds]
   Prints, for K = 1..maxK, PROVEN (a forced win exists), REFUTED (none)
   or UNDECIDED (time ran out). */
import { C, ai, setup, applyToClone, posKey, distinctTurns, other } from "./common.mjs";
const [attacker = "dark", maxKArg = "4", secsArg = "3600"] = process.argv.slice(2);
const MAXK = Number(maxKArg), DEADLINE = Date.now() + Number(secsArg) * 1000;
const defender = other(attacker);
const pieces0 = setup("classic", 10);
// Squares a block's nearest cell can close on the Cabeza per attacker
// turn (two rolls; an Opa's one roll of two), Chebyshev: the most any
// roll moves a footprint along its axis, twice.
const DISP = { turrito: 2, flaco: 3, chato: 4, opa: 2 };
function lowerBound(pieces) {
  const cab = pieces.find((p) => p.type === "cabeza" && p.owner === defender);
  if (!cab) return 0;
  let best = Infinity;
  for (const p of pieces) {
    if (p.owner !== attacker || p.type === "cabeza") continue;
    let d = Infinity;
    for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) d = Math.min(d, Math.max(Math.abs(r - cab.row), Math.abs(c - cab.col)));
    // k attacker turns and k-1 defender turns (the Cabeza may walk 2
    // toward it each): d <= k*M + (k-1)*2
    best = Math.min(best, Math.max(1, Math.ceil((d + 2) / (DISP[p.type] + 2))));
  }
  const mine = pieces.find((p) => p.type === "cabeza" && p.owner === attacker);
  if (mine) best = Math.min(best, Math.max(1, Math.ceil(Math.abs(C.GOAL_ROW[attacker] - mine.row) / 2)));
  return best;
}
const TT = new Map(); // key -> { f: largest k proven false, t: smallest k proven true }
let nodes = 0, cutoffs = 0, timeout = false;
const note = (key, k, res) => { const e = TT.get(key) || { f: 0, t: Infinity }; if (res) e.t = Math.min(e.t, k); else e.f = Math.max(e.f, k); TT.set(key, e); };
function forced(pieces, toMove, k) {
  if (timeout) return false;
  if (k <= 0) return false;
  if (lowerBound(pieces) > k) { cutoffs++; return false; }
  const key = posKey(pieces) + "|" + toMove;
  const e = TT.get(key);
  if (e) { if (e.t <= k) return true; if (e.f >= k) return false; }
  if ((++nodes & 1023) === 0 && Date.now() > DEADLINE) { timeout = true; return false; }
  const turns = distinctTurns(pieces, ai.generateTurns(pieces, toMove));
  let res;
  if (toMove === attacker) {
    res = false;
    const cand = turns.map((t) => ({ t, next: t.endsGame ? null : applyToClone(pieces, t) }));
    cand.sort((a, b) => (a.next ? lowerBound(a.next) : 0) - (b.next ? lowerBound(b.next) : 0)); // nearest to a win first
    for (const { t, next } of cand) {
      if (t.endsGame) { res = true; break; }
      if (k >= 2 && forced(next, defender, k - 1)) { res = true; break; }
      if (timeout) return false;
    }
  } else {
    if (!turns.length) res = true; // the defender has no move: lost (the ladder's convention)
    else {
      res = true;
      const cand = turns.map((t) => ({ t, next: t.endsGame ? null : applyToClone(pieces, t) }));
      cand.sort((a, b) => (b.next ? lowerBound(b.next) : 99) - (a.next ? lowerBound(a.next) : 99)); // the defender's best escapes first
      for (const { t, next } of cand) {
        if (t.endsGame) { res = false; break; } // the defender wins first
        if (!forced(next, attacker, k)) { res = false; break; }
        if (timeout) return false;
      }
    }
  }
  if (!timeout) note(key, k, res);
  return res;
}
for (let k = 1; k <= MAXK; k++) {
  const t0 = Date.now(); nodes = 0; cutoffs = 0;
  const first = "dark"; // the game's first turn is Dark's
  const res = forced(pieces0, first, k);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const verdict = timeout ? "UNDECIDED (time)" : res ? "PROVEN: a forced win exists" : "REFUTED: no forced win";
  console.log(`${attacker} within its first ${k} turn${k > 1 ? "s" : ""}: ${verdict}  [${nodes} positions searched, ${cutoffs} cut by distance, table ${TT.size}, ${secs}s]`);
  if (timeout) break;
}
