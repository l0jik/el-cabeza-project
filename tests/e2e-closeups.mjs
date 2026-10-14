/* The pieces' close-ups (the setup menus' 3D blow-up of a piece, "drag to
   turn"), every piece in every world, turned every way: none see-through
   (user, the City's: "The Hombro is having some transparency issues ...
   I wonder how many other pieces might be having this issue as well. Not
   just in this world, but other worlds"; and "Flaco is also having the
   same or similar issue"). The City's buildings were walls with a roof:
   open beneath, so from below, or an overhang's underside, or round a
   lobby set in from the walls, they showed straight through.

   Each piece is drawn as the close-up draws it (window.__EC_TEST_LOOK_
   VIEWS__: the world's own pieces, or Neon's MATTER glass) from the side,
   from below, from underneath and upside down; and again as an opaque copy
   of its shapes. See-through: of what the copy covers, the share the real
   one leaves (nearly) empty. Luna's Cabeza is meant to be see-through (a
   glass dome over its garden).

   node tests/e2e-closeups.mjs [world ...] */
import { chromium } from "playwright";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });

const WORLDS = process.argv.slice(2).length ? process.argv.slice(2)
  : ["standard", "neon", "neon:matter", "cromo", "plano", "luna", "ciudad", "noir", "lluvia", "tienda", "lab", "parrish?look=orinoco", "parrish?look=watermark"];
const TYPES = ["cabeza", "turrito", "flaco", "chato", "opa", "block1x3", "block2x3", "codo", "arcoChico", "arcoAlto", "arcoAncho", "rayo", "zeta", "hombro", "cruce"];
// [yaw, pitch]: from the side, from below at a slant, from underneath, upside down.
const VIEWS = [];
for (const pitch of [0, -0.7, -1.45, Math.PI]) for (const yaw of [0.3, 1.9]) VIEWS.push([yaw, pitch]);
const MEANT = { "luna:cabeza": true };
const LIMIT = 0.01;

for (const w of WORLDS) {
  const [pageQ, which] = w.split(":");
  const [world, q] = pageQ.split("?");
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${D}/el-cabeza-${world}.html${q ? "?" + q : ""}`);
  const ready = await poll(() => page.evaluate(() => !!window.__EC_TEST_LOOK_VIEWS__), 30000);
  if (!ready) { check(`${w}: the close-ups can be drawn`, false); await ctx.close(); continue; }
  await page.waitForTimeout(1200);
  const worst = [];
  for (const type of TYPES) {
    const res = await page.evaluate(([t, v, which]) => (window.__EC_TEST_LOOK_VIEWS__(t, v, 140, which) || []).map((r) => r.seeThrough), [type, VIEWS, which || null]).catch((e) => ({ error: e.message }));
    if (!Array.isArray(res) || !res.length) { worst.push({ type, error: (res && res.error) || "nothing drawn" }); continue; }
    const max = Math.max(...res), at = res.indexOf(max);
    if (!MEANT[`${world}:${type}`] && max > LIMIT) worst.push({ type, max, view: VIEWS[at].map((x) => +x.toFixed(2)) });
  }
  check(`${w}: every piece solid from every side`, worst.length === 0, worst.map((x) => x.error ? `${x.type}: ${x.error}` : `${x.type} ${(x.max * 100).toFixed(1)}% at [yaw, pitch] ${x.view}`).join("; "));
  check(`${w}: no errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall close-up checks passed");
process.exit(fails ? 1 : 0);
