/* AI-vs-AI simulator: plays whole games in Node with the real engine and
   AI (no browser) and reports how each side spends its turns — which
   piece types it moves, how often a turn is "Cabeza only", crushes, and
   who wins. Used to tune AI_DIFFICULTY and the evaluation; not part of
   `npm test` (a run takes minutes).

     node tests/ai-sim.mjs [scenario] [darkTier] [lightTier] [games] [timeScale]

   scenario: classic | rayo (Rayo + 1x3 + classic blocks, Split Movement + Slides) | matter (2 Cabezas, 2 Codos, an Arco Chico and the
   classic blocks, Split Movement + Shoving + Slides) | holes (classic
   pieces with Black Holes and Missing Squares). A tier may be
   easy/medium/hard, optionally suffixed ":old" to play it with another
   copy of the AI module (path in the AI_OLD environment variable) for
   before/after comparisons.
   timeScale multiplies every time budget (default 1). AI_OVERRIDE (JSON,
   e.g. '{"medium":{"beam":12}}') overrides settings of the new AI's
   tiers for an experiment. */
import {
  setActiveLaws, setBlackHoles, setMissingSquares, GOAL_ROW, BOARD_ROWS, BOARD_COLS,
} from "../engine/constants.js";
import { createInitialPieces, pickBlackHoleSquares, pickMissingSquares } from "../engine/rules.js";
import { findBestAiTurn, generateTurns, AI_DIFFICULTY, lastSearchInfo } from "../engine/ai.js";
import { generateAnomalySetup } from "../themes/neon.js";

const [scenario = "classic", darkTier = "medium", lightTier = "medium", gamesArg = "4", scaleArg = "1"] = process.argv.slice(2);
const GAMES = Number(gamesArg);
const TIME_SCALE = Number(scaleArg);
const TURN_CAP = 120; // turns per game (both sides) before it's called a draw

const oldAi = process.env.AI_OLD ? await import(process.env.AI_OLD) : null;
function tierConfig(name) {
  const [tier, which] = name.split(":");
  const ai = which === "old" ? oldAi : { findBestAiTurn, AI_DIFFICULTY };
  if (!ai) throw new Error("set AI_OLD to the other AI module's path");
  // AI_OVERRIDE='{"medium":{"beam":12}}' tries settings on the new AI's tiers.
  const override = which === "old" ? {} : (JSON.parse(process.env.AI_OVERRIDE || "{}")[tier] || {});
  const cfg = ai.AI_DIFFICULTY[tier] && { ...ai.AI_DIFFICULTY[tier], ...override };
  if (!cfg) throw new Error(`unknown tier ${name}`);
  return { ...cfg, timeBudgetMs: cfg.timeBudgetMs * TIME_SCALE, find: ai.findBestAiTurn, info: ai.lastSearchInfo || lastSearchInfo };
}

function setupScenario() {
  setActiveLaws({ splitMovement: false, slide: false, diagonalSlide: false, blackHoleSquares: false, threeActions: false, shoving: false, shoveFar: false, shoveOnRolls: false, cantileverPivot: false });
  setBlackHoles([]);
  setMissingSquares([]);
  if (scenario === "classic") return createInitialPieces();
  if (scenario === "matter") {
    setActiveLaws({ splitMovement: true, shoving: true, shoveOnRolls: true, slide: true });
    return generateAnomalySetup([
      { type: "opa", count: 1 }, { type: "chato", count: 1 }, { type: "flaco", count: 1 },
      { type: "turrito", count: 1 }, { type: "cabeza", count: 2 }, { type: "codo", count: 2 },
      { type: "arcoChico", count: 1 },
    ]);
  }
  if (scenario === "user") {
    // The user's reported game: 3 Actions Per Turn, Slide, Cantilever
    // Pivot; one of each classic block plus a Codo, a 1x3 and an Arco Alto.
    setActiveLaws({ threeActions: true, slide: true, cantileverPivot: true });
    return generateAnomalySetup([
      { type: "opa", count: 1 }, { type: "chato", count: 1 }, { type: "flaco", count: 1 },
      { type: "turrito", count: 1 }, { type: "cabeza", count: 1 }, { type: "codo", count: 1 },
      { type: "block1x3", count: 1 }, { type: "arcoAlto", count: 1 },
    ]);
  }
  if (scenario === "rayo") {
    // The second reported game: Slide + Split Movement, a Rayo and a 1x3
    // alongside the classic blocks. Medium walked its Cabeza alone for
    // six turns and lost it to a two-roll Flaco crush.
    setActiveLaws({ splitMovement: true, slide: true });
    return generateAnomalySetup([
      { type: "opa", count: 1 }, { type: "chato", count: 1 }, { type: "flaco", count: 1 },
      { type: "turrito", count: 1 }, { type: "cabeza", count: 1 }, { type: "rayo", count: 1 },
      { type: "block1x3", count: 1 },
    ]);
  }
  if (scenario === "holes") {
    setActiveLaws({ blackHoleSquares: true });
    const pieces = createInitialPieces();
    const holes = pickBlackHoleSquares(pieces, BOARD_ROWS, BOARD_COLS, []);
    setBlackHoles(holes);
    setMissingSquares(pickMissingSquares(pieces, BOARD_ROWS, BOARD_COLS, holes));
    return pieces;
  }
  throw new Error(`unknown scenario ${scenario}`);
}

