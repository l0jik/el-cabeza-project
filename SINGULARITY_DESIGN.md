# Cabeza [the_system] — Singularity design spec

**Status: mostly planning still, but Part 1's trigger, cinematic
transition, and the discovery gesture that leads into it are now BUILT
and shipped** — see the status note under Part 1 below for exactly what
exists. MATTER/LAWS/TOPOLOGIES' actual rules content remains
unimplemented (TOPOLOGIES' own board-size parameterization is the one
exception — see its own status note further down). This document
predates all of it, so cross-check anything load-bearing against
`PROJECT_MEMORY.md` and the actual code before building further.

## What this is

A third path alongside Standard and Neon, reached the same way both of
those are reached today — through the same chassis+theme architecture
(`ARCHITECTURE.md`) — but discovered rather than offered. The product
philosophy, stated directly: Standard is the on-ramp, Neon is the fuller
game, Singularity is the reward for a player patient/curious enough to go
looking for it — "the ultimate version," for players who want to extract
the most out of the game. It stays a **secret**, found the same way
Neon's existing Anomaly→Singularity reveal already works today — this is
not a visible, permanent menu option.

Two halves: **Singularity** (the trigger + cinematic transition into a
menu) and **MATTER / LAWS / TOPOLOGIES** (the actual new mechanics that
menu configures).

## Part 1 — Singularity: trigger and transition

### Trigger — one continuous hold gesture, no separate click

Discovery and commitment are the same gesture, deepening as you hold —
this was chosen deliberately over hover-then-click because hover doesn't
exist on touch, and this project is heavily mobile-tested:

1. Hold the Anomaly button ~4.5s (existing mechanic, unchanged) →
   Singularity phantom-reveals (existing).
2. Keep holding, now on the revealed Singularity button itself → at 2s, a
   low multiphonic LFO-like hum begins and builds in intensity.
3. Keep holding further → once the hum's climb reaches its own threshold,
   the collapse animation (Part 1 below) commits and begins automatically.
4. Release before that threshold → no separate "cancel" sound. The hum's
   own reverb tail decays naturally on its own, however much reverb had
   built up by that point — implemented as a real reverb send whose wet
   mix grows across the hold (not just volume/pitch), so "let go early =
   short dry tail, hold almost to commit = long rich tail" falls out of
   just stopping the dry oscillators and letting the reverb node ring out
   naturally, rather than a hand-authored decay curve.
5. A plain tap/click (not held) on the revealed button is a no-op — no
   separate "open info popup" action anymore; holding fully replaces the
   old click-to-open-popup behavior.
6. Clicking elsewhere while the button is revealed but untouched dismisses
   it immediately (rather than waiting out the existing 10s auto-hide
   timer), with its own new one-off sound: a highly reverberated, slightly
   discordant radar-ping — distinct from every other UI sound in the app.

### Phase 1 — Collapse (visual target: reference image "3", the
composited piece+grid image)

Board and pieces stay fully recognizable and rigid — no per-piece mesh
deformation. The grid/floor plane warps into a funnel toward a central
point (a vertex-shader warp on the shared grid/floor mesh, not a
deformation of every individual piece's own geometry — much more
tractable than literal per-piece "gravitational lensing," and the
reference image itself shows rigid pieces riding a warping surface, not
melting pieces). Violet/cyan energy streaks curl around the forming
throat. Pieces get simple rigid transforms (translate/scale down/slight
tumble toward center) as they're pulled toward the collapse, riding the
warping grid rather than deforming themselves.

### Deeper collapse (visual target: reference image "2", the wireframe
wormhole funnel)

Pulled in further — grid is now a full wireframe wormhole throat, palette
cools to a more uniform blue, streaks tighten into orbit around a much
darker, narrower center. This is the "progressively pulled into darkness"
beat right before the hard cut.

### Phase 2 — Event horizon / hard cut

Screen goes to pure black. The hum/reverb builds continuously through the
whole collapse. **The instant the black screen is established: audio cuts
to absolute silence — sudden, jarring, deliberate.** Silence holds
through the entire menu; there is no persistent ambient loop for the
Singularity menu. Audio only returns once all selections are made and a
game has actually begun.

