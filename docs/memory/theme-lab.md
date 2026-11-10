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
slam, set, flap, pop, fade, machine).

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
  - The board set into the rock: the chassis's slab is the basin's floor
    (its painted face), the terrain's first ring lies exactly on the
    slab's edge just under its face (-0.03) and the next stands LIP
    (0.1) over it, the cut wall; the slab's outline (ec-slab-edges,
    ec-top-ring) hidden every tick (the chassis remakes them). Polar
    rings out from the slab's rectangle: a platform of slickrock
    cracked along its joints (basalt toward Dark's end, sandstone toward
    Light's), a ledge, a second, then the plain rolling out to R_OUT
    (170), past the sky (150); the fog (40 to 148) takes the edge. Built
    again when the board changes size (`${SLAB_X}x${SLAB_Z}`).
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
    fins, slickrock domes, balanced rocks, boulder heaps, a free arch,
    jointed shelves (Muley Point's), 62 to 112 out; mesas and buttes on
    the horizon, 112 to 150 (166 at most).
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
- Rough-hewn (hewn.js): every block, piece or stone, is a subdivided box
  moved inward only, by smooth value noise (its faces wander in by up to
  a few hundredths of a cube) plus knocks along its edges and deeper at
  its corners, all a function of the point's place alone, so a box's
  shared edges move as one and it stays whole. Standing stones taper and
  have their tops cut on a slant. Pieces never reach past their squares.
  A piece keeps its own stone through a roll: the chassis bakes the
  rolled mesh (turned a quarter) into the piece group before building the
  piece again, and scene.js reads that turn off the old mesh, snaps it to
  a cube's 24 (hewn.js snapTurn) and builds the new one with the pattern
  in the stone's own frame (texture too), so its chips come down where
  they went over. The Cabeza is a hewn disc (a lathe), its faces dressed
  flat in the middle where its spiral is pecked (paint.js "petroglyph":
  the Cabeza's only, pale on basalt, dark on sandstone). Odd-shaped
  MATTER pieces keep the chassis's smooth solid.
- A piece's surface is natural stone's (the shape kept): a few flakes
  off its arrises (hewn.js flakePlanes: planes in the stone's own frame
  across a corner, slanted to run out along one of its edges; what
  stood past one laid flat on it, moved in along its normal, so never
  out of the squares), and its colours baked per vertex (stoneTint):
  sandstone's bedding through the whole stone (planar, a little tilted;
  painted on the map it ran across one face and down the next, so the
  map has none), its varnish in streaks; basalt's weathered rind in grey
  patches and a mottle; fresh stone where a flake came off or an arris
  was knocked (paler sand, darker basalt); the hollows a little darker.
  The map is its bump map too (its grains and pits in relief), painted
  to tile without a seam (paint.js blotches/speckle `wrap`: a face's
  map repeats across its middle, where the seam showed as a line, the
  bump map's too). All in the stone's own frame, so it rolls with it;
  its noise read turned off the stone's axes (hewn.js skew: value
  noise sliced along its lattice's planes, as a block's faces slice
  it, showed squares and a line down every face).
- Its marks: a little circle of seven standing stones for a legal move
  (lit, sandstone gold; a crush in ember with a capstone), an ember ring
  round the chosen piece, dust on a landing. The board (paint.js
  monolithSlab) a slab of grey rock: mottling, grit, two old cracks,
  lichen toward the margin, the goal rows worn darker with an incised
  line and a wash of the stone coming to them, pecked rings in the
  margin's corners. Black holes a pit (colors.hole).
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
  the board set in (the ground's first ring on the slab's edge under its
  face, the cut wall over it, the outline hidden), the fog, nothing in
  the camera's room; turned, the lights turned with it; the hewn pieces
  and a roll keeping one's shape, the recordings fetched and decoded,
  landings by face and weight, the rolls' grinds, the Cabeza's glide,
  the credits, old Bauhaus links). The channel picture
  (assets/den/channels/lab-monolith.jpg) is the low view from Light's
  end, nearly square on (the moon turns with the land: further round,
  it leaves the picture), shot once the rock is all built
  (tools/channel_shots.mjs `ready`).

