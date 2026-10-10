/* Replay a game (user: "a way to take a copied move log and have it
   replay a game"). A game is played on the board under Split Movement,
   3 Actions and Slide (turns handed between pieces, slides and rolls),
   ended, and its log copied; the log is pasted into Replay a game, which
   reads it, plays it back through the board, both sides, and ends on the
   same board with the same moves logged. Pause holds it, a turn back
   takes one back, Play on hands the board back. A log copied before
   replay codes (its lines alone) still replays from the standard start;
   a damaged code says so. Moves are made through __EC_TEST_MOVE__ (the
   path a tap on a marker takes); the game is planned with the engine
   itself, so every turn is legal and runs to its last point. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";
import { createInitialPieces, legalMovesFor, applyShoves, turnContinues, sameState, pairLog } from "../engine/rules.js";
import { setActiveLaws, maxStepsFor, turnBudget, moveCost, maxPiecesPerTurn, GOAL_ROW, ACTIVE_LAWS, PIECE_META } from "../engine/constants.js";
import { VANILLA_LAWS } from "../engine/replay.js";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const sameBoard = (a, b) => a.length === b.length && a.every((p) => { const q = b.find((x) => x.id === p.id); return q && sameState(p, q); });

/* A game planned with the engine: each turn runs while the rules keep it
   open (so it ends by itself on the board), now and then handing the
   points to another piece, never back to a board the turn already had. */
function planGame(seed, laws, turnsWanted, opener = "dark") {
  const r = rng(seed);
  setActiveLaws({ ...VANILLA_LAWS, ...laws });
  let board = createInitialPieces();
  let player = opener;
  const turns = [];
  for (let t = 0; t < turnsWanted; t++) {
    const trail = [board];
    let used = 0, selected = null, moved = [], tb = board, over = false;
    const steps = [];
    const fresh = (q, remaining) => Object.entries(legalMovesFor(tb, q, remaining)).filter(([, mv]) => {
      if (mv.crushes || (q.type === "cabeza" && mv.candidate.row === GOAL_ROW[q.owner])) return false; // no early end
      let nb = tb.map((p) => (p.id === q.id ? mv.candidate : p));
      if (mv.shoves) nb = applyShoves(nb, mv.shoves);
      return !trail.some((b) => sameBoard(b, nb));
    });
    for (;;) {
      const split = !!ACTIVE_LAWS.splitMovement;
      let piece = selected && tb.find((p) => p.id === selected);
      const canMove = (q) => fresh(q, selected ? turnBudget() - used : maxStepsFor(q.type)).length > 0;
      if (!piece || !canMove(piece) || (split && used > 0 && r() < 0.4)) {
        const others = tb.filter((q) => q.owner === player && q.id !== selected && (!selected || moved.includes(q.id) || moved.length < maxPiecesPerTurn()) && canMove(q));
        if (others.length) piece = pick(r, others);
        else if (!piece || !canMove(piece)) break;
      }
      const options = fresh(piece, maxStepsFor(piece.type) - used);
      if (!options.length) break;
      const [dir, move] = pick(r, options);
      let next = tb.map((p) => (p.id === piece.id ? move.candidate : p));
      if (move.shoves) next = applyShoves(next, move.shoves);
      used += moveCost(move);
      if (!moved.includes(piece.id)) moved = [...moved, piece.id];
      steps.push({ pieceId: piece.id, dir, handover: selected !== null && selected !== piece.id });
      selected = piece.id;
      tb = next;
      trail.push(next);
      const budget = split ? turnBudget() : maxStepsFor(piece.type);
      if (move.teleports || !turnContinues(tb, player, moved, move.candidate, used, budget, split)) { over = true; break; }
    }
    if (!over) break; // a turn that couldn't run to its end: stop the game here
    turns.push(steps);
    board = tb;
    player = player === "dark" ? "light" : "dark";
  }
  setActiveLaws({ ...VANILLA_LAWS });
  return { turns, board };
}

const LAWS = { splitMovement: true, threeActions: true, slide: true };
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; }, LAWS);
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
await page.waitForTimeout(1500);

