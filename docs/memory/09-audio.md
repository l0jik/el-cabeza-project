## 9. Audio architecture

Every theme's `createAudio()` interface exposes the **same full set of
methods always** (no-ops where inapplicable) — the chassis never branches
on "does this theme have audio." Both Standard and Futuris currently have
`hasAudio = true`.

- **Master-gain-per-subsystem is a hard rule for mute to work.** This was
  violated twice and had to be fixed both times: (a) the unified app's
  theme-switcher SFX (`apps/unifiedTransition.jsx`) originally wired
  every node straight to `ctx.destination` with no master gain at all —
  completely unreachable by the mute toggle; (b) mute state itself was
  getting silently reset on every theme switch because `ElCabeza3D`
  remounts via `key={themeName}` in the unified app. Mute now lives in
  `UnifiedApp` state, **above** the remount boundary, passed down via
  `initialMuted`/`onMutedChange` props (defaulting to `false`/no-op so
  the standalone single-theme builds, which pass neither, are
  unaffected). Any new independent audio subsystem must follow the same
  routing pattern from day one.
- Futuris's audio engine splits `ensureGraph()` (builds routing, doesn't
  start the ambient bed) from `ensureStarted()` (also starts the bed) —
  needed so pre-Begin-Game sounds (Singularity reveal, Info overlay
  choir, Anomaly blip) can play without waking the ambient hum meant to
  fade in only after Begin Game.
- `resetWindDown`'s `"sfxOnly"` mode: after New Game, one-off UI cues
  need audio working immediately even though the ambient bed is
  deliberately silent until the next Begin Game. It restores master gain
  but explicitly zeroes `introGain` — the original implementation had
  instead pinned master at 0, which silenced *all* audio, not just
  ambient.
- One-off SFX (`playPowerOn`/`Off`, Singularity, etc.) must call
  `ensureGraph()` and resume a suspended `AudioContext` **themselves**,
  not rely on a prior `beginGameFadeIn()` call — mobile browsers suspend
  the context on backgrounding/lock, which left these silent on mobile
  until this was fixed. A `visibilitychange` listener also proactively
  resumes a suspended context.
- Any audio-graph-starting call must be wired **directly into the
  triggering click/gesture handler**, not fired from a `useEffect`
  reacting to state one tick later — some browsers only allow
  synchronously resuming/building an `AudioContext` within the original
  user-gesture call stack (the Info overlay's choir stab broke this way
  once).
