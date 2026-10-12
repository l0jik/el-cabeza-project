/* After a game the corner piece calls (user: "When a game ends, and the
   user is using the regular, 3D button, have the minimized / badge version
   become highlighted whilst in the bottom-right corner, to help guide the
   user to open to see other options... in Noir, the badge size piece can
   become lost visually"). chassis/ElCabeza3D.jsx dockCall: at full
   strength, a breathing pool of its world's light behind it, the piece
   glowing and hopping now and then, till the dock's been opened; not in
   play; not again after it's been opened, till the next game's over.

   node tests/e2e-dock-call.mjs */
import { chromium } from "playwright";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };

// The corner piece's state, the light behind it and the piece's own glow.
const callState = (page) => page.evaluate(() => {
  const m = document.querySelector("[data-dock-piece]");
  const a = document.querySelector('[data-testid="dock-call-aura"]');
  const c = m && m.querySelector("canvas");
  const mr = m && m.getBoundingClientRect(), ar = a && a.getBoundingClientRect();
  const as = a && getComputedStyle(a);
  return {
    call: m ? m.dataset.dockCall === "true" : null,
    opacity: m ? +getComputedStyle(m).opacity : null,
    aura: !!a && as.display !== "none" && +as.opacity > 0.2,
    glow: a ? a.style.getPropertyValue("--ec-dock-glow").trim() : null,
    // (Centre to centre, the light on the piece's box.)
    off: a && mr ? Math.round(Math.hypot(ar.left + ar.width / 2 - (mr.left + mr.width / 2), ar.top + ar.height / 2 - (mr.top + mr.height / 2))) : null,
    halo: c ? getComputedStyle(c).animationName : null,
    filter: c ? getComputedStyle(c).filter : null,
  };
});
// How far the piece's height strays from its own size over a few seconds
// (the hop squashes and stretches it).
const hopRange = (page, ms) => page.evaluate((ms) => new Promise((done) => {
  const d = window.__EC_TEST_DOCK__ && window.__EC_TEST_DOCK__();
  if (!d) return done(null);
  const base = d.state.pieceBaseScale || 1;
  let most = 0;
  const end = performance.now() + ms;
  const look = () => {
    most = Math.max(most, Math.abs(d.pieceGroup.scale.y / base - 1));
    if (performance.now() < end) requestAnimationFrame(look); else done(+most.toFixed(3));
  };
  look();
}), ms);
// Whoever's to move wins in one step (their Cabeza a step from its far row).
async function winNow(page) {
  const dark = (await page.locator('[data-testid="turn-status"]').getAttribute("data-side")) === "dark";
  await page.evaluate((dark) => window.__EC_TEST_SET_PIECES__([
    { id: "dark-cabeza", type: "cabeza", owner: "dark", row: dark ? 8 : 4, col: 4, w: 1, h: 1, z: 1 },
    { id: "dark-turrito", type: "turrito", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
    { id: "light-cabeza", type: "cabeza", owner: "light", row: dark ? 5 : 1, col: 6, w: 1, h: 1, z: 1 },
    { id: "light-turrito", type: "turrito", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
  ]), dark);
  await page.waitForTimeout(300);
  await page.evaluate((dark) => window.__EC_TEST_MOVE__(dark ? "dark-cabeza" : "light-cabeza", dark ? "S" : "N"), dark);
  return poll(async () => (await page.locator('[data-testid="victory-backdrop"]').getAttribute("data-open")) === "true", 8000);
}
// The placard put away with Escape, once it's all the way up (as anyone
// sees it before they press). GitHub's run 25 pressed the moment it
// opened and it stayed (an Escape 700 ms on, later, took); not seen here.
// So the keys and the placard are noted, to say where it went if it ever
// stays again.
async function putAway(page) {
  const card = '[data-testid="victory-backdrop"]';
  await poll(() => page.evaluate((card) => getComputedStyle(document.querySelector(card)).opacity === "1", card), 3000);
  await page.evaluate((card) => {
    const t0 = performance.now(), b = document.querySelector(card);
    window.__ESC_NOTES__ = [`0ms open=${b.dataset.open}`];
    window.addEventListener("keydown", (e) => window.__ESC_NOTES__.push(`${Math.round(performance.now() - t0)}ms ${e.key} (open=${b.dataset.open})`), { capture: true, once: true });
    new MutationObserver(() => window.__ESC_NOTES__.push(`${Math.round(performance.now() - t0)}ms open=${b.dataset.open}`)).observe(b, { attributes: true, attributeFilter: ["data-open"] });
  }, card);
  await page.keyboard.press("Escape");
  const gone = await poll(async () => (await page.locator(card).getAttribute("data-open")) === "false", 4000);
  return { gone: !!gone, notes: await page.evaluate(() => window.__ESC_NOTES__) };
}
// Human against human (nobody else moves), Begin Game, into the corner.
async function begin(page) {
  await openDockPanel(page);
  const human = page.locator('[data-testid="dock-panel"] button', { hasText: /^Human$/ }).first();
  if (await human.count()) { await human.click(); await page.waitForTimeout(300); }
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game/ }).first().click();
  return waitForDockCorner(page, { timeoutMs: 15000 });
}
async function open(name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const [file, q] = name.split("?");
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${file}.html${q ? "?" + q : ""}`);
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

// ---- Noir, the whole of it ----
{
  console.log("noir");
  const { ctx, page, errs } = await open("noir");
  let corner = await begin(page);
  check("a game begun: the piece in its corner", !!corner);
  // (Polled: the corner's fade to its watermark can be under way still.)
  let s = await poll(async () => { const v = await callState(page); return v.opacity < 0.9 ? v : null; }, 4000) || await callState(page);
  check("in play: no call, the corner's faint watermark", s.call === false && !s.aura && s.opacity < 0.9 && s.halo === "none", JSON.stringify(s));
  check("a game won: the placard", await winNow(page));
  const away = await putAway(page);
  check("...put away", away.gone, JSON.stringify(away.notes));
  s = await poll(async () => { const v = await callState(page); return v.call && v.opacity > 0.99 ? v : null; }, 4000) || await callState(page);
  check("after it: the corner piece calls, at full strength", s.call === true && s.opacity > 0.99, JSON.stringify(s));
  check("...in a pool of Noir's light (a lamp's, a lit window's), centred on it", s.aura && /^#(ffffff|c8c8c8)$/i.test(s.glow) && s.off !== null && s.off <= 3, JSON.stringify(s));
  check("...the piece glowing at its edge", s.halo === "ecDockCallHalo" && /drop-shadow/.test(s.filter), JSON.stringify({ halo: s.halo, filter: s.filter }));
  const hop = await hopRange(page, 6000);
  check("...and hopping now and then", hop !== null && hop > 0.04, String(hop));
  corner = await waitForDockCorner(page, { timeoutMs: 3000 });
  check("a tap on it: the dock opens", await reopenDockPanelFromCorner(page, corner));
  s = await callState(page);
  check("...the call gone with it", s.call === false && !s.aura, JSON.stringify(s));
  await page.mouse.click(640, 60);
  await page.waitForTimeout(700);
  if ((await page.locator('[data-testid="victory-backdrop"]').getAttribute("data-open")) === "true") { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
  s = await poll(async () => { const v = await callState(page); return v.opacity < 0.9 ? v : null; }, 4000) || await callState(page);
  check("put away again: the plain watermark (found once, it doesn't call again)", s.call === false && !s.aura && s.opacity < 0.9 && s.halo === "none", JSON.stringify(s));
  const still = await hopRange(page, 5500);
  check("...and no more hops", still !== null && still < 0.01, String(still));
  // The next game: none in play; ended from the open dock, none after
  // (it was open when the game ended).
  await reopenDockPanelFromCorner(page, await waitForDockCorner(page, { timeoutMs: 3000 }));
  await page.locator('[data-testid="new-game"]').click();
  await page.waitForTimeout(600);
  corner = await begin(page);
  s = await callState(page);
  check("the next game: no call in play", !!corner && s.call === false && !s.aura, JSON.stringify(s));
  await reopenDockPanelFromCorner(page, corner);
  await page.locator('[data-testid="end-game"]').click();
  await page.waitForTimeout(600);
  await page.mouse.click(640, 60);
  await page.waitForTimeout(900);
  s = await callState(page);
  check("ended from the open dock, then put away: no call (it was open as it ended)", s.call === false && !s.aura, JSON.stringify(s));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- Noir for a reader who wants no motion ----
{
  console.log("noir, reduced motion");
  const { ctx, page, errs } = await open("noir", { reducedMotion: "reduce" });
  await begin(page);
  await winNow(page);
  const away = await putAway(page);
  check("the placard put away", away.gone, JSON.stringify(away.notes));
  const s = await poll(async () => { const v = await callState(page); return v.call && v.opacity > 0.99 ? v : null; }, 5000) || await callState(page);
  check("the call, still: the light and the glow, no breathing", s.call === true && s.aura && s.halo === "none" && /drop-shadow/.test(s.filter), JSON.stringify(s));
  const hop = await hopRange(page, 5500);
  check("...and no hops", hop !== null && hop < 0.01, String(hop));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- other worlds: their own light, and one that shows there ----
// (The Lab's Swiss Design: white on its white page can't be seen, so its
// red, whichever side's piece; Parrish names its own, its ash, candlelight
// on the painting: theme.dockCallGlow.)
for (const [name, glows] of [["standard", /^#(ff8a2a|ffd98a)$/i], ["neon", /^#(4de8ff|ffb454)$/i], ["lab", /^#e63946$/i], ["parrish?look=orinoco", /^#d9b77e$/i], ["parrish?look=watermark", /^#d4a86c$/i]]) {
  console.log(name);
  const { ctx, page, errs } = await open(name);
  await begin(page);
  await winNow(page);
  const away = await putAway(page);
  check("the placard put away", away.gone, JSON.stringify(away.notes));
  const s = await poll(async () => { const v = await callState(page); return v.call && v.opacity > 0.99 ? v : null; }, 5000) || await callState(page);
  check(`after a game: the corner piece calls, in its world's light (${s.glow})`, s.call === true && s.aura && glows.test(s.glow || "") && s.off !== null && s.off <= 3, JSON.stringify(s));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
