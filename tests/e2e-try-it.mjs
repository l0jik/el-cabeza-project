/* The store's "Try it!" card on the table (user): a fresh story, the box
   opened; a tap on the card brings the store's flyer (its demonstration
   game, $7.97; the page the user picked, the store's stripes round it,
   all of it on the screen), deaf to taps for five seconds, then up until
   its "Let's play!" is pressed, circled in red pen; that opens the menu
   as the piece's tap opens it, Try a Game lit (tienda-fx.js
   pickScene/sceneTap, tienda-overlay.js). Every other tap shakes it, on
   it or beside it, with no blue flash (user: "I want it to shake no
   matter where you tap until the play a game is circled at the bottom",
   then "After it's circled, a tap on the flyer shouldn't do anything. It
   should still shake it. They have to actually press where Let's Play is
   circled."). On a phone, the card's corner in the opening view. */
import { chromium } from "playwright";
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html?fresh");
await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.locator('[data-testid="tienda-open-box"]').click();
await page.waitForTimeout(5000);
// The card's leaf on screen, its farthest point inside the screen's edge
// (the opening view has it at the right edge of a phone).
const at = await page.evaluate(() => {
  const t = window.__TIENDA_THREE__; const pts = [];
  t.scene.traverse((o) => { if (o.userData && o.userData.tryIt) pts.push(o); });
  const r = t.renderer.domElement.getBoundingClientRect();
  let best = null;
  pts.forEach((m) => {
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox; const V = m.position.constructor;
    [0.04, 0.08, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].flatMap((fx) => [[fx, 0.4], [fx, 0.6]]).forEach(([fx, fy]) => {
      const v = new V(b.min.x + (b.max.x - b.min.x) * fx, b.min.y + (b.max.y - b.min.y) * fy, 0).applyMatrix4(m.matrixWorld).project(t.camera);
      const p = { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
      if (p.x > 4 && p.x < innerWidth - 6 && p.y > 4 && p.y < innerHeight - 4 && (!best || p.x > best.x)) best = p;
    });
  });
  return best;
});
check("the card's on screen", !!at, JSON.stringify(at));
if (at) await page.touchscreen.tap(at.x, at.y);
await page.waitForSelector('[data-testid="tienda-try-it"]', { timeout: 3000 }).catch(() => {});
const card = page.locator('[data-testid="tienda-try-it"]');
check("a tap on it: the store's flyer (its demonstration game, $7.97)", (await card.count()) === 1 && /demonstration/i.test(await card.innerText()) && /\$?\s*7\s*\.?\s*97/.test(await card.innerText()));
check("...without \"So you'd like to try it, eh?\" (user)", !/try it, eh/i.test(await card.innerText()));
// (Each shake counted as the flyer asks for it, __TD_SHAKES__: counted by
// its animation's start, GitHub's run on e877fa5 lost one. The page can
// stall seconds there, and a shake restarted before its start event
// fires starts just once. That the sheet's tdTryNudge plays is checked
// on its own, __NUDGES__.)
await page.evaluate(() => {
  window.__TD_SHAKES__ = 0; window.__NUDGES__ = 0;
  const s = document.querySelector('[data-testid="tienda-try-it"] .sheet');
  if (s) s.addEventListener("animationstart", (e) => { if (e.animationName === "tdTryNudge") window.__NUDGES__++; });
});
const shakes = () => page.evaluate(() => window.__TD_SHAKES__);
const shakesReach = async (n) => { const end = Date.now() + 2500; while ((await shakes()) < n && Date.now() < end) await page.waitForTimeout(50); return shakes(); };
// (Tapped straight away, in the page: the test's own click waits for the
// card's entrance to settle, which can take past the hold.)
await page.evaluate(() => document.querySelector('[data-testid="tienda-try-it"]').click());
await page.waitForTimeout(150);
check("...held: an early tap doesn't put it away, it shakes it (user: \"shake no matter where you tap until the play a game is circled\")", (await card.count()) === 1 && (await shakesReach(1)) === 1, `${await shakes()} shakes`);
// A finger on it in the hold: a shake too, and none of the browser's blue
// (user: "When you tap on the flyer, it just turns it blue").
const cb0 = await card.boundingBox();
await page.touchscreen.tap(cb0.x + cb0.width / 2, cb0.y + cb0.height * 0.3);
await page.waitForTimeout(150);
const look = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('[data-testid="tienda-try-it"]')); return { hi: c.getPropertyValue("-webkit-tap-highlight-color"), sel: c.userSelect || c.webkitUserSelect }; });
check(`...a finger on it in the hold: still up, a shake, no blue (${look.hi}, select ${look.sel})`, (await card.count()) === 1 && (await shakesReach(2)) === 2 && /rgba\(0, 0, 0, 0\)|transparent/.test(look.hi) && look.sel === "none", `${await shakes()} shakes, ${JSON.stringify(look)}`);
// (And one at four seconds, by the card's own clock: taps are ignored for
// the first five, user.)
const tappedAt = await page.evaluate(async () => {
  const el = document.querySelector('[data-testid="tienda-try-it"]');
  const since = Number(el.dataset.since);
  while (performance.now() - since < 4000) await new Promise((r) => setTimeout(r, 40));
  el.click();
  return performance.now() - since;
});
await page.waitForTimeout(150);
check("...nor one at four seconds: a shake", tappedAt < 5000 && (await card.count()) === 1 && (await shakesReach(3)) === 3, `tapped at ${Math.round(tappedAt)} ms, ${await shakes()} shakes`);
await page.waitForTimeout(2700);
check("...and up until it's tapped (user: it doesn't pop down by itself)", (await card.count()) === 1);
// The page the user picked (its three sale days), with the store's stripes
// down the side and round the top (user), all of it on the screen.
const stripes = await page.evaluate(() => [".sv", ".sc", ".sh"].every((q) => {
  const el = document.querySelector('[data-testid="tienda-try-it"] ' + q);
  const r = el && el.getBoundingClientRect();
  return !!(r && r.width > 0 && r.height > 0);
}));
check("...the three sale days, the store's stripes down the side and round the top (user)", /3 days only/i.test(await card.innerText()) && stripes);
const fb = await card.boundingBox();
check("...all of it on the screen", !!fb && fb.x >= 0 && fb.y >= 0 && fb.x + fb.width <= 390 && fb.y + fb.height <= 844, JSON.stringify(fb));
// Its call (user, of six ways to make "Let's play!" seen: "Let's go with
// A, circled in red pen, but make the circle a bit messier and have it
// redraw the line until the user selects it. Have it redraw differently
// each time."): a red pen loop round it, drawn again and again, never the
// same.
const loopD = () => page.evaluate(() => { const p = document.querySelector('[data-testid="tienda-try-it"] .go .pen path'); return p ? p.getAttribute("d") : null; });
const waitFor = async (fn, ms) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await page.waitForTimeout(150); } };
const d1 = await waitFor(loopD, 3000);
check("...\"Let's play!\" circled in red pen", !!d1 && /let.s play!/i.test(await page.locator('[data-testid="tienda-try-it"] .go').innerText()));
const d2 = await waitFor(async () => { const d = await loopD(); return d && d !== d1 ? d : null; }, 7000);
check("...and circled again, differently", !!d2);
// A tap beside it: the store behind doesn't take it, the flyer stays.
await page.touchscreen.tap(195, 800);
await page.waitForTimeout(400);
const panelOpen = () => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
check("...a tap beside it doesn't put it away, or reach the store: it shakes", (await card.count()) === 1 && !(await panelOpen()) && (await shakesReach(4)) === 4, `${await shakes()} shakes`);
// Circled, a tap on the flyer anywhere but "Let's play!" still only shakes
// it (user: "After it's circled, a tap on the flyer shouldn't do
// anything. It should still shake it. They have to actually press where
// Let's Play is circled."): its middle, and just above the loop.
const cb = await card.boundingBox();
await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height * 0.4);
await page.waitForTimeout(400);
check("...circled, a tap on the flyer's middle: still up, a shake", (await card.count()) === 1 && !(await panelOpen()) && (await shakesReach(5)) === 5, `${await shakes()} shakes`);
const gb = await page.locator('[data-testid="tienda-try-it"] .go').boundingBox();
await page.touchscreen.tap(gb.x + gb.width / 2, gb.y - 40);
await page.waitForTimeout(400);
check("...and one just above \"Let's play!\": still up, a shake", (await card.count()) === 1 && !(await panelOpen()) && (await shakesReach(6)) === 6, `${await shakes()} shakes`);
await page.touchscreen.tap(gb.x + gb.width / 2, gb.y + gb.height / 2);
await page.waitForTimeout(900);
// (The menu the piece's tap opens is Rings now, the dock's menu.)
const ringsOut = () => page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"] [data-testid="menu-fan"]'));
for (let i = 0; i < 20 && !(await ringsOut()); i++) await page.waitForTimeout(150);
check("then a press on \"Let's play!\": the menu, as the piece's tap opens it", (await card.count()) === 0 && (await ringsOut()) && !(await panelOpen()) && (await shakes()) === 6, `${await shakes()} shakes`);
check("...Try a Game lit", await page.evaluate(() => document.documentElement.classList.contains("td-idle-nudge")) && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"].td-try-game').count()) === 1 && /try a game/i.test(await page.locator('[data-testid="menu-fan-primary"]').innerText()));
// (The shakes counted above as asked for; here, that the sheet really shook.)
const nudges = await page.evaluate(() => window.__NUDGES__);
check(`the shakes seen on the sheet (its tdTryNudge played ${nudges} times)`, nudges > 0);
check("no page errors", errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
