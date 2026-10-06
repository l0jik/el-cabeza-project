/* The sound menu's now-playing strip (chassis/NowPlaying.jsx), in every
   place with music (user: "Go with option 4, all themes with music, being
   careful to ensure there is no overlap"), on a phone-sized screen:

   - Orinoco and Watermark: the look's soundtrack, from Begin Game;
   - Big Glutts: the store's tape, once the box is opened;
   - the den: a record put on from the stereo's panel;
   - Neon (no music): no strip.

   In each: the strip shows the title and the time, and the time moves on;
   its button pauses (the time holds) and plays again (it moves on from
   there); the button, the title and the time don't overlap, and the strip
   sits inside the menu. Served over http (the music is files beside the
   page, which a page opened from disk can't fetch). */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist");
const TYPES = { ".html": "text/html", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 20000, step = 300) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };
const secs = (t) => { const m = /(\d+):(\d\d)/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };

const PLACES = [
  { name: "Orinoco", url: "el-cabeza-parrish.html?look=orinoco", title: "Dodhéanta an Ghrian", start: "begin" },
  { name: "Watermark", url: "el-cabeza-parrish.html?look=watermark", title: "\u00d4m Nhau", start: "begin" },
  { name: "Big Glutts", url: "el-cabeza-tienda.html", title: /Muzak, 1974|Coupon Gloss|Atrium|Emporium|Clearance|arrangement/, start: "box" },
  { name: "the den", url: "el-cabeza-standard.html", title: /\S/, start: "record" },
  { name: "Neon", url: "el-cabeza-neon.html", title: null, start: "begin" },
];

for (const place of PLACES) {
  console.log(place.name);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`${BASE}/${place.url}`);
  await page.waitForTimeout(5000);
  await page.mouse.click(5, 300); // a gesture, for the sound
  const openMenu = async () => {
    const open = await page.evaluate(() => { const p = document.querySelector('[data-testid="dock-panel"]'); return p ? p.dataset.open === "true" : true; });
    if (!open && (await page.locator('canvas[data-testid="dock-piece-canvas"]').count())) { await openDockPanel(page); await page.waitForTimeout(600); }
    await page.evaluate(() => document.querySelector('[data-testid="sound-button"]').click());
    await page.waitForTimeout(600);
  };
  if (place.start === "box") {
    await page.evaluate(() => document.querySelector('[data-testid="tienda-open-box"]').click());
  } else {
    if (await page.locator('canvas[data-testid="dock-piece-canvas"]').count()) await openDockPanel(page);
    await page.waitForTimeout(400);
    if (place.start === "begin") await page.getByRole("button", { name: "Begin Game" }).first().click({ force: true });
    else {
      await openMenu();
      await page.click('[data-testid="sound-music"]');
      await page.waitForTimeout(1200);
      await page.locator('[data-testid="music-panel"] button').filter({ hasNotText: /stop/i }).first().click();
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
  }
  const read = () => page.evaluate(() => {
    const s = document.querySelector('[data-testid="now-playing"]');
    if (!s) return null;
    const box = (q) => { const b = (q ? s.querySelector(q) : s).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const m = document.querySelector('[data-testid="sound-menu"]').getBoundingClientRect();
    return {
      paused: s.dataset.paused, title: s.querySelector('[data-testid="now-playing-title"]').textContent,
      time: s.querySelector('[data-testid="now-playing-time"]').textContent,
      btn: box('[data-testid="now-playing-toggle"]'), name: box('[data-testid="now-playing-title"]'), when: box('[data-testid="now-playing-time"]'), strip: box(), menu: { l: m.left, r: m.right, t: m.top, b: m.bottom },
    };
  });
  if (!place.title) {
    await page.waitForTimeout(4000);
    await openMenu();
    check("no music: no now-playing strip", (await read()) === null);
    check("no page errors", errs.length === 0, errs.join(" | "));
    await page.close();
    continue;
  }
  // The music takes a moment to fetch and decode.
  let a = null;
  await poll(async () => { await openMenu(); a = await read(); if (!a) await page.keyboard.press("Escape"); return a; }, 30000, 1500);
  check("the strip shows in the sound menu", !!a);
  if (!a) { await page.close(); continue; }
  check(`its title (${a.title})`, typeof place.title === "string" ? a.title === place.title : place.title.test(a.title), a.title);
  const sep = (x, y) => x.r <= y.l || y.r <= x.l || x.b <= y.t || y.b <= x.t;
  check("button, title and time don't overlap", sep(a.btn, a.name) && sep(a.name, a.when) && sep(a.btn, a.when), JSON.stringify(a));
  check("the strip is inside the menu", a.strip.l >= a.menu.l && a.strip.r <= a.menu.r && a.strip.t >= a.menu.t, JSON.stringify({ strip: a.strip, menu: a.menu }));
  const moved = await poll(async () => { const b = await read(); return b && secs(b.time) > secs(a.time) ? b : null; }, 6000);
  check("the time moves on while it plays", !!moved, a.time);
  await page.click('[data-testid="now-playing-toggle"]');
  await page.waitForTimeout(500);
  const p1 = await read();
  await page.waitForTimeout(2500);
  const p2 = await read();
  check("the button pauses it", p1.paused === "true", JSON.stringify(p1));
  check("paused, the time holds", p1.time === p2.time, `${p1.time} -> ${p2.time}`);
  await page.click('[data-testid="now-playing-toggle"]');
  const r = await poll(async () => { const b = await read(); return b && b.paused === "false" && secs(b.time) > secs(p2.time) ? b : null; }, 6000);
  check("played again, it carries on from where it was", !!r && secs(r.time) - secs(p2.time) < 8, r ? `${p2.time} -> ${r.time}` : "");
  // A title too long for its space scrolls (user), still clear of the time.
  if (place.name === "Orinoco") {
    await page.evaluate(() => { window.__EC_NP_TITLE__ = "A Very Long Title That Cannot Possibly Fit In This Little Strip"; });
    const shift = () => page.evaluate(() => { const t = document.querySelector('[data-testid="now-playing-title"]'); const sp = t.querySelector("span"); return { scrolls: t.dataset.scrolls, x: new DOMMatrixReadOnly(getComputedStyle(sp).transform).m41 }; });
    const s0 = await poll(async () => { const v = await shift(); return v.scrolls === "true" ? v : null; }, 3000);
    check("a long title is marked to scroll", !!s0);
    const moved = await poll(async () => { const v = await shift(); return v.x < -5 ? v : null; }, 6000, 200);
    check("...and glides along", !!moved, JSON.stringify(s0));
    const l = await read();
    check("...still clear of the button and the time", sep(l.btn, l.name) && sep(l.name, l.when), JSON.stringify(l));
    await page.evaluate(() => { window.__EC_NP_TITLE__ = null; });
    await page.waitForTimeout(400);
    check("a title that fits doesn't scroll", (await shift()).scrolls === "false");
  }
  check("no page errors", errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
