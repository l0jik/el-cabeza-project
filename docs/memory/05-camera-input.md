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
  room, the board may leave the screen, Reset view brings it back; Futuris
  keeps its limits. A theme sets `freeCamera` (standard.js `{ zoomMin:
  4.5, reach: 70, yMin: -8, yMax: 30 }`, tienda.js `{ zoomMin: 4.5,
  reach: 60, yMin: -14, yMax: 30 }`): the per-frame clamp is then only a
  reach (the target within `reach` of the board's middle across, between
  yMin and yMax up and down, inside the room's walls), and pinch/wheel
  zoom go in to `zoomMin` instead of ZOOM_MIN. Every other theme (Futuris,
  Cromo, Lluvia, the Lab's) keeps the 50%/75% clamp above unchanged.
  A room may also let the camera further out than ZOOM_MAX_FOR_BOARD
  (`freeCamera.zoomMax`, the larger of the two wins; the store's is 82,
  "The store's standee and the den's chair" below); zoom-reactive audio
  stays on the board's own range (clamped at 0 past it).

Other camera facts: near plane raised `0.1 → 1` (fixes a depth-sort
flicker during rotation, 10x tighter near:far ratio); max pitch capped at
`1.25` rad (was `1.45`) specifically to stay clear of a Futuris
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


- **Hold to end: the first one teaches (2026-10-20; user: "The first
  time that somebody wants to manually stop a piece and not use its
  second move, and you press and hold on it, it should last longer or be
  more prominent in some way, just to kind of teach them how it's done.
  First and only the first time.").** chassis/ElCabeza3D.jsx: till a
  hold has once been held to its end (localStorage
  `el-cabeza:hold-to-end-learned`, and a module flag for a visit that
  can't store it), a press on the moved piece takes HOLD_END_FIRST_MS
  (1.5 s, not 650 ms) and draws the teaching ring (data-first="true"):
  14 px larger, thicker, lit (a cream drop-shadow glow), a thin ring
  breathing round it, and under "Keep holding to end your turn" a second
  line, "When the ring closes, your turn ends. Let go to keep playing."
  (testid hold-to-end-teach). Let go early and it's still to learn; once
  one completes (holdDoneRef, h.first) it's marked learned and every hold
  after is the usual one. `__EC_TEST_HOLD_MS__` still overrides the
  time. tests/e2e-hold-to-end.mjs: the first hold the teaching one,
  ending after 1.3 s or more, then learned; the phone (seeded as learned)
  the usual one.

- **A finger whose lift never arrived** (2026-10-21; user's video, home
  from the trip: "Something screwed up the spin, zoom, pan. The single
  finger is panning everything, but I'm trying to continue playing the
  game and it won't let me. Something locked something else out"). The
  board counts fingers in the input effect's `active` map (pointerdown
  adds, pointerup / pointercancel removes). The den's home card is put
  away by the first tap anywhere; that tap's pointerdown starts the
  settle-in (den-fx.js settleIn), whose lock blocks every pointer event
  at the window but the bulb, so the same tap's pointerup never reached
  the canvas: a ghost finger, and every touch after it a second finger,
  a two-finger pan (and no taps). Two fixes. The chassis (onDown): a
  primary pointerdown (`isPrimary`: no other finger of that kind is down)
  lets go of any others still counted, as if cancelled (onCancel: the
  hold to end, a set-out drag, slide/pivot/undo drags dropped too); this
  covers every lock that eats a lift (the order paper, the store's and
  Futuris's locks too). The settle-in lets a pressed finger it never saw
  go down (moves with buttons, the lift) through, as the TV lure's lock
  already did; the order paper's lock is left as it was (its taps must
  not reach the board; the chassis guard clears what it leaves). Test
  hook `__DEN_HOME_NOW__` (the home card and settle-in without the trip).
  tests/e2e-ghost-finger.mjs (Futuris and the den: a lift swallowed at
  the window, then one finger turns, no pan; the den's own way: the card,
  a tap on the board, the bulb, then one finger turns). Without both
  fixes the den's way reproduced it (turned 0, slid 2.97).

- **The store's Room view stuck on, its tilt with it** (2026-10-21;
  user's phone video of the store's first game: "Am I wrong here, but in
  the tutorial, playing the game in the tutorial, the up-down tilt seems
  reversed"). The video: finger up rose to overhead, down sank to the
  horizon, at the board; a finger's rule (grabLatch) is the other way,
  except in the Room view (`cam.current.dollhouse`: "the tilt goes the
  other way"). The flag is set by roomView() and cleared in applyCamera
  once the camera is back inside the theme's `freeCamera.room` box; the
  den has one, the store has none (its freeCamera is zoom limits and the
  dollhouse preset only), so in the store a pinch back in from the Room
  view left the flag on, and every drag at the board tilted the Room
  view's way; a view put back with the flag on it (the walkthrough's end,
  restoreTourCam; Show me's way back, checkCamRef) brought it back too.
  Reproduced on a phone (412x915, CDP touches): Room view, radius in to
  30, flag still on, finger up phi 0.85 -> 0.42. Now applyCamera, for a
  theme with no room box: the flag clears once the camera's goal and view
  radius are both under 0.75 x the dollhouse radius (the store's: 61.5 of
  82); tilting alone keeps it, as in the den. The Room view itself keeps
  its own tilt. tests/e2e-touch-in-game.mjs (Nova's store, Big Glutts'
  page): the Room view, finger up there toward overhead; a real
  two-finger pinch back in ends it, finger up toward the horizon again;
  the flag put back at the board's distance goes by itself. Note: the
  touch test's own pose() sets dollhouse false, which is why it never saw
  this.

- **The turn goes one way everywhere** (2026-10-21; user, back in the den
  home from the manager: "We're having that same issue with the rotation.
  If I start rotating at the top of the screen and then cross the 50%
  threshold to the bottom, it reverses and vice versa. Check to make sure
  this never happens anywhere globally."). The turn was a turntable
  (grabLatch, since 244b111): begun above the board's middle on screen a
  drag right turned it one way, begun below it the other, latched for
  the drag. The lower half had felt reversed again and again: the store
  (4903bee, user: "if you drop below the halfway point on the screen, it
  is reversed", fixed for the store alone with theme.dragTurnOneWay, then
  undone for a finger by da27afd), the Room view home from the trip, back
  from the other realities (each time only the middle's measuring was
  changed). Measured first: a single drag never reversed (den, Futuris,
  Big Glutts' page, the City; finger and mouse; the den on the user's own
  route: store revisited, the clerk, Go home confused), but a drag begun
  low turned the other way from one begun high. Now grabLatch's turn is
  +1 always (a drag right turns the board as its far side goes, as from
  the top), any pointer, every world, board view and Room view, before a
  game and in one; the tilt rules unchanged. theme.dragTurnOneWay gone
  (tienda.js), Futuris's summon drag (futuris-summon.js) one way too.
  e2e-drag-latch: begun low, right and up across the middle, as from high
  (low = 1 for every page); e2e-touch-in-game: begun below the middle,
  right: theta up too (before Begin and in a game).
