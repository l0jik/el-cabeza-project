/* The store's "Try it!" card on the table (user): a fresh story, the box
   opened; a tap on the card brings the store's flyer ("So you'd like to
   try it, eh?", $7.97), held a moment against wild taps, then up until
   it's tapped (a tap beside it doesn't count); a tap on it opens the menu
   as the piece's tap opens it, Try a Game lit (tienda-fx.js
   pickScene/sceneTap, tienda-overlay.js). On a phone, the card's corner in
   the opening view. */
import { chromium } from "playwright";
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.locator('[data-testid="tienda-open-box"]').click();
await page.waitForTimeout(5000);
// The card's leaf on screen, its farthest point inside the screen's edge
// (the opening view has it at the right edge of a phone).
const at = await page.evaluate(() => {
  const t = window.__TIENDA_THREE__; const pts = [];
  t.scene.traverse((o) => { if (o.userData && o.userData.tryIt) pts.push(o); });
  const r = t.renderer.domElement.getBoundingClientRect();
  let best = null;
  pts.forEach((m) => {
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox; const V = m.position.constructor;
    [0.04, 0.08, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].flatMap((fx) => [[fx, 0.4], [fx, 0.6]]).forEach(([fx, fy]) => {
      const v = new V(b.min.x + (b.max.x - b.min.x) * fx, b.min.y + (b.max.y - b.min.y) * fy, 0).applyMatrix4(m.matrixWorld).project(t.camera);
      const p = { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
      if (p.x > 4 && p.x < innerWidth - 6 && p.y > 4 && p.y < innerHeight - 4 && (!best || p.x > best.x)) best = p;
    });
  });
  return best;
});
check("the card's on screen", !!at, JSON.stringify(at));
if (at) await page.touchscreen.tap(at.x, at.y);
await page.waitForSelector('[data-testid="tienda-try-it"]', { timeout: 3000 }).catch(() => {});
const card = page.locator('[data-testid="tienda-try-it"]');
check("a tap on it: the store's word (the ad: $7.97)", (await card.count()) === 1 && /try it, eh\?/i.test(await card.innerText()) && /\$\s*7\.?\s*97/.test(await card.innerText()));
// (Tapped straight away, in the page: the test's own click waits for the
// card's entrance to settle, which can take past the hold.)
await page.evaluate(() => document.querySelector('[data-testid="tienda-try-it"]').click());
await page.waitForTimeout(150);
check("...held a moment: an early tap doesn't put it away", (await card.count()) === 1);
await page.waitForTimeout(6500);
check("...and up until it's tapped (user: it doesn't pop down by itself)", (await card.count()) === 1);
// A tap beside it: the store behind doesn't take it, the flyer stays.
await page.touchscreen.tap(195, 800);
await page.waitForTimeout(400);
const panelOpen = () => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
check("...a tap beside it doesn't put it away, or reach the store", (await card.count()) === 1 && !(await panelOpen()));
const cb = await card.boundingBox();
await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
await page.waitForTimeout(900);
check("then a tap on it: the menu, as the piece's tap opens it", (await card.count()) === 0 && (await panelOpen()));
check("...Try a Game lit", await page.evaluate(() => document.documentElement.classList.contains("td-idle-nudge")) && (await page.locator("button.td-try-game").count()) > 0);
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
