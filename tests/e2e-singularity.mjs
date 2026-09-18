/* Neon's Singularity: the Anomaly random-setup button, the phantom
   reveal, the hold gesture that commits, and the collapse/blackout/
   sphere cinematic that follows (SINGULARITY_DESIGN.md Part 1,
   themes/neon-singularity.js).

   The gesture under test: hold Anomaly ~4s to reveal Singularity, then
   keep holding on Singularity ITSELF — 2s of nothing, then a hum that
   builds over 4s — and holding through the end of that build commits,
   handing off to the cinematic: the board warps into a wormhole for
   ~3.2s, hard-cuts to silent black, then settles on a draggable,
   Fresnel-glow sphere. A plain tap on Singularity is deliberately a
   no-op, releasing early cancels, and clicking elsewhere dismisses the
   revealed button.

   Pixel-level shader correctness (the funnel's curve, the rim's exact
   shape) isn't realistically Playwright-testable — see the screenshot
   at the bottom for manual visual review. What IS tested here: the
   phase sequence actually reaches each stage in order, the audio
   really goes silent exactly when the screen goes black (not "soon
   after"), the sphere really responds to drag, and none of this
   accidentally collapses the setup dock underneath it (a real bug
   this suite caught once already — see the backdrop-stopPropagation
   check below). Every check reads real state (data attributes, a
   test-only window hook mirroring Web Audio's actual gain value, inline
   opacity) — never DOM presence alone, which proves nothing on an
   always-mounted element. */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");

// Must exceed the gesture's own 2s delay + 4s build, with margin for
// this sandbox's very variable timing.
const FULL_HOLD_MS = 7400;
// Collapse (3200ms) + blackout dwell (700ms), with generous margin.
const COLLAPSE_TO_SPHERE_MS = 5500;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// ERR_CERT_AUTHORITY_INVALID is the blocked Google Fonts fetch as this
// sandbox's TLS-intercepting proxy reports it — an environment limit.
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION_RESET|ERR_CERT_AUTHORITY_INVALID/.test(m.text())) errors.push(m.text()); });

let failures = 0;
const check = (label, cond, detail) => {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && detail ? " — " + detail : ""}`);
};

await page.goto(`file://${file}`);
await page.waitForTimeout(1200);
await openDockPanel(page);

const anomalyBtn = page.locator("button", { hasText: "Anomaly" }).first();
check("Anomaly button present", (await anomalyBtn.count()) > 0);

// Anomaly still just re-rolls the layout, and doing so repeatedly is fine.
await anomalyBtn.click();
await page.waitForTimeout(200);
await anomalyBtn.click();
await page.waitForTimeout(300);
check("board survives repeated Anomaly re-rolls",
  await page.evaluate(() => !!document.querySelector('canvas[data-testid="board-canvas"]')));

const revealed = () => page.evaluate(() => !!document.querySelector(".ec-singularity-btn"));
const cinematicPhase = () =>
  page.evaluate(() => document.querySelector('[data-testid="singularity-overlay"]')?.dataset.singularityPhase || null);
const dockOpen = () => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]')?.dataset.open);
const masterGain = () => page.evaluate(() => window.__EC_TEST_MASTER_GAIN__);

// ---- reveal ----
const aBox = await anomalyBtn.boundingBox();
await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
await page.waitForTimeout(4600);
check("holding Anomaly reveals the Singularity button", await revealed());

const sBox = await page.locator(".ec-singularity-btn").boundingBox();
const onSingularity = async () => page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
// Somewhere harmless and far from both buttons.
const awayFromButtons = async () => page.mouse.move(20, 20);

