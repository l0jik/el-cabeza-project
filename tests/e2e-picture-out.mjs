/* When the picture goes out (user, a photo from a Moto G Stylus 5G (2022):
   a white screen with a sad face in a box at its top left, "I sent the
   link to a Moto G Stylus 5G 2022, and it opened it, the link, but this is
   what came out. There's something not right here."). That screen is the
   browser's: both 3D views (the board's WebGL context and the corner
   piece's) lost and not given back. chassis/gl-watch.js, PictureOut.jsx.
   The fresh link on a phone, the box opened:
   1. Both contexts lost: at once the world's dark over the whole screen
      (the browser's white canvas and its sad face covered), "Bringing the
      picture back…", no button; given back within a moment: the cover
      goes and the store is drawn again.
   2. Lost and not given back: still only the cover after a second, then
      the card, one button; given back late, the card goes by itself.
   3. Lost again, the button: the page loads again, the store with it.
   4. Lost right as Open the box takes the screen full size (user: "I
      should be clear, this is what showed up after I clicked open the
      box"): the card says it went as the screen switched to full size and
      shows what happened just before; this device is remembered, so after
      the button's reload, and after ?fresh too, Open the box leaves the
      screen as it is.
   5. A browser that won't make WebGL at all (--disable-webgl): the card
      that says so, in place of the empty page; on a world's own page too.
     node tests/e2e-picture-out.mjs */
import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: EXE, args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
// Each WebGL context the page makes, kept with its lose-context extension
// (asked for before the loss: a lost context gives no extensions).
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  const orig = HTMLCanvasElement.prototype.getContext;
  window.__gls = [];
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    const c = orig.call(this, type, opts);
    if (/webgl/.test(type) && c && !this.__k) { this.__k = 1; window.__gls.push({ canvas: this, gl: c, ext: c.getExtension("WEBGL_lose_context") }); }
    return c;
  };
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
// The views on the page: lose them, give them back.
const live = () => page.evaluate(() => window.__gls.filter((g) => document.contains(g.canvas) && /board-canvas|dock-piece-canvas/.test(g.canvas.dataset.testid || "")).length);
const loseAll = () => page.evaluate(() => window.__gls.filter((g) => document.contains(g.canvas) && g.ext).map((g) => { g.ext.loseContext(); return g.canvas.dataset.testid; }));
const giveBack = () => page.evaluate(() => window.__gls.filter((g) => document.contains(g.canvas) && g.ext && g.gl.isContextLost()).forEach((g) => g.ext.restoreContext()));
const card = () => page.evaluate(() => { const c = document.querySelector('[data-testid="picture-out"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { kind: c.dataset.kind, state: c.dataset.state, w: Math.round(r.width), h: Math.round(r.height), title: (c.querySelector('[data-testid="picture-out-title"]') || {}).textContent || "", wait: (c.querySelector('[data-testid="picture-out-wait"]') || {}).textContent || "", button: !!c.querySelector('[data-testid="picture-out-reload"]'), top: document.elementFromPoint(20, 20) === c || c.contains(document.elementFromPoint(20, 20)) }; });
const stuck = async () => { const c = await card(); return c && c.state === "card" ? c : null; };
// How busy the picture is (the spread of its brightness): a drawn store is
// all detail, the browser's lost canvas a flat sheet.
const busy = async () => {
  const png = await page.screenshot({ type: "png" });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = 103; c.height = 228;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 30, c.width, 150).data; let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; n++; }
    const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m));
  }, png.toString("base64"));
};

console.log("[the fresh link, a phone]");
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
await page.waitForTimeout(1200);
await page.locator('[data-testid="tienda-open-box"]').tap();
await page.waitForTimeout(6000);
check(`the board and the corner piece each on a view of their own (${await live()})`, (await live()) === 2);
const drawn = await busy();

// 1. Lost and given back at once.
const lost = await loseAll();
await page.waitForTimeout(800);
const cover = await card();
check(`both views lost (${lost.join(", ")}): at once the world's dark over the whole screen, "${cover && cover.wait}" (${cover && cover.w}x${cover && cover.h})`, lost.length === 2 && !!cover && cover.state === "waiting" && /Bringing the picture back/.test(cover.wait) && cover.w === 412 && cover.h === 915 && cover.top, JSON.stringify({ lost, cover }));
check("...no button yet (the browser may give them back)", !!cover && !cover.button);
const flat = await busy();
check(`...the browser's white canvas covered, a calm dark (spread ${flat.toFixed(1)} from ${drawn.toFixed(1)})`, flat < drawn * 0.5, JSON.stringify({ flat, drawn }));
await giveBack();
await page.waitForTimeout(2600);
const back = await busy();
check(`given back: the cover goes, the store drawn again (spread ${back.toFixed(1)})`, !(await card()) && back > drawn * 0.6, JSON.stringify({ back, drawn }));

// 2. Lost and not given back.
await loseAll();
await page.waitForTimeout(1200);
const still = await card();
check("lost again: after a second, still only the cover", !!still && still.state === "waiting" && !still.button, JSON.stringify(still));
const up = await poll(stuck, 8000);
check(`not given back: the card (${up && up.kind}, "${up && up.title}")`, !!up && up.kind === "lost" && /picture went out/i.test(up.title) && up.button, JSON.stringify(up));
check(`...over the whole screen (${up && up.w}x${up && up.h})`, !!up && up.w === 412 && up.h === 915 && up.top, JSON.stringify(up));
await page.screenshot({ path: "/tmp/e2e-picture-out-card.png" });
await giveBack();
const gone = await poll(async () => !(await card()), 4000);
await page.waitForTimeout(1200);
check(`given back late: the card goes by itself, the store drawn (spread ${(await busy()).toFixed(1)})`, !!gone && (await busy()) > drawn * 0.6);

