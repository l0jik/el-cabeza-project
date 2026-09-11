// Self-contained "switch theme" transition subsystem for the unified
// app. Nothing here touches engine/, chassis/, or themes/ — it only
// wraps whichever theme's <ElCabeza3D> is currently mounted, so it
// carries zero risk to the existing Standard/Neon builds.
//
// Gesture: hold-press on the masthead for HOLD_MS. While held, a
// progressively stronger "losing signal" degrade (screen warp,
// chromatic aberration, scanlines, static, and — once Neon is on
// screen — a physical shake) builds up, driven by an SVG
// feDisplacementMap filter. Releasing early eases it back out.
// Completing the hold pops a CONNECT/DISCONNECT confirmation word;
// confirming it plays a ~2s CRT power-on/off transition (a further,
// separate SVG filter chain: geometry warp, VHS noise, a brief
// "tape tear", RGB channel separation) while the actual theme swap
// happens underneath, hidden inside the transition.
import React, { useRef, useEffect, useCallback } from "react";

export const HOLD_MS = 4000;
export const RELEASE_EASE_MS = 450;
export const SETTLE_WARP_MS = 1400;
export const SETTLE_ABERRATION_MS = 500;
export const TAP_MAX_MS = 650;
export const DRAG_CANCEL_PX = 18;

const MAX_WARP_SCALE = 110;
const MAX_ABERRATION_PX = 14;
const MAX_SCANLINE_OPACITY = 0.45;
const MAX_STATIC_OPACITY = 0.4;
const MAX_SHAKE_PX = 5;
const MAX_WARP_PULSE = 0.35;
const MAX_STROBE = 0.22;
const SHAKE_FREQ_MIN = 5;
const SHAKE_FREQ_MAX = 16;

const MAX_WARP_SCALE_CRT = 190;
const MAX_VHS_SCALE = 46;
const MAX_TEAR_SCALE = 85;
const MAX_RGB_SEP = 68;

