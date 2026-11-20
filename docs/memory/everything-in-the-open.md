## Everything out in the open (user: "I want everything out in the open… as user friendly as possible")

Came out of the Claude Design redesign boards (the "Streamlined"
direction). First pass, in the real game, both themes:
- **Cost badges on move markers.** `buildCostBadge` (chassis) is a
  camera-facing sprite over each marker (and each Cantilever Pivot arrow)
  showing `moveCost(move)`, or a "free" ring when the move would put the
  board back as it was earlier this turn (same turn-trail test as the
  refund in commit; never for a crush, shove or the AI). It rides the
  marker's fade via a wrapper (`withCostBadge` in the ghost effect).
  Colours: Futuris uses the side's accent with `inkOnAccent`; Standard uses
  `bodyDark`/`bodyLight`. `toneMapped: false`, or Futuris's cyan dulls.
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
  Test: `tests/e2e-outside-dismiss.mjs` (futuris, tienda, lluvia).
- **No Move costs switch** (gone 2026-11-20; user, with All settings'
  "Move costs" circled: "remove this from the more comma all settings
  menu globally, comma, unless you can think of a reason why it should be
  kept even in some instances."). There was one from 2026-09 (first
  Futuris, then every theme, 5654027: a Nova report that the numbers on
  the board couldn't be hidden, when every marker carried one, mostly a
  "1"): a circled-"1" icon in the dock's foot (`costs-toggle`), a row in
  More's Help on the board, the phone shell's "Move costs on the board",
  a line in the first game's tour, `theme.moveCostToggle`, localStorage
  `el-cabeza:show-move-costs`. Since 2026-10-07 (b29bf7a) the badges only
  show when the moves in reach cost different amounts (a "free" back, a
  2-action move beside 1-action ones), which is when a turn can't be
  planned without them, so no case was left for hiding them: the switch
  is gone everywhere, the badges always follow that rule, and an "off"
  left in a browser hides nothing. e2e-costs (no switch, an old "off"
  ignored), e2e-rings / e2e-menu-lab (no row in More), e2e-nova-mobile
  (none in the phone's menu).
- **How to play** (`how-to-play`): always on screen beside the full-screen
  button and opens the Quick card. Below 560px wide only the "?" shows,
  keeping it clear of the points counter.
- **Corner controls under the dock**: while the open dock panel reaches
  their spot (a phone, or the 880px post-game panel on a smaller
  desktop), the full-screen and How to play buttons fade out and go
  inert (`cornerControlsCovered` in the chassis, from the panel's width
  rule and `window.innerWidth`), then return when it closes. Before this
  they sat on top of the panel's DARK/LIGHT players line on phones.
  - Both corner controls use `cornerControlsZ` (12 by default). Futuris's
    useSetupExtras returns 2050 while the SINGULARITY sphere is up: above
    the sphere's full-screen layer (2000, which ate their taps; user
    report), under its menus (2100+) and the rules overlay (2500). They
    are not raised during the collapse or the cut to black.
- **Custom rules** (`custom-rules`, Futuris setup dock, under Anomaly/Begin
  Game): calls `revealSingularity`, the same reveal five masthead taps do
  (the taps still work).
- **Points counter on by default.** `loadShowPoints` is true unless the
  saved value is "0", so a player who switched it off keeps it off.
- Tests: `tests/e2e-costs.mjs` (badges, free ring, piece card, pivot badge
  in e2e-pivot); e2e-rules covers How to play and Custom rules;
  e2e-points expects the toggle to start on.

