/* A new player's first game in the store, walked through (user,
   2026-10-17: "On a brand new game, when you start a game, it should just
   automatically select. You get to be the ash pieces, and the computer
   will be the walnut pieces ... Automatically selects easy, and all they
   have to do is just begin a game. They click begin a game, and then a
   little pop-up will say, "Welcome to your first game of El Cabeza."
   Copyright 1975 ... We need to create a first-time player walkthrough
   tutorial"; then: "Highlight the pieces as they're explained. Arrows to
   indicate stuff will be helpful. Make it perfectly transparent how the
   game is played. Hand-holding is encouraged here"; then, 2026-10-18:
   "Before the win conditions are shown, it should be mentioned that there
   are 2 ways to win, and then show them", and at "or crush the opponent's
   Cabeza", "it should cut to a zoomed in example of this happening to
   illustrate"; chassis/FirstGameTour.jsx).

   On a phone, from a fresh story: the computer on Easy playing Walnut and
   you Ash, moving first, chosen already; Try a Game brings the cards at
   the top, the board framed under them and what each names lit up: both
   sides ringed and labelled; the two ways to win, both Cabezas ringed and
   numbered; your Cabeza, the row you win on lit green and an arrow to it,
   its head held a moment straight up from your Cabeza, then sliding along
   the row to both ends and back (user: "anywhere on the back row is
   valid"; held still with reduced motion);
   Walnut's Cabeza crushed, a cut to a close-up of copies of a block of
   yours rolling onto a copy of it, over and over (the real pieces
   untouched), the camera gliding back out on Next; your four blocks, named; the
   actions' lights ringed; arrows round the board and a fingertip along
   them. The computer waits on the cards, and a tap on a piece picks
   nothing while one's up. Then your turn: the pieces that can move glow,
   named (the boxed-in ones said so); each piece tapped told (its name, how
   far, how many times a turn: the Opa once, the Turrito twice), the camera
   in on it, an arrow to each square it can reach; the Flaco moved by
   tapping its square, then End turn pointed out, and pressed; Walnut's
   turn, then what it moved shown with an arrow from where it stood. Then
   the menu (user, 2026-10-21: "An addendum to the tutorial should be about
   the UI or user interface"): the piece in the corner ringed, labelled and
   calling; a tap on it opens the menu and the card for what's inside, each
   row ringed and said in the menu's words; Next, the buttons along its
   foot, drawn on the card, one ring round them; Back; a tap outside puts
   it away (the piece's card again), Open it opens it; Got it, the menu put
   away, the camera back, kept as done: Try a Game again brings no tour. On
   a desktop: the card at the left, a mouse's words and a mouse's way round
   for the board; Skip the tour ends it, kept as done, and the game goes on
   as ever; the menu's cards in a mouse's words, the card beside the open
   menu; Escape skips it too.

   node tests/e2e-first-game-tour.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

async function open(phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${NOVA}?fresh`);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').click();
  await page.waitForTimeout(3500);
  return { ctx, page, errs };
}
const tourOf = (page) => page.evaluate(() => window.__EC_TEST_TOUR__ && window.__EC_TEST_TOUR__());
const card = (page) => page.locator('[data-testid="tour-card"]');
const cardText = async (page) => ((await card(page).count()) ? (await card(page).innerText()).replace(/\s+/g, " ") : "");
const camOf = (page) => page.evaluate(() => { const c = window.__EC_TEST_CAM__(); return { theta: c.theta, phi: c.phi, radius: c.radius }; });
// The rings on the board (tourGroup): [{ pieceId, tone, pulse, faint }]; the lit row.
const rings = (page) => page.evaluate(() => window.__EC_TEST_THREE__().tourGroup.children.filter((c) => c.userData.kind === "tour-ring").map((c) => ({ ...c.userData, id: c.userData.pieceId })));
const band = (page) => page.evaluate(() => { const b = window.__EC_TEST_THREE__().tourGroup.children.find((c) => c.userData.kind === "tour-band"); return b ? b.userData.row : null; });
// A label's place on the screen, an arrow's path, a button's ring.
const tagBox = (page, key) => page.evaluate((k) => { const e = document.querySelector(`[data-testid="tour-marks"] [data-tag="${k}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, text: e.textContent }; }, key);
const arrowD = (page, key) => page.evaluate((k) => { const e = document.querySelector(`[data-testid="tour-marks"] [data-arrow="${k}"]`); return e ? e.getAttribute("d") || "" : null; }, key);
const ringRect = (page, key) => page.evaluate((k) => { const e = document.querySelector(`[data-testid="tour-marks"] [data-ring="${k}"] rect.ec-tour-pulse`); return e ? { x: +e.getAttribute("x"), y: +e.getAttribute("y"), w: +e.getAttribute("width"), h: +e.getAttribute("height") } : null; }, key);
/* Labels over what they name (user, the crush card on a phone: "Opponent's
   cabeza flag is obscuring the actual piece a little bit too much. Perhaps
   it needs to be moved down off it to the right a little bit"): each
   label's data-anchor is that thing's box on the screen. */
const overOwn = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="tour-marks"] [data-tag]')].filter((e) => {
  const a = (e.dataset.anchor || "").split(",").map(Number), r = e.getBoundingClientRect();
  return a.length === 4 && r.right > 0 && !(r.right <= a[0] || r.left >= a[2] || r.bottom <= a[1] || r.top >= a[3]);
}).map((e) => e.dataset.tag));
const anchorOf = (page, key) => page.evaluate((k) => { const e = document.querySelector(`[data-testid="tour-marks"] [data-tag="${k}"]`); const a = e && (e.dataset.anchor || "").split(",").map(Number); return a && a.length === 4 ? { x: a[0], y: a[1], w: a[2] - a[0], h: a[3] - a[1] } : null; }, key);
const boxOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (b, W, H) => !!b && b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
/* The arrow to the row you win on, its head along the row (user: "Have
   the arrowhead of this long green arrow kind of slide across the back to
   indicate that anywhere on the back row is valid"): at each frame till
   it's read, the head's tip, and where the row's end squares and the
   square straight up from your Cabeza then are. Read, each tip along the
   row (u: 0 at its first square, 1 at its last), off its line and from
   the square up from your Cabeza (in squares). */