### Phase 3 — the menu IS a black sphere (visual target: reference image
"1", the calm starfield black hole)

The black circle in that reference image is not backdrop — it's the
literal object. What was the event horizon becomes a real, interactive,
draggable 3D sphere sitting in a starfield. Its thin soft halo is the
sphere's own **rim/Fresnel-light shader term** — not a separate flat ring
asset to build and align by hand; a Fresnel term on a sphere naturally
produces a thin bright edge-glow at grazing angles, which is exactly what
a "photon ring" (the precise astrophysical term the halo represents,
distinct from a broad accretion-disk glow) should look like.

- **After the transition settles, the halo becomes a subtly pulsing
  "photon ring"** — slow, breathing intensity oscillation on the rim
  shader's own uniform (same "breathing" feel as Neon's existing turn-halo
  pulse, just driven by a shader uniform instead of a CSS custom property,
  since this is a real 3D object, not DOM).
- **The overall mood once settled: peaceful, almost trance-like** — calm,
  legible, doesn't fight with the text. The "intensely luminous, turbulent
  plasma" language from the original brief describes the *transition
  moment*, not the resting menu state.
- **MATTER / LAWS / TOPOLOGIES are texture-mapped onto the sphere's
  actual surface**, each with a checkbox, in a ghost-like, futuristic,
  highly legible font. As the sphere rotates (a real draggable 3D object,
  not a flat overlay), the text visibly distorts — perspective, polar
  compression, pinching, curvature — because it's genuinely wrapped to
  the surface (a canvas-texture UV-mapped onto real sphere geometry,
  raycasting back to UV coordinates for hit-testing), the same way text
  wrapped on a rotating globe behaves. Not yet designed: the exact
  rotation-drag interaction (a natural candidate is reusing the existing
  drag-imparts-angular-velocity-decaying-to-idle pattern already built for
  the dock's spinning piece preview, applied to the sphere instead of the
  camera).

**STATUS: Part 1's trigger and transition are BUILT and shipped** — the
hold gesture, the collapse (a real vertex-shader-warped grid mesh pulling
into a wormhole funnel, energy streaks, rigid per-piece translate/scale/
tumble toward center, palette cooling through "deeper collapse"), the
hard silent cut to black (screen and audio land on the same frame, via a
new `cutSingularityAudioToSilence` that zeros the shared master gain
node), and Phase 3's sphere (a real `ShaderMaterial` Fresnel rim/"photon
ring" term with a breathing pulse uniform, a `THREE.Points` starfield,
and drag-rotate physics ported from the dock-piece pattern — decaying to
a still, calm rest rather than a continuous wander) all exist in
`themes/neon-singularity.js`, wired into `themes/neon.js` at the
`commitSingularity`/`useSetupExtras`/`renderExtraOverlays` seams. See
`PROJECT_MEMORY.md` for the exact architecture (the `three.current`
bridge object that lets a React hook trigger animation living inside the
chassis's per-frame tick).

**Deliberately out of scope for this pass, per an explicit scope
decision**: the sphere's surface carries simple placeholder DOM text
(the same "not yet playable" message the old info-popup placeholder
used) rather than the real UV-mapped, checkbox-driven, canvas-texture
MATTER/LAWS/TOPOLOGIES menu described above — those rules systems don't
exist yet, so real interactive menu content on the sphere would be inert
regardless. The escape hatch (Escape key, or an on-screen "Back" button
for touch) exits back to the normal setup screen; there is no real
"selections made, game begins" path yet, since there's nothing to select.

## Part 2 — MATTER, LAWS, TOPOLOGIES

### MATTER — new piece types

Four new polycube types, joining the existing five (Cabeza, Chato, Flaco,
Opa, Turrito):
- An L-shaped pentomino (5 unit cubes).
- A 1×3 block.
- A 2×3 block.
- An arch (a non-convex shape with a genuine hollow/void — see the
  collision rule below).

**Rolling is allowed for every piece, irregular or not — physical
plausibility doesn't matter here ("we're in the singularity"). The one
hard constraint: a roll must land square-aligned**, a clean whole-cell
footprint, never resting at an angle. Practically, this becomes an
enumeration rule at the data level: for the classic five, an "orientation"
is a `{w,h}` rectangle (already how `PIECE_ORIENTATIONS` works today —
see `themes/neon.js`). For an irregular piece, each orientation instead
needs its own **footprint mask** (which specific cells it actually
covers, since an L-shape or arch's footprint isn't a filled rectangle) —
orientations that wouldn't land squarely simply never get enumerated as
options at all. This is a generalization of the existing system
(rectangular footprint → arbitrary cell-mask footprint), not a physics
engine.

**Collision during a roll**, worked out via a "single Turrito hugged by a
lying-down arch" test case: for a box-shaped piece (all five originals,
plus the new 1×3 and 2×3), collision is already fully solved today for
free — `rollBlock`'s math always lands the new footprint edge-to-edge
against the old one (a rigid box's ground footprint during a tip-over
rotation is always contained in the union of its before/after footprints,
by construction), so checking only the destination (what
`evaluateBlockLanding` already does) already **is** the path check. For
the two non-convex pieces (L-pentomino, arch), the rule is: **check the
piece's actual solid cells (not its bounding rectangle) against the
specific pivot edge that roll direction uses.** A hollow in the shape
only protects whatever's resting inside it from roll directions whose
pivot edge doesn't sweep solid material back over that cell — the same
piece, same obstacle, can have one roll direction blocked and the
opposite direction clear.

