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
   5. On a computer: the wheel out goes 1.8 times as far as in, a
      touchpad's pinch follows the fingers (see there).
   6. The store on a phone: two fingers drawn down lift the view up the
      walls to their signs; a pinch there still closes in on the spot
      between the fingers; the view tilts lower (1.38).
   7. Luna, a free camera too: two fingers still slide along the ground.
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

/* 5. A computer's wheel and touchpad as a phone's pinch (user, of a laptop:
   "Zooming in on the store on the laptop zooms in too far, but it doesn't
   zoom out far enough. Why would the zoom be different than mobile?"):
   out goes 1.8 times as far as in, as the pinch does; a touchpad's pinch
   (the wheel with Ctrl held, about 100 a step for each factor of e)
   follows the fingers: spread to twice apart, half the distance. */
console.log("\nA computer's wheel and touchpad pinch, as a phone's pinch");
{
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await dctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const dp = await dctx.newPage();
  const derrs = [];
  dp.on("pageerror", (e) => derrs.push(e.message));
  await dp.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await dp.waitForTimeout(3000);
  await openDockPanel(dp);
  await dp.locator("button", { hasText: /Begin Game/ }).first().click();
  await poll(() => dp.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await dp.mouse.move(1270, 400);
  await dp.waitForTimeout(1500);
  // From 20, one wheel event; where the zoom's goal is then.
  const wheel = (deltaY, ctrlKey = false) => dp.evaluate(({ deltaY, ctrlKey }) => {
    window.__EC_TEST_CAM__({ radius: 20, snap: true });
    window.__EC_TEST_THREE__().renderer.domElement.dispatchEvent(new WheelEvent("wheel", { deltaY, ctrlKey, deltaMode: 0, bubbles: true, cancelable: true }));
    return window.__EC_TEST_CAM__().radius;
  }, { deltaY, ctrlKey });
  const out = await wheel(100), inn = await wheel(-100);
  const k = Math.log(out / 20) / Math.log(20 / inn);
  check(`the wheel: a notch out goes 1.8 times as far as a notch in (20 to ${out.toFixed(2)} out, ${inn.toFixed(2)} in: ${k.toFixed(2)} times)`, Math.abs(k - 1.8) < 0.05, JSON.stringify({ out, inn }));
  const pinchIn = await wheel(-100 * Math.log(2), true), pinchOut = await wheel(100 * Math.log(1.25), true);
  check(`a touchpad's pinch, fingers spread to twice apart: half the distance (20 to ${pinchIn.toFixed(2)})`, Math.abs(pinchIn - 10) < 0.5, String(pinchIn));
  // (A small one: this board's farthest is 55.)
  check(`...and together by a quarter: out by 1.25 to the 1.8, as a phone's pinch (20 to ${pinchOut.toFixed(2)})`, Math.abs(pinchOut - 20 * Math.pow(1.25, 1.8)) < 1, String(pinchOut));
  check(`no page errors (${derrs.length})`, derrs.length === 0, derrs.slice(0, 3).join(" | "));
  await dctx.close();
}

/* 6. The store, a room to look round (user: "In Tienda / store, the
   maximum vertical zoom / ceiling seems to be lower than before.... There
   is wall signage that can no longer be seen"; of the fixes offered, "Let's
   go with 1 and 2"): two fingers drawn down lift the view up the walls
   (the aim's height, to the store's 30), as before the pinch kept the
   board under the fingers, which only slid it along the floor; a pinch
   there still closes in on the spot between the fingers; and one finger
   tilts the view as low as 1.38 (about 79 degrees from straight down; the
   board's worlds stop at 1.25). */
{
  console.log("\n[the store on a phone: two fingers lift the view up the walls; the view tilts lower]");
  const sctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000; window.__EC_TEST_PA_MS__ = 600000; });
  const sp = await sctx.newPage();
  const serrs = [];
  sp.on("pageerror", (e) => serrs.push(e.message));
  await sp.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-tienda.html");
  await sp.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await sp.waitForTimeout(1500);
  await sp.locator('[data-testid="tienda-open-box"]').click();
  await sp.waitForTimeout(3500);
  await openDockPanel(sp);
  await sp.waitForTimeout(600);
  await sp.locator('button:text-matches("Begin Game|Try a Demo Game")').first().click({ force: true });
  await poll(() => sp.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await sp.waitForTimeout(2500);
  const scdp = await sctx.newCDPSession(sp);
  const aim = () => sp.evaluate(() => { const c = window.__EC_TEST_CAM__(); return { y: c.target[1], r: c.radius, phi: c.phi }; });
  // Two fingers, side by side, drawn down the screen.
  const drawDown = async () => {
    await scdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(170, 300, 240, 300) });
    await sp.waitForTimeout(30);
    for (let i = 1; i <= 20; i++) { await scdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(170, 300 + i * 15, 240, 300 + i * 15) }); await sp.waitForTimeout(16); }
    await scdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sp.waitForTimeout(400);
  };
  await sp.evaluate(() => window.__EC_TEST_CAM__({ theta: 0, phi: 1.25, radius: 60, target: [0, 0, 0], snap: true }));
  await sp.waitForTimeout(600);
  await drawDown();
  const once = await aim();
  check(`two fingers drawn down: the view lifted up the walls (the aim from 0 to ${once.y.toFixed(1)} high), its distance kept`, once.y > 8 && Math.abs(once.r - 60) < 0.01, JSON.stringify(once));
  for (let i = 0; i < 4; i++) await drawDown();
  const top = await aim();
  check(`...and on up to the store's ceiling for it, no further (${top.y.toFixed(1)}, at most 30)`, top.y > 25 && top.y <= 30.001, JSON.stringify(top));
  // A pinch apart over a spot off the middle, the view lifted: the spot
  // (on the aim's level) stays under the fingers.
  await sp.evaluate(() => window.__EC_TEST_CAM__({ theta: 0, phi: 1.0, radius: 50, target: [0, 20, 0], snap: true }));
  await sp.waitForTimeout(800);
  const M = { x: 260, y: 560 };
  const spotOf = (m) => sp.evaluate((m) => {
    const t = window.__EC_TEST_THREE__(), cam = t.camera, el = t.renderer.domElement, r = el.getBoundingClientRect();
    const V3 = cam.position.constructor;
    const p = new V3(((m.x - r.left) / r.width) * 2 - 1, -((m.y - r.top) / r.height) * 2 + 1, 0.5).unproject(cam);
    const dir = p.sub(cam.position).normalize();
    const ty = window.__EC_TEST_CAM__().target[1];
    return cam.position.clone().add(dir.multiplyScalar((ty - cam.position.y) / dir.y)).toArray();
  }, m);
  const spot = await spotOf(M);
  const r0 = (await aim()).r;
  await scdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(M.x - 35, M.y, M.x + 35, M.y) });
  await sp.waitForTimeout(30);
  for (let i = 1; i <= 18; i++) { const w = 35 + i * 5; await scdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(M.x - w, M.y, M.x + w, M.y) }); await sp.waitForTimeout(16); }
  await scdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sp.waitForTimeout(1500);
  const seen = await sp.evaluate((w) => {
    const t = window.__EC_TEST_THREE__(), cam = t.camera, el = t.renderer.domElement, r = el.getBoundingClientRect();
    const v = new cam.position.constructor(w[0], w[1], w[2]).project(cam);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, radius: window.__EC_TEST_CAM__().radius };
  }, spot);
  const off = Math.hypot(seen.x - M.x, seen.y - M.y);
  check(`a pinch apart there: zoomed in (radius ${r0.toFixed(1)} to ${seen.radius.toFixed(1)}), the spot still under the fingers (${off.toFixed(0)} px off)`, seen.radius < r0 - 3 && off < 30, JSON.stringify({ M, seen }));
  // One finger, a long way each way: the lowest the view tilts.
  const tiltMost = async () => {
    let most = 0;
    for (const [y0, y1] of [[200, 800], [800, 200]]) {
      await sp.evaluate(() => window.__EC_TEST_CAM__({ phi: 1.0, radius: 50, target: [0, 10, 0], snap: true }));
      await sp.waitForTimeout(300);
      await scdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 206, y: y0, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
      for (let i = 1; i <= 30; i++) { await scdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 206, y: y0 + ((y1 - y0) * i) / 30, id: 1, radiusX: 4, radiusY: 4, force: 1 }] }); await sp.waitForTimeout(16); }
      await scdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sp.waitForTimeout(300);
      most = Math.max(most, (await aim()).phi);
    }
    return most;
  };
  const low = await tiltMost();
  check(`one finger, a long way: the view tilts as low as ${low.toFixed(3)} (the store's 1.38; the board's worlds stop at 1.25)`, Math.abs(low - 1.38) < 0.002, String(low));
  check(`no page errors (${serrs.length})`, serrs.length === 0, serrs.slice(0, 3).join(" | "));
  await sctx.close();
}

