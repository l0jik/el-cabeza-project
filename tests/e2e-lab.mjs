/* The Theme Lab (apps/lab.jsx): ten design directions over one game.

   What must hold, and is checked here:
   - every direction loads and renders with no page errors;
   - switching direction never touches the game: the same pieces in the
     same places, the same side to move, the same points spent mid-turn,
     the same log, all ten times over, and play carries on afterwards;
   - a switch asked for while a step is still animating waits for it;
   - the directions really differ (their tokens, fonts, HUD composition);
   - every lab control works: the picker, previous/next (buttons and
     keys), number keys, random, hide interface, sound on/off, volume,
     reset presentation, return to game, Escape and an outside press;
   - sound starts only after a gesture and its voices are released;
   - a phone-sized screen gets the compact HUD with no sideways scroll. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };

async function openLab(page, theme) {
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.removeItem("el-cabeza:lab-theme"); } catch (e) { /* none */ } });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-lab.html?theme=${theme}`);
  await poll(() => page.evaluate(() => !!window.__LAB__ && !!document.querySelector('[data-testid="lab-hud"]')), 15000);
}
const state = (page) => page.evaluate(() => ({
  pieces: JSON.stringify(window.__EC_TEST_PIECES__.map((p) => [p.id, p.row, p.col, p.w, p.h, p.z]).sort()),
  log: JSON.stringify(window.__EC_TEST_LOG__ || []),
  player: document.querySelector('[data-testid="lab-hud"]').dataset.player,
  status: document.querySelector('[data-testid="lab-hud"]').dataset.status,
  points: [...document.querySelectorAll('[data-testid="lab-hud"] .lab-stats div')].find((d) => /points/i.test(d.textContent))?.querySelector("dd").textContent,
  focus: document.querySelector('[data-testid="lab-hud"]').dataset.focus,
}));
const labId = (page) => page.evaluate(() => window.__LAB__.id);
async function waitSwitched(page, id) {
  return poll(() => page.evaluate((i) => window.__LAB__.id === i && !window.__LAB__.busy() && !!document.querySelector(`[data-testid="lab-hud"][data-lab="${i}"]`), id), 15000);
}

// ------------------------------------------------------------------ desktop
{
  console.log("[desktop]");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await openLab(page, "swiss");
  check("the lab opens on the direction named in the address", (await labId(page)) === "swiss");
  check("sound waits for a gesture", (await page.evaluate(() => window.__LAB__.audio().started)) === false);

  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).first().click();
  await page.mouse.move(1276, 400);
  await page.waitForTimeout(2200);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(640, 796); await page.waitForTimeout(500); }
  check("the HUD shows the game begun", (await state(page)).status === "playing");

  // Dark plays a full two-point turn with its Flaco.
  const pos = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-flaco"));
  await page.mouse.click(pos.x, pos.y);
  await poll(() => page.evaluate(() => window.__EC_TEST_COST_BADGES__().length > 0), 4000);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
  await page.waitForTimeout(1700);
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
  check("a full turn passes play to Light", !!(await poll(async () => (await state(page)).player === "light", 6000)));
  check("sound started with the first gesture", (await page.evaluate(() => window.__LAB__.audio().started)) === true);

  // Light takes one step (mid-turn) and keeps the piece selected.
  const lp = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-chato"));
  await page.mouse.click(lp.x, lp.y);
  await poll(() => page.evaluate(() => window.__EC_TEST_COST_BADGES__().length > 0), 4000);
  await page.evaluate(() => window.__EC_TEST_MOVE__("light-chato", "N"));
  await page.waitForTimeout(1800);
  const before = await state(page);
  check("mid-turn: Light has spent a point", before.points === "1/2" && before.player === "light", JSON.stringify(before));

  // Switch through every direction, several ways; nothing about the game moves.
  const ids = await page.evaluate(() => window.__LAB__.ids);
  check("ten directions", ids.length === 10, ids.join(","));
  const accents = new Set(), fonts = new Set(), huds = new Set();
  let intact = 0;
  for (let i = 1; i <= ids.length; i++) {
    const id = ids[i % ids.length];
    if (i === 1) await page.keyboard.press("]");
    else if (i === 2) { await page.locator('[data-testid="lab-open"]').click(); await page.locator(`[data-testid="lab-theme-${id}"]`).click(); }
    else if (i === 3) await page.keyboard.press(String((i % ids.length) + 1));
    else await page.evaluate((x) => window.__LAB__.switchTo(x), id);
    const ok = await waitSwitched(page, id);
    await page.waitForTimeout(500);
    const now = await state(page);
    const same = ok && now.pieces === before.pieces && now.log === before.log && now.player === before.player && now.points === before.points;
    if (same) intact++;
    else console.log("   differs in", id, JSON.stringify({ ok, before, now }).slice(0, 400));
    const look = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const hud = document.querySelector('[data-testid="lab-hud"]');
      const big = getComputedStyle(hud.querySelector(".lab-big")), turn = getComputedStyle(hud.querySelector(".lab-turn")), root = getComputedStyle(hud);
      const sig = [root.display, root.transform, root.backgroundColor, big.fontSize, big.backgroundColor, big.borderRadius, turn.backgroundColor, turn.fontSize, turn.textTransform].join("|");
      return { accent: cs.getPropertyValue("--accent-primary").trim(), font: cs.getPropertyValue("--font-display").trim(), hud: sig, title: document.title };
    });
    accents.add(look.accent); fonts.add(look.font); huds.add(look.hud);
    if (!look.title.includes(id === "swiss" ? "Swiss" : "")) console.log("   title", look.title);
  }
  check(`the game is untouched by all ten switches (${intact}/10)`, intact === 10);
  check(`the directions differ: ${fonts.size} display faces, ${accents.size} accents, ${huds.size} HUD compositions`, fonts.size >= 9 && accents.size >= 6 && huds.size === 10);
  check("back on the first direction, the address says so", (await labId(page)) === "swiss" && (await page.evaluate(() => new URLSearchParams(location.search).get("theme"))) === "swiss");

  // Play carries on: finish Light's turn.
  const lp2 = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("light-chato"));
  await page.mouse.click(lp2.x, lp2.y); await page.waitForTimeout(400);
  const b2 = await page.evaluate(() => window.__EC_TEST_COST_BADGES__());
  const d2 = (b2.find((x) => x.text !== "free") || b2[0] || {}).dir;
  if (d2) await page.evaluate((d) => window.__EC_TEST_MOVE__("light-chato", d), d2);
  check("after the switches the turn finishes and play passes to Dark", !!(await poll(async () => (await state(page)).player === "dark", 6000)));
  const logLen = await page.evaluate(() => window.__EC_TEST_LOG__.length);
  check("...and the log grows by one (two turns in all)", logLen === 2, String(logLen));

  // A switch asked for mid-animation waits for the step to land.
  const dp = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-flaco"));
  await page.mouse.click(dp.x, dp.y); await page.waitForTimeout(400);
  const bd = await page.evaluate(() => window.__EC_TEST_COST_BADGES__());
  const dd = (bd.find((x) => x.text !== "free" && /^[NSEW]$/.test(x.dir)) || bd[0] || {}).dir;
  const flacoBefore = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "dark-flaco")));
  await page.evaluate((d) => { window.__EC_TEST_MOVE__("dark-flaco", d); window.__LAB__.switchTo("brutalist"); }, dd);
  await waitSwitched(page, "brutalist");
  await page.waitForTimeout(600);
  const flacoAfter = await page.evaluate(() => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === "dark-flaco")));
  const pts = (await state(page)).points;
  check("a switch during a step waits: the step lands and counts", flacoAfter !== flacoBefore && pts === "1/2", `${pts} ${flacoAfter}`);

  // The lab's own controls.
  await page.locator('[data-testid="lab-open"]').click();
  check("the lab panel opens", (await page.locator('[data-testid="lab-panel"]').count()) === 1);
  await page.locator('[data-testid="lab-toggle-ui"]').click();
  check("hide interface hides the HUD and the menus", await page.evaluate(() => document.body.classList.contains("lab-ui-hidden") && getComputedStyle(document.querySelector('[data-testid="lab-hud"]')).visibility === "hidden"));
  await page.keyboard.press("h");
  check("...and H brings it back", await page.evaluate(() => !document.body.classList.contains("lab-ui-hidden")));
  const wasMuted = await page.evaluate(() => window.__LAB__.audio().muted);
  await page.locator('[data-testid="lab-audio"]').click();
  check("the sound switch mutes", (await page.evaluate(() => window.__LAB__.audio().muted)) === !wasMuted);
  await page.keyboard.press("m");
  check("...and M unmutes", (await page.evaluate(() => window.__LAB__.audio().muted)) === wasMuted);
  await page.locator('[data-testid="lab-volume"]').fill("35");
  check("the volume slider sets the volume", Math.abs((await page.evaluate(() => window.__LAB__.audio().volume)) - 0.35) < 0.01);
  const pre = await labId(page);
  await page.locator('[data-testid="lab-random"]').click();
  await poll(async () => (await labId(page)) !== pre && !(await page.evaluate(() => window.__LAB__.busy())), 15000);
  check("random picks another direction", (await labId(page)) !== pre);
  const beforeReset = await state(page);
  await page.locator('[data-testid="lab-open"]').isVisible() && (await page.locator('[data-testid="lab-panel"]').count()) === 0 && await page.locator('[data-testid="lab-open"]').click();
  await page.locator('[data-testid="lab-reset"]').click();
  await page.waitForTimeout(1500);
  const afterReset = await state(page);
  check("reset presentation leaves the game as it was", afterReset.pieces === beforeReset.pieces && afterReset.points === beforeReset.points && afterReset.player === beforeReset.player);
  if ((await page.locator('[data-testid="lab-panel"]').count()) === 0) await page.locator('[data-testid="lab-open"]').click();
  await page.locator('[data-testid="lab-return"]').click();
  check("return to game closes the panel", (await page.locator('[data-testid="lab-panel"]').count()) === 0);
  await page.keyboard.press("l");
  check("L opens it", (await page.locator('[data-testid="lab-panel"]').count()) === 1);
  await page.keyboard.press("Escape");
  check("Escape closes it", (await page.locator('[data-testid="lab-panel"]').count()) === 0);
  await page.locator('[data-testid="lab-open"]').click();
  await page.mouse.click(1100, 400);
  check("a press outside closes it", (await page.locator('[data-testid="lab-panel"]').count()) === 0);
  const before2 = await labId(page);
  await page.locator('[data-testid="lab-prev"]').click();
  await poll(async () => (await labId(page)) !== before2 && !(await page.evaluate(() => window.__LAB__.busy())), 15000);
  const idx = (x) => ids.indexOf(x);
  check("the ‹ button steps back one", idx(await labId(page)) === (idx(before2) + 9) % 10);
  await page.waitForTimeout(1500);
  check("sound voices are released after they play", (await page.evaluate(() => window.__LAB__.audio().active)) === 0, String(await page.evaluate(() => window.__LAB__.audio().active)));
  check("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
  await context.close();
}

// ------------------------------------------------------------------ phone
{
  console.log("[phone]");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await openLab(page, "corporateSwiss");
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).first().click();
  await page.waitForTimeout(2500);
  for (const id of ["corporateSwiss", "neoBrutalist", "newTypography"]) {
    if ((await labId(page)) !== id) { await page.evaluate((x) => window.__LAB__.switchTo(x), id); await waitSwitched(page, id); await page.waitForTimeout(600); }
    const fit = await page.evaluate(() => {
      const hud = document.querySelector('[data-testid="lab-hud"]').getBoundingClientRect();
      const bar = document.querySelector('[data-testid="lab-bar"]').getBoundingClientRect();
      return { hudRight: hud.right, hudTop: hud.top, barBottom: bar.bottom, scroll: document.scrollingElement.scrollWidth, w: innerWidth };
    });
    check(`${id}: the compact HUD fits under the lab bar, no sideways scroll`, fit.hudRight <= fit.w + 1 && fit.hudTop >= fit.barBottom - 2 && fit.scroll <= fit.w, JSON.stringify(fit));
  }
  const tgt = await page.locator('[data-testid="lab-next"]').boundingBox();
  check("the lab's buttons are touch-sized", tgt.width >= 36 && tgt.height >= 36, JSON.stringify(tgt));
  check("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} lab check(s) failed` : "\nall lab checks passed");
process.exit(failures ? 1 : 0);
