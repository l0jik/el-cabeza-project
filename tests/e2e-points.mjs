/* The points-left counter (chassis/ElCabeza3D.jsx, showPoints): off by
   default, switched from the dock's corner (data-testid points-toggle),
   remembered per browser, shown at the bottom centre during play as one
   dot per action point (data-testid points-counter, data-left = points
   left). It counts down as moves spend points, springs back when a move
   returns to an earlier position (the free detour), and refills for the
   next player; after a finished game it holds that game's last turn
   through the win screen and clears when a new game is set up. Checked
   in Neon and in Standard (which has no Sound icon,
   so the toggle takes its corner). */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 1, col: 1, w: 1, h: 1, z: 2 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 8, col: 8, w: 1, h: 1, z: 2 },
];
// The counter hides under an open dock panel (they share the bottom
// centre). In Standard the dock can reopen by hover right after Begin
// Game, when it folds back under a pointer still resting on the button.
// Move off it, and if it's open anyway, close it the way a player would:
// a tap outside it (the empty left margin).
async function closeDock(page) {
  await page.mouse.move(4, 450); // off the dock before it folds back under the pointer
  await page.waitForTimeout(1000);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") {
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }
}
const left = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="points-counter"]');
  return el ? Number(el.getAttribute("data-left")) : null;
});

for (const theme of ["neon", "standard"]) {
  console.log(`[${theme}]`);
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const url = `file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`;
  await page.goto(url);
  await page.waitForTimeout(1500);

  await openDockPanel(page);
  const toggle = page.locator('[data-testid="points-toggle"]');
  check("the toggle starts off", (await toggle.getAttribute("aria-pressed")) === "false");
  await toggle.click();
  await page.waitForTimeout(200);
  check("clicking it switches it on", (await toggle.getAttribute("aria-pressed")) === "true");
  check("no counter before the game starts", (await left(page)) === null);

  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await closeDock(page);
  await page.waitForTimeout(1500);
  check("in play, the counter shows 2 points left", (await left(page)) === 2, String(await left(page)));

  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1400);
  check("a roll spends one", (await left(page)) === 1, String(await left(page)));
  if (theme === "neon") await page.screenshot({ path: "/tmp/e2e-points.png" });

  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "N"));
  await page.waitForTimeout(1400);
  check("rolling back to where it was refunds it", (await left(page)) === 2, String(await left(page)));

  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "E"));
  await page.waitForTimeout(1600);
  check("after a full turn it refills for the next player", (await left(page)) === 2 && (await page.evaluate(() => (window.__EC_TEST_LOG__ || []).length)) === 1, String(await left(page)));

  // Remembered across a reload.
  await page.reload();
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  check("the setting is remembered after a reload", (await page.locator('[data-testid="points-toggle"]').getAttribute("aria-pressed")) === "true");
  await page.locator("button", { hasText: "Begin Game" }).click();
  await closeDock(page);
  await page.waitForTimeout(2200); // the dock folds away first (it hides the counter while open)
  check("...and the counter shows in the next game", (await left(page)) === 2,
    String(await left(page)) + " dock open=" + (await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) + " status=" + (await page.evaluate(() => ([...document.querySelectorAll("span")].find((e) => /to move|left$|thinking/i.test(e.textContent || "")) || {}).textContent)));

  // A finished game: the counter stays up through the win screen,
  // holding that game's last turn, and clears when a new game is set up.
  await page.reload();
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 8, col: 0, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  ]);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await closeDock(page);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "S"));
  await page.waitForTimeout(2500);
  const won = await page.evaluate(() => [...document.querySelectorAll("span")].some((el) => /wins/i.test(el.textContent || "")));
  check("a Cabeza stepping onto its far row wins", won);
  check("after the win the counter stays up, holding the last turn (1 point left)", (await left(page)) === 1, String(await left(page)));
  if (theme === "neon") await page.screenshot({ path: "/tmp/e2e-points-won.png" });
  await openDockPanel(page);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /^New Game$/ }).click();
  await page.waitForTimeout(1500);
  check("a new game's setup clears it", (await left(page)) === null, String(await left(page)));

  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await context.close();
}

// A turn that ends with points nothing can spend says why: with 3 Actions
// Per Turn an Opa roll costs 2 of the 3, and an Opa moves once per turn.
{
  console.log("[unused points note]");
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { threeActions: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-opa", type: "opa", owner: "dark", row: 1, col: 0, w: 2, h: 2, z: 2 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  ]);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await closeDock(page);
  await page.waitForTimeout(1200);
  const note = page.locator('[data-testid="unused-points-note"]');
  check("no note before the move", (await note.count()) === 0);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-opa", "S"));
  await page.waitForTimeout(1600);
  const text = (await note.count()) ? await note.textContent() : "";
  check("an Opa roll ends the turn with a note saying why", /1 point unused: an Opa moves only once per turn/.test(text), text);
  await page.waitForTimeout(4000);
  check("the note fades away", (await note.count()) === 0);
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nPOINTS COUNTER E2E PASSED" : `\nPOINTS COUNTER E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
