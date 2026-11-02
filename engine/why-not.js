/* Why a move is refused. User, with a clip of a Cruce that wouldn't
   slide: "when attempting to make a move that's not allowed, for
   whatever reason, a pop-up should appear with an explanation"; the
   pick, A1: the Piece guide's, an X on the square aimed at with a
   bubble beside it saying why.

   The rules' own verdict decides (legalMovesFor): this only says which
   of their checks a refused move failed, walking them in the order
   translatedCandidate, tryShove, shoveLine and rollMove do (rules.js),
   and where the X goes. The words are the chassis's (chassis/why-not.js);
   here a reason is data:
     { code, kind, dir, cells: [[row, col], ...], top, ...details }
   `kind` is the move tried ("slide", "roll", "step"), `cells` the squares
   to mark (past the edge, for the edge), `top` the height in cube levels
   of what stands on them (the X goes over it). A refusal the walk can't
   name (it and the rules drifted apart) comes back as "blocked", whose
   words are still true. */
import {
  legalMovesFor, inBounds, rollBlock, evaluateBlockLanding,
  overlapsMissingSquare, blackHoleVerdict, blackHoleAt,
} from "./rules.js";
import {
  ACTIVE_LAWS, BOARD_ROWS, BOARD_COLS, MISSING_SQUARES, OPENING_TURN,
  STEP_DIRS, ROLL_DIRS, SLIDE_COST, SHOVE_COST, OPA_MOVE_COST,
  moveCost, slideKey, plainKeyOf, isSlideKey, baseDirOfSlideKey,
} from "./constants.js";
import { piecesClash, cubeCount, groundCellsOf, maskAt, rollSweepClashes, anyOddShape } from "./shapes.js";

const DIAGONALS = Object.keys(STEP_DIRS).filter((d) => !ROLL_DIRS.includes(d));
const brief = (p) => ({ id: p.id, type: p.type, owner: p.owner, cubes: cubeCount(p) });
const offBoard = ([r, c]) => r < 0 || c < 0 || r >= BOARD_ROWS || c >= BOARD_COLS;
const onMissing = ([r, c]) => MISSING_SQUARES.some((m) => m.row === r && m.col === c);
const onHole = ([r, c]) => !!blackHoleAt(r, c);
const firstTurnShort = () => !!ACTIVE_LAWS.punto && OPENING_TURN === 0;

function boxCells(b) {
  const out = [];
  for (let r = b.row; r < b.row + b.h; r++) for (let c = b.col; c < b.col + b.w; c++) out.push([r, c]);
  return out;
}
// The squares a piece has a cube over.
const cubeCells = (p) => boxCells(p).filter(([r, c]) => maskAt(p, r, c));
// The squares two pieces both have a cube in: where they clash.
function clashCells(a, b) {
  const out = [];
  const r0 = Math.max(a.row, b.row), r1 = Math.min(a.row + a.h, b.row + b.h);
  const c0 = Math.max(a.col, b.col), c1 = Math.min(a.col + a.w, b.col + b.w);
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (maskAt(a, r, c) & maskAt(b, r, c)) out.push([r, c]);
  return out;
}
// The squares a move takes a cube onto that it didn't have one over: the
// squares aimed at.
function enteredCells(from, to) {
  const out = boxCells(to).filter(([r, c]) => maskAt(to, r, c) && !maskAt(from, r, c));
  return out.length ? out : boxCells(to);
}
// Where the X goes, and how high: over the tallest cube on those squares.
function mark(cells, pieces) {
  let top = 0;
  for (const p of pieces) for (const [r, c] of cells) {
    const m = maskAt(p, r, c);
    if (m) top = Math.max(top, 32 - Math.clz32(m));
  }
  return { cells, top };
}

/* A slide of `piece` toward `dir` (a STEP_DIRS key), with `remaining`
   actions left this turn: null when the rules allow it (or there's no
   such slide in this game: a Cabeza steps, it doesn't slide; a diagonal
   without Diagonal slide), else why not. */
