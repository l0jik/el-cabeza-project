/* The way into the Singularity, recorded, where the audio can't make it live
   (user, on a Chromebook: "The sound when traveling through the black hole
   still isn't happening on the Chromebook"; themes/futuris.js WAY_IN and its
   way-in, themes/futuris-summon-audio.js's recorded clap). Made live, the
   tap starts five long reverbs at once and the audio thread of a slow
   machine plays what it can't make in time as silence; where the reverbs
   are light (a phone, a Chromebook, two cores or fewer, 4 GB or less), the
   toll, the hum, the fall and the summons' last clap play from recordings
   of that same sound.

   Served over HTTP (recordings aren't fetched from disk):
   1. Futuris's page on a light machine: the recordings asked for as the
      invite comes up and here by the tap; the bell, the hum, then the fall
      from them, no long reverb made from the tap on; the fall heard through
      the collapse, master silent after the cut, the bell ringing on.
   2. The recordings arriving after the tap: the toll live, the fall from
      its recording all the same, heard through the collapse.
   3. Nova's story, the summons first: its last clap from its recording
      too, its tail heard on the summons' own way out.
   4. A desktop: all of it made live, nothing asked for.
   5. A light machine told "ec:way-in" = "live": made live.

   node tests/e2e-way-in.mjs */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json", ".css": "text/css", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm" };
// (The way in's files held back while held, for the late case: let go
// just after the tap.)
let holdWayIn = false;
const held = [];
const letGo = () => { holdWayIn = false; held.splice(0).forEach((f) => f()); };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  const send = () => { res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); };
  if (/way-in-/.test(f) && holdWayIn) held.push(send); else send();
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 20000, step = 100) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

