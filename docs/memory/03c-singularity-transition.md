## 3c. Singularity cinematic transition (Futuris-only) — Part 1 of SINGULARITY_DESIGN.md, BUILT

Holding the revealed Singularity button to commit no longer just opens a
static "coming soon" info card. It now runs a real collapse → hard-cut-
to-black → draggable Fresnel-glow sphere sequence, in a new module,
`themes/futuris-singularity.js`, kept separate from `themes/futuris.js`
(already 6000+ lines) rather than inlined.

- **The bridge is a plain object on `three.current`, not React state.**
  `useSingularityPhase` (called from `useSetupExtras`) owns the React
  `phase` state the DOM overlay renders from, but the actual per-frame
  3D animation runs inside `mountAmbientEffects`'s existing tick — a
  *different* hook invocation, in a different closure. Both close over
  the *same* `three.current` object (chassis-owned, mutated in place,
  never reassigned after initial scene setup), so `t.singularity = {...}`
  written by one is visible to the other with zero new chassis-to-theme
  event/callback plumbing. `advanceSingularityScene(t, now, chromeRefs)`
  is the function mounted into that tick; see its call site in
  `themes/futuris.js`'s `mountAmbientEffects` right before
  `renderer.render(...)`.
- **Two additive chassis changes, both in `chassis/ElCabeza3D.jsx`**:
  `three` is now also passed into `theme.useSetupExtras(...)`'s call
  (previously only `mountAmbientEffects` got it) — needed for
  `commitSingularity` to reach the bridge object at all; and `cam` is
  now passed into `mountAmbientEffects`'s helpers alongside `three`,
  for a possible future camera move during collapse (currently unused —
  everything shipped works through `three` alone).
- **The funnel warp is a NEW mesh, not the live board warped in place.**
  The real slab (`BoxGeometry`) and grid (raw 2-vertex `LineSegments`
  per line) don't have the vertex density for a smooth curve. A
  lazily-built, subdivided `PlaneGeometry(64,64)` with a custom
  `ShaderMaterial` (`wireframe:true`) fades in as the real grid's
  opacity fades out. This is the **first custom shader in this
  codebase** — same for the sphere's Fresnel-rim `ShaderMaterial`.
- **The hard cut is genuinely same-frame.** `cutSingularityAudioToSilence()`
  (new, in `themes/futuris.js`'s `createSoundscape()`) zeros the single
  shared `master` gain node — silencing every bus (hum/ambient/events/
  sfx) in one call — and hard-stops the hum's oscillators immediately
  (unlike `stopSingularityHum`, which deliberately lets a 7.5s tail
  ring — the opposite intent). This fires in the exact same synchronous
  branch that snaps the black overlay div's opacity to 1 with
  `transition:"none"`, inside `advanceSingularityScene`'s
  collapsing→blackout transition — never split across two frames/
  effects, or the screen and the silence visibly disagree.
- **Pieces are moved by direct mesh mutation** (position/scale/
  quaternion), a new array (`t.singularity.collapseItems`) captured
  once at collapse start — deliberately NOT the chassis's `anim.current`
  (a single-slot, one-piece-at-a-time mechanism, wrong shape for ~10
  pieces converging at once). Because this bypasses the normal
  pieces-state render path, **nothing else restores piece transforms
  afterward** — the escape hatch (`teardownSingularityScene`) must
  explicitly copy every piece back to its captured base
  position/scale/quaternion, or they're left tiny and displaced. Found
  by actually taking a screenshot after Escape and looking at it, not
  by the phase-transition assertions alone — a real lesson: this
  feature's correctness lived in visual/manual checks Playwright's
  `data-*` assertions couldn't have caught (also true of the "black
  overlay never fades back down for the sphere phase" bug, and the
  "masthead/dock chrome still shows through the transparent overlay"
  bug — both only visible in an actual screenshot, both fixed here).
- **Masthead + dock chrome must be hidden explicitly.** The overlay div
  only covers the 3D canvas; the masthead/dock are separate DOM layers
  stacked above the canvas but below the overlay's own z-index, so once
  the black cutout fades transparent for the sphere reveal, they show
  through unless faded out too. `advanceSingularityScene` takes
  `chromeRefs` (`{titleWrapRef, cardRef}`, the same refs
  `mountAmbientEffects` already receives) and fades their opacity once
  per collapse start, restoring them in the escape hatch.
