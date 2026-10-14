/* The corner menu (chassis/CornerMenu.jsx, chassis/corner-menu.js): the
   game's rules at the top left in every world, in that world's own look
   (user: "move forward with the corner menus as illustrated in the
   mockups").

   In each world, a game with two laws (Orthogonal slide, and Shoving with
   rolls pushing only the opponent's pieces) on a board 10 across and 12
   deep: none in the setup; in play, the tab (closed) in the world's look,
   up in the top left, saying what the game is; a tap opens the card with
   the laws and their settings, each side's pieces, the board; a press
   outside closes it, and so does Escape; a law opens its own rules card,
   "Rules" the rules. A plain game says it's the standard game; once the
   game's over the menu goes. The Lab's read-out carries the same rules
   (hovered, the list; a law opens its card). In Nova's store after the
   story, the slip offers the purchase. The tab sits dimmed till it's
   wanted (user: "Dim the circled buttons ... a tap or hover before a click
   on a mouse will raise them 100% again", at 60%, Parrish's at half): a
   mouse over it raises it; on a touch screen a first tap raises it and a
   second opens it, and so with the City's clock. */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const DIST = "file:///home/user/el-cabeza-project/dist";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn().catch(() => null); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };

const LAWS = { slide: true, shoving: true, shoveOwn: false };
const BOARD = { rows: 12, cols: 10 };
const VIEW = { width: 1100, height: 800 };
const WORLDS = [
  { page: "standard", look: "den" },
  { page: "neon", look: "neon" },
  { page: "tienda", look: "store", opening: "tienda-open-box" },
  { page: "lluvia", look: "lluvia", opening: "lluvia-straight-to-board" },
  { page: "cromo", look: "cromo" },
  { page: "plano", look: "plano" },
  { page: "luna", look: "luna" },
  { page: "noir", look: "noir" },
  { page: "ciudad", look: "ciudad" },
  { page: "parrish", query: "?look=orinoco", look: "parrish-orinoco" },
  { page: "parrish", query: "?look=watermark", look: "parrish-watermark" },
];

async function open(world, { laws = LAWS, board = BOARD } = {}) {
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(([l, b]) => {
    window.__EC_TEST_HOOKS__ = true;
    if (l) window.__EC_LAWS__ = l;
    if (b) window.__EC_BOARD__ = b;
    // (Been to the Singularity: the extras are open, engine/journey.js.)
    try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ }
  }, [laws, board]);
  await page.goto(`${DIST}/el-cabeza-${world.page}.html${world.query || ""}`);
  await page.waitForTimeout(2500);
  if (world.opening) { await page.locator(`[data-testid="${world.opening}"]`).click(); await page.waitForTimeout(1200); }
  return { context, page, errs };
}
const menuState = (page) => page.evaluate(() => {
  const m = document.querySelector('[data-testid="corner-menu"]');
  if (!m) return null;
  const tab = m.querySelector('[data-testid="corner-menu-tab"]').getBoundingClientRect();
  const card = m.querySelector('[data-testid="corner-menu-card"]');
  const c = card ? card.getBoundingClientRect() : null;
  return { look: m.dataset.look, open: m.dataset.open, tab: m.querySelector('[data-testid="corner-menu-tab"]').textContent, tabBox: { x: tab.left, y: tab.top, r: tab.right, b: tab.bottom },
    card: card ? card.textContent : null, cardBox: c ? { x: c.left, y: c.top, r: c.right, b: c.bottom } : null };
});
async function begin(page) {
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.mouse.move(4, 400);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 400); await page.waitForTimeout(600); }
}
const overlayOpen = (page) => page.evaluate(() => { const o = document.querySelector('[data-testid="info-overlay"]'); return !!o && o.dataset.open === "true"; });
async function closeOverlay(page) {
  await page.keyboard.press("Escape");
  await poll(async () => !(await overlayOpen(page)), 4000);
  await page.waitForTimeout(300);
}
// A press outside the menu, on the page (the points counter, which does
// nothing when pressed).
async function pressOutside(page) {
  const b = await page.locator('[data-testid="points-counter"]').first().boundingBox();
  if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  else await page.mouse.click(VIEW.width / 2, VIEW.height - 6);
}

