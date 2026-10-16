/* Two sets of black holes on the board (user: "add the option to increase
   the number of black hole sets to 2. When a black hole is entered ... the
   player's piece will show the exit point at ... only the 2 that are on
   the other side of the board"): a piece beside a hole shows a marker at
   each way out, the other set's one is taken by tapping it, and Undo turn
   puts the piece back. A slide into a hole shows its ways out too. With
   Exit from any hole on (user: "a toggle switch that allows them to exit
   from any of the three other black holes on the board"), a third marker
   at the other hole on the piece's own half, taken by tapping it.
     node tests/e2e-hole-sets.mjs (after npm run build) */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });
// Two mirrored pairs on 10 x 10: A (3,2)-(6,7) and B (2,6)-(7,3).
const HOLES = [{ row: 3, col: 2 }, { row: 6, col: 7 }, { row: 2, col: 6 }, { row: 7, col: 3 }];

async function setup(laws, pieces) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((l) => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = l; }, laws);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await page.waitForTimeout(1500);
  await page.evaluate((h) => window.__EC_TEST_SET_HOLES__(h), HOLES);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), pieces);
  await page.waitForTimeout(400);
  const dock = page.locator('canvas[data-testid="dock-piece-canvas"]');
  const b = await dock.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game|Try a Game/ }).click();
  await page.waitForTimeout(1500);
  return { page, errs };
}
const at = (page, id) => page.evaluate((i) => { const p = window.__EC_TEST_PIECES__.find((q) => q.id === i); return p && [p.row, p.col]; }, id);
// The move markers showing: { dir: [row, col] } of each one's square.
const markers = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__();
  const out = {};
  for (const c of t.ghostGroup.children) {
    if (c.userData.kind !== "ghost") continue;
    // (A marker's plane sits on its square's middle: undo the board's offset.)
    const sq = window.__EC_TEST_SQUARE_OF__ ? window.__EC_TEST_SQUARE_OF__(c.position) : null;
    out[c.userData.dir] = sq;
  }
  return out;
});
// Where on the screen a marker is, to tap it.
const markerPos = (page, dir) => page.evaluate((d) => {
  const t = window.__EC_TEST_THREE__();
  const hit = t.ghostGroup.children.find((c) => c.userData.kind === "ghost" && c.userData.dir === d);
  if (!hit) return null;
  const v = hit.position.clone();
  t.ghostGroup.localToWorld(v);
  v.project(t.camera);
  const r = t.renderer.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}, dir);
const tapPiece = async (page, id) => {
  const pos = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(500);
};

