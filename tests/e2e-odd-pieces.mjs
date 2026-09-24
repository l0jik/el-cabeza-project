/* MATTER's odd-shaped pieces — the Codo (a 3-cube L) and the Arco (an
   arch) — in the real game: Neon, where MATTER lives. Positions are placed through the test-only hooks
   (window.__EC_TEST_HOOKS__: __EC_TEST_SET_PIECES__ / __EC_TEST_MOVE__ /
   __EC_TEST_PIECES__ / __EC_TEST_SCREEN_POS__ in chassis/ElCabeza3D.jsx),
   then moves play through the same path a click uses: the roll
   animation, the commit, the turn logic, and the AI worker.

   1. A standing Codo rolls east onto its balance point with its
      overhang coming down over an enemy Cabeza: legal, and the Cabeza is
      sheltered — not crushed.
   2. An AI opponent plays a turn with Codos on the board (the worker
      thread gets the cubes and searches their moves) without errors.
   3. An Arco Chico lying flat rolls up to stand over an enemy Cabeza,
      which ends up sheltered in its opening. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const FILE = "file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html";

// Standing: two cubes on the board, one on top of the west one.
const STANDING = "0,0,0;0,0,1;1,0,0";
const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-codo", type: "codo", owner: "dark", row: 4, col: 2, w: 2, h: 1, z: 2, vox: STANDING },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-cabeza-1", type: "cabeza", owner: "light", row: 4, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-codo", type: "codo", owner: "light", row: 8, col: 2, w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" },
];

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(FILE);
  await page.waitForTimeout(1500);
  return { page, errs };
}

// ---- 1. the overhang comes down over an enemy Cabeza: sheltered ----
{
  const { page, errs } = await openPage();
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);
  const shown = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-codo"));
  check("the Codo is on the board (its mesh is drawn)", !!shown);
  const started = await page.evaluate(() => window.__EC_TEST_MOVE__("dark-codo", "E"));
  check("Dark's Codo can roll east", started);
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => window.__EC_TEST_PIECES__);
  const codo = after.find((p) => p.id === "dark-codo");
  check("it lands balanced on one cube, overhang to the east",
    codo && codo.col === 4 && codo.w === 2 && codo.z === 2 && codo.vox === "0,0,0;0,0,1;1,0,1", JSON.stringify(codo));
  check("the enemy Cabeza under the overhang is sheltered, not crushed",
    after.some((p) => p.id === "light-cabeza-1" && p.row === 4 && p.col === 5));
  const status = await page.evaluate(() => {
    const s = [...document.querySelectorAll("span")].find((el) => /to move|left|wins|won/i.test(el.textContent || ""));
    return s ? s.textContent : null;
  });
  check("the game carries on (no win declared)", !!status && /to move|left/i.test(status) && !/wins|won/i.test(status), JSON.stringify(status));
  await page.screenshot({ path: "/tmp/e2e-codo-sheltered.png" });
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 2. the AI plays with Codos on the board ----
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
  check("the AI (Dark) completed a turn with Codos on the board", turns.length > 0 && turns[0].player === "dark", JSON.stringify(turns[0]));
  const ps = await page.evaluate(() => window.__EC_TEST_PIECES__);
  check("every Codo still has its 3 cubes afterward",
    ps.filter((p) => p.type === "codo").every((p) => p.vox && p.vox.split(";").length === 3));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// ---- 3. an Arco stands up over an enemy Cabeza: sheltered in its opening ----
{
  const { page, errs } = await openPage();
  const arcoPosition = [
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
    // Lying flat as a U, top bar on row 2, legs on row 3 (opening south).
    { id: "dark-arcoChico", type: "arcoChico", owner: "dark", row: 2, col: 3, w: 3, h: 2, z: 1, vox: "0,0,0;0,1,0;1,0,0;2,0,0;2,1,0" },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
    { id: "light-cabeza-1", type: "cabeza", owner: "light", row: 4, col: 4, w: 1, h: 1, z: 1 },
  ];
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), arcoPosition);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1200);
  check("the Arco is on the board (its mesh is drawn)", !!(await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-arcoChico"))));
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-arcoChico", "S"));
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => window.__EC_TEST_PIECES__);
  const arco = after.find((p) => p.id === "dark-arcoChico");
  check("it rolls up to stand across row 4", arco && arco.row === 4 && arco.h === 1 && arco.z === 2, JSON.stringify(arco));
  check("the enemy Cabeza in its opening is sheltered, not crushed",
    after.some((p) => p.id === "light-cabeza-1" && p.row === 4 && p.col === 4));
  await page.screenshot({ path: "/tmp/e2e-arco-sheltered.png" });
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nODD-SHAPED PIECES E2E PASSED" : `\nODD-SHAPED PIECES E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