for (const world of WORLDS) {
  console.log(`[${world.look}]`);
  const { context, page, errs } = await open(world);
  check("no corner menu in the setup", (await menuState(page)) === null);
  await begin(page);
  let s = await poll(() => menuState(page));
  check(`in play: the corner menu, in the world's look (${s && s.look})`, !!s && s.look === world.look && s.open === "false", JSON.stringify(s));
  if (!s) { await context.close(); continue; }
  check("...its tab in the top left, on the screen", s.tabBox.x >= 0 && s.tabBox.y >= 0 && s.tabBox.x < 60 && s.tabBox.y < 60 && s.tabBox.r <= VIEW.width / 2, JSON.stringify(s.tabBox));
  // (Parrish counts in words.)
  check(`...saying what the game is ("${s.tab.trim()}")`, /(?:2|two) laws/i.test(s.tab), s.tab);
  {
    // (Its fade is a CSS transition, which moves a frame at a time: on the
    // software renderer a heavy world's frame can take most of a second.)
    const tabOpacity = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-testid="corner-menu-tab"]')).opacity));
    const settle = (want) => poll(async () => { const v = await tabOpacity(); return Math.abs(v - want) < 0.02 ? v : null; }, 5000);
    await page.mouse.move(VIEW.width / 2, VIEW.height - 40);
    const want = world.look.startsWith("parrish") ? 0.5 : 0.6;
    const dim = await settle(want);
    check(`...dimmed till it's wanted (${dim || await tabOpacity()})`, !!dim, String(await tabOpacity()));
    await page.locator('[data-testid="corner-menu-tab"]').hover();
    const up = await settle(1);
    check(`...the mouse over it: full strength (${up || await tabOpacity()})`, !!up, String(await tabOpacity()));
  }

  await page.locator('[data-testid="corner-menu-tab"]').click();
  s = await poll(async () => { const v = await menuState(page); return v && v.open === "true" && v.card ? v : null; }, 4000);
  check("a tap opens the card", !!s && !!s.card);
  if (s && s.card) {
    const t = s.card;
    check("...the laws, and Shoving's settings", /Orthogonal slide/i.test(t) && /Shoving/i.test(t) && /Shoves on/i.test(t) && /Slides and rolls/i.test(t) && /Only opponents'/i.test(t) && !/Diagonal slide/i.test(t), t.slice(0, 400));
    check("...each side's pieces", /Cabeza/i.test(t) && /Turrito/i.test(t) && /Flaco/i.test(t) && /Chato/i.test(t) && /Opa/i.test(t));
    check("...the board, 10 across by 12", /10 × 12/.test(t) || /10×12/.test(t), t.slice(-300));
    check("...all of it on the screen", s.cardBox.x >= 0 && s.cardBox.y >= 0 && s.cardBox.r <= VIEW.width && s.cardBox.b <= VIEW.height, JSON.stringify(s.cardBox));
  }
  await pressOutside(page);
  check("a press outside closes it", !!(await poll(async () => { const v = await menuState(page); return v && v.open === "false"; }, 3000)));
  await page.locator('[data-testid="corner-menu-tab"]').click();
  await poll(async () => { const v = await menuState(page); return v && v.open === "true"; }, 3000);
  await page.keyboard.press("Escape");
  check("...and so does Escape", !!(await poll(async () => { const v = await menuState(page); return v && v.open === "false"; }, 3000)));

  await page.locator('[data-testid="corner-menu-tab"]').click();
  await page.locator('[data-testid="corner-menu-law-shoving"]').click();
  check("a law on it opens that law's rules card (and the card closes)", !!(await poll(() => overlayOpen(page), 4000)) && (await menuState(page)).open === "false");
  await closeOverlay(page);
  await page.locator('[data-testid="corner-menu-tab"]').click();
  await page.locator('[data-testid="corner-menu-rules"]').click();
  check("\"Rules\" opens the rules", !!(await poll(() => overlayOpen(page), 4000)));
  await closeOverlay(page);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await context.close();
}

