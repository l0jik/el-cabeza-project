/* The AI plays Split Movement turns for real: with the law on, it may
   spend its turn's points across two different pieces (engine/ai.js,
   generateSplitTurns), and the chassis hands each planned step to the
   right piece (the AI orchestration effect in chassis/ElCabeza3D.jsx).

   window.__EC_LAWS__ turns the law on at boot (apps/boardBootstrap.js),
   an AI opponent is picked and Begin Game pressed; the AI (Dark) moves
   first. The engine smoke test already proves the AI's plans are legal
   and that it does choose two-piece turns; this proves the real game
   plays one through: both pieces animate and land, the log names both,
   and the turn passes to Light. The AI's choice has a little random
   variety, so a fresh game is started (up to a few times) until its
   opening turn is a two-piece one. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

let splitTurn = null, splitLog = null, statusAfter = null, errs = [], tries = 0, anyAiTurn = false;
for (tries = 1; tries <= 4 && !splitTurn; tries++) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_LAWS__ = { splitMovement: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await page.waitForTimeout(1200);
  await openDockPanel(page);
  const aiBtn = page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).first();
  if (await aiBtn.count()) { await aiBtn.click(); await page.waitForTimeout(400); }
  const easy = page.locator('[data-testid="dock-panel"] button', { hasText: /^Easy$/i }).first();
  if (await easy.count()) { await easy.click(); await page.waitForTimeout(200); }
  await page.locator("button", { hasText: "Begin Game" }).click();

  // Wait for the AI's first turn to finish (Easy searches ~0.5s, plus the
  // 500ms beat before each step and the roll animations).
  let turns = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    turns = await page.evaluate(() => window.__EC_TEST_TURNS__ || []);
    if (turns.length) break;
  }
  if (turns.length) anyAiTurn = true;
  const first = turns[0];
  if (first && new Set(first.steps.map((s) => s.pieceId)).size === 2) {
    splitTurn = first;
    splitLog = (await page.evaluate(() => window.__EC_TEST_LOG__ || []))[0];
    statusAfter = await page.evaluate(() => {
      const s = [...document.querySelectorAll("span")].find((el) => /to move|thinking/i.test(el.textContent || ""));
      return s ? s.textContent : null;
    });
  }
  await page.close();
}

check("the AI completed a turn with Split Movement on", anyAiTurn);
check(`the AI played a two-piece turn (within ${tries - 1} game${tries - 1 === 1 ? "" : "s"})`, !!splitTurn);
if (splitTurn) {
  console.log(`    turn: ${JSON.stringify(splitTurn.steps)}  log: ${JSON.stringify(splitLog && splitLog.notation)}`);
  check("it was Dark's (the AI's) turn", splitTurn.player === "dark");
  check("the move log names both pieces", !!splitLog && splitLog.notation.includes("·"), JSON.stringify(splitLog));
  check("the turn then passed to Light", !!statusAfter && /light to move/i.test(statusAfter), JSON.stringify(statusAfter));
}
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures === 0 ? "\nAI SPLIT MOVEMENT E2E PASSED" : `\nAI SPLIT MOVEMENT E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
