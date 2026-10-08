import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as standardTheme from "../themes/standard.js";
import * as neonTheme from "../themes/neon.js";
import { mountSummon, summonBridge } from "../themes/neon-summon.js";
import * as tiendaTheme from "../themes/tienda.js";
import { setBoardDimensions, getBoardDimensions, setActiveLaws, setBlackHoles, setMissingSquares, ACTIVE_LAWS, BLACK_HOLES, MISSING_SQUARES } from "../engine/constants.js";
import { StoryCut, STORY_KEY, storyPreview, readOwned, saveOwned, saveStoreGone, storeGone, forgetStoreGone, hallDue, saveHallDue, hallFlares, saveHallFlares, storyEnded, saveStoryEnded, forgetStoryEnd } from "./novaStory.jsx";
import { createRealitiesMenu, goToWorld, onStoryRestart, lastWorld } from "../themes/realities.js";
import { SINGULARITY_SEEN_KEY, SPECIAL_ORDER_NOTED_KEY, COMMERCIAL_AIRED_KEY, forgetSingularity, journeyPreview, singularitySeen, onJourneyChange, commercialAired, markCommercialAired, setCommercialOn, setSceneLink } from "../engine/journey.js";
import { prepareCommercial } from "../themes/den-ad-audio.js";
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

/* The story (apps/novaStory.jsx): the store, home, and Singularity. The
   store and home are Tienda and Standard with the story handed to
   Tienda's printed matter (themes/tienda-overlay.js): in the store its
   catalog shows only the five pieces and sells the game; at home it's the
   whole mail-order catalog, with the way back to the store and a fresh
   start. The chassis keeps its theme object for as long as it's mounted,
   so these are fixed objects, and their buttons reach the app through
   storyBridge, which the app keeps pointed at its current handlers. */
