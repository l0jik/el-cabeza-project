/* The game as an Android app (user: "create the app version to have on this
   phone."): android/ (Capacitor) shows the game's own pages from inside the
   app (tools/app_www.mjs makes them, app-www/), its WebView telling them so
   in its user agent ("ElCabezaApp"), its keepScreenOn standing in for the
   Screen Wake Lock the WebView hasn't got. The APK itself is built and
   tried on an emulator by CI (.github/workflows/deploy-pages.yml); here,
   what the app carries and how its pages behave in it:

   - app-www/: everything the pages name is in it (the den spot's H.264 copy
     aside: its VP9 one plays), the title screen's MP4s kept (the WebView
     picks them), each recording as its Opus only, nothing only the website
     needs; its index goes on to Nova.
   - Its pages served from it as the app serves them, with the app's user
     agent: Nova opens (its title screen); a tap asks for no full screen and
     there's no full-screen button (the app is full screen from its first
     frame); the screen's kept on through the app, let go when the game's
     left idle, kept on again at a touch; every world opens with nothing
     missing and no errors. In a phone's browser the same page still has
     its full-screen button.

   node tests/e2e-app.mjs */
import { chromium } from "playwright";
import http from "http";
import { execFileSync } from "child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";

const ROOT = "/home/user/el-cabeza-project/";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

