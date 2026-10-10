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

