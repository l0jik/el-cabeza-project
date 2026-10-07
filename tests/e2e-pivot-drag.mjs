/* Pivoting by grabbing an arm and dragging it round (user: a Hombro on
   its stem wouldn't turn that way). The Hombro balanced on its stem has
   two arms; each, dragged across, turns it the way it's dragged, whether
   or not it was selected first. Two causes, both fixed: a selected
   piece's turn arrows lie over its arms and won the press; and the hover
   coming and going under the drag re-bound the pointer handlers and
   dropped the drag. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";
let failures = 0;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const H = { id: "dark-hombro", type: "hombro", owner: "dark", row: 4, col: 4, w: 2, h: 2, z: 2, vox: "0,0,0;0,0,1;1,0,1;0,1,1" };
const POS = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 }, H,
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
];
async function trial(name, from, dir, selectFirst) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.on("console", (m) => { if (/DBG/.test(m.text())) console.log("   " + m.text()); });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { cantileverPivot: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POS);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).click();
  await page.mouse.move(4, 450);
  await page.waitForTimeout(4000);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 450); await page.waitForTimeout(500); }
  if (selectFirst) { const s = await page.evaluate(() => window.__EC_TEST_CUBE_POS__(4, 4, 0)); await page.mouse.click(s.x, s.y); await page.waitForTimeout(800); }
  const a = await page.evaluate(([r, c]) => window.__EC_TEST_CUBE_POS__(r, c, 1), from);
  const b = await page.evaluate(([r, c]) => window.__EC_TEST_CUBE_POS__(r, c, 1), [from[0] + dir[0], from[1] + dir[1]]);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await page.waitForTimeout(30); }
  await page.mouse.up(); await page.waitForTimeout(1600);
  const h = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "dark-hombro");
  const want = dir[0] === 1 || dir[1] === -1 ? "0,0,1;1,0,0;1,0,1;1,1,1" : "0,0,1;0,1,0;0,1,1;1,1,1";
  const ok = h.vox === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${selectFirst ? " (selected first)" : ""}${ok ? "" : " — " + JSON.stringify(h)}`);
  if (errs.length) { failures++; console.log("  FAIL page errors " + errs.join(" | ")); }
  await page.close();
}
for (const sel of [false, true]) {
  await trial("east arm dragged south (cw)", [4, 5], [1, 0], sel);
  await trial("east arm dragged north (ccw)", [4, 5], [-1, 0], sel);
  await trial("south arm dragged west (cw)", [5, 4], [0, -1], sel);
  await trial("south arm dragged east (ccw)", [5, 4], [0, 1], sel);

}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
