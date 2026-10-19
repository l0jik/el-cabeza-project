/* The frame-rate governor in the pages (user: "We need to see how we can
   make the animations run more smoothly for low capability machines";
   chassis/device-fit.js). The software renderer here is a slow machine
   on every frame, so with the governor's full relief asked for
   (__EC_TEST_FIT__; the other tests keep only the pixel ratio moving): a
   world governed by the chassis (Futuris) and one that makes its own
   (the store) each come down to the pixel ratio's floor, the shadow map
   halved to 512 and the frames held to 30 a second (the ?fps readout
   says so); where they settled is kept in localStorage and a reload
   starts there. The move markers' shaders are compiled before the first
   piece is picked.

   node tests/e2e-device-fit.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

async function world(name, key) {
  console.log(`\n[${name}]`);
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_FIT__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; try { localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${name}.html?fps&quality=low`);
  // A slow phone whatever runs this: the page's own thread at a quarter of
  // its speed, so every frame's over the governor's mark (a faster CI
  // runner drew 43 a second at the floor, just under it, and the shadow
  // map was never halved).
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const readout = () => page.evaluate(() => (document.querySelector('[data-testid="fps-readout"]') || {}).textContent || "");
  const shadow = () => page.evaluate(() => { const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__(); const k = t && t.lights && t.lights.key; return k ? k.shadow.mapSize.x : null; });
  let text = "";
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(1000); text = await readout(); if (/held to 30/.test(text) && (await shadow()) === 512) break; }
  check("slow on every frame: down to the floor (×0.85 at the low tier), the shadow map 512, held to 30", /×0\.85\s+low\s+held to 30/.test(text) && /shadows 512/.test(text) && (await shadow()) === 512, text.replace(/\n/g, " | "));
  // (The readout's count is of the second before it, which the first
  // "held to 30" shares with frames before the hold: two seconds more.)
  await page.waitForTimeout(2200);
  const now = await readout();
  const fps = Number((/^(\d+) fps/.exec(now) || [])[1]);
  check("...no more than 30 frames a second", /held to 30/.test(now) && fps > 0 && fps <= 31, now.replace(/\n/g, " | "));
  await page.waitForTimeout(1300);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:fit") || "{}"));
  check("...kept for the next visit, by tier and world", kept[`low|${key}`] && kept[`low|${key}`].pr === 0.85 && kept[`low|${key}`].shadow === 512 && kept[`low|${key}`].paced === true, JSON.stringify(kept));
  // (Its own speed again: what's read now is only what was kept.)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.reload();
  await page.waitForTimeout(2500);
  text = await readout();
  check("a reload starts where it settled", /×0\.85\s+low\s+held to 30/.test(text) && (await shadow()) === 512, text.replace(/\n/g, " | "));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await world("futuris", "futuris");
await world("tienda", "tienda");

// The markers' shaders, compiled before they're needed.
{
  console.log("\n[the markers' shaders]");
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  const page = await ctx.newPage();
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  // (They're compiled when the page is first idle, within 6 s.)
  await page.waitForTimeout(8000);
  const programs = () => page.evaluate(() => window.__EC_TEST_THREE__().renderer.info.programs.length);
  const before = await programs();
  await openDockPanel(page);
  await page.waitForTimeout(600);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click({ force: true });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(2000);
  const side = await page.evaluate(() => window.__EC_TEST_TO_MOVE__());
  const id = await page.evaluate((s) => (window.__EC_TEST_PIECES__.find((p) => p.owner === s && p.type === "opa") || {}).id, side);
  const at = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(2500);
  const markers = await page.evaluate(() => window.__EC_TEST_THREE__().ghostGroup.children.length);
  const after = await programs();
  check("a piece picked: its markers drawn with shaders already compiled", markers > 0 && after === before, JSON.stringify({ before, after, markers }));
  await ctx.close();
}

await browser.close();
console.log(`\ndevice fit: ${checks} checks, ${fails} failed`);
if (fails) { console.log("DEVICE FIT E2E FAILED"); process.exit(1); }
