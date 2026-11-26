## 4. Performance work already done (don't undo without reason)

- **Piece mesh diffing**: the "build pieces" effect used to dispose and
  rebuild every piece's mesh+shell on every state change. `commitRef`'s
  `setPieces` preserves object identity for pieces a move didn't touch,
  so a piece-id-keyed cache now skips rebuild for anything unchanged —
  O(pieces that changed, usually 1-2) instead of O(all 10). Call sites
  that don't preserve that identity invariant (undo, history-jump, New
  Game) safely fall back to full rebuild — this is intentional, not a
  gap to "fix."
- **AI off the main thread** (§3) — Hard-tier search would otherwise
  freeze all rendering (camera easing, ambient FX, even the just-landed
  piece's tail animation) for up to 4.3s.
- **React production build** (§2).
- **Piece fillet tessellation** `seg=6` (was 8) in `makeRoundedBox` —
  analytically verified the fillet's sagitta error is still <0.07% of
  piece size at both themes' `EDGE_RADIUS`, and visually confirmed no
  faceting at extreme close-up. This was a measured decision, not a
  casual guess — don't lower further without the same rigor (analytic
  check + close-up screenshot in both themes).
- **Dock preview render loop fully paused** while its panel is open
  (`dockView === "panel"`) — that tiny scene was rendering every frame at
  opacity 0 (fully invisible) for no reason.
- **Futuris per-frame FX loops** (crawling mass, digital glitch — up to ~40
  live voxels across overlapping generations) use plain indexed loops,
  not `.forEach` with destructuring, to avoid per-item-per-frame closure
  allocation.