export const TransitionStyles = () => (
  <style>{`
    .ec-hold-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ec-modal-fade-in 200ms ease-out;
    }
    @keyframes ec-modal-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .ec-hold-modal-word {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: clamp(30px, 7vw, 58px);
      letter-spacing: 0.14em;
      font-weight: 600;
      color: #eafcff;
      background: #0b0f14;
      border: 2px solid #4de8ff;
      padding: 30px 54px;
      cursor: pointer;
      box-shadow: 0 0 24px rgba(77, 232, 255, 0.5), 0 0 60px rgba(77, 232, 255, 0.2);
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .ec-hold-modal-word:hover {
      box-shadow: 0 0 34px rgba(77, 232, 255, 0.75), 0 0 80px rgba(77, 232, 255, 0.32);
    }
    .ec-hold-modal-word:active { transform: scale(0.97); }

    .ec-masthead-hold-zone {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
      cursor: pointer;
    }

    .ec-crt-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: auto;
      overflow: hidden;
      background: transparent;
    }
    .ec-crt-mask-top, .ec-crt-mask-bottom {
      position: absolute;
      left: 0;
      right: 0;
      height: 50%;
      background: #000;
    }
    .ec-crt-mask-top { top: 0; transform-origin: top; }
    .ec-crt-mask-bottom { bottom: 0; transform-origin: bottom; }

    .ec-crt-beam {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, #ffffff 0%, #bdf6ff 35%, rgba(77,232,255,0.4) 55%, transparent 72%);
      transform-origin: center;
      mix-blend-mode: screen;
    }
    .ec-crt-flash {
      position: absolute;
      inset: 0;
      background: #eafcff;
      opacity: 0;
    }
    .ec-crt-afterglow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(234,252,255,0.95) 0%, rgba(77,232,255,0.4) 22%, transparent 55%);
      opacity: 0;
    }

    @keyframes ec-crt-in-mask {
      0%, 19% { transform: scaleY(1); }
      47.5%, 100% { transform: scaleY(0); }
    }
    @keyframes ec-crt-in-beam {
      0%, 6%   { transform: scale(0.0008, 0.0008); opacity: 1; }
      19%      { transform: scale(1, 0.0016); opacity: 1; }
      47.5%    { transform: scale(1, 1); opacity: 0.85; }
      62.5%, 100% { transform: scale(1, 1); opacity: 0; }
    }
    @keyframes ec-crt-in-flash {
      0%, 44% { opacity: 0; }
      47.5%   { opacity: 0.9; }
      62.5%, 100% { opacity: 0; }
    }
    @keyframes ec-crt-content-in-scale {
      0%   { transform: scale(1.05); border-radius: 0%; }
      20%  { transform: scale(1.04); border-radius: 3%; }
      45%  { transform: scale(1.02); border-radius: 12%; }
      65%  { transform: scale(0.995); border-radius: 24%; }
      82%  { transform: scale(0.97); border-radius: 34%; }
      90%  { transform: scale(0.97); border-radius: 34%; }
      100% { transform: scale(1); border-radius: 0%; }
    }
    .ec-crt-in .ec-crt-mask-top, .ec-crt-in .ec-crt-mask-bottom {
      animation: ec-crt-in-mask 2000ms cubic-bezier(0.65, 0, 0.35, 1) 1 both;
    }
    .ec-crt-in .ec-crt-beam { animation: ec-crt-in-beam 2000ms linear 1 both; }
    .ec-crt-in .ec-crt-flash { animation: ec-crt-in-flash 2000ms linear 1 both; }
    .ec-crt-content-in {
      animation: ec-crt-content-in-scale 2000ms cubic-bezier(0, 0.6, 0.3, 1) 1 both;
      transform-origin: center;
    }

    @keyframes ec-crt-out-mask {
      0%, 30% { transform: scaleY(0); }
      55%, 100% { transform: scaleY(1); }
    }
    @keyframes ec-crt-out-beam {
      0%, 30%  { transform: scale(1, 1); opacity: 0.6; }
      55%      { transform: scale(1, 0.0016); opacity: 1; }
      68%      { transform: scale(0.0008, 0.0008); opacity: 1; }
      100%     { transform: scale(0.0008, 0.0008); opacity: 0; }
    }
    @keyframes ec-crt-out-afterglow {
      0%, 65%  { opacity: 0; }
      68%      { opacity: 1; }
      100%     { opacity: 0; }
    }
    @keyframes ec-crt-content-out-scale {
      0%   { transform: scale(1); border-radius: 0%; }
      20%  { transform: scale(0.996); border-radius: 3%; }
      45%  { transform: scale(0.975); border-radius: 12%; }
      65%  { transform: scale(0.94); border-radius: 24%; }
      82%  { transform: scale(0.905); border-radius: 34%; }
      90%  { transform: scale(0.905); border-radius: 34%; }
      100% { transform: scale(1); border-radius: 0%; }
    }
    .ec-crt-vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.6) 100%);
      border-radius: 6%;
      mix-blend-mode: multiply;
    }
    .ec-crt-vhs-band {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      opacity: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 15%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.5) 85%, transparent 100%);
      mix-blend-mode: overlay;
      pointer-events: none;
    }
    .ec-crt-out .ec-crt-mask-top, .ec-crt-out .ec-crt-mask-bottom {
      animation: ec-crt-out-mask 1900ms cubic-bezier(0.65, 0, 0.35, 1) 1 both;
    }
    .ec-crt-out .ec-crt-beam { animation: ec-crt-out-beam 1900ms linear 1 both; }
    .ec-crt-out .ec-crt-afterglow { animation: ec-crt-out-afterglow 1900ms linear 1 both; }
    .ec-crt-content-out {
      animation: ec-crt-content-out-scale 1900ms cubic-bezier(0.4, 0, 1, 1) 1 both;
      transform-origin: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .ec-crt-in .ec-crt-mask-top, .ec-crt-in .ec-crt-mask-bottom,
      .ec-crt-in .ec-crt-beam, .ec-crt-in .ec-crt-flash,
      .ec-crt-out .ec-crt-mask-top, .ec-crt-out .ec-crt-mask-bottom,
      .ec-crt-out .ec-crt-beam, .ec-crt-out .ec-crt-afterglow,
      .ec-crt-content-in, .ec-crt-content-out {
        animation-duration: 1ms !important;
      }
      .ec-hold-modal-backdrop { animation: none; }
    }
  `}</style>
);

