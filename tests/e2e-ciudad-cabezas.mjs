/* The City's Cabezas to try (themes/ciudad-cabezas.js, and the City Hall
   rotunda's ten, ciudad-rotundas.js; user: "Give me 10 different City
   Hall Rotunda Cabeza Piece design options"), each played with
   ?cabeza=<id>: every one is built for both sides, stands on its own
   square (inside it, on the ground) and keeps low as the disc does, lit
   at 10 PM, and nothing's thrown. The one played with no ?cabeza= is the
   glass dome (user: "The cabeza for city maps themes will be number 6,
   glass dome"), its dome wider than it was (0.4) and no taller (0.2).

   Built in one page: the address says which, and the board's pieces put
   back makes the Cabezas again (the model's kept by its kind).

   node tests/e2e-ciudad-cabezas.mjs */
import { chromium } from "playwright";

const URL_ = "file:///home/user/el-cabeza-project/dist/el-cabeza-ciudad.html";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(URL_ + "?time=night");
await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__ && !!window.__CIUDAD__), 30000, 250);
await page.waitForTimeout(1500);
const ids = await page.evaluate(() => window.__CIUDAD__.cabezas());
check(`the Cabezas to try: ${ids.length} (the pavilion, the eleven, the rotunda's ten)`, ids.length === 21 && ids.includes("pavilion") && ids.includes("capitol") && ids.includes("saucer"), JSON.stringify(ids));
const played = await page.evaluate(() => window.__CIUDAD__.cabeza());
check(`the one played with no ?cabeza=: the glass dome (${played})`, played === "glassdome");

const POSITION = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 4, col: 4, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 4, col: 6, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 1, col: 1, w: 1, h: 1, z: 1 },
];
const bad = [];
let ground = null; // (where the pavilion, the one played till now, stands: the others on the same ground)
for (const id of ids) {
  await page.evaluate((k) => history.replaceState(null, "", `?time=night&cabeza=${k}`), id);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
  await page.waitForTimeout(250);
  // (A different board each time, so the pieces are built again: then back.)
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps.map((p) => (p.type === "cabeza" ? { ...p, col: p.col + 1 } : p))), POSITION);
  await page.waitForTimeout(350);
  const r = await page.evaluate(() => {
    const t = window.__EC_TEST_THREE__(), V = t.camera.position.constructor, out = {};
    for (const side of ["dark", "light"]) {
      const m = t.pieceGroup.children.find((c) => c.userData.pieceId === `${side}-cabeza` && c.userData.kind === "piece");
      if (!m) { out[side] = null; continue; }
      m.updateMatrixWorld(true);
      const c = m.getWorldPosition(new V());
      let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], parts = 0;
      m.traverseVisible((o) => {
        const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (!pos || o.isSprite || !mats.some((q) => q && q.visible !== false && q.colorWrite !== false)) return;
        parts++;
        const e = o.matrixWorld.elements, step = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += step) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const p = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
        }
      });
      // (in the board's own scale: its square is 1 across)
      const s = t.boardGroup.getWorldScale(new V()).x;
      out[side] = { parts, half: +(Math.max(c.x - lo[0], hi[0] - c.x, c.z - lo[2], hi[2] - c.z) / s).toFixed(3), tall: +((hi[1] - lo[1]) / s).toFixed(3), foot: +((lo[1] - c.y) / s).toFixed(3) };
    }
    return out;
  });
  if (ground === null && r.dark) ground = r.dark.foot;
  const ok = ["dark", "light"].every((sd) => r[sd] && r[sd].parts > 0 && r[sd].half <= 0.5 && r[sd].tall <= 0.8 && Math.abs(r[sd].foot - ground) < 0.01);
  if (!ok) bad.push(`${id} ${JSON.stringify(r)}`);
  console.log(`   ${id.padEnd(12)} ${JSON.stringify(r)}`);
}
check("each built for both sides, inside its square, on the ground, no taller than 0.8 of a square", bad.length === 0, bad.join(" | "));
check(`nothing thrown (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
