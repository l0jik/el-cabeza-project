/* The way into a game in any reality, after the story (user: the Lab's
   pages, Lluvia, Cromo, every reality, had no way to play the non-standard
   pieces, rules and boards; "every time you move to a new reality, there
   should just be two buttons... Standard Cabeza or Cabeza Nova").

   - The gate: two buttons, the same words everywhere, each reality
     drawing them in its own look (user). Standard Cabeza begins the
     classic game at once: the five pieces, the standard 10x10 board, no changes.
     Cabeza Nova opens the sheet. "Other realities" under them is the way
     back to the switcher (realities.js).
   - The sheet: everything Nova's places offer (Tienda's order form,
     Neon's sphere, the den's catalog), together in one simple scrolling
     menu: who's playing, the pieces, the rules, the board (its size,
     squares cut out, the black holes' place, a shuffled start). Reset
     and Play at the bottom. The choices are rules-selections.js's, applied
     by beginCustomGame, as those menus do; the last ones used are kept
     (this browser) for next time.

   Only after the story (storyOver). The chassis shows it (a theme's
   `realityGate`: { world, deferred?, when? }) when a reality mounts with
   no game under way; a deferred one waits for openRealityGate() (Lluvia:
   after its descent). React through createElement, as the other overlays,
   so it imports in plain Node. */

import { usePivotGuide } from "./pivot-guide.js";
import React from "react";
import * as THREE from "three";
import { initialPiecesFor } from "../engine/rules.js";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";
import { POSES } from "./piece-showcase.js";
import {
  PIECE_OPTIONS, LAW_OPTIONS, ARCO_SIZES, SHOVE_SETTINGS, SIZES, MAX_PIECES, MAX_MISSING_PAIRS, MIN_BOARD_DIM, MAX_BOARD_DIM,
  defaultSelections, cloneSelections, normalizeSelections, totalPieces, toggleLaw, setShove, lawWarnings, piecesFit, minColsFor,
  beginCustomGame, fillSpots, randomizeSpots, refreshSpots, spotProblem, mirrorCell, missingCellsOf, holeCellsOf, boardLabel, clampDim, pieceTypeOf,
} from "./rules-selections.js";
import { WORLDS, createRealitiesMenu, goToWorld, REALITIES_VISIT_KEY } from "./realities.js";
import { sideNamesFor } from "./side-names.js";

const h = React.createElement;

/* ------------------------------------------------------------ when */

const STORY_KEY = "el-cabeza:story";
export function storyOver() {
  // (Or come here from the realities menu this visit: realities.js goToWorld.)
  try { if (window.sessionStorage.getItem(REALITIES_VISIT_KEY) === "1") return true; } catch (e) { /* the record, then */ }
  try { const s = JSON.parse(window.localStorage.getItem(STORY_KEY) || "null"); return !!(s && s.ended); } catch (e) { return false; }
}
export const GATE_EVENT = "el-cabeza:reality-gate";
// Opens the gate (a deferred one, or again): { stage: "choose" | "nova" }.
export function openRealityGate(detail = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(GATE_EVENT, { detail }));
}

/* The switcher from anywhere: the realities menu over the page. `world`:
   this reality's id ("You are here"); `novaGo`: in Nova, its own places
   switch in place. */
export function openRealities(world, novaGo = null, onStay = null) {
  const w = WORLDS.find((x) => x.id === world);
  const open = () => createRealitiesMenu({
    current: w && w.nova ? w.nova : null, currentId: world,
    onPick: (pick) => goToWorld(pick, novaGo), onStay,
  });
  // A page may play something out first (setRealitiesPrelude: Parrish's
  // closing music, the painting fading), then open the menu.
  if (prelude) { prelude(open); return null; }
  return open();
}
let prelude = null;
// prelude(open): call open() when ready (once). null: none.
export function setRealitiesPrelude(fn) { prelude = fn; }
// A theme's corner button for it (the chassis's theme.cornerAction).
export const realitiesCorner = (world, novaGo = null) => () => (storyOver() ? { label: "Other realities", onClick: () => openRealities(world, novaGo) } : null);

/* ------------------------------------------------------------ the looks */

/* Each reality's way of drawing it, as CSS variables. The Lab's ten
   take their own design tokens (themes/lab/css.js puts them on the page). */
