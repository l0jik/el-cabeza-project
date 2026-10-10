## Nova on phones: the phone layout (chassis/MobileShell.jsx)

User brief: "a premium mobile version of Nova ... full interactiveness and
all options available, streamline and remove any cruft". Built as an
opt-in chassis mode, so only Nova changes: `apps/unified.jsx` passes
`mobileShell` to ElCabeza3D, and the chassis uses it when
`SHELL_QUERY` matches (≤ 700px wide, or a coarse pointer ≤ 520px tall —
a phone on its side). Desktop Nova and every other page (Neon, Standard,
Tienda, Lluvia, Cromo, Lab) keep the dock exactly as before.

- **What goes (on phones only).** The floating 3D dock piece (its render
  loop also pauses: `shellRef` in its tick), the dock panel
  (`display:none`, still mounted so theme refs and effects are safe), the
  ghosted full-screen and How to play corner icons, the Info pop-up
  under the title, the floating points counter and the floating piece
  card, the "AI Opponent: Dark" confirmation overlay.
- **What replaces it.** A menu button top right; the title top centre in
  setup and top left in play (`shellMastheadStyle`; smaller and centred
  over the board's side in landscape). One bar along the bottom (down the
  right side, bottom-anchored, in landscape) with three states:
  setup (First move, Opponent Human/AI, AI plays Dark/Light, Level, Begin
  Game, plus the theme's `shellSetupActions` — Neon: Anomaly beside
  Begin, Custom rules below), play (turn dot + status + points dots;
  Undo move / Stop here / Undo turn, or the chosen piece's description
  (tap = its MOVES tile), or a hint; the one view toggle), over (result,
  Move Log, New Game). A side's segment, once chosen, takes that side's
  colours (and glow in Neon). The menu sheet: How to play, Rules in this
  game, Move log, End game (second tap confirms) / New game / Take back
  the last turn / Reset rules, Top-down / Player view, Full screen, Sound,
  Points left, Move costs on the board, the page's own items (Nova:
  "Switch to Neon / Standard", which opens the same CONNECT/DISCONNECT
  prompt the 4 s title hold ends in — the hold still works), About,
  version. Everything calls the chassis's own handlers via the `ctl`
  object; nothing is reimplemented.
- **Framing.** The bar reports fixed insets per orientation (portrait:
  top 60, bottom 122, plus safe areas; landscape: right = bar width) and
  the chassis's `resize` uses `camera.setViewOffset` to centre the
  picture in the free area, widening the fov by the virtual image so a
  camera distance draws the board the same size. `fitRadiusToCorners`
  fits within the free area; Top-Down View uses 0.94 of it on phones.
  An insets change mid-game (rotation) re-measures both views and
  re-applies the one showing (`viewMode`). The pre-game framing fits
  between the title and the bar's top (the whole height in landscape)
  and refits when the bar grows (ResizeObserver).
- **Theme hooks.** Neon's turn halo and glitch label refs move to the
  bar's dot and status (the halo's `--ec-halo-intensity` now drives the
  dot's glow). The bar and menu button fade out while a Singularity
  phase is running (`ctl.hidden`); the camera insets are dropped only
  from blackout on (`ctl.fullFrame`), so nothing shifts mid-collapse and
  the sphere is framed on the whole screen. `html.ec-shell` moves Neon's rules flyout under the
  title row. The rules overlay becomes a full-width bottom sheet with a
  close button. Neon's SINGULARITY invite text now fits a portrait
  phone on every page (`min(13vmin, 9vw)`).
- **Page.** Nova is built with `viewport-fit=cover` (safe-area insets are
  read from a probe element), and the browser's theme-color follows the
  theme.
- **Test.** `tests/e2e-nova-mobile.mjs`: portrait (dock gone, setup
  choices, framing between the bars, piece description, Undo/Stop here,
  view toggle, every menu row, switches, rules sheet, End game, Move Log,
  New Game, theme switch to Neon, Anomaly, Custom rules invite fits),
  landscape (bar on the right, title and board clear of it), and desktop
  Nova / Neon's own page on a phone keeping the dock.

