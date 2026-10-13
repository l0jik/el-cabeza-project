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
  round's first line, part by part (01 is the oldest, 17 the newest, up
  to the corner menu in every world, the I-beam frame, Watermark's one
  song at a time, 10 PM's lights by plan and its loops, the cranes' rule,
  the placement mock-ups and the city's Cabeza).

## Recent rounds

- Ciudad, a new world: the city of the glass towers and cranes, playable,
  at the time of day the player picks (user: "implement city as it
  currently is. Maybe just have a toggle switch to switch between the
  different times of day. It's all essentially the same map ... they can
  basically play in that city and change the time of day"). Page
  el-cabeza-ciudad.html (apps/ciudad.jsx, build target "ciudad", landing
  page link); NOT in the theme switcher (realities.js WORLDS) until the
  user says, as Noir was. Name "Ciudad" and the sides "Slate" (dark) and
  "Chalk" (light) are my picks, put to the user. Gate look, points glow
  (an office's cool light, a home's warm one), corner-menu look "ciudad"
  (a street's name sign: white on #2F4458, a white rule inside the edge,
  Overpass, the road signs' face; changed counts in the cranes' yellow).
  - themes/ciudad-models.js: BUILD.midvar ported (the five models from the
    id, hashed with SEED 265 so the standard five of each side differ and
    each kind differs across the board; white and grey-blue families; the
    1x3 always the glass tower, lying down a glass hall; odd pieces as
    columns of facade, faces against a neighbour left out; the Cabeza the
    pavilion). A building's walls are one atlas canvas (every face of every
    box, a row a box) and one material: one draw; plain parts merged by
    material. Windows by plan in the shader (PLAN_GLSL cityPlan, per
    window from aWin (the window across its face, the floor from the top,
    the face, the face's windows) and aSeed): offices by the floor (whole
    or a run at one end, a desk or two), homes by the flat (2-3 windows,
    the same flats up the building, a room or two lit, a TV's blue), a
    stair; one building in eight dark (not pieces: uNoDark). flick(): 12%
    of office floors and 15% of flats ever switch, each its own period
    (90-300 s), over for 15% of it. The light a^2.2 (as drawn on black on
    an sRGB canvas). shade() copies the scratch's (linear, hex read back)
    so the walls match the stills. GLSL: `flat` is reserved (WebGL2): the
    first build threw on it.
  - themes/ciudad-time.js: the five times (Morning, Afternoon, Golden Hour,
    Overcast from vv1-vv4; 10 PM from TEN_PM): sky (4 stops), haze, sun
    (colour, strength, direction as the first view sees it), hemisphere,
    exposure, night 0/1. NOW eases over 2.4 s (the windows come on behind
    the dark, go out ahead of the dawn). Kept in localStorage
    (elcabeza.ciudad.time); ?time=morning|afternoon|golden|overcast|night.
    Test hook __CIUDAD_TIME__ (get, set).
  - themes/ciudad-hud.js: the switch (renderExtraOverlays): a street sign
    at the top right, 78 px down (under the masthead in play), the hour's
    icon and name; a tap opens the five with their clocks; Escape or a tap
    outside closes. Phones (<= 560 px): the icon alone, 46 px down; so
    Morning and Golden Hour are a sunrise and a sunset (an arrow up, an
    arrow down over the sun on the horizon), as they looked alike.
  - themes/ciudad-fx.js: the sky dome (gradient top to horizon, the sun's
    glow and disc, cloud wisps, a deck when overcast), the haze, the key
    light as the sun turned with the board (as Luna's, Noir's), hemisphere
    and exposure set when NOW changes, an env map per hour (PMREM of the
    hour's sky, swapped half way through a change) for the glass,
    sRGB output. A pool of light under the piece picked up; dust where a
    building lands.
  - themes/ciudad.js: the board as the district (streets on every grid
    line, kerbed blocks in flags, crossings, a crossing's stripes on each
    goal row's street, letters and numbers in road paint); the slab darker
    by night (x0.3) with the lamps' pools glowing then. BOARD_PAINT: the
    board's canvas for the lots to be painted on, a block made plain again.
    Move markers a parking bay's white line (a crush a box junction in the
    cranes' yellow), unlit so they read at night. Dock words: Street /
    Aerial / Skyline, Call it a day, Break ground, City record, Zoning code,
    Ribbon cut.
  - themes/ciudad-lots.js: laid out when a game is set out (a signature of
    the pieces while awaitingBegin): about half the free blocks a lot
    (park, lawn, plaza, subway, court, building site), the two cranes on
    farSites (the free squares farthest from every piece, apart), heights
    5.6-7.0 and 4.0-5.2, the steel frame on the next farthest. A lot a
    piece's block has covered for 420 ms is taken (its crane, its trees,
    its paint). A crane swings its jib now and then (7 s, every 25-60 s;
    the shadows are drawn again only then). Night: beacons, a lit cab,
    the frame's bulbs and a welder.
  - themes/ciudad-city.js: a street just off each edge, then a 2.92 grid
    of blocks out to 46: by the board parks, plazas, car parks and low
    buildings; out from there blocks of 1-3 buildings in the four styles
    (one geometry and material a style and variant, windows by plan,
    dissolving out of the camera's way as Noir's); walls x0.62 and roofs
    x0.42 at night; parks' trees instanced; lamps (posts instanced, heads
    one Points). roofAt for the camera.
  - themes/ciudad-life.js: Plano's lanes: cars and buses both ways on every
    street within 22, bikes, people on the pavements; on the board a lane
    each way down about half the lines, its cars gone where a building
    stands across the street and while a building moves; people at the
    free blocks' corners, gone when the block is taken. Lamps at night (two
    Points draws). Nothing casts a shadow.
  - themes/ciudad-audio.js: made, not recorded (a first version): the
    city's roar, cars going by, birds (most in the morning), the sites'
    clanks, a crossing's beeps, wind when overcast, at night a siren far
    off and footsteps; cues: a crossing button, a horn, hydraulics, a
    footing landing, a demolition, a ribbon-cut chord and cheer, a lift.
  - Measured (desktop, in play, morning): 179 draw calls, 196k triangles.
  - Tests: e2e-ciudad (the switch, kept, ?time=, night lit and darker, the
    lots, the cranes' rule, the streets; the night noted in the page while
    it eases: on the software renderer a click outlasts the change),
    e2e-smoke ciudad, e2e-gameplay ciudad (Slate, Chalk), e2e-corner-menu
    (the ciudad look), e2e-dock-moments (its words) and e2e-touch-in-game
    (Neon's turn and tilt; Noir is still not in that list).
