/* Shared bits for the solving and measuring scripts (tools/solve): the
   engine loaded from the repository, set-outs, turn keys and applying
   a generated turn. */
const R = new URL("../../", import.meta.url).pathname;
export const C = await import(R + "engine/constants.js");
export const rules = await import(R + "engine/rules.js");
export const ai = await import(R + "engine/ai.js");
export const anomaly = await import(R + "engine/anomaly.js");

export const TEN_A = ["cabeza", "turrito", "flaco", "chato", "opa", "block1x3", "block2x3", "codo", "rayo", "zeta"].map((type) => ({ type, count: 1 }));
export const ALL_LAWS = { splitMovement: true, splitThree: true, slide: true, diagonalSlide: true, blackHoleSquares: true, cantileverPivot: true, threeActions: true, shoving: true, shoveOnRolls: true, shoveOwn: true, shoveChain: false };
export const NO_LAWS = { splitMovement: false, splitThree: false, slide: false, diagonalSlide: false, blackHoleSquares: false, cantileverPivot: false, threeActions: false, shoving: false, shoveOnRolls: true, shoveOwn: true, shoveChain: false };

export function setup(variant, board, extraLaws = {}) {
  C.setBoardDimensions(board, board);
  C.setBlackHoles([]); C.setMissingSquares([]);
  C.setOpeningTurn(-1);
  if (variant === "classic") { C.setActiveLaws({ ...NO_LAWS, punto: false, ...extraLaws }); return rules.createInitialPieces().map((p) => ({ ...p })); }
  C.setActiveLaws({ ...ALL_LAWS, punto: false, ...extraLaws });
  const pieces = anomaly.generateAnomalySetup(TEN_A).map((p) => ({ ...p }));
  C.setBlackHoles(rules.pickBlackHoleSquares(pieces, C.BOARD_ROWS, C.BOARD_COLS, []));
  return pieces;
}

export function endKey(pieces, turn) {
  const pos = new Map(pieces.map((p) => [p.id, { row: p.row, col: p.col, w: p.w, h: p.h, z: p.z, vox: p.vox || "" }]));
  const removed = new Set();
  const steps = turn.steps ? turn.steps.map((s) => ({ id: s.piece.id, move: s.move })) : turn.moves.map((m) => ({ id: turn.piece.id, move: m }));
  for (const { id, move } of steps) {
    const c = move.candidate; pos.set(id, { row: c.row, col: c.col, w: c.w, h: c.h, z: c.z, vox: c.vox || "" });
    if (move.crushes) removed.add(move.crushes.id);
    if (move.shoves) for (const sh of move.shoves) { const q = pos.get(sh.id); if (q) pos.set(sh.id, { ...q, row: sh.row, col: sh.col }); }
  }
  return [...pos.entries()].filter(([id]) => !removed.has(id)).map(([id, s]) => `${id}:${s.row},${s.col},${s.w},${s.h},${s.z},${s.vox}`).sort().join("|");
}
export function posKey(pieces) { return pieces.map((p) => `${p.id}:${p.row},${p.col},${p.w},${p.h},${p.z},${p.vox || ""}`).sort().join("|"); }

// One turn per distinct end position (the start position itself excluded).
export function distinctTurns(pieces, turns) {
  const start = posKey(pieces), seen = new Map();
  for (const t of turns) { const k = endKey(pieces, t); if (k !== start && !seen.has(k)) seen.set(k, t); }
  return [...seen.values()];
}

// Apply a generated turn to the live array it was generated against. Returns { won }.
export function applyTurn(pieces, turn) {
  const steps = turn.steps ? turn.steps.map((s) => ({ piece: s.piece, move: s.move })) : turn.moves.map((m) => ({ piece: turn.piece, move: m }));
  let won = false;
  for (const { piece, move } of steps) {
    const c = move.candidate;
    Object.assign(piece, { row: c.row, col: c.col, w: c.w, h: c.h, z: c.z, vox: c.vox });
    if (move.crushes) pieces.splice(pieces.indexOf(move.crushes), 1);
    if (move.shoves) for (const sh of move.shoves) { const q = pieces.find((p) => p.id === sh.id); if (q) { q.row = sh.row; q.col = sh.col; } }
    if (piece.type === "cabeza" && c.row === C.GOAL_ROW[piece.owner]) won = true;
  }
  return { won };
}
// The same turn applied to a fresh copy of the position (by ids), for scoring.
export function applyToClone(pieces, turn) {
  const clone = pieces.map((p) => ({ ...p }));
  const byId = new Map(clone.map((p) => [p.id, p]));
  const steps = turn.steps ? turn.steps.map((s) => ({ id: s.piece.id, move: s.move })) : turn.moves.map((m) => ({ id: turn.piece.id, move: m }));
  for (const { id, move } of steps) {
    const c = move.candidate, p = byId.get(id);
    Object.assign(p, { row: c.row, col: c.col, w: c.w, h: c.h, z: c.z, vox: c.vox });
    if (move.crushes) { const i = clone.findIndex((q) => q.id === move.crushes.id); if (i >= 0) clone.splice(i, 1); }
    if (move.shoves) for (const sh of move.shoves) { const q = byId.get(sh.id); if (q) { q.row = sh.row; q.col = sh.col; } }
  }
  return clone;
}
export function findPlanned(turns, plan) {
  const want = plan.steps ? plan.steps.map((s) => s.pieceId + ":" + s.dir).join(",") : plan.pieceId + ":" + plan.dirs.join(">");
  return turns.find((t) => (t.steps ? t.steps.map((s) => s.piece.id + ":" + s.dir).join(",") : t.piece.id + ":" + t.dirs.join(">")) === want);
}
export const other = (p) => (p === "dark" ? "light" : "dark");
