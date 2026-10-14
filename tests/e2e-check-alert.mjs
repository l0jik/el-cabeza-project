/* The check alert (user: "if the player is playing against AI, and if it
   is basically in check, meaning if on the next turn they don't move their
   cabeza, they will lose the game ... a toggle switch ... in the in-game
   menu ... and for game setup as well"; their own case: "I thought the
   Hombro could not land on the cabeza, but it could").

   Against the computer, on your turn, while one of its pieces could crush
   your Cabeza on its next turn (the user's pick of five designs: 2, 3 and
   5): a card across the top naming the piece and saying what to do, with
   Show me and its own switch; on the board, a ghost of the piece where it
   would land and the arc it takes (an attack of two moves: a fainter ghost
   at its stop on the way, and a hop for each move; every ghost outlined),
   and every square your Cabeza can get to this turn, green if safe, red if
   not. It comes and goes with the
   position. Its switch is in the setup, in the in-game menu (the dock's
   panel; the phone bar's menu) and on the card. Never in a game between
   two people. Your own last move into reach (user: "Check Alert was
   turned on, but it didn't trigger though it should've"): the turn waits,
   the card up and staying up, till you take it back or end it; with the
   alert off it goes over as ever.

   node tests/e2e-check-alert.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });

async function open(url, { phone = false, seed = {} } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000, 250);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  return { ctx, page, errs };
}
const armed = (page) => poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 10000, 250);
const setPieces = async (page, list) => { await page.evaluate((l) => window.__EC_TEST_SET_PIECES__(l), list); await page.waitForTimeout(600); };
const reading = (page) => page.evaluate(() => window.__EC_TEST_CHECK__ && window.__EC_TEST_CHECK__());
const card = (page) => page.locator('[data-testid="check-alert"]');
const marks = (page) => page.evaluate(() => window.__EC_TEST_THREE__().checkGroup.children.length);
const kinds = (page) => page.evaluate(() => {
  const out = { ghost: 0, stop: 0, arc: 0, green: 0, red: 0, outlined: 0, stops: [] };
  window.__EC_TEST_THREE__().checkGroup.children.forEach((c) => {
    const k = c.userData.kind;
    // (An outline: a line child with edges in it.)
    if ((k === "check-ghost" || k === "check-stop") && c.children.some((l) => l.isLineSegments && l.geometry.attributes.position.count >= 24)) out.outlined++;
    if (k === "check-ghost" && c.visible) out.ghost++;
    else if (k === "check-stop" && c.visible) { out.stop++; out.stops.push([c.userData.row, c.userData.col, c.material.opacity]); }
    else if (k === "check-arc" && c.visible) out.arc++;
    else if (k === "check-square") out[c.userData.safe ? "green" : "red"]++;
  });
  return out;
});
const stored = (page) => page.evaluate(() => localStorage.getItem("el-cabeza:check-alert"));
// The camera: where it's going, and where the eased view has got to.
const camOf = (page) => page.evaluate(() => window.__EC_TEST_CAM__());
const showOf = (page) => page.evaluate(() => window.__EC_TEST_CHECK_SHOW__());
const wrapA = (d) => ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
const sameCam = (a, b) => Math.abs(wrapA(a.theta - b.theta)) < 1e-6 && Math.abs(a.phi - b.phi) < 1e-6 && Math.abs(a.radius - b.radius) < 1e-6 && a.target.every((x, i) => Math.abs(x - b.target[i]) < 1e-6);
const arrived = (c) => Math.abs(wrapA(c.view.theta - c.theta)) < 0.01 && Math.abs(c.view.phi - c.phi) < 0.01 && Math.abs(c.view.radius - c.radius) < 0.05;
const camText = (c) => c && `theta ${c.theta.toFixed(2)}, phi ${c.phi.toFixed(2)}, radius ${c.radius.toFixed(1)}`;
// Two pieces on the screen, the card's foot and the phone's bar's top: the attack across the screen, in view under
// the card.
const across = (page, a, b) => page.evaluate(([a, b]) => {
  const p = window.__EC_TEST_SCREEN_POS__(a), q = window.__EC_TEST_SCREEN_POS__(b);
  const card = document.querySelector('[data-testid="check-alert"]'), bar = document.querySelector('[data-testid="shell-bar"]');
  return { p, q, under: card ? Math.round(card.getBoundingClientRect().bottom) : 0, over: bar ? Math.round(bar.getBoundingClientRect().top) : innerHeight, w: innerWidth };
}, [a, b]);
const acrossOk = (s) => !!s.p && !!s.q && Math.abs(s.q.y - s.p.y) < 0.35 * Math.abs(s.q.x - s.p.x)
  && [s.p, s.q].every((o) => o.x > 0 && o.x < s.w && o.y > s.under && o.y < s.over);
// The show's ghost waits on the piece until the camera's there.
const camThere = (page) => poll(async () => { const s = await showOf(page); return s && !s.waiting ? s : null; }, 6000, 40);

// The computer plays light; you're dark, to move.
const T = (id, owner, row, col) => ({ id, type: "turrito", owner, row, col, w: 1, h: 1, z: 1 });
const CAB = (id, owner, row, col) => ({ id, type: "cabeza", owner, row, col, w: 1, h: 1, z: 1 });
// A light Turrito two rolls from your Cabeza (and nothing else near).
const TWO_ROLLS = [T("light-turrito", "light", 4, 4), CAB("dark-cabeza", "dark", 4, 6), T("dark-turrito", "dark", 8, 1), CAB("light-cabeza", "light", 1, 8)];
// Two rolls up the board instead, a Flaco of yours standing two columns off its middle: Show me turns the board to
// see it across the screen, from the side the Flaco isn't in front of.
const ALONG = [T("light-turrito", "light", 2, 6), CAB("dark-cabeza", "dark", 4, 6), T("dark-turrito", "dark", 8, 1), CAB("light-cabeza", "light", 1, 8),
  { id: "dark-flaco", type: "flaco", owner: "dark", row: 3, col: 4, w: 1, h: 1, z: 2 }];
// The user's video, mid-board: the light Hombro lying over your Flaco,
// your Cabeza two squares on (and, optionally, a Turrito of yours between).
const VIDEO = (turrito) => [
  { id: "light-hombro", type: "hombro", owner: "light", row: 4, col: 3, w: 2, h: 2, z: 2, vox: "0,0,0;0,0,1;0,1,1;1,0,1" },
  { id: "dark-flaco", type: "flaco", owner: "dark", row: 4, col: 4, w: 1, h: 2, z: 1 },
  CAB("dark-cabeza", "dark", 4, 6),
  ...(turrito ? [T("dark-turrito", "dark", 4, 5)] : [T("dark-turrito", "dark", 8, 1)]),
  CAB("light-cabeza", "light", 1, 8), T("light-turrito", "light", 1, 2),
];

console.log("Neon, desktop: the setup's switch, the warning, its own switch, the dock's");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-neon.html`);
  await openDockPanel(page);
  check("no Check alert switch while the opponent's a person", (await page.locator('[data-testid="check-alert-setup"]').count()) === 0);
  await page.locator('[data-opponent="ai-light"]').first().click();
  await page.waitForTimeout(500);
  const sw = page.locator('[data-testid="check-alert-setup"]');
  check("against the computer, the setup has it, on from the start", (await sw.count()) === 1 && (await sw.getAttribute("aria-checked")) === "true");
  await sw.click();
  check("...switched off there (remembered)", (await sw.getAttribute("aria-checked")) === "false" && (await stored(page)) === "0");
  await sw.click();
  check("...and on again", (await sw.getAttribute("aria-checked")) === "true" && (await stored(page)) === "1");
  await page.locator('[data-dock-role="begin"]').first().click();
  check("a game against the computer begun, yours to move", !!(await armed(page)) && (await page.locator('[data-testid="turn-status"]').first().getAttribute("data-side")) === "dark");
  await page.waitForTimeout(1500);

  await setPieces(page, TWO_ROLLS);
  const r1 = await poll(() => reading(page));
  check(`a Turrito two rolls from your Cabeza: check (${JSON.stringify(r1)})`, !!r1 && r1.length === 1 && r1[0].attacker === "light-turrito");
  const text1 = await poll(async () => (await card(page).count()) && (await page.locator('[data-testid="check-alert-text"]').textContent()));
  check(`...the card names it (${JSON.stringify(text1)})`, /The Turrito can tumble onto your Cabeza on the computer's next turn/.test(text1 || ""));
  check("...and says what to do", /Move your Cabeza to a green square, or block its way/.test(await page.locator('[data-testid="check-alert-advice"]').textContent()));
  const view1 = await page.evaluate(() => window.__EC_TEST_CHECK_VIEW__());
  const k1 = await kinds(page);
  check(`...on the board: its landing's ghost, its stop's, a hop for each roll (${JSON.stringify(k1)}; its line ${JSON.stringify(view1.lines)})`, k1.ghost === 1 && k1.stop === 1 && k1.arc === 2 && view1.lines.length === 1 && view1.lines[0].steps.length === 2);
  check("...the stop where its first roll ends, between the two, fainter than the landing", k1.stops.length === 1 && k1.stops[0][0] === 4 && k1.stops[0][1] === 5 && k1.stops[0][2] < 0.34);
  check(`...both ghosts outlined (${k1.outlined})`, k1.outlined === 2);
  const safeN = view1.escapes.filter((e) => e.safe).length;
  check(`...and your Cabeza's squares this turn, green or red (${view1.escapes.length}: ${safeN} safe)`, k1.green === safeN && k1.red === view1.escapes.length - safeN + 1 && safeN > 0);
  // Show me: its two rolls played as a ghost onto the Cabeza (slowed
  // down for this slow renderer), the still ghost and arc aside meanwhile;
  // the camera brought round to watch first (user: "When check alerts pop up & Show Me is selected, move the camera
  // to observe the animation, & when dismissed, return camera to original attitude").
  const camA = await camOf(page);
  await page.evaluate(() => { window.__EC_TEST_SHOW_SLOW__ = 4; });
  await page.locator('[data-testid="check-alert-show"]').click();
  const playing = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && s.playing ? s : null; }, 3000, 80);
  const kp = await kinds(page);
  check(`Show me plays its line (${JSON.stringify(playing)}), the still marks aside`, !!playing && playing.steps === 2 && kp.ghost === 0 && kp.stop === 0 && kp.arc === 0);
  check("...its ghost waiting on the piece while the camera comes round", !!playing && playing.waiting === true && playing.step === 0);
  const there = await camThere(page);
  const camS = await camOf(page);
  check(`...then playing, the camera there (${camText(camA)} -> ${camText(camS)})`, !!there && there.step <= 1 && !sameCam(camS, camA) && arrived(camS), JSON.stringify(camS));
  const sc = await across(page, "light-turrito", "dark-cabeza");
  check(`...the attack across the screen, in view under the card (${JSON.stringify(sc)})`, acrossOk(sc));
  const twoSteps = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && s.step === 2 ? s : null; }, 12000, 100);
  check("...both rolls, one after the other", !!twoSteps);
  const done = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && !s.playing ? s : null; }, 20000, 200);
  const kd = await kinds(page);
  check(`...then it's done, the still marks back (${JSON.stringify(kd)})`, !!done && kd.ghost === 1 && kd.stop === 1 && kd.arc === 2);
  await page.evaluate(() => { window.__EC_TEST_SHOW_SLOW__ = 1; });
  const box = await card(page).boundingBox();
  check(`the card's across the top, in the middle (${JSON.stringify(box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) })})`, !!box && box.y < 40 && Math.abs(box.x + box.width / 2 - 640) < 4);

  // Put away with a tap elsewhere (user: "tap outside of it or swipe it away to dismiss it ... You shouldn't have to
  // simply turn it off"): the card and its marks go for this turn, the alert stays on, the threat still read.
  await page.mouse.click(60, 400);
  check("a tap elsewhere puts the card away", !!(await poll(async () => (await card(page).count()) === 0)));
  check("...its marks with it", (await marks(page)) === 0);
  check("...the alert still on, the threat still there", (await stored(page)) === "1" && !!(await reading(page)));
  const back = await poll(async () => { const c = await camOf(page); return sameCam(c, camA) ? c : null; }, 3000, 50);
  check(`...and the camera goes back where it was (${camText(camA)})`, !!back, JSON.stringify(await camOf(page)));
  check("...all the way", !!(await poll(async () => arrived(await camOf(page)), 4000, 100)));
  await page.waitForTimeout(800);
  check("...and it stays away while the threat's the same", (await card(page).count()) === 0);
  // ...but can be called back (user: "if a check alert is dismissed, but the user decides they want to view again
  // before making their turn there needs to be a way to call it back"): a chip where the card was brings it back,
  // marks and all; put away again, the chip again.
  const recall = () => page.locator('[data-testid="check-alert-recall"]');
  const rb = await recall().boundingBox().catch(() => null);
  check(`...a chip where it was, to call it back (${JSON.stringify(rb && { x: Math.round(rb.x + rb.width / 2), y: Math.round(rb.y) })})`, !!rb && rb.y < 40 && Math.abs(rb.x + rb.width / 2 - 640) < 4);
  await recall().click();
  check("...a tap on it: the card back", !!(await poll(async () => (await card(page).count()) === 1)));
  check("...its marks with it", !!(await poll(async () => (await marks(page)) > 0)));
  check("...and no chip while it's up", (await recall().count()) === 0);
  await page.mouse.click(60, 400);
  check("...put away again: the chip again", !!(await poll(async () => (await card(page).count()) === 0 && (await recall().count()) === 1)));
  // A step north takes it out of reach: the warning goes.
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "N"));
  check("your Cabeza steps out of reach: the warning goes", !!(await poll(async () => (await card(page).count()) === 0 && !(await reading(page)))));
  check("...and the marks with it", (await marks(page)) === 0);
  check("...and the chip", (await recall().count()) === 0);

  // The user's video: the Hombro can come down on it past nothing...
  await setPieces(page, VIDEO(false));
  const text2 = await poll(async () => (await card(page).count()) && (await page.locator('[data-testid="check-alert-text"]').textContent()));
  check(`the video's position: "${text2}"`, /The Hombro can tumble onto your Cabeza/.test(text2 || ""));
  const k2 = await kinds(page);
  check(`...one roll: its landing's ghost and one arc, no stop (${JSON.stringify(k2)})`, k2.ghost === 1 && k2.stop === 0 && k2.arc === 1 && k2.outlined === 1);
  // Swiped away: it follows the finger and goes; still on.
  {
    const b0 = await card(page).boundingBox();
    const sx = b0.x + b0.width * 0.3, sy = b0.y + 18;
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(sx + i * 24, sy + 2); await page.waitForTimeout(16); }
    const mid = await card(page).boundingBox().catch(() => null);
    await page.mouse.up();
    check(`a swipe on the card carries it along (${mid && Math.round(mid.x - b0.x)}px)`, !!mid && mid.x - b0.x > 100);
    check("...and sends it away", !!(await poll(async () => (await card(page).count()) === 0)));
    check("...the alert still on", (await stored(page)) === "1" && !!(await reading(page)) && (await marks(page)) === 0);
  }
  // ...but not through a Turrito of yours between.
  await setPieces(page, VIDEO(true));
  check("...with your Turrito between them: no warning", !!(await poll(async () => (await card(page).count()) === 0)));

  // Off from the card itself: gone, and a note says where it is kept. (The threat gone and back again: news again,
  // the card back though it was swiped away before.)
  await setPieces(page, VIDEO(false));
  check("the same threat back after it had gone: the card again", !!(await poll(async () => (await card(page).count()) === 1)));
  await page.locator('[data-testid="check-alert-off"]').click();
  check("the card's own switch turns it off", !!(await poll(async () => (await card(page).count()) === 0)) && (await stored(page)) === "0" && !(await reading(page)));
  check("...saying where to turn it back on", /Turn it back on in the menu/.test((await page.locator('[data-testid="check-alert-note"]').textContent().catch(() => "")) || ""));
  check("...the marks gone too", (await marks(page)) === 0);
  // The dock's panel in play has it, off; on again, the warning's back.
  await openDockPanel(page);
  const dockSw = page.locator('[data-testid="check-alert-switch"]');
  check("the dock's panel in play has the switch, off", (await dockSw.count()) === 1 && (await dockSw.getAttribute("aria-checked")) === "false");
  await dockSw.click();
  check("...on again there: the warning's back", !!(await poll(async () => (await card(page).count()) === 1)) && (await stored(page)) === "1");

  // Show me up the board: the board turned so the attack runs across the screen, seen from the side the tall
  // Flaco isn't in front of; put away, turned back.
  await setPieces(page, ALONG);
  check("a Turrito two rolls up the board: the card", !!(await poll(async () => (await card(page).count()) === 1 && /Turrito/.test(await page.locator('[data-testid="check-alert-text"]').textContent()))));
  const camB = await camOf(page);
  await page.locator('[data-testid="check-alert-show"]').click();
  await camThere(page);
  const camU = await camOf(page);
  const su = await across(page, "light-turrito", "dark-cabeza");
  check(`...the board turned a quarter (${camText(camB)} -> ${camText(camU)}), the attack across the screen (${JSON.stringify(su)})`,
    Math.abs(Math.abs(wrapA(camU.theta - camB.theta)) - Math.PI / 2) < 0.01 && acrossOk(su));
  const depth = await page.evaluate(() => {
    const g = window.__EC_TEST_THREE__().pieceGroup;
    const z = (id) => { const m = g.children.find((c) => c.userData.pieceId === id && c.userData.kind === "piece"); return m.getWorldPosition(m.position.clone()).z; };
    return { flaco: z("dark-flaco"), turrito: z("light-turrito"), cabeza: z("dark-cabeza") };
  });
  check(`...from the side the Flaco isn't in front of (nearer the camera: larger z; ${JSON.stringify(depth)})`, depth.flaco < Math.min(depth.turrito, depth.cabeza) - 1);
  await page.mouse.click(60, 600);
  check("...put away", !!(await poll(async () => (await card(page).count()) === 0)));
  check(`...the board turned back (${camText(camB)})`, !!(await poll(async () => sameCam(await camOf(page), camB), 3000, 50)), JSON.stringify(await camOf(page)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nThe den on a phone, the bar layout: the setup's field and the menu's switch");
{
  const seed = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1", "el-cabeza:nova-layout": "bar" };
  const { ctx, page, errs } = await open(`${D}/el-cabeza-nova.html`, { phone: true, seed });
  check("no Check alert field while the opponent's a person", (await page.locator('[data-testid="shell-check-alert"]').count()) === 0);
  await page.locator('[data-testid="shell-opponent"] button[data-value="ai"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="shell-ai-side"] button[data-value="light"]').click();
  await page.waitForTimeout(300);
  const field = page.locator('[data-testid="shell-check-alert"]');
  check("against the computer, the setup has it, On", (await field.count()) === 1 && (await field.locator('button[data-value="true"]').getAttribute("aria-pressed")) === "true");
  await field.locator('button[data-value="false"]').click();
  check("...Off there (remembered)", (await field.locator('button[data-value="false"]').getAttribute("aria-pressed")) === "true" && (await stored(page)) === "0");
  await field.locator('button[data-value="true"]').click();
  check("...and On again", (await stored(page)) === "1");
  await page.locator('[data-testid="shell-begin"]').click();
  check("a game against the computer begun", !!(await armed(page)));
  await page.waitForTimeout(1500);
  await setPieces(page, VIDEO(false));
  check("the video's position: the warning", !!(await poll(async () => (await card(page).count()) === 1)));
  const b = await card(page).boundingBox();
  const bar = await page.locator('[data-testid="shell-menu-button"]').boundingBox();
  check(`...under the top bar, inside the screen (${JSON.stringify(b && { y: Math.round(b.y), x: Math.round(b.x), w: Math.round(b.width) })})`, !!b && !!bar && b.y >= bar.y + bar.height && b.x >= 15 && b.x + b.width <= 412 - 15);
  // Show me on the phone: the attack across the screen, between the card and the bar; put away, the camera back.
  const camP = await camOf(page);
  await page.locator('[data-testid="check-alert-show"]').click();
  check("Show me: the camera comes round first", !!(await camThere(page)) && arrived(await camOf(page)) && !sameCam(await camOf(page), camP));
  const sp = await across(page, "light-hombro", "dark-cabeza");
  check(`...the attack across the screen, between the card and the bar (${JSON.stringify(sp)})`, acrossOk(sp));
  await page.touchscreen.tap(30, 640);
  check("...a tap elsewhere puts the card away", !!(await poll(async () => (await card(page).count()) === 0)));
  check(`...and the camera goes back where it was (${camText(camP)})`, !!(await poll(async () => sameCam(await camOf(page), camP), 3000, 50)), JSON.stringify(await camOf(page)));
  // (The danger past and back again: the card again.)
  const again = async () => { await setPieces(page, VIDEO(true)); await setPieces(page, VIDEO(false)); return !!(await poll(async () => (await card(page).count()) === 1)); };
  check("...the threat gone and back: the card again", await again());
  // A view chosen while Show me has the camera (the bar's view button: the same tap puts the card away) is kept,
  // not undone.
  await page.locator('[data-testid="check-alert-show"]').click();
  await camThere(page);
  await page.locator('[data-testid="shell-view-toggle"]').click();
  check("Show me, then the bar's view button: the card put away by the same tap", !!(await poll(async () => (await card(page).count()) === 0)));
  await page.waitForTimeout(1200);
  const camV = await camOf(page), pv = await page.evaluate(() => window.__EC_TEST_THREE__().boardView());
  check(`...and the view it chose kept, the player's (${camText(camV)})`, Math.abs(wrapA(camV.theta - Math.PI)) < 1e-6 && Math.abs(camV.phi - pv.phi) < 1e-6 && Math.abs(camV.radius - pv.radius) < 1e-6
    && camV.target.every((x) => Math.abs(x) < 1e-6) && !(await page.evaluate(() => window.__EC_TEST_CHECK_CAM__())), JSON.stringify({ camV, pv }));
  check("...the card again, for the menu's switch", await again());
  await page.locator('[data-testid="shell-menu-button"]').click();
  await page.waitForTimeout(600);
  const menuSw = page.locator('[data-testid="shell-menu-check"]');
  check("the menu has the switch, on", (await menuSw.count()) === 1 && (await menuSw.getAttribute("aria-checked")) === "true");
  await menuSw.click();
  check("...off there", (await menuSw.getAttribute("aria-checked")) === "false" && (await stored(page)) === "0");
  await page.locator('[data-testid="shell-menu-close"]').click();
  await page.waitForTimeout(500);
  check("...and the warning's gone", (await card(page).count()) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nYour own last move into reach: the turn waits");
{
  // Your Cabeza two steps from a light Turrito's reach: its first step is
  // safe, its second (the turn's last action) walks into reach.
  const WALK = [T("light-turrito", "light", 4, 4), CAB("dark-cabeza", "dark", 4, 8), T("dark-turrito", "dark", 8, 1), CAB("light-cabeza", "light", 1, 8)];
  const held = (page) => page.evaluate(() => !!(window.__EC_TEST_CHECK_HOLD__ && window.__EC_TEST_CHECK_HOLD__()));
  const side = (page) => page.locator('[data-testid="turn-status"]').first().getAttribute("data-side");
  const cabAt = (page) => page.evaluate(() => { const c = window.__EC_TEST_PIECES__.find((p) => p.id === "dark-cabeza"); return c ? `${c.row},${c.col}` : null; });
  const step = async (page, to) => { await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "W")); return !!(await poll(async () => (await cabAt(page)) === to, 8000)); };
  async function game(alertOn) {
    const { ctx, page, errs } = await open(`${D}/el-cabeza-neon.html`, { seed: alertOn ? {} : { "el-cabeza:check-alert": "0" } });
    await openDockPanel(page);
    await page.locator('[data-opponent="ai-light"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('[data-dock-role="begin"]').first().click();
    await armed(page);
    await page.waitForTimeout(1500);
    await setPieces(page, WALK);
    return { ctx, page, errs };
  }
  const { ctx, page, errs } = await game(true);
  check("your Cabeza out of reach: no warning", !(await reading(page)) && (await card(page).count()) === 0);
  check("...a first step, still out of reach: none, and your turn goes on", (await step(page, "4,7")) && !(await reading(page)) && (await side(page)) === "dark");
  check("the last step, into reach: the turn waits", (await step(page, "4,6")) && !!(await poll(() => held(page), 4000)) && (await side(page)) === "dark");
  check("...the card up, held", !!(await poll(async () => (await card(page).count()) === 1 && (await card(page).getAttribute("data-held")) === "true", 4000)));
  check("...saying the turn waits", /Your turn waits/.test(await page.locator('[data-testid="check-alert-advice"]').textContent()));
  await page.mouse.click(60, 400);
  await page.waitForTimeout(700);
  check("...a tap elsewhere doesn't put it away", (await card(page).count()) === 1 && (await held(page)));
  await page.locator('[data-testid="check-alert-take-back"]').click();
  check("Take it back: the turn rewinds, your Cabeza home, still your turn", !!(await poll(async () => (await cabAt(page)) === "4,8" && !(await held(page)), 10000)) && (await side(page)) === "dark");
  check("...and no warning there", !!(await poll(async () => (await card(page).count()) === 0, 3000)));
  check("the same two steps again: held again", (await step(page, "4,7")) && (await step(page, "4,6")) && !!(await poll(() => held(page), 4000)));
  await page.locator('[data-testid="check-alert-end-turn"]').click();
  check("End turn: over to the computer (and it takes your Cabeza)", !!(await poll(async () => !(await held(page)) && ((await side(page)) === "light" || (await cabAt(page)) === null), 6000)));
  check("...the card gone", !!(await poll(async () => (await card(page).count()) === 0, 4000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
  {
    const { ctx, page, errs } = await game(false);
    check("with the alert off: the last step into reach goes over as ever", (await step(page, "4,7")) && (await step(page, "4,6")) && !!(await poll(async () => (await side(page)) === "light" || (await cabAt(page)) === null, 6000)) && !(await held(page)));
    check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

console.log("\nTwo people: never a warning");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-neon.html`);
  await openDockPanel(page);
  const human = page.locator('[data-opponent="human"]').first();
  if ((await human.getAttribute("aria-pressed")) !== "true") await human.click();
  await page.locator('[data-dock-role="begin"]').first().click();
  check("a game between two people begun", !!(await armed(page)));
  await page.waitForTimeout(1500);
  await setPieces(page, VIDEO(false));
  await page.waitForTimeout(800);
  check("the video's position: no warning, no marks", (await card(page).count()) === 0 && !(await reading(page)) && (await marks(page)) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nCHECK ALERT E2E FAILED (${fails})` : "\nCHECK ALERT E2E PASSED");
process.exit(fails ? 1 : 0);
