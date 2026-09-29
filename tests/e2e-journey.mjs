/* The journey (engine/journey.js): the extras (pieces past the five, the
   laws, the board's holes and cut squares) are kept back until the
   Singularity's first visit, everywhere that opts in (Tienda, Standard,
   Neon, and Nova's store and den). Before it: the rules cards tell the
   classic game alone and there are no custom rules: the catalog's page
   of the five pieces, look only, with special orders "by arrangement".
   The sphere's first opening unlocks them everywhere (localStorage,
   shared by the site's pages); Nova's "Start the story over" locks them
   again. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const has = async (page, id) => (await q(page, id).count()) > 0;
const poll = async (fn, ms = 8000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return v; await new Promise((r) => setTimeout(r, step)); } };
const SEEN = "el-cabeza:singularity-seen";
const openRules = (page, tab) => page.evaluate((tab) => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab } })), tab);
const closeRules = async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(400); };

// What the rules cards show on this page.
async function rulesView(page) {
  await openRules(page, "moves");
  await page.waitForTimeout(500);
  const moves = {
    classic: await q(page, "rules-card-moves").getAttribute("data-classic"),
    roll: await has(page, "rules-tile-roll"),
    slide: await has(page, "rules-tile-slide"),
    pivot: await has(page, "rules-tile-cantileverPivot"),
    hole: await has(page, "rules-tile-blackHoleSquares"),
    shelter: await has(page, "rules-tile-shelter"),
  };
  await q(page, "rules-tab-costs").click();
  await page.waitForTimeout(300);
  const costs = await q(page, "rules-card-costs").innerText();
  await q(page, "rules-tab-about").click();
  await page.waitForTimeout(300);
  const about = await q(page, "info-original-note").innerText();
  await closeRules(page);
  return { moves, costsMentionLaws: /3 Actions|Pivot|Shove|Slide/.test(costs), aboutMentions: /ANOMALY|SINGULARITY/.test(about) };
}

async function page(url, init) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 850 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__TIENDA_MUSIC_ONLY__ = "none"; });
  if (init) await p.addInitScript(init);
  await p.goto(`file:///home/user/el-cabeza-project/dist/${url}`);
  await p.waitForTimeout(2500);
  return { p, ctx, errs };
}

{
  console.log("Tienda, before the Singularity");
  const { p, ctx, errs } = await page("el-cabeza-tienda.html");
  const r = await rulesView(p);
  check("MOVES tells the classic game: the roll, no laws, no shelter", r.moves.classic === "true" && r.moves.roll && !r.moves.slide && !r.moves.pivot && !r.moves.hole && !r.moves.shelter, JSON.stringify(r.moves));
  check("COSTS has no laws", !r.costsMentionLaws);
  check("ABOUT doesn't mention Anomaly or Singularity", !r.aboutMentions);
  // No custom rules before it: the lid's second button is the catalog's
  // page (look only), with special orders "by arrangement", faded.
  check("the lid offers See the pieces", /See the pieces/i.test(await q(p, "tienda-lid-order").innerText()));
  await q(p, "tienda-lid-order").click();
  check("...the catalog opens, not the order form", await poll(() => has(p, "tienda-catalog"), 8000) && !(await has(p, "tienda-order")));
  check("...the five pieces", (await has(p, "tienda-catalog-cabeza")) && (await has(p, "tienda-catalog-opa")) && !(await has(p, "tienda-catalog-codo")));
  check("...special orders by arrangement, not a link", (await q(p, "tienda-special-order").evaluate((e) => e.tagName)) === "DIV");
  check("...no purchase outside Nova's store", !(await has(p, "tienda-catalog-purchase")));
  check("...and no note that they're open", !(await has(p, "tienda-special-note")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

{
  console.log("Tienda and Standard, after it (the flag set, as the sphere sets it)");
  for (const url of ["el-cabeza-tienda.html", "el-cabeza-standard.html"]) {
    const { p, ctx, errs } = await page(url, () => { try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } });
    const r = await rulesView(p);
    check(`${url}: MOVES has the laws and the shelter`, r.moves.classic === "false" && r.moves.slide && r.moves.pivot && r.moves.hole && r.moves.shelter, JSON.stringify(r.moves));
    check(`${url}: ABOUT mentions them again`, r.aboutMentions);
    if (url === "el-cabeza-tienda.html") {
      check("the note that special orders are open", await has(p, "tienda-special-note"));
      check("...and the lid offers Custom rules", /Custom rules/i.test(await q(p, "tienda-lid-order").innerText()));
      await q(p, "tienda-lid-order").click();
      await poll(() => has(p, "tienda-order"), 8000);
      check("the whole order form", (await q(p, "tienda-order").getAttribute("data-classic")) === "false" && (await has(p, "tienda-piece-codo")) && (await has(p, "tienda-law-slide")));
    }
    check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
}

{
  console.log("Neon, before the sphere and after");
  const { p, ctx, errs } = await page("el-cabeza-neon.html");
  const r = await rulesView(p);
  check("before: the classic game", r.moves.classic === "true" && !r.moves.slide, JSON.stringify(r.moves));
  check("...not remembered as seen", (await p.evaluate((k) => localStorage.getItem(k), SEEN)) === null);
  // Into the sphere: Custom rules brings up the invite; its button starts it.
  await openDockPanel(p);
  await q(p, "custom-rules").click();
  await poll(() => p.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn")), 8000);
  const b = await p.locator(".ec-singularity-invite-btn").boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down(); await p.mouse.up();
  const phaseNow = () => p.evaluate(() => document.querySelector('[data-testid="singularity-overlay"]')?.dataset.singularityPhase || null);
  await poll(async () => (await phaseNow()) === "sphere", 40000, 400);
  const phase = await phaseNow();
  check("the sphere opens", phase === "sphere", String(phase));
  check("...and the journey is remembered", (await p.evaluate((k) => localStorage.getItem(k), SEEN)) === "1");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

{
  console.log("Nova: Start the story over locks them again");
  const { p, ctx, errs } = await page("el-cabeza-nova.html", () => {
    try { localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ }
  });
  await p.waitForTimeout(2000);
  const r = await rulesView(p);
  check("at home, after the Singularity: everything", r.moves.classic === "false" && r.moves.slide, JSON.stringify(r.moves));
  await openDockPanel(p);
  await q(p, "story-restart").click();
  check("Start the story over forgets it", await poll(async () => (await p.evaluate((k) => localStorage.getItem(k), SEEN)) === null, 8000));
  await poll(() => has(p, "tienda-lid"), 15000);
  const r2 = await rulesView(p);
  check("...the store: the classic game again", r2.moves.classic === "true" && !r2.moves.slide, JSON.stringify(r2.moves));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nJOURNEY E2E PASSED" : `\nJOURNEY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
