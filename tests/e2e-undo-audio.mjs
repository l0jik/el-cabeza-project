/* Undoing the last turn after a game has ended must bring the sound back.
   Reported: open the dock after the game ends, press Undo Turn, carry on
   playing — and the game is silent. The AI plays Dark and opens; the game
   is ended by hand, then Undo Turn is pressed in the dock. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const theme = process.argv[2] || "neon";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let failures = 0;
const check = (l, c) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}`); };
const audio = () => page.evaluate(() => (window.__EC_TEST_AUDIO__ ? window.__EC_TEST_AUDIO__() : null));

await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
await page.waitForTimeout(1500);
await openDockPanel(page);
await page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).first().click();
await page.waitForTimeout(400);
await page.locator("button", { hasText: "Begin Game" }).click();
for (let i = 0; i < 40 && !(await page.evaluate(() => (window.__EC_TEST_LOG__ || []).length)); i++) await page.waitForTimeout(500);
await page.waitForTimeout(2500);
const playing = await audio();
console.log("  playing:", JSON.stringify(playing));
check("sound is up while playing", playing && playing.gain > 0.1);

await openDockPanel(page).catch(() => {});
await page.locator("button", { hasText: "End Active Game" }).click();
await page.waitForTimeout(2600);
const ended = await audio();
console.log("  ended:", JSON.stringify(ended));
check("ending the game fades the sound out", ended && ended.gain < 0.05);

await openDockPanel(page).catch(() => {});
await page.locator("button", { hasText: /^Undo turn$/i }).first().click();
await page.waitForTimeout(3000);
const back = await audio();
console.log("  after undo:", JSON.stringify(back));
check("after Undo Turn the game is playing again", /to move|thinking/i.test(await page.locator('[data-testid="turn-status"]').textContent()));
check("after Undo Turn the sound is back up", back && back.gain > 0.1 && !back.windingDown);
check("...and the ambient bed isn't left at zero", back && (back.intro === null || back.intro > 0.5));

/* The reported case: a game won outright (Dark's Cabeza steps onto the
   far row), then the dock opened and Undo Turn pressed, then play goes
   on. */
const win = await browser.newPage({ viewport: { width: 900, height: 900 } });
win.on("pageerror", (e) => errs.push(e.message));
const audioW = () => win.evaluate(() => (window.__EC_TEST_AUDIO__ ? window.__EC_TEST_AUDIO__() : null));
await win.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await win.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
await win.waitForTimeout(1500);
await openDockPanel(win);
await win.evaluate(() => window.__EC_TEST_SET_PIECES__([
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 8, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 1, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
]));
await win.waitForTimeout(300);
await win.locator("button", { hasText: "Begin Game" }).click();
await win.waitForTimeout(3000);
check("(win) sound is up while playing", ((await audioW()) || {}).gain > 0.1);
await win.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "S"));
await win.waitForTimeout(4500);
const w1 = await audioW();
console.log("  won:", JSON.stringify(w1));
check("(win) Dark's Cabeza reached the far row and the sound faded", w1 && w1.gain < 0.05 && w1.windingDown);
// A phone can suspend the context during the post-game silence.
await win.evaluate(() => window.__EC_TEST_AUDIO_SUSPEND__());
await win.waitForTimeout(300);
check("(win) the context is suspended, as a phone may do after the game", ((await audioW()) || {}).state === "suspended");
await win.mouse.click(6, 6); // dismiss the victory overlay if it's up
await win.waitForTimeout(500);
await openDockPanel(win).catch(() => {});
await win.locator("button", { hasText: /^Undo turn$/i }).first().click();
await win.waitForTimeout(3000);
const w2 = await audioW();
console.log("  after undo:", JSON.stringify(w2));
check("(win) after Undo Turn the sound is back up and the context running", w2 && w2.gain > 0.1 && !w2.windingDown && w2.state === "running");
// Carry on playing: Dark steps sideways, Light answers.
await win.mouse.click(6, 6);
await win.waitForTimeout(400);
await win.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "E"));
await win.waitForTimeout(1500);
await win.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "N"));
await win.waitForTimeout(3000);
const w3 = await audioW();
console.log("  playing on:", JSON.stringify(w3), (await win.evaluate(() => (window.__EC_TEST_LOG__ || []).map((e) => e.player + ":" + e.notation))).join(" "));
check("(win) playing on after the undo, the sound stays up", w3 && w3.gain > 0.1 && !w3.windingDown);

check(`no page errors (${errs.length})`, errs.length === 0);
await browser.close();
console.log(failures === 0 ? "\nUNDO AUDIO E2E PASSED" : `\nUNDO AUDIO E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
