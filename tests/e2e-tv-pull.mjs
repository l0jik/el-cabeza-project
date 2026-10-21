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
   rushing into the glass (slow, then all at once), the lens widening,
   the picture drawn out toward the set with streaks of light (den-pull),
   Nova's transition into Futuris. From disk there's no recording, so the
   yell reads "none" here; over http it's the hall's shout.

   node tests/e2e-tv-pull.mjs */
import { chromium } from "playwright";
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
  await page.evaluate(() => {
    window.__PULL_LOG__ = []; window.__TUG_LOG__ = [];
    const tick = () => {
      const f = window.__DEN_TV__;
      if (f) {
        const t = f();
        if (t.tug && !t.pull) window.__TUG_LOG__.push({ s: t.tug.s, lurch: +t.tug.lurch.toFixed(3), shake: +t.tug.shake.toFixed(3), dist: t.glassDist, phase: t.phase, lock: t.lock, debris: t.tug.debris.map((d) => `${d.id}:${d.phase}`).join(" "), think: !!document.querySelector('[data-testid="den-tug-think"]:not(.off)'), uhoh: !!document.querySelector('[data-testid="den-uhoh"]:not(.off)') });
        if (t.pull) {
          const c = document.querySelector("canvas"), el = document.querySelector('[data-testid="den-pull"]');
          window.__PULL_LOG__.push({ s: t.pull.s, focus: +t.focus.toFixed(3), dive: +t.dive.toFixed(3), fov: t.pull.fov, fov0: t.pull.fov0, transform: c ? c.style.transform : "", streaks: el ? Number(el.style.opacity) : null, phase: t.phase, lock: t.lock, yell: t.pull.yell, tugged: t.tug ? t.tug.s : null });
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
  const yelled = samples.find((x) => x.yell);
  check(`...his yell cued (${yelled ? yelled.yell : "no"}: from disk there's no recording)`, !!yelled && yelled.yell === "none");
  check("...the lens and the picture as they were", await page.evaluate(() => { const c = document.querySelector("canvas"); return !document.querySelector('[data-testid="den-pull"]') && (!c || !/scale\(/.test(c.style.transform)); }));
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
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
