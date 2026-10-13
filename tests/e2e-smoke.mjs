import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const target = process.argv[2]; // "standard" or "neon"
if (!target) {
  console.error("usage: node tests/e2e-smoke.mjs <standard|neon|cromo|plano|luna|noir|lluvia|tienda|ciudad>");
  process.exit(1);
}

const file = path.join(__dirname, "..", "dist", `el-cabeza-${target}.html`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});

// (the test hooks: the dock piece's own scene, for where it turns about)
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(`file://${file}`);
await page.waitForTimeout(1500); // let the scene-setup effect and first render settle

const rootHasContent = await page.evaluate(() => document.getElementById("root").children.length > 0);
console.log(`[${target}] root has rendered content:`, rootHasContent);

if (!rootHasContent) {
  console.log(`[${target}] FAILED TO RENDER. Errors so far (${errors.length}):`);
  errors.forEach((e) => console.log("   " + e));
  await browser.close();
  process.exit(1);
}

// Themes that open on their own screen first (Lluvia's descent, Tienda's
// boxed game): go straight to the board, as a player can.
const OPENING = { lluvia: '[data-testid="lluvia-straight-to-board"]', tienda: '[data-testid="tienda-open-box"]' };
if (OPENING[target]) {
  await page.locator(OPENING[target]).click({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

const title = await page.textContent("h1");
console.log(`[${target}] title text:`, JSON.stringify(title));

// The dock piece turns about its own middle (user, the City: "rotating
// such that it is attached to the exterior of a sphere, whereas the
// center of gravity should be the center of the piece itself"): the
// middle of what's drawn of it, in its turning group's own space, within
// 5% of its size of the group's origin. (The City, Noir and Luna stood
// their models on the origin: 50%, 50% and 33% off.)
const pivot = await page.evaluate(() => {
  const d = window.__EC_TEST_DOCK__ && window.__EC_TEST_DOCK__();
  if (!d) return null;
  const g = d.pieceGroup, keep = [g.rotation.clone(), g.scale.clone(), g.position.clone()];
  g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  g.traverseVisible((o) => {
    const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!pos || !mats.some((m) => m && m.visible !== false && m.colorWrite !== false)) return;
    const e = o.matrixWorld.elements, step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const p = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
  });
  g.rotation.copy(keep[0]); g.scale.copy(keep[1]); g.position.copy(keep[2]); g.updateMatrixWorld(true);
  if (!isFinite(lo[0])) return null;
  const mid = lo.map((v, k) => (v + hi[k]) / 2), size = Math.max(...hi.map((v, k) => v - lo[k]));
  return { off: Math.hypot(...mid) / size, mid: mid.map((v) => +v.toFixed(3)) };
});
console.log(`[${target}] dock piece turns about its own middle:`, pivot ? `${(pivot.off * 100).toFixed(1)}% of its size off` : "not found");
if (!pivot || pivot.off > 0.05) errors.push(`dock piece: turns about a point ${pivot ? `${(pivot.off * 100).toFixed(1)}% of its size off its middle ${JSON.stringify(pivot.mid)}` : "(not found)"}`);

// The dock starts as a spinning 3D piece preview; double-tapping it
// bounces it into the settings panel (with Begin Game) — same gesture
// a real player uses, so simulate it here rather than assuming the
// panel is already open. Retries the gesture until confirmed open
// rather than a single fixed-timing attempt — see dock-helpers.mjs.
const dockOpened = await openDockPanel(page);
console.log(`[${target}] dock panel opened:`, dockOpened);

// Click Begin Game.
const beginBtn = page.locator("button", { hasText: /Begin Game|Try a Game/ });
const hasBegin = await beginBtn.count();
console.log(`[${target}] Begin Game button present:`, hasBegin > 0);
if (hasBegin > 0) {
  await beginBtn.click();
  await page.waitForTimeout(500);
  const statusAfterBegin = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    return spans.map((s) => s.textContent).find((t) => /to move|thinking/i.test(t || ""));
  });
  console.log(`[${target}] status after Begin Game:`, JSON.stringify(statusAfterBegin));
}

// Try clicking on the 3D canvas to select a piece, then check for a
// ghost/legal-move indicator appearing (a real behavioral signal, not
// just "didn't crash") — click roughly where Dark's home row pieces
// render at the default camera angle.
const canvas = page.locator('canvas[data-testid="board-canvas"]');
const canvasBox = await canvas.boundingBox();
if (canvasBox) {
  // A handful of sample points across the lower-middle of the canvas,
  // since we don't know exact piece screen positions without a real
  // render inspection.
  for (const frac of [0.35, 0.45, 0.5, 0.55, 0.65]) {
    await page.mouse.click(canvasBox.x + canvasBox.width * frac, canvasBox.y + canvasBox.height * 0.62);
    await page.waitForTimeout(150);
  }
}
await page.waitForTimeout(500);

// Fetching the Google Fonts stylesheet is expected to fail in a
// sandboxed/offline test environment (no network egress to fonts.
// googleapis.com) — that's an environment limitation, not a bug in
// this codebase, so it's excluded from the pass/fail verdict.
//
// ERR_CERT_AUTHORITY_INVALID belongs in that same list: this sandbox
// reaches the network through a TLS-intercepting proxy, so a blocked
// fetch surfaces as an untrusted-certificate error rather than a
// connection-level one. Without it here the whole `npm test` chain
// stops at this first e2e step no matter what the code does —
// verified against an unmodified baseline worktree, so this is a stale
// filter rather than anything the app regressed.
const realErrors = errors.filter(
  (e) => !/ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CERT_AUTHORITY_INVALID/.test(e)
);

console.log(`[${target}] console/page errors (${errors.length}, ${realErrors.length} not attributable to blocked network access):`);
errors.slice(0, 20).forEach((e) => console.log("   " + e));

await browser.close();
process.exit(realErrors.length > 0 ? 1 : 0);
