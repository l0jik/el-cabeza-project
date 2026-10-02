/* The late-night commercial's soundtrack, rendered once into a recording
   beside the page (themes/den-ad-audio.js TRACK_URL): the score
   (den-ad-audio.js compose) rendered offline in Chromium, the user's four
   voices mixed in, then encoded with ffmpeg. Playing one recording is as
   clean on a phone as anywhere; building the score live at the moment it
   played (a few thousand nodes) wasn't (user, an Android phone: five
   seconds of nothing, then garbled).

   After changing the score: npm run build, then
   node tools/den_ad_render.mjs   -> assets/den/ad-soundtrack.mp3
   and build again (build/build.js ships it as el-cabeza-den-ad.mp3). */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist"), OUT = path.join(ROOT, "assets", "den", "ad-soundtrack.mp3");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/el-cabeza-standard.html`);
await page.waitForFunction(() => !!window.__EC_AD_RENDER_SCORE__, null, { timeout: 30000 });
const { wav, peak, seconds } = await page.evaluate(() => window.__EC_AD_RENDER_SCORE__());
await browser.close();
server.close();
const tmp = path.join(ROOT, "assets", "den", ".ad-soundtrack.wav");
fs.writeFileSync(tmp, Buffer.from(wav, "base64"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "128k", OUT]);
fs.unlinkSync(tmp);
console.log(`${OUT}: ${seconds.toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
