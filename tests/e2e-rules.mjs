/* The rules cards (chassis/RulesCards.jsx), in the INFO overlay: every
   tab renders in both themes; "This game" lists exactly the laws in
   play (here 3 Actions + Slide, switched on through window.__EC_LAWS__),
   and tapping one jumps to its MOVES tile; the open-rules event opens a
   given tab from anywhere; the How to play button opens it, and Neon's
   Custom rules button opens the SINGULARITY invite. Screenshots of the cards land in /tmp. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const open = (page, tab, focus = null) => page.evaluate(([t, f]) => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: t, focus: f } })), [tab, focus]);

for (const theme of ["neon", "standard"]) {
  console.log(`[${theme}]`);
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_LAWS__ = { threeActions: true, slide: true }; });
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${theme}.html`);
  await page.waitForTimeout(1500);

  const overlay = page.locator('[data-testid="info-overlay"]');
  check("the INFO overlay starts closed", (await overlay.getAttribute("data-open")) === "false");
  await open(page, "quick");
  await page.waitForTimeout(400);
  check("the open-rules event opens it on the asked-for tab",
    (await overlay.getAttribute("data-open")) === "true" && (await page.locator('[data-testid="rules-card-quick"]').count()) === 1);

  for (const tab of ["costs", "game", "moves", "turn", "about"]) {
    await page.locator(`[data-testid="rules-tab-${tab}"]`).click();
    await page.waitForTimeout(200);
    const shown = tab === "about"
      ? (await page.locator('[data-testid="info-body"]').textContent()).includes("parallel universe")
      : (await page.locator(`[data-testid="rules-card-${tab}"]`).count()) === 1;
    check(`the ${tab} tab shows its card`, shown);
    if (tab !== "about") {
      await page.waitForTimeout(tab === "moves" ? 1400 : 100);
      await page.locator('[data-testid="info-overlay"] > div').screenshot({ path: `/tmp/e2e-rules-${theme}-${tab}.png` });
    }
  }

  await page.locator('[data-testid="rules-tab-game"]').click();
  await page.waitForTimeout(200);
  const lawButtons = await page.locator('[data-testid^="rules-game-law-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace("rules-game-law-", "")).sort());
  check("This game lists exactly the laws in play", lawButtons.join(",") === "slide,threeActions", lawButtons.join(","));
  await page.locator('[data-testid="rules-game-law-slide"]').click();
  await page.waitForTimeout(500);
  check("tapping a law there jumps to its MOVES tile",
    (await page.locator('[data-testid="rules-tile-slide"]').getAttribute("data-focus")) === "true");
  const tiles = await page.locator('[data-testid^="rules-tile-"]').count();
  check("MOVES has a tile for every move and law (16)", tiles === 16, String(tiles));

  await page.mouse.click(6, 6);
  await page.waitForTimeout(500);
  check("a tap outside closes it", (await overlay.getAttribute("data-open")) === "false");

  // Out in the open: an always-visible How to play button opens the
  // Quick card, and in Neon the setup dock's Custom rules button brings
  // up the SINGULARITY invite (the same one five masthead taps do).
  const how = page.locator('[data-testid="how-to-play"]');
  check("a How to play button is on screen", await how.isVisible());
  await how.click();
  await page.waitForTimeout(400);
  check("...and opens the rules at the Quick card",
    (await overlay.getAttribute("data-open")) === "true" && (await page.locator('[data-testid="rules-card-quick"]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  if (theme === "neon") {
    const { openDockPanel } = await import("./dock-helpers.mjs");
    await openDockPanel(page);
    const custom = page.locator('[data-testid="custom-rules"]');
    check("the setup dock has a Custom rules button", await custom.isVisible());
    await custom.click();
    await page.waitForTimeout(700);
    check("...which brings up the SINGULARITY invite", await page.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn")));
    await page.screenshot({ path: "/tmp/e2e-rules-custom.png" });
  } else {
    check("Standard has no Custom rules button", (await page.locator('[data-testid="custom-rules"]').count()) === 0);
  }
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await context.close();
}

// The angelic choir and its closing cue belong to the ABOUT tab alone:
// switching to ABOUT sings, leaving it silences the choir (no closing
// cue), closing from ABOUT plays the cue. Every other open, close and tab
// change plays its own small earcon (open / shut / tab) instead.
{
  console.log("[menu audio]");
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();
  const audioErrs = [];
  page.on("pageerror", (e) => audioErrs.push(e.message));
  await page.addInitScript(() => { window.__EC_MENU_CUES__ = []; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  const cues = () => page.evaluate(() => window.__EC_MENU_CUES__.splice(0));
  const overlay = page.locator('[data-testid="info-overlay"]');
  const closeRules = async () => { await page.mouse.click(6, 6); await page.waitForTimeout(400); };

  await page.locator('[data-testid="how-to-play"]').click();
  await page.waitForTimeout(300);
  check("opening the rules on Quick plays the open earcon, not the choir", (await cues()).join(",") === "open");
  await page.locator('[data-testid="rules-tab-costs"]').click();
  await page.waitForTimeout(150);
  check("switching between other tabs plays a tab tick", (await cues()).join(",") === "tab");
  await closeRules();
  check("closing from another tab plays the close earcon, not the choir's cue", (await overlay.getAttribute("data-open")) === "false" && (await cues()).join(",") === "shut");

  await open(page, "moves", "slide");
  await page.waitForTimeout(300);
  check("a rules card opened from elsewhere (not ABOUT) plays the open earcon", (await cues()).join(",") === "open");
  await page.locator('[data-testid="rules-tab-about"]').click();
  await page.waitForTimeout(150);
  check("switching to ABOUT plays the choir", (await cues()).join(",") === "play");
  await page.locator('[data-testid="rules-tab-quick"]').click();
  await page.waitForTimeout(150);
  check("leaving ABOUT silences the choir and ticks (no closing cue)", (await cues()).join(",") === "stop,tab");
  await page.locator('[data-testid="rules-tab-about"]').click();
  await page.waitForTimeout(150);
  await cues();
  await closeRules();
  check("closing from ABOUT plays the closing cue", (await cues()).join(",") === "close");

  await open(page, "about");
  await page.waitForTimeout(300);
  check("opening straight onto ABOUT plays the choir", (await cues()).join(",") === "play");
  await closeRules();
  await cues();
  check(`the earcons run without errors (${audioErrs.length})`, audioErrs.length === 0, audioErrs.join(" | "));
  await context.close();
}

// Reduced motion (e.g. Windows with Animation effects off) gets the calm
// versions, not a still image: the MOVES tiles at half speed, and the
// SINGULARITY invite's slow glow instead of its flicker.
{
  console.log("[reduced motion]");
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(2000);
  await open(page, "moves");
  await page.waitForTimeout(400);
  const tile = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="rules-tile-roll"] .ec-rc-rollT');
    const cs = getComputedStyle(g);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  check("MOVES tiles still move, at half speed", tile.name === "ecRcRollT" && tile.duration === "7.2s", JSON.stringify(tile));
  await page.mouse.click(6, 6);
  await page.waitForTimeout(500);
  const box = await page.locator(".ec-title").first().boundingBox();
  let shown = false;
  for (let a = 0; a < 3 && !shown; a++) {
    for (let i = 0; i < 5; i++) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(140); }
    await page.waitForTimeout(400);
    shown = (await page.locator(".ec-singularity-invite-btn").count()) > 0;
    if (!shown) await page.waitForTimeout(2700);
  }
  const invite = shown && await page.evaluate(() => {
    const q = (sel) => getComputedStyle(document.querySelector(sel)).animationName;
    return { halo: q(".ec-singularity-invite-btn .ec-singularity-halo"), text: q(".ec-singularity-invite-btn .ec-singularity-text") };
  });
  check("the SINGULARITY invite glows slowly instead of standing still",
    !!invite && invite.halo === "ec-singularity-calm-halo" && invite.text === "ec-singularity-calm-text", JSON.stringify(invite));
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nRULES CARDS E2E PASSED" : `\nRULES CARDS E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
