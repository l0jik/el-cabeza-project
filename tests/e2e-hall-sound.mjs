/* The walk down the hall, its sound (user, of the first, the man reacting
   all the way and things knocked over: "We have to redo the sound for the
   walking to the hallway animation. I don't like it"; what was off, "His
   voice, The crashing things"; what it should be, "Building dread": a
   rising drone and a heartbeat, the room's sound warping, a few sharp
   hits, little or no voice; the third time, dragged in, "the same way,
   made faster and rougher"). themes/den-hall.js PULL_FILES, PULL_WALK,
   PULL_DRAG; den-audio.js hallPull; tools/hall_dread.py makes the dread,
   tools/hall_sounds.py the shout, its preverb and the force field.

   Served over http (as GitHub Pages serves it): as the hall flares, the
   shout, its preverb, the force field and the walk's dread fetched and
   decoded (nothing of the man's voice or the things, no breathing).
   Investigating: the dread from the click, on the walk's own time; the
   den's own sound (the fire, the clock, a record) bending away behind you,
   gone by the time the rift's in view; no made booms or roar over the
   dread; the force field up at the rift, down to almost nothing in the
   calm. Skipped on to the eruption, the dread goes on from there and the
   shout's preverb swells up for 1.7 s and the shout comes out of it,
   ending as the white takes you, its echo ringing on into the void, gone
   by 1.7 s (back from the void, the den's sound comes straight through
   again: e2e-ending). Dragged in (the third time): the drag's own dread, the den's
   sound gone sooner, the shout with its preverb. The scene's link
   (?scene=hall), from nothing kept: a tap, the hall flares with its
   recordings, and investigating, the dread's heard. The About card credits
   LittleRobotSoundFactory (CC BY) and the dread's makers. From disk:
   nothing fetched, the made sounds (booms, the roar) instead.

   node tests/e2e-hall-sound.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
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
const FILES = ["scream", "field", "pre", "dread-walk"];
const GONE = ["voice", "things", "breath"];
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
  page.on("response", (r) => { const m = /el-cabeza-hall-([a-z-]+)\.(?:mp3|opus)/.exec(r.url()); if (m) fetched[m[1]] = r.status(); });
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
  const den = () => page.evaluate(() => window.__DEN_AUDIO__ && window.__DEN_AUDIO__());
  return { ctx, page, errs, fetched, hall, den };
}

// ---- Investigating, over http ----
{
  console.log("investigating, over http");
  const { ctx, page, errs, fetched, hall, den } = await home(URL_HTTP);
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  check("the hall flares: the shout, its preverb, the force field and the walk's dread fetched", !!(await poll(async () => FILES.every((k) => fetched[k] === 200), 8000)) && GONE.every((k) => !(k in fetched)) && !("dread-drag" in fetched), JSON.stringify(fetched));
  check("...and decoded", !!(await poll(async () => (await hall()).pull.loaded.join() === "field,pre,scream,walk", 8000)), JSON.stringify((await hall()).pull));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 6000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  const start = await poll(async () => { const h = await hall(); return h.pull.dread && h.pull.dread.kind ? h : null; }, 3000, 50);
  // (The flare's booms, before the click, counted; none after.)
  const before = start ? start.pull.made : { booms: -1, roars: -1 };
  check(`the dread from the click (${start && JSON.stringify(start.pull.dread)}, at ${start && Math.round(start.t)} ms)`, !!start && start.pull.dread.kind === "walk" && start.pull.dread.from < 0.4 && start.pull.heard[0] === "dread-walk");
  const bend0 = await den();
  check("...the den's own sound sent bending away (den-audio hallPull)", !!(bend0 && bend0.pull), JSON.stringify(bend0 && bend0.pull));
  // Halfway to the doorway: sagging, closing in.
  await poll(async () => (await hall()).t > 5000, 8000, 100);
  const bend1 = await den();
  check(`...by 5 s, sagging and closing in (${JSON.stringify(bend1 && bend1.pull)})`, !!(bend1 && bend1.pull) && bend1.pull.delay > 0.08 && bend1.pull.lp < 6000 && bend1.pull.gain < 1);
  // Round the turn, the rift in view.
  const turn = await poll(async () => { const h = await hall(); return h.t > 9700 ? h : null; }, 8000, 100);
  const bend2 = await den();
  check(`...gone by the time the rift's in view (${JSON.stringify(bend2 && bend2.pull)})`, !!(bend2 && bend2.pull) && bend2.pull.gain < 0.01);
  check(`the force field up at the rift (${turn && turn.pull.field})`, !!turn && turn.pull.field > 0.2);
  check(`no voice, nothing thrown about, no made booms over the dread (${turn && turn.pull.heard.join(" ")}; ${turn && JSON.stringify(turn.pull.made)})`, !!turn && turn.pull.heard.join() === "dread-walk" && turn.pull.made.booms === before.booms);
  const calm = await poll(async () => { const h = await hall(); return h.t > 11400 ? h : null; }, 4000, 100);
  check(`...and down to almost nothing in the calm (${calm && calm.pull.field})`, !!calm && calm.pull.field < 0.16);
  // On to the eruption: the dread goes on from there; the shout, its
  // preverb first. (A sampler in the page for the preverb's swell: what
  // it's been, read every 100 ms.)
  await page.evaluate(() => {
    window.__preEnv = [];
    const id = setInterval(() => { const p = window.__DEN_HALL__().pull.pre; if (p && p.env) window.__preEnv.push(...p.env.map(([t, rms]) => ({ t, rms, shout: p.shout }))); }, 100);
    window.__preStop = () => clearInterval(id);
  });
  await page.evaluate(() => window.__DEN_HALL_SKIP__(12200));
  const skipped = await hall();
  check(`skipped on to the eruption: the dread goes on from there (${JSON.stringify(skipped.pull.dread)})`, !!skipped.pull.dread && Math.abs(skipped.pull.dread.from - 12.2) < 0.05);
  const erupt = await poll(async () => { const h = await hall(); return h.pull.heard.includes("scream") ? h : null; }, 6000, 100);
  check(`...the shout, and no made roar over the dread (${erupt && JSON.stringify(erupt.pull.made)})`, !!erupt && erupt.pull.made.roars === before.roars);
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
  const { ctx, page, errs, fetched, hall, den } = await home(URL_HTTP, 2);
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  check("the third time: the drag's own dread fetched", !!(await poll(async () => fetched["dread-drag"] === 200, 8000)) && !("dread-walk" in fetched), JSON.stringify(fetched));
  check("...no choice, pulled in", !!(await poll(async () => { const h = await hall(); return h.state === "walk" && h.dragged ? h : null; }, 8000)));
  const first = await poll(async () => { const h = await hall(); return h.pull.dread && h.pull.dread.kind ? h : null; }, 3000, 50);
  check(`...the drag's dread from its start (${first && JSON.stringify(first.pull.dread)})`, !!first && first.pull.dread.kind === "drag" && first.pull.dread.from < 0.4 && first.pull.heard[0] === "dread-drag");
  await poll(async () => (await hall()).t > 5600, 8000, 100);
  const bend = await den();
  check(`...the den's sound gone sooner (by 5.6 s: ${JSON.stringify(bend && bend.pull)})`, !!(bend && bend.pull) && bend.pull.gain < 0.01);
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
  page.on("response", (r) => { const m = /el-cabeza-hall-([a-z-]+)\.(?:mp3|opus)/.exec(r.url()); if (m) fetched[m[1]] = r.status(); });
  await page.goto(URL_HTTP + "?scene=hall");
  const begin = page.locator('[data-testid="den-hall-preview"]');
  check("\"The hallway / Tap to begin\"", !!(await poll(async () => (await begin.count()) > 0, 30000)));
  await page.waitForTimeout(1500);
  await begin.click();
  check("a tap: the hall flares, its recordings fetched", !!(await poll(async () => FILES.every((k) => fetched[k] === 200), 10000)), JSON.stringify(fetched));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 8000 });
  await page.locator('[data-testid="den-hall-investigate"]').click();
  const h = await poll(async () => { const v = await page.evaluate(() => window.__DEN_HALL__()); return v.pull.heard.length ? v : null; }, 5000, 100);
  check(`investigate: the dread heard (${h && h.pull.heard.join(" ")})`, !!h && h.pull.heard[0] === "dread-walk");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- The About card ----
{
  console.log("the About card");
  const { ctx, page } = await home(URL_HTTP);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check(`his shout credited (LittleRobotSoundFactory, CC BY 4.0), and the dread's makers; not the man's voice that's gone`, /LittleRobotSoundFactory/.test(credits || "") && /CC BY 4\.0/.test(credits || "") && /ceich93/.test(credits || "") && /Brighella/.test(credits || "") && /Cloud-10/.test(credits || "") && !/dersuperanton/.test(credits || ""), credits);
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
  await page.evaluate(() => window.__DEN_HALL_SKIP__(12200));
  const roar = await poll(async () => { const v = await hall(); return v.pull.made.roars > 0 ? v : null; }, 4000, 100);
  check(`...the made sounds instead: the roar at the eruption (${roar && JSON.stringify(roar.pull.made)})`, !!roar && roar.pull.dread === "made" && roar.pull.made.roars === 1, JSON.stringify((await hall()).pull));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
