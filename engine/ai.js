/* Minimax AI for El Cabeza. Verified byte-for-byte identical between
   the Standard and Neon theme sources before extraction (see
   build/scratch/) — pure logic, no React, no Three.js, no DOM. */

import { BOARD_ROWS, BOARD_COLS, GOAL_ROW, maxStepsFor, moveCost, ACTIVE_LAWS, turnBudget, maxPiecesPerTurn, MISSING_SQUARES } from "./constants.js";
import { legalMovesFor, legalRolls, legalCabezaSteps, sameState } from "./rules.js";
import { maskAt } from "./shapes.js";

/* Everything below is pure — no React, no Three.js. It only knows the
   game through the same functions a human's clicks already go through
   (legalMovesFor, rollBlock's inverses via sameState). The one thing it
   has that a click doesn't is generateTurns: a human plays one step at
   a time and the UI chains them, but the AI has to evaluate a whole
   turn — 1 step, or 2 — before it can compare options against each
   other, so it needs the complete tree up front. */
export const AI_WIN_SCORE = 1_000_000;

/* How many turns count as "the opening" for AI move-variety purposes —
   see openingJitter in AI_DIFFICULTY and findBestAiTurn. */
export const AI_OPENING_TURNS = 6;

export function opponentOf(player) {
  return player === "dark" ? "light" : "dark";
}

/* Where a piece stands and which way up, as one string: the chassis
   records the AI's pieces with it at the start of each AI turn, so the
   root can tell a piece being put straight back (see backtrackBias). */
export function placeKey(p) {
  return `${p.row},${p.col},${p.w},${p.h},${p.z},${p.vox || ""}`;
}

/* Can any of the opponent's blocks crush `owner`'s Cabeza THIS move,
   from this exact position? Factored out so both evaluatePosition's
   leaf scoring and minimaxSearch's tie-break (see below) share one
   definition rather than two copies that could drift apart. Each block
   is walked through its whole turn (blockTurnReach). */
export function cabezaInDanger(pieces, owner) {
  // MATTER's 2-Cabeza roster option means `owner` can have more than
  // one — true if ANY of them could be crushed this move. A normal
  // one-Cabeza-per-side game always has exactly one entry here, so
  // this behaves identically to the original single-Cabeza check.
  const cabezas = pieces.filter((p) => p.type === "cabeza" && p.owner === owner);
  if (cabezas.length === 0) return true; // none left at all — about as "in danger" as it gets
  const oppPlayer = opponentOf(owner);
  for (const p of pieces.slice()) {
    if (p.owner !== oppPlayer || p.type === "cabeza") continue;
    if (blockTurnReach(pieces, p, maxStepsFor(p.type), cabezas, null, null, true)) return true;
  }
  return false;
}

/* The check alert's question (the chassis, a game against the computer):
   which of the opponent's blocks could crush one of `owner`'s Cabezas on
   their next turn, from this exact position, each walked through its
   whole turn as cabezaInDanger walks them. [{ attacker, cabeza }] by id,
   empty when nothing can. Works on a copy: the walk moves pieces in place
   (and puts them back), and the chassis passes its own live pieces. */
export function cabezaThreats(pieces, owner) {
  const board = pieces.map((p) => ({ ...p }));
  const cabezas = board.filter((p) => p.type === "cabeza" && p.owner === owner);
  const out = [];
  if (!cabezas.length) return out;
  const oppPlayer = opponentOf(owner);
  for (const p of board.slice()) {
    if (p.owner !== oppPlayer || p.type === "cabeza") continue;
    const threatened = new Set();
    blockTurnReach(board, p, maxStepsFor(p.type), cabezas, null, threatened, false);
    threatened.forEach((cabeza) => out.push({ attacker: p.id, cabeza }));
  }
  return out;
}

/* The check alert's Show me (the chassis): the shortest line of moves by
   which `attackerId` crushes `cabezaId` on its coming turn, from this
   position: [{ dir, kind: "roll" | "slide" | "pivot", from, to }] in
   order (`from` and `to` the piece before and after each move), or null.
   Tried one move deep, then two, and so on through its turn's points, the
   way blockTurnReach walks it. On a copy. */
export function crushLine(pieces, attackerId, cabezaId) {
  const board = pieces.map((p) => ({ ...p }));
  const p = board.find((q) => q.id === attackerId);
  if (!p || !board.some((q) => q.id === cabezaId)) return null;
  const kindOf = (m) => (m.isSlide ? "slide" : m.isPivot ? "pivot" : "roll");
  const line = [];
  const walk = (left, depth) => {
    const moves = legalMovesFor(board, p, left);
    for (const dir in moves) {
      const m = moves[dir];
      if (m.crushes && m.crushes.id === cabezaId) { line.push({ dir, kind: kindOf(m), from: { ...p }, to: { ...p, ...m.candidate } }); return true; }
    }
    if (depth <= 1) return false;
    for (const dir in moves) {
      const m = moves[dir];
      if (m.crushes || m.teleports || m.shoves) continue;
      const rest = left - moveCost(m);
      if (rest < 1) continue;
      const from = { ...p };
      const undo = applyMove(board, p, m);
      line.push({ dir, kind: kindOf(m), from, to: { ...p } });
      const found = walk(rest, depth - 1);
      undoMove(board, p, undo);
      if (found) return true;
      line.pop();
    }
    return false;
  };
  const points = maxStepsFor(p.type);
  for (let depth = 1; depth <= points; depth++) if (walk(points, depth)) return line;
  return null;
}

/* The check alert's safe squares (the chassis): every square the Cabeza
   `cabezaId` can get to with `points` (what its side has left of this
   turn for it), each with whether it's out of the opponent's reach there
   (no cabezaThreats with the Cabeza standing on it). [{ row, col, safe }].
   On a copy. */
export function cabezaEscapes(pieces, cabezaId, points) {
  const board = pieces.map((p) => ({ ...p }));
  const cab = board.find((q) => q.id === cabezaId);
  if (!cab || points < 1) return [];
  const start = `${cab.row},${cab.col}`;
  const best = new Map();
  const walk = (left) => {
    const moves = legalMovesFor(board, cab, left);
    for (const dir in moves) {
      const m = moves[dir];
      if (m.crushes || m.teleports || m.isPivot) continue;
      const c = m.candidate, key = `${c.row},${c.col}`, rest = left - moveCost(m);
      if (key === start || (best.has(key) && best.get(key) >= rest)) continue;
      best.set(key, rest);
      if (rest >= 1 && !m.shoves) { const undo = applyMove(board, cab, m); walk(rest); undoMove(board, cab, undo); }
    }
  };
  walk(points);
  return [...best.keys()].map((key) => {
    const [row, col] = key.split(",").map(Number);
    const there = board.map((q) => (q.id === cabezaId ? { ...q, row, col } : q));
    return { row, col, safe: cabezaThreats(there, cab.owner).length === 0 };
  });
}

/* The squares a block's footprint covers on the ground (an odd shape's
   overhang covers none), marked in `marks` (row * BOARD_COLS + col). */
function markGround(marks, cand) {
  for (let r = cand.row; r < cand.row + cand.h; r++) {
    for (let c = cand.col; c < cand.col + cand.w; c++) {
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS && (!cand.vox || (maskAt(cand, r, c) & 1))) marks[r * BOARD_COLS + c] = 1;
    }
  }
}

/* One block's whole turn, as far as the enemy Cabezas in `targets` are
   concerned: which of them it could crush (added to `threatened`) and
   every square a roll of it could come down on (marked in `marks`), the
   squares a Cabeza would be crushed on. It walks every line of moves the
   turn's points pay for (legalMovesFor with the points left: rolls,
   pivots, slides and shoves, each at its own cost), so with "3 Actions"
   three rolls, a slide and a roll, or a pivot and two rolls. A slide or a
   pivot never crushes, but it lines a roll up. Each step is applied in
   place and undone after, the way the search walks its turns.

   It used to stop at two rolls, and a reported Medium game (3 Actions,
   Slides, Split Movement) was lost to exactly what that missed: a
   Turrito's three rolls south onto a Cabeza the AI had just walked
   within their reach.

   Lines that can no longer end on or beside a target are cut: one point
   moves a piece's footprint at most its longest side (a slide costs two
   and moves one square), so a block further from every target than that
   times its points left has nothing more to find. Returns true once it
   has found a crush, stopping there when `stopAtCrush`. */
function blockTurnReach(pieces, p, points, targets, marks, threatened, stopAtCrush) {
  const span = Math.max(p.w, p.h, p.z || 1);
  const slack = marks ? 1 : 0;
  const within = (q, left) => {
    for (const t of targets) {
      const dr = Math.max(0, t.row - (q.row + q.h - 1), q.row - t.row);
      const dc = Math.max(0, t.col - (q.col + q.w - 1), q.col - t.col);
      if (Math.max(dr, dc) <= left * span + slack) return true;
    }
    return false;
  };
  let found = false;
  // Rolls north then east often end where east then north does: each
  // place (and way up) is walked once, with the most points it was
  // reached with. A line isn't followed past a shove, which moves other
  // pieces too (so the board behind it isn't this one).
  const reached = new Map();
  const walk = (left) => {
    const key = `${p.row},${p.col},${p.w},${p.h},${p.z},${p.vox || ""}`;
    const before = reached.get(key);
    if (before !== undefined && before >= left) return;
    reached.set(key, left);
    const moves = legalMovesFor(pieces, p, left);
    for (const dir in moves) {
      const m = moves[dir];
      if (m.crushes) {
        if (targets.includes(m.crushes)) {
          if (threatened) threatened.add(m.crushes.id);
          found = true;
          if (stopAtCrush) return;
        }
        continue;
      }
      if (marks && !m.isSlide && !m.isPivot) markGround(marks, m.candidate);
      const rest = left - moveCost(m);
      if (rest < 1 || m.teleports || m.shoves) continue;
      // Every first roll is followed, as the two-roll check always did: its
      // second-move landings are attacked squares a Cabeza's route prices
      // in, near it or not. Anything else only while it can still reach.
      if (!(marks && left === points && !m.isSlide && !m.isPivot) && !within(m.candidate, rest)) continue;
      const undo = applyMove(pieces, p, m);
      walk(rest);
      undoMove(pieces, p, undo);
      if (found && stopAtCrush) return;
    }
  };
  if (targets.length && within(p, points)) walk(points);
  return found;
}

/* A crush only actually ends the game if it removes the crushed
   side's LAST Cabeza — SINGULARITY_DESIGN.md's 2-Cabeza asymmetry:
   crushing one of two doesn't end it, only crushing the last one does.
   `pieces` here still contains `crushedPiece` itself (called before
   it's spliced out), so this checks whether its owner has any OTHER
   Cabeza besides it. A normal one-Cabeza-per-side game always returns
   true here (there never was another), so this generalizes the
   original always-terminal behavior rather than changing it. */