// A Cabeza beside A1: out of A2 (its partner) or of B2 (the other set's).
{
  const { page, errs } = await setup({ blackHoleSquares: true }, [
    P("dark-cabeza", "cabeza", "dark", 3, 1, 1, 1, 1),
    P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
    P("light-turrito", "turrito", "light", 9, 0, 1, 1, 1),
  ]);
  await tapPiece(page, "dark-cabeza");
  const m = await markers(page);
  check("two markers for the step into the hole, E and E-x", "E" in m && "E-x" in m, JSON.stringify(m));
  check("...at the two ways out on the far side: W of A2 (6,6) and W of B2 (7,2)", JSON.stringify(m.E) === "[6,6]" && JSON.stringify(m["E-x"]) === "[7,2]", JSON.stringify(m));
  const pos = await markerPos(page, "E-x");
  await page.mouse.click(pos.x, pos.y);
  const turned = await (async () => { for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); if ((await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 1) return true; } return false; })();
  check("tapping the other set's marker takes the Cabeza there, and ends the turn", turned && JSON.stringify(await at(page, "dark-cabeza")) === "[7,2]", JSON.stringify(await at(page, "dark-cabeza")));
  check("...the turn's record says which way out (E-x)", (await page.evaluate(() => JSON.stringify(window.__EC_TEST_TURNS__[0]))).includes("E-x"), await page.evaluate(() => JSON.stringify(window.__EC_TEST_TURNS__[0])));
  const d = page.locator('canvas[data-testid="dock-piece-canvas"]'); const bb = await d.boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(700);
  await page.locator('[data-testid="dock-panel"] button', { hasText: "Undo turn" }).click();
  await page.waitForTimeout(1500);
  check("Undo turn puts it back beside A1", JSON.stringify(await at(page, "dark-cabeza")) === "[3,1]", JSON.stringify(await at(page, "dark-cabeza")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// A standing Flaco beside A1 with Slide on: a slide in shows both ways out.
{
  const { page, errs } = await setup({ blackHoleSquares: true, slide: true }, [
    P("dark-cabeza", "cabeza", "dark", 0, 9, 1, 1, 1),
    P("dark-flaco", "flaco", "dark", 3, 1, 1, 1, 2),
    P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
  ]);
  await tapPiece(page, "dark-flaco");
  const m = await markers(page);
  check("a slide into the hole: a marker at each way out (slide-E, slide-E-x)", "slide-E" in m && "slide-E-x" in m && JSON.stringify(m["slide-E-x"]) === "[7,2]", JSON.stringify(m));
  const pos = await markerPos(page, "slide-E");
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(2000);
  check("...tapping the partner's marker slides it out beside A2", JSON.stringify(await at(page, "dark-flaco")) === "[6,6]", JSON.stringify(await at(page, "dark-flaco")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// Exit from any hole: the Cabeza beside A1 has a third way out, W of B1
// on its own half, its own marker; tapping it takes the Cabeza there.
{
  const { page, errs } = await setup({ blackHoleSquares: true, holeAnyExit: true }, [
    P("dark-cabeza", "cabeza", "dark", 3, 1, 1, 1, 1),
    P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
    P("light-turrito", "turrito", "light", 9, 0, 1, 1, 1),
  ]);
  await tapPiece(page, "dark-cabeza");
  const m = await markers(page);
  check("Exit from any hole: three markers for the step in, E, E-x and E-y", JSON.stringify(m.E) === "[6,6]" && JSON.stringify(m["E-x"]) === "[7,2]" && JSON.stringify(m["E-y"]) === "[2,5]", JSON.stringify(m));
  const pos = await markerPos(page, "E-y");
  await page.mouse.click(pos.x, pos.y);
  const turned = await (async () => { for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); if ((await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 1) return true; } return false; })();
  check("...tapping the third takes the Cabeza out of B1, on its own half, and ends the turn", turned && JSON.stringify(await at(page, "dark-cabeza")) === "[2,5]", JSON.stringify(await at(page, "dark-cabeza")));
  check("...the turn's record says which way out (E-y)", (await page.evaluate(() => JSON.stringify(window.__EC_TEST_TURNS__[0]))).includes("E-y"));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

// One set: as ever, one marker, no other set's way out.
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { blackHoleSquares: true, slide: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await page.waitForTimeout(1500);
  await page.evaluate((h) => window.__EC_TEST_SET_HOLES__(h), HOLES.slice(0, 2));
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    P("dark-cabeza", "cabeza", "dark", 3, 1, 1, 1, 1), P("dark-flaco", "flaco", "dark", 4, 2, 1, 1, 2),
    P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
  ]);
  await page.waitForTimeout(400);
  const dock = page.locator('canvas[data-testid="dock-piece-canvas"]');
  const b = await dock.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game|Try a Game/ }).click();
  await page.waitForTimeout(1500);
  await tapPiece(page, "dark-cabeza");
  let m = await markers(page);
  check("one set: the step into the hole has one marker, out of its partner", JSON.stringify(m.E) === "[6,6]" && !Object.keys(m).some((k) => k.endsWith("-x")), JSON.stringify(m));
  await tapPiece(page, "dark-flaco");
  m = await markers(page);
  check("...and a slide into it is still a drag, no marker", !("slide-N" in m), JSON.stringify(m));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nHOLE SETS E2E PASSED" : `\nHOLE SETS E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
