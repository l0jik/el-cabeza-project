/* The set pulls the player in (user: "the user still has the option of
   ignoring it, going back to the table. Eventually, the TV has to pull
   the player into the TV ... It should be short, quick ... a yell of some
   sort, where they're being like, they get stretched out, and just shows
   them the camera moving to where toward the television, that they're
   getting sucked into it"): den-fx.js PULL_*. Left alone after the blast
   (the head held on the set, never tapped), 9 s on it takes them: the set
   on into its dive, the den's input held, the camera rushing from where
   it is into the glass (slow, then all at once), the lens widening, the
   picture drawn out toward the set with streaks of light (den-pull), then
   Nova's transition into Futuris. Looked at and left (back to the table),
   it waits longer (20 s from then). From disk there's no recording, so
   the yell reads "none" here; over http it's the hall's shout.

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
    window.__PULL_LOG__ = [];
    const tick = () => {
      const f = window.__DEN_TV__;
      if (f) {
        const t = f();
        if (t.pull) {
          const c = document.querySelector("canvas"), el = document.querySelector('[data-testid="den-pull"]');
          window.__PULL_LOG__.push({ s: t.pull.s, focus: +t.focus.toFixed(3), dive: +t.dive.toFixed(3), fov: t.pull.fov, fov0: t.pull.fov0, transform: c ? c.style.transform : "", streaks: el ? Number(el.style.opacity) : null, phase: t.phase, lock: t.lock, yell: t.pull.yell });
        }
      }
      if (window.__DEN_TV__ || !window.__PULL_LOG__.length) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Not yet a little before.
  await page.waitForTimeout(Math.max(0, due - 1500));
  check("...nothing yet a moment before", (await tv()).pull === null && (await tv()).phase === "off");
  check("...into Futuris", !!(await poll(() => futuris(page), 30000)));
  const samples = await page.evaluate(() => window.__PULL_LOG__);
  const first = samples[0];
  check(`left alone: the set took them, nothing else answering (${JSON.stringify(first)})`, !!first && first.phase === "dive" && first.lock === true);
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
  // (On to it, then: as it comes, from the table.)
  await page.evaluate(() => window.__DEN_PULL_NOW__());
  check("...and then from the table, into the set", !!(await poll(async () => { const t = await tv(); return t && t.pull && t.phase === "dive"; }, 3000, 50)));
  check("...into Futuris", !!(await poll(() => futuris(page), 30000)));
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
