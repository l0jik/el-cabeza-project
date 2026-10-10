/* Replaying a game from its copied move log (user: "a way to take a
   copied move log and have it replay a game"). Pure logic: no React, no
   Three.js, no DOM.

   Copy Move Log adds a replay code to what it copies: "ECR1." and the
   game's record as base64url JSON. The record is exact (the game keeps
   every turn's starting board and each step tagged with the piece that
   took it, see turnHistory in the chassis), so a code replays any game:
   any board size, laws, black holes, missing squares and roster.

     { v: 1,
       b: [rows, cols],
       l: ["slide", ...],         laws on (vanilla when empty)
       s: 0,                      only when Shoving shoves on slides only
       h: [[row, col], ...],      black holes
       m: [[row, col], ...],      missing squares
       p: [[id, type, owner, row, col, w, h, z, vox?], ...]   the start
       f: "d" | "l",              who opened
       t: ["3N.3E", "7S", ...],   each turn: steps "<piece index><move key>"
       r: "d" | "l" }             the winner, when the game was won

   A log copied before codes existed has only its readable lines
   ("3. Photon: T: N.E | Plasma: O: N  ·  Ch: E"). Those replay on a
   best-effort basis: the standard opening on the standard board, the
   laws read off the moves themselves (a slide key means Slide was on, a
   turn split over two pieces means Split Movement, and so on), each
   label resolved to the one piece of that type that can make the move.

   Every replay is played through the rules here first (checkReplay), so
   a code that doesn't fit them (edited, or from a game whose rules have
   since changed) is caught before anything moves on the board, and the
   turns before the first bad one can still be replayed. */

import {
  ACTIVE_LAWS, setActiveLaws, BLACK_HOLES, setBlackHoles, MISSING_SQUARES, setMissingSquares,
  getBoardDimensions, setBoardDimensions, PIECE_META, GOAL_ROW, maxStepsFor, turnBudget, moveCost,
  maxPiecesPerTurn, isSlideKey, isPivotKey, baseDirOfSlideKey,
} from "./constants.js";
import { legalMovesFor, applyShoves, turnContinues, initialPiecesFor, sameState } from "./rules.js";

export const REPLAY_TAG = "ECR1.";

// The laws of a plain game (as the chassis's resetGame sets them).
export const VANILLA_LAWS = {
  splitMovement: false, splitThree: false, slide: false, diagonalSlide: false, blackHoleSquares: false,
  cantileverPivot: false, threeActions: false, shoving: false, shoveOnRolls: true,
};
const LAW_KEYS = Object.keys(VANILLA_LAWS).filter((k) => k !== "shoveOnRolls");

/* ------------------------------------------------------------ the code */

