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
  round's first line, part by part (01 is the oldest, 14 the newest, up
  to the corner piece's call after a game, Noir's sirens and the Big
  Glutts card).

## Recent rounds

- The Big Glutts card's line in the realities menu (user: "The Big Glutts
  card in Theme Switcher subtext should include pithy "everyone's
  favorite department store...just like the day you found the
  game"...or something like that"). realities.js WORLDS, the store:
  "Everyone's favorite department store, just like the day you found the
  game." It was "Games & Hobby Dept., the day you found it.", and the
  picture's sticker still says "Games & Hobby · Aisle 9". The clerk
  scene's caption calls the store the same.
  - It runs to three lines on a desktop card and two on a phone, with
    nothing clipped. `.line` gets `text-wrap: pretty`, so a last word
    isn't left on its own line ("game." was).
  - Only that menu shows `line` (the den TV shows names), and no test
    pins the words. e2e-ending, which opens the card, passed.
- e2e-summon's miss on GitHub (#148, now and then since run 17), found
  from run 25's FAIL line. The desktop part's tap on the singularity
  went to ec-crt-flash.
  - The way in from the set ends with the CRT picture coming on
    (unifiedTransition.jsx CrtTransitionOverlay: 2 s, z 9999). It takes
    every tap, and the page under it is pointer-events none.
  - The summons is up and ready about 1.4 s in, and its first clap comes
    on the very first beat (neon-summon.js, acc 0.86). On a quick machine
    the test's wait for thunder was over before the picture was.
  - Reproduced here: a tap as soon as the summons is ready on screen
    lands on ec-crt-flash, and no invite opens.
  - The fix: the test waits for the overlay to go (`pictureOn`) before
    its taps after the set (the phone part's board tap too).
  - The game is unchanged. A tap in the transition's last 0.6 s is
    ignored, as in the rest of it.
- GitHub browser tests #25 (30b95e0, the first full run since #18):
  shards 1 and 3-7 green; 8 failed on e2e-summon (above); 2 failed on
  e2e-dock-call (last round's new test).
  - In its Noir part, "...put away" failed: the victory placard stayed
    up after an Escape pressed the moment data-open turned "true". Every
    later miss followed from that. The hop read 0.009, and the tap
    meant for the dock landed on the placard's backdrop.
  - An Escape 700 ms after a later opening, in the same run, took. Here,
    even an Escape dispatched synchronously as the attribute flips
    closes it. The cause isn't proven; the window listener is attached
    in a passive effect after the commit (chassis, after the
    status-watching effect).
  - The test now presses Escape only once the placard is all the way up
    (backdrop opacity 1, its 0.3 s fade over), as a person would
    (`putAway`, used at all three Escapes after a win).
  - If it ever stays again, the check prints the keydown and data-open
    timeline (__ESC_NOTES__).
  - Passed here: 34 ok, 380 s (CI took 528 s with the misses' waits).
- Shoving, which pieces a roll may push (user: "For when pieces can
  shove by rolling, what's my current rule? That any piece, yours or your
  opponents can be moved, or only the opponents? Let's add a subtoggle for
  shoving by rolling that all pieces or only opponents can be shoved by
  rolling").
  - The answer: any piece, either side's, lighter in total (tryShove's
    hits had no owner check); a roll onto a lone enemy Cabeza is still a
    crush.
  - New engine law ACTIVE_LAWS.shoveOwnOnRolls (default true, "All
    pieces"). With it false ("Only opponents'"), rollShove refuses any hit
    of the mover's own side, so a roll into your own lighter piece (or a
    mix of yours and theirs) is blocked, as without the law. Slides still
    push either side's.
  - Selections: shove.ownOnRolls in rules-selections.js (SHOVE_SETTINGS'
    second setting, its `when`: only while rolls shove; `shoveShown(sel)`;
    defaults, normalize, effective, lawsForEngine, shoveNow's line,
    shovingName "Shoving (slides and rolls, rolls only opponents')") and
    in Neon's sphere (its own SHOVE_SETTINGS, lawLabel, lawsForEngine,
    defaults, normalization; renderShoveSettingsRow filters by `when`).
  - Menus: the store's custom game (tienda-shove-ownOnRolls-on/off), the
    gate's sheet (gate-shove-all / gate-shove-opponents), Lluvia's terminal
    (ROLLS SHOVE: ALL PIECES / OPPONENTS' ONLY, lluvia-shove-ownOnRolls-*),
    Neon's sphere (shove-ownOnRolls-*). The row shows only with "Slides and
    rolls".
  - Rules text: RulesCards shovingText, the "Shove by rolling" card, a
    piece card's line. Replay codes carry it (o: 0).
  - Tests: engine.smoke (default shoves your own; opponents' only: your
    own blocks, theirs pushed, a mix blocks, slides push either, crush
    intact), rules-selections.smoke, replay.smoke (a law set and the
    round trip), e2e-shoving 2c, and the menus in e2e-tienda, e2e-gate,
    e2e-lluvia and e2e-singularity.
- Check alert, called back (user: "if a check alert is dismissed, but the
  user decides they want to view again before making their turn there
  needs to be a way to call it back").
  - While the same threat stands this turn and the card's been put away
    (checkHidden), a chip "⚠ Check · Show again" (check-alert-recall)
    sits where the card was. A tap clears the dismissal, bringing back the
    card and its marks.
  - The chip goes with the danger, or the next turn (a new checkKey). The
    cut-scenes hide it as they hide the card.
  - e2e-check-alert covers it: the chip where the card was, back with its
    marks, no chip while it's up, the chip again when put away again, gone
    when the Cabeza steps out of reach.
- The pull down the hall, recorded (user: "When the user is pulled from
  the den into the hallway, there should be audio of someone being pulled,
  somewhat unwilingly, although curious....stuff should sound like it's
  being knocked over, but it's not total chaos...although some forcefield
  like noise could also be happening too. Whenever the user turn right
  after passing through the doorframe, they see the strange objects on the
  wall flashing around, so there should be an expression of extreme shock
  or confusion.... Perhaps the person / man should increasingly sound a
  bit panicky as they're pulled into the hallway... Let's pull from our
  new audio resources").
  - Sources: freesound.org (assets/hall/src/, CREDITS.md). The man is
    one voice throughout: Iceofdoom's "buddy" (CC BY 4.0, credited on
    the den's About card, standard.js soundCredits). Takes: "Whoah, no
    way", a startled "Ah", two "Ugh"s, a grunt, a gasp, "Huh?", "Phew",
    "Ahh!!!". Whisper (scratch asrmodel) sorted his grunts/gasps/"Huh?"s.
  - The rest is CC0:
    - the breathing: casiba842's scared heavy breathing, which gets
      harder over its 36 s (its 14-34 s);
    - the force field: humanoide9000's hum with quickening pulses, a 20 s
      loop, and LilMati's swell for the force taking hold;
    - what goes over: nick121087's cup shelf, YannSauvin's table,
      mickdow's papers, kyles's chair scrape, MindlessTrails's books and
      martian's vase;
    - the doorframe: jawbutch's body against a wall, and a flat-hand slap
      by Soundscape_Leuphana.
  - tools/hall_sounds.py (FFMPEG=... python3) makes assets/hall/:
    - voice.mp3: 9 takes in 2.5 s slots, LEAD 0.1 s in;
    - things.mp3: 9 in 4 s slots;
    - field.mp3: the loop, padded 0.3 s each side;
    - breath.mp3.
    Each take's loudest 0.3 s is at -14 dBFS, the beds at -20 average. LAME
    VBR, 700 KB in all. build.js adds el-cabeza-hall-*.mp3 to DEN_RECORDS.
  - den-hall.js PULL_FILES are fetched when the hall flares (http only;
    from disk, the made sounds alone).
  - WALK_CUES and DRAG_CUES run on the walk's own clock, so the camera
    and the takes line up: the doorframe at 6.9-7.1 s, the turn to the
    rift from 7.2 s.
    - Investigating: the swell; "Whoah, no way" (0.9 s); rattle, "Ah",
      papers swept across, chair, "Ugh", books, "Ugh", vase.
    - At the doorframe: bump, slap, grunt.
    - Round the turn: the gasp (7.7 s) and "Huh?" (8.9 s); "Phew" as it
      dies down (11 s); "Ahh!!!" at the eruption (12.85 s).
    - Dragged (the third time): a startled "Ah", no "Whoah", fewer words
      (the takes don't speed up), the same doorframe and gasp, the scream.
  - FIELD_AT and BREATH_AT set the beds by the walk's clock: up as he's
    pulled in, most at the rift, down as it dies down, up for the
    eruption. The breathing starts at 4.7 s (x1.08 dragged) and dips to
    0.35 under each voice take. The made hum is x0.45 under the field.
  - A take whose moment passed more than 0.6 s before its file came is
    dropped, not played late; skipWalk lets go of the takes it skips.
  - state().pull reports { loaded, heard, field, breath } for tests.
  - Levels checked on a render of the whole thing (scratch hallsnd
    render_pull.py, with the made booms, hum, steps and roar roughly
    in), A-weighted, each take against everything else over 0.5 s:
    - walk: whoa +16, gasp +11, "Huh?" +10, the efforts +5 to +9, "Phew"
      +14, scream +13;
    - drag: "Ah" +3, gasp +14.
    It was gasp +2 and "Huh?" +1 before the duck and the gain-up, the field
    at -47 dB(A) before it was doubled.
  - The preview mix was sent to the user (hall-pull-preview.mp3, 30 s: the
    walk, then the drag).
- GitHub browser tests #26 (60210a8): shard 8 green, so e2e-summon's
  wait for the CRT picture holds there (#148 done). Shard 2: e2e-dock-call,
  "the placard put away" passing in every world now; one miss left, "...and
  hopping now and then" read 0.013 (wants > 0.04).
  - The CI renderer draws Noir a few frames a second. Frames that far
    apart miss the hop's peak (0.12 for a moment of its 560 ms; at about
    3 fps the samples land on its tail, 0.01-0.02).
  - The chassis counts each hop as it starts (dock state.nudges), and
    hopRange returns { hops, most }.
  - "Hopping" now means a hop began and the piece moved at all (> 0.005).
    "No more hops" and reduced motion mean none began (and under 0.01).
  - Locally (389 s) the whole of e2e-dock-call passes with the count:
    hopping, no more hops and reduced motion in Noir, the placard put
    away in all seven.