function crushEndsGame(pieces, crushedPiece) {
  return !pieces.some(
    (p) => p.type === "cabeza" && p.owner === crushedPiece.owner && p.id !== crushedPiece.id
  );
}

/* Mutates `pieces` (an array of MUTABLE piece objects — see the single
   clone findBestAiTurn makes up front) so that `piece` becomes the state
   described by `move`, applying a crush by splicing the crushed piece
   out. Paired with undoMove below to make the whole search a real
   make/unmake walk instead of allocating a fresh 10-element pieces array
   at every node the way this used to (see PERFORMANCE NOTE below
   generateTurns) — the return value is everything undoMove needs to put
   the position back exactly as it was.

   `move.crushes`, when present, is a direct reference into the SAME
   `pieces` array (see evaluateBlockLanding in rules.js, which reads it
   off `pieces.find(...)`), which is what makes `pieces.indexOf` below
   reliable — it's the very object this array already contains, not a
   lookalike copy. */
function applyMove(pieces, piece, move) {
  const prevFields = { row: piece.row, col: piece.col, w: piece.w, h: piece.h, z: piece.z, vox: piece.vox };
  const c = move.candidate;
  piece.row = c.row;
  piece.col = c.col;
  piece.w = c.w;
  piece.h = c.h;
  piece.z = c.z;
  piece.vox = c.vox; // an odd-shaped piece's cubes (engine/shapes.js); undefined for a box
  let removedIndex = -1;
  if (move.crushes) {
    removedIndex = pieces.indexOf(move.crushes);
    pieces.splice(removedIndex, 1);
  }
  // Shoving LAW: every pushed piece moves too (never alongside a crush).
  let shoved = null;
  if (move.shoves) {
    shoved = [];
    for (const sh of move.shoves) {
      const q = pieces.find((p) => p.id === sh.id);
      if (!q) continue;
      shoved.push({ piece: q, row: q.row, col: q.col });
      q.row = sh.row;
      q.col = sh.col;
    }
  }
  return { prevFields, removed: move.crushes || null, removedIndex, shoved };
}

function undoMove(pieces, piece, undo) {
  const p = undo.prevFields;
  piece.row = p.row;
  piece.col = p.col;
  piece.w = p.w;
  piece.h = p.h;
  piece.z = p.z;
  piece.vox = p.vox;
  if (undo.shoved) {
    for (const sh of undo.shoved) { sh.piece.row = sh.row; sh.piece.col = sh.col; }
  }
  if (undo.removed) pieces.splice(undo.removedIndex, 0, undo.removed);
}

// A whole turn (1-3 chained moves) applied/undone as one unit —
// undoTurn reverses in the opposite order applyTurn applied in, same as
// unwinding any other stack. A Split Movement turn (see
// generateSplitTurns) carries `steps`, each naming its own piece; a
// normal turn is one piece and `moves`.
function applyTurn(pieces, turn) {
  const undos = [];
  if (turn.steps) {
    for (const st of turn.steps) undos.push(applyMove(pieces, st.piece, st.move));
  } else {
    for (const move of turn.moves) undos.push(applyMove(pieces, turn.piece, move));
  }
  return undos;
}
function undoTurn(pieces, turn, undos) {
  for (let i = undos.length - 1; i >= 0; i--) {
    undoMove(pieces, turn.steps ? turn.steps[i].piece : turn.piece, undos[i]);
  }
}

/* Every complete legal turn available to `player` from this position:
   one piece, either a single step/roll or two chained together,
   exactly mirroring what the UI itself allows (see PIECE_META.maxSteps
   and the commit logic in the component). Two-step chains that land
   back on the turn's own starting square and orientation are excluded
   here for the same reason the engine voids them live — see sameState
   — so the AI never wastes a search branch, let alone an actual turn,
   considering a move that isn't really a move.

   PERFORMANCE NOTE: this used to build a whole new 10-element
   `resultingPieces` array (and filter a second one for a crush) for
   EVERY candidate turn — up to ~180 per node, at every node of a
   depth-11 search. Every one of those turns is now described instead as
   `{ piece, moves }` — a reference to the real piece object plus the
   `legalMovesFor` move descriptor(s) needed to replay it — and the
   second step's own legal moves are read by applying the first move IN
   PLACE (via applyMove) and undoing it right after, the same
   apply/evaluate/undo pattern minimaxSearch below uses for everything
   else. The only pieces array allocation in the entire search now
   happens once, in findBestAiTurn, before any of this runs. */
export function generateTurns(pieces, player) {
  const turns = [];

  for (const piece of pieces) {
    if (piece.owner !== player) continue;
    const maxSteps = maxStepsFor(piece.type);
    const firstMoves = legalMovesFor(pieces, piece, maxSteps);

    for (const [dir1, move1] of Object.entries(firstMoves)) {
      const wins1 =
        !move1.crushes &&
        piece.type === "cabeza" &&
        move1.candidate.row === GOAL_ROW[piece.owner];
      // A crush only actually ends the game if it's the crushed side's
      // last Cabeza (see crushEndsGame) — with a normal one-Cabeza-per-
      // side game this is always true for any crush, same as before;
      // MATTER's 2-Cabeza option is what makes the distinction matter.
      const endsGame1 = (move1.crushes && crushEndsGame(pieces, move1.crushes)) || wins1;

      // Stopping after this single step is always itself a complete,
      // valid candidate turn — a human can always choose "Stop here"
      // even when a second step would be available, and the AI needs
      // that same option on the table, not just the deepest chain.
      turns.push({
        piece,
        pieceId: piece.id,
        dirs: [dir1],
        moves: [move1],
        crushes: !!move1.crushes,
        wins: wins1,
        endsGame: endsGame1,
      });

      // A crush that DOESN'T end the game is still just a capture — the
      // piece can keep chaining a second step afterward exactly like
      // any other successful roll, so only endsGame1 (not merely
      // move1.crushes) gates a second step here. Steps are gated by the
      // action-point BUDGET, not a step count: a roll spends 1, a slide
      // spends 2 (moveCost), so a further move is possible only while
      // points remain (the cheapest next move, a roll, costs 1). A Black
      // Hole Squares wormhole (move.teleports) is still terminal.
      const spent1 = moveCost(move1);
      if (endsGame1 || move1.teleports || spent1 >= maxSteps) continue;

      const undo1 = applyMove(pieces, piece, move1);
      // Budget-aware: legalMovesFor only offers a slide when >= 2 points
      // remain, so a mid-turn slide with a single point left won't appear.
      const secondMoves = legalMovesFor(pieces, piece, maxSteps - spent1);
      for (const [dir2, move2] of Object.entries(secondMoves)) {
        // net-zero round trip — not a real turn (unless something got shoved on the way)
        if (sameState(undo1.prevFields, move2.candidate) && !move1.shoves && !move2.shoves) continue;

        const wins2 =
          !move2.crushes &&
          piece.type === "cabeza" &&
          move2.candidate.row === GOAL_ROW[piece.owner];
        const endsGame2 = (move2.crushes && crushEndsGame(pieces, move2.crushes)) || wins2;
        turns.push({
          piece,
          pieceId: piece.id,
          dirs: [dir1, dir2],
          moves: [move1, move2],
          crushes: !!move2.crushes,
          wins: wins2,
          endsGame: endsGame2,
        });

        // A third step — only ever reachable when LAWS' "3 Actions Per
        // Turn" is active (maxStepsFor returns 2 for every non-Opa
        // piece otherwise). Same apply/undo/net-zero pattern as the
        // second step, one level deeper; "net-zero" still checks
        // against the turn's own ORIGINAL start (undo1.prevFields),
        // not the after-step-1 position, since a full three-step
        // round trip back to where the turn began is exactly as
        // pointless as a two-step one. Same budget gate as move1 above
        // (a slide spends 2, a roll 1), checked against the running total
        // this time; a wormhole (teleports) stays terminal.
        const spent2 = spent1 + moveCost(move2);
        if (endsGame2 || move2.teleports || spent2 >= maxSteps) continue;

        const undo2 = applyMove(pieces, piece, move2);
        const thirdMoves = legalMovesFor(pieces, piece, maxSteps - spent2);
        for (const [dir3, move3] of Object.entries(thirdMoves)) {
          if (sameState(undo1.prevFields, move3.candidate) && !move1.shoves && !move2.shoves && !move3.shoves) continue; // net-zero round trip

          const wins3 =
            !move3.crushes &&
            piece.type === "cabeza" &&
            move3.candidate.row === GOAL_ROW[piece.owner];
          turns.push({
            piece,
            pieceId: piece.id,
            dirs: [dir1, dir2, dir3],
            moves: [move1, move2, move3],
            crushes: !!move3.crushes,
            wins: wins3,
            endsGame: (move3.crushes && crushEndsGame(pieces, move3.crushes)) || wins3,
          });
        }
        undoMove(pieces, piece, undo2);
      }
      undoMove(pieces, piece, undo1);
    }
  }

  if (ACTIVE_LAWS.splitMovement) generateSplitTurns(pieces, player, turns);
  return turns;
}

/* Split Movement: the turn's point bank (turnBudget — 2, or 3 with "3
   Actions") may be spent across up to MAX_PIECES_PER_TURN distinct pieces,
   exactly as a human may (see turnContinues in rules.js and the chassis's
   mid-turn re-selection). generateTurns above already covers every
   ONE-piece turn; this adds every turn that genuinely moves TWO pieces —
   A then B, and with a 3-point bank A-B-A / A-A-B / A-B-B too. Each step
   may be any own piece that's already moved this turn, or a new one while
   the 2-piece cap isn't reached; any prefix is a complete turn (the human
   can stop at any point), and a game-ending crush/win or a wormhole ends
   the turn at once.

   Pruned, since this multiplies the branching factor:
   - A turn where either piece ends back exactly where it started having
     crushed nothing is dropped — its net effect is a one-piece turn that
     generateTurns already offers.
   - Turns reaching the same end position (A then B vs B then A when they
     don't interact) are kept once, keyed on each moved piece's final
     state plus anything crushed. */
