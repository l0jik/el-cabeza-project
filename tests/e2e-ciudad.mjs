/* Ciudad: the game in the city of the glass towers and cranes, at the
   time of day the player picks (user: "implement city as it currently is.
   Maybe just have a toggle switch to switch between the different times
   of day ... they can basically play in that city and change the time of
   day that they're playing").

   - The time switch: a street sign at the top right naming the hour
     (Morning to start); a tap opens the five times, a pick eases the city
     into it; Escape or a tap outside puts the list away.
   - The hour kept: picked once, there again after a reload; ?time= in the
     address goes straight to one.
   - 10 PM is night: the night all the way up, the lamps lit, the picture
     darker overall and with warm lit windows in it; a day hour after puts
     them out again.
   - The free blocks: lots laid out; two cranes on the free squares
     farthest from the pieces, each its own height; a steel frame going up.
   - A building onto a lot's block takes it, and the lot goes on
     elsewhere (user: "that same piece that gets run over needs to
     reappear somewhere else on the map"): a crane's to the free block
     farthest from the pieces, the other crane still standing; a park to a
     free block a square clear of them, its trees with it; as many lots as
     before, grown up on their new blocks.
   - The traffic and the people there.
   - Nothing thrown.

   node tests/e2e-ciudad.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL_ = "file:///home/user/el-cabeza-project/dist/el-cabeza-ciudad.html";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const T = (fn, a) => page.evaluate(fn, a);
async function load(q = "") {
  await page.goto(URL_ + q);
  await poll(() => T(() => !!window.__EC_TEST_CAM__ && !!window.__CIUDAD__), 30000, 250);
  await page.waitForTimeout(800);
}
async function begin() {
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  return !!(await poll(() => T(() => window.__EC_TEST_ARMED__ === true), 15000, 250));
}
// The picture's light: its mean luminance, and how many of its pixels are a lit window's warm light.
const light = () => T(() => {
  const t = window.__EC_TEST_THREE__(), r = t.renderer, gl = r.getContext();
  r.render(t.scene, t.camera);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, warm = 0, n = 0;
  for (let i = 0; i < px.length; i += 4 * 7) { const R = px[i], G = px[i + 1], B = px[i + 2]; sum += 0.3 * R + 0.59 * G + 0.11 * B; n++; if (R > 170 && G > 120 && R > B + 50) warm++; }
  return { mean: sum / n, warm: warm / n };
});

// a fresh player: no hour kept
await load();
await T(() => { try { localStorage.removeItem("elcabeza.ciudad.time"); } catch (e) { /* */ } });
await load();

