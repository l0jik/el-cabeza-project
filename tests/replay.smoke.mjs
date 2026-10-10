/* Replay codes (engine/replay.js): random games, plain and under laws,
   go through encode -> decode -> the rules check and come back the same;
   a code wrapped over lines still reads; a damaged one says so; a log
   copied before codes existed is read from its lines; a move that
   doesn't fit is caught at its turn. */
import { createInitialPieces, legalMovesFor, applyShoves, turnContinues, pairLog, sameState } from "../engine/rules.js";
import { setActiveLaws, maxStepsFor, turnBudget, moveCost, maxPiecesPerTurn, PIECE_META, GOAL_ROW, ACTIVE_LAWS, getBoardDimensions } from "../engine/constants.js";
import { encodeReplay, decodeReplay, checkReplay, parseLogText, readPastedLog, VANILLA_LAWS, REPLAY_TAG } from "../engine/replay.js";

let failures = 0;
const check = (label, ok) => { if (!ok) failures++; console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`); };

// A small seeded generator, so a failure can be run again.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const sameBoard = (a, b) => a.length === b.length && a.every((p) => { const q = b.find((x) => x.id === p.id); return q && sameState(p, q); });

/* A random game played as the board plays it: a piece, its moves while
   the turn goes on (now and then "stop here", now and then, under Split
   Movement, another piece taking the points), never back to a board the
   turn already had (a human's would be refunded, so a record never has
   one). Returns the record and the board it ends on. */
function randomGame(seed, laws, maxTurns = 40) {
  const r = rng(seed);
  setActiveLaws({ ...VANILLA_LAWS, ...laws });
  const start = createInitialPieces();
  let board = start.map((p) => ({ ...p }));
  let player = r() < 0.5 ? "dark" : "light";
  const opener = player;
  const turns = [];
  let winner = null;
  for (let t = 0; t < maxTurns && !winner; t++) {
    const trail = [board];
    let used = 0, selected = null, moved = [];
    const steps = [];
    let turnBoard = board;
    for (;;) {
      const split = !!ACTIVE_LAWS.splitMovement;
      let piece = selected && turnBoard.find((p) => p.id === selected);
      const fresh = (q, remaining) => Object.entries(legalMovesFor(turnBoard, q, remaining)).filter(([, mv]) => {
        let nb = turnBoard.map((p) => (p.id === q.id ? mv.candidate : p));
        if (mv.shoves) nb = applyShoves(nb, mv.shoves);
        if (mv.crushes) nb = nb.filter((p) => p.id !== mv.crushes.id);
        return !trail.some((b) => sameBoard(b, nb));
      });
      if (!piece || (split && used > 0 && r() < 0.35)) {
        const remaining = selected ? turnBudget() - used : Infinity;
        const can = turnBoard.filter((q) => q.owner === player && (!selected || moved.includes(q.id) || moved.length < maxPiecesPerTurn()) &&
          fresh(q, selected ? remaining : maxStepsFor(q.type)).length > 0);
        if (!can.length) { if (!piece) break; }
        else piece = pick(r, can);
      }
      const options = fresh(piece, maxStepsFor(piece.type) - used);
      if (!options.length) break;
      const [dir, move] = pick(r, options);
      let next = turnBoard.map((p) => (p.id === piece.id ? move.candidate : p));
      if (move.shoves) next = applyShoves(next, move.shoves);
      used += moveCost(move);
      if (!moved.includes(piece.id)) moved = [...moved, piece.id];
      selected = piece.id;
      steps.push({ pieceId: piece.id, dir });
      let over = false;
      if (move.crushes) {
        next = next.filter((p) => p.id !== move.crushes.id);
        if (!next.some((p) => p.type === "cabeza" && p.owner === move.crushes.owner)) { winner = player; over = true; }
      }
      if (!over && piece.type === "cabeza" && move.candidate.row === GOAL_ROW[piece.owner]) { winner = player; over = true; }
      turnBoard = next;
      trail.push(next);
      if (over) break;
      const budget = split ? turnBudget() : maxStepsFor(piece.type);
      if (move.teleports || !turnContinues(turnBoard, player, moved, move.candidate, used, budget, split)) break;
      if (r() < 0.3) break; // stop here
    }
    if (!steps.length) break; // nothing to move (shouldn't happen)
    turns.push(steps);
    board = turnBoard;
    if (!winner) player = player === "dark" ? "light" : "dark";
  }
  const { rows, cols } = getBoardDimensions();
  const rec = { rows, cols, laws: { ...VANILLA_LAWS, ...laws }, holes: [], missing: [], start, opener, turns, winner };
  setActiveLaws({ ...VANILLA_LAWS });
  return { rec, board, player, winner };
}

// The log's lines as Copy Move Log writes them.
function logText(rec, names) {
  const entries = rec.turns.map((steps, i) => {
    const sideOf = i % 2 === 0 ? rec.opener : rec.opener === "dark" ? "light" : "dark";
    const groups = [];
    for (const s of steps) {
      const last = groups[groups.length - 1];
      const type = rec.start.find((p) => p.id === s.pieceId).type;
      if (last && last.pieceId === s.pieceId) last.dirs.push(s.dir);
      else groups.push({ pieceId: s.pieceId, label: PIECE_META[type].label, dirs: [s.dir] });
    }
    return { player: sideOf, notation: groups.map((g) => `${g.label}: ${g.dirs.join(".")}`).join("  ·  "), mark: "" };
  });
  const lines = pairLog(entries).map((row) => {
    const [a, b] = row.opener === "light" ? ["light", "dark"] : ["dark", "light"];
    const first = `${names[a]}: ${row[a].notation}`;
    return row[b] ? `${row.n}. ${first} | ${names[b]}: ${row[b].notation}` : `${row.n}. ${first}`;
  });
  return ["", ...lines].join("\n");
}

const NAMES = [{ dark: "Photon", light: "Plasma" }, { dark: "Walnut", light: "Ash" }, { dark: "Dark", light: "Light" }];
const sameTurns = (a, b) => a.length === b.length && a.every((t, i) => t.length === b[i].length && t.every((s, j) => s.pieceId === b[i][j].pieceId && s.dir === b[i][j].dir));

const LAW_SETS = [
  {},
  { slide: true },
  { slide: true, diagonalSlide: true, threeActions: true },
  { splitMovement: true, threeActions: true },
  { shoving: true, slide: true },
  { cantileverPivot: true, splitMovement: true },
];

console.log("codes");
let games = 0, allOk = true, legacyOk = true, finals = true, wins = 0;
for (let seed = 1; seed <= 60; seed++) {
  const laws = LAW_SETS[seed % LAW_SETS.length];
  const g = randomGame(seed, laws);
  const code = encodeReplay(g.rec);
  const back = decodeReplay(`Result: whatever\n\n1. ...\n\nReplay code: ${code}`);
  const res = back && !back.error && checkReplay(back);
  games++;
  if (g.winner) wins++;
  if (!(back && !back.error && sameTurns(back.turns, g.rec.turns) && res.ok)) {
    allOk = false;
    console.log(`    seed ${seed}:`, back && back.error, res && res.error, res && res.bad);
    continue;
  }
  if (!sameBoard(res.final.pieces, g.board) || (res.final.won ? res.final.won.winner : null) !== g.winner) finals = false;
  // The log's own lines (no laws but the ones its moves show, and no
  // shoving that can't be read) as a log from before codes.
  if (!laws.shoving) {
    const read = parseLogText(logText(g.rec, { dark: "Photon", light: "Plasma" }), NAMES);
    if (!(read && !read.error && sameTurns(read.turns, g.rec.turns))) {
      legacyOk = false;
      console.log(`    legacy seed ${seed}:`, read && read.error, read && read.bad);
      if (process.env.DEBUG) console.log(logText(g.rec, { dark: "Photon", light: "Plasma" }).split("\n").slice(Math.floor((read.bad) / 2), Math.floor(read.bad / 2) + 3).join("\n"), JSON.stringify(g.rec.turns[read.bad]));
    }
  }
}
check(`${games} random games (${wins} won) through encode, decode and the rules check`, allOk);
check("...each ends on the board it was played to, with the same winner", finals);
check("...and their readable lines alone read back to the same moves (no shoving)", legacyOk);

const g = randomGame(7, {}, 30);
const code = encodeReplay(g.rec);
check(`a code starts with ${REPLAY_TAG}`, code.startsWith(REPLAY_TAG));
const wrapped = code.slice(0, 40) + "\n" + code.slice(40, 90) + "\n  " + code.slice(90);
const w = decodeReplay(`Replay code: ${wrapped}`);
check("a code wrapped over lines by a chat app still reads", w && !w.error && sameTurns(w.turns, g.rec.turns));
const signed = decodeReplay(`Replay code: ${wrapped}\nSent from my phone\n\nThanks`);
check("...with text pasted after it, too", signed && !signed.error && sameTurns(signed.turns, g.rec.turns));
const cut = decodeReplay(`Replay code: ${code.slice(0, code.length - 30)}`);
check(`a code cut short says so (${cut && cut.error})`, !!(cut && cut.error));
check("text without a code or moves says so", !!readPastedLog("hello there", NAMES).error);
const fullText = `${logText(g.rec, { dark: "Photon", light: "Plasma" })}\n\nReplay code: ${code.slice(0, code.length - 30)}`;
const fallback = readPastedLog(fullText, NAMES);
check("a cut-short code with the log's lines above it reads from the lines (and says why)", fallback && !fallback.error && fallback.codeDamaged && sameTurns(fallback.turns, g.rec.turns));

// A move that doesn't fit: the turn is named, the turns before it kept.
const bad = JSON.parse(JSON.stringify(g.rec));
bad.turns[5] = [{ pieceId: bad.turns[5][0].pieceId, dir: "slide-N" }];
const badRes = checkReplay(decodeReplay(encodeReplay(bad)));
check(`a move that doesn't fit is caught at its turn (turn ${badRes.bad + 1}: ${badRes.error})`, !badRes.ok && badRes.bad === 5 && badRes.valid === 5);

// The check leaves the engine as it found it.
const splitGame = randomGame(3, { splitMovement: true, threeActions: true }).rec;
setActiveLaws({ ...VANILLA_LAWS, slide: true });
checkReplay(decodeReplay(encodeReplay(splitGame)));
check("the check puts the laws back as they were", ACTIVE_LAWS.slide === true && !ACTIVE_LAWS.splitMovement);
setActiveLaws({ ...VANILLA_LAWS });

// An older log: Light opened, in the wood set's names.
const lg = randomGame(11, {}, 12);
const old = parseLogText(logText(lg.rec, { dark: "Walnut", light: "Ash" }), NAMES);
check(`an older log in the wood set's names reads (${old && old.turns && old.turns.length} turns, opener ${old && old.opener})`, old && !old.error && sameTurns(old.turns, lg.rec.turns) && old.opener === lg.rec.opener);

console.log(failures === 0 ? "\nREPLAY SMOKE PASSED" : `\nREPLAY SMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
