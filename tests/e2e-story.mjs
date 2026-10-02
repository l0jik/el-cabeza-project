/* Nova's story (apps/novaStory.jsx, apps/unified.jsx): the store, the
   purchase, home.

   A first visit opens in the store (Tienda) with the lid on the box and no
   title hold. There it's the classic game: "See the pieces" is the
   catalog's page of the five pieces, to look at, not order. "Purchase and
   bring home" (the dock's setup row, the catalog, the sales slip in a
   game, the offer after one) rings it up: the receipt prints, the screen
   goes to black with "Later, at home.", and the den comes up, remembered
   (localStorage el-cabeza:story). At home the whole order form is back
   ("See the pieces" until the Singularity, then "Custom rules"), with "Back to the store" and "Start the story over";
   a game ordered there (a 14 x 12 board) doesn't follow the player back to
   the store, which is the classic game again. A reload opens at home; the
   fresh start clears the purchase and puts the lid back on. On a phone
   with the control bar, the same choices are in the bar and its menu. */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 250) => {
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
// Where the page is: the store's scene, the den's (test hooks), or Neon
// (its title in Chakra Petch).
const place = (page) => page.evaluate(() => {
  if (window.__TIENDA_THREE__) return "store";
  if (window.__DEN_THREE__) return "home";
  const t = document.querySelector(".ec-title");
  return t && /Chakra/.test(getComputedStyle(t).fontFamily) ? "neon" : null;
});
const owned = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("el-cabeza:story") || "null"); } catch (e) { return "bad"; } });
// The board's plate, width over depth, from the live slab.
const plate = (page) => page.evaluate(() => {
  const t = window.__TIENDA_THREE__ || window.__DEN_THREE__;
  const slab = t && t.boardGroup.getObjectByName("ec-slab");
  return slab ? +(slab.geometry.parameters.width / slab.geometry.parameters.depth).toFixed(3) : null;
});
// A scene change from start to finish: the cut comes up, goes, and the new
// place is there.
async function throughCut(page, to) {
  const came = await poll(() => has(page, "story-cut"), 8000, 100);
  const gone = came && (await poll(async () => !(await has(page, "story-cut")), 60000));
  const there = gone && (await poll(async () => (await place(page)) === to, 20000));
  return { came: !!came, gone: !!gone, there: !!there };
}

async function open({ phone = false, bar = false, storage = null } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(({ bar, storage }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      if (bar) localStorage.setItem("el-cabeza:nova-layout", "bar");
      if (storage === "owned") localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
    } catch (e) { /* none */ }
  }, { bar, storage });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await page.goto(URL);
  await poll(() => place(page), 30000);
  return { ctx, page, errs };
}

