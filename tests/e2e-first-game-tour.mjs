/* A new player's first game in the store, walked through (user,
   2026-10-17: "On a brand new game, when you start a game, it should just
   automatically select. You get to be the ash pieces, and the computer
   will be the walnut pieces ... Automatically selects easy, and all they
   have to do is just begin a game. They click begin a game, and then a
   little pop-up will say, "Welcome to your first game of El Cabeza."
   Copyright 1975 ... We need to create a first-time player walkthrough
   tutorial"; then: "Highlight the pieces as they're explained. Arrows to
   indicate stuff will be helpful. Make it perfectly transparent how the
   game is played. Hand-holding is encouraged here"; chassis/
   FirstGameTour.jsx).

   On a phone, from a fresh story: the computer on Easy playing Walnut and
   you Ash, moving first, chosen already; Try a Game brings the cards at
   the top, the board framed under them and what each names lit up: both
   sides ringed and labelled; your Cabeza, the row you win on lit green
   and an arrow to it; Walnut's Cabeza; your four blocks, named; the
   actions' lights ringed; arrows round the board and a fingertip along
   them. The computer waits on the cards, and a tap on a piece picks
   nothing while one's up. Then your turn: the pieces that can move glow,
   named (the boxed-in ones said so); each piece tapped told (its name, how
   far, how many times a turn: the Opa once, the Turrito twice), the camera
   in on it, an arrow to each square it can reach; the Flaco moved by
   tapping its square, then End turn pointed out, and pressed; Walnut's
   turn, then what it moved shown with an arrow from where it stood; Got
   it, the camera back, kept as done: Try a Game again brings no tour. On a
   desktop: the card at the left, a mouse's words and a mouse's way round
   for the board; Skip the tour ends it, kept as done, and the game goes on
   as ever; Escape skips it too.

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
const boxOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (b, W, H) => !!b && b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
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
  check("...you're Ash, ringed in yellow; the computer Walnut, ringed in red", /You play Ash: the light pieces on your side, ringed in yellow\./.test(t) && /The computer plays Walnut: the dark pieces across the board, ringed in red\./.test(t), t);
  let cardBox = await card(page).boundingBox();
  check("...a card at the top, the board not dimmed (no screen over it)", cardBox && cardBox.y < 140 && (await page.locator('[data-testid="tour-scrim"]').count()) === 0, JSON.stringify(cardBox));
  let r = await rings(page);
  check("...every piece ringed on the board: yours yellow and pulsing, Walnut's red", r.length === 10 && r.filter((x) => x.id.startsWith("light-") && x.tone === "mine" && x.pulse).length === 5 && r.filter((x) => x.id.startsWith("dark-") && x.tone === "foe").length === 5, JSON.stringify(r));
  const mineTag = await tagBox(page, "mine"), foeTag = await tagBox(page, "foe");
  check("...labelled ASH · YOU and WALNUT · THE COMPUTER, on the screen, clear of the card", !!mineTag && /Ash · you/i.test(mineTag.text) && !!foeTag && /Walnut · the computer/i.test(foeTag.text) && inView(mineTag, W, H) && inView(foeTag, W, H) && !overlap(mineTag, cardBox) && !overlap(foeTag, cardBox), JSON.stringify({ mineTag, foeTag, cardBox }));
  let cam = await camOf(page);
  check("...the board turned to show it, from your side and a little lower than straight down", tour.framed && Math.abs(cam.phi - 0.45) < 0.02 && Math.abs(Math.atan2(Math.sin(cam.theta), Math.cos(cam.theta))) < 0.02, JSON.stringify(cam));
  const dc = await posOf("dark-cabeza");
  check("...Walnut's side seen below the card, not under it", !!dc && dc.y > cardBox.y + cardBox.height, JSON.stringify({ dc, cardBox }));

  // How you win: your Cabeza, the row lit green, an arrow there.
  await next(page);
  t = await cardText(page);
  check("Next: how you win, your Cabeza to Walnut's back row, lit green", /Get your Cabeza across to win\./.test(t) && /Walnut's back row, the far edge lit green/.test(t), t);
  r = await rings(page);
  check("...your Cabeza ringed, Walnut's back row lit on the board", r.length === 1 && r[0].id === "light-cabeza" && r[0].pulse && (await band(page)) === 0, JSON.stringify({ r, band: await band(page) }));
  const path = await arrowD(page, "arrow-path");
  const goalTag = await tagBox(page, "goal");
  check("...an arrow from it to the row, and the row labelled your goal", !!path && path.length > 10 && !!goalTag && /back row · your goal/i.test(goalTag.text) && inView(goalTag, W, H), JSON.stringify({ path, goalTag }));

  // Or crush theirs.
  await next(page);
  t = await cardText(page);
  r = await rings(page);
  check("Next: or crush Walnut's Cabeza, ringed red, yours ringed too", /Or crush Walnut's Cabeza\./.test(t) && /Roll one of your blocks onto its square/.test(t) && r.some((x) => x.id === "dark-cabeza" && x.tone === "foe" && x.pulse) && r.some((x) => x.id === "light-cabeza" && x.tone === "mine"), t + " " + JSON.stringify(r));
  check("...each labelled", /crush it/i.test(((await tagBox(page, "foe-cabeza")) || {}).text || "") && /keep it safe/i.test(((await tagBox(page, "cabeza")) || {}).text || ""));

  // Your blocks, each named on the board.
  await next(page);
  t = await cardText(page);
  check("Next: your four blocks, named on the board; they roll, never corner to corner", /Your four blocks\./.test(t) && /The Turrito, the Flaco, the Chato and the Opa, named on the board\./.test(t) && /never corner to corner/.test(t), t);
  r = await rings(page);
  cardBox = await card(page).boundingBox();
  const names = await Promise.all(["light-turrito", "light-flaco", "light-chato", "light-opa"].map((id) => tagBox(page, id)));
  check("...each ringed and its name beside it", r.length === 4 && !r.some((x) => x.id === "light-cabeza") && names.every((b, i) => b && b.text.toLowerCase() === ["turrito", "flaco", "chato", "opa"][i]), JSON.stringify(names));
  check("...the names on the screen, none over another or the card", names.every((b) => inView(b, W, H) && !overlap(b, cardBox)) && names.every((a, i) => names.every((b, j) => i === j || !overlap(a, b))), JSON.stringify(names));

  // Your turn: two actions, the lights that count them ringed.
  await next(page);
  t = await cardText(page);
  check("Next: you move first, two actions a turn for one piece, the Opa's roll two", /You move first\./.test(t) && /two actions, all for one piece/.test(t) && /the Opa's roll costs two/.test(t) && /The lights at the foot of the screen count how many are left\./.test(t), t);
  const counter = await boxOf(page, '[data-testid="points-counter"]');
  const ring = await ringRect(page, "actions");
  const actionsTag = await tagBox(page, "actions");
  check("...the lights ringed, and labelled 2 actions a turn above them", !!counter && !!ring && ring.w > counter.w && ring.x < counter.x && !!actionsTag && /2 actions a turn/i.test(actionsTag.text) && actionsTag.y + actionsTag.h <= counter.y, JSON.stringify({ counter, ring, actionsTag }));

  // The board turns: arrows round it, a fingertip along them.
  await next(page);
  t = await cardText(page);
  check("Next: the board turns any way (a finger's words: drag, pinch)", /Turn the board any way you like\./.test(t) && /Pinch to zoom/.test(t), t);
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
  check("your Cabeza tapped: one square any way, step twice a turn, Walnut's back row", /Your Cabeza/.test(t) && /One square any way, corners too/.test(t) && /step twice a turn/.test(t) && /Walnut's back row/.test(t), t);

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
  check("...one action left: the card says move it again or press End turn", /One action left: move it again, or press End turn\./.test(t), t);
  check("...End turn ringed and labelled", !!endBtn && !!endRing && endRing.w > endBtn.w && !!endTag && /or end your turn here/i.test(endTag.text) && endTag.y + endTag.h <= endBtn.y, JSON.stringify({ endBtn, endRing, endTag }));
  check("...and arrows for its next roll", (await tourOf(page)).marks.arrows.length >= 1);
  await page.locator('[data-testid="stop-here-float"]').click();
  await page.waitForTimeout(600);
  if (await page.locator('[data-testid="end-turn-ask-end"]').count()) await page.locator('[data-testid="end-turn-ask-end"]').click();
  for (let i = 0; i < 30 && (await tourOf(page)).step === "pieces"; i++) await page.waitForTimeout(250);
  t = await cardText(page);
  check("End turn: Walnut's turn, its own card", (await tourOf(page)).step === "foe" && /(Walnut's turn\.|Walnut moved its|Your turn again\.)/.test(t), t);

  // The computer moves: what it moved, an arrow from where it stood.
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__EC_TEST_TO_MOVE__() === "light")); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2600);
  t = await cardText(page);
  tour = await tourOf(page);
  const moved = tour.marks.arrows.find((a) => a.key.startsWith("moved-"));
  const movedId = moved ? moved.key.slice("moved-".length) : null;
  check("the computer's moved: the card names what, and it's your turn again", /Walnut moved its (Turrito|Flaco|Chato|Opa|Cabeza)/.test(t) && /Your turn again/.test(t), t);
  r = await rings(page);
  check("...an arrow from where it stood, the piece ringed red there and where it was", !!movedId && ((await arrowD(page, `arrow-${moved.key}`)) || "").length > 10 && r.filter((x) => x.id === movedId && x.tone === "foe").length === 2 && r.some((x) => x.id === movedId && x.faint), JSON.stringify({ moved, r }));
  check("...and labelled", /Walnut's/i.test(((movedId && (await tagBox(page, movedId))) || {}).text || ""));
  const saved = tour.saved;
  await page.locator('[data-testid="tour-done"]').click();
  await page.waitForTimeout(2600);
  cam = await camOf(page);
  check("Got it: the tour's done, and kept as done", (await card(page).count()) === 0 && (await tourOf(page)).step === null && (await page.locator('[data-testid="tour-marks"]').count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
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
  for (let i = 0; i < 5; i++) { await page.locator('[data-testid="tour-next"]').click(); await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
  const t = await cardText(page);
  const tour = await tourOf(page);
  check("a mouse's words for the board: drag, scroll", /Scroll to zoom/.test(t) && !/pinch/i.test(t), t);
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
{
  console.log("\n[desktop: Escape]");
  const { ctx, page } = await open(false);
  await begin(page);
  check("Try a Game: the welcome card", (await tourOf(page)).step === "welcome");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Escape skips it, kept as done", (await card(page).count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
  await ctx.close();
}

await browser.close();
console.log(`\nfirst-game tour: ${checks} checks, ${fails} failed`);
console.log(fails === 0 ? "FIRST GAME TOUR E2E PASSED" : `FIRST GAME TOUR E2E FAILED (${fails})`);
process.exit(fails === 0 ? 0 : 1);