- **Every recording ships as Opus beside its MP3** (user, 2026-10-25:
  "Let's go with Opus, a safer quality"). tools/opus_twins.py writes
  `<source>.opus` beside each assets/ MP3 that dist/ uses (matched by
  content; two thirds of the MP3's bitrate, at least 32 kbps mono or 64
  stereo, VBR, the MP3's channels, no tags) and build/build.js copies each
  one beside its MP3 under the same name. **After changing or adding a
  recording, run it again** (`npm run build && FFMPEG=<ffmpeg>
  python3 tools/opus_twins.py`; a twin older than its source is rewritten,
  `--force` rewrites all), or the old twin is what plays.
  chassis/sound-files.js is the one place that picks: `PLAYS_OPUS`
  (canPlayType `audio/ogg; codecs="opus"`); `loadSound(ctx, url)` (fetch
  and decode, the MP3 if the Opus fails either way); `fetchSoundBytes` +
  `decodeBytes` for callers that keep the bytes; `soundElement(url, el?)`
  for an `<audio>` (over to the MP3 on its error event). The code names
  every recording by its MP3: a new sound goes through these, never a bare
  fetch or `new Audio(url)`. apps/title-screen.js isn't a module, so it
  has the same choice written out. Checked (decoded in the browser at
  48 kHz, scratchpad opus-check/twins.mjs): every twin's length equals its
  MP3's to the sample and the two line up (0.00-0.06 ms), so the loops,
  the stabs' slices and the den spot's sync are unchanged. Sizes: 38.5 MB
  as MP3, 27.6 MB as Opus; a browser downloads only the one it plays.
  Measured before choosing (opus-size/measure.py, zipped): Opus at half
  the bitrate 20.7 MB, at two thirds 27.5, AAC at three quarters 28.7.
  Both test browsers play Opus (only CI's plays AAC:
  02-build-and-verification.md). Apple plays Ogg Opus only from Safari
  18.4 (iOS/iPadOS 18.4, macOS Sequoia 15.4; Apple's release notes, March
  2025): older ones get the MP3. Apps (tools/app_size.mjs): Android ships
  the Opus alone (35.1 MB zipped, was 45.4), iOS the MP3 alone (60.6)
  unless the app requires iOS 18.4.
- **The Parrish stutter report (2026-10-25, user: the music "very
  glitchy ... like it's trying to cache").** Not reproduced on the
  server. Ruled out: the network (every song, the evening and the
  opening/closing are fetched whole and decoded before they start,
  AudioBufferSourceNodes on the audio clock); the files (all six scanned
  for dropouts, clicks and repeats: clean; scratchpad
  parrish-audio/scan.py); the code (nothing restarts or interrupts a song
  while it plays). Measured (Chrome's `webaudio` trace, CfT 153, a game
  begun, scratchpad parrish-audio/trace.mjs): the audio thread busy
  7.4% in Orinoco (its two ConvolverNodes the most; the den 2.8%,
  Watermark 2.9%), no render over its 10 ms here; the renderer's memory
  385 MB Orinoco, 460 MB Watermark, 287 MB the den (the songs and the
  evening held decoded: about 80 MB a song). Starved (browser held to two
  cores with taskset, software GL), every world stutters, the den too, so
  that test can't single Parrish out. Chrome's buffer by latencyHint
  (desktop Linux): interactive and balanced 10 ms, playback 23 ms, a
  number (0.1) about 100 ms; nothing in the game sets one. The fix
  offered: the long recordings (songs, evening, opening, close) on their
  own AudioContext with a deep buffer (latencyHint about 0.1), the
  pieces' sounds left on the quick one; and, optionally, the songs
  streamed (an `<audio>` element) rather than held decoded.
  Streaming alone (user, 2026-10-26: "Would streaming the songs fix the
  issue? Question mark."): not if the streamed songs still go through the
  one AudioContext (createMediaElementSource): they'd be made on the same
  10 ms schedule as now. Played outside it they'd get the media player's
  own deep buffer, but lose the shared compressor, the fades and the
  music slider (rebuilt on the element), the evening, opening and close
  would still need the deep output, and a slow connection could stall a
  song mid-way (fetched whole today, that can't happen). What it would
  help: memory (about 80 MB a song) and the whole-song decodeAudioData
  bursts (at the start, and SONG_PREFETCH_S, 25 s, before each next
  song). The user's answer to "from the opening, near song changes, or
  all through" decides it: bunched at the start and the changes, the
  decodes; all through, the steady load.
- **The now-playing strip's back button (2026-10-28).** Parrish's
  soundtrack: back and forward where the look has more than one song
  (Watermark), back alone where it has one (Orinoco's "Dodhéanta an
  Ghrian"; user, a screenshot of its strip with the pause button ringed:
  "Need a button to skip back to the beginning of the track."):
  nowPlaying() says `restart` once the song's here, NowPlaying.jsx draws
  |◀ before the round button, and skipSong(-1) with one song takes it to
  its start (looped, it comes in over SKIP_SEAM_FADE_S; paused, it stays
  paused there). The den's records and the store's tape have neither.

**Standard's wood-impact percussion — do not re-attempt a resonant-filter
approach.** Three full rewrites happened before landing on the current
one:
1. Additive sine tones with per-mode envelopes — reported "wildly off
   the mark," fully reverted.
2. A physically-motivated modal filter bank (resonant bandpass per mode)
   — technically careful DSP, but **a narrow bandpass excited by a broad
   impulse IS a decaying sinusoid**, which reads as metallic
   "boing"/vibrato regardless of how the envelope or gate around it is
   tuned, because the ringing is the filter's own impulse response. Q was
   lowered, fundamentals dropped an octave, tails hard-gated — the
   character never fully left because the mechanism itself was wrong,
   not the tuning.
3. Granular/absorption synthesis (brown noise + dynamic-sweep Butterworth
   "absorption" path) — replaced the resonant-filter architecture
   entirely to escape the pitched-ringing problem at its root.

**Current, kept recipe** (much simpler than any of the above): a
pitch-dropping sine body (150Hz→40Hz) choked by a fast exponential
envelope, a short noise-click transient, and a literal 10-tap
moving-average filter as the muffle stage; `mass`/`velocity`/`contact`/
`board_density`/`wood_dampening` modulate the constants. Public API
(`impact_event`, `roll_sequence`) has stayed stable across all four
attempts. **If asked to revisit this sound, don't reach for resonant
filters/modal synthesis again** — it's been tried twice in different
forms and specifically rejected both times for the same underlying
reason.

- **What a slow machine can't make live, it plays recorded** (2026-11-09;
  03c-singularity-transition.md). Chrome's audio thread is the limit on a
  Chromebook or a phone, not the main thread: what it can't make in time
  comes out as silence, and long ConvolverNode reverbs are its biggest
  cost (about 5% of a fast core each, light or not). Measure it from
  /proc (the renderer's "AudioOutputDevice" thread's CPU time over a
  window) rather than offline renders, which miss the live overheads. The
  way into the Singularity is the first sound made both ways: live on a
  desktop, recordings of the same code on a light machine
  (tools/singularity_way_in.mjs renders them offline in the browser from
  the game's own soundscape: createSoundscape({ context }) builds into an
  OfflineAudioContext, every stage at unity).
- **The Lab's Monolith speaks in real stone, recorded** (2026-11-10;
  user: "I want the sound palette to be non-synthesizer generated. I
  want real massive: thud / boom / scraping sounds that follow the
  implementation instructions previously outlined, per weight dictating
  pitch, etc."). Nine CC0 recordings from freesound.org
  (assets/monolith/src/, CREDITS.md: who made each, and its page), cut by
  tools/monolith_sounds.mjs (Node and ffmpeg: cuts, fades, a high-pass
  under the rumble, levels, nothing synthesized) into three files the Lab
  page carries beside it, each with its Opus twin: hits (one a second:
  five heavy thumps on stone, four rocks and a brick knocked, two rubble
  thumps), falls (a concrete smash, a rockfall's blocky chunks, rocks
  tumbling down stone stairs), drags (a stone door's slab grinding aside,
  stone rubbed on stone, each baked into a seamless loop: its last 0.3 s
  crossfaded, equal power, into the 0.3 s before its start).
  themes/lab/monolith-sounds.js is the layout both read and the weight
  rules, after the wooden pieces' (wood-sfx.js massOf, landingSize).
  Heavier since (user: "These are massive monolithic stones slamming
  down ... they need to be weighted appropriately as they fall"): a
  landing is pitched by playing slower, 0.86 for a cube down to 0.51 for
  an Opa coming down flat (landingRate = 0.86 / landingSize^0.25: every
  stone below the recording; a recording slowed past an octave smears),
  and as loud as its cubes times how far it fell going over (slamOf: the
  chassis passes rollDrop, engine/shapes.js, half the end's diagonal less
  half its new height: a cube 0.21, a Flaco tipped off its end 0.62,
  stood onto it 0.12, an Opa 0.41; 0.6 to 1). A landing is the thump; the
  same thump an octave further down under it, only below 140 Hz, more of
  it the deeper the face and the harder the fall (the weight); a knock
  (not the brightest) dulled under 3.2 kHz, the grit a phone's speaker
  carries; after a hard fall (slam over 0.3) the rubble shaken loose; and
  the echo off the stones round the plain (two dull delayed taps, no
  convolver), more the harder. Measured offline (OfflineAudioContext, the
  Lab's own graph): a Turrito about as loud as before but deeper and
  longer (0.66 s within 30 dB), a Flaco or Chato tipped off its end some
  6 dB over before, an Opa 3 dB, level with a crush; on a phone's band
  none quieter than before. A roll is silent till it lands (user:
  "Rolling should not make a slide sound"); slides (the Cabeza, slid
  blocks; user: "only for pieces slides or for the cabeza") a grind held
  for the glide, lower the heavier (dragRate), nothing struck
  (theme.slidesGlide). A heavy piece's grind is the door's slab, a light
  one's stone rubbed on stone, the two mixed between. A crush: the smash,
  a deep thump with its weight under it, rocks tumbling after; a win: the
  smash and a thump slowed, the rockfall
  after. Each hit plays from its attack to where it has died away (found
  in the decoded file: monolith-sounds.js attackIn, endIn), never the
  silence after it. The files are fetched as the direction comes up and
  decoded once there's a context (Begin Game makes it now, in every
  direction: createLabAudio's beginGameFadeIn); until then the voice is
  silent rather than stand in with a synthesizer. Opened from disk a page
  can't fetch them (the Lab plays them only served, as GitHub Pages does);
  tests/e2e-monolith.mjs serves dist over http. Levels set by rendering
  every Lab voice's cues offline from audio.js itself (an
  OfflineAudioContext standing in for the page's context; the loudest
  100 ms, full range and through a 300 Hz high-pass for a phone's
  speaker; scratch loud.mjs): the smash at full strength put a crush and
  a win 10 dB over every other direction's, now level with the loudest
  of theirs (about -26 and -22 dBFS); an Opa's landing sits about 2.5 dB
  over Brutalism's heaviest, a cube's 3 under its lightest (the
  Monolith's weight spans 7 dB, theirs about 2); on a phone's speaker
  the stone stays 10 to 15 dB clearer than the others' sine thuds.
