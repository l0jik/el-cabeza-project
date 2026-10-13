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

## Open reminders (from the user; not done yet)

- **A disclaimer on the site** (user, 2026-10-08: "we need to have some
  sort of disclaimer on the site or something like this: 'This is an
  unofficial, non-commercial implementation and is not affiliated with
  or endorsed by them.'"). Still to settle with the user: who "them" is
  named as, and where it shows (every page, e.g. a small line at the
  foot, an about panel, the first screen). 2026-10-11 the user asked for
  ideas: options given in chat (a one-line footer, an About paragraph, a
  full Notices section, in-world variants; placement; the "Orinoco Flow"
  clips flagged). Waiting on the user's pick. Then the user asked how
  rights work given how far the game's been augmented ("essentially
  created a new game"). Answered as general information, not legal
  advice:
  - Game mechanics, names and titles aren't copyrightable (USCO FL-108;
    Argentina draws the same idea/expression line). The original's rules
    are free to implement; the 1987 article's text and art are not free
    to copy.
  - The user owns their own expression, but not the new mechanics
    (patents only; US 1-year grace after their own disclosure).
  - AI-generated parts may not be protected: human authorship is
    required (Thaler v. Perlmutter, D.C. Cir. 2025; cert denied 2
    March 2026).
  - Suggested its own name (e.g. Cabeza Nova), "based on El Cabeza by
    Poniachik and Lindenbaum", a © line, and a licence choice for the
    repo.
  - Still needing permission: the "Orinoco Flow" clips, and the people
    in their videos (for commercial use).

## Topics (`docs/memory/`)

- [01-what-this-is.md](docs/memory/01-what-this-is.md): What the game and the code are, in one paragraph
- [02-build-and-verification.md](docs/memory/02-build-and-verification.md): Build (esbuild, one page per world) and how changes are verified
- [03-game-ai.md](docs/memory/03-game-ai.md): The computer opponent: search, evaluation, difficulties
- [03b-board-dimensions.md](docs/memory/03b-board-dimensions.md): Board size as a runtime parameter (TOPOLOGIES groundwork)
- [03c-singularity-transition.md](docs/memory/03c-singularity-transition.md): Neon's Singularity cinematic transition
- [03d-sphere-menu.md](docs/memory/03d-sphere-menu.md): The MATTER / LAWS / TOPOLOGIES sphere menu
- [04-performance-done.md](docs/memory/04-performance-done.md): Performance work already done (don't undo without reason)
- [05-camera-input.md](docs/memory/05-camera-input.md): Camera and input: fragile, verify rigorously if touched
- [06-dock-piece-preview.md](docs/memory/06-dock-piece-preview.md): The dock's spinning piece preview
- [07-rendering-standard-vs-neon.md](docs/memory/07-rendering-standard-vs-neon.md): Standard vs Neon piece rendering techniques
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
- [tienda-singularity.md](docs/memory/tienda-singularity.md): Tienda: Neon's Singularity in the store's terms
- [theme-lab.md](docs/memory/theme-lab.md): Theme Lab: ten design directions
- [nova-on-phones.md](docs/memory/nova-on-phones.md): Nova on phones: the phone layout (MobileShell)
- [nova-story.md](docs/memory/nova-story.md): Nova's story: the store, home, and the TV into Singularity

## History (`docs/memory/history/`)

- [history/README.md](docs/memory/history/README.md): the index, every
  round's first line, part by part (01 is the oldest, 18 the newest, up
  to Ciudad as a world: its times of day, lots and cranes, the city's
  recorded sound by the hour, the Cabeza options and the ten rotundas;
  the corner piece turning about its middle in every world; Hold to end;
  the freesound probes).

## Recent rounds

- The City's Cabeza is the glass dome (user: "The cabeza for city maps
  themes will be number 6, glass dome. Although make the glass dome
  slightly larger, the diameter. Do not increase the height... Give it a
  third less rib supports"): CABEZA_PLAYED "glassdome" in
  ciudad-cabezas.js (?cabeza=<id> still plays any of the 21). Its dome
  0.46 across where it was 0.4, as tall (0.2: k = dh / dr, the rings at
  the heights they were, the ramps following the wider glass), on 16
  ribs where it had 24. Measured on the board: 0.40 -> 0.46 across, 0.197
  tall both. __CIUDAD__.cabeza() says which is played; e2e-ciudad-cabezas
  checks it's the glass dome. Before/now sheets: scratch glassdome/
  (shoot.mjs, sheet.py; the old build from a worktree of the commit
  before). "City maps" is the user's name for the City (first asked as
  "What is the Cabeza piece for the city maps supposed to be?"); Plano
  keeps its own drawn rotunda.
