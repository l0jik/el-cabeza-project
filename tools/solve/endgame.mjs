/* Endgame tables for tiny El Cabeza worlds, by retrograde analysis with
   the real engine's move generator (standard rules: 2 actions, no laws).
     node endgame.mjs <world>     worlds: cc, ct-c, cf-c, ct-ct6
   Every position of the world's pieces (each side to move) is labelled
   WIN (the side to move forces a win), LOSS (the other side does) or
   DRAW (neither can), with the number of plies to the end under best
   play. A side with no legal turn is counted as lost (the ladder's
   convention). Writes <world>.values.bin and prints a summary. */
import { C, rules, ai, setup, other } from "./common.mjs";
const WORLDS = {
  "cc":     { board: 10, pieces: [["dark-cabeza", "cabeza", "dark"], ["light-cabeza", "cabeza", "light"]] },
  "cc6":    { board: 6, pieces: [["dark-cabeza", "cabeza", "dark"], ["light-cabeza", "cabeza", "light"]] },
  "ct-c":   { board: 10, pieces: [["dark-cabeza", "cabeza", "dark"], ["dark-turrito", "turrito", "dark"], ["light-cabeza", "cabeza", "light"]] },
  "cf-c":   { board: 10, pieces: [["dark-cabeza", "cabeza", "dark"], ["dark-flaco", "flaco", "dark"], ["light-cabeza", "cabeza", "light"]] },
  "ct-ct6": { board: 6, pieces: [["dark-cabeza", "cabeza", "dark"], ["dark-turrito", "turrito", "dark"], ["light-cabeza", "cabeza", "light"], ["light-turrito", "turrito", "light"]] },
};
const POSES = { cabeza: [[1, 1, 1]], turrito: [[1, 1, 1]], flaco: [[1, 1, 2], [1, 2, 1], [2, 1, 1]], chato: [[1, 2, 2], [2, 1, 2], [2, 2, 1]], opa: [[2, 2, 2]] };
const name = process.argv[2] || "cc";
const W = WORLDS[name]; if (!W) throw new Error("unknown world " + name);
setup("classic", W.board);
const R = C.BOARD_ROWS, Cc = C.BOARD_COLS;
const t0 = Date.now();

// Placements per piece: every pose at every spot inside the board.
const placements = W.pieces.map(([id, type, owner]) => {
  const list = [], index = new Map();
  for (const [w, h, z] of POSES[type]) for (let row = 0; row + h <= R; row++) for (let col = 0; col + w <= Cc; col++) {
    const cells = []; for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) cells.push(r * Cc + c);
    index.set(`${w},${h},${z},${row},${col}`, list.length);
    list.push({ id, type, owner, row, col, w, h, z, cells });
  }
  return { id, type, owner, list, index };
});
const sizes = placements.map((p) => p.list.length);
const N = sizes.reduce((a, b) => a * b, 1) * 2;
console.error(`${name}: ${W.pieces.length} pieces, placements ${sizes.join("x")} x 2 sides = ${N} slots (${(Date.now() - t0) / 1000}s)`);
const sideOf = (s) => (s % 2 ? "light" : "dark");
const stateIndex = (idxs, side) => { let k = 0; for (let i = 0; i < idxs.length; i++) k = k * sizes[i] + idxs[i]; return k * 2 + (side === "light" ? 1 : 0); };
const decode = (s) => { const side = sideOf(s); let k = Math.floor(s / 2); const idxs = new Array(sizes.length); for (let i = sizes.length - 1; i >= 0; i--) { idxs[i] = k % sizes[i]; k = Math.floor(k / sizes[i]); } return { idxs, side }; };

