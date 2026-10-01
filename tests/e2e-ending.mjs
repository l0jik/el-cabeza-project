/* The end of the story (themes/den-hall.js, den-ending.js, realities.js):
   home from the closed Big Glutts with the hall due, a game under way;
   the hall starts up (here, at once: the move count is the den's own
   rule, checked as staying quiet before it), the camera goes to the
   doorway, "Oh no… now what?", the choice. Keep playing: it dies down and
   waits for more moves. Investigate: the walk in, the eruption, the void,
   the words, the realities; the story's over. Stay in the den: the set's
   knob glows and clicks through the realities, and "Other realities"
   goes to one. Screenshots in the scratch folder if EC_SHOTS is set. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const SHOTS = process.env.EC_SHOTS || null;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      // Home, after the closed Big Glutts and the trip: the hall's due.
      localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, hallDue: true }));
      localStorage.setItem("el-cabeza:singularity-seen", "1");
      localStorage.setItem("el-cabeza:commercial-aired", "1");
      localStorage.setItem("el-cabeza:special-order-noted", "1");
    }
  } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
console.log("the hall");
check("home, in the den", !!(await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000)));
await page.waitForTimeout(1500);
check("the hall is armed (home from the trip)", (await page.evaluate(() => window.__DEN_HALL__ && window.__DEN_HALL__().state)) === "armed");
await openDockPanel(page);
const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
await page.waitForTimeout(2500);
check("...and stays quiet before the moves are made", (await page.evaluate(() => window.__DEN_HALL__().state)) === "armed");

await page.evaluate(() => window.__DEN_HALL_NOW__());
check("it starts up: the camera to the doorway", !!(await poll(async () => (await page.evaluate(() => window.__DEN_HALL__().cam)) > 0.97, 6000)));
check("\"Oh no… now what?\"", !!(await poll(async () => /Oh no… now what\?/.test(await page.locator('[data-testid="den-hall-say"]').innerText()), 5000)));
check("the choice: Investigate, or keep playing", !!(await poll(async () => (await page.locator('[data-testid="den-hall-investigate"]').count()) && /weird enough already/.test(await page.locator('[data-testid="den-hall-keep"]').innerText()), 5000)));
check("the doorway's light is on", (await page.evaluate(() => window.__DEN_HALL__().amt)) > 0.2);
check("...the page's corner buttons and points out of the way", await page.evaluate(() => document.documentElement.classList.contains("ec-hall-scene") && Number(getComputedStyle(document.querySelector('[data-testid="focus-corner"]')).opacity) < 0.05));
await shot(page, "hall-1-flare");
await page.locator('[data-testid="den-hall-keep"]').click();
check("keep playing: it dies down, the camera comes back", !!(await poll(async () => { const h = await page.evaluate(() => window.__DEN_HALL__()); return h.state === "armed" && h.cam < 0.02 ? h : null; }, 8000)));
check("...and waits a few more moves", (await page.evaluate(() => window.__DEN_HALL__().need)) === 3);

await page.evaluate(() => window.__DEN_HALL_NOW__());
await poll(async () => (await page.locator('[data-testid="den-hall-investigate"]').count()) > 0, 6000);
check("again: \"Oh, for the love of…\"", /Oh, for the love of…/.test(await page.locator('[data-testid="den-hall-say"]').innerText()));
await page.waitForTimeout(500);
await page.locator('[data-testid="den-hall-investigate"]').click();
check("investigate: the walk in", (await page.evaluate(() => window.__DEN_HALL__().state)) === "walk");
const inHall = await poll(async () => {
  const z = await page.evaluate(() => { const t = window.__DEN_THREE__; let g = null; t.scene.traverse((o) => { if (o.name === "den-hall") g = o.parent; }); const v = t.camera.position.clone(); g.worldToLocal(v); return v.z; });
  return z > 92 ? z : null;
}, 12000, 150);
check("through the doorway, into the hall", !!inHall, String(inHall));
await page.waitForTimeout(3500);
await shot(page, "hall-2-in-the-hall");
check("down the hall it's died down (calm)", (await page.evaluate(() => window.__DEN_HALL__().amt)) < 0.5);
await page.evaluate(() => window.__DEN_HALL_SKIP__());
check("then it erupts, to white, and the void", !!(await poll(async () => (await page.evaluate(() => window.__DEN_ENDING__ && window.__DEN_ENDING__() && window.__DEN_ENDING__().stage)) === "void", 8000)));
console.log("the void");
await page.waitForTimeout(2600);
await shot(page, "end-1-pulled");
await page.evaluate(() => window.__DEN_ENDING_SKIP__(6000));
await page.waitForTimeout(1500);
check("the words, one at a time", !!(await poll(async () => (await page.evaluate(() => window.__DEN_ENDING__().line)) >= 1, 6000)));
await shot(page, "end-2-words");
check("...the corner buttons and points still away", await page.evaluate(() => document.documentElement.classList.contains("ec-hall-scene")));
const st = await page.evaluate(() => window.__DEN_ENDING__());
await page.evaluate((ms) => window.__DEN_ENDING_SKIP__(ms), st.mergeAt - st.t + 6000);
await page.waitForTimeout(1500);
await shot(page, "end-3-merging");
await page.evaluate(() => window.__DEN_ENDING_SKIP__(3000));
check("the body drifts into the sphere, one with it", !!(await poll(async () => (await page.evaluate(() => window.__DEN_ENDING__().figure)) === false, 4000)));
check("then to black", !!(await poll(async () => /black|menu/.test(await page.evaluate(() => window.__DEN_ENDING__().stage)), 8000)));
check("...the controls still away", await page.evaluate(() => document.documentElement.classList.contains("ec-hall-scene")));
check("then the other realities", !!(await poll(async () => (await page.locator('[data-testid="realities"]').count()) > 0, 8000)));
check("...every version of the game (15)", (await page.locator('[data-testid^="reality-"]').count()) === 15);
check("the story's over (remembered)", await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:story")).ended === true));
await page.waitForTimeout(1200);
await shot(page, "end-4-realities");
await page.locator('[data-testid="realities-stay"]').click();
check("(the controls back after, once it's faded)", !!(await poll(async () => !(await page.evaluate(() => document.documentElement.classList.contains("ec-hall-scene"))), 4000)));
check("Stay in the den: back in the den", !!(await poll(async () => !(await page.locator('[data-testid="den-ending"]').count()) && !(await page.locator('[data-testid="realities"]').count()), 6000)));

console.log("after the story");
check("the set's channel dial glows (the story's over)", (await page.evaluate(() => window.__DEN_CHANNEL__().post)) === true);
await page.evaluate(() => window.__DEN_TV_CHANNEL__());
check("a turn of the dial: the set on, channel 02, the den", !!(await poll(async () => { const c = await page.evaluate(() => window.__DEN_CHANNEL__()); return c.phase === "channel" && c.name === "The Den, 1975"; }, 6000)));
await page.evaluate(() => window.__DEN_TV_CHANNEL__());
check("again: the next reality (Neon)", !!(await poll(async () => (await page.evaluate(() => window.__DEN_CHANNEL__().name)) === "Neon", 4000)));
// A real tap on the dial itself (the camera settled at the set first).
await page.waitForTimeout(2600);
const dial = await page.evaluate(() => { const t = window.__DEN_THREE__; let m = null; t.scene.traverse((o) => { if (!m && o.isMesh && o.userData && o.userData.tv === "channel") m = o; }); const v = m.getWorldPosition(m.position.clone()); v.project(t.camera); const r = t.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
await page.mouse.click(dial.x, dial.y);
check("a tap on the dial: Big Glutts", !!(await poll(async () => (await page.evaluate(() => window.__DEN_CHANNEL__().name)) === "Big Glutts", 4000)));
await page.waitForTimeout(3200);
await shot(page, "post-1-channel");
check("the power knob: off", await (async () => { await page.evaluate(() => window.__DEN_TV_PRESS__()); return !!(await poll(async () => /closing|off/.test((await page.evaluate(() => window.__DEN_CHANNEL__().phase)) || ""), 3000)); })());
await page.evaluate(() => window.__DEN_TV_CHANNEL__());
check("...the hint says what to do", /next channel/.test(await page.locator('[data-testid="den-tv-hint"]').innerText()));
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
check("Other realities in the corner (mid-game too)", !!(await poll(async () => (await page.locator('[data-testid="action-corner"]').count()) > 0, 8000)));
await page.locator('[data-testid="action-corner"]').click();
check("...opens the menu", !!(await poll(async () => (await page.locator('[data-testid="realities"]').count()) > 0, 4000)));
await page.locator('[data-testid="reality-store"]').click();
check("...and Big Glutts: the cut, then the store", !!(await poll(async () => (await page.locator('[data-testid="story-cut"]').count()) > 0, 4000)));
check("...where it is", !!(await poll(() => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector('[data-testid="dock-panel"], [data-testid="dock-corner"], .ec-title')), 20000)));
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\nENDING E2E FAILED (${fails})` : "\nENDING E2E PASSED");
process.exit(fails ? 1 : 0);
