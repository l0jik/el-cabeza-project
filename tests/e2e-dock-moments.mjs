/* The dock by the moment (chassis DOCK_WORDS, user: the old panel was a
   cluttered relic). In play: the camera views as one small row and End
   game as a quiet link, no New Game. After a game: a line under the
   result, one big button for the next game, quiet links (the move log,
   the next game's opponent folded under one link), no Reset Game, no
   players read-out. Each theme says it in its own words (theme.dockWords).

   node tests/e2e-dock-moments.mjs */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

// [page, opening tap, the words this theme says]
const PAGES = [
  ["standard", null, { endGame: "Call it a night", newGame: "Set them up again", caption: "We'll finish it some other time." }],
  ["tienda", '[data-testid="tienda-open-box"]', { endGame: "Put them down", newGame: "Set up the demo again", caption: "Please leave pieces on the board." }],
  ["neon", null, { endGame: "Disconnect", newGame: "Reboot", caption: "session closed" }],
  ["cromo", null, { endGame: "Lay down", newGame: "Set the stones", caption: "The stones rest." }],
  ["plano", null, { endGame: "Roll up the plans", newGame: "A fresh sheet", caption: "Plans rolled up." }],
  ["lluvia", '[data-testid="lluvia-straight-to-board"]', { endGame: "Walk away", newGame: "Another round", caption: "Mưa vẫn rơi" }],
];

const has = async (page, id) => (await page.locator(`[data-testid="${id}"]`).count()) > 0;
const txt = async (page, id) => ((await page.locator(`[data-testid="${id}"]`).first().textContent()) || "").trim();

for (const [name, opening, w] of PAGES) {
  console.log(`\n${name}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${name}.html`);
  await page.waitForTimeout(1500);
  if (opening) { await page.locator(opening).click({ timeout: 30000 }); await page.waitForTimeout(1500); }
  check("setup: the dock opens", await openDockPanel(page));
  check("setup: no end game or new game yet", !(await has(page, "end-game")) && !(await has(page, "new-game")));
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  const corner = await waitForDockCorner(page, { timeoutMs: 10000 });
  await reopenDockPanelFromCorner(page, corner);
  await page.waitForTimeout(400);
  check(`in play: End game, in its words ("${w.endGame}")`, (await has(page, "end-game")) && (await txt(page, "end-game")).toLowerCase().startsWith(w.endGame.toLowerCase()), await txt(page, "end-game").catch(() => ""));
  check("in play: the views in one row, no New Game, no caption", (await has(page, "view-player")) && (await has(page, "view-top")) && !(await has(page, "new-game")) && !(await has(page, "dock-caption")));
  await page.locator('[data-testid="end-game"]').click();
  await page.waitForTimeout(700);
  check(`after: the one big button, in its words ("${w.newGame}")`, (await has(page, "new-game")) && (await txt(page, "new-game")).toLowerCase() === w.newGame.toLowerCase(), await txt(page, "new-game").catch(() => ""));
  check(`after: its line ("${w.caption}")`, (await txt(page, "dock-caption")).includes(w.caption), await txt(page, "dock-caption").catch(() => ""));
  check("after: no Reset Game, no players read-out, no End game", (await page.locator('[data-testid="dock-panel"] button', { hasText: /^Reset Game$/i }).count()) === 0 && !(await has(page, "dock-players")) && !(await has(page, "end-game")));
  check("after: the move log and the next game as quiet links", (await has(page, "move-log")) && (await has(page, "next-game")));
  check("after: the opponent folded away", (await page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).count()) === 0 && (await page.locator('[data-testid="dock-panel"] [aria-label="Back to opponent selection"]').count()) === 0);
  await page.locator('[data-testid="next-game"]').click();
  await page.waitForTimeout(300);
  check("...Next game unfolds it", (await page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).count()) + (await page.locator('[data-testid="dock-panel"] [aria-label="Back to opponent selection"]').count()) > 0);
  await page.locator('[data-testid="move-log"]').click();
  await page.waitForTimeout(500);
  check("...the move log opens", await page.evaluate(() => { const el = document.querySelector('[data-testid="movelog-sheet"]'); return !!el && +getComputedStyle(el).opacity > 0.5; }));
  await page.mouse.click(8, 8); // (a tap outside it puts it away)
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true"))) await openDockPanel(page);
  await page.locator('[data-testid="new-game"]').click();
  await page.waitForTimeout(800);
  check("...and the big button sets up the next game", await page.evaluate(() => !document.querySelector('[data-testid="new-game"]')));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures ? `\nDOCK MOMENTS FAILED (${failures})` : "\nDOCK MOMENTS PASSED");
process.exit(failures ? 1 : 0);
