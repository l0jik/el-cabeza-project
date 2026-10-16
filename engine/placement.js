/* Placing the pieces manually before a game (user: "a toggle(?) / way
   to manually place pieces before the start of a match ... If playing
   against AI, it will automatically preserve rotational symmetry ... If
   the newly moved piece displaces a piece ... placed outside the board
   until the user returns to place it"; of the five ways mocked up they
   picked dragging a piece, or tapping it then a square; the back three
   rows, or anywhere in your own half; two players mirrored as well; and
   "Same as last time").

   A set-out: { side, half, pieces, bench }. `side` is the one setting out
   (its pieces move; the other side's are their 180° mirror, as the
   standard opening is), `half` lets them go up to the middle of the board
   instead of only the back three rows, `pieces` are the pieces on the
   board, both sides, and `bench` the setting side's pieces off it (their
   mirrors are off it too). Pure: each step gives a new set-out. The
   chassis (ElCabeza3D.jsx, the set-out banner) draws and drives it. */

import { BOARD_ROWS, BOARD_COLS, MISSING_SQUARES, BLACK_HOLES, withFullTurn } from "./constants.js";
import { piecesClash, groundCellsOf, maskAt, mirrorVox, parseVox, voxKey } from "./shapes.js";
import { PIECE_ORIENTATIONS } from "./anomaly.js";
import { cabezaInDanger } from "./ai.js";

// The back rows a side sets out in (the standard set's Opa stands in the
// third), or with `half`, up to the middle (an odd middle row is nobody's).
export const HOME_ROWS = 3;
export const otherSide = (side) => (side === "dark" ? "light" : "dark");
// A piece's counterpart on the other side: dark-flaco and light-flaco.
export const pairId = (id) => id.replace(/^(dark|light)-/, (m, s) => `${otherSide(s)}-`);
// Its name without the side: "flaco", "codo-1" (what's kept for next time).
export const keyOf = (id) => id.replace(/^(dark|light)-/, "");

export function zoneRows(side, half, rows = BOARD_ROWS) {
  const most = Math.floor(rows / 2);
  const n = Math.max(1, half ? most : Math.min(HOME_ROWS, most));
  return side === "dark" ? [0, n] : [rows - n, rows];
}

// A piece's 180° mirror: the other side's copy, turned about the board's
// centre (as Light's opening mirrors Dark's).
export function mirrorOf(p, rows = BOARD_ROWS, cols = BOARD_COLS) {
  const m = { ...p, id: pairId(p.id), owner: otherSide(p.owner), row: rows - p.row - p.h, col: cols - p.col - p.w };
  if (p.vox) m.vox = mirrorVox(p);
  return m;
}

const blocked = (r, c) => MISSING_SQUARES.some((s) => s.row === r && s.col === c) || BLACK_HOLES.some((s) => s.row === r && s.col === c);
// Where a piece may stand as it's set out: inside its side's rows and the
// board, with nothing under it missing or a black hole; nor under its
// mirror (squares marked by hand needn't be in pairs).
export function fitsZone(p, side, half) {
  const [r0, r1] = zoneRows(side, half);
  if (p.row < r0 || p.row + p.h > r1 || p.col < 0 || p.col + p.w > BOARD_COLS) return false;
  if (!MISSING_SQUARES.length && !BLACK_HOLES.length) return true;
  return ![...groundCellsOf(p), ...groundCellsOf(mirrorOf(p))].some(([r, c]) => blocked(r, c));
}

const copy = (p) => ({ ...p });
const own = (so) => so.pieces.filter((p) => p.owner === so.side);
// The board for a set-out: the setting side's pieces and their mirrors.
function mirrored(so, mine) {
  return { ...so, pieces: [...mine.map(copy), ...mine.map((p) => mirrorOf(p))] };
}

// The set-out to start from: the pieces as they stand (the standard
// opening, or the one a menu set up). The other side is made the setting
// side's mirror, so it is one from the start.
export function startSetOut(pieces, side, half = false) {
  return mirrored({ side, half, pieces: [], bench: [] }, pieces.filter((p) => p.owner === side));
}

