/* El Cabeza · Theme Lab: the same game in ten design directions.

   Everything here is presentation. The chassis (chassis/ElCabeza3D.jsx)
   runs the game exactly as every other page does; each direction is an
   ordinary theme module made by themes/lab/factory.js from a spec in
   themes/lab/specs.js. Switching direction remounts the chassis with the
   new theme and hands it the game as it stood (chassis carry/carryRef):
   the same position, turn, points spent, history, log and opponent. No
   page reload, nothing reset. A switch asked for mid-animation (or while
   the AI is thinking) waits for the move to settle first.

   The lab's own controls: the direction picker (01-10), previous, next,
   random, full screen, hide the interface, sound on/off and volume,
   reset the presentation (view and interface, never the game), and back
   to the game. Keys: [ and ] step, 1-9 and 0 jump, L opens the lab, H
   hides the interface, M mutes. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import { LAB_SPECS } from "../themes/lab/specs.js";
import { makeLabTheme } from "../themes/lab/factory.js";
import { playLabVoice, setLabMuted, setLabVolume, labAudioState, onLabAudio, startLabAudio } from "../themes/lab/audio.js";

applyBootstrapBoardSize();
applyBootstrapLaws();

const THEMES = LAB_SPECS.map(makeLabTheme);
const byId = Object.fromEntries(THEMES.map((t) => [t.labId, t]));
const STORE_KEY = "el-cabeza:lab-theme";

function initialId() {
  try {
    const q = new URLSearchParams(window.location.search).get("theme") || window.location.hash.replace(/^#/, "");
    if (q && byId[q]) return q;
    const saved = window.localStorage.getItem(STORE_KEY);
    if (saved && byId[saved]) return saved;
  } catch (e) { /* storage or URL unavailable */ }
  return THEMES[0].labId;
}

