/* Draws an SVG with the project's Chromium into a PNG, for the art the
   tools draw by hand (tools/tienda_flyer_family.py).

     node tools/svg_render.mjs in.svg out.png [scale]

   The SVG is opened as a page of its own (file://), so its fonts may come
   from tools/fonts by a relative url() in its <style>. Playwright is
   resolved from tests/, where it's installed. */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../tests/run-e2e.mjs", import.meta.url));
const { chromium } = require("playwright");
const [, , inPath, outPath, scaleArg] = process.argv;
const scale = Number(scaleArg) || 1;
const browser = await chromium.launch({ executablePath: process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ deviceScaleFactor: scale });
await page.goto("file://" + path.resolve(inPath));
await page.evaluate(() => document.fonts.ready);
const size = await page.evaluate(() => { const s = document.documentElement; return { w: s.width.baseVal.value, h: s.height.baseVal.value }; });
await page.setViewportSize({ width: Math.ceil(size.w), height: Math.ceil(size.h) });
await page.waitForTimeout(150);
await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: size.w, height: size.h }, omitBackground: true });
await browser.close();
console.log(`${outPath}: ${size.w}x${size.h} @${scale}x`);
