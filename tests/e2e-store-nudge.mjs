/* The store's idle nudge (themes/tienda-overlay.js): the story's first
   visit, the lid off and nothing tried for a while (30 s; shortened here
   by window.__EC_TEST_NUDGE_MS__), the dock's turning piece lights in the
   Singularity's blue; opened, Try a Game lights until it's pressed.
   Looking round doesn't count as doing something, and nor does a look in
   the dock (opened and shut, it still lights); only a game begun does.
   Once lit, the blue grows the longer it's left
   (window.__EC_TEST_NUDGE_GROW_MS__ shortens that too). And the store's
   PA through a visit: in stock, closing in ten minutes (the lights down,
   and the first time a player sees that, their thought under the words),
   then the last minutes and Big Glutts' notice a minute from closing,
   Just a minute once only; its cards swiped away once they've been up
   3 s. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
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
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const has = async (page, id) => (await q(page, id).count()) > 0;
const nudging = (page) => page.evaluate(() => document.documentElement.classList.contains("td-idle-nudge"));
const anim = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).animationName : null; }, sel);

async function open(ms, grow) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(([ms, grow]) => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = ms; if (grow) window.__EC_TEST_NUDGE_GROW_MS__ = grow; }, [ms, grow]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  return { ctx, page, errs };
}

console.log("\nidle in the store: the piece, then Try a Game");
{
  const { ctx, page, errs } = await open(2500);
  await page.waitForTimeout(3500);
  check("no nudge while the lid's on", !(await nudging(page)));
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  // Looking round: a drag on the board's surroundings.
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(420, 340, { steps: 8 }); await page.mouse.up();
  check("after a while doing nothing, the piece lights", await poll(() => nudging(page), 8000));
  check("...in the blue halo", (await anim(page, "[data-dock-piece] canvas")) === "tdPieceHalo" && (await has(page, "tienda-dock-aura")));
  check("...starting small (it grows over a minute and a half)", (await page.evaluate(() => +document.querySelector('[data-testid="tienda-dock-aura"]').dataset.grow)) < 0.2);
  check("the dock opens from it", await openDockPanel(page));
  check("...Try a Game is lit", (await anim(page, '[data-testid="tienda-try-game"]')) === "tdTryGlow" && /Try a Game/i.test(await q(page, "tienda-try-game").innerText()));
  await q(page, "tienda-try-game").click();
  check("pressed: a game, and the nudge is gone", await poll(async () => (await has(page, "end-game")) && !(await nudging(page)) && !(await has(page, "tienda-dock-aura")), 10000));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nthe dock opened and shut first: it still lights, and grows");
{
  const { ctx, page, errs } = await open(2500, 12000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  check("the dock opens", await openDockPanel(page));
  await page.mouse.click(1240, 60);
  await poll(async () => !(await page.evaluate(() => { const p = document.querySelector('[data-testid="dock-panel"]'); return p && +getComputedStyle(p).opacity > 0.5; })), 4000);
  // Looking round some more.
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(420, 340, { steps: 8 }); await page.mouse.up();
  check("...shut again, the piece still lights after a while", await poll(() => nudging(page), 8000));
  const aura = () => page.evaluate(() => { const a = document.querySelector('[data-testid="tienda-dock-aura"]'); return a ? { g: +a.dataset.grow, w: parseFloat(a.style.width) } : null; });
  const a0 = await aura();
  await page.waitForTimeout(13000);
  const a1 = await aura();
  check(`...and its halo grows the longer it's left (${JSON.stringify([a0, a1])})`, !!a0 && !!a1 && a1.g > a0.g && a1.g > 0.95 && a1.w > a0.w && Math.abs(a1.w / a0.w - (0.92 + 0.95 * a1.g) / (0.92 + 0.95 * a0.g)) < 0.05);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nphone, the lid: a tap that misses takes the page full screen");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => has(page, "tienda-open-box"), 30000);
  check("not full screen yet", !(await page.evaluate(() => !!document.fullscreenElement)));
  await page.touchscreen.tap(195, 120);
  check("a tap off the lid: full screen", await poll(() => page.evaluate(() => !!document.fullscreenElement), 4000));
  check("...and the lid still on", await has(page, "tienda-lid"));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nshopping: the PA, the cart, closing time (user: nothing about orders in the store)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // (The first game's walkthrough done: the PA waits for it to be put away.)
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000; window.__EC_TEST_PA_MS__ = 7000; window.__EC_TEST_CLOSING_MS__ = 12000; window.__EC_TEST_CLOSING_MIN_MS__ = 2000; // (closing time 12 s after the in-stock words, which go at 10.7 s: in the same place, so a slow tap on them could land on it instead)
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:first-game-tour", "done"); } } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  check("the dock opens", await openDockPanel(page));
  check("...its buy button: Put one in the cart", /Put one in the cart/i.test(await q(page, "story-purchase").innerText()));
  await q(page, "tienda-try-game").click();
  check("a game: no rules menu (nothing of orders before it's bought), no price tag", await poll(() => has(page, "end-game"), 10000) && !(await has(page, "corner-menu")) && !(await has(page, "tienda-shop")));
  check("the PA: El Cabeza in stock, Aisle 9", await poll(async () => (await has(page, "tienda-pa-instock")) && /aisle 9/i.test(await q(page, "tienda-pa-instock").innerText()), 15000));
  await q(page, "tienda-pa-instock").click();
  check("...a tap on it: one in the cart", await poll(async () => (await has(page, "tienda-cart")) && (await page.evaluate(() => window.__TIENDA_SHOP__().cart)) === 1, 4000));
  check("closing time: the PA", await poll(() => has(page, "tienda-pa-closing"), 15000));
  check("...and the lights down a step", await poll(() => page.evaluate(() => window.__TIENDA_SHOP__().dim), 3000));
  // The first time, the player's thought (user: "maybe a thought bubble
  // should come up saying, "Oh, I get turning down the lights. I guess
  // they want us out of here."" and of the wordings offered, "5."), under
  // the closing words; once a player.
  const th = await poll(() => has(page, "tienda-lights-thought"), 6000, 100);
  const thText = th ? (await q(page, "tienda-lights-thought").innerText()).replace(/\s+/g, " ") : "";
  const paBox = await q(page, "tienda-pa-closing").boundingBox(), thBox = th ? await q(page, "tienda-lights-thought").boundingBox() : null;
  check("...the player's thought: closing time", !!th && /^Huh, the lights are going down\. Guess it's closing time\.$/.test(thText.trim()), thText);
  check("...just under the closing words, clear of them", !!thBox && !!paBox && thBox.y >= paBox.y + paBox.height - 2 && thBox.y <= paBox.y + paBox.height + 40, JSON.stringify({ paBox, thBox }));
  check("...kept: once a player", await page.evaluate(() => localStorage.getItem("el-cabeza:lights-thought") === "1"));
  check("...then gone, the closing words still up", !!(await poll(async () => !(await has(page, "tienda-lights-thought")), 9000, 150)) && (await has(page, "tienda-pa-closing")));
  await q(page, "tienda-pa-closing").click();
  check("...a tap on it: to the register (the purchase)", await poll(() => has(page, "story-cut"), 6000, 100));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* The PA's cards swiped away (user: "You should be able to swipe dismiss
   these after about 3 seconds"): sooner, a swipe only tugs at one and it
   comes back; after, a finger's swipe left, or a mouse's drag up, and it's
   gone (swiped, not faded out at its time); and a swipe is never the
   card's tap (the cart, the register). (The first swipe's "sooner" is held
   open by __EC_TEST_PA_SWIPE_MS__, then put back to the game's 3 s: a slow
   machine can take seconds just to send a swipe.) */
