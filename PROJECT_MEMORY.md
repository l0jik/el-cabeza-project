# El Cabeza — project memory

Durable knowledge for continuing development after a context reset. This
is a *decisions, history, and pitfalls* document — it complements
`ARCHITECTURE.md` (the structural contract: chassis/theme/engine split,
the theme plugin interface, how to verify a refactor) rather than
repeating it. Read both before resuming work.

**Meta-note:** this was written by reviewing the full git history (100
commits) and cross-checking the claims below against the actual current
code as of commit `e58e182` (branch `claude/artifact-code-update-u6amyw`).
Constants/values cited here were read from source, not assumed from
commit messages — but code moves faster than docs, so if a cited number
looks off, trust `grep` over this file.

## 1. What this is, in one paragraph

A 3D board game (React + Three.js r128) with a shared "chassis + theme
plugin" architecture: `engine/` (pure rules/AI/geometry, no rendering),
`themes/standard.js` and `themes/neon.js` (palette, materials, audio,
ambient FX — two genuinely different visual identities), `chassis/
ElCabeza3D.jsx` (~5900 lines — the actual React component: state, camera/
input, JSX skeleton, generic actions; theme-agnostic). Three entry points
(`apps/standard.jsx`, `apps/neon.jsx`, `apps/unified.jsx` + its
`unifiedTransition.jsx` theme-switcher) are bundled by `build/build.js`
(esbuild) into three self-contained HTML files in `dist/` (gitignored,
built fresh every time). No backend. Everything is client-side state,
reset on reload, EXCEPT opponent settings (Human/AI side, AI difficulty,
Human-vs-Human starting side), which persist in `localStorage` under
`el-cabeza:opponent` (chassis `loadOpponentPrefs`/`saveOpponentPrefs`,
guarded so blocked storage just falls back to defaults) and also carry
over across every New Game / reset path.

Shipped as Claude Artifacts (the unified build is the one with a live
shared link; that link's "Latest vs. pinned version" mode is a claude.ai
Share-dialog setting, not something any Artifact tool action controls).
Current work branch: `claude/artifact-code-update-u6amyw` on
`l0jik/el-cabeza-project` — confirm this hasn't changed before assuming
it in a fresh session, since it's assigned per-task by the harness, not
fixed by the project itself.

`APP_VERSION` in `chassis/ElCabeza3D.jsx` has stayed `"1.39.0"` since the
original recovered source, through all ~100 commits since — it does not
track changes and should not be read as a changelog signal.

## 2. Build & verification model

- `npm run build` → `build/build.js`: three esbuild passes (one per app
  entry) plus one shared pass for `engine/ai-worker.js`, embedded as
  **inert script text** (`type="application/x-ai-worker"`, not a JS
  mimetype) inside each HTML file and turned into a real `Worker` via a
  Blob URL at runtime. This is deliberate: it keeps the "one
  self-contained HTML file per target, no second network request" model
  while still running the AI search off the main thread. Don't ship the
  worker as a separate file — that breaks the single-file deployment
  model this whole build exists to preserve.
- `define: { "process.env.NODE_ENV": '"production"' }` on every esbuild
  call — **do not remove**. Without it, react/react-dom silently ship
  their development build (real per-render `Object.freeze`, prop-type
  validation, warning machinery), costing ~34-37% extra bundle size and
  real per-render CPU, not just a dev-only warning.
- `npm test` = `npm run test:engine` (Node-only smoke tests, no browser:
  `engine.smoke.mjs`, `theme-{standard,neon}.smoke.mjs` — import theme
  modules directly, which is why they must stay plain ES modules with no
  JSX syntax) + `npm run test:e2e` (builds fresh, then drives the real
  built HTML in headless Chromium via Playwright: `e2e-smoke`,
  `e2e-gameplay`, `e2e-ambient`, `e2e-singularity`, each ×2 themes where
  applicable). e2e rebuilds from source every run, so it also catches
  build-time regressions. Piped through `tee`, this reports `tee`'s exit
  code, not npm's — use `set -o pipefail` or check `$PIPESTATUS`, a real
  gap that once let a failure read as success.
