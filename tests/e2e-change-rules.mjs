/* The rules, reachable in every world (user, of the Lab: "there is no way
   to access rules other than the standard game. What is a solution here?
   Do we need to have a button in every game to allow toggling between
   standard game and Cabeza Nova rules?"; of the options, "Go with A + B").

   A: ?nova on a world's page opens its Cabeza Nova menu as it comes up,
   whatever the story; the word dropped from the address, the rest of the
   visit (this tab) keeping the rules open; Other realities still the
   story's; Nova's own places, the story's, not taking it.
   B: Change rules, where the rules can be chosen: at the foot of the
   Rules card in a game (the corner tab; the Lab's Rules line), asked
   about first ("Change the rules?": Change rules / Keep playing, a tap
   beside it or Escape keeping the game), and between games in the menus.
   It brings the two buttons back. Without the story or the link, none of
   it. Screenshots in EC_SHOTS if set.

   node tests/e2e-change-rules.mjs */
import { chromium } from "playwright";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const SHOTS = process.env.EC_SHOTS || null;
const DIST = "file:///home/user/el-cabeza-project/dist/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

// story: "none" (a new player's, nothing kept), "ended" (played through).
async function open(page, { story = "none", viewport, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1366, height: 768 }, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript((story) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      Object.keys(localStorage).filter((k) => k.startsWith("el-cabeza:")).forEach((k) => localStorage.removeItem(k));
      if (story === "ended") localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true }));
    } catch (e) { /* none */ }
  }, story);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(DIST + page);
  return { p, ctx, errs };
}
const n = (p, sel) => p.locator(sel).count();
const gateOn = (p) => poll(async () => (await n(p, '[data-testid="reality-gate"]')) > 0, 30000);
const armed = (p) => p.evaluate(() => window.__EC_TEST_ARMED__ === true);
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/change-rules-${name}.png` }); };
// The Lab's Rules line, its list shown.
async function labRules(p) {
  if (await n(p, '[data-testid="lab-rules-change"]')) return true;
  await p.locator('[data-testid="lab-hud-rules"]').click();
  return !!(await poll(async () => (await n(p, '[data-testid="lab-rules-change"]')) > 0, 3000));
}
// The corner Rules card, open: a mouse's one click; a finger's two taps
// (the first raises the tab, the second opens it), close together as a
// hand's are. A finger where the tab is, as e2e-corner-menu.mjs taps it
// (no waiting on Playwright's own checks); and no round trips to the
// page between the two: on a heavy page (Luna on a phone, here) each one
// can take seconds, and the raise lapses after RAISE_MS (5 s).
async function cornerCard(p, touch = false) {
  const tab = p.locator('[data-testid="corner-menu-tab"]');
  await poll(async () => (await tab.count()) > 0, 8000);
  const state = () => p.evaluate(() => { const m = document.querySelector('[data-testid="corner-menu"]'); return m ? { open: !!m.querySelector('[data-testid="corner-menu-card"]'), raised: m.dataset.raised === "true" } : { open: false, raised: false }; });
  for (let i = 0; i < 3; i++) {
    const was = await state();
    if (was.open) return true;
    if (touch) {
      const b = await tab.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await p.touchscreen.tap(x, y);
      if (!was.raised) { await p.waitForTimeout(250); await p.touchscreen.tap(x, y); }
    } else await tab.click();
    await poll(async () => (await state()).open, 6000);
  }
  return (await state()).open;
}

console.log("A: the Lab by its ?nova link, the story not played");
{
  const { p, ctx, errs } = await open("el-cabeza-lab.html?theme=neoBrutalist&nova");
  check("the gate as the Lab comes up", !!(await gateOn(p)));
  check("...on Cabeza Nova's menu itself", (await p.locator('[data-testid="reality-gate"]').getAttribute("data-stage")) === "nova" && (await n(p, '[data-testid="gate-sheet"]')) === 1);
  check("...the word dropped from the address", !/nova/.test(await p.evaluate(() => window.location.search)), await p.evaluate(() => window.location.search));
  await shot(p, "lab-link");
  await p.locator('[data-testid="gate-sheet-back"]').click();
  check("its Back: the two buttons", !!(await poll(async () => (await n(p, '[data-testid="gate-standard"]')) > 0 && (await n(p, '[data-testid="gate-nova"]')) > 0, 4000)));
  check("...and no Other realities (the story's to open), on the gate or in the corner", (await n(p, '[data-testid="gate-realities"]')) === 0 && (await n(p, '[data-testid="action-corner"]')) === 0);
  await p.locator('[data-testid="gate-nova"]').click();
  await poll(async () => (await n(p, '[data-testid="gate-sheet"]')) > 0, 4000);
  const slide = p.locator('[data-testid="gate-law-slide"]');
  if ((await slide.getAttribute("aria-checked")) !== "true") await slide.click();
  await p.locator('[data-testid="gate-play"]').click();
  check("Cabeza Nova with Orthogonal slide: the game begins", !!(await poll(() => armed(p), 8000)));
  await p.waitForTimeout(1200);
  check("...its rules in the Lab's Rules line, Orthogonal slide among them", (await labRules(p)) && (await n(p, '[data-testid="lab-rules-law-slide"]')) === 1);

  console.log("B: Change rules on the Lab's Rules line, a game under way");
  check("Change rules at the Rules line's foot", (await n(p, '[data-testid="lab-rules-change"]')) === 1 && /change rules/i.test(await p.locator('[data-testid="lab-rules-change"]').innerText()));
  await p.locator('[data-testid="lab-rules-change"]').click();
  check("...asked first: Change the rules?", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000)) && /change the rules\?/i.test(await p.locator('[data-testid="change-rules-ask"]').innerText()));
  check("...the game still on while asked", await armed(p) && (await n(p, '[data-testid="reality-gate"]')) === 0);
  await shot(p, "lab-ask");
  await p.locator('[data-testid="change-rules-no"]').click();
  check("Keep playing: the question gone, the game as it was", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) === 0, 2000)) && await armed(p));
  await labRules(p);
  await p.locator('[data-testid="lab-rules-change"]').click();
  await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000);
  await p.mouse.click(30, 740);
  check("...a tap beside the card: the same", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) === 0, 2000)) && await armed(p));
  await labRules(p);
  await p.locator('[data-testid="lab-rules-change"]').click();
  await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000);
  await p.locator('[data-testid="change-rules-yes"]').click();
  check("Change rules: the two buttons back, the game put away", !!(await poll(async () => (await n(p, '[data-testid="gate-standard"]')) > 0, 5000)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-stage")) === "choose" && !(await armed(p)));
  await p.locator('[data-testid="gate-standard"]').click();
  check("...Standard Cabeza from them begins the classic game", !!(await poll(() => armed(p), 8000)));
  await p.waitForTimeout(1000);
  check("...the Rules line says so, and still offers Change rules", (await labRules(p)) && /standard/i.test(await p.locator('[data-testid="lab-hud-rules"] .sum').innerText()) && (await n(p, '[data-testid="lab-rules-change"]')) === 1);

  console.log("A: the visit keeps the link");
  await p.reload();
  check("a reload, the word gone from the address: the two buttons again", !!(await gateOn(p)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-stage")) === "choose");
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("B: Luna by the link, the Rules card in the corner");
{
  const { p, ctx, errs } = await open("el-cabeza-luna.html?nova");
  await gateOn(p);
  await p.locator('[data-testid="gate-sheet-back"]').click();
  await poll(async () => (await n(p, '[data-testid="gate-standard"]')) > 0, 4000);
  await p.locator('[data-testid="gate-standard"]').click();
  await poll(() => armed(p), 8000);
  await p.waitForTimeout(1200);
  check("the Rules card open, Change rules on it", (await cornerCard(p)) && (await n(p, '[data-testid="corner-menu-change-rules"]')) === 1);
  await shot(p, "luna-card");
  await p.locator('[data-testid="corner-menu-change-rules"]').click();
  check("...asked first, the card put away", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000)) && (await n(p, '[data-testid="corner-menu-card"]')) === 0);
  await p.keyboard.press("Escape");
  check("Escape keeps playing", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) === 0, 2000)) && await armed(p));
  await cornerCard(p);
  await p.locator('[data-testid="corner-menu-change-rules"]').click();
  await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000);
  await p.locator('[data-testid="change-rules-yes"]').click();
  check("Change rules: the two buttons, in Luna", !!(await poll(async () => (await n(p, '[data-testid="gate-standard"]')) > 0, 5000)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-world")) === "luna");
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("A: Lluvia by the link, after its descent");
{
  const { p, ctx, errs } = await open("el-cabeza-lluvia.html?nova");
  const straight = await poll(async () => (await n(p, '[data-testid="lluvia-straight-to-board"]')) > 0, 30000);
  if (straight) { await p.waitForTimeout(600); await p.locator('[data-testid="lluvia-straight-to-board"]').click(); }
  check("straight to the board: Cabeza Nova's menu, not the city's own", !!(await gateOn(p)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-stage")) === "nova");
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Without the story or the link, none of it");
{
  const { p, ctx, errs } = await open("el-cabeza-luna.html");
  await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === false), 20000);
  await p.waitForTimeout(1500);
  check("Luna comes up on the standard game alone: no gate, no Change rules", (await n(p, '[data-testid="reality-gate"]')) === 0 && (await n(p, '[data-testid="change-rules-setup"]')) === 0);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  // Nova's own places are the story's: its page doesn't take the link.
  const { p, ctx, errs } = await open("el-cabeza-nova.html?nova");
  await poll(() => p.evaluate(() => typeof window.__EC_TEST_ARMED__ === "boolean"), 30000);
  await p.waitForTimeout(2500);
  check("Nova's page with ?nova, the story not played: no gate (the story decides there)", (await n(p, '[data-testid="reality-gate"]')) === 0);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("After the story (no link): the Rules card offers it in play (between games: e2e-gate.mjs)");
{
  const { p, ctx, errs } = await open("el-cabeza-noir.html", { story: "ended" });
  await gateOn(p);
  await p.locator('[data-testid="gate-standard"]').click();
  await poll(() => armed(p), 8000);
  await p.waitForTimeout(1000);
  check("in play, the Rules card offers it too", (await cornerCard(p)) && (await n(p, '[data-testid="corner-menu-change-rules"]')) === 1);
  await p.keyboard.press("Escape");
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("In Spanish, on a phone: the question, and the card by touch");
{
  const { p, ctx, errs } = await open("el-cabeza-luna.html?nova&lang=es", { viewport: { width: 390, height: 844 }, touch: true });
  await gateOn(p);
  await p.locator('[data-testid="gate-sheet-back"]').tap();
  await poll(async () => (await n(p, '[data-testid="gate-standard"]')) > 0, 4000);
  await p.locator('[data-testid="gate-standard"]').tap();
  await poll(() => armed(p), 8000);
  await p.waitForTimeout(1500);
  check("the Rules card by touch: Cambiar las reglas on it", (await cornerCard(p, true)) && /cambiar las reglas/i.test(await p.locator('[data-testid="corner-menu-change-rules"]').innerText()));
  // The link's own words are small (11 px high in Luna's look): a finger
  // a little below them still takes it, the room round it on a touch screen.
  const link = await p.locator('[data-testid="corner-menu-change-rules"]').boundingBox();
  check(`...the link a finger's height to tap (${link ? Math.round(link.height) : "none"} px, and its room)`, !!link && (await p.evaluate(() => { const b = document.querySelector('[data-testid="corner-menu-change-rules"]'), r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.bottom + 6); return !!e && (e === b || b.contains(e)); })));
  await p.touchscreen.tap(link.x + link.width / 2, link.y + link.height + 5);
  await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) > 0, 3000);
  const ask = await p.locator('[data-testid="change-rules-ask"]').innerText();
  check(`...¿Cambiar las reglas?, Seguir jugando`, /¿cambiar las reglas\?/i.test(ask) && /seguir jugando/i.test(ask) && /cabeza estándar o cabeza nova/i.test(ask), ask.replace(/\s+/g, " "));
  const box = await p.locator('[data-testid="change-rules-ask"]').boundingBox();
  check("...the card on the screen, clear of its edges", !!box && box.x >= 8 && box.x + box.width <= 382 && box.y >= 8 && box.y + box.height <= 836, JSON.stringify(box));
  await shot(p, "phone-es");
  { const b = await p.locator('[data-testid="change-rules-no"]').boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  check("Seguir jugando: the game as it was", !!(await poll(async () => (await n(p, '[data-testid="change-rules-ask"]')) === 0, 2000)) && await armed(p));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `${fails} failure(s)` : "all passed");
process.exit(fails ? 1 : 0);