// Holds a 4s timer that fires `onComplete`; `start`/`cancel` are
// stable across renders so callers can freely re-arm on every
// pointerdown without effect-dependency churn.
function useHoldTrigger(ms, onComplete) {
  const timerRef = useRef(null);
  const start = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onComplete, ms);
  }, [ms, onComplete]);
  const cancel = useCallback(() => clearTimeout(timerRef.current), []);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { start, cancel };
}

// An invisible hit-zone sized/positioned over the masthead title that
// both themes render near the top-center of the card. Tracks
// press-and-hold vs. a quick tap: a tap forwards a synthetic click to
// whatever element is actually underneath it (so the title's own
// click behavior, e.g. Neon's letter-phosphor effect, still works),
// while a hold past HOLD_MS fires onHoldComplete instead.
export function MastheadHoldZone({ zoneRef, onBegin, onEnd, onHoldComplete, onTap }) {
  const activeRef = useRef(false);
  const completedRef = useRef(false);
  const startedAtRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const { start: startHold, cancel: cancelHold } = useHoldTrigger(HOLD_MS, () => {
    completedRef.current = true;
    activeRef.current = false;
    onHoldComplete();
  });

  const begin = (ev) => {
    if (activeRef.current) return;
    activeRef.current = true;
    completedRef.current = false;
    startedAtRef.current = performance.now();
    const touch = ev && ev.touches && ev.touches[0];
    startXRef.current = touch ? touch.clientX : ev ? ev.clientX : 0;
    startYRef.current = touch ? touch.clientY : ev ? ev.clientY : 0;
    onBegin();
    startHold();
  };

  const end = (ev, allowTap) => {
    if (ev && ev.preventDefault && ev.type && ev.type.indexOf("touch") === 0) ev.preventDefault();
    if (!activeRef.current) return;
    activeRef.current = false;
    onEnd();
    cancelHold();
    if (!allowTap) return;
    const elapsed = performance.now() - startedAtRef.current;
    if (completedRef.current || elapsed >= TAP_MAX_MS) return;
    const touch = ev && ev.changedTouches && ev.changedTouches[0];
    const x = touch ? touch.clientX : ev ? ev.clientX : startXRef.current;
    const y = touch ? touch.clientY : ev ? ev.clientY : startYRef.current;
    if (x == null || y == null) return;
    onTap(x, y);
  };

  const move = (ev) => {
    if (!activeRef.current) return;
    const touch = ev && ev.touches && ev.touches[0];
    const x = touch ? touch.clientX : ev ? ev.clientX : startXRef.current;
    const y = touch ? touch.clientY : ev ? ev.clientY : startYRef.current;
    if (Math.abs(x - startXRef.current) > DRAG_CANCEL_PX || Math.abs(y - startYRef.current) > DRAG_CANCEL_PX) {
      end(ev, false);
    }
  };

  return (
    <div
      ref={zoneRef}
      className="ec-masthead-hold-zone"
      onMouseEnter={begin}
      onMouseLeave={(ev) => end(ev, false)}
      onMouseDown={begin}
      onMouseUp={(ev) => end(ev, true)}
      onTouchStart={begin}
      onTouchEnd={(ev) => end(ev, true)}
      onTouchCancel={(ev) => end(ev, false)}
      onTouchMove={move}
      onContextMenu={(ev) => ev.preventDefault()}
      style={{
        position: "absolute",
        top: 6,
        left: "50%",
        transform: "translateX(-50%)",
        width: 300,
        height: 78,
        zIndex: 40,
      }}
    />
  );
}