console.log("\nthe PA's cards: swiped away after 3 s, not before");
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000;
    window.__EC_TEST_PA_MS__ = 3000; window.__EC_TEST_CLOSING_MS__ = 12000; window.__EC_TEST_PA_SWIPE_MS__ = 600000;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:first-game-tour", "done"); } } catch (e) { /* none */ }
    // When each card came up, and whether it was fading out when it went.
    window.__PA_AT__ = {}; window.__PA_GONE__ = {};
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => { const id = n.nodeType === 1 && n.getAttribute("data-testid"); if (id && /^tienda-pa-/.test(id)) window.__PA_AT__[id] = performance.now(); });
      m.removedNodes.forEach((n) => { const id = n.nodeType === 1 && n.getAttribute("data-testid"); if (id && /^tienda-pa-/.test(id)) window.__PA_GONE__[id] = n.getAttribute("data-going"); });
    })).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  // A finger's swipe from the card's middle (touch events, as a phone's).
  const swipe = async (id, dx, dy) => {
    const b = await q(page, id).boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 4; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 4, y: y + (dy * i) / 4 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const upFor = (id) => page.evaluate((k) => performance.now() - window.__PA_AT__[k], id);
  const middle = async (id) => { const b = await q(page, id).boundingBox({ timeout: 2000 }).catch(() => null); return b ? b.x + b.width / 2 : null; };
  const swiped = (id) => poll(() => page.evaluate((k) => window.__PA_GONE__[k] === "false", id), 2500, 50);
  const cart = () => page.evaluate(() => window.__TIENDA_SHOP__().cart);
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  await openDockPanel(page);
  await q(page, "tienda-try-game").click();
  await poll(() => has(page, "end-game"), 10000);
  check("the PA's first card", !!(await poll(() => has(page, "tienda-pa-instock"), 15000, 100)));
  await swipe("tienda-pa-instock", -220, 0);
  await page.waitForTimeout(600);
  const back = await middle("tienda-pa-instock");
  check("swiped too soon: it only gives, and it's back", back !== null && Math.abs(back - 206) < 4, `middle ${back}`);
  check("...and that's no tap: nothing in the cart", (await cart()) === 0);
  await page.evaluate(() => { window.__EC_TEST_PA_SWIPE_MS__ = 3000; });
  await poll(async () => (await upFor("tienda-pa-instock")) > 3300, 6000, 100);
  await swipe("tienda-pa-instock", -220, 0);
  check("3 s up, swiped left: gone", !!(await swiped("tienda-pa-instock")), JSON.stringify(await page.evaluate(() => window.__PA_GONE__)));
  check("...and that's no tap: nothing in the cart", (await cart()) === 0);
  check("closing time's card", !!(await poll(() => has(page, "tienda-pa-closing"), 20000)));
  await poll(async () => (await upFor("tienda-pa-closing")) > 3300, 6000, 100);
  // (A mouse's drag ends in a click on the card: no tap, all the same.)
  const b = await q(page, "tienda-pa-closing").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2 - 90, { steps: 4 });
  await page.mouse.up();
  check("...3 s up, dragged up with a mouse: gone", !!(await swiped("tienda-pa-closing")), JSON.stringify(await page.evaluate(() => window.__PA_GONE__)));
  await page.waitForTimeout(800);
  check("...and that's no tap: no trip to the register", !(await has(page, "story-cut")) && (await cart()) === 0);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* The last minutes (user: "After the 10-minute closing announcement is
   made, after 5 more minutes, have a new announcement made on every
   subsequent minute, announcing how many more minutes there are until it
   closes. And 1 minute before closing, have something show up with the
   big Glutz logo ... we're going to have to ask you to leave. Please take
   all purchases to the front"): a minute shortened to 1.2 s
   (__EC_TEST_CLOSING_MINUTE_MS__). */
async function lastMinutes() {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000;
    window.__EC_TEST_PA_MS__ = 3000; window.__EC_TEST_CLOSING_MS__ = 4000; window.__EC_TEST_CLOSING_MIN_MS__ = 2000; window.__EC_TEST_CLOSING_MINUTE_MS__ = 1200;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:first-game-tour", "done"); } } catch (e) { /* none */ }
    // What the PA says, in order, and when each first came.
    window.__PA_SAID__ = [];
    window.__PA_AT__ = {};
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      const id = n.nodeType === 1 && n.getAttribute("data-testid");
      if (id && /^tienda-(pa-|closing-notice)/.test(id)) { window.__PA_SAID__.push(id); if (window.__PA_AT__[id] == null) window.__PA_AT__[id] = performance.now(); }
    }))).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  await openDockPanel(page);
  await q(page, "tienda-try-game").click();
  await poll(() => has(page, "end-game"), 10000);
  check("closing time: the PA, ten minutes", await poll(() => has(page, "tienda-pa-closing"), 20000));
  const notice = await poll(() => has(page, "tienda-closing-notice"), 20000, 100);
  const said = (await page.evaluate(() => window.__PA_SAID__)).filter((id, i, a) => a.indexOf(id) === i);
  check("then five, four, three and two minutes, a minute apart, in that order", JSON.stringify(said) === JSON.stringify(["tienda-pa-instock", "tienda-pa-closing", "tienda-pa-5min", "tienda-pa-4min", "tienda-pa-3min", "tienda-pa-2min", "tienda-closing-notice"]), JSON.stringify(said));
  check("one minute to closing: Big Glutts' notice", !!notice);
  // Half a minute after the two-minute words, not a whole one (user: "Have
  // the last we are closing pop-up, the big one, show up about 30 seconds
  // sooner"), against the minute between three and two as it went here.
  const at = await page.evaluate(() => window.__PA_AT__);
  const early = (at["tienda-closing-notice"] - at["tienda-pa-2min"]) / (at["tienda-pa-2min"] - at["tienda-pa-3min"]);
  check("...half a minute after the two-minute words (it was a whole one)", early > 0.25 && early < 0.8, `${early.toFixed(2)} of a minute: ${JSON.stringify(at)}`);
  const text = notice ? (await q(page, "tienda-closing-notice").innerText()).replace(/\s+/g, " ") : "";
  check("...its logo, and we're going to have to ask you to leave; take all purchases to the front", /Big Glutts/i.test(text) && /closes in one minute/i.test(text) && /We’re going to have to ask you to leave\. Please take all purchases to the front registers\./.test(text), text);
  check("...over the store (its veil), the lights down another step", (await has(page, "tienda-closing-veil")) && (await poll(() => page.evaluate(() => window.__TIENDA_SHOP__().dim2), 3000)));
  const box = await q(page, "tienda-closing-notice").boundingBox();
  check("...on a phone, all of it on the screen", !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 412 && box.y + box.height <= 915, JSON.stringify(box));
  return { ctx, page, errs };
}
console.log("\nthe last minutes: Just a minute");
{
  const { ctx, page, errs } = await lastMinutes();
  await q(page, "tienda-closing-later").click();
  await page.waitForTimeout(600);
  check("Just a minute: the notice put away, still in the store", !(await has(page, "tienda-closing-notice")) && !(await has(page, "story-cut")) && (await has(page, "end-game")));
  await page.waitForTimeout(2500);
  check("...and, no moves made, it stays away (it's back only after more moves)", !(await has(page, "tienda-closing-notice")) && (await page.evaluate(() => window.__PA_SAID__.filter((id) => id === "tienda-closing-notice").length)) === 1);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
console.log("\nthe last minutes: to the register");
{
  const { ctx, page, errs } = await lastMinutes();
  await q(page, "tienda-closing-checkout").click();
  check("Take El Cabeza to the register: the purchase", await poll(() => has(page, "story-cut"), 6000, 100));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* Three moves after the walkthrough (user: "The user will be encouraged
   to purchase the game and leave the store 3 moves after they have
   started playing once the tutorial has been completed, because it seems
   like they're just kind of stuck in a low light situation with no game
   momentum"): a new player's first game, walked through (its turn and
   the computer's don't count), then the PA by the moves alone (the clock
   held off): in stock once the computer has answered the first move,
   closing time after the second (the in-stock words down first), and
   after the third Big Glutts' notice, the store closing now; its button
   the purchase. (The check alert off: it can hold a turn's end.) */
const MOVE_TRIES = [["light-flaco", "N"], ["light-chato", "N"], ["light-turrito", "N"], ["light-flaco", "S"], ["light-chato", "S"], ["light-turrito", "S"],
  ["light-flaco", "E"], ["light-flaco", "W"], ["light-chato", "E"], ["light-chato", "W"], ["light-turrito", "E"], ["light-turrito", "W"]];
const logLen = (page) => page.evaluate(() => (window.__EC_TEST_LOG__ || []).length);
const placeOf = (page, id) => page.evaluate((i) => { const p = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === i); return p ? [p.row, p.col, p.w, p.h, p.z].join(",") : null; }, id);
// One of the player's turns through the moves' own path, a step at a
// time (each piece and way tried till one moves), till the turn passes;
// then the computer's, till it's the player's again.
async function playTurn(page) {
  const n0 = await logLen(page);
  for (let step = 0; step < 6 && (await logLen(page)) === n0; step++) {
    let moved = false;
    for (const [id, dir] of MOVE_TRIES) {
      const before = await placeOf(page, id);
      if (!before) continue;
      await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
      const t0 = Date.now();
      while (!moved && Date.now() - t0 < 2500) {
        moved = (await placeOf(page, id)) !== before || (await logLen(page)) > n0;
        if (!moved) await page.waitForTimeout(120);
      }
      if (moved) break;
    }
    if (!moved) return false;
    await page.waitForTimeout(500);
  }
  return !!(await poll(async () => (await logLen(page)) >= n0 + 2 && (await page.evaluate(() => window.__EC_TEST_TO_MOVE__())) === "light", 60000, 250));
}
console.log("\nthree moves after the walkthrough: asked to take it to the register and leave");
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000;
    window.__EC_TEST_PA_MS__ = 600000; window.__EC_TEST_CLOSING_MS__ = 600000;
    try { localStorage.setItem("el-cabeza:check-alert", "0"); } catch (e) { /* none */ }
    // What the PA put up, with the turns the log had and whose turn it
    // was; and when each card went.
    window.__PA_SAID__ = []; window.__PA_GONE_AT__ = {};
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => {
        const id = n.nodeType === 1 && n.getAttribute("data-testid");
        if (id && /^tienda-(pa-|closing-notice)/.test(id)) window.__PA_SAID__.push({ id, at: performance.now(), log: (window.__EC_TEST_LOG__ || []).length, toMove: window.__EC_TEST_TO_MOVE__ && window.__EC_TEST_TO_MOVE__() });
      });
      m.removedNodes.forEach((n) => { const id = n.nodeType === 1 && n.getAttribute("data-testid"); if (id && /^tienda-pa-/.test(id)) window.__PA_GONE_AT__[id] = performance.now(); });
    })).observe(document, { childList: true, subtree: true });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const said = () => page.evaluate(() => window.__PA_SAID__);
  const shop = () => page.evaluate(() => window.__TIENDA_SHOP__());
  const step = () => page.evaluate(() => window.__EC_TEST_TOUR__ && window.__EC_TEST_TOUR__().step);
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  await poll(() => has(page, "tienda-open-box"), 10000);
  await q(page, "tienda-open-box").click();
  await poll(async () => !(await has(page, "tienda-lid")), 8000);
  await openDockPanel(page);
  await q(page, "tienda-try-game").click({ force: true });
  check("a new player's first game: the walkthrough", !!(await poll(() => has(page, "tour-card"), 15000)));
  for (let i = 0; i < 7 && (await has(page, "tour-next")); i++) { await q(page, "tour-next").click(); await page.waitForTimeout(800); }
  check("...its cards through: your first turn", (await poll(async () => (await step()) === "pieces", 8000)) === true, String(await step()));
  check("...that turn played, and the computer's (still walked through)", await playTurn(page), `log ${await logLen(page)}`);
  // (The other side's card, then the menu's three: Next, Open it, Next.)
  for (let i = 0; i < 40 && !(await has(page, "tour-done")); i++) { if (await has(page, "tour-next")) await q(page, "tour-next").click(); await page.waitForTimeout(700); }
  check("...neither counts: nothing said, no moves", (await said()).length === 0 && (await shop()).moves === 0, JSON.stringify({ said: await said(), shop: await shop() }));
  await q(page, "tour-done").click();
  check("Got it: the walkthrough's over", await poll(async () => (await step()) === null, 6000));

  check("the first move after it, answered", await playTurn(page), `log ${await logLen(page)}`);
  const stock = await poll(async () => (await said()).find((s) => s.id === "tienda-pa-instock"), 8000, 100);
  check("...the PA: in stock, once the computer had answered", !!stock && stock.log === 4 && stock.toMove === "light" && (await shop()).moves === 1, JSON.stringify({ stock, shop: await shop() }));
  check("...and nothing more yet", (await said()).length === 1 && !(await shop()).said.closing);

  check("the second move, answered", await playTurn(page), `log ${await logLen(page)}`);
  const closing = await poll(async () => (await said()).find((s) => s.id === "tienda-pa-closing"), 20000, 100);
  const goneAt = await page.evaluate(() => window.__PA_GONE_AT__["tienda-pa-instock"]);
  check("...closing time, the in-stock words down first", !!closing && closing.log >= 6 && closing.toMove === "light" && !!goneAt && goneAt <= closing.at, JSON.stringify({ closing, goneAt }));
  check("...the lights down a step, and no notice yet", (await poll(() => page.evaluate(() => window.__TIENDA_SHOP__().dim), 3000)) && !(await has(page, "tienda-closing-notice")) && (await shop()).moves === 2);

  check("the third move, answered", await playTurn(page), `log ${await logLen(page)}`);
  const notice = await poll(async () => (await said()).find((s) => s.id === "tienda-closing-notice"), 25000, 100);
  check("...Big Glutts' notice, the player to move (the closing words down first)", !!notice && notice.log >= 8 && notice.toMove === "light" && (await page.evaluate(() => window.__PA_GONE_AT__["tienda-pa-closing"])) <= notice.at && (await shop()).asked === "now", JSON.stringify({ notice, shop: await shop() }));
  const text = notice ? (await q(page, "tienda-closing-notice").innerText()).replace(/\s+/g, " ") : "";
  check("...the store closing now: asked to leave, take it to the front", /The store is now closing\./.test(text) && /We’re going to have to ask you to leave\. Please take all purchases to the front registers\./.test(text) && /Take El Cabeza to the register/i.test(text), text);
  check("...the lights down another step", await poll(() => page.evaluate(() => window.__TIENDA_SHOP__().dim2), 3000));
  check("...in order: in stock, closing time, the notice", JSON.stringify((await said()).map((s) => s.id)) === JSON.stringify(["tienda-pa-instock", "tienda-pa-closing", "tienda-closing-notice"]), JSON.stringify((await said()).map((s) => s.id)));

  /* Just a minute, and back after three more moves (user: "have Just a
     minute bring it back after a few moves"); the moves go on counting in
     a new game (which keeps the computer from getting far). */
  await q(page, "tienda-closing-later").click();
  check("Just a minute: put away, still in the store", (await poll(async () => !(await has(page, "tienda-closing-notice")), 4000)) && !(await has(page, "story-cut")) && (await shop()).back === 6, JSON.stringify(await shop()));
  await page.evaluate(() => window.__EC_TEST_NEW_GAME__());
  await page.waitForTimeout(2000);
  await openDockPanel(page);
  await q(page, "tienda-try-game").click({ force: true });
  check("...a new game", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true && (window.__EC_TEST_LOG__ || []).length === 0), 15000)));
  check("...two more moves: not yet", (await playTurn(page)) && (await playTurn(page)) && !(await has(page, "tienda-closing-notice")) && (await shop()).moves === 5, JSON.stringify(await shop()));
  check("...the third: back", (await playTurn(page)) && !!(await poll(() => has(page, "tienda-closing-notice"), 10000)));
  const again = (await has(page, "tienda-closing-notice")) ? (await q(page, "tienda-closing-notice").innerText()).replace(/\s+/g, " ") : "";
  check("...the store closed now, asked again to leave", /The store is now closed\./.test(again) && /We’re going to have to ask you to leave\./.test(again) && (await shop()).asked === "closed", again);
  // Once (user: "You should not be allowed to hit just a minute a second
  // time"): no Just a minute now, and Escape doesn't put it away.
  check("...no Just a minute this time", !(await has(page, "tienda-closing-later")) && (await shop()).waited === true, JSON.stringify(await shop()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  check("...nor Escape: it stays, the register the only way out", await has(page, "tienda-closing-notice"));
  await q(page, "tienda-closing-checkout").click();
  check("...its button: the purchase", await poll(() => has(page, "story-cut"), 6000, 100));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
