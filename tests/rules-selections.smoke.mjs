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

// Everything Futuris's sphere offers, in the shared model.
import("../themes/rules-selections.js").then(async (m) => {
  const { getBoardDimensions, ACTIVE_LAWS } = await import("../engine/constants.js");
  const s = m.defaultSelections();
  check("15 piece types (each Arco size its own; the Hombro and Cruce too), up to 4 each (Cabeza 1-2)", m.PIECE_OPTIONS.length === 15 && m.PIECE_OPTIONS.every((p) => p.max === (p.key === "cabeza" ? 2 : 4)));
  {
    const { PIECE_META: PIECE_TYPES } = await import("../engine/constants.js");
    const offered = m.PIECE_OPTIONS.map((p) => m.pieceTypeOf(p.key));
    const all = Object.keys(PIECE_TYPES || {});
    check(`every piece type the engine has is offered (${all.length})`, all.length > 0 && all.every((k) => offered.includes(k)), all.filter((k) => !offered.includes(k)).join(","));
  }
  {
    // An older save's one Arco count and size: read as that size's row.
    const old = m.normalizeSelections({ counts: { cabeza: 1, arco: 2 }, arcoSize: "alto" });
    check("an older save's Arco (2, Alto) loads as 2 Arco Alto", old.counts.arcoAlto === 2 && old.counts.arcoChico === 0 && !("arcoSize" in old));
    // Any mix of the three.
    const mix = m.defaultSelections();
    mix.counts.arcoChico = 1; mix.counts.arcoAlto = 1; mix.counts.arcoAncho = 1; mix.cols = 12; mix.rows = 12;
    const got = m.applySelections(mix, {});
    const dark = got.pieces.filter((p) => p.owner === "dark").map((p) => p.type);
    check(`a mix of all three Arcos sets out (${dark.join(",")})`, ["arcoChico", "arcoAlto", "arcoAncho"].every((t) => dark.includes(t)));
    check("...and the summary names each", JSON.stringify(m.variantsOf(mix)).includes("1× Arco Alto") && JSON.stringify(m.variantsOf(mix)).includes("1× Arco Ancho"));
  }
  s.laws.shoving = true;
  // The line under the setting says what actually shoves (user).
  check("with Slide off, the line says only rolls shove", /only rolls shove/.test(m.shoveNow({ ...s, laws: { ...s.laws, slide: false } })));
  check("...with Slide on, slides and rolls both", /slides and rolls both shove/.test(m.shoveNow({ ...s, laws: { ...s.laws, slide: true } })));
  check("...on slides only, only slides", /only slides shove/.test(m.shoveNow({ ...s, shove: { onRolls: false } })));
  {
    const lone = m.toggleLaw(m.cloneSelections(m.defaultSelections()), "diagonalSlide");
    check("Diagonal slide stands on its own: Orthogonal slide stays off", lone.laws.diagonalSlide && !lone.laws.slide && m.lawsForEngine(lone).diagonalSlide === true);
    check("...and the line says only rolls shove, diagonal slides never", /diagonal slides never shove/.test(m.shoveNow({ ...lone, laws: { ...lone.laws, shoving: true } })));
  }
  check("...and with Diagonal slide on it says diagonal slides never shove", /Diagonal slides never shove/.test(m.shoveNow({ ...s, laws: { ...s.laws, slide: true, diagonalSlide: true } })));
  check("Shoving reaches the engine, rolls shoving by default", m.lawsForEngine(s).shoving === true && m.lawsForEngine(s).shoveOnRolls === true && !("shoveFar" in m.lawsForEngine(s)));
  // Its one setting: slides only.
  s.shove = { onRolls: false };
  check("slides only reaches the engine", m.lawsForEngine(s).shoveOnRolls === false);
  check("...and without Slide it warns that nothing can shove", m.lawWarnings(s).some((w) => w.testid === "shove-needs-slide"));
  s.laws.slide = true;
  check("...with Slide but 2 actions a turn it warns a shoving slide needs 3", m.lawWarnings(s).some((w) => w.testid === "shove-needs-three"));
  s.laws.threeActions = true;
  check("...which 3 actions per turn clears", !m.lawWarnings(s).some((w) => w.key === "shoving"));
  check("...and the summary says slides only", m.variantsOf(s)[0].items.includes("Shoving (slides only)"));
  s.laws.threeActions = false; s.laws.slide = false;
  s.shove = { onRolls: true };
  // ...and which pieces a shove pushes, a slide's or a roll's (user: "all
  // pieces or only opponents", for slides only as well): all by default;
  // the choice shows with either.
  check("shoves push all pieces by default", m.defaultSelections().shove.own === true && m.lawsForEngine(m.defaultSelections()).shoveOwn === true);
  check("...an older save without the setting reads as all pieces", m.normalizeSelections({ laws: { shoving: true }, shove: { onRolls: true } }).shove.own === true);
  check("...one from when it was for rolls only keeps its answer", m.normalizeSelections({ laws: { shoving: true }, shove: { onRolls: true, ownOnRolls: false } }).shove.own === false);
  check("...the choice shows with slides and rolls and with slides only", m.shoveShown({ ...s, shove: { onRolls: true } }).some((st) => st.key === "own") && m.shoveShown({ ...s, shove: { onRolls: false } }).some((st) => st.key === "own"));
  s.shove = { onRolls: true, own: false };
  check("opponents' only reaches the engine", m.lawsForEngine(s).shoveOwn === false && m.lawsForEngine(s).shoveOnRolls === true);
  check("...the line says so", /only your opponent's pieces/.test(m.shoveNow(s)), m.shoveNow(s));
  check("...and the summary too", m.variantsOf(s)[0].items.includes("Shoving (slides and rolls, only opponents)"), JSON.stringify(m.variantsOf(s)[0].items));
  check("...and it survives a save", m.normalizeSelections(m.cloneSelections(s)).shove.own === false);
  s.shove = { onRolls: false, own: false };
  s.laws.slide = true;
  check("with slides only: opponents' only reaches the engine", m.lawsForEngine(s).shoveOwn === false && m.lawsForEngine(s).shoveOnRolls === false);
  check("...the line says so", /only slides shove/.test(m.shoveNow(s)) && /only your opponent's pieces/.test(m.shoveNow(s)), m.shoveNow(s));
  check("...the summary too", m.variantsOf(s)[0].items.includes("Shoving (slides only, only opponents)"), JSON.stringify(m.variantsOf(s)[0].items));
  check("...a game that isn't the default one", !m.isDefaultSelections(s));
  check("...and it survives a save", m.normalizeSelections(m.cloneSelections(s)).shove.own === false);
  s.laws.slide = false;
  s.shove = { onRolls: true };
  s.counts.opa = 1;
  check("...and with an Opa but 2 actions a turn it warns an Opa's shove needs 3", m.lawWarnings(s).some((w) => w.testid === "shove-opa-needs-three"));
  s.laws.threeActions = true;
  check("...which 3 actions per turn clears", !m.lawWarnings(s).some((w) => w.testid === "shove-opa-needs-three"));
  s.laws.threeActions = false;
  s.laws.cantileverPivot = true;
  check("a pivot with nothing to pivot warns", m.lawWarnings(s).some((w) => w.testid === "law-warning-cantileverPivot"));
  m.toggleLaw(s, "blackHoleSquares");
  check("switching black holes on rolls their place, off the back rows", s.holeSpots.length === 1 && m.holeRowAllowed(s.holeSpots[0].row, s.rows));
  check("a black hole in a back row is refused", m.spotProblem(s, "hole", 0, 4) === "backRow" && m.spotProblem(s, "hole", 9, 4) === "backRow");
  s.missing = true; s.missingCount = 3; m.fillSpots(s, "missing");
  check("3 missing pairs rolled, never on the black holes", s.missingSpots.length === 3 && !m.missingCellsOf(s).some((c) => m.holeCellsOf(s).some((h) => h.row === c.row && h.col === c.col)));
  // A wall of missing squares across the board is refused.
  const wallSel = { ...m.defaultSelections(), missing: true, missingCount: 5, rows: 6, cols: 6, missingSpots: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }] };
  check("marking a square that would cut the board in two is refused", m.spotProblem(wallSel, "missing", 3, 3, wallSel.missingSpots) === "wall" || m.spotProblem(wallSel, "missing", 2, 3, wallSel.missingSpots) === "wall");
  // Applying it: hand-placed squares are honoured, pieces set out round them.
  const t = m.defaultSelections();
  t.laws.blackHoleSquares = true; t.holeSpots = [{ row: 3, col: 2, random: false }];
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
  check("the summary uses the theme's words and names Shoving", labelled[0].label === "RULES" && labelled[0].items.includes("Shoving (slides and rolls)"));
  check("an old save keeps its slides-only choice and drops the push distance", (() => { const n = m.normalizeSelections({ laws: { shoving: true }, shove: { far: true, onRolls: false } }); return n.shove.onRolls === false && !("far" in n.shove); })());
  check("a save without the setting shoves on rolls too", m.normalizeSelections({ laws: { shoving: true } }).shove.onRolls === true);
  check("an old save normalises (size → rows × cols, counts clamped)", (() => { const n = m.normalizeSelections({ size: 12, counts: { opa: 9 } }); return n.rows === 12 && n.cols === 12 && n.counts.opa === 4 && n.missingSpots.length === 0; })());
  // The two Split movements (user): one or the other; three pieces brings 3 actions.
  {
    const t = m.defaultSelections();
    m.toggleLaw(t, "splitMovement");
    m.toggleLaw(t, "splitThree");
    check("three pieces turns two pieces off and 3 actions on", t.laws.splitThree && !t.laws.splitMovement && t.laws.threeActions, JSON.stringify(t.laws));
    m.toggleLaw(t, "splitMovement");
    check("two pieces turns three pieces off", t.laws.splitMovement && !t.laws.splitThree);
    m.toggleLaw(t, "splitThree");
    m.toggleLaw(t, "threeActions");
    check("3 actions off takes three pieces with it", !t.laws.threeActions && !t.laws.splitThree);
    const u = m.defaultSelections(); m.toggleLaw(u, "splitThree");
    const e = m.lawsForEngine(u);
    check("the engine gets split on, three pieces, 3 actions", e.splitMovement && e.splitThree && e.threeActions, JSON.stringify(e));
    // Shoving on Slides only brings Slide; Slide off puts it back (user).
    const w = m.defaultSelections(); m.toggleLaw(w, "shoving"); m.setShove(w, "onRolls", false);
    check("Slides only turns Slide on", w.laws.slide && w.shove.onRolls === false);
    m.toggleLaw(w, "slide");
    check("Slide off puts Shoving back on slides and rolls", !w.laws.slide && w.shove.onRolls === true);
    const x = m.defaultSelections(); m.setShove(x, "onRolls", false); m.toggleLaw(x, "shoving");
    check("Shoving on with Slides only already set brings Slide", x.laws.slide);
    check("a save with both keeps three pieces only", (() => { const n = m.normalizeSelections({ laws: { splitMovement: true, splitThree: true, threeActions: true } }); return n.laws.splitThree && !n.laws.splitMovement; })());
    check("the three-piece choice sits right under two pieces", (() => { const k = m.LAW_OPTIONS.map((l) => l.key); return k.indexOf("splitThree") === k.indexOf("splitMovement") + 1 && k.indexOf("threeActions") === k.indexOf("splitMovement") - 1; })());
  }
  // Every law at once (user: "a switch ... to turn all laws on").
  {
    const a = m.defaultSelections();
    check("all laws reads off at the start", !m.allLawsOn(a));
    m.setAllLaws(a, true);
    const on = m.LAW_OPTIONS.filter((l) => a.laws[l.key]).map((l) => l.key);
    check(`all laws on: every one but two pieces, three pieces in its place (${on.join(" ")})`, m.allLawsOn(a) && on.length === m.RULE_LAWS.length - 1 && a.laws.splitThree && !a.laws.splitMovement && a.laws.threeActions);
    check("...the black holes left alone: they're set with the board", !a.laws.blackHoleSquares && m.holeCellsOf(a).length === 0, JSON.stringify(a.holeSpots));
    m.setAllLaws(a, false);
    check("all laws off: none on", !m.LAW_OPTIONS.some((l) => a.laws[l.key]) && !m.allLawsOn(a));
    const b = m.defaultSelections(); m.toggleLaw(b, "splitMovement"); m.setShove(b, "onRolls", false);
    m.setAllLaws(b, true);
    check("all on keeps two pieces if that was chosen, and slides only", m.allLawsOn(b) && b.laws.splitMovement && !b.laws.splitThree && b.shove.onRolls === false);
    m.toggleLaw(b, "cantileverPivot");
    check("one switched off after: all laws reads off", !m.allLawsOn(b));
    m.setAllLaws(b, false);
    check("off from slides only puts Shoving back on slides and rolls", !b.laws.slide && b.shove.onRolls === true);
  }
  // Two sets of black holes (user: "add the option to increase the number
  // of black hole sets to 2").
  {
    const h = m.defaultSelections();
    m.toggleLaw(h, "blackHoleSquares");
    check("one set to start with", m.holeSetsOf(h) === 1 && h.holeSpots.length === 1);
    m.setHoleSets(h, 2);
    const cells = m.holeCellsOf(h);
    check("two sets: a second spot rolled, four holes in all", h.holeSpots.length === 2 && cells.length === 4, JSON.stringify(h.holeSpots));
    const touching = cells.some((a, i) => cells.some((b, j) => Math.floor(i / 2) !== Math.floor(j / 2) && Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) <= 1));
    check("...never beside the first set's", !touching);
    const first = h.holeSpots[0];
    check("a hole beside the other set's is refused", m.spotProblem(h, "hole", first.row, first.col + (first.col < 9 ? 1 : -1), [first]) === "near");
    // A picker's tap moves the hole of the set its buttons are on (user:
    // the dashed ring that marked a rolled one, the one a tap moved first,
    // "is confusing"), each set in its place in the list (its colour).
    h.holeSpots = [{ row: 3, col: 2, random: false }, { row: 2, col: 6, random: true }];
    let tap = m.holeSpotsAfterTap(h, 4, 7, 2);
    check("a tap with Set 2 chosen moves Set 2's hole, Set 1's kept in its place", tap.spots && tap.spots.length === 2 && tap.spots[0].row === 3 && tap.spots[1].row === 4 && !tap.spots[1].random, JSON.stringify(tap));
    h.holeSpots = tap.spots;
    tap = m.holeSpotsAfterTap(h, 2, 6, 1);
    check("...with Set 1 chosen, Set 1's, Set 2's kept in its place", tap.spots && tap.spots[0].row === 2 && tap.spots[1].row === 4, JSON.stringify(tap));
    check("...a square beside the other set's hole is refused, said why", m.holeSpotsAfterTap(h, 4, 6, 1).problem === "near" && !!m.SPOT_PROBLEMS.near);
    check("...but a set's own hole may move next door", !!m.holeSpotsAfterTap(h, 4, 6, 2).spots);
    h.holeSpots = [{ row: 3, col: 2, random: true }, { row: 2, col: 6, random: false }];
    m.fillSpots(h, "hole", true);
    check("re-rolled: a hand-placed Set 2 keeps its place (and colour)", h.holeSpots.length === 2 && h.holeSpots[0].random && h.holeSpots[1].row === 2 && h.holeSpots[1].col === 6 && !h.holeSpots[1].random, JSON.stringify(h.holeSpots));
    // Exit from any hole (user: "a toggle switch that allows them to exit
    // from any of the three other black holes on the board").
    check("Exit from any hole: off to start with", h.holeAnyExit === false && m.lawsForEngine(h).holeAnyExit === false);
    h.holeAnyExit = true;
    check("...on: to the engine with two sets, and in the summary", m.lawsForEngine(h).holeAnyExit === true && /2 sets, exit from any other singularity/.test(JSON.stringify(m.variantsOf(h))) && /any of the other three/.test(m.holeSetsText(h)));
    check("...kept through a save; an older save has it off", m.normalizeSelections(JSON.parse(JSON.stringify(h))).holeAnyExit === true && m.normalizeSelections({ laws: {} }).holeAnyExit === false);
    check("...and how two sets work said otherwise: the other half", /either one on the other half/.test(m.holeSetsText({ ...h, holeAnyExit: false })));
    const one = m.defaultSelections(); one.laws.blackHoleSquares = true; one.holeSpots = [{ row: 3, col: 2, random: false }];
    tap = m.holeSpotsAfterTap(one, 3, 3);
    check("with one set the hole simply moves, even next door", tap.spots && tap.spots.length === 1 && tap.spots[0].col === 3, JSON.stringify(tap));
    m.setHoleSets(h, 1);
    check("back to one set: the spot marked by hand stays", h.holeSpots.length === 1 && !h.holeSpots[0].random, JSON.stringify(h.holeSpots));
    check("...and Exit from any hole goes nowhere with one set", m.lawsForEngine(h).holeAnyExit === false && !/exit from any other singularity/.test(JSON.stringify(m.variantsOf(h))) && /A singularity and its partner/.test(m.holeSetsText(h)));
    h.holeAnyExit = false;
    m.setHoleSets(h, 2);
    h.holeSpots = [{ row: 3, col: 2, random: false }, { row: 2, col: 6, random: false }];
    const x2 = { applyBoardResize: (r, c) => setBoardDimensions(r, c) };
    const out = m.applySelections(h, x2);
    check("applied: the four holes as marked", out.holes.length === 4 && [[3, 2], [6, 7], [2, 6], [7, 3]].every(([r, c]) => out.holes.some((q) => q.row === r && q.col === c)), JSON.stringify(out.holes));
    check("...and the summary says two sets", JSON.stringify(m.variantsOf(h)).includes("(2 sets)"));
    const old = m.normalizeSelections({ laws: { blackHoleSquares: true }, holeSpot: { row: 3, col: 2, random: false } });
    check("a save from before keeps its one hole's place", old.holeSets === 1 && old.holeSpots.length === 1 && old.holeSpots[0].row === 3 && !("holeSpot" in old));
    check("two sets off with the law: the default selections again", m.isDefaultSelections({ ...m.defaultSelections(), holeSets: 2 }));
  }
  setBoardDimensions(10, 10);
  console.log(failures ? `\n${failures} check(s) failed` : "\nall rules-selections checks passed");
  process.exit(failures ? 1 : 0);
});
