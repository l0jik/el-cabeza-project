/* Too many pieces for the board, said where it can't be missed (user, a
   phone in the gate's Cabeza Nova sheet: "If too many pieces are selected
   to where you cannot click the start button at the bottom when making
   your selections, there needs to be a pop-up, like with more like
   calling attention to that, because it's hidden in just small text in a
   certain part. It needs to be brought to the user's attention what the
   situation is.").

   Every menu that sets the pieces has it (the gate's sheet, the store's
   order form, Lluvia's city, Futuris's sphere). It comes up the moment a
   change stops the pieces fitting, and again when the menu's Play (Begin,
   Place order) is pressed while they don't: that button is greyed but
   answers. It says how wide the board is and how wide the pieces need it,
   offers to make it so, or to take some out. Each menu draws it in its own
   look (`look`). It goes on the page itself (a portal): some menus sit in
   moved or scaled boxes. */
import React from "react";
import { createPortal } from "react-dom";
// (React's, each element's words in the player's language: chassis/i18n.js.)
import { createElement } from "../chassis/i18n-jsx/jsx-runtime.js";
// (Words in the player's language: chassis/i18n.js.)
import { t as inWords } from "../chassis/i18n.js";
import { piecesFit, minColsFor, totalPieces, missingCellsOf, holeCellsOf, MAX_BOARD_DIM } from "./rules-selections.js";

const h = createElement;

/* What's wrong with a menu's choices (rules-selections.js's), or null when
   the pieces fit: { total (a side), cols (the board's width now), need
   (the narrowest board they fit, or null: none), max, marked (squares
   marked in a side's two home rows) }. Futuris's sphere, whose choices
   are its own, makes the same object itself. */
export function fitProblemOf(sel) {
  if (piecesFit(sel)) return null;
  return {
    total: totalPieces(sel), cols: sel.cols, need: minColsFor(sel), max: MAX_BOARD_DIM,
    marked: [...missingCellsOf(sel), ...holeCellsOf(sel)].some((c) => c.row < 2 || c.row >= sel.rows - 2),
  };
}

/* For a React menu: open when a change stops the pieces fitting (not when
   the menu opens with them already not fitting), shut when they fit
   again. Returns [open, show (Play pressed), hide]. */
export function useFitAlert(fits) {
  const [open, setOpen] = React.useState(false);
  const was = React.useRef(fits);
  React.useEffect(() => {
    if (!fits && was.current) setOpen(true);
    if (fits) setOpen(false);
    was.current = fits;
  }, [fits]);
  return [open, React.useCallback(() => setOpen(true), []), React.useCallback(() => setOpen(false), [])];
}

