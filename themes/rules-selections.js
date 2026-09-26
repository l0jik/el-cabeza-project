/* Custom rules as a set of choices: which pieces each side gets, which
   laws are on (and how Shoving works), and the board (its size, missing
   squares and the black holes' place, a shuffled start). The same
   choices Neon's Singularity sphere offers, shared by the themes whose
   menus set them (Lluvia's city, Tienda's order form); the menus only
   draw the choices, this module applies them to a real game.

   Theme-agnostic and React-free, so it imports in plain Node for the
   smoke tests. */

import { setActiveLaws, setBlackHoles, setMissingSquares, getBoardDimensions, MIN_BOARD_DIM, MAX_BOARD_DIM } from "../engine/constants.js";
import {
  createInitialPieces, initialPiecesFor, pickBlackHoleSquares, pickMissingSquares, missingSquaresKeepPath, blackHoleRowAllowed,
} from "../engine/rules.js";
import { generateAnomalySetup, packHomeBand } from "../engine/anomaly.js";

/* ------------------------------------------------------------ the choices */

// Pieces per side: min, max and the classic game's count (as Neon's MATTER).
export const PIECE_OPTIONS = [
  { key: "cabeza", name: "Cabeza", min: 1, max: 2, def: 1 },
  { key: "turrito", name: "Turrito", min: 0, max: 4, def: 1 },
  { key: "flaco", name: "Flaco", min: 0, max: 4, def: 1 },
  { key: "chato", name: "Chato", min: 0, max: 4, def: 1 },
  { key: "opa", name: "Opa", min: 0, max: 4, def: 1 },
  { key: "block1x3", name: "1×3 Block", min: 0, max: 4, def: 0 },
  { key: "block2x3", name: "2×3 Block", min: 0, max: 4, def: 0 },
  { key: "codo", name: "Codo", min: 0, max: 4, def: 0 },
  { key: "arco", name: "Arco", min: 0, max: 4, def: 0 },
  { key: "rayo", name: "Rayo", min: 0, max: 4, def: 0 },
  { key: "zeta", name: "Zeta", min: 0, max: 4, def: 0 },
];
// The Arco comes in three sizes; every Arco in a game is the same size.
export const ARCO_SIZES = [
  { key: "chico", name: "Chico", type: "arcoChico", note: "3 wide, 2 tall" },
  { key: "alto", name: "Alto", type: "arcoAlto", note: "3 wide, 3 tall" },
  { key: "ancho", name: "Ancho", type: "arcoAncho", note: "4 wide, 2 tall" },
];
// The engine's piece type for an option.
export function pieceTypeOf(key, sel) {
  if (key !== "arco") return key;
  const size = ARCO_SIZES.find((a) => a.key === (sel && sel.arcoSize)) || ARCO_SIZES[0];
  return size.type;
}

export const LAW_OPTIONS = [
  { key: "slide", name: "Slide", note: "Move a piece one open square without tipping it. 2 points (a roll is 1)." },
  { key: "diagonalSlide", name: "Diagonal slide", note: "Slides may go corner to corner. Needs Slide." },
  { key: "blackHoleSquares", name: "Black hole squares", note: "Two linked squares: a one-square piece that goes in one comes out beside the other. Ends the turn." },
  { key: "threeActions", name: "3 actions per turn", note: "3 points a turn instead of 2." },
  { key: "shoving", name: "Shoving", note: "A piece moving into one with fewer cubes pushes it along. 1 point more." },
  { key: "cantileverPivot", name: "Cantilever pivot", note: "A Codo, Rayo or Zeta standing on one cube turns a quarter turn round it. 1 point." },
  { key: "splitMovement", name: "Split movement", note: "Spend a turn's points on up to two pieces." },
];
// Shoving's two settings (as Neon's): how far a shove pushes, and which
// moves shove.
export const SHOVE_SETTINGS = [
  { key: "far", name: "Push distance", options: [{ value: false, name: "1 square" }, { value: true, name: "As far as it travels" }] },
  { key: "onRolls", name: "Shoves on", options: [{ value: false, name: "Slides only" }, { value: true, name: "Slides and rolls" }] },
];

