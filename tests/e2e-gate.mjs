/* The way into a game in every reality, after the story
   (themes/reality-gate.js): two buttons, Standard Cabeza and Cabeza Nova,
   the same words everywhere and each reality's own look; Standard begins
   the classic game at once; Nova opens one scrolling menu of everything
   (who's playing, pieces, rules, board) with Reset and Play; Other
   realities in the corner of every page. Before the story's over, none of
   it. Screenshots in EC_SHOTS if set. */
import { chromium } from "playwright";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const SHOTS = process.env.EC_SHOTS || null;
const DIST = "file:///home/user/el-cabeza-project/dist/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"] });

async function open(page, { ended = true, viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1100, height: 800 } });
  await ctx.addInitScript((ended) => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      localStorage.setItem("el-cabeza:story", JSON.stringify(ended ? { owned: true, storeGone: true, ended: true } : { owned: true }));
      localStorage.setItem("el-cabeza:singularity-seen", "1"); localStorage.setItem("el-cabeza:commercial-aired", "1"); localStorage.setItem("el-cabeza:special-order-noted", "1");
      localStorage.removeItem("el-cabeza:nova-setup");
    } catch (e) { /* none */ }
  }, ended);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(DIST + page);
  return { p, ctx, errs };
}
const gateOn = (p) => poll(async () => (await p.locator('[data-testid="reality-gate"]').count()) > 0, 25000);
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/gate-${name}.png` }); };

console.log("Cromo, after the story");
{
  const { p, ctx, errs } = await open("el-cabeza-cromo.html");
  check("the two buttons as it comes up", !!(await gateOn(p)));
  check("...Standard Cabeza and Cabeza Nova, in Cromo", /standard cabeza/i.test(await p.locator('[data-testid="gate-standard"]').innerText()) && /cabeza nova/i.test(await p.locator('[data-testid="gate-nova"]').innerText()) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-world")) === "cromo");
  await p.waitForTimeout(800); await shot(p, "cromo");
  await p.locator('[data-testid="gate-standard"]').click();
  check("Standard: the game begins at once", !!(await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  check("...the five pieces each, 10 × 10", await p.evaluate(() => window.__EC_TEST_PIECES__.length === 10 && (!window.__EC_TEST_BOARD__ || (window.__EC_TEST_BOARD__.rows === 10 && window.__EC_TEST_BOARD__.cols === 10))));
  check("...and the gate's gone", (await p.locator('[data-testid="reality-gate"]').count()) === 0);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "moves" } })));
  check("its Moves card: the classic moves only", !!(await poll(async () => (await p.locator('[data-testid="rules-card-moves"]').getAttribute("data-classic")) === "true", 4000)));
  await p.keyboard.press("Escape");
  check("Other realities in the corner", (await p.locator('[data-testid="action-corner"]').count()) > 0);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Cabeza Nova: the one menu");
{
  const { p, ctx, errs } = await open("el-cabeza-cromo.html", { viewport: { width: 390, height: 844 } });
  await gateOn(p);
  await p.locator('[data-testid="gate-nova"]').click();
  check("Cabeza Nova opens the menu", !!(await poll(async () => (await p.locator('[data-testid="gate-sheet"]').count()) > 0, 4000)));
  check("...who's playing, pieces, rules, board, Reset and Play", (await p.locator('[data-testid="gate-opponent-human"]').count()) > 0 && (await p.locator('[data-testid="gate-count-codo-plus"]').count()) > 0
    && (await p.locator('[data-testid="gate-law-slide"]').count()) > 0 && (await p.locator('[data-testid="gate-size-12"]').count()) > 0
    && (await p.locator('[data-testid="gate-reset"]').count()) > 0 && (await p.locator('[data-testid="gate-play"]').count()) > 0);
  check("...each piece pictured, as Cromo draws it", !!(await poll(async () => (await p.locator('[data-testid^="gate-pic-"]').count()) === 11, 6000)));
  await p.waitForTimeout(600); await shot(p, "sheet-phone");
  await p.locator('[data-testid="gate-opponent-human"]').click();
  await p.locator('[data-testid="gate-count-codo-plus"]').click();
  await p.locator('[data-testid="gate-law-slide"]').click();
  await p.locator('[data-testid="gate-size-12"]').click();
  await p.locator('[data-testid="gate-missing"]').click();
  await p.locator('[data-testid="gate-mark-missing"]').click();
  check("missing squares: the board to mark", !!(await poll(async () => (await p.locator('[data-testid="gate-picker"]').count()) > 0, 3000)));
  await shot(p, "picker-phone");
  await p.locator('[data-testid="gate-picker-random"]').click();
  await p.locator('[data-testid="gate-picker-done"]').click();
  check("Reset back to the classic set", await (async () => {
    await p.locator('[data-testid="gate-reset"]').click();
    const v = await p.locator('[data-testid="gate-count-codo-value"]').innerText();
    return v.trim() === "0";
  })());
  await p.locator('[data-testid="gate-count-codo-plus"]').click();
  await p.locator('[data-testid="gate-law-slide"]').click();
  await p.locator('[data-testid="gate-size-12"]').click();
  await p.locator('[data-testid="gate-play"]').click();
  check("Play: the game begins", !!(await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  check("...with a Codo each, on 12 × 12", !!(await poll(() => p.evaluate(() => window.__EC_TEST_PIECES__.filter((x) => x.type === "codo").length === 2 && window.__EC_TEST_BOARD__ && window.__EC_TEST_BOARD__.rows === 12 && window.__EC_TEST_BOARD__.cols === 12), 4000)));
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "moves" } })));
  check("...its Moves card has the rest too (Slide's on)", !!(await poll(async () => (await p.locator('[data-testid="rules-card-moves"]').getAttribute("data-classic")) === "false", 4000)));
  check("...remembered for next time", await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("el-cabeza:nova-setup")); return s.counts.codo === 1 && s.laws.slide === true; }));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("before the story's over");
{
  const { p, ctx, errs } = await open("el-cabeza-cromo.html", { ended: false });
  await poll(() => p.evaluate(() => !!window.__EC_TEST_THREE__), 20000);
  await p.waitForTimeout(2500);
  check("no gate", (await p.locator('[data-testid="reality-gate"]').count()) === 0);
  check("no Other realities", (await p.locator('[data-testid="action-corner"]').count()) === 0);
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("the Lab");
{
  const { p, ctx, errs } = await open("el-cabeza-lab.html?theme=bauhaus");
  check("the gate, in Bauhaus", !!(await gateOn(p)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-world")) === "lab-bauhaus");
  await p.waitForTimeout(800); await shot(p, "lab-bauhaus");
  await p.locator('[data-testid="gate-realities"]').click();
  check("Other realities from the gate: the menu, you are here", !!(await poll(async () => /you are here/i.test(await p.locator('[data-testid="reality-lab-bauhaus"]').innerText()), 4000)));
  await p.locator('[data-testid="realities-stay"]').click();
  check("...stay: the two buttons again", !!(await poll(() => p.locator('[data-testid="gate-standard"]').isVisible(), 4000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Lluvia");
{
  const { p, ctx, errs } = await open("el-cabeza-lluvia.html");
  check("the descent opens it, as ever", !!(await poll(async () => (await p.locator('[data-testid="lluvia-descend"]').count()) > 0, 25000)));
  check("...no gate yet", (await p.locator('[data-testid="reality-gate"]').count()) === 0);
  await p.locator('[data-testid="lluvia-descend"]').click();
  await p.waitForTimeout(1500);
  await p.locator('[data-testid="lluvia-skip"]').click().catch(() => {});
  check("down in the city: the two buttons, not the signs", !!(await gateOn(p)) && (await p.locator('[data-testid="lluvia-begin"]').count()) === 0);
  await p.waitForTimeout(900); await shot(p, "lluvia");
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Nova's places");
for (const [world, name] of [["neon", "neon"], ["tienda", "store"], ["standard", "den"]]) {
  const { p, ctx, errs } = await open(`el-cabeza-nova.html?world=${world}`);
  check(`${name}: from another page, the gate there`, !!(await gateOn(p)) && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-world")) === name);
  await p.waitForTimeout(1500); await shot(p, name);
  if (name === "neon") {
    await p.locator('[data-testid="gate-nova"]').click();
    await p.waitForTimeout(700); await shot(p, "neon-sheet");
    await p.locator('[data-testid="gate-sheet-back"]').click();
    await p.locator('[data-testid="gate-standard"]').click();
    check("neon: Standard begins", !!(await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  }
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nGATE E2E FAILED (${fails})` : "\nGATE E2E PASSED");
process.exit(fails ? 1 : 0);
