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

