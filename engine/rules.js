/* Core move/board rules for El Cabeza. Verified byte-for-byte identical
   between the Standard and Neon theme sources before extraction — see
   build/scratch/. Pure logic: no React, no Three.js, no DOM. */

import { BOARD_ROWS, BOARD_COLS, ROLL_DIRS, STEP_DIRS, ACTIVE_LAWS, slideKey, BLACK_HOLES, MISSING_SQUARES, SLIDE_COST, OPA_MOVE_COST, MAX_PIECES_PER_TURN, moveCost, PIVOT_KEYS } from "./constants.js";
import { rollVox, groundCellsOf, piecesClash, rollSweepClashes, anyOddShape, cubeCount, pivotCellOf, pivotPiece, pivotSweepClashes } from "./shapes.js";

/* Dark's half of the opening setup, with columns expressed RELATIVE to
   the leftmost of the four columns the formation occupies, so the whole
   thing can be re-centred on a board of any width. At the 10-wide
   default the offset below works out to 3, reproducing the original
   hardcoded columns (3,4,5,6 / opa at 4) exactly. */
const DARK_SETUP = [
  { id: "dark-flaco", type: "flaco", row: 0, relCol: 0, w: 1, h: 2, z: 1 },
  { id: "dark-turrito", type: "turrito", row: 0, relCol: 1, w: 1, h: 1, z: 1 },
  { id: "dark-cabeza", type: "cabeza", row: 0, relCol: 2, w: 1, h: 1, z: 1 },
  { id: "dark-chato", type: "chato", row: 0, relCol: 3, w: 1, h: 2, z: 2 },
  { id: "dark-opa", type: "opa", row: 1, relCol: 1, w: 2, h: 2, z: 2 },
];

/* Light is the 180° rotation of Dark (row -> ROWS-row-h, col ->
   COLS-col-w), which is what makes the opening position rotationally
   symmetric at any board size rather than a second hand-placed table
   that would have to be re-derived per size. Listed in this order, and
   emitted after Dark's, purely to keep createInitialPieces' output
   array order byte-identical to the original hardcoded version — see
   the order assertion in tests/board-size.smoke.mjs. */
const LIGHT_ORDER = ["chato", "opa", "cabeza", "turrito", "flaco"];

const SETUP_WIDTH = 4; // columns Dark's formation spans

export function createInitialPieces() {
  return initialPiecesFor(BOARD_ROWS, BOARD_COLS);
}

// The standard opening for an explicit board size, independent of the live
// engine dimensions — e.g. to keep a setup-time random Black Hole / Missing
// Square off the opening pieces of a board that isn't applied yet.
export function initialPiecesFor(BOARD_ROWS, BOARD_COLS) {
  const colOffset = Math.floor((BOARD_COLS - SETUP_WIDTH) / 2);
  const dark = DARK_SETUP.map((p) => ({
    id: p.id,
    type: p.type,
    owner: "dark",
    row: p.row,
    col: p.relCol + colOffset,
    w: p.w,
    h: p.h,
    z: p.z,
  }));
  const light = LIGHT_ORDER.map((type) => {
    const d = dark.find((p) => p.type === type);
    return {
      id: "light-" + type,
      type,
      owner: "light",
      row: BOARD_ROWS - d.row - d.h,
      col: BOARD_COLS - d.col - d.w,
      w: d.w,
      h: d.h,
      z: d.z,
    };
  });
  return [...dark, ...light];
}

export function cellsOf(piece) {
  const cells = [];
  for (let r = piece.row; r < piece.row + piece.h; r++) {
    for (let c = piece.col; c < piece.col + piece.w; c++) cells.push([r, c]);
  }
  return cells;
}

export function getPieceAt(pieces, row, col) {
  return (
    pieces.find(
      (p) => row >= p.row && row < p.row + p.h && col >= p.col && col < p.col + p.w
    ) || null
  );
}

