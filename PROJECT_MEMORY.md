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
- The city's Cabeza, the ten built (user: "Show me the 10 options for the
  city's cabeza"): themes/ciudad-cabezas.js CABEZAS, the pavilion (still
  the one played) and rotunda, bandstand, carousel, head (a sphere pushed
  into a head: nose, brow, eyes, lips, chin, ears; Chalk's white stone,
  Slate's grey-blue bronze; a fountain of six jets), planetarium, kiosk
  (its four faces tell the city's hour: CLOCKS redrawn on onTimeChange),
  roundabout, watertower, subway, stadium. ?cabeza=<id> plays with one,
  until the user picks. Each side's faces the other's: the models face +z,
  the light side's in a group turned round (ciudad.js zeroes the building's
  own rotation). The hit cylinder is as tall as the Cabeza (userData.top).
  R comes from the engine's constants: ciudad-models.js imports this
  module, so a value of its read as this one loads isn't there yet (R was
  NaN and every part sized by it went missing). rodGeo: r128 geometry has
  no applyQuaternion. The carousel's horses turn in their mesh's
  onBeforeRender. Sheets: scratch cabezas/shoot.mjs, sheet.py (each
  option, the two side by side, morning and 10 PM).
- Ciudad's time switch a clock (user: "Maybe the time of day switch can be
  a clock"): ciudad-hud.js. The sign a street clock, its hands at the
  hour's time; open, a dial with the five hours where the hour hand points
  then (marks with their pictures) and the name and time under it. A pick
  sweeps the hands forward with the light (handsNow from NOW.k; one rAF
  loop for every face drawn) and the dial stays until a tap outside or
  Escape. The face lit warm at night. e2e-ciudad: the hands at ten after
  10 PM on the dial and the sign; Escape puts the dial away.
