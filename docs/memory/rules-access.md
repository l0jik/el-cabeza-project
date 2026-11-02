# The rules in every world: the two buttons, the ?nova link, Change rules

How a player gets from the standard game to Cabeza Nova's rules (and
back) in each world. Built 2026-11-02 (user, of the Lab: "there is no way
to access rules other than the standard game. What is a solution here?
Do we need to have a button in every game to allow toggling between
standard game and Cabeza Nova rules?"; of the options A-D, "Go with A +
B").

## The gate (since 2026-10-01, history 03)

themes/reality-gate.js. Two buttons as a world comes up with no game
under way, Standard Cabeza (the classic game at once) and Cabeza Nova
(one scrolling menu of every piece, rule and board), in each world's own
look. A theme turns it on with `realityGate: { world, deferred?, when?,
story? }` (apps/*.jsx; Lluvia's is deferred, opened after its descent).
Only where the rules are open (below); before that a world plays the
standard game alone (the user's own answer then: "only after the
story").

## Where the rules are open: rulesOpen(gate)

- After the story: storyOver() (localStorage el-cabeza:story .ended, or a
  realities-menu visit this session). ?restart=story and ?fresh undo it;
  ?switcher sets it.
- Or (A) the ?nova link, on any world's page with the two buttons: the
  Lab's nine, Lluvia, Luna, Noir, Plano, Cromo, the City, both Parrish
  looks. Read once (readNovaLink), by the first world that asks; the word
  dropped from the address (history.replaceState); the visit (this tab,
  sessionStorage el-cabeza:nova-link) keeps the rules open after, a reload
  included. The link's first opening is Cabeza Nova's menu itself
  (gateStage), every later one the two buttons.
- Never through the link on Nova's own places (the store, the den,
  Futuris and The City on Nova's page: their gate has `story: true`, so
  rulesOpen goes by the story alone there). Futuris's own page has its
  Custom rules (the sphere) anyway; the store's and the den's own pages
  have no gate at all.
- The story still owns Other realities: the gate's link to them and the
  corner planet show only after the story (storyOver), not through the
  link. saveLastWorld too.
- Lluvia asks rulesOpen() itself, with no gate (lluvia.js reopenCity and
  openCity, lluvia-overlay.js gateNext): right on its own page, the only
  place it plays. Were it ever played in place on Nova's page (only The
  City is, apps/unified.jsx LAZY), those calls would want its gate
  (`story: true`), or the city's settings would open nothing.

## Change rules (B)

chassis/ElCabeza3D.jsx: rulesChoice = gate && rulesOpen(gate);
askChangeRules / openRulesChoice; rulesAsk (the question).

- In a game: at the foot of the Rules card. The corner menu's card
  (chassis/CornerMenu.jsx onChangeRules, corner-menu.js `change`: a
  `go cm-extra cm-change` button, so each look's own .cm-extra styling
  places it, data-testid corner-menu-change-rules) and the Lab's Rules
  line (themes/lab/hud.js, through the setup extras' `changeRules`;
  lab-rules-change). Not in a replay or an online game. On a touch
  screen both links have a finger's room round them (an unseen ::after,
  8 px above and below, under `pointer: coarse`): the looks' link type is
  small (11 px high in Luna's), and nothing on the card moves for it.
- Asked first while a game is being played: "Change the rules?" with
  Change rules / Keep playing (change-rules-ask, -yes, -no; a tap beside
  it, change-rules-ask-backdrop, or Escape keeps playing). Each world's
  panel styling takes it by its testid (lab/css.js, tienda.js,
  parrish.js PANELS), as the new-game card.
- Between games: the dock's after-game links (change-rules) and under
  Begin Game (change-rules-setup), the phone bar's menu
  (shell-menu-change-rules, "Standard Cabeza or Cabeza Nova", only when no
  game is being played), and the calm menu (menu-fan.js picks the two
  dock buttons up as before; menu-lab.js too). These replaced the old
  "Cabeza Nova" links (nova-again, nova-again-setup,
  shell-menu-nova-again), and where Change rules shows, "Plain rules"
  (reset-rules, shell-menu-reset-rules) steps aside: Standard Cabeza from
  the two buttons is the same thing. Elsewhere (Futuris's own page, the
  story's places before the story's over) Plain rules stays.
- What it does: resetGame(false) if a game had begun, then the two
  buttons (stage "choose"). The gate has no way out but a choice, as
  before; Cabeza Nova's menu keeps the last choices (el-cabeza:nova-setup).

Words: i18n/es.js and vi.js ("Change rules", "Change the rules?", its
line, "Standard Cabeza or Cabeza Nova" and the two link titles).

## Tests

tests/e2e-change-rules.mjs (the link on the Lab, Luna, Lluvia; the Lab's
Rules line and the question; Luna's card, Escape; a reload keeping the
link; nothing without story or link; Nova's page not taking it; Noir
after the story; Spanish on a phone by touch). tests/e2e-gate.mjs (Cromo
after the story: Change rules after a game and under Begin Game; Nova's
phone bar menu).
