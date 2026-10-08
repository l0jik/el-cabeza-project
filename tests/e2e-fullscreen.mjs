/* Full screen, by the two-finger double-tap on any screen, and Tienda's
   visit opening full screen at the first tap.

   The board's own gesture code sees only touches on the canvas, so the
   chassis also listens on the document for two-finger taps that land
   anywhere else: Tienda's box lid, the dock, the menus. Tienda
   (theme.fullscreenOnFirstTap) goes full screen at the first tap, the
   one that opens the box, once a visit, and not when the player has
   already entered or left full screen some other way.

   The touches are real ones (CDP Input.dispatchTouchEvent): a page only
   goes full screen from a real tap, and headless Chromium does enter it
   (document.fullscreenElement), though the window keeps its size. */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

async function open(name, { touch = true } = {}) {
  const ctx = await browser.newContext(touch
    ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|ERR_TUNNEL|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${BASE}/el-cabeza-${name}.html`);
  await page.waitForTimeout(2500);
  const client = await ctx.newCDPSession(page);
  /* The touches carry their own timestamps, as a quick real double-tap
     would (down 60 ms, up, 120 ms, down 60 ms): the software renderer
     these tests run on takes about half a second to handle each touch,
     and the gestures are timed by when the fingers touched. */
  const twoFingerTap = async (x, y, at) => {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", timestamp: at, touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", timestamp: at + 0.06, touchPoints: [] });
  };
  const doubleTap = async (x, y) => {
    const at = Date.now() / 1000;
    await twoFingerTap(x, y, at);
    await twoFingerTap(x, y, at + 0.18);
    await page.waitForTimeout(700);
  };
  const full = () => page.evaluate(() => !!document.fullscreenElement);
  // What's under a point: the board's canvas, or something over it.
  const under = (x, y) => page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el ? (el.tagName === "CANVAS" ? "canvas" : el.tagName.toLowerCase() + (el.dataset.testid ? `[${el.dataset.testid}]` : "")) : null; }, [x, y]);
  const centre = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  return { ctx, page, errs, doubleTap, full, under, centre };
}

/* ---- Tienda on a phone: the gesture on the box lid ---- */
console.log("\nTienda, phone: the two-finger double-tap on the box lid");
{
  const { ctx, page, errs, doubleTap, full, under, centre } = await open("tienda");
  const lid = page.locator('[data-testid="tienda-lid"]');
  check("the box lid is up", (await lid.count()) === 1);
  const photo = await centre(".td-photo");
  check("the lid covers the board where the fingers go", photo && (await under(photo.x, photo.y)) !== "canvas", JSON.stringify(photo && await under(photo.x, photo.y)));
  check("not full screen before anything is touched", !(await full()));
  await doubleTap(photo.x, photo.y);
  check("a two-finger double-tap on the lid goes full screen", await full());
  check("...and leaves the lid up (it isn't a tap on the box)", (await lid.count()) === 1);
  await doubleTap(photo.x, photo.y);
  check("another one comes back out of full screen", !(await full()));
  const openBtn = await centre('[data-testid="tienda-open-box"]');
  await page.touchscreen.tap(openBtn.x, openBtn.y);
  await page.waitForTimeout(1500);
  check("Open the box opens it", (await lid.count()) === 0);
  check("...and doesn't go full screen again: the player chose", !(await full()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- Tienda on a phone: the first tap maximizes ---- */
console.log("\nTienda, phone: full screen at the first tap");
{
  const { ctx, page, errs, doubleTap, full, under, centre } = await open("tienda");
  const lid = page.locator('[data-testid="tienda-lid"]');
  const openBtn = await centre('[data-testid="tienda-open-box"]');
  await page.touchscreen.tap(openBtn.x, openBtn.y);
  await page.waitForTimeout(1500);
  check("tapping Open the box goes full screen", await full());
  check("...and opens the box", (await lid.count()) === 0);
  // The board's own gesture, on the canvas: one double-tap, one toggle.
  const vp = page.viewportSize();
  const spot = { x: vp.width / 2, y: vp.height * 0.45 };
  check("the middle of the screen is the board", (await under(spot.x, spot.y)) === "canvas", await under(spot.x, spot.y));
  await doubleTap(spot.x, spot.y);
  check("a two-finger double-tap on the board restores (toggled once, not twice)", !(await full()));
  // Something over the board: the setup row's See the pieces button, once
  // the dock's panel is open (closed, it lets touches through to the board).
  check("the dock's panel opens", await openDockPanel(page));
  await page.waitForTimeout(600);
  const orderBtn = await centre('[data-testid="tienda-order-form"]');
  check("See the pieces is over the board, not the canvas", orderBtn && (await under(orderBtn.x, orderBtn.y)) !== "canvas", orderBtn && await under(orderBtn.x, orderBtn.y));
  await doubleTap(orderBtn.x, orderBtn.y);
  check("a two-finger double-tap over a button maximizes again", await full());
  check("...without pressing it (no order form)", (await page.locator(".td-layer").count()) === 0);
  await doubleTap(orderBtn.x, orderBtn.y);
  check("...and restores", !(await full()));
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForTimeout(900);
  check("a later tap doesn't maximize again (once a visit)", !(await full()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- A phone put to sleep and woken (user): the browser leaves full
   screen by itself, and the first touch back puts it back, a tap or a
   drag alike (a drag never makes a click). ---- */
console.log("\nTienda, phone: out of full screen by itself, back at the first touch");
{
  const { ctx, page, errs, full, centre } = await open("tienda");
  const client = await ctx.newCDPSession(page);
  const openBtn = await centre('[data-testid="tienda-open-box"]');
  await page.touchscreen.tap(openBtn.x, openBtn.y);
  await page.waitForTimeout(1500);
  check("full screen at the first tap", await full());
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForTimeout(700);
  check("out of it by itself (as a phone asleep and woken)", !(await full()));
  // One finger dragged across the board: no click.
  const vp = page.viewportSize(), y = vp.height * 0.45, at = Date.now() / 1000;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", timestamp: at, touchPoints: [{ x: vp.width * 0.3, y, id: 1 }] });
  for (let i = 1; i <= 6; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", timestamp: at + i * 0.03, touchPoints: [{ x: vp.width * (0.3 + i * 0.06), y, id: 1 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", timestamp: at + 0.25, touchPoints: [] });
  await page.waitForTimeout(900);
  check("the first touch back, a drag across the board: full screen again", await full());
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- Tienda on a laptop: the first click ---- */
console.log("\nTienda, laptop: full screen at the first click");
{
  const { ctx, page, errs, full } = await open("tienda", { touch: false });
  await page.locator('[data-testid="tienda-open-box"]').click();
  await page.waitForTimeout(1500);
  check("clicking Open the box goes full screen", await full());
  check("...and opens the box", (await page.locator('[data-testid="tienda-lid"]').count()) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- Standard: full screen at the first tap (every screen now, user),
   the gesture off the board to come out ---- */
console.log("\nStandard, phone: full screen at the first tap, the gesture off the board");
{
  const { ctx, page, errs, doubleTap, full, under, centre } = await open("standard");
  const vp = page.viewportSize();
  await page.touchscreen.tap(vp.width / 2, vp.height * 0.45);
  await page.waitForTimeout(600);
  check("a first tap goes full screen (every screen, user)", await full());
  check("the dock's panel opens", await openDockPanel(page));
  await page.waitForTimeout(600);
  const begin = await centre('[data-testid="dock-panel"] button:text-matches("Begin Game|Try a Game")');
  check("Begin Game is over the board, not the canvas", begin && (await under(begin.x, begin.y)) !== "canvas", begin && await under(begin.x, begin.y));
  await doubleTap(begin.x, begin.y);
  check("a two-finger double-tap over Begin Game comes out of full screen", !(await full()));
  check("...without beginning the game", (await page.locator('button:text-matches("Begin Game|Try a Game")').count()) >= 1 && await page.evaluate(() => !(window.__EC_TEST_TURNS__ || []).length));
  await page.touchscreen.tap(vp.width / 2, vp.height * 0.45);
  await page.waitForTimeout(900);
  check("...and, having come out themselves, a later tap leaves it so", !(await full()));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures === 0 ? "\nFULL SCREEN E2E PASSED" : `\nFULL SCREEN E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