function generateSplitTurns(pieces, player, turns) {
  const budget = turnBudget();
  const seen = new Set();
  const steps = [];
  const starts = new Map(); // piece -> its state before its first step this turn
  const crushedBy = new Map(); // piece -> number of crushes it made this turn

  const record = (last) => {
    const moved = [...starts.keys()];
    if (moved.length < 2) return;
    for (const q of moved) {
      if (sameState(starts.get(q), q) && !crushedBy.get(q) && !steps.some((st) => st.piece === q && st.move.shoves)) return;
    }
    const key = moved
      .map((q) => `${q.id}@${q.row},${q.col},${q.w},${q.h},${q.z},${q.vox || ""}`)
      .sort()
      .join("|") + "|x" + steps.filter((st) => st.move.crushes).map((st) => st.move.crushes.id).sort().join(",") +
      // A shoved piece ends somewhere too — part of the end position.
      "|s" + pieces.filter((p) => steps.some((st) => st.move.shoves && st.move.shoves.some((sh) => sh.id === p.id))).map((p) => `${p.id}@${p.row},${p.col}`).sort().join(",");
    if (seen.has(key)) return;
    seen.add(key);
    turns.push({
      piece: steps[0].piece,
      pieceId: steps[0].piece.id,
      dirs: steps.map((st) => st.dir),
      steps: steps.map((st) => ({ piece: st.piece, pieceId: st.piece.id, dir: st.dir, move: st.move })),
      moves: steps.map((st) => st.move),
      crushes: !!last.move.crushes,
      wins: last.wins,
      endsGame: last.endsGame,
    });
  };

  const walk = (used) => {
    const remaining = budget - used;
    if (remaining <= 0) return;
    const movedCount = starts.size;
    for (const q of pieces.slice()) {
      if (q.owner !== player) continue;
      if (!starts.has(q) && movedCount >= maxPiecesPerTurn()) continue;
      // The first step is always a fresh piece; after that the current
      // piece may continue, a moved one may resume, or a new one may join.
      const moves = legalMovesFor(pieces, q, remaining);
      for (const [dir, move] of Object.entries(moves)) {
        const wins = !move.crushes && q.type === "cabeza" && move.candidate.row === GOAL_ROW[q.owner];
        const endsGame = (move.crushes && crushEndsGame(pieces, move.crushes)) || wins;
        const firstForQ = !starts.has(q);
        const undo = applyMove(pieces, q, move);
        if (firstForQ) starts.set(q, undo.prevFields);
        if (move.crushes) crushedBy.set(q, (crushedBy.get(q) || 0) + 1);
        const step = { piece: q, dir, move, wins, endsGame };
        steps.push(step);

        record(step);
        if (!endsGame && !move.teleports) walk(used + moveCost(move));

        steps.pop();
        if (move.crushes) crushedBy.set(q, crushedBy.get(q) - 1);
        if (firstForQ) starts.delete(q);
        undoMove(pieces, q, undo);
      }
    }
  };
  walk(0);
}

/* Scores a position from `forPlayer`'s point of view — higher is
   better for them. The base terms always apply:
   - each side's route cost: how many steps its lead Cabeza still needs
     to reach its goal row, going around pieces and paying extra for
     squares enemy blocks can land on (cabezaRouteCost);
   - Cabezas on the board (material, decisive with two per side);
   - mobility (legal rolls and Cabeza steps);
   - crush threats, read by whose move it is (see evaluatePosition's
     `toMove`).
   The route term replaced raw "rows advanced", which made walking the
   Cabeza forward the best-scoring move almost regardless of what stood
   in its way — the AI ran its Cabeza into blocks rather than using
   them. Tuned with tests/ai-sim.mjs (AI-vs-AI games).

   `weights` layers optional positional terms on top of the base score.
   Every term under DEFAULT_EVAL_WEIGHTS defaults to 0 — meaning "off,
   evaluates identically to before this existed" — and only becomes
   live when a difficulty's config actually sets it, so a tier that
   doesn't ask for one of these behaves exactly as it did previously. */
export const DEFAULT_EVAL_WEIGHTS = {
  blockAdvance: 0,
  turritoBonus: 0,
  wall: 0,
  centrality: 0,
  cabezaSafety: 0,
  // Not a 0-means-off term: a threat the side to move must answer has
  // always been worth 25 (see evaluatePosition).
  threatBonus: 25,
};

/* Scale of the evaluation's fixed terms (the difficulty-tunable ones
   are DEFAULT_EVAL_WEIGHTS above). */
// Per step of a Cabeza's route to its goal row (see cabezaRouteCost).
const ROUTE_STEP_VALUE = 12;
// A Cabeza as material: only ever decisive with MATTER's two-Cabeza
// roster (losing a side's LAST Cabeza ends the game outright).
const CABEZA_VALUE = 400;
// What a route pays, in extra steps, to cross a square an enemy block can
// land on next move — walking through it invites a crush.
const ATTACKED_STEP_COST = 3;
// A Cabeza that can be crushed by the side about to move: its last one
// is as good as lost; one of two is lost material.
const LAST_CABEZA_HANGING = 20000;
// Mobility: per legal single move available.
const MOBILITY_VALUE = 1.5;

/* How many steps a Cabeza still needs to reach its goal row, walking
   around every piece's ground cubes (it can pass under an overhang) and
   around Missing Squares, with each square the enemy's blocks could land
   on next move counting ATTACKED_STEP_COST extra. On an open board this
   is exactly its rows-to-go (it steps diagonally), which is what the
   evaluation used to measure directly; the difference is a Cabeza facing
   a wall of blocks no longer reads as "nearly home", and a block that
   closes or threatens its route gains real value. A small Dijkstra over
   the board with a bucket queue (every cost is a small integer).
   `blocked`/`attacked` are Uint8Arrays indexed row * BOARD_COLS + col. */
