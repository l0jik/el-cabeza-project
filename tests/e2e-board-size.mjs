/* Drives REAL browser renders at board sizes the default can't exercise.

   The Node-side tests/board-size.smoke.mjs covers the engine's own math,
   but it can't reach the rendering path at all — the board texture, the
   grid line geometry, the slab mesh, and (most dangerous) the raycast
   that converts a world-space hit back into a board cell. Those are
   exactly where an X/Z mix-up lives, and at the square 10x10 default
   such a mix-up is invisible because every X value equals its Z one.

   So each case here is deliberately NON-square (or the maximum size),
   and each one both renders and takes a real mouse click that has to
   land on an actual piece. A swapped OFF_X/OFF_Z mis-targets every
   click, so "a real click selected a real piece" is the assertion that
   actually pins the hit-testing down.

   Board size is applied before boot via window.__EC_BOARD__ — see
   apps/boardBootstrap.js. */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Candidate click points covering both board orientations: a tall board
   pushes the piece rows out toward the viewport edges, a wide one keeps
   them nearer the middle (the camera fits whichever axis is larger), so
   one fixed set of points can't serve both. */
const BASE_CANDIDATES = [
  [0.5, 0.18], [0.45, 0.2], [0.55, 0.2], [0.42, 0.16], [0.58, 0.16],
  [0.5, 0.29], [0.47, 0.3], [0.54, 0.28],
];
/* Each point plus its reflection through the canvas centre. The pre-game
   setup randomly rolls which colour sits nearest the viewer
   (boardNearSide in ElCabeza3D.jsx) and that heading carries into the
   game, so a point that lands on a piece in one session lands on empty
   board in the next — the same reason tests/e2e-gameplay.mjs sweeps
   mirrored candidates rather than fixed ones. */
const CANDIDATES = [...BASE_CANDIDATES, ...BASE_CANDIDATES.map(([x, y]) => [1 - x, 1 - y])];

const CASES = [
  { theme: "standard", rows: 14, cols: 8, label: "tall" },
  { theme: "standard", rows: 20, cols: 20, label: "maximum" },
  { theme: "neon", rows: 12, cols: 18, label: "wide" },
  { theme: "neon", rows: 20, cols: 20, label: "maximum" },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;

for (const { theme, rows, cols, label } of CASES) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    // The blocked Google Fonts fetch is a sandbox artifact, not the app.
    if (m.type() === "error" && !/ERR_CERT/.test(m.text())) errs.push(m.text());
  });

  await page.addInitScript(([r, c]) => { window.__EC_BOARD__ = { rows: r, cols: c }; }, [rows, cols]);
  await page.goto(`file://${path.join(__dirname, "..", "dist", `el-cabeza-${theme}.html`)}`);
  await page.waitForTimeout(1200);

  const applied = await page.evaluate(() => (window.__EC_BOARD__ || {}).applied || null);
  const sizeOk = applied && applied.rows === rows && applied.cols === cols;

  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1000);

  const box = await page.locator('canvas[data-testid="board-canvas"]').boundingBox();
  const statusText = () =>
    page.evaluate(() => {
      const s = [...document.querySelectorAll("span")].find((el) => /to move|left|thinking/i.test(el.textContent || ""));
      return s ? s.textContent : null;
    });

  let selected = null;
  for (const [fx, fy] of CANDIDATES) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(200);
    const s = await statusText();
    if (s && /roll|step/i.test(s)) { selected = s; break; }
  }

  const ok = sizeOk && !!selected && errs.length === 0;
  if (!ok) failures++;
  console.log(
    `[${theme} ${rows}x${cols} ${label}] size applied: ${sizeOk} | click selected: ${selected || "NONE"} | errors: ${errs.length}${
      errs.length ? " " + JSON.stringify(errs.slice(0, 2)) : ""
    } -> ${ok ? "ok" : "FAIL"}`
  );
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nBOARD SIZE E2E PASSED" : `\nBOARD SIZE E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
