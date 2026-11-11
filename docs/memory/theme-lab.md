## Theme Lab (built): the same game in nine design directions (user request)

Page: `el-cabeza-lab.html` (apps/lab.jsx), built minified. It's a design
exploration, not a new game: nine complete visual systems over the one
chassis and engine, switchable live without touching the game. The nine
(ids in themes/lab/specs.js): 01 Swiss (`swiss`), 02 Monolith (`monolith`),
03 De Stijl (`destijl`), 04 Brutalism (`brutalist`), 05 New Typography
(`newTypography`), 06 Corporate Swiss (`corporateSwiss`), 07
Neo-Brutalism (`neoBrutalist`), 08 Minimal Mono (`minimalMono`), 09
Ultimate Fusion (`ultimateFusion`). (There were ten until 2026-10-16:
Elementarism, the fourth, was deleted, user: "Completely remove the
Elementarism theme. Delete it." Its spec, stylesheet, voice and what
only it drew went with it: the vector move marker, the diagonal planes
under the board, the brushed diagonal plate, the diamond mark, the
diagonal selection frame, the landing streak and the slice curtain; the
directions after it were renumbered. A saved or linked
?theme=elementarism opens Swiss. The second was Bauhaus until 2026-11-10:
the Monolith stands in its place, below; a saved or linked
?theme=bauhaus opens the Monolith.)

Architecture (engine → presentation adapter → config → primitives):
- `themes/lab/specs.js`: each direction as data: colors (semantic
  tokens), typography, spacing, borders, shadows, board, pieces,
  indicator/selection/landing kinds, ground, hud, animation, materials,
  lighting (incl. tone mapping + pitch), audio voice.
- `themes/lab/factory.js`: `makeLabTheme(spec)` returns an ordinary
  chassis theme module (same contract as themes/standard.js). The chassis
  can't tell it from any other theme.
- `themes/lab/paint.js`: every board, ground sheet, piece surface and
  piece mark painted on canvas (no assets). Board painters follow the
  live board size. Ground sheets are laid out in WORLD units around the
  board (right-hand band on wide screens, above/below on tall ones),
  since the camera looks straight down. Every painted texture registers
  a repaint; `repaintWhenFontsReady` repaints once the direction's web
  fonts arrive (canvas text drawn earlier uses a fallback face). Three
  r128 textures have no `userData`: use plain props (`__repaint`).
- `themes/lab/scene.js`: grids as merged box strips (hairline, ink,
  raised De Stijl bars, machined, groove, engraved, thick, crosshair
  ticks, Fusion channels), slab materials, pieces (material + optional
  back-face outline shell + a printed mark on the top face: the
  Monolith's pecked spiral on the Cabeza, glyph letters, stencil codes
  with the square, serials, stickers, ID+coordinate; the Monolith's
  pieces rough-hewn, hewn.js), nine legal-move indicators (red corners,
  a little stone circle, recessed field, hard frames, bullet + rule,
  brackets, pop tile, crosshair, a plate that slides out from under the
  board), black holes/missing squares, and the ground composition
  (sheet, the Monolith's land, Mondrian bars, plinth, offset shadow slab,
  console, machine bed) with a far underlay so the low setup view never
  runs off a sheet (not the Monolith's: its plain is its own). Indicator opacity is the
  chassis's hot/cold value ×2.1 (at ×1 they read as stains).
- `themes/lab/ambient.js`: tone mapping/exposure per direction (flat
  ones use NoToneMapping so whites stay white), the ground, selection and
  hover markers drawn from the piece mesh's world footprint (the chassis
  itself only shows moves), landing marks (a piece mesh rebuilt somewhere
  new = landed) and capture marks (id gone), Neo-Brutalism's hard offset
  shadows. Ground and fx live in the scene, NOT the board group, so they
  don't turn when the board turns to face a player. (Except the
  Monolith's land: a ground carrying userData.land hangs on the board
  group and turns with it, sky and lights too; below.)