// ?fresh: a brand-new player (user: links to start the whole game from
// nothing, for finding bugs): everything this browser has kept for the
// game (every el-cabeza: key, the story, the settings, the sound) is
// forgotten, and the page loads again without the word, from the store.
const FRESH = (() => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("fresh")) return false;
    [window.localStorage, window.sessionStorage].forEach((st) => {
      Object.keys(st).filter((k) => k.startsWith("el-cabeza:")).forEach((k) => st.removeItem(k));
    });
    url.searchParams.delete("fresh");
    window.location.replace(url.pathname + url.search + url.hash);
    return true;
  } catch (e) { return false; }
})();
// Restart story from another page's realities menu (?restart=story): the
// story starts over here, in the store, the same fresh start as Nova's own
// Restart story (restartStory below). Read before anything else, once.
(() => {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("restart") !== "story") return;
    saveOwned(false);
    forgetStoreGone();
    forgetStoryEnd();
    forgetSingularity();
    url.searchParams.delete("restart");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch (e) { /* no URL or storage: nothing to clear */ }
})();
// ?switcher: straight to the theme switcher (the Other realities menu),
// everything unlocked (user: "a link that goes straight to theme
// switcher"; chose to unlock everything): the story is marked played
// through on this device (bought, the Singularity seen, the store gone,
// the end reached) and the menu opens over the den. Its Restart story
// undoes it. Read before anything else, once.
const OPEN_SWITCHER = (() => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("switcher")) return false;
    let rec = {};
    try { rec = JSON.parse(localStorage.getItem(STORY_KEY) || "null") || {}; } catch (e) { /* none kept */ }
    localStorage.setItem(STORY_KEY, JSON.stringify({ ...rec, owned: true, storeGone: true, ended: true, hallDue: false }));
    [SINGULARITY_SEEN_KEY, SPECIAL_ORDER_NOTED_KEY, COMMERCIAL_AIRED_KEY].forEach((k) => localStorage.setItem(k, "1"));
    url.searchParams.delete("switcher");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return true;
  } catch (e) { return false; }
})();
// From another page's realities menu (realities.js goToWorld): ?world=
// <place>, after the story.
const WORLD_PARAM = (() => {
  try { const w = new URLSearchParams(window.location.search).get("world"); return storyEnded() && ["standard", "neon", "tienda"].includes(w) ? w : null; } catch (e) { return null; }
})();
// A look at one of the den's scenes without playing the story there:
// ?scene=revelation (den-ending.js), ?scene=glutts (the trip back to
// the closed Big Glutts, den-trip.js), ?scene=hall (the hallway lighting
// up, den-hall.js), ?scene=lure (home before the Singularity, the set
// stirring, and on through it into the summons) or ?scene=commercial (the
// user's spot on the set, as home from the Singularity the first time;
// user: a direct link to see it there). Opens in the den. Read once.
let SCENE_PARAM = (() => {
  try { const v = new URLSearchParams(window.location.search).get("scene"); return ["revelation", "glutts", "hall", "lure", "commercial"].includes(v) ? v : null; } catch (e) { return null; }
})();
const COMMERCIAL_SCENE = SCENE_PARAM === "commercial";
// ?scene=summons: straight into Neon as if just through the den's set the
// first time: the summons over the board, then the sphere's first visit
// (the ring and heartbeat, the menu coming apart, the hand). The journey
// plays it as never seen and keeps this visit in memory only
// (engine/journey.js journeyPreview), so nothing of it is saved.
const SUMMONS_PARAM = (() => {
  try { return new URLSearchParams(window.location.search).get("scene") === "summons"; } catch (e) { return false; }
})();
// (?scene=lure is played the same way: the Singularity as never seen, so
// the set lures, and through it the summons and the sphere's first visit,
// none of it kept.)
const LURE_PARAM = SCENE_PARAM === "lure";
const STORY_PREVIEW = SUMMONS_PARAM || LURE_PARAM;
// (Any scene's link: no reality gate over it, even after the story (user:
// the hallway's link, with the story over, opened under the gate).)
const SCENE_LINK = STORY_PREVIEW || !!SCENE_PARAM;
// After the story, Nova's page opens on the realities menu (user: "the
// game should always open on the theme switcher"), with the last world
// played offered first ("Continue in ..."; chosen with the user). Not when
// it's come here for a place (?world=) or a scene's link.
const OPEN_ON_RETURN = !OPEN_SWITCHER && !WORLD_PARAM && !SCENE_LINK && storyEnded();
// (The den's one-scene links, revelation, glutts, hall: no story notes over
// them. Not the summons or the lure: those play the whole first trip.)
if (SCENE_PARAM && !LURE_PARAM) setSceneLink();
if (STORY_PREVIEW) { journeyPreview(); storyPreview(); }
const takeScene = () => { const r = SCENE_PARAM; SCENE_PARAM = null; return r; };
const storyBridge = { purchase() {}, backToStore() {}, restartNow() {}, goHomeConfused() {}, orderAtStore() {}, arrival: false, audio: null, callNext: false, finishStory() {}, goWorld() {}, openRealities() {} };
// The realities menu's Restart story starts over here, in place.
onStoryRestart(() => storyBridge.restartNow());
// How the place just mounted was reached (read once): false for the page
// opening there, "cut" by a scene change, "fresh" by the fresh start.
const takeArrival = () => { const a = storyBridge.arrival; storyBridge.arrival = false; return a; };
// The place's own sound engine, to fade out as the story leaves it.
const bindAudio = (audio) => { storyBridge.audio = audio; };
// After the whole story (bought, and the Singularity seen) the store has
// never heard of the game (tienda-overlay.js ClerkScene).
// Once the story's over (den-ending.js) it's one of the other realities
// instead: Big Glutts "the day you found it", the game on the counter
// (realities.js), and the way into a game there is the gate
// (reality-gate.js).
const storeAfter = () => readOwned() && singularitySeen() && !storyEnded();
const STORE_STORY = { mode: "store", onPurchase: () => storyBridge.purchase(), onGoHomeConfused: (o) => storyBridge.goHomeConfused(o), after: storeAfter, arrived: takeArrival, bindAudio, realities: () => storyEnded() };
/* The first time through (the commercial seen, the store not yet gone
   strange; until the story starts over), the order form at home is a
   special order to take to the store (guided, onOrderAtStore). */
