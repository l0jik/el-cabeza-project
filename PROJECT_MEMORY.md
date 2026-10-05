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

- **Testing policy (user, standing): small tweaks skip the full test
  suites** unless the user says otherwise. Colours, sizes, wording, CSS,
  a cushion or a texture: build, look at a screenshot, commit, push. The
  full e2e suites (e2e-tienda ~10-12 min, e2e-den ~8 min on the software
  renderer) are for real behaviour changes, or when asked. Never rebuild
  `dist/` while a test run is using it.
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

### Board sizes wait for the Singularity; a shuffled start is Neon's alone (user)
tienda-overlay.js OrderForm (the store's and the den's Custom rules, in
Tienda and Nova): `storeSelections()` forces `random: false` on every
order and carbon copy (the Shuffled start checkbox is gone from the form;
Neon's anomaly is the only shuffled start). `classicSelections()` (before
the first Singularity visit) also fixes the board at DEFAULT_BOARD_DIM
(10 x 10) and the classic page has no Board section at all; after the
Singularity the Board section (sizes, missing squares) is there, still
without a shuffled start. Tests updated (e2e-journey, e2e-story's home
order is now an extra Turrito) but not run (user: skip full suites for
quick changes).

### The den's 8-track: the user's own tapes (the eight composed ones are gone)
Eight synthesized tapes were made and then deleted at the user's word
("We are not going to keep any of those eight tracks. Period."); the user
will upload music for it. Don't generate music for the den again unless
asked. The music panel has no close button now: Escape or a click
anywhere outside it puts it away (a tap on the room that does so is
swallowed, so it doesn't also select a piece).

### No custom rules before the Singularity (the user's "option 4")
Until the first Singularity visit nothing is alterable anywhere (not even
the counts of the five pieces): Tienda's lid, setup row and phone bar, and
Nova's store and den, all say "See the pieces" and open the look-only
catalog (PieceCatalog; its purchase row only in Nova's store). The
catalog's foot has a faded "Special orders — by arrangement." After the
Singularity (engine/journey.js, live via onJourneyChange) that foot line
becomes a link into the order form, the buttons read "Custom rules" again
(store keeps "See the pieces"), and a note ("Special orders ... open now")
shows once, 7 s, tap to dismiss (localStorage
`el-cabeza:special-order-noted`, cleared by forgetSingularity with the
rest). Standalone den (standard.js) has no custom rules at all. Tests
updated (e2e-journey, e2e-story, e2e-fullscreen wording), not run.

### The 8-track's five tapes (the user's uploads)
The user uploaded five tracks for the 8-track (2026-09-29): Interesting
Plus (Charlie C. & the Fresh Heaven Denizens), Late Night Chef the
Ultimate Grilling Machine (Weiss Haus Trio), The Longest Song (Seven
Minutes of Euphoria), Permafrost in your Bed (Subtle Silence Serenity),
Parse (Rudimentary Pennies). tools/den_8track_treatment.py (IN... in that
order) puts each on a cartridge: 3 3/4 ips band + head bump, tape
saturation, 75% width with mono lows, crosstalk from the next tape at
-40 dB, wow/flutter, a dropout or two, mastered by a limiter to -10 LUFS
(record is -9.1), hiss at -64 dBFS (the level the user accepted on the
record), the program-change clunk at the top. Writes
assets/den/8track_<n>.mp3; build.js copies them as el-cabeza-den-tape-<n>.mp3;
DEN_TRACKS lists them with loop: true. Sources aren't kept in the repo
(re-upload to re-run).

### BACK from Singularity goes home, and the late-night commercial (2026-09-29)
In Nova, the sphere's BACK button goes straight to the den through Nova's
DISCONNECT transition (apps/unified.jsx wraps neonTheme.useSetupExtras to
add `onSingularityBack` -> tvBridge.back(); neon-singularity.js's BACK uses
it when present, else exitSingularity as before; standalone Neon unchanged;
Escape in the sphere still goes to Neon's board). The first time home after
the Singularity's been seen (BACK or the title hold), the den's set shows
a community-access infomercial (themes/den-commercial.js, about 34 s, drawn at
12 fps on the TV's screen texture with rolls/tracking/dropouts): paid
programming slate, star wipe to hand-cut "EL CABEZA!", "Tired of chess?"
pawn + red stamp "GET OUTTA HERE, CHESS!", crowned Cabeza "CABEZA IS
KING!", "NOW TAKING SPECIAL ORDERS! new pieces/laws/boards (some assembly
required)", "The best thing you didn't know existed ...sort of!!", the
dealer card held up with a thumb in shot ("Games & Hobby Dept.", KLondike
5-0199, "Operators are standing by* / *Operator is Dale"), "Paid for by the
Friends of El Cabeza", snow (since extended: "EL CABEZA... ONLY $7.97" price tag, "BRAND NEW FOR 1975!" badge, "GET YOURS NOW..." then a dark turn "IF NOT, YOU NEVER WILL!", before the credit); then the set goes off and the camera leaves
slowly. Sound: den-audio.js tvCommercial (organ + bossa rhythm box, sad
trombone, stamp, slide whistle, bells, typewriter, boing, phone bell, tape
hum) through the TV's speaker; tvOff stops it. The camera frames the
picture itself while it plays (den-fx tvWatch). Tapping the set turns it
off early. Once per story (engine/journey.js COMMERCIAL_AIRED_KEY, cleared
by forgetSingularity); the catalog's "special orders open" note waits for
it (setCommercialOn). No voice-over (no TTS available offline); the user
may supply one. __DEN_TV__() now reports watch and ad (ms into it).
- Commercial voice-over (2026-09-29): the user's recording "El Cabeza is
  the new king" (6.4 s) -> assets/den/commercial-king.mp3 (first 0.6 s of
  silence trimmed, mono, 180 Hz-5.5 kHz, compressed, -16 LUFS; the source
  isn't kept). build.js ships it as el-cabeza-den-ad-voice.mp3 (standard and
  Nova); den-audio.js plays it through the TV speaker chain at CUES.voice
  (9.5 s), gain 0.5; tvOff pauses it. The king scene now runs 9.2-14.4 with
  no rhythm box or organ under the voice; its words read "EL CABEZA / IS
  THE NEW KING!". Everything after shifted +2 s; COMMERCIAL_MS 35900.
- Voice redone (user: too forward, wanted lower fidelity, pitch a hair
  lower): asetrate x0.965 (about -0.6 semitone, tape-style), 340 Hz-3.1 kHz
  double-pole band, heavy compression, tanh soft clip, down to 11 kHz with a
  light 9-bit crush, a small slapback, -18 LUFS; played at gain 0.3 (was
  0.5). NEW FOR 1975 is now a big starburst beside the (shrunk, shoved-left)
  price tag, strobing blue/yellow/red/green at 6 Hz with chaser bulbs,
  flashing rays and zaps in time; the price scene runs 2.3 s longer for it
  (COMMERCIAL_MS 36800).
- Round 3 (user: voice still too forward; add cheap echo; "the new king!"
  x3 somewhere; VHS audio tearing/wow/flutter): voice gain 0.17 and a
  tape echo (210/420 ms) on it; commercial-new-king.mp3 is "the new king!"
  cut from the recording (orig 2.685-4.7 s) three times, 1.5 s apart,
  fading, same lo-fi chain + echo; shipped as el-cabeza-den-ad-voice-2.mp3,
  played over the sign-off (CUES.kings 35.2) while the credit card shows
  three fading "the new king!" captions; the credit holds to snow at 41.6
  (COMMERCIAL_MS 42200). The whole commercial's sound now runs through a
  wandering delay (wow 0.47 Hz, flutter 6.8 and 13.1 Hz) and a "tear" gain
  that drops out with a 59.94 Hz buzz and a hiss burst at the picture's
  rolls and a few random spots.
- The special-orders note (tienda-overlay.js) no longer times out: it stays
  until a tap anywhere else dismisses it (then remembered, noted key set on
  dismissal, not on showing), and a tap on it ("Order from the catalog ›")
  opens the order form straight away (from the box lid too). Waits for the
  den's commercial as before.
- Round 4 (user: voice lower still, pitch much deeper): both voice files
  now pitched down with rubberband (pitch 0.8, tempo kept) before the tape
  x0.965, so about 4.5 semitones below the recording in all; the band's
  low edge moved to 210 Hz so the depth comes through; AD_VOICE_GAIN 0.12.
- Subliminal frames (user): CUES.flash [6.45, 16.35, 20.25, 33.55, 37.95]
  (chess, special orders, "the best thing...", "you never will!", between
  the last "new king"s): one 12 fps frame each (the last two, two frames)
  of the Singularity's black hole (den-commercial.js blackHole: starfield,
  edge-on disc in Neon cyan/violet, lensed far side, photon ring, shadow,
  "S I N G U L A R I T Y" in Chakra Petch). The sound drops almost to
  silence for exactly those frames (den-audio.js, the tear gain, no buzz).

### Dock icon switches say what they did on touch (2026-09-29)
The dock footer's icon switches (points left, move costs, piece guide,
Nova's layout) show a brief note over the switch when tapped where there's
no hover tooltip (the last pointer wasn't a mouse, or the device reports
hover: none): chassis showToggleHint / toggleHint, data-testid
"toggle-hint", 2.4 s, e.g. "Piece guide: on. A card says what the chosen
piece does." / "Move costs: hidden." A mouse click shows nothing (the
tooltip covers it). The speaker opens its own labelled menu, so no note.
- Corner buttons under the open dock (fix): the den's CSS forces the
  focus/room buttons' opacity with !important, which beat the chassis's
  "covered" opacity 0, so on a phone the lamp and house sat over the dock's
  panel. The chassis now also sets visibility: hidden (and no pointer
  events) on every corner button while the panel covers them; themes don't
  style visibility, so it holds everywhere.

### After the whole story, the store has never heard of it (2026-09-29)
Owned and the Singularity seen (apps/unified.jsx storeAfter): back at the
store the purchase reads "Purchase another copy · $7.97", and any purchase
there (row, phone bar and menu, the catalog, the offer after a game)
brings up tienda-overlay.js ClerkScene instead (event "el-cabeza:clerk"):
five typed lines, tap to finish/continue. The clerk checks the back, it's
"not in the book", she pages the manager (tienda-audio playPage: the PA
chime and murmur), and Mr. Pruitt, Store Manager: "We've never sold a game
by that name." / "We're very sorry, but we'd love to help you if we
could..." Ends with "Stay a while" / "Go home, confused." From then the
store's button (and menu) is "Go home, confused." (clerkConfused, event
"el-cabeza:clerk-done"). Going home saves storeGone in the story's
localStorage ({owned, storeGone}; novaStory.jsx) with the caption "Home
again. Confused.", and "Back to the store" is gone from the den's row and
phone menu until "Start the story over" (which clears it).
- ABOUT's "The original El Cabeza is played with its basic rules alone"
  note (and its play-original link) isn't shown at all until the
  Singularity's first visit (classicRules), everywhere that locks the
  extras: it gave away that there's more. e2e-journey checks it's absent.
