/* The dock's menu (chassis/menu-fan.js): Rings, then (user, of the six
   ways to streamline it: "A, with B in play. Make all appropriate
   recommended changes that the research indicates.") Calm Rings. With no
   lab, a tap on the piece brings it out round the piece, not the panel, in
   every phase; its settings press the panel's own buttons, and the panel
   opens only for Online's own page. (Rings itself, the turning one, is the
   lab's now: ?menulab=4.2, e2e-menu-lab.)

   What the research asked of it, checked here: a few wedges for the
   moment, each in a place that stays put (More at an end, the most wanted
   at the top), no turning; words set straight, in sentence case, 14 px
   names and 12 px values, inside their wedges; every button 44 px or
   more; out on the tap itself, its motion under 0.2 s; who's playing and
   whose move said once, in one line, not inside the menu; End game asked
   first, at the list's edge.

   On a phone in the store: before a game the half ring round the piece,
   Try a Game over it; the opponent's card (its levels with it); Online
   opens the panel; More, every setting in one list; Try a Game begins. In
   play (B): the corner fan out of the corner piece, which stays in its
   corner, the board in view; a touch held on it; View's card; End game
   from More, asked first. After the game: the call answered, New game over
   the ring. A new player's first look holds back what the panel holds
   back. Futuris's Anomaly keeps the menu out. On a desktop (Noir): the
   keys, the More card, the mouse brought onto the corner piece. In
   Spanish: its words inside their wedges.

   node tests/e2e-rings.mjs */
import { chromium } from "playwright";
import { waitForDockCorner } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const NOIR = "file:///home/user/el-cabeza-project/dist/el-cabeza-noir.html";
const FUTURIS = "file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html";
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

async function store({ toured = true, lang = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ toured }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (toured) localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) { /* none */ }
  }, { toured });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(lang ? `${NOVA}?lang=${lang}` : NOVA);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

