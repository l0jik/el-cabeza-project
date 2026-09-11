import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

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
// bounce/open the settings panel (with Anomaly/Begin Game), same as a
// real player. Retries the gesture until confirmed open — see
// dock-helpers.mjs.
const dockOpened = await openDockPanel(page);
console.log("dock panel opened:", dockOpened);

const anomalyBtn = page.locator("button", { hasText: "Anomaly" });
console.log("Anomaly button present:", await anomalyBtn.count());
await page.screenshot({ path: "/tmp/neon-setup-screen.png" });

// Click Anomaly a couple times, confirm the board changes (piece
// positions randomize) without breaking anything.
const before = await page.evaluate(() => document.querySelectorAll("canvas").length);
await anomalyBtn.click();
await page.waitForTimeout(300);
await anomalyBtn.click();
await page.waitForTimeout(300);
console.log("canvas still present after Anomaly clicks:", (await page.evaluate(() => document.querySelectorAll("canvas").length)) === before);

// Hover-hold on Anomaly for 4+ seconds to reveal Singularity.
const box = await anomalyBtn.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
console.log("holding hover on Anomaly for 4.5s to reveal Singularity...");
await page.waitForTimeout(4500);
const singularityVisible = await page.evaluate(() => {
  const el = document.querySelector(".ec-singularity-btn");
  return el ? getComputedStyle(el.closest("div")).display !== "none" && !!el : false;
});
console.log("Singularity button revealed:", singularityVisible);
await page.screenshot({ path: "/tmp/neon-singularity-revealed.png" });

if (singularityVisible) {
  await page.locator(".ec-singularity-btn").click();
  await page.waitForTimeout(400);
  const popupText = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("SINGULARITY PROTOCOL"));
    return h2 ? h2.parentElement.textContent : null;
  });
  console.log("Singularity popup opened:", !!popupText);
  await page.screenshot({ path: "/tmp/neon-singularity-popup.png" });

  // Close via Escape — walk up from the heading to the ancestor that
  // actually carries the opacity transition (the outer fixed-position
  // backdrop), rather than assuming a specific nesting depth.
  const opacityBefore = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("SINGULARITY PROTOCOL"));
    let el = h2;
    while (el && el.style.opacity === "") el = el.parentElement;
    return el ? el.style.opacity : null;
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const opacityAfter = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("SINGULARITY PROTOCOL"));
    let el = h2;
    while (el && el.style.opacity === "") el = el.parentElement;
    return el ? el.style.opacity : null;
  });
  console.log("Singularity popup closed via Escape:", opacityBefore === "1" && opacityAfter === "0");
}

console.log("errors:", errors.length);
errors.forEach((e) => console.log("   " + e));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
