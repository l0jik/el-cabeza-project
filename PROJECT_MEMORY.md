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
  foot, an about panel, the first screen).
- **Lab: "after a win the minimized menu cannot be raised / maximized"**
  (user, 2026-10-10). Not reproduced (the round note under Recent rounds,
  "Lab, after a win..."). Parked by the user 2026-10-11: "Forget about
  the lab menu bug for the time being. Just remind." So: don't ask about
  it in every reply; remind now and then. To pick it up: which Lab
  direction, which device, what was tapped (a screenshot or a video).

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
  round's first line, part by part (01 is the oldest, 12 the newest, up
  to the efficiency fixes).

## Recent rounds

- Back to Cabeza Nova (user: after a game ended in a gated world (Cromo,
  everything unlocked) and Standard Cabeza was picked, "there's no way to
  go back, while still in that theme, to return to Cabeza Nova"). A plain
  game in a world with the gate, once the story's over, now has a "Cabeza
  Nova" link: in the dock after the game (data-testid nova-again), on the
  setup before the next one (nova-again-setup), and in the phone's menu
  (shell-menu-nova-again). It opens the gate's sheet at Nova (the board
  set up: every piece, rule and board), its Back to the two buttons. A
  Nova game already had its way out (the plain-rules link). e2e-gate.mjs
  covers it (Cromo: Standard, the game ended, the link, the sheet, Back,
  Standard again, the setup's link; and Nova's phone bar, ?world=neon:
  not in the menu during the game, there once it's over, and it opens
  the sheet). Only Nova's page has the phone bar (apps/unified.jsx); the
  other worlds' pages use the dock and its links.
- Lab, "after a win the minimized menu cannot be raised / maximized"
  (user): not reproduced. Tried (scratch labwin/): all ten directions on
  a phone and a desktop, the live build too: after a win, the placard
  put away, a tap on the dock's corner piece opens the panel and a tap
  on the board brings the placard back; also against the computer, via
  the placard's Move Log, with the HUD tapped open as the game was won,
  and the next game's small HUD opens on a tap. Asked the user which
  direction, which device and what they tapped.
