/* A finger on the board once a game's begun, in every world: Neon's way
   (user: "make all in-game touch movement tilt rotate exactly like it is
   in Neon. That is the correct way they should all be when playing the
   game"). Begun above the board's middle (its far side), a drag right
   turns it one way (theta up); begun below (its near side), the other
   (theta down); finger up tilts toward the horizon (phi up), down toward
   overhead. Every step of each drag must go the way the first did.

   Before Begin the store keeps its own ways (a drag turns it one way
   wherever it begins; up and down the other way): checked on Big Glutts'
   page.

   And a drag carries on when the handlers are bound again mid-drag, as
   each step the computer takes binds them (the first drag in Parrish,
   the computer moving, stopped dead).

   The touches are real ones (CDP Input.dispatchTouchEvent) on a phone.

   node tests/e2e-touch-in-game.mjs [world name filter...] */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
const DEN_SEED = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1" };
const WORLDS = [
  ["Neon", `${D}/el-cabeza-neon.html`, {}],
  ["Standard", `${D}/el-cabeza-standard.html`, {}],
  ["Nova den", `${D}/el-cabeza-nova.html`, DEN_SEED],
  ["Nova's store (the story's first visit)", `${D}/el-cabeza-nova.html`, {}],
  ["Big Glutts' page", `${D}/el-cabeza-tienda.html`, {}, { storeWays: true }],
  ["Lluvia", `${D}/el-cabeza-lluvia.html`, {}],
  ["Cromo", `${D}/el-cabeza-cromo.html`, {}],
  ["Lab (Bauhaus)", `${D}/el-cabeza-lab.html?theme=bauhaus`, {}],
  ["Parrish, Tá muid beo", `${D}/el-cabeza-parrish.html?look=orinoco`, {}],
  ["Parrish, Go deo na ndeor", `${D}/el-cabeza-parrish.html?look=watermark`, {}],
];
const only = process.argv.slice(2);
const W = 412, H = 915;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
// Every step's change on an axis has the sign wanted (or none, at a stop),
// and it moved at all.
const steady = (seen, k, sign) => {
  let moved = 0;
  for (let i = 1; i < seen.length; i++) { const d = seen[i][k] - seen[i - 1][k]; if (Math.abs(d) < 1e-6) continue; if (Math.sign(d) !== sign) return false; moved++; }
  return moved >= 3;
};

