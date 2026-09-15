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
// A second, much larger-scale, low-frequency warp layered on top of
// the "losing signal" static-noise degrade above — old CRTs bending
// and wobbling under real magnetic/structural strain, not just losing
// clean signal. Unconditional (unlike the shake, which is Neon-only):
// this accompanies the existing chromatic aberration regardless of
// which theme is currently on screen.
// Chains onto the existing degrade filter (each displacement map warps
// the ALREADY-warped output of the previous one, compounding rather
// than adding) — kept well under MAX_WARP_SCALE for that reason. An
// early pass at 240/7deg, chained on top of the existing filter,
// dissolved the whole scene into unrecognizable noise well before the
// hold even finished; this reads as bending, not disintegration.
const MAX_BEND_SCALE = 55;
const MAX_WOBBLE_DEG = 2.5;
const WOBBLE_FREQ_HZ = 0.55;

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
    /* Wraps the real (clickable) word and its two phosphor-ghost
       duplicates so all three share one animation phase-space and one
       centered position — see .ec-modal-ghost-layer below. Sized by
       its own content, not the viewport, so the ghosts (position:
       absolute, inset:0) always exactly overlay the real word
       regardless of how long CONNECT vs DISCONNECT ends up being. */
    .ec-hold-modal-word-wrap {
      position: relative;
      display: inline-block;
      /* Hard ceiling on the whole control's footprint — CONNECT/
         DISCONNECT's font-size below is already viewport-responsive,
         but this is the actual safety net: whatever the computed
         font-size turns out to be in an unusual host viewport, the
         word can wrap onto a second line here rather than ever
         spilling past the screen edge. */
      max-width: min(90vw, 460px);
      box-sizing: border-box;
    }
    /* Shared by the real word AND both ghost layers below — they're
       SIBLINGS, not parent/child, so the CSS "inherit" keyword on the
       ghosts would pull font-size/padding/etc. from
       .ec-hold-modal-word-wrap (which sets none of these) rather than
       from this element; every ghost needs its own literal copy of
       these values to stay pixel-identical to the real word, which is
       what makes the "duplicate signal" illusion work at all. */
    .ec-modal-word-base {
      display: block;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      /* Floor and ceiling both pulled in from the original 30-58px —
         per feedback this read as too large on a real phone,
         especially DISCONNECT (3 characters longer than CONNECT) once
         the "breathing" pulse's peak scale was on top of it. */
      font-size: clamp(20px, 6vw, 40px);
      letter-spacing: 0.14em;
      font-weight: 600;
      line-height: 1.3;
      text-align: center;
      white-space: normal;
      word-break: break-word;
      /* Responsive too, not just the font-size — a fixed 54px side
         padding was itself a large fraction of a narrow phone's width
         regardless of the text inside it. */
      padding: clamp(16px, 4vw, 28px) clamp(20px, 5.5vw, 46px);
      box-sizing: border-box;
      max-width: 100%;
      border: 2px solid transparent;
    }
    .ec-hold-modal-word {
      color: #eafcff;
      background: #0b0f14;
      border-color: #4de8ff;
      cursor: pointer;
      box-shadow: 0 0 24px rgba(77, 232, 255, 0.5), 0 0 60px rgba(77, 232, 255, 0.2);
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      /* A slow, subtle breathing pulse — "almost alive" — paused
         on hover/active so the existing press/hover feedback below
         still reads cleanly instead of fighting the animation. Peak
         scale trimmed slightly (1.018 -> 1.012) alongside the size
         reduction above, for the same "too big on mobile" feedback. */
      animation: ec-hold-modal-alive 1.9s ease-in-out infinite;
      position: relative;
      z-index: 2;
    }
    @keyframes ec-hold-modal-alive {
      0%, 100% { transform: scale(1); box-shadow: 0 0 24px rgba(77, 232, 255, 0.5), 0 0 60px rgba(77, 232, 255, 0.2); }
      50%      { transform: scale(1.012); box-shadow: 0 0 30px rgba(77, 232, 255, 0.65), 0 0 74px rgba(77, 232, 255, 0.28); }
    }
    .ec-hold-modal-word:hover {
      animation-play-state: paused;
      box-shadow: 0 0 34px rgba(77, 232, 255, 0.75), 0 0 80px rgba(77, 232, 255, 0.32);
    }
    .ec-hold-modal-word:active { animation-play-state: paused; transform: scale(0.97); }

    /* CRT Phosphor Trails / Signal Ghosting: two duplicate copies of
       the same word, sitting exactly behind the real one (inset: 0
       inside .ec-hold-modal-word-wrap), each phase-shifted from the
       main word's own breathing pulse via a NEGATIVE animation-delay
       rather than a separate timeline — so the ghosts are always
       showing where the real word's glow/scale WAS a fraction of a
       cycle ago, the way slow-decay phosphor keeps glowing faintly
       after the electron beam has already moved on, or a weak signal
       shows a faint mis-timed duplicate of itself. mix-blend-mode:
       screen makes them ADD light rather than muddy the real text
       underneath, and pointer-events:none plus a lower z-index than
       the real word keep them purely decorative — the actual click
       target is unchanged. One layer tints toward cyan (this modal's
       own accent), the other toward the complementary phosphor green
       real P1-phosphor CRTs actually used, each blurred and offset in
       an opposite direction so the two visibly separate rather than
       just doubling up as one blob.

       Offset/blur/opacity and the ghosts' own pulse peak (well past
       the real word's 1.012) are all pushed considerably further than
       a "physically accurate" faint persistence would call for — per
       feedback the first pass ("not obvious at all... I see no change
       there") wasn't visible at a glance, and a trail that has to be
       studied to notice isn't doing its job as a piece of visible
       styling. This should read immediately, even in a single frame. */
    .ec-modal-ghost-layer {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      mix-blend-mode: screen;
      background: transparent;
    }
    /* Each ghost's own fixed offset has to be baked INTO its keyframes
       (not set as a separate static transform) — a running CSS
       animation replaces the whole transform value on every tick, so a
       static transform declared alongside an animation would just be
       silently discarded once the animation starts. Unlike the real
       word, these swing all the way up to a visibly larger scale at
       their own peak — the ghost should look like it's blooming
       outward past the real word's own edges, not just breathing in
       lockstep with it. */
    @keyframes ec-modal-ghost-a {
      0%, 100% { transform: translate(-9px, 3px) scale(1); }
      50%      { transform: translate(-9px, 3px) scale(1.14); }
    }
    @keyframes ec-modal-ghost-b {
      0%, 100% { transform: translate(9px, -4px) scale(1); }
      50%      { transform: translate(9px, -4px) scale(1.14); }
    }
    .ec-modal-ghost-layer--a {
      color: #4de8ff;
      opacity: 0.65;
      filter: blur(6px);
      animation: ec-modal-ghost-a 1.9s ease-in-out infinite;
      animation-delay: -0.4s;
    }
    .ec-modal-ghost-layer--b {
      color: #39ff8a;
      opacity: 0.5;
      filter: blur(8px);
      animation: ec-modal-ghost-b 1.9s ease-in-out infinite;
      animation-delay: -1.0s;
    }
    @media (prefers-reduced-motion: reduce) {
      .ec-modal-ghost-layer { display: none; }
    }

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
      .ec-hold-modal-word { animation: none; }
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
        // Fixed at 0/0/0/0 initially — the parent (UnifiedApp) drives
        // top/left/width/height imperatively every frame to track the
        // real masthead's live bounding rect (it fades in place, then
        // shrinks and relocates to a corner badge — a static offset
        // here would only ever match one of those states).
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
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
export function HoldDegradeLayer({ dispRef, offRRef, offBRef, scanlineRef, staticRef, bendDispRef }) {
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
        {/* Large, smooth, low-frequency warp — CRT bending/wobbling
           under real strain, layered via CSS `filter: url(#ec-hold-
           degrade) url(#ec-hold-bend)` (chained, not merged into the
           filter graph above) so the two effects can each scale
           independently with hold intensity. */}
        <filter id="ec-hold-bend" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="turbulence" baseFrequency="0.006 0.009" numOctaves="1" seed="7" result="ec-hold-bend-noise" />
          <feDisplacementMap ref={bendDispRef} in="SourceGraphic" in2="ec-hold-bend-noise" xChannelSelector="R" yChannelSelector="G" scale="0" />
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

export function ConnectModal({ word, onConfirm, onDismiss, sfx }) {
  return (
    <div className="ec-hold-modal-backdrop" onClick={onDismiss}>
      <div className="ec-hold-modal-word-wrap">
        {/* Phosphor-trail ghosts sit behind the real word (lower
           z-index, pointer-events:none) — purely decorative, see their
           own CSS comment above. */}
        <div className="ec-modal-word-base ec-modal-ghost-layer ec-modal-ghost-layer--a" aria-hidden="true">{word}</div>
        <div className="ec-modal-word-base ec-modal-ghost-layer ec-modal-ghost-layer--b" aria-hidden="true">{word}</div>
        <div
          className="ec-modal-word-base ec-hold-modal-word"
          onClick={(ev) => {
            ev.stopPropagation();
            if (sfx) sfx.click();
            onConfirm();
          }}
        >
          {word}
        </div>
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
  MAX_BEND_SCALE, MAX_WOBBLE_DEG, WOBBLE_FREQ_HZ,
};

// Procedural Web Audio sound set for the switcher gesture, ported
// from the original prototype's synth (same envelopes, frequencies,
// and timings — just given readable names in place of the minified
// ones). Everything is built from five primitives:
//   noiseBuffer      — a buffer of white noise of a given duration.
//   expDecay          — schedules an exponential ramp on a param.
//   filteredNoiseBurst — white noise through a filter, quick attack,
//                        exponential decay: the workhorse for clicks,
//                        crackle, and hiss.
//   oscSweep          — an oscillator sweeping between two
//                        frequencies with the same attack/decay shape.
//   triangleBlip       — a short, slightly-detuned triangle "tick".
//   crackleField       — scatters randomly-timed filteredNoiseBursts
//                        (with occasional triangleBlips) across a time
//                        span, for static/crackle texture.
export function createSwitcherSfx() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const noiseBuffer = (c, duration) => {
    const len = Math.max(1, Math.floor(c.sampleRate * duration));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  };

  const expDecay = (param, atTime, from, to, duration) => {
    param.cancelScheduledValues(atTime);
    param.setValueAtTime(Math.max(from, 1e-4), atTime);
    param.exponentialRampToValueAtTime(Math.max(to, 1e-4), atTime + duration);
  };

  const filteredNoiseBurst = (c, time, duration, filterType, filterFreq, filterQ, gainPeak) => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, duration + 0.02);
    const filt = c.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    if (filterQ != null) filt.Q.value = filterQ;
    const gain = c.createGain();
    const attack = Math.min(0.006, duration * 0.2);
    gain.gain.setValueAtTime(1e-4, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + attack);
    expDecay(gain.gain, time + attack, gainPeak, 1e-4, duration);
    src.connect(filt).connect(gain).connect(c.destination);
    src.start(time);
    src.stop(time + duration + 0.03);
  };

  const oscSweep = (c, time, duration, oscType, freqFrom, freqTo, gainPeak) => {
    const osc = c.createOscillator();
    osc.type = oscType;
    osc.frequency.setValueAtTime(freqFrom, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), time + duration);
    const gain = c.createGain();
    const attack = Math.min(0.01, duration * 0.15);
    gain.gain.setValueAtTime(1e-4, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + attack);
    expDecay(gain.gain, time + attack, gainPeak, 1e-4, duration);
    osc.connect(gain).connect(c.destination);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  };

  // Sweeps through `segments` geometric steps from freqFrom to freqTo
  // (rather than one continuous exponential ramp) — gives the sweep a
  // faint stepped/ratchet quality — then decays over the last ~18%.
  const multiSegmentSweep = (c, time, duration, oscType, freqFrom, freqTo, segments, gainPeak) => {
    const osc = c.createOscillator();
    osc.type = oscType;
    const gain = c.createGain();
    gain.gain.setValueAtTime(1e-4, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + Math.min(0.01, duration * 0.1));
    for (let step = 0; step <= segments; step++) {
      const stepTime = time + (step / segments) * duration;
      const ratio = Math.pow(freqTo / freqFrom, step / segments);
      osc.frequency.setValueAtTime(freqFrom * ratio, stepTime);
    }
    expDecay(gain.gain, time + duration * 0.82, gainPeak, 1e-4, Math.max(duration * 0.3, 0.05));
    osc.connect(gain).connect(c.destination);
    osc.start(time);
    osc.stop(time + duration + 0.08);
  };

  const triangleBlip = (c, time, freqBase, gainPeak) => {
    const freq = freqBase * (0.9 + Math.random() * 0.2);
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.82, 40), time + 0.05);
    const gain = c.createGain();
    gain.gain.setValueAtTime(1e-4, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + 0.004);
    expDecay(gain.gain, time + 0.004, gainPeak, 1e-4, 0.045 + Math.random() * 0.025);
    osc.connect(gain).connect(c.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  };

  const bandpassNoiseBurst = (c, time, duration, freq, q, gainPeak) => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, duration + 0.01);
    const filt = c.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = freq;
    filt.Q.value = q;
    const gain = c.createGain();
    const attack = Math.min(0.004, duration * 0.25);
    gain.gain.setValueAtTime(1e-4, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + attack);
    expDecay(gain.gain, time + attack, gainPeak, 1e-4, duration);
    src.connect(filt).connect(gain).connect(c.destination);
    src.start(time);
    src.stop(time + duration + 0.02);
  };

  const crackleField = (c, start, span, grainCount, freqLo, freqHi, gainScale, blipChance, blipFreqLo, blipFreqHi) => {
    for (let i = 0; i < grainCount; i++) {
      const t = start + Math.random() * span;
      bandpassNoiseBurst(
        c, t, 0.02 + Math.random() * 0.05,
        freqLo + Math.random() * (freqHi - freqLo), 2 + Math.random() * 4,
        gainScale * (0.6 + Math.random() * 0.5),
      );
      if (Math.random() < blipChance) {
        triangleBlip(c, t + Math.random() * 0.01, blipFreqLo + Math.random() * (blipFreqHi - blipFreqLo), gainScale * 0.7);
      }
    }
  };

  // The confirm-word click (and the tail of holdComplete): a short
  // highpass noise crack, a low sine thump, and a trailing blip.
  const playClick = (atTime) => {
    const c = getCtx();
    const time = atTime != null ? atTime : c.currentTime;
    filteredNoiseBurst(c, time, 0.03, "highpass", 2200, 0.7, 0.55);
    oscSweep(c, time, 0.06, "sine", 150, 60, 0.4);
    triangleBlip(c, time + 0.02, 1800, 0.12);
  };

  /* The hold-gesture's continuous "jibbering electronic morass": two
     detuned oscillators (square + sawtooth, through a moving bandpass
     filter) whose frequencies are re-randomized on a fast interval.
     jibberOsc2 (sawtooth) — the "jibbering beeps" — still jumps
     instantly to each new frequency, unaffected by the change below.
     jibberOsc1 (square) — the LFO hum — instead glides to each new
     target with a fast portamento/pitch-sweep (exponentialRampToValueAtTime)
     rather than jumping: a continuous slide between pitches that, run
     this fast over this wide a range, reads as a sudden drop/swoop each
     time rather than a clean glissando. updateJibber(intensity) —
     called every tick alongside applyDegrade — both raises the volume
     and widens/raises the frequency range live, and speeds up the
     randomizer interval itself (which also shortens the hum's own
     portamento time to match), so it sounds like it's accelerating, not
     just getting louder. stopJibber(true) is the hard cutoff for the
     instant CONNECT/DISCONNECT appears; stopJibber(false) is the
     gentler release for letting go early. */
  let jibberOsc1 = null, jibberOsc2 = null, jibberGain = null, jibberFilter = null;
  // Per-oscillator gains, added after feedback that the "gibbering
  // beeps" (jibberOsc2, sawtooth) were going unheard on at least one
  // real mobile device while the hum (jibberOsc1, square) came through
  // fine, even though both share one filter and were always started/
  // stopped together — nothing in the scheduling singles one out, so
  // the likely culprit is that a small phone speaker's frequency
  // response and ambient noise floor simply favor the hum's steadier
  // fundamental over the sawtooth's business. Giving each its own gain
  // (BEEP_RELATIVE_GAIN measurably louder) makes the beeps assert
  // themselves independently of whatever else is fighting for
  // attention, rather than trusting relative perceptual loudness.
  let jibberGainHum = null, jibberGainBeep = null;
  let jibberInterval = null, jibberIntensity = 0;
  const BEEP_RELATIVE_GAIN = 1.6;

  const randomizeJibber = (c) => {
    if (!jibberOsc1 || !jibberOsc2 || !jibberFilter) return;
    const now = c.currentTime;
    const base = 90 + jibberIntensity * 900;
    const spread = 40 + jibberIntensity * 700;
    const stepMs = 90 - jibberIntensity * 60;
    // Portamento time for the hum's glide — a fraction of the current
    // step interval so each slide always finishes well before the next
    // one starts, shortening as jibberIntensity rises along with the
    // interval itself.
    const glideDur = Math.max(0.012, (stepMs / 1000) * 0.45);
    jibberOsc1.frequency.cancelScheduledValues(now);
    jibberOsc1.frequency.setValueAtTime(jibberOsc1.frequency.value, now);
    jibberOsc1.frequency.exponentialRampToValueAtTime(base + Math.random() * spread, now + glideDur);
    jibberOsc2.frequency.setValueAtTime(base * (1.015 + Math.random() * 0.09) + Math.random() * spread * 0.7, now);
    jibberFilter.frequency.setValueAtTime(220 + jibberIntensity * 1300 + Math.random() * 300, now);
  };

  const rescheduleJibberInterval = (c) => {
    if (jibberInterval) clearInterval(jibberInterval);
    // 90ms of chatter at rest, tightening to ~30ms at full intensity —
    // the "accelerating" part of the buildup.
    const stepMs = 90 - jibberIntensity * 60;
    jibberInterval = setInterval(() => randomizeJibber(c), stepMs);
  };

  const startJibber = () => {
    const c = getCtx();
    if (jibberOsc1) return; // already running (shouldn't happen, but idempotent)
    jibberOsc1 = c.createOscillator();
    jibberOsc1.type = "square";
    jibberOsc2 = c.createOscillator();
    jibberOsc2.type = "sawtooth";
    // Independent per-oscillator gain BEFORE the shared filter, so the
    // hum/beep balance is a deliberate mix rather than whatever the
    // filter and destination happen to leave it at — see
    // BEEP_RELATIVE_GAIN's own comment above.
    jibberGainHum = c.createGain();
    jibberGainHum.gain.value = 1;
    jibberGainBeep = c.createGain();
    jibberGainBeep.gain.value = BEEP_RELATIVE_GAIN;
    jibberFilter = c.createBiquadFilter();
    jibberFilter.type = "bandpass";
    jibberFilter.Q.value = 3;
    jibberGain = c.createGain();
    jibberGain.gain.value = 1e-4;
    jibberOsc1.connect(jibberGainHum).connect(jibberFilter);
    jibberOsc2.connect(jibberGainBeep).connect(jibberFilter);
    jibberFilter.connect(jibberGain).connect(c.destination);
    jibberIntensity = 0;
    jibberOsc1.start();
    jibberOsc2.start();
    randomizeJibber(c);
    rescheduleJibberInterval(c);
  };

  const updateJibber = (intensity) => {
    jibberIntensity = intensity;
    if (!jibberGain || !ctx) return;
    const now = ctx.currentTime;
    // Curved rather than linear — per feedback ("crescendoing before
    // the button pops up"), the buildup should stay relatively
    // restrained through the middle of the hold and then surge
    // disproportionately in its final stretch, reading as a climax
    // arriving right as CONNECT/DISCONNECT appears, not a flat ramp
    // that happens to stop. Ceiling also raised (0.17 -> 0.30 range)
    // so the whole texture sits at a level where dropping either layer
    // is far less likely to go unnoticed on a quieter device.
    const curved = Math.pow(Math.max(0, intensity), 1.6);
    jibberGain.gain.cancelScheduledValues(now);
    jibberGain.gain.setValueAtTime(Math.max(jibberGain.gain.value, 1e-4), now);
    jibberGain.gain.linearRampToValueAtTime(Math.max(1e-4, 0.02 + curved * 0.3), now + 0.06);
    rescheduleJibberInterval(ctx);
  };

  const stopJibber = (abrupt) => {
    if (jibberInterval) {
      clearInterval(jibberInterval);
      jibberInterval = null;
    }
    if (!jibberGain || !ctx) {
      jibberOsc1 = jibberOsc2 = jibberGain = jibberFilter = jibberGainHum = jibberGainBeep = null;
      return;
    }
    const now = ctx.currentTime;
    const fadeDur = abrupt ? 0.02 : 0.25;
    jibberGain.gain.cancelScheduledValues(now);
    jibberGain.gain.setValueAtTime(Math.max(jibberGain.gain.value, 1e-4), now);
    jibberGain.gain.exponentialRampToValueAtTime(1e-4, now + fadeDur);
    const osc1 = jibberOsc1, osc2 = jibberOsc2;
    setTimeout(() => { try { osc1.stop(); osc2.stop(); } catch (e) {} }, (fadeDur + 0.05) * 1000);
    jibberOsc1 = jibberOsc2 = jibberGain = jibberFilter = jibberGainHum = jibberGainBeep = null;
  };

  return {
    click() {
      playClick();
    },
    // Hold-gesture continuous jibber texture — see the definitions
    // above. startJibber on the first pointerdown, updateJibber every
    // tick while holding (also drives the visual degrade), stopJibber
    // on release (gentle fade) or completion (the abrupt cutoff
    // holdComplete below already triggers, so callers don't need to
    // call it again there).
    startJibber() {
      startJibber();
    },
    updateJibber(intensity) {
      updateJibber(intensity);
    },
    stopJibber(abrupt) {
      stopJibber(abrupt);
    },
    // A rising three-note chirp (900 -> 1300 -> 1700Hz) under a touch
    // of noise texture, finishing with the click sound — plays the
    // instant the hold completes and the CONNECT/DISCONNECT word
    // appears. Cuts the jibber texture off hard first, per spec: the
    // buildup sound stops the moment this fires, not fading out
    // alongside it.
    holdComplete() {
      stopJibber(true);
      const c = getCtx();
      const t0 = c.currentTime;
      triangleBlip(c, t0, 900, 0.14);
      triangleBlip(c, t0 + 0.045, 1300, 0.13);
      triangleBlip(c, t0 + 0.085, 1700, 0.12);
      bandpassNoiseBurst(c, t0 + 0.02, 0.05, 1800, 2, 0.14);
      playClick(t0 + 0.1);
    },
    // Standard -> Neon: a low rumble, building static, a sawtooth
    // power-up sweep, a bright flash-synced burst, then crackle
    // settling out — timed against the ~2s visual CRT power-on.
    powerOn() {
      const c = getCtx();
      const t0 = c.currentTime;
      oscSweep(c, t0, 0.16, "sine", 85, 34, 0.45);
      bandpassNoiseBurst(c, t0, 0.05, 200, 1.2, 0.3);
      crackleField(c, t0 + 0.01, 0.1, 4, 800, 2600, 0.18, 0.3, 900, 1800);
      crackleField(c, t0 + 0.05, 0.28, 6, 1200, 3200, 0.1, 0.55, 700, 2200);
      bandpassNoiseBurst(c, t0 + 0.13, 0.03, 3200, 3, 0.28);
      triangleBlip(c, t0 + 0.15, 1600, 0.16);
      multiSegmentSweep(c, t0 + 0.38, 0.57, "sawtooth", 70, 320, 9, 0.075);
      crackleField(c, t0 + 0.38, 0.57, 16, 300, 4200, 0.12, 0.4, 500, 3000);
      filteredNoiseBurst(c, t0 + 0.95, 0.22, "highpass", 3000, 0.5, 0.38);
      crackleField(c, t0 + 0.95, 0.2, 5, 2500, 6000, 0.1, 0.6, 2000, 5000);
      crackleField(c, t0 + 1.25, 0.5, 8, 800, 2400, 0.06, 0.4, 1200, 2800);
      triangleBlip(c, t0 + 1.3, 1100, 0.05);
    },
    // Neon -> Standard: a CRT shutdown — switch click, a flyback whine
    // cut abruptly, a deflection downsweep, a power-rail drain with a
    // sub-bass pop, a long sinking phosphor hum, sparse residual
    // crackle, a detuned trailing whine, and a final settling pop
    // timed to the visual afterglow's last fade.
    powerOff() {
      const c = getCtx();
      const t0 = c.currentTime;
      const master = c.createGain();
      master.gain.value = 0.9; // headroom so several simultaneous layers don't clip
      master.connect(c.destination);

      // Switch click: sharp highpass noise burst, 15ms decay.
      const clickDur = 0.015;
      const clickSrc = c.createBufferSource();
      clickSrc.buffer = noiseBuffer(c, clickDur);
      const clickFilter = c.createBiquadFilter();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 1200;
      const clickGain = c.createGain();
      clickGain.gain.setValueAtTime(0.8, t0);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t0 + clickDur);
      clickSrc.connect(clickFilter).connect(clickGain).connect(master);
      clickSrc.start(t0);
      clickSrc.stop(t0 + clickDur + 0.005);

      // Flyback cut: the NTSC horizontal scan tone (15,734Hz), cut
      // abruptly at 20ms with a sharp 5ms fade.
      const flybackCutAt = t0 + 0.02;
      const flybackOsc = c.createOscillator();
      flybackOsc.type = "sine";
      flybackOsc.frequency.value = 15734;
      const flybackGain = c.createGain();
      flybackGain.gain.setValueAtTime(0.25, t0);
      flybackGain.gain.setValueAtTime(0.25, flybackCutAt);
      flybackGain.gain.linearRampToValueAtTime(0.0001, flybackCutAt + 0.005);
      flybackOsc.connect(flybackGain).connect(master);
      flybackOsc.start(t0);
      flybackOsc.stop(flybackCutAt + 0.01);

      // Deflection downsweep: 850Hz -> 30Hz over 220ms.
      const deflectStart = t0 + 0.01;
      const deflectDur = 0.22;
      const deflectOsc = c.createOscillator();
      deflectOsc.type = "sine";
      deflectOsc.frequency.setValueAtTime(850, deflectStart);
      deflectOsc.frequency.exponentialRampToValueAtTime(30, deflectStart + deflectDur);
      const deflectGain = c.createGain();
      deflectGain.gain.setValueAtTime(0.0001, deflectStart);
      deflectGain.gain.linearRampToValueAtTime(0.5, deflectStart + 0.015);
      deflectGain.gain.exponentialRampToValueAtTime(0.0001, deflectStart + deflectDur);
      deflectOsc.connect(deflectGain).connect(master);
      deflectOsc.start(deflectStart);
      deflectOsc.stop(deflectStart + deflectDur + 0.02);

      // Power-rail drain: lowpass noise sweeping 3000Hz -> 80Hz over
      // 300ms, plus a sub-bass 50Hz pop.
      const drainDur = 0.3;
      const drainSrc = c.createBufferSource();
      drainSrc.buffer = noiseBuffer(c, drainDur);
      const drainFilter = c.createBiquadFilter();
      drainFilter.type = "lowpass";
      drainFilter.Q.value = 0.7;
      drainFilter.frequency.setValueAtTime(3000, t0);
      drainFilter.frequency.exponentialRampToValueAtTime(80, t0 + drainDur);
      const drainGain = c.createGain();
      drainGain.gain.setValueAtTime(0.35, t0);
      drainGain.gain.exponentialRampToValueAtTime(0.001, t0 + drainDur);
      drainSrc.connect(drainFilter).connect(drainGain).connect(master);
      drainSrc.start(t0);
      drainSrc.stop(t0 + drainDur + 0.02);

      const popOsc = c.createOscillator();
      popOsc.type = "sine";
      popOsc.frequency.value = 50;
      const popGain = c.createGain();
      popGain.gain.setValueAtTime(0.4, t0);
      popGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      popOsc.connect(popGain).connect(master);
      popOsc.start(t0);
      popOsc.stop(t0 + 0.16);

      // Phosphor discharge hum: a low tone continuously sinking in
      // pitch under a slow wobble, bridging the opening clunk to the
      // long fade that follows.
      const humStart = t0 + 0.08;
      const humDur = 1.55;
      const humOsc = c.createOscillator();
      humOsc.type = "triangle";
      humOsc.frequency.setValueAtTime(58, humStart);
      humOsc.frequency.exponentialRampToValueAtTime(23, humStart + humDur * 0.6);
      humOsc.frequency.exponentialRampToValueAtTime(14, humStart + humDur);
      const humWobble = c.createOscillator();
      humWobble.type = "sine";
      humWobble.frequency.value = 0.6;
      const humWobbleGain = c.createGain();
      humWobbleGain.gain.value = 3;
      humWobble.connect(humWobbleGain).connect(humOsc.frequency);
      const humGain = c.createGain();
      humGain.gain.setValueAtTime(0.0001, humStart);
      humGain.gain.linearRampToValueAtTime(0.22, humStart + 0.12);
      humGain.gain.exponentialRampToValueAtTime(0.0001, humStart + humDur);
      humOsc.connect(humGain).connect(master);
      humOsc.start(humStart);
      humOsc.stop(humStart + humDur + 0.05);
      humWobble.start(humStart);
      humWobble.stop(humStart + humDur + 0.05);

      // Residual static crackle field: sparse, randomly-timed noise
      // grains scattered irregularly across the fade.
      const crackleFieldEnd = t0 + 1.82;
      let crackleT = t0 + 0.22;
      while (crackleT < crackleFieldEnd) {
        const grainDur = 0.008 + Math.random() * 0.03;
        const grainSrc = c.createBufferSource();
        grainSrc.buffer = noiseBuffer(c, grainDur);
        const grainFilter = c.createBiquadFilter();
        grainFilter.type = "bandpass";
        grainFilter.frequency.value = 600 + Math.random() * 4200;
        grainFilter.Q.value = 2 + Math.random() * 6;
        const grainGain = c.createGain();
        const grainPeak = (0.03 + Math.random() * 0.09) * Math.max(0, 1 - (crackleT - t0) / 1.85);
        grainGain.gain.setValueAtTime(Math.max(grainPeak, 1e-4), crackleT);
        grainGain.gain.exponentialRampToValueAtTime(0.0001, crackleT + grainDur);
        grainSrc.connect(grainFilter).connect(grainGain).connect(master);
        grainSrc.start(crackleT);
        grainSrc.stop(crackleT + grainDur + 0.01);
        crackleT += 0.05 + Math.random() * 0.16;
      }

      // Trailing whine: two closely-detuned high sines beating against
      // each other, sinking in pitch and volume.
      const whineStart = t0 + 0.4;
      const whineDur = 1.35;
      [1, 1.006].forEach((detuneMul, idx) => {
        const whineOsc = c.createOscillator();
        whineOsc.type = "sine";
        whineOsc.frequency.setValueAtTime(2600 * detuneMul, whineStart);
        whineOsc.frequency.exponentialRampToValueAtTime(340 * detuneMul, whineStart + whineDur);
        const whineGain = c.createGain();
        whineGain.gain.setValueAtTime(0.0001, whineStart);
        whineGain.gain.linearRampToValueAtTime(idx === 0 ? 0.05 : 0.04, whineStart + 0.2);
        whineGain.gain.exponentialRampToValueAtTime(0.0001, whineStart + whineDur);
        whineOsc.connect(whineGain).connect(master);
        whineOsc.start(whineStart);
        whineOsc.stop(whineStart + whineDur + 0.05);
      });

      // Final phosphor pop: one last, very quiet settling click timed
      // to land as the visual afterglow finishes fading.
      const finalPopAt = t0 + 1.86;
      const finalSrc = c.createBufferSource();
      finalSrc.buffer = noiseBuffer(c, 0.01);
      const finalFilter = c.createBiquadFilter();
      finalFilter.type = "bandpass";
      finalFilter.frequency.value = 900;
      finalFilter.Q.value = 4;
      const finalGain = c.createGain();
      finalGain.gain.setValueAtTime(0.12, finalPopAt);
      finalGain.gain.exponentialRampToValueAtTime(0.0001, finalPopAt + 0.04);
      finalSrc.connect(finalFilter).connect(finalGain).connect(master);
      finalSrc.start(finalPopAt);
      finalSrc.stop(finalPopAt + 0.05);
    },
  };
}
