/* The set pulls the player in (user: "the user still has the option of
   ignoring it, going back to the table. Eventually, the TV has to pull
   the player into the TV ... It should be short, quick ... a yell of some
   sort, where they're being like, they get stretched out, and just shows
   them the camera moving to where toward the television, that they're
   getting sucked into it"): den-fx.js PULL_*. Left alone after the blast
   (the head held on the set, never tapped), 9 s on it takes them; looked
   at and left (back to the table), it waits longer (20 s from then).
   Then the build-up first (user: "it happens way too abruptly"; chose
   "Combine 1 & 2", den-tug.js): a tug at the view, snapping back, the
   papers on the coffee table shivering toward the set; "Did the TV
   just… pull me?"; a harder tug, the papers flying into the glass;
   "Uh-oh…"; the third that doesn't let go, the records and the newspaper
   going, the view dragged across the room; nothing taking a tap, the
   set's included. Then the rush: the set on into its dive, the camera
   drawn on in from the drag at its own pace, gathering speed evenly
   into the glass (user: "The last part of the pull into the TV still
   happens too abruptly": it had stopped dead where the drag left off,
   then lunged in), the lens widening, the picture drawn out toward the
   set with streaks of light (den-pull) meeting on its glass (user:
   "what are those pointing to? ... it's like kind of off screen": they
   had met where the board's own camera saw the set, past the screen's
   edge on a phone), the dark closing in round the
   set till it's all black at the glass (den-pull-dark), then Nova's
   transition into Futuris opening out of it. From disk there's no
   recording, so the yell reads "none" here. Over http: the hall's shout
   with its preverb (user: "Maybe the voice, the shout at the end, at
   least that needs to have some preverb on it"), cued from the drag to
   swell up into the shout as the rush takes hold, and the den's sound
   left to ring on (its echo) after the den's gone, not cut dead.

   node tests/e2e-tv-pull.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 250) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
async function home() {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000);
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
const futuris = (page) => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector(".ec-title") && /Chakra/.test(getComputedStyle(document.querySelector(".ec-title")).fontFamily));
/* In the page, through the rush: where its streaks meet, and the set's
   glass on the screen (its box and its middle), where they should (user:
   "what are those pointing to? ... it's like kind of off screen": they'd
   met where the board's own camera saw the set, past the edge on a phone). */
const aimLog = () => {
  let glass = null;
  window.__PULL_AIM__ = () => {
    const t3 = window.__DEN_THREE__, c = t3 && t3.renderer && t3.renderer.domElement, el = document.querySelector('[data-testid="den-pull"]');
    const m = el && /at (-?[\d.]+)px (-?[\d.]+)px/.exec(el.style.background || "");
    if (!m || !c || !t3.camera) return null;
    if (!glass) { t3.scene.traverse((o) => { if (o.userData && o.userData.tv === "screen") glass = o; }); if (glass) glass.geometry.computeBoundingBox(); }
    if (!glass) return null;
    const b = glass.geometry.boundingBox, V = glass.position.constructor, r = c.getBoundingClientRect();
    const on = (x, y) => { const p = new V(x, y, b.max.z).applyMatrix4(glass.matrixWorld).project(t3.camera); return [Math.round(r.left + ((p.x + 1) / 2) * r.width), Math.round(r.top + ((1 - p.y) / 2) * r.height)]; };
    const cs = [on(b.min.x, b.min.y), on(b.max.x, b.min.y), on(b.max.x, b.max.y), on(b.min.x, b.max.y)], xs = cs.map((q) => q[0]), ys = cs.map((q) => q[1]);
    return { meet: [+m[1], +m[2]], glass: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), mid: on((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2) } };
  };
};
// ...and the check: all through the rush, inside the glass's box, within
// 15% of its size from its middle.
const aimCheck = (label, samples) => {
  const aimed = samples.filter((x) => x.s > 100 && x.s < 1500 && x.aim);
  const off = (a) => Math.hypot(a.meet[0] - a.glass.mid[0], a.meet[1] - a.glass.mid[1]) / Math.max(40, Math.min(a.glass.x1 - a.glass.x0, a.glass.y1 - a.glass.y0));
  check(`${label} (${aimed.length ? Math.max(...aimed.map((x) => off(x.aim))).toFixed(2) : "?"} of its size off, at most)`, aimed.length >= 3 && aimed.every(({ aim: a }) => a.meet[0] > a.glass.x0 && a.meet[0] < a.glass.x1 && a.meet[1] > a.glass.y0 && a.meet[1] < a.glass.y1 && off(a) < 0.15), JSON.stringify(aimed.slice(0, 3)));
};

