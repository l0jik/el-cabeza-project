/* The store's idle nudge (themes/tienda-overlay.js): the story's first
   visit, the lid off and nothing tried for a while (30 s; shortened here
   by window.__EC_TEST_NUDGE_MS__), the dock's turning piece lights in the
   Singularity's blue; opened, Try a Game lights until it's pressed.
   Looking round doesn't count as doing something; opening the dock first
   does, and then there's no nudge. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const has = async (page, id) => (await q(page, id).count()) > 0;
const nudging = (page) => page.evaluate(() => document.documentElement.classList.contains("td-idle-nudge"));
const anim = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).animationName : null; }, sel);

async function open(ms) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((ms) => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = ms; }, ms);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  return { ctx, page, errs };
}

console.log("\nidle in the store: the piece, then Try a Game");
{
  const { ctx, page, errs } = await open(2500);
  await page.waitForTimeout(3500);
  check("no nudge while the lid's on", !(await nudging(page)));
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  // Looking round: a drag on the board's surroundings.
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(420, 340, { steps: 8 }); await page.mouse.up();
  check("after a while doing nothing, the piece lights", await poll(() => nudging(page), 8000));
  check("...in the blue halo", (await anim(page, "[data-dock-piece] canvas")) === "tdPieceHalo" && (await has(page, "tienda-dock-aura")));
  check("the dock opens from it", await openDockPanel(page));
  check("...Try a Game is lit", (await anim(page, '[data-testid="tienda-try-game"]')) === "tdTryGlow" && /Try a Game/i.test(await q(page, "tienda-try-game").innerText()));
  await q(page, "tienda-try-game").click();
  check("pressed: a game, and the nudge is gone", await poll(async () => (await has(page, "tienda-slip-tag")) && !(await nudging(page)) && !(await has(page, "tienda-dock-aura")), 10000));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nthe dock opened first: no nudge");
{
  const { ctx, page, errs } = await open(2500);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  check("the dock opens", await openDockPanel(page));
  await page.mouse.click(1240, 60);
  await page.waitForTimeout(4500);
  check("...and nothing lights after", !(await nudging(page)));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nphone, the lid: a tap that misses takes the page full screen");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => has(page, "tienda-open-box"), 30000);
  check("not full screen yet", !(await page.evaluate(() => !!document.fullscreenElement)));
  await page.touchscreen.tap(195, 120);
  check("a tap off the lid: full screen", await poll(() => page.evaluate(() => !!document.fullscreenElement), 4000));
  check("...and the lid still on", await has(page, "tienda-lid"));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
