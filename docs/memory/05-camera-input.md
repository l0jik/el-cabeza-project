## 5. Camera/input system — fragile, recently fixed, verify rigorously if touched again

Fully custom (not Three.js `OrbitControls`): `theta`/`phi` orbit,
`target` pan, `radius` zoom, all eased via a `goal` (what input wants)
vs. `view` (what's rendered) split with frame-rate-independent damping
(`1 - e^(-dt/1000 * damping)`). Gestures: single-finger/mouse drag orbits
(theta/phi); **pan** requires two-finger drag on touch or Alt+drag /
right-drag on desktop (`ev.pointerType !== "touch"`) — a plain mouse drag
in a test will orbit, not pan, which looks like "nothing happened" if you
forget this. Two-finger swipe up/down toggles Current Player View /
Top-Down View; two-finger double-tap toggles fullscreen; a second
`contextmenu` within the double-tap window gets touch-gesture parity on
desktop. (The trackpad two-finger flick, read from wheel bursts, is gone:
the wheel only zooms, see "The wheel only zooms".)

**Full screen off the board, and at the first tap.** The canvas's gesture
code only sees touches on the canvas, so anything covering it (Tienda's
box lid and order form, the dock, pop-ups) swallowed the double-tap. A
document listener (touch events, capture, passive) recognizes two-finger
taps that start anywhere else, with the same thresholds (module-level
`TWO_FINGER_TAP_MAX_MS` / `TWO_FINGER_TAP_MOVE_PX` /
`TWO_FINGER_DOUBLE_TAP_MS`), and skips touches on the canvas so one
double-tap never toggles twice. Both recognizers time taps by
`ev.timeStamp` (when the fingers touched), not `performance.now()` in the
handler: a busy frame delays handlers, not fingers. (In the tests, CDP
touches each take ~0.5 s to be handled on SwiftShader, so
tests/e2e-fullscreen.mjs gives them explicit timestamps.) Note a closed
dock panel is `pointer-events: none`: touches over its buttons reach the
board. `theme.fullscreenOnFirstTap` (Tienda): browsers only allow full
screen from a tap/click/key, so the first trusted click anywhere requests
it, once a visit (module-level `fullscreenOffered`), not if a
fullscreenchange came first (the player chose), not on the full screen
button itself (`data-fullscreen-toggle`), and not within 600 ms of a
two-finger contact.

**The board-visibility clamp is a hard product requirement** ("no more
than 25% of the board may ever be fully out of view... at ANY tilt
angle"), re-evaluated every frame on the `goal` (not just at pan time,
since radius/phi can change independently afterward):
- Horizontal (XZ): circular clamp, `MIN_VISIBLE_FRACTION = 0.5` (≥50%
  visible).
- Vertical (Y): `BOTTOM_MIN_VISIBLE_FRACTION = TOP_MIN_VISIBLE_FRACTION =
  0.75` (≥75% visible, i.e. ≤25% out of view), asymmetric internally
  (panning up vs. down affect the frustum differently) but the same
  floor both directions.
- The two axes are **coupled elliptically**, not independently clamped —
  a confirmed real bug showed a diagonal drag satisfying both checks
  independently while still pushing the board almost fully off-screen,
  because each check implicitly assumed the other axis was at zero.
  Horizontal keeps its full independent budget; vertical's budget shrinks
  as horizontal usage grows. Any future camera-clamp change must consider
  this coupling, not just re-verify each axis alone.
- Vertical is solved **numerically** (bisection against real ray/plane
  intersection — `boardVerticalOverlapFraction`/`clampVerticalTarget`),
  not a closed-form formula. A closed-form attempt
  (`maxPanDistance/sin(phi)`) was tried and **failed every test** in a
  real radius/phi grid check (reported "0% visible" as safe). Don't
  reintroduce a closed-form approximation here.
- **Just fixed this session**: the horizontal clamp derived its safe
  radius from the camera's *vertical* FOV only, applied uniformly in
  every pan direction. On a narrow/portrait phone the true horizontal FOV
  is much smaller than vertical, so the clamp measured against the wrong
  (wider) axis and let a pan push the board **fully off-screen**
  (reproduced from a real OnePlus 8T recording; confirmed fixed on that
  device). Fix: use `min(vertical halfFOV, aspect-derived horizontal
  halfFOV)` when computing `groundHalfSpan`. Confirmed mathematically
  inert at aspect ≥ 1 (pixel-identical desktop screenshots before/after)
  — if this code is touched again, re-verify both a narrow-portrait
  viewport AND a square/desktop viewport, not just one.
- **The rooms look around (user's explicit instruction, Sep 27):** "I
  can't really move around in the room at all... panning feels far, far
  too restrictive", and asked, the user chose to let the den and the store
  look around: zoom closer, pan anywhere over the board and out into the
  room, the board may leave the screen, Reset view brings it back; Neon
  keeps its limits. A theme sets `freeCamera` (standard.js `{ zoomMin:
  4.5, reach: 70, yMin: -8, yMax: 30 }`, tienda.js `{ zoomMin: 4.5,
  reach: 60, yMin: -14, yMax: 30 }`): the per-frame clamp is then only a
  reach (the target within `reach` of the board's middle across, between
  yMin and yMax up and down, inside the room's walls), and pinch/wheel
  zoom go in to `zoomMin` instead of ZOOM_MIN. Every other theme (Neon,
  Cromo, Lluvia, the Lab's) keeps the 50%/75% clamp above unchanged.
  A room may also let the camera further out than ZOOM_MAX_FOR_BOARD
  (`freeCamera.zoomMax`, the larger of the two wins; the store's is 82,
  "The store's standee and the den's chair" below); zoom-reactive audio
  stays on the board's own range (clamped at 0 past it).

Other camera facts: near plane raised `0.1 → 1` (fixes a depth-sort
flicker during rotation, 10x tighter near:far ratio); max pitch capped at
`1.25` rad (was `1.45`) specifically to stay clear of a Neon
translucent-piece depth-sort artifact at grazing angles (§7, not fully
fixed at the rendering level, this is the accepted mitigation). Pre-game
camera auto-fits between masthead and dock (bisects on vertical gap AND
horizontal width, board capped at 84% viewport width) and vertically
centers within that band; `handleReset` sets `theta`/`phi` to the same
literal defaults a fresh page load uses, deliberately NOT via
`topDownView()` (which sets an unrelated near-vertical `phi` that once
leaked into the setup-screen fit and produced a too-close New Game zoom).
Current Player View fits only the current player's own pieces; Top-Down
View fits the whole board plate; both share a `fitRadiusToCorners`
bisection core and are captured once at Begin Game, not live-refit on
window resize. Begin Game now opens every game in **Top-Down View** by
default (changed from Current Player View) and calls `recenterView()`
immediately.