/* ---------------- desktop: the whole story ---------------- */
console.log("\ndesktop: the store, the purchase, home");
{
  const { ctx, page, errs } = await open();
  check("a first visit opens in the store", (await place(page)) === "store");
  check("...with the lid on the box", await poll(() => has(page, "tienda-lid"), 10000));
  check("...Open the box its one button", (await has(page, "tienda-open-box")) && !(await has(page, "tienda-lid-order")));
  check("...plain, not dimmed or lit", !/td-locked|td-sing-glow/.test(await q(page, "tienda-open-box").getAttribute("class")) && (await q(page, "tienda-open-box").getAttribute("aria-disabled")) === null);
  check("nothing is owned yet", (await owned(page)) === null);
  // The story's first moment: Open the box is the only way on (user).
  await page.mouse.click(30, 400); await page.waitForTimeout(250);
  check("a tap that misses: the lid stays on", await has(page, "tienda-lid"));
  await page.mouse.click(1200, 700); await page.waitForTimeout(250);
  await page.mouse.click(30, 700); await page.waitForTimeout(500);
  check("taps that miss bring no story card (user: not needed)", !(await page.locator(".td-story-hint").count()) && (await has(page, "tienda-lid")));
  check("the full-screen switch sits over the lid, the other corner buttons hidden", await page.evaluate(() => {
    const t = document.querySelector("[data-fullscreen-toggle]"); if (!t) return false;
    const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const how = document.querySelector('[data-testid="how-to-play"]');
    return !!el && t.contains(el) && (!how || getComputedStyle(how).visibility === "hidden");
  }));
  await q(page, "tienda-open-box").click();
  check("Open the box: the lid off", await poll(async () => !(await has(page, "tienda-lid")), 8000));
  check("no hold on the title in the store (the title is itself under a tap)", await page.evaluate(() => {
    const t = document.querySelector(".ec-title"); if (!t) return false;
    const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!el && (el === t || t.contains(el));
  }));

  // The dock's setup row.
  check("the dock's panel opens", await openDockPanel(page));
  const see = q(page, "tienda-order-form");
  check("the setup row has See the pieces", /See the pieces/i.test(await see.innerText()));
  check("...and Purchase and bring home", await has(page, "story-purchase") && /Purchase and bring home/i.test(await q(page, "story-purchase").innerText()));

  // The catalog's page of the pieces: five, to look at.
  await see.click();
  check("See the pieces opens the catalog's page", await poll(() => has(page, "tienda-catalog"), 8000));
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="tienda-catalog-"]')].map((e) => e.dataset.testid.replace("tienda-catalog-", "")).filter((k) => !["close", "purchase"].includes(k)));
  check(`...the five pieces in the box (${rows.join(", ")})`, rows.join() === "cabeza,turrito,flaco,chato,opa");
  check("...to look at: no order form, nothing to tick", !(await has(page, "tienda-order")) && (await page.locator('[data-testid="tienda-catalog"] input').count()) === 0);
  await q(page, "tienda-view-flaco").click();
  check("...a photograph takes the piece up in 3-D", await poll(async () => (await q(page, "tienda-piece-viewer").getAttribute("data-state")) === "open", 10000));
  await page.mouse.click(6, 6);
  await poll(async () => !(await has(page, "tienda-piece-viewer")), 8000);
  await q(page, "tienda-catalog-close").click();
  check("...and Close puts it away", await poll(async () => !(await has(page, "tienda-catalog")), 8000));

  // A game in the store: the classic game, and the slip sells it too.
  check("the dock's panel opens again", await openDockPanel(page));
  check("...where the game is only tried: Try a Game", (await page.locator('[data-testid="dock-panel"] button', { hasText: "Try a Game" }).count()) === 1 && (await page.locator('[data-testid="dock-panel"] button', { hasText: "Begin Game" }).count()) === 0);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Try a Game" }).first().click();
  check("a game begins", await poll(() => has(page, "tienda-slip-tag"), 10000));
  check("...with the ten classic pieces", await page.evaluate(() => { const p = window.__EC_TEST_PIECES__ || []; return p.length === 10 && p.every((x) => ["cabeza", "turrito", "flaco", "chato", "opa"].includes(x.type)); }));
  await q(page, "tienda-slip-tag").click();
  check("the sales slip offers the purchase mid-game", await poll(() => has(page, "tienda-slip-purchase"), 5000));
  await page.keyboard.press("Escape");
  // End it: the clerk's offer.
  const corner = await waitForDockCorner(page);
  check("the dock reopens mid-game", !!corner && (await reopenDockPanelFromCorner(page, corner)));
  const end = page.locator('[data-testid="end-game"]');
  for (let i = 0; i < 20 && (await end.count()) > 0; i++) { await end.click().catch(() => {}); await page.waitForTimeout(500); }
  check("after the game, the clerk's offer", await poll(() => has(page, "tienda-offer"), 8000));
  const offerBox = await q(page, "tienda-offer").boundingBox();
  check("...at the top of the screen", offerBox && offerBox.y < 120, JSON.stringify(offerBox));
  await q(page, "tienda-offer-dismiss").click();
  check("...and No thanks puts it away", await poll(async () => !(await has(page, "tienda-offer")), 5000));

  // Bought, from the dock after New Game.
  const again = page.locator('[data-testid="new-game"]');
  // (The panel folds away after a game; a direct click on the button.)
  if (await again.count()) await again.first().evaluate((b) => b.click());
  check("New Game brings the setup row back", await poll(() => has(page, "story-purchase"), 10000) || (await openDockPanel(page) && await has(page, "story-purchase")));
  await openDockPanel(page);
  await q(page, "story-purchase").click();
  check("Purchase and bring home starts the scene", await poll(() => has(page, "story-cut"), 5000, 100));
  check("...the purchase is remembered at once", (await owned(page) || {}).owned === true);
  const printed = await poll(async () => +(await q(page, "story-receipt").getAttribute("data-lines").catch(() => 0)) >= 11 && q(page, "story-receipt").innerText(), 15000, 150);
  check("the receipt prints: El Cabeza, 7.97, total 8.45", !!printed && /EL CABEZA/.test(printed) && /7\.97/.test(printed) && /8\.45/.test(printed), printed || "no receipt");
  const caption = await poll(async () => (await q(page, "story-caption").innerText()).trim(), 15000, 150);
  check(`black, and "${caption}"`, caption === "Later, at home.");
  const arrived = await throughCut(page, "home");
  check("...then the den", arrived.gone && arrived.there, JSON.stringify(arrived));

  // Home: everything.
  check("no lid at home", !(await has(page, "tienda-lid")));
  check("the dock's panel opens at home", await openDockPanel(page));
  // Before the Singularity there are no custom rules anywhere: the row
  // offers the catalog's page (look only), whose foot line is faded.
  check("the setup row has See the pieces (no custom rules yet)", /See the pieces/i.test(await q(page, "tienda-order-form").innerText()));
  check("...Back to the store and Start the story over", (await has(page, "story-back-to-store")) && (await has(page, "story-restart")));
  check("...and no purchase (it's bought)", !(await has(page, "story-purchase")));
  await q(page, "tienda-order-form").click();
  check("See the pieces is the catalog, not the order form", await poll(() => has(page, "tienda-catalog"), 8000) && !(await has(page, "tienda-order")));
  check("...special orders by arrangement, faded and not a link", /by arrangement/i.test(await q(page, "tienda-special-order").innerText()) && (await q(page, "tienda-special-order").evaluate((e) => e.tagName)) === "DIV");
  check("...and nothing to buy at home", !(await has(page, "tienda-catalog-purchase")));
  await q(page, "tienda-catalog-close").click();
  await poll(async () => !(await has(page, "tienda-catalog")), 5000);
  // (Closing the catalog puts the dock's panel away, as in the store.)
  await openDockPanel(page);
  // The sphere's been visited (as markSingularitySeen does it): special
  // orders open, once announced, and the row says Custom rules.
  await page.evaluate(() => { localStorage.setItem("el-cabeza:singularity-seen", "1"); window.dispatchEvent(new CustomEvent("el-cabeza:journey")); });
  check("after the Singularity: the note that special orders are open", await poll(() => has(page, "tienda-special-note"), 5000));
  check("...not lit at first", !/td-sing-glow/.test(await q(page, "tienda-special-note").getAttribute("class")));
  await page.mouse.click(8, 300);
  await page.waitForTimeout(400);
  check("...a tap elsewhere doesn't put it away (it's the way in)", await has(page, "tienda-special-note"));
  check("...but lights it in the Singularity's blue", /td-sing-glow/.test(await q(page, "tienda-special-note").getAttribute("class")));
  // (The first time through it's the only thing on the screen that takes
  // a tap, user: the dock, the board and the camera don't.)
  const cam0 = await page.evaluate(() => { const p = window.__EC_TEST_THREE__().camera.position; return [p.x, p.y, p.z].map((v) => v.toFixed(2)).join(); });
  await page.mouse.move(200, 500); await page.mouse.down(); await page.mouse.move(420, 380, { steps: 8 }); await page.mouse.up();
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(900);
  check("...nothing else takes a tap or a drag: the camera stays", cam0 === await page.evaluate(() => { const p = window.__EC_TEST_THREE__().camera.position; return [p.x, p.y, p.z].map((v) => v.toFixed(2)).join(); }));
  check("...and each tap off it makes it throb", /td-throb/.test(await q(page, "tienda-special-note").getAttribute("class")));
  await q(page, "tienda-special-note").click();
  check("the note is the whole order form", await poll(() => has(page, "tienda-order"), 8000));
  check("...with the board's size now, and still no shuffled start (Neon's alone)", (await has(page, "tienda-cols")) && !/Shuffled start/.test(await q(page, "tienda-order").innerText()));
  check("the note's gone once the form is open", !(await has(page, "tienda-special-note")));
  // Nothing ordered yet: the button waits, glowing, and says so if tapped.
  const place0 = q(page, "tienda-order-place");
  check("the button waits for an order, not lit at first", !/td-sing-glow/.test(await place0.getAttribute("class")) && (await place0.getAttribute("data-waiting")) === "true");
  await place0.scrollIntoViewIfNeeded();
  await place0.click({ force: true }); // (aria-disabled, but a tap still reaches it: that's the point)
  check("...a tap straight on it doesn't light it", !/td-sing-glow/.test(await place0.getAttribute("class")));
  check("...a tap says to order something special first", await poll(async () => /new special pieces/i.test((await has(page, "tienda-order-nudge")) ? await q(page, "tienda-order-nudge").innerText() : ""), 2000));
  check("...and nothing's stamped", !(await has(page, "tienda-order-stamp")));
  await q(page, "tienda-piece-turrito-inc").click();
  check("an order made: the button's ready", (await q(page, "tienda-order-place").getAttribute("data-waiting")) === "false");
  check("...and, a tap having landed elsewhere, lit in the Singularity's blue", /td-sing-glow/.test(await q(page, "tienda-order-place").getAttribute("class")));
  // The first time through, anything on the form can be chosen (user:
  // rules and board layouts too); Cancel and Standard don't work, and the
  // order stays as it is.
  await q(page, "tienda-law-slide-input").click();
  check("...a rule can be checked on it too", await q(page, "tienda-law-slide-input").isChecked());
  await q(page, "tienda-law-slide-input").click();
  const turritos = await page.locator('[data-testid="tienda-piece-turrito"]').innerText();
  await q(page, "tienda-order-cancel").click({ force: true });
  await q(page, "tienda-order-standard").click({ force: true });
  await page.waitForTimeout(500);
  check("...Cancel and Standard do nothing (the form stays, the order kept)", (await has(page, "tienda-order")) && (await page.locator('[data-testid="tienda-piece-turrito"]').innerText()) === turritos);
  check("...and the button throbs at a miss", /td-throb/.test(await q(page, "tienda-order-place").getAttribute("class")));
  // The first time through, the order is a special order to take to the
  // store (tienda-overlay.js guided).
  check("the first time through, the button takes it to the store", /Order it at Big Glutts/i.test(await q(page, "tienda-order-place").innerText()));
  check("...and the foot says where", /Special order: at your Big Glutts/.test(await q(page, "tienda-order-summary").innerText()));
  await q(page, "tienda-order-place").scrollIntoViewIfNeeded();
  await q(page, "tienda-order-place").click();
  check("the stamp: Take to store", await poll(async () => /Take to store/i.test(await q(page, "tienda-order-stamp").innerText()), 3000));
  await page.waitForTimeout(1600);
  check("...still there to read a moment later", await has(page, "tienda-order-stamp"));
  const capStore = await poll(async () => { const t = (await has(page, "story-caption")) ? await q(page, "story-caption").innerText() : ""; return /Big Glutts, order in hand/.test(t) ? t : null; }, 8000, 100);
  check("black, and \"Back at Big Glutts, order in hand.\"", !!capStore);
  const toStore = await throughCut(page, "store");
  check("...then the store", toStore.gone && toStore.there, JSON.stringify(toStore));
  check("the clerk comes over by himself", await poll(() => has(page, "tienda-clerk"), 10000));
  check("...you hand over the order form", await has(page, "tienda-clerk-handover"));
  for (let i = 0; i < 20 && (await has(page, "tienda-clerk-next")); i++) { await q(page, "tienda-clerk-next").click(); await page.waitForTimeout(600); }
  check("...and at the end: Go home, confused… with your form", /with your form/i.test(await q(page, "tienda-clerk-go-home").innerText()));
  await q(page, "tienda-clerk-go-home").click();
  const capHome = await poll(async () => { const t = (await has(page, "story-caption")) ? await q(page, "story-caption").innerText() : ""; return /already on the table/.test(t) ? t : null; }, 8000, 100);
  check("home again, confused: the new pieces already on the table", !!capHome);
  const toHome = await throughCut(page, "home");
  check("...and home", toHome.gone && toHome.there, JSON.stringify(toHome));
  const orderedN = await poll(async () => { const n = await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).length); return n === 12 ? n : null; }, 15000);
  check(`...the game set up from the order: two Turritos a side (${orderedN} pieces)`, orderedN === 12);
  // The thought, and then Big Glutts on the phone (themes/den-call.js).
  check("a thought: finally, a game in peace", await poll(async () => (await has(page, "den-thought")) && /in peace/.test(await q(page, "den-thought").innerText()), 12000));
  {
    // On one of the den's 1975 cards (den-cards.js): tilted, up and to the right, clear of the board's middle.
    const r0 = await q(page, "den-thought").boundingBox();
    const look = await page.evaluate(() => { const e = document.querySelector('[data-testid="den-thought"]'); return { card: !!e.querySelector(".stripes"), tf: getComputedStyle(e).transform }; });
    check("...on a 1975 card, askance in the upper right", !!r0 && look.card && look.tf !== "none" && r0.x + r0.width / 2 > 640 && r0.y < 400, JSON.stringify({ r0, look }));
  }
  await page.evaluate(() => window.__DEN_CALL_NOW__ && window.__DEN_CALL_NOW__());
  check("the game under way (it began itself, from the order), the phone rings", await poll(async () => (await page.evaluate(() => window.__DEN_CALL__ && window.__DEN_CALL__())) && (await page.evaluate(() => window.__DEN_CALL__().stage)) === "ringing" && (await has(page, "den-call")), 15000));
  check("...ring after ring", await poll(async () => (await page.evaluate(() => window.__DEN_CALL__().rings)) >= 2, 12000));
  check("...no button: the phone itself is picked up", !(await page.locator('[data-testid="den-call"] button').count()));
  // A record on, to be paused for the call (user: a fast fade out, and back
  // in where it was after).
  await page.evaluate(() => window.__DEN_TEST_PLAY__ && window.__DEN_TEST_PLAY__("el-cabeza-den-record-1.mp3"));
  const recOn = await poll(async () => { const m = (await page.evaluate(() => window.__DEN_AUDIO__ && window.__DEN_AUDIO__())).music; return m && !m.paused && m.time > 0.5 ? m : null; }, 8000);
  check("(a record playing)", !!recOn);
  // A tap on the slip: over to the phone, and the record paused.
  await q(page, "den-call").click();
  check("a tap on the ringing slip: the camera goes over to the phone", await poll(async () => (await page.evaluate(() => window.__DEN_PHONE_VISIT__().w)) > 0.97, 5000));
  check("...and the record fades out and pauses", await poll(async () => { const m = (await page.evaluate(() => window.__DEN_AUDIO__())).music; return m && m.paused; }, 2000));
  const pausedAt = (await page.evaluate(() => window.__DEN_AUDIO__())).music.time;
  if (process.env.EC_SHOT_PHONE) await page.screenshot({ path: process.env.EC_SHOT_PHONE });
  check("...the slip says to tap the phone", /tap the phone/i.test(await q(page, "den-call").innerText()));
  const at = await page.evaluate(() => window.__DEN_PHONE_AT__());
  await page.mouse.click(at.x, at.y);
  check("a tap on the phone: the handset lifts toward you", await poll(async () => (await page.evaluate(() => window.__DEN_CALL_HANDSET__())) === "held", 4000));
  check("...the caller in the user's recording, cut up (not the formant voice)", !!(await page.evaluate(() => window.__DEN_CALL__().voice)));
  check("picked up: Big Glutts, found the pieces", await poll(async () => /found the pieces/.test((await page.evaluate(() => window.__DEN_CALL__().text)) || ""), 8000));
  check("...you already have them", await poll(async () => /already have them/.test((await page.evaluate(() => window.__DEN_CALL__().text)) || ""), 15000));
  check("...free, if you like; sorry for any inconvenience", await poll(async () => /inconvenience/.test((await page.evaluate(() => window.__DEN_CALL__().text)) || ""), 20000));
  check("...okay, I'll be there", await poll(async () => /be there/.test((await page.evaluate(() => window.__DEN_CALL__().text)) || ""), 20000));
  check("...and they hang up", await poll(async () => (await page.evaluate(() => window.__DEN_CALL__().stage)) === "done" && !(await has(page, "den-call")), 12000));
  {
    const m = await poll(async () => { const x = (await page.evaluate(() => window.__DEN_AUDIO__())).music; return x && !x.paused ? x : null; }, 3000);
    check("hung up: the record plays on from where it was", m && Math.abs(m.time - pausedAt) < 3, JSON.stringify({ pausedAt, m }));
    check("...and the camera's back from the phone", await poll(async () => (await page.evaluate(() => window.__DEN_PHONE_VISIT__().w)) < 0.03, 5000));
  }
  check("...then: \"Free pieces?! Nice!... Thank you, Big Glutts!\"", await poll(async () => (await has(page, "den-yay")) && /Free pieces\?! Nice!/.test(await q(page, "den-yay").innerText()) && /Thank you, Big Glutts!/.test(await q(page, "den-yay").innerText()), 4000));
  check("...and it goes", await poll(async () => !(await has(page, "den-yay")), 9000));
  check("...and the handset's back on the cradle", (await page.evaluate(() => window.__DEN_CALL_HANDSET__ ? window.__DEN_CALL_HANDSET__() : "rest")) === "rest");
  const hsColor = await page.evaluate(() => window.__DEN_CALL_HANDSET_COLOR__ ? window.__DEN_CALL_HANDSET_COLOR__() : null);
  check("...still its green, not cream", hsColor === "587658", String(hsColor));
  // The trip back to Big Glutts (user): the car away, black, the store at
  // day, "What the...!??", merging into dusk with the sphere, "Time to get
  // the heck out of here!", black, and home in the Room view.
  check("the car leaving and arriving: the user's recordings, not the made ones", !!(await poll(async () => (await page.evaluate(() => { const d = window.__DEN_TRIP__ && window.__DEN_TRIP__(); return d && d.stage !== "idle" && d.car && d.arrival; })), 9000, 100)));
  check("the trip: off to the store", !!(await poll(async () => (await page.evaluate(() => window.__DEN_TRIP__ && window.__DEN_TRIP__().stage)) === "store", 9000, 100)));
  check("...\"What the...!??\"", !!(await poll(async () => (await page.locator('[data-testid="den-trip-say-1"].on').count()) === 1, 20000, 100)));
  check("...\"Time to get the heck out of here!\"", !!(await poll(async () => (await page.locator('[data-testid="den-trip-say-2"].on').count()) === 1, 20000, 100)));
  check("...home, in the Room view", !!(await poll(async () => { const s = await page.evaluate(() => window.__DEN_TRIP__().stage); const c = await page.evaluate(() => window.__EC_TEST_CAM__()); return (s === "home" || s === "done") && c.dollhouse; }, 20000, 100)));
  check("...and the trip's gone", !!(await poll(async () => !(await has(page, "den-trip")), 6000, 100)));
  // Home: a card, one of the user's ten lines, a tap and it's gone (and
  // the hall counts its moves from then).
  check("home: the card (one of the ten lines)", !!(await poll(async () => (await has(page, "den-home-card")) && (await q(page, "den-home-card").innerText()).length > 20, 8000)));
  await page.screenshot({ path: process.env.EC_SHOTS ? `${process.env.EC_SHOTS}/home-card.png` : "/dev/null" }).catch(() => {});
  {
    // (The same card, askance; a drag moves it and doesn't put it away.)
    const r0 = await q(page, "den-home-card").boundingBox();
    if (r0) {
      await page.mouse.move(r0.x + r0.width / 2, r0.y + r0.height / 2);
      await page.mouse.down(); await page.mouse.move(r0.x + r0.width / 2 - 300, r0.y + r0.height / 2 + 120, { steps: 10 }); await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const r1 = await q(page, "den-home-card").boundingBox().catch(() => null);
    check("...a drag moves it, and it stays", !!r0 && !!r1 && r1.x < r0.x - 200 && r1.y > r0.y + 80, JSON.stringify({ r0, r1 }));
  }
  await q(page, "den-home-card").click();
  check("...a tap puts it away", !!(await poll(async () => !(await has(page, "den-home-card")), 3000)));
  check("...still owned", (await owned(page) || {}).owned === true);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));

  // A reload opens at home.
  await page.reload();
  await poll(() => place(page), 30000);
  check("a reload opens at home", (await place(page)) === "home");

  // The fresh start.
  check("the dock's panel opens", await openDockPanel(page));
  await q(page, "story-restart").click();
  check("Restart story asks first", await poll(() => has(page, "restart-confirm"), 4000));
  await q(page, "restart-confirm-cancel").click();
  check("...Keep playing leaves it be (still home)", !(await has(page, "restart-confirm")) && (await place(page)) === "home");
  check("the dock's panel opens", await openDockPanel(page));
  await q(page, "story-restart").click();
  await q(page, "restart-confirm-yes").click();
  const fresh = await throughCut(page, "store");
  check("Start the story over: the store", fresh.gone && fresh.there, JSON.stringify(fresh));
  check("...with the lid back on the box", await poll(() => has(page, "tienda-lid"), 10000));
  check("...and nothing owned", (await owned(page)) === null);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- the den's television: into Singularity and back ---------------- */
