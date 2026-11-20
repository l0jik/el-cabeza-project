## Everything out in the open (user: "I want everything out in the open… as user friendly as possible")

Came out of the Claude Design redesign boards (the "Streamlined"
direction). First pass, in the real game, both themes:
- **Cost badges on move markers: gone** (2026-11-20, see "No Move
  costs" below). They were camera-facing sprites over each marker (and
  each Cantilever Pivot arrow), `buildCostBadge`, showing `moveCost(move)`
  or a "free" ring for a move putting the board back as it was earlier
  this turn, riding the marker's fade (`withCostBadge` in the ghost
  effect); from 2026-10-07 only when the moves in reach differed in cost.
  The markers now carry nothing but themselves; test hook
  `__EC_TEST_MARKERS__()` -> `[{ dir, sprites }]` (the markers showing,
  not those fading out; sprites, where a badge would show).
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
  And the piece's moves (2026-11-20; user, in Neo-Brutalism: "If a piece
  is selected and you see ... possible movement locations, but then you
  decide you don't want to move that piece, you should be able to click
  out off the piece and then it will no longer show the potential move
  notifications. ... Am I missing something or am I interpreting this
  correctly?"; right, but two presses didn't): a tap on one of the other
  side's pieces (not one to crush, whose marker takes the tap) now counts
  as a press away: before a step it lets go of yours. Mid-turn a press
  away puts the turn's piece's markers out of sight too (`movesAway`, the
  shadows left empty for it; reset by a move, another selection, the next
  turn); the piece stays the turn's (End turn, Undo move, a hold on it as
  before), and a tap on it brings its moves and its card back, with the
  note a tap on it always gives (Hold the piece to end it): a tap that
  shuts the dock's panel lands on the board, and e2e-hold-to-end's next
  tap on the piece wants that note.
- **No Move costs, switch or badges** (2026-11-20). First the switch
  (user, with All settings' "Move costs" circled: "remove this from the
  more comma all settings menu globally, comma, unless you can think of a
  reason why it should be kept even in some instances."): there was one
  from 2026-09 (first Futuris, then every theme, 5654027: a Nova report
  that the numbers on the board couldn't be hidden, when every marker
  carried one, mostly a "1"): a circled-"1" icon in the dock's foot
  (`costs-toggle`), a row in More's Help on the board, the phone shell's
  "Move costs on the board", a line in the first game's tour,
  `theme.moveCostToggle`, localStorage `el-cabeza:show-move-costs`; all
  gone. Then the badges (asked what "the cost badges themselves stay"
  meant, the user: "I'd rather they were gone entirely as well... The
  "why not" toggle tends to cover these bases as far as if you don't have
  enough action points to do something, it would let you know there,
  right?"). Right: what a move costs is said in words now. Why not's
  "Not enough actions" note, on a move the turn can't pay for, says what
  it costs and what's left ("This move costs 2 actions. You have 1
  left."; a slide that pushes, its sum); the piece card (Piece guide)
  says how the chosen piece moves and what that costs; the Actions left
  dots count down, and give back the action of a move back the way a
  piece came (free, as before; the dots flash). e2e-costs (no badge on
  any marker, a free way back among them too; the card's cost; the roll
  back handing its action back; no switch), e2e-pivot (the pivot arrow
  with none), e2e-rings / e2e-menu-lab (no row in More), e2e-nova-mobile
  (none in the phone's menu), e2e-why-not (the note).
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

