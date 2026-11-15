/* The store's records stand clear of each other (themes/tienda-store.js:
   the record bin by the TVs, the records endcaps' racks). User, of the
   store on a laptop: "When you near the TVs, there's a table that has, I
   guess, some books on it. When you rotate the screen, you can see some,
   looks like Z fighting on the top of them."

   The sleeves stood face out in one plane, overlapping their neighbours,
   their tops at one height: two surfaces in the same place, drawn in
   turn as the view moved. Now each stands a step behind the one before.

   The store at the high tier (a laptop's: every endcap stocked), every
   record sleeve among the goods (the thin ones), each pair: no two share
   any space (their footprints, turned as they stand, and their heights).

   node tests/e2e-store-records.mjs */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const ctx = await browser.newContext({ viewport: { width: 1366, height: 657 } });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh&quality=high");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
const found = await poll(() => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
  let mesh = null;
  if (t && t.scene) t.scene.traverse((o) => { if (!mesh && o.isInstancedMesh && o.geometry.attributes.aTile) mesh = o; });
  if (!mesh) return null;
  const M = new mesh.matrix.constructor(), P = new mesh.position.constructor(), S = new mesh.position.constructor(), Q = new mesh.quaternion.constructor();
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, M);
    M.decompose(P, Q, S);
    // (A sleeve: thin across, tall and wide.)
    if (S.x < 0.5 && S.y > 5 && S.z > 5) out.push({ x: P.x, y: P.y, z: P.z, w: S.x, h: S.y, d: S.z, a: 2 * Math.atan2(Q.y, Q.w) });
  }
  return out;
}), 30000, 500);
check(`the store's record sleeves found (${found ? found.length : 0})`, !!found && found.length >= 20, JSON.stringify(found && found.slice(0, 2)));

// Two boxes turned about the upright: do they share space? (Their
// footprints by the separating axes, less a hair; their heights.)
const corners = (b) => {
  const cx = Math.cos(b.a), sx = Math.sin(b.a);
  // local x (its width w) and local z (its depth d), turned by a about y
  const ux = [cx, -sx], uz = [sx, cx];
  return { c: [b.x, b.z], axes: [ux, uz], half: [b.w / 2, b.d / 2] };
};
const overlap = (A, B) => {
  if (Math.abs(A.y - B.y) >= (A.h + B.h) / 2) return false;
  const a = corners(A), b = corners(B);
  const d = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  for (const ax of [...a.axes, ...b.axes]) {
    const ra = a.half[0] * Math.abs(ax[0] * a.axes[0][0] + ax[1] * a.axes[0][1]) + a.half[1] * Math.abs(ax[0] * a.axes[1][0] + ax[1] * a.axes[1][1]);
    const rb = b.half[0] * Math.abs(ax[0] * b.axes[0][0] + ax[1] * b.axes[0][1]) + b.half[1] * Math.abs(ax[0] * b.axes[1][0] + ax[1] * b.axes[1][1]);
    if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) >= ra + rb - 1e-4) return false;
  }
  return true;
};
if (found) {
  const pairs = [];
  for (let i = 0; i < found.length; i++) for (let j = i + 1; j < found.length; j++) if (overlap(found[i], found[j])) pairs.push([i, j]);
  check(`no two sleeves share any space (${pairs.length} pairs do)`, pairs.length === 0, JSON.stringify(pairs.slice(0, 4).map(([i, j]) => [found[i], found[j]])));
  // The record bin by the TVs (its 20, at the court's south-east corner).
  const bin = found.filter((b) => Math.abs(b.x - 52) < 13 && Math.abs(b.z - 48) < 7);
  check(`...the record bin's 20 among them, all inside the bin's depth (${bin.length})`, bin.length === 20 && bin.every((b) => b.z > 42 && b.z < 54), JSON.stringify(bin.map((b) => +b.z.toFixed(2))));
}
check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
