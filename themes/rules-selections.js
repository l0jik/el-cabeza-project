/* Custom rules as a set of choices: which pieces each side gets, which
   laws are on (and Shoving's one setting), and the board (its size, missing
   squares and the black holes' place, a shuffled start). The same
   choices Futuris's Singularity sphere offers, shared by the themes whose
   menus set them (Lluvia's city, Tienda's order form); the menus only
   draw the choices, this module applies them to a real game.

   Theme-agnostic and React-free, so it imports in plain Node for the
   smoke tests. */

import { setActiveLaws, setBlackHoles, setMissingSquares, getBoardDimensions, MIN_BOARD_DIM, MAX_BOARD_DIM } from "../engine/constants.js";
import { SHOVE_SETTINGS, DEFAULT_SHOVE, shoveOf, shoveLaws, shoveSummary, shoveNow as shoveNowFor } from "../chassis/shove-settings.js";
import {
  createInitialPieces, initialPiecesFor, pickBlackHoleSquares, pickBlackHoleSets, pickMissingSquares, missingSquaresKeepPath, blackHoleRowAllowed,
  holesTouch,
} from "../engine/rules.js";
import { generateAnomalySetup, packHomeBand } from "../engine/anomaly.js";

/* ------------------------------------------------------------ the choices */

// Pieces per side: min, max and the classic game's count (as Futuris's MATTER).
// No cap on a side's pieces but whether they fit, set out in two home
// rows (piecesFit; user, of "11 pieces a side: 10 at most": "drop it, so
// the only limit is whether the pieces fit, with a short note that big
// armies weaken the computer"). A kind's counter goes as high as two home
// rows of the widest board could ever hold; the Cabeza stays one or two,
// a rule of the game.
export const MAX_OF_A_KIND = 2 * MAX_BOARD_DIM;
export const PIECE_OPTIONS = [
  { key: "cabeza", name: "Cabeza", min: 1, max: 2, def: 1 },
  { key: "turrito", name: "Turrito", min: 0, max: MAX_OF_A_KIND, def: 1 },
  { key: "flaco", name: "Flaco", min: 0, max: MAX_OF_A_KIND, def: 1 },
  { key: "chato", name: "Chato", min: 0, max: MAX_OF_A_KIND, def: 1 },
  { key: "opa", name: "Opa", min: 0, max: MAX_OF_A_KIND, def: 1 },
  { key: "block1x3", name: "1×3 Block", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "block2x3", name: "2×3 Block", min: 0, max: MAX_OF_A_KIND, def: 0 },
  // (The Arco in each of its three sizes, each its own row, user; any mix.)
  { key: "arcoChico", name: "Arco Chico", note: "3 wide, 2 tall", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "arcoAlto", name: "Arco Alto", note: "3 wide, 3 tall", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "arcoAncho", name: "Arco Ancho", note: "4 wide, 2 tall", min: 0, max: MAX_OF_A_KIND, def: 0 },
  // The pieces that can pivot (Codo, Hombro, Cruce, Rayo, Zeta) together at the end,
  // so the pivot warning can point at one place (user).
  { key: "codo", name: "Codo", min: 0, max: MAX_OF_A_KIND, def: 0 },
  // (The Codo's family, with a fourth cube at its corner, user.)
  { key: "hombro", name: "Hombro", note: "A Codo with a cube standing on its corner", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "cruce", name: "Cruce", note: "4 cubes in a T", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "rayo", name: "Rayo", min: 0, max: MAX_OF_A_KIND, def: 0 },
  { key: "zeta", name: "Zeta", min: 0, max: MAX_OF_A_KIND, def: 0 },
];
// The Arco's three sizes (each a piece of its own above; an older save's
// one Arco count and size, `arco` and `arcoSize`, is read as that size's).
export const ARCO_SIZES = [
  { key: "chico", name: "Chico", type: "arcoChico", note: "3 wide, 2 tall" },
  { key: "alto", name: "Alto", type: "arcoAlto", note: "3 wide, 3 tall" },
  { key: "ancho", name: "Ancho", type: "arcoAncho", note: "4 wide, 2 tall" },
];
// The engine's piece type for an option (each option is one).
export function pieceTypeOf(key) {
  return key;
}

