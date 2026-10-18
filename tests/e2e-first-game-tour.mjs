/* A new player's first game in the store, walked through (user,
   2026-10-17: "On a brand new game, when you start a game, it should just
   automatically select. You get to be the ash pieces, and the computer
   will be the walnut pieces ... Automatically selects easy, and all they
   have to do is just begin a game. They click begin a game, and then a
   little pop-up will say, "Welcome to your first game of El Cabeza."
   Copyright 1975 ... We need to create a first-time player walkthrough
   tutorial"; chassis/FirstGameTour.jsx).

   On a phone, from a fresh story: the computer on Easy playing Walnut and
   you Ash, moving first, chosen already; Try a Game brings the three
   cards (the welcome with its year, you move first with two actions, the
   board turns and zooms), the computer waiting on them; then the card at
   the top: each piece tapped told (its name, how far it moves, how many
   times a turn: the Opa once, the Turrito twice), the camera in on it
   and the piece where it can be seen, the piece card standing aside; a
   move made by tapping its square; the other side's card and the camera
   back; Got it, and it's kept as done: Try a Game again brings no tour.
   On a desktop: Skip the tour at the first card ends it, kept as done,
   and the game goes on as ever; Escape skips it too.

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
const camOf = (page) => page.evaluate(() => { const c = window.__EC_TEST_CAM__(); return { phi: c.phi, radius: c.radius }; });
async function begin(page) {
  await openDockPanel(page);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="tienda-try-game"]').click({ force: true });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
}

/* ---------------------------------------------------------------- phone */
{
  console.log("[phone: the whole first turn]");
  const { ctx, page, errs } = await open(true);
  const tap = (x, y) => page.touchscreen.tap(x, y);
  // The new player's sides, chosen already.
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:opponent") || "null"));
  check("a new player plays the computer on Easy: it's Walnut, you're Ash and move first", prefs && prefs.aiPlayer === "dark" && prefs.aiDifficulty === "easy" && prefs.humanStartSide === "light", JSON.stringify(prefs));
  await openDockPanel(page);
  await page.waitForTimeout(600);
  const panel = await page.locator('[data-testid="dock-panel"]').innerText();
  check("the store's menu opens on Easy picked, nothing to choose but Try a Game", /easy/i.test(panel) && (await page.locator('[data-ec-diff-back]').count()) === 1 && /ash to move/i.test(panel), panel.replace(/\s+/g, " ").slice(0, 160));
  await page.locator('[data-testid="tienda-try-game"]').click({ force: true });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__EC_TEST_ARMED__ === true)); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);

  // The three cards.
  let t = await cardText(page);
  check("Try a Game: the welcome card", (await tourOf(page)).step === "welcome" && /Welcome to your first game of El Cabeza\./.test(t), t);
  check("...the year under it, as on the box", (await page.locator('[data-testid="tour-sub"]').innerText()).includes("© 1975"));
  check("...you're Ash, the light pieces; the computer Walnut", /You're Ash, the light pieces\. The computer plays Walnut, the dark\./.test(t), t);
  check("...the goal: the Cabeza to Walnut's back row, or crush theirs with a block", /Cabeza, onto Walnut's back row, or crush Walnut's Cabeza with one of your blocks/.test(t), t);
  check("...over the board (a card over a dimmed screen)", (await page.locator('[data-testid="tour-scrim"]').count()) === 1);
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(500);
  t = await cardText(page);
  check("Next: you move first, two actions a turn for one piece", /You move first\./.test(t) && /two actions, all for one piece/.test(t) && /Opa's move takes two/.test(t), t);
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(500);
  t = await cardText(page);
  check("Next: the board turns and zooms (a finger's words: drag, pinch)", /The board turns and zooms\./.test(t) && /pinch to zoom/.test(t), t);
  check("...and the computer hasn't moved while the cards were up", await page.evaluate(() => { const p = window.__EC_TEST_PIECES__.filter((q) => q.owner === "dark"); return p.length === 5; }) && (await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 0);
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(1200);
  t = await cardText(page);
  check("Let's play: the card at the top asks for a piece", (await tourOf(page)).step === "pieces" && /Tap one of your pieces\./.test(t) && (await page.locator('[data-testid="tour-scrim"]').count()) === 0, t);
  const cardBox = await card(page).boundingBox();
  check("...at the top of the screen", cardBox && cardBox.y < 140, JSON.stringify(cardBox));
  const before = await camOf(page);

  // The Opa: its lesson, the camera in on it.
  let at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-opa"));
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("the Opa tapped: its name, two squares a roll, once a turn", /The Opa/.test(t) && /rolls two squares at once/.test(t) && /moves once a turn/.test(t), t);
  check("...and where it can go: tap a marked square", /The marked squares show where it can go: tap one/.test(t), t);
  let cam = await camOf(page);
  check("...the camera in a little on it, from a little lower than straight down", (await tourOf(page)).framed && Math.abs(cam.phi - 0.6) < 0.02 && cam.radius < before.radius, `${JSON.stringify(before)} -> ${JSON.stringify(cam)}`);
  at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-opa"));
  const box2 = await card(page).boundingBox();
  check("...the piece in sight, below the card", at.y > box2.y + box2.height && at.y < 915 - 60 && at.x > 0 && at.x < 412, JSON.stringify({ at, card: box2 }));
  check("...the piece card stands aside for the tour's", (await page.locator('[data-testid="piece-card"]').count()) === 0);

  // The Turrito: hemmed in, twice a turn.
  at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-turrito"));
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("the Turrito tapped: its name, twice a turn, and it can't move just now", /The Turrito/.test(t) && /roll twice a turn/.test(t) && /can't move from where it is just now/.test(t), t);
  // Your Cabeza: the piece you win with.
  at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-cabeza"));
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  t = await cardText(page);
  check("your Cabeza tapped: one square any way, step twice a turn, Walnut's back row", /Your Cabeza/.test(t) && /One square any way, corners too/.test(t) && /step twice a turn/.test(t) && /Walnut's back row/.test(t), t);

  // The Opa again, and its square: the move made, your turn over.
  at = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-opa"));
  await tap(at.x, at.y);
  await page.waitForTimeout(2800);
  const opa = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-opa");
  const sq = await page.evaluate(([r, c]) => window.__EC_TEST_SQUARE_POS__(r, c), [opa.row - 2, opa.col]);
  await tap(sq.x, sq.y);
  for (let i = 0; i < 30 && (await tourOf(page)).step === "pieces"; i++) await page.waitForTimeout(250);
  const moved = (await page.evaluate(() => window.__EC_TEST_PIECES__)).find((p) => p.id === "light-opa");
  check("a tap on its marked square moves it there", moved.row === opa.row - 2 && moved.col === opa.col, JSON.stringify(moved));
  await page.waitForTimeout(1500);
  t = await cardText(page);
  check("your turn over: the other side's card (Walnut's turn, or yours again)", (await tourOf(page)).step === "foe" && /(Walnut's turn\.|Your turn again\.)/.test(t), t);
  cam = await camOf(page);
  check("...and the camera back where it was", !(await tourOf(page)).framed && Math.abs(cam.phi - before.phi) < 0.02 && Math.abs(cam.radius - before.radius) < 0.5, `${JSON.stringify(before)} vs ${JSON.stringify(cam)}`);
  // The computer moves; then it's yours again.
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__EC_TEST_PIECES__.some((p) => p.owner === "dark" && (p.row !== 0 && p.row !== 1)))); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  t = await cardText(page);
  check("the computer's moved, and the card says it's your turn again", /Your turn again\./.test(t), t);
  await page.locator('[data-testid="tour-done"]').click();
  await page.waitForTimeout(500);
  check("Got it: the tour's done, and kept as done", (await card(page).count()) === 0 && (await tourOf(page)).step === null && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
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
  console.log("\n[desktop: skipped at the first card]");
  const { ctx, page, errs } = await open(false);
  await begin(page);
  check("Try a Game: the welcome card", (await tourOf(page)).step === "welcome");
  await page.locator('[data-testid="tour-next"]').click();
  await page.locator('[data-testid="tour-next"]').click();
  await page.waitForTimeout(400);
  const t = await cardText(page);
  check("a mouse's words for the board: drag, scroll", /scroll to zoom/.test(t) && !/pinch/.test(t), t);
  await page.locator('[data-testid="tour-skip"]').click();
  await page.waitForTimeout(500);
  check("Skip the tour: gone, and kept as done", (await card(page).count()) === 0 && (await page.evaluate(() => localStorage.getItem("el-cabeza:first-game-tour"))) === "done");
  // The game as ever: a piece clicked has its own small card.
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
