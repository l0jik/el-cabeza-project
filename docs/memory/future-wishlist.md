## Future wishlist (user-requested, not started)

- **REMIND THE USER: the den's music (asked to be reminded,
  2026-09-27).** The stereo console's record player and 8-track are
  built, and the music panel lists them, but the tracks are the user's
  to send. When they arrive: bundle each as an asset and list it in
  themes/standard.js `DEN_TRACKS` ({ id, title, artist, medium: "record"
  | "8track", url }). See "The den, round 2" below.
- **REMIND THE USER: a city-block version (asked to be reminded,
  2026-09-27).** Every piece is a building, or a row of buildings when it
  lies flat, in a foggy, rainy future-noir city (think Blade Runner, or
  the PC game Dystopika). When a piece rolls or turns it becomes a
  different building on the block. Not started; flesh it out with the
  user first. Related: Lluvia (themes/lluvia*.js) is already a rainy
  neon city round the board, so ask whether this grows out of Lluvia or
  is a version of its own.
- **Online play against another human.** GitHub Pages only serves static
  files, so this needs a small backend: a relay (WebSocket) service, or
  peer-to-peer WebRTC with a tiny signalling server. Invite by link or
  short game code; the engine's move descriptors and move log are already
  the natural wire format.
- **No accounts, but saves that outlive the browser.** Options discussed:
  an export/import save code or file (no server); an anonymous save stored
  on the same backend under a secret code or link (no sign-up); browser
  storage as today. An installable app (PWA or native) doesn't solve this
  on its own; it still stores on the one device. Pick the approach with
  the user before building.
- **Piece size (decided, built).** The user chose, after renders of
  0.8 / 0.87 / 0.92: blocks, Codos and Arcos at `PIECE_SCALE` 0.87 (was
  0.8; it is also the height of one stacking level), and the Cabeza disc
  at its own `CABEZA_SCALE` 0.84 (engine/constants.js). The dock keeps
  its frame size. Board squares are unchanged.
- **Unused-points note (built).** When a player's own turn ends with
  points left that nothing can spend, a short note fades in at the bottom
  centre (`unusedNote`, data-testid `unused-points-note`), e.g. "1 point
  unused: an Opa moves only once per turn". Shown with or without the
  points counter; never for the AI's turns or a wormhole move.
- **Shoving warnings.** Back with the "slides only" setting (see
  "Shoving LAW"): `shove-needs-slide`, `shove-needs-three`, and
  `shove-opa-needs-three` for slides and rolls.
- **LAWS fixes (built).** Blurbs rewritten to match the engine (Slide
  costs 2, Black Holes are always two and exit on the same side, Split is
  up to two pieces, only a Codo/Rayo/Zeta can pivot). Warnings under a
  law's row (`lawWarning`, `law-warning-*`): Diagonal Slide without Slide;
  Cantilever Pivot with no Codo/Rayo/Zeta in the roster. Shoving adds
  `shove-opa-needs-three` (an Opa in the roster, no 3 Actions: an Opa
  shove costs 3).
- **Rayo and Zeta (built).** MATTER roster counters (0-4, default 0).
  Rayo: 4-cube S/Z (`rayo`, "Ra"); Zeta: 5-cube Z (`zeta`, "Ze"), which
  starts upright and can stand on one cube, so it can pivot (the Rayo can
  too, once stood on end). Poses in themes/neon.js PIECE_ORIENTATIONS;
  Zeta never starts flat (3 rows deep).
- **Pieces at 87%.** `PIECE_SCALE` 0.87 (user's final pick); the Cabeza
  stays at `CABEZA_SCALE` 0.84.
- **Rules cards (built).** chassis/RulesCards.jsx: tabs in the INFO
  overlay (About, Quick, Costs, This game, Moves, Your turn). Opened from
  anywhere by the window event `el-cabeza:open-rules` {tab, focus}
  (focus = a MOVES tile key or law key). Contextual entry points: each
  SINGULARITY law's "i" (`law-<key>-info`), law names in the Current
  Variants flyout (`variants-law-<key>`) plus its "Rules ›" link, the
  unused-points note (opens Your turn), and the sphere's help line (the
  old "?" is now a plain line; its text links "Game rules ›"). The INFO
  overlay is z-index 2500 so it covers the sphere; the sphere's Escape
  handler ignores Escape while it is open. MOVES has 16 animated SVG
  tiles (CSS keyframes; under prefers-reduced-motion they play at half speed, 7.2 s); the black
  hole tile shows the same-side exit. Test: tests/e2e-rules.mjs.
  No skipping: Quick has a MUST row and Your turn opens with step 1,
  "You must move at least 1 piece, 1 time. Skipping your turn is not
  allowed." The engine already enforces it: there is no pass, Stop needs
  a move first, and a turn that ends where it began is voided (settleTurn).
- **"The original El Cabeza" (built).** ABOUT ends with a link
  (`play-original`) that closes INFO and runs resetGame(false) (no laws,
  boot board size, standard pieces, no holes), then sends the window event
  `el-cabeza:play-original`: the sphere exits if open, and Nova
  (apps/unified.jsx) transitions back to the Standard theme if it's on
  Neon. Standard has no ANOMALY button, so nothing else to disable. Test:
  tests/e2e-original.mjs.
