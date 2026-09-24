/* ABOUT's "The original El Cabeza" link (chassis/ElCabeza3D.jsx
   playOriginal): it closes INFO and sets up a plain game with the basic
   rules only. On the Neon page, laws switched on at boot (window.__EC_LAWS__)
   are cleared. In Nova (apps/unified.jsx), taken from the Neon theme, it
   also switches back to the Standard theme. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const openAbout = (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
const lawsInPlay = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "game" } })));
  await page.waitForTimeout(300);
  const n = await page.locator('[data-testid^="rules-game-law-"]').count();
  await page.mouse.click(6, 6);
  await page.waitForTimeout(400);
  return n;
};
// The INFO title's colour tells the themes apart (Standard: dark ink on
// paper; Neon: pale on glass).
const theme = (page) => page.evaluate(() => {
  const h = document.querySelector('[data-testid="info-overlay"] h2');
  const [r] = getComputedStyle(h).color.match(/\d+/g).map(Number);
  return r > 128 ? "neon" : "standard";
});

{
  console.log("[neon page]");
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_LAWS__ = { threeActions: true, slide: true, shoving: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  check("the game starts with three laws on", (await lawsInPlay(page)) === 3);
  await openAbout(page);
  await page.waitForTimeout(400);
  const text = await page.locator('[data-testid="info-body"]').textContent();
  check("ABOUT says the original is the basic rules alone", /The original El Cabeza is played with its basic rules alone/.test(text));
  await page.locator('[data-testid="play-original"]').click();
  await page.waitForTimeout(800);
  check("the link closes INFO", (await page.locator('[data-testid="info-overlay"]').getAttribute("data-open")) === "false");
  check("...and the game now has no laws", (await lawsInPlay(page)) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("[nova]");
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await page.waitForTimeout(2000);
  check("Nova opens on the Standard theme", (await theme(page)) === "standard");
  // Hold the masthead, then confirm CONNECT: over to Neon.
  const box = await page.locator("h1").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(4400);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.locator(".ec-hold-modal-word").click({ force: true });
  await page.waitForTimeout(3500);
  check("holding the masthead and confirming switches to Neon", (await theme(page)) === "neon");
  await openAbout(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="play-original"]').click();
  await page.waitForTimeout(3500);
  check("the original-game link brings Nova back to Standard", (await theme(page)) === "standard");
  check("...with INFO closed", (await page.locator('[data-testid="info-overlay"]').getAttribute("data-open")) === "false");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nORIGINAL GAME LINK E2E PASSED" : `\nORIGINAL GAME LINK E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