const HOME_STORY = {
  mode: "home", onBackToStore: () => storyBridge.backToStore(), storeGone, arrived: takeArrival, bindAudio,
  guided: () => singularitySeen() && !storeGone(),
  onOrderAtStore: () => storyBridge.orderAtStore(),
  // After the story's end (themes/den-ending.js): the other realities.
  realities: () => storyEnded(),
  onRealities: () => storyBridge.openRealities(),
};
const storeTheme = {
  ...tiendaTheme,
  useSetupExtras: (x) => {
    // Back after the whole story, the store has moved on: set before the
    // store is built (at mount, after this first render).
    tiendaTheme.setStoreRevisited(storeAfter());
    return tiendaTheme.useSetupExtras({ ...x, story: STORE_STORY });
  },
  // Full screen at the first tap (as every screen now is: the chassis).
  fullscreenOnFirstTap: true,
  // After the story: the gate as it comes up, and the other realities.
  realityGate: SCENE_LINK ? null : { world: "store", novaGo: (to, w) => storyBridge.goWorld(w) },
  cornerAction: () => (storyEnded() ? { label: "Other realities", onClick: () => storyBridge.openRealities() } : null),
};
/* The den's television (themes/den-tv.js, den-fx.js) is the way into
   Singularity: turned on, its picture pulls the camera in and Nova's own
   transition takes over (enter). Back out of Singularity, the den comes up
   with the set on, and it switches off (returning, read once). The menu's
   "Turn on the TV" presses the set's knob (press, from the den). */
const tvBridge = { returning: false, commercial: false, press: null, portal: () => false, enter() {}, back: () => false };
const homeTheme = {
  ...standardTheme,
  useSetupExtras: (x) => tiendaTheme.useSetupExtras({ ...x, story: HOME_STORY }),
  renderSetupExtras: tiendaTheme.renderSetupExtras,
  renderExtraOverlays: tiendaTheme.renderExtraOverlays,
  shellSetupActions: tiendaTheme.shellSetupActions,
  // After the story: Other realities in the corner too (any time, games
  // and all).
  cornerAction: () => (storyEnded() ? { label: "Other realities", onClick: () => storyBridge.openRealities() } : null),
  // ...and the way into a game as it comes up (themes/reality-gate.js).
  realityGate: SCENE_LINK ? null : { world: "den", novaGo: (to, w) => storyBridge.goWorld(w) },
  mountAmbientEffects: (refs, helpers) => {
    const returning = tvBridge.returning;
    const commercial = returning && tvBridge.commercial;
    tvBridge.returning = tvBridge.commercial = false;
    // Home with the special order: the thought, then Big Glutts on the
    // phone (themes/den-call.js). Read once.
    const call = storyBridge.callNext;
    storyBridge.callNext = false;
    return standardTheme.mountAmbientEffects(refs, {
      ...helpers,
      tv: {
        returning,
        commercial,
        portal: () => tvBridge.portal(),
        // Home before the first Singularity: the set waits to be noticed
        // (den-fx.js's lure: not for the first 40 s, then it stirs).
        lure: () => !singularitySeen(),
        enter: () => tvBridge.enter(),
        register: (api) => { tvBridge.press = api ? api.press : null; },
        call,
        /* The end of the story (themes/den-hall.js, den-ending.js): the
           hall's due from the trip's return; then the void and the other
           realities, and the story's over (ended: the set's channels). */
        hall: { due: () => hallDue() && !storyEnded(), arm: () => saveHallDue(true), flares: { get: hallFlares, set: saveHallFlares } },
        ended: () => storyEnded(),
        preview: takeScene,
        ending: { finish: () => storyBridge.finishStory(), go: (w) => storyBridge.goWorld(w) },
        realities: { go: (w) => storyBridge.goWorld(w) },
      },
    });
  },
};
/* Singularity's BACK, in Nova, goes home: straight to the den through
   Nova's own transition (not back to Neon's board), where the set is on
   and, the first time, showing the commercial (the user's spot,
   themes/den-commercial.js). */