export function whyNotSlide(pieces, piece, dir, remaining = Infinity) {
  if (!piece || piece.type === "cabeza" || !STEP_DIRS[dir]) return null;
  const [dr, dc] = STEP_DIRS[dir];
  const diagonal = dr !== 0 && dc !== 0;
  if (!(diagonal ? ACTIVE_LAWS.diagonalSlide : ACTIVE_LAWS.slide)) return null;
  const key = slideKey(dir);
  // (With two sets of singularities a slide into one has a key for each
  // way out: any of them will do.)
  const ofKey = (moves) => Object.keys(moves).find((k) => plainKeyOf(k) === key);
  if (ofKey(legalMovesFor(pieces, piece, remaining))) return null;
  const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
  const entered = enteredCells(piece, candidate);
  const free = legalMovesFor(pieces, piece, Infinity);
  const k = ofKey(free);
  if (k) return costReason(pieces, piece, free[k], remaining, dir, entered);
  return slideTrouble(pieces, piece, candidate, [dr, dc], diagonal, dir, entered)
    || { code: "blocked", kind: "slide", dir, ...mark(entered, pieces) };
}

/* A piece pressed that has no move at all, with `remaining` left: null
   when it has one; "cost" when it would have, with more actions; else
   "boxed", with what stops it each way it could go (`reasons`). */
export function whyNoMove(pieces, piece, remaining = Infinity) {
  if (!piece) return null;
  if (Object.keys(legalMovesFor(pieces, piece, remaining)).length) return null;
  const free = legalMovesFor(pieces, piece, Infinity);
  const keys = Object.keys(free);
  if (keys.length) {
    const key = keys.reduce((a, b) => (moveCost(free[b]) < moveCost(free[a]) ? b : a));
    const dir = isSlideKey(key) ? baseDirOfSlideKey(key) : plainKeyOf(key);
    return { ...costReason(pieces, piece, free[key], remaining, dir, []), whole: true, cells: [], top: 0 };
  }
  const reasons = [];
  if (piece.type === "cabeza") {
    for (const dir of Object.keys(STEP_DIRS)) reasons.push(stepTrouble(pieces, piece, dir));
  } else {
    for (const dir of ROLL_DIRS) reasons.push(rollTrouble(pieces, piece, dir));
    const slides = [...(ACTIVE_LAWS.slide ? ROLL_DIRS : []), ...(ACTIVE_LAWS.diagonalSlide ? DIAGONALS : [])];
    for (const dir of slides) {
      const [dr, dc] = STEP_DIRS[dir];
      const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
      reasons.push(slideTrouble(pieces, piece, candidate, [dr, dc], dr !== 0 && dc !== 0, dir, enteredCells(piece, candidate)));
    }
  }
  return { code: "boxed", kind: piece.type === "cabeza" ? "step" : "move", reasons: reasons.filter(Boolean), cells: [], top: 0 };
}

// A move the rules allow but the actions left don't cover.
function costReason(pieces, piece, move, remaining, dir, entered) {
  const pushed = (move.shoves || []).map((s) => pieces.find((p) => p.id === s.id)).filter(Boolean);
  const cells = pushed.flatMap((q) => clashCells(move.candidate, q));
  const kind = move.isSlide ? "slide" : piece.type === "cabeza" ? "step" : "roll";
  return {
    code: "cost", kind, dir, opa: piece.type === "opa",
    cost: moveCost(move),
    base: move.isSlide ? SLIDE_COST : piece.type === "opa" ? OPA_MOVE_COST : 1,
    push: move.shoves ? SHOVE_COST : 0,
    left: remaining === Infinity ? 0 : Math.max(0, remaining),
    pushed: pushed.map(brief),
    firstTurnShort: firstTurnShort(),
    ...mark(cells.length ? cells : entered, pieces),
  };
}