// Reused across calls (this runs at every leaf of every search): the
// distance table plus a ring of ATTACKED_STEP_COST + 2 buckets — every
// edge costs 1 or 1 + ATTACKED_STEP_COST, so no pending entry is ever
// further ahead than that. Resized when the board size changes.
const ROUTE_RING = ATTACKED_STEP_COST + 2;
let routeDist = null;
let routeBuckets = null;
let routeCounts = null;
function cabezaRouteCost(cabeza, goalRow, blocked, attacked) {
  const rows = BOARD_ROWS;
  const cols = BOARD_COLS;
  const n = rows * cols;
  const unreachable = 2 * rows + 4;
  if (!routeDist || routeDist.length !== n) {
    routeDist = new Int16Array(n);
    routeBuckets = Array.from({ length: ROUTE_RING }, () => new Int32Array(n * 8 + 1));
    routeCounts = new Int32Array(ROUTE_RING);
  }
  const dist = routeDist;
  dist.fill(0x7fff);
  routeCounts.fill(0);
  const startIdx = cabeza.row * cols + cabeza.col;
  dist[startIdx] = 0;
  routeBuckets[0][routeCounts[0]++] = startIdx;
  let pending = 1;
  for (let d = 0; pending > 0 && d < unreachable; d++) {
    const slot = d % ROUTE_RING;
    const bucket = routeBuckets[slot];
    // Entries pushed onto this slot while it's being read belong to a
    // later lap of the ring only if cost >= ROUTE_RING, which never
    // happens, so reading up to the live count is safe.
    for (let i = 0; i < routeCounts[slot]; i++) {
      const idx = bucket[i];
      pending--;
      if (dist[idx] !== d) continue;
      const r = (idx / cols) | 0;
      if (r === goalRow) return d;
      const c = idx - r * cols;
      for (let dr = -1; dr <= 1; dr++) {
        const nr = r + dr;
        if (nr < 0 || nr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          if (nc < 0 || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (blocked[ni]) continue;
          const nd = d + 1 + (attacked[ni] ? ATTACKED_STEP_COST : 0);
          if (nd < dist[ni]) {
            dist[ni] = nd;
            const ns = nd % ROUTE_RING;
            routeBuckets[ns][routeCounts[ns]++] = ni;
            pending++;
          }
        }
      }
    }
    routeCounts[slot] = 0;
  }
  return unreachable;
}

// No square attacked: a Cabeza's plain walking distance (see walksHome in
// evaluatePosition). Reused, like the route buffers above.
let openBoardCells = null;
function openBoard(n) {
  if (!openBoardCells || openBoardCells.length !== n) openBoardCells = new Uint8Array(n);
  return openBoardCells;
}

/* `toMove`: whose turn it is in this position (the search always knows).
   It decides what a crush threat means: a Cabeza the side ABOUT TO MOVE
   can crush is as good as gone, while a threat against the side to move
   is only a problem it has to answer. Left out, the opponent of
   `forPlayer` is assumed to move next (the cautious reading). */
export function evaluatePosition(pieces, forPlayer, weights = DEFAULT_EVAL_WEIGHTS, toMove = null) {
  const oppPlayer = opponentOf(forPlayer);
  const mover = toMove || oppPlayer;
  const myCabezas = [];
  const oppCabezas = [];
  for (const p of pieces) {
    if (p.type !== "cabeza") continue;
    if (p.owner === forPlayer) myCabezas.push(p);
    else oppCabezas.push(p);
  }

  // Losing every Cabeza means the last one was crushed on some earlier
  // ply of the search itself (not necessarily the position actually on
  // screen).
  if (myCabezas.length === 0) return -AI_WIN_SCORE;
  if (oppCabezas.length === 0) return AI_WIN_SCORE;

  /* One pass over every piece's legal moves feeds three terms:
     mobility (how many moves each side has), crush threats (which
     Cabezas a block could land on next move), and the squares each
     side's blocks could land on (a Cabeza's route prices them in). */
  const n = BOARD_ROWS * BOARD_COLS;
  const blocked = new Uint8Array(n);
  const attackedBy = { [forPlayer]: new Uint8Array(n), [oppPlayer]: new Uint8Array(n) };
  const threatened = new Set(); // Cabeza ids a block can crush next move
  let myMobility = 0;
  let oppMobility = 0;
  const blocks = []; // every non-Cabeza piece, for the whole-turn pass below
  for (const p of pieces) {
    // Rolls and Cabeza steps only: slides (and the shoves they carry)
    // never crush, and checking them for every piece at every leaf more
    // than doubled a MATTER game's evaluation time. Mobility counts the
    // same kinds of move for both sides, so it stays a fair comparison.
    const moves = p.type === "cabeza" ? legalCabezaSteps(pieces, p) : legalRolls(pieces, p);
    let count = 0;
    for (const dir in moves) {
      count++;
      if (p.type === "cabeza") continue;
      const m = moves[dir];
      if (m.crushes && m.crushes.type === "cabeza") threatened.add(m.crushes.id);
      // A box's every square touches the board; an odd shape's only
      // where it has a ground cube (an overhang crushes nothing).
      markGround(attackedBy[p.owner], m.candidate);
    }
    if (p.type !== "cabeza") blocks.push(p);
    if (p.owner === forPlayer) myMobility += count;
    else oppMobility += count;
    if (p.type === "cabeza") continue; // a Cabeza's route steps around every OTHER piece
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        if (!p.vox || (maskAt(p, r, c) & 1)) blocked[r * BOARD_COLS + c] = 1;
      }
    }
  }
  for (const m of MISSING_SQUARES) blocked[m.row * BOARD_COLS + m.col] = 1;

  /* Threats over the whole turn. A turn is two action points (three with
     "3 Actions"), so the usual crush lines a block up first and brings it
     down onto the Cabeza after: Flaco west, then south onto it, in one
     reported game; a Turrito's three rolls south in another. The pass
     above sees one roll; blockTurnReach walks each block's whole turn,
     slides and pivots included, cutting every line that can't end on or
     beside an enemy Cabeza (so a block far from one costs almost
     nothing). Its roll landings join the attacked squares too, so a
     Cabeza's route and its room to run price them in. */
  const cabezasOf = { [forPlayer]: myCabezas, [oppPlayer]: oppCabezas };
  for (const p of blocks) {
    blockTurnReach(pieces, p, maxStepsFor(p.type), cabezasOf[opponentOf(p.owner)], attackedBy[p.owner], threatened, false);
  }

  // Cabezas block each other too (none may step onto another).
  for (const c of [...myCabezas, ...oppCabezas]) blocked[c.row * BOARD_COLS + c.col] = 1;

  // Each side's Cabeza nearest its goal — the one the race is about.
  const routeOf = (c) => {
    const idx = c.row * BOARD_COLS + c.col;
    blocked[idx] = 0; // its own square isn't an obstacle to itself
    const cost = cabezaRouteCost(c, GOAL_ROW[c.owner], blocked, attackedBy[opponentOf(c.owner)]);
    blocked[idx] = 1;
    return cost;
  };
  let myRoute = Infinity;
  let myCabeza = myCabezas[0];
  for (const c of myCabezas) { const d = routeOf(c); if (d < myRoute) { myRoute = d; myCabeza = c; } }
  let oppRoute = Infinity;
  let oppCabeza = oppCabezas[0];
  for (const c of oppCabezas) { const d = routeOf(c); if (d < oppRoute) { oppRoute = d; oppCabeza = c; } }

  let score = (oppRoute - myRoute) * ROUTE_STEP_VALUE;
  score += (myCabezas.length - oppCabezas.length) * CABEZA_VALUE;
  score += (myMobility - oppMobility) * MOBILITY_VALUE;

  /* Crush threats, read by who moves next. The side to move crushes one
     threatened Cabeza: if that's the other side's last one the game is
     effectively over; otherwise it's a Cabeza of material. A threat
     against the side to move itself costs a little (it must spend its
     turn answering) — unless two of its Cabezas are threatened at once,
     when it can only save one. */
  const myHit = myCabezas.filter((c) => threatened.has(c.id)).length;
  const oppHit = oppCabezas.filter((c) => threatened.has(c.id)).length;
  const hangingValue = (hit, total) => (hit === 0 ? 0 : hit >= total ? LAST_CABEZA_HANGING : CABEZA_VALUE * 0.9);
  /* The side to move also wins outright if a Cabeza of its can walk onto
     its goal row with the turn's points: attacked squares don't matter to
     a Cabeza that ends the game before anything can land on it. With
     Split Movement or 3 Actions every tier often has time to look at only
     its own turn, so the evaluation has to see this reply itself, the way
     it sees a crush — or it leaves the enemy Cabeza a free run home. */
  const steps = maxStepsFor("cabeza");
  /* A threat the side to move has to answer (a Cabeza in reach of a crush
     next turn). Medium and Hard weigh it more than the 25 it always was
     (threatBonus): a threat costs the other side its turn, and at a
     one-turn search it's the only way the AI sees an attack coming. */
  const threat = weights.threatBonus ?? 25;
  const walksHome = (cabezas, route) => route <= steps || cabezas.some((c) => {
    if (Math.abs(GOAL_ROW[c.owner] - c.row) > steps) return false;
    const idx = c.row * BOARD_COLS + c.col;
    blocked[idx] = 0;
    const d = cabezaRouteCost(c, GOAL_ROW[c.owner], blocked, openBoard(n));
    blocked[idx] = 1;
    return d <= steps;
  });
  if (mover === oppPlayer) {
    score -= Math.max(hangingValue(myHit, myCabezas.length), walksHome(oppCabezas, oppRoute) ? LAST_CABEZA_HANGING : 0);
    if (oppHit) score += oppHit >= 2 ? CABEZA_VALUE * 0.8 : threat;
  } else {
    score += Math.max(hangingValue(oppHit, oppCabezas.length), walksHome(myCabezas, myRoute) ? LAST_CABEZA_HANGING : 0);
    if (myHit) score -= myHit >= 2 ? CABEZA_VALUE * 0.8 : threat;
  }

  /* Everything below is off unless a difficulty's config turns it on
     (see AI_DIFFICULTY). Mobility above already rewards "more legal
     moves than the opponent" in general, but it has no opinion on
     WHERE a piece sits or what it's actually accomplishing there —
     these terms are what give block development, infiltration, and
     blocking real positional value beyond raw move-count, so a search
     that weighs them doesn't just default to whichever move happens to
     advance the Cabeza's dominant progress term the most. */

  if (weights.blockAdvance || weights.turritoBonus) {
    // Block development: the same "rows advanced from home" idea the
    // Cabeza's progress term uses, applied to the other four pieces
    // too, so a block still sitting on the back row reads as a worse
    // position than the identical piece several rows forward — not
    // merely neutral, the way it does today. Turrito gets an extra
    // per-square rate on top of the base one: it's the one piece small
    // enough (1x1) to thread through gaps the bigger blocks can't, so
    // pushing it forward aggressively is worth more than the same
    // advance from Opa or Chato, not just as much.
    for (const p of pieces) {
      if (p.type === "cabeza") continue;
      const rowsAdvanced = p.owner === "dark" ? p.row : BOARD_ROWS - 1 - p.row;
      const rate = weights.blockAdvance + (p.type === "turrito" ? weights.turritoBonus : 0);
      score += (p.owner === forPlayer ? 1 : -1) * rowsAdvanced * rate;
    }
  }

  if (weights.wall) {
    // Corridor coverage, not proximity to the enemy Cabeza's CURRENT
    // square. An earlier version of this measured "is one of my
    // pieces near wherever the Cabeza happens to be standing right
    // now" — which rewards a piece for merely having already started
    // near the Cabeza's home square, and gives it no reason to move
    // once the Cabeza heads somewhere else, or worse, no reason to
    // move at all while the Cabeza hasn't committed a direction yet.
    // That's backwards: the danger of an open lane exists BEFORE a
    // Cabeza starts using it, not just once it's already standing in
    // it. This instead finds the WIDEST gap between my own blockers
    // across the full width of the corridor the enemy Cabeza still has
    // to cross (every row between its current one and its own goal
    // row — with no committed column yet, any of them is still fair
    // game). A three-column-wide hole on one edge costs real points
    // the moment it exists, regardless of whether anything has
    // actually walked into it yet.
    const corridorGap = (owner, enemyCabeza, enemyGoalRow) => {
      const inBand = (r) =>
        enemyGoalRow > enemyCabeza.row
          ? r >= enemyCabeza.row && r <= enemyGoalRow
          : r <= enemyCabeza.row && r >= enemyGoalRow;
      const cols = pieces
        .filter((p) => p.owner === owner && p.type !== "cabeza")
        .filter((p) => inBand(p.row + (p.h - 1) / 2))
        .map((p) => p.col + (p.w - 1) / 2)
        .sort((a, b) => a - b);
      const marks = [-1, ...cols, BOARD_COLS];
      let gap = 0;
      for (let i = 1; i < marks.length; i++) gap = Math.max(gap, marks[i] - marks[i - 1] - 1);
      return gap; // 0 = fully covered, up toward BOARD_COLS = wide open
    };
    const myGap = corridorGap(forPlayer, oppCabeza, GOAL_ROW[oppPlayer]);
    const oppGap = corridorGap(oppPlayer, myCabeza, GOAL_ROW[forPlayer]);
    // A gap of MINE is bad for me (subtracts); the SAME gap sitting on
    // the opponent's side is an opportunity for my own Cabeza to run
    // through, so it adds — this is what gives the term both a
    // defensive and an aggressive side, not just a defensive one.
    score += (oppGap - myGap) * weights.wall;
  }

  if (weights.cabezaSafety) {
    /* Room to run. A Cabeza with few squares it could step to that no
       enemy block can land on next turn is being netted, even before any
       block can crush it: a reported game had Medium's Cabeza chased up
       the board by three Dark blocks, each turn's escape step deeper
       into their pieces, until none was left. Counting the squares its
       next step could reach, safe ones only, and charging for each one
       short of three makes walking into that net cost something while
       there's still time to bring a block up or turn back. */
    const safeSteps = (c) => {
      const foes = attackedBy[opponentOf(c.owner)];
      let safe = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const r = c.row + dr, col = c.col + dc;
          if (r < 0 || r >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) continue;
          const i = r * BOARD_COLS + col;
          if (!blocked[i] && !foes[i]) safe++;
        }
      }
      return safe;
    };
    const short = (c) => Math.max(0, 3 - safeSteps(c));
    score -= short(myCabeza) * weights.cabezaSafety;
    score += short(oppCabeza) * weights.cabezaSafety;
  }

  if (weights.centrality) {
    // Zone control: a central piece has more of the board reachable
    // from it than the same piece pinned against an edge or corner —
    // true for a block's roll directions and doubly true for the
    // Cabeza, whose diagonal options get clipped outright near a wall.
    // Separate row/col centres: on a non-square board the middle row and
    // the middle column aren't the same index, and maxDist is the corner
    // distance for THIS board's shape, so "central" stays normalised to
    // [0,1] at any dimensions rather than exceeding 1 along the longer
    // axis (which would quietly inflate this whole term's weight).
    const rowCenter = (BOARD_ROWS - 1) / 2;
    const colCenter = (BOARD_COLS - 1) / 2;
    const maxDist = Math.hypot(rowCenter, colCenter);
    let value = 0;
    for (const p of pieces) {
      const pr = p.row + (p.h - 1) / 2;
      const pc = p.col + (p.w - 1) / 2;
      const central = 1 - Math.hypot(pr - rowCenter, pc - colCenter) / maxDist;
      value += (p.owner === forPlayer ? 1 : -1) * central;
    }
    score += value * weights.centrality;
  }

  return score;
}

/* A move-ordering identity for a turn — stable across positions/nodes
   since it's just (which piece, which direction sequence), which is
   exactly the granularity killer moves and the history table need: "was
   THIS piece's THIS direction choice good," not "was this exact
   resulting board good" (evaluatePosition's job already). */
function moveKey(turn) {
  if (turn.steps) return turn.steps.map((st) => st.pieceId + ":" + st.dir).join(",");
  return turn.piece.id + "|" + turn.dirs.join(",");
}
const EMPTY_KILLERS = [];
const EMPTY_HISTORY = Object.create(null);

function recordKiller(killers, ply, turn) {
  const key = moveKey(turn);
  const slot = killers[ply] || (killers[ply] = [null, null]);
  if (slot[0] === key) return; // already the top killer here — nothing to shift
  slot[1] = slot[0];
  slot[0] = key;
}