- The first change to 10 PM (e2e-ciudad, locally: no night part way seen):
  a Ciudad frame takes 0.5-0.7 s on the software renderer, the change is
  drawn in three or four, and the test's timer samples starve between such
  frames. It now reads window.__CIUDAD_TRACE__ (the night as each frame
  draws it). And the change no longer compiles as it starts (4 programs,
  measured): warmUp in ciudad-fx (renderer.compile once the city's up, the
  night-only materials too; each hour's env map made in idle time) and one
  PMREMGenerator kept (made new each time, its blur compiled again).
- GitHub run 43 shard 2 (e2e-dock-call, Watermark: no call after a game,
  the dock open). A piece sliding into its corner under the mouse at rest
  on Begin Game counted as a hover (the browser reports it entering; on a
  slow machine the leaving more than 0.5 s later) and opened the dock.
  Now a hover counts only once the mouse has moved since the piece took
  its corner (chassis cornerRestRef, set in a layout effect, cleared on
  the first real move away; dockHoverMoved for a move over the piece).
  e2e-dock-call: the mouse parked where the corner piece lands, Begin
  pressed without moving it (dispatchEvent): the dock stays shut (the old
  code opened it every time); then a few pixels' move, still on the
  piece, opens it (dockHoverMoved: restEnterRef, set only by an entering
  set aside, cleared by a press or the mouse leaving, so a move after
  spinning the piece starts nothing, as ever).
- City sounds from recordings (user: "go online and find like city
  sounds ... appropriate for each time"): freesound refused in this
  session (403 for the site and its CDN; Wikimedia, archive.org, Pixabay,
  the BBC's not reachable). Picked from its pages (WebFetch): morning
  RHumphries 2536 "rbh morning birds 01" (CC BY 4.0, 5 am Washington,
  birds and distant traffic), afternoon mzui 135095 (CC0, busy London
  street) or felix.blume 705049 (CC0, a small city from a rooftop), golden
  hour SpliceSound 369891 (CC0, a Brooklyn rooftop at evening, the M
  train), overcast BlindRainGames 396049 (CC0, a small city, wind in the
  trees, birds, cars), 10 PM puppetmaster685719 641211 (CC0, the city at
  night, traffic, a dog now and then). Not: klankbeeld (no stock use),
  Fonoport ("not for resale"), lwdickens (non-commercial). Waiting for the
  user to allow freesound.org and cdn.freesound.org.
- The end-turn warning (user: a second tap on a piece ends the turn with
  actions left; "give me some options"): chassis ElCabeza3D.jsx, the tap
  (turnLocked && hit.id === selectedId -> handleStopHere) and the queued
  "stop" intent (a tap on the square the piece is moving to, mid-move: a
  quick double click on a move marker ends the turn, likely the commonest
  accident); endTurnAsk asks only for the End turn button, in a first
  game. Whichever is picked: a second click within half a second of the
  move counts as the same click. Five ways mocked up over the real game
  (Standard, desktop and phone, scratch endturn/mock.mjs): A the dialog in
  the middle, B a bubble at the piece (recommended), C the turn bar asks,
  D hold to end, E tap again to confirm; review page "Ending a Turn
  Early". Waiting on the user.
  Published: https://claude.ai/artifact/S7GgzbhAyBgZ8U8Dec2RRd
- The dock piece turns about its own middle (user, Ciudad: "rotating such
  that it is attached to the exterior of a sphere, whereas the center of
  gravity should be the center of the piece itself"). The worlds that
  build pieces up from the street (Ciudad, Noir, Luna: mesh at y, the
  building at -y) stood the dock model on the pivot, and the dock's idle
  tumble (x, y and z) swung its middle round it: measured 50%, 50%, 33%
  of their size off, the others within 2%. Chassis drawnMiddle (the box of
  what's drawn, hidden hit shapes left out) brings the middle to the pivot
  before the depth pre-pass, as reality-gate's lookModel does; every world
  now 0%. e2e-smoke checks it in every world it runs (under 5%; the old
  code failed it, Ciudad 11% with a short piece).
- City sounds from real recordings (user: "go out onto the other resources
  and find real sounds, not synthesized for the city"). From this session
  only GitHub (raw, codeload), npm, PyPI, GitLab, Bitbucket, Launchpad and
  archive.ubuntu.com answer; freesound, Wikimedia, archive.org, Pixabay,
  soundbible are refused or unreachable. So: recordings carried by
  open-source projects with their sources listed, each licence checked on
  its freesound page (WebFetch reads those): the Scaper library's test
  sounds (tests/data/audio/background, named by freesound id) and the
  Blanket app's (data/resources/sounds, SOUNDS_LICENSING.md). Moodist's
  urban sounds (Pixabay licence or CC0, which not said per sound) left
  aside. assets/ciudad/src + CREDITS.md; tools/ciudad_sounds.py makes one
  seamless stereo loop an hour (layers looped on their own, summed): morning
  the Tel Aviv park (yonts CC0, its first 46 s) + wood thrush (kvgarlic
  CC0, its 4836 Hz insect drone notched) + NYC traffic dulled
  (gezortenplotz CC BY 3.0); afternoon Szczecin street scene 3 (saphe CC BY
  4.0) + NYC + Gandia voices (jormarp CC0); golden Gandia (recorded ~19h) +
  street 3 dulled + thrush far; overcast street scene 1 (saphe: tools,
  cars, a tram) + felix.blume wind (CC0) + NYC; night NYC dulled to 600 Hz
  + park + crickets (Lisa Redfern, PD) + restaurant (stephan, PD). Mono
  sources widened by a random-phase all-pass twin round the loop (a
  seconds-long offset, as Noir's rain, put the tram through twice).
  ciudad-audio: the hour's loop fetched (beside the page, build.js files)
  and crossfaded over 2.4 s as the hour changes; from disk the made city
  stands in. soundCredits on the About card. e2e-ciudad-sound (served over
  http, as Noir's).
  Level: BED_GAIN 0.16 on the city channel (made city measured -37.8 dBFS
  afternoon, -43.5 at 10 PM; the recordings within a dB under; scratch
  citysounds/calibrate.mjs, cityLevel() an analyser on the channel).
- GitHub run 45 shard 1 (e2e-singularity, the CONFIGURATIONS panel): its
  reopening tapped the label once, at once; bringConfigLabelToFront
  returns as the label faces you while the sphere's tilt can still coast,
  and on the slow renderer the tap fell where the label had been, so Load
  was waited for in a panel that never opened. Not reproduced here (143
  ok). openConfigurations(): label round, waitForTiltSettle, its place read
  again, tapped, the panel waited for, up to 4 times; for the Load and the
  Delete reopenings.
- Freesound, re-probed 13 Oct 17:01 UTC (user: "I already did this,
  yesterday"): the environment change took (the CONNECT to freesound.org
  and cdn.freesound.org now opens; on 11 Oct it was refused at the gate),
  but freesound itself answers every request from this machine with an
  empty 403, robots.txt and the API included (as sites do to cloud
  addresses). Nothing more to set; files would have to come from the user.
- Corner piece, every world (user: "I think the lunar one also has the
  same issue"): the dock picks one of five pieces and a side at random a
  visit, so the earlier check saw one. __EC_TEST_DOCK__().show(type, side)
  (test hook) puts any in it; all 13 pages x 5 types x 2 sides measure at
  most 0.7% (Luna's), and frames of each world's tumble (scratch
  dockpivot2: frames.mjs, allsheet.py) show it turning about its middle.
  e2e-smoke now measures all ten in every world it runs.
- City Hall rotunda, ten more (user: "Give me 10 different City Hall
  Rotunda Cabeza Piece design options"): themes/ciudad-rotundas.js
  (tempietto, pantheon, capitol, palladian, openrotunda, glassdome, deco,
  concrete, greenroof, saucer), listed after the rotunda; the shared tools
  moved to ciudad-cabeza-kit.js. The list is made when first asked for
  (cabezas()): the rotundas' module is in the models' import cycle. Still
  the pavilion by default; ?cabeza=<id> plays one. Sheets: scratch
  rotundas/ (shoot.mjs, sheet.py). e2e-ciudad-cabezas builds all 21 for
  both sides (inside the square, on the pavilion's ground, under 0.8 tall;
  __CIUDAD__.cabezas()).
- Hold to end (user: "Let's go with solution D", the end-turn page): with
  actions left, a tap on the piece that's moved no longer ends the turn; it
  says "A tap keeps your turn going (N actions left). Hold the piece to end
  it." (hold-to-end-hint). A press held on it 0.65 s ends the turn: a ring
  round the piece's middle fills, "Keep holding to end your turn" under it
  (hold-to-end); moving more than the drag dead zone, a second finger, a
  pointercancel or letting go first cancels; the lift after it's no tap.
  Its time up, it ends at the next frame (Chrome hands pointer moves over
  a frame at a time: on the slow renderer the timer beat a drag's first
  move). While the piece is still rolling, a press on the square it's
  going to holds the same way (ends as it lands); a tap there gives the
  note once it's landed, none within 0.5 s of the tap that set it moving
  (the double click on a marker that ended turns by accident). The End
  turn button is as it was. Switch "Hold to end" in the dock in play and
  "Hold to end a turn" in the phone menu (el-cabeza:hold-to-end, on unless
  "0"); off, a tap ends the turn as before. Rules text: "hold the piece you
  moved, or press End turn". __EC_TEST_HOLD_MS__ lengthens it for
  pictures. e2e-hold-to-end (Standard, the City, the den's phone bar);
  e2e-lab now holds where it tapped.