function toB64url(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/* The record of the game on the board, from the chassis's own state:
   the first turn's starting board (or the board, before any move), who
   opened, every turn's piece-tagged steps, and the setup in force. */
export function gameRecord({ turnHistory, pieces, currentPlayer, status, winner }) {
  const { rows, cols } = getBoardDimensions();
  const first = turnHistory[0];
  return {
    rows, cols,
    laws: { ...VANILLA_LAWS, ...ACTIVE_LAWS },
    holes: (BLACK_HOLES || []).map((c) => ({ row: c.row, col: c.col })),
    missing: (MISSING_SQUARES || []).map((c) => ({ row: c.row, col: c.col })),
    start: (first ? first.pieces : pieces).map((p) => ({ ...p })),
    opener: first ? first.currentPlayer : currentPlayer,
    turns: turnHistory.map((h) =>
      (h.steps && h.steps.length ? h.steps : (h.dirs || []).map((dir) => ({ pieceId: h.pieceId, dir }))).map((s) => ({ pieceId: s.pieceId, dir: s.dir }))
    ),
    winner: status === "finished" && winner ? winner : null,
  };
}

export function encodeReplay(rec) {
  const index = new Map(rec.start.map((p, i) => [p.id, i]));
  const json = {
    v: 1,
    b: [rec.rows, rec.cols],
    l: LAW_KEYS.filter((k) => rec.laws && rec.laws[k]),
    ...(rec.laws && rec.laws.shoveOnRolls === false ? { s: 0 } : {}),
    h: (rec.holes || []).map((c) => [c.row, c.col]),
    m: (rec.missing || []).map((c) => [c.row, c.col]),
    p: rec.start.map((p) => [p.id, p.type, p.owner, p.row, p.col, p.w, p.h, p.z, ...(p.vox ? [p.vox] : [])]),
    f: rec.opener === "light" ? "l" : "d",
    t: rec.turns.map((steps) => steps.map((s) => `${index.get(s.pieceId)}${s.dir}`).join(".")),
    ...(rec.winner ? { r: rec.winner === "light" ? "l" : "d" } : {}),
  };
  return REPLAY_TAG + toB64url(JSON.stringify(json));
}

const isCell = (c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger);
const side = (x) => (x === "l" ? "light" : x === "d" ? "dark" : null);

// The record a code holds, or null when it isn't one (or is damaged).
function recordOf(json) {
  if (!json || json.v !== 1 || !Array.isArray(json.p) || !Array.isArray(json.t)) return null;
  const [rows, cols] = Array.isArray(json.b) ? json.b : [];
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) return null;
  const start = [];
  for (const a of json.p) {
    if (!Array.isArray(a) || a.length < 8) return null;
    const [id, type, owner, row, col, w, h, z, vox] = a;
    if (typeof id !== "string" || !PIECE_META[type] || (owner !== "dark" && owner !== "light")) return null;
    if (![row, col, w, h, z].every(Number.isInteger)) return null;
    start.push({ id, type, owner, row, col, w, h, z, ...(typeof vox === "string" && vox ? { vox } : {}) });
  }
  if (new Set(start.map((p) => p.id)).size !== start.length) return null;
  const turns = [];
  for (const t of json.t) {
    if (typeof t !== "string" || !t) return null;
    const steps = [];
    for (const part of t.split(".")) {
      const m = /^(\d+)([A-Za-z][\w-]*)$/.exec(part);
      if (!m || !start[+m[1]]) return null;
      steps.push({ pieceId: start[+m[1]].id, dir: m[2] });
    }
    turns.push(steps);
  }
  const laws = { ...VANILLA_LAWS };
  for (const k of Array.isArray(json.l) ? json.l : []) if (LAW_KEYS.includes(k)) laws[k] = true;
  if (json.s === 0) laws.shoveOnRolls = false;
  if (laws.splitThree) laws.splitMovement = true;
  const opener = side(json.f);
  if (!opener) return null;
  return {
    rows, cols, laws,
    holes: (Array.isArray(json.h) ? json.h : []).filter(isCell).map(([row, col]) => ({ row, col })),
    missing: (Array.isArray(json.m) ? json.m : []).filter(isCell).map(([row, col]) => ({ row, col })),
    start, opener, turns,
    winner: side(json.r),
  };
}

/* The code in a pasted text, if it has one: what follows the tag. A chat
   app may have wrapped a long code over several lines, so if the code up
   to the first space doesn't read, the lines after it are joined on one
   at a time (a blank line, or one with a character a code can't hold,
   ends it), each try read in turn: text pasted after the code (a
   signature) can't spoil it. */
export function decodeReplay(text) {
  const at = String(text || "").indexOf(REPLAY_TAG);
  if (at < 0) return null;
  const rest = text.slice(at + REPLAY_TAG.length);
  const tries = [];
  const plain = /^[A-Za-z0-9_-]+/.exec(rest);
  if (plain) tries.push(plain[0]);
  let acc = "";
  for (const line of rest.split(/\r?\n/)) {
    const t = line.replace(/\s+/g, "");
    if (!t || !/^[A-Za-z0-9_-]+$/.test(t)) break;
    acc += t;
    if (acc !== tries[0]) tries.push(acc);
  }
  for (const code of tries) {
    try {
      const rec = recordOf(JSON.parse(fromB64url(code)));
      if (rec) return rec;
    } catch (e) { /* not this one */ }
  }
  return { error: "The replay code in it is damaged or cut short. Copy the move log again and paste all of it." };
}

