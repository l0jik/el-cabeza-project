/* Tienda's printed matter: the box, and the catalog's order form.

   - The box lid, when the page opens: the game as it sat on the shelf in
     1975, its lid photograph, the price sticker. "Open the box" lifts the
     lid off and brings up the store's sound (the page's first real tap,
     which is what a phone needs before it will play anything).
   - The order form, for custom rules: the kind of mail-order page the
     catalogs printed, with items to tick and quantities to fill in —
     pieces for each side (each with its photograph: tap it to take the
     piece up and turn it over in 3-D, tienda-showcase.js), the extra
     rules, the board (any width and length from 6 to 20 squares, with a
     diagram, and a plain warning if the pieces won't fit). "Place order &
     play" applies them for real (themes/rules-selections.js, shared with
     Lluvia) and begins the game; the rules then carry over to New Game
     until "Reset rules", and a finished game's "change the rules"
     brings the form back.

   Both are full-screen layers over the chassis while a game is awaiting
   Begin, drawn with createElement so the theme still imports in plain
   Node. They're laid out to fit anything from a small phone held either
   way to a desktop: sizes in clamp(), heights in dvh, the phone's notch
   and home bar kept clear (safe-area insets), every control at least
   44 px tall, and scroll inside the sheet when a short screen needs it. */

import { usePivotGuide } from "./pivot-guide.js";
import React from "react";
import {
  PIECE_OPTIONS, LAW_OPTIONS, ARCO_SIZES, SHOVE_SETTINGS, MAX_PIECES, MAX_MISSING_PAIRS, MIN_BOARD_DIM, MAX_BOARD_DIM, DEFAULT_BOARD_DIM,
  defaultSelections, cloneSelections, normalizeSelections, totalPieces, toggleLaw, beginCustomGame, piecesFit, minColsFor, boardLabel, clampDim,
  pieceTypeOf, lawWarnings, fillSpots, refreshSpots, missingCellsOf, holeCellsOf,
} from "./rules-selections.js";
import { SquarePicker, OpponentSection, CarbonCopies, OrderSlip, ORDER_PARTS_CSS } from "./tienda-order.js";
import { ensurePaper, ensureAgedPaper } from "./tienda-textures.js";
import { WoodPieceViewer, ensureWoodPhotos, woodPhoto, hasWoodShowcase } from "./tienda-showcase.js";
import boxArtUrl from "../assets/tienda/box-art.jpg";
import { singularitySeen, onJourneyChange, isCommercialOn, CLASSIC_PIECE_KEYS, specialOrderNoted, markSpecialOrderNoted } from "../engine/journey.js";

/* The classic game's order (engine/journey.js: the extras wait for the
   Singularity's first visit): the five pieces only, no laws, no cut
   squares or holes, and the one board, 10 x 10 (other boards wait for
   the Singularity too, user). */
function classicSelections(sel) {
  const n = storeSelections(sel);
  PIECE_OPTIONS.forEach((p) => { if (!CLASSIC_PIECE_KEYS.includes(p.key)) n.counts[p.key] = 0; });
  Object.keys(n.laws || {}).forEach((k) => { n.laws[k] = false; });
  n.missing = false;
  n.rows = n.cols = DEFAULT_BOARD_DIM;
  return normalizeSelections(n);
}
/* Any order in the store (and the den): never a shuffled start. That's
   Neon's anomaly, and Neon's alone (user). A carbon copy that had one
   comes back without it. */
function storeSelections(sel) {
  const n = cloneSelections(sel);
  n.random = false;
  return n;
}

const h = React.createElement;
const INK = "#2E2118", RED = "#A33F33", PAPER = "#EFE6CD";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";
const BODONI = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";

// The lid shows once per visit, not again after every New Game.
let lidDone = false;
/* The story's first visit to the store: the lid off and nothing tried
   for a while (looking round doesn't count), the dock's turning piece
   lights in the Singularity's blue, then, once it's opened, Try a Game
   does, until it's pressed (user). Once a story.
   A look in the dock doesn't count as trying it either (user: they tapped
   it once, went back out to look round, and it never lit): only a game
   begun ends it. The clock keeps what it had counted across the dock, the
   catalog and the rest, and once lit the blue grows the longer it's left
   (user: "the more that should... pulse larger"), over NUDGE_GROW_MS. */
let idleNudgeDone = false;
let idleSpent = 0; // ms of the clock already run (kept across pauses)
const IDLE_NUDGE_MS = 30000;
const NUDGE_GROW_MS = 90000;
const NUDGE_CSS = `
  html.td-idle-nudge { --td-nudge-g: 0; }
  html.td-idle-nudge [data-dock-piece] canvas { animation: tdPieceHalo 2.4s ease-in-out infinite; }
  .td-dock-aura { position: fixed; z-index: 14; pointer-events: none; border-radius: 50%;
    background: radial-gradient(circle, rgba(170,238,255,0.78) 0%, rgba(102,217,255,0.5) 28%, rgba(140,110,255,0.2) 50%, rgba(102,217,255,0) 70%);
    animation: tdPieceAura 2.4s ease-in-out infinite; transition: opacity 320ms ease; }
  @keyframes tdPieceAura { 0%, 100% { opacity: 0.4; transform: scale(0.86); } 50% { opacity: 1; transform: scale(calc(1.06 + 0.22 * var(--td-nudge-g, 0))); } }
  html.td-idle-nudge button.td-try-game, html.td-idle-nudge [data-testid="shell-begin"] { animation: tdTryGlow 2.4s ease-in-out infinite; }
  @keyframes tdPieceHalo {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 1.5px rgba(150,232,255,0.8)); }
    50% { filter: brightness(calc(1.14 + 0.12 * var(--td-nudge-g, 0))) drop-shadow(0 0 calc(3px + 5px * var(--td-nudge-g, 0)) rgba(210,246,255,1)); }
  }
  @keyframes tdTryGlow {
    0%, 100% { box-shadow: 0 0 0 1.5px rgba(102,217,255,0.75), 0 0 10px 2px rgba(102,217,255,0.45), 0 0 26px 6px rgba(140,110,255,0.22); }
    50% { box-shadow: 0 0 0 calc(2.5px + 1.5px * var(--td-nudge-g, 0)) rgba(170,236,255,1), 0 0 calc(20px + 16px * var(--td-nudge-g, 0)) calc(6px + 6px * var(--td-nudge-g, 0)) rgba(102,217,255,0.8), 0 0 calc(46px + 34px * var(--td-nudge-g, 0)) calc(14px + 12px * var(--td-nudge-g, 0)) rgba(140,110,255,0.4); }
  }
  @media (prefers-reduced-motion: reduce) {
    .td-dock-aura { animation: none; }
    html.td-idle-nudge [data-dock-piece] canvas { animation: none; filter: drop-shadow(0 0 2px rgba(150,232,255,0.95)); }
    html.td-idle-nudge button.td-try-game, html.td-idle-nudge [data-testid="shell-begin"] { animation: none; box-shadow: 0 0 0 2px rgba(102,217,255,0.9), 0 0 16px 4px rgba(102,217,255,0.55); }
  }
`;
// Nova's "Start the story over" (apps/unified.jsx): the box is back on the
// shelf, lid and all.
export function resetLid() { lidDone = false; idleNudgeDone = false; idleSpent = 0; confusedAtClerk = false; orderInHand = null; keptOrder = null; deliverHome = null; }
/* After the whole story, back at the store: another copy, please. The
   clerk has never heard of it, the manager has never heard of it
   (ClerkScene), and the store's purchase becomes "Go home, confused."
   (tienda.js). */
let confusedAtClerk = false;
export const clerkConfused = () => confusedAtClerk;
/* The first time through (after the commercial, until the story starts
   over; story.guided), the order form at home is a special order to take
   to the store: "Order it at Big Glutts ›" stamps it and goes (with the
   order in hand: orderInHand), where the clerk has never heard of it.
   Going home confused with it (deliverHome), the pieces are somehow on
   the table already, the game set up from the order; the form keeps what
   was ordered (keptOrder) from then on. */
let orderInHand = null, keptOrder = null, deliverHome = null;
// Home from the clerk: with the order in hand, it's waiting on the table.
function goHomeConfused(story) {
  const withOrder = !!orderInHand;
  if (withOrder) { deliverHome = orderInHand; orderInHand = null; }
  story.onGoHomeConfused({ withOrder });
}

/* ------------------------------------------------------------ setup extras */

/* In Nova's story (x.story, apps/unified.jsx) the same printed matter
   serves two places. The store ("store"): the game on the shelf, only the
   classic game; Custom rules becomes the catalog's page of the five
   original pieces (PieceCatalog, look only), and the game can be bought
   and taken home (story.onPurchase). Home ("home", the den): no box lid
   (it's open on the coffee table), and the whole order form, every piece
   and rule. Without x.story (Tienda's own page) nothing changes. */
