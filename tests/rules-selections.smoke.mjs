/* The custom-rules model's board and pieces, offline: rows and columns
   set separately (6 to 20); whether an order's pieces fit a side's two
   home rows on a given width, and the narrowest width they need; and
   that a tight order that does fit is set out as ordered (not swapped
   for the classic five, as the random placer alone used to do). */
import { setBoardDimensions } from "../engine/constants.js";
import { packHomeBand, generateAnomalySetup } from "../engine/anomaly.js";
import { defaultSelections, piecesFit, minColsFor, variantsOf, clampDim, boardLabel } from "../themes/rules-selections.js";

let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

const d = defaultSelections();
check("the default board is 10 × 10, rows and columns apart", d.rows === 10 && d.cols === 10 && !("size" in d));
check("sizes clamp to 6..20", clampDim(3) === 6 && clampDim(25) === 20 && clampDim(13.4) === 13);
check("the board reads width × length", boardLabel({ ...d, cols: 14, rows: 8 }) === "14 × 8");
const v = variantsOf({ ...d, cols: 14, rows: 8 });
check("a non-square board shows in the rules summary", !!v && v.some((g) => g.items.includes("14 × 8 board")), JSON.stringify(v));

// The packer.
check("3 Opas fill a 6-wide home band exactly", !!packHomeBand([{ type: "opa", count: 3 }], 6));
check("...and one more cube doesn't fit", !packHomeBand([{ type: "opa", count: 3 }, { type: "turrito", count: 1 }], 6));
check("the classic five fit the narrowest board", !!packHomeBand([{ type: "opa", count: 1 }, { type: "chato", count: 1 }, { type: "flaco", count: 1 }, { type: "turrito", count: 1 }, { type: "cabeza", count: 1 }], 6));
const t0 = Date.now();
const none = packHomeBand([{ type: "opa", count: 3 }, { type: "arcoChico", count: 3 }, { type: "zeta", count: 3 }, { type: "cabeza", count: 1 }], 11);
check(`an impossible order is ruled out quickly (${Date.now() - t0} ms)`, !none && Date.now() - t0 < 500);
const packed = packHomeBand([{ type: "codo", count: 2 }, { type: "rayo", count: 2 }, { type: "opa", count: 1 }, { type: "cabeza", count: 1 }], 8);
const cells = new Set();
let overlap = false, inside = true;
(packed || []).forEach((p) => { for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) { const k = `${r},${c}`; if (cells.has(k)) overlap = true; cells.add(k); if (r > 1 || c > 7) inside = false; } });
check("a packing keeps every piece in the band, none overlapping", !!packed && !overlap && inside && packed.length === 6);

// The menus' questions.
const threeOpas = { ...d, counts: { ...d.counts, opa: 3 } };
check("the classic five fit any width", piecesFit({ ...d, cols: 6 }));
check("3 Opas and the rest don't fit 6 wide", !piecesFit({ ...threeOpas, cols: 6 }));
check(`...they need ${minColsFor(threeOpas)} wide`, minColsFor(threeOpas) === 9 && piecesFit({ ...threeOpas, cols: 9 }) && !piecesFit({ ...threeOpas, cols: 8 }));
const tooMany = { ...d, counts: { cabeza: 2, turrito: 0, flaco: 0, chato: 0, opa: 3, codo: 0, arco: 3, rayo: 0, zeta: 2 } };
check("an order too big for any width says so (no width)", minColsFor(tooMany) === null || piecesFit({ ...tooMany, cols: minColsFor(tooMany) }));

// A tight order that fits is set out as ordered. This one (on a board
// 10 wide) the random placer alone missed about 3 times in 10, and then
// quietly set out the classic five instead.
const tight = [{ type: "cabeza", count: 1 }, { type: "arcoChico", count: 1 }, { type: "opa", count: 2 }, { type: "flaco", count: 1 }, { type: "rayo", count: 2 }, { type: "turrito", count: 1 }];
setBoardDimensions(10, 10);
let asOrdered = 0;
for (let i = 0; i < 40; i++) {
  const ps = generateAnomalySetup(tight, []);
  const got = {};
  ps.filter((p) => p.owner === "dark").forEach((p) => { got[p.type] = (got[p.type] || 0) + 1; });
  if (ps.length === 16 && tight.every((r) => got[r.type] === r.count)) asOrdered++;
}
check(`a tight order on a 10-wide board is set out as ordered, every time (${asOrdered}/40)`, asOrdered === 40);

