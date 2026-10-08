/* The store's opening view (user, with a screenshot): the box opened, the
   camera on the table with its Try it! card in view; the player may look
   round; once they've been still a while (10 s after the box, 6 s still)
   the camera glides gently back there and the card glows the store's
   neon blue; a tap on the card puts the glow out (tienda-fx.js
   OPENING_VIEW, tienda-store.js setGlow).

   node tests/e2e-store-opening.mjs */
import { chromium } from "playwright";
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 411, height: 914 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 30000 });
await page.waitForTimeout(1500);
const cam = (p) => page.evaluate((x) => window.__EC_TEST_CAM__(x), p || null);
const st = () => page.evaluate(() => window.__TIENDA_OPENING__);
const atOpening = (c) => Math.abs(c.theta - (Math.PI - 0.1)) < 0.02 && Math.abs(c.phi - 1.25) < 0.01 && Math.abs(c.radius - 66) < 0.5 && Math.abs(c.target[0] - 2.2) < 0.05;
check("the lid on: the camera already on the table", atOpening(await cam()), JSON.stringify(await cam()));
await page.locator('[data-testid="tienda-open-box"]').click();
await page.waitForTimeout(2000);
check("the box opened: the table and its card in view", atOpening(await cam()) && (await st()).opened);
const cardOnScreen = await page.evaluate(() => {
  const t = window.__TIENDA_THREE__; let p = null;
  t.scene.traverse((o) => { if (!p && o.userData && o.userData.tryIt) p = o; });
  const v = p.getWorldPosition(new p.position.constructor()).project(t.camera);
  return Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1;
});
check("...the card on screen", cardOnScreen);
check("...not glowing yet", (await st()).glow < 0.01);
// Looking round.
await cam({ theta: 2.2, phi: 1.0, radius: 40 });
await page.waitForTimeout(3000);
check("the player looks round: the camera stays where they put it", Math.abs((await cam()).radius - 40) < 0.01);
let back = null;
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  const s = await st();
  if (s.glow > 0.9) { back = s; break; }
  await page.waitForTimeout(400);
}
check("still a while: the card glows", !!back, JSON.stringify(await st()));
check("...and the camera's gone back to the table", atOpening(await cam()), JSON.stringify(await cam()));
// A tap on the card: the glow goes out (the flyer comes up).
await page.waitForTimeout(3500);
const at = await page.evaluate(() => {
  const t = window.__TIENDA_THREE__; let p = null;
  t.scene.traverse((o) => { if (!p && o.userData && o.userData.tryIt) p = o; });
  const v = p.getWorldPosition(new p.position.constructor()).project(t.camera);
  const r = t.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
});
await page.touchscreen.tap(at.x, at.y);
// (The glow eases out on the frames' clock: a moment longer on a busy machine.)
const poll = async (fn, ms) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await page.waitForTimeout(150); } };
check("a tap on the card: its flyer", await poll(async () => (await page.locator('[data-testid="tienda-try-it"]').count()) === 1, 4000));
check("...and the glow out", await poll(async () => { const s = await st(); return s.glow < 0.1 && s.cardTapped; }, 4000), JSON.stringify(await st()));
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
