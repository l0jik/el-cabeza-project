/* Out in the open during play (chassis/ElCabeza3D.jsx): cost badges on
   the move markers (buildCostBadge) — every square a selected piece can
   reach says what that move costs, and a move that would put the board
   back as it was earlier this turn reads "free" — and the piece card
   (data-testid piece-card), which names the selected piece and says how
   it moves, with a "More" link to its MOVES tile. Checked in Neon and
   Standard. */
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
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Begin Game" }).click();
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
  // Neon's in-game menu switches the cost badges off and on (and
  // remembers it); Standard has no such switch.
  if (theme === "neon") {
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
  } else {
    check("Standard has no costs switch", (await page.locator('[data-testid="costs-toggle"]').count()) === 0);
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
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