export function useSetupExtras(x) {
  const story = x.story || null;
  const store = !!story && story.mode === "store";
  const home = !!story && story.mode === "home";
  /* How this place was reached, read once: false for the page opening
     here, "cut" by one of the story's scene changes, "fresh" by "Start
     the story over". Only the story's start has the lid on the box: back
     at the store the game is already out on the counter. */
  const arrival = React.useRef(undefined);
  if (arrival.current === undefined) arrival.current = story && story.arrived ? story.arrived() : false;
  // (After the story's end the store is one of the realities, the game
  // out on the counter: no lid either, and the gate's two buttons.)
  if (store && (arrival.current === "cut" || (story.realities && story.realities()))) lidDone = true;
  const [overlay, setOverlay] = React.useState(() => (x.awaitingBegin && !lidDone && !home ? "lid" : null));
  /* Special orders (user): until the Singularity's first visit nothing can
     be changed anywhere; the catalog's page of the five pieces stands in
     for Custom rules, a faded "Special orders: by arrangement" at its
     foot. After it (engine/journey.js, until the story starts over) the
     order form is open: the button is Custom rules again (the story's
     store keeps its catalog, whose foot line is then the way in), and a
     note says so once. */
  const [specialOpen, setSpecialOpen] = React.useState(singularitySeen);
  // (The den's commercial says it first: the note waits for it to end.)
  const [adOn, setAdOn] = React.useState(isCommercialOn);
  React.useEffect(() => onJourneyChange((seen) => { setSpecialOpen(seen); setAdOn(isCommercialOn()); }), []);
  const [specialNote, setSpecialNote] = React.useState(false);
  const [noteGlow, setNoteGlow] = React.useState(false);
  // The note stays until it's dismissed (a tap anywhere else) or taken up
  // (a tap on it: the order form), and only then is it remembered as seen.
  React.useEffect(() => {
    if (!specialOpen || adOn) return undefined;
    if (specialOrderNoted()) return undefined;
    setSpecialNote(true);
    return () => setSpecialNote(false);
  }, [specialOpen, adOn]);
  const dismissSpecialNote = React.useCallback(() => {
    setSpecialNote(false);
    markSpecialOrderNoted();
  }, []);
  React.useEffect(() => {
    if (!specialNote) return undefined;
    // (The first time through, it's the way into the whole special-order
    // scene: it stays until it's taken up, user.)
    // A tap off it then lights it in the Singularity's blue, to show where
    // to go (user: only then; a tap straight on it needs no prompting).
    const guidedNow = () => home && story.guided && story.guided();
    const onNote = (e) => !!(e.target && e.target.closest && e.target.closest(".td-special-note"));
    /* The first time through, nothing else on the screen can be touched
       while it's up (user: only the order form): every tap, drag, wheel
       and key off it is stopped at the window, before the board, the
       camera, the room or the corner buttons see it; and each tap off it
       makes it throb, harder than its breathing, to say where to go
       (user). (The camera stays square on the board, as the set left it:
       taps that got through had been turning it.) */
    const throb = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.querySelector(".td-special-note");
        if (!el) return;
        el.classList.remove("td-throb"); void el.offsetWidth; el.classList.add("td-throb");
      }));
    };
    const block = (e) => {
      if (!guidedNow() || onNote(e)) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.cancelable && e.type !== "pointermove") e.preventDefault();
      if (e.type === "pointerdown" || (e.type === "touchstart" && !window.PointerEvent)) { setNoteGlow(true); throb(); }
    };
    const blockKey = (e) => {
      if (!guidedNow()) return;
      const a = document.activeElement;
      if (a && a.closest && a.closest(".td-special-note") && (e.key === "Enter" || e.key === " " || e.key === "Tab")) return;
      if (e.key === "Tab") return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    const BLOCK = ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "touchstart", "touchmove", "touchend", "wheel", "mousedown", "mouseup", "gesturestart"];
    BLOCK.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
    window.addEventListener("keydown", blockKey, true);
    const onDown = (e) => {
      if (guidedNow()) return;
      if (!onNote(e)) dismissSpecialNote();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      BLOCK.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));
      window.removeEventListener("keydown", blockKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [specialNote, dismissSpecialNote]);
  /* The story's first moment (Nova, the box lid on the store's counter):
     "Open the box" is the lid's only button and the only thing that takes
     a tap, besides the corner's full-screen switch (user); it's plain,
     not dimmed or lit. Every other tap, drag, wheel and key is stopped at
     the window. (A tap anywhere still takes the page full screen, and the
     corner's switch sits over the lid, user.) */
  const lidLocked = store && !!story && overlay === "lid";
  React.useEffect(() => {
    if (!lidLocked) return undefined;
    const allowed = (e) => !!(e.target && e.target.closest && e.target.closest('[data-testid="tienda-open-box"], [data-fullscreen-toggle]'));
    const block = (e) => {
      if (allowed(e)) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.cancelable && e.type !== "pointermove") e.preventDefault();
      /* (A touch stopped at its start never becomes a click, so on a
         phone the page is asked to go full screen at the touch's end, a
         moment the browser lets it; a mouse, at its click.) */
      const activation = e.type === "click" || e.type === "touchend" || (e.type === "pointerup" && e.pointerType !== "mouse");
      if (activation && e.isTrusted && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    const blockKey = (e) => {
      const a = document.activeElement;
      if (e.key === "Tab" || (a && a.closest && a.closest('[data-testid="tienda-open-box"], [data-fullscreen-toggle]'))) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    const EVENTS = ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "touchstart", "touchmove", "touchend", "wheel", "mousedown", "mouseup", "gesturestart"];
    EVENTS.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
    window.addEventListener("keydown", blockKey, true);
    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));
      window.removeEventListener("keydown", blockKey, true);
    };
  }, [lidLocked]);
  /* The idle nudge (idleNudgeDone above): the clock runs while the lid's
     off and nothing's open over the table (the dock open or shut alike),
     keeping what it had counted through any pause; only a game begun
     means it isn't needed. Once lit, it stays (and grows) until a game
     begins: on the piece while the dock is shut, on Try a Game while it's
     open (and on the phone bar's button). */
  const [idleNudge, setIdleNudge] = React.useState(false);
  const nudgeHere = store && arrival.current !== "cut" && !(story.after && story.after()) && !(story.realities && story.realities());
  React.useEffect(() => {
    if (!nudgeHere || idleNudgeDone || idleNudge) return undefined;
    if (!x.awaitingBegin) { if (lidDone) idleNudgeDone = true; return undefined; }
    if (overlay) return undefined;
    const ms = typeof window.__EC_TEST_NUDGE_MS__ === "number" ? window.__EC_TEST_NUDGE_MS__ : IDLE_NUDGE_MS;
    const t0 = performance.now();
    const id = setTimeout(() => setIdleNudge(true), Math.max(0, ms - idleSpent));
    return () => { clearTimeout(id); idleSpent += performance.now() - t0; };
  }, [nudgeHere, idleNudge, x.awaitingBegin, overlay]);
  React.useEffect(() => {
    if (idleNudge && !x.awaitingBegin) { idleNudgeDone = true; setIdleNudge(false); }
  }, [idleNudge, x.awaitingBegin]);
  React.useEffect(() => {
    if (!idleNudge) return undefined;
    let css = document.getElementById("td-nudge-css");
    if (!css) { css = document.createElement("style"); css.id = "td-nudge-css"; css.textContent = NUDGE_CSS; document.head.appendChild(css); }
    document.documentElement.classList.add("td-idle-nudge");
    /* The halo: the dock's mount is clipped to the piece's outline (for
       taps), so the glow round it is its own layer just behind, kept on
       the piece as it moves and gone while the dock is open. */
    const aura = document.createElement("div");
    aura.className = "td-dock-aura";
    aura.dataset.testid = "tienda-dock-aura";
    document.body.appendChild(aura);
    let raf = 0;
    const litAt = performance.now();
    const growMs = typeof window.__EC_TEST_NUDGE_GROW_MS__ === "number" ? window.__EC_TEST_NUDGE_GROW_MS__ : NUDGE_GROW_MS;
    const root = document.documentElement;
    let lastG = -1;
    const follow = () => {
      // How far it's grown (0 when lit, 1 after growMs), eased in.
      const u = Math.min(1, (performance.now() - litAt) / growMs), g = u * u * (3 - 2 * u);
      if (Math.abs(g - lastG) > 0.005) { lastG = g; root.style.setProperty("--td-nudge-g", g.toFixed(3)); aura.dataset.grow = g.toFixed(2); }
      const m = document.querySelector("[data-dock-piece]");
      const r = m && m.getBoundingClientRect();
      if (r && r.width) {
        const d = Math.min(r.width, r.height) * (0.92 + 0.95 * g);
        aura.style.left = `${r.left + r.width / 2 - d / 2}px`;
        aura.style.top = `${r.top + r.height / 2 - d / 2}px`;
        aura.style.width = aura.style.height = `${d}px`;
        const ms = getComputedStyle(m);
        aura.style.visibility = +ms.opacity > 0.5 && ms.display !== "none" ? "visible" : "hidden";
      } else aura.style.visibility = "hidden";
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => { cancelAnimationFrame(raf); aura.remove(); root.classList.remove("td-idle-nudge"); root.style.removeProperty("--td-nudge-g"); };
  }, [idleNudge]);
  const selRef = React.useRef(null);
  if (!selRef.current) selRef.current = keptOrder ? cloneSelections(keptOrder) : defaultSelections();
  // Home, confused, with the order: the pieces are on the table already
  // (as if they'd been in the box all along): the game set up from it,
  // once the scene change has faded up.
  React.useEffect(() => {
    if (!home || !deliverHome) return undefined;
    const sel = deliverHome;
    deliverHome = null;
    const id = setTimeout(() => beginCustomGame(sel, x, (s2) => { selRef.current = s2; setOverlay("order"); }, { labels: TIENDA_VARIANT_LABELS }), 2400);
    return () => clearTimeout(id);
  }, []);
  React.useEffect(() => { if (!x.awaitingBegin && overlay && overlay !== "clerk") setOverlay(null); }, [x.awaitingBegin]);
  React.useEffect(() => {
    if (!store) return undefined;
    const onClerk = () => setOverlay("clerk");
    window.addEventListener("el-cabeza:clerk", onClerk);
    // Back after the whole story there's no game here to play: the clerk
    // comes over on his own a moment after you walk in (once the scene
    // change has faded up).
    // (And always when you walk in with a special order stamped at home:
    // that trip is for him, whatever else the story's record says.)
    const auto = ((story.after && story.after()) || orderInHand) && !confusedAtClerk ? setTimeout(onClerk, 3200) : null;
    return () => { window.removeEventListener("el-cabeza:clerk", onClerk); if (auto) clearTimeout(auto); };
  }, []);
  React.useEffect(() => { ensurePaper(); ensureAgedPaper(); }, []);
  // The story fades this place's sound out as it leaves (story.bindAudio).
  React.useEffect(() => { if (story && story.bindAudio) story.bindAudio(x.audio); }, []);
  /* Arriving by a scene change, the place's own sound comes up with it:
     the store's (unless the lid is on, whose "Open the box" brings it, as
     on the first visit) or the room's. If the browser holds the sound back
     until a tap, the next tap brings it. */
  React.useEffect(() => {
    if (!arrival.current || arrival.current === "fresh" || !x.audio) return undefined;
    const start = () => {
      try {
        if (store && x.audio.startStore) x.audio.startStore();
        else if (home && x.audio.ensureStarted) x.audio.ensureStarted();
      } catch (e) { /* no sound here */ }
    };
    start();
    document.addEventListener("pointerdown", start, { once: true, capture: true });
    return () => document.removeEventListener("pointerdown", start, { capture: true });
  }, []);
  return {
    ...x,
    story,
    // Back at the store after the story: no game on the table (the phone
    // bar shows only the purchase).
    noGame: !!(store && story.after && story.after()),
    // Over the clerk's scene the corner's full-screen switch still works
    // (user: couldn't maximize during the dialogue); the other corner
    // buttons are hidden there (STORY_CSS).
    // (Over the box lid too: it's the one other thing there that takes a tap.)
    cornerControlsZ: overlay === "clerk" || overlay === "lid" ? 1250 : undefined,
    tiendaOverlay: overlay,
    openOrderForm: () => { x.audio && x.audio.playRulesOpen && x.audio.playRulesOpen(); if (specialNote && !store && specialOpen) dismissSpecialNote(); setOverlay(store || !specialOpen ? "catalog" : "order"); },
    openCustomRules: () => { if (specialOpen) { if (specialNote) dismissSpecialNote(); setOverlay("order"); } },
    closeOverlay: () => setOverlay(null),
    reopenOrder: (sel) => { if (sel) selRef.current = sel; setOverlay(store || !specialOpen ? "catalog" : "order"); },
    specialOpen,
    specialNote,
    noteGlow,
    lidLocked,
    dismissSpecialNote,
    selRef,
  };
}

