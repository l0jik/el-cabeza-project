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
export async function openDockPanel(page, { attempts = 8 } = {}) {
  const dockCanvas = page.locator('canvas[data-testid="dock-piece-canvas"]');
  for (let i = 0; i < attempts; i++) {
    const box = await dockCanvas.boundingBox();
    if (!box) return false;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy);
    const opened = await waitForPanelOpen(page, 1000);
    if (opened) return true;
  }
  return false;
}

// Polls the panel's own data-open flag (set synchronously by React the
// instant dockView becomes "panel", well before the CSS opacity/
// transform transition finishes) rather than assuming any fixed delay.
async function waitForPanelOpen(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dock-panel"]');
      return el ? el.dataset.open === "true" : false;
    });
    if (open) return true;
    await page.waitForTimeout(100);
  }
  return false;
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
  for (let i = 0; i < attempts; i++) {
    // Moving off-target first guarantees a fresh pointerenter fires even
    // if a previous attempt's pointer is already sitting on the piece.
    await page.mouse.move(cx + 40, cy + 40);
    await page.mouse.move(cx, cy);
    const opened = await waitForPanelOpen(page, 2200);
    if (opened) return true;
  }
  return false;
}
