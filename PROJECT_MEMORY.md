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
  round's first line, part by part (01 is the oldest, 11 the newest, up
  to the efficiency review).

## Recent rounds

- ABOUT (INFO overlay), two asks the same day: "Developed sometime prior
  to 1977 in Argentina by Jaime Poniachik and Enrique Lindenbaum, ..."
  (with "amidst a steady stream of abstract strategy board games" gone),
  then "Cabeza was never officially published" made "El Cabeza was
  never officially published". In every copy of the text:
  chassis/ElCabeza3D.jsx (every world), el_cabeza_3d.jsx and
  el-cabeza-neon-3d.html (the old single-file versions). daba416, 5f4229b.
- Efficiency, the fixes (user: "go ahead with 1–3 and add the fps
  readout", then "move forward will all other suggested efficiency fixes
  proposed earlier"; the measurements are history/11.md's last note).
  Nothing is meant to look different; what changed is how often and how
  much is drawn.
  - `?fps` (chassis/fps-readout.js): a readout at the left middle, every
    page, never takes a tap: fps and the average frame, the slowest
    frame, the main loop's own ms a frame, pixel ratio and tier, the
    shadow map's size and how often it's drawn, draws and triangles.
    `?fps` keeps it on for the tab (sessionStorage), `?fps=0` turns it
    off. A gap of 5 s or more (tab away) isn't counted.
  - Device fit for every world (chassis/device-fit.js): quality()'s tier
    (themes/tienda-quality.js; `?quality=low|mid|high` forces one) caps
    the pixel ratio (2 / 1.75 / 1.25) and sizes the key light's shadow
    map (4096 / 2048 / 1024), and the den's frame-rate governor runs in
    the chassis. A theme with its own (`export const ownsPixelRatio =
    true`: standard for the den, tienda, parrish) keeps it. Phones: Neon,
    Cromo, Plano, Luna, Noir, Lluvia and the Lab went from 2 to 1.75 and
    from 4096 to 2048; Parrish's shadows to 2048 too. Computers as before.
  - Shadows drawn only on a change (chassis/shadow-watch.js):
    renderer.shadowMap.autoUpdate off; each frame, after
    scene.updateMatrixWorld() (scene.autoUpdate is off: once a frame, not
    twice), a signature of every visible shadow-casting light and caster
    (matrices, geometry/material ids and versions, instances, draw range,
    shadow camera) is compared with the last drawing's; any difference,
    a skinned/morphing/custom-depth caster, or 1 s since the last, and
    they're drawn. `?shadows=always` draws them every frame, to compare.
    Pixel-identical to every frame in all ten worlds (at rest, mid-turn,
    after; scratch eff/shadowcheck.mjs). At rest about 1 a second (the
    backstop; Noir 2: its rain lamps).
  - The dock piece's outline (clipToPiece, ElCabeza3D.jsx): points
    gathered once a piece in its own frame (deduped), per frame one
    reused array, the Akl–Toussaint octagon drops the inner points, then
    the same monotone chain; the clip only rewritten past 0.5 px. Same
    outline (scratch eff/dockcheck.mjs: ≤0.5 px, ~1 px at two Noir
    near-collinear corners). Luna 8.3% → 2.3% of script time, Noir 9.3%
    → 4.2%. A merged mesh (below) is still sampled part by part
    (geometry.userData.parts), as its parts were.
  - Lluvia's ad screens and menu boards (lluvia-city.js) are painted and
    uploaded only when the screen or its reflection is in the camera's
    view; Tienda's TV picture (tienda-store.js animate, given the camera
    by tienda-fx.js) likewise. Both are in view from the default camera,
    so the win is when looking away.
  - The AI's first look (engine/ai.js minimaxSearch, depth 1 at the
    root) checks the time every 32 turns while ordering; once out, the
    rest go unscored (sorted last; game-ending turns are never cut), and
    pieces are taken in rotation so a cut leaves every piece's turns
    partly looked at. With the time (computers, most phones) nothing
    changes; the same moves with the noise off. A Split Movement root on
    a 60 ms budget: 531 → 77 ms.
  - Files beside the pages instead of inlined (build.js COMMON_FILES and
    LOST_HAND): ABOUT's original-game cue (el-cabeza-original-cue.mp3,
    every page; fetched when INFO opens) and the lost card's hand
    (el-cabeza-lost-hand-wire/skin.webp, Neon and Nova; LostNudge
    preloads them as it mounts).
  - Luna's buildings merged (themes/merge-static.js, called in
    luna-models.js buildingFor): inside a building, plain parts that look
    the same are baked into one mesh each; the roof kit
    (userData.mergeRoot) is merged on its own so luna-fx.js can still
    hide it under an overhang. Not merged: transparent, hooked, mirrored,
    hidden, morphing or grouped parts, anything marked userData.noMerge.
    Checked (scratch merge/: every piece in every pose, both sides, one
    building drawn as built, merged in place, drawn again, two views):
    76 of 96 identical, the rest 1-3 pixels of 102,400 (rounding at an
    edge); the dock outline's sampled points the same to 1e-7. Luna's
    buildings: 1,246 meshes -> 586 (the Cabeza 94 -> 30). The page, phone
    tier (scratch perf/measure2.mjs): 386 draws a frame -> 236, 465
    shadow casters -> 335, script 6.8 -> 5.0 ms a frame, the same
    triangles. (Two separate
    builds of one piece differ by thousands of pixels: something in a
    building isn't seeded; the game builds each once, so it doesn't
    show, but compare a building with itself.)
  - Tests: tests/run-e2e.mjs `--shard i/n`; e2e-touch-in-game added to
    its list (never run until now; passes). .github/workflows/e2e.yml
    runs the whole list on every push to main and this branch, eight
    machines at once (free: a public repository); it reports, it doesn't
    hold up the deploy. The tests' fixed paths (/home/user, /opt/pw-
    browsers) are symlinked there.
  - Memory: this file split into docs/memory/ (see the top).
  - Not done, on purpose: Parrish's Watermark music is still decoded
    whole (~150 MB): both long tracks loop seamlessly on their own loop
    points and play at once; streaming them (a media element) would put
    a gap or a crossfade into the loop, a change in what's heard. The
    den's book (book-cover/tail/fore.jpg, ~105 KB) stays inlined: it's on
    the side table from the den's first frame, and as a file it would
    arrive after the room (a pop-in on a slow line). And the tests' fixed
    pauses stay: most wait out an easing or a fade; the CI shards are the
    time fix.
  - The den TV's lip-sync test (e2e-den-spot) failed after this: the
    video 55 ms ahead of the sound, its limit 45. Not a fault: the den
    aims the video a drawn frame ahead of the sound (den-commercial.js;
    the canvas shows a frame about a frame after it's drawn), its frame
    time a running average of the gaps under 100 ms. This software
    browser draws the den at ~117 ms a frame; the old build had about 2
    gaps in 190 under 100 ms (the average stayed near 1/60 s, the lead
    ~16-23 ms), the faster new one 13 in 210 (the lead to its 50 ms cap).
    The test measured the video element, not the screen, so it read the
    lead as an error. It now takes off the lead the den reports
    (__DEN_SPOT__().lead): video clock 46 -> ~0 ms. Real browsers at 60
    fps: the lead ~16 ms either way.
  - e2e-original checked the cue was inlined (src data:audio/mpeg); it
    now checks the file (el-cabeza-original-cue.mp3) plays, 5.5 s.
  - Tests: the whole list in two halves (run-e2e --shard 1/2, 2/2).
    Half 1 on the first build (device fit, shadows, ?fps, dock outline,
    screens, Cabeza Nova link): 31/32, the one the den lip-sync check
    (above). Then on the final build: the tests the later changes touch
    (smoke luna, gameplay standard, ai-split, odd-pieces, split-three,
    dock-moments, touch-in-game, gate with its new phone check, den-spot,
    original): all pass. Half 2 on the final build: 30/31, the one
    e2e-undo-audio's "the game is playing again", read once 3 s after
    Undo Turn: the undone turn was the computer's, and it may be part
    way through playing it again then (the line "Chato · 1 roll left",
    not "… to move"); the old build caught that too, one run in two.
    It now reads the line until it settles (10 s at most): 3/3.
  - The GitHub workflow's first run (c13ede9): 7 of 8 machines green
    (13-25 min each); the 8th failed e2e-sound-channels, "the store's
    slider at half", reading [0.25, 1]. Those machines run the
    Playwright's own Chrome 153 (the /opt/pw-browsers path is a link to
    it); here it's the older Chromium 1194. A gain node with nothing
    passing through it (the store's far-off bus, between sounds) isn't
    worked by Chrome 153, so its live gain still read the old level,
    though its fade was set. tienda-audio.js's test hook now also gives
    gateLevels (what each gate is set to; regate() records it), and the
    test's four level checks read those.
    scratch files/check.mjs: the moved files load beside every page that
    names them (the cue: 11 pages; the hand: Neon and Nova).
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
