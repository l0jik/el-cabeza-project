## 11. Fragile areas / edge cases to tread carefully around

- **Overlay text collisions in tests.** The Victory Placard, Move Log
  popup, and Info overlay are all **always mounted** (opacity/
  pointerEvents toggled, never conditionally rendered), and share
  similar button text ("Move Log", "Copy Move Log," etc.). This has
  caused real Playwright strict-mode ambiguity at least twice. New tests
  should scope by a stable `data-testid` ancestor, not text alone.
- `page.evaluate(() => el.click())` in tests bypasses real CSS
  pointer-events/visibility and can produce a false positive by matching
  a hidden element — this once masked a real self-introduced regression
  (a dock button that had actually been deleted). Prefer real
  `page.locator(...).click()`; reach for the programmatic-click
  workaround (needed for a known sandbox quirk where the full-viewport
  board canvas intercepts real clicks on some absolutely-positioned
  buttons) only alongside a scoped/exact-text selector check too.
- Any WebGL canvas pixel-readback in a test (dock hitbox measurement,
  future visual assertions) must copy into a 2D canvas **within the same
  `requestAnimationFrame`** as the draw — these canvases have no
  `preserveDrawingBuffer`.
- The masthead title is deliberately split into per-letter `<span>`s —
  several Neon effects (scanline `background-clip: text`, phosphor
  ghosting, per-letter flash/desync, raster tear) address individual
  glyphs and depend on this structure; don't collapse it back to a plain
  text node. At very small sizes (the relocated badge) the scanline's
  fixed-pixel stripe period can land entirely on a transparent band and
  make letters vanish — the relocated badge deliberately falls back to
  plain solid text via an `.ec-masthead-relocated` class hook; keep that
  escape hatch.
- Any CSS transform-*animating* class applied to the masthead's **outer**
  wrapper fights React's own inline transform on that same element (used
  for the setup→corner-badge position/scale transition) — glitch/jitter
  effects must animate a separate **inner** ref (`titleFxRef`), never the
  outer positioned wrapper, or a glitch pulse visibly snaps the corner
  badge to full size mid-game.
- The Neon dock-piece "trapezoidal double image" fix (§7's depth-only
  pre-pass) is currently only applied to the dock preview piece — if
  translucent pieces are ever rendered spinning/tumbling somewhere else,
  this same fix will likely be needed there too.

