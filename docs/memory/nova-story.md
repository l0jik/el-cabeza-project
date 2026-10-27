## Nova's story: the store, home, and the TV into Singularity (user plan, Sep 27)

User: Tienda is "where the game starts... the basic game"; "purchase and
bring home" takes you to the living room, "where we're going to have
access to everything"; "to get to Singularity... there's a TV in that
room... click the on switch... that's going to take you into
Singularity". Asked, the user chose: Nova becomes the story (one link,
opening in the store; the separate pages stay as they are); the next
visit opens at home with the store reachable and "Start the story over";
the store's Custom rules becomes a look-only catalog of the five pieces;
every store game is the classic game; the purchase any time, and offered
after a store game; the TV: a 1975 wood console, the power knob, the tube
warming up from a dot, snow and a test pattern, the picture pulling you
in; leaving Singularity, back in the den as the set switches off.

- **Places** (apps/unified.jsx `THEMES`): `tienda` the store (Tienda's
  theme with `story: STORE_STORY`), `standard` home (the den, Standard's
  theme with Tienda's printed matter: `useSetupExtras`,
  `renderSetupExtras`, `renderExtraOverlays`, `shellSetupActions` from
  tienda.js with `story: HOME_STORY`), `futuris` Singularity. The first
  place is the store unless `localStorage["el-cabeza:story"]` says
  `{ owned: true }` (apps/novaStory.jsx `readOwned`/`saveOwned`).
  The chassis keeps its theme object while mounted, so the story's
  handlers reach the app through module-level bridges (`storyBridge`,
  `tvBridge`) the app keeps pointed at its current handlers.
- **The store** (tienda-overlay.js with `x.story.mode === "store"`): the
  lid as ever on a first visit; "See the pieces" (the lid, the dock's
  setup row, the bar) opens `PieceCatalog` (`tienda-catalog`): the five
  pieces, photograph (tap: the 3-D viewer), catalog number, what each
  does, the price; Close or "Purchase and bring home". Below the setup
  row, "Purchase and bring home · $7.97" (`story-purchase`); in a game
  the sales slip has it (`tienda-slip-purchase`); after a game ends
  (finished or ended), the clerk's offer at the top (`tienda-offer`, ×
  dismisses); the bar menu's "Purchase and bring home"
  (`shell-menu-purchase`). No title hold in the store.
- **The purchase** (apps/novaStory.jsx `StoryCut`, kind "purchase"): the
  purchase is saved at once; the screen dims, the register rings it up
  (Nova's own sound engine: `sfx.register`, keys, ratchet, bell, drawer,
  the printer's hammers line by line, the tear; unifiedTransition.jsx
  `playRegister`), the tape prints out of a slot line by line (today's
  date in 1975, 1 EL CABEZA No.4417 7.97, tax .48, total 8.45, cash
  10.00, change 1.55) and is torn off; a tap skips to the black. Black,
  "Later, at home.", and under the black the den is mounted; the cut waits
  for it (`cut.arrived`, set by the app's effect after the new chassis's
  mount effects) plus two frames and a moment to read, then fades up.
  "Back to the store" ("Back at the store.") and "Start the story over"
  ("Once more, from the top shelf.": the purchase forgotten, the lid back on,
  `tiendaTheme.resetLid()`) are the same fade without the register.
  Arriving by a cut, the place's sound comes up (the store's; the den's
  room), or at the next tap if the browser holds it back
  (`story.arrived()`: false | "cut" | "fresh", read once).
- **Home**: the dock's setup row is Custom rules (the whole order form) +
  Begin Game, and under it "Back to the store" · "Start the story over"
  (`story-back-to-store`, `story-restart`); the bar has Custom rules below
  Begin Game and the menu "Turn on the TV", "Back to the store", "Start
  the story over". The order form's carbon copy (the slip) shows at home
  only in a game with ordered rules.
- **Each place starts with the classic game**: a scene change (a cut or
  the CRT transition) puts the engine's module state (laws, board size,
  black holes, missing squares) back to what the page booted with
  (`restoreBootRules`), since a remount leaves it alone.
- **The television** (themes/den-tv.js, placed by den-room.js, run by
  den-fx.js): a walnut color console of 1975 on a plinth: the curved
  picture tube in a black bezel with a chrome line, a brushed-gold panel
  (Aurora, SOLID STATE COLOR, the VHF selector with channels 2–13 round
  it, the UHF dial, the power knob with OFF · ON / VOLUME and a pilot
  light), a grille along the bottom, rabbit ears with a UHF loop, a
  snapshot in a frame. Lit like the console (it's visited up close), the
  screen a small shader: the dead tube's grey-green glass; switched on
  (`powerOn`), the knob turns with a click, a dot opens to a line and the
  whole screen (brighter while squeezed), snow, the test pattern (color
  bars, the reverse strip and low band, circle and cross-hair,
  "SINGULARITY · CANAL 99 · TEST") and the station's tone; its light on
  the room (an additive halo; a blue point light on better devices).
  Switched off (`powerOff`): the picture folds to a line, then a dot that
  fades. Sounds (den-audio.js, behind the Music switch): the switch's
  click, the degauss thump, the line whine (15.7 kHz, faint), the snow's
  hiss by phase, the tone, the pop going off.
- **Into Singularity**: a tap on the set (ambient `pickScene` → "tv",
  then `sceneTap`; the chassis lets a theme handle its own scene taps) or
  the bar menu's "Turn on the TV" (`shell-menu-switch-theme` at home;
  `tvBridge.press`). In Nova (`helpers.tv.portal()` true when nothing
  else is under way) the camera goes over to the set as it warms up
  (`cameraOverride`, fitting the set to the screen's width and height,
  up to 70 away on a tall phone), and once the pattern has held 0.7 s,
  the dive: the picture swirls toward the circle's middle and turns to
  Singularity's colours as the camera goes right up to the glass; 1.5 s
  in, `tv.enter()` → Nova's `beginTransition()` (the CRT transition into
  Futuris, no CONNECT prompt). A tap on the set before the dive turns it
  off again. On Standard's own page (no `tv` helper) the set simply turns
  on and off.
