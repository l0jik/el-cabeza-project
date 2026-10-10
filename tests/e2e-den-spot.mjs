/* The den's commercial is the user's spot (user: "put it on the den's
   TV", in place of the drawn one): back from the Singularity the first
   time, after a moment home (a thought, then the set switching itself
   on), the set plays the video (themes/den-commercial.js), kept with its
   sound as it's heard, the sound decoded ahead (den-ad-audio.js), and
   goes off after its 30 s; then another thought. Served over http (from disk, WebGL won't take a
   video: there the tube shows snow); this Chromium has no H.264, so it
   plays the VP9 copy. A new player, still in the store, isn't sent the
   video yet (it's 2.8 MB; it loads once the Singularity's open). Its own
   link, ?scene=commercial, plays it on the set after a tap.

   node tests/e2e-den-spot.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };
// (With byte ranges, as a real server answers a video's requests.)
const asked = [];
const server = http.createServer((req, res) => {
  asked.push(req.url);
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
{
  // A new player: the store, the story's start; the spot's sound may come
  // early, its video not.
  const fresh = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p0 = await fresh.newPage();
  await p0.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await p0.goto(`http://localhost:${port}/el-cabeza-nova.html`);
  await p0.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 30000 }).catch(() => {});
  await p0.waitForTimeout(3000);
  check("a new player, in the store: the spot's video not sent yet", !asked.some((u) => /den-spot\.(mp4|webm)/.test(u)) && (await p0.evaluate(() => !(window.__DEN_SPOT__ && window.__DEN_SPOT__().src))), asked.filter((u) => /den-spot/.test(u)).join(" "));
  await fresh.close();
}
{
  // Its own link (user: a direct link to see it on the set): the den, a
  // card to tap (the sound needs one), then the set on with the spot, as
  // home from the Singularity; no lure, nothing kept.
  const sc = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p1 = await sc.newPage();
  const errs1 = [];
  p1.on("pageerror", (e) => errs1.push(e.message));
  await p1.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await p1.goto(`http://localhost:${port}/el-cabeza-nova.html?scene=commercial`);
  const card = p1.locator('[data-testid="den-commercial-preview"]');
  check("?scene=commercial: the den, \"The commercial\", tap to begin", !!(await poll(async () => (await card.count()) && /The commercial/.test(await card.innerText()), 30000)));
  await card.click();
  check("...a tap: the set on, the spot playing", !!(await poll(() => p1.evaluate(() => { const v = window.__DEN_SPOT__ && window.__DEN_SPOT__(); return window.__DEN_TV__().phase === "commercial" && v && !v.paused && v.t > 1; }), 15000)));
  check("...no lure, nothing kept", await p1.evaluate(() => !window.__DEN_TV__().lure && !localStorage.getItem("el-cabeza:commercial-aired")));
  check("...no page errors", errs1.length === 0, errs1.join(" | "));
  if (process.env.EC_SHOTS) { await p1.waitForTimeout(4000); await p1.screenshot({ path: `${process.env.EC_SHOTS}/scene-link.png` }); }
  await sc.close();
}
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      // Home, the Singularity seen, its commercial still to come.
      localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
      localStorage.setItem("el-cabeza:singularity-seen", "1");
      localStorage.setItem("el-cabeza:special-order-noted", "1");
    }
  } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/el-cabeza-nova.html`);
check("home, in the den", !!(await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000)));
check("the spot's sound, fetched and decoded ahead", !!(await poll(() => page.evaluate(() => { const a = window.__EC_AD__ && window.__EC_AD__(); return a && a.rendered && Math.abs(a.seconds - 30) < 0.5; }), 20000)));
check("...and its picture loading", !!(await poll(() => page.evaluate(() => { const s = window.__DEN_SPOT__ && window.__DEN_SPOT__(); return s && s.ready >= 2 && /el-cabeza-den-spot\.(webm|mp4)$/.test(s.src); }), 20000)), JSON.stringify(await page.evaluate(() => window.__DEN_SPOT__ && window.__DEN_SPOT__())));
await page.evaluate(() => window.__DEN_TV_AIR__());
// Home first (user: the cut straight to it was "a bit abrupt"): the set
// dark and the camera on the board; "Phew… I'm home. What just
// happened?!"; then the set switches itself on, the camera goes over, and
// the commercial locks in.
const first = await poll(() => page.evaluate(() => { const s = window.__DEN_TV__(); return s.waking === "dark" && { phase: s.phase, focus: s.focus }; }), 5000, 50);
check(`back from the Singularity: home first, the set dark, the camera on the board (${JSON.stringify(first)})`, !!first && first.phase === "off" && first.focus < 0.05);
const phew = await poll(() => page.evaluate(() => { const c = document.querySelector('[data-testid="den-phew"]'); return c && { text: c.innerText.trim(), phase: window.__DEN_TV__().phase }; }), 6000, 100);
check(`...a thought (${JSON.stringify(phew)})`, !!phew && phew.text === "Phew… I'm home. What just happened?!" && phew.phase === "off");
const woke = await poll(() => page.evaluate(() => { const s = window.__DEN_TV__(); return s.waking === "woke" && /^(warming|snow)$/.test(s.phase) && { phase: s.phase, goal: s.goal }; }), 8000, 50);
check(`...then the set switches itself on, the camera going over (${JSON.stringify(woke)})`, !!woke && woke.goal === 1);
check("...and the commercial locks in on the set", !!(await poll(() => page.evaluate(() => window.__DEN_TV__().phase === "commercial"), 10000)));
check("...the thought gone by then", await page.evaluate(() => !document.querySelector('[data-testid="den-phew"]') || document.querySelector('[data-testid="den-phew"]').classList.contains("off")));
// Its first frame's a living room like this one (user: "wait, is that my
// house?"): held there, the camera slowly pushing in on it, and the
// thought, before it plays (its sound set to start with it).
const house = await poll(() => page.evaluate(() => { const c = document.querySelector('[data-testid="den-house"]'); const s = window.__DEN_TV__(); return c && { text: c.innerText.trim(), ad: s.ad, watch: +s.watch.toFixed(2) }; }), 4000, 50);
check(`...held on its first frame, the camera pushing in, and a thought (${JSON.stringify(house)})`, !!house && house.text === "Wait… is that my house?" && house.ad === 0 && house.watch > 0.02 && house.watch < 0.9);
const plays = await poll(() => page.evaluate(() => { const s = window.__DEN_TV__(); const c = document.querySelector('[data-testid="den-house"]'); return s.ad > 0 && { watch: +s.watch.toFixed(2), card: c ? (c.classList.contains("off") ? "going" : "up") : "gone" }; }), 8000, 50);
check(`...then it plays, the camera in close, the thought gone or going (${JSON.stringify(plays)})`, !!plays && plays.watch > 0.97 && plays.card !== "up");
const shots = process.env.EC_SHOTS;
// Its video on the tube, with the sound as it's heard (user: the voice
// wasn't with the lips). Every 100 ms or so, against the moment of the
// spot reaching the ears (the audio clock's output timestamp, less when
// the sound was set to start): the video's own clock, and the frame last
// put on the screen carried on to now (this browser, drawing without a
// GPU, puts one up only every 0.1-0.2 s). + is the picture ahead. Lip
// sync is noticed past about 45 ms with the sound early, 125 ms with it
// late (ITU-R BT.1359); before, the picture ran about 100 ms ahead here.
// Both less the lead the den aims the video by (den-commercial.js: a
// frame drawn now reaches the screen about a frame later, so the video
// runs that much ahead of the sound, to 50 ms): what's measured here is
// the video itself, before the frame that shows it is put up. (Without
// it, the check read the lead as a fault, and failed or passed as this
// slow browser happened to draw a few frames under 100 ms or not.)
await page.evaluate(() => {
  window.__SYNC__ = [];
  let vf = null, watched = null;
  setInterval(() => {
    const a = window.__EC_AD_SCHED__, v = [...document.querySelectorAll("video")].find((x) => /den-spot/.test(x.currentSrc));
    if (v && v !== watched && v.requestVideoFrameCallback) {
      watched = v;
      const cb = (now, md) => { vf = { disp: md.expectedDisplayTime, media: md.mediaTime }; v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
    }
    if (!a || !v || !vf || v.paused) return;
    const perf = performance.now(), ts = a.ctx.getOutputTimestamp();
    const heard = ts.contextTime + (perf - ts.performanceTime) / 1000 - a.T;
    const shown = vf.media + Math.max(0, perf - vf.disp) / 1000 * v.playbackRate;
    const lead = (window.__DEN_SPOT__ && window.__DEN_SPOT__().lead) || 0;
    window.__SYNC__.push({ heard, clock: v.currentTime - heard - lead, shown: shown - heard - lead, lead });
  }, 100);
});
const sync = [];
for (const at of [3, 9, 15, 24]) {
  await poll(() => page.evaluate((s) => (window.__DEN_TV__().ad || 0) >= s * 1000, at), 30000, 100);
  const r = await page.evaluate(() => ({ ad: window.__DEN_TV__().ad / 1000, v: window.__DEN_SPOT__() }));
  sync.push({ ad: +r.ad.toFixed(2), t: +r.v.t.toFixed(2), paused: r.v.paused });
  if (shots) await page.screenshot({ path: `${shots}/spot-${at}.png` });
}
check(`...playing (${JSON.stringify(sync)})`, sync.every((s) => !s.paused && Math.abs(s.t - s.ad) < 0.4));
{
  // (The first second left out: the video's start, rolling up to the sound.)
  const rows = await page.evaluate(() => window.__SYNC__.filter((r) => r.heard > 1 && r.heard < 29));
  const ms = (x) => Math.round(x * 1000);
  for (const [what, key] of [["the video's clock", "clock"], ["the frame on the screen", "shown"]]) {
    const offs = rows.map((r) => r[key]).sort((p, q) => p - q);
    const mean = offs.reduce((s, x) => s + x, 0) / Math.max(1, offs.length);
    const within = offs.filter((x) => x > -0.045 && x < 0.06).length / Math.max(1, offs.length);
    const lead = rows.reduce((s, r) => s + r.lead, 0) / Math.max(1, rows.length);
    check(`...${what} with the sound as heard (${offs.length} samples: mean ${ms(mean)} ms, ${Math.round(within * 100)}% within -45..+60 ms, ${ms(offs[0] || 0)}..${ms(offs[offs.length - 1] || 0)} ms; aimed ${ms(lead)} ms ahead)`, offs.length >= 40 && mean > -0.03 && mean < 0.045 && within >= 0.95);
  }
}
// After it (user): as the camera sets off back to the table, a thought.
const okay = await poll(() => page.evaluate(() => { const c = document.querySelector('[data-testid="den-okay"]'); const s = window.__DEN_TV__(); return c && { text: c.innerText.trim(), phase: s.phase, focus: +s.focus.toFixed(2) }; }), 20000, 100);
check(`then it's aired, and as the camera heads back: "Uhh, Okaaaay....." (${JSON.stringify(okay)})`, !!okay && okay.text === "Uhh, Okaaaay....." && /^(closing|off)$/.test(okay.phase) && okay.focus > 0.05);
check("then it's aired: off, and the camera back from the set", !!(await poll(() => page.evaluate(() => { const s = window.__DEN_TV__(); return s.phase === "off" && s.focus < 0.01; }), 20000, 250)));
check("...and the thought goes after a few seconds", !!(await poll(() => page.evaluate(() => !document.querySelector('[data-testid="den-okay"]')), 8000, 200)));
check("...its video stopped", await page.evaluate(() => window.__DEN_SPOT__().paused));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