{
  const { ctx, page, errs } = await home();
  const tv = () => page.evaluate(() => (window.__DEN_TV__ ? window.__DEN_TV__() : null));
  check("home, the set luring", (await tv()).lure === true);
  // On to the blast, the set never touched.
  await page.evaluate(() => window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 15200));
  check("the blast, and the head held on the set", !!(await poll(async () => { const t = await tv(); return t.blasted && t.fixed; }, 15000, 100)), JSON.stringify(await tv()));
  const due = (await tv()).pullIn;
  check(`...the pull due about 9 s after it (${due} ms)`, due > 6000 && due <= 9000, JSON.stringify(await tv()));
  // (Each frame of what's coming, logged in the page: it's quick.)
  await page.evaluate(aimLog);
  await page.evaluate(() => {
    window.__PULL_LOG__ = []; window.__TUG_LOG__ = [];
    const tick = () => {
      const f = window.__DEN_TV__;
      if (f) {
        const t = f();
        if (t.tug && !t.pull) window.__TUG_LOG__.push({ s: t.tug.s, lurch: +t.tug.lurch.toFixed(3), shake: +t.tug.shake.toFixed(3), dist: t.glassDist, phase: t.phase, lock: t.lock, debris: t.tug.debris.map((d) => `${d.id}:${d.phase}`).join(" "), think: !!document.querySelector('[data-testid="den-tug-think"]:not(.off)'), uhoh: !!document.querySelector('[data-testid="den-uhoh"]:not(.off)') });
        if (t.pull) {
          const c = document.querySelector("canvas"), el = document.querySelector('[data-testid="den-pull"]');
          window.__PULL_LOG__.push({ s: t.pull.s, focus: +t.focus.toFixed(3), dive: +t.dive.toFixed(3), fov: t.pull.fov, fov0: t.pull.fov0, transform: c ? c.style.transform : "", streaks: el ? Number(el.style.opacity) : null, aim: window.__PULL_AIM__(), phase: t.phase, lock: t.lock, yell: t.pull.yell, tugged: t.tug ? t.tug.s : null, dist: t.glassDist, dark: t.pull.dark, crt: !!document.querySelector(".ec-crt-overlay") });
        }
      }
      if (window.__DEN_TV__ || !window.__PULL_LOG__.length) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Not yet a little before.
  await page.waitForTimeout(Math.max(0, due - 1500));
  check("...nothing yet a moment before", (await tv()).pull === null && (await tv()).tug === null && (await tv()).phase === "off");
  // (How far the view is from the glass at rest, just before: the first
  // frame logged in the tug can already be well into it on a slow
  // renderer, CI's 19 ms in.)
  const rest = (await tv()).glassDist;
  // The build-up: the first tug.
  const start = await poll(async () => { const t = await tv(); return t && t.tug ? t : null; }, 6000, 50);
  check("it starts: the build-up, the set still off, nothing taking a tap", !!start && start.phase === "off" && start.lock === true, JSON.stringify(start));
  check(`...everything still in the room (${start && start.tug.debris.length} things)`, !!start && start.tug.debris.length >= 5 && start.tug.debris.every((d) => d.phase === "rest" || d.phase === "rustle"), JSON.stringify(start && start.tug.debris));
  // ...and a tap on the set does nothing now.
  await page.waitForTimeout(1800);
  const at = await page.evaluate(() => window.__DEN_TV_AT__());
  if (at) await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(600);
  const tapped = await tv();
  check("...a tap on the set meanwhile: nothing (it stays off, no watching)", tapped.phase === "off" && !tapped.looking && !!tapped.tug, JSON.stringify({ phase: tapped.phase, looking: tapped.looking, at }));
  check("...into Futuris", !!(await poll(() => futuris(page), 40000)));
  const samples = await page.evaluate(() => window.__PULL_LOG__);
  const tugs = await page.evaluate(() => window.__TUG_LOG__);
  const near = (a, b) => tugs.filter((x) => x.s >= a && x.s <= b);
  const d0 = rest || (near(0, 60)[0] || {}).dist;
  // (Its peak, 9% of the way, at 110 ms: anything over 3% between 0 and
  // 400 ms, so a frame every 200 ms still sees it.)
  const t1 = near(0, 400), back1 = near(1100, 1500);
  check(`the first tug: the view lurches at the set (${d0} -> ${t1.length ? Math.min(...t1.map((x) => x.dist)) : "?"})...`, !!d0 && t1.length > 0 && Math.min(...t1.map((x) => x.dist)) < d0 * 0.97, JSON.stringify(tugs.slice(0, 8)));
  check(`...and snaps back (${back1.length ? back1[back1.length - 1].dist : "?"})`, back1.length > 0 && Math.abs(back1[back1.length - 1].dist - d0) < d0 * 0.025, JSON.stringify(back1.slice(-2)));
  check("...the papers shiver toward it", near(0, 900).some((x) => /score-a:rustle/.test(x.debris)));
  const thought = near(1500, 4100);
  check(`the thought: "Did the TV just… pull me?" (${thought.filter((x) => x.think).length} frames)`, thought.length > 0 && thought.every((x) => x.think), JSON.stringify(thought.slice(0, 2)));
  const t2 = near(4260, 4520);
  check(`the second tug, harder (${t2.length ? Math.min(...t2.map((x) => x.dist)) : "?"} of ${d0})`, t2.length > 0 && Math.min(...t2.map((x) => x.dist)) < d0 * 0.9, JSON.stringify(t2.slice(0, 4)));
  check("...the thought cut short by it", near(5000, 6300).every((x) => !x.think));
  const after2 = near(6300, 6800);
  check("...and the papers gone into the set (both score sheets and the circular)", after2.length > 0 && after2.every((x) => /score-a:in/.test(x.debris) && /score-b:in/.test(x.debris) && /circular:in/.test(x.debris)), JSON.stringify(after2[0]));
  check("...the records and the paper not yet", after2.length > 0 && after2.every((x) => !/sleeve-console:in|sleeve-floor:in|newspaper:in/.test(x.debris)), JSON.stringify(after2[0]));
  check(`"Uh-oh…"`, near(6600, 9300).length > 0 && near(6600, 9300).every((x) => x.uhoh));
  const drag = near(9200, 9600);
  check(`the third doesn't let go: dragged toward the set (${drag.length ? Math.min(...drag.map((x) => x.dist)) : "?"} of ${d0}), shaking`, drag.length > 0 && Math.min(...drag.map((x) => x.dist)) < d0 * 0.75 && Math.max(...drag.map((x) => x.shake)) > 0.7, JSON.stringify(drag.slice(-3)));
  check("...the records and the newspaper gone in too, before the rush", drag.length > 0 && /sleeve-console:in/.test(drag[drag.length - 1].debris) && /sleeve-floor:in/.test(drag[drag.length - 1].debris) && /newspaper:in/.test(drag[drag.length - 1].debris), JSON.stringify(drag[drag.length - 1]));
  check("...the set off and nothing taking a tap all through it", tugs.length > 0 && tugs.every((x) => x.phase === "off" && x.lock === true));
  const first = samples[0];
  check(`then the rush: the set took them, nothing else answering (${JSON.stringify(first)})`, !!first && first.phase === "dive" && first.lock === true && first.tugged >= 9400);
  // The rush: slow at first, then all at once; the lens widening; the
  // picture drawn out toward the set.
  const early = samples.filter((x) => x.s < 450), late = samples.filter((x) => x.s > 1000);
  check(`...slow at first (focus ${early.length ? Math.max(...early.map((x) => x.focus)) : "?"} by 0.45 s)`, early.length > 0 && Math.max(...early.map((x) => x.focus)) < 0.45, JSON.stringify(samples.slice(0, 6)));
  check(`...then all at once, into the glass (focus ${late.length ? Math.max(...late.map((x) => x.focus)) : "?"}, dive ${late.length ? Math.max(...late.map((x) => x.dive)) : "?"} after 1 s)`, late.length > 0 && Math.max(...late.map((x) => x.focus)) > 0.9 && Math.max(...late.map((x) => x.dive)) > 0.4, JSON.stringify(samples.slice(-6)));
  const wide = late.length ? late[late.length - 1] : null;
  check(`...the lens widening (${wide && wide.fov0} -> ${wide && wide.fov})`, !!wide && wide.fov > wide.fov0 * 1.4, JSON.stringify(wide));
  check(`...the picture drawn out toward the set, streaks of light (${wide && wide.transform}, ${wide && wide.streaks})`, !!wide && /scale\(/.test(wide.transform) && wide.streaks > 0.5, JSON.stringify(wide));
  aimCheck("...the streaks meeting on the set's glass, at its middle", samples);
  // How fast it's coming in (units a second), first sample to last in a
  // window (a slow renderer's frames are far apart).
  const speed = (log, a, b) => { const xs = log.filter((x) => x.s >= a && x.s <= b && x.dist != null); if (xs.length < 2) return null; const f = xs[0], l = xs[xs.length - 1]; return l.s > f.s ? +((f.dist - l.dist) / ((l.s - f.s) / 1000)).toFixed(1) : null; };
  const vDrag = speed(tugs, 9050, 9500), vStart = speed(samples, 0, 350), vMid = speed(samples, 450, 950), vEnd = speed(samples, 1000, 1550);
  check(`...on in from the drag at its own pace, gathering speed evenly: no stop, no lunge (drag ${vDrag}; rush ${vStart}, ${vMid}, ${vEnd} a second)`, vDrag > 0 && vStart > vDrag * 0.6 && vMid >= vStart * 0.9 && vEnd >= vMid * 0.9 && vEnd < vDrag * 2.5, JSON.stringify(samples.map((x) => [x.s, x.dist])));
  const darks = samples.filter((x) => x.dark != null), handOff = samples.find((x) => x.crt);
  check(`...the dark closing in over its last part (none before 0.95 s; ${darks.length ? darks[darks.length - 1].dark : "?"} at the end)`, darks.length > 0 && darks.filter((x) => x.s < 950).every((x) => !x.dark) && darks.every((x, i) => i === 0 || x.dark >= darks[i - 1].dark) && darks.some((x) => x.dark > 0.2 && x.dark < 0.9), JSON.stringify(darks.map((x) => [x.s, x.dark])));
  check(`...all black by the time Nova's transition comes up (${handOff ? handOff.dark : "?"} at ${handOff ? handOff.s : "?"} ms)`, !!handOff && handOff.dark >= 0.95, JSON.stringify(handOff));
  const yelled = samples.find((x) => x.yell);
  check(`...his yell cued (${yelled ? yelled.yell : "no"}: from disk there's no recording)`, !!yelled && yelled.yell === "none");
  check("...the lens and the picture as they were, the dark gone", await page.evaluate(() => { const c = document.querySelector("canvas"); return !document.querySelector('[data-testid="den-pull"]') && !document.querySelector('[data-testid="den-pull-dark"]') && (!c || !/scale\(/.test(c.style.transform)); }));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  // Looked at, then left: the pull waits longer, from when they went back.
  const { ctx, page, errs } = await home();
  const tv = () => page.evaluate(() => (window.__DEN_TV__ ? window.__DEN_TV__() : null));
  await page.evaluate(() => window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 400));
  await poll(async () => (await tv()).lureEvents >= 1, 15000);
  await poll(async () => { const t = await tv(); return t.glance === null && !t.lock; }, 15000, 100);
  await page.evaluate(() => window.__DEN_TV_PRESS__());
  check("looked at: over to watch", !!(await poll(async () => (await tv()).looking, 6000, 100)));
  check("...the blast comes, sooner, while watching", !!(await poll(async () => (await tv()).blasted, 12000, 100)), JSON.stringify(await tv()));
  const box = await page.locator("canvas").first().boundingBox();
  await page.waitForTimeout(6500);
  await page.mouse.click(box.x + 12, box.y + box.height - 12);
  check("...a tap off the set: back to the table", !!(await poll(async () => { const t = await tv(); return !t.looking && t.goal === 0; }, 4000, 100)));
  const due = (await tv()).pullIn;
  check(`...the pull due about 20 s from going back (${due} ms)`, due > 17000 && due <= 20000, JSON.stringify(await tv()));
  // (On to it, then: as it comes, from the table, the build-up first.)
  await page.evaluate(() => window.__DEN_PULL_NOW__());
  check("...then from the table: the build-up", !!(await poll(async () => { const t = await tv(); return t && t.tug && !t.pull; }, 2000, 50)));
  check("...and into the set", !!(await poll(async () => { const t = await tv(); return t && t.pull && t.phase === "dive"; }, 14000, 50)));
  check("...into Futuris", !!(await poll(() => futuris(page), 30000)));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  // Over http (as GitHub Pages serves it): his shout with its preverb, and
  // the den's sound ringing on after it's gone.
  const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  const server = http.createServer((req, res) => {
    const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
    // When each sound context is closed (the den's, as it goes).
    window.__CLOSED__ = [];
    const close = AudioContext.prototype.close;
    AudioContext.prototype.close = function () { window.__CLOSED__.push(performance.now()); return close.call(this); };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/el-cabeza-nova.html`);
  await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000);
  await page.waitForTimeout(1500);
  const tv = () => page.evaluate(() => (window.__DEN_TV__ ? window.__DEN_TV__() : null));
  console.log("over http: his shout with its preverb; the den's sound ringing on");
  await page.evaluate(() => window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 15200));
  await poll(async () => { const t = await tv(); return t.blasted && t.fixed; }, 15000, 100);
  // (The recordings in, then on into the drag.)
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__DEN_PULL_NOW__());
  await poll(async () => { const t = await tv(); return t && t.tug; }, 3000, 50);
  // (Where the rush's streaks meet, each frame: on a phone they'd met
  // past the screen's edge.)
  await page.evaluate(aimLog);
  await page.evaluate(() => {
    window.__AIM_LOG__ = [];
    const tick = () => {
      const t = window.__DEN_TV__ ? window.__DEN_TV__() : null;
      if (t && t.pull) window.__AIM_LOG__.push({ s: t.pull.s, aim: window.__PULL_AIM__() });
      if (window.__DEN_TV__) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => window.__DEN_TUG_SKIP__(6200));
  const cued = await poll(async () => { const t = await tv(); return t && t.shout ? { ...t.shout, tug: t.tug && t.tug.s, pull: !!t.pull } : null; }, 8000, 40);
  check(`the shout cued from the drag with its preverb, 1.9 s ahead of it (${cued && (cued.at - cued.pre).toFixed(3)} s; in the drag at ${cued && cued.tug} ms)`, !!cued && Math.abs(cued.at - cued.pre - 1.9) < 0.02 && !cued.pull && cued.tug > 6900, JSON.stringify(cued));
  const rush = await poll(() => page.evaluate(() => { const t = window.__DEN_TV__ && window.__DEN_TV__(); return t && t.pull && t.shout ? { s: t.pull.s, yell: t.pull.yell, lead: +(t.shout.at - t.shout.now).toFixed(3), now: performance.now() } : null; }), 6000, 20);
  check(`...the rush: the preverb swelling up, the shout just into it (due in ${rush && rush.lead} s, ${rush && rush.s} ms in)`, !!rush && rush.yell === "recording" && rush.lead > -0.05 && rush.lead + rush.s / 1000 < 0.5 && rush.lead + rush.s / 1000 > 0, JSON.stringify(rush));
  const gone = await poll(() => page.evaluate(() => (!window.__DEN_TV__ ? performance.now() : null)), 20000, 40);
  check("...into Futuris, the den gone", !!gone);
  aimCheck("...on the phone, the streaks meeting on the set's glass, at its middle", await page.evaluate(() => window.__AIM_LOG__));
  // (The first context closed as the den goes or after: the den's.)
  const closed = await poll(() => page.evaluate((g) => window.__CLOSED__.find((t) => t >= g - 200) || null, gone), 6000, 100);
  // (His echo's due to ring out 1.3 s of shout and 1.7 s of echo after
  // the shout comes. Closed with the den, it had been cut dead: now, gone
  // first, the den's sound rings on that long; gone after, nothing to cut.)
  const echoEnd = rush ? rush.now + (rush.lead + 1.3 + 1.7) * 1000 : null;
  check(`...its sound let ring on: the context closed ${closed && gone ? ((closed - gone) / 1000).toFixed(2) : "?"} s after the den went, ${closed && echoEnd ? ((closed - echoEnd) / 1000).toFixed(2) : "?"} s from his echo's end (it was closed with the den)`, !!closed && !!gone && !!echoEnd && (closed - gone > 300 || gone > echoEnd - 350) && closed > echoEnd - 350, JSON.stringify({ closed, gone, echoEnd }));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
  server.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
