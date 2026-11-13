/* Calm Rings' tooltips (chassis/menu-fan.js tipOf, showTip; user, of the
   menu's wedges: "add pop-up tool-tips for the menu wedges to provide
   additional informational context, globally.").

   In every world, before a game, on a desktop: a mouse rested on each
   wedge brings up its tooltip (role tooltip), saying what the setting is
   (its own line: the one its card and More's list say), out past the
   ring's edge, on the screen, clear of the wedge's words; the mouse off
   it, it goes. Opponent says who plays whom. In Noir: from one wedge
   straight to the next, the next one's at once; the keys (a wedge the
   arrows reach says it at once, and is described by it); a click (the
   tooltip gone, the card out). In play, the corner fan's wedges, each
   with its tooltip. After a game in the Monolith (the user's picture: More,
   View, Opponent, Carvings, Replay a game): each, Opponent saying the
   computer plays Basalt, Carvings that it's every move of the game. On a
   phone in the store: a finger held on a wedge brings its tooltip up
   above the wedge, and letting go is no tap (no card, the menu still
   out); a quick tap still opens the card, no tooltip. In Spanish: More's
   in Spanish.

   node tests/e2e-menu-tips.mjs [worlds | more]   (one half or the other:
   every world before a game, or the rest; both with neither) */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = "file:///home/user/el-cabeza-project/dist";
const PART = process.argv[2] || "all";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const poll = async (fn, ms = 6000, step = 120) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};

