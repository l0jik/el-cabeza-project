/* Standard and Tienda share the wood knocks (themes/wood-sfx.js), and a
   landing's pitch follows the face it comes down on: Flaco (1x2) rolled
   onto its end lands higher than when it's rolled back onto its side.
   Also landingSize's scale (1 for a cube, 8 for a 2x2x2 flat), and each
   cue rendered offline on both boards: audible, under full scale, and a
   landing on a bigger face coming out lower (fewer zero crossings). */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";
import { landingSize } from "../themes/wood-sfx.js";
import { contactArea } from "../engine/shapes.js";
import { buildSync } from "esbuild";

let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

console.log("the scale");
check("a single cube is 1", landingSize(1, 1) === 1);
check("a 2x2x2 flat is 8", Math.abs(landingSize(8, 4) - 8) < 1e-9);
check("a 1x3 on its side is lower than on end", landingSize(3, 3) > landingSize(3, 1) * 2.5, `${landingSize(3, 3)} / ${landingSize(3, 1)}`);
check("a big piece on end is a little lower than a cube", landingSize(3, 1) > 1 && landingSize(3, 1) < 2);
check("contactArea: a box's footprint", contactArea({ w: 1, h: 3, z: 1 }) === 3 && contactArea({ w: 1, h: 1, z: 3 }) === 1);
check("contactArea: an odd shape's bottom cubes", contactArea({ vox: "0,0,0;1,0,0;0,0,1", w: 2, h: 1, z: 2 }) === 2);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
async function run(theme) {
  console.log(theme);
  const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_LANDINGS__ = []; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(theme === "tienda" ? 4000 : 1500);
  if (theme === "tienda") {
    await page.locator("button", { hasText: /open the box/i }).first().click();
    await page.waitForTimeout(5000);
  }
  await openDockPanel(page);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /begin/i }).first().click();
  await page.waitForTimeout(theme === "tienda" ? 4000 : 2000);
  const flaco = () => page.evaluate(() => { const p = window.__EC_TEST_PIECES__.find((q) => q.id === "dark-flaco"); return { w: p.w, h: p.h, z: p.z, row: p.row }; });
  const f0 = await flaco();
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
  await page.waitForTimeout(1500);
  const f1 = await flaco();
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
  await page.waitForTimeout(1500);
  const f2 = await flaco();
  const L = await page.evaluate(() => window.__EC_TEST_LANDINGS__);
  console.log("  flaco:", JSON.stringify([f0, f1, f2]), "landings:", JSON.stringify(L));
  check("Flaco stood on end, then lay back down", f1.z === 2 && f2.z === 1, JSON.stringify([f1, f2]));
  check("two landings, each with its face", L.length === 2 && L[0].contact === 1 && L[1].contact === 2, JSON.stringify(L));
  check("on end it lands higher (smaller) than on its side", L.length === 2 && L[0].size < L[1].size);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}
// ---- each cue, rendered offline ----
{
  console.log("rendered offline");
  const page = await browser.newPage();
  const src = buildSync({ entryPoints: ["themes/wood-sfx.js"], bundle: true, format: "iife", globalName: "WoodSfx", write: false }).outputFiles[0].text;
  await page.addScriptTag({ content: src });
  const res = await page.evaluate(async () => {
    const render = async (board, fn) => {
      const ctx = new OfflineAudioContext(1, 44100 * 0.6, 44100);
      const w = WoodSfx.createWoodSfx(ctx, ctx.destination, { board });
      fn(w);
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, zc = 0;
      for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); if (i && (d[i - 1] < 0) !== (d[i] < 0) && Math.abs(d[i]) > 1e-4) zc++; }
      return { peak: +peak.toFixed(3), zc };
    };
    const out = {};
    for (const board of ["solid", "folding"]) {
      out[board] = {
        select: await render(board, (w) => w.select()), deselect: await render(board, (w) => w.deselect()),
        blocked: await render(board, (w) => w.blocked()), roll: await render(board, (w) => w.rollStart(2, 350)),
        capture: await render(board, (w) => w.capture()),
        onEnd: await render(board, (w) => w.landing(3, 1)), onSide: await render(board, (w) => w.landing(3, 3)),
      };
    }
    return out;
  });
  for (const board of ["solid", "folding"]) {
    const r = res[board];
    console.log(`  ${board}:`, JSON.stringify(r));
    check(`${board}: every cue is audible and under full scale`, Object.values(r).every((x) => x.peak > 0.005 && x.peak < 1), JSON.stringify(r));
    check(`${board}: a 1x3 on its side sounds lower than on end`, r.onSide.zc < r.onEnd.zc * 0.8, `${r.onSide.zc} vs ${r.onEnd.zc}`);
  }
  await page.close();
}

await run("standard");
await run("tienda");
await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
