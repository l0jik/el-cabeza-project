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
- Nor, since 2026-10-08 (the user's choice: "swing over 1-tall pieces"),
  does a piece one cube tall (other.z <= 1) where it stands on the
  roller's own side of the edge it tips over: the roll rises over it (in
  the animation the swinging cube briefly passes through its top). Asked
  because a flat Cruce couldn't stand up on its stem with a Flaco lying
  beside the stem (its bar's end swept through the Flaco). Beyond that
  edge, where the roller comes down, it's in the way as ever (the user,
  the same day: a Hombro came down onto a Cabeza through the Turrito
  beside it, "it should have only been able to travel over the Flaco").
  Taller pieces in the way, and anything on the landing, still stop it.
  Pivots are as they were.
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