// Apply a planned turn by replaying the matching generated turn's move
// descriptors in order on the live array (each later move was generated
// against the position after the earlier ones, so order matters).
function applyPlan(pieces, player, plan) {
  const turns = generateTurns(pieces, player);
  const want = plan.steps ? plan.steps.map((s) => s.pieceId + ":" + s.dir).join(",") : plan.pieceId + ":" + plan.dirs.join(">");
  const turn = turns.find((t) => (t.steps
    ? t.steps.map((s) => s.piece.id + ":" + s.dir).join(",")
    : t.piece.id + ":" + t.dirs.join(">")) === want);
  if (!turn) throw new Error("plan not found among legal turns: " + want);
  const steps = turn.steps ? turn.steps.map((s) => ({ piece: s.piece, move: s.move })) : turn.moves.map((m) => ({ piece: turn.piece, move: m }));
  const result = { types: new Set(), ids: new Set(), crushed: 0, shoves: 0, won: false };
  for (const { piece, move } of steps) {
    result.types.add(piece.type);
    result.ids.add(piece.id);
    const c = move.candidate;
    Object.assign(piece, { row: c.row, col: c.col, w: c.w, h: c.h, z: c.z, vox: c.vox });
    if (move.crushes) { pieces.splice(pieces.indexOf(move.crushes), 1); result.crushed++; }
    if (move.shoves) { for (const sh of move.shoves) { const q = pieces.find((p) => p.id === sh.id); if (q) { q.row = sh.row; q.col = sh.col; } } result.shoves++; }
    if (piece.type === "cabeza" && c.row === GOAL_ROW[piece.owner]) result.won = true;
  }
  return result;
}

const sides = { dark: tierConfig(darkTier), light: tierConfig(lightTier) };
const stats = {
  dark: { turns: 0, cabezaOnly: 0, withCabeza: 0, types: {}, crushes: 0, shoves: 0, wins: 0, ms: 0, depth: 0 },
  light: { turns: 0, cabezaOnly: 0, withCabeza: 0, types: {}, crushes: 0, shoves: 0, wins: 0, ms: 0, depth: 0 },
};
let draws = 0;
const lengths = [];
const endings = { goal: 0, crush: 0, draw: 0 };

for (let g = 0; g < GAMES; g++) {
  const pieces = setupScenario().map((p) => ({ ...p }));
  let player = "dark";
  const streak = { dark: 0, light: 0 };
  const pieceStreaks = { dark: {}, light: {} };
  let over = false;
  let t = 0;
  for (; t < TURN_CAP && !over; t++) {
    const start = performance.now();
    const plan = await sides[player].find(pieces, player, sides[player], streak[player], Math.floor(t / 2), pieceStreaks[player]);
    stats[player].ms += performance.now() - start;
    stats[player].depth += sides[player].info.depth || 0;
    if (!plan) { over = true; stats[player === "dark" ? "light" : "dark"].wins++; endings.crush++; break; }
    const r = applyPlan(pieces, player, plan);
    const s = stats[player];
    s.turns++;
    r.types.forEach((ty) => { s.types[ty] = (s.types[ty] || 0) + 1; });
    if (r.types.has("cabeza")) s.withCabeza++;
    if (r.types.size === 1 && r.types.has("cabeza")) s.cabezaOnly++;
    s.crushes += r.crushed;
    s.shoves += r.shoves;
    streak[player] = r.types.has("cabeza") ? streak[player] + 1 : 0;
    s.maxCabezaRun = Math.max(s.maxCabezaRun || 0, r.types.size === 1 && r.types.has("cabeza") ? (s.cabRun = (s.cabRun || 0) + 1) : (s.cabRun = 0));
    { const next = {}; for (const id of r.ids) next[id] = (pieceStreaks[player][id] || 0) + 1; pieceStreaks[player] = next; }
    s.maxSameRun = Math.max(s.maxSameRun || 0, ...Object.values(pieceStreaks[player]));
    const opp = player === "dark" ? "light" : "dark";
    if (r.won) { s.wins++; endings.goal++; over = true; break; }
    if (!pieces.some((p) => p.type === "cabeza" && p.owner === opp)) { s.wins++; endings.crush++; over = true; break; }
    player = opp;
  }
  if (!over) { draws++; endings.draw++; }
  lengths.push(t + 1);
  stats.dark.cabRun = stats.light.cabRun = 0;
  process.stderr.write(`game ${g + 1}/${GAMES}: ${over ? "decided" : "draw"} after ${t + 1} turns\n`);
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const report = { scenario, dark: darkTier, light: lightTier, games: GAMES, draws, endings, avgTurns: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) };
for (const side of ["dark", "light"]) {
  const s = stats[side];
  report[side + "Stats"] = {
    wins: s.wins,
    cabezaOnlyTurns: pct(s.cabezaOnly, s.turns),
    turnsMovingCabeza: pct(s.withCabeza, s.turns),
    typeShare: Object.fromEntries(Object.entries(s.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v, s.turns)])),
    crushes: s.crushes,
    shoves: s.shoves,
    avgThinkMs: Math.round(s.ms / Math.max(1, s.turns)),
    longestSamePieceRun: s.maxSameRun || 0,
    longestCabezaOnlyRun: s.maxCabezaRun || 0,
    avgDepth: +(s.depth / Math.max(1, s.turns)).toFixed(1),
  };
}
console.log(JSON.stringify(report, null, 1));
