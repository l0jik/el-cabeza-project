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
  **Cantilever Pivot** still **cannot** be implemented before
  non-convex pieces exist — same blocker as MATTER's L-Pentomino/Arch
  inertness above.
- **Backlog LAW — Shoving (not built, spec later):** larger pieces can
  displace smaller pieces 1 space (2? for Opa — TBD). No rules,
  UI, or toggle yet.
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
Top-Down View; two-finger double-tap toggles fullscreen; trackpad
two-finger flick and a second `contextmenu` within the double-tap window
get touch-gesture parity on desktop.

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
  for the outline.
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
  quietly relaxing them.
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
- Rendering: `makePolycubeGeometry` (outside faces only, so
  EdgesGeometry traces just the real outline — Neon's shell) and
  `makePolycubeRounded` (merged rounded cubes, optionally grown —
  Standard's shell), in engine/geometry.js, both centered on the bbox
  like makeRoundedBox. So pieceCenter/pivotFor/roll animation are unchanged.
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

**Shoving LAW** (`laws.shoving`). Its two game-start settings live in
`selections.shove = { far, onRolls }`. `lawsForEngine` turns them into
`ACTIVE_LAWS.shoveFar` / `shoveOnRolls`, set at Begin and on replay. On
the sphere they're a pair of segmented controls directly under the
checkbox (`renderShoveSettingsRow`, testids `shove-far-on/off`,
`shove-onRolls-on/off`).

Rules (`tryShove` / `rollShove` in rules.js):
- A move whose landing hits exactly ONE piece with fewer cubes
  (`cubeCount`) pushes it in the move's direction, instead of being
  blocked. That includes a Cabeza, and your own pieces.
- Distance: 1 square, or with `shoveFar` as far as the mover's leading
  edge advances.
- Every square along the way must be on the board and not a Missing
  Square, with no second piece in the way (no chains). The pushed piece
  must end clear of the mover's landing.
- Only a Turrito or a Cabeza can be pushed into a Black Hole. It comes
  out one square past the paired hole.
- Slides always shove when the law is on. Rolls shove only with
  `shoveOnRolls`.
- A roll onto a lone enemy Cabeza stays a crush, not a shove.
- Being pushed onto the far row never wins.
- Cost: `SHOVE_COST = 1` extra (`moveCost`), gated by `withinBudget` in
  legalMovesFor. So a shoving slide costs 3 and needs 3 Actions Per
  Turn; a shoving roll costs 2 (an Opa roll 3).

Other pieces:
- The move carries `shoves: { id, row, col, teleports }`.
- ai.js applyMove/undoMove move the pushed piece. The net-zero checks and
  the split-turn dedupe treat a shove as the turn doing something.
- Chassis: commit applies it; step records carry `shoved`; settleTurn
  never voids a turn that shoved.
- Animation: `animateStep(..., shove)` glides the pushed piece on its own
  carrier over the same duration (`anim.current.push`). Undo snaps it
  back when the turn is restored.
- Tests: the Shoving block in `tests/engine.smoke.mjs`,
  `tests/e2e-shoving.mjs`, and the sphere settings in
  `tests/e2e-singularity.mjs`.

Audio: the collapse roar's peak was trimmed from 0.022 to 0.018. At the
end of the collapse the roar, the drone and the bell's tail sum; the
bell test measured up to 0.98 before the trim and ≤0.86 after.
