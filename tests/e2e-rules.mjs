/* The rules cards (chassis/RulesCards.jsx), in the INFO overlay: every
   tab renders in both themes; "This game" lists exactly the laws in
   play (here 3 Actions + Slide, switched on through window.__EC_LAWS__),
   and tapping one jumps to its MOVES tile; the open-rules event opens a
   given tab from anywhere. Screenshots of the cards land in /tmp. */
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
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nRULES CARDS E2E PASSED" : `\nRULES CARDS E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
