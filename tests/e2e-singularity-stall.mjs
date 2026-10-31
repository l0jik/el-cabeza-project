/* The way into the Singularity survives a slow machine (user, on a laptop:
   "When you click on the word singularity on a desktop version ... The
   sound drops out, and then the next thing you actually hear is the
   ringing when you see the sphere").

   The collapse ran on the wall clock, and its first frame built the whole
   fall and compiled its shaders: a frame that takes seconds on a slow
   machine's graphics found the collapse over on the next one, straight to
   the black and the hard cut, the fall and its sound never there. Now the
   toll makes the collapse ready (themes/futuris-singularity.js
   startSingularityToll), and no frame moves the fall on by more than
   COLLAPSE_STEP_MAX_MS.

   Here: the collapse is built while the bell tolls; then, just as it
   begins, the page is frozen for 4 s (longer than the whole fall): after
   it, the fall is still near its start, its sound still on, and it plays
   out before the black, the sound cut there and not before.

   node tests/e2e-singularity-stall.mjs */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-futuris.html");

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 50) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(`file://${file}`);
await poll(() => page.evaluate(() => !!document.querySelector(".ec-title") && !!window.__EC_TEST_THREE__), 30000);
await page.waitForTimeout(1500);

// The invite: five taps on the masthead (one fixed point on it: the title
// jitters), retried if a tap lands between its letters.
const tb = await page.locator(".ec-title").first().boundingBox();
const invite = () => page.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn"));
for (let attempt = 0; attempt < 3 && !(await invite()); attempt++) {
  for (let i = 0; i < 5; i++) { await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(140); }
  await page.waitForTimeout(300);
  if (!(await invite())) await page.waitForTimeout(2700);
}
check("the SINGULARITY invite is up", await invite());
const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

const sing = () => page.evaluate(() => { const s = window.__EC_TEST_THREE__().singularity || {}; return { phase: s.phase, built: !!s.built, u: s.phase === "collapsing" ? (performance.now() - s.collapseStartedAt) / 3600 : null, master: window.__EC_TEST_MASTER_GAIN__ }; });
check("the toll begins", !!(await poll(async () => (await sing()).phase === "tolling", 5000)));
const ready = await poll(async () => { const s = await sing(); return s.phase === "tolling" && s.built ? s : null; }, 5000);
check("the collapse is made ready while the bell tolls (not on its own first frame)", !!ready, JSON.stringify(await sing()));

// The collapse begins; at once, the page frozen for 4 s.
check("the collapse begins", !!(await poll(async () => (await sing()).phase === "collapsing", 8000, 20)));
await page.evaluate(() => { const end = performance.now() + 4000; while (performance.now() < end) { /* frozen */ } });
const thawed = Date.now();
await page.waitForTimeout(400);
const after = await sing();
check("after the freeze the fall is still near its start, not over", after.phase === "collapsing" && after.u != null && after.u < 0.45, JSON.stringify(after));
check("...and its sound still on (no cut yet)", after.master !== 0, JSON.stringify(after));
const black = await poll(async () => ((await sing()).phase !== "collapsing" ? Date.now() : null), 15000, 50);
check(`the fall plays out after the freeze (${black ? ((black - thawed) / 1000).toFixed(1) : "?"} s), then the black`, !!black && black - thawed > 2200, JSON.stringify(await sing()));
const end = await poll(async () => { const s = await sing(); return s.phase === "sphere" ? s : null; }, 15000);
check("the sphere, the sound cut at the black", !!end && end.master === 0, JSON.stringify(end || (await sing())));
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
