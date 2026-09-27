/* Standard's den (themes/den-room.js, den-fx.js, den-audio.js):
   1. The room is built round the board: the pit's sofas, the four walls,
      the ceiling, the fire, the coffee table with the box on it, in a
      few dozen draw calls.
   2. Whatever the camera has gone behind steps aside: a sofa whose back
      is between a low camera and the board, a wall the camera is past,
      the ceiling when the camera is above it. Back in the pit, all of
      them are there again.
   3. The sound menu: The room and Pieces, each switched on its own.
   4. Nova (phone menu): Standard (the den) to Neon, where the den is
      gone, and back to Standard, where it's built again. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

{
  console.log("the den (Standard)");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  check("the room is up", await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__)));
  const scene = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    const byName = (n) => { let f = null; t.scene.traverse((o) => { if (o.name === n) f = o; }); return f; };
    let meshes = 0; t.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
    const vis = (n) => { const g = byName(n); return g ? g.visible : null; };
    return {
      groups: ["den-core", "den-wallN", "den-wallE", "den-wallS", "den-wallW", "den-ceiling", "den-sofaN", "den-sofaS", "den-sofaW", "den-table"].map((n) => [n, vis(n)]),
      meshes, fire: (() => { let n = 0; t.scene.traverse((o) => { if (o.material && o.material.isShaderMaterial && o.material.uniforms && o.material.uniforms.uTime) n++; }); return n; })(),
    };
  });
  let s = await scene();
  check("the pit's sofas, the four walls, the ceiling and the coffee table are all there", s.groups.every(([, v]) => v === true), JSON.stringify(s.groups));
  check("a fire burns in the fireplace", s.fire >= 1, String(s.fire));
  check(`the whole room is a few dozen draw calls (${s.meshes})`, s.meshes > 20 && s.meshes < 200, String(s.meshes));

  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(2000);
  const pieces = await page.evaluate(() => {
    const ps = window.__DEN_THREE__.pieceGroup.children.filter((c) => c.userData.kind === "piece");
    return { n: ps.length, opaque: ps.every((m) => [].concat(m.material).every((x) => !x.transparent)) };
  });
  check(`the pieces are Tienda's opaque wood (${pieces.n})`, pieces.n >= 10 && pieces.opaque, JSON.stringify(pieces));
  const at = async (patch) => { await page.evaluate((p) => window.__EC_TEST_CAM__(p), patch); await page.waitForTimeout(2600); return scene(); };
  const vis = (s2, n) => (s2.groups.find(([k]) => k === n) || [])[1];
  // theta 0 puts the camera on the south side (+z) of the pit.
  s = await at({ theta: 0, phi: 1.33, radius: 44 });
  check("low and pulled back past the south sofa: it steps aside", vis(s, "den-sofaS") === false, JSON.stringify(s.groups));
  check("...while the far sofa and the far wall stay", vis(s, "den-sofaN") === true && vis(s, "den-wallN") === true, JSON.stringify(s.groups));
  s = await at({ theta: 0, phi: 0.02, radius: 55 });
  check("high above, top-down: the ceiling steps aside", vis(s, "den-ceiling") === false, JSON.stringify(s.groups));
  check("...and no sofa hides (none is in the way)", ["den-sofaN", "den-sofaS", "den-sofaW"].every((n) => vis(s, n) === true), JSON.stringify(s.groups));
  s = await at({ theta: 0, phi: 0.95, radius: 20 });
  check("back at the table, everything is there again", s.groups.every(([, v]) => v === true), JSON.stringify(s.groups));

  // The sound menu.
  await openDockPanel(page).catch(() => {});
  await q(page, "sound-button").click();
  check("the speaker opens the sound menu: All sounds, The room, Pieces",
    (await q(page, "sound-menu").count()) === 1 && (await q(page, "sound-ch-room").count()) === 1 && (await q(page, "sound-ch-pieces").count()) === 1);
  await q(page, "sound-ch-room").click();
  await page.waitForTimeout(700);
  const a = await page.evaluate(() => window.__DEN_AUDIO__ && window.__DEN_AUDIO__());
  check("The room off silences the fire, the clock and the rain", a && a.channelsOff.room === true && a.gates.room < 0.01, JSON.stringify(a));
  check("...and leaves the pieces", a && a.channelsOff.pieces === false, JSON.stringify(a));
  await q(page, "sound-ch-room").click();
  await page.keyboard.press("Escape");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("Nova: the den, Neon, and back");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  const denUp = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let den = false;
    if (window.__DEN_ROOM__ && t && t.scene) t.scene.traverse((o) => { if (o.name === "den-room") den = true; });
    return den;
  });
  check("Nova opens in the den", await waitFor(denUp));
  const switchTheme = async () => {
    await q(page, "shell-menu-button").click();
    await page.waitForTimeout(300);
    await q(page, "shell-menu-switch-theme").click();
    await waitFor(async () => (await page.locator(".ec-hold-modal-word").count()) > 0);
    await page.locator(".ec-hold-modal-word").click({ force: true });
  };
  await switchTheme();
  check("switched to Neon", await waitFor(async () => (await q(page, "shell-anomaly").count()) > 0, 12000));
  check("...and the den has gone with Standard", await page.evaluate(() => window.__DEN_ROOM__ === false && !window.__DEN_THREE__));
  await page.waitForTimeout(1200);
  await switchTheme();
  check("back to Standard: the den is built again", await waitFor(denUp, 15000));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
