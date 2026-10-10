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

