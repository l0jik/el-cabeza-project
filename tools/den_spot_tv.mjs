/* The den's commercial as its television shows it (user: the stills
   showed "CRT lines and all that kind of stuff ... I don't see that in
   this version, the MP4"): the spot on the set's tube, through its
   screen (scanlines, the glass, the dark corners, the glow) in its bezel,
   recorded from the game itself, frame for frame, with its sound through
   the set's speaker (the same filter as den-ad-audio.js), at -16 LUFS.

   npm run build, then
   node tools/den_spot_tv.mjs [out.mp4]      (default el-cabeza-commercial-tv.mp4)

   Serves dist over http (WebGL won't take a video from disk), opens
   ?scene=commercial at 1280x960, taps it on, then drives the page's frame
   clock itself (requestAnimationFrame and performance.now): for each of
   the spot's 720 frames the time is set, the video put on that frame,
   one frame drawn and screenshotted, everything but the scene hidden.
   Needs an ffmpeg with libx264 (FFMPEG=path to use another). */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.resolve(process.argv[2] || "el-cabeza-commercial-tv.mp4");
const FF = process.env.FFMPEG || "ffmpeg";
const FRAMES = 720, FPS = 24;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
// (With byte ranges, as a real server answers a video's requests.)
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "den-spot-tv-"));

const browser = await chromium.launch({ executablePath: process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  // The frame clock: the page's own until taken, then ours.
  const realRAF = window.requestAnimationFrame.bind(window), realCAF = window.cancelAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let virtual = null, id = 1e7;
  const cbs = new Map();
  window.requestAnimationFrame = (cb) => { if (virtual == null) return realRAF(cb); const i = ++id; cbs.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { if (cbs.has(i)) cbs.delete(i); else realCAF(i); };
  performance.now = () => (virtual == null ? realNow() : virtual);
  window.__CAP__ = {
    take() { virtual = realNow() + 120; return virtual; }, // (ahead of any frame still due on the page's clock)
    at: () => virtual,
    set(t) { virtual = t; },
    run() { const list = [...cbs.values()]; cbs.clear(); list.forEach((cb) => { try { cb(virtual); } catch (e) { console.error(e); } }); },
  };
});
await page.goto(`http://localhost:${port}/el-cabeza-nova.html?scene=commercial`);
await page.waitForSelector('[data-testid="den-commercial-preview"]', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.locator('[data-testid="den-commercial-preview"]').click();
await page.waitForFunction(() => window.__DEN_TV__ && window.__DEN_TV__().phase === "commercial", null, { timeout: 15000 });
await page.addStyleTag({ content: "* { visibility: hidden !important; } canvas { visibility: visible !important; }" });
// The video placed by us, frame by frame, not played.
await page.evaluate(() => {
  const v = document.querySelector("video");
  v.pause(); v.play = () => Promise.resolve();
  window.__SEEK__ = (t) => new Promise((res) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && !v.seeking && v.readyState >= 2) { res(); return; }
    v.addEventListener("seeked", () => (v.readyState >= 2 ? res() : v.addEventListener("loadeddata", () => res(), { once: true })), { once: true });
    v.currentTime = t;
  });
});
// Taken in the commercial's first second (held on its first frame); then
// its start found on our clock.
await page.evaluate(() => window.__CAP__.take());
await page.waitForTimeout(400);
const t0 = await page.evaluate(() => {
  for (let i = 0; i < 400; i++) { window.__CAP__.set(window.__CAP__.at() + 5); window.__CAP__.run(); const ad = window.__DEN_TV__().ad; if (ad > 0) return window.__CAP__.at() - ad; }
  return null;
});
if (t0 == null) throw new Error("the commercial didn't start");
for (let k = 0; k < FRAMES; k++) {
  await page.evaluate((T) => window.__CAP__.set(T), t0 + (k / FPS) * 1000 + 0.5);
  await page.evaluate((t) => window.__SEEK__(t), k / FPS + 0.001);
  await page.evaluate(() => window.__CAP__.run());
  await page.screenshot({ path: path.join(tmp, `${String(k).padStart(3, "0")}.png`) });
  if (k % 120 === 0) console.log(`frame ${k}/${FRAMES}`);
}
await browser.close();
server.close();
if (errs.length) throw new Error("page errors: " + errs.join(" | "));

// The sound through the set's speaker (den-ad-audio.js), then to -16 LUFS.
const EQ = "highpass=f=120:width_type=q:width=0.6,equalizer=f=1700:width_type=q:width=0.8:g=1.5,lowpass=f=7500:width_type=q:width=0.5";
const eq = path.join(tmp, "eq.wav"), sound = path.join(tmp, "sound.wav");
execFileSync(FF, ["-v", "error", "-y", "-i", path.join(ROOT, "assets", "den", "spot-sound.mp3"), "-af", EQ, "-c:a", "pcm_s24le", eq]);
// (ebur128's summary, on stderr: its integrated loudness, the last "I:".)
const summary = spawnSync(FF, ["-hide_banner", "-nostats", "-i", eq, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
const loud = Number(([...summary.matchAll(/^\s+I:\s+(-?[0-9.]+) LUFS/gm)].pop() || [])[1]);
const level = Number.isFinite(loud) ? -16 - loud : 0;
execFileSync(FF, ["-v", "error", "-y", "-i", eq, "-af", `volume=${level.toFixed(2)}dB,alimiter=limit=0.891:attack=5:release=60:level=disabled:latency=1`, "-c:a", "pcm_s24le", sound]);
execFileSync(FF, ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(tmp, "%03d.png"), "-i", sound, "-map", "0:v", "-map", "1:a",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", OUT]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("wrote", OUT, fs.statSync(OUT).size, "bytes");
