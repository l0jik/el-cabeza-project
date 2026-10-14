/* The front page's versions, photographed: each dist/front-N.html at a
   desktop and at a phone, for the review sheet (front/review/*.jpg,
   shown on front-review.html) and the contact sheet sent to the user.
     node tools/front_shots.mjs [N ...] */
import { chromium } from "playwright";
import fs from "node:fs";
const ROOT = "/home/user/el-cabeza-project";
const only = process.argv.slice(2).map(Number);
const ALL = fs.readdirSync(`${ROOT}/front`).map((f) => /^front-(\d+)\.html$/.exec(f)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
const N = ALL.filter((i) => !only.length || only.includes(i));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))));
  await page.waitForTimeout(400);
};
for (const i of N) {
  for (const [kind, ctxOpts] of [["desk", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`file://${ROOT}/dist/front-${i}.html`);
    await settle(page);
    const fontsOk = await page.evaluate(() => document.fonts.check('16px "Cinzel"') && document.fonts.check('16px "Josefin Sans"'));
    await page.screenshot({ path: `${ROOT}/front/review/front-${i}-${kind}.jpg`, type: "jpeg", quality: 74 });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`front-${i} ${kind}: ${fontsOk ? "fonts ok" : "FONTS MISSING"}, page ${h}px${errs.length ? ", errors: " + errs.join(" | ") : ""}`);
    await ctx.close();
  }
}
await browser.close();
