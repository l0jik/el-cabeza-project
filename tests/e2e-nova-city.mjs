/* The City on Nova's page (user: "consolidate everything into a single
   link to where it's all integrated together"; the first of the site's
   other worlds to live in Nova, apps/unified.jsx LAZY): Nova's page is
   built in pieces (build/build.js: its own script and the chunks every
   world's page shares), the City's theme a chunk fetched only when it's
   picked.

   - ?world=ciudad opens Nova in the City (the chunk fetched first): the
     City's scene, its clock, its corner menu; Nova's own realities corner.
   - Other realities from there, the den picked: the City's torn down (its
     scene gone, its hooks gone, its sound closed), the den up, no errors.
   - The City picked again from the den's menu: a word while it's fetched
     (from the cache now), then the cut, and the City up again, whole (its
     lots, its traffic, the clock), the hour kept.
   - From another page's menu (Lluvia), The City opens Nova there.
   - Nova's other pages' tests still pass with the split build (they're
     run in CI as ever).

   node tests/e2e-nova-city.mjs */
import { chromium } from "playwright";
import fs from "node:fs";

const DIST = "/home/user/el-cabeza-project/dist";
const D = `file://${DIST}`;
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
// (the story over in this browser: the realities open)
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try {
    localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true, hallDue: false }));
    ["el-cabeza:singularity-seen", "el-cabeza:special-order-noted", "el-cabeza:commercial-aired"].forEach((k) => localStorage.setItem(k, "1"));
  } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const T = (fn, a) => page.evaluate(fn, a);
const city = () => T(() => !!window.__CIUDAD__);
// After the story a reality comes up behind its gate (Standard Cabeza,
// Cabeza Nova, Other realities: themes/reality-gate.js); the realities
// menu opens from the gate's link, or from Nova's corner once a game's on.
const toRealities = async (p = page) => {
  const link = p.locator('[data-testid="gate-realities"]');
  if (await link.count()) await link.click(); else await p.locator('[data-testid="action-corner"]').first().click();
  return poll(async () => (await p.locator('[data-testid="realities"]').count()) === 1, 6000);
};
const gateWorld = (p = page) => p.locator('[data-testid="reality-gate"]').getAttribute("data-world").catch(() => null);
const scene = () => T(() => { const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__(); if (!t || !t.scene) return null; let sky = false, lamps = false, n = 0; t.scene.traverse((o) => { n++; if (o.name === "ciudad-lamp-heads") lamps = true; if (o.material && o.material.uniforms && o.material.uniforms.uSunGlow) sky = true; }); return { sky, lamps, n }; });

console.log("Nova opened in the City (?world=ciudad)");
await page.goto(`${D}/el-cabeza-nova.html?world=ciudad`);
check("the page's script is a module beside it", await page.evaluate(() => !!document.querySelector('script[type="module"][src^="el-cabeza-nova-app"]')));
const up = await poll(() => T(() => !!window.__EC_TEST_CAM__ && !!window.__CIUDAD__), 40000, 250);
check("the City is up, in Nova", !!up);
await page.waitForTimeout(1500);
const s1 = await scene();
check("...its sky and its lamps in the scene", !!s1 && s1.sky && s1.lamps, JSON.stringify(s1));
check("...its clock", (await page.locator('[data-testid="ciudad-time-chip"]').count()) === 1);
check("...behind its gate (Standard Cabeza, Cabeza Nova, Other realities)", (await page.locator('[data-testid="reality-gate"]').count()) === 1 && (await gateWorld()) === "ciudad");
const lots = await T(() => window.__CIUDAD__.lots());
check("...its lots and cranes laid out", !!lots && lots.lots.length >= 12 && lots.cranes.length === 2, JSON.stringify(lots && lots.cranes));
// (file:// keeps no resource timings: the pieces checked on disk instead)
{
  // What the page loads up front: its own script and the chunks that
  // imports (the code every world's page shares, build/build.js), all
  // preloaded; the City's code only behind an import(), fetched as it's
  // picked.
  const read = (f) => fs.readFileSync(`${DIST}/${f}`, "utf8");
  const imports = (f, seen = new Set()) => {
    for (const [, n] of read(f).matchAll(/(?:from|import)\s*"\.\/(el-cabeza-[\w-]+\.js)"/g)) if (!seen.has(n)) { seen.add(n); imports(n, seen); }
    return seen;
  };
  const upFront = ["el-cabeza-nova-app.js", ...imports("el-cabeza-nova-app.js")];
  const preloaded = [...read("el-cabeza-nova.html").matchAll(/modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  check("the page's script in pieces: its own and the chunks it shares, preloaded", upFront.length > 2 && preloaded.length === upFront.length - 1 && preloaded.every((f) => upFront.includes(f)), upFront.join(", "));
  const later = upFront.flatMap((f) => [...read(f).matchAll(/import\("\.\/(el-cabeza-[\w-]+\.js)"\)/g)].map((m) => m[1]));
  const city = later.flatMap((f) => [f, ...imports(f)]).filter((f) => !upFront.includes(f));
  check("...the City's code in none of them, only in what's fetched as it's picked", !upFront.some((f) => read(f).includes("ciudad-lamp-heads")) && city.some((f) => read(f).includes("ciudad-lamp-heads")), JSON.stringify({ later, city }));
}
await page.locator('[data-testid="gate-standard"]').click();
check("a game begins there (Standard Cabeza from its gate)", !!(await poll(() => T(() => window.__EC_TEST_ARMED__ === true), 8000)) && (await page.locator('[data-testid="reality-gate"]').count()) === 0);
check("...its corner menu, in its look", !!(await poll(async () => (await page.locator('[data-testid="corner-menu"]').getAttribute("data-look").catch(() => null)) === "ciudad", 6000)));
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));

