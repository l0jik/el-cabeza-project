/* Odd shapes pressed together where they interlock (engine/shapes.js
   pressOffsets; the chassis's pressRef). User, of two Arcos lying side by
   side, one roof flickering through the other: "Press them together ...
   Each piece slides about a tenth of a square toward the other, so each
   leg sits exactly in the other's gap."

   Two Arco Chicos lying flat, each with a leg in the other's opening, in
   two worlds: drawn 0.093 toward each other (their middles 0.870 apart,
   not a square's 1.056), the squares unchanged; then one rolls away, and
   both are back on their own squares. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };

const OPEN_UP = "0,0,0;2,0,0;0,1,0;1,1,0;2,1,0"; // opening at the top middle
const OPEN_DOWN = "0,0,0;1,0,0;2,0,0;0,1,0;2,1,0"; // opening at the bottom middle
const position = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
  // Dark's leg at (row 5, col 5) stands in Light's opening; Light's at
  // (5, 4) in Dark's.
  { id: "dark-arco", type: "arcoChico", owner: "dark", row: 5, col: 3, w: 3, h: 2, z: 1, vox: OPEN_UP },
  { id: "light-arco", type: "arcoChico", owner: "light", row: 4, col: 4, w: 3, h: 2, z: 1, vox: OPEN_DOWN },
];
// Where each Arco's mesh is drawn, in the piece group's plane.
const drawn = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__();
  const at = (id) => { const m = t.pieceGroup.children.find((c) => c.userData.pieceId === id && c.userData.kind === "piece"); return m ? { x: m.position.x, z: m.position.z } : null; };
  return { dark: at("dark-arco"), light: at("light-arco") };
});

for (const world of ["futuris", "ciudad"]) {
  console.log(`\n${world}: two Arco Chicos, each leg in the other's opening`);
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${world}.html`);
  await page.waitForTimeout(2500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), position);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.waitForTimeout(1500);
  const a = await drawn(page);
  check("both drawn", !!(a.dark && a.light), JSON.stringify(a));
  if (!a.dark || !a.light) { await page.close(); continue; }
  const gap = a.light.x - a.dark.x;
  check(`pressed together: middles 0.870 apart across, not 1.056 (${gap.toFixed(3)})`, Math.abs(gap - 0.87) < 0.004, gap);
  check("...and not moved along the rows", Math.abs(a.light.z - a.dark.z - -1.056) < 0.004, JSON.stringify(a));
  const sq = await page.evaluate(() => window.__EC_TEST_PIECES__.filter((p) => /arco/.test(p.id)).map((p) => `${p.id}@${p.row},${p.col}`).join(" "));
  check("the squares are the rules' own", sq === "dark-arco@5,3 light-arco@4,4", sq);
  await page.screenshot({ path: `/tmp/e2e-press-${world}.png` });
  // One rolls away (whoever's turn it is): both back on their squares.
  const side = await page.evaluate(() => window.__EC_TEST_TO_MOVE__());
  const mover = `${side}-arco`, stay = side === "dark" ? "light" : "dark";
  const from = position.find((p) => p.id === mover);
  const rolled = await page.evaluate(([id, dir]) => window.__EC_TEST_MOVE__(id, dir), [mover, side === "dark" ? "S" : "N"]);
  check(`${side}'s Arco rolls away`, rolled);
  // (Read once the roll's recorded, not at a fixed time: the City's took
  // 2.9 s here and 5.2 s at a sixth of the speed, and CI read it at 2.2 s,
  // before it was done.)
  let moved = null;
  for (let i = 0; i < 60; i++) {
    moved = await page.evaluate((id) => window.__EC_TEST_PIECES__.find((p) => p.id === id), mover);
    if (moved && (moved.row !== from.row || moved.z !== from.z)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
  const b = await drawn(page);
  const back = b[stay].x - a[stay].x, want = stay === "dark" ? -0.093 : 0.093;
  check(`the one left behind lets go, back onto its own squares (${back.toFixed(3)})`, Math.abs(back - want) < 0.004, back);
  check("the mover stands where the roll put it", !!moved && (moved.row !== from.row || moved.z !== from.z), JSON.stringify(moved));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
