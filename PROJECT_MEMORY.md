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
  round's first line, part by part (01 is the oldest, 13 the newest, up
  to Noir's rain made of drops and GitHub's browser tests #15).

## Recent rounds

- Noir's sounds, recorded (user, once the allowlist let freesound through:
  "done, I added the domains"; then "make sure you get some better rain
  sounds, too...it definitely will need its own volume toggle, though").
  freesound's high-quality previews need no login
  (cdn.freesound.org/previews/<id/1000>/<id>_<user>-hq.ogg); the
  sources are in assets/noir/src/, CREDITS.md giving each one's link,
  author and licence. tools/noir_sounds.py (FFMPEG=... python3; scipy,
  soundfile) makes assets/noir/: rain.mp3 (a seamless 57 s stereo loop,
  128 kb/s, 900 KB): kyles's "rain medium on street pavement" (CC0,
  stereo, every drop in it) as the body, a 28.5 s loop twice through,
  with craigsmith's "G39-22-Rain on Concrete" (CC0, a Hollywood studio's
  rain effect) 3 dB under it, made wide (the right channel the same rain
  23.7 s on). The vintage one alone read as a sizzle. Both have a high-pass
  at 200 Hz (4th order) where their hum is, plus narrow notches (301/434.5/484;
  229/318.5/687.5). The hum showed up with Welch (2 s segments) against
  a median-filtered baseline; one long periodogram gives false peaks. Then
  a low-pass at 6.5 kHz, and soft_peaks rounds the hundred or so loudest
  ticks (knee 18 dB over the RMS, 4 dB room), so the whole needn't be
  turned down for them. thunder-1/-2.mp3: craigsmith's "R30-30-Classic
  Thunder Clap" and a clap of his "G46-12-Thunderclap Fox" (CC0), each
  with its first 3 s at -16 dBFS RMS. car-engine.mp3 is lonemonk's "1951
  Mercury-Idle and Throttle" (CC BY 4.0, credited on the About card): its
  idle (2-8 s) looped at the seam that correlates best near 5 s (5.013
  s, 0.957). car-rev.mp3 is its rev (41.5-43.95 s), starting at the
  loop's level. car-tyres.mp3 is Breviceps's "Passing Car (Wet road)"
  (CC0), the spray after it has passed (2.85-5.2 s), its fall flattened,
  slowed x0.62, looped. A loop's file has 0.3 s (LOOP_PAD) of its own end
  before and of its start after; the game loops from its first sound +
  0.3 to its last - 0.3 (decoders differ in the silence they add).
  noir-audio.js, rewritten round three channels: channel(key, dest, pre)
  gives {bus, gate, send}. "rain" (the clip, the made rain standing in
  until it's decoded and from disk, the roofs' roar, the thunder) and
  "city" (drips, the El, the siren, the cars) go under the zoom's
  ambGain; "pieces" to the master. setChannelLevel / setChannelMuted,
  and theme.soundChannels Rain / The city / Pieces give the chassis
  sound menu's sliders (sound-all, sound-ch-*). loadRecordings() runs
  from ensureGraph (never on file://). RAIN_GAIN 0.19: on the engine
  offline, A-weighted -39.1 dBFS against -38.8 for the drop-built rain.
  THUNDER_GAIN 0.42: its peaks about 10 dB over the rain. Each clap plays at
  rate 0.86-1.08 and duller the further off (LP 4200 - 2800 x far);
  the made thunder is the fallback. The synthesized car is gone. Now
  noir-traffic voice() gives {n, x, z, v, k}, and noir-fx hearCar runs
  every 60 ms: the car from the board to camera space, near =
  (5/max(5,d))^0.8, pan clamp(2x/d, 0.85), cutoff 2000 + 9000 x
  (5/max(5,d))^0.7, then audio.carSound(s) (or null). Each car gets an
  engine loop (rate 0.75 + 0.92 v) and the tyres (rate 0.75 + 0.4 v, gain
  1.1 x min(1.2, v/0.62)), through LP and panner into "city" with a 0.12
  send. CAR_GAIN 0.24 puts a near car about 2 dB over the rain and a far one
  about -6 dB. As it picks up (v from under 0.45 to over) it revs: the rev
  one-shot plays with the loop ducked to 0.12. theme.soundCredits
  shows on the About card (info-sound-credits). Test e2e-noir-sound
  (replaces e2e-noir-rain; tools/noir_rain.py removed). Over http: the
  six files, the recording, the sliders, Rain to 0 and back, a car heard,
  revving, gone, the thunder, the credits. From disk: the made rain, nothing fetched, no
  car. Cars crawl on the software renderer (a frame's dt capped at 0.1
  s), so it spawns them part-way along (spawn({street, at})). Scratch
  noirrain/render4.mjs renders a scene on the engine offline (a car
  pulls out, passes, thunder); sent the user noir-rain-cars-thunder.mp3
  (8 s of the old rain, then the new).
- GitHub browser tests #16 (12abc42), two failures, neither in what
  that push touched:
  - e2e-den-spot "the frame on the screen": mean -28 ms, 90% within;
    #15 had -31 ms, 84%. The video's clock on the runner sat a steady
    13-14 ms behind its target (range -14..-13 ms). den-commercial.js
    left the video alone anywhere within 15 ms of the sound (CLOSE). It
    started a little behind and stayed there; the frame on the screen,
    of a 24 fps spot, is a further 0-42 ms back. Now it's nudged once
    6 ms off (CLOSE) until within 1.5 ms (HOLD), then set to exactly 1
    (rateTo's 0.004 step would leave it a hair off).
  - The test also measured against the sound 6 ms early: the master
    compressor's look-ahead delays it, as den-ad-audio.js heardNow
    allows. __EC_AD_SCHED__.lookahead now gives the test that figure.
  - Local results, the clock and then the frame: unthrottled -1 (-3..-1)
    and -4 ms; CPU throttled x4, -1 (-2..0) and -20 (-29..+4) ms, 100%
    within, one rate change in the spot (the old code there: +2 and
    +2 ms, -6..+98, four changes). Scratch densync/den-spot-dump.mjs
    (THROTTLE=4 DUMP=file.json; show.py).
  - e2e-nova-mobile "the bar layout is remembered": after a reload the
    den's lure wasn't held off (diagnosed before, history/10.md, never
    fixed). On the slow runner it had the screen before the bar was
    seen. holdLure(page, ms) now runs after both reloads too (45 s),
    and a failure reports the stored layout, the bar, the dock and the
    lure.
  - CI logs: `gh api .../actions/jobs/<id>/logs` comes back empty here;
    mcp__github__get_job_logs (return_content, tail_lines) works. A
    passing test's lines aren't in the log, only its pass.
- GitHub browser tests #17 (617c374, the recorded Noir sounds): all
  passed but e2e-summon (#148, shard 8, the faster machines again:
  e2e-outline 77 s, e2e-singularity 185 s). Its diagnostic line
  (cd46547) wasn't in the log: run-e2e printed only the last 25 lines
  of a failed test, all passes after the miss. run-e2e now prints every
  FAIL line above the tail first. Next faster-machine run: read it.
  e2e-den-spot and e2e-nova-mobile passed in #17 (before the fixes
  above).
- GitHub browser tests #18 (0ee4025): all 8 shards green, e2e-den-spot
  and e2e-nova-mobile with their fixes. e2e-summon passed too, but on
  the slower machines (shard 8: e2e-outline 105 s, e2e-singularity
  222 s), where it always has. #148 waits on a faster-machine run.
- After a game, the corner piece calls (user: "When a game ends, and the
  user is using the regular, 3D button, have the minimized / badge
  version become highlighted whilst in the bottom-right corner, to help
  guide the user to open to see other options... in Noir, the badge size
  piece can become lost visually").
  - When: chassis dockCall = !shell && game over (status finished or
    ended) && dockView "corner" && !dockCallSeen && !replaying.
    dockCallSeen is set once the dock's open after the game (a game
    ended with it open counts), and cleared in play. So it calls only
    till it's been found, every game.
  - The call:
    - The mount at opacity 1, not theme.dockCornerOpacity / 0.35, with
      data-dock-call="true".
    - The canvas breathing: ecDockCallHalo, brightness and a
      drop-shadow in --ec-dock-glow, inside the 4-9 px the clip
      leaves round the piece.
    - A pool of light behind it, data-testid dock-call-aura: its own
      fixed layer at z 1 on the corner box's centre, ecDockCallAura,
      2.4 s. The mount is clip-pathed to the piece's hull (its tap
      area), so a glow drawn on the mount would be cut off.
    - A hop: nudgeDockPiece, squash and stretch 0.16 over 560 ms, every
      4.8 s, the first at 0.9 s. It has its own state.nudging flag, so a
      tap's bounce takes over.
    - Reduced motion: a still glow, no hop.
    - Hidden in cut-scenes (the points counter's scene rule) and with
      noGame.
  - The colour, dockGlow: theme.dockCallGlow if the theme names one,
    else theme.pointsGlow for the side the piece shows (picked as its
    mesh effect picks it; else the accents). If that light hardly shows
    on the page (COLORS.pageBg), the other side's, when it shows better.
    "Shows" is glowShows (module level): the WCAG contrast the page
    makes with the light drawn over it at 55%, the strength at the
    pool's middle, with a threshold of 3. Plain colour contrast misses a
    dark light on a dark ground.
    - Swiss Design's white on white becomes its red #e63946.
    - Minimal Mono's white on white becomes grey #bfbfbf.
    - Parrish names its own (parrish.js dockCallGlow): the look's ash,
      #d9b77e and #d4a86c, candlelight on the painting. Walnut barely
      shows: Watermark's dark hardly lifts, and on Orinoco's sky
      (#7fa9c7 by the corner) it reads as a smudge, not a light. (A
      first try measured a "dimmed" painting after a game, #384d6e and
      #120507. That was the victory card's backdrop, still up because
      Escape had come before the card opened. Wait for the card before
      putting it away: scratch worlds.mjs does now.)
    - The rest keep their own: Noir lamp white or grey, the den
      lamplight or firelight, Neon cyan or amber, Lluvia's neon, Luna
      gold, Plano white, Cromo chrome white, Tienda gold.
  - The parked Lab report ("after a win the minimized menu cannot be
    raised") is this corner piece. Here a tap on it opens the dock after
    a win in the Lab (Swiss Design), so the call may be what was missing.
  - Test e2e-dock-call (in run-e2e): Noir in play, after a win, opened,
    put away, the next game, ended from the open dock; reduced motion;
    the den, Neon, the Lab, Orinoco's and Watermark's colours. (Its first
    check, the faint watermark in play, is polled: one run in four read it
    before the corner's fade had begun.) Scratch dockcall/:
    shots.mjs, worlds.mjs (WAIT=ms) and lab.mjs; noir-corner-call.mp4
    sent.
- Lab, "after a win the minimized menu cannot be raised" (open reminder
  since 2026-10-10, parked): closed by the user, 2026-10-11: "Forget the
  lab menu bug. I can't reproduce it, either, but if it happens again,
  I'll let you know." Off the open reminders; don't remind. (The
  corner piece it was about now calls after a game: dockCall above.)
- Noir's police sirens, recorded (user: "Noir needs better time-period
  appropriate police sirens"; it was a triangle wave sliding 520-760 Hz).
  - The sound: a police car's mechanical siren of the 1930s-50s, a
    motor's rotor winding up to a scream and growling down as it slows.
  - Sources in assets/noir/src (CREDITS.md):
    - craigsmith's "S06-04 Old mechanical police siren" (675700, CC0,
      the Hollywood studios' library). Its two clean goes make
      siren-1.mp3 (a wind-up, hold and long growl down, 13.45 s to the
      end) and siren-2.mp3 (a wind-up and fall, 1.6-13.4 s).
    - CGEffex's "Old Police Siren" (121902, CC BY 4.0, credited on the
      About card), a real one run off a car battery. Its first half
      minute, the chase pulsed up and down then wound down (0.4-31 s),
      makes siren-3.mp3.
    - Passed over: craigsmith's dry studio take (noise floor), and the
      motorcycle and crash takes (buried in engines).
  - tools/noir_sounds.py siren(): high-pass at 100 Hz, low-pass at
    9 kHz, the loudest 2 s at -14 dBFS, 80 kb/s mono. The tool now
    takes step names (`... noir_sounds.py siren`).
  - noir-audio.js siren(), every 55-120 s (the first at 35-65 s):
    - A random pick; a quarter of them a street or two off (LP
      3400 Hz, SIREN_GAIN 0.13, dry 1 / send 0.45). The rest across the
      city (LP 1300-2000 Hz, x SIREN_FAR 0.4, dry 0.7 / send 1).
    - Rate 0.94-1.04, drifting 1.2% down over its length (going
      away). Panned from one side toward the middle.
    - No made siren without the recordings: from disk there is none.
    - debugState sirens / lastSiren; api.siren for tests.
  - Calibrated on the engine offline (scratch noirsiren/render/
    render5.mjs), the siren alone against the rain, A-weighted,
    loudest 3 s: far -1.4 to -2.8 dB, near +3.7 dB.
  - Sent the user noir-sirens.mp3 (far, near, the chase).
    noirsiren/tools/look.py draws spectrograms with PIL (matplotlib
    won't load under python3 -I).
  - e2e-noir-sound now checks the three files, a siren playing on cue,
    none from disk, and the CGEffex credit.
- Big Glutts' flyer: the real charge cards of 1975 (BankAmericard,
  Master Charge) replaced by the user's made-up ones: "Charge it! Big
  Glutts Charge • BankAmericorp$ • Disaster Charge"
  (tienda-overlay.js). There were no card names in the ad images.
- The user asked whether they can put a © notice on the game without a
  registered copyright. Answered in chat: copyright is automatic in
  their own human-authored work, and the notice is optional. Only a
  knowingly false notice is an offence, so scope it to their own
  material, or use a plain "Created by" credit.