- **Original-game cue (built).** The link plays assets/original-cue.mp3
  (5.5 s of archive.org's "Mall Music Muzak – Mall Of 1974", Third Floor
  Spending Spree, from 0:06, +8 dB, fading out over the last 1.5 s)
  through a plain Audio element (volume 0.75; skipped when muted), so it
  survives Nova's theme switch. build/build.js inlines .mp3 files as data
  URLs.
- **Reduced motion = calm, not frozen (built).** Windows with Animation
  effects off makes Chrome report prefers-reduced-motion. The SINGULARITY
  button/invite then breathes (ec-singularity-calm-halo/-text: a slow 5 s
  opacity/brightness pulse, no flicker or scaling) instead of standing
  still, and the MOVES tiles play at half speed.

- **Move Log order follows the opener.** `pairLog` (engine/rules.js) pairs
  each round from whoever made the log's first move and tags rows with
  `opener`; the Move Log table puts the opener's column first and Copy
  Move Log writes "1. Light: … | Dark: …" for a Light-opened game, and
  drops the empty half of a round the game ended in. It used to show
  "1. Dark: — | Light: …", which read as a skipped Dark turn. Tests:
  engine.smoke.mjs ([log]) and tests/e2e-movelog.mjs (AI plays Light and
  opens).
- **AI sees two-roll crushes.** evaluatePosition and cabezaInDanger also
  expand a second roll for blocks near an enemy Cabeza (a turn is two
  points, so roll-to-line-up then roll-onto is the usual crush). In
  Split Movement games with pieces in contact Medium often only finishes
  depth 1, where the evaluation alone guards the Cabeza. A
  `cabezaSafety` weight (8 per safe step square short of three) is on
  for Medium and Hard, and the Cabeza/piece repeat biases now also apply
  to turns that rescue a threatened Cabeza (only twoStepBias keeps that
  waiver). ai-sim `rayo`: longest Cabeza-only run 38 -> 3, and new
  Medium beat the old 7-0 (1 draw) across both sides. Hard's value is
  Medium's, not separately simulated. tests/ai-threats.smoke.mjs.
- **Undo after a game ends restores sound.** resetWindDown(true) also
  resumes a suspended AudioContext (phones may suspend it in the
  post-game silence); tests/e2e-undo-audio.mjs, probe
  window.__EC_TEST_AUDIO__ / __EC_TEST_AUDIO_SUSPEND__ (Neon).

- **Cromo theme (built).** themes/cromo.js (+ cromo-fx.js scene effects,
  cromo-audio.js), apps/cromo.jsx, dist/el-cabeza-cromo.html, linked on
  the Pages landing page. The board is the top of a monolith cube of
  TUNGSTEN or SHUNGITE (setup-row switch `cromo-stone`, remembered in
  localStorage `el-cabeza:cromo-stone`); the cube (vertex-colour fade to
  black) is added under the slab by mountAmbientEffects, which also hides
  ec-slab-edges and runs the light sweeps (Begin Game, idle every 9-16 s,
  game end) and the landing shimmer (a piece whose square changed and then
  held still 4 frames; >2 at once = new board, no shimmer). Reflections: a
  canvas-painted studio panorama set as each material's envMap (not
  scene.environment) so the setup screen's separate dock-piece renderer
  gets it too. Pieces: mirror chrome (Light) / warm gunmetal (Dark) with
  a thin dark silhouette shell. Audio: synthesized struck-bar/stone
  modes per stone, room reverb, near-silent ambience (room tone, beating
  55 Hz drone, a rare far bowl), Neon's wind-down contract. Fonts
  Michroma + Barlow; chrome-gradient .ec-title. Test: e2e-smoke cromo.

- **Lluvia theme (stage 1 built).** themes/lluvia.js (+ lluvia-fx.js,
  lluvia-audio.js, lluvia-bus.js, lluvia-city.js = the design canvas's
  city engine as an ES module: LLUVIA.mount(canvas,{mode, dpr, fps}),
  createScore(hooks) exposing its instruments as score.inst),
  apps/lluvia.jsx, dist/el-cabeza-lluvia.html. The city runs in
  "backdrop" mode on a canvas inserted into the chassis's board layer
  under the (transparent) board canvas, at reduced dpr/fps. Board: wet
  asphalt with glossy puddles, pink rim; pieces neon glass (cyan Dark,
  magenta Light) with a bright tube shell; sodium-yellow move frames.
  Rain streaks around the board, drop rings on it, a splash on landing,
  lightning synced to the score's thunder via lluvia-bus. Audio = the
  synth score (pads, rain, drone, far đàn bầu/zither/voice) + cues built
  on its instruments.
- **Lluvia opening + city menu (stages 2-3 built).** themes/lluvia-overlay.js
  via useSetupExtras/renderExtraOverlays: on load a full-screen layer
  ("THE RULES ARE MADE DOWN THERE", DESCEND / Straight to the board);
  DESCEND runs the engine's descent (own score, captions, SKIP); on
  arrival the city's billboards/buttons open terminal panels (MATTER
  counts, LAWS toggles, TOPOLOGIES size/missing/random) plus an
  OPPONENT cycle (Human -> CPU easy/medium/hard); BEGIN THE GAME applies
  them (board resize, roster via generateAnomalySetup, setActiveLaws,
  missing squares/black holes, variants) and triggers Begin. Non-default
  rules register t.singularityGameActive + reapplySingularitySetup (New
  Game keeps them) and reconfigureSingularitySetup (reopens the city).
  The backdrop city pauses while the layer is open (lluvia-bus
  "overlay"). The setup row gets CUSTOM RULES. Test: e2e-lluvia.mjs.