### Follow-up decisions (user answers)
- **Desktop Nova: both layouts.** `apps/unified.jsx` keeps a layout
  preference (`el-cabeza:nova-layout`, "dock" default | "bar") and passes
  `mobileShell.preferBar` + `onLayoutChange`. The chassis shows the bar
  only when `preferBar` (it used to force it on phones, `SHELL_QUERY`;
  gone: the user wants the floating 3D piece on phones too, "Nova is
  missing the non-mobile setup screen where you just have the floating 3D
  piece", so the dock is the default everywhere and the bar a choice).
  The dock's icon row has a layout icon (`layout-toggle`, bar glyph) and
  the bar's menu "Use the classic dock" (`shell-menu-layout`, "The
  floating piece"), on every screen. On a wide screen (> 700px, not short) the bar floats as a
  centred 600px panel 16px above the bottom; the side bar is only for
  short wide screens (height ≤ `SIDE_MAX_H` 520, MobileShell.jsx).
- **Board facing (all themes).** The pre-game board now faces the side
  that moves first (`boardNearSide` follows currentPlayer during setup
  only, frozen in a game — following it every turn flipped the dock
  piece's colour mid-game and broke the Lab's mid-step switch), snapped
  on arriving at setup; switching First move turns it on the usual
  damping. It used to be a random roll.
- **Neon's custom-rules emblem** (VariantsFlyout) only shows in a game
  that has custom rules (`renderVariantsFlyout`).
- **Standard's wood sounds:** (superseded) the user once planned to
  upload recordings; they later chose Tienda's synthesized knocks instead
  (see "Wood sounds: Standard uses Tienda's").

### Undo after a black hole or a shove (user bug report, video)
Undo turn replayed an AI Cabeza's wormhole step backwards as a plain
step from the ejection square, so it slid off the board's edge and
streaked across it. Steps that can't be played backwards now record
where things started: `from` (the mover), `teleports`, `shovedFrom`
(pushed pieces), set in commitRef. `reverseStep` (used by both Undo move
and Undo turn) jumps a teleported piece straight back (a landing knock,
no path) and puts pushed pieces back after the mover rolls home.
Test: tests/e2e-undo-wormhole.mjs (hook `__EC_TEST_SET_HOLES__`); it
fails on the old build (0.91 squares off the board).

Tienda's box lid reads "No. 4417 · Made in Argentina · © 1975" (the
game was conceived in Argentina; it said Made in U.S.A.).

### Tienda floor flicker (user bug report, video)
The floor was one big plane with the tan aisle "racetrack" laid on top as
two coplanar bands held apart only by polygonOffset; the bands overlapped
each other at the crossing (the court, under the display table) with the
same offset and z-fought there, tiles flickering in patches as the view
moved. Now the floor is non-overlapping pieces at one height
(`floorRect`: the aisle cross + the four areas around it), textured by
WORLD position so tiles line up across piece edges. Don't lay coplanar
floor layers again; cut the geometry instead.

