## Tienda (built): a 1975 department store round the board

User brief: re-theme the whole game as suburban America, 1974-75 (a
discount department store, earth tones, fluorescent light, Muzak, a
faintly liminal quiet but never horror; no disco, no parody; CRT only on
real screens), and make it right on every phone, tablet, laptop and
desktop. Built as its own theme and page (dist/el-cabeza-tienda.html);
Nova and the other themes are untouched. The user's two posters are the
box art and an ad standee (assets/tienda/*.jpg).

- **Files.** themes/tienda.js (palette PERIOD/COLORS, board and
  lacquered wood pieces with procedural grain that follows a roll
  (grainTurns), gold move frames, the whole UI restyled as printed paper
  via styleSheet), tienda-store.js (the store: baked vertex-colour
  lighting on unlit materials, geometry merged by material, instanced
  troffers/goods; the display table sized to the board), tienda-fx.js
  (attaches store+table to boardGroup so turning the board is walking
  round the table; fog; the frame-rate governor; the flickering tube),
  tienda-textures.js (every sign, box, card and floor painted on
  canvases), tienda-overlay.js (the box lid on load, the catalog ORDER
  FORM = custom rules), tienda-audio.js, tienda-quality.js,
  themes/rules-selections.js + engine/anomaly.js (the custom-rules model
  shared with Lluvia).
- **Chassis hooks added for it.** `theme.viewPitch` (camera pitch; the
  store must show behind the table), `theme.rulesColors` (overrides for
  the rules sheet's text: Tienda's harvest gold is too light on cream),
  `movelog-sheet` / `victory-placard` test ids. On narrow phones the
  pre-game dock piece narrows (`min(260px, 100vw - 184px)`) so it no
  longer covers How to play (was untappable at 390px wide, all themes).
- **Device fit.** tienda-quality.js picks low/mid/high once (coarse
  pointer, cores, memory, GPU name, texture limit; software renderers
  like SwiftShader/llvmpipe are low; `?quality=` forces one). The tier
  sets the pixel-ratio cap, shadow and texture sizes, clearcoat, store
  detail and the TV wall. The governor in tienda-fx.js lowers the pixel
  ratio when frames run slow and raises it within the cap when they
  don't. Page is edge to edge (viewport-fit=cover) with safe-area
  margins. Built minified.
- **Sound.** Store ambience (ballast hum, air, far-off carts, register,
  PA chime and a voice you can't make out), wood/brass/paper SFX, and
  the ceiling-speaker music. The music alternates between:
  (1) **the tape**, the user's upload "Mall Music Muzak - Mall of 1974 -
  03 Third Floor Spending Spree" (Internet Archive item
  MallMusicMuzakMallOf1974), converted to mono 22 kHz 40 kbps MP3
  (assets/tienda/muzak-1974.mp3). The user asked for "that backrooms
  sound": it plays at 0.94 speed (a semitone flat) with tape wow,
  lowpassed at 3.1 kHz, through the speaker chain with an extra send to
  the long hall reverb. It's a file BESIDE the page
  (dist/el-cabeza-tienda-muzak.mp3, copied by build.js `files`), not
  inlined: inlining doubled the page to 2.2 MB. Prefetched 2.5 s after
  load (not on save-data), decoded at the first store start; picks up
  where it stopped after a game. Opened as a lone file (file://) the
  fetch fails and only the arrangements play.
  (2) **written arrangements**, composed live (compose(): 4 tunes, 7
  keys). A wide chord with no voicing in range used to return null and
  throw about one start in seven (silencing the music); fixed, and
  tests/tienda-music.smoke.mjs now covers every key × 60 seeds.
  Test flags: `__TIENDA_MUSIC_ONLY__ = "tape" | "arrangements" | "none"`,
  `__TIENDA_AUDIO__()` (with `__EC_TEST_HOOKS__`). Levels were matched by
  recording the master output: tape -25 dB, arrangements -24.7 dB,
  ambience alone -39.5 dB.
- **Tests.** tests/e2e-tienda.mjs serves dist/ over HTTP (like Pages):
  ten screens 320×568 to 1920×1080 (lid fits and opens, store and tier,
  sound starts on the tap, masthead on screen, How to play reachable, no
  sideways scroll), the order form and a custom 12×12 game on a phone and
  a laptop, a game to a win (points tag, placard, register-tape Move Log,
  tape stops in place, New Game keeps one store), and the page alone
  without its tape. The software renderer here is slow: clicks can take
  20 s, so the test gives actions 30 s. Audio clicks heard in headless
  recordings are the sandbox starving the audio thread while it renders
  the store on the CPU (they fall on 128-sample block edges and vanish
  with a tiny window), not the code.
- **Rules leaflet = a 1975 newspaper circular (user request: "printed on a
  newspaper advertisement flyer from that era. Creases, micro tears").**
  All CSS in tienda.js styleSheet over the chassis's info-overlay card,
  plus `ensureNewsprint()` (tienda-textures.js: a seamless canvas tile of
  groundwood newsprint: yellowed grey-cream, cloudy formation, fibres,
  dark shives) as `--tienda-newsprint`. Grounded in how the paper aged
  (lignin left in groundwood oxidises: yellow, edges browner and brittle)
  and how circulars were printed (soft black + one spot red, screened
  halftone tints, plates slightly off register). Details: browned edges
  (inset shadows) and two foxing blotches; a letter fold (creases at a
  third and two thirds, one valley one ridge) then in half, drawn by
  `::after` over the text (ink lighter on the ridges) with worn spots
  where folds cross; a torn outline from `tornEdge()` = clip-path
  polygon in `calc(% + px)` so damage is the same size on any screen:
  flaked edges, tears where each fold meets the edge, a chipped corner;
  the back page's ad mirrored and faint in `::before` (show-through); a
  red masthead band with reversed-out type and a halftone fade (three
  rows of shrinking dots); the name in heavy Franklin with an off-register
  red drop; an Oxford rule; red bold side heads (`rulesColors`). No outer
  shadow (clip-path would cut it); the dimmed store separates it.
- **Smoke test and opening screens.** tests/e2e-smoke.mjs now passes
  through a theme's own opening first (Lluvia: Straight to the board;
  Tienda: Open the box). Lluvia's smoke had failed since the descent
  opening landed (04ca297): its dock click hit DESCEND.
- **Tape on file://.** The page doesn't try to fetch the tape when opened
  straight from disk (the browser refuses and logs an error); it plays
  the arrangements.
- **Custom board size in the order form (user: "customize the board size,
  not just three presets").** The rules model (themes/rules-selections.js,
  shared with Lluvia) now holds `rows` and `cols` (6–20 each, `clampDim`),
  not one `size`; Lluvia's square buttons set both. Tienda's Board section:
  a live diagram (squares to scale, home rows shaded), Width (squares
  across a home row) and Length steppers, and square quick picks
  8/10/12/16/20 (`tienda-size-N`). Summary reads width × length.
  - **Fit.** Each side starts in its two home rows, so the width limits
    the order. `packHomeBand(roster, cols)` (engine/anomaly.js) is an exact
    backtracking packer (largest first, identical pieces in order, area
    cut-off; instant). The form uses `piecesFit`/`minColsFor`: if the
    pieces won't fit it says so, disables Place order, and offers "Make
    it N wide". generateAnomalySetup also packs deterministically before
    its old fallback: the random placer alone used to swap some tight
    orders for the classic five (e.g. 2 Opas, 2 Rayos, an Arco, a Flaco,
    a Turrito and the Cabeza, 10 wide: 3 times in 10). Test:
    tests/rules-selections.smoke.mjs.
  - **Board texture on resize (a bug the presets already had).** Tienda
    paints its squares into the board texture, and the chassis resize
    rebuilt the plate but reused the material, so an 8×8/12×12/custom
    board showed 10×10 squares stretched. New opt-in chassis hook
    `theme.boardTextureFollowsSize`: resizeBoardPlate repaints the texture
    and rebuilds the slab materials (disposing the old maps it no longer
    uses). Other themes draw squares as a grid (already rebuilt), so they
    don't opt in. e2e-tienda checks plate and paint proportions match.
- **Sample the wares: 3-D wood pieces in the order form (user request,
  like Futuris's MATTER viewer).** themes/tienda-showcase.js, on the pattern
  of piece-showcase.js (POSES now exported from there): catalog-photo
  stills of each piece in walnut (one short-lived WebGL context for all),
  a "3-D" tag; tapping one (`tienda-view-KEY`) raises the live model out
  of the photo (`tienda-piece-viewer`), turning slowly, drag to turn,
  Walnut / Olive ash buttons, catalog number, price and note; tap outside
  or Escape puts it back into the photo (whose spot shows dashed while
  it's out). The wood is the board's own: `woodMaterial` (now exported
  from tienda.js), the store's light strengths (`lights`) and the
  chassis's renderer settings (ACES, 1.15), so walnut matches the table
  (brighter studio lights had made it orange). Test hook
  `window.__TIENDA_PIECE_VIEWER__` (yaw, wood).

- **The opening's slow pan (2026-10-20; user: "When tienda opens on
  first / new game the store should be slowly panning from left to right
  120°", a soft bounce at each end, stopped by the player's hand, back to
  panning "after about 10 seconds").** tienda-fx.js PAN_*: the camera, at
  the opening framing, goes round the table 60° either side of
  OPENING_VIEW, rightward first, about 40 s for the 120°; past an end a
  soft spring turns it back. It turns through the lid. A press on the
  scene, a drag, a pinch, the wheel, a view button or anything open over
  the store stops it; ten seconds after the last, it glides back onto
  its arc and goes on (the card's glow still cues at 6 s). Before the
  first game only; not with reduced motion, nor under the tests unless
  asked (__EC_TEST_PAN__). tests/e2e-store-pan.mjs.
- **The cart and the standee changed places (2026-10-20; user: "In
  Tienda / store theme, swap the locations of the silver shopping cart
  and the El Cabeza advertising standee").** tienda-store.js: the
  standee (its stand and its NOW IN STOCK card follow it) now stands at
  (36, 24), turned to face the table (atan2(-36, -24)), where the cart
  was; the cart is at (-34, -30), turned half round (π − 0.7) so it sits
  to the table as it did. From the opening framing the standee is at
  the back on the left; the cart is by the camera's right, so at the far
  right end of the opening pan (+60°) its basket is in the foreground at
  the bottom left (the standee stood there before). standeeAside (the
  fade when the camera's in it or close behind it) keys off the
  standee's own place, so it moved with it. Same in the store after the
  story (the housewares ad).
- **The Try it! card's glow without the line (2026-10-20; user: "The
  card glow on the table has ... a distinct line as it pans ... the glow
  is not correct", a phone screenshot circling the card's right side).**
  Two faults, found in close-ups round the card (the camera's target on
  a leaf, radius 16, every 20 degrees from -60 to 60):
  the haze, a sprite facing the camera from the tent's middle, cut
  through the near leaf, so the part of the card behind its plane was
  washed blue and the rest not, the line moving across the card as the
  view turned; and each rim was a solid, hard-edged leaf of light just
  inside the tent, seen as a flat blue fill through the open ends and a
  sharp sliver at the edges. tienda-store.js now: while it glows
  (setGlow, k > 0.002) the leaves, fronts and backs, go transparent
  (opacity 1, still writing depth) with renderOrder 4, the haze at 3
  before them, the rims and the pool at 5 after; so the haze is behind
  the card wherever the card is. The rim texture is worked out per pixel
  (256x206): brightest at the leaf's edge, falling away outside it, gone
  0.14 in from it (nothing inside), gone at its own edges and fading out
  toward the table. The haze fades out a little below its middle (the
  table cuts it at 0.53 of its half-height seen from level, lower from
  above). Looked at from -60 to 60 degrees close up, and through the pan
  on a desktop and a phone.
- **The order form's stamp, seen (2026-10-20; user: "it is frequently
  over dark areas where you simply cannot see the stamp. There has to be
  a way to make the stamp more visible and maybe have it stick just maybe
  half a second longer").** tienda-overlay.js .td-filled-stamp: no longer
  multiplied into the form (mix-blend-mode multiply, faded red, a 0.2
  paper wash, so over the piece photographs and the dark section bars it
  vanished); full red (#A33F33) on a slip of the form's paper (0.97),
  a soft paper margin and a drop shadow to lift it, larger (clamp(26px,
  7vw, 52px)), each line kept whole (nowrap; the box may use 94% of the
  form, not the half an absolutely placed box gets, so "Take to store"
  isn't broken over three lines on a phone). Up half a second longer:
  tdFormAway at 2.6 s (was 2.1), onPlace at 3.2 s (was 2.7; 1.4 s with
  reduced motion, was 0.9). Same for the store's "Order filled" and the
  special order's "Take to store".
- **"Crush opponent's Cabeza" (2026-10-20; user, a screenshot of the
  tour's card 2 of 8: "Red circle on top indicates that the word should
  be changed to "opponent's". The lower red circle shows where it should
  read, " Crush opponent's Cabeza"").** chassis/FirstGameTour.jsx ways:
  "2. Crush opponent's Cabeza with one of your blocks."; the board's tag
  (ElCabeza3D.jsx way-2): "2 · Crush opponent's Cabeza". The other
  lines keep the side's name ("to Walnut's back row", the crush card's
  own title "2. Crush Walnut's Cabeza."): only the circled two changed.

- **The PA's cards swipe away** (2026-10-20; user: "You should be able to
  swipe dismiss these after about 3 seconds"): tienda-shopping.js
  useSwipeAway, from 3 s up (SWIPE_AFTER_MS; __EC_TEST_PA_SWIPE_MS__):
  left, right or up, past 28% of the width or 28 px up or flicked, off it
  goes; sooner it gives 15% and springs back; a drag never taps (the
  mouse's click at the end swallowed). `translate` for the offset, the
  entrance's fill `backwards` (its held end frame had hidden the fade).
- **The walkthrough's words** (2026-10-20): the Cabeza "can step up to two
  squares a turn, in any direction, even diagonally" (user: "one square at
  a time" read as one a turn); "your opponent" after the welcome names
  Walnut once (user: "This should say your opponent ... not walnut");
  board labels "Opponent's ...". The welcome card keeps Walnut's name
  ("Your opponent, the computer, plays Walnut"; asked, the user: "This
  can be left as-is").
- **The opponent's first move, watched** (2026-10-20; user: "The camera
  should slowly pan in to watch the opponent's piece move"): the tour's
  foe step glides in (1.8 s) on the planned piece and its path, the move
  starting 2 s in, steps 0.9 s apart; then from-and-to framed under the
  "moved" card (ElCabeza3D.jsx frameTourBoxes, TOUR_FOE_*). The PA holds
  its words while the walkthrough's up (html.ec-tour-up).
- **Asked to leave three moves after the walkthrough** (2026-10-20; user:
  "The user will be encouraged to purchase the game and leave the store 3
  moves after they have started playing once the tutorial has been
  completed, because it seems like they're just kind of stuck in a low
  light situation with no game momentum"): tienda-shopping.js counts the
  player's own turns once the walkthrough's over (movesSinceTour, across
  the visit's games); in stock after the first, closing time (the lights
  down) after the second, Big Glutts' notice after the third ("The store
  is now closing."), each once the computer's answered and the card
  before it is down. The clock's timings stay for a player who doesn't
  play.
- **Just a minute, then back** (2026-10-20; user: "Yes, have.Just a
  minute bring it back after a few moves."): Big Glutts' notice put off
  (Just a minute or Escape) comes back three of the player's moves later
  (MOVES.again, PA.back), "The store is now closed.", and again after
  each Just a minute; with no moves it stays away.
- **Two fingers on the board card** (2026-10-20; user: "a good place to
  also mention the two-finger panning, up, down, left, right ... I want
  to be super concise"): card 7 of 8 now reads "Drag one finger to turn
  it all the way around, two to move it up, down or sideways. Pinch to
  zoom in or out." (a mouse: "right-drag to move it"; the chassis pans
  on a right-drag or Alt-drag). The board's label below stays "Drag to
  turn · pinch to zoom" (a third item won't fit a phone).
- **‹ Back on the walkthrough** (2026-10-20; user: "small back button on
  the tutorial if somebody goes forward and then they want to revisit a
  step earlier. Wanted to be subtle though, but still within theme"):
  from card 2, a quiet "‹ BACK" just left of Next (tienda.js: the red
  button's Franklin caps, muted ink, no box); on your first turn (8 of 8)
  it goes back to card 7 until a piece has moved. The crush close-up and
  the camera follow the step, so going back works as going on does.
- **The Room view button is a zoom-out glass** (2026-10-21; user, of six
  drawn: "Go with option 4, Zoom out"): the chassis's room-view-corner
  (every world with the Room view: the store and the den) draws a
  magnifier with a minus, not the house ("It kind of makes people think,
  go home"); title "Zoom out: up over the whole room". And card 4 (the
  crush) lost "Here it is, up close." (user: "It's unnecessary").
- **Card 6 in the user's words** (2026-10-21; user, with the turn
  card's first two sentences circled: "Each turn, select a piece to roll
  on its edge either once or twice. <i>Note</i>: the Opa (large cube)
  only rolls on its edge once due to its large size."): so it reads in
  the standard game (two actions for one piece), the Note on its own
  line with "Note" in italics where there's an Opa. Other setups (more
  actions, shared pieces) keep "Each turn you get N actions...".
- **Card 3 shows the Cabeza big first** (2026-10-21; user, a phone
  screenshot of "1. Get your Cabeza across.": "start it with an enlarged
  image of it and then have it zoom down back into where it belongs on
  the board to kind of really emphasize to them what it is that they're
  looking at"): as the card comes up, a copy of your Cabeza's own meshes
  (the crush card's way: the same materials, nothing compiled) grows in
  big in the middle of the room the card leaves (0.42 of its width, 0.36
  of its height, at most 260 px; a little over halfway from the camera to
  its square), tipped back 0.5 rad to show its rim and rocking slowly,
  "YOUR CABEZA" under it (the label follows it: tag at { intro }); held
  till 2.4 s, then down it comes over 1.15 s (eased both ways), shrinking
  and laying flat into its yellow ring, its shadow from 60% of the way,
  a little hop as it lands (0.3 s); the real one, hidden till then, takes
  over and only then is the arrow to the green row drawn. Each time the
  card comes up (Back too); not with reduced motion; Next mid-way puts it
  away (the real one shown). chassis tourCabIntro / tourCabRef /
  tourCabObjRef; hooks: __EC_TEST_TOUR__().cabIntro { phase in|hold|down|
  settle, px, x, y, realPx, realX, realY }, __EC_TEST_TOUR_CAB_SLOW__ to
  slow it for a look. Phone 163 px across against 30 on the board;
  desktop 229 against 56. tests/e2e-first-game-tour.mjs checks it.
- **No label over what it names** (2026-10-21; user, a phone screenshot
  of card 4 with OPPONENT'S CABEZA over the copied Cabeza: "Opponent's
  cabeza flag is obscuring the actual piece a little bit too much.
  Perhaps it needs to be moved down off it to the right a little bit"):
  the label is set to the piece's right, but on a phone it's too long
  for the room there, and the screen's edge pushed it back over the
  piece. TourMarks (chassis/FirstGameTour.jsx offOwn) now ends each
  round of its layout by moving a label that covers its own anchor to
  just below it (or above, with no room below; where it is with room for
  neither), where the edge let it be: so OPPONENT'S CABEZA sits under
  the piece and to its right, its arrow up to it. Every card's labels
  get the rule. A test build marks each label with data-anchor (what it
  names, on the screen); tests/e2e-first-game-tour.mjs checks no label
  covers its own on any card, and that this one's to the right.
- **The menu, after the first exchange** (2026-10-21; user, two phone
  screenshots, the in-game menu's foot icons circled and the corner piece
  circled: "An addendum to the tutorial should be about the UI or user
  interface. For example, the lower right hand corner has the 3D spinning
  piece. Maybe there should be a page or two in the tutorial explaining
  like what that's for, when it opens up, what the buttons inside of it
  do, that sort of thing"): the other side's card now ends "Before your
  next move, a quick look at your menu." with Next (was Got it), and three
  cards follow (FirstGameTour.jsx TOUR_MENU, banded "Your menu · N of 3"):
  1. "Your menu is in the corner." The piece ringed (its corner box less
     26 px all round: the box runs past the screen's edges, the piece in
     its middle) and labelled TAP TO OPEN YOUR MENU, calling as it does
     after a game (the chassis's dockCall, dockCallTour: lit, its light
     round it, a hop now and then). "The spinning piece at the lower right
     opens it: the menu you started this game from. Tap it now." / "Tap
     anywhere outside the menu to put it away again." / "When a game ends,
     the piece glows like this until you open it: your next game starts
     from there." Open it (or a tap on the piece) opens it, bounce and all.
  2. "Inside your menu." The menu stays open under the card; rows in the
     menu's own words: Undo turn, Views (the world's words: Your side,
     From above, and The aisle), Check alert, Hold to end ("On: hold the
     piece you moved to end your turn, so a stray tap can't."), Put them
     down (dockWords.endGame). Lit one at a time, round and round, 2.6 s
     each: a ring round the control on the menu and its line's label on
     the card in the rings' yellow, together (both start as the card comes
     up; TURN_S, turnFrames). All at once, five rings ran into each other:
     the controls sit about 8 px apart.
  3. "The buttons along the bottom." Each of the menu's foot buttons
     drawn on the card as the menu draws it (FOOT_ICONS) with what it does
     (Control bar where offered, Piece guide, Move costs where the world
     has them, Actions left, Sound), each ringed on the menu in turn as
     its glyph on the card lights, and "That's the tour. Your turn: tap
     any of your pieces to see what it does. Good luck!"; Got it puts the
     menu away and ends it. With reduced motion, every ring at once.
  The cards keep with the menu: a tap outside it puts it away and brings
  back card 1; Back from card 2 closes it; from card 1, back to the other
  side's card. The board picks nothing while they're up (tourCardUp), and
  the camera stays where the other side's move left it. In the control
  bar layout (no corner piece) there are none (the other side's card says
  Got it as before; switching to the bar mid-way ends the tour). A piece
  picked on the other side's card still ends the tour, these skipped.
  Chassis: tourMenuRows / tourMenuFoot say what's lit, in order, for the
  rings and the card both; tourShown allows the menu open on "panel" and
  "foot"; a tap on the tour's card doesn't put the menu away; geo.rect({
  el, inset }); data-testid="undo-turn"; data-dock-foot on the foot's
  buttons. tests/e2e-first-game-tour.mjs (phone: each card, every ring
  round its control, a full round lit one at a time with the matching
  line, a tap outside, Back, Open it, Got it; desktop: a mouse's words,
  the card beside the open menu); e2e-store-nudge walks the new cards.
- **The control bar from the menu's cards, shown for now** (2026-10-21;
  user, a screenshot of the classic dock open and the tour gone:
  "Selecting the non-classic doc when in the new menu tutorial, it got rid
  of the tutorial. And I don't know, that seems like there should be a way
  back, or just to have it show it temporarily while you're doing the
  tutorial"): the menu's Control bar (layout-toggle) pressed on one of the
  menu's cards no longer ends the tour (it did: the cards had nothing to
  point at in the bar). The bar comes up for now, not kept (apps/unified.jsx
  onLayoutChange(v, { preview }) skips localStorage el-cabeza:nova-layout),
  with a card of its own (FirstGameTour.jsx TOUR_BAR, banded "Your menu"):
  "The control bar." / "Your menu, laid out another way: your turn in a bar
  along the foot of the screen, everything else behind ☰ at the top
  right." / "To have the spinning piece back any time: ☰, then Use the
  classic dock."; the bar ringed (inset 8, it's the screen's width), ☰
  ringed and labelled THE REST OF THE MENU, the card kept below ☰ (its
  clear list). "‹ Back to the tour" (the classic dock again, still not
  kept) or the bar's own ☰ > Use the classic dock brings the menu back
  open on the card it was on (tourBarFromRef); "Keep it, end the tour"
  ends it with the bar kept as the layout. tests/e2e-first-game-tour.mjs:
  both ways back on a phone, the layout key untouched; Keep it on a
  desktop, the key "bar".
- **Oxford commas** (2026-10-21; user, card 7 with a blue comma after
  "down": "The red circle with the blue comma indicates where an Oxford
  comma should be placed."): "up, down, or sideways", and every list the
  walkthrough makes of three or more ("The Turrito, the Flaco, the
  Chato, and the Opa"); two stay "X and Y".
- **The lights' thought** (2026-10-21; user: "When the lights get turned
  down while you're at the store, when you're first playing the game for
  a new user or new player, maybe a thought bubble should come up saying,
  "Oh, I get turning down the lights. I guess they want us out of here.
  Something like that. Give me some possible options."): at the closing
  words (the first dim), 1.8 s on, one of the story's cards (den-cards.js
  dealCard, as the den's thoughts) just under the PA's caption: "Huh, the
  lights are going down. Guess it's closing time." (of six wordings
  offered, the user: "5."; first built with their own line, "Oh… they're
  turning down the lights. I guess they want us out of here."), 5.2 s,
  then gone; put away with the
  store or under Big Glutts' notice. Once a player
  (localStorage el-cabeza:lights-thought). tienda-shopping.js
  LIGHTS_THOUGHT / lightsThought.
- **Just a minute, once** (2026-10-21; user: "You should not be allowed
  to hit just a minute a second time."): PA.waited, once a visit; when the
  notice comes back ("The store is now closed.") it has no Just a minute
  and Escape doesn't put it away: the register's the only way out.
- **The notice half a minute sooner** (2026-10-21; user: "Have the last
  we are closing pop-up, the big one, show up about 30 seconds
  sooner."): by the clock, Big Glutts' notice comes 8.5 minutes after the
  ten-minute words (30 s after "two minutes until closing"), not 9
  (NOTICE_EARLY = 0.5 of a minute, so a test's shortened minute scales
  it). Its heading still says "The store closes in one minute." The
  moves' way (the third move after the walkthrough) is as it was.
  e2e-store-nudge times it against the minute between three and two
  (0.25 to 0.8 of one; it was a whole one).
- **Recorded PA candidates** (2026-10-21; user: "See if you can find any
  other audio online for store announcements."): seventeen Freesound
  recordings (CC0 / CC BY only; three NC ones left out) on a listening
  page, https://claude.ai/artifact/PSwYauL9AJTy1sKN76WbAy, each heard as
  recorded or through the store's own PA path (the farBus chain, as
  tienda-audio.js builds it), chimes optionally leading into the game's
  mumbled voice. Picks on paper (not heard): YleArkisto's Helsinki Airport
  ding-dong, taped 4 March 1971 (#347217, CC BY 4.0, needs a credit);
  nigelcoop's store chimes, one before and one after (#238428, CC0);
  aprilariesman's "clean up on aisle 13" (#509394, CC0) for far-off
  announcements. The rule offered: a recorded chime can replace the bells
  everywhere, but under the cards (playPage: the page to Aisle 9, the
  countdown) keep the made-up voice, since a real one says other words;
  real voices only for the cardless far-off ones (paAnnouncement from
  scheduleEvent, the end-of-game closing). Nothing in the game changed
  yet. Freesound previews: cdn.freesound.org/previews/<id/1000>/<id>_<user
  id>-hq.mp3, reachable only through the web-fetch agent (this machine
  gets 403); Pixabay, Wikimedia Commons and the Internet Archive weren't
  reachable.
- **The mural over the way out** (2026-10-21; user: "Instead of 'Thank
  you - Please Come Again' There should be a Big Glutts themed in-store
  exit mural on the wall 'Thank you for shopping at Big Glutts!'"): the
  front wall's THANK YOU — PLEASE COME AGAIN sign (an atlas sign) is gone;
  painted on the front wall's own texture instead (tienda-textures.js
  exitMural, called from tienda-store.js frontWall extras): the four
  stripes (brown outside, mustard in) coming up from each EXIT sign (x ±70)
  and over the top just under the ceiling, rounded corners, on a cream
  field; "Thank you for shopping at" in Libre Franklin 800 italic, rust;
  "Big Glutts!" in Caprasimo (the logo's face), brown with the gold
  shadow. Caprasimo is in the store's @import (tienda.js styleSheet) and
  FONT_FACES (tienda-fx.js); since the theme's @import can land after the
  first asking, the faces are asked for again at 2.5, 6 and 12 s and the
  lettering repainted if more faces have loaded. Then the receipt and
  the sales slip too (user, after a sheet of each as it was and with the
  mural's words: "change both"): the register tape's last lines are
  THANK YOU FOR SHOPPING AT / BIG GLUTTS! (apps/novaStory.jsx
  receiptLines; two lines on its 30 columns, so the tape is 12 lines, two
  a burst of the printer), and the store look's sales slip (chassis/
  corner-menu.js, the "Your order" tab) ends THANK YOU FOR SHOPPING AT /
  BIG GLUTTS!, where it said THANK YOU — COME AGAIN. Tests: e2e-story
  (twelve lines, the thanks), e2e-tienda (the slip's thanks).
- **No price tag at the top left** (2026-10-21; user, a phone screenshot
  of the walkthrough's card with the "● EL CABEZA $7.97" tag circled over
  it: "Maybe this price tag up here can be done away with. That way the
  tutorial frame would have more room. And it just seems kind of
  superfluous because there's other opportunities to purchase it, other
  ways to do it, right?"): gone, with the shelf ticket it unfolded into
  (tienda-shopping.js ShopCorner draws only the cart now, once one's in
  it; the PA no longer sends td-pa-speak to fold it). Still to buy with:
  the dock's Put one in the cart / Check out (and the phone bar's), the
  catalog's Purchase and bring home (after the walkthrough), each PA card
  (a tap fills the cart or checks out), Big Glutts' closing notice, and
  the cart at the top left. The walkthrough's card keeps below the cart
  if one's up (tienda.js FIRST_GAME_TOUR clear ".td-shop"; the in-stock
  PA can fill it before Try a Game), otherwise it sits at the top (12 px
  on a phone). Tests: e2e-story (no tag in a game; Put one in the cart
  from the dock after New Game, then Check out), e2e-store-nudge (a game
  is on: end-game, not the tag).