- Camera clamp math (§5) uses a 24-step numerical bisection per frame for
  the vertical visibility check — confirmed cheap ("a couple of trig
  calls each") and deliberately chosen over a closed-form approximation
  that was tried and failed (§8).

- **Smoother on weak machines (2026-10-19; user: "We need to see how we
  can make the animations run more smoothly for low capability
  machines")**, measured on the store at the low tier with the CPU slowed
  4x (scratch perf/anim.mjs, landing.mjs, spikes.mjs, programs.mjs):
  - The dock panel's overflow measure (a layout effect reading
    scrollHeight after *every* render) forced a whole-page layout at each
    React commit: the biggest single main-thread cost of a move (a roll's
    landing and the computer's turn re-render 5-14 times). Now only while
    the panel is open (`dockView === "panel"`). Don't put an unconditional
    layout read back in a no-deps layout effect.
  - The sides' wood swatches (wood-set.js woodSwatch: a WebGL context, a
    shader compile and a toDataURL) were made the first time a button
    wore them, mid computer's-turn; now in an idle callback after load.
  - Shaders compiled the first time something was drawn: the move markers
    (theme.buildMoveIndicator, crush and not), their tap targets and the
    cost badge's sprite (gone since 2026-11-20) compiled at the first
    pick/roll. One of each is
    built at the first idle moment, kept hidden in the scene (never
    disposed: three.js frees a program when its last material goes) and
    `renderer.compile(scene, camera)` run. No program is compiled during
    play in the store any more (tests/e2e-device-fit.mjs checks the count
    doesn't change at the first pick).
  - Cost badge pictures cached by text and colours (BADGE_TEXTURES), not
    painted and uploaded per marker per layout.
  - The corner dock piece (its own small renderer) is rebuilt at every
    change of turn (it shows whose turn it is); its old meshes were freed
    first, which freed the wood shader both wear, so the new piece
    compiled it again every turn. The old ones are now freed 1.5 s later.
    Its loop is held to 30 a second with the board's when paced
    (three.current.governorNow).
  - One governor for every world (device-fit.js createGovernor; the den,
    the store and Parrish build theirs with their own limits and hand it
    over as three.current.governor, which the chassis loop runs). Judges
    after 1 s (30 frames, or 10 over 2 s when slower), a bigger step
    under 24 fps; when frames that redraw the shadows (something moving)
    are slow and the rest aren't, halves the shadow map first; at the
    pixel-ratio floor and still slow, halves the shadow map (to 512) and
    then holds frames to 30 a second (the chassis skips every other
    refresh: `gov.skip(now)` at the top of tick; a frame is due every
    33.3 ms counted from the last one due, not from when it came, so a
    renderer whose frames come every ~30 ms of themselves, as CI's do,
    still makes no more than 30: counted from when it came, those all
    passed and read 33, failing e2e-device-fit on cc1ad27); comes back up slowly
    (the cap, then the shadow map, then the pixel ratio, 8 s apart, not
    within 15 s of a step down; the cap comes off when every refresh is
    on time). Remembered per tier and world in localStorage
    `el-cabeza:fit`. Under __EC_TEST_HOOKS__ only the pixel ratio moves
    and nothing is remembered unless __EC_TEST_FIT__ (the CI renderer is
    slow on every frame). tests/device-fit.smoke.mjs (made-up frame
    times) and tests/e2e-device-fit.mjs. The ?fps readout says "held to
    30" when it is.

- **An even 30 before less of the picture (2026-11-26; user, the
  store's opening pan on a TCL NXTPAPER 11 tablet: "kind of jerky ... What
  can we do on such devices to increase the smoothness of the animation,
  yet ensuring that we get the maximum resolution and movement? We don't
  want to hamstring it")**:
  - The tablet's GPU (Mali-G57 MC2, Helio G99) is on tienda-quality.js's
    weak list: the low tier, pixel ratio up to 1.25 (its screen likely
    1.5: 2000×1200 at 11 inches).
  - Measured here (1333×800 at 1.5, the low tier, the CPU slowed 4x;
    scratch pan-perf.mjs, pan-trace.mjs): the pan draws the shadows again
    every frame (the board group turns under the world-fixed key light:
    shadow-watch.js sees every caster move), 170 draw calls a frame (40
    of them the shadow pass), 44.5k triangles, 23 programs and 40
    textures with none compiled or uploaded during the pan, the page's
    own scripts about 7 ms a frame at 4x (some 3-4 ms on the tablet), GC
    small. So the tablet's frames are the GPU's, which can't be measured
    here.
  - The order gave up the picture first: below 42 a second (median) the
    pixel ratio stepped down to the tier's floor (0.85: about 57% of
    a 1.5 screen's own across, remembered for the next visit) before the frames
    were held to 30; and 42 to 56 a second was let be (neither SLOW nor
    FAST), though on a 60 Hz screen those frames land on one refresh and
    then two: the median on time, a quarter or more late, the stutter a
    3°/s pan shows most.
  - Now (createGovernor, every world but a painted one, `smoothFirst`):
    frames that don't keep up (median over 1000/42, or the 75th
    percentile over 1000/50: a quarter of them taking a second refresh)
    are held to an even 30 first, the pixel ratio and the shadow map
    kept; held and still missing it (median over 1000/27: most frames a
    third refresh), the shadow map halves, then the pixel ratio steps
    down (0.2; 0.3 only under 15 a second), as far as 30 holds. Slow only
    while something moves: the shadow map first, as before. Back up the
    other way round, the pixel ratio first, then the shadow map, while 30
    holds (90% of frames within 1000/29), the 30 off last when every
    refresh comes on time; a step up taken back within 12 s is undone and
    marked as this visit's ceiling. Remembered under el-cabeza:fit2; the
    old key is removed (what the old order settled on, a pixel ratio
    lowered first, isn't kept). Parrish (paintings, pace: false) keeps the
    old order. Under the browser tests without __EC_TEST_FIT__ only the
    pixel ratio moves, as before. tests/device-fit.smoke.mjs (frames of
    30 ms: held, all kept; uneven 14/14/20 ms: held; 50 ms by the pixels:
    held, shadows 512, the pixel ratio 1.35 where 30 holds, the step back
    up to 1.5 taken back once; room again: the pixel ratio, the shadow
    map, the 30 last; the old key forgotten), tests/e2e-device-fit.mjs
    (all three steps on the software renderer, which can't hold 30 at all).
  - Not done, offered: fewer draw calls (the store's static furniture
    merged by material), the shadows redrawn during the pan only when a
    shadow would move a texel or more (at 30 a second the pan turns about
    that much a frame: little saved), the low tier's cap raised to the
    screen's own and the governor left to find where 30 holds.

- **Parrish's painting on weak laptops (2026-10-29; user: "Both Parrish
  boards graphically run very slowly on low resource / power laptops.
  Can they be optimized on such devices?")**:
  - The governor never saw the paintings. Stop-motion paints 8 times a
    second and holds the painting between; the held frames draw nothing
    and all came on time, so the median frame was always fine and
    nothing was stepped down. And at the high tier (most laptops,
    whatever their GPU: tienda-quality.js only names old Intel HD, some
    Mali/Adreno and software renderers as weak) Parrish's floor was 1,
    which is where a laptop's screen at devicePixelRatio 1 starts, so
    there was no room anyway. Now `createGovernor(..., { paintings: true,
    pace })`: Parrish calls `governor.painted()` when a painting is drawn
    (not held), and what's judged is each painting's longest wait for a
    frame, from the frame after it to the one after the next painting
    (its cost lands on whichever frame the browser can't draw until it's
    done, not always the next). Over 1000/28 ms a step down (×1.5 past
    1000/12), p90 under 1000/45 a step up. The floor is 0.6 in every
    tier; never held to 30 in stop mode (`pace: false`: nothing to spare
    when the frames between draw nothing). Remembered as `high|parrish`
    etc. Tests: device-fit.smoke.mjs ("a painted world"), e2e-device-fit
    [parrish] (1366×768 at 1: down to 0.6 and shadows 512, kept, reload).
  - The dome's noise (six five-octave fbm3 a pixel) moved out of the
    scene pass into its own pass before each painting, at half the size
    the scene's drawn at (parrish-scene.js SKY_SCALE, drawSky as the
    painter's beforeScene(r, w, h)): each pixel's ray out to the sphere
    of 900 in the dome's own space; the dome mesh just samples it at
    gl_FragCoord. SwiftShader: scene + sky 86 → 44 ms. Same picture: raw
    footage at one moment (test hook __PARRISH_SKY__ { scale, time })
    full vs half differs by 0.37/255 on average outside the tumbling dock
    piece.
  - Strokes (parrish-paint.js): a stroke not laid returns at once in the
    vertex stage (most of each layer: the world's aren't laid on the
    subject, nor its on the world); the small layers bend along fewer
    segments (LAYERS segs: 8, 8, 4, 2, 1; a 40 px stroke bends under a
    pixel); world strokes discard where they're clipped away, and skip
    the piece edge's wandering cut where the flow says no subject is
    near (exact: the flow's reach is wider than the wander below 4K).
    These are for GPUs; SwiftShader shows none of it: its instanced
    draws cost about 11 µs an instance whatever the vertex count (layer
    5's 40k instances: ~440 ms, scissored to 1 px), so its stroke pass
    stays ~1.25 s a painting at 1366×768. Don't chase instance counts on
    CI's numbers.
  - Measuring a pass: wrap renderer.render with a 1-pixel readPixels
    before and after (gl.finish() doesn't wait in Chrome: every pass read
    ~0.1 ms). Scratch: parrish-perf/passes.mjs (per pass, per layer,
    scissored), shot.mjs (a steady still: reduced motion, the governor
    held at 1), sky-ab.mjs.
