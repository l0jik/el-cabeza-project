// Shared helpers for driving the dock's 3D piece <-> panel gesture from
// Playwright. Two things make this trickier than a plain click:
//
// 1. This sandboxed test environment's real-world latency per action has
//    proven wildly variable (from tens of ms up to multiple real
//    seconds under load), so a single click can land without the panel
//    visibly reacting before a short poll gives up. Retrying the whole
//    gesture in a loop until the panel is actually confirmed open is
//    robust to that; a single fixed-timeout attempt is not.
// 2. The piece <-> corner relocation runs on a short delay plus its own
//    CSS transition, so "wait roughly a fixed amount" after Begin Game
//    is never quite right either — polling the actual DOM state (the
//    React-set inline style target, then the bounding box settling) is.

// Clicks the dock piece until the panel is confirmed open (Begin Game —
// or whatever panel content — actually receiving pointer events),
// retrying rather than a single attempt. A single click opens it (see
// handleDockPiecePointerUp in ElCabeza3D.jsx) while it's still the
// pre-game centered piece.
// (The panel opens over where the piece was, after the piece's bounce: a
// second click while it's on its way lands on the panel's own controls,
// the setup's Start row now, once Begin Game; so it waits longer, and never
// clicks again once the panel's open.)
// (The piece opens Rings, the dock's menu, now (chassis/menu-fan.js);
// these taps ask it for the panel itself, which the tests drive, and stop
// asking once it's open: window.__EC_DOCK_PANEL__, with the test hooks.)
export async function openDockPanel(page, { attempts = 8 } = {}) {
  const dockCanvas = page.locator('canvas[data-testid="dock-piece-canvas"]');
  const ask = (on) => page.evaluate((on) => { window.__EC_DOCK_PANEL__ = on; }, on).catch(() => {});
  try {
    for (let i = 0; i < attempts; i++) {
      if (await waitForPanelOpen(page, 0)) return true;
      const box = await dockCanvas.boundingBox();
      if (!box) return false;
      await ask(true);
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.click(cx, cy);
      const opened = await waitForPanelOpen(page, 2500);
      if (opened) return true;
    }
    return false;
  } finally {
    await ask(false);
  }
}

// Polls the panel's own data-open flag (set synchronously by React the
// instant dockView becomes "panel", well before the CSS opacity/
// transform transition finishes) rather than assuming any fixed delay.
async function waitForPanelOpen(page, timeoutMs) {
  const start = Date.now();
  // (Looked at once at least, even with no time to wait.)
  for (;;) {
    const open = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dock-panel"]');
      return el ? el.dataset.open === "true" : false;
    });
    if (open) return true;
    if (Date.now() - start >= timeoutMs) return false;
    await page.waitForTimeout(100);
  }
}

// The panel's own fade-in (opacity and scale, 500ms) done: its computed
// opacity at 1. data-open flips the instant it opens; on a loaded machine
// the fade can still be under way well after (e2e-first-look read every
// control in it at 0.92, 700ms on), so anything that reads how faded a
// control looks waits for this first.
export async function waitForPanelSettled(page, { timeoutMs = 8000 } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const o = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dock-panel"]');
      return el ? +getComputedStyle(el).opacity : 0;
    });
    if (o >= 0.999) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

// After Begin Game, the dock piece remorphs and relocates to the
// bottom-right corner (900ms delay, then its own 900ms CSS transition).
// Waits for the React-set style target to actually flip to the corner
// value, then for the bounding box to stop moving between two
// consecutive reads (the transition settling), rather than a fixed
// sleep.
export async function waitForDockCorner(page, { timeoutMs = 15000 } = {}) {
  const dockCanvas = page.locator('canvas[data-testid="dock-piece-canvas"]');
  const start = Date.now();
  let reachedTarget = false;
  while (Date.now() - start < timeoutMs) {
    const left = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dock-piece-canvas"]');
      return el ? el.parentElement.style.left : "";
    });
    if (left && left.includes("calc")) { reachedTarget = true; break; }
    await page.waitForTimeout(150);
  }
  if (!reachedTarget) return null;
  let box = await dockCanvas.boundingBox();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(150);
    const next = await dockCanvas.boundingBox();
    if (next && box && next.x === box.x && next.width === box.width) { box = next; break; }
    box = next;
  }
  return box;
}

// Hovers the dock piece while it's in its small bottom-right corner
// watermark form, reopening the panel. A single click also opens it
// there now (see handleDockPiecePointerUp) — this helper specifically
// exercises the hover/hold alternative (handleDockPieceHoverStart,
// 0.5s) rather than the click path openDockPanel already covers.
// Retries the gesture the same way openDockPanel does, for the same
// reason.
export async function reopenDockPanelFromCorner(page, cornerBox, { attempts = 8 } = {}) {
  const cx = cornerBox.x + cornerBox.width / 2, cy = cornerBox.y + cornerBox.height / 2;
  // (The panel, not Rings: as openDockPanel asks.)
  const ask = (on) => page.evaluate((on) => { window.__EC_DOCK_PANEL__ = on; }, on).catch(() => {});
  try {
    await ask(true);
    for (let i = 0; i < attempts; i++) {
      // Moving off-target first guarantees a fresh pointerenter fires even
      // if a previous attempt's pointer is already sitting on the piece.
      await page.mouse.move(cx + 40, cy + 40);
      await page.mouse.move(cx, cy);
      const opened = await waitForPanelOpen(page, 2200);
      if (opened) return true;
    }
    return false;
  } finally {
    await ask(false);
  }
}
