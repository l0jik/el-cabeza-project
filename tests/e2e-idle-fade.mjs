/* The board alone after a moment's stillness (chassis/idle-fade.js; user:
   "During gameplay, if the board is not touched for 4 seconds, all
   hover-over menus, navpads, or displays disappear. They fade out
   quickly. If the board is touched again to rotate it or anything, they
   will come back as per normal.").

   In Futuris on a foldable's open screen (touch) and in the den on a
   laptop (a mouse): in play, the controls up; still for 3 s, still up;
   for 4.6 s, faded (and let through); a touch on the board, or the
   mouse moving, brings them back; the corner menu opened holds them up
   however long it's read; before Begin nothing fades.

   (A test's browser has it only when asked, window.__EC_IDLE_MS__.)

   node tests/e2e-idle-fade.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = "file:///home/user/el-cabeza-project/dist";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

const UI = ["corner-menu", "turn-status", "points-counter"];
const look = (page) => page.evaluate((ids) => {
  const op = {};
  ids.forEach((id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (e) op[id] = { o: Number(getComputedStyle(e).opacity), pe: getComputedStyle(e).pointerEvents }; });
  for (const sel of ["[data-fullscreen-toggle]", "[data-dock-piece]"]) { const e = document.querySelector(sel); if (e) op[sel] = { o: Number(getComputedStyle(e).opacity), pe: getComputedStyle(e).pointerEvents }; }
  return { idle: document.documentElement.classList.contains("ec-idle"), op };
}, UI);
const allUp = (s) => Object.values(s.op).every((v) => v.o > 0.1) && UI.every((id) => s.op[id]);
const allDown = (s) => Object.values(s.op).every((v) => v.o < 0.02 && v.pe === "none") && UI.every((id) => s.op[id]);
const brief = (s) => JSON.stringify({ idle: s.idle, op: Object.fromEntries(Object.entries(s.op).map(([k, v]) => [k, +v.o.toFixed(2)])) });

for (const world of [
  { page: "futuris", view: { width: 898, height: 930 }, touch: true },
  { page: "nova", view: { width: 1100, height: 800 }, touch: false, den: true },
]) {
  console.log(`[${world.page}, ${world.touch ? "touch" : "mouse"}]`);
  const ctx = await browser.newContext({ viewport: world.view, ...(world.touch ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript((den) => {
    window.__EC_TEST_HOOKS__ = true; window.__EC_IDLE_MS__ = 4000; window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      localStorage.setItem("el-cabeza:singularity-seen", "1");
      localStorage.setItem("el-cabeza:first-game-tour", "done");
      if (den && !sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
        localStorage.setItem("el-cabeza:commercial-aired", "1");
        localStorage.setItem("el-cabeza:special-order-noted", "1");
      }
    } catch (e) { /* none */ }
  }, !!world.den);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${DIST}/el-cabeza-${world.page}.html`);
  await page.waitForTimeout(world.den ? 6000 : 2500);
  // Before Begin: nothing fades.
  await page.waitForTimeout(4600);
  check("before Begin, still for 4.6 s: nothing faded", !(await look(page)).idle);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Demo Game/ }).first().click();
  await page.waitForTimeout(1500);
  const dock = page.locator('[data-testid="dock-panel"]');
  if ((await dock.count()) && (await dock.getAttribute("data-open")) === "true") { await page.mouse.click(4, world.view.height / 2); await page.waitForTimeout(600); }
  // (A press to start the clock from.)
  const board = { x: world.view.width / 2, y: world.view.height * 0.62 };
  if (world.touch) await page.touchscreen.tap(board.x, board.y); else await page.mouse.move(board.x, board.y);
  await page.waitForTimeout(400);
  let s = await look(page);
  check(`in play: the controls up (${brief(s)})`, !s.idle && allUp(s));
  await page.waitForTimeout(2600);
  s = await look(page);
  check("still for 3 s: still up", !s.idle && allUp(s), brief(s));
  await page.waitForTimeout(1600 + 500);
  s = await look(page);
  check(`still for 4.6 s: faded, and let through (${brief(s)})`, s.idle && allDown(s));
  // Back at a touch on the board, or the mouse moving over it.
  if (world.touch) await page.touchscreen.tap(board.x, board.y + 40); else await page.mouse.move(board.x + 30, board.y + 20);
  await page.waitForTimeout(1200);
  s = await look(page);
  check(`${world.touch ? "a touch on the board" : "the mouse moving"}: back (${brief(s)})`, !s.idle && allUp(s));
  // The corner menu opened holds them up.
  for (let i = 0; i < 3 && !(await page.locator('[data-testid="corner-menu-card"]').count()); i++) {
    const bb = await page.locator('[data-testid="corner-menu-tab"]').boundingBox();
    if (bb) { if (world.touch) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await page.waitForTimeout(400);
  }
  check("the corner menu opens", (await page.locator('[data-testid="corner-menu-card"]').count()) > 0);
  await page.waitForTimeout(5000);
  s = await look(page);
  check("...open, read for 5 s: nothing fades", !s.idle && (await page.locator('[data-testid="corner-menu-card"]').count()) > 0, brief(s));
  check("no page errors", errs.length === 0, errs.join(" / "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\nIDLE FADE E2E: ${failures} FAILED` : "\nIDLE FADE E2E PASSED");
process.exit(failures ? 1 : 0);
