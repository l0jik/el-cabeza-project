/* Rings, the dock's menu (chassis/menu-fan.js; user, of the menu lab's
   five turning fans: "I like rings", then, asked what next: "Replace the
   dock everywhere"). With no lab: a tap on the piece brings Rings out
   round it, not the panel, in every phase; its settings press the panel's
   own buttons, and the panel opens only for Online's own page.

   On a phone in the store: out from the piece before a game (every
   setting, Try a Game over it); Level's choices; Online opens the panel;
   Try a Game begins the game. In play: the corner piece brings it out
   (brought to the middle); a touch held on the corner piece opens it and
   its lifting doesn't put it away again; End game asks twice. After the
   game: the corner piece's call answered, New game over it. A new
   player's first look holds back what the panel holds back. On a
   desktop (Noir): a click, the mouse wheel, Escape, and the mouse
   brought onto the corner piece in play.

   Then (user: "I'm still with the fans. I want to combine rings and
   fans. make sure that the rings and all that can be scrolled by rolling
   a mouse wheel too."): Rings opens like the lab's first Fan, its
   settings and kinds folded at the top, opening out to their places; the
   wheel turns it a setting a notch (a small smooth roll and a Firefox
   line notch too), a quick spin as many, a kind a notch over the inner
   ring, never with Ctrl (a pinch).

   In play, who's who (user: "When I open this menu mid-game, I want to
   know who I am... it has to be either dark or light... what level the
   AI is set to... when you hit game... immediately shows you that
   information"): the side to move with its colour, you and the
   computer's level under it, You first and at the point; Game turns back
   to it. Futuris's Anomaly from Rings keeps Rings out (user: "It should
   just keep the menu open"), a new layout a tap.

   node tests/e2e-rings.mjs */
import { chromium } from "playwright";
import { waitForDockCorner } from "./dock-helpers.mjs";

const NOVA = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const NOIR = "file:///home/user/el-cabeza-project/dist/el-cabeza-noir.html";
const FUTURIS = "file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const poll = async (fn, ms = 15000, step = 200) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};

async function store({ toured = true, lang = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ toured }) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try { if (toured) localStorage.setItem("el-cabeza:first-game-tour", "done"); } catch (e) { /* none */ }
  }, { toured });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(lang ? `${NOVA}?lang=${lang}` : NOVA);
  await page.waitForSelector('[data-testid="tienda-open-box"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tienda-open-box"]').tap();
  await poll(async () => (await page.locator('[data-testid="tienda-lid"]').count()) === 0, 10000);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

