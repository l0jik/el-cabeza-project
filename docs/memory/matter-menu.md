## MATTER menu: one list, 3D piece models (user request)

The 1×3 and 2×3 Blocks were on/off checkboxes (the first MATTER pieces);
every later piece got a count roller in a grid. Now every piece type is
the same row, in this order: Cabeza, Turrito, Flaco, Chato, Opa, 1×3
Block, 2×3 Block, Codo, Arco, Rayo, Zeta.
- **Row layout:** a 3D still (a button), the name with a one-line
  `detail`, and an inline `DrumRoller` (`inline: true`) on the right. The
  Arco's size choice sits directly under the Arco row. A "Pieces per
  side N of 10" line sits on top, with a note when the total is over 10
  (the extras are trimmed at game start).
- **Data model:** `MATTER_NEW_PIECES` and `selections.matter.newPieces`
  are gone. The blocks are `roster.block1x3` / `roster.block2x3` (0–4,
  default 0). `normalizeSelections` → `migrateRoster` turns an old saved
  ticked box into a count of 1. `buildRosterFromSelections` (neon.js)
  reads the counts.
- **Models** (`themes/piece-showcase.js`):
  - Each type in its first starting pose, built from the engine
    geometry: `makePolycubeSmooth` for odd pieces (one seamless solid)
    and rounded boxes otherwise.
  - Look: dark clear-coated glass, a painted studio environment, cyan
    edges, and a glow pool.
  - `ensureThumbs` renders all the stills in ONE short-lived WebGL
    context (released straight after); `pieceThumb(type)` returns them.
  - `PieceViewer` is the live model: it turns slowly (0.35 rad/s) and
    can be dragged, with some carry after release.
  - It opens from the still's own screen rectangle: a scale/translate
    transition to centre, frameless, over a `backdrop-filter: blur(9px)`
    scrim. It closes back into the still.
  - While the viewer is open, the still is emptied and ringed
    (`data-viewing`).
  - It closes on a tap outside or on Escape; the sphere's own Escape
    handler ignores Escape while `[data-testid="piece-viewer"]` exists.
  - Test hook: `window.__EC_PIECE_VIEWER__.yaw()`.
- Tests: e2e-singularity checks the 11 uniform rows, that the stills are
  images, the 1×3 count, and the viewer opening, turning, dragging and
  closing.