- Noir's streets and cars (user: "Can the grid of Noir be made to look
  like city streets appropriate to the time / theme / setting?
  Occasionally have a post-war sedan or coupe, most notably 4-door sedans
  and low-slung coupes produced by American manufacturers like Ford,
  Buick, Cadillac, Chevrolet, and Chrysler between 1935 and 1950"). Noir
  itself: history/10.md, "Noir, a new world in the making".
  - The board (noir.js makeBoardTexture): every grid line a street
    (BOARD_STREET 0.18 wide, one lane, noir-city.js), going on out across
    the border to the city's ring street; each square a block: its walk
    (BOARD_WALK 0.05) with the kerb, the lot inside in slabs as before;
    gutters, manholes, drains, puddles; a crossing's two painted lines at
    every corner (as then: no zebras); a streetcar line in granite setts
    down the middle each way; the border the walk round the district,
    letters and numbers on it; the goal rows' stripes in their outer
    streets. makeGrid's lines dashed (LineDashedMaterial; needs
    computeLineDistances). Lamps (lampSpots) on the walk, clear of the
    streets out; the city's walk round the slab cut where they go out.
    Drawing it: ~50 ms (was ~75): specks, crossings and stripes as one
    Path2D fill each (2,000 small fillRects alternating between two
    canvases had cost 87 ms alone).
  - The cars (themes/noir-cars.js): sedan41 ('41 Cadillac/Buick sedan,
    skirts), fastback46 (Fleetline Aerosedan), coupe40 ('40 Ford De Luxe,
    the prow), shoebox49 ('49 Ford, slab sides), airflow37 (Chrysler
    Airflow, the waterfall grille following its nose), taxi. Drawn from
    side elevations in a per-model SPECS table, extruded and rounded
    (slab(): the outline drawn in by the rounding first, so it isn't
    grown; less rounding where a part is thin, until the drawn-in
    outline doesn't cross itself; plan-view taper of nose and tail;
    smooth shading via mergeVertices). Body-coloured cabin, windows set
    in (clipped to the cabin's outline), a windshield in two. Greys only.
    0.3 long on the board. A kind's shape is made once and shared
    (partsOf); first time 5-44 ms here (software GL), then ~3 ms.
  - The traffic (themes/noir-traffic.js, run by noir-fx.js): one car at
    a time, now and then (a crossing ~30 s, then 15-45 s of empty
    street; the first 4-10 s into the game): along the ring street, a
    quarter turn into an open board street, end to end, a turn out the
    far side (right-hand lanes); or by on the ring street. One-way
    streets, every other the other way. Closed: a piece on the ground
    both sides of a street (groundCellsOf), a missing square or black
    hole beside it. None starts while a piece moves; one on the board
    dissolves when a piece moves. Cars: no shadow (shadow-watch would
    redraw every frame), no taps, a dithered dissolve in and out (their
    own material clones), headlamp glows, a beam on the street, tail
    glows, a soft shadow; and the lamps again as points a fixed size on
    the screen (sizeAttenuation off), so from the phone's default view,
    high over the board, a car still shows as its lights down a street. The next car is made ready ~1.5 s after the
    last left (shape, materials, renderer.compile for its shaders).
    Test hook __NOIR_TRAFFIC__ (state, closed, spawn {street, kind,
    paint, ring, at}, pace, freeze). In the software test browser the
    page draws at ~3 fps and the car's step is capped at 0.1 s a frame:
    cars crawl there; real devices are fine.
  - tests/e2e-noir-streets.mjs (in run-e2e): the picture's streets darker
    than the walks, dashed lines, streets closed by a lying Flaco and by
    a black hole, a car on its own (a period kind, an open street, no
    shadow, no tap), on its street's line, gone when a piece moves:
    16/16. e2e-smoke noir passes; an 8x13 board draws without errors.
  - Pitfalls met: a rear fender's wheel opening runs PI -> 0 (the
    outline goes forward along the bottom there); a tilted plane can't
    follow a curved nose (noseStrip lays it on the outline); the test
    camera's target is in the world, the board turned under it (use the
    car's world position). Not done: sounds for the cars (to offer).
