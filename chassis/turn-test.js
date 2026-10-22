/* ?turntest: three ways a one-finger drag can turn the board, to feel on a
   phone and choose between (user, of the one way it turns now: "Are you
   sure you fixed the spin / turn??", a video swiping along the bottom of
   the screen, where the near edge goes against the finger). A chip at the
   top switches between them as you play:
   - far: one way everywhere, the board's far edge follows the finger
     (swipe right: clockwise). What it does without the test.
   - near: one way everywhere, the near edge follows the finger (swipe
     right: counterclockwise).
   - grab: the part you touch follows the finger, the far edge begun above
     the board's middle on screen, the near edge begun below it; kept for
     the whole drag (the old turntable, Futuris's way).
   ?turntest turns it on for the tab (it stays on from page to page
   there), ?turntest=0 turns it off; the way picked is kept for the tab
   too. A mouse turns the same way as a finger. Temporary: once a way is
   chosen it becomes the only one and this goes. */
const KEY = "el-cabeza:turn-test";
const MODE_KEY = "el-cabeza:turn-test-mode";
const MODES = [["far", "A · far edge"], ["near", "B · near edge"], ["grab", "C · where you touch"]];

export function turnTestWanted() {
  try {
    const v = new URLSearchParams(window.location.search).get("turntest");
    if (v !== null) {
      if (v === "0" || v === "off") window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, "1");
    }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch (e) {
    return false;
  }
}

// The way picked, or null when the test is off (the usual way then).
export function turnTestMode() {
  try {
    if (window.sessionStorage.getItem(KEY) !== "1") return null;
    const m = window.sessionStorage.getItem(MODE_KEY);
    return MODES.some(([k]) => k === m) ? m : "far";
  } catch (e) {
    return null;
  }
}

export function createTurnTestChip() {
  const el = document.createElement("div");
  el.dataset.testid = "turn-test";
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", "Which way a drag turns the board");
  Object.assign(el.style, {
    position: "fixed", left: "50%", top: "calc(env(safe-area-inset-top, 0px) + 54px)", transform: "translateX(-50%)", zIndex: "2147482000",
    display: "flex", gap: "4px", padding: "4px", borderRadius: "999px", background: "rgba(16, 12, 8, 0.86)",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)", font: "600 12px/1 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    whiteSpace: "nowrap", touchAction: "manipulation",
  });
  const buttons = MODES.map(([k, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.mode = k;
    b.textContent = label;
    b.setAttribute("role", "radio");
    Object.assign(b.style, { all: "unset", cursor: "pointer", padding: "8px 10px", borderRadius: "999px", color: "#F3E6C4" });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      try { window.sessionStorage.setItem(MODE_KEY, k); } catch (err) { /* this page only */ }
      paint();
    });
    el.appendChild(b);
    return b;
  });
  function paint() {
    const m = turnTestMode() || "far";
    buttons.forEach((b) => {
      const on = b.dataset.mode === m;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.style.background = on ? "#F3E6C4" : "transparent";
      b.style.color = on ? "#2A1A0E" : "#F3E6C4";
    });
  }
  paint();
  // Its taps are its own, never the board's.
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  document.body.appendChild(el);
  return { dispose() { el.remove(); } };
}
