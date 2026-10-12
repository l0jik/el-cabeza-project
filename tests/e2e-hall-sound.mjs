/* The pull down the hall, its recordings (user: "audio of someone being
   pulled, somewhat unwilingly, although curious... stuff should sound like
   it's being knocked over, but it's not total chaos... some forcefield like
   noise"; then "Less grunting, less panting... More surprise and ruckus
   sounds", and of the five sets made that way, "Let's go with number 5...
   that glass break right near the very end, we need to remove that and
   lower the ruckus just a hair"). themes/den-hall.js PULL_FILES,
   WALK_CUES, DRAG_CUES; tools/hall_sounds.py makes the files.

   Served over http (as GitHub Pages serves it): the four files (the man,
   what goes over, the force field, the shout's preverb) fetched and
   decoded as the hall flares; no breathing. Investigating: "Huh?" as it
   takes hold; things going over and him reacting on the way, each take at
   its moment, in order; the doorframe (a bump, a slap, a hit) as the
   camera passes through it; round the turn, "Huh?" again, the force field
   up by then. Skipped on to the eruption, what's skipped isn't played all
   at once; the shout's preverb swells up for 1.7 s and the shout comes out
   of it, ending as the white takes you, its echo ringing on into the
   void, gone by 1.7 s. Dragged in (the third time): "Hey!" first, "Huh?"
   at the rift, sooner, and the shout with its preverb. The scene's link
   (?scene=hall), from nothing kept: a tap, the hall flares with its
   recordings, and investigating, the pull's heard. The About card credits
   dersuperanton and LittleRobotSoundFactory (CC BY). From disk: nothing
   fetched, the walk the same without them.

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
const FILES = ["voice", "things", "field", "pre"];
// The walk's takes up to "Huh?" at the rift, in order (WALK_CUES).
const TO_THE_RIFT = ["engage", "huh", "table", "tray", "hey", "whoosh", "cans", "wow", "papers", "metal", "pot", "ahh", "chair", "box", "boards", "uhoh", "vase", "bump", "slap", "hit", "stumble", "huh"];
// The preverb: from 1.8 s before the shout's take (its PRE_LEAD of silence,
// then 1.7 s rising into the shout).
const PRE_AHEAD = 1.8;

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
  check("the hall flares: its four recordings fetched (no breathing)", !!(await poll(async () => FILES.every((k) => fetched[k] === 200), 8000)) && !("breath" in fetched), JSON.stringify(fetched));
  check("...and decoded", !!(await poll(async () => (await hall()).pull.loaded.join() === "field,pre,things,voice", 8000)), JSON.stringify((await hall()).pull));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 6000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  const early = await poll(async () => { const h = await hall(); return h.pull.heard.includes("huh") ? h : null; }, 4000, 100);
  check(`the walk: the force field takes hold, then "Huh?" (${early && early.pull.heard.join(" ")})`, !!early && early.pull.heard[0] === "engage" && early.pull.heard[1] === "huh");
  // Through the doorframe (about 7 s on the walk's clock): a bump, a slap,
  // a hit; and round the turn, a stumble and "Huh?" again.
  const door = await poll(async () => { const h = await hall(); return h.pull.heard.includes("hit") ? h : null; }, 12000, 100);
  check(`...things going over and him reacting on the way (${door && door.pull.heard.join(" ")})`, !!door && ["table", "tray", "cans", "papers", "metal", "pot", "chair", "box", "boards", "vase", "hey", "wow", "ahh", "uhoh"].every((k) => door.pull.heard.includes(k)));
  check(`...at the doorframe, at ${door && Math.round(door.t)} ms: a bump, a slap, a hit`, !!door && door.t > 6700 && door.t < 7900 && ["bump", "slap", "hit"].every((k) => door.pull.heard.includes(k)));
  const turn = await poll(async () => { const h = await hall(); return h.pull.heard.filter((k) => k === "huh").length === 2 ? h : null; }, 6000, 100);
  check(`round the turn, the rift: a stumble, then "Huh?" again (at ${turn && Math.round(turn.t)} ms)`, !!turn && turn.pull.heard.lastIndexOf("huh") > turn.pull.heard.indexOf("stumble") && turn.pull.heard.indexOf("stumble") > turn.pull.heard.indexOf("hit"));
  check(`...the force field up by then (${turn && turn.pull.field}), and no breathing`, !!turn && turn.pull.field > 0.5 && !("breath" in turn.pull));
  check(`...each take at its moment, in order, once (${turn && turn.pull.heard.join(" ")})`, !!turn && turn.pull.heard.slice(0, TO_THE_RIFT.length).join() === TO_THE_RIFT.join());
  // On to the eruption: what's skipped (a last thing settling, tins far
  // off) isn't played; the shout is, its preverb first. (A sampler in the
  // page for the preverb's swell: what it's been, read every 100 ms.)
  await page.evaluate(() => {
    window.__preEnv = [];
    const id = setInterval(() => { const p = window.__DEN_HALL__().pull.pre; if (p && p.env) window.__preEnv.push(...p.env.map(([t, rms]) => ({ t, rms, shout: p.shout }))); }, 100);
    window.__preStop = () => clearInterval(id);
  });
  await page.evaluate(() => window.__DEN_HALL_SKIP__(12200));
  const erupt = await poll(async () => { const h = await hall(); return h.pull.heard.includes("scream") ? h : null; }, 6000, 100);
  check(`skipped on to the eruption: the shout, and nothing skipped played (${erupt && erupt.pull.heard.slice(-3).join(" ")})`, !!erupt && !erupt.pull.heard.includes("woodfall") && !erupt.pull.heard.includes("cansfar"));
  // (User: "Add 1.7 sec. preverb to all ending yells before being sucked
  // into the void.")
  const pre = erupt && erupt.pull.pre;
  check(`...its preverb from ${PRE_AHEAD} s before the shout's take (${pre && JSON.stringify({ at: pre.at, shout: pre.shout })})`, !!pre && Math.abs(pre.shout - pre.at - PRE_AHEAD) < 0.005);
  // (User: "The end of the scream should have reverb / echo decay that
  // lasts for a 1.7 seconds after being pulled through the portal / when
  // you initially see the body tumbling in space.") The scream ends at the
  // hand-off to the void; its echo is heard there, still there over a
  // second on, and gone by 1.7 s.
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const h = await hall();
    if (h.pull.echo) { samples.push({ ...h.pull.echo, t: h.t, state: h.state }); if (h.pull.echo.age > 2.2) break; }
    await page.waitForTimeout(60);
  }
  const at = (a, b) => samples.filter((e) => e.age >= a && e.age < b).map((e) => e.rms);
  const echoEarly = at(0.1, 0.6), echoLate = at(1.0, 1.4), echoAfter = at(1.85, 9);
  const show = JSON.stringify({ early: echoEarly.slice(0, 4), late: echoLate.slice(0, 4), after: echoAfter.slice(0, 3) });
  // (When the scream ended, on the walk's clock: its echo's age read
  // against the clock. The hand-off to the void is at 16.2 s.)
  const ended = samples.length ? Math.round(samples[0].t - samples[0].age * 1000) : null;
  check(`the scream ends as the white takes you (at ${ended} ms; the void at 16200)`, ended !== null && Math.abs(ended - 16200) < 250 && samples.some((e) => e.state === "done"));
  check(`...its echo rings on into the void ${show}`, echoEarly.length > 0 && Math.max(...echoEarly) > 0.01);
  check("...still there over a second on, all along", echoLate.length > 0 && Math.max(...echoLate) > 0.002 && Math.min(...echoLate) > 0.0005);
  check("...and gone by 1.7 s", echoAfter.length > 0 && Math.max(...echoAfter) < 0.0005);
  // The preverb, heard: near silent as it starts, swelling up into the
  // shout (by the audio clock).
  const preEnv = await page.evaluate(() => { window.__preStop(); return window.__preEnv; });
  const preAt = (a, b) => preEnv.filter((p) => p.t - p.shout >= a && p.t - p.shout < b).map((p) => p.rms);
  const preStart = preAt(-1.8, -1.55), preMid = preAt(-1.4, -1.0), preEnd = preAt(-0.4, 0);
  const preShow = JSON.stringify({ start: preStart.slice(0, 4), mid: preMid.slice(0, 4), end: preEnd.slice(-4) });
  check(`the preverb near silent as it starts ${preShow}`, preStart.length > 0 && Math.max(...preStart) < 0.004);
  check("...swelling up into the shout", preMid.length > 0 && preEnd.length > 0 && Math.max(...preEnd) > 0.015 && Math.max(...preEnd) > 2.5 * Math.max(...preMid));
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
  check(`..."Hey!" first, no "Huh?" (${first && first.pull.heard.join(" ")})`, !!first && first.pull.heard[1] === "hey" && !first.pull.heard.includes("huh"));
  const huh = await poll(async () => { const h = await hall(); return h.pull.heard.includes("huh") ? h : null; }, 8000, 100);
  check(`...through the doorframe faster: "Huh?" at the rift at ${huh && Math.round(huh.t)} ms`, !!huh && huh.t > 4000 && huh.t < 5400);
  const scream = await poll(async () => { const h = await hall(); return h.pull.heard.includes("scream") ? h : null; }, 12000, 100);
  const pre = scream && scream.pull.pre;
  check(`...the shout, its preverb first (${pre && JSON.stringify({ at: pre.at, shout: pre.shout })}), no breathing`, !!pre && Math.abs(pre.shout - pre.at - PRE_AHEAD) < 0.005 && !("breath" in scream.pull));
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
  const h = await poll(async () => { const v = await page.evaluate(() => window.__DEN_HALL__()); return v.pull.heard.includes("huh") ? v : null; }, 5000, 100);
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
  check(`the man's voice and his shout credited: dersuperanton, LittleRobotSoundFactory, CC BY 4.0`, /dersuperanton/.test(credits || "") && /LittleRobotSoundFactory/.test(credits || "") && /CC BY 4\.0/.test(credits || ""), credits);
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
