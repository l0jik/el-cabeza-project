/* A slide tips nothing and nothing comes down, so it never makes a roll's
   start or a landing's knock: the Cabeza's moves, which only ever slide
   (user: "Cabeza pieces should not have a tap or falling tone, as they are
   only slid ... Anytime like there is a wood tone on a Cabeza being moved,
   that needs to be removed"), and a block slid under the Slide laws (user:
   "make slid blocks glide quietly too"; the chassis's slides). They ask
   the world for a slide (playSlide), which the den and the store play as
   a glide over the lacquer and the City as its own; Neon and the Lab have
   none, so they're silent there. A roll still starts and lands as before.

   Each world, with Orthogonal slide and 3 actions: Dark's Turrito rolls
   once and slides once (its turn), the other side's turn (its Cabeza
   steps three times, or the store's computer plays), then Dark's Cabeza
   steps three times; the sounds the chassis asked for, piece by piece
   (window.__EC_TEST_MOVE_SOUNDS__), and in the wood worlds the knocks
   played (window.__EC_TEST_LANDINGS__).

   node tests/e2e-slide-sounds.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 10000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

const POSITION = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 6, w: 1, h: 1, z: 1 },
];
// (world, its page, whether it has a slide sound, whether its knocks are the wood's)
const WORLDS = [
  ["the den", "standard", true, true],
  ["the store", "tienda", true, true],
  ["the City", "ciudad", true, false],
  ["Neon", "neon", false, false],
  ["the Lab", "lab", false, false],
];

for (const [name, page0, hasSlide, wood] of WORLDS) {
  console.log(name);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { slide: true, threeActions: true }; window.__EC_TEST_MOVE_SOUNDS__ = []; window.__EC_TEST_LANDINGS__ = []; try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); } } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${D}/el-cabeza-${page0}.html`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__), 30000, 250);
  await page.waitForTimeout(page0 === "tienda" ? 4000 : 1500);
  if (page0 === "tienda") { await page.locator("button", { hasText: /open the box/i }).first().click(); await page.waitForTimeout(5000); }
  await openDockPanel(page);
  const human = page.locator('[data-opponent="human"]').first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /begin|try a game/i }).first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__EC_TEST_MOVE_SOUNDS__.length = 0; window.__EC_TEST_LANDINGS__.length = 0; });

  const at = (id) => page.evaluate((i) => (window.__EC_TEST_PIECES__ || []).find((q) => q.id === i) || null, id);
  const turns = () => page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length);
  const step = async (id, dir, row, ms = 10000) => {
    await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
    const ok = await poll(async () => { const q = await at(id); return q && q.row === row; }, ms);
    await page.waitForTimeout(700);
    return !!ok;
  };
  const asked = (id) => page.evaluate((i) => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.id === i), id);
  const knocks = () => page.evaluate(() => window.__EC_TEST_LANDINGS__.length);

  // Dark's turn: its Turrito rolls once (a roll's start, a landing), then
  // slides once (a slide, nothing more).
  const k0 = wood ? await knocks() : 0;
  const tur = (await step("dark-turrito", "S", 4)) && (await step("dark-turrito", "slide-S", 5));
  const turAsked = await asked("dark-turrito");
  check("a Turrito's roll starts and lands as before; its slide only glides", tur && turAsked.map((e) => e.kind).join(",") === "rollStart,landing,slide", JSON.stringify(turAsked));
  check(hasSlide ? "...the world's slide played" : "...no slide here: silent", turAsked.filter((e) => e.kind === "slide").every((e) => e.played === hasSlide), JSON.stringify(turAsked));
  if (wood) check("...one knock of wood, the roll's", (await knocks()) - k0 === 1, `${k0} -> ${await knocks()}`);
  // The other side's turn: its Cabeza steps three times (both players at
  // the board), or the computer plays (the store's opponent).
  const lightCab = (await step("light-cabeza", "N", 8, 4000)) && (await step("light-cabeza", "N", 7)) && (await step("light-cabeza", "N", 6));
  if (!lightCab) await poll(async () => (await turns()) >= 2, 30000, 300);
  await page.waitForTimeout(800);
  // Dark's turn again: its Cabeza steps three times.
  const k1 = wood ? await knocks() : 0;
  const cab = (await step("dark-cabeza", "S", 1)) && (await step("dark-cabeza", "S", 2)) && (await step("dark-cabeza", "S", 3));
  const cabAsked = await asked("dark-cabeza");
  console.log("   asked:", JSON.stringify(await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__)));
  check("the Cabeza stepped three times", cab);
  check("...each step a slide, nothing else (no roll's start, no landing)", cabAsked.length === 3 && cabAsked.every((e) => e.kind === "slide"), JSON.stringify(cabAsked));
  check(hasSlide ? "...the world's slide played" : "...no slide here: silent", cabAsked.every((e) => e.played === hasSlide), JSON.stringify(cabAsked));
  if (wood) check("...and not one knock of wood", (await knocks()) === k1, `${k1} -> ${await knocks()}`);
  const anyCab = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.type === "cabeza"));
  check(`every Cabeza move in the game a slide (${anyCab.length}, either side's)`, anyCab.length >= 3 && anyCab.every((e) => e.kind === "slide"), JSON.stringify(anyCab));
  const anySlid = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.kind === "landing"));
  check("no landing in the game but the roll's (and the computer's rolls)", anySlid.every((e) => e.type !== "cabeza"), JSON.stringify(anySlid));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
