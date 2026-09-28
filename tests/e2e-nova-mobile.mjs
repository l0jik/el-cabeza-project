/* Nova's phone layout (chassis/MobileShell.jsx), in the real page on a
   phone-sized touch screen:
   1. Portrait, Standard: the bars replace the dock (no dock piece, panel
      or corner icons; no sideways scroll); setup choices (first move,
      opponent, AI side and level) and Begin Game; the board framed
      large in the space between the bars; the bar's status, points and
      piece description; Undo move / Stop here; the view toggle; the
      menu's rows and switches; the rules sheet; End game (two taps),
      Move Log, New Game.
   2. The menu's theme switch: CONNECT, then Neon with its own setup
      buttons (Anomaly, Custom rules) in the bar.
   3. Landscape: the bar down the right side, the board left of it.
   4. The same page on a desktop, and Neon's own page on a phone, keep the
      desktop dock (only Nova opts in).
   5. A phone opens Nova with the floating piece (the user asked for it
      back); the dock's layout icon switches to the bar, and the choice is
      remembered. Sections 1-3 open with the bar chosen. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";

// `bar`: open with the control bar chosen (Nova's own default, on phones
// too, is the floating piece; the choice is remembered in localStorage).
async function open(url, { width, height, touch = true, bar = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  // The game's bought, so Nova opens at home (apps/novaStory.jsx).
  await page.addInitScript((bar) => {
    window.__EC_TEST_HOOKS__ = true;
    try { localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); if (bar) localStorage.setItem("el-cabeza:nova-layout", "bar"); } catch (e) { /* none */ }
  }, bar);
  await page.goto(url);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const visible = (page, id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-testid="${id}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
}, id);
const phase = (page) => page.evaluate(() => { const b = document.querySelector('[data-testid="shell-bar"]'); return b && b.dataset.phase; });
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