- CI after the Noir cars: e2e-summon's desktop part ("on a computer")
  missed its tap on the summons on GitHub twice running (b13ef3e and
  its re-run): no invite, then a 30 s timeout. Not the cars: the Nova
  and Neon pages built from b13ef3e are byte-identical to the last
  green build (6f4c15a). It fails only on GitHub's faster machines
  (there, in shard 8, e2e-outline takes ~77 s and e2e-singularity
  185-210 s, against ~102 s and ~241 s on the slower ones): every
  slower-machine run has passed (4 of 4), every faster one failed (2
  of 2). Here it passes every way tried: Chrome 141 and GitHub's own
  Chrome 153 (Chrome for Testing, from storage.googleapis.com/
  chrome-for-testing-public/<version>/linux64/chrome-linux64.zip,
  reachable here though cdn.playwright.dev isn't), with Google's fonts
  or without (here they fail on the proxy's certificate; a launch with
  proxy {server: HTTPS_PROXY} and contexts with ignoreHTTPSErrors loads
  them, and Neon's title is then 145 px tall, not 125), the CPU slowed
  4x or not. So the test now notes each press, the invite coming and
  going, full screen and resizes, and on a miss prints them with
  what's under the point, the summons' state, the title and the canvas
  (cd46547), then goes on to the other sections. Open: on the next
  faster-machine run, read that line in shard 8's log and fix the cause.
- Noir, "Z-fighting on white border" (user's phone video, a low view
  along the numbered edge): the chassis's top ring (buildTopRingFrame,
  a 0.025-wide frame mesh exactly in the slab's top plane, HEX.charcoal
  at 0.45: white in Noir, whose charcoal is 0xececec) won its depth test
  against the coincident top face by fixed units only (-4 against the
  face's +3). Seen low, the two surfaces' interpolated depths drift apart
  by more than that, and the whole rim lost or won together as the view
  crept: in the video every pixel of it flipped between ~80 and ~135 in
  lockstep (found with a per-pixel flicker map over the video's stillest
  20 frames, decoded with a static ffmpeg and numpy). Reproduced here, a
  low view along the -x edge with theta nudged 0.0004 a frame (the rim
  gone in 2 of 6 frames). Fix: polygonOffsetFactor -1 on the ring too,
  the slope-scaled pull the check alert's marks already have; the rim
  holds in every frame. Every world has the ring (all smokes pass).
- ABOUT (INFO overlay), the user's wording: "...the article itself
  clarifies that El Cabeza had not yet been published, and to the
  current day still hasn't seen an official publication, however over
  the years DIY, physical versions have been produced by enthusiasts."
  In every copy of the text, as before: chassis/ElCabeza3D.jsx (every
  world), el_cabeza_3d.jsx and el-cabeza-neon-3d.html; "hasn&rsquo;t" as
  the text's other apostrophes. Read back from the ABOUT tab on Standard,
  Noir, Neon and Lab.
- Go deo na ndeor (Watermark), its soundtrack now two songs (user: "Add
  to the 'Go deo na ndeor' soundtrack with the title 'Ná seas ag mo uaigh
  is ná goil', matching for audio levels"): their own song, edited over
  four rounds in this chat (2:34.699-2:53.234 out, a hall trailing off
  through 3.4 s, the last part on its first note, the dead-stop click at
  the end faded into the hall, reverb over all). tools/parrish_na_seas.py
  makes assets/parrish/na-seas.mp3 from assets/parrish/src/ (the user's
  original) and matches its integrated loudness (BS.1770, its own lufs())
  to the first song's, -15.71 LUFS, re-encoding until the MP3 measures
  within 0.05 dB (LAME takes ~0.45 dB off). parrish-audio.js: SOUNDTRACK,
  a list per look (Orinoco still one song, looping on its seam as
  before); a list of two plays each in turn, a 3 s gap between, the next
  fetched 25 s before the end; pause, the now-playing strip (title, time
  and length of the song playing) and the hums channel's hint (both
  titles) follow it. Tests: e2e-now-playing's Watermark section skips to
  each song's end (testSongNearEnd) and reads the next; the strip's title
  read from its span (a title that scrolls has its keyframes beside it).
- Check alert, Show me's camera (user: "When check alerts pop up & Show
  Me is selected, move the camera to observe the animation, & when
  dismissed, return camera to original attitude"). frameCheckShow (with
  the view functions): the board turned so the attack's long way (the
  principal axis of every footprint corner it passes) runs across the
  screen, of the two headings that do it the one with less of the
  board's pieces standing in front (taller at the near face than the
  sight line to the ghost's foot), else the nearer; pitch
  max(VIEW_PHI, 1.0) (a tumble reads side on), 0.8 for a turn on the
  spot alone; then the radius bisected (never under 11) so the box round
  it all fills at most half the room under the card (and between the
  phone's bars), the target moved by two Newton steps to centre it
  there, within the tick's own pan limit. The play waits, its ghost on
  the piece, until the glide's done (show.waiting; at most 2.5 s).
  checkCamRef holds the camera from before the first press; when the
  card goes (put away, the danger past, the alert off, the turn over)
  the camera glides back, except into a new game's setup or a replay,
  and not once a view's been chosen meanwhile (glideCamera and a theme's
  glideTo forget it: the phone bar's view button is one tap that both
  puts the card away and picks a view). __EC_TEST_CAM__ now also gives
  the eased view; __EC_TEST_CHECK_CAM__ the kept camera. Tests:
  e2e-check-alert (Neon on a computer: waits, then the attack across the
  screen under the card, back exactly; up the board, a quarter turn from
  the side a tall Flaco isn't in front of; the den on a phone: between
  card and bar, back, and the bar's view button kept).