- Playwright launches via a pinned local Chromium path
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` as of this
  session) — don't `playwright install`.

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

## 3b. Board dimensions are a runtime parameter (TOPOLOGIES groundwork)

`BOARD_SIZE` no longer exists. `engine/constants.js` now owns
`BOARD_ROWS`/`BOARD_COLS` (default 10/10, bounds `MIN_BOARD_DIM` 6 to
`MAX_BOARD_DIM` 20) plus `setBoardDimensions(rows, cols)` /
`getBoardDimensions()`.

- **The mechanism is ES module live bindings.** Those values are `let`
  exports; importers write `BOARD_ROWS`, `OFF_X` etc. exactly as before
  and automatically see updated values after `setBoardDimensions()`
  runs — no getters, no call-site churn across ~60 sites. Verified
  empirically that this survives esbuild's IIFE bundling before the
  refactor was built on it. If that ever stops holding, this whole
  design collapses quietly, so re-verify before changing the bundler.
- **Rows and cols are deliberately separate**, and every dimension-
  dependent geometry value is split by axis: `GRID_EXTENT_X/Z`,
  `OFF_X/Z`, `SLAB_X/Z` (plus `SLAB_MAX`/`SLAB_MIN` for camera math).
  X follows columns, Z follows rows. **At the 10×10 default every X
  value equals its Z counterpart, so an X/Z or rows/cols swap is
  completely invisible at the default size** — that's why
  `tests/board-size.smoke.mjs` (Node) and `tests/e2e-board-size.mjs`
  (real browser, non-square + max sizes, with a real click that must
  select a real piece) exist. Never verify board-dimension work only at
  10×10.
- **`SQUARE_SIZE` is now a true constant** (1.056, exactly its old
  computed value). A bigger board means a physically bigger plate, not
  smaller squares — so pieces keep their apparent size and the camera
  pulls back instead. `ZOOM_MAX_FOR_BOARD` scales the old flat
  `ZOOM_MAX` by the plate's largest extent (identical at 10×10); the
  old fixed 55 could not frame a 20×20 board at any zoom.
- **The AI worker has its own module instance** of `constants.js`, which
  `setBoardDimensions()` on the main thread cannot reach. Every search
  request carries `board: getBoardDimensions()` and the worker applies
  it before searching. Forget this and the AI silently evaluates a 10×10
  board while the player plays something else.
- `createInitialPieces()` is parametric: Dark's formation is defined in
  columns relative to a centred 4-wide block, and Light is *derived* by
  180° rotation rather than a second hardcoded table. At 10×10 its
  output is byte-identical to the original hardcoded array (asserted).
- `apps/boardBootstrap.js` is the seam that applies a size before mount
  (`window.__EC_BOARD__`). It lives in `apps/` because engine modules
  must never touch `window` (a Worker has no `window` at all).
- **TOPOLOGIES is now wired for real.** The sphere's board-size choice is
  applied at Begin Game via the chassis's `applyBoardResize(rows, cols)`
  (exposed to the theme through `useSetupExtras`), which
  `finalizeSingularityBegin` calls FIRST (before the roster/holes are
  placed, while still awaiting Begin so the board is hidden). It's an
  in-place resize, not a remount: only the 3D plate is size-specific
  (rebuilt by `three.current.resizeBoardPlate` — slab/edges/top-ring/grid
  by name, plus a rescaled shadow frustum), while piece placement, picking
  math and camera fit all read the live engine bindings and follow the new
  size on their own. `topDownView()` on Begin Game reframes the camera to
  the new plate. New Game restores the boot size (`bootBoardRef`) ONLY for a
  vanilla reset — see the Singularity-persistence note below. The
  black-hole picker uses `selections.topologies` (the chosen size), since
  the live board isn't resized until Begin Game.
- **Singularity settings persist across New Game (reversal of the old
  reset-to-vanilla).** `handleReset` is now `resetGame(keepSingularity)`
  with `handleReset = resetGame(true)` (New Game) and `handleResetRules =
  resetGame(false)` (the "Reset Rules" dock button). When the ended game was
  Singularity-originated (`three.current.singularityGameActive` true and the
  theme registered `three.current.reapplySingularitySetup`), New Game
  REPLAYS the same setup — laws, board size, black holes, MATTER roster,
  board FX and the variants snapshot — instead of wiping them; only the
  vanilla branch clears laws/holes/variants/FX and restores the boot board +
  `createInitialPieces`. `finalizeSingularityBegin` (neon-singularity.js)
  deep-clones the selections and registers `reapplySingularitySetup`
  (board resize + `applyMatterRoster` for a fresh, possibly re-randomized
  opening + `setActiveLaws` + the resolved holes + variants). `applyMatterRoster`
  now ALWAYS `setPieces` (default roster → `createInitialPieces`) so a
  persisted New Game resets to a clean opening rather than inheriting the
  ended game's final positions. "Reset Rules" (chassis dock button, gated on
  `currentVariants != null` and `status !== "playing"`, `data-testid=
  "reset-rules"`) forces the vanilla branch; it clears `singularityGameActive`,
  so subsequent New Games are vanilla until the sphere runs again. A
  brand-new session never went through the sphere, so it starts vanilla.
  Standard theme never sets `singularityGameActive`, so it always
  vanilla-resets. Verified in `tests/e2e-singularity.mjs` (12×8 board
  persists across New Game; Reset Rules reverts to 10×10 and hides).
- Known non-obvious consequence, confirmed not a bug: four pieces (each
  side's Turrito and Cabeza) start boxed in by their own neighbours —
  identically at 10×10, 20×20 and non-square sizes. Don't "fix" it.
- **Win → New Game settings dialog (RETAIN vs RECONFIGURE).** Every "New
  Game" button (dock post-game row, Move Log popup, Victory placard) now
  routes through `handleNewGameClick`, not `handleReset` directly. It's
  eligible — shows a chassis-level dialog (`data-testid="new-game-choice"`,
  always-mounted/opacity-faded like the Move Log popup and Victory
  placard) instead of resetting immediately — only for a REAL win
  (`status === "finished" && winner`) off a Singularity-originated game
  (`currentVariants` set, `three.current.singularityGameActive`,
  `reconfigureSingularitySetup` registered). A manual end (`status
  "ended"`) or a plain game keeps the old one-click reset — nothing to
  choose between there. RETAIN calls the existing `handleReset` (silent
  persistence, unchanged). RECONFIGURE calls `resetGame(false)` (the same
  vanilla reset "Reset Rules" uses) then immediately
  `three.current.reconfigureSingularitySetup()` — a closure
  `finalizeSingularityBegin` (neon-singularity.js) registers alongside
  `reapplySingularitySetup`, closed over the real, structured `sel` object
  (not `buildVariantsSnapshot`'s lossy display strings). That closure calls
  `enterSphereDirect(sel)`, a new function that jumps straight to
  `PHASES.SPHERE`, pre-populated with `sel`, skipping the discovery
  gesture AND the whole toll/collapse/blackout cinematic entirely — it
  replicates only the END STATE that path leaves behind (board hidden,
  audio cut, chrome sucked away, sphere raycast-faced toward camera), not
  an animation through it. `advanceSingularityScene`'s existing chrome-
  suction block gained one line (`if (s.phase === PHASES.SPHERE)
  updateChromeSuction(s, 1)`) to snap the masthead/dock to their fully-
  sucked-away state on that first post-entry tick, since no collapse ran
  to do it frame by frame. Verified in `tests/e2e-singularity.mjs` for the
  non-eligible (manual end) path only — the dialog doesn't appear and New
  Game still resets in one click. The eligible (real win) path is NOT
  covered by an automated test: forcing an actual win through this game's
  3D screen-coordinate piece-picking (see e2e-gameplay.mjs's own
  candidate-point sweeps, needed even for a single known move on the
  standard board) turned out to require either multi-turn navigation
  around obstructing pieces or a randomized MATTER-roster placement with
  no test hook for piece positions — assessed as disproportionate effort
  for this pass. Verify RETAIN/RECONFIGURE manually (or extend the test
  with a real win, e.g. via a reduced-roster race to `GOAL_ROW`) before
  relying on it in production.
- **Post-game win overlay tap-to-toggle, unified across the placard AND
  the RETAIN/RECONFIGURE dialog above (both themes, not Neon-only —
  extended scope, decided explicitly).** The Victory placard already
  dismissed on backdrop click/Escape without resetting the game; it just
  had no way back except the dock's own separate post-game row. Board
  taps were a complete no-op post-game (`!isPlaying` early-return in the
  main input handler), which turned out to be the exact ready-made hook:
  a new branch ahead of that early-return, gated on `status ===
  "finished"` and the SAME `wasAltPan`/`wasDrag` classification the
  handler already computes (so orbiting the camera to inspect the board
  never accidentally reopens anything), fires on ANY board tap — piece or
  empty square, doesn't matter, since no piece-selection logic runs
  post-game anyway. The placard and the RETAIN/RECONFIGURE dialog are
  treated as ONE conceptual overlay with a single dismissed/shown state
  rather than two independent toggles: `lastPostGameOverlayRef` ("placard"
  | "choice") records which one was last showing, kept current by the
  win-transition effect (always "placard" — a win always opens there
  first) and by `handleNewGameClick` (flips to "choice" when it opens the
  dialog, which now also explicitly closes the placard first — the same
  "close the one overlay before opening the next" pattern the placard's
  own Move Log button already used, but a gap in the original #40 pass
  since the placard's New Game button can reach this while still open). A
  board tap reads only that ref, not the overlays' own booleans — reaching
  the tap handler at all already proves whichever overlay wasn't showing,
  since each one's own full-screen backdrop (`pointerEvents:"auto"` while
  open) intercepts every pointer event ahead of the canvas underneath.
  Escape now dismisses whichever of the two is open (was placard-only
  before). The separate Move Log POPUP (opened from the placard's own
  Move Log button — the table of moves, not the placard itself) is
  intentionally NOT part of this toggle: dismissing it leaves
  `lastPostGameOverlayRef` untouched (still "placard"), so a board tap
  after backing out of the log returns to the placard one level up, not
  back into the log — reads as "step back," not "reopen exactly what I
  had." NOT covered by an automated test, same root cause as the
  RETAIN/RECONFIGURE dialog above (both only ever exist post-`"finished"`,
  which nothing in this test suite can currently reach) — verify manually,
  or extend together once a real-win test path exists.

## 3c. Singularity cinematic transition (Neon-only) — Part 1 of SINGULARITY_DESIGN.md, BUILT

Holding the revealed Singularity button to commit no longer just opens a
static "coming soon" info card. It now runs a real collapse → hard-cut-
to-black → draggable Fresnel-glow sphere sequence, in a new module,
`themes/neon-singularity.js`, kept separate from `themes/neon.js`
(already 6000+ lines) rather than inlined.

- **The bridge is a plain object on `three.current`, not React state.**
  `useSingularityPhase` (called from `useSetupExtras`) owns the React
  `phase` state the DOM overlay renders from, but the actual per-frame
  3D animation runs inside `mountAmbientEffects`'s existing tick — a
  *different* hook invocation, in a different closure. Both close over
  the *same* `three.current` object (chassis-owned, mutated in place,
  never reassigned after initial scene setup), so `t.singularity = {...}`
  written by one is visible to the other with zero new chassis-to-theme
  event/callback plumbing. `advanceSingularityScene(t, now, chromeRefs)`
  is the function mounted into that tick; see its call site in
  `themes/neon.js`'s `mountAmbientEffects` right before
  `renderer.render(...)`.
- **Two additive chassis changes, both in `chassis/ElCabeza3D.jsx`**:
  `three` is now also passed into `theme.useSetupExtras(...)`'s call
  (previously only `mountAmbientEffects` got it) — needed for
  `commitSingularity` to reach the bridge object at all; and `cam` is
  now passed into `mountAmbientEffects`'s helpers alongside `three`,
  for a possible future camera move during collapse (currently unused —
  everything shipped works through `three` alone).
- **The funnel warp is a NEW mesh, not the live board warped in place.**
  The real slab (`BoxGeometry`) and grid (raw 2-vertex `LineSegments`
  per line) don't have the vertex density for a smooth curve. A
  lazily-built, subdivided `PlaneGeometry(64,64)` with a custom
  `ShaderMaterial` (`wireframe:true`) fades in as the real grid's
  opacity fades out. This is the **first custom shader in this
  codebase** — same for the sphere's Fresnel-rim `ShaderMaterial`.
- **The hard cut is genuinely same-frame.** `cutSingularityAudioToSilence()`
  (new, in `themes/neon.js`'s `createSoundscape()`) zeros the single
  shared `master` gain node — silencing every bus (hum/ambient/events/
  sfx) in one call — and hard-stops the hum's oscillators immediately
  (unlike `stopSingularityHum`, which deliberately lets a 7.5s tail
  ring — the opposite intent). This fires in the exact same synchronous
  branch that snaps the black overlay div's opacity to 1 with
  `transition:"none"`, inside `advanceSingularityScene`'s
  collapsing→blackout transition — never split across two frames/
  effects, or the screen and the silence visibly disagree.
- **Pieces are moved by direct mesh mutation** (position/scale/
  quaternion), a new array (`t.singularity.collapseItems`) captured
  once at collapse start — deliberately NOT the chassis's `anim.current`
  (a single-slot, one-piece-at-a-time mechanism, wrong shape for ~10
  pieces converging at once). Because this bypasses the normal
  pieces-state render path, **nothing else restores piece transforms
  afterward** — the escape hatch (`teardownSingularityScene`) must
  explicitly copy every piece back to its captured base
  position/scale/quaternion, or they're left tiny and displaced. Found
  by actually taking a screenshot after Escape and looking at it, not
  by the phase-transition assertions alone — a real lesson: this
  feature's correctness lived in visual/manual checks Playwright's
  `data-*` assertions couldn't have caught (also true of the "black
  overlay never fades back down for the sphere phase" bug, and the
  "masthead/dock chrome still shows through the transparent overlay"
  bug — both only visible in an actual screenshot, both fixed here).
- **Masthead + dock chrome must be hidden explicitly.** The overlay div
  only covers the 3D canvas; the masthead/dock are separate DOM layers
  stacked above the canvas but below the overlay's own z-index, so once
  the black cutout fades transparent for the sphere reveal, they show
  through unless faded out too. `advanceSingularityScene` takes
  `chromeRefs` (`{titleWrapRef, cardRef}`, the same refs
  `mountAmbientEffects` already receives) and fades their opacity once
  per collapse start, restoring them in the escape hatch.
- **Test hooks** (Playwright can't read Three/Web-Audio internals):
  `data-singularity-phase` on the overlay root; `window.__EC_TEST_MASTER_GAIN__`
  mirroring the real `master.gain.value`, written at every place it
  changes; `window.__EC_TEST_SINGULARITY__.sphereRotationY` for the
  drag-rotate assertion. See `tests/e2e-singularity.mjs`.
- **No longer accurate, kept for history**: the line below used to say
  the sphere carried only placeholder DOM text. That's since been
  replaced by a real UV-mapped, raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — see §3d.
- ~~Deliberately out of scope, per an explicit decision recorded in
  SINGULARITY_DESIGN.md: the sphere's surface is simple placeholder
  DOM text, not the real UV-mapped/raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — those rules systems don't exist yet.~~

## 3d. MATTER/LAWS/TOPOLOGIES sphere menu (Part 2 of SINGULARITY_DESIGN.md) — menu BUILT, rules mostly NOT

The sphere's surface now carries a real canvas-texture UV-mapped menu
(`themes/neon-singularity.js`), raycast-hit-tested against the actual
rotated geometry — not a flat DOM overlay. Root labels (MATTER/LAWS/
TOPOLOGY — note singular "TOPOLOGY" as displayed text, `topologies` is
still the internal key) sit at three fixed, evenly-spaced longitude
slots; `shuffleRootLabels()` re-rolls which label occupies which slot
on every fresh hold-to-commit entry, so the arrangement (and which one
greets the player front-and-center) is different each time. Tapping a
label opens a real holographic DOM overlay with its actual sub-items
(checkboxes for LAWS/MATTER's new pieces, drum rollers for MATTER's
roster counts and TOPOLOGY's rows/cols) — `renderCategoryOverlay` in
the same file. A triple-tap on bare sphere (outside any label's hit
band) finalizes to a summary menu with real Opponent/AI controls
wired straight to the chassis's own state (not a re-implementation),
then a real Begin Game.

**What's actually wired to gameplay vs. still just UI:**
- **MATTER — rectangular pieces only, wired and real.** The roster
  (up to 2 Cabeza, plus 1×3/2×3 block toggles) is applied via
  `applyMatterRoster`/`buildRosterFromSelections` in `themes/neon.js`,
  which builds a real `{type,count}[]` roster for the existing
  `generateAnomalySetup`. L-Pentomino and Arch (MATTER's two
  non-convex piece types) are selectable in the UI but **inert** —
  a deliberate scope decision (rectangular pieces only), since
  non-convex collision needs the footprint-mask generalization
  SINGULARITY_DESIGN.md describes and that hasn't been built.
  2-Cabeza-per-side games work correctly end to end: reaching goal
  with either Cabeza wins instantly, crushing one doesn't end the
  game unless it's the last one (`crushEndsGame` in `engine/ai.js`,
  generalized from what used to assume exactly one Cabeza per side —
  see `endsGame` vs. the older `crushes`/`wins` fields).
- **TOPOLOGY — selection UI is real (drum rollers, clamped to the
  engine's own `MIN_BOARD_DIM`/`MAX_BOARD_DIM`), but choosing a size
  and pressing Begin Game does NOT currently resize the actual board.**
  `setBoardDimensions(rows, cols)` (§3b) updates the live
  `BOARD_ROWS`/`BOARD_COLS` bindings other modules read, but
  `chassis/ElCabeza3D.jsx`'s entire 3D scene (slab/grid geometry,
  camera framing) is built in a **mount-once `useEffect` with an
  empty dependency array** — calling `setBoardDimensions()` after that
  effect has already run updates the game's *logical* dimensions
  without touching the already-built geometry, producing a
  size-mismatched board. Actually wiring this needs the chassis to be
  forced through a full remount with the new size already set (e.g. a
  `key` prop keyed on `${rows}x${cols}` on whatever renders
  `<ElCabeza3D>`, in `apps/neon.jsx`/`apps/unified.jsx`) — a real,
  deliberately-scoped-out feature, not a quick add. Assessed directly
  with the user and explicitly deferred; later dropped entirely ("forget about this").
- **TOPOLOGY — Missing Squares, wired and real.** One to five pairs of
  rotationally-mirrored squares (see "Up to five Missing Square pairs"
  below) (same manual-pick-plus-180°-mirror model as Black
  Hole Squares, same ghost-grid picker reused via a `kind` param —
  `PAIRED_SQUARE_KINDS`/`renderPairedSquarePicker`/`renderPairedSquare-
  PlacementRow` in `themes/neon-singularity.js`) that are simply
  impassable: no wormhole, no teleport, no crush, just a square no
  move's footprint may ever overlap. Deliberately placed under
  TOPOLOGIES rather than as a LAW — it changes the board's playable
  shape, not a movement rule — toggled via `selections.topologies.
  missingSquares`, placement in the separate top-level `selections.
  missingSquare` (`{ spots, count }`) (same split reasoning as `blackHole` not being
  nested under `laws`). Engine: `MISSING_SQUARES` (`engine/
  constants.js`, mirrors `BLACK_HOLES`'s plain-module-state pattern
  exactly, including the AI worker's own cross-boundary thread —
  `engine/ai-worker.js`, chassis's `runAiSearch`); `missingSquareAt`/
  `overlapsMissingSquare` checked at both chokepoints every move type
  funnels through (`evaluateBlockLanding`, `translatedCandidate`,
  `engine/rules.js`) — including a wormhole's own ejection square, so
  Black Hole Squares can never eject a piece onto one. Placement:
  `pickMissingSquares`/`pickBlackHoleSquares` now share one internal
  `pickPairedSquares(pieces, rows, cols, avoid, attempts)`, and
  `buildMissingSquaresPlacement`/`buildBlackHolePlacement` share
  `buildPairedSquarePlacement` — resolved in `finalizeSingularityBegin`
  with Missing Squares FIRST, so Black Hole Squares' own resolution
  (when both are active) treats Missing Squares' cells as reserved too;
  the reverse is not needed since Missing Squares always resolves
  first, but the `avoid` param on both is symmetric either way. Visual
(second pass — the first, a tall stack of additive-glow box segments
rising ABOVE the square, was rejected as too distracting in play; nothing
may rise above the board): a flush on-square overlay whose 16x16 sub-tiles (mostly black/dark grey, ~4% silver, each re-rolling every ~0.8-1.8s)
keep reshuffling through blacks/greys/silvers (small ShaderMaterial,
uTime driven by the effect's own rAF loop), plus ONE continuous open
square tube of semi-opaque black below the slab, alpha fading with depth
in its shader — only visible if the camera tilts under the board. Tapping
a Missing Square with a piece selected plays `playBlocked` (Neon: two
soft low sine blips, Eb3->C3, a falling minor third; Standard: no-op) and
keeps the selection. **No piece can ever start on a Black Hole or Missing
Square:** `applyMatterRoster` returns the pieces it just placed and
`resolvePairedSquares` places both features against THOSE (not the
render-time `pieces`, which is stale right after a `setPieces`); a New Game
replay re-randomizes the roster around the previous squares
(`generateAnomalySetup(roster, blocked)`, which seeds each blocked cell
and its mirror as occupied) and re-resolves the squares if any piece still
lands on one; the pre-game Anomaly button also avoids the live
`BLACK_HOLES`/`MISSING_SQUARES`. Verified in
  `tests/engine.smoke.mjs` (Cabeza step onto one refused, others legal;
  a block's landing footprint overlap refused, clear landing legal; a
  wormhole ejection onto one refused; `pickMissingSquares`'s `avoid`
  list respected) and `tests/e2e-singularity.mjs` (the sphere UI same
  depth as Black Hole Squares' own coverage, PLUS one the black hole
  test doesn't have: an actual Begin Game with Missing Squares on,
  checked via a new `window.__EC_TEST_MISSING_SQUARES__` hook, with a
  real AI opponent searching a turn against the live board — proves the
  full pipeline end to end, not just the picker UI in isolation).
- **Sphere arrival, help "?", bell tail.**
  - **North pole faces the player on arrival.** `faceSphereNorthPole`
    (neon-singularity.js) turns the sphere's parent `s.sphereFrame` so
    the camera sits on its +Z side. It spins the level sphere so the front
    root label faces the camera, then tilts `rotation.x` by
    `atan2(horizontalDist, dy)` so the pole meets the camera's line of
    sight. The front label is edge-on at the rim, so dragging upward brings
    the categories round. Because of the frame, the drag and tilt now read
    the same from either side of the board. Test hook: `northPoleFacing`
    (1 = dead on). The e2e tilts back to the equator (`tiltBackToEquator(0.05)`)
    before tapping labels.
  - **Instructions are hidden behind a faint "?"** at the bottom middle
    (`LabelsHint`, testids `sphere-help-button` / `sphere-help-text`). Hover,
    focus or tap shows the text. The "?" stops pointer events, so it never
    drags the sphere or counts toward the triple-tap.
  - **The bell rings out past the cut to silence.** `playSingularityBell`
    (neon.js) routes through its own `bellReverb` → `bellBus` →
    `ctx.destination`, bypassing master. Its gain is `BELL_BUS_GAIN`
    (sfxGain × MASTER_GAIN, the same level as before), and `setMuted`
    follows it. `cutSingularityAudioToSilence` still zeroes everything
    else, while the toll and its ~11.5s reverb decay to zero on their own.
  - **Bell clipping check: `tests/audio-bell.mjs`** (in `npm test`). Before
    the page loads, it re-routes every connection to `ctx.destination`
    through ScriptProcessor meters, one per source (master bus, bell bus)
    plus the final mix. It then triggers the Singularity and counts every
    sample at or above ±1.0 over 26s. Set `EC_AUDIO_TIMELINE=1` for
    per-0.25s peaks.
    - First measurement: the bell peaked at about +9 dBFS and clipped for
      its first ~6s, mostly from the reverb build-up.
    - Fix: `BELL_BUS_GAIN = 1.25 × MASTER_GAIN × 0.24`. The bell alone
      now peaks at 0.59-0.82 (it varies because the reverb impulse is
      random noise), and the final mix at ≤0.85, with zero clipped samples.
    - The test fails on any clipped sample or a mix peak ≥ 0.95.
  - **Bell tone.**
    - The "bong" was lowered from 4.7× to 3.73× the 66Hz prime (310 →
      246Hz). Its two triangle voices now sit 2.4% apart, and a third
      voice a tritone above was added.
    - Added disharmonic partials: 1.013× (a slow ~0.9Hz beat against the
      prime), 1.414× (a tritone), 2.12× (a minor second against the
      nominal) and 3.37× (a stray overtone).
- **CONFIGURATIONS — saved rule presets, BUILT.** A fourth sphere label
  fixed at the **south pole** (the three categories stay on the equator).
  It is NOT painted into the sphere's equirectangular text texture (text
  smears at a pole) but its own canvas-textured plane, parented to a pivot
  that cancels the sphere's left/right spin every frame so it always reads
  upright when the pole is tipped toward the camera (drag UP). Tap-tested
  before the sphere itself in `handleSphereTap`; mouse hover shows a
  "saved presets" tooltip (touch: the overlay's own "Saved presets"
  subtitle). Opens the `configurations` category overlay
  (`renderConfigurationsBody`): name + "Save current", list with Load /
  Delete (inline confirm). Storage: `localStorage["el-cabeza:configurations"]`
  = `[{id,name,savedAt,selections}]`, guarded. A configuration is the
  RULES only (LAWS, MATTER, TOPOLOGY, hand-placed Black Hole / Missing
  Square spots), never the opponent. Saving under an existing name
  (case-insensitive) replaces it. Load runs `normalizeSelections` (merge
  onto today's defaults key by key, so older saves survive new options),
  then jumps straight to the BEGIN GAME summary, which shows a
  CONFIGURATION line until a category is edited. `teardownSingularityScene`
  now also levels the sphere (`rotation.x = 0`) — without it, a visit that
  tipped up to the pole made the NEXT visit open pole-first with the
  equator labels out of view. Covered in `tests/e2e-singularity.mjs`
  (drag to pole, hover hint, save, change, load restores exactly + lands on
  summary, delete with confirm).
- **"Random" placement is a real spot rolled at setup time**, not a
  deferral to Begin Game (that deferral made a random spot invisible to the
  other feature's picker and read as "random lost my selection").
  `fillPairedSpots` (neon-singularity.js) stores concrete spots marked
  `random: true` — rolled on the player's side, off the standard opening
  for the chosen board size (`initialPiecesFor(rows, cols)` in
  engine/rules.js), off the other feature's squares, and for Black Holes
  out of the back rows. It runs when a feature is switched on, on the
  **Random** button, when the Missing Squares count changes, and again for
  random spots when TOPOLOGY rows/cols change. A hand pick sets
  `random: false`. At Begin Game a randomized MATTER opening is placed
  around the chosen spots (`applyMatterRoster(..., chosenSpots)`).
  **Button names (user's words): "Select" opens the picker and "Random"
  rolls — never "roll"/"re-roll"/"choose spot".**
- **Random lives inside the picker** (user request), not in the placement
  row under the toggle, so the roll shows on the grid as it happens. The
  placement row has just **Select** (plus the Pairs drum). In the picker
  the buttons are **Random · Done · Cancel** (testids
  `missing-picker-random` / `blackhole-picker-random`, `...-done`,
  `...-cancel`).
  - Missing Squares: Random rolls into the draft. Done commits it and
    Cancel drops it.
  - Black Hole: Random changes the stored spot straight away. Done keeps
    it; Cancel (or a backdrop tap) puts back the spot the picker opened
    with (`s.blackHolePickerOrig`). Tapping a square still places it and
    closes.
- **Up to five Missing Square pairs (ten squares).** Shape:
  `selections.missingSquare = { spots: [{row,col,random}], count: 1..5 }`
  (`MAX_MISSING_PAIRS`). Black Holes keep `{ manual, random }`, and the
  generic helpers `pairedSpots`/`setPairedSpots`/`pairedCells`/
  `pairedCount` hide the difference. `normalizeSelections` loads an older
  single-spot save (`{manual, random}`) as one spot with count 1. A **Pairs**
  count drum (`missing-count`, 1-5) sits in the placement block under the
  toggle. Raising it fills new spots at random. Lowering it trims random
  spots first, then hand-picked ones. The **Random** button re-rolls only
  the random spots, or all of them when every spot is hand-picked. The
  Missing Squares picker is **multi-select over a draft**
  (`s.missingSquaresDraft`). A tap adds a spot, and when the draft is
  full a random spot gives way. Tapping a hand spot removes it, and tapping
  a random spot (dashed) keeps it. **Done** commits the draft and fills
  any open spots at random. Cancel or a backdrop tap discards the draft.
  The Black Hole picker stays single-tap and auto-closes.
  **Missing Squares never wall off the board:**
  `missingSquaresKeepPath(missing, rows, cols)` (engine/rules.js) requires
  every non-missing square to be orthogonally connected, with pieces
  ignored. `pickMissingSquares(..., existing)` only accepts pairs that
  pass. `pickMissingSquarePairs` builds `count` pairs. The picker marks
  cells that would wall off the board with a red dash, blocks them, and
  shows a red `missing-picker-wall-note` that pulses on tap.
  `buildMissingSquaresPlacement` at Begin keeps every spot that is still
  valid and replaces the rest with random pairs. `MISSING_SQUARES` is a
  flat list, in [spot, mirror] pairs.
- **Black Holes can never sit in either side's back two rows** (rows 0-1
  and rows-2..rows-1): `blackHoleRowAllowed` in `engine/rules.js` gates
  both random placement (`pickBlackHoleSquares`) and a manual pick
  (`buildBlackHolePlacement` falls back to random if a stored pick is in a
  banned row, e.g. after a board resize); the picker greys those rows out
  and says why. Missing Squares are NOT restricted this way (decided).
- **LAWS — status.** Wired to the rules engine so far: **3 Actions Per
  Turn**, **Slide** (orthogonal only; costs **two action points**, a roll
  costs one — so a normal 2-point turn is fully spent by one slide, while
  "3 Actions" (3 points) leaves exactly one point for a single follow-up
  roll. **Opa** is no longer budget-limited — every piece has the same
  2/3-point budget — but an **Opa MOVE (roll OR slide) costs two points**
  (`OPA_MOVE_COST`, `moveCost`), and `legalMovesFor` offers an Opa no move
  when fewer than two points remain. So an Opa moves at most once per turn
  even with a 3-point budget (its second move is never affordable), and
  its 2-point budget lets it slide in a plain Slide game too. The wormhole
  still ends the turn outright. Interactively a slide is a press-drag of
  the piece one
  cell, armed BOTH on a fresh piece and after a roll — the drag-slide and
  the mid-turn undo-drag now coexist on the already-moved piece, with
  onMove disambiguating by direction: a drag clearly back toward the
  start square undoes, any other direction snaps to a slide, so
  roll→slide works under 3 Actions), **Diagonal Slide** (a 6th toggle
  that adds diagonals to Slide), and **Black Hole Squares** (always two
  linked wormholes; entry gated on a 1-cell ground footprint; a wormhole
  entry EJECTS the piece one cell past the far hole on the same relative
  side it entered — `farHole - travelDir` — never landing on a hole,
  crushing a lone enemy Cabeza at the ejection square **only when a block
  is entering** (a Cabeza can never crush a Cabeza — enforced in
  `pieceOccupancyVerdict`, so a Cabeza whose ejection square holds an enemy
  Cabeza can't enter that wormhole), illegal if that square is off-board or
  blocked). **Split Movement** is **built for the human player**: the turn's
  point bank (`turnBudget()` — 2, or 3 with 3 Actions) may be spent across up
  to `MAX_PIECES_PER_TURN` (=2) DISTINCT pieces instead of one. The single
  shared decision is `turnContinues(pieces, player, movedPieceIds, cur, used,
  budget, split)` in `engine/rules.js` (no-split → original per-piece rule;
  split → also stays open when a point remains, <2 distinct pieces moved, and
  some other own piece can move). Chassis: `movedPieceIds`/`pendingSteps`
  state track distinct movers + a piece-tagged step record (so the move log
  names each piece — `makeStepEntry` — and undo animates each piece's own
  moves in reverse, both `handleUndoTurn` and `handleUndoLastTurn`); the
  pointer handler lets the player select a second eligible piece mid-turn
  (`ACTIVE_LAWS.splitMovement && currentPlayer !== aiPlayer`, bank>0, cap not
  reached). **The AI splits too.**
  - With the law on, `generateTurns` also calls `generateSplitTurns`
    (engine/ai.js). It walks every sequence of steps that spends the shared
    bank across at most two distinct pieces: A-B, and with 3 points also
    A-A-B, A-B-A and A-B-B. Any prefix is a complete turn, and a
    game-ending crush/win or a wormhole ends it.
  - Pruning:
    - A turn where either piece ends where it started without crushing
      anything is dropped, because it is really a one-piece turn.
    - Turns with the same end state (moved pieces' final states plus
      crushes) are kept once, so A-then-B and B-then-A don't double up.
  - Split turns carry `steps: [{piece, pieceId, dir, move}]`.
    `applyTurn`/`undoTurn`/`moveKey` handle them, and `findBestAiTurn`
    returns `steps: [{pieceId, dir}]` alongside `pieceId`/`dirs`.
  - Chassis:
    - commit uses `splitOn` (the law) for both sides, with
      `turnBudget()` and `turnContinues(..., split)`.
    - The AI effect plays `aiDirsRef.current.planSteps` by index `next`.
      It counts steps, not points, which also fixes a latent slide
      mismatch in the old `stepsUsed < dirs.length` check.
    - Before a step on a different piece it `setSelectedId`s that piece
      (like a human's mid-turn tap), so the shared bank and log carry over.
  - Branching: at the opening, 13 → 23 turns (2 points) and 39 → 92
    (3 points).
  - Tests:
    - `tests/engine.smoke.mjs` replays every generated two-piece turn
      legally over random games, with and without 3 Actions + Slide.
    - `tests/e2e-ai-split.mjs` boots with `window.__EC_LAWS__ =
      { splitMovement: true }` (the test-only hook `applyBootstrapLaws`,
      apps/boardBootstrap.js), watches the AI play a real two-piece
      opening turn, and reads `window.__EC_TEST_TURNS__` /
      `__EC_TEST_LOG__`. Verified headlessly via `turnContinues` cases in
  `tests/engine.smoke.mjs`; two-piece touch feel wants real-device play.
  **Cantilever Pivot** is not built yet (its LAWS checkbox is inert).
  Its old blocker is gone: odd-shaped pieces exist now (the Codo, see
  the shape system below), so a Codo balanced on one cube is the first
  piece that can pivot.
- **Shoving LAW:** built — see "Shoving LAW" below.
- **Black Holes + future irregular pieces (L / Z / S):** the current
  wormhole-entry gate is "ground footprint is exactly one cell"
  (`cells.length === 1`). Irregular pieces will be able to have a single
  grounded cell while their standing body/shadow overhangs neighbouring
  cells — those must NOT be wormhole-eligible. When irregular pieces are
  added, the entry check must test the piece's full occupied shadow, not
  just its ground contact.

**Failed/rejected approach — sphere label vertical positioning (add to
§12 too):** getting the MATTER/LAWS/TOPOLOGY words to sit on the
sphere's own equator took three wrong turns before landing on the
right model, each shipped and each reported back as still wrong by
the user with real device video evidence — worth reading in order so
the same ones aren't retried:
1. A hardcoded `v` constant (0.7, picked by eyeballing one viewport)
   — read as too high on some devices, wrong on others, because
   camera framing genuinely varies by viewport/device.
2. Raycasting the viewport's own center (NDC `(0,0)`) each time the
   sphere settled, and using that hit's `uv.y` as the label center —
   better, but conflates "center of the viewport" with "center of the
   sphere's own on-screen silhouette," which differ whenever
   surrounding UI (the BACK button vs. a taller hint bar) pushes the
   sphere off-center within the viewport.
3. Projecting the sphere's own world position to NDC first (fixing
   #2's conflation), then **recomputing that raycast every frame** so
   the label band would "always track wherever the camera is
   looking." This was based on a real fact (vertical drag really does
   pitch the sphere via `rotation.x` — a comment claiming no such
   rotation existed was simply wrong) but drew the wrong conclusion
   from it: re-picking which latitude to paint the text on every
   frame made the words visibly **compress toward the poles** as the
   sphere tipped, since each frame sampled a different, more
   pole-adjacent ring instead of the same ring just rotating away.
   The user's own description of the desired behavior (a real video,
   plus explicit correction) was the actual unlock: the words belong
   at a **fixed** latitude, painted once; dragging should tilt the
   whole sphere rigidly, words included, exactly like a globe, until
   tilted far enough to rotate them out of view near a pole.
4. **The actual fix**: `LABEL_CENTER_V = 0.5`, a plain constant, no
   raycast at all — `THREE.SphereGeometry`'s default UV mapping puts
   the equator at exactly `v=0.5` for a standard full sphere,
   independent of camera or the sphere's current rotation. Every
   earlier attempt was solving a different problem (matching wherever
   the *camera* looks) than the one actually asked (matching the
   sphere's own *geometric* equator) — those only coincide by
   accident, and don't for an elevated/tilted camera (inherited
   unmodified from the board's own viewing angle), which is why they
   kept reading as "too high."

## 4. Performance work already done (don't undo without reason)

- **Piece mesh diffing**: the "build pieces" effect used to dispose and
  rebuild every piece's mesh+shell on every state change. `commitRef`'s
  `setPieces` preserves object identity for pieces a move didn't touch,
  so a piece-id-keyed cache now skips rebuild for anything unchanged —
  O(pieces that changed, usually 1-2) instead of O(all 10). Call sites
  that don't preserve that identity invariant (undo, history-jump, New
  Game) safely fall back to full rebuild — this is intentional, not a
  gap to "fix."
- **AI off the main thread** (§3) — Hard-tier search would otherwise
  freeze all rendering (camera easing, ambient FX, even the just-landed
  piece's tail animation) for up to 4.3s.
- **React production build** (§2).
- **Piece fillet tessellation** `seg=6` (was 8) in `makeRoundedBox` —
  analytically verified the fillet's sagitta error is still <0.07% of
  piece size at both themes' `EDGE_RADIUS`, and visually confirmed no
  faceting at extreme close-up. This was a measured decision, not a
  casual guess — don't lower further without the same rigor (analytic
  check + close-up screenshot in both themes).
- **Dock preview render loop fully paused** while its panel is open
  (`dockView === "panel"`) — that tiny scene was rendering every frame at
  opacity 0 (fully invisible) for no reason.
- **Neon per-frame FX loops** (crawling mass, digital glitch — up to ~40
  live voxels across overlapping generations) use plain indexed loops,
  not `.forEach` with destructuring, to avoid per-item-per-frame closure
  allocation.
- Camera clamp math (§5) uses a 24-step numerical bisection per frame for
  the vertical visibility check — confirmed cheap ("a couple of trig
  calls each") and deliberately chosen over a closed-form approximation
  that was tried and failed (§8).

## 5. Camera/input system — fragile, recently fixed, verify rigorously if touched again

Fully custom (not Three.js `OrbitControls`): `theta`/`phi` orbit,
`target` pan, `radius` zoom, all eased via a `goal` (what input wants)
vs. `view` (what's rendered) split with frame-rate-independent damping
(`1 - e^(-dt/1000 * damping)`). Gestures: single-finger/mouse drag orbits
(theta/phi); **pan** requires two-finger drag on touch or Alt+drag /
right-drag on desktop (`ev.pointerType !== "touch"`) — a plain mouse drag
in a test will orbit, not pan, which looks like "nothing happened" if you
forget this. Two-finger swipe up/down toggles Current Player View /
Top-Down View; two-finger double-tap toggles fullscreen; a second
`contextmenu` within the double-tap window gets touch-gesture parity on
desktop. (The trackpad two-finger flick, read from wheel bursts, is gone:
the wheel only zooms, see "The wheel only zooms".)

**Full screen off the board, and at the first tap.** The canvas's gesture
code only sees touches on the canvas, so anything covering it (Tienda's
box lid and order form, the dock, pop-ups) swallowed the double-tap. A
document listener (touch events, capture, passive) recognizes two-finger
taps that start anywhere else, with the same thresholds (module-level
`TWO_FINGER_TAP_MAX_MS` / `TWO_FINGER_TAP_MOVE_PX` /
`TWO_FINGER_DOUBLE_TAP_MS`), and skips touches on the canvas so one
double-tap never toggles twice. Both recognizers time taps by
`ev.timeStamp` (when the fingers touched), not `performance.now()` in the
handler: a busy frame delays handlers, not fingers. (In the tests, CDP
touches each take ~0.5 s to be handled on SwiftShader, so
tests/e2e-fullscreen.mjs gives them explicit timestamps.) Note a closed
dock panel is `pointer-events: none`: touches over its buttons reach the
board. `theme.fullscreenOnFirstTap` (Tienda): browsers only allow full
screen from a tap/click/key, so the first trusted click anywhere requests
it, once a visit (module-level `fullscreenOffered`), not if a
fullscreenchange came first (the player chose), not on the full screen
button itself (`data-fullscreen-toggle`), and not within 600 ms of a
two-finger contact.

**The board-visibility clamp is a hard product requirement** ("no more
than 25% of the board may ever be fully out of view... at ANY tilt
angle"), re-evaluated every frame on the `goal` (not just at pan time,
since radius/phi can change independently afterward):
- Horizontal (XZ): circular clamp, `MIN_VISIBLE_FRACTION = 0.5` (≥50%
  visible).
- Vertical (Y): `BOTTOM_MIN_VISIBLE_FRACTION = TOP_MIN_VISIBLE_FRACTION =
  0.75` (≥75% visible, i.e. ≤25% out of view), asymmetric internally
  (panning up vs. down affect the frustum differently) but the same
  floor both directions.
- The two axes are **coupled elliptically**, not independently clamped —
  a confirmed real bug showed a diagonal drag satisfying both checks
  independently while still pushing the board almost fully off-screen,
  because each check implicitly assumed the other axis was at zero.
  Horizontal keeps its full independent budget; vertical's budget shrinks
  as horizontal usage grows. Any future camera-clamp change must consider
  this coupling, not just re-verify each axis alone.
- Vertical is solved **numerically** (bisection against real ray/plane
  intersection — `boardVerticalOverlapFraction`/`clampVerticalTarget`),
  not a closed-form formula. A closed-form attempt
  (`maxPanDistance/sin(phi)`) was tried and **failed every test** in a
  real radius/phi grid check (reported "0% visible" as safe). Don't
  reintroduce a closed-form approximation here.
- **Just fixed this session**: the horizontal clamp derived its safe
  radius from the camera's *vertical* FOV only, applied uniformly in
  every pan direction. On a narrow/portrait phone the true horizontal FOV
  is much smaller than vertical, so the clamp measured against the wrong
  (wider) axis and let a pan push the board **fully off-screen**
  (reproduced from a real OnePlus 8T recording; confirmed fixed on that
  device). Fix: use `min(vertical halfFOV, aspect-derived horizontal
  halfFOV)` when computing `groundHalfSpan`. Confirmed mathematically
  inert at aspect ≥ 1 (pixel-identical desktop screenshots before/after)
  — if this code is touched again, re-verify both a narrow-portrait
  viewport AND a square/desktop viewport, not just one.
- **The rooms look around (user's explicit instruction, Sep 27):** "I
  can't really move around in the room at all... panning feels far, far
  too restrictive", and asked, the user chose to let the den and the store
  look around: zoom closer, pan anywhere over the board and out into the
  room, the board may leave the screen, Reset view brings it back; Neon
  keeps its limits. A theme sets `freeCamera` (standard.js `{ zoomMin:
  4.5, reach: 70, yMin: -8, yMax: 30 }`, tienda.js `{ zoomMin: 4.5,
  reach: 60, yMin: -14, yMax: 30 }`): the per-frame clamp is then only a
  reach (the target within `reach` of the board's middle across, between
  yMin and yMax up and down, inside the room's walls), and pinch/wheel
  zoom go in to `zoomMin` instead of ZOOM_MIN. Every other theme (Neon,
  Cromo, Lluvia, the Lab's) keeps the 50%/75% clamp above unchanged.
  A room may also let the camera further out than ZOOM_MAX_FOR_BOARD
  (`freeCamera.zoomMax`, the larger of the two wins; the store's is 82,
  "The store's standee and the den's chair" below); zoom-reactive audio
  stays on the board's own range (clamped at 0 past it).

Other camera facts: near plane raised `0.1 → 1` (fixes a depth-sort
flicker during rotation, 10x tighter near:far ratio); max pitch capped at
`1.25` rad (was `1.45`) specifically to stay clear of a Neon
translucent-piece depth-sort artifact at grazing angles (§7, not fully
fixed at the rendering level, this is the accepted mitigation). Pre-game
camera auto-fits between masthead and dock (bisects on vertical gap AND
horizontal width, board capped at 84% viewport width) and vertically
centers within that band; `handleReset` sets `theta`/`phi` to the same
literal defaults a fresh page load uses, deliberately NOT via
`topDownView()` (which sets an unrelated near-vertical `phi` that once
leaked into the setup-screen fit and produced a too-close New Game zoom).
Current Player View fits only the current player's own pieces; Top-Down
View fits the whole board plate; both share a `fitRadiusToCorners`
bisection core and are captured once at Begin Game, not live-refit on
window resize. Begin Game now opens every game in **Top-Down View** by
default (changed from Current Player View) and calls `recenterView()`
immediately.

## 6. Dock / interactive piece preview

The bottom dock's idle element is a real 3D preview using the **same**
`theme.buildPieceVisual()` every board piece uses, at true per-type
relative size (`baseScale` is a **fixed constant** derived from the
single largest possible piece across all types — it must never be
renormalized per session to "fill a target size," which was tried and
silently erased the real size differences between piece types). Idle
meander spin; dragging imparts real angular velocity that decays back to
the meander; double-tap/click bounces and morphs into the settings panel;
Begin Game reverses the morph and relocates the piece to a small corner
watermark for the rest of the game (reopen via hover/hold there).

The pre-game click-to-open hitbox is a **per-piece-type proportional
fraction** of the frame — not the full canvas, not a fixed size — because
a square hit target still leaves real slack around an irregular rotating
3D silhouette. Calibrated by **measuring actual rendered pixels**
(WebGL canvas → 2D canvas `drawImage` → `getImageData` alpha bounding
box; must copy within the same `requestAnimationFrame` as the draw, since
this canvas has no `preserveDrawingBuffer` and the backbuffer is gone by
the next microtask) rather than guessing a multiplier — a first guess
(`HIT_TIGHTEN = 0.7`) was reported as still much too large; the measured
value is `HIT_TIGHTEN = 0.4`. If this is ever revisited, re-measure
pixels again rather than re-guess a number.

This hitbox restriction applies **only** to the pre-game deliberate
click-to-open gesture. The post-Begin-Game corner-watermark hover-to-open
gesture (1.6s hold) must stay unscoped by it — reusing the same
footprint-based hitbox there once broke small piece types intermittently
(the watermark is only 100×88px and semi-transparent, and a plain
centered hover could land outside the shrunk box for the smallest
pieces).

## 7. Rendering: Standard vs. Neon piece techniques (genuinely different, not parameterized)

- **Standard**: opaque `MeshStandardMaterial` body + an inflated
  back-face silhouette shell (grown by `OUTLINE_T`, rendered `BackSide`)
  for the outline; its floor sits `SHELL_LIFT` above the board, not flush
  (see "Tienda piece-base outline flicker"). Since the den, Standard and Tienda build their board
  and pieces from the same code, themes/wood-set.js (walnut and olive ash,
  see "Standard: the den" below).
- **Neon**: translucent body (`depthWrite: false`, deliberately — avoids
  a self-z-fighting bug on beveled edges) + a traced `EdgesGeometry`
  outline on a simplified sharp-cornered proxy. Trade-off, not an
  oversight: translucent pieces sort by draw order rather than true depth
  at grazing camera angles, which is *why* max pitch is capped at 1.25
  rad (§5) rather than fixed at the rendering level. The dock preview's
  spinning piece additionally needed a **depth-only pre-pass mesh** (real
  depth, no color) so its outline shell occludes correctly — without it,
  the translucent body's near and far edges both render at once,
  reading as a "trapezoidal double image." If a similar double-image
  artifact appears anywhere else Neon renders a tumbling/spinning piece,
  this is the fix to reapply.

Board-edge outline ring (the thin line around the slab) took **three
attempts** before the real fix: (1) small Y offset → foreshortens into a
visibly floating line at grazing angles; (2) `depthTest: false` →
draws over pieces at ordinary angles (worse trade); (3, kept) a thin
quad-frame **Mesh** (not a Line) with a hardware `polygonOffsetUnits`
depth bias, zero geometric Y offset, full depth testing.
`LineBasicMaterial`'s `polygonOffset` is a **silent no-op in WebGL**
(only `GL_POLYGON_OFFSET_FILL` exists) — this is why both earlier
Line-based attempts were structurally doomed. Don't attempt a
Line-based fix for board-edge z-fighting again.

## 8. Visual/design invariants — keep consistent, don't relitigate

- **Never size responsive text with `transform: scale()`** when the
  original has a `clamp()`/`min()` floor meant to protect legibility — a
  `scale()` shrinks the floor proportionally too, and no multiplier
  choice fixes this (there's always some viewport narrow enough to hit
  the floor). This was tried **at least four times** for the masthead
  corner badge (0.45, a mobile-only 5x, half of that, flat `scale(0.4)`)
  before the real fix: give the smaller element its **own** `clamp()` at
  the target ratio. Full writeup in `ARCHITECTURE.md`'s "Known
  pitfalls." `theme.mastheadScale` (Neon = 1.25, Standard unset) follows
  this correctly — it scales the clamp's own numbers via a
  `mastheadClamp(floor, vw, ceiling, scale)` helper, never a wrapping
  transform.
- Masthead lifecycle: `"setup"` (full size) → `"fading"` (post-Begin-Game,
  briefly near-invisible in place) → `"relocated"` (small corner badge,
  its own dedicated `clamp(16px, 2.8vw, 52px)`, not a fraction/scale of
  the setup formula). `isFullscreen` only ever affects the `"fading"`
  phase's clamp — applying it to `"setup"` too was a real regression
  (masthead incorrectly shrank in fullscreen before Begin Game).
- Dark/light player color must always come from the theme-agnostic
  `bodyDark`/`bodyLight` pair, **never** `charcoal`/`cream` literally —
  Neon's own `charcoal`/`cream` are semantically inverted for its dark
  UI. This exact bug recurred across move-log headers, the turn halo, and
  the AI-side picker's dot before `bodyDark`/`bodyLight` was established
  as the one source of truth. Similarly, the AI-picker dot must use the
  real player color directly, not `currentColor` (which resolves to the
  pill's *text* color — the opposite of the intended meaning).
- Chrome tokens (`modalBackdrop`, `modalSurface`, `canvasGradientStart/
  End`) must come from the theme, never hardcoded literals — caught once
  via a screenshot showing Neon's Move Log popup rendering in Standard's
  cream colors.
- Neon's ambient FX intensity has been tuned **down** repeatedly and
  deliberately, specifically for flashing/seizure-risk reasons (VHS
  glitch interval widened ~30%; crawling-swarm brightness ceiling cut in
  several passes down to 0.26; the newer CRT-aberration family —
  chromatic ghosting, degauss wobble, phosphor trail, curvature ripple —
  was added on smooth easing specifically as *calmer* alternatives on
  their own separate rotation, not merged into the harsher
  hard-cut glitch pool). Default to restraint on any new Neon ambient
  effect, not brightness/frequency.
- **Card-targeted glitches (`fireVhs`, `fireRare`, `fireCrtAberration`) are
  gated on `isVisibleForGlitch(card)`.** `cardRef` is the dock panel
  (`data-testid="dock-panel"`); in-game it's closed by fading to `opacity:0`
  (not unmounted), and a glitch class's own opacity keyframes would override
  that and flash the whole panel back into view — the "dock briefly appears
  mid-game" bug. Only glitch the card while the dock is actually open (same
  gate the button jitter uses). `fireVhs` still fires its screen-wide overlay
  flash + cue regardless (not the dock); `fireRare`'s card-only cue is
  skipped with its visual when the dock is closed.
- Every theme's font must be read from `theme.titleFontFamily` (Neon =
  Chakra Petch via `@import` in `styleSheet`; Standard defaults to
  Fraunces) — never hardcoded on the chassis side; this broke once
  (silently fell back to serif everywhere, including the standalone Neon
  build).
- Move-triggered FX (`pulseSquare`, `spawnGlitchBurst`,
  `spawnLandingShockwave`, `spawnLandingParticles`) are plain optional
  properties a theme writes onto the shared `three.current` object, not a
  formal hook — the chassis calls them with `t.x && t.x(...)` guards.
  Follow this same pattern for any new move-triggered effect rather than
  inventing a new hook shape.

## 9. Audio architecture

Every theme's `createAudio()` interface exposes the **same full set of
methods always** (no-ops where inapplicable) — the chassis never branches
on "does this theme have audio." Both Standard and Neon currently have
`hasAudio = true`.

- **Master-gain-per-subsystem is a hard rule for mute to work.** This was
  violated twice and had to be fixed both times: (a) the unified app's
  theme-switcher SFX (`apps/unifiedTransition.jsx`) originally wired
  every node straight to `ctx.destination` with no master gain at all —
  completely unreachable by the mute toggle; (b) mute state itself was
  getting silently reset on every theme switch because `ElCabeza3D`
  remounts via `key={themeName}` in the unified app. Mute now lives in
  `UnifiedApp` state, **above** the remount boundary, passed down via
  `initialMuted`/`onMutedChange` props (defaulting to `false`/no-op so
  the standalone single-theme builds, which pass neither, are
  unaffected). Any new independent audio subsystem must follow the same
  routing pattern from day one.
- Neon's audio engine splits `ensureGraph()` (builds routing, doesn't
  start the ambient bed) from `ensureStarted()` (also starts the bed) —
  needed so pre-Begin-Game sounds (Singularity reveal, Info overlay
  choir, Anomaly blip) can play without waking the ambient hum meant to
  fade in only after Begin Game.
- `resetWindDown`'s `"sfxOnly"` mode: after New Game, one-off UI cues
  need audio working immediately even though the ambient bed is
  deliberately silent until the next Begin Game. It restores master gain
  but explicitly zeroes `introGain` — the original implementation had
  instead pinned master at 0, which silenced *all* audio, not just
  ambient.
- One-off SFX (`playPowerOn`/`Off`, Singularity, etc.) must call
  `ensureGraph()` and resume a suspended `AudioContext` **themselves**,
  not rely on a prior `beginGameFadeIn()` call — mobile browsers suspend
  the context on backgrounding/lock, which left these silent on mobile
  until this was fixed. A `visibilitychange` listener also proactively
  resumes a suspended context.
- Any audio-graph-starting call must be wired **directly into the
  triggering click/gesture handler**, not fired from a `useEffect`
  reacting to state one tick later — some browsers only allow
  synchronously resuming/building an `AudioContext` within the original
  user-gesture call stack (the Info overlay's choir stab broke this way
  once).

**Standard's wood-impact percussion — do not re-attempt a resonant-filter
approach.** Three full rewrites happened before landing on the current
one:
1. Additive sine tones with per-mode envelopes — reported "wildly off
   the mark," fully reverted.
2. A physically-motivated modal filter bank (resonant bandpass per mode)
   — technically careful DSP, but **a narrow bandpass excited by a broad
   impulse IS a decaying sinusoid**, which reads as metallic
   "boing"/vibrato regardless of how the envelope or gate around it is
   tuned, because the ringing is the filter's own impulse response. Q was
   lowered, fundamentals dropped an octave, tails hard-gated — the
   character never fully left because the mechanism itself was wrong,
   not the tuning.
3. Granular/absorption synthesis (brown noise + dynamic-sweep Butterworth
   "absorption" path) — replaced the resonant-filter architecture
   entirely to escape the pitched-ringing problem at its root.

**Current, kept recipe** (much simpler than any of the above): a
pitch-dropping sine body (150Hz→40Hz) choked by a fast exponential
envelope, a short noise-click transient, and a literal 10-tap
moving-average filter as the muffle stage; `mass`/`velocity`/`contact`/
`board_density`/`wood_dampening` modulate the constants. Public API
(`impact_event`, `roll_sequence`) has stayed stable across all four
attempts. **If asked to revisit this sound, don't reach for resonant
filters/modal synthesis again** — it's been tried twice in different
forms and specifically rejected both times for the same underlying
reason.

## 10. Other solved bugs worth remembering

- `camera.lookAt()` silently corrupts the camera matrix if given a plain
  `{x,y,z}` object instead of a real `THREE.Vector3` (it checks
  `.isVector3`, and failing that calls `Vector3.set(target, undefined,
  undefined)`, producing NaN). This is exactly the kind of bug that makes
  every subsequent "does it fit" check in a bisection search trivially
  return true, collapsing a zoom-fit search straight to `ZOOM_MIN` — real
  root cause of a "views always zoom in far too close" bug that looked
  unrelated on the surface. Any new fit/measurement code must construct
  real `Vector3`s.
- Singularity's intentionally-oversized decorative glow (bleeds past its
  own button) was making its scrolling ancestor show a scrollbar, since
  an oversized absolutely-positioned descendant counts toward scrollable
  overflow even when purely decorative. Fixed with `contain: layout` on
  the button, not by shrinking the glow.
- A missing `cabezaInDanger` import was caught only because the phase-2
  extraction smoke test actually *exercised* `computeTension` rather than
  just checking it imports — a reminder that the smoke tests earn their
  keep by calling real code paths, not just construction-checking.

## 11. Fragile areas / edge cases to tread carefully around

- **Overlay text collisions in tests.** The Victory Placard, Move Log
  popup, and Info overlay are all **always mounted** (opacity/
  pointerEvents toggled, never conditionally rendered), and share
  similar button text ("Move Log", "Copy Move Log," etc.). This has
  caused real Playwright strict-mode ambiguity at least twice. New tests
  should scope by a stable `data-testid` ancestor, not text alone.
- `page.evaluate(() => el.click())` in tests bypasses real CSS
  pointer-events/visibility and can produce a false positive by matching
  a hidden element — this once masked a real self-introduced regression
  (a dock button that had actually been deleted). Prefer real
  `page.locator(...).click()`; reach for the programmatic-click
  workaround (needed for a known sandbox quirk where the full-viewport
  board canvas intercepts real clicks on some absolutely-positioned
  buttons) only alongside a scoped/exact-text selector check too.
- Any WebGL canvas pixel-readback in a test (dock hitbox measurement,
  future visual assertions) must copy into a 2D canvas **within the same
  `requestAnimationFrame`** as the draw — these canvases have no
  `preserveDrawingBuffer`.
- The masthead title is deliberately split into per-letter `<span>`s —
  several Neon effects (scanline `background-clip: text`, phosphor
  ghosting, per-letter flash/desync, raster tear) address individual
  glyphs and depend on this structure; don't collapse it back to a plain
  text node. At very small sizes (the relocated badge) the scanline's
  fixed-pixel stripe period can land entirely on a transparent band and
  make letters vanish — the relocated badge deliberately falls back to
  plain solid text via an `.ec-masthead-relocated` class hook; keep that
  escape hatch.
- Any CSS transform-*animating* class applied to the masthead's **outer**
  wrapper fights React's own inline transform on that same element (used
  for the setup→corner-badge position/scale transition) — glitch/jitter
  effects must animate a separate **inner** ref (`titleFxRef`), never the
  outer positioned wrapper, or a glitch pulse visibly snaps the corner
  badge to full size mid-game.
- The Neon dock-piece "trapezoidal double image" fix (§7's depth-only
  pre-pass) is currently only applied to the dock preview piece — if
  translucent pieces are ever rendered spinning/tumbling somewhere else,
  this same fix will likely be needed there too.

## 12. Failed / rejected approaches — do not retry as-is

1. **Resonant filter bank / modal synthesis for wood-impact audio** —
   rejected twice for reading as metallic "boing"/vibrato, root-caused to
   the technique itself (a decaying sinusoid is what a resonant filter
   IS), not to tuning. See §9.
2. **`transform: scale()` for any responsive text with a `clamp()` floor**
   — tried 4+ times for the masthead badge, always eventually illegible
   on a narrow-enough viewport. See §8.
3. **Tilt-drag pivot re-centering** (re-centering the orbit pivot to the
   board's own center at the start of every tilt/rotate drag) — reverted
   outright, not tuned: it fired on every ordinary rotate drag, discarding
   legitimate prior pan and disrupting normal scroll/zoom feel. If pivot
   drift needs revisiting, don't reach for "recenter on every drag start."
4. **`depthTest: false` for the board-edge outline ring** — draws over
   pieces at ordinary angles. See §7 for the actual fix.
5. **A single shared move-indicator implementation/color across both
   themes** (hardcoded `HEX.charcoal`) — literally invisible on Neon's
   own near-black board. Each theme now owns `buildMoveIndicator`
   entirely.
6. **Closed-form approximation for the vertical camera-visibility clamp**
   (`maxPanDistance / sin(phi)`) — failed every test in a real radius/phi
   grid check. Must stay a numerical bisection. See §5.
7. **Renormalizing the dock preview piece's scale per-session** to fill a
   fixed target size — erased the real size differences between piece
   types, which is the whole point of showing the rolled piece
   faithfully. `baseScale` must stay a fixed constant.
8. **Reusing the pre-game hitbox tightening for the post-game corner
   hover gesture** — broke small piece types intermittently. Keep these
   two gestures' hit-target logic separate (§6).
9. **Raycasting the camera's look direction to position the sphere
   menu's MATTER/LAWS/TOPOLOGY labels** (either at the plain viewport
   center, or the sphere's own projected center, one-shot or
   recomputed every frame) — see §3d for the full sequence of wrong
   turns. The camera's look direction and the sphere's own geometric
   equator are two different things that only coincide by accident;
   the fix was a plain `v=0.5` constant, no raycast involved.

## 13. Hard invariants — do not break without a deliberate, explicit decision

- Theme plugin contract: chassis calls every theme hook unconditionally;
  a theme with nothing to contribute returns `null`/no-ops. Never
  reintroduce "if Standard, skip this" branching in chassis code — that's
  the exact re-accumulation of theme knowledge the refactor eliminated.
- Theme modules stay plain ES modules with **no JSX syntax** (only
  `React.createElement` where JSX-like output is needed) — this is what
  lets the theme smoke tests `import` them directly in Node.
- The build stays **one self-contained HTML file per target** — no second
  network request for the AI worker or anything else.
- `findBestAiTurn`'s `{ pieceId, dirs }` return shape is a stable public
  contract across the worker, chassis, and tests.
- Every theme's audio interface must implement every method (no-op where
  inapplicable) at all times.
- The 50%/75% board-visibility camera clamps are explicit, feedback-
  driven product requirements, not arbitrary defaults — don't loosen them
  without new explicit instruction, and don't "fix" a camera complaint by
  quietly relaxing them. (The one exception is the user's own: the den
  and the store look around, `theme.freeCamera`, §5.)
- `npm test` must pass before any change is considered done.

## 14. Current stable baseline (commit `e58e182`)

Treat all of the following as a safe, verified baseline — don't
casually "improve" it without a specific reported problem:

- Full chassis+theme+engine architecture, all 3 build targets, documented
  in `ARCHITECTURE.md` and verified end-to-end via Playwright.
- Full gameplay loop: setup (opponent/difficulty picker, Anomaly random
  setup, interactive dock piece preview), turn-by-turn play (select/
  move/roll/crush/win, gesture shortcuts for Stop Here/Undo), AI opponent
  at 3 difficulties off the main thread, Move Log (popup-based, Copy/New
  Game actions, scroll-to-expand that stays expanded until reclosed),
  Victory Placard.
- Camera system: orbit/pan/zoom/tilt with visibility clamps verified to
  hold on any aspect ratio (including the just-fixed narrow/portrait
  case), pre-game auto-fit, per-view fitting, full gesture parity
  (mouse/trackpad/touch/two-finger).
- Full audio: Standard's wood-impact percussion (final simplified
  recipe) + Neon's large ambient soundscape, both mute-able and
  mute-persistent across the unified app's theme switch.
- Full Neon ambient FX suite (masthead flicker/scanline/ghosting/glitch,
  turn halo, VHS glitch + CRT-aberration rotations, crawling swarm, 7
  arc/discharge styles, floor wave, digital-interior/voxel-shatter piece
  effects, landing particles/shockwave) — tuned down from original
  intensity across several passes for flashing/seizure-risk reasons.
- Unified app's masthead-hold CRT theme-switcher (CONNECT/DISCONNECT),
  fully wired to real ported SFX, verified mobile-viewport-safe.
- Just-verified fixes this session: Info overlay pinned masthead + full-
  height scroll body; camera horizontal pan clamp fixed for narrow/
  portrait aspect ratios (confirmed on real OnePlus 8T hardware).
- Full regression suite green: `engine.smoke.mjs`, `theme-{standard,
  neon}.smoke.mjs`, `e2e-{smoke,gameplay,ambient,singularity}.mjs`.

## 15. Open thread / logical next step

**"Cabeza [the_system]"** — a proposed **third theme** (not a separate
project) with new game mechanics, explicitly meant to slot into the
existing chassis+theme architecture. The user's own understanding of
this (confirmed correct) was: a new visual theme alongside Standard/Neon,
same underlying framework, with some new rules/mechanics — possibly
related in spirit to Neon's Singularity easter egg. Three concrete
questions were asked and **not yet answered**:

1. Is the working name final, or a placeholder?
2. What's the visual identity/mood (distinct from Standard's warm-wood
   and Neon's cyberpunk-CRT)?
3. What are the actual new mechanic(s)?

**Do not start implementing this without getting those three answered
first** — a new theme module plus possibly new engine/chassis hooks is
a large enough surface that starting on assumptions risks substantial
wasted work. No other explicit backlog exists; recent history (last
~15 commits before this one) has been reactive bug-fix/polish passes on
a feature-complete app, not progress toward a specific queued feature.

## Nova naming
The Unified build (`apps/unified.jsx`) is published as **El Cabeza Nova**
at `dist/el-cabeza-nova.html` (the landing-page button reads "Nova"). The
old `el-cabeza-unified.html` had already been shared, so `build/build.js`
still writes that file, now as a tiny redirect to Nova that keeps any
`?query`/`#hash`. Don't remove the redirect.

