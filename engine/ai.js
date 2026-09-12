/* Minimax AI for El Cabeza. Verified byte-for-byte identical between
   the Standard and Neon theme sources before extraction (see
   build/scratch/) — pure logic, no React, no Three.js, no DOM. */

import { BOARD_SIZE, GOAL_ROW, PIECE_META } from "./constants.js";
import { legalMovesFor, sameState } from "./rules.js";

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

/* Can any of the opponent's blocks crush `owner`'s Cabeza THIS move,
   from this exact position? Factored out so both evaluatePosition's
   leaf scoring and minimaxSearch's tie-break (see below) share one
   definition rather than two copies that could drift apart. */
export function cabezaInDanger(pieces, owner) {
  const cabeza = pieces.find((p) => p.type === "cabeza" && p.owner === owner);
  if (!cabeza) return true; // already gone — about as "in danger" as it gets
  const oppPlayer = opponentOf(owner);
  for (const p of pieces) {
    if (p.owner !== oppPlayer || p.type === "cabeza") continue;
    const moves = legalMovesFor(pieces, p);
    for (const dir in moves) {
      if (moves[dir].crushes && moves[dir].crushes.id === cabeza.id) return true;
    }
  }
  return false;
}

/* Every complete legal turn available to `player` from this position:
   one piece, either a single step/roll or two chained together,
   exactly mirroring what the UI itself allows (see PIECE_META.maxSteps
   and the commit logic in the component). Two-step chains that land
   back on the turn's own starting square and orientation are excluded
   here for the same reason the engine voids them live — see sameState
   — so the AI never wastes a search branch, let alone an actual turn,
   considering a move that isn't really a move. */
export function generateTurns(pieces, player) {
  const turns = [];

  for (const piece of pieces) {
    if (piece.owner !== player) continue;
    const maxSteps = PIECE_META[piece.type].maxSteps;
    const firstMoves = legalMovesFor(pieces, piece);

    for (const [dir1, move1] of Object.entries(firstMoves)) {
      let afterStep1 = pieces.map((p) => (p.id === piece.id ? move1.candidate : p));
      if (move1.crushes) afterStep1 = afterStep1.filter((p) => p.id !== move1.crushes.id);

      const wins1 =
        !move1.crushes &&
        piece.type === "cabeza" &&
        move1.candidate.row === GOAL_ROW[piece.owner];
      const terminal1 = !!move1.crushes || wins1;

      // Stopping after this single step is always itself a complete,
      // valid candidate turn — a human can always choose "Stop here"
      // even when a second step would be available, and the AI needs
      // that same option on the table, not just the deepest chain.
      turns.push({
        pieceId: piece.id,
        dirs: [dir1],
        resultingPieces: afterStep1,
        crushes: !!move1.crushes,
        wins: wins1,
      });

      if (terminal1 || maxSteps < 2) continue;

      const secondMoves = legalMovesFor(afterStep1, move1.candidate);
      for (const [dir2, move2] of Object.entries(secondMoves)) {
        if (sameState(piece, move2.candidate)) continue; // net-zero round trip — not a real turn

        let afterStep2 = afterStep1.map((p) => (p.id === piece.id ? move2.candidate : p));
        if (move2.crushes) afterStep2 = afterStep2.filter((p) => p.id !== move2.crushes.id);

        turns.push({
          pieceId: piece.id,
          dirs: [dir1, dir2],
          resultingPieces: afterStep2,
          crushes: !!move2.crushes,
          wins:
            !move2.crushes &&
            piece.type === "cabeza" &&
            move2.candidate.row === GOAL_ROW[piece.owner],
        });
      }
    }
  }

  return turns;
}

/* Scores a position from `forPlayer`'s point of view — higher is
   better for them, regardless of whose turn it actually is. This is
   the part that's genuinely hand-tuned rather than derived, and the
   most likely thing to need adjusting once this is actually played
   against.

   `weights` layers optional positional terms on top of the base score
   (progress/mobility/crush-threat below always apply regardless).
   Every term under DEFAULT_EVAL_WEIGHTS defaults to 0 — meaning "off,
   evaluates identically to before this existed" — and only becomes
   live when a difficulty's config actually sets it, so a tier that
   doesn't ask for one of these behaves exactly as it did previously. */
export const DEFAULT_EVAL_WEIGHTS = {
  blockAdvance: 0,
  turritoBonus: 0,
  wall: 0,
  centrality: 0,
};

