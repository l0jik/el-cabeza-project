/* The view's turn and tilt under a drag: the original rule (user), kept
   for the whole drag, even one that crosses the screen's middle either
   way. Board views: begun on the upper half, a drag right turns the board
   one way (theta up); begun on the lower half, the other (theta down);
   finger up tilts toward the horizon (phi up). The Room view: both axes
   the other way, the same anywhere on screen.

   Each drag here runs across the middle, horizontally and vertically, and
   every step of it must move the view the same way as its first.

   node tests/e2e-drag-latch.mjs [page] [phone|desktop] */
import { chromium } from "playwright";

const pageName = process.argv[2] || "el-cabeza-tienda.html";
const phone = (process.argv[3] || "phone") === "phone";
const vp = phone ? { width: 390, height: 844 } : { width: 1100, height: 800 };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: vp });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`file:///home/user/el-cabeza-project/dist/${pageName}`);
await page.waitForTimeout(3500);
if (await page.locator('[data-testid="tienda-open-box"]').count()) { await page.locator('[data-testid="tienda-open-box"]').click(); await page.waitForTimeout(1500); }

const cam = (patch) => page.evaluate((p) => window.__EC_TEST_CAM__(p), patch || null);
const start = await cam();
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

// A drag from (x0, y0) to (x1, y1) in steps; the view's goal after each.
async function drag(x0, y0, x1, y1, steps = 24) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const seen = [];
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(12);
    const c = await cam(); seen.push([c.theta, c.phi]);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  return seen;
}
// Every step's change on an axis has the sign wanted (or none, at a stop).
const steady = (seen, k, sign) => {
  let moved = 0;
  for (let i = 1; i < seen.length; i++) { const d = seen[i][k] - seen[i - 1][k]; if (Math.abs(d) < 1e-6) continue; if (Math.sign(d) !== sign) return false; moved++; }
  return moved > 3;
};
const W = vp.width, H = vp.height;
const VIEWS = [["play view", { dollhouse: false, phi: Math.min(start.phi, 0.8), radius: start.radius, theta: start.theta }, false]];
if (pageName !== "el-cabeza-neon.html") VIEWS.push(["Room view", { dollhouse: true, phi: 0.6, radius: 82, theta: start.theta }, true]);
for (const [name, state, room] of VIEWS) {
  console.log(`\n${name}`);
  const reset = async () => { await cam(state); await page.waitForTimeout(500); };
  // (A drag on the side of the screen, off the pieces, so it turns the view.)
  const x = Math.round(W * 0.12);
  await reset();
  let s = await drag(x, H * 0.3, x + W * 0.5, H * 0.72);
  check("begun high, right and down across the middle: the turn keeps its way", steady(s, 0, 1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
  await reset();
  s = await drag(x + W * 0.5, H * 0.72, x, H * 0.3);
  check(`begun low, left and up across the middle: the turn keeps its way`, steady(s, 0, room ? -1 : 1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
  await reset();
  s = await drag(x, H * 0.7, x + W * 0.5, H * 0.3);
  check("begun low, right and up across the middle", steady(s, 0, room ? 1 : -1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
  await reset();
  s = await drag(x, H * 0.3, x, H * 0.45);
  check(`finger down: the tilt ${room ? "toward the horizon" : "toward overhead"}`, steady(s, 1, room ? 1 : -1), JSON.stringify(s.map((v) => v[1].toFixed(3))));
  await reset();
  s = await drag(x, H * 0.6, x, H * 0.35);
  check(`finger up across the middle: the tilt ${room ? "toward overhead" : "toward the horizon"} all the way`, steady(s, 1, room ? -1 : 1), JSON.stringify(s.map((v) => v[1].toFixed(3))));
}
console.log(`\n${pageName} ${phone ? "phone" : "desktop"}: ${checks} checks, ${fails} failed; page errors ${errs.length}${errs.length ? ": " + errs.join(" | ") : ""}`);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
