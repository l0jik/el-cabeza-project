/* The view's turn and tilt under a drag. The turn: where you touch (user,
   of three ways tried on a phone: "'C. Where you touch' seems the most
   correct option, but there's still the issue of reversal when crossing
   the vertical, mid-screen boundary"; chassis/turn-where.js). The side of
   the board under the pointer follows it: begun above the board's middle
   on screen a drag right turns it as the far side goes (theta up), begun
   below as the near side goes (theta down); once the pointer's well into
   the other half, that half's side takes over, so it's always the side
   under it that follows; along the middle a drag keeps its way. Finger up
   tilts toward the horizon (phi up), all the way across the middle. The
   Room view: the same turn, the tilt the other way.

   node tests/e2e-drag-latch.mjs [page] [phone|desktop] */
import { chromium } from "playwright";

const pageName = process.argv[2] || "el-cabeza-tienda.html";
const phone = (process.argv[3] || "phone") === "phone";
const vp = phone ? { width: 390, height: 844 } : { width: 1100, height: 800 };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
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
// The first steps one way, the last the other, and it changes over once.
const handsOver = (seen, k, first, last) => {
  const ds = [];
  for (let i = 1; i < seen.length; i++) { const d = seen[i][k] - seen[i - 1][k]; if (Math.abs(d) >= 1e-6) ds.push(Math.sign(d)); }
  if (ds.length < 8) return false;
  let changes = 0;
  for (let i = 1; i < ds.length; i++) if (ds[i] !== ds[i - 1]) changes++;
  return ds.slice(0, 3).every((v) => v === first) && ds.slice(-3).every((v) => v === last) && changes === 1;
};
// The board's middle on screen (the turning axis), from the camera as it is.
const axisY = () => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
  if (!t || !t.camera || !t.boardGroup) return null;
  const r = t.renderer.domElement.getBoundingClientRect();
  t.camera.updateMatrixWorld();
  const v = t.boardGroup.getWorldPosition(new t.camera.position.constructor());
  const view = v.clone().applyMatrix4(t.camera.matrixWorldInverse);
  if (view.z >= -1e-3) return null;
  v.project(t.camera);
  return r.top + (1 - v.y) / 2 * r.height;
});
const W = vp.width, H = vp.height;
// (Big Glutts' own page tilts the other way up and down, user: the
// chassis's invertTilt, apps/tienda.jsx. The latch is the same.)
const flip = pageName === "el-cabeza-tienda.html" ? -1 : 1;
const VIEWS = [["play view", { dollhouse: false, phi: Math.min(start.phi, 0.8), radius: start.radius, theta: start.theta }, false]];
if (pageName !== "el-cabeza-futuris.html") VIEWS.push(["Room view", { dollhouse: true, phi: 0.6, radius: 82, theta: start.theta }, true]);
for (const [name, state, room] of VIEWS) {
  console.log(`\n${name}`);
  const reset = async () => { await cam(state); await page.waitForTimeout(500); };
  // (A drag on the side of the screen, off the pieces, so it turns the view.)
  const x = Math.round(W * 0.12);
  await reset();
  const ay = await axisY();
  const mid = ay == null ? H / 2 : ay;
  const hi = Math.max(H * 0.08, mid - H * 0.22), lo = Math.min(H * 0.92, mid + H * 0.22);
  console.log(`  (the board's middle at y ${ay == null ? "? (behind the camera)" : Math.round(ay)} of ${H}; drags at ${Math.round(hi)} and ${Math.round(lo)})`);
  let s = await drag(x, hi, x + W * 0.5, hi);
  check("begun high, right: the far side follows (theta up)", steady(s, 0, 1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
  if (ay != null) {
    await reset();
    s = await drag(x, lo, x + W * 0.5, lo);
    check("begun low, right: the near side follows (theta down)", steady(s, 0, -1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
    await reset();
    s = await drag(x, hi, x + W * 0.5, lo);
    check("begun high, right and down well past the middle: the far side, then the near side once under the finger (one change)", handsOver(s, 0, 1, -1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
    await reset();
    s = await drag(x + W * 0.5, lo, x, hi);
    check("begun low, left and up well past the middle: the near side, then the far side (one change)", handsOver(s, 0, 1, -1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
    await reset();
    s = await drag(x, mid - H * 0.03, x + W * 0.5, mid + H * 0.03);
    check("along the middle, a little across it: keeps its way", steady(s, 0, 1), JSON.stringify(s.map((v) => v[0].toFixed(3))));
  }
  await reset();
  s = await drag(x, H * 0.3, x, H * 0.45);
  check(`finger down: the tilt ${(room ? 1 : -1) * flip > 0 ? "toward the horizon" : "toward overhead"}`, steady(s, 1, (room ? 1 : -1) * flip), JSON.stringify(s.map((v) => v[1].toFixed(3))));
  await reset();
  s = await drag(x, H * 0.6, x, H * 0.35);
  check(`finger up across the middle: the tilt ${(room ? -1 : 1) * flip > 0 ? "toward the horizon" : "toward overhead"} all the way`, steady(s, 1, (room ? -1 : 1) * flip), JSON.stringify(s.map((v) => v[1].toFixed(3))));
}
console.log(`\n${pageName} ${phone ? "phone" : "desktop"}: ${checks} checks, ${fails} failed; page errors ${errs.length}${errs.length ? ": " + errs.join(" | ") : ""}`);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