const LOOKS = {
  den: {
    backdrop: "rgba(20,12,6,0.58)", surface: "#F3E7CD", ink: "#2B1D12", muted: "#6B5843", accent: "#B4501A", accentInk: "#FFF4E2",
    line: "rgba(43,29,18,0.32)", lineW: "1.5px", radius: "8px", display: "'Fraunces', Georgia, serif", displayWeight: 800, body: "'Libre Franklin', 'Helvetica Neue', Arial, sans-serif",
    shadow: "0 24px 60px rgba(10,6,3,0.55)", glow: "none", case: "none", track: "0.01em", cellA: "#E3CDA2", cellB: "#B98A5B",
  },
  neon: {
    backdrop: "rgba(2,4,8,0.62)", surface: "rgba(8,11,16,0.94)", ink: "#DDF6FF", muted: "#7FA3B8", accent: "#22E4FF", accentInk: "#02070B",
    line: "rgba(34,228,255,0.42)", lineW: "1px", radius: "3px", display: "'Chakra Petch', 'Barlow', sans-serif", displayWeight: 700, body: "'Chakra Petch', 'Barlow', sans-serif",
    shadow: "0 0 34px rgba(34,228,255,0.28), 0 20px 50px rgba(0,0,0,0.6)", glow: "0 0 10px rgba(34,228,255,0.75)", case: "uppercase", track: "0.14em", cellA: "#0E2230", cellB: "#081620",
  },
  store: {
    backdrop: "rgba(26,18,11,0.55)", surface: "#EFE6CD", ink: "#2E2118", muted: "#6E5D4A", accent: "#A33F33", accentInk: "#F7EEDB",
    line: "rgba(46,33,24,0.45)", lineW: "1.5px", radius: "2px", display: "'Bodoni Moda', Didot, Georgia, serif", displayWeight: 800, body: "'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif",
    shadow: "0 24px 60px rgba(10,6,3,0.55)", glow: "none", case: "none", track: "0.01em", cellA: "#D8BD8E", cellB: "#9C6B45",
  },
  lluvia: {
    backdrop: "rgba(3,2,6,0.66)", surface: "rgba(10,7,16,0.95)", ink: "#F3ECFF", muted: "#B9B2C8", accent: "#FF3DBB", accentInk: "#FFF4FB",
    line: "rgba(255,61,187,0.5)", lineW: "1.5px", radius: "4px", display: "'Saira Extra Condensed', 'Saira Condensed', sans-serif", displayWeight: 800, body: "'Saira Condensed', system-ui, sans-serif",
    shadow: "0 0 30px rgba(255,61,187,0.3), 0 20px 50px rgba(0,0,0,0.6)", glow: "0 0 4px rgba(255,255,255,0.8), 0 0 12px #ff3dbb", case: "uppercase", track: "0.1em", cellA: "#1C1430", cellB: "#110B1F",
  },
  cromo: {
    backdrop: "rgba(5,5,6,0.62)", surface: "rgba(20,21,24,0.97)", ink: "#E9EAEC", muted: "#9A9DA3", accent: "#D4D8DE", accentInk: "#0B0B0C",
    line: "rgba(233,234,236,0.2)", lineW: "1px", radius: "3px", display: "'Michroma', 'Barlow', sans-serif", displayWeight: 400, body: "'Barlow', system-ui, sans-serif",
    shadow: "0 24px 60px rgba(0,0,0,0.6)", glow: "none", case: "uppercase", track: "0.16em", cellA: "#3A3C41", cellB: "#25262A",
  },
  parrish: {
    backdrop: "rgba(8,14,38,0.55)", surface: "#F6ECD6", ink: "#1D2C5E", muted: "#5A6A9A", accent: "#1D2C5E", accentInk: "#F2D293",
    line: "rgba(201,150,59,0.7)", lineW: "1px", radius: "2px", display: "'Cinzel', Georgia, serif", displayWeight: 700, body: "'Cormorant Garamond', Georgia, serif",
    shadow: "0 24px 60px rgba(8,14,38,0.55)", glow: "none", case: "uppercase", track: "0.08em", cellA: "#E8B75A", cellB: "#2348A8",
  },
  lab: {
    backdrop: "rgba(0,0,0,0.45)", surface: "var(--surface, #fff)", ink: "var(--panel-ink, #111)", muted: "var(--text-secondary, #555)",
    accent: "var(--accent-primary, #e63946)", accentInk: "var(--surface, #fff)", line: "var(--border-color, #111)", lineW: "var(--border-width, 1px)",
    radius: "var(--radius, 0px)", display: "var(--font-display, var(--font-body, system-ui))", displayWeight: "var(--display-weight, 800)", body: "var(--font-body, system-ui)",
    shadow: "var(--shadow, 0 20px 50px rgba(0,0,0,0.35))", glow: "none", case: "var(--label-case, none)", track: "var(--label-tracking, 0.04em)",
    cellA: "var(--board-surface, #ddd)", cellB: "var(--board-grid, #999)",
  },
};
const lookOf = (world) => LOOKS[world] || (String(world).startsWith("lab-") ? LOOKS.lab : String(world).startsWith("parrish") ? LOOKS.parrish : LOOKS.den);
const varsOf = (L) => ({
  "--rg-backdrop": L.backdrop, "--rg-surface": L.surface, "--rg-ink": L.ink, "--rg-muted": L.muted, "--rg-accent": L.accent, "--rg-accent-ink": L.accentInk,
  "--rg-line": L.line, "--rg-line-w": L.lineW, "--rg-radius": L.radius, "--rg-display": L.display, "--rg-display-weight": L.displayWeight, "--rg-body": L.body,
  "--rg-shadow": L.shadow, "--rg-glow": L.glow, "--rg-case": L.case, "--rg-track": L.track, "--rg-cell-a": L.cellA, "--rg-cell-b": L.cellB,
});

