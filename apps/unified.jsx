import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import * as standardTheme from "../themes/standard.js";
import * as neonTheme from "../themes/neon.js";
import {
  TransitionStyles,
  HoldDegradeLayer,
  MastheadHoldZone,
  ConnectModal,
  CrtTransitionOverlay,
  createSwitcherSfx,
  HOLD_MS,
  RELEASE_EASE_MS,
  SETTLE_WARP_MS,
  SETTLE_ABERRATION_MS,
  HOLD_DEGRADE_TUNING,
} from "./unifiedTransition.jsx";

const THEMES = { standard: standardTheme, neon: neonTheme };
const {
  MAX_WARP_SCALE, MAX_ABERRATION_PX, MAX_SCANLINE_OPACITY, MAX_STATIC_OPACITY,
  MAX_SHAKE_PX, MAX_WARP_PULSE, MAX_STROBE, SHAKE_FREQ_MIN, SHAKE_FREQ_MAX,
  MAX_BEND_SCALE, MAX_WOBBLE_DEG, WOBBLE_FREQ_HZ,
} = HOLD_DEGRADE_TUNING;

function UnifiedApp() {
  const [themeName, setThemeName] = useState("standard");
  const [connectWord, setConnectWord] = useState(null); // null | "CONNECT" | "DISCONNECT"
  const [transition, setTransition] = useState(null); // null | { direction: "in"|"out", filterId }
  // Lives here, above <ElCabeza3D key={themeName}> below, specifically
  // because that key remounts the whole chassis (a fresh audio engine,
  // fresh useState(false)) on every theme switch — anything the mute
  // toggle needs to survive that has to live outside it. Mirrored into
  // the theme-switcher's OWN separate audio engine too (sfxRef, created
  // just below) since that one runs entirely independently of
  // whichever theme is currently mounted and was previously immune to
  // this toggle altogether.
  const [muted, setMuted] = useState(false);

  const contentRef = useRef(null);
  const holdZoneRef = useRef(null);
  const dispRef = useRef(null);
  const offRRef = useRef(null);
  const offBRef = useRef(null);
  const scanlineRef = useRef(null);
  const staticRef = useRef(null);
  const bendDispRef = useRef(null);
  const rafRef = useRef(null);
  const sfxRef = useRef(null);
  if (!sfxRef.current) sfxRef.current = createSwitcherSfx();

  const holdState = useRef({
    phase: "idle", // idle | holding | releasing | settling
    startedAt: 0,
    intensity: 0,
    releaseFrom: 0,
    releaseStartedAt: 0,
    settleStartedAt: 0,
    settleWarpFrom: 0,
    settleAberrFrom: 0,
  });

  const stopRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const applyDegrade = useCallback((intensity, aberration, nowMs) => {
    const el = contentRef.current;
    const shakeOn = themeName === "neon";
    const freq = SHAKE_FREQ_MIN + (SHAKE_FREQ_MAX - SHAKE_FREQ_MIN) * intensity;
    const t = (nowMs || 0) / 1000;
    const sx = shakeOn ? intensity * MAX_SHAKE_PX * Math.sin(t * freq * 2 * Math.PI) : 0;
    const sy = shakeOn ? intensity * MAX_SHAKE_PX * 0.6 * Math.sin(t * freq * 2 * Math.PI * 1.37 + 1.7) : 0;
    const pulse = shakeOn ? 1 + MAX_WARP_PULSE * intensity * Math.sin(t * freq * 2 * Math.PI * 0.8 + 0.6) : 1;
    const strobe = shakeOn ? 1 + MAX_STROBE * intensity * Math.sin(t * freq * 2 * Math.PI * 1.9) : 1;
    // Large, slow bending/wobbling — old CRT screens physically
    // flexing, not just losing clean signal — layered on top of the
    // existing warp/aberration. Ramps in disproportionately faster
    // than intensity itself late in the hold (the ^1.4 curve), so it
    // reads as "the longer you hold, the worse this gets" rather than
    // a flat scale-up. Directional, like the shake above: holding from
    // Standard (heading into Neon, CONNECT) stays comparatively mild —
    // still just the original aberration/static/scanline degrade with
    // a touch of bend — while holding from Neon (heading back to
    // Standard, DISCONNECT) gets the full effect alongside the shake,
    // so the two directions read as genuinely different events rather
    // than the same animation with a different word at the end.
    const bendMultiplier = themeName === "neon" ? 1 : 0.4;
    const bendCurve = Math.pow(intensity, 1.4) * bendMultiplier;
    const wobbleDeg = bendCurve * MAX_WOBBLE_DEG * Math.sin(t * WOBBLE_FREQ_HZ * 2 * Math.PI);
    const wobbleSkew = bendCurve * MAX_WOBBLE_DEG * 0.7 * Math.sin(t * WOBBLE_FREQ_HZ * 2 * Math.PI * 0.63 + 1.1);
    if (el) {
      el.style.filter = intensity > 0.001 ? `url(#ec-hold-degrade) url(#ec-hold-bend) brightness(${strobe})` : "";
      el.style.transform = intensity > 0.001
        ? `translate(${sx}px, ${sy}px) rotate(${wobbleDeg.toFixed(2)}deg) skewX(${wobbleSkew.toFixed(2)}deg)`
        : "";
    }
    if (dispRef.current) dispRef.current.setAttribute("scale", String(Math.max(0, intensity * MAX_WARP_SCALE * pulse)));
    if (bendDispRef.current) bendDispRef.current.setAttribute("scale", String(bendCurve * MAX_BEND_SCALE));
    if (offRRef.current) offRRef.current.setAttribute("dx", String(aberration * MAX_ABERRATION_PX));
    if (offBRef.current) offBRef.current.setAttribute("dx", String(-aberration * MAX_ABERRATION_PX));
    if (scanlineRef.current) scanlineRef.current.style.opacity = String(intensity * MAX_SCANLINE_OPACITY);
    if (staticRef.current) staticRef.current.style.opacity = String(intensity * MAX_STATIC_OPACITY);
  }, [themeName]);

  const tick = useCallback(() => {
    const s = holdState.current;
    const now = performance.now();
    if (s.phase === "holding") {
      const m = Math.min(1, (now - s.startedAt) / HOLD_MS);
      s.intensity = m;
      applyDegrade(m, m, now);
      sfxRef.current.updateJibber(m);
      if (m >= 1) { s.phase = "idle"; stopRaf(); return; }
    } else if (s.phase === "releasing") {
      const m = Math.min(1, (now - s.releaseStartedAt) / RELEASE_EASE_MS);
      const eased = 1 - Math.pow(1 - m, 2);
      const v = s.releaseFrom * (1 - eased);
      s.intensity = v;
      applyDegrade(v, v, now);
      if (m >= 1) { s.phase = "idle"; stopRaf(); return; }
    } else if (s.phase === "settling") {
      const mw = Math.min(1, (now - s.settleStartedAt) / SETTLE_WARP_MS);
      const ew = 1 - Math.pow(1 - mw, 2);
      const wv = s.settleWarpFrom * (1 - ew);
      const ma = Math.min(1, (now - s.settleStartedAt) / SETTLE_ABERRATION_MS);
      const ea = 1 - Math.pow(1 - ma, 2);
      const av = s.settleAberrFrom * (1 - ea);
      s.intensity = wv;
      applyDegrade(wv, av, now);
      if (mw >= 1 && ma >= 1) { s.phase = "idle"; stopRaf(); return; }
    } else {
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyDegrade, stopRaf]);

  const beginHold = useCallback(() => {
    stopRaf();
    holdState.current.phase = "holding";
    holdState.current.startedAt = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    sfxRef.current.startJibber();
  }, [stopRaf, tick]);

  const endHold = useCallback(() => {
    const s = holdState.current;
    if (s.phase !== "holding") return;
    stopRaf();
    s.phase = "releasing";
    s.releaseFrom = s.intensity;
    s.releaseStartedAt = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    sfxRef.current.stopJibber(false);
  }, [stopRaf, tick]);

  const onHoldComplete = useCallback(() => {
    stopRaf();
    const s = holdState.current;
    s.phase = "settling";
    s.settleStartedAt = performance.now();
    s.settleWarpFrom = s.intensity;
    s.settleAberrFrom = s.intensity;
    rafRef.current = requestAnimationFrame(tick);
    sfxRef.current.holdComplete();
    setConnectWord(themeName === "standard" ? "CONNECT" : "DISCONNECT");
  }, [stopRaf, tick, themeName]);

  const onMastheadTap = useCallback((x, y) => {
    const zone = holdZoneRef.current;
    if (!zone) return;
    const prevPointerEvents = zone.style.pointerEvents;
    zone.style.pointerEvents = "none";
    const under = document.elementFromPoint(x, y);
    zone.style.pointerEvents = prevPointerEvents;
    if (under) {
      under.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    }
  }, []);

  useEffect(() => stopRaf, [stopRaf]);

  /* The masthead the hold-zone needs to sit over isn't a fixed spot
     any more — the chassis fades it in place after Begin Game, then
     shrinks and relocates it to a small corner badge (see
     mastheadPhase in ElCabeza3D.jsx). Rather than duplicate that
     timing/state here, just track the real ".ec-title" element's live
     bounding rect every frame and keep the (otherwise invisible) hold
     zone glued to it, inflated a little for a comfortable hit area. */
  useEffect(() => {
    let raf;
    const sync = () => {
      const titleEl = document.querySelector(".ec-title");
      const zone = holdZoneRef.current;
      if (titleEl && zone) {
        const r = titleEl.getBoundingClientRect();
        const pad = 16;
        zone.style.top = (r.top - pad) + "px";
        zone.style.left = (r.left - pad) + "px";
        zone.style.width = (r.width + pad * 2) + "px";
        zone.style.height = (r.height + pad * 2) + "px";
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!connectWord) return;
    const onKey = (ev) => { if (ev.key === "Escape") setConnectWord(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectWord]);

  const beginTransition = useCallback(() => {
    // Any leftover hold-degrade styling is superseded by the CRT
    // transition's own filter/animation from here on.
    if (contentRef.current) {
      contentRef.current.style.filter = "";
      contentRef.current.style.transform = "";
    }
    const direction = themeName === "standard" ? "in" : "out";
    const filterId = "ec-grav-warp-" + Date.now();
    setConnectWord(null);
    setTransition({ direction, filterId });
    // The theme swap itself happens mid-transition, hidden by the
    // screen already being collapsed to a thin band/point at that
    // moment in the CSS animation timeline.
    setTimeout(() => setThemeName(direction === "in" ? "neon" : "standard"), direction === "in" ? 380 : 1292);
  }, [themeName]);

  const onTransitionDone = useCallback(() => setTransition(null), []);

  const contentStyle = transition
    ? { filter: `url(#${transition.filterId})`, pointerEvents: "none", overflow: "hidden" }
    : undefined;
  const contentClass = transition ? (transition.direction === "in" ? "ec-crt-content-in" : "ec-crt-content-out") : "";

  return (
    <>
      <TransitionStyles />
      <HoldDegradeLayer dispRef={dispRef} offRRef={offRRef} offBRef={offBRef} scanlineRef={scanlineRef} staticRef={staticRef} bendDispRef={bendDispRef} />
      <div style={{ position: "relative" }}>
        <div ref={contentRef} className={contentClass} style={contentStyle}>
          <ElCabeza3D
            key={themeName}
            theme={THEMES[themeName]}
            initialMuted={muted}
            onMutedChange={(m) => {
              setMuted(m);
              sfxRef.current.setMuted(m);
            }}
          />
        </div>
        <MastheadHoldZone
          zoneRef={holdZoneRef}
          onBegin={beginHold}
          onEnd={endHold}
          onHoldComplete={onHoldComplete}
          onTap={onMastheadTap}
        />
      </div>
      {connectWord && (
        <ConnectModal word={connectWord} onConfirm={beginTransition} onDismiss={() => setConnectWord(null)} sfx={sfxRef.current} />
      )}
      {transition && (
        <CrtTransitionOverlay direction={transition.direction} filterId={transition.filterId} onDone={onTransitionDone} sfx={sfxRef.current} />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<UnifiedApp />);
