/* Neon's Singularity: the Anomaly random-setup button, the phantom
   reveal, the hold gesture that commits, the collapse/blackout/sphere
   cinematic, and the sphere's own menu — root labels distributed
   around the sphere (MATTER/LAWS/TOPOLOGIES), each opening a real
   holographic overlay of sub-items, finished by a triple-tap that
   reveals a BEGIN GAME summary menu with real Opponent/AI controls
   (SINGULARITY_DESIGN.md Part 1, themes/neon-singularity.js).

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
   after"), the sphere really responds to drag, tapping a root label
   opens the right holographic overlay, its checkboxes/drum rollers
   actually mutate the real selections (and clicking outside closes it
   without losing them), a bare-sphere triple-tap reveals the summary
   menu, and Opponent/AI/Begin Game on that menu drive the exact same
   game-start path the normal dock does — not a re-implementation of
   it. Every check reads real state (data attributes, a test-only
   window hook mirroring both Web Audio's actual gain value and the
   sphere's own selections, inline opacity, aria-pressed) — never DOM
   presence alone, which proves nothing on an always-mounted element. */

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
const sphereState = () => page.evaluate(() => window.__EC_TEST_SINGULARITY__);

async function holdAnomalyThenSingularity() {
  const aBox = await anomalyBtn.boundingBox();
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
  await page.waitForTimeout(4600);
  const sBox = await page.locator(".ec-singularity-btn").boundingBox();
  await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.waitForTimeout(FULL_HOLD_MS);
  await page.waitForTimeout(COLLAPSE_TO_SPHERE_MS);
}

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
// Raw coordinate mouse.down/up rather than locator().click(): the
// button hovers = holds for a mouse (see beginSingularityCommitHold),
// and locator().click() re-checks hit-testing before each attempt,
// retrying (mouse left sitting on the button the whole time) when this
// sandbox's documented multi-second latency spikes make the element
// transiently "unstable" — enough stray dwell time to accidentally
// arm and complete the real hold-to-commit gesture. A raw coordinate
// tap dispatches immediately with no such retry loop, so it can't
// balloon into an accidental hold.
await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
await page.mouse.down();
await page.mouse.up();
await awayFromButtons();
await page.waitForTimeout(500);
check("a plain tap on Singularity does nothing", (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
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

// ---- root label geometry setup. The drag-actually-rotates-it check
// runs LATER (after the tap-driven overlay tests below), deliberately:
// a drag doesn't return the sphere to its starting orientation when
// released (only the COAST velocity decays to zero — the rotation
// itself is permanent, exactly as a real momentum-driven drag should
// behave), so testing it here first would leave whichever label is
// currently front no longer centered under the very next "tap dead
// center" assumption those tests depend on. ----
const overlay = page.locator('[data-testid="singularity-overlay"]');
const obox = await overlay.boundingBox();
const cx = obox.x + obox.width / 2;
const cy = obox.y + obox.height / 2;

async function dragSphereBy(dx) {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy, { steps: 1 });
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
}

const closeOverlay = async () => {
  await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
  await page.waitForTimeout(200);
};

// ---- root labels are distributed around the sphere with no checkbox
// of their own; whichever label the sphere's own per-cycle shuffle
// (shuffleRootLabels, themes/neon-singularity.js) assigned the u=0.5
// slot sits front-and-center after the BLACKOUT->SPHERE auto-centering
// raycast, so a plain tap dead center opens ITS holographic overlay —
// MATTER isn't guaranteed to be that label any more, so read the
// actual arrangement off the test hook rather than assuming it ----
let state = await sphereState();
const frontKey = state.rootLabels?.find((r) => Math.abs(r.u - 0.5) < 1e-6)?.key;
await page.mouse.click(cx, cy);
await page.waitForTimeout(250);
state = await sphereState();
check("tapping the front-facing root label opens its overlay",
  state.stage === "overlay" && state.activeCategory === frontKey,
  `frontKey=${frontKey} ${JSON.stringify(state)}`);
check("the category overlay is actually rendered",
  (await page.locator('[data-testid="category-overlay"]').count()) > 0);
await closeOverlay();

// Brings a given root label's overlay into view regardless of where
// the per-cycle shuffle put it: taps the currently-front label, and if
// it's not the target, closes that overlay and drags a third of the
// way around (matching the fixed 120-degree spacing between labels)
// before trying again. At most 2 drags ever suffice — 3 labels, 3
// possible starting positions relative to the target.
async function navigateToCategory(targetKey) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(250);
    const s = await sphereState();
    if (s.activeCategory === targetKey) return s;
    await closeOverlay();
    await dragSphereBy(420);
    await page.waitForTimeout(650); // let the release coast decay out
  }
  return sphereState();
}

