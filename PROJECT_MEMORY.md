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
  round's first line, part by part (01 is the oldest, 16 the newest, up
  to the scream and hall-pull options, set 5 in the game, two GitHub
  flakes found (the dock's hop, the songs' count) and the glass towers
  and cranes).

## Recent rounds

- The I-beam frame (user: "Partially constructed I-beam structure skeleton
  can be in one of the blank game board squares as City flavor"): scratch
  city/ lotMap forces board.frames to "frame"; lotRelief's frame branch is
  a steel I-section skeleton (flange 0.024, web 0.006, #8e4a36 primer, a
  concrete deck #bcbab4, a hoarding, a bundle of beams). vg1-vg5 carry one;
  close-up vgf. The review page (artifact DBmVxjLHatrNiebqgkbmPt) has it
  from version 2.
- The corner menu (#183-186; user: "move forward with the corner menus as
  illustrated in the mockups", option 1's sheets): the game's rules at the
  top left in every world, each in its own look.
  - chassis/corner-menu.js: gameRules(pieces, missing, holes) reads the
    engine (ACTIVE_LAWS, BOARD_ROWS/COLS) and the board: the laws as the
    menus name them, with Shoving's two settings and Split movement's
    pieces and actions; each side's pieces as the game began (the first
    turn's snapshot; the most either side has), marked where they differ
    from the standard five; the board (cols x rows, as the order forms
    write it), missing pairs, black holes; a plain summary line. LOOKS has
    the mock-ups' ten looks (parrish-watermark is orinoco's CSS
    recoloured). cornerMenuParts(look, rules, extra): tab, card, CSS.
  - chassis/CornerMenu.jsx: the tab (closed, 0.82) and the card; a tap
    opens it; a press outside, Escape or the tab closes it. A law opens
    its MOVES card, "Rules" the "game" tab (Quick where a theme hides it:
    the den, the store). The dock's open and close sounds. Each look's
    fonts linked once.
  - Chassis: rulesNow each render, also game.rules for a theme's own
    read-out. Shown while playing (not awaiting Begin, not through the
    Singularity, not noGame); theme.cornerMenu is a look's name or a
    function of the setup extras (a name, {look, extra}, or null). Hidden
    with the points in the story's scenes. The closed tab steps aside
    (opacity 0) where the check alert's card (<= 1000 px wide) or its chip
    (<= 680 px) would sit over it.
  - Themes: standard "den", neon, lluvia, cromo, plano, luna, noir; parrish
    by lookName(). tienda: none in the store before it's bought (Nova's
    story: its shop corner is up then), "store" with the purchase on the
    slip after (not when the clerk's confused), "store" on its own page.
  - Retired: Neon's Current Variants flyout (and MobileShell's CSS for it)
    and the store's in-game OrderSlip. The currentVariants snapshot stays
    (the New Game card's line, Plain rules, replays).
  - The Lab: no menu; its read-out (themes/lab/hud.js LabRules) gains a
    Rules line in play and the list when brought up, in the stats' own
    colours. The list scrolls within the room left on the screen (Bauhaus
    ran off an 800 px screen). On a phone it's backed by the page's ground
    in the direction's frame; Minimal Mono's and New Typography's narrow
    columns give it 300 px (NARROW_RULES). Brought up by the mouse it now
    stays while the mouse is on it (it went down after 8 s regardless,
    under the cursor); by a tap, it goes down after 12 s, begun again by
    a press inside it. In the corner it now scales from its top left
    (transform-origin 0 0 while compact): the list made it taller, and
    scaled about its middle its top dropped from under a still mouse,
    which closed it, every 120 ms or so (a law couldn't be clicked).
    Where the read-out is a strip (narrow or short screens) the rules are
    at most 420 px wide.
  - User, of the Lab's red counts: "Why are some of these numbers in red?
    What's the point of it?" The colour marks a count not as in the
    standard game (one each of the first five), but only the worlds' cards
    said so. Now the Lab's changed counts carry "*" and a key line
    ("* Differs from the standard game", only when one does), since a
    colour alone is lost in Brutalism and Minimal Mono (accent = ink); and
    Plano's card notes its revision triangle ("revised from the standard
    set").
  - Tests: e2e-corner-menu (new: every world, a plain game, game over, the
    Lab, Nova's store after the story). e2e-tienda, e2e-outside-dismiss,
    e2e-nova-mobile, e2e-store-nudge and e2e-story moved to the menu.
    Screens: scratch cornermenu/shoot-real.mjs (real/), every world on a
    desktop and a phone, the phone bar layout too.
- Swiss Design's black pieces edged (user: "Swiss Design black / dark
  pieces need edging to help define their form similar to Mono"): lab
  specs.js swiss pieces.edges { dark: 0xf2f2ef } (the white pieces' own
  white; scene.js paints the fillet, the Cabeza gets its rim rings). The
  line is thinner than Mono's (fillet 0.018 to its 0.03), crisp, Swiss.
- A rejected tool call stops that call, not the round. Its stock note
  ("STOP what you are doing and wait for the user...") came when the user
  turned down a long blocking wait for a test; it was taken as a hold on
  committing and pushing, twice, against the stop hook (user: "What did I
  tell you to stop & wait on?"). Carry on with the standing routine, and
  don't block on long waits: background them.
