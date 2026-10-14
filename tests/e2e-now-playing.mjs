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
   sits inside the menu. Back and forward buttons where the soundtrack has
   more than one song (Watermark; user: "they both need a back and
   forward track buttons", Orinoco not "at this point", one song), and
   none elsewhere. Served over http (the music is files beside the page,
   which a page opened from disk can't fetch). */
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
  args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 20000, step = 300) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };
const secs = (t) => { const m = /(\d+):(\d\d)/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };

const PLACES = [
  { name: "Orinoco", url: "el-cabeza-parrish.html?look=orinoco", title: "Dodhéanta an Ghrian", start: "begin" },
  { name: "Watermark", url: "el-cabeza-parrish.html?look=watermark", title: "\u00d4m Nhau V\u0129nh C\u1eedu", start: "begin" },
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
    const box = (q) => { const e = q ? s.querySelector(q) : s; if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const m = document.querySelector('[data-testid="sound-menu"]').getBoundingClientRect();
    return {
      // (The title's own text: a title that scrolls has its keyframes beside it.)
      paused: s.dataset.paused, title: s.querySelector('[data-testid="now-playing-title"] span').textContent,
      time: s.querySelector('[data-testid="now-playing-time"]').textContent,
      btn: box('[data-testid="now-playing-toggle"]'), name: box('[data-testid="now-playing-title"]'), when: box('[data-testid="now-playing-time"]'), strip: box(), menu: { l: m.left, r: m.right, t: m.top, b: m.bottom },
      back: box('[data-testid="now-playing-back"]'), next: box('[data-testid="now-playing-next"]'),
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
  // Back and forward (user), where there's more than one song to go to.
  const SKIPS = place.name === "Watermark";
  check(SKIPS ? "back and forward buttons (two songs)" : "no back and forward buttons", SKIPS ? !!(a.back && a.next) : !a.back && !a.next, JSON.stringify({ back: a.back, next: a.next }));
  if (a.back && a.next) {
    check("...back, play, forward in a row, clear of the title and the time", a.back.r <= a.btn.l && a.btn.r <= a.next.l && [a.back, a.btn, a.next].every((x) => sep(x, a.name) && sep(x, a.when)), JSON.stringify(a));
    check("...the buttons and the time inside the strip", [a.back, a.btn, a.next, a.name, a.when].every((x) => x.l >= a.strip.l && x.r <= a.strip.r && x.t >= a.strip.t && x.b <= a.strip.b), JSON.stringify(a));
  }
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
    check("a title that fits doesn't scroll", !!(await poll(async () => (await shift()).scrolls === "false", 4000, 200)));
  }
  // Watermark's soundtrack: two songs in turn (user: "Add to the 'Go deo
  // na ndeor' soundtrack with the title 'Ná seas ag mo uaigh is ná
  // goil'"): near the end of the first, the strip moves on to the second
  // (from its start, its own length), and after it, round to the first.
  if (place.name === "Watermark") {
    const NEXT = "Ná seas ag mo uaigh is ná goil";
    const skip = (s) => page.evaluate((s) => window.__PARRISH_AUDIO__.testSongNearEnd(s), s);
    check("near the end of the first song", await skip(2));
    const b = await poll(async () => { const v = await read(); return v && v.title === NEXT ? v : null; }, 15000, 300);
    check(`...then the next, "${NEXT}"`, !!b, JSON.stringify(await read()));
    check(`...from its start, its own length (${b && b.time})`, !!b && secs(b.time.split("/")[0]) <= 4 && /2:57/.test(b.time), b && b.time);
    const st = await page.evaluate(() => window.__PARRISH_AUDIO__.debugState());
    check("...playing, the second of two", st.hums === "playing" && st.song === 1 && st.songs === 2, JSON.stringify(st));
    check("near the end of the second", await skip(2));
    const c = await poll(async () => { const v = await read(); return v && v.title === place.title ? v : null; }, 15000, 300);
    check("...then round to the first again", !!c, JSON.stringify(await read()));

    // Back and forward (user: "if you're in a song during the soundtrack
    // and you want to skip to the next song ... Or ... back to the
    // beginning of a song you're currently listening to").
    const state = () => page.evaluate(() => window.__PARRISH_AUDIO__.debugState());
    const at = (v) => secs((v && v.time ? v.time : "").split("/")[0]);
    const press = (b) => page.evaluate((b) => document.querySelector(`[data-testid="now-playing-${b}"]`).click(), b);
    const FIRST_LEN = /3:30/, NEXT_LEN = /2:57/;
    await poll(async () => { const v = await read(); return v && v.title === place.title && FIRST_LEN.test(v.time) && at(v) >= 1 ? v : null; }, 15000, 300);
    // (A real click can take seconds to land on the software renderer, so
    // the times are read from when it has.)
    await page.click('[data-testid="now-playing-next"]');
    const t0 = Date.now();
    const f1 = await read();
    check("forward: the next song's title at once", !!f1 && f1.title === NEXT, JSON.stringify(f1));
    const f2 = await poll(async () => { const v = await read(); return v && v.title === NEXT && NEXT_LEN.test(v.time) ? v : null; }, 15000, 150);
    check(`...playing from its start (${f2 && f2.time}, here ${Date.now() - t0} ms after the click)`, !!f2 && f2.paused === "false" && at(f2) <= 2, JSON.stringify(await read()));
    const s1 = await state();
    check("...the second song, playing", s1.hums === "playing" && s1.song === 1, JSON.stringify(s1));
    // Back, some seconds in: the same song from its start (its time goes
    // back, however long the click took to land).
    const f3 = await poll(async () => { const v = await read(); return v && at(v) >= 5 ? v : null; }, 12000, 300);
    await page.click('[data-testid="now-playing-back"]');
    const b1 = await read(), sb = await state();
    check(`back, ${f3 && f3.time} in: the same song from its start (${b1 && b1.time})`, !!f3 && !!b1 && b1.title === NEXT && at(b1) < at(f3) && b1.paused === "false" && sb.song === 1 && sb.hums === "playing", JSON.stringify({ b1, sb }));
    // Twice at once, some seconds in: its start, then (in its first
    // seconds) the song before, from its start.
    await poll(async () => { const v = await read(); return v && at(v) >= 4 ? v : null; }, 12000, 300);
    await page.evaluate(() => { const b = document.querySelector('[data-testid="now-playing-back"]'); b.click(); b.click(); });
    const b2 = await poll(async () => { const v = await read(); return v && v.title === place.title && FIRST_LEN.test(v.time) ? v : null; }, 15000, 150);
    check("back twice at once: the start, then the song before, from its start", !!b2 && at(b2) <= 3, JSON.stringify(await read()));
    await page.waitForTimeout(1500);
    const s2 = await state();
    check("...the first song, playing, one song sounding", s2.hums === "playing" && s2.song === 0 && s2.sounding === 1, JSON.stringify(s2));
    // Paused, forward: the next song, still paused, at its start; played,
    // it goes on from there.
    await page.click('[data-testid="now-playing-toggle"]');
    await poll(async () => { const v = await read(); return v && v.paused === "true"; }, 3000, 100);
    await page.click('[data-testid="now-playing-next"]');
    const p1 = await poll(async () => { const v = await read(); return v && v.title === NEXT && NEXT_LEN.test(v.time) ? v : null; }, 15000, 150);
    await page.waitForTimeout(2000);
    const p2 = await read(), s3 = await state();
    check("paused, forward: the next song, still paused at its start", !!p1 && p1.paused === "true" && at(p1) === 0 && p2.time === p1.time && s3.hums === "paused" && s3.song === 1 && s3.sounding === 0, JSON.stringify({ p1, p2, s3 }));
    await page.click('[data-testid="now-playing-toggle"]');
    const p3 = await poll(async () => { const v = await read(); return v && v.paused === "false" && at(v) >= 1 ? v : null; }, 8000, 200);
    check("...played, it goes on from its start", !!p3 && p3.title === NEXT && at(p3) <= 4, JSON.stringify(await read()));
    // Forward twice at once: round to the same song (two of them), one
    // sounding (the song asked for first, still on its way, let go).
    await page.evaluate(() => { const b = document.querySelector('[data-testid="now-playing-next"]'); b.click(); b.click(); });
    const d1 = await poll(async () => { const v = await read(); return v && v.title === NEXT && NEXT_LEN.test(v.time) && at(v) >= 1 ? v : null; }, 15000, 200);
    await page.waitForTimeout(1500);
    const s4 = await state();
    check("forward twice at once: round to the same song, from its start, one sounding", !!d1 && at(d1) <= 3 && s4.hums === "playing" && s4.song === 1 && s4.sounding === 1, JSON.stringify({ d1, s4 }));
    // Between songs, back: the one just ended, again from its start (on
    // its own it would go on to the first).
    check("near the end of the song", await skip(0.5));
    const g0 = await poll(async () => { const v = await state(); return v.hums === "between" ? v : null; }, 6000, 100);
    check("...then between songs", !!g0, JSON.stringify(await state()));
    await press("back");
    const g1 = await poll(async () => { const v = await read(); return v && v.title === NEXT && NEXT_LEN.test(v.time) && at(v) <= 2 && v.paused === "false" ? v : null; }, 6000, 150);
    await page.waitForTimeout(4000);
    const g2 = await read(), s5 = await state();
    check("between songs, back: the one just ended from its start, and it stays on it", !!g1 && g2.title === NEXT && s5.song === 1 && s5.hums === "playing" && s5.sounding === 1, JSON.stringify({ g1, g2, s5 }));
  }
  check("no page errors", errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
