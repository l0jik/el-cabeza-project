/* When Light opens, the Move Log lists Light first. A reported game Light
   opened showed "1. Dark: — | Light: …", which read as Dark skipping its
   first turn. Here the AI plays Light and opens; after one move the game
   is ended and the Move Log's columns and copied text are checked. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let failures = 0;
const check = (l, c) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}`); };

await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
await page.waitForTimeout(1500);
await openDockPanel(page);
// The second AI button hands Light to the AI; the status pill picks who opens.
await page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).nth(1).click();
await page.waitForTimeout(500);
const pill = page.locator('[data-testid="turn-status"]');
for (let i = 0; i < 2 && !/light/i.test(await pill.textContent()); i++) { await pill.click(); await page.waitForTimeout(300); }
check("Light is set to open", /light/i.test(await pill.textContent()));
await page.locator("button", { hasText: "Begin Game" }).click();
for (let i = 0; i < 40 && !(await page.evaluate(() => (window.__EC_TEST_LOG__ || []).length)); i++) await page.waitForTimeout(500);
const log = await page.evaluate(() => (window.__EC_TEST_LOG__ || []).map((e) => e.player));
check(`the AI (Light) moved first (log: ${log.join(",")})`, log[0] === "light");

await openDockPanel(page).catch(() => {});
await page.locator("button", { hasText: "End Active Game" }).click();
await page.waitForTimeout(800);
await page.locator('[data-testid="dock-panel"] button', { hasText: /^Move Log$/ }).click();
await page.waitForTimeout(800);
const headers = await page.evaluate(() => [...document.querySelectorAll("span")].map((s) => s.textContent.trim()).filter((t) => t === "Dark" || t === "Light"));
check(`the Move Log's first column is Light (${headers.join(", ")})`, headers[0] === "Light" && headers[1] === "Dark");
await page.locator("button", { hasText: /Copy Move[ _]?Log/i }).first().click();
await page.waitForTimeout(400);
const text = await page.evaluate(() => navigator.clipboard.readText());
const first = text.split("\n").find((l) => /^1\./.test(l)) || "";
check(`copied round 1 opens with Light and shows no skipped Dark move (${JSON.stringify(first)})`, /^1\. Light: /.test(first) && !/—/.test(first));
check(`no page errors (${errs.length})`, errs.length === 0);

await browser.close();
console.log(failures === 0 ? "\nMOVE LOG E2E PASSED" : `\nMOVE LOG E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