export function renderExtraOverlays(x) {
  if (!x) return null;
  const store = !!x.story && x.story.mode === "store";
  // In a game: the sales slip of what was ordered. At home only for a game
  // with rules ordered from the catalog (the carbon copy of the order); a
  // classic game there has none.
  if (x.isPlaying && !x.awaitingBegin) {
    const home = !!x.story && x.story.mode === "home";
    if (home && !(x.currentVariants && x.currentVariants.length)) return null;
    return h(OrderSlip, { key: "slip", groups: x.currentVariants, audio: x.audio, onPurchase: store ? x.story.onPurchase : null });
  }
  if (store && x.tiendaOverlay === "clerk") {
    return h(ClerkScene, {
      key: "clerk", audio: x.audio,
      onStay: () => x.closeOverlay(),
      onGoHome: () => { x.closeOverlay(); goHomeConfused(x.story); },
    });
  }
  // Stayed a while after the scene, in the store with no game in it: the
  // way home, a slip at the top.
  if (store && x.story.after && x.story.after() && confusedAtClerk && !x.tiendaOverlay) {
    return h("div", { key: "leave", className: "td-offer", "data-testid": "tienda-leave", role: "status" },
      h(Style),
      h("span", null, "Nobody here has heard of it."),
      h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-leave-go-home", onClick: () => { x.audio && x.audio.playSelect && x.audio.playSelect(); goHomeConfused(x.story); } }, orderInHand ? "Go home, confused\u2026 with your form" : "Go home, confused."));
  }
  // A game in the store played to the end (or ended): the clerk's offer.
  if (store && !x.awaitingBegin && x.game && (x.game.status === "finished" || x.game.status === "ended")) return h(PurchaseOffer, { key: "offer", story: x.story, audio: x.audio });
  const note = x.specialNote && x.awaitingBegin && (!x.tiendaOverlay || x.tiendaOverlay === "lid")
    ? h("button", {
        type: "button", key: "special-note", "data-testid": "tienda-special-note",
        // The first time through, lit in the Singularity's blue once a tap
        // has missed it: it's where the special-order scene starts (user).
        className: x.noteGlow ? "td-special-note td-sing-glow" : "td-special-note",
        title: "Open the catalog's order form",
        // Taken up: straight to the order form (from the box's lid too).
        onClick: () => {
          x.dismissSpecialNote();
          if (x.tiendaOverlay === "lid") { lidDone = true; x.audio && x.audio.startStore && x.audio.startStore(); }
          x.audio && x.audio.playRulesOpen && x.audio.playRulesOpen();
          x.openCustomRules();
        },
      },
        h(Style),
        h("b", null, "Special orders now open"),
        h("span", null, "New pieces, new laws, new boards, from the catalog."),
        h("span", { className: "td-special-go" }, "Order from the catalog \u203a"))
    : null;
  if (!x.tiendaOverlay || !x.awaitingBegin) return note;
  if (x.tiendaOverlay === "lid") {
    return [h(BoxLid, {
      key: "lid",
      locked: !!x.lidLocked,
      onOpen: () => { lidDone = true; x.audio && x.audio.startStore && x.audio.startStore(); x.closeOverlay(); },
      onOrder: () => { lidDone = true; x.audio && x.audio.startStore && x.audio.startStore(); x.openOrderForm(); },
      orderLabel: store || !x.specialOpen ? "See the pieces" : "Custom rules",
      audio: x.audio,
    }), note];
  }
  if (x.tiendaOverlay === "catalog") {
    return h(PieceCatalog, {
      key: "catalog",
      audio: x.audio,
      onClose: () => { x.audio && x.audio.playRulesClose && x.audio.playRulesClose(); x.closeOverlay(); },
      onPurchase: store ? () => { x.closeOverlay(); x.story.onPurchase(); } : null,
      specialOpen: !!x.specialOpen,
      onSpecialOrder: () => { x.audio && x.audio.playSelect && x.audio.playSelect(); x.openCustomRules(); },
    });
  }
  // Where the order goes: the first time through, to the store (guided);
  // after that, at home, it's delivered; in the store, the demonstration.
  const guided = !!(x.story && x.story.mode === "home" && x.story.guided && x.story.guided() && x.story.onOrderAtStore);
  const where = guided ? "guided" : x.story && x.story.mode === "home" ? "home" : "store";
  return h(OrderForm, {
    key: "order",
    initial: x.selRef.current,
    onChange: (s) => { x.selRef.current = s; },
    onCancel: () => { x.audio && x.audio.playRulesClose && x.audio.playRulesClose(); x.closeOverlay(); },
    onPlace: guided
      ? (sel) => { orderInHand = cloneSelections(sel); keptOrder = cloneSelections(sel); x.story.onOrderAtStore(); }
      : (sel) => { if (where === "home") keptOrder = cloneSelections(sel); beginCustomGame(sel, x, (s) => x.reopenOrder && x.reopenOrder(s), { labels: TIENDA_VARIANT_LABELS }); },
    audio: x.audio,
    where,
    x,
  });
}

/* ------------------------------------------------------------ shared look */

const CSS = `
  .td-layer { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
    padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    background: rgba(26,18,11,0.62); overflow: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
    transition: background 0.7s ease; }
  .td-layer * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .td-btn { min-height: 48px; padding: 0 18px; border-radius: 2px; cursor: pointer; font: 800 clamp(13px, 1.4vw + 9px, 15px)/1 ${FRANKLIN};
    letter-spacing: 0.1em; text-transform: uppercase; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: transform 0.08s ease, background-color 0.15s ease; }
  .td-btn:active { transform: translateY(1px); }
  .td-btn:focus-visible, .td-check input:focus-visible + .td-box, .td-qty button:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
  .td-primary { background: ${RED}; color: #F4EEDC; border: 1px solid #6B2A22; box-shadow: 0 2px 0 #5A231C; }
  .td-primary:disabled { background: #9C8E7C; border-color: #7A6C5A; box-shadow: none; cursor: default; }
  .td-plain { background: transparent; color: ${INK}; border: 1.5px solid ${INK}; }
  @media (hover: hover) { .td-primary:not(:disabled):hover { background: #B24A3C; } .td-plain:hover { background: rgba(46,33,24,0.08); } }

  /* The lid. Landscape: photograph left, lettering right. Tall screens:
     photograph on top. */
  .td-lid { position: relative; width: min(900px, 100%); display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    background: #3B2618; color: #EFE4CB; border-radius: 3px; box-shadow: 0 2px 0 #24160c, 0 28px 70px rgba(10,6,3,0.6);
    transform-origin: 50% 0%; transition: transform 0.85s cubic-bezier(0.55, 0, 0.3, 1), opacity 0.6s ease 0.25s; }
  .td-lid::before { content: ""; position: absolute; inset: 7px; border: 1px solid rgba(211,161,59,0.55); pointer-events: none; }
  .td-photo { position: relative; margin: 18px 0 18px 18px; border: 3px solid #D3A13B; min-height: 240px; background: #5C3A21 center / cover no-repeat; }
  .td-lettering { padding: clamp(18px, 3vw, 34px); display: flex; flex-direction: column; justify-content: center; gap: clamp(8px, 1.4vh, 14px); }
  .td-title { margin: 0; font: 700 clamp(40px, 6.2vw, 72px)/0.95 ${BODONI}; letter-spacing: 0.02em; color: #EFE4CB; }
  .td-tag { font: italic 500 clamp(15px, 1.6vw, 19px)/1.3 ${BODONI}; color: #E3D3B2; }
  .td-rule { height: 3px; width: 64%; background: #D3A13B; }
  .td-small { font: 700 clamp(11px, 1vw, 12.5px)/1.5 ${FRANKLIN}; letter-spacing: 0.14em; text-transform: uppercase; color: #D3A13B; }
  .td-body { font: 400 clamp(13px, 1.1vw, 15px)/1.5 ${FRANKLIN}; color: #E9DCC0; max-width: 34em; }
  .td-sticker { position: absolute; top: 14px; right: 16px; background: #F4EFE2; color: #6B2A22; padding: 6px 10px 5px; font: 700 clamp(15px, 1.5vw, 18px)/1 ${COURIER};
    transform: rotate(3deg); box-shadow: 0 1px 2px rgba(0,0,0,0.35); border: 1px dashed rgba(107,42,34,0.35); }
  .td-lid-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
  .td-lid-actions .td-plain { color: #EFE4CB; border-color: rgba(239,228,203,0.8); }
  @media (hover: hover) { .td-lid-actions .td-plain:hover { background: rgba(239,228,203,0.1); } }
  .td-opening .td-lid { transform: perspective(1400px) translateY(-18vh) rotateX(38deg) scale(1.04); opacity: 0; }
  .td-opening { background: rgba(26,18,11,0); pointer-events: none; }
  @media (max-aspect-ratio: 5/6), (max-width: 620px) {
    .td-lid { grid-template-columns: minmax(0, 1fr); }
    .td-photo { margin: 14px 14px 0; min-height: 0; height: min(34dvh, 58vw); }
    .td-lid-actions .td-btn { flex: 1 1 100%; }
  }
  @media (max-height: 460px) and (orientation: landscape) {
    .td-photo { min-height: 0; }
    .td-title { font-size: clamp(30px, 5vw, 44px); }
    .td-body { display: none; }
  }

  /* The order form: a catalog page, cream stock, printed in brown-black
     with a red second colour, filled in by hand. */
  .td-form { position: relative; width: min(760px, 100%); max-height: calc(100dvh - 24px); display: flex; flex-direction: column;
    background-color: ${PAPER}; background-image: var(--tienda-paper); color: ${INK}; border-radius: 2px;
    box-shadow: 0 1px 0 #d8ccb0, 0 24px 60px rgba(10,6,3,0.55); }
  /* Kept since 1975 (user: "a slightly dated look"): the stock gone
     cream-yellow, darker toward the edges where the air got at it (and
     the top corner that was thumbed), foxed here and there, the gutter's
     shadow down the bound side; the ink soft and a touch spread into the
     fibres, the solids not quite solid, the photographs faded warm. */
  .td-form {
    background-color: #EBDDBC;
    background-image:
      linear-gradient(90deg, rgba(120,86,44,0.16), rgba(120,86,44,0.05) 14px, transparent 34px),
      radial-gradient(ellipse 50% 32% at 100% 0%, rgba(170,120,52,0.16), transparent 72%),
      radial-gradient(ellipse 45% 30% at 0% 100%, rgba(160,114,50,0.12), transparent 72%),
      var(--tienda-paper, linear-gradient(transparent, transparent));
    background-size: auto, auto, auto, auto;
    box-shadow: inset 0 0 0 1px rgba(128,92,44,0.18), inset 0 0 26px rgba(168,122,56,0.30), inset 0 0 80px rgba(180,138,70,0.12),
      0 1px 0 #d2c19c, 0 24px 60px rgba(10,6,3,0.55);
    text-shadow: 0 0 0.5px rgba(46,33,24,0.55);
  }
  /* The foxing and the uneven yellowing are in the paper, so they ride
     with it as the page scrolls (attachment: local), not on the frame. */
  .td-form .td-form-scroll { background-image: var(--tienda-aged, none); background-size: 384px 384px; background-attachment: local; }
  .td-form .td-sec-h { background-color: #33251B; background-image: var(--tienda-ink-wear, none); background-size: 160px 160px; text-shadow: none; }
  /* The foot of the page, where the totals and buttons stay: the same
     aged stock, toned at the bottom edge, not a clean new strip. */
  .td-form .td-foot {
    background-color: rgba(233,219,186,0.97);
    background-image:
      linear-gradient(90deg, rgba(120,86,44,0.14), transparent 34px),
      radial-gradient(ellipse 48% 90% at 0% 100%, rgba(160,114,50,0.14), transparent 72%),
      var(--tienda-aged, linear-gradient(transparent, transparent));
    background-size: auto, auto, 384px 384px;
    background-position: 0 0, 0 0, 0 100%;
    box-shadow: inset 0 -16px 24px -14px rgba(160,112,48,0.32);
  }
  .td-form .td-primary { background-color: #9A3B30; text-shadow: none; }
  .td-form .td-photo-btn img { filter: sepia(0.28) saturate(0.82) contrast(0.94) brightness(1.02); }
  /* Special orders at the catalog's foot: faded type until they open. */
  .td-special { display: block; margin: 16px 4px 6px; padding: 10px 0 2px; border-top: 1px dashed rgba(46,33,24,0.35);
    font: 400 12.5px/1.45 ${COURIER}; color: rgba(46,33,24,0.42); text-align: left; background: transparent; }
  .td-special b { font-weight: 700; letter-spacing: 0.04em; }
  button.td-special-open { all: unset; display: block; box-sizing: border-box; width: calc(100% - 8px); margin: 16px 4px 6px; padding: 10px 0 2px;
    border-top: 1px dashed rgba(163,63,51,0.5); font: 400 12.5px/1.45 ${COURIER}; color: ${INK}; cursor: pointer; }
  button.td-special-open u { color: ${RED}; font-weight: 700; }
  button.td-special-open:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
  /* The one-time note that special orders are open. */
  .td-special-note { position: fixed; left: 50%; top: calc(14px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 1250;
    max-width: min(92vw, 460px); padding: 9px 14px; background: #EFE6CD; color: ${INK}; border: 1.5px solid ${INK};
    box-shadow: 0 6px 18px rgba(10,6,3,0.4); font: 400 13px/1.4 ${COURIER}; cursor: pointer; animation: tdNoteIn 0.5s ease both; }
  .td-special-note { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
  .td-special-note b { color: ${RED}; letter-spacing: 0.06em; text-transform: uppercase; font-family: ${FRANKLIN}; font-size: 13px; }
  .td-special-note .td-special-go { margin-top: 4px; padding: 5px 12px; border: 1.5px solid ${INK}; background: ${INK}; color: #EFE6CD;
    font: 700 11px/1 ${FRANKLIN}; letter-spacing: 0.1em; text-transform: uppercase; }
  .td-special-note:hover .td-special-go, .td-special-note:focus-visible .td-special-go { background: ${RED}; border-color: ${RED}; }
  @keyframes tdNoteIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  /* The Singularity's blue, round what leads into the special order the
     first time through (the note, the form's button): a halo that breathes. */
  .td-special-note.td-sing-glow { animation: tdSingGlow 2.4s ease-in-out infinite; }
  button.td-btn.td-sing-glow { animation: tdSingGlow 2.4s ease-in-out infinite; }
  /* The story's lid: "Open the box" waits (a tap on it is a tap that
     missed); "See the pieces", lit, throbs at each miss. */
  button.td-btn.td-locked { opacity: 0.45; cursor: not-allowed; }
  button.td-btn.td-sing-glow.td-throb { animation: tdBtnThrob 1s cubic-bezier(0.2, 0.7, 0.3, 1) both, tdSingGlow 2.4s ease-in-out 1s infinite; }
  @keyframes tdBtnThrob {
    0% { transform: scale(1); box-shadow: 0 0 0 2px rgba(150,232,255,0.95), 0 0 18px 5px rgba(102,217,255,0.7), 0 0 42px 12px rgba(140,110,255,0.36); }
    22% { transform: scale(1.1); box-shadow: 0 0 0 4px rgba(200,244,255,1), 0 0 30px 10px rgba(102,217,255,0.95), 0 0 80px 28px rgba(140,110,255,0.6); }
    48% { transform: scale(0.98); }
    68% { transform: scale(1.03); }
    100% { transform: scale(1); box-shadow: 0 0 0 1.5px rgba(102,217,255,0.75), 0 0 10px 2px rgba(102,217,255,0.45), 0 0 26px 6px rgba(140,110,255,0.22); }
  }
  @media (prefers-reduced-motion: reduce) { button.td-btn.td-sing-glow.td-throb { animation: none; } }
  /* A tap anywhere else, the first time through: a throb, higher and
     brighter than the breathing (user), then back to breathing. */
  .td-special-note.td-sing-glow.td-throb { animation: tdSingThrob 1s cubic-bezier(0.2, 0.7, 0.3, 1) both, tdSingGlow 2.4s ease-in-out 1s infinite; }
  @keyframes tdSingThrob {
    0% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 2px rgba(150,232,255,0.95), 0 0 18px 5px rgba(102,217,255,0.7), 0 0 42px 12px rgba(140,110,255,0.36), 0 6px 18px rgba(10,6,3,0.4); }
    22% { transform: translateX(-50%) scale(1.09); box-shadow: 0 0 0 4px rgba(200,244,255,1), 0 0 34px 12px rgba(102,217,255,0.95), 0 0 90px 34px rgba(140,110,255,0.6), 0 10px 24px rgba(10,6,3,0.45); }
    48% { transform: translateX(-50%) scale(0.985); }
    68% { transform: translateX(-50%) scale(1.03); box-shadow: 0 0 0 2.5px rgba(170,236,255,0.95), 0 0 24px 8px rgba(102,217,255,0.8), 0 0 56px 18px rgba(140,110,255,0.42), 0 6px 18px rgba(10,6,3,0.4); }
    100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 1.5px rgba(102,217,255,0.75), 0 0 10px 2px rgba(102,217,255,0.45), 0 0 26px 6px rgba(140,110,255,0.22), 0 6px 18px rgba(10,6,3,0.4); }
  }
  @keyframes tdSingGlow {
    0%, 100% { box-shadow: 0 0 0 1.5px rgba(102,217,255,0.75), 0 0 10px 2px rgba(102,217,255,0.45), 0 0 26px 6px rgba(140,110,255,0.22), 0 6px 18px rgba(10,6,3,0.4); }
    50% { box-shadow: 0 0 0 2px rgba(150,232,255,0.95), 0 0 18px 5px rgba(102,217,255,0.7), 0 0 42px 12px rgba(140,110,255,0.36), 0 6px 18px rgba(10,6,3,0.4); }
  }
  /* Waiting for something to be ordered: dimmer, the glow slower. */
  button.td-btn.td-wait { opacity: 0.62; cursor: not-allowed; animation-duration: 4s; }
  .td-nudge { flex-basis: 100%; margin: 8px 0 0; padding: 7px 10px; background: #FFF6D8; color: ${INK}; border: 1.5px solid ${RED};
    font: 700 12.5px/1.35 ${FRANKLIN}; text-align: center; animation: tdNudge 0.35s ease both; }
  @keyframes tdNudge { 0% { opacity: 0; transform: translateX(0); } 20% { opacity: 1; transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 100% { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .td-special-note.td-sing-glow, .td-special-note.td-sing-glow.td-throb, button.td-btn.td-sing-glow { animation: none; box-shadow: 0 0 0 2px rgba(102,217,255,0.9), 0 0 16px 4px rgba(102,217,255,0.55); } .td-nudge { animation: none; } }
  .td-form-scroll { position: relative; overflow: auto; -webkit-overflow-scrolling: touch; padding: clamp(14px, 3vw, 28px) clamp(14px, 3.4vw, 32px) 8px; }
  .td-form-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 6px 16px; border-bottom: 3px solid ${INK}; padding-bottom: 8px; }
  .td-form-title { margin: 0; font: 900 clamp(26px, 4.4vw, 40px)/0.95 ${FRANKLIN}; letter-spacing: 0.02em; }
  .td-form-sub { font: 700 clamp(10.5px, 1.2vw, 12px)/1.4 ${FRANKLIN}; letter-spacing: 0.14em; text-transform: uppercase; color: ${RED}; }
  .td-form-note { font: 400 clamp(12px, 1.2vw, 13px)/1.4 ${COURIER}; }
  .td-sec { margin-top: 18px; }
  .td-sec-h { display: flex; align-items: baseline; gap: 10px; font: 800 clamp(13px, 1.5vw, 15px)/1.2 ${FRANKLIN}; letter-spacing: 0.12em; text-transform: uppercase;
    background: ${INK}; color: ${PAPER}; padding: 6px 10px; }
  .td-sec-h { flex-wrap: wrap; }
  .td-sec-h small { font: 400 12px/1.3 ${COURIER}; letter-spacing: 0; text-transform: none; opacity: 0.85; }
  @media (max-width: 560px) { .td-sec-h small { flex: 1 1 100%; } }
  .td-row { display: grid; grid-template-columns: 64px 5.2em minmax(0, 1fr) 4em auto; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid rgba(46,33,24,0.3); min-height: 52px; }
  /* A piece's photograph: tap it to inspect the piece in 3-D. */
  .td-photo-btn { position: relative; width: 64px; height: 58px; padding: 0; border: none; background: transparent; cursor: zoom-in; border-radius: 2px; }
  .td-photo-btn img { width: 100%; height: 100%; object-fit: contain; display: block; transition: transform 0.15s ease; }
  .td-photo-btn .td-photo-wait { position: absolute; inset: 14px 16px; border: 1.5px dashed rgba(46,33,24,0.3); }
  .td-photo-btn .td-3d { position: absolute; right: 0; bottom: 2px; font: 800 9px/1 ${FRANKLIN}; font-style: normal; letter-spacing: 0.06em; color: ${RED}; background: ${PAPER}; padding: 1px 2px; }
  .td-photo-btn:focus-visible { outline: 3px solid ${RED}; outline-offset: 1px; }
  @media (hover: hover) { .td-photo-btn:hover img { transform: translateY(-2px) scale(1.05); } }
  /* Taken up: its place on the page is an empty, dashed spot. */
  .td-photo-btn[data-viewing="true"] img, .td-photo-btn[data-viewing="true"] .td-3d { visibility: hidden; }
  .td-photo-btn[data-viewing="true"] { outline: 1.5px dashed rgba(46,33,24,0.55); outline-offset: -5px; }
  /* The board: a diagram, and its width and length. */
  .td-board { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 18px; align-items: center; padding: 10px 4px 4px; }
  .td-diagram { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 110px; }
  .td-diagram-board { position: relative; box-sizing: content-box !important; border: 4px solid #4E2F1A; box-shadow: 0 1px 2px rgba(20,12,6,0.35);
    background: repeating-conic-gradient(#C49A62 0 25%, #6E4428 0 50%); transition: width 0.2s ease, height 0.2s ease; }
  .td-home { position: absolute; left: 0; right: 0; }
  .td-home-far { top: 0; background: rgba(244,232,205,0.6); }
  .td-home-near { bottom: 0; background: rgba(36,19,10,0.6); }
  .td-diagram figcaption { font: 700 13px/1 ${COURIER}; }
  .td-dim { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; border-bottom: 1px solid rgba(46,33,24,0.3); }
  .td-fit { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin: 4px 0; padding: 8px 10px;
    border: 1.5px solid ${RED}; color: ${RED}; font: 700 13px/1.35 ${COURIER}; background: rgba(163,63,51,0.06); }
  .td-fit .td-btn { min-height: 44px; color: ${RED}; border-color: ${RED}; font-size: 12px; }
  .td-cat { font: 400 12px/1.2 ${COURIER}; color: #6E5D4A; }
  .td-desc { font: 700 clamp(14px, 1.5vw, 16px)/1.25 ${FRANKLIN}; }
  .td-desc span { display: block; font: 400 12.5px/1.3 ${FRANKLIN}; color: #6E5D4A; }
  .td-price { font: 400 13px/1 ${COURIER}; text-align: right; }
  .td-qty { display: flex; align-items: center; gap: 4px; }
  .td-qty button { width: 44px; height: 44px; border: 1.5px solid ${INK}; background: transparent; color: ${INK}; font: 700 22px/1 ${COURIER}; cursor: pointer; border-radius: 2px; }
  .td-qty button:disabled { opacity: 0.3; cursor: default; }
  .td-qty output { width: 2.2em; height: 44px; display: flex; align-items: center; justify-content: center; font: 700 22px/1 ${COURIER}; color: #1F3A6B;
    border-bottom: 1.5px solid ${INK}; }
  .td-total { display: flex; justify-content: space-between; gap: 10px; padding: 8px 4px; font: 700 13px/1.3 ${COURIER}; }
  .td-total.over { color: ${RED}; }
  .td-check { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 4px; border-bottom: 1px solid rgba(46,33,24,0.3); cursor: pointer; min-height: 52px; }
  .td-check input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .td-box { width: 30px; height: 30px; border: 2px solid ${INK}; display: flex; align-items: center; justify-content: center; font: 700 26px/1 ${COURIER}; color: #1F3A6B; background: rgba(255,255,255,0.25); }
  .td-check b { display: block; font: 700 clamp(14px, 1.5vw, 16px)/1.25 ${FRANKLIN}; }
  .td-check span { display: block; font: 400 13px/1.35 ${FRANKLIN}; color: #5A4A38; }
  .td-sizes { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 4px; }
  .td-size { min-width: 88px; min-height: 48px; border: 1.5px solid ${INK}; background: transparent; color: ${INK}; font: 700 16px/1 ${COURIER}; cursor: pointer; border-radius: 2px; }
  .td-size[aria-pressed="true"] { background: ${INK}; color: ${PAPER}; }
  .td-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px clamp(14px, 3.4vw, 32px) max(12px, env(safe-area-inset-bottom));
    border-top: 3px double ${INK}; background: rgba(239,230,205,0.96); }
  .td-foot-total { font: 700 12.5px/1.35 ${COURIER}; }
  .td-foot-total b { color: ${RED}; }
  .td-foot-btns { display: flex; flex-wrap: wrap; gap: 8px; }
  .td-stamp { position: absolute; top: 58px; right: clamp(14px, 4vw, 36px); transform: rotate(-8deg); border: 2px solid rgba(163,63,51,0.7); color: rgba(163,63,51,0.75);
    font: 800 11px/1.2 ${FRANKLIN}; letter-spacing: 0.16em; padding: 4px 8px; text-transform: uppercase; pointer-events: none; }
  @media (max-width: 420px) {
    .td-board { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 560px) {
    .td-row { grid-template-columns: 56px minmax(0, 1fr) auto; }
    .td-photo-btn { width: 56px; height: 52px; }
    .td-cat, .td-price { display: none; }
    .td-foot-btns { width: 100%; }
    .td-foot-btns .td-btn { flex: 1 1 auto; }
    .td-stamp { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .td-lid, .td-layer, .td-btn { transition: none !important; }
    .td-opening .td-lid { transform: none; }
  }
`;
const MORE_CSS = `
  .td-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0 0 4px 44px; padding: 8px 10px; border-left: 2px solid rgba(46,33,24,0.45);
    background: rgba(46,33,24,0.04); }
  .td-sub-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; width: 100%; }
  .td-sub-h { font: 700 11.5px/1.2 ${FRANKLIN}; letter-spacing: 0.12em; text-transform: uppercase; min-width: 7.5em; }
  .td-sub-val { font: 400 12.5px/1.35 ${COURIER}; color: #1F3A6B; flex: 1 1 12em; }
  .td-small-btn { min-height: 44px; padding: 0 14px; font-size: 12px; }
  .td-info { display: inline-block; margin-top: 4px; padding: 6px 0; min-height: 32px; border: none; background: transparent; color: ${RED};
    font: 700 12px/1.2 ${COURIER}; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .td-info:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
  .td-warn { margin: 0 0 6px 44px; padding: 6px 10px; font: 700 12.5px/1.4 ${COURIER}; color: ${RED}; border-left: 2px solid ${RED}; background: rgba(163,63,51,0.06); }
  .td-diagram-mark { position: absolute; display: flex; align-items: center; justify-content: center; font: 700 10px/1 ${COURIER}; font-style: normal; color: #1F3A6B;
    background: rgba(239,230,205,0.8); }
  .td-opponent .td-dim { border-bottom: none; }
  /* The order going through: the stamp comes down, and the form goes. */
  .td-filled-stamp { position: absolute; left: 50%; top: 42%; z-index: 5; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 10px 22px 8px; border: 4px double rgba(163,63,51,0.85); color: rgba(163,63,51,0.9); background: rgba(239,230,205,0.2);
    transform: translate(-50%, -50%) rotate(-9deg); animation: tdStamp 0.22s cubic-bezier(0.3, 0, 0.4, 1) both; mix-blend-mode: multiply; }
  .td-filled-stamp b { font: 900 clamp(26px, 6vw, 44px)/1 ${FRANKLIN}; letter-spacing: 0.08em; text-transform: uppercase; }
  .td-filled-stamp span { font: 700 11px/1.2 ${COURIER}; letter-spacing: 0.12em; text-transform: uppercase; }
  @keyframes tdStamp { 0% { transform: translate(-50%, -50%) rotate(-9deg) scale(1.7); opacity: 0; } 100% { transform: translate(-50%, -50%) rotate(-9deg) scale(1); opacity: 1; } }
  .td-filled { animation: tdFormAway 0.5s ease 2.1s both; }
  @keyframes tdFormAway { to { transform: translateY(24px); opacity: 0; } }
  @media (max-width: 560px) { .td-sub, .td-warn { margin-left: 0; } }
  @media (prefers-reduced-motion: reduce) { .td-filled-stamp, .td-filled { animation: none; } }
`;
const STORY_CSS = `
  body:has(.td-clerk-layer) [data-testid="room-view-corner"], body:has(.td-clerk-layer) [data-testid="how-to-play"],
  body:has(.td-clerk-layer) [data-testid="focus-corner"] { visibility: hidden !important; pointer-events: none !important; }
  body:has([data-testid="tienda-lid"]) [data-testid="room-view-corner"], body:has([data-testid="tienda-lid"]) [data-testid="how-to-play"],
  body:has([data-testid="tienda-lid"]) [data-testid="focus-corner"], body:has([data-testid="tienda-lid"]) [data-testid="action-corner"] { visibility: hidden !important; pointer-events: none !important; }
  body:has(.td-clerk-layer) [data-fullscreen-toggle], body:has([data-testid="tienda-lid"]) [data-fullscreen-toggle] { opacity: 0.28 !important; }
  .td-row-look { grid-template-columns: 64px 5.2em minmax(0, 1fr) 4em; }
  .td-clerk-layer { cursor: pointer; }
  .td-clerk { display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: default; animation: tdClerkIn 0.4s ease both;
    width: min(420px, 100%); }
  @keyframes tdClerkIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  /* A panel clipped out of a 1975 comic book: yellowed newsprint, cut by
     hand (the ragged edge is a clip-path, the shadow a drop-shadow on the
     figure so it follows the cut), taped down at two corners. */
  .td-clerk-print { position: relative; margin: 0; transform: rotate(-1.1deg); cursor: pointer;
    filter: drop-shadow(0 18px 26px rgba(8, 4, 2, 0.6)) drop-shadow(0 2px 3px rgba(8, 4, 2, 0.45));
    width: min(100%, calc((100dvh - 170px) * 368 / 474 + 32px)); }
  .td-clerk-paper { padding: 16px 16px 0; background-color: #E9DCB6;
    background-image: var(--tienda-aged, none), radial-gradient(ellipse at 30% 20%, rgba(255, 250, 230, 0.35), transparent 60%),
      linear-gradient(160deg, rgba(160, 110, 40, 0.12), rgba(120, 80, 30, 0.2)); background-size: 384px 384px, auto, auto; }
  .td-clerk-tape { position: absolute; z-index: 2; width: 74px; height: 24px; top: -9px; background: rgba(226, 208, 160, 0.72);
    box-shadow: 0 1px 2px rgba(60, 40, 10, 0.25); border-left: 1px dashed rgba(150, 120, 70, 0.35); border-right: 1px dashed rgba(150, 120, 70, 0.35); }
  .td-clerk-tape-l { left: -14px; transform: rotate(-32deg); }
  .td-clerk-tape-r { right: -14px; transform: rotate(28deg); }
  /* The panel: heavy ink border, the photograph printed in dots and
     faded warm at the edges, as remembered. */
  .td-clerk-shots { position: relative; aspect-ratio: 368 / 474; background: #2A1F16; overflow: hidden;
    outline: 4px solid #17110D; outline-offset: 0; box-shadow: 0 0 0 1px #17110D; }
  .td-clerk-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; user-select: none;
    filter: sepia(0.22) saturate(1.12) contrast(1.06) brightness(1.02); transition: opacity 0.32s ease; }
  .td-clerk-print[data-fade="slow"] .td-clerk-shot { transition-duration: 0.9s; }
  .td-clerk-shot[data-on="true"] { opacity: 1; }
  .td-clerk-dots { position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image: radial-gradient(rgba(70, 40, 20, 0.5) 0.9px, transparent 1.4px), radial-gradient(rgba(200, 60, 50, 0.22) 0.8px, transparent 1.3px);
    background-size: 4px 4px, 4px 4px; background-position: 0 0, 2px 2px; mix-blend-mode: multiply; opacity: 0.42;
    box-shadow: inset 0 0 42px rgba(90, 50, 15, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.4); }
  .td-clerk-dots::after { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(255, 228, 170, 0.1), rgba(160, 100, 40, 0.14)); mix-blend-mode: multiply; }
  /* The narrator's box and the PA, lettered as the comics were. */
  .td-clerk-narration, .td-clerk-pa { position: absolute; z-index: 2; margin: 0; padding: 5px 9px 4px; background: #F3D85A; color: #17110D;
    border: 2px solid #17110D; box-shadow: 2px 2px 0 rgba(23, 17, 13, 0.85);
    font: 700 12px/1.25 'Comic Neue', 'Comic Sans MS', ${COURIER}; letter-spacing: 0.04em; text-transform: uppercase;
    animation: tdClerkIn 0.35s ease both; }
  /* The narrator's caption sits in the margin under the panel, as a box
     pasted there, and the Next beside it, small, at the right. */
  .td-clerk-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 46px; padding: 10px 2px 16px; }
  .td-clerk-captions { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; transform: rotate(0.6deg); }
  .td-clerk-captions .td-clerk-narration { position: static; max-width: 100%; }
  .td-clerk-next { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 3px 10px 1px 12px; cursor: pointer;
    background: #F3D85A; color: #17110D; border: 2px solid #17110D; border-radius: 2px; box-shadow: 2px 2px 0 #17110D;
    font: 400 17px/1 'Bangers', ${FRANKLIN}; letter-spacing: 0.08em; text-transform: uppercase; transform: rotate(1.2deg);
    transition: transform 0.08s ease, box-shadow 0.08s ease; }
  .td-clerk-next i { width: 0; height: 0; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 11px solid #17110D; margin-top: -1px; }
  .td-clerk-next:hover i { transform: translateX(2px); }
  .td-clerk-next:active { transform: rotate(1.2deg) translate(2px, 2px); box-shadow: 0 0 0 #17110D; }
  .td-clerk-next:focus-visible { outline: 2px dashed #17110D; outline-offset: 3px; }
  /* The time, quietly: a smaller, paler box. */
  .td-clerk-narration.td-clerk-when { font-size: 9.5px; padding: 3px 7px 2px; background: #F7EBB8; border-width: 1.5px; box-shadow: 1.5px 1.5px 0 rgba(23, 17, 13, 0.6); opacity: 0.85; }
  /* The time ("Later that day...", "Moments later..."): up top, above
     the clipping (user), apart from it; held there on its own so the
     panel doesn't move on the frames that have one. */
  .td-clerk-narration.td-clerk-when.td-clerk-top { top: -46px; left: 50%; transform: translateX(-50%) rotate(-1.4deg); white-space: nowrap;
    font-size: 11px; padding: 4px 9px 3px; opacity: 0.92; animation: tdClerkTopIn 0.35s ease both; }
  @keyframes tdClerkTopIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px) rotate(-1.4deg); } to { opacity: 0.92; transform: translateX(-50%) rotate(-1.4deg); } }
  .td-clerk-pa { left: 8px; right: 8px; bottom: 8px; text-align: center; background: #FBF6E6; }
  .td-clerk-fallback { position: absolute; z-index: 2; inset: auto 12px 12px; margin: 0; padding: 12px 14px; background: #FBF8F0; color: ${INK};
    border: 2px solid #17110D; border-radius: 16px; font: 700 15px/1.35 'Comic Neue', ${COURIER}; }
  .td-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  /* The buttons, lettered too. */
  .td-clerk-actions .td-btn { min-height: 44px; padding: 6px 16px 4px; border: 2.5px solid #17110D; border-radius: 2px;
    box-shadow: 3px 3px 0 #17110D; font: 400 21px/1 'Bangers', ${FRANKLIN}; letter-spacing: 0.07em; text-transform: uppercase;
    transition: transform 0.08s ease, box-shadow 0.08s ease; }
  .td-clerk-actions .td-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #17110D; }
  .td-clerk-pages { display: flex; justify-content: center; gap: 2px; padding: 10px 0 0; }
  .td-clerk-page { width: 22px; height: 22px; padding: 0; border: none; background: transparent; cursor: pointer; display: grid; place-items: center; }
  .td-clerk-page::before { content: ""; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #17110D; background: #FBF6E6; }
  .td-clerk-page[data-on="true"]::before { background: #17110D; }
  .td-clerk-page:disabled { cursor: default; }
  .td-clerk-page:disabled::before { opacity: 0.3; }
  .td-clerk-actions .td-primary, .td-clerk-actions .td-primary:hover { background: #F3D85A; color: #17110D; }
  .td-clerk-actions .td-plain:hover { background: #FFFDF3; color: #17110D; }
  .td-clerk-actions .td-plain { background: #FBF6E6; color: #17110D; }
  .td-clerk-actions [data-testid="tienda-clerk-go-home"], .td-clerk-actions [data-testid="tienda-clerk-go-home"]:hover { background: #C8392B; color: #FBF6E6; }
  @media (prefers-reduced-motion: reduce) { .td-clerk-shot, .td-clerk-print[data-fade="slow"] .td-clerk-shot { transition-duration: 0.01s; } .td-clerk-narration, .td-clerk-pa, .td-clerk-narration.td-clerk-when.td-clerk-top { animation: none; } }
  .td-clerk-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; padding: 14px 6px 16px; }
  .td-offer { position: fixed; z-index: 1150; left: 50%; top: max(12px, env(safe-area-inset-top)); transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; max-width: min(560px, calc(100vw - 24px));
    padding: 10px 14px; background: #EFE6CD; color: ${INK}; border: 1px solid rgba(46,33,24,0.35); box-shadow: 0 10px 30px rgba(20,12,6,0.35);
    font: 400 14px/1.3 ${COURIER}; }
  .td-offer .td-btn { min-height: 44px; }
  .td-offer-x { min-width: 44px; min-height: 44px; border: none; background: transparent; color: ${INK}; font: 400 22px/1 ${FRANKLIN}; cursor: pointer; }
  html.ec-shell .td-offer { top: calc(env(safe-area-inset-top, 0px) + 64px); }
  @media (max-width: 560px) { .td-row-look { grid-template-columns: 56px minmax(0, 1fr) auto; } }
`;
const Style = () => h("style", null, CSS + MORE_CSS + ORDER_PARTS_CSS + STORY_CSS);

/* ------------------------------------------------------------ the box lid */

function BoxLid({ onOpen, onOrder, orderLabel = "Custom rules", audio, locked = false }) {
  const [opening, setOpening] = React.useState(false);
  const [next, setNext] = React.useState(null);
  React.useEffect(() => {
    if (!opening) return undefined;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => (next === "order" ? onOrder() : onOpen()), reduced ? 60 : 820);
    return () => clearTimeout(id);
  }, [opening]);
  const go = (which) => {
    if (opening) return;
    // The lid coming off: cardboard on cardboard.
    audio && audio.ensureStarted && audio.ensureStarted();
    audio && audio.playDockOpen && audio.playDockOpen();
    setNext(which);
    setOpening(true);
  };
  return h("div", { className: `td-layer${opening ? " td-opening" : ""}`, "data-testid": "tienda-lid", role: "dialog", "aria-modal": "true", "aria-label": "El Cabeza, the boxed game" },
    h(Style),
    h("div", { className: "td-lid" },
      h("div", { className: "td-photo", style: { backgroundImage: `url(${boxArtUrl})` }, role: "img", "aria-label": "The game set up on a coffee table in a wood-panelled den" }),
      h("div", { className: "td-lettering" },
        h("div", { className: "td-small" }, "For 2 players · Ages 10 to adult"),
        h("h1", { className: "td-title" }, "EL", h("br"), "CABEZA"),
        h("div", { className: "td-rule" }),
        h("div", { className: "td-tag" }, "A Game of Unparalleled Intention"),
        h("p", { className: "td-body", style: { margin: 0 } }, "Complete with folding hardwood board and ten hand-finished playing pieces. Move a piece, or two. Roll the blocks. Bring your head home."),
        h("div", { className: "td-lid-actions" },
          h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-open-box", onClick: () => go("open"), autoFocus: true }, "Open the box"),
          // A new story's lid has the one way in: the box itself.
          !locked && h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-lid-order", onClick: () => go("order") }, orderLabel),
        ),
        h("div", { className: "td-small", style: { color: "rgba(233,220,192,0.55)", letterSpacing: "0.1em" } }, "No. 4417 · Made in Argentina · © 1975"),
      ),
      h("div", { className: "td-sticker", "aria-label": "Price 7 dollars 97" }, "$7.97"),
    ),
  );
}