export function rollBlock(piece, dir) {
  const { row, col, w, h, z } = piece;
  // An odd-shaped piece (see engine/shapes.js) turns its cubes with it;
  // its bounding box moves exactly like a box's below.
  if (piece.vox) {
    const vox = rollVox(piece, dir);
    switch (dir) {
      case "E": return { ...piece, col: col + w, w: z, z: w, vox };
      case "W": return { ...piece, col: col - z, w: z, z: w, vox };
      case "S": return { ...piece, row: row + h, h: z, z: h, vox };
      case "N": return { ...piece, row: row - z, h: z, z: h, vox };
      default: return piece;
    }
  }
  switch (dir) {
    case "E":
      return { ...piece, col: col + w, w: z, z: w };
    case "W":
      return { ...piece, col: col - z, w: z, z: w };
    case "S":
      return { ...piece, row: row + h, h: z, z: h };
    case "N":
      return { ...piece, row: row - z, h: z, z: h };
    default:
      return piece;
  }
}

export function inBounds(piece) {
  return (
    piece.row >= 0 &&
    piece.col >= 0 &&
    piece.row + piece.h <= BOARD_ROWS &&
    piece.col + piece.w <= BOARD_COLS
  );
}

/* Black Hole Squares LAW (SINGULARITY_DESIGN.md): BLACK_HOLES is either
   [] (law off) or exactly the two paired squares pickBlackHoleSquares
   below placed. blackHoleAt/otherBlackHole are trivial when empty —
   .find on [] is always undefined — which is what keeps every caller
   below a no-op with the law off. */
function blackHoleAt(row, col) {
  return BLACK_HOLES.find((b) => b.row === row && b.col === col) || null;
}
function otherBlackHole(square) {
  return BLACK_HOLES.length === 2 ? BLACK_HOLES.find((b) => b !== square) : null;
}

/* Missing Squares TOPOLOGIES option: MISSING_SQUARES is either [] (off)
   or one to five rotationally-paired squares pickMissingSquares below
   placed (two to ten squares in all).
   Unlike a black hole there's no verdict object to build — a candidate
   whose footprint overlaps one at all is simply illegal, checked
   alongside inBounds at both chokepoints every move type funnels
   through (evaluateBlockLanding, translatedCandidate) below. */
function missingSquareAt(row, col) {
  return MISSING_SQUARES.some((m) => m.row === row && m.col === col);
}
/* Only the squares a piece actually stands on count — an odd-shaped
   piece's overhang may hang over a Missing Square (see engine/shapes.js).
   For a box that's its whole footprint, as always. */
function overlapsMissingSquare(candidate) {
  if (!MISSING_SQUARES.length) return false; // the common case, checked at every node of an AI search
  return groundCellsOf(candidate).some(([r, c]) => missingSquareAt(r, c));
}

/* A candidate's fate w.r.t. black holes: blocked outright, passes
   through untouched, or is redirected (wormhole entry) to the paired
   square. ONLY a candidate whose ENTIRE footprint is exactly one cell,
   sitting exactly on a hole, can enter — "no partial/failed-entry" and
   "route around it" (the design doc's words for a multi-cell piece)
   cash out to: any overlap at all with a hole cell blocks a >1-cell
   footprint outright, since such a footprint can never coincide with a
   single hole-cell exactly, so it can never legally "enter." */
function blackHoleVerdict(candidate) {
  // As with Missing Squares, only squares the piece stands on count: an
  // overhang may hang over a hole. And only a one-square piece can ever
  // enter — an odd-shaped piece never is one, even balanced on a single
  // cube, so it can never drop in.
  if (!BLACK_HOLES.length) return { blocked: false, teleportTo: null }; // no holes this game
  const cells = groundCellsOf(candidate);
  const hit = cells.map(([r, c]) => blackHoleAt(r, c)).find(Boolean);
  if (!hit) return { blocked: false, teleportTo: null };
  if (cells.length === 1 && candidate.w === 1 && candidate.h === 1) {
    const other = otherBlackHole(hit);
    if (other) return { blocked: false, teleportTo: other };
  }
  return { blocked: true, teleportTo: null };
}

/* The piece-occupancy-only half of landing legality, factored out of
   evaluateBlockLanding so a wormhole's teleport destination (itself a
   black hole cell — see evaluateBlockLanding below) can be checked
   against THIS, not the public function, and so never re-triggers
   blackHoleVerdict on the far end. Recursing into the public function
   there would detect "landing exactly on a hole cell" a second time and
   try to teleport back to where the piece just came from. */