// The board: rows (from one side's home row to the other's) and columns
// (across, the width of a home row), each MIN_BOARD_DIM to MAX_BOARD_DIM.
// SIZES are square quick picks.
export const SIZES = [8, 10, 12];
export const MAX_PIECES = 10;
export const DEFAULT_BOARD_DIM = 10;
export const MAX_MISSING_PAIRS = 5;
export { MIN_BOARD_DIM, MAX_BOARD_DIM };
export const clampDim = (v) => Math.max(MIN_BOARD_DIM, Math.min(MAX_BOARD_DIM, Math.round(v)));

/* A selection:
   { counts: {key: n}, arcoSize, laws: {key: bool}, shove: {far, onRolls},
     rows, cols, missing: bool, missingCount: 1..5,
     missingSpots: [{row, col, random}]   one square of each missing pair,
     holeSpot: {row, col, random} | null  one of the two black holes,
     random: bool }                       a shuffled start
   Each spot's partner is its 180° mirror. A spot marked random was rolled
   by the menu (and re-rolls when the board changes size); the others were
   put there by hand. */
export function defaultSelections() {
  const counts = {};
  PIECE_OPTIONS.forEach((p) => { counts[p.key] = p.def; });
  const laws = {};
  LAW_OPTIONS.forEach((l) => { laws[l.key] = false; });
  return {
    counts, arcoSize: "chico", laws, shove: { far: false, onRolls: false },
    rows: DEFAULT_BOARD_DIM, cols: DEFAULT_BOARD_DIM,
    missing: false, missingCount: 1, missingSpots: [], holeSpot: null,
    random: false,
  };
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
  PIECE_OPTIONS.forEach((p) => {
    const v = sel.counts && Number.isFinite(sel.counts[p.key]) ? sel.counts[p.key] : p.def;
    out.counts[p.key] = Math.max(p.min, Math.min(p.max, Math.round(v)));
  });
  out.laws = { ...d.laws };
  LAW_OPTIONS.forEach((l) => { out.laws[l.key] = !!(sel.laws && sel.laws[l.key]); });
  out.shove = { far: !!(sel.shove && sel.shove.far), onRolls: !!(sel.shove && sel.shove.onRolls) };
  if (!ARCO_SIZES.some((a) => a.key === out.arcoSize)) out.arcoSize = "chico";
  if (!sel.rows || !sel.cols) { out.rows = sel.size || DEFAULT_BOARD_DIM; out.cols = sel.size || DEFAULT_BOARD_DIM; }
  out.rows = clampDim(out.rows); out.cols = clampDim(out.cols);
  delete out.size;
  out.missing = !!out.missing;
  out.missingCount = Math.max(1, Math.min(MAX_MISSING_PAIRS, Math.round(out.missingCount || 1)));
  out.missingSpots = Array.isArray(out.missingSpots) ? out.missingSpots.filter((p) => p && Number.isFinite(p.row) && Number.isFinite(p.col)).map((p) => ({ row: p.row, col: p.col, random: !!p.random })) : [];
  out.holeSpot = out.holeSpot && Number.isFinite(out.holeSpot.row) ? { row: out.holeSpot.row, col: out.holeSpot.col, random: !!out.holeSpot.random } : null;
  out.random = !!out.random;
  return out;
}

