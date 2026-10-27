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

New Game straight on into the next (2026-10-27, chassis beginNextRef):
Retain Current Game Settings, in every world, and any New Game a world's
ambient asks for (`newGameBegins()`: the den with the hall on its way)
skip the setup: the piece stays in its corner (never the big one in the
middle), the title stays small, and a frame after the board's set up the
game begins as Begin would (Manual placement: the set-out first; online:
the host's Begin as ever). User: "the 3D floating piece should
immediately minimize and the game should be active".

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


The menu lab (2026-10-27, chassis/menu-lab.js; user: "Create 10 versions
fully functional in a lab outside of the chat"): with ?menulab (kept for
the tab in sessionStorage `el-cabeza:menu-lab`; ?menulab=N picks a
version, the last one looked at kept in localStorage
`el-cabeza:menu-lab-version`; ?menulab=0 or the bar's ✕ off) the chassis
lazy-loads the module, and before a game the piece's tap (the end of
triggerDockBounce, while awaitingBegin) goes to `lab.toggle()` instead of
opening the panel. Its menus never copy the game's state: every button
`.click()`s the panel's own (always mounted, only faded out): Begin
(`[data-dock-role="begin"]`), `[data-ec-diff]` or the `[data-opponent]`
picker, the buttons beside Begin (the store's See the pieces), the cart
(`story-purchase`), Standard/Manual; More is `setDockView("panel")`; the
panel's names (and languages) and its held-back buttons (disabled,
`data-first-lock`) read straight off it, again after each press. The
chassis tells it when it may (`update({ ready, shell })`: before a game,
dock view "piece", not setting out, not the control bar) and lends it the
piece's place (`dockShift` in dockPieceStyle: up to the middle for Ring
and Wedges, into the corner for Thumb). Its layers: a backdrop at z 14
(under the piece's 15, so the piece still takes a tap and closes it) and
the buttons at z 16; the bar at the top at 2000.
