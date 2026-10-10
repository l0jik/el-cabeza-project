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

