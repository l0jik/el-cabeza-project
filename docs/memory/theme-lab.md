## Theme Lab (built): the same game in nine design directions (user request)

Page: `el-cabeza-lab.html` (apps/lab.jsx), built minified. It's a design
exploration, not a new game: nine complete visual systems over the one
chassis and engine, switchable live without touching the game. The nine
(ids in themes/lab/specs.js): 01 Swiss (`swiss`), 02 Bauhaus (`bauhaus`),
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
?theme=elementarism opens Swiss.)

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
  back-face outline shell + a printed mark on the top face: Bauhaus
  circle/square/triangle, glyph letters, stencil codes with the square,
  serials, stickers, ID+coordinate), nine legal-move indicators (red
  corners, direction triangles, recessed field, hard frames,
  bullet + rule, brackets, pop tile, crosshair, a plate that slides out
  from under the board), black holes/missing squares, and the ground
  composition (sheet, forms, Mondrian bars, plinth,
  offset shadow slab, console, machine bed) with a far underlay so the
  low setup view never runs off a sheet. Indicator opacity is the
  chassis's hot/cold value ×2.1 (at ×1 they read as stains).
- `themes/lab/ambient.js`: tone mapping/exposure per direction (flat
  ones use NoToneMapping so whites stay white), the ground, selection and
  hover markers drawn from the piece mesh's world footprint (the chassis
  itself only shows moves), landing marks (a piece mesh rebuilt somewhere
  new = landed) and capture marks (id gone), Neo-Brutalism's hard offset
  shadows. Ground and fx live in the scene, NOT the board group, so they
  don't turn when the board turns to face a player.
- `themes/lab/hud.js` + `css.js`: one HUD markup (id, turn number, side
  to move, moves/points/pieces/taken/time, last six moves, result) that
  nine stylesheets compose nine ways; semantic custom properties on :root
  (--bg-primary, --accent-primary, --border-width, --shadow-x, ...);
  the chassis's own UI restyled from the tokens. Compact strip on phones
  (max-aspect 3/2 or < 900px), the turn number floated in a reserved
  column. Session clock/initial counts are module-level (carry across
  switches). Turn changes play the voice's turn cue.
- `themes/lab/audio.js`: ONE AudioContext for the page, made on the
  first gesture and kept across switches; nine synthesized voices; every
  sound is a short enveloped node chain (zero-start, zero-end), at most
  24 at once, each released once on 'ended' OR by a timed backstop
  (headless Chrome never fires 'ended'); global volume + mute.

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
direction's colours and transition language (wipe, stack, bars,
slam, set, flap, pop, fade, machine).

Test: `tests/e2e-lab.mjs` (state identical across all nine switches,
mid-turn; play continues; switch during a step waits; the nine differ in
faces/accents/HUD; every control; sound starts only after a gesture and
releases its voices; phone compact HUD, no sideways scroll).