async function open(url, { light = true, live = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(({ light, live }) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      localStorage.setItem("ec:reverbs", light ? "light" : "full");
      if (live) localStorage.setItem("ec:way-in", "live");
    } catch (e) { /* none */ }
    // Every reverb made, and when (from the tap, once it's set).
    window.__CONVS__ = [];
    const d = Object.getOwnPropertyDescriptor(ConvolverNode.prototype, "buffer");
    Object.defineProperty(ConvolverNode.prototype, "buffer", { get() { return d.get.call(this); }, set(b) {
      if (b) window.__CONVS__.push({ t: window.__T0__ == null ? null : performance.now() - window.__T0__, s: b.length / b.sampleRate });
      return d.set.call(this, b);
    } });
    // Each way out of the game's sound metered (its peak a quarter second,
    // from the tap), named by its level as it's connected: master, the
    // bell's bus, the summons' own way out.
    window.__METERS__ = [];
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest && dest.__ecOutput && !this.__tap) {
        const ac = this.context, sp = ac.createScriptProcessor(2048, 2, 2), g = this.gain ? this.gain.value : 0;
        const m = { name: g > 8.5 ? "summons" : g > 5 ? "master" : g > 1 ? "bell" : "other", b: [] };
        sp.onaudioprocess = (e) => {
          if (window.__T0__ == null) return;
          const k = Math.floor((performance.now() - window.__T0__) / 250);
          for (let ch = 0; ch < e.inputBuffer.numberOfChannels; ch++) { const x = e.inputBuffer.getChannelData(ch); for (let i = 0; i < x.length; i += 2) { const a = Math.abs(x[i]); if (!(m.b[k] >= a)) m.b[k] = a; } }
        };
        sp.__tap = true;
        orig.call(sp, ac.destination);
        orig.call(this, sp);
        window.__METERS__.push(m);
      }
      return orig.call(this, dest, ...rest);
    };
  }, { light, live });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  return { ctx, page, errs };
}
const way = (page) => page.evaluate(() => (window.__EC_WAY_IN__ ? window.__EC_WAY_IN__() : null));
const phase = (page) => page.evaluate(() => { const s = (window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__().singularity) || {}; return s.phase || null; });
// The invite, from the masthead's five taps.
async function invite(page) {
  await poll(() => page.evaluate(() => !!document.querySelector(".ec-title") && !!window.__EC_TEST_THREE__), 30000);
  await page.waitForTimeout(1200);
  const tb = await page.locator(".ec-title").first().boundingBox();
  const up = () => page.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn"));
  for (let a = 0; a < 3 && !(await up()); a++) {
    for (let i = 0; i < 5; i++) { await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(140); }
    await page.waitForTimeout(300);
    if (!(await up())) await page.waitForTimeout(2700);
  }
  return up();
}
// The tap on SINGULARITY, the clock from it; then the fall's start and the cut, in ms from the tap.
async function tap(page) {
  const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
  await page.evaluate(() => { window.__T0__ = performance.now(); window.__PH__ = {}; const tick = () => { const s = (window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__().singularity) || {}; if (s.phase && window.__PH__[s.phase] == null) window.__PH__[s.phase] = performance.now() - window.__T0__; if (performance.now() - window.__T0__ < 15000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
// (Dense: a quarter second the page's thread was held up has no reading,
// and a hole would come over as undefined and make every max NaN.)
const meters = (page) => page.evaluate(() => ({ ph: window.__PH__, m: window.__METERS__.map((m) => ({ name: m.name, b: Array.from(m.b, (x) => x || 0) })), convs: window.__CONVS__ }));
const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -99);
// The loudest quarter second of a way out between two times (ms from the tap).
const peakIn = (m, a, b) => (m ? m.b.slice(Math.ceil(a / 250), Math.floor(b / 250)).reduce((p, x) => Math.max(p, x || 0), 0) : 0);
// What the fall's meters say: master heard through the collapse, silent after the cut, the bell on past it.
// (bellFloor: a bell made live with the light reverbs rings out sooner.)
async function heard(page, label, { bellFloor = -45 } = {}) {
  await poll(async () => (await phase(page)) === "sphere", 20000);
  await page.waitForTimeout(1200);
  const r = await meters(page);
  const master = r.m.find((m) => m.name === "master"), bell = r.m.find((m) => m.name === "bell");
  const c = r.ph.collapsing, k = r.ph.blackout;
  const fall = peakIn(master, c + 500, k - 250), after = peakIn(master, k + 350, k + 1300), ring = peakIn(bell, k + 250, k + 1250);
  check(`${label}: the fall heard through the collapse (${dB(fall).toFixed(0)} dB), silent after the cut (${dB(after).toFixed(0)} dB), the bell ringing on (${dB(ring).toFixed(0)} dB)`,
    c != null && k != null && dB(fall) > -30 && dB(after) < -60 && dB(ring) > bellFloor, JSON.stringify({ ph: r.ph, names: r.m.map((m) => m.name) }));
  return r;
}

/* ---- 1. Futuris's page, a light machine ---- */
console.log("Futuris's page, a light machine: the way in from its recordings");
{
  const { ctx, page, errs } = await open(`${BASE}/el-cabeza-futuris.html`);
  check("the SINGULARITY invite is up", await invite(page));
  const w0 = await poll(async () => { const w = await way(page); return w && w.ready ? w : null; }, 10000);
  check("the recordings asked for as the invite came up, and here", !!w0 && w0.light && w0.asked, JSON.stringify(await way(page)));
  await tap(page);
  const w1 = await poll(async () => { const w = await way(page); return w && w.bell && w.hum ? w : null; }, 3000);
  check(`the bell and the toll's hum from them (${JSON.stringify(w1)})`, !!w1 && w1.bell === "recorded" && w1.hum === "recorded" && w1.bells === 1);
  const w2 = await poll(async () => { const w = await way(page); return w && w.fall ? w : null; }, 12000);
  check(`...and the fall (${JSON.stringify(w2)})`, !!w2 && w2.fall === "recorded");
  const r = await heard(page, "recorded");
  const late = r.convs.filter((c) => c.t != null && c.t > 0 && c.t < (r.ph.blackout || 9999) && c.s > 1);
  check(`no long reverb made from the tap to the cut (${late.map((c) => c.s.toFixed(1) + " s").join(", ") || "none"})`, late.length === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 2. the recordings late ---- */
console.log("\nThe recordings arriving after the tap: the toll live, the fall from its recording");
{
  holdWayIn = true;
  const { ctx, page, errs } = await open(`${BASE}/el-cabeza-futuris.html`);
  check("the SINGULARITY invite is up", await invite(page));
  check("...the recordings asked for, not here yet", !!(await poll(async () => { const w = await way(page); return w && w.asked && !w.ready; }, 5000)), JSON.stringify(await way(page)));
  await tap(page);
  await page.waitForTimeout(300);
  letGo();
  const w1 = await poll(async () => { const w = await way(page); return w && w.bell && w.hum ? w : null; }, 3000);
  check(`the tap before they're here: the bell and the hum made live (${JSON.stringify(w1)})`, !!w1 && w1.bell === "live" && w1.hum === "live" && !w1.ready);
  const w2 = await poll(async () => { const w = await way(page); return w && w.fall ? w : null; }, 12000);
  check(`...here by the collapse: the fall from its recording (${JSON.stringify(w2)})`, !!w2 && w2.fall === "recorded");
  await heard(page, "live, then recorded", { bellFloor: -65 });
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 3. Nova's story: the summons, then the way in ---- */
console.log("\nNova's story on a light machine: the summons' last clap recorded too");
{
  const { ctx, page, errs } = await open(`${BASE}/el-cabeza-nova.html?scene=summons`);
  const S = () => page.evaluate(() => (window.__EC_SUMMON__ ? window.__EC_SUMMON__() : { active: false }));
  check("the summons is up", !!(await poll(async () => { const s = await S(); return s.active && s.ready; }, 40000)));
  await poll(async () => { const s = await S(); return s.waves >= 1 && s.sound && s.sound.thunder >= 1; }, 40000);
  const c0 = await poll(() => page.evaluate(() => { const c = window.__EC_SUMMON_CLAP__ && window.__EC_SUMMON_CLAP__(); return c && c.ready ? c : null; }), 10000);
  check("the last clap's recording here before the tap", !!c0 && c0.light, JSON.stringify(await page.evaluate(() => window.__EC_SUMMON_CLAP__ && window.__EC_SUMMON_CLAP__())));
  await page.mouse.click((await S()).screen.x, (await S()).screen.y);
  await poll(() => page.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn")), 5000);
  await poll(async () => { const w = await way(page); return w && w.ready; }, 10000);
  await tap(page);
  const c1 = await poll(() => page.evaluate(() => { const c = window.__EC_SUMMON_CLAP__ && window.__EC_SUMMON_CLAP__(); return c && c.clap ? c : null; }), 3000);
  check(`the tap: the last clap from its recording (${JSON.stringify(c1)})`, !!c1 && c1.clap === "recorded");
  const w = await poll(async () => { const x = await way(page); return x && x.fall ? x : null; }, 12000);
  check(`...the bell and the fall from theirs (${JSON.stringify(w)})`, !!w && w.bell === "recorded" && w.fall === "recorded");
  const r = await heard(page, "the story's");
  const tail = r.m.find((m) => m.name === "summons");
  // (Through the fall, where its tail rings on: the meters run on the
  // page's own thread, which the fall's making-ready can hold up for a
  // moment after the tap.)
  const tailPeak = peakIn(tail, 250, r.ph.blackout || 6000);
  check(`the clap's tail heard on the summons' way out, through the fall (${dB(tailPeak).toFixed(0)} dB)`, dB(tailPeak) > -45, JSON.stringify(r.m.map((m) => [m.name, m.b.slice(0, 24).map((x) => Math.round(dB(x)))])));
  const late = r.convs.filter((c) => c.t != null && c.t > 0 && c.t < (r.ph.blackout || 9999) && c.s > 1);
  check(`no long reverb made from the tap to the cut (${late.map((c) => c.s.toFixed(1) + " s").join(", ") || "none"})`, late.length === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 4. a desktop ---- */
console.log("\nA desktop: made live");
{
  const { ctx, page, errs } = await open(`${BASE}/el-cabeza-futuris.html`, { light: false });
  check("the SINGULARITY invite is up", await invite(page));
  await page.waitForTimeout(1500);
  await tap(page);
  const w = await poll(async () => { const x = await way(page); return x && x.fall ? x : null; }, 12000);
  check(`nothing asked for; the bell, the hum and the fall made live (${JSON.stringify(w)})`, !!w && !w.light && !w.asked && w.bell === "live" && w.fall === "live");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 5. a light machine, told to make it live ---- */
console.log("\nA light machine with ec:way-in = live: made live");
{
  const { ctx, page, errs } = await open(`${BASE}/el-cabeza-futuris.html`, { light: true, live: true });
  check("the SINGULARITY invite is up", await invite(page));
  await page.waitForTimeout(1500);
  await tap(page);
  const w = await poll(async () => { const x = await way(page); return x && x.bell ? x : null; }, 5000);
  check(`nothing asked for; the bell made live (${JSON.stringify(w)})`, !!w && w.light && !w.asked && w.bell === "live");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