// Defines the SVG feDisplacementMap filter used for the hold-gesture
// "losing signal" degrade, plus the scanline/static overlay divs whose
// opacity ramps with hold intensity. Mounted once, permanently — its
// refs are driven imperatively (no re-render per frame) by the hold
// state machine in UnifiedApp.
export function HoldDegradeLayer({ dispRef, offRRef, offBRef, scanlineRef, staticRef }) {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="ec-hold-lin-x" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="50%" stopColor="#808080" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="ec-hold-lin-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="50%" stopColor="#808080" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <radialGradient id="ec-hold-rad-mag" cx="50%" cy="50%" r="70.7%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="40%" stopColor="#292929" />
            <stop offset="70%" stopColor="#7d7d7d" />
            <stop offset="100%" stopColor="#ffffff" />
          </radialGradient>
          <rect id="ec-hold-lin-x-rect" x="0" y="0" width="100%" height="100%" fill="url(#ec-hold-lin-x)" />
          <rect id="ec-hold-lin-y-rect" x="0" y="0" width="100%" height="100%" fill="url(#ec-hold-lin-y)" />
          <rect id="ec-hold-rad-rect" x="0" y="0" width="100%" height="100%" fill="url(#ec-hold-rad-mag)" />
        </defs>
        <filter id="ec-hold-degrade" x="-20%" y="-20%" width="140%" height="140%">
          <feImage href="#ec-hold-lin-x-rect" xlinkHref="#ec-hold-lin-x-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="xDirRaw" />
          <feImage href="#ec-hold-lin-y-rect" xlinkHref="#ec-hold-lin-y-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="yDirRaw" />
          <feImage href="#ec-hold-rad-rect" xlinkHref="#ec-hold-rad-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="magRaw" />
          <feComposite in="xDirRaw" in2="magRaw" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="xFinal" />
          <feComposite in="yDirRaw" in2="magRaw" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="yFinal" />
          <feColorMatrix in="xFinal" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="xChan" />
          <feColorMatrix in="yFinal" type="matrix" values="0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="yChan" />
          <feComposite in="xChan" in2="yChan" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="ec-hold-dispmap" />
          <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="ec-hold-dispmap" xChannelSelector="R" yChannelSelector="G" scale="0" result="warped" />
          <feColorMatrix in="warped" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="chR" />
          <feColorMatrix in="warped" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="chG" />
          <feColorMatrix in="warped" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1" result="chB" />
          <feOffset ref={offRRef} in="chR" dx="0" dy="0" result="chRoff" />
          <feOffset ref={offBRef} in="chB" dx="0" dy="0" result="chBoff" />
          <feBlend in="chRoff" in2="chG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chBoff" mode="screen" />
        </filter>
        <filter id="ec-hold-static" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="ec-hold-noise" />
          <feColorMatrix in="ec-hold-noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0" />
        </filter>
      </svg>
      <div
        ref={scanlineRef}
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 9500, pointerEvents: "none", opacity: 0,
          mixBlendMode: "multiply",
          background: "repeating-linear-gradient(rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        ref={staticRef}
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 9501, pointerEvents: "none", opacity: 0,
          mixBlendMode: "screen", background: "#ffffff", filter: "url(#ec-hold-static)",
        }}
      />
    </>
  );
}

export function ConnectModal({ word, onConfirm, onDismiss }) {
  return (
    <div className="ec-hold-modal-backdrop" onClick={onDismiss}>
      <div
        className="ec-hold-modal-word"
        onClick={(ev) => {
          ev.stopPropagation();
          onConfirm();
        }}
      >
        {word}
      </div>
    </div>
  );
}

// Shapes the CRT power-on/off curve over normalized progress p in
// [0,1]: a slow warm-up, a fast sweep through the middle, a brief hold
// at full intensity, then a quick decay. Several effects (geometry
// warp, VHS noise, tape "tear", jitter) are derived from this one
// master curve with their own exponents so they don't all peak in
// lockstep.
function ecCrtCurve(p) {
  p = Math.max(0, Math.min(1, p));
  let master, holdPeak = false;
  if (p < 0.2) {
    const t = p / 0.2;
    master = 0.15 * t * t;
  } else if (p < 0.65) {
    const t = (p - 0.2) / 0.45;
    master = 0.15 + 0.7 * Math.pow(t, 2.4);
  } else if (p < 0.82) {
    const t = (p - 0.65) / 0.17;
    master = 0.85 + 0.15 * (1 - Math.pow(1 - t, 2));
  } else if (p < 0.9) {
    master = 1;
    holdPeak = true;
  } else {
    const t = (p - 0.9) / 0.1;
    master = Math.pow(Math.max(0, 1 - t), 1.5);
  }
  return {
    master,
    geo: master,
    rgbSep: Math.pow(master, 1.15),
    vhs: Math.pow(master, 0.9) * (0.3 + 0.7 * master),
    tear: holdPeak ? Math.pow(master, 2) : Math.pow(master, 5) * 0.35,
    jitter: master > 0.8 ? (master - 0.8) / 0.2 : 0,
  };
}

