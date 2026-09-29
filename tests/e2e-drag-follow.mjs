/* The user's rule for turning and tilting the view, in every case: what's
   behind the finger moves the way the finger moves. Left, it goes left;
   right, right; up, up; down, down. On the board or looking round the
   room, zoomed in or out, panned off the board, the Room view, top-down,
   low down.

   For each camera state and a spread of places on the screen: find the
   point in the scene under the pointer (__EC_TEST_GRAB__, in the board's
   own frame so it turns with the room), drag a short way, let the view
   settle, and see where that same point went on screen
   (__EC_TEST_LOCAL_SCREEN__). It must have moved the way the pointer did.
   A drag that can't move the view (the tilt already at its stop) is
   reported as such, not as a failure.

   node tests/e2e-drag-follow.mjs [page] [phone|desktop] */
import { chromium } from "playwright";

const pageName = process.argv[2] || "el-cabeza-tienda.html";
const phone = (process.argv[3] || "phone") === "phone";
const vp = phone ? { width: 390, height: 844 } : { width: 1100, height: 800 };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: vp });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`file:///home/user/el-cabeza-project/dist/${pageName}`);
await page.waitForTimeout(3500);
if (await page.locator('[data-testid="tienda-open-box"]').count()) { await page.locator('[data-testid="tienda-open-box"]').click(); await page.waitForTimeout(1500); }

const cam = (patch) => page.evaluate((p) => window.__EC_TEST_CAM__(p), patch || null);
const start = await cam();
const hasRoom = pageName !== "el-cabeza-neon.html";
const STATES = [
  ["play view", { ...start, target: undefined }],
  ["zoomed out", { phi: start.phi, radius: start.radius * 1.6 }],
  ["top-down", { phi: 0.06, radius: start.radius }],
  ["low down", { phi: 1.2, radius: start.radius }],
  ...(hasRoom ? [
    ["panned off the board", { phi: 0.9, radius: 22, target: [26, 4, -14] }],
    ["panned off, other side", { phi: 1.0, radius: 18, target: [-24, 6, 16] }],
    ["Room view", { dollhouse: true, phi: pageName.includes("standard") ? 0.78 : 0.6, radius: pageName.includes("standard") ? 118 : 82, target: [0, 0, 0] }],
  ] : []),
];
const XS = [0.22, 0.5, 0.78], YS = phone ? [0.16, 0.34, 0.52] : [0.2, 0.4, 0.62];
const DIRS = [["right", 1, 0], ["left", -1, 0], ["up", 0, -1], ["down", 0, 1]];
const STEP = 6, STEPS = 8;

let fails = 0, checks = 0, stuck = 0;
for (const [name, state] of STATES) {
  for (const fy of YS) for (const fx of XS) for (const [dname, ux, uy] of DIRS) {
    const patch = { theta: start.theta, dollhouse: false, ...state };
    if (!patch.target) patch.target = null;
    await page.evaluate((p) => {
      const { target, ...rest } = p;
      window.__EC_TEST_CAM__(rest);
      if (target) window.__EC_TEST_CAM__({ target });
    }, patch);
    if (!state.target && name === "play view") await page.evaluate(() => {}); // (the play view keeps its own target)
    await page.waitForTimeout(900);
    const x = Math.round(vp.width * fx), y = Math.round(vp.height * fy);
    const g = await page.evaluate(([x, y]) => window.__EC_TEST_GRAB__(x, y), [x, y]);
    const before = await page.evaluate((l) => window.__EC_TEST_LOCAL_SCREEN__(l), g.local);
    const c0 = await cam();
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + ux * STEP * i, y + uy * STEP * i); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(900);
    const after = await page.evaluate((l) => window.__EC_TEST_LOCAL_SCREEN__(l), g.local);
    const c1 = await cam();
    const along = (after.x - before.x) * ux + (after.y - before.y) * uy;
    const viewMoved = Math.abs(c1.theta - c0.theta) > 1e-4 || Math.abs(c1.phi - c0.phi) > 1e-4;
    const rate = ux ? g.turn : g.tilt;
    const tag = `${name.padEnd(24)} at (${fx},${fy}) ${dname.padEnd(5)}`;
    if (!viewMoved) { stuck++; console.log(`  --   ${tag} view didn't move (at its stop)`); continue; }
    checks++;
    if (along > 1.5) continue;
    // A point the view hardly moves (on the turning line) can't be carried; say so.
    const weak = Math.abs(rate) < 0.04 * vp.height;
    if (weak) { console.log(`  weak ${tag} moved ${along.toFixed(1)}px (rate ${rate.toFixed(0)} px/rad: on the turning line)`); continue; }
    fails++;
    console.log(`  FAIL ${tag} point moved ${along.toFixed(1)}px along the finger (rate ${rate.toFixed(0)} px/rad) before ${before.x.toFixed(0)},${before.y.toFixed(0)} after ${after.x.toFixed(0)},${after.y.toFixed(0)}`);
  }
}
console.log(`\n${pageName} ${phone ? "phone" : "desktop"}: ${checks} drags checked, ${fails} failed, ${stuck} at a stop; page errors ${errs.length}${errs.length ? ": " + errs.join(" | ") : ""}`);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