/* ------------------------------------------------------------ the store's catalog page (Nova's story) */

// The five pieces in the box, as the store sells it.
const CLASSIC_PIECES = [
  ["cabeza", "Cabeza"], ["turrito", "Turrito"], ["flaco", "Flaco"], ["chato", "Chato"], ["opa", "Opa"],
];

/* Before the game is bought, the catalog shows only what's in the box:
   the five original pieces, each with its photograph (tap it to take the
   piece up in 3-D, as on the order form) and what it does. Nothing to
   change: a game in the store is the classic game. The rest (the other
   pieces, the rules, the board) waits at home. */
function PieceCatalog({ audio, onClose, onPurchase, specialOpen = false, onSpecialOrder }) {
  const [viewer, setViewer] = React.useState(null);
  const types = CLASSIC_PIECES.map(([k]) => k);
  const [photos, setPhotos] = React.useState(() => types.every((t) => !hasWoodShowcase(t) || woodPhoto(t)));
  React.useEffect(() => {
    if (photos) return undefined;
    const id = setTimeout(() => { ensureWoodPhotos(types); setPhotos(true); }, 60);
    return () => clearTimeout(id);
  }, []);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector('[data-testid="tienda-piece-viewer"]')) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const click = () => { audio && audio.playSelect && audio.playSelect(); };
  const closeViewer = () => setViewer((v) => {
    if (!v || v.closing) return v;
    audio && audio.playDeselect && audio.playDeselect();
    const still = document.querySelector(`[data-testid="tienda-view-${v.key}"]`);
    return { ...v, rect: still ? still.getBoundingClientRect() : v.rect, closing: true };
  });
  const rows = CLASSIC_PIECES.map(([key, name]) => {
    const [cat, price, note] = CATALOG[key];
    const photo = hasWoodShowcase(key)
      ? h("button", {
          type: "button", className: "td-photo-btn", "data-testid": `tienda-view-${key}`, "data-type": key,
          "aria-label": `Take up the ${name} and turn it over in 3-D`,
          onClick: (e) => { if (viewer) return; click(); setViewer({ key, type: key, name, detail: note, cat, price, rect: e.currentTarget.getBoundingClientRect(), closing: false }); },
        },
        woodPhoto(key) ? h("img", { src: woodPhoto(key), alt: "" }) : h("span", { className: "td-photo-wait" }),
        h("i", { className: "td-3d", "aria-hidden": "true" }, "3-D"))
      : h("span");
    return h("div", { key, className: "td-row td-row-look", "data-testid": `tienda-catalog-${key}` },
      photo,
      h("span", { className: "td-cat" }, cat),
      h("span", { className: "td-desc" }, name, h("span", null, note)),
      h("span", { className: "td-price" }, price));
  });
  return h("div", { className: "td-layer", "data-testid": "tienda-catalog", role: "dialog", "aria-modal": "true", "aria-label": "Catalog: the pieces", onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
    h(Style),
    h("div", { className: "td-form" },
      h("div", { className: "td-form-scroll" },
        h("div", { className: "td-form-head" },
          h("div", null,
            h("div", { className: "td-form-sub" }, "Games & Hobby Dept. · Fall & Winter Catalog 1975"),
            h("h2", { className: "td-form-title" }, "THE PIECES"),
          ),
          h("div", { className: "td-form-note" }, "In every box: five of each, a side apiece, and the folding board."),
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "El Cabeza · No. 4417", h("small", null, "tap a photograph to inspect the piece")),
          rows,
        ),
        // Special orders: faded until the Singularity's been visited, then
        // the way into the order form (Custom rules).
        specialOpen
          ? h("button", { type: "button", className: "td-special td-special-open", "data-testid": "tienda-special-order", onClick: onSpecialOrder },
              h("b", null, "Special orders"), " \u2014 other pieces, rules and boards to order. ", h("u", null, "Custom rules \u203a"))
          : h("div", { className: "td-special", "data-testid": "tienda-special-order", "aria-disabled": "true" },
              h("b", null, "Special orders"), " \u2014 by arrangement."),
      ),
      h("div", { className: "td-foot" },
        h("div", { className: "td-foot-total" }, "The complete game, board and ten pieces", h("br"), h("b", null, "$7.97")),
        h("div", { className: "td-foot-btns" },
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-catalog-close", onClick: onClose }, "Close"),
          onPurchase && h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-catalog-purchase", onClick: () => { click(); onPurchase(); } }, "Purchase and bring home"),
        ),
      ),
    ),
    viewer && h(WoodPieceViewer, {
      key: viewer.key,
      type: viewer.type, name: viewer.name, detail: viewer.detail, cat: viewer.cat, price: viewer.price,
      fromRect: viewer.rect, closing: viewer.closing, audio,
      onClose: closeViewer,
      onClosed: () => setViewer(null),
    }),
  );
}