function pieceOccupancyVerdict(pieces, candidate) {
  // Every piece sharing a cube with the landing (see engine/shapes.js —
  // a piece sheltered under an overhang doesn't share one, so it's
  // neither a clash nor a crush).
  const hits = [];
  for (const p of pieces) {
    if (p.id !== candidate.id && piecesClash(candidate, p)) hits.push(p);
  }
  if (hits.length === 0) return { legal: true, crushes: null };
  // Landing on a lone enemy Cabeza is a crush ONLY when the moving piece
  // is a block — a Cabeza can never capture/crush another Cabeza (it wins
  // by reaching the far edge, not by landing on the enemy Cabeza). Without
  // the type guard a Cabeza stepping onto an enemy Cabeza — most easily
  // via a Black Hole Squares wormhole ejecting it right onto one — was
  // wrongly scored as a crush and a win. A Cabeza landing there is instead
  // illegal (so a wormhole whose exit holds an enemy Cabeza can't be
  // entered by a Cabeza at all), which falls through to the return below.
  if (
    hits.length === 1 &&
    hits[0].type === "cabeza" &&
    hits[0].owner !== candidate.owner &&
    candidate.type !== "cabeza"
  ) {
    return { legal: true, crushes: hits[0] };
  }
  return { legal: false, crushes: null };
}

export function evaluateBlockLanding(pieces, candidate, travelDir) {
  if (!inBounds(candidate)) return { legal: false, crushes: null };
  if (overlapsMissingSquare(candidate)) return { legal: false, crushes: null };
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked) return { legal: false, crushes: null };
  if (bh.teleportTo) {
    // Wormhole entry: the piece is EJECTED one cell past the far hole,
    // on the same relative side it entered from — far hole minus its
    // unit direction of travel (a piece that went east into the near
    // mouth emerges on the west side of the far one). It never rests on
    // a hole square. The EJECTION square, not the hole itself, is what's
    // checked — for bounds and for plain piece occupancy (a lone enemy
    // Cabeza there is a legal crush only for a BLOCK entering; a Cabeza
    // can't crush a Cabeza, so pieceOccupancyVerdict makes that ejection
    // illegal). Off-board or blocked by a non-crushable piece there = the
    // entry is simply illegal, no partial entry. travelDir is [dr,dc]; a
    // caller reaching a wormhole always has it (see legalRolls/
    // translatedCandidate).
    const [dr, dc] = travelDir;
    const eject = { ...candidate, row: bh.teleportTo.row - dr, col: bh.teleportTo.col - dc };
    if (!inBounds(eject)) return { legal: false, crushes: null };
    if (overlapsMissingSquare(eject)) return { legal: false, crushes: null };
    const verdict = pieceOccupancyVerdict(pieces, eject);
    return verdict.legal ? { ...verdict, teleportsTo: { row: eject.row, col: eject.col } } : { legal: false, crushes: null };
  }
  return pieceOccupancyVerdict(pieces, candidate);
}

/* Random-but-fair placement shared by both paired-square features (Black
   Hole Squares and Missing Squares): a uniformly random empty cell,
   paired with its 180-degree rotation partner — the exact same point-
   symmetry createInitialPieces already uses for Dark/Light mirroring
   above (row -> rows-row-h, col -> cols-col-w), which is what
   "rotationally-symmetric locations relative to each other" means here.
   `avoid` is the OTHER feature's own resolved squares, if any — Black
   Hole Squares and Missing Squares are mutually exclusive per cell (a
   square that's simultaneously an impassable void and a wormhole mouth
   is undefined), so whichever of the two resolves second treats the
   first's placement as occupied too. Bounded retries rather than an
   exhaustive search: a board packed enough that no valid pair exists at
   all is exceedingly rare, and degrading to "the feature has no effect
   this game" ([]) is a reasonable fallback rather than something worth
   more engineering. */
function pickPairedSquares(pieces, rows, cols, avoid, attempts, rowAllowed = () => true, accept = () => true) {
  for (let i = 0; i < attempts; i++) {
    const r = Math.floor(Math.random() * rows);
    if (!rowAllowed(r, rows)) continue;
    const c = Math.floor(Math.random() * cols);
    const r2 = rows - 1 - r;
    const c2 = cols - 1 - c;
    if (r === r2 && c === c2) continue; // odd-dimension center coincidence -- can't hold two on one square
    if (getPieceAt(pieces, r, c) || getPieceAt(pieces, r2, c2)) continue;
    if (avoid.some((a) => (a.row === r && a.col === c) || (a.row === r2 && a.col === c2))) continue;
    const pair = [{ row: r, col: c }, { row: r2, col: c2 }];
    if (!accept(pair)) continue;
    return pair;
  }
  return [];
}

