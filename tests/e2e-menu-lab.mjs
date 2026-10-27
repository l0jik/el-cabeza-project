/* The menu lab (?menulab; user, 2026-10-27: "create a testing lab for
   this ... I'm thinking fly out menus ... Create 10 versions fully
   functional in a lab outside of the chat"; chassis/menu-lab.js).

   On a phone in the store, each of the ten versions: a tap on the piece
   flies its menu out (every button on the screen, each one where a tap
   finds it, none on another, the piece still there to tap), a tap outside
   puts it away and the piece back where it rests. Its buttons do what the
   panel's do: a level chosen from Speed dial's choices, Just three's level
   moved on by a tap, the cart filled with the Ring kept out, the start and
   then the panel from Two steps' second step, the catalog from Pill row,
   the panel from Crown's More, and the game begun from Thumb's Try a Game.
   A new player's first look holds back here what the panel holds back. In
   another world on a desktop, by mouse: who to play, then the levels once
   the computer's picked; Escape puts the menu away; the bar's ✕ leaves the
   lab, and then the piece opens the panel as ever.

   node tests/e2e-menu-lab.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const NOIR = "file:///home/user/el-cabeza-project/dist/el-cabeza-noir.html";
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
const W = 360, H = 800;

async function store({ toured = true, version = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ toured }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (toured) localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) { /* none */ }
  }, { toured });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${NOVA}?menulab=${version}`);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

const isOpen = (page) => page.evaluate(() => !!document.querySelector('[data-testid="menu-lab"][data-open="true"]'));
const panelOpen = (page) => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
async function tapPiece(page, touch = true) {
  const b = await page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
  if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
// The piece tapped till the menu's out (a tap can land while it bounces).
async function openMenu(page, touch = true) {
  for (let i = 0; i < 5; i++) {
    if (await isOpen(page)) return true;
    await tapPiece(page, touch);
    if (await poll(() => isOpen(page), 2500, 100)) return true;
  }
  return false;
}
// The open menu's buttons, as they sit (each where a tap at its middle, or
// at its name for a wedge, lands), once their flight's done.
const readItems = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="menu-lab"][data-open="true"] [data-ml-item]')].map((n) => {
  const r = n.getBoundingClientRect(), key = n.getAttribute("data-ml-item");
  const lab = n.tagName.toLowerCase() === "g" ? document.querySelector(`[data-testid="menu-lab"][data-open="true"] [data-ml-label="${key}"]`) : null;
  const at = lab ? lab.getBoundingClientRect() : r;
  const px = at.x + at.width / 2, py = at.y + at.height / 2;
  const hit = document.elementFromPoint(px, py);
  // (out: flown, at its full size; a wedge opened, not turned)
  const cs = getComputedStyle(n);
  const out = lab ? cs.opacity === "1" && (cs.transform === "none" || cs.transform === "matrix(1, 0, 0, 1, 0, 0)") : Math.abs(r.width - n.offsetWidth) < 0.5 && cs.opacity === "1";
  return { key, x: r.x, y: r.y, w: r.width, h: r.height, wedge: !!lab, out, held: n.getAttribute("aria-disabled") === "true", label: n.getAttribute("aria-label"), hit: hit && hit.closest("[data-ml-item]") ? hit.closest("[data-ml-item]").getAttribute("data-ml-item") : null };
}));
async function settled(page) {
  let last = "";
  for (let i = 0; i < 40; i++) {
    const items = await readItems(page);
    const now = JSON.stringify(items.map((i) => [i.key, Math.round(i.x), Math.round(i.y), Math.round(i.w), Math.round(i.h)]));
    if (now === last && items.length && items.every((i) => i.out)) return readItems(page);
    last = now;
    await page.waitForTimeout(150);
  }
  return readItems(page);
}
const item = async (page, key) => (await readItems(page)).find((i) => i.key === key);
// A tap on one of the menu's buttons (a wedge: on its name).
async function tapItem(page, key) {
  const it = await item(page, key);
  if (!it) return false;
  const p = await page.evaluate((key) => {
    const lab = document.querySelector(`[data-testid="menu-lab"][data-open="true"] [data-ml-label="${key}"]`);
    const n = lab || document.querySelector(`[data-testid="menu-lab"][data-open="true"] [data-ml-item="${key}"]`);
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, key);
  await page.touchscreen.tap(p.x, p.y);
  return true;
}
const pieceAtRest = (page) => page.evaluate(() => document.querySelector("[data-dock-piece]").style.transform === "translateX(-50%) scale(1)");
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const NAMES = ["Ring", "Crown", "Wedges", "Fan", "Speed dial", "Pill row", "Pill arc", "Just three", "Two steps", "Thumb"];
const ALL = ["play", "level", "pieces", "cart", "more"];

console.log("The store, on a phone: each version out and away");
{
  const { ctx, page, errs } = await store();
  check("the lab's bar is up, on version 1", await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="menu-lab-bar"]') && document.querySelector('[data-testid="menu-lab-pick"]').value === "0"), 15000));
  for (let v = 1; v <= 10; v++) {
    await page.selectOption('[data-testid="menu-lab-pick"]', String(v - 1));
    const opened = await openMenu(page);
    check(`${v} ${NAMES[v - 1]}: a tap on the piece flies it out`, opened);
    if (!opened) continue;
    await page.waitForTimeout(500);
    const items = await settled(page);
    const keys = items.map((i) => i.key).sort().join();
    check(`${v}: its buttons (${keys})`, keys === (v === 8 || v === 9 ? ["play", "level", "more"] : ALL).sort().join());
    const off = items.filter((i) => i.x < -0.5 || i.y < -0.5 || i.x + i.w > W + 0.5 || i.y + i.h > H + 0.5);
    check(`${v}: every one on the screen`, !off.length, off.map((i) => `${i.key} ${Math.round(i.x)},${Math.round(i.y)} ${Math.round(i.w)}x${Math.round(i.h)}`).join("; "));
    const lost = items.filter((i) => i.hit !== i.key);
    check(`${v}: a tap finds each one`, !lost.length, lost.map((i) => `${i.key} -> ${i.hit}`).join("; "));
    const flat = items.filter((i) => !i.wedge), clash = [];
    for (let a = 0; a < flat.length; a++) for (let b = a + 1; b < flat.length; b++) if (overlap(flat[a], flat[b]) > 1) clash.push(`${flat[a].key}/${flat[b].key}`);
    check(`${v}: none on another`, !clash.length, clash.join(", "));
    const onPiece = await page.evaluate(() => {
      const r = document.querySelector('canvas[data-testid="dock-piece-canvas"]').getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!(e && e.closest("[data-dock-piece]"));
    });
    check(`${v}: the piece still there to tap`, onPiece);
    await page.touchscreen.tap(12, 240);
    check(`${v}: a tap outside puts it away`, await poll(async () => !(await isOpen(page)), 3000, 100));
    check(`${v}: the piece back where it rests`, await poll(() => pieceAtRest(page), 3000, 100));
    check(`${v}: the panel not opened`, !(await panelOpen(page)));
    await page.waitForTimeout(700);
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The store, on a phone: the buttons at work");
{
  const { ctx, page, errs } = await store({ version: 5 });
  const diff = (k) => page.evaluate((k) => { const b = document.querySelector(`[data-ec-diff="${k}"]`); return !!b && b.getAttribute("aria-pressed") === "true"; }, k);

  // Speed dial: the level from its choices.
  await openMenu(page);
  await settled(page);
  await tapItem(page, "level");
  check("Speed dial: the level's choices fly out (Easy, Medium, Hard)", await poll(() => page.evaluate(() => document.querySelectorAll('[data-testid="menu-lab-choices"] [data-ml-choice]').length === 3), 3000, 100));
  const medium = await page.locator('[data-ml-choice="medium"]').boundingBox();
  await page.touchscreen.tap(medium.x + medium.width / 2, medium.y + medium.height / 2);
  check("...Medium chosen is the panel's Medium", await poll(() => diff("medium"), 3000, 100));
  check("...the button says Medium", await poll(async () => /medium/i.test((await item(page, "level") || {}).label || ""), 3000, 100));
  check("...and the choices fold away, the menu still out", await poll(async () => (await page.locator('[data-testid="menu-lab-choices"]').count()) === 0 && (await isOpen(page)), 3000, 100));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Just three: a tap moves the level on.
  await page.selectOption('[data-testid="menu-lab-pick"]', "7");
  await openMenu(page);
  await settled(page);
  await tapItem(page, "level");
  check("Just three: a tap on the level moves it on (Medium to Hard)", await poll(() => diff("hard"), 3000, 100));
  await page.waitForTimeout(400);
  await tapItem(page, "level");
  check("...and round again (Hard to Easy)", await poll(() => diff("easy"), 3000, 100));
  check("...the menu still out", await isOpen(page));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Ring: into the cart, the menu kept out.
  await page.selectOption('[data-testid="menu-lab-pick"]', "0");
  await openMenu(page);
  await settled(page);
  await tapItem(page, "cart");
  check("Ring: the cart button puts one in the cart", await poll(() => page.evaluate(() => document.querySelector('[data-testid="story-purchase"]').getAttribute("data-cart") === "full"), 3000, 100));
  check("...the menu still out, the button now Check out", await poll(async () => (await isOpen(page)) && /check out/i.test((await item(page, "cart") || {}).label || ""), 3000, 100));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Two steps: More's own, the start, then the panel.
  await page.selectOption('[data-testid="menu-lab-pick"]', "8");
  await openMenu(page);
  await settled(page);
  await tapItem(page, "more");
  check("Two steps: More flies out its own (the pieces, the cart, the start, all settings)", await poll(() => page.evaluate(() => ["pieces", "cart", "start", "all"].every((k) => !!document.querySelector(`[data-testid="menu-lab"] .ml-sub [data-ml-item="${k}"]`))), 3000, 100));
  await page.waitForTimeout(700);
  await tapItem(page, "start");
  await poll(() => page.evaluate(() => !!document.querySelector('[data-ml-choice="start-by-hand"]')), 3000, 100);
  let b = await page.locator('[data-ml-choice="start-by-hand"]').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  check("...the start: Manual is the panel's Manual", await poll(() => page.evaluate(() => document.querySelector('[data-testid="start-by-hand"]').getAttribute("aria-pressed") === "true"), 3000, 100));
  await page.waitForTimeout(500);
  await tapItem(page, "start");
  await poll(() => page.evaluate(() => !!document.querySelector('[data-ml-choice="start-standard"]')), 3000, 100);
  b = await page.locator('[data-ml-choice="start-standard"]').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  check("...and Standard again", await poll(() => page.evaluate(() => document.querySelector('[data-testid="start-standard"]').getAttribute("aria-pressed") === "true"), 3000, 100));
  await page.waitForTimeout(500);
  await tapItem(page, "all");
  check("...All settings: the panel, the menu away", await poll(async () => (await panelOpen(page)) && !(await isOpen(page)), 4000, 100));
  await page.waitForTimeout(800);
  await page.touchscreen.tap(12, 240);
  check("...the panel put away by a tap outside", await poll(async () => !(await panelOpen(page)), 4000, 100));
  await page.waitForTimeout(800);

  // Pill row: the catalog.
  await page.selectOption('[data-testid="menu-lab-pick"]', "5");
  await openMenu(page);
  await settled(page);
  await tapItem(page, "pieces");
  check("Pill row: See the pieces opens the catalog", await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="tienda-catalog"]')), 6000, 100));
  check("...the menu away", !(await isOpen(page)));
  await page.locator('[data-testid="tienda-catalog-close"]').tap();
  await poll(() => page.evaluate(() => !document.querySelector('[data-testid="tienda-catalog"]')), 6000, 100);
  await page.waitForTimeout(800);

  // Crown: More is the panel.
  await page.selectOption('[data-testid="menu-lab-pick"]', "1");
  await openMenu(page);
  await settled(page);
  await tapItem(page, "more");
  check("Crown: More opens the panel", await poll(() => panelOpen(page), 4000, 100));
  await page.waitForTimeout(800);
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await panelOpen(page)), 4000, 100);
  await page.waitForTimeout(800);

  // Thumb: Try a Game begins the game.
  await page.selectOption('[data-testid="menu-lab-pick"]', "9");
  await openMenu(page);
  await settled(page);
  check("Thumb: the piece moved into the corner while it's out", await page.evaluate(() => /translate\(calc\(-50% \+ \d/.test(document.querySelector("[data-dock-piece]").style.transform)));
  await tapItem(page, "play");
  check("...Try a Game begins the game (the piece to its corner)", await poll(() => page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)"), 8000, 100));
  check("...the menu away", !(await isOpen(page)));
  check("...the bar says the menu's for before a game", await poll(() => page.evaluate(() => /Before a game/.test(document.querySelector('[data-testid="menu-lab-about"]').textContent)), 3000, 100));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("A new player's first look");
{
  const { ctx, page, errs } = await store({ toured: false, version: 1 });
  await openMenu(page);
  const items = await settled(page);
  const held = (k) => (items.find((i) => i.key === k) || {}).held;
  check("Try a Game and See the pieces pressable", held("play") === false && held("pieces") === false);
  check("the level and the cart held back, as in the panel", held("level") === true && held("cart") === true);
  await tapItem(page, "level");
  await page.waitForTimeout(600);
  check("...a tap on the level brings no choices, changes nothing", (await page.locator('[data-testid="menu-lab-choices"]').count()) === 0 && (await page.evaluate(() => document.querySelector('[data-ec-diff="easy"]').getAttribute("aria-pressed") === "true")));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Noir, on a desktop");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${NOIR}?menulab=3`);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  check("the menu (Wedges) out by a click on the piece", await openMenu(page, false));
  let items = await settled(page);
  check("...with the game's start and More", items.some((i) => i.key === "play") && items.some((i) => i.key === "more"));
  let level = items.find((i) => i.key === "level");
  check("...and who to play, or the level", !!level, items.map((i) => i.key).join());
  if (level && !/easy|medium|hard/i.test(level.label)) {
    await page.evaluate(() => {
      const n = document.querySelector('[data-testid="menu-lab"][data-open="true"] [data-ml-label="level"]').getBoundingClientRect();
      window.__mlAt = { x: n.x + n.width / 2, y: n.y + n.height / 2 };
    });
    const at = await page.evaluate(() => window.__mlAt);
    await page.mouse.click(at.x, at.y);
    await poll(() => page.evaluate(() => !!document.querySelector('[data-ml-choice="ai-dark"]')), 3000, 100);
    const c = await page.locator('[data-ml-choice="ai-dark"]').boundingBox();
    await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
    check("...the computer picked: the levels in its place", await poll(async () => /easy|medium|hard/i.test(((await item(page, "level")) || {}).label || ""), 4000, 100));
    check("...the panel's own picker agrees", await page.evaluate(() => !!document.querySelector("[data-ec-diff]")));
  }
  await page.keyboard.press("Escape");
  check("Escape puts it away", await poll(async () => !(await isOpen(page)), 3000, 100));
  await page.waitForTimeout(700);
  await Promise.all([page.waitForURL((u) => !/menulab/.test(u.toString()), { timeout: 30000 }), page.locator('[data-testid="menu-lab-exit"]').click()]);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  check("✕ leaves the lab (no bar, no ?menulab)", !(await page.evaluate(() => !!document.querySelector('[data-testid="menu-lab-bar"]'))) && !/menulab/.test(page.url()));
  check("...and the piece opens the panel as ever", await openDockPanel(page));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
