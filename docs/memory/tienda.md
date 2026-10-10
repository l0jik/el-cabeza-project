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
  like Neon's MATTER viewer).** themes/tienda-showcase.js, on the pattern
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