const LAB_CSS = `
  .lab-bar { position: fixed; z-index: 30; top: calc(10px + env(safe-area-inset-top)); left: calc(12px + env(safe-area-inset-left)); display: flex; gap: 6px; align-items: stretch;
    font-family: var(--font-body, system-ui); pointer-events: auto; }
  .lab-ctl { appearance: none; border: var(--border-width, 1px) solid var(--border-color, #000); background: var(--surface, #fff); color: var(--panel-ink, #000);
    border-radius: var(--radius, 0); box-shadow: var(--shadow, none); font: inherit; font-size: 12px; letter-spacing: var(--label-tracking, 0.04em);
    min-height: 36px; min-width: 36px; padding: 0 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; line-height: 1;
    transition: transform var(--transition-speed, 150ms) var(--ease, ease), background-color var(--transition-speed, 150ms); }
  .lab-ctl:hover { transform: translateY(-1px); }
  .lab-ctl:active { transform: translateY(1px); }
  .lab-ctl:focus-visible { outline: 2px solid var(--accent-primary, #e63946); outline-offset: 2px; }
  .lab-ctl[aria-pressed="true"] { background: var(--accent-primary, #000); color: var(--surface, #fff); border-color: var(--accent-primary, #000); }
  .lab-ctl .lab-num { font-weight: 800; color: var(--accent-primary); }
  .lab-ctl[aria-pressed="true"] .lab-num { color: inherit; }
  .lab-ctl .lab-nm { text-transform: uppercase; font-weight: 700; white-space: nowrap; }
  .lab-bar .lab-main { padding: 0 14px; }
  .lab-bar .lab-kicker { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.14em; }
  .lab-panel { position: fixed; z-index: 31; top: calc(54px + env(safe-area-inset-top)); left: calc(12px + env(safe-area-inset-left)); width: min(620px, calc(100vw - 24px));
    max-height: calc(100vh - 84px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow: auto; overscroll-behavior: contain;
    background: var(--surface, #fff); color: var(--panel-ink, #000); border: var(--border-width, 1px) solid var(--border-color, #000); border-radius: var(--radius, 0);
    box-shadow: var(--shadow, 0 10px 30px rgba(0,0,0,0.2)); padding: 16px; font-family: var(--font-body); }
  .lab-panel h2 { margin: 0 0 4px; font-family: var(--font-display); font-weight: var(--display-weight); letter-spacing: var(--tracking); font-size: 26px; line-height: 1; }
  .lab-panel .lab-tag { margin: 0 0 14px; font-size: 13px; line-height: 1.45; opacity: 0.8; max-width: 62ch; }
  .lab-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-bottom: 14px; }
  .lab-grid .lab-ctl { flex-direction: column; align-items: flex-start; justify-content: center; padding: 8px; min-height: 58px; gap: 4px; box-shadow: none; }
  .lab-grid .lab-ctl .lab-nm { font-size: 10.5px; white-space: normal; text-align: left; line-height: 1.15; }
  .lab-grid .lab-sw { display: flex; gap: 2px; }
  .lab-grid .lab-sw i { width: 10px; height: 10px; display: block; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.25); }
  .lab-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; align-items: center; }
  .lab-row .lab-ctl { box-shadow: none; }
  .lab-notes { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 12.5px; margin: 0; border-top: 1px solid currentColor; padding-top: 12px; }
  .lab-notes dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.6; padding-top: 2px; }
  .lab-notes dd { margin: 0; }
  .lab-notes .lab-pal { display: flex; flex-wrap: wrap; gap: 4px; }
  .lab-notes .lab-pal span { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 11px; }
  .lab-notes .lab-pal i { width: 14px; height: 14px; display: inline-block; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.3); }
  .lab-vol { width: 110px; accent-color: var(--accent-primary); }
  .lab-keys { font-size: 11px; opacity: 0.6; margin: 10px 0 0; }
  .lab-curtain { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
  .lab-curtain.in { animation: lab-cur-in 170ms ease-in both; }
  .lab-curtain.out { animation: lab-cur-out 300ms ease-out both; }
  @keyframes lab-cur-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lab-cur-out { from { opacity: 1; } to { opacity: 0; } }
  .lab-curtain[data-enter="wipe"].in { animation-name: lab-wipe-in; } .lab-curtain[data-enter="wipe"].out { animation-name: lab-wipe-out; }
  @keyframes lab-wipe-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
  @keyframes lab-wipe-out { from { clip-path: inset(0); } to { clip-path: inset(0 0 0 100%); } }
  .lab-curtain[data-enter="slice"].in { animation-name: lab-slice-in; } .lab-curtain[data-enter="slice"].out { animation-name: lab-slice-out; }
  @keyframes lab-slice-in { from { clip-path: polygon(0 0, 0 0, 0 0, 0 0); } to { clip-path: polygon(0 0, 200% 0, 0 200%, 0 0); } }
  @keyframes lab-slice-out { from { clip-path: polygon(100% 100%, -100% 100%, 100% -100%, 100% 100%); } to { clip-path: polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%); } }
  .lab-curtain[data-enter="slam"].in { animation: lab-slam-in 140ms steps(2, end) both; }
  @keyframes lab-slam-in { from { transform: translateY(-100%); } to { transform: none; } }
  .lab-curtain[data-enter="flap"].in { animation: lab-flap-in 200ms ease-in both; transform-origin: 50% 0; }
  @keyframes lab-flap-in { from { transform: perspective(900px) rotateX(-90deg); } to { transform: none; } }
  .lab-curtain[data-enter="pop"].in { animation-name: lab-pop-in; } .lab-curtain[data-enter="pop"].out { animation-name: lab-pop-out; }
  @keyframes lab-pop-in { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(75% at 50% 50%); } }
  @keyframes lab-pop-out { from { clip-path: circle(75% at 50% 50%); } to { clip-path: circle(0% at 50% 50%); } }
  .lab-curtain[data-enter="machine"].in { animation-name: lab-doors-in; } .lab-curtain[data-enter="machine"].out { animation-name: lab-doors-out; }
  @keyframes lab-doors-in { from { clip-path: inset(0 50% 0 50%); } to { clip-path: inset(0 0 0 0); } }
  @keyframes lab-doors-out { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(50% 0 50% 0); } }
  .lab-curtain[data-enter="bars"].in, .lab-curtain[data-enter="stack"].in { animation: lab-bars-in 240ms steps(4, end) both; }
  @keyframes lab-bars-in { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0); } }
  .lab-curtain .lab-cur-name { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; }
  .lab-curtain .lab-cur-name b { display: block; font-size: clamp(34px, 7vw, 76px); line-height: 0.95; }
  .lab-curtain .lab-cur-name small { display: block; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 10px; opacity: 0.7; }
  body.lab-ui-hidden .lab-hud, body.lab-ui-hidden [data-testid="dock-panel"], body.lab-ui-hidden [data-testid="how-to-play"], body.lab-ui-hidden button[aria-label$="full screen"],
  body.lab-ui-hidden [data-testid="points-counter"], body.lab-ui-hidden .ec-title, body.lab-ui-hidden [data-testid="piece-card"] { visibility: hidden !important; }
  body.lab-ui-hidden .lab-bar .lab-ctl:not(.lab-keep) { display: none; }
  @media (max-width: 600px) {
    .lab-bar .lab-nm, .lab-bar .lab-kicker { display: none; }
    .lab-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .lab-notes { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) { .lab-curtain, .lab-curtain * { animation-duration: 1ms !important; } .lab-ctl { transition: none; } }
`;