const CSS = `
.rg-layer { position: fixed; inset: 0; z-index: 1500; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); background: var(--rg-backdrop);
  font-family: var(--rg-body); color: var(--rg-ink); animation: rgIn 0.45s ease both; }
.rg-layer *, .rg-layer *::before, .rg-layer *::after { box-sizing: border-box; }
@keyframes rgIn { from { opacity: 0; } }
.rg-choose { width: min(420px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 22px 18px 16px; background: var(--rg-surface);
  border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); box-shadow: var(--rg-shadow); }
.rg-kicker { text-align: center; font: 600 12px/1.2 var(--rg-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--rg-muted); }
.rg-big { appearance: none; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; min-height: 76px; padding: 14px 18px; cursor: pointer;
  border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); background: transparent; color: var(--rg-ink); text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease; }
.rg-big:hover { transform: translateY(-1px); box-shadow: 0 0 0 1px var(--rg-accent); }
.rg-big:active { transform: translateY(1px); }
.rg-big.rg-nova { background: var(--rg-accent); color: var(--rg-accent-ink); border-color: var(--rg-accent); }
.rg-big-t { font-family: var(--rg-display); font-weight: var(--rg-display-weight); font-size: clamp(22px, 5.4vw, 27px); line-height: 1.05;
  text-transform: var(--rg-case); letter-spacing: var(--rg-track); text-shadow: var(--rg-glow); }
.rg-big.rg-nova .rg-big-t { text-shadow: none; }
.rg-big-s { font: 400 14px/1.35 var(--rg-body); opacity: 0.82; }
.rg-link { appearance: none; align-self: center; min-height: 40px; padding: 0 12px; border: none; background: transparent; color: var(--rg-muted); cursor: pointer;
  font: 600 14px/1 var(--rg-body); letter-spacing: 0.04em; text-decoration: underline; text-underline-offset: 3px; }
.rg-layer button:focus-visible { outline: 2px solid var(--rg-accent); outline-offset: 2px; }
/* The sheet: up from the bottom on a phone, a panel on a wide screen. */
.rg-layer.rg-sheet-on { align-items: flex-end; padding-bottom: 0; }
@media (min-width: 700px) and (min-height: 560px) { .rg-layer.rg-sheet-on { align-items: center; padding-bottom: 16px; } }
.rg-sheet { width: min(600px, 100%); max-height: calc(100dvh - max(16px, env(safe-area-inset-top)) - 8px); display: flex; flex-direction: column;
  background: var(--rg-surface); border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius) var(--rg-radius) 0 0; box-shadow: var(--rg-shadow);
  animation: rgUp 0.42s cubic-bezier(.2,.8,.2,1) both; overflow: hidden; }
@media (min-width: 700px) and (min-height: 560px) { .rg-sheet { border-radius: var(--rg-radius); max-height: calc(100dvh - 32px); } }
@keyframes rgUp { from { transform: translateY(40px); opacity: 0; } }
.rg-head { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; padding: 10px 8px 8px; border-bottom: var(--rg-line-w) solid var(--rg-line); }
.rg-head h2 { margin: 0; text-align: center; font-family: var(--rg-display); font-weight: var(--rg-display-weight); font-size: 22px; line-height: 1.1;
  text-transform: var(--rg-case); letter-spacing: var(--rg-track); text-shadow: var(--rg-glow); text-wrap: balance; }
.rg-icon { appearance: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--rg-ink); cursor: pointer; }
.rg-body { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 4px 16px 18px; }
.rg-sec { padding: 14px 0 6px; border-bottom: 1px dashed var(--rg-line); }
.rg-sec:last-child { border-bottom: none; }
.rg-sec h3 { margin: 0 0 8px; font: 700 12px/1.2 var(--rg-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--rg-muted); }
.rg-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 46px; padding: 3px 0; }
.rg-name { font: 600 15px/1.25 var(--rg-body); }
.rg-piece-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
.rg-pic { flex: none; width: 66px; height: 50px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--rg-radius); background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--rg-ink) 14%, transparent), transparent 70%); }
.rg-pic img { width: 66px; height: 50px; object-fit: contain; display: block; }
.rg-note { display: block; font: 400 12.5px/1.35 var(--rg-body); color: var(--rg-muted); margin-top: 2px; }
.rg-step { display: inline-flex; align-items: center; gap: 2px; }
.rg-step button { appearance: none; width: 40px; height: 40px; border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); background: transparent; color: var(--rg-ink);
  font: 600 20px/1 var(--rg-body); cursor: pointer; }
.rg-step button:disabled { opacity: 0.3; cursor: default; }
.rg-step output { min-width: 34px; text-align: center; font: 700 17px/1 var(--rg-body); font-variant-numeric: tabular-nums; }
.rg-seg { display: flex; flex-wrap: wrap; gap: 6px; }
/* Who's playing: two columns, the computer's two sides one under the other
   in the right one (user: Computer plays Light in the right column, under
   Dark, not wrapped to the left). */
.rg-seg.rg-opp { display: grid; grid-template-columns: auto auto; justify-content: start; }
.rg-seg.rg-opp button:nth-child(3) { grid-column: 2; }
.rg-seg button { appearance: none; min-height: 40px; padding: 0 12px; border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); background: transparent;
  color: var(--rg-ink); font: 600 14px/1.15 var(--rg-body); cursor: pointer; }
/* (Chosen reads the way "on" does everywhere in the sheet, the switches
   and Play: in the look's accent, user.) */
.rg-seg button[aria-pressed="true"] { background: var(--rg-accent); color: var(--rg-accent-ink); border-color: var(--rg-accent); }
.rg-seg button:disabled { opacity: 0.4; cursor: default; }
.rg-switch { appearance: none; position: relative; width: 50px; height: 30px; flex: none; border: var(--rg-line-w) solid var(--rg-line); border-radius: 999px; background: transparent; cursor: pointer; }
.rg-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: var(--rg-muted); transition: transform 0.18s ease, background-color 0.18s ease; }
.rg-switch[aria-checked="true"] { background: var(--rg-accent); border-color: var(--rg-accent); }
.rg-switch[aria-checked="true"]::after { transform: translateX(20px); background: var(--rg-accent-ink); }
.rg-sub { padding: 2px 0 8px 12px; border-left: 2px solid var(--rg-line); margin: 0 0 6px 2px; display: flex; flex-direction: column; gap: 6px; }
.rg-warn { margin: 6px 0; padding: 8px 10px; border-left: 3px solid var(--rg-accent); font: 500 13px/1.35 var(--rg-body); }
.rg-total { font: 600 13px/1.3 var(--rg-body); color: var(--rg-muted); padding: 6px 0 2px; font-variant-numeric: tabular-nums; }
.rg-total.bad { color: var(--rg-accent); }
.rg-foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 10px; padding: 12px 16px max(12px, env(safe-area-inset-bottom));
  border-top: var(--rg-line-w) solid var(--rg-line); background: var(--rg-surface); }
.rg-btn { appearance: none; min-height: 52px; border-radius: var(--rg-radius); cursor: pointer; font-family: var(--rg-display); font-weight: var(--rg-display-weight);
  font-size: 18px; text-transform: var(--rg-case); letter-spacing: var(--rg-track); }
.rg-btn.plain { border: var(--rg-line-w) solid var(--rg-line); background: transparent; color: var(--rg-ink); }
.rg-btn.go { border: var(--rg-line-w) solid var(--rg-accent); background: var(--rg-accent); color: var(--rg-accent-ink); }
.rg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rg-small { appearance: none; min-height: 38px; padding: 0 12px; border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); background: transparent;
  color: var(--rg-ink); font: 600 13.5px/1 var(--rg-body); cursor: pointer; }
/* The square picker. */
.rg-pick { position: fixed; inset: 0; z-index: 1510; display: flex; align-items: center; justify-content: center; padding: 12px; background: var(--rg-backdrop); }
.rg-pick-box { width: min(620px, 100%); max-height: calc(100dvh - 24px); overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 16px;
  background: var(--rg-surface); border: var(--rg-line-w) solid var(--rg-line); border-radius: var(--rg-radius); box-shadow: var(--rg-shadow); }
.rg-pick-box h3 { margin: 0; font-family: var(--rg-display); font-weight: var(--rg-display-weight); font-size: 20px; text-transform: var(--rg-case); letter-spacing: var(--rg-track); }
.rg-pick-box p { margin: 0; font: 400 13px/1.4 var(--rg-body); color: var(--rg-muted); }
.rg-side { text-align: center; font: 600 11px/1 var(--rg-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--rg-muted); }
.rg-grid { display: grid; margin: 0 auto; border: 3px solid var(--rg-line); touch-action: manipulation; }
.rg-cell { position: relative; padding: 0; border: none; margin: 0; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font: 700 14px/1 var(--rg-body); color: var(--rg-ink); background: var(--rg-cell-a); }
.rg-cell.dk { background: var(--rg-cell-b); }
.rg-cell.piece::before { content: ""; position: absolute; width: 32%; height: 32%; border-radius: 50%; background: var(--rg-ink); opacity: 0.35; }
.rg-cell.banned { cursor: not-allowed; opacity: 0.45; }
.rg-cell .mk { position: relative; z-index: 1; color: var(--rg-accent); font-weight: 800; text-shadow: 0 0 2px var(--rg-surface); }
.rg-cell .mk.mirror { opacity: 0.5; }
.rg-cell .mk.rolled { outline: 1.5px dashed var(--rg-accent); outline-offset: 1px; padding: 0 2px; }
.rg-pick-note { min-height: 1.35em; font: 600 13px/1.35 var(--rg-body); color: var(--rg-accent); }
.rg-pick-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
@media (prefers-reduced-motion: reduce) { .rg-layer, .rg-sheet { animation: none; } .rg-big, .rg-switch::after { transition: none; } }
`;
function ensureCss() {
  if (typeof document === "undefined" || document.querySelector("style[data-ec-reality-gate]")) return;
  const st = document.createElement("style"); st.setAttribute("data-ec-reality-gate", ""); st.textContent = CSS; document.head.appendChild(st);
}