console.log("Other realities: the den; the City torn down");
// (the City's hour switched, to see it kept across the change)
await T(() => window.__CIUDAD_TIME__.set("night", true));
await page.waitForTimeout(500);
check("Nova's corner offers the other realities, in play", (await page.locator('[data-testid="action-corner"]').count()) === 1);
check("...the menu opens over the City", !!(await toRealities()));
check("...marking the City as here", !!(await poll(async () => /You are here/.test((await page.locator('[data-testid="reality-ciudad"]').textContent()) || ""), 4000)));
await page.locator('[data-testid="reality-den"]').click();
const den = await poll(() => T(() => !window.__CIUDAD__ && !!window.__EC_TEST_CAM__ && !!document.querySelector('[data-testid="reality-gate"][data-world="den"]')), 30000, 250);
check("the den comes up behind its gate, the City's hooks gone", !!den);
await page.waitForTimeout(1500);
const s2 = await scene();
check("...the City's sky and lamps gone from the scene", !!s2 && !s2.sky && !s2.lamps, JSON.stringify(s2));
check("...and its clock", (await page.locator('[data-testid="ciudad-time-chip"]').count()) === 0);
check("...its sound put down (no bed playing)", await T(() => !window.__CIUDAD_AUDIO__ || !window.__CIUDAD_AUDIO__.debugState().bed));
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));

console.log("The City again, from the den's menu");
check("...the gate's Other realities opens the menu there", !!(await toRealities()));
check("...the den marked as here now", !!(await poll(async () => /You are here/.test((await page.locator('[data-testid="reality-den"]').textContent()) || ""), 4000)));
await page.locator('[data-testid="reality-ciudad"]').click();
const again = await poll(() => T(() => !!window.__CIUDAD__ && !!document.querySelector('[data-testid="reality-gate"][data-world="ciudad"]')), 30000, 250);
check("the City comes up again, in place (the address unchanged)", !!again && /el-cabeza-nova\.html/.test(await T(() => location.href)));
await page.waitForTimeout(2000);
const s3 = await scene();
const lots2 = await T(() => window.__CIUDAD__.lots());
check("...whole: its sky, lamps, lots and cranes", !!s3 && s3.sky && s3.lamps && !!lots2 && lots2.lots.length >= 12 && lots2.cranes.length === 2, JSON.stringify({ s3, cranes: lots2 && lots2.cranes }));
check("...its traffic and people", await T(() => { const l = window.__CIUDAD__.life(); return l.cars > 50 && l.people > 50; }));
check("...the hour kept (10 PM)", (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "night");
await page.locator('[data-testid="gate-standard"]').click();
check("...and a game begins there again (Standard Cabeza from its gate)", !!(await poll(() => T(() => window.__EC_TEST_ARMED__ === true), 8000)) && (await page.locator('[data-testid="reality-gate"]').count()) === 0);
check("...with its corner menu, in its look", !!(await poll(async () => (await page.locator('[data-testid="corner-menu"]').getAttribute("data-look").catch(() => null)) === "ciudad", 6000)));
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
await ctx.close();

console.log("From another page's menu");
{
  const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  await ctx2.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try { localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true, hallDue: false })); } catch (e) { /* none */ }
  });
  const p2 = await ctx2.newPage();
  await p2.goto(`${D}/el-cabeza-lluvia.html`);
  // (Lluvia's gate waits for its descent: e2e-gate's way down.)
  check("Lluvia opens with its descent, as ever", !!(await poll(async () => (await p2.locator('[data-testid="lluvia-descend"]').count()) > 0, 30000)));
  await p2.locator('[data-testid="lluvia-descend"]').click();
  await p2.waitForTimeout(1500);
  await p2.locator('[data-testid="lluvia-skip"]').click().catch(() => {});
  const has = !!(await poll(async () => (await p2.locator('[data-testid="gate-realities"]').count()) > 0, 25000));
  check("...down in its city, the gate's Other realities", has);
  if (has) {
    check("...the menu opens there", !!(await toRealities(p2)));
    await p2.locator('[data-testid="reality-ciudad"]').click();
    const there = await poll(() => p2.evaluate(() => /el-cabeza-nova\.html\?world=ciudad/.test(location.href) && !!window.__CIUDAD__), 40000, 250);
    check("The City opens Nova's page, there", !!there, await p2.evaluate(() => location.href));
  }
  await ctx2.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