/* --------------------------------------------- playing it by the rules */

/* Runs fn with the engine set up for the record (board size, laws, black
   holes, missing squares), then puts back whatever was set before: the
   check runs while another game may be on the board. */
function withSetup(rec, fn) {
  const before = { dims: getBoardDimensions(), laws: ACTIVE_LAWS, holes: BLACK_HOLES, missing: MISSING_SQUARES };
  try {
    setBoardDimensions(rec.rows, rec.cols);
    setActiveLaws({ ...VANILLA_LAWS, ...rec.laws });
    setBlackHoles(rec.holes);
    setMissingSquares(rec.missing);
    return fn();
  } finally {
    setBoardDimensions(before.dims.rows, before.dims.cols);
    setActiveLaws({ ...VANILLA_LAWS, ...before.laws });
    setBlackHoles(before.holes);
    setMissingSquares(before.missing);
  }
}

const otherSide = (s) => (s === "dark" ? "light" : "dark");

/* One turn played as the chassis plays it (beginMove, commitRef, the
   Split Movement hand-over, settleTurn): the points each step may spend,
   when a second piece may take the turn's points, when the turn ends by
   itself, and whether it ends the game. Returns the board after it, or
   { error } naming the step that doesn't fit. Expects the engine set up
   for the game (withSetup). */
function playTurn(pieces, player, steps) {
  let board = pieces, selected = null, used = 0, moved = [], over = false, closed = false, shoved = false;
  let result = null;
  for (let i = 0; i < steps.length; i++) {
    const { pieceId, dir } = steps[i];
    if (closed) return { error: "a move after the turn was over", step: i };
    const piece = board.find((p) => p.id === pieceId);
    if (!piece) return { error: "a piece that isn't on the board", step: i };
    if (piece.owner !== player) return { error: "a piece of the other side", step: i };
    if (selected !== null && pieceId !== selected) {
      // Another piece taking the turn's points (canTakeSplitPoints).
      const remaining = turnBudget() - used;
      const may = ACTIVE_LAWS.splitMovement && remaining > 0 &&
        (moved.includes(pieceId) || moved.length < maxPiecesPerTurn()) &&
        Object.keys(legalMovesFor(board, piece, remaining)).length > 0;
      if (!may) return { error: "a second piece moved in the same turn", step: i };
    }
    const move = legalMovesFor(board, piece, maxStepsFor(piece.type) - used)[dir];
    if (!move) return { error: `${PIECE_META[piece.type].name} can't make that move (${dir})`, step: i };
    let next = board.map((p) => (p.id === piece.id ? move.candidate : p));
    if (move.shoves) { next = applyShoves(next, move.shoves); shoved = true; }
    const usedAfter = used + moveCost(move);
    const movedAfter = moved.includes(piece.id) ? moved : [...moved, piece.id];
    if (move.crushes) {
      next = next.filter((p) => p.id !== move.crushes.id);
      if (!next.some((p) => p.type === "cabeza" && p.owner === move.crushes.owner)) {
        result = { winner: player, why: "Cabeza crushed" };
        over = true;
      }
    }
    if (!over && piece.type === "cabeza" && move.candidate.row === GOAL_ROW[piece.owner]) {
      result = { winner: player, why: "Cabeza reached the far edge" };
      over = true;
    }
    board = next;
    used = usedAfter;
    moved = movedAfter;
    selected = piece.id;
    if (over) { closed = true; continue; }
    const split = !!ACTIVE_LAWS.splitMovement;
    const budget = split ? turnBudget() : maxStepsFor(piece.type);
    if (move.teleports || !turnContinues(board, player, movedAfter, move.candidate, usedAfter, budget, split)) closed = true;
  }
  if (!steps.length) return { error: "an empty turn", step: 0 };
  // A turn that moved one piece out and back home isn't a move
  // (settleTurn): it is never in a game's record.
  if (!over && moved.length === 1 && !shoved) {
    const from = pieces.find((p) => p.id === moved[0]);
    const to = board.find((p) => p.id === moved[0]);
    if (from && to && sameState(from, to)) return { error: "a turn that ends where it began", step: steps.length - 1 };
  }
  return { board, ...(result || {}), closed };
}

