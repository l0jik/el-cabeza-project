/* The board alone after a moment's stillness (user: "During gameplay, if
   the board is not touched for 4 seconds, all hover-over menus, navpads,
   or displays disappear. They fade out quickly. If the board is touched
   again to rotate it or anything, they will come back as per normal. This
   allows careful scrutiny or study of the current game state without
   distraction.").

   In a game, IDLE_MS with nothing pressed, moved, scrolled or typed: the
   page gets html.ec-idle, and every control and read-out resting over the
   board (IDLE_UI: the corners, the points, the turn's line and its Undo,
   the corner menu's tab, the world's title, the piece in the corner, the
   music, the phone's bar, the Lab's read-out, the City's clock...) fades
   out quickly, and lets a press through to the board. The first touch
   anywhere brings them all straight back, and that touch does what it
   would have anyway (turns the view, picks a piece).

   Never while something's open or asking (KEEP_UP: a menu, a sheet, a
   question, the check alert, the tour, the result), nor in a story scene,
   which hides the game's controls itself: then it waits, and looks again
   a moment later. ElCabeza3D says when a game's in play (useIdleFade).

   A browser driven by a test (navigator.webdriver) has it only when the
   test asks, window.__EC_IDLE_MS__ (ms): a test that waits more than four
   seconds and then presses a corner would find it faded and let through. */
import { useEffect } from "react";

export const IDLE_MS = 4000;

// What fades: by test id, and the few the chassis marks otherwise.
const IDLE_IDS = [
  "points-counter", "turn-status", "turn-buttons-float", "undo-move-float", "stop-here-float",
  "piece-card", "why-not", "why-not-pointer", "unused-points-note", "online-status",
  "room-view-corner", "focus-corner", "action-corner", "how-to-play", "dock-corner",
  "music-chip", "shell-bar", "shell-hint", "ciudad-time-chip", "toggle-hint",
];
export const IDLE_UI = [
  ...IDLE_IDS.map((id) => `[data-testid="${id}"]`),
  // (Closed: open, it's being read.)
  '[data-testid="corner-menu"]:not([data-open="true"])',
  '[data-testid="lab-hud"]:not([data-compact="open"])',
  "[data-masthead]", "[data-fullscreen-toggle]", "[data-dock-piece]",
];
export const IDLE_UI_CSS = `html.ec-idle :is(${IDLE_UI.join(", ")}) {
  opacity: 0 !important; pointer-events: none !important; transition: opacity 0.35s ease !important;
}`;

// Open or asking: the controls stay while any of these is up.
const KEEP_UP = [
  '[data-testid="dock-panel"][data-open="true"]', '[data-testid="corner-menu"][data-open="true"]',
  '[data-testid="lab-hud"][data-compact="open"]', '[data-testid="info-overlay"][data-open="true"]',
  '[data-testid="menu-fan"]', '[data-testid="sound-menu"]', '[data-testid="music-panel"]',
  '[data-testid="movelog-sheet"]', '[data-testid="saves-sheet"]', '[data-testid="replay-sheet"]',
  '[data-testid="online-panel"]', '[data-testid="end-turn-ask"]', '[data-testid="new-game-choice"]',
  '[data-testid="change-rules-ask"]', '[data-testid="check-alert"]', '[data-testid="tour-card"]',
  '[data-testid="victory-placard"]', '[data-testid="replay-speed-menu"]',
].join(", ");
// A story scene has the screen (ElCabeza3D's STORY_SCENES): it hides the
// game's controls its own way.
const SCENES = [
  "html.ec-tv-visit", "html.ec-hall-scene", "html.ec-den-lock", "html.ec-home-card", "html.ec-settle",
  "html.ec-order-paper", "html.ec-commercial", "html.ec-summon", "html.ec-den-call",
];

// (Most of the sheets are always in the page, faded out or hidden till
// they're wanted: up is on the screen, seen.)
function shown(el) {
  if (!el.getClientRects().length) return false;
  for (let e = el; e && e.nodeType === 1 && e !== el.ownerDocument.documentElement; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
  }
  return true;
}
function held(doc) {
  if ([...doc.querySelectorAll(KEEP_UP)].some(shown)) return true;
  const root = doc.documentElement;
  if (SCENES.some((s) => root.matches(s))) return true;
  try { return !!doc.querySelector(".den-trip, .den-ending, .td-clerk-layer"); } catch (e) { return false; }
}

/* While `on` (a game being played: not before its Begin, nor a replay,
   nor the walkthrough), the stillness is timed; off, the controls are up
   and stay up. */
export function useIdleFade(on) {
  useEffect(() => {
    if (!on || typeof document === "undefined") return undefined;
    const asked = typeof window.__EC_IDLE_MS__ === "number" ? window.__EC_IDLE_MS__ : null;
    const ms = asked != null ? asked : typeof navigator !== "undefined" && navigator.webdriver ? 0 : IDLE_MS;
    if (!(ms > 0)) return undefined;
    const doc = document, root = doc.documentElement;
    let timer = 0;
    const fade = () => {
      timer = 0;
      if (held(doc)) { arm(); return; }
      root.classList.add("ec-idle");
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(fade, ms); };
    const wake = () => { root.classList.remove("ec-idle"); arm(); };
    const EVENTS = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"];
    EVENTS.forEach((e) => window.addEventListener(e, wake, { capture: true, passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, wake, { capture: true }));
      root.classList.remove("ec-idle");
    };
  }, [on]);
}
