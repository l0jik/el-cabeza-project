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

The lab's fans (2026-10-27, chassis/menu-fan.js; user: "I want 4 Fan,
but I want to be able to spin / rotate the menu to access all settings,
ultimately, fully replacing the button dock. Give me 5 revisions of this
one"): versions 4.1 Dial, 4.2 Rings, 4.3 Rail, 4.4 Pages, 4.5 Corner,
spliced into the lab's list after 4 (VERSIONS' `n` is a string; the pick
is stored by n). Unlike the first ten they open in every phase (the lab's
`update` gets `phase`: setup, play, over): in play and after, the corner
piece's tap goes to the lab too, and `dockShift` either brings the piece
from its corner to the pre-game place (`centre: true`, drawn with the
pre-game geometry) or raises it where it is (`raise: true`, z 15,
opacity 1). `readDock(host, phase)` reads everything off the panel as
settings (toggle, choice, open, action; disabled when the panel holds
it back) with a header (turn status; after a game the caption) and the
one big button (Begin; New game); `prepareDock` first opens Next game's
picker after a game and, with the computer picked before one, re-clicks
it so the levels are in the panel. A setting pressed is the panel's own
button `.click()`ed; open ones (sound, saves, replay, the catalog, move
log) and actions (End turn, End game, the bar) close the fan first, the
cart's first tap and Plain rules keep it. The turning: ring-space angles
per setting, a turn offset, screen angle = focus + wrap(angle − turn);
cyclic when the round is longer than the window; drags follow the
finger's angle about the hub (an invisible grip band under the settings,
so a drag begun in a gap still turns), flicks project their speed,
settles to the nearest setting (Pages: page). Labels are HTML over the
SVG wedges, clipped to the same half (or quarter) as the wedges. On a
phone a finger drag got a pointercancel after its first move (the
browser's pan won: `touch-action: none` on the SVG shapes isn't kept), so
the fan barely turned; a document `touchstart` listener (passive: false,
added with the fan, removed with it) calls preventDefault for touches on
its wedges, grip, Rail stops and Rings' kinds. Found by the test's CDP
touch swipe (`Input.dispatchTouchEvent`), which a mouse drag can't show.
A touch during the spin-in stops it (its timer is the settle timer) and a
tap then lands it on the nearest setting first; the stage carries
data-turning while it spins, follows a finger or settles. Hooks
used by tests: data-testid menu-fan, menu-fan-read, menu-fan-prev/next,
menu-fan-primary, menu-fan-head, menu-fan-ctl (chips data-mf-choice),
data-ml-item / data-ml-label per setting, .mf-focus on the one at the
point, data-mf-kind on Rings' kinds, data-phase on the lab's layer.

Rings, the dock's menu everywhere (2026-10-28; user, of the five: "I like
rings."; asked what next: "Replace the dock everywhere (Recommended)").
4.2 Rings, out of the lab: in every world, on phones and computers, the
piece's tap before a game and the corner piece's in play and after (and
a held touch, and the mouse's hover) bring Rings out in place of the
panel. The panel stays mounted (faded) as the one source of every
setting, Rings pressing its buttons; it opens only for Online's own page
(Rings' Online choice: host.openPanel()) and for the lab's More.
menu-fan.js `fanMenu(host, { testid })` is the controller the lab and the
chassis share (open, close, toggle, update, isOpen, setShift, restAt,
moveRest, dispose): its layer `data-testid` "dock-menu" (the lab's
"menu-lab"), the backdrop `${testid}-back`, data-open, data-phase,
data-version; `dress(layer, host)` gives it the world's colours and the
panel's Begin's font, case and wood; `RINGS` is the version. The chassis
lazy-loads menu-fan.js at mount (ringsLoadRef; not with ?menulab, where
the lab has the tap) and `update({ ready, shell, phase })`s it: ready
while the dock isn't the panel, no setting out, no control bar, no
replay; a phase change or not ready closes it. `openDockMenu()` (the end
of triggerDockBounce): the lab if on, else Rings' toggle (still loading:
after the import), else the panel; `reopenDockMenu()` for the ways back
to the menu (cancelling setting out, the tour's back from the bar):
Rings again once it's ready (ringsAgainRef), or the panel if that's the
one the player last had out (lastMenuRef: Online's page, a test's). A touch held on the piece
opens the menu by the hover timer (0.5 s); its lift would have toggled it
shut, so the lift's tap is skipped when the hold opened it (dockHeldRef).
Online's page in the panel (picked from Rings, then put away): Rings'
Opponent says Online and its other choices press Back first (twice from
the join page); with a game hosted or joined they're held, Leave being
the page's own. The store's idle nudge lights Rings' Try a Game
(td-try-game) as it lights the panel's. In other languages: a kind's
name longer than its piece of the inner ring (Spanish CONFIGURACIÓN)
closes its letters up, then shrinks, to fit (nameKind, again on a
language change); the settings' value line (clipped for its ellipsis)
has room above and below for accents on capitals (FÁCIL, TIẾNG VIỆT). The first game's tour: its menu
step waits for Rings out (or the panel); "panel" on Rings is "Your menu
turns." (turn it, read it, change it; rings round the grip, the read-out
and the setting at the point: TOUR_RINGS_HOW), "foot" is "Four kinds of
setting." (the kinds ringed: TOUR_RINGS_KINDS); the card and its marks at
z 17 over Rings' layer (16) while it's out; Back, Skip and Got it put it
away. Tests: the panel's own tests open the panel through
`window.__EC_DOCK_PANEL__` (hooks on or not: many of them don't turn the
test hooks on; tests/dock-helpers.mjs openDockPanel and
reopenDockPanelFromCorner set it for their taps);
e2e-rings for Rings itself.