function recordHistory(history, turn, depth) {
  const key = moveKey(turn);
  history[key] = (history[key] || 0) + depth * depth;
}

/* Alpha-beta minimax over generateTurns. `player` is whoever moves at
   this node (alternates every ply); `aiPlayer` is fixed for the whole
   search and is who every leaf is scored for — maximizing when it's
   aiPlayer's node, minimizing at the opponent's. `deadline` is a
   performance.now() timestamp, checked before recursing so a search
   that's running long can bail out cleanly rather than run away.

   `rootBias`, when present, nudges which of several genuinely
   comparable turns get chosen right here at THIS decision — it is
   deliberately never forwarded into the recursive call below, so it
   only ever touches the AI's own actual choice, never how any
   hypothetical line further down the tree gets valued. That keeps
   tactics (spotting threats, following a winning line, etc.) exactly
   as sharp as before; it only shapes style at the root. It's also
   never allowed to outweigh survival: a turn that pulls `player`'s own
   Cabeza out of immediate danger is exempt from both bias terms below,
   the same way a genuine crush/win already was — a real game showed a
   two-step Cabeza escape (the only move that actually reached safety)
   losing out to a one-step move that merely LOOKED comparable once
   twoStepBias knocked it down, which is exactly backwards.

   Ties (not just comparable-but-distinct scores) get their own
   resolution too — see the tie-break below the main comparison. Two
   turns scoring EXACTLY the same is normal in a forced loss, where
   every remaining option shares the same terminal value; without an
   explicit tie-break, whichever turn happened to be generated first
   wins by pure iteration-order luck, which is how an already-doomed
   Cabeza could end up ignored in favor of an unrelated piece even
   though moving it changed nothing about the actual outcome.

   `weights` is different: it's genuine position evaluation (see
   evaluatePosition), not a style nudge, so it DOES thread through every
   recursive call below — using a different value system at different
   plies would make minimax's own comparisons incoherent.

   `killers`/`history`/`ply` are move-ordering memory, not game state:
   `killers[ply]` holds up to 2 move keys (see moveKey) that most
   recently caused a beta cutoff AT THIS PLY, in any branch searched so
   far — a move that was devastating in one sibling line is usually
   worth trying early in the next one too. `history` is a flatter,
   longer-memory table of the same idea, scored by depth^2 every time a
   move causes a cutoff anywhere in the tree, so a piece/direction that
   keeps winning early exits keeps floating toward the front of future
   orderings even across different plies. Both are created once per
   findBestAiTurn call (including across its iterative-deepening
   depths) and threaded through every recursive call — `ply` counts UP
   from the root (0) precisely so killers stay ply-indexed rather than
   remaining-depth-indexed, since `depth` counts down instead. */
export function minimaxSearch(pieces, player, aiPlayer, depth, alpha, beta, deadline, rootBias = null, weights = DEFAULT_EVAL_WEIGHTS, killers = EMPTY_KILLERS, history = EMPTY_HISTORY, ply = 0, rootFirst = null) {
  if (performance.now() > deadline) {
    return { score: evaluatePosition(pieces, aiPlayer, weights, player), turn: null, timedOut: true };
  }

  const turns = generateTurns(pieces, player);
  if (turns.length === 0 || depth === 0) {
    return { score: evaluatePosition(pieces, aiPlayer, weights, player), turn: null, timedOut: false };
  }

  const maximizing = player === aiPlayer;

  /* Move ordering: crush/win turns first (unchanged — costs nothing
     extra, since generateTurns already flags these), THEN every
     remaining candidate ranked by a quick static evaluation of its own
     resulting position — the same evaluatePosition used at the leaves,
     just also called once up front to rank candidates before recursing
     into them, rather than only at the bottom of the tree.

     This was genuinely missing before, not just theoretically
     incomplete: crush/win ordering alone gives alpha-beta nothing to
     work with for the vast majority of turns, which is exactly the
     case a corridor-closing move falls into — it isn't a crush, isn't
     a win, so it sat wherever generateTurns happened to produce it,
     un-ranked, alongside every pointless option. Verified with an
     actual benchmark against the real reported game's position (not
     just reasoned about): on that position, at matched time budgets,
     the OLD ordering was still reporting a mild -46.8 at depth 5 after
     255,014 nodes, while THIS ordering had already found a
     near-certain loss for the side ignoring the gap (-1,000,002) at
     that same depth using barely 38,680 nodes — a full ply earlier
     than the old ordering ever found it (depth 6). It also completed
     depth 4 outright inside the same time budget the old ordering
     timed out on. Since iterative deepening discards any depth that
     times out mid-search (see findBestAiTurn) and falls back to
     whatever depth DID finish, that gap compounds: OLD's incomplete
     depth 4 gets thrown away in favor of a depth-3 answer that hasn't
     seen the danger at all, while this ordering's depth 4 completes
     and is used directly.

     The scoring itself uses decorate-sort-undecorate — each candidate
     is evaluated exactly once up front (applying/undoing it in place —
     see applyTurn/undoTurn — rather than reading a precomputed
     snapshot, since none exists anymore), not re-evaluated on every
     pairwise comparison a naive sort comparator would trigger. That
     wasn't a micro-optimization: an earlier version that scored inside
     the comparator itself measured roughly 8x the per-node cost of the
     crush/win-only sort; scoring once up front brought that down to
     roughly 2.6x, which is what let the reduced node count from better
     pruning actually win out in wall-clock time rather than being
     eaten by ordering overhead. */
  const killerSlot = killers[ply];
  /* The first look at the root (depth 1) scores every turn, and in a
     Split Movement or 3 Actions game that's a thousand turns and more: on
     a slow phone, well past the time it was given (user: "move forward
     with all", after the efficiency review found it the longest wait).
     So there the time is checked every 32 turns, and once it's out the
     rest aren't scored: they sort below every scored turn. Game-ending
     turns need no score and always come first, so a win is never
     missed; the others are scored taking each piece's turns in turn, so
     a cut leaves every piece's best looked at rather than some pieces'
     all and others' none. Given the time (any computer, most phones),
     every turn is scored and the result is exactly as before. */
  const capRoot = ply === 0 && depth === 1;
  const scoredTurns = new Array(turns.length);
  let outOfTime = false;
  const scoreAt = (i, unscored) => {
    const t = turns[i];
    const terminal = !!t.endsGame;
    let orderScore = 0;
    if (!terminal) {
      if (unscored) orderScore = maximizing ? -Infinity : Infinity;
      else {
        const undos = applyTurn(pieces, t);
        orderScore = evaluatePosition(pieces, aiPlayer, weights, opponentOf(player));
        undoTurn(pieces, t, undos);
      }
    }
    const key = moveKey(t);
    scoredTurns[i] = {
      turn: t,
      terminal,
      orderScore,
      isFirst: ply === 0 && key === rootFirst,
      isKiller: !!(killerSlot && (killerSlot[0] === key || killerSlot[1] === key)),
      histScore: history[key] || 0,
    };
  };
  if (!capRoot) {
    for (let i = 0; i < turns.length; i++) scoreAt(i, false);
  } else {
    // Each piece's turns in rotation (by the piece that moves first).
    const byPiece = new Map();
    turns.forEach((t, i) => {
      const k = t.steps ? t.steps[0].pieceId : t.pieceId;
      if (!byPiece.has(k)) byPiece.set(k, []);
      byPiece.get(k).push(i);
    });
    const queues = [...byPiece.values()];
    let n = 0;
    for (let round = 0; n < turns.length; round++) {
      for (const q of queues) {
        if (round >= q.length) continue;
        const i = q[round];
        if (!outOfTime && n > 0 && (n & 31) === 0 && performance.now() > deadline) outOfTime = true;
        scoreAt(i, outOfTime && !turns[i].endsGame);
        n++;
      }
    }
  }
  scoredTurns.sort((a, b) => {
    if (a.terminal !== b.terminal) return a.terminal ? -1 : 1;
    if (a.terminal) return 0; // both terminal -- no further ranking needed between them
    // At the root, the last finished depth's choice is searched first (see
    // findBestAiTurn: what an unfinished depth can still be trusted for).
    if (a.isFirst !== b.isFirst) return a.isFirst ? -1 : 1;
    if (a.isKiller !== b.isKiller) return a.isKiller ? -1 : 1;
    if (a.isKiller && b.isKiller) return b.histScore - a.histScore;
    const primary = maximizing ? b.orderScore - a.orderScore : a.orderScore - b.orderScore;
    return primary !== 0 ? primary : b.histScore - a.histScore;
  });
  turns.splice(0, turns.length, ...scoredTurns.map((s) => s.turn));
  /* Beam: below a node that will search deeper, only the `beam` best-
     ordered turns (three times as many at the root) are looked into;
     game-ending turns always are. Without it, Split Movement's ~1000
     turns a side left no time to look past the AI's own move at all —
     every tier played a one-turn search. The ordering score already
     reads crush threats, so a turn that hangs or wins a Cabeza is never
     among the ones cut. 0 = full width. */
  if (weights.beam && depth >= 2) {
    const keep = (ply === 0 ? weights.beam * 3 : weights.beam) + scoredTurns.filter((st) => st.terminal).length;
    if (turns.length > keep) turns.length = keep;
  }
  // The ordering score IS the leaf score one ply down (same position,
  // same side to move), so a depth-1 node reads it straight back instead
  // of recursing — which would generate the opponent's turns only to
  // discard them and evaluate the identical position a second time.
  const leafScore = depth === 1 ? new Map(scoredTurns.map((st) => [st.turn, st.orderScore])) : null;

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestTurn = null;
  // Cached alongside bestTurn: whether ITS resulting position leaves
  // player's own Cabeza safe — computed once, right when bestTurn is
  // set, while the move is still applied (see the tie-break below,
  // which used to recompute this against a snapshot that no longer
  // exists; recomputing it post-hoc against an already-undone turn
  // isn't possible with in-place mutation, so it has to be cached
  // going forward instead).
  // null = not worked out yet: only a tie ever needs it (see below), so
  // it's computed on demand rather than for every candidate.
  let bestTurnSafe = null;
  let timedOut = false;
  // Every root turn and its score, for a one-turn search's reply check
  // (checkOneTurnChoice, from findBestAiTurn).
  const rootScores = ply === 0 && depth === 1 && maximizing && weights.verifyReplies ? [] : null;

  /* Computed once, not per-turn: whether `player`'s own Cabeza is
     ALREADY in immediate danger before any of these candidates are
     even considered. Used below to exempt a turn that actually
     resolves that danger from the style biases — see the rootBias
     block. */
  const dangerBeforeMove = rootBias ? cabezaInDanger(pieces, player) : false;

  // The best root turn whose search finished, for a depth that runs out of
  // time partway (see findBestAiTurn).
  let settledTurn = null;
  let settledScore = -Infinity;
  let firstSettled = false; // rootFirst's own search finished

  for (const turn of turns) {
    let score;
    let finished = true;
    const undos = applyTurn(pieces, turn);
    if (turn.endsGame) {
      // Terminal within this ply. depth is folded in as a small
      // tiebreak — not to decide who wins, only to prefer a faster win
      // and a more-delayed loss among otherwise-equal outcomes. Never
      // biased below — a genuinely decisive turn is never suppressed
      // for the sake of style.
      const sign = player === aiPlayer ? 1 : -1;
      score = sign * (AI_WIN_SCORE + depth);
    } else if (leafScore && !rootBias) {
      score = leafScore.get(turn);
    } else {
      const child = leafScore ? { score: leafScore.get(turn), timedOut: false } : minimaxSearch(
        pieces,
        opponentOf(player),
        aiPlayer,
        depth - 1,
        alpha,
        beta,
        deadline,
        null, // rootBias intentionally NOT passed through — see comment above.
        weights, // weights DOES thread through — evaluation must stay consistent at every ply.
        killers,
        history,
        ply + 1
      );
      score = child.score;
      if (child.timedOut) {
        timedOut = true;
        finished = false;
      }

      if (rootBias) {
        // A turn that actually resolves an existing threat to my own
        // Cabeza is exempt from both biases below — same principle as
        // the crush/win carve-out above (a genuinely necessary move is
        // never suppressed for the sake of style), just extended to
        // cover "stops my Cabeza from being captured" as well as
        // "captures/wins outright". Without this, a two-step escape
        // that's the ONLY move actually reaching safety could still
        // lose to a one-step move that merely LOOKS comparable once
        // twoStepBias knocks it down — style should never outweigh
        // survival.
        const resolvesDanger = dangerBeforeMove && !cabezaInDanger(pieces, player);

        // Prefer a single movement over automatically chaining the
        // second one, unless the second movement is worth enough on its
        // own merits to overcome the nudge.
        if (!resolvesDanger && turn.dirs.length === 2) score -= rootBias.twoStepBias;

        /* The repeat biases apply even to a turn that rescues the Cabeza.
           They used to be waived there, and a reported game showed the
           cost: Dark kept threatening Medium's Cabeza, every Cabeza step
           away counted as a rescue, and it walked alone six turns running
           instead of ever guarding it with a block. Survival still wins
           outright: a Cabeza left hanging scores LAST_CABEZA_HANGING
           (20000), far beyond these (a few hundred at most), so the bias
           only chooses between rescues — and prefers one by a block. */
        {
          // The more turns in a row the AI has already spent walking
          // its own Cabeza, the more it's nudged toward using
          // something else this time — scales with the streak so an
          // isolated Cabeza move costs little, but leaning on it turn
          // after turn costs progressively more.
          if (turn.steps ? turn.steps.some((st) => st.piece.type === "cabeza") : turn.piece.type === "cabeza") {
            score -= rootBias.cabezaRepeatBias * rootBias.cabezaStreak;
          }

          // The same idea for every other piece: one moved turn after
          // turn (reported: a Turrito shuffling for a whole game while
          // the Opa, 1x3 and Arco never moved) costs a little more each
          // consecutive turn, so near-equal alternatives rotate in.
          if (rootBias.pieceRepeatBias && rootBias.pieceStreaks) {
            const moved = turn.steps ? new Set(turn.steps.map((st) => st.piece)) : new Set([turn.piece]);
            for (const q of moved) {
              if (q.type !== "cabeza") score -= rootBias.pieceRepeatBias * (rootBias.pieceStreaks[q.id] || 0);
            }
          }

          /* Putting a piece straight back where it stood at the start of
             one of the AI's last few turns (the turn is still applied
             here, so each moved piece is at its end). A reported Medium
             game shuffled all game: a Rayo slid north and back south on
             the next turn, a Chato south, north and south again, the
             Cabeza south, north, south, while the human's Turrito walked
             in and crushed it. Each piece put back costs backtrackBias:
             more than the small positional differences a shuffle chases,
             nothing beside a crush threat (LAST_CABEZA_HANGING). */
          if (rootBias.backtrackBias && rootBias.recentPlaces) {
            const moved = turn.steps ? new Set(turn.steps.map((st) => st.piece)) : new Set([turn.piece]);
            for (const q of moved) {
              const before = rootBias.recentPlaces[q.id];
              if (before && before.includes(placeKey(q))) score -= rootBias.backtrackBias;
            }
          }
        }

        /* Root-only score noise, the fix for the AI opening with the
           same moves every single game. The search is otherwise
           completely deterministic: identical position in, identical
           move out — and the starting position is identical every
           game, so Medium replayed its opening verbatim forever.

           Sized against the real score scale rather than picked at
           random: one row of block advancement is 0.8, a point of
           mobility is 1.5, so a jitter of ~2 reshuffles moves the
           engine already considers near-equivalent while leaving any
           genuinely better move on top. It CANNOT trade away a real
           threat — a Cabeza in danger is -4000 and a win is 1e6, both
           orders of magnitude beyond anything this can move. That's
           what keeps the variety smart rather than just noisy.

           Skipped entirely at terminal scores, which preserves the
           exact-tie path below: forced-loss positions where every
           option scores the same sentinel value rely on `score ===
           bestScore` still matching, and continuous noise would make
           that comparison essentially never true. */
        if (rootBias.jitter > 0 && Math.abs(score) < AI_WIN_SCORE) {
          score += (Math.random() * 2 - 1) * rootBias.jitter;
        }
      }
    }

    if (rootScores) rootScores.push({ turn, score });
    if (ply === 0 && finished) {
      if (score > settledScore) {
        settledScore = score;
        settledTurn = turn;
      }
      if (rootFirst && moveKey(turn) === rootFirst) firstSettled = true;
    }

    // Only a tie needs to know whether this turn leaves `player`'s own
    // Cabeza safe — worked out while the turn is still applied.
    const tied = score === bestScore && !!bestTurn;
    const turnSafe = tied ? !cabezaInDanger(pieces, player) : null;
    undoTurn(pieces, turn, undos);
    if (tied && bestTurnSafe === null) {
      const bestUndos = applyTurn(pieces, bestTurn);
      bestTurnSafe = !cabezaInDanger(pieces, player);
      undoTurn(pieces, bestTurn, bestUndos);
    }

    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestTurn = turn;
      bestTurnSafe = null;
    } else if (tied) {
      // Tie-break for otherwise-identical outcomes — most commonly a
      // forced loss the search can't avoid or delay any further,
      // where every remaining option scores the exact same terminal
      // value. Without this, the FIRST such turn generated wins by
      // default (strict inequality above never re-triggers on a tie),
      // which is how a Cabeza that's already lost no matter what can
      // still end up ignored in favor of moving some unrelated piece
      // — nothing in the raw score says otherwise once every path
      // leads to the same sentinel value. This prefers whichever tied
      // option doesn't leave `player`'s own Cabeza needlessly sitting
      // in immediate danger. It can't change a truly forced result,
      // but the AI keeps visibly trying rather than abandoning the
      // threatened piece — and a human (or another AI) doesn't always
      // find the correct follow-through even when one exists.
      if (turnSafe && !bestTurnSafe) {
        bestScore = score;
        bestTurn = turn;
        bestTurnSafe = turnSafe;
      }
    }

    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
    if (beta <= alpha) {
      if (!turn.endsGame) {
        recordKiller(killers, ply, turn);
        recordHistory(history, turn, depth);
      }
      break; // prune — the rest of this branch can't change the outcome
    }

    if (timedOut) break;
  }

  return { score: bestScore, turn: bestTurn, timedOut, width: turns.length, rootScores, settledTurn: firstSettled ? settledTurn : null };
}

