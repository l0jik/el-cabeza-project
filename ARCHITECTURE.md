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

## The theme plugin interface

A theme module exports:

```js
// themes/<name>.js
export const palette = { COLORS, HEX, EDGE_RADIUS };

// Data table, not hooks — same light positions/shadow config in both
// themes today, so the chassis owns the light RIG and just asks the
// theme for per-light color/intensity overrides.
export const lights = {
  key:  { color: 0xfff6e8, intensity: 1.08 },
  fill: { color: 0xf4f7ff, intensity: 0.378 },
  back: { color: 0xffffff, intensity: 0.18 },
};

export function buildBoardTexture() { ... }   // → THREE.CanvasTexture
export function buildGrid() { ... }           // → THREE.Group

// Coarse-grained: theme owns the full mesh + outline construction.
export function buildPieceVisual({ piece, isDark, geo }) {
  return { mesh, shell }; // both THREE.Mesh/LineSegments, chassis just adds them
}

// Every method always exists — Standard's is every method as a no-op,
// Neon's is createSoundscape(). The chassis calls these unconditionally
// at fixed game-event sites (select/deselect/land/capture/win/begin/
// end/zoom/tension) and never branches on "does this theme have audio."
export function createAudio() {
  return {
    ensureStarted() {}, beginGameFadeIn() {}, setZoom(t) {}, setMuted(m) {},
    setTension(t) {}, beginFadeOut(s) {}, resetWindDown(restore) {},
    playSelect() {}, playDeselect() {}, playLanding(mass) {}, playCapture() {},
    playWin() {}, playMenu() {}, fadeOutMenu() {}, playPowerOn() {},
    playPowerOff() {}, playFlicker() {}, playArc() {}, playGlitch() {},
    dispose() {},
  }; // Standard's literal implementation — every method a no-op
}

// Ambient visual FX lifecycle. Chassis calls these at fixed points
// (mount, Begin Game click, New Game/reset, unmount, every animation
// frame) and passes refs to the DOM hooks the chassis always renders
// (titleRef, cardRef, a generic overlayRef div, turnHaloRef,
// turnLabelRef) — a theme with nothing to attach just returns no-ops,
// so the chassis never checks "which theme is this."
export function mountAmbientEffects(refs, helpers) {
  return {
    armOnBegin() {},   // first-arm timers gated on Begin Game
    restart() {},      // re-arm after New Game / undo-past-a-win
    tick(now) {},      // per-frame: animate this theme's own item arrays
    dispose() {},
  };
}

// JSX injection slot for theme-exclusive UI with no shared equivalent
// (Neon's Anomaly button + Singularity easter egg). Returns JSX or
// null; rendered inside the chassis's pre-game setup block.
export function renderSetupExtras(props) { return null; }

// Theme's own <style> block (fonts, keyframes, hover glow, VHS-glitch
// keyframes, etc.) — a plain CSS string the chassis injects once.
export const styleSheet = `...`;
```

The chassis calls every hook unconditionally. A theme that has nothing
to contribute returns `null`/no-ops rather than the chassis special
-casing "if Standard, skip this." That's what keeps the chassis from
re-accumulating theme knowledge over time — the whole point of doing
this refactor.

## Open decisions before implementation starts

1. **Promote `isFullscreen`/`toggleFullscreen` to the chassis.**
   It's generic, theme-agnostic browser API code that only exists in
   the recovered Neon source by historical accident (it was added to
   Neon at some point and never ported to Standard). Recommend making
   it a chassis-level feature available in both themes, rather than
   routing it through `renderSetupExtras` or treating it as
   Neon-exclusive.

2. **Move Log popup.** This session's earlier edit batch built Standard
   a Move Log popup "from scratch, mirroring Neon's" directly in the
   deployed minified bundle — but that predates the recovered source
   files (see the drift noted when they were first recovered), so
   neither `el_cabeza_3d.jsx` nor `el-cabeza-neon-3d.html` has it yet.
   Once the chassis exists, this is exactly the kind of generic,
   theme-agnostic UI feature that belongs at the chassis level (like
   the Undo/Reset/Copy-log buttons already there), built once rather
   than per-theme.

3. **`buildPieceVisual`'s exact parameter shape** will need to expand
   once ghost/shadow-indicator rendering is also extracted (dashed
   move-outline color differs too: cyan/magenta in Neon vs. a single
   neutral tone in Standard) — noted here so it isn't a surprise
   mid-implementation, not resolved yet.

Nothing above has been implemented. This is the contract to build
against once you've had a chance to push back on it.
