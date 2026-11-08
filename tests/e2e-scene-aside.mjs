/* The game's own things step aside while a story scene has the screen
   (user, a phone screenshot of the den's board with Undo move under it:
   "undo move button is not disappearing when you get diverted, your
   attention gets diverted toward the hallway. There are other situations
   where some of the new menus are not disappearing during the first time
   playthrough when they need to."). The chassis's PLAY_UI goes through
   every one of its STORY_SCENES; Undo move and End turn (the turn buttons)
   had never been added to the scenes' lists, nor the hold's ring and note,
   the end-turn question, the tour, the phone's bar. And the den looking
   round as the set acts up (toward the hall door too) is a scene now
   (html.ec-den-lock), as are the welcome home's card and the bulb after it.

   1. A phone, home from the trip, a game with a move made (Undo move,
      End turn, the points up):
      - a visit to the set: they go, and come back after;
      - home again, the card and then the bulb to settle in by: they go,
        and come back once the bulb's been switched on;
      - the hall: as it flares and the camera turns to the doorway, and
        through the choice; "Just keep playing", back; then Investigate,
        the walk in.
   2. Home before the Singularity: the den looking round as the set acts
      up: they go, and the corner's buttons with them, all but the
      full-screen switch (the one the lock lets through); back after.
   3. A phone with the control bar, the phone call: the bar (its own Undo
      move and End turn) stays while it rings (the game goes on till it's
      answered), and goes on the line; the bar's menu button stays.

   node tests/e2e-scene-aside.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 20000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};

const SEEN = { "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1" };
const AFTER_TRIP = { "el-cabeza:story": JSON.stringify({ owned: true, storeGone: true, hallDue: true }), ...SEEN };
const BEFORE_SINGULARITY = { "el-cabeza:story": JSON.stringify({ owned: true }) };
const BEFORE_CALL = { "el-cabeza:story": JSON.stringify({ owned: true }), ...SEEN };

// The chassis's PLAY_UI (chassis/ElCabeza3D.jsx), and the corner's buttons.
const PLAY_UI = ["points-counter", "turn-buttons-float", "end-turn-ask", "hold-to-end-hint", "piece-card", "why-not", "why-not-pointer", "unused-points-note", "check-alert", "check-alert-recall", "dock-call-aura", "corner-menu", "tour-card", "tour-marks", "shell-bar", "shell-hint"];
const CORNER = ["room-view-corner", "focus-corner", "action-corner", "how-to-play", "music-chip"];

async function open({ seed, phone = false, bar = false, call = false }) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(({ seed, bar, call }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    if (call) window.__EC_TEST_DEN_CALL__ = true;
    try {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.clear();
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        if (bar) localStorage.setItem("el-cabeza:nova-layout", "bar");
      }
    } catch (e) { /* none */ }
  }, { seed, bar, call });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__DEN_TV__ && !!window.__DEN_THREE__ && !!window.__EC_TEST_MOVE__), 40000);
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
// Human against human, Begin Game (the bar's own Begin on a phone with it).
async function begin(page) {
  if (await page.locator('[data-testid="shell-begin"]').count()) await page.locator('[data-testid="shell-begin"]').first().click().catch(() => {});
  else {
    await openDockPanel(page);
    const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
    if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
    await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
  }
  const armed = await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 15000);
  await page.waitForTimeout(2500);
  return !!armed;
}
// One move of the side to move, the first of its pieces that can go (an
// action of its two used: Undo move and End turn up).
async function oneMove(page) {
  const used = () => page.evaluate(() => JSON.stringify((window.__EC_TEST_PIECES__ || []).map((p) => [p.id, p.row, p.col, p.orientation || ""])));
  const before = await used();
  const to = await page.evaluate(() => window.__EC_TEST_TO_MOVE__());
  const ids = await page.evaluate((to) => (window.__EC_TEST_PIECES__ || []).filter((p) => p.owner === to).map((p) => p.id), to);
  for (const id of ids) for (const d of ["S", "N", "E", "W"]) {
    await page.evaluate(([id, d]) => window.__EC_TEST_MOVE__(id, d), [id, d]);
    if (await poll(async () => (await used()) !== before, 1500, 150)) { await page.waitForTimeout(1200); return `${id} ${d}`; }
  }
  return null;
}
// Each of `ids` on the page with a box: its own opacity and whether it takes taps.
const read = (page, ids) => page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    out[id] = { o: Math.round(Number(cs.opacity) * 100) / 100, pe: cs.pointerEvents };
  }
  return out;
}, ids);
const allAway = (s) => Object.keys(s).length > 0 && Object.values(s).every((v) => v.o < 0.05 && v.pe === "none");
const up = (s, id) => !!s[id] && s[id].o > 0.9;
const flags = (page) => page.evaluate(() => document.documentElement.className);
// They've all gone (polled: each fades out), with what's on the page.
async function goneFor(page, ids = PLAY_UI, ms = 6000) {
  const s = await poll(async () => { const r = await read(page, ids); return allAway(r) ? r : null; }, ms, 150);
  return { ok: !!s, s: s || (await read(page, ids)) };
}
const brief = (s) => JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, `${v.o}${v.pe === "none" ? " deaf" : ""}`])));