/* When the search ends one turn deep (Split Movement, 3 Actions: nothing
   deeper fits), its choice is checked against the replies (Medium and
   Hard: `verifyReplies`; Easy keeps its mistakes). At depth 1 the replies
   are only judged by the evaluation, which walks each enemy block's own
   turn (blockTurnReach) but not every Split Movement pairing or shove.
   First a forced crush is looked for (`forcedCrush`, findForcedCrush);
   then the best-scoring turns are checked in order against all the
   opponent's turns (generateTurns, exact) and the first that leaves no
   game-ending reply is played. Usually the first one passes. A search
   that got deeper saw the replies itself and skips this. */
function checkOneTurnChoice(pieces, player, rootScores, deadline, weights) {
  rootScores.sort((a, b) => b.score - a.score);
  if (!rootScores.length || rootScores[0].turn.endsGame) return rootScores[0] || null;
  const forced = weights.forcedCrush ? findForcedCrush(pieces, player, rootScores, deadline) : null;
  if (forced) return { turn: forced.turn, score: forced.score + FORCED_CRUSH_VALUE };
  for (let i = 0; i < rootScores.length && i < 40 && (i < 3 || performance.now() < deadline); i++) {
    const { turn } = rootScores[i];
    if (turn.endsGame) return rootScores[i];
    const undos = applyTurn(pieces, turn);
    const safe = !generateTurns(pieces, opponentOf(player)).some((r) => r.endsGame);
    undoTurn(pieces, turn, undos);
    if (safe) return rootScores[i];
  }
  return rootScores[0];
}

/* A turn that wins by force: after it the opponent's Cabeza is in reach
   of a crush, and every reply they have still leaves it in reach (none
   of them ends the game first). The net a hunting block throws round a
   Cabeza, found at a one-turn search, which otherwise sees a threat only
   as a threat. Checked best-scoring first, at most 30 turns that make a
   threat and within the time left; each reply that moves their Cabeza is
   tried first, since an escape is what ends the check soonest.
   (Every block's own turn only, as in cabezaInDanger: a crush that takes
   two pieces of a Split Movement turn isn't counted on.) */
const FORCED_CRUSH_VALUE = 5000;
function findForcedCrush(pieces, player, rootScores, deadline) {
  const opp = opponentOf(player);
  let tried = 0;
  for (const { turn, score } of rootScores) {
    if (tried >= 30 || performance.now() > deadline) break;
    if (turn.endsGame) continue;
    const undos = applyTurn(pieces, turn);
    let forced = false;
    if (cabezaInDanger(pieces, opp)) {
      tried++;
      const replies = generateTurns(pieces, opp);
      const movesCabeza = (r) => (r.steps ? r.steps.some((st) => st.piece.type === "cabeza") : r.piece.type === "cabeza");
      replies.sort((a, b) => movesCabeza(b) - movesCabeza(a));
      forced = replies.length > 0 && replies.every((r) => {
        if (r.endsGame) return false;
        const u = applyTurn(pieces, r);
        const still = cabezaInDanger(pieces, opp);
        undoTurn(pieces, r, u);
        return still;
      });
    }
    undoTurn(pieces, turn, undos);
    if (forced) return { turn, score };
  }
  return null;
}

