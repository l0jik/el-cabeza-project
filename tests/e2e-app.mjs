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
   - Its fonts (user: "I want the APK to be able to run the game completely
     with everything without having access to the internet."): its own copy
     of every Google Fonts request its pages make (fonts/, from
     assets/fonts/app/), nothing of Google's left in its pages, the fonts'
     licences with them.
   - Its pages served from it as the app serves them, with the app's user
     agent and nothing reachable but the app's own files (as on a phone
     with no connection): Nova opens (its title screen); a tap asks for no
     full screen and there's no full-screen button (the app is full screen
     from its first frame); the screen's kept on through the app, let go
     when the game's left idle, kept on again at a touch; every world and
     each of the Lab's directions opens with nothing missing, no errors,
     no word sent off the phone, and its type drawn from the app's copy (no
     font failed; the corner menu's look's fonts from fonts/). In a phone's
     browser the same page still has its full-screen button, and the
     corner menu's fonts come from Google.
   - Its update note (user: "yes, add the update available note"): with a
     newer version on the site (its el-cabeza-app.json), the title
     screen's quiet line under the menu, its date and size; Get it opens
     the APK in the phone's browser (the app's openInBrowser); Not now
     lets that version be, a newer one still told. The same version, no
     connection, or an app too old to say its version: no line, no
     errors. Never in a phone's browser.

   node tests/e2e-app.mjs */
