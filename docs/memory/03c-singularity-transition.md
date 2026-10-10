## 3c. Singularity cinematic transition (Neon-only) — Part 1 of SINGULARITY_DESIGN.md, BUILT

Holding the revealed Singularity button to commit no longer just opens a
static "coming soon" info card. It now runs a real collapse → hard-cut-
to-black → draggable Fresnel-glow sphere sequence, in a new module,
`themes/neon-singularity.js`, kept separate from `themes/neon.js`
(already 6000+ lines) rather than inlined.

- **The bridge is a plain object on `three.current`, not React state.**
  `useSingularityPhase` (called from `useSetupExtras`) owns the React
  `phase` state the DOM overlay renders from, but the actual per-frame
  3D animation runs inside `mountAmbientEffects`'s existing tick — a
  *different* hook invocation, in a different closure. Both close over
  the *same* `three.current` object (chassis-owned, mutated in place,
  never reassigned after initial scene setup), so `t.singularity = {...}`
  written by one is visible to the other with zero new chassis-to-theme
  event/callback plumbing. `advanceSingularityScene(t, now, chromeRefs)`
  is the function mounted into that tick; see its call site in
  `themes/neon.js`'s `mountAmbientEffects` right before
  `renderer.render(...)`.
- **Two additive chassis changes, both in `chassis/ElCabeza3D.jsx`**:
  `three` is now also passed into `theme.useSetupExtras(...)`'s call
  (previously only `mountAmbientEffects` got it) — needed for
  `commitSingularity` to reach the bridge object at all; and `cam` is
  now passed into `mountAmbientEffects`'s helpers alongside `three`,
  for a possible future camera move during collapse (currently unused —
  everything shipped works through `three` alone).
- **The funnel warp is a NEW mesh, not the live board warped in place.**
  The real slab (`BoxGeometry`) and grid (raw 2-vertex `LineSegments`
  per line) don't have the vertex density for a smooth curve. A
  lazily-built, subdivided `PlaneGeometry(64,64)` with a custom
  `ShaderMaterial` (`wireframe:true`) fades in as the real grid's
  opacity fades out. This is the **first custom shader in this
  codebase** — same for the sphere's Fresnel-rim `ShaderMaterial`.
- **The hard cut is genuinely same-frame.** `cutSingularityAudioToSilence()`
  (new, in `themes/neon.js`'s `createSoundscape()`) zeros the single
  shared `master` gain node — silencing every bus (hum/ambient/events/
  sfx) in one call — and hard-stops the hum's oscillators immediately
  (unlike `stopSingularityHum`, which deliberately lets a 7.5s tail
  ring — the opposite intent). This fires in the exact same synchronous
  branch that snaps the black overlay div's opacity to 1 with
  `transition:"none"`, inside `advanceSingularityScene`'s
  collapsing→blackout transition — never split across two frames/
  effects, or the screen and the silence visibly disagree.
- **Pieces are moved by direct mesh mutation** (position/scale/
  quaternion), a new array (`t.singularity.collapseItems`) captured
  once at collapse start — deliberately NOT the chassis's `anim.current`
  (a single-slot, one-piece-at-a-time mechanism, wrong shape for ~10
  pieces converging at once). Because this bypasses the normal
  pieces-state render path, **nothing else restores piece transforms
  afterward** — the escape hatch (`teardownSingularityScene`) must
  explicitly copy every piece back to its captured base
  position/scale/quaternion, or they're left tiny and displaced. Found
  by actually taking a screenshot after Escape and looking at it, not
  by the phase-transition assertions alone — a real lesson: this
  feature's correctness lived in visual/manual checks Playwright's
  `data-*` assertions couldn't have caught (also true of the "black
  overlay never fades back down for the sphere phase" bug, and the
  "masthead/dock chrome still shows through the transparent overlay"
  bug — both only visible in an actual screenshot, both fixed here).
- **Masthead + dock chrome must be hidden explicitly.** The overlay div
  only covers the 3D canvas; the masthead/dock are separate DOM layers
  stacked above the canvas but below the overlay's own z-index, so once
  the black cutout fades transparent for the sphere reveal, they show
  through unless faded out too. `advanceSingularityScene` takes
  `chromeRefs` (`{titleWrapRef, cardRef}`, the same refs
  `mountAmbientEffects` already receives) and fades their opacity once
  per collapse start, restoring them in the escape hatch.
- **Test hooks** (Playwright can't read Three/Web-Audio internals):
  `data-singularity-phase` on the overlay root; `window.__EC_TEST_MASTER_GAIN__`
  mirroring the real `master.gain.value`, written at every place it
  changes; `window.__EC_TEST_SINGULARITY__.sphereRotationY` for the
  drag-rotate assertion. See `tests/e2e-singularity.mjs`.
- **No longer accurate, kept for history**: the line below used to say
  the sphere carried only placeholder DOM text. That's since been
  replaced by a real UV-mapped, raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — see §3d.
- ~~Deliberately out of scope, per an explicit decision recorded in
  SINGULARITY_DESIGN.md: the sphere's surface is simple placeholder
  DOM text, not the real UV-mapped/raycast-hit-testable MATTER/LAWS/
  TOPOLOGIES menu — those rules systems don't exist yet.~~