/* Plays the whole record by the rules. { ok, turns, final } when every
   turn fits; otherwise { ok: false, bad: the first turn (0-based) that
   doesn't, step, error, valid: how many turns before it do, final: the
   board those leave }. `final` carries the board, who is to move, and
   the result when the game was won. */
export function checkReplay(rec) {
  return withSetup(rec, () => {
    const start = rec.start;
    // The start itself: every piece on the board, none overlapping.
    let board = start.map((p) => ({ ...p }));
    let player = rec.opener;
    let won = null;
    for (let t = 0; t < rec.turns.length; t++) {
      const fail = (error, step = 0) => ({ ok: false, bad: t, step, error, valid: t, turns: rec.turns.length, final: { pieces: board, player, won } });
      if (won) return fail("a move after the game was won");
      const r = playTurn(board, player, rec.turns[t]);
      if (r.error) return fail(r.error, r.step);
      board = r.board;
      if (r.winner) won = { winner: r.winner, why: r.why };
      else player = otherSide(player);
    }
    return { ok: true, turns: rec.turns.length, valid: rec.turns.length, final: { pieces: board, player, won } };
  });
}

/* ------------------------------------- a log copied before codes existed */

/* The readable lines of a copied log as turns: [{ name, groups: [{ label,
   dirs }] }], in play order. Lines that aren't move lines (the result,
   the code, anything around them) are skipped. */
function readLines(text) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const m = /^\s*(\d+)\.\s+(.+?)\s*$/.exec(raw);
    if (!m) continue;
    for (const half of m[2].split(/\s+\|\s+/)) {
      const k = half.indexOf(": ");
      if (k < 0) return null;
      const name = half.slice(0, k).trim();
      const rest = half.slice(k + 2).replace(/\s*[×✦]\s*$/, "").trim();
      if (!rest || rest === "—" || rest === "-") continue;
      const groups = [];
      for (const g of rest.split(/\s*·\s*/)) {
        const j = g.indexOf(": ");
        if (j < 0) return null;
        const label = g.slice(0, j).trim();
        const dirs = g.slice(j + 2).trim().split(".").filter(Boolean);
        if (!label || !dirs.length) return null;
        groups.push({ label, dirs });
      }
      out.push({ name, groups });
    }
  }
  return out;
}

/* The laws a log's own moves show were on. Shoving can't be read off a
   move (a roll that pushed reads like any roll), so it's tried later. */
function lawsSeen(turns) {
  const laws = { ...VANILLA_LAWS };
  for (const t of turns) {
    let points = 0;
    for (const g of t.groups) {
      for (const d of g.dirs) {
        if (isSlideKey(d)) {
          if (baseDirOfSlideKey(d).length === 2) laws.diagonalSlide = true;
          else laws.slide = true;
          points += 2;
        } else if (isPivotKey(d)) { laws.cantileverPivot = true; points += 1; }
        else points += 1;
      }
    }
    // Steps by one piece run together under its label, so a piece that
    // moves, hands the points on and moves again shows twice ("C: SW  ·
    // Ch: E  ·  C: NW"): three different labels is three pieces.
    if (t.groups.length > 1) laws.splitMovement = true;
    if (new Set(t.groups.map((g) => g.label)).size > 2) laws.splitThree = true;
    if (points > 2) laws.threeActions = true;
  }
  if (laws.splitThree) laws.threeActions = true;
  return laws;
}

