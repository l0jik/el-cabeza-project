/* The floors' seams, closed (user, the story's store: "the floor has some
   Z fighting where there's some light lines with on the floor ... If you
   move the screen around, you'll kind of see it flicker too"). Nothing
   overlapped there: the lines were cracks. Where the store's tan aisles
   met the tiled squares, a corner of one piece lay partway along another
   piece's edge (a T-junction); a GPU rounds the two edges a little
   differently, and the fog-coloured background showed through, flickering
   as the camera moved. The den's carpet, round the pit, was laid the same
   way. Both are now grids, each piece meeting the next corner to corner
   (themes/tienda-store.js, themes/den-room.js).

   Here, in the story's store and in the den: every wide surface facing up
   (the floors), every flat face at its height taken together, and no
   corner of one lying inside another's open edge.

   node tests/e2e-floor-seams.mjs */
import { chromium } from "playwright";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 30000) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, 200)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });

// Every wide, upward, solid surface in the scene, by height: its triangles,
// and its T-junctions (a corner inside an edge that only one triangle has).
const seams = (page) => page.evaluate(() => {
  const { scene } = window.__EC_TEST_THREE__();
  scene.updateMatrixWorld(true);
  const byY = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || mat.transparent || mat.depthWrite === false) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    const a = new o.position.constructor(), b = a.clone(), c = a.clone(), e1 = a.clone(), e2 = a.clone();
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      if (Math.abs(a.y - b.y) > 0.002 || Math.abs(a.y - c.y) > 0.002) continue;
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
      const len = e1.length();
      if (len < 1e-6 || e1.y / len < 0.999) continue;
      const y = a.y.toFixed(2);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push([[a.x, a.z], [b.x, b.z], [c.x, c.z]]);
    }
  });
  const K = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const out = [];
  for (const [y, tris] of byY) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const t of tris) for (const p of t) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    // (A floor: wide both ways, and most of the ground under it covered;
    // not a shelf, a rim or a sofa's base, thin strips round something.)
    let area = 0;
    for (const [p, q, r] of tris) area += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
    const cover = area / Math.max(1e-6, (x1 - x0) * (z1 - z0));
    if (Math.min(x1 - x0, z1 - z0) < 60 || cover < 0.6) continue;
    const edges = new Map(), verts = new Map();
    for (const t of tris) for (let i = 0; i < 3; i++) {
      const p = t[i], q = t[(i + 1) % 3];
      verts.set(K(p), p);
      const k = K(p) < K(q) ? `${K(p)}|${K(q)}` : `${K(q)}|${K(p)}`;
      const e = edges.get(k) || { p, q, n: 0 };
      e.n++;
      edges.set(k, e);
    }
    const V = [...verts.values()], at = [];
    let tj = 0;
    for (const e of edges.values()) {
      if (e.n !== 1) continue;
      const dx = e.q[0] - e.p[0], dz = e.q[1] - e.p[1], L = Math.hypot(dx, dz);
      if (L < 0.02) continue;
      for (const v of V) {
        const along = ((v[0] - e.p[0]) * dx + (v[1] - e.p[1]) * dz) / L;
        if (along < 0.01 || along > L - 0.01) continue;
        const off = Math.abs((v[0] - e.p[0]) * dz - (v[1] - e.p[1]) * dx) / L;
        if (off > 0.001) continue;
        tj++;
        if (at.length < 4) at.push(v.map((x) => +x.toFixed(1)));
      }
    }
    out.push({ y: +y, triangles: tris.length, span: [Math.round(x1 - x0), Math.round(z1 - z0)], cover: +cover.toFixed(2), tj, at });
  }
  return out;
});

async function visit(label, seed, ready) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      localStorage.setItem("el-cabeza:first-game-tour", "done");
      if (seed) localStorage.setItem("el-cabeza:story", JSON.stringify(seed));
    } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  check(`${label}: there`, !!(await ready(page)));
  await page.waitForTimeout(1500);
  const floors = await seams(page);
  check(`${label}: its floors found (${floors.map((f) => `y ${f.y}, ${f.triangles} triangles, ${f.span.join(" x ")}, ${Math.round(f.cover * 100)}% covered`).join("; ")})`, floors.length > 0);
  for (const f of floors) check(`${label}: the floor at y ${f.y} has no T-junctions (${f.tj})`, f.tj === 0, JSON.stringify(f.at));
  check(`${label}: no page errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("the store");
await visit("the store", null, async (page) => {
  if (!(await poll(async () => (await page.locator('[data-testid="tienda-open-box"]').count()) > 0, 60000))) return false;
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="tienda-open-box"]').click();
  return poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0 && page.evaluate(() => !!window.__TIENDA_THREE__), 15000);
});
console.log("the den");
await visit("the den", { owned: true }, (page) => poll(() => page.evaluate(() => !!window.__DEN_THREE__), 60000));

await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
