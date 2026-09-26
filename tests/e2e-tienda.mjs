/* Tienda, end to end, on the screens it's meant for: phones small and
   large (portrait and landscape), tablets, laptops and desktops.

   On every screen: the boxed game on the lid shows, fits and can be
   opened by tap or click; opening it puts the store round the board at
   a quality tier and pixel ratio the device can take, starts the store's
   sound (a user gesture), and leaves the masthead on screen and How to
   play reachable; the page never scrolls sideways. On a phone and a
   laptop, How to play opens the rules leaflet (newsprint, torn edge)
   and it fits.

   On a phone and a laptop: the catalog order form (custom rules) fits,
   its rules behave (Diagonal slide brings Slide), the board takes any
   width and length, a piece's photograph takes it up in 3-D (turning,
   dragged, in either wood, put back), pieces too many for the width are
   refused with a fix, and placing the order starts that game on a board
   painted for its size. Then a game
   played to a win: the points tag, the win placard, the register-tape
   Move Log, the sound winding down (the tape stopping, keeping its
   place), and New Game back to the table with one store, not two.

   The store's tape (a Muzak recording beside the page) is fetched and
   playing on a phone and a laptop; opened on its own, without the tape,
   the page plays its own arrangements instead.

   TIENDA_SHOTS=<dir> saves a screenshot at each step. */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const SHOTS = process.env.TIENDA_SHOTS || null;
// Served over HTTP, as GitHub Pages serves it, so the store's tape (a
// file beside the page) loads.
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const URL = `http://127.0.0.1:${server.address().port}/el-cabeza-tienda.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

async function open(size) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.touch ? 2 : 1, isMobile: !!size.touch, hasTouch: !!size.touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|ERR_TUNNEL|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(URL);
  await page.waitForTimeout(2500);
  // A tap on a touch screen, a click otherwise. The software renderer
  // these tests run on is slow, so actions get time.
  const press = async (sel) => { const l = page.locator(sel).first(); if (size.touch) await l.tap({ timeout: 30000 }); else await l.click({ timeout: 30000 }); };
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/tienda-${size.name}-${name}.png` }); };
  return { ctx, page, errs, press, shot };
}
const inView = (b, size, pad = 0) => !!b && b.x >= -pad && b.y >= -pad && b.x + b.width <= size.w + pad && b.y + b.height <= size.h + pad;
// Is the element at its own centre the control itself (nothing over it)?
const reachable = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return !!top && (top === el || el.contains(top));
}, sel);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);

