/* The store's slow pan (user: "When tienda opens on first / new game the
   store should be slowly panning from left to right 120°. When the extreme
   right end is reached, it will just do a soft bounce and start to pan
   back toward the left side. When the user takes control of the screen,
   it will stop moving. If they stop moving the screen voluntarily, then
   it will after about 10 seconds ... return back to panning left and
   right."): tienda-fx.js PAN_*. The camera at the opening framing turns
   round the table, rightward first, 60° either side of the opening view;
   past an end a soft spring turns it back; a finger down on the scene or
   a drag stops it; ten seconds still, it glides back onto its arc and
   turns on. (Under the tests it's off unless asked: __EC_TEST_PAN__.)

   node tests/e2e-store-pan.mjs */
import { chromium } from "playwright";
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 10000, step = 100) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_PAN__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 30000 });
await page.waitForTimeout(1200);
const PAN_HALF = Math.PI / 3;
const cam = () => page.evaluate(() => window.__EC_TEST_CAM__());
const pan = () => page.evaluate(() => window.__TIENDA_PAN__);
const framed = (c) => Math.abs(c.phi - 1.25) < 0.01 && Math.abs(c.radius - 66) < 0.5 && Math.abs(c.target[0] - 2.2) < 0.05 && Math.abs(c.target[1] + 2.87) < 0.05;
// Over a while: the pan's offsets, every 100 ms or so, till `done` has
// seen enough (or `ms` is up). (Its frames' steps are capped, so on a slow
// machine it turns slower than the clock: CI's took over 5 s to come back
// from the right end.)
const watch = async (ms, done) => { const out = []; const end = Date.now() + ms; while (Date.now() < end) { out.push((await pan()).off); if (done && done(out)) break; await page.waitForTimeout(100); } return out; };
// Whether it's turning: how far it goes in 2 s (still, it doesn't move at
// all; on a slow machine it goes slower than the clock, as above).
const turning = async () => { const a = await pan(); await page.waitForTimeout(2000); const b = await pan(); return { a, b, d: b.off - a.off }; };

{
  const { a, b, d } = await turning(); const c = await cam();
  check(`the lid on: the camera at the opening framing, turning rightward (${a.off} -> ${b.off})`, framed(c) && b.on && d > 0.01 && b.w > 0, JSON.stringify({ a, b, c }));
}
// The right end: a soft bounce, back the other way.
await page.evaluate((h) => window.__TIENDA_PAN_AT__(h - 0.06), PAN_HALF);
{
  const offs = await watch(15000, (o) => Math.max(...o) > PAN_HALF && o[o.length - 1] < Math.max(...o) - 0.035);
  const peak = Math.max(...offs), last = offs[offs.length - 1];
  const p = await pan();
  check(`...at the right end it bounces softly and heads back (peak ${(peak - PAN_HALF).toFixed(3)} rad past the end, now ${last.toFixed(3)})`, peak > PAN_HALF && peak < PAN_HALF + 0.05 && last < peak - 0.03 && p.dir === -1 && p.w < 0, JSON.stringify({ peak, last, p }));
}
// ...and at the left end the same, back to the right.
await page.evaluate((h) => window.__TIENDA_PAN_AT__(-h + 0.06), PAN_HALF);
await page.waitForTimeout(100);
{
  // (Headed left still: give it a moment to reach the end.)
  const offs = await watch(15000, (o) => Math.min(...o) < -PAN_HALF && o[o.length - 1] > Math.min(...o) + 0.035);
  const low = Math.min(...offs), last = offs[offs.length - 1];
  const p = await pan();
  check(`...and at the left end, back to the right (low ${(low + PAN_HALF).toFixed(3)} rad past the end, now ${last.toFixed(3)})`, low < -PAN_HALF && low > -PAN_HALF - 0.05 && last > low + 0.03 && p.dir === 1, JSON.stringify({ low, last, p }));
}
// The box opened: it goes on turning.
await page.locator('[data-testid="tienda-open-box"]').click();
await page.waitForTimeout(1500);
{
  const { a, b, d } = await turning();
  check(`the box opened: still turning (${a.off} -> ${b.off})`, b.on && Math.abs(d) > 0.01, JSON.stringify({ a, b }));
}
// A finger (the mouse) down on the scene: it stops where it is, held.
const box = await page.locator("canvas").first().boundingBox();
const spot = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.18 };
await page.mouse.move(spot.x, spot.y);
await page.mouse.down();
await page.waitForTimeout(300);
{
  const a = await cam(); await page.waitForTimeout(2000); const b = await cam(); const p = await pan();
  check(`pressed on the scene: it stops (${a.theta.toFixed(4)} -> ${b.theta.toFixed(4)})`, !p.on && Math.abs(b.theta - a.theta) < 1e-4, JSON.stringify({ a, b, p }));
}
await page.mouse.up();
await page.waitForTimeout(6000);
{
  const p = await pan();
  check(`...let go: still stopped a while on (${p.still} ms still)`, !p.on, JSON.stringify(p));
}
{
  const back = await poll(async () => { const p = await pan(); return p.on && !p.gliding ? p : null; }, 9000, 200);
  const { a, b, d } = await turning();
  check(`...about 10 s still: turning again (${a.off} -> ${b.off})`, !!back && Math.abs(d) > 0.01, JSON.stringify({ back, a, b }));
}
// A drag round: it stops there; 10 s on it glides back onto its arc (the
// opening framing, within the 120°) and turns on.
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.2);
await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width * 0.3 + i * 30, box.y + box.height * 0.2 + i * 6); await page.waitForTimeout(30); }
await page.mouse.up();
await page.waitForTimeout(800);
{
  const c = await cam(), p = await pan();
  check(`a drag round: stopped where they left it (off ${p.off}, phi ${c.phi.toFixed(3)})`, !p.on && (!framed(c) || Math.abs(p.off) > PAN_HALF), JSON.stringify({ c, p }));
}
{
  const back = await poll(async () => { const p = await pan(); return p.on ? p : null; }, 14000, 200);
  await poll(async () => !(await pan()).gliding, 6000, 200);
  await page.waitForTimeout(600);
  const c = await cam(), { a, b, d } = await turning();
  check(`...10 s still: back on its arc at the opening framing, turning (off ${b.off})`, !!back && framed(c) && Math.abs(b.off) <= PAN_HALF + 0.05 && Math.abs(d) > 0.01, JSON.stringify({ back, c, a, b }));
}
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
