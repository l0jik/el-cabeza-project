/* The check alert (user: "if the player is playing against AI, and if it
   is basically in check, meaning if on the next turn they don't move their
   cabeza, they will lose the game ... a toggle switch ... in the in-game
   menu ... and for game setup as well"; their own case: "I thought the
   Hombro could not land on the cabeza, but it could").

   Against the computer, on your turn, while one of its pieces could crush
   your Cabeza on its next turn (the user's pick of five designs: 2, 3 and
   5): a card across the top naming the piece and saying what to do, with
   Show me and its own switch; on the board, a ghost of the piece where it
   would land and the arc it takes, and every square your Cabeza can get to
   this turn, green if safe, red if not. It comes and goes with the
   position. Its switch is in the setup, in the in-game menu (the dock's
   panel; the phone bar's menu) and on the card. Never in a game between
   two people.

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
  const out = { ghost: 0, arc: 0, green: 0, red: 0 };
  window.__EC_TEST_THREE__().checkGroup.children.forEach((c) => {
    const k = c.userData.kind;
    if (k === "check-ghost" && c.visible) out.ghost++;
    else if (k === "check-arc" && c.visible) out.arc++;
    else if (k === "check-square") out[c.userData.safe ? "green" : "red"]++;
  });
  return out;
});
const stored = (page) => page.evaluate(() => localStorage.getItem("el-cabeza:check-alert"));

// The computer plays light; you're dark, to move.
const T = (id, owner, row, col) => ({ id, type: "turrito", owner, row, col, w: 1, h: 1, z: 1 });
const CAB = (id, owner, row, col) => ({ id, type: "cabeza", owner, row, col, w: 1, h: 1, z: 1 });
// A light Turrito two rolls from your Cabeza (and nothing else near).
const TWO_ROLLS = [T("light-turrito", "light", 4, 4), CAB("dark-cabeza", "dark", 4, 6), T("dark-turrito", "dark", 8, 1), CAB("light-cabeza", "light", 1, 8)];
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
  check(`...on the board: its landing's ghost and the arc to it (${JSON.stringify(k1)}; its line ${JSON.stringify(view1.lines)})`, k1.ghost === 1 && k1.arc === 1 && view1.lines.length === 1 && view1.lines[0].steps.length === 2);
  const safeN = view1.escapes.filter((e) => e.safe).length;
  check(`...and your Cabeza's squares this turn, green or red (${view1.escapes.length}: ${safeN} safe)`, k1.green === safeN && k1.red === view1.escapes.length - safeN + 1 && safeN > 0);
  // Show me: its two rolls played as a ghost onto the Cabeza (slowed
  // down for this slow renderer), the still ghost and arc aside meanwhile.
  await page.evaluate(() => { window.__EC_TEST_SHOW_SLOW__ = 4; });
  await page.locator('[data-testid="check-alert-show"]').click();
  const playing = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && s.playing ? s : null; }, 3000, 80);
  const kp = await kinds(page);
  check(`Show me plays its line (${JSON.stringify(playing)}), the still marks aside`, !!playing && playing.steps === 2 && kp.ghost === 0 && kp.arc === 0);
  const twoSteps = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && s.step === 2 ? s : null; }, 12000, 100);
  check("...both rolls, one after the other", !!twoSteps);
  const done = await poll(async () => { const s = await page.evaluate(() => window.__EC_TEST_CHECK_SHOW__()); return s && !s.playing ? s : null; }, 20000, 200);
  const kd = await kinds(page);
  check(`...then it's done, the still marks back (${JSON.stringify(kd)})`, !!done && kd.ghost === 1 && kd.arc === 1);
  await page.evaluate(() => { window.__EC_TEST_SHOW_SLOW__ = 1; });
  const box = await card(page).boundingBox();
  check(`the card's across the top, in the middle (${JSON.stringify(box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) })})`, !!box && box.y < 40 && Math.abs(box.x + box.width / 2 - 640) < 4);

  // A step north takes it out of reach: the warning goes.
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "N"));
  check("your Cabeza steps out of reach: the warning goes", !!(await poll(async () => (await card(page).count()) === 0 && !(await reading(page)))));
  check("...and the marks with it", (await marks(page)) === 0);

  // The user's video: the Hombro can come down on it past nothing...
  await setPieces(page, VIDEO(false));
  const text2 = await poll(async () => (await card(page).count()) && (await page.locator('[data-testid="check-alert-text"]').textContent()));
  check(`the video's position: "${text2}"`, /The Hombro can tumble onto your Cabeza/.test(text2 || ""));
  // ...but not through a Turrito of yours between.
  await setPieces(page, VIDEO(true));
  check("...with your Turrito between them: no warning", !!(await poll(async () => (await card(page).count()) === 0)));

  // Off from the card itself: gone, and a note says where it is kept.
  await setPieces(page, VIDEO(false));
  await poll(async () => (await card(page).count()) === 1);
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
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nThe den on a phone, the bar layout: the setup's field and the menu's switch");
{
  const seed = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1", "el-cabeza:nova-layout": "bar" };
  const { ctx, page, errs } = await open(`${D}/el-cabeza-nova.html`, { phone: true, seed });
  check("no Check alert field while the opponent's a person", (await page.locator('[data-testid="shell-check-alert"]').count()) === 0);
  await page.locator('[data-testid="shell-opponent"] button[data-value="true"]').click();
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