- While the camera visits the set, the title and the dock's piece step
  aside (den-fx toggles `html.ec-tv-visit`; standard.js styleSheet). A tap
  on the board or the coffee table with the set behind them is the
  board's (pickScene checks they're nearer). The set's printing and
  pattern are drawn in fixed frames (256 x 352, 512 x 384) scaled to the
  power-of-two canvas, so letters and the circle keep their shape. The
  phone menu's theme item is now "Turn on the TV" at home and "Back to
  the den" in Futuris (same testid, `shell-menu-switch-theme`).
- **Back out**: Nova's "out" transition sets `tvBridge.returning`; the
  den mounts with the camera at the set showing the pattern, and 1.8 s
  later it switches off as the camera goes back to the board.
- **Tests**: `tests/e2e-story.mjs` (the whole story on a desktop and a
  phone's bar); the Nova tests that expect the den set the story as owned
  in their init scripts. Test hooks: `__DEN_TV__()`, `__DEN_TV_PRESS__`.

- **Closing time in the store** (themes/tienda-shopping.js StorePA, the
  first visit): the PA's ten minutes to closing (the lights down a step),
  then, in real minutes from it, five, four, three and two to go, and at
  one Big Glutts' notice over the store (logo, stripes, "We're going to
  have to ask you to leave. Please take all purchases to the front
  registers.", the lights down another step): its button checks out (the
  purchase), "Just a minute" (or Escape) puts it away until three more of
  the player's moves, then it's back, "The store is now closed." Tests
  shorten a minute with `__EC_TEST_CLOSING_MINUTE_MS__` (e2e-store-nudge).
  In a game it all comes sooner (2026-10-20, user: "encouraged to
  purchase the game and leave the store 3 moves after they have started
  playing once the tutorial has been completed"): in stock, closing time
  and the notice ("The store is now closing.") after the player's first,
  second and third moves since the walkthrough (MOVES), whichever's
  first, the moves or the clock.
- **The first game in the store** (2026-10-17): a new player is Ash and
  opens, against the computer as Walnut on Easy (tienda.js
  defaultOpponent), and their first Try a Game is walked through
  (chassis/FirstGameTour.jsx, tienda.js firstGameTour: the story's store
  before the game's bought; once a device, `el-cabeza:first-game-tour`).
  Since 2026-10-18 each card lights up what it speaks of (rings on the
  board, the goal row lit, labels and arrows over the screen) and a tap
  on a piece picks nothing while a card's up. Tests that try a game there
  as a new player meet it: skip it (`tour-skip`) or seed the key "done"
  (e2e-touch-in-game does); `tests/e2e-first-game-tour.mjs` goes through
  it. Tests of how pieces move on Big Glutts' own page that play Walnut
  first seed the store's old sides (`el-cabeza:opponent` { aiPlayer:
  "light", aiDifficulty: "easy", humanStartSide: "dark" }: e2e-outline,
  e2e-outside-dismiss, e2e-slide-sounds).

- **The store's menu at first** (2026-10-19; user: "For a first-time
  player on a new game, the only buttons that can be pressed if they hit
  the 3D rotating piece menu is the ones that are circled in red", See
  the pieces and Try a Game): until the walkthrough's done (TOUR_KEY),
  the dock's setup is that first game's, the rest of the panel faded and
  not to be pressed (the chassis's firstLook; the bar's setup too); and
  the catalog's page (See the pieces) has no Purchase and bring home
  until then (user: "unless they have already gone through the tutorial
  and played the game a little bit first").
  tests/e2e-first-look.mjs. (It reads how faded each control looks once
  the panel's own 500 ms fade-in is done, dock-helpers
  waitForPanelSettled: CI run 39600509821 read See the pieces at 0.92,
  700 ms after the panel said it was open, the panel itself still
  fading; reproduced here unthrottled, 0.91.)

- **The title screen** (2026-10-19; apps/title-screen.js, in Nova's page
  ahead of the app): every plain open of Nova's page plays the Horizon ·
  Build splash (its buttons the last thing in, 6.9 s of video, once EL
  CABEZA and NOVA both are, user, 2026-10-20; a finger's tap counts as it
  lifts; the board's change slower and its ghost coming and going in the
  disc since, the last two breaths looped, 8.5 to 11.9 s), holds on the
  logo breathing, and offers Begin / Continue
  (/ Continue in <last world> and Other realities after the story) and
  Restart the story; the app mounts only once a choice is made
  (apps/unified.jsx fromTitle) and says when it's up (window.ecTitle.done).
  Only its buttons do anything (user: "you have to hit the buttons"): a
  tap elsewhere, held or while the video plays, chooses nothing; Escape
  skips the video on a keyboard. The first tap, click or key anywhere
  puts the page full screen (user: "That should be the first thing it
  does"; a page can't by itself). Added to a phone's home screen (the
  manifest, display fullscreen, build/build.js APP_HEAD) it opens full
  screen with no tap at all on Android, without Safari's bars on an
  iPhone.
  Never on the game's own ways into the page (?world=, ?scene=, ?switcher,
  ?restart=, ?jump=, Back) nor under automation; ?title forces it for a
  test, ?title=auto applies the player's rules. tests/e2e-title.mjs.
