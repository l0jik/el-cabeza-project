/* Ciudad's time of day, as a clock (user: "Maybe just have a toggle switch
   to switch between the different times of day"; then "Maybe the time of
   day switch can be a clock").

   A street clock on a sign at the top right, its hands at the hour the
   city's at, the hour's name beside it (on a phone, the clock alone). A
   tap opens the dial: the five hours where they fall on it, each its
   picture; the one picked says its name and time under it. A pick eases
   the city into that hour (ciudad-time.js) and the hands go round to it
   with the light, forward, the way time goes; the dial stays to be
   watched until a tap outside or Escape. Kept for next time. There in the
   setup and in play alike; under a replay's bar while one's playing
   (--ec-replay-clear, from the chassis: on a phone it stood over the
   bar's end). React through createElement, as the other
   overlays, so the theme still imports in plain Node. */

import React from "react";
import { TIMES, NOW, timeId, setTime, onTimeChange } from "./ciudad-time.js";
import { useRaise } from "../chassis/raise-on-tap.js";

const h = React.createElement;
const byId = (id) => TIMES.find((t) => t.id === id) || TIMES[0];
// A clock's time as minutes round a twelve-hour face.
const minutesOf = (clock) => { const m = /(\d+):(\d+)/.exec(clock || "") || [0, 12, 0]; return (+m[1] % 12) * 60 + +m[2]; };
// Where the hands are now: while the city changes, gone forward from the
// hour it left, as far as the light has.
function handsNow() {
  const to = minutesOf(byId(NOW.id).clock);
  if (!NOW.changing) return to;
  const from = minutesOf(byId(NOW.fromId).clock), d = (((to - from) % 720) + 720) % 720;
  return from + d * NOW.k;
}
const angleOf = (m) => (m / 720) * 360;

// Each hour's picture, drawn in currentColor. Morning and the golden hour
// a sunrise and a sunset: the sun on the horizon, an arrow up over it or
// down.
const ICON = {
  morning: [
    h("path", { key: "h", d: "M3 18.5h18" }),
    h("path", { key: "s", d: "M7.5 18.5a4.5 4.5 0 0 1 9 0" }),
    h("path", { key: "a", d: "M12 3.5v6M9.2 6.3 12 3.5l2.8 2.8" }),
    h("path", { key: "r", d: "M4.9 11.4l1.5 1.5M19.1 11.4l-1.5 1.5" }),
  ],
  afternoon: [
    h("circle", { key: "s", cx: 12, cy: 12, r: 4.2 }),
    h("path", { key: "r", d: "M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" }),
  ],
  golden: [
    h("path", { key: "h", d: "M3 18.5h18M7 21.5h10" }),
    h("path", { key: "s", d: "M7.5 18.5a4.5 4.5 0 0 1 9 0" }),
    h("path", { key: "a", d: "M12 3.5v6M9.2 6.7 12 9.5l2.8-2.8" }),
    h("path", { key: "r", d: "M4.9 11.4l1.5 1.5M19.1 11.4l-1.5 1.5" }),
  ],
  overcast: [
    h("path", { key: "c", d: "M7 18.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z" }),
  ],
  night: [
    h("path", { key: "m", d: "M15.5 4.2a7.6 7.6 0 1 0 4.3 12.3A6.4 6.4 0 0 1 15.5 4.2z" }),
    h("path", { key: "st", d: "M6 4.5v2M5 5.5h2M8.5 9v1.4M7.8 9.7h1.4" }),
  ],
};
const glyph = (id, size = 18) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, ...ICON[id]);

/* ------------------------------------------------------------ the hands */

// Every face drawn (the sign's, the dial's), moved together while the
// city changes: one loop, the hands set from NOW each frame.
const FACES = new Set();
let looping = false;
function setHands() {
  const m = handsNow(), ha = angleOf(m), ma = ((m % 60) / 60) * 360, lit = NOW.night > 0.5;
  FACES.forEach((f) => {
    if (f.hour.current) f.hour.current.setAttribute("transform", `rotate(${ha.toFixed(2)} 50 50)`);
    if (f.minute.current) f.minute.current.setAttribute("transform", `rotate(${ma.toFixed(2)} 50 50)`);
    if (f.root.current) f.root.current.classList.toggle("lit", lit);
  });
}
function sweep() {
  if (looping || typeof requestAnimationFrame === "undefined") return;
  looping = true;
  const step = () => { setHands(); if (NOW.changing) requestAnimationFrame(step); else looping = false; };
  requestAnimationFrame(step);
}
onTimeChange(() => sweep());

