import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
const file = path.join(__dirname, "..", "dist", `el-cabeza-${target}.html`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`file://${file}`);
await page.waitForTimeout(1200);
await page.locator("button", { hasText: "Begin Game" }).click();
await page.waitForTimeout(600);

const statusText = () => page.evaluate(() => {
  const spans = [...document.querySelectorAll("span")];
  const s = spans.find((s) => /to move|left|thinking/i.test(s.textContent || ""));
  return s ? s.textContent : null;
});

console.log(`[${target}] initial status:`, await statusText());

// Click on the light Cabeza (the disc) — in the default camera framing
// it's the small circular piece front-and-center-left of the light
// cluster. Try a handful of candidate points since exact projection
// varies slightly between the two themes' camera math (should be
// identical, but confirm empirically rather than assume).
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
let selected = false;
for (const [fx, fy] of [[0.5, 0.37], [0.42, 0.35], [0.58, 0.3], [0.44, 0.33], [0.52, 0.34]]) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(300);
  const s = await statusText();
  if (s && /step|roll/i.test(s)) { selected = true; console.log(`[${target}] selected via (${fx},${fy}):`, s); break; }
}
console.log(`[${target}] a piece got selected:`, selected);

await page.screenshot({ path: `/tmp/${target}-selected.png` });

// Try to complete an actual move by clicking just south (toward camera)
// of the selected piece, where a legal-move ghost outline should be.
if (selected) {
  for (const [fx, fy] of [[0.5, 0.44], [0.5, 0.48], [0.46, 0.44], [0.54, 0.44]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(700); // roll animation
    const s = await statusText();
    if (s === "Light to move" || /finished|left/i.test(s || "")) {
      console.log(`[${target}] move completed via (${fx},${fy}), status now:`, s);
      break;
    }
  }
  await page.screenshot({ path: `/tmp/${target}-after-move.png` });
  console.log(`[${target}] status after move attempt:`, await statusText());
}

// End the game and check the Move Log popup.
await page.locator("button", { hasText: "End Active Game" }).click();
await page.waitForTimeout(400);
const moveLogBtn = page.locator("button", { hasText: "Move Log" });
console.log(`[${target}] Move Log button present after End Active Game:`, await moveLogBtn.count());
if (await moveLogBtn.count()) {
  await moveLogBtn.click();
  await page.waitForTimeout(300);
  const popupText = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("MOVE LOG"));
    return h2 ? h2.parentElement.textContent : null;
  });
  console.log(`[${target}] Move Log popup content:`, JSON.stringify(popupText));
  await page.screenshot({ path: `/tmp/${target}-movelog.png` });
}

console.log(`[${target}] total errors:`, errors.length);
errors.forEach((e) => console.log("   " + e));

await browser.close();
