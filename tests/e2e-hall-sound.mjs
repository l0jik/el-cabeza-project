/* The pull down the hall, its recordings (user: "audio of someone being
   pulled, somewhat unwilingly, although curious... stuff should sound like
   it's being knocked over, but it's not total chaos... some forcefield like
   noise... Whenever the user turn right after passing through the
   doorframe... an expression of extreme shock or confusion...
   increasingly sound a bit panicky"). themes/den-hall.js PULL_FILES,
   WALK_CUES, DRAG_CUES; tools/hall_sounds.py makes the files.

   Served over http (as GitHub Pages serves it): the four files fetched and
   decoded as the hall flares. Investigating: "Whoah, no way" as it takes
   hold; things going over and efforts on the way; the doorframe (a bump, a
   slap, a grunt) as the camera passes through it; round the turn, the gasp
   and "Huh?"; the force field and the breathing up by then. Skipped on to
   the eruption, what's skipped isn't played all at once, and the scream
   comes, his breathing cut with it for good. Dragged in (the third time):
   a startled "Ah" first, no "Whoah", and the breathing cut at the scream.
   The scene's link (?scene=hall), from nothing kept: a tap, the hall
   flares with its recordings, and investigating, the pull's heard. The
   About card credits Iceofdoom (CC BY). From disk: nothing fetched, the
   walk the same without them.

   node tests/e2e-hall-sound.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const URL_HTTP = `http://127.0.0.1:${server.address().port}/el-cabeza-nova.html`;

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });
const FILES = ["voice", "things", "field", "breath"];

// Home after the closed Big Glutts and the trip, the hall due (and, for
// the drag, its third time).
async function home(url, flares = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript((flares) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, hallDue: true, ...(flares ? { hallFlares: flares } : {}) }));
        localStorage.setItem("el-cabeza:singularity-seen", "1");
        localStorage.setItem("el-cabeza:commercial-aired", "1");
        localStorage.setItem("el-cabeza:special-order-noted", "1");
      }
    } catch (e) { /* none */ }
  }, flares);
  const page = await ctx.newPage();
  const errs = [], fetched = {};
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => { const m = /el-cabeza-hall-([a-z]+)\.mp3/.exec(r.url()); if (m) fetched[m[1]] = r.status(); });
  await page.goto(url);
  await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000);
  await page.waitForTimeout(1500);
  await page.mouse.click(5, 380); // (a gesture, for the sound)
  await openDockPanel(page);
  const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
  await page.waitForTimeout(2000);
  const hall = () => page.evaluate(() => window.__DEN_HALL__());
  return { ctx, page, errs, fetched, hall };
}