/* Black Holes may never sit in either side's back two rows (rows 0-1 and
   rows-2..rows-1). A row is allowed iff it's outside both bands — and since
   the mirror of an allowed row is also allowed, checking one cell suffices. */
export function blackHoleRowAllowed(r, rows) {
  return r >= 2 && r <= rows - 3;
}

export function pickBlackHoleSquares(pieces, rows, cols, avoid = [], attempts = 200) {
  return pickPairedSquares(pieces, rows, cols, avoid, attempts, blackHoleRowAllowed);
}

/* Is every square that ISN'T missing still reachable from every other
   (orthogonal steps, pieces ignored since they move)? Missing Squares may
   never wall off part of the board — every random pick and every hand
   pick in the sphere's picker is checked against this. */
export function missingSquaresKeepPath(missing, rows, cols) {
  const gone = new Set(missing.filter((m) => m.row >= 0 && m.row < rows && m.col >= 0 && m.col < cols).map((m) => m.row * cols + m.col));
  const open = rows * cols - gone.size;
  if (open <= 0) return false;
  let start = 0;
  while (gone.has(start)) start++;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.pop();
    const r = Math.floor(i / cols), c = i % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const j = nr * cols + nc;
      if (gone.has(j) || seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen.size === open;
}

/* Missing Squares' own placement — same rotational-pairing/random-
   fallback shape as pickBlackHoleSquares, kept as its own exported name
   (rather than callers reaching for pickPairedSquares directly) so a
   theme importing this reads "Missing Squares' placement function," not
   an internal implementation detail shared with a different feature.
   `existing` = missing squares already placed this game (up to five
   pairs are allowed): the new pair never lands on one, and never
   combines with them to wall off part of the board. */
export function pickMissingSquares(pieces, rows, cols, avoid = [], attempts = 200, existing = []) {
  return pickPairedSquares(
    pieces, rows, cols, avoid.concat(existing), attempts, () => true,
    (pair) => missingSquaresKeepPath(existing.concat(pair), rows, cols)
  );
}

/* Up to `count` pairs in total: `existing` (already-placed missing
   squares, kept as-is) plus fresh random pairs until the count is met or
   no legal spot remains. Returns every square, existing first. */
export function pickMissingSquarePairs(pieces, rows, cols, count, avoid = [], existing = []) {
  const out = existing.slice();
  while (out.length < count * 2) {
    const pair = pickMissingSquares(pieces, rows, cols, avoid, 200, out);
    if (!pair.length) break;
    out.push(...pair);
  }
  return out;
}

/* Shoving LAW. `mover` moving to `landing` runs into `hits` (the pieces
   sharing a cube with the landing). It may push instead of being blocked
   when:
   - exactly one piece is in the way (no pushing a line of pieces), and
   - the mover has more cubes than it (engine/shapes.js cubeCount).
   The pushed piece slides `distance` squares in the move's direction:
   1, or with the "as far as it travels" setting (ACTIVE_LAWS.shoveFar)
   the `travel` the caller passes — how far the mover's leading edge
   advances. Every square along the way must be on the board and not a
   Missing Square, and must not hit another piece. It must end clear of
   the mover's landing.
   Only a Turrito or a Cabeza can be pushed into a Black Hole: it drops
   in and comes out one square past the paired hole, the same exit a
   wormhole move uses. Anything else reaching a hole is blocked.
   Returns { id, row, col, teleports } for the pushed piece, or null.
   Being pushed onto the far row never wins — only a Cabeza's own move
   does. */
function tryShove(pieces, mover, landing, hits, [dr, dc], travel) {
  if (hits.length !== 1) return null;
  const q = hits[0];
  if (cubeCount(mover) <= cubeCount(q)) return null;
  const distance = ACTIVE_LAWS.shoveFar ? Math.max(1, travel) : 1;
  const others = pieces.filter((p) => p.id !== q.id && p.id !== mover.id);
  let pos = q;
  for (let k = 1; k <= distance; k++) {
    pos = { ...q, row: q.row + dr * k, col: q.col + dc * k };
    if (!inBounds(pos) || overlapsMissingSquare(pos)) return null;
    const bh = blackHoleVerdict(pos);
    if (bh.blocked) return null;
    if (bh.teleportTo) {
      if (q.type !== "turrito" && q.type !== "cabeza") return null;
      const eject = { ...q, row: bh.teleportTo.row - dr, col: bh.teleportTo.col - dc };
      if (!inBounds(eject) || overlapsMissingSquare(eject)) return null;
      if (others.some((p) => piecesClash(eject, p)) || piecesClash(eject, landing)) return null;
      return { id: q.id, row: eject.row, col: eject.col, teleports: true };
    }
    if (others.some((p) => piecesClash(pos, p))) return null;
  }
  if (piecesClash(pos, landing)) return null;
  return { id: q.id, row: pos.row, col: pos.col, teleports: false };
}

/* A roll that runs into a smaller piece, under the Shoving LAW's "rolls
   shove too" setting. The landing must be fine apart from that one
   piece: on the board, not on a Missing Square or a Black Hole mouth
   (no pushing and falling in at once). A lone enemy Cabeza isn't here —
   a roll onto one is a crush (evaluateBlockLanding), as always. */
function rollShove(pieces, piece, candidate, dir, sweep) {
  if (!inBounds(candidate) || overlapsMissingSquare(candidate)) return null;
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked || bh.teleportTo) return null;
  const hits = pieces.filter((p) => p.id !== piece.id && piecesClash(candidate, p));
  if (!hits.length) return null;
  const [dr, dc] = STEP_DIRS[dir];
  // How far the leading edge advances — the "as far as it travels" push.
  const travel =
    dir === "E" ? candidate.col + candidate.w - (piece.col + piece.w)
    : dir === "W" ? piece.col - candidate.col
    : dir === "S" ? candidate.row + candidate.h - (piece.row + piece.h)
    : piece.row - candidate.row;
  const shoves = tryShove(pieces, piece, candidate, hits, [dr, dc], travel);
  if (!shoves) return null;
  if (sweep && rollSweepClashes(pieces, piece, dir, hits[0])) return null;
  return { candidate, crushes: null, shoves };
}