// Everything Neon's sphere offers, in the shared model.
import("../themes/rules-selections.js").then(async (m) => {
  const { getBoardDimensions, ACTIVE_LAWS } = await import("../engine/constants.js");
  const s = m.defaultSelections();
  check("11 piece types, up to 4 each (Cabeza 1-2)", m.PIECE_OPTIONS.length === 11 && m.PIECE_OPTIONS.every((p) => p.max === (p.key === "cabeza" ? 2 : 4)));
  s.counts.arco = 1; s.arcoSize = "ancho";
  check("the Arco's size picks its piece type", m.pieceTypeOf("arco", s) === "arcoAncho");
  s.laws.shoving = true;
  check("Shoving reaches the engine with no settings of its own", m.lawsForEngine(s).shoving === true && !("shoveFar" in m.lawsForEngine(s)) && !("shove" in s));
  s.counts.opa = 1;
  check("...and with an Opa but 2 points a turn it warns an Opa's shove needs 3", m.lawWarnings(s).some((w) => w.testid === "shove-opa-needs-three"));
  s.laws.threeActions = true;
  check("...which 3 actions per turn clears", !m.lawWarnings(s).some((w) => w.testid === "shove-opa-needs-three"));
  s.laws.threeActions = false;
  s.laws.cantileverPivot = true;
  check("a pivot with nothing to pivot warns", m.lawWarnings(s).some((w) => w.testid === "law-warning-cantileverPivot"));
  m.toggleLaw(s, "blackHoleSquares");
  check("switching black holes on rolls their place, off the back rows", !!s.holeSpot && m.holeRowAllowed(s.holeSpot.row, s.rows));
  check("a black hole in a back row is refused", m.spotProblem(s, "hole", 0, 4) === "backRow" && m.spotProblem(s, "hole", 9, 4) === "backRow");
  s.missing = true; s.missingCount = 3; m.fillSpots(s, "missing");
  check("3 missing pairs rolled, never on the black holes", s.missingSpots.length === 3 && !m.missingCellsOf(s).some((c) => m.holeCellsOf(s).some((h) => h.row === c.row && h.col === c.col)));
  // A wall of missing squares across the board is refused.
  const wallSel = { ...m.defaultSelections(), missing: true, missingCount: 5, rows: 6, cols: 6, missingSpots: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }] };
  check("marking a square that would cut the board in two is refused", m.spotProblem(wallSel, "missing", 3, 3, wallSel.missingSpots) === "wall" || m.spotProblem(wallSel, "missing", 2, 3, wallSel.missingSpots) === "wall");
  // Applying it: hand-placed squares are honoured, pieces set out round them.
  const t = m.defaultSelections();
  t.laws.blackHoleSquares = true; t.holeSpot = { row: 3, col: 2, random: false };
  t.missing = true; t.missingCount = 1; t.missingSpots = [{ row: 1, col: 4, random: false }]; // in Dark's home rows, on the standard opening
  const x = { applyBoardResize: (r, c) => setBoardDimensions(r, c) };
  let honoured = 0, clear = 0;
  for (let i = 0; i < 10; i++) {
    const out = m.applySelections(t, x);
    if (out.missing.some((q) => q.row === 1 && q.col === 4) && out.holes.some((q) => q.row === 3 && q.col === 2)) honoured++;
    const bad = out.pieces.some((p) => [...out.missing, ...out.holes].some((q) => q.row >= p.row && q.row < p.row + p.h && q.col >= p.col && q.col < p.col + p.w));
    if (!bad) clear++;
  }
  check(`hand-placed squares are used as marked (${honoured}/10), the pieces set out round them (${clear}/10)`, honoured === 10 && clear === 10);
  const labelled = m.variantsOf({ ...t, laws: { ...t.laws, shoving: true } }, { laws: "RULES", matter: "PIECES", topologies: "BOARD" });
  check("the summary uses the theme's words and names Shoving", labelled[0].label === "RULES" && labelled[0].items.includes("Shoving"));
  check("an old save's Shoving settings are dropped", !("shove" in m.normalizeSelections({ laws: { shoving: true }, shove: { far: true, onRolls: true } })));
  check("an old save normalises (size → rows × cols, counts clamped)", (() => { const n = m.normalizeSelections({ size: 12, counts: { opa: 9 } }); return n.rows === 12 && n.cols === 12 && n.counts.opa === 4 && n.missingSpots.length === 0; })());
  setBoardDimensions(10, 10);
  console.log(failures ? `\n${failures} check(s) failed` : "\nall rules-selections checks passed");
  process.exit(failures ? 1 : 0);
});
