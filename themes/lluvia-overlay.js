/* Lluvia's opening and its custom-rules city.

   The opening: over the sky above the clouds, "THE RULES ARE MADE DOWN
   THERE" and a DESCEND button. Descending plays the flythrough (the city
   engine's "descent" mode, with its own score): through the cloud deck,
   into the rain, down past the towers to the plaza, with a caption at
   each stage. It can be skipped, and the whole opening can be passed
   straight to the board.

   The city: three billboards on the plaza, MATTER, LAWS and TOPOLOGIES
   (tap one, or the matching button below), each opening a terminal panel
   of settings. BEGIN THE GAME applies them for real (board size first,
   then the pieces, the laws, missing squares and black holes, the same
   order Neon's sphere uses) and starts the game. The rules then persist
   across New Game until Reset rules, and after a finished game "change the
   rules" brings the city back.

   All of this is a full-screen layer over the chassis while a game is
   still awaiting Begin; themes/lluvia.js shows it through
   renderExtraOverlays. Written with createElement, like Neon's overlays,
   so the theme stays importable in plain Node for the smoke tests. */

import React from "react";
import { PIECE_OPTIONS, LAW_OPTIONS, SIZES, MAX_PIECES, defaultSelections, cloneSelections, totalPieces, beginCustomGame } from "./rules-selections.js";
import { LLUVIA } from "./lluvia-city.js";
import { bus } from "./lluvia-bus.js";

const h = React.createElement;
const PINK = "#ff3dbb", CYAN = "#23e6ff", AMBER = "#ffb347";
const TUBE = (c) => `0 0 4px rgba(255,255,255,0.8), 0 0 10px ${c}, 0 0 22px ${c}, 0 0 40px ${c}`;
const TERM = { fontFamily: "'VT323', monospace", color: "#ffcf8a" };
const SAIRA = "'Saira Condensed', system-ui, sans-serif";
const SAIRA_X = "'Saira Extra Condensed', system-ui, sans-serif";
const ELITE = "'Special Elite', 'Courier New', monospace";
const JP = "'Dela Gothic One', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'IPAGothic', 'Yu Gothic', sans-serif";

/* ------------------------------------------------------------ settings */

/* The choices themselves, and applying them to a game, are shared with
   Tienda (themes/rules-selections.js); the city only adds its signs. */
const SIGN = { cabeza: "頭", turrito: "塔", flaco: "細", chato: "平", opa: "重", codo: "肘", arco: "弧", rayo: "雷", zeta: "乙" };
// [key, name, sign, min, max, default]
const PIECES = PIECE_OPTIONS.map((p) => [p.key, p.name, SIGN[p.key], p.min, p.max, p.def]);
const LAWS = LAW_OPTIONS.map((l) => [l.key, l.name, l.note]);
const clone = cloneSelections;
const totalOf = totalPieces;
export { defaultSelections };
export const beginCityGame = beginCustomGame;

/* ------------------------------------------------------------ pieces of UI */