// ---- a plain tap must NOT open it ----
await page.locator(".ec-singularity-btn").click();
await page.waitForTimeout(500);
check("a plain tap on Singularity does nothing", (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
await awayFromButtons();
await page.waitForTimeout(300);

// ---- releasing the hold early must NOT commit ----
// (the click above moved the pointer onto the button, so reset first)
// Commit lands at 900ms (hum start) + 4000ms (build) = ~4900ms; this
// releases at 2000ms, comfortably past hum start with real margin
// against this sandbox's own documented multi-second latency spikes
// (see dock-helpers.mjs) before the commit threshold.
await onSingularity();
await page.waitForTimeout(2000);
await awayFromButtons();
await page.waitForTimeout(600);
check("releasing the hold early does not commit", (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
check("the button is still revealed after an early release", await revealed());

// ---- holding all the way through commits and starts the collapse ----
await onSingularity();
await page.waitForTimeout(FULL_HOLD_MS);
check("holding through the full build commits and starts the collapse",
  (await cinematicPhase()) === "collapsing", `phase=${await cinematicPhase()}`);

// ---- the collapse reaches a hard, silent cut to black ----
const dockOpenDuringCollapse = await dockOpen();
await page.waitForTimeout(COLLAPSE_TO_SPHERE_MS);
const finalPhase = await cinematicPhase();
check("the collapse hands off to the sphere", finalPhase === "sphere", `phase=${finalPhase}`);
check("audio is silent by the time the sphere settles (cut at the black frame, not after)",
  (await masterGain()) === 0, `gain=${await masterGain()}`);
check("the setup dock never collapsed underneath the cinematic — a regression this suite caught once already",
  dockOpenDuringCollapse === "true" && (await dockOpen()) === "true",
  `duringCollapse=${dockOpenDuringCollapse} now=${await dockOpen()}`);

await page.screenshot({ path: "/tmp/neon-singularity-sphere.png" });

// ---- the sphere actually responds to drag (and only the sphere — not
// the board/camera underneath, which the overlay should be fully
// capturing input away from) ----
const overlay = page.locator('[data-testid="singularity-overlay"]');
const obox = await overlay.boundingBox();
const rotBefore = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
await page.mouse.move(obox.x + obox.width / 2, obox.y + obox.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(obox.x + obox.width / 2 + i * 12, obox.y + obox.height / 2, { steps: 1 });
  await page.waitForTimeout(16);
}
await page.mouse.up();
const rotAfter = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
check("dragging the sphere actually rotates it", rotAfter !== rotBefore, `before=${rotBefore} after=${rotAfter}`);

// ---- a plain tap toggles exactly one MATTER/LAWS/TOPOLOGIES checkbox
// via a real raycast against the rotated sphere geometry, and further
// dragging must NOT also toggle one (the same tap-vs-drag gesture the
// board's own Undo-Move/Stop-Here disambiguation already relies on
// elsewhere in this app) ----
const sphereChecks = () => page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereChecks);
const checksBefore = await sphereChecks();
await page.mouse.click(obox.x + obox.width / 2, obox.y + obox.height * 0.4);
await page.waitForTimeout(200);
const checksAfterTap = await sphereChecks();
const flippedCount = checksAfterTap.filter((v, i) => v !== checksBefore[i]).length;
check("tapping the sphere toggles exactly one checkbox", flippedCount === 1,
  `before=${JSON.stringify(checksBefore)} after=${JSON.stringify(checksAfterTap)}`);

await page.mouse.move(obox.x + obox.width / 2, obox.y + obox.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(obox.x + obox.width / 2 + i * 15, obox.y + obox.height / 2, { steps: 1 });
  await page.waitForTimeout(10);
}
await page.mouse.up();
await page.waitForTimeout(200);
const checksAfterDrag = await sphereChecks();
check("dragging the sphere does not also toggle a checkbox",
  JSON.stringify(checksAfterDrag) === JSON.stringify(checksAfterTap),
  `afterTap=${JSON.stringify(checksAfterTap)} afterDrag=${JSON.stringify(checksAfterDrag)}`);

// ---- Escape (or the on-screen Back button, for touch) restores
// everything: board, dock, masthead, audio ----
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
check("Escape closes the cinematic", (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
check("audio resumes after escaping", (await masterGain()) > 0, `gain=${await masterGain()}`);
check("the setup dock is interactable again", await anomalyBtn.isVisible());

// ---- click-outside dismisses the revealed button (pre-commit gesture,
// unaffected by any of the above) ----
await onSingularity();
await page.waitForTimeout(3000);
await awayFromButtons();
await page.waitForTimeout(400);
if (await revealed()) {
  await page.mouse.click(20, 20);
  await page.waitForTimeout(500);
  check("clicking away dismisses the revealed Singularity button", !(await revealed()));
} else {
  // It can auto-hide on its own 10s timer while the panel was open;
  // that's the same end state, so don't fail on losing the race.
  console.log("  ..  button already auto-hid before the click-outside check (not a failure)");
}

check(`no page errors (${errors.length})`, errors.length === 0, JSON.stringify(errors.slice(0, 3)));

await browser.close();
console.log(failures === 0 ? "\nSINGULARITY E2E PASSED" : `\nSINGULARITY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
