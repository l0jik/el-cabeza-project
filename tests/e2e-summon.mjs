/* The first arrival in Neon from the den's television (Nova, before the
   Singularity's been visited): the summons (themes/neon-summon.js). The
   singularity over the board, the pieces turned to it and hovering, shock
   waves running out; the board and the dock out of reach, the title's hold
   still there; a tap on the singularity opens the SINGULARITY invite, and
   the toll puts it all away. Its sound: the phone mix on a phone, the
   full-range mix on a computer, thunder on the waves. Once the
   Singularity's been visited, no summons.

   node tests/e2e-summon.mjs */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
async function throughTheSet(seen, desktop, lostMs = null, unravelMs = null) {
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 800 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([seen, lostMs, unravelMs]) => {
    window.__EC_TEST_HOOKS__ = true;
    if (lostMs) window.__EC_TEST_LOST_MS__ = lostMs;
    if (unravelMs) window.__EC_TEST_UNRAVEL_MS__ = unravelMs;
    try {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
        if (seen) { localStorage.setItem("el-cabeza:singularity-seen", "1"); localStorage.setItem("el-cabeza:commercial-aired", "1"); }
      }
    } catch (e) { /* none */ }
  }, [seen, lostMs, unravelMs]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await poll(() => page.evaluate(() => !!window.__DEN_TV__), 30000);
  await page.waitForTimeout(1200);
  // The set: the first time, one press to look, another to turn it on.
  await page.evaluate(() => window.__DEN_TV_PRESS__());
  await page.waitForTimeout(1500);
  if (await page.evaluate(() => window.__DEN_TV__ && window.__DEN_TV__().looking)) await page.evaluate(() => window.__DEN_TV_PRESS__());
  const inNeon = await poll(() => page.evaluate(() => !window.__DEN_TV__ && !!document.querySelector(".ec-title") && /Chakra/.test(getComputedStyle(document.querySelector(".ec-title")).fontFamily)), 40000);
  return { ctx, page, errs, inNeon };
}