export const LAW_OPTIONS = [
  // Named Orthogonal slide (user), with what orthogonal means said in the
  // note: along a row or column, not corner to corner.
  { key: "slide", name: "Orthogonal slide", note: "Move a piece one open square along its row or column (not corner to corner) without tipping it. 2 actions (a roll is 1)." },
  { key: "diagonalSlide", name: "Diagonal slide", note: "Move a piece one open square corner to corner without tipping it. 2 actions. On its own, or with Orthogonal slide for all eight ways. Never shoves." },
  // (A law to the engine, but a feature of the board to a player, so the
  // menus set it with the board, under Missing squares, not under Rules,
  // and All rules leaves it alone, as it does Missing squares: `board`.)
  { key: "blackHoleSquares", name: "Singularity squares", board: true, note: "Two linked squares: a one-square piece that goes in one comes out beside the other. Ends the turn. One set or two." },
  { key: "shoving", name: "Shoving", note: "Moving into pieces with fewer cubes, all together, pushes them along: a slide one square, a roll just past where it lands. Never diagonally, even with Diagonal slide. 1 action more. Choose whether rolls shove too, or only slides, whether a shove may push your own pieces, and whether pieces behind block it or are pushed along too." },
  { key: "cantileverPivot", name: "Cantilever pivot", note: "A Codo, Hombro, Cruce, Rayo or Zeta standing on one cube turns a quarter turn round it. 1 action." },
  // (3 actions per turn directly above Split movement: user.)
  { key: "threeActions", name: "3 actions per turn", note: "3 actions a turn instead of 2." },
  { key: "splitMovement", name: "Split movement, 2 pieces", note: "Spend a turn's actions on up to two pieces." },
  // (User: a three-piece limit as its own choice; one or the other of the
  // two Split movements, and it brings 3 actions, a point a piece.)
  { key: "splitThree", name: "Split movement, 3 pieces", note: "Spend a turn's 3 actions on up to three pieces, one action each. Brings 3 actions per turn." },
  // (User: the first player's handicap, not standard Cabeza's, as a toggle,
  // on by default for anything other than the standard game: `def`.)
  // (Named with Go's word for making up for moving first, komi, user:
  // "Behind punto, maybe you can also in parentheses put whatever the
  // Japanese version of that they use in Go"; on by default in every
  // Cabeza Nova menu, the standard game never using it.)
  { key: "punto", name: "Punto (komi)", def: true, note: "The side that opens has one action fewer on the game's first turn, to blunt the first strike: one action with 2 a turn, two with 3. On by default unless you turn it off; the standard game has no handicap." },
];
// The laws the menus list under Rules, and the one they set with the board.
export const RULE_LAWS = LAW_OPTIONS.filter((l) => !l.board);
export const HOLES_LAW = LAW_OPTIONS.find((l) => l.key === "blackHoleSquares");
// Shoving's settings, the chassis's (chassis/shove-settings.js): which
// moves shove (with slides only, a roll into a piece is simply blocked),
// and which pieces a shove may push, a slide's or a roll's (user: "all
// pieces or only opponents"; with opponents' only, one of your own in the
// way blocks the move). Both shown while Shoving is on.
export { SHOVE_SETTINGS };
export const shoveShown = () => SHOVE_SETTINGS;
// The board: rows (from one side's home row to the other's) and columns
// (across, the width of a home row), each MIN_BOARD_DIM to MAX_BOARD_DIM.
// SIZES are square quick picks.
export const SIZES = [8, 10, 12];
// Past BIG_ARMY a side the menus say what it costs (BIG_ARMY_NOTE): the
// computer thinks for the same time, so it sees fewer turns ahead, and
// with every rule on its turns grow slower (measured mid-game on a
// desktop, every rule on, Easy: 10 a side about 0.5 s; 30-40 a side on
// 20 x 20, 1.5-4 s; a crowded 28 a side on 14 x 14, 4-9 s; Hard 4-13 s
// with those; slower on a phone).
export const BIG_ARMY = 10;
export const BIG_ARMY_NOTE = "Big armies weaken the computer: it sees fewer turns ahead in its thinking time, and its turns can take longer.";
export const DEFAULT_BOARD_DIM = 10;
export const MAX_MISSING_PAIRS = 5;
// Sets of black holes (user: "add the option to increase the number of
// black hole sets to 2"): a set is a hole and its mirror.
export const MAX_HOLE_SETS = 2;
export { MIN_BOARD_DIM, MAX_BOARD_DIM };
export const clampDim = (v) => Math.max(MIN_BOARD_DIM, Math.min(MAX_BOARD_DIM, Math.round(v)));

/* A selection:
   { counts: {key: n}, laws: {key: bool}, shove: {onRolls, own, chain},
     rows, cols, missing: bool, missingCount: 1..5,
     missingSpots: [{row, col, random}]   one square of each missing pair,
     holeSets: 1..2,                      sets of black holes,
     holeSpots: [{row, col, random}]      one hole of each set,
     holeAnyExit: bool,                   two sets: out of any other hole,
                                          not only the far half's two
     random: bool }                       a shuffled start
   Each spot's partner is its 180° mirror. A spot marked random was rolled
   by the menu (and re-rolls when the board changes size); the others were
   put there by hand. */
