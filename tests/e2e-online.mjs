/* Online play (chassis/online.js, server/relay.js; user: "implement online
   play against another person (it needs a small server)"; chose a relay
   the project writes, run here on a free port and reached with ?relay=).
   Two browsers: the host in the den, the guest in Futuris (a game's the same
   rules in any world).

   - With no server set up (the placeholder address): Online says so.
   - The host gets a six-letter code and a link; the guest joins by the
     link (?join=CODE): both say who plays what; the guest's Begin waits
     for the host.
   - The host begins: the guest's board begins on the host's setup. Each
     side's turn plays out on the other's board (a roll, a two-step
     Cabeza, a Hold to end); the side to move can't be moved from the
     other browser; no taking back a settled turn.
   - A crush ends the game on both boards.
   - The guest reloads mid-game: the game's picked up again (the turns
     replayed); the host sees them go and come back.
   - Leaving: the other side's told.

   node tests/e2e-online.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dataDir = mkdtempSync(join(tmpdir(), "ec-online-"));
// (or, with RELAY set, a server already running: the same one on Cloudflare
// under wrangler dev, RELAY=ws://127.0.0.1:8790; see server/README.md)
const relay = process.env.RELAY ? null : spawn(process.execPath, ["server/relay.js", "--port", "0", "--data", dataDir], { cwd: "/home/user/el-cabeza-project", stdio: ["ignore", "pipe", "pipe"] });
const port = relay ? await new Promise((resolve, reject) => {
  let out = "";
  relay.stdout.on("data", (d) => { out += d; const m = /listening on (\d+)/.exec(out); if (m) resolve(parseInt(m[1], 10)); });
  relay.stderr.on("data", (d) => { out += d; });
  relay.on("exit", () => reject(new Error("relay exited: " + out)));
  setTimeout(() => reject(new Error("relay never listened: " + out)), 15000);
}) : 0;
const RELAY = process.env.RELAY || `ws://127.0.0.1:${port}`;
console.log(relay ? `relay on ${port}` : `relay at ${RELAY}`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
async function open(file, query = "", { relayOn = true, ctx: given = null } = {}) {
  const ctx = given || (await browser.newContext({ viewport: { width: 1100, height: 820 } }));
  if (!given) await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } });
  const page = given ? given.pages()[0] : await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const q = [relayOn ? `relay=${encodeURIComponent(RELAY)}` : "", query].filter(Boolean).join("&");
  await page.goto(`${D}/el-cabeza-${file}.html${q ? "?" + q : ""}`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__), 30000, 250);
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
const T = (page, fn, a) => page.evaluate(fn, a);
const online = (page) => T(page, () => (window.__EC_TEST_ONLINE__ ? window.__EC_TEST_ONLINE__() : null));
const at = (page, id) => T(page, (i) => (window.__EC_TEST_PIECES__ || []).find((q) => q.id === i) || null, id);
const turns = (page) => T(page, () => (window.__EC_TEST_TURNS__ || []).length);
const armed = (page) => poll(() => T(page, () => window.__EC_TEST_ARMED__ === true), 15000, 250);
const toMove = (page) => T(page, () => { const e = document.querySelector('[data-testid="status-pill"], [data-testid="turn-pill"]'); return e ? e.textContent : document.body.innerText.match(/[A-Z]+ (?:\(ONLINE\) )?TO MOVE/i)?.[0] || ""; });
// A move played here, as a tap plays it; the step lands on the far board.
const move = async (page, id, dir) => T(page, ([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
const landed = (page, id, row, col, ms = 20000) => poll(async () => { const p = await at(page, id); return p && p.row === row && p.col === col ? p : null; }, ms);
const POSITION = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 4, w: 1, h: 1, z: 1 },
  { id: "dark-turrito", type: "turrito", owner: "dark", row: 3, col: 3, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 5, w: 1, h: 1, z: 1 },
  { id: "light-turrito", type: "turrito", owner: "light", row: 6, col: 6, w: 1, h: 1, z: 1 },
];

console.log("No server set up");
{
  const { ctx, page, errs } = await open("standard", "", { relayOn: false });
  await openDockPanel(page);
  await page.locator('[data-opponent="online"]').click();
  const note = await poll(() => page.locator('[data-testid="online-not-ready"]').textContent(), 4000);
  check("Online says the server isn't set up yet", !!note && /isn.t set up yet/.test(note), note || "");
  check("...its buttons wait", await page.locator('[data-testid="online-host"]').isDisabled());
  await page.locator('[data-testid="online-back"]').click();
  check("Back shows the opponents again", !!(await poll(async () => (await page.locator('[data-opponent="human"]').count()) === 1, 3000)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("Hosting, joining by the link");
const host = await open("standard");
await openDockPanel(host.page);
// (the host's pieces, a short game: set before hosting, sent at Begin)
await T(host.page, (ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
await host.page.locator('[data-opponent="online"]').click();
await host.page.locator('[data-testid="online-host"]').click();
const code = await poll(() => host.page.locator('[data-testid="online-code"]').textContent(), 10000);
check("the host gets a six-letter code", !!code && /^[A-Z2-9]{6}$/.test(code), code || JSON.stringify(await online(host.page)));
const hostState = await online(host.page);
check("...and plays the opening side, Dark", !!hostState && hostState.role === "host" && hostState.mySide === "dark" && hostState.theirSide === "light" && hostState.status === "waiting", JSON.stringify(hostState));
check("...waiting for the other player", /Waiting for the other player/.test((await host.page.locator('[data-testid="online-status"]').textContent()) || ""));
const link = await T(host.page, () => { const u = new URL(location.href); u.searchParams.set("join", document.querySelector('[data-testid="online-code"]').textContent); return u.searchParams.get("join"); });
check("the link carries the code", link === code);

const guest = await open("futuris", `join=${code}`);
const joined = await poll(async () => { const o = await online(guest.page); return o && o.status === "waiting" ? o : null; }, 15000);
check("the guest joins by the link", !!joined && joined.role === "guest" && joined.code === code, JSON.stringify(await online(guest.page)));
check("...plays the other side, Light", !!joined && joined.mySide === "light" && joined.theirSide === "dark");
check("...the word 'join' gone from the address", !/join=/.test(await T(guest.page, () => location.search)));
check("...and waits for the host to begin", /Waiting for the host/.test((await guest.page.locator('[data-dock-role="begin"]').textContent()) || "") && (await guest.page.locator('[data-dock-role="begin"]').isDisabled()));
const hostSees = await poll(async () => { const o = await online(host.page); return o && o.peer ? o : null; }, 8000);
check("the host sees them arrive", !!hostSees && /is here/.test((await host.page.locator('[data-testid="online-status"]').textContent()) || ""));
check("...the guest's pieces are the host's", JSON.stringify((await T(guest.page, () => window.__EC_TEST_PIECES__.map((p) => [p.id, p.row, p.col]).sort()))) === JSON.stringify(POSITION.map((p) => [p.id, p.row, p.col]).sort()));

console.log("The host begins; the turns go both ways");
await host.page.locator('[data-dock-role="begin"]').click();
check("the host's game begins", !!(await armed(host.page)));
check("...and the guest's, on its own", !!(await armed(guest.page)));
check("...Dark to move on both", (await T(host.page, () => document.body.innerText)).includes("TO MOVE") && !!(await poll(async () => { const o = await online(guest.page); return o && o.status === "playing"; }, 5000)));
// the guest can't move Dark's piece (not its side)
check("the guest can't move the host's piece", !(await poll(async () => { await move(guest.page, "dark-turrito", "S"); await wait(600); const p = await at(guest.page, "dark-turrito"); return p && p.row === 4; }, 2500)));
// Dark (host) rolls its Turrito S then S: two steps, then the turn ends
check("the host rolls (S)", !!(await move(host.page, "dark-turrito", "S")) && !!(await landed(host.page, "dark-turrito", 4, 3)));
await wait(500);
check("...and again (S), the turn over", !!(await move(host.page, "dark-turrito", "S")) && !!(await landed(host.page, "dark-turrito", 5, 3)) && !!(await poll(async () => (await turns(host.page)) === 1, 10000)));
check("the roll lands on the guest's board, both steps", !!(await landed(guest.page, "dark-turrito", 5, 3)) && !!(await poll(async () => (await turns(guest.page)) === 1, 10000)), JSON.stringify(await at(guest.page, "dark-turrito")));
check("...Light to move there, and the host told to wait", !!(await poll(() => T(guest.page, () => (window.__EC_TEST_TURNS__ || []).length === 1 && !/\(online\) to move/i.test(document.body.innerText)), 5000)) && !!(await poll(() => T(host.page, () => /\(online\) to move/i.test(document.body.innerText)), 5000)));
// the host can't move now
check("the host can't move while it's the guest's turn", !(await poll(async () => { await move(host.page, "dark-cabeza", "S"); await wait(600); const p = await at(host.page, "dark-cabeza"); return p && p.row === 1; }, 2500)));
check("...no Undo turn for a settled turn online", (await host.page.locator('button:has-text("Undo turn")').count()) === 0);
// Light (guest): its Cabeza steps N once, then Hold to end / End turn
check("the guest steps its Cabeza (N)", !!(await move(guest.page, "light-cabeza", "N")) && !!(await landed(guest.page, "light-cabeza", 8, 5)));
const endBtn = guest.page.locator('button:has-text("End turn")').first();
if (await endBtn.count()) { await endBtn.click(); const ask = guest.page.locator('[data-testid="end-turn-ask-end"]'); if (await poll(async () => (await ask.count()) === 1, 1500)) await ask.click(); }
check("...ends the turn early", !!(await poll(async () => (await turns(guest.page)) === 2, 10000)));
check("the step lands on the host's board", !!(await landed(host.page, "light-cabeza", 8, 5)) && !!(await poll(async () => (await turns(host.page)) === 2, 10000)));
// Dark (host): the Turrito on to row 6, col 3; then the Cabeza... a crush: the Turrito rolls E onto... set a crush up instead:
await wait(400);
check("the host rolls again (S)", !!(await move(host.page, "dark-turrito", "S")) && !!(await landed(host.page, "dark-turrito", 6, 3)));
await wait(300);
check("...and E", !!(await move(host.page, "dark-turrito", "E")) && !!(await landed(host.page, "dark-turrito", 6, 4)) && !!(await poll(async () => (await turns(host.page)) === 3, 10000)));
check("...on the guest's board too", !!(await landed(guest.page, "dark-turrito", 6, 4)) && !!(await poll(async () => (await turns(guest.page)) === 3, 10000)));

console.log("The guest reloads mid-game: picked up again");
await guest.page.reload();
await poll(() => T(guest.page, () => !!window.__EC_TEST_SET_PIECES__), 30000, 250);
const back = await poll(async () => { const o = await online(guest.page); return o && o.status === "playing" && o.queued === 0 && o.turns === 3 ? o : null; }, 30000);
check("the game's resumed, its three turns replayed", !!back && !!(await landed(guest.page, "dark-turrito", 6, 4)) && !!(await landed(guest.page, "light-cabeza", 8, 5)), JSON.stringify(await online(guest.page)));
check("...Light to move again there", !!(await poll(async () => (await turns(guest.page)) === 3 && (await T(guest.page, () => window.__EC_TEST_ARMED__ === true)), 10000)));
const hostPeer = await poll(async () => { const o = await online(host.page); return o && o.peer ? o : null; }, 8000);
check("the host sees them back", !!hostPeer);

console.log("A crush ends it on both boards");
// Light's Cabeza at (8,5): the guest steps it W to (8,4); then Dark's Turrito at (6,4) rolls S, S onto (8,4): a crush.
check("the guest steps W", !!(await move(guest.page, "light-cabeza", "W")) && !!(await landed(guest.page, "light-cabeza", 8, 4)));
const endBtn2 = guest.page.locator('button:has-text("End turn")').first();
if (await endBtn2.count()) { await endBtn2.click(); const ask = guest.page.locator('[data-testid="end-turn-ask-end"]'); if (await poll(async () => (await ask.count()) === 1, 1500)) await ask.click(); }
check("...the turn over, and over there", !!(await poll(async () => (await turns(guest.page)) === 4, 10000)) && !!(await landed(host.page, "light-cabeza", 8, 4)));
await wait(400);
check("the host rolls S", !!(await move(host.page, "dark-turrito", "S")) && !!(await landed(host.page, "dark-turrito", 7, 4)));
await wait(300);
// (Each told their own result: the host won, the guest lost.)
check("...and S onto the Cabeza: a crush, \"You win\" for the host", !!(await move(host.page, "dark-turrito", "S")) && !!(await poll(() => T(host.page, () => /you win/i.test(document.body.innerText)), 10000)));
check("the guest's board ends the same way, \"You lose\" there", !!(await poll(() => T(guest.page, () => /you lose/i.test(document.body.innerText) && !window.__EC_TEST_PIECES__.some((p) => p.id === "light-cabeza")), 15000)), JSON.stringify(await T(guest.page, () => window.__EC_TEST_PIECES__.map((p) => [p.id, p.row, p.col]))));
const ngGuest = guest.page.locator('[data-testid="new-game"]').first();
check("the guest's New Game waits for the host", !!(await poll(async () => (await ngGuest.count()) > 0, 8000)) && (await ngGuest.isDisabled()) && /host starts/.test((await ngGuest.getAttribute("title")) || ""));

console.log("Leaving");
const ngHost = host.page.locator('[data-testid="new-game"]').first();
check("the host's New Game is there", !!(await poll(async () => (await ngHost.count()) > 0, 8000)));
await ngHost.evaluate((b) => b.click());
await wait(800);
const hostAfter = await online(host.page);
check("the host's new game keeps the room, waiting for Begin", !!hostAfter && hostAfter.status === "waiting" && hostAfter.code === code, JSON.stringify(hostAfter));
// (the dock piece after New Game: the panel's shut; opened for its Leave)
await openDockPanel(host.page);
await host.page.locator('[data-testid="online-leave"]').evaluate((b) => b.click());
check("the host leaves", !!(await poll(async () => (await online(host.page)) === null, 4000)));
const gone = await poll(async () => { const o = await online(guest.page); return o && o.status === "gone" ? o : null; }, 8000);
await openDockPanel(guest.page);
check("...and the guest is told", !!gone && /other player left/.test((await guest.page.locator('[data-testid="dock-caption"]').textContent().catch(() => "")) || ""), JSON.stringify(await online(guest.page)));
check("...and can start a game of their own again", !(await ngGuest.isDisabled()));
check(`no page errors, host (${host.errs.length})`, host.errs.length === 0, host.errs.slice(0, 3).join(" | "));
check(`no page errors, guest (${guest.errs.length})`, guest.errs.length === 0, guest.errs.slice(0, 3).join(" | "));
await host.ctx.close();
await guest.ctx.close();

console.log("A code nobody has");
{
  const { ctx, page } = await open("cromo");
  await openDockPanel(page);
  await page.locator('[data-opponent="online"]').click();
  await page.locator('[data-testid="online-join-view"]').click();
  await page.locator('[data-testid="online-code-input"]').fill("zzzzzz");
  await page.locator('[data-testid="online-join"]').click();
  const err = await poll(() => page.locator('[data-testid="online-error"]').textContent(), 8000);
  check("an unknown code is refused", !!err && /no game with that code/.test(err), err || "");
  await ctx.close();
}

await browser.close();
if (relay) relay.kill();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
