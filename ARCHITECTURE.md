# El Cabeza — shared-engine architecture

This documents the target architecture for the deduplication refactor.
Phases 1–2 (below) are done and merged. Phase 3 (the theme plugin
interface) is a design sketch, not yet implemented — nothing in
`components/` exists yet, and none of this is wired up.

## Three layers, not two

The original plan was "shared engine + theme." Comparing the two
recovered sources function-by-function and effect-by-effect shows a
third layer sitting between them: most of the React component itself
— state shape, camera/input math, the JSX skeleton, generic actions
like Undo/Reset/Copy Log — is **identical** between Standard and Neon.
It isn't game logic (doesn't belong in `engine/`) and it isn't visual
identity (doesn't belong in `themes/`). Calling it "theme code" and
duplicating it, or forcing it into the theme plugin, would be wrong
either way. It gets its own layer: the **chassis**.

```
engine/    — rules, AI, geometry math           (done, phase 1)
themes/    — palette, board visuals, audio,     (done, phase 2 —
             ambient FX, theme-exclusive          static/standalone
             features (Anomaly, Singularity)      parts only)
chassis/   — the React component: state,        (not yet built —
             camera/input, JSX skeleton,           this document
             scene lifecycle, generic actions       is its contract)
```

Evidence this split is real, not assumed:

- All 25 `useState` slots (`pieces`, `currentPlayer`, `selectedId`, …
  through `showInfoOverlay`) are declared identically, in the same
  order, in both sources. Neon adds exactly 8 more on top
  (`audioMuted`, `singularityRevealed`, `isFullscreen`, …) — it never
  removes or renames a shared one.
- Derived flags (`awaitingBegin`, `declutter`, `showTopButton`) are
  byte-identical expressions in both.
- The scene-setup lighting recipe uses the **same positions and shadow
  config** for every light in both themes — only `color` and
  `intensity` differ (e.g. the key light: `(9,13,5)`, `castShadow`,
  identical `shadow.mapSize`/bias/radius in both; `0xfff6e8` @ 1.08 in
  Standard vs `0xcfe9ff` @ 1.02 in Neon).
- `tick()` — the animation-frame loop — is 232 lines in Standard and
  309 in Neon. The extra 77 lines are five item arrays Neon animates
  (`fxItems`, `digitalGlitchItems`, `voxelShatterItems`,
  `crawlMassItems`, `shockwaveItems`); the camera-damping, ghost-line
  fade, and roll/slide animation code they're interleaved with is
  identical.
- Audio: 19 distinct `audioRef.current.*` methods, called from 32
  sites in Neon's component. **Zero** in Standard's. The call sites
  themselves (e.g. "on piece select," "on turn commit," "on win") are
  places Standard's component reaches too — it just has nothing to
  call there.

One genuine surprise: `isFullscreen`/`toggleFullscreen` exists **only**
in the recovered Neon source, not Standard's — even though it's
generic browser API code with no theme dependency at all. That's
noted below as a promotion candidate, not modeled as a Neon feature.

## Where the two sources actually diverge

Not everything divergent is a clean "swap a color" case. Three
different kinds of divergence showed up, and they call for three
different kinds of hook:

**1. Pure data (color/intensity/numeric) — a config object is enough.**
Lights, board/slab materials, `EDGE_RADIUS`. Already extracted as
`COLORS`/`HEX` in `themes/*.js`.

**2. Same shape, different implementation — a function hook per theme.**
`makeBoardTexture`/`makeGrid` are structurally similar (both draw a
canvas texture, both build line-geometry grid + border) but Neon's
adds a whole second bloom-texture pass with additive blending that
Standard's doesn't have. Already extracted as separate functions, one
per theme, in `themes/*.js` — not merged into one parameterized
function, because forcing that would either lose Neon's bloom pass or
leak Neon-only concerns into "shared" code.

**3. Genuinely different technique — needs a coarse-grained hook.**
Piece rendering is the sharpest example. Standard's pieces are opaque
`MeshStandardMaterial` bodies with an **inflated back-face silhouette
shell** for the outline (grown by `OUTLINE_T`, rendered `BackSide`).
Neon's pieces are **translucent** (`opacity < 1`, `depthWrite: false`)
with an emissive glow, and — per its own code comments — evolved away
from the inflated-shell technique specifically because it interacts
badly with translucent depth-sorting; Neon instead traces
`EdgesGeometry` on a simplified sharp-cornered proxy. These are two
deliberately different rendering strategies, not one function with
different color arguments. This needs a hook that hands the *whole*
mesh-building responsibility to the theme, not a parameterized shared
function.

## The theme plugin interface (as built)

This section originally sketched the contract before any code existed.
It's now implemented (`chassis/ElCabeza3D.jsx` + `themes/*.js`) and
verified end-to-end with Playwright (`tests/e2e-*.mjs`) — updated here
to match reality rather than the original sketch, including a few
things that only became clear during implementation.

A theme module (`themes/<name>.js`) exports:

```js
// Flat named exports, not a nested `palette` object — the chassis
// destructures COLORS/HEX/EDGE_RADIUS straight off the theme module.
export const COLORS = { ... };
export const HEX = { ... };
export const EDGE_RADIUS = 0.0625; // or 0.03 for Neon

// Modal chrome for the chassis's shared popups (Move Log, Info,
// Victory placard) and the canvas mount's own background gradient.
// Not discovered until a screenshot caught Neon's Move Log rendering
// in Standard's cream colors — see the "bugs caught" note below.
export const modalBackdrop = "...";
export const modalSurface = "...";
export const canvasGradientStart = "...";
export const canvasGradientEnd = "...";

// Data table, not hooks — same light positions/shadow config in both
// themes, so the chassis owns the light RIG and just asks the theme
// for per-light color/intensity overrides.
export const lights = {
  ambient: { color, intensity }, hemi: { sky, ground, intensity },
  key: { color, intensity }, fill: { color, intensity }, back: { color, intensity },
};

// Named makeBoardTexture/makeGrid (not buildBoardTexture/buildGrid —
// the original sketch's naming didn't survive contact with the
// already-extracted phase-2 code, which had used make*).
export function makeBoardTexture() { ... }   // → THREE.CanvasTexture
export function makeGrid() { ... }           // → THREE.Group

// Discovered during implementation: Neon's board top face uses
// MeshPhysicalMaterial's clearcoat layer for a glossy sheen — a
// different material class, not just different numbers — so this
// needed its own hook alongside buildPieceVisual, not a data table.
export function buildSlabMaterials(boardTex) { ... } // → THREE.Material[6]

// Coarse-grained: theme owns the full mesh + outline construction.
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  return { mesh, shell };
}

// A theme with an outline technique that carries no at-rest Y offset
// (Neon) sets this to 0; Standard's inflated-shell technique needs its
// own OUTLINE_T. The chassis always applies `theme.outlineYOffset ?? 0`
// when a shell enters a roll's pivot rotation, never branching on theme.
export const outlineYOffset = 0; // or OUTLINE_T for Standard

// Declared capability, not a branch: lets the chassis skip an inert
// Sound On/Off button for a theme with no audio.
export const hasAudio = false; // or true for Neon

// Every method always exists — Standard's is every method as a no-op,
// Neon's is createSoundscape(). The chassis calls these unconditionally
// at fixed game-event sites and never branches on "does this theme
// have audio."
export function createAudio() {
  return {
    ensureStarted() {}, beginGameFadeIn() {}, setZoom(t) {}, setMuted(m) {},
    setTension(t) {}, beginFadeOut(s) {}, resetWindDown(restore) {},
    playSelect() {}, playDeselect() {}, playLanding(mass) {}, playCapture() {},
    playWin() {}, playMenu() {}, fadeOutMenu() {}, playPowerOn() {},
    playPowerOff() {}, playFlicker() {}, playArc() {}, playGlitch() {},
    dispose() {},
  };
}

// Ambient visual FX lifecycle — title flicker/spark/letter-burn, turn
// halo pulse, VHS glitch + Scanimate/Vidicon rare variants, jitter-tear,
// board arcs, crawling voxel mass, floor wave, digital-interior/
// voxel-shatter piece effects, all ported for Neon (themes/neon.js).
// Chassis calls these at mount (via this call itself), Begin Game
// click (armOnBegin), New Game/undo-past-a-win (restart), every
// animation frame (tick), and unmount (dispose); it passes refs to the
// DOM hooks it always renders (titleRef, titleWrapRef, turnHaloRef,
// turnLabelRef, cardRef, fxOverlayRef) plus `{ three, windingDownRef,
// audio }` so a theme's own effects can read live scene state and
// call the SAME audio instance the chassis uses (not a second one).
// A theme with nothing to attach (Standard) returns no-ops.
export function mountAmbientEffects(refs, helpers) {
  return { armOnBegin() {}, restart() {}, tick(now) {}, dispose() {} };
}

// Move-triggered FX (weight-lift/landing glow, glitch bursts, landing
// shockwave) are NOT a separate hook — they're plain properties
// (pulseSquare, spawnGlitchBurst, spawnLandingShockwave) that
// mountAmbientEffects writes onto the shared `three.current` object,
// exactly like the original per-theme sources did before this
// component was shared. The chassis's animateStep calls them with
// `t.pulseSquare && t.pulseSquare(...)` guards — a no-op for a theme
// that never sets them.

// JSX injection slot for theme-exclusive UI with no shared equivalent
// (Neon's Anomaly button + Singularity easter egg — NOT YET PORTED,
// see themes/neon.js). Returns JSX or null; rendered inside the
// chassis's pre-game setup block.
export function renderSetupExtras(props) { return null; }

// Theme's own <style> block — a plain CSS string the chassis injects
// once via <style>{theme.styleSheet}</style>.
export const styleSheet = `...`;

// Global SVG <defs> (Neon's VHS-glitch warp filters — feTurbulence/
// feDisplacementMap can't be expressed as pure CSS). Not in the
// original sketch; discovered when porting the VHS glitch profiles
// that reference url(#ec-warp-a). Written with React.createElement,
// not JSX syntax, since theme files stay plain ES modules loadable
// directly by Node for the smoke tests — only the chassis and the
// apps/*.jsx entry points use actual JSX.
export function renderGlobalDefs() { return null; }
```

The chassis calls every hook unconditionally. A theme that has nothing
to contribute returns `null`/no-ops rather than the chassis special
-casing "if Standard, skip this." That's what keeps the chassis from
re-accumulating theme knowledge over time — the whole point of doing
this refactor.

## Verification

No test suite existed before this refactor — every check here was
built alongside it. `npm test` runs three layers:

- **Engine/theme smoke tests** (`tests/engine.smoke.mjs`,
  `tests/theme-*.smoke.mjs`) — import the modules directly in Node,
  exercise move generation, AI turn selection, geometry, and
  behavioral properties (Anomaly's rotational symmetry, tension bounds,
  `buildPieceVisual`'s opaque-vs-translucent distinction).
- **End-to-end tests** (`tests/e2e-*.mjs`) — build both themes for
  real via `build/build.js`, then drive the actual output in a headless
  browser (Playwright): click Begin Game, select a piece, complete a
  real move by clicking its ghost indicator, confirm the turn passes
  and the move log records it, open the Move Log popup post-game, and
  (`e2e-ambient.mjs`) run 20 seconds of live idle time past Begin Game
  to let the armOnBegin-gated ambient timers (8-12s delays) actually
  fire, sampling the turn-halo's CSS custom property to confirm the
  continuous pulse effect is genuinely running rather than just
  present in the bundle.

This verification found real bugs before they shipped, not just after
the fact: a missing `cabezaInDanger` import (phase 2); the Move Log
popup and canvas gradient using hardcoded Standard color literals
instead of theme tokens (caught by screenshotting the Neon build); and
twice during the ambient-FX port, a `Cannot read properties of
undefined` crash from `weightGroup`/`fxGroup` being added to the scene
but never assigned back onto the shared `three.current` object the
builder functions expected to find them on.

## Open decisions — resolved

The two decisions flagged in the original sketch are both implemented:
`isFullscreen`/`toggleFullscreen` is chassis-level and available in
both themes; the Move Log popup is a chassis-level feature (state,
handlers, and modal all in `chassis/ElCabeza3D.jsx`), reconstructed
from the deployed bundle's actual current structure rather than
invented, including that "Move_Log Copied" persists rather than
reverting after 2 seconds.

## Anomaly and Singularity (phase 5)

The Anomaly random-setup button and the Singularity easter egg are now
ported too. Their underlying logic (`generateAnomalySetup`,
`PIECE_ORIENTATIONS`) had been in `themes/neon.js` since phase 2; this
phase wired the JSX and added a hook the earlier interface sketch
hadn't anticipated:

```js
// A REAL React hook (useState/useRef/useEffect inside), not a plain
// function — Singularity's hover-hold reveal timer and info-popup
// state need to persist and trigger re-renders. Safe for the chassis
// to call unconditionally every render (same reasoning as any other
// hook: `theme` is a stable prop, so which branch `theme.useSetupExtras
// ? ... : null` takes never changes for a mounted instance) even
// though it lives in a theme module rather than the component itself.
export function useSetupExtras({ awaitingBegin, pieces, setPieces }) {
  return { handleAnomaly, singularityRevealed, showSingularityInfo,
            beginSingularityHold, cancelSingularityHold,
            openSingularityInfo, closeSingularityInfo };
}
```

`renderSetupExtras` needed a signature change from the original sketch
too: it now receives `{ beginGameButton, ...setupExtras }` and returns
the *entire* pre-game row/column, not just something appended after
Begin Game — Neon's Anomaly button sits **beside** Begin Game, not
after it, so the theme needs to place the chassis-supplied button
itself rather than only being handed a slot below it. A theme that
returns `null` (Standard) gets the chassis's own default single-button
row. `renderExtraOverlays(setupExtras)` is new too — a slot for
standalone modals a theme's setup state needs mounted globally (the
Singularity info popup), analogous to `renderGlobalDefs` but for JSX
overlays instead of SVG defs.

Written with `React.createElement`, not JSX, same reasoning as
`renderGlobalDefs`: theme files stay plain ES modules the smoke tests
can `import` directly in Node.

Verified with `tests/e2e-singularity.mjs`: clicks Anomaly (confirms
the board doesn't break), holds hover for 4.5s to reveal Singularity,
opens its info popup, and confirms Escape actually closes it (checked
via the modal's own opacity style transitioning 1→0, not just DOM
presence — an initial version of this test asserted on the wrong
element and reported a false failure, caught by checking the real
inline style directly rather than trusting a guessed selector).

One knowable gap: this ports the *recovered* Neon source's Singularity
CSS, which — per this session's own earlier task history — predates a
later polish pass ("33% smaller letters, bold removed, immediate
pulse-on-unlock, fixed padding, calmer plasma") applied directly to
the deployed bundle. The ported version is complete and functional,
just not necessarily pixel-identical to the latest deployed tuning.

Nothing else remains flagged as unported — every ambient effect and
gameplay feature from both original sources now exists in the shared
chassis + theme structure, verified end-to-end.

## Known pitfalls

**Never size responsive text with `transform: scale()`.** The
relocated corner masthead badge went through several passes (0.45,
a mobile-only 5x, half of that, then a flat `scale(0.4)`) that all
looked fine on a wide desktop viewport and came out illegibly tiny on
a narrow phone. The actual bug was architectural, not a wrong
multiplier: the badge's font-size came from the SAME `clamp(20px,
7vw, ...)` formula as the full-size pre-game masthead, wrapped in a
`transform: scale()` to shrink it. A `scale()` shrinks a `clamp()`
floor right along with everything else — on a narrow phone, where
`7vw` is already near that 20px floor, `scale(0.4)` drove it down to
~8px. Retuning the multiplier could never fix this; every multiplier
has *some* viewport width narrow enough to hit the same wall.

The fix: give the badge its own `clamp(16px, 2.8vw, 52px)` directly on
the font-size (2.8vw/52px = 0.4 × the pre-game formula's own 7vw/131px,
so desktop sizing is unchanged), with its own 16px floor sized for the
badge's own legibility — not `transform: scale()` of a different
element's floor. General rule: if an element needs to be "a fraction
of" another element's responsive text size, give it its own `clamp()`
at that fraction, never a CSS `transform: scale()` wrapping the
original — `scale()` is fine for non-text chrome (icons, the dock
piece's own 3D canvas) but not for anything whose size bottoms out at
a `clamp()`/`min()` floor meant to protect legibility.