export function defaultSelections() {
  const counts = {};
  PIECE_OPTIONS.forEach((p) => { counts[p.key] = p.def; });
  const laws = {};
  LAW_OPTIONS.forEach((l) => { laws[l.key] = !!l.def; });
  return {
    counts, laws, shove: { ...DEFAULT_SHOVE },
    rows: DEFAULT_BOARD_DIM, cols: DEFAULT_BOARD_DIM,
    missing: false, missingCount: 1, missingSpots: [], holeSets: 1, holeSpots: [], holeAnyExit: false,
    random: false,
  };
}
/* The standard game's selections: the five pieces, the 10x10 board and
   no law at all. defaultSelections() is where a custom setup starts
   (the first-turn handicap on, as every non-standard game has it); this
   is what a "Standard" button begins. */
export function standardSelections() {
  const s = defaultSelections();
  LAW_OPTIONS.forEach((l) => { s.laws[l.key] = false; });
  return s;
}
export const cloneSelections = (s) => JSON.parse(JSON.stringify(s));
export const totalPieces = (sel) => Object.values(sel.counts).reduce((a, b) => a + b, 0);

/* Any selection (an older save, another menu's) onto today's defaults,
   key by key, so a new option never breaks an old one. */
export function normalizeSelections(sel) {
  const d = defaultSelections();
  if (!sel || typeof sel !== "object") return d;
  const out = { ...d, ...sel };
  out.counts = { ...d.counts };
  // (An older save: one Arco count, of one size.)
  const oldArco = sel.counts && Number.isFinite(sel.counts.arco) && sel.counts.arco > 0
    ? (ARCO_SIZES.find((a) => a.key === sel.arcoSize) || ARCO_SIZES[0]).type : null;
  PIECE_OPTIONS.forEach((p) => {
    let v = sel.counts && Number.isFinite(sel.counts[p.key]) ? sel.counts[p.key] : p.def;
    if (p.key === oldArco && !(sel.counts && Number.isFinite(sel.counts[p.key]))) v = sel.counts.arco;
    out.counts[p.key] = Math.max(p.min, Math.min(p.max, Math.round(v)));
  });
  out.laws = { ...d.laws };
  // (A law a save doesn't know of keeps its default: Punto is on by default.)
  LAW_OPTIONS.forEach((l) => { out.laws[l.key] = sel.laws && typeof sel.laws[l.key] === "boolean" ? sel.laws[l.key] : !!l.def; });
  // (One Split movement at a time: three pieces wins.)
  if (out.laws.splitThree) out.laws.splitMovement = false;
  // Which moves shove and which pieces a shove pushes (a save from before
  // either setting has today's default, slides only and only opponents;
  // one from when the pieces choice was for rolls only keeps its answer).
  // An older save's push distance is dropped.
  out.shove = shoveOf(sel.shove);
  delete out.arcoSize;
  if (!sel.rows || !sel.cols) { out.rows = sel.size || DEFAULT_BOARD_DIM; out.cols = sel.size || DEFAULT_BOARD_DIM; }
  out.rows = clampDim(out.rows); out.cols = clampDim(out.cols);
  delete out.size;
  out.missing = !!out.missing;
  out.missingCount = Math.max(1, Math.min(MAX_MISSING_PAIRS, Math.round(out.missingCount || 1)));
  out.missingSpots = Array.isArray(out.missingSpots) ? out.missingSpots.filter((p) => p && Number.isFinite(p.row) && Number.isFinite(p.col)).map((p) => ({ row: p.row, col: p.col, random: !!p.random })) : [];
  // (A save from before two sets: one hole's spot.)
  const spotOf = (p) => (p && Number.isFinite(p.row) && Number.isFinite(p.col) ? { row: p.row, col: p.col, random: !!p.random } : null);
  out.holeSets = sel.holeSets === 2 ? 2 : 1;
  out.holeSpots = (Array.isArray(sel.holeSpots) ? sel.holeSpots : [sel.holeSpot]).map(spotOf).filter(Boolean).slice(0, out.holeSets);
  delete out.holeSpot;
  out.holeAnyExit = !!sel.holeAnyExit;
  out.random = !!out.random;
  return out;
}

// What actually changes the game: settings of a feature that's off don't.
function effective(sel) {
  const e = cloneSelections(sel);
  if (!e.laws.shoving) e.shove = { ...DEFAULT_SHOVE };
  if (!e.missing) { e.missingCount = 1; e.missingSpots = []; }
  if (!e.laws.blackHoleSquares) { e.holeSets = 1; e.holeSpots = []; }
  if (e.holeSets !== 2) e.holeAnyExit = false;
  e.missingSpots = (e.missingSpots || []).map((p) => ({ row: p.row, col: p.col }));
  e.holeSpots = (e.holeSpots || []).map((p) => ({ row: p.row, col: p.col }));
  return e;
}
export const isDefaultSelections = (sel) => JSON.stringify(effective(normalizeSelections(sel))) === JSON.stringify(effective(defaultSelections()));

