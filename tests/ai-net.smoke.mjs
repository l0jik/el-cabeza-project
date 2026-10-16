/* Hard at a one-turn search, from a game a player won against it (14 rows
   x 13 columns, ten pieces a side, every law; the replay code below is
   the game's own). Checked here:
   - endingLine (engine/ai.js), the exact "can this side end the game on
     its coming turn" Hard verifies its turns with, gives the same answer
     as generating every turn, at every position of the game, both sides;
   - at its 29th turn only two of its 2,576 turns hold, and endingLine
     finds exactly those two;
   - at its 28th turn the turn it played lets a net close (a threat no
     turn of its answers, the reply after), and the retreat that holds
     does not: opponentNet, the look one turn further Hard now takes;
   - a Cabeza beside one black hole is in reach of a one-square piece that
     can drop into the other (the threat walk used to cut it as too far). */
import { setBoardDimensions, setActiveLaws, setBlackHoles, setMissingSquares, setOpeningTurn, maxStepsFor, moveCost, GOAL_ROW } from "../engine/constants.js";
import { legalMovesFor, applyShoves } from "../engine/rules.js";
import { generateTurns, endingLine, cabezaInDanger, cabezaThreats, _netCheck } from "../engine/ai.js";
import { decodeReplay, VANILLA_LAWS } from "../engine/replay.js";

