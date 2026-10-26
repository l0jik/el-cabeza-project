/* Lluvia's opening and custom-rules city, end to end: the opening shows
   on load; DESCEND starts the flythrough; SKIP lands in the city; the
   MATTER / LAWS / TOPOLOGIES panels change settings; BEGIN THE GAME starts
   a real game with them (board size, roster, opponent); and the opening
   can be passed straight to the board. */
import { chromium } from "playwright";

const SHOTS = process.env.LLUVIA_SHOTS || null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-certificate-errors"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const errs = [];

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-lluvia.html");
  await page.waitForTimeout(2500);
  return page;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/lluvia-${name}.png` }); };

const page = await open({ width: 420, height: 860 });
const overlay = page.locator('[data-testid="lluvia-overlay"]');
check("the opening shows on load", (await overlay.count()) === 1 && (await overlay.getAttribute("data-phase")) === "ready");
await shot(page, "1-ready");

await page.locator('[data-testid="lluvia-descend"]').click();
await page.waitForTimeout(400);
check("DESCEND starts the flythrough", (await overlay.getAttribute("data-phase")) === "flight");
let caption = "";
for (let i = 0; i < 20 && !caption; i++) {
  await page.waitForTimeout(500);
  const c = page.locator('[data-testid="lluvia-caption"]');
  if (await c.count()) caption = await c.textContent();
}
check(`a caption tells the descent (${JSON.stringify(caption)})`, caption.length > 0);
await shot(page, "2-flight");
await page.locator('[data-testid="lluvia-skip"]').click();
await page.waitForTimeout(1200);
check("SKIP lands in the city", (await overlay.getAttribute("data-phase")) === "city");
await shot(page, "3-city");

await page.locator('[data-testid="lluvia-open-matter"]').click();
await page.waitForTimeout(300);
check("MATTER opens its panel", (await page.locator('[data-testid="lluvia-panel-matter"]').count()) === 1);
// Every piece pictured as the city draws it, each Arco size its own row.
check("...every piece pictured (15, each Arco size its own row)", !!(await (async () => { for (let i = 0; i < 40; i++) { const n = await page.locator('[data-testid^="lluvia-pic-"]').evaluateAll((els) => els.filter((e) => (e.getAttribute("src") || "").startsWith("data:image/png")).length); if (n === 15) return true; await page.waitForTimeout(150); } return false; })()));
check("...the Arco Chico, Alto and Ancho each with a picture", (await page.locator('[data-testid="lluvia-pic-arcoChico"]').count()) === 1 && (await page.locator('[data-testid="lluvia-pic-arcoAlto"]').count()) === 1 && (await page.locator('[data-testid="lluvia-pic-arcoAncho"]').count()) === 1);
// A picture: the piece large, in 3D, as the city draws it (user).
await page.locator('[data-testid="lluvia-inspect-zeta"]').scrollIntoViewIfNeeded();
await page.locator('[data-testid="lluvia-inspect-zeta"]').click();
check("...a picture opens the piece large, in 3D", !!(await (async () => { for (let i = 0; i < 30; i++) { if ((await page.locator('[data-testid="piece-viewer"]').getAttribute("data-state").catch(() => null)) === "open") return true; await page.waitForTimeout(200); } return false; })()) && /zeta/i.test(await page.locator('[data-testid="piece-viewer-name"]').innerText()));
await page.mouse.click(8, 8);
check("...and a tap outside puts it back, the panel still open", !!(await (async () => { for (let i = 0; i < 20; i++) { if ((await page.locator('[data-testid="piece-viewer"]').count()) === 0) return true; await page.waitForTimeout(200); } return false; })()) && (await page.locator('[data-testid="lluvia-panel-matter"]').count()) === 1);
await page.locator('[data-testid="lluvia-matter-rayo-inc"]').click();
await page.waitForTimeout(150);
check("...a Rayo is added (6 pieces)", (await page.locator('[data-testid="lluvia-matter-total"]').textContent()) === "6");
// No cap but whether they fit (user: "drop it, so the only limit is
// whether the pieces fit, with a short note that big armies weaken the
// computer").
for (let i = 0; i < 5; i++) await page.locator('[data-testid="lluvia-matter-turrito-inc"]').click();
await page.waitForTimeout(150);
check("...11 pieces: no cap, and a note that big armies weaken the computer",
  (await page.locator('[data-testid="lluvia-matter-total"]').textContent()) === "11" && /^Big armies weaken the computer/.test(await page.locator('[data-testid="lluvia-big-army"]').textContent()));
// Too many: a pop-up the moment they stop fitting (user: "there needs to be
// a pop-up ... It needs to be brought to the user's attention what the
// situation is"); BEGIN greyed but answering; Take some out, to MATTER.
const fitAlert = page.locator('[data-testid="lluvia-fit-alert"]');
let opas = 0;
while (opas < 8 && !(await fitAlert.count())) { await page.locator('[data-testid="lluvia-matter-opa-inc"]').click(); opas++; await page.waitForTimeout(80); }
check(`...too many to fit (${opas} more Opas): a pop-up at once, saying so`, (await fitAlert.count()) === 1 && /won't fit in two home rows/i.test(await page.locator('[data-testid="lluvia-fit-alert-text"]').textContent()));
await shot(page, "4-fit-alert");
await page.locator('[data-testid="lluvia-fit-alert-close"]').click();
check("...its × puts it away, MATTER still open", (await fitAlert.count()) === 0 && (await page.locator('[data-testid="lluvia-panel-matter"]').count()) === 1);
while (opas < 8) { await page.locator('[data-testid="lluvia-matter-opa-inc"]').click(); opas++; }
await page.waitForTimeout(150);
check("...more still: it doesn't come back for each", (await fitAlert.count()) === 0);
check("...nine Opas won't fit 10 wide: it says so", /WON'T FIT/.test(await page.locator('[data-testid="lluvia-fit"]').textContent()));
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.waitForTimeout(300);
{
  const begin = page.locator('[data-testid="lluvia-begin"]');
  check("...BEGIN says the pieces won't fit, greyed", /PIECES WON'T FIT/.test(await begin.textContent()) && (await begin.getAttribute("aria-disabled")) === "true");
  await begin.click({ force: true }); // (aria-disabled, but a press still reaches it: that's the point)
  await page.waitForTimeout(300);
  check("...pressed: the pop-up, and no game", (await fitAlert.count()) === 1 && (await page.locator('[data-testid="lluvia-overlay"]').count()) === 1);
  // Or anywhere in a side's half (user: "an option to allow pieces ...
  // anywhere on your side of the board"; "1 & 2"): the city's way, or yours.
  check("...they'd fit anywhere in a side's half: both ways offered", (await page.locator('[data-testid="lluvia-fit-alert-half-start"]').count()) === 1 && (await page.locator('[data-testid="lluvia-fit-alert-half-by-hand"]').count()) === 1);
  await page.locator('[data-testid="lluvia-fit-alert-half-start"]').click();
  await page.waitForTimeout(400);
  check("...Start them anywhere in my half: gone, BEGIN THE GAME on", (await fitAlert.count()) === 0 && /BEGIN THE GAME/.test(await begin.textContent()) && (await begin.getAttribute("aria-disabled")) === null);
  await page.locator('[data-testid="lluvia-open-topologies"]').click();
  await page.waitForTimeout(300);
  const halfFlag = page.locator('[data-testid="lluvia-topo-halfStart"]');
  check("...on in TOPOLOGIES, under Randomized start", (await halfFlag.getAttribute("aria-pressed")) === "true"
    && await page.evaluate(() => { const r = document.querySelector('[data-testid="lluvia-topo-random"]'); return !!r && r.nextElementSibling === document.querySelector('[data-testid="lluvia-topo-halfStart"]'); }));
  await halfFlag.click();
  await page.waitForTimeout(300);
  check("...off again: they don't fit, and the pop-up's back", (await fitAlert.count()) === 1);
  await page.locator('[data-testid="lluvia-fit-alert-close"]').click();
  await page.locator('[data-testid="lluvia-panel-close"]').click();
  await page.waitForTimeout(300);
  await begin.click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="lluvia-fit-alert-take-out"]').click();
  await page.waitForTimeout(400);
  check("...'Take some pieces out': back in MATTER", (await fitAlert.count()) === 0 && (await page.locator('[data-testid="lluvia-panel-matter"]').count()) === 1);
}
for (let i = 0; i < 8; i++) await page.locator('[data-testid="lluvia-matter-opa-dec"]').click();
for (let i = 0; i < 5; i++) await page.locator('[data-testid="lluvia-matter-turrito-dec"]').click();
await page.waitForTimeout(150);
check("...back to six: no note, no warning", (await page.locator('[data-testid="lluvia-big-army"]').count()) === 0 && (await page.locator('[data-testid="lluvia-fit"]').count()) === 0);
await shot(page, "4-matter");
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.locator('[data-testid="lluvia-open-laws"]').click();
await page.waitForTimeout(300);
// Every law at once, first in LAWS (user: "a switch ... at the top of all
// custom setting menus to turn all laws on").
{
  const all = page.locator('[data-testid="lluvia-all-laws"]');
  const first = await page.evaluate(() => { const b = document.querySelector('[data-testid="lluvia-panel-laws"] button[aria-pressed]'); return b && b.dataset.testid; });
  check(`ALL LAWS first in LAWS, off (${first})`, first === "lluvia-all-laws" && (await all.getAttribute("aria-pressed")) === "false");
  await all.click(); await page.waitForTimeout(150);
  const n = await page.locator('button[data-testid^="lluvia-law-"]').count();
  const on = await page.$$eval('button[data-testid^="lluvia-law-"][aria-pressed="true"]', (els) => els.map((e) => e.dataset.testid));
  check(`...on: every law, Split movement three pieces the one split (${on.length}/${n})`, n === 8 && on.length === 7 && !on.includes("lluvia-law-splitMovement") && (await all.getAttribute("aria-pressed")) === "true");
  await all.click(); await page.waitForTimeout(150);
  check("...off: none", (await page.locator('button[data-testid^="lluvia-law-"][aria-pressed="true"]').count()) === 0 && (await all.getAttribute("aria-pressed")) === "false");
  // (The rows were held to their least height in a flex column, their
  // notes running over the next row.)
  const squeezed = await page.evaluate(() => [...document.querySelectorAll('[data-testid="lluvia-panel-laws"] button[aria-pressed]')].filter((b) => b.scrollHeight > b.clientHeight + 1).map((b) => `${b.dataset.testid} ${b.clientHeight}<${b.scrollHeight}`));
  check(`...every row as tall as its words, none running over the next (${squeezed.join(", ") || "none"})`, squeezed.length === 0);
}
await page.locator('[data-testid="lluvia-law-diagonalSlide"]').click();
await page.waitForTimeout(150);
check("Diagonal slide stands on its own (Orthogonal slide stays off)",
  (await page.locator('[data-testid="lluvia-law-slide"]').getAttribute("aria-pressed")) === "false" &&
  (await page.locator('[data-testid="lluvia-law-diagonalSlide"]').getAttribute("aria-pressed")) === "true");
// Shoving's one setting shows under it while it's on; slides only, with
// Slide on but 2 points a turn, says a shoving slide needs 3.
await page.locator('[data-testid="lluvia-law-shoving"]').click();
await page.waitForTimeout(150);
// (Slides only and only opponents by default, user, 2026-10-21; Slides
// only brings Orthogonal slide with it.)
check("Shoving shows its setting, slides only chosen, and brings Orthogonal slide",
  (await page.locator('[data-testid="lluvia-shove-settings"]').count()) === 1 &&
  (await page.locator('[data-testid="lluvia-shove-onRolls-off"]').getAttribute("aria-pressed")) === "true" &&
  (await page.locator('[data-testid="lluvia-law-slide"]').getAttribute("aria-pressed")) === "true");
check("...and all pieces or only the opponent's (only the opponent's chosen)",
  (await page.locator('[data-testid="lluvia-shove-own-off"]').getAttribute("aria-pressed")) === "true" &&
  (await page.locator('[data-testid="lluvia-shove-own-on"]').count()) === 1);
await page.locator('[data-testid="lluvia-shove-own-off"]').click();
await page.waitForTimeout(150);
check("...only the opponent's can be chosen, and the line says so (one of your own pieces in the way blocks the move)",
  (await page.locator('[data-testid="lluvia-shove-own-off"]').getAttribute("aria-pressed")) === "true" &&
  /only your opponent's pieces: one of your own pieces in the way blocks the move/.test(await page.locator('[data-testid="lluvia-shove-now"]').innerText()));
await page.locator('[data-testid="lluvia-shove-own-on"]').click();
await page.locator('[data-testid="lluvia-shove-onRolls-off"]').click();
await page.waitForTimeout(150);
check("...the choice there with slides only too (user)", (await page.locator('[data-testid="lluvia-shove-own-on"]').count()) === 1 && (await page.locator('[data-testid="lluvia-shove-own-off"]').count()) === 1);
check("...slides only can be chosen, with no callout that a shoving slide needs 3 (user: taken out)",
  (await page.locator('[data-testid="lluvia-shove-onRolls-off"]').getAttribute("aria-pressed")) === "true" &&
  (await page.locator('[data-testid="shove-needs-three"]').count()) === 0);
await page.locator('[data-testid="lluvia-shove-onRolls-on"]').click();
// Pieces behind: they block, or go along, the whole line (user: "this rule
// that can be toggled will allow you to push however many blocks are in
// the path behind it").
check("...and pieces behind: block (chosen), or pushed too",
  (await page.locator('[data-testid="lluvia-shove-chain-off"]').getAttribute("aria-pressed")) === "true" &&
  (await page.locator('[data-testid="lluvia-shove-chain-on"]').count()) === 1);
await page.locator('[data-testid="lluvia-shove-chain-on"]').click();
await page.waitForTimeout(150);
check("...pushed too, and the line says so",
  (await page.locator('[data-testid="lluvia-shove-chain-on"]').getAttribute("aria-pressed")) === "true" &&
  /pushed along too, the whole line/.test(await page.locator('[data-testid="lluvia-shove-now"]').innerText()));
await page.locator('[data-testid="lluvia-shove-chain-off"]').click();
await page.locator('[data-testid="lluvia-law-shoving"]').click();
await page.waitForTimeout(150);
check("...and switching Shoving off hides it", (await page.locator('[data-testid="lluvia-shove-settings"]').count()) === 0);
await shot(page, "5-laws");
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.locator('[data-testid="lluvia-open-topologies"]').click();
await page.waitForTimeout(300);
await page.locator('[data-testid="lluvia-size-12"]').click();
{
  // Place pieces manually here too (user: "is set out by hand in every relevant
  // menu now?"): the setup's own choice, so it's kept as the dock keeps it.
  const byHand = page.locator('[data-testid="lluvia-topo-byhand"]');
  check("Place pieces manually in the Board panel, off", (await byHand.count()) === 1 && (await byHand.getAttribute("aria-pressed")) === "false"
    && (await page.locator('[data-testid="lluvia-topo-byhalf"]').count()) === 0);
  await byHand.click();
  await page.waitForTimeout(150);
  check("...on: Anywhere in my half under it, kept as the setup's", (await byHand.getAttribute("aria-pressed")) === "true"
    && (await page.locator('[data-testid="lluvia-topo-byhalf"]').count()) === 1 && await page.evaluate(() => localStorage.getItem("el-cabeza:start-position") === "hand"));
  await byHand.click();
  await page.waitForTimeout(150);
  check("...and off again", (await byHand.getAttribute("aria-pressed")) === "false");
}
{
  // Black holes: one set or two (user: "add the option to increase the
  // number of black hole sets to 2").
  await page.locator('[data-testid="lluvia-topo-holes"]').click();
  await page.waitForTimeout(150);
  check("Black holes on: Sets under it, one chosen", (await page.locator('[data-testid="lluvia-hole-sets-1"]').getAttribute("aria-pressed")) === "true");
  await page.locator('[data-testid="lluvia-hole-sets-2"]').click();
  await page.waitForTimeout(150);
  check("...two can be chosen, and it says what that does", (await page.locator('[data-testid="lluvia-hole-sets-2"]').getAttribute("aria-pressed")) === "true"
    && /either one on the other half/.test(await page.locator('[data-testid="lluvia-hole-explain"]').innerText()));
  // The switch under two sets (user: "a toggle switch that allows them to
  // exit from any of the three other black holes on the board").
  check("...with Exit from any hole under it, off", (await page.locator('[data-testid="lluvia-topo-holeAnyExit"]').getAttribute("aria-pressed")) === "false");
  await page.locator('[data-testid="lluvia-topo-holeAnyExit"]').click();
  check("...on, and the words say any of the other three", (await page.locator('[data-testid="lluvia-topo-holeAnyExit"]').getAttribute("aria-pressed")) === "true"
    && /any of the other three/.test(await page.locator('[data-testid="lluvia-hole-explain"]').innerText()));
  await page.locator('[data-testid="lluvia-topo-holeAnyExit"]').click();
  await page.locator('[data-testid="lluvia-topo-holes"]').click();
  await page.waitForTimeout(150);
  check("...and black holes off hides it", (await page.locator('[data-testid="lluvia-hole-sets"]').count()) === 0);
}
await page.locator('[data-testid="lluvia-panel-close"]').click();
await page.waitForTimeout(150);
await page.locator('[data-testid="lluvia-opponent"]').click();
await page.waitForTimeout(200);
check("the opponent switches to the CPU", /CPU/.test(await page.locator('[data-testid="lluvia-opponent"]').textContent()));

await page.locator('[data-testid="lluvia-begin"]').click();
await page.waitForTimeout(2500);
check("BEGIN THE GAME closes the city", (await overlay.count()) === 0);
const board = await page.evaluate(() => window.__EC_TEST_BOARD__);
check(`...on the 12 × 12 board chosen (${JSON.stringify(board)})`, board && board.rows === 12 && board.cols === 12);
const pieces = await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).map((p) => p.id));
check(`...with a Rayo on each side (${pieces.length} pieces)`, pieces.includes("dark-rayo") && pieces.includes("light-rayo") && pieces.length === 12);
const status = await page.locator('[data-testid="turn-status"]').textContent();
check(`...and the game is on (${JSON.stringify(status.trim())})`, /to move|thinking/i.test(status));
await page.waitForTimeout(3000);
await shot(page, "6-game");
await page.close();

// Straight to the board: the opening can be passed, leaving a plain game.
const p2 = await open({ width: 1000, height: 820 });
await p2.locator('[data-testid="lluvia-straight-to-board"]').click();
await p2.waitForTimeout(1200);
check("'Straight to the board' passes the opening", (await p2.locator('[data-testid="lluvia-overlay"]').count()) === 0);
check("...and CUSTOM RULES brings the city back", await (async () => {
  const { openDockPanel } = await import("./dock-helpers.mjs");
  await openDockPanel(p2);
  await p2.locator('[data-testid="lluvia-custom-rules"]').click();
  await p2.waitForTimeout(800);
  return (await p2.locator('[data-testid="lluvia-overlay"]').getAttribute("data-phase")) === "city";
})());
await shot(p2, "7-desktop-city");
await p2.close();

check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures === 0 ? "\nLLUVIA E2E PASSED" : `\nLLUVIA E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
