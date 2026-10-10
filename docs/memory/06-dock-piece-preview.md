## 6. Dock / interactive piece preview

The bottom dock's idle element is a real 3D preview using the **same**
`theme.buildPieceVisual()` every board piece uses, at true per-type
relative size (`baseScale` is a **fixed constant** derived from the
single largest possible piece across all types — it must never be
renormalized per session to "fill a target size," which was tried and
silently erased the real size differences between piece types). Idle
meander spin; dragging imparts real angular velocity that decays back to
the meander; double-tap/click bounces and morphs into the settings panel;
Begin Game reverses the morph and relocates the piece to a small corner
watermark for the rest of the game (reopen via hover/hold there).

The pre-game click-to-open hitbox is a **per-piece-type proportional
fraction** of the frame — not the full canvas, not a fixed size — because
a square hit target still leaves real slack around an irregular rotating
3D silhouette. Calibrated by **measuring actual rendered pixels**
(WebGL canvas → 2D canvas `drawImage` → `getImageData` alpha bounding
box; must copy within the same `requestAnimationFrame` as the draw, since
this canvas has no `preserveDrawingBuffer` and the backbuffer is gone by
the next microtask) rather than guessing a multiplier — a first guess
(`HIT_TIGHTEN = 0.7`) was reported as still much too large; the measured
value is `HIT_TIGHTEN = 0.4`. If this is ever revisited, re-measure
pixels again rather than re-guess a number.

This hitbox restriction applies **only** to the pre-game deliberate
click-to-open gesture. The post-Begin-Game corner-watermark hover-to-open
gesture (1.6s hold) must stay unscoped by it — reusing the same
footprint-based hitbox there once broke small piece types intermittently
(the watermark is only 100×88px and semi-transparent, and a plain
centered hover could land outside the shrunk box for the smallest
pieces).

