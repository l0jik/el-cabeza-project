/* Set out by hand (user: "a toggle(?) / way to manually place pieces
   before the start of a match"; picked: dragging a piece, or tapping it
   then a square; the back three rows or anywhere in your own half; two
   players mirrored; Same as last time). engine/placement.js has the rules
   (tests/placement.smoke.mjs); this is the chassis's side of it.

   The den on a desktop, two players, Walnut first:
   - the setup's Start (Standard, By hand), remembered, and with By hand
     the half switch and "Set out my pieces";
   - setting out: the banner, the dock and the title aside, the camera
     from Walnut's side, the bench, the rows outlined;
   - a tap chooses (dots on every free square), a tap on a dot sets it
     there, Ash mirrors it;
   - a drag onto the Flaco: the Flaco to the bench, Ash's off the board;
     Begin waits for it; Put it back waits for its squares; a drag from
     the bench sets it out again;
   - the Cabeza set on the Turrito: they swap; a tap on the chosen Flaco
     turns it; Undo takes that back; the keys move the chosen piece;
   - Anywhere in my half, on and off; a Cabeza that could be crushed on
     the first move: Begin waits, rings in red; Standard;
   - Begin: the game, from the set-out, and its record starts there; New
     Game, then Same as last time; Back to the setup.
   Against the computer playing Walnut: you set out Ash's side.
   The reality gate's Standard Cabeza (a world's own menu): set out first.
   Every world: set out, bench a piece, Begin, no errors.
   A phone (Nova's bar): Start in its setup, the buttons along the bottom.

   node tests/e2e-set-out.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 100) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
const OPENING = { lluvia: '[data-testid="lluvia-straight-to-board"]', tienda: '[data-testid="tienda-open-box"]' };

// (node tests/e2e-set-out.mjs phone: only the sections whose names say so.)
const only = process.argv.slice(2);
const want = (name) => !only.length || only.some((a) => name.toLowerCase().includes(a.toLowerCase()));
const so = (page) => page.evaluate(() => window.__EC_TEST_SET_OUT__);
// The camera come to rest (its glide over), so a piece is where it's drawn.
const settled = (page) => poll(() => page.evaluate(() => {
  const c = window.__EC_TEST_CAM__(), v = c.view;
  return Math.abs(v.radius - c.radius) < 0.02 && Math.abs(v.phi - c.phi) < 0.005 && Math.abs(Math.cos(v.theta) - Math.cos(c.theta)) < 0.002 && Math.hypot(v.target[0] - c.target[0], v.target[1] - c.target[1], v.target[2] - c.target[2]) < 0.02;
}), 8000);
const at = (s, id) => (s && s.pieces.find((p) => p.id === id)) || null;
const pos = (page, id) => page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
// (A square's middle; fractional, a point between squares: a big piece's dot.)
const sq = (page, r, c) => page.evaluate(([r, c]) => window.__EC_TEST_SQUARE_POS__(r, c), [r, c]);
const benchPos = (page, id) => page.evaluate((i) => window.__EC_TEST_BENCH_POS__(i), id);
const title = (page) => page.locator('[data-testid="set-out-title"]').innerText().catch(() => "");
const marks = (page, kind) => page.evaluate((k) => { const g = window.__EC_TEST_THREE__().setOutGroup; let n = 0; if (g) g.traverse((o) => { if (o.userData && o.userData.kind === k) n++; }); return n; }, kind);
// Mirrored: each of the setting side's pieces has its 180° twin.
const mirrored = (s) => !!s && s.pieces.every((p) => { const q = at(s, p.id.replace(/^(dark|light)-/, (m, x) => (x === "dark" ? "light-" : "dark-"))); return q && q.row === 10 - p.row - p.h && q.col === 10 - p.col - p.w && q.w === p.w && q.h === p.h; });
async function drag(page, a, b, steps = 12) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps); await page.waitForTimeout(25); }
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);
}
async function tap(page, p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(450); }
async function open(world, { query = "", viewport = { width: 1280, height: 800 }, phone = false, seed = null } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport });
  // (A fresh player once: the mark is kept in localStorage itself.)
  await ctx.addInitScript((seed) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      if (!localStorage.getItem("test:seeded")) {
        localStorage.clear();
        localStorage.setItem("test:seeded", "1");
        Object.entries(seed || {}).forEach(([k, v]) => localStorage.setItem(k, v));
      }
    } catch (e) { /* none */ }
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${D}/el-cabeza-${world}.html${query}`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_CAM__), 30000, 250);
  if (OPENING[world]) { await page.locator(OPENING[world]).click({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500); }
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
async function setOutFromDock(page) {
  await openDockPanel(page);
  await page.waitForTimeout(300);
  await page.locator('[data-testid="start-by-hand"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-dock-role="begin"]').first().click();
  return poll(() => so(page), 8000);
}

if (want("den")) {
  console.log("The den on a desktop, two players, Walnut first");
  const { ctx, page, errs } = await open("standard");
  await openDockPanel(page);
  await page.waitForTimeout(300);
  check("Start: Standard chosen at first", (await page.locator('[data-testid="start-standard"]').getAttribute("aria-pressed")) === "true" && (await page.locator('[data-testid="start-by-hand"]').getAttribute("aria-pressed")) === "false");
  check("...no half switch, and Begin as ever", (await page.locator('[data-testid="set-out-half-setup"]').count()) === 0 && /begin game/i.test(await page.locator('[data-dock-role="begin"]').innerText()));
  await page.locator('[data-testid="start-by-hand"]').click();
  await page.waitForTimeout(200);
  check("By hand: the half switch, and Begin says Set out my pieces", (await page.locator('[data-testid="set-out-half-setup"]').count()) === 1 && /set out my pieces/i.test(await page.locator('[data-dock-role="begin"]').innerText()));
  // (Read back at load: the computer's section below starts from it kept.
  // No reload here: a reload straight after a save can find it not yet
  // written, in a test's browser; CI run 54.)
  check("...kept", await page.evaluate(() => localStorage.getItem("el-cabeza:start-position") === "hand"));
  await page.locator('[data-dock-role="begin"]').click();
  let s = await poll(() => so(page), 8000);
  await page.waitForTimeout(600);
  await settled(page);
  check("Set out my pieces: setting out, Walnut's side, no game yet", !!s && s.side === "dark" && (await page.evaluate(() => window.__EC_TEST_ARMED__)) !== true);
  check("...the banner, the dock and the title aside", (await page.locator('[data-testid="set-out-banner"]').count()) === 1 && (await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "false" && (await page.locator('[data-dock-piece]').evaluate((e) => getComputedStyle(e).display)) === "none" && (await page.locator("[data-masthead]").evaluate((e) => getComputedStyle(e).opacity)) === "0");
  const cam = await page.evaluate(() => window.__EC_TEST_CAM__());
  check(`...the camera tipped over the board from Walnut's side (pitch ${cam.phi.toFixed(2)})`, Math.abs(Math.cos(cam.theta) + 1) < 1e-6 && cam.phi < 0.6);
  check("...your rows outlined, the bench in front", (await marks(page, "set-out-zone")) === 1 && (await marks(page, "set-out-bench")) === 1);
  check(`...the title: "${await title(page)}"`, /drag a piece/i.test(await title(page)));

  // A tap chooses; dots on every free square of the back three rows.
  await tap(page, await pos(page, "dark-turrito"));
  s = await so(page);
  const dots = await marks(page, "set-out-dot");
  check(`a tap on the Turrito chooses it, a dot on each free square (${dots / 2})`, s.chosen === "dark-turrito" && dots / 2 === 30 - 9 && /turrito/i.test(await title(page)));
  await tap(page, await sq(page, 1, 0));
  s = await so(page);
  check("a tap on the dot at row 2, column 1: it's there, and Ash's mirrors it", at(s, "dark-turrito").row === 1 && at(s, "dark-turrito").col === 0 && at(s, "light-turrito").row === 8 && at(s, "light-turrito").col === 9 && mirrored(s) && !s.chosen);

  // A drag onto the Flaco: the Flaco to the bench.
  const fl = at(s, "dark-flaco");
  await drag(page, await pos(page, "dark-turrito"), await sq(page, fl.row, fl.col));
  s = await so(page);
  check("the Turrito dragged onto the Flaco: the Flaco on the bench, Ash's off the board", s.bench.join() === "dark-flaco" && !at(s, "dark-flaco") && !at(s, "light-flaco") && at(s, "dark-turrito").row === 0 && at(s, "dark-turrito").col === 3 && mirrored(s));
  check(`...the banner says so: "${await title(page)}"`, /flaco to the bench/i.test(await title(page)) && (await page.locator('[data-testid="set-out-bench-count"]').innerText()).includes("1"));
  check("...the Flaco stands on the bench", !!(await benchPos(page, "dark-flaco")));
  await page.locator('[data-testid="set-out-begin"]').click();
  await page.waitForTimeout(400);
  s = await so(page);
  check("Begin waits for it: still setting out, the Flaco chosen", !!s && s.note === "bench" && s.chosen === "dark-flaco" && /still on the bench/i.test(await title(page)));
  check("...Put it back can't: the Turrito's on its squares", await page.locator('[data-testid="set-out-put-back"]').isDisabled());
  await drag(page, await benchPos(page, "dark-flaco"), await sq(page, 2, 8));
  s = await so(page);
  check("the Flaco dragged from the bench onto the board: set out again, mirrored", s.bench.length === 0 && at(s, "dark-flaco") && at(s, "dark-flaco").col === 8 && at(s, "light-flaco") && mirrored(s));

  // The Cabeza onto the Turrito: both one square, so they swap.
  const cab = at(s, "dark-cabeza"), tur = at(s, "dark-turrito");
  await tap(page, await pos(page, "dark-cabeza"));
  await tap(page, await pos(page, "dark-turrito"));
  s = await so(page);
  check("the Cabeza chosen, then the Turrito tapped: they swap squares", at(s, "dark-cabeza").row === tur.row && at(s, "dark-cabeza").col === tur.col && at(s, "dark-turrito").row === cab.row && at(s, "dark-turrito").col === cab.col && s.bench.length === 0 && s.note === "swapped" && /swapped/i.test(await title(page)));

  // Turning: the chosen Flaco tapped again.
  const f0 = at(s, "dark-flaco");
  await tap(page, await pos(page, "dark-flaco"));
  await tap(page, await pos(page, "dark-flaco"));
  s = await so(page);
  const f1 = at(s, "dark-flaco");
  check("the chosen Flaco tapped again: it turns, and Ash's with it", !!f1 && `${f1.w}${f1.h}${f1.z}` !== `${f0.w}${f0.h}${f0.z}` && mirrored(s) && s.chosen === "dark-flaco");
  await page.locator('[data-testid="set-out-undo"]').click();
  await page.waitForTimeout(400);
  s = await so(page);
  check("Undo: as it was before the turn", `${at(s, "dark-flaco").w}${at(s, "dark-flaco").h}${at(s, "dark-flaco").z}` === `${f0.w}${f0.h}${f0.z}` && at(s, "dark-flaco").row === f0.row && at(s, "dark-flaco").col === f0.col);

  // The keys: the arrows move where it would go, Enter sets it there.
  await tap(page, await pos(page, "dark-opa"));
  const o0 = at(await so(page), "dark-opa");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  const aim = (await so(page)).aim;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  s = await so(page);
  check("the Opa chosen, an arrow and Enter: one column over, mirrored", !!aim && aim.row === o0.row && Math.abs(aim.col - o0.col) === 1 && at(s, "dark-opa").col === aim.col && mirrored(s), JSON.stringify({ o0, aim }));
  await tap(page, await pos(page, "dark-opa"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("...Escape lets go", !(await so(page)).chosen);

  // Anywhere in my half.
  await page.locator('[data-testid="set-out-half"]').click();
  await page.waitForTimeout(300);
  await tap(page, await pos(page, "dark-turrito"));
  await tap(page, await sq(page, 4, 0));
  s = await so(page);
  check("Anywhere in my half: the Turrito set in row 5, Ash's in row 6", s.half && at(s, "dark-turrito").row === 4 && at(s, "light-turrito").row === 5 && mirrored(s));
  await page.locator('[data-testid="set-out-half"]').click();
  await page.waitForTimeout(400);
  s = await so(page);
  check("...switched off: the Turrito out of its rows waits on the bench", !s.half && s.bench.includes("dark-turrito") && !at(s, "light-turrito"));
  await page.locator('[data-testid="set-out-standard"]').click();
  await page.waitForTimeout(400);
  s = await so(page);
  check("Standard: every piece back where it began", s.bench.length === 0 && at(s, "dark-flaco").row === 0 && at(s, "dark-flaco").col === 3 && at(s, "dark-opa").row === 1 && at(s, "dark-opa").col === 4 && mirrored(s));

  // A Cabeza that could be crushed on the first move.
  await page.locator('[data-testid="set-out-half"]').click();
  await page.waitForTimeout(300);
  await tap(page, await pos(page, "dark-cabeza"));
  await tap(page, await sq(page, 4, 0));
  await tap(page, await pos(page, "dark-opa"));
  await tap(page, await sq(page, 3.5, 8.5)); // (the Opa's dot for rows 4-5, columns 9-10)
  s = await so(page);
  await page.locator('[data-testid="set-out-begin"]').click();
  await page.waitForTimeout(500);
  s = await so(page);
  check("a Cabeza the other side could crush on the first move: Begin waits", !!s && s.note === "danger" && /crushed on the first move/i.test(await title(page)) && (await page.evaluate(() => window.__EC_TEST_ARMED__)) !== true);
  check("...ringed in red", (await marks(page, "set-out-danger")) > 0 && (s.danger || []).some((id) => /cabeza/.test(id)));
  await page.locator('[data-testid="set-out-standard"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="set-out-half"]').click();
  await page.waitForTimeout(300);

  // Begin: the game from the set-out.
  await tap(page, await pos(page, "dark-turrito"));
  await tap(page, await sq(page, 2, 9));
  s = await so(page);
  const setOutAs = s.pieces;
  await page.locator('[data-testid="set-out-begin"]').click();
  check("Begin: the game begins", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  const now = await page.evaluate(() => window.__EC_TEST_PIECES__);
  check("...from the set-out, the banner gone", setOutAs.every((p) => { const q = now.find((x) => x.id === p.id); return q && q.row === p.row && q.col === p.col; }) && (await page.locator('[data-testid="set-out-banner"]').count()) === 0 && (await so(page)) === null);
  check("...kept for Same as last time", await page.evaluate(() => { const k = JSON.parse(localStorage.getItem("el-cabeza:set-out-last") || "null"); return !!k && k.pieces.some((p) => p.key === "turrito" && p.row === 2 && p.col === 9); }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-turrito", "N"));
  await poll(() => page.evaluate(() => { const q = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === "dark-turrito"); return q && q.row === 3; }), 8000);
  await page.waitForTimeout(600);
  // (The record's opening: the board as the first turn found it.)
  const rec = await page.evaluate(() => window.__EC_TEST_REPLAY_START__ && window.__EC_TEST_REPLAY_START__());
  check("...and the game's record starts from it", !!rec && rec.length === 10 && rec.some((p) => p.id === "dark-turrito" && p.row === 2 && p.col === 9));

  // New Game, then Same as last time.
  await page.evaluate(() => window.__EC_TEST_NEW_GAME__());
  await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === false), 6000);
  await page.waitForTimeout(1500);
  {
    await openDockPanel(page);
    await page.waitForTimeout(300);
    await page.locator('[data-dock-role="begin"]').click();
    s = await poll(() => so(page), 8000);
    await page.waitForTimeout(600);
    await settled(page);
    check("a new game, set out again: Same as last time offered", !!s && s.sameAsLast && (await page.locator('[data-testid="set-out-same"]').count()) === 1);
    await page.locator('[data-testid="set-out-same"]').click();
    await page.waitForTimeout(400);
    s = await so(page);
    check("...and it sets them out as last time", at(s, "dark-turrito").row === 2 && at(s, "dark-turrito").col === 9 && mirrored(s));
    await page.locator('[data-testid="set-out-back"]').click();
    await page.waitForTimeout(800);
    check("Back: the setup again, the pieces as the set has them", (await so(page)) === null && (await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true" && await page.evaluate(() => { const t = (window.__EC_TEST_PIECES__ || []).find((x) => x.id === "dark-turrito"); return !!t && t.row === 0 && t.col === 4; }));
  }
  check("no errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("computer")) {
  console.log("Against the computer playing Walnut");
  const { ctx, page, errs } = await open("standard", { seed: { "el-cabeza:start-position": "hand" } });
  await openDockPanel(page);
  await page.waitForTimeout(300);
  await page.locator('[data-opponent="ai-dark"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-dock-role="begin"]').click();
  let s = await poll(() => so(page), 8000);
  await page.waitForTimeout(600);
  await settled(page);
  const cam = await page.evaluate(() => window.__EC_TEST_CAM__());
  check("By hand kept from before: you set out Ash's side, the camera from there", !!s && s.side === "light" && Math.abs(Math.cos(cam.theta) - 1) < 1e-6);
  check(`...the banner: "the computer mirrors"`, /the computer mirrors every move/i.test(await page.locator('[data-testid="set-out-hint"]').innerText()));
  await tap(page, await pos(page, "light-turrito"));
  await tap(page, await sq(page, 8, 9));
  s = await so(page);
  check("Ash's Turrito set in row 9, Walnut's (the computer's) mirrors it", at(s, "light-turrito").row === 8 && at(s, "light-turrito").col === 9 && at(s, "dark-turrito").row === 1 && at(s, "dark-turrito").col === 0 && mirrored(s));
  await page.locator('[data-testid="set-out-begin"]').click();
  check("Begin: the game begins", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  check("no errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("gate")) {
  console.log("A world's own menu: the reality gate's Standard Cabeza, in Cromo");
  const { ctx, page, errs } = await open("cromo", { seed: { "el-cabeza:start-position": "hand", "el-cabeza:story": JSON.stringify({ owned: true, storeGone: true, ended: true }), "el-cabeza:singularity-seen": "1", "el-cabeza:commercial-aired": "1", "el-cabeza:special-order-noted": "1" } });
  const gate = await poll(async () => (await page.locator('[data-testid="gate-standard"]').count()) > 0, 25000);
  if (gate) {
    await page.waitForTimeout(800);
    await page.locator('[data-testid="gate-standard"]').click();
    const s = await poll(() => so(page), 8000);
    check("Standard Cabeza, with By hand chosen: set out first", !!s && (await page.evaluate(() => window.__EC_TEST_ARMED__)) !== true);
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="set-out-begin"]').click();
    check("...then Begin: the game", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  } else check("the gate came up", false);
  check("no errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("worlds")) console.log("Every world");
if (want("worlds")) for (const w of ["neon", "cromo", "plano", "luna", "ciudad", "noir", "lluvia", "tienda", "lab", "parrish?look=orinoco", "parrish?look=watermark"]) {
  const [world, q] = w.split("?");
  const { ctx, page, errs } = await open(world, { query: q ? `?${q}` : "" });
  let s = await setOutFromDock(page);
  await page.waitForTimeout(600);
  await settled(page);
  if (!s) { check(`${w}: setting out`, false); await ctx.close(); continue; }
  const mine = s.pieces.filter((p) => p.owner === s.side);
  const t = mine.find((p) => p.type === "turrito"), f = mine.find((p) => p.type === "flaco");
  await tap(page, await pos(page, t.id));
  await tap(page, await pos(page, f.id));
  s = await so(page);
  const benched = s.bench.join() === f.id && mirrored(s) && !!(await benchPos(page, f.id));
  await drag(page, await benchPos(page, f.id), await sq(page, s.side === "dark" ? 2 : 7, 8));
  s = await so(page);
  const back = s.bench.length === 0 && mirrored(s);
  await page.locator('[data-testid="set-out-begin"]').click();
  const begun = !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000));
  check(`${w}: set out, a piece benched and set out again, begun`, benched && back && begun, JSON.stringify({ benched, back, begun }));
  check(`${w}: no errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("phone")) {
  console.log("A phone: Nova's bar");
  const { ctx, page, errs } = await open("nova", { phone: true, seed: { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:nova-layout": "bar" } });
  await page.waitForFunction(() => !!window.__DEN_LURE_SKIP__, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(-600000));
  await page.waitForTimeout(800);
  const start = page.locator('[data-testid="shell-start"] button[data-value="true"]');
  check("the setup's Start, in the bar", (await start.count()) === 1);
  await start.tap();
  await page.waitForTimeout(300);
  check("...By hand: Pieces in, and Set out my pieces", (await page.locator('[data-testid="shell-set-out-half"]').count()) === 1 && /set out my pieces/i.test(await page.locator('[data-testid="shell-begin"]').innerText()));
  await page.locator('[data-testid="shell-begin"]').tap();
  let s = await poll(() => so(page), 8000);
  await page.waitForTimeout(600);
  await settled(page);
  check("setting out: the banner on top, its buttons along the bottom", !!s && (await page.locator('[data-testid="set-out-bar"]').count()) === 1 && (await page.locator('[data-testid="set-out-bar"] [data-testid="set-out-undo"]').count()) === 1);
  const bar = await page.locator('[data-testid="set-out-bar"]').boundingBox();
  const ban = await page.locator('[data-testid="set-out-banner"]').boundingBox();
  const board = await sq(page, 0, 0), far = await sq(page, 9, 9);
  check("...the board between them", board.y < bar.y && far.y > ban.y + ban.height && board.x > 0 && board.x < 390 && far.x > 0 && far.x < 390, JSON.stringify({ board, far, bar, ban }));
  const opa = at(s, "dark-opa");
  const op = await pos(page, opa.id);
  await page.touchscreen.tap(op.x, op.y);
  await page.waitForTimeout(500);
  const chosen = (await so(page)).chosen;
  // (Its dot: where its middle would be, the corner its four squares share.)
  const q = await sq(page, 1.5, 8.5);
  await page.touchscreen.tap(q.x, q.y);
  await page.waitForTimeout(700);
  s = await so(page);
  check("tap the Opa, then a square: it's there, mirrored", chosen === opa.id && at(s, "dark-opa").row === 1 && at(s, "dark-opa").col === 8 && mirrored(s), JSON.stringify({ op, chosen, q, opa: at(s, "dark-opa") }));
  await page.locator('[data-testid="set-out-begin"]').tap();
  check("Begin: the game", !!(await poll(() => page.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  check("no errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} check(s) failed` : "\nall set-out checks passed");
process.exit(fails ? 1 : 0);