// translatedCandidate's checks, for a slide (a Cabeza's step: stepTrouble).
function slideTrouble(pieces, piece, candidate, [dr, dc], diagonal, dir, entered) {
  const where = whereTrouble(pieces, candidate, "slide", dir, entered);
  if (where !== undefined) return where;
  const hits = pieces.filter((p) => p.id !== piece.id && piecesClash(candidate, p));
  if (!hits.length) return null;
  // Shoves are never diagonal (user), even with Diagonal slide on.
  if (diagonal && ACTIVE_LAWS.shoving) {
    return { code: "diagonalPush", kind: "slide", dir, blockers: hits.map(brief), ...mark(hits.flatMap((q) => clashCells(candidate, q)), pieces) };
  }
  return pushTrouble(pieces, piece, candidate, hits, [dr, dc], { kind: "slide", dir, allowShove: !!ACTIVE_LAWS.shoving && !diagonal, why: "noPushing" });
}

// A Cabeza's step (legalCabezaSteps): it never pushes, and never crushes.
function stepTrouble(pieces, piece, dir) {
  const [dr, dc] = STEP_DIRS[dir];
  const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
  const entered = enteredCells(piece, candidate);
  const where = whereTrouble(pieces, candidate, "step", dir, entered);
  if (where !== undefined) return where;
  const hits = pieces.filter((p) => p.id !== piece.id && piecesClash(candidate, p));
  if (!hits.length) return null;
  return { code: "inTheWay", kind: "step", dir, why: "cabeza", blockers: hits.map(brief), ...mark(hits.flatMap((q) => clashCells(candidate, q)), pieces) };
}

// rollMove's (and rollShove's) checks, for a roll.
function rollTrouble(pieces, piece, dir) {
  const candidate = rollBlock(piece, dir);
  const entered = enteredCells(piece, candidate);
  const sweep = anyOddShape(pieces);
  const verdict = evaluateBlockLanding(pieces, candidate, STEP_DIRS[dir]);
  const sweeps = (ignore) => sweep && rollSweepClashes(pieces, piece, dir, ignore);
  if (verdict.legal) return sweeps(verdict.crushes) ? { code: "sweep", kind: "roll", dir, ...mark(entered, pieces) } : null;
  const where = whereTrouble(pieces, candidate, "roll", dir, entered);
  if (where !== undefined) return where;
  const hits = pieces.filter((p) => p.id !== piece.id && piecesClash(candidate, p));
  if (!hits.length) return null;
  const shoves = !!ACTIVE_LAWS.shoving && ACTIVE_LAWS.shoveOnRolls !== false;
  const r = pushTrouble(pieces, piece, candidate, hits, STEP_DIRS[dir], { kind: "roll", dir, allowShove: shoves, clearOfLanding: true, why: ACTIVE_LAWS.shoving ? "slidesOnly" : "noPushing" });
  if (r) return r;
  return sweeps(hits) ? { code: "sweep", kind: "roll", dir, ...mark(entered, pieces) } : null;
}

/* Where a move would land, before any piece is asked about: off the
   board, on a missing square, half over a singularity, or into one whose
   way out is shut. undefined when the landing itself is fine. */
function whereTrouble(pieces, candidate, kind, dir, entered) {
  if (!inBounds(candidate)) return { code: "edge", kind, dir, ...mark(entered.filter(offBoard), pieces) };
  if (overlapsMissingSquare(candidate)) return { code: "missing", kind, dir, ...mark(groundCellsOf(candidate).filter(onMissing), pieces) };
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked) return { code: "holeTooBig", kind, dir, ...mark(groundCellsOf(candidate).filter(onHole), pieces) };
  // Into a singularity, refused: the square it would come out onto.
  if (bh.teleportTo) return { code: "holeExit", kind, dir, ...mark(groundCellsOf(candidate).filter(onHole), pieces) };
  return undefined;
}