/* ------------------------------------------------------------ pieces */

// The pieces each side gets, as the engine's roster, and whether they're
// anything but the classic five.
const rosterOf = (sel) => PIECE_OPTIONS.map((p) => ({ type: pieceTypeOf(p.key, sel), count: sel.counts[p.key] })).filter((r) => r.count > 0);
const isCustomRoster = (sel) => PIECE_OPTIONS.some((p) => sel.counts[p.key] !== p.def);

/* ------------------------------------------------------------ paired squares */

export const mirrorCell = (row, col, rows, cols) => ({ row: rows - 1 - row, col: cols - 1 - col });
// Every square a list of spots stands for: each spot and its mirror.
export const spotCells = (spots, rows, cols) => (spots || []).flatMap((p) => [{ row: p.row, col: p.col }, mirrorCell(p.row, p.col, rows, cols)]);
const occupied = (pieces, r, c) => (pieces || []).some((p) => r >= p.row && r < p.row + p.h && c >= p.col && c < p.col + p.w);
const listed = (list, r, c) => (list || []).some((a) => a.row === r && a.col === c);
const missingOn = (sel) => sel.missing;
const holesOn = (sel) => sel.laws.blackHoleSquares;
// The squares each feature has chosen, with their mirrors.
export const missingCellsOf = (sel) => (missingOn(sel) ? spotCells(sel.missingSpots, sel.rows, sel.cols) : []);
export const holeCellsOf = (sel) => (holesOn(sel) ? spotCells(sel.holeSpots, sel.rows, sel.cols) : []);
// How many sets of black holes, and their spots, as a selection holds them.
export const holeSetsOf = (sel) => (sel.holeSets === 2 ? 2 : 1);
// Two sets of black holes, a piece coming out of any of the three other
// holes (the switch under Sets), not only the two on the far half.
export const holeAnyExitOn = (sel) => !!(sel.laws.blackHoleSquares && holeSetsOf(sel) === 2 && sel.holeAnyExit);
/* How the holes work, under Sets in every menu (user: "an explanation on
   the setup page for the two black holes, how they work"), worded once
   here. With two sets the player picks only the hole: coming out is the
   normal way, one square past it on the side the piece went in from,
   under the usual rules (user: "You simply have your choice of black hole
   to exit from while still following the normal exit rules and
   restrictions"). */
export const HOLE_SETS_TEXT = {
  1: "A singularity and its partner. A piece that goes into one comes out of the other, one square past it on the same side it went in from, and its turn ends.",
  2: "Two pairs, each with one singularity on each half of the board (a pair shares a colour). A piece that goes into a singularity may come out of either one on the other half: you choose which singularity. It comes out the normal way, one square past that singularity on the same side it went in from, under the usual rules.",
  any: "Two pairs (a pair shares a colour). A piece that goes into a singularity may come out of any of the other three, the one on its own half too: you choose which singularity, not where it lands. It comes out the normal way, one square past that singularity on the same side it went in from, under the usual rules.",
};
export const holeSetsText = (sel) => (holeSetsOf(sel) === 1 ? HOLE_SETS_TEXT[1] : sel.holeAnyExit ? HOLE_SETS_TEXT.any : HOLE_SETS_TEXT[2]);
// The switch under two sets (user: "a toggle switch that allows them to
// exit from any of the three other black holes on the board"; named and
// worded as the user put it: "Rewrite to say "exit from any other
// singularity". Off = Can only exit from singularities on opponent's half
// of the board. On = Can exit from any other singularity on the board."
// and then, of "opponent's half": "I'd rather it say "the other half"."
// The engine's rule is the other half from the one gone into.) Off and
// On are two lines, On starting its own in every menu (user, "On: can"
// ringed: "Red, circled area should start a new line.").
export const HOLE_ANY_EXIT = {
  name: "Exit from any other singularity",
  off: "Off: can only exit from singularities on the other half of the board.",
  on: "On: can exit from any other singularity on the board.",
};
// Black holes never sit in either side's back two rows; missing squares
// may, but never wall the board off.
export const holeRowAllowed = (row, rows) => blackHoleRowAllowed(row, rows);

/* Can a spot be marked for a feature (kind "missing" or "hole") on this
   selection's board: inside it, not its own mirror, off the other
   feature's squares, and (black holes) out of the back rows and clear of
   the other set's holes all round, or (missing squares) leaving every
   square reachable? `keep`: the feature's other spots. Returns a reason
   when not. */
