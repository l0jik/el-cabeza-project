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
   - A new player: the menu once EL CABEZA and NOVA are both in, 6.9 s
     into the video (user: "BEGIN should be the last thing to show up on
     the screen"), the video playing on into its last two breaths, then
     looping them, never past them; Begin alone. A tap off the button does
     nothing; Begin begins: squeezed to a line, the splash played back to
     the board as the app comes up under it ("it should play the animation
     in reverse"), then the title goes and the story's at Big Glutts, the
     lid on the box. Escape as it plays back: gone once the app's up. On
     a phone, Begin tapped the moment it's in, the page's first tap: full
     screen and begun, both ("as soon as BEGIN is on screen ... you should
     immediately be able to click on it").
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
    // When the title came up, and when it first went to each state; and
    // when it began to fade, where its playback back to the board was.
    const T = (window.__TITLE_T__ = {});
    new MutationObserver(() => {
      const r = document.querySelector('[data-testid="title-screen"]');
      if (!r) return;
      if (T.open == null) T.open = performance.now();
      const s = r.getAttribute("data-state");
      if (s && T[s] == null) T[s] = performance.now();
      if (T.gone == null && r.classList.contains("gone")) {
        const v = document.querySelector('[data-testid="title-rewind"]');
        T.gone = performance.now();
        T.rew = v ? { on: v.classList.contains("on"), ended: v.ended, t: v.currentTime, d: v.duration } : null;
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "class"] });
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
  check("the app's not mounted under it", !(await mounted(page)));
  const vt = () => page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime);
  const heldAt = await poll(async () => (await state(page)) === "held" && vt(), 20000, 50);
  check(`Begin the last thing in: NOVA in by 6.7 s, the menu at 6.9 s of video (${heldAt ? heldAt.toFixed(2) : "?"} s)`, !!heldAt && heldAt >= 6.85 && heldAt < 7.6);
  check("...the video playing on", !!(await poll(async () => (await vt()) > heldAt + 0.8, 4000, 100)));
  // Held, it loops the last two breaths (the board's ghost once round in
  // them), never running on into the end.
  await poll(async () => (await vt()) > 11.6, 10000, 100);
  await poll(async () => (await vt()) < 11.0, 4000, 50);
  const times = [];
  for (let i = 0; i < 12; i++) { times.push(await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime)); await page.waitForTimeout(400); }
  check("...breathing: the last two breaths again and again (8.5 to 11.9 s)", times.every((t) => t >= 8.4 && t <= 12.15) && new Set(times.map((t) => t.toFixed(1))).size > 3, times.map((t) => t.toFixed(2)).join(" "));
  check("...the menu: Begin alone", (await q(page, "title-primary").innerText()).trim().toUpperCase() === "BEGIN" && !(await has(page, "title-realities")) && !(await has(page, "title-restart")));
  await page.screenshot({ path: "/tmp/title-new-held.png" });
  // Only the button (user: "you have to hit the buttons").
  await q(page, "title-screen").click({ position: { x: 30, y: 30 } });
  await q(page, "title-screen").click({ position: { x: 640, y: 300 } });
  await page.waitForTimeout(1500);
  check("taps off the button: full screen, nothing else, the logo still held", (await fullScreen(page)) && (await state(page)) === "held" && !(await mounted(page)));
  await q(page, "title-primary").click();
  // The way out (user: "When clicking begin on the splash screen, it
  // should play the animation in reverse. Like maybe begin like zooms out
  // like vertically, and then as it's doing that, then everything goes in
  // reverse"): Begin squeezed to a line, the splash played back from the
  // held logo to the board as the app comes up under it, the title off it
  // once that's over.
  check("Begin: squeezed to a line as it goes", await page.evaluate(() => document.querySelector('[data-testid="title-primary"]').classList.contains("picked") && getComputedStyle(document.querySelector('[data-testid="title-primary"]')).animationName === "ecPicked"));
  // (The app's mounting can hold the page's script up for a while here, the
  // playback going on regardless: by the time the page answers it may be over.)
  const R = await poll(() => page.evaluate(() => { const v = document.querySelector('[data-testid="title-rewind"]'); return !!v && v.classList.contains("on") && (v.ended || (!v.paused && v.currentTime > 0.2)) && { t: v.currentTime, d: v.duration, ended: v.ended }; }), 8000, 50);
  // (4.8 s: user, of the first, 2.75 s: "the reverse sequence needs to go
  // a little bit more slowly".)
  check("...the splash played back to the board (4.8 s)", !!R && R.d > 4.6 && R.d < 5.0, JSON.stringify(R));
  check("...the logo's loop stopped under it", !!(await poll(() => page.evaluate(() => document.querySelector('[data-testid="title-video"]').paused), 10000, 50)));
  check("...the app coming up under it meanwhile", !!(await poll(() => page.evaluate(() => !!document.querySelector("#root canvas") && !!document.querySelector('[data-testid="title-screen"]')), 10000, 50)));
  await page.screenshot({ path: "/tmp/title-new-rewind.png" });
  check("Begin: the title goes", !!(await gone(page)));
  const G = await page.evaluate(() => window.__TITLE_T__);
  check("...once the playback's over, on the board", !!G.rew && G.rew.on && (G.rew.ended || G.rew.t >= G.rew.d - 0.1), JSON.stringify(G.rew));
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
  check("...then the menu", !!(await poll(async () => (await state(page)) === "held", 15000)));
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
  check("...the video at the last breaths", await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime >= 8.4));
  const t = (await q(page, "title-primary").innerText()).toUpperCase();
  check("Continue, where you left off", /CONTINUE/.test(t) && /WHERE YOU LEFT OFF/.test(t), t);
  check("...Restart the story, no Other realities yet", (await has(page, "title-restart")) && !(await has(page, "title-realities")));
  // (When the app says it's up.)
  await page.evaluate(() => { const t = window.ecTitle, done = t.done; t.done = () => { window.__TITLE_T__.up = performance.now(); done(); }; });
  await q(page, "title-primary").click();
  await poll(() => page.evaluate(() => document.querySelector('[data-testid="title-rewind"]').classList.contains("on")), 5000, 50);
  const E = await page.evaluate(() => performance.now());
  await page.keyboard.press("Escape");
  check("Continue: the den", !!(await gone(page)) && (await poll(() => place(page), 20000)) === "home");
  const G = await page.evaluate(() => window.__TITLE_T__);
  check("...Escape as it plays back: gone as soon as the den's up", G.up != null && G.gone - Math.max(E, G.up) < 500, JSON.stringify({ E, up: G.up, gone: G.gone, rew: G.rew }));
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

