/* Nova, home before the first Singularity: the set waits to be noticed
   (den-fx.js lure, den-tv.js haunt). For 25 s nothing; then, left alone,
   it stirs, more and more, heard loudest near it. A tap on it takes the
   camera over to watch (still off, stirring more often); a tap anywhere
   else goes back; a second tap on it turns it on, into Neon.
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
const near = () => page.evaluate(() => (window.__DEN_AUDIO__ && window.__DEN_AUDIO__().haunt.near) || 0);
let s = await tv();
check("the set waits at first", s.lure && s.locked, JSON.stringify(s));
check("...the menu's Turn on the TV does nothing yet", (await page.evaluate(() => window.__DEN_TV_PRESS_MENU__())) === false && (await tv()).phase === "off");
await page.waitForTimeout(3000);
check("...and nothing stirs yet", (await tv()).lureEvents === 0);
await page.evaluate(() => window.__DEN_LURE_SKIP__(26000));
check("after 25 s it stirs", !!(await poll(async () => (await tv()).lureEvents >= 1, 15000)), JSON.stringify(await tv()));
await page.waitForTimeout(400);
const far = await near();
// Left alone a good while: it stirs, often.
await page.evaluate(() => window.__DEN_LURE_SKIP__(60000));
if (shots) {
  await page.evaluate(() => window.__DEN_TV_LOOK__(true));
  await page.waitForTimeout(2500);
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(650); await page.screenshot({ path: `${shots}/lure-${String(i).padStart(2, "0")}.png` }); }
  await page.evaluate(() => window.__DEN_TV_LOOK__(false)); await page.waitForTimeout(3500);
}
const n0 = (await tv()).lureEvents;
const n = await poll(async () => { const t = await tv(); return t.lureEvents >= n0 + 3 ? t.lureEvents - n0 : null; }, 30000);
check(`...more and more (${n || 0} more events)`, !!n);
// A tap on the set: over to watch it, still off.
check("a tap on the set takes the camera over to it", (await page.evaluate(() => window.__DEN_TV_PRESS__())) === true);
check("...to watch", !!(await poll(async () => { const t = await tv(); return t.looking && t.focus > 0.9; }, 8000, 100)));
check("...and it's still off", (await tv()).phase === "off");
check("...with the hint", await page.locator('[data-testid="den-tv-hint"].on').count() === 1);
check(`...its sounds louder there (${far.toFixed(2)} -> ${(await near()).toFixed(2)})`, (await near()) > far * 1.3);
const w0 = (await tv()).lureEvents;
await page.waitForTimeout(6000);
check(`...where it keeps stirring (${(await tv()).lureEvents - w0} in 6 s)`, (await tv()).lureEvents - w0 >= 2);
// A tap elsewhere: back.
const box = await page.locator("canvas").first().boundingBox();
await page.mouse.click(box.x + 12, box.y + box.height - 12);
check("a tap off the set goes back", !!(await poll(async () => { const t = await tv(); return !t.looking && t.goal === 0 && t.phase === "off"; }, 3000, 100)));
await page.waitForTimeout(4200);
// Over again, and a tap on the set (the middle of the screen) turns it on.
await page.evaluate(() => window.__DEN_TV_PRESS__());
await poll(async () => (await tv()).focus > 0.95, 8000, 100);
await page.waitForTimeout(500);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check("the second tap turns it on", !!(await poll(async () => (await tv()).phase !== "off", 3000, 100)), JSON.stringify(await tv()));
check("...into Neon", await poll(() => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector(".ec-title") && /Chakra/.test(getComputedStyle(document.querySelector(".ec-title")).fontFamily)), 30000));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