/* ---- a touch screen: the first tap raises, the second opens (the tab and the City's clock) ---- */
{
  console.log("[ciudad, by touch]");
  // (A phone's page: a quick second tap isn't taken for a double tap's zoom.
  // And a second tap a moment after the first, as a hand does.)
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(([l, b]) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; window.__EC_BOARD__ = b; try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } }, [LAWS, BOARD]);
  await page.goto(`${DIST}/el-cabeza-ciudad.html`);
  await page.waitForTimeout(2500);
  await begin(page);
  await poll(() => menuState(page));
  // (A tap at the button's middle, straight away: Playwright's own tap()
  // waits on a heavy page for seconds, longer than a raise lasts.)
  const tapAt = async (sel) => { const b = await page.locator(sel).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const cm = () => page.evaluate(() => { const m = document.querySelector('[data-testid="corner-menu"]'); const t = m && m.querySelector('[data-testid="corner-menu-tab"]'); return m && { open: m.dataset.open, raised: m.dataset.raised, opacity: Number(getComputedStyle(t).opacity) }; });
  check(`the Rules tab dimmed (${(await cm()).opacity})`, !!(await poll(async () => Math.abs((await cm()).opacity - 0.6) < 0.02, 5000)));
  await tapAt('[data-testid="corner-menu-tab"]');
  let st = await poll(async () => { const v = await cm(); return v.raised === "true" && Math.abs(v.opacity - 1) < 0.02 ? v : null; }, 5000);
  check(`...a first tap raises it to full, the card not open (${JSON.stringify(st || await cm())})`, !!st && st.open === "false");
  await page.waitForTimeout(800);
  await tapAt('[data-testid="corner-menu-tab"]');
  st = await poll(async () => { const v = await cm(); return v && v.open === "true" ? v : null; }, 3000);
  check("...a second tap opens it", !!st);
  await page.keyboard.press("Escape");
  st = await poll(async () => { const v = await cm(); return v && v.open === "false" ? v : null; }, 3000);
  check("...closed again, it's down again", !!st && st.raised === "false", JSON.stringify(st));
  await tapAt('[data-testid="corner-menu-tab"]');
  await page.waitForTimeout(300);
  check("...raised and left alone", (await cm()).raised === "true");
  check("...it goes back down after a few seconds", !!(await poll(async () => (await cm()).raised === "false", 9000)));
  // The City's clock, the same.
  const chip = page.locator('[data-testid="ciudad-time-chip"]');
  const ck = () => page.evaluate(() => { const c = document.querySelector('[data-testid="ciudad-time-chip"]'); return c && { raised: c.dataset.raised, open: c.getAttribute("aria-expanded"), opacity: Number(getComputedStyle(c).opacity) }; });
  const c0 = await poll(async () => { const v = await ck(); return v && Math.abs(v.opacity - 0.6) < 0.02 ? v : null; }, 5000);
  check(`the City's clock dimmed till it's wanted (${JSON.stringify(c0 || await ck())})`, !!c0);
  await tapAt('[data-testid="ciudad-time-chip"]');
  const c1 = await poll(async () => { const v = await ck(); return v.raised === "true" && Math.abs(v.opacity - 1) < 0.02 ? v : null; }, 5000);
  check(`...a first tap raises it to full, the dial not open (${JSON.stringify(c1 || await ck())})`, !!c1 && c1.open === "false");
  await page.waitForTimeout(800);
  await tapAt('[data-testid="ciudad-time-chip"]');
  check("...a second tap opens the dial", !!(await poll(async () => (await ck()).open === "true", 3000)));
  await page.keyboard.press("Escape");
  check("...closed again, it's down again", !!(await poll(async () => { const v = await ck(); return v.open === "false" && v.raised === "false"; }, 3000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await context.close();
}

/* ---- a plain game says so; the game over, it's gone ---- */
{
  console.log("[neon, a plain game]");
  const { context, page, errs } = await open({ page: "neon" }, { laws: null, board: null });
  await begin(page);
  const s = await poll(() => menuState(page));
  check(`the tab: the standard game ("${s && s.tab.trim()}")`, !!s && /STANDARD/i.test(s.tab) && /10\s*×\s*10/.test(s.tab), s && s.tab);
  await page.locator('[data-testid="corner-menu-tab"]').click();
  const c = await poll(async () => { const v = await menuState(page); return v && v.card ? v.card : null; }, 4000);
  check("...the card: no laws, the standard rules", !!c && /STANDARD RULES/i.test(c) && !/Shoving/i.test(c), c && c.slice(0, 200));
  await page.keyboard.press("Escape");
  const corner = await waitForDockCorner(page);
  check("the dock reopens mid-game", !!corner && (await reopenDockPanelFromCorner(page, corner)));
  await page.locator('[data-testid="end-game"]').click();
  check("the game ended: no corner menu", !!(await poll(async () => (await menuState(page)) === null, 5000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await context.close();
}

/* ---- the Lab: its read-out carries the rules ---- */
{
  console.log("[the Lab]");
  const { context, page, errs } = await open({ page: "lab", query: "?theme=swiss" });
  await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="lab-hud"]')), 15000);
  check("no rules in the read-out in the setup", (await page.locator('[data-testid="lab-hud-rules"]').count()) === 0);
  await begin(page);
  const line = await poll(() => page.evaluate(() => { const r = document.querySelector('[data-testid="lab-hud-rules"]'); return r ? r.textContent : null; }), 8000);
  check(`in play: a line of rules in the read-out ("${line}")`, !!line && /2 laws · 5 pieces · 10 × 12/.test(line), line);
  check("...and no corner menu of its own", (await menuState(page)) === null);
  await page.hover('[data-testid="lab-hud"]');
  const list = await poll(() => page.evaluate(() => { const r = document.querySelector('[data-testid="lab-hud-rules"]'); return r && r.dataset.open === "true" ? r.textContent : null; }), 5000);
  await page.waitForTimeout(1200); // (its glide up to full size)
  check("brought up, it lists the laws, their settings, the pieces, the board", !!list && /Orthogonal slide/.test(list) && /Shoves push: Only opponents'/.test(list) && /Turrito/.test(list) && /Size 10 × 12/.test(list), list && list.slice(0, 300));
  const fits = await page.evaluate(() => { const l = document.querySelector('[data-testid="lab-hud-rules"] .lab-rules-list'); const r = l && l.getBoundingClientRect(); return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, max: l.style.maxHeight } : null; });
  check("...the list within the screen", !!fits && fits.bottom <= fits.h, JSON.stringify(fits));
  await page.waitForTimeout(8000);
  check("...and with the mouse on it, it stays up (9 s on; it used to go down at 8)", await page.evaluate(() => { const r = document.querySelector('[data-testid="lab-hud-rules"]'); return !!r && r.dataset.open === "true"; }));
  await page.locator('[data-testid="lab-rules-law-shoving"]').click();
  check("...a law opens its rules card", !!(await poll(() => overlayOpen(page), 4000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await context.close();
}

/* ---- Nova's store after the story: the slip, with the purchase ---- */
{
  console.log("[Nova: the store, after the story]");
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true }));
      ["el-cabeza:singularity-seen", "el-cabeza:commercial-aired", "el-cabeza:special-order-noted"].forEach((k) => localStorage.setItem(k, "1"));
    } catch (e) { /* none */ }
  });
  await page.goto(`${DIST}/el-cabeza-nova.html?world=tienda`);
  check("the gate comes up", !!(await poll(async () => (await page.locator('[data-testid="reality-gate"]').count()) > 0, 40000)));
  await page.waitForTimeout(600);
  await page.locator('[data-testid="gate-standard"]').click();
  check("...and a game begins", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 20000)));
  const s = await poll(() => menuState(page), 10000);
  check(`the corner menu, the store's slip ("${s && s.tab.trim()}")`, !!s && s.look === "store" && /Your order/i.test(s.tab), JSON.stringify(s));
  await page.locator('[data-testid="corner-menu-tab"]').click();
  const extra = await poll(async () => { const e = page.locator('[data-testid="corner-menu-extra"]'); return (await e.count()) ? e.innerText() : null; }, 4000);
  check(`...on it, the purchase ("${extra}")`, !!extra && /Purchase and bring home/.test(extra), extra);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} corner menu check(s) failed` : "\nall corner menu checks passed");
process.exit(failures ? 1 : 0);