/* Iterative deepening: search depth 1, then 2, then 3… until either
   maxDepth or timeBudgetMs runs out. Of a deeper attempt that times out
   mid-search, only the root turns whose searches finished are trusted —
   an alpha-beta search cut off partway through can be badly wrong about
   the branches it never finished looking at — and only when the last
   finished depth's choice was among them (it is searched first; see the
   loop below). This is what keeps a "Hard" search from ever being able
   to freeze the tab: worst case, it just quietly falls back to whatever
   depth it did finish in time.

   `cabezaStreak` is how many of the AI's own most recent consecutive
   turns moved its Cabeza, supplied by the caller (see aiCabezaStreakRef
   in the component) — it's real game history, not something derivable
   from `pieces` alone, so it has to be threaded in rather than computed
   here. Turned into a rootBias only when the difficulty tier actually
   sets nonzero bias knobs, so Easy/Medium build `null` and run exactly
   as before.

   blockAdvance/turritoBonus/wall/centrality are the positional-weight
   knobs read by evaluatePosition (see DEFAULT_EVAL_WEIGHTS) — built
   into a `weights` object every time regardless of difficulty, since
   evaluatePosition already treats all-zero as "off"; a tier that
   doesn't set any of them just gets the same all-zero object Easy and
   Medium always have. */
/* Yields a turn of the event loop back to the browser (or Node) between
   completed search depths — see the loop below. setTimeout(fn, 0) over
   requestAnimationFrame: this file also runs unmodified under Node in
   the engine smoke test, where rAF doesn't exist, and a real frame
   isn't the point anyway — just a chance for the render loop's own
   rAF callback (camera easing, ambient FX ticks) to run before the
   next, potentially much longer, depth begins. */
function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* async per feedback that a Hard-difficulty search — synchronous,
   fully blocking the main thread for up to timeBudgetMs (4.3s at the
   top tier) — read as "the board freezes" right as the AI starts
   thinking: nothing else on the page (camera easing, ambient FX, even
   the tail of the piece that had just landed) can run at all while
   this function has the thread. Awaiting a yield between each
   COMPLETED depth (not mid-depth — minimaxSearch's own recursion isn't
   interruptible) lets that other work interleave for every depth but
   the last, which is what actually consumes most of a deep search's
   time budget; a single very deep final attempt can still occupy the
   thread for a stretch, since splitting minimaxSearch itself into
   interruptible chunks would be a considerably larger change. Callers
   now await this. */
/* The deepest search depth the last findBestAiTurn call fully completed,
   and whether the depth after it, unfinished, changed the choice — for
   tests and the AI simulator (tests/ai-sim.mjs). */
export const lastSearchInfo = { depth: 0, depthMs: [], partial: false };


export async function findBestAiTurn(
  pieces,
  aiPlayer,
  {
    maxDepth,
    timeBudgetMs,
    twoStepBias = 0,
    cabezaRepeatBias = 0,
    blockAdvance = 0,
    turritoBonus = 0,
    pieceRepeatBias = 0,
    wall = 0,
    centrality = 0,
    cabezaSafety = 0,
    beam = 0,
    earlyStop = true,
    jitter = 0,
    openingJitter = 0,
    backtrackBias = 0,
    verifyReplies = false,
    forcedCrush = false,
    threatBonus = 25,
  },
  cabezaStreak = 0,
  turnIndex = 0,
  pieceStreaks = null,
  recentPlaces = null
) {
  const deadline = performance.now() + timeBudgetMs;
  /* Openings get extra noise on top of the baseline. The opening is
     where determinism was most glaring — every other position has
     already diverged by whatever the human did, but turn one is
     identical in every single game, so that's exactly where the same
     jitter buys the most variety. It decays to the baseline once the
     game has its own shape. */
  const effectiveJitter = jitter + (turnIndex < AI_OPENING_TURNS ? openingJitter : 0);
  /* Putting a piece back only costs in the games where the AI searches
     one turn (Split Movement, 3 Actions), where the reported shuffling
     happened. In the classic game, searching several turns ahead, a step
     back is often right: measured over 24 classic games each, Medium with
     the penalty lost to the previous Medium 9-13, without it won 15-9. */
  const fastGame = ACTIVE_LAWS.splitMovement || ACTIVE_LAWS.threeActions;
  backtrackBias = fastGame ? backtrackBias : 0;
  const rootBias =
    twoStepBias || cabezaRepeatBias || pieceRepeatBias || effectiveJitter || (backtrackBias && recentPlaces)
      ? { twoStepBias, cabezaRepeatBias, cabezaStreak, pieceRepeatBias, pieceStreaks, jitter: effectiveJitter, backtrackBias, recentPlaces }
      : null;
  // `beam` rides along with the evaluation weights since both thread
  // through every ply of the search (see minimaxSearch).
  const weights = { blockAdvance, turritoBonus, wall, centrality, cabezaSafety, beam, verifyReplies, forcedCrush, threatBonus };
  /* The ONLY pieces-array allocation in the whole search: everything
     below (generateTurns, minimaxSearch, their move-ordering pass) now
     mutates this one cloned array/objects in place via applyMove/
     undoMove rather than building a fresh array at every node — see
     generateTurns' own PERFORMANCE NOTE. The caller's `pieces` (live
     React state) is never touched. */
  const working = pieces.map((p) => ({ ...p }));
  // Move-ordering memory, persisted across every iterative-deepening
  // depth below — see minimaxSearch's own comment on killers/history.
  const killers = [];
  const history = Object.create(null);
  let best = null;
  let oneTurn = null; // depth 1's scored root turns, for checkOneTurnChoice

  lastSearchInfo.depth = 0;
  lastSearchInfo.depthMs = [];
  lastSearchInfo.partial = false;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() > deadline) break;
    if (depth > 1) await yieldToEventLoop(); // let a frame render between depths — see the function comment above
    const depthStart = performance.now();
    const result = minimaxSearch(working, aiPlayer, aiPlayer, depth, -Infinity, Infinity, deadline, rootBias, weights, killers, history, 0, best && moveKey(best));
    /* A depth that runs out of time is not all lost. It searches the last
       depth's choice first, to the end, so every other root turn whose
       search also finished and scored higher is a better choice at this
       depth too (the root keeps a turn only for beating the best so far).
       The turn the time ran out on, and every one after it, are left out.
       This is what let the time budgets below be cut (user: "AI is spending
       too much time thinking on turn") while keeping most of the strength:
       about half of every think used to go on a depth thrown away. */
    if (result.timedOut && depth > 1) {
      if (result.settledTurn) {
        lastSearchInfo.partial = !best || moveKey(result.settledTurn) !== moveKey(best);
        best = result.settledTurn;
      }
      break;
    }
    if (result.turn) best = result.turn;
    if (depth === 1) oneTurn = result.rootScores;
    lastSearchInfo.depth = depth;
    if (Math.abs(result.score) >= AI_WIN_SCORE) break; // forced win/loss found — deeper search can't change that
    /* Stop early when the next depth can't finish: an unfinished depth is
       thrown away (above), so searching it only burns the processor while
       the 3D scene competes with this thread for the same cores. A deeper
       search always takes at least as long as the one before it, so once
       the depth just finished took longer than the time left, the next
       one cannot complete — stopping then changes nothing about the move.
       (Predicting further ahead isn't safe: measured over 100+ real
       searches, the next depth took anywhere from 1.1x to 25x the last.)
       Timings wobble a little from run to run, so it waits for the last
       depth to have taken 25% MORE than the time left before stopping.
       Measured saving with no depth ever lost: 4-13% of each think.
       From depth 1 to 2 there's a firmer bound: depth 2 orders the reply
       to every root turn it keeps (the beam's, or all of them), and
       ordering a reply costs about what all of depth 1 did when both sides
       have about as many turns. Taken at a third of that, to allow for a
       side with fewer turns. In a Split Movement or 3 Actions game, with
       hundreds of turns a side, depth 2 would take ten times the budget:
       it used to run to the deadline and be thrown away. */
    const depthMs = performance.now() - depthStart;
    lastSearchInfo.depthMs.push(depthMs);
    const left = deadline - performance.now();
    if (earlyStop && depth > 1 && depthMs > 1.25 * left) break;
    if (earlyStop && depth === 1 && result.width) {
      const kept = beam ? Math.min(result.width, beam * 3) : result.width;
      if (0.35 * kept * depthMs > left) break;
    }
  }

  if (lastSearchInfo.depth === 1 && oneTurn) {
    const checked = checkOneTurnChoice(working, aiPlayer, oneTurn, deadline, weights);
    if (checked) best = checked.turn;
  }

  // Only pieceId/dirs are ever actually a caller's contract (see
  // beginMoveRef.current(piece, turn.dirs[0]) in the chassis, which
  // looks the piece up fresh from LIVE state by id) — stripping the
  // rest here means nothing downstream can accidentally reach into
  // `working`, which is garbage the instant this function returns.
  // A Split Movement turn also lists its steps piece by piece, so the
  // chassis can hand each step to the right piece.
  if (!best) return null;
  const out = { pieceId: best.pieceId, dirs: best.dirs };
  if (best.steps) out.steps = best.steps.map((st) => ({ pieceId: st.pieceId, dir: st.dir }));
  return out;
}