/* A game in the store played to the end: the clerk's offer, at the top of
   the screen, clear of the win placard and the dock. */
function PurchaseOffer({ story, audio }) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  return h("div", { className: "td-offer", "data-testid": "tienda-offer", role: "status" },
    h(Style),
    h("span", null, "Like it? Take it home: ", h("b", null, "$7.97")),
    h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-offer-purchase", onClick: () => { audio && audio.playSelect && audio.playSelect(); if (confusedAtClerk) story.onGoHomeConfused(); else story.onPurchase(); } },
      confusedAtClerk ? "Go home, confused." : story.after && story.after() ? "Purchase another copy" : "Purchase and bring home"),
    h("button", { type: "button", className: "td-offer-x", "aria-label": "No thanks", "data-testid": "tienda-offer-dismiss", onClick: () => setGone(true) }, "×"),
  );
}

/* Back at the store after the whole story: nobody has heard of it. The
   user's storyboard, as photographs (assets/tienda/clerk, made by
   tools/tienda_clerk_frames.py from their two sheets: one spread of
   appliances on the table in every frame). Steve B. offers to help, goes
   to look, comes back empty-handed, and phones for the manager (the PA
   pages him as the phone frame comes up); the manager has never heard of
   it either. A tap goes on. Where the user merged two cells into one
   frame, the tap crossfades the first into the second (the lines are in
   the bubbles, and read aloud to a screen reader). The photographs are
   files beside the page (build/build.js), fetched as the scene opens; if
   one can't load, its line is printed instead. */
