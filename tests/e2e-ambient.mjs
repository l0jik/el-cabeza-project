import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION_RESET/.test(m.text())) errors.push(m.text()); });

await page.goto(`file://${file}`);
await page.waitForTimeout(1000);

// The dock starts as a spinning 3D piece preview; double-tap it to
// bounce/open the settings panel (with Begin Game), same as a real
// player. Retries the gesture until confirmed open — see dock-helpers.mjs.
const dockOpened = await openDockPanel(page);
console.log("dock panel opened:", dockOpened);

await page.locator("button", { hasText: "Begin Game" }).click();

// Begin Game closes the dock panel behind it — it remorphs into the
// piece and relocates to the bottom-right corner watermark on a 900ms
// delay plus its own 900ms CSS transition. Poll for that (rather than a
// fixed sleep — this sandboxed test environment's real-world timing has
// proven wildly variable, up to several seconds per interaction under
// load), then double-tap it to reopen the panel so the halo/status
// elements below are actually present to sample — see dock-helpers.mjs.
const cornerBox = await waitForDockCorner(page);
console.log("dock piece reached corner:", !!cornerBox);
const reopened = cornerBox && (await reopenDockPanelFromCorner(page, cornerBox));
console.log("panel reopened from corner:", reopened);

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
