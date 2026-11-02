/* The piece card keeps off the chosen piece (user, with the City on a
   phone, the 1×3 Block's card over the piece: "Piece guide cards will have
   to be moved so it doesn't cover up the piece that is currently
   selected"). In its own place at the lower left until that would cover
   the chosen piece on the screen; then in the corner that covers it least,
   clear of the screen's own controls (the top left under the Rules tab
   first). Left there while it's clear (it doesn't hop about as the view
   moves); back in its own place the next time it comes.
   1. The City on a phone: a piece chosen, the card in its own place; the
      view moved so the piece sits under it: the card goes, clear of the
      piece, on the screen, under the Rules tab; the piece brought back up
      the screen: the card stays where it went; chosen again: its own
      place.
   2. Luna on a computer: the same move of the view, the card clear of the
      piece.
     node tests/e2e-piece-card-place.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const DESK = { viewport: { width: 1366, height: 768 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(page0, dev) {
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      Object.keys(localStorage).filter((k) => k.startsWith("el-cabeza:")).forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/${page0}`);
  await page.waitForTimeout(3000);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game/ }).first().click();
  await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await page.waitForTimeout(1500);
  return { ctx, page, errs, touch: !!dev.hasTouch };
}
const tapAt = (s, x, y) => (s.touch ? s.page.touchscreen.tap(x, y) : s.page.mouse.click(x, y));
// The card as it stands: where, which spot, and the chosen piece's box.
const state = (page, id) => page.evaluate((id) => {
  const c = document.querySelector('[data-testid="piece-card"]');
  const p = window.__EC_TEST_PIECE_RECT__(id);
  const tab = document.querySelector('[data-testid="corner-menu-tab"]');
  const cr = c && c.getBoundingClientRect(), tr = tab && tab.getBoundingClientRect();
  const over = (a, b) => !!a && !!b && Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return {
    shown: !!c, spot: c ? c.dataset.spot : null,
    card: cr && { l: Math.round(cr.left), t: Math.round(cr.top), r: Math.round(cr.right), b: Math.round(cr.bottom) },
    piece: p && { l: Math.round(p.left), t: Math.round(p.top), r: Math.round(p.right), b: Math.round(p.bottom) },
    covers: over(cr, p), onTab: over(cr, tr),
    onScreen: !!cr && cr.left >= 0 && cr.top >= 0 && cr.right <= innerWidth && cr.bottom <= innerHeight,
  };
}, id);
// The view moved (its target slid along the ground) till the piece's
// middle is at (x, y) on the screen, near enough.
async function steer(page, id, want) {
  for (let k = 0; k < 16; k++) {
    const r = await page.evaluate(([id, want]) => {
      const t = window.__EC_TEST_THREE__(), cam = window.__EC_TEST_CAM__();
      const p = window.__EC_TEST_SCREEN_POS__(id);
      const ex = want[0] - p.x, ey = want[1] - p.y;
      const e = t.camera.matrixWorld.elements;
      const rt = [e[0], e[2]], fw = [-e[8], -e[10]];
      const nr = Math.hypot(rt[0], rt[1]) || 1, nf = Math.hypot(fw[0], fw[1]) || 1, k = cam.radius / 900;
      window.__EC_TEST_CAM__({ target: [cam.target[0] - (rt[0] / nr) * ex * k + (fw[0] / nf) * ey * k, cam.target[1], cam.target[2] - (rt[1] / nr) * ex * k + (fw[1] / nf) * ey * k], snap: true });
      return Math.hypot(ex, ey);
    }, [id, want]);
    await page.waitForTimeout(220);
    if (r < 14) break;
  }
  await page.waitForTimeout(700);
}

for (const c of [
  { label: "the City on a phone", page: "el-cabeza-ciudad.html", dev: PHONE, under: (s) => [s.card.l + 90, s.card.t + 40], up: [195, 380], tab: true },
  { label: "Luna on a computer", page: "el-cabeza-luna.html", dev: DESK, under: (s) => [s.card.l + 110, s.card.t + 40], up: [683, 330], tab: false },
]) {
  console.log(`[${c.label}]`);
  const s = await open(c.page, c.dev);
  const { page, errs } = s;
  const side = await page.evaluate(() => window.__EC_TEST_TO_MOVE__());
  const id = await page.evaluate((side) => window.__EC_TEST_PIECES__.find((p) => p.owner === side && p.type !== "cabeza").id, side);
  const at = await page.evaluate((id) => window.__EC_TEST_SCREEN_POS__(id), id);
  await tapAt(s, at.x, at.y);
  let st = await poll(async () => { const v = await state(page, id); return v.shown ? v : null; });
  check("a piece chosen: its card, in its own place, off the piece", !!st && st.spot === "own" && !st.covers, JSON.stringify(st));
  // The view moved so the piece sits where the card is.
  await steer(page, id, c.under(st));
  st = await poll(async () => { const v = await state(page, id); return v.shown && v.spot !== "own" && !v.covers ? v : null; });
  const last = st || (await state(page, id));
  check("the piece brought under the card's own place: the card goes, clear of the piece", !!st, JSON.stringify(last));
  check("...on the screen", last.onScreen, JSON.stringify(last));
  if (c.tab) check("...not over the Rules tab", !last.onTab, JSON.stringify(last));
  const went = last.spot;
  // The piece brought back up the screen: the card left where it went.
  await steer(page, id, c.up);
  await page.waitForTimeout(800);
  st = await state(page, id);
  check("the piece moved up the screen: the card stays where it went (no hopping), still clear of it", st.shown && st.spot === went && !st.covers, JSON.stringify(st));
  // Let go and chosen again: its own place.
  const away = await page.evaluate((id) => { const p = window.__EC_TEST_SCREEN_POS__(id); return p; }, id);
  await tapAt(s, away.x, away.y);
  await poll(async () => !(await state(page, id)).shown, 3000);
  await tapAt(s, away.x, away.y);
  st = await poll(async () => { const v = await state(page, id); return v.shown ? v : null; });
  check("let go and chosen again (the piece clear of it): back in its own place", !!st && st.spot === "own" && !st.covers, JSON.stringify(st));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await s.ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
