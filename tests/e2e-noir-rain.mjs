/* Noir's rain is a recording made of drops (user: "Noir's rain sound is
   still not right ... it's like white noise"; tools/noir_rain.py), beside
   the page as el-cabeza-noir-rain.mp3.

   - Served over http (as GitHub Pages serves it): the page fetches the
     recording, and once a game's begun the rain is the recording.
   - Opened from disk (a browser won't fetch a file beside it): the made
     rain stands in, and nothing's thrown.

   node tests/e2e-noir-rain.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 250) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

async function visit(url, label) {
  console.log(label);
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [], fetched = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => { if (/el-cabeza-noir-rain\.mp3/.test(r.url())) fetched.push(r.status()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(url);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000);
  await page.waitForTimeout(1000);
  await page.mouse.click(5, 380); // a gesture, for the sound
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  const st = () => page.evaluate(() => window.__NOIR_AUDIO__ && window.__NOIR_AUDIO__.debugState());
  return { page, errs, fetched, st };
}

{
  const { page, errs, fetched, st } = await visit(`http://127.0.0.1:${server.address().port}/el-cabeza-noir.html`, "served over http");
  const s = await poll(async () => { const v = await st(); return v && v.rain === "recording" ? v : null; }, 30000);
  check("the recording is fetched", fetched.includes(200), JSON.stringify(fetched));
  check("...and once a game's begun, the rain is the recording", !!s, JSON.stringify(await st()));
  check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}
{
  const { page, errs, fetched, st } = await visit(`file://${path.join(DIST, "el-cabeza-noir.html")}`, "opened from disk");
  const s = await poll(async () => { const v = await st(); return v && v.ambience ? v : null; }, 20000);
  await page.waitForTimeout(1500);
  const s2 = await st();
  check("the made rain stands in", !!s && s2 && s2.rain === "made", JSON.stringify(s2));
  check("...nothing fetched for it", fetched.length === 0, JSON.stringify(fetched));
  check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
