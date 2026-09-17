import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
const file = path.join(__dirname, "..", "dist", `el-cabeza-${target}.html`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`file://${file}`);
await page.waitForTimeout(1200);

// The dock starts as a spinning 3D piece preview; double-tap it to
// bounce/open the settings panel (with Begin Game), same as a real
// player. Retries the gesture until confirmed open — see dock-helpers.mjs.
const dockOpened = await openDockPanel(page);
console.log(`[${target}] dock panel opened:`, dockOpened);

await page.locator("button", { hasText: "Begin Game" }).click();
await page.waitForTimeout(600);

const statusText = () => page.evaluate(() => {
  const spans = [...document.querySelectorAll("span")];
  const s = spans.find((s) => /to move|left|thinking/i.test(s.textContent || ""));
  return s ? s.textContent : null;
});

console.log(`[${target}] initial status:`, await statusText());

// Click on Dark's Opa (a block) — in the default camera framing (Light
// near the viewer) it's up near the top of the canvas, in Dark's
// cluster. The pre-game setup screen now randomly rolls which color
// starts near the viewer (see boardNearSide in ElCabeza3D.jsx), and
// that heading carries into the game exactly like a manual pre-game
// drag always has, so the board is just as likely to be showing the
// mirrored (Dark near) heading here — the second half of this list is
// each original point reflected through the canvas center for that
// case. Try a handful of candidate points since exact projection also
// varies slightly between the two themes' camera math (should be
// identical, but confirm empirically rather than assume).
const canvas = page.locator('canvas[data-testid="board-canvas"]');
const box = await canvas.boundingBox();
let selected = false;
let selectedAt = null;
const selectCandidates = [[0.5, 0.37], [0.42, 0.35], [0.58, 0.3], [0.44, 0.33], [0.52, 0.34]];
const allSelectCandidates = [...selectCandidates, ...selectCandidates.map(([x, y]) => [1 - x, 1 - y])];
for (const [fx, fy] of allSelectCandidates) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(300);
  const s = await statusText();
  if (s && /step|roll/i.test(s)) { selected = true; selectedAt = [fx, fy]; console.log(`[${target}] selected via (${fx},${fy}):`, s); break; }
}
console.log(`[${target}] a piece got selected:`, selected);

await page.screenshot({ path: `/tmp/${target}-selected.png` });

// Try to complete an actual move by clicking on the legal-move ghost
// outline near the board's vertical middle. A click that MISSES the
// ghost (lands on an ordinary empty square) deselects the piece rather
// than being a harmless no-op, so each candidate below reselects first
// via selectedAt whenever the previous attempt lost the selection —
// a plain sweep across many points otherwise dooms itself the moment
// its first miss (long before it reaches the real target) deselects.
if (selected) {
  // Games now open in Top-Down View by default (was Current Player
  // View), which reframes the whole board in canvas space, so this
  // band (rather than the old fixed "just south of the piece" spot)
  // is where the ghost actually lands, for either near/far mirroring.
  const moveCandidates = [
    [0.5, 0.52], [0.48, 0.52], [0.52, 0.52], [0.5, 0.5], [0.5, 0.54], [0.46, 0.5], [0.54, 0.5],
    [0.5, 0.48], [0.48, 0.48], [0.52, 0.48], [0.5, 0.46], [0.5, 0.44], [0.46, 0.46], [0.54, 0.46],
  ];
  for (const [fx, fy] of moveCandidates) {
    let s = await statusText();
    if (!(s && /step|roll/i.test(s)) && selectedAt) {
      // Lost the selection to a previous miss — reselect before trying
      // the next candidate, otherwise this click (even a real hit)
      // lands on nothing selected.
      await page.mouse.click(box.x + box.width * selectedAt[0], box.y + box.height * selectedAt[1]);
      await page.waitForTimeout(300);
    }
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(700); // roll animation
    s = await statusText();
    // Deliberately NOT matching "left" here — a piece that's still
    // selected with steps remaining ("Opa - 1 roll left") also contains
    // that word, and a missed click (this candidate wasn't actually on
    // the ghost) leaves that exact text on screen unchanged, which used
    // to read as a false "move completed" the instant the loop hit a
    // miss before ever reaching a candidate that really lands.
    if (s === "Light to move" || /finished/i.test(s || "")) {
      console.log(`[${target}] move completed via (${fx},${fy}), status now:`, s);
      break;
    }
  }
  await page.screenshot({ path: `/tmp/${target}-after-move.png` });
  console.log(`[${target}] status after move attempt:`, await statusText());
}

// Begin Game closed the dock panel behind it — it remorphs into the
// piece and relocates to the bottom-right corner watermark on a 900ms
// delay plus its own 900ms CSS transition. Poll for that (rather than a
// fixed sleep — this sandboxed test environment's real-world timing has
// proven wildly variable, up to several seconds per interaction under
// load), then double-tap it to reopen the panel, the same gesture a
// real player uses mid-game — see dock-helpers.mjs.
const cornerBox = await waitForDockCorner(page);
console.log(`[${target}] dock piece reached corner:`, !!cornerBox);
const reopened = cornerBox && (await reopenDockPanelFromCorner(page, cornerBox));
console.log(`[${target}] panel reopened from corner:`, reopened);

// End the game and check the Move Log popup.
await page.locator("button", { hasText: "End Active Game" }).click();
await page.waitForTimeout(400);
// Exact text AND scoped to the dock panel: the Victory placard (always
// mounted, just hidden for a manual end) has its own "Move Log" button
// too, which opens this same popup for a real win instead — an exact-
// text match alone still resolves both, so this scopes to the one
// actually reachable from a manual End Active Game.
const moveLogBtn = page.locator('[data-testid="dock-panel"] button', { hasText: /^Move Log$/ });
console.log(`[${target}] Move Log button present after End Active Game:`, await moveLogBtn.count());
if (await moveLogBtn.count()) {
  await moveLogBtn.click();
  await page.waitForTimeout(300);
  const popupText = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("MOVE LOG"));
    return h2 ? h2.parentElement.textContent : null;
  });
  console.log(`[${target}] Move Log popup content:`, JSON.stringify(popupText));
  await page.screenshot({ path: `/tmp/${target}-movelog.png` });
}

console.log(`[${target}] total errors:`, errors.length);
errors.forEach((e) => console.log("   " + e));

await browser.close();
