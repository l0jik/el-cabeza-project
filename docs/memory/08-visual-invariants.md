## 8. Visual/design invariants — keep consistent, don't relitigate

- **Never size responsive text with `transform: scale()`** when the
  original has a `clamp()`/`min()` floor meant to protect legibility — a
  `scale()` shrinks the floor proportionally too, and no multiplier
  choice fixes this (there's always some viewport narrow enough to hit
  the floor). This was tried **at least four times** for the masthead
  corner badge (0.45, a mobile-only 5x, half of that, flat `scale(0.4)`)
  before the real fix: give the smaller element its **own** `clamp()` at
  the target ratio. Full writeup in `ARCHITECTURE.md`'s "Known
  pitfalls." `theme.mastheadScale` (Futuris = 1.25, Standard unset) follows
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
  Futuris's own `charcoal`/`cream` are semantically inverted for its dark
  UI. This exact bug recurred across move-log headers, the turn halo, and
  the AI-side picker's dot before `bodyDark`/`bodyLight` was established
  as the one source of truth. Similarly, the AI-picker dot must use the
  real player color directly, not `currentColor` (which resolves to the
  pill's *text* color — the opposite of the intended meaning).
- Chrome tokens (`modalBackdrop`, `modalSurface`, `canvasGradientStart/
  End`) must come from the theme, never hardcoded literals — caught once
  via a screenshot showing Futuris's Move Log popup rendering in Standard's
  cream colors.
- Futuris's ambient FX intensity has been tuned **down** repeatedly and
  deliberately, specifically for flashing/seizure-risk reasons (VHS
  glitch interval widened ~30%; crawling-swarm brightness ceiling cut in
  several passes down to 0.26; the newer CRT-aberration family —
  chromatic ghosting, degauss wobble, phosphor trail, curvature ripple —
  was added on smooth easing specifically as *calmer* alternatives on
  their own separate rotation, not merged into the harsher
  hard-cut glitch pool). Default to restraint on any new Futuris ambient
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
- Every theme's font must be read from `theme.titleFontFamily` (Futuris =
  Chakra Petch via `@import` in `styleSheet`; Standard defaults to
  Fraunces) — never hardcoded on the chassis side; this broke once
  (silently fell back to serif everywhere, including the standalone Futuris
  build).
- Move-triggered FX (`pulseSquare`, `spawnGlitchBurst`,
  `spawnLandingShockwave`, `spawnLandingParticles`) are plain optional
  properties a theme writes onto the shared `three.current` object, not a
  formal hook — the chassis calls them with `t.x && t.x(...)` guards.
  Follow this same pattern for any new move-triggered effect rather than
  inventing a new hook shape.


- **The title's badge clears the corner menu's tab, up top, by size**
  (2026-10-28; user, Cromo on a phone, the PARAMETERS plate over the
  "EL C": "the overlap on these items circled in red"). In play the title
  is a faint badge top right (top 14, right 18, clamp(16px, 2.8vw, 52px),
  no theme scale) and the corner menu's tab sits top left; Cromo's
  Michroma (very wide) and a long summary ("5 laws · 10 pieces · 13 × 14")
  made them meet on phones under ~400 px. It first stepped down under the
  tab; the user turned that down (2026-10-29: "I don't like what you did
  with the masthead badge. Push it back up, but just make it smaller when
  it's minimized to fit up there."). So it never moves down: ElCabeza3D.jsx
  mastheadFit, while the badge is relocated (not the phone bar's title),
  measures the tab and the title (each second, on resize and once the
  faces are in) and, where the tab's band crosses the badge's and its
  right edge comes within 10 px of where the badge would start at its own
  size, sets the badge's font size so it ends 10 px clear of the tab (its
  right edge fixed 18 in; floor 8 px). Widths go with the font size, so
  the fit is one division and holds steady. Every world, every width; the
  hold zone over the title (unifiedTransition.jsx) tracks the title's
  live rect, so it follows. Seen here only with Google's fonts routed in
  (scratchpad cromo/measure.mjs): the stand-in face is ~35% narrower.
  Test: tests/e2e-cromo.mjs (320 px: up top, smaller, clear of the tab;
  430: its own size).