console.log("a game played, ended and copied");
await openDockPanel(page);
check("the setup offers Replay a game", await page.locator('[data-testid="replay-link"]').isVisible());
// (Out of the panel's flow: Begin Game where it always was.)
await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
await page.waitForTimeout(1500);
const state = () => page.evaluate(() => ({ pieces: window.__EC_TEST_PIECES__.map((p) => ({ ...p })), turns: window.__EC_TEST_TURNS__ || [] }));
const plan = planGame(5, LAWS, 8);
let played = 0, splits = 0, slides = 0;
for (const steps of plan.turns) {
  const before = (await state()).turns.length;
  for (const st of steps) {
    if (st.handover) { await page.evaluate((i) => window.__EC_TEST_SPLIT_TO__(i), st.pieceId); await page.waitForTimeout(250); splits++; }
    if (st.dir.startsWith("slide-")) slides++;
    const was = (await state()).pieces.find((p) => p.id === st.pieceId);
    await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [st.pieceId, st.dir]);
    await poll(async () => { const s = await state(); const p = s.pieces.find((q) => q.id === st.pieceId); return p && !(p.row === was.row && p.col === was.col && p.w === was.w && p.h === was.h && p.z === was.z) ? s : null; }, 4000);
    await page.waitForTimeout(220);
  }
  if (await poll(async () => (await state()).turns.length > before, 4000)) played++;
  else break;
}
const original = await state();
check(`${plan.turns.length} planned turns played on the board (${played}; ${splits} hand-overs, ${slides} slides)`, played === plan.turns.length && played >= 6);
await openDockPanel(page).catch(() => {});
await page.locator('[data-testid="end-game"]').click();
await page.waitForTimeout(900);
await page.locator('[data-testid="move-log"]').click();
await page.waitForTimeout(700);
await page.locator('[data-testid="movelog-sheet"] button', { hasText: /Copy Move[ _]?Log/i }).first().click();
await page.waitForTimeout(400);
const copied = await page.evaluate(() => window.__EC_TEST_COPIED__ || "");
check("the copied log ends with a replay code", /\nReplay code[^\n]*: ECR1\.[A-Za-z0-9_-]+$/.test(copied), copied.slice(-120));
check("...after its readable lines", /^1\. Walnut: /m.test(copied));

console.log("pasted into Replay a game");
await page.locator('[data-testid="open-replay"]').click();
await page.waitForTimeout(500);
check("the Move Log's link opens the Replay sheet", await page.locator('[data-testid="replay-sheet"]').isVisible());
await page.locator('[data-testid="replay-text"]').fill(copied);
await page.waitForTimeout(300);
const reading = await page.locator('[data-testid="replay-reading"]').innerText();
check(`it reads what it holds ("${reading.replace(/\n/g, " / ")}")`, new RegExp(`^${played} turns`).test(reading) && /Split movement, 2 pieces/.test(reading) && /Orthogonal slide/.test(reading));
await page.locator('[data-testid="replay-start"]').click();
const bar = page.locator('[data-testid="replay-bar"]');
check("the replay's bar comes up", !!(await poll(() => bar.isVisible(), 3000)));
const playing = await poll(() => page.evaluate(() => window.__EC_TEST_REPLAY_STATE__ && window.__EC_TEST_REPLAY_STATE__.phase === "play" && window.__EC_TEST_REPLAY_STATE__.turn >= 1), 12000);
check("it sets up and starts playing", !!playing);
await page.locator('[data-testid="replay-play"]').click(); // pause
await poll(() => page.evaluate(() => { const s = window.__EC_TEST_REPLAY_STATE__; return s && !s.playing; }), 2000);
await page.waitForTimeout(1600); // the step in flight lands
const heldAt = await page.evaluate(() => window.__EC_TEST_TURNS__.length);
const heldPieces = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__));
await page.waitForTimeout(2500);
check("Pause holds it", heldPieces === (await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__))), `turn ${heldAt}`);
// A tap on the board while it plays does nothing to the game.
await page.mouse.click(500, 450);
await page.waitForTimeout(400);
check("...and the board takes no taps meanwhile", heldPieces === (await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__))));
// A turn back, from between turns: play on to the end of the turn first.
await page.locator('[data-testid="replay-step"]').click();
await poll(() => page.evaluate((n) => window.__EC_TEST_TURNS__.length > n, heldAt), 15000);
await page.waitForTimeout(800);
const stepped = await page.evaluate(() => window.__EC_TEST_TURNS__.length);
check(`Next turn plays one turn and stops (${heldAt} -> ${stepped})`, stepped >= heldAt && stepped <= heldAt + 1);
await page.waitForTimeout(1500);
check("...and stays stopped", stepped === (await page.evaluate(() => window.__EC_TEST_TURNS__.length)));
await page.locator('[data-testid="replay-back"]').click();
const backTo = await poll(() => page.evaluate((n) => (window.__EC_TEST_TURNS__.length === n - 1 ? n - 1 : null), stepped), 8000);
check(`A turn back takes one back (${stepped} -> ${backTo})`, backTo === stepped - 1);
await page.waitForTimeout(1200);
await page.locator('[data-testid="replay-speed"]').click();
await page.locator('[data-testid="replay-speed"]').click();
check("speed goes to 4×", (await page.locator('[data-testid="replay-speed"]').innerText()).trim() === "4×");
await page.locator('[data-testid="replay-play"]').click(); // play
const done = await poll(() => page.evaluate(() => window.__EC_TEST_REPLAY_STATE__ && window.__EC_TEST_REPLAY_STATE__.phase === "done"), 90000, 300);
check("it plays to the end", !!done);
const replayed = await state();
const posOf = (s) => JSON.stringify(s.pieces.map((p) => [p.id, p.row, p.col, p.w, p.h, p.z, p.vox || ""]).sort());
check("...ending on the same board as the game copied", posOf(replayed) === posOf(original));
check("...with the same moves, turn by turn", JSON.stringify(replayed.turns) === JSON.stringify(original.turns), `${replayed.turns.length} vs ${original.turns.length}`);
check(`the bar says it's the end ("${(await page.locator('[data-testid="replay-status"]').innerText()).trim()}")`, /end/i.test(await page.locator('[data-testid="replay-status"]').innerText()));
await page.locator('[data-testid="replay-play-on"]').click();
await page.waitForTimeout(400);
check("Play on hands the board back (the bar goes)", !(await bar.isVisible()));
check("no page errors", errs.length === 0, errs.join(" | "));

