/* Neon's Singularity: the Anomaly random-setup button, the phantom
   reveal, and the hold gesture that commits.

   The gesture under test (SINGULARITY_DESIGN.md): hold Anomaly ~4s to
   reveal Singularity, then keep holding on Singularity ITSELF — 2s of
   nothing, then a hum that builds over 4s — and holding through the end
   of that build commits. A plain tap on Singularity is deliberately a
   no-op, releasing early cancels, and clicking elsewhere dismisses the
   revealed button.

   Note the popup is ALWAYS mounted and toggled by opacity (same pattern
   as the chassis's Info overlay and Victory placard), so "is the
   heading in the DOM" is always true and proves nothing — every check
   here reads the real inline opacity instead. An earlier version of
   this file asserted on DOM presence and reported a false pass. */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { openDockPanel } from "./dock-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");

// Must exceed the gesture's own 2s delay + 4s build, with margin for
// this sandbox's very variable timing.
const FULL_HOLD_MS = 7400;

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
/* The popup's own backdrop carries the opacity transition — walk up
   from the heading rather than assuming a nesting depth. */
const popupOpacity = () =>
  page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("SINGULARITY PROTOCOL"));
    if (!h2) return null;
    let el = h2;
    while (el && el.style.opacity === "") el = el.parentElement;
    return el ? el.style.opacity : null;
  });

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
check("a plain tap on Singularity does nothing", (await popupOpacity()) !== "1", `opacity=${await popupOpacity()}`);
await awayFromButtons();
await page.waitForTimeout(300);

// ---- releasing the hold early must NOT commit ----
// (the click above moved the pointer onto the button, so reset first)
await onSingularity();
await page.waitForTimeout(3000); // past the 2s hum start, well short of commit
await awayFromButtons();
await page.waitForTimeout(600);
check("releasing the hold early does not commit", (await popupOpacity()) !== "1", `opacity=${await popupOpacity()}`);
check("the button is still revealed after an early release", await revealed());

// ---- holding all the way through DOES commit ----
await onSingularity();
await page.waitForTimeout(FULL_HOLD_MS);
const afterHold = await popupOpacity();
check("holding through the full build commits and opens the panel", afterHold === "1", `opacity=${afterHold}`);
await page.screenshot({ path: "/tmp/neon-singularity-committed.png" });

// ---- Escape closes it ----
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
check("Escape closes the panel", (await popupOpacity()) === "0", `opacity=${await popupOpacity()}`);

// ---- click-outside dismisses the revealed button ----
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
