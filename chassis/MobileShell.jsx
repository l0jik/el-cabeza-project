import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import VolumeFader from "./VolumeFader.jsx";
import NowPlaying from "./NowPlaying.jsx";
import { sideNamesOf } from "../themes/side-names.js";

/* The phone layout (a page opts in with ElCabeza3D's mobileShell prop;
   Nova does). On a phone-sized screen the desktop dock — the floating 3D
   piece, its pop-up panel, the ghosted corner icons — gives way to:

   - a menu button in the top right (the title sits in the top left once
     play starts, placed by the chassis),
   - one control bar along the bottom (down the right side when the
     phone is on its side) holding what the current moment needs: the
     setup choices and Begin Game, then whose turn it is, the points
     left and the turn's actions, then the result and New Game,
   - a menu sheet with everything else: rules, move log, views, full
     screen, sound, the points and move-cost read-outs, the page's own
     items (Nova's theme switch) and About.

   Everything here drives the chassis's own handlers (see the `ctl`
   object ElCabeza3D builds), so the phone plays exactly the same game.
   Colours and faces come from the theme, so Standard and Neon each look
   like themselves. The bar reports the room it takes (onInsets) and the
   camera frames the board in the space that's left. */

const TOP_ROOM = 60; // title + menu button row, portrait
const PLAY_BAR = 122; // the bar's fixed height in play (status + actions)
const SIDE_MAX = 340; // the side bar's width, landscape
// Below this height a wide screen (a phone on its side) puts the bar down
// the right edge; taller wide screens (a desktop that chose the bar) keep
// it at the bottom, floating as a centred panel.
export const SIDE_MAX_H = 520;
const WIDE = 700; // wider than this, the bottom bar floats

function readSafeArea(el) {
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  const n = (v) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return vp;
}

