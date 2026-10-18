/* Other realities over Futuris's sphere (user: "I completed the story, went
   to the theme switcher, chose Futurus, played for a little bit, went to
   the sphere menu, hit the icon in the lower left corner to go back to the
   theme switcher. It went back to the theme switcher, but then it was
   stuck. It would not scroll like something was on top of it. A
   transparent layer."). The sphere's full-screen layer (2000) took every
   tap and scroll over the switcher (1600); the switcher is above it now
   (themes/realities.js).

   - In Nova after the story: the switcher, Futuris, a game, ended, New
     Game, Custom rules, the invite, the sphere.
   - The corner's Other realities (two taps): the switcher on top, what's
     under its middle and under the corner is the switcher, and the wheel
     scrolls it.
   - Escape: the sphere again, taking taps.
   - Again, and the den picked: the den comes up, the sphere gone.

   node tests/e2e-realities-over-sphere.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// (the story over in this browser: the realities open; two clicks on a slow
// machine can be seconds apart, so the corner waits longer for the second)
await ctx.addInitScript(() => {
  window.__EC_TEST_HOOKS__ = true;
  window.__EC_TEST_ARM_MS__ = 30000;
  try {
    localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true, storeGone: true, ended: true, hallDue: false }));
    ["el-cabeza:singularity-seen", "el-cabeza:special-order-noted", "el-cabeza:commercial-aired"].forEach((k) => localStorage.setItem(k, "1"));
  } catch (e) { /* none */ }
});
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
const q = (id) => p.locator(`[data-testid="${id}"]`);
const has = async (id) => (await q(id).count()) > 0;
const phase = () => p.evaluate(() => document.querySelector('[data-testid="singularity-overlay"]')?.dataset.singularityPhase || null);
// What's under a point: the nearest thing with a test id.
const under = (x, y) => p.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); const t = e && e.closest("[data-testid]"); return t ? t.getAttribute("data-testid") : e ? e.tagName : null; }, [x, y]);
const inMenu = (x, y) => p.evaluate(([px, py]) => { const m = document.querySelector('[data-testid="realities"]'); const e = document.elementFromPoint(px, py); return !!(m && e && m.contains(e)); }, [x, y]);
async function openRealities() {
  const corner = q("action-corner").first();
  await corner.click();
  await p.waitForTimeout(300);
  await corner.click();
  return !!(await poll(() => has("realities"), 8000));
}

console.log("Futuris's sphere, in Nova after the story");
await p.goto(`${D}/el-cabeza-nova.html?switcher`);
check("the switcher", !!(await poll(() => has("realities"), 25000)));
await p.waitForTimeout(1200);
await q("reality-futuris").click();
check("Futuris, behind its gate", !!(await poll(() => has("gate-standard"), 30000)));
await p.waitForTimeout(2000);
await q("gate-standard").click();
await p.waitForTimeout(2500);
// (a while played; the game ended, a new one set up, its Custom rules)
await openDockPanel(p);
await p.waitForTimeout(500);
for (let i = 0; i < 20 && (await has("end-game")); i++) { await q("end-game").first().click().catch(() => {}); await p.waitForTimeout(500); }
if (await has("new-game")) { await q("new-game").first().click(); await p.waitForTimeout(1200); }
await openDockPanel(p);
await p.waitForTimeout(600);
await q("custom-rules").first().click();
const invite = await poll(() => p.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn")), 8000);
check("Custom rules: the invite", !!invite);
const b = await p.locator(".ec-singularity-invite-btn").boundingBox();
await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await p.mouse.down(); await p.mouse.up();
check("the sphere", !!(await poll(async () => (await phase()) === "sphere", 40000, 400)), String(await phase()));
await p.waitForTimeout(1500);

console.log("Other realities from the sphere's corner");
const cornerBox = await q("action-corner").first().boundingBox();
check("the corner's Other realities is there over the sphere", !!cornerBox);
check("...two taps open the switcher", await openRealities());
await p.waitForTimeout(1200);
const z = await p.evaluate(() => ({
  menu: Number(getComputedStyle(document.querySelector('[data-testid="realities"]')).zIndex),
  sphere: Number(getComputedStyle(document.querySelector('[data-testid="singularity-overlay"]')).zIndex),
}));
check("...above the sphere's layer", z.menu > z.sphere, JSON.stringify(z));
check("...under its middle, the switcher (not the sphere)", await inMenu(640, 400), String(await under(640, 400)));
check("...the corner and the sphere's BACK under it too",
  (await inMenu(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2)) && (await inMenu(40, 30)),
  `${await under(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2)} / ${await under(40, 30)}`);
await p.mouse.move(640, 400);
await p.mouse.wheel(0, 600);
const scrolled = await poll(() => p.evaluate(() => document.querySelector('[data-testid="realities"]').scrollTop > 100), 4000);
check("...and it scrolls", !!scrolled, String(await p.evaluate(() => document.querySelector('[data-testid="realities"]').scrollTop)));

await p.keyboard.press("Escape");
await poll(async () => !(await has("realities")), 4000);
check("Escape: back to the sphere", !(await has("realities")) && (await phase()) === "sphere", String(await phase()));
check("...which takes taps again", (await under(640, 400)) === "singularity-overlay", String(await under(640, 400)));

check("Other realities again", await openRealities());
await p.waitForTimeout(1200);
await q("reality-den").click();
const den = await poll(async () => !(await has("singularity-overlay")) && (await p.evaluate(() => document.querySelector('[data-testid="reality-gate"]')?.dataset.world || null)) === "den", 30000, 300);
check("...the den picked: the den comes up, the sphere gone", !!den);
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