**Custom piece rosters**: a player can specify their own piece complement
instead of the fixed original five — e.g. all originals plus an extra
Turrito, or three Chatos only. **Symmetric only** — whatever roster you
build, your opponent gets the identical set. **Reuses the existing
Anomaly mechanic** as the layout generator: Anomaly already does random,
occupancy-checked, non-overlapping placement rather than a fixed
hardcoded layout, so extending it to place an arbitrary roster on an
arbitrary board is the same mechanism, not a new one. No separate
"confirm layout" UI needed — tap Anomaly repeatedly until a desirable
starting configuration appears, same interaction as today, and whatever's
showing when Begin Game is pressed is what's used.

**Roster caps**: at least 1 Cabeza required per side, up to 2 allowed.
Maximum 10 pieces per side total — chosen specifically because AI search
cost scales with branching factor (piece count), not board size, and
today's fixed five-a-side is already tuned against real depth/time
budgets (up to 4.3s at Hard difficulty). Board size, by contrast, barely
affects AI cost, since pieces move by rolling, not by scanning the grid.

**Win condition with 2 Cabezas**: reaching the opposite end with *either*
Cabeza is an instant win, regardless of whether the player's second
Cabeza has survived or even moved. Crushing is asymmetric with this:
crushing one of a player's two Cabezas does **not** end the game — only
crushing **both** (i.e. the last one) ends it as a loss. This makes a
2-Cabeza roster meaningfully stronger than a 1-Cabeza one (harder to
eliminate by crushing, no extra cost to winning by advancing) — noted
explicitly as an accepted asymmetry, not something flagged for balancing,
consistent with this mode's whole "modular chaos over tournament balance"
spirit. No engine change needed for the crush check itself — it already
keys on "is this occupant type `cabeza` and does it belong to the
opponent," not "is this their only one"; the only new logic is one level
up, at "don't end the game on a crush unless it was the last one."

### LAWS — five independent toggles, in their own overlay reached from
the sphere

