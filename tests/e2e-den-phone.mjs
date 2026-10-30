/* The zoom-out glass (the Room view) held off through the den's
   telephone call (user: "Hitting the zoom out button when on the phone
   causes you to keep hanging on to the receiver, but you're floating up.
   It doesn't make sense. That button should be unable to be clicked
   during the phone sequence").

   Home with the special order (window.__EC_TEST_DEN_CALL__: Big Glutts'
   call to come, without the story's way there), a game under way, the
   phone rushed to ring (__DEN_CALL_NOW__).

   - Desktop: from the first ring the glass and the dock's Room view are
     greyed and dead to a click. Over at the phone and picked up, a click
     on the glass leaves the room's camera where it was (not up over the
     room), the receiver low by it; a click away from the phone, and
     Escape, leave the view with it, the receiver at your ear, and pick
     nothing on the board (user, mid-call: "I'm not sure where I touched,
     but I was able to get back to the table in the conversation pit.
     That probably shouldn't happen."). Hung up, the view's back on the
     board, and the glass works again.
   - Up in the Room view already when it rings: going over to the phone
     (the slip) brings the room's camera down to the board, and the view
     to the phone; picked up from up there, the camera comes down and
     over to the phone too, the receiver lifting to you there.
   - A phone with the control bar: the menu's Room view greyed, saying
     why, while it rings.
   - On the phone, the full-screen switch is gone (user: "When on the
     phone in your den, you should not be able to click the unmaximize
     button. That should be grayed out. In fact, just remove it during
     that scene."): the corner's button, and the bar menu's row; its
     double right-click, which works before the call, does nothing on
     it; and after the call the button's back.

   node tests/e2e-den-phone.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const DEN_SEED = { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1" };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (page, fn, ms = 20000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await page.waitForTimeout(step);
  }
};

async function open({ phone = false, bar = false } = {}) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(({ seed, bar }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__EC_TEST_DEN_CALL__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.clear();
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        if (bar) localStorage.setItem("el-cabeza:nova-layout", "bar");
      }
    } catch (e) { /* none */ }
  }, { seed: DEN_SEED, bar });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  return { ctx, page, errs };
}

async function begin(page) {
  await poll(page, () => page.evaluate(() => !!window.__DEN_THREE__ && !!window.__EC_TEST_CAM__ && !!window.__DEN_CALL__), 40000);
  await page.waitForTimeout(2500);
  if (await page.locator('[data-testid="shell-begin"]').count()) await page.locator('[data-testid="shell-begin"]').first().click().catch(() => {});
  else {
    await openDockPanel(page).catch(() => {});
    const b = page.locator('[data-testid="dock-panel"] button:text-matches("Begin Game|Try a Game")').first();
    if (await b.count()) await b.click().catch(() => {});
  }
  return !!(await poll(page, () => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000));
}

const ring = async (page) => {
  await page.evaluate(() => window.__DEN_CALL_NOW__());
  return !!(await poll(page, () => page.evaluate(() => window.__DEN_CALL__().stage === "ringing"), 30000));
};

