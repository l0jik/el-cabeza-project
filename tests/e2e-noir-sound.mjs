/* Noir's recorded sounds (tools/noir_sounds.py; noir-audio.js), and the
   sound menu's sliders for them (user: "make sure you get some better
   rain sounds, too ... it definitely will need its own volume toggle";
   "add car sounds, real recordings").

   Served over http (as GitHub Pages serves it):
   - every recording is fetched: the rain, two thunders, the car's engine,
     its rev and its tyres; once a game's begun the rain is the recording;
   - the sound menu has All sounds, Rain, The city and Pieces; Rain all the
     way down turns the rain channel down, and back up;
   - a car sent down a street is heard: its engine at a street's pace
     (pitched up from its idle), revving as it pulls out of its turn in,
     and quiet again once it's gone;
   - the thunder plays (a recording) with nothing thrown;
   - the About card credits the recordings, the CC BY one by name.
   Opened from disk (a browser won't fetch a file beside it): the made rain
   stands in, nothing is fetched, no car is heard, nothing's thrown.

   node tests/e2e-noir-sound.mjs */
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
const FILES = ["rain", "thunder-1", "thunder-2", "car-engine", "car-rev", "car-tyres"];

async function visit(url, label) {
  console.log(label);
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [], fetched = {};
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => { const m = /el-cabeza-noir-([a-z0-9-]+)\.mp3/.exec(r.url()); if (m) fetched[m[1]] = r.status(); });
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
  const s = await poll(async () => { const v = await st(); return v && v.rain === "recording" && v.carsReady && v.thunder === 2 ? v : null; }, 40000);
  check(`every recording fetched (${FILES.join(", ")})`, FILES.every((f) => fetched[f] === 200), JSON.stringify(fetched));
  check("...once a game's begun, the rain is the recording; the thunder and the car ready", !!s, JSON.stringify(await st()));

  // the sliders
  await page.evaluate(() => document.querySelector('[data-testid="sound-button"]').click());
  await page.waitForTimeout(700);
  const sliders = await page.evaluate(() => ["sound-all", "sound-ch-rain", "sound-ch-city", "sound-ch-pieces"].map((k) => !!document.querySelector(`[data-testid="${k}"]`)));
  const labels = await page.evaluate(() => (document.querySelector('[data-testid="sound-menu"]') || {}).innerText || "");
  check("the sound menu: All sounds, Rain, The city, Pieces", sliders.every(Boolean) && /Rain/.test(labels) && /The city/.test(labels) && /Pieces/.test(labels), JSON.stringify({ sliders, labels }));
  await page.locator('[data-testid="sound-ch-rain"]').fill("0");
  const down = await poll(async () => { const v = await st(); return v && v.levels.rain === 0 ? v : null; }, 4000);
  check("Rain all the way down: the rain channel off, the others as they were", !!down && down.levels.city === 1 && down.levels.pieces === 1, JSON.stringify(await st()));
  await page.locator('[data-testid="sound-ch-rain"]').fill("100");
  check("...and back up", !!(await poll(async () => { const v = await st(); return v && v.levels.rain === 1 ? v : null; }, 4000)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // a car down a street: met in its turn in (cars crawl on the software
  // renderer, a frame's step capped, so it's put there, not waited for)
  await poll(() => page.evaluate(() => !!window.__NOIR_TRAFFIC__), 10000);
  await page.evaluate(() => { window.__NOIR_TRAFFIC__.pace(600000); window.__NOIR_TRAFFIC__.spawn({ street: [true, 3], at: 0.165 }); });
  const heard = await poll(async () => { const v = await st(); return v && v.car && v.car.gain > 0 ? v : null; }, 10000, 150);
  check("a car on the board is heard", !!heard, JSON.stringify(await st()));
  const revs = await poll(async () => { const v = await st(); return v && v.car && v.car.revving ? v : null; }, 45000, 100);
  check("...revving as it pulls out of its turn into the street", !!revs, JSON.stringify(await st()));
  const street = await poll(async () => { const v = await st(); return v && v.car && !v.car.revving && Math.abs(v.car.rate - 1.32) < 0.03 ? v : null; }, 25000, 200);
  check(`...its engine at a street's pace, pitched up from its idle (${street && street.car.rate})`, !!street, JSON.stringify(await st()));
  // (and one near the end of its way: it goes, and so does its sound)
  await page.evaluate(() => window.__NOIR_TRAFFIC__.spawn({ street: [true, 3], at: 0.97 }));
  const gone = await poll(async () => { const v = await st(); const t = await page.evaluate(() => window.__NOIR_TRAFFIC__.state().car); return v && !v.car && !t ? v : null; }, 45000, 300);
  check("...and quiet once it's gone", !!gone, JSON.stringify(await st()));

  // the thunder
  await page.evaluate(() => window.__NOIR_AUDIO__.thunder());
  await page.waitForTimeout(500);

  // the About card's credits
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check("the About card credits the recordings (the CC BY one by name)", !!credits && /lonemonk/.test(credits) && /CC BY 4\.0/.test(credits) && /freesound\.org\/s\/62566/.test(credits) && /Breviceps/.test(credits), credits || "");
  check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}
{
  const { page, errs, fetched, st } = await visit(`file://${path.join(DIST, "el-cabeza-noir.html")}`, "opened from disk");
  await poll(async () => { const v = await st(); return v && v.ambience ? v : null; }, 20000);
  await page.waitForTimeout(1500);
  const s = await st();
  check("the made rain stands in", s && s.rain === "made", JSON.stringify(s));
  check("...nothing fetched for the recordings", Object.keys(fetched).length === 0, JSON.stringify(fetched));
  await poll(() => page.evaluate(() => !!window.__NOIR_TRAFFIC__), 10000);
  await page.evaluate(() => window.__NOIR_TRAFFIC__.spawn({ street: [true, 3] }));
  await page.waitForTimeout(2500);
  const c = await st();
  check("...no car heard", c && !c.carsReady && !c.car, JSON.stringify(c));
  await page.evaluate(() => window.__NOIR_AUDIO__.thunder());
  await page.waitForTimeout(300);
  check("nothing thrown (the made thunder too)", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