- **Test hooks** (Playwright can't read Three/Web-Audio internals):
  `data-singularity-phase` on the overlay root; `window.__EC_TEST_MASTER_GAIN__`
  mirroring the real `master.gain.value`, written at every place it
  changes; `window.__EC_TEST_SINGULARITY__.sphereRotationY` for the
  drag-rotate assertion. See `tests/e2e-singularity.mjs`.
- **No longer accurate, kept for history**: the line below used to say
  the sphere carried only placeholder DOM text. That's since been
  replaced by a real UV-mapped, raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — see §3d.
- ~~Deliberately out of scope, per an explicit decision recorded in
  SINGULARITY_DESIGN.md: the sphere's surface is simple placeholder
  DOM text, not the real UV-mapped/raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — those rules systems don't exist yet.~~
- **The invite's halo, square** (2026-10-22; user, with a screenshot of
  the SINGULARITY invite, its top and bottom circled: "edges on the top
  and the bottom of this overlay. I'm not sure why they're there. I
  don't know why. And it seems like the halos kind of cut off, as if,
  I'm not sure. I would like for this to be extended out, as you know,
  naturally throughout the entire page. I'm not sure why it gets cut off
  like that."). The halo behind the word (`.ec-singularity-halo`,
  radial-gradient circles, farthest-corner) sat in a box 175% x 300% of
  the invite button, wide and short on a phone (687 x 264): the rings,
  sized to the box's corners, ran past its top and bottom and were cut
  off flat there, the hard edges above and below the word. Now the
  invite's halo is square (`width: 175%; height: auto; aspect-ratio:
  1 / 1`; themes/futuris.js): its last stop (70% of the corner
  distance) falls inside the round edge, so the glow fades out all the
  way round, over the page (phone 687 x 687, desktop the same shape).
  Before and after screenshots at the halo's brightest moment
  (scratchpad halo/shot.mjs, the 38% frame held).
- **The first visit's drone comes in with the scramble** (2026-10-22;
  user, with a screenshot of the sphere's first visit, the hand's card
  up: "For some reason, the audio on this site is coming in a lot later
  than it used to. It should start as soon as the page scrambling
  starts, and the volume needs to be turned down about maybe 15% on
  it."). The user's industrial drone (futuris-unease.js createDrone)
  had been scheduled 9.6 s after the sphere came up, whatever happened,
  fading up exponentially from -80 dB over 2.5 s, so silent for its
  first 1.5 s (heard from about 11 s). The menu comes apart (LostNudge
  unravel) at the first of: a menu open 6 s, three taps in menus, eight
  touches, or 25 s untouched (then a menu opens by itself and comes
  apart 1.8 s later): with a menu opened in the first few seconds the
  scramble began before the drone was heard, by the card at the latest.
  Now the drone is fetched as the sphere comes up and started by
  unravel itself, the moment the menu starts coming apart (G.drone.start
  (0, 0.35)): a straight 0.35 s ramp, heard at once, to DRONE_LEVEL
  0.425 (was 0.5; 15% down, the way "N% quieter" has always been taken
  here: the level times 1 - N). Untouched, the sphere is quiet after the
  ring until the scramble at about 27 s. Measured over HTTP (from disk
  there's no drone; scratchpad drone/measure.mjs, run.sh: the source's
  start logged against the page's data-unravel): before, scheduled at
  9.59 s with the scramble at 14.08 s; after, a menu opened: scramble
  14.25 s, drone 14.30 s; nothing touched: scramble 26.83 s, drone
  26.87 s.
- **Light reverbs on a Chromebook too** (2026-10-23; user: "On a desktop /
  Chromebook, when "Singularity" is clicked the audio cue doesn't
  successfully trigger. The sound of going through the black hole and the
  'ear-ringing' when you arrive are absent. Something was preventing it
  from playing."). The tap on the invite starts long reverbs at once (the
  last thunderclap's 10 s, the toll's 11.5 s, the hum's 6.5 s, then the
  fall's 4.2 s, with the summons' room and thunder reverbs still going
  and the ring's room at the sphere), all stereo on a computer: measured
  offline (scratchpad sing/cost.mjs) 29.5% of a core's real time here,
  where the light set (one channel, the long ones shorter, as a phone has
  had since the Android phone's sound stopped dead at the same tap) is
  8.5%. A Chromebook's core is two or three times slower, and the fall
  loads its graphics too: the sound drops out. A test browser here plays
  it all (desktop, phone, by the set or the pull: scratchpad
  sing/measure.mjs, an analyser on every context), so it's the machine.
  Now the light reverbs (futuris-summon-audio.js lightReverbsFor, used by
  the summons, futuris.js's makeImpulse and the ring's room in
  futuris-unease.js) go to a phone and to a computer that may not keep up:
  a Chromebook (CrOS), 4 GB or less, or two cores or fewer;
  localStorage ec:reverbs = light | full overrides. The summons' mix (its
  EQ) is still by touch. Tests: tests/futuris-reverbs.smoke.mjs (which
  devices), e2e-summon (the phone's sound light), audio-bell (pinned to
  the full set: the loudest case, and the toll's long ring-out).
  First pushed with "four cores or fewer" too (af606c8): that took in
  ordinary four-core computers, the test machines among them (GitHub's
  runners and this container report four), and CI's audio-bell failed,
  the toll no longer ringing 10 to 12 s after the click (its tail
  0.0001), the light set's shorter reverb. A four-core desktop keeps up
  with the full set (the test machines played it before), so now two
  cores or fewer.
- **The sphere in the middle of the screen on arrival** (2026-10-23; user,
  a phone screenshot of the sphere well above the middle: "After you go
  through the black hole, it seems like that the sphere should be
  centered ... if it's making room for when the hand shows up, then it
  can slide up at that point. But I think when you first arrive on that,
  it should be centered on the screen."). It sat at the board's middle,
  where the board's framing camera put it: 41% down a 450 x 1000 phone
  in the test (36% in the user's). Now it rests where the middle of the
  screen is at the board's middle's depth (futuris-singularity.js
  sphereRest: the screen's centre unprojected at that depth, so its size
  is the same; its arrival from near the camera eases in to that point);
  while the lost card (the hand) is up it slides up just clear of it, 16
  px above the card's top (LostNudge sets s.lostCardTop; a quarter-second
  ease). Measured (scratchpad flyer-go sphere-probe.mjs): before 41.2%
  down on arrival and with the card; after 50.0% on arrival, 43.2% with
  the card (its top at 633 of 1000).
- **A slow frame can't skip the fall, or its sound** (2026-10-31; user, on
  a laptop: "When you click on the word singularity on a desktop version,
  it's still not keeping this. It loses the sound for some reason. The
  sound drops out, and then the next thing you actually hear is the
  ringing when you see the sphere. So there's still an issue with the
  audio on laptop, desktop."). Measured first (scratchpad sing/: bands,
  stress, hog, laptop, frames). Not too bassy for a laptop: weighted as a
  laptop speaker (a 400 Hz high-pass) the toll measures -40 to -50 dB, the
  fall -31 to -39, the ring -41 to -46, so a laptop plays the toll and the
  fall as loud as the ring; the sound wasn't being made. Not the audio
  thread here: Chrome's AudioContext.playoutStats (fallbackFramesDuration,
  silence played for late frames; behind
  --enable-experimental-web-platform-features) counted no dropped audio
  on four cores, one core, or one core with a busy process taking 60% of
  it, full reverbs or light. The main thread froze instead: 3 to 6.5 s
  after the tap on a starved core. The collapse ran on the wall clock
  (u = (now - collapseStartedAt) / 3600) and its first frame built the
  whole fall (ensureSingularityObjects) and compiled its shaders: a frame
  of seconds (a slow machine's graphics) found the fall over on the next
  one, straight to the black and the hard cut, the fall and its sound
  never there; the ring, after the cut and outside master, played. That's
  the user's account. tests/e2e-singularity-stall.mjs reproduces it (the
  page frozen 4 s as the collapse begins): before, 0.4 s after the thaw,
  blackout and master 0. Now: (1) COLLAPSE_STEP_MAX_MS = 250: no frame
  moves the fall on by more than a quarter second (collapseStartedAt
  slides forward by the rest; everything reading the time since the start
  reads the fall's own clock; the dive camera keyed by collapseRun, once a
  collapse); 4 fps or better keeps the wall clock's time, so a slow
  machine's fall isn't stretched. (2) The toll makes the collapse ready,
  two frames in: ensureSingularityObjects and renderer.compile (r128's
  compile traverses every object, visible or not), under the curtain and
  the bell (the bell is on the audio clock, the curtain's fade the
  compositor's). (3) Futuris's AudioContext at the device's rate, up to
  48 kHz (themes/audio-context.js makeAudioContext; tests/
  audio-context.smoke.mjs): a sound card set to 96 or 192 kHz, as some
  laptops come, runs every node two or four times over, the long reverbs
  most (a 10 s stereo convolver costs 7% of a core here at 48 kHz), and
  late audio plays as silence. (4) The summons' hum voices (fifteen saws,
  thirty LFOs) and the thunder's bed stopped once they've faded at the
  tap (futuris-summon-audio.js bedSrcs), not computed silently on for the
  last clap's 11 s. After: the stall test plays 3.3 s of the fall after
  the thaw, sound on, then the black and the cut there.
- **The way in, recorded, where the audio can't make it live**
  (2026-11-09; user, of the backlog's "does the Singularity's sound play
  on your Chromebook now?": "The sound when traveling through the black
  hole still isn't happening on the Chromebook."). Neither earlier fix
  (the light reverbs, 2026-10-23; the slow frame, 2026-10-31) was about
  the real limit. Measured here with the Chromebook's user agent (light
  reverbs), Chrome's audio thread ("AudioOutputDevice", read from
  /proc/<pid>/task/*/stat) through the toll and the fall: about 35% of a
  core on the story's way in (the summons first) and about 15% from
  Futuris's own page, where the sphere after needs 12% and nothing before
  the tap. Five long reverbs run at once on the story's way (the summons'
  room 2.4 s and thunder 3.5 s, its last clap's tail 5.5 s, the toll's
  5.1 s, the hum's 3.1 s, all light): with their impulses cut to 256
  samples the fall needs 9%; the summons' three are 17 points of it, the
  toll's and the hum's 9, the oscillators, noise and shapers the other 9
  (the shapers' oversampling under 1). A Chromebook's core is three or
  four times slower, and its two cores are busy with the fall's graphics
  too: what the audio thread can't make in time it plays as silence. The
  sphere's 12% it keeps up with (the ring is heard). Here, even slowed
  eightfold (the page's main thread, CDP throttling), the fall was heard:
  it's the audio thread. Now, where the reverbs are light
  (lightReverbsFor: a phone, a Chromebook, two cores or fewer, 4 GB or
  less), the toll (bell), the toll's hum, the fall (the hum through it,
  the roar, the pull) and the summons' last clap play from recordings of
  that same code: themes/futuris.js `renderWayIn` and
  futuris-summon-audio.js `renderLastClap` build it in an
  OfflineAudioContext (`createSoundscape({ context })`: every stage at
  unity, no last stage, the full reverbs; the frames' calls made at 60 a
  second through suspend()), and tools/singularity_way_in.mjs renders five
  takes of each (the reverbs' impulses and the strikes' noise are random:
  one bell came out 3.5 dB under the live one), keeps the middle by
  loudness, crossfades the holds into loops (the hum's 3-5.5 s, the
  fall's 4-6.4 s; WAY_IN.xfade 0.4 s), raises each by WAY_IN.scale for the
  encoder (taken off as it plays) and writes assets/futuris/way-in-
  {bell,hum,fall,clap}.mp3 (48 kHz stereo 128 kbps; Opus twins about 420
  KB in all). Played: the bell onto the bell's bus (its reverb no longer
  made: ensureBellReverb only for the live bell), the hum into the
  interface gate from the tap (it builds 2 s, then holds however late the
  collapse comes), the fall in over 80 ms at the collapse's start (from
  the recorded hum, or from the live one if the recordings came after the
  tap: the fall is the heavy part) holding its climax till the cut, which
  stops both (master to 0 as ever); the clap onto the summons' mix bus
  (the phone's treatment after it), the summons' room and thunder reverbs
  disconnected 0.45 s after its hum's fade, its way out kept till the
  recording's end. Asked for when Futuris's graph is made (the summons'
  start on the story's way, the masthead's taps on its page) and again as
  the invite comes up (prepareWayIn); not here by then, the live sound,
  as before. localStorage "ec:way-in" = "live" turns it off. Measured
  after: the audio thread through the toll and the fall 4.3% on the
  story's way (was 34%), 2.2% from Futuris's page (was 15.8%); the
  levels a quarter second at a time match the live full set's (the bell's
  strike -6 to -9 dB against -9, the hum's build, the collapse -7 to -15
  dB, the cut, the bell's ring-out -16 to -19 dB, the clap's tail -13 dB
  dying to -38 by the cut). A desktop is unchanged (made live, the full
  set: audio-bell). Test: tests/e2e-way-in.mjs (served over HTTP: Futuris's
  page on a light machine; the recordings let go only after the tap; the
  story's way with the summons; a desktop; "live"). Changing the toll,
  the hum, the roar, the pull or the last clap: run the tool again
  (11-fragile-areas.md).