- New voice-over (user's cab_comm.mp3, 9.3 s): "Take a hike, chess!"
  (1.02-2.62 s), "Get outta here, Checkers!" (3.12-4.88), "El Cabeza is the
  new king!" (5.55-7.95; "the new king!" is 6.86-7.95). Same chain as
  before (rubberband pitch 0.8, tape x0.965, 210 Hz-3.1 kHz, compression,
  soft clip, 11 kHz 9-bit crush, echo, -18 LUFS). Files: commercial-chess
  (ad-voice-3, at CUES.chessVoice 6.9), commercial-checkers (ad-voice-4, at
  checkersVoice 9.2), commercial-king (ad-voice, at voice 12.1),
  commercial-new-king x3 (ad-voice-2, at kings 37.8). The chess scene now
  runs 5.6-11.8: pawn stamped "TAKE A HIKE, CHESS!" and run off, then "AND...
  CHECKERS?" a red checker slides in, is stamped "GET OUTTA HERE, CHECKERS!"
  and run off the other way. Everything after moved +2.6 s; COMMERCIAL_MS
  44800. The rhythm box stops at the first stamp; the trombone is shorter.
- Checkers beat (user): instead of a lone checker, a couple at a card table
  over a checkerboard, both asleep, breathing, Z's rising and fading
  (den-commercial.js sleepers), two snores in turn (den-audio.js); the
  stamp lands on them at 10.1 with the voice at 10.0, and the whole table
  is run off at 11.8. King onward +0.6 s; COMMERCIAL_MS 45400. The user's
  note trailed off ("and then the uh,"): asked what comes next.
- Room view drag (user: in Tienda's Room view the X and Y felt inverted
  compared with play): while cam.current.dollhouse, a sideways drag turns
  the view the opposite way to the board view's near-side rule, and the
  same way anywhere on screen (no half-screen dragFlipTheta). Up/down was
  flipped too, then put back (user: "left/right is right now, up/down is
  still backwards"). The board views are unchanged; every Room view.
  __EC_TEST_CAM__() now also reports dollhouse.
- Then (user's screen recording: panned over to the standee, tilting still
  backwards): the room-look rule isn't only the Room view. roomLook =
  dollhouse, or a free-camera theme with the view panned off the board
  (target more than 0.6 x the slab's size from its middle). NOT zoom: a
  phone's play view sits at radius ~44, beyond ZOOM_MAX_FOR_BOARD, and
  counting zoom turned play backwards on phones (user caught it). Then both axes run the other way to the board's
  rule (up/down flipped again, left/right as the far-half flip, the same
  anywhere). On the board, unchanged.
- The user's final word on drag ("last chance"): whatever is behind the
  finger moves the way the finger moves - left, right, up (looking up),
  down (looking down) - in every case, at any zoom. All the fixed rules
  (dragFlipTheta, roomLook, the Room view flips) are gone. grabFollow
  (chassis): at touch-down, raycast for the solid visible point under the
  pointer (else the ground plane through the target) and keep it, in the
  board's frame, for the whole drag (re-picking under the moving finger
  grabbed the floor behind the board and flipped the tilt; picking at the
  drag's start, after the dead zone, grabbed the wrong thing too). Every
  50 ms / 14 px: where that point lands on screen for the view turned and
  tilted a step (0.06 rad) each way, from the exact camera pose
  (cameraDistance models the room clamp on r; applyCamera shares it); each
  axis takes the sign that carries it the finger's way (both sides tried:
  near the pivot a tilt either way moves it the same way). Once chosen, a
  sign changes only past a margin (0.04 x height px/rad, flip at 2x). Fallbacks: the half-screen
  rule for turn, finger-up-tilts-to-horizon for tilt. Test:
  tests/e2e-drag-follow.mjs [page] [phone|desktop] drags from a 3x3 grid in
  four directions across play, zoomed out, top-down, low, panned off (x2)
  and the Room view, and checks the grabbed point moved with the finger.
  Hooks __EC_TEST_GRAB__(x,y) and __EC_TEST_LOCAL_SCREEN__(local).
- Den focus mode: the "YOUR ORDER ... change" slip dims to 0.3 with the
  lights (html.ec-lights-down), full again when opened (or hovered).
- The revisited store: the clerk is a he. The PA "manager to the front"
  page plays when he says he'll get his manager (once the line has typed
  out), louder and nearer than the ambient PA (tienda-audio playPage).
  User wants the revisited store to sell something else on the same table
  with the standee advertising it; ideas offered, awaiting the pick.
- The Games-counter scene (revisited store, Nova, after the story) is now
  the user's storyboard as photographs. Source sheets in
  assets/tienda/storyboard (clerk-sheet.jpg, manager-sheet.png, 4x2 cells
  of 384x512); tools/tienda_clerk_frames.py writes assets/tienda/clerk/*.jpg
  (368x474). The user's marker boxes meant "merge these cells": 1+2, 3+4,
  5+6 (each one frame, a tap crossfades 0.9 s to the second cell); cell 7
  (scribbled) dropped; cell 8 the phone call; then the 8 manager cells.
  Their rule: table and props identical in every frame. So one appliance
  spread (coffee maker, can opener + gadget, crock-pot, toaster, blender,
  mixer), cut from the "Yeah, I'm sorry" cell by hand polygons + everything
  below y 400, is laid over every frame at the same place (manager cells
  cropped 22 px higher, spread 22 px higher in them). The El Cabeza demo
  on the manager sheet is covered by it (user: appliances only). Marker
  strokes are filled from the merged partner cell (ORB homography), the
  SAVE sign slid/whole from the partner (parallax), bubbles crossed by a
  stroke closed by mirroring their left end. Lines verbatim in bubbles
  (screen reader copy in .td-sr); PA caption "Manager to Games" + playPage
  0.9 s after the phone frame shows. Frames ship beside the page
  (build.js CLERK_SHOTS -> dist/el-cabeza-<shot>.jpg), text fallback if one
  fails. Test: tests/e2e-clerk.mjs.
- The revisited store itself (tienda-store.js setStoreRevisited, set from
  unified.jsx storeTheme.useSetupExtras = storeAfter()): the same six
  appliances as 3D models at the table's ends (0.85 life size), "Kitchen
  Magic" cartons on the lower shelf, no game boxes or tent card; the
  standee shows assets/tienda/ad-housewares.jpg ("Come home to Harvest
  Gold!", made by tools/tienda_housewares_ad.py from the same spread, fonts
  in tools/fonts), its card "Housewares · Aisle 4". The board stays.
- Games-counter scene dressed as a panel clipped from a 1975 comic (user:
  "reminiscing... a real-life pull-out of a comic book"): yellowed
  newsprint with a scissor-cut clip-path edge, two strips of tape, ink
  border, Ben-Day dot overlay + warm vignette, yellow narration boxes
  ("Later that same day..." on the first frame, "Moments later..." when the
  manager arrives), the PA as a caption box, Bangers/Comic Neue buttons.
- Music chip (now playing): above the floating dock piece (z 16 > 15) with
  a firmer shadow; paused before a game on a phone, the piece covered its
  volume slider.
- Dock panel on phones (user's screenshot: "Start the story over" under the
  corner switches): the story links stay on one line (nowrap, type
  min(11px, 2.9vw)); and when the panel must scroll (max-height
  calc(42vh - 56px) before a game) the five corner switches drop by the
  overflow (--ec-dock-overflow, set every render) into the padding strip
  at the end of the content, instead of floating over the rows.
- Now-playing chip on phones: stays a round button until tapped (a tap
  on it opens it, not pause); open, its button plays/pauses and the
  slider turns; any tap elsewhere folds it (musicChipOpen, pointerdown
  capture). Hidden under the dock's open panel on phones, and under the
  phone layout's open menu sheet (MobileShell sets html.ec-shell-menu-open).
- Revisited store, round 2 (user: "Cabeza is nowhere to be seen"): the
  board, pieces, markers and brass are hidden every frame
  (tienda-fx.js: every boardGroup child but the store and the table), and
  the six appliances are laid across the whole table in the photographs'
  order (coffeemaker, can opener + label gadget, slow cooker, toaster
  behind, blender, mixer lying front right), life size, facing the
  store's opening view. The view is held out at radius 62 / phi <= 0.95
  for its first 3 s (the board-fitted opening framing would pull it in).
  No game to set up: the dock row is just the purchase (-> the clerk);
  the phone bar hides setup + Begin Game via setupExtras.noGame
  (MobileShell ctl.noGame). The chassis now passes `cam` to
  mountAmbientEffects helpers.
- Singularity starfield: stars are a fixed pixel size (sizeAttenuation
  off, two layers 2.6 px / 4 px). The shell (radius 30-55) surrounds the
  camera (~44 out on a phone), so distance-scaled stars near the camera
  blew up into bright blobs.
- Revisited store, round 3 (user: hide both, start the clerk scene
  automatically): with setupExtras.noGame the chassis hides the masthead
  ([data-masthead]), the floating dock piece ([data-dock-piece]), the dock
  panel and the phone bar. The clerk scene opens by itself 3.2 s after
  arriving (tienda-overlay useSetupExtras); "Stay a while" leaves a
  "Nobody here has heard of it. / Go home, confused." slip at the top
  (tienda-leave), the only way out.
- The TV's lure (Nova, home before the first Singularity; unified.jsx
  tv.lure = !singularitySeen()): den-fx.js locks the set for 40 s (press
  returns false, pickScene skips it, so the menu's "Turn on the TV" does
  nothing either); then, until it's turned on, den-tv.js haunt(now, level)
  fires events on the dead tube, level 0 -> 1 over the next 100 s, gaps
  ~15 s -> ~3.5 s: flicker, pilot stutter, static (+tear), roll (bright bar,
  uLine), ghost (a voxel piece drawn in light on the glass, uTex swapped),
  phantom (wireframe neon pieces drifting out of the screen, fading). Sounds
  den-audio tvHaunt(kind, strength) on the Room channel. Tests:
  tests/e2e-tv-lure.mjs; __DEN_LURE_SKIP__(ms) moves its clock (other TV
  tests skip 41 s), __DEN_TV_LOOK__(on) puts the camera at the set.
- Dock switch notes (toggle-hint) stay 4.4 s (user: two seconds longer).
- Games-counter scene paging: one step per 500 ms at most (a double tap
  took two panels), no Back button (user: just the dots), swipe left/
  right on the panel, arrow keys, and a dot per frame under the panel
  (frames already seen can be tapped).
- Guided first run (user; only until the story is restarted): after the
  first Singularity, home's order form (from the TV commercial) is the
  way back to the store. HOME_STORY.guided() = singularitySeen() &&
  !storeGone(). The form's button reads "Order it at Big Glutts ›", the
  footer "Delivered to your home", the stamp "Take to store / Special
  order · Big Glutts · Dept. 49", and the form now lingers 2.1 s on the
  stamp before it goes (onPlace 2700 ms). Then the cut "Back at Big
  Glutts, order in hand." (storyBridge.orderAtStore) into the revisited
  store; tienda-overlay keeps the order (orderInHand/keptOrder). The
  clerk scene's first frame narrates a smaller "Later that day…" and
  "You hand over the order form…"; the way out reads "Go home,
  confused… with your form". Home's cut carries a sub-line (novaStory
  cut.sub, read 3.6 s): "The new pieces are already on the table, as if
  they'd been in the box all along." and deliverHome starts the ordered
  game 2.4 s after arriving. Later visits: keptOrder seeds the form.
  resetLid() (story restart) clears it all.
- The manager call's PA is the store's own ambient announcement
  (tienda-audio playPage -> paAnnouncement), not a separate voice.
- Dock panel on phones: the players line ("Dark: … | Light: …") sits
  with the footer icons at calc(13px - var(--ec-dock-overflow)) so it
  never lands on Move Log / New Game when the panel scrolls.
- Tienda's store says "Try a Game" on the Begin Game button (user: it's
  only being tried, not bought): theme.beginLabel(setupExtras) in the
  chassis (dock and MobileShell ctl.beginLabel); tienda.js returns null at
  home, so the den keeps Begin Game. Tests match /Begin Game|Try a Game/.
- TV lure, round 2 (user: sooner, more happening, weird noises from
  its corner, first tap only looks): LURE_WAIT 25 s, LURE_RAMP 60 s;
  den-tv haunt gaps ~9 s -> ~2.5 s, with flurries (a follow-up 0.35-0.85 s
  later, likelier as it goes on), never the same kind twice running; new
  kinds thump (degauss kick, tube lights), tune (dial sweep + heterodyne
  whistle, rolling bar), voice (formant babble, with the ghost). Sounds
  louder and placed: den-audio setTvListener(distance, pan) -> hauntBus
  gain + StereoPanner, fed by den-fx hearTv(camera) from cameraOverride
  (api.cameraOverride wraps placeCamera: the camera as finally placed;
  listen() in tick sees the chassis's camera before visits). A tap on
  the set while it lures only looks (lureLook: camera over, hint
  den-tv-hint, haunt at level >= 0.55, twice as often, starts at once
  even inside the 25 s); a tap off the set or Escape goes back (capture
  pointerdown raycasts the set's pickables); a second tap turns it on.
  The menu's "Turn on the TV" (tvBridge.press -> pressTv(true)) still
  turns it straight on after the 25 s. Hooks: __DEN_TV_PRESS__ (tap),
  __DEN_TV_PRESS_MENU__, __DEN_TV__().looking/lastHaunt,
  __DEN_AUDIO__().haunt {near, pan, distance}.
- The menu's "Turn on the TV" now presses like a tap (user): the first
  time home it goes over to watch first, the second press turns it on
  (pressTv has no fromMenu case any more; __DEN_TV_PRESS_MENU__ removed).
  e2e-den / nova-mobile / nova-sound press the menu again when looking.
- Lure flashes (user: the commercial's subliminal Singularity, three
  times, briefer): den-commercial createSingularityFrame() (its blackHole
  frame as a texture); den-tv flash(now, 45 ms, at least one rendered
  frame) on the dead tube; den-fx schedules FLASHES = 3: first 12-18 s
  after it starts stirring, 2.5-4 s after the camera comes over to look,
  then 5-8 s apart while watching (15-23 s otherwise); sound tvHaunt
  "flash" (sub push + glint). Hooks: __DEN_TV__().flashes,
  __DEN_TV_FLASH__(ms). The watch hint is two lines, no dot.
- Den fire rebuilt (user: the hiss was distracting, made no sense):
  no sap hiss; brown-noise hearth rumble (lp 260) + flame flutter (brown,
  bp 420 / lp 900), both steady; crackle = 2-6 ms knocks (bp 900-2600,
  Q 4-8, lp 3600) in runs, pops (knock + low thump), a log settling every
  22-52 s. Rain wash softened (hp 500 / lp 2600, 0.0045) and its patter
  duller. Measured at the output: >4 kHz energy ~80x lower, 0.8-4 kHz ~3x.
- Clerk scene narration (user: the handover box sat on the clerk's face):
  the narrator's boxes ("Later that day…" small + "You hand over the order
  form…", "Moments later…") moved out of the photo into the clipping's
  bottom margin (.td-clerk-foot: .td-clerk-captions left, rotate 0.6deg);
  Continue is now a small .td-clerk-next "NEXT ▸" (Bangers 17px, 34px tall,
  CSS triangle) at the right. Last frame keeps the two big buttons.
- Full screen during the clerk scene (user: couldn't maximize): the
  .td-layer (z 1200) covered the corner switches; Tienda's useSetupExtras
  returns cornerControlsZ 1250 while overlay === "clerk", and STORY_CSS
  hides the room/focus/how-to corner buttons there (body:has(.td-clerk-layer)),
  leaving the full-screen switch. e2e-clerk checks it's the top element.
- Den fire is now a recording (user's pick: freesound_community "Aachen
  burning fireplace crackling fire", 11:54, 24 kHz): tools/den_fire_loop.py
  cuts 70 s from 4:50 (steadiest full fire), mono, warm EQ (hp 50, +1.5 dB
  @180, -2 dB @3k, -6 dB shelf 4.5k, lp 7.5k), gentle compression, a small
  damped room reverb, -20 dBFS RMS, 3 s equal-power loop crossfade, 0.25 s
  of wrap padding each side -> assets/den/fire_loop.mp3 (0.7 MB), shipped
  as dist/el-cabeza-den-fire.mp3 (build DEN_RECORDS). den-audio startFire:
  fetch+decode, looping BufferSource (loop 0.25..70.25, random start) at
  FIRE_LEVEL 0.2 into fireBus (placement kept); the made fire plays until
  then and fades out (startMadeFire); on file:// an <audio loop> element
  stands in. __DEN_AUDIO__().fire.recording = "buffer" | "element" | null.
  The source mp3 isn't in the repo (14 MB); re-run the tool with it.
- Rain sound removed (user: for now). Sound menu hint "The fire and the
  clock". The rain on the glass (visual) stays.
- Singularity entry "clipping" (user): measured at the destination the
  toll -> collapse peaked 0.87-0.98 with 88% of energy under 80 Hz (21%
  under 30 Hz by FFT) - no digital overs, but phone speakers crunch on
  that. Fix in neon.js: outStage() shared by master AND bellBus: 40 Hz
  4th-order Butterworth high-pass, then a WaveShaper ceiling (linear to
  0.7, tanh to 0.97; not DynamicsCompressor, which adds make-up gain) ->
  destination. Hum: 45 Hz 4th-order high-pass after its lowpass (lp Q 3
  -> 1 dB), stutter ramps 6 -> 15 ms. Roar: bandpass from 90 Hz (was 55),
  soft-clip drive 5.5 -> 1.8 (x1.8 gain), 4x oversample. NOTE: Web Audio
  lowpass/highpass Q is in dB (Butterworth pair = -5.33 / +2.33 dB).
  After: peak 0.47-0.65, 0 samples over 0.7, FFT under 30 Hz 1-2%.
  tests/audio-bell.mjs meters buses feeding a node flagged __ecOutput,
  HEADROOM_PEAK 0.8, subsonic gauge (4th-order LP 30 Hz) < 6% (old code
  15%, new 3-4.6%).
- Bell toll revoiced (user: still crunched at the toll on the phone): at
  its bus the strike was 77% under 80 Hz (44% under 50). Now: 32 Hz sub
  swell removed, hum partial (33 Hz) 0.2 -> 0.04, prime 0.22 -> 0.14 and
  its beating twin 0.11 -> 0.07, quint 0.10 -> 0.14, nominal 0.13 -> 0.2
  (d 6), twelfth 0.055 -> 0.09 (d 3.2); low partials (r < 1.6) attack
  12 ms; reverb send high-passed at 110 Hz; BELL_BUS_GAIN +2 dB. Strike now
  16-25% under 80 Hz, 70-80% in 80-400 Hz; mix subsonic gauge 1.1-1.5%.
- Fireplace logs (user: look like actual wood): den-room log() builds each
  from an open CylinderGeometry (16 x 8) with a lumpy, split-flat, tapered
  radius rad(a, t) and a slight bend, its own UVs (v scaled len/11), in
  M.logBark (TX.barkLog: 14 wavy ridges in long plates over dark fissures,
  grey-brown; u 0.55-0.95 charred with glowing cracks, which faces DOWN
  once laid on its side), plus two CircleGeometry end caps whose rims take
  the same radius (cap (x, y) -> side (x, -z) at the top end, (x, z) at the
  bottom) in M.logEnd (TX.logEnd: rings, cracks, pith, charred bark rim).
  Baked k 1.15. Checked by rendering the scene from a camera placed in
  den-local coordinates (FLOOR -1.575, RZ 88) via __DEN_THREE__.
- Singularity starfield: 240 + 36 stars (was 700 + 100; user: fewer).
- Guided run prompts (user): the "Special orders now open" note gets
  .td-sing-glow (Singularity cyan/violet halo, tdSingGlow 2.4 s) while
  HOME_STORY.guided(), and a tap elsewhere doesn't put it away then (it's
  the way into the scene); opening the order form by any route dismisses
  it (openOrderForm / openCustomRules). In the form, where === "guided":
  the place button glows too and waits (data-waiting, aria-disabled,
  .td-wait dimmed) until anything differs from the form's starting
  selections (JSON compare); a tap while waiting shows .td-nudge "Be sure
  to order some new special pieces first — or new rules, or a new board."
  for 3.8 s. Tests tap it with force (aria-disabled).
- den-audio: on file:// the fire goes straight to the <audio> element
  (fetch there logs a CORS error that failed the tests' console check).
- Special-orders note glow (user): NOT lit at first; a tap outside it in
  the guided run sets noteGlow (tienda-overlay useSetupExtras) and only
  then .td-sing-glow pulses on it. The form's place button keeps its glow.
- Den game survives a trip to Neon (user): unified.jsx passes carry /
  carryRef to ElCabeza3D; beginTransition "in" (den -> Neon) saves
  { game: carryRef.current(), rules: rulesNow() } (board, laws, black
  holes, missing squares) in denSaveRef; "out" puts the rules back
  (putRules) and hands the game as `carry`. Story cuts clear it (fresh).
  tests/e2e-den-return.mjs (fails without the fix: piece reset, turn
  reset, Begin Game waiting).
- Order button glow: same rule as the note (user) - btnGlow set by the
  first pointerdown that isn't on the button (in practice the first
  choice made on the form); a tap straight on it only nudges.
- Store levels (user): MUSIC_VOLUME 0.5 -> 0.3 (tape + arrangements,
  ceiling speakers, 40% lower); PA_VOLUME 0.8 on paAnnouncement's gain
  (chime + voice, 20% lower; also the clerk scene's page); store ambience
  and pieces unchanged.
- The summons (user's "idea 5"): Nova's first arrival in Neon from the den
  TV (!singularitySeen()) mounts themes/neon-summon.js inside
  novaNeonTheme.mountAmbientEffects (apps/unified.jsx). A small black
  sphere (Fresnel rim) with a slightly larger, gently pulsing cyan ring
  (billboarded, varied arcs so its slow turn shows) appears over the
  board's middle; the pieces turn partway toward it (slerp 0.55), lift
  S*0.3 and bob asynchronously (0.35-0.7 Hz); compression shock waves
  (post pass: scene -> multisample RT -> full-screen quad, radial
  x*exp(-x^2) displacement, slight RGB split) come ever faster and
  stronger over 45 s. Height is solved each frame (binary search): screen
  NDC y <= 0.6 and the ring's top under .ec-title's bottom + 14 px
  (desktop's big title), eased toward, minH S*0.9.
  Board is non-interactive: a fixed div (data-testid summon-shield) over
  the canvas swallows everything; a tap within R*2.6 of the sphere (after
  TURN_AT) calls summonBridge.reveal = the theme's revealSingularity (the
  invite, then the toll). html.ec-summon hides the dock piece/panel and
  the shell bar. It ends itself when three.singularity.phase leaves
  "idle" (pieces restored). Reduced motion: no waves, no bob.
  Chassis: the ambient object may have render(renderer, scene, camera)
  returning true when it drew the frame itself.
  Test hooks: __EC_SUMMON__() {active, ready, waves, height, S, screen,
  lifted}; __EC_SUMMON_END__ (only with __EC_TEST_HOOKS__) - tests that
  arrive in Neon through the TV (nova-mobile, nova-sound, den) end it
  first. tests/e2e-summon.mjs covers it.
- The summons' sound (user's pick "C6" from the sound mock-ups page,
  https://claude.ai/artifact/4ewUuJvPKeGSa9pbpoDYAs, source in the session
  scratchpad): themes/neon-summon-audio.js. The Monks' Hum "10G" (E minor
  from E1: 41.2 61.74 82.41 98 123.47 Hz, 3 detuned saws each with their
  own vibrato and breath, top two -6 dB, no whistle, lowpass 380) pitched
  -7 semitones, gain = build^2 (build: 0 at the sphere appearing, 1 at full
  wave strength, 45 s ramp), never moving in pitch (user: no up/down); the
  thunder "9H" (brown-noise bed lp 80; ring roll; each hit a dull crack
  lp 250 + rumble lp 300->70 over 2.2 s, one hit and a long dark reverb
  of its own (5 s IR, lp 1200) - user: reverb, NOT echo/repeats, and no
  upsweep) on a growing share of the waves: density 0.15 + 0.85 k^1.6
  through an accumulator (starts 0.5), so thunder at ~12, 20, 26, 30,
  34 s ... then every wave. (Since the next change the share is decided
  in neon-summon.js and sound.hit() just claps.) Trims as on the page: hum -9.5 dB, thunder
  +10, whole -1.6, 0.3 send into a 3.2 s room.
  Two mixes (summonMixFor: "(hover: none) and (pointer: coarse)" ->
  "phone", else "full"; localStorage "ec:summon-mix" overrides): full is
  the whole range; phone takes out < 120 Hz (4th-order Butterworth, where
  most of this sound's energy is and a phone speaker can't play it; it
  only drives the speaker/OS limiter into crunch), soft ceiling (knee
  0.18, top 0.26 in page units), +3 dB after, shorter reverbs. Measured
  through the game's chain (interface gate -> sfxOut 1.25 -> master
  +17 dB -> outStage): full peak -5.4 dBFS, rms -20.6 at full; phone peak
  -9.9, rms -23.8; neither reaches the outStage ceiling (0.7).
  Routing: soundscape.summonOutput() (themes/neon.js) = { ctx, dest:
  interfaceGate, resume } (ensureGraph; the sound menu's interface slider
  and mute apply). neon-summon.js: sound.start/update each tick, wave()
  on each shock wave, resume() on any tap on the shield (a phone starts
  the context suspended), end(1.5) with the scene (reverbs ring out, all
  stopped 5 s later), end(0.3) on dispose. __EC_SUMMON__().sound =
  { mix, state, thunder }. tests/e2e-summon.mjs checks phone mix on a
  phone, full mix + thunder on a computer.
- Summons: shock waves only with the thunder (user). neon-summon.js keeps
  the beat (every 3 s -> 1.1 s over 45 s) and the density accumulator
  (0.15 + 0.85 k^1.6, from 0.5); a beat that makes it through claps the
  thunder (sound.hit) and spawns the visible shock wave (skipped under
  reduced motion; the thunder still plays). Between claps, and from the
  lift on, the whole frame melts: the post shader's uMelt (0.003 UV,
  eased in over 5 s from LIFT_AT) x a two-sine wobble of the uv (spatial
  ~1 cycle per screen, uTime * 0.13..0.23 rad/s, i.e. ~30 s swells;
  x scaled by 1/aspect so it's even in pixels). First clap ~12 s after
  the waves' start, so e2e-summon waits 30 s for waves >= 1.
- Summons sphere: pure black (user: "completely black, like a black
  hole"): MeshBasicMaterial black, no rim, depthTest/depthWrite off,
  renderOrder 10, and transparent: true at opacity 1 so three sorts it
  into the transparent list with the see-through Neon pieces (renderOrder
  only orders within a list; opaque draws first) and it's drawn last,
  over the ring and any piece behind it.
- Clerk scene: the "One minute! I'll see if we have it in the back!" shot
  (clerk-back) is out (user); frame 2 is just clerk-go. 14 shots in 12
  frames (build.js CLERK_SHOTS, tests/e2e-clerk.mjs updated; the jpg stays
  in assets/tienda/clerk unused).
- Summons singularity now looks like the Singularity's own sphere (user):
  the sphere uses neon-singularity.js's SPHERE_FRAGMENT look (Fresnel
  rim pow 2.5, blue 0.4/0.85/1.0, 22% breathing at 1.1 rad/s, faded in
  with the ring's uOpen), still transparent-at-opacity-1, no depth,
  renderOrder 10; the ring is a halo right on the disk's edge (additive,
  renderOrder 9, geometry R*0.9..1.9, a thin line exp(-(d/0.045)^2) at
  d = (r-R)/R = 0 plus glow exp(-d/0.16)*0.55 outside, slow 3/7-lobe arcs,
  same breathing), fixed size (no more growing from 0.6). RING (1.25 R)
  is now only the glow's reach for the title check.
- Summons halo alive (user: pulsating and vibrating, plasma jets from a
  vast distance): uTime on both shaders (0 under reduced motion). Pulse =
  1 + 0.26 sin(breath) + 0.08 sin(7.3t) sin(2.9t), on the sphere's rim
  and the halo. Halo: the edge radius shivers (0.010 sin(9a + 23t) +
  0.012 noise), the edge line flickers along its length (value noise on
  the circle, dir = (cos a, sin a), so no seam), and sparse thin jets
  (noise over 0.58, ^2.5) of varying length (0.18..0.68 R) ripple outward
  (0.75 + 0.25 sin(60d - 9t)), cut off by d 0.9 (ring geometry to 1.9 R).
- Summons: the dock is hidden with visibility (not display: none). The
  chassis's pre-game fit (recompute) measures the dock's top; a
  display:none dock has no box, so it bailed, the board was never fitted
  (lastBoardFitRadiusRef null), and the Singularity sphere arrived filling
  the phone (user; the browser's Back re-ran the fit). e2e-summon now
  checks the sphere's on-screen radius (< half the width; 158 px of 390).
  Also: the shield wakes the sound on pointerup/touchend/click as well as
  pointerdown (a touch counts as a user activation only at its end).
- Unresolved (asked the user): a "global sound dampening" on some boards,
  and no sound for the wormhole on their phone. In Chromium (with and
  without the autoplay flag, real touch taps) the toll, hum and roar all
  play at -17..-19 dB RMS through Neon's context; the den's context stays
  alive (silent) while in Neon.
- Den fireplace (user: the rock, mortar and mantel looked ridiculous):
  den-textures.js fieldstone() now paints per pixel (512, scale: false -
  ~150 ms desktop; 1024 would cost seconds on a phone): a 7x7 jittered
  (0.7), additively weighted (w <= 0.02, below the closest sites' spacing,
  or a heavy stone claims a ring inside its neighbour) Voronoi, domain-
  warped, corners rounded by a smooth-min of the two nearest joints;
  STONES palette of greys/buff/brown/rust/slate/pale; stones mottled at two
  scales, granite grit, 22% with quartz veins, rounded and lit from above,
  darkening into the joint; mortar sand-grey, gritty, sunk back (darkest
  against the stones), anti-aliased over ~1 px. Periodic value noise on
  power-of-two lattices (mask wrap, +16 offset keeps it positive).
  STONE_TILE 22 -> 20. The mantel is M.beam: beam() a square (the room
  maps textures square; a 4:1 one came out stretched upright) rough-hewn
  timber, horizontal grain, adze dents along the grain, knots, checks;
  painted 20% wider and the extra folded over the start so it repeats
  with no seam. e2e-den's draw-call line 200 -> 210 (the beam's material
  made 200).
- Den fireplace, again (user: flat, like flagstones, not round river
  rock): fieldstone() is now flagstone. Courses of NX 4 x NY 9 sites, odd
  rows shifted half a slab, distance with x squeezed by AX 0.5 (slabs
  twice as wide as tall), plain nearest-two Voronoi (straight, sharp edges;
  a little high-frequency warp for split, ragged edges); the joint distance
  is the true one (the squeezed bisector mapped back: D'/|A^T n'|), so
  joints are the same width either way; mw 0.0065..0.0105; grey gritty
  mortar sunk back. Each slab's face flat with a slight tilt, level
  layers that wander and fade (sin with a noise-warped phase and noise
  amplitude), a cleft step now and then, pits, iron staining in 30%, a
  thin chipped arris lit toward the light. Everything periodic (no u
  scaling or slant: they seamed at the tile edge). ~0.2 s at 512.
- The TV's pull on the music (user: a record at full blast drowned the
  set acting up): den-audio.js setTvPull(p) from den-fx.js each frame - 0
  until the lure's first stir (LURE_WAIT), then max(0.4, waited/LURE_RAMP),
  1 while looking at it or while it's on. Music chain: tone -> warp (delay
  0.03 s, 0.55 Hz wobble of 0.0035 s x pull, ~1% pitch) -> duck (1 -
  0.85 sqrt(p): -6.7 dB at 0.4, -16.5 dB at 1) -> drop -> musicBus. Each
  haunt knocks it (musicGlitch): thump/static/phantom/flash/flicker a
  dropout to 0.06 for 60-310 ms; roll/tune/ghost/voice/flash/pilot a
  pitch sag (delay drawn out 14 ms x strength and back). __DEN_AUDIO__ now
  has tvPull and music.duck/wobble; __DEN_TEST_PLAY__(url) (test hooks
  only) starts a track; e2e-tv-lure checks the record backs off and warps.
- Fireplace: back to the river-rock fieldstone (user: "never mind, go back
  to this one", after seeing the flagstone). fieldstone() is again the
  version from c40fb1e (weighted, rounded stones in sunken mortar); the
  beam mantel and the TV's pull on the music stay.
- Den: while the set holds the camera (tvW > 0.02 or tvGoal > 0: the lure's
  look, the commercial, the way in and out), den-fx.js swallows drags,
  wheel and touchmove on the canvas at window capture (ahead of the
  chassis's document-level two-finger gestures and the canvas's orbit);
  taps still go through. Before, a swipe during the commercial moved the
  board's camera underneath and the set let go onto the carpet (user;
  without the guard the same drag ends at camera y 43, top-down).
  e2e-summon now goes BACK into the commercial, drags, and checks the
  board is on screen after the set goes off.
- Den fire bed (user: the orange slab under the logs made no sense): a
  cast-iron grate (5 bars front to back, rails, the front rail's ends
  turned up; M.black, so no new draw call) and TX.emberBed(): dark warm
  ash, a deep orange heat pool under the logs, charcoal chunks and coals
  glowing more toward the middle, glowing cracks, fine ash; transparent
  at the ragged edges; fog: false (fog tinted the ash blue); its colour
  breathes with the flame flicker.
- Clerk scene: the time captions (a frame's `narration`: "Later that
  day...", "Moments later...") sit up top, above the clipping (user), in
  the cream .td-clerk-when style (absolute, top -46px, so the panel doesn't
  move); the yellow "You hand over the order form..." stays in the foot.
- Den telephone (user): on the west credenza, a little left of the
  abstract's middle (z 7.5): a Western Electric 2500 Touch-Tone desk set
  in avocado (M.phone 0x7d8b3e, M.phoneKey cream), 1.3x life so it reads
  from the pit; base, raised back, a sloped front with a dark bezel and
  twelve keys (4 x 3), the cradle's two horns and the handset across them.
  No cord (user: don't draw it; placed so it'd run off behind).
- The wormhole's sound on a phone (user: still missing). Measured through
  the game (a 300 Hz high-pass meter on the output), the toll and the
  collapse were -17 dB RMS full-band but -33 dB above 300 Hz: the drone
  and the roar live under 150 Hz, which a phone speaker can't play. So
  startSingularityCollapseRoar adds "the pull": white noise, HP 250, a
  bandpass rising 500 Hz -> 3 kHz (Q 0.7) with a flutter 5 -> 22 Hz, gain
  0.028 + 0.014 c^1.2; and a riser, three detuned saws (110/165/220 Hz)
  climbing two octaves, LP 500 -> 3500, gain 0.008 + 0.005 c^1.1. Both
  through a soft tanh ceiling of their own (0.014, ~0.12 at the output),
  or the noise's peaks cost audio-bell its headroom (0.72-0.78 without
  it). The roar trimmed 0.032 -> 0.026 (its lows are inaudible on a phone
  anyway). Above 300 Hz the collapse now climbs -32 -> -24 dB (was -33
  flat); audio-bell peaks 0.53-0.60 (baseline 0.47-0.60).
- The summons' way out (user: the last thunderclap's reverb should carry
  all the way through to the sphere, and the fade was too slow/stark):
  neon.js summonOutput() now hands it summonTail, a bus straight to
  outStage at the interface path's level (1.25 x MASTER_GAIN x
  chGain("interface"); mute and the slider follow it), outside master,
  so the event-horizon cut doesn't touch it. neon-summon-audio.js: the
  claps have their own fader (thWhole); end(fade = 0.35, { last }) takes
  the hum and the bed down in ~0.35 s and fires one last full clap into
  its own 10 s reverb (LP 900) as well as the usual one, ringing through
  toll 2 s + fall 3.6 s + black 0.9 s + the sphere's fade; it all stops
  after 10.85 s. Leaving the theme (dispose) passes last: false.
- Summons: thunder earlier (acc starts at 0.7, first clap on the third
  beat, ~6.6 s; was ~12 s) and the pieces bob more (0.07 -> 0.16 of a
  square, lifted 0.3 -> 0.4 so a bob's low stays clear of the board).
- The special-orders note, the first time through (guided; user: only it
  can be tapped, and a tap elsewhere should make its blue throb harder):
  tienda-overlay.js, while the note is up and story.guided(), stops every
  pointer/touch/mouse/click/wheel event (and keys but Tab, and Enter/Space
  on the note) at window capture unless it's on the note, so the board,
  the camera, the dock, the room and the corner buttons see nothing. The
  camera therefore stays square on the board, as the set left it (the
  user's angled shot came from taps and drags that got through). Each
  stray tap adds .td-throb (restarted each time, two frames after
  React's render): tdSingThrob, 1 s, scale to 1.09 with a halo to 34 px +
  90 px, a rebound, then back to the tdSingGlow breathing. e2e-story now
  drags and wheels with the note up (camera unchanged, td-throb set) and
  opens the order form from the note (the dock's Custom rules is blocked).
- Den: the set lets go onto the board square on (user: after the
  commercial it came back at an angle). The board's heading (cam theta:
  a sideways drag turns the board, not the camera) comes along from
  Neon; when the den mounts returning from Singularity, den-fx.js (now
  given `cam` and, from standard.js, `viewPitch` via createDenEffects's
  options) snaps cam.current.theta to the nearest quarter turn and phi to
  viewPitch; the chassis eases its view there unseen under the set's
  hold. (Drag the den to -2.60 rad, through the TV and back: -pi.)
- Home with the special order (user): themes/den-call.js, created by
  den-fx.js when Nova hands tv.call (apps/unified.jsx storyBridge.callNext,
  set by goHomeConfused with the order, read once by homeTheme's mount).
  - The thought: once the story cut's gone, +1.2 s, a cloud (SVG: ellipse
    ringed by 15 puffs, all stroked then all filled so only the outer edge
    is outlined; three trail puffs dropping toward the bottom of the
    screen) with "Finally... now I can play a game in peace." for 5.4 s.
  - The ring: a game under way (awaitingBeginRef false; the ordered game
    begins itself) 14 s, and 6 s after the thought. A Western Electric
    ringer: two gongs (1070 / 1290 Hz, partials 1, 2.32, 4.25, 6.63; about -25 dB RMS near it) struck
    alternately by a 20 Hz clapper (env jumps to 1, decays to 0.42, tau 28
    ms; a filtered noise tick per strike), 2 s on / 4 s off, ringing out
    (tau 0.32 s). From the phone (den-room.js phone.point; an unseen hit box
    phone.pickables, pickScene "phone"): den-audio.js phoneOutput() (ring
    bus -> pan -> the room gate, and a send to the room's reverb; ear bus
    -> master) and setPhoneListener(distance, pan) every 120 ms. The slip
    "The phone is ringing / Pick up", or a tap on the phone, answers; 8
    rings unanswered and it tries again in 45 s.
  - The call: the receiver's clunk, the line's hiss and click, the record
    ducked (duckForCall: musicBus 0.9 -> 0.22). The caller is babble():
    a sawtooth glottis (205 Hz, 5.5 Hz jitter) into three formant
    bandpasses (Q 9/12/14) set per syllable to random vowels, syllables
    counted from the words, a consonant's noise burst ahead of 55% of
    them, pauses at commas/ellipses/stops, pitch falling through each
    sentence (up at a question's end); all down a telephone line (HP 400
    x2, +5 dB at 1.8 kHz, tanh crunch, LP 3 kHz x2) into the ear. The slip
    shows each line (SCRIPT: You "Hello?"; Big Glutts found the pieces;
    you already have them; "Oh. You do?"; a pause "..."; come get these
    for free, sorry for any inconvenience; "Okay. I'll be there."; Click.).
    Then the caller's click, and the receiver down (clunk, the bells'
    tinkle). Test hooks: __DEN_CALL__(), __DEN_CALL_NOW__(). e2e-story
    checks the thought, the rings, answering and every line to the end.
- "Start the story over" is "Restart story" (user), on the story links
  (tienda.js) and the phone menu (unified.jsx).
- Pinch out (user: in works, out barely): on a phone Neon's fitted view
  (41.8) sat close to the fixed limit (ZOOM_MAX_FOR_BOARD, 53) while in
  went to 12.8. zoomMaxFor() is now also at least 1.8x the board's fitted
  radius (lastBoardFitRadiusRef); the wheel shares it.
- The summons can be looked round (user: pinch a little, turn the board):
  the shield (which keeps every event from the board, so no piece is
  touched) drives the chassis's camera goals itself (mountSummon gets
  `cam`): one finger/mouse drags turn (theta) and tilt (phi, -0.3/+0.25 of
  where it started, at most 1.2), two fingers or the wheel zoom within
  0.6-1.7x the starting radius. A tap (no drag) on the sphere still opens
  the invite; the reveal is now on pointerup, so a drag starting on the
  sphere doesn't.
- Summons pieces adrift, ghostly (user: slower, drifting, sideways too):
  rise and fall at 0.1-0.17 Hz with a 0.23-0.32 Hz ripple on it (0.16 of
  a square), a sideways wander on x and z (0.05-0.11 Hz, 0.12 of a
  square), a lazy tilt (about 4 degrees); lifted 0.4.
- The gravity well (user's pick for "the grid board warping"): while the
  summons is up, the grid's lines (each segment cut into 36), border (48)
  and glow (a 64x64 plane with the glow texture) are drawn by copies
  under a vertex shader (WELL_VERT): lifted by uA / (1 + (r/sig)^2),
  sig 0.3 of the grid, drawn in by uPull; 0.45 of a square at first to
  1.8 at full build, breathing; each thunderclap a ripple (radius 0.42 of
  the grid a second, 0.4 of a square x strength, dying at 0.8/s). The
  real grid is hidden meanwhile; at the summons' end the sheet eases flat
  (0.9 s) and the grid comes back (at once if the theme's left).
- The sphere's arrival (user's pick: recede while it fades in): at
  BLACKOUT -> SPHERE, s.sphereArriveAt; fitSphereToScreen puts the
  sphereFrame 55% of the way toward the camera and eases it back (cubic)
  over SPHERE_FADE_IN_MS. e2e-summon: 343 px on arrival, 158 settled.
- The den's lure, weirder (user): events every (6.5 - 4.7 level) s (was
  9 - 6.5), flurries 25-75%; ghosts and tuning from the start, voices and
  surges from 0.12, phantoms from 0.2 (up to three at once); everything
  brighter and more torn; the ghost jumps and rolls; new: "knob" (the power
  knob turns a little way by itself, clicking, and back) and "surge" (a
  whine climbing to the flyback, a glare flooding the room through the
  screen light, a thump). The music under it (den-audio.js): wow 0.55 Hz
  at 0.009 x pull (was 0.0035) plus 0.13 Hz at 0.006 and a 7 Hz flutter;
  a crossfade into an overdriven, 1.3 kHz band-squeezed copy (0.7 x pull);
  dropouts to silence and, for static/thump/surge, stuttering back;
  pitch sags to +0.04 s of delay, half of them lurching sharp after.
- The phone's bell is the user's recording (assets/den/phone_ring.mp3,
  el-cabeza-den-phone-ring.mp3 beside the page): a Stromberg-Carlson 1543,
  its first three rings (3.60-21.60 s of the file, mono, 10 ms fades, the
  talk at the end cut, lo-fi as recorded), each ring playing the next of
  the three 6 s slots at 0.4; the synthesized bell stands in until it's
  loaded; from disk (file:), an <audio> element seeking to each slot.
- The story's first moment (Nova, the box lid in the store; user): only
  "See the pieces" (tienda-lid-order) and the corner's full-screen switch
  ([data-fullscreen-toggle]) take a tap. tienda-overlay.js (lidLocked:
  store && story && overlay === "lid") stops every other pointer/touch/
  mouse/click/wheel event and key at window capture; "Open the box" is
  dimmed (td-locked, aria-disabled). Each miss lights See the pieces in
  the Singularity's neon (td-sing-glow) and throbs it (td-throb,
  tdBtnThrob, restarted per miss); from the third, StoryHint: "There's a
  story here... if you're interested." on a 1975 paperback-rack card
  (Caprasimo, a Cooper Black, loaded on demand; brown/rust/orange/mustard
  stripes; tilted, popping in with a bounce, again at each miss), up top
  over the box's photo so it never covers the button, taking no taps. The
  first-tap full screen still happens on a missed tap (lidFsTried).
  e2e-story now goes in by See the pieces (catalog, then Close).
- The den's music on the first visit (user: a random track already on, so
  there's normal music to hear before the set starts getting at it, at
  about 30%): den-fx.js, when the den mounts in Nova with the lure on (the
  Singularity not yet seen, not back from it), once no story cut is on
  screen + 1.2 s, plays a random record or 8-track through the chassis's
  own player (new ambient helper `music`: { tracks, play, playing }, via
  playTrackRef, so the chip and the turntable/8-track show it), unless
  something is already playing. den-audio.js playMusic takes track.level
  (a gain after the drop, before musicBus; 0.4 here, user: was 0.3); the
  room's own sounds at 87% on that visit (setRoomTrim, in roomLevel); __DEN_AUDIO__ shows
  music.level.
- Full screen everywhere (user: every screen should always be maximized
  if possible; the button stays, to come out): the chassis's first-tap
  full screen is now every theme's (unless fullscreenOnFirstTap: false)
  and not once a visit: any trusted click finding the page out of full
  screen puts it back, unless the player came out themselves with the
  button or the two-finger double-tap (fullscreenDeclined, module level,
  cleared when they go back in). Nova's store sets it true always.
- The summons (Neon's first visit) hides the corner's How to play ("?")
  and full-screen buttons (user), and a tap on it (at the tap's end: a
  touch is a gesture only then) goes full screen if it isn't.
- Pinch out (user's video: close over the den's steps, fingers a thumb's
  width apart closing a little, it barely moved): the pinch is measured
  from its start (pinchSpan0, pinchR0 = zoomBase() when the second finger
  lands), and coming together goes by the ratio's 1.8th power (apart, as
  before, by the ratio). Measured per step, a two-finger pan's jitter in
  the spread ratcheted the view outward; from the start it doesn't. A
  150 -> 90 px pinch now takes the camera out 2.5x (was 1.7x).
  __EC_TEST_CAM__() also reports target and roomLimit.
- The order form the first time through (guided; user: only Order it at
  Big Glutts, the pieces' counts and scrolling): OrderForm stops, at
  window capture, every control but the pieces' - and + (tienda-piece-*-
  inc/dec), the button (tienda-order-place) and the full-screen switch,
  the backdrop (a tap there would cancel), and Escape; drags and the wheel
  off the form; taps on the paper itself pass (it scrolls). Cancel and
  Standard are dimmed (td-locked). Any tap off the button lights it (as
  before); a miss also throbs it.
- e2e-fullscreen: Standard now goes full screen at the first tap; the
  two-finger double-tap over Begin Game comes out, and a later tap
  leaves it out (fullscreenDeclined).
- The commercial's voices 0.5 s earlier (user: the dialogue was late):
  den-audio.js tvCommercial's voice() plays each at its cue - VOICE_LEAD.
- The order's stamp (user: a quick whoosh-thunk, a rubber stamp smacking
  the paper, on the Order it at Big Glutts form): den-audio.js has its own
  playOrderFilled (the den had none): a bandpassed whoosh rising 500 ->
  2400 Hz over 0.21 s, then at the landing (tdStamp's 0.22 s) a 130 -> 52
  Hz thud, a lowpassed burst and a paper slap. Tienda's playOrderFilled
  gets the same whoosh, its smack and the register moved to land with it.
- The phone answered by picking it up (user): no "Pick up" button (the
  slip: "The phone is ringing / on the credenza"); a tap on the phone
  (pickScene "phone") answers. The handset is its own mesh now (den-room.js
  phone.handset: grip and cups baked where they lie, merged, about a pivot,
  userData.rest; its own clone of M.phone). den-call.js animateHandset:
  ringing, it shivers and hops on the cradle in each ring's window (the
  same 6 s cycle as the recording's rings); answered, it lifts (950 ms, up
  off the cradle then toward you) to low right of the view, upright and
  turned in (earPose: camera + 8.5 forward, -3.3 up, +3.1 right), brightening
  to x1.75 out of the credenza's shade, and follows the camera through the
  call; 0.75 s before the hang-up clunk it goes back down. Test hooks:
  __DEN_CALL_PICKUP__(), __DEN_CALL_HANDSET__() (rest/lift/held/down).
- The stereo never plays the same song twice running (user): the 8-tracks
  no longer loop; when a track ends the chassis plays the next in its own
  medium's running order (records and tapes kept apart, user), shuffled
  once a visit (module-level musicOrder[medium]) and gone round again in
  the same order, at the level the last one had (the first visit's 30%).
  Alone in its medium (one record, for now: more to come), a track just
  ends.
- The commercial's voices now 1.5 s ahead of their cues (VOICE_LEAD; user:
  a second earlier again).
- The summons' drag turns the board by the board's own rule (user: the
  bottom half spun the wrong way): a touch beginning above the board's
  middle on screen (its far half) turns it one way, below the other, as
  the chassis's grabFollow fallback.
- Clerk scene, manager-1: Steve B.'s gaze was warped to match the
  manager's (0e48759), then undone at the user's word: the photo is the
  original again.
- While the set holds the camera, a touch that begins on the canvas starts
  nothing (den-fx.js onHoldDown, window capture, pointerdown/up/cancel),
  except a tap on the set itself, and not during the commercial (a tap on
  the picture had switched it off half-way). The lure's look keeps its own
  tap-elsewhere-to-go-back. (Chasing the user's "camera on the carpet after
  the commercial": not reproduced; taps all over during the commercial, a
  pinch and turn in the summons, and a finger moving through the release all
  leave it square on the board.)
- "Restart story" asks first (user): storyBridge.restart (the dock's link
  and the phone menu alike) opens RestartConfirm (apps/unified.jsx): a
  cream card over a dimmed screen, "Restart the story?" with "Keep
  playing" (focused) and "Restart story"; a tap outside or Escape keeps
  playing. Only "Restart story" (restart-confirm-yes) does it. e2e-story
  checks Keep playing leaves it be; e2e-journey goes in by the lid's See
  the pieces after the restart (the story's lid takes nothing else).
- The story's lid, revised (user: "Open the box" is the intended first
  button, "See the pieces" gone): in story lock (lidLocked), BoxLid shows
  only "Open the box" (tienda-open-box, autofocus), plain (no td-locked,
  no aria-disabled, no glow or throb); tienda-lid-order isn't rendered.
  The window-capture blocker now lets through only tienda-open-box and
  [data-fullscreen-toggle]; misses still count, and from the third the
  StoryHint card comes up. Open the box closes the lid into the store's
  game (no catalog on the way). The standalone Tienda page's lid keeps
  both buttons. e2e-story and e2e-journey go in by Open the box.
- The commercial's music, continuous (user: since the voices moved 1.5 s
  earlier, the music dropped out several times): the rhythm box and organ
  used to stop in three places (6.8-17.6, 22.2-25.8 s) for the voices to
  have the scene alone; with the voices earlier, those became silences
  (measured: only the tape hum left). den-audio.js tvCommercial now runs
  box() on its own `bed` gain from the title to AD.never without a break,
  and ducks the bed to 0.5 under each voice (windows from the recordings'
  lengths, VOICE_LEAD applied; touching or overlapping lines merged so it
  doesn't bob up between chess, checkers and the king). The tears and the
  subliminal frames' brief quiet still cut everything, as the picture does.
- Drag turn and tilt back to the original rule (user: "reset directional
  spin and tilt to original settings, and ensure the original move intent
  is kept even if crossing meridians or equators"). Chassis: the grab-
  follow machinery (ff503e3: the point under the finger tracked, the sign
  re-picked every few frames, so it could reverse mid-drag) is gone;
  grabLatch at touch-down fixes both signs for the whole drag. Board
  views: begun on the screen's upper half theta += dx, lower half
  theta -= dx (the original dragFlipTheta turntable rule); phi -= dy
  (finger up, toward the horizon). Room view (dollhouse, the user's own
  later ask): both axes reversed, the same anywhere on screen. The Neon
  summons' drag follows the same rule: its turn by the screen's half (not
  the board centre's projection), latched, and its tilt now the board's
  way (it was reversed). tests/e2e-drag-follow.mjs replaced by
  tests/e2e-drag-latch.mjs (drags across the middle both ways, every step
  the first step's sign; play view and Room view).
- The commercial's sound, redone from scratch (user: "it's just gotten
  too messed up"; chose: keep all four voices, each on its own scene, a
  cheesy 70s jingle, light TV damage). New module themes/den-ad-audio.js
  (playCommercial(ctx, tv.bus, {delay, noiseBuf}) -> {stop, end};
  loadAdVoices(ctx)); den-audio.js's tvCommercial just calls it, tvOff
  stops it; the old tvCommercial (tears, buzzes, VOICE_LEAD, the gapped
  rhythm box) is gone.
  - Voices: decoded to AudioBuffers ahead of time (loadAdVoices from
    tvGraph) and started on the audio clock; from file: (no fetch), a
    preloaded <audio> element through one MediaElementSource each, its
    currentTime put forward if it starts late. The old lateness was the
    element started by a timer, loading as it went. Cues set to the words
    on screen: chessVoice 6.75 (TAKE A HIKE, CHESS! at the stamp, 6.8),
    checkersVoice 10.05 (stamp2 10.1), voice 12.55 (IS THE NEW KING! at
    king + 1.7), kings 38.4. Speech lengths 2.0/2.2/2.9/4.5 s (measured:
    each file is speech from 0, then silence). VOICE_LEVEL 0.45.
  - Music: a bossa nova home organ, one continuous 8-bar tune (C: C Am
    Dm G7 | C Am F-G7 C) with bass (an octave up for the small speaker),
    offbeat chords, kick/rim clave/hats; the "El Ca-be-za!" motif at the
    title and the credit. Bars from G0 = title + 1.4 (AD.orders falls on
    bar 7): bar 0 groove, bars 1-6 the tune, special orders up a step
    (D) with a ta-daa, back to C at the dealer, stops dead for "only
    $7.97" (cash register alone), fanfare + the cadence bar at brandNew,
    the run-up at close, a minor "too sincere" turn at never, the motif
    and a big chord fading under "the new king!" by about 43 s. Lead
    (tune) and band on their own buses: under each voice the tune to
    0.18 and the band to 0.55 (windows merged when close).
  - Jokes kept, cleaned: sad trombone, stamps, slide whistles, snores,
    cymbal swell, item bells, assembly bonk, typewriter, boing, Dale's
    phone, cash register, falling whistle.
  - TV: HP 170 / +3 dB at 1.7 kHz / LP 5.2 kHz, gentle tanh, 60+120 Hz hum,
    a slow 0.31 Hz wow; no dropouts; only the hidden frames (CUES.flash)
    cut it, for one frame (two for the last two).
  Measured in Chromium (an analyser on the destination): no gaps but the
  slate, the "only" stop and the frames; voices ~0.18-0.23 rms over the
  ducked band ~0.03-0.05; the tune ~0.08-0.13.
- tests/e2e-den-return.mjs seeds el-cabeza:special-order-noted too (the
  guided special-orders note holds every tap, so the dock couldn't be
  reached; it failed before this change as well).
- "Sure thing!" frame (clerk-sure; user): the clerk now holds the order
  form you handed him. tools/tienda_clerk_frames.py: order_form_art draws
  a prop of the game's own form (aged cream paper, "GAMES & HOBBY DEPT. ·
  1975" in red, ORDER FORM heavy black over a rule, the dark "1 · PIECES"
  band, five ruled rows with blue quantities, a blue signature, a faint
  red STORE ORDER stamp); hold_order_form warps it onto FORM_QUAD (upright
  in his palm, leaning back a little), lit from above, softened to the
  photo, with a drop shadow on him and a contact line on the palm, and
  his thumb (skin in THUMB_BOX) put back in front of it. Everything else
  in the frame (and every other frame) unchanged; re-running the script
  rewrites the others with identical pixels (only the JPEG bytes differ,
  so they were left as committed). Fonts: Liberation Sans/Mono Bold.
- The handed-over form, round 2 (user: his hand closed round it, redrawn
  as realistically as possible; and seen in his hand as he walks away):
  tools/tienda_clerk_frames.py.
  - clerk-sure (hold_order_form): the open hand taken out (skin in
    OPEN_HAND below y 274); behind it the "Hi there" frame's own pixels
    (same camera, identity alignment) where it shows no hand, the rest
    inpainted. A right fist painted in its place (paint_fist: drawn 6x on
    a 44 grid, scaled to FIST_SIZE 48 at FIST_AT): the hand's mass with
    the heel of the palm low right, four curled fingers stacked (index on
    top) with creases, knuckle sheen and tips curling in, the thumb across
    the top with its nail; lit from upper left; his own palm's grain
    (a 26x24 patch, high-passed) multiplied in; softened to the photo
    (blur 0.75) with grain. Its skin tone: the palm's median x 0.97. The
    sheet (sheet_in_fist) fans up from the fist: full width (SHEET_X_TOP)
    to 70% down, then gathered into SHEET_X_BOT with fold shading, tilted
    -4 degrees about the fist; its shadow on him; the fist's on it.
    (A real grip borrowed from clerk-phone was tried: the hand there is
    mostly wrist behind the handset, and its colours don't separate.)
  - clerk-go (hang_order_form): the form hanging from his right hand by
    its top edge (HANG_QUAD), printed side out, in his shadow a little;
    his fingertips (skin in HANG_FINGERS) back in front of it.
  The other frames are left byte-for-byte as committed.
- "Home again. Confused." (novaStory.jsx): the second line ("The new
  pieces are already on the table...") fades in 2 s after the first
  (.ns-caption.on .ns-sub: ns-in 0.8s, 2s delay); the caption now holds
  6.8 s when there's a second line (was 3.6) so it can be read.
- The phone's handset back to avocado (user: it showed cream on the
  cradle). den-call.js animateHandset set material.color to white
  (setScalar(1), and 1 + 0.75e while lifted), which wiped the material's
  own 0x7d8b3e (den-room.js M.phone, cloned for the handset); it ran every
  frame at rest, so it was cream all along. tint(hand, k) now keeps the
  base colour (userData.baseColor) and scales it. Hook
  __DEN_CALL_HANDSET_COLOR__; e2e-story checks it's 7d8b3e after the call.
- After the call (user): den-call.js yay() puts up a 1975 card (as the
  store's StoryHint: Caprasimo, brown/rust/orange/mustard stripes, tilted,
  bouncing in), "Free pieces?! Nice!..." then, a beat later, "Thank you,
  Big Glutts!"; 1.5 s after the hang-up, 5.6 s up (YAY_MS), no taps.
  testid den-yay; e2e-story checks it comes and goes.
- The set's blast (user: more extreme; a cone of light from the screen's
  edges until everything goes white for a second, then back, and weirder
  after). den-tv.js: a frustum mesh (cone, ShaderMaterial: the tube's
  outline flaring BLAST_SPREAD 5.2x over uLen, additive, rays, brightest at
  the glass) kept out of the static merge (it was swallowed by it at
  first: keep set); blast(now) once, blastState(now) -> {cone, reach,
  white} over BLAST_MS 5600 (white full 0.5-0.68, gone by 1); the tube
  glares, the room light surges, the halo floods. den-fx.js triggers it
  16 s into the haunting (5 s if you're over watching), lays a white
  overlay (den-whiteout) from blastState.white, and from then on the lure
  level is at least 0.85. den-audio.js tvHaunt("blast"): a whine and a
  roar climbing to the white, a boom and burst, a high ring after; the
  record drops out for it. Hooks: __DEN_TV__().blasted / .white,
  __DEN_TV_BLAST_PIN__(b) (test-only: hold it at a moment). e2e-tv-lure
  checks it goes white and fades back.
- The clerk's hands, round 3 (user: not convincing; try a lot harder).
  The painted fist is gone. tools/tienda_clerk_frames.py:
  - lift_hand(go): his real curled right hand from the walk-away frame
    (GO_HAND), matted off the floor by projecting each pixel between the
    floor's colour and his skin's (so the gap between thumb and fingers
    stays floor), solid core, edges unmixed, ringed with skin colour (no
    halo after scaling).
  - clerk-sure: the open hand out (lent from "Hi there" + inpaint); the
    form (perspective quad SURE_SHEET) with its left edge running through
    that thumb-finger gap, rising up behind his forearm (his own forearm
    pixels back in front); his lifted hand scaled 1.65x, turned 6 degrees
    about GO_WRIST onto SURE_WRIST, colour matched to his forearm here,
    sharpened a touch, grain; shadows each way. Done before the table's
    spread is laid over (the appliances stay in front of his hand).
  - clerk-go: the form's top corner pinched in his own hand's gap
    (HANG_SHEET), hanging below, turned a little; the hand composited
    back over it with lift_hand's matte (only where there's paper).
- The trip back to Big Glutts (user, after the call's card): themes/
  den-trip.js (createTrip({ audio, onReturn }), made by den-fx.js in any
  Nova den, started by den-call.js's card as it fades: onTrip). The
  user's two pictures, split from their upload: assets/den/trip/
  glutts-day.jpg and glutts-dusk.jpg (beside the page as el-cabeza-trip-
  day/dusk.jpg, build/build.js; loaded when the call is due). Timeline
  (ms from the card's fade): a car starts and drives off (starter cranking,
  a V8 catching and revving, idling, pulling away through a shift into the
  distance, tyres); to black 2600-4200 (the den's room/stereo/pieces step
  out: den-audio awayFromDen); the car arriving from 5200 (approach, a
  mild tired-brake squeal, the tyres, rocking to a stop, the column
  shifter into park, the key, the engine dying), heard through the
  fade-up 5600-9600; a wind outside. The camera (user: a horizontal
  sweep, taking it in; then, as it merges, up and out, dramatic): close
  and eye level, sweeping the storefront left to right 5000-11900; then
  tilting up and pulling back to the whole picture, toward the sphere,
  11700-17600 (quintic ease; less zoom on a tall screen). "What the...!??"
  10000-13200; the dusk picture comes through in wavering bands 11600-
  16400 (the bands never past the picture's edge), a low drone swelling;
  "Time to get the heck out of here!" 15200-17800 (comic speech bubbles,
  Patrick Hand); to black 17400-18900; home at 19000 in the Room view
  (its button clicked, else the camera set as standard.js's dollhouse);
  up from black by 21000. The overlay (den-trip, z 1350) takes taps while
  it's dark or away. Hooks: __DEN_TRIP__() {stage: idle|leaving|store|
  home|done, t}, __DEN_TRIP_PIN__(ms) (test-only: hold it there).
  e2e-story follows it through to the Room view.
- The commercial redone clean (user: too dirty, too messy, too garbled;
  more consistent; dialogue a little ahead; the 1975 flash a second
  longer). den-commercial.js: 24 fps (was 12); no tape faults (no roll at
  cuts, torn lines, tracking band, dropout flecks), no colour fringing on
  text (say(): one hard drop shadow, 4 px down-right, everywhere), no
  random flicker frames; the title's letters bob steadily, the glitter
  and the king's stars twinkle on smooth beats; a 0.22 s dissolve at
  each cut (the scene before painted as it was the moment before). The
  NEW FOR 1975 card strobes its colours at 3 Hz (was 6), no screen blink,
  and holds a second longer: close 35.4, never 37, credit 39.1, snow 45.8,
  COMMERCIAL_MS 46400; the last two subliminal frames 37.75 and 42.15
  (two frames each at 24 fps, the last two four). Voices a little ahead
  of their words: chessVoice 6.45, checkersVoice 9.75, voice 12.25,
  kings 38.75. den-tv.js: no snow on the tube during it. den-ad-audio.js:
  a gentler speaker (HP 120, LP 7500, +1.5 dB at 1.7 kHz, tanh 1.05),
  fainter hum and wow, the frames' dips only to 0.25; the band vamps a
  bar more across the longer 1975 card.
  (The commercial airs once, on the first return from the Singularity;
  Restart story resets that: engine/journey.js COMMERCIAL_AIRED_KEY.)
- The summons' pieces (first visit to Neon; user: rise more slowly; the
  ceiling higher, the floor where it was, more travel): neon-summon.js
  LIFT_S 2.0 -> 4.5 s; lifted 0.62 of a square (was 0.4), bobbing up to
  0.38 each way (was 0.16): between 0.24 (the old floor) and 1.0 of a
  square above the board (the old ceiling was 0.56); the rise-and-fall a
  little slower to match (0.075-0.125 Hz, was 0.1-0.17; the faster ripple
  over it 0.17-0.24, was 0.23-0.32). The sphere sits ~0.42 of the board's
  span up, well clear.
- The commercial's analog look back (user: more analog TV distortion, but
  never so you can't see what's going on). The scenes stay drawn clean;
  createCommercial composes each frame into `pic`, then analog(t, f)
  shows it: a 1.5 px composite smear (0.3), a faint ghost 13 px over
  (0.07), red and blue bleeding 2 px either side (screen-tinted copies,
  0.16/0.14), scanlines every other line (0.16), light snow (0.07, four
  pre-made fields), a soft tracking band drifting up for 3.5 s in every
  9, a line slipping 3-7 px now and then (12% of quarter-seconds), a hair
  of vertical-hold jitter, the tube's dark corners.
  The checkers beat (user): the camera opens in close on the two of them
  asleep (2.15x, a slow push in to 2.27x), and from 0.55 s in it pulls out
  over a second to the whole table; the words and the stamp are overlays
  (the character generator), so they don't zoom.
- The clerk's hands, round 4 (user: atrocious; back to the original
  frames). Every hand edit is gone: clerk-go is the original again
  (from 09555fe), and clerk-sure is the original with one thing over it:
  the user's own photo of your hand holding the order form out to him
  (assets/tienda/storyboard/offer-hand.png, RGBA cut-out, source only,
  not shipped). tools/tienda_clerk_frames.py offer_order_form: the
  photo's form corners (OFFER_SRC) mapped by one homography onto
  OFFER_DST (top edge just under his open palm at y ~300, bottom ~430),
  so the photo's own lean carries on, the form foreshortened, and the
  hand below comes on larger toward the lens with the wrist off the
  bottom of the shot. Shrunk 3x (area) before the warp; softer toward
  the bottom (blur 1.3 below y 360); warmed and dimmed to the store
  (x 1.0/0.94/0.84, 0.93); a faint shadow on the table under it. Laid
  over the finished frame (in front of the spread). lift_hand, the
  painted form (order_form_art) and the rest of rounds 1-3 are removed.
  After running the script, check out every other frame again (JPEG
  bytes differ even with identical pixels).
- The trip, round 2 (user: a little zoomed in; start out wider, then zoom
  and pan; everything 0.75x slower again): den-trip.js T is 1.75x the
  old timeline (blackIn 4550-7350, arrive 9800, fadeUp 10200-17000,
  sweep 10200-20800, say1 17500-23100, morph 20300-28700, rise 20500-
  30800, say2 26600-31200, blackOut 30500-33100, home 33300, fadeHome
  33600-36800). The camera opens on the whole storefront (zoom 1), zooms
  in (to 1.5, 1.18 on a tall screen) while panning right through the
  sweep, then pulls back up and out through the rise. e2e-story's trip
  waits raised to 20 s. The car sounds are still synthesized; the user
  is uploading real ones to replace driveAway/arrive.
- "I'll go check on that for you real quick!" (clerk-go; user): from the
  user's own pictures (assets/tienda/storyboard/clerk-go-photos.jpg, three
  panels of him walking off with the form; nine versions were offered,
  three from each panel, and the user picked A1): the wide left panel,
  same table and SAVE sign as the other frames, cropped to the frame
  (GO_PHOTO_CROP 28, 0, 794 wide), the bubble drawn fresh over the dark
  window upper left (GO_BUBBLE, tail toward his head, GO_TAIL) with the
  old frame's own lettering lifted off its bubble (bubble_text,
  GO_TEXT_BOX), so the font matches. tools/tienda_clerk_frames.py
  go_from_photo / speech_bubble.
- The phone in the den, answering (user): the ringing slip (den-call.js)
  is now a button ("tap to go to it"): a tap takes the camera over to the
  credenza, in front of the phone and a little above it (den-fx.js
  phoneGoal/phoneW in placeCamera, like the book and the set; html gets
  ec-tv-visit meanwhile), and the slip says "tap the phone to pick it up";
  the tap on the phone answers as before (pickScene "phone"). A tap
  anywhere else, or Escape, comes back; otherwise it stays through the
  call and comes back as it ends (onPhoneDone, also when the ringing gives
  up). The record: paused for the phone, not ducked (den-audio
  holdForPhone: the stereo bus fades out over 0.35 s, then the track
  pauses in its place; on hanging up it plays on from there and the bus
  comes back up over 2.2 s). Held from the slip's tap, or from answering
  if the phone was tapped directly; a track paused, played or changed by
  hand meanwhile is left as the user left it. Hooks: __DEN_PHONE_VISIT__,
  __DEN_PHONE_AT__ (the phone on screen), __DEN_CALL_HELD__. e2e-story
  plays a record, taps the slip, then the phone itself (a real click), and
  checks the record paused and back on near where it was.
- The phone's handset, redone (user: the receiver didn't look believable;
  look at photos of the era). den-room.js: a G-type handset, as on every
  Western Electric 2500 of 1975 (the G3: 21.5 cm long, 6 wide, 6.5 high;
  here ~5.7 cm a unit, 1.3x life): two round caps (LatheGeometry: flat
  face, rounded rim, short wall, domed back; radius 0.5, 0.44 deep),
  faces down in the cradle and turned 0.24 rad in toward each other; a
  handle swept along an arch (custom sweep, oval section 0.29 x 0.2,
  flaring over its last stretch into the caps' backs); smooth normals,
  baked as before. The cradle's horns became two saddles under the caps
  (z = +-CAP_Z). Pivot at the middle, 0.45 above the faces. The phone
  visit (above) now eases on the clock, 1.6 s each way (PHONE_MS), not
  per frame (slow frames had held it at the phone).
- The phone, after the user's photo (a Western Electric 500 rotary desk
  set in moss green; "this is what the phone should look like"):
  den-room.js. The housing is an extruded side profile (sloped front for
  the dial, flat top, rounded back) with bevelled edges, merged and
  smoothed, narrowing 22% toward the top; a dark base plate under it.
  The dial on the slope (R 0.9): one painted disc (canvasTexture: the
  number plate in the housing's green, white digits and letters round the
  outside, OPERATOR by the 0, the clear finger wheel's sheen and ten holes
  with their rims of light, the white AREA CODE card), a clear rim (its
  own transparent mesh), the chrome finger stop at about four o'clock.
  The cradle: two prongs on the top behind the dial; the handset (the
  same sweep and lathe caps, longer and broader: 3.9 long, caps 0.55,
  tilted 0.36, a flatter top) rests on them. M.phone 0x587658 (the
  photo's green, a little brighter for the den's warm light; e2e-story
  checks the handset keeps it); M.chromePhone for the stop; the Touch-Tone
  keys (M.phoneKey) are gone. Still no cord (the user's earlier word),
  though the photo has one.
- The caller's voice (user: their recording of indistinct chatter, cut up
  and altered, more unintelligible, to the conversation's cadence):
  tools/den_call_voice.py from assets/den/src/call-chatter.ogg (2 s, ~1.2 s
  of voice): syllable grains at the loudness dips plus overlapping 110-190
  ms windows (16 in all); each of the caller's three lines built to its
  words' syllable counts (the same rule as den-call.js), grains picked at
  random, half reversed, repitched (falling through the line, rising at a
  question's end), stressed syllables louder, gaps 20-60 ms between words,
  0.24 at commas, 0.32 at stops, 0.42 at an ellipsis; muffled (2.6 kHz),
  a 21 ms smear; one file, a line every 8 s: assets/den/call-voice.mp3
  (dist el-cabeza-den-call-voice.mp3), lengths 3.78, 0.78, 4.13 s
  (VOICE_LENS in den-call.js: regenerate both together). den-call.js
  loadVoice (fetch + decode, or an <audio> element from file:) with the
  ring; voice(k, t) plays line k down the telephone line (L.input,
  VOICE_LEVEL 0.42); babble only if it isn't there. __DEN_CALL__().voice.
- The phone's coiled cord (user: like the photo): den-room.js. From
  inside the handset's +z cap (your left, facing it) down off the side, a
  loose loop on the credenza in front, back into the housing's left side
  near the back. A centre line (CatmullRom through the handset point and
  eight fixed ones) with coils wound round it (pitch 0.1, radius 0.11,
  wire 0.046, in set units x S; Frenet frames), a TubeGeometry baked like
  the room, in M.phone. Its first point rides with the handset: rebuilt
  when the handset has moved (phone.cordUpdate, called each tick by
  den-call.js; cheap when nothing moved), so lifted to your ear it
  stretches out after it.
- Focus mode brings the camera to the board (user: as if you're going to
  start to play): the chassis's focus effect calls recenterView (Current
  Player View: the current player's side, the play pitch and radius)
  whenever focus comes on, however it came on (F, the corner button, the
  switches, a lamp). e2e-den checks the camera comes in from out in the
  room.
- The car leaving, the user's recording (assets/den/src/car-start-drive-
  away.mp3, freesound.org community: door, getting in, door shut, key,
  starter, catch and revs, idle, pulling away through first and on).
  User: fade it off right after the first acceleration; treat it to fit.
  tools/den_car_away.py: source 1.0-3.5 s (door, in, shut), 3.7-8.1
  (key, cranking, the catch and its revs into idle), 9.0-11.6 (idle's end,
  the first acceleration away), 60 ms crossfades; from 10.5 s the highs
  roll off (crossfade to a 1.5 kHz-lowpassed copy: distance) as it fades,
  gone by 11.6; band 50 Hz-9 kHz; loud parts ~-16 dBFS rms, peaks < -1 dB.
  9.38 s in all (black by 7.35 s, the arrival from 9.8 s). assets/den/
  car-away.mp3 -> dist el-cabeza-den-car-away.mp3. den-trip.js loadCar
  (with the pictures: fetch + decode, or an <audio> element from file:),
  carAway(o, t) at the trip's start into the ear (level 0.9); driveAway
  only if it isn't there. __DEN_TRIP__().car says which; e2e-story checks.
  The arrival is still made (arrive); the user may send a recording for it.
- The car arriving, the user's recording (assets/den/src/car-arrive-stop-
  door.mp3, freesound.org community: driving up and accelerating, slowing
  to a stop ~10 s, engine off ~11, door open ~12.4, shut ~13.8). User:
  not so much of the first part, fade in to about half way, keep it to
  the end, make it fit. tools/den_car_arrive.py: from 6.5 s, fading in to
  full by 8.3 (half way), duller to brighter as it nears (the leaving
  one's distance in reverse), then all of it to the end; same band and
  level as the leaving one; 9.33 s. assets/den/car-arrive.mp3 -> dist
  el-cabeza-den-car-arrive.mp3. den-trip.js: both recordings in `cars`
  (CAR_URLS), loadCar loads both, car(k, o, t) plays one (an <audio>
  element from file:, timed with later()); arrive() only stands in. From
  T.arrive (9.8 s): the stop ~13.7, engine off ~14.3, the door shut ~17.1,
  as the store finishes fading up and just before "What the...!??".
  __DEN_TRIP__().arrival; e2e-story checks both.
- Restart story's card now reads "Once more, from the top… shelf." (user:
  an ellipsis before "shelf"; apps/unified.jsx startCut caption).
- THE END OF THE STORY (user; Nova). Home from the closed Big Glutts (the
  trip's return: den-fx roomView, then tv.hall.arm() saves hallDue in the
  story record, apps/novaStory.jsx hallDue/saveHallDue), the game goes on.
  - The hall (themes/den-hall.js, createHall): four moves later (the
    chassis now hands themes `moves()`, the move log's length: a completed
    turn is one entry, both sides counted; FIRST_AFTER 4), when nothing
    else is under way (busy: the call, the trip, the set, the camera's
    visits, a cut), the hallway doorway (den-room HALL: x 60-78, the hall
    to RZ+34, its west end x 40) starts throwing out light: drawn, the den
    being baked: a swirl filling the doorway, its spill on the den's floor,
    the wall round the door and the ceiling (additive planes, soft-edged),
    sparks drifting into the room, a strobe and a violet flash over the
    screen; slow booms (a sub thump and a rolling rumble), a hum, crackle.
    The camera goes over to look (LOOK, eased 1.8 s on the clock); "Oh
    no… now what?" (the trip's comic bubble); the choice card:
    Investigate / Just keep playing — this day's been weird enough
    already. Keep playing: it dies down over 2.6 s and comes back 3 moves
    later (AGAIN_AFTER), again and again. The page's controls (the corner
    buttons, the points pill, the music chip, the phone's bar) hide while
    it's on (html.ec-hall-scene; user: a distraction then); taps on the
    board are blocked while the choice is up.
  - Investigate: the camera walks (WALK: to the door, through it, on past
    the open door's edge, turns right, a few steps toward the rift; a
    step bob), the den keeping the hall drawn (den.keepHall). It's died
    down to a glow round a small rift (a ragged vertical tear, shader) at
    the hall's west end; calm until 12.6 s; then the eruption (2.6 s: the
    rift grows, strobe, shake, a rising roar) to white, and onEnding.
  - The void (themes/den-ending.js, createEnding): its own canvas and
    renderer over everything (z 1500; Nova's cut at 3000 covers it when
    you pick a place). A lean faceless figure built of lathes, spheres and
    cylinders, near black with a violet-cyan rim shader lit from the
    sphere, pulled chest first (head thrown back, arms and legs trailing)
    toward the black sphere and its ring (Neon's look), stars, a haze,
    dust streaking; slowing to a drift, the camera easing round. The
    den's sounds step out (awayFromDen), a low drone comes in. Then
    REVELATION, one line at a time (now the user's own words, and the
    stars, haze and drone are gone: see "The void, round 2" below), then the realities menu; the story's over
    (tv.ending.finish -> saveStoryEnded, `ended` in the story record).
  - The realities (themes/realities.js): WORLDS, the Den, Neon and Big
    Glutts (Nova's own places: a fade cut with a caption) and Lluvia,
    Cromo and the Lab's ten (their pages; the Lab with ?theme=<id>), each
    with its picture (assets/den/channels/<id>.jpg, tools/channel_shots.mjs
    then channel_shots.py, from the built pages; beside the page as
    el-cabeza-channel-<id>.jpg). createRealitiesMenu: cards, "You are
    here", Stay in the den / Escape.
  - After the story: Restart story still starts it all over (clears the
    record); "Other realities" in the den's setup links, the phone menu
    (every place) and a corner button (theme.cornerAction, new in the
    chassis: a ringed planet, beside Focus; works mid-game). The set: the
    channel dial (the big knob with the numbers; user) glows, breathing;
    a turn of it clicks the set to the next reality (den-tv showChannel:
    the picture with an on-screen channel number and the world's name, a
    burst of snow, the dial a notch round; the camera over to watch, the
    hint saying what does what); the power knob is just on and off; a
    tap on the picture (the glass itself) goes there (the den: you're
    here). Knob taps beat the set's tap-anywhere box (pickScene).
  - Hooks: __DEN_HALL__ / _NOW__ / _PICK__ / _SKIP__, __DEN_ENDING__ /
    _SKIP__, __DEN_CHANNEL__, __DEN_TV_CHANNEL__. tests/e2e-ending.mjs
    walks it all (seeded hallDue; --allow-file-access-from-files so the
    pictures load from disk). e2e-den's draw-call guard is now < 216 (the
    phone's cord and the turning dial).

### The void, round 2: the user's words, the sphere alone, the chord, the merge (2026-10-01)
  - REVELATION (den-ending.js) is the user's own seven lines, verbatim
    ("....my...... god......!" through "....It was.....*always*......
    El Cabeza."); md() turns *x* into <em> and **x** into <strong>. Keep
    the dots and spacing exactly as written.
  - The void is ONLY the black sphere with its pulsing plasma ring and
    blue halo (user: "There is nothing else"): no stars, haze or dust,
    whichever way you look (drag to look round; it eases back).
  - The sound: a monks'-hum chord (D, D6/9, Bm7, Gmaj7, A), five voices
    of detuned saws through vowel formants and a long generated reverb
    (impulse 9 s); one voice glides at a time, 3.1 s apart, a new chord
    every 16 s, so nothing perceptibly changes for ~5 s (user: "a melody
    played over eternity", optimistic but low, haunting, forbidding).
  - The end: after the last line the body drifts into the sphere and is
    gone (one with it); the sound swells, the camera zooms in
    crescendoing, cut to black (silence), then the realities menu.
  - The page's corner buttons and points pill stay hidden (ec-hall-scene)
    from the hall's flare to the very end: only Stay in the den
    (hall.finish) or a world pick (the den disposed) brings them back.
  - Drag in the Room view (user: home from the closed store, in the den,
    the lower half's left/right was reversed until focus on and off):
    grabLatch now turns the Room view by the same screen-half rule as the
    board views (upper +, lower -); only the tilt stays reversed there.
    e2e-drag-latch expects that.
  - The dock piece in the corner mid-game: theme.dockCornerOpacity
    (standard.js 0.6; the chassis default stays 0.35) so it's seen in the
    dark den.

### Every reality: Standard Cabeza or Cabeza Nova; the switcher everywhere (2026-10-01)
  - User: the Lab's pages, Lluvia, Cromo (every reality) couldn't play the
    non-standard pieces, rules and boards. Answers: every reality, Nova's
    own three too; the same words everywhere, each drawn in its own look;
    only after the story; Lluvia keeps its descent, then the buttons.
  - themes/reality-gate.js. RealityGate (rendered by the chassis when a
    theme has `realityGate: { world, deferred?, when?, novaGo? }`, the
    story's over (localStorage el-cabeza:story .ended) and no game is
    under way; gone once one begins; GATE_EVENT / openRealityGate() opens
    it, e.g. a deferred one): two buttons, "Standard Cabeza" (begins the
    classic game at once: beginCustomGame(defaultSelections())) and
    "Cabeza Nova" (the sheet), and "Other realities". The sheet is one
    scrolling menu of everything Nova's places offer: who's playing
    (the chassis's own opponent/difficulty), pieces (counts, Arco size,
    the 10 cap, the fit check), rules (switches with their notes,
    Shoving's setting, lawWarnings, black holes' place), board (quick
    sizes, width, length, shuffled start, missing squares + pairs + a
    themed square picker). Reset and Play at the bottom (a bottom sheet
    on phones). Last choices kept in el-cabeza:nova-setup. A finished
    game's "change the rules" reopens the sheet (beginCustomGame's
    reopen). LOOKS: den, neon, store, lluvia, cromo, and the Lab's ten
    from their own CSS variables (--surface, --accent-primary, ...).
  - Wired: apps/cromo.jsx, lluvia.jsx (deferred: the overlay hands over
    at the city cue or "Straight to the board"; Custom rules and
    reopenCity open the sheet), lab.jsx (each direction lab-<id>),
    unified.jsx (den / store / neon, novaGo switching in place); neon,
    tienda and standard's own pages get just the corner button.
    realitiesCorner(world) = theme.cornerAction "Other realities" after
    the story. realities.js: currentId for "You are here", and Nova's
    places from another page open el-cabeza-nova.html?world=<place>
    (unified.jsx WORLD_PARAM, after the story only).
  - After the story Big Glutts is a reality ("the day you found it"):
    storeAfter() is false once ended (no clerk scene, no "never heard of
    it"), no box lid (STORE_STORY.realities), the gate instead.
  - Chassis test hook __EC_TEST_ARMED__ (a game under way). tests/
    e2e-gate.mjs walks it (Cromo, the sheet on a phone, before the story,
    the Lab, Lluvia's descent, Nova's three by ?world=).
  - Drag (user: still reversed on the lower half coming back from the
    realities): grabLatch now takes "upper/lower" from the turning axis
    (boardGroup's origin) projected through the live camera, not the
    screen's middle; an axis behind the camera = all far side. Whatever
    you grab follows the finger in every view (user: no preference).
  - The restart's caption ("Once more, from the top… shelf.") stays
    0.75 s longer: StoryCut's cut.linger (ms).

### Den draw calls, the clerk's page, the home order form (2026-10-01)
  - den-room.js Builder folds plain baked materials (MeshBasic, vertex
    colours, no map, opaque, nothing else of its own: foldKey) into one
    white vertex-colour material per group and settings: the colour is
    multiplied into the baked vertex colours at add(), so it looks the
    same (checked: block-averaged screenshots before/after match; only
    the spinning dock piece differs). 4-12 fewer draw calls per view
    (e.g. 133 -> 121); the rest are the table's, the console's and the
    set's own lit meshes. A plain material whose colour is changed at
    run time must NOT go through B.add (it would be folded): give it a
    map, or its own mesh (B.mesh).
  - The clerk paging the manager (ClerkScene, page step): louder (x2.6
    into the far bus) and the store music ducks to 40% under it
    (tienda-audio.js musicDuck); and it plays each time you come to that
    panel (paging back and forward again replays it; it was once only).
  - The special order at home (guided, before the trip to Big Glutts):
    anything on the form can be chosen now, rules and board too, the
    square picker, the 3-D views, the rules card from "How it works";
    only Cancel and Standard stay locked, and everything off the form.

### Trip leaving, the hall's second line, the Nova sheet's pictures, classic Moves (2026-10-01)
  - The trip (den-trip.js T.blackIn now [1500, 6400]): the fade starts
    1.5 s after the card goes (was 4.55 s) and takes ~5 s; meanwhile
    den-fx.js tripPull draws the camera back and up toward the Room view
    (radius to 118, phi to 0.78, smoothstep over 6.2 s), switching to
    the Room view (dollhouse) as it passes the room's walls so it isn't
    stopped by them; wherever it is at the black is where it stops
    (user). Home, the Room view as before.
  - The hall (den-hall.js): the first time "Oh no… now what?"; when it
    comes back after "just keep playing", "Oh, for the love of…" (user).
    Counted per page load (flares).
  - The Cabeza Nova sheet: each piece row has a picture of that piece as
    the reality draws it: the theme's own buildPieceVisual, lit as the
    dock piece, a three-quarter still, all thirteen (Arco's three sizes)
    in one short-lived WebGL context after the sheet slides up
    (reality-gate.js piecePictures; the chassis passes pieceLook). Sizes
    true to each other, the small ones brought up a little.
  - Rules cards in a standard game under way (no law on, the classic five
    only, no cut squares or holes: chassis standardGame) tell the classic
    game alone: the Moves card shows no law moves (user: Standard
    Cabeza never shows a move that doesn't apply), before it begins too
    (user). Opened on an extra on purpose (an order form's "How it works
    ›", a law on the slip: chassis EXTRA_FOCUS) the card shows them all,
    so the one asked for is there. A custom game's cards show everything.

### The hall: kept count, the third time, a real walk (2026-10-01)
  - The hall's count is kept with the story (story record hallFlares;
    novaTv.hall.flares {get,set}; cleared with the rest on Restart story),
    so a reload doesn't start it over: 1st "Oh no… now what?", 2nd "Oh,
    for the love of…", 3rd no words and no choice: dragged in (user),
    the walk at 1.7x, no steps (a tremble), straight on to the eruption
    and the void (walkClock).
  - The walk (user: the turn was stilted; walk, don't fly): one centripetal
    Catmull-Rom path (PATH) from wherever the camera is, down to standing
    eye height, across the floor, through the doorway and round to the
    right, walked at an even pace (eased off at the start and end, in
    WALK_END 10.2 s), looking a little ahead along the path (from the
    look it started with), turning onto the rift round the bend; a step's
    rise and sway (STRIDE), and footsteps (carpet, then the hall's boards
    with the odd creak). Then the calm, then the eruption, as before.

### The wormhole's sound on a phone (2026-10-01)
  - User (Android phone, the first arrival's summons): from the tap on
    the singularity's button through the fall to the sphere, no sound at
    all. Headless Chrome plays it all through (measured at the output,
    by band, phone mix and full), so not the graph's routing. The tap
    starts three long stereo reverbs at once (the toll's 11.5 s bell
    reverb, the Singularity hum's 6.5 s, the summons' last clap's 10 s)
    on top of the summons' own: offline, the reverbs went from 8% of a
    desktop core's real time to ~30%; a phone's audio thread can't keep
    that up beside the wormhole's GPU load, so its sound drops out.
  - Fix: on a touch-only device (hover: none, pointer: coarse; the same
    test as summonMixFor) every reverb is one channel and the long ones
    shorter (neon.js makeImpulse: min(d, 0.4d + 0.5): 11.5 -> 5.1, 6.5 ->
    3.1; neon-summon-audio.js: its room and thunder reverbs one channel,
    the last clap's tail 5.5 s mono, LAST_TAIL_PHONE_S). ~10% now, near
    the 8% before the tap. Desktops unchanged. A phone speaker is all but
    mono and doesn't play the long low tails anyway.
  - Not verifiable here (no real phone): if it still drops out, next
    suspects: the phone mix's 4x-oversampled shaper, and the collapse's
    GPU load starving the page.

### The commercial's sound: one recording (2026-10-02)
  - User (Android phone): the commercial's first five seconds silent,
    then garbled, then clearing. The score (den-ad-audio.js) was built at
    the moment it played: every note, hit and effect of ~48 s, a few
    thousand nodes at once, during Nova's transition back from the
    Singularity; a phone's audio thread couldn't keep up until the early
    ones had played out.
  - Now the score (compose) is rendered once, offline, voices mixed in,
    into assets/den/ad-soundtrack.mp3 (tools/den_ad_render.mjs: serves
    dist, renders in Chromium via window.__EC_AD_RENDER_SCORE__, ffmpeg
    128k), shipped as el-cabeza-den-ad.mp3. prepareCommercial() fetches
    and decodes it well ahead (Nova, whenever the commercial is still to
    come; den-audio.js again at play time if need be); playCommercial
    plays the one buffer from T - 0.05 (its lead-in), or, if it's late,
    from where it should be by then. From disk (tests), or if it can't be
    had, the score is built live as before. After changing the score:
    build, run the tool, build again.

### Home from the trip: the card (2026-10-02)
  - After the trip back to the closed Big Glutts, once the den's faded up
    (3.8 s after onReturn): a tap-to-dismiss card (den-fx.js homeCard,
    the den's 1970s card look, "Tap to play") with one of the user's ten
    lines at random, never the one shown last time (localStorage
    el-cabeza:home-line). The hall arms (counts its four moves) only once
    it's put away; the hall's "due" is still saved at the return, so a
    reload before the tap arms it without the card.

### The store's idle nudge; the lid without its card (2026-10-02)
  - First visit to the store (story start, not arrived by a cut, not
    after the story): once the lid's off, 30 s with the dock shut and
    nothing open over the table (looking round doesn't count) lights the
    dock's turning piece in the Singularity's blue (html.td-idle-nudge; a
    brightness/outline pulse on its canvas plus .td-dock-aura, a radial
    glow layer at z 14 that follows the mount by rAF, since the chassis
    clips the mount to the piece's outline for taps). Opened, "Try a
    Game" (tienda.js clones the begin button with .td-try-game,
    testid tienda-try-game; the phone bar's shell-begin too) breathes the
    same blue until a game begins. Opening the dock before the 30 s means
    no nudge. Once a story (idleNudgeDone, reset by resetLid). The chassis
    now hands useSetupExtras dockView (read only).
    window.__EC_TEST_NUDGE_MS__ shortens the wait (tests/e2e-store-nudge).
  - "There's a story here... if you're interested." is gone (user: not
    needed any more), StoryHint and its CSS with it.
  - Full screen on the lid (user, Android: couldn't maximize): the
    corner switch was under the lid's layer (z 1200); over the lid the
    corner controls now sit at 1250 with only the switch showing
    (STORY_CSS hides the others), and a stopped tap asks for full screen
    at its touchend/pointerup, since a touch stopped at touchstart never
    becomes a click.

### The den's cards: one style, askance, movable (2026-10-02)
  - User: the thought cloud ("Finally… now I can play a game in peace.")
    into the newer 1975 card style, and the cards askance, clear of
    what matters, movable. Asked: the card style (not the comic
    balloon), and only the cards (the car's and hallway's speech
    balloons stay as they are, cutscenes).
  - themes/den-cards.js dealCard(doc, {testid, l1, l2, hint, loud, side,
    onTap, role, label}) -> {el, remove(ms)}: cream card, the decade's
    stripes, Caprasimo, hard brown shadow; tilted 3deg in the upper right
    (top 17%, clear of the title, the call's slip, the dock and the
    variants flyout at top left); a drag moves it (kept a third on
    screen), a tap that hardly moved is onTap; its pointer events never
    reach the board.
  - Users: the thought (den-call.js, testid den-thought, the cloud SVG
    gone), "Free pieces?! Nice!…" (den-yay, loud), and the home-again
    card (den-fx.js, den-home-card): no dimmed backdrop over the screen
    any more; a tap on it or the first tap anywhere else (which still
    does what it was for) puts it away and arms the hall.

### After the commercial: back on the coffee table; a fainter full-screen switch (2026-10-02)
  - User: after the commercial the camera must always come back to the
    board on the coffee table, not too close, not too far. den-fx.js
    onTheBoard(): square on to the nearest side, the board's own pitch and
    distance (chassis three.current.boardView(): Current Player View's
    radius, the captured one or the same fit), target the board's centre,
    out of the Room view, view snapped too. Called while the set still
    has the camera: on the return from Singularity, when the set goes off
    after the commercial/pattern (offAt), and when it's switched off
    while watched. Tests: e2e-summon (the commercial) and e2e-story (the
    TV visit, which first turns the camera to the set) check the target
    is 0, the radius is boardView's, and the board's middle is on screen.
  - The full-screen switch (user: it stuck out): chassis opacity 0.22
    (0.12 in focus), hover still 0.8; over the store's lid and clerk
    0.28 (was 0.85); the den's focus dim 0.14 for it.

### Every Arco size its own row, in every menu (2026-10-02)
  - User: every Nova menu must offer all three arches, each in its own
    row (no size drop-down/switch), and every piece type must be there.
  - Shared model (rules-selections.js): PIECE_OPTIONS has arcoChico,
    arcoAlto, arcoAncho (each 0-4, with a size note) in place of arco +
    arcoSize; option key = engine type (pieceTypeOf is identity). An older
    save's counts.arco + arcoSize normalizes to that size's count.
    ARCO_SIZES kept for that reading. Any mix of sizes plays (the engine
    was always per type).
  - Menus: the reality gate's Cabeza Nova sheet (rows from PIECE_OPTIONS,
    the size Seg gone, the size as the row's note), Tienda's order form
    (CATALOG lines per size, 49 T 4407/4412/4413; the size switch gone),
    Lluvia's city (signs 弧/拱/橋), Neon's sphere MATTER (MATTER_ROSTER
    rows arcoChico/Alto/Ancho; matter.arcoSize gone, migrateRoster reads
    an old save; neon.js buildRosterFromSelections per type).
  - rules-selections smoke: every PIECE_META type is offered; a mix of
    all three sets out; an old save migrates. e2e-gate (13 pictures, the
    three rows), e2e-tienda, e2e-singularity updated.
  - Pictures for every piece, in every menu (user): the gate's sheet
    (13, themed), Tienda's order form (a wood photograph per line), Neon's
    MATTER (a 3D still per row) already had all three Arcos once they were
    rows; Lluvia's city MATTER showed only a sign, so its rows now carry
    the city's own picture of each piece (reality-gate.js piecePicture /
    piecePicturesReady, made from lluvia.js's buildPieceVisual, passed in
    as pieceLook), the sign in the corner. Tests check the pictures in
    each (e2e-gate 13, e2e-lluvia 13, e2e-tienda the three Arcos,
    e2e-singularity three different stills).

### The dock by the moment, in each theme's words; no "?" (2026-10-02)
  - User: the post-game panel was a cluttered relic; chose "by the
    moment", each theme with its own evocations.
  - Chassis: setup unchanged. In play: the status row, then one row: the
    camera views as a small segmented control (view-player, view-top,
    room-view; aria-pressed from viewMode), Focus beside them, End game
    as a quiet link at the end (testid end-game). After a game: a caption
    line (dock-caption: endedCaption / wonCaption), one big button
    (new-game, data-dock-role="primary"), quiet links: move-log, reset-rules
    (after a custom game), next-game ("Next game: You vs Medium AI ▾",
    unfolding the old opponent/difficulty row; nextOpen resets when the
    game state changes). Gone: Reset Game (New game covers it), the
    duplicate bottom row, the players read-out after a game (in play it
    stays). The panel is 560px wide in play and after.
  - Words: chassis DOCK_WORDS, theme.dockWords overrides (views, focus,
    endGame, newGame, moveLog, plainRules, nextGame, endedCaption,
    wonCaption); the phone bar's Move Log / New Game / End game use them
    too (ctl.words). Den "Set them up again" / "Call it a night" / "Score
    pad"; store "Set up the demo again" / "Put them down" / "Register
    tape" / "Please leave pieces on the board."; Neon "Reboot" /
    "Disconnect" / "Trace log" / "> session closed█"; Cromo "Set the
    stones" / "Lay down"; Lluvia "Another round" / "Walk away" / "Mưa vẫn
    rơi."; each Lab direction its own (specs.js words -> factory
    dockWords). Style: each theme's styleSheet dresses
    [data-dock-role="primary"|"caption"] (den: chocolate pill, Caprasimo;
    store: price-tag red; Neon: lit tube, prompt cursor; Cromo: polished
    chrome; Lluvia: pink neon, typewriter; Lab: accent + display face).
  - Tests find these by testid now (end-game, new-game, move-log), not
    wording; tests/e2e-dock-moments.mjs walks five themes through it.
  - The corner "?" (How to play) is gone everywhere (user: the masthead
    opens the same panel: a tap, then Info). theme.howToPlayCorner would
    bring it back; without it the corner icons sit in a row (noHowTo, as
    rulesInRoom did). The phone bar never had it (its menu has the rules).

### Lost in the Singularity (2026-10-02)
  - User: the story's first visit to the sphere, lingering, needs a way
    back: the Back button glowing and throbbing, and a neon wireframe
    card: the player's own hand turned to wireframe, pressing "I want out
    of here", astonished, not knowing where they are.
  - neon-singularity.js LostNudge: shown only in Nova (onSingularityBack)
    on the first visit (useSingularityPhase reads !singularitySeen() as the
    sphere opens, before marking it; singularityFirstVisit). After 25 s
    with no pointer/key/wheel (window.__EC_TEST_LOST_MS__ for tests):
    html.ec-lost-urge (Back: full opacity, ecLostThrob) and the card
    (.ec-lost, testid singularity-lost): "Wait… where am I?" / "My hand......!   Wha.........?!"
    (user's words) / "I can see straight through it…";
    the user's own wireframe hand (assets/neon/lost-hand-wire.webp, cut
    from their picture by tools/lost_hand.py: cropped, black to alpha,
    recoloured toward the sphere's cyan; lost-hand-skin.webp, the same
    hand as a skin-toned silhouette): a scan line sweeps the lines in
    while the skin flickers and falls away over them, the wrist fading
    out to the left; then it reaches and taps the button in a loop
    (.webp bundled as dataurl, build.js; tests/asset-hooks.mjs loads it
    in Node, so theme-neon.smoke now runs with the hooks); the button (singularity-lost-out) leaves as Back does. A tap
    elsewhere puts the card away (Back keeps throbbing); opening a
    category hides it. Once a visit. Checked in e2e-summon (9 s there).

### The revelation scene: rotatable, but light (2026-10-02)
  - User: the floating-body ending ran at a low frame rate when looked
    round; keep it rotatable if the frame rate can stay high.
  - Cause: the ending draws its own scene on its own canvas over
    everything, while the den underneath (the heaviest scene in the game)
    went on drawing every frame, unseen: two full renders a frame.
  - den-ending.js covering() (void/black/menu/going) + den-fx.js
    api.render, the chassis's existing "theme drew the frame" hook: the den
    isn't drawn while the ending covers it (comes back on "Stay in the
    den"). The ending's pointer events stop at its root (the den's
    page-wide listeners stay idle). Its own resolution: a phone starts at
    1.5x (not 2x), and if the frame-time average stays over ~24 ms for
    ~0.9 s it steps down 0.25 at a time to 1x. Drag-to-look kept.
  - e2e-ending: the den's renderer.info.render.frame doesn't move while
    the void shows; a drag still turns the look. state() has pixelRatio and
    look. Not measurable here on a real phone.

### Awake while playing; a pause before the realities (2026-10-02)
  - User: a Pixel 10 dimmed/timed out mid-game; keep it awake, but let a
    phone left on a table sleep after ~10 minutes with no touches.
  - chassis/ElCabeza3D.jsx: a Screen Wake Lock (navigator.wakeLock
    "screen") on every page, asked again on any pointerdown/keydown/wheel/
    touchstart and on coming back visible (the browser drops it when the
    page hides). 10 minutes with no input lets it go (the phone's own
    timeout then applies); the next touch takes it again. No API: nothing.
    window.__EC_TEST_WAKE_IDLE_MS__ shortens the idle; __EC_WAKE__() reads
    { held, idle }. tests/e2e-wake.mjs.
  - User: after the revelation, a player tapping away picked a random
    reality before reading the "story's over" words. realities.js
    createRealitiesMenu({ lockMs }): the choices dimmed and untappable, a
    hairline fills under the heading, clicks/Escape ignored, then live
    (data-locked true/false). den-ending.js passes 3500 ms
    (__EC_TEST_REALITIES_LOCK__ overrides); the gate and Lab menus pass none.
    Checked in e2e-ending.

### The view jumps glide; a link straight to the revelation (2026-10-02)
  - User: a two-finger flick up/down (Current Player View / Top-Down View)
    and their buttons moved the camera too abruptly. The render loop's
    damping (CAMERA_DAMPING 9: 1 - e^(-9t)) covers ~65% in the first
    0.12 s and the pan target snapped (snapToCenter).
  - chassis glideRef/glideCamera(): recenterView, topDownView and roomView
    arm a glide; the tick takes from/to on its next frame and eases with a
    cubic in-out over 0.9-1.6 s (longer for a half turn, a big tilt or
    zoom; 0.45 s with reduced motion), the pan coming home with it, a half
    turn lifting away ~6% on the way round. Any input that moves the goal
    meanwhile drops it (the damping goes on from where the view is).
    snapToCenter stays for the new-game reset. tests/e2e-camera-glide.mjs.
  - Nova ?scene=revelation (apps/unified.jsx takeRevelation, read once ->
    tv.preview): opens in the den, a black "The revelation / Tap to
    begin" (the tap starts the sound; full screen on a phone), then
    straight into den-ending's void. No hall; onFinish keeps nothing (the
    story stays where it was). Realities and Stay work as ever.

### The Singularity's first visit: something going wrong (2026-10-02)
  - User picked three of my ideas: A (the menu won't hold), B (a
    wireframe fingertip at each touch), D (a heartbeat and a ringing in the
    silence). The menus stay open to use (so they're known for menus).
  - LostNudge (neon-singularity.js), first visit in the story only:
    every pointerdown leaves .ec-tip (an SVG wireframe fingertip, tip at
    the touch, finger off to the lower right, fading; plainer each touch,
    flickering pink from the 4th; testid singularity-fingertip,
    data-strength). The unravelling comes at the first of: a menu open
    6 s (UNRAVEL_MS; __EC_TEST_UNRAVEL_MS__), 3 taps inside menus, 8
    touches in all, or the old 25 s idle. With a menu up: .ec-unravel on
    category-overlay (data-unravel="on"): flicker, tears (clip-path),
    chromatic text, rows drift (.ec-drift), its text nodes go to block
    glyphs over 2.3 s; then .ec-fold (a set switched off), the overlay
    closed (stage labels), then the hand card. No menu: straight to the
    card. Back throbs from the unravelling on.
  - themes/neon-unease.js createUnease(audio): through neon.js
    summonOutput (outside the master the event horizon zeroes; muted with
    the rest): lub-dub thumps (150 -> 52 Hz, lowpassed: a phone can carry
    them), quicker as it rises, and two sines at 5.18 kHz beating at 6 Hz.
    Level 0.08 at first, + 0.09 a touch + a little with time (to 0.72),
    0.85 as it comes apart, 1 with the card; stops (0.8 s) when the
    Singularity unmounts. __EC_UNEASE__() reads it.
  - e2e-summon's "on a computer" visit goes on into the sphere and checks
    it all (3 s unravel; __EC_TEST_OPEN_CATEGORY__(cat) opens a menu as a
    tap on its label would: the Nova sphere comes up north pole forward).
  - The hand, redone from the user's second picture
    (tools/lost-hand-source.png; tools/lost_hand.py): the wire recoloured
    to the sphere's cyan (480x297); a flesh hand modelled from its shape
    (silhouette with small holes filled, rounded by distance from the edge
    at a finger's and a palm's size, grooves where the wire's brightest
    outlines run so the fingers part, lit from the upper left, warm rim,
    faint knuckle folds) for the skin to flicker away from; and the index
    fingertip turned to point up (lost-tip-wire.webp), now the fingertip a
    touch leaves (replacing a drawn SVG). The card's hand box 170x105.

### The way into the wormhole: a wide swing, then a straight dive (2026-10-02)
  - User: the camera should swing out to the left more widely, then dive
    on a straighter path into the funnel's centre, the singularity a black
    dot that rapidly grows.
  - neon-singularity.js updateCollapseCamera: from wherever the camera
    was (captured per collapse, s.diveCam), the first 42% swings 1.3 rad
    round to the screen's left, out (+30%, bulging +25% mid-way) and up to
    ~78 degrees, banking into the turn; the look lags the swing (carried
    left with the camera) so the board slides across the frame, coming
    round to the dot at the top. Then a straight line down at the dot
    (ease-in k^2.1), rolling up to ~0.9 rad, to 1.12x its radius from its
    centre, where it fills the frame for the cut. Up is the world's up
    projected across the look (fine looking nearly straight down); the
    judder scales with the distance to the dot.
  - buildHorizon/horizonAt: an opaque black ball (DoubleSide: the near
    plane cuts into it at the end; fog off, which greyed it) with a thin
    additive ring sprite at its edge, sunk with the throat (0.9 of its
    depth) and swelling 0.3 -> 1.55. The board now folds, shrinks to
    nothing and drops into the ball by 75% of the way, so the dive's last
    stretch is at the dot alone.
  - Test-only window.__EC_TEST_COLLAPSE_U__ holds the collapse at a point
    (pictures of the way in).

### The pivot pieces together, and the warning that shows them (2026-10-02)
  - User: move the Codo down with the Rayo and Zeta so every pivot-capable
    piece is grouped; when the "only pivot pieces" warning shows, it
    flashes, then jumps to where they are and flashes them.
  - Order everywhere: ... 2x3 Block, Arco Chico, Alto, Ancho, Codo, Rayo,
    Zeta (rules-selections.js PIECE_OPTIONS, which Tienda's order form,
    the gate's sheet and Lluvia's MATTER read; Neon's MATTER_ROSTER;
    reality-gate's PICTURE_TYPES). PIVOT_CAPABLE is exported.
  - themes/pivot-guide.js: guideToPivots({ warnSel, rowSel, goTo }) - the
    warning flashes twice (.ec-guide-flash, 0.6 s each), then (goTo to the
    pieces panel where they're elsewhere: Lluvia, Neon) the middle row is
    scrolled to the centre and the three flash three times. Colour from
    --ec-guide on an ancestor (Tienda's rust default, Lluvia amber, Neon
    cyan). usePivotGuide(active, opts) for the React menus: runs when the
    warning comes up (not when a menu opens with it already there), stops
    if it goes; returns a replay. A tap on the warning replays it.
    Neon: showPivotPieces(s) from the law's toggle and the warning's tap;
    switches to MATTER only if still on LAWS with the warning standing.
  - tests/e2e-pivot-guide.mjs (Tienda, gate, Lluvia); e2e-singularity
    (Neon: flash, over to MATTER, the three last and lit).

### The closed Big Glutts: a slower look, three steps back, the getaway (2026-10-02)
  - User: at the closed store the pan should start 2 s later, go slower
    and all the way right; going back left it should tilt up a little and
    push back, as 2-3 steps backwards, then the protagonist heard running
    for the car and speeding away. Their recordings: footsteps on debris
    (assets/den/src/steps-on-debris.mp3), a car door opened and shut
    (car-door-open-close.mp3).
  - den-trip.js T: sweep [12200, 24800] (was 10200-20800), the picture's
    point cx 0.3 -> 1.0 (clamped: the far right edge). The old "rise" is
    now the steps: footfalls at 25600, 27400, 29200, each a third of the
    way back (left, up to cy 0.4, out to zoom 1) over [f-450, f+650],
    eased, with a small dip as the foot lands. say2 [30400, 34000]; the
    run [32700, 35600]: a quick turn to the right (+0.55 cx, +0.12 zoom),
    a canvas blur peaking mid-turn, bobbing at ~3 steps/s; blackOut
    [33100, 35500]; home 44000 (was 33300), fadeHome [44300, 47500].
    Wind runs on 2 s into the black.
  - tools/den_trip_escape.py -> assets/den/trip-escape.mp3 (dist
    el-cabeza-den-trip-escape.mp3), one track started at TRACK_AT 25500 so
    nothing drifts: three isolated crunches (source 10.11, 24.00, 34.07 s;
    0.92x, heavier) at 0.1/1.9/3.7 s; the run (source 116.95-119.55 +
    122.0-123.05, ~0.2 s a step, slowing) at 7.3; the door (handle, yanked
    open, slammed) at 10.9; the car (car-start-drive-away.mp3 3.9-7.4 and
    9.3-14.2 at 1.15x) from 12.6, the tyres peeling out at the pull-away
    (the user's burnout recording, assets/den/src/burnout.mp3, its 2-4 s
    faded in and out, the squeal breaking at the pull-away; was a made one),
    darker and gone by ~19.9. No track: the made driveAway in the black.
  - e2e-story: the getaway recording loaded; the steps 100 ms after the
    track and 1.8 s apart.

### "Two humans" in every opponent menu (2026-10-02)
  - User (on the gate's "Two players"): replace it, and the similar
    options in every menu, with "Two humans". Now: the gate's sheet,
    Tienda's order form (was "A friend"), Neon's sphere pill (was
    "Human"), the dock's opponent row (was "Human"; fits a 390 px phone),
    the phone menu's Opponent switch (was "Human"), the dock's "Next game:
    Two humans", Lluvia's readout "TWO HUMANS · PASS AND PLAY". The
    per-side readouts ("Dark: Human" vs "AI (Medium)") and the box
    lettering ("For 2 players", "TWO PLAYERS · ONE BOARD") are left: not
    menus. Tests now look for /^Two humans$/.

### A link to the closed Big Glutts scene alone (2026-10-02)
  - Nova ?scene=glutts (as ?scene=revelation; apps/unified.jsx
    SCENE_PARAM/takeScene -> tv.preview(), now "revelation" | "glutts" |
    null): opens in the den, "Back to Big Glutts / Tap to begin" (testid
    den-glutts-preview; the trip's recordings start loading then), and
    the trip starts at 8.3 s in (den-trip.js start({ from }): the black
    just before the car pulls in; what comes before is skipped, the rest
    of the sounds scheduled from there). Nothing's kept: no hall armed on
    the way home.

### Gate sheet: Computer plays Light in the right column (2026-10-02)
  - User: on a phone "Computer plays Light" wrapped to the left under
    "Two humans"; put it in the right column. reality-gate.js: the
    opponent Seg gets .rg-opp, a two-column grid (auto auto), the third
    button in column 2, so Dark and Light stack, same width, edges lined
    up (phone and laptop alike).

### Codebase audit (2026-10-02)
  - User asked for a full audit, then the justified fixes. Report:
    AUDIT.md (findings by severity, what's good and should stay, the
    debt, the plan). No critical issues.
  - Done: tests/run-e2e.mjs (the browser tests in one list, every one
    run, a pass/fail table; `npm run test:e2e` uses it; `node
    tests/run-e2e.mjs story den` for some); 8 tests that lived in tests/
    but never ran now registered (gate, ending, summon, den-return,
    drag-latch, journey, tv-lure, clerk; the clerk test's seed brought up
    to date with the special-order lock); e2e-gameplay given real checks
    and an exit code (it always exited 0); tests/story-save.smoke.mjs
    (the story's save record) in test:engine; CI runs test:engine before
    every deploy. novaStory.jsx saveStoreGone merges into the record
    (patchStory) instead of replacing it. Nova's hold-zone loop writes
    the zone's style only when the title moves (it wrote 4 styles a frame
    forever). Three dead exports removed (hasShowcase, specById,
    labSession). ARCHITECTURE.md's header corrected; README written.
  - Not done (see AUDIT.md): splitting chassis/ElCabeza3D.jsx (9.7k
    lines), documenting all 43 theme hooks, moving the chassis's
    reality-gate import behind a hook.
  - Then (user: "minify all the pages too"): build.js minifies every
    target and the worker (Nova 3.9 -> 2.5 MB, Standard 2.6 -> 1.5 MB,
    worker 56 -> 24 KB). Stale tests found on the way: e2e-original's
    Nova part and e2e-clerk needed the commercial-aired and
    special-order-noted seeds; sound-channels and wood-sounds looked for
    "begin" (the store's button reads Try a Game); e2e-nova-mobile's
    remembered-bar check now polls instead of a fixed 2.5 s pause.
  - Don't run browser tests side by side (two at once on this machine
    made e2e-lab and outside-dismiss miss their timings). A scratch copy
    of the project needs its tests' URL pointed at its own dist: they
    load file:///home/user/el-cabeza-project/dist/ by absolute path.

### The camera after the den's television (2026-10-02)
  - e2e-story's "re-centred on the coffee table" failed now and then
    (radius 21.87, target.y -1.02, against the board's own 19.84, 0).
    Logged it: coming back from Singularity remounts the chassis, so the
    setup fit (chassis, [awaitingBegin, shell] effect) starts over; its
    first try bails (the page still laying out), so it has no "fitted"
    to compare against; den-fx's onTheBoard then puts the camera on the
    board, and the next resize event (~0.3 s later) let the fit pull it
    off, since with nothing fitted yet nothing counted as "moved".
  - Fix: cam.current.placed. onTheBoard sets it; the fit's moved() reads
    it as moved; the fit clears it when it starts over (a fresh setup
    screen fits as before).

### Volume faders, the corner piece, the reality's name (2026-10-02)
  - User (Cromo phone screenshot, the dock's speaker circled): the speaker
    should always be a volume slider, all the way down mutes and shows the
    speaker with the X ("a quick way to... make a volume adjustment" when a
    world's tones are abrasive), and "make the slider vertical on all of
    them". chassis/VolumeFader.jsx: a native range input turned a quarter
    anticlockwise (so fill(), keyboard and screen readers still treat it as
    a slider, and every phone browser draws it the same), 0-100, a speaker
    glyph under it. The dock's speaker now always opens the popover (no
    plain mute toggle any more): one "Volume" fader for a theme with a
    single sound (Cromo, Lluvia, the Lab), else All sounds and each channel
    side by side like a mixing desk. The phone menu's Sound section is the
    same row of faders. Same testids (sound-all, sound-ch-*, shell-menu-
    sound*) and the same storage (el-cabeza:sound-master).
  - A single-sound theme's audio got setVolume: a gain after its
    compressor (cromo-audio.js; lluvia-city.js createScore's volume(), via
    lluvia-audio.js); the Lab's goes to setLabVolume. The saved level is
    applied on mount only if one was saved (the Lab keeps its own 0.8
    default otherwise).
  - The corner (minimized, rotating) dock piece: 12px further right and
    10px lower (user: "slightly more toward the bottom right corner"); 10px
    from the right edge, 8 from the bottom.
  - The info panel's This game tab starts with "Playing in <reality>"
    (user: always say which theme or reality is being played):
    theme.realityName, the names the Other realities menu uses (The Den,
    1975 · Neon · Big Glutts · Lluvia · Cromo · the Lab's spec names).

### Restart story in the realities menu (2026-10-02)
  - User (screenshot of the bottom of the realities menu, "Stay here"):
    "there should be a pill button... to restart story mode" at the very
    bottom. realities.js: a quieter "Restart story" pill under Stay here,
    on every realities menu (the ending, Nova's, every reality page's). A
    first tap asks ("Tap again to restart the story", 4 s), the second does
    it: in Nova, restartStory in place (onStoryRestart, registered by
    apps/unified.jsx; the menu has already asked, so no second dialog);
    from any other page, el-cabeza-nova.html?restart=story, which clears
    the story (owned, store gone, ended, the Singularity) before Nova
    decides where to open, and drops the parameter from the address.
    touch-action: manipulation on it, so a quick second tap isn't eaten by
    a double-tap zoom. e2e-ending checks it's last and that a tap asks.
  - Also: apps/lab.jsx's switch looks again for a step under way after its
    settle pause; e2e-wood-sounds polls for each Flaco step instead of a
    fixed 1.5 s (missed the second landing in the store under load).
    e2e-lab's "a switch during a step waits" still failed now and then (3
    of 7 runs, under load); its failure now prints the carried state.

### Cromo's sounds: metal, not bells (2026-10-02)
  - User: Cromo's sounds "sound too much like bells or chimes... metallic,
    but not so much reverb", and a bit quieter. cromo-audio.js: tungsten's
    four free-bar sine modes (ringing up to ~5 s) became a steel plate's
    seven close, uneven partials with 0.03-0.2 s decays plus a narrow-band
    noise scrape on contact; the room went from a bright 1.6 s at 0.28 to
    a darker 0.6 s at 0.12; every send cut to about a third; the sfx bus to
    0.7. Rendered offline (OfflineAudioContext, old vs new): a landing
    peaks ~4-5 dB lower and is down 40 dB in 0.5 s instead of 3; capture
    3.5 dB lower, 0.9 s instead of 4. The far "bowl" in the ambience and
    the About card's chord got the smaller room and sends too.

### Cromo: black squares behind back-row pieces (2026-10-02)
  - User (phone screenshot): black L/rectangle shapes behind pieces in the
    back row, against the background, on several pieces. Cause: the
    landing ring (cromo-fx.js spawnRipple) is a square plane around the
    piece drawn with plain AdditiveBlending and alpha 1.0. The page paints
    Cromo's dark gradient behind a TRANSPARENT canvas (renderer alpha:
    true), and AdditiveBlending adds the shader's alpha to the canvas's
    alpha too, so wherever that square hung off the board's edge it turned
    the canvas opaque black there. Over the board it was invisible (already
    opaque). Fix: ADD_LIGHT, a CustomBlending that adds colour (One, One)
    and leaves the canvas's alpha alone (Zero, One); the board sweeps use
    it too. Reproduced on a phone viewport (a piece set at row 9 col 9,
    stepped W): before, pure black just behind the back edge; after, the
    background's own grey.
  - Worth remembering anywhere a canvas is transparent: an additive
    effect that writes alpha will darken whatever the page shows behind.

### Store nudge: a look in the dock no longer cancels it; it grows (2026-10-02)
  - User: restarted the story, in the store tapped the piece once, went
    into the menu, back out, looked round more, and the piece never went
    blue (no prompt to try a game). Cause: tienda-overlay.js marked the
    nudge done for the story whenever the dock opened before the 30 s
    clock ran out. Now only a game begun ends it; the clock runs with the
    dock open or shut (paused only under an overlay: the lid, catalog...)
    and keeps what it had counted across pauses (idleSpent, reset by
    resetLid with the story).
  - And "the longer that goes on, the more that blue should pulse larger":
    once lit, --td-nudge-g grows 0 -> 1 over NUDGE_GROW_MS (90 s, eased):
    the aura behind the piece from 0.92x to ~1.9x the piece and its pulse
    reaching further, the piece's own halo and Try a Game's glow wider and
    brighter. aura.dataset.grow for tests (__EC_TEST_NUDGE_GROW_MS__).

### Singularity first visit: ring and heartbeat fade; no fingertips (2026-10-02)
  - User: after the wormhole, at the sphere, "the ringing needs more
    reverb, a slower frequency, and both it and the heartbeat need to fade
    out to silence after about three seconds"; and "I don't like the
    wireframe finger tap. We need to get rid of that."
  - neon-unease.js: the ring is two sines at 2640/2642.5 Hz (was
    5180/5186: lower, and beating at 2.5 Hz instead of 6), dry 0.35 plus a
    3.6 s dark convolver room at 1.6; stop() ramps the bus linearly to 0
    (reverb tail included). LostNudge starts it as the sphere comes up and
    stops it at 1.6 s over 1.4 s: silent at 3.0 s, and it no longer climbs
    with taps or time (set() after stop is a no-op).
  - The fingertip each touch drew (.ec-tip, TIP_HTML) is gone, with its
    image (assets/neon/lost-tip-wire.webp) and tools/lost_hand.py's lines
    making it. Touches still count toward the menu coming apart.
    e2e-summon checks no fingertip and that the sound stops by itself.

### ?scene=summons, and the gate's wording (2026-10-02)
  - User asked for a link straight to the summons and sphere scene. Nova's
    ?scene=summons (apps/unified.jsx SUMMONS_PARAM) opens in Neon as if just
    through the den's set the first time: the summons, then the sphere's
    first visit (ring and heartbeat, the menu coming apart, the hand).
    engine/journey.js journeyPreview(): the Singularity reads as never seen
    and seen/commercial-aired are kept in memory only, so nothing is saved
    (e2e-summon checks no journey key is written). The reality gate is left
    off for it (it covered the summons after a finished story).
  - Reality gate, Standard Cabeza: "...five pieces each, the standard 10x10
    board." (was "the usual board", user).

### Realities menu: a line for each Lab world (2026-10-02)
  - User: drop "From the Theme Lab." under the ten Lab worlds in the
    realities picker; a very brief one-liner on what each is instead.
    realities.js LAB: [id, name, line], e.g. Swiss Design "A rational grid,
    one red, nothing extra.", Corporate Swiss "A 1960s information system,
    consoles and all.", Minimal Mono "Black, white, and almost nothing else."

### Singularity first visit: Begin Game can't skip the hand (2026-10-02)
  - User (via ?scene=summons): made selections, triple-tapped to the
    summary, Begin Game, and was in a game; only the Back button throbbed,
    no hand, no "I want out of here". Cause: LostNudge's unravel only knew
    the category overlay; with the summary up it went straight to showCard,
    which marked the card shown but the card only renders at stage
    "labels", so it never appeared; and Begin Game still worked.
  - Now: the unravel takes the summary menu too (.ec-unravel generalized;
    .ec-centred keeps its translate(-50%,-50%) while it tears and folds),
    then back to the labels and the card; showCard always drops whatever
    menu is up first; the summary open 6 s comes apart like a category's;
    and on the first visit, until the hand's been shown, Begin Game is
    caught (capture listener) and brings the unravel on instead. After the
    hand, Begin Game works as before. e2e-summon covers it.

### The rules leaflet's paper scrolls with the words (2026-10-02)
  - User (Tienda rules leaflet, phone screenshot): the creasing and aging
    didn't move with the words; the text just scrolled behind them. All of
    it was painted on the fixed panel (info-overlay > div). Now the panel
    keeps only what a sheet sliding under the thumb would: the vertical
    middle fold and the browned edges (its ::after, an inset box-shadow
    now). The masthead (doesn't scroll) has its own fibres and stain. The
    scrolling body (info-body) carries the rest with background-attachment:
    local: fibres, stains, the letter fold's two creases across at its
    content's thirds and their crossings, so they move with the text; the
    back of the sheet showing through is info-body::before, positioned in
    the scrolled content.
  - Then (user): the hand card went away at any tap elsewhere; it must stay
    until "I want out of here" is pressed. The away-tap and stage-change
    dismissals are gone; a transparent shield (.ec-lost-shield, z 2140,
    under the card at 2150 and the Back button at 2200) swallows taps off
    it and makes the button pulse (.nudge). And the decaying menu wasn't
    seen: when the unravel came with no menu up (the idle clock, or touches
    on the bare sphere) it went straight to the card. Now a category menu
    opens by itself first (LAWS, MATTER or TOPOLOGIES), stays 1.4 s, and
    comes apart; then the card.

### The den's corner buttons ghost during the commercial (2026-10-02)
  - User (screenshot, the lamp and the house circled): these should be
    ghosted while the television's commercial plays. journey.js
    setCommercialOn now also toggles html.ec-commercial; standard.js ghosts
    room-view-corner, focus-corner (and action-corner) under it: opacity
    0.32, no shadow, pointer-events none. e2e-summon checks it on the way
    home from the sphere, and that they come back after.

### The summons link now plays the whole first trip; the clerk always takes a stamped order (2026-10-02)
  - User: filled out the order form, stamped "Take to store", landed in
    Tienda, and no clerk. Likely via ?scene=summons: the journey preview
    played the sphere as new, but the story's own record (a finished
    story) still applied, so the den offered the guided order (seen, store
    not gone) while the store's storeAfter() (owned, seen, NOT ended) was
    false and the clerk never came.
  - novaStory.jsx storyPreview(): the record reads as the first trip
    ({owned: true}, not ended, store still there), writes in memory only;
    called with journeyPreview() for ?scene=summons. The reality gate is
    off in all three of Nova's places for it (reality-gate.js reads the
    stored record itself). The special-order note's "seen" moved into
    journey.js (specialOrderNoted / markSpecialOrderNoted, preview-aware).
  - tienda-overlay.js: walking into the store with an order stamped at
    home (orderInHand) always brings the clerk, whatever the record says.
  - e2e-summon follows it through: home, the commercial, the note, the
    order, Take to store, the clerk, the handover; nothing saved.

### The sphere's ring trails off longer (2026-10-02)
  - User: the ring should trail off a little longer, slightly more reverb,
    "maybe another second and a half". neon-unease.js: the heartbeat on its
    own gain (beatG); stop(fadeS, ringTailS) fades the heartbeat over fadeS,
    the ring's tone over fadeS + 0.6 * ringTailS, and the bus (the room's
    tail with it) over the last 0.5 s. Room 3.6 -> 4.6 s, wet 1.6 -> 1.9.
    LostNudge: stop(1.4, 1.5) at 1.6 s: heartbeat gone at 3.0 s, the ring
    silent at 4.5 s (offline render confirms).
  - Then (user): get rid of the vibrato/"bouncing", more reverb so it
    trails off gradually, a straight line down, about a second longer. The
    bouncing was the two sines 2.5 Hz apart beating: now one steady sine.
    The room: smoothed noise with an exponential decay (RT60 ~2.6 s), dry
    0.62 / wet 2.3. stop(fadeS, ringS): the ring's tone slides
    exponentially (a straight line down in dB, ~9 dB/s) to -30 dB over
    ringS, then the bus lets go over 0.6 s. LostNudge stop(1.4, 3.4) at
    1.6 s: heartbeat gone at 3.0 s, the ring declining steadily to silence
    at about 5.2-5.6 s (offline render at 0.1 s steps: monotonic).

### "I want out of here" centred in its button (2026-10-02)
  - User (screenshot): the text ran out past the button's right edge. It
    was nowrap in a button narrower than the words on a phone. Now it
    wraps to two balanced lines, centred (text-wrap: balance), with a
    0.08em indent to offset the last letter's letter-spacing; measured at
    360/390 px: equal space each side to within 2 px.
  - Commercial, chess segment (user: "the word chess never shows up...
    bag on chess more... looks like you're just bagging on the pawn"):
    the old segment hid "CHESS?" the instant the stamp landed. Now a rook,
    the king and a pawn sit under a bigger "CHESS?" (46px serif) that
    stays up the whole segment; the stamp strikes a red bar through the
    word (strikeOut) and one ring covers the whole set; then the set runs
    off left (flee * 700 + flee^2 * 3000, gone inside the 0.4 s before
    the checkers cut). CUES timeline unchanged (voice clips are cued to
    it). The yellow two-line captions sit a little lower (0.855/0.95 H),
    shared with the checkers half.
  - Sphere's coming-apart menu (user: "too many taps or taps in the wrong
    places makes it go away too quickly... more resilient"): the
    unravelling panel is pointer-events: none, so a tap fell through to
    the category backdrop, whose pointerdown closes the menu, and the
    decay jumped straight to the card. LostNudge now holds touches
    (window capture: pointer/mouse/click swallowed) from the menu opening
    by itself, or starting to come apart, until the card is up. Back and
    the card itself still work. The menu that opens by itself is up 1.8 s
    (was 1.4) before it goes. e2e-summon: stray taps mid-decay don't
    shut it.
  - Hall, second time (user): the keep-playing button reads "I should
    probably call an electrician about that tomorrow. Let me just finish
    one game!" (den-hall.js KEEP_AGAIN, when flares > 1); the first time
    it's still "Just keep playing — this day's been weird enough already".
  - Nova ?scene=hall (as ?scene=revelation/glutts; den-fx.js preview
    "hall"): opens in the den, "The hallway / Tap to begin", then the
    hall flares at once. Its count is in memory only (previewFlares);
    after "keep playing" it's back 4 s later instead of 3 moves, so the
    second time ("Oh, for the love of…", the electrician line) and the
    third (pulled in, on to the void) can be seen. Nothing saved.
    tests/e2e-camera-glide.mjs.
  - The set messing up, with the user's recording (freesound "tv glitch
    6245", assets/den/src/tv-glitch-6245.mp3): a square-ish digital glitch
    clipped past full scale, with stretches held flat on a rail.
    tools/den_tv_glitch.py cuts the flat stretches (20 ms windows, std <
    0.01), highpasses 60 Hz, levels to -18 dBFS RMS (tanh under -1 dBFS)
    -> assets/den/tv-glitch.mp3 (5.7 s), served as
    el-cabeza-den-tv-glitch.mp3. den-audio.js tvHaunt fetches it on the
    first stir (not from file:, so the e2e tests hear the made sounds
    only) and mixes random slices (glitchSlice: length, rate bend, swell)
    into the made sounds through hauntBus (the set's speaker, panned, Room
    channel): flicker/pilot short ticks, thump, static, tune, voice tail,
    phantom swell, surge (bent up + a hit at the thump), blast (bent up
    into the white + a hit at it). Hooks __DEN_GLITCH__, __DEN_HAUNT__;
    checked over http (loaded, every kind plays, no errors).
  - Nova ?scene=lure (apps/unified.jsx LURE_PARAM; with ?scene=summons
    it's STORY_PREVIEW: journeyPreview + storyPreview, no reality gate):
    opens in the den as home before the Singularity, "The television /
    Tap to begin"; the tap sets the lure's clock so the set stirs 3 s
    later (not 25 s). Through the set: the summons and the sphere's first
    visit, all in memory only. tests/e2e-camera-glide.mjs.
  - The sphere's first visit, after the ring (user: the ring, about four
    seconds of silence, then this): the user's "industrial pulse drone
    27456" (Freesound; assets/neon/src). tools/neon_sphere_drone.py loops
    its steady part (0.5-25 s; it fades out after), the last 3 s
    equal-power crossfaded into the first, -16 dBFS RMS, a second of
    padding each side so loopStart 1.0 / loopEnd 22.5 sit on the loop's
    own sound (checked after mp3 decode: the two points match to 5e-4)
    -> assets/neon/sphere-drone.mp3, served beside Nova and Neon as
    el-cabeza-neon-sphere-drone.mp3. neon-unease.js createDrone (out
    summonOutput, like the ring): LostNudge starts it 9.6 s after the
    sphere comes up (the ring's gone by ~5.6 s), 2.5 s fade up, level
    0.5, looping until the visit's over (1.2 s fade). Not from file:
    (no fetch), so the e2e tests don't hear it; checked over http
    (scheduled at 9.6 s, stops ~2 s after Back as the sphere closes).
    Hook __EC_DRONE__.
  - Phone call dialogue 40% quieter (user): den-call.js VOICE_LEVEL 0.42
    -> 0.25 (measured offline through the line's chain: highpass, tanh
    crunch, lowpass; nearly linear there, 0.25 gives 0.605 of the old
    output RMS); the synthesized stand-in (babble) through a 0.6 gain.
    The line's own hiss and clicks, and the ringer, unchanged.
  - A game ending during the hall scene (user: the placard came up and
    wouldn't dismiss): the hall's transparent blocker (.den-hall-block,
    z 1330, up from the flare through the walk) sat over the placard's
    backdrop (z 1100), so no tap reached it. Now the placard's backdrop
    (chassis data-testid="victory-backdrop", data-open) is hidden under
    html.ec-hall-scene (den-hall.js CSS) and comes up once the scene's
    over (keep playing, or Stay after the void), dismissed as ever.
    e2e-ending: a win on the walk in, hidden; after Stay, shown and a tap
    outside puts it away.
  - Realities menu: no Stay pill (user: redundant, the den's already in
    the list). The "You are here" card is the way to stay (realities.js:
    a tap on it calls onStay, as Escape does); the ending's menu marks
    the den (currentId "den"). stayLabel gone from every caller; tests
    tap reality-den / reality-lab-bauhaus instead of realities-stay.
  - Stuck in Lluvia with no way back (user, after a preview link's void:
    ?scene=hall/lure/summons keep nothing, so the record's story wasn't
    over and Lluvia's corner button, which shows only after the story,
    wasn't there). realities.js goToWorld sets sessionStorage
    "el-cabeza:realities-visit" before changing page; reality-gate.js
    storyOver() reads it too, so a reality reached from the menu has the
    corner button (and the gate) for the rest of the tab's visit. Checked
    on Lluvia: no record, no flag: no button; with the flag: button, menu.
  - Tienda's house (Room view) button ghosted like the full-screen card
    under it (user): 0.22 (was 0.85), a hover/focus lifts it to 0.8;
    spent (in the Room view) 0.16, hover 0.45. tienda.js styleSheet. The
    den's house is unchanged.
  - e2e-tienda's leaflet "newsprint" check looked for the texture on the
    sheet itself; since the leaflet change (fd48858) it's on the masthead
    and the scrolling body, so the check looks there.
  - The den's set, on its way in (user): half a second after a press
    turns it on as the portal, a press on it (or the phone menu's Turn on
    the TV) can't call it off (den-fx.js portalAt, PORTAL_LOCK_MS 500;
    before that a second press still switches it off). e2e-summon: a
    press 0.8 s in, still going in.
  - The sphere's Back button: gone on the story's first visit (user; the
    hand's card is the way out there, and it always comes), and Escape
    held there too (LostNudge, window capture; a rules card or the piece
    viewer over it keeps its own Escape). Kept everywhere else, after
    checking what removing it outright would do: on the Neon page and on
    later visits in Nova it's the only way out of the sphere on a touch
    screen short of beginning a game (Escape is keyboard only, and in
    Nova goes to Neon's board, not home). The ec-lost-urge throb on Back
    went with it.
  - The rift and the void, round 2 (user: dolly-zoom the rip, spaghettify
    then a normal floating body, less rag doll, in awe, camera fixed,
    more ethereal and reverb, the pink slit read as a vagina):
    - den-hall.js RIFT_FRAG rewritten: the fabric (a fine grid, drawn in
      toward the tear and bent by noise) with thin jagged cracks (a ridge
      of fine fbm, in pieces, the seed jumping erratically), a cool halo;
      over it six portal slots, each opening for a moment in the shape of
      a piece seen front on (Cabeza square, Chato slab, Flaco/Turrito
      tower, Opa disc, Codo L, Rayo S, Zeta Z, Arco arch: SDFs),
      shuddering, a deep blue dark inside. Plane 22x30. Cool palette; the
      strobe tint, the flash and the white overlays (hall and ending veil)
      moved off violet/pink to cool blue-white.
    - Dolly zoom: DOLLY 12000-15800 ms of the walk clock; eye toward the
      rift by DOLLY_IN 0.62, the fov widened so distance * tan(fov/2)
      holds (capped 118); eruption now 3600 ms (ENDING_AT 16200), the
      white from 72% of it, the shake only from 62%. The fov is taken
      from the camera at the start and given back (restoreFov) when the
      scene ends (finish, dispose, or the camera's no longer the hall's).
      __DEN_HALL__().fov.
    - den-ending.js: spaghettified on arrival (RIM_VERT tidal stretch
      along the way to the sphere: x4.6 ahead, x2.3 behind, squeezed
      across, a waver; uStretch 1 -> 0 over 1.1-3.8 s) with the camera out
      to the side meanwhile (26 units, easing in behind by ~5 s) so the
      strand reads. Poses authored and blended: pulled (trailing), in awe
      (arms open, out and a little forward and down, soft elbows, palms
      out, legs loose together, head lifted), taken (arms wide, head
      back); a 7.2 s breath, one hand reaching slowly now and then; body
      rotation slow. No camera drag (look stays 0; touches swallowed).
      Reverb 13 s / decay 2.0, wet 1.15, dry 0.26; a shimmer (D6 and A6
      sines, each on its own 17-23 s swell, all wet, 0.0035); a faint aura
      sprite breathing round the figure.
    - e2e-ending: dolly widens the lens (42 -> 56 deg by then), the lens
      given back after, a drag doesn't move the void's camera.
  - ?scene= links after the story (user: the hallway link "doesn't
    work"): with the story over, the den opened with the reality gate
    (Standard / Nova) over it, and the scene's choice was stuck under it.
    apps/unified.jsx SCENE_LINK (any ?scene=: revelation, glutts, hall,
    lure, summons): no realityGate on any place. e2e-camera-glide: the
    hall link with the story over, no gate, the choice there.
  - The special-orders note over the hallway (user, on ?scene=hall): it
    shows after the Singularity until taken up or tapped away, and theirs
    never had been. engine/journey.js setSceneLink/isSceneLink: the den's
    one-scene links (revelation, glutts, hall; not summons or lure, which
    play the whole first trip and end with the note) set it, and
    tienda-overlay.js doesn't put the note up. And whenever the hall's
    scene is on (html.ec-hall-scene) the note's hidden (den-hall.js CSS),
    its guided tap-blocker stands down and a tap doesn't dismiss it.
    e2e-camera-glide: the hall link with the story over and the note
    never taken up: no note.
  - The realities menu at the end of the story (user: linger two seconds
    more so the words at the top are read; emphasise them, not gauche):
    den-ending.js lockMs 3500 -> 5500. realities.js, with lockMs: the
    menu's an "epilogue": no scrolling while held; the sub line split into
    its sentences, each a span arriving in turn (0.6 s, then evenly across
    the hold, the last ~1.7 s before it's live), fading up and rising a
    hair, 16.5 px, full white with a faint violet glow; after, it settles
    to 0.82. Reduced motion: all at once. e2e-ending: three sentences,
    live by 9 s.
  - The void, round 3 (user: the music's volume odd at the start, the
    notes less optimistic than first asked, way more reverb, fuller; the
    body morphing between the singularity's black and a wireframe, slowly
    all black; the singularity's plasma coming off the body more and more
    as they go in):
    - Sound (den-ending.js sound()): the odd start was the swell being
      re-aimed every frame (setTargetAtTime) on the same gain the fade-up
      was ramping; now two gains: `fade` (a whisper -34 dB at 0.6 s, then
      exponential to full at 7.2 s: even in loudness, sampled ~3 dB per
      0.5 s; down 2.5 s at the end) and `whole` (0.15, the swell's).
      Chords back to the first brief (optimistic, low, haunting) and
      brighter: over a held low D, Dmaj9, G/D, Dsus2, D, A/D (no minor);
      17 s each, voices 3.3 s apart, glide tc 1.9. Five detuned saws a
      voice (was 3), panned 0, -/+0.45, -/+0.7; a faint triangle octave
      over the top two; "oo" formants plus a little "aah" (700/1150 Hz);
      lowpass 900 (was 520); a D1 sub sine 0.05; reverb 16 s decay 1.6,
      wet 1.45 dry 0.2; the shimmer 0.004. state().level for tests.
    - Body: RIM_FRAG discards where 3D noise (drifting) > uSolid, a thin
      seam at the edge; a wireframe twin of every part (WIRE_FRAG,
      wireframe, additive, same uniforms so it stretches too, dim blue).
      uSolid 0.18 -> 1 over 2-19 s with a slow back-and-forth morph;
      uWire fades with it; the rim glow eases off as it goes solid.
    - Plasma: a 700-mote Points pool (WISP_VERT/FRAG, soft, additive),
      born at random vertices of the body, drifting out and up in a slow
      curl and a little toward the sphere, growing as they fade (2.2-4.2
      s); rate 3 + 55*grow (4-26 s) + 110*merge. state().solid/.wisps.
  - The end-of-story realities menu's coda (user's words, as written):
    the sub line now ends "...stay in the den, because..."; then over
    the choices (dimmed further, .coda-on, while it plays)
    "...no matter where you are, *El Cabeza* will always be with you..."
    rises toward you and grows (to 1.26x, -24vh, fading at the end; 5.8 s
    in, 4.4 s), and "It always has been." (8.4 s, 3.6 s) comes the same
    way and keeps coming, faster, to 3.8x and -125vh, off the top of the
    screen. realities.js createRealitiesMenu({ coda: [{ html, at, dur }],
    subMs }); den-ending lockMs 12200, subMs 5500. Reduced motion: still,
    fading in and out. e2e-ending checks the coda's words and unlock by 15 s.
  - Theme Lab read-out in play (user: it takes too much of the screen):
    themes/lab/hud.js LabHud, while playing (not set up, not over), goes
    to half size in the top left, 12 px in, 8 px under the lab bar,
    moved there over 0.75 s (no fading). A hover (mouse) or a tap brings
    it to full size there; it goes back on leave, a second tap, or 8 s
    after a tap. Done with the separate CSS translate and scale
    properties (compose with each direction's own transform, so the
    e2e-lab "ten HUD compositions" signature is unchanged), measured each
    time: scale set, rect read, translate = corner - rect; re-measured on
    resize, after the direction's own entrance animation (animationend),
    and at 1.1 s. data-compact = small / open / no. Pointer events on
    only while compact. e2e-lab (phone): small in the corner, a tap opens.
  - The void, round 4:
    - Plasma (user: it looked like snow or glitter; wanted diaphanous,
      nebulous, gauzy, gossamer, vaporous): veils not motes. 260 instanced
      camera-facing quads (InstancedBufferGeometry: iPos, iSize, iAlpha,
      iSeed, iAng; quads, not points, as points that big aren't drawn on
      every phone), each fbm mist in a wide soft falloff, stretched 1.7:1
      along its own slowly turning angle, with fine ridged-noise filaments;
      alpha up to 0.34, additive. Born on the body at 1.5 + 18*grow +
      30*merge a second, size 3-6.5 units swelling x2.6, drifting slowly
      out and up (0.8-2 u/s, gentle curl), 5-8.5 s each.
    - Sound (user: it clipped on a phone; mix in their evolving drone pad
      from its 2-minute mark, the higher heavenly part, keeping the low
      evolving hum): tools/den_void_pad.py cuts 2:00-3:50 of
      assets/den/src/evolving-drone-pad-51339.mp3 (5 s in, 8 s out,
      -20 dBFS RMS, soft-held under -3) -> assets/den/void-pad.mp3, served
      as el-cabeza-den-void-pad.mp3. Fetched (not from file:), it fades up
      from 2 s over 9 s to PAD_LEVEL 1.1, a 0.25 send to the room, and
      swells with the end. The way out: hum (whole) + pad -> mix -> fade ->
      on a phone ((hover: none) and (pointer: coarse)) a 4th-order 120 Hz
      highpass and no 37 Hz sub -> limiter (DynamicsCompressor -12 dB,
      ratio 20, 3 ms) -> post -> ear. Measured over http at ~15 s: desktop
      out peak -5.6 dBFS / RMS -17.3 (hum -23.4, pad -25.7); phone peak
      -4.2 / RMS -16.4 (hum -25.1, pad -26.1). Hooks: ending.meter(),
      window.__DEN_ENDING_METER__ (with __EC_TEST_HOOKS__).
    - Revelation lines come in as said (user: more dramatic, not gauche):
      reveal() in themes/den-ending.js splits each REVELATION line into
      <span class="ph"> per word and per dot (spaces plain, *em*/**strong**
      wrapping the spans), each with a --d delay: 80 ms a word, 55 ms a dot
      (150 a "…"), +240 after a run of dots, +320 after "! ", +200 after
      ", "; scaled so the last starts by 2 s (REVEAL_SPAN). Each span
      condenses out of blur/glow (den-ending-ph, 1.5 s; dots 1.1 s), and a
      faint radial light swells behind the line (.word::before). The
      animations sit under .word.on, so they replay each time a line shows;
      the line itself fades in over 0.25 s and out over 1.3 s. Off under
      prefers-reduced-motion. With each line, bloom(): A5, E6, A6 sines
      (an open fifth, consonant with every chord), staggered 0.16 s, 0.7 s
      up and 5 s down, into the reverb plus a little dry.
    - The end of the story's words are a crawl now (user: the coda's
      fly-off was too fast at the end, and went off at 45 degrees; like
      the opening of Star Wars instead, neon blue, on the black). After
      the zoom into the sphere and the black, CRAWL = [BLACK[1] + 1500,
      +34 s]: CRAWL_TEXT ("The story's over." / "Every version of the
      game is here. Pick one, or stay in the den, because..." / "...no
      matter where you are, *El Cabeza* will always be with you..." /
      "It always has been.", that last centered after a gap) on a plane
      tilted 24 deg (perspective 300px, origin 50% 0), #6fd6ff with a blue
      glow, justified, an even pace (translateY -p * (H + 0.8 vh), from
      frame() so the test skip works), dissolving into the dark through a
      top mask. No skipping (user). MENU_AT = CRAWL[1] + 700: the switcher
      then quiet, title and cards only (sub "" leaves out the line),
      locked 2.2 s against taps made during the crawl. The realities
      menu's epilogue (sentence-by-sentence sub), coda and subMs are gone.
      Hooks: state().crawlAt, state().crawl (0..1); testid
      den-ending-crawl. Nothing is rendered under the black.
    - "It never was!!" is its own revelation line now (user), split from
      "…it's **not** 42!": eight lines, the scene 4.7 s longer (one more
      wordEach; MERGE/ZOOM/BLACK/CRAWL/MENU_AT follow WORDS_END).
    - The void's body is one seamless skinned mesh (user: the overlapping
      joints looked like a wooden doll; seamless, smooth joints, still
      alive). figRig(): the same jointed groups pose() moves (j/k per limb,
      headG), set to a rest pose (arms out 0.8/-0.6, legs 0.1/-1,
      straight), and the parts as distance functions (ellipsoids for hips,
      waist, chest, shoulders, head, hands, feet; tapering cones for neck
      and limbs), smooth-unioned (polynomial smin, per-part blend), each
      with a box so far points skip it. skinData() (a generator): surface
      nets on a 0.17 grid, vertices settled onto the surface (2 Newton
      steps), normals from the field, up to 3 bone weights each
      (exp(-(d/0.32)^2) by distance to each bone's own parts). ~14.5k verts,
      ~29k tris; ~0.4 s to make on a desktop, so it's made once (FIG_DATA)
      and ahead: den-fx calls prewarmFigure() when the hall's choice is up,
      which steps the generator ~6 ms at a time. skin(): CPU linear-blend
      skinning each frame (~1.4 ms). The wireframe is no longer GL
      wireframe: WIRE_FRAG draws ~1 px lines (fwidth) where the rest-pose
      position (attribute `rest`, varying vR) crosses planes every
      0.67/0.48/0.67 units, so the lattice rides the skin.
    - The store's TVs show a live newscast (user: activity, a CRT glow, a
      chyron with ~30 bizarre mid-70s headlines). tienda-textures.js
      paintTv(): tvPicture() draws 7 s shots (every 4th the story's own
      card, a slow push in on its icon; otherwise the anchor: talking
      mouth in phrases, blinks, head turns, papers shuffled, the story's
      icon over his shoulder; TV_STORIES 10 with drawn icons), the bar
      ("NEWS AT 7:30" + the story) and a crawl of TV_CRAWL (32 headlines,
      1974-76 events with a spin, the last two foreshadowing the board and
      the hallway lights), widths re-measured every 3 s for the late font;
      then the tube: vertical hold slips every 41 s (0.5 s roll), the
      picture's own glow (an 1/8 copy added back, "lighter"), scan lines,
      snow, rolling band, vignette. tienda-store.js: canvas 320x240 (mid,
      high) / 192x144 (low), repainted every 70 / 220 ms; an additive
      radial glow plane (0x8fb8ff, ~0.4, breathing) just in front of each
      of the five screens, spilling onto the cabinets.
    - The crawl can be let go (user): touches do nothing until its last
      line ("It always has been.") has its middle above the screen's
      (getBoundingClientRect of p.last each frame; crawlTap, the crawl's
      data-dismissable); then a touch fades it over CRAWL_FADE 2.75 s
      (frame-timed, from lastS) and opens the switcher. Measured: a touch
      will do from ~23 s in on a desktop (0.69), ~20 s on a phone (0.58).
      Hooks: state().crawlTap / crawlFade.
    - The trip to the closed Big Glutts (den-trip.js, user: too tight on
      the building; slow at first over the left and middle, the entrance,
      then quicker right; the warp too pronounced; pull right out as they
      step back; the steps too loud; the car sooner):
      zoom in to 1.22 (wide) / 1.08 (tall) only, over the first 40% of the
      sweep; cx = 0.24 + 0.6 * u^2.3 (slow on the left and middle, quick
      to the right at the end). The warp's bands at 0.3 of what they were,
      and slower. The step back: half a steady pull from the morph to past
      the last step, half the three steps; out to 0.8 (wide) / 0.62 (tall)
      of "cover", so the picture is smaller than the screen: above and
      below it, its own edge rows from a 96 px soft copy, stretched on out
      and darkening (the sky and lot carrying on), the seam eased.
      Timeline: say2 29.9-32.9 s, run 31.6-34.2, blackOut 31.9-33.9, home
      40.8, fadeHome 41.1-44.3 (was 44-47.5). tools/den_trip_escape.py:
      the backward steps soft and quiet (lowpassed 2.2 kHz, 30 ms in,
      -32 dB, was -21), the run shorter (6.2-8.8 s, -22 dB), the door at
      8.7, a shorter crank (START from 4.6 s), the car at 9.95 (was 12.6):
      started and away ~2.7 s sooner. Track 16.7 s.
    - The last revelation line ("....It was.....*always*...... El Cabeza.")
      comes with the drift into the sphere (user): LAST_AT = T.words + 7 *
      wordEach (40.9 s); MERGE = [LAST_AT + 0.9 s, +9.4 s]; T.lastHold set
      so the line stays till 2.6 s before the merge ends (ZOOM/BLACK/CRAWL
      follow MERGE, the whole ~6.6 s shorter). The lines a little larger:
      clamp(25px, 5.3vw, 44px) (was 22/4.6vw/38), width min(92vw, 880px).
    - The revelation's music is the user's "Completion" (user: new audio
      for the scene, more long-tail reverb; and under the crawl something
      like it, much more toned down, not changing, almost a vibration).
      Source assets/den/src/completion.mp3 (179.6 s, A / F#m: Dmaj7 0-15,
      E 16-25, Bm 26-39, D 40-47, F#m 48-55, A/E 56-63, C#m 64-75 ...).
      tools/den_void_music.py: void-music.mp3 = its first 56.1 s (eased
      out 54.6-56.6) through a made room (stereo noise, RT ~8 s lows / 4.5
      s highs, 40 ms pre-delay, wet -5 dB), ringing 9 s on: 65 s, -17 dB
      RMS; crawl-drone.mp3 = the A/E chord (56.5-62.5 s) frozen (its mean
      spectrum, random phases per frame), lowpassed 1.4 kHz, the room,
      24 s, end crossfaded into start, -20 dB RMS. The scene was
      stretched a hair to fit: wordEach 5000 (was 4700), so BLACK[1] =
      56.1 s, on the change. den-ending.js: the synthesized chord, pad
      and shimmer are gone (void-pad.mp3 dropped from the build; the
      tool and its source kept). sound(): mix -> fade -> (phone: 2x
      100 Hz highpass) -> limiter -> post -> ear; the music buffer
      (fetched ahead by prefetchVoidMusic with prewarmFigure, while the
      hall's choice is up) started at the scene's own offset; blooms into
      a 7 s room. drone(on, secs): at the black up over 6 s to
      DRONE_LEVEL 0.75 with a 0.07 Hz swell (+-22%) and a 6.3 Hz shiver
      (+-5%), looped past the encoder's silences; down over 4 s at the
      switcher (or with the crawl's 2.75 s tap fade). From disk (file:):
      plain <audio> for both. Measured over http: music out peak ~-5,
      RMS ~-17 dB (desk and phone); the drone at 0.42 was ~-34 RMS, now
      ~5 dB up. Hooks: state().music/drone; meter() {out, music, drone}.
    - The crawl centered (user; text-wrap: balance), a little slower
      (CRAWL 40 s, was 34: a touch will do from ~28 s in on a desktop),
      and its drone quieter and lower: DRONE_LEVEL 0.45 (was 0.75),
      played a fourth down (DRONE_RATE 0.7492, A to E; the <audio>
      fallback with preservesPitch off).
    - A hint of the void's gauze on the crawl's letters (user: very
      slight): .mist, a ghost of the words inside .text (aria-hidden, the
      same markup so it wraps the same), transparent text with only a glow
      (three soft text-shadows, the furthest -0.6em up), opacity 0.55,
      seen through a mask of soft tiling noise (mistNoise(): value noise
      on a wrapped lattice, 3 octaves, 128x256, made once as a data URL,
      sized 240x480) whose position drifts up 16 px/s and sways 40 px
      (set every other frame from frame()). Off under reduced motion.
    - Easy / Medium / Hard always on one row with the Back arrow (user: a
      second row looks dumb). Chassis dock row (data-testid opponent-row):
      a layout effect fits it, measured as laid out, step by step until
      nothing has wrapped (data-fit 0-4): 1 the buttons' side padding 5px
      and tracking 0.02em; 2 the "Difficulty" word hidden; 3 / 4 the
      buttons' text at 0.88 / 0.78. Set on the elements with !important
      (Lab's designs force letter-spacing !important). Again on width
      changes (ResizeObserver) and when the fonts are in. Checked: all 10
      Lab designs at 390 px one row (levels 0-1), 320 px level 2. Tienda's
      order form: the skill buttons a nowrap row sharing the width
      (.td-seg.td-one). The phone menu's Seg was already one row; Neon's
      sphere menu row has no wrap.
    - Lab HUD numbers (user: what do Dark / Light / Taken even mean?
      They were pieces left on the board per side and pieces each side
      had taken): now the theme's name (a row of its own, .wide, across
      any design's grid) and the AI's level ("Easy" / "Medium" / "Hard",
      "Off" for two humans; the chassis hands game.aiDifficulty and
      game.aiLevel to themes), with Moves, Points, Time. On a phone no
      stat cell is narrower than its words (min-width: max-content);
      Elementarism's numbers 17 px there. Checked all 10 at 390 px.
    - The crawl smooth (user: jittery): it had been moved from script each
      frame, with a layout read (the last line's rect) every frame and the
      mist's mask moved every other frame (a repaint of blurred glow). Now
      the move is one Web Animation (translateY 0 -> -(H + 0.8 vh), linear,
      40 s) the compositor runs, its currentTime only reset if the scene's
      clock has moved more than 150 ms from it (the test skip); the fade in
      (0.9 s) and the tap's fade out (2.75 s) are Web Animations too; the
      last line looked at 4 times a second. The mist: the mask on a
      wrapper (.mist-wrap, 480 px taller) that drifts up one tile in 30 s
      and sways, the ghost inside counter-moving, both CSS animations on
      transform. Measured: 25 px/s, no variation frame to frame.
    - Audio tails (user: after the tap, it cut out too fast; the reverb
      has to decay completely, into the switcher): drone(false, secs) is
      an exponential decay (setTargetAtTime, ~60 dB in secs): 13 s from
      the tap, 11 s at the crawl's natural end; sound(false) (leaving) a
      ~5 s tail (tau 0.75 s), sources stopped after 6.5 s.
    - "Chosen" reads like "on" (user: in a theme where anything on is
      pink, the chosen buttons were black). The Cabeza Nova sheet
      (reality-gate.js): .rg-seg's pressed buttons in --rg-accent /
      --rg-accent-ink, like its switches and Play, in every look. The
      chassis dock: toggleButtonStyle takes COLORS.selected /
      selectedInk if a theme gives them (else charcoal / cream as
      before); the Lab's factory gives its accentPrimary, with the text
      whichever of its surface and ink reads better on it (WCAG
      contrast). The phone menu's Seg and Toggle already share one
      colour (ink); Tienda's form is all ink, as its paper is.
    - Shopping in the story's store (user: "Your order: standard /
      Standard rules. Nothing changed." tipped the hand: the player
      doesn't know there's anything beyond the standard game yet; picked
      ideas 1, 4, 5, 8). themes/tienda-shopping.js, mounted by
      renderExtraOverlays over whatever else is up, in the store before
      it's bought (not after the story / as a reality):
      - the price tag (in a game, top left, instead of the order slip):
        "El Cabeza $7.97", unfolds into the shelf ticket (Games Dept.,
        Aisle 9) with "Put one in the cart"; testids tienda-price-tag /
        -paper / -cart;
      - the cart (module-level CART, emptied each visit by
        useShoppingVisit): once one's in, the corner shows "Cart · 1 item"
        with "Check out · $7.97" (tienda-cart, tienda-cart-checkout ->
        story.onPurchase); the dock's buy button (story-purchase, now
        CartButton in tienda.js) says "Put one in the cart · $7.97", then
        "Check out · $7.97"; the phone bar's likewise (label read when
        built, the press does the right thing either way);
      - the PA, first visit only (shopPA = nudgeHere): 4 moves into a
        game or 75 s after arriving (window.__EC_TEST_PA_MS__), the chime
        and voice (audio.playPage, the music ducked) and its words as a
        comic-lettered caption (tienda-pa-instock): El Cabeza in stock,
        Games Department, Aisle 9, Register 3 open; a tap puts one in the
        cart. Closing time 120 s later (__EC_TEST_CLOSING_MS__), or when a
        game ends at least 35 s after (__EC_TEST_CLOSING_MIN_MS__): the
        lights down a step (a fixed multiply layer, two flickers then
        0.34, kept till the visit's over) and the PA (tienda-pa-closing):
        closing in ten minutes, final purchases to the front; a tap checks
        out. The tag folds away when the PA speaks. Hook:
        window.__TIENDA_SHOP__() {cart, said, dim}.
      The catalog's own "Purchase and bring home", the clerk's offer
      after a game and the phone menu's item are left as they were.
      e2e-store-nudge: a shopping section; e2e-story follows the cart.
      (e2e-store-nudge failed once with no FAIL line printed, then passed
      twice: timing-sensitive somewhere.)
    - The blooms are gone (user, after listening to them isolated: they
      were the ringing): bloom(), its call, its little room and impulse()
      removed. The reverb baked into "Completion" (void-music.mp3) stays.
      The listening previews (el-cabeza-preview-*.mp3) were taken off the
      site again. Timings now: the white 0 s; lines from 8 s, every 5 s,
      the last at 43 s; the drift in 43.9-53.3 s; the push in 50.1-55.9 s;
      the black 55.2-56.1 s; the crawl 57.6-97.6 s (a touch may let it go
      from ~23 s into it on a desktop, ~20 s on a phone); the switcher at
      98.3 s. The music: "Completion" 0-56.1 s (eased out 54.6-56.6 s),
      its added room ringing to ~65 s; the drone from 56.1 s.
    - Neo-Brutalism's move thunk (Lab, themes/lab/audio.js land(): the
      250 Hz falling pop and the 90 Hz body): 60% lower (0.2 -> 0.08,
      0.1 -> 0.04, user) and sent (0.8) into a small room: room(), one
      convolver for the page, a 0.5 s stereo noise impulse decaying
      exp(-6.9 r)(1 - r) (60 dB over its length), out at 4 (its tail ~10
      dB under the thunk). tone() takes `verb` (a send level); the voice
      is let go as before, the room's tail rings on and dies by itself
      (rendered: -94 dB by 0.4 s, silent from 0.6 s).
    - A stronger pull at the start of the void (user: the body needed more
      movement; chose the struggle as they're yanked away): pose() takes
      `st` (1 - smooth((s - 0.9 s) / 6.6 s)): each arm's trailing aim
      flails (two sines a limb, ~1-1.5 Hz, uneven), elbows and knees work,
      the legs kick, the head jerks about; all of it fading into the awe
      pose by ~7.5 s. The whole body turns slowly as it's dragged: a roll
      of 3.4 rad easing to rest by 7.2 s (and a little of it in yaw), and
      a tumble in pitch (0.5 rad at 1.4 rad/s) gone by 6 s.
    - Hands on the head in astonishment as "....my...... god......!"
      begins (user): handsOnHead(f, g, t), from pose() with `g` =
      smooth((s - (T.words - 0.7 s)) / 1.1 s) * (1 - smooth((s - (T.words
      + 3.9 s)) / 1.6 s)): up from 7.3 s, on by 8.4 s, held through the
      line, down by ~13.4 s. Two-bone IK per arm (upper 3.9, forearm to
      the hand's middle 4.15) from the shoulder to a spot on top of the
      head near its front (headG-local (±0.62, 2.62, 0.72), breathing a
      little), the elbow's pole out to the side and a little forward; the
      forearm turned about itself so the palm (the hand's local z) faces
      down; slerped over the pose by g. The head a little down and still
      under the hands meanwhile.
    - Reaching for the sphere on "It's El Cabeza" (user): reachToSphere(f,
      g, to, t), after pose(): `to` the sphere in the body's own frame
      (worldToLocal); each arm aimed at it plus a wide V up and out
      (x ±0.75, y +0.6, so it reads from behind them, dark arms straight
      into the dark sphere vanished), elbows near straight, palms
      forward, a slow uneven yearning; the head lifted. g =
      smooth((s - (38 s - 0.4)) / 1.5 s) * (1 - smooth((s - 43.3 s) /
      2.2 s)): up through the line, into the drift as the last comes.
    - At the switcher, the crawl's sound (the drone or its dying tail)
      fades evenly to nothing in 3 s (user): droneGone(3), a linear ramp
      to 0 (the <audio> fallback likewise). Measured: -31 dB at the
      switcher, -49 at 2.6 s, silent from 3 s.
    - Less smoke on the body; a shimmering neon-blue event horizon
      framing it tightly (user): an edge shell per body mesh, the same
      skinned geometry drawn again BackSide, pushed out along the normal
      (RIM_VERT uInflate 0.16), additive, renderOrder 2, with EDGE_FRAG:
      Fresnel-weighted blue to ice blue, moving noise shimmer and a
      faint 11 Hz flicker, uEdge 1.15. It reads as a crisp thin outline
      around the silhouette. Wisps: alpha 0.34 -> 0.2, and each is
      hidden until it has drifted off the body (smooth((u-0.12)/0.3)).
    - Round (user): the outline thins away into the sphere: uEdge =
      1.15 * (1 - m)^1.6 (edgeMat kept in scene.userData).
    - Fingers and longer feet (user): each hand is a palm, four fingers
      (cones, a little apart, curled toward the palm, the palm's side is
      the hand's +z) and a thumb on the outer side, all on the forearm's
      bone; feet 1.25 -> 1.5 long (centre z 0.5 -> 0.72). The rest pose
      now has the arms straight out (a T), so the hands lie along the
      grid; the grid (skinData) is a tensor grid: columns and rows 0.06
      apart through the hands (HAND boxes + 0.25), 0.17 elsewhere, z
      unchanged, its extent from the parts' boxes (the old fixed box
      clipped the fingertips). 14.5k -> 20.1k vertices; skinning ~1.1 ->
      1.4 ms a frame (node, desktop); built in ~0.75 s, prewarmed as before
      (yields every 32 rows).
    - The crawl's sound fades to nothing in 4 s at the switcher (user,
      was 3): droneGone(4).
    - More drift early, somersaulting while righting themselves (user):
      driftAt(v, ms), a wide wander (12/5/6 units) from ~3 s, gone by
      ~32 s; the camera's position follows where the drift was 2.2 s
      before (deterministic, skip-safe) but it aims at where they really
      are, and more at them than the sphere while drifting (the aim's
      pull toward the sphere * (1 - 0.65 * early)), so they stay in frame.
      Two forward somersaults (flip = 4 pi (1 - (1 - u)^2.4), u over
      1.5..17 s, slowing), then caught a few times (a damped wobble).
      Arms out wide, paddling for balance (bal, 2.6..~19 s; the hands on
      the head still win on "my god").
    - Legs (user: not dangling; used to walking, realizing they're
      weightless): `walk` strides (1.45 s a step, the knee lifting on the
      swing) from ~2 s, fading out by ~20 s, a few reflex steps again at
      23..27 s; otherwise the resting float of a body in no gravity: hips
      ~0.62 rad forward, knees ~0.95 bent, each drifting on its own time.
    - The figure can be turned by a drag (user: gently; until the drift
      in): turnBy() spins it about the screen's own axes (0.0045 rad/px),
      it carries on after letting go (velocity decays e^-1.1t, capped 2.4
      rad/s) and eases back to its own float (slerp to identity, e^-0.3t),
      faded out over 2.5 s from the drift in. One quaternion premultiplied
      onto the body; nothing more drawn. State: turn (rad), edge.
    - Longer fingers and feet still (user): fingers 1.06/1.2/1.12/0.88
      (index..little; were 0.74/0.84/0.78/0.6), tips a little wider and
      more curled, blend 0.07 -> 0.1 (fewer specks between them at the
      knuckles); thumb longer; feet 1.5 -> 1.85 long (centre z 0.98).
      20.9k vertices.
    - Emanations back (user: why none any more? The last round had made
      them nearly invisible against the bright ring): alpha 0.2 -> 0.38,
      faded in over u 0.05..0.25 of their life (so still not over the
      body as they leave it), thrown off faster (speed 1.5..3 * scale,
      was 0.8..2), more of them sooner (rate 3 + 24 * grow, grow over
      3..21 s). (Captures taken just after a time skip undercount them:
      the pool fills in real time; let it run ~8 s before judging.)
    - Narrower hips, a little wider chest (user): hips 2.25 -> 1.9 wide,
      waist 2.15 -> 2.0, chest 2.75 -> 3.0, shoulders 2.1 -> 2.3; the
      shoulder joints out to x 2.72 (were 2.55), the hips' in to 1.02
      (were 1.15).
    - Chest too large, and a little more angular (user: too much
      roundness): rbox(inv, c, h, r, taper), a rounded box (taper widens
      it toward its top), and blendP(a, b, k), a part k of the way from
      one shape to another. Hips, waist, chest, shoulders each half way
      between their ellipsoid and a rounded box (all-box was tried: a
      robot, seams between the blocks); the chest a wedge, 2.8 wide
      (was 3.0; first 2.75); the head 0.3 toward a box (squarer jaw and
      crown); the feet 0.6 toward a flat box; the palm a rounded box.
      Joins a little tighter (trunk 1.1 -> 0.85, shoulder joint 0.7 ->
      0.55). 21.5k vertices.
- Lab, Elementarism's sound (user: the palette was bad; something very
  slight and midrange, less is more, distinction golden): the sweeps are
  gone. One voice, a small struck bar (bar(f, g, delay, dur, lean)): a
  soft sine tick with a faint 2.76x inharmonic overtone (a tone bar's),
  leaning a hair downward as it sounds (the diagonal), a little room
  (verb 0.22); and one interval for everything, the tritone (E 659 /
  B-flat 932, the octave's own diagonal): rising to select, falling to
  deselect, descending on a capture, climbing on a win; blocked, the low
  B-flat against a note a semitone up. Measured offline (OfflineAudioContext
  driven through playLabVoice): peaks about 5 dB under Swiss, hover all but
  silent (-46 dB).
- Nova's purchase: the register tape's sounds from the user's recordings
  (tools/story_receipt.py -> assets/story/receipt-print.mp3,
  receipt-tear.mp3; served as el-cabeza-story-receipt-*.mp3, build.js).
  The print: a taxi meter's paper printer, its first six bursts, 1.2x
  (pitch with it), high-passed 120 Hz, levelled. The tear: the hard swipe
  of a receipt against the cutter (peak 0.34 s in; it's started so the
  peak lands on the tear) and, 0.62 s on, a softer swipe as it's drawn
  away. The tape now prints in the recording's bursts (novaStory.jsx
  PRINT_BURSTS, printLineTimes: 11 lines over 6 bursts, 1-2-2-2-2-2, each
  line as its burst gets through it), torn 300 ms after the last: the tape
  takes ~3.9 s (was 1.65 s at a line per 150 ms), the tear at 5.6 s from
  the ring (was 3.35). Fetched ahead while the game's still on the shelf
  (sfx.prefetchReceipt, unified.jsx), decoded when the register rings;
  each decided just before it's due, the made sounds if the recording
  isn't there (and from disk, file:, always).
- Den ending, round (user):
    - Less walking, the legs varied: `lg` weights in pose (walk only a
      couple of strides, 3.2..7.6 s; tuck, both knees up, 13.5..17; splay,
      wide and straight, 19.5..22.8; one knee up as the other stretches,
      left 25.2..28.2, right 30.5..33.2; stretch, long and pointed,
      34.5..41.5), over a float with more of its own uneven drift (two
      sines a joint). The reflex steps at 23 s are gone.
    - A spine: `chest`, a bone at the waist (y 3.6; chest and shoulders
      on it, the head and arms its children; the waist part shared so the
      bend spreads through it). reachToSphere's target now in the chest's
      frame. Breath, struggle and "taken" move it a little.
    - It was always El Cabeza: ecstasy(f, cr, op, t), last over the pose:
      `curl` from the last line's start (+150 ms, 1.3 s up) to just before
      "El Cabeza" (~1.85 s in): the spine bent 0.85 forward, head down,
      knees drawn up, arms wrapped round, a quiver; then `open` (650 ms):
      arched back (-0.62), head thrown back (-1.0), arms flung wide and
      back, legs swept back, held on into the sphere; the body turned
      0.95 rad as it opens so the arch is seen in profile from behind.
      The reach toward the sphere now lets go as the last line comes.
- Nova's first scene (the store before the game's bought): touch drags
  tilt the other way up and down (user). Chassis prop invertTouchTilt
  (grabLatch: pointerType "touch" flips grab.phi), set by unified.jsx for
  tienda while !readOwned(). Mouse unchanged; the standalone store page
  unchanged. Checked with a CDP touch drag: Nova's store tilts up on a
  drag down, the store page down.
- (The store's first song, asked: its tape, assets/tienda/muzak-1974.mp3,
  served as el-cabeza-tienda-muzak.mp3: the user's upload "Mall Music
  Muzak - Mall of 1974 - 03 Third Floor Spending Spree".)
- Receipt, take 2 (user approved it by ear, from the preview): the print
  1.35x (was 1.2x; the tape ~3.5 s, was 3.9), the bursts re-timed
  (PRINT_BURSTS); the tear one rip only (the second swipe, "drawn away",
  sounded like a second rip: gone), its slice 1.10..1.80 s, peak 0.37 s
  in (TEAR_PEAK). The tear now ~5.2 s from the ring (was 5.6).
- Parrish (new theme, work in progress; user: a painterly technique where
  live-action footage of the pieces and board, nature, and imagery after
  Maxfield Parrish was edited and animated through rotoscoping and
  stop-motion to mimic oil paintings in motion; the user's reference is
  hand-painted rotoscoped film. Their YouTube link (share.google) was
  blocked here, so I haven't seen it. User's picks: name "Parrish", a
  terrace at golden hour, samples of both motions to review, and their
  own recording later for the music). Page el-cabeza-parrish.html
  (apps/parrish.jsx), NOT yet in the switcher (themes/realities.js
  WORLDS) until it's reviewed and has its channel picture; the gate's
  look is in (reality-gate.js LOOKS.parrish).
    - themes/parrish.js: ivory print stock and Parrish-blue ink, Cinzel
      title in gold, Cormorant Garamond captions; the store's wood set
      (wood-set.js) reflecting parrishEnv; lights golden key, blue sky.
    - themes/parrish-scene.js: a rectangular court: the board on a marble
      plinth in a long reflecting pool (planar reflection), colonnades
      down both long sides (each bay fades when it'd stand between the
      camera and the board), balustrade at the open ends, urns, cypresses
      and oaks below the edge, the sky dome with its painted horizon
      DROP = 0.27 rad below eye level (so the sky shows above the
      balustrade from a player's seat). Lights follow the board's yaw.
      Pixel ratio capped by tier (1 / 1.25 / 1.5) and governed by frame
      time. ?paint=raw shows the footage unpainted.
    - themes/parrish-paint.js: scene to a texture with depth; FLOW
      (structure tensor; detail from depth: fine near the board), OIL
      (Kuwahara along the flow, palette grade; the rotoscoped line where
      1/depth jumps), then the canvas: instanced brushstrokes in three
      layers (oriented, coloured from the oil, cut short at colour
      edges, bristles, dry tail, ridge lit from the upper left) over the
      oil as underpainting, then outline/weave/varnish multiplied over.
      Per-pixel dabs are the fallback without vertex textures. (Lessons:
      dFdx of a noisy height gave 2x2 stipple; bristle noise finer than
      a pixel aliased; a solid block under the court covered the pool.)
      ?motion=boil (strokes re-laid 12/s over smooth motion, default) or
      stop (a new painting 12/s, held between).
    - themes/parrish-audio.js: breeze, leaves, the pool, birds, crickets;
      wood-sfx on a solid board; MUSIC_URL null until the user's track.
    - Still to do: the pool still too electric blue (soften the grade's
      shadow tint on saturated colours, darker water); look at the
      in-game and top views; sample clips of both motions (virtual-time
      capture, frames to mp4); channel picture + WORLDS entry; tests.
- Parrish, redirected (user: "not hitting the mark"; their reference video
  uploaded, Enya "Orinoco Flow", plus the "Watermark" album cover; the
  share/YouTube/Dailymotion links were all blocked here). Read from the
  video's frames: the singer clean and photographic over loose, abstract
  painted backdrops (palette-knife and wide-brush sweeps, mostly diagonal,
  gold-leaf flecks); high-key, airy, misty; creams, sky blue, cobalt
  streaks, sage/mint, turquoise, touches of rose/coral/mauve; motifs: surf
  on dark rocks, turquoise sea, the moon, clouds, a ship's hull and
  rigging, roses/sweet peas/daisies, a white butterfly. The cover: crimson
  leaves, weathered teal-grey plaster, "enya" in a fine lowercase hand,
  darker edges. The marble court and cobalt-gold palette are gone:
    - parrish-scene.js: the board on a weathered-plaster pillar in the sea
      (curved sea disc, CURVE_FROM 18 / CURVE_K 0.012, horizon DROP 0.27 to
      match), rocks with churning surf (sea shader: distance to pillar and
      rocks), a ship sailing round (r 48, hull-down), the moon, soft
      clouds; flowers at the pillar's corners, 3 white butterflies, 7
      crimson leaves drifting down. The SUBJECT/WORLD split is the scene's
      alpha: world materials are opaque at opacity 0 (alpha 0), the dome
      and sea write 0; the board, pieces, pillar top, flowers, butterflies,
      leaves write 1. No pool reflection any more.
    - parrish-paint.js: FLOW carries the subject share (alpha averaged);
      OIL grades pastel (lifted blue-grey darks, cream lights) and draws
      the rotoscoped line only on the subject; strokes: world layers
      (knife 240x72 and 110x34, brush 64x16; curved, feathered, leaning
      to the rising diagonal, accents incl. crimson/patina/gold leaf with
      glints; stop short of the subject), one light subject layer;
      finish multiplies a crimson-umber vignette; a quarter-size glow is
      added. boil now shifts strokes a little (uBoil) rather than
      reshuffling. Bug fixed on the way: paint()'s 5th argument is "raw".
    - parrish.js: title Italianno lowercase (cream), high-key lights,
      viewPitch 1.1 (1.14 tall). parrish-audio.js: sea swell, surf with
      foam hiss, gulls (no pool, no crickets).
    - Sample clips: tools are a virtual clock (rAF + performance.now
      overridden, stepped per frame) and per-frame screenshots, ffmpeg.
- Parrish, abstract (user: "no theme, zero theme"; the feeling, painting
  style and above all the movement of the video; two palettes; mock-ups
  before going further; "show me El Cabeza in the Enya font"):
    - Read from the video's frames: no hard cuts at all (ffmpeg scene
      detection finds none): everything moves by long cross-dissolves,
      layers (subject, painted canvas) drift slowly and separately, moving
      things leave soft afterimages, the light blooms.
    - The world is now only a dome of drifting abstract colour fields
      (parrish-scene.js; no pillar, sea, ship, flowers, leaves).
      Palettes in themes/parrish-looks.js, ?look=orinoco|watermark
      (orinoco default while under review): fields, bias, blots, accents,
      grade lift/gamma, glow, vignette, lights, page colour. parrish.js
      reads it for lights and page colours.
    - The movement: an afterimage pass (parrish-paint.js ECHO_FRAG, ping-
      pong at paint size, half-life 0.6 s, blurring softly): where a piece
      was and isn't now, what it was, dissolving; mixed into the oil
      before the grade, so the strokes paint it too. The board writes
      alpha 0.75 (parrish.js wraps the wood set's slab and grid), pieces
      1, so only pieces leave afterimages.
    - The title: the "Watermark" logo is hand lettering, not a font; nine
      Google script faces shown to the user beside it (closest in feel:
      Zeyada, Dawning of a New Day). The page uses Dawning of a New Day
      for now, lowercase.
- Parrish masthead: the user's own "el cabeza" lettering (their artwork,
  uploaded; locked: "change the presentation, not the lettering").
  assets/parrish/title-mask.webp is its outline traced straight from the
  artwork's anti-aliased edge (alpha from brightness; 2136x678, ratio
  3.1504); the .ec-title span keeps the words for screen readers but shows
  the mask filled with paint per palette (title-paint-orinoco.webp: deep
  cobalt strokes with a little gold; title-paint-watermark.webp: warm cream
  like the cover's own logo), lit from the upper left, its paint drifting
  at 12 steps a second; a glow on the h1 (orinoco: a thin cream halo;
  watermark: a faint warm one and a dark shadow). Sized in em (4.6em wide)
  so it follows the chassis's masthead phases. titleFontFamily back to
  Cinzel (headings only); the candidate script fonts are gone.
- Parrish: the board and pieces are painted too (user: they "don't need
  to stay clean like Enya... they are a part of the painting, that move").
  OIL: the subject's Kuwahara steps 1.35/1.2 texels (were 0.85/0.8), only
  24% of the raw colour kept (was 62%), its lift 75% of the world's, and
  all colour drawn toward the look's own field ramp by brightness (subject
  34%, world 20%; light stays light, dark dark), after the afterimage is
  mixed in. Strokes: two subject layers (36x12 and 17x6 brushes, jitter
  0.13/0.09, a few accents, tolerances 0.22/0.15 so edges hold); the
  world's knives ease off over the board (clip 0.45..0.85) rather than
  stopping hard.
- Parrish motion: the reference video measured frame by frame changes on
  every third frame and holds the two between (25 fps file: ~8 images a
  second; even dissolves step). User: stop-motion is the default, at 8.
  PAINT_FPS 8, motionMode() defaults to "stop" (?motion=boil for smooth
  motion with strokes repainted 8/s); the title's paint and the dock
  piece's edge also step 8 times a second.
- Parrish, to do when it's done (user): BOTH palettes in the theme
  switcher, as two entries (themes/realities.js WORLDS: ids e.g.
  "parrish-orinoco" and "parrish-watermark", hrefs
  el-cabeza-parrish.html?look=orinoco / ?look=watermark), each with its own
  channel picture (tools/channel_shots.mjs SHOTS + build.js channel ids)
  and the gate's look (reality-gate.js LOOKS for both ids).
- Parrish: the pieces a touch more defined against the board (user: they
  "blend into the board just a bit too much", a SUBTLE adjustment). OIL,
  on piece pixels only (scene alpha ~1; the board writes 0.75): +6% of the
  raw colour kept, the palette-ramp pull 25% less (34% -> ~25.5%), and the
  rotoscoped line firmer: uLine 0.35 -> 0.44 with the board's line scaled
  0.75 (so the board's stays ~0.33, the pieces' goes to 0.44). The world
  and the board otherwise unchanged.
- Parrish: the pieces sit on top (user: "perhaps the pieces need to sit on
  top ... but still it has to have that stop motion look"), and the light
  pieces nudged once more. The pieces are painted as their own layer over
  the board: OIL's Kuwahara takes each sample only from its own side of a
  piece's edge (pieceOf(alpha) match, so piece and board colours never
  mix); every stroke (all layers) reads whether its centre is on a piece
  (vPiece, from tScene) and is cut where a pixel's side differs, the test
  point jittered ~3 px by noise seeded per painting, so the edge is cut
  anew 8 times a second (the rotoscope boil); FINISH lays a thin soft
  shadow of the pieces down-right (14%). Light pieces (luma 0.45..0.65+):
  the definition step doubled (raw +12%, ramp pull -50%); lines: uLine
  0.53 with board x0.62 (~0.33, as before), dark pieces x0.83 (0.44, as
  before), light pieces x1 (0.53).
- Parrish bug: "cast" is a reserved word in GLSL ES, so the FINISH shader
  (shadow, rotoscoped line, canvas weave, vignette) failed to compile
  from 0a4d7ac until the fix (renamed "shade"). Capture scripts now log
  console errors too; never name a GLSL variable cast/input/output/filter/
  sample/common/partition/active/... (ES reserved words). Shadow options
  shown to the user (strength/reach): 0.14/1 (current), 0.24/1.6, 0.34/2.2.
- Parrish: the flat drop shadow under the pieces is GONE (user: it made
  the pieces look like they hover; a screen-space offset shadow reads as
  elevation, and the scene already casts real 3D shadows). Next on show:
  a grounding (contact) shadow hugging each piece's base, from depth.
- Parrish: the soft grounding (contact) shadow is live (user picked "soft"
  of none/tight/soft). FINISH, board pixels only (alpha 0.5..0.85): 8
  directions x 3 radii (up to 9 x 1.7 px x uScale), a tap counts where it
  lands on a piece AND that piece's depth is within 2.2% of the board's
  (so only the part touching the board darkens it); 50% at full; the taps'
  rotation reseeded with each painting so the shadow's edge is repainted.
- Parrish piece sounds = the user's two recordings of instrumental stabs
  (assets/parrish/src/instrumental-stab-1.mp3, instrumental-stab.mp3;
  user: "cut them up into very, very small pieces ... I'll guide you
  afterwards"). tools/parrish_stabs.py picks the cleanest single hits
  (attack contrast), cuts each from 4 ms before its real attack (a third
  of its height), fades, normalizes, lays them in one mono file
  assets/parrish/piece-stabs.mp3 -> dist el-cabeza-parrish-stabs.mp3
  (build.js parrish files). parrish-audio.js STABS = [start, length]
  table (finds each slice's first sound in the decoded buffer). Mapping:
  select = lone note D5/C#5 alternating; deselect = C4 (rate .94);
  blocked = F3 twice, low-passed; rollStart = ticks at the 1/8 s
  stop-motion beat across the move (lower for heavier); landing = one of 4
  bass thumps, rate 1.25/size^0.22 (wood-sfx landingSize), louder with
  mass; capture = the long crash + 3 small ticks. Wood knocks stand in
  until the file decodes (and on file://). Test hook: __PARRISH_AUDIO__
  (with __EC_TEST_HOOKS__). Audition recorded on a bare page bundling
  only parrish-audio.js (the game page in headless GL is too slow for
  timing): scratchpad stabs/listen.mjs.
- Parrish landings softer (user): thump level 0.19 + 0.04*log2(cubes)
  (was 0.26 + 0.05*log2), about 2.5 dB down. A second selection of 16
  cuts sent for the user to choose from (scratchpad stabs/set2.py, one
  cut per whole second): notes B3 1.795a, E4 26.055a, C5 4.95a, B3
  12.885a, D#3 2.855b; thumps 10.705a, 35.625a, 33.45a, 18.875b; ticks
  15.32a, 35.085a, 9.445b, 8.785b; stabs F2 3.08b, 25.445b; long hit
  5.095a (s into instrumental-stab-1 = a / instrumental-stab = b).
- Parrish sounds, selection 3 (20 more cuts, none repeating sets 1-2,
  one per whole second; scratchpad stabs/set3.py, list in set3.json):
  notes C4 24.55a, C4 24.90a, C4 1.48a, D5 4.11a, D4 1.30b, C4 1.97b;
  thumps 14.99a, 13.34a, 26.53a, 38.27a, 36.08a; ticks 36.41a, 13.98a,
  34.12a, 46.96a; stabs 25.89b, 22.39b, 6.58b, 24.12b, 23.66b (long).
  Waiting on the user's picks across the three selections.
- Parrish piece sounds = the user's 17 picks (tools/parrish_stabs.py
  PIECES): set 1 #1-6 (D5 C4 C#5 D5 F3 D#4) + #16 (39.72a, win: Cabeza
  at the far side); set 2 #1-5 (B3 E4 C5 B3 D#3); set 3 #3-6 (C4 D5 D4
  C4) + #20 (23.665b long, win: last Cabeza crushed). Thumps/ticks/crash
  gone. User: unassigned ones by audio-profile similarity, "the deeper
  the pitch, the larger the piece or side". parrish-audio.js NOTES =
  the 15 notes high->low; noteFor(size) = log(size)/log(12) across them
  (+-1 neighbour 40% of the time): select/deselect by the piece's cubes
  (chassis now passes playSelect(cubeCount(p)) / playDeselect(cubeCount(p));
  other themes ignore the arg), landing by landingSize, rollStart a
  falling run of 50 ms note heads from 2 above the piece's note at the
  1/8 s beat, blocked = D#3 + F3 muffled, capture = D#3+F3 dyad then B3
  (deferred 40 ms: chassis calls playCapture then playWin for a capture
  win, so win() cancels it and plays winCapture; a win with no pending
  capture = winEdge). User: "each stab should be given additional reverb
  ... think Enya": a generated hall (makeHall: 28 ms pre-delay, dark tail
  RT60 3.8 s + bright 1.3 s, early reflections, L/R decorrelated), send
  0.8 on every stab, on the pieces channel.
- Parrish (Orinoco) move markers: the painting's light blue (user: the
  beige ones were hard to tell from the board). parrish.js has its own
  buildMoveIndicator for Orinoco (Watermark and capture markers stay the
  wood set's): a 0.09-wide band of 0x5fa2f0 over a 0.13 dark-cobalt edge
  (0x1f2f58), and a 34% wash of the blue across the square. The blue is
  set richer than it reads (the paint greys it: 0x9ec2e6 came out
  grey-white; 0x5fa2f0 lands on the painting's light blue). Full-screen
  button: Parrish CSS opacity 0.7 (0.45 in focus mode, 1 on hover; the
  chassis's 0.22 elsewhere), keyed on its inline visibility so it still
  hides when covered. Screenshot script: scratchpad parrish/mk.mjs.
- Parrish: no sound while a piece moves (user: the falling run of 50 ms
  note-heads, "di-di-da-da", stuttered and isn't wanted); sfx.rollStart is
  empty, the landing note is the move's sound.
- Parrish sounds, selection 5 (user: "more variety ... these can have 1, 2
  or 3 peaks ... ignore the percussive stuff"). The upload enya_stabs.mp3
  is byte-identical to assets/parrish/src/instrumental-stab.mp3 (b).
  24 phrases from b, 8 each of 1/2/3 stabs, one every 2 s
  (scratchpad stabs/phrases.py -> set5.json, set5.py); percussive parts
  skipped by HPSS (percussive share max < 0.45, mean < 0.2), flams
  (< 80 ms apart) skipped, cuts end before the next stab. Onsets (s into
  b): 1-peak 9.44 12.52 8.77 5.71 11.40 6.14 26.76 7.91; 2-peak 9.65
  12.73 19.53 4.62 1.53 12.08 26.32 32.22; 3-peak 32.88 33.76 7.58 10.98
  0.63 35.94 3.72 17.33. Waiting on the user's picks.
- Parrish sounds: the user kept set 5 #6, 7, 9-13, 21-23 ("treat/process
  as before and integrate wisely"). Added to tools/parrish_stabs.py as
  "phrase" cuts (as auditioned: onset - 4 ms, last 30% faded) and to the
  one file (now 27 slices, 14.6 s). Measured by strongest partials: #6
  ~A4, #7 ~A#5 -> into NOTES (now 17, A#5 on top). Roles: biggest
  landings (landingSize >= 6/8/10) on a pair half the time (#9 ~D4, #13
  ~C4, #12 ~D#3); capture = #23 (three, deepest, bass) replacing the
  D#3+F3 dyad; Begin Game (playPowerOn) = #21; a game ended by hand
  (playPowerOff, not within 2.5 s of a win) = #22; rules open #10, close
  #11 (quiet), rules tab = #7 very soft. All through the hall.
