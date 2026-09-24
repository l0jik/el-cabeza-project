import {
  COLORS, HEX, EDGE_RADIUS, PIECE_ORIENTATIONS,
  shuffledIndices, generateAnomalySetup, computeTension,
  makeBoardTexture, makeGridGlowTexture, makeGrid, createSoundscape,
  buildPieceVisual,
} from "../themes/neon.js";
import { createInitialPieces } from "../engine/rules.js";
import { parseVox, groundCellsOf, mirrorVox, piecesClash } from "../engine/shapes.js";
import { makeRoundedBox } from "../engine/geometry.js";

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
console.log("mesh material translucent (transparent=true):", mesh.material.transparent === true);
console.log("shell is EdgesGeometry-based LineSegments:", shell.geometry.type === "EdgesGeometry");

// A randomized opening never places a piece on a blocked square (Black
// Hole / Missing Square placements) or on its 180-degree mirror.
{
  const blocked = [{ row: 0, col: 3 }, { row: 1, col: 5 }];
  const mirrors = blocked.map((b) => ({ row: 9 - b.row, col: 9 - b.col }));
  const all = [...blocked, ...mirrors];
  for (let i = 0; i < 200; i++) {
    const ps = generateAnomalySetup(undefined, blocked);
    for (const p of ps) {
      for (const q of all) {
        if (q.row >= p.row && q.row < p.row + p.h && q.col >= p.col && q.col < p.col + p.w)
          throw new Error(`generateAnomalySetup put ${p.id} on blocked cell ${q.row},${q.col}`);
      }
    }
  }
  console.log("generateAnomalySetup avoids blocked cells (200 rolls): ok");
}

// The Codo (MATTER's 3-cube L) in a randomized opening: every copy
// carries its cubes, stays in its side's home rows, touches the board,
// and Light's copy is Dark's turned 180° — cubes included — so the
// opening stays rotationally symmetric. No two pieces share a cube.
{
  for (let i = 0; i < 200; i++) {
    const ps = generateAnomalySetup([{ type: "codo", count: 2 }, { type: "cabeza", count: 1 }, { type: "chato", count: 1 }]);
    const codos = ps.filter((p) => p.type === "codo");
    if (codos.length !== 4) throw new Error(`expected 4 Codos, got ${codos.length}`);
    for (const d of codos.filter((p) => p.owner === "dark")) {
      if (!d.vox || parseVox(d.vox).length !== 3) throw new Error(`Codo without its 3 cubes: ${JSON.stringify(d)}`);
      if (d.row + d.h > 2) throw new Error(`Dark Codo outside its home rows: ${JSON.stringify(d)}`);
      if (!groundCellsOf(d).length) throw new Error("a Codo must touch the board");
      const l = ps.find((p) => p.id === d.id.replace("dark-", "light-"));
      if (l.vox !== mirrorVox(d)) throw new Error(`Light's Codo isn't Dark's mirrored: ${d.vox} vs ${l.vox}`);
    }
    for (let a = 0; a < ps.length; a++)
      for (let b = a + 1; b < ps.length; b++)
        if (piecesClash(ps[a], ps[b])) throw new Error(`opening overlaps: ${ps[a].id} / ${ps[b].id}`);
  }
  console.log("generateAnomalySetup places Codos with their cubes, mirrored and non-overlapping (200 rolls): ok");
}

console.log("\nNEON THEME SMOKE TEST PASSED");