console.log("what the app carries");
execFileSync("node", [ROOT + "tools/app_www.mjs"], { stdio: "pipe" });
const W = ROOT + "app-www/", files = readdirSync(W), has = (f) => files.includes(f);
const idx = readFileSync(W + "index.html", "utf8");
check("its index goes on to Nova", /location\.replace\("el-cabeza-nova\.html"/.test(idx) && has("el-cabeza-nova.html"));
check("nothing only the website needs (the front pages, the old addresses, robots.txt, the APK)", !files.some((f) => f.startsWith("front") || ["el-cabeza-unified.html", "el-cabeza-neon.html", "robots.txt"].includes(f) || f.endsWith(".apk")), files.filter((f) => f.startsWith("front")).join(","));
const mp3s = files.filter((f) => f.endsWith(".mp3"));
check(`each recording as its Opus only (${files.filter((f) => f.endsWith(".opus")).length} Opus, ${mp3s.filter((f) => has(f.replace(/\.mp3$/, ".opus"))).length} MP3s beside a twin)`, mp3s.every((f) => !has(f.replace(/\.mp3$/, ".opus"))));
check("the title screen's MP4s kept (the WebView picks them), the den spot as its VP9 only", ["el-cabeza-title.mp4", "el-cabeza-title-720.mp4", "el-cabeza-title-rewind.mp4", "el-cabeza-title-land.mp4"].every(has) && has("el-cabeza-den-spot.webm") && !has("el-cabeza-den-spot.mp4"));
const named = new Set();
for (const f of files) if (/\.(js|html|webmanifest|css)$/.test(f)) for (const m of readFileSync(W + f, "utf8").matchAll(/el-cabeza-[A-Za-z0-9_.\-]+?\.(?:opus|mp3|webm|mp4|jpg|jpeg|png|webp|woff2|json|webmanifest|html|js|glb|bin|wav|ogg)\b/g)) named.add(m[0]);
const missing = [...named].filter((n) => !has(n) && !(n.endsWith(".mp3") && has(n.replace(/\.mp3$/, ".opus"))) && n !== "el-cabeza-den-spot.mp4");
check(`everything its pages name is in it (${named.size} files named)`, missing.length === 0, missing.join(", "));
const cap = JSON.parse(readFileSync(ROOT + "capacitor.config.json", "utf8"));
check("Capacitor's config: these files, the app's user agent, the bars hidden", cap.webDir === "app-www" && cap.android && cap.android.appendUserAgent === "ElCabezaApp" && cap.plugins && cap.plugins.SystemBars && cap.plugins.SystemBars.hidden === true);
const act = readFileSync(ROOT + "android/app/src/main/java/io/github/l0jik/elcabeza/MainActivity.java", "utf8");
check("the app's activity: full screen, Back into the game, the screen kept on for it", /systemBars\(\)/.test(act) && /canGoBack\(\)/.test(act) && /addJavascriptInterface\(.*, "ElCabezaApp"\)/.test(act) && /FLAG_KEEP_SCREEN_ON/.test(act));

// Served as the app serves them: from app-www/, at the root.
const TYPES = { html: "text/html", js: "text/javascript", json: "application/json", webmanifest: "application/manifest+json", css: "text/css", png: "image/png", jpg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", opus: "audio/ogg", mp3: "audio/mpeg", webm: "video/webm", mp4: "video/mp4" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  const file = W + (path === "/" ? "index.html" : path.slice(1));
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[file.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const PHONE = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const APP = PHONE.replace("Chrome/141.0.0.0 Mobile", "Version/4.0 Chrome/141.0.0.0 Mobile") + " ElCabezaApp";
async function open(ua, { idle = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: ua });
  await ctx.addInitScript((idleMs) => {
    window.__EC_TEST_HOOKS__ = true;
    if (idleMs) window.__EC_TEST_WAKE_IDLE_MS__ = idleMs;
    window.__fsAsked = 0;
    const req = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () { window.__fsAsked++; return req ? req.apply(this, arguments) : Promise.reject(new Error("none")); };
    if (/ElCabezaApp/.test(navigator.userAgent)) {
      // (as in the app: its keepScreenOn, and the WebView's no Screen Wake Lock)
      window.__keep = [];
      window.ElCabezaApp = { keepScreenOn: (on) => window.__keep.push(!!on) };
      try { Object.defineProperty(Navigator.prototype, "wakeLock", { get: () => undefined, configurable: true }); } catch (e) { /* */ }
    }
  }, idle);
  const page = await ctx.newPage();
  const bad = [], errs = [];
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(base.length)}`); });
  page.on("pageerror", (e) => errs.push(e.message));
  return { ctx, page, bad, errs };
}

console.log("\nits pages in the app");
{
  const { ctx, page, bad, errs } = await open(APP);
  await page.goto(base + "?title");
  check("it opens on Nova, its title screen up", !!(await poll(async () => /el-cabeza-nova\.html/.test(page.url()) && (await page.locator('[data-testid="title-screen"]').count()) > 0)), page.url());
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(30, 120);
  await page.waitForTimeout(600);
  check("a tap on it asks for no full screen (the app is, from its first frame)", (await page.evaluate(() => window.__fsAsked)) === 0);
  check("no missing files, no errors", !bad.length && !errs.length, [...bad, ...errs].slice(0, 3).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, bad, errs } = await open(APP, { idle: 2500 });
  await page.goto(base);
  const kept = await poll(() => page.evaluate(() => window.__keep.length && window.__keep[window.__keep.length - 1] === true));
  check("the game up: the screen kept on through the app (keepScreenOn)", !!kept, JSON.stringify(await page.evaluate(() => window.__keep)));
  check("...and no full-screen button", (await page.locator("[data-fullscreen-toggle]").count()) === 0);
  const let_ = await poll(() => page.evaluate(() => window.__keep[window.__keep.length - 1] === false), 12000);
  check("...let go when it's left idle", !!let_, JSON.stringify(await page.evaluate(() => window.__keep)));
  await page.touchscreen.tap(206, 40);
  const again = await poll(() => page.evaluate(() => window.__keep[window.__keep.length - 1] === true), 6000);
  check("...kept on again at a touch", !!again, JSON.stringify(await page.evaluate(() => window.__keep)));
  check("...a tap on the game asks for no full screen", (await page.evaluate(() => window.__fsAsked)) === 0);
  for (const p of ["el-cabeza-futuris.html", "el-cabeza-tienda.html", "el-cabeza-luna.html", "el-cabeza-lluvia.html", "el-cabeza-lab.html", "el-cabeza-parrish.html?look=orinoco", "el-cabeza-ciudad.html", "el-cabeza-noir.html", "el-cabeza-plano.html", "el-cabeza-cromo.html", "el-cabeza-standard.html"]) {
    const n0 = bad.length, e0 = errs.length;
    await page.goto(base + p);
    await page.waitForTimeout(5000);
    check(`${p}: opens with nothing missing, no errors, no full-screen button`, bad.length === n0 && errs.length === e0 && (await page.locator("[data-fullscreen-toggle], [data-testid=lab-fullscreen]").count()) === 0, [...bad.slice(n0), ...errs.slice(e0)].slice(0, 3).join(" | "));
  }
  await ctx.close();
}
{
  const { ctx, page } = await open(PHONE);
  await page.goto(base + "el-cabeza-nova.html");
  check("in a phone's browser the same page still has its full-screen button", !!(await poll(async () => (await page.locator("[data-fullscreen-toggle]").count()) > 0)));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