function useLabAudioState() {
  const [s, setS] = useState(labAudioState);
  useEffect(() => onLabAudio(() => setS(labAudioState())), []);
  return s;
}

function LabApp() {
  const [themeId, setThemeId] = useState(initialId);
  const [mount, setMount] = useState({ key: 0, carry: null });
  const [panelOpen, setPanelOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [curtain, setCurtain] = useState(null); // { id, phase: "in" | "out" }
  const carryRef = useRef(null);
  const switching = useRef(false);
  const panelRef = useRef(null);
  const openBtnRef = useRef(null);
  const audioState = useLabAudioState();
  const theme = byId[themeId];
  const spec = theme.labSpec;
  const index = THEMES.indexOf(theme);

  useEffect(() => {
    try { window.localStorage.setItem(STORE_KEY, themeId); } catch (e) { /* storage unavailable */ }
    try { const u = new URL(window.location.href); u.searchParams.set("theme", themeId); u.hash = ""; window.history.replaceState(null, "", u); } catch (e) { /* no history */ }
    document.title = `El Cabeza · Theme Lab · ${spec.num} ${spec.name}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", spec.colors.bgPrimary);
  }, [themeId]);

  useEffect(() => { document.body.classList.toggle("lab-ui-hidden", uiHidden); }, [uiHidden]);

  // For tests: the current direction and a way to switch without the UI.
  useEffect(() => {
    if (!window.__EC_TEST_HOOKS__) return;
    window.__LAB__ = { id: themeId, ids: THEMES.map((t) => t.labId), switchTo: (id) => switchTo(id), busy: () => switching.current, audio: () => labAudioState() };
  });

  /* Switch direction, carrying the game over. Waits (up to 4 s) for a
     step in flight or an AI turn in thought to settle, so the game is
     never caught half-way. */
  const switchTo = useCallback(async (id) => {
    if (!byId[id] || id === themeId || switching.current) return;
    switching.current = true;
    const next = byId[id].labSpec;
    startLabAudio();
    setCurtain({ id, phase: "in" });
    const t0 = Date.now();
    let snap = carryRef.current ? carryRef.current() : null;
    while (snap && snap.settling && Date.now() - t0 < 4000) {
      await new Promise((r) => setTimeout(r, 80));
      snap = carryRef.current ? carryRef.current() : null;
    }
    await new Promise((r) => setTimeout(r, 170));
    snap = carryRef.current ? carryRef.current() : snap;
    setThemeId(id);
    setMount((m) => ({ key: m.key + 1, carry: snap }));
    playLabVoice(next.audio, "theme");
    setTimeout(() => setCurtain({ id, phase: "out" }), 240);
    setTimeout(() => { setCurtain(null); switching.current = false; }, 560);
  }, [themeId]);

  const step = useCallback((d) => switchTo(THEMES[(index + d + THEMES.length) % THEMES.length].labId), [index, switchTo]);
  const random = useCallback(() => {
    const others = THEMES.filter((t) => t.labId !== themeId);
    switchTo(others[Math.floor(Math.random() * others.length)].labId);
  }, [themeId, switchTo]);

  // Reset the presentation (never the game): the interface back, full
  // screen off, and the view back to the board from above.
  const resetPresentation = useCallback(() => {
    setUiHidden(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const snap = carryRef.current ? carryRef.current() : null;
    if (snap && !snap.settling) setMount((m) => ({ key: m.key + 1, carry: { ...snap, cam: null } }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.reject()).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.key === "[") step(-1);
      else if (e.key === "]") step(1);
      else if (/^[0-9]$/.test(e.key)) { const n = e.key === "0" ? 9 : Number(e.key) - 1; if (THEMES[n]) switchTo(THEMES[n].labId); }
      else if (e.key === "l" || e.key === "L") setPanelOpen((o) => !o);
      else if (e.key === "h" || e.key === "H") setUiHidden((u) => !u);
      else if (e.key === "m" || e.key === "M") { startLabAudio(); setLabMuted(!labAudioState().muted); }
      else if (e.key === "Escape" && panelOpen) { setPanelOpen(false); openBtnRef.current && openBtnRef.current.focus(); }
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, switchTo, panelOpen]);

  // The panel closes on a press outside it (and its opener).
  useEffect(() => {
    if (!panelOpen) return undefined;
    const onDown = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (openBtnRef.current && openBtnRef.current.contains(e.target)) return;
      setPanelOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [panelOpen]);
  useEffect(() => { if (panelOpen && panelRef.current) { const b = panelRef.current.querySelector('[aria-pressed="true"]'); b && b.focus(); } }, [panelOpen]);

  const hover = () => playLabVoice(spec.audio, "hover");
  const curSpec = curtain ? byId[curtain.id].labSpec : null;
  const pal = useMemo(() => [
    ["bg", spec.colors.bgPrimary], ["surface", spec.colors.surface], ["ink", spec.colors.textPrimary],
    ["accent", spec.colors.accentPrimary], ["accent 2", spec.colors.accentSecondary], ["dark", spec.colors.pieceDark], ["light", spec.colors.pieceLight],
  ], [spec]);

  return (
    <>
      <style>{LAB_CSS}</style>
      <ElCabeza3D
        key={`${themeId}-${mount.key}`}
        theme={theme}
        carry={mount.carry}
        carryRef={carryRef}
        initialMuted={audioState.muted}
        onMutedChange={(m) => setLabMuted(m)}
      />
      <nav className="lab-bar" aria-label="Theme Lab" data-testid="lab-bar">
        <button
          ref={openBtnRef}
          type="button"
          className="lab-ctl lab-main lab-keep"
          aria-expanded={panelOpen}
          aria-controls="lab-panel"
          data-testid="lab-open"
          onClick={() => setPanelOpen((o) => !o)}
          onPointerEnter={hover}
          title="Theme Lab (L)"
        >
          <span className="lab-kicker">Lab</span>
          <span className="lab-num">{spec.num}</span>
          <span className="lab-nm">{spec.name}</span>
          <span aria-hidden="true">▾</span>
        </button>
        <button type="button" className="lab-ctl" aria-label="Previous direction" title="Previous ([)" data-testid="lab-prev" onClick={() => step(-1)} onPointerEnter={hover}>‹</button>
        <button type="button" className="lab-ctl" aria-label="Next direction" title="Next (])" data-testid="lab-next" onClick={() => step(1)} onPointerEnter={hover}>›</button>
      </nav>
      {panelOpen && (
        <div id="lab-panel" ref={panelRef} className="lab-panel" role="dialog" aria-label="Theme Lab" data-testid="lab-panel">
          <h2>{spec.num} {spec.name}</h2>
          <p className="lab-tag">{spec.tagline}</p>
          <div className="lab-grid" role="group" aria-label="Design directions">
            {THEMES.map((t) => {
              const s = t.labSpec;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="lab-ctl"
                  aria-pressed={s.id === themeId}
                  data-testid={`lab-theme-${s.id}`}
                  onClick={() => switchTo(s.id)}
                  onPointerEnter={hover}
                >
                  <span className="lab-num">{s.num}</span>
                  <span className="lab-nm">{s.short}</span>
                  <span className="lab-sw" aria-hidden="true">
                    {[s.colors.bgPrimary, s.colors.accentPrimary, s.colors.pieceDark, s.colors.pieceLight].map((col, i) => <i key={i} style={{ background: col }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="lab-row">
            <button type="button" className="lab-ctl" onClick={() => step(-1)} data-testid="lab-panel-prev">Previous</button>
            <button type="button" className="lab-ctl" onClick={() => step(1)} data-testid="lab-panel-next">Next</button>
            <button type="button" className="lab-ctl" onClick={random} data-testid="lab-random">Random</button>
            <button type="button" className="lab-ctl" onClick={toggleFullscreen} data-testid="lab-fullscreen">Full screen</button>
            <button type="button" className="lab-ctl" aria-pressed={uiHidden} onClick={() => setUiHidden((u) => !u)} data-testid="lab-toggle-ui">Hide interface</button>
          </div>
          <div className="lab-row">
            <button
              type="button"
              className="lab-ctl"
              aria-pressed={!audioState.muted}
              data-testid="lab-audio"
              onClick={() => { startLabAudio(); setLabMuted(!audioState.muted); }}
            >
              Sound {audioState.muted ? "off" : "on"}
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              Volume
              <input
                id="lab-volume"
                className="lab-vol"
                type="range"
                min="0"
                max="100"
                value={Math.round(audioState.volume * 100)}
                onChange={(e) => { startLabAudio(); setLabVolume(Number(e.target.value) / 100); }}
                onPointerUp={() => playLabVoice(spec.audio, "select")}
                data-testid="lab-volume"
              />
            </label>
            <button type="button" className="lab-ctl" onClick={resetPresentation} data-testid="lab-reset">Reset presentation</button>
            <button type="button" className="lab-ctl" onClick={() => { setPanelOpen(false); openBtnRef.current && openBtnRef.current.focus(); }} data-testid="lab-return">Return to game</button>
          </div>
          <dl className="lab-notes">
            <dt>Palette</dt>
            <dd className="lab-pal">{pal.map(([k, v]) => <span key={k}><i style={{ background: v }} />{k}</span>)}</dd>
            <dt>Type</dt>
            <dd style={{ fontFamily: spec.typography.display }}>{spec.typography.display.split(",")[0].replace(/'/g, "")} <span style={{ fontFamily: spec.typography.body, opacity: 0.75 }}>/ {spec.typography.body.split(",")[0].replace(/'/g, "")}</span></dd>
            <dt>Material</dt>
            <dd>{spec.materials}</dd>
            <dt>Sound</dt>
            <dd>{AUDIO_NOTES[spec.audio]}</dd>
          </dl>
          <p className="lab-keys">Keys: [ ] step · 1–0 jump · H hide interface · M sound · L this panel · Esc close. The game carries over every switch.</p>
        </div>
      )}
      {curtain && curSpec && (
        <div
          className={`lab-curtain ${curtain.phase}`}
          data-enter={curSpec.animation.enter}
          data-testid="lab-curtain"
          aria-hidden="true"
          style={{ background: curSpec.colors.bgPrimary, color: curSpec.colors.textPrimary, fontFamily: curSpec.typography.display }}
        >
          <div className="lab-cur-name">
            <b style={{ fontWeight: curSpec.typography.displayWeight, letterSpacing: curSpec.typography.tracking, color: curSpec.colors.textPrimary }}>
              <span style={{ color: curSpec.colors.accentPrimary }}>{curSpec.num}</span> {curSpec.name}
            </b>
            <small>{curSpec.materials.split(";")[0]}</small>
          </div>
        </div>
      )}
    </>
  );
}

const AUDIO_NOTES = {
  swiss: "Crisp square-wave clicks.",
  bauhaus: "Warm triangle-wave tones and chords.",
  destijl: "Short electronic pulse trains.",
  elementarism: "Directional pitch sweeps.",
  brutalist: "Distorted sawtooth, struck metal, heavy thuds.",
  newTypography: "Type-bar strikes, carriage return, a bell.",
  corporateSwiss: "Terminal beeps and split-flap flutter.",
  neoBrutalist: "Short synthetic pops.",
  minimalMono: "A few low transients, mostly silence.",
  ultimateFusion: "Analytic tones over an industrial thud.",
};

ReactDOM.createRoot(document.getElementById("root")).render(<LabApp />);