// A piece's pose: its size and cubes, without where it stands.
const poseOf = (p) => ({ w: p.w, h: p.h, z: p.z, ...(p.vox ? { vox: p.vox } : {}) });
// (Cubes compared as a set: a pose's list may be written in any order.)
const cubes = (vox) => (vox ? voxKey(parseVox(vox)) : "");
const samePose = (a, b) => a.w === b.w && a.h === b.h && a.z === b.z && cubes(a.vox) === cubes(b.vox);

// Every anchor where piece `id` (on the board or the bench) may be set in
// its pose: in its side's rows, nothing missing under it. Others of its
// side may stand there: they're swapped or benched (place).
export function targets(so, id) {
  const p = own(so).find((q) => q.id === id) || so.bench.find((q) => q.id === id);
  if (!p) return [];
  const [r0, r1] = zoneRows(so.side, so.half);
  const out = [];
  for (let row = r0; row + p.h <= r1; row++) {
    for (let col = 0; col + p.w <= BOARD_COLS; col++) {
      if (fitsZone({ ...p, row, col }, so.side, so.half)) out.push({ row, col });
    }
  }
  return out;
}

// The squares a piece covers (a cube anywhere above them), as "row,col".
function squaresOf(p) {
  const out = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (maskAt(p, p.row + y, p.col + x)) out.push(`${p.row + y},${p.col + x}`);
  return out;
}
// The squares a piece just left: where it stood, less where it stands now.
function squaresLeft(before, after) {
  const now = new Set(squaresOf(after));
  return new Set(squaresOf(before).filter((k) => !now.has(k)));
}

/* Swap when it fits (the mock-ups' shared rules): a piece landed on goes
   into the squares just left, if it fits inside them as it stands and
   nothing else is in the way; nearest where it stood. Null: it waits on
   the bench. */