console.log("\ndesktop: the den's television, into Singularity and back");
{
  const { ctx, page, errs } = await open({ storage: "owned" });
  const tv = () => page.evaluate(() => window.__DEN_TV__ && window.__DEN_TV__());
  check("bought: the visit opens at home", (await place(page)) === "home");
  check("the set is off", ((await poll(tv, 10000)) || {}).phase === "off");
  // Face the set (it's behind the usual view), and tap it.
  await page.evaluate(() => window.__EC_TEST_CAM__({ theta: Math.PI, phi: 1.2, radius: 24, target: [35, 12, -52] }));
  await page.waitForTimeout(3000);
  const at = await page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let hit = null;
    t.scene.traverse((o) => { if (o.userData && o.userData.tv === "set") hit = o; });
    if (!hit) return null;
    hit.geometry.computeBoundingBox();
    const v = t.camera.position.clone();
    hit.geometry.boundingBox.getCenter(v);
    v.applyMatrix4(hit.matrixWorld).project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, onScreen: Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 };
  });
  check("the set is in view", !!at && at.onScreen, JSON.stringify(at));
  // The first time, a tap takes the camera over to watch it (den-fx.js
  // lure); the next turns it on.
  if (at) await page.mouse.click(at.x, at.y);
  check("a tap on the set: the camera goes over to it", !!(await poll(async () => { const s = await tv(); return s && s.looking && s.focus > 0.95; }, 8000, 100)));
  check("...still off", ((await tv()) || {}).phase === "off");
  await page.waitForTimeout(400);
  { const c = await page.locator("canvas").first().boundingBox(); await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2); }
  check("another tap turns it on", !!(await poll(async () => { const s = await tv(); return s && s.phase !== "off"; }, 5000, 100)));
  check("...snow, then the test pattern", !!(await poll(async () => ["pattern", "dive"].includes(((await tv()) || {}).phase), 12000, 100)));
  check("...and the picture pulls the camera in", !!(await poll(async () => ((await tv()) || {}).dive > 0.3, 10000, 100)));
  check("into Singularity (Neon)", !!(await poll(async () => (await place(page)) === "neon", 30000)));
  // Back out: the title hold and DISCONNECT.
  await page.waitForTimeout(1500);
  const box = await page.locator(".ec-title").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(4600);
  await page.mouse.up();
  await poll(async () => (await page.locator(".ec-hold-modal-word").count()) > 0, 5000);
  await page.locator(".ec-hold-modal-word").click({ force: true });
  check("back in the den", !!(await poll(async () => (await place(page)) === "home", 30000)));
  const back = await poll(async () => { const s = await tv(); return s && (s.phase === "pattern" || s.phase === "closing") ? s : null; }, 8000, 100);
  check("...with the set on and the camera at it", !!back && back.focus > 0.5, JSON.stringify(back));
  check("...then the set switches off", !!(await poll(async () => ((await tv()) || {}).phase === "off", 12000, 100)));
  check("...and the camera goes back to the board", !!(await poll(async () => ((await tv()) || {}).focus < 0.05, 10000, 100)));
  await page.waitForTimeout(1500);
  {
    // Re-centred on the coffee table (user: always, not too close, not too far): the board's centre, its own distance, out of the Room view, the board's middle near the screen's.
    const v = await page.evaluate(() => {
      const c = window.__EC_TEST_CAM__(), t = window.__DEN_THREE__ || window.__EC_TEST_THREE__(), bv = t.boardView ? t.boardView() : null;
      const p = t.boardGroup.position.clone(); t.boardGroup.getWorldPosition(p); p.project(t.camera);
      return { c, bv, sx: p.x, sy: p.y };
    });
    check(`...re-centred on the coffee table (${JSON.stringify(v)})`, !!v.bv && !v.c.dollhouse && Math.hypot(...v.c.target) < 0.5 && Math.abs(v.c.radius - v.bv.radius) < 0.5 && Math.abs(v.sx) < 0.25 && Math.abs(v.sy) < 0.4);
  }
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- phone, control bar: the same choices ---------------- */
console.log("\nphone with the control bar: the store and home");
{
  const { ctx, page, errs } = await open({ phone: true, bar: true });
  check("the phone opens in the store", (await place(page)) === "store");
  if (await has(page, "tienda-open-box")) await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => !(await has(page, "tienda-lid")), 10000);
  check("the bar's setup has See the pieces and the purchase", await poll(async () => (await has(page, "shell-see-pieces")) && (await has(page, "shell-purchase")), 10000));
  await q(page, "shell-menu-button").tap().catch(() => {});
  const menuHas = await poll(() => has(page, "shell-menu-purchase"), 8000);
  check("...and the menu has Purchase and bring home", !!menuHas);
  check("...and no switch to Neon in the store", !(await has(page, "shell-menu-switch-theme")));
  await q(page, "shell-menu-purchase").tap();
  const went = await throughCut(page, "home");
  check("buying from the menu takes it home", went.gone && went.there, JSON.stringify(went));
  check("home's bar has See the pieces (before the Singularity)", await poll(() => has(page, "shell-see-pieces"), 10000) && !(await has(page, "shell-custom-rules")));
  await q(page, "shell-menu-button").tap().catch(() => {});
  check("...and its menu the way back, the fresh start and Neon", await poll(async () => (await has(page, "shell-menu-back-to-store")) && (await has(page, "shell-menu-restart")) && (await has(page, "shell-menu-switch-theme")), 8000));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nSTORY E2E PASSED" : `\nSTORY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
