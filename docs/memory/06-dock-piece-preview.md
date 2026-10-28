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

Rings and the Fan, and the wheel (2026-10-28; user: "I'm still going to
have a fan, right? I'm still with the fans. I want to combine rings and
fans. make sure that the rings and all that can be scrolled by rolling a
mouse wheel too."). Rings is the fourth version's second revision (a
fan); now it also opens as the lab's first Fan did ("Wedges open over
the piece like a fan"): `unfold: true` on 4.2 only (the lab's other four
open as before). mountFan's opening for it: `openOut(delay)` sets
`unfold.t0`; render() draws each setting at focus + (angle − focus) ×
`opened(angle).at` (a springy ease, a little past and back), grown about
the hub from 0.7 and faded in, each 1.8 ms per degree from the point
later (the middle first); the kinds (`foldKinds`, data-mid on each) 70 ms
ahead; the place-marks' track and thumb open with the edge. Where it's
going names the focus at once; a touch, wheel or key during it
(stop() → openNow()) opens it at once. Reduced motion or a re-lay: no
opening. The wheel (one window listener per fan, passive: false): a run
is wheel events less than 70 ms apart by e.timeStamp (when each was made,
so a busy page doesn't split a trackpad's stream); deltas in px (lines
×33, pages ×600), the larger axis; a run turns round(total / 100)
settings, at least one once past 3 px (a Mac's smooth wheel, Firefox's
line notch), from where it was going (`aim`, turnTo's target, while a
turn's under way) else the nearest; over Rings' inner ring a notch is a
kind (each kind's first setting, `kindsFrom`); Ctrl (a pinch) never
turns it. Every fan: 4.1–4.5 a setting a notch (Pages a page). The
tour's "Turn it" on a computer names the wheel. Wedges carry
data-mf-of (their kind). Tests: e2e-rings (opening folded at −90°, then
spread over 170°+; a notch, back, a small roll, a line notch, three
quick, a 200 px stream, Ctrl, the inner ring by kind).

Rings' fixes from play in Futuris (2026-10-28, user screenshots). (1)
Anomaly closed Rings ("when you click anomaly, it closes the menu and
immediately starts... It should just keep the menu open"): the buttons
beside Begin are read as "open" (the store's See the pieces opens the
catalog), so Rings closed first; a button that changes things in place
now says so with data-dock-stay (Futuris's Anomaly, data-testid
futuris-anomaly; Cromo's stone), read as an action that keeps the fan
out, and data-dock-said is its word after ("A new layout. Tap again for
another."). (2) Who's who in play ("When I open this menu mid-game, I
want to know who I am. If it says photon... it has to be either dark or
light... I need to know what level the AI is set to... when you hit
game, that has to be something where it immediately shows you that
information"): readDock in play rebuilds the header's "{side} to move"
with the side's colour (host.sideLabel: the world's hint, "Photon
(dark)"), adds `sub` under it ("You: Photon (dark) · Computer: Hard";
online "· Online"; menu-fan-sub), and a first Game setting `you` (type
info: a tap says it again, nothing pressed; its value may wrap, mf-two)
whose read-out says it whole ("You play Photon (dark). The computer plays
Plasma (light), on Hard."; two players: "Players", "Two players, one
screen: ..."). Rings opens on it in play, and Game turns to it. The host
lends you() (youSide), level() (AI_DIFFICULTY label) and sideLabel().
(3) Hold to end's words ("Keep holding to end your turn") sat under the
ring, under a finger ("you can't read anything"): for a touch they go
over the ring now (data-over, unless there's no room above), kept on the
screen at the sides (a ref nudges them in); a mouse keeps them under.
Asked about left and right hands (user: "it should be taken into
consideration whether somebody is left-handed or right-handed, so maybe
put it above the piece?"): above the piece is the one place neither hand
covers (the hand comes from below, either side), so no handedness
setting.
Tests: e2e-rings (who's who and Game, Futuris's Anomaly), e2e-hold-to-end
(the phone's words over the ring).

The actions bar names the side with its colour (2026-10-28; user: "add
(dark) to the Photon · Actions bar too"): the points counter's
points-side is the side's name plus, where the world's names don't say
it (side-names.js hint), " (dark)" in .ec-pts-hint: beside the name on a
wide screen ("Photon (dark) · Actions"), and under 600 px wide small
under the name, out of the row's flow (absolute), so the row keeps the
width it had and stays clear of the corner piece and the full-screen
button (beside it, Spanish City's "Pizarra (gris azulado) · Acciones"
ran into both on a 360 px phone); the phone bar's side buttons put it
under the name the same way. Test: e2e-costs (Photon (dark), desktop).

Rings' line over the lit kind (2026-10-28; user, with a phone screenshot
of Rings in the den before a game, Board lit and the place-marks' thumb
running from Opponent over Level to Start, circled: "I like what you're doing here, but this line is not exact. It needs to only span the specific wedges that pertain to that piece. And maybe it needs to be slightly thicker or glow or something. I don't know. It's maybe give it that blue glow outline. This just needs to be tightened up a bit, because we need to have, it needs to be clearer as to what is being indicated here."). The thumb
was a scrollbar (the window's share of the whole round, placed by the
turn), so it ran across kinds. Rings (v.kinds) has no place-marks now;
groupLine() in render() draws a line along the outer edge of the lit
kind's settings in sight, edge to edge as they're drawn (each wedge's
drawn angle ± (span/2 − 1); the window's ends cut it, as they cut the
ring; opening, it grows and fades in with them): 3.5 px #b4f0ff, round
ends pulled in by their own reach, at r1 + 2.5, over a glow band (r1 to
r1 + GROUP_GLOW 16) filled with a radial gradient on the hub (#66d9ff
.62 → .3, #8c6eff .12 → 0: the Singularity's blue of tienda-overlay's
glow), no SVG filter (cheap on phones). The lit kind on the inner ring
is edged in the same blue (.mf-kind.mf-on path stroke #9be9ff 1.6), so
which piece the line belongs to reads at once. [data-mf-group] carries
the kind and data-a0/a1. The lab's other fans keep their place-marks.
Test: e2e-rings (store, phone: over Game's settings only, edge to edge,
clear of the rest; the blue, the lit kind's edge, no place-marks; turned
on to Start, over Board's from Start, no others).

Rings' kind names along their pieces (2026-10-28; user, with a phone
screenshot, SETTINGS circled where its straight-set word ran out of its
slanted piece: "Perhaps the text in the inner brown wheels, or whatever color it is, the darker ones, can be arced or arched to where they fit into the button better. The one that's circled in red, you can see that it's just sticking out. It doesn't look right, so we need to come up with more. We need to finesse that to make it look better. I'm thinking maybe try arcing it in there. Maybe make those in bold, perhaps."). Each kind's name is a textPath on its own arc
(a <defs> path inside the kind's g, data-mf-arc, after the piece's
sector so `[data-mf-kind] path` is still the sector) through the piece's
middle, centred (startOffset 50%, text-anchor middle), reading clockwise
over the top, the letters standing out from the hub; all bold now (the
lit one full strength, the rest .78). nameKind measures the name set
straight (the textPath taken out for it), fits it to the piece's arc
less 3 px each end (letter-spacing .12em, then .02em, then smaller, 6.5 px
at least: Configuración comes to 6.51 px), then sets the arc at the
ring's middle less 0.35 × the size, so the capitals' middle is on the
ring's middle; text dominant-baseline alphabetic (no central, which
Safari doesn't keep on a textPath). Kind g's carry data-a0/a1; the svg
data-hub. Test: e2e-rings (each name's first and last letter inside its
piece by angle round the hub and between 62 and 100 px out, bold; in
English and in Spanish).

A world's own settings in Rings (2026-10-28; user, a Cromo game on a
phone: "I want to be able to change the board in this on Chromo, because
I don't know where you select what material you're playing on the
playing surface. It's not obvious. So if I want to switch it mid-game, I
should be able to do that somehow."). Cromo's stone (Tungsten, Shungite)
was only the setup's button beside Begin, read by Rings as a bare
"Tungsten" action and gone once a game began. Now a theme may export
dockSettings({ phase, audio }) -> items as readDock makes them (key,
kind, type, name, value, tip, icon, choices); the host hands them over
(host.worldSettings) and readDock adds them in every phase. Cromo's:
Board > Surface (icon "surface", a ruled slab), a choice of the two; a
pick re-dresses the board where it is (setStone, its scene listener) and
strikes the stone (audio.playStone), Rings staying out. The setup's own
button now says "Surface: Tungsten" and follows a change made elsewhere
(cromo.js stoneWatchers, useSetupExtras subscribed); it carries
data-dock-skip, which readDock's beside-Begin read passes over, so the
setting isn't there twice. The phone bar's menu (MobileShell pageItems)
has each world choice setting as a row, "Surface: Tungsten", "Change to
Shungite". Test: tests/e2e-cromo.mjs.