export default function MobileShell({ ctl }) {
  const { theme, COLORS } = ctl;
  const vp = useViewport();
  const landscape = vp.w > vp.h && vp.h <= SIDE_MAX_H;
  const wide = !landscape && vp.w > WIDE;
  const float = wide ? 16 : 0; // the floating bar's gap from the bottom edge
  const probeRef = useRef(null);
  const [safe, setSafe] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    setSafe(readSafeArea(probeRef.current));
  }, [vp.w, vp.h]);

  // The room the bars take, for the camera (see onShellInsets in the
  // chassis). Fixed per orientation, not measured from the bar, so the
  // board's framing doesn't jump as the bar's contents change; setup's
  // taller bar is handled by the chassis's own pre-game framing.
  const sideW = Math.min(SIDE_MAX, Math.round(vp.w * 0.44)) + safe.right;
  // While a theme's cinematic has the screen (Neon's Singularity) the
  // bars are away; once it has gone black (ctl.fullFrame) the camera gets
  // the whole screen.
  useEffect(() => {
    ctl.onInsets(
      ctl.fullFrame
        ? null
        : landscape
        ? { top: 50 + safe.top, right: sideW, bottom: 8 + safe.bottom, left: safe.left }
        : { top: TOP_ROOM + safe.top, right: 0, bottom: PLAY_BAR + float + safe.bottom, left: 0 }
    );
  }, [ctl.fullFrame, landscape, float, sideW, safe.top, safe.right, safe.bottom, safe.left]);

  // Page-wide hooks for theme CSS (Neon's rules flyout moves below the
  // top bar) and the bar's live height for the piece card and notes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("ec-shell");
    return () => {
      root.classList.remove("ec-shell", "ec-shell-landscape");
      root.style.removeProperty("--ec-shell-bottom");
      root.style.removeProperty("--ec-shell-top");
      root.style.removeProperty("--ec-shell-side");
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("ec-shell-landscape", landscape);
    root.style.setProperty("--ec-shell-top", `${(landscape ? 50 : TOP_ROOM) + safe.top}px`);
    root.style.setProperty("--ec-shell-side", landscape ? `${sideW}px` : "0px");
  }, [landscape, safe.top, sideW]);
  useEffect(() => {
    const el = ctl.barRef.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--ec-shell-bottom", landscape ? `${8 + safe.bottom}px` : `${el.offsetHeight + float}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [landscape, float, safe.bottom]);

  // Said on the page, so what floats over the bar (the now-playing chip)
  // can step out of the way of the open sheet.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("ec-shell-menu-open", menuOpen);
    return () => root.classList.remove("ec-shell-menu-open");
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  // A cinematic taking the screen (Neon's Singularity) closes the menu.
  useEffect(() => { if (ctl.hidden) setMenuOpen(false); }, [ctl.hidden]);

  const t = tokens(theme, COLORS);
  const hiddenStyle = ctl.hidden ? { opacity: 0, pointerEvents: "none" } : { opacity: 1 };

  const barStyle = landscape
    ? {
        right: 0, bottom: 0, width: sideW, boxSizing: "border-box",
        maxHeight: `calc(100vh - ${60 + safe.top}px)`,
        padding: `16px ${16 + safe.right}px ${14 + safe.bottom}px 16px`,
        borderLeft: `1px solid ${t.hair}`, borderTop: `1px solid ${t.hair}`, borderRadius: "22px 0 0 0",
        overflowY: "auto",
      }
    : wide
    ? {
        left: "50%", bottom: float + safe.bottom, width: "min(600px, calc(100vw - 32px))", transform: "translateX(-50%)",
        boxSizing: "border-box", padding: "14px 18px",
        minHeight: ctl.phase === "setup" ? undefined : PLAY_BAR,
        border: `1px solid ${t.hair}`, borderRadius: 22,
        maxHeight: "62vh", overflowY: "auto",
      }
    : {
        left: 0, right: 0, bottom: 0, boxSizing: "border-box",
        padding: `14px ${16 + safe.right}px ${14 + safe.bottom}px ${16 + safe.left}px`,
        minHeight: ctl.phase === "setup" ? undefined : PLAY_BAR + safe.bottom,
        borderTop: `1px solid ${t.hair}`, borderRadius: "22px 22px 0 0",
        maxHeight: "62vh", overflowY: "auto",
      };

  return (
    <>
      <style>{shellCss(t)}</style>
      <div
        ref={probeRef}
        aria-hidden="true"
        style={{
          position: "fixed", top: 0, left: 0, width: 0, height: 0, visibility: "hidden", pointerEvents: "none",
          paddingTop: "env(safe-area-inset-top, 0px)", paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)",
        }}
      />

      <button
        type="button"
        className="ec-shell-iconbtn"
        data-testid="shell-menu-button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => { ctl.cue("DockOpen"); setMenuOpen(true); }}
        style={{
          position: "fixed",
          top: `calc(${safe.top}px + 8px)`,
          right: `calc(${safe.right}px + 10px)`,
          zIndex: 32,
          transition: "opacity 400ms ease",
          ...hiddenStyle,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="14" y2="17" />
        </svg>
      </button>

      <div
        ref={ctl.barRef}
        data-testid="shell-bar"
        data-phase={ctl.phase}
        className="ec-shell-bar"
        style={{
          position: "fixed",
          zIndex: 30,
          background: t.surface,
          backdropFilter: "blur(18px) saturate(1.2)",
          WebkitBackdropFilter: "blur(18px) saturate(1.2)",
          boxShadow: t.barShadow,
          color: t.ink,
          transition: "opacity 400ms ease",
          ...barStyle,
          ...hiddenStyle,
        }}
      >
        {ctl.phase === "setup" ? <SetupPanel ctl={ctl} t={t} /> : <PlayPanel ctl={ctl} t={t} />}
      </div>

      <MenuSheet ctl={ctl} t={t} open={menuOpen} onClose={(silent) => { setMenuOpen(false); if (silent !== true) ctl.cue("DockClose"); }} landscape={landscape} safe={safe} />
    </>
  );
}

/* ---- tokens: every colour from the theme ------------------------------ */

function tokens(theme, C) {
  const neonish = !!C.accentDark; // a theme with glowing player accents
  return {
    ink: C.charcoal,
    muted: C.slate,
    hair: C.slateSoft,
    faint: C.slateFaint || C.slateSoft,
    raised: C.creamAlt,
    base: C.cream,
    surface: theme.modalSurface || C.cream,
    backdrop: theme.modalBackdrop || "rgba(0,0,0,0.45)",
    dark: C.bodyDark,
    light: C.bodyLight,
    names: sideNamesOf(theme), // what the theme calls its two sides
    accentDark: C.accentDark || null,
    accentLight: C.accentLight || null,
    glow: neonish ? `0 0 18px ${hexA(C.accentDark, 0.28)}` : "none",
    barShadow: neonish ? `0 -12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${hexA(C.accentDark, 0.06)}` : "0 -10px 36px rgba(40,28,12,0.14)",
    display: theme.titleFontFamily || "'Fraunces', serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    sans: "'IBM Plex Sans', system-ui, sans-serif",
  };
}

function hexA(hex, a) {
  if (!hex || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function shellCss(t) {
  return `
    .ec-shell-iconbtn {
      width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 14px; border: 1px solid ${t.hair}; background: ${t.surface}; color: ${t.ink};
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); cursor: pointer; padding: 0;
      -webkit-tap-highlight-color: transparent; box-shadow: ${t.glow};
    }
    .ec-shell-iconbtn:active { transform: scale(0.94); }
    .ec-shell-btn {
      height: 46px; min-width: 0; padding: 0 14px; border-radius: 12px; cursor: pointer;
      font: 600 12px/1 ${t.mono}; letter-spacing: 0.14em; text-transform: uppercase;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      -webkit-tap-highlight-color: transparent; transition: transform 120ms ease, opacity 200ms ease, background 200ms ease;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ec-shell-btn:active:not(:disabled) { transform: scale(0.97); }
    .ec-shell-btn:disabled { opacity: 0.4; cursor: default; }
    .ec-shell-btn:focus-visible, .ec-shell-iconbtn:focus-visible, .ec-shell-seg button:focus-visible, .ec-shell-row:focus-visible {
      outline: 2px solid ${t.accentDark || t.ink}; outline-offset: 2px;
    }
    .ec-shell-primary { background: ${t.ink}; color: ${t.base}; border: 1px solid ${t.ink}; box-shadow: ${t.glow}; }
    .ec-shell-ghost { background: transparent; color: ${t.ink}; border: 1px solid ${t.hair}; }
    .ec-shell-seg { display: flex; flex: 1; min-width: 0; padding: 3px; gap: 3px; border-radius: 12px; background: ${t.faint}; border: 1px solid ${t.hair}; }
    .ec-shell-seg button {
      flex: 1; min-width: 0; height: 36px; border: none; border-radius: 9px; background: transparent; color: ${t.muted};
      font: 600 11.5px/1 ${t.mono}; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 6px;
      -webkit-tap-highlight-color: transparent; transition: background 180ms ease, color 180ms ease;
      white-space: nowrap; overflow: hidden;
    }
    .ec-shell-seg button[aria-pressed="true"] { background: ${t.ink}; color: ${t.base}; box-shadow: ${t.glow}; }
    .ec-shell-seg button[data-side="dark"][aria-pressed="true"] {
      background: ${t.dark}; color: ${t.light};
      box-shadow: ${t.accentDark ? `0 0 0 1px ${t.accentDark}, 0 0 16px ${hexA(t.accentDark, 0.45)}` : "none"};
    }
    .ec-shell-seg button[data-side="light"][aria-pressed="true"] {
      background: ${t.light}; color: ${t.dark};
      box-shadow: ${t.accentLight ? `0 0 0 1px ${t.accentLight}, 0 0 16px ${hexA(t.accentLight, 0.45)}` : `0 0 0 1px ${t.ink}`};
    }
    .ec-shell-seg button:disabled { opacity: 0.45; cursor: default; }
    .ec-shell-label { font: 600 10px/1 ${t.mono}; letter-spacing: 0.16em; text-transform: uppercase; color: ${t.muted}; }
    .ec-shell-row {
      width: 100%; min-height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 16px; box-sizing: border-box;
      background: transparent; border: none; color: ${t.ink}; font: 500 15px/1.25 ${t.sans}; text-align: left; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .ec-shell-row:active:not(:disabled) { background: ${t.faint}; }
    .ec-shell-row:disabled { opacity: 0.4; cursor: default; }
    .ec-shell-group { border-radius: 16px; background: ${t.faint}; border: 1px solid ${t.hair}; overflow: hidden; }
    .ec-shell-group > * + * { border-top: 1px solid ${t.hair}; }
    html.ec-shell [data-testid="variants-flyout"] { top: calc(var(--ec-shell-top, 60px) + 4px) !important; left: 12px !important; }
    @keyframes ec-shell-sheet-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes ec-shell-side-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes ec-shell-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ec-shell-points { 0% { transform: scale(1.35); filter: brightness(1.8); } 100% { transform: scale(1); filter: none; } }
    @media (prefers-reduced-motion: reduce) {
      .ec-shell-sheet, .ec-shell-scrim { animation: none !important; }
      .ec-shell-btn, .ec-shell-seg button { transition: none; }
    }
  `;
}

/* ---- small parts ------------------------------------------------------- */

function Dot({ side, t, size = 12, haloRef }) {
  const accent = side === "dark" ? t.accentDark : t.accentLight;
  return (
    <span
      ref={haloRef}
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: "50%", boxSizing: "border-box",
        background: side === "dark" ? t.dark : t.light,
        border: `1.5px solid ${accent || "currentColor"}`,
        boxShadow: accent ? `0 0 calc(var(--ec-halo-intensity, 1) * 8px) ${accent}` : "none",
        transition: "box-shadow 1.2s ease",
      }}
    />
  );
}

function Seg({ options, value, onChange, disabled, testid, label }) {
  return (
    <div className="ec-shell-seg" role="group" aria-label={label} data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.value === null ? "none" : o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          data-value={o.value === null ? "none" : o.value}
          data-side={o.side}
          onClick={() => { if (value !== o.value) onChange(o.value); }}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <span className="ec-shell-label" style={{ width: 78, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

/* ---- setup ------------------------------------------------------------- */

function SetupPanel({ ctl, t }) {
  const locked = ctl.opponentLocked;
  const vsAi = ctl.aiPlayer !== null;
  // A side's button, once chosen, takes that side's own colour.
  const sideOpts = () => [
    { value: "dark", label: t.names.dark, side: "dark" },
    { value: "light", label: t.names.light, side: "light" },
  ];
  const secondary = ctl.setupActions.filter((a) => a.placement !== "below");
  const below = ctl.setupActions.filter((a) => a.placement === "below");
  // No game to set up here (a theme's say, setupExtras.noGame: Nova's
  // store after the story, the board gone from the table): its own
  // actions only.
  if (ctl.noGame) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="shell-setup">
        {ctl.setupActions.map((a) => (
          <button key={a.key} type="button" className="ec-shell-btn ec-shell-primary" data-testid={a.testid} title={a.title} onClick={a.onClick} style={{ width: "100%", height: 52, fontSize: 13 }}>
            {a.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="shell-setup">
      <Field label="First move">
        <Seg
          label="Which side moves first"
          testid="shell-first-move"
          options={sideOpts(true)}
          value={ctl.currentPlayer}
          disabled={locked}
          onChange={() => ctl.onToggleStart()}
        />
      </Field>
      <Field label="Opponent">
        <Seg
          label="Opponent"
          testid="shell-opponent"
          options={[{ value: false, label: "Two humans" }, { value: true, label: "AI" }]}
          value={vsAi}
          disabled={locked}
          onChange={(ai) => {
            ctl.cue("Select");
            ctl.onSelectOpponent(ai ? (ctl.currentPlayer === "dark" ? "light" : "dark") : null);
          }}
        />
      </Field>
      {vsAi && (
        <>
          <Field label="AI plays">
            <Seg
              label="Side the AI plays"
              testid="shell-ai-side"
              options={sideOpts(true)}
              value={ctl.aiPlayer}
              disabled={locked}
              onChange={(side) => { ctl.cue("Select"); ctl.onSelectOpponent(side); }}
            />
          </Field>
          <Field label="Level">
            <Seg
              label="AI level"
              testid="shell-ai-level"
              options={Object.entries(ctl.AI_DIFFICULTY).map(([key, cfg]) => ({ value: key, label: cfg.label }))}
              value={ctl.aiDifficulty}
              disabled={locked}
              onChange={(key) => { ctl.cue("Select"); ctl.onSetDifficulty(key); }}
            />
          </Field>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {secondary.map((a) => (
          <button
            key={a.key}
            type="button"
            className="ec-shell-btn ec-shell-ghost"
            data-testid={a.testid}
            title={a.title}
            onClick={a.onClick}
            style={{ flex: "0 1 38%" }}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="ec-shell-btn ec-shell-primary"
          data-testid="shell-begin"
          onClick={ctl.onBegin}
          style={{ flex: 1, height: 52, fontSize: 13 }}
        >
          {ctl.beginLabel || "Begin Game"}
        </button>
      </div>
      {below.map((a) => (
        <button
          key={a.key}
          type="button"
          className="ec-shell-btn ec-shell-ghost"
          data-testid={a.testid}
          title={a.title}
          onClick={a.onClick}
          style={{ width: "100%", height: 42, borderStyle: "dashed" }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/* ---- play and after ---------------------------------------------------- */

function PlayPanel({ ctl, t }) {
  const over = ctl.phase === "over";
  const side = over && ctl.winner ? ctl.winner : ctl.currentPlayer;
  const accent = side === "dark" ? t.accentDark : t.accentLight;
  const actions = [];
  if (over) {
    actions.push(
      <button key="log" type="button" className="ec-shell-btn ec-shell-ghost" data-testid="shell-movelog" onClick={ctl.onOpenMoveLog} style={{ flex: 1 }}>
        {(ctl.words && ctl.words.moveLog) || "Move Log"}
      </button>,
      <button key="new" type="button" className="ec-shell-btn ec-shell-primary" data-testid="shell-new-game" onClick={ctl.onNewGame} style={{ flex: 1.3 }}>
        {(ctl.words && ctl.words.newGame) || "New Game"}
      </button>
    );
  } else {
    if (ctl.canUndoMove) {
      actions.push(
        <button key="undo" type="button" className="ec-shell-btn ec-shell-ghost" data-testid="shell-undo-move" onClick={ctl.onUndoMove} style={{ flex: 1 }}>
          <UndoIcon /> Undo move
        </button>
      );
    }
    if (ctl.canStopHere) {
      actions.push(
        <button key="stop" type="button" className="ec-shell-btn ec-shell-primary" data-testid="shell-end-turn" onClick={ctl.onStopHere} style={{ flex: 1 }}>
          Stop here
        </button>
      );
    }
    if (ctl.canUndoTurn) {
      actions.push(
        <button
          key="undoturn"
          type="button"
          className="ec-shell-btn ec-shell-ghost"
          data-testid="shell-undo-turn"
          disabled={ctl.undoTurnBusy}
          onClick={ctl.onUndoTurn}
          style={{ flex: 1 }}
        >
          <UndoIcon /> Undo turn
        </button>
      );
    }
  }
  const info = !over && !actions.length ? ctl.pieceInfo : null;
  // On the AI's turn the status line already says it's thinking. With the
  // piece guide switched off, no tips either.
  const hint = over || ctl.aiThinking || ctl.aiTurn || ctl.showGuide === false
    ? null
    : ctl.selectedOwn
    ? "Tap a marked square to move"
    : "Tap one of your pieces";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="shell-play">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, minWidth: 0 }}>
        <Dot side={side} t={t} size={14} haloRef={ctl.turnHaloRef} />
        <span
          ref={ctl.turnLabelRef}
          data-testid="shell-status"
          style={{
            flex: 1, minWidth: 0, font: `600 12.5px/1.2 ${t.mono}`, letterSpacing: "0.12em", textTransform: "uppercase",
            color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            textShadow: accent && !over ? `0 0 10px ${hexA(accent, 0.35)}` : "none",
          }}
        >
          {ctl.statusText}
        </span>
        {ctl.points && (
          <span
            data-testid="shell-points"
            data-left={ctl.points.left}
            aria-label={`${ctl.points.left} of ${ctl.points.budget} action points left`}
            key={ctl.pointsPulse}
            style={{ display: "flex", gap: 8, flexShrink: 0, animation: ctl.pointsPulse ? "ec-shell-points 0.6s ease-out" : "none", ["--ec-ember"]: ctl.points.glow || accent || t.ink }}
          >
            {/* Embers, breathing, as the desktop's counter (ElCabeza3D.jsx):
               a point you have glows in this world's light, a spent one is
               a dark bead. */}
            <style>{`@keyframes ecShellEmber{0%,100%{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ec-ember) 55%,black),0 0 4px 1px var(--ec-ember),0 0 10px 2px color-mix(in srgb,var(--ec-ember) 40%,transparent)}50%{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ec-ember) 55%,black),0 0 7px 2px var(--ec-ember),0 0 18px 5px color-mix(in srgb,var(--ec-ember) 60%,transparent)}}
[data-testid="shell-points"] [data-filled="true"]{background:radial-gradient(circle at 38% 34%,color-mix(in srgb,var(--ec-ember) 45%,white) 0 16%,var(--ec-ember) 46%,color-mix(in srgb,var(--ec-ember) 72%,black) 100%);animation:ecShellEmber 2.6s ease-in-out infinite}
[data-testid="shell-points"] [data-filled="false"]{background:#2a221d;box-shadow:inset 0 1px 2px rgba(0,0,0,0.8),0 0 0 1.5px rgba(255,244,226,0.28)}
@media (prefers-reduced-motion: reduce){[data-testid="shell-points"] [data-filled="true"]{animation:none;box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ec-ember) 55%,black),0 0 5px 1px var(--ec-ember),0 0 12px 3px color-mix(in srgb,var(--ec-ember) 50%,transparent)}}`}</style>
            {Array.from({ length: ctl.points.budget }, (_, i) => {
              const on = i < ctl.points.left;
              return (
                <span
                  key={i}
                  data-filled={on ? "true" : "false"}
                  style={{ width: 12, height: 12, borderRadius: "50%", boxSizing: "border-box", display: "block", animationDelay: `${i * 0.25}s`, transition: "background 0.4s ease, box-shadow 0.4s ease" }}
                />
              );
            })}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 46 }}>
        {actions.length ? (
          actions
        ) : info ? (
          // The chosen piece: how it moves and what it costs (the desktop's
          // floating piece card). Tapping it opens its MOVES tile.
          <button
            type="button"
            data-testid="piece-card"
            data-piece={info.type}
            onClick={() => ctl.onOpenRules("moves", info.tile)}
            aria-label={`${info.name}: ${info.text} How it moves`}
            style={{
              flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, textAlign: "left",
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              color: t.ink, font: `400 13px/1.35 ${t.sans}`,
            }}
          >
            <span
              data-testid="piece-card-text"
              style={{ flex: 1, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              <strong style={{ font: `600 14px/1.3 ${t.display}`, marginRight: 6 }}>{info.name}</strong>
              {info.text}
            </span>
            <svg data-testid="piece-card-more" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <polyline points="9 5 16 12 9 19" />
            </svg>
          </button>
        ) : (
          <span style={{ flex: 1, font: `400 13.5px/1.3 ${t.sans}`, color: t.muted }} data-testid="shell-hint">{hint || ""}</span>
        )}
        {!over && (
          <button
            type="button"
            className="ec-shell-iconbtn"
            data-testid="shell-view-toggle"
            aria-label={ctl.viewMode === "top" ? "Player view" : "Top-down view"}
            title={ctl.viewMode === "top" ? "Player view" : "Top-down view"}
            onClick={() => (ctl.viewMode === "top" ? ctl.onPlayerView() : ctl.onTopDown())}
            style={{ flexShrink: 0, boxShadow: "none", background: "transparent" }}
          >
            {ctl.viewMode === "top" ? <PerspectiveIcon /> : <TopIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- menu sheet -------------------------------------------------------- */

function MenuSheet({ ctl, t, open, onClose, landscape, safe }) {
  const closeRef = useRef(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => {
    if (!open) { setConfirmEnd(false); return; }
    const id = setTimeout(() => closeRef.current && closeRef.current.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (!confirmEnd) return undefined;
    const id = setTimeout(() => setConfirmEnd(false), 3500);
    return () => clearTimeout(id);
  }, [confirmEnd]);
  if (!open) return null;

  const run = (fn) => () => { onClose(true); fn(); };
  const inGame = ctl.phase !== "setup";

  const sheetStyle = landscape
    ? {
        top: 0, right: 0, bottom: 0, width: `min(400px, 70vw)`, borderRadius: "22px 0 0 22px",
        padding: `${12 + safe.top}px ${12 + safe.right}px ${16 + safe.bottom}px 12px`,
        animation: "ec-shell-side-in 260ms cubic-bezier(0.2,0.8,0.2,1)",
      }
    : {
        left: "50%", bottom: 0, width: "min(560px, 100%)", transform: "translateX(-50%)", maxHeight: "86vh",
        borderRadius: "24px 24px 0 0", padding: `8px ${12 + safe.right}px ${16 + safe.bottom}px ${12 + safe.left}px`,
      };

  return (
    <div
      className="ec-shell-scrim"
      onClick={() => onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1040, background: t.backdrop, animation: "ec-shell-fade-in 200ms ease" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-testid="shell-menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", boxSizing: "border-box", overflowY: "auto", overscrollBehavior: "contain",
          background: t.surface, color: t.ink, border: `1px solid ${t.hair}`,
          backdropFilter: "blur(22px) saturate(1.2)", WebkitBackdropFilter: "blur(22px) saturate(1.2)",
          boxShadow: "0 -18px 60px rgba(0,0,0,0.35)",
          ...sheetStyle,
        }}
      >
        <div className="ec-shell-sheet" style={{ animation: landscape ? "none" : "ec-shell-sheet-in 260ms cubic-bezier(0.2,0.8,0.2,1)" }}>
          {!landscape && (
            <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: t.hair, margin: "2px auto 6px" }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 4px 14px 8px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `600 22px/1.1 ${t.display}`, color: t.ink, letterSpacing: "0.01em" }}>El Cabeza</div>
              <div style={{ font: `500 11px/1.4 ${t.mono}`, letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ctl.playersLine}
              </div>
            </div>
            <button ref={closeRef} type="button" className="ec-shell-iconbtn" aria-label="Close menu" data-testid="shell-menu-close" onClick={() => onClose()} style={{ boxShadow: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <Section label="Game" t={t}>
            <Row label="How to play" testid="shell-menu-rules" onClick={run(() => ctl.onOpenRules("quick"))} chevron t={t} />
            {!(ctl.rulesTabsHidden || []).includes("game") && <Row label="Rules in this game" testid="shell-menu-game-rules" onClick={run(() => ctl.onOpenRules("game"))} chevron t={t} />}
            <Row label="Move log" testid="shell-menu-movelog" disabled={!ctl.logCount} detail={ctl.logCount ? `${ctl.logCount} move${ctl.logCount === 1 ? "" : "s"}` : "No moves yet"} onClick={run(ctl.onOpenMoveLog)} chevron t={t} />
            {ctl.phase === "playing" && (
              <Row
                label={confirmEnd ? "Tap again to end the game" : (ctl.words && ctl.words.endGame) || "End game"}
                testid="shell-menu-end"
                danger={confirmEnd}
                disabled={ctl.endBusy}
                onClick={() => {
                  if (!confirmEnd) { setConfirmEnd(true); return; }
                  onClose(true);
                  ctl.onEndGame();
                }}
                t={t}
              />
            )}
            {ctl.phase === "over" && <Row label="New game" testid="shell-menu-new" onClick={run(ctl.onNewGame)} t={t} />}
            {ctl.canUndoAfter && <Row label="Take back the last turn" testid="shell-menu-undo-last" disabled={ctl.undoTurnBusy} onClick={run(ctl.onUndoTurn)} t={t} />}
            {ctl.canResetRules && <Row label="Reset to the standard rules" testid="shell-menu-reset-rules" onClick={run(ctl.onResetRules)} t={t} />}
          </Section>

          {(inGame || ctl.canFullscreen || ctl.onRoomView || ctl.onToggleFocus) && (
            <Section label="View" t={t}>
              {inGame && <Row label="Top-down view" testid="shell-menu-top" check={ctl.viewMode === "top"} onClick={run(ctl.onTopDown)} t={t} />}
              {inGame && <Row label="Player view" testid="shell-menu-player" check={ctl.viewMode === "player"} onClick={run(ctl.onPlayerView)} t={t} />}
              {ctl.onRoomView && <Row label="Room view" detail="The whole room, the roof off" testid="shell-menu-room" check={ctl.viewMode === "room"} onClick={run(ctl.onRoomView)} t={t} />}
              {ctl.onToggleFocus && <Toggle label="Focus" hint="The room dims away; just the board" testid="shell-menu-focus" on={!!ctl.focusMode} onChange={ctl.onToggleFocus} t={t} />}
              {ctl.canFullscreen && <Toggle label="Full screen" testid="shell-menu-fullscreen" on={ctl.isFullscreen} onChange={ctl.onToggleFullscreen} t={t} />}
            </Section>
          )}

          <Section label="Settings" t={t}>
            {/* Sound: volume faders standing up (user: always a slider,
               vertical; all the way down is off). One for a theme with a
               single sound, else All sounds and each channel beside it, the
               channels dimmed while All sounds is off. */}
            {/* Now playing (NowPlaying.jsx): above the faders, where there's music. */}
            {ctl.hasAudio && ctl.nowPlaying && (
              <div style={{ paddingTop: 6 }}>
                <NowPlaying source={ctl.nowPlaying} ink={t.ink} muted={t.muted} hair={t.hair} accent={t.ink} font={t.sans} testid="shell-now-playing" />
              </div>
            )}
            {ctl.hasAudio && (
              <div className="ec-shell-row" data-testid="shell-menu-mixer" style={{ cursor: "default", justifyContent: "center", alignItems: "flex-start", gap: 2, flexWrap: "wrap", paddingTop: 12, paddingBottom: 12 }}>
                <VolumeFader
                  label={ctl.soundChannels ? "All sounds" : "Volume"}
                  testid="shell-menu-sound"
                  level={ctl.masterLevel != null ? ctl.masterLevel : ctl.muted ? 0 : 1}
                  onLevel={(v) => (ctl.onMasterLevel ? ctl.onMasterLevel(v) : (v <= 0) !== !!ctl.muted && ctl.onToggleSound())}
                  accent={t.ink} color={t.ink} muted={t.muted} labelFont={t.sans} height={104}
                />
                {ctl.soundChannels && <span aria-hidden="true" style={{ alignSelf: "stretch", width: 1, margin: "4px 8px", background: t.hair }} />}
                {ctl.soundChannels && ctl.soundChannels.map((c) => (
                  <VolumeFader
                    key={c.key}
                    label={c.label}
                    hint={c.hint}
                    testid={`shell-menu-sound-${c.key}`}
                    level={c.level != null ? c.level : c.on ? 1 : 0}
                    onLevel={c.onLevel}
                    dim={ctl.muted}
                    accent={t.ink} color={t.ink} muted={t.muted} labelFont={t.sans} height={104}
                  />
                ))}
              </div>
            )}
            {/* A theme with a stereo (the den): its music panel. */}
            {ctl.music && <Row label="Choose music" detail={ctl.music.hint} testid="shell-menu-music" onClick={run(ctl.onOpenMusic)} chevron t={t} />}
            <Toggle label="Points left" hint="Dots for the turn's action points" testid="shell-menu-points" on={ctl.showPoints} onChange={ctl.onTogglePoints} t={t} />
            <Toggle label="Piece guide" hint="What the chosen piece does, and tips on what to tap" testid="shell-menu-guide" on={ctl.showGuide !== false} onChange={ctl.onToggleGuide} t={t} />
            {ctl.costsToggle && <Toggle label="Move costs on the board" testid="shell-menu-costs" on={ctl.showCosts} onChange={ctl.onToggleCosts} t={t} />}
          </Section>

          <Section label="More" t={t}>
            {ctl.pageItems.map((it) => (
              <Row key={it.key} label={it.label} detail={it.detail} testid={it.testid} onClick={run(it.onClick)} chevron t={t} />
            ))}
            <Row label="About El Cabeza" testid="shell-menu-about" onClick={run(() => ctl.onOpenRules("about"))} chevron t={t} />
          </Section>

          <div style={{ textAlign: "center", font: `500 10px/1 ${t.mono}`, letterSpacing: "0.14em", color: t.muted, opacity: 0.7, padding: "6px 0 2px" }}>
            v{ctl.version}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, t, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="ec-shell-label" style={{ padding: "0 8px 7px" }}>{label}</div>
      <div className="ec-shell-group">{items}</div>
    </div>
  );
}

function Row({ label, detail, onClick, chevron, check, danger, disabled, testid, t }) {
  return (
    <button type="button" className="ec-shell-row" data-testid={testid} onClick={onClick} disabled={disabled} style={danger ? { color: t.accentLight || "#B3261E" } : undefined}>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {detail && <span style={{ font: `500 12.5px/1.2 ${t.sans}`, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "55%" }}>{detail}</span>}
      {check && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Current">
          <polyline points="5 12.5 10 17 19 7" />
        </svg>
      )}
      {chevron && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 5 16 12 9 19" />
        </svg>
      )}
    </button>
  );
}

function Toggle({ label, hint, on, onChange, testid, t }) {
  return (
    <button type="button" className="ec-shell-row" role="switch" aria-checked={on} data-testid={testid} onClick={onChange}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {hint && <span style={{ display: "block", font: `400 12px/1.3 ${t.sans}`, color: t.muted, marginTop: 2 }}>{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: "relative", boxSizing: "border-box",
          background: on ? t.ink : "transparent", border: `1.5px solid ${on ? t.ink : t.hair}`,
          boxShadow: on ? t.glow : "none", transition: "background 180ms ease, border-color 180ms ease",
        }}
      >
        <span
          style={{
            position: "absolute", top: 2, left: on ? 20 : 2, width: 19, height: 19, borderRadius: "50%",
            background: on ? t.base : t.muted, transition: "left 180ms ease, background 180ms ease",
          }}
        />
      </span>
    </button>
  );
}

/* ---- icons ------------------------------------------------------------- */

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

// The board seen from above: a square grid.
function TopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <line x1="4" y1="12" x2="20" y2="12" /><line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

// The board seen from a player's seat: a grid in perspective.
function PerspectiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 6h10l4 13H3z" />
      <line x1="5" y1="12.5" x2="19" y2="12.5" /><line x1="12" y1="6" x2="12" y2="19" />
    </svg>
  );
}
