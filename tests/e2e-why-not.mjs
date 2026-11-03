/* A refused move says why (user, with a clip of a yellow Cruce that
   wouldn't slide: "when attempting to make a move that's not allowed, for
   whatever reason, a pop-up should appear with an explanation"; the pick,
   A1: an X on the square aimed at with a bubble beside it saying why,
   tagged with the setting; its own setting, Why not, since the user's
   "they need to be separated out" from the Piece guide). On the user's
   own position in the Lab (Neo-Brutalism; slides, shoving on slides,
   only opponents):
   1. Desktop: dragging the yellow Cruce toward the pink one shows the X
      while it points there; let go, nothing moves and the note, tagged
      Why not, says it's too heavy to push (4 cubes against 4), the X
      kept, clear of the Cruce; the piece card put away while it's up
      (one thing to read at a time). It stays up till a click outside it
      (user: "leave why not pop-up cards open until ... you click outside
      of it"): a click on the note itself, a drag on the board turning
      the view and the wheel leave it up; the next click outside puts
      both away. A stray tap on an empty square says nothing. A press of
      a boxed-in Turrito says what's in its way. After a roll a row down,
      the same drag: not enough actions, 3 (slide 2, push 1), 1 left;
      still up after 5 s; mid-turn a tap on an empty square (the Cruce
      still chosen) puts it away; the same drag again, then Escape.
   2. Why not switched off: the same drag, no note and no X, the piece
      card still there. The Piece guide off and Why not on: the note, and
      no card. A player who'd switched the guide off before this (no
      Why not saved yet): no note, as then.
   3. A phone, by touch: the note above the X, clear of the finger; a
      finger's drag on the board leaves it up, a tap outside it puts it
      away.
   4. In Spanish: the note, and its tag, in Spanish.
     node tests/e2e-why-not.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const P = (id, type, owner, row, col, w, h, z, vox) => ({ id, type, owner, row, col, w, h, z, ...(vox ? { vox } : {}) });
// The clip's pieces (and a Turrito boxed into the corner by its own side).
const CLIP = [
  P("light-cruce", "cruce", "light", 4, 3, 3, 2, 1, "1,0,0;0,1,0;1,1,0;2,1,0"),
  P("dark-cruce", "cruce", "dark", 5, 6, 1, 2, 3, "0,0,0;0,0,1;0,0,2;0,1,1"),
  P("dark-cabeza", "cabeza", "dark", 6, 6, 1, 1, 1),
  P("light-1x3", "block1x3", "light", 4, 6, 3, 1, 1),
  P("light-cabeza", "cabeza", "light", 6, 2, 1, 1, 1),
  P("light-turrito", "turrito", "light", 9, 0, 1, 1, 1),
  P("light-flaco", "flaco", "light", 8, 0, 1, 1, 2),
  P("light-turrito-2", "turrito", "light", 9, 1, 1, 1, 1),
  P("dark-turrito", "turrito", "dark", 0, 9, 1, 1, 1),
];
const LAWS = { slide: true, shoving: true, shoveOnRolls: false, shoveOwn: false, shoveChain: false, blackHoleSquares: true };
const DESK = { viewport: { width: 1366, height: 768 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// guide: the Piece guide's switch; whyNot: Why not's (null: never set).
async function open({ phone = false, guide = true, whyNot = null, lang = null } = {}) {
  const ctx = await browser.newContext(phone ? PHONE : DESK);
  await ctx.addInitScript(({ laws, guide, whyNot }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__EC_LAWS__ = laws;
    try {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("el-cabeza:lab-theme", "neoBrutalist");
      if (!guide) localStorage.setItem("el-cabeza:piece-guide", "0");
      if (whyNot !== null) localStorage.setItem("el-cabeza:why-not", whyNot ? "1" : "0");
    } catch (e) { /* none */ }
  }, { laws: LAWS, guide, whyNot });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-lab.html?theme=neoBrutalist${lang ? `&lang=${lang}` : ""}`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__EC_TEST_SET_HOLES__([{ row: 3, col: 0 }, { row: 7, col: 6 }]));
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), CLIP);
  await page.waitForTimeout(400);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game|Empezar partida|Probar una partida/ }).first().click();
  await page.waitForTimeout(2500);
  // Pink opens: two steps of its Turrito, and it's yellow's turn.
  for (const d of ["W", "W"]) { await page.evaluate((d) => window.__EC_TEST_MOVE__("dark-turrito", d), d); await page.waitForTimeout(1600); }
  return { ctx, page, errs, phone };
}
// The camera on a board point (row, col), the board turned a little.
async function aim(page, phone, at) {
  await page.evaluate((c) => window.__EC_TEST_CAM__({ theta: c.theta, phi: c.phi, radius: c.radius, snap: true }), phone ? { theta: 0.1, phi: 0.62, radius: 16.5 } : { theta: 0.14, phi: 0.78, radius: 11 });
  await page.waitForTimeout(400);
  await page.evaluate(([row, col]) => {
    const t = window.__EC_TEST_THREE__();
    const v = new t.camera.position.constructor(col * 1.056 - 5.28, 0, row * 1.056 - 5.28);
    t.boardGroup.localToWorld(v);
    window.__EC_TEST_CAM__({ target: [v.x, 0, v.z], snap: true });
  }, at);
  await page.waitForTimeout(600);
}
const tap = async (s, x, y) => { if (s.phone) await s.page.touchscreen.tap(x, y); else await s.page.mouse.click(x, y); await s.page.waitForTimeout(500); };
const chosen = (page) => page.locator('[data-testid="piece-card"]').count();
// A drag from (x, y) one square's way along row r from column c to c + 1,
// by mouse or finger; what the board shows while it points there.
async function dragEast(s, from, [r, c]) {
  const { page } = s;
  const v = await page.evaluate(([r, c]) => { const a = window.__EC_TEST_SQUARE_POS__(r, c), b = window.__EC_TEST_SQUARE_POS__(r, c + 1); return { x: b.x - a.x, y: b.y - a.y }; }, [r, c]);
  const len = Math.hypot(v.x, v.y), ux = v.x / len, uy = v.y / len;
  const cues = () => page.evaluate(() => { const t = window.__EC_TEST_THREE__(); return { x: t.slideBlockGroup.visible, arrow: t.slideArrowGroup.visible }; });
  let mid;
  if (!s.phone) {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ux * 9 * i, from.y + uy * 9 * i);
    await page.waitForTimeout(150);
    mid = await cues();
    await page.mouse.up();
  } else {
    const cdp = await page.context().newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(from.x, from.y) });
    for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(from.x + ux * 9 * i, from.y + uy * 9 * i) }); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    mid = await cues();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForTimeout(350);
  return mid;
}
// The note as it stands (null when there's none), and where the X is on the screen.
const note = (page) => page.evaluate(() => {
  const n = document.querySelector('[data-testid="why-not"]');
  const t = window.__EC_TEST_THREE__();
  if (!n) return { up: false, x: t.slideBlockGroup.visible };
  const r = n.getBoundingClientRect();
  const v = t.slideBlockGroup.position.clone();
  t.boardGroup.localToWorld(v);
  v.project(t.camera);
  const c = t.renderer.domElement.getBoundingClientRect();
  return {
    up: true, code: n.dataset.code, visible: getComputedStyle(n).visibility === "visible",
    tag: n.querySelector('[data-testid="why-not-tag"]').textContent,
    title: n.querySelector('[data-testid="why-not-title"]').textContent,
    body: n.querySelector('[data-testid="why-not-body"]').textContent,
    box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    x: t.slideBlockGroup.visible,
    xAt: { x: c.left + ((v.x + 1) / 2) * c.width, y: c.top + ((1 - v.y) / 2) * c.height },
    inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
  };
});
const pieceAt = (page, id) => page.evaluate((i) => window.__EC_TEST_PIECES__.find((p) => p.id === i), id);
// An empty square's place on the screen clear of the note's box (and of
// the screen's edges), for a tap or a drag outside it.
const EMPTY = [[2, 7], [1, 2], [1, 5], [8, 8], [2, 1], [7, 9], [8, 4], [7, 3], [8, 5], [9, 6], [9, 4], [6, 4], [3, 8], [2, 4]];
const outside = (page, box) => page.evaluate(([cells, box]) => {
  for (const [r, c] of cells) {
    const p = window.__EC_TEST_SQUARE_POS__(r, c);
    if (!p || p.x < 60 || p.y < 90 || p.x > innerWidth - 60 || p.y > innerHeight - 140) continue;
    if (box && p.x > box.left - 30 && p.x < box.right + 30 && p.y > box.top - 30 && p.y < box.bottom + 30) continue;
    return { x: p.x, y: p.y };
  }
  return null;
}, [EMPTY, box]);

// ---- 1. Desktop: the clip, both refusals; a stray tap; a boxed-in piece ----
{
  console.log("[desktop]");
  const s = await open();
  const { page, errs } = s;
  await aim(page, false, [5.2, 5.4]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  let mid = await dragEast(s, from, [5, 5]);
  check("dragging the yellow Cruce toward the pink one: the X, no arrow", mid.x && !mid.arrow, JSON.stringify(mid));
  let n = await note(page);
  check("let go: Why not's note, too heavy to push", n.up && n.code === "heavy" && n.visible && n.tag === "Why not", JSON.stringify(n));
  check("...the piece card put away while it's up", (await chosen(page)) === 0);
  const cruceBox = await page.evaluate(() => { const r = window.__EC_TEST_PIECE_RECT__("light-cruce"); return r && { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  check("...the note clear of the chosen Cruce", !!cruceBox && (n.box.right <= cruceBox.l || n.box.left >= cruceBox.r || n.box.bottom <= cruceBox.t || n.box.top >= cruceBox.b), JSON.stringify({ note: n.box, cruce: cruceBox }));
  check("...\"Can't push the Pink Cruce\": 4 cubes, as many as yours", n.title === "Can't push the Pink Cruce" && /4 cubes, as many as your Cruce/.test(n.body) && /fewer cubes/.test(n.body), `${n.title} | ${n.body}`);
  check("...beside the X, on the screen, the X kept", n.x && n.inView && n.box.left > n.xAt.x, JSON.stringify(n));
  const c1 = await pieceAt(page, "light-cruce");
  check("...and nothing moved", c1.row === 4 && c1.col === 3 && c1.w === 3, JSON.stringify(c1));
  // Up till a click outside it: a click on the note, a drag turning the
  // view and the wheel leave it.
  await page.mouse.click((n.box.left + n.box.right) / 2, (n.box.top + n.box.bottom) / 2);
  await page.waitForTimeout(400);
  n = await note(page);
  check("a click on the note itself: still up, the X too", n.up && n.code === "heavy" && n.x, JSON.stringify(n));
  const turnFrom = await outside(page, n.box);
  check("(an empty square clear of the note, to drag from)", !!turnFrom, JSON.stringify(n.box));
  if (turnFrom) {
    await page.mouse.move(turnFrom.x, turnFrom.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(turnFrom.x + i * 11, turnFrom.y + i * 3);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(500);
  }
  n = await note(page);
  check("a drag on the board turning the view, and the wheel: still up, the X too", n.up && n.code === "heavy" && n.x && n.visible, JSON.stringify(n));
  await page.mouse.click(1300, 40);
  await page.waitForTimeout(300);
  n = await note(page);
  check("the next click outside it puts the note and the X away", !n.up && !n.x, JSON.stringify(n));
  await aim(page, false, [5.2, 5.4]);
  // A stray tap on an empty square: nothing said.
  const empty = await page.evaluate(() => window.__EC_TEST_SQUARE_POS__(2, 7));
  await tap(s, empty.x, empty.y);
  check("a tap on an empty square says nothing", !(await note(page)).up);
  // A press of the Turrito boxed into the corner by its own side.
  await aim(page, false, [8.5, 1]);
  const boxed = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-turrito"));
  await tap(s, boxed.x, boxed.y);
  n = await note(page);
  check("a press of a piece with no move: the note says so", n.up && n.code === "boxed" && n.title === "No move for your Turrito", JSON.stringify(n));
  check("...and what's in the way: the edge, your Flaco and your Turrito", /edge of the board/.test(n.body) && /your Flaco/.test(n.body) && /your Turrito/.test(n.body), n.body);
  await page.mouse.click(1300, 40);
  await page.waitForTimeout(300);
  // Back to the Cruce, chosen again; a roll a row down, then the same drag.
  await aim(page, false, [5.2, 5.4]);
  if ((await chosen(page)) === 0 || (await page.locator('[data-testid="piece-card"][data-piece="cruce"]').count()) === 0) {
    const p = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
    await tap(s, p.x, p.y);
  }
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-cruce", "S"));
  await page.waitForTimeout(1800);
  await aim(page, false, [5.2, 5.4]);
  const from2 = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  mid = await dragEast(s, from2, [6, 5]);
  n = await note(page);
  check("after the roll, the same drag: the X while it points there", mid.x && !mid.arrow, JSON.stringify(mid));
  check("...let go: not enough actions", n.up && n.code === "cost" && n.title === "Not enough actions", JSON.stringify(n));
  check("...pushing the Pink Cabeza: 3 actions (slide 2, push 1), 1 left", /pushes the Pink Cabeza: 3 actions \(slide 2, push 1\)\. You have 1 left\./.test(n.body), n.body);
  await page.waitForTimeout(5000);
  n = await note(page);
  check("...still up after 5 s (it stays till a click outside it), the X too", n.up && n.code === "cost" && n.x, JSON.stringify(n));
  // Mid-turn a tap on an empty square leaves the Cruce chosen; the note
  // goes all the same.
  const spot = await outside(page, n.box);
  if (spot) await tap(s, spot.x, spot.y);
  n = await note(page);
  check("mid-turn, a tap on an empty square (the Cruce still chosen): the note and the X away", !!spot && !n.up && !n.x, JSON.stringify({ spot, n }));
  mid = await dragEast(s, from2, [6, 5]);
  n = await note(page);
  check("the same drag again: its note again", n.up && n.code === "cost", JSON.stringify(n));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  n = await note(page);
  check("...Escape puts it away", !n.up && !n.x, JSON.stringify(n));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}

// ---- 2. Why not, its own switch ----
{
  console.log("[why not off]");
  const s = await open({ whyNot: false });
  const { page, errs } = s;
  await aim(page, false, [5.2, 5.4]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  check("with Why not off, the Piece guide's card for the chosen Cruce still there", (await chosen(page)) === 1);
  const mid = await dragEast(s, from, [5, 5]);
  const n = await note(page);
  check("...the same drag: no X, no note", !mid.x && !n.up && !n.x, JSON.stringify({ mid, n }));
  const c1 = await pieceAt(page, "light-cruce");
  check("...and nothing moved", c1.row === 4 && c1.col === 3, JSON.stringify(c1));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}
{
  console.log("[guide off, why not on]");
  const s = await open({ guide: false, whyNot: true });
  const { page, errs } = s;
  await aim(page, false, [5.2, 5.4]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  check("with the Piece guide off, no card for the chosen Cruce", (await chosen(page)) === 0);
  const mid = await dragEast(s, from, [5, 5]);
  const n = await note(page);
  check("...Why not still on: the X, then its note", mid.x && n.up && n.code === "heavy" && n.tag === "Why not", JSON.stringify({ mid, n }));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}
{
  console.log("[guide off before, why not never set]");
  const s = await open({ guide: false });
  const { page, errs } = s;
  await aim(page, false, [5.2, 5.4]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  const mid = await dragEast(s, from, [5, 5]);
  const n = await note(page);
  check("a player who'd switched the guide off (when it held the note): no X, no note, as then", !mid.x && !n.up && !n.x, JSON.stringify({ mid, n }));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}

// ---- 3. A phone, by touch: above the X ----
{
  console.log("[phone]");
  const s = await open({ phone: true });
  const { page, errs } = s;
  await aim(page, true, [5.9, 5.3]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  const mid = await dragEast(s, from, [5, 5]);
  const n = await note(page);
  check("a finger's drag toward the pink Cruce: the X, then the note", mid.x && n.up && n.code === "heavy" && n.visible, JSON.stringify({ mid, n }));
  check("...above the X, clear of the finger, on the screen", n.up && n.box.bottom < n.xAt.y && n.inView, JSON.stringify(n));
  // A finger's drag on the board (the view turned): still up.
  const turnFrom = await outside(page, n.box);
  if (turnFrom) {
    const cdp = await page.context().newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(turnFrom.x, turnFrom.y) });
    for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(turnFrom.x + i * 9, turnFrom.y + i * 2) }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
  }
  let n2 = await note(page);
  check("a finger's drag on the board, the view turned: still up", !!turnFrom && n2.up && n2.code === "heavy" && n2.x, JSON.stringify({ turnFrom, n2 }));
  const away = await outside(page, n2.box);
  if (away) await tap(s, away.x, away.y);
  n2 = await note(page);
  check("...a tap outside it puts it away", !!away && !n2.up && !n2.x, JSON.stringify({ away, n2 }));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}

// ---- 4. In Spanish ----
{
  console.log("[es]");
  const s = await open({ lang: "es" });
  const { page, errs } = s;
  await aim(page, false, [5.2, 5.4]);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cruce"));
  await tap(s, from.x, from.y);
  await dragEast(s, from, [5, 5]);
  const n = await note(page);
  check("in Spanish: the tag and the note", n.up && n.tag === "Por qué no" && n.title === "No se puede empujar el Cruce de Rosa" && /Tiene 4 cubos, tantos como tu Cruce\./.test(n.body), JSON.stringify(n));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await s.ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nWHY-NOT E2E PASSED" : `\nWHY-NOT E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