console.log("The time switch");
{
  const chip = page.locator('[data-testid="ciudad-time-chip"]');
  check("the sign is there, on Morning", (await chip.count()) === 1 && (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "morning");
  check("it names the hour", /morning/i.test((await chip.getAttribute("aria-label")) || ""));
  check("a game begun", await begin());
  await chip.click();
  const opts = page.locator('[data-testid^="ciudad-time-"][role="radio"]');
  check("five times to pick from", (await opts.count()) === 5);
  check("Morning ticked", (await page.locator('[data-testid="ciudad-time-morning"]').getAttribute("aria-checked")) === "true");
  await page.keyboard.press("Escape");
  check("Escape puts the list away", !!(await poll(async () => (await opts.count()) === 0, 2000)));
  await chip.click();
  await page.mouse.click(550, 380);
  check("a tap outside puts it away", !!(await poll(async () => (await opts.count()) === 0, 2000)));
  const day = await light();
  // (the night as each frame draws it, noted by the city itself: on the
  // software renderer a frame takes half a second, the change is drawn in
  // three or four, and a timer's samples between such frames are starved)
  await T(() => { window.__CIUDAD_TRACE__ = []; });
  await chip.click();
  await page.locator('[data-testid="ciudad-time-night"]').click();
  check("10 PM picked", (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "night");
  check("the dial stays, to watch the hands go round", (await opts.count()) === 5);
  const done = await poll(() => T(() => { const s = window.__CIUDAD__.now(); return s.night === 1 && s; }), 6000);
  check("night all the way up", !!done && done.exposure === 1.2, JSON.stringify(done));
  const hands = await poll(() => T(() => { const t = (s) => (document.querySelector(s) || { getAttribute: () => "" }).getAttribute("transform") || ""; const a = t(".ciu-time .clock .face .hh"), c = t('[data-testid="ciudad-time-chip"] .face .hh'); return /rotate\(300\.00 /.test(a) && /rotate\(300\.00 /.test(c) && [a, c]; }), 3000);
  check("...the hands gone round to ten, on the dial and the sign", !!hands, JSON.stringify(hands));
  await page.keyboard.press("Escape");
  check("...and Escape puts the dial away", !!(await poll(async () => (await opts.count()) === 0, 2000)));
  const nights = await T(() => { const n = window.__CIUDAD_TRACE__; window.__CIUDAD_TRACE__ = null; return n; });
  check("the city eased into it (a frame drawn with the night part way up)", nights.some((v) => v > 0.05 && v < 0.95), JSON.stringify(nights.filter((v, i, a) => i === 0 || v !== a[i - 1]).slice(0, 12)));
  check("the lamps lit", await T(() => { const o = window.__EC_TEST_THREE__().scene.getObjectByName("ciudad-lamp-heads"); return !!o && o.visible && o.material.opacity > 0.9; }));
  await page.waitForTimeout(400);
  const night = await light();
  check("the picture darker by night", night.mean < day.mean * 0.6, `day ${day.mean.toFixed(1)} night ${night.mean.toFixed(1)}`);
  check("lit windows and lamps in it (a lamp's warm light)", night.warm > 0.003, `night ${night.warm.toFixed(4)}`);
  await chip.click();
  await page.locator('[data-testid="ciudad-time-afternoon"]').click();
  const back = await poll(() => T(() => { const s = window.__CIUDAD__.now(); return s.night === 0 && !window.__CIUDAD_TIME__.get().changing && s; }), 6000);
  check("Afternoon: the night gone again", !!back);
  await page.keyboard.press("Escape");
  check("the lamps out", await T(() => !window.__EC_TEST_THREE__().scene.getObjectByName("ciudad-lamp-heads").visible));
}

console.log("The free blocks");
{
  const L = await T(() => window.__CIUDAD__.lots());
  const pieces = await T(() => window.__EC_TEST_PIECES__);
  check("lots laid out", L.lots.length >= 12, `${L.lots.length}`);
  check("two cranes", L.cranes.length === 2, JSON.stringify(L.cranes));
  const heights = L.lots.filter((l) => l.crane).map((l) => l.crane);
  check("each its own height", heights.length === 2 && Math.abs(heights[0] - heights[1]) > 0.3, JSON.stringify(heights));
  check("a steel frame going up", L.lots.some((l) => l.type === "frame"));
  // as far from the pieces as any free square (the nearest piece's square counts)
  const cells = []; for (const p of pieces) for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) cells.push([r, c]);
  const dist = (r, c) => Math.min(...cells.map(([a, b]) => Math.hypot(a - r, b - c)));
  const taken = new Set(cells.map((q) => q.join(",")));
  let farthest = 0; for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (!taken.has(`${r},${c}`)) farthest = Math.max(farthest, dist(r, c));
  check("the first crane on a square as far from the pieces as any", Math.abs(dist(...L.cranes[0]) - farthest) < 1e-6, `${dist(...L.cranes[0])} vs ${farthest}`);
  check("the cranes apart", Math.hypot(L.cranes[0][0] - L.cranes[1][0], L.cranes[0][1] - L.cranes[1][1]) >= 4);
  // a building onto the first crane's square: the crane goes on, as far
  // from the pieces as any free block, the other standing
  const [r, c] = L.cranes[0], craneH = L.lots.find((l) => l.row === r && l.col === c).crane;
  await T(([r, c]) => window.__EC_TEST_SET_PIECES__(window.__EC_TEST_PIECES__.map((p) => (p.id === "dark-turrito" ? { ...p, row: r, col: c } : p))), [r, c]);
  const after = await poll(() => T(([r, c]) => { const q = window.__CIUDAD__.lots(); return !q.lots.some((l) => l.row === r && l.col === c) && q; }, [r, c]), 4000);
  check("a building on a crane's square: the lot gone from under it", !!after);
  const moved = after && after.lots.find((l) => l.crane && l.moves === 1);
  check("...and the same crane on another block", !!moved && Math.abs(moved.crane - craneH) < 1e-6 && after.cranes.length === 2 && !(moved.row === r && moved.col === c), JSON.stringify(after && after.cranes));
  check("the other still standing", !!after && after.cranes.some(([a, b]) => a === L.cranes[1][0] && b === L.cranes[1][1]));
  check("as many lots as before", !!after && after.lots.length === L.lots.length, `${L.lots.length} -> ${after && after.lots.length}`);
  {
    const ps = await T(() => window.__EC_TEST_PIECES__);
    const cells2 = []; for (const p of ps) for (let y = p.row; y < p.row + p.h; y++) for (let x = p.col; x < p.col + p.w; x++) cells2.push([y, x]);
    const cov = new Set(cells2.map((q) => q.join(","))), lotsAt = new Set((after ? after.lots : []).filter((l) => l !== moved).map((l) => `${l.row},${l.col}`));
    const d2 = (y, x) => Math.min(...cells2.map(([a, b]) => Math.hypot(a - y, b - x)));
    let far = 0; for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (!cov.has(`${y},${x}`) && !lotsAt.has(`${y},${x}`)) far = Math.max(far, d2(y, x));
    check("...on a free block as far from the pieces as any", !!moved && !cov.has(`${moved.row},${moved.col}`) && Math.abs(d2(moved.row, moved.col) - far) < 1e-6, moved ? `${d2(moved.row, moved.col)} vs ${far}` : "");
  }
  check("...grown up there", !!(await poll(() => T(() => window.__CIUDAD__.lots().lots.every((l) => l.grown)), 6000)));
  // then onto a park: the same park, its trees with it, on a free block a
  // square clear of every piece
  const before = await T(() => window.__CIUDAD__.lots());
  const park = before.lots.find((l) => l.type === "park" && l.trees > 0 && l.moves === 0);
  check("a park to try", !!park);
  if (park) {
    await T(([r, c]) => window.__EC_TEST_SET_PIECES__(window.__EC_TEST_PIECES__.map((p) => (p.id === "dark-turrito" ? { ...p, row: r, col: c } : p))), [park.row, park.col]);
    const after2 = await poll(() => T(([r, c]) => { const q = window.__CIUDAD__.lots(); return !q.lots.some((l) => l.row === r && l.col === c) && q; }, [park.row, park.col]), 4000);
    const p2 = after2 && after2.lots.find((l) => l.type === "park" && l.moves === 1);
    check("a building on a park: the same park on another block, its trees with it", !!p2 && p2.trees === park.trees && after2.lots.length === before.lots.length, JSON.stringify(p2));
    const ps = await T(() => window.__EC_TEST_PIECES__);
    const cells3 = []; for (const p of ps) for (let y = p.row; y < p.row + p.h; y++) for (let x = p.col; x < p.col + p.w; x++) cells3.push([y, x]);
    const clear = p2 && Math.min(...cells3.map(([a, b]) => Math.max(Math.abs(a - p2.row), Math.abs(b - p2.col))));
    check("...a square clear of every piece", !!p2 && clear >= 2, `${clear}`);
    check("...grown up there", !!(await poll(() => T(() => window.__CIUDAD__.lots().lots.every((l) => l.grown)), 6000)));
  }
}

console.log("The streets alive");
{
  const life = await T(() => window.__CIUDAD__.life());
  check("cars and buses", life.cars > 50 && life.buses > 0, JSON.stringify(life));
  check("people", life.people > 50);
  check("cars on the board's own streets", life.boardCars > 5);
}

console.log("The hour kept");
{
  await load();
  check("after a reload, still Afternoon", (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "afternoon");
  await load("?time=golden");
  check("?time=golden: Golden Hour", (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "golden" && /golden/i.test(await page.locator('[data-testid="ciudad-time-chip"]').innerText()));
  const L = await T(() => window.__CIUDAD__.lots());
  check("a new game's lots: two cranes again", L.cranes.length === 2);
}

console.log("Nothing thrown");
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
