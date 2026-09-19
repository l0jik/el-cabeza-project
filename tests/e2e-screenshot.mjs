import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
const file = path.join(__dirname, "..", "dist", `el-cabeza-${target}.html`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.goto(`file://${file}`);
await page.waitForTimeout(1200);
await page.locator("button", { hasText: "Begin Game" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `/tmp/${target}-begin.png` });
console.log(`saved /tmp/${target}-begin.png`);
await browser.close();
