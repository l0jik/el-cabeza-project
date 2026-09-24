import { setBoardDimensions, getBoardDimensions, setActiveLaws } from "../engine/constants.js";

/* Applies a board size chosen OUTSIDE the React tree, before anything
   mounts — the seam between "something picked a board size" and the
   engine's own dimensions.

   It lives in apps/ rather than engine/ deliberately: engine modules are
   pure and must never touch `window` (a Worker's global scope has no
   `window` at all — see engine/ai-worker.js's header), so the one place
   allowed to read from the page is the app entry point.

   Today its only caller is the test suite, which sets window.__EC_BOARD__
   in an init script to exercise non-square and maximum-size boards in a
   real browser — the Node smoke tests can't reach the rendering path
   (textures, grid geometry, the slab mesh, raycast hit-testing), which is
   exactly where an X/Z mix-up would live. When TOPOLOGIES' own menu
   exists it becomes the real caller, passing the player's choice instead.
   Writes the applied (clamped) result back so a caller can see what
   actually took effect rather than what it asked for. */
export function applyBootstrapBoardSize() {
  if (typeof window === "undefined") return getBoardDimensions();
  const req = window.__EC_BOARD__;
  if (!req) return getBoardDimensions();
  const applied = setBoardDimensions(req.rows, req.cols);
  req.applied = applied;
  return applied;
}

/* Same seam, for LAWS: a test sets window.__EC_LAWS__ (e.g.
   { splitMovement: true }) in an init script to start a plain game with
   those laws active — how the suite drives the AI through a real Split
   Movement turn without walking the Singularity sphere. Unused otherwise. */
export function applyBootstrapLaws() {
  if (typeof window === "undefined" || !window.__EC_LAWS__) return;
  setActiveLaws(window.__EC_LAWS__);
}