const CSS = `
.ec-fit { position: fixed; inset: 0; z-index: 2600; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); animation: ecFitIn 0.16s ease-out both; }
.ec-fit-card { position: relative; width: min(400px, 100%); max-height: calc(100dvh - 32px); overflow: auto; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 14px; padding: 18px 18px 16px; animation: ecFitPop 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.15) both; }
.ec-fit-head { display: grid; grid-template-columns: 34px minmax(0, 1fr) 40px; gap: 12px; align-items: center; }
.ec-fit-badge { width: 34px; height: 34px; animation: ecFitNudge 0.5s ease-in-out 0.25s 2; }
.ec-fit-title { margin: 0; font-size: 21px; line-height: 1.12; text-wrap: balance; }
.ec-fit-x { appearance: none; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border: none; background: transparent; cursor: pointer; }
.ec-fit-figs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 6px; padding: 12px 8px; text-align: center; }
.ec-fit-fig b { display: block; font-size: 38px; line-height: 1; font-variant-numeric: tabular-nums; }
.ec-fit-fig span { display: block; margin-top: 6px; font-size: 12.5px; line-height: 1.25; }
.ec-fit-arrow { width: 28px; height: 16px; }
.ec-fit-text { margin: 0; font-size: 15.5px; line-height: 1.45; }
.ec-fit-btns { display: flex; flex-direction: column; gap: 8px; }
.ec-fit-btn { appearance: none; min-height: 48px; padding: 8px 16px; cursor: pointer; font-size: 16px; line-height: 1.15; }
.ec-fit-btn:focus-visible, .ec-fit-x:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@keyframes ecFitIn { from { opacity: 0; } }
@keyframes ecFitPop { from { opacity: 0; transform: translateY(10px) scale(0.96); } }
@keyframes ecFitNudge { 0%, 100% { transform: none; } 30% { transform: rotate(-9deg) scale(1.08); } 70% { transform: rotate(9deg) scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .ec-fit, .ec-fit-card, .ec-fit-badge { animation: none; } }
`;
function ensureCss() {
  if (typeof document === "undefined" || document.getElementById("ec-fit-css")) return;
  const st = document.createElement("style");
  st.id = "ec-fit-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

// The look when a menu gives none of its own: dark, a warm warning.
const PLAIN = {
  backdrop: "rgba(0,0,0,0.6)", surface: "#16181d", ink: "#f2f2f2", muted: "#a9adb5", accent: "#ff9f43", accentInk: "#1a1205", warn: "#ff9f43",
  line: "rgba(255,255,255,0.22)", lineW: "1px", radius: "8px", display: "system-ui, sans-serif", displayWeight: 800, body: "system-ui, sans-serif",
  caps: "none", track: "0.01em", glow: "none", shadow: "0 24px 60px rgba(0,0,0,0.55)",
};

/* The pop-up. `problem`: fitProblemOf's. onWiden(n): make the board n wide.
   onTakeOut(): to the pieces (the menu scrolls or opens its panel; the
   pop-up shuts). onClose(): shut it. */
export function FitAlert({ problem, look = null, onWiden = null, onTakeOut, onClose, testid = "fit-alert" }) {
  ensureCss();
  const L = { ...PLAIN, ...(look || {}) };
  const first = React.useRef(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const back = document.activeElement;
    const id = setTimeout(() => first.current && first.current.focus({ preventScroll: true }), 40);
    // (Escape shuts it, and only it: the menu under it stays.)
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);
  if (!problem || typeof document === "undefined") return null;
  const { total, cols, need, max, marked } = problem;
  const widen = !!onWiden && need != null && need > cols;
  const text = need == null
    ? inWords("{n} pieces a side won't fit in two home rows, even {max} squares wide.", { n: total, max })
    : inWords(marked ? "{n} pieces a side won't fit in two home rows {cols} squares wide round the squares marked there." : "{n} pieces a side won't fit in two home rows {cols} squares wide.", { n: total, cols });
  const display = { fontFamily: L.display, fontWeight: L.displayWeight, textTransform: L.caps, letterSpacing: L.track };
  const btn = (primary) => ({
    ...display, borderRadius: L.radius, border: `${L.lineW} solid ${primary ? L.accent : L.line}`,
    background: primary ? L.accent : "transparent", color: primary ? L.accentInk : L.ink,
  });
  // (Events stop here: the menus under it, and a sphere's drag, never see them.)
  const stop = (e) => e.stopPropagation();
  return createPortal(h("div", {
    className: "ec-fit", "data-testid": testid, style: { background: L.backdrop, fontFamily: L.body, color: L.ink },
    onPointerDown: stop, onPointerMove: stop, onPointerUp: stop, onTouchStart: stop, onWheel: stop,
    onClick: (e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); },
  },
    h("div", {
      className: "ec-fit-card", role: "alertdialog", "aria-modal": "true", "aria-labelledby": `${testid}-title`, "aria-describedby": `${testid}-text`,
      // (A see-through surface laid on black: the menu's words mustn't show through it.)
      style: { background: `linear-gradient(${L.surface}, ${L.surface}), ${L.under || "#000"}`, color: L.ink, border: `${L.lineW} solid ${L.line}`, borderTop: `4px solid ${L.warn}`, borderRadius: L.radius, boxShadow: L.shadow },
    },
      h("div", { className: "ec-fit-head" },
        h("svg", { className: "ec-fit-badge", viewBox: "0 0 34 34", "aria-hidden": "true" },
          h("path", { d: "M17 3.5 L31.5 29.5 H2.5 Z", fill: "none", stroke: L.warn, strokeWidth: 2.6, strokeLinejoin: "round" }),
          h("path", { d: "M17 12.5 V20.5", stroke: L.warn, strokeWidth: 3, strokeLinecap: "round" }),
          h("circle", { cx: 17, cy: 25.2, r: 1.8, fill: L.warn })),
        h("h2", { id: `${testid}-title`, className: "ec-fit-title", style: { ...display, textShadow: L.glow } }, "Too many pieces for this board"),
        h("button", { type: "button", className: "ec-fit-x", "aria-label": "Close", "data-testid": `${testid}-close`, onClick: onClose, style: { color: L.muted } },
          h("svg", { viewBox: "0 0 20 20", width: 20, height: 20, "aria-hidden": "true" }, h("path", { d: "M4 4 L16 16 M16 4 L4 16", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" })))),
      // The two widths, side by side (only when a wider board would do).
      widen && h("div", { className: "ec-fit-figs", "data-testid": `${testid}-widths`, style: { border: `${L.lineW} dashed ${L.line}`, borderRadius: L.radius } },
        h("div", { className: "ec-fit-fig" }, h("b", { style: display, "data-testid": `${testid}-now` }, String(cols)), h("span", { style: { color: L.muted } }, "Board width now")),
        h("svg", { className: "ec-fit-arrow", viewBox: "0 0 28 16", "aria-hidden": "true" }, h("path", { d: "M2 8 H24 M18 2 L25 8 L18 14", fill: "none", stroke: L.muted, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" })),
        h("div", { className: "ec-fit-fig" }, h("b", { style: { ...display, color: L.warn }, "data-testid": `${testid}-need` }, String(need)), h("span", { style: { color: L.muted } }, "Width they need"))),
      h("p", { id: `${testid}-text`, className: "ec-fit-text", "data-testid": `${testid}-text` },
        text, " ", marked && !widen ? inWords("Move the marked squares, or take some pieces out.") : inWords("The game can't start until they fit.")),
      h("div", { className: "ec-fit-btns" },
        widen && h("button", { type: "button", ref: first, className: "ec-fit-btn", "data-testid": `${testid}-widen`, style: btn(true), onClick: () => onWiden(need) },
          inWords("Make the board {n} wide", { n: need })),
        h("button", { type: "button", ref: widen ? null : first, className: "ec-fit-btn", "data-testid": `${testid}-take-out`, style: btn(!widen), onClick: onTakeOut },
          "Take some pieces out"))),
  ), document.body);
}