for (const [name, url, seed, opts = {}] of WORLDS) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o.toLowerCase()))) continue;
  console.log(`\n${name}`);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url);
  for (let i = 0; i < 120 && !(await page.evaluate(() => !!window.__EC_TEST_CAM__).catch(() => false)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(2500);
  // (The den's lure would take over the view: put off.)
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  if (await page.locator('[data-testid="tienda-open-box"]').count()) { await page.locator('[data-testid="tienda-open-box"]').click(); await page.waitForTimeout(2500); }
  if (await page.locator('[data-testid="lluvia-straight-to-board"]').count()) { await page.locator('[data-testid="lluvia-straight-to-board"]').click(); await page.waitForTimeout(1500); }

  const client = await ctx.newCDPSession(page);
  const cam = (patch) => page.evaluate((p) => window.__EC_TEST_CAM__(p), patch || null);
  // One finger from (x0, y0) by (dx, dy) in steps; the view's goal after
  // each step (and mid, a call made halfway).
  async function touchDrag(x0, y0, dx, dy, { steps = 8, mid = null } = {}) {
    const at = Date.now() / 1000;
    const seen = [];
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", timestamp: at, touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", timestamp: at + i * 0.03, touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps, id: 1 }] });
      await page.waitForTimeout(25);
      const c = await cam(); seen.push([c.theta, c.phi]);
      if (mid && i === Math.floor(steps / 2)) { await mid(); seen.mid = seen.length; }
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", timestamp: at + steps * 0.03 + 0.05, touchPoints: [] });
    await page.waitForTimeout(500);
    return seen;
  }
  // The board's centre on screen (the turning axis), from the camera as it is.
  const axisY = () => page.evaluate(() => {
    const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
    if (!t || !t.camera || !t.boardGroup) return null;
    const r = t.renderer.domElement.getBoundingClientRect();
    t.camera.updateMatrixWorld();
    const v = t.boardGroup.getWorldPosition(new t.camera.position.constructor()).project(t.camera);
    return r.top + (1 - v.y) / 2 * r.height;
  });
  const under = (x, y) => page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el ? (el.dataset && el.dataset.testid) || el.tagName.toLowerCase() : null; }, [x, y]);
  // A pose to drag from: the view as it is, at a slant, no Room view.
  const c0 = await cam();
  const pose = async () => { await cam({ theta: c0.theta, phi: 0.6, radius: c0.radius, dollhouse: false, snap: true }); await page.waitForTimeout(700); };
  const X = 30;
  // The four drags, either way: [turn begun high, turn begun low, tilt up].
  async function fourDrags() {
    await pose();
    const ay = await axisY();
    const hi = Math.round(Math.max(H * 0.14, (ay == null ? H / 2 : ay) - H * 0.2));
    const lo = Math.round(Math.min(H * 0.8, (ay == null ? H / 2 : ay) + H * 0.2));
    const where = `axis y ${ay == null ? "?" : Math.round(ay)}, under (${X},${hi}) ${await under(X, hi)}, (${X},${lo}) ${await under(X, lo)}`;
    const high = await touchDrag(X, hi, 160, 0);
    await pose();
    const low = await touchDrag(X, lo, 160, 0);
    await pose();
    const up = await touchDrag(X, Math.round(H * 0.6), 0, -130);
    await pose();
    const down = await touchDrag(X, Math.round(H * 0.4), 0, 130);
    return { where, high, low, up, down };
  }
  const fmt = (s, k) => JSON.stringify(s.map((v) => +v[k].toFixed(3)));

  if (opts.storeWays) {
    // Before Begin: the store's own ways.
    const armed = await page.evaluate(() => window.__EC_TEST_ARMED__);
    check("before Begin (no game under way)", armed === false, String(armed));
    const d = await fourDrags();
    check(`before Begin, begun high, right: theta up (${d.where})`, steady(d.high, 0, 1), fmt(d.high, 0));
    check("before Begin, begun low, right: the store's one way, theta up as from high", steady(d.low, 0, 1), fmt(d.low, 0));
    check("before Begin, finger up: the store's own way, toward overhead", steady(d.up, 1, -1), fmt(d.up, 1));
    check("before Begin, finger down: toward the horizon", steady(d.down, 1, 1), fmt(d.down, 1));
  }

  // Begin: the phone bar's button, else the dock's.
  if (await page.locator('[data-testid="shell-begin"]').count()) await page.locator('[data-testid="shell-begin"]').first().click().catch(() => {});
  else {
    await openDockPanel(page).catch(() => {});
    const b = page.locator('[data-testid="dock-panel"] button:text-matches("Begin Game|Try a Game")').first();
    if (await b.count()) await b.click().catch(() => {});
  }
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  check("a game under way", await page.evaluate(() => window.__EC_TEST_ARMED__ === true));
  const d = await fourDrags();
  check(`begun above the middle, right: theta up all the way (${d.where})`, steady(d.high, 0, 1), fmt(d.high, 0));
  check("begun below the middle, right: theta down all the way", steady(d.low, 0, -1), fmt(d.low, 0));
  check("finger up: toward the horizon (phi up)", steady(d.up, 1, 1), fmt(d.up, 1));
  check("finger down: toward overhead (phi down)", steady(d.down, 1, -1), fmt(d.down, 1));

  if (name === "Neon") {
    // The handlers bound again halfway through a drag (the pieces set
    // afresh, as a computer's step changes them): the turn carries on.
    await pose();
    const ay = await axisY();
    const hi = Math.round(Math.max(H * 0.14, (ay == null ? H / 2 : ay) - H * 0.2));
    const s = await touchDrag(X, hi, 200, 0, { steps: 10, mid: () => page.evaluate(() => window.__EC_TEST_SET_PIECES__((window.__EC_TEST_PIECES__ || []).map((p) => ({ ...p })))) });
    const after = s.slice(s.mid);
    check("the handlers bound again mid-drag: the turn carries on the same way", steady(s, 0, 1) && after.length >= 3 && after[after.length - 1][0] - s[s.mid - 1][0] > 0.05, fmt(s, 0));
  }
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\nin-game touch: ${checks} checks, ${fails} failed`);
console.log(fails === 0 ? "TOUCH IN GAME E2E PASSED" : `TOUCH IN GAME E2E FAILED (${fails})`);
process.exit(fails === 0 ? 0 : 1);