// The full-screen CRT power-on ("in": Standard -> Neon) / power-off
// ("out": Neon -> Standard) transition. Owns its own SVG filter chain
// (geometry warp -> VHS noise -> tear -> RGB channel separation),
// applied by the parent to the actual game content via `filterId`
// while this overlay's mask/beam/flash play on top.
export function CrtTransitionOverlay({ direction, filterId, onDone, sfx }) {
  const geoDispRef = useRef(null);
  const vhsTurbRef = useRef(null);
  const vhsDispRef = useRef(null);
  const tearTurbRef = useRef(null);
  const tearDispRef = useRef(null);
  const rgbRDispRef = useRef(null);
  const rgbBDispRef = useRef(null);
  const bandRefs = useRef([null, null, null]);
  const bandStateRef = useRef([{ top: 20, h: 3, op: 0 }, { top: 50, h: 2, op: 0 }, { top: 75, h: 4, op: 0 }]);
  const lastBucketRef = useRef(-1);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (sfx) direction === "in" ? sfx.powerOn() : sfx.powerOff();
    const totalMs = direction === "in" ? 2000 : 1900;
    startRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / totalMs);
      const c = ecCrtCurve(p);

      if (geoDispRef.current) geoDispRef.current.setAttribute("scale", String(c.geo * MAX_WARP_SCALE_CRT));

      const bucket = Math.floor(elapsed / 90);
      if (bucket !== lastBucketRef.current) {
        lastBucketRef.current = bucket;
        if (vhsTurbRef.current) vhsTurbRef.current.setAttribute("seed", String(2 + Math.floor(Math.random() * 900)));
        if (tearTurbRef.current) tearTurbRef.current.setAttribute("seed", String(2 + Math.floor(Math.random() * 900)));
        bandStateRef.current.forEach((b) => {
          b.top = Math.random() * 96;
          b.h = 1 + Math.random() * (c.vhs > 0.5 ? 10 : 4);
          b.op = Math.random() < 0.25 + 0.6 * c.vhs ? 0.15 + 0.5 * Math.random() : 0;
        });
      }
      if (vhsDispRef.current) vhsDispRef.current.setAttribute("scale", String(c.vhs * MAX_VHS_SCALE));
      if (tearDispRef.current) tearDispRef.current.setAttribute("scale", String(c.tear * MAX_TEAR_SCALE));

      const jitter = c.jitter * 18 * (Math.random() - 0.5);
      const sep = c.rgbSep * MAX_RGB_SEP;
      if (rgbRDispRef.current) rgbRDispRef.current.setAttribute("scale", String(sep + jitter));
      if (rgbBDispRef.current) rgbBDispRef.current.setAttribute("scale", String(-sep + jitter));

      bandRefs.current.forEach((el, idx) => {
        if (!el) return;
        const b = bandStateRef.current[idx];
        el.style.top = b.top + "%";
        el.style.height = b.h + "px";
        el.style.opacity = String(b.op * c.vhs);
      });

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const doneTimer = setTimeout(onDone, totalMs);
    return () => {
      clearTimeout(doneTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [direction, onDone, sfx]);

  return (
    <div className={`ec-crt-overlay ${direction === "in" ? "ec-crt-in" : "ec-crt-out"}`}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feImage href="#ec-hold-lin-x-rect" xlinkHref="#ec-hold-lin-x-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="cxXDirRaw" />
          <feImage href="#ec-hold-lin-y-rect" xlinkHref="#ec-hold-lin-y-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="cxYDirRaw" />
          <feImage href="#ec-hold-rad-rect" xlinkHref="#ec-hold-rad-rect" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="cxMagRaw" />
          <feComposite in="cxXDirRaw" in2="cxMagRaw" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="cxXFinal" />
          <feComposite in="cxYDirRaw" in2="cxMagRaw" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="cxYFinal" />
          <feColorMatrix in="cxXFinal" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="cxXChan" />
          <feColorMatrix in="cxYFinal" type="matrix" values="0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="cxYChan" />
          <feColorMatrix in="cxXFinal" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="cxXChanRGB" />
          <feComposite in="cxXChan" in2="cxYChan" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="cxGeoMap" />
          <feDisplacementMap ref={geoDispRef} in="SourceGraphic" in2="cxGeoMap" xChannelSelector="R" yChannelSelector="G" scale="0" result="cxWarped" />
          <feTurbulence ref={vhsTurbRef} type="fractalNoise" baseFrequency="0.004 0.4" numOctaves="2" seed="5" result="cxVhsNoise" />
          <feDisplacementMap ref={vhsDispRef} in="cxWarped" in2="cxVhsNoise" xChannelSelector="R" yChannelSelector="G" scale="0" result="cxVhsWarped" />
          <feTurbulence ref={tearTurbRef} type="fractalNoise" baseFrequency="0.0015 0.9" numOctaves="1" seed="11" result="cxTearNoise" />
          <feDisplacementMap ref={tearDispRef} in="cxVhsWarped" in2="cxTearNoise" xChannelSelector="R" yChannelSelector="G" scale="0" result="cxTorn" />
          <feColorMatrix in="cxTorn" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="cxChR" />
          <feColorMatrix in="cxTorn" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="cxChG" />
          <feColorMatrix in="cxTorn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1" result="cxChB" />
          <feDisplacementMap ref={rgbRDispRef} in="cxChR" in2="cxXChanRGB" xChannelSelector="R" yChannelSelector="G" scale="0" result="cxChROff" />
          <feDisplacementMap ref={rgbBDispRef} in="cxChB" in2="cxXChanRGB" xChannelSelector="R" yChannelSelector="G" scale="0" result="cxChBOff" />
          <feBlend in="cxChROff" in2="cxChG" mode="screen" result="cxRG" />
          <feBlend in="cxRG" in2="cxChBOff" mode="screen" />
        </filter>
      </svg>
      <div className="ec-crt-mask-top" />
      <div className="ec-crt-mask-bottom" />
      <div className="ec-crt-beam" />
      {direction === "in" ? <div className="ec-crt-flash" /> : <div className="ec-crt-afterglow" />}
      {direction === "out" ? <div className="ec-crt-vignette" /> : null}
      <div ref={(el) => (bandRefs.current[0] = el)} className="ec-crt-vhs-band" aria-hidden="true" />
      <div ref={(el) => (bandRefs.current[1] = el)} className="ec-crt-vhs-band" aria-hidden="true" />
      <div ref={(el) => (bandRefs.current[2] = el)} className="ec-crt-vhs-band" aria-hidden="true" />
    </div>
  );
}

