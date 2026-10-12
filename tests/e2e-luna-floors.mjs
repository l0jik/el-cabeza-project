/* Luna's pieces are closed underneath (user's video: "You can see the
   Flaco going transparent when it rolls"). A roll tips a piece's foot up
   into view; Luna's buildings had no floor, so a roll away from you showed
   the hollow inside, the piece looking see-through. themes/luna-models.js
   planBody's bottom, on every body: the box pieces, a standing Flaco, an
   odd piece's columns and pods.

   Each piece is built on its own (window.__LUNA_BUILD__, test hooks), and
   the faces at its foot that face down are measured: they must cover most
   of the squares it stands on.

   node tests/e2e-luna-floors.mjs */
import { chromium } from "playwright";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 30000) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, 200)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-luna.html");
check("Luna's piece builder, for tests", !!(await poll(() => page.evaluate(() => typeof window.__LUNA_BUILD__ === "function"))));

// [label, piece, the squares it stands on]
const PIECES = [
  ["a Turrito", { type: "turrito", w: 1, h: 1, z: 1 }, 1],
  ["a Flaco standing", { type: "flaco", w: 1, h: 1, z: 2 }, 1],
  ["a Flaco lying", { type: "flaco", w: 1, h: 2, z: 1 }, 2],
  ["a Chato", { type: "chato", w: 1, h: 2, z: 2 }, 2],
  ["an Opa", { type: "opa", w: 2, h: 2, z: 2 }, 4],
  ["a Codo (an L of three)", { type: "codo", w: 2, h: 2, z: 1, vox: "0,0,0;1,0,0;0,1,0" }, 3],
  ["an Arco Chico (two columns and a lintel)", { type: "arcoChico", w: 3, h: 1, z: 2, vox: "0,0,0;2,0,0;0,0,1;1,0,1;2,0,1" }, 2],
];
for (const side of ["dark", "light"]) {
  for (const [label, piece, cells] of PIECES) {
    const m = await page.evaluate(([piece, side]) => {
      const b = window.__LUNA_BUILD__({ id: "floor-test", owner: side, ...piece }, side, true);
      b.updateMatrixWorld(true);
      let down = 0, minX = Infinity, maxX = -Infinity;
      const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      b.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index, e = o.matrixWorld.elements;
        const at = (i, out) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); out[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[2] = e[2] * x + e[6] * y + e[10] * z + e[14]; };
        const n = idx ? idx.count : pos.count;
        for (let t = 0; t + 2 < n; t += 3) {
          for (let k = 0; k < 3; k++) at(idx ? idx.getX(t + k) : t + k, v[k]);
          for (let k = 0; k < 3; k++) { minX = Math.min(minX, v[k][0]); maxX = Math.max(maxX, v[k][0]); }
          if (!v.every((p) => Math.abs(p[1]) < 0.006)) continue;
          const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
          const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          if (ny < 0) down += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
        }
      });
      return { down, across: maxX - minX };
    }, [piece, side]);
    const cell = m.across / piece.w, need = 0.6 * cells * cell * cell;
    check(`${side}: ${label}: closed underneath (${m.down.toFixed(3)} of ${(cells * cell * cell).toFixed(3)} sq. units faces down at its foot)`, m.down >= need, JSON.stringify(m));
  }
}
check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
