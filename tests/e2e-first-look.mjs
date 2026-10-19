/* A new player's first look at the store's menu (user, 2026-10-19, with a
   screenshot of the dock's panel, See the pieces and Try a Game circled in
   red: "For a first-time player on a new game, the only buttons that can
   be pressed if they hit the 3D rotating piece menu is the ones that are
   circled in red"; chassis/ElCabeza3D.jsx firstLook).

   On a phone, from a fresh story: the dock's menu opens with See the
   pieces and Try a Game at full strength; everything else in it (the
   opponent and the difficulty, the check alert, the start, the cart, the
   footer's links and corner switches, the side to move first) is in
   sight, faded, and taps on it change nothing. See the pieces opens the
   catalog. Try a Game begins the walkthrough; skipped, and the game
   ended, New Game's setup is the whole menu again. On a desktop the same,
   by mouse. With the phone's control bar, its setup holds back the same.
   A player whose first game's been walked through has the whole menu.

   node tests/e2e-first-look.mjs */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const poll = async (fn, ms = 15000, step = 250) => {
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

async function open({ phone = false, bar = false, toured = false } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(({ bar, toured }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      if (bar) localStorage.setItem("el-cabeza:nova-layout", "bar");
      if (toured) localStorage.setItem("el-cabeza:first-game-tour", "done");
    } catch (e) { /* none */ }
  }, { bar, toured });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(NOVA);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const box = q(page, "tienda-open-box");
  if (phone) await box.tap(); else await box.click();
  await poll(async () => !(await has(page, "tienda-lid")), 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

// What the dock's panel holds back, by testid (or another selector).
const LOCKED = [
  ["the Back to the opponents", '[data-ec-diff-back]'],
  ["Easy", '[data-ec-diff="easy"]'],
  ["Medium", '[data-ec-diff="medium"]'],
  ["Hard", '[data-ec-diff="hard"]'],
  ["the check alert", '[data-testid="check-alert-setup"]'],
  ["Start: Standard", '[data-testid="start-standard"]'],
  ["Start: Manual", '[data-testid="start-by-hand"]'],
  ["Put one in the cart", '[data-testid="story-purchase"]'],
  ["Replay a game", '[data-testid="replay-link"]'],
  ["Save & carry", '[data-testid="open-saves"]'],
  ["the sound", '[data-testid="sound-button"]'],
  ["the actions left", '[data-testid="points-toggle"]'],
  ["the move costs", '[data-testid="costs-toggle"]'],
  ["the piece guide", '[data-testid="guide-toggle"]'],
  ["the control bar", '[data-testid="layout-toggle"]'],
];
// A control's state as seen: pressable at all, how faded (its own opacity
// times its rows'), and what's actually under its middle.
const look = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  let o = 1;
  for (let e = el; e && e !== document.body; e = e.parentElement) o *= +getComputedStyle(e).opacity;
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { disabled: !!el.disabled, opacity: Math.round(o * 100) / 100, takesTaps: !!hit && (hit === el || el.contains(hit)), x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);
const panelOpen = (page) => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");

async function lockedMenu(page, phone, label) {
  check(`${label}: the dock's menu opens`, await openDockPanel(page));
  await page.waitForTimeout(700);
  check("...a new player's first look", (await page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.firstLook)) === "true");
  for (const [name, id] of [["See the pieces", "tienda-order-form"], ["Try a Game", "tienda-try-game"]]) {
    const l = await look(page, `[data-testid="${id}"]`);
    check(`...${name}: pressable, at full strength`, !!l && !l.disabled && l.opacity > 0.95 && l.takesTaps, JSON.stringify(l));
  }
  for (const [name, sel] of LOCKED) {
    const l = await look(page, sel);
    if (!l) { if (/costs|control bar/.test(name)) continue; check(`...${name}: there`, false); continue; }
    check(`...${name}: faded, not to be pressed`, l.disabled && l.opacity < 0.4 && !l.takesTaps, JSON.stringify(l));
  }
  const status = await page.evaluate(() => { const s = document.querySelector('[data-testid="turn-status"]'); return { role: s.getAttribute("role"), side: s.dataset.side }; });
  check("...the side to move first: a read-out, not a switch", status.role === null && status.side === "light", JSON.stringify(status));

  // Pressing them anyway: nothing changes, and the menu stays.
  const before = await page.evaluate(() => ({
    diff: [...document.querySelectorAll("[data-ec-diff]")].find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.ecDiff,
    check: document.querySelector('[data-testid="check-alert-setup"]').getAttribute("aria-checked"),
    manual: document.querySelector('[data-testid="start-by-hand"]').getAttribute("aria-pressed"),
    cart: document.querySelector('[data-testid="story-purchase"]').dataset.cart,
    side: document.querySelector('[data-testid="turn-status"]').dataset.side,
  }));
  for (const sel of ['[data-ec-diff="hard"]', '[data-testid="check-alert-setup"]', '[data-testid="start-by-hand"]', '[data-testid="story-purchase"]', '[data-testid="sound-button"]', '[data-testid="points-toggle"]', '[data-testid="guide-toggle"]', '[data-testid="turn-status"]']) {
    const l = await look(page, sel);
    if (!l) continue;
    if (phone) await page.touchscreen.tap(l.x, l.y); else await page.mouse.click(l.x, l.y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    diff: [...document.querySelectorAll("[data-ec-diff]")].find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.ecDiff,
    check: document.querySelector('[data-testid="check-alert-setup"]').getAttribute("aria-checked"),
    manual: document.querySelector('[data-testid="start-by-hand"]').getAttribute("aria-pressed"),
    cart: document.querySelector('[data-testid="story-purchase"]').dataset.cart,
    side: document.querySelector('[data-testid="turn-status"]').dataset.side,
  }));
  check(`...taps on them change nothing (${JSON.stringify(after)})`, JSON.stringify(before) === JSON.stringify(after) && after.diff === "easy" && after.cart === "empty", JSON.stringify(before));
  // (The sheets are always there, hidden till opened.)
  const sheetShown = (id) => page.evaluate((i) => { const e = document.querySelector(`[data-testid="${i}"]`); return !!e && getComputedStyle(e.parentElement).visibility === "visible"; }, id);
  check("...no sound menu, no hint, no sheet", !(await has(page, "sound-menu")) && !(await has(page, "toggle-hint")) && !(await sheetShown("replay-sheet")) && !(await sheetShown("saves-sheet")));
  check("...and the menu's still open", await panelOpen(page));
}