- `themes/lab/hud.js` + `css.js`: one HUD markup (id, turn number, side
  to move, moves/points/pieces/taken/time, last six moves, result) that
  nine stylesheets compose nine ways; semantic custom properties on :root
  (--bg-primary, --accent-primary, --border-width, --shadow-x, ...);
  the chassis's own UI restyled from the tokens. Compact strip on phones
  (max-aspect 3/2 or < 900px), the turn number floated in a reserved
  column. Session clock/initial counts are module-level (carry across
  switches). Turn changes play the voice's turn cue.
- `themes/lab/audio.js`: ONE AudioContext for the page, made on the
  first gesture (or Begin Game) and kept across switches; eight
  synthesized voices and the Monolith's recorded stone; every sound is a
  short enveloped node chain (zero-start, zero-end), at most 24 at once,
  each released once on 'ended' OR by a timed backstop (headless Chrome
  never fires 'ended'); global volume + mute.

The carry (chassis): `ElCabeza3D` takes `carry` and `carryRef`.
`carryRef.current()` snapshots the game (pieces, turn, points spent,
turn snapshot, pending steps, log, history, holes, missing squares,
variants, winner, opponent, dock roll, camera) plus `settling` (a step
animating or the AI thinking). A mount with `carry` starts from it: no
opening replayed, dock in its corner, masthead relocated, view restored
(or top-down when `cam` is null: "reset presentation"). The engine's own
module state (board size, laws) is untouched by a remount. The lab waits
for `settling` to clear (≤ 4 s) before switching. The chassis also hands
themes a read-only `game` object in useSetupExtras (currentPlayer,
stepsUsed, turnBudget, log, status, winner, turns, selectedId,
hoveredId, pieceCount ...).

Lab controls: picker (01–10, swatches), ‹ › and [ ] step, 1–9/0 jump,
Random, Full screen, Hide interface (H), Sound on/off (M) + volume,
Reset presentation (view + interface, never the game), Return to game,
L toggles the panel, Esc / outside press closes it. The theme is kept in
?theme= and localStorage. Each switch shows a short curtain in the new
direction's colours and transition language (wipe, rise, bars,
slam, set, flap, pop, fade, machine): its number and name, and under
them the first half of its materials line (to the ";"). The name block
is as wide as its words but never wider than the screen less 16px a
side, and both lines wrap, balanced (2026-11-11, user, a phone
screenshot of the Monolith's, its description one line running off both
sides: "The description needs to wrap. As you can see, staying a single
line, it runs it off both the left and right side, and all the ones in
the lab need to be checked for this."; it was `white-space: nowrap`, and
on a 360 to 412 phone the Monolith's, De Stijl's, Corporate Swiss's,
Ultimate Fusion's and, at 360, Swiss's ran off; an explicit `width:
max-content`, since a block set at left 50% otherwise shrinks to half the
screen). The line is translated whole, then cut (`t(materials)`): the
language tables know the whole line, and the cut half had stayed English
in Spanish and Vietnamese for all but the two without a ";". e2e-lab:
every direction's card on a 360 phone, in English and Spanish, 8px clear
of the edges, the long ones wrapped, Spanish translated.

Test: `tests/e2e-lab.mjs` (state identical across all nine switches,
mid-turn; play continues; switch during a step waits; the nine differ in
faces/accents/HUD; every control; sound starts only after a gesture and
releases its voices; phone compact HUD, no sideways scroll; the Actions
counter's words at least 4.5 to 1 against their plate or the page behind
them in all nine).

The Actions counter's words take the direction's --text-primary, so a
direction whose text is light over a light board loses them: Ultimate
Fusion's bone on its concrete and composite (2026-10-29, user: "Yes, fix
the Ultimate Fusion label"; about 3 to 1 in the test's view). Its counter
and the unused-actions note now sit on the machine's own plate, as its
read-out does (css.js CHROME.ultimateFusion: #1F1F1F, a 2px bone rule, a
4px hard shadow), the counter at bottom 16 (clear of End turn / Undo,
measured 8px on desktop, 18 on a phone), the note lifted to 56 over it,
and on a phone the note over two balanced lines (its wide Martian Mono
was cut short with an ellipsis on one). The other eight read at 8.8 to 1
or better bare.