// 3. The button loads the page again.
await loseAll();
await poll(stuck, 9000);
const was = await page.evaluate(() => performance.timeOrigin);
await page.locator('[data-testid="picture-out-reload"]').tap();
const reloaded = await poll(() => page.evaluate((t) => performance.timeOrigin !== t, was), 15000);
check("the button: the page loads again", !!reloaded);
await page.waitForSelector('[data-testid="board-canvas"]', { timeout: 60000 }).catch(() => null);
await page.waitForTimeout(4000);
const after = await page.evaluate(() => { const c = document.querySelector('[data-testid="board-canvas"]'); const g = window.__gls.find((x) => x.canvas === c); return { canvas: !!c, lost: g ? g.gl.isContextLost() : null }; });
check(`...the store with it, drawing (${JSON.stringify(after)})`, after.canvas && after.lost === false && !(await card()));
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));

// 4. Lost right as the screen goes full size.
console.log("[lost as Open the box takes the screen full size]");
{
  const p2 = await ctx.newPage();
  const e3 = [];
  p2.on("pageerror", (e) => e3.push(e.message));
  const openBox = async () => {
    await p2.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
    await p2.waitForTimeout(1200);
    await p2.locator('[data-testid="tienda-open-box"]').tap();
  };
  await p2.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
  await openBox();
  const full = await poll(() => p2.evaluate(() => !!document.fullscreenElement), 3000, 100);
  check("Open the box takes the page full screen (as on the Moto)", !!full);
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => window.__gls.filter((g) => document.contains(g.canvas) && g.ext).forEach((g) => g.ext.loseContext()));
  const c4 = await poll(() => p2.evaluate(() => { const el = document.querySelector('[data-testid="picture-out"][data-state="card"]'); return el && { fs: (el.querySelector('[data-testid="picture-out-fullscreen"]') || {}).textContent || "", details: (el.querySelector('[data-testid="picture-out-details"]') || {}).textContent || "" }; }), 9000);
  check(`not given back: the card says it went as the screen switched to full size`, !!c4 && /switched to full size/.test(c4.fs), JSON.stringify(c4));
  check(`...and what happened just before: "${c4 && c4.details}"`, !!c4 && /s after full screen/.test(c4.details) && /s after a tap/.test(c4.details), JSON.stringify(c4));
  const kept = await p2.evaluate(() => window.localStorage.getItem("elcabeza-device:no-auto-fullscreen"));
  check(`this device remembered (${kept})`, kept === "1");
  // The button: the page again, and Open the box leaves the screen as it is.
  await p2.locator('[data-testid="picture-out-reload"]').tap();
  await p2.waitForTimeout(2500);
  const lid = await p2.locator('[data-testid="tienda-open-box"]').count();
  if (lid) await openBox(); else await p2.mouse.click(206, 400);
  await p2.waitForTimeout(1500);
  check(`after the reload, Open the box doesn't switch to full screen (${lid ? "the box again" : "a tap on the store"})`, !(await p2.evaluate(() => !!document.fullscreenElement)));
  // ?fresh forgets the player, not the device.
  await p2.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
  await openBox();
  await p2.waitForTimeout(1500);
  const afterFresh = await p2.evaluate(() => ({ fs: !!document.fullscreenElement, kept: window.localStorage.getItem("elcabeza-device:no-auto-fullscreen") }));
  check(`?fresh again: still remembered, still no switch to full screen (${JSON.stringify(afterFresh)})`, !afterFresh.fs && afterFresh.kept === "1");
  // The full-screen button still does it.
  const btn = p2.locator('[data-fullscreen-toggle]').first();
  if (await btn.count()) {
    await btn.tap().catch(() => {});
    const byHand = await poll(() => p2.evaluate(() => !!document.fullscreenElement), 3000, 100);
    check("...the full-screen button still switches it", !!byHand);
  }
  check(`no page errors (${e3.length})`, e3.length === 0, e3.slice(0, 3).join(" | "));
}
await browser.close();

// 5. No WebGL at all.
console.log("[a browser that won't draw 3D]");
const nogl = await chromium.launch({ executablePath: EXE, args: ["--allow-file-access-from-files", "--disable-webgl"] });
for (const [name, url] of [["Nova's page", "el-cabeza-nova.html?fresh"], ["Futuris", "el-cabeza-futuris.html"]]) {
  const p = await (await nogl.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();
  const e2 = [];
  p.on("pageerror", (e) => e2.push(e.message));
  await p.goto(`file:///home/user/el-cabeza-project/dist/${url}`);
  const c = await poll(() => p.evaluate(() => { const el = document.querySelector('[data-testid="picture-out"]'); return el && { kind: el.dataset.kind, title: el.querySelector('[data-testid="picture-out-title"]').textContent, button: el.querySelector('[data-testid="picture-out-reload"]').textContent }; }), 30000);
  check(`${name}: "${c && c.title}" with "${c && c.button}" (not an empty page)`, !!c && c.kind === "none" && /won't start/.test(c.title) && /Try again/.test(c.button), JSON.stringify(c));
  check(`...no page errors (${e2.length})`, e2.length === 0, e2.slice(0, 3).join(" | "));
}
await nogl.close();

console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