export function legalRolls(pieces, piece) {
  const out = {};
  // With an odd-shaped piece anywhere on the board, a roll must also not
  // sweep a cube through another piece on its way over (engine/shapes.js,
  // rollSweepClashes). A board of boxes never needs this check.
  const sweep = anyOddShape(pieces);
  for (const dir of ROLL_DIRS) {
    const candidate = rollBlock(piece, dir);
    const verdict = evaluateBlockLanding(pieces, candidate, STEP_DIRS[dir]);
    if (verdict.legal && sweep && rollSweepClashes(pieces, piece, dir, verdict.crushes)) continue;
    if (!verdict.legal && ACTIVE_LAWS.shoving && ACTIVE_LAWS.shoveOnRolls) {
      const shoveMove = rollShove(pieces, piece, candidate, dir, sweep);
      if (shoveMove) out[dir] = shoveMove;
      continue;
    }
    if (verdict.legal) {
      // A wormhole roll ejects the piece one cell past the far hole (see
      // evaluateBlockLanding) — it never sits on either hole. teleportsTo
      // is the ejection square, and only ever set when the law is on.
      out[dir] = verdict.teleportsTo
        ? { candidate: { ...candidate, row: verdict.teleportsTo.row, col: verdict.teleportsTo.col }, crushes: verdict.crushes, teleports: true }
        : { candidate, crushes: verdict.crushes };
    }
  }
  return out;
}

/* Shared by Cabeza's own always-on step and the Slide LAW's general
   version below: a pure one-cell translate. Off a Black Hole Squares
   mouth this never crushes, landing only on a fully empty footprint —
   but SINGULARITY_DESIGN.md is explicit that a wormhole entry is
   "evaluated under the exact same landing-legality check every other
   move already uses," crush included, so that one case defers entirely
   to evaluateBlockLanding rather than a third reimplementation of it.
   cellsOf generalizes the emptiness check across any w x h, not just
   the single cell a 1x1 Cabeza needs; for a 1x1 candidate the two are
   the same check. */