- **The way out** (2026-10-21; user: "When clicking begin on the splash
  screen, it should play the animation in reverse. Like maybe begin like
  zooms out like vertically, and then as it's doing that, then everything
  goes in reverse"): the chosen button squeezes to a line and is gone as
  the splash plays backwards from the held logo to the board (2.8 s, a
  clip rendered from the video's own frames: tools/splash render.mjs
  rewind; assets/title/rewind*), the logo settling back down as it goes;
  the app comes up under it and the title fades once both are done.
  Escape cuts it short; with reduced motion, or the clip not there in
  time, the title fades as it did.
  Slower since (2026-10-21; user: "When begin is pressed at the splash
  screen, the reverse sequence needs to go a little bit more slowly. It
  happens so fast you don't really get to see anything"): the 2.75 s
  clip ran the emblem coming apart (the video's 3.25 to 1.25 s, where
  nearly all the change is) in half a second, four times its speed. Now
  4.8 s, REWIND 0->8.5, 0.6->6.8, 1.35->5.2, 1.9->3.3, 3.6->1.25, 4.8->0:
  NOVA closes at twice the speed, the still emblem (3.5 to 5 s, nothing
  moving) goes by fast, the emblem comes apart at about its own speed
  (1.7 s of it), the board set down at 0.6x. Measured from the video
  (frame-to-frame change every 0.25 s) before choosing. rewind.mp4 2.7 MB,
  rewind-720.mp4 503 KB, rewind-720.webm 457 KB; first frame = title@8.5,
  last = title@0. The button's squeeze 0.8 s (was 0.55), its rules 0.65 s,
  the stage settling back 1.6 s (was 0.9); the stall guard 8 s (was 6).
  e2e-title checks the clip at 4.8 s.
  Smoother since (2026-10-22; user: "The splash screen animation is, it
  kind of gets hung up. I think I especially notice it when it's after
  begin is pressed and it goes back. It's not as smooth as it should
  be."). Measured frame by frame (scratchpad splash/measure.mjs: each
  video's requestVideoFrameCallback, the page's long tasks; a 412x915
  phone page at 2.625x), then with each suspect taken away: (1) the
  blurred room round the picture, a CSS blur(16px) on a canvas several
  screens in size, blurred again each time it was painted (every video
  frame): without it the video held 30 fps where it had dropped every
  other frame; (2) the app mounted 150 ms after Begin, under the
  playback: 7.5 s of long tasks (the longest 2.5 s) in its 4.8 s, a
  phone's graphics busy with the scene's first pictures; mounted after
  it instead, the playback ran 142 frames with one skip. Now the blur's
  drawn in the canvas itself (paint: the 64 x 52 picture in an offscreen
  canvas, drawn blurred, 2.4 px, into the shown one at 256 x 208; no CSS
  filter, kept only where a canvas can't blur, Safari before 18, class
  css-blur), painted 18 times a second at most; screenshots before and
  after differ by 6 of 255 at most. And the app's let in once the
  playback's over (rewoundNow -> letAppIn; at once with reduced motion,
  no clip, Escape or the stall guard), the board, its last frame, held
  still while it comes up; the title fades once it's up, as before.
  e2e-title checks the app came only once the playback was over, under
  the title still.
  And over a phone's line (its files are the 1080p ones: the splash
  4.4 MB, the playback 2.7 MB at 4.6 Mbit/s, which was only fetched once
  the menu came): the playback's fetched as soon as the splash is all in
  (fetchRewind on the splash's progress; at the menu at the latest), and
  plays only once it can play to its end without running dry
  (playsThrough: HAVE_ENOUGH_DATA or all of it buffered); not yet at
  Begin, it plays unseen while it comes in, the logo breathing on, then
  shows from its start; not in 3 s, the title fades without it. Measured
  over throttled lines (scratchpad splash/serve.mjs, a byte-range server
  like GitHub Pages; measure.mjs MEASURE_BASE, MEASURE_KBPS,
  MEASURE_TAP_AFTER); the local browser has no H.264, so it plays the
  720p WebM files, a sixth to an eighth of a phone's.
  The splash itself, over such lines, started with a little in and ran
  stop and go through the board's change (3 Mbit/s: 5.5 s on the poster,
  then four stops in its first 2 s, up to 0.3 s each; 1.5 Mbit/s: 11 s,
  then stops, then the stall guard's still logo). The browser's own
  "can play through" (canplaythrough, readyState 4) ran out the same way
  (its guess made while the game's 4.3 MB of scripts shared the line),
  and a first try that also counted "no data yet" as a browser that
  fetches only once played started it too soon, worse at 1.5 Mbit/s.
  Now it starts once it's in up to the menu (buffered from 0 to
  MENU_AT + 1 s, or all of it; the breathing after is light), the poster
  (its first frame) up meanwhile; 2.5 s on if the browser isn't fetching
  it at all (networkState not LOADING: one that fetches only once
  played, or a phone's preload cut to metadata); the stall guard counts
  from its start (MENU_AT + 6 s), and one that can't start by
  MENU_AT + 6 s from the page's start gets the still logo and the menu,
  as before. Measured after (local WebM, Begin the moment the menu's up):
  3 Mbit/s, the poster 8.7 s then the splash without a stop, the
  playback 144 frames without a skip; 1.5 Mbit/s, the still logo and
  menu at the guard, no stop and go, the playback the same; from files,
  as fast as before. e2e-title passes. And a line under 5 Mbit/s
  (navigator.connection.downlink) takes the 720p files, as Save Data does.
  The user, after: "The splash feels smooth now after pressing Begin."
  (2026-10-22).
- **The wide splash** (2026-10-23; user: "the splash screen for the game,
  when opened on large screens still uses the mobile splash screen. I
  thought a large screen version was created. If not, we'll need to do
  that."). None had been: every splash (the fifteen poster videos, the
  five logo videos, the title's) was 1080 x 1920, and a computer got that
  upright frame in the middle of its screen with the blurred room round
  it. Now tools/splash renders the Horizon · Build splash wide as well,
  1920 x 1080 (render.mjs --land, splash.html?land, lib/size.js LAND):
  the board on the left (820 wide, centred at 530,540: lib/board.js
  REST), the emblem where it was on it (logos.js L5 C 530,520, R 290; its
  ground lit a little to the right, 610,520, r 1500), the name on the
  right, EL CABEZA 680 wide centred at x 1450 (lockup.js TITLE.cx; base
  437, up to 363 as NOVA comes; NOVA's line at 480, 130 px), all else as
  the upright one and its timing the same to the frame (the menu at 6.9
  s, the loop 8.5 to 11.9 s, the playback the same REWIND). First tried
  with the name at 1420 and NOVA at 515: NOVA's left rule all but met the
  emblem's right-hand line (15 px apart in height, 24 across), so the
  emblem 30 px left, the name 30 px right and 35 px up; everything clear
  of the title screen's 5% edge fade. assets/title/ title-land.mp4
  (1080p60, 4.2 MB; the upright's 4.4), title-land-720.mp4 (720p30 crf 25,
  800 KB), title-land-720.webm (VP9 crf 36, 459 KB), poster-land.jpg (its
  first frame, 1280 x 720, 60 KB), rewind-land.mp4 (2.5 MB),
  rewind-land-720.mp4 (446 KB), rewind-land-720.webm (378 KB); build/build.js
  nova files el-cabeza-title-land*. apps/title-screen.js takes it on a
  screen more than 1.15 times as wide as it's tall (a computer's, a tablet
  or phone on its side; data-frame "wide", class land): the video as large
  as fits at 16:9, the room round it its own edges as before (the backdrop
  canvas 52 x 64, the picture 28 x 16 in it), the menu under the name on
  the right (its middle 75.5% across the frame, its top 55% down, NOVA
  ending at 49%), the picture not moved up for it; fit() scales the menu
  instead (--k): up to 1.5 times on a large screen (the picture's height
  over 800 px), smaller where it would run off the bottom (a phone on its
  side, Continue and the rest under it), 0.6 at least.
  Chosen as the page opens: a phone turned after keeps its first frame.
  (Scratch pipeline: scratchpad land/run.sh stills|rstills|video|rewind|
  encode|sounds|install.) tests/e2e-title.mjs: a desktop gets the wide
  files and the menu under the name; an upright phone the upright ones; a
  phone on its side (844 x 390) after the story, the wide splash with its
  whole menu on the screen.
- **The title's sounds** (2026-10-23; user: "I also want to add some audio
  to the splash screen... When BEGIN is clicked, perhaps a tiny
  acknowledgement, and when the pieces are placed on the board, each
  appropriate wood sound for the specific position they land in can also
  call in succession as they land, perhaps with some rarefied
  processing."). The splash had been silent (the user's own "Silent" for
  the first splashes). Two short files rendered offline from the game's
  own knocks (themes/wood-sfx.js, the solid slab's: tools/splash/
  sounds.mjs drives sounds.html in Chromium; ffmpeg to MP3 112k):
  begin.mp3, one soft Turrito knock and its ghost an octave up in a high,
  light room, peak 0.24 (1.6 s, 23 KB); landings.mp3, the way out's: each piece
  knocked down as the playback brings it back over its square, in the
  order they come (lib/v-build.js landingsOf: the three pieces cast into
  the emblem where their flights began, 1.65 s + 0.2 s each, then the
  other seven out of the disc, 1.2 s + 0.07 s each, the morph's own
  seconds, timed by the playback's clock, lib/rewind.js rewindTimeOf):
  2.41 s the light Opa, 2.63 the light Turrito, 2.88 the dark Flaco,
  2.92 the dark Chato, 3.01 the dark Turrito, 3.11 the dark Cabeza, 3.20
  the dark Opa, 3.30 the light Chato, 3.39 the light Cabeza, 3.48 the
  light Flaco; all of them settle down together after, at 3.99 s, without
  a sound. Each as the game lands it (landingSize: a Turrito's 1 square,
  a Flaco on its side 2, a Chato 2, an Opa 4 and its 8 cubes; a Cabeza
  brushes, it never knocks in the game), across the stereo by its column
  (the board's width as 0.9 of the pan, so these middle columns about
  0.3 either side), the far rows a little softer and further into the
  room; the "rarefied" part: the room (3.6 s of decaying noise, nothing
  under 420 Hz in it) and each knock's ghost an octave up, in the room
  alone. Peak 0.5 (8.4 s, 118 KB). The onsets measured in the file match the
  list to the millisecond. apps/title-screen.js: fetched as the menu
  comes; the context made and woken in the tap that chooses (a phone
  allows sound only from one; touchend and click wake it too), the knock
  at once, the landings started from where the playback is when it shows
  (its currentTime), faded with it if it's cut short (Escape, the stall
  guard), the context closed once they've rung out. The same for both
  frames (the same board, on the same clock). e2e-title, over HTTP (a page
  from disk can't fetch them): the knock at Begin, its context running;
  the landings from where the playback is.

- **No INFO from a tap on the title in the story** (2026-10-22; user,
  with a phone screenshot of Futuris's summons: "remove the info button
  from here. Summoning, I guess that's the name of this page, I forget.
  But remove the info button or disable it on the story."). A tap on EL
  CABEZA showed the masthead's INFO button for 4 s (chassis
  handleTitleClick) in every world, the summons too. The chassis takes a
  `titleInfo` prop now (default on); Nova's page passes the story's end
  (unified.jsx `titleInfo={ended}`), so nowhere on the story, the store,
  the den, the summons and the sphere, does a tap on the title bring it
  up; after the story it does again, and on every world's own page.
  The title taps still count toward Futuris's five-tap SINGULARITY.
  ?scene=summons and ?scene=lure play as the story (storyPreview: not
  ended), so they have none either. The button: data-testid
  masthead-info. Checked in a browser (scratchpad info/check.mjs): the
  summons by its link, fresh and from a finished story, INFO stays at 0;
  Nova ?world=futuris after the story and Futuris's own page, at 1.

- **Restart the story leaves nothing of the switcher behind**
  (2026-10-21; user, with a phone screenshot of the store's Standard
  Cabeza / Cabeza Nova card over the box: "Selecting Restart the Story at
  the bottom of the Theme Switcher has this menu overlay that can't be
  dismissed. This shouldn't be here."). A world reached from the
  switcher on another page marks the tab's visit (sessionStorage
  `el-cabeza:realities-visit`, realities.js goToWorld), which
  reality-gate.js storyOver counts as the story being over, so a world
  page keeps its way back; the restart forgot the story's own records but
  not that mark, and the store (whose gate card has no way past it) took
  the story as over. Now all three restarts forget it
  (realities.js forgetRealitiesVisit: unified.jsx restartStory, the
  ?restart=story start and the title's Restart the story), and a fresh
  start is a fresh mount even from the store to the store (the chassis's
  key `${themeName}#${freshN}`, freshN counting fresh cuts). Reproduced
  first (both ways, the card up), then green: tests/e2e-journey.mjs
  "Restart the story after the theme switcher".
- **Between scenes** (2026-10-20): the receipt prints to its end, taps
  or not (user: "so it can complete the animation"). The scene changes'
  lines and the clerk's clipping are in faces kept with the page
  (themes/faces.js; build/build.js FACE_FILES), never a place's Google
  sheet, and wait for them (a moment at most), so they keep one face
  from their first frame to their last (user: "whenever there's any of
  that sort of segue text font, there's something wrong with it"). The
  commercial waits on its first frame for the picture before its hold,
  its sound and "Wait… is that my house?" (user: "what are they reacting
  to"). The thought goes by the spot's own start too (den-fx.js
  HOUSE_CLEAR, 300 ms before it plays), not only HOUSE_MS after it came:
  with slow frames it came up late and was still up as the spot played
  (CI run 39461728058, e2e-den-spot; reproduced at 6x CPU throttling).
  After the commercial the order paper's ring comes up only once
  the camera's back on the table, the set off (user: "only appear once
  you've centered on the table"), and until it's up a press on the set
  doesn't go back into Futuris.

- **The set takes them** (2026-10-20; user: "Eventually, the TV has to
  pull the player into the TV ... short, quick ... a yell ... they get
  stretched out ... the camera moving ... toward the television"): the
  lure can be ignored a while, but after the blast, if the set's not
  been turned on, it pulls the player in itself (9 s on if the head's
  still held on it, else 20 s after they last went over or came away): a
  1.35 s rush from wherever the camera is into the glass, slow then all
  at once, the lens widening, the picture drawn out toward the set with
  streaks of light, the set's roar and his yell (the hall's shout), then
  Nova's own way into Futuris. den-fx.js PULL_*; tests/e2e-tv-pull.mjs.
- **The clerk's clipping on a big screen** (2026-10-20; user: its
  captions "are really small on a desktop or laptop ... Maybe not on the
  phone"): from 700 x 560 up the clipping grows with the screen's height
  and its lettering with it (the time's caption 15-21px, was 11px), with
  room kept above it for that caption (on a 768px-tall laptop it ran off
  the top); a phone's unchanged.

- **The pull into the TV is too abrupt** (2026-10-21; user: "Getting
  pulled into the TV against your will, it happens way too abruptly. Way
  too abruptly. We need to come up with something else there. I mean,
  it's fine, but it just happens way too abruptly."). As built: 9 s after
  the blast with the head held on the set (20 s after the last look
  otherwise), den-fx.js startPull yanks the camera into the glass in 1.35
  s (PULL_RUSH 1.15, PULL_ENTER 1.35), no warning. Offered: 1 two warning
  tugs (the view lurches at the set and snaps back, a thump and static,
  the second harder, a thought between), then the third drags you across
  the room and in (recommended); 2 the room goes first (loose things
  pulled in, then you); 3 one long slow drag that gathers speed; 4 the
  same pull slowed to ~4 s. Picked (user): "Combine 1 & 2 for TV pull."
  Built (themes/den-tug.js, den-fx.js startTugs / tugFrame / tugCamera):
  when the pull's due (same PULL_FIXED / PULL_LATE clocks) the build-up
  runs first, 9.5 s, then the rush as before. TUG (ms): 0 the first tug
  (the view lurches 9% of the way to the glass and springs back past
  where it was; a "thump" on the tube; audio tvHaunt "tug"; the papers
  on the coffee table shiver and slide toward the set); 1400 the card
  "Did the TV just… pull me?" (den-tug-think); 4200 the second (17%, a
  900 ms surge), the two score sheets and the Big Glutts circular lift
  off one after another and fly into the glass (a flash on the tube as
  each goes in, den-tv.js kick), the thought cut short; 6400 "Uh-oh…"
  (den-uhoh); 6900 the third, which doesn't let go: the console's sleeve
  (den-room.js buildConsole now places it by its own position and hands
  it out as stereo.sleeve), the newspaper on the pit floor and the
  "Moonlight Lounge" sleeve on the floor by the console go in, the view
  dragged to 42% of the way, catching twice (u 0.36, 0.7), shaking harder
  (the things go by the tug's clock: each wave from when it was due,
  tug.t0 + TUG.tug2 / TUG.drag, each thing off when it was due, not when
  a frame noticed; on a slowed machine the frames' lateness had added up
  and the floor's sleeve, due in at 9200, was still flying at the rush:
  CI shard 1 on 57e5c25, reproduced at 6x CPU throttling, in at 9219
  after)
  (audio "drag": a rising rumble and throb, scrapes; the music dragged
  down, den-audio.js musicGlitch); 9500 startPull(now, { keepHead }), the
  rush taking the camera from there (what's left of the lurch eases off
  as tvW rises; the head's held look kept so the rush starts from it).
  The camera's part runs in cameraOverride after placeCamera (tugAt:
  lurch toward den.tv.dive.target, never nearer than 6 units, the look
  kept, a 6-11 Hz shake mostly in the look). From the first tug nothing
  takes a tap, the set's included (onLock, onLockKey, pressTv), the head
  is yanked to the set if it wasn't on it (a 520 ms glance fix), the
  music stays pulled, the title and dock step aside (ec-tv-visit). The
  loose things exist only while the set lures (created with the room
  when `lure`), are put back if Nova can't go (held 8 s, then let go and
  the lure resumes), and go with the den. Hooks: __DEN_TV__().tug {s,
  lurch, shake, debris}, glassDist; __DEN_PULL_NOW__ starts the build-up;
  __DEN_TUG_SKIP__(ms). tests/e2e-tv-pull.mjs checks each beat. (Its
  first tug is measured against the view's distance from the glass at
  rest, read just before the build-up: CI's slow renderer logged its
  first frame 19 ms in, already lurching, and the 5% and 2.5% checks
  missed by a hair, run 39552534043; the lurch is looked for over 0-400
  ms at 3%, so a frame every 200 ms still sees it.)
  Its last part, smoother (2026-10-22; user: "The last part of the
  pull into the TV still happens too abruptly. I'm not sure what's going
  on there. We need to figure out how to make that a bit smoother.
  Maybe the voice, the shout at the end, at least that needs to have
  some preverb on it."). Recorded first (scratchpad pull/cast.mjs and
  run.sh: a phone page over http, the composited frames with the page's
  own time stamped on them, the camera's distance from the glass and the
  den's output level each frame; sheet.py): the rush started from a
  standstill (the drag's lurch frozen as tvW took over with k^3), a
  second all but still, then a lunge in its last 0.2 s (to 200 units a
  second); Nova's transition opens on black, so the picture was cut to
  black at once; the shout jumped in 25 dB at once; and the den's audio
  context was closed with the den, 0.38 s after the glass, cutting his
  echo dead at -23 dB. Now (den-fx.js, den-tug.js, den-audio.js): the
  rush goes on from the drag at its own speed (tug.v, measured in
  tugCamera) gathering pace evenly to PULL_NEAR 5 at the glass (pullDist:
  tugCamera sets the distance, tvW only turns the view square on,
  smoothstep), 44 to 81 units a second, no stop, no lunge; PULL_RUSH 1.5
  s, PULL_ENTER 1.7 (was 1.15, 1.35); the dark closes in round the set
  from PULL_DARK 1.0 s (den-pull-dark, z 9990, a radial dark from past
  the corners to nothing, the middle dimming too) to all black at the
  glass, so the turn-on opens out of it; his shout comes with the hall's
  preverb (el-cabeza-hall-pre.mp3, 1.7 s of its own room run backwards),
  cued from the drag 1.9 s ahead (cueShout, both from one cue as the
  hall's are; SHOUT_TIMES from den-hall.js) so it lands 0.18 s into the
  rush (from disk, no recordings: none); the set's breath (tvHaunt
  "pull", secs) reaches the glass at 1.7 s; and the den's audio rings on
  after the den's gone (den-audio.js ringOut / dispose: the den's own
  sound faded over 0.25 s, the ear left till the echo's out, then the
  context closed). Measured: the swell from -39 dB 1.7 s ahead up into
  the shout at -14, the echo at -33 dB after the den's gone, silent
  before the context closes (4.2 s). tests/e2e-tv-pull.mjs: speeds (drag
  43, rush 47, 58, 68 a second), the dark (none before 0.95 s, all black
  when Nova's transition comes), the dark layer gone after; over http
  the preverb cued 1.900 s ahead from the drag, the shout due just into
  the rush, the den's context closed after his echo's end.
  The user, after: "The pull feels much smoother now." (2026-10-22).
  Where its streaks meet (2026-10-23; user: "The white lines that
  radiate outward as you're getting pulled into the TV, I'm not sure if
  those are supposed to indicate, I mean, what are those pointing to?
  Because I'm not sure, it's like kind of off screen. Is it supposed to
  be the screen itself, like showing those lines, like focusing there?
  What's up with those lines? Because something seems off there."). They
  are light pouring into the set's glass and were meant to meet on it.
  But the point was taken in placeCamera before the camera was placed
  for the frame: the chassis's lookAt had left the camera's matrices at
  the board camera's position with the last frame's turn. So the lines
  met where the set stood from over the table: on a 450 x 1000 phone at
  x 479, past the right edge, the glass at 217, still 120 px off it at
  the glass (on 1100 x 800 about 250 px right of the glass; 412 x 915,
  x 438 against 163); the dark closing in round that point too. Its aim was also
  den.tv.focus.target (the framing point, 3 left of the screen's middle),
  and the stretch's origin was read off the stretched box (origin = the
  point x the last frame's scale, 32% low by the end). Now pullFrame
  does the rush and the lens only, and pullDraw (in cameraOverride,
  after tugCamera) takes the glass's middle (dive.x, dive.y on
  focus.front) through the placed camera, as a fraction of the picture.
  pullStretch stretches about that, measured on the unstretched box (its
  box less the last frame's stretch), so the glass stays put and the
  streaks and the dark meet on it: 1-4 px from its middle all the way in
  on the phone and on 1100 x 800 (scratchpad pull-lines/probe.mjs, with
  the glass outlined over the frames). tests/e2e-tv-pull.mjs (aimLog,
  aimCheck): the streaks meet inside the glass's box, within 15% of its
  size from its middle, through the rush, in the 1100 x 800 pass and the
  412 x 915 phone pass (on the old code both fail, 1.86 and 1.83 of the
  glass's size off; on the fix 0.01).

- **The check alert stops for the phone** (2026-10-21; user, a phone
  screenshot of the den after the trip, the CHECK / SHOW AGAIN chip
  circled: "showed up both, like right before I left to go get the pieces
  from the abandoned Big Gluts store, and then also when it came back, it
  was still there. If this happens during a game, before the phone
  rings, it needs to be stopped or turned off"). den-call.js sends
  `el-cabeza:check-quiet` as the phone starts ringing and again as it's
  answered; the chassis (checkQuiet) puts the alert standing then away
  for good, card and marks and chip (it's dismissed, and the chip isn't
  offered for that threat); another threat, or the next turn's, is news
  again; not while the turn's held (its card is the way on). Through the
  call and its "Free pieces?!" card the page is flagged html.ec-den-call,
  which hides any check card or chip (one could come up if the computer
  moved meanwhile); the trip hides its own as before. Tests:
  e2e-check-alert (the chip goes and nothing comes back for that threat;
  with the card up, the card goes and no chip; the threat gone and back,
  the card again).

- **The zoom-out glass is held off through the phone call** (2026-10-21;
  user: "Hitting the zoom out button when on the phone causes you to
  keep hanging on to the receiver, but you're floating up. It doesn't
  make sense. That button should be unable to be clicked during the phone
  sequence"). Why it floated: the held receiver is posed at the ear of
  the room's own camera (den-call.js earPose reads t.camera before the
  den's visit takes it over), so the Room view took it up over the room
  with you; seen from the phone, its cord ran up into the sky; let go of
  the phone, you were up there holding it. Now den-call.js holds the Room
  view off (`el-cabeza:room-view-lock`, { on, why, down }) from the first
  ring till the receiver's back on the cradle (stage done), or it gives up
  ringing, or the den goes. The chassis (roomLock) greys the corner glass
  (disabled; the den ghosts it at 0.32 as for the commercial, standard.js
  `button[...]:disabled`), the dock's Room view and the phone menu's row
  ("Not while you're on the phone" in their titles / detail), and
  roomView() does nothing. Going over to the phone (the slip) or picking
  it up while up in the Room view sends { down }: the camera comes back
  down to the board (recenterView), so the receiver lifts to you there,
  never over the room. Test hook: window.__EC_TEST_DEN_CALL__ before the
  page loads makes the den's first mount the special-order homecoming
  (the call to come) without the story's way there. Tests:
  e2e-den-phone (the glass and dock dead from the first ring; on the
  phone a click on it leaves the camera in the room, the receiver where
  it was; a tap away, the board with the receiver at your ear; hung up,
  the glass works; Room view first, then the slip or a pick-up: down to
  the board; the phone bar's menu row greyed, saying why). (The tap away
  mid-call no longer leaves the phone: next note.)
- **On the line, the camera stays with the phone** (2026-10-23; user, a
  phone screenshot mid-call, "YOU: Okay. I'll be there." under the board
  with the Opa's card up: "During the phone call, I'm not sure where I
  touched, but I was able to get back to the table in the conversation
  pit. That probably shouldn't happen."). Why: den-fx.js onPhoneDown took
  any tap on the room away from the phone as "back to the board"
  (phoneVisit(false)), ringing or on the line, and Escape the same; back
  at the table, the next tap picked a piece. Now, on the line (den-call
  onLine(): stage "call", picked up till the receiver's on the cradle), a
  tap on the room is swallowed (nothing picked, the view kept) and Escape
  doesn't leave; while it rings, a tap away or Escape still goes back
  (you needn't answer). Picked up from elsewhere (the Room view, say),
  answer() takes the camera over to the phone too (onGoToPhone), so the
  whole call is seen from there; hung up, it comes back to the board as
  before. The receiver is posed after the den places the camera (den-call
  pose(), called from den-fx cameraOverride, as the bell's direction now
  is too): at the ear of the camera you see through, so at the phone it
  comes up to you there, low and to the right (posed in tick, it had gone
  to the room camera's ear, ~77 units off, out of frame from the phone,
  its cord trailing across the room). (The swallowed presses are kept by
  pointer id, a Set, so a two-finger press is let go of whole;
  pointercancel clears them.) Tests:
  e2e-den-phone (on the line a click away and Escape: still at the
  phone, the receiver at your ear, no piece card; hung up, back to the
  board; picked up from the Room view: down and over to the phone).
- **The receiver the right way up** (2026-10-27; user: "When the phone
  is picked up in the den, make sure that the cord is always on the
  bottom when it's picked up and brought to the ear. Right now it seems
  like it's when the phone receiver is being picked up, the cord is on
  the top, which would be upside down."). The handset (den-room.js) runs
  along its z, the cord and mouthpiece at +z; den-call.js earPose had
  that end up at the ear (+0.83 of straight up, measured over every
  camera angle), and the plain slerp from the cradle swung it over the
  top on the way. Now the ear pose has a half turn about the handset's
  own up (mouthpiece low, the caps' open faces still to your head), and
  the lift and the hang-up go by liftTurn: the earpiece end rising
  steadily from level to its height at your ear, its heading turned the
  short way, its roll about its length eased in, so the cord's end is
  never above the middle (scratch check over 720 camera angles: highest
  0.00 on the way, -0.42 at worst at the ear). Test: e2e-den-phone samples
  the cord end every frame from the tap till it's back on the cradle (245
  frames: highest 0, -0.87 at the ear).
- **New Game with the hall on its way goes straight on** (2026-10-27;
  user: "I'm currently in the den, waiting to be dragged into the
  hallway. While playing, I got the first alert of a problem in the
  hallway. But then, after that first alert, I finished the game, I
  lost, and then I hit new game. It set the board back up again, but the
  3D floating piece is there, and there's no way to start the game. It
  should, the 3D floating piece, when you hit new game in this instance,
  the 3D floating piece should immediately minimize and the game should
  be active. I selected retain the settings too, so there's an issue
  here. Look into it."). New Game (Retain too) went back to the setup,
  the dock piece big in the middle, waiting on Begin; the den's
  game had begun by the bulb (the settle-in), so there was no Begin to
  remember. (Replayed here, order form game, first alert, kept playing,
  lost, Retain, with and without the bulb's focus: a tap on the piece
  did open the panel and its Begin Game.) Now (chassis beginNextRef,
  06-dock-piece-preview.md): Retain Current Game Settings, in every
  world, and any New Game where the world's ambient says
  `newGameBegins()` (den-fx: the hall armed or settling, i.e. on its
  way) begin the next game a frame after its board's set up, as Begin
  would; the dock piece stays in its corner and the title small; the
  hall's count carries on. Tests: e2e-hall-after-game (scenario 2's New
  Game now begins at once; scenario 3, the user's: from the order form,
  the first alert, kept playing, the game over, New Game, Retain: under
  way with no Begin, the dock piece in its corner every frame, the
  title small, the hall waiting and counting a turn in it).
- **The title's hold, a press only** (2026-10-23; user, with a desktop
  screenshot of the den after the commercial, the special-order note up
  and CONNECT over it: "Right after the TV commercial plays, I was brought
  back to the conversation pit table correctly, with the blue ring being
  correct, etc. However, when I hovered the mouse over the masthead it
  triggered the old bridge to Futuris. The order form prompt had opened,
  but the CONNECT button also opened, so basically couldn't click on
  anything."). The hold zone over the title (apps/unifiedTransition.jsx
  MastheadHoldZone, in the den once the Singularity's been visited) began
  on the mouse entering it, so a mouse resting on the title for 4 s
  brought CONNECT up; the note's lock (tienda-overlay.js) stops every
  press but its own at the window, so neither CONNECT nor the note could
  be pressed, nor Escape. Now only a press begins it (the mouse's main
  button or a finger); hovering does nothing, and while the note holds
  the screen a press is stopped before it reaches the zone. (A quick click
  on the title now always passes through to the title, where after a
  rest over it it hadn't.) Tests: e2e-story (the note up: resting on the
  title, then a press held, no CONNECT), e2e-original (resting brings no
  CONNECT; a press held still does).
  Then CI's e2e-original (af606c8, shard 6): the press held 4.4 s brought
  no CONNECT. The hold completed only when its 4 s timer ran, and a busy
  page runs it late: on a loaded machine (three of four cores busy, here)
  0.8 s late, the release handled first, the hold cancelled (2 runs of 2);
  the mouse's arrival had started it a beat before the press, which had
  hidden the race. Now the hold is timed by the press's and the
  release's own event times (MastheadHoldZone stamp(): event.timeStamp,
  on performance.now()'s clock): let go after 4 s, it's held, timer or
  not, as a slow Chromebook needs too.