/* Pieces in the way of `landing`: why they block it. allowShove false:
   nothing's pushed (`why` says why not); else tryShove's checks (or
   shoveLine's, set to push the line behind) in their order. null when
   the push would go through. */
function pushTrouble(pieces, mover, landing, hits, [dr, dc], { kind, dir, allowShove, clearOfLanding = false, why }) {
  const at = (qs) => mark(qs.flatMap((q) => clashCells(landing, q)), pieces);
  if (!allowShove) {
    // A slide onto the other side's lone Cabeza: slides never crush.
    if (kind === "slide" && hits.length === 1 && hits[0].type === "cabeza" && hits[0].owner !== mover.owner) {
      return { code: "noCrushBySlide", kind, dir, blockers: hits.map(brief), ...at(hits) };
    }
    return { code: "inTheWay", kind, dir, why, blockers: hits.map(brief), ...at(hits) };
  }
  if (ACTIVE_LAWS.shoveOwn === false) {
    const own = hits.filter((p) => p.owner === mover.owner);
    if (own.length) return { code: "own", kind, dir, blockers: own.map(brief), ...at(own) };
  }
  if (ACTIVE_LAWS.shoveChain) return lineTrouble(pieces, mover, landing, hits, [dr, dc], clearOfLanding, kind, dir);
  const mass = hits.reduce((n, q) => n + cubeCount(q), 0);
  if (cubeCount(mover) <= mass) return { code: "heavy", kind, dir, pushed: hits.map(brief), mass, cubes: cubeCount(mover), ...at(hits) };
  const others = pieces.filter((p) => p.id !== mover.id);
  const reach = clearOfLanding ? (dc ? landing.w : landing.h) : 1;
  const outs = [];
  const noRoom = (qs, behind, cells, blocker) => ({ code: "noRoom", kind, dir, pushed: qs.map(brief), behind, ...(blocker ? { blocker: brief(blocker) } : {}), ...mark(cells, pieces) });
  for (const q of hits) {
    let end = null;
    for (let k = 1; k <= reach && !end; k++) {
      const pos = { ...q, row: q.row + dr * k, col: q.col + dc * k };
      const r = roomTrouble(pos, q, [dr, dc]);
      if (r) return noRoom([q], r.behind, r.cells);
      if (r === false) { end = { pos: ejectOf(pos, q, [dr, dc]), teleports: true }; break; }
      const blocker = others.find((p) => p.id !== q.id && piecesClash(pos, p));
      if (blocker) return noRoom([q], "piece", clashCells(pos, blocker), blocker);
      if (!clearOfLanding || !piecesClash(pos, landing)) end = { pos, teleports: false };
    }
    if (!end) return noRoom([q], "room", cubeCells(q));
    outs.push({ q, ...end });
  }
  for (let i = 0; i < outs.length; i++) {
    const a = outs[i].pos;
    if (piecesClash(a, landing)) return noRoom([outs[i].q], "room", cubeCells(outs[i].q));
    const still = others.find((p) => !hits.includes(p) && piecesClash(a, p));
    if (still) return noRoom([outs[i].q], "piece", clashCells(a, still), still);
    for (let j = i + 1; j < outs.length; j++) if (piecesClash(a, outs[j].pos)) return noRoom([outs[i].q, outs[j].q], "room", [...cubeCells(outs[i].q), ...cubeCells(outs[j].q)]);
  }
  return null;
}

/* Where a pushed piece `q` would go (`pos`): the board's edge, a missing
   square, a singularity it can't drop into or whose way out is shut, as
   { behind, cells }; false when it drops into a singularity and comes
   out; null when the square itself is fine. */
