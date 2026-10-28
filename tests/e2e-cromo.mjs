/* Cromo on a phone (user, with a screenshot of a game: the PARAMETERS
   plate over the title, "the overlap on these items circled in red. And
   number two, I want to be able to change the board in this on Chromo,
   because I don't know where you select what material you're playing on
   the playing surface. It's not obvious. So if I want to switch it
   mid-game, I should be able to do that somehow."; then, the Actions dots
   blue for Steel (dark): "Action point indicator for the dark pieces in
   chromo, C-R-O-M-O, needs to reflect the color of pieces. I'm not sure
   why it's blue at this point.").

   - Rings, the dock's menu, has Surface (Tungsten or Shungite) under
     Board before a game and in play; a choice there re-dresses the board
     where it is (the slab's top, its finish), Rings staying out, and the
     setup's own switch says what it is ("Surface: ...") and follows.
   - The dark side's Actions dots glow the dark pieces' gunmetal, not the
     old blue.
   - On a narrow phone the title's badge in play keeps clear of the corner
     menu's tab (down under it where they'd meet); on a wider one, up top.

   node tests/e2e-cromo.mjs */
import { chromium } from "playwright";
import { waitForDockCorner } from "./dock-helpers.mjs";

const CROMO = "file:///home/user/el-cabeza-project/dist/el-cabeza-cromo.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const poll = async (fn, ms = 15000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};

async function cromo({ width = 390, height = 844, stone = "tungsten" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((stone) => {
    window.__EC_TEST_HOOKS__ = true;
    // (A game like the user's: five laws, a 13 by 14 board.)
    window.__EC_LAWS__ = { slide: true, shoving: true, shoveOwn: false, roll: true, punto: true };
    window.__EC_BOARD__ = { rows: 14, cols: 13 };
    try { localStorage.setItem("el-cabeza:singularity-seen", "1"); localStorage.setItem("el-cabeza:cromo-stone", stone); } catch (e) { /* none */ }
  }, stone);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(CROMO);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

// Rings as it is: out and still, its settings, the one at its point, the read-out.
const rings = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const stage = layer && layer.querySelector('[data-testid="menu-fan"]');
  if (!stage) return null;
  const focus = layer.querySelector("[data-ml-item].mf-focus");
  return {
    phase: layer.getAttribute("data-phase"),
    still: getComputedStyle(stage).opacity === "1" && stage.getAttribute("data-turning") === "false",
    keys: [...layer.querySelectorAll("[data-ml-item]")].map((n) => n.getAttribute("data-ml-item")),
    focus: focus ? focus.getAttribute("data-ml-item") : null,
    read: (layer.querySelector('[data-testid="menu-fan-read"]') || {}).textContent || "",
  };
});
const out = async (page) => { const r = await rings(page); return r && r.still ? r : null; };
async function openRings(page) {
  for (let i = 0; i < 4; i++) {
    if (await rings(page)) break;
    const b = await page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    if (await poll(() => rings(page), 2500, 100)) break;
  }
  return poll(() => out(page), 6000, 150);
}
// A setting's choices out in the read-out: Rings turned (›) till it's at
// the point, then its name tapped once Rings is still.
async function choicesOf(page, key) {
  let r = await poll(() => out(page), 4000, 100);
  for (let i = 0; i < 16 && r && r.focus !== key; i++) {
    await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-next"]').tap();
    r = await poll(() => out(page), 3000, 100);
  }
  for (let i = 0; i < 3; i++) {
    await poll(() => out(page), 4000, 100);
    const b = await page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
    if (!b) continue;
    await page.touchscreen.tap(b.x, b.y);
    const ok = await poll(async () => { const r = await rings(page); return !!r && r.focus === key && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-ctl"] [data-mf-choice]').count()) > 0; }, 3000, 100);
    if (ok) return true;
  }
  return false;
}
async function choose(page, key) {
  const c = page.locator(`[data-testid="dock-menu"] [data-mf-choice="${key}"]`);
  const b = await c.boundingBox();
  if (!b) return false;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  return true;
}
// The board's top as dressed now: Tungsten's polished metal (metalness 1,
// a thin clearcoat) or Shungite's glassy stone (0.35, a thick one).
const slabTop = (page) => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
  const slab = t && t.boardGroup && t.boardGroup.getObjectByName("ec-slab");
  const top = slab && Array.isArray(slab.material) && slab.material.find((m) => m.userData.cromoRole === "top");
  return top ? { metal: +top.metalness.toFixed(2), clear: +top.clearcoat.toFixed(2), stored: localStorage.getItem("el-cabeza:cromo-stone") } : null;
});
const isStone = (s, key) => !!s && s.stored === key && (key === "shungite" ? s.metal < 0.5 && s.clear > 0.7 : s.metal > 0.9 && s.clear < 0.3);
const setupSwitch = (page) => page.evaluate(() => (document.querySelector('[data-testid="cromo-stone"]') || {}).textContent || null);

