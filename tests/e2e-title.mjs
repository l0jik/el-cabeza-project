/* Nova's title screen (apps/title-screen.js; user: the Horizon · Build
   splash "to be the splash screen that appears when the app is first
   opened", a title menu on it, every time, held on the logo until a
   choice; then: "Tapping anywhere on the splash screen, I don't want
   that. I want it to, you have to hit the buttons"; and: "Need the
   splash screen to automatically go full screen. That should be the
   first thing it does").

   - It's up as the page opens (?title: the tests' browsers are automated,
     where it otherwise stays out of the way), the splash playing, the app
     not mounted under it.
   - A new player: when the video's over, the logo held (looping its last
     breath, never past it) and the menu: Begin alone. A tap off the
     button does nothing; Begin begins: the title goes and the story's at
     Big Glutts, the lid on the box.
   - The first tap, wherever it lands, puts the page full screen and does
     nothing else: it plays on. Then, the logo held, Enter does nothing
     until a button has the keyboard; then it's that button. Escape skips
     the video to the logo (where nothing's been tapped yet).
   - Partway (bought): Continue, "where you left off", and Restart the
     story; Continue opens the den.
   - After the story: Continue in the last world played and Other
     realities. Other realities: the menu over the den, Continue in first.
     Continue in Futuris: Futuris, behind its gate. Continue in Lluvia: its
     page. Restart the story asks a second tap, then the story's forgotten
     and the store's there with the lid on.
   - Not on the game's own ways in (?world=, ?title=auto there: as a
     player would have it), nor on a plain open under automation; up on
     a plain open as a player would have it (?title=auto).
   - On a phone the logo moves up to make room: the menu clear of NOVA.

   node tests/e2e-title.mjs */
import { chromium } from "playwright";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 150) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const has = async (page, id) => (await q(page, id).count()) > 0;
const state = (page) => q(page, "title-screen").getAttribute("data-state").catch(() => null);
const mounted = (page) => page.evaluate(() => !!document.querySelector("#root canvas"));
const place = (page) => page.evaluate(() => (window.__TIENDA_THREE__ ? "store" : window.__DEN_THREE__ ? "home" : null));
const fullScreen = (page) => page.evaluate(() => !!document.fullscreenElement);
const gateWorld = (page) => q(page, "reality-gate").getAttribute("data-world").catch(() => null);
const AFTER = { owned: true, storeGone: true, ended: true, hallDue: false };

async function open({ story = null, last = null, phone = false, path = "?title" } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(({ story, last }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      if (story) localStorage.setItem("el-cabeza:story", JSON.stringify(story));
      if (story && story.ended) ["el-cabeza:singularity-seen", "el-cabeza:special-order-noted", "el-cabeza:commercial-aired"].forEach((k) => localStorage.setItem(k, "1"));
      if (last) localStorage.setItem("el-cabeza:last-world", last);
    } catch (e) { /* none */ }
  }, { story, last });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await page.goto(URL + path);
  return { ctx, page, errs };
}
// Skip to the logo, held, with Escape while it plays (a tap doesn't).
async function toMenu(page) {
  await poll(async () => (await state(page)) === "playing", 8000);
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  return poll(async () => (await state(page)) === "held", 6000);
}
const gone = (page) => poll(async () => !(await has(page, "title-screen")), 30000);