const CLERK_FRAMES = [
  { shots: ["clerk-hello", "clerk-sure"], narration: "Later that day\u2026", handover: true, lines: ["Hi there! Can I help you with something?", "Sure thing! I'd be happy to help you find that."] },
  // (The "One minute! I'll see if we have it in the back!" shot, clerk-back,
  // is out: user.)
  { shots: ["clerk-go"], lines: ["I'll go check on that for you real quick!"] },
  { shots: ["clerk-hmm", "clerk-sorry"], lines: ["Hmm\u2026 I couldn't find it. I checked the aisle and also the back room.", "Yeah, I'm sorry. I don't see it anywhere right now."] },
  { shots: ["clerk-phone"], lines: ["Okay, let me call my manager and see if they can help us with this."], page: true },
  { shots: ["manager-1"], narration: "Moments later\u2026", lines: ["Afternoon! El Cabeza, you said?"] },
  { shots: ["manager-2"], lines: ["No\u2026 no. We've never sold a game by that name."] },
  { shots: ["manager-3"], lines: ["You say you were in here about an hour ago, huh?"] },
  { shots: ["manager-4"], lines: ["Hmm\u2026 That's strange."] },
  { shots: ["manager-5"], lines: ["We're very sorry, but we've never carried a game by that name."] },
  { shots: ["manager-6"], lines: [""], alt: "The clerk and the manager look at each other." },
  { shots: ["manager-7"], lines: ["But we'd love to help you if we could\u2026"] },
  { shots: ["manager-8"], lines: ["Is there anything else I can help you with today?"] },
];
// Every shot in order, with its frame.
const CLERK_STEPS = CLERK_FRAMES.flatMap((f, fi) => f.shots.map((shot, si) => ({ shot, frame: fi, line: f.lines[si], alt: f.alt, narration: f.narration, handover: !!f.handover, page: !!f.page && si === 0 })));
/* The clipping's edge: cut by hand with scissors, a little off true, so
   each side wanders in and out by a few pixels (the same cut every
   time). */
const CLIP_EDGE = (() => {
  let seed = 1975;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pts = [], n = 14;
  const at = (x, y) => pts.push(`calc(${x}% ${x > 50 ? "-" : "+"} ${(r() * 4).toFixed(1)}px) calc(${y}% ${y > 50 ? "-" : "+"} ${(r() * 4).toFixed(1)}px)`);
  for (let i = 0; i < n; i++) at((i / n) * 100, 0);
  for (let i = 0; i < n; i++) at(100, (i / n) * 100);
  for (let i = n; i > 0; i--) at((i / n) * 100, 100);
  for (let i = n; i > 0; i--) at(0, (i / n) * 100);
  return `polygon(${pts.join(", ")})`;
})();
// Comic lettering for the clipping (Google Fonts, once).
function ensureComicFonts() {
  if (typeof document === "undefined" || document.getElementById("td-comic-fonts")) return;
  const l = document.createElement("link");
  l.id = "td-comic-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@700&display=swap";
  document.head.appendChild(l);
}
export const CLERK_SHOT_FILES = CLERK_STEPS.map((s) => `el-cabeza-${s.shot}.jpg`);
const PA_CAPTION = "Ding-dong. \u201cManager to Games, please. Manager to Games.\u201d";

function ClerkScene({ audio, onStay, onGoHome }) {
  // Come with the special order from home (the first time through).
  const withOrder = !!orderInHand;
  const [step, setStep] = React.useState(0);
  const [seen, setSeen] = React.useState(0); // the furthest shot reached
  const [failed, setFailed] = React.useState(() => new Set());
  const s = CLERK_STEPS[step];
  const last = step === CLERK_STEPS.length - 1;
  // Where it came from (forward or back): within a frame, the slow
  // crossfade; frame to frame, a quick one.
  const fromRef = React.useRef(-1);
  const from = fromRef.current >= 0 ? CLERK_STEPS[fromRef.current] : null;
  const fade = from && from.frame === s.frame ? "slow" : "quick";
  // Fetch them all as the scene opens, so no tap waits on one.
  React.useEffect(() => {
    ensureComicFonts();
    CLERK_SHOT_FILES.forEach((src) => { const im = new Image(); im.src = src; });
  }, []);
  // The page goes out a beat after he picks up the phone: each time you
  // come to that panel (user: paging back and forward again, it didn't
  // play again), its caption with it.
  const [pagedOut, setPagedOut] = React.useState(false);
  React.useEffect(() => {
    setPagedOut(false);
    if (!s.page) return undefined;
    const id = setTimeout(() => { setPagedOut(true); if (audio && audio.playPage) audio.playPage(); }, 900);
    return () => clearTimeout(id);
  }, [step]);
  React.useEffect(() => {
    if (last && !confusedAtClerk) {
      confusedAtClerk = true;
      window.dispatchEvent(new CustomEvent("el-cabeza:clerk-done"));
    }
  }, [last]);
  /* Paging, forward and back (user: a double tap jumped two panels, and
     there was no way back to reread one). A step is taken at most every
     half second, so a double tap or a bounce of the finger takes one; back
     goes a shot at a time (a swipe right, the left arrow key), and
     the dots under the panel go straight to any frame already seen. */
  const lastGo = React.useRef(0);
  const go = (to) => {
    const t = performance.now();
    if (to < 0 || to >= CLERK_STEPS.length || to === step || t - lastGo.current < 500) return;
    lastGo.current = t;
    audio && audio.playSelect && audio.playSelect();
    fromRef.current = step;
    setStep(to);
    setSeen((m) => Math.max(m, to));
  };
  const next = () => { if (!last) go(step + 1); };
  const back = () => go(step - 1);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") { if (e.target && e.target.tagName === "BUTTON" && e.key !== "ArrowRight") return; e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // A swipe across the panel: left for on, right for back (and not also
  // the tap that goes on).
  const swipe = React.useRef(null);
  const onDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const d = swipe.current; swipe.current = null;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipe.swiped = true; if (dx < 0) next(); else back(); }
  };
  const onLayerClick = () => { if (swipe.swiped) { swipe.swiped = false; return; } next(); };
  const frameOfSeen = CLERK_STEPS[seen].frame;
  const said = s.line || s.alt || "";
  const lost = failed.has(s.shot);
  return h("div", { className: "td-layer td-clerk-layer", "data-testid": "tienda-clerk", "data-step": step, "data-frame": s.frame, onClick: onLayerClick, onPointerDown: onDown, onPointerUp: onUp },
    h(Style),
    h("div", { className: "td-clerk", role: "dialog", "aria-label": "At the Games counter" },
      // A panel clipped out of a 1975 comic book and kept: yellowed
      // newsprint cut by hand, two strips of old tape, the panel in its
      // ink border, printed in Ben-Day dots, a little faded.
      h("figure", { className: "td-clerk-print", "data-fade": fade },
        s.narration && h("p", { key: `w${s.frame}`, className: "td-clerk-narration td-clerk-when td-clerk-top", "data-testid": "tienda-clerk-when" }, s.narration),
        h("span", { className: "td-clerk-tape td-clerk-tape-l", "aria-hidden": "true" }),
        h("span", { className: "td-clerk-tape td-clerk-tape-r", "aria-hidden": "true" }),
        h("div", { className: "td-clerk-paper", style: { clipPath: CLIP_EDGE, WebkitClipPath: CLIP_EDGE } },
        h("div", { className: "td-clerk-shots" },
          CLERK_STEPS.map((c, i) => h("img", {
            key: c.shot, src: CLERK_SHOT_FILES[i], alt: "", "aria-hidden": "true", draggable: false,
            className: "td-clerk-shot", "data-on": i === step ? "true" : "false",
            onError: () => setFailed((f) => { const n = new Set(f); n.add(c.shot); return n; }),
          })),
          h("i", { className: "td-clerk-dots", "aria-hidden": "true" }),
          s.page && pagedOut && h("p", { className: "td-clerk-pa" }, PA_CAPTION),
          lost && h("p", { className: "td-clerk-fallback" }, said ? `\u201c${said}\u201d` : "\u2026")),
        // Where it's got to: a dot a frame, the ones seen can be gone back to.
        h("div", { className: "td-clerk-pages", role: "group", "aria-label": "Panels" },
          CLERK_FRAMES.map((f, fi) => {
            const first = CLERK_STEPS.findIndex((c) => c.frame === fi);
            const reached = fi <= frameOfSeen;
            return h("button", {
              key: fi, type: "button", className: "td-clerk-page", "data-on": fi === s.frame ? "true" : "false", disabled: !reached,
              "aria-label": `Panel ${fi + 1}`, "data-testid": `tienda-clerk-page-${fi + 1}`,
              onClick: (e) => { e.stopPropagation(); if (reached) go(fi === s.frame ? step : first); },
            });
          })),
        // In the clipping's bottom margin (clear of the dock's piece on
        // a phone, which floats over the bottom of the screen): the
        // narrator's caption under the panel, off the faces (user), and a
        // small Next at the right; at the end, the two ways out.
        last
          ? h("div", { className: "td-clerk-actions" }, [
              h("button", { key: "stay", type: "button", className: "td-btn td-plain", "data-testid": "tienda-clerk-stay", onClick: (e) => { e.stopPropagation(); onStay(); } }, "Stay a while"),
              h("button", { key: "home", type: "button", className: "td-btn td-primary", "data-testid": "tienda-clerk-go-home", onClick: (e) => { e.stopPropagation(); audio && audio.playSelect && audio.playSelect(); onGoHome(); } }, withOrder ? "Go home, confused\u2026 with your form" : "Go home, confused."),
            ])
          : h("div", { className: "td-clerk-foot" },
              h("div", { key: `n${s.frame}`, className: "td-clerk-captions" },
                // The first panel, come with the order form: what you do
                // (walking you through it: user).
                s.handover && withOrder && h("p", { className: "td-clerk-narration", "data-testid": "tienda-clerk-handover" }, "You hand over the order form\u2026")),
              h("button", { type: "button", className: "td-clerk-next", "data-testid": "tienda-clerk-next", "aria-label": "Next panel", onClick: (e) => { e.stopPropagation(); next(); } },
                h("span", null, "Next"), h("i", { "aria-hidden": "true" }))))),
      // The line, for a screen reader (the photograph carries it on screen).
      h("p", { className: "td-sr", "data-testid": "tienda-clerk-line", "aria-live": "polite" }, s.line ? `\u201c${s.line}\u201d` : s.alt)));
}

