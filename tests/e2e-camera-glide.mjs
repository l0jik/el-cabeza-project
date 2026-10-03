/* The view jumps glide (chassis glideRef; user: a two-finger flick up or
   down, and their buttons, moved the camera too abruptly): Top-Down View
   and Current Player View ease in and out over about a second instead of
   most of the way in the first tenth. And Nova's ?scene=revelation link:
   a tap, then straight into the revelation, with nothing kept.

   node tests/e2e-camera-glide.mjs */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

console.log("\nthe view jumps glide");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  const corner = await waitForDockCorner(page, { timeoutMs: 10000 });
  await reopenDockPanelFromCorner(page, corner);
  await page.waitForTimeout(2500);
  // The camera's pitch (0 straight down), every frame, from the page.
  const watch = () => page.evaluate(() => { window.__S = []; const t0 = performance.now(); const f = () => { const c = window.__EC_TEST_THREE__().camera.position; window.__S.push([performance.now() - t0, Math.acos(c.y / c.length())]); if (performance.now() - t0 < 4000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (const [to, from] of [["view-player", null], ["view-top", "player"], ["view-player", "top"]]) {
    await watch();
    await page.locator(`[data-testid="${to}"]`).click();
    await page.waitForTimeout(3000);
    if (!from) continue; // (to a known start)
    const S = await page.evaluate(() => window.__S);
    const p0 = S[0][1], p1 = S[S.length - 1][1], span = p1 - p0;
    const k = (s) => (s[1] - p0) / span;
    const when = (f) => (S.find((s) => k(s) >= f) || [NaN])[0];
    const t05 = when(0.05), t50 = when(0.5), t95 = when(0.95);
    check(`${from} -> ${to}: a real move (${p0.toFixed(2)} -> ${p1.toFixed(2)})`, Math.abs(span) > 0.3);
    // The old damping went 5% -> 95% in about a third of a second (330 ms).
    check(`...eased over the move: 5% -> 95% in ${Math.round(t95 - t05)} ms`, t95 - t05 > 450 && t95 - t05 < 1700);
    check(`...gentle in and out: halfway at ${Math.round(((t50 - t05) / (t95 - t05)) * 100)}% of that`, (t50 - t05) / (t95 - t05) > 0.3 && (t50 - t05) / (t95 - t05) < 0.7);
    check("...and settled", Math.abs(k(S[S.length - 1]) - 1) < 0.01);
  }
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nNova ?scene=revelation");
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_REALITIES_LOCK__ = 300; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?scene=revelation");
  check("a fresh visitor: the den, and a tap to begin", !!(await poll(async () => (await page.locator('[data-testid="den-revelation-preview"]').count()) > 0, 30000)));
  await page.waitForTimeout(800);
  await page.locator('[data-testid="den-revelation-preview"]').click();
  check("...straight into the void", !!(await poll(async () => (await page.evaluate(() => window.__DEN_ENDING__ && window.__DEN_ENDING__() && window.__DEN_ENDING__().stage)) === "void", 8000)));
  const st = await page.evaluate(() => window.__DEN_ENDING__());
  await page.evaluate((ms) => window.__DEN_ENDING_SKIP__(ms), st.menuAt + 2000);
  check("...on to the realities", !!(await poll(async () => (await page.locator('[data-testid="realities-stay"]').count()) > 0, 15000)));
  await page.waitForTimeout(600);
  await page.locator('[data-testid="realities-stay"]').click();
  await page.waitForTimeout(1500);
  check("...and nothing kept: the story's where it was", await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("el-cabeza:story") || "null"); return !s || !s.ended; }));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nNova ?scene=hall");
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?scene=hall");
  check("a fresh visitor: the den, and a tap to begin", !!(await poll(async () => (await page.locator('[data-testid="den-hall-preview"]').count()) > 0, 30000)));
  await page.waitForTimeout(800);
  await page.locator('[data-testid="den-hall-preview"]').click();
  const keep = page.locator('[data-testid="den-hall-keep"]');
  check("...the hallway lights up, and the choice", !!(await poll(async () => (await keep.count()) > 0 && /weird enough already/.test(await keep.innerText()), 8000)));
  await page.waitForTimeout(500);
  await keep.click();
  check("kept playing: back in a few seconds, \"Oh, for the love of…\"", !!(await poll(async () => (await keep.count()) > 0 && /Oh, for the love of…/.test(await page.locator('[data-testid="den-hall-say"]').innerText()), 15000)));
  check("...and keep playing's the electrician", /call an electrician about that tomorrow\. Let me just finish one game!/.test(await keep.innerText()));
  await page.waitForTimeout(500);
  await keep.click();
  check("the third time: pulled in", !!(await poll(async () => { const h = await page.evaluate(() => window.__DEN_HALL__()); return h.state === "walk" && h.dragged; }, 15000)));
  check("...and nothing kept", await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("el-cabeza:story") || "null"); return !s || (!s.hallFlares && !s.ended); }));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\nNova ?scene=lure");
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?scene=lure");
  check("a fresh visitor: the den, and a tap to begin", !!(await poll(async () => (await page.locator('[data-testid="den-lure-preview"]').count()) > 0, 30000)));
  await page.waitForTimeout(800);
  await page.locator('[data-testid="den-lure-preview"]').click();
  check("...the set lures", !!(await page.evaluate(() => window.__DEN_TV__ && window.__DEN_TV__().lure)));
  check("...and stirs within seconds", !!(await poll(async () => (await page.evaluate(() => window.__DEN_TV__().lureEvents)) > 0, 12000)));
  check("...nothing kept", await page.evaluate(() => !localStorage.getItem("el-cabeza:story") && !Object.keys(localStorage).some((k) => /singularity/i.test(k) && localStorage.getItem(k) === "1")));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\nCAMERA GLIDE FAILED (${failures})` : "\nCAMERA GLIDE PASSED");
process.exit(failures ? 1 : 0);
