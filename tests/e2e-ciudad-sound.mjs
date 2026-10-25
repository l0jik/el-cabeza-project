/* The City's sound recorded (tools/ciudad_sounds.py; ciudad-audio.js; user:
   "go out onto the other resources and find real sounds, not synthesized
   for the city").

   Served over http (as GitHub Pages serves it):
   - the hour's loop is fetched; once a game's begun the city is the
     recording, the hour's loop playing and heard on the city's channel;
   - 10 PM picked on the clock: its loop fetched and the city crossfaded
     into it; then Afternoon, the same;
   - the About card credits the recordings, the CC BY ones by name.
   Opened from disk (a browser won't fetch a file beside it): the made city
   stands in, nothing is fetched, nothing thrown.

   node tests/e2e-ciudad-sound.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
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
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

async function visit(url, label) {
  console.log(label);
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [], fetched = {};
  page.on("pageerror", (e) => errs.push(e.message));
  let honks = null;
  page.on("response", (r) => { const m = /el-cabeza-ciudad-city-([a-z]+)\.(?:mp3|opus)/.exec(r.url()); if (m) fetched[m[1]] = r.status(); if (/el-cabeza-ciudad-honks\.(?:mp3|opus)/.test(r.url())) honks = r.status(); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(url);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000);
  await page.waitForTimeout(1000);
  await page.mouse.click(5, 380); // a gesture, for the sound
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  const st = () => page.evaluate(() => window.__CIUDAD_AUDIO__ && window.__CIUDAD_AUDIO__.debugState());
  return { page, errs, fetched, st, honksFetched: () => honks };
}
// The city's channel, its loudest over a couple of seconds (dBFS).
async function heard(page) {
  let most = -Infinity;
  for (let i = 0; i < 10; i++) { most = Math.max(most, await page.evaluate(() => window.__CIUDAD_AUDIO__.cityLevel())); await page.waitForTimeout(200); }
  return most;
}
async function pick(page, id) {
  await page.locator('[data-testid="ciudad-time-chip"]').click();
  await page.locator(`[data-testid="ciudad-time-${id}"]`).click();
  await page.keyboard.press("Escape");
}

{
  const { page, errs, fetched, st, honksFetched } = await visit(`http://127.0.0.1:${server.address().port}/el-cabeza-ciudad.html?time=morning`, "served over http");
  const s = await poll(async () => { const v = await st(); return v && v.city === "recording" && v.bed === "morning" ? v : null; }, 40000);
  check("once a game's begun, the city is the recording: the morning's loop", !!s, JSON.stringify(await st()));
  check("...fetched (and no other hour's yet)", fetched.morning === 200 && Object.keys(fetched).length === 1, JSON.stringify(fetched));
  const lvl = await heard(page);
  check(`...heard on the city's channel (${lvl.toFixed(1)} dBFS)`, lvl > -60 && lvl < -12, String(lvl));

  await pick(page, "night");
  const n = await poll(async () => { const v = await st(); return v && v.bed === "night" ? v : null; }, 20000);
  check("10 PM on the clock: the night's loop fetched, the city crossfaded into it", !!n && fetched.night === 200 && n.city === "recording", JSON.stringify({ st: await st(), fetched }));
  await pick(page, "afternoon");
  const a = await poll(async () => { const v = await st(); return v && v.bed === "afternoon" ? v : null; }, 20000);
  check("...then Afternoon: its loop", !!a && fetched.afternoon === 200, JSON.stringify({ st: await st(), fetched }));
  const al = await heard(page);
  check(`...heard (${al.toFixed(1)} dBFS)`, al > -60 && al < -12, String(al));
  // the horns (user: "gridlock traffic sound with honking ... like in
  // downtown New York ... but not overwhelming"): their file in, more by
  // day than at night, and a honk heard on the city's channel, no louder
  // than the city's own peaks allow
  const hs = await poll(async () => { const v = await st(); return v && v.honkFile ? v : null; }, 20000);
  check("the horns' file fetched", !!hs && honksFetched() === 200, JSON.stringify(await st()));
  check(`...about 5 honks a minute in the afternoon (${hs && hs.honksPerMin})`, !!hs && hs.honksPerMin === 5);
  const before = (await st()).honked;
  let loud = -Infinity;
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__CIUDAD_AUDIO__.testHonk()); for (let k = 0; k < 8; k++) { loud = Math.max(loud, await page.evaluate(() => window.__CIUDAD_AUDIO__.cityLevel())); await page.waitForTimeout(120); } }
  check(`...a honk played (${(await st()).honked - before} asked), the city's channel at most ${loud.toFixed(1)} dBFS`, (await st()).honked >= before + 3 && loud < -10, String(loud));

  // the About card's credits
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check("the About card credits the recordings (the CC BY ones by name)", !!credits && /gezortenplotz/.test(credits) && /freesound\.org\/s\/44796/.test(credits) && /CC BY 3\.0/.test(credits) && /saphe/.test(credits) && /freesound\.org\/s\/173955/.test(credits) && /freesound\.org\/s\/150993/.test(credits) && /CC BY 4\.0/.test(credits), credits || "");
  check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}
{
  const { page, errs, fetched, st } = await visit(`file://${path.join(DIST, "el-cabeza-ciudad.html")}`, "opened from disk");
  const s = await poll(async () => { const v = await st(); return v && v.ambience ? v : null; }, 20000);
  await page.waitForTimeout(1500);
  check("the made city stands in", !!s && (await st()).city === "made", JSON.stringify(await st()));
  check("...nothing fetched for the recordings", Object.keys(fetched).length === 0, JSON.stringify(fetched));
  await pick(page, "night");
  await page.waitForTimeout(1500);
  check("...an hour picked: still the made city, nothing fetched", (await st()).city === "made" && Object.keys(fetched).length === 0, JSON.stringify(await st()));
  const h0 = (await st()).honked;
  await page.evaluate(() => window.__CIUDAD_AUDIO__.testHonk());
  check("...a made horn stands in for the recorded ones", (await st()).honked === h0 + 1 || (await st()).honked === h0 + 2 || (await st()).honked === h0 + 3, JSON.stringify(await st()));
  check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
