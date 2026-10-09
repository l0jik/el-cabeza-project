/* The pictures of the other realities (themes/realities.js WORLDS): the
   den's television shows one per channel after the story, and the
   realities menu shows them too. Each world's page, opened in a browser
   at 4:3, given a few seconds to come up, and photographed; written to
   assets/den/channels/<id>.png, then made small JPEGs by
   tools/channel_shots.py (build/build.js puts them beside Nova and the
   den's page as el-cabeza-channel-<id>.jpg).

     npm run build && node tools/channel_shots.mjs && python3 tools/channel_shots.py */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = (f) => "file://" + path.join(ROOT, "dist", f);
const LAB = ["swiss", "bauhaus", "destijl", "elementarism", "brutalist", "newTypography", "corporateSwiss", "neoBrutalist", "minimalMono", "ultimateFusion"];
const SHOTS = [
  ["den", dist("el-cabeza-standard.html"), 6500],
  ["neon", dist("el-cabeza-neon.html"), 6500],
  ["store", dist("el-cabeza-tienda.html"), 7000],
  ["lluvia", dist("el-cabeza-lluvia.html"), 9000],
  ["cromo", dist("el-cabeza-cromo.html"), 6500],
  ["plano", dist("el-cabeza-plano.html"), 7000],
  // (Luna low over the board, so the Earth is in the picture: the view a player tilts down to.)
  ["luna", dist("el-cabeza-luna.html?quality=high"), 9000, { cam: { theta: 0.35, phi: 1.36, radius: 14.5, snap: true } }],
  ["parrish-orinoco", dist("el-cabeza-parrish.html?look=orinoco"), 9000],
  ["parrish-watermark", dist("el-cabeza-parrish.html?look=watermark"), 9000],
  ...LAB.map((id) => [`lab-${id}`, dist(`el-cabeza-lab.html?theme=${id}`), 6000]),
];
const only = process.argv[2] ? process.argv[2].split(",") : null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=angle", "--ignore-gpu-blocklist"] });
for (const [id, url, wait, prep] of SHOTS) {
  if (only && !only.includes(id)) continue;
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  if (prep && prep.cam) await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(url);
  await page.waitForTimeout(wait);
  if (prep && prep.cam) { await page.evaluate((c) => window.__EC_TEST_CAM__ && window.__EC_TEST_CAM__(c), prep.cam); await page.waitForTimeout(2500); }
  await page.screenshot({ path: path.join(ROOT, "assets", "den", "channels", `${id}.png`) });
  await page.close();
  console.log("shot", id);
}
await browser.close();
