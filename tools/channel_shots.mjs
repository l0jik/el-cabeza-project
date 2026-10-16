/* The pictures of the other realities (themes/realities.js WORLDS): the
   den's television shows one per channel after the story, and the
   realities menu shows them too. Each world's page, opened in a browser
   at 4:3, given a few seconds to come up, and photographed; written to
   assets/den/channels/<id>.png, then made small JPEGs by
   tools/channel_shots.py (build/build.js puts them beside Nova and the
   den's page as el-cabeza-channel-<id>.jpg).

     npm run build && node tools/channel_shots.mjs && python3 tools/channel_shots.py */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = (f) => "file://" + path.join(ROOT, "dist", f);
const LAB = ["swiss", "bauhaus", "destijl", "elementarism", "brutalist", "newTypography", "corporateSwiss", "neoBrutalist", "minimalMono", "ultimateFusion"];
const SHOTS = [
  ["den", dist("el-cabeza-standard.html"), 6500],
  ["futuris", dist("el-cabeza-futuris.html"), 6500],
  // (The store with its box opened, the demo table, set into a page of
  // Big Glutts' flyer: bigGlutts below.)
  ["store", dist("el-cabeza-tienda.html"), 7000, { click: '[data-testid="tienda-open-box"]', after: 5000, hideUi: true, frame: bigGlutts }],
  ["lluvia", dist("el-cabeza-lluvia.html"), 9000],
  ["cromo", dist("el-cabeza-cromo.html"), 6500],
  ["plano", dist("el-cabeza-plano.html"), 7000],
  // (Luna low over the board, so the Earth is in the picture: the view a player tilts down to.)
  ["luna", dist("el-cabeza-luna.html?quality=high"), 9000, { cam: { theta: 0.35, phi: 1.36, radius: 14.5, snap: true } }],
  ["noir", dist("el-cabeza-noir.html?quality=high"), 9000],
  // (The City at Golden Hour, the warm one of its five times of day.)
  ["ciudad", dist("el-cabeza-ciudad.html?quality=high&time=golden"), 10000],
  ["parrish-orinoco", dist("el-cabeza-parrish.html?look=orinoco"), 9000],
  ["parrish-watermark", dist("el-cabeza-parrish.html?look=watermark"), 9000],
  ...LAB.map((id) => [`lab-${id}`, dist(`el-cabeza-lab.html?theme=${id}`), 6000]),
];
/* The store's card, branded (user: "add some 'Big Glutts' store branding
   on this Theme Switcher card, to give it more of an instant, relatable
   feel to the shopping experience"): the store's picture set into a page
   of its flyer (themes/tienda-overlay.js), the four earth-tone stripes
   down the side and round the top, the store's name where they turn, its
   red sticker and its department's band. The fonts beside the store's
   assets (assets/tienda/fonts, SIL Open Font License), so the picture
   needs nothing from the network. */
