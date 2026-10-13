/* Hold to end (user: "Let's go with solution D", of the ways to stop a
   turn being ended by accident; chassis/ElCabeza3D.jsx endHoldRef).

   On a desktop (Standard, then the City), two players:
   - a tap on the piece that's moved keeps the turn going, and a note says
     how many actions are left and to hold the piece to end it;
   - a short press does nothing; a press that moves off it (a drag) does
     nothing; a press held there shows the ring and "Keep holding to end
     your turn", and ends the turn (its lift no tap);
   - a double click on a move marker (the accident: its second click lands
     on the square the piece is going to) moves the piece and nothing
     more: the turn goes on, no note;
   - switched off (the dock's switch, remembered), a tap ends the turn, as
     before.
   On a phone (the den's bar): the menu's switch; a tap, the note; a held
   touch ends the turn.

   node tests/e2e-hold-to-end.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 100) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });

const POSITION = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 6, w: 1, h: 1, z: 1 },
];
const turns = (page) => page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length);
const at = (page, id) => page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
const ring = (page) => page.locator('[data-testid="hold-to-end"]');
const hint = (page) => page.locator('[data-testid="hold-to-end-hint"]');
// A move marker's place on the screen.
const markerAt = (page, dir) => page.evaluate((d) => {
  const t = window.__EC_TEST_THREE__();
  let g = null;
  t.ghostGroup.traverse((o) => { if (!g && o.userData && o.userData.dir === d) g = o; });
  if (!g) return null;
  const v = g.getWorldPosition(g.position.clone()); v.project(t.camera);
  const r = t.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}, dir);
const settle = (page) => poll(() => page.evaluate(() => { const T = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__(); return !!T; }), 4000);

async function desktop(world) {
  console.log(`${world}, on a desktop`);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 860 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); } } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${D}/el-cabeza-${world}.html`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000, 250);
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  const human = page.locator('[data-opponent="human"]').first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.mouse.move(4, 430);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 430); await page.waitForTimeout(400); }
  await settle(page);

  // Dark: the Turrito chosen and rolled a square; its turn goes on.
  let p = await at(page, "dark-turrito");
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await poll(() => page.evaluate(() => { const q = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === "dark-turrito"); return q && q.row === 4; }), 8000);
  await page.waitForTimeout(800);
  check("a move made, the turn going on", (await turns(page)) === 0);

  // A tap on it: the turn goes on, and the note says how to end it.
  p = await at(page, "dark-turrito");
  await page.mouse.click(p.x, p.y);
  const note = await poll(async () => (await hint(page).count()) === 1 && (await hint(page).innerText()), 2000);
  check("a tap on the piece that's moved: the turn goes on", (await turns(page)) === 0);
  check(`...and a note says so ("${note}")`, !!note && /tap keeps your turn going \(\d actions? left\)/i.test(note) && /hold the piece to end it/i.test(note), String(note));

  // A short press: nothing.
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const ringShown = (await ring(page).count()) === 1;
  const label = ringShown ? await ring(page).innerText() : "";
  await page.mouse.up();
  await page.waitForTimeout(700);
  check("a press on it shows the ring, and what to do", ringShown && /keep holding to end your turn/i.test(label), label);
  check("...let go early: nothing ends, the ring goes", (await turns(page)) === 0 && (await ring(page).count()) === 0);

  // A press that moves off (a drag): nothing ends.
  p = await at(page, "dark-turrito");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(p.x + 60, p.y + 4, { steps: 6 });
  await page.waitForTimeout(900);
  const afterDrag = await turns(page);
  const ringAfterDrag = await ring(page).count();
  await page.mouse.up();
  await page.waitForTimeout(500);
  check("a press that moves off it (a drag): nothing ends, no ring", afterDrag === 0 && ringAfterDrag === 0 && (await turns(page)) === 0);

  // Held: the turn ends.
  await page.waitForTimeout(800);
  p = await at(page, "dark-turrito");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(350);
  if (world === "standard") await page.screenshot({ path: "/tmp/e2e-hold-to-end-ring.png" });
  const ended = await poll(async () => (await turns(page)) === 1, 2500, 50);
  await page.mouse.up();
  await page.waitForTimeout(600);
  check("held: the turn ends (in about two thirds of a second)", !!ended);
  check("...the ring gone, the lift no tap (Light's turn, nothing chosen)", (await ring(page).count()) === 0 && (await turns(page)) === 1 &&
    (await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).length)) === 4);

  // Light: a double click on a move marker (the accident).
  p = await at(page, "light-turrito");
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(600);
  const m = await markerAt(page, "N");
  check("Light's Turrito chosen, its markers out", !!m);
  if (m) {
    await page.mouse.dblclick(m.x, m.y);
    // (its roll: slower in a heavy world, here without a graphics card)
    await poll(() => page.evaluate(() => { const q = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === "light-turrito"); return q && q.row === 5; }), 8000);
    await page.waitForTimeout(800);
    const lt = await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).find((q) => q.id === "light-turrito"));
    check("a double click on a marker: the piece moves...", !!lt && lt.row === 5 && lt.col === 6, JSON.stringify(lt));
    check("...and the turn goes on (it used to end), no note", (await turns(page)) === 1 && (await hint(page).count()) === 0);
  }

  // Switched off (the dock's switch): a tap ends the turn, as before.
  await openDockPanel(page);
  const sw = page.locator('[data-testid="hold-to-end-switch"]');
  check("the dock in play has the switch, on", (await sw.count()) === 1 && (await sw.getAttribute("aria-checked")) === "true");
  if (await sw.count()) await sw.click();
  await page.waitForTimeout(300);
  check("...off (remembered)", (await sw.getAttribute("aria-checked")) === "false" && (await page.evaluate(() => localStorage.getItem("el-cabeza:hold-to-end"))) === "0");
  await page.mouse.click(4, 430);
  await page.waitForTimeout(600);
  p = await at(page, "light-turrito");
  await page.mouse.click(p.x, p.y);
  check("...then a tap on the piece that's moved ends the turn", !!(await poll(async () => (await turns(page)) === 2, 3000)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await desktop("standard");
await desktop("ciudad");

console.log("The den on a phone, the bar layout");
{
  const seed = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1", "el-cabeza:nova-layout": "bar" };
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${D}/el-cabeza-nova.html`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000, 250);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  await page.locator('[data-testid="shell-begin"]').click();
  await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 10000, 250);
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
  await page.waitForTimeout(800);
  // the menu's switch
  await page.locator('[data-testid="shell-menu-button"]').click();
  await page.waitForTimeout(600);
  const menuSw = page.locator('[data-testid="shell-menu-hold"]');
  check("the menu has Hold to end a turn, on", (await menuSw.count()) === 1 && (await menuSw.getAttribute("aria-checked")) === "true");
  await page.locator('[data-testid="shell-menu-close"]').click();
  await page.waitForTimeout(500);
  // a move, then a tap on the piece: the note; a held touch: the end
  let p = await at(page, "dark-turrito");
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await poll(() => page.evaluate(() => { const q = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === "dark-turrito"); return q && q.row === 4; }), 8000);
  await page.waitForTimeout(600);
  p = await at(page, "dark-turrito");
  await page.touchscreen.tap(p.x, p.y);
  check("a tap on it: the turn goes on, the note", !!(await poll(async () => (await hint(page).count()) === 1, 2000)) && (await turns(page)) === 0);
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  p = await at(page, "dark-turrito");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(p.x), y: Math.round(p.y) }] });
  await page.waitForTimeout(300);
  const shownOnPhone = (await ring(page).count()) === 1;
  await page.screenshot({ path: "/tmp/e2e-hold-to-end-phone.png" });
  const endedOnPhone = await poll(async () => (await turns(page)) === 1, 2500, 50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  check("a touch held on it: the ring, then the turn ends", shownOnPhone && !!endedOnPhone);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
