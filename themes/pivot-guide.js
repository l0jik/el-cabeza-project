/* "Only a Codo, Rayo or Zeta can pivot" (user): when the Cantilever Pivot
   rule is turned on with none of those pieces ordered, its warning
   flashes, the menu jumps to where they are (the three now sit together
   at the end of the pieces list, for this), and they flash too: what's
   expected, shown. A tap on the warning shows it again. Shared by every
   menu that sets the rules (Tienda's order form, the gate's sheet,
   Lluvia's city panels, Neon's sphere); each says where its warning and
   rows are, and how to get to its pieces if they're on another panel.
   The colour is the menu's own (--ec-guide on any ancestor). */
import React from "react";
import { PIVOT_CAPABLE } from "./rules-selections.js";

const CSS = `
.ec-guide-flash { animation: ecGuideFlash 0.6s ease-in-out var(--ec-guide-times, 3) !important; }
@keyframes ecGuideFlash {
  0%, 100% { box-shadow: inset 0 0 0 0 transparent; }
  50% { box-shadow: inset 0 0 0 3px var(--ec-guide, #c2412c), 0 0 18px 2px var(--ec-guide-glow, rgba(194,65,44,0.4)); background-color: var(--ec-guide-bg, rgba(194,65,44,0.13)); }
}
@media (prefers-reduced-motion: reduce) {
  .ec-guide-flash { animation: none !important; box-shadow: inset 0 0 0 3px var(--ec-guide, #c2412c) !important; }
}
`;
function ensureCss() {
  if (typeof document === "undefined" || document.getElementById("ec-guide-css")) return;
  const st = document.createElement("style");
  st.id = "ec-guide-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

// One element flashing `times` times (0.6 s each), the animation restarted
// if it was already going.
export function flashEl(el, times = 3) {
  if (!el) return;
  ensureCss();
  el.classList.remove("ec-guide-flash");
  void el.offsetWidth;
  el.style.setProperty("--ec-guide-times", String(times));
  el.classList.add("ec-guide-flash");
  clearTimeout(el.__ecGuide);
  el.__ecGuide = setTimeout(() => el.classList.remove("ec-guide-flash"), times * 600 + 50);
}

/* The whole show: { warnSel, rowSel(key), goTo() (to another panel
   first, if the pieces are elsewhere) }. Returns a cancel. */
export function guideToPivots({ warnSel, rowSel, goTo = null }) {
  if (typeof document === "undefined") return () => {};
  const timers = [];
  // (A beat first: the warning may only now be drawn.)
  timers.push(setTimeout(() => flashEl(document.querySelector(warnSel), 2), 60));
  timers.push(setTimeout(() => {
    if (goTo) goTo();
    timers.push(setTimeout(() => {
      const rows = PIVOT_CAPABLE.map((k) => document.querySelector(rowSel(k))).filter(Boolean);
      if (!rows.length) return;
      rows[Math.floor(rows.length / 2)].scrollIntoView({ block: "center", behavior: "smooth" });
      timers.push(setTimeout(() => rows.forEach((r) => flashEl(r, 3)), 550));
    }, goTo ? 380 : 0));
  }, 1310));
  return () => timers.forEach(clearTimeout);
}

/* For a React menu: when the pivot warning comes up (not when the menu
   opens with it already there), the show. Returns a replay for a tap on
   the warning. */
export function usePivotGuide(active, opts) {
  const was = React.useRef(active);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const cancel = React.useRef(null);
  const run = React.useCallback(() => {
    if (cancel.current) cancel.current();
    cancel.current = guideToPivots(optsRef.current);
  }, []);
  React.useEffect(() => {
    // (opts.quiet(): not when All laws turned Pivot on, see useGuideHush.)
    if (active && !was.current && !(optsRef.current.quiet && optsRef.current.quiet())) run();
    // (Turned off again, or a pivot piece ordered: no more of it.)
    if (!active && cancel.current) { cancel.current(); cancel.current = null; }
    was.current = active;
  }, [active]);
  React.useEffect(() => () => { if (cancel.current) cancel.current(); }, []);
  return run;
}

/* All laws (user: "a switch ... at the top of all custom setting menus to
   turn all laws on") keeps you where you are: when it's what turned Pivot
   on, the guide holds off (its note says what pivoting needs instead).
   hush() just before that change; quiet goes in the guide's options. */
export function useGuideHush() {
  const at = React.useRef(0);
  return React.useMemo(() => ({ hush: () => { at.current = Date.now(); }, quiet: () => Date.now() - at.current < 1500 }), []);
}
