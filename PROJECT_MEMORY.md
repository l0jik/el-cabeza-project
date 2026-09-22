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
built fresh every time). No backend, no persistence — everything is
client-side state, reset on reload.

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
  the new plate. New Game restores the boot size (`bootBoardRef`). The
  black-hole picker uses `selections.topologies` (the chosen size), since
  the live board isn't resized until Begin Game.
- Known non-obvious consequence, confirmed not a bug: four pieces (each
  side's Turrito and Cabeza) start boxed in by their own neighbours —
  identically at 10×10, 20×20 and non-square sizes. Don't "fix" it.

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
  with the user and explicitly deferred.
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
  blocked). **Split Movement** is planned but not
  built (see the reviewed plan; budget = shared pool of 2, or 3 with 3
  Actions). **Cantilever Pivot** still **cannot** be implemented before
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
