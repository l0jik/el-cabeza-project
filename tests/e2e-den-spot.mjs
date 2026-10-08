/* The den's commercial is the user's spot (user: "put it on the den's
   TV", in place of the drawn one): back from the Singularity the first
   time, the set plays the video (themes/den-commercial.js), kept to the
   commercial's clock, its sound decoded ahead (den-ad-audio.js), and goes
   off after its 30 s. Served over http (from disk, WebGL won't take a
   video: there the tube shows snow); this Chromium has no H.264, so it
   plays the VP9 copy. A new player, still in the store, isn't sent the
   video yet (it's 2.8 MB; it loads once the Singularity's open).

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
check("back from the Singularity: the commercial on the set", !!(await poll(() => page.evaluate(() => window.__DEN_TV__().phase === "commercial"), 10000)));
const shots = process.env.EC_SHOTS;
// Its video on the tube, and in step with the commercial's clock.
const sync = [];
for (const at of [3, 9, 15, 24]) {
  await poll(() => page.evaluate((s) => (window.__DEN_TV__().ad || 0) >= s * 1000, at), 30000, 100);
  const r = await page.evaluate(() => ({ ad: window.__DEN_TV__().ad / 1000, v: window.__DEN_SPOT__() }));
  sync.push({ ad: +r.ad.toFixed(2), t: +r.v.t.toFixed(2), paused: r.v.paused });
  if (shots) await page.screenshot({ path: `${shots}/spot-${at}.png` });
}
check(`...playing, in step with it (${JSON.stringify(sync)})`, sync.every((s) => !s.paused && Math.abs(s.t - s.ad) < 0.4));
check("then it's aired: off, and the camera back from the set", !!(await poll(() => page.evaluate(() => { const s = window.__DEN_TV__(); return s.phase === "off" && s.focus < 0.01; }), 20000, 250)));
check("...its video stopped", await page.evaluate(() => window.__DEN_SPOT__().paused));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
