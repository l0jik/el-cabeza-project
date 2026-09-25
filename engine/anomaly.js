/* Random starting layouts: the Anomaly button's shuffle, and any custom
   roster of pieces (Neon's MATTER menu, Lluvia's city, Tienda's order
   form). Theme-agnostic, so it lives with the engine: moved here from
   themes/neon.js, which re-exports it unchanged.

   PIECE_ORIENTATIONS lists each piece type's possible starting poses;
   generateAnomalySetup places Dark's pieces at random in its two home
   rows and mirrors them through the board's centre for Light. */

import { BOARD_ROWS, BOARD_COLS } from "./constants.js";
import { createInitialPieces } from "./rules.js";
import { mirrorVox } from "./shapes.js";

export const PIECE_ORIENTATIONS = {
  flaco: [
    { w: 1, h: 2, z: 1 },
    { w: 2, h: 1, z: 1 },
    { w: 1, h: 1, z: 2 },
  ],
  turrito: [{ w: 1, h: 1, z: 1 }],
  cabeza: [{ w: 1, h: 1, z: 1 }],
  chato: [
    { w: 1, h: 2, z: 2 },
    { w: 2, h: 1, z: 2 },
    { w: 2, h: 2, z: 1 },
  ],
  opa: [{ w: 2, h: 2, z: 2 }],
  // block1x3's three edges are 1/3/1 — two equal, so (like flaco's own
  // 1/2/1) only 3 of the 6 axis-assignment permutations are actually
  // distinct shapes.
  block1x3: [
    { w: 1, h: 3, z: 1 },
    { w: 3, h: 1, z: 1 },
    { w: 1, h: 1, z: 3 },
  ],
  // block2x3's three edges (2/3/1) are all DIFFERENT, unlike every
  // other piece here — so all 6 permutations of assigning them to
  // {w,h,z} are genuinely distinct resting orientations (a 2x3
  // footprint truly differs from a 3x2 one against the board's fixed
  // row/col axes, not just "the same shape rotated").
  block2x3: [
    { w: 2, h: 3, z: 1 },
    { w: 3, h: 2, z: 1 },
    { w: 2, h: 1, z: 3 },
    { w: 1, h: 2, z: 3 },
    { w: 3, h: 1, z: 2 },
    { w: 1, h: 3, z: 2 },
  ],
  // The Codo (engine/shapes.js): three cubes in an L, so each starting
  // pose names its cubes too. Standing (two on the board, one on top at
  // either end) along either axis, or lying flat in any of its four L
  // turns. Balanced-on-one-cube is reachable in play but never a
  // starting pose.
  codo: [
    { w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,0" },
    { w: 2, h: 1, z: 2, vox: "0,0,0;1,0,0;1,0,1" },
    { w: 1, h: 2, z: 2, vox: "0,0,0;0,0,1;0,1,0" },
    { w: 1, h: 2, z: 2, vox: "0,0,0;0,1,0;0,1,1" },
    { w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" },
    { w: 2, h: 2, z: 1, vox: "0,0,0;1,0,0;1,1,0" },
    { w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,0,0" },
    { w: 2, h: 2, z: 1, vox: "0,1,0;1,0,0;1,1,0" },
  ],
  // The Arco, per size (engine/constants.js ARCO_SIZES): standing upright
  // across the row (opening at the board), or — for the 2-tall sizes —
  // lying flat as a U opening north or south. The Alto is 3 tall, too
  // deep to lie flat in the 2-row home band, so it always starts upright.
  arcoChico: [
    { w: 3, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,0;2,0,1" },
    { w: 3, h: 2, z: 1, vox: "0,0,0;0,1,0;1,0,0;2,0,0;2,1,0" },
    { w: 3, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0;2,0,0;2,1,0" },
  ],
  arcoAlto: [
    { w: 3, h: 1, z: 3, vox: "0,0,0;0,0,1;0,0,2;1,0,2;2,0,0;2,0,1;2,0,2" },
  ],
  arcoAncho: [
    { w: 4, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,1;3,0,0;3,0,1" },
    { w: 4, h: 2, z: 1, vox: "0,0,0;0,1,0;1,0,0;2,0,0;3,0,0;3,1,0" },
    { w: 4, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0;2,1,0;3,0,0;3,1,0" },
  ],
  // The Rayo (4-cube S/Z): standing upright across the row, a pair on
  // the board and a pair above it shifted one square (either way), or
  // lying flat in either S turn.
  rayo: [
    { w: 3, h: 1, z: 2, vox: "0,0,0;1,0,0;1,0,1;2,0,1" },
    { w: 3, h: 1, z: 2, vox: "0,0,1;1,0,0;1,0,1;2,0,0" },
    { w: 3, h: 2, z: 1, vox: "0,0,0;1,0,0;1,1,0;2,1,0" },
    { w: 3, h: 2, z: 1, vox: "0,1,0;1,0,0;1,1,0;2,0,0" },
  ],
  // The Zeta (5-cube Z): standing upright across the row. Drawn the way
  // the user described it (two upright pairs joined by a middle cube) it
  // stands on one cube; turned a quarter it stands on a pair. Lying flat
  // it's 3 rows deep, too deep for the 2-row home band.
  zeta: [
    { w: 3, h: 1, z: 3, vox: "0,0,0;0,0,1;1,0,1;2,0,1;2,0,2" },
    { w: 3, h: 1, z: 3, vox: "2,0,0;2,0,1;1,0,1;0,0,1;0,0,2" },
    { w: 3, h: 1, z: 3, vox: "1,0,0;2,0,0;1,0,1;0,0,2;1,0,2" },
    { w: 3, h: 1, z: 3, vox: "0,0,0;1,0,0;1,0,1;1,0,2;2,0,2" },
  ],
};

export function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The classic fixed five, one each — generateAnomalySetup()'s own
// default when called with no roster (the plain Anomaly button during
// normal setup), byte-for-byte the same selection the original
// hardcoded `types` array always used.
const DEFAULT_ANOMALY_ROSTER = [
  { type: "opa", count: 1 },
  { type: "chato", count: 1 },
  { type: "flaco", count: 1 },
  { type: "turrito", count: 1 },
  { type: "cabeza", count: 1 },
];

// Placement order proxy: the larger a piece's biggest available
// footprint, the more constrained (and therefore earlier-placed) it
// should be — mirrors the original hardcoded order (opa=4 cells first,
// cabeza=1 cell last) generically for any roster.
function maxFootprintCells(type) {
  return Math.max(...PIECE_ORIENTATIONS[type].map((o) => o.w * o.h));
}

/* theme: the ANOMALY button (setup-phase only, see its JSX) generates a
   fresh random opening layout that's rotationally symmetrical — each
   side's own pieces confined entirely to its own back two rows, and
   Light's arrangement is always the exact 180-degree rotation of
   Dark's (the same piece sitting at the point-reflected cell). Only
   Dark's pieces are ever actually placed/randomized; Light's are
   derived by reflecting each one through the board's center (row ->
   BOARD_ROWS - row - h, col -> BOARD_COLS - col - w). That's what
   GUARANTEES the symmetry and both sides' row confinement at once,
   rather than generating and separately validating two halves —
   reflecting a cell that's within Dark's rows {0,1} always lands
   within Light's rows {BOARD_ROWS-2, BOARD_ROWS-1}, automatically.
   Bigger pieces are placed first (greedy) since they're the most
   constrained.

   `roster` (an array of {type, count}) is MATTER's own "custom piece
   rosters" idea (SINGULARITY_DESIGN.md Part 2) — a player's chosen
   complement instead of the fixed five, threaded in from the sphere's
   own selections (see applyMatterRoster in useSetupExtras below).
   Defaults to DEFAULT_ANOMALY_ROSTER so every existing call site (the
   plain Anomaly button, which never passes one) is unaffected. A count
   greater than 1 is new — the original fixed five never had two of the
   same type — so ids get a numeric suffix per instance rather than
   always being bare `dark-${type}`; count===1 keeps the original bare
   id, so a default-roster game's piece ids are byte-identical to
   before this existed. */
// `blocked`: {row,col} cells no piece may start on (Black Hole / Missing
// Square placements). Seeded into `occupied` along with each one's
// 180-degree mirror, so Light's reflected pieces avoid them too.
export function generateAnomalySetup(roster, blocked = []) {
  const blockedKeys = [];
  blocked.forEach(({ row, col }) => {
    blockedKeys.push(row * BOARD_COLS + col, (BOARD_ROWS - 1 - row) * BOARD_COLS + (BOARD_COLS - 1 - col));
  });
  const effectiveRoster = roster && roster.length ? roster : DEFAULT_ANOMALY_ROSTER;
  const instances = [];
  effectiveRoster.forEach(({ type, count }) => {
    for (let i = 0; i < count; i++) instances.push({ type, index: i });
  });
  instances.sort((a, b) => maxFootprintCells(b.type) - maxFootprintCells(a.type));

  for (let attempt = 0; attempt < 300; attempt++) {
    const occupied = new Set(blockedKeys);
    const placed = [];
    let ok = true;
    for (const { type, index } of instances) {
      const orientations = PIECE_ORIENTATIONS[type];
      const { w, h, z, vox } = orientations[Math.floor(Math.random() * orientations.length)];
      const rowOptions = [];
      for (let row = 0; row <= 2 - h; row++) rowOptions.push(row);
      const colOptions = [];
      for (let col = 0; col <= BOARD_COLS - w; col++) colOptions.push(col);
      const rowOrder = shuffledIndices(rowOptions.length).map((i) => rowOptions[i]);
      const colOrder = shuffledIndices(colOptions.length).map((i) => colOptions[i]);
      let placedThis = false;
      for (const row of rowOrder) {
        for (const col of colOrder) {
          let free = true;
          for (let r = row; r < row + h && free; r++) {
            for (let c = col; c < col + w; c++) {
              if (occupied.has(r * BOARD_COLS + c)) { free = false; break; }
            }
          }
          if (free) {
            for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) occupied.add(r * BOARD_COLS + c);
            placed.push({ type, index, row, col, w, h, z, vox });
            placedThis = true;
            break;
          }
        }
        if (placedThis) break;
      }
      if (!placedThis) { ok = false; break; }
    }
    if (ok) {
      const pieces = [];
      placed.forEach((p) => {
        const suffix = p.index > 0 ? `-${p.index}` : "";
        const dark = { id: `dark-${p.type}${suffix}`, type: p.type, owner: "dark", row: p.row, col: p.col, w: p.w, h: p.h, z: p.z };
        const light = {
          id: `light-${p.type}${suffix}`,
          type: p.type,
          owner: "light",
          row: BOARD_ROWS - p.row - p.h,
          col: BOARD_COLS - p.col - p.w,
          w: p.w,
          h: p.h,
          z: p.z,
        };
        // An odd-shaped piece's cubes turn with the 180° mirror too.
        if (p.vox) {
          dark.vox = p.vox;
          light.vox = mirrorVox(p);
        }
        pieces.push(dark, light);
      });
      return pieces;
    }
  }
  // A custom roster heavy enough to never fit the 2-row home band in
  // 300 shuffled attempts falls back to the always-fits classic five,
  // same as the original single-roster version's own fallback —
  // better than silently returning nothing.
  return roster ? generateAnomalySetup(undefined, blocked) : createInitialPieces();
}
