import { createInitialPieces, legalMovesFor, sameState, pairLog } from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY, evaluatePosition } from "../engine/ai.js";
import { pieceCenter, makeRoundedBox, pivotFor } from "../engine/geometry.js";
import { BOARD_SIZE } from "../engine/constants.js";

const pieces = createInitialPieces();
console.log("pieces:", pieces.length, "BOARD_SIZE:", BOARD_SIZE);

const cabeza = pieces.find((p) => p.id === "dark-cabeza");
const moves = legalMovesFor(pieces, cabeza);
console.log("dark-cabeza legal moves:", Object.keys(moves));

console.log("evaluatePosition(dark):", evaluatePosition(pieces, "dark"));

const turn = findBestAiTurn(pieces, "dark", AI_DIFFICULTY.easy, 0, 0);
console.log("AI (easy) chosen turn:", turn && { pieceId: turn.pieceId, dirs: turn.dirs });

const geo = makeRoundedBox(0.8, 0.8, 0.8, 0.0625);
console.log("makeRoundedBox vertex count:", geo.attributes.position.count);

const pivot = pivotFor(pieces[0], "E");
console.log("pivotFor sample:", pivot.point.toArray(), pivot.angle);

console.log("pairLog([]):", pairLog([]));
console.log("sameState self-check:", sameState(pieces[0], pieces[0]));

console.log("\nSMOKE TEST PASSED");