const ICON = {
  back: h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M19 12H5" }), h("path", { d: "M11 6l-6 6 6 6" })),
  down: h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M12 5v14" }), h("path", { d: "M6 13l6 6 6-6" })),
  arrow: h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M5 12h14" }), h("path", { d: "M13 6l6 6-6 6" })),
  sound: h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M4 9h4l5-4v14l-5-4H4z" }), h("path", { d: "M16.5 8.5a5 5 0 0 1 0 7" }), h("path", { d: "M19 6a8.5 8.5 0 0 1 0 12" })),
  mute: h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M4 9h4l5-4v14l-5-4H4z" }), h("path", { d: "M17 9l5 5" }), h("path", { d: "M22 9l-5 5" })),
};
const column = { position: "absolute", left: "50%", transform: "translateX(-50%)", width: "min(100%, 460px)", boxSizing: "border-box" };
const termButton = (extra) => ({ height: 38, background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.5)", borderRadius: 3, color: "#ffcf8a", font: "400 22px 'VT323', monospace", cursor: "pointer", ...extra });

function Panel({ panel, sel, change, onClose, sound }) {
  const total = totalOf(sel);
  const title = { matter: ["MATTER", "物質", CYAN, "#e6fdff"], laws: ["LAWS", "法則", PINK, "#fff0fa"], topologies: ["TOPOLOGIES", "位相", AMBER, "#fff4e0"] }[panel];
  let body;
  if (panel === "matter") {
    body = [
      h("div", { key: "t", style: { display: "flex", justifyContent: "space-between", fontSize: 18, padding: "4px 0 8px", color: "#a8783a" } },
        h("span", null, "PIECES PER SIDE"), h("span", { "data-testid": "lluvia-matter-total", style: { color: total > MAX_PIECES ? "#ff5a5a" : "#fff27a" } }, `${total} / ${MAX_PIECES}`)),
      ...PIECES.map(([k, name, sign, min, max]) => {
        const n = sel.counts[k];
        const set = (v) => { sound("key"); change((s) => { s.counts[k] = Math.max(min, Math.min(max, v)); }); };
        return h("div", { key: k, "data-testid": `lluvia-matter-${k}`, style: { display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) 44px 30px 44px", alignItems: "center", gap: 6, minHeight: 46, borderBottom: "1px solid rgba(255,179,71,0.12)", color: n ? "#ffe2b0" : "#8a6a3e" } },
          h("span", { style: { fontFamily: JP, fontSize: 17, color: CYAN } }, sign),
          h("span", { style: { fontSize: 22 } }, name),
          h("button", { type: "button", "aria-label": `Fewer ${name}`, "data-testid": `lluvia-matter-${k}-dec`, onClick: () => set(n - 1), style: termButton() }, "−"),
          h("span", { style: { textAlign: "center", fontSize: 24, color: "#fff27a" } }, String(n)),
          h("button", { type: "button", "aria-label": `More ${name}`, "data-testid": `lluvia-matter-${k}-inc`, onClick: () => set(n + 1), style: termButton() }, "+"));
      }),
    ];
  } else if (panel === "laws") {
    body = LAWS.map(([k, name, note]) => {
      const on = !!sel.laws[k];
      return h("button", {
        key: k, type: "button", "data-testid": `lluvia-law-${k}`, "aria-pressed": on ? "true" : "false",
        onClick: () => { sound("key"); change((s) => {
          s.laws[k] = !on;
          if (k === "diagonalSlide" && !on) s.laws.slide = true; // diagonal needs slide
          if (k === "slide" && on) s.laws.diagonalSlide = false;
        }); },
        style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 10, width: "100%", minHeight: 56, padding: "6px 0", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,179,71,0.12)", textAlign: "left", cursor: "pointer", ...TERM },
      },
      h("span", { style: { display: "flex", flexDirection: "column" } }, h("span", { style: { fontSize: 22, color: "#ffe2b0" } }, name), h("span", { style: { fontSize: 16, color: "#a8783a" } }, note)),
      h("span", { style: { fontSize: 22, color: on ? "#fff27a" : "#7a6040", textShadow: on ? "0 0 8px rgba(255,242,122,0.7)" : "none" } }, on ? "[ ON ]" : "[OFF ]"));
    });
  } else {
    const flag = (k, label) => h("button", {
      key: k, type: "button", "data-testid": `lluvia-topo-${k}`, "aria-pressed": sel[k] ? "true" : "false",
      onClick: () => { sound("key"); change((s) => { s[k] = !s[k]; }); },
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 52, background: "transparent", border: "none", borderTop: "1px solid rgba(255,179,71,0.12)", cursor: "pointer", ...TERM, fontSize: 22, color: "#ffe2b0" },
    }, h("span", null, label), h("span", { style: { color: sel[k] ? "#fff27a" : "#7a6040" } }, sel[k] ? "[ ON ]" : "[OFF ]"));
    body = [
      h("span", { key: "l", style: { display: "block", fontSize: 18, color: "#a8783a", padding: "6px 0" } }, "BOARD SIZE"),
      h("div", { key: "s", style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, paddingBottom: 10 } },
        ...SIZES.map((n) => {
          const on = sel.rows === n && sel.cols === n;
          return h("button", { key: n, type: "button", "data-testid": `lluvia-size-${n}`, "aria-pressed": on ? "true" : "false", onClick: () => { sound("key"); change((s) => { s.rows = n; s.cols = n; }); },
            style: { height: 48, border: "1px solid", borderRadius: 3, font: "400 24px 'VT323', monospace", cursor: "pointer", ...(on ? { background: AMBER, color: "#140a04", borderColor: AMBER } : { background: "transparent", color: "#ffcf8a", borderColor: "rgba(255,179,71,0.5)" }) } }, `${n} × ${n}`);
        })),
      flag("missing", "Missing squares"),
      flag("random", "Randomized start"),
    ];
  }
  return h("div", {
    "data-testid": `lluvia-panel-${panel}`,
    onPointerDown: (e) => e.stopPropagation(),
    style: { ...column, bottom: 10, maxHeight: "74vh", display: "flex", flexDirection: "column", borderRadius: 8, background: "#0e0904", border: "1px solid rgba(255,179,71,0.55)", boxShadow: "inset 0 0 40px rgba(255,140,40,0.14), 0 0 40px rgba(0,0,0,0.8)", overflow: "hidden", ...TERM, width: "min(calc(100% - 20px), 460px)" },
  },
  h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px dashed rgba(255,179,71,0.4)" } },
    h("span", { style: { fontSize: 16, color: "#a8783a", whiteSpace: "nowrap" } }, "KV-OS >"),
    h("span", { style: { whiteSpace: "nowrap", fontFamily: SAIRA_X, fontWeight: 800, fontSize: 22, letterSpacing: "0.06em", color: title[3], textShadow: TUBE(title[2]) } }, title[0], " ", h("span", { style: { fontFamily: JP, fontSize: 17, color: title[2], textShadow: "none" } }, title[1])),
    h("button", { type: "button", "data-testid": "lluvia-panel-close", onClick: onClose, style: { marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap", height: 36, padding: "0 10px", background: "transparent", border: "1px solid rgba(255,179,71,0.6)", borderRadius: 3, color: "#ffcf8a", font: "400 18px 'VT323', monospace", cursor: "pointer" } }, "CLOSE ✕")),
  h("div", { style: { overflowY: "auto", padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 2 } }, ...[].concat(body)));
}

/* ------------------------------------------------------------ the layer */

const CAPTIONS = { clouds: "Above the clouds, the air is still clean.", below: "Below them, it never stops raining.", street: "Down here, every rule has a price." };

export function LluviaOverlay({ start, x, sel: initialSel, onSelChange, onClose }) {
  const canvasRef = React.useRef(null);
  const ctlRef = React.useRef(null);
  const [phase, setPhase] = React.useState(start === "city" ? "city" : "ready");
  const [caption, setCaption] = React.useState("");
  const [panel, setPanel] = React.useState(null);
  const [muted, setMuted] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [sel, setSel] = React.useState(() => clone(initialSel));
  const soundStarted = React.useRef(start !== "city");

  React.useEffect(() => {
    bus.emit("overlay", true);
    const canvas = canvasRef.current;
    const ctl = LLUVIA.mount(canvas, {
      mode: start === "city" ? "city" : "descent",
      onCue: (n) => {
        if (n === "city") { setPhase("city"); setCaption(""); }
        else if (CAPTIONS[n]) { setPhase("flight"); setCaption(CAPTIONS[n]); }
      },
      onPick: (k) => { ctl.select(k); setPanel(k); },
    });
    ctlRef.current = ctl;
    return () => { ctl.destroy(); bus.emit("overlay", false); };
  }, []);

  const sound = (name) => ctlRef.current && ctlRef.current.sound(name);
  const change = (fn) => setSel((s) => { const n = clone(s); fn(n); onSelChange && onSelChange(n); return n; });
  const wakeSound = () => { if (!soundStarted.current) { soundStarted.current = true; ctlRef.current && ctlRef.current.start(); } };
  const openPanel = (k) => { wakeSound(); sound("select"); ctlRef.current && ctlRef.current.select(k); setPanel(k); };
  const closePanel = () => { sound("close"); ctlRef.current && ctlRef.current.select(null); setPanel(null); };
  // Leaving: fade the layer and the city's score, then let go of it.
  const leave = (then) => {
    setLeaving(true);
    if (ctlRef.current) ctlRef.current.setMuted(true);
    setTimeout(() => { then && then(); onClose(); }, 650);
  };
  const begin = () => {
    if (totalOf(sel) > MAX_PIECES) return;
    sound("begin");
    leave(() => beginCityGame(sel, x, (s) => x.reopenCity && x.reopenCity(s)));
  };

  const vsAi = x.aiPlayer != null;
  const diff = x.aiDifficulty || "medium";
  const cycleOpponent = () => {
    sound("key");
    if (!vsAi) x.selectOpponent && x.selectOpponent("light");
    else if (diff === "easy") x.setAiDifficulty && x.setAiDifficulty("medium");
    else if (diff === "medium") x.setAiDifficulty && x.setAiDifficulty("hard");
    else { x.setAiDifficulty && x.setAiDifficulty("easy"); x.selectOpponent && x.selectOpponent(null); }
  };
  const total = totalOf(sel), tooMany = total > MAX_PIECES;
  const lawsOn = LAWS.filter(([k]) => sel.laws[k]).length;

  const ready = phase === "ready" && h("div", { key: "ready", style: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(5,4,10,0.7) 0%, rgba(5,4,10,0.1) 40%, rgba(5,4,10,0.85) 80%)" } },
    h("div", { style: { ...column, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, padding: "18px 22px 26px" } },
      h("span", { style: { fontFamily: ELITE, fontSize: 13, letterSpacing: "0.1em", color: AMBER } }, "CUSTOM RULES · NUEVA CIUDAD, 2091"),
      h("h1", { style: { margin: 0, fontFamily: SAIRA_X, fontWeight: 800, fontSize: "clamp(48px, 13vw, 72px)", lineHeight: 0.86, color: "#fff4fb", textShadow: TUBE(PINK) } }, "THE RULES", h("br"), "ARE MADE", h("br"), "DOWN THERE"),
      h("span", { style: { fontFamily: ELITE, fontSize: 14, lineHeight: 1.5, color: "#d9d2e6" } }, "Pieces, laws and the shape of the board are sold on the street. Headphones on."),
      h("button", { type: "button", "data-testid": "lluvia-descend", onClick: () => { ctlRef.current && ctlRef.current.start(); setPhase("flight"); },
        style: { height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", border: `2px solid ${PINK}`, borderRadius: 4, background: "rgba(255,61,187,0.12)", color: "#ffe2f4", cursor: "pointer", boxShadow: "0 0 26px rgba(255,61,187,0.45), inset 0 0 20px rgba(255,61,187,0.18)" } },
        h("span", { style: { fontFamily: SAIRA_X, fontWeight: 800, fontSize: 30, letterSpacing: "0.12em" } }, "DESCEND"), ICON.down),
      h("button", { type: "button", "data-testid": "lluvia-straight-to-board", onClick: () => leave(),
        style: { alignSelf: "center", padding: "10px 12px", background: "transparent", border: "none", color: "#b9b2c8", font: `600 15px ${SAIRA}`, letterSpacing: "0.06em", cursor: "pointer" } }, "Straight to the board ›")));

  const flight = phase === "flight" && h("div", { key: "flight", style: { position: "absolute", inset: 0 } },
    h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.9) 100%)" } }),
    caption && h("span", { "data-testid": "lluvia-caption", style: { ...column, bottom: 96, padding: "0 24px", textAlign: "center", fontFamily: ELITE, fontSize: 17, lineHeight: 1.4, color: "#f3ecff", textShadow: "0 2px 10px #000" } }, caption),
    h("button", { type: "button", "data-testid": "lluvia-skip", onClick: () => ctlRef.current && ctlRef.current.skip(),
      style: { position: "absolute", right: 16, bottom: 26, height: 44, padding: "0 16px", background: "rgba(5,4,10,0.5)", border: "1px solid rgba(185,178,200,0.45)", borderRadius: 3, color: "#d9d2e6", font: `600 14px ${SAIRA}`, letterSpacing: "0.1em", cursor: "pointer" } }, "SKIP ›"));

  const signButton = (k, label, summary, col, bg, text, sub) => h("button", {
    key: k, type: "button", "data-testid": `lluvia-open-${k}`, onClick: () => openPanel(k),
    style: { height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: bg, border: `1.5px solid ${col}`, borderRadius: 3, color: text, cursor: "pointer" },
  }, h("span", { style: { font: `700 15px ${SAIRA}`, letterSpacing: "0.1em" } }, label), h("span", { style: { font: "400 15px 'VT323', monospace", color: sub } }, summary));

  const city = phase === "city" && h("div", { key: "city", style: { position: "absolute", inset: 0, pointerEvents: "none" } },
    h("div", { style: { ...column, top: 0, pointerEvents: "auto", display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 44px", alignItems: "center", gap: 6, padding: "12px 12px 34px", background: "linear-gradient(180deg, rgba(5,4,10,0.9) 0%, rgba(5,4,10,0) 100%)" } },
      h("button", { type: "button", "aria-label": "Back to the board", "data-testid": "lluvia-city-back", onClick: () => leave(), style: { width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#b9b2c8", cursor: "pointer" } }, ICON.back),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
        h("span", { style: { fontFamily: ELITE, fontSize: 12, letterSpacing: "0.1em", color: AMBER } }, "NUEVA CIUDAD · 2091"),
        h("span", { style: { fontFamily: SAIRA_X, fontWeight: 700, fontSize: 20, letterSpacing: "0.06em", color: "#f3ecff" } }, "Tap a sign to set the rules")),
      h("button", { type: "button", "aria-label": muted ? "Sound off" : "Sound on", onClick: () => { const m = !muted; setMuted(m); ctlRef.current && ctlRef.current.setMuted(m); }, style: { width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#b9b2c8", cursor: "pointer" } }, muted ? ICON.mute : ICON.sound)),
    !panel && h("div", { style: { ...column, bottom: 0, pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "40px 14px 16px", background: "linear-gradient(180deg, rgba(5,4,10,0) 0%, rgba(5,4,10,0.92) 36%)" } },
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 } },
        signButton("matter", "MATTER", `${total} pieces`, "rgba(35,230,255,0.7)", "rgba(35,230,255,0.07)", "#c8f8ff", tooMany ? "#ff5a5a" : "#7fdcef"),
        signButton("laws", "LAWS", `${lawsOn} ${lawsOn === 1 ? "law" : "laws"}`, "rgba(255,61,187,0.7)", "rgba(255,61,187,0.07)", "#ffd0ef", "#ef8fcf"),
        signButton("topologies", "TOPOLOGIES", `${sel.cols}×${sel.rows}`, "rgba(255,179,71,0.7)", "rgba(255,179,71,0.07)", "#ffe2b0", "#d9a45e")),
      h("button", { type: "button", "data-testid": "lluvia-opponent", onClick: cycleOpponent, style: { height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", background: "rgba(5,4,10,0.6)", border: "1px solid rgba(185,178,200,0.35)", borderRadius: 3, color: "#d9d2e6", font: `600 14px ${SAIRA}`, letterSpacing: "0.1em", cursor: "pointer" } },
        h("span", { style: { color: "#8d86a0" } }, "OPPONENT"), h("span", null, vsAi ? `CPU · ${diff.toUpperCase()}` : "HUMAN · PASS AND PLAY")),
      h("button", { type: "button", "data-testid": "lluvia-begin", disabled: tooMany, onClick: begin, style: { height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", border: `2px solid ${AMBER}`, borderRadius: 4, background: "rgba(255,179,71,0.12)", color: AMBER, cursor: tooMany ? "not-allowed" : "pointer", opacity: tooMany ? 0.5 : 1, boxShadow: "0 0 22px rgba(255,179,71,0.35)" } },
        h("span", { style: { fontFamily: SAIRA_X, fontWeight: 800, fontSize: 26, letterSpacing: "0.12em" } }, tooMany ? "TOO MANY PIECES" : "BEGIN THE GAME"), ICON.arrow)),
    panel && h("div", { style: { position: "absolute", inset: 0, pointerEvents: "auto" }, onPointerDown: closePanel },
      h(Panel, { panel, sel, change, onClose: closePanel, sound })));

  return h("div", {
    "data-testid": "lluvia-overlay",
    "data-phase": phase,
    onPointerDown: wakeSound,
    style: { position: "fixed", inset: 0, zIndex: 2100, background: "#05040a", opacity: leaving ? 0 : 1, transition: "opacity 600ms ease", pointerEvents: leaving ? "none" : "auto", overflow: "hidden" },
  },
  h("canvas", { ref: canvasRef, "data-testid": "lluvia-overlay-city", style: { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" } }),
  h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0 1px, rgba(0,0,0,0) 1px 3px)" } }),
  ready, flight, city);
}