/* ---- 1. a phone, home from the trip ---- */
console.log("a phone, home from the trip: a visit to the set, home again, the hall");
{
  const { ctx, page, errs } = await open({ seed: AFTER_TRIP, phone: true });
  check("a game under way", await begin(page));
  const moved = await oneMove(page);
  const s0 = await read(page, PLAY_UI);
  check(`a move made (${moved}): Undo move and End turn up, and the points`, !!moved && up(s0, "turn-buttons-float") && up(s0, "points-counter") && (await page.locator('[data-testid="undo-move-float"]').count()) > 0, brief(s0));

  // A visit to the set.
  await page.evaluate(() => window.__DEN_TV_LOOK__(true));
  let g = await goneFor(page);
  check(`over at the set (${await flags(page)}): the game's things gone`, g.ok, brief(g.s));
  await page.evaluate(() => window.__DEN_TV_LOOK__(false));
  let back = await poll(async () => { const s = await read(page, PLAY_UI); return up(s, "turn-buttons-float") && up(s, "points-counter") ? s : null; }, 12000);
  check("...back at the board, they're back", !!back, brief(await read(page, PLAY_UI)));

  // Home again: the card, then the bulb.
  await page.evaluate(() => window.__DEN_HOME_NOW__());
  await poll(async () => (await page.locator('[data-testid="den-home-card"]').count()) > 0, 5000);
  g = await goneFor(page);
  check(`home again, its card up (${await flags(page)}): the game's things gone (its buttons did nothing)`, g.ok, brief(g.s));
  await page.waitForTimeout(4200);
  await page.locator('[data-testid="den-home-card"]').click();
  const settling = await poll(() => page.evaluate(() => document.documentElement.classList.contains("ec-settle")), 5000);
  g = await goneFor(page);
  check("...put away, the bulb to settle in by: still gone", !!settling && g.ok, brief(g.s));
  const bulb = await read(page, ["focus-corner"]);
  check("...the bulb itself there to tap", up(bulb, "focus-corner") && bulb["focus-corner"].pe !== "none", brief(bulb));
  await page.locator('[data-testid="focus-corner"]').click();
  back = await poll(async () => { const s = await read(page, PLAY_UI); return !(await page.evaluate(() => document.documentElement.classList.contains("ec-settle"))) && up(s, "turn-buttons-float") ? s : null; }, 8000);
  check("...the bulb on: the game's yours, and they're back", !!back, brief(await read(page, PLAY_UI)));

  // The hall (the user's): the doorway lights up and the camera turns to it.
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  g = await goneFor(page, PLAY_UI, 3000);
  check(`the hall flares, the camera turning to the doorway (${await flags(page)}): Undo move, End turn and the rest gone`, g.ok, brief(g.s));
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 9000 }).catch(() => {});
  g = await goneFor(page, PLAY_UI, 1000);
  check("...still gone with the choice up", g.ok, brief(g.s));
  await page.locator('[data-testid="den-hall-keep"]').click();
  back = await poll(async () => { const h = await page.evaluate(() => window.__DEN_HALL__()); const s = await read(page, PLAY_UI); return h.state === "armed" && up(s, "turn-buttons-float") ? s : null; }, 10000);
  check("Just keep playing: back at the board, they're back", !!back, brief(await read(page, PLAY_UI)));
  await page.evaluate(() => window.__DEN_HALL_NOW__());
  await page.waitForSelector('[data-testid="den-hall-choice"]:not([data-held])', { timeout: 9000 }).catch(() => {});
  await page.locator('[data-testid="den-hall-investigate"]').click();
  await poll(async () => (await page.evaluate(() => window.__DEN_HALL__())).state === "walk", 5000);
  await page.waitForTimeout(2500);
  g = await goneFor(page, PLAY_UI, 1000);
  check(`Investigate: down the hall, still gone (${await flags(page)})`, g.ok, brief(g.s));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 2. home before the Singularity: the den looks round ---- */
