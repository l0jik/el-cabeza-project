## 3. Game AI (the in-game opponent, not "Claude")

`engine/ai.js`: minimax with iterative deepening (loop breaks early the
moment `Math.abs(score) >= AI_WIN_SCORE` — a forced win/loss found at a
shallow depth can't be improved by searching deeper), make/unmake move
mutation on **one** cloned pieces array (not a fresh array per node —
this was a real optimization, see §4), killer-move (2/ply) + history
heuristic move ordering layered on top of crush/win-first ordering, then
static eval. Runs on a **dedicated Worker thread**
(`engine/ai-worker.js`), essential because Hard-tier search can occupy
the thread for up to 4.3s; falls back to in-thread only if the worker
script tag is missing (e.g. running straight from source, not a built
`dist/` file). Public contract — `{ pieceId, dirs }` — is depended on by
the chassis and tests; don't change its shape without updating both.

`AI_WIN_SCORE = 1_000_000`, `AI_OPENING_TURNS = 6` (extra `openingJitter`
for the first 6 turns specifically to avoid a memorizable/repetitive
opening). Three difficulty tiers, each with `maxDepth`/`timeBudgetMs` and
its own eval weights (`twoStepBias`, `cabezaRepeatBias`, `blockAdvance`,
`turritoBonus`, `wall`, `centrality`, `jitter`, `openingJitter`):

| tier | maxDepth | timeBudgetMs |
|---|---|---|
| easy | 3 | 450 |
| medium | 8 | 2200 |
| hard | 11 | 4300 |

**Important context if retuning these:** Medium's `wall` weight (2.0) and
Hard's (4) exist because a real reported game was reconstructed
move-by-move from its log and showed the AI leaving a 3.5-column-wide
corridor open for 10+ turns while `wall: 0` gave the eval nothing that
could see a gap as dangerous — `blockAdvance`/`turritoBonus` only reward
a block for advancing toward its OWN goal, never for covering the
opponent's corridor. If Hard/Medium play is reported as leaving gaps
again, this is the mechanism to look at first, and the fix should
similarly be grounded in a reconstructed real game, not a guessed weight
bump — several of the numbers in this table are explicitly flagged in
comments as "reasoned but unverified extrapolation," not measured.

### Fast games: 3 Actions, Split Movement, Slides (third reported game)
The user's record (Medium, Light; Dark human won by a Turrito crush):
Rayo, 2x3, Chato, Turrito, 1x3 and a Cabeza a side, 3 Actions, Slides,
Split Movement, Cantilever Pivot, Shoving by slides only. Medium shuffled
all game (a Rayo slid north then south, a Chato south/north/south, the
Cabeza south/north/south), then walked its Cabeza into the Turrito's
three rolls south. What was wrong, and what changed (engine/ai.js):
- **Every tier searched one turn.** Each side has 500-3000 turns, and
  depth 2 orders the reply to every root turn it keeps (24 for Medium),
  each as costly as all of depth 1: ~20 s. It ran to the deadline and was
  thrown away. Now findBestAiTurn doesn't start depth 2 when
  `0.35 * kept * depth1Ms` exceeds the time left (minimaxSearch returns
  `width`); Medium answers in about 0.4 s there instead of 2.2 s.
- **Threats stopped at two rolls.** `blockTurnReach` walks each enemy
  block's whole turn (legalMovesFor with the points left: rolls, pivots,
  slides, not past a shove), each place once, cutting lines that can't
  end on or beside a target; crushes and roll landings feed `threatened`
  and the attacked squares (route cost, room to run). cabezaInDanger
  uses it too. Eval cost in these rules ~0.35 -> ~1.1 ms; in the classic
  rules it got cheaper (in-place apply/undo instead of copying the board).
- **A free walk home wasn't seen**: `walksHome` in evaluatePosition, the
  side to move wins if a Cabeza of its is within `maxStepsFor("cabeza")`
  plain steps of its goal row (attacked squares don't count).
- **Exact reply check at depth 1** (`verifyReplies`, Medium and Hard; Easy
  keeps its mistakes): when the search ended one turn deep, the
  best-scoring turns are checked in order against every opponent turn
  (generateTurns, so Split Movement pairings and shoves too) and the
  first with no game-ending reply is played (at least three checked, up
  to 40; checkOneTurnChoice).
- **Shuffling**: `backtrackBias` (Easy 10, Medium 10, Hard 8) per piece
  put back where it stood at the start of one of the AI's last 3 turns,
  in fast games only (see below).
  The chassis keeps `aiPlacesRef` (snapshots of `placeKey`), passes
  `recentPlaces` through the worker to findBestAiTurn.
- **Openings**: a shuffled opening could let the first move crush a
  Cabeza (a standing 2x3 rolls three rows at a time; 2 of 30 openings in
  these rules). generateAnomalySetup now rejects those (cabezaInDanger,
  under the laws in force: Neon's sphere now sets the laws before the
  pieces, like rules-selections.js).
Tests: tests/ai-threats.smoke.mjs (three-roll threats, walk home, the
one-turn decision judged by every Dark reply, the opening guard);
tests/ai-sim.mjs scenario `fast` (reports `piecesPutBack`).
Measured (ai-sim `fast`, Medium new vs the previous Medium): 15-1 across
both colours. But new vs new drew at 80 turns, safe and aimless, so:
- **Forced crushes** (`forcedCrush`, Medium and Hard; findForcedCrush):
  at a one-turn search, a turn after which the opponent's Cabeza is in
  reach and every reply leaves it in reach is played (+5000). Its replies
  that move their Cabeza are tried first. vs the pushed Medium: 13-4 (3
  draws) over 20 games.
- **`threatBonus`** (the value of a threat the side to move must answer,
  25 as always): 60 measured no better (12-6, 2 draws), so it stays 25.
- The attacked-square marks follow every first roll again, as the
  two-roll check did.
- **The put-back cost is for fast games only** (Split Movement or 3
  Actions, where the AI searches one turn and the shuffling happened).
  In the classic game it cost Medium strength: over 24 classic games
  each against the pre-change Medium, 9-13 (2 draws) with it, 15-9
  without. findBestAiTurn zeroes `backtrackBias` outside fast games.
- The reply check and the forced-crush search (`checkOneTurnChoice`) run
  only when the search ended one turn deep (findBestAiTurn, after the
  loop, from depth 1's `rootScores`): a deeper search saw the replies
  itself, and the checks were costing the classic game a little depth.
- Final settings, confirmed: fast rules vs the first pushed version of
  these fixes 9-3; classic rules vs the pre-change Medium 8-8 (with the
  24-game 15-9 above, even to slightly better). The first push (e177682)
  still had the put-back cost in the classic game.
- Side effect: Easy's opening in the classic setup with Split Movement is
  now a two-piece turn in about 12 games of 30 (it was about 20 of 30;
  the attacked-square marks changed its taste, mostly for a Flaco W.W).
  tests/e2e-ai-split.mjs waits for a two-piece opening, so it now tries
  up to ten fresh games instead of four (four failed about one run in
  eight).

