/* Cantilever Pivot LAW in the real game (Neon): a Codo balanced on one
   cube turns a quarter turn about it for one point (engine: legalPivots
   in rules.js, pivotPiece / pivotSweepClashes in shapes.js; chassis:
   the spin animation in animateStep and nextStateAfterDir for undo).
   The law is switched on at boot through window.__EC_LAWS__, positions
   are placed and moves played through the test-only hooks
   (window.__EC_TEST_HOOKS__).

   1. The arm's swing is blocked by a 2-tall piece on the diagonal it
      sweeps (clockwise), and free the other way (counter-clockwise),
      where it swings over an enemy Cabeza that stays sheltered. Only
      the free way gets a curved arrow, and tapping it plays the pivot.
   1b. Pivoting back refunds the point (a move that recreates an earlier
      position this turn rewinds the turn — chassis commit's trail).
   1c. A swipe across the arm pivots it the way the swipe goes.
   2. Undo move turns it back.
   3. Two quarter turns the same way make a half turn in one turn, and
      the move log records both.
   4. An AI opponent plays a turn with the law on and a balanced Codo.
   5. Rolling a piece out and back also costs nothing. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const FILE = "file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html";

// Balanced on the cube at row 4, col 4; its arm is held up over (4,5).
const BALANCED = { id: "dark-codo", type: "codo", owner: "dark", row: 4, col: 4, w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1" };
const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  BALANCED,
  // 2-tall, on the square the clockwise swing (east -> south) sweeps.
  { id: "light-turrito", type: "turrito", owner: "light", row: 5, col: 5, w: 1, h: 1, z: 2 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  // Under where the counter-clockwise swing (east -> north) ends.
  { id: "light-cabeza-1", type: "cabeza", owner: "light", row: 3, col: 4, w: 1, h: 1, z: 1 },
];

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { cantileverPivot: true }; });
  await page.goto(FILE);
  await page.waitForTimeout(1500);
  return { page, errs };
}
const statusText = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll("span")].find((el) => /to move|left$/i.test(el.textContent || ""));
  return s ? s.textContent : "";
});
const codoOf = async (page) => (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "dark-codo");
const same = (a, b) => a && a.row === b.row && a.col === b.col && a.w === b.w && a.h === b.h && a.vox === b.vox;

{
  const { page, errs } = await openPage();
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);

  // ---- 1. blocked one way, free the other ----
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-codo", "pivot-cw"));
  await page.waitForTimeout(900);
  check("clockwise is blocked: the arm would sweep through the 2-tall Turrito", same(await codoOf(page), BALANCED), JSON.stringify(await codoOf(page)));

  // Played the way a player does it: tap the Codo, then tap its
  // curved arrow. Only the unblocked way round gets an arrow.
  // Tap the planted column's lower cube: the Codo's bounding-box centre
  // is the inner corner of its L, where a tap can slip through the notch.
  // The camera eases into the player's view after Begin Game, so if it's
  // still moving, re-measure and tap again until the arrow appears.
  let arrows = { cw: null, ccw: null };
  for (let attempt = 0; attempt < 4 && !arrows.ccw; attempt++) {
    const codoPos = await page.evaluate(() => window.__EC_TEST_CUBE_POS__(4, 4, 0));
    await page.mouse.click(codoPos.x, codoPos.y);
    await page.waitForTimeout(900);
    arrows = await page.evaluate(() => ({ cw: window.__EC_TEST_PIVOT_ARROW_POS__("pivot-cw"), ccw: window.__EC_TEST_PIVOT_ARROW_POS__("pivot-ccw") }));
  }
  check("selecting the balanced Codo shows a curved arrow only for the way it can turn", !arrows.cw && !!arrows.ccw, JSON.stringify(arrows));
  const pivotBadge = (await page.evaluate(() => window.__EC_TEST_COST_BADGES__())).find((b) => b.dir === "pivot-ccw");
  check("the pivot arrow carries a cost badge (1 point)", pivotBadge && pivotBadge.text === "1", JSON.stringify(pivotBadge));
  await page.screenshot({ path: "/tmp/e2e-pivot-arrow.png" });
  if (arrows.ccw) await page.mouse.click(arrows.ccw.x, arrows.ccw.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/e2e-pivot-mid.png" });
  await page.waitForTimeout(1000);
  const quarter = await codoOf(page);
  check("counter-clockwise turns it a quarter turn: arm now held over the square to the north",
    same(quarter, { row: 3, col: 4, w: 1, h: 2, vox: "0,0,1;0,1,0;0,1,1" }), JSON.stringify(quarter));
  const ps = await page.evaluate(() => window.__EC_TEST_PIECES__);
  check("the enemy Cabeza under the arm is sheltered, not crushed", ps.some((p) => p.id === "light-cabeza-1" && p.row === 3 && p.col === 4));
  await page.screenshot({ path: "/tmp/e2e-pivot-quarter.png" });

  // ---- 1b. turning back costs nothing: the turn rewinds ----
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-codo", "pivot-cw"));
  await page.waitForTimeout(1400);
  check("pivoting back puts it where it started", same(await codoOf(page), BALANCED), JSON.stringify(await codoOf(page)));
  check("...and refunds the point: the Codo stays selected with both rolls left, nothing logged, no turn in progress",
    /2 rolls left/i.test(await statusText(page)) && (await page.evaluate(() => (window.__EC_TEST_LOG__ || []).length)) === 0 &&
      (await page.locator("button", { hasText: /^Undo move$/ }).count()) === 0,
    await statusText(page));

  // ---- 1c. the swipe: across the arm, the way it should turn ----
  // Start on the Codo and swipe toward where the counter-clockwise arrow
  // curves (its midpoint is across the arm, on that side).
  // (Still selected after the refund, so its arrows are up.)
  // Start the swipe on the arm itself (grab the arm and swing it).
  const start = await page.evaluate(() => window.__EC_TEST_CUBE_POS__(4, 5, 1));
  const target = await page.evaluate(() => window.__EC_TEST_PIVOT_ARROW_POS__("pivot-ccw"));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(start.x + ((target.x - start.x) * 1.4 * i) / 8, start.y + ((target.y - start.y) * 1.4 * i) / 8);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
  check("swiping across the arm pivots it that way round",
    same(await codoOf(page), { row: 3, col: 4, w: 1, h: 2, vox: "0,0,1;0,1,0;0,1,1" }), JSON.stringify(await codoOf(page)));

  // ---- 2. undo ----
  // Undo move lives in the menu dock, which folds away during play.
  await openDockPanel(page);
  await page.locator("button", { hasText: /^Undo move$/ }).click();
  await page.waitForTimeout(1600);
  check("Undo move turns it back to where it started", same(await codoOf(page), BALANCED), JSON.stringify(await codoOf(page)));

  // ---- 3. a half turn: two quarter turns in one turn ----
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-codo", "pivot-ccw"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-codo", "pivot-ccw"));
  await page.waitForTimeout(1600);
  const half = await codoOf(page);
  check("two counter-clockwise quarter turns make a half turn: arm now to the west",
    same(half, { row: 4, col: 3, w: 2, h: 1, vox: "0,0,1;1,0,0;1,0,1" }), JSON.stringify(half));
  const log = await page.evaluate(() => window.__EC_TEST_LOG__ || []);
  check("the move log records both quarter turns", log.length === 1 && /pivot-ccw\.pivot-ccw/.test(log[0].notation), JSON.stringify(log));
  check("the half turn used the whole turn (Light to move)", /light to move/i.test(await statusText(page)), await statusText(page));

  // ---- 5. rolling out and back costs nothing either ----
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "E"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "W"));
  await page.waitForTimeout(1400);
  const tu = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-turrito");
  check("a Turrito rolled east then back west is where it started, with both rolls still to spend",
    tu.row === 5 && tu.col === 5 && tu.z === 2 && /2 rolls left/i.test(await statusText(page)) &&
      (await page.evaluate(() => (window.__EC_TEST_LOG__ || []).length)) === 1,
    JSON.stringify(tu) + " " + (await statusText(page)));
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "E"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-turrito", "E"));
  await page.waitForTimeout(1400);
  check("...and two more rolls then end the turn", /dark to move/i.test(await statusText(page)), await statusText(page));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 4. the AI plays with the law on ----
{
  const { page, errs } = await openPage();
  await openDockPanel(page);
  const aiBtn = page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).first();
  if (await aiBtn.count()) { await aiBtn.click(); await page.waitForTimeout(300); }
  const easy = page.locator('[data-testid="dock-panel"] button', { hasText: /^Easy$/i }).first();
  if (await easy.count()) { await easy.click(); await page.waitForTimeout(200); }
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Begin Game" }).click();
  let turns = [];
  for (let i = 0; i < 40 && !turns.length; i++) {
    await page.waitForTimeout(400);
    turns = await page.evaluate(() => window.__EC_TEST_TURNS__ || []);
  }
  check("the AI (Dark) completed a turn with the pivot law on", turns.length > 0 && turns[0].player === "dark", JSON.stringify(turns[0]));
  const codo = await codoOf(page);
  check("its Codo still has its 3 cubes", !!codo && codo.vox.split(";").length === 3, JSON.stringify(codo));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nCANTILEVER PIVOT E2E PASSED" : `\nCANTILEVER PIVOT E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
