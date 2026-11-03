/* Zoomed in, the view goes anywhere over the board, and a pinch zooms
   toward the fingers (user, a video of Futuris on a phone: "when I am
   zoomed in, I want to move the board over ... with my two fingers trying
   to pull and it won't go. What solutions do we have here?"; picked:
   "When zoomed in, two fingers can take the view anywhere over the board,
   right up to its edges. The screen always stays over the board, so it
   still can't be pushed off. Zoomed out, the limit stays as it is today."
   and "Pinch toward your fingers. The zoom closes in on the spot between
   your fingers, the way maps do, instead of the middle of the screen.").
   Futuris on a phone, the board turned a little and tilted:
   1. The closest zoom: the aim pushed far out along the board lands near
      its edge, less what the screen shows (no longer a square and a half from
      the middle), the screen still over the board; pushed to a corner, it
      goes farther, still over the board.
   2. Zoomed out (radius 40): the aim lands where it always did, the
      visible half-span from the middle.
   3. Two fingers pulled across the screen, zoomed right in: the board
      follows them out to its edge.
   4. A pinch apart over a spot off the middle: the zoom closes in, the
      spot kept under the fingers.
     node tests/e2e-zoom-pan.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const SQ = 1.056, MARGIN = 0.42, ZOOM_MIN = 9;

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
await page.waitForTimeout(3000);
await openDockPanel(page);
await page.locator("button", { hasText: /Begin Game/ }).first().click();
await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
await page.waitForTimeout(2000);

const THETA = 0.3, PHI = 0.55;
// The aim (the goal's target) in the board's own frame, the visible
// half-span the chassis measures, and the slab's half sizes.
const state = () => page.evaluate(([SQ, MARGIN]) => {
  const c = window.__EC_TEST_CAM__(), t = window.__EC_TEST_THREE__(), cam = t.camera;
  const b = window.__EC_TEST_BOARD__ || { rows: 10, cols: 10 };
  const half = (cam.fov / 2) * (Math.PI / 180);
  const V = c.radius * Math.tan(Math.min(half, Math.atan(Math.tan(half) * cam.aspect)));
  const [x, , z] = c.target, ct = Math.cos(c.theta), st = Math.sin(c.theta);
  return {
    r: c.radius, V, d: Math.hypot(x, z),
    lx: x * ct + z * st, lz: -x * st + z * ct,
    hx: (b.cols * SQ) / 2 + MARGIN, hz: (b.rows * SQ) / 2 + MARGIN,
  };
}, [SQ, MARGIN]);
const setCam = (patch) => page.evaluate((p) => window.__EC_TEST_CAM__({ ...p, snap: true }), patch);
const overBoard = (s, slack = 0.05) => Math.abs(s.lx) <= s.hx - s.V + slack && Math.abs(s.lz) <= s.hz - s.V + slack;

console.log("[Futuris, a phone]");
// 1. The closest zoom, the aim pushed east, then to a corner.
await setCam({ theta: THETA, phi: PHI, radius: ZOOM_MIN, target: [0, 0, 0] });
await page.waitForTimeout(500);
// (A point given in the board's own frame, turned to the world's: the
// board turns by -theta.)
const world = (lx, lz) => [lx * Math.cos(THETA) - lz * Math.sin(THETA), 0, lx * Math.sin(THETA) + lz * Math.cos(THETA)];
await setCam({ target: world(30, 0) });
await page.waitForTimeout(600);
let s = await state();
check(`the closest zoom, the aim pushed out along the board: ${(s.d / SQ).toFixed(2)} squares from the middle (was 1.52)`, s.d / SQ > 3, JSON.stringify(s));
check("...the screen still over the board (the aim kept a visible half-span in from the slab's edge)", overBoard(s), JSON.stringify(s));
const east = s.d;
await setCam({ target: world(30, 30) });
await page.waitForTimeout(600);
s = await state();
check(`...pushed to a corner: farther still (${(s.d / SQ).toFixed(2)} squares), over the board`, s.d > east + 0.3 && overBoard(s), JSON.stringify(s));

// 2. Zoomed out: as it always was.
await setCam({ radius: 40, target: [0, 0, 0] });
await page.waitForTimeout(500);
await setCam({ target: [30, 0, 0] });
await page.waitForTimeout(600);
s = await state();
check(`zoomed out (radius 40): the aim lands at the visible half-span, as before (${s.d.toFixed(2)} vs ${s.V.toFixed(2)})`, Math.abs(s.d - s.V) < 0.02 * s.V, JSON.stringify(s));

// 3. Two fingers pulled across, zoomed right in.
await setCam({ theta: THETA, phi: PHI, radius: ZOOM_MIN, target: [0, 0, 0] });
await page.waitForTimeout(600);
const cdp = await ctx.newCDPSession(page);
const two = (ax, ay, bx, by) => [{ x: ax, y: ay, id: 1, radiusX: 4, radiusY: 4, force: 1 }, { x: bx, y: by, id: 2, radiusX: 4, radiusY: 4, force: 1 }];
async function pull(dx, dy, strokes = 4) {
  for (let k = 0; k < strokes; k++) {
    const x0 = dx > 0 ? 70 : 320, y0 = 380;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(x0, y0, x0, y0 + 80) });
    await page.waitForTimeout(30);
    for (let i = 1; i <= 16; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(x0 + (dx / 16) * i, y0 + (dy / 16) * i, x0 + (dx / 16) * i, y0 + 80 + (dy / 16) * i) }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
}
const before = await state();
await pull(-240, 0);
s = await state();
check(`zoomed right in, two fingers pulled across four times: the view goes ${(s.d / SQ).toFixed(2)} squares out (no further than 1.52 before)`, s.d / SQ > 3 && Math.abs(s.r - before.r) < 0.01, JSON.stringify({ before, s }));
check("...out to the board's edge and no further: the screen still over the board", overBoard(s, 0.15), JSON.stringify(s));

// 4. A pinch apart over a spot off the middle: the spot stays under the fingers.
await setCam({ theta: THETA, phi: PHI, radius: 24, target: [0, 0, 0] });
await page.waitForTimeout(800);
const M = { x: 250, y: 500 };
// The board's point under the fingers' middle (the board's own frame).
const spot = await page.evaluate((m) => {
  const t = window.__EC_TEST_THREE__(), cam = t.camera, el = t.renderer.domElement, r = el.getBoundingClientRect();
  const V3 = cam.position.constructor;
  const p = new V3(((m.x - r.left) / r.width) * 2 - 1, -((m.y - r.top) / r.height) * 2 + 1, 0.5).unproject(cam);
  const dir = p.sub(cam.position).normalize();
  const ty = window.__EC_TEST_CAM__().target[1];
  const hit = cam.position.clone().add(dir.multiplyScalar((ty - cam.position.y) / dir.y));
  return t.boardGroup.worldToLocal(hit).toArray();
}, M);
const r0 = (await state()).r;
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(M.x - 35, M.y, M.x + 35, M.y) });
await page.waitForTimeout(30);
for (let i = 1; i <= 18; i++) { const w = 35 + i * 5; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(M.x - w, M.y, M.x + w, M.y) }); await page.waitForTimeout(16); }
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(1500);
const after = await page.evaluate((local) => {
  const t = window.__EC_TEST_THREE__(), cam = t.camera, el = t.renderer.domElement, r = el.getBoundingClientRect();
  const v = t.boardGroup.localToWorld(new cam.position.constructor(local[0], local[1], local[2])).project(cam);
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, radius: window.__EC_TEST_CAM__().radius };
}, spot);
const off = Math.hypot(after.x - M.x, after.y - M.y);
check(`a pinch apart: zoomed in (radius ${r0.toFixed(1)} to ${after.radius.toFixed(1)})`, after.radius < r0 - 3, JSON.stringify(after));
check(`...the spot first under the fingers still under them (${off.toFixed(0)} px off)`, off < 30, JSON.stringify({ M, after }));
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
