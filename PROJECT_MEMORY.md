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
  round's first line, part by part (01 is the oldest, 15 the newest, up
  to Noir in the switcher, the scream's echo into the void, Luna's
  closed floors and the corner menu mock-ups).

## Recent rounds

- The scream, ten others to hear (user: "I want a different "aaahhh!" Let
  me hear 10 other options").
  - 42 freesound candidates, CC0 or CC BY only (scratch scream/dl, dl2;
    the high-quality previews, four only as -hq.mp3). Measured, not
    guessed: scream/tools/analyse.py (each loud stretch, its pitch, and
    what Whisper base.en hears, to drop the worded ones: "No. No.", "Oh
    my god"), specs.py (spectrogram sheets: clipping, noise floors).
    Out: AlbertTrepat's two (thousands of clipped samples), FngerSounds
    (clipped, noisy), AUDACITIER (noisy), the worded and the excited.
  - The ten, short to long (scratch scream/out/scream-option-01..10.mp3:
    each alone with the echo, then the end of the walk with it in place;
    scream-options-all.mp3 plays the current one first, then the ten):
    1 egomassive ScreamM (CC0, 0.81 s), 2 malexmedia man_scream (CC BY
    4.0, 0.97), 3 annatabernero Young Male Scream (CC0, 1.23), 4
    doctorsex burstscream (CC0, 1.09), 5 creativeheroes helmutscream_short
    (CC BY 4.0, 1.63, a Wilhelm parody), 6 Artmasterrich Male_Fall_Death_01
    (CC0, 1.79, falls away), 7 marc3122 Male Screams [1], the first (CC0,
    2.51), 8 thanvannispen male_Thijs_loud_scream (CC BY 4.0, 2.76), 9
    riippumattog Male falling down of building (CC0, 3.06), 10 grghson
    Blood-Curdling Scream - Male (CC BY 4.0, cut to 3.45 with a fade).
  - scream/tools/options.py cuts and levels each as hall_sounds.py does
    a voice take (80 Hz high-pass, loudest 0.3 s at -14 dBFS) and plays
    it as the game does (x 0.7, echoRoom's recipe, send 0.3 to 1).
  - To swap one in: hall_sounds.py VOICE "scream" (file, from, to), the
    source into assets/hall/src and CREDITS.md, voice.mp3 regenerated,
    TAKES.voice.scream's length (SCREAM_AT follows, so the scream still
    ends at the hand-off; one up to about 3.5 s starts after the
    eruption at 12.6 s). The scream is the last voice slot: a take over
    2.35 s needs slotted() to let the last take run past its slot. A CC
    BY pick goes on the About card (standard.js soundCredits) too.
  - Waiting on the user's pick.
- Corner menu mock-ups, sent (scratch cornermenu/sheets/corner-menu-1,
  -2, -lab, -phones.jpg). Fixed after a first look: Big Glutts' DEMO
  stamp on the slip's last line beside the link (it had covered the
  board lines); Noir's title on two even lines; the Lab's rules block
  across the whole read-out (De Stijl's, Corporate Swiss's and
  Brutalism's are grids, so it had been squeezed into one cell) and in
  the read-out's own ink, read from its own figures (.lab-stats dd/dt:
  Ultimate Fusion's law names had been dark on dark). On a short screen
  the Lab's list runs down to the corner buttons; a build would cap it
  and let it scroll. The store's sample card shows the custom sample
  over its standard board (the shoot plays the store's standard game).
  Waiting on the user's picks; the concept image never arrived.
- GitHub browser tests #30 (f3138ee, Luna's closed floors): all 8 shards
  green. #28 (276255b) and #29 (afe7776) were cancelled by the pushes
  after them, with no failures (seven of eight and four of eight shards
  done, all green); #30 ran everything they held.
- The scream, five yells instead (user: "Get me 5 more screams, but more
  like yells. These are a bit too terror filled. This should be more
  like loud shock, a yell... it's not a scream of terror").
  - 32 more candidates (scratch scream/dl3; searched for whoa, surprise,
    shocked and startled yells; scream/tools/parse.py reads freesound's
    search pages, segs.py lists a long recording's loud takes with what
    Whisper hears in each). Iceofdoom's own recordings looked at first,
    to keep one voice: his grunts series has no yell, but his "Oh!" -
    Surprised Male (371555, his buddy, the same voice, 11 takes) does.
  - The five, numbered on from the ten (scratch scream/out2/
    yell-option-11..15.mp3, yell-options-all.mp3 with the current one
    first; scream/tools/yells.py): 11 Peter_Scream Surprise 3, a
    "Whoa!" (CC0, 1.16 s), 12 tim.kahn yell 2, an "AAAH!" (CC BY 4.0,
    1.13), 13 dersuperanton Ahhh Surprise Man Voice, an "Ah!" (CC BY
    4.0, 0.85), 14 Iceofdoom's loudest "Oh!" (10.84 s in, CC BY 4.0,
    0.95; already credited), 15 HappyYoLucky303 whoa!, a long "whoaaa"
    (CC0, 2.36). Out: EricSueiro's (5000 clipped samples), joseppujol's
    (heard as "Yeah!", "Hey"), the high or child-like ones.
  - Waiting on the user's pick (from all fifteen).
- The five yells in the whole scene (user: "use all of the yells and do
  the full suite of sounds for that scene, combine them together, and
  then let me hear MP3 samples of all of them individually. Give me a
  link to all those"). Page: https://claude.ai/artifact/ArcaQAwCQfhxofXMRVeMyS
  ("Hall Pull Yells": each yell and the current scream, the walk and the
  dragged-in version, a strip of the scene's timeline to play and scrub,
  "Skip to the eruption"; scratch hallpage/).
  - scratch scream/tools/scene.py renders the scene offline from
    den-hall.js itself: the flare (booms, the hum, crackle at the
    strobe's moments; Investigate tapped at 4.4 s, or dragged in at
    2.6 s), the walk or drag (every cue, the field and breath beds as
    pullSound sets them, footsteps and creaks, booms), the eruption
    (roar, the boom), the yell's echo, stopSound at the hand-off, and the
    void's music (den-ending.js: x 0.9, its limiter, x 0.95). The made
    sounds are their recipes in Web Audio's own terms (biquads with Q in
    dB, ramps, setTargetAtTime once a frame), the den's master
    compressor too (-16 dB, 3:1, 30 dB knee: Chromium's curve and
    makeup, 0.7 dB). Beds and made sounds reach both channels whole (a
    mono source upmixed); takes go through a StereoPanner (0.71 each at
    centre). render_pull2.py had the beds and made sounds 3 dB low.
  - Yell 12 (tim.kahn) peaks at 1.17 into the destination in the
    eruption: if it's chosen, level it down a touch (by its peak, not
    only its loudest 0.3 s). Nothing else passes 1.03.
  - Waiting on the user's pick.
- The pull, round two (user: "None are working. Do a full 5 new sets.
  Less grunting, less panting... More surprise and ruckus sounds....
  Get selection of 15 new end yells / aahhhh shouts"). Same page, its
  version 2: https://claude.ai/artifact/ArcaQAwCQfhxofXMRVeMyS (five
  whole sets, then fifteen end shouts, each alone then in the ending).
  - Each set: one person reacting in surprise all the way down (no
    grunts, no breathing at all), a lot more crashing than the game has,
    the game's made sounds, field, eruption and void, and an end shout.
    Set 1 Sadiquecat (CC0; "What?", "Whoa", "Wait, what?", "Oh crap",
    "What the hell, man", "Wait!", "No way.", "Oh no! Oh no! Oh no!"),
    ruckus A, ends on 3; set 2 Peter_Scream (CC0; his Surprise and Fear
    takes), ruckus B, ends on his own 9; set 3 unfa (CC0; Excited Young
    Male Screams), ruckus C, ends on his own 7; set 4 Iceofdoom (the
    walk's man; his surprised "Oh!"s for the grunts), ruckus A, ends on
    1; set 5 dersuperanton (CC BY), ruckus B, ends on 4.
  - Ruckus A: the house shaking (earthquake rattles), a picture frame and
    its glass, a chair over, dishes in the kitchen (low-passed, far), the
    lamp's bulb popping, boxes, a door slamming behind, things whizzing
    past; B: clatter (a tray, tins, metal, a pot, boards, a stumble); C:
    smashing (glass, bangs, the neon tube, a door). Each eruption gets
    its own big crash, debris, glass and a rush. Some 30 new crash and
    whoosh recordings (scratch scream/dl5, cut by scream/tools/sets.py's
    R table; CC0 mostly, four CC BY).
  - The fifteen shouts (sets.py Y): 1 qubodup Wilhelm Scream, 2 Wilhelm
    Alternative 5, 3 kfatehi argg-pitfall, 4 LittleRobotSoundFactory
    Scream_Male_03, 5 kMoon Scream_Male_MidDistance_Outdoors, 6 Guy110
    Male Scream, 7 unfa "Whoa!", 8 unfa "Ah!", 9 Peter_Scream Surprise 2,
    10 Surprise 4, 11 Greencouch 79_ohOHohhh, 12 Gamba_04 Grito
    Sorprendido, 13 SuddenDice AS060822_Surprise, 14 AtoMediaDesign
    Screaming, startled, falling 3, 15 jrssandoval ahh 2. None of the
    first twenty (all turned down).
  - scratch scream/tools/engine.py is scene.py's engine on its own;
    sets.py renders a set from any cue list (takes from any file, a
    low-pass for far-off things), the shout ending at the hand-off.
    freesound's search pages refuse quick bursts (403): fetch.py and the
    searches pause between requests.
  - In the game a set would mean: a new voice.mp3 and things.mp3 (more
    slots; some ruckus runs past THING_SLOT's 4 s), new WALK_CUES and
    DRAG_CUES, BREATH_AT gone, and the About card's credits.
  - Waiting on the user's pick.
- Round two's end shouts, a preverb (user: "Add 1.7 sec. preverb to all
  ending yells before being sucked into the void"). The page's version 3
  (same link). sets.py preverb(): the shout's own echo room (den-hall.js
  echoRoom's recipe) run backwards (reverse the take, convolve, reverse
  back), so the room swells for 1.7 s up into the shout and the echo
  rings 1.7 s after it, mirror images. Sent most from the shout's start
  (1 to 0.3 over it; the echo's send runs 0.3 to 1), wet 0.75, and a
  straight rise from nothing over the 1.7 s on top of the room's own:
  measured against each shout's loudest, -49, -22, -13 and -5 dB at 1.5,
  1.0, 0.5 and 0 s before it (first pass, at the echo's 1.3 and no rise,
  it reached the shout's own level and the shout no longer stood out).
  It starts during the eruption (about 1.7 s before the shout); the
  shout still ends at the hand-off.
  - In the game it can't be done live (it needs the shout before it's
    played): bake it in (hall_sounds.py, the scream's slot holding the
    preverb then the shout; TAKES.voice.scream's length and SCREAM_AT
    take the 1.7 s in), or make it once at load (an OfflineAudioContext
    convolving the reversed buffer).
- Set 5 in the game (user: "Let's go with number 5 for the hull pull, but
  that glass break right near the very end, we need to remove that and
  lower the ruckus just a hair"). The glass break was ruckus B's last
  crash (MyInnerWill "Crash bang", walk 15.1 s, 71% of it above 4 kHz):
  gone. Every thing 2 dB down except engage (the field's swell as was).
  Preview of the final mix: scratch scream/sets2/set-5-final.mp3
  (scream/tools/final5.py).
  - tools/hall_sounds.py remade: voice.mp3 seven 2.5 s slots
    (dersuperanton huh, hey, wow, ahh, uhoh, hit; LittleRobotSoundFactory
    Scream_Male_03 0-1.11 s), things.mp3 21 4 s slots, pre.mp3 (the
    shout's preverb, baked: PRE_LEAD 0.1 s silence, then the shout run
    backwards through echoRoom's recipe, seed 7, 1.7 s rising into it),
    field.mp3 as was. breath.mp3 and nine old sources gone (casiba842,
    Iceofdoom x5, nick121087, MindlessTrails); 20 new in assets/hall/src
    (CREDITS.md). About card: dersuperanton and LittleRobotSoundFactory
    (CC BY 4.0) by name, the CC0 names after.
  - den-hall.js: PULL_FILES voice/things/field/pre; TAKES; WALK_CUES and
    DRAG_CUES are set 5's (byTime-sorted); SCREAM_CUE = SCREAM_AT - 1.8
    s: take() plays the pre file from the cue and the shout PRE +
    PRE_LEAD later, so it still ends at ENDING_AT, its echo on into the
    void. A late frame's made up (take's `late`: the pre starts that far
    in, the shout that much sooner): the shout's end was landing 90-160
    ms after the hand-off on slow frames, now about 30. All the breath
    code gone (BREATH_*, voiceUntil, breathDone, the bed's rate).
  - Caught by the test: screamEcho's let-go timer counted from the cue,
    so with the shout 1.8 s on it cut the echo 0.9 s into the void. Now
    counted from the shout (t).
  - state().pull.pre {at, shout, env}: env is the RMS of each 2048
    samples of the last 32768 (test hooks only), stamped with the audio
    clock, so a sampler every 100 ms gets the whole swell even at a few
    frames a second (main-thread sampling missed most of it).
  - e2e-hall-sound rewritten: four files, no breath; the takes to the
    rift in WALK_CUES order, once each; preverb 1.8 s ahead, silent at
    first (< 0.004), > 0.015 and 2.5x its middle by the shout; the echo
    listened to until 2.2 s on (it had stopped at 3.2 s from the cue),
    there all along at 1.0-1.4 s. Dragged: "Hey!" first, "Huh?" at
    4.0-5.4 s. e2e-ending, e2e-hall-after-game, e2e-camera-glide pass.
- GitHub browser tests #37 (a88d0f3, set 5): seven shards green,
  e2e-hall-sound's among them. Shard 2 failed e2e-dock-call "...and
  hopping now and then", {"hops":1,"most":0.004}, the rest of it passing.
  - Why: the CI renderer draws Noir three or four frames a second (317
    ms apart here), about half the hop's 560 ms, and a hop's first frame
    comes as it begins (its timer fires just before a frame). So its
    frames land where the curve (sin 2pi t, decaying) passes through the
    piece's own size, at its start and middle: 0.001-0.036 here, 0.004
    and 0.013 (run 26) there, for a peak of 0.12 at 130 ms.
  - Reproduced (scratch dockhop/repro2.mjs: Noir calling, each frame held
    250 ms longer): the old check failed 1 round in 6 (0.0029). The new
    hopRange, run as the test has it (repro3), passed 8 of 8 and reads
    exactly 0 at rest.
  - hopRange(page, ms, moved): stops once a hop's begun and ended with the
    piece moved more than `moved`, else at ms, and reports frames and ms.
    Hopping: up to 11 s (two hops), hops >= 1 and moved > 1e-4, "at all"
    (at rest it's exactly 0). The no-hop checks are as they were.
- GitHub browser tests #38 (9902682): e2e-dock-call passed with the new
  hop measure (408 s). Shard 2 then failed e2e-now-playing "between
  songs, back": the right song from its start (0:00, then 0:04), but
  sounding 2. It had passed in runs 32 to 37.
  - Why: the count (debugState.sounding) went down only on each source's
    'ended', which headless Chrome doesn't always fire (the Lab's sounds
    found the same, theme-lab.md). GitHub runs Chrome 153, here 141.
    Every path that starts a song is guarded (h.cues, cleared timers).
    No timing tried here left two playing: presses 0-5.3 s into the gap,
    just after the next song began, and at 4x CPU throttling.
  - Reproduced by dropping the 0.5 s tail source's 'ended' (scratch
    np/np-repro.mjs, DROP=1): exactly run 38's failure (song 1 at 0:00
    then 0:04, sounding 2).
  - parrish-audio.js: h.voices holds each source till its end (t + left)
    or its stop. stopVoice is used by skip, pause and testSongNearEnd.
    Its 'ended' only lets a source go sooner, and sounding counts those
    still ahead on the audio clock. The same drop now passes, as does the
    whole of e2e-now-playing.
