/* A game in the den, left through the television for Neon and straight
   back, comes back exactly as it was (user): the same pieces where they
   were, the same log, the same side to move, still in play.

   node tests/e2e-den-return.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
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
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      // Home, the Singularity already seen and its commercial aired: the
      // set goes straight into Neon, and back out it just switches off.
      localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
      localStorage.setItem("el-cabeza:singularity-seen", "1");
      localStorage.setItem("el-cabeza:commercial-aired", "1");
      // (and the special-orders note already seen: it holds every tap)
      localStorage.setItem("el-cabeza:special-order-noted", "1");
    }
  } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
check("home, in the den", !!(await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000)));
await page.waitForTimeout(1500);
const place = () => page.evaluate(() => (window.__DEN_TV__ ? "den" : /Chakra/.test(getComputedStyle(document.querySelector(".ec-title") || document.body).fontFamily) ? "neon" : "?"));
const state = () => page.evaluate(() => ({
  pieces: JSON.stringify((window.__EC_TEST_PIECES__ || []).map((p) => [p.id, p.row, p.col, p.w, p.h, p.z]).sort()),
  log: JSON.stringify(window.__EC_TEST_LOG__ || []),
  turn: document.querySelector('[data-testid="turn-status"]') ? document.querySelector('[data-testid="turn-status"]').textContent : "",
}));

// Two players at the table, and a move made.
await openDockPanel(page);
const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
await page.waitForTimeout(2200);
const pos = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-flaco"));
await page.mouse.click(pos.x, pos.y);
await poll(() => page.evaluate(() => window.__EC_TEST_COST_BADGES__().length > 0), 4000);
await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
check("a move is made", !!(await poll(async () => JSON.parse((await state()).log).length > 0 || (await state()).pieces.includes('"dark-flaco",2'), 6000)));
await page.waitForTimeout(1200);
const before = await state();

// Through the set into Neon.
await page.evaluate(() => window.__DEN_TV_PRESS__());
check("into Neon through the television", !!(await poll(async () => (await place()) === "neon", 30000)));
await page.waitForTimeout(1500);
// Straight back: the title's hold, DISCONNECT.
const box = await page.locator(".ec-title").first().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(4600);
await page.mouse.up();
await poll(async () => (await page.locator(".ec-hold-modal-word").count()) > 0, 5000);
await page.locator(".ec-hold-modal-word").click({ force: true });
check("back in the den", !!(await poll(async () => (await place()) === "den", 30000)));
await page.waitForTimeout(3000);
const after = await state();
check("the same pieces where they were", after.pieces === before.pieces, `${before.pieces.slice(0, 120)} vs ${after.pieces.slice(0, 120)}`);
check("the same move log", after.log === before.log, `${before.log} vs ${after.log}`);
check(`the same side to move (${after.turn})`, after.turn === before.turn, `${before.turn} vs ${after.turn}`);
check("still in play (no Begin Game waiting)", (await page.locator("button", { hasText: /^Begin Game$/ }).count()) === 0);
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