const novaNeonTheme = {
  ...neonTheme,
  // After the story: the gate as it comes up, and the other realities.
  // (Not over the summons opened by its own link, ?scene=summons.)
  realityGate: SCENE_LINK ? null : { world: "neon", novaGo: (to, w) => storyBridge.goWorld(w) },
  cornerAction: () => (storyEnded() ? { label: "Other realities", onClick: () => storyBridge.openRealities() } : null),
  useSetupExtras: (x) => {
    const e = { ...neonTheme.useSetupExtras(x), onSingularityBack: () => tvBridge.back() };
    // The summons' way in (themes/neon-summon.js): Neon's own reveal.
    summonBridge.reveal = e.revealSingularity || null;
    return e;
  },
  /* The first arrival, until the Singularity's been visited: the way in
     shows itself over the board (themes/neon-summon.js, the user's pick). */
  mountAmbientEffects: (refs, helpers) => {
    const base = neonTheme.mountAmbientEffects(refs, helpers);
    const summon = !singularitySeen() && helpers && helpers.three ? mountSummon(helpers.three, { audio: helpers.audio, cam: helpers.cam }) : null;
    if (!summon) return base;
    return {
      ...base,
      tick(now) { base.tick(now); summon.tick(now); },
      render: (r, scene, camera) => summon.render(r, scene, camera),
      dispose() { summon.dispose(); base.dispose && base.dispose(); },
    };
  },
};
const THEMES = { tienda: storeTheme, standard: homeTheme, neon: novaNeonTheme };

/* Every place starts with the classic game. The rules, board and squares
   of a game ordered at home, or set up in Singularity, live in the
   engine's module state, which a remount leaves alone (see carry/carryRef
   in the chassis), so each change of place puts back what the page booted
   with. */
let bootRules = null;
function restoreBootRules() {
  if (!bootRules) return;
  setActiveLaws(bootRules.laws);
  setBlackHoles([]);
  setMissingSquares([]);
  setBoardDimensions(bootRules.board.rows, bootRules.board.cols);
}
/* A game in the den left through the television (or the title's hold)
   for Neon comes back exactly as it was, when that trip is straight back
   (user): its rules as the engine held them, and the chassis's own game
   (carryRef's snapshot, handed back as `carry`). A story scene change
   starts the new place fresh, as before. */
const rulesNow = () => ({ board: getBoardDimensions(), laws: { ...ACTIVE_LAWS }, holes: BLACK_HOLES.slice(), missing: MISSING_SQUARES.slice() });
function putRules(r) {
  setActiveLaws(r.laws);
  setBlackHoles(r.holes);
  setMissingSquares(r.missing);
  setBoardDimensions(r.board.rows, r.board.cols);
}
const LAYOUT_KEY = "el-cabeza:nova-layout";
const {
  MAX_WARP_SCALE, MAX_ABERRATION_PX, MAX_SCANLINE_OPACITY, MAX_STATIC_OPACITY,
  MAX_SHAKE_PX, MAX_WARP_PULSE, MAX_STROBE, SHAKE_FREQ_MIN, SHAKE_FREQ_MAX,
  MAX_BEND_SCALE, MAX_WOBBLE_DEG, WOBBLE_FREQ_HZ,
} = HOLD_DEGRADE_TUNING;