- Shoving's pieces choice for every shove (user, the Cabeza Nova menu:
  "All pieces or only opponents buttons should be available for [slides]
  only as well in all relevant instances throughout all themes. This
  should be written into the chassis"; asked: Slides only too, one choice
  for slides and rolls): chassis/shove-settings.js holds both settings
  ("Shoves on": Slides and rolls / Slides only; "Shoves push": All pieces
  / Only opponents'), their words (the line under them, the summary, the
  corner menu's) and the reading of old saves. The engine's
  ACTIVE_LAWS.shoveOwn (was shoveOwnOnRolls) is checked in tryShove, so a
  slide's shove and a roll's alike; selections keep shove.own (an old
  ownOnRolls is read); replay codes keep o: 0. Every menu shows the choice
  with Slides only now: the gate menus and the store (shoveShown), Neon's
  sphere (shove-own-on|off), Lluvia (lluvia-shove-own-on|off). Tests:
  engine.smoke (slides into your own blocked, theirs pushed, slides only
  too, no X for a diagonal into your own), rules-selections.smoke,
  replay.smoke, e2e-shoving 2d (in play), e2e-gate, e2e-singularity,
  e2e-tienda, e2e-lluvia, e2e-corner-menu ("Shoves push: Only
  opponents'").
- e2e-hold-to-end's short press and drag (CI run 47, the City): on a
  loaded machine the lift or the drag's first move reached the page after
  the 0.65 s, so the page saw a held press and the turn ended. Those two
  checks now hold 4 s (__EC_TEST_HOLD_MS__) and wait it out; the held
  check keeps the real 0.65 s. Shown (scratch holdci/repro.mjs): the drag
  sent 0.8 s late ends the turn at 0.65 s, not at 4 s; the CPU slowed 6x
  alone doesn't (a move queued before the hold's frame still wins).
- The Cabeza's moves make no tap, roll or landing sound in any world
  (user: "Kubase [Cabeza] pieces should not have a tap or falling tone, as
  they are only slid ... Anytime like there is a wood tone on a Cabeza
  being moved, that needs to be removed ... the cabeza piece should not
  make a rolling tap noise when it moves"; "Kubase" is how their
  dictation hears "Cabeza"). The chassis's slidesOnly (the disc shape):
  animateStep plays the world's audio.playSlide(units, SLIDE_MS) if it has
  one, never playRollStart; the move's commit and an undone black-hole
  step skip playLanding. playSlide is the one optional audio method
  (ARCHITECTURE.md): wood-sfx.js slide() (an even glide over the lacquer,
  nothing struck) in the den and the store; the City, Noir, Luna, Plano
  and Cromo use their roll's glide (playSlide: playRollStart); Lluvia a
  softer whoosh; the Lab (its looks' roll sounds are blips), Neon and
  Parrish have none, so the Cabeza is silent there. Then slid blocks the
  same way (user: "make slid blocks glide quietly too"): the chassis's
  slides(piece, dir) is the Cabeza or a slide key, so any slide plays
  playSlide and never lands (move.isSlide at the commit; an undone
  black-hole slide too). window.__EC_TEST_MOVE_SOUNDS__ (a test's array)
  gets { kind, id, type, played } per sound asked for. Tests:
  e2e-slide-sounds (the den, the store, the City, Neon, the Lab, with
  Orthogonal slide and 3 actions: a Turrito's roll starts and lands, its
  slide only glides, one knock; either side's Cabeza only slides, no
  knock), e2e-wood-sounds renders the slide (soft in its first 20 ms
  where a landing is loudest).
- e2e-singularity's triple tap on the bare sphere (CI run 49, shard 1):
  three taps count within 650 ms as the page takes them, and on a loaded
  machine the sphere's slow frames spread three clicks sent 120 ms apart
  past it (stage stayed "labels"; run 48 and local runs passed the same
  code). It now taps three times again, up to three tries, and says how
  many it took.
- The City, named and in the switcher (user: "Name = The City / Side names
  are fine. / Do theme switcher entry"): realityName "The City" (the info
  panel's This game), the tab "El Cabeza · The City"; its page, files and
  ids keep "ciudad" (el-cabeza-ciudad.html). realities.js WORLDS: { id:
  "ciudad", name: "The City", line: "Glass towers and cranes, alive at the
  hour you pick." } after Noir; its card picture made by
  tools/channel_shots.mjs at Golden Hour (assets/den/channels/ciudad.jpg,
  in build.js's channel list), so the den's TV shows it too. Slate and
  Chalk stay. Tests: e2e-gate "The City, in the switcher" (card, picture,
  page, gate look, title, last world, You are here), e2e-ending's 21
  realities.
- Set out by hand (user: "a toggle(?) / way to manually place pieces
  before the start of a match"; of the five mock-ups, "Drag, or tap then
  tap", "Back three rows", two players "Mirrored", extras "Same as last
  time"). engine/placement.js is the rules (pure; tests/placement.smoke
  in npm run test:engine): zoneRows (the back three, or with half up to
  the middle; an odd middle row is nobody's), mirrorOf (180°, vox too),
  fitsZone (rows, board, nothing missing or a hole under it or under its
  mirror), startSetOut (the other side made the setting side's mirror),
  place (what it lands on of yours swaps into the squares it left if it
  fits inside them, nearest where it stood, as the mock-ups' shared rule
  "Swap when it fits"; else the bench, as the chosen option and the user's
  first words said), putBack, turn (PIECE_ORIENTATIONS' next pose, kept in
  the rows), setHalf, readiness (bench empty, and cabezaInDanger for
  neither side), keep/canRestore/restore (Same as last time, as Dark by
  name, for the same roster and board). chassis/set-out.js: the kept
  choices (el-cabeza:start-position "hand", el-cabeza:set-out-half,
  el-cabeza:set-out-last), benchSpots (a row past the setting side's
  board edge), setOutCorners (the camera's fit), nearestAnchor/
  freeAnchors/anchorOnto, buildSetOutMarks (the rows washed and dashed,
  "Your rows", the bench tray, the chosen piece's edge, a dot where each
  free placing's middle would be, the drag's landing squares, red rings;
  edges drawn over the pieces, depthTest off), keepSame (unmoved pieces
  keep their objects, so only moved meshes rebuild). The chassis: the
  dock's Start row (Standard / By hand, and Anywhere in my half) and the
  phone bar's Start / Pieces in; with By hand, "Set out my pieces"; every
  begin from a menu goes through beginOrSetOut (the dock, the bar, the
  setup extras' triggerBeginGame, so beginCustomGame and Neon's sphere,
  and the reality gate's api); a replay and the den's story begin don't.
  It waits a render (setOutPending) so a menu's setPieces is in. While
  setting out: the dock, its piece, the title and the phone's bars aside;
  the banner (the check card's look; "Before the game · Set out by hand",
  what to do now, Begin, "n on the bench"; Undo, Put it back, Turn,
  Standard, Same as last time, the half switch, Back; on a narrow screen
  the buttons in a bar along the bottom); the camera (frameSetOut: from
  the setting side, pitch 0.42, the board and bench fitted under the
  banner and above the bar, centred by target.y as the setup's fit does;
  refit on resize; Back puts it and the dock back). The board's pointer
  hands presses to setOutPointerRef first: a press on one of yours (or a
  bench piece, benchGroup, kind bench-piece) is the set-out's (a drag
  carries its meshes, lifted, the landing lit; a tap chooses; the chosen
  one again turns it; another of yours with one chosen sets it there);
  a tap elsewhere sets the chosen piece on the nearest free dot (within
  0.75 of a square) or lets go. Keys: arrows (by the screen's way), Enter,
  R, Escape. The side: you against the computer; two players, the side to
  move. Begin: readiness, else the banner says why (bench: the piece
  chosen; danger: cabezaThreats' Cabezas and attackers ringed); then
  saveLastSetOut, triggerBeginGame; the record's start is the first
  turn's board, so replays begin from the set-out. measureBoxPx now
  reports its box's edges too. Test hooks: __EC_TEST_SET_OUT__,
  __EC_TEST_SQUARE_POS__, __EC_TEST_BENCH_POS__, __EC_TEST_NEW_GAME__,
  __EC_TEST_REPLAY_START__. tests/e2e-set-out.mjs (the den step by step,
  against the computer, the gate's Standard Cabeza, every world, a phone).
  dock-helpers' openDockPanel no longer clicks again once the panel's
  open, and waits 2.5 s a try: its second click could land on the panel
  (the Start row now sits where the piece was). A test's seeding mark
  belongs in localStorage: sessionStorage isn't always back in time on a
  file: page's reload, and the clear then wiped what was saved.
