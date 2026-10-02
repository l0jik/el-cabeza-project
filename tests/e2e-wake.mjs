/* The screen kept on while the game's on screen (chassis: a Screen Wake
   Lock), let go after a spell with no touch (10 minutes; 2 s here), asked
   for again at the next touch.

   node tests/e2e-wake.mjs */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 10000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

for (const name of ["standard", "nova"]) {
  console.log(`\n${name}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_WAKE_IDLE_MS__ = 2000; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${name}.html`);
  const supported = await page.evaluate(() => !!(navigator.wakeLock && navigator.wakeLock.request));
  check("the browser offers a wake lock", supported);
  const W = () => page.evaluate(() => (window.__EC_WAKE__ ? window.__EC_WAKE__() : null));
  await page.touchscreen.tap(30, 300);
  check("the screen is kept on", !!(await poll(async () => { const w = await W(); return w && w.held; })), JSON.stringify(await W()));
  check("...let go after the spell with no touch", !!(await poll(async () => { const w = await W(); return w && !w.held && w.idle; }, 6000)), JSON.stringify(await W()));
  await page.touchscreen.tap(30, 300);
  check("...and kept on again at the next touch", !!(await poll(async () => { const w = await W(); return w && w.held && !w.idle; })), JSON.stringify(await W()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(failures ? `\nWAKE FAILED (${failures})` : "\nWAKE PASSED");
process.exit(failures ? 1 : 0);
