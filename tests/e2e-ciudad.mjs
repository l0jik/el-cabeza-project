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
   - A building onto a crane's square takes it: that crane gone, the other
     still standing.
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
  // (the night as it goes, noted in the page: on a slow machine a click alone outlasts the change)
  await T(() => { window.__nights = []; window.__noting = setInterval(() => window.__nights.push(window.__CIUDAD_TIME__.get().night), 40); });
  await chip.click();
  await page.locator('[data-testid="ciudad-time-night"]').click();
  check("10 PM picked", (await page.locator('[data-testid="ciudad-time"]').getAttribute("data-time")) === "night");
  check("the list away after the pick", (await opts.count()) === 0);
  const done = await poll(() => T(() => { const s = window.__CIUDAD__.now(); return s.night === 1 && s; }), 6000);
  check("night all the way up", !!done && done.exposure === 1.2, JSON.stringify(done));
  const nights = await T(() => { clearInterval(window.__noting); return window.__nights; });
  check("the city eased into it (the night part way up on the way)", nights.some((v) => v > 0.05 && v < 0.95), JSON.stringify(nights.slice(0, 12)));
  check("the lamps lit", await T(() => { const o = window.__EC_TEST_THREE__().scene.getObjectByName("ciudad-lamp-heads"); return !!o && o.visible && o.material.opacity > 0.9; }));
  await page.waitForTimeout(400);
  const night = await light();
  check("the picture darker by night", night.mean < day.mean * 0.6, `day ${day.mean.toFixed(1)} night ${night.mean.toFixed(1)}`);
  check("lit windows and lamps in it (a lamp's warm light)", night.warm > 0.003, `night ${night.warm.toFixed(4)}`);
  await chip.click();
  await page.locator('[data-testid="ciudad-time-afternoon"]').click();
  const back = await poll(() => T(() => { const s = window.__CIUDAD__.now(); return s.night === 0 && !window.__CIUDAD_TIME__.get().changing && s; }), 6000);
  check("Afternoon: the night gone again", !!back);
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
  // a building onto the first crane's square
  const [r, c] = L.cranes[0];
  await T(([r, c]) => window.__EC_TEST_SET_PIECES__(window.__EC_TEST_PIECES__.map((p) => (p.id === "dark-turrito" ? { ...p, row: r, col: c } : p))), [r, c]);
  const after = await poll(() => T(() => { const q = window.__CIUDAD__.lots(); return q.cranes.length === 1 && q; }), 4000);
  check("a building on its square: that crane gone", !!after);
  check("the other still standing", !!after && after.cranes[0][0] === L.cranes[1][0] && after.cranes[0][1] === L.cranes[1][1]);
  check("its lot gone with it", !!after && !after.lots.some((l) => l.row === r && l.col === c));
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
