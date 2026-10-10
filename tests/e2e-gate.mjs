/* The way into a game in every reality, after the story
   (themes/reality-gate.js): two buttons, Standard Cabeza and Cabeza Nova,
   the same words everywhere and each reality's own look; Standard begins
   the classic game at once; Nova opens one scrolling menu of everything
   (who's playing, pieces, rules, board) with Reset and Play; Other
   realities in the corner of every page. Before the story's over, none of
   it. Screenshots in EC_SHOTS if set. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

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

// User: after picking Standard Cabeza in a reality, "there's no way to
// go back, while still in that theme, to return to Cabeza Nova".
console.log("Cromo: back to Cabeza Nova after a Standard Cabeza game");
{
  const { p, ctx, errs } = await open("el-cabeza-cromo.html");
  await gateOn(p);
  await p.locator('[data-testid="gate-standard"]').click();
  await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000);
  await p.waitForTimeout(1200);
  const endIt = async () => { await openDockPanel(p).catch(() => {}); await p.locator('[data-testid="end-game"]').click(); };
  await endIt();
  check("a Standard Cabeza game over: Cabeza Nova among its links", !!(await poll(async () => (await p.locator('[data-testid="nova-again"]').count()) > 0, 6000)) && /cabeza nova/i.test(await p.locator('[data-testid="nova-again"]').innerText()));
  check("...and no plain-rules link (the rules are plain)", (await p.locator('[data-testid="reset-rules"]').count()) === 0);
  await p.locator('[data-testid="nova-again"]').click();
  check("...it opens Cabeza Nova's menu, in Cromo", !!(await poll(async () => (await p.locator('[data-testid="gate-sheet"]').count()) > 0 && (await p.locator('[data-testid="reality-gate"]').getAttribute("data-world")) === "cromo", 6000)));
  check("...the finished game put away", await p.evaluate(() => window.__EC_TEST_ARMED__ === false));
  await p.locator('[data-testid="gate-sheet-back"]').click();
  check("its Back: the two buttons again", !!(await poll(async () => (await p.locator('[data-testid="gate-standard"]').count()) > 0, 4000)));
  await p.locator('[data-testid="gate-standard"]').click();
  check("...Standard Cabeza from there begins", !!(await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000)));
  await p.waitForTimeout(1200);
  await endIt();
  await poll(async () => (await p.locator('[data-testid="new-game"]').count()) > 0, 6000);
  await p.locator('[data-testid="new-game"]').click();
  await openDockPanel(p).catch(() => {});
  check("New Game after it: Cabeza Nova under Begin Game", !!(await poll(async () => (await p.locator('[data-testid="nova-again-setup"]').count()) > 0, 6000)));
  await p.locator('[data-testid="nova-again-setup"]').click();
  check("...and it opens the menu too", !!(await poll(async () => (await p.locator('[data-testid="gate-sheet"]').count()) > 0, 6000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// ...and on Nova's phone layout (the bar), in its menu.
console.log("Nova on a phone, the bar: Cabeza Nova in the menu after a Standard Cabeza game");
{
  const { p, ctx, errs } = await open("el-cabeza-nova.html?world=neon", { viewport: { width: 390, height: 844 } });
  await p.evaluate(() => localStorage.setItem("el-cabeza:nova-layout", "bar"));
  await p.goto(DIST + "el-cabeza-nova.html?world=neon");
  await gateOn(p);
  await p.locator('[data-testid="gate-standard"]').click();
  await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000);
  await p.waitForTimeout(1200);
  const menuBtn = p.locator('[data-testid="shell-menu-button"]'), row = p.locator('[data-testid="shell-menu-nova-again"]');
  await menuBtn.click();
  check("the bar's menu during the game: no Cabeza Nova", !!(await poll(async () => (await p.locator('[data-testid="shell-menu-end"]').count()) > 0, 4000)) && (await row.count()) === 0);
  await p.locator('[data-testid="shell-menu-end"]').click();
  await p.locator('[data-testid="shell-menu-end"]').click();
  await p.waitForTimeout(1200);
  await menuBtn.click();
  check("the game ended: Cabeza Nova in the menu, by New game", !!(await poll(async () => (await row.count()) > 0 && (await p.locator('[data-testid="shell-menu-new"]').count()) > 0, 6000)));
  await row.click();
  check("...it opens Cabeza Nova's menu", !!(await poll(async () => (await p.locator('[data-testid="gate-sheet"]').count()) > 0, 6000)));
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
  {
    // Every rule at once, first in the sheet (user: "a switch ... at the top
    // of all custom setting menus to turn all laws on").
    const all = p.locator('[data-testid="gate-all-laws"]');
    const laws = '[data-testid^="gate-law-"][role="switch"]';
    const first = await p.evaluate(() => { const s = document.querySelector('[data-testid="gate-sheet"] .rg-body [role="switch"]'); return s && s.dataset.testid; });
    check(`All rules: the sheet's first switch, off (${first})`, first === "gate-all-laws" && (await all.getAttribute("aria-checked")) === "false");
    await all.click();
    const n = await p.locator(laws).count();
    const on = await p.$$eval(`${laws}[aria-checked="true"]`, (els) => els.map((e) => e.dataset.testid));
    check(`...on: every rule, Split movement three pieces the one split (${on.length}/${n})`, n === 8 && on.length === 7 && !on.includes("gate-law-splitMovement") && (await all.getAttribute("aria-checked")) === "true");
    // (No pivot piece in the classic five: it keeps you where you are, the
    // pivot guide's trip to the pieces held back, its note saying why.)
    await p.waitForTimeout(2200);
    const stay = await p.evaluate(() => { const r = document.querySelector('[data-testid="gate-all-laws"]').getBoundingClientRect(), b = document.querySelector('[data-testid="gate-sheet"] .rg-body').getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom + 1; });
    check("...it keeps you there, its note saying what pivoting needs", stay && /Cantilever pivot needs a Codo/.test(await p.locator('[data-testid="gate-all-laws-note"]').textContent()));
    await p.locator('[data-testid="gate-law-slide"]').click();
    check("...one rule off by hand: All rules reads off", (await all.getAttribute("aria-checked")) === "false");
    await all.click();
    check("...on again: back on", (await all.getAttribute("aria-checked")) === "true" && (await p.locator(`${laws}[aria-checked="true"]`).count()) === 7);
    await all.click();
    check("...off: none", (await p.locator(`${laws}[aria-checked="true"]`).count()) === 0 && (await all.getAttribute("aria-checked")) === "false");
  }
  check("...each piece pictured, as Cromo draws it (15, each Arco size its own)", !!(await poll(async () => (await p.locator('[data-testid^="gate-pic-"]').count()) === 15, 6000)));
  check("...the Arco Chico, Alto and Ancho each in a row of their own, no size switch", (await p.locator('[data-testid="gate-piece-arcoChico"]').count()) === 1 && (await p.locator('[data-testid="gate-piece-arcoAlto"]').count()) === 1 && (await p.locator('[data-testid="gate-piece-arcoAncho"]').count()) === 1 && (await p.locator('[data-testid^="gate-arco-"]').count()) === 0);
  await p.waitForTimeout(600); await shot(p, "sheet-phone");
  {
    // A piece's picture: the piece large, in 3D, as this world draws it
    // (user: "3D blow up piece inspections in the setup for every page").
    await p.locator('[data-testid="gate-inspect-hombro"]').scrollIntoViewIfNeeded();
    await p.locator('[data-testid="gate-inspect-hombro"]').click();
    const viewer = p.locator('[data-testid="piece-viewer"]');
    check("a piece's picture opens the piece large, in 3D", !!(await poll(async () => (await viewer.getAttribute("data-state")) === "open", 5000)) && /hombro/i.test(await p.locator('[data-testid="piece-viewer-name"]').innerText()));
    const yaw = () => p.evaluate(() => window.__EC_PIECE_VIEWER__ && window.__EC_PIECE_VIEWER__.yaw());
    // ("open" from the moment it starts to grow out of the picture: the
    // drag waits till it's done, the canvas where it stays.)
    let box = null;
    for (let i = 0, last = ""; i < 30; i++) {
      const b = await p.locator('[data-testid="piece-viewer-canvas"]').boundingBox(), k = JSON.stringify(b);
      if (b && k === last) { box = b; break; }
      last = k; await p.waitForTimeout(150);
    }
    const y0 = await yaw();
    await p.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2); await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 6 }); await p.mouse.up();
    const y1 = await yaw();
    check(`...a drag turns it (${(y1 - y0).toFixed(2)} rad)`, y1 - y0 > 1);
    await p.mouse.click(8, 8);
    check("...a tap outside puts it back", !!(await poll(async () => (await viewer.count()) === 0, 4000)));
    check("...the sheet still up", (await p.locator('[data-testid="gate-sheet"]').count()) === 1);
  }
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
  await p.locator('[data-testid="reality-lab-bauhaus"]').click();
  check("...you are here: stay, the two buttons again", !!(await poll(() => p.locator('[data-testid="gate-standard"]').isVisible(), 4000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("the store's order form: All rules, and its marked boxes");
{
  const { p, ctx, errs } = await open("el-cabeza-tienda.html", { ended: false, viewport: { width: 390, height: 844 } });
  await poll(() => p.locator('[data-testid="tienda-lid-order"]').count(), 30000);
  await p.locator('[data-testid="tienda-lid-order"]').click();
  await poll(() => p.locator('[data-testid="tienda-order"]').count(), 8000);
  await p.waitForTimeout(600);
  const all = p.locator('[data-testid="tienda-all-laws-input"]');
  const laws = 'input[data-testid^="tienda-law-"][type="checkbox"]';
  const first = await p.evaluate(() => { const c = document.querySelector('[data-testid="tienda-order"] .td-check'); return c && c.dataset.testid; });
  check(`All rules: the form's first box, unmarked (${first})`, first === "tienda-all-laws" && !(await all.isChecked()));
  await all.click({ force: true });
  const n = await p.locator(laws).count();
  const on = await p.$$eval(`${laws}:checked`, (els) => els.map((e) => e.dataset.testid));
  check(`...marked: every rule, Split movement three pieces the one split (${on.length}/${n})`, n === 8 && on.length === 7 && !on.includes("tienda-law-splitMovement-input") && (await all.isChecked()));
  await p.waitForTimeout(2200);
  const stay = await p.evaluate(() => { const r = document.querySelector('[data-testid="tienda-all-laws"]').getBoundingClientRect(), f = document.querySelector(".td-form-scroll").getBoundingClientRect(); return r.top >= f.top - 1 && r.bottom <= f.bottom + 1; });
  check("...it keeps you there, its note saying what pivoting needs", stay && /Cantilever pivot needs a Codo/.test(await p.locator('[data-testid="tienda-all-laws"]').textContent()));
  // (User, the sheet's knobs: the order form's X was small, brown and in
  // its box's corner, the notes' style outranking the box's own.)
  const x = await p.evaluate(() => {
    const b = document.querySelector('[data-testid="tienda-law-slide"] .td-box'), cs = getComputedStyle(b), r = b.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(b); const t = range.getBoundingClientRect();
    return { text: b.textContent, display: cs.display, size: cs.fontSize, dx: Math.round((t.left + t.width / 2) - (r.left + r.width / 2)), dy: Math.round((t.top + t.height / 2) - (r.top + r.height / 2)) };
  });
  check(`...each marked box's X its own size, in the middle (${JSON.stringify(x)})`, x.text === "✕" && x.display === "flex" && x.size === "26px" && Math.abs(x.dx) <= 1 && Math.abs(x.dy) <= 1);
  await all.click({ force: true });
  check("...cleared: none", (await p.locator(`${laws}:checked`).count()) === 0 && !(await all.isChecked()));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("the Lab's De Stijl: the menu's switches under its thick lines");
{
  // (User, the knobs sat low and ran out at the side under De Stijl's 6px
  // line: each knob's room inside the line, above and below it, and beside
  // it at its end, the same.)
  const { p, ctx, errs } = await open("el-cabeza-lab.html?theme=destijl", { viewport: { width: 400, height: 860 } });
  await gateOn(p);
  await p.locator('[data-testid="gate-nova"]').click();
  await poll(async () => (await p.locator('[data-testid="gate-sheet"]').count()) > 0, 4000);
  const knobs = () => p.evaluate(() => [...document.querySelectorAll(".rg-switch")].map((b) => {
    const cs = getComputedStyle(b, "::after"), line = parseFloat(getComputedStyle(b).borderTopWidth), r = b.getBoundingClientRect();
    const x = parseFloat(cs.left) + (cs.transform === "none" ? 0 : new DOMMatrix(cs.transform).m41), y = parseFloat(cs.top);
    return { id: b.dataset.testid, on: b.getAttribute("aria-checked") === "true", line, top: y, bottom: r.height - 2 * line - y - parseFloat(cs.height), left: x, right: r.width - 2 * line - x - parseFloat(cs.width) };
  }));
  const k0 = await knobs();
  const centred = (k) => Math.abs(k.top - k.bottom) < 0.5 && Math.abs((k.on ? k.right : k.left) - k.top) < 0.5;
  check(`every switch's knob centred in its ${k0[0] && k0[0].line}px line (${k0.length})`, k0.length >= 8 && k0[0].line >= 6 && k0.every(centred), JSON.stringify(k0.filter((k) => !centred(k))));
  const id = k0.find((k) => !k.on).id;
  await p.locator(`[data-testid="${id}"]`).scrollIntoViewIfNeeded();
  await p.locator(`[data-testid="${id}"]`).click();
  const k1 = await poll(async () => { const k = (await knobs()).find((q) => q.id === id); return k.on && centred(k) ? k : null; }, 4000);
  check("...switched on, it goes to the other end, centred there too", !!k1);
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

console.log("Nova's page after the story: the switcher, the last world first");
{
  const { p, ctx, errs } = await open("el-cabeza-nova.html");
  check("nothing played yet: the switcher, no Continue", !!(await poll(async () => (await p.locator('[data-testid="realities"]').count()) > 0, 20000)) && (await p.locator('[data-testid="realities-continue"]').count()) === 0);
  await p.goto(DIST + "el-cabeza-cromo.html");
  await gateOn(p);
  await p.locator('[data-testid="gate-standard"]').click();
  await poll(() => p.evaluate(() => window.__EC_TEST_ARMED__ === true), 6000);
  check("a game begun in Cromo is kept as the last world", (await p.evaluate(() => localStorage.getItem("el-cabeza:last-world"))) === "cromo");
  await p.goto(DIST + "el-cabeza-nova.html");
  const cont = p.locator('[data-testid="realities-continue"]');
  check("back on Nova's page: the switcher, Continue in Cromo first", !!(await poll(async () => (await cont.count()) > 0, 20000)) && /Cromo/.test(await cont.innerText()));
  await p.waitForTimeout(1000); await shot(p, "nova-continue");
  await cont.click();
  check("...which goes there", !!(await poll(async () => /el-cabeza-cromo\.html/.test(p.url()), 8000)));
  check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nGATE E2E FAILED (${fails})` : "\nGATE E2E PASSED");
process.exit(fails ? 1 : 0);
