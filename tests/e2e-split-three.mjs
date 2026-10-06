/* Split Movement, 3 Pieces (user: a three-piece limit as its own choice
   in the game setup; with 3 actions, a point a piece). With it on, a
   player rolls three different pieces once each in one turn: the turn
   stays theirs after the first and second, and passes after the third.
   With the two-piece Split Movement, a third piece can't join (the turn
   ends after two pieces, a point unused). Laws set at boot
   (window.__EC_LAWS__, apps/boardBootstrap.js); moves made through
   __EC_TEST_MOVE__, the same path a tap on a marker takes. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };

async function play(laws) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; }, laws);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.waitForTimeout(1500);
  const state = () => page.evaluate(() => ({ pieces: window.__EC_TEST_PIECES__.map((p) => ({ id: p.id, owner: p.owner, type: p.type, row: p.row, col: p.col })), log: (window.__EC_TEST_TURNS__ || []).length }));
  // Dark moves first: three different block pieces, one roll each.
  const start = await state();
  const movers = start.pieces.filter((p) => p.owner === "dark" && p.type !== "cabeza" && p.type !== "opa").map((p) => p.id);
  const moved = [], refused = [];
  for (const id of movers) {
    if (moved.length === 3) break;
    for (const dir of ["S", "N", "E", "W"]) {
      const before = await state();
      if (before.log > start.log) break; // the turn's over
      const was = before.pieces.find((p) => p.id === id);
      // Mid-turn, hand it the turn's points first, as a tap on it does
      // (where the piece limit says no).
      if (moved.length) {
        const ok = await page.evaluate((i) => window.__EC_TEST_SPLIT_TO__(i), id);
        if (!ok) { refused.push(id); break; }
        await page.waitForTimeout(250);
      }
      await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
      const after = await poll(async () => { const s = await state(); const p = s.pieces.find((q) => q.id === id); return p && (p.row !== was.row || p.col !== was.col) ? s : null; }, 2500);
      if (after) { moved.push(id); await page.waitForTimeout(900); break; }
    }
  }
  const end = await poll(async () => { const s = await state(); return s.log > start.log ? s : null; }, 6000);
  const result = { moved, refused, turnEnded: !!end, errs };
  await page.close();
  return result;
}

console.log("Split Movement, 3 Pieces (with 3 actions)");
const three = await play({ splitThree: true, threeActions: true });
check("three different pieces each roll once in one turn", three.moved.length === 3, JSON.stringify(three.moved));
check("...and the turn passes after the third", three.turnEnded);
check("no page errors", three.errs.length === 0, three.errs.join(" | "));

console.log("Split Movement (two pieces, with 3 actions)");
const two = await play({ splitMovement: true, threeActions: true });
check("a third piece can't join: two pieces move, a third is refused", two.moved.length === 2 && two.refused.length > 0, JSON.stringify(two));
check("no page errors", two.errs.length === 0, two.errs.join(" | "));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
