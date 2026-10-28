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
// A version picked from the lab's bar by its number ("4", "4.2").
async function pick(page, n) {
  const at = await page.evaluate((n) => [...document.querySelectorAll('[data-testid="menu-lab-pick"] option')].findIndex((o) => o.textContent.startsWith(`${n} · `)), String(n));
  await page.selectOption('[data-testid="menu-lab-pick"]', String(at));
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
    await pick(page, v);
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
  await pick(page, 8);
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
  await pick(page, 1);
  await openMenu(page);
  await settled(page);
  await tapItem(page, "cart");
  check("Ring: the cart button puts one in the cart", await poll(() => page.evaluate(() => document.querySelector('[data-testid="story-purchase"]').getAttribute("data-cart") === "full"), 3000, 100));
  check("...the menu still out, the button now Check out", await poll(async () => (await isOpen(page)) && /check out/i.test((await item(page, "cart") || {}).label || ""), 3000, 100));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Two steps: More's own, the start, then the panel.
  await pick(page, 9);
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
  await pick(page, 6);
  await openMenu(page);
  await settled(page);
  await tapItem(page, "pieces");
  check("Pill row: See the pieces opens the catalog", await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="tienda-catalog"]')), 6000, 100));
  check("...the menu away", !(await isOpen(page)));
  await page.locator('[data-testid="tienda-catalog-close"]').tap();
  await poll(() => page.evaluate(() => !document.querySelector('[data-testid="tienda-catalog"]')), 6000, 100);
  await page.waitForTimeout(800);

  // Crown: More is the panel.
  await pick(page, 2);
  await openMenu(page);
  await settled(page);
  await tapItem(page, "more");
  check("Crown: More opens the panel", await poll(() => panelOpen(page), 4000, 100));
  await page.waitForTimeout(800);
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await panelOpen(page)), 4000, 100);
  await page.waitForTimeout(800);

  // Thumb: Try a Game begins the game.
  await pick(page, 10);
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

/* The fans (user, 2026-10-27: "I want 4 Fan, but I want to be able to
   spin / rotate the menu to access all settings, ultimately, fully
   replacing the button dock. Give me 5 revisions of this one";
   chassis/menu-fan.js). */
