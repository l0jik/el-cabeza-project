/* Runs findBestAiTurn on a dedicated Worker thread instead of the main
   one. This file is bundled SEPARATELY from the app (see build/build.js)
   and its output text is embedded in the final HTML as inert script
   text (id="ai-worker-src") that chassis/ElCabeza3D.jsx turns into a
   real Worker via a Blob URL at runtime — the whole app still ships as
   one self-contained HTML file, no second network request for a
   worker.js.

   Pure engine code only (no React, no Three.js, no DOM) is ever
   imported here, matching the rest of engine/ — a Worker's global scope
   has no `window`/`document` at all, so anything reaching for either
   would throw immediately. */
import { findBestAiTurn } from "./ai.js";
import { setBoardDimensions, setActiveLaws } from "./constants.js";

self.onmessage = async (event) => {
  const { requestId, pieces, aiPlayer, config, cabezaStreak, turnIndex, board, laws } = event.data;
  try {
    /* A Worker has its own module instance of constants.js, so the main
       thread's setBoardDimensions() never reached it — without this the
       search would evaluate every position against a 10x10 board no
       matter what size is actually being played, silently generating
       illegal moves (or missing legal ones) near the real edges. Applied
       per request rather than once at startup because this same worker
       is reused across games, and a New Game can change the board. */
    if (board) setBoardDimensions(board.rows, board.cols);
    // Same cross-boundary problem, same fix, for SINGULARITY_DESIGN.md's
    // LAWS — without this the worker's own maxStepsFor/generateTurns
    // would search against every law being off even when e.g. "3
    // Actions Per Turn" is active, silently under-using a real budget.
    if (laws) setActiveLaws(laws);
    const turn = await findBestAiTurn(pieces, aiPlayer, config, cabezaStreak, turnIndex);
    self.postMessage({ requestId, turn });
  } catch (err) {
    self.postMessage({ requestId, error: (err && err.message) || String(err) });
  }
};
