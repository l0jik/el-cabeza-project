/* Nova, home before the first Singularity: the set waits to be noticed
   (den-fx.js lure, den-tv.js haunt). For 25 s nothing; then, left alone,
   it stirs, more and more, heard loudest near it; as it starts, the den
   looks round (the stereo, the hall door, over the set) with "Huh? What's
   going on?", taps waiting meanwhile. At the blast, if it's still not
   been tapped: "!!", any sheet put away, the head turned to the set and
   held there, nothing but a tap on it doing anything. A tap on it (or the
   menu's Turn on the TV, the same press) takes the camera over to watch (still off, stirring more often); a tap anywhere
   else goes back; a second tap on it turns it on, into Neon.
   The test moves the lure's clock on (__DEN_LURE_SKIP__).

   node tests/e2e-tv-lure.mjs [--shots DIR] */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 250) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
check("home, in the den", await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000));
await page.waitForTimeout(1500);
const tv = () => page.evaluate(() => window.__DEN_TV__());
const near = () => page.evaluate(() => (window.__DEN_AUDIO__ && window.__DEN_AUDIO__().haunt.near) || 0);
let s = await tv();
check("the set waits at first", s.lure && s.locked, JSON.stringify(s));
await page.waitForTimeout(3000);
check("...and nothing stirs yet", (await tv()).lureEvents === 0);
// A record on, at full: the set's stirring mustn't be lost under it.
await poll(() => page.evaluate(() => !!window.__DEN_TEST_PLAY__), 10000);
await page.evaluate(() => window.__DEN_TEST_PLAY__("el-cabeza-den-record-1.mp3"));
await page.waitForTimeout(800);
const mus = () => page.evaluate(() => { const a = window.__DEN_AUDIO__(); return { pull: a.tvPull, duck: a.music && a.music.duck, wobble: a.music && a.music.wobble }; });
const m0 = await mus();
check(`a record plays at full before the set stirs (${JSON.stringify(m0)})`, m0.pull === 0 && m0.duck > 0.95);
// (On to just past the 25 s, whenever the den's clock began. The look
// round's thought pinned to "Huh?" here; who's messing with the music is
// its own check, below.)
await page.evaluate(() => window.__DEN_HUH_PIN__(false));
await page.evaluate(() => window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 400));
check("after 25 s it stirs", !!(await poll(async () => (await tv()).lureEvents >= 1, 15000)), JSON.stringify(await tv()));
const m1 = await poll(async () => { const m = await mus(); return m.duck < 0.55 && m.wobble > 0 ? m : null; }, 6000);
check(`...and the record backs off and warps (${JSON.stringify(m1 || (await mus()))})`, !!m1);
// The look round (user): the den takes the camera, the head turns from
// side to side (the stereo, the hall door, over the set) and back; a
// thought; meanwhile only a tap on the set does anything.
check("the den takes the camera: it looks round", !!(await poll(async () => (await tv()).glance === "round", 4000, 50)), JSON.stringify(await tv()));
check("...\"Huh? What's going on?\"", !!(await poll(async () => /Huh\? What's going on\?/.test(await page.locator('[data-testid="den-huh"]').innerText().catch(() => "")), 4000, 100)));
check("...taps elsewhere wait meanwhile", (await tv()).lock === true);
check("...and it passes over the set", !!(await poll(async () => (await tv()).glanceAt === "tv", 9000, 50)));
check("...then back, and the taps are free again", !!(await poll(async () => { const t = await tv(); return t.glance === null && !t.lock; }, 9000, 100)), JSON.stringify(await tv()));
await page.waitForTimeout(400);
const far = await near();
// The music panel up as the blast comes, the camera over at the console:
// it'll be put away, and the camera back, so it can turn to the set.
// (The lure's clock held back a little meanwhile: its own blast, 16 s in,
// mustn't come before the panel's up.)
await page.evaluate(() => window.__DEN_LURE_SKIP__(-6000));
await openDockPanel(page).catch(() => {});
await page.locator('[data-testid="sound-button"]').first().click();
await page.locator('[data-testid="sound-music"]').click();
check("the music panel up, the camera at the console", !!(await poll(async () => (await page.locator('[data-testid="music-panel"]').count()) === 1 && (await page.evaluate(() => window.__DEN_STEREO__().focus)) > 0.9, 6000, 100)));
// Left alone a good while: it stirs, often.
await page.evaluate(() => window.__DEN_LURE_SKIP__(60000));
// The blast (user): once, a cone of light out of the set until all goes
// white for a second, then back.
check("the blast: once, a while in", !!(await poll(async () => (await tv()).blasted, 8000, 50)), JSON.stringify(await tv()));
check("...everything goes white", !!(await poll(async () => (await tv()).white > 0.97, 6000, 30)));
check("...and fades back", !!(await poll(async () => (await tv()).white === 0 && !(await page.locator('[data-testid="den-whiteout"]').count()), 8000, 100)));
// The set still not looked at (user): "!!", and the head turns to it and
// stays; nothing but a tap on it does anything.
check("the blast, the set not looked at: \"!!\"", /!!/.test(await page.locator('[data-testid="den-bang"]').innerText().catch(() => "")));
check("...the head turned to the set, held there", (await tv()).glance === "fix" && (await tv()).glanceAt === "tv" && (await tv()).fixed);
check("...the music panel put away, the camera back from the console", (await page.locator('[data-testid="music-panel"]').count()) === 0 && (await page.evaluate(() => window.__DEN_STEREO__().focus)) < 0.05);
{
  const box0 = await page.locator("canvas").first().boundingBox();
  await page.mouse.click(box0.x + 12, box0.y + box0.height - 12);
  await page.waitForTimeout(600);
  const dockOpen = await page.evaluate(() => !!document.querySelector('[data-testid="dock-panel"][data-open="true"]'));
  check("...a tap elsewhere does nothing (still held)", (await tv()).fixed && (await tv()).glance === "fix" && !dockOpen);
}
if (shots) {
  await page.evaluate(() => window.__DEN_TV_LOOK__(true));
  await page.waitForTimeout(2500);
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(650); await page.screenshot({ path: `${shots}/lure-${String(i).padStart(2, "0")}.png` }); }
  await page.evaluate(() => window.__DEN_TV_LOOK__(false)); await page.waitForTimeout(3500);
}
const n0 = (await tv()).lureEvents;
const n = await poll(async () => { const t = await tv(); return t.lureEvents >= n0 + 3 ? t.lureEvents - n0 : null; }, 30000);
check(`...more and more (${n || 0} more events)`, !!n);
// A tap on the set (a real one, where it is on the screen, through the
// hold): over to watch it, still off (the rest of the tap goes nowhere,
// not a second press).
const at = await page.evaluate(() => window.__DEN_TV_AT__());
check(`a tap on the set (${at && `${Math.round(at.x)}, ${Math.round(at.y)}`})...`, !!at && at.over, JSON.stringify(at));
if (at) await page.mouse.click(at.x, at.y);
check("...takes the camera over to watch", !!(await poll(async () => { const t = await tv(); return t.looking && t.focus > 0.9; }, 8000, 100)), JSON.stringify(await tv()));
check("...and the den lets go of the head", !!(await poll(async () => { const t = await tv(); return !t.fixed && !t.lock && t.glance === null; }, 4000, 100)), JSON.stringify(await tv()));
check("...and it's still off", (await tv()).phase === "off");
check("...with the hint, on two lines, no dot", await page.locator('[data-testid="den-tv-hint"].on').count() === 1 && !/\u00b7/.test(await page.locator('[data-testid="den-tv-hint"]').innerText()));
check("...and soon the Singularity flashes on the dead tube", !!(await poll(async () => (await tv()).flashes >= 1, 6000, 50)), JSON.stringify(await tv()));
check(`...its sounds louder there (${far.toFixed(2)} -> ${(await near()).toFixed(2)})`, (await near()) > far * 1.3);
const w0 = (await tv()).lureEvents;
if (shots) { await page.evaluate(() => window.__DEN_TV_FLASH__(1500)); await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/flash.png` }); }
await page.waitForTimeout(6000);
check(`...no more than three times (${(await tv()).flashes})`, (await tv()).flashes <= 3);
check(`...where it keeps stirring (${(await tv()).lureEvents - w0} in 6 s)`, (await tv()).lureEvents - w0 >= 2);
// A tap elsewhere: back.
const box = await page.locator("canvas").first().boundingBox();
await page.mouse.click(box.x + 12, box.y + box.height - 12);
check("a tap off the set goes back", !!(await poll(async () => { const t = await tv(); return !t.looking && t.goal === 0 && t.phase === "off"; }, 3000, 100)));
await page.waitForTimeout(4200);
// Over again, and a tap on the set (the middle of the screen) turns it on.
await page.evaluate(() => window.__DEN_TV_PRESS__());
await poll(async () => (await tv()).focus > 0.95, 8000, 100);
await page.waitForTimeout(500);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
check("the second tap turns it on", !!(await poll(async () => (await tv()).phase !== "off", 3000, 100)), JSON.stringify(await tv()));
check("...into Neon", await poll(() => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector(".ec-title") && /Chakra/.test(getComputedStyle(document.querySelector(".ec-title")).fontFamily)), 30000));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));

// The look round's thought, half the time (user): who's messing with what's
// being listened to, the record or the 8-track; "Huh?" with nothing on.
console.log("who's messing with it");
{
  const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx2.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
  });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on("pageerror", (e) => errs2.push(e.message));
  await p2.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await poll(() => p2.evaluate(() => !!window.__DEN_TV__ && !!window.__DEN_PLAY_TRACK__), 30000);
  // (The first visit's own music first, then a tape over it.)
  await poll(() => p2.evaluate(() => !!(window.__DEN_STEREO__ && window.__DEN_STEREO__().playing)), 10000);
  await p2.evaluate(() => window.__DEN_PLAY_TRACK__("tape-parse"));
  check("an 8-track on", !!(await poll(() => p2.evaluate(() => window.__DEN_STEREO__().playing === "8track"), 8000)));
  await p2.evaluate(() => { window.__DEN_HUH_PIN__(true); window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 400); });
  const said = await poll(async () => { const t = await p2.locator('[data-testid="den-huh"]').innerText().catch(() => ""); return t.trim() || null; }, 8000, 100);
  check(`...the set acts up: "${said}"`, said === "Who's messing with my 8-track?");
  check("...or, the other half of the time, \"Huh? What's going on?\"", (await p2.evaluate(() => window.__DEN_HUH_LINE__(false))) === "Huh? What's going on?");
  await p2.evaluate(() => window.__DEN_PLAY_TRACK__("dangerous-dashing"));
  await poll(() => p2.evaluate(() => window.__DEN_STEREO__().playing === "record"), 8000);
  check("a record on: \"Who's messing with my record?\"", (await p2.evaluate(() => window.__DEN_HUH_LINE__(true))) === "Who's messing with my record?");
  // Paused (the now-playing chip, once the look round's let go of the
  // taps): nothing's being listened to.
  await poll(() => p2.evaluate(() => !window.__DEN_TV__().lock && window.__DEN_TV__().glance === null), 12000, 100);
  await p2.locator('[data-testid="music-chip-toggle"]').first().click();
  await poll(() => p2.evaluate(() => !window.__DEN_STEREO__().playing), 5000);
  check("paused: \"Huh? What's going on?\" only", (await p2.evaluate(() => window.__DEN_HUH_LINE__(true))) === "Huh? What's going on?");
  check(`no page errors (${errs2.length})`, errs2.length === 0, errs2.join(" | "));
  await ctx2.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
