# Too many pieces for the board: the pop-up

Asked for (user, 2026-10-25, a Vietnamese phone screenshot of the gate's
Cabeza Nova sheet in Lluvia's look, Play greyed): "If too many pieces are
selected to where you cannot click the start button at the bottom when
making your selections, there needs to be a pop-up, like with more like
calling attention to that, because it's hidden in just small text in a
certain part. It needs to be brought to the user's attention what the
situation is."

Each side starts in its two home rows, so the board's width limits the
pieces (rules-selections.js `piecesFit`, `minColsFor`; Futuris's own
`matterFits`, `matterMinCols`). Before this, a menu said so in one small
line under its pieces and greyed its Play.

## What it does (themes/fit-alert.js, every setup menu)

- **Comes up the moment a change stops the pieces fitting** (a + on a
  piece, a narrower board, squares marked in the home rows, a shuffled
  start), not when a menu opens with them already not fitting, and only on
  that change: more pieces after it don't bring it again. Goes when they
  fit (`useFitAlert(fits)`; Futuris, whose state isn't React's, tracks
  `fitWas` / `fitAlert` on its sphere state in renderSingularityOverlay).
- **And when Play is pressed while they don't fit.** Play (Begin the game,
  Place order, Begin Game) is greyed with `aria-disabled` but not
  `disabled`: a press answers with the pop-up. (Tests press it with
  `{ force: true }`: Playwright counts aria-disabled as not enabled.)
- **Says it plainly:** "Too many pieces for this board", the two widths
  side by side (Board width now → Width they need, the need in the
  warning colour), "N pieces a side won't fit in two home rows W squares
  wide" (or "... round the squares marked there", or "... even 20 squares
  wide"), "The game can't start until they fit."
- **Two ways out:** "Make the board N wide" (only when a wider board would
  do), and "Take some pieces out" (the gate and the store scroll to the
  pieces' line under the list and flash it; Lluvia and Futuris open
  MATTER). Escape, the × and a tap outside put it away.
- **The gate's sheet also says why by Play:** a line over Reset / Play,
  "Too many pieces for this board ›", that brings the pop-up.

## Where, and in whose look

| Menu | File | Look |
| --- | --- | --- |
| The gate's Cabeza Nova sheet (every reality after the story) | reality-gate.js | `fitLookOf(world)`: the world's gate look; the warning colour its accent, or where that's grey or white its own (`FIT_WARN`: Futuris and Cromo amber, Plano yellow pencil, Noir the HOTEL red, the City traffic red, Parrish brick) |
| The store's order form (also the story's guided order) | tienda-overlay.js | `STORE_FIT_LOOK`: the form's paper, Franklin, the store's red |
| Lluvia's city (MATTER / BEGIN THE GAME) | lluvia-overlay.js | `LLUVIA_FIT_LOOK`: the terminals' dark, Saira, amber buttons, red warning |
| Futuris's sphere (MATTER, the Begin Game summary) | futuris-singularity.js | `FUTURIS_FIT_LOOK`: the panels' dark glass, Chakra Petch, cyan, amber warning |

- It goes on the page itself (a portal) at z-index 2600, over every menu
  (the gate 1500, the store 1260, Futuris 2000, Lluvia 2100); its card is
  laid on black so a see-through surface never shows the menu's words.
- Its events stop at its edge (React's bubble through a portal would
  reach the sphere's drag, the store's backdrop). The guided order's
  window-level blocker lets it through (`OK` list) and its Escape guard
  steps aside while it's up; so does Futuris's first-visit Escape guard.

## Tests

e2e-gate (Cromo: the pop-up on the change, its widths and words, Escape,
no repeat, Play greyed but pressing it brings it, Take some pieces out
scrolls to the count, the line by Play, Make the board 11 wide),
e2e-tienda (both sizes), e2e-story (the guided order), e2e-lluvia
(MATTER, BEGIN, Take some out back to MATTER), e2e-singularity (MATTER).
The words are in both tables (b-20).
