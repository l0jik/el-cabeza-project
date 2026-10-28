/* Rings, the dock's menu (chassis/menu-fan.js; user, of the menu lab's
   five turning fans: "I like rings", then, asked what next: "Replace the
   dock everywhere"). With no lab: a tap on the piece brings Rings out
   round it, not the panel, in every phase; its settings press the panel's
   own buttons, and the panel opens only for Online's own page.

   On a phone in the store: out from the piece before a game (every
   setting, Try a Game over it); Level's choices; Online opens the panel;
   Try a Game begins the game. In play: the corner piece brings it out
   (brought to the middle); a touch held on the corner piece opens it and
   its lifting doesn't put it away again; End game asks twice. After the
   game: the corner piece's call answered, New game over it. A new
   player's first look holds back what the panel holds back. On a
   desktop (Noir): a click, the mouse wheel, Escape, and the mouse
   brought onto the corner piece in play.

   node tests/e2e-rings.mjs */
import { chromium } from "playwright";
import { waitForDockCorner } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const NOIR = "file:///home/user/el-cabeza-project/dist/el-cabeza-noir.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const poll = async (fn, ms = 15000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};

async function store({ toured = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ toured }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (toured) localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) { /* none */ }
  }, { toured });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(NOVA);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

// Rings as it is: out, still, its phase, its settings, the one at its
// point, the read-out, the big button, whose move.
const rings = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const stage = layer && layer.querySelector('[data-testid="menu-fan"]');
  if (!stage) return null;
  const focus = layer.querySelector("[data-ml-item].mf-focus");
  const primary = layer.querySelector('[data-testid="menu-fan-primary"]');
  const head = layer.querySelector('[data-testid="menu-fan-head"]');
  return {
    version: layer.getAttribute("data-version"), fan: stage.getAttribute("data-fan"), phase: layer.getAttribute("data-phase"),
    still: getComputedStyle(stage).opacity === "1" && stage.getAttribute("data-turning") === "false",
    keys: [...layer.querySelectorAll("[data-ml-item]")].map((n) => n.getAttribute("data-ml-item")),
    focus: focus ? focus.getAttribute("data-ml-item") : null,
    read: (layer.querySelector('[data-testid="menu-fan-read"]') || {}).textContent || "",
    primary: primary && primary.style.display !== "none" ? primary.textContent.trim() : null,
    head: head && head.style.display !== "none" ? head.textContent.trim() : "",
  };
});
const out = async (page) => { const r = await rings(page); return r && r.still ? r : null; };
const panelOpen = (page) => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
const pieceBox = (page) => page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
// The piece tapped till Rings is out (a tap can land while it bounces).
async function openRings(page, touch = true) {
  for (let i = 0; i < 4; i++) {
    if (await rings(page)) break;
    const b = await pieceBox(page);
    if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    if (await poll(() => rings(page), 2500, 100)) break;
  }
  return poll(() => out(page), 6000, 150);
}
const away = (page) => poll(async () => !(await page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"]'))), 3000, 100);
// A setting tapped where its name is (on the wedge under it).
async function tapSetting(page, key, touch = true) {
  const b = await page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
  if (!b) return false;
  if (touch) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  return true;
}
// A setting's choices out in the read-out: its name tapped once Rings is
// still (again if the tap found it turning).
async function choicesOf(page, key, touch = true) {
  for (let i = 0; i < 3; i++) {
    await poll(() => out(page), 4000, 100);
    if (!(await tapSetting(page, key, touch))) continue;
    const ok = await poll(async () => { const r = await rings(page); return !!r && r.focus === key && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-ctl"] [data-mf-choice]').count()) > 0; }, 3000, 100);
    if (ok) return true;
  }
  return false;
}
const SETUP = ["first", "opponent", "level", "start", "pieces", "cart", "check", "points", "costs", "guide", "sound", "language", "replay", "saves", "bar"];

console.log("The store, on a phone: Rings is the menu");
{
  const { ctx, page, errs } = await store();
  let r = await openRings(page);
  check("a tap on the piece: Rings out round it, not the panel", !!r && r.fan === "rings" && r.version === "4.2" && r.phase === "setup" && !(await panelOpen(page)), JSON.stringify(r));
  check("...every setting the panel has before a game", !!r && SETUP.every((k) => r.keys.includes(k)), r && r.keys.join());
  check("...Try a Game over it, the first move at its point, named and said", !!r && /try a game/i.test(r.primary || "") && r.focus === "first" && /First move/i.test(r.read) && /Which side makes the first move/.test(r.read), JSON.stringify(r));
  // Level: its choices, Medium.
  check("a tap on Level: turned to it, its choices in the read-out", (await choicesOf(page, "level")) && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-ctl"] [data-mf-choice]').count()) === 3);
  const medium = await page.locator('[data-testid="dock-menu"] [data-mf-choice="medium"]').boundingBox();
  await page.touchscreen.tap(medium.x + medium.width / 2, medium.y + medium.height / 2);
  check("...Medium chosen is the panel's Medium, Rings still out", !!(await poll(() => page.evaluate(() => document.querySelector('[data-ec-diff="medium"]').getAttribute("aria-pressed") === "true"), 3000, 100)) && !!(await rings(page)));
  // A tap outside puts it away; the piece back where it rests.
  await page.touchscreen.tap(12, 300);
  check("a tap outside puts it away", !!(await away(page)));
  check("...the piece back where it rests", !!(await poll(() => page.evaluate(() => document.querySelector("[data-dock-piece]").style.transform === "translateX(-50%) scale(1)"), 3000, 100)));
  await page.waitForTimeout(800);
  // Online: its own page is the panel's.
  r = await openRings(page);
  await choicesOf(page, "opponent");
  const on = await page.locator('[data-testid="dock-menu"] [data-mf-choice="online"]').boundingBox();
  await page.touchscreen.tap(on.x + on.width / 2, on.y + on.height / 2);
  check("Opponent, Online: Rings away, the panel open on Online's own page", !!(await poll(async () => (await panelOpen(page)) && !(await rings(page)), 5000, 100)));
  await page.touchscreen.tap(12, 300);
  await poll(async () => !(await panelOpen(page)), 4000, 100);
  await page.waitForTimeout(800);
  // Online's page left in the panel: Rings still has who to play, and
  // takes the player back to the computer from there.
  r = await openRings(page);
  const opp = await choicesOf(page, "opponent");
  check("...put away, Rings still has the opponent, Online's page left in the panel", opp && !!(await page.evaluate(() => !!document.querySelector('[data-testid="online-panel"]'))), JSON.stringify(await rings(page)));
  const ai = opp && (await page.locator('[data-testid="dock-menu"] [data-mf-choice="ai-dark"]').boundingBox());
  if (ai) await page.touchscreen.tap(ai.x + ai.width / 2, ai.y + ai.height / 2);
  check("...the computer picked from Rings: Online's page gone, the computer's levels in the panel, Rings says so", !!ai && !!(await poll(async () => (await page.evaluate(() => !document.querySelector('[data-testid="online-panel"]') && !!document.querySelector("[data-ec-diff]"))) && /AI · /.test((await rings(page) || {}).read || ""), 4000, 100)), JSON.stringify(await rings(page)));
  await page.waitForTimeout(800);
  if (!(await rings(page))) r = await openRings(page);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').tap();
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Try a Game from Rings: the game begun, the piece in its corner, Rings away", !!corner && !(await rings(page)) && (await page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)")), JSON.stringify(corner));
  await page.waitForTimeout(1500);
  // In play: the corner piece; a touch held on it.
  const cdp = await ctx.newCDPSession(page);
  const cb = await pieceBox(page);
  const at = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
  await page.waitForTimeout(1300);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  r = await poll(() => out(page), 6000, 150);
  check("in play, a touch held on the corner piece: Rings out (the piece brought to the middle), and its lifting doesn't put it away", !!r && r.phase === "play" && (await page.evaluate(() => /translate\(calc\(-50% \+ 0px\)/.test(document.querySelector("[data-dock-piece]").style.transform) || document.querySelector("[data-dock-piece]").style.left !== "calc(100% - 108px)")), JSON.stringify(r));
  await page.waitForTimeout(1200);
  check("...still out a moment on", !!(await rings(page)));
  check("...in play's own: End game, the view, the hints, whose move on top", !!r && ["endgame", "view", "check", "language"].every((k) => r.keys.includes(k)) && !r.keys.includes("first") && /to move/i.test(r.head), JSON.stringify(r));
  await page.touchscreen.tap(12, 300);
  await away(page);
  await page.waitForTimeout(1000);
  // End game, twice.
  r = await openRings(page);
  if (r && r.focus !== "endgame") { await tapSetting(page, "endgame"); await poll(() => out(page), 3000, 150); }
  await tapSetting(page, "endgame");
  check("End game asks first", !!(await poll(async () => /again to be sure/i.test((await rings(page)).read), 3000, 100)));
  await tapSetting(page, "endgame");
  check("...the second tap ends it, Rings away", !!(await poll(async () => !(await rings(page)) && (await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))), 6000, 100)));
  await page.waitForTimeout(2500);
  // After: the call answered.
  check("after the game, the corner piece calls", await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall === "true"));
  r = await openRings(page);
  const ng = await page.evaluate(() => document.querySelector('[data-testid="new-game"]').textContent.replace(/[^a-z]/gi, "").toLowerCase());
  check("...Rings out from it: New game over it (the store's own words), who to play next, the call answered", !!r && r.phase === "over" && !!r.primary && r.primary.replace(/[^a-z]/gi, "").toLowerCase() === ng && r.keys.includes("opponent") && (await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall !== "true")), JSON.stringify(r));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("A new player's first look");
{
  const { ctx, page, errs } = await store({ toured: false });
  const r = await openRings(page);
  const held = (k) => page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-item="${k}"]`); return n ? n.getAttribute("aria-disabled") === "true" : null; }, k);
  check("Rings out, Try a Game and See the pieces pressable", !!r && (await held("pieces")) === false && /try a game/i.test(r.primary || ""));
  check("...the level and the cart held back, as in the panel", (await held("level")) === true && (await held("cart")) === true);
  await tapSetting(page, "level");
  check("...a tap on the level: not now, said so, nothing changed", !!(await poll(async () => /Not available right now/.test((await rings(page)).read), 3000, 100)) && (await page.evaluate(() => document.querySelector('[data-ec-diff="easy"]').getAttribute("aria-pressed") === "true")));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Noir, on a desktop");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(NOIR);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  let r = await openRings(page, false);
  check("a click on the piece: Rings out", !!r && r.fan === "rings" && !(await panelOpen(page)), JSON.stringify(r));
  const f0 = r && r.focus;
  await page.mouse.move(640, 560);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 70); await page.waitForTimeout(60); }
  r = await poll(async () => { const x = await out(page); return x && x.focus !== f0 ? x : null; }, 4000, 150);
  check("...the mouse wheel turns it on", !!r, JSON.stringify(r));
  await page.keyboard.press("Escape");
  check("Escape puts it away", !!(await away(page)));
  await page.waitForTimeout(800);
  // Begin from Rings (its primary), then the mouse onto the corner piece.
  r = await openRings(page, false);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').click();
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Begin Game from Rings: the piece in its corner", !!corner);
  await page.waitForTimeout(1200);
  if (corner) {
    await page.mouse.move(corner.x + corner.width / 2 + 60, corner.y + corner.height / 2 + 60);
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2, { steps: 4 });
  }
  r = await poll(() => out(page), 5000, 150);
  check("...the mouse brought onto the corner piece: Rings out, in play", !!r && r.phase === "play", JSON.stringify(r));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