// A street clock's face: white (lit warm at night), its hours marked, the
// quarters heavier; the big one numbered.
function Face({ size, big }) {
  const hour = React.useRef(null), minute = React.useRef(null), root = React.useRef(null);
  React.useEffect(() => { const f = { hour, minute, root }; FACES.add(f); setHands(); if (NOW.changing) sweep(); return () => { FACES.delete(f); }; }, []);
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const q = i % 3 === 0, a = (i / 12) * Math.PI * 2, r0 = q ? (big ? 38 : 33) : (big ? 41 : 37), r1 = 45;
    ticks.push(h("line", { key: i, className: q ? "tq" : "tk", x1: 50 + Math.sin(a) * r0, y1: 50 - Math.cos(a) * r0, x2: 50 + Math.sin(a) * r1, y2: 50 - Math.cos(a) * r1 }));
  }
  const nums = big ? [["12", 50, 29], ["3", 72, 54], ["6", 50, 78.5], ["9", 28, 54]].map(([t, x, y]) => h("text", { key: t, x, y, className: "num", textAnchor: "middle" }, t)) : [];
  return h("svg", { ref: root, className: "face" + (big ? " big" : ""), width: size, height: size, viewBox: "0 0 100 100", "aria-hidden": "true" },
    h("circle", { className: "rim", cx: 50, cy: 50, r: 49 }),
    h("circle", { className: "dial", cx: 50, cy: 50, r: 46 }),
    ...ticks, ...nums,
    // (set here too, so the first paint has them right; the loop moves them after)
    h("line", { ref: hour, className: "hh", x1: 50, y1: 56, x2: 50, y2: big ? 27 : 25, transform: `rotate(${angleOf(handsNow()).toFixed(2)} 50 50)` }),
    h("line", { ref: minute, className: "mh", x1: 50, y1: 58, x2: 50, y2: big ? 13 : 12, transform: `rotate(${(((handsNow() % 60) / 60) * 360).toFixed(2)} 50 50)` }),
    h("circle", { className: "cap", cx: 50, cy: 50, r: big ? 3.4 : 5 }));
}

export const HUD_CSS = `
  .ciu-time { position: fixed; z-index: 13; top: max(calc(78px + env(safe-area-inset-top, 0px)), var(--ec-replay-clear, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); transition: top 0.25s ease;
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font-family: 'Overpass', 'Arial Narrow', Arial, sans-serif; }
  .ciu-time .chip { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; height: 40px; padding: 0 13px 0 6px;
    border-radius: 8px; background: #2F4458; color: #FFFFFF; font: 700 12.5px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
    box-shadow: inset 0 0 0 2px #2F4458, inset 0 0 0 3.2px rgba(255,255,255,0.9), 0 6px 18px rgba(16,24,34,0.28); opacity: 0.6; transition: opacity 0.2s ease; }
  /* At 60% till it's wanted, as the Rules tab (user: "Dim the circled
     buttons ... a tap or hover before a click on a mouse will raise them
     100% again"; chassis/raise-on-tap.js): a mouse over it, a first tap on
     a touch screen, the dial open or a key's focus raise it. */
  .ciu-time .chip[data-raised="true"], .ciu-time .chip[aria-expanded="true"], .ciu-time .chip:focus-visible { opacity: 1; }
  @media (hover: hover) { .ciu-time .chip:hover { opacity: 1; } }
  .ciu-time .chip:focus-visible { outline: 2px solid #F2C230; outline-offset: 3px; }
  .ciu-time .chip .lbl { padding-top: 2px; white-space: nowrap; }
  .ciu-time .chip .car { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid rgba(255,255,255,0.85); margin-left: 1px; transition: transform 0.2s ease; }
  .ciu-time .chip[aria-expanded="true"] .car { transform: rotate(180deg); }
  .ciu-time .face { display: block; flex: none; overflow: visible; }
  .ciu-time .face .rim { fill: #1d2a36; }
  .ciu-time .face .dial { fill: #ffffff; transition: fill 0.6s ease; }
  .ciu-time .face.lit .dial { fill: #fff2d4; }
  .ciu-time .face.lit { filter: drop-shadow(0 0 5px rgba(255,214,150,0.65)); }
  .ciu-time .face .tk { stroke: #8a96a2; stroke-width: 2; stroke-linecap: round; }
  .ciu-time .face .tq { stroke: #24313D; stroke-width: 4; stroke-linecap: round; }
  .ciu-time .face .hh { stroke: #24313D; stroke-width: 7; stroke-linecap: round; }
  .ciu-time .face .mh { stroke: #24313D; stroke-width: 4.5; stroke-linecap: round; }
  .ciu-time .face .cap { fill: #D8442E; }
  .ciu-time .face.big .tk { stroke-width: 1.2; }
  .ciu-time .face.big .tq { stroke-width: 2.6; }
  .ciu-time .face.big .hh { stroke-width: 4.6; }
  .ciu-time .face.big .mh { stroke-width: 2.8; }
  .ciu-time .face .num { font: 600 9.5px 'Overpass Mono', 'DejaVu Sans Mono', monospace; fill: #5E6E7E; }
  .ciu-time .card { width: 236px; box-sizing: border-box; padding: 10px 10px 12px; border-radius: 12px; background: rgba(244,244,240,0.97); color: #24313D;
    box-shadow: 0 0 0 1px rgba(36,49,61,0.14), 0 18px 44px rgba(16,24,34,0.32); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .ciu-time .card .hd { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 6px 0; font: 600 10.5px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #5E6E7E; }
  .ciu-time .clock { position: relative; width: 156px; height: 156px; margin: 22px auto 18px; }
  .ciu-time .clock .face { width: 156px; height: 156px; }
  .ciu-time .mark { all: unset; box-sizing: border-box; cursor: pointer; position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; background: #FFFFFF; color: #2F4458;
    box-shadow: 0 0 0 1.5px rgba(47,68,88,0.35), 0 3px 8px rgba(16,24,34,0.18); transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; }
  .ciu-time .mark:hover { transform: scale(1.08); }
  .ciu-time .mark:focus-visible { outline: 2px solid #F2C230; outline-offset: 2px; }
  .ciu-time .mark[aria-checked="true"] { background: #2F4458; color: #FFFFFF; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 3.5px #2F4458, 0 4px 10px rgba(16,24,34,0.28); }
  .ciu-time .now { text-align: center; }
  .ciu-time .now .nm { font: 800 17px/1.1 'Overpass', 'Arial Narrow', Arial, sans-serif; }
  .ciu-time .now .ck { margin-top: 3px; font: 400 12px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; color: #5E6E7E; font-variant-numeric: tabular-nums; }
  @media (max-width: 560px) {
    .ciu-time { top: max(calc(46px + env(safe-area-inset-top, 0px)), var(--ec-replay-clear, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); }
    .ciu-time .chip { width: 42px; height: 42px; padding: 0; justify-content: center; gap: 0; }
    .ciu-time .chip .lbl, .ciu-time .chip .car { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .ciu-time .chip, .ciu-time .chip .car, .ciu-time .mark, .ciu-time .face .dial { transition: none; } }
`;