export function evaluatePosition(pieces, forPlayer, weights = DEFAULT_EVAL_WEIGHTS) {
  const oppPlayer = opponentOf(forPlayer);
  const myCabeza = pieces.find((p) => p.type === "cabeza" && p.owner === forPlayer);
  const oppCabeza = pieces.find((p) => p.type === "cabeza" && p.owner === oppPlayer);

  // A missing Cabeza means it was crushed on some earlier ply of the
  // search itself (not necessarily the position actually on screen).
  if (!myCabeza) return -AI_WIN_SCORE;
  if (!oppCabeza) return AI_WIN_SCORE;

  // Progress toward each side's own goal row — dominant term, since
  // reaching it wins outright regardless of anything else on the board.
  const myProgress = forPlayer === "dark" ? myCabeza.row : BOARD_SIZE - 1 - myCabeza.row;
  const oppProgress = oppPlayer === "dark" ? oppCabeza.row : BOARD_SIZE - 1 - oppCabeza.row;
  let score = (myProgress - oppProgress) * 12;

  // Mobility: total legal rolls/steps available across each side's
  // pieces right now. Cheap proxy for "how much flexibility does this
  // side actually have" — a block rolled into a dead corner is worth
  // less than its mere presence on the board suggests.
  let myMobility = 0;
  let oppMobility = 0;
  for (const p of pieces) {
    const count = Object.keys(legalMovesFor(pieces, p)).length;
    if (p.owner === forPlayer) myMobility += count;
    else oppMobility += count;
  }
  score += (myMobility - oppMobility) * 1.5;

  // Immediate threat: can any enemy block crush my Cabeza on its very
  // next move, from this exact position? A real search finds this
  // organically at enough depth, but folding it into the leaf score too
  // gives even a shallow (Easy-mode) search genuine defensive sense
  // rather than none at all.
  if (cabezaInDanger(pieces, forPlayer)) score -= 4000;

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
      const rowsAdvanced = p.owner === "dark" ? p.row : BOARD_SIZE - 1 - p.row;
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
      const marks = [-1, ...cols, BOARD_SIZE];
      let gap = 0;
      for (let i = 1; i < marks.length; i++) gap = Math.max(gap, marks[i] - marks[i - 1] - 1);
      return gap; // 0 = fully covered, up toward BOARD_SIZE = wide open
    };
    const myGap = corridorGap(forPlayer, oppCabeza, GOAL_ROW[oppPlayer]);
    const oppGap = corridorGap(oppPlayer, myCabeza, GOAL_ROW[forPlayer]);
    // A gap of MINE is bad for me (subtracts); the SAME gap sitting on
    // the opponent's side is an opportunity for my own Cabeza to run
    // through, so it adds — this is what gives the term both a
    // defensive and an aggressive side, not just a defensive one.
    score += (oppGap - myGap) * weights.wall;
  }

  if (weights.centrality) {
    // Zone control: a central piece has more of the board reachable
    // from it than the same piece pinned against an edge or corner —
    // true for a block's roll directions and doubly true for the
    // Cabeza, whose diagonal options get clipped outright near a wall.
    const center = (BOARD_SIZE - 1) / 2;
    const maxDist = Math.hypot(center, center);
    let value = 0;
    for (const p of pieces) {
      const pr = p.row + (p.h - 1) / 2;
      const pc = p.col + (p.w - 1) / 2;
      const central = 1 - Math.hypot(pr - center, pc - center) / maxDist;
      value += (p.owner === forPlayer ? 1 : -1) * central;
    }
    score += value * weights.centrality;
  }

  return score;
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
   plies would make minimax's own comparisons incoherent. */