## Odd-shaped pieces: the shape system, Codo, Arco, Shoving (user-approved plan)

Agreed with the user, built in this order: 1) shape system, 2) Codo,
3) Arco, 4) Shoving law.

**Shape system (engine/shapes.js).** A piece keeps its bounding box
(row/col/w/h/z). An odd-shaped piece also carries `vox`, a canonical sorted
cube list "x,y,l;…" (x = column offset, y = row offset, l = level). Box
pieces have no `vox` and behave exactly as before.
- **Occupancy is 3D:** `piecesClash` compares per-square level bitmasks
  (`maskAt`). A box fills its footprint from the ground up. This is what
  makes overhangs and openings work: a piece 1 cube tall fits under a
  1-high overhang, and a Cabeza there is sheltered, not crushed.
  `pieceOccupancyVerdict` and `translatedCandidate` (rules.js) use it.
- **Rolling:** `rollVox` turns the cubes about the bbox's bottom edge.
  E: x'=l, l'=w-1-x; W: x'=z-1-l, l'=x; S/N the same on rows. The bbox
  moves like a box's. This is an exact inverse pair (undo relies on it).
  A tight bbox guarantees at least one cube is on the ground.
- **Ground cells only** (`groundCellsOf`) count for Missing Squares and
  Black Holes: an overhang may hang over either. Only a 1×1 piece can
  enter a hole, so odd shapes never do.
- **Swept path:** `rollSweepClashes` samples each cube's quarter-turn in
  the roll plane with a SAT test. It runs only when `anyOddShape(pieces)`,
  so box-only games are unaffected. Consequence: a piece can't ROLL into
  or out from under an overhang (its top edge would swing through it).
  It can get there by a Cabeza step or a Slide.
- `sameState` also compares `vox`; ai.js applyMove/undoMove copy `vox`.
- Rendering (engine/geometry.js, all centered on the bbox like
  makeRoundedBox, so pieceCenter/pivotFor/roll animation are unchanged):
  - `makePolycubeSmooth(piece, unit, radius, grow)`: the body. ONE
    seamless solid with the same rounded edges as a box piece: every
    odd piece is flat (one cube thick), so it is the shape's outline
    swept through its thickness, with exact normals. The cubes only
    explain a piece's size; they must never show as seams (user). Used
    for the chassis body (both themes, EDGE_RADIUS), Standard's grown
    silhouette shell, and the MATTER models. A shape that isn't flat or
    has a hole falls back to `makePolycubeRounded`.
  - `makePolycubeGeometry`: outside faces only, so EdgesGeometry traces
    just the real outline (Neon's shell, the MATTER models' edges).
  - `makePolycubeRounded` (merged rounded cubes): fallback only. It
    showed grooves at the seams, and as Standard's shell those grooves
    cast thin self-shadow lines across the pieces.
- `cubeCount` (weight for landing audio; "bigger" for Shoving).
- Tests: `tests/shapes.smoke.mjs`.

