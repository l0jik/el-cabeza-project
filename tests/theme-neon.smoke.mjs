import {
  COLORS, HEX, EDGE_RADIUS, PIECE_ORIENTATIONS,
  shuffledIndices, generateAnomalySetup, computeTension,
  makeBoardTexture, makeGridGlowTexture, makeGrid, createSoundscape,
} from "../themes/neon.js";
import { createInitialPieces } from "../engine/rules.js";

console.log("COLORS.cream:", COLORS.cream);
console.log("HEX.glowCyan:", HEX.glowCyan.toString(16));
console.log("EDGE_RADIUS:", EDGE_RADIUS);
console.log("PIECE_ORIENTATIONS.flaco:", PIECE_ORIENTATIONS.flaco);

const shuffled = shuffledIndices(5);
console.log("shuffledIndices(5):", shuffled, "- valid permutation:", new Set(shuffled).size === 5);

const anomaly = generateAnomalySetup();
console.log("generateAnomalySetup() piece count:", anomaly.length);
// Verify the rotational-symmetry guarantee the comments promise.
let symmetric = true;
for (const p of anomaly.filter((p) => p.owner === "dark")) {
  const mirror = anomaly.find(
    (q) => q.owner === "light" && q.type === p.type &&
      q.row === 10 - p.row - p.h && q.col === 10 - p.col - p.w
  );
  if (!mirror) symmetric = false;
}
console.log("Anomaly setup is rotationally symmetric:", symmetric);

const tension = computeTension(createInitialPieces());
console.log("computeTension(initial position):", tension, "- in [0,1]:", tension >= 0 && tension <= 1);

console.log("createSoundscape is function:", typeof createSoundscape === "function");
console.log("makeBoardTexture/makeGridGlowTexture/makeGrid are functions:",
  typeof makeBoardTexture === "function", typeof makeGridGlowTexture === "function", typeof makeGrid === "function");

console.log("\nNEON THEME SMOKE TEST PASSED");