/* ------------------------------------------------------------ remembered */

const KEEP_KEY = "el-cabeza:nova-setup";
function readKept() {
  try { const v = JSON.parse(window.localStorage.getItem(KEEP_KEY) || "null"); return v ? normalizeSelections(v) : defaultSelections(); } catch (e) { return defaultSelections(); }
}
function keep(sel) { try { window.localStorage.setItem(KEEP_KEY, JSON.stringify(sel)); } catch (e) { /* not kept */ } }

/* ------------------------------------------------------------ bits */

const ICON_BACK = h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
  h("path", { d: "M19 12H5" }), h("path", { d: "M11 6l-6 6 6 6" }));
function Stepper({ value, min, max, onChange, label, testid }) {
  return h("span", { className: "rg-step", role: "group", "aria-label": label },
    h("button", { type: "button", "aria-label": `Fewer: ${label}`, "data-testid": testid && `${testid}-minus`, disabled: value <= min, onClick: () => onChange(value - 1) }, "−"),
    h("output", { "aria-live": "polite", "data-testid": testid && `${testid}-value` }, value),
    h("button", { type: "button", "aria-label": `More: ${label}`, "data-testid": testid && `${testid}-plus`, disabled: value >= max, onClick: () => onChange(value + 1) }, "+"));
}
const Switch = ({ on, onClick, label, testid }) => h("button", { type: "button", role: "switch", className: "rg-switch", "aria-checked": on ? "true" : "false", "aria-label": label, "data-testid": testid, onClick });
const Seg = ({ label, children, className = "" }) => h("div", { className: `rg-seg${className ? " " + className : ""}`, role: "group", "aria-label": label }, children);
const segBtn = (key, on, text, onClick, testid, disabled = false) => h("button", { key, type: "button", "aria-pressed": on ? "true" : "false", "data-testid": testid, onClick, disabled }, text);

/* ------------------------------------------------------------ the square picker */