function roomTrouble(pos, q, [dr, dc]) {
  if (!inBounds(pos)) return { behind: "edge", cells: boxCells(pos).filter(offBoard) };
  if (overlapsMissingSquare(pos)) return { behind: "missing", cells: groundCellsOf(pos).filter(onMissing) };
  const bh = blackHoleVerdict(pos);
  const holeCells = () => groundCellsOf(pos).filter(onHole);
  if (bh.blocked) return { behind: "hole", cells: holeCells() };
  if (bh.teleportTo) {
    if (q.type !== "turrito" && q.type !== "cabeza") return { behind: "hole", cells: holeCells() };
    const eject = ejectOf(pos, q, [dr, dc]);
    if (!inBounds(eject) || overlapsMissingSquare(eject) || blackHoleAt(eject.row, eject.col)) return { behind: "holeExit", cells: holeCells() };
    return false;
  }
  return null;
}
function ejectOf(pos, q, [dr, dc]) {
  const to = blackHoleVerdict(pos).teleportTo;
  return { ...q, row: to.row - dr, col: to.col - dc };
}

// shoveLine's checks: the line behind pushed along too.
function lineTrouble(pieces, mover, landing, hits, [dr, dc], clearOfLanding, kind, dir) {
  const reach = clearOfLanding ? (dc ? landing.w : landing.h) : 1;
  const limit = cubeCount(mover);
  const near = (p) => (dc > 0 ? p.col : dc < 0 ? -(p.col + p.w) : dr > 0 ? p.row : -(p.row + p.h));
  const others = pieces.filter((p) => p.id !== mover.id).sort((a, b) => near(a) - near(b));
  const hit = new Set(hits.map((q) => q.id));
  const placed = [landing];
  const out = [];
  const pushed = new Set();
  const line = [];
  let mass = 0;
  const noRoom = (qs, behind, cells, blocker) => ({ code: "noRoom", kind, dir, line: true, pushed: qs.map(brief), behind, ...(blocker ? { blocker: brief(blocker) } : {}), ...mark(cells, pieces) });
  for (let more = true; more; ) {
    more = false;
    for (const q of others) {
      if (pushed.has(q.id) || (!hit.has(q.id) && !placed.some((s) => piecesClash(q, s)))) continue;
      if (ACTIVE_LAWS.shoveOwn === false && q.owner === mover.owner) return { code: "own", kind, dir, line: true, blockers: [brief(q)], ...mark(cubeCells(q), pieces) };
      mass += cubeCount(q);
      line.push(q);
      if (mass >= limit) return { code: "heavy", kind, dir, line: line.length > hits.length, pushed: line.map(brief), mass, cubes: limit, ...mark(line.flatMap(cubeCells), pieces) };
      let end = null;
      const path = [];
      for (let k = 1; k <= reach && !end; k++) {
        const pos = { ...q, row: q.row + dr * k, col: q.col + dc * k };
        const r = roomTrouble(pos, q, [dr, dc]);
        if (r) return noRoom([q], r.behind, r.cells);
        if (r === false) { end = { pos: ejectOf(pos, q, [dr, dc]), teleports: true }; break; }
        if (!placed.some((s) => piecesClash(pos, s))) end = { pos, teleports: false };
        else path.push(pos);
      }
      if (!end) return noRoom([q], "room", cubeCells(q));
      out.push({ q, path, ...end });
      pushed.add(q.id);
      more = true;
      if (!end.teleports) placed.push(end.pos);
    }
  }
  const still = others.filter((p) => !pushed.has(p.id));
  for (let i = 0; i < out.length; i++) {
    const a = out[i].pos;
    if (piecesClash(a, landing)) return noRoom([out[i].q], "room", cubeCells(out[i].q));
    const s = still.find((p) => piecesClash(a, p));
    if (s) return noRoom([out[i].q], "piece", clashCells(a, s), s);
    for (const pos of out[i].path) {
      const sp = still.find((p) => piecesClash(pos, p));
      if (sp) return noRoom([out[i].q], "piece", clashCells(pos, sp), sp);
    }
    for (let j = i + 1; j < out.length; j++) if (piecesClash(a, out[j].pos)) return noRoom([out[i].q, out[j].q], "room", [...cubeCells(out[i].q), ...cubeCells(out[j].q)]);
  }
  return null;
}