function translatedCandidate(pieces, piece, dr, dc, allowShove = false) {
  const candidate = { ...piece, row: piece.row + dr, col: piece.col + dc };
  if (!inBounds(candidate)) return null;
  if (overlapsMissingSquare(candidate)) return null;
  const bh = blackHoleVerdict(candidate);
  if (bh.blocked) return null;
  if (bh.teleportTo) {
    const verdict = evaluateBlockLanding(pieces, candidate, [dr, dc]);
    if (!verdict.legal) return null;
    return {
      candidate: { ...candidate, row: verdict.teleportsTo.row, col: verdict.teleportsTo.col },
      crushes: verdict.crushes,
      teleports: true,
    };
  }
  const hits = pieces.filter((p) => p.id !== piece.id && piecesClash(candidate, p));
  if (hits.length === 0) return { candidate, crushes: null, teleports: false };
  // Shoving LAW: moving into a smaller piece pushes it along instead.
  if (allowShove) {
    const shoves = tryShove(pieces, piece, candidate, hits, [dr, dc], 1);
    if (shoves) return { candidate, crushes: null, teleports: false, shoves };
  }
  return null;
}

export function legalCabezaSteps(pieces, piece) {
  const out = {};
  for (const [dir, [dr, dc]] of Object.entries(STEP_DIRS)) {
    const move = translatedCandidate(pieces, piece, dr, dc);
    if (move) {
      out[dir] = move.teleports
        ? { candidate: move.candidate, crushes: move.crushes, teleports: true }
        : { candidate: move.candidate, crushes: null };
    }
  }
  return out;
}

/* The Slide LAW (SINGULARITY_DESIGN.md): "move one open adjacent
   square without rolling/reorienting, as a full turn action" —
   available to every piece, old and new, once enabled, not just
   Cabeza. Same translate primitive as legalCabezaSteps (crush only via
   a wormhole entry), generalized over any footprint. Left as its own
   function rather than folded unconditionally into legalMovesFor:
   Cabeza already has this exact movement as its unconditional baseline
   and must not gain a redundant, identically-keyed duplicate of it.

   Orthogonal only by default (N/E/S/W) — diagonal sliding is its own
   separate law (ACTIVE_LAWS.diagonalSlide), so a plain Slide game never
   offers a diagonal. Cabeza's own baseline stepping (legalCabezaSteps)
   is unchanged and still 8-directional; this divergence is intentional. */
export function legalSlideSteps(pieces, piece) {
  const out = {};
  const dirs = ACTIVE_LAWS.diagonalSlide ? Object.keys(STEP_DIRS) : ROLL_DIRS;
  for (const dir of dirs) {
    const [dr, dc] = STEP_DIRS[dir];
    const move = translatedCandidate(pieces, piece, dr, dc, !!ACTIVE_LAWS.shoving);
    if (move) {
      out[dir] = move.teleports
        ? { candidate: move.candidate, crushes: move.crushes, isSlide: true, teleports: true }
        : move.shoves
          ? { candidate: move.candidate, crushes: null, isSlide: true, shoves: move.shoves }
          : { candidate: move.candidate, crushes: null, isSlide: true };
    }
  }
  return out;
}

/* `remaining` is the piece's action-point budget left THIS TURN (default
   Infinity = a fresh piece / caller that doesn't track it). Costs gate
   what's offered: a Slide costs SLIDE_COST (2) for any piece, and EVERY
   Opa move (roll or slide) costs OPA_MOVE_COST (2) — so with only one
   point left, no slide is available, and an Opa (whose cheapest move is
   already two points) has NO legal move at all. That last part is what
   keeps an Opa to a single move per turn: after its first move spends two
   of the budget, it can never afford a second. */
/* Cantilever Pivot LAW (SINGULARITY_DESIGN.md): a piece standing on a
   single cube with the rest of it held out over the board — a Codo
   balanced on one cube — turns a quarter turn about that cube for one
   point ("pivot-cw" / "pivot-ccw"; a half turn is two quarter turns in
   the same direction, so the player picks which way it goes round).
   The new pose must be on the board and clear of every other piece's
   cubes, and the swinging arm mustn't pass through one on the way
   (pivotSweepClashes). The arm is held up in the air, so it never
   crushes: a Cabeza it swings over is sheltered, like any overhang. */