/* Marking the board by hand (as Tienda's order form and Neon's sphere):
   squares cut out (X) or the black holes' place (O); each mark's 180°
   partner is filled in. Drawn from Dark's side, as the board faces. */
function SpotPicker({ sel, kind, onDone, onCancel, names = sideNamesFor(null) }) {
  const [draft, setDraft] = React.useState(() => cloneSelections(sel));
  const [note, setNote] = React.useState("");
  const { rows, cols } = draft;
  const isHole = kind === "hole";
  const spots = isHole ? (draft.holeSpot ? [draft.holeSpot] : []) : draft.missingSpots;
  const setSpots = (d, list) => { if (isHole) d.holeSpot = list[0] || null; else d.missingSpots = list; };
  const count = isHole ? 1 : draft.missingCount;
  const pieces = React.useMemo(() => initialPiecesFor(rows, cols), [rows, cols]);
  const pieceAt = (r, c) => pieces.some((p) => r >= p.row && r < p.row + p.h && c >= p.col && c < p.col + p.w);
  const other = new Set((isHole ? missingCellsOf(draft) : holeCellsOf(draft)).map((q) => `${q.row},${q.col}`));
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const marks = new Map();
  spots.forEach((p) => {
    marks.set(`${p.row},${p.col}`, { spot: p, mirror: false });
    const m = mirrorCell(p.row, p.col, rows, cols);
    marks.set(`${m.row},${m.col}`, { spot: p, mirror: true });
  });
  const tap = (r, c) => {
    const at = marks.get(`${r},${c}`);
    if (at) {
      if (isHole) { onDone(draft); return; }
      const d = cloneSelections(draft);
      setSpots(d, spots.map((p) => (p === at.spot ? (p.random ? { ...p, random: false } : null) : p)).filter(Boolean));
      setDraft(d); setNote("");
      return;
    }
    if (other.has(`${r},${c}`)) { setNote(isHole ? "That square is cut out." : "That square is a black hole."); return; }
    const problem = spotProblem(draft, kind, r, c, spots.filter(Boolean));
    if (problem === "backRow") { setNote("Black holes can't go in either side's two back rows."); return; }
    if (problem === "wall") { setNote("That would cut the board in two: every square must still be reachable."); return; }
    if (problem === "centre") { setNote("The middle square has no partner. Pick another."); return; }
    if (problem) { setNote("Pick another square."); return; }
    const d = cloneSelections(draft);
    let list = spots.slice();
    if (isHole) list = [{ row: r, col: c, random: false }];
    else {
      if (list.length >= count) {
        const i = list.findIndex((p) => p.random);
        if (i < 0) { setNote(`All ${count} ${count === 1 ? "pair is" : "pairs are"} marked. Unmark one, or add a pair.`); return; }
        list.splice(i, 1);
      }
      list.push({ row: r, col: c, random: false });
    }
    setSpots(d, list);
    if (isHole) { onDone(d); return; }
    setDraft(d); setNote("");
  };
  const maxW = Math.min((typeof window !== "undefined" ? window.innerWidth : 600) - 64, 560);
  const maxH = Math.max(160, (typeof window !== "undefined" ? window.innerHeight : 800) * 0.5);
  const cell = Math.max(14, Math.floor(Math.min(maxW / cols, maxH / rows)));
  const cells = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const at = marks.get(`${r},${c}`);
      const cls = ["rg-cell", (r + c) % 2 ? "dk" : "lt"];
      if (pieceAt(r, c)) cls.push("piece");
      if (!at && isHole && spotProblem(draft, "hole", r, c) === "backRow") cls.push("banned");
      const mark = at ? h("span", { className: `mk${at.mirror ? " mirror" : ""}${at.spot.random ? " rolled" : ""}` }, isHole ? "O" : "X")
        : other.has(`${r},${c}`) ? h("span", { className: "mk mirror" }, isHole ? "X" : "O") : null;
      cells.push(h("button", {
        key: `${r},${c}`, type: "button", className: cls.join(" "), "data-testid": `gate-cell-${r}-${c}`,
        "aria-label": `Row ${r + 1}, column ${c + 1}${at ? (isHole ? ", black hole" : ", cut out") : ""}`,
        style: { width: cell, height: cell, fontSize: Math.max(10, cell * 0.55) }, onClick: () => tap(r, c),
      }, mark));
    }
  }
  const title = isHole ? "Place the black holes" : "Mark the squares to cut out";
  return h("div", { className: "rg-pick", "data-testid": "gate-picker", role: "dialog", "aria-modal": "true", "aria-label": title,
    onClick: (e) => { if (e.target === e.currentTarget) onCancel(); } },
    h("div", { className: "rg-pick-box" },
      h("h3", null, title),
      h("p", null, isHole
        ? "Tap a square for one black hole; its partner, turned half round, is marked for you. Not in either side's two back rows."
        : `Tap up to ${count} ${count === 1 ? "square" : "squares"}; each one's partner, turned half round, is marked for you. Dashed marks were picked at random: tap one to keep it. Dots show where the pieces start.`),
      h("div", { className: "rg-side" }, `Far side · ${names.light}`),
      h("div", { className: "rg-grid", role: "grid", "aria-label": `${boardLabel(draft)} board`, style: { gridTemplateColumns: `repeat(${cols}, ${cell}px)` } }, cells),
      h("div", { className: "rg-side" }, `Near side · ${names.dark}`),
      h("div", { className: "rg-pick-note", role: "status" }, note),
      h("div", { className: "rg-pick-btns" },
        h("button", { type: "button", className: "rg-small", "data-testid": "gate-picker-random", onClick: () => setDraft(randomizeSpots(cloneSelections(draft), kind)) }, "Random"),
        h("button", { type: "button", className: "rg-small", onClick: onCancel }, "Cancel"),
        h("button", { type: "button", className: "rg-small", "data-testid": "gate-picker-done", onClick: () => onDone(isHole ? draft : fillSpots(cloneSelections(draft), kind)) }, "Done"))));
}