1. **Split Movement** — divide a turn's action-point bank across more than
   one piece instead of committing it all to one. The bank is the whole
   turn's points (2 normally, 3 with "3 Actions"); with this law on, those
   points may be spent across up to **two distinct pieces** (`MAX_PIECES_PER_TURN`),
   never more, however many points the bank holds. The classic case is a
   3-point turn where an **Opa rolls for two points and a different piece
   then rolls for the last one** — the leftover point an Opa move always
   leaves (see "3 Actions"). Every move still costs what it normally costs
   (roll 1, slide 2, Opa move 2), and committing the whole bank to a single
   piece stays legal — splitting is an option, not an obligation. **Status:
   implemented for the human player** (`turnContinues` in `engine/rules.js`
   is the shared decision; the chassis lets the player select a second
   eligible piece mid-turn while the bank has a point and the 2-piece cap
   isn't reached). The **AI plays legal single-piece turns** under this law
   — committing its bank to one piece, always a legal option — and does not
   yet proactively split; teaching the AI's turn generator to spend the
   bank across two pieces is a follow-up (its combinatorial cost in the deep
   search is why it's staged separately).
2. **Slide** — move one open adjacent square without rolling/reorienting.
   Costs **two action points** (a roll costs one). So in a normal 2-point
   turn a slide spends the whole turn, and with "3 Actions Per Turn" (a
   3-point turn) it leaves exactly one point — room for a single follow-up
   roll ("a slide and an additional roll"). A piece can only slide when it
   has at least two points left this turn. Opa has the same 2/3-point
   budget as everything else, so it can slide in a plain Slide game too —
   but note an Opa MOVE (roll or slide) itself costs two points (see "3
   Actions" below), which is a whole 2-point turn, so an Opa slide always
   ends its turn. Available to every piece, old and new, once enabled (not
   restricted to irregular pieces).
3. **Black Hole Squares** — one or two obstacle squares, placed fairly:
   a single one must sit at the exact board center; two must be placed
   at rotationally-symmetric locations relative to each other. A single
   black hole is a pure static obstacle — impassable, route around it.
   **Two black holes form a linked wormhole**: entering one (spending an
   action point) is a real move whose "destination" is the *other* black
   hole's square, evaluated under the **exact same landing-legality check
   every other move already uses** — empty destination = legal and you're
   teleported there; occupied by a lone enemy Cabeza = legal as a crush
   ONLY when a block is entering (a Cabeza can never crush another Cabeza,
   so a Cabeza whose ejection square holds an enemy Cabeza simply can't
   enter that wormhole); occupied by anything else = illegal, and the game
   blocks you from entering in the first place (no partial/failed-entry
   state). Landing
   legally ends the piece's turn immediately regardless of leftover
   movement points. This needs zero new occupancy-handling logic — it's
   the existing `evaluateBlockLanding` function called with the paired
   square as the candidate.
4. **Cantilever Pivot** — a piece resting in an orientation where only
   ONE cell is planted on the ground and the rest of its body is
   cantilevered over open space (something only the new irregular pieces
   can do — a box always rests with its whole footprint on the ground)
   may pivot in place around that planted cell, swinging its overhang to
   face a new heading. 90° costs 1 action point; 180° costs 2. **The
   swept arm is checked for collisions** — a 180° swing can go via either
   adjacent quarter to reach the opposite heading, and **the player
   chooses which way**, via a visible directional cue on both platforms:
   a pair of curved arrows, tappable on both desktop (as the actual click
   target) and mobile (in addition to a raw swipe gesture). The gesture
   must be disambiguated from the existing camera-orbit drag the same way
   the game already disambiguates Undo-Move (drag the just-moved piece
   back) and Stop-Here (tap it) from ordinary board drags: it only
   registers as a pivot gesture if it starts on the cantilevered piece
   itself while it's actually in a pivot-eligible resting state; anywhere
   else on the board, a drag still just orbits the camera as always. This
   needs a genuinely new orientation concept beyond the flat-footprint
   model used everywhere else: "which one cell is grounded" plus "which
   cells are occupied in the air above adjacent squares" — a second kind
   of orientation entry, not an extension of the flat-footprint kind.
5. **3 Actions Per Turn** — raises every piece's per-turn action-point
   budget from 2 to 3 (`PIECE_META.maxSteps` + 1), uniformly, Opa included.
   Costs: a roll or Cabeza step is 1 point, a Slide is 2, and **an Opa
   move (roll OR slide) is 2** — because the 2×2×2 cube already covers two
   squares in one physical roll (`rollBlock` moves it by its own width), so
   its move is worth two points. Since `legalMovesFor` offers an Opa no
   move when fewer than two points remain, an Opa never moves more than
   once in a turn even on a 3-point budget (its second move is never
   affordable); the leftover point after an Opa move belongs to a
   *different* piece — which requires **Split Movement** (below) to spend.

### TOPOLOGIES — flat board, deliberately bounded

Configurable board dimensions beyond the fixed 10×10 (e.g. 10×11, 9×12),
**capped at 20×20 maximum**.

**STATUS: the engine-side parameterization is BUILT and shipped** — this
is the one part of this document that is no longer just a plan. See
`PROJECT_MEMORY.md` §3b for what actually exists: `BOARD_ROWS`/
`BOARD_COLS` with `setBoardDimensions()`, axis-split geometry
(`OFF_X/Z`, `SLAB_X/Z`, `GRID_EXTENT_X/Z`), a board-scaled zoom ceiling,
worker dimension passing, a parametric starting layout, and tests at
non-square and maximum sizes. `SQUARE_SIZE` became a true constant, so a
bigger board is a physically bigger plate rather than smaller squares.

**The sphere's TOPOLOGIES menu now applies for real.** The rows/cols
drums feed `finalizeSingularityBegin`, which calls the chassis's
`applyBoardResize(rows, cols)` at Begin Game (before the roster/holes are
placed). This is an in-place resize, not the boot-time
`apps/boardBootstrap.js` seam: `setBoardDimensions` updates the live
engine bindings and `three.current.resizeBoardPlate` rebuilds only the 3D
plate (slab/edges/top-ring/grid, by name) plus a rescaled shadow frustum;
everything else (piece placement, picking, camera fit) already reads the
live bindings. New Game restores the boot size. **Still open:** the
non-rectangular shape idea below.

Non-rectangular board shapes were raised as an idea but **explicitly left
unresolved** — the user hasn't figured out what that would look like yet.
Not blocking; revisit whenever there's a concrete idea to evaluate.

### Explicitly banked for later: the 3D rotatable cube

Raised and seriously discussed: a fully 3D board where pieces roll across
the faces of a rotatable cube, not just a bigger/differently-shaped flat
grid. **Deliberately deferred, not rejected** — the user's own call, after
a candid technical assessment that this is a different order of
magnitude from flat-board TOPOLOGIES:
- The board stops being one coordinate space — a piece rolling off one
  face onto an adjacent face needs its own "forward" direction
  re-expressed in that face's coordinate system (solvable, well-trodden
  in other games' "walk on a cube" mechanics, but a real coordinate-
  transform system that doesn't exist anywhere in this engine today).
- **The camera is the biggest risk**, specifically because it's this
  project's most hard-won, extensively-tuned, repeatedly-fragile system
  (see `PROJECT_MEMORY.md` §5 and §11) — every existing guarantee (the
  50%/75% visibility clamps) assumes one flat, always-partially-visible
  thing. A cube has faces facing away from the camera by construction;
  there is no single viewpoint that sees the whole board. This needs real
  new interaction design (does the camera orbit the whole object with far
  faces simply not interactable, does the game also offer an unfolded
  flat "net" view, something else) before any engineering starts.
- The win condition ("reach the opponent's back row") and the AI's
  evaluation function (centrality, corridor gaps, wall pressure) both
  quietly assume a flat 2D grid and would need real redesign, not
  extension.

If this gets revisited: treat it as its own topology type built once the
flat version and the rest of Cabeza [the_system] already exist, not as
part of TOPOLOGIES' first version.

## What's still genuinely open

- **Cabeza [the_system]'s own visual identity for actual gameplay** —
  everything specified above is either the *transition into* the mode
  (Singularity's cinematic + sphere menu) or its *rules* (MATTER/LAWS/
  TOPOLOGIES). What the board, pieces, lighting, and ambient design
  actually look like once a match is underway — Standard's warm wood and
  Neon's cyberpunk-CRT both have a distinct visual identity; this mode's
  own in-game look hasn't been discussed at all yet.
- TOPOLOGIES' non-rectangular board shape idea (see above).
- Anything about how MATTER/LAWS/TOPOLOGIES toggle state is actually
  persisted/threaded through a match once chosen on the sphere — not
  discussed at the data-model level yet (this document describes the
  *rules*, not the state shape that would carry them through the chassis/
  engine).

## Implementation note

Nothing here has been scoped into phases yet. Given the size of this
spec, a real implementation pass should almost certainly start with a
phased plan (which piece is genuinely load-bearing to get first, e.g.
probably TOPOLOGIES' `BOARD_SIZE` parameterization before MATTER's new
piece types, since several MATTER/LAWS mechanics assume a working custom
board size) rather than attempting this as one pass — but no such phase
plan exists yet. That's the natural first step of an actual build
session, not something to infer from this document.