// The open fan as it is: its settings (each where its name is, how
// showing, what a tap there finds, its angle about the hub), the one at
// its point, the read-out.
const fan = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="menu-lab"][data-open="true"]');
  const stage = layer && layer.querySelector('[data-testid="menu-fan"]');
  if (!stage) return null;
  const hx = parseFloat(layer.style.getPropertyValue("--hx")), hy = parseFloat(layer.style.getPropertyValue("--hy"));
  const slots = [...layer.querySelectorAll("[data-ml-item]")].map((n) => {
    const key = n.getAttribute("data-ml-item");
    const at = (layer.querySelector(`[data-ml-label="${key}"]`) || n.querySelector(".mf-dot") || n).getBoundingClientRect();
    const x = at.x + at.width / 2, y = at.y + at.height / 2;
    const hit = document.elementFromPoint(x, y);
    const op = +(n.getAttribute("opacity") ?? getComputedStyle(n).opacity);
    return { key, x, y, op, angle: (Math.atan2(y - hy, x - hx) * 180) / Math.PI, hit: hit && hit.closest("[data-ml-item]") ? hit.closest("[data-ml-item]").getAttribute("data-ml-item") : null };
  });
  const focus = layer.querySelector("[data-ml-item].mf-focus");
  const read = layer.querySelector('[data-testid="menu-fan-read"]');
  const primary = layer.querySelector('[data-testid="menu-fan-primary"]');
  return {
    id: stage.getAttribute("data-fan"), phase: layer.getAttribute("data-phase"), keys: slots.map((s) => s.key), slots,
    focus: focus ? focus.getAttribute("data-ml-item") : null, read: read ? read.textContent.replace(/\s+/g, " ").trim() : "",
    primary: primary && primary.style.display !== "none" ? primary.textContent.trim() : null, stage: getComputedStyle(stage).opacity, turning: stage.getAttribute("data-turning") === "true",
  };
});
// Still: out, and not turning.
async function fanStill(page) {
  let last = "";
  for (let i = 0; i < 40; i++) {
    const f = await fan(page);
    const now = f ? JSON.stringify(f.slots.map((s) => [s.key, Math.round(s.x), Math.round(s.y)])) : "";
    if (f && f.stage === "1" && !f.turning && now === last) return f;
    last = now;
    await page.waitForTimeout(150);
  }
  return fan(page);
}
// A finger along the fan's arc (CDP touch, as a phone's), from a0 to a1
// degrees about the hub.
async function swipe(page, cdp, a0, a1, r = 130) {
  const c = await page.evaluate(() => { const l = document.querySelector('[data-testid="menu-lab"][data-open="true"]'); return { x: parseFloat(l.style.getPropertyValue("--hx")), y: parseFloat(l.style.getPropertyValue("--hy")) }; });
  const at = (a) => ({ x: c.x + r * Math.cos((a * Math.PI) / 180), y: c.y + r * Math.sin((a * Math.PI) / 180) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(a0)] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(a0 + ((a1 - a0) * i) / 12)] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// A tap on a fan's setting (on its name; a Rail stop on its dot).
async function tapSlot(page, key) {
  const s = ((await fan(page)) || { slots: [] }).slots.find((x) => x.key === key);
  if (!s) return false;
  await page.touchscreen.tap(s.x, s.y);
  return true;
}
const SETUP = ["first", "opponent", "level", "start", "pieces", "cart", "check", "points", "costs", "guide", "sound", "language", "replay", "saves", "bar"];
const FANS = [["4.1", "dial", -90], ["4.2", "rings", -90], ["4.3", "rail", -90], ["4.4", "pages", -90], ["4.5", "corner", -135]];

console.log("The fans, on a phone in the store: every setting, turned");
{
  const { ctx, page, errs } = await store({ version: "4.1" });
  const cdp = await ctx.newCDPSession(page);
  check("?menulab=4.1 opens on the Dial", await page.evaluate(() => /^4\.1 · Dial/.test(document.querySelector('[data-testid="menu-lab-pick"]').selectedOptions[0].textContent)));
  for (const [n, id, point] of FANS) {
    await pick(page, n);
    const opened = await openMenu(page);
    let f = opened ? await fanStill(page) : null;
    check(`${n} ${id}: a tap on the piece brings the fan out`, !!f && f.id === id && f.phase === "setup");
    if (!f) continue;
    check(`${n}: every setting the panel has before a game`, SETUP.every((k) => f.keys.includes(k)), f.keys.join());
    check(`${n}: Try a Game above it`, /try a game/i.test(f.primary || ""), f.primary);
    const shown = f.slots.filter((s) => s.op > 0.9);
    const off = shown.filter((s) => s.x < 0 || s.x > W || s.y < 0 || s.y > H);
    check(`${n}: those showing on the screen (${shown.map((s) => s.key).join()})`, shown.length >= 3 && !off.length, off.map((s) => s.key).join());
    const lost = shown.filter((s) => s.hit !== s.key);
    check(`${n}: a tap finds each one showing`, !lost.length, lost.map((s) => `${s.key} -> ${s.hit}`).join("; "));
    if (id === "pages") {
      check("4.4: the first page is the game's, said in the read-out", /^‹ ?Game/.test(f.read) && shown.every((s) => ["first", "opponent", "level"].includes(s.key)), f.read);
      await page.locator('[data-testid="menu-fan-next"]').tap();
      f = await fanStill(page);
      check("4.4: › turns the page (the board's)", /Board/.test(f.read) && f.slots.filter((s) => s.op > 0.9).every((s) => ["start", "pieces", "cart"].includes(s.key)), f.read);
      await swipe(page, cdp, -40, -140);
      f = await fanStill(page);
      check("4.4: a swipe turns it on a page (the hints')", /Hints/.test(f.read), f.read);
    } else {
      const atPoint = f.slots.find((s) => s.key === f.focus);
      check(`${n}: the first setting at the point, named in the read-out`, f.focus === "first" && !!atPoint && Math.abs(atPoint.angle - point) < 4 && /First move/i.test(f.read), `${f.focus} ${atPoint && Math.round(atPoint.angle)} ${f.read}`);
      await page.locator('[data-testid="menu-fan-next"]').tap();
      f = await fanStill(page);
      check(`${n}: › turns it on one (Opponent)`, f.focus === "opponent" && /Opponent/i.test(f.read), `${f.focus} ${f.read}`);
      await swipe(page, cdp, id === "corner" ? -100 : -40, id === "corner" ? -170 : -150);
      f = await fanStill(page);
      const now = f.slots.find((s) => s.key === f.focus);
      check(`${n}: a finger along it turns it, and it settles with one at the point`, !!now && !["first", "opponent"].includes(f.focus) && Math.abs(now.angle - point) < 4, `${f.focus} ${now && Math.round(now.angle)}`);
      check(`${n}: ...named in the read-out`, !!now && f.read.toLowerCase().includes(await page.evaluate((k) => document.querySelector(`[data-ml-item="${k}"]`).getAttribute("aria-label").split(":")[0].toLowerCase(), f.focus)), f.read);
    }
    await page.touchscreen.tap(12, 240);
    check(`${n}: a tap outside puts it away, the piece back where it rests`, (await poll(async () => !(await isOpen(page)), 3000, 100)) && !!(await poll(() => pieceAtRest(page), 3000, 100)));
    check(`${n}: the panel not opened`, !(await panelOpen(page)));
    await page.waitForTimeout(700);
  }
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The fans at work: before a game, in play, after it");
{
  const { ctx, page, errs } = await store({ version: "4.1" });
  const diff = (k) => page.evaluate((k) => { const b = document.querySelector(`[data-ec-diff="${k}"]`); return !!b && b.getAttribute("aria-pressed") === "true"; }, k);
  const chip = async (k) => { const b = await page.locator(`[data-testid="menu-fan-ctl"] [data-mf-choice="${k}"]`).boundingBox(); if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return !!b; };

  // Dial: a tap turns to the level and offers its choices; a switch flips.
  await openMenu(page);
  await fanStill(page);
  await tapSlot(page, "level");
  check("Dial: a tap on Level turns to it, its choices in the read-out", !!(await poll(async () => (await page.locator('[data-testid="menu-fan-ctl"] [data-mf-choice]').count()) === 3 && (await fan(page)).focus === "level", 3000, 100)));
  await chip("medium");
  check("...Medium chosen is the panel's Medium", !!(await poll(() => diff("medium"), 3000, 100)));
  check("...the read-out says Medium, the fan still out", !!(await poll(async () => /medium/i.test((await fan(page)).read) && (await isOpen(page)), 3000, 100)));
  const side = () => page.evaluate(() => document.querySelector('[data-testid="turn-status"]').getAttribute("data-side"));
  const was = await side();
  await page.waitForTimeout(3000);
  await tapSlot(page, "first");
  check("Dial: a tap on First move switches who starts", !!(await poll(async () => (await side()) !== was, 3000, 100)));
  await page.waitForTimeout(600);
  await tapSlot(page, "first");
  check("...and back", !!(await poll(async () => (await side()) === was, 3000, 100)));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Rings: a kind tapped turns the ring to its settings.
  await pick(page, "4.2");
  await openMenu(page);
  await fanStill(page);
  const kind = await page.evaluate(() => { const r = document.querySelector('[data-mf-kind="settings"] path').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(kind.x, kind.y);
  check("Rings: Settings tapped turns the ring to Sound", !!(await poll(async () => (await fanStill(page)).focus === "sound", 4000, 150)));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Rail: a stop tapped comes to the top; its control in the read-out.
  await pick(page, "4.3");
  await openMenu(page);
  await fanStill(page);
  await tapSlot(page, "level");
  await poll(async () => (await fanStill(page)).focus === "level", 3000, 150);
  await page.locator('[data-testid="menu-fan-next"]').tap();
  check("Rail: Level tapped to the top, then › to Start, its choices in the read-out", !!(await poll(async () => (await fanStill(page)).focus === "start" && (await page.locator('[data-testid="menu-fan-ctl"] [data-mf-choice="start-by-hand"]').count()) === 1, 4000, 150)));
  await chip("start-by-hand");
  check("...Manual is the panel's Manual", !!(await poll(() => page.evaluate(() => document.querySelector('[data-testid="start-by-hand"]').getAttribute("aria-pressed") === "true"), 3000, 100)));
  check("...and the fan has the new setting it brings (My half), Start still at the top", !!(await poll(async () => { const f = await fan(page); return f.keys.includes("half") && f.focus === "start"; }, 3000, 100)));
  await chip("start-standard");
  check("...Standard again", !!(await poll(() => page.evaluate(() => document.querySelector('[data-testid="start-standard"]').getAttribute("aria-pressed") === "true"), 3000, 100)));
  await page.touchscreen.tap(12, 240);
  await poll(async () => !(await isOpen(page)), 3000, 100);
  await page.waitForTimeout(700);

  // Pages: See the pieces, on the board's page, opens the catalog.
  await pick(page, "4.4");
  await openMenu(page);
  await fanStill(page);
  await page.locator('[data-testid="menu-fan-next"]').tap();
  await fanStill(page);
  await tapSlot(page, "pieces");
  check("Pages: See the pieces opens the catalog, the fan away", !!(await poll(async () => (await page.evaluate(() => !!document.querySelector('[data-testid="tienda-catalog"]'))) && !(await isOpen(page)), 6000, 100)));
  await page.locator('[data-testid="tienda-catalog-close"]').tap();
  await poll(() => page.evaluate(() => !document.querySelector('[data-testid="tienda-catalog"]')), 6000, 100);
  await page.waitForTimeout(800);

  // Corner: the piece in the corner, Try a Game begins the game.
  await pick(page, "4.5");
  await openMenu(page);
  await fanStill(page);
  check("Corner: the piece moved into the corner while it's out", await page.evaluate(() => /translate\(calc\(-50% \+ \d/.test(document.querySelector("[data-dock-piece]").style.transform)));
  await page.locator('[data-testid="menu-fan-primary"]').tap();
  check("...Try a Game begins the game (the piece to its corner)", !!(await poll(() => page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)"), 8000, 100)));
  check("...the fan away", !(await isOpen(page)));
  await page.waitForTimeout(2500);

  // In play: the corner piece brings it out; End game asks twice.
  check("In play: the corner piece brings the Corner fan out", await openMenu(page));
  let f = await fanStill(page);
  check("...in play's own settings (End game, View, Check alert, Sound, Language...)", !!f && f.phase === "play" && ["endgame", "view", "check", "language"].every((k) => f.keys.includes(k)) && !f.keys.includes("first"), f && f.keys.join());
  check("...the piece kept in its corner", await page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)"));
  check("...whose move it is, on top", !!(await page.evaluate(() => { const h = document.querySelector('[data-testid="menu-fan-head"]'); return h && /to move/i.test(h.textContent); })));
  await pick(page, "4.1");
  f = await poll(async () => { const g = await fanStill(page); return g && g.id === "dial" ? g : null; }, 5000, 150);
  check("...the Dial, picked with it out, takes its place", !!f);
  if (f && f.focus !== "endgame") { await tapSlot(page, "endgame"); await fanStill(page); }
  await tapSlot(page, "endgame");
  check("...End game asks first (Tap it again to be sure)", !!(await poll(async () => /again to be sure/i.test((await fan(page)).read), 3000, 100)));
  await tapSlot(page, "endgame");
  check("...the second tap ends the game, the fan away", !!(await poll(async () => !(await isOpen(page)) && (await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))), 6000, 100)));
  await page.waitForTimeout(2500);

  // After: New game on top, the next game's opponent in it.
  check("After the game: the corner piece brings the fan out", await openMenu(page));
  f = await fanStill(page);
  const ng = await page.evaluate(() => document.querySelector('[data-testid="new-game"]').textContent.trim());
  check("...with New game (the store's Set up the demo again), and who to play next", !!f && f.phase === "over" && !!f.primary && f.primary.replace(/[^a-z]/gi, "").toLowerCase() === ng.replace(/[^a-z]/gi, "").toLowerCase() && f.keys.includes("opponent"), f && `${f.primary} / ${ng} ${f.keys.join()}`);
  await page.locator('[data-testid="menu-fan-primary"]').tap();
  check("...New game begins the next one, the fan away", !!(await poll(async () => !(await isOpen(page)) && (await page.evaluate(() => !document.querySelector('[data-testid="new-game"]'))), 8000, 100)));
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
  // (Rings now, the dock's menu: the lab's 4.2 made the game's own.)
  const ringsOut = () => page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"] [data-testid="menu-fan"]'));
  for (let i = 0; i < 4 && !(await ringsOut()); i++) {
    await tapPiece(page, false);
    await poll(ringsOut, 2500, 100);
  }
  check("...and the piece opens Rings, the dock's menu", await ringsOut());
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