// The menu as it is: out and shown, its phase, its wedges left to right
// (by where each is drawn), the big button, the line, a word said, a card
// or the list out.
const menu = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const stage = layer && layer.querySelector('[data-testid="menu-fan"]');
  if (!stage) return null;
  const shown = (n) => !!n && getComputedStyle(n).display !== "none";
  const ws = [...layer.querySelectorAll("g[data-ml-item]")].map((g) => ({ key: g.getAttribute("data-ml-item"), at: +g.getAttribute("data-cr-at"), held: g.getAttribute("aria-disabled") === "true" }));
  ws.sort((a, b) => a.at - b.at);
  const primary = layer.querySelector('[data-testid="menu-fan-primary"]'), status = layer.querySelector('[data-testid="menu-fan-status"]');
  const note = layer.querySelector('[data-testid="menu-fan-note"].cr-shown'), card = layer.querySelector('[data-testid="menu-fan-card"]');
  return {
    version: layer.getAttribute("data-version"), fan: stage.getAttribute("data-fan"), phase: layer.getAttribute("data-phase"),
    shown: getComputedStyle(stage).opacity === "1", turning: stage.getAttribute("data-turning"),
    keys: ws.map((w) => w.key), at: Object.fromEntries(ws.map((w) => [w.key, w.at])), held: ws.filter((w) => w.held).map((w) => w.key),
    primary: shown(primary) ? primary.textContent.trim() : null,
    status: shown(status) ? status.textContent.trim() : "",
    note: note ? note.textContent.trim() : "",
    card: card ? card.getAttribute("data-mf-card") : null,
    more: !!layer.querySelector('[data-testid="menu-fan-more"]'),
  };
});
const out = async (page) => { const m = await menu(page); return m && m.shown ? m : null; };
const panelOpen = (page) => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
const pieceBox = (page) => page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
const tapAt = (page, x, y, touch) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
// The piece tapped till the menu's out.
async function openMenu(page, touch = true) {
  for (let i = 0; i < 4; i++) {
    if (await menu(page)) break;
    const b = await pieceBox(page);
    await tapAt(page, b.x + b.width / 2, b.y + b.height / 2, touch);
    if (await poll(() => menu(page), 2500, 100)) break;
  }
  return poll(() => out(page), 6000, 100);
}
const away = (page) => poll(async () => !(await page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"]'))), 3000, 100);
// A wedge tapped where its words are (on the wedge under them).
async function tapWedge(page, key, touch = true) {
  const b = await page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
  if (!b) return false;
  await tapAt(page, b.x, b.y, touch);
  return true;
}
// Something in the menu (a choice, a row, a button) tapped at its middle;
// one in More's list scrolled to the list's middle first (not under its
// foot, where the big button is).
async function tapIn(page, sel, touch = true) {
  await page.evaluate((sel) => {
    const n = document.querySelector(`[data-testid="dock-menu"] ${sel}`), list = n && n.closest('[data-testid="menu-fan-list"]');
    if (!list) return;
    const r = n.getBoundingClientRect(), lr = list.getBoundingClientRect();
    list.scrollTop += r.top + r.height / 2 - (lr.top + lr.height / 2);
  }, sel);
  await page.waitForTimeout(60);
  const b = await page.locator(`[data-testid="dock-menu"] ${sel}`).first().boundingBox().catch(() => null);
  if (!b) return false;
  await tapAt(page, b.x + b.width / 2, b.y + b.height / 2, touch);
  return true;
}
/* What the research asked of it, as drawn now: each wedge's words set
   straight (no turn), in sentence case, names 14 px or more and values
   12 px or more, every line of them inside its own wedge (between the
   ring's edges, within the wedge's angles, a degree to spare); every
   button 44 px or more each way. */
const looks = (page) => page.evaluate(() => {
  const L = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const svg = L && L.querySelector("svg.cr-ring");
  if (!svg) return null;
  const [cx, cy] = svg.getAttribute("data-hub").split(" ").map(Number);
  const [r0, r1, , , step] = svg.getAttribute("data-ring").split(" ").map(Number);
  const bad = [], small = [];
  for (const lab of L.querySelectorAll("[data-ml-label]")) {
    const key = lab.getAttribute("data-ml-label"), g = L.querySelector(`g[data-ml-item="${key}"]`), mid = +g.getAttribute("data-cr-at");
    const m = new DOMMatrix(getComputedStyle(lab).transform);
    const nm = lab.querySelector(".cr-nm"), vals = [...lab.querySelectorAll(".cr-val")];
    if (Math.abs(m.b) > 0.001 || Math.abs(m.c) > 0.001) bad.push(`${key}: turned`);
    if (getComputedStyle(nm).textTransform !== "none") bad.push(`${key}: ${getComputedStyle(nm).textTransform}`);
    if (parseFloat(getComputedStyle(nm).fontSize) < 14) bad.push(`${key}: name ${getComputedStyle(nm).fontSize}`);
    for (const v of vals) if (parseFloat(getComputedStyle(v).fontSize) < 12) bad.push(`${key}: value ${getComputedStyle(v).fontSize}`);
    const range = document.createRange();
    for (const el of [nm, ...vals]) {
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) {
          const a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI, d = Math.hypot(x - cx, y - cy);
          if (d < r0 - 1 || d > r1 + 1 || a < mid - step / 2 - 1 || a > mid + step / 2 + 1) { bad.push(`${key}: "${el.textContent}" out at ${Math.round(a)}° ${Math.round(d)}px (wedge ${Math.round(mid - step / 2)}..${Math.round(mid + step / 2)}°, ${r0}..${r1}px)`); break; }
        }
      }
    }
  }
  for (const n of L.querySelectorAll("g[data-ml-item], .cr-chip, .cr-row, .cr-x, .cr-primary")) {
    const r = n.getBoundingClientRect();
    if (r.width && r.height && (r.width < 44 || r.height < 44)) small.push(`${n.getAttribute("data-ml-item") || n.getAttribute("data-mf-choice") || n.getAttribute("data-mf-row") || n.getAttribute("data-testid") || "?"} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const quick = (n) => { if (!n) return 0; const cs = getComputedStyle(n); return Math.max(...cs.transitionDuration.split(",").map(parseFloat), ...cs.animationDuration.split(",").map(parseFloat)); };
  return { bad, small, motion: Math.max(quick(L.querySelector(".cr-stage")), quick(L.querySelector(".cr-card")), quick(L.querySelector(".cr-more"))) };
});
const SETUP = ["first", "opponent", "level", "start", "pieces", "cart", "check", "points", "costs", "guide", "sound", "language", "replay", "saves", "bar"];
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="dock-menu"] [data-testid="menu-fan-more"] [data-mf-row]')].map((n) => n.getAttribute("data-mf-row")));
const groups = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="dock-menu"] [data-testid="menu-fan-more"] [data-mf-group]')].map((n) => n.getAttribute("data-mf-group")));

console.log("The store, on a phone: Calm Rings is the menu");
{
  const { ctx, page, errs } = await store();
  const b = await pieceBox(page);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  // Out on the tap itself, not after the piece's bounce (260 ms) and an
  // unfolding: there within a moment of it.
  const soon = await poll(() => page.evaluate(() => document.querySelectorAll('[data-testid="dock-menu"][data-open="true"] g[data-ml-item]').length > 0), 400, 25);
  let m = await openMenu(page);
  check("a tap on the piece: the calm menu out round it at once, not the panel", !!soon && !!m && m.fan === "calm" && m.version === "4.6" && m.phase === "setup" && !(await panelOpen(page)), JSON.stringify(m));
  check("...five wedges in their places: More at the left end, Opponent at the top, First move and Starting position beside it, See the pieces", !!m && m.keys.join() === "more,start,opponent,first,pieces" && Math.abs(m.at.opponent + 90) < 0.5, JSON.stringify(m && [m.keys, m.at]));
  check("...Try a Game over it; nothing said in a line before a game", !!m && /try a game/i.test(m.primary || "") && m.status === "", JSON.stringify(m));
  let l = await looks(page);
  check(`...its words straight, in sentence case, 14 px names and 12 px values, inside their wedges${l && l.bad.length ? ` (${l.bad.join("; ")})` : ""}`, !!l && !l.bad.length, JSON.stringify(l));
  check("...every button 44 px or more; its motion under 0.2 s", !!l && !l.small.length && l.motion <= 0.2, JSON.stringify(l));
  const at0 = m && m.at;
  // First move: a switch, flipped where it is.
  const was = await page.evaluate(() => document.querySelector('[data-testid="turn-status"]').getAttribute("data-side"));
  await tapWedge(page, "first");
  check("First move tapped: flipped in the panel, the menu still out, nothing moved", !!(await poll(async () => (await page.evaluate(() => document.querySelector('[data-testid="turn-status"]').getAttribute("data-side"))) !== was && !!(await out(page)), 3000, 100)) && JSON.stringify((await menu(page)).at) === JSON.stringify(at0));
  await tapWedge(page, "first");
  await poll(async () => (await page.evaluate(() => document.querySelector('[data-testid="turn-status"]').getAttribute("data-side"))) === was, 3000, 100);
  // The opponent's card: who you play, and the computer's level with it.
  await tapWedge(page, "opponent");
  m = await poll(async () => { const x = await out(page); return x && x.card === "opponent" ? x : null; }, 3000, 100);
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-testid="menu-fan-card"] [data-mf-choice]')].map((n) => n.getAttribute("data-mf-choice")));
  check("Opponent tapped: its card above the ring, who to play and the level in it", !!m && ["human", "ai-dark", "ai-light", "online", "easy", "medium", "hard"].every((k) => opts.includes(k)), opts.join());
  l = await looks(page);
  check("...its buttons 44 px or more", !!l && !l.small.length, JSON.stringify(l && l.small));
  await tapIn(page, '[data-testid="menu-fan-card"] [data-mf-choice="medium"]');
  check("...Medium chosen is the panel's Medium; the card still out, the wedge saying it, nothing moved", !!(await poll(async () => (await page.evaluate(() => document.querySelector('[data-ec-diff="medium"]').getAttribute("aria-pressed") === "true")) && (await page.evaluate(() => /Medium/.test(document.querySelector('[data-testid="dock-menu"] [data-ml-label="opponent"]').textContent))) && ((await out(page)) || {}).card === "opponent", 3000, 100)) && JSON.stringify((await menu(page)).at) === JSON.stringify(at0));
  await tapIn(page, '[data-testid="menu-fan-card"] [data-testid="menu-fan-close"]');
  check("...its close puts the card away, the ring still out", !!(await poll(async () => { const x = await out(page); return x && !x.card; }, 3000, 100)));
  // A tap outside puts it away; the piece back where it rests.
  await page.touchscreen.tap(12, 300);
  check("a tap outside puts it away", !!(await away(page)));
  check("...the piece back where it rests", !!(await poll(() => page.evaluate(() => document.querySelector("[data-dock-piece]").style.transform === "translateX(-50%) scale(1)"), 3000, 100)));
  await page.waitForTimeout(800);
  // Online: its own page is the panel's.
  await openMenu(page);
  await tapWedge(page, "opponent");
  await poll(async () => ((await out(page)) || {}).card === "opponent", 3000, 100);
  await tapIn(page, '[data-testid="menu-fan-card"] [data-mf-choice="online"]');
  check("Opponent, Online: the menu away, the panel open on Online's own page", !!(await poll(async () => (await panelOpen(page)) && !(await menu(page)), 5000, 100)));
  for (let i = 0; i < 3 && (await panelOpen(page)); i++) {
    await page.waitForTimeout(400);
    await page.touchscreen.tap(12, 300);
    await poll(async () => !(await panelOpen(page)), 2000, 100);
  }
  await page.waitForTimeout(800);
  await openMenu(page);
  await tapWedge(page, "opponent");
  const card = await poll(async () => ((await out(page)) || {}).card === "opponent", 3000, 100);
  check("...put away, the opponent's card still there with Online's page left in the panel", !!card && !!(await page.evaluate(() => !!document.querySelector('[data-testid="online-panel"]'))));
  await tapIn(page, '[data-testid="menu-fan-card"] [data-mf-choice="ai-dark"]');
  check("...the computer picked from it: Online's page gone, the computer's levels back in the card", !!(await poll(async () => (await page.evaluate(() => !document.querySelector('[data-testid="online-panel"]') && !!document.querySelector("[data-ec-diff]") && !!document.querySelector('[data-testid="menu-fan-card"] [data-mf-choice="easy"]'))), 4000, 100)));
  // More: every setting, in one list, in groups.
  await tapWedge(page, "more");
  m = await poll(async () => { const x = await out(page); return x && x.more ? x : null; }, 3000, 100);
  const listed = await rows(page);
  check("More: one list with every setting the panel has before a game, in its groups", !!m && SETUP.every((k) => listed.includes(k)) && (await groups(page)).slice(0, 4).join() === "game,board,hints,sound", `${listed.join()} | ${(await groups(page)).join()}`);
  check("...who's playing not in it (said in the line, in play)", !listed.includes("you"));
  l = await looks(page);
  check("...its rows, switches and close 44 px or more", !!l && !l.small.length, JSON.stringify(l && l.small));
  const costs = () => page.evaluate(() => document.querySelector('[data-testid="costs-toggle"]').getAttribute("aria-pressed"));
  const c0 = await costs();
  await tapIn(page, '[data-testid="menu-fan-more"] [data-mf-row="costs"]');
  check("...Move costs, a switch: flipped in the panel, the list still out, its switch saying so", !!(await poll(async () => (await costs()) !== c0 && (await page.evaluate((v) => document.querySelector('[data-testid="menu-fan-more"] [data-mf-row="costs"]').getAttribute("aria-checked") === v, await costs())), 3000, 100)) && !!(await out(page)));
  await tapIn(page, '[data-testid="menu-fan-more"] [data-mf-row="costs"]');
  await poll(async () => (await costs()) === c0, 3000, 100);
  await tapIn(page, '[data-testid="menu-fan-more"] [data-mf-row="language"]');
  check("...Language opens its choices in the list itself, not another page", !!(await poll(() => page.evaluate(() => document.querySelectorAll('[data-testid="menu-fan-more"] [data-mf-of="language"] [data-mf-choice]').length >= 3), 3000, 100)));
  await tapIn(page, '[data-testid="menu-fan-more"] [data-testid="menu-fan-close"]');
  check("...its close: back to the game in one tap", !!(await away(page)));
  await page.waitForTimeout(800);
  await openMenu(page);
  await tapIn(page, '[data-testid="menu-fan-primary"]');
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Try a Game from it: the game begun, the piece in its corner, the menu away", !!corner && !(await menu(page)) && (await page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)")), JSON.stringify(corner));
  await page.waitForTimeout(1500);
  // In play: the corner fan, out of the corner piece; a touch held on it.
  const cdp = await ctx.newCDPSession(page);
  const cb = await pieceBox(page);
  const pt = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
  await page.waitForTimeout(1300);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  m = await poll(() => out(page), 6000, 150);
  const piece = await page.evaluate(() => { const d = document.querySelector("[data-dock-piece]"); return { left: d.style.left, z: getComputedStyle(d).zIndex, op: getComputedStyle(d).opacity }; });
  check("in play, a touch held on the corner piece: the corner fan out of it, the piece kept in its corner, raised", !!m && m.phase === "play" && m.keys.join() === "view,sound,more" && piece.left === "calc(100% - 108px)" && piece.z === "15", `${JSON.stringify(m)} ${JSON.stringify(piece)}`);
  await page.waitForTimeout(1200);
  check("...its lifting doesn't put it away: still out a moment on", !!(await menu(page)));
  check("...whose move and who's who said once, in one line over it: Your move · You: Ash (light) · Computer: level", !!m && /^Your move · You: Ash \(light\) · Computer: (Easy|Medium|Hard)$/.test(m.status), JSON.stringify(m && m.status));
  const box = await page.evaluate(() => { const s = document.querySelector('[data-testid="dock-menu"] svg.cr-ring').getBoundingClientRect(); return { left: s.left, top: s.top, vw: innerWidth, vh: innerHeight }; });
  check("...the board's middle in view: the fan keeps to the lower right", box.left > box.vw * 0.25 && box.top > box.vh * 0.5, JSON.stringify(box));
  l = await looks(page);
  check(`...its words straight, sentence case, readable, inside their wedges; its buttons 44 px or more${l && l.bad.length ? ` (${l.bad.join("; ")})` : ""}`, !!l && !l.bad.length && !l.small.length, JSON.stringify(l));
  // View: its card; a pick puts the menu away, the view taken.
  await tapWedge(page, "view");
  m = await poll(async () => { const x = await out(page); return x && x.card === "view" ? x : null; }, 3000, 100);
  const views = await page.evaluate(() => [...document.querySelectorAll('[data-testid="menu-fan-card"] [data-mf-choice]')].map((n) => n.getAttribute("data-mf-choice")));
  check("View tapped: its card, the board's views in it", !!m && views.length >= 2, views.join());
  const other = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-testid="menu-fan-card"] [data-mf-choice]')].find((n) => n.getAttribute("aria-pressed") !== "true"); return b && b.getAttribute("data-mf-choice"); });
  await tapIn(page, `[data-testid="menu-fan-card"] [data-mf-choice="${other}"]`);
  check("...another view picked: the panel's own pressed, the menu away", !!(await poll(async () => !(await menu(page)) && (await page.evaluate((k) => document.querySelector(`[data-testid="${k}"]`).getAttribute("aria-pressed") === "true", other)), 4000, 100)), other);
  await page.waitForTimeout(800);
  // End game: in More, at its edge, asked first.
  await openMenu(page);
  await tapWedge(page, "more");
  await poll(async () => ((await out(page)) || {}).more, 3000, 100);
  const inPlay = await rows(page);
  check("More in play: End game last, at the list's edge, on its own", inPlay[inPlay.length - 1] === "endgame" && (await groups(page)).slice(-1)[0] === "end", inPlay.join());
  await page.evaluate(() => { const l = document.querySelector('[data-testid="menu-fan-list"]'); l.scrollTop = l.scrollHeight; });
  await tapIn(page, '[data-testid="menu-fan-more"] [data-mf-row="endgame"]');
  check("...a tap asks first: Keep playing beside it, the game still on", !!(await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="menu-fan-ask"] [data-mf-choice="keep"]')), 3000, 100)) && !(await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))));
  await tapIn(page, '[data-testid="menu-fan-ask"] [data-mf-choice="keep"]');
  check("...Keep playing: no question, the game on", !!(await poll(() => page.evaluate(() => !document.querySelector('[data-testid="menu-fan-ask"]')), 3000, 100)) && !(await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))));
  await page.evaluate(() => { const l = document.querySelector('[data-testid="menu-fan-list"]'); l.scrollTop = l.scrollHeight; });
  await tapIn(page, '[data-testid="menu-fan-more"] [data-mf-row="endgame"]');
  await poll(() => page.evaluate(() => !!document.querySelector('[data-testid="menu-fan-ask"]')), 3000, 100);
  await page.evaluate(() => { const l = document.querySelector('[data-testid="menu-fan-list"]'); l.scrollTop = l.scrollHeight; });
  await tapIn(page, '[data-testid="menu-fan-ask"] [data-mf-choice="end"]');
  check("...asked again and answered: the game ended, the menu away", !!(await poll(async () => !(await menu(page)) && (await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))), 6000, 100)));
  await page.waitForTimeout(2500);
  // After: the call answered.
  check("after the game, the corner piece calls", await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall === "true"));
  m = await openMenu(page);
  const ng = await page.evaluate(() => document.querySelector('[data-testid="new-game"]').textContent.replace(/[^a-z]/gi, "").toLowerCase());
  check("...the half ring out from it: New game over it (the store's own words), who to play next on it, the call answered", !!m && m.phase === "over" && !!m.primary && m.primary.replace(/[^a-z]/gi, "").toLowerCase() === ng && m.keys.includes("opponent") && m.keys[0] === "more" && (await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall !== "true")), JSON.stringify(m));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Futuris, on a phone: Anomaly from the menu");
{
  // (user: "when you click anomaly, it closes the menu and immediately
  // starts... It should just keep the menu open.")
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(FUTURIS);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  let m = await openMenu(page);
  const named = await page.evaluate(() => { const n = document.querySelector('[data-testid="dock-menu"] g[data-ml-item="pieces"]'); return n && n.getAttribute("aria-label"); });
  check("the menu out, Anomaly on its own wedge", !!m && m.keys.includes("pieces") && named === "Anomaly", `${named} ${JSON.stringify(m)}`);
  const layout = () => page.evaluate(() => JSON.stringify((window.__EC_TEST_PIECES__ || []).map((p) => [p.id, p.row, p.col])));
  let was = await layout();
  await tapWedge(page, "pieces");
  m = await poll(async () => { const x = await menu(page); return x && /new layout/i.test(x.note) ? x : null; }, 4000, 100);
  check("...a tap: a new layout, the menu still out, saying so", !!m && (await layout()) !== was, JSON.stringify(m));
  was = await layout();
  await page.waitForTimeout(600);
  await tapWedge(page, "pieces");
  check("...and again: another, still out", !!(await poll(async () => (await layout()) !== was && !!(await menu(page)), 4000, 100)));
  check("...the game not begun", ((await menu(page)) || {}).phase === "setup");
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("A new player's first look");
{
  const { ctx, page, errs } = await store({ toured: false });
  const m = await openMenu(page);
  const held = (k) => page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] g[data-ml-item="${k}"]`); return n ? n.getAttribute("aria-disabled") === "true" : null; }, k);
  check("the menu out, Try a Game and See the pieces pressable", !!m && (await held("pieces")) === false && /try a game/i.test(m.primary || ""), JSON.stringify(m));
  // Who to play held back as the panel holds it back: a tap says so,
  // nothing changes (or, its card out, the level's buttons held back).
  await tapWedge(page, "opponent");
  const said = await poll(async () => {
    const x = await menu(page);
    if (x && /Not available right now/.test(x.note)) return "said";
    if (x && x.card === "opponent" && (await page.evaluate(() => [...document.querySelectorAll('[data-testid="menu-fan-card"] [data-mf-choice="medium"], [data-testid="menu-fan-card"] [data-mf-choice="hard"]')].every((n) => n.getAttribute("aria-disabled") === "true")))) return "held";
    return null;
  }, 3000, 100);
  check("...who to play and the level held back, as in the panel", !!said, String(said));
  if (said === "held") await tapIn(page, '[data-testid="menu-fan-card"] [data-mf-choice="hard"]');
  check("...nothing changed: Easy still", await page.evaluate(() => document.querySelector('[data-ec-diff="easy"]').getAttribute("aria-pressed") === "true"));
  await tapWedge(page, "more");
  await poll(async () => ((await out(page)) || {}).more, 3000, 100);
  check("...in More the cart held back too", await page.evaluate(() => { const r = document.querySelector('[data-testid="menu-fan-more"] [data-mf-row="cart"]'); return !r || r.getAttribute("aria-disabled") === "true"; }));
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
  await page.goto(NOIR);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  let m = await openMenu(page, false);
  check("a click on the piece: the calm menu out, the More wedge at its left end", !!m && m.fan === "calm" && m.keys[0] === "more" && !(await panelOpen(page)), JSON.stringify(m));
  const l = await looks(page);
  check(`...its words straight and readable, inside their wedges${l && l.bad.length ? ` (${l.bad.join("; ")})` : ""}`, !!l && !l.bad.length && !l.small.length, JSON.stringify(l));
  // The wheel turns nothing: each wedge where it was.
  const at0 = JSON.stringify(m.at);
  await page.mouse.move(640, 600);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(400);
  check("...the mouse wheel turns nothing: every wedge where it was", JSON.stringify(((await menu(page)) || {}).at) === at0);
  // The keys: round the wedges, Enter, Escape.
  await page.keyboard.press("ArrowRight");
  const f1 = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("data-ml-item")) || null);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const f2 = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("data-ml-item")) || null);
  check("...the arrow keys go round the wedges, from the most wanted", f1 === "opponent" && !!f2 && f2 !== f1, `${f1} → ${f2}`);
  await page.evaluate(() => document.querySelector('[data-testid="dock-menu"] g[data-ml-item="more"]').focus());
  await page.keyboard.press("Enter");
  m = await poll(async () => { const x = await out(page); return x && x.more ? x : null; }, 3000, 100);
  const sheet = await page.evaluate(() => { const r = document.querySelector('[data-testid="menu-fan-more"]').getBoundingClientRect(); return { w: r.width, right: innerWidth - r.right }; });
  check("...Enter on More: the list, a card at the side (not a sheet across the screen)", !!m && sheet.w <= 400 && sheet.right < 40, JSON.stringify(sheet));
  await page.keyboard.press("Escape");
  m = await poll(async () => { const x = await out(page); return x && !x.more ? x : null; }, 3000, 100);
  check("...Escape: the list away, the ring back", !!m && m.keys.length === 5);
  await page.keyboard.press("Escape");
  check("...Escape again puts it away", !!(await away(page)));
  await page.waitForTimeout(800);
  m = await openMenu(page, false);
  await tapIn(page, '[data-testid="menu-fan-primary"]', false);
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Begin Game from it: the piece in its corner", !!corner);
  await page.waitForTimeout(1200);
  if (corner) {
    await page.mouse.move(corner.x + corner.width / 2 + 60, corner.y + corner.height / 2 + 60);
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2, { steps: 4 });
  }
  m = await poll(() => out(page), 5000, 150);
  check("...the mouse brought onto the corner piece: the corner fan out, in play, whose move said over it", !!m && m.phase === "play" && m.keys.includes("more") && /to move|Your move/.test(m.status), JSON.stringify(m));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The store in Spanish, on a phone: its words inside their wedges");
{
  const { ctx, page, errs } = await store({ lang: "es" });
  const m = await openMenu(page);
  const words = await page.evaluate(() => document.querySelector('[data-testid="dock-menu"] [data-ml-label="more"]').textContent);
  const l = await looks(page);
  check(`...Más, Todas las opciones; every word inside its wedge${l && l.bad.length ? ` (${l.bad.join("; ")})` : ""}`, !!m && /Más/.test(words) && /Todas las opciones/.test(words) && !!l && !l.bad.length, `${words} ${JSON.stringify(l)}`);
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
