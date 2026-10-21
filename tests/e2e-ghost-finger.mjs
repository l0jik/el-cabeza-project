/* A finger whose lift never reached the board (user's video, home from
   the trip: "The single finger is panning everything, but I'm trying to
   continue playing the game and it won't let me"). The den's settle-in,
   started by the very tap that put the home card away, kept that tap's
   lift from the board, which went on counting a finger that wasn't there:
   every touch after it was a second finger, a two-finger pan.

   On a phone, with real touches (CDP): in Futuris and in the den, a lift
   swallowed at the window as a story's lock does, then one finger drags
   across the board: it turns the board, it doesn't pan. And the den's own
   way in: the home card, a tap on the board to put it away (the settle-in
   starting under it), the bulb, then one finger turns the board.

   node tests/e2e-ghost-finger.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
const DEN_SEED = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1" };
const W = 412, H = 915;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

async function open(url, seed) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__EC_TEST_CAM__).catch(() => false)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(2500);
  // (The den's lure would take over the view: put off.)
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  const client = await ctx.newCDPSession(page);
  return { ctx, page, errs, client };
}

async function beginGame(page) {
  if (await page.locator('[data-testid="shell-begin"]').count()) await page.locator('[data-testid="shell-begin"]').first().click().catch(() => {});
  else {
    await openDockPanel(page).catch(() => {});
    const b = page.locator('[data-testid="dock-panel"] button:text-matches("Begin Game|Try a Game")').first();
    if (await b.count()) await b.click().catch(() => {});
  }
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  return page.evaluate(() => window.__EC_TEST_ARMED__ === true);
}

const cam = (page, patch) => page.evaluate((p) => window.__EC_TEST_CAM__(p), patch || null);
const touch = (client, type, pts, at) => client.send("Input.dispatchTouchEvent", { type, timestamp: at, touchPoints: pts });
// One finger across the board, high on the screen (the board's far side):
// how much the view turned, and how far its aim moved.
async function oneFingerDrag(page, client) {
  const c0 = await cam(page);
  await cam(page, { theta: c0.theta, phi: 0.6, radius: c0.radius, dollhouse: false, snap: true });
  await page.waitForTimeout(600);
  const a = await cam(page);
  const x0 = 30, y0 = Math.round(H * 0.3), at = Date.now() / 1000;
  await touch(client, "touchStart", [{ x: x0, y: y0, id: 1 }], at);
  for (let i = 1; i <= 8; i++) { await touch(client, "touchMove", [{ x: x0 + i * 20, y: y0, id: 1 }], at + i * 0.03); await page.waitForTimeout(25); }
  await touch(client, "touchEnd", [], at + 0.3);
  await page.waitForTimeout(600);
  const b = await cam(page);
  return { turned: Math.abs(b.theta - a.theta), slid: Math.hypot(b.target[0] - a.target[0], b.target[1] - a.target[1], b.target[2] - a.target[2]) };
}
// A tap on the board whose lift is swallowed at the window on its way, as
// a story scene's lock does when it starts under a finger.
async function swallowedTap(page, client) {
  const at = Date.now() / 1000;
  await touch(client, "touchStart", [{ x: Math.round(W * 0.5), y: Math.round(H * 0.25), id: 7 }], at);
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.__swallowUp = (e) => { e.stopImmediatePropagation(); e.stopPropagation(); };
    window.addEventListener("pointerup", window.__swallowUp, true);
  });
  await touch(client, "touchEnd", [], at + 0.15);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.removeEventListener("pointerup", window.__swallowUp, true));
  await page.waitForTimeout(400);
}

for (const [name, url, seed] of [["Futuris", `${D}/el-cabeza-futuris.html`, {}], ["Nova den", `${D}/el-cabeza-nova.html`, DEN_SEED]]) {
  console.log(`\n${name}: a tap's lift swallowed, then one finger`);
  const { ctx, page, errs, client } = await open(url, seed);
  check("a game under way", await beginGame(page));
  const before = await oneFingerDrag(page, client);
  check(`first, one finger turns the board (turned ${before.turned.toFixed(3)}, slid ${before.slid.toFixed(2)})`, before.turned > 0.05 && before.slid < 0.5, JSON.stringify(before));
  await swallowedTap(page, client);
  const after = await oneFingerDrag(page, client);
  check(`after a lift that never arrived, one finger still turns it, no pan (turned ${after.turned.toFixed(3)}, slid ${after.slid.toFixed(2)})`, after.turned > 0.05 && after.slid < 0.5, JSON.stringify(after));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nNova den: home from the trip, the card put away by a tap on the board, then the bulb");
{
  const { ctx, page, errs, client } = await open(`${D}/el-cabeza-nova.html`, DEN_SEED);
  check("a game under way", await beginGame(page));
  check("home: the card", await page.evaluate(() => { if (!window.__DEN_HOME_NOW__) return false; window.__DEN_HOME_NOW__(); return true; }) && !!(await (async () => { for (let i = 0; i < 20; i++) { if (await page.locator('[data-testid="den-home-card"]').count()) return true; await page.waitForTimeout(150); } return false; })()));
  // (Held 3.8 s: then a tap anywhere else puts it away and goes on.)
  await page.waitForTimeout(4200);
  const at = Date.now() / 1000;
  await touch(client, "touchStart", [{ x: Math.round(W * 0.5), y: Math.round(H * 0.6), id: 3 }], at);
  await page.waitForTimeout(120);
  await touch(client, "touchEnd", [], at + 0.12);
  await page.waitForTimeout(800);
  check("...a tap on the board puts it away, and the bulb glows (the settle-in)", (await page.locator('[data-testid="den-home-card"]').count()) === 0 && (await page.evaluate(() => document.documentElement.classList.contains("ec-settle"))));
  await page.locator('[data-testid="focus-corner"]').click();
  check("...the bulb: the settle-in's over", !!(await (async () => { for (let i = 0; i < 20; i++) { if (!(await page.evaluate(() => document.documentElement.classList.contains("ec-settle")))) return true; await page.waitForTimeout(200); } return false; })()));
  await page.waitForTimeout(1200);
  const d = await oneFingerDrag(page, client);
  check(`then one finger turns the board, no pan (turned ${d.turned.toFixed(3)}, slid ${d.slid.toFixed(2)})`, d.turned > 0.05 && d.slid < 0.5, JSON.stringify(d));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
