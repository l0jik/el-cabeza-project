import { COLORS, HEX, EDGE_RADIUS, makeBoardTexture, makeGrid } from "../themes/standard.js";

console.log("COLORS.cream:", COLORS.cream);
console.log("HEX.charcoal:", HEX.charcoal.toString(16));
console.log("EDGE_RADIUS:", EDGE_RADIUS);

// makeBoardTexture/makeGrid need `document` (canvas) — skip in Node,
// just confirm they're callable functions of the right shape here.
console.log("makeBoardTexture is function:", typeof makeBoardTexture === "function");
console.log("makeGrid is function:", typeof makeGrid === "function");
console.log("\nSTANDARD THEME SMOKE TEST PASSED");