/* 7. ...and only there (the store and the den, freeCamera.lift): Luna, a
   free camera too, keeps the pull along the ground, the aim's height
   unchanged by two fingers drawn down. */
{
  console.log("\n[Luna on a phone: two fingers still slide along the ground]");
  const lctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await lctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const lp = await lctx.newPage();
  const lerrs = [];
  lp.on("pageerror", (e) => lerrs.push(e.message));
  await lp.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-luna.html");
  await lp.waitForTimeout(3000);
  await openDockPanel(lp);
  await lp.locator("button", { hasText: /Begin Game/ }).first().click();
  await poll(() => lp.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await lp.waitForTimeout(2000);
  const lcdp = await lctx.newCDPSession(lp);
  await lp.evaluate(() => window.__EC_TEST_CAM__({ theta: 0, phi: 1.0, radius: 30, target: [0, 0, 0], snap: true }));
  await lp.waitForTimeout(600);
  await lcdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(170, 300, 240, 300) });
  await lp.waitForTimeout(30);
  for (let i = 1; i <= 20; i++) { await lcdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(170, 300 + i * 10, 240, 300 + i * 10) }); await lp.waitForTimeout(16); }
  await lcdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await lp.waitForTimeout(600);
  const la = await lp.evaluate(() => window.__EC_TEST_CAM__().target);
  check(`two fingers drawn down: the view slid along the ground (moved ${Math.hypot(la[0], la[2]).toFixed(1)}), its height kept (${la[1].toFixed(2)})`, Math.abs(la[1]) < 0.01 && Math.hypot(la[0], la[2]) > 1, JSON.stringify(la));
  check(`no page errors (${lerrs.length})`, lerrs.length === 0, lerrs.slice(0, 3).join(" | "));
  await lctx.close();
}

