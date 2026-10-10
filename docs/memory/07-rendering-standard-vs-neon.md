## 7. Rendering: Standard vs. Neon piece techniques (genuinely different, not parameterized)

- **Standard**: opaque `MeshStandardMaterial` body + an inflated
  back-face silhouette shell (grown by `OUTLINE_T`, rendered `BackSide`)
  for the outline; its floor sits `SHELL_LIFT` above the board, not flush
  (see "Tienda piece-base outline flicker"). Since the den, Standard and Tienda build their board
  and pieces from the same code, themes/wood-set.js (walnut and olive ash,
  see "Standard: the den" below).
- **Neon**: translucent body (`depthWrite: false`, deliberately — avoids
  a self-z-fighting bug on beveled edges) + a traced `EdgesGeometry`
  outline on a simplified sharp-cornered proxy. Trade-off, not an
  oversight: translucent pieces sort by draw order rather than true depth
  at grazing camera angles, which is *why* max pitch is capped at 1.25
  rad (§5) rather than fixed at the rendering level. The dock preview's
  spinning piece additionally needed a **depth-only pre-pass mesh** (real
  depth, no color) so its outline shell occludes correctly — without it,
  the translucent body's near and far edges both render at once,
  reading as a "trapezoidal double image." If a similar double-image
  artifact appears anywhere else Neon renders a tumbling/spinning piece,
  this is the fix to reapply.

Board-edge outline ring (the thin line around the slab) took **three
attempts** before the real fix: (1) small Y offset → foreshortens into a
visibly floating line at grazing angles; (2) `depthTest: false` →
draws over pieces at ordinary angles (worse trade); (3, kept) a thin
quad-frame **Mesh** (not a Line) with a hardware `polygonOffsetUnits`
depth bias, zero geometric Y offset, full depth testing.
`LineBasicMaterial`'s `polygonOffset` is a **silent no-op in WebGL**
(only `GL_POLYGON_OFFSET_FILL` exists) — this is why both earlier
Line-based attempts were structurally doomed. Don't attempt a
Line-based fix for board-edge z-fighting again.