state = await navigateToCategory("matter");
check("dragging brings MATTER into view regardless of the shuffled arrangement",
  state.activeCategory === "matter", `activeCategory=${state.activeCategory}`);

// ---- LAWS/MATTER get real checkboxes for their sub-items ----
const archBefore = state.selections.matter.newPieces.arch;
await page.locator('[data-testid="matter-piece-arch"]').click();
await page.waitForTimeout(150);
state = await sphereState();
check("a MATTER checkbox actually toggles the real selection", state.selections.matter.newPieces.arch === !archBefore,
  `before=${archBefore} after=${state.selections.matter.newPieces.arch}`);

// ---- MATTER also gets a scroll wheel for each of the five ORIGINAL
// pieces, not just the four new ones, so a roster can be customized ----
await page.locator('[data-testid="roster-cabeza-inc"]').click();
await page.waitForTimeout(120);
state = await sphereState();
check("a MATTER roster drum increments its piece count", state.selections.matter.roster.cabeza === 2,
  `roster=${JSON.stringify(state.selections.matter.roster)}`);
// Cabeza is capped at 2 per SINGULARITY_DESIGN.md ("at least one
// required, at most two allowed") — a further increment must clamp,
// not keep climbing.
await page.locator('[data-testid="roster-cabeza-inc"]').click();
await page.waitForTimeout(120);
state = await sphereState();
check("the roster drum clamps at its declared max", state.selections.matter.roster.cabeza === 2,
  `roster.cabeza=${state.selections.matter.roster.cabeza}`);

// ---- clicking outside the overlay closes it, returning control to
// sphere rotation, without discarding the edits just made ----
await closeOverlay();
state = await sphereState();
check("clicking outside the overlay closes it", state.stage === "labels", `stage=${state.stage}`);
check("closing the overlay keeps the edits made inside it",
  state.selections.matter.newPieces.arch === true && state.selections.matter.roster.cabeza === 2,
  JSON.stringify(state.selections.matter));

// ---- TOPOLOGIES gets a drum roller per board dimension instead of
// checkboxes, clamped to the engine's own MIN/MAX_BOARD_DIM (6/20) ----
state = await navigateToCategory("topologies");
check("dragging brings TOPOLOGIES into view regardless of the shuffled arrangement",
  state.activeCategory === "topologies", `activeCategory=${state.activeCategory}`);

if (state.activeCategory === "topologies") {
  for (let i = 0; i < 20; i++) await page.locator('[data-testid="board-rows-inc"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  check("TOPOLOGIES' rows drum clamps at the engine's own MAX_BOARD_DIM (20)",
    state.selections.topologies.rows === 20, `rows=${state.selections.topologies.rows}`);

  for (let i = 0; i < 20; i++) await page.locator('[data-testid="board-cols-dec"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  check("TOPOLOGIES' cols drum clamps at the engine's own MIN_BOARD_DIM (6)",
    state.selections.topologies.cols === 6, `cols=${state.selections.topologies.cols}`);

  await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
  await page.waitForTimeout(200);
}

