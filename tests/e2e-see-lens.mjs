/* The see-through lens: the City's and Noir's buildings dissolve where
   they stand between the camera and the board (themes/see-lens.js
   aimLens; ciudad-models.js SEE_CUT, ciudad-city.js seeRoof, noir-city.js
   seeThrough). User, a phone screenshot of the City, a dithered hole cut
   in the blocks behind the board: "The peering lens for when you're at a
   low angle is showing up anywhere. So there's some kind of glitch that's
   causing it to not go away when it's not supposed to be there."

   The lens looked at the view's target, and in these worlds two fingers
   take the view out into the streets, so it went with it. Now it looks at
   the board only, and shuts as the view goes out over the city.

   A phone's screen (360 x 800), a game begun, each world:
   - the screenshot's view (half way down, the view pulled back over the
     blocks behind the board): nothing cut;
   - the same, the board turned a quarter: nothing cut;
   - low down in the streets, looking along them well away from the
     board: nothing cut;
   - low over the board, looking at it: the lens open, the board seen
     through what stands in front of it;
   - low, the view just past the board's side: still open.

   What the lens cuts: the picture drawn as the game draws it, then again
   with the lens shut (its uniform, found on a building's compiled
   program, put at the camera: nothing between the camera and itself),
   the pixels that differ.

   node tests/e2e-see-lens.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";
import { SLAB_Z } from "../engine/constants.js";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });

// The pixels the lens changes, now.
const lensCut = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__(), r = t.renderer;
  let focus = null;
  t.scene.traverse((o) => {
    if (focus || !o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const u = m && r.properties.get(m).uniforms;
      if (u && u.uFocus) { focus = u.uFocus; break; }
    }
  });
  if (!focus) return null;
  const el = r.domElement, w = el.width, h = el.height;
  const grab = () => {
    r.render(t.scene, t.camera);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(el, 0, 0);
    return g.getImageData(0, 0, w, h).data;
  };
  const drawn = grab(), kept = focus.value.clone();
  focus.value.copy(t.camera.position);
  const shut = grab();
  focus.value.copy(kept);
  let n = 0, sy = 0;
  for (let i = 0; i < drawn.length; i += 4) {
    if (Math.max(Math.abs(drawn[i] - shut[i]), Math.abs(drawn[i + 1] - shut[i + 1]), Math.abs(drawn[i + 2] - shut[i + 2])) > 24) { n++; sy += Math.floor(i / 4 / w); }
  }
  return { n, share: n / (w * h), y: n ? +(sy / n / h).toFixed(2) : null };
});

const HZ = SLAB_Z / 2;
const VIEWS = [
  { name: "the screenshot's view: half way down, pulled back over the blocks behind the board", v: { theta: Math.PI, phi: 1.0, radius: 26, target: [0, 0, -12] }, open: false },
  { name: "the same, the board turned a quarter", v: { theta: Math.PI / 2, phi: 1.0, radius: 26, target: [0, 0, -12] }, open: false },
  { name: "low in the streets, looking along them away from the board", v: { theta: Math.PI, phi: 1.25, radius: 9, target: [16, 0, -14] }, open: false },
  { name: "low over the board, looking at it", v: { theta: Math.PI, phi: 1.3, radius: 22, target: [0, 0, 0] }, open: true },
  { name: "low, the view just past the board's side", v: { theta: Math.PI, phi: 1.3, radius: 22, target: [HZ + 1, 0, 0] }, open: true },
];

for (const [world, file, ready] of [
  ["The City", "el-cabeza-ciudad.html", "!!window.__CIUDAD__"],
  ["Noir", "el-cabeza-noir.html", "!!window.__NOIR_TRAFFIC__"],
]) {
  console.log(world);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/${file}`);
  await poll(() => page.evaluate(`!!window.__EC_TEST_CAM__ && ${ready}`), 60000, 250);
  await page.waitForTimeout(1200);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  check("a game begun", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000, 250)));
  await page.waitForTimeout(1500);
  for (const { name, v, open } of VIEWS) {
    await page.evaluate((v) => window.__EC_TEST_CAM__({ ...v, snap: true }), v);
    await page.waitForTimeout(900);
    const cut = await lensCut(page);
    if (!cut) { check(`${name}: the lens found`, false); continue; }
    const pct = (cut.share * 100).toFixed(2);
    if (open) check(`${name}: the lens open (${pct}% of the screen seen through, about ${cut.y} down)`, cut.share > 0.01, JSON.stringify(cut));
    else check(`${name}: nothing cut (${pct}% of the screen)`, cut.share < 0.0005, JSON.stringify(cut));
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
