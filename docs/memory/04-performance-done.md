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
    cost badge's sprite compiled at the first pick/roll. One of each is
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
