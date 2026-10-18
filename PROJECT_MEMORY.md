# El Cabeza — project memory

Durable knowledge for continuing development after a context reset: the
decisions, the history and the pitfalls. It complements `ARCHITECTURE.md`
(the structural contract: chassis, themes, engine) rather than repeating
it. Read both before resuming work.

Until 2026-10-10 this was one file of about 10,000 lines (657 KB), which
cost every round time to search. It is now this index, and the notes
themselves, unchanged, in `docs/memory/`: one file a topic, and the
round-by-round history in parts (user: "move forward with all", after the
efficiency review: a short index, nothing lost).

How to use it:

- Find the topic below and read its file, or search everything:
  `grep -rn "keyword" docs/memory`.
- `docs/memory/history/README.md` lists the first line of every round
  note, part by part, oldest first.
- A note each round (user's rule) goes at the end of this file, under
  "Recent rounds". When that section passes about 300 lines, move it into
  the next `docs/memory/history/NN.md` and add its entries to the
  history's README.
- The old single file is exactly the topic files below, in this order,
  followed by `history/01.md` to `history/11.md` (`00-preface.md` and
  `00-open-reminders.md` first).
- If a cited number looks off, trust `grep` over the notes: code moves
  faster than docs.

**Neon is Futuris** (since 2026-10-16; user: "Change all "neon" references
to "futuris"", after trying "void" and "O"). The world, its page, files,
ids and tests were renamed: themes/neon*.js are themes/futuris*.js,
apps/neon.jsx is apps/futuris.jsx, assets/neon/ is assets/futuris/, the
page el-cabeza-neon.html is el-cabeza-futuris.html (the old address is a
page that forwards there, query and hash kept), the world id, the
corner-menu look and the side-name, glow and gate keys are `futuris`, and
tests/theme-neon.smoke.mjs is theme-futuris.smoke.mjs. An old
`?world=neon` and a last world kept as `neon` still lead to Futuris. Notes
written before (Recent rounds below and docs/memory/history/) say Neon
and are left as they were; git history says Neon too. "neon" meaning
light stays wherever it is: Lluvia's signs, Noir's red HOTEL sign (its
`NEON` colour), the store's and the ending's neon blue, the pieces' neon
rim, the front-page mock-ups of NOVA as a neon sign.

## Open reminders (from the user; not done yet)

- **No public launch of Cabeza Nova until a preferred set of rules is
  firm** (user, 2026-10-16: "remind me that we cannot deploy this until a
  firmed up set of preferred rules is established. Everything else, all
  the modularity will be a part of the Cabeza Nova system, but we have to
  deploy it with a preferred set of actual rules. That's considered to be
  the standard for Cabeza Nova."). "Deploy" here is the public release
  (the app stores, an announced launch), not the GitHub Pages builds every
  push makes. Every option stays in the game; the launch ships with one
  settled rule set as Cabeza Nova's standard (its laws on or off, their
  settings, the pieces, the board, black holes and their sets, missing
  squares, Punto). Raise it whenever a launch, an app build or the store
  listing comes up, and when the user asks what's open.
- **Revisit a Trusted Web Activity** (user, 2026-10-16: "Remind me to
  revisit this later: Trusted Web Activity"): the Android app as the
  website in a Chrome shell, about 1 MB from the Play Store instead of
  about 46-48 MB bundled. Bring it up again when an app build, the
  Play Store or a domain for the site comes up, or when the user asks
  what's open. What it needs: docs/memory/00-open-reminders.md.
- (Done: the disclaimer, user 2026-10-08, in since 2026-10-14 at the foot
  of ABOUT in every world; what was said about rights along the way is
  kept in docs/memory/00-open-reminders.md.)

## Backlog (as given to the user, 2026-10-18: "what's in the backlog.")

Keep this list current: add what's offered and not started, strike what's
built or dropped.

- Waiting on the user: Cabeza Nova's standard rules (above); a pick among
  the front page's 50 versions (front/front-review.html, on the site as front-review.html); the online play
  and cloud saves server on the user's own free Cloudflare account
  (server/README.md, then its address in chassis/online-config.js
  RELAY_URL; until then online games and cloud codes don't work, a save
  file does); and a question: in the store, should a mouse drag turn the
  board the way a finger does (a mouse keeps the store's own way now)?
- Reminder: the Trusted Web Activity (above).
- Offered, not started: every other world in place on Nova's page, as The
  City is; a walk-home warning (the check alert's kind, for "the
  computer's Cabeza can reach your back row next turn"); the computer
  faster and stronger with big armies.
- Probably stale: "Cabeza [the_system]" (docs/memory/15-open-thread.md),
  to confirm or drop.
- Dropped (user, 2026-10-18: "remove this from the backlog. : Two other
  ways to place singularities: pick one up and tap where it goes, or one
  pair per row, each with its own Place button."): those two ways of
  placing singularities. Not to be offered again.

## Topics (`docs/memory/`)

- [01-what-this-is.md](docs/memory/01-what-this-is.md): What the game and the code are, in one paragraph
- [02-build-and-verification.md](docs/memory/02-build-and-verification.md): Build (esbuild, one page per world) and how changes are verified
- [03-game-ai.md](docs/memory/03-game-ai.md): The computer opponent: search, evaluation, difficulties
- [03b-board-dimensions.md](docs/memory/03b-board-dimensions.md): Board size as a runtime parameter (TOPOLOGIES groundwork)
- [03c-singularity-transition.md](docs/memory/03c-singularity-transition.md): Futuris's Singularity cinematic transition
- [03d-sphere-menu.md](docs/memory/03d-sphere-menu.md): The MATTER / LAWS / TOPOLOGIES sphere menu
- [04-performance-done.md](docs/memory/04-performance-done.md): Performance work already done (don't undo without reason)
- [05-camera-input.md](docs/memory/05-camera-input.md): Camera and input: fragile, verify rigorously if touched
- [06-dock-piece-preview.md](docs/memory/06-dock-piece-preview.md): The dock's spinning piece preview
- [07-rendering-standard-vs-futuris.md](docs/memory/07-rendering-standard-vs-futuris.md): Standard vs Futuris piece rendering techniques
- [08-visual-invariants.md](docs/memory/08-visual-invariants.md): Visual and design invariants: keep consistent
- [09-audio.md](docs/memory/09-audio.md): Audio architecture
- [10-solved-bugs.md](docs/memory/10-solved-bugs.md): Other solved bugs worth remembering
- [11-fragile-areas.md](docs/memory/11-fragile-areas.md): Fragile areas and edge cases
- [12-rejected-approaches.md](docs/memory/12-rejected-approaches.md): Failed or rejected approaches: do not retry as-is
- [13-hard-invariants.md](docs/memory/13-hard-invariants.md): Hard invariants: don't break without a decision
- [14-stable-baseline.md](docs/memory/14-stable-baseline.md): An old stable baseline (commit e58e182)
- [15-open-thread.md](docs/memory/15-open-thread.md): An old open thread
- [nova-naming.md](docs/memory/nova-naming.md): Nova naming
- [odd-shaped-pieces.md](docs/memory/odd-shaped-pieces.md): Odd-shaped pieces: the shape system, Codo, Arco, Shoving
- [everything-in-the-open.md](docs/memory/everything-in-the-open.md): Everything out in the open (no hidden gestures)
- [rules-popup-audio.md](docs/memory/rules-popup-audio.md): Rules pop-up audio: ABOUT tab only
- [matter-menu.md](docs/memory/matter-menu.md): MATTER menu: one list, 3D piece models
- [design-canvas-3.md](docs/memory/design-canvas-3.md): Design canvas: third batch
- [future-wishlist.md](docs/memory/future-wishlist.md): Future wishlist (user-requested, not started)
- [tienda.md](docs/memory/tienda.md): Tienda: the 1975 department store
- [tienda-singularity.md](docs/memory/tienda-singularity.md): Tienda: Futuris's Singularity in the store's terms
- [theme-lab.md](docs/memory/theme-lab.md): Theme Lab: nine design directions
- [nova-on-phones.md](docs/memory/nova-on-phones.md): Nova on phones: the phone layout (MobileShell)
- [nova-story.md](docs/memory/nova-story.md): Nova's story: the store, home, and the TV into Singularity

## History (`docs/memory/history/`)

- [history/README.md](docs/memory/history/README.md): the index, every
  round's first line, part by part (01 is the oldest, 19 the newest, up
  to the eve of the first-game walkthrough: the City's glass-dome Cabeza,
  placing pieces manually, close-ups, replays, online play and its
  Cloudflare server, the front page's versions, Punto, Neon renamed
  Futuris, Hard's lessons, two sets of singularities, no cap on a side's
  pieces, the order button that looked ready, and a finger turning
  Futuris's way before a game too).

## Recent rounds

- CI shard 6 on da27afd, e2e-original: in Nova's den the masthead hold never began, so CONNECT never came (passes locally). The hold is an invisible zone (apps/unified.jsx MastheadHoldZone) kept over `.ec-title` by a frame loop; the test pressed the moment it had the h1's box. Now it waits for the fonts and for the zone to be on top under the title's centre (elementFromPoint) before pressing, and says what's there if it never is. 6bf9af5: all 8 shards green.
- A new player's sides in the store (user, first: "In a brand new game, when you first try it out, it needs to start on the first screen so you can select the AI opponent"; then "No, scratch that. On a brand new game, when you start a game, it should just automatically select. You get to be the ash pieces, and the computer will be the walnut pieces. It just automatically selects this. Automatically selects easy, and all they have to do is just begin a game", and "you get to move first"). Supersedes the 2026-10 "the AI always be Ash": themes/tienda.js defaultOpponent is { aiPlayer: "dark", aiDifficulty: "easy", humanStartSide: "light" }, and chassis loadOpponentPrefs now takes a default's humanStartSide (the side that opens). With nothing saved the store's menu opens on the Back + Difficulty view, Easy picked, "Ash to move", Try a Game the only thing to press; saved as the page comes up, so it holds at home and after. The store's opening view (tienda-fx.js OPENING_VIEW, from Walnut's side) is unchanged; Begin turns the board to Ash's side as it does for whoever opens. Tests: e2e-tienda's game to a win is Ash's now (light-cabeza N, N to row 0, "Ash wins", "against the Easy AI", the tape's "C: N.N"); e2e-wood-sounds rolls the Flaco of the side to move (new hook __EC_TEST_TO_MOVE__, "dark" or "light").
- The first game, walked through (user: "They click begin a game, and then a little pop-up will say, "Welcome to your first game of El Cabeza." Copyright 1975, and then approximately. You are the light / ash colored pieces, and you're trying to get your disc to the other player's back row or use your blocks to crush their disc ... this needs to be a walkthrough basically as to how to play the game. So, and it'll say, you get to move first. And so it'll say, you have two action points ... the board is fully rotatable and zoomable. They click on a piece and it'll say what it is. And then it'll show what the movements are. And it'll kind of zoom in on it a little bit. And then it'll say, this can move how many spaces? Like if they click on the OPA, it'll zoom in on the OPA and say, this is where you can move. It can only move once per turn. And if they click on any other piece, it'll say, that's what the name of it is, how many times it can move, and it'll show the movement pieces. We need to create a first-time player walkthrough tutorial, sort of, basically."). chassis/FirstGameTour.jsx (the cards; TOUR_KEY el-cabeza:first-game-tour = "done", so once a device; ?fresh forgets it, ?restart=story keeps it) and the chassis's tourStep: a world offers it with theme.firstGameTour (words, or a function of the setup extras): the store's (tienda.js firstGameTour) only in the story's store before the game's bought, not Big Glutts' own page, not at home. Started by Begin (triggerBeginGame) for a game against the computer with nothing played, not online or in a replay. Three cards over the board (a scrim; the computer waits while one's up, the AI effect's tourCardUp): "Welcome to your first game of El Cabeza." with "© 1975" under it and "You're Ash, the light pieces. The computer plays Walnut, the dark. To win, get your disc, the Cabeza, onto Walnut's back row, or crush Walnut's Cabeza with one of your blocks."; "You move first." with two actions a turn, all for one piece, a roll or a step one, the Opa's move two, the dots at the foot (a Punto game says the cut); "The board turns and zooms." (a finger's words or a mouse's). Next ›, the last Let's play ›; Skip the tour (and Escape) end it. Then a card at the top through your first turn (beside the board on a screen 900+ wide, below the price tag on a phone: copy.clear ".td-shop-tag", and the corner menu's tab): "Tap one of your pieces."; each piece of yours tapped gets its lesson, RulesCards.jsx pieceLesson (name, what it is, MOVES how far, A TURN how many times: the Opa once, its move taking both actions, the rest twice; AIM; this game's laws), with where the turn stands (the marked squares, or that it's hemmed in; after a move what's left and End turn), the piece card standing aside, and the camera in a little (frameTourPiece: pitch 0.6, the piece and every square it can go to with a square round them, at least four across, three fifths of the room beside or under the card, never nearer than 0.62 of where the camera was; the Show me fit shared as fitFootInRegion). Your turn over: the camera back where it was (unless a view was chosen meanwhile), and "Walnut's turn." / "Your turn again." until Got it or a piece is picked; then done. Checked on a phone and a desktop by screenshots; tests/e2e-first-game-tour.mjs (33 checks: the sides chosen, the three cards and their words, the computer waiting, the Opa/Turrito/Cabeza lessons, the camera in and back, a move by its square, Got it kept as done, no tour after; desktop Skip and Escape). Tests that try a game as a new player in the story's store now meet it: e2e-story checks the welcome and skips it; e2e-touch-in-game's store seeds it done.
- The order form's shove callout gone, and "pieces" said (user, a phone screenshot of the store's form, Slides only and Only opponents chosen: "get rid of the callout with the hand pointing at it completely. And then the part above that ... that little mark is supposed to indicate the word pieces, adding that word in there. So it'll change the phrase to "One of your own pieces in the way... ""). The "A shoving slide costs 3 actions ..." warning (shove-needs-three) is out of themes/rules-selections.js lawWarnings (the store, the Nova sheet, Lluvia) and Futuris's sphere's own lawWarning; "Slides only needs Orthogonal slide" stays. chassis/shove-settings.js OWN_BLOCKS: "A shove pushes only your opponent's pieces: one of your own pieces in the way blocks the move." (every menu's line), and the rules cards' two sentences the same. Tests: rules-selections.smoke (no callout; the line's words), e2e-lluvia (no callout; the line).
- The walkthrough lights up what it explains (user: "Highlight the pieces as they're explained. Arrows to indicate stuff will be helpful. Make it perfectly transparent how the game is played. Hand-holding is encouraged here"). chassis/FirstGameTour.jsx: six cards now (TOUR_CARDS welcome, goal, crush, blocks, turn, board; "n of 7", the first turn the 7th), all at the top (at the left 900+ wide), no scrim, the board framed under or beside the card for each (frameTourBoard: the whole board from your side, pitch TOUR_BOARD_PHI 0.45, fill 0.97 of tourRegion with 26 px for labels; the lesson's frameTourPiece unchanged but re-framed after each move; the camera put back once the tour's over unless it ends on a piece of yours picked). What each names is marked: on the board (tour3d into the chassis's new tourGroup, rebuilt on its signature) a ring round each piece (a dark edge, a glow, pulsing where it asks you to look; TOUR_TONES mine yellow #FFD23F, foe red #FF5470, goal green #3FDB7C, dim; not tone-mapped) and the goal row lit (tour-band); over the screen (tour2d, the new TourMarks overlay: a frame hook, three.current.frameHooks, run in the tick before the frame's drawn, positions from tourGeo.rect/center/corners) labels with arrows to what they name, kept off each other, the card and the turn's buttons; a move's arrow on the screen, bowed (one drawn on the board up it was edge on, a stick); a pulsing ring round a button; marching arrows round the board with a fingertip, a finger's way (the near edge follows it) or a mouse's (the far edge follows it: a mouse's drag turns it one way wherever it begins). The steps: welcome (all ten ringed, ASH · YOU / WALNUT · THE COMPUTER); goal (your Cabeza, Walnut's back row lit green, an arrow there); crush (Walnut's Cabeza, CRUSH IT; yours, KEEP IT SAFE); blocks (Turrito, Flaco, Chato, Opa named); turn (the lights at the foot ringed, 2 ACTIONS A TURN); board (the arrows round it); your move (the pieces that can move glow, named; the boxed-in ones dim, "· boxed in", and the card says so); a piece picked (its lesson; an arrow to each square it can reach; after a move with an action left, End turn ringed, OR END YOUR TURN HERE); Walnut's turn ("Watch the board"; then "Walnut moved its Chato.", a red arrow from where it stood, faint ring there, pulsing ring where it is). While a card's up a tap on the board picks nothing and hovering shows no moves (tourCardUpRef in onUp and the hover). The store's tour card and labels in its print (tienda.js). CI on 902711b: e2e-outline, e2e-outside-dismiss and e2e-slide-sounds played Walnut first on Big Glutts' page, where a new player is now Ash and opens: they seed the store's old sides. tests/e2e-first-game-tour.mjs rewritten (57 checks: rings, band, labels on screen and apart, arrows, the counter's and End turn's rings, the orbit's way, no pick under a card, the Flaco rolled by its square then End turn, Walnut's move shown, the camera back).
- The store's last minutes (user, with a screenshot of the store and its cart: "After the 10-minute closing announcement is made, after 5 more minutes, have a new announcement made on every subsequent minute, announcing how many more minutes there are until it closes. And 1 minute before closing, have something show up with the big Glutz logo with the manager, or no, just it's going to say, we're going to have to ask you to leave. Please take all purchases to the front or something like that. I don't know."). themes/tienda-shopping.js StorePA: from the closing PA (PA.closingAt), real minutes (MINUTE_MS; tests __EC_TEST_CLOSING_MINUTE_MS__): at five, four, three and two to go the chime and the caption (LINES "5min".."2min", each its own caption, keyed, a tap takes it to the register as the ten-minute one does); a minute missed while the PA was quiet (a sheet, the clerk) is skipped, the PA saying the minute it is (PA.left). At one: the chime, the lights down another step (setDim(true, 2): rgba 0.5) and ClosingNotice over the store (z 1240, a veil that keeps taps off the store): the store's stripes across the head, the logo as the flyer has it (Caprasimo, loaded if the flyer hasn't), a red CLOSING TIME band, "The store closes in one minute.", "We're going to have to ask you to leave. Please take all purchases to the front registers.", "Thank you for shopping at Big Glutts.", "Take El Cabeza to the register ›" (the purchase) and "Just a minute" (or Escape: put away, the PA says no more), the store's hours at the foot. No manager drawn (the user's "or no"). __TIENDA_SHOP__ gives left and dim2. tests/e2e-store-nudge.mjs: two more runs on a phone (the PA's order instock, closing, 5, 4, 3, 2, the notice; its words, veil, the second dim, all on screen; Just a minute; to the register).
- Other realities asks for a second tap (user: "Hitting the theme switcher button accidentally makes me realize it needs a double tap or countdown timer, too"). The chassis's corner planet (theme.cornerAction: Nova's den after the story, every world's realitiesCorner; data-testid action-corner) now arms on the first tap: lit to full (data-armed "true"), a ring round it running down ACTION_ARM_MS, 3 s (action-corner-ring, a CSS stroke-dashoffset run), and its words beside it, "Tap again: Other realities" ("Click" with a mouse; action-corner-confirm, role status). A second tap inside the 3 s opens the menu; the time running out, a press anywhere else (a capture pointerdown outside [data-ec-arm]) or Escape puts it back to sleep with nothing opened. Chosen over a countdown that goes ahead by itself: a stray tap now does nothing at all. The press reads the armed time from a ref (actionArmedRef), not the render's copy. Nova's phone menu item (shell-menu-realities) and the gate's Other realities are already a second step and unchanged. Tests: under swiftshader two Playwright clicks can land ~5 s apart, past the window, so a test that opens it sets window.__EC_TEST_ARM_MS__ (honoured only with __EC_TEST_HOOKS__) to 30000 first; e2e-gate checks one tap (lit, the words, the ring, no menu), the lapse, a press elsewhere, then two taps (Noir, the City); e2e-ending and e2e-nova-city press twice.
- The switcher stuck over Futuris's sphere (user: "I completed the story, went to the theme switcher, chose Futurus, played for a little bit, went to the sphere menu, hit the icon in the lower left corner to go back to the theme switcher. It went back to the theme switcher, but then it was stuck. It would not scroll like something was on top of it. A transparent layer."). The realities menu (themes/realities.js .ec-realities) was at z-index 1600; in the sphere Futuris raises the chassis's corner column to 2050 (futuris.js cornerControlsZ) over its full-screen layer (singularity-overlay, 2000, taking pointer events, touch-action none), so the corner's Other realities opened the menu under that layer: seen through it, every tap and scroll going to the sphere. Now 2600: above the sphere's layers (to 2300) and the rules cards (2500), under the story's cut (3000); the sphere's BACK and the corner are under it. Escape or You are here puts it away onto the sphere, working; a world picked cuts there. The sphere is reached only from the pre-game setup (Custom rules, or five title taps), so after a game: End active game, New Game, Custom rules. tests/e2e-realities-over-sphere.mjs (new, last in run-e2e): Nova after the story, the switcher, Futuris, a game, ended, New Game, Custom rules, the invite, the sphere; two taps on the corner: the menu above the sphere's layer, the switcher under its middle, the corner and BACK, the wheel scrolls it; Escape: the sphere takes taps again; again, the den picked: the den, the sphere gone.
