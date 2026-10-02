/* Tienda's sound menu (the dock's speaker button, theme.soundChannels):
   All sounds, and Music / Store sounds / Pieces each on their own. Music
   off leaves the store and the pieces sounding; the choice is kept across
   a reload; a press outside or Escape closes the menu without closing the
   dock. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

async function openGame() {
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-tienda.html");
  await page.waitForTimeout(4000);
  await page.locator("button", { hasText: /open the box/i }).first().click();
  await page.waitForTimeout(5000);
}
async function openDock() {
  const dock = page.locator('canvas[data-testid="dock-piece-canvas"]');
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") return;
    const b = await dock.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1200);
  }
}
const audio = () => page.evaluate(() => window.__TIENDA_AUDIO__());

await openGame();
await openDock();
await page.locator('[data-testid="dock-panel"] button', { hasText: /begin|try a game/i }).first().click(); // (the store's says Try a Game)
await page.waitForTimeout(4000);
await openDock();
await page.locator('[data-testid="sound-button"]').click();
check("the speaker opens the sound menu", (await page.locator('[data-testid="sound-menu"]').count()) === 1);
// Sliders (all the way left is off): each starts all the way up.
for (const k of ["sound-all", "sound-ch-music", "sound-ch-store", "sound-ch-pieces"]) {
  check(`...with ${k}, all the way up`, (await page.locator(`[data-testid="${k}"]`).getAttribute("data-level")) === "100");
}
await page.locator('[data-testid="sound-ch-store"]').fill("50");
await page.waitForTimeout(500);
let half = await audio();
check("the store's slider at half: its path at a quarter (heard as the square)", half.gates.store.every((g) => Math.abs(g - 0.25) < 0.02), JSON.stringify(half.gates.store));
await page.locator('[data-testid="sound-ch-store"]').fill("100");
await page.locator('[data-testid="sound-ch-music"]').fill("0");
await page.waitForTimeout(500);
let a = await audio();
check("Music off silences the music's path", a.gates.music.every((g) => g === 0), JSON.stringify(a.gates));
check("...and leaves the store and the pieces sounding", a.gates.store.every((g) => g === 1) && a.gates.pieces.every((g) => g === 1), JSON.stringify(a.gates));
check("...while the music itself keeps its place (still playing underneath)", a.music === true);
check("the dock stays open while you use the menu", (await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape closes the menu", (await page.locator('[data-testid="sound-menu"]').count()) === 0);
await page.locator('[data-testid="sound-button"]').click();
await page.locator('[data-testid="sound-ch-pieces"]').fill("0");
// A path reads its new level once something sounds through it: a move.
await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
await page.waitForTimeout(1500);
a = await audio();
check("Pieces off silences the game's own sounds", a.gates.pieces.every((g) => g === 0), JSON.stringify(a.gates));
await openDock();
if (!(await page.locator('[data-testid="sound-menu"]').count())) await page.locator('[data-testid="sound-button"]').click();
await page.locator('[data-testid="sound-ch-pieces"]').fill("100");
await page.mouse.click(40, 300);
await page.waitForTimeout(400);
check("a press outside closes it", (await page.locator('[data-testid="sound-menu"]').count()) === 0);

// Kept across a reload.
await openGame();
await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
await page.waitForTimeout(1500);
a = await audio();
check("after a reload the music is still off", a.channelsOff.music === true && a.channelsOff.pieces === false, JSON.stringify(a.channelsOff));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));

await browser.close();
console.log(failures === 0 ? "\nSOUND CHANNELS E2E PASSED" : `\nSOUND CHANNELS E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
