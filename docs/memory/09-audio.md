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
- **Every sound file is MP3** (56 in dist/, 38.5 MB; the videos carry no
  sound). Measured 2026-10-25 by encoding them all (scratchpad
  opus-size/measure.py; sizes as an app's zip stores them): Opus at half
  each MP3's bitrate (at least 24 kbps mono, 48 stereo) 20.7 MB, 17.1 MB
  smaller; Opus at two thirds (32/64) 27.5 MB, 10.3 smaller; AAC at three
  quarters (32/64) 28.7 MB, 9.1 smaller. Both test browsers play Opus
  (only CI's plays AAC: 02-build-and-verification.md). Apple: Ogg Opus
  only from Safari 18.4 (iOS/iPadOS 18.4, macOS Sequoia 15.4; Apple's
  release notes, March 2025); before that WebM Opus works through
  `<audio>` on a Mac but unreliably on iPhones and iPads, and Opus only
  in Apple's CAF container from iOS 11. The game plays sound both ways
  (`decodeAudioData` in most places, `<audio>` through
  `createMediaElementSource` in the den), so Opus alone would silence
  iPhones older than iOS 18.4: keep MP3 (or AAC) beside it for them, or
  set an iOS app's minimum to 18.4. A switch would also need the loops,
  the slices and the den spot's sync checked again (Opus decodes at
  48 kHz) and the files' names changed in the code and build.js.
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

