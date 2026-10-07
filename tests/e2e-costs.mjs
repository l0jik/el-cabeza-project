/* Out in the open during play (chassis/ElCabeza3D.jsx): cost badges on
   the move markers (buildCostBadge) — every square a selected piece can
   reach says what that move costs, and a move that would put the board
   back as it was earlier this turn reads "free" — and the piece card
   (data-testid piece-card), which names the selected piece and says how
   it moves, with a "More" link to its MOVES tile. Checked in Neon and
   Standard; both have the switch that hides the badges. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 8, col: 8, w: 1, h: 1, z: 1 },
];
const badges = (page) => page.evaluate(() => window.__EC_TEST_COST_BADGES__());
async function select(page, id) {
  const pos = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(700);
}

for (const theme of ["neon", "standard"]) {
  console.log(`[${theme}]`);
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_ALL_COSTS__ = true; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") {
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }

  check("nothing selected, no badges", (await badges(page)).length === 0);
  await select(page, "dark-turrito");
  let b = await badges(page);
  check("selecting the Turrito badges each of its moves", b.length >= 4, JSON.stringify(b));
  check("each roll costs 1", b.length > 0 && b.every((x) => x.text === "1"), JSON.stringify(b));
  const card = page.locator('[data-testid="piece-card"]');
  check("the piece card names the selected piece", (await card.count()) === 1 && /Turrito/.test(await card.innerText()), await card.count() ? await card.innerText() : "none");
  check("...and says how it moves and what it costs", /rolls one square.*1 point/i.test(await page.locator('[data-testid="piece-card-text"]').innerText()));
  await page.screenshot({ path: `/tmp/e2e-costs-${theme}-1.png` });
  // The in-game menu switches the cost badges off and on (and
  // remembers it), in every theme.
  {
    await openDockPanel(page);
    await page.locator('[data-testid="costs-toggle"]').click();
    await page.waitForTimeout(400);
    check("the costs switch turns the badges off", (await badges(page)).length === 0 &&
      (await page.locator('[data-testid="costs-toggle"]').getAttribute("aria-pressed")) === "false");
    check("...and remembers it", (await page.evaluate(() => localStorage.getItem("el-cabeza:show-move-costs"))) === "0");
    await page.locator('[data-testid="costs-toggle"]').click();
    await page.waitForTimeout(400);
    check("...and back on", (await badges(page)).length >= 4);
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }
  await page.mouse.click(500, 880);
  await page.waitForTimeout(500);
  check("deselecting hides the card and the badges", (await card.count()) === 0 && (await badges(page)).length === 0);

  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1600);
  b = await badges(page);
  if (b.length === 0) { await select(page, "dark-turrito"); b = await badges(page); }
  const back = b.find((x) => x.dir === "N");
  check("after a roll, rolling back reads free", back && back.text === "free", JSON.stringify(b));
  check("other rolls still cost 1", b.filter((x) => x.dir !== "N").every((x) => x.text === "1"), JSON.stringify(b));
  await page.screenshot({ path: `/tmp/e2e-costs-${theme}-2.png` });
  await page.locator('[data-testid="piece-card-more"]').click();
  await page.waitForTimeout(600);
  const info = page.locator('[data-testid="info-overlay"]');
  check("More opens the rules at the Moves tab", (await info.getAttribute("data-open")) === "true" &&
    (await page.locator('[data-focus="true"]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("the card stays with the piece for the rest of the turn", (await card.count()) === 1);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await context.close();
}
// As players see it (no test switch): badges only when the costs differ
// (user); the points row says whose points they are; and once a move is
// made, an End turn button sits above the points row (only while the
// points are shown).
{
  console.log("[neon, as played]");
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") {
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }
  check("the points row names whose points they are", /Photon/i.test(await page.locator('[data-testid="points-side"]').innerText()));
  check("no End turn before a move", (await page.locator('[data-testid="stop-here-float"]').count()) === 0);
  {
    // The other side's piece won't move on this side's turn (the Theme Lab
    // test found a move of Light's piece played on Dark's points).
    const before = JSON.stringify((await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-turrito"));
    await page.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "N"));
    await page.waitForTimeout(1500);
    const after = JSON.stringify((await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-turrito"));
    check("the other side's piece won't move on this side's turn", before === after && /Photon/i.test(await page.locator('[data-testid="points-side"]').innerText()), after);
  }
  await select(page, "dark-turrito");
  check("every roll costs the same: no badges", (await badges(page)).length === 0, JSON.stringify(await badges(page)));
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1600);
  let b = await badges(page);
  if (b.length === 0) { await select(page, "dark-turrito"); b = await badges(page); }
  check("a free way back among them: badges again", b.some((x) => x.text === "free") && b.some((x) => x.text === "1"), JSON.stringify(b));
  const stop = page.locator('[data-testid="stop-here-float"]');
  check("after a move, End turn above the points row", (await stop.count()) === 1 && /end turn/i.test(await stop.innerText()));
  {
    // Undo move beside it (user): takes the step back.
    const undo = page.locator('[data-testid="undo-move-float"]');
    check("...and Undo move beside it", (await undo.count()) === 1);
    const before = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "dark-turrito")));
    await undo.click();
    await page.waitForTimeout(1800);
    const back = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "dark-turrito")));
    check("...which takes the move back (and both buttons go)", back !== before && (await undo.count()) === 0 && (await stop.count()) === 0, back);
    await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
    await page.waitForTimeout(1600);
  }
  await page.screenshot({ path: "/tmp/e2e-costs-stop.png" });
  await stop.click();
  await page.waitForTimeout(500);
  // (A first game, points left: it asks first, user.)
  const ask = page.locator('[data-testid="end-turn-ask"]');
  check("...points left, a first game: it asks first", (await ask.count()) === 1 && /1 action point left/i.test(await ask.innerText()));
  await page.locator('[data-testid="end-turn-ask-keep"]').click();
  await page.waitForTimeout(400);
  check("...Keep playing: still this turn", (await ask.count()) === 0 && /Photon/i.test(await page.locator('[data-testid="points-side"]').innerText()));
  await stop.click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="end-turn-ask-end"]').click();
  await page.waitForTimeout(1500);
  check("...and it ends the turn", /Plasma/i.test(await page.locator('[data-testid="points-side"]').innerText()) && (await stop.count()) === 0);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await context.close();
}

// Points hidden: no End turn either (user: it's an aid for whoever uses
// the points).
{
  console.log("[neon, points hidden]");
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:show-points", "0"); } catch (e) { /* none */ } });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 450); await page.waitForTimeout(400); }
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1600);
  check("a move made, the points hidden: no End turn", (await page.locator('[data-testid="points-counter"]').count()) === 0 && (await page.locator('[data-testid="stop-here-float"]').count()) === 0);
  await context.close();
}

await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
