/* A piece you press wins over a move marker hidden behind it (user,
   2026-10-29: "Yes, fix it" — "let the piece you press win over a marker
   behind it"; chassis pick()).

   In the den, two players, Slide on, a two-cube-tall Chato picked and
   the view tilted as in play. A point on the Chato where the ray goes on
   to a marker on the board behind it (found by casting rays as the game
   does; before the fix a press there was the hidden marker's): a press
   there and a drag away light the slide's path and don't turn the board;
   dragged back, nothing moves; a click there puts the Chato down, and
   plays nothing. Markers still work: a click on one in the open rolls
   the Chato. And a piece standing on a marker's squares is still that
   move: a click on the other side's Cabeza, where the Chato's roll would
   land, crushes it.

   node tests/e2e-hidden-marker.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });

async function game(pieces) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { slide: true, threeActions: true }; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__EC_TEST_SET_PIECES__, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  // (Two players: no computer moving in between.)
  const human = page.locator('[data-opponent="human"]').first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), pieces);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game|Try a Game/ }).first().click({ force: true });
  await page.waitForTimeout(2500);
  // A player's tilted view (the test's own is straight down).
  const cam = await page.evaluate(() => window.__EC_TEST_CAM__());
  await page.evaluate((r) => window.__EC_TEST_CAM__({ phi: 0.98, radius: r * 0.82, snap: true }), cam.radius);
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
const at = (page, id) => page.evaluate((i) => { const p = window.__EC_TEST_PIECES__.find((q) => q.id === i); return p ? [p.row, p.col] : null; }, id);
const markers = (page) => page.evaluate(() => window.__EC_TEST_THREE__().ghostGroup.children.filter((g) => g.userData.kind === "ghost").length);
const view = (page) => page.evaluate(() => { const c = window.__EC_TEST_CAM__(); return [c.theta, c.phi]; });

console.log("\n[a marker hidden behind the picked Chato]");
{
  const { ctx, page, errs } = await game([
    P("dark-cabeza", "cabeza", "dark", 0, 4, 1, 1, 1), P("light-cabeza", "cabeza", "light", 9, 5, 1, 1, 1),
    P("dark-chato", "chato", "dark", 4, 4, 1, 2, 2),
  ]);
  const mid = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-chato"));
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(1200);
  check("the Chato picked: its markers out", (await markers(page)) > 0, String(await markers(page)));
  // A point on the Chato whose ray meets a marker behind it.
  const hidden = await page.evaluate(() => {
    const t = window.__EC_TEST_THREE__();
    const rect = t.renderer.domElement.getBoundingClientRect();
    const c = window.__EC_TEST_SCREEN_POS__("dark-chato");
    const ghosts = t.ghostGroup.children.filter((g) => g.userData.kind === "ghost");
    const meshes = t.pieceGroup.children.filter((g) => g.userData.kind === "piece");
    for (let dy = -90; dy <= 40; dy += 3) {
      for (const dx of [0, -5, 5]) {
        const x = c.x + dx, y = c.y + dy;
        t.pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
        t.raycaster.setFromCamera(t.pointer, t.camera);
        const p = t.raycaster.intersectObjects(meshes, false)[0];
        const g = t.raycaster.intersectObjects(ghosts, false)[0];
        if (p && p.object.userData.pieceId === "dark-chato" && g && g.distance > p.distance) return { x, y, dir: g.object.userData.dir };
      }
    }
    return null;
  });
  check(`there's a point on the Chato with a marker hidden behind it (${hidden && hidden.dir})`, !!hidden, "none found: the view hides no marker");
  if (hidden) {
    // A press there and a drag up the screen (away, over the hidden marker).
    const v0 = await view(page);
    await page.mouse.move(hidden.x, hidden.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(hidden.x, hidden.y - (140 * i) / 8);
    await page.waitForTimeout(300);
    const lit = await page.evaluate(() => window.__EC_TEST_THREE__().slideArrowGroup.visible);
    const v1 = await view(page);
    check("a press there and a drag away light the slide's path, and don't turn the board", lit && Math.abs(v1[0] - v0[0]) < 1e-3 && Math.abs(v1[1] - v0[1]) < 1e-3, JSON.stringify({ lit, v0, v1 }));
    for (let i = 7; i >= 0; i--) await page.mouse.move(hidden.x, hidden.y - (140 * i) / 8);
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(800);
    check("...dragged back and let go: nothing moves", (await at(page, "dark-chato")).join() === "4,4", JSON.stringify(await at(page, "dark-chato")));
    // A click there: the Chato put down, no hidden move played. (The
    // pointer off the board after it: resting on the Chato, its hover
    // would show its markers again.)
    await page.mouse.click(hidden.x, hidden.y);
    await page.waitForTimeout(400);
    await page.mouse.move(8, 400);
    await page.waitForTimeout(1200);
    const after = await at(page, "dark-chato");
    check("a click there puts the Chato down (its markers gone) and plays nothing (it stays on 4,4)", after.join() === "4,4" && (await markers(page)) === 0 && (await page.evaluate(() => window.__EC_TEST_TO_MOVE__())) === "dark", JSON.stringify({ after, markers: await markers(page) }));
  }
  // Markers still work: picked again, a click on one in the open.
  if (!(await markers(page))) { await page.mouse.click(mid.x, mid.y); await page.waitForTimeout(1200); }
  const east = await page.evaluate(() => window.__EC_TEST_SQUARE_POS__(4.5, 5.5));
  await page.mouse.click(east.x, east.y);
  await page.waitForTimeout(2500);
  const rolled = await at(page, "dark-chato");
  check(`a click on a marker in the open still plays it (the Chato rolled east: ${rolled})`, rolled[1] === 5, JSON.stringify(rolled));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\n[a piece standing on a marker's squares]");
{
  const { ctx, page, errs } = await game([
    P("dark-cabeza", "cabeza", "dark", 0, 0, 1, 1, 1), P("light-cabeza", "cabeza", "light", 3, 4, 1, 1, 1),
    P("dark-chato", "chato", "dark", 4, 4, 1, 2, 2),
  ]);
  const mid = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-chato"));
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(1200);
  const cab = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cabeza"));
  await page.mouse.click(cab.x, cab.y);
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) { await page.waitForTimeout(250); gone = await page.evaluate(() => !window.__EC_TEST_PIECES__.some((p) => p.id === "light-cabeza")); }
  check("a click on the other side's Cabeza, where the Chato's roll lands, crushes it", gone, JSON.stringify(await at(page, "dark-chato")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\nhidden marker: ${checks} checks, ${fails} failed`);
if (fails) { console.log("HIDDEN MARKER E2E FAILED"); process.exit(1); }