/* 8. The store and the den: nothing solid zoomed into (user, a video of
   the store's tour, a pinch in: into the light pieces, through the board,
   under the table to the floor: "you can't zoom in through the board,
   through the pieces. That's ridiculous ... Maybe we need to just be like
   right up on top of a piece, but not beyond"; chose "Stop at whatever's
   in front" and "Keep the view above the tabletop", "den too"). The
   pinch of the video (fingers spreading as they drift up the screen,
   which sank the view): the camera never in a piece nor under the
   board's top, the view kept on it (a hand can't sink it below the
   board). Right over a piece: stopped 1.4 off it. A view set inside the
   table: the camera out of it. Off the table: as low as ever. */
const camCheck = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__(), c = window.__EC_TEST_CAM__(), V = t.camera.position.constructor;
  t.boardGroup.updateMatrixWorld(true);
  const p = t.boardGroup.worldToLocal(t.camera.position.clone()), inv = t.boardGroup.matrixWorld.clone().invert();
  let inPiece = null, nearest = Infinity;
  for (const o of t.pieceGroup.children) {
    if (!o.visible || o.userData.pieceId == null) continue;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    o.traverseVisible((m) => {
      if (!m.geometry) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (!mats.some((x) => x && x.visible !== false && x.colorWrite !== false && !(x.transparent && x.depthWrite === false))) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox, M = inv.clone().multiply(m.matrixWorld);
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const q = new V(x, y, z).applyMatrix4(M);
        mn[0] = Math.min(mn[0], q.x); mn[1] = Math.min(mn[1], q.y); mn[2] = Math.min(mn[2], q.z); mx[0] = Math.max(mx[0], q.x); mx[1] = Math.max(mx[1], q.y); mx[2] = Math.max(mx[2], q.z);
      }
    });
    if (mn[0] === Infinity) continue;
    const d = Math.hypot(Math.max(mn[0] - p.x, 0, p.x - mx[0]), Math.max(mn[1] - p.y, 0, p.y - mx[1]), Math.max(mn[2] - p.z, 0, p.z - mx[2]));
    if (d === 0) inPiece = o.userData.pieceId;
    nearest = Math.min(nearest, d);
  }
  // (In anything solid: the chassis's own boxes, the board, the table and the pieces.)
  const inSolid = (window.__EC_TEST_SOLIDS__ ? window.__EC_TEST_SOLIDS__() : []).some((b) => p.x > b[0] && p.x < b[1] && p.y > b[2] && p.y < b[3] && p.z > b[4] && p.z < b[5]);
  return { inPiece, inSolid, nearest: +nearest.toFixed(2), camY: +p.y.toFixed(2), targetY: +c.target[1].toFixed(2), dist: +t.camera.position.distanceTo(new V(...c.view.target)).toFixed(2) };
});
// A light piece's middle, in the world, on the board.
const pieceMid = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__(), V = t.camera.position.constructor, p = window.__EC_TEST_PIECES__.find((q) => q.owner === "light" && q.type === "opa") || window.__EC_TEST_PIECES__.find((q) => q.owner === "light");
  const s = new V(); let n = 0;
  t.pieceGroup.children.filter((o) => o.userData.pieceId === p.id).forEach((o) => { const w = new V(); o.getWorldPosition(w); s.add(w); n++; });
  return [s.x / n, 0, s.z / n];
});
async function solidsHold(page, name) {
  const mid = await pieceMid(page);
  await page.evaluate((m) => window.__EC_TEST_CAM__({ target: m, radius: 2, phi: 0.15, dollhouse: false, snap: true }), mid);
  await page.waitForTimeout(1500);
  const over = await camCheck(page);
  check(`${name}: right over a piece, asked 2 off: stopped clear of it (${over.dist} off the view's aim, ${over.nearest} from the piece)`, !over.inPiece && !over.inSolid && over.nearest >= 1.3 && over.dist > 2.5, JSON.stringify(over));
  await page.evaluate((m) => window.__EC_TEST_CAM__({ target: [m[0], -14, m[2]], radius: 4.5, phi: 1.0, dollhouse: false, snap: true }), mid);
  await page.waitForTimeout(1500);
  const sunk = await camCheck(page);
  // (Set there, not brought by a hand, which can't, as the pinch above:
  // the camera still out of the table, the board and the pieces, stopped
  // where its line leaves them: over the den's broad table, out of the
  // store's display table's side.)
  check(`${name}: a view set 14 under the board, inside the table: the camera out of it, in nothing solid (${sunk.dist} off, at ${sunk.camY})`, !sunk.inSolid && !sunk.inPiece && sunk.dist > 4.6, JSON.stringify(sunk));
  await page.evaluate(() => window.__EC_TEST_CAM__({ target: [42, -7, 0], radius: 8, phi: 1.0, dollhouse: false, snap: true }));
  await page.waitForTimeout(1500);
  const off = await camCheck(page);
  check(`${name}: off the table, as low as ever (the view at ${off.targetY})`, off.targetY === -7, JSON.stringify(off));
}
{
  console.log("\n[the store and the den: the camera stops at the pieces, the board and the table]");
  const sctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; window.__EC_TEST_NUDGE_MS__ = 600000; window.__EC_TEST_PA_MS__ = 600000; });
  const sp = await sctx.newPage();
  const serrs = [];
  sp.on("pageerror", (e) => serrs.push(e.message));
  await sp.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-tienda.html");
  await sp.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await sp.waitForTimeout(1500);
  await sp.locator('[data-testid="tienda-open-box"]').click();
  await sp.waitForTimeout(3500);
  await openDockPanel(sp);
  await sp.waitForTimeout(600);
  await sp.locator('button:text-matches("Begin Game|Try a Demo Game")').first().click({ force: true });
  await poll(() => sp.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await sp.waitForTimeout(2500);
  if (await sp.evaluate(() => !!window.__EC_TEST_END_TOUR__)) await sp.evaluate(() => window.__EC_TEST_END_TOUR__());
  await sp.waitForTimeout(800);
  const scdp = await sctx.newCDPSession(sp);
  // The video's pinch: fingers spreading over the board as they drift up.
  const mid = await pieceMid(sp);
  await sp.evaluate((m) => window.__EC_TEST_CAM__({ theta: 0.4, phi: 1.15, radius: 14, target: m, dollhouse: false, snap: true }), mid);
  await sp.waitForTimeout(800);
  const looks = [];
  await scdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(176, 600, 236, 600) });
  await sp.waitForTimeout(30);
  for (let i = 1; i <= 24; i++) {
    const w = 30 + i * 7, y = 600 - i * 14;
    await scdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(206 - w, y, 206 + w, y) });
    await sp.waitForTimeout(60);
    if (i % 3 === 0) looks.push(await camCheck(sp));
  }
  await scdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sp.waitForTimeout(1500);
  looks.push(await camCheck(sp));
  const worst = looks.reduce((a, b) => (b.camY < a.camY ? b : a));
  check(`the pinch of the video (spreading, drifting up): never in a piece nor under the board (lowest ${worst.camY}, nearest a piece ${Math.min(...looks.map((l) => l.nearest))}), the view on the board (${looks[looks.length - 1].targetY})`, looks.every((l) => !l.inPiece && !l.inSolid && l.camY > 1 && l.targetY >= -0.001), JSON.stringify(looks));
  await solidsHold(sp, "the store");
  check(`no page errors (${serrs.length})`, serrs.length === 0, serrs.slice(0, 3).join(" | "));
  await sctx.close();
  const dctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await dctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } } catch (e) { /* none */ }
  });
  const dp = await dctx.newPage();
  const derrs = [];
  dp.on("pageerror", (e) => derrs.push(e.message));
  await dp.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await poll(() => dp.evaluate(() => !!window.__DEN_TV__), 30000);
  await dp.waitForTimeout(2500);
  await solidsHold(dp, "the den");
  check(`no page errors (${derrs.length})`, derrs.length === 0, derrs.slice(0, 3).join(" | "));
  await dctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
