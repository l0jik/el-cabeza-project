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
| medium | 8 | 1200 (was 2200) |
| hard | 11 | 2800 (was 4300, then 3500) |

(The cuts are explained in the AI_DIFFICULTY comments; in the fast rules
Hard also checks past its time, see "Hard from two reported games".)

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
  under the laws in force: Futuris's sphere now sets the laws before the
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

### Hard from two reported games (2026-10-16): verify till a turn holds, a net one turn further
The user's setup both times: 14 rows by 13 columns, every law (Split
Movement with three pieces, Slides, Black holes, Cantilever Pivot,
3 Actions, Shoving, Punto), ten pieces a side, Hard as Walnut (dark).
Game 1's replay code is kept in tests/ai-net.smoke.mjs. The analysis
scripts were in that session's scratchpad, hardgame/ (replay.mjs replays
a code with the real engine, `CODE=./code2.txt` for the second game;
solver.mjs and solve54.log, the exact two-turn check of the 28th turn),
and go with it; the smoke test's replay is the place to start again.

Game 1, the user won (crush, 30 turns each). What lost it:
- In these rules Hard only ever finishes depth 1: 3,934 root turns at
  its 28th turn, evaluatePosition 1.2 ms each, 4.6 s for them all. Its
  choice rests on the evaluation and the reply check (checkOneTurnChoice).
- Its 29th turn: 2 of 2,576 turns held (both Cruce moves). The
  best-scoring ones all fell to a Split Movement reply (an Arco steps
  aside, a 2x3 comes down on the Cabeza), which blockTurnReach can't
  see; the old check stopped after three past the deadline and played
  the best-scoring: lost at once.
- The real mistake was its 28th: block1x3:S cabeza:W cabeza:W walked
  the Cabeza into a pocket within reach of a Turrito that had come
  through a black hole. No reply ended the game at once, but one won by
  force (solve54.log: lost in two). 28 of 3,934 turns survived the next
  reply; of the 20 the exact check got through, only the retreat
  cabeza:N cabeza:NE cabeza:NE held a turn further (none of its 1,994
  replies made a threat).
- blockTurnReach didn't follow a block through a black hole, so
  cabezaInDanger missed a crush by a block coming out of the far hole.

What changed (de0c2fb):
- `endingLine(pieces, side)` (exported, with `canEndGame`): can `side`
  end the game on its coming turn, exactly as
  `generateTurns(...).some((t) => t.endsGame)` answers it, by a search
  that moves only pieces that can still matter (distance bounds per
  piece), each line once (memo on the moved pieces' states, the points
  spent, which pieces moved). Returns the line, [{ id, from, to,
  shoved }]. Checked: the reported game's 2,581 positions (144 ms ->
  8.8 ms each) and 76,000 positions of random games (26,162 where the
  side could end it), 0 mismatches; about 13x faster than generateTurns
  (0.4 ms vs 5 ms). Once, before those, a random game gave one mismatch
  (endingLine yes, generateTurns no: the safe way round) that never came
  back (setups use Math.random; scratchpad equiv/ending.mjs dumps such a
  position now). If it's ever seen again, that's where to start.
- Medium's reply check uses endingLine (same answers, sooner).
- Hard (`verifyGraceMs` 1500): checks past its time until a turn holds.
  A line found after a turn is kept as its region (lineRegion: the boxes
  it uses, a square wider), and any other turn that doesn't touch it
  (turnTouches) is passed over without a search: it leaves the line
  standing.
- The net (`netGuard`, `netGraceMs` 2500, `netMax` 3; opponentNet and
  hasAnswer): a turn that holds is looked at one turn further. If some
  reply makes a threat (one block's, cabezaInDanger; only blocks the
  reply could have changed are walked again) that no turn of Hard's
  answers (hasAnswer: the Cabeza's own steps first, then the turns that
  touch the line), the turn is netted and the next that holds is
  looked at; a square the Cabeza was netted on is skipped after. If all
  are netted, the first that held is played.
- blockTurnReach follows black holes (a box with two sides of one,
  canDrop, aims at the far hole when a target stands beside it).
