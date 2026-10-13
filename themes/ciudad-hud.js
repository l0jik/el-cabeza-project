/* Ciudad's time-of-day switch (user: "Maybe just have a toggle switch to
   switch between the different times of day ... they can basically play
   in that city and change the time of day that they're playing").

   A street sign at the top right, the hour's picture and its name on it
   (on a phone, the picture alone). A tap opens the five times, each with
   its clock; a pick eases the city into it (ciudad-time.js) and is kept
   for next time. A tap outside or Escape puts it away. There in the
   setup and in play alike. React through createElement, as the other
   overlays, so the theme still imports in plain Node. */

import React from "react";
import { TIMES, timeId, setTime, onTimeChange } from "./ciudad-time.js";

const h = React.createElement;

// Each hour's picture, drawn in the sign's own white (currentColor). On a
// phone the sign shows the picture alone, so morning and the golden hour
// are told apart as a sunrise and a sunset: the sun on the horizon, an
// arrow up over it or down.
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

export const HUD_CSS = `
  .ciu-time { position: fixed; z-index: 13; top: calc(78px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px));
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font-family: 'Overpass', 'Arial Narrow', Arial, sans-serif; }
  .ciu-time .chip { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; height: 38px; padding: 0 13px 0 11px;
    border-radius: 7px; background: #2F4458; color: #FFFFFF; font: 700 12.5px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
    box-shadow: inset 0 0 0 2px #2F4458, inset 0 0 0 3.2px rgba(255,255,255,0.9), 0 6px 18px rgba(16,24,34,0.28); opacity: 0.86; transition: opacity 0.2s ease, transform 0.2s ease; }
  .ciu-time .chip:hover, .ciu-time .chip[aria-expanded="true"] { opacity: 1; }
  .ciu-time .chip:focus-visible { outline: 2px solid #F2C230; outline-offset: 3px; }
  .ciu-time .chip .lbl { padding-top: 2px; white-space: nowrap; }
  .ciu-time .chip .car { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid rgba(255,255,255,0.85); margin-left: 1px; transition: transform 0.2s ease; }
  .ciu-time .chip[aria-expanded="true"] .car { transform: rotate(180deg); }
  .ciu-time .card { width: 232px; box-sizing: border-box; padding: 10px 8px 8px; border-radius: 11px; background: rgba(244,244,240,0.97); color: #24313D;
    box-shadow: 0 0 0 1px rgba(36,49,61,0.14), 0 18px 44px rgba(16,24,34,0.32); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .ciu-time .card .hd { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 8px 8px; font: 600 10.5px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #5E6E7E; }
  .ciu-time .card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .ciu-time .opt { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 9px; border-radius: 8px; }
  .ciu-time .opt .ic { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: none; border-radius: 6px; background: rgba(47,68,88,0.1); color: #2F4458; }
  .ciu-time .opt .nm { flex: 1; font: 700 14.5px/1.1 'Overpass', 'Arial Narrow', Arial, sans-serif; padding-top: 2px; }
  .ciu-time .opt .ck { font: 400 11.5px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; color: #5E6E7E; font-variant-numeric: tabular-nums; }
  .ciu-time .opt:hover { background: rgba(47,68,88,0.08); }
  .ciu-time .opt:focus-visible { outline: 2px solid #2F4458; outline-offset: -2px; }
  .ciu-time .opt[aria-checked="true"] { background: #2F4458; color: #FFFFFF; }
  .ciu-time .opt[aria-checked="true"] .ic { background: rgba(255,255,255,0.14); color: #FFFFFF; }
  .ciu-time .opt[aria-checked="true"] .ck { color: rgba(255,255,255,0.75); }
  @media (max-width: 560px) {
    .ciu-time { top: calc(46px + env(safe-area-inset-top, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); }
    .ciu-time .chip { width: 40px; height: 40px; padding: 0; justify-content: center; gap: 0; }
    .ciu-time .chip .lbl, .ciu-time .chip .car { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .ciu-time .chip, .ciu-time .chip .car { transition: none; } }
`;

function TimeSwitch() {
  const [id, setId] = React.useState(timeId());
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  React.useEffect(() => onTimeChange((v) => setId(v)), []);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key); };
  }, [open]);
  const cur = TIMES.find((t) => t.id === id) || TIMES[0];
  return h("div", { className: "ciu-time", ref: rootRef, "data-testid": "ciudad-time", "data-time": id },
    h("button", {
      type: "button", className: "chip", "data-testid": "ciudad-time-chip", "aria-expanded": open ? "true" : "false", "aria-controls": "ciu-time-list",
      "aria-label": `Time of day: ${cur.name}. Change it`, title: `Time of day: ${cur.name}`,
      onClick: () => setOpen((o) => !o),
    }, glyph(cur.id), h("span", { className: "lbl" }, cur.name), h("span", { className: "car" })),
    open && h("div", { className: "card", id: "ciu-time-list" },
      h("div", { className: "hd" }, h("span", null, "Time of day"), h("span", null, "The city")),
      h("ul", { role: "radiogroup", "aria-label": "Time of day" },
        TIMES.map((t) => h("li", { key: t.id },
          h("button", {
            type: "button", role: "radio", className: "opt", "aria-checked": t.id === id ? "true" : "false", "data-testid": `ciudad-time-${t.id}`,
            onClick: () => { setTime(t.id); setOpen(false); },
          }, h("span", { className: "ic" }, glyph(t.id, 17)), h("span", { className: "nm" }, t.name), h("span", { className: "ck" }, t.clock)))))));
}

/* The chassis draws this over the game (theme.renderExtraOverlays). */
export function renderExtraOverlays(x) {
  if (!x || !x.ciudad) return null;
  return h(TimeSwitch, { key: "ciudad-time" });
}