/* ------------------------------------------------------------ the pieces' pictures */

/* Each piece as this reality draws it (user: so people know what they're
   choosing, and in that theme's own look): built by the theme's own
   buildPieceVisual (as the board's and the dock's are), lit as the dock
   piece is, and taken at a three-quarter angle into a still. All of them
   in one short-lived WebGL context, released straight after (as Neon's
   MATTER stills, piece-showcase.js). Light's pieces; the poses are the
   pieces' first starting ones (POSES). Sizes stay true to each other,
   only the smallest brought up a little to be seen. */
const pictures = new Map(); // `${world}|${type}` -> data URL
const PIC_W = 132, PIC_H = 100;
function piecePictures(world, look, types) {
  const todo = types.filter((t) => POSES[t] && !pictures.has(`${world}|${t}`));
  if (!todo.length || !look || !look.buildPieceVisual || typeof document === "undefined") return false;
  let renderer = null;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(PIC_W, PIC_H, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 4, 3); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-3, 1.5, -2); scene.add(fill);
    const camera = new THREE.PerspectiveCamera(26, PIC_W / PIC_H, 0.05, 100);
    const edge = look.EDGE_RADIUS || 0.06;
    const built = todo.map((type) => {
      const pose = POSES[type], g = new THREE.Group();
      const isDisc = !!pose.disc;
      const piece = isDisc ? { id: `pic-${type}`, type, owner: "light", w: 1, h: 1, z: 1 } : { id: `pic-${type}`, type, owner: "light", ...pose };
      const geo = isDisc
        ? new THREE.CylinderGeometry((DISC_DIAM * CABEZA_SCALE) / 2, (DISC_DIAM * CABEZA_SCALE) / 2, DISC_H * CABEZA_SCALE, 40)
        : pose.vox ? makePolycubeSmooth(piece, PIECE_SCALE, edge) : makeRoundedBox(pose.w * PIECE_SCALE, pose.z * PIECE_SCALE, pose.h * PIECE_SCALE, edge);
      const { mesh, shell } = look.buildPieceVisual({ piece, isDark: false, isDisc, geo, center: { x: 0, z: 0 }, y: 0 });
      // (A see-through body that doesn't write depth: a depth pass first,
      // so its outline's far edges are hidden, as the dock does.)
      if (mesh.material && mesh.material.transparent && mesh.material.depthWrite === false) {
        const d = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); d.position.copy(mesh.position); d.renderOrder = 0; g.add(d);
      }
      g.add(mesh); if (shell) g.add(shell);
      const box = new THREE.Box3().setFromObject(g), c = new THREE.Vector3(), size = new THREE.Vector3();
      box.getCenter(c); box.getSize(size);
      g.position.sub(c);
      return { type, g, geo, r: size.length() / 2 };
    });
    const rMax = Math.max(...built.map((b) => b.r));
    built.forEach(({ type, g, geo, r }) => {
      scene.add(g);
      const dist = (Math.max(r, rMax * 0.62) / Math.sin((camera.fov * Math.PI) / 360)) * 1.05;
      const az = 0.72, el = 0.48;
      camera.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      pictures.set(`${world}|${type}`, canvas.toDataURL("image/png"));
      scene.remove(g);
      geo.dispose(); // (the theme's own materials and outlines may be shared with the board: left be)
    });
    return true;
  } catch (e) {
    return false;
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
}
// (Other menus' rows use them too: Lluvia's city.)
export const piecePicture = (world, type) => pictures.get(`${world}|${type}`) || null;
export const piecePicturesReady = (world, look) => piecePictures(world, look, PICTURE_TYPES) || PICTURE_TYPES.every((t) => !POSES[t] || pictures.has(`${world}|${t}`));
const PICTURE_TYPES = ["cabeza", "turrito", "flaco", "chato", "opa", "block1x3", "block2x3", "arcoChico", "arcoAlto", "arcoAncho", "codo", "rayo", "zeta"];

/* ------------------------------------------------------------ the sheet */

