/* Standard (the den) in Node: the theme module loads and has the chassis's
   shape. Its board, grid and pieces paint wood on a canvas (themes/wood-set.js),
   which needs a browser: tests/e2e-smoke.mjs and tests/e2e-den.mjs build them.
   Run with --import ./tests/asset-hooks.mjs (the den imports the box art). */
import * as standard from "../themes/standard.js";

let failures = 0;
const check = (label, cond, detail) => {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && detail ? " — " + detail : ""}`);
};

console.log("COLORS.cream:", standard.COLORS.cream);
console.log("HEX.charcoal:", standard.HEX.charcoal.toString(16));
console.log("EDGE_RADIUS:", standard.EDGE_RADIUS);
check("the palette's tokens are all set", ["cream", "creamAlt", "charcoal", "slate", "pageBg", "pageBgDeep", "bodyDark", "bodyLight"].every((k) => typeof standard.COLORS[k] === "string"));
check("no accentDark (the chassis reads that as a Neon-style theme)", !standard.COLORS.accentDark);
for (const fn of ["makeBoardTexture", "buildSlabMaterials", "makeGrid", "buildPieceVisual", "buildMoveIndicator", "buildMissingSquareVisual", "buildBlackHoleVisual", "sideSurface", "createAudio", "mountAmbientEffects"]) {
  check(`${fn} is a function`, typeof standard[fn] === "function");
}
check("the wood set is Tienda's (walnut and olive ash, with followGrain and woodSwatch)", typeof standard.woodSet.followGrain === "function" && typeof standard.woodSet.woodSwatch === "function");
const keys = standard.soundChannels.map((c) => c.key).join(",");
check(`sound channels: The room and Pieces (${keys})`, keys === "room,pieces");
check("an edge radius and an outline offset", standard.EDGE_RADIUS > 0 && standard.outlineYOffset > 0);

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nSTANDARD THEME SMOKE TEST PASSED");
