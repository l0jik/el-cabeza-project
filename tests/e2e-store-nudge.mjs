/* The store's idle nudge (themes/tienda-overlay.js): the story's first
   visit, the lid off and nothing tried for a while (30 s; shortened here
   by window.__EC_TEST_NUDGE_MS__), the dock's turning piece lights in the
   Singularity's blue; opened, Try a Game lights until it's pressed.
   Looking round doesn't count as doing something, and nor does a look in
   the dock (opened and shut, it still lights); only a game begun does.
   Once lit, the blue grows the longer it's left
   (window.__EC_TEST_NUDGE_GROW_MS__ shortens that too). */
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

async function open(ms, grow) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(([ms, grow]) => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = ms; if (grow) window.__EC_TEST_NUDGE_GROW_MS__ = grow; }, [ms, grow]);
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
  check("...starting small (it grows over a minute and a half)", (await page.evaluate(() => +document.querySelector('[data-testid="tienda-dock-aura"]').dataset.grow)) < 0.2);
  check("the dock opens from it", await openDockPanel(page));
  check("...Try a Game is lit", (await anim(page, '[data-testid="tienda-try-game"]')) === "tdTryGlow" && /Try a Game/i.test(await q(page, "tienda-try-game").innerText()));
  await q(page, "tienda-try-game").click();
  check("pressed: a game, and the nudge is gone", await poll(async () => (await has(page, "tienda-price-tag")) && !(await nudging(page)) && !(await has(page, "tienda-dock-aura")), 10000));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nthe dock opened and shut first: it still lights, and grows");
{
  const { ctx, page, errs } = await open(2500, 12000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  check("the dock opens", await openDockPanel(page));
  await page.mouse.click(1240, 60);
  await poll(async () => !(await page.evaluate(() => { const p = document.querySelector('[data-testid="dock-panel"]'); return p && +getComputedStyle(p).opacity > 0.5; })), 4000);
  // Looking round some more.
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(420, 340, { steps: 8 }); await page.mouse.up();
  check("...shut again, the piece still lights after a while", await poll(() => nudging(page), 8000));
  const aura = () => page.evaluate(() => { const a = document.querySelector('[data-testid="tienda-dock-aura"]'); return a ? { g: +a.dataset.grow, w: parseFloat(a.style.width) } : null; });
  const a0 = await aura();
  await page.waitForTimeout(13000);
  const a1 = await aura();
  check(`...and its halo grows the longer it's left (${JSON.stringify([a0, a1])})`, !!a0 && !!a1 && a1.g > a0.g && a1.g > 0.95 && a1.w > a0.w && Math.abs(a1.w / a0.w - (0.92 + 0.95 * a1.g) / (0.92 + 0.95 * a0.g)) < 0.05);
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

console.log("\nshopping: the PA, the cart, closing time (user: nothing about orders in the store)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000; window.__EC_TEST_PA_MS__ = 7000; window.__EC_TEST_CLOSING_MS__ = 12000; window.__EC_TEST_CLOSING_MIN_MS__ = 2000; }); // (closing time 12 s after the in-stock words, which go at 10.7 s: in the same place, so a slow tap on them could land on it instead)
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  check("the dock opens", await openDockPanel(page));
  check("...its buy button: Put one in the cart", /Put one in the cart/i.test(await q(page, "story-purchase").innerText()));
  await q(page, "tienda-try-game").click();
  check("a game: the game's price tag, no order slip", await poll(() => has(page, "tienda-price-tag"), 10000) && !(await has(page, "tienda-slip-tag")));
  check("the PA: El Cabeza in stock, Aisle 9", await poll(async () => (await has(page, "tienda-pa-instock")) && /aisle 9/i.test(await q(page, "tienda-pa-instock").innerText()), 15000));
  await q(page, "tienda-pa-instock").click();
  check("...a tap on it: one in the cart", await poll(async () => (await has(page, "tienda-cart")) && (await page.evaluate(() => window.__TIENDA_SHOP__().cart)) === 1, 4000));
  check("closing time: the PA", await poll(() => has(page, "tienda-pa-closing"), 15000));
  check("...and the lights down a step", await poll(() => page.evaluate(() => window.__TIENDA_SHOP__().dim), 3000));
  await q(page, "tienda-pa-closing").click();
  check("...a tap on it: to the register (the purchase)", await poll(() => has(page, "story-cut"), 6000, 100));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