// ---- 1. portrait, Standard ----
{
  console.log("portrait 390x844");
  const { ctx, page, errs } = await open(NOVA, { width: 390, height: 844, bar: true });
  check("the phone bar is up, in setup", (await phase(page)) === "setup");
  check("the dock panel is out of the way", !(await visible(page, "dock-panel")));
  check("the dock piece is out of the way", !(await visible(page, "dock-piece-canvas")));
  check("no corner How to play icon", !(await visible(page, "how-to-play")));
  check("the menu button is on screen", await visible(page, "shell-menu-button"));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check("no sideways scroll", sw <= 0, String(sw));

  // Setup choices
  const before = await page.evaluate(() => document.querySelector('[data-testid="shell-first-move"] [aria-pressed="true"]').dataset.value);
  await q(page, "shell-first-move").locator(`button[data-value="${before === "dark" ? "light" : "dark"}"]`).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('[data-testid="shell-first-move"] [aria-pressed="true"]').dataset.value);
  check("First move switches sides", after !== before, `${before} -> ${after}`);
  await q(page, "shell-first-move").locator(`button[data-value="${before}"]`).click();
  await q(page, "shell-opponent").locator('button[data-value="true"]').click();
  await page.waitForTimeout(300);
  check("choosing AI shows the AI's side and level", (await visible(page, "shell-ai-side")) && (await visible(page, "shell-ai-level")));
  const aiSide = await page.evaluate(() => document.querySelector('[data-testid="shell-ai-side"] [aria-pressed="true"]').dataset.value);
  const first = await page.evaluate(() => document.querySelector('[data-testid="shell-first-move"] [aria-pressed="true"]').dataset.value);
  check("the AI takes the side that moves second", aiSide !== first, `${aiSide} / ${first}`);
  await q(page, "shell-ai-level").locator('button[data-value="hard"]').click();
  await page.waitForTimeout(200);
  check("the level is chosen", await page.evaluate(() => document.querySelector('[data-testid="shell-ai-level"] [aria-pressed="true"]').dataset.value === "hard"));
  await q(page, "shell-opponent").locator('button[data-value="false"]').click();
  await page.waitForTimeout(200);
  check("back to two players hides the AI rows", !(await visible(page, "shell-ai-side")));

  await q(page, "shell-begin").click();
  check("Begin Game starts play", await waitFor(async () => (await phase(page)) === "playing"));
  await page.waitForTimeout(2200);
  const status = await q(page, "shell-status").textContent();
  check("the status says whose turn it is", /to move/i.test(status), status);
  check("two action points shown", (await page.locator('[data-testid="shell-points"] [data-filled="true"]').count()) === 2);

  // Board framed between the bars, and large
  const frame = await page.evaluate(() => {
    const a = window.__EC_TEST_CUBE_POS__(0, 0), b = window.__EC_TEST_CUBE_POS__(9, 9);
    const c = window.__EC_TEST_CUBE_POS__(0, 9), d = window.__EC_TEST_CUBE_POS__(9, 0);
    const bar = document.querySelector('[data-testid="shell-bar"]').getBoundingClientRect();
    const xs = [a.x, b.x, c.x, d.x], ys = [a.y, b.y, c.y, d.y];
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), barTop: bar.top };
  });
  check("the board sits between the title row and the bar", frame.minY > 60 && frame.maxY < frame.barTop, JSON.stringify(frame));
  check("the board spans most of the width", frame.maxX - frame.minX > 390 * 0.72, JSON.stringify(frame));

  // A piece: its description in the bar, then a move
  const pos = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-flaco"));
  const cur = await page.evaluate(() => /dark/i.test(document.querySelector('[data-testid="shell-status"]').textContent) ? "dark" : "light");
  const mover = cur === "dark" ? "dark-flaco" : "light-flaco";
  const mpos = await page.evaluate((id) => window.__EC_TEST_SCREEN_POS__(id), mover);
  await page.touchscreen.tap(mpos.x, mpos.y);
  await page.waitForTimeout(700);
  check("the chosen piece is described in the bar", await page.evaluate(() => !!document.querySelector('[data-testid="shell-bar"] [data-testid="piece-card"][data-piece="flaco"]')));
  check("no floating piece card over the board", (await page.locator('[data-testid="piece-card"]').count()) === 1);
  void pos;
  await page.evaluate((id) => window.__EC_TEST_MOVE__(id, id.startsWith("dark") ? "S" : "N"), mover);
  await page.waitForTimeout(1800);
  check("Undo move and Stop here appear mid-turn", (await visible(page, "shell-undo-move")) && (await visible(page, "shell-end-turn")));
  check("one point left", (await page.locator('[data-testid="shell-points"] [data-filled="true"]').count()) === 1);
  await q(page, "shell-end-turn").click();
  check("Stop here passes the turn", await waitFor(async () => new RegExp(cur === "dark" ? "light" : "dark", "i").test(await q(page, "shell-status").textContent())));
  check("Undo turn is offered", await visible(page, "shell-undo-turn"));

  // View toggle
  const label0 = await q(page, "shell-view-toggle").getAttribute("aria-label");
  await q(page, "shell-view-toggle").click();
  await page.waitForTimeout(400);
  const label1 = await q(page, "shell-view-toggle").getAttribute("aria-label");
  check("the view toggle switches views", label0 !== label1, `${label0} -> ${label1}`);

  // Menu
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(400);
  // (No "Rules in this game" in the store or the den: theme.rulesTabsHidden.)
  const rows = ["shell-menu-rules", "shell-menu-movelog", "shell-menu-end", "shell-menu-top", "shell-menu-player",
    "shell-menu-sound", "shell-menu-points", "shell-menu-costs", "shell-menu-switch-theme", "shell-menu-back-to-store", "shell-menu-restart", "shell-menu-about"];
  const missing = [];
  for (const r of rows) if (!(await q(page, r).count())) missing.push(r);
  check("the menu has every option", missing.length === 0, missing.join(", "));
  check("the move log has a move", !(await q(page, "shell-menu-movelog").isDisabled()));
  await q(page, "shell-menu-points").click();
  await page.waitForTimeout(200);
  check("Points left switches off", (await q(page, "shell-menu-points").getAttribute("aria-checked")) === "false");
  // All sounds is a slider at home (the den's channels under it): all the
  // way left is off, and back up again.
  await q(page, "shell-menu-sound").fill("0");
  await page.waitForTimeout(200);
  const sndOff = await q(page, "shell-menu-sound").getAttribute("data-level");
  await q(page, "shell-menu-sound").fill("100");
  await page.waitForTimeout(200);
  check("All sounds slides off and back up", sndOff === "0" && (await q(page, "shell-menu-sound").getAttribute("data-level")) === "100");
  await q(page, "shell-menu-close").click();
  await page.waitForTimeout(400);
  check("the menu closes", !(await q(page, "shell-menu").count()));
  check("the points dots are gone with the switch off", !(await q(page, "shell-points").count()));

  // Rules sheet
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(300);
  await q(page, "shell-menu-rules").click();
  check("How to play opens the rules", await waitFor(async () => (await q(page, "info-overlay").getAttribute("data-open")) === "true"));
  const sheet = await page.evaluate(() => document.querySelector('[data-testid="info-body"]').parentElement.getBoundingClientRect().width);
  check("the rules sheet is full width", sheet >= 380, String(sheet));
  await q(page, "info-close").click();
  check("the rules close", await waitFor(async () => (await q(page, "info-overlay").getAttribute("data-open")) === "false"));

  // End game (two taps), then the result
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(300);
  await q(page, "shell-menu-end").click();
  await page.waitForTimeout(200);
  check("End game asks for a second tap", /again/i.test(await q(page, "shell-menu-end").textContent()) && (await phase(page)) === "playing");
  await q(page, "shell-menu-end").click();
  check("the second tap ends the game", await waitFor(async () => (await phase(page)) === "over"));
  check("Move Log and New Game in the bar", (await visible(page, "shell-movelog")) && (await visible(page, "shell-new-game")));
  await q(page, "shell-movelog").click();
  check("Move Log opens", await waitFor(() => visible(page, "movelog-sheet")));
  await page.keyboard.press("Escape");
  await page.mouse.click(8, 8);
  await page.waitForTimeout(500);
  await q(page, "shell-new-game").click();
  check("New Game returns to setup", await waitFor(async () => (await phase(page)) === "setup"));

  // 2. Into Neon from the menu: at home it turns on the TV (den-tv.js),
  // whose picture takes the page into Singularity.
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(300);
  check("the menu's switch is the TV at home", /Turn on the TV/.test(await q(page, "shell-menu-switch-theme").innerText()));
  await q(page, "shell-menu-switch-theme").click();
  check("...which turns the set on", await waitFor(() => page.evaluate(() => { const tv = window.__DEN_TV__ && window.__DEN_TV__(); return !!tv && tv.phase !== "off"; }), 8000));
  check("Neon comes up with its setup buttons", await waitFor(async () => (await visible(page, "shell-anomaly")) && (await visible(page, "shell-custom-rules")), 30000));
  const layout0 = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.map((p) => [p.id, p.row, p.col])));
  await q(page, "shell-anomaly").click();
  await page.waitForTimeout(1500);
  const layout1 = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.map((p) => [p.id, p.row, p.col])));
  check("Anomaly deals a new opening", layout0 !== layout1);
  await q(page, "shell-custom-rules").click();
  check("Custom rules opens the SINGULARITY invite", await waitFor(async () => (await page.locator(".ec-singularity-invite-btn").count()) > 0));
  const inv = await page.evaluate(() => { const r = document.querySelector(".ec-singularity-invite-btn .ec-singularity-text").getBoundingClientRect(); return { l: r.left, r: r.right }; });
  check("SINGULARITY fits across the phone", inv.l >= 0 && inv.r <= 390, JSON.stringify(inv));
  await page.mouse.click(8, 8);
  check("a tap outside dismisses the invite", await waitFor(async () => (await page.locator(".ec-singularity-invite-btn").count()) === 0));
  await q(page, "shell-begin").click();
  await page.waitForTimeout(2500);
  check("a plain Neon game shows no custom-rules emblem", (await page.locator('[data-testid="variants-flyout"]').count()) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- 1b. a game against the AI ----
{
  console.log("portrait, vs AI");
  const { ctx, page, errs } = await open(NOVA, { width: 390, height: 844, bar: true });
  await q(page, "shell-opponent").locator('button[data-value="true"]').click();
  await q(page, "shell-ai-level").locator('button[data-value="easy"]').click();
  const human = await page.evaluate(() => document.querySelector('[data-testid="shell-first-move"] [aria-pressed="true"]').dataset.value);
  await q(page, "shell-begin").click();
  await page.waitForTimeout(2500);
  await page.evaluate((id) => window.__EC_TEST_MOVE__(id, id.startsWith("dark") ? "S" : "N"), `${human}-flaco`);
  await page.waitForTimeout(1800);
  await q(page, "shell-end-turn").click();
  check("the AI takes its turn", await waitFor(async () => (await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) >= 2, 30000));
  check("then it's the human's turn again", await waitFor(async () => new RegExp(`${human} to move`, "i").test(await q(page, "shell-status").textContent()), 10000));
  check("Undo turn takes back the pair", await visible(page, "shell-undo-turn"));
  await q(page, "shell-undo-turn").click();
  check("...back to the start", await waitFor(async () => (await page.evaluate(() => (window.__EC_TEST_TURNS__ || []).length)) === 0, 8000));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- 3. landscape ----
{
  console.log("landscape 844x390");
  const { ctx, page, errs } = await open(NOVA, { width: 844, height: 390, bar: true });
  check("the phone bar is up", (await phase(page)) === "setup");
  const bar = await q(page, "shell-bar").boundingBox();
  check("the bar runs down the right side", bar && bar.x > 440 && bar.x + bar.width >= 843, JSON.stringify(bar));
  const title = await page.evaluate(() => document.querySelector(".ec-title").getBoundingClientRect().right);
  check("the title stays clear of the bar", title < bar.x, `${title} vs ${bar.x}`);
  await q(page, "shell-begin").click();
  await page.waitForTimeout(3000);
  const right = await page.evaluate(() => Math.max(window.__EC_TEST_CUBE_POS__(0, 9).x, window.__EC_TEST_CUBE_POS__(9, 9).x, window.__EC_TEST_CUBE_POS__(0, 0).x, window.__EC_TEST_CUBE_POS__(9, 0).x));
  const bar2 = await q(page, "shell-bar").boundingBox();
  check("the board is left of the bar", right < bar2.x, `${right} vs ${bar2.x}`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check("no sideways scroll", sw <= 0, String(sw));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- 4. only Nova, only on phones ----
{
  console.log("desktop Nova, phone Neon page");
  const d = await open(NOVA, { width: 1280, height: 800, touch: false });
  check("desktop Nova keeps the dock", !(await q(d.page, "shell-bar").count()) && (await q(d.page, "dock-piece-canvas").count()) > 0);
  // Both layouts on a desktop: the dock's layout icon switches to the bar,
  // the menu switches back, and the choice is remembered.
  const dockBox = await q(d.page, "dock-piece-canvas").boundingBox();
  await d.page.mouse.click(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await waitFor(async () => (await q(d.page, "dock-panel").getAttribute("data-open")) === "true");
  await q(d.page, "layout-toggle").click();
  check("the dock's layout icon switches to the bar", await waitFor(() => visible(d.page, "shell-bar")));
  const bar = await q(d.page, "shell-bar").boundingBox();
  check("on a desktop the bar floats, centred", bar.width <= 600 && Math.abs(bar.x + bar.width / 2 - 640) < 2 && bar.y + bar.height < 800 - 8, JSON.stringify(bar));
  await d.page.reload();
  await d.page.waitForTimeout(2500);
  check("the bar layout is remembered", await visible(d.page, "shell-bar"));
  // The side that moves first sits nearest the viewer before a game.
  const near = await d.page.evaluate(() => {
    const first = document.querySelector('[data-testid="shell-first-move"] [aria-pressed="true"]').dataset.value;
    const cab = window.__EC_TEST_SCREEN_POS__(`${first}-cabeza`), other = window.__EC_TEST_SCREEN_POS__(`${first === "dark" ? "light" : "dark"}-cabeza`);
    return cab.y > other.y;
  });
  check("the first mover's side is nearest", near);
  await q(d.page, "shell-menu-button").click();
  await d.page.waitForTimeout(300);
  await q(d.page, "shell-menu-layout").click();
  check("the menu switches back to the dock", await waitFor(async () => !(await q(d.page, "shell-bar").count()) && (await visible(d.page, "dock-piece-canvas"))));
  await d.ctx.close();
  const n = await open("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html", { width: 390, height: 844 });
  check("Neon's own page keeps the dock on a phone", !(await q(n.page, "shell-bar").count()) && (await visible(n.page, "dock-piece-canvas")));
  await n.ctx.close();
}

// ---- 5. a phone opens Nova with the floating piece ----
{
  console.log("phone default: the floating piece");
  const p = await open(NOVA, { width: 390, height: 844 });
  check("a phone opens Nova with the floating piece, no bar", !(await q(p.page, "shell-bar").count()) && (await visible(p.page, "dock-piece-canvas")));
  const dockBox = await q(p.page, "dock-piece-canvas").boundingBox();
  await p.page.touchscreen.tap(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await waitFor(async () => (await q(p.page, "dock-panel").getAttribute("data-open")) === "true");
  check("the dock offers the bar on a phone too", (await q(p.page, "layout-toggle").count()) === 1);
  await q(p.page, "layout-toggle").tap();
  check("...and switches to it", await waitFor(() => visible(p.page, "shell-bar")));
  await p.page.reload();
  await p.page.waitForTimeout(2500);
  check("the bar is remembered on the phone", await visible(p.page, "shell-bar"));
  await q(p.page, "shell-menu-button").tap();
  await p.page.waitForTimeout(300);
  check("the phone's menu offers the classic dock", (await q(p.page, "shell-menu-layout").count()) === 1);
  check(`no page errors (${p.errs.length})`, p.errs.length === 0, p.errs.join(" | "));
  await p.ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nNOVA MOBILE E2E PASSED" : `\nNOVA MOBILE E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
