/* Does the AI worker actually receive and apply the board dimensions?
   The worker has its own module instance of engine/constants.js, so if
   `board` isn't sent/applied it silently searches a 10x10 board. Nothing
   else in the suite drives an AI opponent at all. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const rows = 16, cols = 7;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT/.test(m.text())) errs.push(m.text()); });

await page.addInitScript(([r, c]) => {
  window.__EC_BOARD__ = { rows: r, cols: c };
  // Capture what actually crosses the thread boundary.
  const OrigWorker = window.Worker;
  window.__workerMsgs = [];
  window.Worker = class extends OrigWorker {
    postMessage(msg) { window.__workerMsgs.push(msg); return super.postMessage(msg); }
  };
}, [rows, cols]);

await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html`);
await page.waitForTimeout(1200);
await openDockPanel(page);

// Pick an AI opponent so a real search runs.
const aiBtn = page.locator('[data-testid="dock-panel"] button', { hasText: /^AI$/ }).first();
const count = await aiBtn.count();
if (count) { await aiBtn.click(); await page.waitForTimeout(600); }
let failures = 0;
const check = (l, c) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}`); };
check("AI opponent button present", count > 0);

await page.locator("button", { hasText: "Begin Game" }).click();
// Hard difficulty can take seconds; give the search room to run.
await page.waitForTimeout(9000);

const msgs = await page.evaluate(() => window.__workerMsgs || []);
check("the AI search ran on a worker at all", msgs.length > 0);
if (msgs.length) {
  const b = msgs[0].board;
  check(`board dimensions crossed the thread boundary (${JSON.stringify(b)})`, !!b && b.rows === rows && b.cols === cols);
  check("pieces sent fit the requested board", (msgs[0].pieces || []).every((p) => p.row + p.h <= rows && p.col + p.w <= cols));
}
const status = await page.evaluate(() => {
  const s = [...document.querySelectorAll("span")].find((el) => /to move|thinking|left/i.test(el.textContent || ""));
  return s ? s.textContent : null;
});
check(`the AI actually completed a turn (status: ${JSON.stringify(status)})`, !!status && /light to move/i.test(status));
check(`no page errors (${errs.length})`, errs.length === 0);
await browser.close();
console.log(failures === 0 ? "\nAI WORKER BOARD-SIZE E2E PASSED" : `\nAI WORKER BOARD-SIZE E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