// The menu out (its wedges' keys, by where each is drawn), or null.
const wedgesOf = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  if (!layer || getComputedStyle(layer.querySelector('[data-testid="menu-fan"]')).opacity !== "1") return null;
  const ws = [...layer.querySelectorAll("g[data-ml-item]")].map((g) => ({ key: g.getAttribute("data-ml-item"), at: +g.getAttribute("data-cr-at") }));
  ws.sort((a, b) => a.at - b.at);
  return ws.length ? { phase: layer.getAttribute("data-phase"), keys: ws.map((w) => w.key) } : null;
});
// The tooltip as it is: shown, whose, its words, its box; the wedge's words' box; the ring.
const tipNow = (page, key) => page.evaluate((k) => {
  const n = document.querySelector('[data-testid="dock-menu"] [data-testid="menu-fan-tooltip"]');
  if (!n) return null;
  const r = n.getBoundingClientRect(), lab = k && document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`), L = lab ? lab.getBoundingClientRect() : null;
  const g = k && document.querySelector(`[data-testid="dock-menu"] g[data-ml-item="${k}"]`);
  const main = n.querySelector(".cr-tt-main"), more = n.querySelector(".cr-tt-more");
  return {
    on: n.classList.contains("cr-tt-on") && getComputedStyle(n).visibility === "visible", key: n.getAttribute("data-mf-tip"), how: n.getAttribute("data-mf-how"), role: n.getAttribute("role"),
    main: main ? main.textContent : "", more: more ? more.textContent : "",
    box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, vw: innerWidth, vh: innerHeight,
    label: L ? { l: L.left, t: L.top, r: L.right, b: L.bottom } : null,
    described: g ? g.getAttribute("aria-describedby") === n.id : null,
    pressed: g ? getComputedStyle(g).pointerEvents : null,
  };
}, key);
const inView = (x) => x.box.l >= 0 && x.box.t >= 0 && x.box.r <= x.vw && x.box.b <= x.vh;
const clearOf = (x) => !x.label || x.box.r <= x.label.l || x.box.l >= x.label.r || x.box.b <= x.label.t || x.box.t >= x.label.b;
const labelAt = (page, key) => page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
const pieceBox = (page) => page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
async function openMenu(page, touch = false) {
  for (let i = 0; i < 5; i++) {
    if (await wedgesOf(page)) break;
    const b = await pieceBox(page);
    if (b) { if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    if (await poll(() => wedgesOf(page), 2500, 120)) break;
  }
  return poll(() => wedgesOf(page), 6000, 120);
}
// Every wedge hovered in turn: each one's tooltip.
async function hoverEach(page, keys) {
  const seen = {};
  for (const k of keys) {
    const at = await labelAt(page, k);
    if (!at) { seen[k] = null; continue; }
    await page.mouse.move(at.x, at.y, { steps: 3 });
    seen[k] = await poll(async () => { const x = await tipNow(page, k); return x && x.on && x.key === k ? x : null; }, 6000);
  }
  return seen;
}
const tipsOk = (seen) => Object.entries(seen).filter(([, x]) => !x || !x.main || x.role !== "tooltip" || !inView(x) || !clearOf(x)).map(([k, x]) => `${k}: ${x ? JSON.stringify({ main: x.main, box: x.box, label: x.label }) : "none"}`);

async function world({ page: name, query = "", opening = null }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; try { localStorage.setItem("el-cabeza:first-game-tour", "done"); localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${DIST}/el-cabeza-${name}.html${query}`);
  if (opening) {
    await page.locator(`[data-testid="${opening}"]`).click({ timeout: 60000 });
    await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 120000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

const WORLDS = [
  { page: "standard" }, { page: "futuris" }, { page: "tienda", opening: "tienda-open-box" }, { page: "lluvia", opening: "lluvia-straight-to-board" },
  { page: "cromo" }, { page: "plano" }, { page: "luna" }, { page: "noir" }, { page: "ciudad" },
  { page: "parrish", query: "?look=orinoco" }, { page: "lab", query: "?theme=monolith" }, { page: "lab", query: "?theme=destijl" },
];
for (const w of PART === "more" ? [] : WORLDS) {
  console.log(`${w.page}${w.query || ""}, on a desktop, before a game`);
  const { ctx, page, errs } = await world(w);
  const m = await openMenu(page);
  check("the menu out", !!m, JSON.stringify(m));
  if (m) {
    const seen = await hoverEach(page, m.keys);
    const bad = tipsOk(seen);
    check(`each wedge rested on: its tooltip, what it is, past the ring, on the screen, clear of its words (${m.keys.join(", ")})`, !bad.length, bad.join(" | "));
    console.log(`   ${Object.entries(seen).map(([k, x]) => `${k}: ${x ? x.main.slice(0, 48) : "-"}${x && x.more ? ` / ${x.more.slice(0, 40)}` : ""}`).join(" · ")}`);
    if (seen.opponent) check("...Opponent's says who plays whom", /two players|computer plays|online/i.test(seen.opponent.more), seen.opponent.more);
    await page.mouse.move(640, 40);
    check("...the mouse off the ring, the tooltip gone", !!(await poll(async () => { const x = await tipNow(page); return x && !x.on; }, 3000)));
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (PART !== "worlds") {
console.log("Noir, on a desktop: one wedge to the next, the keys, a click; then in play");
{
  const { ctx, page, errs } = await world({ page: "noir" });
  let m = await openMenu(page);
  const [k1, k2] = m.keys.filter((k) => k !== "more");
  const a1 = await labelAt(page, k1), a2 = await labelAt(page, k2);
  await page.mouse.move(a1.x, a1.y, { steps: 3 });
  await poll(async () => { const x = await tipNow(page, k1); return x && x.on && x.key === k1 ? x : null; });
  await page.mouse.move(a2.x, a2.y, { steps: 4 });
  const next = await tipNow(page, k2);
  check(`from ${k1} straight on to ${k2}: ${k2}'s tooltip at once`, !!next && next.on && next.key === k2, JSON.stringify(next));
  await page.mouse.move(640, 40);
  await poll(async () => { const x = await tipNow(page); return x && !x.on; }, 3000);
  // The keys: the arrows reach a wedge, its tooltip at once, described by it.
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("data-ml-item")) || null);
  const byKey = focused && (await poll(async () => { const x = await tipNow(page, focused); return x && x.on && x.key === focused ? x : null; }, 2000));
  check(`the arrow keys onto ${focused}: its tooltip, the wedge described by it`, !!byKey && byKey.how === "key" && byKey.described === true, JSON.stringify(byKey));
  await page.keyboard.press("ArrowRight");
  const focused2 = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("data-ml-item")) || null);
  const byKey2 = await poll(async () => { const x = await tipNow(page, focused2); return x && x.on && x.key === focused2 ? x : null; }, 2000);
  const was = await tipNow(page, focused);
  check(`...on to ${focused2}: its, and ${focused} no longer described by it`, !!byKey2 && was && was.described === false, JSON.stringify({ byKey2, was }));
  // A click on Opponent: the tooltip away, its card out.
  const op = await labelAt(page, "opponent");
  await page.mouse.move(op.x, op.y, { steps: 3 });
  await poll(async () => { const x = await tipNow(page, "opponent"); return x && x.on ? x : null; });
  await page.mouse.click(op.x, op.y);
  const card = await poll(() => page.evaluate(() => { const c = document.querySelector('[data-testid="menu-fan-card"]'); return c && c.getAttribute("data-mf-card"); }), 3000);
  const afterClick = await tipNow(page);
  check("a click on Opponent: its card out, the tooltip gone (the card says it)", card === "opponent" && !!afterClick && !afterClick.on, JSON.stringify({ card, on: afterClick && afterClick.on }));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  // In play: Begin from the menu, the corner fan, each wedge's tooltip.
  m = await openMenu(page);
  const primary = await page.locator('[data-testid="menu-fan-primary"]').boundingBox();
  if (primary) await page.mouse.click(primary.x + primary.width / 2, primary.y + primary.height / 2);
  await page.waitForTimeout(2500);
  m = await openMenu(page);
  check("in play: the corner fan out", !!m && m.phase === "play", JSON.stringify(m));
  if (m) {
    const seen = await hoverEach(page, m.keys);
    const bad = tipsOk(seen);
    check(`...each of its wedges rested on: its tooltip (${m.keys.join(", ")})`, !bad.length, bad.join(" | "));
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The Monolith after a game (the user's picture)");
{
  const { ctx, page, errs } = await world({ page: "lab", query: "?theme=monolith" });
  await page.mouse.click(5, 400);
  await openDockPanel(page);
  const ai = page.locator('[data-opponent="ai-dark"]');
  if (await ai.count()) { await ai.first().click(); await page.waitForTimeout(400); }
  await page.locator("button", { hasText: /Begin Game|Try a Game/i }).first().click();
  await page.mouse.move(1270, 400);
  await page.waitForTimeout(2500);
  await openDockPanel(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="end-game"]').first().click();
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(5, 400); await page.waitForTimeout(800); }
  const m = await openMenu(page);
  check("after the game: the half ring out", !!m && m.phase === "over", JSON.stringify(m));
  if (m) {
    const seen = await hoverEach(page, m.keys);
    const bad = tipsOk(seen);
    check(`...each wedge rested on: its tooltip (${m.keys.join(", ")})`, !bad.length, bad.join(" | "));
    console.log(`   ${Object.entries(seen).map(([k, x]) => `${k}: ${x ? `${x.main}${x.more ? ` / ${x.more}` : ""}` : "-"}`).join("\n   ")}`);
    check("...Opponent's: the computer plays Basalt, on its level, and you Sandstone", !!seen.opponent && /computer plays Basalt/.test(seen.opponent.more) && /You play Sandstone/.test(seen.opponent.more), seen.opponent && seen.opponent.more);
    check("...Carvings (the move log, in the Monolith's words): every move of the game, a page of its own", !!seen.movelog && /Every move of the game/.test(seen.movelog.main) && /own page/.test(seen.movelog.more), JSON.stringify(seen.movelog && { main: seen.movelog.main, more: seen.movelog.more }));
    check("...More's: every setting in one list", !!seen.more && /All the settings in one list/.test(seen.more.main), seen.more && seen.more.main);
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// A finger held on the screen (the browser's own touch events, as a phone sends them).
async function hold(page, cdp, at, ms) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
  await page.waitForTimeout(ms);
}
const lift = (cdp) => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
async function store(lang = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; try { localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${DIST}/el-cabeza-nova.html${lang ? `?lang=${lang}` : ""}`);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs, cdp: await ctx.newCDPSession(page) };
}

console.log("The store, on a phone: a finger held on a wedge");
{
  const { ctx, page, errs, cdp } = await store();
  const m = await openMenu(page, true);
  check("the menu out", !!m, JSON.stringify(m));
  if (m) {
    const at = await labelAt(page, "opponent");
    await hold(page, cdp, at, 1400);
    const held = await tipNow(page, "opponent");
    const top = await page.evaluate(() => { const g = document.querySelector('[data-testid="dock-menu"] g[data-ml-item="opponent"]'); return g.getBoundingClientRect().top; });
    check("Opponent held: its tooltip, above the wedge, clear of the finger", !!held && held.on && held.key === "opponent" && held.how === "touch" && held.box.b <= top + 1 && inView(held), JSON.stringify({ held, top }));
    await lift(cdp);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ card: !!document.querySelector('[data-testid="menu-fan-card"]'), out: !!document.querySelector('[data-testid="dock-menu"][data-open="true"]') }));
    const lingers = await tipNow(page, "opponent");
    check("...let go: no tap (no card, the menu still out), the tooltip kept a moment", !after.card && after.out && !!lingers && lingers.on, JSON.stringify({ after, on: lingers && lingers.on }));
    const gone = await poll(async () => { const x = await tipNow(page); return x && !x.on; }, 6000);
    check("...then it goes by itself", !!gone);
    // A quick tap: the card, as ever, and no tooltip.
    await page.touchscreen.tap(at.x, at.y);
    const card = await poll(() => page.evaluate(() => { const c = document.querySelector('[data-testid="menu-fan-card"]'); return c && c.getAttribute("data-mf-card"); }), 3000);
    const tip = await tipNow(page);
    check("a quick tap on Opponent: its card, no tooltip", card === "opponent" && !!tip && !tip.on, JSON.stringify({ card, on: tip && tip.on }));
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The store in Spanish, on a phone");
{
  const { ctx, page, errs, cdp } = await store("es");
  const m = await openMenu(page, true);
  if (m) {
    const at = await labelAt(page, "more");
    await hold(page, cdp, at, 1400);
    const held = await tipNow(page, "more");
    await lift(cdp);
    check("More held: its tooltip in Spanish", !!held && held.on && /Todas las opciones en una lista/.test(held.main), JSON.stringify(held && held.main));
  } else check("the menu out", false);
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