const sweepLog = (page) => page.evaluate(() => {
  const cols = (window.__EC_TEST_BOARD__ && window.__EC_TEST_BOARD__.cols) || 10;
  const cab = window.__EC_TEST_PIECES__.find((p) => p.id === "light-cabeza");
  const log = (window.__SWEEP__ = []), t0 = performance.now();
  const at = (c) => { const p = window.__EC_TEST_SQUARE_POS__(0, c); return p && [p.x, p.y]; };
  const tick = () => {
    if (window.__SWEEP__ !== log) return;
    const h = document.querySelector('[data-testid="tour-marks"] [data-head="arrow-path"]');
    const m = h && /^M(-?[\d.]+),(-?[\d.]+)/.exec(h.getAttribute("d") || "");
    log.push({ t: Math.round(performance.now() - t0), tip: m ? [+m[1], +m[2]] : null, a: at(0), b: at(cols - 1), c: at(cab.col), cols });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const sweepFor = async (page, ms) => {
  for (let i = 0; i < 200 && (await page.evaluate(() => { const l = window.__SWEEP__ || []; return l.length ? l[l.length - 1].t : 0; })) < ms; i++) await page.waitForTimeout(100);
  const log = await page.evaluate(() => { const l = window.__SWEEP__; window.__SWEEP__ = null; return l || []; });
  return log.filter((s) => s.tip && s.a && s.b && s.c).map((s) => {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy), sq = L / (s.cols - 1);
    const px = s.tip[0] - s.a[0], py = s.tip[1] - s.a[1];
    return { t: s.t, u: +((px * dx + py * dy) / (L * L)).toFixed(3), off: +(Math.abs(px * dy - py * dx) / L / sq).toFixed(2), fromCab: +(Math.hypot(s.tip[0] - s.c[0], s.tip[1] - s.c[1]) / sq).toFixed(2) };
  });
};
const spread = (sw) => (sw.length ? Math.max(...sw.map((s) => s.u)) - Math.min(...sw.map((s) => s.u)) : 0);
// (How many times it turns back: u moving the other way by more than 0.02.)
const turnsOf = (sw) => { let dir = 0, turns = 0, last = sw.length ? sw[0].u : 0; sw.forEach((s) => { const d = s.u - last; if (Math.abs(d) > 0.02) { const nd = Math.sign(d); if (dir && nd !== dir) turns++; dir = nd; last = s.u; } }); return turns; };
async function begin(page) {
  await openDockPanel(page);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="tienda-try-game"]').click({ force: true });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
}
// Next, and the camera's glide to the card's view over.
const next = async (page) => { await page.locator('[data-testid="tour-next"]').click(); await page.waitForTimeout(2600); };

/* ---------------------------------------------------------------- phone */
{
  console.log("[phone: the whole first turn]");
  const W = 412, H = 915;
  const { ctx, page, errs } = await open(true);
  const tap = (x, y) => page.touchscreen.tap(x, y);
  const posOf = (id) => page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), id);
  // The new player's sides, chosen already.
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:opponent") || "null"));
  check("a new player plays the computer on Easy: it's Walnut, you're Ash and move first", prefs && prefs.aiPlayer === "dark" && prefs.aiDifficulty === "easy" && prefs.humanStartSide === "light", JSON.stringify(prefs));
  await openDockPanel(page);
  await page.waitForTimeout(600);
  const panel = await page.locator('[data-testid="dock-panel"]').innerText();
  check("the store's menu opens on Easy picked, nothing to choose but Try a Game", /easy/i.test(panel) && (await page.locator('[data-ec-diff-back]').count()) === 1 && /ash to move/i.test(panel), panel.replace(/\s+/g, " ").slice(0, 160));
  await page.locator('[data-testid="tienda-try-game"]').click({ force: true });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(3000);

  // The welcome: both sides ringed and labelled, the board under the card.
  let t = await cardText(page);
  let tour = await tourOf(page);
  check("Try a Game: the welcome card", tour.step === "welcome" && /Welcome to your first game of El Cabeza\./.test(t), t);
  check("...the year under it, as on the box", (await page.locator('[data-testid="tour-sub"]').innerText()).includes("© 1975"));
  check("...you're Ash, ringed in yellow; the computer Walnut, ringed in red", /You play Ash: the light pieces on your side, ringed in yellow\./.test(t) && /Your opponent, the computer, plays Walnut: the dark pieces across the board, ringed in red\./.test(t), t);
  let cardBox = await card(page).boundingBox();
  check("...a card at the top, the board not dimmed (no screen over it)", cardBox && cardBox.y < 140 && (await page.locator('[data-testid="tour-scrim"]').count()) === 0, JSON.stringify(cardBox));
  let r = await rings(page);
  check("...every piece ringed on the board: yours yellow and pulsing, Walnut's red", r.length === 10 && r.filter((x) => x.id.startsWith("light-") && x.tone === "mine" && x.pulse).length === 5 && r.filter((x) => x.id.startsWith("dark-") && x.tone === "foe").length === 5, JSON.stringify(r));
  const mineTag = await tagBox(page, "mine"), foeTag = await tagBox(page, "foe");
  const covered = [];
  const cover = async (card) => (await overOwn(page)).forEach((k) => covered.push(`${card}: ${k}`));
  await cover("welcome");
  check("...labelled ASH · YOU and WALNUT · THE COMPUTER, on the screen, clear of the card", !!mineTag && /Ash · you/i.test(mineTag.text) && !!foeTag && /Walnut · the computer/i.test(foeTag.text) && inView(mineTag, W, H) && inView(foeTag, W, H) && !overlap(mineTag, cardBox) && !overlap(foeTag, cardBox), JSON.stringify({ mineTag, foeTag, cardBox }));
  let cam = await camOf(page);
  check("...the board turned to show it, from your side and a little lower than straight down", tour.framed && Math.abs(cam.phi - 0.45) < 0.02 && Math.abs(Math.atan2(Math.sin(cam.theta), Math.cos(cam.theta))) < 0.02, JSON.stringify(cam));
  const dc = await posOf("dark-cabeza");
  check("...Walnut's side seen below the card, not under it", !!dc && dc.y > cardBox.y + cardBox.height, JSON.stringify({ dc, cardBox }));

  // Two ways to win, before either: both Cabezas ringed and numbered.
  await next(page);
  t = await cardText(page);
  check("Next: there are two ways to win, both said", /There are two ways to win\./.test(t) && /1\. Get your Cabeza across the board to your opponent's back row\./.test(t) && /2\. Crush opponent's Cabeza with one of your blocks\./.test(t) && /2 of 8/i.test(t), t);
  r = await rings(page);
  cardBox = await card(page).boundingBox();
  const way1 = await tagBox(page, "way-1"), way2 = await tagBox(page, "way-2");
  await cover("ways");
  check("...both Cabezas ringed and pulsing, the row you'd win on lit", r.length === 2 && r.some((x) => x.id === "light-cabeza" && x.tone === "mine" && x.pulse) && r.some((x) => x.id === "dark-cabeza" && x.tone === "foe" && x.pulse) && (await band(page)) === 0, JSON.stringify({ r, band: await band(page) }));
  check("...each numbered, on the screen and clear of the card", !!way1 && /1 · Your Cabeza across/i.test(way1.text) && !!way2 && /2 · Crush opponent's Cabeza/i.test(way2.text) && [way1, way2].every((b) => inView(b, W, H) && !overlap(b, cardBox)) && !overlap(way1, way2), JSON.stringify({ way1, way2, cardBox }));
  // (The arrow to the row is the next card's alone, user: "That should
  // only be on the following slide, 3 of 8. 2 of 8 is not necessary.")
  check("...and no arrow to the row yet", (await arrowD(page, "arrow-path")) === null);

  // The first: your Cabeza, the row lit green, an arrow there. Shown big
  // first, then brought down into its place (user: "start it with an
  // enlarged image of it and then have it zoom down back into where it
  // belongs on the board to kind of really emphasize to them what it is
  // that they're looking at").
  await page.locator('[data-testid="tour-next"]').click();
  const realShown = () => page.evaluate(() => window.__EC_TEST_THREE__().pieceGroup.children.filter((c) => c.userData.pieceId === "light-cabeza").every((c) => c.visible));
  let held = null;
  for (let i = 0; i < 40 && !held; i++) { const c = (await tourOf(page)).cabIntro; if (c && c.phase === "hold") held = c; else await page.waitForTimeout(50); }
  cardBox = await card(page).boundingBox();
  const bigTag = await tagBox(page, "cabeza");
  check(`Next: your Cabeza shown big first (${held && Math.round(held.px)} px across, ${held && Math.round(held.realPx)} on the board), under the card, the real one hidden`, !!held && held.px > 3.5 * held.realPx && held.y > cardBox.y + cardBox.height && !(await realShown()), JSON.stringify({ held, cardBox }));
  check("...labelled YOUR CABEZA under it, and no arrow yet", !!bigTag && /your cabeza/i.test(bigTag.text) && !!held && bigTag.y > held.y && (await arrowD(page, "arrow-path")) === null, JSON.stringify({ bigTag, held }));
  let last = held, smaller = false;
  for (let i = 0; i < 120; i++) {
    const c = (await tourOf(page)).cabIntro;
    if (!c) break;
    if (c.phase === "down" && c.px < held.px * 0.8) smaller = true;
    last = c;
    await page.waitForTimeout(50);
  }
  // (The arrow's head, from when it's drawn: read below.)
  await sweepLog(page);
  check(`...then down it comes, shrinking, onto its own square (${last && Math.round(last.x)},${last && Math.round(last.y)} vs ${last && Math.round(last.realX)},${last && Math.round(last.realY)})`, smaller && !!last && Math.hypot(last.x - last.realX, last.y - last.realY) < 3 && Math.abs(last.px - last.realPx) < 2 && !(await tourOf(page)).cabIntro, JSON.stringify(last));
  check("...the real one back on the board, and only one Cabeza drawn", (await realShown()) && (await page.evaluate(() => window.__EC_TEST_THREE__().boardGroup.children.filter((c) => c.userData.kind === "tour-cab").length)) === 0);
  await page.waitForTimeout(300);
  t = await cardText(page);
  // (After the welcome names Walnut, it's "your opponent", user: "This
  // should say your opponent ... not walnut".)
  check("Next: the first way, your Cabeza to your opponent's back row, lit green", /1\. Get your Cabeza across\./.test(t) && /your opponent's back row, the far edge lit green/.test(t) && !/Walnut/.test(t), t);
  // (Not "one square at a time": user, "a novice ... assume it only moves
  // one space per turn, when in fact it can move two".)
  check("...how far a turn takes it: up to two squares, any direction, diagonals too", /It can step up to two squares a turn, in any direction, even diagonally\./.test(t) && !/one square at a time/.test(t), t);
  r = await rings(page);
  check("...your Cabeza ringed, Walnut's back row lit on the board", r.length === 1 && r[0].id === "light-cabeza" && r[0].pulse && (await band(page)) === 0, JSON.stringify({ r, band: await band(page) }));
  const path = await arrowD(page, "arrow-path");
  const goalTag = await tagBox(page, "goal");
  await cover("goal");
  check("...an arrow from it to the row, and the row labelled your goal", !!path && path.length > 10 && !!goalTag && /back row · your goal/i.test(goalTag.text) && inView(goalTag, W, H), JSON.stringify({ path, goalTag }));
  // Its head where your Cabeza would come in, then along the row to both
  // ends and back: anywhere on it wins.
  const sw = await sweepFor(page, 7200);
  const early = sw.filter((s) => s.t < 400);
  check(`...its head first straight up from your Cabeza, held a moment (${early.length ? Math.max(...early.map((s) => s.fromCab)) : "-"} of a square off)`, early.length >= 2 && early.every((s) => s.fromCab < 0.3) && spread(early) < 0.01, JSON.stringify(early));
  check(`...then sliding along the row, to its first square and its last and back (${Math.min(...sw.map((s) => s.u))} to ${Math.max(...sw.map((s) => s.u))}, ${turnsOf(sw)} turns, ${Math.max(...sw.map((s) => s.off))} of a square off its line at most)`, sw.length >= 20 && sw.every((s) => s.off < 0.35) && Math.min(...sw.map((s) => s.u)) < 0.03 && Math.max(...sw.map((s) => s.u)) > 0.97 && turnsOf(sw) >= 2, JSON.stringify(sw.filter((_, i) => i % 6 === 0)));

  // The second: a cut to a close-up of a crush, played over and over.
  const boardCam = await camOf(page);
  const realBefore = await page.evaluate(() => window.__EC_TEST_PIECES__.map((p) => `${p.id}@${p.row},${p.col}`).join(" "));
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(250);
  t = await cardText(page);
  check("Next: the second way, crush your opponent's Cabeza: roll a block onto it", /2\. Crush opponent's Cabeza\./.test(t) && /Roll one of your blocks onto your opponent's Cabeza and it's crushed: you win\./.test(t) && !/up close/i.test(t) &&/Your opponent wins the same two ways, so keep your own Cabeza out from under their blocks\./.test(t) && !/Walnut/.test(t), t);
  let cut = await page.evaluate(() => window.__EC_TEST_CAM__());
  check("...a cut, not a glide: the view there at once, in close and lower", Math.abs(cut.view.radius - cut.radius) < 0.01 && Math.abs(cut.view.phi - cut.phi) < 0.01 && Math.abs(cut.phi - 0.85) < 0.02 && cut.radius < 0.6 * boardCam.radius, JSON.stringify({ boardCam, goal: { phi: cut.phi, radius: cut.radius }, view: cut.view }));
  tour = await tourOf(page);
  const demo = tour.crush;
  check("...copies of the Turrito and Walnut's Cabeza on an empty square near the middle", !!demo && demo.block === "light-turrito" && !!demo.cab && demo.cab.row >= 3 && demo.cab.row <= 6 && demo.cab.col >= 3 && demo.cab.col <= 6 && (await page.evaluate(() => window.__EC_TEST_THREE__().boardGroup.children.filter((c) => c.userData.kind === "tour-crush").length)) === 1, JSON.stringify(demo));
  r = await rings(page);
  cardBox = await card(page).boundingBox();
  const crushCab = await tagBox(page, "crush-cabeza"), crushBlock = await tagBox(page, "crush-block");
  check("...the copied Cabeza ringed red, both named on the screen below the card", r.some((x) => x.id === "tour-crush-cabeza" && x.tone === "foe" && x.pulse) && !!crushCab && /Opponent's Cabeza/i.test(crushCab.text) && !!crushBlock && /Your Turrito/i.test(crushBlock.text) && [crushCab, crushBlock].every((b) => inView(b, W, H) && !overlap(b, cardBox)), JSON.stringify({ r, crushCab, crushBlock, cardBox }));
  const cabAt = await anchorOf(page, "crush-cabeza"), over = await overOwn(page);
  await cover("crush");
  check("...neither label over what it names: OPPONENT'S CABEZA off the piece, to its right (user: \"moved down off it to the right a little bit\")", over.length === 0 && !!cabAt && !overlap(crushCab, cabAt) && crushCab.x + crushCab.w / 2 > cabAt.x + cabAt.w / 2, JSON.stringify({ over, crushCab, cabAt }));
  const seen = new Set();
  let pressed = 0, loops = 0, blockAt0 = null, blockAt1 = null;
  for (let i = 0; i < 90 && !(seen.has("crushed") && loops >= 1 && seen.has("in")); i++) {
    const c = (await tourOf(page)).crush;
    if (c) { seen.add(c.phase); if (c.phase === "crushed") pressed = Math.max(pressed, c.press); loops = c.loops; }
    const b = await tagBox(page, "crush-block");
    if (b && c && c.phase === "in" && !blockAt0) blockAt0 = b;
    if (b && c && c.phase === "crushed" && !blockAt1) blockAt1 = b;
    await page.waitForTimeout(80);
  }
  check("...the block rolls on and the Cabeza's pressed flat, then again", seen.has("crushed") && pressed > 0.99 && loops >= 1, JSON.stringify({ seen: [...seen], pressed, loops }));
  check("...the block's label goes with it as it rolls", !!blockAt0 && !!blockAt1 && blockAt1.x > blockAt0.x + 4, JSON.stringify({ blockAt0, blockAt1 }));
  check("...the real pieces untouched, and nothing played", (await page.evaluate(() => window.__EC_TEST_PIECES__.map((p) => `${p.id}@${p.row},${p.col}`).join(" "))) === realBefore && (await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 0);
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(250);
  const out = await page.evaluate(() => window.__EC_TEST_CAM__());
  check("Next: the close-up gone, the camera gliding back out", (await tourOf(page)).crush === null && (await page.evaluate(() => window.__EC_TEST_THREE__().boardGroup.children.filter((c) => c.userData.kind === "tour-crush").length)) === 0 && out.view.radius < out.radius - 0.5 && Math.abs(out.phi - 0.45) < 0.02, JSON.stringify({ goal: { phi: out.phi, radius: out.radius }, view: out.view }));
  await page.waitForTimeout(2400);

  // Your blocks, each named on the board.
  t = await cardText(page);
  check("Next: your four blocks, named on the board; they roll, never corner to corner", /Your four blocks\./.test(t) && /The Turrito, the Flaco, the Chato, and the Opa, named on the board\./.test(t) && /never corner to corner/.test(t), t);
  r = await rings(page);
  cardBox = await card(page).boundingBox();
  const names = await Promise.all(["light-turrito", "light-flaco", "light-chato", "light-opa"].map((id) => tagBox(page, id)));
  await cover("blocks");
  check("...each ringed and its name beside it", r.length === 4 && !r.some((x) => x.id === "light-cabeza") && names.every((b, i) => b && b.text.toLowerCase() === ["turrito", "flaco", "chato", "opa"][i]), JSON.stringify(names));
  check("...the names on the screen, none over another or the card", names.every((b) => inView(b, W, H) && !overlap(b, cardBox)) && names.every((a, i) => names.every((b, j) => i === j || !overlap(a, b))), JSON.stringify(names));

  // Your turn: two actions, the lights that count them ringed.
  await next(page);
  t = await cardText(page);
  check("Next: you move first, a piece rolled once or twice a turn, the Opa once (the user's words)", /You move first\./.test(t) && /Each turn, select a piece to roll on its edge either once or twice\./.test(t) && /Note: the Opa \(large cube\) only rolls on its edge once due to its large size\./.test(t) && /The lights at the foot of the screen count how many are left\./.test(t) && !/actions, all for one piece/.test(t), t);
  // (Hold to end, always on: said here, user: "As long as it is clearly
  // explained somewhere".)
  check("...and how to end a turn sooner: hold the piece you moved, or End turn", /To end it sooner, hold the piece you moved until its ring closes, or press End turn\./.test(t), t);
  check("...the Note in italics", await page.evaluate(() => { const i = document.querySelector('[data-testid="tour-note-line"] i'); return !!i && i.textContent === "Note" && getComputedStyle(i).fontStyle === "italic"; }));
  const counter = await boxOf(page, '[data-testid="points-counter"]');
  const ring = await ringRect(page, "actions");
  const actionsTag = await tagBox(page, "actions");
  await cover("actions");
  check("...the lights ringed, and labelled 2 actions a turn above them", !!counter && !!ring && ring.w > counter.w && ring.x < counter.x && !!actionsTag && /2 actions a turn/i.test(actionsTag.text) && actionsTag.y + actionsTag.h <= counter.y, JSON.stringify({ counter, ring, actionsTag }));

  // The board turns: arrows round it, a fingertip along them.
  await next(page);
  t = await cardText(page);
  check("Next: the board turns any way (a finger's words: drag, pinch)", /Turn the board any way you like\./.test(t) && /Pinch to zoom/.test(t), t);
  check("...and two fingers move it (user: \"mention the two-finger panning, up, down, left, right\")", /Drag one finger to turn it all the way around, two to move it up, down, or sideways\./.test(t), t);
  tour = await tourOf(page);
  const near = await page.evaluate(() => { const e = document.querySelector('[data-orbit="near"] path.ec-tour-march'); return e ? e.getAttribute("d") || "" : ""; });
  const f0 = await page.evaluate(() => +document.querySelector('[data-orbit="finger"]').getAttribute("cx"));
  await page.waitForTimeout(350);
  const f1 = await page.evaluate(() => +document.querySelector('[data-orbit="finger"]').getAttribute("cx"));
  check("...arrows round the board, a finger's way, and a fingertip moving along them", near.length > 10 && !!tour.marks.orbit && tour.marks.orbit.mouse === false && f0 !== f1, JSON.stringify({ near: near.slice(0, 40), f0, f1 }));
  check("...and the computer hasn't moved while the cards were up", (await page.evaluate(() => window.__EC_TEST_PIECES__.filter((q) => q.owner === "dark" && q.row <= 2).length)) === 5 && (await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 0);
  let at = await posOf("light-opa");
  await tap(at.x, at.y);
  await page.waitForTimeout(800);
  tour = await tourOf(page);
  check("...and a tap on a piece while a card's up picks nothing", tour.step === "board" && tour.marks.arrows.length === 0 && /Turn the board any way you like\./.test(await cardText(page)) && (await page.locator('[data-testid="piece-card"]').count()) === 0, JSON.stringify(tour.marks));

  // Your move: the pieces that can move glow, named.
  await next(page);
  t = await cardText(page);
  check("Let's play: your move, tap a glowing piece; the boxed-in ones said", (await tourOf(page)).step === "pieces" && /Your move: tap a glowing piece\./.test(t) && /Your Cabeza and the Turrito are boxed in for now/.test(t), t);
  r = await rings(page);
  check("...the Chato, the Opa and the Flaco glow; the Cabeza and the Turrito dim", ["light-chato", "light-opa", "light-flaco"].every((id) => r.some((x) => x.id === id && x.tone === "mine" && x.pulse)) && ["light-cabeza", "light-turrito"].every((id) => r.some((x) => x.id === id && x.tone === "dim" && !x.pulse)), JSON.stringify(r));
  check("...and labelled, the dim ones boxed in", /turrito · boxed in/i.test(((await tagBox(page, "light-turrito")) || {}).text || "") && /^opa$/i.test(((await tagBox(page, "light-opa")) || {}).text || ""));
  await cover("pieces");
  check("...and on no card so far is a label over what it names", covered.length === 0, covered.join(" | "));
  const before = await camOf(page);

  // The Opa: its lesson, the camera in on it, an arrow to its square.
  at = await posOf("light-opa");
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("the Opa tapped: its name, two squares a roll, once a turn", /The Opa/.test(t) && /rolls two squares at once/.test(t) && /moves once a turn/.test(t), t);
  check("...and the arrows to where it can go: tap one", /The arrows show every square it can reach: tap one/.test(t), t);
  tour = await tourOf(page);
  const opaArrow = await arrowD(page, "arrow-move-N");
  check("...an arrow from it to the square two ahead", tour.marks.arrows.length === 1 && tour.marks.arrows[0].key === "move-N" && !!opaArrow && opaArrow.length > 10, JSON.stringify({ arrows: tour.marks.arrows, opaArrow }));
  cam = await camOf(page);
  check("...the camera in a little on it, from a little lower than straight down", tour.framed && Math.abs(cam.phi - 0.6) < 0.02 && cam.radius < before.radius, `${JSON.stringify(before)} -> ${JSON.stringify(cam)}`);
  at = await posOf("light-opa");
  const box2 = await card(page).boundingBox();
  check("...the piece in sight, below the card", at.y > box2.y + box2.height && at.y < H - 60 && at.x > 0 && at.x < W, JSON.stringify({ at, card: box2 }));
  check("...the piece card stands aside for the tour's", (await page.locator('[data-testid="piece-card"]').count()) === 0);

  // The Turrito: hemmed in, twice a turn.
  at = await posOf("light-turrito");
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("the Turrito tapped: its name, twice a turn, and it can't move just now", /The Turrito/.test(t) && /roll twice a turn/.test(t) && /can't move from where it is just now/.test(t) && (await tourOf(page)).marks.arrows.length === 0, t);
  // Your Cabeza: the piece you win with.
  at = await posOf("light-cabeza");
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("your Cabeza tapped: one square any way, step twice a turn, your opponent's back row", /Your Cabeza/.test(t) && /One square any way, corners too/.test(t) && /step twice a turn/.test(t) && /your opponent's back row/.test(t), t);

  // The Flaco: a roll by tapping its square, then End turn pointed out.
  at = await posOf("light-flaco");
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  tour = await tourOf(page);
  check("the Flaco tapped: an arrow to each square it can reach", /The Flaco/.test(await cardText(page)) && tour.marks.arrows.some((a) => a.key === "move-E"), JSON.stringify(tour.marks.arrows));
  const flaco = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-flaco");
  const sq = await page.evaluate(([rr, cc]) => window.__EC_TEST_SQUARE_POS__(rr, cc), [flaco.row, flaco.col + 1]);
  await tap(sq.x, sq.y);
  for (let i = 0; i < 20; i++) { const q = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-flaco"); if (q.col === flaco.col + 1) break; await page.waitForTimeout(250); }
  await page.waitForTimeout(2600);
  const rolled = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-flaco");
  check("a tap on its marked square rolls it there", rolled.col === flaco.col + 1 && rolled.row === flaco.row, JSON.stringify(rolled));
  t = await cardText(page);
  const endBtn = await boxOf(page, '[data-testid="stop-here-float"]');
  const endRing = await ringRect(page, "end");
  const endTag = await tagBox(page, "end");
  check("...one action left: the card says move it again, press End turn, or hold the piece", /One action left: move it again, or press End turn, or hold the piece until its ring closes\./.test(t), t);
  check("...End turn ringed and labelled", !!endBtn && !!endRing && endRing.w > endBtn.w && !!endTag && /or end your turn here/i.test(endTag.text) && endTag.y + endTag.h <= endBtn.y, JSON.stringify({ endBtn, endRing, endTag }));
  check("...and arrows for its next roll", (await tourOf(page)).marks.arrows.length >= 1);
  await page.locator('[data-testid="stop-here-float"]').click();
  await page.waitForTimeout(600);
  if (await page.locator('[data-testid="end-turn-ask-end"]').count()) await page.locator('[data-testid="end-turn-ask-end"]').click();
  for (let i = 0; i < 30 && (await tourOf(page)).step === "pieces"; i++) await page.waitForTimeout(250);
  t = await cardText(page);
  check("End turn: Walnut's turn, its own card", (await tourOf(page)).step === "foe" && /(Your opponent's turn\.|Your opponent moved its|Your turn again\.)/.test(t), t);

  // The computer's move watched (user: "it happens too abruptly. The camera
  // should slowly pan in to watch the opponent's piece move so the user can
  // see it happening"): the camera glides in, lower, on the piece it moves,
  // and the piece goes only once it's there.
  const foeAt = () => page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.filter((p) => p.owner === "dark").map((p) => [p.id, p.row, p.col, p.w, p.h, p.z])));
  const foe0 = await foeAt();
  const watch = [];
  for (let i = 0; i < 150; i++) {
    const v = (await page.evaluate(() => window.__EC_TEST_CAM__().view));
    const moved = (await foeAt()) !== foe0;
    watch.push({ phi: +v.phi.toFixed(3), radius: +v.radius.toFixed(2), moved });
    if (moved) break;
    await page.waitForTimeout(100);
  }
  const movedAt = watch.findIndex((w) => w.moved);
  const inFirst = watch.slice(0, Math.max(0, movedAt)).findIndex((w) => Math.abs(w.phi - 0.72) < 0.03);
  check("the computer's turn: the camera glides in on its piece, and it moves only once the camera's there", movedAt > 0 && inFirst >= 0 && inFirst < movedAt && watch[0].phi < 0.69, JSON.stringify({ movedAt, inFirst, watch: watch.filter((w, i) => i % 3 === 0 || w.moved) }));
  // The computer moves: what it moved, an arrow from where it stood.
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__EC_TEST_TO_MOVE__() === "light")); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2600);
  t = await cardText(page);
  tour = await tourOf(page);
  const moved = tour.marks.arrows.find((a) => a.key.startsWith("moved-"));
  const movedId = moved ? moved.key.slice("moved-".length) : null;
  check("the computer's moved: the card names what it moved", /Your opponent moved its (Turrito|Flaco|Chato|Opa|Cabeza)/.test(t), t);
  r = await rings(page);
  check("...an arrow from where it stood, the piece ringed red there and where it was", !!movedId && ((await arrowD(page, `arrow-${moved.key}`)) || "").length > 10 && r.filter((x) => x.id === movedId && x.tone === "foe").length === 2 && r.some((x) => x.id === movedId && x.faint), JSON.stringify({ moved, r }));
  check("...and labelled", /Opponent's/i.test(((movedId && (await tagBox(page, movedId))) || {}).text || ""));

  /* Then the menu (user: "An addendum to the tutorial should be about the
     UI or user interface. For example, the lower right hand corner has
     the 3D spinning piece. Maybe there should be a page or two in the
     tutorial explaining like what that's for, when it opens up, what the
     buttons inside of it do, that sort of thing"): Next, not Got it, here;
     then the piece in the corner, what's inside the menu, the buttons
     along its foot. */
  check("...and Next: a look at the menu before your move", /Before your next move, a quick look at your menu\./.test(t) && (await page.locator('[data-testid="tour-next"]').count()) === 1 && (await page.locator('[data-testid="tour-done"]').count()) === 0, t);
  const saved = tour.saved;
  const dockOpen = () => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
  const around = (o, b) => !!o && !!b && o.x <= b.x && o.y <= b.y && o.x + o.w >= b.x + b.w && o.y + o.h >= b.y + b.h;
  /* Lit one at a time, round and round (the menu's controls sit too close
     for a ring round each at once): the ring on the menu with its line on
     the card. Over `secs`: how many rings were seen lit, the times two
     were at once, and the times the ring and the line lit weren't the
     same one. */
  const litRound = async (secs) => {
    const seen = new Set();
    let both = 0, apart = 0;
    for (const end = Date.now() + secs * 1000; Date.now() < end;) {
      const q = await page.evaluate(() => ({
        rings: [...document.querySelectorAll('[data-testid="tour-marks"] g[data-turn]')].map((g) => +getComputedStyle(g).opacity),
        lines: [...document.querySelectorAll('[data-testid="tour-card"] [data-lit]')].map((e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); return m && m.length === 4 ? +m[3] : 0; }),
      }));
      const r = q.rings.map((o, j) => (o > 0.9 ? j : -1)).filter((j) => j >= 0);
      const l = q.lines.map((a, j) => (a > 0.55 ? j : -1)).filter((j) => j >= 0);
      if (r.length > 1) both++;
      r.forEach((j) => seen.add(j));
      if (r.length === 1 && l.length === 1 && r[0] !== l[0]) apart++;
      await page.waitForTimeout(200);
    }
    return { seen: seen.size, both, apart };
  };
  const camFoe = await camOf(page);
  await next(page);
  t = await cardText(page);
  check("Next: the menu, 1 of 3: the piece in the corner opens it with a tap, a tap outside puts it away, it glows after a game", (await tourOf(page)).step === "menu" && /Your menu · 1 of 3/i.test(await page.locator('[data-testid="tour-band"]').innerText()) && /Your menu is in the corner\./.test(t) && /The spinning piece at the lower right opens it: the menu you started this game from\. Tap it now\./.test(t) && /Tap anywhere outside the menu to put it away again\./.test(t) && /When a game ends, the piece glows like this until you open it: your next game starts from there\./.test(t), t);
  const piece = await boxOf(page, "[data-dock-piece]");
  const dockRing = await ringRect(page, "dock");
  const dockTag = await tagBox(page, "dock");
  check("...the piece ringed in its corner, labelled TAP TO OPEN YOUR MENU, on the screen and off the piece", !!piece && !!dockRing && Math.abs(dockRing.x + dockRing.w / 2 - (piece.x + piece.w / 2)) < 2 && Math.abs(dockRing.y + dockRing.h / 2 - (piece.y + piece.h / 2)) < 2 && inView(dockRing, W, H) && !!dockTag && /tap to open your menu/i.test(dockTag.text) && inView(dockTag, W, H) && (await overOwn(page)).length === 0, JSON.stringify({ piece, dockRing, dockTag }));
  check("...the piece calling as it does after a game: lit, its light round it", await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall === "true" && !!document.querySelector('[data-testid="dock-call-aura"]')));
  const camMenu = await camOf(page);
  check("...the board left as the other side's move framed it", Math.abs(camMenu.radius - camFoe.radius) < 0.05 && Math.abs(camMenu.phi - camFoe.phi) < 0.01, JSON.stringify({ camFoe, camMenu }));
  /* A tap on the piece: Rings, the dock's menu (user, of the menu lab's
     fans: "I like rings", then "Replace the dock everywhere"), out round
     it, and the card for how it turns; then its four kinds. */
  const ringsOut = () => page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"] [data-testid="menu-fan"]'));
  const ringsStill = async () => { for (let i = 0; i < 40; i++) { if (await page.evaluate(() => { const s = document.querySelector('[data-testid="dock-menu"][data-open="true"] [data-testid="menu-fan"]'); return !!s && s.getAttribute("data-turning") === "false"; })) return true; await page.waitForTimeout(150); } return false; };
  const focusOf = () => page.evaluate(() => { const f = document.querySelector('[data-testid="dock-menu"] [data-ml-item].mf-focus'); return f ? f.getAttribute("data-ml-item") : null; });
  await tap(piece.x + piece.w / 2, piece.y + piece.h / 2);
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "panel"; i++) await page.waitForTimeout(150);
  await ringsStill();
  t = await cardText(page);
  const rowText = (k) => page.evaluate((key) => { const e = document.querySelector(`[data-testid="tour-row-${key}"]`); return e ? e.textContent : ""; }, k);
  check("a tap on it: Rings out round the piece (not the panel), its card 2 of 3 with it, the piece's light out", (await ringsOut()) && !(await dockOpen()) && (await tourOf(page)).step === "panel" && /Your menu turns\./.test(t) && /Your menu · 2 of 3/i.test(await page.locator('[data-testid="tour-band"]').innerText()) && (await page.locator('[data-testid="dock-call-aura"]').count()) === 0, t);
  check("...turning it, reading it, changing it, each said", /Drag the ring round the piece, or tap ‹ ›\./.test(await rowText("turn-it")) && /The setting at the top is named above, with what it's set to and what it does\./.test(await rowText("read-it")) && /Tap a setting: a switch flips, a choice shows its options\./.test(await rowText("change-it")), t);
  const how = await Promise.all([["turn", '[data-testid="dock-menu"] [data-mf-grip]'], ["read", '[data-testid="dock-menu"] [data-testid="menu-fan-read"]'], ["tap", '[data-testid="dock-menu"] .mf-w.mf-focus']].map(async ([k, sel]) => ({ k, ring: await ringRect(page, k), el: await boxOf(page, sel) })));
  check("...each ringed on it", how.every((x) => around(x.ring, x.el)), JSON.stringify(how));
  const lines = await page.locator('[data-testid="tour-card"] [data-lit]').count();
  const round = await litRound(lines * 2.6 + 0.8);
  check(`...lit one at a time, round all ${lines}: the ring on the menu and its line on the card together`, lines === 3 && round.seen === lines && round.both === 0 && round.apart === 0, JSON.stringify({ lines, round }));
  const stackBox = await boxOf(page, '[data-testid="dock-menu"] [data-testid="menu-fan-stack"]');
  cardBox = await card(page).boundingBox();
  check("...the card above the menu, clear of it", !!stackBox && !!cardBox && cardBox.y + cardBox.height <= stackBox.y, JSON.stringify({ cardBox, stackBox }));
  // Its four kinds.
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(700);
  t = await cardText(page);
  check("Next: its four kinds, 3 of 3, each said", (await tourOf(page)).step === "foot" && (await ringsOut()) && /Four kinds of setting\./.test(t) && /On the inner ring: tap one to turn straight to it\./.test(t) && /Your turn and the game: end your turn, undo, end the game\./.test(await rowText("game")) && /ready-made views of the board\./.test(await rowText("board")) && /Check alert, Piece guide, Move costs, and Actions left: what the board shows to help you\./.test(await rowText("hints")) && /Sound, Language, and Control bar\./.test(await rowText("settings")), t);
  check("...and the tour's end said: your move", /That's the tour\. Your move: tap any of your pieces to see what it does\. Good luck!/.test(t) && (await page.locator('[data-testid="tour-done"]').count()) === 1, t);
  const kinds = await Promise.all(["game", "board", "hints", "settings"].map(async (k) => ({ k, ring: await ringRect(page, `kind-${k}`), el: await boxOf(page, `[data-testid="dock-menu"] [data-mf-kind="${k}"]`) })));
  check("...each kind ringed on the inner ring", kinds.every((x) => around(x.ring, x.el)), JSON.stringify(kinds));
  const kindRound = await litRound(3.2);
  check("...lit one at a time with its line on the card", kindRound.seen >= 1 && kindRound.both === 0 && kindRound.apart === 0, JSON.stringify(kindRound));
  await page.locator('[data-testid="tour-back"]').click();
  await page.waitForTimeout(500);
  check("‹ Back: how it turns again, still out", (await tourOf(page)).step === "panel" && (await ringsOut()));
  // A tap outside it: put away, and the piece's card again; the board
  // still picks nothing.
  cardBox = await card(page).boundingBox();
  await tap(W / 2, cardBox.y + cardBox.height + 30);
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "menu"; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(500);
  check("a tap outside the menu: put away, the piece's card again, nothing picked", !(await ringsOut()) && (await tourOf(page)).step === "menu" && (await page.locator('[data-testid="piece-card"]').count()) === 0 && (await tourOf(page)).marks.arrows.length === 0);
  await page.locator('[data-testid="tour-next"]').click();
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "panel"; i++) await page.waitForTimeout(150);
  check("...Open it: Rings out, its card with it", (await ringsOut()) && (await tourOf(page)).step === "panel");
  await ringsStill();
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(500);
  /* The control bar pressed on the way (user: "Selecting the non-classic
     doc when in the new menu tutorial, it got rid of the tutorial ... there
     should be a way back, or just to have it show it temporarily while
     you're doing the tutorial"): shown for now, not kept, its own card;
     Back to the tour, or the bar's own Use the classic dock, and the menu's
     card again, the menu out. Pressed from Rings: Settings on the inner
     ring, on to Control bar, a tap. */
  const layoutKept = () => page.evaluate(() => localStorage.getItem("el-cabeza:nova-layout"));
  const keptBefore = await layoutKept();
  const barShown = () => page.evaluate(() => { const b = document.querySelector('[data-testid="shell-bar"]'); return !!b && b.getBoundingClientRect().height > 0; });
  const ringsBar = async () => {
    const k = await boxOf(page, '[data-testid="dock-menu"] [data-mf-kind="settings"] path');
    await tap(k.x + k.w / 2, k.y + k.h / 2);
    await ringsStill();
    for (let i = 0; i < 6 && (await focusOf()) !== "bar"; i++) { await page.locator('[data-testid="menu-fan-next"]').click(); await ringsStill(); }
    const b = await boxOf(page, '[data-testid="dock-menu"] [data-ml-label="bar"]');
    await tap(b.x + b.w / 2, b.y + b.h / 2);
  };
  await ringsBar();
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "bar"; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(700);
  t = await cardText(page);
  check("the control bar pressed in the tour (from Rings): the bar shown, the tour going on with a card of its own", (await tourOf(page)).step === "bar" && (await barShown()) && /The control bar\./.test(t) && /everything else behind ☰ at the top right\./.test(t) && /To have the spinning piece back any time: ☰, then Use the classic dock\./.test(t) && (await page.locator('[data-testid="tour-bar-back"]').count()) === 1, t);
  check("...shown for now, not kept as the layout", (await layoutKept()) === keptBefore, String(await layoutKept()));
  const barRing = await ringRect(page, "shell-bar"), menuRing = await ringRect(page, "shell-menu");
  const barBox = await boxOf(page, '[data-testid="shell-bar"]'), menuBtn = await boxOf(page, '[data-testid="shell-menu-button"]');
  const menuTag = await tagBox(page, "shell-menu");
  cardBox = await card(page).boundingBox();
  check("...the bar and its ☰ ringed, THE REST OF THE MENU by ☰, the card clear of it", !!barRing && !!barBox && Math.abs(barRing.y - (barBox.y + 1)) < 2 && inView(barRing, W, H) && around(menuRing, menuBtn) && !!menuTag && /the rest of the menu/i.test(menuTag.text) && inView(menuTag, W, H) && !overlap(menuTag, menuBtn) && !!cardBox && cardBox.y >= menuBtn.y + menuBtn.h, JSON.stringify({ barRing, barBox, menuRing, menuBtn, menuTag, cardBox }));
  await page.locator('[data-testid="tour-bar-back"]').click();
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "foot"; i++) await page.waitForTimeout(150);
  for (let i = 0; i < 25 && !(await ringsOut()); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(600);
  check("...Back to the tour: the classic dock, Rings out again, its card where it was", (await tourOf(page)).step === "foot" && !(await barShown()) && (await ringsOut()) && /Four kinds of setting\./.test(await cardText(page)) && (await layoutKept()) === keptBefore);
  // The bar's own way back.
  await ringsStill();
  await ringsBar();
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "bar"; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(500);
  await page.locator('[data-testid="shell-menu-button"]').click();
  await page.waitForTimeout(700);
  await page.locator('[data-testid="shell-menu-layout"]').click();
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "foot"; i++) await page.waitForTimeout(150);
  for (let i = 0; i < 25 && !(await ringsOut()); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(600);
  check("...or ☰ then Use the classic dock: the same, the tour going on", (await tourOf(page)).step === "foot" && !(await barShown()) && (await ringsOut()));
  await page.locator('[data-testid="tour-done"]').click();
  await page.waitForTimeout(2600);
  cam = await camOf(page);
  for (let i = 0; i < 10 && (await ringsOut()); i++) await page.waitForTimeout(150);
  check("Got it: the tour's done, kept as done, the menu put away", (await card(page).count()) === 0 && (await tourOf(page)).step === null && (await page.locator('[data-testid="tour-marks"]').count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done" && !(await dockOpen()) && !(await ringsOut()) && (await page.locator('[data-testid="dock-call-aura"]').count()) === 0);
  check("...its marks off the board, and the camera back where it was", (await rings(page)).length === 0 && !!saved && Math.abs(cam.phi - saved.phi) < 0.02 && Math.abs(cam.radius - saved.radius) < 0.5, JSON.stringify({ saved, cam }));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));

  // Another game: no tour.
  await page.evaluate(() => window.__EC_TEST_NEW_GAME__ && window.__EC_TEST_NEW_GAME__());
  await page.waitForTimeout(2000);
  if (await page.evaluate(() => window.__EC_TEST_ARMED__ === true)) {
    check("(a new game set up)", false, "still armed");
  } else {
    await begin(page);
    check("a game after it: no tour", (await card(page).count()) === 0 && (await tourOf(page)).step === null);
  }
  await ctx.close();
}

/* -------------------------------------------------------------- desktop */
{
  console.log("\n[desktop: skipped]");
  const { ctx, page, errs } = await open(false);
  await begin(page);
  await page.waitForTimeout(1500);
  check("Try a Game: the welcome card", (await tourOf(page)).step === "welcome");
  const box = await card(page).boundingBox();
  check("...at the left, the board beside it", !!box && box.x < 40 && Math.abs(box.width - 360) < 2, JSON.stringify(box));
  for (let i = 0; i < 6; i++) { await page.locator('[data-testid="tour-next"]').click(); await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
  const t = await cardText(page);
  const tour = await tourOf(page);
  check("a mouse's words for the board: drag, right-drag, scroll", /Scroll to zoom/.test(t) && /right-drag to move it up, down, or sideways/.test(t) && !/pinch|finger/i.test(t), t);
  check("...and the arrows round it a mouse's way", !!tour.marks.orbit && tour.marks.orbit.mouse === true, JSON.stringify(tour.marks.orbit));
  await page.locator('[data-testid="tour-skip"]').click();
  await page.waitForTimeout(800);
  check("Skip the tour: gone, marks and all, and kept as done", (await card(page).count()) === 0 && (await page.locator('[data-testid="tour-marks"]').count()) === 0 && (await rings(page)).length === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
  // The game as ever: a piece clicked has its own small card.
  await page.waitForTimeout(2000);
  const at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-opa"));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(1500);
  check("...and the game goes on as ever (a piece clicked has its piece card)", (await page.locator('[data-testid="piece-card"]').count()) === 1);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
/* A step back (user: "small back button on the tutorial if somebody goes
   forward and then they want to revisit a step earlier. Wanted to be
   subtle though, but still within theme"): none on the first card; from
   the second, the card before; out of the crush card's close-up; and from
   your first turn to the last card, until a piece has moved. */
{
  console.log("\n[desktop: back a step]");
  const { ctx, page, errs } = await open(false);
  await begin(page);
  const backs = () => page.locator('[data-testid="tour-back"]').count();
  const go = async (id, ms = 450) => { await page.locator(`[data-testid="${id}"]`).click(); await page.waitForTimeout(ms); };
  check("the welcome card: no Back (nothing before it)", (await tourOf(page)).step === "welcome" && (await backs()) === 0);
  await go("tour-next");
  const backBox = await page.locator('[data-testid="tour-back"]').boundingBox();
  const nextBox = await page.locator('[data-testid="tour-next"]').boundingBox();
  check("the second card: a Back, just left of Next", (await tourOf(page)).step === "ways" && !!backBox && !!nextBox && backBox.x + backBox.width <= nextBox.x + 1 && Math.abs((backBox.y + backBox.height / 2) - (nextBox.y + nextBox.height / 2)) < 4, JSON.stringify({ backBox, nextBox }));
  check("...quiet: the button's lettering, no box of its own", await page.evaluate(() => { const b = getComputedStyle(document.querySelector('[data-testid="tour-back"]')); return b.backgroundColor === "rgba(0, 0, 0, 0)" && b.borderTopStyle === "none" && /Franklin/.test(b.fontFamily); }));
  await go("tour-back");
  check("...Back: the welcome card again", (await tourOf(page)).step === "welcome");
  for (let i = 0; i < 3; i++) await go("tour-next");
  await page.waitForTimeout(900);
  const c = await tourOf(page);
  check("on to the crush card, its close-up playing", c.step === "crush" && !!c.crush, JSON.stringify(c.crush));
  await go("tour-back", 900);
  const g = await tourOf(page);
  check("...Back: the goal card, the close-up put away", g.step === "goal" && !g.crush, JSON.stringify(g.crush));
  for (let i = 0; i < 5; i++) await go("tour-next");
  check("your first turn (8 of 8): a Back while nothing's moved", (await tourOf(page)).step === "pieces" && (await backs()) === 1);
  await go("tour-back");
  check("...Back: the board card again, 7 of 8", (await tourOf(page)).step === "board" && /7 of 8/i.test(await page.locator('[data-testid="tour-band"]').innerText()));
  await go("tour-next", 900);
  const f0 = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "light-flaco")));
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-flaco", "N"));
  for (let i = 0; i < 40 && (await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "light-flaco")))) === f0; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(500);
  check("...a piece moved: no Back (the turn's begun)", (await tourOf(page)).step === "pieces" && (await backs()) === 0);
  // The menu's cards on a desktop: a mouse's words, the card beside the menu.
  await page.locator('[data-testid="stop-here-float"]').click();
  await page.waitForTimeout(600);
  if (await page.locator('[data-testid="end-turn-ask-end"]').count()) await page.locator('[data-testid="end-turn-ask-end"]').click();
  for (let i = 0; i < 120 && !(await page.locator('[data-testid="tour-next"]').count()); i++) await page.waitForTimeout(250);
  await go("tour-next", 900);
  const mt = (await card(page).innerText()).replace(/\s+/g, " ");
  check("the menu's card on a desktop: a mouse's words", (await tourOf(page)).step === "menu" && /The spinning piece at the lower right opens it: the menu you started this game from\. Click it now\./.test(mt) && /Click anywhere outside the menu to put it away again\./.test(mt) && /click to open your menu/i.test(((await tagBox(page, "dock")) || {}).text || ""), mt);
  await go("tour-next", 2000);
  const pb = await boxOf(page, '[data-testid="dock-menu"] [data-testid="menu-fan-stack"]'), rb = await boxOf(page, '[data-testid="dock-menu"] [data-mf-grip]'), cb = await card(page).boundingBox();
  const cbox = cb && { x: cb.x, y: cb.y, w: cb.width, h: cb.height };
  check("...Open it: Rings out, the card beside it, not over it", (await tourOf(page)).step === "panel" && !!pb && !!rb && !!cb && !overlap(cbox, pb) && !overlap(cbox, rb), JSON.stringify({ pb, rb, cb }));
  // (its Control bar, from Rings: Settings on the inner ring, on to it, a click)
  const kb = await boxOf(page, '[data-testid="dock-menu"] [data-mf-kind="settings"] path');
  await page.mouse.click(kb.x + kb.w / 2, kb.y + kb.h / 2);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 6 && (await page.evaluate(() => { const f = document.querySelector('[data-testid="dock-menu"] [data-ml-item].mf-focus'); return f && f.getAttribute("data-ml-item"); })) !== "bar"; i++) { await page.locator('[data-testid="menu-fan-next"]').click(); await page.waitForTimeout(900); }
  const lb = await boxOf(page, '[data-testid="dock-menu"] [data-ml-label="bar"]');
  await page.mouse.click(lb.x + lb.w / 2, lb.y + lb.h / 2);
  for (let i = 0; i < 25 && (await tourOf(page)).step !== "bar"; i++) await page.waitForTimeout(150);
  check("...its Control bar: the bar's card", (await tourOf(page)).step === "bar" && (await page.locator('[data-testid="tour-bar-keep"]').count()) === 1);
  await go("tour-bar-keep", 900);
  check("...Keep it, end the tour: over, the bar kept as the layout", (await tourOf(page)).step === null && (await card(page).count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:nova-layout"))) === "bar" && (await page.locator('[data-testid="shell-bar"]').count()) === 1);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  console.log("\n[desktop: Escape]");
  const { ctx, page } = await open(false);
  await begin(page);
  check("Try a Game: the welcome card", (await tourOf(page)).step === "welcome");
  // With reduced motion, the arrow to the row held still: on the goal card,
  // 3 of 8, the one it's on (user: "That should only be on the following
  // slide, 3 of 8."), drawn at once, the Cabeza not shown big first.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(1000);
  await sweepLog(page);
  const calm = await sweepFor(page, 1500);
  check(`reduced motion: the arrow's head held still, straight up from your Cabeza (moved ${spread(calm).toFixed(3)} of the row)`, (await tourOf(page)).step === "goal" && calm.length >= 3 && calm.every((s) => s.fromCab < 0.3) && spread(calm) < 0.01, JSON.stringify(calm.slice(0, 3)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape skips it, kept as done", (await card(page).count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
  await ctx.close();
}

await browser.close();
console.log(`\nfirst-game tour: ${checks} checks, ${fails} failed`);
console.log(fails === 0 ? "FIRST GAME TOUR E2E PASSED" : `FIRST GAME TOUR E2E FAILED (${fails})`);
process.exit(fails === 0 ? 0 : 1);
