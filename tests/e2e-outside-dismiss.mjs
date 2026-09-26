/* In-game helper pop-ups go away on a press outside them, in every
   theme: the piece card (off the board, and mid-turn on an empty square,
   when the piece itself stays selected), the unused-points note, and
   Tienda's "Your order" slip once it has been tapped open. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 4000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); } return v; };

const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "dark-opa", type: "opa", owner: "dark", row: 1, col: 7, w: 2, h: 2, z: 2 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 8, col: 8, w: 1, h: 1, z: 1 },
];
const OPENING = { tienda: "tienda-open-box", lluvia: "lluvia-straight-to-board" };

async function startGame(theme, laws) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; if (l) window.__EC_LAWS__ = l; }, laws || null);
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(2500);
  if (OPENING[theme]) { await page.locator(`[data-testid="${OPENING[theme]}"]`).click(); await page.waitForTimeout(1200); }
  await openDockPanel(page);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Begin Game" }).first().click();
  await page.mouse.move(4, 400);
  await page.waitForTimeout(2000);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 400); await page.waitForTimeout(600); }
  return { context, page, errs };
}

for (const theme of ["neon", "tienda", "lluvia"]) {
  console.log(`[${theme}]`);
  let { context, page, errs } = await startGame(theme);
  let errs2 = [];

  const card = page.locator('[data-testid="piece-card"]');
  const at = (id) => page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  const empty = () => page.evaluate(() => window.__EC_TEST_CUBE_POS__(6, 1));
  const select = async (id) => { const p = await at(id); await page.mouse.click(p.x, p.y); return poll(async () => (await card.count()) === 1); };
  const badges = () => page.evaluate(() => window.__EC_TEST_COST_BADGES__().length);

  check("selecting a piece shows its card", await select("dark-turrito"));
  const counter = await page.locator('[data-testid="points-counter"]').boundingBox();
  await page.mouse.click(counter.x + counter.width / 2, counter.y + counter.height / 2);
  check("a press on the page outside it puts the card away", await poll(async () => (await card.count()) === 0));

  check("selecting it again brings the card back", await select("dark-turrito"));
  let e = await empty();
  await page.mouse.click(e.x, e.y);
  check("a tap on an empty square puts it away (and lets go of the piece)", await poll(async () => (await card.count()) === 0 && (await badges()) === 0));

  await select("dark-turrito");
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "S"));
  await page.waitForTimeout(1800);
  check("mid-turn the card stays with the piece", (await card.count()) === 1);
  e = await empty();
  await page.mouse.click(e.x, e.y);
  check("mid-turn, a tap on an empty square puts the card away", await poll(async () => (await card.count()) === 0));
  check("...but the piece stays selected (its moves still showing)", (await badges()) > 0);

  if (theme === "tienda") {
    const slip = page.locator('[data-testid="tienda-slip"]');
    await page.locator('[data-testid="tienda-slip-tag"]').click();
    check("the order slip taps open", await poll(async () => (await slip.getAttribute("data-open")) === "true"));
    e = await empty();
    await page.mouse.click(e.x, e.y);
    check("a press outside it closes the slip", await poll(async () => (await slip.getAttribute("data-open")) === "false"));
    await page.locator('[data-testid="tienda-slip-tag"]').click();
    await poll(async () => (await slip.getAttribute("data-open")) === "true");
    await page.mouse.move(e.x, e.y);
    await page.keyboard.press("Escape");
    check("...and so does Escape", await poll(async () => (await slip.getAttribute("data-open")) === "false"));
  }

  await context.close();

  // With 3 Actions Per Turn an Opa roll spends 2 of the 3 and ends the
  // turn, so the unused-points note shows; a press elsewhere clears it.
  ({ context, page, errs: errs2 } = await startGame(theme, { threeActions: true }));
  const note = page.locator('[data-testid="unused-points-note"]');
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-opa", "S"));
  check("an Opa roll leaves the unused-points note", await poll(async () => (await note.count()) === 1, 3000));
  e = await page.evaluate(() => window.__EC_TEST_CUBE_POS__(6, 1));
  await page.mouse.click(e.x, e.y);
  check("...which goes on a press elsewhere, well before it would fade", await poll(async () => (await note.count()) === 0, 1200));
  check("no page errors", errs.length + errs2.length === 0, [...errs, ...errs2].join(" | "));
  await context.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