// ---- the sphere actually responds to drag (and only the sphere — not
// the board/camera underneath, which the overlay should be fully
// capturing input away from). Run last among the labels-stage checks,
// now that nothing downstream depends on a particular label being
// centered any more. ----
const rotBefore = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
await dragSphereBy(96);
const rotAfter = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
check("dragging the sphere actually rotates it", rotAfter !== rotBefore, `before=${rotBefore} after=${rotAfter}`);

await page.screenshot({ path: "/tmp/neon-singularity-labels.png" });

// ---- Escape (or the on-screen Back button, for touch) restores
// everything: board, dock, masthead, audio — from any sub-stage, not
// just the root labels (an overlay was open moments ago). ----
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

// ---- a fresh full cycle, taken all the way through triple-tap and a
// real Begin Game — the most committal path through the sphere, kept
// as its own pass since it ends the cinematic by genuinely starting a
// game rather than leaving anything to test afterward ----
// The click-away-dismiss check just clicked (20,20), well outside the
// dock card — the same click chassis uses to close the panel itself,
// so it has to be reopened before the next hold gesture can reach
// Anomaly at all.
await openDockPanel(page);
await holdAnomalyThenSingularity();
check("a fresh cycle reaches the sphere again", (await cinematicPhase()) === "sphere", `phase=${await cinematicPhase()}`);

const overlay2 = page.locator('[data-testid="singularity-overlay"]');
const obox2 = await overlay2.boundingBox();
const cx2 = obox2.x + obox2.width / 2;
const cy2 = obox2.y + obox2.height / 2;

// Triple-tapping BARE sphere (well outside any root label's latitude
// band, near the pole) finalizes every selection and reveals the
// summary menu — a plain tap there must NOT open a category first.
const bareX = cx2;
const bareY = obox2.y + obox2.height * 0.15;
for (let i = 0; i < 3; i++) {
  await page.mouse.click(bareX, bareY);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(250);
state = await sphereState();
check("triple-tapping bare sphere finalizes to the summary menu", state.stage === "summary", `stage=${state.stage}`);
check("the summary menu is actually rendered",
  (await page.locator('[data-testid="singularity-summary-menu"]').count()) > 0);

// ---- the summary menu's Opponent/AI controls are the chassis's real
// state/setters, not a re-implementation — picking one really flips it ----
await page.locator('[data-testid="opponent-ai-dark"]').click();
await page.waitForTimeout(150);
const aiDarkPressed = await page.locator('[data-testid="opponent-ai-dark"]').getAttribute("aria-pressed");
check("picking AI Dark on the summary menu marks it pressed", aiDarkPressed === "true", `aria-pressed=${JSON.stringify(aiDarkPressed)}`);
await page.locator('[data-testid="ai-difficulty-hard"]').click();
await page.waitForTimeout(150);
const hardPressed = await page.locator('[data-testid="ai-difficulty-hard"]').getAttribute("aria-pressed");
check("picking a difficulty on the summary menu marks it pressed", hardPressed === "true", `aria-pressed=${JSON.stringify(hardPressed)}`);

await page.screenshot({ path: "/tmp/neon-singularity-summary.png" });

// ---- BEGIN GAME on the summary menu fires the exact same game-start
// path the dock's own Begin Game button uses, then tears the
// cinematic down onto an already-armed game rather than an untouched
// setup screen ----
await page.locator('[data-testid="singularity-begin-game"]').click();
await page.waitForTimeout(700);
check("Begin Game on the summary menu closes the cinematic",
  (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
const statusAfterBegin = await page.evaluate(() => {
  const spans = [...document.querySelectorAll("span")];
  return spans.map((s) => s.textContent).find((t) => /to move|thinking/i.test(t || ""));
});
check("Begin Game on the summary menu actually starts a real game",
  !!statusAfterBegin, `statusAfterBegin=${JSON.stringify(statusAfterBegin)}`);

check(`no page errors (${errors.length})`, errors.length === 0, JSON.stringify(errors.slice(0, 3)));

await browser.close();
console.log(failures === 0 ? "\nSINGULARITY E2E PASSED" : `\nSINGULARITY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