/* ---------------- a phone, Begin at once ---------------- */
console.log("\na phone, a new player: Begin tapped the moment it's in");
{
  const { ctx, page, errs } = await open({ phone: true });
  const T = await poll(() => page.evaluate(() => window.__TITLE_T__.held != null && window.__TITLE_T__), 25000, 50);
  const at = await page.evaluate(() => document.querySelector('[data-testid="title-video"]').currentTime);
  check(`Begin in once NOVA is (the video at ${at.toFixed(2)} s)`, !!T && at >= 6.85 && at < 7.8, JSON.stringify(T));
  // (By its place, as it fades in: a finger doesn't wait for it to settle.)
  const b = await page.evaluate(() => { const r = document.querySelector('[data-testid="title-primary"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(b.x, b.y);
  const L = await poll(() => page.evaluate(() => window.__TITLE_T__.leaving != null && window.__TITLE_T__), 5000, 25);
  check(`...tapped at once, the page's first tap, heard at once (${L ? (L.leaving - L.held).toFixed(0) : "?"} ms after it came in)`, !!L && L.leaving - L.held < 1500, JSON.stringify(L));
  check("...and that one tap put the page full screen too", await poll(() => fullScreen(page), 3000, 100));
  check("...the title goes, the store", !!(await gone(page)) && (await poll(() => place(page), 20000)) === "store");
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