function UnifiedApp() {
  // A first visit opens in the store; once the game is bought, at home.
  const [themeName, setThemeName] = useState(() => (SUMMONS_PARAM ? "neon" : WORLD_PARAM || (SCENE_PARAM || readOwned() ? "standard" : "tienda")));
  // Before the first Singularity visit the way into Neon from the den is
  // the television alone (user): no title hold there, no shortcut in the
  // phone menu. After it (engine/journey.js), both; a story restart locks
  // them again.
  const [singularityOpen, setSingularityOpen] = useState(singularitySeen);
  // The clerk's scene played out (tienda-overlay.js): the menu's purchase
  // becomes "Go home, confused."
  const [clerkTick, setClerkTick] = useState(0);
  useEffect(() => { const on = () => setClerkTick((n) => n + 1); window.addEventListener("el-cabeza:clerk-done", on); return () => window.removeEventListener("el-cabeza:clerk-done", on); }, []);
  useEffect(() => onJourneyChange(setSingularityOpen), []);
  // The commercial (the user's spot; den-ad-audio.js, den-commercial.js),
  // well ahead, while it's still to come: its sound from the start, its
  // video (2.8 MB) once the Singularity's open, not while the store's
  // loading; it's played on the way home from the Singularity.
  // (Its own link: all of it, at once.)
  useEffect(() => { if (COMMERCIAL_SCENE || !commercialAired()) prepareCommercial({ picture: COMMERCIAL_SCENE || singularityOpen }); }, [singularityOpen]);
  // The den's game while Neon's up (see putRules above), and the one
  // handed to the chassis as it mounts.
  const carryRef = useRef(null);
  const denSaveRef = useRef(null);
  const [carry, setCarry] = useState(null);
  const [cut, setCut] = useState(null); // a story scene change: { kind, caption, to, fresh?, swapped?, arrived? }
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
  // (The register tape's recordings, fetched ahead so they're there when
  // the game's bought: always, not only while it's still on the shelf at
  // the page's opening, or a "Start the story over" from an owned game
  // rang the register before they'd arrived and the made sounds played.
  // ~50 KB.)
  useEffect(() => { sfxRef.current.prefetchReceipt(); }, []);

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
    let raf, lastZone = null, lastKey = "";
    const sync = () => {
      const titleEl = document.querySelector(".ec-title");
      const zone = holdZoneRef.current;
      if (titleEl && zone) {
        const r = titleEl.getBoundingClientRect();
        const pad = 16;
        // Written only when the title has moved (or the zone is new):
        // writing every frame dirtied the page's layout every frame.
        const key = `${r.top},${r.left},${r.width},${r.height}`;
        if (zone !== lastZone || key !== lastKey) {
          lastZone = zone; lastKey = key;
          zone.style.top = (r.top - pad) + "px";
          zone.style.left = (r.left - pad) + "px";
          zone.style.width = (r.width + pad * 2) + "px";
          zone.style.height = (r.height + pad * 2) + "px";
        }
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

  // Same tab-visibility mute as ElCabeza3D's own (see its comment) —
  // this engine runs entirely independently of whichever theme is
  // mounted, so it needs the identical fix applied separately here.
  useEffect(() => {
    function onVisibilityChange() {
      sfxRef.current.setMuted(document.visibilityState === "visible" ? muted : true);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [muted]);

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
    setTimeout(() => {
      // Leaving the den: keep its game. Back to it: put that game back.
      if (direction === "in") {
        const snap = carryRef.current;
        denSaveRef.current = snap ? { game: snap(), rules: rulesNow() } : null;
        restoreBootRules();
        setCarry(null);
      } else if (denSaveRef.current) {
        putRules(denSaveRef.current.rules);
        setCarry(denSaveRef.current.game);
        denSaveRef.current = null;
      } else {
        restoreBootRules();
        setCarry(null);
      }
      // Back out of Singularity, the den's set is on, and switches off.
      // The first time home after the Singularity's been seen (BACK, or
      // the title's hold), the commercial's on first.
      if (direction === "out") {
        tvBridge.returning = true;
        if (singularitySeen() && !commercialAired()) { markCommercialAired(); tvBridge.commercial = true; setCommercialOn(true); }
      }
      setThemeName(direction === "in" ? "neon" : "standard");
    }, direction === "in" ? 380 : 1292);
  }, [themeName]);

  const onTransitionDone = useCallback(() => setTransition(null), []);

  /* The story's scene changes (StoryCut): bought and taken home, back to
     the store, or the story from the top (the box back on the shelf, lid
     and all). One at a time, and not over a CRT transition. */
  const cutRef = useRef(null);
  cutRef.current = cut;
  const busyRef = useRef(false);
  busyRef.current = !!(cut || transition);
  const startCut = useCallback((c) => {
    if (busyRef.current) return;
    busyRef.current = true;
    // The place's sound goes as the screen does (over the tape, for the
    // purchase).
    const a = storyBridge.audio;
    if (a && a.fadeOutAll) { try { a.fadeOutAll(c.kind === "purchase" ? 3.5 : 1.2); } catch (e) { /* no sound */ } }
    setCut(c);
  }, []);
  storyBridge.purchase = () => {
    if (busyRef.current) return;
    // Another copy, after all that: the clerk (and then the manager).
    if (storeAfter()) { window.dispatchEvent(new CustomEvent("el-cabeza:clerk")); return; }
    saveOwned(true);
    startCut({ kind: "purchase", caption: "Later, at home.", to: "standard" });
  };
  storyBridge.backToStore = () => { if (!storeGone()) startCut({ kind: "fade", caption: "Back at the store.", to: "tienda" }); };
  storyBridge.goHomeConfused = (o) => {
    if (busyRef.current) return;
    saveStoreGone();
    storyBridge.callNext = !!(o && o.withOrder);
    // With the special order: the new pieces are on the table already
    // (tienda-overlay.js sets the game up from the order at home).
    startCut(o && o.withOrder
      ? { kind: "fade", caption: "Home again. Confused.", sub: "The new pieces are already on the table, as if they'd been in the box all along.", to: "standard" }
      : { kind: "fade", caption: "Home again. Confused.", to: "standard" });
  };
  // The special order, stamped at home: off to the store with it.
  storyBridge.orderAtStore = () => {
    if (busyRef.current) return;
    startCut({ kind: "fade", caption: "Back at Big Glutts, order in hand.", to: "tienda" });
  };
  /* The end of the story (den-ending.js): over, and the other realities
     open: Nova's own places by a cut, the site's other pages by going to
     them (realities.js). "Other realities" (the den's dock, the phone's
     menu) opens the same menu over wherever you are. */
  const [ended, setEnded] = useState(() => storyEnded());
  const CUT_CAPTIONS = { standard: "The den, 1975.", neon: "Neon.", tienda: "Big Glutts, Games & Hobby Dept." };
  storyBridge.finishStory = () => { saveStoryEnded(); setEnded(true); };
  storyBridge.goWorld = (w) => goToWorld(w, (to) => {
    if (busyRef.current || to === themeName) return;
    startCut({ kind: "fade", caption: CUT_CAPTIONS[to] || "", to });
  });
  storyBridge.openRealities = (opts = {}) => {
    if (busyRef.current) return;
    createRealitiesMenu({ current: themeName, onPick: (w) => storyBridge.goWorld(w), continueWorld: opts.continueWorld || null });
  };
  // ?switcher, or back after the story: the menu, once the den's up (the
  // latter with the last world played first).
  useEffect(() => {
    if (!OPEN_SWITCHER && !OPEN_ON_RETURN) return undefined;
    const id = setTimeout(() => storyBridge.openRealities(OPEN_ON_RETURN ? { continueWorld: lastWorld() } : {}), 900);
    return () => clearTimeout(id);
  }, []);
  /* The story over from the top: only from the very bottom of the
     theme switcher (the realities menu, which asks first; user: "Remove
     restart story from all buttons from all menus except at the very
     bottom of the theme switcher"), or another page's (?restart=story).
     No longer in the den's dock or its phone menu, nor their "Are you
     sure?" card. */
  const restartStory = () => {
    if (busyRef.current) return;
    saveOwned(false);
    forgetStoreGone();
    forgetStoryEnd();
    setEnded(false);
    // The extras go back behind the Singularity (engine/journey.js).
    forgetSingularity();
    startCut({ kind: "fade", caption: "Once more, from the top\u2026 shelf.", to: "tienda", fresh: true, linger: 750 });
  };
  // The realities menu's Restart story (it has already asked).
  storyBridge.restartNow = restartStory;
  // The television: into Singularity when nothing else is under way.
  tvBridge.portal = () => !busyRef.current && themeName === "standard";
  tvBridge.enter = () => {
    if (busyRef.current || themeName !== "standard") return false;
    beginTransition();
    return true;
  };
  tvBridge.back = () => {
    if (busyRef.current || themeName !== "neon" || transition) return false;
    beginTransition();
    return true;
  };
  // (Test-only: home from Neon the way the Singularity's BACK goes.)
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__EC_TEST_BACK_HOME__ = () => tvBridge.back();
  // Under the black: the new place.
  const onCutSwap = useCallback(() => {
    const c = cutRef.current;
    if (!c) return;
    if (c.fresh) tiendaTheme.resetLid();
    restoreBootRules();
    denSaveRef.current = null;
    setCarry(null);
    storyBridge.arrival = c.fresh ? "fresh" : "cut";
    setThemeName(c.to);
    setCut({ ...c, swapped: true });
  }, []);
  // The new place has mounted (its room built in its mount effects, which
  // run before this one): the cut can fade up on it.
  useEffect(() => {
    if (cut && cut.swapped && !cut.arrived) setCut({ ...cut, arrived: true });
  }, [themeName, cut]);
  const onCutDone = useCallback(() => { storyBridge.arrival = false; setCut(null); }, []);

  // ABOUT's "The original El Cabeza" link: the chassis has already reset
  // to a plain game; from Neon, go back to the Standard theme as well.
  useEffect(() => {
    const onOriginal = () => { if (themeName === "neon" && !transition) beginTransition(); };
    window.addEventListener("el-cabeza:play-original", onOriginal);
    return () => window.removeEventListener("el-cabeza:play-original", onOriginal);
  }, [themeName, transition, beginTransition]);

  /* Phone layout (chassis/MobileShell.jsx): the theme switch is also a
     menu item there, since a four-second hold on the title is hard to
     find on a phone. It opens the same CONNECT / DISCONNECT prompt the
     hold ends in, and is there where the hold is (in Neon, only once the
     story's over). */
  /* Layout: the classic dock with its floating piece (the default, on
     phones too, as the user asked) or the control bar. Remembered in this
     browser. */
  const [layoutPref, setLayoutPref] = useState(() => {
    try { return localStorage.getItem(LAYOUT_KEY) === "bar" ? "bar" : "dock"; } catch (e) { return "dock"; }
  });
  const onLayoutChange = useCallback((v) => {
    setLayoutPref(v);
    try { localStorage.setItem(LAYOUT_KEY, v); } catch (e) { /* storage blocked: this visit only */ }
  }, []);
  /* The phone layout's menu, by place: in the store the purchase; at home
     the switch into Neon, the way back to the store and the fresh start;
     in Neon the switch back. */
  const mobileShell = useMemo(() => {
    // At home: the television's knob (the prompt the title hold ends in,
    // if the set isn't there to turn). In Neon: back to the den.
    const switchTheme = {
      key: "switch-theme",
      testid: "shell-menu-switch-theme",
      label: themeName === "standard" ? "Turn on the TV" : "Back to the den",
      detail: themeName === "standard" ? (singularityOpen ? "Into Singularity, or hold the title" : "Into Singularity") : "or hold the title",
      onClick: () => {
        if (transition || cut) return;
        if (themeName === "standard" && tvBridge.press && tvBridge.press()) return;
        if (themeName === "standard" && !singularityOpen) return; // the set, or nothing, the first time
        sfxRef.current.holdComplete();
        setConnectWord(themeName === "standard" ? "CONNECT" : "DISCONNECT");
      },
    };
    const after = storeAfter();
    const items = themeName === "tienda"
      ? [tiendaTheme.clerkConfused()
          ? { key: "confused", testid: "shell-menu-go-home-confused", label: "Go home, confused.", detail: "Nobody here has heard of it", onClick: () => storyBridge.goHomeConfused() }
          : { key: "purchase", testid: "shell-menu-purchase", label: after ? "Purchase another copy" : "Purchase and bring home", detail: after ? "$7.97, at the register" : "$7.97, and home to the den", onClick: () => storyBridge.purchase() },
        ended && { key: "realities", testid: "shell-menu-realities", label: "Other realities", detail: "Every version of the game", onClick: () => storyBridge.openRealities() }].filter(Boolean)
      : themeName === "standard"
        ? [
            switchTheme,
            ended && { key: "realities", testid: "shell-menu-realities", label: "Other realities", detail: "Every version of the game", onClick: () => storyBridge.openRealities() },
            !storeGone() && { key: "back-to-store", testid: "shell-menu-back-to-store", label: "Back to the store", detail: "Where the game came from", onClick: () => storyBridge.backToStore() },
          ].filter(Boolean)
        // (In Neon its way back, the hold's twin, only once the story's
        // over, as the hold.)
        : [ended && switchTheme, ended && { key: "realities", testid: "shell-menu-realities", label: "Other realities", detail: "Every version of the game", onClick: () => storyBridge.openRealities() }].filter(Boolean);
    return { preferBar: layoutPref === "bar", onLayoutChange, menuItems: items };
  }, [themeName, transition, cut, layoutPref, onLayoutChange, singularityOpen, clerkTick, ended]);

  // The browser's own toolbar colour follows the theme on phones.
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEMES[themeName].canvasGradientEnd || THEMES[themeName].COLORS.creamAlt;
  }, [themeName]);

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
            carry={carry}
            carryRef={carryRef}
            mobileShell={mobileShell}
            // (The first scene, the store before the game's bought: a
            // touch tilts the other way up and down, user.)
            invertTouchTilt={themeName === "tienda" && !readOwned()}
            // (Big Glutts once it's bought, as the switcher opens it: up
            // and down the other way, touch and mouse, user; the story's
            // first visit keeps its own, above.)
            invertTilt={themeName === "tienda" && readOwned()}
            initialMuted={muted}
            onMutedChange={(m) => {
              setMuted(m);
              sfxRef.current.setMuted(m);
            }}
          />
        </div>
        {/* The title hold: the den's into Neon once the Singularity's
            been visited (the television is the way in the first time);
            Neon's back out to the den only once the story's over (user:
            no long press on the masthead to teleport back to the den
            until everything's unlocked; till then the way home is the
            Singularity's BACK). The store has none. */}
        {((themeName === "standard" && singularityOpen) || (themeName === "neon" && ended)) && (
          <MastheadHoldZone
            zoneRef={holdZoneRef}
            onBegin={beginHold}
            onEnd={endHold}
            onHoldComplete={onHoldComplete}
            onTap={onMastheadTap}
          />
        )}
      </div>
      {connectWord && (
        <ConnectModal word={connectWord} onConfirm={beginTransition} onDismiss={() => setConnectWord(null)} sfx={sfxRef.current} />
      )}
      {transition && (
        <CrtTransitionOverlay direction={transition.direction} filterId={transition.filterId} onDone={onTransitionDone} sfx={sfxRef.current} />
      )}
      {cut && <StoryCut key={cut.kind + cut.to} cut={cut} onSwap={onCutSwap} onDone={onCutDone} sfx={sfxRef.current} />}
    </>
  );
}


applyBootstrapBoardSize();
applyBootstrapLaws();
bootRules = { board: getBoardDimensions(), laws: { ...ACTIVE_LAWS } };

// (?fresh: nothing mounts, so nothing's kept again before the page reloads.)
if (!FRESH) ReactDOM.createRoot(document.getElementById("root")).render(<UnifiedApp />);
