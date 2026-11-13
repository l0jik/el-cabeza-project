/* Leave game, the game kept, and Back (apps/unified.jsx GAME_KEY,
   LeaveAsk; chassis/menu-fan.js; user: "Need a way to close the app,
   right? ... What are some good options?", and of them: "go with your
   suggestion on the leave game ... with the back gesture ... Yeah, I like
   that.").

   Nova after the story, in the den, a game begun and a step made:
   - More's list ends with End game, then Leave game;
   - Leave game: the game kept (el-cabeza:game:standard), the page on the
     title screen, its first choice Continue in the den; Continue: the
     same position, the same side to move, the game still on;
   - Back: asked (Leave El Cabeza?, the game said to be kept); Keep
     playing: the question gone, Back's step put back; Back, then Back
     again: the page gone (the app closed), the game kept as it was;
   - the page out of sight (a phone's own close, another app): the game
     kept as it is now; the game over and the page out of sight: nothing
     kept;
   - on a phone, the question's buttons a thumb's size.

   node tests/e2e-leave.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
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

// A player who's been through the story (owned, ended), on the den.
async function open(viewport, touch = false) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      if (!sessionStorage.getItem("ec-set")) {
        sessionStorage.setItem("ec-set", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true }));
        localStorage.setItem("el-cabeza:singularity-seen", "1");
        localStorage.setItem("el-cabeza:commercial-aired", "1");
        localStorage.setItem("el-cabeza:first-game-tour", "done");
        localStorage.setItem("el-cabeza:last-world", "den");
      }
    } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("about:blank");
  await page.goto(`${NOVA}?world=standard`);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 120000 });
  return { ctx, page, errs };
}
const armed = (page) => page.evaluate(() => window.__EC_TEST_ARMED__ === true);
// A game begun (the gate's Standard Cabeza, or Begin) and a step made.
async function begin(page) {
  await poll(async () => (await page.locator('[data-testid="gate-standard"]').count()) > 0 || (await armed(page)), 20000);
  if (await page.locator('[data-testid="gate-standard"]').count()) await page.locator('[data-testid="gate-standard"]').click();
  if (!(await poll(() => armed(page), 6000))) {
    await openDockPanel(page);
    await page.locator("button", { hasText: /Begin Game|Set them up/i }).first().click();
  }
  await poll(() => armed(page), 10000);
  await page.mouse.move(4, 400);
  await page.waitForTimeout(1500);
}
const board = (page) => page.evaluate(() => ({ pieces: window.__EC_TEST_PIECES__.map((p) => `${p.id}@${p.row},${p.col},${p.z}`).sort().join(" "), toMove: window.__EC_TEST_TO_MOVE__() }));
async function step(page) {
  const before = await board(page);
  const side = before.toMove;
  const ok = await page.evaluate((s) => window.__EC_TEST_MOVE__(`${s}-turrito`, s === "dark" ? "S" : "N"), side);
  await poll(async () => (await board(page)).pieces !== before.pieces, 15000);
  await page.waitForTimeout(800);
  return ok;
}
const kept = (page) => page.evaluate(() => { const r = JSON.parse(localStorage.getItem("el-cabeza:game:standard") || "null"); return r ? r.game.pieces.map((p) => `${p.id}@${p.row},${p.col},${p.z}`).sort().join(" ") : null; });
const asked = (page) => page.evaluate(() => { const d = document.querySelector('[data-testid="leave-ask"]'); return d ? d.innerText : null; });
// The dock's menu out from the corner piece, and More's list.
async function moreList(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"] g[data-ml-item="more"]'))) break;
    const b = await page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1200);
  }
  const at = await poll(() => page.evaluate(() => { const n = document.querySelector('[data-testid="dock-menu"] [data-ml-label="more"]'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }), 6000);
  if (!at) return null;
  await page.mouse.click(at.x, at.y);
  return poll(() => page.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="menu-fan-list"] [data-mf-row]')].map((b) => b.getAttribute("data-mf-row")); return rows.length ? rows : null; }), 6000);
}
const hide = (page) => page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

console.log("Nova after the story, the den, on a desktop: Leave game");
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  await begin(page);
  check("a game begun", await armed(page));
  check("...a step made", await step(page));
  const was = await board(page);
  const rows = await moreList(page);
  check("More's list ends with End game, then Leave game", !!rows && rows[rows.length - 1] === "leave" && rows[rows.length - 2] === "endgame", JSON.stringify(rows));
  await page.evaluate(() => { const b = document.querySelector('[data-testid="menu-fan-list"] [data-mf-about-b="leave"]'); if (b) b.click(); });
  const about = await poll(() => page.evaluate(() => { const n = document.querySelector('[data-mf-about="leave"]'); return n && n.textContent; }), 3000);
  check("...its icon says what it does: the game kept, Continue", !!about && /title screen/.test(about) && /Continue/.test(about), about);
  await page.locator('[data-testid="menu-fan-list"] [data-mf-row="leave"]').click();
  const title = await poll(async () => (await page.locator('[data-testid="title-primary"]').count()) > 0, 30000);
  check("Leave game: the title screen", !!title, page.url());
  check("...the game kept, as it was", (await kept(page)) === was.pieces, JSON.stringify({ kept: await kept(page), was: was.pieces }));
  await page.waitForFunction(() => !!document.querySelector(".ec-splash.menu-on"), null, { timeout: 60000 }).catch(() => null);
  const word = await page.evaluate(() => { const b = document.querySelector('[data-testid="title-primary"]'); return b ? b.innerText.replace(/\s+/g, " ").trim() : ""; });
  check(`...its first choice, Continue in the den ("${word}")`, /continue/i.test(word) && /den/i.test(word), word);
  await page.locator('[data-testid="title-primary"]').click();
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 120000 });
  const back = await poll(async () => { const b = await board(page); return b.pieces === was.pieces ? b : null; }, 20000);
  check("Continue: the same position, the same side to move, the game still on", !!back && back.toMove === was.toMove && (await armed(page)), JSON.stringify({ back, was }));
  await page.waitForTimeout(1500);

  // Back: asked; Keep playing; Back, Back again: gone.
  await page.goBack().catch(() => null);
  const q = await poll(() => asked(page), 6000);
  check("Back: asked, Leave El Cabeza?, the game said to be kept", !!q && /Leave El Cabeza\?/.test(q) && /kept/.test(q) && /Back again/.test(q), q);
  await page.locator('[data-testid="leave-stay"]').click();
  const stayed = await poll(async () => (await asked(page)) === null && (await page.evaluate(() => !!(history.state && history.state.ecGuard))), 4000);
  check("...Keep playing: the question gone, Back's step put back", !!stayed);
  await step(page);
  const now = await board(page);
  await page.goBack().catch(() => null);
  check("Back again: asked again", !!(await poll(() => asked(page), 6000)));
  await page.goBack().catch(() => null);
  const gone = await poll(async () => page.url() === "about:blank", 10000);
  check("...and Back once more: the page gone (the app closed)", !!gone, page.url());
  await page.goto(`${NOVA}?world=standard`);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 120000 });
  const again = await poll(async () => { const b = await board(page); return b.pieces === now.pieces ? b : null; }, 20000);
  check("...opened again: the game as it was left, still on", !!again && (await armed(page)), JSON.stringify({ again, now: now.pieces }));
  await page.waitForTimeout(1200);

  // Out of sight: kept as it is now; over, and out of sight: nothing kept.
  await step(page);
  const later = await board(page);
  await hide(page);
  check("the page out of sight (another app, a phone's own close): the game kept as it is now", (await kept(page)) === later.pieces);
  await openDockPanel(page);
  await page.locator('[data-testid="end-game"]').first().click();
  await poll(async () => !(await page.evaluate(() => window.__EC_TEST_PIECES__ && document.querySelector('[data-testid="end-game"]'))), 6000);
  await page.waitForTimeout(800);
  await hide(page);
  check("...the game over, and out of sight: nothing kept", (await kept(page)) === null, await kept(page));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("On a phone: the question at Back");
{
  const { ctx, page, errs } = await open({ width: 390, height: 844 }, true);
  await begin(page);
  await page.goBack().catch(() => null);
  const q = await poll(() => asked(page), 6000);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-testid="leave-ask"] button')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, in: r.left >= 0 && r.right <= innerWidth }; }));
  check("asked at Back, its two buttons a thumb's size, on the screen", !!q && sizes.length === 2 && sizes.every((s) => s.h >= 44 && s.w >= 44 && s.in), JSON.stringify(sizes));
  await page.locator('[data-testid="leave-go"]').tap();
  check("...Leave game: the title screen", !!(await poll(async () => (await page.locator('[data-testid="title-primary"]').count()) > 0, 30000)));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