function swapSpot(q, left, others, side, half) {
  if (!left.size) return null;
  const cells = [...left].map((k) => k.split(",").map(Number));
  const r0 = Math.min(...cells.map((c) => c[0])), r1 = Math.max(...cells.map((c) => c[0]));
  const c0 = Math.min(...cells.map((c) => c[1])), c1 = Math.max(...cells.map((c) => c[1]));
  let best = null, bestD = Infinity;
  for (let row = r0; row + q.h - 1 <= r1; row++) {
    for (let col = c0; col + q.w - 1 <= c1; col++) {
      const s = { ...q, row, col };
      if (!squaresOf(s).every((k) => left.has(k))) continue;
      if (!fitsZone(s, side, half) || others.some((o) => piecesClash(s, o))) continue;
      const d = Math.abs(row - q.row) + Math.abs(col - q.col);
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}

// The pieces `p` now stands on: each swapped into the squares `left`
// if it fits there, or onto the bench. The set-out with p in place.
function settle(so, rest, p, left, bench) {
  const hit = rest.filter((q) => piecesClash(p, q));
  const placed = [...rest.filter((q) => !hit.includes(q)), p];
  for (const q of hit) {
    const spot = swapSpot(q, left, placed, so.side, so.half);
    if (spot) placed.push(spot);
    else bench.push(copy(q));
  }
  return mirrored({ ...so, bench }, placed);
}

/* Piece `id` (on the board or the bench) set at row, col. Whatever it
   lands on of its side goes into the squares it left, if it fits inside
   them (a swap); otherwise to the bench (user: "placed outside the board
   until the user returns to place it"). The other side follows as the
   mirror. Null if it can't stand there. */
export function place(so, id, row, col) {
  const mine = own(so);
  const from = mine.find((q) => q.id === id) || so.bench.find((q) => q.id === id);
  if (!from) return null;
  const moved = { ...from, row, col };
  if (!fitsZone(moved, so.side, so.half)) return null;
  const onBoard = mine.some((q) => q.id === id);
  const left = onBoard ? squaresLeft(from, moved) : new Set();
  return settle(so, mine.filter((q) => q.id !== id), moved, left, so.bench.filter((q) => q.id !== id));
}

/* "Put it back": a piece on the bench back on the squares it last stood
   on, if they're free (and still in its rows). Null if not. */
export function putBack(so, id) {
  const p = so.bench.find((q) => q.id === id);
  if (!p || !fitsZone(p, so.side, so.half) || own(so).some((q) => piecesClash(p, q))) return null;
  return mirrored({ ...so, bench: so.bench.filter((q) => q !== p) }, [...own(so), copy(p)]);
}

// The poses a piece may start in (engine/anomaly.js), and the next one
// after its own.
function nextPose(p) {
  const list = PIECE_ORIENTATIONS[p.type] || [];
  if (list.length < 2) return null;
  const i = list.findIndex((o) => samePose(o, p));
  return list[(i + 1) % list.length];
}

/* Piece `id` on the board turned to its next pose where it stands (kept
   inside its rows, moved back in if it would reach out of them); what it
   now covers swaps into the squares it left if it fits, or goes to the
   bench. Null if it has only one pose or can't stand near there turned. */
export function turn(so, id) {
  const mine = own(so);
  const p = mine.find((q) => q.id === id);
  if (!p) return null;
  const pose = nextPose(p);
  if (!pose) return null;
  const [r0, r1] = zoneRows(so.side, so.half);
  const turned = { ...p, w: pose.w, h: pose.h, z: pose.z };
  delete turned.vox;
  if (pose.vox) turned.vox = pose.vox;
  turned.row = Math.max(r0, Math.min(turned.row, r1 - turned.h));
  turned.col = Math.max(0, Math.min(turned.col, BOARD_COLS - turned.w));
  if (!fitsZone(turned, so.side, so.half)) return null;
  return settle(so, mine.filter((q) => q.id !== id), turned, squaresLeft(p, turned), [...so.bench]);
}

/* With `half` switched (on: up to the middle; off: the back three rows
   again), the pieces that no longer fit their rows go to the bench. */
export function setHalf(so, half) {
  const next = { ...so, half };
  const mine = own(so);
  const keep = mine.filter((p) => fitsZone(p, so.side, half));
  return mirrored({ ...next, bench: [...so.bench, ...mine.filter((p) => !keep.includes(p)).map(copy)] }, keep);
}

/* Ready to begin: nothing waiting on the bench, and neither Cabeza where
   the other side could crush it with its first turn (the test the shuffle
   uses; the set-out is a mirror, so one side's answer is the other's). */
export function readiness(so) {
  if (so.bench.length) return { ok: false, reason: "bench" };
  for (const side of ["dark", "light"]) {
    if (so.pieces.some((p) => p.type === "cabeza" && p.owner === side) && withFullTurn(() => cabezaInDanger(so.pieces.map(copy), side))) return { ok: false, reason: "danger", side };
  }
  return { ok: true, reason: null };
}

/* Same as last time: the set-out kept as Dark's pieces by name, with the
   board's size and the roster it was for (as Dark would see it: Light's
   set-out turned round). Restored only onto the same roster and board. */
export function keep(so, rows = BOARD_ROWS, cols = BOARD_COLS) {
  const mine = own(so).map((p) => (so.side === "dark" ? p : mirrorOf(p, rows, cols)));
  return {
    rows, cols, half: so.half,
    pieces: mine.map((p) => ({ key: keyOf(p.id), type: p.type, row: p.row, col: p.col, ...poseOf(p) })).sort((a, b) => (a.key < b.key ? -1 : 1)),
  };
}
const rosterOf = (list) => list.map((p) => `${keyOf(p.key || p.id)}:${p.type}`).sort().join(",");
export function canRestore(saved, so, rows = BOARD_ROWS, cols = BOARD_COLS) {
  if (!saved || !Array.isArray(saved.pieces) || saved.rows !== rows || saved.cols !== cols) return false;
  return rosterOf(saved.pieces) === rosterOf([...own(so), ...so.bench]);
}
export function restore(saved, so, rows = BOARD_ROWS, cols = BOARD_COLS) {
  if (!canRestore(saved, so, rows, cols)) return null;
  const half = !!saved.half;
  const ids = new Map([...own(so), ...so.bench].map((p) => [keyOf(p.id), p]));
  const mine = saved.pieces.map((s) => {
    const p = ids.get(s.key);
    const dark = { ...p, id: `dark-${s.key}`, owner: "dark", row: s.row, col: s.col, w: s.w, h: s.h, z: s.z };
    delete dark.vox;
    if (s.vox) dark.vox = s.vox;
    return so.side === "dark" ? dark : mirrorOf(dark, rows, cols);
  });
  if (mine.some((p) => !fitsZone(p, so.side, half))) return null;
  for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (piecesClash(mine[i], mine[j])) return null;
  return mirrored({ ...so, half, bench: [] }, mine);
}