export function minimaxSearch(pieces, player, aiPlayer, depth, alpha, beta, deadline, rootBias = null, weights = DEFAULT_EVAL_WEIGHTS) {
  if (performance.now() > deadline) {
    return { score: evaluatePosition(pieces, aiPlayer, weights), turn: null, timedOut: true };
  }

  const turns = generateTurns(pieces, player);
  if (turns.length === 0 || depth === 0) {
    return { score: evaluatePosition(pieces, aiPlayer, weights), turn: null, timedOut: false };
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
     is evaluated exactly once up front, not re-evaluated on every
     pairwise comparison a naive sort comparator would trigger. That
     wasn't a micro-optimization: an earlier version that scored inside
     the comparator itself measured roughly 8x the per-node cost of the
     crush/win-only sort; scoring once up front brought that down to
     roughly 2.6x, which is what let the reduced node count from better
     pruning actually win out in wall-clock time rather than being
     eaten by ordering overhead. */
  const scoredTurns = turns.map((t) => ({
    turn: t,
    terminal: !!(t.crushes || t.wins),
    orderScore: t.crushes || t.wins ? 0 : evaluatePosition(t.resultingPieces, aiPlayer, weights),
  }));
  scoredTurns.sort((a, b) => {
    if (a.terminal !== b.terminal) return a.terminal ? -1 : 1;
    if (a.terminal) return 0; // both terminal -- no further ranking needed between them
    return maximizing ? b.orderScore - a.orderScore : a.orderScore - b.orderScore;
  });
  turns.splice(0, turns.length, ...scoredTurns.map((s) => s.turn));

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestTurn = null;
  let timedOut = false;

  /* Computed once, not per-turn: whether `player`'s own Cabeza is
     ALREADY in immediate danger before any of these candidates are
     even considered. Used below to exempt a turn that actually
     resolves that danger from the style biases — see the rootBias
     block. */
  const dangerBeforeMove = rootBias ? cabezaInDanger(pieces, player) : false;

  for (const turn of turns) {
    let score;
    if (turn.crushes || turn.wins) {
      // Terminal within this ply. depth is folded in as a small
      // tiebreak — not to decide who wins, only to prefer a faster win
      // and a more-delayed loss among otherwise-equal outcomes. Never
      // biased below — a genuinely decisive turn is never suppressed
      // for the sake of style.
      const sign = player === aiPlayer ? 1 : -1;
      score = sign * (AI_WIN_SCORE + depth);
    } else {
      const child = minimaxSearch(
        turn.resultingPieces,
        opponentOf(player),
        aiPlayer,
        depth - 1,
        alpha,
        beta,
        deadline,
        null, // rootBias intentionally NOT passed through — see comment above.
        weights // weights DOES thread through — evaluation must stay consistent at every ply.
      );
      score = child.score;
      if (child.timedOut) timedOut = true;

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
        const resolvesDanger = dangerBeforeMove && !cabezaInDanger(turn.resultingPieces, player);

        if (!resolvesDanger) {
          // Prefer a single movement over automatically chaining the
          // second one, unless the second movement is worth enough on
          // its own merits to overcome the nudge.
          if (turn.dirs.length === 2) score -= rootBias.twoStepBias;

          // The more turns in a row the AI has already spent walking
          // its own Cabeza, the more it's nudged toward using
          // something else this time — scales with the streak so an
          // isolated Cabeza move costs little, but leaning on it turn
          // after turn costs progressively more.
          const movedPiece = pieces.find((p) => p.id === turn.pieceId);
          if (movedPiece && movedPiece.type === "cabeza") {
            score -= rootBias.cabezaRepeatBias * rootBias.cabezaStreak;
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

    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestTurn = turn;
    } else if (score === bestScore && bestTurn) {
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
      const stayedSafe = !cabezaInDanger(turn.resultingPieces, player);
      const bestWasSafe = !cabezaInDanger(bestTurn.resultingPieces, player);
      if (stayedSafe && !bestWasSafe) {
        bestScore = score;
        bestTurn = turn;
      }
    }

    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
    if (beta <= alpha) break; // prune — the rest of this branch can't change the outcome

    if (timedOut) break;
  }

  return { score: bestScore, turn: bestTurn, timedOut };
}

/* Iterative deepening: search depth 1, then 2, then 3… until either
   maxDepth or timeBudgetMs runs out. A deeper attempt that times out
   mid-search is discarded outright rather than trusted — an alpha-beta
   search cut off partway through can be badly wrong about the branches
   it never finished looking at, so only a FULLY completed depth's
   answer is ever used. This is what keeps a "Hard" search from ever
   being able to freeze the tab: worst case, it just quietly falls back
   to whatever depth it did finish in time.

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
    wall = 0,
    centrality = 0,
    jitter = 0,
    openingJitter = 0,
  },
  cabezaStreak = 0,
  turnIndex = 0
) {
  const deadline = performance.now() + timeBudgetMs;
  /* Openings get extra noise on top of the baseline. The opening is
     where determinism was most glaring — every other position has
     already diverged by whatever the human did, but turn one is
     identical in every single game, so that's exactly where the same
     jitter buys the most variety. It decays to the baseline once the
     game has its own shape. */
  const effectiveJitter = jitter + (turnIndex < AI_OPENING_TURNS ? openingJitter : 0);
  const rootBias =
    twoStepBias || cabezaRepeatBias || effectiveJitter
      ? { twoStepBias, cabezaRepeatBias, cabezaStreak, jitter: effectiveJitter }
      : null;
  const weights = { blockAdvance, turritoBonus, wall, centrality };
  let best = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() > deadline) break;
    if (depth > 1) await yieldToEventLoop(); // let a frame render between depths — see the function comment above
    const result = minimaxSearch(pieces, aiPlayer, aiPlayer, depth, -Infinity, Infinity, deadline, rootBias, weights);
    if (result.timedOut && depth > 1) break;
    if (result.turn) best = result.turn;
    if (Math.abs(result.score) >= AI_WIN_SCORE) break; // forced win/loss found — deeper search can't change that
  }

  return best;
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
    blockAdvance: 0,
    turritoBonus: 0,
    wall: 0,
    centrality: 0,
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
    timeBudgetMs: 2200,
    twoStepBias: 0,
    cabezaRepeatBias: 11,
    blockAdvance: 0.8,
    turritoBonus: 0.9,
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
    timeBudgetMs: 4300,
    twoStepBias: 10,
    cabezaRepeatBias: 9,
    blockAdvance: 1.4,
    turritoBonus: 1.6,
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