{
  console.log("[before a game, then in play]");
  const { ctx, page, errs } = await cromo();
  check(`the board in Tungsten to begin with (${JSON.stringify(await slabTop(page))})`, isStone(await slabTop(page), "tungsten"));
  const r = await openRings(page);
  check(`Rings out from the piece before a game, Surface among its settings (${r && r.keys.join(",")})`, !!r && r.phase === "setup" && r.keys.includes("surface"));
  check("...where the stone's own button was not read twice (no bare 'Tungsten' action)", !!r && !r.keys.includes("pieces"));
  check("...its choices: Tungsten and Shungite", (await choicesOf(page, "surface")) && (await page.locator('[data-testid="dock-menu"] [data-mf-choice="tungsten"]').count()) === 1 && (await page.locator('[data-testid="dock-menu"] [data-mf-choice="shungite"]').count()) === 1);
  check("...it says what it is", /Surface/.test((await rings(page)).read) && /Tungsten/.test((await rings(page)).read), (await rings(page)).read);
  await choose(page, "shungite");
  const sh = await poll(async () => { const s = await slabTop(page); return isStone(s, "shungite") ? s : null; }, 5000, 150);
  check(`Shungite chosen: the board re-dressed where it is (${JSON.stringify(sh || await slabTop(page))})`, !!sh);
  check("...Rings still out, saying so", !!(await poll(async () => { const x = await rings(page); return x && /Shungite/.test(x.read) ? x : null; }, 3000, 150)), (await rings(page) || {}).read);
  check(`...and the setup's own switch says what it is, and follows ("${await setupSwitch(page)}")`, /^Surface: Shungite$/.test((await setupSwitch(page)) || ""));
  // Begin (Rings' big button), dark to move first, to see its dots.
  await page.evaluate(() => { const s = document.querySelector('[data-testid="turn-status"]'); if (s && s.getAttribute("data-side") !== "dark" && s.getAttribute("role") === "button") s.click(); });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').tap();
  const playing = await poll(async () => (await page.locator('[data-testid="points-counter"]').count()) > 0, 15000);
  check("Begin: in play", !!playing);
  await waitForDockCorner(page).catch(() => {});
  await page.waitForTimeout(800);
  const ember = await page.evaluate(() => { const c = document.querySelector('[data-testid="points-counter"]'); return c && { to: window.__EC_TEST_TO_MOVE__ && window.__EC_TEST_TO_MOVE__(), glow: c.style.getPropertyValue("--ec-ember").trim().toLowerCase() }; });
  check(`the Actions dots in the side's own colour: dark, the dark pieces' gunmetal (${JSON.stringify(ember)})`, !!ember && ember.to === "dark" && ember.glow === "#b7ad9c");
  // In play: the corner piece brings Rings out; Surface there too.
  const r2 = await openRings(page);
  check(`in play: Rings from the corner piece, Surface there too (${r2 && r2.keys.join(",")})`, !!r2 && r2.phase === "play" && r2.keys.includes("surface"));
  check("...its choices", await choicesOf(page, "surface"));
  await choose(page, "tungsten");
  const tu = await poll(async () => { const s = await slabTop(page); return isStone(s, "tungsten") ? s : null; }, 5000, 150);
  check(`Tungsten chosen mid-game: the board re-dressed under the game (${JSON.stringify(tu || await slabTop(page))})`, !!tu);
  check("...the game going on (still in play, Rings out)", !!(await rings(page)) && (await page.locator('[data-testid="points-counter"]').count()) > 0);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// The title's badge and the corner menu's tab, in play: clear of each other.
async function badge(width, height) {
  const { ctx, page, errs } = await cromo({ width, height });
  await openRings(page);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').tap();
  await poll(async () => (await page.locator('[data-testid="corner-menu-tab"]').count()) > 0, 15000);
  // (The badge moves into its corner 2 s in, then steps down if it must: 1.1 s.)
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
    return { tab: box(document.querySelector('[data-testid="corner-menu-tab"]')), title: box(document.querySelector(".ec-title")) };
  });
  await ctx.close();
  return { ...s, errs, apart: s.title.l >= s.tab.r + 4 || s.title.t >= s.tab.b };
}
{
  console.log("[the title's badge and the corner menu's tab]");
  const narrow = await badge(320, 700);
  check(`a narrow phone (320): the badge clear of the tab, under it (${JSON.stringify(narrow)})`, narrow.apart && narrow.title.t >= narrow.tab.b);
  const wide = await badge(430, 932);
  check(`a wide one (430): clear, and still up top beside it (${JSON.stringify(wide)})`, wide.apart && wide.title.t < wide.tab.b);
  check("no page errors", narrow.errs.length + wide.errs.length === 0, [...narrow.errs, ...wide.errs].slice(0, 3).join(" | "));
}

await browser.close();
console.log(fails ? `\nCROMO E2E FAILED (${fails} of ${checks})` : `\nall ${checks} passed`);
process.exit(fails ? 1 : 0);