console.log("\nhome before the Singularity: the den looking round as the set acts up");
{
  const { ctx, page, errs } = await open({ seed: BEFORE_SINGULARITY });
  // (The set's own way in, its pull left too long, is e2e-tv-pull's.)
  await page.evaluate(() => window.__DEN_PULL_HOLD__ && window.__DEN_PULL_HOLD__(true));
  check("a game under way", await begin(page));
  const moved = await oneMove(page);
  const s0 = await read(page, [...PLAY_UI, ...CORNER]);
  check(`a move made (${moved}): Undo move, the points and the corner's buttons up`, !!moved && up(s0, "turn-buttons-float") && up(s0, "points-counter") && !!s0["room-view-corner"] && s0["room-view-corner"].o > 0.5, brief(s0));
  await page.evaluate(() => { window.__DEN_HUH_PIN__(false); window.__DEN_LURE_SKIP__(-window.__DEN_TV__().lureWaited + 400); });
  const locked = await poll(() => page.evaluate(() => document.documentElement.classList.contains("ec-den-lock")), 15000);
  check("the set stirs: the den looks round (html.ec-den-lock)", !!locked);
  const g = await goneFor(page, [...PLAY_UI, ...CORNER]);
  check("...the game's things gone, and the corner's buttons", g.ok, brief(g.s));
  const fs = await page.evaluate(() => { const b = document.querySelector("[data-fullscreen-toggle]"); if (!b) return null; const cs = getComputedStyle(b); return { o: Number(cs.opacity), pe: cs.pointerEvents, shown: cs.display !== "none" && cs.visibility !== "hidden" }; });
  check("...but the full-screen switch, which the look round lets through", !fs || (fs.shown && fs.o > 0.05 && fs.pe !== "none"), JSON.stringify(fs));
  const back = await poll(async () => { const s = await read(page, PLAY_UI); return !(await page.evaluate(() => document.documentElement.classList.contains("ec-den-lock"))) && up(s, "turn-buttons-float") && up(s, "points-counter") ? s : null; }, 20000);
  check("...the look round over: they're back", !!back, brief(await read(page, PLAY_UI)));
  const corner = await read(page, ["room-view-corner"]);
  check("...and the corner's buttons", !!corner["room-view-corner"] && corner["room-view-corner"].o > 0.5 && corner["room-view-corner"].pe !== "none", brief(corner));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

/* ---- 3. a phone with the control bar: the phone call ---- */
console.log("\na phone with the control bar: the phone call");
{
  const { ctx, page, errs } = await open({ seed: BEFORE_CALL, phone: true, bar: true, call: true });
  check("a game under way", await begin(page));
  const moved = await oneMove(page);
  const s0 = await read(page, PLAY_UI);
  check(`a move made (${moved}): the bar up, its Undo move with it`, !!moved && up(s0, "shell-bar") && (await page.locator('[data-testid="shell-undo-move"]').count()) > 0, brief(s0));
  await page.evaluate(() => window.__DEN_CALL_NOW__());
  const ringing = await poll(() => page.evaluate(() => window.__DEN_CALL__().stage === "ringing"), 30000);
  await page.waitForTimeout(800);
  const s1 = await read(page, PLAY_UI);
  check("it rings: the bar stays (the game goes on till it's answered)", !!ringing && up(s1, "shell-bar"), brief(s1));
  await page.evaluate(() => window.__DEN_CALL_PICKUP__());
  const onLine = await poll(() => page.evaluate(() => window.__DEN_CALL__().stage === "call"), 6000);
  const g = await goneFor(page);
  check(`picked up (${await flags(page)}): the bar gone, its Undo move and End turn with it`, !!onLine && g.ok, brief(g.s));
  const menu = await read(page, ["shell-menu-button"]);
  check("...the bar's menu button still there", !!menu["shell-menu-button"] && menu["shell-menu-button"].o > 0.5, brief(menu));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