export const HOLD_DEGRADE_TUNING = {
  MAX_WARP_SCALE, MAX_ABERRATION_PX, MAX_SCANLINE_OPACITY, MAX_STATIC_OPACITY,
  MAX_SHAKE_PX, MAX_WARP_PULSE, MAX_STROBE, SHAKE_FREQ_MIN, SHAKE_FREQ_MAX,
};

// A compact, from-scratch Web Audio sound set for the switcher gesture
// — a soft click, a low crackle on hold-complete, and a rising/falling
// sweep for power on/off. Deliberately simple (a handful of
// oscillators/noise bursts) rather than a port of anything: it's a
// self-contained nice-to-have, not the feature being restored, so it
// isn't worth the risk of reverse-engineering a much larger procedural
// synth from minified source.
export function createSwitcherSfx() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const noiseBurst = (c, start, duration, gainPeak) => {
    const len = Math.max(1, Math.floor(c.sampleRate * duration));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1800;
    filt.Q.value = 1.2;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filt).connect(gain).connect(c.destination);
    src.start(start);
    src.stop(start + duration + 0.02);
  };
  const tone = (c, start, duration, freqFrom, freqTo, gainPeak, type = "sine") => {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), start + duration);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  };
  return {
    click() {
      const c = getCtx();
      tone(c, c.currentTime, 0.05, 900, 500, 0.12, "square");
    },
    holdComplete() {
      const c = getCtx();
      noiseBurst(c, c.currentTime, 0.12, 0.18);
      tone(c, c.currentTime, 0.15, 220, 90, 0.15, "sine");
    },
    powerOn() {
      const c = getCtx();
      tone(c, c.currentTime, 0.5, 90, 1200, 0.14, "sawtooth");
      noiseBurst(c, c.currentTime + 0.35, 0.15, 0.12);
    },
    powerOff() {
      const c = getCtx();
      tone(c, c.currentTime, 0.4, 900, 60, 0.14, "sawtooth");
      noiseBurst(c, c.currentTime, 0.1, 0.14);
    },
  };
}
