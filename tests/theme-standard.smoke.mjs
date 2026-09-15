import { COLORS, HEX, EDGE_RADIUS, makeBoardTexture, makeGrid, buildPieceVisual } from "../themes/standard.js";
import { makeRoundedBox } from "../engine/geometry.js";

console.log("COLORS.cream:", COLORS.cream);
console.log("HEX.charcoal:", HEX.charcoal.toString(16));
console.log("EDGE_RADIUS:", EDGE_RADIUS);

// makeBoardTexture/makeGrid need `document` (canvas) — skip in Node,
// just confirm they're callable functions of the right shape here.
console.log("makeBoardTexture is function:", typeof makeBoardTexture === "function");
console.log("makeGrid is function:", typeof makeGrid === "function");

const geo = makeRoundedBox(0.8, 0.8, 1.6, EDGE_RADIUS);
const { mesh, shell } = buildPieceVisual({
  piece: { id: "dark-opa", w: 1, h: 1, z: 2, owner: "dark" },
  isDark: true,
  isDisc: false,
  geo,
  center: { x: 0, z: 0 },
  y: 0.8,
});
console.log("buildPieceVisual mesh/shell kinds:", mesh.userData.kind, shell.userData.kind);
console.log("mesh material opaque (transparent not set):", !mesh.material.transparent);

console.log("\nSTANDARD THEME SMOKE TEST PASSED");