console.log("a log from before replay codes, and a damaged code");
// The same game's lines alone, as a log copied before codes existed.
const linesOnly = copied.split("\n").filter((l) => !/^Replay code/.test(l)).join("\n");
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^New game$/i.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(1200);
await openDockPanel(page);
await page.locator('[data-testid="replay-link"]').click();
await page.waitForTimeout(400);
await page.locator('[data-testid="replay-text"]').fill(linesOnly);
await page.waitForTimeout(300);
const legacyReading = await page.locator('[data-testid="replay-reading"]').innerText();
check(`its lines alone still read, from the standard start ("${legacyReading.replace(/\n/g, " / ")}")`, new RegExp(`^${played} turns`).test(legacyReading) && /No replay code/.test(legacyReading));
await page.locator('[data-testid="replay-start"]').click();
await poll(() => page.evaluate(() => window.__EC_TEST_REPLAY_STATE__ && window.__EC_TEST_REPLAY_STATE__.phase === "play"), 8000);
await page.locator('[data-testid="replay-speed"]').click();
await page.locator('[data-testid="replay-speed"]').click();
const done2 = await poll(() => page.evaluate(() => window.__EC_TEST_REPLAY_STATE__ && window.__EC_TEST_REPLAY_STATE__.phase === "done"), 90000, 300);
check("...and replay to the same board", !!done2 && posOf(await state()) === posOf(original));
await page.locator('[data-testid="replay-play-on"]').click();
await page.waitForTimeout(300);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^New game$/i.test(x.textContent.trim())); if (b) b.click(); });
await page.waitForTimeout(1000);
await openDockPanel(page);
await page.locator('[data-testid="replay-link"]').click();
await page.waitForTimeout(400);
const code = copied.slice(copied.indexOf("ECR1."));
await page.locator('[data-testid="replay-text"]').fill(copied.replace(code, code.slice(0, code.length - 25)));
await page.waitForTimeout(300);
const damaged = await page.locator('[data-testid="replay-reading"]').innerText();
check(`a code cut short says so, and the log's moves are read instead ("${damaged.replace(/\n/g, " / ")}")`, /damaged or cut short/i.test(damaged) && new RegExp(`^${played} turns`).test(damaged) && await page.locator('[data-testid="replay-start"]').isEnabled());
// A code alone, cut short: nothing else to read, so nothing to replay.
await page.locator('[data-testid="replay-text"]').fill(code.slice(0, code.length - 25));
await page.waitForTimeout(300);
const cutAlone = await page.locator('[data-testid="replay-reading"]').innerText();
check(`a code alone, cut short, says so and can't be replayed ("${cutAlone}")`, /damaged|cut short/i.test(cutAlone) && await page.locator('[data-testid="replay-start"]').isDisabled());
check("no page errors", errs.length === 0, errs.join(" | "));

await browser.close();
console.log(failures === 0 ? "\nREPLAY E2E PASSED" : `\nREPLAY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