export function spotProblem(sel, kind, row, col, keep = []) {
  const { rows, cols } = sel;
  if (row < 0 || col < 0 || row >= rows || col >= cols) return "off";
  const m = mirrorCell(row, col, rows, cols);
  if (m.row === row && m.col === col) return "centre";
  const other = kind === "hole" ? missingCellsOf(sel) : holeCellsOf(sel);
  if (listed(other, row, col) || listed(other, m.row, m.col)) return "taken";
  if (kind === "hole") {
    if (!holeRowAllowed(row, rows)) return "backRow";
    // (Two sets: a hole beside another could have a piece come out onto it.)
    return spotCells(keep, rows, cols).some((q) => holesTouch(q, { row, col }) || holesTouch(q, m)) ? "near" : null;
  }
  const cells = spotCells([...keep, { row, col }], rows, cols);
  return missingSquaresKeepPath(cells, rows, cols) ? null : "wall";
}

/* Fills a feature's spots up to its count: hand-placed spots stay while
   they still fit, random ones too unless `reroll`, and the rest are rolled
   (off the standard opening for this board, off the other feature's
   squares). As Futuris's sphere does: run when a feature is switched on, on
   Random, when the pair count changes, and (with reroll) when the board
   changes size. Mutates and returns sel. */
export function fillSpots(sel, kind, reroll = false) {
  const { rows, cols } = sel;
  const count = kind === "hole" ? holeSetsOf(sel) : sel.missingCount;
  const current = kind === "hole" ? sel.holeSpots : sel.missingSpots;
  const pieces = initialPiecesFor(rows, cols);
  const avoid = kind === "hole" ? missingCellsOf(sel) : holeCellsOf(sel);
  const kept = [];
  const fits = (p) => {
    if (spotProblem(sel, kind, p.row, p.col, kept)) return false;
    if (listed(spotCells(kept, rows, cols), p.row, p.col)) return false;
    // A rolled spot stays off the standard opening; a hand-placed one may
    // sit on it (the pieces are then set out round it).
    const m = mirrorCell(p.row, p.col, rows, cols);
    return !(p.random && (occupied(pieces, p.row, p.col) || occupied(pieces, m.row, m.col)));
  };
  // (Each spot kept in its place in the list, a new one rolled into a
  // place left empty: a black hole's set keeps its colour in the pickers.)
  const slots = new Array(count).fill(null), extra = [];
  const take = (p, i, random) => {
    const spot = { row: p.row, col: p.col, random };
    kept.push(spot);
    if (i < count && !slots[i]) slots[i] = spot; else extra.push(spot);
  };
  current.forEach((p, i) => { if (!p.random && kept.length < count && fits(p)) take(p, i, false); });
  if (!reroll) current.forEach((p, i) => { if (p.random && kept.length < count && fits(p)) take(p, i, true); });
  for (let tries = 0; kept.length < count && tries < 40; tries++) {
    const pair = kind === "hole"
      ? pickBlackHoleSquares(pieces, rows, cols, avoid, 200, spotCells(kept, rows, cols))
      : pickMissingSquares(pieces, rows, cols, avoid, 200, spotCells(kept, rows, cols));
    if (!pair.length) break;
    if (!spotProblem(sel, kind, pair[0].row, pair[0].col, kept)) take(pair[0], count, true);
  }
  const placed = slots.map((p) => p || extra.shift() || null).filter(Boolean);
  if (kind === "hole") sel.holeSpots = placed;
  else sel.missingSpots = placed;
  return sel;
}
// The Random button: re-rolls the random spots, keeping hand-placed ones,
// or all of them when every spot was placed by hand.
export function randomizeSpots(sel, kind) {
  const spots = kind === "hole" ? sel.holeSpots : sel.missingSpots;
  const count = kind === "hole" ? holeSetsOf(sel) : sel.missingCount;
  if (spots.length >= count && spots.every((p) => !p.random)) {
    if (kind === "hole") sel.holeSpots = []; else sel.missingSpots = [];
  }
  return fillSpots(sel, kind, true);
}

/* One set of black holes or two: the spots trimmed (rolled ones go
   first) or filled to the count. Mutates and returns sel. */
export function setHoleSets(sel, n) {
  sel.holeSets = n === 2 ? 2 : 1;
  const mine = sel.holeSpots.filter((p) => !p.random), rolled = sel.holeSpots.filter((p) => p.random);
  sel.holeSpots = [...mine, ...rolled].slice(0, sel.holeSets);
  return fillSpots(sel, "hole");
}

/* A tap on a free square in a picker of the black holes' place: the spots
   after it, or the problem with that square ({ problem }). With one set
   the hole moves there; with two, the hole of the set the picker's
   buttons are on (`set`, 1 or 2; user: "press the square, see the one
   you've pressed, and then click done to confirm"). Each set keeps its
   place in the list, and so its colour. */