/* ---------------- phone: the dock ---------------- */
console.log("\nphone: a new player's first look at the store's menu");
{
  const { ctx, page, errs } = await open({ phone: true });
  await lockedMenu(page, true, "phone");
  await page.screenshot({ path: "/tmp/e2e-first-look-phone.png" });

  // See the pieces: the catalog.
  await q(page, "tienda-order-form").tap();
  check("See the pieces opens the catalog", await poll(() => has(page, "tienda-catalog"), 8000));
  await q(page, "tienda-catalog-close").tap();
  await poll(async () => !(await has(page, "tienda-catalog")), 8000);

  // Try a Game: the walkthrough, skipped; then the game ended.
  check("the menu opens again", await openDockPanel(page));
  await page.waitForTimeout(600);
  await q(page, "tienda-try-game").tap();
  check("Try a Game: the walkthrough's welcome", await poll(async () => (await has(page, "tour-card")) && /Welcome to your first game/.test(await q(page, "tour-card").innerText()), 12000));
  await q(page, "tour-skip").tap();
  await poll(async () => !(await has(page, "tour-card")), 5000);
  check("...skipped, kept as done", (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
  check("...and the menu in play isn't the first look", !(await page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.firstLook)));
  const corner = await waitForDockCorner(page);
  check("the dock reopens mid-game", !!corner && (await reopenDockPanelFromCorner(page, corner)));
  const end = q(page, "end-game");
  for (let i = 0; i < 20 && (await end.count()) > 0; i++) { await end.click().catch(() => {}); await page.waitForTimeout(500); }
  if (await has(page, "tienda-offer-dismiss")) await q(page, "tienda-offer-dismiss").tap().catch(() => {});
  const again = q(page, "new-game");
  await poll(() => has(page, "new-game"), 8000);
  if (await again.count()) await again.first().evaluate((b) => b.click());
  await poll(() => has(page, "story-purchase"), 10000);
  check("New Game: the menu opens", await openDockPanel(page));
  await page.waitForTimeout(600);
  check("...no longer the first look", !(await page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.firstLook)));
  const held = [];
  for (const [name, sel] of LOCKED) {
    const l = await look(page, sel);
    if (!l) continue;
    if (l.disabled || (l.opacity < 0.4 && !/sound|actions|costs|guide|control bar/.test(name))) held.push(name);
  }
  check("...everything in it pressable again", held.length === 0, held.join(", "));
  const hard = await look(page, '[data-ec-diff="hard"]');
  await page.touchscreen.tap(hard.x, hard.y);
  check("...Hard can be chosen", await poll(async () => (await q(page, "dock-panel").locator('[data-ec-diff="hard"]').getAttribute("aria-pressed")) === "true", 4000));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- desktop: the dock ---------------- */
console.log("\ndesktop: the same, by mouse");
{
  const { ctx, page, errs } = await open();
  await lockedMenu(page, false, "desktop");
  await page.screenshot({ path: "/tmp/e2e-first-look-desktop.png" });
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- phone, control bar ---------------- */
console.log("\nphone with the control bar: its setup holds back the same");
{
  const { ctx, page, errs } = await open({ phone: true, bar: true });
  check("the bar's setup is up", await poll(() => has(page, "shell-setup"), 10000));
  const state = await page.evaluate(() => {
    const segOff = (id) => { const s = document.querySelector(`[data-testid="${id}"]`); return s ? [...s.querySelectorAll("button")].every((b) => b.disabled) : null; };
    const btn = (id) => { const b = document.querySelector(`[data-testid="${id}"]`); return b ? !b.disabled : null; };
    return {
      firstMove: segOff("shell-first-move"), opponent: segOff("shell-opponent"), aiSide: segOff("shell-ai-side"), level: segOff("shell-ai-level"),
      checkAlert: segOff("shell-check-alert"), start: segOff("shell-start"), purchase: btn("shell-purchase"),
      see: btn("shell-see-pieces"), begin: btn("shell-begin"),
    };
  });
  check(`...the setup held back (${JSON.stringify(state)})`, state.firstMove && state.opponent && state.aiSide && state.level && state.checkAlert && state.start && state.purchase === false);
  check("...See the pieces and Try a Game pressable", state.see === true && state.begin === true);
  check("...Try a Game says so", /Try a Game/i.test(await q(page, "shell-begin").innerText()));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- a player who's had the walkthrough ---------------- */
console.log("\nafter the first game: the whole menu");
{
  const { ctx, page, errs } = await open({ phone: true, toured: true });
  check("the dock's menu opens", await openDockPanel(page));
  await page.waitForTimeout(700);
  check("...not the first look", !(await page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.firstLook)));
  const cart = await look(page, '[data-testid="story-purchase"]');
  check("...Put one in the cart pressable", !!cart && !cart.disabled && cart.opacity > 0.95 && cart.takesTaps, JSON.stringify(cart));
  const sound = await look(page, '[data-testid="sound-button"]');
  check("...the sound pressable", !!sound && !sound.disabled && sound.takesTaps, JSON.stringify(sound));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