// Pass 1: every valid position's successors (by turn end position; an
// immediate win is noted, not stored), into a CSR.
const value = new Int8Array(N);   // 0 unknown/invalid, 1 WIN, 2 LOSS, 3 DRAW
const dist = new Uint16Array(N);
const valid = new Uint8Array(N);
const succStart = new Int32Array(N + 1);
let succ = new Int32Array(1 << 24), E = 0;
const push = (v) => { if (E === succ.length) { const n = new Int32Array(succ.length * 2); n.set(succ); succ = n; } succ[E++] = v; };
let states = 0, immediate = 0, stuck = 0;
const idxs = new Array(sizes.length).fill(0);
const occupied = new Int32Array(R * Cc);
function walk(i) {
  if (i === sizes.length) {
    for (const side of ["dark", "light"]) {
      const s = stateIndex(idxs, side);
      succStart[s] = E;
      valid[s] = 1; states++;
      const pieces = idxs.map((k, j) => { const p = placements[j].list[k]; return { id: p.id, type: p.type, owner: p.owner, row: p.row, col: p.col, w: p.w, h: p.h, z: p.z }; });
      const turns = ai.generateTurns(pieces, side);
      if (!turns.length) { stuck++; value[s] = 2; dist[s] = 0; continue; }
      const seen = new Set();
      let wins = false;
      for (const t of turns) {
        if (t.endsGame) { wins = true; break; }
        const j = pieces.indexOf(t.piece);
        const c = t.moves[t.moves.length - 1].candidate;
        const k = placements[j].index.get(`${c.w},${c.h},${c.z},${c.row},${c.col}`);
        if (k === undefined) throw new Error("unindexed placement " + JSON.stringify(c));
        const next = idxs.slice(); next[j] = k;
        const ns = stateIndex(next, other(side));
        if (!seen.has(ns)) { seen.add(ns); push(ns); }
      }
      if (wins) { value[s] = 1; dist[s] = 1; immediate++; }
    }
    return;
  }
  const P = placements[i].list;
  for (let k = 0; k < P.length; k++) {
    const cells = P[k].cells;
    let clash = false; for (const c of cells) if (occupied[c]) { clash = true; break; }
    if (clash) continue;
    for (const c of cells) occupied[c] = 1;
    idxs[i] = k; walk(i + 1);
    for (const c of cells) occupied[c] = 0;
  }
}
walk(0);
succStart[N] = E;
// (slots never visited keep succStart 0: fix their starts to the next visited start for a clean CSR)
for (let s = N - 1; s >= 0; s--) if (!valid[s]) succStart[s] = succStart[s + 1];
console.error(`${name}: ${states} positions, ${E} moves, ${immediate} with a win in hand, ${stuck} with no move (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

// Predecessors (CSR transpose) and the count of unresolved successors.
const predStart = new Int32Array(N + 1);
for (let e = 0; e < E; e++) predStart[succ[e] + 1]++;
for (let s = 0; s < N; s++) predStart[s + 1] += predStart[s];
const pred = new Int32Array(E), fill = predStart.slice(0, N);
for (let s = 0; s < N; s++) if (valid[s]) for (let e = succStart[s]; e < succStart[s + 1]; e++) pred[fill[succ[e]]++] = s;
const count = new Int32Array(N);
for (let s = 0; s < N; s++) if (valid[s]) count[s] = succStart[s + 1] - succStart[s];

// Retrograde: known results spread backwards.
let queue = []; for (let s = 0; s < N; s++) if (value[s]) queue.push(s);
let maxDist = 0;
while (queue.length) {
  const next = [];
  for (const s of queue) {
    const d = dist[s]; if (d > maxDist) maxDist = d;
    for (let e = predStart[s]; e < predStart[s + 1]; e++) {
      const t = pred[e]; if (value[t]) continue;
      if (value[s] === 2) { value[t] = 1; dist[t] = d + 1; next.push(t); }          // a move into a lost position wins
      else if (value[s] === 1 && --count[t] === 0) { value[t] = 2; dist[t] = d + 1; next.push(t); } // every move loses
    }
  }
  queue = next;
}
let draws = 0; for (let s = 0; s < N; s++) if (valid[s] && !value[s]) { value[s] = 3; draws++; }
const tally = { dark: { win: 0, loss: 0, draw: 0 }, light: { win: 0, loss: 0, draw: 0 } };
const longest = { win: null, loss: null };
for (let s = 0; s < N; s++) if (valid[s]) {
  const side = sideOf(s), v = value[s] === 1 ? "win" : value[s] === 2 ? "loss" : "draw";
  tally[side][v]++;
  if (v !== "draw" && (!longest[v] || dist[s] > dist[longest[v]])) longest[v] = s;
}
const describe = (s) => { const { idxs, side } = decode(s); return { toMove: side, pieces: idxs.map((k, j) => { const p = placements[j].list[k]; return `${p.id}@${p.row},${p.col} ${p.w}x${p.h}x${p.z}`; }), plies: dist[s] }; };
const out = { world: name, board: `${R}x${Cc}`, pieces: W.pieces.map((p) => p[0]), positions: states, moves: E, immediateWins: immediate, noMove: stuck, tally, draws, maxPlies: maxDist, longestWin: longest.win != null ? describe(longest.win) : null, longestLoss: longest.loss != null ? describe(longest.loss) : null, seconds: +((Date.now() - t0) / 1000).toFixed(0) };
// Probes: the pieces where the standard opening would have them (when
// they fit), each side to move.
const start = { "dark-cabeza": [0, Math.floor((Cc - 4) / 2) + 2, 1, 1, 1], "dark-turrito": [0, Math.floor((Cc - 4) / 2) + 1, 1, 1, 1], "dark-flaco": [0, Math.floor((Cc - 4) / 2), 1, 2, 1], "light-cabeza": [R - 1, Cc - 1 - (Math.floor((Cc - 4) / 2) + 2), 1, 1, 1], "light-turrito": [R - 1, Cc - 1 - (Math.floor((Cc - 4) / 2) + 1), 1, 1, 1] };
const probeIdx = placements.map((p) => { const [row, col, w, h, z] = start[p.id]; return p.index.get(`${w},${h},${z},${row},${col}`); });
out.probes = {};
if (!probeIdx.includes(undefined)) for (const side of ["dark", "light"]) { const s = stateIndex(probeIdx, side); out.probes[side + "ToMove"] = valid[s] ? { value: ["?", "WIN", "LOSS", "DRAW"][value[s]], plies: dist[s], ...describe(s) } : "invalid"; }
import fs from "node:fs";
fs.writeFileSync(`${process.env.EC_SOLVE_OUT || process.cwd()}/${name}.values.bin`, Buffer.from(value.buffer));
console.log(JSON.stringify(out, null, 1));