async function bigGlutts(browser, shot) {
  const b64 = (f) => fs.readFileSync(path.join(ROOT, f)).toString("base64");
  const stripes = "#6B3A1E 0 14px, transparent 14px 16px, #B4451F 16px 30px, transparent 30px 32px, #E07B22 32px 46px, transparent 46px 48px, #E9B23A 48px 62px";
  const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Caprasimo'; src: url(data:font/woff2;base64,${b64("assets/tienda/fonts/caprasimo-latin.woff2")}) format('woff2'); }
@font-face { font-family: 'Libre Franklin'; font-weight: 100 900; src: url(data:font/woff2;base64,${b64("assets/tienda/fonts/libre-franklin-latin.woff2")}) format('woff2'); }
html, body { margin: 0; width: 960px; height: 720px; overflow: hidden; }
.card { position: relative; width: 960px; height: 720px; background: #F2E6CC url(data:image/webp;base64,${b64("assets/tienda/flyer-paper.webp")}) center / cover; }
.sv { position: absolute; left: 14px; top: 124px; bottom: 0; width: 62px; background: linear-gradient(90deg, ${stripes}); }
.sc { position: absolute; left: 14px; top: 14px; width: 110px; height: 110px; }
.sh { position: absolute; left: 124px; right: 0; top: 14px; height: 62px; background: linear-gradient(180deg, ${stripes}); }
.logo { position: absolute; left: 100px; top: 96px; }
.logo b { display: block; font: 400 74px/0.95 'Caprasimo', serif; color: #6B3A1E; letter-spacing: 0.01em; text-shadow: 4px 4px 0 #E9B23A; }
.logo span { display: block; margin-top: 12px; font: 800 19px/1 'Libre Franklin', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #B4451F; }
.when { position: absolute; right: 30px; top: 104px; padding: 10px 18px 12px; text-align: center; background: #C8281E; color: #FFF6E4; transform: rotate(3deg); box-shadow: 4px 4px 0 #17110c; }
.when b { display: block; font: italic 900 30px/1 'Libre Franklin', sans-serif; letter-spacing: 0.02em; text-transform: uppercase; }
.when span { display: block; margin-top: 6px; font: 700 18px/1.15 'Libre Franklin', sans-serif; }
.pic { position: absolute; left: 100px; top: 250px; right: 30px; bottom: 30px; border: 3px solid #17110c; background: #2a1d14 url(data:image/png;base64,${shot.toString("base64")}) 50% 0 / cover no-repeat; }
.band { position: absolute; left: 100px; top: 250px; transform: translateY(-100%); padding: 6px 14px 7px; background: #17110c; color: #FFF6E4; font: italic 900 24px/1 'Libre Franklin', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
</style><div class="card"><span class="sv"></span>
<svg class="sc" viewBox="0 0 55 55"><path d="M3.5 55 A51.5 51.5 0 0 1 55 3.5" fill="none" stroke="#6B3A1E" stroke-width="7"/><path d="M11.5 55 A43.5 43.5 0 0 1 55 11.5" fill="none" stroke="#B4451F" stroke-width="7"/><path d="M19.5 55 A35.5 35.5 0 0 1 55 19.5" fill="none" stroke="#E07B22" stroke-width="7"/><path d="M27.5 55 A27.5 27.5 0 0 1 55 27.5" fill="none" stroke="#E9B23A" stroke-width="7"/></svg>
<span class="sh"></span><div class="logo"><b>Big Glutts</b><span>Your savings headquarters</span></div>
<div class="when"><b>Free demo!</b><span>Games &amp; Hobby · Aisle 9</span></div>
<div class="pic"></div><div class="band">Toys &amp; Games</div></div>`;
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await page.close();
  return png;
}
// The page's own buttons and the dock, out of a picture of the place.
const HIDE_UI = "button, [data-dock-piece], [data-testid='dock-panel'], .ec-title, [data-masthead] { visibility: hidden !important; }";

const only = process.argv[2] ? process.argv[2].split(",") : null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--use-gl=angle", "--ignore-gpu-blocklist"] });
for (const [id, url, wait, prep] of SHOTS) {
  if (only && !only.includes(id)) continue;
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  if (prep && prep.cam) await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(url);
  await page.waitForTimeout(wait);
  if (prep && prep.cam) { await page.evaluate((c) => window.__EC_TEST_CAM__ && window.__EC_TEST_CAM__(c), prep.cam); await page.waitForTimeout(2500); }
  if (prep && prep.click) { await page.locator(prep.click).click(); await page.waitForTimeout(prep.after || 3000); }
  if (prep && prep.hideUi) { await page.addStyleTag({ content: HIDE_UI }); await page.waitForTimeout(600); }
  const shot = await page.screenshot();
  fs.writeFileSync(path.join(ROOT, "assets", "den", "channels", `${id}.png`), prep && prep.frame ? await prep.frame(browser, shot) : shot);
  await page.close();
  console.log("shot", id);
}
await browser.close();