**Codo** (`PIECE_META.codo`, log label "Co") is 3 cubes in an L.
- Poses: standing, flat, or balanced on one cube; all 12 are reached by
  rolling.
- Each roll costs 1 point. It crushes only with a cube landing ON a
  Cabeza. It never drops into a Black Hole.
- MATTER: a roster counter from 0 to 4 (default 0). It replaced the inert
  "L-Pentomino" checkbox.
- Openings: `PIECE_ORIENTATIONS.codo` holds 8 starting poses, each with
  `vox` (standing ×4, flat ×4, never balanced). `generateAnomalySetup`
  mirrors Light's cubes with `mirrorVox`.
- Test-only hooks (set `window.__EC_TEST_HOOKS__`):
  `__EC_TEST_SET_PIECES__`, `__EC_TEST_PIECES__`, `__EC_TEST_MOVE__`,
  `__EC_TEST_SCREEN_POS__`.
- Tests: `tests/e2e-codo.mjs` (a sheltered Cabeza under a real roll; the
  AI with Codos) and the theme-neon smoke test (mirrored openings).

**Arco** is one MATTER counter from 0 to 4 (default 0) plus a size
choice, `matter.arcoSize` ("chico" / "alto" / "ancho"), which applies to
every Arco in the game.
- The size choice is a segmented control (testids `arco-size-*`), and it
  replaced the inert "Arch" checkbox.
- Each size is its own piece type (`ARCO_SIZES` in engine/constants.js),
  each rolling for 1 point:

| Type | Label | Cubes | Size | Opening |
|---|---|---|---|---|
| `arcoChico` | AC | 5 | 3 wide × 2 tall | 1 wide |
| `arcoAlto` | AA | 7 | 3 wide × 3 tall | 1 wide × 2 tall |
| `arcoAncho` | AN | 6 | 4 wide × 2 tall | 2 wide |

- Whatever fits the opening can stand in it (3D occupancy), and a Cabeza
  there is sheltered.
- Openings (`PIECE_ORIENTATIONS`): upright across the row. The Chico and
  Ancho can also lie flat as a U, opening north or south. The Alto is too
  deep for the 2-row home band, so it always starts upright.
- The summary and variants read "Arco Alto" etc. (`rosterItemLabel`).
- A piece inside an upright Arco blocks the Arco from tipping sideways,
  because its leg would sweep through it. It can still roll along its
  length.
- Tests: the Arco cases in `tests/shapes.smoke.mjs` and
  `tests/e2e-odd-pieces.mjs` (renamed from e2e-codo.mjs), and the size
  control in `tests/e2e-singularity.mjs`.

**Shoving LAW** (`laws.shoving`). Rewritten to the user's rule (user
report: "an Opa could not displace a standing Flaco, it seems to judge by
height"). It never judged by height; the Opa was refused for three other
reasons: an Opa shove costs 3 points (above a 2-point turn), a roll lands
2 deep so a 1-square push left the piece under the Opa, and only ONE piece
could ever be in the way. The rule now, confirmed with the user:

- The pieces in the way are everything overlapping the mover's landing:
  one, or several SIDE BY SIDE (a Turrito and a Cabeza abreast against an
  Opa's face are both pushed).
- Legal only when the mover's mass (cubes, `cubeCount`) is GREATER than
  the COMBINED mass of the pieces in the way. Mass, never height (an Opa,
  8, pushes a standing Flaco, 2, though they're equally tall).
- A SLIDE pushes them exactly 1 square. A ROLL pushes each just clear of
  where the roller lands (a piece right against a rolling Opa goes 2, one
  in the far half of its landing goes 1). Rolls and slides both shove.
- LINES ARE NEVER PUSHED: any piece in a pushed piece's path (even one
  that's itself in the mover's way) blocks the shove. Every square passed
  over must be on the board and not a Missing Square.
- Only a Turrito or a Cabeza can be pushed into a Black Hole; it comes
  out one square past the paired hole.
- A roll onto a lone enemy Cabeza stays a crush, not a shove.
- Being pushed onto the far row never wins.
- Cost unchanged (user's choice): `SHOVE_COST = 1` extra (`moveCost`),
  gated by `withinBudget`. A shoving slide costs 3, a shoving roll 2, an
  Opa shove 3: an Opa only shoves with 3 Actions Per Turn (the menus warn,
  `shove-opa-needs-three`).
- Push distance is fixed by the rule (the old "1 square / as far as it
  travels" setting is gone for good). WHICH MOVES SHOVE is a setting again
  (user request, 2026-09-27): "Slides and rolls" (default, the rule above)
  or "Slides only" (a roll into a piece is simply blocked, as without the
  law). Engine: `ACTIVE_LAWS.shoveOnRolls` (default true) gates
  `rollShove` in legalRolls. Shared model: `sel.shove = { onRolls }`
  (`SHOVE_SETTINGS`, `lawsForEngine` passes `shoveOnRolls`,
  `shovingName` "Shoving (slides only)" in the summary); a save without
  it means slides and rolls, an old save's `onRolls: false` is kept, its
  `far` dropped. UIs: Tienda `tienda-shove-settings` /
  `tienda-shove-onRolls-on|off`; the sphere `shove-settings` /
  `shove-onRolls-on|off` (+ cost note); Lluvia `lluvia-shove-settings` /
  `lluvia-shove-onRolls-on|off`. Warnings: slides and rolls with an Opa and
  no 3 Actions `shove-opa-needs-three`; slides only without Slide
  `shove-needs-slide`, without 3 Actions `shove-needs-three`. Lluvia's LAWS
  panel now shows all law warnings too. Rules text follows the setting
  (RulesCards `shovingText`, the piece card).

Other pieces:
- The move carries `shoves: [{ id, row, col, teleports }]`, one per
  pushed piece; `applyShoves(pieces, shoves)` (rules.js) moves them.
- ai.js applyMove/undoMove move every pushed piece; the net-zero checks
  and the split-turn dedupe treat a shove as the turn doing something.
- Chassis: commit and the follow-up move preview use `applyShoves`; step
  records carry `shoved: [ids]`; settleTurn never voids a turn that shoved.
- Animation: `animateStep(..., shoves)` glides each pushed piece on its
  own carrier over the same duration (`anim.current.push` is a list).
  Undo snaps them back when the turn is restored.
- `rollSweepClashes` (shapes.js) takes a list of pieces to ignore (the
  pieces a roll pushes).
- Tests: the Shoving block in `tests/engine.smoke.mjs` (Opa vs standing
  Flaco on a roll and a slide, side by side, lines, mass sums, height
  ignored, holes, edges, costs, crush, AI), `tests/e2e-shoving.mjs` (a
  slide, a roll, the Opa pushing a Turrito and a Cabeza side by side in
  the real game, an AI turn), and the no-settings checks in
  `tests/e2e-singularity.mjs`, `tests/e2e-tienda.mjs` and
  `tests/rules-selections.smoke.mjs`.

Audio: the collapse roar's peak was trimmed from 0.022 to 0.018. At the
end of the collapse the roar, the drone and the bell's tail sum; the
bell test measured up to 0.98 before the trim and ≤0.86 after.

**Anomaly button shuffles the game's own pieces.** `handleAnomaly`
(themes/neon.js) builds its roster from the pieces on the board
(`rosterFromPieces`: Dark's pieces counted by type), not the classic
five. So a game set up on the sphere keeps its Codos, Arcos, extra
Cabezas and so on, and only their layout changes. A plain board still
gets the classic five. If the generator can't fit the roster, it falls
back to the classic five; in that case the button leaves the board
alone. Test: `tests/e2e-anomaly.mjs`.

**AI evaluation rework** (engine/ai.js). Reported problem: the AI leaned
on moving its Cabeza. Measured with the new AI-vs-AI simulator
`tests/ai-sim.mjs` (`node tests/ai-sim.mjs <classic|matter|holes> <tier>
<tier> <games> [timeScale]`, with `AI_OLD=<copy of ai.js>` for a
`tier:old` opponent and `AI_OVERRIDE` JSON for trial settings). It
isn't part of `npm test`, since a run takes minutes.

Old AI findings:
- The score was driven by "rows the lead Cabeza has advanced" (12 per
  row), so walking the Cabeza forward outscored anything a block could
  do. It moved the Cabeza in 30–58% of turns, and most games ended with
  that Cabeza crushed.
- With two Cabezas it only looked at the furthest one, so losing the
  other cost nothing (MATTER games lasted ~6 turns a side).
- It only ever feared crush threats and never valued making one.
- Under Split Movement (~1000 turns a side) it searched 1 turn ahead at
  every tier.

The new evaluation:
- **Route cost:** steps to the goal row around pieces' ground cubes and
  Missing Squares, +3 per square an enemy block could land on next
  (`cabezaRouteCost`, a ring-buffer Dijkstra).
- **Material:** 400 per Cabeza.
- **Mobility** over rolls and Cabeza steps (slides skipped for speed;
  they never crush).
- **Threats by side to move** (`evaluatePosition(..., toMove)`): a
  Cabeza the mover can crush is lost (last one: 20000). A threat to the
  mover costs 25, or a Cabeza if two are hit at once.

Search:
- A per-tier **beam** (Easy 0, Medium 8, Hard 12; ×3 at the root;
  game-ending turns are always kept).
- Depth-1 nodes reuse their ordering scores as leaf scores.
- Tie-safety checks are computed lazily.
- `lastSearchInfo.depth` reports the depth reached.

Rules speedups:
- Hole and Missing Square checks exit early when there are none.
- `rollVox` results are cached.
- The sweep check skips box-vs-box pairs and far pieces, and
  bounding-box rejects before SAT.

Results (sim, both colours):
- New Medium vs old Medium: 11/12 on the classic board, 12/12 in MATTER.
- New Easy vs old Easy: 13/20 classic (1 draw), 17/20 MATTER.
- Tier order holds: Hard beat Medium 7/8 on the classic board, and
  3 wins / 0 losses / 5 draws in MATTER. Medium beat Easy 12/16.
- Cabeza-only turns for Medium on the classic board fell to ~16–21%.

The style nudges (cabezaRepeatBias etc.) are unchanged.

**AI early stop** (findBestAiTurn, `earlyStop`, on by default). A
depth that runs out of time is thrown away, so searching it only burns
the CPU the 3D scene is competing for. The AI already runs on its own
Web Worker, and the main thread does no extra work while it thinks;
frames slow only from CPU contention. So more workers would make it
worse, not better.

The rule: stop once the depth just finished took more than 1.25× the
time left. A deeper search is never faster, so the next one can't
finish.

Measured from 102 recorded searches (per-depth times in
`lastSearchInfo.depthMs`):
- Predicting further ahead is unsafe: the next depth took 1.1× to 25×
  the last.
- This rule never lost a depth, and saved 4–13% of think time
  (Hard: ~0.2–0.5s).
- Live with/without comparison: 33 of 34 same move, 0 shallower.

**Cantilever Pivot LAW** (`laws.cantileverPivot`, the sphere's LAWS
checkbox).

Who can pivot: a piece standing on exactly ONE cube (`pivotCellOf`, which
means a Codo balanced on one cube; no Arco pose or box qualifies).

The move:
- A quarter turn about the vertical axis through that cube, as move
  keys `pivot-cw` / `pivot-ccw` (clockwise as seen from above, rows down
  the screen). Each costs 1 point and each undoes the other
  (`INVERSE_DIR`).
- A half turn is two quarter turns the same way, so the player picks
  which way round.
- `pivotPiece` (shapes.js) turns the cubes. `legalPivots` (rules.js,
  merged into legalMovesFor) needs the new pose on the board and clear
  of other cubes, plus no clash along the way (`pivotSweepClashes`).
- The swept check samples the arm at angles with the SAT test in the
  board plane. A one-square arm sweeps its destination and the diagonal
  between the headings. Only a piece with a cube at the arm's level (2+
  tall) blocks it, and swinging over the board edge is allowed.
- The arm never crushes: a Cabeza under it is sheltered.

Chassis:
- The spin reuses the roll carrier with axis +Y through the planted cube
  (clockwise is a negative angle).
- `nextStateAfterDir` inverts it for undo.
- **Move cue: curved arrows** (user found the first version, a square
  marker on the destination, invisible/unclear). `buildPivotArrow`
  (chassis, module scope) draws, per legal way round, a tube arc plus
  a cone head, floating just above the piece. It sweeps round the
  planted cube from the arm toward its destination, in the owner's glow
  colour, breathing at rest and flaring near-white on hover.
- It returns the `{ root, setOpacity, tick, dispose }` indicator shape,
  so the ghost fade/hover code drives it, plus `hit`: a fatter invisible
  tube (kind "ghost") for picking. Being above the board it's nearer the
  camera than the roll markers, so a tap on the arrow always means the
  pivot.
- Test hook: `__EC_TEST_PIVOT_ARROW_POS__(dir)`.
- The view flips 180° with the player to move, so "clockwise" on screen
  depends on the side. The arrows are drawn in board space, so they're
  always right.
- The move log shows the keys (e.g. `Co: pivot-ccw.pivot-ccw`).

The AI finds pivots through legalMovesFor.

Not built from the design doc: the swipe gesture (the arrows are tapped).

Tests: the `[pivot]` block in tests/engine.smoke.mjs and
tests/e2e-pivot.mjs.

**Hard's thinking time: 4300 -> 3500ms** (user request, to shorten the
stretch where the AI and the 3D scene compete for the CPU). Sim vs
Medium on the classic board, both colours:
- 3500ms / beam 12: 7 wins, 0 losses, 3 draws.
- 3000ms / beam 10: 5–5. 3000ms / beam 8: 4 wins of 10.

**Free detours (user rule: "any move that returns to a previous position
should not deduct a movement point").** The chassis commit keeps
`turnTrailRef`: one entry per move this turn, each holding the board plus
the turn's bookkeeping (points used, moved ids, steps, notation, selected
piece) from just before that move.

When a human's move recreates one of those boards, the turn rewinds to
it. The points spent since are refunded, and the steps and notation are
trimmed. Back at the turn's start, the turn is simply open again, with
the piece still selected.

Examples: roll E then W, pivot there and back, or a Split turn's second
piece stepping home.

Limits:
- A crush or shove is never rewound.
- AI turns are excluded: its plans never detour, and its replay counts
  the points it planned with.

The old "rolled out and back voids the turn" branch in settleTurn only
triggers now when the detour happens to end the turn some other way.

**Pivot input, round 2.**
- Arrows are thicker (tube 0.1 square).
- The invisible tap tube is much fatter (0.42 square radius), so near
  misses no longer hit the roll markers under the arm.
- New **swipe** (`pivotDrag` in the pointer effect). Armed on pointerdown
  on one of the player's pivot-eligible pieces: the selected one, or any
  of theirs before the turn starts.
- A swipe across the arm, where the sine between the arm's on-screen
  vector and the swipe is over 0.55, picks cw/ccw from its screen sense.
  That's safe because the camera always looks down on the board, so
  screen clockwise is board clockwise. It claims the gesture, lights the
  matching arrow via hoverShadow, and commits on release.
- With a Slide also armed: grab near the arm to pivot, near the base to
  slide (`preferred`).
- Tests: tests/e2e-pivot.mjs 1b (pivot back is free), 1c (swipe) and 5
  (roll out and back is free).

**Neon piece occlusion (depth twin).** Neon's glass bodies don't write
depth (self-z-fighting fix), so translucent pieces were layered whole,
by their centres. A balanced Codo over a 1x3 painted its base over the
1x3 standing in front of it; no single order works when an arm is in
front and a base behind.

The fix is in `buildPieceVisual`: every body gets a child "depth twin"
(same geo, shared `PIECE_DEPTH_MATERIAL`, colorWrite off, depthWrite on,
renderOrder 0.5: after the grid's -10, before bodies at 1). Each body
now only shows where nothing stands in front of it, per pixel, and the
grid still shows through the glass. It's never picked (picking isn't
recursive) and casts no shadow.

The glass look is kept by a **see-through layer** (user: "this must be
addressed" after the twins alone made pieces read solid).
`seenThroughCopy` adds a copy of each body and outline with
`depthFunc: GreaterDepth` and renderOrder 0.7. It draws only what lies
BEHIND the frontmost surface (its own back edges, other pieces further
back); the front glass (renderOrder 1) then blends over it. Behind
things show through dimmed, as through glass, but can never paint over
a piece in front. The frontmost surfaces fail "greater", so nothing is
drawn twice. The copies' materials are disposed with the originals'
(the material "dispose" event). Standard's pieces are opaque, so it's
unaffected.

**Clearance rule** (user, confirmed by Q&A), in `rollSweepClashes`
(shapes.js):
- A Cabeza never blocks another piece's swing (it's lower than a cube).
  It is still sheltered, and still can't be landed on except by a crush.
- A piece sheltered wholly under an overhang or in an opening blocks the
  roll only if it reaches the underside (`leavesClearance`): its top
  level must be at least the lowest roof cube above it. For example, a
  Turrito in an Arco Alto's 2-tall opening never blocks, and a standing
  1x2 there does.
- A piece that fills the gap still only blocks the moves that swing into
  it; rolling away stays open.
- Pivot sweeps skip Cabezas too.
- Tests: the clearance block in tests/shapes.smoke.mjs.

**Points-left counter** (option 1 of the user's choices).
- Toggled by an icon in the dock's bottom-right corner (`points-toggle`),
  left of Sound, or in its place when a theme has no audio.
- Remembered in localStorage `el-cabeza:show-points`; off by default.
- During play (hidden while the dock panel is open) it shows one dot
  per point of `turnBudget()` at the bottom centre, labelled "Action points", dimmed (filled 0.55, spent 0.28) per feedback (`points-counter`,
  `data-left`). Filled dots use the player's accent (Neon cyan/amber,
  glowing) or body colour (Standard); spent dots are hollow.
- `pointsPulse` flashes it when a free detour refunds points.
- Test: tests/e2e-points.mjs (both themes).
- Counter lifetime (user): shown from Begin Game until the next game's
  setup (`!awaitingBegin`), so it stays up through the win placard and
  the ended screen. After the game ends it holds that game's last turn
  (`pointsFinal { player, left }`, set in both win branches of commit and
  in handleEndActiveGame; cleared by the New Game reset). Leaving via New
  Game, Singularity or a theme switch clears it.
- Dots are 9px with a 5px gap.

**Dock "who's playing" line** (`dock-players`). From Begin Game onward
(`!awaitingBegin`), the dock's footer strip (the one Sound's icon sits
in) shows e.g. "DARK: AI (HARD) │ LIGHT: YOU", or "Human" for both
sides. It's absolutely placed with an ellipsis before the corner icons,
so the dock never grows (user: docks as small as practicable).

Pivot test fix: taps target a real cube via `__EC_TEST_CUBE_POS__(row,
col, level)`. The Codo's bounding-box centre is the inner corner of its
L, where a tap can slip through the notch at some camera angles, which
made e2e-pivot flaky in the full suite.
- e2e-points closes the dock the way a player would (`closeDock`). In
  Standard the dock can reopen by hover right after Begin Game, when it
  folds back under a pointer still resting on the button; the counter
  hides under an open dock. That's existing Standard dock behaviour.

**Readability pass (user):**
- `dock-players` is now 11px in the dock's text colour (`COLORS.charcoal`)
  at 0.8, from 9px slate at 0.75.
- INFO button (revealed by tapping the title) is 10px, and 11.5px in the
  top-right corner phase (from 8px).
- The relocated masthead is a 0.22-opacity watermark and the button
  lives inside it, so while `infoBtnVisible` the masthead comes up to
  0.9 (1 in the other phases) over 0.3s, then fades back over 1.1s.

**Standard dock reopening after Begin Game (fixed).** The dock piece had
`onPointerLeave={handleDockPiecePointerUp}`, so a pointer leaving it
counted as a tap and opened the dock. After Begin Game the panel folds
back into the piece under a pointer still resting on the button; the
piece then slides to its corner, "leaving" the pointer inside the hitbox,
and the dock reopened. `handleDockPiecePointerLeave` now only ends a drag
and cancels the hover timer, never opening the dock.

**AI piece fixation (user report).** In a 3-action MATTER game the AI
moved its Turrito in ~21 of 27 turns, shuffling S.S.S / N.N.N. Causes:
- Shallow search: 1–2 turns deep with 3 actions + slides + pivots, so
  development rarely pays off within the horizon.
- The Turrito is the cheapest piece to reposition for threats and blocks.
- The legacy `turritoBonus` (Medium 0.9, Hard 1.6) specifically rewarded
  advancing it.

Fixes:
- `turritoBonus` is 0 in all tiers.
- New root-only `pieceRepeatBias` (Easy 8, Medium 6, Hard 5) × consecutive
  AI turns that piece has moved. It generalizes `cabezaRepeatBias` to the
  other pieces, with the same exemptions (danger resolution, crush/win).
  `findBestAiTurn`'s 6th param is `pieceStreaks` (id -> streak); the
  chassis tracks it in `aiPieceStreaksRef` and passes it through the
  worker.
- Sim `user` scenario (`tests/ai-sim.mjs`) mirrors the reported game.

Results, new vs previous:
- Longest same-piece run fell from 15 to ≤3–6.
- Medium in the user setup: 9–5 (2 draws). Easy: 7–5.
- Classic Medium: 5–5.

## Everything out in the open (user: "I want everything out in the open… as user friendly as possible")

Came out of the Claude Design redesign boards (the "Streamlined"
direction). First pass, in the real game, both themes:
- **Cost badges on move markers.** `buildCostBadge` (chassis) is a
  camera-facing sprite over each marker (and each Cantilever Pivot arrow)
  showing `moveCost(move)`, or a "free" ring when the move would put the
  board back as it was earlier this turn (same turn-trail test as the
  refund in commit; never for a crush, shove or the AI). It rides the
  marker's fade via a wrapper (`withCostBadge` in the ghost effect).
  Colours: Neon uses the side's accent with `inkOnAccent`; Standard uses
  `bodyDark`/`bodyLight`. `toneMapped: false`, or Neon's cyan dulls.
  Test hook `__EC_TEST_COST_BADGES__()` -> `[{ dir, text }]`.
- **Piece card** (`piece-card`, lower left above the full-screen button):
  on your turn, the selected piece's name, how it moves and its cost under
  the active laws (slide, diagonal slide, pivot, shoving), plus "More ›"
  to its MOVES tile. Text comes from `pieceCardInfo` in RulesCards.jsx.
  It stays while the piece is committed mid-turn.
  It closes on a press outside it (user report, Tienda & Lluvia; fixed in
  the chassis for every theme): off the board it just goes; on an empty
  square before a step it also deselects (as always); mid-turn the piece
  stays selected and only the card goes (`pieceCardDismissed`, reset when
  the selection or player changes). The unused-points note and Tienda's
  tapped-open "Your order" slip (also Escape) close the same way.
  Test: `tests/e2e-outside-dismiss.mjs` (neon, tienda, lluvia).
- **Move costs switch** (user request, first Neon, now every theme): a
  circled-"1" icon in the dock's corner row, left of the points switch
  (`costs-toggle`). It hides or shows the cost badges on the move
  markers. On by default, and remembered in localStorage
  `el-cabeza:show-move-costs`. A theme opts in with
  `export const moveCostToggle = true`; Neon, Standard, Cromo and Lluvia
  all do. Standard got it after a Nova report that the numbers on the
  board couldn't be hidden: the points switch hides only the counter. The chassis reads `costsOn`, and the marker
  effect depends on it, so flipping it redraws the markers at once.
  e2e-costs covers it.
- **How to play** (`how-to-play`): always on screen beside the full-screen
  button and opens the Quick card. Below 560px wide only the "?" shows,
  keeping it clear of the points counter.
- **Corner controls under the dock**: while the open dock panel reaches
  their spot (a phone, or the 880px post-game panel on a smaller
  desktop), the full-screen and How to play buttons fade out and go
  inert (`cornerControlsCovered` in the chassis, from the panel's width
  rule and `window.innerWidth`), then return when it closes. Before this
  they sat on top of the panel's DARK/LIGHT players line on phones.
  - Both corner controls use `cornerControlsZ` (12 by default). Neon's
    useSetupExtras returns 2050 while the SINGULARITY sphere is up: above
    the sphere's full-screen layer (2000, which ate their taps; user
    report), under its menus (2100+) and the rules overlay (2500). They
    are not raised during the collapse or the cut to black.
- **Custom rules** (`custom-rules`, Neon setup dock, under Anomaly/Begin
  Game): calls `revealSingularity`, the same reveal five masthead taps do
  (the taps still work).
- **Points counter on by default.** `loadShowPoints` is true unless the
  saved value is "0", so a player who switched it off keeps it off.
- Tests: `tests/e2e-costs.mjs` (badges, free ring, piece card, pivot badge
  in e2e-pivot); e2e-rules covers How to play and Custom rules;
  e2e-points expects the toggle to start on.

