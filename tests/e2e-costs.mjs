/* What a move costs, during play (chassis/ElCabeza3D.jsx). The move
   markers carry no cost badges (the user had Move costs taken out of the
   settings, then the badges themselves: "I'd rather they were gone
   entirely as well"); the costs are said in words: the piece card (data-
   testid piece-card) names the selected piece and says how it moves and
   what that costs, with a "More" link to its MOVES tile; a move the turn
   can't pay for is refused with Why not's "Not enough actions" note
   (e2e-why-not.mjs); a move back the way the piece came this turn still
   hands its action back. Checked in Futuris and Standard, whose markers
   have no sprites of their own, so a sprite on one would be a badge. And
   no Move costs switch: none in the menu's foot. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 8, col: 8, w: 1, h: 1, z: 1 },
];
const markers = (page) => page.evaluate(() => window.__EC_TEST_MARKERS__());
const badged = (ms) => ms.filter((m) => m.sprites > 0);
const left = (page) => page.evaluate(() => { const c = document.querySelector('[data-testid="points-counter"]'); return c ? Number(c.getAttribute("data-left")) : null; });
async function select(page, id) {
  const pos = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(700);
}

for (const theme of ["futuris", "standard"]) {
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
  await page.locator("button", { hasText: /Begin Game|Try a Demo Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") {
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }

  check("nothing selected, no markers", (await markers(page)).length === 0);
  await select(page, "dark-turrito");
  let m = await markers(page);
  check("selecting the Turrito marks each of its moves", m.length >= 4, JSON.stringify(m));
  check("...with no cost badge on any", m.length > 0 && !badged(m).length, JSON.stringify(m));
  const card = page.locator('[data-testid="piece-card"]');
  check("the piece card names the selected piece", (await card.count()) === 1 && /Turrito/.test(await card.innerText()), await card.count() ? await card.innerText() : "none");
  check("...and says how it moves and what it costs", /rolls one square.*1 action/i.test(await page.locator('[data-testid="piece-card-text"]').innerText()));
  await page.screenshot({ path: `/tmp/e2e-costs-${theme}-1.png` });
  // No Move costs switch in the menu's foot (nor in More: e2e-rings.mjs).
  {
    await openDockPanel(page);
    check("no Move costs switch among the menu's foot buttons", (await page.locator('[data-testid="costs-toggle"]').count()) === 0 && (await page.locator("[data-dock-foot]").count()) > 0);
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }
  await page.mouse.click(500, 880);
  await page.waitForTimeout(500);
  check("deselecting hides the card and the markers", (await card.count()) === 0 && (await markers(page)).length === 0);

  const left0 = await left(page);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1600);
  m = await markers(page);
  if (m.length === 0) { await select(page, "dark-turrito"); m = await markers(page); }
  check("after a roll, the way back is still marked (a free move beside 1-action ones), and still no badges", m.some((x) => x.dir === "N") && m.length >= 4 && !badged(m).length, JSON.stringify(m));
  const left1 = await left(page);
  check("...the roll took an action", left0 !== null && left1 === left0 - 1, `${left0} -> ${left1}`);
  await page.screenshot({ path: `/tmp/e2e-costs-${theme}-2.png` });
  await page.locator('[data-testid="piece-card-more"]').click();
  await page.waitForTimeout(600);
  const info = page.locator('[data-testid="info-overlay"]');
  check("More opens the rules at the Moves tab", (await info.getAttribute("data-open")) === "true" &&
    (await page.locator('[data-focus="true"]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("the card stays with the piece for the rest of the turn", (await card.count()) === 1);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "N"));
  await page.waitForTimeout(1600);
  check("...and rolling back hands the action back (it was free)", (await left(page)) === left0, `${left0} -> ${await left(page)}`);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await context.close();
}
// As players see it (no test switch): badges only when the costs differ
// (user); the points row says whose points they are; and once a move is
// made, an End turn button sits above the points row (only while the
// points are shown).
{
  console.log("[futuris, as played]");
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Demo Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") {
    await page.mouse.click(4, 450);
    await page.waitForTimeout(400);
  }
  check("the points row names whose points they are", /Photon/i.test(await page.locator('[data-testid="points-side"]').innerText()));
  // (and the side's colour, beside the name on a wide screen; user: "add (dark) to the Photon · Actions bar too")
  check("...with the side's colour beside it: Photon (dark)", /^Photon \(dark\)$/i.test((await page.locator('[data-testid="points-side"]').innerText()).replace(/\s+/g, " ").trim()), await page.locator('[data-testid="points-side"]').innerText());
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
  check("every roll costs the same: no badges", !badged(await markers(page)).length && (await markers(page)).length > 0, JSON.stringify(await markers(page)));
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1600);
  let b = await markers(page);
  if (b.length === 0) { await select(page, "dark-turrito"); b = await markers(page); }
  check("a free way back among them: still no badges (they're gone, user)", b.some((x) => x.dir === "N") && !badged(b).length, JSON.stringify(b));
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
  check("...actions left, a first game: it asks first", (await ask.count()) === 1 && /1 action left/i.test(await ask.innerText()));
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
  console.log("[futuris, points hidden]");
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:show-points", "0"); } catch (e) { /* none */ } });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Demo Game/ }).click();
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
