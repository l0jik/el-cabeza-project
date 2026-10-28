/* The result said to you (user, a Cromo win as Chrome: "Since I won and I
   was Chrome, it should say you win, not Chrome wins. And I probably need
   to propagate this throughout the rest of the game globally.").

   - Against the computer, a win: the placard "YOU WIN" (whom you beat
     under it), the status line "You win · ...", the copied move log
     "Result: you win, as <your side>".
   - Against the computer, a loss: "YOU LOSE", "To the ... AI" under it,
     "You lose · ...".
   - The Lab's read-out says "You win" too.
   - Two players at one screen: the winner's name, as ever ("... WINS").
   - In Spanish: "GANASTE".

   node tests/e2e-you-win.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? " — " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const T = (id, owner, row, col) => ({ id, type: "turrito", owner, row, col, w: 1, h: 1, z: 1 });
const CAB = (id, owner, row, col) => ({ id, type: "cabeza", owner, row, col, w: 1, h: 1, z: 1 });

async function open(url, seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__ && !!window.__EC_TEST_SET_PIECES__), 30000, 250);
  await page.waitForTimeout(2000);
  return { ctx, page, errs };
}
// A game against the computer (it plays Light, you Dark and first) or
// between two people, begun.
async function begin(page, opponent) {
  await openDockPanel(page);
  const pick = page.locator(`[data-opponent="${opponent}"]`).first();
  if ((await pick.getAttribute("aria-pressed")) !== "true") await pick.click();
  await page.waitForTimeout(500);
  await page.locator('[data-dock-role="begin"]').first().click();
  const armed = await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000, 250);
  await page.waitForTimeout(1500);
  return !!armed;
}
const placardUp = (page) => poll(async () => (await page.locator('[data-testid="victory-backdrop"]').getAttribute("data-open")) === "true", 3000);
// The side to move (Dark, against the computer) has its Cabeza a step from
// its far row and steps there (asked again till it's made: a move asked
// while the board's still busy is dropped).
async function winNow(page) {
  const dark = (await page.locator('[data-testid="turn-status"]').first().getAttribute("data-side")) === "dark";
  const id = dark ? "dark-cabeza" : "light-cabeza", row = dark ? 8 : 1, dir = dark ? "S" : "N";
  await page.evaluate((l) => window.__EC_TEST_SET_PIECES__(l), [CAB("dark-cabeza", "dark", dark ? 8 : 4, 4), T("dark-turrito", "dark", 0, 0), CAB("light-cabeza", "light", dark ? 5 : 1, 6), T("light-turrito", "light", 9, 9)]);
  await poll(() => page.evaluate(([id, row]) => (window.__EC_TEST_PIECES__ || []).some((p) => p.id === id && p.row === row), [id, row]), 10000, 100);
  const end = Date.now() + 24000;
  while (Date.now() < end) {
    await page.evaluate(([id, dir]) => window.__EC_TEST_MOVE__(id, dir), [id, dir]);
    if (await placardUp(page)) return true;
  }
  return false;
}
const read = (page) => page.evaluate(() => ({
  title: (document.querySelector('[data-testid="victory-placard"] h2') || {}).textContent || "",
  foe: (document.querySelector('[data-testid="victory-foe"]') || {}).textContent || "",
  status: (document.querySelector('[data-testid="turn-status"]') || {}).textContent || "",
}));

console.log("Futuris, against the computer: a win");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-futuris.html`, { "el-cabeza:check-alert": "0" });
  check("a game against the computer begun", await begin(page, "ai-light"));
  check("your Cabeza home: the placard", await winNow(page));
  const r = await read(page);
  check(`it says YOU WIN, not the side's name (${JSON.stringify(r.title)})`, r.title.trim() === "YOU WIN", JSON.stringify(r));
  check(`...whom you beat under it (${JSON.stringify(r.foe)})`, /^Against the \w+ AI$/.test(r.foe.trim()));
  check(`...the status line too (${JSON.stringify(r.status)})`, /^You win · /.test(r.status.trim()) && !/wins/i.test(r.status));
  await page.locator('[data-testid="victory-placard"] button', { hasText: /^Move Log$/i }).first().click();
  await page.waitForTimeout(700);
  await page.locator('[data-testid="movelog-sheet"] button', { hasText: /Copy Move[ _]?Log/i }).first().click();
  const copied = await poll(() => page.evaluate(() => window.__EC_TEST_COPIED__ || ""), 4000);
  const head = (copied || "").split("\n")[0];
  check(`the copied log: yours, and which side you were (${JSON.stringify(head)})`, /^Result: you win, as \S.* — .*, against the \w+ AI$/.test(head));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Futuris, against the computer: a loss");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-futuris.html`, { "el-cabeza:check-alert": "0" });
  check("a game against the computer begun", await begin(page, "ai-light"));
  // (The computer's Cabeza a step from home: once your turn's over, it walks in.)
  await page.evaluate((l) => window.__EC_TEST_SET_PIECES__(l), [T("light-turrito", "light", 4, 4), CAB("dark-cabeza", "dark", 4, 8), T("dark-turrito", "dark", 8, 1), CAB("light-cabeza", "light", 1, 8)]);
  await page.waitForTimeout(600);
  const at = () => page.evaluate(() => { const c = window.__EC_TEST_PIECES__.find((p) => p.id === "dark-cabeza"); return c ? `${c.row},${c.col}` : null; });
  for (const to of ["4,7", "4,6"]) { await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "W")); await poll(async () => (await at()) === to, 8000); }
  check("your turn over: the computer wins", !!(await poll(() => placardUp(page), 30000, 300)));
  const r = await read(page);
  check(`it says YOU LOSE (${JSON.stringify(r.title)})`, r.title.trim() === "YOU LOSE", JSON.stringify(r));
  check(`...to whom (${JSON.stringify(r.foe)})`, /^To the \w+ AI$/.test(r.foe.trim()));
  check(`...the status line too (${JSON.stringify(r.status)})`, /^You lose · /.test(r.status.trim()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The Lab (Swiss), against the computer: its read-out");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-lab.html?theme=swiss`, { "el-cabeza:check-alert": "0" });
  check("a game against the computer begun", await begin(page, "ai-light"));
  check("a win: the placard", await winNow(page));
  const over = await poll(() => page.evaluate(() => { const o = document.querySelector('[data-testid="lab-hud"][data-status="finished"] .lab-over'); return o ? o.textContent : null; }), 4000);
  check(`the read-out says You win (${JSON.stringify(over)})`, /^You win/.test(over || "") && !/wins/i.test(over || ""));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Futuris, two people at one screen: the winner's name");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-futuris.html`);
  check("a game between two people begun", await begin(page, "human"));
  check("a Cabeza home: the placard", await winNow(page));
  const r = await read(page);
  check(`it names the side that won (${JSON.stringify(r.title)})`, /^\S.* WINS$/.test(r.title.trim()) && !/YOU/.test(r.title), JSON.stringify(r));
  check("...and no AI under it", r.foe === "");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Futuris in Spanish, against the computer");
{
  const { ctx, page, errs } = await open(`${D}/el-cabeza-futuris.html?lang=es`, { "el-cabeza:check-alert": "0" });
  check("a game against the computer begun", await begin(page, "ai-light"));
  check("a win: the placard", await winNow(page));
  const r = await read(page);
  check(`it says GANASTE (${JSON.stringify(r.title)})`, r.title.trim() === "GANASTE", JSON.stringify(r));
  check(`...the status line too (${JSON.stringify(r.status)})`, /^Ganaste · /.test(r.status.trim()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
