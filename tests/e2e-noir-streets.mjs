/* Noir's streets and its cars (user: "Can the grid of Noir be made to look
   like city streets appropriate to the time / theme / setting?
   Occasionally have a post-war sedan or coupe, most notably 4-door sedans
   and low-slung coupes produced by American manufacturers like Ford,
   Buick, Cadillac, Chevrolet, and Chrysler between 1935 and 1950").

   - The board is drawn as streets: down every line of the grid the dark of
     the asphalt, the walk round each block lighter (read off the board's
     own picture), and the lines themselves dashed, a lane's paint.
   - A street is closed where a building stands across it (one piece on the
     ground both sides) or by a black hole; the rest are open.
   - A car comes by on its own, one of the period's (sedan41, fastback46,
     coupe40, shoebox49, airflow37, taxi), down an open street or along the
     ring street; it keeps to its street's line, casts no shadow and takes
     no tap.
   - A car on the board goes when a piece moves.
   - Nothing thrown.

   node tests/e2e-noir-streets.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL_ = "file:///home/user/el-cabeza-project/dist/el-cabeza-noir.html";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const KINDS = ["sedan41", "fastback46", "coupe40", "shoebox49", "airflow37", "taxi"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(URL_);
await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000, 250);
await page.waitForTimeout(1500);
await openDockPanel(page);
await page.locator("button", { hasText: /Begin Game/ }).first().click();
check("a game begun", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000, 250)));
const T = (fn, a) => page.evaluate(fn, a);
check("the traffic is there", !!(await poll(() => T(() => !!window.__NOIR_TRAFFIC__), 10000)));
// no car of its own until asked
await T(() => window.__NOIR_TRAFFIC__.pace(1e9));
await page.waitForTimeout(300);
if ((await T(() => window.__NOIR_TRAFFIC__.state())).car) await poll(() => T(() => !window.__NOIR_TRAFFIC__.state().car), 30000, 300);

console.log("The board drawn as streets");
{
  // the slab's top picture: a street's middle against the walk beside it and the lot inside
  const r = await T(() => {
    const slab = window.__EC_TEST_THREE__().boardGroup.getObjectByName("ec-slab");
    const top = Array.isArray(slab.material) ? slab.material[2] : slab.material;
    const img = top.map.image, x = img.getContext("2d");
    const SQ = 1.056, MARGIN = 0.42, slabX = 10 * SQ + 2 * MARGIN, px = img.width / slabX;
    const lum = (u, v) => { const d = x.getImageData(Math.round(u) - 2, Math.round(v) - 2, 5, 5).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; return s / (d.length / 4); };
    const out = { street: [], walk: [], lot: [] };
    // lines 2, 3, 7 (not the streetcar line down the middle), half way along rows 1, 4, 6
    for (const i of [2, 3, 7]) for (const j of [1, 4, 6]) {
      const gx = (MARGIN + i * SQ) * px, gy = (MARGIN + (j + 0.5) * SQ) * px;
      out.street.push(lum(gx, gy));
      out.walk.push(lum(gx + (0.09 + 0.025) * px, gy));
      out.lot.push(lum(gx + 0.3 * px, gy + 0.15 * px));
    }
    return out;
  });
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  check(`down a line of the grid, the asphalt: darker than the walk beside it (street ${avg(r.street).toFixed(1)}, walk ${avg(r.walk).toFixed(1)})`, r.street.every((v, k) => v + 4 < r.walk[k]));
  check(`...and the walk lighter than the lot inside it too (lot ${avg(r.lot).toFixed(1)})`, avg(r.walk) > avg(r.lot) + 2);
  const grid = await T(() => { const g = window.__EC_TEST_THREE__().scene.getObjectByName("ec-grid-lines"); return g && { dashed: !!g.material.isLineDashedMaterial, distances: !!g.geometry.attributes.lineDistance }; });
  check("the grid's lines dashed down the streets", !!grid && grid.dashed && grid.distances, JSON.stringify(grid));
}

console.log("Streets closed by a building across them, or a black hole");
{
  const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });
  await T((ps) => window.__EC_TEST_SET_PIECES__(ps), [
    P("dark-cabeza", "cabeza", "dark", 8, 1, 1, 1, 1), P("light-cabeza", "cabeza", "light", 1, 8, 1, 1, 1),
    P("dark-turrito", "turrito", "dark", 6, 6, 1, 1, 1),
    P("dark-flaco", "flaco", "dark", 4, 4, 1, 2, 1), // lying across rows 4 and 5: the street between them
    P("light-flaco", "flaco", "light", 2, 1, 2, 1, 1), // across columns 1 and 2
  ]);
  await page.waitForTimeout(700);
  const c = await T(() => window.__NOIR_TRAFFIC__.closed());
  const shut = (a) => a.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  check(`a Flaco lying across a street closes it, and only it (closed: down ${JSON.stringify(shut(c.v))}, across ${JSON.stringify(shut(c.h))})`, JSON.stringify(shut(c.v)) === "[2]" && JSON.stringify(shut(c.h)) === "[5]");
  await T(() => window.__EC_TEST_SET_HOLES__([{ row: 7, col: 7 }]));
  await page.waitForTimeout(500);
  const c2 = await T(() => window.__NOIR_TRAFFIC__.closed());
  check(`a black hole closes the four streets round its square (down ${JSON.stringify(shut(c2.v))}, across ${JSON.stringify(shut(c2.h))})`, JSON.stringify(shut(c2.v)) === "[2,7,8]" && JSON.stringify(shut(c2.h)) === "[5,7,8]");
  await T(() => window.__EC_TEST_SET_HOLES__([]));
  await page.waitForTimeout(400);
}

console.log("A car comes by on its own");
{
  await T(() => window.__NOIR_TRAFFIC__.pace(200));
  const st = await poll(async () => { const s = await T(() => window.__NOIR_TRAFFIC__.state()); return s.car ? s : null; }, 20000, 200);
  check(`a car (${st && st.car.kind}, ${st && (st.car.street ? (st.car.street.vertical ? "down" : "across") + " street " + st.car.street.index : "the ring street")})`, !!st && KINDS.includes(st.car.kind) && st.car.visible);
  if (st && st.car.street) {
    const c = await T(() => window.__NOIR_TRAFFIC__.closed());
    check("...down a street that's open", !(st.car.street.vertical ? c.v : c.h)[st.car.street.index]);
  }
  check("...no shadow of its own (the shadows aren't drawn again for it), and no tap taken", !!st && st.car.castShadow === false && st.car.takesTaps === false);
  await T(() => window.__NOIR_TRAFFIC__.pace(1e9));
}

console.log("A car keeps to its street");
{
  // down street 3 (open), half way: on the street's line, on the board
  await T(() => { window.__NOIR_TRAFFIC__.spawn({ street: [true, 3], kind: "coupe40", at: 0.5 }); window.__NOIR_TRAFFIC__.freeze(true); });
  await page.waitForTimeout(300);
  const st = await T(() => window.__NOIR_TRAFFIC__.state());
  const line = 3 * 1.056 - 5.28;
  check(`half way down street 3: on its line (x ${st.car.x.toFixed(3)}, the line ${line.toFixed(3)}), on the board (z ${st.car.z.toFixed(2)})`, Math.abs(st.car.x - line) < 0.01 && Math.abs(st.car.z) < 5.7);
  // across street 6, a quarter of the way: turned in from the ring street, and on the line once on the board
  await T(() => window.__NOIR_TRAFFIC__.spawn({ street: [false, 6], kind: "sedan41", at: 0.5 }));
  await page.waitForTimeout(300);
  const st2 = await T(() => window.__NOIR_TRAFFIC__.state());
  const line2 = 6 * 1.056 - 5.28;
  check(`half way across street 6: on its line (z ${st2.car.z.toFixed(3)}, the line ${line2.toFixed(3)})`, Math.abs(st2.car.z - line2) < 0.01);
  await T(() => window.__NOIR_TRAFFIC__.freeze(false));
}

console.log("A car on the board goes when a piece moves");
{
  await T(() => window.__NOIR_TRAFFIC__.spawn({ street: [true, 9], kind: "shoebox49", at: 0.5 }));
  await page.waitForTimeout(400);
  check("a car on the board", !!(await T(() => { const s = window.__NOIR_TRAFFIC__.state(); return s.car && !s.car.leaving; })));
  const pieces = await T(() => window.__EC_TEST_PIECES__);
  let moved = false;
  for (const id of ["dark-turrito", "light-flaco", "dark-flaco"]) {
    for (const dir of ["N", "W", "S", "E"]) {
      const before = JSON.stringify(pieces.find((p) => p.id === id));
      await T(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
      const after = await poll(async () => { const p = (await T(() => window.__EC_TEST_PIECES__)).find((q) => q.id === id); return p && JSON.stringify(p) !== before ? p : null; }, 1500, 100);
      if (after) { moved = true; break; }
    }
    if (moved) break;
  }
  check("a piece moved", moved);
  const gone = await poll(async () => { const s = await T(() => window.__NOIR_TRAFFIC__.state()); return !s.car || s.car.leaving ? s : null; }, 6000, 100);
  check("...and the car went", !!gone);
}

check("nothing thrown", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