/* ------------------------------------------------------------ the order form */

// Catalog numbers and prices for the pieces (as sold separately).
const CATALOG = {
  cabeza: ["49 T 4401", "45¢", "The head. Steps any way; bring it home to win."],
  turrito: ["49 T 4402", "25¢", "One cube."],
  flaco: ["49 T 4403", "30¢", "Two cubes, end to end."],
  chato: ["49 T 4404", "40¢", "Four cubes, flat."],
  opa: ["49 T 4405", "65¢", "Eight cubes. Heavy."],
  block1x3: ["49 T 4410", "35¢", "Three cubes in a row."],
  block2x3: ["49 T 4411", "75¢", "Six cubes, a slab."],
  codo: ["49 T 4406", "35¢", "Three cubes in an L. Its overhang can shelter a Cabeza."],
  // (The Arco in its three sizes, each its own line, user.)
  arcoChico: ["49 T 4407", "55¢", "An arch, 3 wide and 2 tall. A Cabeza in its opening is sheltered."],
  arcoAlto: ["49 T 4412", "75¢", "A tall arch, 3 wide and 3 tall. A Cabeza in its opening is sheltered."],
  arcoAncho: ["49 T 4413", "65¢", "A wide arch, 4 wide and 2 tall. A Cabeza in its opening is sheltered."],
  rayo: ["49 T 4408", "45¢", "Four cubes, an S."],
  zeta: ["49 T 4409", "55¢", "Five cubes, a Z."],
};
// The summary's groups, in the store's words.
export const TIENDA_VARIANT_LABELS = { laws: "RULES", matter: "PIECES", topologies: "BOARD" };

/* The board as the catalog drew it: squares to scale, the two sides'
   home rows shaded (the far one light, the near one dark). */
function BoardDiagram({ sel }) {
  const { rows, cols } = sel;
  const cell = Math.max(3, Math.min(92 / cols, 92 / rows));
  // Marked squares: X cut out, O black holes (drawn from Dark's side, as
  // the picker is: row 0 at the bottom, column 0 on the right).
  const mark = (c, ch, i) => h("i", { key: `${ch}${i}`, className: "td-diagram-mark", style: { left: (cols - 1 - c.col) * cell, top: (rows - 1 - c.row) * cell, width: cell, height: cell, fontSize: Math.max(7, cell * 0.9) } }, ch);
  return h("figure", { className: "td-diagram", "data-testid": "tienda-board-diagram", "data-rows": rows, "data-cols": cols, "aria-label": `The board: ${cols} squares wide, ${rows} long` },
    h("div", { className: "td-diagram-board", style: { width: cell * cols, height: cell * rows, backgroundSize: `${cell * 2}px ${cell * 2}px` } },
      h("i", { className: "td-home td-home-far", style: { height: cell * 2 } }),
      h("i", { className: "td-home td-home-near", style: { height: cell * 2 } }),
      ...missingCellsOf(sel).map((c, i) => mark(c, "X", i)),
      ...holeCellsOf(sel).map((c, i) => mark(c, "O", i))),
    h("figcaption", null, `${cols} × ${rows}`));
}

// Square sizes a tap away (any width and length can be set).
const QUICK_SIZES = [8, 10, 12, 16, 20];

