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
  the board; the phone bar's menu row greyed, saying why).