/* Each tier raised roughly a step or two from the original pass, on
   both maxDepth AND timeBudgetMs together — bumping maxDepth alone
   would have done nothing, since the actual branching factor here is
   around 180 turns per position, which makes depth 3 already several
   million positions before pruning. The move-ordering step above helps
   real depth get reached inside these budgets, but these numbers are
   still ceilings the search reaches for, not guarantees — see
   findBestAiTurn: whatever a difficulty doesn't finish in time, it
   quietly falls back to the last depth that did complete.

   maxDepth/timeBudgetMs raised again here, per an explicit request to
   increase look-ahead across all three tiers, more so at higher tiers,
   specifically to get more of the full piece complement into play
   (deeper search is what lets the AI see a block's payoff far enough
   ahead to look worth choosing over the Cabeza — see the reasoning
   below on why depth alone, even before this round, already mattered
   for that). Both numbers moved together again for the same reason as
   the first pass: maxDepth is a ceiling the time-bounded search reaches
   for, not a guarantee, so raising it without also raising the time
   budget would very likely have changed nothing in practice.

   The scaling is deliberately front-loaded toward Hard: Easy +1 ply
   (2->3, time +50%), Medium +2 ply (4->6, time +67%), Hard +3 ply
   (6->9, time +100%) — both the depth increase and the proportional
   time increase get larger at each higher tier, matching "the higher
   the tier, the more look-ahead" directly rather than just scaling
   everything by the same factor.

   Worth being direct about the uncertainty here: with a branching
   factor this large, each additional ply of REAL depth costs roughly
   an order of magnitude more search even with alpha-beta pruning and
   move ordering, not a small constant amount — so doubling Hard's time
   budget is not the same guarantee as "Hard now reliably searches 3
   plies deeper." It should reach further in practice; exactly how much
   further depends on how well move ordering prunes in actual positions,
   which isn't something verifiable without live profiling in a running
   browser. Real play is what should confirm or further calibrate these,
   the same as every other number on this page.

   twoStepBias / cabezaRepeatBias (see the rootBias handling in
   minimaxSearch) push back on the AI leaning on its Cabeza turn after
   turn instead of developing its blocks, without ever touching a
   genuinely necessary continuation or a real crush/win.

   Hard gets both: a deep, well-tuned search finds a legitimate second
   movement, or another Cabeza slide, correct often enough that it stops
   looking like a choice and starts looking like a habit.

   Easy gets cabezaRepeatBias too, and set higher than Hard's — turns
   out a SHALLOW search leans on the Cabeza even harder, not less: at
   depth 2 there's no lookahead to make a block's positional value
   legible at all, so the Cabeza — the only piece that ever moves the
   dominant goal-progress term — is nearly the only thing that ever
   looks like a good move. Left alone this reads as the Cabeza being
   used almost exclusively; the stronger bias forces real rotation onto
   the blocks after a turn or two. twoStepBias is left at 0 for Easy,
   since chaining both movements wasn't the reported problem there.

   Medium was left at 0 for everything until now — untouched, same as
   Easy was before its own pass, until real play flagged the identical
   "rides the Cabeza" pattern here too. Depth 4 sits genuinely between
   Easy's 2 and Hard's 6: deep enough to see a block's consequences
   play out across two of its own turns (Easy's depth 2 can barely see
   past the opponent's immediate reply), but nowhere near Hard's
   6-ply view. That's why this isn't just "copy Hard's numbers down a
   notch" — Medium gets cabezaRepeatBias plus blockAdvance/turritoBonus
   specifically, not the full four-weight suite. The reported problem
   is which piece gets moved, not overall strategic depth, and
   blockAdvance/turritoBonus are the two terms that directly reward
   developing something other than the Cabeza; wall (corridor defense)
   and centrality (board position) are broader positional sense that
   nobody's flagged an issue with here, so they stay at 0 rather than
   being tuned on spec. cabezaRepeatBias sits at 11, closer to Easy's
   12 than Hard's 9 — Medium's positional weights are real but partial
   (two terms, not four), so the bias still needs to carry more of the
   load than it does for Hard, just not as much as when it was the
   ONLY mechanism Easy had. blockAdvance/turritoBonus themselves are
   scaled down from Hard's 1.4/1.6 to 0.8/0.9 — enough to be a genuine,
   felt reason to develop a block, not enough to make Medium's judgment
   read as Hard's. As with every number on this page, first pass, not
   derived — real play calibrates further from here. */
export const AI_DIFFICULTY = {
  easy: {
    label: "Easy",
    maxDepth: 3,
    timeBudgetMs: 450,
    twoStepBias: 0,
    cabezaRepeatBias: 12,
    /* See minimaxSearch's root bias: a piece moved turn after turn is
       nudged aside for near-equal alternatives. Easy, searching
       shallowest, fixated hardest (one piece in ~60% of its turns). */
    pieceRepeatBias: 8,
    /* A piece put straight back where it stood a turn or two ago (see
       minimaxSearch's root bias), in fast games only (findBestAiTurn). */
    backtrackBias: 10,
    /* Easy doesn't check its one-turn choices against every reply (see
       checkOneTurnChoice): it can still leave a crush it didn't see. */
    verifyReplies: false,
    blockAdvance: 0,
    turritoBonus: 0,
    wall: 0,
    centrality: 0,
    /* No beam: Easy looks at every turn but only a short way ahead — in
       a Split Movement game that's its own move plus the evaluation's
       read of the reply (crush threats, the Cabeza's route). */
    beam: 0,
    /* Easy is already loose; a wide jitter suits it and keeps it from
       being memorisable either. */
    jitter: 2.5,
    openingJitter: 2.0,
  },
  medium: {
    label: "Medium",
    /* Raised again (6->8, 1500->2200ms) on the theory that search
       depth, not just the wall weight above, contributed to missing
       the reported corridor gap. Worth being precise about what this
       does and doesn't fix: wall is a STATIC term — it's evaluated at
       whatever position the search happens to be looking at, shallow
       or deep, so a shallow search was never literally blind to a
       gap's existence once wall stopped being 0. What deeper search
       adds instead is better judgment about whether leaving a gap open
       is actually worth it — seeing further into what the opponent
       does with it before deciding a block's own advancement credit
       outweighs covering that gap, rather than trading that off
       looking only a couple of turns ahead. A real, plausible
       contributor to the original failure, just a different mechanism
       than "couldn't see the gap at all." */
    maxDepth: 8,
    /* 2200 -> 1200 (user: "AI is spending too much time thinking on
       turn"). Measured in Node on classic games, a 2200ms think had its
       answer at 0.6-1.5s and spent the rest on a depth it then threw
       away; an unfinished depth now keeps its finished root turns (see
       findBestAiTurn), so the cut costs less than a depth. */
    timeBudgetMs: 1200,
    twoStepBias: 0,
    cabezaRepeatBias: 11,
    pieceRepeatBias: 6,
    /* From the reported game where Medium shuffled its Rayo, Chato and
       Cabeza back and forth all game (see minimaxSearch's root bias); in
       fast games only, where that happened (findBestAiTurn). */
    backtrackBias: 10,
    /* When only a one-turn search fits (Split Movement, 3 Actions), its
       choice is checked against every reply, and a threat that no reply
       answers is found and played (checkOneTurnChoice, findForcedCrush). */
    verifyReplies: true,
    forcedCrush: true,
    blockAdvance: 0.8,
    /* Was 0.9: an extra reward for advancing the Turrito specifically,
       from before the MATTER pieces existed. With 3 actions it made the
       Turrito the AI's piece for everything; now no piece is favoured. */
    turritoBonus: 0,
    /* Added after simulating a real reported game move-by-move (exact
       piece positions reconstructed from the log, not just move
       counts). Dark's blocks left a persistent gap on the board's
       right side — the corridorGap metric this weight multiplies
       measured it at 3.5 columns wide from turn 16 onward, the entire
       second half of the game — while Dark spent turns 21-26
       repeatedly shuffling its Flaco in the opposite corner. Light's
       Cabeza walked straight through that gap for an uncontested,
       six-turn winning run. With wall at 0, Medium's evaluation had no
       term that could see this at all: blockAdvance/turritoBonus only
       reward a block for advancing toward ITS OWN goal, never for
       covering the enemy Cabeza's corridor, so there was nothing in
       the position that made repositioning toward that gap look better
       than the block-advancement credit Flaco was already earning
       further left.

       2.0 rather than Hard's (now 4) wall: scaled down by roughly the
       same ratio already used for blockAdvance/turritoBonus above
       (Hard's 1.4/1.6 became 0.8/0.9 here, ~57%) — enough to give a
       wide-open corridor real, felt weight against the
       block-advancement terms it now has to compete with, not enough
       to make Medium's positional judgment read as Hard's. */
    wall: 2.0,
    centrality: 0,
    /* Room to run (see evaluatePosition): 8 per safe step square short
       of three. From tests/ai-sim.mjs, scenario "rayo" (the reported
       game's roster, Split Movement + Slides): with it on, the longest
       run of Cabeza-only turns fell from 38 to 3, and this Medium beat
       the previous one 7-0 (1 draw) across both sides, every win a crush. */
    cabezaSafety: 8,
    /* Looks deeper into only its 8 best-ordered turns per position (24
       at the root). Measured with tests/ai-sim.mjs against the previous
       Medium: 11 of 12 games won on the classic board, 12 of 12 with
       MATTER pieces + Split Movement + Shoving, where the full-width
       search had only ever managed one turn of look-ahead. */
    beam: 8,
    /* The tier this was actually reported on. 1.8 is a bit over two
       rows of block advancement (0.8 each) and just over one point of
       mobility (1.5), so moves the search rates within a couple of
       points of each other genuinely trade places between games, while
       anything clearly better still wins. openingJitter takes the
       first six turns to 4.8, which is where the repetition was most
       obvious and where the position is identical every game. */
    jitter: 1.8,
    openingJitter: 3.0,
  },
  hard: {
    label: "Hard",
    /* Raised again (9->11, 3000->4300ms) — same reasoning as Medium's
       depth increase above: not because wall's existence depends on
       search depth, but because deeper search should better judge
       whether an open corridor is worth trading away against other
       opportunities, by actually seeing further into how the opponent
       would exploit it rather than weighing that tradeoff only a
       couple of turns out. */
    maxDepth: 11,
    /* 4300 -> 3500 to shorten how long the processor runs flat out
       (and the 3D scene competes with it). Checked with tests/ai-sim.mjs
       against Medium on the classic board: 3500ms with beam 12 went
       7 wins / 0 losses / 3 draws, while 3000ms (beam 10 or 8) fell to
       an even match. 3500 -> 2800 with Medium's cut (see there): at 2000
       it lost to the old Hard 1-5 (2 draws) and only drew with the new
       Medium 2-2, so it was no longer the harder of the two. */
    timeBudgetMs: 2800,
    twoStepBias: 10,
    cabezaRepeatBias: 9,
    pieceRepeatBias: 5,
    backtrackBias: 8,
    verifyReplies: true,
    forcedCrush: true,
    blockAdvance: 1.4,
    turritoBonus: 0, // was 1.6 — see Medium's note

    /* Set to 4 per explicit instruction, replacing the 5.0 this was
       raised to last round. Worth noting plainly rather than silently:
       that was a reasoned-but-unverified extrapolation from Medium's
       evidence-backed 2.0, and this round's request for 4 supersedes
       it directly — not a further calibration of that same number, a
       different target value. Still meaningfully above the original
       3.5, and still without a Hard-tier game log demonstrating this
       specific failure the way Medium's 2.0 has behind it; real
       Hard-tier play remains what should confirm or further adjust
       this, same as the depth numbers above. */
    wall: 4,
    centrality: 0.8,
    cabezaSafety: 8, // same as Medium; not separately simulated for Hard
    /* Wider than Medium's, with twice the time to use it. */
    beam: 12,
    /* Deliberately the smallest of the three. Hard's whole point is
       playing the best move it can find, so noise here is limited to
       breaking pure repetition — well under one row of its own
       advancement weight (1.4), so it only ever separates moves this
       tier already rates as effectively equal. The opening still gets
       a little more, since that is the one position guaranteed
       identical every game. */
    jitter: 0.5,
    openingJitter: 1.2,
  },
};