// What actually changes the game: settings of a feature that's off don't.
function effective(sel) {
  const e = cloneSelections(sel);
  if (!e.laws.shoving) e.shove = { far: false, onRolls: false };
  if (!e.counts.arco) e.arcoSize = "chico";
  if (!e.missing) { e.missingCount = 1; e.missingSpots = []; }
  if (!e.laws.blackHoleSquares) e.holeSpot = null;
  e.missingSpots = (e.missingSpots || []).map((p) => ({ row: p.row, col: p.col }));
  if (e.holeSpot) e.holeSpot = { row: e.holeSpot.row, col: e.holeSpot.col };
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
export const holeCellsOf = (sel) => (holesOn(sel) && sel.holeSpot ? spotCells([sel.holeSpot], sel.rows, sel.cols) : []);
// Black holes never sit in either side's back two rows; missing squares
// may, but never wall the board off.
export const holeRowAllowed = (row, rows) => blackHoleRowAllowed(row, rows);

/* Can a spot be marked for a feature (kind "missing" or "hole") on this
   selection's board: inside it, not its own mirror, off the other
   feature's squares, and (black holes) out of the back rows or (missing
   squares) leaving every square reachable? Returns a reason when not. */
export function spotProblem(sel, kind, row, col, keep = []) {
  const { rows, cols } = sel;
  if (row < 0 || col < 0 || row >= rows || col >= cols) return "off";
  const m = mirrorCell(row, col, rows, cols);
  if (m.row === row && m.col === col) return "centre";
  const other = kind === "hole" ? missingCellsOf(sel) : holeCellsOf(sel);
  if (listed(other, row, col) || listed(other, m.row, m.col)) return "taken";
  if (kind === "hole") return holeRowAllowed(row, rows) ? null : "backRow";
  const cells = spotCells([...keep, { row, col }], rows, cols);
  return missingSquaresKeepPath(cells, rows, cols) ? null : "wall";
}

/* Fills a feature's spots up to its count: hand-placed spots stay while
   they still fit, random ones too unless `reroll`, and the rest are rolled
   (off the standard opening for this board, off the other feature's
   squares). As Neon's sphere does: run when a feature is switched on, on
   Random, when the pair count changes, and (with reroll) when the board
   changes size. Mutates and returns sel. */
export function fillSpots(sel, kind, reroll = false) {
  const { rows, cols } = sel;
  const count = kind === "hole" ? 1 : sel.missingCount;
  const current = kind === "hole" ? (sel.holeSpot ? [sel.holeSpot] : []) : sel.missingSpots;
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
  current.filter((p) => !p.random).forEach((p) => { if (kept.length < count && fits(p)) kept.push({ row: p.row, col: p.col, random: false }); });
  if (!reroll) current.filter((p) => p.random).forEach((p) => { if (kept.length < count && fits(p)) kept.push({ row: p.row, col: p.col, random: true }); });
  for (let tries = 0; kept.length < count && tries < 40; tries++) {
    const pair = kind === "hole"
      ? pickBlackHoleSquares(pieces, rows, cols, avoid)
      : pickMissingSquares(pieces, rows, cols, avoid, 200, spotCells(kept, rows, cols));
    if (!pair.length) break;
    const spot = { row: pair[0].row, col: pair[0].col, random: true };
    if (!spotProblem(sel, kind, spot.row, spot.col, kept)) kept.push(spot);
  }
  if (kind === "hole") sel.holeSpot = kept[0] || null;
  else sel.missingSpots = kept;
  return sel;
}
// The Random button: re-rolls the random spots, keeping hand-placed ones,
// or all of them when every spot was placed by hand.
export function randomizeSpots(sel, kind) {
  const spots = kind === "hole" ? (sel.holeSpot ? [sel.holeSpot] : []) : sel.missingSpots;
  const count = kind === "hole" ? 1 : sel.missingCount;
  if (spots.length >= count && spots.every((p) => !p.random)) {
    if (kind === "hole") sel.holeSpot = null; else sel.missingSpots = [];
  }
  return fillSpots(sel, kind, true);
}
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

// Turning a law on or off, with the one dependency between them:
// Diagonal slide needs Slide.
export function toggleLaw(sel, key) {
  const on = !sel.laws[key];
  sel.laws[key] = on;
  if (key === "diagonalSlide" && on) sel.laws.slide = true;
  if (key === "slide" && !on) sel.laws.diagonalSlide = false;
  if (key === "blackHoleSquares" && on) fillSpots(sel, "hole");
  return sel;
}
// What the engine gets: the laws plus Shoving's settings.
export function lawsForEngine(sel) {
  const l = sel.laws;
  return { ...l, diagonalSlide: l.diagonalSlide && l.slide, shoveFar: !!(l.shoving && sel.shove.far), shoveOnRolls: !!(l.shoving && sel.shove.onRolls) };
}
// Pieces that can ever stand balanced on one cube (so can pivot).
const PIVOT_CAPABLE = ["codo", "rayo", "zeta"];
/* A law that's on but can't do anything with the other choices, and why
   (as Neon's sphere warns): { key, testid, text } for each. */
export function lawWarnings(sel) {
  const out = [];
  const l = sel.laws;
  if (l.cantileverPivot && !PIVOT_CAPABLE.some((k) => sel.counts[k] > 0))
    out.push({ key: "cantileverPivot", testid: "law-warning-cantileverPivot", text: "Only a Codo, Rayo or Zeta can pivot. Order one under Pieces." });
  if (l.shoving) {
    if (sel.shove.onRolls) {
      if (sel.counts.opa > 0 && !l.threeActions)
        out.push({ key: "shoving", testid: "shove-opa-needs-three", text: "An Opa's shove costs 3 points, so Opas only shove with 3 actions per turn." });
    } else if (!l.slide) {
      out.push({ key: "shoving", testid: "shove-needs-slide", text: "Slides only needs the Slide rule. Check Slide, or let rolls shove too." });
    } else if (!l.threeActions) {
      out.push({ key: "shoving", testid: "shove-needs-three", text: "A shoving slide costs 3 points, so slides only needs 3 actions per turn. Check it, or let rolls shove too." });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the summary */

const shovingName = (sel) => `Shoving (${sel.shove.far ? "as far as it travels" : "1 square"}, ${sel.shove.onRolls ? "slides and rolls" : "slides only"})`;
const pieceName = (p, sel) => (p.key === "arco" ? `Arco ${(ARCO_SIZES.find((a) => a.key === sel.arcoSize) || ARCO_SIZES[0]).name}` : p.name);

/* What the choices change, for the chassis's current-rules panel and its
   "Reset rules" state (a null list is a plain game). `labels` names the
   three groups in the theme's own words. */
export function variantsOf(sel, labels = {}) {
  const L = { laws: "LAWS", matter: "MATTER", topologies: "TOPOLOGY", ...labels };
  const groups = [];
  const lawsOn = LAW_OPTIONS.filter((l) => sel.laws[l.key]);
  if (lawsOn.length) groups.push({ key: "laws", label: L.laws, items: lawsOn.map((l) => (l.key === "shoving" ? shovingName(sel) : l.name)), keys: lawsOn.map((l) => l.key) });
  const matter = PIECE_OPTIONS.filter((p) => sel.counts[p.key] !== p.def || (p.key === "arco" && sel.counts.arco && sel.arcoSize !== "chico")).map((p) => `${sel.counts[p.key]}× ${pieceName(p, sel)}`);
  if (sel.random) matter.unshift("Randomized start");
  if (matter.length) groups.push({ key: "matter", label: L.matter, items: matter });
  const topo = [];
  if (sel.rows !== DEFAULT_BOARD_DIM || sel.cols !== DEFAULT_BOARD_DIM) topo.push(`${boardLabel(sel)} board`);
  if (sel.missing) topo.push(`Missing squares (${sel.missingCount} ${sel.missingCount === 1 ? "pair" : "pairs"})`);
  if (topo.length) groups.push({ key: "topologies", label: L.topologies, items: topo });
  return groups.length ? groups : null;
}

/* ------------------------------------------------------------ applying them */

/* Missing squares and black holes for a game, against the pieces actually
   placed: every chosen spot still clear of them (and of each other, and,
   for missing squares, keeping a path) is used; any that isn't is
   replaced by a fair random one. As Neon's buildMissingSquaresPlacement /
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
  const p = sel.holeSpot;
  if (p && p.row < rows && p.col < cols && blackHoleRowAllowed(p.row, rows)) {
    const m = mirrorCell(p.row, p.col, rows, cols);
    const free = (c) => !occupied(pieces, c.row, c.col) && !listed(avoid, c.row, c.col);
    if (!(m.row === p.row && m.col === p.col) && free(p) && free(m)) return [{ row: p.row, col: p.col }, m];
  }
  return pickBlackHoleSquares(pieces, rows, cols, avoid);
}

/* Sets the board up as chosen: board size first, then the pieces (set
   out round any chosen squares), the laws, missing squares and black
   holes (the order Neon's sphere uses). `x` is the theme's setup extras
   (the chassis setters); `opts.labels` names the summary's groups. */
export function applySelections(sel, x, opts = {}) {
  x.applyBoardResize && x.applyBoardResize(sel.rows, sel.cols);
  setActiveLaws(lawsForEngine(sel));
  const { rows, cols } = getBoardDimensions();
  const chosen = [...(missingOn(sel) ? sel.missingSpots : []), ...(holesOn(sel) && sel.holeSpot ? [sel.holeSpot] : [])]
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
