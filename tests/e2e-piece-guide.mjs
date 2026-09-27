/* The piece guide switch (chassis: showGuide, localStorage
   el-cabeza:piece-guide): the card that says what the chosen piece does,
   for players who know the game and don't want it any more.
   1. Desktop (Standard and Neon): the dock's guide-toggle hides the piece
      card; the choice holds across a reload; switched back on, the card
      returns. The move markers and their cost badges are untouched.
   2. Nova on a phone: the menu's Piece guide switch hides the bar's piece
      text and its "tap ..." tips. */
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
async function select(page, id) {
  const pos = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(700);
}
async function startGame(page) {
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
}
const card = (page) => page.locator('[data-testid="piece-card"]').count();

for (const theme of ["standard", "neon"]) {
  console.log(`[${theme}]`);
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(1500);
  await startGame(page);
  await select(page, "dark-turrito");
  check("the piece card shows by default", (await card(page)) === 1);
  // Switch it off from the dock's corner.
  await openDockPanel(page);
  const toggle = page.locator('[data-testid="guide-toggle"]');
  check("the dock has a piece guide switch, on", (await toggle.count()) === 1 && (await toggle.getAttribute("aria-pressed")) === "true");
  await toggle.click();
  await page.waitForTimeout(200);
  check("...which switches off", (await toggle.getAttribute("aria-pressed")) === "false");
  await page.mouse.click(4, 450);
  await page.waitForTimeout(400);
  await select(page, "dark-turrito");
  check("with it off, choosing a piece shows no card", (await card(page)) === 0);
  const badges = await page.evaluate(() => window.__EC_TEST_COST_BADGES__());
  check("...while the move markers still show", badges.length >= 4, JSON.stringify(badges));
  await page.reload();
  await page.waitForTimeout(1500);
  await startGame(page);
  await select(page, "dark-turrito");
  check("it stays off after a reload", (await card(page)) === 0);
  await openDockPanel(page);
  await page.locator('[data-testid="guide-toggle"]').click();
  await page.mouse.click(4, 450);
  await page.waitForTimeout(400);
  await select(page, "dark-turrito");
  check("switched back on, the card returns", (await card(page)) === 1);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await context.close();
}

{
  console.log("[nova, phone]");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  // The control bar, chosen (a phone opens Nova with the floating piece).
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:nova-layout", "bar"); } catch (e) { /* none */ } });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await page.waitForTimeout(2500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.locator('[data-testid="shell-begin"]').click();
  await page.waitForTimeout(1800);
  const hint = () => page.evaluate(() => { const e = document.querySelector('[data-testid="shell-hint"]'); return e ? e.textContent : null; });
  check("the bar tips what to tap", /Tap one of your pieces/.test((await hint()) || ""), String(await hint()));
  await page.locator('[data-testid="shell-menu-button"]').click();
  await page.waitForTimeout(300);
  const sw = page.locator('[data-testid="shell-menu-guide"]');
  await sw.scrollIntoViewIfNeeded();
  check("the menu has a Piece guide switch, on", (await sw.getAttribute("aria-checked")) === "true");
  await sw.click();
  await page.waitForTimeout(200);
  check("...which switches off", (await sw.getAttribute("aria-checked")) === "false");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("with it off the bar gives no tips", !((await hint()) || "").trim(), String(await hint()));
  const pos = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-turrito"));
  await page.touchscreen.tap(pos.x, pos.y);
  await page.waitForTimeout(700);
  check("...and choosing a piece shows no piece text", (await card(page)) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
