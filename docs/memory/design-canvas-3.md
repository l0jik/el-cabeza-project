## Design canvas: third batch (ten 3D finishes)

On the Claude Design canvas (El Cabeza Redesigns), themes 11–20
(Prisma, Cromo, Arcilla, Taller, Mármol, Aurora, Horizonte, Circuito,
Sumi, Vacío) each have a Title and an In-game phone board.
- The board and pieces are real 3D from a shared renderer, `ec3d.js`
  (Three r128), uploaded to the canvas as an asset along with
  `three.min.js`. Source is in the session scratchpad
  (`redesign3d/ec3d.js`), not the repo.
- Each board renders once and releases its WebGL context; dragging
  re-opens a context to turn the board. This keeps a canvas of many
  boards under the browser's context limit.
- Changing the renderer means re-uploading it and repointing every
  board's `/_blob/<id>` script tag.