import { chromium } from "playwright";
import http from "http";
import { execFileSync } from "child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { LAB_SPECS } from "../themes/lab/specs.js";
import { openDockPanel } from "./dock-helpers.mjs";

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
// (el-cabeza-app.json is the site's, asked of it by the update note.)
const missing = [...named].filter((n) => !has(n) && !(n.endsWith(".mp3") && has(n.replace(/\.mp3$/, ".opus"))) && n !== "el-cabeza-den-spot.mp4" && n !== "el-cabeza-app.json");
check(`everything its pages name is in it (${named.size} files named)`, missing.length === 0, missing.join(", "));
const F = W + "fonts/", fontFiles = existsSync(F) ? readdirSync(F) : [];
const sheets = fontFiles.filter((f) => f.endsWith(".css"));
const pageText = files.filter((f) => /\.(html|js|css)$/.test(f)).map((f) => [f, readFileSync(W + f, "utf8")]);
const asksApp = new Set(), toGoogle = [];
for (const [f, t] of pageText) {
  for (const m of t.matchAll(/fonts\/q-([0-9a-f]{8})\.css/g)) asksApp.add(`q-${m[1]}.css`);
  const n = t.split("fonts.googleapis.com").length - t.split('https://fonts.googleapis.com/css2?"').length + (t.includes("fonts.gstatic.com") ? 1 : 0);
  if (n > 0) toGoogle.push(`${f} (${n})`);
}
const named404 = [];
for (const c of sheets) for (const m of readFileSync(F + c, "utf8").matchAll(/url\(([^)]+)\)/g)) if (!fontFiles.includes(m[1])) named404.push(`${c}: ${m[1]}`);
check(`its fonts: its own copy of each Google Fonts request its pages make (${asksApp.size} in the pages, ${sheets.length} stylesheets, ${fontFiles.filter((f) => f.endsWith(".woff2")).length} fonts), each font they name there`, asksApp.size > 0 && [...asksApp].every((c) => sheets.includes(c)) && sheets.length > 20 && !named404.length, [...[...asksApp].filter((c) => !sheets.includes(c)), ...named404].slice(0, 4).join(", "));
check("...nothing of Google's left in its pages (no link, no word ahead), but fontsHref's way for the website", !toGoogle.length, toGoogle.slice(0, 4).join(", "));
check("...and the fonts' licences with them", fontFiles.includes("LICENSES.txt") && /SIL OPEN FONT LICENSE/.test(readFileSync(F + "LICENSES.txt", "utf8")));
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
// (In the app nothing but its own files is reachable: anything else it
// asks for is noted and refused, as with no connection. The site's word on
// its newest app, asked by the title screen's update note, apart: `latest`
// as its answer, or refused. `version`: the app's own, as its versionCode()
// says; 0, an app from before the note, which can't say.)
const VERSION_URL = "https://l0jik.github.io/el-cabeza-project/el-cabeza-app.json";
async function open(ua, { idle = null, version = 0, latest = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: ua });
  const outside = [], asked = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u === VERSION_URL) {
      asked.push(u);
      return latest ? route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(latest) }) : route.abort("internetdisconnected");
    }
    outside.push(u.slice(0, 90));
    return route.abort("internetdisconnected");
  });
  await ctx.addInitScript(({ idleMs, version }) => {
    window.__EC_TEST_HOOKS__ = true;
    if (idleMs) window.__EC_TEST_WAKE_IDLE_MS__ = idleMs;
    window.__fsAsked = 0;
    const req = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () { window.__fsAsked++; return req ? req.apply(this, arguments) : Promise.reject(new Error("none")); };
    if (/ElCabezaApp/.test(navigator.userAgent)) {
      // (as in the app: its keepScreenOn, its version and openInBrowser,
      // and the WebView's no Screen Wake Lock)
      window.__keep = [];
      window.__opened = [];
      window.ElCabezaApp = { keepScreenOn: (on) => window.__keep.push(!!on) };
      if (version) Object.assign(window.ElCabezaApp, { versionCode: () => version, openInBrowser: (u) => window.__opened.push(u) });
      try { Object.defineProperty(Navigator.prototype, "wakeLock", { get: () => undefined, configurable: true }); } catch (e) { /* */ }
    }
  }, { idleMs: idle, version });
  const page = await ctx.newPage();
  const bad = [], errs = [];
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(base.length)}`); });
  page.on("pageerror", (e) => errs.push(e.message));
  return { ctx, page, bad, errs, outside, asked };
}
// The page's type: the faces it's drawing with (loaded as it needed them),
// then every face it has, each loaded from the app's copy: none failed.
// (A face can go unused here where a page names a font this machine has
// first: the Lab's Swiss, Helvetica; a phone hasn't.)
const fontsNow = (page) => page.evaluate(async () => {
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]);
  const all = [...document.fonts];
  const used = [...new Set(all.filter((f) => f.status === "loaded").map((f) => f.family))];
  await Promise.race([Promise.allSettled(all.map((f) => f.load())), new Promise((r) => setTimeout(r, 8000))]);
  return { used, faces: all.length, loaded: all.filter((f) => f.status === "loaded").length, failed: all.filter((f) => f.status !== "loaded").map((f) => `${f.family} ${f.weight} ${f.status}`) };
});
const usedLine = (t) => `${t.faces} faces, all loaded; drawing with ${t.used.slice(0, 4).join(", ") || "none here"}${t.used.length > 4 ? "..." : ""}`;
// A game begun (the corner menu's up then) and its look's font link.
async function cornerFonts(page, world) {
  await page.goto(base + world);
  await page.waitForTimeout(2500);
  if (await openDockPanel(page)) { await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click().catch(() => {}); }
  return poll(() => page.evaluate(() => { const l = document.querySelector('link[id^="cm-fonts-"]'); return l ? l.getAttribute("href") : null; }), 15000);
}

console.log("\nits pages in the app");
{
  const { ctx, page, bad, errs, outside } = await open(APP);
  await page.goto(base + "?title");
  check("it opens on Nova, its title screen up", !!(await poll(async () => /el-cabeza-nova\.html/.test(page.url()) && (await page.locator('[data-testid="title-screen"]').count()) > 0)), page.url());
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(30, 120);
  await page.waitForTimeout(600);
  check("a tap on it asks for no full screen (the app is, from its first frame)", (await page.evaluate(() => window.__fsAsked)) === 0);
  check("no missing files, no errors", !bad.length && !errs.length, [...bad, ...errs].slice(0, 3).join(" | "));
  const ft = await fontsNow(page);
  check(`its type from the app's own copy (${usedLine(ft)}), nothing asked of the internet`, ft.used.length > 0 && ft.faces > 0 && !ft.failed.length && !outside.length, [...ft.failed, ...outside].slice(0, 4).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, bad, errs, outside } = await open(APP, { idle: 2500 });
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
  const ft = await fontsNow(page);
  check(`...its type the app's (${usedLine(ft)}), nothing asked of the internet`, ft.faces > 0 && !ft.failed.length && !outside.length, [...ft.failed, ...outside].slice(0, 4).join(" | "));
  const o0 = outside.length, cm = await cornerFonts(page, "el-cabeza-ciudad.html"), ct = await fontsNow(page);
  check(`a game begun in the City: the corner menu's look's fonts from the app's copy (${(cm || "none").split("?")[0]}; ${usedLine(ct)}), nothing asked of the internet`, !!cm && /^fonts\/q-[0-9a-f]{8}\.css\?family=/.test(cm) && !ct.failed.length && outside.length === o0, [...ct.failed, ...outside.slice(o0)].slice(0, 4).join(" | "));
  const worlds = ["el-cabeza-futuris.html", "el-cabeza-tienda.html", "el-cabeza-luna.html", "el-cabeza-lluvia.html", "el-cabeza-lab.html", "el-cabeza-parrish.html?look=orinoco", "el-cabeza-parrish.html?look=watermark", "el-cabeza-ciudad.html", "el-cabeza-noir.html", "el-cabeza-plano.html", "el-cabeza-cromo.html", "el-cabeza-standard.html"];
  for (const p of [...worlds, ...LAB_SPECS.map((d) => `el-cabeza-lab.html?theme=${d.id}`)]) {
    const n0 = bad.length, e0 = errs.length, o0 = outside.length;
    await page.goto(base + p);
    await page.waitForTimeout(p.includes("?theme=") ? 3000 : 5000);
    const t = await fontsNow(page);
    check(`${p}: opens with nothing missing, no errors, no full-screen button, nothing asked of the internet, its type the app's (${usedLine(t)})`, bad.length === n0 && errs.length === e0 && outside.length === o0 && t.faces > 0 && !t.failed.length && (await page.locator("[data-fullscreen-toggle], [data-testid=lab-fullscreen]").count()) === 0, [...bad.slice(n0), ...errs.slice(e0), ...outside.slice(o0), ...t.failed].slice(0, 4).join(" | "));
  }
  await ctx.close();
}
console.log("\nits update note");
const LATEST = { versionCode: 1032, versionName: "2.0.0", commit: "abcdef1", built: "2026-11-20T19:00:00Z", size: 63713959, apk: "el-cabeza.apk" };
const note = (page) => page.evaluate(() => { const n = document.querySelector('[data-testid="title-update"]'); return n ? { text: n.innerText.replace(/\s+/g, " ").trim(), shown: getComputedStyle(n).opacity === "1", menu: document.querySelector('[data-testid="title-screen"]').classList.contains("menu-on") } : null; });
// (The title screen, its menu up at once: Escape, as on a keyboard.)
async function title(page) {
  await page.goto(base + "?title");
  await poll(() => page.locator('[data-testid="title-screen"]').count(), 10000);
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await poll(() => page.evaluate(() => document.querySelector('[data-testid="title-screen"]').classList.contains("menu-on")), 10000);
  await page.waitForTimeout(1500);
}
{
  const { ctx, page, bad, errs, outside, asked } = await open(APP, { version: 1031, latest: LATEST });
  await title(page);
  const n = await poll(async () => { const x = await note(page); return x && x.shown ? x : null; }, 8000);
  check(`a newer one on the site: a line on the title screen under its menu ("${n ? n.text : "none"}")`, !!n && n.menu && /An update is ready, from Nov 20\./.test(n.text) && /Get it · 61 MB/.test(n.text) && /Not now/.test(n.text));
  check("...the site asked once, for its word on the app, and nothing else off the phone", asked.length === 1 && !outside.length, [...asked, ...outside].join(" | "));
  const box = await page.locator('[data-testid="title-update-get"]').boundingBox();
  const primary = await page.locator('[data-testid="title-primary"]').boundingBox();
  check("...below the menu's choice, on the screen, Get it big enough to tap", !!box && !!primary && box.y > primary.y + primary.height && box.y + box.height <= 915 && box.height >= 40, JSON.stringify({ box, primary }));
  await page.locator('[data-testid="title-update-get"]').tap();
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => window.__opened);
  check("Get it: the new APK in the phone's browser", opened.length === 1 && opened[0] === "https://l0jik.github.io/el-cabeza-project/el-cabeza.apk", JSON.stringify(opened));
  const after = await note(page);
  check("...the line saying it's downloading there, to open to install, no buttons", !!after && /Downloading in your browser: open it when it's done to install it\./.test(after.text) && !/Get it|Not now/.test(after.text), after && after.text);
  check("...the title screen still up, nothing chosen", (await page.evaluate(() => document.querySelector('[data-testid="title-screen"]').getAttribute("data-state"))) === "held");
  check("...no missing files, no errors", !bad.length && !errs.length, [...bad, ...errs].slice(0, 3).join(" | "));
  // Not now, then that version let be.
  await page.reload();
  await title(page);
  await poll(async () => { const x = await note(page); return x && x.shown; }, 8000);
  await page.locator('[data-testid="title-update-later"]').tap();
  await page.waitForTimeout(400);
  check("Not now: the line gone", (await note(page)) === null);
  await page.reload();
  await title(page);
  await page.waitForTimeout(1500);
  check("...and not back for that version", (await note(page)) === null);
  await ctx.close();
}
{
  // A newer one again: told again. In Spanish, in its words.
  const { ctx, page } = await open(APP, { version: 1031, latest: { ...LATEST, versionCode: 1033 } });
  await page.addInitScript(() => { try { localStorage.setItem("el-cabeza:update-skipped", "1032"); localStorage.setItem("el-cabeza:language", "es"); } catch (e) { /* */ } });
  await title(page);
  const n = await poll(async () => { const x = await note(page); return x && x.shown ? x : null; }, 8000);
  check(`a version newer than the one let be: told again, in the player's language ("${n ? n.text : "none"}")`, !!n && /Hay una actualización, del 20 nov/.test(n.text) && /Descargarla · 61 MB/.test(n.text) && /Ahora no/.test(n.text));
  await ctx.close();
}
for (const [what, opts] of [["the same version on the site", { version: 1032, latest: LATEST }], ["no connection", { version: 1031, latest: null }], ["an app from before the note (no version to say)", { version: 0, latest: LATEST }]]) {
  const { ctx, page, bad, errs, asked } = await open(APP, opts);
  await title(page);
  await page.waitForTimeout(2000);
  check(`${what}: no line, no errors${opts.version ? "" : ", the site not asked"}`, (await note(page)) === null && !bad.length && !errs.length && (opts.version ? true : asked.length === 0), [...bad, ...errs, ...asked].slice(0, 3).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, asked } = await open(PHONE);
  await page.goto(base + "el-cabeza-nova.html");
  check("in a phone's browser the same page still has its full-screen button", !!(await poll(async () => (await page.locator("[data-fullscreen-toggle]").count()) > 0)));
  const cm = await cornerFonts(page, "el-cabeza-ciudad.html");
  check("...and a game's corner menu's fonts from Google, as on the website", !!cm && cm.startsWith("https://fonts.googleapis.com/css2?family="), cm || "none");
  await title(page);
  await page.waitForTimeout(1500);
  check("...and its title screen asks the site nothing about the app, says nothing of one", asked.length === 0 && (await note(page)) === null, asked.join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
