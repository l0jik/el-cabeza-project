/* Undo after a trip through a black hole (user report: Undo turn played
   the AI Cabeza's wormhole step backwards as a slide, off the board's
   edge). Two paired holes; a Cabeza steps into one and comes out beside
   the other; that step always ends the turn. Undo turn must put it
   straight back where it started, and the piece's mesh must never leave
   the board on the way. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });
const HOLES = [{ row: 3, col: 2 }, { row: 7, col: 8 }];

async function setup(laws) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; }, laws);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await page.evaluate((h) => window.__EC_TEST_SET_HOLES__(h), HOLES);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    P("dark-cabeza", "cabeza", "dark", 4, 3, 1, 1, 1), // one diagonal step (NW) from the hole at 3,2
    P("light-cabeza", "cabeza", "light", 9, 0, 1, 1, 1),
    P("light-turrito", "turrito", "light", 9, 9, 1, 1, 1),
  ]);
  await page.waitForTimeout(400);
  const dock = page.locator('canvas[data-testid="dock-piece-canvas"]');
  const b = await dock.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  return { page, errs };
}
const cab = (page) => page.evaluate(() => { const p = window.__EC_TEST_PIECES__.find((q) => q.id === "dark-cabeza"); return p && [p.row, p.col]; });
// Samples the Cabeza mesh's board position through the undo; returns the
// farthest it strayed outside the 10x10 board, in squares.
async function watchStray(page, ms) {
  return page.evaluate((ms) => new Promise((res) => {
    let worst = 0; const t0 = performance.now();
    const tick = () => {
      const pos = window.__EC_TEST_SCREEN_POS__("dark-cabeza");
      const a = window.__EC_TEST_CUBE_POS__(0, 0), z = window.__EC_TEST_CUBE_POS__(9, 9);
      if (pos && a && z) {
        const minX = Math.min(a.x, z.x), maxX = Math.max(a.x, z.x), minY = Math.min(a.y, z.y), maxY = Math.max(a.y, z.y);
        const sq = (maxX - minX) / 9;
        const out = Math.max(minX - pos.x, pos.x - maxX, minY - pos.y, pos.y - maxY, 0) / sq;
        worst = Math.max(worst, out);
      }
      if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(worst);
    };
    tick();
  }), ms);
}

// Undo turn: the wormhole step ends a 2-point turn; then undo the whole turn.
{
  const { page, errs } = await setup({});
  const start = await cab(page);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "NW"));
  const turned = await (async () => { for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); if ((await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 1) return true; } return false; })();
  check("the wormhole step ends the turn", turned);
  const d = page.locator('canvas[data-testid="dock-piece-canvas"]'); const bb = await d.boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(700);
  const strayP = watchStray(page, 1800);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Undo turn" }).click();
  const stray = await strayP;
  await page.waitForTimeout(400);
  check("Undo turn puts it back where it started", JSON.stringify(await cab(page)) === JSON.stringify(start), JSON.stringify(await cab(page)));
  check(`...without leaving the board (${stray.toFixed(2)} squares out)`, stray < 0.3);
  check("...and the turn is gone", (await page.evaluate(() => window.__EC_TEST_TURNS__.length)) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// Undo after a shove (a slide ends the turn): the pushed piece goes back
// to its square too.
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { slide: true, threeActions: true, shoving: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    P("dark-cabeza", "cabeza", "dark", 0, 0, 1, 1, 1), P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
    P("dark-chato", "chato", "dark", 4, 3, 1, 2, 2),
    P("light-turrito", "turrito", "light", 4, 4, 1, 1, 1),
  ]);
  await page.waitForTimeout(400);
  const dock = page.locator('canvas[data-testid="dock-piece-canvas"]');
  let b = await dock.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-chato", "slide-E"));
  await page.waitForTimeout(1600);
  const at = (id) => page.evaluate((i) => { const p = window.__EC_TEST_PIECES__.find((q) => q.id === i); return p && [p.row, p.col]; }, id);
  check("the slide pushed the Turrito", JSON.stringify(await at("light-turrito")) === "[4,5]", JSON.stringify(await at("light-turrito")));
  b = await dock.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(700);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Undo turn" }).click();
  await page.waitForTimeout(1800);
  check("Undo turn brings the Chato back", JSON.stringify(await at("dark-chato")) === "[4,3]", JSON.stringify(await at("dark-chato")));
  check("...and the pushed Turrito back to its square", JSON.stringify(await at("light-turrito")) === "[4,4]", JSON.stringify(await at("light-turrito")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nUNDO WORMHOLE E2E PASSED" : `\nUNDO WORMHOLE E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