function TimeSwitch() {
  const [id, setId] = React.useState(timeId());
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const lift = useRaise(rootRef, open);
  React.useEffect(() => onTimeChange((v) => setId(v)), []);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key); };
  }, [open]);
  const cur = byId(id);
  // (each hour's place on the dial: where the hour hand points then)
  const marks = TIMES.map((t) => { const a = (angleOf(minutesOf(t.clock)) * Math.PI) / 180, r = 78; return { t, x: 78 + Math.sin(a) * r, y: 78 - Math.cos(a) * r }; });
  return h("div", { className: "ciu-time", ref: rootRef, "data-testid": "ciudad-time", "data-time": id },
    h("button", {
      type: "button", className: "chip", "data-testid": "ciudad-time-chip", "aria-expanded": open ? "true" : "false", "aria-controls": "ciu-time-dial",
      "aria-label": `Time of day: ${cur.name}, ${cur.clock}. Change it`, title: `Time of day: ${cur.name}, ${cur.clock}`,
      "data-raised": lift.raised ? "true" : "false", onPointerDown: lift.onPointerDown,
      onClick: (e) => { if (!open && lift.firstTapRaises(e)) return; setOpen((o) => !o); },
    }, h(Face, { size: 30 }), h("span", { className: "lbl" }, cur.name), h("span", { className: "car" })),
    open && h("div", { className: "card", id: "ciu-time-dial" },
      h("div", { className: "hd" }, h("span", null, "Time of day"), h("span", null, "The city")),
      h("div", { className: "clock", role: "radiogroup", "aria-label": "Time of day" },
        h(Face, { size: 156, big: true }),
        ...marks.map(({ t, x, y }) => h("button", {
          key: t.id, type: "button", role: "radio", className: "mark", "aria-checked": t.id === id ? "true" : "false", "data-testid": `ciudad-time-${t.id}`,
          "aria-label": `${t.name}, ${t.clock}`, title: `${t.name}, ${t.clock}`, style: { left: `${x}px`, top: `${y}px` },
          onClick: () => setTime(t.id),
        }, glyph(t.id, 18)))),
      h("div", { className: "now", "aria-live": "polite" }, h("div", { className: "nm" }, cur.name), h("div", { className: "ck" }, cur.clock))));
}

/* The chassis draws this over the game (theme.renderExtraOverlays). */
export function renderExtraOverlays(x) {
  if (!x || !x.ciudad) return null;
  return h(TimeSwitch, { key: "ciudad-time" });
}
