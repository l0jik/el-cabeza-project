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

self.onmessage = async (event) => {
  const { requestId, pieces, aiPlayer, config, cabezaStreak, turnIndex } = event.data;
  try {
    const turn = await findBestAiTurn(pieces, aiPlayer, config, cabezaStreak, turnIndex);
    self.postMessage({ requestId, turn });
  } catch (err) {
    self.postMessage({ requestId, error: (err && err.message) || String(err) });
  }
};
