## 8. Visual/design invariants — keep consistent, don't relitigate

- **Never size responsive text with `transform: scale()`** when the
  original has a `clamp()`/`min()` floor meant to protect legibility — a
  `scale()` shrinks the floor proportionally too, and no multiplier
  choice fixes this (there's always some viewport narrow enough to hit
  the floor). This was tried **at least four times** for the masthead
  corner badge (0.45, a mobile-only 5x, half of that, flat `scale(0.4)`)
  before the real fix: give the smaller element its **own** `clamp()` at
  the target ratio. Full writeup in `ARCHITECTURE.md`'s "Known
  pitfalls." `theme.mastheadScale` (Neon = 1.25, Standard unset) follows
  this correctly — it scales the clamp's own numbers via a
  `mastheadClamp(floor, vw, ceiling, scale)` helper, never a wrapping
  transform.
- Masthead lifecycle: `"setup"` (full size) → `"fading"` (post-Begin-Game,
  briefly near-invisible in place) → `"relocated"` (small corner badge,
  its own dedicated `clamp(16px, 2.8vw, 52px)`, not a fraction/scale of
  the setup formula). `isFullscreen` only ever affects the `"fading"`
  phase's clamp — applying it to `"setup"` too was a real regression
  (masthead incorrectly shrank in fullscreen before Begin Game).
- Dark/light player color must always come from the theme-agnostic
  `bodyDark`/`bodyLight` pair, **never** `charcoal`/`cream` literally —
  Neon's own `charcoal`/`cream` are semantically inverted for its dark
  UI. This exact bug recurred across move-log headers, the turn halo, and
  the AI-side picker's dot before `bodyDark`/`bodyLight` was established
  as the one source of truth. Similarly, the AI-picker dot must use the
  real player color directly, not `currentColor` (which resolves to the
  pill's *text* color — the opposite of the intended meaning).
- Chrome tokens (`modalBackdrop`, `modalSurface`, `canvasGradientStart/
  End`) must come from the theme, never hardcoded literals — caught once
  via a screenshot showing Neon's Move Log popup rendering in Standard's
  cream colors.
- Neon's ambient FX intensity has been tuned **down** repeatedly and
  deliberately, specifically for flashing/seizure-risk reasons (VHS
  glitch interval widened ~30%; crawling-swarm brightness ceiling cut in
  several passes down to 0.26; the newer CRT-aberration family —
  chromatic ghosting, degauss wobble, phosphor trail, curvature ripple —
  was added on smooth easing specifically as *calmer* alternatives on
  their own separate rotation, not merged into the harsher
  hard-cut glitch pool). Default to restraint on any new Neon ambient
  effect, not brightness/frequency.
- **Card-targeted glitches (`fireVhs`, `fireRare`, `fireCrtAberration`) are
  gated on `isVisibleForGlitch(card)`.** `cardRef` is the dock panel
  (`data-testid="dock-panel"`); in-game it's closed by fading to `opacity:0`
  (not unmounted), and a glitch class's own opacity keyframes would override
  that and flash the whole panel back into view — the "dock briefly appears
  mid-game" bug. Only glitch the card while the dock is actually open (same
  gate the button jitter uses). `fireVhs` still fires its screen-wide overlay
  flash + cue regardless (not the dock); `fireRare`'s card-only cue is
  skipped with its visual when the dock is closed.
- Every theme's font must be read from `theme.titleFontFamily` (Neon =
  Chakra Petch via `@import` in `styleSheet`; Standard defaults to
  Fraunces) — never hardcoded on the chassis side; this broke once
  (silently fell back to serif everywhere, including the standalone Neon
  build).
- Move-triggered FX (`pulseSquare`, `spawnGlitchBurst`,
  `spawnLandingShockwave`, `spawnLandingParticles`) are plain optional
  properties a theme writes onto the shared `three.current` object, not a
  formal hook — the chassis calls them with `t.x && t.x(...)` guards.
  Follow this same pattern for any new move-triggered effect rather than
  inventing a new hook shape.