The read-out's parts keep their own card's room (2026-10-31, user, with a
crop of Neo-Brutalism's move log, 12 down to 07, each number against the
card's thick left border: "the numbers in Neo-Brutalist are sitting on the
border; there should be buffer b/t the two."). HUD_BASE reset the move
log's list margins and indent as `.lab-hud .lab-log { margin: 0; padding:
0 }` and the stats' as `.lab-hud .lab-stats { ...; margin: 0 }`, both at
(0,2,0), above the (0,1,0) of a direction's `.lab-hud > *`, the rule that
makes each part a card with its padding and the space under it. So in the
five directions that draw cards (Neo-Brutalism, Brutalism, De Stijl,
Corporate Swiss, Ultimate Fusion) the log had no inner padding at all, its
numbers 0.5 to 2 px inside the border, and in the two Brutalisms the stats
card sat straight on the log card. The resets are at no weight now
(`.lab-hud :where(.lab-log)`, `.lab-hud :where(.lab-stats)`), so a
direction's own card rule wins and the others still lose the list's
defaults. A direction setting a part's spacing on purpose does it at
(0,2,0). Test: e2e-lab's
desktop walk through the nine (the log's numbers at least 6 CSS px inside
an edged card, at least 4 between the stats card and the log card when
both are bordered). Shots before and after in the scratchpad lablog/.

### The Monolith (02, in Bauhaus's place; 2026-11-10)

User, with a picture (great dark stones standing and leaning on a cracked,
barren plain at dusk, a crescent moon, a long shadow coming at you) and a
long pasted conversation about Muley Point's jointed rock and "imposing
unreal topography & terrain ... as if being viewed from ground level",
"2 contrasting color palettes ... like a natural board game": "I want to
replace Bauhaus with a something like this", then "again, we're getting
rid of Bauhaus and replacing it with something imposing & neolithic
monoliths". Of its sound: "I want the sound palette to be
non-synthesizer generated. I want real massive: thud / boom / scraping
sounds that follow the implementation instructions previously outlined,
per weight dictating pitch, etc." Seeing the first of it: "No, the
blocks, themselves need to be rough-hewn, not perfect looking."

- The sides are the land's two stones: Basalt (dark) and Sandstone
  (light), side-names.js; the dots basalt's grey and sandstone's sand,
  its corner calls the moon's light and the dusk's (points-glow.js).
  Cinzel (inscription capitals) over Alegreya Sans. Tokens: night-stone
  #14161C / #1C1F27 / #22252E, bone #E9E4D8, the dusk's ember #D98C5F,
  moonlight #8EA2C4, sandstone gold #C7A06A. Words: "Leave the stones",
  "Raise the stones", "Carvings", "Old ways", "The stones keep their
  silence.", "Set in stone." (es/vi in i18n).
- The land (themes/lab/monoliths.js, rockforms.js; all of it painted and
  modelled there, from fixed seeds, the same land every visit). Then
  (user): "I don't want just the board to spin ... when you rotate the
  board the entire 3D world rotates instead of just the board"; "the
  board to be chiseled into the surface of the ground"; "the megaliths of
  all different shapes that represent the different types of pieces in
  the game to be represented in the landscape ... natural formations of
  rocks ... like a natural landscape you feel like you're in"; "not just
  the five shapes, though"; "make the background ones more varied, and
  make sure that all the different shapes of the pieces, including
  Cabeza Nova, are represented".
  - It hangs on the chassis's board group (ambient.js: a ground with
    userData.land goes on t.boardGroup), as the den's room and Luna's
    ground do: the chassis turns the board, never the camera, so the
    whole place turns with it, sky and moon too. The key, fill and back
    lights are turned with it every tick (land.tick: their chassis
    positions, taken on the first tick, turned by the board's turn; put
    back on dispose), so a shadow stays where it falls and the painted
    long shadows always agree with the light. (So the dusk is low over
    Dark's end in the land: from Light's end you look into it, the
    stones dark against it and their shadows coming at you; from Dark's
    end it's behind you and warms every face toward you.)
  - The board a part of the ground (2026-11-10, user: "Make the board a
    seamless part of the ground"; "Right now it looks like an actual game
    board is just placed on the ground, but I want it to look more like
    ... a part of the contour of the earth itself, with the symmetry of
    the lines, albeit extremely crooked and jagged, chiseled into the
    ground itself"; and a list to keep in mind: "Prehistoric stone
    wilderness. Alien sandstone landscape. Ancient eroded badlands.
    Surreal geological formations. Fossilized-looking terrain. Desolate
    stone wilderness. Monumental natural sculptures. Sharp, fractured
    rock surfaces. Irregular geometric rock structures. Polygonal stone
    formations. Jagged ridgelines and fractured plateaus. Massive angular
    boulders. Naturally sculpted stone corridors. Interlocking rock
    formations."). monolith-ground.js:
    - The chassis's slab, its outline and the theme's grid hidden every
      tick (HIDE: ec-slab, ec-slab-edges, ec-top-ring, ec-grid; the
      chassis remakes them on a resize). Clicks never used the slab (a
      plane), so nothing else changes.
    - A plateau of polygonal plates round the board (plateField: a
      Voronoi of points on a jittered grid, some dropped away from the
      board so the plates come in every size; each convex cell taken in
      for a crack, its top a little tilted, a bevel broken round its rim,
      walls down to the crack's floor; now and then one split in two,
      one gone (a pit, never near the board), one stood up as a block).
      They rise from a step over the floor to 0.7 at most toward the
      plateau's edge (ledgeLine P out from the floor), then broken blocks
      sit on the slope down to the plain (groundAt, now the crack's
      floor at -0.5 under the plateau). One rock, shaded flat
      (rockMaterial over slickTexture: no way to it, as a flat of rock
      has none; the land's stone texture laid flat showed its streaks).
    - The board's floor: every plate the board and its set-out bench
      meet (floorRect: the slab and BENCH_GAP + BENCH_ROOM at each end,
      chassis/set-out.js), level at 0, no crack between them, so its edge
      lies out among the plates, as irregular as theirs. Its colour
      (plateColour) a pale slickrock both stones read on, going over to
      basalt toward Dark's end and sandstone toward Light's further out,
      a hint of each even under the board.
    - The grid chiseled in (grooveSheet: a canvas over the grid, clear but
      the grooves, laid at 0.003): each line cut in runs of a square or a
      few, each its own way (user, of the zigzag that came first: "It's
      like sawtooth. We're not looking for sawtooth. It's just kind of
      like sometimes there can be one with like a long, kind of slightly
      arcing crack. As long as the overall grid is adhered to, there can
      be more variety in how the cracking or the chiseling is done"):
      `arc` a long crack bowing gently to one side (2 to 5 squares), `chisel`
      a clean cut near straight, crisp, its fresh stone plain, `worn` a
      wide soft shallow stretch wandering a little, `kinked` a crack that
      turns once to thrice, each leg straight, `step` a cut that steps
      aside partway as along a fault, `fine` a narrow dark crack ragged
      only up close (never on the border). Each run starts where the last
      ended and heads for a new offset near true; width and look blend
      across the join; now and then a second crack splits off alongside
      and back. Never much more than a tenth of a square off true. Wide
      and narrow, the border's wider; fresh paler stone round it
      here and there where the skin broke, a shaded wall, a dark core, a
      lit wall (the moon's light from +x, +z; it turns with the land, so
      the painting always agrees with it); chipped lips, a spall now and
      then, a pit at each crossing (where the two crooked lines cross, not
      where a straight grid's would), hairline cracks off into the squares;
      the two goal rows a shade darker. Built again with the ground when
      the board changes size.
    - Weathered (2026-11-10, user: "The ground should look, I don't
      know, more messed up. I mean, more cracks, I guess, hairline
      cracks, just all the, you know, sort of weathering and erosion sort
      of effects you would see in this type of environment."). Two
      layers. The plates' tiled texture (slickTexture, a tile every 4.5)
      carries the fine, many-times weathering: crazing (a periodic net of
      hairline cracks, strong in patches and faint between), sixty
      wandering hairline cracks with a lit lip, small sandy pans with a
      rim dark on one side, lichen, salt. Its lines are 1.5 to 3 texels
      wide at 1024 (they were 0.7 to 1.6 before, and a line a texel wide
      is averaged away by the mipmaps at play distance: that's why the
      floor read clean). And one sheet that doesn't repeat, over the
      floor and 2.6 past it (monolith-ground.js wearSheet, 96 to a unit,
      46 on phones): long fractures, jagged and branching, a dusty halo,
      a dark core and the lip facing the moon lit; patches of crazing;
      the skin flaked off (exfoliation) in ragged steps; pans with sand
      in them; sand drifted against the floor's edges; varnish, rust and
      salt stains; lichen in clusters; over the board itself the lot
      fainter (to 0.55 to 0.7) so the squares and the pieces read. The
      plates' material (monoliths.js plateMaterial) multiplies the rock by
      twice the sheet's colour, by its alpha, where a face looks up and
      not down a crack: mid grey leaves it be, and the stone keeps its own
      colour under the rest. Built again with the ground.
    - Black holes and missing squares cut into the floor (scene.js
      carvedPit, the Monolith's only): a jagged pit at 0.005 (the other
      directions' discs stand at 0.058 over their slabs), a hole ringed
      in ember.
    - The plain beyond, polar rings out to R_OUT (170), past the sky
      (150); the fog (40 to 148) takes the edge.
  - Every piece's shape stands in it as natural rock (PIECE_FORMS: the
    standard five and Cabeza Nova's ten, each from its cube layout,
    engine/anomaly.js's, or a disc on edge): the Flaco and the 1x3
    fallen, the 2x3 a standing slab, the Turrito on a pedestal worn
    narrow under it, the arches upright, the Cruce on its stem. Each
    side's set behind its own end, within 1.25 rad of it: basalt beyond
    Dark's, sandstone beyond Light's, faced to the board. A weak device
    (quality() detail 0; SwiftShader counts) gets each shape once,
    sides alternating.
  - Between and beyond, other rock (OTHER): capped spires (hoodoos),
    fins, a slickrock dome broken into facets, balanced rocks (an angular
    block on a worn pedestal), massive angular boulders fallen together
    (polytope: a random convex block, broken on every side), a free
    arch, jointed shelves (Muley Point's), corridors (two walls, a
    narrow way between, their tops ragged) and a jagged ridgeline, 62 to
    112 out; mesas, buttes and ridgelines on the horizon, 112 to 150 (166
    at most).
  - rockforms.js: each formation a distance function (rounded boxes,
    ellipsoids, columns, smooth unions; a piece's from its cubes,
    cubesSdf), weathered (fracture planes cut first, then wear in two
    scales, bedding (strata), joints, a notch at the foot), meshed by
    surface nets, its ambient occlusion and its colours (STONE palettes:
    bands, desert varnish, lichen) baked per vertex, its map laid on
    triplanar in its own frame (rockMaterial; stable while the land
    turns), shaded flat (broken stone's facets).
  - Long shadows painted on the ground away from the dusk, stopped short
    of the platform (shadowRibbon); rubble and scree (three hewn shapes,
    instanced, coloured each).
  - Built after the land comes up, a few formations at a time (about
    28 ms of work, then the next on a timer; each lot merged into one
    mesh), so a switch to the Monolith never stalls; group.userData.ready
    and .stats (buildMs, vertices, batches) say when and what. Measured:
    a computer 52 formations in about 0.7 s of work, 91k rock vertices;
    a weak device 30 in about 0.2 s.
  - The sky dome (the dusk low over Dark's end, -z; night over the rest,
    stars, low cloud; never fogged or tone mapped, drawn first), the
    crescent moon low over Dark's end, a little right of a player's
    line, its bearing kept clear of rock (planLand underMoon: it's a few
    degrees up and drawn under everything, so a formation on its line
    hid it); the fog set on the scene while it's mounted (ambient.js
    puts the one before back).
- The camera: Player view at pitch 1.12 (lower than the other eight, so
  the land comes into the top of the picture), down to 1.45 by dragging
  (ground level), and free to walk the land (theme.freeCamera: reach 20,
  the camera kept in x, z within ROOM_HALF (24) and above ROOM_FLOOR
  (0.9), a box in the board's frame, so it turns with the land). Every
  rock stands outside it or under its floor: the tall ones from
  ROOM_CLEAR (37) out, past the box's corners; nothing of the ground or
  the rubble inside it rises past its floor (e2e-monolith looks at every
  point of the ground, rock and rubble).
- Rough-cut stones (roughcut.js; user, first: "No, the blocks, themselves
  need to be rough-hewn, not perfect looking"; then: "The pieces on the
  board must be more rough cut than they currently are", and "Remove the
  spirals off of the cabeza pieces. They look stupid."): every piece, the
  odd-shaped ones too, cut out of its own cubes as the land's formations
  are (cubesSdf, set a little in from its box so its lumps have room both
  ways), broken along a score of planes (its corners off unevenly, long
  facets down its arrises, each face split into facets off true, more on
  a bigger face; a bigger stone in bigger pieces), pitted, its breaks
  fresh (a third as worn as the skin no break touched: rockforms.js
  weathered `fresh`), bounded by its box (never past its squares), meshed
  by surface nets, its arrises then put back sharp (roughcut.js sharpen: a
  point where two or three of its planes meet, its breaks or a break and
  the block's face, goes onto all of them the least way; the mesh alone
  rounds them off by a cell), shaded flat, its
  colours baked per point at its own scale (stoneColour: bands, varnish,
  lichen, its hollows darker, flecks); its grain laid on from three sides
  in its own frame (stonePos, stoneNrm: it rolls with the stone). The
  Cabeza a round stone cut the same way, bare (the petroglyph mark gone).
  Cut once per piece and kept (scene.js stones, up to 96): a piece built
  again gets the same stone turned: the roll's turn on its last one
  (the chassis hands back the rolled mesh; hewn.js snapTurn), then its
  last turn alone, then whichever of a cube's 24 puts its cubes where they
  are now (roughcut.js turnTo: an undo, a replay); none fits, it's cut
  afresh. About 3 ms a cube's stone, 11 the Opa's, 15 a Hombro's, at a
  computer's detail. (The last round's flakes and baked tints on hewn
  boxes are gone; hewn.js only makes the land's rubble now. The piece
  maps still tile without a seam, paint.js `wrap`.)
- Its marks: a little circle of seven standing stones for a legal move
  (lit, sandstone gold; a crush in ember with a capstone), an ember ring
  round the chosen piece, dust on a landing. (paint.js monolithSlab, the
  slab's painted face, is still the board texture the chassis makes, but
  the slab it's on is hidden.)
- On a phone the Lab's bar sits over the top of the screen, where the
  game puts its own notes (the check alert, its Show again chip, its
  note, the replay's bar); user, a Monolith phone screenshot, the bar
  over the chip, circled: "We have some menu overlap here that needs to
  be addressed." css.js, compact: --ec-shell-top set under the bar, so
  those come down below it; the chip, up all turn, on the bar's own row
  at the right, small, its words on two lines if the row is narrow
  (e2e-check-alert: the Lab on a phone).
- The HUD a stele: the turn number cut into a standing stone (incised
  figures, an ember edge), the rest carved small over the land with a
  shadow under every word; the Actions counter and note on slabs of their
  own (bone words bare over the lit plain could go under 4.5 to 1). The
  curtain: the dark comes down and the name rises in it ("rise").
- Sound: real stone, recorded (09-audio.md, the Monolith's voice). Slides
  glide, nothing struck (chassis theme.slidesGlide, as the wooden sets'
  woodPieces). Credited on the About card (spec.soundCredits;
  assets/monolith/src/CREDITS.md).
- Test: tests/e2e-monolith.mjs (served over http; the weight rules, the
  layout of the recordings; the land, at a weak device's detail and at a
  computer's (?quality=high): on the board group, every part there,
  every piece's shape (on both sides at a computer's), the other kinds,
  the board a part of the ground (the slab, outline and grid hidden, the
  floor level at 0 under the board and bench, the grid chiseled over the
  board), the fog, nothing in the camera's room (the plates too);
  turned, the lights turned with it; the rough-cut pieces (uneven faces,
  corners off, nothing past their squares, shaded flat, their own
  colours, the Cabezas bare) and a roll keeping one's shape, the
  recordings fetched and decoded,
  landings by face and weight, the rolls' grinds, the Cabeza's glide,
  the credits, old Bauhaus links). The channel picture
  (assets/den/channels/lab-monolith.jpg) is the low view from Light's
  end, nearly square on (the moon turns with the land: further round,
  it leaves the picture), shot once the rock is all built
  (tools/channel_shots.mjs `ready`).

