/* Custom rules as a set of choices: which pieces each side gets, which
   laws are on, and the board (size, missing squares, a shuffled start).
   Shared by the themes whose menus set them (Lluvia's city, Tienda's
   order form); the menus only draw the choices, this module applies
   them to a real game.

   Theme-agnostic and React-free, so it imports in plain Node for the
   smoke tests. */

import { setActiveLaws, setBlackHoles, setMissingSquares, getBoardDimensions } from "../engine/constants.js";
import { createInitialPieces, pickBlackHoleSquares, pickMissingSquarePairs } from "../engine/rules.js";
import { generateAnomalySetup } from "../engine/anomaly.js";

// Pieces per side: min, max and the classic game's count.
export const PIECE_OPTIONS = [
  { key: "cabeza", name: "Cabeza", min: 1, max: 2, def: 1 },
  { key: "turrito", name: "Turrito", min: 0, max: 3, def: 1 },
  { key: "flaco", name: "Flaco", min: 0, max: 3, def: 1 },
  { key: "chato", name: "Chato", min: 0, max: 3, def: 1 },
  { key: "opa", name: "Opa", min: 0, max: 3, def: 1 },
  { key: "codo", name: "Codo", min: 0, max: 3, def: 0 },
  { key: "arco", name: "Arco", min: 0, max: 3, def: 0 },
  { key: "rayo", name: "Rayo", min: 0, max: 3, def: 0 },
  { key: "zeta", name: "Zeta", min: 0, max: 3, def: 0 },
];
// The Arco offered here is the small one.
const PIECE_TYPE = { arco: "arcoChico" };

export const LAW_OPTIONS = [
  { key: "slide", name: "Slide", note: "Move one square without rolling. 2 points." },
  { key: "diagonalSlide", name: "Diagonal slide", note: "Slides may go corner to corner. Needs Slide." },
  { key: "blackHoleSquares", name: "Black hole squares", note: "Enter one, come out of the other." },
  { key: "threeActions", name: "3 actions per turn", note: "One more point each turn." },
  { key: "shoving", name: "Shoving", note: "Bigger pieces push smaller ones. 1 point more." },
  { key: "cantileverPivot", name: "Cantilever pivot", note: "A Codo, Rayo or Zeta on one cube swings round it." },
  { key: "splitMovement", name: "Split movement", note: "Spread a turn over two pieces." },
];

export const SIZES = [8, 10, 12];
export const MAX_PIECES = 10;
export const DEFAULT_BOARD_DIM = 10;

export function defaultSelections() {
  const counts = {};
  PIECE_OPTIONS.forEach((p) => { counts[p.key] = p.def; });
  const laws = {};
  LAW_OPTIONS.forEach((l) => { laws[l.key] = false; });
  return { counts, laws, size: DEFAULT_BOARD_DIM, missing: false, random: false };
}
export const cloneSelections = (s) => JSON.parse(JSON.stringify(s));
export const totalPieces = (sel) => Object.values(sel.counts).reduce((a, b) => a + b, 0);
export const isDefaultSelections = (sel) => JSON.stringify(sel) === JSON.stringify(defaultSelections());

// Turning a law on or off, with the one dependency between them:
// Diagonal slide needs Slide.
export function toggleLaw(sel, key) {
  const on = !sel.laws[key];
  sel.laws[key] = on;
  if (key === "diagonalSlide" && on) sel.laws.slide = true;
  if (key === "slide" && !on) sel.laws.diagonalSlide = false;
  return sel;
}

/* What the choices change, for the chassis's "Reset rules" state (a null
   list is a plain game). */
export function variantsOf(sel) {
  const groups = [];
  const lawsOn = LAW_OPTIONS.filter((l) => sel.laws[l.key]);
  if (lawsOn.length) groups.push({ key: "laws", label: "LAWS", items: lawsOn.map((l) => l.name), keys: lawsOn.map((l) => l.key) });
  const matter = PIECE_OPTIONS.filter((p) => sel.counts[p.key] !== p.def).map((p) => `${sel.counts[p.key]}× ${p.name}`);
  if (sel.random) matter.unshift("Randomized start");
  if (matter.length) groups.push({ key: "matter", label: "MATTER", items: matter });
  const topo = [];
  if (sel.size !== DEFAULT_BOARD_DIM) topo.push(`${sel.size} × ${sel.size} board`);
  if (sel.missing) topo.push("Missing squares");
  if (topo.length) groups.push({ key: "topologies", label: "TOPOLOGY", items: topo });
  return groups.length ? groups : null;
}

/* Sets the board up as chosen: board size first, then the pieces, the
   laws, missing squares and black holes (the order Neon's sphere uses).
   `x` is the theme's setup extras (the chassis setters). */
export function applySelections(sel, x) {
  x.applyBoardResize && x.applyBoardResize(sel.size, sel.size);
  const laws = { ...sel.laws, diagonalSlide: sel.laws.diagonalSlide && sel.laws.slide, shoveFar: false, shoveOnRolls: false };
  setActiveLaws(laws);
  const roster = PIECE_OPTIONS.map((p) => ({ type: PIECE_TYPE[p.key] || p.key, count: sel.counts[p.key] })).filter((r) => r.count > 0);
  const customRoster = PIECE_OPTIONS.some((p) => sel.counts[p.key] !== p.def);
  const placed = customRoster || sel.random ? generateAnomalySetup(roster, []) : createInitialPieces();
  x.setPieces && x.setPieces(placed);
  const { rows, cols } = getBoardDimensions();
  const missing = sel.missing ? pickMissingSquarePairs(placed, rows, cols, 2, []) : [];
  const holes = laws.blackHoleSquares ? pickBlackHoleSquares(placed, rows, cols, missing) : [];
  setMissingSquares(missing); x.setMissingSquares && x.setMissingSquares(missing);
  setBlackHoles(holes); x.setBlackHoles && x.setBlackHoles(holes);
  x.setCurrentVariants && x.setCurrentVariants(variantsOf(sel));
}

/* Applies the choices and begins the game, and registers them with the
   chassis so New Game replays them (and a finished game's "change the
   rules" reopens the menu, through `reopen`). A plain default game
   registers nothing. */
export function beginCustomGame(sel, x, reopen) {
  const t = x.three && x.three.current;
  const snapshot = cloneSelections(sel);
  applySelections(snapshot, x);
  if (t) {
    if (isDefaultSelections(snapshot)) {
      t.singularityGameActive = false;
      t.reapplySingularitySetup = null;
      t.reconfigureSingularitySetup = null;
    } else {
      t.singularityGameActive = true;
      t.reapplySingularitySetup = () => applySelections(snapshot, x);
      t.reconfigureSingularitySetup = () => reopen && reopen(snapshot);
    }
  }
  x.triggerBeginGame && x.triggerBeginGame();
}