export function holeSpotsAfterTap(sel, row, col, set = 1) {
  const list = sel.holeSpots.slice();
  const i = Math.min(Math.max(0, (set | 0) - 1), holeSetsOf(sel) - 1);
  const rest = list.filter((_, j) => j !== i);
  const problem = spotProblem(sel, "hole", row, col, rest);
  if (problem) return { problem };
  const spot = { row, col, random: false };
  if (i < list.length) list[i] = spot; else list.push(spot);
  return { spots: list };
}
// What a picker says of a square a spot can't go on.
export const SPOT_PROBLEMS = {
  backRow: "Singularities can't go in either side's two back rows.",
  near: "Singularities need a square between them.",
  wall: "That would cut the board in two: every square must still be reachable.",
  centre: "The middle square has no partner. Pick another.",
};
// After a size change: random spots re-roll, hand spots stay if they fit.
export function refreshSpots(sel) {
  if (missingOn(sel)) fillSpots(sel, "missing", true);
  if (holesOn(sel)) fillSpots(sel, "hole", true);
  return sel;
}

/* ------------------------------------------------------------ fitting the pieces */

// Home-band squares (a side's two back rows) the chosen squares take up,
// as the packer's keys (row * cols + col, Dark's band; Light's is its
// mirror, so the same keys).
function bandBlocked(sel, cols = sel.cols) {
  const keys = new Set();
  const rows = sel.rows;
  [...missingCellsOf(sel), ...holeCellsOf(sel)].forEach((c) => {
    if (c.col >= cols) return;
    if (c.row < 2) keys.add(c.row * cols + c.col);
    if (c.row >= rows - 2) keys.add((rows - 1 - c.row) * cols + (cols - 1 - c.col));
  });
  return [...keys];
}
/* Will the chosen pieces set out in a side's two home rows, on a board
   `cols` wide (default: the chosen width), round any chosen squares
   there? The classic five fit any board; anything else is packed for
   real (engine/anomaly.js). */
export function piecesFit(sel, cols = sel.cols) {
  const blocked = cols === sel.cols ? bandBlocked(sel, cols) : [];
  if (!isCustomRoster(sel) && !sel.random && !blocked.length) return true;
  return !!packHomeBand(rosterOf(sel), cols, blocked);
}
// The narrowest board those pieces fit, or null if none does.
export function minColsFor(sel) {
  for (let c = MIN_BOARD_DIM; c <= MAX_BOARD_DIM; c++) if (piecesFit(sel, c)) return c;
  return null;
}
export const boardLabel = (sel) => `${sel.cols} × ${sel.rows}`;

/* ------------------------------------------------------------ laws */

// Turning a law on or off, with what goes with it. (Diagonal slide
// stands on its own, user; it once needed Orthogonal slide.)
export function toggleLaw(sel, key) {
  const on = !sel.laws[key];
  sel.laws[key] = on;
  if (key === "blackHoleSquares" && on) fillSpots(sel, "hole");
  // The two Split movements: one or the other. Three pieces brings 3
  // actions (with 2 points a turn it's no different from two pieces), and
  // goes with them.
  if (key === "splitThree" && on) { sel.laws.splitMovement = false; sel.laws.threeActions = true; }
  if (key === "splitMovement" && on) sel.laws.splitThree = false;
  if (key === "threeActions" && !on) sel.laws.splitThree = false;
  // Shoving on "Slides only" needs Slide (user): Shoving switched on with
  // that already set (the default) brings Slide; Slide switched off while
  // Shoving's on puts it back on "Slides and rolls". (Not while it's off:
  // Slides only is the default it should come on with, user.)
  if (key === "shoving" && on && shoveOf(sel.shove).onRolls === false) sel.laws.slide = true;
  if (key === "slide" && !on && sel.laws.shoving && shoveOf(sel.shove).onRolls === false) sel.shove = { ...shoveOf(sel.shove), onRolls: true };
  return sel;
}
/* Every law at once (user: "a switch ... at the top of all custom setting
   menus to turn all laws on"). On: each law that's off switched on as its
   own switch does it, the two Split movements one or the other (whichever
   is on, else three pieces, which brings its 3 actions); off: every law
   off the same way. All on reads true with either Split movement. `toggle`
   is the menu's own (Futuris's sphere keeps its own selections). Black hole
   squares, set with the board, are left alone, as Missing squares are. */
