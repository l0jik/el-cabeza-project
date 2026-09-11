import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION_RESET/.test(m.text())) errors.push(m.text()); });

await page.goto(`file://${file}`);
await page.waitForTimeout(1000);
await page.locator("button", { hasText: "Begin Game" }).click();
console.log("Begin Game clicked, waiting 20s to let arc/crawl/floorWave/digitalGlitch armOnBegin timers (8-12s) and title/jitter effects fire...");

// Sample the turn-halo's CSS custom property a few times to confirm
// the continuous pulse effect is actually running (deterministic,
// unlike the rare flicker/spark/glitch effects which are hard to catch
// on camera without waiting minutes).
const haloSamples = [];
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(4000);
  const v = await page.evaluate(() => {
    const el = document.querySelector('[aria-hidden="true"]');
    // find the turn halo specifically: it's the small circular status dot
    const spans = [...document.querySelectorAll("span")];
    const halo = spans.find((s) => s.style && s.style.borderRadius === "50%" && s.getAttribute("aria-hidden") === "true");
    return halo ? getComputedStyle(halo).getPropertyValue("--ec-halo-intensity") : null;
  });
  haloSamples.push(v);
}
console.log("halo intensity samples over ~20s:", haloSamples);

await page.screenshot({ path: "/tmp/neon-after-20s.png" });
console.log("errors after 20s of real gameplay + ambient scheduling:", errors.length);
errors.forEach((e) => console.log("   " + e));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