- Speed, exact (same arithmetic in the same order, so the same answers):
  shapes.js rollSweepClashes keeps each shape's sweep (sweepOf) and
  first checks the obstacle is near; pivotSweepClashes keeps its trig;
  rules.js blackHoleVerdict and overlapsMissingSquare return at once
  when no hole or missing square is in the box. Checked on 3,626
  positions: 510,560 sweep and 7,618 pivot calls and 127,659
  legalMovesFor calls the same; legalMovesFor 2.2x faster.
- On the game's positions Hard now plays the retreat at its 28th turn
  (about 6.2 s) and a Cruce move at its 29th.
- tests/ai-net.smoke.mjs (in test:engine): the game's code; endingLine
  against generateTurns at all 120 side-positions; the two turns that
  hold at the 29th; the net after the 28th as played and none after the
  retreat; a black-hole crush seen by legalMovesFor, cabezaInDanger and
  cabezaThreats.
Measured, new Hard against the old (scratchpad aisim/sim.mjs: the repo's
engine against an untouched copy of the one before, engine-old/; the
user's setup without Punto and game 1's roster; colours alternating;
140 turns a draw): 8 wins, 3 losses, 3 draws over 14 games (as dark
4-2-1, as light 4-1-2). Its thinking, turn-weighted: 4.1 s a turn on
average against 3.1 s, at most 7.8 s against 7.3 s. CI for de0c2fb:
Deploy #777 and Browser tests #97 (all eight shards) green.
Walk home seen coming (user: "Teach Hard to see the walk-home coming";
two of those three losses were walks home, game 12 after the light Cabeza
went through a black hole into dark's half, in at (9,9), out at (4,2)):
- opponentNet counts a walk home as a threat: their Cabeza ending a reply
  within maxStepsFor("cabeza") rows of its goal row (nearHome), looked at
  only when such a Cabeza exists (walkers: within two turns' steps of
  home, or a turn's steps from a hole) and only when the reply moved it or
  a piece in a box around its way home; then endingLine(opp) says whether
  it can walk in. Replies that bring a Cabeza near home are tried first.
- cabezaRouteCost routes through black holes: a step onto a hole lands
  one square past the far hole, back along the way it came, and costs a
  whole turn's steps (HOLE_STEPS_MAX = 6 caps it; ROUTE_RING is fixed at
  HOLE_STEPS_MAX + ATTACKED_STEP_COST + 2 so Punto's short first turn never
  reallocates the ring), so a Cabeza beside a hole whose far side is near
  home is that much nearer to the evaluation.
- hasAnswer got fast enough for the net check's 2.5 s: the turns that met
  earlier threats (answers, ANSWERS_KEPT = 8) are tried first by
  answerHolds (each step replayed as the rules allow it now), and a turn
  of ours that ends the game (endingLine(me)) answers anything; in game
  12's late positions the check had taken 3 to 34 s; the net two turns
  before the walk is now found in 1.2 s.
Checked: tests/ai-net.smoke.mjs sections 5 (Light's Cabeza beside a hole
whose far side is a step from home reads nearer home through it, but not
home this turn) and 6 (four rows out on an open board, a reply that
brings it within a turn of home is a net; seven rows out it isn't); game
12 again from turn 84 (aisim/an/cont12.mjs, the changed Hard as dark
against the same opponent): it now wins by a crush at turn 94 instead of
losing to the walk; 12 games of the changed Hard against the Hard before
it (aisim/sim2.mjs, the user's setup, colours alternating,
scratchpad/aisim/w2-a and w2-b): 9 wins and 2 losses over the first 11
(both losses crushes, none a walk home; the twelfth still playing when
this was written), 5-1 as dark, 4-1 as light. Thinking: about 4.2 s a
turn on average against 3.7 s, at most 7.2 s against 7.7 s.

Game 2, Hard won (played before de0c2fb was live, so the old Hard). Its
Cabeza went into the black hole at (4,10) on its 32nd turn (C:
SW.SW.SE) and came out at (8,1), deep in the user's half; at its 35th it
stood at (10,5), three steps from its goal row, with a way under the
user's standing Arco Ancho, and walked home at its 36th. The user's
35th (Ch: S.S.S) left the way open; 13 of their 876 turns closed it
(AN: slide-N, one action, puts the arch's leg on the square it walked
under). The user never had a turn that ended the game. The check alert
reads cabezaThreats only (a single block's crush on your own Cabeza):
it says nothing of the other side's Cabeza walking home.
