/* The Shoving LAW in the real game (Neon). Laws are switched on at boot
   (window.__EC_LAWS__, apps/boardBootstrap.js) and a position placed via
   the test-only hooks (window.__EC_TEST_HOOKS__). Then a real move plays
   through the click path:
   1. A Chato slides into a Turrito and pushes it one square — both
      pieces end where the rules say, and the turn carries on.
   2. A roll pushes the piece it tips into just past where it lands (two
      squares for a piece right against it).
   3. An Opa rolls into a Turrito and a Cabeza side by side (lighter all
      together) and pushes both past its landing.
   4. An AI turn with the law on runs without errors. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

async function openPage(laws) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; }, laws);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  return { page, errs };
}
const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });
const cabezas = [P("dark-cabeza", "cabeza", "dark", 0, 0, 1, 1, 1), P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1)];

// ---- 1. a slide shoves ----
{
  const { page, errs } = await openPage({ slide: true, threeActions: true, shoving: true });
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    ...cabezas,
    P("dark-chato", "chato", "dark", 4, 3, 1, 2, 2),
    P("light-turrito", "turrito", "light", 4, 4, 1, 1, 1),
  ]);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-chato", "slide-E"));
  await page.waitForTimeout(120);
  await page.screenshot({ path: "/tmp/e2e-shove-mid.png" });
  await page.waitForTimeout(1300);
  const ps = await page.evaluate(() => window.__EC_TEST_PIECES__);
  const chato = ps.find((p) => p.id === "dark-chato");
  const tur = ps.find((p) => p.id === "light-turrito");
  check("the Chato slides one square east", chato && chato.col === 4 && chato.row === 4, JSON.stringify(chato));
  check("the Turrito it ran into is shoved one square east", tur && tur.col === 5 && tur.row === 4, JSON.stringify(tur));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 2. a roll shoves, just past where it lands ----
{
  const { page, errs } = await openPage({ shoving: true });
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    ...cabezas,
    P("dark-flaco", "flaco", "dark", 4, 3, 1, 1, 2), // standing, 2 tall: tips east across 2 squares
    P("light-turrito", "turrito", "light", 4, 4, 1, 1, 1),
  ]);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "E"));
  await page.waitForTimeout(1500);
  const ps = await page.evaluate(() => window.__EC_TEST_PIECES__);
  const flaco = ps.find((p) => p.id === "dark-flaco");
  const tur = ps.find((p) => p.id === "light-turrito");
  check("the Flaco tips over east, lying across 2 squares", flaco && flaco.col === 4 && flaco.w === 2, JSON.stringify(flaco));
  check("the Turrito is pushed 2 squares, clear of it", tur && tur.col === 6, JSON.stringify(tur));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 3. an Opa pushes two pieces side by side ----
{
  const { page, errs } = await openPage({ threeActions: true, shoving: true });
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    ...cabezas,
    P("dark-opa", "opa", "dark", 4, 2, 2, 2, 2),
    P("light-turrito", "turrito", "light", 4, 4, 1, 1, 1),
    P("dark-cabeza-2", "cabeza", "dark", 5, 4, 1, 1, 1),
  ]);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-opa", "E"));
  await page.waitForTimeout(1800);
  const ps = await page.evaluate(() => window.__EC_TEST_PIECES__);
  const at = (id) => ps.find((p) => p.id === id);
  check("the Opa rolls two squares east", at("dark-opa") && at("dark-opa").col === 4, JSON.stringify(at("dark-opa")));
  check("the Turrito and the Cabeza beside it are both pushed just past it", at("light-turrito").col === 6 && at("dark-cabeza-2").col === 6 && at("light-turrito").row === 4 && at("dark-cabeza-2").row === 5, JSON.stringify(ps));
  const meshes = await page.evaluate(() => ["light-turrito", "dark-cabeza-2"].map((id) => { const p = window.__EC_TEST_SCREEN_POS__(id); return p && Number.isFinite(p.x); }));
  check("both pushed pieces are back on the board after the animation", meshes.every(Boolean));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 4. the AI plays with the law on ----
{
  const { page, errs } = await openPage({ slide: true, threeActions: true, shoving: true });
  await openDockPanel(page);
  const aiBtn = page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).first();
  if (await aiBtn.count()) { await aiBtn.click(); await page.waitForTimeout(300); }
  const easy = page.locator('[data-testid="dock-panel"] button', { hasText: /^Easy$/i }).first();
  if (await easy.count()) { await easy.click(); await page.waitForTimeout(200); }
  await page.locator("button", { hasText: "Begin Game" }).click();
  let turns = [];
  for (let i = 0; i < 40 && !turns.length; i++) {
    await page.waitForTimeout(400);
    turns = await page.evaluate(() => window.__EC_TEST_TURNS__ || []);
  }
  check("the AI completed a turn with Shoving on", turns.length > 0, JSON.stringify(turns));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nSHOVING E2E PASSED" : `\nSHOVING E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
