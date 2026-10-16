/* The front page's pictures of the worlds themselves (user: "retro
   future ... from the 70s, yet there's a modern spin on it"): each
   world's page opened and photographed as tools/channel_shots.mjs does
   for the realities menu, but wide and large, for a page's hero. Written
   to assets/front/world-<id>.png; tools/front_pack.py packs them.
     node tools/front_worlds.mjs [id ...] */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/front");
const dist = (f) => "file://" + path.join(ROOT, "dist", f);
const SHOTS = [
  ["den", dist("el-cabeza-standard.html?quality=high"), 7000, { cam: { theta: 0.42, phi: 1.02, radius: 15.5, snap: true } }],
  ["den-low", dist("el-cabeza-standard.html?quality=high"), 7000, { cam: { theta: 0.9, phi: 1.3, radius: 13, snap: true } }],
  ["futuris", dist("el-cabeza-futuris.html?quality=high"), 7000],
  ["store", dist("el-cabeza-tienda.html?quality=high"), 7000, { click: '[data-testid="tienda-open-box"]', after: 9000, cam: { theta: 0.3, phi: 1.1, radius: 12, snap: true } }],
  ["cromo", dist("el-cabeza-cromo.html?quality=high"), 7000],
  ["plano", dist("el-cabeza-plano.html?quality=high"), 7000],
  ["luna", dist("el-cabeza-luna.html?quality=high"), 9000, { cam: { theta: 0.35, phi: 1.36, radius: 14.5, snap: true } }],
  ["noir", dist("el-cabeza-noir.html?quality=high"), 9000],
  ["ciudad-night", dist("el-cabeza-ciudad.html?quality=high&time=night"), 10000],
  ["ciudad-golden", dist("el-cabeza-ciudad.html?quality=high&time=golden"), 10000],
  ["lluvia", dist("el-cabeza-lluvia.html?quality=high"), 9000, { click: '[data-testid="lluvia-descend"]', after: 2500, click2: '[data-testid="lluvia-skip"]', after2: 7000 }],
  ["parrish", dist("el-cabeza-parrish.html?look=orinoco"), 9000],
];
const HIDE_UI = "button, [data-dock-piece], [data-testid='dock-panel'], .ec-title, [data-masthead], [data-testid='corner-menu'], [data-testid='ciudad-time-chip'], [data-testid='reality-gate'] { visibility: hidden !important; }";
const only = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--use-gl=angle", "--ignore-gpu-blocklist"] });
for (const [id, url, wait, prep] of SHOTS) {
  if (only.length && !only.includes(id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1125 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:singularity-seen", "1"); localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true, hallDue: false })); } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForTimeout(wait);
  const press = async (sel, after) => {
    try { await page.waitForSelector(sel, { timeout: 30000, state: "attached" }); await page.evaluate((q) => { const el = document.querySelector(q); if (el) el.click(); }, sel); await page.waitForTimeout(after || 3000); }
    catch (e) { console.log(`  (${id}: ${sel} never came)`); }
  };
  if (prep && prep.click) await press(prep.click, prep.after);
  if (prep && prep.click2) await press(prep.click2, prep.after2);
  if (prep && prep.cam) { await page.evaluate((c) => window.__EC_TEST_CAM__ && window.__EC_TEST_CAM__(c), prep.cam); await page.waitForTimeout(2500); }
  await page.addStyleTag({ content: HIDE_UI });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `world-${id}.png`) });
  console.log(`world-${id}: ${Date.now() - t0} ms`);
  await ctx.close();
}
await browser.close();