console.log("the first arrival");
{
  const { ctx, page, errs, inNeon } = await throughTheSet(false, false, 9000);
  check("into Neon through the television", !!inNeon);
  const S = () => page.evaluate(() => (window.__EC_SUMMON__ ? window.__EC_SUMMON__() : { active: false }));
  check("the summons is up", !!(await poll(async () => (await S()).active, 10000)));
  const snd = (await S()).sound;
  check("its sound: the phone mix, playing", !!snd && snd.mix === "phone" && snd.state === "running", JSON.stringify(snd));
  const s1 = await poll(async () => { const s = await S(); return s.ready && s.lifted.length && s.lifted.every((y) => y > 0.1) ? s : null; }, 12000);
  check("the pieces have lifted off the board, facing it", !!s1, JSON.stringify(await S()));
  check("the singularity sits between the title and the board", !!s1 && s1.screen.y > 110 && s1.screen.y < 420, JSON.stringify(s1 && s1.screen));
  const dockHidden = await page.evaluate(() => [...document.querySelectorAll('[data-dock-piece], [data-testid="dock-panel"]')].every((d) => getComputedStyle(d).visibility === "hidden"));
  check("the dock is put away", dockHidden);
  const atTitle = await page.evaluate(() => { const t = document.querySelector(".ec-title").getBoundingClientRect(); const el = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return el && (el.getAttribute("data-testid") || el.className); });
  check(`the title's hold is still within reach (${atTitle})`, /hold-zone/.test(String(atTitle)));
  // (The first clap of thunder, and its shock wave, comes about 12 s in.)
  check("a clap of thunder, and its shock wave", !!(await poll(async () => { const s = await S(); return s.waves >= 1 && s.sound && s.sound.thunder >= 1; }, 30000)), JSON.stringify(await S()));
  // A tap on the board does nothing.
  await page.mouse.click(110, 560);
  await page.waitForTimeout(600);
  check("a tap on the board: nothing", (await page.locator(".ec-singularity-invite-btn").count()) === 0 && (await S()).active);
  // A tap on the singularity: the invite.
  const at = (await S()).screen;
  await page.mouse.click(at.x, at.y);
  check("a tap on the singularity opens the SINGULARITY invite", !!(await poll(async () => (await page.locator(".ec-singularity-invite-btn").count()) > 0, 4000)));
  const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  check("the toll puts the summons away", !!(await poll(async () => !(await S()).active, 6000)));
  // Then the way in: the Singularity's sphere at its own size, not huge
  // (the summons once hid the dock outright, the board went unfitted, and
  // the sphere came up filling the screen).
  const radius = (settled) => page.evaluate((settled) => {
    const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
    const f = t && t.singularity && t.singularity.sphereFrame;
    if (!f || !f.visible || !f.parent) return null;
    // (It arrives big and close and eases back to its place: settled,
    // once that's over.)
    if (settled && t.singularity.sphereArriveAt) return null;
    const ph = document.querySelector("[data-singularity-phase]");
    if (!ph || ph.getAttribute("data-singularity-phase") !== "sphere") return null;
    const V = t.camera.position.constructor, c = new V(), up = new V(0, 1, 0);
    f.getWorldPosition(c); const s = new V(); f.getWorldScale(s);
    up.applyQuaternion(t.camera.quaternion).multiplyScalar(6 * s.y).add(c);
    c.project(t.camera); up.project(t.camera);
    return Math.hypot((up.x - c.x) * innerWidth / 2, (up.y - c.y) * innerHeight / 2);
  }, settled);
  const arriveR = await poll(() => radius(false), 15000);
  const sphereR = await poll(() => radius(true), 15000);
  check(`...arriving big and close, then easing back (${arriveR && arriveR.toFixed(0)} px -> ${sphereR && sphereR.toFixed(0)} px)`, !!arriveR && !!sphereR && arriveR > sphereR * 1.4);
  check(`the Singularity's sphere at its own size (radius ${sphereR && sphereR.toFixed(0)} px of ${await page.evaluate(() => innerWidth)})`, !!sphereR && sphereR < 0.5 * (await page.evaluate(() => innerWidth)));
  // BACK: home, the late-night commercial on the set; a drag across the
  // screen while it plays must not move the board's camera underneath
  // (user: after the set went off the view was of the carpet), so once it
  // goes off the camera comes back to the board.
  // The story's first visit, left untouched a while (9 s here): the Back
  // button wakes, and the wireframe hand reaches for the way out.
  check("lingering: lost in the Singularity, a way out", !!(await poll(() => page.locator('[data-testid="singularity-lost"]').count(), 20000)));
  check("...the Back button glowing, throbbing", await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="singularity-back-button"]')).animationName === "ecLostThrob"));
  check("...\"I want out of here\"", /I want out of here/i.test(await page.locator('[data-testid="singularity-lost-out"]').innerText()));
  if (process.env.EC_SHOTS) { await page.waitForTimeout(4200); await page.screenshot({ path: `${process.env.EC_SHOTS}/lost.png` }); }
  await page.locator('[data-testid="singularity-lost-out"]').click();
  check("BACK: home, the commercial on the set", !!(await poll(() => page.evaluate(() => window.__DEN_TV__ && window.__DEN_TV__().phase === "commercial"), 30000)));
  await page.waitForTimeout(3000);
  await page.mouse.move(200, 600); await page.mouse.down(); await page.mouse.move(200, 200, { steps: 12 }); await page.mouse.move(60, 250, { steps: 8 }); await page.mouse.up();
  await page.mouse.wheel(0, 900);
  check("...then off, and the camera back from the set", !!(await poll(() => page.evaluate(() => { const s = window.__DEN_TV__ && window.__DEN_TV__(); return s && s.phase === "off" && s.focus < 0.01; }), 90000, 500)));
  await page.waitForTimeout(1500);
  const view = await page.evaluate(() => { const p = window.__EC_TEST_SCREEN_POS__("dark-cabeza"), q = window.__EC_TEST_SCREEN_POS__("light-cabeza"), c = window.__EC_TEST_THREE__().camera.position; return { p, q, cy: c.y }; });
  const onScreen = (p) => p && p.x > 0 && p.x < 390 && p.y > 0 && p.y < 844;
  check(`...on the board, as it was (${JSON.stringify(view)})`, onScreen(view.p) && onScreen(view.q) && view.cy < 30);
  {
    // Re-centred on the coffee table (user: always, not too close, not too far): the board's centre, its own distance, out of the Room view, the board's middle near the screen's.
    const v = await page.evaluate(() => {
      const c = window.__EC_TEST_CAM__(), t = window.__DEN_THREE__ || window.__EC_TEST_THREE__(), bv = t.boardView ? t.boardView() : null;
      const p = t.boardGroup.position.clone(); t.boardGroup.getWorldPosition(p); p.project(t.camera);
      return { c, bv, sx: p.x, sy: p.y };
    });
    check(`...re-centred on the coffee table (${JSON.stringify(v)})`, !!v.bv && !v.c.dollhouse && Math.hypot(...v.c.target) < 0.5 && Math.abs(v.c.radius - v.bv.radius) < 0.5 && Math.abs(v.sx) < 0.25 && Math.abs(v.sy) < 0.4);
  }
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("on a computer");
{
  const { ctx, page, errs, inNeon } = await throughTheSet(false, true, null, 3000);
  check("into Neon through the television", !!inNeon);
  const S = () => page.evaluate(() => (window.__EC_SUMMON__ ? window.__EC_SUMMON__() : { active: false }));
  check("the summons is up", !!(await poll(async () => (await S()).active, 10000)));
  const snd = (await S()).sound;
  check("its sound: the full-range mix, playing", !!snd && snd.mix === "full" && snd.state === "running", JSON.stringify(snd));
  check("thunder comes with the waves", !!(await poll(async () => { const s = await S(); return s.sound && s.sound.thunder >= 1; }, 30000)), JSON.stringify(await S()));
  // Into the sphere, and something going wrong there (the story's first
  // visit): a heartbeat and a ring in the silence, a wireframe fingertip
  // at every touch, plainer each time, and a menu that comes apart (3 s
  // here) and folds shut, then the hand.
  const at = (await S()).screen;
  await page.mouse.click(at.x, at.y);
  await poll(async () => (await page.locator(".ec-singularity-invite-btn").count()) > 0, 4000);
  const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  check("into the sphere", !!(await poll(() => page.evaluate(() => { const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__(); const ph = document.querySelector("[data-singularity-phase]"); return !!(t && t.singularity && !t.singularity.sphereArriveAt && ph && ph.getAttribute("data-singularity-phase") === "sphere"); }), 25000)));
  await page.waitForTimeout(800);
  const U = () => page.evaluate(() => (window.__EC_UNEASE__ ? window.__EC_UNEASE__() : null));
  const u0 = await U();
  check(`a heartbeat in the silence, faint (${u0 && u0.level.toFixed(2)})`, !!u0 && u0.sound && u0.level > 0 && u0.level < 0.3, JSON.stringify(u0));
  const tips = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="singularity-fingertip"]')].map((e) => +e.dataset.strength));
  // The sphere's middle on screen: its front label.
  const mid = await page.evaluate(() => {
    const t = window.__EC_TEST_THREE__(), f = t.singularity.sphereFrame, V = t.camera.position.constructor, c = new V();
    f.getWorldPosition(c); c.project(t.camera);
    return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight };
  });
  await page.mouse.click(mid.x, mid.y);
  const tip1 = await tips();
  check(`a touch: a wireframe fingertip where it landed (${tip1})`, tip1.length >= 1);
  // (The sphere comes up turned any way: LAWS, as a tap on its label.)
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__EC_TEST_OPEN_CATEGORY__("laws"));
  check("a menu opens, and works as a menu", !!(await poll(async () => (await page.locator('[data-testid="category-overlay"]').count()) > 0, 4000)));
  const h3 = await page.locator('[data-testid="category-overlay"] h3').boundingBox();
  await page.mouse.click(h3.x + 10, h3.y + h3.height / 2);
  const tip2 = await tips();
  check(`...each fingertip plainer than the last (${tip2})`, tip2.length >= 2 && tip2[tip2.length - 1] > tip2[0]);
  check("...the heartbeat rising", !!(await poll(async () => (await U()).level > u0.level, 3000)));
  check("then the menu comes apart", !!(await poll(() => page.evaluate(() => { const p = document.querySelector('[data-testid="category-overlay"]'); return !!p && p.getAttribute("data-unravel") === "on"; }), 6000)));
  await page.waitForTimeout(900);
  check("...its words to noise", await page.evaluate(() => /[\u2588\u2593\u2592\u2591]/.test((document.querySelector('[data-testid="category-overlay"]') || {}).textContent || "")));
  check("...folds shut by itself", !!(await poll(async () => (await page.locator('[data-testid="category-overlay"]').count()) === 0, 6000)));
  check("...and the hand: \"I want out of here\"", !!(await poll(async () => (await page.locator('[data-testid="singularity-lost-out"]').count()) > 0, 4000)));
  check("...the Back button throbbing, the heartbeat at its height", (await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="singularity-back-button"]')).animationName)) === "ecLostThrob" && (await U()).level === 1);
  if (process.env.EC_SHOTS) await page.screenshot({ path: `${process.env.EC_SHOTS}/unravel-lost.png` });
  await page.locator('[data-testid="singularity-lost-out"]').click();
  check("out: home, and the heartbeat goes", !!(await poll(async () => { const u = await U(); return !!(await page.evaluate(() => !!window.__DEN_TV__)) && (!u || u.stopped); }, 30000)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("once the Singularity's been visited");
{
  const { ctx, page, errs, inNeon } = await throughTheSet(true);
  check("into Neon through the television", !!inNeon);
  await page.waitForTimeout(3000);
  check("no summons", !(await page.evaluate(() => window.__EC_SUMMON__ && window.__EC_SUMMON__().active)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