// ---- Investigating, over http ----
{
  console.log("investigating, over http");
  const { ctx, page, errs, fetched, hall } = await home(URL_HTTP);
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  check("the hall flares: its four recordings fetched", !!(await poll(async () => FILES.every((k) => fetched[k] === 200), 8000)), JSON.stringify(fetched));
  check("...and decoded", !!(await poll(async () => (await hall()).pull.loaded.join() === "breath,field,things,voice", 8000)), JSON.stringify((await hall()).pull));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 6000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  const early = await poll(async () => { const h = await hall(); return h.pull.heard.includes("whoa") ? h : null; }, 4000, 100);
  check(`the walk: the force field takes hold, then "Whoah, no way" (curious) (${early && early.pull.heard.join(" ")})`, !!early && early.pull.heard[0] === "engage" && early.pull.heard[1] === "whoa");
  // Through the doorframe (about 7 s on the walk's clock): a bump, a slap,
  // a grunt; and round the turn, the gasp and "Huh?".
  const door = await poll(async () => { const h = await hall(); return h.pull.heard.includes("grunt") ? h : null; }, 12000, 100);
  check(`...things going over and efforts on the way (${door && door.pull.heard.join(" ")})`, !!door && ["rattle", "papers", "chair", "books", "vase", "ah", "ugh1", "ugh2"].every((k) => door.pull.heard.includes(k)));
  check(`...at the doorframe, at ${door && Math.round(door.t)} ms: a bump, a slap, a grunt`, !!door && door.t > 6700 && door.t < 7900 && ["bump", "slap", "grunt"].every((k) => door.pull.heard.includes(k)));
  const turn = await poll(async () => { const h = await hall(); return h.pull.heard.includes("huh") ? h : null; }, 6000, 100);
  check(`round the turn, the rift: the gasp, then "Huh?" (at ${turn && Math.round(turn.t)} ms)`, !!turn && turn.pull.heard.indexOf("gasp") > turn.pull.heard.indexOf("grunt") && turn.pull.heard.indexOf("huh") > turn.pull.heard.indexOf("gasp"));
  check(`...the force field and the breathing up by then (${turn && JSON.stringify({ field: turn.pull.field, breath: turn.pull.breath })})`, !!turn && turn.pull.field > 0.5 && turn.pull.breath > 0.05);
  check("...never two of a take", !!turn && new Set(turn.pull.heard).size === turn.pull.heard.length);
  // On to the eruption: what's skipped ("Phew") isn't played, the scream is.
  await page.evaluate(() => window.__DEN_HALL_SKIP__(12200));
  const erupt = await poll(async () => { const h = await hall(); return h.pull.heard.includes("scream") ? h : null; }, 6000, 100);
  check(`skipped on to the eruption: "Ahh!!!", and nothing skipped played (${erupt && erupt.pull.heard.slice(-2).join(" ")})`, !!erupt && !erupt.pull.heard.includes("phew"));
  // (User: "when the 'waaah!' happens, the breathing must stop. It sounds
  // like there's 2 people there.")
  check(`...his breathing cut with the scream (${erupt && JSON.stringify({ breath: erupt.pull.breath, cut: erupt.pull.breathCut })})`, !!erupt && erupt.pull.breathCut === true && erupt.pull.breath === null);
  await page.waitForTimeout(1500);
  const later = await hall();
  check(`...and it doesn't come back (${JSON.stringify({ breath: later.pull.breath, cut: later.pull.breathCut })})`, later.pull.breath === null && later.pull.breathCut === true);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- Dragged in, the third time ----
{
  console.log("dragged in (the third time), over http");
  const { ctx, page, errs, hall } = await home(URL_HTTP, 2);
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  check("the third time: no choice, pulled in", !!(await poll(async () => { const h = await hall(); return h.state === "walk" && h.dragged ? h : null; }, 8000)));
  const first = await poll(async () => { const h = await hall(); return h.pull.heard.length >= 2 ? h : null; }, 5000, 100);
  check(`...a startled "Ah" first, no "Whoah, no way" (${first && first.pull.heard.join(" ")})`, !!first && first.pull.heard[1] === "ah" && !first.pull.heard.includes("whoa"));
  const gasp = await poll(async () => { const h = await hall(); return h.pull.heard.includes("gasp") ? h : null; }, 8000, 100);
  check(`...through the doorframe faster: the gasp at ${gasp && Math.round(gasp.t)} ms`, !!gasp && gasp.t > 4000 && gasp.t < 5400);
  const scream = await poll(async () => { const h = await hall(); return h.pull.heard.includes("scream") ? h : null; }, 12000, 100);
  check(`...the scream, and his breathing cut with it (${scream && JSON.stringify({ breath: scream.pull.breath, cut: scream.pull.breathCut })})`, !!scream && scream.pull.breathCut === true && scream.pull.breath === null);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- The scene's link (?scene=hall), the one the user's sent to assess it ----
{
  console.log("the hallway's link (?scene=hall), over http");
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [], fetched = {};
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => { const m = /el-cabeza-hall-([a-z]+)\.mp3/.exec(r.url()); if (m) fetched[m[1]] = r.status(); });
  await page.goto(URL_HTTP + "?scene=hall");
  const begin = page.locator('[data-testid="den-hall-preview"]');
  check("\"The hallway / Tap to begin\"", !!(await poll(async () => (await begin.count()) > 0, 30000)));
  await page.waitForTimeout(1500);
  await begin.click();
  check("a tap: the hall flares, its recordings fetched", !!(await poll(async () => FILES.every((k) => fetched[k] === 200), 10000)), JSON.stringify(fetched));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 8000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  const h = await poll(async () => { const v = await page.evaluate(() => window.__DEN_HALL__()); return v.pull.heard.includes("whoa") ? v : null; }, 5000, 100);
  check(`investigate: the pull heard (${h && h.pull.heard.join(" ")})`, !!h && h.pull.heard[0] === "engage");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- The About card ----
{
  console.log("the About card");
  const { ctx, page } = await home(URL_HTTP);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check(`the man's voice credited: Iceofdoom, CC BY 4.0`, /Iceofdoom/.test(credits || "") && /CC BY 4\.0/.test(credits || ""), credits);
  await ctx.close();
}

// ---- From disk ----
{
  console.log("from disk");
  const { ctx, page, errs, fetched, hall } = await home("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 6000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  await page.waitForTimeout(3000);
  const h = await hall();
  check("nothing fetched, the walk the same without them", Object.keys(fetched).length === 0 && h.state === "walk" && h.pull.loaded.length === 0 && h.pull.heard.length === 0, JSON.stringify(h.pull));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
