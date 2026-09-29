/* Nova, home before the first Singularity: the set waits to be noticed
   (den-fx.js lure, den-tv.js haunt). For the first 40 s it can't be
   turned on (a tap on it, or the menu, does nothing); after that, left
   alone, it stirs, more and more (static, a rolling bar, ghosts on the
   glass, pieces of light drifting out); turned on, it goes into Neon.
   The test moves the lure's clock on (__DEN_LURE_SKIP__).

   node tests/e2e-tv-lure.mjs [--shots DIR] */
import { chromium } from "playwright";

const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 250) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
check("home, in the den", await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000));
await page.waitForTimeout(1500);
const tv = () => page.evaluate(() => window.__DEN_TV__());
let s = await tv();
check("the set waits: locked at first", s.lure && s.locked, JSON.stringify(s));
check("...a press does nothing", (await page.evaluate(() => window.__DEN_TV_PRESS__())) === false && (await tv()).phase === "off");
await page.waitForTimeout(3000);
check("...and nothing stirs yet", (await tv()).lureEvents === 0);
await page.evaluate(() => window.__DEN_LURE_SKIP__(41000));
check("after 40 s it can be turned on", !(await tv()).locked);
// Left alone a good while: it stirs, often.
await page.evaluate(() => window.__DEN_LURE_SKIP__(100000));
if (shots) {
  // Face the set (behind the sofa's side of the room), close.
  await page.evaluate(() => window.__DEN_TV_LOOK__(true));
  await page.waitForTimeout(2500);
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(650); await page.screenshot({ path: `${shots}/lure-${String(i).padStart(2, "0")}.png` }); }
}
const n = await poll(async () => { const t = await tv(); return t.lureEvents >= 3 ? t.lureEvents : null; }, 30000);
check(`...it stirs, more and more (${n || 0} events)`, !!n);
if (shots) { await page.evaluate(() => window.__DEN_TV_LOOK__(false)); await page.waitForTimeout(1500); }
check("turned on now, it goes", (await page.evaluate(() => window.__DEN_TV_PRESS__())) === true && (await tv()).phase !== "off");
check("...into Neon", await poll(() => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector(".ec-title") && /Chakra/.test(getComputedStyle(document.querySelector(".ec-title")).fontFamily)), 30000));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
