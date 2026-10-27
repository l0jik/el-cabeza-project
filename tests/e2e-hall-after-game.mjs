/* The hall's third time, after a game ends (user: "after the second
   prompt and before the timer runs out ... if the game ends ... it never
   reprompts, or it never pulls into the hallway ... that sequence is never
   able to complete"). themes/den-hall.js counted moves as the game's own
   move log, which a new game starts over, so it waited for a number the
   new game hadn't reached. Now the moves count across games, and the
   second time's "Let me just finish one game!" is taken at its word.

   1. Kept playing twice, then the game's won: a moment later the hall's
      back, and it pulls you in.
   2. Kept playing twice, the game's won and a new one set up straight
      away: it begins at once (below), the count carries on into it (the
      winning turn and two more), and it pulls you in.
   3. New Game with the hall on its way begins the next game at once
      (user: "I'm currently in the den, waiting to be dragged into the
      hallway. While playing, I got the first alert of a problem in the
      hallway. But then, after that first alert, I finished the game, I
      lost, and then I hit new game. It set the board back up again, but
      the 3D floating piece is there, and there's no way to start the
      game. It should, the 3D floating piece, when you hit new game in
      this instance, the 3D floating piece should immediately minimize
      and the game should be active. I selected retain the settings
      too"): a game from the order form, the first alert, kept playing,
      the game lost, New Game, Retain: under way with no Begin pressed,
      the dock piece in its corner all along (never the big one in the
      middle), the title kept small, the hall still waiting and counting. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });

async function home({ custom = false } = {}) {
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
  await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000);
  await page.waitForTimeout(1500);
  await (custom ? beginOrdered(page) : begin(page));
  return { ctx, page, errs };
}
// Human against human, Begin Game.
async function begin(page) {
  await openDockPanel(page);
  const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
  await page.waitForTimeout(2500);
}
// Human against human, from the order form (Custom rules, a Turrito
// more): a game of the order's own, so a win's New Game asks Retain or
// Reconfigure.
async function beginOrdered(page) {
  await openDockPanel(page);
  const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.locator('[data-testid="tienda-order-form"]').click();
  await poll(async () => (await page.locator('[data-testid="tienda-order"]').count()) > 0, 8000);
  await page.locator('[data-testid="tienda-piece-turrito-inc"]').click();
  const place = page.locator('[data-testid="tienda-order-place"]');
  await place.scrollIntoViewIfNeeded();
  await place.click({ force: true });
  await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await page.waitForTimeout(2500);
}
const hall = (page) => page.evaluate(() => window.__DEN_HALL__());
// It comes (as if the moves were made), and "keep playing" is picked.
async function flareAndKeep(page) {
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 8000 });
  await page.locator('[data-testid="den-hall-keep"]').click();
  return poll(async () => { const h = await hall(page); return h.state === "armed" && h.cam < 0.02 ? h : null; }, 8000);
}
// Whoever's to move wins in one step (their Cabeza a step from its far row).
async function winNow(page, wait = true) {
  const dark = (await page.locator('[data-testid="turn-status"]').getAttribute("data-side")) === "dark";
  await page.evaluate((dark) => window.__EC_TEST_SET_PIECES__([
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: dark ? 8 : 4, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: dark ? 5 : 1, col: 6, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
  ]), dark);
  await page.waitForTimeout(300);
  await page.evaluate((dark) => window.__EC_TEST_MOVE__(dark ? "dark-cabeza" : "light-cabeza", dark ? "S" : "N"), dark);
  if (!wait) return true;
  return poll(async () => (await page.locator('[data-testid="victory-backdrop"]').getAttribute("data-open")) === "true", 8000);
}
// A whole turn for whoever's to move: their cube rolled twice, away from
// everything (each roll 1 of the turn's 2 actions). Each roll is asked for
// once the cube has stood still a moment, whoever's turn it is read again
// each time: a move asked for while the last is still rolling is dropped
// (the board's own rule), and two at a fixed 0.9 s apart lost the second
// on a slow machine now and then (GitHub's), leaving the turn unfinished.
async function turn(page) {
  const turns = () => page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length);
  const before = await turns();
  const at = () => page.evaluate(() => (window.__EC_TEST_PIECES__ || []).filter((p) => /turrito/.test(p.id)).map((p) => `${p.id}@${p.row},${p.col}`).join(" "));
  let last = await at(), still = 0;
  for (const end = Date.now() + 20000; Date.now() < end; ) {
    if ((await turns()) > before) return true;
    const now = await at();
    if (now !== last) { last = now; still = Date.now(); }
    if (Date.now() - still > 1500) {
      const dark = (await page.locator('[data-testid="turn-status"]').getAttribute("data-side")) === "dark";
      await page.evaluate((dark) => window.__EC_TEST_MOVE__(dark ? "dark-turrito" : "light-turrito", dark ? "E" : "W"), dark);
      still = Date.now();
    }
    await page.waitForTimeout(150);
  }
  return false;
}

console.log("kept playing twice, then the game's won");
{
  const { ctx, page, errs } = await home();
  check("home, the hall armed", (await hall(page)).state === "armed");
  check("the first time: kept playing", !!(await flareAndKeep(page)));
  const second = await flareAndKeep(page);
  check(`the second time ("Let me just finish one game!"): kept playing (${JSON.stringify(second && { need: second.need, flares: second.flares })})`, !!second && second.flares === 2 && second.need === 3);
  check("the game's won before the moves come", !!(await winNow(page)));
  const third = await poll(async () => { const h = await hall(page); return h.state !== "armed" ? h : null; }, 8000, 100);
  check(`a moment later it's back (${JSON.stringify(third && { state: third.state, flares: third.flares })})`, !!third && third.flares === 3);
  const pulled = await poll(async () => { const h = await hall(page); return h.state === "walk" && h.dragged ? h : null; }, 8000, 100);
  check("...and it pulls you in (no choice the third time)", !!pulled);
  // A sheet of the game's up as it pulls you in (user: a Singularity
  // game's NEW GAME choice stayed over the whole walk, under the scene's
  // blocker, so it couldn't be used or put away): each waits, unseen and
  // untouchable, till the scene's over. (Opened as the chassis opens
  // them: opacity 1, taps on.)
  const sheets = await page.evaluate(() => ["new-game-choice", "info-overlay", "victory-backdrop"].map((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return [id, "missing"];
    el.style.opacity = "1"; el.style.pointerEvents = "auto";
    const cs = getComputedStyle(el);
    return [id, `${cs.opacity}/${cs.pointerEvents}`];
  }));
  check(`...every sheet of the game's out of sight meanwhile (${sheets.map((x) => x.join(" ")).join(", ")})`, sheets.every(([, v]) => v === "0/none"));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("kept playing twice, the game's won, and a new one set up straight away");
{
  const { ctx, page, errs } = await home();
  await flareAndKeep(page);
  check("kept playing twice", !!(await flareAndKeep(page)) && (await hall(page)).flares === 2);
  await winNow(page, false);
  // New Game at once, before the moment's up: with the hall on its way,
  // the next game begins with it (no Begin to press).
  const ng = page.locator('[data-testid="new-game"]');
  check("the game's won", !!(await poll(async () => (await ng.count()) > 0, 8000, 50)));
  await ng.first().evaluate((b) => b.click());
  check("New Game: the next game under way at once, no Begin pressed", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true && (window.__EC_TEST_LOG__ || []).length === 0), 6000, 50)));
  await page.waitForTimeout(600);
  const h0 = await hall(page);
  check(`a new game under way, the hall still waiting, the winning turn counted (${JSON.stringify({ state: h0.state, made: h0.made, need: h0.need })})`, h0.state === "armed" && h0.made === 1 && h0.need === 3);
  // The new game's own move log starts over; the count carries on.
  await page.evaluate(() => window.__EC_TEST_SET_PIECES__([
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 1, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 8, w: 1, h: 1, z: 1 },
  ]));
  await page.waitForTimeout(300);
  check("a turn in the new game", !!(await turn(page)));
  check("...not yet", (await hall(page)).state === "armed");
  check("another turn", !!(await turn(page)));
  const pulled = await poll(async () => { const h = await hall(page); return h.flares === 3 && (h.state === "flare" || h.state === "walk") ? h : null; }, 8000, 100);
  check(`...and it's back, the third time (${JSON.stringify(pulled && { state: pulled.state, made: pulled.made })})`, !!pulled);
  check("...and it pulls you in", !!(await poll(async () => { const h = await hall(page); return h.state === "walk" && h.dragged; }, 8000, 100)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("the hall on its way: the game lost, New Game, Retain");
{
  const { ctx, page, errs } = await home({ custom: true });
  check("the order form's game under way, the hall armed", (await hall(page)).state === "armed" && (await page.evaluate(() => !!window.__EC_TEST_THREE__().singularityGameActive)));
  check("the first alert: kept playing", !!(await flareAndKeep(page)));
  check("the game's over", !!(await winNow(page)));
  await page.locator('[data-testid="new-game"]').first().evaluate((b) => b.click());
  const choice = page.locator('[data-testid="new-game-choice"]');
  check("New Game asks: Retain or Reconfigure", !!(await poll(async () => (await choice.evaluate((el) => getComputedStyle(el).opacity)) === "1", 5000, 100)));
  // Every frame from Retain till a moment after the game's under way: the
  // dock piece's box, and whether the title's still its small self.
  await page.evaluate(() => {
    const log = (window.__NG__ = []);
    const tick = () => {
      if (window.__NG__ !== log) return;
      const c = document.querySelector('canvas[data-testid="dock-piece-canvas"]');
      const r = c && c.getBoundingClientRect();
      log.push({ armed: window.__EC_TEST_ARMED__, w: r ? Math.round(r.width) : null, x: r ? Math.round(r.x) : null, title: !!document.querySelector(".ec-masthead-relocated") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await choice.locator("button", { hasText: /Retain Current Game Settings/ }).click();
  const on = await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true && (window.__EC_TEST_LOG__ || []).length === 0), 6000, 50);
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => { const l = window.__NG__ || []; window.__NG__ = null; return l; });
  check("Retain: the next game under way at once, no Begin pressed", !!on);
  const big = frames.filter((f) => f.w === null || f.w > 150 || f.x < 700);
  check(`...the dock piece in its corner all along, never the big one in the middle (${frames.length} frames, widest ${Math.max(0, ...frames.map((f) => f.w || 0))})`, frames.length > 10 && big.length === 0, JSON.stringify(big.slice(0, 5)));
  check("...the title kept small", frames.every((f) => f.title), JSON.stringify(frames.filter((f) => !f.title).slice(0, 3)));
  const h = await hall(page);
  check(`...the hall still waiting, counting on (${JSON.stringify({ state: h.state, flares: h.flares, made: h.made, need: h.need })})`, h.state === "armed" && h.flares === 1 && h.need === 3 && h.made >= 1);
  // And it's a game: a turn in it, counted.
  await page.evaluate(() => window.__EC_TEST_SET_PIECES__([
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 1, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 8, w: 1, h: 1, z: 1 },
  ]));
  await page.waitForTimeout(300);
  check("a turn in the new game", !!(await turn(page)));
  check("...counted by the hall", (await hall(page)).made >= h.made + 1);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `${fails} failure(s)` : "all passed");
process.exit(fails ? 1 : 0);
