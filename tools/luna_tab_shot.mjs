/* Luna's corner-menu tab on a phone, close up (user: "Make the mission
   rules button smaller for Luna"): node tools/luna_tab_shot.mjs OUT.png */
import { chromium } from "playwright";
import { openDockPanel } from "../tests/dock-helpers.mjs";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-luna.html");
await page.waitForTimeout(3000);
await openDockPanel(page);
await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
await page.waitForTimeout(2500);
if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 400); await page.waitForTimeout(600); }
await page.waitForSelector('[data-testid="corner-menu-tab"]', { timeout: 20000 });
await page.waitForTimeout(800);
const box = await page.locator('[data-testid="corner-menu-tab"]').boundingBox();
console.log(`tab: ${Math.round(box.width)} x ${Math.round(box.height)} px at ${Math.round(box.x)},${Math.round(box.y)}`);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 412, height: 200 } });
await browser.close();
