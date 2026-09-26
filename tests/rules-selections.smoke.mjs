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

console.log(failures ? `\n${failures} check(s) failed` : "\nall rules-selections checks passed");
process.exit(failures ? 1 : 0);