## Rules pop-up audio: ABOUT tab only (user rule)

The angelic choir (`audio.playMenu`) and its closing cue
(`audio.fadeOutMenu`) belong to the ABOUT tab of the rules pop-up and
nothing else:
- **Choir:** plays when the rules open on ABOUT, or when the player
  switches to ABOUT.
- **Closing cue:** plays only when the pop-up closes while ABOUT is
  showing.
- **Leaving ABOUT for another tab:** only silences the choir
  (`audio.stopMenu`, a 0.25 s fade with no tail).
- **Every other open, switch or close gets its own small Neon earcon**
  (user follow-up):
  - `playRulesOpen` (How to play and every other non-ABOUT open): ONE
    plain struck tone, D5 with a faint octave, soft attack and a 0.5 s
    fall, peak 0.00845. It was a rising two-note glass figure with an
    air swish; the user found that "too much like a Nintendo game" and
    asked for something more austere and 20% quieter.
  - `playRulesClose`: the same plain tone a fourth lower (A4), softer
    (0.0068) and shorter (0.42 s), so closing settles. Replaced the old
    falling two-note figure at the user's request, to match the open.
  - `playRulesTab()`: the SAME tick for every tab (user: the one COSTS
    had, G#6, a sine plus a 2.76x bell partial), in ten near-identical
    takes (`TAB_TAKES`: a few cents, the partial's ratio, the decay and a
    trace of tanh soft-clip grit). Never the same take twice. It no
    longer follows the tab's position; the chassis still passes an index,
    which is ignored.
  - All go through `sfxGain`, so mute applies. Standard has no-ops.
  - Levels: open 0.00845, close 0.0068, tab 0.00576.

In the chassis, `openRulesAt(tab, focus)` and `switchRulesTab(tab,
focus)` are the only ways in. `infoTabRef` feeds the close cleanup. The
masthead Info button opens on the last-shown tab and plays the choir only
if that tab is ABOUT. Test hook: `window.__EC_MENU_CUES__ = []` logs
`play`/`close`/`stop`/`open`/`shut`/`tab` (e2e-rules "[menu audio]").

## MATTER menu: one list, 3D piece models (user request)

The 1×3 and 2×3 Blocks were on/off checkboxes (the first MATTER pieces);
every later piece got a count roller in a grid. Now every piece type is
the same row, in this order: Cabeza, Turrito, Flaco, Chato, Opa, 1×3
Block, 2×3 Block, Codo, Arco, Rayo, Zeta.
- **Row layout:** a 3D still (a button), the name with a one-line
  `detail`, and an inline `DrumRoller` (`inline: true`) on the right. The
  Arco's size choice sits directly under the Arco row. A "Pieces per
  side N of 10" line sits on top, with a note when the total is over 10
  (the extras are trimmed at game start).
- **Data model:** `MATTER_NEW_PIECES` and `selections.matter.newPieces`
  are gone. The blocks are `roster.block1x3` / `roster.block2x3` (0–4,
  default 0). `normalizeSelections` → `migrateRoster` turns an old saved
  ticked box into a count of 1. `buildRosterFromSelections` (neon.js)
  reads the counts.
- **Models** (`themes/piece-showcase.js`):
  - Each type in its first starting pose, built from the engine
    geometry: `makePolycubeSmooth` for odd pieces (one seamless solid)
    and rounded boxes otherwise.
  - Look: dark clear-coated glass, a painted studio environment, cyan
    edges, and a glow pool.
  - `ensureThumbs` renders all the stills in ONE short-lived WebGL
    context (released straight after); `pieceThumb(type)` returns them.
  - `PieceViewer` is the live model: it turns slowly (0.35 rad/s) and
    can be dragged, with some carry after release.
  - It opens from the still's own screen rectangle: a scale/translate
    transition to centre, frameless, over a `backdrop-filter: blur(9px)`
    scrim. It closes back into the still.
  - While the viewer is open, the still is emptied and ringed
    (`data-viewing`).
  - It closes on a tap outside or on Escape; the sphere's own Escape
    handler ignores Escape while `[data-testid="piece-viewer"]` exists.
  - Test hook: `window.__EC_PIECE_VIEWER__.yaw()`.
- Tests: e2e-singularity checks the 11 uniform rows, that the stills are
  images, the 1×3 count, and the viewer opening, turning, dragging and
  closing.

## Design canvas: third batch (ten 3D finishes)

On the Claude Design canvas (El Cabeza Redesigns), themes 11–20
(Prisma, Cromo, Arcilla, Taller, Mármol, Aurora, Horizonte, Circuito,
Sumi, Vacío) each have a Title and an In-game phone board.
- The board and pieces are real 3D from a shared renderer, `ec3d.js`
  (Three r128), uploaded to the canvas as an asset along with
  `three.min.js`. Source is in the session scratchpad
  (`redesign3d/ec3d.js`), not the repo.
- Each board renders once and releases its WebGL context; dragging
  re-opens a context to turn the board. This keeps a canvas of many
  boards under the browser's context limit.
- Changing the renderer means re-uploading it and repointing every
  board's `/_blob/<id>` script tag.

## Future wishlist (user-requested, not started)

- **REMIND THE USER: the den's music (asked to be reminded,
  2026-09-27).** The stereo console's record player and 8-track are
  built, and the music panel lists them, but the tracks are the user's
  to send. When they arrive: bundle each as an asset and list it in
  themes/standard.js `DEN_TRACKS` ({ id, title, artist, medium: "record"
  | "8track", url }). See "The den, round 2" below.
- **REMIND THE USER: a city-block version (asked to be reminded,
  2026-09-27).** Every piece is a building, or a row of buildings when it
  lies flat, in a foggy, rainy future-noir city (think Blade Runner, or
  the PC game Dystopika). When a piece rolls or turns it becomes a
  different building on the block. Not started; flesh it out with the
  user first. Related: Lluvia (themes/lluvia*.js) is already a rainy
  neon city round the board, so ask whether this grows out of Lluvia or
  is a version of its own.
- **Online play against another human.** GitHub Pages only serves static
  files, so this needs a small backend: a relay (WebSocket) service, or
  peer-to-peer WebRTC with a tiny signalling server. Invite by link or
  short game code; the engine's move descriptors and move log are already
  the natural wire format.
- **No accounts, but saves that outlive the browser.** Options discussed:
  an export/import save code or file (no server); an anonymous save stored
  on the same backend under a secret code or link (no sign-up); browser
  storage as today. An installable app (PWA or native) doesn't solve this
  on its own; it still stores on the one device. Pick the approach with
  the user before building.
- **Piece size (decided, built).** The user chose, after renders of
  0.8 / 0.87 / 0.92: blocks, Codos and Arcos at `PIECE_SCALE` 0.87 (was
  0.8; it is also the height of one stacking level), and the Cabeza disc
  at its own `CABEZA_SCALE` 0.84 (engine/constants.js). The dock keeps
  its frame size. Board squares are unchanged.
- **Unused-points note (built).** When a player's own turn ends with
  points left that nothing can spend, a short note fades in at the bottom
  centre (`unusedNote`, data-testid `unused-points-note`), e.g. "1 point
  unused: an Opa moves only once per turn". Shown with or without the
  points counter; never for the AI's turns or a wormhole move.
- **Shoving warnings.** Back with the "slides only" setting (see
  "Shoving LAW"): `shove-needs-slide`, `shove-needs-three`, and
  `shove-opa-needs-three` for slides and rolls.
- **LAWS fixes (built).** Blurbs rewritten to match the engine (Slide
  costs 2, Black Holes are always two and exit on the same side, Split is
  up to two pieces, only a Codo/Rayo/Zeta can pivot). Warnings under a
  law's row (`lawWarning`, `law-warning-*`): Diagonal Slide without Slide;
  Cantilever Pivot with no Codo/Rayo/Zeta in the roster. Shoving adds
  `shove-opa-needs-three` (an Opa in the roster, no 3 Actions: an Opa
  shove costs 3).
- **Rayo and Zeta (built).** MATTER roster counters (0-4, default 0).
  Rayo: 4-cube S/Z (`rayo`, "Ra"); Zeta: 5-cube Z (`zeta`, "Ze"), which
  starts upright and can stand on one cube, so it can pivot (the Rayo can
  too, once stood on end). Poses in themes/neon.js PIECE_ORIENTATIONS;
  Zeta never starts flat (3 rows deep).
- **Pieces at 87%.** `PIECE_SCALE` 0.87 (user's final pick); the Cabeza
  stays at `CABEZA_SCALE` 0.84.
- **Rules cards (built).** chassis/RulesCards.jsx: tabs in the INFO
  overlay (About, Quick, Costs, This game, Moves, Your turn). Opened from
  anywhere by the window event `el-cabeza:open-rules` {tab, focus}
  (focus = a MOVES tile key or law key). Contextual entry points: each
  SINGULARITY law's "i" (`law-<key>-info`), law names in the Current
  Variants flyout (`variants-law-<key>`) plus its "Rules ›" link, the
  unused-points note (opens Your turn), and the sphere's help line (the
  old "?" is now a plain line; its text links "Game rules ›"). The INFO
  overlay is z-index 2500 so it covers the sphere; the sphere's Escape
  handler ignores Escape while it is open. MOVES has 16 animated SVG
  tiles (CSS keyframes; under prefers-reduced-motion they play at half speed, 7.2 s); the black
  hole tile shows the same-side exit. Test: tests/e2e-rules.mjs.
  No skipping: Quick has a MUST row and Your turn opens with step 1,
  "You must move at least 1 piece, 1 time. Skipping your turn is not
  allowed." The engine already enforces it: there is no pass, Stop needs
  a move first, and a turn that ends where it began is voided (settleTurn).
- **"The original El Cabeza" (built).** ABOUT ends with a link
  (`play-original`) that closes INFO and runs resetGame(false) (no laws,
  boot board size, standard pieces, no holes), then sends the window event
  `el-cabeza:play-original`: the sphere exits if open, and Nova
  (apps/unified.jsx) transitions back to the Standard theme if it's on
  Neon. Standard has no ANOMALY button, so nothing else to disable. Test:
  tests/e2e-original.mjs.
- **Original-game cue (built).** The link plays assets/original-cue.mp3
  (5.5 s of archive.org's "Mall Music Muzak – Mall Of 1974", Third Floor
  Spending Spree, from 0:06, +8 dB, fading out over the last 1.5 s)
  through a plain Audio element (volume 0.75; skipped when muted), so it
  survives Nova's theme switch. build/build.js inlines .mp3 files as data
  URLs.
- **Reduced motion = calm, not frozen (built).** Windows with Animation
  effects off makes Chrome report prefers-reduced-motion. The SINGULARITY
  button/invite then breathes (ec-singularity-calm-halo/-text: a slow 5 s
  opacity/brightness pulse, no flicker or scaling) instead of standing
  still, and the MOVES tiles play at half speed.

- **Move Log order follows the opener.** `pairLog` (engine/rules.js) pairs
  each round from whoever made the log's first move and tags rows with
  `opener`; the Move Log table puts the opener's column first and Copy
  Move Log writes "1. Light: … | Dark: …" for a Light-opened game, and
  drops the empty half of a round the game ended in. It used to show
  "1. Dark: — | Light: …", which read as a skipped Dark turn. Tests:
  engine.smoke.mjs ([log]) and tests/e2e-movelog.mjs (AI plays Light and
  opens).
- **AI sees two-roll crushes.** evaluatePosition and cabezaInDanger also
  expand a second roll for blocks near an enemy Cabeza (a turn is two
  points, so roll-to-line-up then roll-onto is the usual crush). In
  Split Movement games with pieces in contact Medium often only finishes
  depth 1, where the evaluation alone guards the Cabeza. A
  `cabezaSafety` weight (8 per safe step square short of three) is on
  for Medium and Hard, and the Cabeza/piece repeat biases now also apply
  to turns that rescue a threatened Cabeza (only twoStepBias keeps that
  waiver). ai-sim `rayo`: longest Cabeza-only run 38 -> 3, and new
  Medium beat the old 7-0 (1 draw) across both sides. Hard's value is
  Medium's, not separately simulated. tests/ai-threats.smoke.mjs.
- **Undo after a game ends restores sound.** resetWindDown(true) also
  resumes a suspended AudioContext (phones may suspend it in the
  post-game silence); tests/e2e-undo-audio.mjs, probe
  window.__EC_TEST_AUDIO__ / __EC_TEST_AUDIO_SUSPEND__ (Neon).

- **Cromo theme (built).** themes/cromo.js (+ cromo-fx.js scene effects,
  cromo-audio.js), apps/cromo.jsx, dist/el-cabeza-cromo.html, linked on
  the Pages landing page. The board is the top of a monolith cube of
  TUNGSTEN or SHUNGITE (setup-row switch `cromo-stone`, remembered in
  localStorage `el-cabeza:cromo-stone`); the cube (vertex-colour fade to
  black) is added under the slab by mountAmbientEffects, which also hides
  ec-slab-edges and runs the light sweeps (Begin Game, idle every 9-16 s,
  game end) and the landing shimmer (a piece whose square changed and then
  held still 4 frames; >2 at once = new board, no shimmer). Reflections: a
  canvas-painted studio panorama set as each material's envMap (not
  scene.environment) so the setup screen's separate dock-piece renderer
  gets it too. Pieces: mirror chrome (Light) / warm gunmetal (Dark) with
  a thin dark silhouette shell. Audio: synthesized struck-bar/stone
  modes per stone, room reverb, near-silent ambience (room tone, beating
  55 Hz drone, a rare far bowl), Neon's wind-down contract. Fonts
  Michroma + Barlow; chrome-gradient .ec-title. Test: e2e-smoke cromo.

- **Lluvia theme (stage 1 built).** themes/lluvia.js (+ lluvia-fx.js,
  lluvia-audio.js, lluvia-bus.js, lluvia-city.js = the design canvas's
  city engine as an ES module: LLUVIA.mount(canvas,{mode, dpr, fps}),
  createScore(hooks) exposing its instruments as score.inst),
  apps/lluvia.jsx, dist/el-cabeza-lluvia.html. The city runs in
  "backdrop" mode on a canvas inserted into the chassis's board layer
  under the (transparent) board canvas, at reduced dpr/fps. Board: wet
  asphalt with glossy puddles, pink rim; pieces neon glass (cyan Dark,
  magenta Light) with a bright tube shell; sodium-yellow move frames.
  Rain streaks around the board, drop rings on it, a splash on landing,
  lightning synced to the score's thunder via lluvia-bus. Audio = the
  synth score (pads, rain, drone, far đàn bầu/zither/voice) + cues built
  on its instruments.
- **Lluvia opening + city menu (stages 2-3 built).** themes/lluvia-overlay.js
  via useSetupExtras/renderExtraOverlays: on load a full-screen layer
  ("THE RULES ARE MADE DOWN THERE", DESCEND / Straight to the board);
  DESCEND runs the engine's descent (own score, captions, SKIP); on
  arrival the city's billboards/buttons open terminal panels (MATTER
  counts, LAWS toggles, TOPOLOGIES size/missing/random) plus an
  OPPONENT cycle (Human -> CPU easy/medium/hard); BEGIN THE GAME applies
  them (board resize, roster via generateAnomalySetup, setActiveLaws,
  missing squares/black holes, variants) and triggers Begin. Non-default
  rules register t.singularityGameActive + reapplySingularitySetup (New
  Game keeps them) and reconfigureSingularitySetup (reopens the city).
  The backdrop city pauses while the layer is open (lluvia-bus
  "overlay"). The setup row gets CUSTOM RULES. Test: e2e-lluvia.mjs.

## Tienda (built): a 1975 department store round the board

