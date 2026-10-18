/* Where the pieces are wood (theme.woodPieces: the den, the store), a
   slide tips nothing and nothing comes down, so it never
   makes a roll's start or a landing's knock: the Cabeza's moves, which
   only ever slide (user: "Cabeza pieces should not have a tap or falling
   tone, as they are only slid ... Anytime like there is a wood tone on a
   Cabeza being moved, that needs to be removed"), and a block slid under
   the Slide laws (user: "make slid blocks glide quietly too"; the
   chassis's slides). They ask the world for a slide (playSlide), which the
   den and the store play as a glide over the lacquer. Every other world
   keeps its own sounds for every move, a start and a landing, the
   Cabeza's too (user: "I do not want all worlds to have the exact same
   piece noises, only the ones that use the wooden pieces"): the City,
   Futuris, the Lab here, and Parrish, though its pieces are the wooden set
   (user: "Parrish should keep its own sounds"): there every move, the
   Cabeza's steps and a slid block's too, is heard landing on its note. A
   roll starts and lands everywhere.

   Each world, with Orthogonal slide and 3 actions: Dark's Turrito rolls
   once and slides once (its turn), the other side's turn (its Cabeza
   steps three times, or the store's computer plays), then Dark's Cabeza
   steps three times; the sounds the chassis asked for, piece by piece
   (window.__EC_TEST_MOVE_SOUNDS__), and in the den, the store and Parrish
   the landings played (window.__EC_TEST_LANDINGS__: the wood's knocks,
   Parrish's notes).

   node tests/e2e-slide-sounds.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 10000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

const POSITION = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 6, w: 1, h: 1, z: 1 },
];
// (world, its page, its pieces wood (quiet slides), whether it has a slide
// sound, whether its landings are counted (window.__EC_TEST_LANDINGS__),
// whether the other side is the computer (the store's test game))
const WORLDS = [
  ["the den", "standard", true, true, true, false],
  ["the store", "tienda", true, true, true, true],
  ["Parrish", "parrish?look=orinoco", false, false, true, false],
  ["the City", "ciudad", false, false, false, false],
  ["Futuris", "futuris", false, false, false, false],
  ["the Lab", "lab", false, false, false, false],
];

for (const [name, page0, quiet, hasSlide, counted, computer] of WORLDS) {
  console.log(name);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 } });
  // (The store's sides as they were, Walnut opening, against the computer's
  // Ash: a new player's are the other way round, and Walnut moves here first.)
  await ctx.addInitScript((store) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { slide: true, threeActions: true }; window.__EC_TEST_MOVE_SOUNDS__ = []; window.__EC_TEST_LANDINGS__ = []; try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); if (store) localStorage.setItem("el-cabeza:opponent", JSON.stringify({ aiPlayer: "light", aiDifficulty: "easy", humanStartSide: "dark" })); } } catch (e) { /* none */ } }, page0 === "tienda");
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const [file, q] = page0.split("?");
  await page.goto(`${D}/el-cabeza-${file}.html${q ? "?" + q : ""}`);
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
  // (20 s a step: Parrish, the heaviest page, took more than 10 on a
  // loaded runner, CI run 57, its sounds all there)
  const step = async (id, dir, row, ms = 20000) => {
    await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
    const ok = await poll(async () => { const q = await at(id); return q && q.row === row; }, ms);
    await page.waitForTimeout(700);
    return !!ok;
  };
  const asked = (id) => page.evaluate((i) => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.id === i), id);
  const knocks = () => page.evaluate(() => window.__EC_TEST_LANDINGS__.length);

  // Dark's turn: its Turrito rolls once (a roll's start, a landing), then
  // slides once (wood: a slide, nothing more; elsewhere a start and a
  // landing, as any move).
  const k0 = counted ? await knocks() : 0;
  const tur = (await step("dark-turrito", "S", 4)) && (await step("dark-turrito", "slide-S", 5));
  const turAsked = await asked("dark-turrito");
  if (quiet) {
    check("a Turrito's roll starts and lands; its slide only glides", tur && turAsked.map((e) => e.kind).join(",") === "rollStart,landing,slide", JSON.stringify(turAsked));
    check(hasSlide ? "...the world's slide played" : "...no slide here: silent", turAsked.filter((e) => e.kind === "slide").every((e) => e.played === hasSlide), JSON.stringify(turAsked));
    if (counted) check("...one knock of wood, the roll's", (await knocks()) - k0 === 1, `${k0} -> ${await knocks()}`);
  } else {
    check("not wood: a Turrito's roll and its slide each start and land, as before", tur && turAsked.map((e) => e.kind).join(",") === "rollStart,landing,rollStart,landing", JSON.stringify(turAsked));
    if (counted) check("...both heard landing, the roll and the slide", (await knocks()) - k0 === 2, `${k0} -> ${await knocks()}`);
  }
  // The other side's turn: its Cabeza steps three times (both players at
  // the board), or the computer plays (the store's opponent). (A heavy
  // world's step can take more than 4 s here: each gets its 20.)
  const lightCab = !computer && (await step("light-cabeza", "N", 8)) && (await step("light-cabeza", "N", 7)) && (await step("light-cabeza", "N", 6));
  if (!lightCab) await poll(async () => (await turns()) >= 2, 30000, 300);
  await page.waitForTimeout(800);
  // Dark's turn again: its Cabeza steps three times.
  const k1 = counted ? await knocks() : 0;
  const n1 = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__.length);
  const cab = (await step("dark-cabeza", "S", 1)) && (await step("dark-cabeza", "S", 2)) && (await step("dark-cabeza", "S", 3));
  const cabAsked = await asked("dark-cabeza");
  console.log("   asked:", JSON.stringify(await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__)));
  check("the Cabeza stepped three times", cab);
  const anyCab = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.type === "cabeza"));
  if (quiet) {
    check("...each step a slide, nothing else (no roll's start, no landing)", cabAsked.length === 3 && cabAsked.every((e) => e.kind === "slide"), JSON.stringify(cabAsked));
    check(hasSlide ? "...the world's slide played" : "...no slide here: silent", cabAsked.every((e) => e.played === hasSlide), JSON.stringify(cabAsked));
    // (Against the computer its turn comes round as the Cabeza's ends, and
    // its first roll can knock before this looks, CI run 64: the knocks
    // counted are those beyond its own landings, each noted as it's played,
    // read together.)
    if (counted) {
      const w = await page.evaluate((n) => ({ knocks: window.__EC_TEST_LANDINGS__.length, theirs: window.__EC_TEST_MOVE_SOUNDS__.slice(n).filter((e) => e.kind === "landing" && e.id !== "dark-cabeza").length }), n1);
      check("...and not one knock of wood", w.knocks - k1 === w.theirs, `${k1} -> ${w.knocks}, the computer's landings since ${w.theirs}`);
    }
    check(`every Cabeza move in the game a slide (${anyCab.length}, either side's)`, anyCab.length >= 3 && anyCab.every((e) => e.kind === "slide"), JSON.stringify(anyCab));
    const anySlid = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__.filter((e) => e.kind === "landing"));
    check("no landing in the game but the roll's (and the computer's rolls)", anySlid.every((e) => e.type !== "cabeza"), JSON.stringify(anySlid));
  } else {
    check("not wood: each step the world's own start and landing, as before", cabAsked.map((e) => e.kind).join(",") === "rollStart,landing,rollStart,landing,rollStart,landing", JSON.stringify(cabAsked));
    if (counted) check("...each step heard landing", (await knocks()) - k1 === 3, `${k1} -> ${await knocks()}`);
    check(`...every Cabeza move in the game a start and a landing (${anyCab.length}, either side's)`, anyCab.length >= 6 && !anyCab.some((e) => e.kind === "slide"), JSON.stringify(anyCab));
  }
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