const SPLITS = ["splitMovement", "splitThree"];
export const allLawsOn = (sel) => RULE_LAWS.every((l) => (SPLITS.includes(l.key) ? SPLITS.some((k) => sel.laws[k]) : !!sel.laws[l.key]));
export function setAllLaws(sel, on, toggle = toggleLaw) {
  if (on) {
    RULE_LAWS.forEach((l) => {
      if (sel.laws[l.key] || l.key === "splitMovement" || (l.key === "splitThree" && sel.laws.splitMovement)) return;
      toggle(sel, l.key);
    });
  } else {
    // (All off: Shoving's setting stays as it was. Slide going off first
    // would have put it on Slides and rolls, for a Shoving that's going.)
    const shove = sel.shove;
    RULE_LAWS.forEach((l) => { if (sel.laws[l.key]) toggle(sel, l.key); });
    if (shove) sel.shove = shove;
  }
  return sel;
}
// Shoving's setting: "Slides only" brings Slide (user: "make slides only
// turn on Slide"), as Diagonal slide does.
export function setShove(sel, key, value) {
  sel.shove = { ...(sel.shove || {}), [key]: value };
  if (key === "onRolls" && value === false) sel.laws.slide = true;
  return sel;
}
// What actually shoves with the rules as they're set, for the line under
// Shoving's settings (the chassis's words). It changes as Slide is ticked.
export const shoveNow = (sel) => shoveNowFor(sel.shove, sel.laws);
// What the engine gets: the laws (a diagonal slide only with Slide),
// Shoving's setting and, with two sets of black holes, where they let out.
export function lawsForEngine(sel) {
  const l = sel.laws;
  const three = !!(l.splitThree && l.threeActions);
  return { ...l, diagonalSlide: !!l.diagonalSlide, splitThree: three, splitMovement: !!l.splitMovement || three, ...shoveLaws(sel.shove), holeAnyExit: holeAnyExitOn(sel) };
}
// Pieces that can ever stand balanced on one cube (so can pivot).
export const PIVOT_CAPABLE = ["codo", "hombro", "cruce", "rayo", "zeta"];
/* A law that's on but can't do anything with the other choices, and why
   (as Futuris's sphere warns): { key, testid, text } for each. */
export function lawWarnings(sel) {
  const out = [];
  const l = sel.laws;
  if (l.cantileverPivot && !PIVOT_CAPABLE.some((k) => sel.counts[k] > 0))
    out.push({ key: "cantileverPivot", testid: "law-warning-cantileverPivot", text: "Only a Codo, Hombro, Cruce, Rayo or Zeta can pivot. Order one under Pieces." });
  if (l.shoving) {
    if (shoveOf(sel.shove).onRolls) {
      // Every Opa move costs 2 and a shove 1 more: an Opa only shoves with 3.
      if (sel.counts.opa > 0 && !l.threeActions)
        out.push({ key: "shoving", testid: "shove-opa-needs-three", text: "An Opa's shove costs 3 actions, so Opas only shove with 3 actions per turn." });
    } else if (!l.slide) {
      // Slides only: nothing shoves without the Slide rule.
      out.push({ key: "shoving", testid: "shove-needs-slide", text: "Slides only needs Orthogonal slide. Check it, or let rolls shove too." });
    }
    // (No callout that a shoving slide, 2 + 1, needs 3 actions a turn: user,
    // 2026-10-17, "get rid of the callout with the hand pointing at it
    // completely"; Futuris's sphere dropped its own too.)
  }
  return out;
}

/* ------------------------------------------------------------ the summary */

// "Shoving (slides and rolls)", "Shoving (slides only)" and, set to the
// opponent's pieces, "Shoving (slides only, only opponents)", for the
// summary.
export const shovingName = (sel) => `Shoving (${shoveSummary(sel.shove)})`;
const pieceName = (p) => p.name;

/* What the choices change, for the chassis's current-rules panel and its
   "Reset rules" state (a null list is a plain game). `labels` names the
   three groups in the theme's own words. */
export function variantsOf(sel, labels = {}) {
  const L = { laws: "LAWS", matter: "MATTER", topologies: "TOPOLOGY", ...labels };
  const groups = [];
  const lawsOn = RULE_LAWS.filter((l) => sel.laws[l.key]);
  if (lawsOn.length) groups.push({ key: "laws", label: L.laws, items: lawsOn.map((l) => (l.key === "shoving" ? shovingName(sel) : l.name)), keys: lawsOn.map((l) => l.key) });
  const matter = PIECE_OPTIONS.filter((p) => sel.counts[p.key] !== p.def).map((p) => `${sel.counts[p.key]}× ${pieceName(p)}`);
  if (sel.random) matter.unshift("Randomized start");
  if (matter.length) groups.push({ key: "matter", label: L.matter, items: matter });
  const topo = [];
  if (sel.rows !== DEFAULT_BOARD_DIM || sel.cols !== DEFAULT_BOARD_DIM) topo.push(`${boardLabel(sel)} board`);
  if (sel.missing) topo.push(`Missing squares (${sel.missingCount} ${sel.missingCount === 1 ? "pair" : "pairs"})`);
  // (With the board, as the menus set it; two sets say so.)
  if (sel.laws.blackHoleSquares) topo.push(holeSetsOf(sel) === 2 ? `${HOLES_LAW.name} (2 sets${holeAnyExitOn(sel) ? ", exit from any other singularity" : ""})` : HOLES_LAW.name);
  if (topo.length) groups.push({ key: "topologies", label: L.topologies, items: topo });
  return groups.length ? groups : null;
}