/* A log without a code, as a record. `names` is the list of side-name
   pairs ({ dark, light }) the game's worlds use, the one on the page
   first: a log names its sides as the world it was copied in did. */
export function parseLogText(text, names, { rows = 10, cols = 10 } = {}) {
  const lines = readLines(text);
  if (!lines || !lines.length) return null;
  const used = [...new Set(lines.map((l) => l.name))];
  if (used.length > 2) return { error: "The move lines name more than two sides." };
  const pair = names.find((n) => used.every((u) => u === n.dark || u === n.light));
  if (!pair) return { error: `The sides in it (${used.join(", ")}) aren't ones the game knows.` };
  const sideOf = (name) => (name === pair.dark ? "dark" : "light");
  const turns = lines.map((l) => ({ side: sideOf(l.name), groups: l.groups }));
  for (let i = 1; i < turns.length; i++) {
    if (turns[i].side === turns[i - 1].side) return { error: `Line ${Math.floor(i / 2) + 1} has the same side moving twice in a row.` };
  }
  const base = lawsSeen(turns);
  const start = initialPiecesFor(rows, cols);
  // Shoving off first; if a move only fits with it, on (both kinds).
  let best = null;
  for (const shoving of [false, true]) {
    const rec = { rows, cols, laws: { ...base, shoving }, holes: [], missing: [], start, opener: turns[0].side, turns: [], winner: null };
    const r = withSetup(rec, () => resolve(rec, turns));
    if (!r.error) return { ...rec, turns: r.turns, legacy: true };
    if (!best || r.valid > best.valid) best = { ...r, rec };
  }
  // The turns that could be followed still replay; the rest is reported.
  return { ...best.rec, turns: best.turns, legacy: true, error: best.error, bad: best.valid };
}

/* Each line's labels to the pieces that made the moves: of a side's
   pieces with that label, the one (or, for a split turn, the pair) whose
   moves are legal there. */
function resolve(rec, turns) {
  let board = rec.start.map((p) => ({ ...p }));
  const out = [];
  for (let t = 0; t < turns.length; t++) {
    const { side: player, groups } = turns[t];
    const options = groups.map((g) => board.filter((p) => p.owner === player && PIECE_META[p.type].label === g.label));
    if (options.some((o) => !o.length)) {
      return { error: `Turn ${t + 1} moves a piece this game doesn't start with (${groups.map((g) => g.label).join(", ")}).`, valid: t, turns: out };
    }
    // (A piece can come back after another has moved, as in "C · Ch ·
    // C", but never twice running: its steps would be one group.)
    let found = null;
    const pick = (k, chosen) => {
      if (found) return;
      if (k === groups.length) {
        const steps = groups.flatMap((g, i) => g.dirs.map((dir) => ({ pieceId: chosen[i].id, dir })));
        const r = playTurn(board, player, steps);
        if (!r.error) found = { steps, r };
        return;
      }
      for (const p of options[k]) if (chosen[k - 1] !== p) pick(k + 1, [...chosen, p]);
    };
    pick(0, []);
    if (!found) return { error: `Turn ${t + 1} doesn't fit the rules from the standard start.`, valid: t, turns: out };
    out.push(found.steps);
    board = found.r.board;
    if (found.r.winner && t < turns.length - 1) return { error: "The log goes on after the game was won.", valid: t + 1, turns: out };
  }
  return { turns: out, valid: turns.length };
}

/* What a pasted text holds: a record from its code, or from its lines
   (also when its code is damaged: the lines are still worth a try, and
   say so, codeDamaged). */
export function readPastedLog(text, names) {
  const coded = decodeReplay(text);
  if (coded && !coded.error) return coded;
  const read = parseLogText(text, names);
  if (read && read.turns && read.turns.length) return coded ? { ...read, codeDamaged: true } : read;
  if (coded) return coded;
  if (read) return read;
  return { error: "No moves found. Paste a move log copied with Copy Move Log." };
}