### Tienda piece-base outline flicker (user bug report, video)
The dark line under a piece (most visible under the Cabeza) broke into
dashes that changed as the view turned, close and low. Cause: the outline
shell's floor sat flush with the board top (`y + OUTLINE_T`, the original
Standard's "zero gap" choice), and the strip of it in front of a piece's
base IS the outline there. A cylinder cap is a fan of long thin wedges
whose depth is only approximate at a low angle, so in patches the board
won. Reproduced on SwiftShader (radius 9, phi 1.2, orbiting the Dark
Cabeza) and isolated: hiding shells removed it; the shell's shadow, all
shadows, and the board's constant offset (units 3 -> 12) changed nothing;
a slope-scaled board offset (factor 1) fixed it but is the thing the
chassis's slab notes warn against (a shell dipping below the board
mid-roll would show through). Fix (themes/wood-set.js): the shell's floor
is `SHELL_LIFT` (0.003) above the board, geometry not depth bias; 0.002
and 0.004 also held close up (from across the table SwiftShader, with
no MSAA, breaks the sub-pixel outline everywhere, top rim included, so
far views there can't judge it). Themes export
`outlineYOffset = OUTLINE_Y_OFFSET` (OUTLINE_T + SHELL_LIFT), so the
chassis strips the whole lift before a roll and a rolling shell is
centred as before. Test: tests/e2e-outline.mjs (Tienda and Standard: at
rest every shell floor at SHELL_LIFT and every body on the board; mid-roll
shell centred on the body; lifted again after). Cromo, Lluvia and the Lab
scene build their shells the same flush way (not changed).

### Sound channels (user request: music off, pieces on)
A theme can export `soundChannels` ([{ key, label, hint }]) and give its
audio `setChannelMuted(key, off)`. Then the dock's speaker button
(`sound-button`) opens a sound menu (`sound-menu`, fixed above the
button, since the dock scrolls) instead of toggling mute: All sounds
(the old master mute, `sound-all`) and each channel (`sound-ch-<key>`).
The choice is kept in localStorage (`el-cabeza:sound-channels`) and
applied when the audio is made. The speaker glyph shows a slash when all
is off and one wave when some channels are. The dock's outside-press
close ignores presses in the menu; closing the dock closes the menu.
Tienda (tienda-audio.js): gates on music (after musicBus, and the tape's
direct reverb send), store (ambBus, farBus) and pieces (sfxBus: wood,
paper, register). The music keeps playing under its gate, so it picks up
where it is. Note for tests: Chrome doesn't update a gain's `.value`
readback while nothing sounds through it — play a move before reading
the pieces gate. Test: tests/e2e-sound-channels.mjs.

### Nova's sound menu (user request: "the same sound menu" as Tienda)
Neon exports `soundChannels`: Ambience (the hum/crackle bed and its
far-off events: `ambienceGate` after introGain), Pieces (select,
deselect, blocked, landing, capture, win) and Interface (menus, rules,
dock, CONNECT, the Singularity, and the bell's own bus). Every Neon cue
connects to `sfxGain`, which is now the interface gate; the piece cues
are wrapped in `pieceCue`, which points `sfxGain` at the pieces gate for
the (synchronous) call. The landing reverb sends to the pieces gate. Both
gates feed `sfxOut` (the old 1.25 sfx level). `__EC_TEST_AUDIO__` reports
`channelsOff` and `gates`. Standard (the den) has two channels, The room
and Pieces. On a phone (MobileShell) the menu's Sound becomes
"All sounds" with the channels indented under it
(`shell-menu-sound-<key>`). The storage key is shared across pages, so
"pieces" off carries between Tienda and Neon. Test:
tests/e2e-nova-sound.mjs.

### Side buttons in the side's material (user request, Tienda)
Anything that stands for a side (Human / AI side buttons, Stop here /
Begin, the AI-chosen pill, the turn and winner dots, the move log's
column dots) takes its fill from chassis `sideFill(side)`: a theme's
`sideSurface(side)` ({ background, color, textShadow }) or the flat body
colours. Tienda's is the pieces' own wood: tienda-showcase.js
`woodSwatch` renders a strip of `woodMaterial` square-on under the
store's lights and renderer settings (one short-lived WebGL context per
side, cached as a JPEG data URL). Ink: cream with a dark bed on walnut,
near-black with a pale halo on olive ash. With a material, unpicked side
buttons are NOT faded (the 0.35 fade washed the wood grey, which was the
complaint); the pick gets an ink ring instead (`pickedMark`). The order
form's "The demonstrator plays Dark/Light" buttons do the same (`td-wood`).

### Wood sounds: Standard uses Tienda's (user request)
themes/wood-sfx.js holds Tienda's block knocks (hit, select, deselect,
blocked, rollStart, landing, capture), used by both themes. Tienda's
board is "folding" (hollow knock + table thud, unchanged); Standard's is
"solid" (tight filtered-noise knock + short thud, nothing hollow; the
user's choice), with a compressor and Tienda's small 0.6s room. The old
modal synth (scripts/wood-impact-synth.js) is no longer used.
Landing pitch follows the face that lands (user rule): the chassis passes
`playLanding(cubes, contactArea(landed))` (engine/shapes.js: bottom-level
cubes, or w*h). `landingSize = contact * cbrt(cubes)`: a cube is 1, a
2x2x2 flat 8 (as before), a 1x3 on end 1.44, on its side 4.33. Without a
contact (older callers) it falls back to the cube count. Test:
tests/e2e-wood-sounds.mjs (also renders every cue offline on both boards:
audible, under full scale, bigger face = lower).

### Tienda: fewer phone rings and PA announcements (user request)
The store's random events (tienda-audio.js scheduleEvent) had the service
desk phone at 12% and the PA at 14% of picks. Both halved (6%, 7%); the
share they gave up is a quiet spell (no event), so carts, the register,
steps and the door come exactly as often as before. The closing
announcement at the end of a game is not random and is unchanged.

### Singularity: the sphere keeps its size (user report, Sep 27)
"In SINGULARITY, the sphere is much smaller now...what happened?" The
sphere (radius 6, at the board's middle) took its size from wherever the
chassis's camera was when the cinematic began. Measured against the build
before Sep 27 (the Neon page and Nova; phone, laptop and 1100x900; the TV
path, the bar and the floating piece), the board's fitted view hadn't
changed, but zoomed out (up to ZOOM_MAX_FOR_BOARD, 55) the sphere came
out about half the size, the likely cause. Now the chassis keeps the last
fitted radius (`lastBoardFitRadiusRef`, not cleared when play starts,
unlike preGameFitRadiusRef) and gives themes
`three.current.boardFitScale()` (the view's radius over it), and
`fitSphereToScreen` (neon-singularity.js) scales the sphere's frame by
it on arrival and every frame of the sphere phase: the size it has at
the fitted view on that screen (phone 317 px of 390; 1100x900, 649 px),
zoomed out or in. A first try at a fixed share of the screen matched a
phone and a laptop but shrank it on squarer windows (1100x900: 547 px
against 649) and broke the Singularity test's bare-sphere tap, so it's
the fitted view's size instead.

### The Room view, and the camera left where you put it (Sep 28)
The user: "I do want a dollhouse view... something that can just go to
maximum zoom out... something keeps causing it to zoom back in", and
asked for ideas.
- **The Room view** (a theme with `freeCamera.dollhouse: { radius, phi
  }`: the den 150 / 0.68, the store 82 / 0.6): up above the room at a
  slant, the heading as it is, the target back at the middle; the den's
  ceiling (and a wall the camera's past) steps aside as ever, so it's
  the room with the roof off. `cam.current.dollhouse` sets the room box
  aside until the camera, both where it's going and where it is, is back
  inside it (applyCamera), so pinching or scrolling back in glides down
  into the room without a jump (measured: the height falling 108, 99,
  90 ... 40 in steady steps). Buttons: a little house above the
  full-screen button (`room-view-corner`, any time, setup included; a
  card-coloured disc like the others in the den and the store), "Room
  View" beside Top-Down View in the dock during a game (`room-view`),
  and "Room view" in the phone's menu (`shell-menu-room`).
- **Zooming back in by itself**: before Begin Game the setup framing
  refits the camera on every window resize, and on a phone the browser's
  bars sliding in and out as you drag fire resizes. It now leaves a
  camera the player has moved (zoomed, panned, turned, or in the Room
  view) where they put it (`fitted` / `moved()` in the framing effect).

### The chair's end table; the Room view lower (Sep 28)
- "A small, era correct table next to the chair with a book on it": a
  walnut end table beside the club chair on the side away from the lamp
  (den-room.js, in the chair's frame: 6 out from its side, top 10.8 up,
  a little over the arm): a 9.2 square top with a softened edge, four
  round tapered legs, a shelf at 3.2. The book is to be the user's own
  image of "Abstract Strategy: How the Masses Are Demanding the
  Future... Now!" by Dr. Alistair Finch-Hatton, exactly ("it must be
  this exact book"). The photo (the book lying at an angle) was squared
  up with a perspective warp from its four cover corners (242,36),
  (636,98), (410,450), (12,356) of 649 x 563: assets/den/book-cover.jpg
  (512 x 640), and the two page faces it shows the same way,
  book-tail.jpg (with the red ribbon) and book-fore.jpg (brightened,
  it's in shadow in the photo). On the table (den-room.js): a 3.8 x 4.75
  x 1.0 block of faces (cover up, tail, head from the tail's pages,
  fore-edge, the spine in the cover's orange wrap), turned 0.32 off the
  chair's line, its ribbon trailing out onto the walnut. (An inline
  picture reaches the session only to look at; this one came as a file,
  images/21.webp.)
- "Dollhouse view is a tad too high": the den's Room view from 150 /
  0.68 (116 up) to 118 / 0.78 (about 83 up, still well over the ceiling
  at about 40).

### The floating piece's hit area is its outline (user report, Sep 28)
"The 3D floating button is a hitbox, but it's still too large... no
matter the piece size, they're all defaulting to the OPA hitbox size.
But even the OPA itself might be too large." The dock piece's canvas is a
fixed frame (260 x 220 on a laptop) sized for the largest piece, and
every pointer event on it went to the piece (dockHitFraction only
narrowed what a click opened). Now `clipToPiece` (the dock piece's loop)
projects the piece's points each frame, wraps them in their convex hull
grown 4 px (9 px for a finger), and clips the frame's mount to it
(clip-path decides where the browser delivers pointer events): a tap
beside the piece reaches the board beneath, and the piece is always drawn
inside its own hull. `isInsideDockHitbox` tests the same hull. Measured
over three sessions: hit shapes 130 x 97, 69 x 75 and 60 x 37 against the
260 x 220 frame; the frame's corner hits the board; a tap beside the piece
doesn't open the dock, one on it does. A drag keeps its captured pointer.

### The snack bowl (user screenshot, Sep 28)
"Snacks protruding from the exterior of the bowl": the pieces were
strewn out to 1.75 from the middle, but the teak bowl narrows toward its
foot (1.1 at the bottom, 1.8 at 0.45 up, 2.1 at the rim), so a piece near
the edge sitting low went through the wall. Each piece now has a `reach`
(how far it sticks out, turned any way) and is pulled in until it clears
the wall at the height of its own lowest point (`wallR`, from the lathe
profile, 0.06 inside); the heap rises toward the middle, so moving in only
lifts it.

### A two-finger pan is never a swipe (user video, Sep 28)
Panning with two fingers toward the den's fireplace, the view snapped to
Top-Down View: a quick two-finger pan down the screen met every test of
the two-finger downswipe (60 px, mostly vertical, the spacing kept,
under 700 ms). A swipe is now a flick: under 350 ms, at least 70 px, and
still moving at 0.7 px/ms or more over its last 100 ms when the fingers
lift (chassis `releaseSpeed`, `twoFingerTrail`); a pan settles as it
arrives. Checked with timestamped CDP touches: a flick (220 px in 0.24
s) still gives Top-Down View; a steady pan (260 px in 0.6 s) and a quick
pan easing out (200 px in 0.32 s) leave the view where it is.

### Sliders for the sound, the mouse wheel, the den's sofas and table (Sep 28)
- **Sound sliders** ("sliders instead of toggles to balance sounds mixing,
  with a slide all the way to the left muting that channel"): the dock's
  sound menu and the phone's menu sheet have a slider per channel (Tienda:
  music, store, pieces; the den: the room, music, pieces; Neon: ambience,
  pieces, interface) and "All sounds" over them. A channel's level is 0..1
  (localStorage `el-cabeza:sound-levels`; a switch left off before
  carries over as 0), heard as its square (`chGain` in tienda-audio.js,
  den-audio.js, neon.js: `setChannelLevel`), so halfway is a quarter of
  the gain, about evenly spaced by ear. All sounds is a master level
  (`el-cabeza:sound-master`) multiplying every channel; all the way left
  is the mute it always was (audioMuted, onMutedChange). The inputs keep
  the old testids (`sound-all`, `sound-ch-<key>`, `shell-menu-sound`,
  `shell-menu-sound-<key>`) with `data-level` 0..100. Themes with no
  channels keep their single Sound switch.
- **The mouse wheel** ("scroll out quickly... it stutters, and rezooms
  in"): the wheel's trackpad-flick gesture (320 px of scroll within 160
  ms: down = Top-Down View, up = Current Player View) caught a mouse wheel
  spun quickly (four or five 100 px notches), jumping to Top-Down View,
  closer in. A burst with a mouse notch in it (deltaMode not pixels, or
  |deltaY| >= 50 with wheelDeltaY a multiple of 120) or a trackpad pinch
  (ctrlKey) never counts as a flick. And the wheel zooms by a share of
  the distance (exp(0.0009 x deltaY): a notch is about 9%), with Firefox's
  lines counted as 33 px, so a room is crossed in a few turns.
- **The den's sofas** (user video: far out, circling, the near sofa
  vanished): a sofa side steps aside only when the camera is within 22 of
  its back (den-room.js `blocks`); from across the room it stays.
- **The coffee table's plinth**: no key-light shadow (the shadow map's
  tight ±9.5 frustum ended partway across it, cutting the top's shadow off
  in a line that slid about as the view turned), a shade darker instead.
- **Starting the story over** now reads "Once more, from the top shelf."

### The den: the rubber plant, and the speakers swapped (user report, Sep 27)
- **The rubber plant by the glass** ("needs to be fixed", a screenshot):
  it was an orange cylinder with a cluster of flat blades (leafCluster)
  floating 2 above its rim, nothing joining them. Now `rubberPlant`
  (den-room.js): an avocado-glazed pot with a rolled rim on its saucer,
  soil, three woody stems (15, 20, 26 high) leaning a little apart, and
  big oval leaves (`ovalLeaf`: a short stalk, widest below the middle,
  cupped, the tip drooping) one after another up them at the golden
  angle, largest low down, each face turned a little about its line so
  the blades show round the room; at each stem's top, the rosy sheath
  of the next leaf. Materials M.rubberLeaf (0x3c6a2e), M.sheath.
- **The speakers swapped**: the vase beside the lamp threw the room's
  balance off, so now the philodendron is on the left-hand speaker (x 46,
  by the lamp) and the bottle vase on the right (x -10), across from the
  ashtray.

### The den: zoom out to the ceiling, no snapping back (user report, Sep 27)
"I want to be able to zoom out more at home... you pinch too far, it just
suddenly snaps back... zoom literally all the way to the ceiling, and not
have it act weird."
- **The snap** was the two-finger swipe (a fast, mostly vertical move of
  the fingers' midpoint, 60 px in under 0.7 s: up = Current Player View,
  down = Top-Down View). A quick pinch with one finger still (the thumb
  at the bottom, the index going up or down) moves the midpoint half as
  far as the pinch, and was taken for a swipe. A swipe now also has to
  keep the fingers' spacing (within 40 px or 25%); a pinch changes it.
  All themes (chassis onUp).
- **Out to the ceiling**: the den's `freeCamera` has zoomMax 140 and a
  `room` box (board frame: 9 in from the walls, clear of the shelves,
  console and fireplace; up to 4.2 under the ceiling, below its beams).
  The chassis's applyCamera keeps the camera inside it, sliding in along
  its line of sight to the target, and out again as the view turns away
  from a wall; `roomLimitRef` is how far the box allows along the
  current view, and a pinch or the wheel starts from the distance you
  can see (min(radius, roomLimit)), so there's no hidden overshoot to
  wind back. Tested with CDP touches stamped at a finger's pace
  (`timestamp`; the test browser is too slow for the 0.7 s window
  otherwise): a quick pinch with the thumb still and the index sweeping
  360 px to it in 0.26 s now zooms 44 -> 81 with the tilt kept (before,
  its 180 px of midpoint travel made it a downswipe: Top-Down View), and
  a real two-finger downswipe still gives Top-Down View. e2e-den's
  overhead check now expects the camera to stop under the ceiling (it
  used to go above, the ceiling stepping aside).

### Tienda: the table's shadow (user report, Sep 27)
"The shadow underneath the tienda table is consistent no matter which
way you spin it around. It's a little bit too dark... should be cast...
not equally." It was a round blur (shadowBlob, 0.7) centred under the
table, turning with it. But the key light (chassis, fixed in the world
at (9, 13, 5)) stays put while the board, the table and the store turn
(the board turns, not the camera), so the pieces' shadows on the top
swung round as you spun and the floor's never did. Now two layers
(tienda-store.js buildTable):
- **From the ceiling** (`tableShadow`): baked once per table from the
  store's own troffers within 110 (six points each over its 4 x 2 ft
  face, weighed h²/d⁴), blocked by the top, the stock shelf and the
  legs; SHADOW_MAX 0.46 (under the shelf), about 0.1 just outside. There's
  a fixture almost straight overhead, so this layer is nearly even.
- **From the key light** (`setKeyDir`, called every frame from
  tienda-fx.js with the light's direction in the board's frame): the
  top's shadow (0.24) and the shelf's (0.2), soft-edged rectangles
  moved away from the light by their heights, and the four legs'
  streaks to the top's corners (0.18). It lies where the pieces'
  shadows point, and moves as the board turns.

### Tienda: the mall reels (user request, Sep 27)
The user sent five tracks (Coupon Gloss Reverie, Twilight at the Atrium,
Tuesday Morning At The Atrium, Tuesday Night at the Emporium, Midday
Clearance Sale) and asked for a Python script to wear them into a worn
background-music tape over a 1975 mall PA: `tools/muzak_1975_filter.py`
(pydub, scipy.signal, numpy; `input_tracks/` -> `mall_master_1975/`,
natural sort, 1:30-3:00 held, 256 kbps). Its chain, in the order the
sound travelled: mono fold-down; mid pre-emphasis, asymmetric tanh
saturation, de-emphasis; hiss (white noise, 1st-order 5 kHz low-pass) 48
dB under the programme; wow 0.6 Hz 0.25% and flutter 14 Hz 0.12% by
resampling along a modulated read position; random -3.5 dB PA dips with
200 ms linear ramps; 4th-order Butterworth band-pass 250-4500 Hz and a
+3.5 dB peak across 1.2-1.8 kHz; a 45 ms slapback at 15%; a synthesised
stereo atrium impulse response (RT60 2.6 s, above 3 kHz 0.7 s, early
reflections) at 22% wet; -19 dBFS RMS, peaks under -1 dBFS. Measured:
under 120 Hz down 35-43 dB, nothing above 10 kHz. The treated tracks
went to the user as files.
Asked whether they should be the store's music, the user said "Yes but
treat them again": so they're reels in the store's rotation, through
the store's own tape machine (0.94 speed, its wow), ceiling speakers and
room, like the 1974 recording. Store copies: assets/tienda/reel-2..6-*.mp3
(mono, 22.05 kHz, 48 kbps, 0.7-1 MB, levelled to the 1974 reel's
loudness), published beside the page as el-cabeza-tienda-reel-2..6.mp3
(build.js `files`; Nova's store reads the same files). tienda.js
`STORE_REELS`; tienda-audio.js `createAudio({ tapeUrls })`: the reels
take turns with the arrangements, the next reel each time, round and
round; each is fetched when it's next up and decoded ahead while the one
before plays, and let go once played (two decoded at most); a reel that
can't be had is skipped; a game's end keeps the current reel's place.
Test hook `__TIENDA_NEXT_REEL__()`; e2e-tienda checks reel 2 follows.

### Tienda: the ceiling speakers' music at half (user request, Sep 27)
"Music over PA speakers in Tienda volume should be cut 50%": the music
(the tape and the arrangements) now goes through `MUSIC_VOLUME` 0.5
(tienda-audio.js), a gain after the speakers' crunch (so the sound is
the same, only quieter), and the tape's extra send to the room's tail is
halved with it. The PA announcements, the store and the pieces are
unchanged.

### Piece guide switch (user request: helpers off for players who know the game)
`showGuide` (chassis; localStorage `el-cabeza:piece-guide`, on unless
"0") gates the piece card (`pieceCardShown`), and on a phone the bar's
piece text (`pieceInfo`) and its "Tap one of your pieces / Tap a marked
square" tips. Switched from the dock's corner (`guide-toggle`, a speech
bubble glyph, struck through when off; the Nova layout icon moved one
place left) and from the phone menu's Settings (`shell-menu-guide`). It
doesn't touch the move markers (you move by tapping them) or the cost
badges and points dots, which have their own switches. Every version
uses the chassis, so all of them have it. Test: tests/e2e-piece-guide.mjs.

### MOVES: a side view wherever a piece tips (user request)
chassis/RulesCards.jsx (one MOVES card for every version). Every tile
whose demo rolls or tips a piece now has two panels, ABOVE (a 4 x 3 mini
grid) and SIDE (the floor at y = 48, 12-unit cubes, columns SX(c) = 66 +
12c ticked along it), animated in step: Roll, Opa (the 2 x 2 turning about
its edge, two squares), Tall pieces tumble, Crush (the disc flattens as
the block lands), Free way back (tips there and back; the refund dots in
SIDE's corner), Shelter, Shove by rolling (NEW tile `shoveRoll`, law
shoving: a standing Flaco tips and pushes a Turrito two squares; the push
runs linear, keyframed a step ahead of the tip, so they never overlap),
Pivot, Black hole (holes are gaps in the SIDE floor, `panelsWith([1,3])`:
it tips in and drops, rises out of the other and tips back west; ABOVE
moves and shrinks on separate nested groups so it shrinks INTO the hole),
Split Movement (both moves now east so the side view shows them: a
Turrito, then a lying Flaco's end rolling over its long side), Missing
squares (a gap in the floor; the block rolls, tips toward it and settles
back, a nested rotation about the landed cube's far edge). No side view,
as the user said (nothing tips): Cabeza step, Reach the far row, Slide,
Diagonal Slide, Shove (the slide one), 3 Actions. Test: e2e-rules checks
which tiles carry SIDE (17 tiles now).

### Standard: the den (user request: the game at home)
The user: "they went to the store & ended up buying a copy and bringing
it home and are now playing it in their den / family room / sitting room
/ conversation pit" (three 1970s reference photos). The questions were
dismissed, then "go ahead", so these are the defaults, open to change:
Tienda's copy of the board and pieces, a sunken conversation pit, quiet
fire/clock/rain sounds (switchable), den-coloured menus with the rules as
the box's booklet. Landing knocks stay on the solid board (their earlier
choice).
- **Wood set:** themes/wood-set.js `createWoodSet({env, quality, lights})`
  holds Tienda's board texture, slab, grid, pieces, markers, missing
  squares, black holes, the brass frame, followGrain and woodSwatch.
  tienda.js and standard.js each make one with their own lights and
  environment panorama (store / den), so the wood reads right in each room.
- **The room** (themes/den-room.js `buildDen(boardSpan)`): the board sits
  on a walnut coffee table (`buildCoffeeTable`) in the middle of the pit:
  sofas (rust corduroy, print pillows) on the north, south and west, steps
  up on the east. North: fieldstone fireplace (a ShaderMaterial flame and
  glow sprites), mantel, a sunburst clock showing the real time, books.
  East: a sliding glass door onto a rainy night yard (the rain runs), drapes.
  South: console TV (screen colour 0x070a09: anything brighter reads as
  switched on), stereo, records, landscape, table lamp. West: floral paper,
  credenza, two lamps, abstract painting, macramé hanger. Middle: velvet
  chair, plaid ottoman, arc lamp, rubber plant; swag lamps overhead.
  On the table: the closed box (the lid art), the leaflet, two iced teas
  on coasters and a bowl of party mix. Textures are all canvas-painted
  (themes/den-textures.js), no image files except the lid art.
- **Lighting:** the room is unlit (`MeshBasicMaterial` + vertex colours
  baked from `LAMPS` with falloff and wrap, world-planar UVs), merged per
  material and group by `Builder`: about 120 draw calls for the whole
  room. The table and what's on it are lit, so the board's shadow falls
  on them and they match the pieces.
- **Everything hangs off `boardGroup`**, so turning the board reads as
  walking round the pit; rebuilt when the board size changes (table
  `TW = span + 16`, pit half-width `PH = TW/2 + 22`). Fog 0x1c130c
  150-420, background 0x140d08, camera far 900 (den-fx.js).
- **Cutaway:** groups `den-sofaN/S/W`, `den-wallN/E/S/W`, `den-ceiling`.
  `den.animate(now, camLocal)` hides a sofa when the sight line from the
  camera to the table passes under its back or seat (a low camera pulled
  back would otherwise be inside it), a wall once the camera is past it,
  the ceiling once the camera is above it. Don't remove it.
- **Device fit:** tienda-quality.js tiers (pixel-ratio cap, shadow map,
  physical materials) and the same frame-rate governor as Tienda.
- **Sound** (themes/den-audio.js): The room (fire bed, hiss and crackles;
  the clock ticking the real seconds; rain, drops, rare far thunder) and
  Pieces (wood-sfx.js on the solid board plus a small room reverb). The
  room starts on the first gesture. Win: a marimba figure.
- **Menus** (standard.js `styleSheet`, `COLORS`): cream masthead with a
  warm glow, dock card and chips in den browns; the rules pop-up is the
  box's booklet (double inset rule, Bodoni headings).
- Games still open top-down (earlier user rule), so the room shows at
  setup, in player view and when orbiting or zoomed out.
- **Test hooks:** `__DEN_ROOM__` (true while mounted, false after
  dispose), `__DEN_THREE__` (with `__EC_TEST_HOOKS__`), `__DEN_QUALITY__`,
  `__DEN_PIXEL_RATIO__`, `__DEN_AUDIO__()`. The chassis's
  `__EC_TEST_CAM__({theta, phi, radius, target})` moves the camera
  (the wheel zooms, but slowly under SwiftShader).
  Test: tests/e2e-den.mjs.

### The den, round 3 (user requests, Sep 27)
- **No wind, for real.** The "wind" the user still heard was the fire's
  roar breathing: its bed was re-aimed every 0.6–1.5 s (random gain and
  cutoff) and louder near the fireplace, which reads as gusts. It's now a
  steady brown-noise bed (lowpass 300 Hz, gain 0.022) under the crackles
  and pops, which still come and go (den-audio.js startFire).
- **The stereo's speakers**: pottery on the left one, a plant on the right
  (they had the same plant): a studio-pottery bottle vase (lathe, a dark
  tenmoku glaze run over speckled oatmeal, the foot raw: `glazeTexture`)
  on the left as the player faces the console (den x 46; den x runs right
  to left from the pit), the heartleaf philodendron on the right (x -10).
  (Later swapped, "The den: the rubber plant, and the speakers swapped".)
- **The hall's wallpaper** differs from the room's flowered accent wall:
  `hallPaper()` (den-textures.js), a period geometric of interlocking
  avocado and harvest-gold rings with orange dots on cream,
  `HALL_PAPER_TILE` 16, on the hall's three walls.
- **Diagonal Slide brings Slide** (Neon's sphere, neon-singularity.js):
  checking Diagonal Slide checks Slide, and unchecking Slide unchecks
  Diagonal Slide, as Tienda's order form (rules-selections.js
  `toggleLaw`) and Lluvia's city menu (lluvia-overlay.js) already did;
  the other live pages have no law menus of their own.
- **The rooms look around** (`freeCamera`, §5) and **the floating piece on
  phones** (Nova, "Follow-up decisions" above).

### The store's standee, the den's chair and the ice (user reports, Sep 27)
- **The store's standee** (user video: orbiting wide round the table,
  "the camera goes behind it... blocks everything out with just a brown
  color"; "zoom out a little bit more in the tienda"). Tienda's zoom now
  goes out to 82 (`freeCamera.zoomMax`; the board's own limit was 55),
  far enough to go round the advertisement's stand and see it from
  behind. And the standee fades out of the way (0.25 s; back in 0.35 s)
  when the camera is in it or behind it looking through it at the table
  from close enough that it would cover about 45% of the screen's width
  (tienda-fx.js `standeeAside`; tienda-store.js `standee`: the photo,
  the stand, and its NOW IN STOCK card, now a mesh of its own rather
  than part of the signs' one mesh, their materials transparent). From
  the front, or behind but off to a side, it stays. Test hook:
  `__TIENDA_STANDEE__` (its opacity).
- **The den's club chair** ("the olive stairs structure is incorrect"):
  the back was placed with the wrong sign across the chair (sin of the
  turn where it needed minus sin), so it stood off to one side of the
  seat, and with the low arms it read as steps. It's rebuilt in its own
  frame (den-room.js, `part` about `chX, chZ, chR`): a skirted velvet
  base on four walnut feet, the back and both arms standing on it the
  full depth, a seat cushion between the arms and a back cushion
  against the back; 15 wide, 14 deep, the back 14 high, facing the room.
- **The ice in the scotch** ("needs to be more submerged", a close-up
  of the coffee table's tumbler): the cubes sat on the surface, one
  wholly above it. The whisky is a little deeper (0.9) and each cube
  floats with 0.05–0.13 of its 0.58 above the surface. The ice is drawn
  before the whisky and writes depth, so the whisky tints what's under
  the surface and not the tops (it used to draw over the whisky, which
  made the ice look as if it sat on it).

### The den, round 2 (user requests)
- **Sound** (den-audio.js): rain is a steady patter with drops on the
  glass and a drip from the eaves, no swells and no thunder (they read as
  wind; user: "no wind noise"). The clock is a woody tick-tock (filtered
  clicks, the tock lower), quiet, on the device's seconds; on the device's
  hour it plays the Westminster hour chime, the four phrases only (no
  counting strokes; user's choice), as a 1970s chime chip through a tiny
  speaker, quietly ("these people are trying to concentrate"). The fire's
  crackles are louder and have their own bus: den-fx.js calls
  `audio.setFireListener(distance, pan)` from the camera every 100 ms
  (nearer is louder, about twice as loud warming your hands as from the
  pit's middle, and panned to its side). Test hooks: `__DEN_CHIME_NOW__`,
  `__DEN_AUDIO__().fire`, `.chimes`, `.music`.
- **The stereo console** (den-room.js `buildConsole`, lit, not baked, so
  it holds up close): walnut cabinet, a turntable set into the top under a
  smoked lid (the lid lifts while you're over there, the platter turns and
  the arm swings in while a record plays), the receiver's amber dial and
  knobs, the 8-track slot with its four program lights (a cartridge sits in
  it while a tape plays), cabinet speakers with woven grilles, a golden
  pothos and a heartleaf philodendron trailing over them (user's choice of
  decor), a heavy amber-glass ashtray, a record sleeve. Its still parts are
  merged by material. Metals have low metalness: nothing in the room to
  reflect (fully metallic surfaces rendered black).
- **Music** (theme.music in standard.js; chassis): the sound menu's
  "Choose music" and the phone menu's "Choose music" open a small music
  panel (`music-panel`), and so does a tap on the turntable or the 8-track
  in the room (ambient `pickScene`, before the tap handler's play gates, so
  it works in setup, play and after the game; a piece or marker under the
  tap comes first). While the panel is open the camera glides to the
  console (ambient `setMusicFocus`; the chassis calls ambient
  `cameraOverride(camera, dt)` after placing its own camera each frame,
  and the den blends toward its view and back) and the dock steps aside.
  Each source lists its tracks or says it's empty; a track plays through
  den-audio `playMusic` (a little surface noise for vinyl, hiss for tape),
  on the den's own "stereo" channel (shown as Music; not Tienda's "music"
  key, since channel choices carry between pages; picking a track switches
  it back on). Tracks: themes/standard.js
  `DEN_TRACKS`, empty until the user sends them (see the wishlist).
- **Doorway**: in the south wall, left of the console as you face it from
  the pit (east of it; user: "on the left side of the stereo console"),
  its door standing open onto a hall with a light and a framed print. The
  glass door stays (user).
- **Table**: a stoneware mug of coffee on its saucer, a teaspoon on the
  rim; a heavy tumbler of scotch on the rocks; the bowl heaped with snack
  mix built piece by piece (peanuts, pretzels, cereal squares, rye chips,
  instanced), so it reads from the sofa.
- **The INFO booklet** (standard.js styleSheet): its double rule is inset
  shadows under the text, so the scrolling part now stops short of the
  rule and fades into it (user report: text scrolled into the margin).