/* ---------------- a new player ---------------- */
console.log("\na new player: the splash, the logo held, Begin");
{
  const { ctx, page, errs } = await open();
  check("the title screen's up at once", await poll(() => has(page, "title-screen"), 5000));
  check("...the splash playing", await poll(() => page.evaluate(() => { const v = document.querySelector('[data-testid="title-video"]'); return v && !v.paused && v.currentTime > 0.3; }), 8000));
  check("...the address as it was (no ?title)", !(await page.evaluate(() => location.search.includes("title"))));
  await page.waitForTimeout(1500);
  check("the app's not mounted under it", !(await mounted(page)));
  const held = await poll(async () => (await state(page)) === "held", 20000);
  check("the video over: the logo held", !!held);
  // Held, it loops the last breath, never running on into the end.
  const times = [];
  for (let i = 0; i < 12; i++) { times.push(await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime)); await page.waitForTimeout(400); }
  check("...breathing: the last breath again and again (7.5 to 9.2 s)", times.every((t) => t >= 7.4 && t <= 9.45) && new Set(times.map((t) => t.toFixed(1))).size > 3, times.map((t) => t.toFixed(2)).join(" "));
  check("...the menu: Begin alone", (await q(page, "title-primary").innerText()).trim().toUpperCase() === "BEGIN" && !(await has(page, "title-realities")) && !(await has(page, "title-restart")));
  await page.screenshot({ path: "/tmp/title-new-held.png" });
  // Only the button (user: "you have to hit the buttons").
  await q(page, "title-screen").click({ position: { x: 30, y: 30 } });
  await q(page, "title-screen").click({ position: { x: 640, y: 300 } });
  await page.waitForTimeout(1500);
  check("taps off the button: full screen, nothing else, the logo still held", (await fullScreen(page)) && (await state(page)) === "held" && !(await mounted(page)));
  await q(page, "title-primary").click();
  check("Begin: the title goes", !!(await gone(page)));
  check("...the story, at Big Glutts", (await poll(() => place(page), 20000)) === "store");
  check("...the lid on the box", await poll(() => has(page, "tienda-lid"), 10000));
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- the first tap: full screen ---------------- */
console.log("\nthe first tap, while it plays: full screen, nothing else");
{
  const { ctx, page, errs } = await open();
  await poll(async () => (await state(page)) === "playing", 8000);
  await page.waitForTimeout(700);
  check("not full screen before a tap (a page can't by itself)", !(await fullScreen(page)));
  await q(page, "title-screen").click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(1200);
  const at = await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime);
  check("the first tap: full screen", await fullScreen(page));
  check("...and only that: it plays on", (await state(page)) === "playing" && at < 7, `${await state(page)} at ${at.toFixed(2)} s`);
  check("the video over: the logo held, the menu", !!(await poll(async () => (await state(page)) === "held", 15000)));
  check("...the app still waiting", !(await mounted(page)));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  check("Enter with no button chosen: nothing", (await state(page)) === "held");
  await q(page, "title-primary").focus();
  await page.keyboard.press("Enter");
  check("...Enter on Begin: the title goes", !!(await gone(page)));
  check("...the store", (await poll(() => place(page), 20000)) === "store");
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- partway ---------------- */
console.log("\npartway through the story: Continue, Restart the story");
{
  const { ctx, page, errs } = await open({ story: { owned: true } });
  const t0 = Date.now();
  check("Escape skips to the logo, held, with the menu", !!(await toMenu(page)) && Date.now() - t0 < 6000);
  check("...the video at the last breath", await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime >= 7.4));
  const t = (await q(page, "title-primary").innerText()).toUpperCase();
  check("Continue, where you left off", /CONTINUE/.test(t) && /WHERE YOU LEFT OFF/.test(t), t);
  check("...Restart the story, no Other realities yet", (await has(page, "title-restart")) && !(await has(page, "title-realities")));
  await q(page, "title-primary").click();
  check("Continue: the den", !!(await gone(page)) && (await poll(() => place(page), 20000)) === "home");
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- after the story ---------------- */
console.log("\nafter the story: Continue in the last world, Other realities");
{
  const { ctx, page, errs } = await open({ story: AFTER, last: "lluvia" });
  await toMenu(page);
  const t = (await q(page, "title-primary").innerText()).toUpperCase();
  check("Continue in Lluvia", /CONTINUE/.test(t) && /IN LLUVIA/.test(t), t);
  check("...Other realities and Restart the story", (await has(page, "title-realities")) && (await has(page, "title-restart")));
  await q(page, "title-realities").click();
  check("Other realities: the menu over the den", !!(await gone(page)) && !!(await poll(() => has(page, "realities"), 15000)));
  check("...Continue in Lluvia first", /Lluvia/.test(await page.locator('[data-testid="realities"] .continue').innerText().catch(() => "")));
  check("...the den behind it", (await poll(() => place(page), 20000)) === "home");
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, errs } = await open({ story: AFTER, last: "futuris" });
  await toMenu(page);
  check("Continue in Futuris", /IN FUTURIS/.test((await q(page, "title-primary").innerText()).toUpperCase()));
  await q(page, "title-primary").click();
  check("...Futuris, behind its gate", !!(await gone(page)) && (await poll(() => gateWorld(page), 20000)) === "futuris");
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ story: AFTER, last: "lluvia" });
  await toMenu(page);
  await q(page, "title-primary").click();
  check("Continue in Lluvia: its page", !!(await poll(() => page.evaluate(() => /el-cabeza-lluvia\.html/.test(location.href)), 20000)));
  await ctx.close();
}
{
  const { ctx, page, errs } = await open({ story: AFTER, last: "den" });
  await toMenu(page);
  await q(page, "title-restart").click();
  check("Restart the story asks a second tap", /TAP AGAIN/i.test(await q(page, "title-restart").innerText()) && (await has(page, "title-screen")));
  await q(page, "title-restart").click();
  check("...then the title goes", !!(await gone(page)));
  check("...the store, the lid on the box", (await poll(() => place(page), 20000)) === "store" && !!(await poll(() => has(page, "tienda-lid"), 10000)));
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:story") || "{}"));
  check("...the story forgotten", !rec.owned && !rec.ended, JSON.stringify(rec));
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- not on the game's own ways in ---------------- */
console.log("\nnot on the game's own ways in");
{
  const { ctx, page } = await open({ path: "" });
  await page.waitForTimeout(1500);
  check("a plain open, automated: no title", !(await has(page, "title-screen")) && (await poll(() => place(page), 20000)) === "store");
  await ctx.close();
}
{
  const { ctx, page } = await open({ story: AFTER, path: "?title=auto&world=standard" });
  await page.waitForTimeout(1500);
  check("from another world's menu (?world=): no title", !(await has(page, "title-screen")) && (await poll(() => place(page), 20000)) === "home");
  await ctx.close();
}

{
  const { ctx, page } = await open({ path: "?title=auto" });
  check("a plain open, as a player would have it: the title", !!(await poll(() => has(page, "title-screen"), 5000)));
  await ctx.close();
}

/* ---------------- a phone ---------------- */
console.log("\na phone: room made for the menu");
{
  const { ctx, page, errs } = await open({ story: AFTER, last: "den", phone: true });
  await toMenu(page);
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="title-video"]').getBoundingClientRect();
    const menu = document.querySelector('[data-testid="title-primary"]').getBoundingClientRect();
    // the video's picture inside its box (contained), and where NOVA ends (88.5% down it)
    const ph = Math.min(v.height, (v.width * 1920) / 1080), top = v.top + (v.height - ph) / 2;
    return { novaEnd: top + 0.885 * ph, emblemTop: top + 0.22 * ph, menuTop: menu.top, menuBottom: menu.bottom, h: innerHeight };
  });
  check("the menu clear of NOVA", m.menuTop > m.novaEnd, JSON.stringify(m));
  check("...the emblem still on the screen", m.emblemTop >= 0, JSON.stringify(m));
  check("...the menu on the screen", m.menuBottom <= m.h, JSON.stringify(m));
  await page.screenshot({ path: "/tmp/title-phone-held.png" });
  await page.tap('[data-testid="title-primary"]');
  check("Continue in The Den: the den", !!(await gone(page)) && (await poll(() => place(page), 20000)) === "home");
  check("no errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- on a home screen ---------------- */
// (Opened from its icon it's full screen from the start: the manifest.)
console.log("\nas an app on a home screen: full screen from the start");
{
  const fs = await import("node:fs");
  const dist = "/home/user/el-cabeza-project/dist/";
  const m = JSON.parse(fs.readFileSync(dist + "el-cabeza-nova.webmanifest", "utf8"));
  check("the manifest: full screen, opening Nova's page", m.display === "fullscreen" && m.start_url === "el-cabeza-nova.html", JSON.stringify(m));
  const png = (f) => { const b = fs.readFileSync(dist + f); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };
  check("...its icons there, the sizes they say, one for a launcher's mask", m.icons.every((i) => png(i.src) === i.sizes) && m.icons.some((i) => i.purpose === "maskable"));
  const { ctx, page } = await open({ path: "" });
  const head = await page.evaluate(() => ({
    manifest: (document.querySelector('link[rel="manifest"]') || {}).getAttribute?.("href"),
    apple: (document.querySelector('meta[name="apple-mobile-web-app-capable"]') || {}).content,
    touch: (document.querySelector('link[rel="apple-touch-icon"]') || {}).getAttribute?.("href"),
  }));
  check("...Nova's page names it, and an iPhone's home-screen icon", head.manifest === "el-cabeza-nova.webmanifest" && head.apple === "yes" && head.touch === "el-cabeza-icon-180.png" && png("el-cabeza-icon-180.png") === "180x180", JSON.stringify(head));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall title screen checks passed");
process.exit(failures ? 1 : 0);
