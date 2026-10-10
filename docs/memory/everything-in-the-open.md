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

