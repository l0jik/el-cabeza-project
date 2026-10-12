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