// Rings as it is: out, still, its phase, its settings, the one at its
// point, the read-out, the big button, whose move.
const rings = (page) => page.evaluate(() => {
  const layer = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const stage = layer && layer.querySelector('[data-testid="menu-fan"]');
  if (!stage) return null;
  const focus = layer.querySelector("[data-ml-item].mf-focus");
  const primary = layer.querySelector('[data-testid="menu-fan-primary"]');
  const head = layer.querySelector('[data-testid="menu-fan-head"]');
  return {
    version: layer.getAttribute("data-version"), fan: stage.getAttribute("data-fan"), phase: layer.getAttribute("data-phase"),
    still: getComputedStyle(stage).opacity === "1" && stage.getAttribute("data-turning") === "false",
    keys: [...layer.querySelectorAll("[data-ml-item]")].map((n) => n.getAttribute("data-ml-item")),
    focus: focus ? focus.getAttribute("data-ml-item") : null,
    read: (layer.querySelector('[data-testid="menu-fan-read"]') || {}).textContent || "",
    primary: primary && primary.style.display !== "none" ? primary.textContent.trim() : null,
    head: head && head.style.display !== "none" ? head.textContent.trim() : "",
  };
});
const out = async (page) => { const r = await rings(page); return r && r.still ? r : null; };
// The angle each of Rings' settings is drawn at, as Rings is first laid
// out (watched from before the tap), and now.
const watchOpening = (page) => page.evaluate(() => {
  window.__ringsFirst = null;
  const angles = () => [...document.querySelectorAll('[data-testid="dock-menu"] .mf-w')].map((g) => +((g.getAttribute("transform") || "").match(/rotate\((-?[\d.]+)/) || [0, NaN])[1]);
  const mo = new MutationObserver(() => {
    const a = angles();
    if (!window.__ringsFirst && a.length && a.every((x) => !isNaN(x))) { window.__ringsFirst = a; mo.disconnect(); }
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["transform"] });
  window.__ringsAngles = angles;
});
const panelOpen = (page) => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]').dataset.open === "true");
const pieceBox = (page) => page.locator('canvas[data-testid="dock-piece-canvas"]').boundingBox();
// The piece tapped till Rings is out (a tap can land while it bounces).
async function openRings(page, touch = true) {
  for (let i = 0; i < 4; i++) {
    if (await rings(page)) break;
    const b = await pieceBox(page);
    if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    if (await poll(() => rings(page), 2500, 100)) break;
  }
  return poll(() => out(page), 6000, 150);
}
const away = (page) => poll(async () => !(await page.evaluate(() => !!document.querySelector('[data-testid="dock-menu"][data-open="true"]'))), 3000, 100);
// A setting tapped where its name is (on the wedge under it).
async function tapSetting(page, key, touch = true) {
  const b = await page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-label="${k}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, key);
  if (!b) return false;
  if (touch) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  return true;
}
// A setting's choices out in the read-out: its name tapped once Rings is
// still (again if the tap found it turning).
async function choicesOf(page, key, touch = true) {
  for (let i = 0; i < 3; i++) {
    await poll(() => out(page), 4000, 100);
    if (!(await tapSetting(page, key, touch))) continue;
    const ok = await poll(async () => { const r = await rings(page); return !!r && r.focus === key && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-ctl"] [data-mf-choice]').count()) > 0; }, 3000, 100);
    if (ok) return true;
  }
  return false;
}
// Rings' line over the lit kind: its kind and ends; the lit kind's
// settings in sight and the others' (as drawn: 30° apart, each 28° wide,
// the window -180° to 0°); whether it runs edge to edge over the lit
// kind's and clear of every other's; its blue, the lit kind's edge, and
// any of the old place-marks left.
const groupLine = (page) => page.evaluate(() => {
  const L = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const g = L && L.querySelector("[data-mf-group]");
  if (!g || g.style.display === "none") return null;
  const kind = g.getAttribute("data-mf-group"), a0 = +g.getAttribute("data-a0"), a1 = +g.getAttribute("data-a1");
  const lit = L.querySelector(".mf-kind.mf-on");
  const ws = [...L.querySelectorAll(".mf-w")]
    .map((w) => ({ key: w.getAttribute("data-mf-key"), kind: w.getAttribute("data-mf-of"), a: +((w.getAttribute("transform") || "").match(/rotate\((-?[\d.]+)/) || [0, NaN])[1], op: +(w.getAttribute("opacity") || 1) }))
    .filter((w) => w.op > 0.02 && w.a > -194 && w.a < 14);
  const lo = (x) => Math.max(-180, x), hi = (x) => Math.min(0, x);
  const mine = ws.filter((w) => w.kind === kind), others = ws.filter((w) => w.kind !== kind);
  const exact = mine.length > 0 && Math.abs(a0 - lo(Math.min(...mine.map((w) => w.a - 14)))) < 0.3 && Math.abs(a1 - hi(Math.max(...mine.map((w) => w.a + 14)))) < 0.3;
  const clear = others.every((w) => hi(w.a + 14) <= a0 + 0.3 || lo(w.a - 14) >= a1 - 0.3);
  return {
    kind, a0, a1, lit: lit && lit.getAttribute("data-mf-kind"), mine: mine.map((w) => w.key), exact, clear,
    stroke: getComputedStyle(g.querySelector(".mf-group-line")).stroke, litStroke: lit ? getComputedStyle(lit.querySelector("path")).stroke : null,
    marks: L.querySelectorAll("[data-mf-track], [data-mf-thumb]").length,
  };
});
// Rings' kind names: each laid along its own piece of the inner ring, its
// first letter to its last inside the piece (by angle round the hub, and
// between the ring's edges, 62 to 100 px out), bold.
const kindNames = (page) => page.evaluate(() => {
  const L = document.querySelector('[data-testid="dock-menu"][data-open="true"]');
  const svg = L && L.querySelector("svg.mf-ring");
  if (!svg) return null;
  const [cx, cy] = svg.getAttribute("data-hub").split(" ").map(Number);
  const at = (p) => ({ a: (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI, r: Math.hypot(p.x - cx, p.y - cy) });
  return [...L.querySelectorAll(".mf-kind")].map((g) => {
    const txt = g.querySelector("text"), n = txt.getNumberOfChars();
    const s = at(txt.getStartPositionOfChar(0)), e = at(txt.getEndPositionOfChar(n - 1));
    const a0 = +g.getAttribute("data-a0"), a1 = +g.getAttribute("data-a1");
    const inside = s.a >= a0 + 0.5 && e.a <= a1 - 0.5 && [s.r, e.r].every((r) => r > 62 && r < 100);
    return { kind: g.getAttribute("data-mf-kind"), name: txt.textContent, onArc: !!txt.querySelector("textPath"), inside, bold: +getComputedStyle(txt).fontWeight >= 700, from: Math.round(s.a), to: Math.round(e.a), piece: `${a0}..${a1}` };
  });
});
const SETUP = ["first", "opponent", "level", "start", "pieces", "cart", "check", "points", "costs", "guide", "sound", "language", "replay", "saves", "bar"];

console.log("The store, on a phone: Rings is the menu");
{
  const { ctx, page, errs } = await store();
  await watchOpening(page);
  let r = await openRings(page);
  check("a tap on the piece: Rings out round it, not the panel", !!r && r.fan === "rings" && r.version === "4.2" && r.phase === "setup" && !(await panelOpen(page)), JSON.stringify(r));
  const [first, settled] = await page.evaluate(() => [window.__ringsFirst, window.__ringsAngles()]);
  const span = (a) => (a && a.length ? Math.max(...a) - Math.min(...a) : NaN);
  check("...it opens like a fan: its settings folded at the top, then open out to their places", !!first && first.every((a) => Math.abs(a + 90) < 2) && span(settled) > 170, `${first && first.map(Math.round).join()} → ${settled.map(Math.round).join()}`);
  check("...every setting the panel has before a game", !!r && SETUP.every((k) => r.keys.includes(k)), r && r.keys.join());
  check("...Try a Game over it, the first move at its point, named and said", !!r && /try a game/i.test(r.primary || "") && r.focus === "first" && /First move/i.test(r.read) && /Which side makes the first move/.test(r.read), JSON.stringify(r));
  // The line over the lit kind's settings (user, of the place-marks, which
  // ran on over the next kind's: "It needs to only span the specific
  // wedges that pertain to that piece ... maybe give it that blue glow
  // outline"): edge to edge over those and clear of the rest, in the
  // Singularity's blue, the lit kind outlined in it; turned on into
  // another kind, it goes over that kind's.
  {
    let g = await groupLine(page);
    // The kinds' names (user, of SETTINGS set straight across and sticking
  // out of its piece: "can be arced or arched to where they fit into the
  // button better ... Maybe make those in bold"): along their pieces,
  // inside them, bold.
  {
    const names = await kindNames(page);
    check(`the inner ring's names run along their pieces, inside them, bold (${names && names.map((x) => `${x.name} ${x.from}..${x.to} in ${x.piece}`).join("; ")})`, !!names && names.length === 4 && names.every((x) => x.onArc && x.inside && x.bold), JSON.stringify(names));
  }
  check(`the lit kind's line: over Game's settings only, edge to edge (${g && `${g.mine.join()} ${g.a0}..${g.a1}`})`, !!g && g.kind === "game" && g.lit === "game" && g.exact && g.clear && g.mine.includes("first") && !g.mine.includes("start"), JSON.stringify(g));
    check("...in the Singularity's blue, the lit kind outlined in it, no place-marks", !!g && g.stroke === "rgb(180, 240, 255)" && g.litStroke === "rgb(155, 233, 255)" && g.marks === 0, JSON.stringify(g));
    for (let i = 0; i < 8 && (await rings(page) || {}).focus !== "start"; i++) {
      await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-next"]').tap();
      await poll(() => out(page), 3000, 100);
    }
    g = await poll(async () => { const x = await groupLine(page); return x && x.kind === "board" ? x : null; }, 3000, 100);
    check(`...turned to Start: over Board's settings, from Start on, and no others (${g && `${g.mine.join()} ${g.a0}..${g.a1}`})`, !!g && g.lit === "board" && g.exact && g.clear && g.mine[0] === "start" && g.mine.includes("pieces") && !g.mine.includes("level") && !g.mine.includes("check"), JSON.stringify(g));
  }
  // Level: its choices, Medium.
  check("a tap on Level: turned to it, its choices in the read-out", (await choicesOf(page, "level")) && (await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-ctl"] [data-mf-choice]').count()) === 3);
  const medium = await page.locator('[data-testid="dock-menu"] [data-mf-choice="medium"]').boundingBox();
  await page.touchscreen.tap(medium.x + medium.width / 2, medium.y + medium.height / 2);
  check("...Medium chosen is the panel's Medium, Rings still out", !!(await poll(() => page.evaluate(() => document.querySelector('[data-ec-diff="medium"]').getAttribute("aria-pressed") === "true"), 3000, 100)) && !!(await rings(page)));
  // A tap outside puts it away; the piece back where it rests.
  await page.touchscreen.tap(12, 300);
  check("a tap outside puts it away", !!(await away(page)));
  check("...the piece back where it rests", !!(await poll(() => page.evaluate(() => document.querySelector("[data-dock-piece]").style.transform === "translateX(-50%) scale(1)"), 3000, 100)));
  await page.waitForTimeout(800);
  // Online: its own page is the panel's.
  r = await openRings(page);
  await choicesOf(page, "opponent");
  const on = await page.locator('[data-testid="dock-menu"] [data-mf-choice="online"]').boundingBox();
  await page.touchscreen.tap(on.x + on.width / 2, on.y + on.height / 2);
  check("Opponent, Online: Rings away, the panel open on Online's own page", !!(await poll(async () => (await panelOpen(page)) && !(await rings(page)), 5000, 100)));
  // (Put away by a tap outside; again if the tap came before the panel,
  // just open, was listening for it.)
  for (let i = 0; i < 3 && (await panelOpen(page)); i++) {
    await page.waitForTimeout(400);
    await page.touchscreen.tap(12, 300);
    await poll(async () => !(await panelOpen(page)), 2000, 100);
  }
  await page.waitForTimeout(800);
  // Online's page left in the panel: Rings still has who to play, and
  // takes the player back to the computer from there.
  r = await openRings(page);
  const opp = await choicesOf(page, "opponent");
  check("...put away, Rings still has the opponent, Online's page left in the panel", opp && !!(await page.evaluate(() => !!document.querySelector('[data-testid="online-panel"]'))), JSON.stringify(await rings(page)));
  const ai = opp && (await page.locator('[data-testid="dock-menu"] [data-mf-choice="ai-dark"]').boundingBox());
  if (ai) await page.touchscreen.tap(ai.x + ai.width / 2, ai.y + ai.height / 2);
  check("...the computer picked from Rings: Online's page gone, the computer's levels in the panel, Rings says so", !!ai && !!(await poll(async () => (await page.evaluate(() => !document.querySelector('[data-testid="online-panel"]') && !!document.querySelector("[data-ec-diff]"))) && /AI · /.test((await rings(page) || {}).read || ""), 4000, 100)), JSON.stringify(await rings(page)));
  await page.waitForTimeout(800);
  if (!(await rings(page))) r = await openRings(page);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').tap();
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Try a Game from Rings: the game begun, the piece in its corner, Rings away", !!corner && !(await rings(page)) && (await page.evaluate(() => document.querySelector("[data-dock-piece]").style.left === "calc(100% - 108px)")), JSON.stringify(corner));
  await page.waitForTimeout(1500);
  // In play: the corner piece; a touch held on it.
  const cdp = await ctx.newCDPSession(page);
  const cb = await pieceBox(page);
  const at = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
  await page.waitForTimeout(1300);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  r = await poll(() => out(page), 6000, 150);
  check("in play, a touch held on the corner piece: Rings out (the piece brought to the middle), and its lifting doesn't put it away", !!r && r.phase === "play" && (await page.evaluate(() => /translate\(calc\(-50% \+ 0px\)/.test(document.querySelector("[data-dock-piece]").style.transform) || document.querySelector("[data-dock-piece]").style.left !== "calc(100% - 108px)")), JSON.stringify(r));
  await page.waitForTimeout(1200);
  check("...still out a moment on", !!(await rings(page)));
  check("...in play's own: End game, the view, the hints, whose move on top", !!r && ["endgame", "view", "check", "language"].every((k) => r.keys.includes(k)) && !r.keys.includes("first") && /to move/i.test(r.head), JSON.stringify(r));
  // Who's who: the side to move with its colour, you and the computer's
  // level under it, and You first, at the point as it opens.
  check("...who you are first, at its point: You, Ash (light), the computer and its level said", !!r && r.keys[0] === "you" && r.focus === "you" && /You\s*Ash \(light\)/.test(r.read) && /You play Ash \(light\)\. The computer plays Walnut \(dark\), on (Easy|Medium|Hard)\./.test(r.read) && /Ash \(light\) to move/.test(r.head) && /You: Ash \(light\) · Computer: (Easy|Medium|Hard)/.test(r.head), JSON.stringify(r));
  for (let i = 0; i < 2; i++) { await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-next"]').tap(); await page.waitForTimeout(350); }
  await poll(async () => { const x = await out(page); return x && x.focus !== "you" ? x : null; }, 3000, 100);
  const gameKind = await page.evaluate(() => { const n = document.querySelector('[data-testid="dock-menu"] [data-mf-kind="game"] path'); const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.touchscreen.tap(gameKind.x, gameKind.y);
  r = await poll(async () => { const x = await out(page); return x && x.focus === "you" ? x : null; }, 4000, 150);
  check("...turned away, a tap on Game: back to You, said in the read-out", !!r && /The computer plays Walnut \(dark\), on (Easy|Medium|Hard)\./.test(r.read), JSON.stringify(r));
  await page.touchscreen.tap(12, 300);
  await away(page);
  await page.waitForTimeout(1000);
  // End game, twice.
  r = await openRings(page);
  // (turned to it with ›: a tap off the point turns to it and presses it at once; You is first now)
  for (let i = 0; i < 12 && r && r.focus !== "endgame"; i++) { await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-next"]').tap(); r = await poll(() => out(page), 3000, 100); }
  await tapSetting(page, "endgame");
  check("End game asks first", !!(await poll(async () => /again to be sure/i.test((await rings(page)).read), 3000, 100)));
  await tapSetting(page, "endgame");
  check("...the second tap ends it, Rings away", !!(await poll(async () => !(await rings(page)) && (await page.evaluate(() => !!document.querySelector('[data-testid="new-game"]'))), 6000, 100)));
  await page.waitForTimeout(2500);
  // After: the call answered.
  check("after the game, the corner piece calls", await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall === "true"));
  r = await openRings(page);
  const ng = await page.evaluate(() => document.querySelector('[data-testid="new-game"]').textContent.replace(/[^a-z]/gi, "").toLowerCase());
  check("...Rings out from it: New game over it (the store's own words), who to play next, the call answered", !!r && r.phase === "over" && !!r.primary && r.primary.replace(/[^a-z]/gi, "").toLowerCase() === ng && r.keys.includes("opponent") && (await page.evaluate(() => document.querySelector("[data-dock-piece]").dataset.dockCall !== "true")), JSON.stringify(r));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Futuris, on a phone: Anomaly from Rings");
{
  // (user: "when you click anomaly, it closes the menu and immediately
  // starts... It should just keep the menu open.")
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(FUTURIS);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  let r = await openRings(page);
  const named = await page.evaluate(() => { const n = document.querySelector('[data-testid="dock-menu"] [data-ml-item="pieces"]'); return n && n.getAttribute("aria-label"); });
  for (let i = 0; i < 12 && r && r.focus !== "pieces"; i++) { await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-next"]').tap(); r = await poll(() => out(page), 3000, 100); }
  check("Rings out, Anomaly among the board's settings, turned to", !!r && named === "Anomaly" && r.focus === "pieces", `${named} ${JSON.stringify(r)}`);
  const layout = () => page.evaluate(() => JSON.stringify((window.__EC_TEST_PIECES__ || []).map((p) => [p.id, p.row, p.col])));
  let was = await layout();
  await tapSetting(page, "pieces");
  r = await poll(async () => { const x = await rings(page); return x && /new layout/i.test(x.read) ? x : null; }, 4000, 100);
  check("...a tap: a new layout, Rings still out, saying so", !!r && (await layout()) !== was, JSON.stringify(r));
  was = await layout();
  await page.waitForTimeout(600);
  await tapSetting(page, "pieces");
  check("...and again: another, still out", !!(await poll(async () => (await layout()) !== was && !!(await rings(page)), 4000, 100)));
  check("...the game not begun", ((await rings(page)) || {}).phase === "setup");
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("A new player's first look");
{
  const { ctx, page, errs } = await store({ toured: false });
  const r = await openRings(page);
  const held = (k) => page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-ml-item="${k}"]`); return n ? n.getAttribute("aria-disabled") === "true" : null; }, k);
  check("Rings out, Try a Game and See the pieces pressable", !!r && (await held("pieces")) === false && /try a game/i.test(r.primary || ""));
  check("...the level and the cart held back, as in the panel", (await held("level")) === true && (await held("cart")) === true);
  await tapSetting(page, "level");
  check("...a tap on the level: not now, said so, nothing changed", !!(await poll(async () => /Not available right now/.test((await rings(page)).read), 3000, 100)) && (await page.evaluate(() => document.querySelector('[data-ec-diff="easy"]').getAttribute("aria-pressed") === "true")));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("Noir, on a desktop");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(NOIR);
  await page.waitForSelector('canvas[data-testid="dock-piece-canvas"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  let r = await openRings(page, false);
  check("a click on the piece: Rings out", !!r && r.fan === "rings" && !(await panelOpen(page)), JSON.stringify(r));
  // The wheel: how many settings along it went (round the ring).
  const along = (a, b) => { const n = r.keys.length, i = r.keys.indexOf(a), j = r.keys.indexOf(b); return (((j - i) % n) + n + Math.floor(n / 2)) % n - Math.floor(n / 2); };
  const wheeled = async (fn) => {
    const a = (await poll(() => out(page), 4000, 100)) || {};
    await fn();
    await page.waitForTimeout(400);
    const b = (await poll(() => out(page), 4000, 100)) || {};
    return { n: a.focus && b.focus ? along(a.focus, b.focus) : NaN, from: a.focus, to: b.focus, kind: await page.evaluate(() => (document.querySelector('[data-testid="dock-menu"] .mf-kind.mf-on') || { getAttribute: () => null }).getAttribute("data-mf-kind")) };
  };
  const at = (x, y, o) => page.evaluate(({ x, y, o }) => { const t = document.elementFromPoint(x, y); for (const d of [].concat(o)) t.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: x, clientY: y, ...d })); }, { x, y, o });
  await page.mouse.move(640, 560);
  let w = await wheeled(() => page.mouse.wheel(0, 100));
  check("...the mouse wheel: a notch turns it one setting", w.n === 1, JSON.stringify(w));
  w = await wheeled(() => page.mouse.wheel(0, -100));
  check("...a notch back, one back", w.n === -1, JSON.stringify(w));
  w = await wheeled(() => page.mouse.wheel(0, 4));
  check("...a small smooth roll (a Mac's wheel) still turns one", w.n === 1, JSON.stringify(w));
  w = await wheeled(() => at(640, 560, { deltaY: 3, deltaMode: 1 }));
  check("...a line notch (Firefox's) turns one", w.n === 1, JSON.stringify(w));
  w = await wheeled(() => at(640, 560, [{ deltaY: 100 }, { deltaY: 100 }, { deltaY: 100 }]));
  check("...a quick spin of three notches, three", w.n === 3, JSON.stringify(w));
  w = await wheeled(() => at(640, 560, Array.from({ length: 20 }, () => ({ deltaY: 10 }))));
  check("...a trackpad's stream (200 px), two", w.n === 2, JSON.stringify(w));
  w = await wheeled(async () => { await page.keyboard.down("Control"); await page.mouse.wheel(0, 100); await page.keyboard.up("Control"); });
  check("...with Ctrl (a pinch) it stays", w.n === 0, JSON.stringify(w));
  const kindAt = (k) => page.evaluate((k) => { const n = document.querySelector(`[data-testid="dock-menu"] [data-mf-kind="${k}"] path`); const b = n.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, k);
  const [kx, ky] = await kindAt("board");
  await page.mouse.move(kx, ky);
  // (the setting at the point, its kind, and whether it's its kind's first)
  const firstOf = () => page.evaluate(() => {
    const ws = [...document.querySelectorAll('[data-testid="dock-menu"] .mf-w')], f = ws.findIndex((g) => g.classList.contains("mf-focus"));
    if (f < 0) return "none";
    const k = ws[f].getAttribute("data-mf-of"), lit = (document.querySelector('[data-testid="dock-menu"] .mf-kind.mf-on') || { getAttribute: () => "" }).getAttribute("data-mf-kind");
    return `${k}${k === lit ? "" : "(lit " + lit + ")"}${ws[(f - 1 + ws.length) % ws.length].getAttribute("data-mf-of") !== k ? "" : " (not its first)"}`;
  });
  const kinds = [];
  for (let i = 0; i < 4; i++) { await wheeled(() => page.mouse.wheel(0, 100)); kinds.push(await firstOf()); }
  check("...over the inner ring, a notch a kind, each kind's first setting", new Set(kinds).size === 4 && kinds.every((x) => /^(game|board|hints|settings)$/.test(x)), kinds.join(" → "));
  await page.keyboard.press("Escape");
  check("Escape puts it away", !!(await away(page)));
  await page.waitForTimeout(800);
  // Begin from Rings (its primary), then the mouse onto the corner piece.
  r = await openRings(page, false);
  await page.locator('[data-testid="dock-menu"] [data-testid="menu-fan-primary"]').click();
  const corner = await waitForDockCorner(page, { timeoutMs: 15000 });
  check("Begin Game from Rings: the piece in its corner", !!corner);
  await page.waitForTimeout(1200);
  if (corner) {
    await page.mouse.move(corner.x + corner.width / 2 + 60, corner.y + corner.height / 2 + 60);
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2, { steps: 4 });
  }
  r = await poll(() => out(page), 5000, 150);
  check("...the mouse brought onto the corner piece: Rings out, in play", !!r && r.phase === "play", JSON.stringify(r));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("The store in Spanish, on a phone: the inner ring's names fit");
{
  const { ctx, page, errs } = await store({ lang: "es" });
  await openRings(page);
  const names = await kindNames(page);
  check(`...Partida, Tablero, Ayudas, Configuración, each inside its piece (${names && names.map((x) => `${x.name} ${x.from}..${x.to} in ${x.piece}`).join("; ")})`, !!names && names.map((x) => x.name).join() === "Partida,Tablero,Ayudas,Configuración" && names.every((x) => x.onArc && x.inside && x.bold), JSON.stringify(names));
  check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
