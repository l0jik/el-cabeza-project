/* Undo move, one move at a time and always to hand (user: "what do we
   have for an easy access to an undo move? ... I think we do need it,
   because sometimes a piece will have been moved and you don't know what
   it is, so you can't necessarily grab the piece and move it back").

   Undo move takes back the last move alone (chassis handleUndoMove): mid-
   turn, that move; once a turn's over, its last move, the turn open again
   just short of it, and against the computer its reply taken back first.
   The button floats at the foot of the screen whenever there's a move to
   take back, and Ctrl+Z does the same. Undo turn still takes a whole turn.

   node tests/e2e-undo-move.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 20000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });

async function play(opp) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_ALL_COSTS__ = true; try { localStorage.removeItem("el-cabeza:lab-theme"); } catch (e) { /* none */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-lab.html?theme=swiss");
  await poll(() => page.evaluate(() => !!window.__LAB__ && !!document.querySelector('[data-testid="lab-hud"]')), 30000);
  await page.waitForTimeout(1000);
  await openDockPanel(page);
  await page.locator(opp === "human" ? '[data-opponent="human"]' : '[data-opponent="ai-dark"]').first().click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.waitForTimeout(2500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open").catch(() => null)) === "true") { await page.mouse.click(640, 790); await page.waitForTimeout(500); }
  const S = () => page.evaluate(() => ({
    toMove: window.__EC_TEST_TO_MOVE__ && window.__EC_TEST_TO_MOVE__(),
    log: (window.__EC_TEST_LOG__ || []).length,
    pcs: JSON.stringify((window.__EC_TEST_PIECES__ || []).map((p) => [p.id, p.row, p.col, p.w, p.h, p.z]).sort()),
    undo: !!document.querySelector('[data-testid="undo-move-float"]'),
    end: !!document.querySelector('[data-testid="stop-here-float"]'),
  }));
  const pieceOf = (id) => page.evaluate((i) => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === i)), id);
  // A step of the piece's, the first way it can go.
  async function step(id, dirs) {
    for (const d of dirs) {
      const before = await pieceOf(id);
      await page.evaluate(([i, x]) => window.__EC_TEST_MOVE__(i, x), [id, d]);
      if (await poll(async () => (await pieceOf(id)) !== before, 5000)) { await page.waitForTimeout(700); return d; }
    }
    return null;
  }
  const me = opp === "human" ? "dark" : "light";
  if (opp !== "human") check("the computer opens", !!(await poll(async () => (await S()).toMove === me, 40000)));
  const s0 = await S();
  check(`${opp}: nothing to take back yet, no Undo move`, !s0.undo, JSON.stringify(s0.undo));
  const mover = me === "dark" ? "dark-flaco" : "light-chato";
  const ahead = me === "dark" ? ["S", "E", "W"] : ["N", "E", "W"];
  check(`${opp}: a first move`, !!(await step(mover, ahead)));
  const s1 = await S();
  check(`${opp}: mid-turn, Undo move beside End turn`, s1.undo && s1.end && s1.toMove === me, JSON.stringify({ ...s1, pcs: undefined }));
  check(`${opp}: a second move ends the turn`, !!(await step(mover, ahead)));
  // (Against a person it's their turn now; against the computer, yours
  // again once it's answered.)
  const next = opp === "human" ? "light" : me;
  const s2 = await poll(async () => { const s = await S(); return s.toMove === next && s.log > s0.log && !s.end && s.undo ? s : null; }, 40000);
  check(`${opp}: the turn over${opp === "human" ? ", the other side to move" : " and the computer's answered"}: Undo move still there, alone`, !!s2, JSON.stringify(await S(), (k, v) => (k === "pcs" ? undefined : v)));
  await page.locator('[data-testid="undo-move-float"]').click();
  const s3 = await poll(async () => { const s = await S(); return s.pcs === s1.pcs && s.toMove === me && s.end ? s : null; }, 25000);
  check(`${opp}: Undo move takes back the last move only${opp === "human" ? "" : " (and the reply)"}: that turn open again, one move in`, !!s3 && s3.log === s0.log, JSON.stringify((s3 || (await S())) && { ...(s3 || (await S())), pcs: undefined }));
  await page.waitForTimeout(600);
  await page.keyboard.press("Control+z");
  const s4 = await poll(async () => { const s = await S(); return s.pcs === s0.pcs ? s : null; }, 20000);
  check(`${opp}: Ctrl+Z, the move before: the turn's start`, !!s4 && !s4.end && s4.toMove === me, JSON.stringify(s4 && { ...s4, pcs: undefined }));
  check(`${opp}: no page errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("against a person");
await play("human");
console.log("against the computer");
await play("ai");
await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