/* ------------------------------------------------------------ applying them */

/* Missing squares and black holes for a game, against the pieces actually
   placed: every chosen spot still clear of them (and of each other, and,
   for missing squares, keeping a path) is used; any that isn't is
   replaced by a fair random one. As Futuris's buildMissingSquaresPlacement /
   buildBlackHolePlacement. */
function placeMissing(sel, rows, cols, pieces) {
  const out = [];
  (sel.missingSpots || []).forEach((p) => {
    if (out.length >= sel.missingCount * 2 || p.row >= rows || p.col >= cols) return;
    const m = mirrorCell(p.row, p.col, rows, cols);
    if (m.row === p.row && m.col === p.col) return;
    if (occupied(pieces, p.row, p.col) || occupied(pieces, m.row, m.col) || listed(out, p.row, p.col)) return;
    const pair = [{ row: p.row, col: p.col }, m];
    if (!missingSquaresKeepPath([...out, ...pair], rows, cols)) return;
    out.push(...pair);
  });
  while (out.length < sel.missingCount * 2) {
    const pair = pickMissingSquares(pieces, rows, cols, [], 200, out);
    if (!pair.length) break;
    out.push(...pair);
  }
  return out;
}
function placeHoles(sel, rows, cols, pieces, avoid) {
  const out = [];
  (sel.holeSpots || []).forEach((p) => {
    if (out.length >= holeSetsOf(sel) * 2 || p.row >= rows || p.col >= cols || !blackHoleRowAllowed(p.row, rows)) return;
    const m = mirrorCell(p.row, p.col, rows, cols);
    const free = (c) => !occupied(pieces, c.row, c.col) && !listed(avoid, c.row, c.col) && !out.some((q) => holesTouch(q, c));
    if (!(m.row === p.row && m.col === p.col) && free(p) && free(m)) out.push({ row: p.row, col: p.col }, m);
  });
  return pickBlackHoleSets(pieces, rows, cols, holeSetsOf(sel), avoid, out);
}

/* Sets the board up as chosen: board size first, then the pieces (set
   out round any chosen squares), the laws, missing squares and black
   holes (the order Futuris's sphere uses). `x` is the theme's setup extras
   (the chassis setters); `opts.labels` names the summary's groups. */
export function applySelections(sel, x, opts = {}) {
  x.applyBoardResize && x.applyBoardResize(sel.rows, sel.cols);
  setActiveLaws(lawsForEngine(sel));
  const { rows, cols } = getBoardDimensions();
  const chosen = [...(missingOn(sel) ? sel.missingSpots : []), ...(holesOn(sel) ? sel.holeSpots : [])]
    .filter((p) => p.row < rows && p.col < cols).map((p) => ({ row: p.row, col: p.col }));
  let placed;
  if (isCustomRoster(sel) || sel.random) placed = generateAnomalySetup(rosterOf(sel), chosen);
  else {
    placed = createInitialPieces();
    const clash = spotCells(chosen, rows, cols).some((c) => occupied(placed, c.row, c.col));
    if (clash) placed = generateAnomalySetup(rosterOf(sel), chosen);
  }
  x.setPieces && x.setPieces(placed);
  const missing = missingOn(sel) ? placeMissing(sel, rows, cols, placed) : [];
  const holes = holesOn(sel) ? placeHoles(sel, rows, cols, placed, missing) : [];
  setMissingSquares(missing); x.setMissingSquares && x.setMissingSquares(missing);
  setBlackHoles(holes); x.setBlackHoles && x.setBlackHoles(holes);
  x.setCurrentVariants && x.setCurrentVariants(variantsOf(sel, opts.labels));
  return { pieces: placed, missing, holes };
}

/* Applies the choices and begins the game, and registers them with the
   chassis so New Game replays them (and a finished game's "change the
   rules" reopens the menu, through `reopen`). A plain default game
   registers nothing. */
export function beginCustomGame(sel, x, reopen, opts = {}) {
  const t = x.three && x.three.current;
  const snapshot = normalizeSelections(cloneSelections(sel));
  applySelections(snapshot, x, opts);
  if (t) {
    if (isDefaultSelections(snapshot)) {
      t.singularityGameActive = false;
      t.reapplySingularitySetup = null;
      t.reconfigureSingularitySetup = null;
    } else {
      t.singularityGameActive = true;
      t.reapplySingularitySetup = () => applySelections(snapshot, x, opts);
      t.reconfigureSingularitySetup = () => reopen && reopen(snapshot);
    }
  }
  x.triggerBeginGame && x.triggerBeginGame();
}