function NovaSheet({ api, initial, onBack, onPlay, world, pieceLook }) {
  const [sel, setSel] = React.useState(() => normalizeSelections(cloneSelections(initial || readKept())));
  // The pieces' pictures, once the sheet is up (not to hold up its slide).
  const [, setPicsReady] = React.useState(0);
  React.useEffect(() => {
    const id = setTimeout(() => { if (piecePictures(world, pieceLook, PICTURE_TYPES)) setPicsReady((n) => n + 1); }, 450);
    return () => clearTimeout(id);
  }, []);
  const picOf = (key) => pictures.get(`${world}|${pieceTypeOf(key)}`) || null;
  const [picker, setPicker] = React.useState(null); // null | "missing" | "hole"
  const change = (fn) => setSel((s) => { const n = cloneSelections(s); fn(n); return n; });
  const total = totalPieces(sel), tooMany = total > MAX_PIECES;
  const fits = piecesFit(sel);
  const narrowest = fits ? null : minColsFor(sel);
  const warnings = lawWarnings(sel);
  // Pivot on with no Codo, Rayo or Zeta: the warning flashes, then the
  // three flash where they sit (pivot-guide.js).
  const showPivots = usePivotGuide(warnings.some((w) => w.key === "cantileverPivot"), { warnSel: '[data-testid="gate-law-warning-cantileverPivot"]', rowSel: (k) => `[data-testid="gate-piece-${k}"]` });
  const { aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY, busy, aiThinking } = api || {};
  const locked = !!(busy || aiThinking);
  const names = sideNamesFor(world); // what this world calls its two sides
  const resize = (rows, cols) => change((n) => { n.rows = clampDim(rows); n.cols = clampDim(cols); refreshSpots(n); });
  const canPlay = !tooMany && fits && total > 0 && sel.counts.cabeza > 0;

  const opponent = selectOpponent && AI_DIFFICULTY ? h("section", { className: "rg-sec", "aria-label": "Who's playing" },
    h("h3", null, "Who's playing"),
    h(Seg, { label: "Opponent", className: "rg-opp" },
      segBtn("h", aiPlayer == null, "Two humans", () => !locked && selectOpponent(null), "gate-opponent-human", locked),
      segBtn("d", aiPlayer === "dark", `Computer plays ${names.dark}`, () => !locked && selectOpponent("dark"), "gate-opponent-dark", locked),
      segBtn("l", aiPlayer === "light", `Computer plays ${names.light}`, () => !locked && selectOpponent("light"), "gate-opponent-light", locked)),
    aiPlayer != null && h("div", { className: "rg-row" },
      h("span", { className: "rg-name" }, "How well it plays"),
      h(Seg, { label: "How well the computer plays" }, Object.entries(AI_DIFFICULTY).map(([k, cfg]) => segBtn(k, aiDifficulty === k, cfg.label, () => setAiDifficulty(k), `gate-skill-${k}`, locked))))) : null;

  const pieces = h("section", { className: "rg-sec", "aria-label": "Pieces" },
    h("h3", null, "Pieces, each side"),
    PIECE_OPTIONS.map((p) => h(React.Fragment, { key: p.key },
      h("div", { className: "rg-row rg-piece", "data-testid": `gate-piece-${p.key}` },
        h("span", { className: "rg-piece-id" },
          h("span", { className: "rg-pic", "aria-hidden": "true" }, picOf(p.key) ? h("img", { src: picOf(p.key), alt: "", "data-testid": `gate-pic-${p.key}` }) : null),
          h("span", { className: "rg-name" }, p.name, p.def ? h("span", { className: "rg-note" }, "In the classic game") : p.note ? h("span", { className: "rg-note" }, p.note) : null)),
        h(Stepper, { value: sel.counts[p.key], min: p.min, max: p.max, label: p.name, testid: `gate-count-${p.key}`, onChange: (v) => change((n) => { n.counts[p.key] = v; }) })))),
    h("div", { className: `rg-total${tooMany ? " bad" : ""}`, "data-testid": "gate-total" },
      tooMany ? `${total} pieces a side: ${MAX_PIECES} at most.` : `${total} ${total === 1 ? "piece" : "pieces"} a side (up to ${MAX_PIECES}).`),
    !fits && !tooMany && h("div", { className: "rg-warn", "data-testid": "gate-fit" },
      narrowest ? `These pieces need a board at least ${narrowest} wide. Widen it below.` : "These pieces won't set out on any board. Take some off."));

  const rules = h("section", { className: "rg-sec", "aria-label": "Rules" },
    h("h3", null, "Rules"),
    LAW_OPTIONS.map((l) => h(React.Fragment, { key: l.key },
      h("div", { className: "rg-row" },
        h("span", { className: "rg-name" }, l.name, h("span", { className: "rg-note" }, l.note)),
        h(Switch, { on: sel.laws[l.key], label: l.name, testid: `gate-law-${l.key}`, onClick: () => change((n) => toggleLaw(n, l.key)) })),
      l.key === "shoving" && sel.laws.shoving && h("div", { className: "rg-sub" },
        SHOVE_SETTINGS.map((s) => h(Seg, { key: s.key, label: s.name }, s.options.map((o) => segBtn(String(o.value), (sel.shove[s.key] !== false) === o.value, o.name, () => change((n) => setShove(n, s.key, o.value)), `gate-shove-${o.value ? "rolls" : "slides"}`))))),
      l.key === "blackHoleSquares" && sel.laws.blackHoleSquares && h("div", { className: "rg-sub" },
        h("div", { className: "rg-row" },
          h("span", { className: "rg-note" }, sel.holeSpot ? (sel.holeSpot.random ? "Placed at random." : "Placed by hand.") : "Placed at random."),
          h("button", { type: "button", className: "rg-small", "data-testid": "gate-place-holes", onClick: () => setPicker("hole") }, "Place them"))))),
    warnings.map((w) => h("div", { key: w.testid, className: "rg-warn", "data-testid": `gate-${w.testid}`, ...(w.key === "cantileverPivot" ? { onClick: showPivots, style: { cursor: "pointer" }, title: "Show me" } : {}) }, w.text)));

  const board = h("section", { className: "rg-sec", "aria-label": "Board" },
    h("h3", null, "Board"),
    h("div", { className: "rg-row" },
      h("span", { className: "rg-name" }, "Size", h("span", { className: "rg-note" }, `${boardLabel(sel)} squares`)),
      h(Seg, { label: "Quick sizes" }, SIZES.map((n) => segBtn(n, sel.rows === n && sel.cols === n, `${n}×${n}`, () => resize(n, n), `gate-size-${n}`)))),
    h("div", { className: "rg-row" }, h("span", { className: "rg-name" }, "Width", h("span", { className: "rg-note" }, "Across a home row")),
      h(Stepper, { value: sel.cols, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM, label: "Board width", testid: "gate-cols", onChange: (v) => resize(sel.rows, v) })),
    h("div", { className: "rg-row" }, h("span", { className: "rg-name" }, "Length", h("span", { className: "rg-note" }, "From one side to the other")),
      h(Stepper, { value: sel.rows, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM, label: "Board length", testid: "gate-rows", onChange: (v) => resize(v, sel.cols) })),
    h("div", { className: "rg-row" },
      h("span", { className: "rg-name" }, "Shuffled start", h("span", { className: "rg-note" }, "The pieces set out in a random order.")),
      h(Switch, { on: sel.random, label: "Shuffled start", testid: "gate-random", onClick: () => change((n) => { n.random = !n.random; }) })),
    h("div", { className: "rg-row" },
      h("span", { className: "rg-name" }, "Missing squares", h("span", { className: "rg-note" }, "Pairs of squares cut out of the board.")),
      h(Switch, { on: sel.missing, label: "Missing squares", testid: "gate-missing", onClick: () => change((n) => { n.missing = !n.missing; if (n.missing) fillSpots(n, "missing"); }) })),
    sel.missing && h("div", { className: "rg-sub" },
      h("div", { className: "rg-row" }, h("span", { className: "rg-name" }, "Pairs"),
        h(Stepper, { value: sel.missingCount, min: 1, max: MAX_MISSING_PAIRS, label: "Pairs cut out", testid: "gate-missing-count", onChange: (v) => change((n) => { n.missingCount = v; n.missingSpots = n.missingSpots.slice(0, v); fillSpots(n, "missing"); }) })),
      h("div", { className: "rg-row" }, h("span", { className: "rg-note" }, "Random unless you mark them."),
        h("button", { type: "button", className: "rg-small", "data-testid": "gate-mark-missing", onClick: () => setPicker("missing") }, "Mark them"))));

  return h(React.Fragment, null,
    h("div", { className: "rg-sheet", "data-testid": "gate-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Cabeza Nova" },
      h("div", { className: "rg-head" },
        h("button", { type: "button", className: "rg-icon", "aria-label": "Back", "data-testid": "gate-sheet-back", onClick: onBack }, ICON_BACK),
        h("h2", null, "Cabeza Nova"),
        h("span", null)),
      h("div", { className: "rg-body" }, opponent, pieces, rules, board),
      h("div", { className: "rg-foot" },
        h("button", { type: "button", className: "rg-btn plain", "data-testid": "gate-reset", onClick: () => setSel(defaultSelections()) }, "Reset"),
        h("button", { type: "button", className: "rg-btn go", "data-testid": "gate-play", disabled: !canPlay, onClick: () => { keep(sel); onPlay(sel); } }, "Play"))),
    picker && h(SpotPicker, { sel, kind: picker, names, onCancel: () => setPicker(null), onDone: (d) => { setSel(d); setPicker(null); } }));
}