/* ---- every screen ---- */
const SIZES = [
  { name: "phone-small", w: 320, h: 568, touch: true },
  { name: "phone", w: 375, h: 667, touch: true },
  { name: "phone-tall", w: 390, h: 844, touch: true },
  { name: "phone-large", w: 430, h: 932, touch: true },
  { name: "phone-landscape", w: 844, h: 390, touch: true },
  { name: "tablet", w: 768, h: 1024, touch: true },
  { name: "tablet-landscape", w: 1024, h: 768, touch: true },
  { name: "laptop", w: 1366, h: 768 },
  { name: "laptop-large", w: 1440, h: 900 },
  { name: "desktop", w: 1920, h: 1080 },
];
for (const size of SIZES) {
  console.log(`\n${size.name} (${size.w} × ${size.h}${size.touch ? ", touch" : ""})`);
  const { ctx, page, errs, press, shot } = await open(size);
  const lid = page.locator('[data-testid="tienda-lid"]');
  check("the boxed game shows on the lid", (await lid.count()) === 1);
  const openBtn = await page.locator('[data-testid="tienda-open-box"]').boundingBox();
  const orderBtn = await page.locator('[data-testid="tienda-lid-order"]').boundingBox();
  check("Open the box and Custom rules are on screen", inView(openBtn, size) && inView(orderBtn, size), JSON.stringify({ openBtn, orderBtn }));
  check("...and big enough to tap", openBtn && openBtn.height >= 40 && orderBtn && orderBtn.height >= 40, `${openBtn && openBtn.height} / ${orderBtn && orderBtn.height}`);
  check("the page doesn't scroll sideways (lid)", await noSideScroll(page));
  await shot("1-lid");
  await press('[data-testid="tienda-open-box"]');
  await page.waitForTimeout(1500);
  check("opening the box puts the lid away", (await lid.count()) === 0);
  const state = await page.evaluate(() => ({ store: window.__TIENDA_STORE__, tier: window.__TIENDA_QUALITY__, pr: window.__TIENDA_PIXEL_RATIO__, dpr: window.devicePixelRatio, audio: window.__TIENDA_AUDIO__ ? window.__TIENDA_AUDIO__() : null }));
  check(`the store is round the board (tier ${state.tier}, pixel ratio ${state.pr})`, state.store === true && ["low", "mid", "high"].includes(state.tier) && state.pr > 0.8 && state.pr <= Math.min(2, state.dpr) + 1e-6, JSON.stringify(state));
  check("the store's sound started with the tap", !!(state.audio && state.audio.ctx && state.audio.storeOn), JSON.stringify(state.audio));
  if (size === SIZES[0] || size === SIZES[7]) {
    // The tape: fetched, decoded, and running through the ceiling speakers.
    let tape = null;
    for (let i = 0; i < 20; i++) { tape = await page.evaluate(() => window.__TIENDA_AUDIO__()); if (tape.playing === "tape" && tape.tapeTime > 1) break; await page.waitForTimeout(500); }
    check(`the store's tape is playing (${tape.tape}, ${tape.playing}, ${tape.tapeTime.toFixed(1)}s of ${tape.tapeLength.toFixed(0)}s)`, tape.tape === "ready" && tape.playing === "tape" && tape.tapeTime > 1 && tape.tapeLength > 150);
  }
  if (size === SIZES[0] || size === SIZES[7]) {
    // How to play: the rules leaflet, on newsprint, torn at the edges.
    await press('[data-testid="how-to-play"]');
    await page.waitForTimeout(1200);
    const leaf = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="info-overlay"] > div');
      const cs = getComputedStyle(card), b = card.getBoundingClientRect();
      return { open: document.querySelector('[data-testid="info-overlay"]').dataset.open, clip: cs.clipPath.slice(0, 8), paper: /data:image\/png/.test(cs.backgroundImage), x: b.x, w: b.width, y: b.y, h: b.height };
    });
    check("How to play opens the leaflet, printed on newsprint with a torn edge", leaf.open === "true" && leaf.clip === "polygon(" && leaf.paper, JSON.stringify(leaf));
    check("...and it fits the screen", leaf.x >= 0 && leaf.x + leaf.w <= size.w + 1 && leaf.y >= 0 && leaf.y + leaf.h <= size.h + 1, JSON.stringify(leaf));
    await shot("2b-leaflet");
    await page.mouse.click(4, 4);
    await page.waitForTimeout(700);
  }
  const title = await page.locator(".ec-title").first().boundingBox();
  check("the masthead is on screen", inView(title, size, 1), JSON.stringify(title));
  check("How to play isn't covered", await reachable(page, '[data-testid="how-to-play"]'));
  check("the page doesn't scroll sideways (table)", await noSideScroll(page));
  await shot("2-table");
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- the order form, and a game to a win, on a phone and a laptop ---- */
for (const size of [SIZES[2], SIZES[7]]) {
  console.log(`\n${size.name}: order form`);
  let { ctx, page, errs, press, shot } = await open(size);
  await press('[data-testid="tienda-lid-order"]');
  await page.waitForTimeout(1200);
  const form = page.locator('[data-testid="tienda-order"]');
  check("Custom rules opens the order form", (await form.count()) === 1);
  const sheet = await page.evaluate(() => { const el = document.querySelector('[data-testid="tienda-order"] .td-form, [data-testid="tienda-order"] > *'); const r = el.getBoundingClientRect(); return { x: r.x, w: r.width }; });
  check("the form fits the screen's width", sheet.x >= 0 && sheet.x + sheet.w <= size.w + 1, JSON.stringify(sheet));
  check("the page doesn't scroll sideways (form)", await noSideScroll(page));
  await shot("3-order");
  await press('[data-testid="tienda-piece-rayo-inc"]');
  await press('[data-testid="tienda-law-diagonalSlide"]');
  await press('[data-testid="tienda-size-12"]');
  await page.waitForTimeout(300);
  const laws = await page.evaluate(() => ({
    slide: document.querySelector('[data-testid="tienda-law-slide-input"]').checked,
    diag: document.querySelector('[data-testid="tienda-law-diagonalSlide-input"]').checked,
  }));
  check("checking Diagonal slide checks Slide too", laws.slide && laws.diag, JSON.stringify(laws));
  check("a Rayo makes six pieces a side", (await page.locator('[data-testid="tienda-piece-total"]').innerText()).includes("6 of"));

  // The board: any width and length, not just the square sizes.
  await press('[data-testid="tienda-size-12"]');
  await press('[data-testid="tienda-cols-inc"]');
  await press('[data-testid="tienda-cols-inc"]');
  await page.waitForTimeout(300);
  const diag = await page.evaluate(() => { const d = document.querySelector('[data-testid="tienda-board-diagram"]'); return { cols: d.dataset.cols, rows: d.dataset.rows }; });
  const summary = await page.locator('[data-testid="tienda-order-summary"]').innerText();
  check("width and length set apart: 14 across, 12 long (diagram and summary agree)", diag.cols === "14" && diag.rows === "12" && summary.includes("14 × 12"), `${JSON.stringify(diag)} ${summary}`);

  // Sample the wares: a piece taken up off the page in 3-D.
  await page.locator('[data-testid="tienda-view-opa"]').scrollIntoViewIfNeeded();
  await press('[data-testid="tienda-view-opa"]');
  await page.waitForTimeout(1500);
  const viewer = page.locator('[data-testid="tienda-piece-viewer"]');
  const yaw = () => page.evaluate(() => (window.__TIENDA_PIECE_VIEWER__ ? window.__TIENDA_PIECE_VIEWER__.yaw() : null));
  const y0 = await yaw();
  await page.waitForTimeout(900);
  const y1 = await yaw();
  check(`tapping the Opa's photograph takes it up in 3-D, turning by itself (${y0 && y0.toFixed(2)} → ${y1 && y1.toFixed(2)})`,
    (await viewer.getAttribute("data-state")) === "open" && (await viewer.getAttribute("data-piece")) === "opa" && y1 > y0);
  const vb = await page.locator('[data-testid="tienda-piece-viewer-canvas"]').boundingBox();
  check("...large and on screen", vb && vb.width >= Math.min(size.w * 0.6, 280) && inView(vb, size, 1), JSON.stringify(vb));
  await page.mouse.move(vb.x + vb.width * 0.3, vb.y + vb.height / 2);
  await page.mouse.down();
  await page.mouse.move(vb.x + vb.width * 0.5, vb.y + vb.height / 2, { steps: 4 });
  await page.mouse.move(vb.x + vb.width * 0.7, vb.y + vb.height / 2, { steps: 4 });
  await page.mouse.up();
  const y2 = await yaw();
  check(`...a drag turns it (${y1.toFixed(2)} → ${y2.toFixed(2)})`, y2 - y1 > 0.8);
  await press('[data-testid="tienda-viewer-ash"]');
  await page.waitForTimeout(300);
  check("...and it comes in olive ash as well as walnut", (await page.evaluate(() => window.__TIENDA_PIECE_VIEWER__.wood())) === "ash");
  await shot("4b-viewer");
  await page.mouse.click(6, 6);
  for (let i = 0; i < 12 && (await viewer.count()); i++) await page.waitForTimeout(250);
  const formStays = (await page.locator('[data-testid="tienda-order"]').count()) === 1;
  check("tapping outside puts it back; the order form stays", (await viewer.count()) === 0 && formStays, `viewer ${await viewer.count()}, form ${formStays}`);

  // Pieces that won't fit the width: said plainly, and fixable.
  await press('[data-testid="tienda-piece-opa-inc"]');
  await press('[data-testid="tienda-piece-opa-inc"]');
  for (let i = 0; i < 8; i++) await press('[data-testid="tienda-cols-dec"]');
  await page.waitForTimeout(300);
  const warn = page.locator('[data-testid="tienda-fit-warning"]');
  check("8 pieces with 3 Opas on a 6-wide board: a warning, and no ordering",
    (await warn.count()) === 1 && (await page.locator('[data-testid="tienda-order-place"]').isDisabled()), await warn.innerText().catch(() => "no warning"));
  await press('[data-testid="tienda-fit-fix"]');
  await page.waitForTimeout(300);
  const width = +(await page.locator('[data-testid="tienda-cols-value"]').innerText());
  check(`"Make it N wide" widens the board until they fit (${width})`, (await warn.count()) === 0 && width > 6 && !(await page.locator('[data-testid="tienda-order-place"]').isDisabled()));
  await page.locator('[data-testid="tienda-order-place"]').scrollIntoViewIfNeeded();
  await shot("4-order-filled");
  await press('[data-testid="tienda-order-place"]');
  await page.waitForTimeout(3500);
  const game = await page.evaluate(() => {
    const t = window.__TIENDA_THREE__, slab = t && t.boardGroup.getObjectByName("ec-slab");
    const img = slab && slab.material[2].map && slab.material[2].map.image;
    const pieces = window.__EC_TEST_PIECES__ || [];
    return {
      board: window.__EC_TEST_BOARD__, pieces: pieces.length, opas: pieces.filter((p) => p.type === "opa").length,
      plate: slab ? +(slab.geometry.parameters.width / slab.geometry.parameters.depth).toFixed(3) : null,
      paint: img ? +(img.width / img.height).toFixed(3) : null,
    };
  });
  const status = (await page.locator('[data-testid="turn-status"]').innerText()).trim();
  check(`placing the order starts that game (${JSON.stringify(game)}, "${status}")`,
    game.board && game.board.rows === 12 && game.board.cols === width && game.pieces === 16 && game.opas === 6 && /to move/i.test(status));
  check("...on a board painted for its size (the squares aren't stretched)", game.plate && Math.abs(game.plate - game.paint) < 0.03);
  await shot("5-custom-game");
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();

  console.log(`\n${size.name}: a game to a win`);
  ({ ctx, page, errs, press, shot } = await open(size));
  await press('[data-testid="tienda-open-box"]');
  await page.waitForTimeout(1200);
  await openDockPanel(page);
  await page.evaluate(() => window.__EC_TEST_SET_PIECES__([
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 7, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: 1, col: 5, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
  ]));
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Begin Game")').first().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, Math.round(size.h * 0.4)); await page.waitForTimeout(800); }
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "S"));
  await page.waitForTimeout(1800);
  const pts = page.locator('[data-testid="points-counter"]');
  check("the points tag shows one point left", (await pts.count()) === 1 && (await pts.getAttribute("data-left")) === "1");
  check("...on screen", inView(await pts.boundingBox(), size));
  await shot("6-points");
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-cabeza", "S"));
  await page.waitForTimeout(5000);
  const placard = page.locator('[data-testid="victory-placard"]');
  check("the Cabeza reaching the far row puts up the win placard", (await placard.count()) === 1 && /dark wins/i.test(await placard.innerText()));
  check("...on screen", inView(await placard.boundingBox(), size, 1));
  const wound = await page.evaluate(() => window.__TIENDA_AUDIO__());
  check("the music winds down at the end of the game", wound.windingDown === true, JSON.stringify(wound));
  await page.waitForTimeout(3500);
  const hushed = await page.evaluate(() => window.__TIENDA_AUDIO__());
  check("...and the tape stops, keeping its place", hushed.playing === null && hushed.music === false && hushed.tapeTime > 0, JSON.stringify(hushed));
  await shot("7-won");
  await page.locator('[data-testid="victory-placard"] button:has-text("Move Log")').click({ timeout: 30000 });
  await page.waitForTimeout(1000);
  const tape = page.locator('[data-testid="movelog-sheet"]');
  const tb = await tape.boundingBox();
  check("Move Log opens the register tape", (await tape.count()) === 1 && /C: S\.S/.test(await tape.innerText()));
  check("...narrow as tape, and on screen", tb && tb.width <= 361 && inView(tb, size, 1), JSON.stringify(tb));
  await shot("8-tape");
  await page.locator('[data-testid="movelog-sheet"] button:has-text("New Game")').click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    let stores = 0;
    window.__TIENDA_THREE__.boardGroup.children.forEach((o) => { if (o.name === "tienda-store") stores++; });
    return { stores, pieces: (window.__EC_TEST_PIECES__ || []).length };
  });
  check("New Game sets the table again, in one store", after.stores === 1 && after.pieces > 0, JSON.stringify(after));
  check("the page doesn't scroll sideways (after the game)", await noSideScroll(page));
  await shot("9-new-game");
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- the page on its own (no tape beside it): the arrangements play ---- */
console.log("\nthe page alone, without its tape");
{
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`file://${DIST}/el-cabeza-tienda.html`);
  await page.waitForTimeout(2500);
  await page.locator('[data-testid="tienda-open-box"]').click({ timeout: 30000 });
  let st = null;
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(500); st = await page.evaluate(() => window.__TIENDA_AUDIO__()); if (st.playing === "piece") break; }
  check(`without the tape the store plays its own arrangements (${st.tape}, ${st.playing})`, st.tape === "failed" && st.playing === "piece" && st.notes > 0);
  check("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall tienda checks passed");
process.exit(failures ? 1 : 0);