// The room's camera (up: in the Room view), the handset in the world, the
// call, and the Room view's ways in.
const where = (page) => page.evaluate(() => {
  const t = window.__DEN_THREE__;
  let hand = null;
  t.boardGroup.parent.traverse((o) => { if (!hand && o.userData && o.userData.phone && o.userData.rest) hand = o; });
  const hp = hand ? hand.getWorldPosition(new t.camera.position.constructor()) : null;
  const glass = document.querySelector('[data-testid="room-view-corner"]');
  const dockRoom = document.querySelector('[data-testid="room-view"]');
  return {
    up: !!window.__EC_TEST_CAM__().dollhouse,
    camY: +t.camera.position.y.toFixed(1),
    handY: hp ? +hp.y.toFixed(1) : null,
    handToCam: hp ? +hp.distanceTo(t.camera.position).toFixed(1) : null,
    stage: window.__DEN_CALL__().stage, hs: window.__DEN_CALL_HANDSET__(), visit: +window.__DEN_PHONE_VISIT__().w.toFixed(2),
    glass: glass ? { off: glass.disabled, op: +(+getComputedStyle(glass).opacity).toFixed(2), title: glass.title } : null,
    dockRoom: dockRoom ? dockRoom.disabled : null,
  };
});
const pressGlass = (page) => page.locator('[data-testid="room-view-corner"]').click({ force: true, timeout: 3000 }).catch(() => {});
const toPhone = async (page) => {
  await page.locator('[data-testid="den-call"]').click();
  return !!(await poll(page, () => page.evaluate(() => window.__DEN_PHONE_VISIT__().w > 0.97), 6000));
};
// (A click well away from the phone: the other side of the screen.)
const awayClick = async (page) => {
  const at = await page.evaluate(() => window.__DEN_PHONE_AT__());
  await page.mouse.click(at && at.x > 640 ? 160 : 1120, 300);
};
const pieceCard = (page) => page.locator('[data-testid="piece-card"]').count();
// The corner's full-screen button there to press; how many times the page
// has asked to go into full screen or out of it (counted, and refused: the
// first tap of the game may have taken it full screen already).
const fsShown = (page) => page.evaluate(() => { const b = document.querySelector("[data-fullscreen-toggle]"); return !!b && getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0; });
const fsCount = (page) => page.evaluate(() => {
  if (!window.__FS_ASKED__) {
    window.__FS_ASKED__ = { n: 0 };
    const asked = () => { window.__FS_ASKED__.n++; return Promise.reject(new Error("test")); };
    document.documentElement.requestFullscreen = asked;
    document.exitFullscreen = asked;
  }
  return window.__FS_ASKED__.n;
});
// The double right-click (chassis onContextMenu), on the board's canvas
// wherever it's uncovered; false if it's covered everywhere tried.
const doubleRight = async (page) => {
  const p = await page.evaluate(() => {
    for (const [x, y] of [[1120, 300], [160, 300], [640, 160], [1120, 560], [160, 560]]) {
      const e = document.elementFromPoint(x, y);
      if (e && e.getAttribute("data-testid") === "board-canvas") return { x, y };
    }
    return null;
  });
  if (!p) return false;
  await page.mouse.click(p.x, p.y, { button: "right", clickCount: 2 });
  await page.waitForTimeout(400);
  return true;
};
// The receiver's cord end (its +z, the mouthpiece's) against its middle,
// each frame from the tap till it's back on the cradle (user: "make sure
// that the cord is always on the bottom when it's picked up and brought
// to the ear").
const cordLog = (page) => page.evaluate(() => {
  const t = window.__DEN_THREE__;
  let hand = null;
  t.boardGroup.parent.traverse((o) => { if (!hand && o.userData && o.userData.phone && o.userData.rest) hand = o; });
  const V = t.camera.position.constructor, log = (window.__CORD__ = []);
  const tick = () => {
    if (window.__CORD__ !== log) return;
    hand.updateMatrixWorld();
    log.push({ hs: window.__DEN_CALL_HANDSET__(), y: +new V(0, 0, 1).transformDirection(hand.matrixWorld).y.toFixed(3) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const cordRead = (page) => page.evaluate(() => { const l = window.__CORD__ || []; window.__CORD__ = null; return l; });
const pickUp = async (page) => {
  const at = await page.evaluate(() => window.__DEN_PHONE_AT__());
  await page.mouse.click(at.x, at.y);
  return !!(await poll(page, () => page.evaluate(() => window.__DEN_CALL_HANDSET__() === "held"), 5000));
};

/* ---------------- desktop: the call taken ---------------- */
console.log("\ndesktop: the phone rings, and you take it");
{
  const { ctx, page, errs } = await open();
  check("a game under way", await begin(page));
  let s = await where(page);
  check("before it rings, the glass works", !!s.glass && !s.glass.off, JSON.stringify(s.glass));
  const fs0 = await fsCount(page);
  const onBoard0 = await doubleRight(page);
  check("...and the full-screen button's there; a double right-click asks for full screen", onBoard0 && (await fsShown(page)) && (await fsCount(page)) === fs0 + 1, `on the board ${onBoard0}, asked ${(await fsCount(page)) - fs0}`);
  check("the phone rings", await ring(page));
  // (Ghosted over its half-second fade.)
  s = (await poll(page, async () => { const w = await where(page); return w.glass && w.glass.op < 0.5 ? w : null; }, 2500)) || (await where(page));
  check(`from the first ring, the glass is greyed and dead (opacity ${s.glass && s.glass.op}), and says why`, !!s.glass && s.glass.off && s.glass.op < 0.5 && /on the phone/i.test(s.glass.title), JSON.stringify(s.glass));
  check("...and the dock's Room view with it", s.dockRoom === true, String(s.dockRoom));
  await pressGlass(page);
  await page.waitForTimeout(1500);
  check("...a click on it does nothing: the camera stays in the room", !(await where(page)).up);
  check("the slip: over to the phone", await toPhone(page));
  await cordLog(page);
  check("a tap on the phone: picked up, the receiver lifted", await pickUp(page));
  await page.waitForTimeout(600);
  const held = await where(page);
  await pressGlass(page);
  await page.waitForTimeout(2500);
  s = await where(page);
  check(`on the phone, a click on the glass: no Room view, the receiver stays where it was (y ${s.handY}, was ${held.handY})`, !s.up && s.glass.off && Math.abs(s.handY - held.handY) < 1, JSON.stringify(s));
  // On the line, a click away from the phone and Escape: the view stays
  // with it, and nothing on the board is picked.
  await awayClick(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);
  s = await where(page);
  check(`on the line, a click away and Escape: the view stays with the phone, not back at the table (camera y ${s.camY})`, s.stage === "call" && s.visit > 0.97 && !s.up && s.camY < 40, JSON.stringify(s));
  check(`...the receiver at your ear (${s.handToCam} away, y ${s.handY}), nothing picked on the board`, s.hs === "held" && s.handToCam < 15 && s.handY < 40 && (await pieceCard(page)) === 0, JSON.stringify(s));
  {
    const n = await fsCount(page);
    const onBoard = await doubleRight(page);
    check("on the phone: no full-screen button, and a double right-click asks for nothing", onBoard && !(await fsShown(page)) && (await fsCount(page)) === n, `on the board ${onBoard}, shown ${await fsShown(page)}, asked ${(await fsCount(page)) - n}`);
  }
  check("they hang up", !!(await poll(page, () => page.evaluate(() => window.__DEN_CALL__().stage === "done"), 60000)));
  check("...and the view's back on the board", !!(await poll(page, async () => (await where(page)).visit < 0.03, 5000)));
  const cord = await cordRead(page), moving = cord.filter((c) => c.hs !== "rest"), atEar = cord.filter((c) => c.hs === "held");
  const top = moving.length ? Math.max(...moving.map((c) => c.y)) : null, earTop = atEar.length ? Math.max(...atEar.map((c) => c.y)) : null;
  check(`the receiver's cord end below its middle all the way, up, at your ear and down again (${moving.length} frames: highest ${top}, at the ear ${earTop})`, moving.length > 10 && cord.some((c) => c.hs === "lift") && cord.some((c) => c.hs === "down") && top <= 0.02 && earTop < -0.3, JSON.stringify(moving.filter((c, i) => i % 15 === 0)));
  s = await where(page);
  check("hung up: the glass and the dock's Room view work again", !!s.glass && !s.glass.off && s.dockRoom === false, JSON.stringify(s));
  await pressGlass(page);
  check("...and up over the room it goes", !!(await poll(page, async () => (await where(page)).up, 4000)));
  check("off the phone, the full-screen button's back", !!(await poll(page, async () => !(await page.evaluate(() => document.documentElement.classList.contains("ec-den-call"))) && (await fsShown(page)), 15000)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- desktop: up in the Room view when it rings ---------------- */
console.log("\ndesktop: up in the Room view when it rings, over to the phone");
{
  const { ctx, page, errs } = await open();
  check("a game under way", await begin(page));
  await pressGlass(page);
  check("up in the Room view", !!(await poll(page, async () => (await where(page)).up, 4000)));
  await page.waitForTimeout(1200);
  check("the phone rings", await ring(page));
  const s0 = await where(page);
  check("...the glass greyed, the camera still up there", s0.glass.off && s0.up, JSON.stringify(s0));
  check("the slip: over to the phone", await toPhone(page));
  check("...and the room's own camera down from the Room view to the board", !!(await poll(page, async () => !(await where(page)).up, 6000)));
  check("a tap on the phone: picked up", await pickUp(page));
  await page.waitForTimeout(800);
  await awayClick(page);
  await page.waitForTimeout(2500);
  const s = await where(page);
  check(`a click away: still with the phone, the receiver at your ear, not in the sky (camera y ${s.camY}, receiver y ${s.handY})`, s.visit > 0.97 && !s.up && s.camY < 40 && s.handY < 40 && s.handToCam < 15, JSON.stringify(s));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

console.log("\ndesktop: up in the Room view when it rings, picked up from up there");
{
  const { ctx, page, errs } = await open();
  check("a game under way", await begin(page));
  await pressGlass(page);
  check("up in the Room view", !!(await poll(page, async () => (await where(page)).up, 4000)));
  await page.waitForTimeout(1200);
  check("the phone rings", await ring(page));
  await page.evaluate(() => window.__DEN_CALL_PICKUP__());
  check("picked up from up there: the camera comes down out of the Room view", !!(await poll(page, async () => !(await where(page)).up, 6000)));
  check("...and over to the phone", !!(await poll(page, () => page.evaluate(() => window.__DEN_PHONE_VISIT__().w > 0.97), 6000)));
  await poll(page, () => page.evaluate(() => window.__DEN_CALL_HANDSET__() === "held"), 5000);
  await page.waitForTimeout(1500);
  const s = await where(page);
  check(`...the receiver lifted to you there (camera y ${s.camY}, receiver ${s.handToCam} away, y ${s.handY})`, s.hs === "held" && s.visit > 0.97 && s.camY < 40 && s.handToCam < 15 && s.handY < 40, JSON.stringify(s));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---------------- a phone with the control bar ---------------- */
console.log("\nphone, with the control bar: the menu's Room view");
{
  const { ctx, page, errs } = await open({ phone: true, bar: true });
  check("a game under way", await begin(page));
  const row = page.locator('[data-testid="shell-menu-room"]');
  const menu = page.locator('[data-testid="shell-menu-button"]');
  await menu.click();
  check("before it rings, the menu's Room view works", (await row.count()) > 0 && !(await row.isDisabled()));
  const fsRow = page.locator('[data-testid="shell-menu-fullscreen"]');
  const hadFsRow = await fsRow.isVisible().catch(() => false);
  await menu.click().catch(() => {});
  await page.waitForTimeout(500);
  check("the phone rings", await ring(page));
  if (!(await row.isVisible().catch(() => false))) await menu.click();
  await page.waitForTimeout(400);
  check("...the menu's Room view greyed, saying why", (await row.isDisabled()) && /on the phone/i.test(await row.innerText()), await row.innerText());
  await row.click({ force: true, timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  check("...and a tap on it does nothing", !(await where(page)).up);
  // Picked up: the menu's Full screen row gone, as the corner's button is.
  if (await row.isVisible().catch(() => false)) await menu.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  // (Still ringing, or rung again if it's given up meanwhile: 48 s.)
  if ((await page.evaluate(() => window.__DEN_CALL__().stage)) !== "ringing") await ring(page);
  const took = await page.evaluate(() => ({ before: window.__DEN_CALL__().stage, took: window.__DEN_CALL_PICKUP__() }));
  check("picked up", !!(await poll(page, () => page.evaluate(() => window.__DEN_CALL__().stage === "call" && document.documentElement.classList.contains("ec-den-call")), 6000)), JSON.stringify({ ...took, now: await page.evaluate(() => ({ stage: window.__DEN_CALL__().stage, flag: document.documentElement.classList.contains("ec-den-call") })) }));
  await menu.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  if (hadFsRow) check("on the phone: the menu's Full screen row is gone (it was there before)", (await row.isVisible().catch(() => false)) && !(await fsRow.isVisible().catch(() => false)), JSON.stringify({ menuOpen: await row.isVisible().catch(() => false), fsRow: await fsRow.isVisible().catch(() => false) }));
  else console.log("  (no Full screen row in this browser's menu: nothing to take away)");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
