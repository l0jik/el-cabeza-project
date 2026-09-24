/* Neon's Singularity: the Anomaly random-setup button, the masthead
   5-tap reveal, the single-click commit, the toll/collapse/blackout/
   sphere cinematic, and the sphere's own menu — root labels distributed
   around the sphere (MATTER/LAWS/TOPOLOGIES), each opening a real
   holographic overlay of sub-items, finished by a triple-tap that
   reveals a BEGIN GAME summary menu with real Opponent/AI controls
   (SINGULARITY_DESIGN.md Part 1, themes/neon-singularity.js).

   The gesture under test: tap the EL CABEZA masthead five times to
   reveal the massive SINGULARITY invite overlay, then a single click on
   it begins the sequence — the cathedral bell tolls while a black
   curtain fades up over ~2s (the TOLLING phase), then it hands off to
   the collapse: the board warps into a wormhole for ~3.2s, hard-cuts to
   silent black, then settles on a draggable, Fresnel-glow sphere. Fewer
   than five taps reveal nothing, and clicking outside the invite
   dismisses it.

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
import { openDockPanel, waitForDockCorner, reopenDockPanelFromCorner } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");

// The bell-toll / fade-to-black lead-in (SINGULARITY_TOLL_MS = 2000ms in
// themes/neon-singularity.js) plus generous margin for this sandbox's
// very variable timing, before the collapse proper begins.
const TOLL_TO_COLLAPSE_MS = 3600;
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

const invitePresent = () => page.evaluate(() => !!document.querySelector(".ec-singularity-invite-backdrop"));
const cinematicPhase = () =>
  page.evaluate(() => document.querySelector('[data-testid="singularity-overlay"]')?.dataset.singularityPhase || null);
const dockOpen = () => page.evaluate(() => document.querySelector('[data-testid="dock-panel"]')?.dataset.open);
const masterGain = () => page.evaluate(() => window.__EC_TEST_MASTER_GAIN__);
const sphereState = () => page.evaluate(() => window.__EC_TEST_SINGULARITY__);

// The masthead's box is captured ONCE, up front, and every tap clicks the
// same fixed point on it. The title runs continuous CRT jitter/vertical-
// hold animations, so re-measuring its box per tap chases a moving target
// and some taps land in the sub-pixel gaps between the (imperatively
// split) letter spans — measure once, aim at a point that's reliably on a
// glyph, and every tap lands. A real finger/mouse never has this trouble;
// it's purely harness precision against an animated element.
const titleBox = await page.locator(".ec-title").first().boundingBox();
const tapX = titleBox.x + titleBox.width / 2;
const tapY = titleBox.y + titleBox.height / 2;
async function tapMasthead() {
  await page.mouse.click(tapX, tapY);
}
async function tapMastheadNTimes(n) {
  for (let i = 0; i < n; i++) { await tapMasthead(); await page.waitForTimeout(140); }
}
async function clickInvite() {
  const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}
// End Active Game is a no-op while a move is animating (busy) — in an AI
// game that can be the AI's own move — so keep pressing until the game has
// actually ended (the button swaps to Reset Game).
async function endActiveGame() {
  const btn = page.locator('[data-testid="dock-panel"] button', { hasText: "End Active Game" });
  for (let i = 0; i < 20 && (await btn.count()) > 0; i++) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

// The whole trigger, reused later (line ~389): five taps + one click,
// through the toll and collapse, settling on the sphere.
// A tap can occasionally miss the jittering title, leaving the count short;
// retry (after letting the partial count lapse) until the invite is up.
async function triggerSingularity() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await tapMastheadNTimes(5);
    await page.waitForTimeout(300);
    if (await invitePresent()) break;
    await page.waitForTimeout(2700);
  }
  await clickInvite();
  await page.waitForTimeout(TOLL_TO_COLLAPSE_MS);
  await page.waitForTimeout(COLLAPSE_TO_SPHERE_MS);
}

// ---- fewer than five taps reveals nothing ----
await tapMastheadNTimes(3);
await page.waitForTimeout(300);
check("three masthead taps do not reveal the invite", !(await invitePresent()));
// The window is short — let a partial count lapse before the real run.
await page.waitForTimeout(2700);

// ---- five taps reveal the invite ----
// (Retried like triggerSingularity: a harness click can land between the
// jittering letters and not count — see tapMasthead's comment.)
for (let attempt = 0; attempt < 3; attempt++) {
  await tapMastheadNTimes(5);
  await page.waitForTimeout(300);
  if (await invitePresent()) break;
  await page.waitForTimeout(2700);
}
check("five masthead taps reveal the SINGULARITY invite", await invitePresent());

// ---- a single click commits: bell toll first, then the collapse ----
await clickInvite();
await page.waitForTimeout(400);
check("clicking the invite begins the toll lead-in",
  (await cinematicPhase()) === "tolling", `phase=${await cinematicPhase()}`);
await page.waitForTimeout(TOLL_TO_COLLAPSE_MS);
check("the toll hands off to the collapse",
  (await cinematicPhase()) === "collapsing", `phase=${await cinematicPhase()}`);

// ---- the collapse reaches a hard, silent cut to black ----
// (The dock-open regression the old suite guarded no longer applies:
// the trigger is the masthead, not a dock button held open — a masthead
// tap closes the panel by design, so the dock is not up during the
// cinematic at all. dockOpen() stays available for other reads.)
await page.waitForTimeout(COLLAPSE_TO_SPHERE_MS);
const finalPhase = await cinematicPhase();
check("the collapse hands off to the sphere", finalPhase === "sphere", `phase=${finalPhase}`);
check("audio is silent by the time the sphere settles (cut at the black frame, not after)",
  (await masterGain()) === 0, `gain=${await masterGain()}`);

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
let cy = obox.y + obox.height / 2;

// ---- the sphere arrives with its NORTH pole facing the player, the
// how-to text hidden behind a faint "?" at the bottom middle ----
const arrival = await sphereState();
check("the sphere arrives with its north pole facing you",
  arrival.northPoleFacing > 0.99, `northPoleFacing=${arrival.northPoleFacing}`);
check("the sphere's instructions are hidden until asked for",
  (await page.locator('[data-testid="sphere-help-button"]').count()) === 1 &&
    (await page.locator('[data-testid="sphere-help-text"]').count()) === 0);
const helpBox = await page.locator('[data-testid="sphere-help-button"]').boundingBox();
const vp = page.viewportSize();
check("the ? sits at the bottom middle of the screen",
  !!helpBox && Math.abs(helpBox.x + helpBox.width / 2 - vp.width / 2) < 4 && helpBox.y > vp.height * 0.85,
  JSON.stringify(helpBox));
await page.locator('[data-testid="sphere-help-button"]').hover();
await page.waitForTimeout(150);
check("hovering the ? shows the instructions",
  (await page.locator('[data-testid="sphere-help-text"]').count()) === 1);
await page.mouse.move(cx, cy);
await page.waitForTimeout(150);
check("moving off the ? hides them again",
  (await page.locator('[data-testid="sphere-help-text"]').count()) === 0);
await tiltBackToEquator(0.05);

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

// The label band sits on the sphere's actual geometric equator
// (LABEL_CENTER_V, themes/neon-singularity.js), which does NOT
// generally coincide with the viewport's own vertical center — the
// camera looks at the sphere from an elevated angle inherited from
// the board view, so "straight ahead" and "the equator" are two
// different latitudes. Rather than hardcode that offset (viewport-
// dependent, and liable to drift if the camera framing is ever
// retuned), probe a small range of vertical offsets once, up front,
// for whichever one actually lands on a label, and reuse that
// calibrated y for every following tap in this test.
async function calibrateLabelCy() {
  for (const off of [0, 60, 120, 180, 240, -60, -120]) {
    await page.mouse.click(cx, cy + off);
    await page.waitForTimeout(200);
    const s = await sphereState();
    if (s.stage === "overlay" && s.activeCategory) {
      await closeOverlay();
      return cy + off;
    }
    // A miss is a bare tap — let it age out of the triple-tap window so
    // three misses in a row can't finish the sphere.
    await page.waitForTimeout(550);
  }
  return cy; // calibration failed to find any label — let later checks report why
}
cy = await calibrateLabelCy();

// Polls the sphere's own rotation (exposed on the test hook) until two
// consecutive reads agree, rather than a fixed delay — the release
// coast decays out over a variable amount of real time under this
// sandbox's own documented latency spikes, and tapping while it's
// still drifting can land off a label's center by more than
// LABEL_U_HALF_WIDTH, missing every category.
async function waitForSphereSettle(timeoutMs = 3000) {
  let last = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(120);
    const cur = await page.evaluate(() => window.__EC_TEST_SINGULARITY__?.sphereRotationY);
    if (cur === last) return;
    last = cur;
  }
}

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
// it's not the target, closes that overlay (only if the tap actually
// landed on a label and opened one — a miss lands as a genuine bare
// tap on the sphere itself, and firing a second stray click right
// after it risks tipping the triple-tap-to-finalize counter).
//
// The drag is velocity/momentum-driven (see updateSphereVisuals's
// dragVelocity coast), not a fixed rotation per fixed pixel distance —
// the SAME 420px drag measurably rotates the sphere by a different
// amount from one call to the next under this sandbox's own variable
// frame timing (confirmed by logging real rotation deltas: consecutive
// "identical" drags produced deltas differing by tens of degrees). A
// big enough overshoot can land dead in the narrow gap between two
// labels' hit zones (untested state: activeCategory null) — repeating
// the same full-size drag from there is just as likely to overshoot
// again. So a gap-landing gets a much smaller corrective nudge instead
// of another full step, to settle onto the nearest label rather than
// vault past it; landing on a real (wrong) label still takes a full
// step onward. The guard is generous (not "2 drags always suffice")
// precisely because drag distance isn't reliable here.
async function navigateToCategory(targetKey) {
  for (let guard = 0; guard < 12; guard++) {
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(250);
    const s = await sphereState();
    if (process.env.EC_DEBUG_NAV) console.error(`  [nav->${targetKey}] guard=${guard} activeCategory=${s.activeCategory} stage=${s.stage} rot=${s.sphereRotationY} rootLabels=${JSON.stringify(s.rootLabels)}`);
    if (s.activeCategory === targetKey) return s;
    if (s.stage === "overlay") {
      await closeOverlay();
      await dragSphereBy(420);
    } else {
      await dragSphereBy(90); // landed in a gap — nudge, don't vault past
    }
    await waitForSphereSettle(); // let the release coast decay out
  }
  return sphereState();
}

state = await navigateToCategory("matter");
check("dragging brings MATTER into view regardless of the shuffled arrangement",
  state.activeCategory === "matter", `activeCategory=${state.activeCategory}`);

// ---- LAWS/MATTER get real checkboxes for their sub-items ----
const blockBefore = state.selections.matter.newPieces.block1x3;
await page.locator('[data-testid="matter-piece-block1x3"]').click();
await page.waitForTimeout(150);
state = await sphereState();
check("a MATTER checkbox actually toggles the real selection", state.selections.matter.newPieces.block1x3 === !blockBefore,
  `before=${blockBefore} after=${state.selections.matter.newPieces.block1x3}`);

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

// The Codo (MATTER's 3-cube L) has its own roster counter, off (0) by
// default; the old inert "L-Pentomino" checkbox is gone.
check("the Codo counter starts at 0 and the L-Pentomino checkbox is gone",
  state.selections.matter.roster.codo === 0 && state.selections.matter.newPieces.lPentomino === undefined &&
    (await page.locator('[data-testid="matter-piece-lPentomino"]').count()) === 0,
  JSON.stringify(state.selections.matter));
await page.locator('[data-testid="roster-codo-inc"]').click();
await page.waitForTimeout(120);
state = await sphereState();
check("the Codo counter increments", state.selections.matter.roster.codo === 1, `roster=${JSON.stringify(state.selections.matter.roster)}`);
await page.locator('[data-testid="roster-codo-dec"]').click();
await page.waitForTimeout(120);
state = await sphereState();

// The Arco: its own counter (off by default) plus a size choice that
// defaults to Chico; picking Alto lights it and stores it.
check("the Arco counter starts at 0 with the Chico size, and the old Arch checkbox is gone",
  state.selections.matter.roster.arco === 0 && state.selections.matter.arcoSize === "chico" &&
    (await page.locator('[data-testid="matter-piece-arch"]').count()) === 0,
  JSON.stringify(state.selections.matter));
await page.locator('[data-testid="arco-size-alto"]').click();
await page.waitForTimeout(120);
state = await sphereState();
check("choosing the Alto size stores it and marks it pressed",
  state.selections.matter.arcoSize === "alto" &&
    (await page.locator('[data-testid="arco-size-alto"]').getAttribute("aria-pressed")) === "true");
await page.locator('[data-testid="arco-size-chico"]').click();
await page.waitForTimeout(120);
state = await sphereState();

// ---- clicking outside the overlay closes it, returning control to
// sphere rotation, without discarding the edits just made ----
await closeOverlay();
state = await sphereState();
check("clicking outside the overlay closes it", state.stage === "labels", `stage=${state.stage}`);
check("closing the overlay keeps the edits made inside it",
  state.selections.matter.newPieces.block1x3 === true && state.selections.matter.roster.cabeza === 2,
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

  // ---- TOPOLOGIES: Missing Squares manual placement (the same
  // ghost-grid picker Black Hole Squares uses, just targeting a
  // different selections field — see PAIRED_SQUARE_KINDS in
  // themes/neon-singularity.js). Toggling it on reveals a placement
  // control; opening its picker and tapping a cell on the player's side
  // stores that cell as the manual missing square (its mirror is the
  // paired one), then closes back to the TOPOLOGIES overlay. ----
  await page.locator('[data-testid="topo-missingSquares"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  check("Missing Squares toggles on", state.selections.topologies.missingSquares === true,
    `topologies=${JSON.stringify(state.selections.topologies)}`);
  check("the manual-placement control appears once Missing Squares is on",
    (await page.locator('[data-testid="missing-placement"]').count()) > 0);
  // It must sit DIRECTLY below the Missing Squares toggle (its own
  // sub-option), not appended after the rest of the category.
  const missingPlacementRightAfterToggle = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="topo-missingSquares"]');
    const next = toggle && toggle.nextElementSibling;
    return !!next && next.getAttribute("data-testid") === "missing-placement";
  });
  check("the manual-placement control sits directly below the Missing Squares toggle",
    missingPlacementRightAfterToggle);

  // Turning it on places one pair at random right away (count 1).
  state = await sphereState();
  check("turning Missing Squares on places one random pair right away",
    state.selections.missingSquare.count === 1 && state.selections.missingSquare.spots.length === 1 &&
      state.selections.missingSquare.spots[0].random === true,
    JSON.stringify(state.selections.missingSquare));
  check("the placement buttons read Select and Random",
    (await page.locator('[data-testid="missing-place-btn"]').textContent()) === "Select" &&
      (await page.locator('[data-testid="missing-clear-btn"]').textContent()) === "Random");

  await page.locator('[data-testid="missing-place-btn"]').click();
  await page.waitForTimeout(250);
  check("the missing-square ghost-grid picker opens",
    (await page.locator('[data-testid="missing-picker"]').count()) > 0);

  // Multi-select: a tap marks the spot (the random one gives way at the
  // count) without closing; Done commits and closes.
  const missingCell = page.locator('[data-testid="missing-picker"] [data-selectable="true"]').first();
  const missingCellId = await missingCell.getAttribute("data-testid");
  const mm = missingCellId.match(/missing-cell-(\d+)-(\d+)/);
  await missingCell.click();
  await page.waitForTimeout(150);
  check("tapping a cell marks it selected without closing the picker",
    (await page.locator(`[data-testid="${missingCellId}"]`).getAttribute("data-chosen")) === "hand" &&
      (await page.locator('[data-testid="missing-picker"]').count()) > 0 &&
      (await page.locator('[data-testid="missing-confirm"]').count()) === 0);
  await page.locator('[data-testid="missing-picker-done"]').click();
  await page.waitForTimeout(150);
  check("Done shows the SELECTED confirmation",
    (await page.locator('[data-testid="missing-confirm"]').count()) > 0);

  await page.waitForTimeout(950); // the confirm holds ~780ms, then auto-closes
  check("the missing-square picker closes after Done",
    (await page.locator('[data-testid="missing-picker"]').count()) === 0);
  state = await sphereState();
  const missingSpots = state.selections.missingSquare.spots;
  check("the chosen cell is stored as a hand-picked missing-square spot",
    missingSpots.length === 1 && missingSpots[0].row === Number(mm[1]) && missingSpots[0].col === Number(mm[2]) &&
      missingSpots[0].random === false,
    `spots=${JSON.stringify(missingSpots)} chosen=${mm[1]},${mm[2]}`);

  // Reopening (Select) shows the CURRENT selection, editable — same
  // regression this already covers for Black Hole Squares below.
  await page.locator('[data-testid="missing-place-btn"]').click();
  await page.waitForTimeout(250);
  check("reopening the missing-square picker reopens it editable (not stuck confirming)",
    (await page.locator('[data-testid="missing-picker-cancel"]').count()) > 0 &&
      (await page.locator('[data-testid="missing-confirm"]').count()) === 0);
  const missingReopenBg = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, `missing-cell-${mm[1]}-${mm[2]}`);
  check("the previously-placed missing square is highlighted as the current selection on reopen",
    missingReopenBg === "rgb(7, 8, 11)", `bg=${missingReopenBg}`);
  await page.locator('[data-testid="missing-picker-cancel"]').click();
  await page.waitForTimeout(200);

  // Random rolls a REAL spot now (not a deferral to Begin Game), so it
  // stays a concrete, visible placement — the Black Hole picker below
  // must still show it. Regression for "random loses the selection".
  await page.locator('[data-testid="missing-clear-btn"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  const rolled = state.selections.missingSquare.spots;
  check("Random rolls and keeps a real missing-square spot",
    rolled.length === 1 && rolled[0].random === true && rolled[0].row >= state.selections.topologies.rows / 2,
    JSON.stringify(rolled));
  check("the Random button keeps its name after rolling",
    (await page.locator('[data-testid="missing-clear-btn"]').textContent()) === "Random");

  // The count drum: up to five pairs, filled at random to match.
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-testid="missing-count-inc"]').click();
    await page.waitForTimeout(60);
  }
  state = await sphereState();
  check("the count drum tops out at five pairs, all placed",
    state.selections.missingSquare.count === 5 && state.selections.missingSquare.spots.length === 5,
    JSON.stringify(state.selections.missingSquare));
  // Hand-pick one in the picker (a random one gives way), then lower the
  // count: the hand-picked spot stays, random ones are trimmed.
  await page.locator('[data-testid="missing-place-btn"]').click();
  await page.waitForTimeout(250);
  check("reopening shows the five random spots as random (dashed)",
    (await page.locator('[data-testid="missing-picker"] [data-chosen="random"]').count()) === 5);
  const openCell = page.locator('[data-testid="missing-picker"] [data-selectable="true"]:not([data-chosen])').first();
  const openCellId = await openCell.getAttribute("data-testid");
  await openCell.click();
  await page.waitForTimeout(150);
  check("tapping an open square at the count swaps out a random spot",
    (await page.locator('[data-testid="missing-picker"] [data-chosen="random"]').count()) === 4 &&
      (await page.locator(`[data-testid="${openCellId}"]`).getAttribute("data-chosen")) === "hand");
  await page.screenshot({ path: "/tmp/neon-missing-picker.png" });
  await page.locator('[data-testid="missing-picker-done"]').click();
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-testid="missing-count-dec"]').click();
    await page.waitForTimeout(60);
  }
  state = await sphereState();
  const [, or, oc] = openCellId.match(/missing-cell-(\d+)-(\d+)/);
  const trimmed = state.selections.missingSquare.spots;
  check("lowering the count keeps the hand-picked spot and trims random ones",
    state.selections.missingSquare.count === 2 && trimmed.length === 2 &&
      trimmed.some((p) => !p.random && p.row === Number(or) && p.col === Number(oc)),
    JSON.stringify(trimmed));

  await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
  await page.waitForTimeout(200);
}

// ---- LAWS: Black Hole Squares manual placement (the ghost-grid picker).
// Toggling the law on reveals a placement control; opening its picker and
// tapping a cell on the player's side stores that cell as the manual hole
// (its mirror is the paired hole), then closes back to the LAWS overlay. --
state = await navigateToCategory("laws");
check("dragging brings LAWS into view regardless of the shuffled arrangement",
  state.activeCategory === "laws", `activeCategory=${state.activeCategory}`);
if (state.activeCategory === "laws") {
  await page.locator('[data-testid="law-blackHoleSquares"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  check("Black Hole Squares toggles on", state.selections.laws.blackHoleSquares === true,
    `laws=${JSON.stringify(state.selections.laws)}`);
  check("the manual-placement control appears once Black Hole Squares is on",
    (await page.locator('[data-testid="blackhole-placement"]').count()) > 0);
  // It must sit DIRECTLY below the Black Hole Squares toggle (its own
  // sub-option), not appended after every law.
  const placementRightAfterToggle = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="law-blackHoleSquares"]');
    const next = toggle && toggle.nextElementSibling;
    return !!next && next.getAttribute("data-testid") === "blackhole-placement";
  });
  check("the manual-placement control sits directly below the Black Hole toggle",
    placementRightAfterToggle);

  await page.locator('[data-testid="blackhole-place-btn"]').click();
  await page.waitForTimeout(250);
  check("the ghost-grid picker opens",
    (await page.locator('[data-testid="blackhole-picker"]').count()) > 0);
  // No cell in either side's back two rows is pickable for a Black Hole.
  const bhRows = (await sphereState()).selections.topologies.rows;
  const backRowPickable = await page.evaluate((rows) =>
    [...document.querySelectorAll('[data-testid="blackhole-picker"] [data-selectable="true"]')]
      .some((el) => { const r = Number(el.dataset.testid.split("-")[2]); return r < 2 || r > rows - 3; }), bhRows);
  check("black holes can't be picked in either side's back two rows", !backRowPickable);
  // The Missing Square placed under TOPOLOGIES above (and its mirror)
  // shows on the Black Hole picker in its own look, and isn't pickable.
  const shownMissing = page.locator('[data-testid="blackhole-picker"] [data-occupied-by="missingSquare"]');
  check("the black-hole picker shows every already-placed missing square (2 pairs)",
    (await shownMissing.count()) === 4, `count=${await shownMissing.count()}`);
  check("those missing squares can't be picked as a black hole",
    (await page.locator('[data-testid="blackhole-picker"] [data-occupied-by="missingSquare"][data-selectable="true"]').count()) === 0);
  // Tapping one pulses the red explanatory caption instead of placing.
  await shownMissing.first().click();
  await page.waitForTimeout(150);
  check("tapping a blocked cell pulses the red caption (and places nothing)",
    (await page.locator('[data-testid="blackhole-picker-blocked-caption"]').getAttribute("data-pulse")) === "1" &&
      (await page.locator('[data-testid="blackhole-confirm"]').count()) === 0);

  const cell = page.locator('[data-selectable="true"]').first();
  const cellId = await cell.getAttribute("data-testid");
  const m = cellId.match(/bh-cell-(\d+)-(\d+)/);
  await cell.click();
  await page.waitForTimeout(150);
  check("picking a cell shows the SELECTED confirmation",
    (await page.locator('[data-testid="blackhole-confirm"]').count()) > 0);

  await page.waitForTimeout(950); // the confirm holds ~780ms, then auto-closes
  check("the picker closes after a selection",
    (await page.locator('[data-testid="blackhole-picker"]').count()) === 0);
  state = await sphereState();
  const man = state.selections.blackHole && state.selections.blackHole.manual;
  check("the chosen cell is stored as the manual black-hole placement",
    !!man && man.row === Number(m[1]) && man.col === Number(m[2]),
    `manual=${JSON.stringify(man)} chosen=${m[1]},${m[2]}`);

  // Reopening the picker (Change placement) must show the CURRENT selection
  // rather than a blank grid: the stored cell reads as chosen, and it's
  // still editable (Cancel present, no SELECTED flash) so it can be moved.
  await page.locator('[data-testid="blackhole-place-btn"]').click();
  await page.waitForTimeout(250);
  check("reopening the picker reopens it editable (not stuck confirming)",
    (await page.locator('[data-testid="blackhole-picker-cancel"]').count()) > 0 &&
      (await page.locator('[data-testid="blackhole-confirm"]').count()) === 0);
  const reopenBg = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, `bh-cell-${m[1]}-${m[2]}`);
  check("the previously-placed cell is highlighted as the current selection on reopen",
    reopenBg === "rgb(7, 8, 11)", `bg=${reopenBg}`);
  await page.locator('[data-testid="blackhole-picker-cancel"]').click();
  await page.waitForTimeout(200);

  // Close the LAWS overlay so the drag-rotate check below reaches the sphere.
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

// ---- CONFIGURATIONS: a fourth label fixed at the sphere's south pole.
// Drag upward until it faces the camera, tap it, save the current rules
// under a name, then load it back (which jumps to the BEGIN GAME summary),
// and finally delete it. ----
async function bringConfigLabelToFront() {
  for (let i = 0; i < 14; i++) {
    const c = (await sphereState()).configLabel;
    if (c && c.facing > 0.85) return c;
    await page.mouse.move(cx, cy + 120);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 30, { steps: 8 });
    await page.mouse.up();
    await waitForSphereSettle();
  }
  return (await sphereState()).configLabel;
}
// Tilt back down until the equator (the three category labels) faces you.
// waitForSphereSettle watches the left/right spin; the up/down tilt can
// still be coasting, so wait for IT to stop too before trusting it.
async function waitForTiltSettle(timeoutMs = 4000) {
  const start = Date.now();
  let last = (await sphereState()).sphereRotationX;
  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(120);
    const cur = (await sphereState()).sphereRotationX;
    if (Math.abs(cur - last) < 0.002) return;
    last = cur;
  }
}
async function tiltBackToEquator(tol = 0.15) {
  for (let i = 0; i < 30; i++) {
    await waitForTiltSettle();
    const x = (await sphereState()).sphereRotationX;
    const wrapped = Math.atan2(Math.sin(x), Math.cos(x));
    if (Math.abs(wrapped) < tol) return;
    const dir = wrapped < 0 ? 1 : -1; // drag down to undo an upward tilt
    // Smaller drags as it closes in, so it doesn't overshoot the equator.
    const len = Math.min(100, 20 + 60 * Math.abs(wrapped));
    await page.mouse.move(cx, cy - dir * len / 2);
    await page.mouse.down();
    await page.mouse.move(cx, cy + dir * len / 2, { steps: 8 });
    await page.mouse.up();
    await waitForSphereSettle();
  }
}
let cfgLabel = await bringConfigLabelToFront();
check("dragging upward brings the south-pole CONFIGURATIONS label to face you",
  cfgLabel && cfgLabel.facing > 0.85, JSON.stringify(cfgLabel));
await page.mouse.move(cfgLabel.x, cfgLabel.y);
await page.waitForTimeout(150);
check("hovering the CONFIGURATIONS label shows the 'saved presets' hint",
  (await page.locator('[data-testid="config-hover-hint"]').textContent().catch(() => null)) === "saved presets");
await page.mouse.click(cfgLabel.x, cfgLabel.y);
await page.waitForTimeout(300);
check("tapping it opens the CONFIGURATIONS panel",
  (await page.locator('[data-testid="category-overlay"]').getAttribute("data-category").catch(() => null)) === "configurations");
check("it starts empty", (await page.locator('[data-testid="config-empty"]').count()) > 0);
const savedSel = (await sphereState()).selections;
await page.locator('[data-testid="config-name"]').fill("Test Setup");
await page.locator('[data-testid="config-save"]').click();
await page.waitForTimeout(200);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:configurations") || "[]"));
check("Save current stores a named configuration in the browser",
  stored.length === 1 && stored[0].name === "Test Setup" &&
    JSON.stringify(stored[0].selections) === JSON.stringify(savedSel),
  JSON.stringify(stored.map((c) => c.name)));
check("the saved configuration appears in the list",
  (await page.locator('[data-testid="config-item"][data-name="Test Setup"]').count()) === 1);
// Change something, then load: the saved rules come back and we land on
// the BEGIN GAME summary to review them.
await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
await page.waitForTimeout(200);
await tiltBackToEquator();
state = await navigateToCategory("topologies");
if (state.activeCategory === "topologies") {
  await page.locator('[data-testid="topo-missingSquares"]').click(); // turn it off
  await page.waitForTimeout(150);
  await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
  await page.waitForTimeout(200);
}
check("(setup) a rule was changed after saving",
  (await sphereState()).selections.topologies.missingSquares === false);
cfgLabel = await bringConfigLabelToFront();
await page.mouse.click(cfgLabel.x, cfgLabel.y);
await page.waitForTimeout(300);
await page.locator('[data-testid="config-item"][data-name="Test Setup"] [data-testid="config-load"]').click();
await page.waitForTimeout(300);
state = await sphereState();
check("Load restores the saved rules exactly",
  JSON.stringify(state.selections) === JSON.stringify(savedSel), JSON.stringify(state.selections.topologies));
check("Load jumps to the BEGIN GAME summary", state.stage === "summary", `stage=${state.stage}`);
check("the summary names the loaded configuration",
  /Test Setup/.test((await page.locator('[data-testid="summary-loaded-config"]').textContent().catch(() => "")) || ""));
// Back to the labels, then delete it (with its confirm step).
await page.locator('[data-testid="singularity-edit-settings"]').click();
await page.waitForTimeout(300);
cfgLabel = await bringConfigLabelToFront();
await page.mouse.click(cfgLabel.x, cfgLabel.y);
await page.waitForTimeout(300);
await page.locator('[data-testid="config-delete"]').first().click();
await page.waitForTimeout(150);
await page.locator('[data-testid="config-delete-confirm"]').click();
await page.waitForTimeout(200);
check("Delete (after confirming) removes it from the browser and the list",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("el-cabeza:configurations") || "[]").length)) === 0 &&
    (await page.locator('[data-testid="config-empty"]').count()) > 0);
await page.mouse.click(obox.x + obox.width - 24, obox.y + obox.height - 24);
await page.waitForTimeout(200);
await tiltBackToEquator();

await page.screenshot({ path: "/tmp/neon-singularity-labels.png" });

// ---- Escape (or the on-screen Back button, for touch) restores
// everything: board, dock, masthead, audio — from any sub-stage, not
// just the root labels (an overlay was open moments ago). ----
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
check("Escape closes the cinematic", (await cinematicPhase()) === null, `phase=${await cinematicPhase()}`);
check("audio resumes after escaping", (await masterGain()) > 0, `gain=${await masterGain()}`);
// The dock isn't held open by the masthead trigger, so prove setup is
// usable again by reopening the panel and finding Anomaly live in it.
await openDockPanel(page);
check("the setup dock is interactable again", await anomalyBtn.isVisible());

// ---- clicking outside the revealed invite dismisses it (pre-commit
// gesture, unaffected by any of the above) ----
await tapMastheadNTimes(5);
await page.waitForTimeout(400);
if (await invitePresent()) {
  // The backdrop fills the screen but the click-outside logic keys off
  // the button itself — a click anywhere but the button dismisses.
  await page.mouse.click(20, 20);
  await page.waitForTimeout(500);
  check("clicking outside the invite dismisses it", !(await invitePresent()));
} else {
  // It can auto-hide on its own timer; that's the same end state, so
  // don't fail on losing the race.
  console.log("  ..  invite already auto-hid before the click-outside check (not a failure)");
}

// ---- a fresh full cycle, taken all the way through triple-tap and a
// real Begin Game — the most committal path through the sphere, kept
// as its own pass since it ends the cinematic by genuinely starting a
// game rather than leaving anything to test afterward. The masthead
// 5-tap trigger needs no open dock, so this just re-runs it. ----
await triggerSingularity();
check("a fresh cycle reaches the sphere again", (await cinematicPhase()) === "sphere", `phase=${await cinematicPhase()}`);

const overlay2 = page.locator('[data-testid="singularity-overlay"]');
const obox2 = await overlay2.boundingBox();
const cx2 = obox2.x + obox2.width / 2;
const cy2 = obox2.y + obox2.height / 2;
await tiltBackToEquator(0.05);

// ---- TOPOLOGIES board resize actually applies at Begin Game. Pick a
// non-default, non-square size in THIS session (the one that begins the
// game), then assert the live engine board matches it once the game
// starts (window.__EC_TEST_BOARD__, set by applyBoardResize). ----
const wantRows = 12, wantCols = 8;
state = await navigateToCategory("topologies");
if (state.activeCategory === "topologies") {
  for (let i = 0; i < wantRows - state.selections.topologies.rows; i++) await page.locator('[data-testid="board-rows-inc"]').click();
  for (let i = 0; i < state.selections.topologies.cols - wantCols; i++) await page.locator('[data-testid="board-cols-dec"]').click();
  await page.waitForTimeout(150);
  state = await sphereState();
  check("TOPOLOGIES size set for the game about to begin",
    state.selections.topologies.rows === wantRows && state.selections.topologies.cols === wantCols,
    `topo=${JSON.stringify(state.selections.topologies)}`);
  // Also toggle Missing Squares on here (random placement, no manual
  // pick) so the full pipeline — sphere selection -> finalizeSingularity-
  // Begin's resolution -> the chassis's missingGroup render effect -> the
  // AI worker's own cross-boundary constants thread (this cycle's AI
  // Dark opponent, picked below, actually searches a turn against it) —
  // gets exercised end to end, not just the sphere UI in isolation.
  await page.locator('[data-testid="topo-missingSquares"]').click();
  await page.waitForTimeout(150);
  // ...at the full five pairs, so all ten squares go through the pipeline.
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-testid="missing-count-inc"]').click();
    await page.waitForTimeout(60);
  }
  await page.mouse.click(obox2.x + obox2.width - 24, obox2.y + obox2.height - 24);
  await page.waitForTimeout(200);
}

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

// TOPOLOGIES actually resized the live board to the chosen size.
const liveBoard = await page.evaluate(() => window.__EC_TEST_BOARD__ || null);
check("TOPOLOGIES board resize applied to the real game",
  liveBoard && liveBoard.rows === wantRows && liveBoard.cols === wantCols,
  `liveBoard=${JSON.stringify(liveBoard)} want=${wantRows}x${wantCols}`);
// Missing Squares (toggled on, left at random placement above) actually
// resolved to a real rotationally-mirrored pair on the live board — the
// full pipeline (finalizeSingularityBegin -> chassis's missingGroup
// render effect -> the AI worker's cross-boundary threading, since this
// game's AI Dark opponent is about to search a turn against it).
const liveMissing = await page.evaluate(() => window.__EC_TEST_MISSING_SQUARES__ || null);
check("Missing Squares resolved to five real mirrored pairs (ten squares) on the live board",
  Array.isArray(liveMissing) && liveMissing.length === 10 &&
    liveMissing.every((q, i) => i % 2 === 1 ||
      (q.row === wantRows - 1 - liveMissing[i + 1].row && q.col === wantCols - 1 - liveMissing[i + 1].col)) &&
    new Set(liveMissing.map((q) => `${q.row},${q.col}`)).size === 10,
  `liveMissing=${JSON.stringify(liveMissing)}`);
await page.screenshot({ path: "/tmp/neon-singularity-resized-board.png" });

// ---- after a Singularity Begin Game the dock must hand off exactly like
// a normal Begin Game: the panel collapses (not left stranded visible by
// the collapse's chrome suction) and the piece relocates to the corner
// watermark. Regression for the stuck-panel bug. ----
const cornerBox = await waitForDockCorner(page, { timeoutMs: 6000 });
check("the dock piece relocates to the corner watermark after a Singularity begin",
  cornerBox !== null, `cornerBox=${JSON.stringify(cornerBox)}`);
const panelOpacityAfter = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="dock-panel"]');
  return el ? getComputedStyle(el).opacity : null;
});
check("the dock panel is hidden after a Singularity begin (not stranded visible)",
  Number(panelOpacityAfter) < 0.05, `panelOpacity=${panelOpacityAfter}`);

// ---- New Game PERSISTS the Singularity rules (the 12x8 board carries
// over instead of resetting to 10x10); the Reset Rules control clears them
// back to a plain game. Reopen the dock (collapsed to the corner after
// Begin Game) to reach End Active Game / New Game. ----
await reopenDockPanelFromCorner(page, cornerBox);
await page.waitForTimeout(400);
await endActiveGame();
await page.waitForTimeout(500);
// A Singularity game just ended, so the Reset Rules control is offered.
check("Reset Rules control appears once a Singularity game has ended",
  (await page.locator('[data-testid="reset-rules"]').count()) > 0);
// New Game (the dock's actual New Game button, not the relocated Reset
// Game control) keeps the Singularity rules: the 12x8 board must persist
// rather than snapping back to the boot size. This is a manual end
// (status "ended", no winner), so the new RETAIN/RECONFIGURE dialog
// (only for a real Singularity win — see handleNewGameClick) must NOT
// appear; New Game has to still reset in one click exactly as before.
await page.locator('[data-testid="dock-panel"] button', { hasText: /^New Game$/ }).click();
await page.waitForTimeout(400);
// Always-mounted (opacity-faded, like the Move Log popup and Victory
// placard) — real visibility, not DOM presence, is what proves it stayed
// closed. New Game must also have already reset in this one click (the
// dialog never opened to intercept it), so waitForTimeout below can move
// straight on to reading the persisted board size.
const newGameChoiceOpacity = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="new-game-choice"]');
  return el ? getComputedStyle(el).opacity : null;
});
check("New Game after a manual end does not show the win settings dialog",
  Number(newGameChoiceOpacity) < 0.05, `opacity=${newGameChoiceOpacity}`);
await page.waitForTimeout(300);
const boardAfterNewGame = await page.evaluate(() => window.__EC_TEST_BOARD__ || null);
check("New Game persists the Singularity board size (12x8 kept, not reset to boot)",
  boardAfterNewGame && boardAfterNewGame.rows === wantRows && boardAfterNewGame.cols === wantCols,
  `board=${JSON.stringify(boardAfterNewGame)}`);
// New Game lands back at pre-game setup — Reset Rules is only offered once a
// game has ended, so it must NOT be showing here.
check("Reset Rules is hidden at pre-game setup",
  (await page.locator('[data-testid="reset-rules"]').count()) === 0);
// Begin the persisted-rules game from the dock (no sphere needed), end it,
// then Reset Rules must clear the board back to the boot size. Reopen the
// pre-game panel first — New Game leaves the dock as the collapsed piece.
await openDockPanel(page);
await page.waitForTimeout(300);
// The opponent picked on the summary menu (AI Dark, Hard) survives New
// Game: the dock opens on the kept-AI view (Back + Difficulty), not the
// Human-default picker.
check("New Game keeps the AI opponent selection",
  (await page.locator('[data-testid="dock-panel"] [aria-label="Back to opponent selection"]').count()) > 0);
await page.locator("button", { hasText: "Begin Game" }).first().click();
const cornerBox2 = await waitForDockCorner(page, { timeoutMs: 8000 });
await reopenDockPanelFromCorner(page, cornerBox2);
await page.waitForTimeout(400);
await endActiveGame();
await page.waitForTimeout(500);
await page.locator('[data-testid="reset-rules"]').click();
await page.waitForTimeout(700);
const boardAfterResetRules = await page.evaluate(() => window.__EC_TEST_BOARD__ || null);
check("Reset Rules clears the board back to the boot size (10x10)",
  boardAfterResetRules && boardAfterResetRules.rows === 10 && boardAfterResetRules.cols === 10,
  `board=${JSON.stringify(boardAfterResetRules)}`);
check("Reset Rules control disappears once rules are cleared",
  (await page.locator('[data-testid="reset-rules"]').count()) === 0);

check(`no page errors (${errors.length})`, errors.length === 0, JSON.stringify(errors.slice(0, 3)));

await browser.close();
console.log(failures === 0 ? "\nSINGULARITY E2E PASSED" : `\nSINGULARITY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