function OrderForm({ initial, onChange, onCancel, onPlace, audio, where = "store", x }) {
  // Before the Singularity's first visit, the page of the classic game.
  const classic = React.useMemo(() => !singularitySeen(), []);
  const [sel, setSel] = React.useState(() => {
    const s0 = normalizeSelections(cloneSelections(initial || defaultSelections()));
    return classic ? classicSelections(s0) : normalizeSelections(storeSelections(s0));
  });
  const change = (fn) => setSel((s) => { const n = cloneSelections(s); fn(n); onChange && onChange(n); return n; });
  const replace = (n0) => { const n = classic ? classicSelections(n0) : normalizeSelections(storeSelections(n0)); setSel(n); onChange && onChange(n); };
  const click = () => { audio && audio.playSelect && audio.playSelect(); };
  const total = totalPieces(sel), over = total > MAX_PIECES;
  const fits = piecesFit(sel), need = fits ? null : minColsFor(sel);
  const warnings = lawWarnings(sel);
  // Pivot on with no Codo, Rayo or Zeta: the warning flashes, then the
  // three (together at the end of the pieces) flash (pivot-guide.js).
  const showPivots = usePivotGuide(warnings.some((w) => w.key === "cantileverPivot"), { warnSel: '[data-testid="law-warning-cantileverPivot"]', rowSel: (k) => `[data-testid="tienda-piece-${k}"]` });
  // The piece taken up off the page, if any: { key, type, name, detail, cat, price, rect, closing }.
  const [viewer, setViewer] = React.useState(null);
  // The board being marked ("missing" | "hole"), if any.
  const [picker, setPicker] = React.useState(null);
  // The order going through: the stamp, the register, then the game.
  const [filled, setFilled] = React.useState(false);
  const photoTypes = PIECE_OPTIONS.map((p) => p.key);
  const [photos, setPhotos] = React.useState(() => photoTypes.every((t) => !hasWoodShowcase(t) || woodPhoto(t)));
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector('[data-testid="tienda-piece-viewer"], [data-testid="tienda-picker"], [data-testid="info-overlay"][data-open="true"]')) return;
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // The photographs, once the form is on screen.
  React.useEffect(() => {
    if (photos) return undefined;
    const id = setTimeout(() => { ensureWoodPhotos(photoTypes); setPhotos(true); }, 60);
    return () => clearTimeout(id);
  }, []);
  const closeViewer = () => setViewer((v) => {
    if (!v || v.closing) return v;
    audio && audio.playDeselect && audio.playDeselect();
    const still = document.querySelector(`[data-testid="tienda-view-${v.key}"]`);
    return { ...v, rect: still ? still.getBoundingClientRect() : v.rect, closing: true };
  });
  // "How it works": the rules card for that law, over the form.
  const explain = (key) => { click(); window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "moves", focus: key } })); };

  const pieceRows = (classic ? PIECE_OPTIONS.filter((p) => CLASSIC_PIECE_KEYS.includes(p.key)) : PIECE_OPTIONS).map((p) => {
    const n = sel.counts[p.key];
    const [cat, price, note] = CATALOG[p.key] || ["", "", ""];
    const type = pieceTypeOf(p.key);
    const name = p.name;
    const set = (v) => { click(); change((s) => { s.counts[p.key] = Math.max(p.min, Math.min(p.max, v)); }); };
    const viewing = !!(viewer && viewer.key === p.key);
    const photo = hasWoodShowcase(type)
      ? h("button", {
          type: "button", className: "td-photo-btn", "data-testid": `tienda-view-${p.key}`, "data-viewing": viewing ? "true" : "false", "data-type": type,
          "aria-label": `Take up the ${name} and turn it over in 3-D`,
          onClick: (e) => {
            if (viewer) return;
            click();
            setViewer({ key: p.key, type, name, detail: note, cat, price, rect: e.currentTarget.getBoundingClientRect(), closing: false });
          },
        },
        woodPhoto(type) ? h("img", { src: woodPhoto(type), alt: "" }) : h("span", { className: "td-photo-wait" }),
        h("i", { className: "td-3d", "aria-hidden": "true" }, "3-D"))
      : h("span");
    const row = h("div", { key: p.key, className: "td-row", "data-testid": `tienda-piece-${p.key}` },
      photo,
      h("span", { className: "td-cat" }, cat),
      h("span", { className: "td-desc" }, name, h("span", null, note)),
      h("span", { className: "td-price" }, price),
      h("span", { className: "td-qty" },
        h("button", { type: "button", "aria-label": `Fewer ${p.name}`, "data-testid": `tienda-piece-${p.key}-dec`, disabled: n <= p.min, onClick: () => set(n - 1) }, "−"),
        h("output", { "aria-live": "polite", "aria-label": `${n} ${p.name}` }, String(n)),
        h("button", { type: "button", "aria-label": `More ${p.name}`, "data-testid": `tienda-piece-${p.key}-inc`, disabled: n >= p.max, onClick: () => set(n + 1) }, "+"),
      ),
    );
    return row;
  });

  const check = (id, on, title, note, onToggle, extra) => h("label", { key: id, className: "td-check", "data-testid": `tienda-${id}` },
    h("input", { type: "checkbox", checked: on, onChange: () => { click(); onToggle(); }, "data-testid": `tienda-${id}-input` }),
    h("span", { className: "td-box", "aria-hidden": "true" }, on ? "✕" : ""),
    h("span", null, h("b", null, title), note ? h("span", null, note) : null, extra || null),
  );
  const warnFor = (key) => warnings.filter((w) => w.key === key).map((w) => h("div", {
    key: w.testid, className: "td-warn", role: "status", "data-testid": w.testid,
    ...(w.key === "cantileverPivot" ? { onClick: showPivots, style: { cursor: "pointer" }, title: "Show me" } : {}),
  }, h("span", { "aria-hidden": "true" }, "☞ "), w.text));
  const spotsLine = (list, mark) => (list.length ? list.map((p) => `${mark} row ${p.row + 1}, col ${p.col + 1}${p.random ? " (random)" : ""}`).join(" · ") : "none yet");

  const lawRows = LAW_OPTIONS.flatMap((l) => {
    const on = !!sel.laws[l.key];
    const info = h("button", { type: "button", className: "td-info", "data-testid": `tienda-law-${l.key}-info`, onClick: (e) => { e.preventDefault(); e.stopPropagation(); explain(l.key); } }, "How it works ›");
    const out = [check(`law-${l.key}`, on, l.name, l.note, () => change((s) => toggleLaw(s, l.key)), info)];
    // Shoving's one setting: whether rolls shove too, or only slides.
    if (on && l.key === "shoving") {
      out.push(h("div", { key: "shove", className: "td-sub", "data-testid": "tienda-shove-settings" },
        ...SHOVE_SETTINGS.map((st) => h("div", { key: st.key, className: "td-sub-row" },
          h("span", { className: "td-sub-h" }, st.name),
          h("div", { className: "td-seg", role: "group", "aria-label": st.name },
            ...st.options.map((o) => h("button", {
              key: String(o.value), type: "button", "aria-pressed": ((sel.shove || {})[st.key] !== false) === o.value ? "true" : "false",
              "data-testid": `tienda-shove-${st.key}-${o.value ? "on" : "off"}`,
              onClick: () => { click(); change((s) => { s.shove = { ...s.shove, [st.key]: o.value }; }); },
            }, o.name)))))));
    }
    if (on && l.key === "blackHoleSquares") {
      out.push(h("div", { key: "holes", className: "td-sub", "data-testid": "tienda-hole-settings" },
        h("span", { className: "td-sub-h" }, "Where"),
        h("span", { className: "td-sub-val", "data-testid": "tienda-hole-where" }, spotsLine(sel.holeSpot ? [sel.holeSpot] : [], "O")),
        h("button", { type: "button", className: "td-btn td-plain td-small-btn", "data-testid": "tienda-hole-select", onClick: () => { click(); setPicker("hole"); } }, "Select")));
    }
    return [...out, ...warnFor(l.key)];
  });

  const setDim = (k, v) => { click(); change((s) => { s[k] = clampDim(v); refreshSpots(s); }); };
  const dimRow = (k, label, note) => h("div", { className: "td-dim", "data-testid": `tienda-${k}` },
    h("span", { className: "td-desc" }, label, h("span", null, note)),
    h("span", { className: "td-qty" },
      h("button", { type: "button", "aria-label": `${label}: one square less`, "data-testid": `tienda-${k}-dec`, disabled: sel[k] <= MIN_BOARD_DIM, onClick: () => setDim(k, sel[k] - 1) }, "−"),
      h("output", { "aria-live": "polite", "data-testid": `tienda-${k}-value`, "aria-label": `${label}: ${sel[k]} squares` }, String(sel[k])),
      h("button", { type: "button", "aria-label": `${label}: one square more`, "data-testid": `tienda-${k}-inc`, disabled: sel[k] >= MAX_BOARD_DIM, onClick: () => setDim(k, sel[k] + 1) }, "+"),
    ),
  );
  const boardRows = h("div", { className: "td-board" },
    h(BoardDiagram, { sel }),
    h("div", null,
      dimRow("cols", "Width", `squares across a home row (${MIN_BOARD_DIM}–${MAX_BOARD_DIM})`),
      dimRow("rows", "Length", `squares from your home row to the far one (${MIN_BOARD_DIM}–${MAX_BOARD_DIM})`),
    ),
  );
  const sizeRow = h("div", { className: "td-sizes", role: "group", "aria-label": "Square boards" },
    QUICK_SIZES.map((n) => h("button", { key: n, type: "button", className: "td-size", "aria-pressed": sel.rows === n && sel.cols === n ? "true" : "false", "data-testid": `tienda-size-${n}`, onClick: () => { click(); change((s) => { s.rows = n; s.cols = n; refreshSpots(s); }); } }, `${n} × ${n}`)));
  const fitNote = !fits && h("div", { className: "td-fit", role: "alert", "data-testid": "tienda-fit-warning" },
    h("span", null, need
      ? `These pieces won't fit in two home rows ${sel.cols} squares wide${bandHasMarks(sel) ? " round the squares marked there" : ""}. They need a board at least ${need} wide.`
      : `These pieces won't fit in two home rows, even ${MAX_BOARD_DIM} squares wide. Take some out.`),
    need && need !== sel.cols && h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-fit-fix", onClick: () => setDim("cols", need) }, `Make it ${need} wide`));
  const missingRows = sel.missing && h("div", { key: "missing", className: "td-sub", "data-testid": "tienda-missing-settings" },
    h("div", { className: "td-sub-row" },
      h("span", { className: "td-sub-h" }, "Pairs"),
      h("span", { className: "td-qty" },
        h("button", { type: "button", "aria-label": "One pair fewer", "data-testid": "tienda-missing-count-dec", disabled: sel.missingCount <= 1, onClick: () => { click(); change((s) => { s.missingCount -= 1; s.missingSpots = trimSpots(s.missingSpots, s.missingCount); }); } }, "−"),
        h("output", { "aria-live": "polite", "data-testid": "tienda-missing-count-value" }, String(sel.missingCount)),
        h("button", { type: "button", "aria-label": "One pair more", "data-testid": "tienda-missing-count-inc", disabled: sel.missingCount >= MAX_MISSING_PAIRS, onClick: () => { click(); change((s) => { s.missingCount += 1; fillSpots(s, "missing"); }); } }, "+"),
      )),
    h("div", { className: "td-sub-row" },
      h("span", { className: "td-sub-h" }, "Where"),
      h("span", { className: "td-sub-val", "data-testid": "tienda-missing-where" }, spotsLine(sel.missingSpots, "X")),
      h("button", { type: "button", className: "td-btn td-plain td-small-btn", "data-testid": "tienda-missing-select", onClick: () => { click(); setPicker("missing"); } }, "Select")));

  /* The first time through (guided), the order has to be something
     special: until anything on the form changes, the button waits, and a
     tap on it says so (user). */
  const startSel = React.useMemo(() => JSON.stringify(sel), []);
  const waiting = where === "guided" && JSON.stringify(sel) === startSel;
  const [nudge, setNudge] = React.useState(0);
  // Its Singularity glow, as the special-orders note's (user: same rule):
  // not at first; once a tap lands anywhere but on it, it lights.
  const [btnGlow, setBtnGlow] = React.useState(false);
  /* The first time through (until the story starts over), the form is for
     filling in and taking to Big Glutts: anything on it can be chosen, the
     pieces, the rules and the board (user: "anything should be able to be
     selected, including rules and board layouts"; it had been the pieces
     only), with the square picker and the 3-D views; but not Cancel or
     Standard, and nothing off it (the board, the dock, the corner's
     buttons): those are stopped at the window. Each tap that misses
     lights the button (as before) and throbs it. */
  React.useEffect(() => {
    if (where !== "guided") return undefined;
    const NO = '[data-testid="tienda-order-cancel"], [data-testid="tienda-order-standard"]';
    // (The rules card a rule's "How it works ›" opens, too, open or closing.)
    const OK = '[data-testid="tienda-order"], [data-testid="tienda-picker"], [data-testid="tienda-piece-viewer"], [data-testid="info-overlay"][data-open="true"], [data-fullscreen-toggle]';
    const throb = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector('[data-testid="tienda-order-place"]');
      if (!el) return;
      el.classList.remove("td-throb"); void el.offsetWidth; el.classList.add("td-throb");
    }));
    const missed = (e) => {
      const el = e.target && e.target.closest ? e.target : null;
      if (!el) return false;
      if (el.closest(NO)) return true;
      // (The backdrop round the form is a miss: a tap there would put it away.)
      if (el.matches('[data-testid="tienda-order"]')) return true;
      return !el.closest(OK);
    };
    const block = (e) => {
      if (!missed(e)) {
        // (Any tap but on the button itself lights it, as before.)
        if (e.type === "pointerdown" && !(e.target && e.target.closest && e.target.closest('[data-testid="tienda-order-place"]'))) setBtnGlow(true);
        return;
      }
      e.stopImmediatePropagation(); e.stopPropagation();
      if (e.cancelable && e.type !== "pointermove" && e.type !== "touchmove" && e.type !== "wheel") e.preventDefault();
      if (e.type === "pointerdown" || (e.type === "touchstart" && !window.PointerEvent)) { setBtnGlow(true); throb(); }
    };
    const EVENTS = ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "touchstart", "touchend", "mousedown", "mouseup", "change", "input"];
    // (Drags and the wheel off the form are stopped too: the board stays put.)
    const offForm = (e) => { const el = e.target && e.target.closest ? e.target : null; if (el && !el.closest('[data-testid="tienda-order"]')) { e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable && e.type === "wheel") e.preventDefault(); } };
    // (And Escape doesn't put it away.)
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); } };
    window.addEventListener("keydown", onKey, true);
    EVENTS.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
    ["pointermove", "touchmove", "wheel"].forEach((ev) => window.addEventListener(ev, offForm, { capture: true, passive: false }));
    return () => {
      window.removeEventListener("keydown", onKey, true);
      EVENTS.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));
      ["pointermove", "touchmove", "wheel"].forEach((ev) => window.removeEventListener(ev, offForm, { capture: true }));
    };
  }, [where]);
  React.useEffect(() => { if (!nudge) return undefined; const id = setTimeout(() => setNudge(0), 3800); return () => clearTimeout(id); }, [nudge]);
  React.useEffect(() => { if (!waiting) setNudge(0); }, [waiting]);
  const place = () => {
    if (waiting) { click(); setNudge((n) => n + 1); return; }
    if (over || !fits || filled) return;
    setFilled(true);
    audio && audio.playOrderFilled && audio.playOrderFilled();
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // (The stamp stays long enough to read before the form goes: user.)
    setTimeout(() => onPlace(sel), reduced ? 900 : 2700);
  };
  const standard = () => { click(); replace(defaultSelections()); };
  const lawsOn = LAW_OPTIONS.filter((l) => sel.laws[l.key]).length;
  const summary = classic
    ? `${total} pieces a side · ${boardLabel(sel)} board`
    : `${total} pieces a side · ${lawsOn} ${lawsOn === 1 ? "rule" : "rules"} · ${boardLabel(sel)} board${sel.missing ? ` · ${sel.missingCount} cut ${sel.missingCount === 1 ? "pair" : "pairs"}` : ""}`;
  // The form's sections, numbered as they come (the classic page has no Rules).
  let secNo = 0;
  const sec = (title, note, ...body) => h("div", { className: "td-sec" },
    h("div", { className: "td-sec-h" }, `${++secNo} · ${title}`, note ? h("small", null, note) : null),
    ...body);

  return h("div", { className: "td-layer", "data-testid": "tienda-order", "data-classic": classic ? "true" : "false", "data-filled": filled ? "true" : "false", role: "dialog", "aria-modal": "true", "aria-label": "Order form: custom rules", onClick: (e) => { if (e.target === e.currentTarget && !filled) onCancel(); } },
    h(Style),
    h("div", { className: `td-form${filled ? " td-filled" : ""}` },
      h("div", { className: "td-form-scroll" },
        h("div", { className: "td-stamp", "aria-hidden": "true" }, "Store use only"),
        h("div", { className: "td-form-head" },
          h("div", null,
            h("div", { className: "td-form-sub" }, "Games & Hobby Dept. · Fall & Winter Catalog 1975"),
            h("h2", { className: "td-form-title" }, "ORDER FORM"),
          ),
          h("div", { className: "td-form-note" }, "Please print. Mark boxes with an X."),
        ),
        sec("Pieces", "quantity for each side — the other side gets the same",
          pieceRows,
          h("div", { className: `td-total${over ? " over" : ""}`, "data-testid": "tienda-piece-total" },
            h("span", null, "Pieces per side"),
            h("span", null, over ? `${total} — ${MAX_PIECES} is the most a side can have` : `${total} of ${MAX_PIECES}`)),
          fitNote,
        ),
        !classic && sec("Rules", "check each one you want", lawRows),
        // The board's size (and cut squares) wait for the Singularity; the
        // classic page has the one 10 x 10 board and no Board section.
        !classic && sec("Board", "any width and length; each side starts in its two home rows",
          boardRows,
          sizeRow,
          check("missing", !!sel.missing, "Missing squares", "Pairs of squares cut clean out of the board; nothing can stand on them or pass over them.", () => change((s) => { s.missing = !s.missing; if (s.missing) fillSpots(s, "missing"); })),
          missingRows,
        ),
        sec("Who's playing", null, h(OpponentSection, { x, audio })),
        sec("Carbon copies", "keep this order to use again (this browser only; not the opponent)",
          h(CarbonCopies, { sel, audio, onLoad: (n) => replace(n) }),
        ),
      ),
      h("div", { className: "td-foot" },
        h("div", { className: "td-foot-total", "data-testid": "tienda-order-summary" }, summary, h("br"), h("b", null, !fits ? "Won't fit this board — see Pieces" : where === "guided" ? "Special order: at your Big Glutts, Games Dept." : where === "home" ? "Delivered to your home" : "No charge — in-store demonstration")),
        h("div", { className: "td-foot-btns" },
          h("button", { type: "button", className: "td-btn td-plain" + (where === "guided" ? " td-locked" : ""), "data-testid": "tienda-order-cancel", onClick: onCancel, disabled: filled, "aria-disabled": where === "guided" ? "true" : undefined }, "Cancel"),
          h("button", { type: "button", className: "td-btn td-plain" + (where === "guided" ? " td-locked" : ""), "data-testid": "tienda-order-standard", onClick: standard, disabled: filled, "aria-disabled": where === "guided" ? "true" : undefined }, "Standard"),
          h("button", {
            type: "button", "data-testid": "tienda-order-place", disabled: over || !fits || filled, onClick: place,
            className: `td-btn td-primary${btnGlow ? " td-sing-glow" : ""}${waiting ? " td-wait" : ""}`,
            "aria-disabled": waiting ? "true" : undefined, "data-waiting": waiting ? "true" : "false",
          }, where === "guided" ? "Order it at Big Glutts \u203a" : "Place order & play"),
        ),
        nudge ? h("p", { key: nudge, className: "td-nudge", role: "alert", "data-testid": "tienda-order-nudge" }, "Be sure to order some new special pieces first \u2014 or new rules, or a new board.") : null,
      ),
      filled && h("div", { className: "td-filled-stamp", "data-testid": "tienda-order-stamp", "aria-hidden": "true" },
        where === "guided" ? [h("b", { key: "b" }, "Take to store"), h("span", { key: "s" }, "Special order · Big Glutts · Dept. 49")] : [h("b", { key: "b" }, "Order filled"), h("span", { key: "s" }, "Games & Hobby · Dept. 49")]),
    ),
    viewer && h(WoodPieceViewer, {
      key: viewer.key,
      type: viewer.type, name: viewer.name, detail: viewer.detail, cat: viewer.cat, price: viewer.price,
      fromRect: viewer.rect, closing: viewer.closing, audio,
      onClose: closeViewer,
      onClosed: () => setViewer(null),
    }),
    picker && h(SquarePicker, {
      key: picker, sel, kind: picker, audio,
      onDone: (d) => { replace(d); setPicker(null); },
      onCancel: () => setPicker(null),
    }),
  );
}

// Fewer missing pairs: rolled spots go first, then the last placed.
function trimSpots(spots, count) {
  const list = spots.slice();
  while (list.length > count) {
    const i = list.map((p) => p.random).lastIndexOf(true);
    list.splice(i >= 0 ? i : list.length - 1, 1);
  }
  return list;
}
// Is anything marked in a side's two home rows?
function bandHasMarks(sel) {
  return [...missingCellsOf(sel), ...holeCellsOf(sel)].some((c) => c.row < 2 || c.row >= sel.rows - 2);
}
