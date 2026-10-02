/* "Only a Codo, Rayo or Zeta can pivot" (themes/pivot-guide.js; user):
   the three pivot pieces sit together at the end of every pieces list,
   and turning Cantilever Pivot on with none of them ordered flashes the
   warning, jumps to them (over to the pieces panel where that's another
   one) and flashes them; a tap on the warning shows it again. Tienda's
   order form, the gate's sheet (Cromo), Lluvia's city panels. Neon's
   sphere: e2e-singularity.

   node tests/e2e-pivot-guide.mjs */
import { chromium } from "playwright";

const DIST = "file:///home/user/el-cabeza-project/dist/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 100) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const flashing = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && e.classList.contains("ec-guide-flash"); }, sel);
// The rows in order, by the prefix of their testids.
const order = (page, prefix) => page.evaluate((p) => [...document.querySelectorAll(`[data-testid^="${p}"]`)].map((e) => e.getAttribute("data-testid").slice(p.length)).filter((k) => /^[a-zA-Z0-9]+$/.test(k) && k !== "total"), prefix);
const PIVOTS = ["codo", "rayo", "zeta"];

async function show(page, { warn, row, label }) {
  check(`${label}: the warning flashes`, !!(await poll(() => flashing(page, warn), 1500, 50)));
  check(`${label}: then the Codo, Rayo and Zeta flash`, !!(await poll(async () => (await Promise.all(PIVOTS.map((k) => flashing(page, row(k))))).every(Boolean), 4000, 80)));
  const seen = await page.evaluate((sels) => sels.every((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }), PIVOTS.map(row));
  check(`${label}: ...on screen (jumped to)`, seen);
}

async function context(viewport, ended = true) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((ended) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      localStorage.setItem("el-cabeza:singularity-seen", "1");
      localStorage.setItem("el-cabeza:story", JSON.stringify(ended ? { owned: true, storeGone: true, ended: true } : { owned: true }));
      localStorage.setItem("el-cabeza:commercial-aired", "1"); localStorage.setItem("el-cabeza:special-order-noted", "1");
      localStorage.removeItem("el-cabeza:nova-setup");
    } catch (e) { /* none */ }
  }, ended);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return { ctx, page, errs };
}

console.log("Tienda's order form (phone)");
{
  const { ctx, page, errs } = await context({ width: 390, height: 844 });
  await page.goto(DIST + "el-cabeza-tienda.html");
  await poll(() => page.locator('[data-testid="tienda-lid-order"]').count(), 30000);
  await page.locator('[data-testid="tienda-lid-order"]').click();
  await poll(() => page.locator('[data-testid="tienda-order"]').count(), 8000);
  await page.waitForTimeout(800);
  const rows = await order(page, "tienda-piece-");
  check(`the pivot pieces together at the end (${rows.join(" ")})`, rows.slice(-3).join(",") === "codo,rayo,zeta" && rows.indexOf("arcoAncho") === rows.length - 4);
  await page.locator('[data-testid="tienda-law-cantileverPivot"]').click();
  await show(page, { label: "pivot on", warn: '[data-testid="law-warning-cantileverPivot"]', row: (k) => `[data-testid="tienda-piece-${k}"]` });
  await page.waitForTimeout(2200);
  await page.locator('[data-testid="law-warning-cantileverPivot"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="law-warning-cantileverPivot"]').click();
  await show(page, { label: "a tap on the warning", warn: '[data-testid="law-warning-cantileverPivot"]', row: (k) => `[data-testid="tienda-piece-${k}"]` });
  await page.locator('[data-testid="tienda-piece-codo-inc"]').click();
  check("a Codo ordered: no warning", (await page.locator('[data-testid="law-warning-cantileverPivot"]').count()) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nthe gate's sheet (Cromo, phone)");
{
  const { ctx, page, errs } = await context({ width: 390, height: 844 });
  await page.goto(DIST + "el-cabeza-cromo.html");
  await poll(() => page.locator('[data-testid="reality-gate"]').count(), 25000);
  await page.locator('[data-testid="gate-nova"]').click();
  await poll(() => page.locator('[data-testid="gate-sheet"]').count(), 4000);
  await page.waitForTimeout(500);
  const rows = await order(page, "gate-piece-");
  check(`the pivot pieces together at the end (${rows.join(" ")})`, rows.slice(-3).join(",") === "codo,rayo,zeta");
  await page.locator('[data-testid="gate-law-cantileverPivot"]').click();
  await show(page, { label: "pivot on", warn: '[data-testid="gate-law-warning-cantileverPivot"]', row: (k) => `[data-testid="gate-piece-${k}"]` });
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nLluvia's city");
{
  // (Before the story's end: no gate in the way.)
  const { ctx, page, errs } = await context({ width: 1100, height: 800 }, false);
  await page.goto(DIST + "el-cabeza-lluvia.html");
  await poll(() => page.locator('[data-testid="lluvia-descend"]').count(), 30000);
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="lluvia-descend"]').click();
  await poll(() => page.locator('[data-testid="lluvia-skip"]').count(), 10000);
  await page.locator('[data-testid="lluvia-skip"]').click();
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="lluvia-open-matter"]').click();
  await page.waitForTimeout(400);
  const rows = await order(page, "lluvia-matter-");
  check(`the pivot pieces together at the end (${rows.join(" ")})`, rows.slice(-3).join(",") === "codo,rayo,zeta");
  await page.locator('[data-testid="lluvia-panel-close"]').click();
  await page.locator('[data-testid="lluvia-open-laws"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="lluvia-law-cantileverPivot"]').click();
  check("pivot on: the warning flashes", !!(await poll(() => flashing(page, '[data-testid="law-warning-cantileverPivot"]'), 1500, 50)));
  check("...then over to MATTER", !!(await poll(() => page.locator('[data-testid="lluvia-panel-matter"]').count(), 3000)));
  check("...where the Codo, Rayo and Zeta flash", !!(await poll(async () => (await Promise.all(PIVOTS.map((k) => flashing(page, `[data-testid="lluvia-matter-${k}"]`)))).every(Boolean), 4000, 80)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\nPIVOT GUIDE FAILED (${failures})` : "\nPIVOT GUIDE PASSED");
process.exit(failures ? 1 : 0);