/* ------------------------------------------------------------ the gate */

/* `api`: the chassis's own setters and game start (as a theme's setup
   extras get them). `world`: this reality's id (realities.js). `stage`:
   "choose" (the two buttons) or "nova" (the sheet, with `sel`).
   `novaGo`: in Nova, its own places switch in place. `pieceLook`: the
   theme's { buildPieceVisual, EDGE_RADIUS }, for the pieces' pictures.
   onClose(): it's done. */
export function RealityGate({ api, world, stage: initialStage = "choose", sel: initialSel = null, novaGo = null, pieceLook = null, onClose }) {
  ensureCss();
  const [stage, setStage] = React.useState(initialStage);
  const [hidden, setHidden] = React.useState(false);
  const w = WORLDS.find((x) => x.id === world);
  const reopen = (s) => openRealityGate({ stage: "nova", sel: s });
  const standard = () => { onClose(); beginCustomGame(defaultSelections(), api, null); };
  const play = (sel) => { onClose(); beginCustomGame(sel, api, reopen); };
  // (The menu over it; back to the buttons if you stay, or pick where
  // you already are.)
  const realities = () => {
    setHidden(true);
    openRealities(world, novaGo ? (to, pick) => { setHidden(false); novaGo(to, pick); } : null, () => setHidden(false));
  };
  return h("div", {
    className: `rg-layer${stage === "nova" ? " rg-sheet-on" : ""}`, "data-testid": "reality-gate", "data-world": world, "data-stage": stage,
    style: { ...varsOf(lookOf(world)), display: hidden ? "none" : undefined },
  },
  stage === "choose"
    ? h("div", { className: "rg-choose", role: "dialog", "aria-label": "How to play" },
      w && h("div", { className: "rg-kicker" }, w.name),
      h("button", { type: "button", className: "rg-big", "data-testid": "gate-standard", onClick: standard },
        h("span", { className: "rg-big-t" }, "Standard Cabeza"),
        h("span", { className: "rg-big-s" }, "The classic game: five pieces each, the standard 10x10 board.")),
      h("button", { type: "button", className: "rg-big rg-nova", "data-testid": "gate-nova", onClick: () => setStage("nova") },
        h("span", { className: "rg-big-t" }, "Cabeza Nova"),
        h("span", { className: "rg-big-s" }, "Every piece, rule and board. Set it up, then play.")),
      h("button", { type: "button", className: "rg-link", "data-testid": "gate-realities", onClick: realities }, "Other realities"))
    : h(NovaSheet, { api, initial: initialSel, onBack: () => setStage("choose"), onPlay: play, world, pieceLook }));
}
