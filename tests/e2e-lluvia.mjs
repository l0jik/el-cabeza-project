/* Lluvia's opening and custom-rules city, end to end: the opening shows
   on load; DESCEND starts the flythrough; SKIP lands in the city; the
   MATTER / LAWS / TOPOLOGIES panels change settings; BEGIN THE GAME starts
   a real game with them (board size, roster, opponent); and the opening
   can be passed straight to the board. */
import { chromium } from "playwright";

const SHOTS = process.env.LLUVIA_SHOTS || null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-certificate-errors"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const errs = [];

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-lluvia.html");
  await page.waitForTimeout(2500);
  return page;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/lluvia-${name}.png` }); };

const page = await open({ width: 420, height: 860 });
const overlay = page.locator('[data-testid="lluvia-overlay"]');
check("the opening shows on load", (await overlay.count()) === 1 && (await overlay.getAttribute("data-phase")) === "ready");
await shot(page, "1-ready");

await page.locator('[data-testid="lluvia-descend"]').click();
await page.waitForTimeout(400);
check("DESCEND starts the flythrough", (await overlay.getAttribute("data-phase")) === "flight");
let caption = "";
for (let i = 0; i < 20 && !caption; i++) {
  await page.waitForTimeout(500);
  const c = page.locator('[data-testid="lluvia-caption"]');
  if (await c.count()) caption = await c.textContent();
}
check(`a caption tells the descent (${JSON.stringify(caption)})`, caption.length > 0);
await shot(page, "2-flight");
await page.locator('[data-testid="lluvia-skip"]').click();
await page.waitForTimeout(1200);
check("SKIP lands in the city", (await overlay.getAttribute("data-phase")) === "city");
await shot(page, "3-city");

await page.locator('[data-testid="lluvia-open-matter"]').click();
await page.waitForTimeout(300);
check("MATTER opens its panel", (await page.locator('[data-testid="lluvia-panel-matter"]').count()) === 1);
await page.locator('[data-testid="lluvia-matter-rayo-inc"]').click();
await page.waitForTimeout(150);
check("...a Rayo is added (6 pieces)", (await page.locator('[data-testid="lluvia-matter-total"]').textContent()).startsWith("6 /"));
await shot(page, "4-matter");
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.locator('[data-testid="lluvia-open-laws"]').click();
await page.waitForTimeout(300);
await page.locator('[data-testid="lluvia-law-diagonalSlide"]').click();
await page.waitForTimeout(150);
check("turning on Diagonal slide turns on Slide too",
  (await page.locator('[data-testid="lluvia-law-slide"]').getAttribute("aria-pressed")) === "true" &&
  (await page.locator('[data-testid="lluvia-law-diagonalSlide"]').getAttribute("aria-pressed")) === "true");
await shot(page, "5-laws");
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.locator('[data-testid="lluvia-open-topologies"]').click();
await page.waitForTimeout(300);
await page.locator('[data-testid="lluvia-size-12"]').click();
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.waitForTimeout(150);
await page.locator('[data-testid="lluvia-opponent"]').click();
await page.waitForTimeout(200);
check("the opponent switches to the CPU", /CPU/.test(await page.locator('[data-testid="lluvia-opponent"]').textContent()));

await page.locator('[data-testid="lluvia-begin"]').click();
await page.waitForTimeout(2500);
check("BEGIN THE GAME closes the city", (await overlay.count()) === 0);
const board = await page.evaluate(() => window.__EC_TEST_BOARD__);
check(`...on the 12 × 12 board chosen (${JSON.stringify(board)})`, board && board.rows === 12 && board.cols === 12);
const pieces = await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).map((p) => p.id));
check(`...with a Rayo on each side (${pieces.length} pieces)`, pieces.includes("dark-rayo") && pieces.includes("light-rayo") && pieces.length === 12);
const status = await page.locator('[data-testid="turn-status"]').textContent();
check(`...and the game is on (${JSON.stringify(status.trim())})`, /to move|thinking/i.test(status));
await page.waitForTimeout(3000);
await shot(page, "6-game");
await page.close();

// Straight to the board: the opening can be passed, leaving a plain game.
const p2 = await open({ width: 1000, height: 820 });
await p2.locator('[data-testid="lluvia-straight-to-board"]').click();
await p2.waitForTimeout(1200);
check("'Straight to the board' passes the opening", (await p2.locator('[data-testid="lluvia-overlay"]').count()) === 0);
check("...and CUSTOM RULES brings the city back", await (async () => {
  const { openDockPanel } = await import("./dock-helpers.mjs");
  await openDockPanel(p2);
  await p2.locator('[data-testid="lluvia-custom-rules"]').click();
  await p2.waitForTimeout(800);
  return (await p2.locator('[data-testid="lluvia-overlay"]').getAttribute("data-phase")) === "city";
})());
await shot(p2, "7-desktop-city");
await p2.close();

check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures === 0 ? "\nLLUVIA E2E PASSED" : `\nLLUVIA E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