User brief: re-theme the whole game as suburban America, 1974-75 (a
discount department store, earth tones, fluorescent light, Muzak, a
faintly liminal quiet but never horror; no disco, no parody; CRT only on
real screens), and make it right on every phone, tablet, laptop and
desktop. Built as its own theme and page (dist/el-cabeza-tienda.html);
Nova and the other themes are untouched. The user's two posters are the
box art and an ad standee (assets/tienda/*.jpg).

- **Files.** themes/tienda.js (palette PERIOD/COLORS, board and
  lacquered wood pieces with procedural grain that follows a roll
  (grainTurns), gold move frames, the whole UI restyled as printed paper
  via styleSheet), tienda-store.js (the store: baked vertex-colour
  lighting on unlit materials, geometry merged by material, instanced
  troffers/goods; the display table sized to the board), tienda-fx.js
  (attaches store+table to boardGroup so turning the board is walking
  round the table; fog; the frame-rate governor; the flickering tube),
  tienda-textures.js (every sign, box, card and floor painted on
  canvases), tienda-overlay.js (the box lid on load, the catalog ORDER
  FORM = custom rules), tienda-audio.js, tienda-quality.js,
  themes/rules-selections.js + engine/anomaly.js (the custom-rules model
  shared with Lluvia).
- **Chassis hooks added for it.** `theme.viewPitch` (camera pitch; the
  store must show behind the table), `theme.rulesColors` (overrides for
  the rules sheet's text: Tienda's harvest gold is too light on cream),
  `movelog-sheet` / `victory-placard` test ids. On narrow phones the
  pre-game dock piece narrows (`min(260px, 100vw - 184px)`) so it no
  longer covers How to play (was untappable at 390px wide, all themes).
- **Device fit.** tienda-quality.js picks low/mid/high once (coarse
  pointer, cores, memory, GPU name, texture limit; software renderers
  like SwiftShader/llvmpipe are low; `?quality=` forces one). The tier
  sets the pixel-ratio cap, shadow and texture sizes, clearcoat, store
  detail and the TV wall. The governor in tienda-fx.js lowers the pixel
  ratio when frames run slow and raises it within the cap when they
  don't. Page is edge to edge (viewport-fit=cover) with safe-area
  margins. Built minified.
- **Sound.** Store ambience (ballast hum, air, far-off carts, register,
  PA chime and a voice you can't make out), wood/brass/paper SFX, and
  the ceiling-speaker music. The music alternates between:
  (1) **the tape**, the user's upload "Mall Music Muzak - Mall of 1974 -
  03 Third Floor Spending Spree" (Internet Archive item
  MallMusicMuzakMallOf1974), converted to mono 22 kHz 40 kbps MP3
  (assets/tienda/muzak-1974.mp3). The user asked for "that backrooms
  sound": it plays at 0.94 speed (a semitone flat) with tape wow,
  lowpassed at 3.1 kHz, through the speaker chain with an extra send to
  the long hall reverb. It's a file BESIDE the page
  (dist/el-cabeza-tienda-muzak.mp3, copied by build.js `files`), not
  inlined: inlining doubled the page to 2.2 MB. Prefetched 2.5 s after
  load (not on save-data), decoded at the first store start; picks up
  where it stopped after a game. Opened as a lone file (file://) the
  fetch fails and only the arrangements play.
  (2) **written arrangements**, composed live (compose(): 4 tunes, 7
  keys). A wide chord with no voicing in range used to return null and
  throw about one start in seven (silencing the music); fixed, and
  tests/tienda-music.smoke.mjs now covers every key × 60 seeds.
  Test flags: `__TIENDA_MUSIC_ONLY__ = "tape" | "arrangements" | "none"`,
  `__TIENDA_AUDIO__()` (with `__EC_TEST_HOOKS__`). Levels were matched by
  recording the master output: tape -25 dB, arrangements -24.7 dB,
  ambience alone -39.5 dB.
- **Tests.** tests/e2e-tienda.mjs serves dist/ over HTTP (like Pages):
  ten screens 320×568 to 1920×1080 (lid fits and opens, store and tier,
  sound starts on the tap, masthead on screen, How to play reachable, no
  sideways scroll), the order form and a custom 12×12 game on a phone and
  a laptop, a game to a win (points tag, placard, register-tape Move Log,
  tape stops in place, New Game keeps one store), and the page alone
  without its tape. The software renderer here is slow: clicks can take
  20 s, so the test gives actions 30 s. Audio clicks heard in headless
  recordings are the sandbox starving the audio thread while it renders
  the store on the CPU (they fall on 128-sample block edges and vanish
  with a tiny window), not the code.
- **Rules leaflet = a 1975 newspaper circular (user request: "printed on a
  newspaper advertisement flyer from that era. Creases, micro tears").**
  All CSS in tienda.js styleSheet over the chassis's info-overlay card,
  plus `ensureNewsprint()` (tienda-textures.js: a seamless canvas tile of
  groundwood newsprint: yellowed grey-cream, cloudy formation, fibres,
  dark shives) as `--tienda-newsprint`. Grounded in how the paper aged
  (lignin left in groundwood oxidises: yellow, edges browner and brittle)
  and how circulars were printed (soft black + one spot red, screened
  halftone tints, plates slightly off register). Details: browned edges
  (inset shadows) and two foxing blotches; a letter fold (creases at a
  third and two thirds, one valley one ridge) then in half, drawn by
  `::after` over the text (ink lighter on the ridges) with worn spots
  where folds cross; a torn outline from `tornEdge()` = clip-path
  polygon in `calc(% + px)` so damage is the same size on any screen:
  flaked edges, tears where each fold meets the edge, a chipped corner;
  the back page's ad mirrored and faint in `::before` (show-through); a
  red masthead band with reversed-out type and a halftone fade (three
  rows of shrinking dots); the name in heavy Franklin with an off-register
  red drop; an Oxford rule; red bold side heads (`rulesColors`). No outer
  shadow (clip-path would cut it); the dimmed store separates it.
- **Smoke test and opening screens.** tests/e2e-smoke.mjs now passes
  through a theme's own opening first (Lluvia: Straight to the board;
  Tienda: Open the box). Lluvia's smoke had failed since the descent
  opening landed (04ca297): its dock click hit DESCEND.
- **Tape on file://.** The page doesn't try to fetch the tape when opened
  straight from disk (the browser refuses and logs an error); it plays
  the arrangements.
- **Custom board size in the order form (user: "customize the board size,
  not just three presets").** The rules model (themes/rules-selections.js,
  shared with Lluvia) now holds `rows` and `cols` (6–20 each, `clampDim`),
  not one `size`; Lluvia's square buttons set both. Tienda's Board section:
  a live diagram (squares to scale, home rows shaded), Width (squares
  across a home row) and Length steppers, and square quick picks
  8/10/12/16/20 (`tienda-size-N`). Summary reads width × length.
  - **Fit.** Each side starts in its two home rows, so the width limits
    the order. `packHomeBand(roster, cols)` (engine/anomaly.js) is an exact
    backtracking packer (largest first, identical pieces in order, area
    cut-off; instant). The form uses `piecesFit`/`minColsFor`: if the
    pieces won't fit it says so, disables Place order, and offers "Make
    it N wide". generateAnomalySetup also packs deterministically before
    its old fallback: the random placer alone used to swap some tight
    orders for the classic five (e.g. 2 Opas, 2 Rayos, an Arco, a Flaco,
    a Turrito and the Cabeza, 10 wide: 3 times in 10). Test:
    tests/rules-selections.smoke.mjs.
  - **Board texture on resize (a bug the presets already had).** Tienda
    paints its squares into the board texture, and the chassis resize
    rebuilt the plate but reused the material, so an 8×8/12×12/custom
    board showed 10×10 squares stretched. New opt-in chassis hook
    `theme.boardTextureFollowsSize`: resizeBoardPlate repaints the texture
    and rebuilds the slab materials (disposing the old maps it no longer
    uses). Other themes draw squares as a grid (already rebuilt), so they
    don't opt in. e2e-tienda checks plate and paint proportions match.
- **Sample the wares: 3-D wood pieces in the order form (user request,
  like Neon's MATTER viewer).** themes/tienda-showcase.js, on the pattern
  of piece-showcase.js (POSES now exported from there): catalog-photo
  stills of each piece in walnut (one short-lived WebGL context for all),
  a "3-D" tag; tapping one (`tienda-view-KEY`) raises the live model out
  of the photo (`tienda-piece-viewer`), turning slowly, drag to turn,
  Walnut / Olive ash buttons, catalog number, price and note; tap outside
  or Escape puts it back into the photo (whose spot shows dashed while
  it's out). The wood is the board's own: `woodMaterial` (now exported
  from tienda.js), the store's light strengths (`lights`) and the
  chassis's renderer settings (ACES, 1.15), so walnut matches the table
  (brighter studio lights had made it orange). Test hook
  `window.__TIENDA_PIECE_VIEWER__` (yaw, wood).

## Tienda: everything Neon's Singularity offers, in the store's terms (user request)

"Make sure everything implemented in Neon Singularity is fully implemented
in a thematic way in Tienda." Inventory against the sphere, and where each
lives now:

| Singularity (Neon) | Tienda |
|---|---|
| MATTER: 11 pieces, counts 0–4 (Cabeza 1–2), Arco Chico/Alto/Ancho, 3-D models | Order form 1 · Pieces: same 11 with catalog numbers/prices, Arco size row (`tienda-arco-*`), wood photographs + 3-D viewer (the size's model) |
| LAWS + warnings + "i" to rules cards | 2 · Rules: every law, "How it works ›" (`tienda-law-KEY-info`, opens the MOVES card over the form), warnings with a ☞ (`shove-opa-needs-three`, `law-warning-cantileverPivot`). Shoving has no settings any more. |
| TOPOLOGY size, Missing Squares 1–5 pairs, Black Hole place, Select/Random/Done/Cancel pickers, back-row and wall-off rules | 3 · Board: size steppers + diagram (now shows X/O marks), Missing squares with Pairs 1–5 and Where + Select, Black holes' Where + Select; `SquarePicker` = "mark the board" (X / O, partner filled in, dots where pieces start, rolled marks dashed; tap a rolled mark to keep it; back rows hatched; wall-off cells red dash) |
| Opponent/AI in the summary | 4 · Who's playing: A friend / The demonstrator plays Dark or Light, How well it plays (chassis state via setup extras) |
| CONFIGURATIONS (saved presets) | 5 · Carbon copies: name + File a copy, pink slips with Use / Throw away (confirm); `localStorage["el-cabeza:tienda-orders"]`, rules only |
| Collapse, toll, sphere (the ceremony) | "Place order & play": ORDER FILLED rubber stamp + the register rung up (`audio.playOrderFilled`), form goes, game begins |
| Board palette/FX; black hole orb; missing-square static | Chassis hooks `theme.buildBlackHoleVisual` / `buildMissingSquareVisual`: a felt pocket with a brass ring; a square cut through the board (plywood walls, the table in shadow) |
| In-game variants flyout (top left) | The sales slip: "Your order · N changes" price tag, unfolds (hover shows, tap pins) into the typed slip RULES / PIECES / BOARD; rules open their card; "Rules for this game ›" |
| Persistence across New Game, RETAIN/RECONFIGURE, Reset rules | Already shared (beginCustomGame registers reapply/reconfigure) |

- **Shared model** (themes/rules-selections.js, also Lluvia's): pieces incl.
  `block1x3`/`block2x3` (Lluvia signs 棒/板), `arcoSize`, `shove`,
  `missingCount` + `missingSpots` + `holeSpot` (spot + 180° mirror; `random`
  flag), `normalizeSelections` (old saves, `size` → rows/cols),
  `effective` defaults check, `fillSpots`/`randomizeSpots`/`refreshSpots`/
  `spotProblem` (ported from Neon's fillPairedSpots etc.), `lawsForEngine`,
  `lawWarnings`, `variantsOf(sel, labels)` (Tienda: RULES/PIECES/BOARD),
  `applySelections` honours hand spots (pieces set out round them; a
  clash with the classic opening randomizes it, as Neon does).
  `piecesFit` counts marked home-row squares. Tests:
  tests/rules-selections.smoke.mjs; e2e-tienda "everything the Singularity
  offers" pass (laptop).
- Fixed on the way: the old form said "Two squares cut out" but cut two
  pairs.

## Theme Lab (built): the same game in ten design directions (user request)

Page: `el-cabeza-lab.html` (apps/lab.jsx), built minified. It's a design
exploration, not a new game: ten complete visual systems over the one
chassis and engine, switchable live without touching the game. The ten
(ids in themes/lab/specs.js): 01 Swiss (`swiss`), 02 Bauhaus (`bauhaus`),
03 De Stijl (`destijl`), 04 Elementarism (`elementarism`), 05 Brutalism
(`brutalist`), 06 New Typography (`newTypography`), 07 Corporate Swiss
(`corporateSwiss`), 08 Neo-Brutalism (`neoBrutalist`), 09 Minimal Mono
(`minimalMono`), 10 Ultimate Fusion (`ultimateFusion`).

Architecture (engine → presentation adapter → config → primitives):
- `themes/lab/specs.js`: each direction as data: colors (semantic
  tokens), typography, spacing, borders, shadows, board, pieces,
  indicator/selection/landing kinds, ground, hud, animation, materials,
  lighting (incl. tone mapping + pitch), audio voice.
- `themes/lab/factory.js`: `makeLabTheme(spec)` returns an ordinary
  chassis theme module (same contract as themes/standard.js). The chassis
  can't tell it from any other theme.
- `themes/lab/paint.js`: every board, ground sheet, piece surface and
  piece mark painted on canvas (no assets). Board painters follow the
  live board size. Ground sheets are laid out in WORLD units around the
  board (right-hand band on wide screens, above/below on tall ones),
  since the camera looks straight down. Every painted texture registers
  a repaint; `repaintWhenFontsReady` repaints once the direction's web
  fonts arrive (canvas text drawn earlier uses a fallback face). Three
  r128 textures have no `userData`: use plain props (`__repaint`).
- `themes/lab/scene.js`: grids as merged box strips (hairline, ink,
  raised De Stijl bars, machined, groove, engraved, thick, crosshair
  ticks, Fusion channels), slab materials, pieces (material + optional
  back-face outline shell + a printed mark on the top face: Bauhaus
  circle/square/triangle, glyph letters, stencil codes with the square,
  serials, stickers, ID+coordinate), ten legal-move indicators (red
  corners, direction triangles, recessed field, vectors, hard frames,
  bullet + rule, brackets, pop tile, crosshair, a plate that slides out
  from under the board), black holes/missing squares, and the ground
  composition (sheet, forms, Mondrian bars, diagonal planes, plinth,
  offset shadow slab, console, machine bed) with a far underlay so the
  low setup view never runs off a sheet. Indicator opacity is the
  chassis's hot/cold value ×2.1 (at ×1 they read as stains).
- `themes/lab/ambient.js`: tone mapping/exposure per direction (flat
  ones use NoToneMapping so whites stay white), the ground, selection and
  hover markers drawn from the piece mesh's world footprint (the chassis
  itself only shows moves), landing marks (a piece mesh rebuilt somewhere
  new = landed) and capture marks (id gone), Neo-Brutalism's hard offset
  shadows. Ground and fx live in the scene, NOT the board group, so they
  don't turn when the board turns to face a player.
- `themes/lab/hud.js` + `css.js`: one HUD markup (id, turn number, side
  to move, moves/points/pieces/taken/time, last six moves, result) that
  ten stylesheets compose ten ways; semantic custom properties on :root
  (--bg-primary, --accent-primary, --border-width, --shadow-x, ...);
  the chassis's own UI restyled from the tokens. Compact strip on phones
  (max-aspect 3/2 or < 900px), the turn number floated in a reserved
  column. Session clock/initial counts are module-level (carry across
  switches). Turn changes play the voice's turn cue.
- `themes/lab/audio.js`: ONE AudioContext for the page, made on the
  first gesture and kept across switches; ten synthesized voices; every
  sound is a short enveloped node chain (zero-start, zero-end), at most
  24 at once, each released once on 'ended' OR by a timed backstop
  (headless Chrome never fires 'ended'); global volume + mute.

The carry (chassis): `ElCabeza3D` takes `carry` and `carryRef`.
`carryRef.current()` snapshots the game (pieces, turn, points spent,
turn snapshot, pending steps, log, history, holes, missing squares,
variants, winner, opponent, dock roll, camera) plus `settling` (a step
animating or the AI thinking). A mount with `carry` starts from it: no
opening replayed, dock in its corner, masthead relocated, view restored
(or top-down when `cam` is null: "reset presentation"). The engine's own
module state (board size, laws) is untouched by a remount. The lab waits
for `settling` to clear (≤ 4 s) before switching. The chassis also hands
themes a read-only `game` object in useSetupExtras (currentPlayer,
stepsUsed, turnBudget, log, status, winner, turns, selectedId,
hoveredId, pieceCount ...).

Lab controls: picker (01–10, swatches), ‹ › and [ ] step, 1–9/0 jump,
Random, Full screen, Hide interface (H), Sound on/off (M) + volume,
Reset presentation (view + interface, never the game), Return to game,
L toggles the panel, Esc / outside press closes it. The theme is kept in
?theme= and localStorage. Each switch shows a short curtain in the new
direction's colours and transition language (wipe, stack, bars, slice,
slam, set, flap, pop, fade, machine).

Test: `tests/e2e-lab.mjs` (state identical across all ten switches,
mid-turn; play continues; switch during a step waits; the ten differ in
faces/accents/HUD; every control; sound starts only after a gesture and
releases its voices; phone compact HUD, no sideways scroll).

## Nova on phones: the phone layout (chassis/MobileShell.jsx)

User brief: "a premium mobile version of Nova ... full interactiveness and
all options available, streamline and remove any cruft". Built as an
opt-in chassis mode, so only Nova changes: `apps/unified.jsx` passes
`mobileShell` to ElCabeza3D, and the chassis uses it when
`SHELL_QUERY` matches (≤ 700px wide, or a coarse pointer ≤ 520px tall —
a phone on its side). Desktop Nova and every other page (Neon, Standard,
Tienda, Lluvia, Cromo, Lab) keep the dock exactly as before.

- **What goes (on phones only).** The floating 3D dock piece (its render
  loop also pauses: `shellRef` in its tick), the dock panel
  (`display:none`, still mounted so theme refs and effects are safe), the
  ghosted full-screen and How to play corner icons, the Info pop-up
  under the title, the floating points counter and the floating piece
  card, the "AI Opponent: Dark" confirmation overlay.
- **What replaces it.** A menu button top right; the title top centre in
  setup and top left in play (`shellMastheadStyle`; smaller and centred
  over the board's side in landscape). One bar along the bottom (down the
  right side, bottom-anchored, in landscape) with three states:
  setup (First move, Opponent Human/AI, AI plays Dark/Light, Level, Begin
  Game, plus the theme's `shellSetupActions` — Neon: Anomaly beside
  Begin, Custom rules below), play (turn dot + status + points dots;
  Undo move / Stop here / Undo turn, or the chosen piece's description
  (tap = its MOVES tile), or a hint; the one view toggle), over (result,
  Move Log, New Game). A side's segment, once chosen, takes that side's
  colours (and glow in Neon). The menu sheet: How to play, Rules in this
  game, Move log, End game (second tap confirms) / New game / Take back
  the last turn / Reset rules, Top-down / Player view, Full screen, Sound,
  Points left, Move costs on the board, the page's own items (Nova:
  "Switch to Neon / Standard", which opens the same CONNECT/DISCONNECT
  prompt the 4 s title hold ends in — the hold still works), About,
  version. Everything calls the chassis's own handlers via the `ctl`
  object; nothing is reimplemented.
- **Framing.** The bar reports fixed insets per orientation (portrait:
  top 60, bottom 122, plus safe areas; landscape: right = bar width) and
  the chassis's `resize` uses `camera.setViewOffset` to centre the
  picture in the free area, widening the fov by the virtual image so a
  camera distance draws the board the same size. `fitRadiusToCorners`
  fits within the free area; Top-Down View uses 0.94 of it on phones.
  An insets change mid-game (rotation) re-measures both views and
  re-applies the one showing (`viewMode`). The pre-game framing fits
  between the title and the bar's top (the whole height in landscape)
  and refits when the bar grows (ResizeObserver).
- **Theme hooks.** Neon's turn halo and glitch label refs move to the
  bar's dot and status (the halo's `--ec-halo-intensity` now drives the
  dot's glow). The bar and menu button fade out while a Singularity
  phase is running (`ctl.hidden`); the camera insets are dropped only
  from blackout on (`ctl.fullFrame`), so nothing shifts mid-collapse and
  the sphere is framed on the whole screen. `html.ec-shell` moves Neon's rules flyout under the
  title row. The rules overlay becomes a full-width bottom sheet with a
  close button. Neon's SINGULARITY invite text now fits a portrait
  phone on every page (`min(13vmin, 9vw)`).
- **Page.** Nova is built with `viewport-fit=cover` (safe-area insets are
  read from a probe element), and the browser's theme-color follows the
  theme.
- **Test.** `tests/e2e-nova-mobile.mjs`: portrait (dock gone, setup
  choices, framing between the bars, piece description, Undo/Stop here,
  view toggle, every menu row, switches, rules sheet, End game, Move Log,
  New Game, theme switch to Neon, Anomaly, Custom rules invite fits),
  landscape (bar on the right, title and board clear of it), and desktop
  Nova / Neon's own page on a phone keeping the dock.

### Follow-up decisions (user answers)
- **Desktop Nova: both layouts.** `apps/unified.jsx` keeps a layout
  preference (`el-cabeza:nova-layout`, "dock" default | "bar") and passes
  `mobileShell.preferBar` + `onLayoutChange`. The chassis shows the bar
  only when `preferBar` (it used to force it on phones, `SHELL_QUERY`;
  gone: the user wants the floating 3D piece on phones too, "Nova is
  missing the non-mobile setup screen where you just have the floating 3D
  piece", so the dock is the default everywhere and the bar a choice).
  The dock's icon row has a layout icon (`layout-toggle`, bar glyph) and
  the bar's menu "Use the classic dock" (`shell-menu-layout`, "The
  floating piece"), on every screen. On a wide screen (> 700px, not short) the bar floats as a
  centred 600px panel 16px above the bottom; the side bar is only for
  short wide screens (height ≤ `SIDE_MAX_H` 520, MobileShell.jsx).
- **Board facing (all themes).** The pre-game board now faces the side
  that moves first (`boardNearSide` follows currentPlayer during setup
  only, frozen in a game — following it every turn flipped the dock
  piece's colour mid-game and broke the Lab's mid-step switch), snapped
  on arriving at setup; switching First move turns it on the usual
  damping. It used to be a random roll.
- **Neon's custom-rules emblem** (VariantsFlyout) only shows in a game
  that has custom rules (`renderVariantsFlyout`).
- **Standard's wood sounds:** (superseded) the user once planned to
  upload recordings; they later chose Tienda's synthesized knocks instead
  (see "Wood sounds: Standard uses Tienda's").

### Undo after a black hole or a shove (user bug report, video)
Undo turn replayed an AI Cabeza's wormhole step backwards as a plain
step from the ejection square, so it slid off the board's edge and
streaked across it. Steps that can't be played backwards now record
where things started: `from` (the mover), `teleports`, `shovedFrom`
(pushed pieces), set in commitRef. `reverseStep` (used by both Undo move
and Undo turn) jumps a teleported piece straight back (a landing knock,
no path) and puts pushed pieces back after the mover rolls home.
Test: tests/e2e-undo-wormhole.mjs (hook `__EC_TEST_SET_HOLES__`); it
fails on the old build (0.91 squares off the board).

Tienda's box lid reads "No. 4417 · Made in Argentina · © 1975" (the
game was conceived in Argentina; it said Made in U.S.A.).

### Tienda floor flicker (user bug report, video)
The floor was one big plane with the tan aisle "racetrack" laid on top as
two coplanar bands held apart only by polygonOffset; the bands overlapped
each other at the crossing (the court, under the display table) with the
same offset and z-fought there, tiles flickering in patches as the view
moved. Now the floor is non-overlapping pieces at one height
(`floorRect`: the aisle cross + the four areas around it), textured by
WORLD position so tiles line up across piece edges. Don't lay coplanar
floor layers again; cut the geometry instead.

### Tienda piece-base outline flicker (user bug report, video)
The dark line under a piece (most visible under the Cabeza) broke into
dashes that changed as the view turned, close and low. Cause: the outline
shell's floor sat flush with the board top (`y + OUTLINE_T`, the original
Standard's "zero gap" choice), and the strip of it in front of a piece's
base IS the outline there. A cylinder cap is a fan of long thin wedges
whose depth is only approximate at a low angle, so in patches the board
won. Reproduced on SwiftShader (radius 9, phi 1.2, orbiting the Dark
Cabeza) and isolated: hiding shells removed it; the shell's shadow, all
shadows, and the board's constant offset (units 3 -> 12) changed nothing;
a slope-scaled board offset (factor 1) fixed it but is the thing the
chassis's slab notes warn against (a shell dipping below the board
mid-roll would show through). Fix (themes/wood-set.js): the shell's floor
is `SHELL_LIFT` (0.003) above the board, geometry not depth bias; 0.002
and 0.004 also held close up (from across the table SwiftShader, with
no MSAA, breaks the sub-pixel outline everywhere, top rim included, so
far views there can't judge it). Themes export
`outlineYOffset = OUTLINE_Y_OFFSET` (OUTLINE_T + SHELL_LIFT), so the
chassis strips the whole lift before a roll and a rolling shell is
centred as before. Test: tests/e2e-outline.mjs (Tienda and Standard: at
rest every shell floor at SHELL_LIFT and every body on the board; mid-roll
shell centred on the body; lifted again after). Cromo, Lluvia and the Lab
scene build their shells the same flush way (not changed).

### Sound channels (user request: music off, pieces on)
A theme can export `soundChannels` ([{ key, label, hint }]) and give its
audio `setChannelMuted(key, off)`. Then the dock's speaker button
(`sound-button`) opens a sound menu (`sound-menu`, fixed above the
button, since the dock scrolls) instead of toggling mute: All sounds
(the old master mute, `sound-all`) and each channel (`sound-ch-<key>`).
The choice is kept in localStorage (`el-cabeza:sound-channels`) and
applied when the audio is made. The speaker glyph shows a slash when all
is off and one wave when some channels are. The dock's outside-press
close ignores presses in the menu; closing the dock closes the menu.
Tienda (tienda-audio.js): gates on music (after musicBus, and the tape's
direct reverb send), store (ambBus, farBus) and pieces (sfxBus: wood,
paper, register). The music keeps playing under its gate, so it picks up
where it is. Note for tests: Chrome doesn't update a gain's `.value`
readback while nothing sounds through it — play a move before reading
the pieces gate. Test: tests/e2e-sound-channels.mjs.

### Nova's sound menu (user request: "the same sound menu" as Tienda)
Neon exports `soundChannels`: Ambience (the hum/crackle bed and its
far-off events: `ambienceGate` after introGain), Pieces (select,
deselect, blocked, landing, capture, win) and Interface (menus, rules,
dock, CONNECT, the Singularity, and the bell's own bus). Every Neon cue
connects to `sfxGain`, which is now the interface gate; the piece cues
are wrapped in `pieceCue`, which points `sfxGain` at the pieces gate for
the (synchronous) call. The landing reverb sends to the pieces gate. Both
gates feed `sfxOut` (the old 1.25 sfx level). `__EC_TEST_AUDIO__` reports
`channelsOff` and `gates`. Standard (the den) has two channels, The room
and Pieces. On a phone (MobileShell) the menu's Sound becomes
"All sounds" with the channels indented under it
(`shell-menu-sound-<key>`). The storage key is shared across pages, so
"pieces" off carries between Tienda and Neon. Test:
tests/e2e-nova-sound.mjs.

### Side buttons in the side's material (user request, Tienda)
Anything that stands for a side (Human / AI side buttons, Stop here /
Begin, the AI-chosen pill, the turn and winner dots, the move log's
column dots) takes its fill from chassis `sideFill(side)`: a theme's
`sideSurface(side)` ({ background, color, textShadow }) or the flat body
colours. Tienda's is the pieces' own wood: tienda-showcase.js
`woodSwatch` renders a strip of `woodMaterial` square-on under the
store's lights and renderer settings (one short-lived WebGL context per
side, cached as a JPEG data URL). Ink: cream with a dark bed on walnut,
near-black with a pale halo on olive ash. With a material, unpicked side
buttons are NOT faded (the 0.35 fade washed the wood grey, which was the
complaint); the pick gets an ink ring instead (`pickedMark`). The order
form's "The demonstrator plays Dark/Light" buttons do the same (`td-wood`).

### Wood sounds: Standard uses Tienda's (user request)
themes/wood-sfx.js holds Tienda's block knocks (hit, select, deselect,
blocked, rollStart, landing, capture), used by both themes. Tienda's
board is "folding" (hollow knock + table thud, unchanged); Standard's is
"solid" (tight filtered-noise knock + short thud, nothing hollow; the
user's choice), with a compressor and Tienda's small 0.6s room. The old
modal synth (scripts/wood-impact-synth.js) is no longer used.
Landing pitch follows the face that lands (user rule): the chassis passes
`playLanding(cubes, contactArea(landed))` (engine/shapes.js: bottom-level
cubes, or w*h). `landingSize = contact * cbrt(cubes)`: a cube is 1, a
2x2x2 flat 8 (as before), a 1x3 on end 1.44, on its side 4.33. Without a
contact (older callers) it falls back to the cube count. Test:
tests/e2e-wood-sounds.mjs (also renders every cue offline on both boards:
audible, under full scale, bigger face = lower).

### Tienda: fewer phone rings and PA announcements (user request)
The store's random events (tienda-audio.js scheduleEvent) had the service
desk phone at 12% and the PA at 14% of picks. Both halved (6%, 7%); the
share they gave up is a quiet spell (no event), so carts, the register,
steps and the door come exactly as often as before. The closing
announcement at the end of a game is not random and is unchanged.

### Singularity: the sphere keeps its size (user report, Sep 27)
"In SINGULARITY, the sphere is much smaller now...what happened?" The
sphere (radius 6, at the board's middle) took its size from wherever the
chassis's camera was when the cinematic began. Measured against the build
before Sep 27 (the Neon page and Nova; phone, laptop and 1100x900; the TV
path, the bar and the floating piece), the board's fitted view hadn't
changed, but zoomed out (up to ZOOM_MAX_FOR_BOARD, 55) the sphere came
out about half the size, the likely cause. Now the chassis keeps the last
fitted radius (`lastBoardFitRadiusRef`, not cleared when play starts,
unlike preGameFitRadiusRef) and gives themes
`three.current.boardFitScale()` (the view's radius over it), and
`fitSphereToScreen` (neon-singularity.js) scales the sphere's frame by
it on arrival and every frame of the sphere phase: the size it has at
the fitted view on that screen (phone 317 px of 390; 1100x900, 649 px),
zoomed out or in. A first try at a fixed share of the screen matched a
phone and a laptop but shrank it on squarer windows (1100x900: 547 px
against 649) and broke the Singularity test's bare-sphere tap, so it's
the fitted view's size instead.

### The Room view, and the camera left where you put it (Sep 28)
The user: "I do want a dollhouse view... something that can just go to
maximum zoom out... something keeps causing it to zoom back in", and
asked for ideas.
- **The Room view** (a theme with `freeCamera.dollhouse: { radius, phi
  }`: the den 150 / 0.68, the store 82 / 0.6): up above the room at a
  slant, the heading as it is, the target back at the middle; the den's
  ceiling (and a wall the camera's past) steps aside as ever, so it's
  the room with the roof off. `cam.current.dollhouse` sets the room box
  aside until the camera, both where it's going and where it is, is back
  inside it (applyCamera), so pinching or scrolling back in glides down
  into the room without a jump (measured: the height falling 108, 99,
  90 ... 40 in steady steps). Buttons: a little house above the
  full-screen button (`room-view-corner`, any time, setup included; a
  card-coloured disc like the others in the den and the store), "Room
  View" beside Top-Down View in the dock during a game (`room-view`),
  and "Room view" in the phone's menu (`shell-menu-room`).
- **Zooming back in by itself**: before Begin Game the setup framing
  refits the camera on every window resize, and on a phone the browser's
  bars sliding in and out as you drag fire resizes. It now leaves a
  camera the player has moved (zoomed, panned, turned, or in the Room
  view) where they put it (`fitted` / `moved()` in the framing effect).

### The chair's end table; the Room view lower (Sep 28)
- "A small, era correct table next to the chair with a book on it": a
  walnut end table beside the club chair on the side away from the lamp
  (den-room.js, in the chair's frame: 6 out from its side, top 10.8 up,
  a little over the arm): a 9.2 square top with a softened edge, four
  round tapered legs, a shelf at 3.2. The book is to be the user's own
  image of "Abstract Strategy: How the Masses Are Demanding the
  Future... Now!" by Dr. Alistair Finch-Hatton, exactly ("it must be
  this exact book"). The photo (the book lying at an angle) was squared
  up with a perspective warp from its four cover corners (242,36),
  (636,98), (410,450), (12,356) of 649 x 563: assets/den/book-cover.jpg
  (512 x 640), and the two page faces it shows the same way,
  book-tail.jpg (with the red ribbon) and book-fore.jpg (brightened,
  it's in shadow in the photo). On the table (den-room.js): a 3.8 x 4.75
  x 1.0 block of faces (cover up, tail, head from the tail's pages,
  fore-edge, the spine in the cover's orange wrap), turned 0.32 off the
  chair's line, its ribbon trailing out onto the walnut. (An inline
  picture reaches the session only to look at; this one came as a file,
  images/21.webp.)
- "Dollhouse view is a tad too high": the den's Room view from 150 /
  0.68 (116 up) to 118 / 0.78 (about 83 up, still well over the ceiling
  at about 40).

### The floating piece's hit area is its outline (user report, Sep 28)
"The 3D floating button is a hitbox, but it's still too large... no
matter the piece size, they're all defaulting to the OPA hitbox size.
But even the OPA itself might be too large." The dock piece's canvas is a
fixed frame (260 x 220 on a laptop) sized for the largest piece, and
every pointer event on it went to the piece (dockHitFraction only
narrowed what a click opened). Now `clipToPiece` (the dock piece's loop)
projects the piece's points each frame, wraps them in their convex hull
grown 4 px (9 px for a finger), and clips the frame's mount to it
(clip-path decides where the browser delivers pointer events): a tap
beside the piece reaches the board beneath, and the piece is always drawn
inside its own hull. `isInsideDockHitbox` tests the same hull. Measured
over three sessions: hit shapes 130 x 97, 69 x 75 and 60 x 37 against the
260 x 220 frame; the frame's corner hits the board; a tap beside the piece
doesn't open the dock, one on it does. A drag keeps its captured pointer.

### The snack bowl (user screenshot, Sep 28)
"Snacks protruding from the exterior of the bowl": the pieces were
strewn out to 1.75 from the middle, but the teak bowl narrows toward its
foot (1.1 at the bottom, 1.8 at 0.45 up, 2.1 at the rim), so a piece near
the edge sitting low went through the wall. Each piece now has a `reach`
(how far it sticks out, turned any way) and is pulled in until it clears
the wall at the height of its own lowest point (`wallR`, from the lathe
profile, 0.06 inside); the heap rises toward the middle, so moving in only
lifts it.

### A two-finger pan is never a swipe (user video, Sep 28)
Panning with two fingers toward the den's fireplace, the view snapped to
Top-Down View: a quick two-finger pan down the screen met every test of
the two-finger downswipe (60 px, mostly vertical, the spacing kept,
under 700 ms). A swipe is now a flick: under 350 ms, at least 70 px, and
still moving at 0.7 px/ms or more over its last 100 ms when the fingers
lift (chassis `releaseSpeed`, `twoFingerTrail`); a pan settles as it
arrives. Checked with timestamped CDP touches: a flick (220 px in 0.24
s) still gives Top-Down View; a steady pan (260 px in 0.6 s) and a quick
pan easing out (200 px in 0.32 s) leave the view where it is.

### Sliders for the sound, the mouse wheel, the den's sofas and table (Sep 28)
- **Sound sliders** ("sliders instead of toggles to balance sounds mixing,
  with a slide all the way to the left muting that channel"): the dock's
  sound menu and the phone's menu sheet have a slider per channel (Tienda:
  music, store, pieces; the den: the room, music, pieces; Neon: ambience,
  pieces, interface) and "All sounds" over them. A channel's level is 0..1
  (localStorage `el-cabeza:sound-levels`; a switch left off before
  carries over as 0), heard as its square (`chGain` in tienda-audio.js,
  den-audio.js, neon.js: `setChannelLevel`), so halfway is a quarter of
  the gain, about evenly spaced by ear. All sounds is a master level
  (`el-cabeza:sound-master`) multiplying every channel; all the way left
  is the mute it always was (audioMuted, onMutedChange). The inputs keep
  the old testids (`sound-all`, `sound-ch-<key>`, `shell-menu-sound`,
  `shell-menu-sound-<key>`) with `data-level` 0..100. Themes with no
  channels keep their single Sound switch.
- **The mouse wheel** ("scroll out quickly... it stutters, and rezooms
  in"): the wheel's trackpad-flick gesture (320 px of scroll within 160
  ms: down = Top-Down View, up = Current Player View) caught a mouse wheel
  spun quickly (four or five 100 px notches), jumping to Top-Down View,
  closer in. A burst with a mouse notch in it (deltaMode not pixels, or
  |deltaY| >= 50 with wheelDeltaY a multiple of 120) or a trackpad pinch
  (ctrlKey) never counts as a flick. And the wheel zooms by a share of
  the distance (exp(0.0009 x deltaY): a notch is about 9%), with Firefox's
  lines counted as 33 px, so a room is crossed in a few turns.
- **The den's sofas** (user video: far out, circling, the near sofa
  vanished): a sofa side steps aside only when the camera is within 22 of
  its back (den-room.js `blocks`); from across the room it stays.
- **The coffee table's plinth**: no key-light shadow (the shadow map's
  tight ±9.5 frustum ended partway across it, cutting the top's shadow off
  in a line that slid about as the view turned), a shade darker instead.
- **Starting the story over** now reads "Once more, from the top shelf."

### The den: the rubber plant, and the speakers swapped (user report, Sep 27)
- **The rubber plant by the glass** ("needs to be fixed", a screenshot):
  it was an orange cylinder with a cluster of flat blades (leafCluster)
  floating 2 above its rim, nothing joining them. Now `rubberPlant`
  (den-room.js): an avocado-glazed pot with a rolled rim on its saucer,
  soil, three woody stems (15, 20, 26 high) leaning a little apart, and
  big oval leaves (`ovalLeaf`: a short stalk, widest below the middle,
  cupped, the tip drooping) one after another up them at the golden
  angle, largest low down, each face turned a little about its line so
  the blades show round the room; at each stem's top, the rosy sheath
  of the next leaf. Materials M.rubberLeaf (0x3c6a2e), M.sheath.
- **The speakers swapped**: the vase beside the lamp threw the room's
  balance off, so now the philodendron is on the left-hand speaker (x 46,
  by the lamp) and the bottle vase on the right (x -10), across from the
  ashtray.

### The den: zoom out to the ceiling, no snapping back (user report, Sep 27)
"I want to be able to zoom out more at home... you pinch too far, it just
suddenly snaps back... zoom literally all the way to the ceiling, and not
have it act weird."
- **The snap** was the two-finger swipe (a fast, mostly vertical move of
  the fingers' midpoint, 60 px in under 0.7 s: up = Current Player View,
  down = Top-Down View). A quick pinch with one finger still (the thumb
  at the bottom, the index going up or down) moves the midpoint half as
  far as the pinch, and was taken for a swipe. A swipe now also has to
  keep the fingers' spacing (within 40 px or 25%); a pinch changes it.
  All themes (chassis onUp).
- **Out to the ceiling**: the den's `freeCamera` has zoomMax 140 and a
  `room` box (board frame: 9 in from the walls, clear of the shelves,
  console and fireplace; up to 4.2 under the ceiling, below its beams).
  The chassis's applyCamera keeps the camera inside it, sliding in along
  its line of sight to the target, and out again as the view turns away
  from a wall; `roomLimitRef` is how far the box allows along the
  current view, and a pinch or the wheel starts from the distance you
  can see (min(radius, roomLimit)), so there's no hidden overshoot to
  wind back. Tested with CDP touches stamped at a finger's pace
  (`timestamp`; the test browser is too slow for the 0.7 s window
  otherwise): a quick pinch with the thumb still and the index sweeping
  360 px to it in 0.26 s now zooms 44 -> 81 with the tilt kept (before,
  its 180 px of midpoint travel made it a downswipe: Top-Down View), and
  a real two-finger downswipe still gives Top-Down View. e2e-den's
  overhead check now expects the camera to stop under the ceiling (it
  used to go above, the ceiling stepping aside).

### Tienda: the table's shadow (user report, Sep 27)
"The shadow underneath the tienda table is consistent no matter which
way you spin it around. It's a little bit too dark... should be cast...
not equally." It was a round blur (shadowBlob, 0.7) centred under the
table, turning with it. But the key light (chassis, fixed in the world
at (9, 13, 5)) stays put while the board, the table and the store turn
(the board turns, not the camera), so the pieces' shadows on the top
swung round as you spun and the floor's never did. Now two layers
(tienda-store.js buildTable):
- **From the ceiling** (`tableShadow`): baked once per table from the
  store's own troffers within 110 (six points each over its 4 x 2 ft
  face, weighed h²/d⁴), blocked by the top, the stock shelf and the
  legs; SHADOW_MAX 0.46 (under the shelf), about 0.1 just outside. There's
  a fixture almost straight overhead, so this layer is nearly even.
- **From the key light** (`setKeyDir`, called every frame from
  tienda-fx.js with the light's direction in the board's frame): the
  top's shadow (0.24) and the shelf's (0.2), soft-edged rectangles
  moved away from the light by their heights, and the four legs'
  streaks to the top's corners (0.18). It lies where the pieces'
  shadows point, and moves as the board turns.

### Tienda: the mall reels (user request, Sep 27)
The user sent five tracks (Coupon Gloss Reverie, Twilight at the Atrium,
Tuesday Morning At The Atrium, Tuesday Night at the Emporium, Midday
Clearance Sale) and asked for a Python script to wear them into a worn
background-music tape over a 1975 mall PA: `tools/muzak_1975_filter.py`
(pydub, scipy.signal, numpy; `input_tracks/` -> `mall_master_1975/`,
natural sort, 1:30-3:00 held, 256 kbps). Its chain, in the order the
sound travelled: mono fold-down; mid pre-emphasis, asymmetric tanh
saturation, de-emphasis; hiss (white noise, 1st-order 5 kHz low-pass) 48
dB under the programme; wow 0.6 Hz 0.25% and flutter 14 Hz 0.12% by
resampling along a modulated read position; random -3.5 dB PA dips with
200 ms linear ramps; 4th-order Butterworth band-pass 250-4500 Hz and a
+3.5 dB peak across 1.2-1.8 kHz; a 45 ms slapback at 15%; a synthesised
stereo atrium impulse response (RT60 2.6 s, above 3 kHz 0.7 s, early
reflections) at 22% wet; -19 dBFS RMS, peaks under -1 dBFS. Measured:
under 120 Hz down 35-43 dB, nothing above 10 kHz. The treated tracks
went to the user as files.
Asked whether they should be the store's music, the user said "Yes but
treat them again": so they're reels in the store's rotation, through
the store's own tape machine (0.94 speed, its wow), ceiling speakers and
room, like the 1974 recording. Store copies: assets/tienda/reel-2..6-*.mp3
(mono, 22.05 kHz, 48 kbps, 0.7-1 MB, levelled to the 1974 reel's
loudness), published beside the page as el-cabeza-tienda-reel-2..6.mp3
(build.js `files`; Nova's store reads the same files). tienda.js
`STORE_REELS`; tienda-audio.js `createAudio({ tapeUrls })`: the reels
take turns with the arrangements, the next reel each time, round and
round; each is fetched when it's next up and decoded ahead while the one
before plays, and let go once played (two decoded at most); a reel that
can't be had is skipped; a game's end keeps the current reel's place.
Test hook `__TIENDA_NEXT_REEL__()`; e2e-tienda checks reel 2 follows.

### Tienda: the ceiling speakers' music at half (user request, Sep 27)
"Music over PA speakers in Tienda volume should be cut 50%": the music
(the tape and the arrangements) now goes through `MUSIC_VOLUME` 0.5
(tienda-audio.js), a gain after the speakers' crunch (so the sound is
the same, only quieter), and the tape's extra send to the room's tail is
halved with it. The PA announcements, the store and the pieces are
unchanged.

### Piece guide switch (user request: helpers off for players who know the game)
`showGuide` (chassis; localStorage `el-cabeza:piece-guide`, on unless
"0") gates the piece card (`pieceCardShown`), and on a phone the bar's
piece text (`pieceInfo`) and its "Tap one of your pieces / Tap a marked
square" tips. Switched from the dock's corner (`guide-toggle`, a speech
bubble glyph, struck through when off; the Nova layout icon moved one
place left) and from the phone menu's Settings (`shell-menu-guide`). It
doesn't touch the move markers (you move by tapping them) or the cost
badges and points dots, which have their own switches. Every version
uses the chassis, so all of them have it. Test: tests/e2e-piece-guide.mjs.

### MOVES: a side view wherever a piece tips (user request)
chassis/RulesCards.jsx (one MOVES card for every version). Every tile
whose demo rolls or tips a piece now has two panels, ABOVE (a 4 x 3 mini
grid) and SIDE (the floor at y = 48, 12-unit cubes, columns SX(c) = 66 +
12c ticked along it), animated in step: Roll, Opa (the 2 x 2 turning about
its edge, two squares), Tall pieces tumble, Crush (the disc flattens as
the block lands), Free way back (tips there and back; the refund dots in
SIDE's corner), Shelter, Shove by rolling (NEW tile `shoveRoll`, law
shoving: a standing Flaco tips and pushes a Turrito two squares; the push
runs linear, keyframed a step ahead of the tip, so they never overlap),
Pivot, Black hole (holes are gaps in the SIDE floor, `panelsWith([1,3])`:
it tips in and drops, rises out of the other and tips back west; ABOVE
moves and shrinks on separate nested groups so it shrinks INTO the hole),
Split Movement (both moves now east so the side view shows them: a
Turrito, then a lying Flaco's end rolling over its long side), Missing
squares (a gap in the floor; the block rolls, tips toward it and settles
back, a nested rotation about the landed cube's far edge). No side view,
as the user said (nothing tips): Cabeza step, Reach the far row, Slide,
Diagonal Slide, Shove (the slide one), 3 Actions. Test: e2e-rules checks
which tiles carry SIDE (17 tiles now).

### Standard: the den (user request: the game at home)
The user: "they went to the store & ended up buying a copy and bringing
it home and are now playing it in their den / family room / sitting room
/ conversation pit" (three 1970s reference photos). The questions were
dismissed, then "go ahead", so these are the defaults, open to change:
Tienda's copy of the board and pieces, a sunken conversation pit, quiet
fire/clock/rain sounds (switchable), den-coloured menus with the rules as
the box's booklet. Landing knocks stay on the solid board (their earlier
choice).
- **Wood set:** themes/wood-set.js `createWoodSet({env, quality, lights})`
  holds Tienda's board texture, slab, grid, pieces, markers, missing
  squares, black holes, the brass frame, followGrain and woodSwatch.
  tienda.js and standard.js each make one with their own lights and
  environment panorama (store / den), so the wood reads right in each room.
- **The room** (themes/den-room.js `buildDen(boardSpan)`): the board sits
  on a walnut coffee table (`buildCoffeeTable`) in the middle of the pit:
  sofas (rust corduroy, print pillows) on the north, south and west, steps
  up on the east. North: fieldstone fireplace (a ShaderMaterial flame and
  glow sprites), mantel, a sunburst clock showing the real time, books.
  East: a sliding glass door onto a rainy night yard (the rain runs), drapes.
  South: console TV (screen colour 0x070a09: anything brighter reads as
  switched on), stereo, records, landscape, table lamp. West: floral paper,
  credenza, two lamps, abstract painting, macramé hanger. Middle: velvet
  chair, plaid ottoman, arc lamp, rubber plant; swag lamps overhead.
  On the table: the closed box (the lid art), the leaflet, two iced teas
  on coasters and a bowl of party mix. Textures are all canvas-painted
  (themes/den-textures.js), no image files except the lid art.
- **Lighting:** the room is unlit (`MeshBasicMaterial` + vertex colours
  baked from `LAMPS` with falloff and wrap, world-planar UVs), merged per
  material and group by `Builder`: about 120 draw calls for the whole
  room. The table and what's on it are lit, so the board's shadow falls
  on them and they match the pieces.
- **Everything hangs off `boardGroup`**, so turning the board reads as
  walking round the pit; rebuilt when the board size changes (table
  `TW = span + 16`, pit half-width `PH = TW/2 + 22`). Fog 0x1c130c
  150-420, background 0x140d08, camera far 900 (den-fx.js).
- **Cutaway:** groups `den-sofaN/S/W`, `den-wallN/E/S/W`, `den-ceiling`.
  `den.animate(now, camLocal)` hides a sofa when the sight line from the
  camera to the table passes under its back or seat (a low camera pulled
  back would otherwise be inside it), a wall once the camera is past it,
  the ceiling once the camera is above it. Don't remove it.
- **Device fit:** tienda-quality.js tiers (pixel-ratio cap, shadow map,
  physical materials) and the same frame-rate governor as Tienda.
- **Sound** (themes/den-audio.js): The room (fire bed, hiss and crackles;
  the clock ticking the real seconds; rain, drops, rare far thunder) and
  Pieces (wood-sfx.js on the solid board plus a small room reverb). The
  room starts on the first gesture. Win: a marimba figure.
- **Menus** (standard.js `styleSheet`, `COLORS`): cream masthead with a
  warm glow, dock card and chips in den browns; the rules pop-up is the
  box's booklet (double inset rule, Bodoni headings).
- Games still open top-down (earlier user rule), so the room shows at
  setup, in player view and when orbiting or zoomed out.
- **Test hooks:** `__DEN_ROOM__` (true while mounted, false after
  dispose), `__DEN_THREE__` (with `__EC_TEST_HOOKS__`), `__DEN_QUALITY__`,
  `__DEN_PIXEL_RATIO__`, `__DEN_AUDIO__()`. The chassis's
  `__EC_TEST_CAM__({theta, phi, radius, target})` moves the camera
  (the wheel zooms, but slowly under SwiftShader).
  Test: tests/e2e-den.mjs.

### The den, round 3 (user requests, Sep 27)
- **No wind, for real.** The "wind" the user still heard was the fire's
  roar breathing: its bed was re-aimed every 0.6–1.5 s (random gain and
  cutoff) and louder near the fireplace, which reads as gusts. It's now a
  steady brown-noise bed (lowpass 300 Hz, gain 0.022) under the crackles
  and pops, which still come and go (den-audio.js startFire).
- **The stereo's speakers**: pottery on the left one, a plant on the right
  (they had the same plant): a studio-pottery bottle vase (lathe, a dark
  tenmoku glaze run over speckled oatmeal, the foot raw: `glazeTexture`)
  on the left as the player faces the console (den x 46; den x runs right
  to left from the pit), the heartleaf philodendron on the right (x -10).
  (Later swapped, "The den: the rubber plant, and the speakers swapped".)
- **The hall's wallpaper** differs from the room's flowered accent wall:
  `hallPaper()` (den-textures.js), a period geometric of interlocking
  avocado and harvest-gold rings with orange dots on cream,
  `HALL_PAPER_TILE` 16, on the hall's three walls.
- **Diagonal Slide brings Slide** (Neon's sphere, neon-singularity.js):
  checking Diagonal Slide checks Slide, and unchecking Slide unchecks
  Diagonal Slide, as Tienda's order form (rules-selections.js
  `toggleLaw`) and Lluvia's city menu (lluvia-overlay.js) already did;
  the other live pages have no law menus of their own.
- **The rooms look around** (`freeCamera`, §5) and **the floating piece on
  phones** (Nova, "Follow-up decisions" above).

### The store's standee, the den's chair and the ice (user reports, Sep 27)
- **The store's standee** (user video: orbiting wide round the table,
  "the camera goes behind it... blocks everything out with just a brown
  color"; "zoom out a little bit more in the tienda"). Tienda's zoom now
  goes out to 82 (`freeCamera.zoomMax`; the board's own limit was 55),
  far enough to go round the advertisement's stand and see it from
  behind. And the standee fades out of the way (0.25 s; back in 0.35 s)
  when the camera is in it or behind it looking through it at the table
  from close enough that it would cover about 45% of the screen's width
  (tienda-fx.js `standeeAside`; tienda-store.js `standee`: the photo,
  the stand, and its NOW IN STOCK card, now a mesh of its own rather
  than part of the signs' one mesh, their materials transparent). From
  the front, or behind but off to a side, it stays. Test hook:
  `__TIENDA_STANDEE__` (its opacity).
- **The den's club chair** ("the olive stairs structure is incorrect"):
  the back was placed with the wrong sign across the chair (sin of the
  turn where it needed minus sin), so it stood off to one side of the
  seat, and with the low arms it read as steps. It's rebuilt in its own
  frame (den-room.js, `part` about `chX, chZ, chR`): a skirted velvet
  base on four walnut feet, the back and both arms standing on it the
  full depth, a seat cushion between the arms and a back cushion
  against the back; 15 wide, 14 deep, the back 14 high, facing the room.
- **The ice in the scotch** ("needs to be more submerged", a close-up
  of the coffee table's tumbler): the cubes sat on the surface, one
  wholly above it. The whisky is a little deeper (0.9) and each cube
  floats with 0.05–0.13 of its 0.58 above the surface. The ice is drawn
  before the whisky and writes depth, so the whisky tints what's under
  the surface and not the tops (it used to draw over the whisky, which
  made the ice look as if it sat on it).

### The den, round 2 (user requests)
- **Sound** (den-audio.js): rain is a steady patter with drops on the
  glass and a drip from the eaves, no swells and no thunder (they read as
  wind; user: "no wind noise"). The clock is a woody tick-tock (filtered
  clicks, the tock lower), quiet, on the device's seconds; on the device's
  hour it plays the Westminster hour chime, the four phrases only (no
  counting strokes; user's choice), as a 1970s chime chip through a tiny
  speaker, quietly ("these people are trying to concentrate"). The fire's
  crackles are louder and have their own bus: den-fx.js calls
  `audio.setFireListener(distance, pan)` from the camera every 100 ms
  (nearer is louder, about twice as loud warming your hands as from the
  pit's middle, and panned to its side). Test hooks: `__DEN_CHIME_NOW__`,
  `__DEN_AUDIO__().fire`, `.chimes`, `.music`.
- **The stereo console** (den-room.js `buildConsole`, lit, not baked, so
  it holds up close): walnut cabinet, a turntable set into the top under a
  smoked lid (the lid lifts while you're over there, the platter turns and
  the arm swings in while a record plays), the receiver's amber dial and
  knobs, the 8-track slot with its four program lights (a cartridge sits in
  it while a tape plays), cabinet speakers with woven grilles, a golden
  pothos and a heartleaf philodendron trailing over them (user's choice of
  decor), a heavy amber-glass ashtray, a record sleeve. Its still parts are
  merged by material. Metals have low metalness: nothing in the room to
  reflect (fully metallic surfaces rendered black).
- **Music** (theme.music in standard.js; chassis): the sound menu's
  "Choose music" and the phone menu's "Choose music" open a small music
  panel (`music-panel`), and so does a tap on the turntable or the 8-track
  in the room (ambient `pickScene`, before the tap handler's play gates, so
  it works in setup, play and after the game; a piece or marker under the
  tap comes first). While the panel is open the camera glides to the
  console (ambient `setMusicFocus`; the chassis calls ambient
  `cameraOverride(camera, dt)` after placing its own camera each frame,
  and the den blends toward its view and back) and the dock steps aside.
  Each source lists its tracks or says it's empty; a track plays through
  den-audio `playMusic` (a little surface noise for vinyl, hiss for tape),
  on the den's own "stereo" channel (shown as Music; not Tienda's "music"
  key, since channel choices carry between pages; picking a track switches
  it back on). Tracks: themes/standard.js
  `DEN_TRACKS`, empty until the user sends them (see the wishlist).
- **Doorway**: in the south wall, left of the console as you face it from
  the pit (east of it; user: "on the left side of the stereo console"),
  its door standing open onto a hall with a light and a framed print. The
  glass door stays (user).
- **Table**: a stoneware mug of coffee on its saucer, a teaspoon on the
  rim; a heavy tumbler of scotch on the rocks; the bowl heaped with snack
  mix built piece by piece (peanuts, pretzels, cereal squares, rye chips,
  instanced), so it reads from the sofa.
- **The INFO booklet** (standard.js styleSheet): its double rule is inset
  shadows under the text, so the scrolling part now stops short of the
  rule and fades into it (user report: text scrolled into the margin).

## Nova's story: the store, home, and the TV into Singularity (user plan, Sep 27)

User: Tienda is "where the game starts... the basic game"; "purchase and
bring home" takes you to the living room, "where we're going to have
access to everything"; "to get to Singularity... there's a TV in that
room... click the on switch... that's going to take you into
Singularity". Asked, the user chose: Nova becomes the story (one link,
opening in the store; the separate pages stay as they are); the next
visit opens at home with the store reachable and "Start the story over";
the store's Custom rules becomes a look-only catalog of the five pieces;
every store game is the classic game; the purchase any time, and offered
after a store game; the TV: a 1975 wood console, the power knob, the tube
warming up from a dot, snow and a test pattern, the picture pulling you
in; leaving Singularity, back in the den as the set switches off.

- **Places** (apps/unified.jsx `THEMES`): `tienda` the store (Tienda's
  theme with `story: STORE_STORY`), `standard` home (the den, Standard's
  theme with Tienda's printed matter: `useSetupExtras`,
  `renderSetupExtras`, `renderExtraOverlays`, `shellSetupActions` from
  tienda.js with `story: HOME_STORY`), `neon` Singularity. The first
  place is the store unless `localStorage["el-cabeza:story"]` says
  `{ owned: true }` (apps/novaStory.jsx `readOwned`/`saveOwned`).
  The chassis keeps its theme object while mounted, so the story's
  handlers reach the app through module-level bridges (`storyBridge`,
  `tvBridge`) the app keeps pointed at its current handlers.
- **The store** (tienda-overlay.js with `x.story.mode === "store"`): the
  lid as ever on a first visit; "See the pieces" (the lid, the dock's
  setup row, the bar) opens `PieceCatalog` (`tienda-catalog`): the five
  pieces, photograph (tap: the 3-D viewer), catalog number, what each
  does, the price; Close or "Purchase and bring home". Below the setup
  row, "Purchase and bring home · $7.97" (`story-purchase`); in a game
  the sales slip has it (`tienda-slip-purchase`); after a game ends
  (finished or ended), the clerk's offer at the top (`tienda-offer`, ×
  dismisses); the bar menu's "Purchase and bring home"
  (`shell-menu-purchase`). No title hold in the store.
- **The purchase** (apps/novaStory.jsx `StoryCut`, kind "purchase"): the
  purchase is saved at once; the screen dims, the register rings it up
  (Nova's own sound engine: `sfx.register`, keys, ratchet, bell, drawer,
  the printer's hammers line by line, the tear; unifiedTransition.jsx
  `playRegister`), the tape prints out of a slot line by line (today's
  date in 1975, 1 EL CABEZA No.4417 7.97, tax .48, total 8.45, cash
  10.00, change 1.55) and is torn off; a tap skips to the black. Black,
  "Later, at home.", and under the black the den is mounted; the cut waits
  for it (`cut.arrived`, set by the app's effect after the new chassis's
  mount effects) plus two frames and a moment to read, then fades up.
  "Back to the store" ("Back at the store.") and "Start the story over"
  ("Once more, from the top shelf.": the purchase forgotten, the lid back on,
  `tiendaTheme.resetLid()`) are the same fade without the register.
  Arriving by a cut, the place's sound comes up (the store's; the den's
  room), or at the next tap if the browser holds it back
  (`story.arrived()`: false | "cut" | "fresh", read once).
- **Home**: the dock's setup row is Custom rules (the whole order form) +
  Begin Game, and under it "Back to the store" · "Start the story over"
  (`story-back-to-store`, `story-restart`); the bar has Custom rules below
  Begin Game and the menu "Turn on the TV", "Back to the store", "Start
  the story over". The order form's carbon copy (the slip) shows at home
  only in a game with ordered rules.
- **Each place starts with the classic game**: a scene change (a cut or
  the CRT transition) puts the engine's module state (laws, board size,
  black holes, missing squares) back to what the page booted with
  (`restoreBootRules`), since a remount leaves it alone.
- **The television** (themes/den-tv.js, placed by den-room.js, run by
  den-fx.js): a walnut color console of 1975 on a plinth: the curved
  picture tube in a black bezel with a chrome line, a brushed-gold panel
  (Aurora, SOLID STATE COLOR, the VHF selector with channels 2–13 round
  it, the UHF dial, the power knob with OFF · ON / VOLUME and a pilot
  light), a grille along the bottom, rabbit ears with a UHF loop, a
  snapshot in a frame. Lit like the console (it's visited up close), the
  screen a small shader: the dead tube's grey-green glass; switched on
  (`powerOn`), the knob turns with a click, a dot opens to a line and the
  whole screen (brighter while squeezed), snow, the test pattern (color
  bars, the reverse strip and low band, circle and cross-hair,
  "SINGULARITY · CANAL 99 · TEST") and the station's tone; its light on
  the room (an additive halo; a blue point light on better devices).
  Switched off (`powerOff`): the picture folds to a line, then a dot that
  fades. Sounds (den-audio.js, behind the Music switch): the switch's
  click, the degauss thump, the line whine (15.7 kHz, faint), the snow's
  hiss by phase, the tone, the pop going off.
- **Into Singularity**: a tap on the set (ambient `pickScene` → "tv",
  then `sceneTap`; the chassis lets a theme handle its own scene taps) or
  the bar menu's "Turn on the TV" (`shell-menu-switch-theme` at home;
  `tvBridge.press`). In Nova (`helpers.tv.portal()` true when nothing
  else is under way) the camera goes over to the set as it warms up
  (`cameraOverride`, fitting the set to the screen's width and height,
  up to 70 away on a tall phone), and once the pattern has held 0.7 s,
  the dive: the picture swirls toward the circle's middle and turns to
  Singularity's colours as the camera goes right up to the glass; 1.5 s
  in, `tv.enter()` → Nova's `beginTransition()` (the CRT transition into
  Neon, no CONNECT prompt). A tap on the set before the dive turns it
  off again. On Standard's own page (no `tv` helper) the set simply turns
  on and off.
- While the camera visits the set, the title and the dock's piece step
  aside (den-fx toggles `html.ec-tv-visit`; standard.js styleSheet). A tap
  on the board or the coffee table with the set behind them is the
  board's (pickScene checks they're nearer). The set's printing and
  pattern are drawn in fixed frames (256 x 352, 512 x 384) scaled to the
  power-of-two canvas, so letters and the circle keep their shape. The
  phone menu's theme item is now "Turn on the TV" at home and "Back to
  the den" in Neon (same testid, `shell-menu-switch-theme`).
- **Back out**: Nova's "out" transition sets `tvBridge.returning`; the
  den mounts with the camera at the set showing the pattern, and 1.8 s
  later it switches off as the camera goes back to the board.
- **Tests**: `tests/e2e-story.mjs` (the whole story on a desktop and a
  phone's bar); the Nova tests that expect the den set the story as owned
  in their init scripts. Test hooks: `__DEN_TV__()`, `__DEN_TV_PRESS__`.

## The den's rules leaflet is the How to play (Standard / Nova at home)
- The leaflet and the game box on the coffee table (den-room.js buildCoffeeTable, userData.rules) are a link: den-fx pickScene returns "rules", sceneTap dispatches the open-rules event at the Quick card. Under the mouse, the chassis calls the theme's `sceneHover(what)` (and shows a pointer for anything pickScene finds); den-fx pops a "?" card (`.den-rules-hint`, standard.js CSS) over the leaflet.
- `theme.rulesInRoom` (standard.js) hides the corner How to play; the Room view house moves beside the full-screen button (bottom 18). Other themes keep the corner button. Tests: e2e-den "The rules leaflet on the coffee table", e2e-rules checks Standard has none.

### The wheel only zooms (user: the mouse-wheel issue "still happening")
The wheel's trackpad-flick reading (a fast burst of scroll: down = Top-Down
View, up = recentre) was narrowed once to bursts without a mouse notch,
but a mouse with smooth, accelerated scrolling (a Mac's) sends a stream
of small steps with no notch to tell it by, so a fast spin to zoom out
still jumped to Top-Down, closer in. A fast scroll is a flick; there is
no reliable telling. `onWheel` now only zooms (by a share of the
distance). Touch screens keep their two-finger swipes; a trackpad's
two-finger tap (contextmenu) is still read. Test: e2e-den "a fast spin of
small wheel steps zooms out, no view jump".

### Cromo, Lluvia and the Lab: the shell lift (outline fix)
Their outline shells now sit SHELL_LIFT (0.003) above the board like
wood-set.js's, `outlineYOffset` = OUTLINE_T + SHELL_LIFT (Lab: only for
directions with an outline). tests/e2e-outline.mjs runs all five, reading
the scene through the chassis's `__EC_TEST_THREE__()` (with
`__EC_TEST_HOOKS__`); Lluvia via "Straight to the board".

### Tienda's ball bin (user: "not obeying physics")
The balls were two loose layers at the rim over an empty wire bin,
overlapping and floating. Now dropped in one at a time (own seeded rng,
so the store's other seeded layout is unchanged): each tries 48 spots and
settles at the lowest resting height (floor, or a pocket on the balls
under it, never overlapping, inside the wire), filling to the rim, then
7 near the middle for a small heap; deeper balls shaded darker.

### The den's coffee table: earth-tone ceramic mosaic (user's pick)
Eleven mid-1970s tops were rendered in the room (preview only: travertine,
olive-ash burl, smoked bronze glass, harvest-gold tile, oak parquet,
cleft slate, end-grain maple, rosewood + brass, chocolate lacquer,
tessellated fossil stone, ceramic mosaic); the user chose number 11. The
top (den-room.js buildCoffeeTable) is 40x40 small glazed tiles on cream
grout, harvest gold at the middle through orange and rust to brown at the
edges (seeded scatter), a glaze glint on each, in a teak frame
(`mosaicTop` color 0xb4a690 roughness 0.3; `teakSide` 0x5c3b22). The
walnut planks it replaces are gone.

### Focus mode in the den (user: "everything but the board... blurred out... the board kind of floating")
Seven ideas were offered; the user took the recommendation: a lamp as
the den's own switch (the lamps on the console and credenza and the
ceiling globes, each one), plus a corner button and F / Esc,
and (asked for) a switch in the dock (a phone's menu) and in the phone
control bar's menu.
- **Chassis:** `theme.focusMode` turns it on for a theme. State
  `focusMode`, passed to the theme's ambient `setFocus(on)`. Ways in/out:
  corner button `focus-corner` (beside the Room view house, `data-on`),
  F toggles, Escape leaves (not while the rules / placard / new-game card
  is open), the dock's `focus-switch` (role=switch, next to Room View),
  the phone menu's `shell-menu-focus` Toggle (View section), and the
  theme's own through the window event `el-cabeza:focus` ({ on } or a
  toggle). Room View leaves focus.
- **Den (den-fx.js focusFrame):** eased (about 1 s). Fog closes in to just
  past the board (near = camera distance + 0.8 SLAB_MAX, far +46) and
  goes near-black, background too, so the room sinks into the dark from
  the table's far edge (the lamps' glow sprites are fogged; the fire's
  unfogged additive flames are hidden past 45%). The room and the table
  drop 1.3 units under the board (den.group.position.y) with a slow 0.12
  drift, so the board floats over its own shadow. A veil
  (`.den-focus-veil`, standard.js CSS) appended in the canvas's mount:
  dark outside an ellipse round the board's screen box (--cx/--cy/--rx/
  --ry set each frame), with backdrop-filter blur where the tier is
  physical and the browser supports it (`.blur`). The music visit and the
  TV visit bring the room back while they last.
- **The lamps:** each is its own switch: the stereo console's table
  lamp, the credenza's two, and the two amber ceiling globes. NOT the arc
  lamp by the chair (the first cut used it; the user: "I don't want it to
  be that lamp"). Unseen pick shapes round each (den-room.js
  `lamp.pickables`, userData.focusLamp + lampGroup); pickScene skips a
  lamp whose group (wallS / wallW / ceiling) has stepped aside, returns
  "lamp", and sceneTap sends the toggle event. Tests aim the camera at
  each lamp (heading first, then the target: the board turns with theta).
- Test hook `__DEN_FOCUS__()` ({ on, w, lift, fogNear }). Test: e2e-den
  "Focus: just the board".

### The den's mug and spoon (user: the spoon "not sitting in there"; the mug redesigned from a photo)
- **Spoon:** it sat with its bowl inside the mug's foot and its handle
  through the saucer's rim (the tip floating past it). Now built along its
  own +x (a half-ellipsoid bowl, rim at y 0, bottom 0.07 below; a flat
  tapered extruded handle with a rounded end) and placed by the saucer's
  real top profile (`saucerTop(r)`): the bowl down on the dish at r 1.1,
  across from the mug's handle, the heading solved so the handle crosses
  the rim (r 1.46, top 0.34) 1.32 along, the tilt so the handle's
  underside rests on the rim there. The weight lies between its two
  resting points; only the end is over the rim.
- **Mug:** a mid-seventies stacking stoneware mug after the user's
  photograph: straight sides in a speckled oatmeal glaze (canvas speckle,
  color 0xd2bf86), a narrower stacking foot, a band (an open cylinder just
  proud of the wall) of interlocking three-armed Ys on a hex lattice in
  dark brown with a rust edge (11 round, seamless), rust lines at the rim
  and foot, and a C-shaped strap handle (an extruded annulus sector, open
  toward the mug, its ends into the wall), turned toward the board's edge
  as before.
- Den draw calls are 195 of the test's < 200: little room left.
- **Then (user):** the mug more yellow (speckle base #E4CF72, color
  0xe2cc78, the band's ground the same); the saucer a seventies avocado
  glaze (canvas painted along the lathe profile's v: avocado, the rim
  darker, rings of harvest gold / cream / gold inside the dish, the well a
  touch lighter; `saucerGlaze`); and a hint of steam off the coffee: one
  upright sheet (ShaderMaterial, two swaying wisps breaking up as they
  rise, alpha at most 0.26, no depth write) turned to face the camera in
  `table.animate(t, camLocal)`, which den.animate now calls. Draw calls
  196 of < 200.
- **The spoon settled (user: "clipping through the mug and saucer"):**
  placing it by the bowl's centre left the bowl's edge 0.019 under the
  glaze where the dish slopes across its width (the saucer showed through
  the bowl). Now solved at build: for tilts -0.12..0.3 (step 0.004) it's
  lifted by exactly what keeps every vertex of bowl and handle on or above
  the saucer's surface (`surfaceAt`: the profile, the rim's outer fall,
  the table past it), and the tilt where its balance point (0.55 along)
  sits lowest is kept: resting on two points. Measured in the page:
  no vertex below the glaze (closest +0.0017, the handle on the rim), and
  0.9 from the mug's axis (mug 0.735).

### The extras wait for the Singularity (user: the info panel in the store and the den shows no Anomaly/Singularity/extra pieces/laws until the first Singularity)
Agreed with the user (asked): lock by the Singularity sphere, not by
reaching Neon (Neon's Anomaly only shuffles the five); lock the den's
catalog too; apply it everywhere (standalone pages too), not only Nova.
- `engine/journey.js`: `singularitySeen()` (localStorage
  `el-cabeza:singularity-seen`, shared by every page of the site; a
  blocked storage lasts the visit), `markSingularitySeen()` (the sphere's
  first opening: neon-singularity.js effect on phase SPHERE),
  `forgetSingularity()` (Nova's "Start the story over", unified.jsx),
  `onJourneyChange(cb)` (JOURNEY_EVENT + storage), `CLASSIC_PIECE_KEYS`.
- A theme opts in with `lockExtrasUntilSingularity` (tienda.js,
  standard.js, neon.js; Nova's wrappers inherit). Cromo, Lluvia and the Lab
  don't (their own custom rules).
- Chassis: `classicRules` → `RulesCard classic` (data-classic): MOVES
  drops every law tile plus `shelter` and `missing`; COSTS drops the law
  rows and "3 Actions"; THIS GAME says "classic rules", no laws/new pieces/
  cut squares; YOUR TURN loses Split Movement/slide/pivot/shove and the
  3-Actions example; ABOUT's note drops "ANOMALY and SINGULARITY".
- Order form (tienda-overlay.js OrderForm, the store/den/Tienda page):
  `classic` (read at open) → the five pieces only, no Rules section, no
  Missing squares; board size and Shuffled start stay; sections renumber;
  any selection loaded (carbon copy, Standard) is made classic
  (`classicSelections`). data-classic on tienda-order.
- Tests: e2e-journey.mjs (locked by default on Tienda and Neon; open with
  the flag on Tienda and Standard; the sphere sets it; Nova's restart
  clears it). Suites that exercise extras (e2e-rules, e2e-tienda,
  e2e-original) start with the flag set.

### The den's first record: "Dangerous Dashing" through a 1974 console turntable
The user's track (Suno, "influentialdistortion257"), put through
`tools/console_1974_turntable.py` (pedalboard + numpy/scipy; ffmpeg via
subprocess for MP3 in/out), the user's chain in order:
1. 8th-order Butterworth band-pass 40 Hz - 11 kHz (zero-phase), then a
   +3 dB PeakFilter at 150 Hz (q 0.9), the cabinet.
2. LR4 split at 150 Hz: lows summed to mono; highs mid/side with side x0.5.
3. Wow 0.55 Hz (0.14% peak) + flutter 4.5 Hz (0.05% peak) through a moving
   fractional delay (A = pct / (2 pi f)).
4. The amp: -3 dBFS nominal, +4% x|x| asymmetry, pedalboard
   Distortion(drive 4 dB), gain back.
5. Pink hiss at -45 dBFS RMS (FFT 1/f); a crackle bed band-limited like the
   rest. The crackle download (Wikimedia URLs, --crackle-url, or --crackle
   FILE) was blocked by this environment's network policy (403 at the
   proxy; only package registries and GitHub raw reach out), so the run
   used the modelled crackle (dust ticks partly out of phase, rarer pops, a
   once-a-revolution scratch, the surface hash breathing at 33 1/3 rpm).
   Re-run with --crackle recording.wav for a real one.
Measured on the master vs the source: >12.5 kHz down ~10.6 dB relative
(what's left is the hiss), 150 Hz vs 500 Hz +3.5 dB, highs side/mid
0.650 -> 0.325, lows side/mid 0.136 -> 0.058.
Output `assets/den/1974_console_master.mp3` (LAME V2, 4.7 MB), copied
beside the Standard and Nova pages as `el-cabeza-den-record-1.mp3`
(build.js DEN_RECORDS). `DEN_TRACKS` (standard.js) lists it as a record,
`treated: true` (den-audio.js then adds no surface noise of its own).
Test: e2e-den "The den's own record" (listed, plays, currentTime moves;
`__DEN_AUDIO__().music.time`).
- **Re-run (user: "the hiss is way too overpowering... 80% hiss and only
  20% music"):** measured first: the file itself had the music ~30 dB
  over the hiss, so in the den the music was also lost under the room's
  own rain and fire. Both fixed: the script's hiss now defaults to -64
  dBFS RMS (`--hiss-db`; the brief's -45 kept as the explanation) and is
  band-limited 40 Hz-16 kHz, the crackle 10 dB under its first level
  (`--crackle-db`), and the music is brought forward by a gentle limiter
  (-5 dB threshold) to -1 dBFS before the noise goes on: master median
  -10.7 dB (source -15.2), hiss 53 dB under it. In the den (den-audio.js),
  the room (fire, clock, rain) ducks to 0.35 while a record or tape plays
  (`MUSIC_DUCK`, roomFollowMusic), back up when it stops.

### The book by the chair: a tap takes the camera to it
den-room.js: an unseen catcher box round the book (userData.book), and
`book.focus` { center (the cover, room frame), head (the cover's top on the
table, -z in the book's frame), halfW, halfL }. den-fx.js: pickScene
"book", sceneTap toggles `bookGoal`; cameraOverride eases `bookW`
(rate 2.0) and puts the camera straight over the cover, a touch toward
its tail (d * 0.1), at the nearest distance that fits it with 18%
margin (either axis, the screen's aspect), with camera.up blended to the
book's head so the cover reads upright (restored to +Y after lookAt).
Coming back: any pointerdown on the canvas (a capture listener that
swallows that tap and its pointerup, so it does nothing else), Escape, or
the music panel opening. A hint pill ("Tap anywhere to go back to the
game", .den-book-hint) shows while there; the title and dock piece step
aside (ec-tv-visit); focus mode waits. Hook `__DEN_BOOK__()` {goal, w}.
Test: e2e-den "The book by the chair".

### The bottom-left corner's buttons stack on a phone (user)
Chassis: `cornerStack` (viewportW <= 560) → full screen, How to play,
Room view, Focus (whichever the page has) in one column at left 18, 38 px
apart, full screen at the foot; wider, the old row / above-full-screen
places. `cornerPlace(key)` / `cornerStyle(key)` give each its left/bottom
and pass the bottom as the CSS variable `--ec-corner-bottom`, which the
themes' card-style overrides use (standard.js, tienda.js:
`bottom: calc(var(--ec-corner-bottom) + 4px) !important`, the smaller
card centred on the chassis's 38 px spot). cornerControlsRight follows
(56 + 8 when stacked).
- **Focus button icon (user):** a light bulb. Focus off (the room's lights
  on): the bulb outline with rays all round; focus on (lights down): the
  bulb alone, no rays (outline, not filled: a filled cream bulb on the
  dark "on" card read as lit).

### Lights down dims the page's furniture; Room view house greys; now-playing chip (user)
- **Room view house greyed while it's the view:** `room-view-corner` has
  `data-active` (viewMode === "room"); standard.js/tienda.js grey its card
  (desaturated background, muted icon, no shadow, opacity 0.6); the chassis
  default drops it to 0.22 and a plain cursor. Still clickable (re-frames
  the room).
- **Focus (lights down) dims the corner:** every corner control (full
  screen, How to play, Room view, focus, the music chip) carries
  `data-dim` while focus is on; standard.js dims `[data-dim="true"]` to
  0.32 (!important, over the inline), a hover or keyboard focus brings one
  back to 0.9. The chassis also toggles `html.ec-lights-down` with focus;
  standard.js dims the masthead with it (`[data-masthead] > div`:
  brightness 0.32, saturate 0.6, opacity 0.55, 0.9 s). The masthead
  wrapper (titleWrapRef) has `data-masthead`.
- **Now-playing chip** (chassis, any theme.music): while a track is on and
  the music panel is away, `music-chip` just above the corner controls
  (stacked: above the column; row: above the row; phone shell: above its
  bar): pause/play (`music-chip-toggle`, den-audio `pauseMusic` /
  `resumeMusic`: the element pauses in place, the room un-ducks, the
  platter stops via setMusicPlaying(null)), the title (`music-chip-title`,
  opens the panel), and a volume slider (`music-chip-volume`) that is the
  Music channel's own level (setChannelLevel(music.channel), the same as
  the sound menu's; all the way left is off). Hidden when the dock's
  panel would cover it. den-audio roomLevel only ducks for music that's
  actually playing. Tests: e2e-den stereo block (pause/platter/slider/
  title), focus block (dim, masthead, grey house).
- **The chip folds on a phone (user):** `musicChipCompact` (cornerStack or
  the phone shell). While the record plays it's one 30 px round pause
  button at the top of the corner column (`data-folded`); a tap pauses and
  it opens out (width transition) to play, the title and the volume
  slider; play resumes and it folds back. Desktop keeps the full bar.
  Test: e2e-den "On a phone the now-playing chip folds down".

### The catalog and order form on aged stock (user: "a slightly dated look")
tienda-textures.js `ensureAgedPaper()` (called with ensurePaper in the
overlay): `--tienda-aged`, a 384 px seamless tile of uneven yellowing
clouds, foxing (rust spots with pale halos, some clustered) and a faint
tide line or two; `--tienda-ink-wear`, paper-coloured specks for solids.
tienda-overlay.js `.td-form` (catalog, order form): yellowed #EBDDBC,
the gutter's shadow down the left, a toned top-right (thumbed) and
bottom-left corner, edge toning (inset shadows), ink spread
(text-shadow 0.5 px); the black section bars worn (`.td-sec-h` with
ink-wear), the photos faded warm (sepia 0.28); the foot strip (`.td-foot`)
on the same aged stock, toned at its bottom edge; the red button a shade
duller.

### The 3D piece viewer shows true relative sizes (user: the Turrito looked as big as the Opa)
tienda-showcase.js `frameRadius(model)`: every piece is framed as if it
were the Opa (max of its own radius and the Opa's, cached), in the viewer
and the row photographs alike, so the Turrito is a small cube beside the
Opa's big one; pieces longer than the Opa are framed on their own.

### The store table's lower shelf isn't black (user: "practically pitch black")
tienda-store.js buildTable: the lower shelf and its stock stay unlit
(MeshBasicMaterial: the key's shadow map would black them out) but at
shaded, not dark, values: the shelf 0x8c6c50 times a 64 px falloff map
(full at the rim where the troffers' light gets in, 22% deeper in the
middle), the stock boxes' lids 0xb4aa9c times the lid art, their sides
0x55402e. (Was 0x2b2119 / 0x6a625a / 0x21170f.)

### Den: the side sofa's back cushions reach the corners (user)
den-room.js: the west run of back cushions was a seat's depth (SD) short
of each corner (as its seat cushions are), leaving a gap against the
north and south backs. Its two end cushions now reach on into the
corner (by SD - backD - 0.7), up to the other backs with the usual 0.4
seam; the middle ones and the seats are unchanged.

e2e-tienda: the square picker step waits for the picker to close (up to
6 s) instead of a fixed 400 ms; on the software renderer a click there
can take seconds to resolve.