export function legalPivots(pieces, piece) {
  const out = {};
  if (!ACTIVE_LAWS.cantileverPivot || !pivotCellOf(piece)) return out;
  for (const turn of ["cw", "ccw"]) {
    const candidate = pivotPiece(piece, turn);
    if (!inBounds(candidate)) continue;
    if (pieces.some((p) => p.id !== piece.id && piecesClash(candidate, p))) continue;
    if (pivotSweepClashes(pieces, piece, turn)) continue;
    out[PIVOT_KEYS[turn]] = { candidate, crushes: null, isPivot: true };
  }
  return out;
}

export function legalMovesFor(pieces, piece, remaining = Infinity) {
  if (piece.type === "cabeza") return legalCabezaSteps(pieces, piece);
  // An Opa's cheapest move is two points; with fewer left it can't move.
  if (piece.type === "opa" && remaining < OPA_MOVE_COST) return {};
  const rolls = { ...legalRolls(pieces, piece), ...legalPivots(pieces, piece) };
  if (!ACTIVE_LAWS.slide || remaining < SLIDE_COST) return withinBudget(rolls, remaining);
  // Prefixed keys (see slideKey/constants.js): a block piece's roll and
  // slide can legally coexist in the same cardinal direction (e.g. "E"
  // rolls it a full square-and-a-bit away while "slide-E" just nudges
  // it one cell), so the two dicts are merged rather than either
  // overwriting the other.
  const out = { ...rolls };
  for (const [dir, move] of Object.entries(legalSlideSteps(pieces, piece))) out[slideKey(dir)] = move;
  return withinBudget(out, remaining);
}

// Drops any move costing more than the points left — only ever bites
// on a shove (Shoving LAW's +1) now that every other cost is already
// gated above.
function withinBudget(moves, remaining) {
  if (!ACTIVE_LAWS.shoving || remaining === Infinity) return moves;
  const out = {};
  for (const [dir, move] of Object.entries(moves)) if (moveCost(move) <= remaining) out[dir] = move;
  return out;
}

/* Whether `player`'s turn stays open after `currentPieceState` just moved,
   spending `used` of the turn's `budget`-point bank. This is the single
   rule the live game and the AI's own turn shape both defer to for "is
   there another move to make."

   Without Split Movement (`split` false) a turn is one piece: it continues
   only while that piece still has a legal move and the bank isn't spent —
   exactly the original per-piece rule. With Split Movement it ALSO stays
   open when a point remains, fewer than MAX_PIECES_PER_TURN DISTINCT pieces
   have moved, and some OTHER eligible piece can still move — that's the
   leftover point a different piece may spend (an Opa rolls for two, then
   another piece rolls for the third). `movedPieceIds` is the distinct
   pieces already moved this turn, currentPieceState included. A wormhole
   teleport is turn-ending and handled by the caller, so it never reaches
   here. */
export function turnContinues(pieces, player, movedPieceIds, currentPieceState, used, budget, split) {
  if (used >= budget) return false;
  const remaining = budget - used;
  const currentCanContinue =
    Object.keys(legalMovesFor(pieces, currentPieceState, remaining)).length > 0;
  if (!split) return currentCanContinue;
  if (currentCanContinue) return true;
  if (movedPieceIds.length >= MAX_PIECES_PER_TURN) return false;
  return pieces.some(
    (q) =>
      q.owner === player &&
      !movedPieceIds.includes(q.id) &&
      Object.keys(legalMovesFor(pieces, q, remaining)).length > 0
  );
}

/* One row per full round, in play order: whoever opened the game (the
   first entry's player) fills a row's first move, the other side its
   second. Rows still carry `dark` / `light`, plus `opener`, so a table
   can put the opener's column first. A game Light opens used to show a
   "—" in Dark's column on row 1, which read as a skipped turn. */
export function pairLog(entries) {
  const opener = entries.length ? entries[0].player : "dark";
  const rows = [];
  let current = null;
  for (const entry of entries) {
    if (entry.player === opener || !current) {
      if (current) rows.push(current);
      current = { n: rows.length + 1, opener, dark: null, light: null };
      current[entry.player] = entry;
    } else {
      current[entry.player] = entry;
      rows.push(current);
      current = null;
    }
  }
  if (current) rows.push(current);
  return rows;
}

/* Same "not a move" check the game engine enforces in settleTurn — kept
   at module scope so both places read one definition, not two that
   could quietly drift apart. */
export function sameState(a, b) {
  return a.row === b.row && a.col === b.col && a.w === b.w && a.h === b.h && a.z === b.z && (a.vox || "") === (b.vox || "");
}