let failures = 0;
const check = (label, ok, detail) => { if (!ok) failures++; console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${!ok && detail ? " — " + detail : ""}`); };
const copy = (b) => b.map((p) => ({ ...p }));

const CODE = "ECR1.eyJ2IjoxLCJiIjpbMTQsMTNdLCJsIjpbInNwbGl0TW92ZW1lbnQiLCJzcGxpdFRocmVlIiwic2xpZGUiLCJibGFja0hvbGVTcXVhcmVzIiwiY2FudGlsZXZlclBpdm90IiwidGhyZWVBY3Rpb25zIiwic2hvdmluZyIsInB1bnRvIl0sInMiOjAsImgiOltbNCwxMF0sWzksMl1dLCJtIjpbXSwicCI6W1siZGFyay1ibG9jazJ4MyIsImJsb2NrMngzIiwiZGFyayIsMCw1LDEsMiwzXSxbImxpZ2h0LWJsb2NrMngzIiwiYmxvY2syeDMiLCJsaWdodCIsMTIsNywxLDIsM10sWyJkYXJrLWFyY29DaGljbyIsImFyY29DaGljbyIsImRhcmsiLDEsMiwzLDEsMiwiMCwwLDA7MCwwLDE7MSwwLDE7MiwwLDA7MiwwLDEiXSxbImxpZ2h0LWFyY29DaGljbyIsImFyY29DaGljbyIsImxpZ2h0IiwxMiw4LDMsMSwyLCIwLDAsMDswLDAsMTsxLDAsMTsyLDAsMDsyLDAsMSJdLFsiZGFyay1jcnVjZSIsImNydWNlIiwiZGFyayIsMCw4LDMsMiwxLCIxLDAsMDswLDEsMDsxLDEsMDsyLDEsMCJdLFsibGlnaHQtY3J1Y2UiLCJjcnVjZSIsImxpZ2h0IiwxMiwyLDMsMiwxLCIwLDAsMDsxLDAsMDsxLDEsMDsyLDAsMCJdLFsiZGFyay1yYXlvIiwicmF5byIsImRhcmsiLDAsMSwzLDEsMiwiMCwwLDA7MSwwLDA7MSwwLDE7MiwwLDEiXSxbImxpZ2h0LXJheW8iLCJyYXlvIiwibGlnaHQiLDEzLDksMywxLDIsIjAsMCwxOzEsMCwwOzEsMCwxOzIsMCwwIl0sWyJkYXJrLWNoYXRvIiwiY2hhdG8iLCJkYXJrIiwxLDExLDIsMSwyXSxbImxpZ2h0LWNoYXRvIiwiY2hhdG8iLCJsaWdodCIsMTIsMCwyLDEsMl0sWyJkYXJrLWNvZG8iLCJjb2RvIiwiZGFyayIsMCw2LDIsMiwxLCIwLDEsMDsxLDAsMDsxLDEsMCJdLFsibGlnaHQtY29kbyIsImNvZG8iLCJsaWdodCIsMTIsNSwyLDIsMSwiMCwwLDA7MCwxLDA7MSwwLDAiXSxbImRhcmstYmxvY2sxeDMiLCJibG9jazF4MyIsImRhcmsiLDEsMSwxLDEsM10sWyJsaWdodC1ibG9jazF4MyIsImJsb2NrMXgzIiwibGlnaHQiLDEyLDExLDEsMSwzXSxbImRhcmstYmxvY2sxeDMtMSIsImJsb2NrMXgzIiwiZGFyayIsMSwwLDEsMSwzXSxbImxpZ2h0LWJsb2NrMXgzLTEiLCJibG9jazF4MyIsImxpZ2h0IiwxMiwxMiwxLDEsM10sWyJkYXJrLWNhYmV6YSIsImNhYmV6YSIsImRhcmsiLDAsNCwxLDEsMV0sWyJsaWdodC1jYWJlemEiLCJjYWJlemEiLCJsaWdodCIsMTMsOCwxLDEsMV0sWyJkYXJrLXR1cnJpdG8iLCJ0dXJyaXRvIiwiZGFyayIsMCwxMSwxLDEsMV0sWyJsaWdodC10dXJyaXRvIiwidHVycml0byIsImxpZ2h0IiwxMywxLDEsMSwxXV0sImYiOiJkIiwidCI6WyIxNlNXIiwiMTNOLjE1Ti4xNU4iLCIyUy4xMlMuMTZFIiwiMTNOLjEzTi4xM1ciLCIxNFMuMTRTLjE0UyIsIjNOLjNOLjdOIiwiMFMuMFMuMTZFIiwiN3NsaWRlLVcuMTVOIiwiMFMuMEUuMkUiLCI3c2xpZGUtVy4xM1ciLCIwUy4yRS4xNlNXIiwiOU4uOUUuOUUiLCIxMFcuMTBTLjEwUyIsIjdzbGlkZS1FLjlOIiwiMTRFLjE2U1cuMTZTVyIsIjExTi4xMVcuMTFXIiwiOFMuMTBTLjEyVyIsIjExcGl2b3QtY3cuMTFXLjE5TiIsIjE0RS4xNEUuMTZTRSIsIjEzVy4xM1cuMTNXIiwiNkUuNlMuMTBwaXZvdC1jY3ciLCIxM3NsaWRlLUUuMTNOIiwiME4uNlMuNnBpdm90LWN3IiwiM3NsaWRlLVMuM1ciLCIxMEUuMTBFLjEwUyIsIjE1Vy4xNVMuMTVTIiwiOE4uMTBXLjEwUyIsIjE3RS4xN0UuMTdORSIsIjBzbGlkZS1OIiwiMTNzbGlkZS1TLjVOIiwiMTJFLjEyUy4xNkUiLCIxc2xpZGUtVy4xM0UiLCI4Uy44Uy44UyIsIjFzbGlkZS1XLjFOIiwiNEUuNFMuMTBFIiwiN3NsaWRlLU4iLCIxMFcuMTBwaXZvdC1jdy4xMHBpdm90LWN3IiwiMTdORS4xN04uMTdOIiwiMTBwaXZvdC1jY3cuMTBOLjEwRSIsIjE1c2xpZGUtTi4xN1MiLCIxMHBpdm90LWN3LjEwcGl2b3QtY3cuMTBTIiwiN3NsaWRlLVMuMU4iLCI4Uy40Uy4xMlMiLCI5c2xpZGUtTiIsIjBzbGlkZS1FIiwiNU4uN3NsaWRlLU4iLCIxNlNFLjE2U0UuMTZTIiwiNXNsaWRlLUUuMTlFIiwiMTZTRS4xNkUuMTZFIiwiMTdTVy4xOU4uMTlOIiwiNnNsaWRlLUUiLCIxM1cuMTlOIiwiNnBpdm90LWNjdy42c2xpZGUtUyIsIjE5Uy4xOVMuMTlXIiwiMTJTLjE2Vy4xNlciLCIxc2xpZGUtRS4xOVMiLCI0Vy40Uy40cGl2b3QtY3ciLCIxOXNsaWRlLVMuMTlXIiwiNnBpdm90LWN3LjE0c2xpZGUtTiIsIjE5VyJdLCJyIjoibCJ9";
const rec = decodeReplay(CODE);
function setup() {
  setBoardDimensions(rec.rows, rec.cols);
  setActiveLaws({ ...VANILLA_LAWS, ...rec.laws });
  setBlackHoles(rec.holes);
  setMissingSquares(rec.missing);
  setOpeningTurn(-1);
}
setup();
// The game played back: positions[t] is the board before turn t.
const positions = [];
{
  let board = copy(rec.start), player = rec.opener;
  for (let t = 0; t < rec.turns.length; t++) {
    positions.push({ pieces: copy(board), player });
    setOpeningTurn(t);
    let used = 0;
    for (const { pieceId, dir } of rec.turns[t]) {
      const piece = board.find((p) => p.id === pieceId);
      const move = legalMovesFor(board, piece, maxStepsFor(piece.type) - used)[dir];
      let next = board.map((p) => (p.id === piece.id ? move.candidate : p));
      if (move.shoves) next = applyShoves(next, move.shoves);
      if (move.crushes) next = next.filter((p) => p.id !== move.crushes.id);
      used += moveCost(move);
      board = next;
    }
    setOpeningTurn(-1);
    player = player === "dark" ? "light" : "dark";
  }
}
check("the game replays to its end (60 turns)", positions.length === 60);

// 1. endingLine against every turn generated, every position, both sides.
{
  let same = 0, n = 0, trues = 0;
  for (const pos of positions) {
    for (const side of ["dark", "light"]) {
      const exact = generateTurns(copy(pos.pieces), side).some((t) => t.endsGame);
      const fast = !!endingLine(pos.pieces, side);
      n++; if (exact) trues++; if (exact === fast) same++;
    }
  }
  check(`endingLine agrees with every turn generated (${same} of ${n}, ${trues} where the side could end it)`, same === n && trues > 0);
}

const label = (tu) => (tu.steps ? tu.steps.map((s) => `${s.pieceId.replace(/^(dark|light)-/, "")}:${s.dir}`) : tu.dirs.map((d) => `${tu.pieceId.replace(/^(dark|light)-/, "")}:${d}`)).join(" ");
function after(board, tu) {
  let cur = copy(board);
  const steps = tu.steps ? tu.steps.map((s) => ({ pieceId: s.pieceId, move: s.move })) : tu.moves.map((m) => ({ pieceId: tu.pieceId, move: m }));
  for (const s of steps) {
    const c = s.move.candidate;
    let next = cur.map((p) => (p.id === s.pieceId ? { ...p, row: c.row, col: c.col, w: c.w, h: c.h, z: c.z, vox: c.vox } : p));
    if (s.move.shoves) next = next.map((p) => { const sh = s.move.shoves.find((x) => x.id === p.id); return sh ? { ...p, row: sh.row, col: sh.col } : p; });
    if (s.move.crushes) next = next.filter((p) => p.id !== s.move.crushes.id);
    cur = next;
  }
  return cur;
}

// 2. The 29th turn (Hard is dark): two turns hold, both the Cruce's.
{
  const pos = positions[56];
  const holding = generateTurns(copy(pos.pieces), "dark").filter((tu) => !endingLine(after(pos.pieces, tu), "light")).map(label).sort();
  check("29th turn: exactly two turns hold, the Cruce's", holding.length === 2 && holding.every((l) => l.startsWith("cruce:W cruce:S cruce:pivot")), holding.join(" | "));
}

// 3. The 28th turn: the turn played lets a net close; the retreat doesn't.
{
  const pos = positions[54];
  const turns = generateTurns(copy(pos.pieces), "dark");
  const played = turns.find((tu) => label(tu) === "block1x3:S cabeza:W cabeza:W");
  const retreat = turns.find((tu) => label(tu) === "cabeza:N cabeza:NE cabeza:NE");
  check("28th turn: the turn played holds for one turn", played && !endingLine(after(pos.pieces, played), "light"));
  check("...but lets a net close (a threat no turn of Hard's answers)", played && _netCheck.opponentNet(after(pos.pieces, played), "dark", performance.now() + 60000) === true);
  check("the retreat north-east holds, and no net closes", retreat && !endingLine(after(pos.pieces, retreat), "light") && _netCheck.opponentNet(after(pos.pieces, retreat), "dark", performance.now() + 60000) === false);
}

// 4. Through a black hole: a Turrito beside one hole; the enemy Cabeza
// beside the other, far away. A piece rolling east into a hole comes out
// on the far hole's west side (rules.js), where the Cabeza stands.
{
  setBoardDimensions(10, 10);
  setActiveLaws({ ...VANILLA_LAWS, blackHoleSquares: true });
  setBlackHoles([{ row: 6, col: 2 }, { row: 3, col: 7 }]);
  setMissingSquares([]);
  const board = [
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 6, col: 1, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 3, col: 6, w: 1, h: 1, z: 1 },
  ];
  // East into (6,2): out on (3,7)'s west side, (3,6): the Cabeza.
  const direct = legalMovesFor(board, board[1], 2).E;
  check("rolling east into the hole crushes the Cabeza beside the other (the rules)", !!(direct && direct.crushes && direct.crushes.id === "light-cabeza"));
  check("cabezaInDanger sees it", cabezaInDanger(copy(board), "light"));
  check("...and so does the check alert's list", cabezaThreats(board, "light").some((x) => x.attacker === "dark-turrito"));
}

console.log(failures ? `\nAI NET CHECKS FAILED (${failures})` : "\nAI NET CHECKS PASSED");
process.exit(failures ? 1 : 0);
