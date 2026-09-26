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

import React from "react";
import {
  PIECE_OPTIONS, LAW_OPTIONS, ARCO_SIZES, MAX_PIECES, MAX_MISSING_PAIRS, MIN_BOARD_DIM, MAX_BOARD_DIM,
  defaultSelections, cloneSelections, normalizeSelections, totalPieces, toggleLaw, beginCustomGame, piecesFit, minColsFor, boardLabel, clampDim,
  pieceTypeOf, lawWarnings, fillSpots, refreshSpots, missingCellsOf, holeCellsOf,
} from "./rules-selections.js";
import { SquarePicker, OpponentSection, CarbonCopies, OrderSlip, ORDER_PARTS_CSS } from "./tienda-order.js";
import { ensurePaper } from "./tienda-textures.js";
import { WoodPieceViewer, ensureWoodPhotos, woodPhoto, hasWoodShowcase } from "./tienda-showcase.js";
import boxArtUrl from "../assets/tienda/box-art.jpg";

const h = React.createElement;
const INK = "#2E2118", RED = "#A33F33", PAPER = "#EFE6CD";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";
const BODONI = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";

// The lid shows once per visit, not again after every New Game.
let lidDone = false;

/* ------------------------------------------------------------ setup extras */

export function useSetupExtras(x) {
  const [overlay, setOverlay] = React.useState(() => (x.awaitingBegin && !lidDone ? "lid" : null));
  const selRef = React.useRef(null);
  if (!selRef.current) selRef.current = defaultSelections();
  React.useEffect(() => { if (!x.awaitingBegin && overlay) setOverlay(null); }, [x.awaitingBegin]);
  React.useEffect(() => { ensurePaper(); }, []);
  return {
    ...x,
    tiendaOverlay: overlay,
    openOrderForm: () => { x.audio && x.audio.playRulesOpen && x.audio.playRulesOpen(); setOverlay("order"); },
    closeOverlay: () => setOverlay(null),
    reopenOrder: (sel) => { if (sel) selRef.current = sel; setOverlay("order"); },
    selRef,
  };
}

export function renderExtraOverlays(x) {
  if (!x) return null;
  // In a game: the sales slip of what was ordered.
  if (x.isPlaying && !x.awaitingBegin) return h(OrderSlip, { key: "slip", groups: x.currentVariants, audio: x.audio });
  if (!x.tiendaOverlay || !x.awaitingBegin) return null;
  if (x.tiendaOverlay === "lid") {
    return h(BoxLid, {
      key: "lid",
      onOpen: () => { lidDone = true; x.audio && x.audio.startStore && x.audio.startStore(); x.closeOverlay(); },
      onOrder: () => { lidDone = true; x.audio && x.audio.startStore && x.audio.startStore(); x.openOrderForm(); },
      audio: x.audio,
    });
  }
  return h(OrderForm, {
    key: "order",
    initial: x.selRef.current,
    onChange: (s) => { x.selRef.current = s; },
    onCancel: () => { x.audio && x.audio.playRulesClose && x.audio.playRulesClose(); x.closeOverlay(); },
    onPlace: (sel) => beginCustomGame(sel, x, (s) => x.reopenOrder && x.reopenOrder(s), { labels: TIENDA_VARIANT_LABELS }),
    audio: x.audio,
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
  /* A piece's photograph: tap it to take the piece up in 3-D. */
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
  .td-filled { animation: tdFormAway 0.5s ease 0.62s both; }
  @keyframes tdFormAway { to { transform: translateY(24px); opacity: 0; } }
  @media (max-width: 560px) { .td-sub, .td-warn { margin-left: 0; } }
  @media (prefers-reduced-motion: reduce) { .td-filled-stamp, .td-filled { animation: none; } }
`;
const Style = () => h("style", null, CSS + MORE_CSS + ORDER_PARTS_CSS);

/* ------------------------------------------------------------ the box lid */

function BoxLid({ onOpen, onOrder, audio }) {
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
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-lid-order", onClick: () => go("order") }, "Custom rules"),
        ),
        h("div", { className: "td-small", style: { color: "rgba(233,220,192,0.55)", letterSpacing: "0.1em" } }, "No. 4417 · Made in U.S.A. · © 1975"),
      ),
      h("div", { className: "td-sticker", "aria-label": "Price 7 dollars 97" }, "$7.97"),
    ),
  );
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
  arco: ["49 T 4407", "55¢", "An arch. A Cabeza in its opening is sheltered."],
  rayo: ["49 T 4408", "45¢", "Four cubes, an S."],
  zeta: ["49 T 4409", "55¢", "Five cubes, a Z."],
};
// The Arco sizes as the catalog lists them.
const ARCO_CATALOG = { chico: ["49 T 4407", "55¢"], alto: ["49 T 4412", "75¢"], ancho: ["49 T 4413", "65¢"] };
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

function OrderForm({ initial, onChange, onCancel, onPlace, audio, x }) {
  const [sel, setSel] = React.useState(() => normalizeSelections(cloneSelections(initial || defaultSelections())));
  const change = (fn) => setSel((s) => { const n = cloneSelections(s); fn(n); onChange && onChange(n); return n; });
  const replace = (n) => { setSel(n); onChange && onChange(n); };
  const click = () => { audio && audio.playSelect && audio.playSelect(); };
  const total = totalPieces(sel), over = total > MAX_PIECES;
  const fits = piecesFit(sel), need = fits ? null : minColsFor(sel);
  const warnings = lawWarnings(sel);
  // The piece taken up off the page, if any: { key, type, name, detail, cat, price, rect, closing }.
  const [viewer, setViewer] = React.useState(null);
  // The board being marked ("missing" | "hole"), if any.
  const [picker, setPicker] = React.useState(null);
  // The order going through: the stamp, the register, then the game.
  const [filled, setFilled] = React.useState(false);
  const photoTypes = [...PIECE_OPTIONS.map((p) => p.key), ...ARCO_SIZES.map((a) => a.type)];
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

  const pieceRows = PIECE_OPTIONS.map((p) => {
    const n = sel.counts[p.key];
    const isArco = p.key === "arco";
    const arco = isArco ? ARCO_SIZES.find((a) => a.key === sel.arcoSize) || ARCO_SIZES[0] : null;
    const [cat0, price0, note] = CATALOG[p.key] || ["", "", ""];
    const [cat, price] = isArco ? ARCO_CATALOG[arco.key] : [cat0, price0];
    const type = pieceTypeOf(p.key, sel);
    const name = isArco ? `Arco ${arco.name}` : p.name;
    const set = (v) => { click(); change((s) => { s.counts[p.key] = Math.max(p.min, Math.min(p.max, v)); }); };
    const viewing = !!(viewer && viewer.key === p.key);
    const photo = hasWoodShowcase(type)
      ? h("button", {
          type: "button", className: "td-photo-btn", "data-testid": `tienda-view-${p.key}`, "data-viewing": viewing ? "true" : "false", "data-type": type,
          "aria-label": `Take up the ${name} and turn it over in 3-D`,
          onClick: (e) => {
            if (viewer) return;
            click();
            setViewer({ key: p.key, type, name, detail: isArco ? `${note} ${arco.note}.` : note, cat, price, rect: e.currentTarget.getBoundingClientRect(), closing: false });
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
    if (!isArco) return row;
    // The Arco's size, for every Arco in the game.
    return [row, h("div", { key: "arco-size", className: "td-sub", "data-testid": "tienda-arco-size" },
      h("span", { className: "td-sub-h" }, "Size"),
      h("div", { className: "td-seg", role: "group", "aria-label": "Arco size" },
        ...ARCO_SIZES.map((a) => h("button", {
          key: a.key, type: "button", "aria-pressed": sel.arcoSize === a.key ? "true" : "false", "data-testid": `tienda-arco-${a.key}`,
          onClick: () => { click(); change((s) => { s.arcoSize = a.key; }); },
        }, `${a.name} · ${a.note}`)),
      ))];
  });

  const check = (id, on, title, note, onToggle, extra) => h("label", { key: id, className: "td-check", "data-testid": `tienda-${id}` },
    h("input", { type: "checkbox", checked: on, onChange: () => { click(); onToggle(); }, "data-testid": `tienda-${id}-input` }),
    h("span", { className: "td-box", "aria-hidden": "true" }, on ? "✕" : ""),
    h("span", null, h("b", null, title), note ? h("span", null, note) : null, extra || null),
  );
  const warnFor = (key) => warnings.filter((w) => w.key === key).map((w) => h("div", { key: w.testid, className: "td-warn", role: "status", "data-testid": w.testid }, h("span", { "aria-hidden": "true" }, "☞ "), w.text));
  const spotsLine = (list, mark) => (list.length ? list.map((p) => `${mark} row ${p.row + 1}, col ${p.col + 1}${p.random ? " (random)" : ""}`).join(" · ") : "none yet");

  const lawRows = LAW_OPTIONS.flatMap((l) => {
    const on = !!sel.laws[l.key];
    const info = h("button", { type: "button", className: "td-info", "data-testid": `tienda-law-${l.key}-info`, onClick: (e) => { e.preventDefault(); e.stopPropagation(); explain(l.key); } }, "How it works ›");
    const out = [check(`law-${l.key}`, on, l.name, l.note, () => change((s) => toggleLaw(s, l.key)), info)];
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

  const place = () => {
    if (over || !fits || filled) return;
    setFilled(true);
    audio && audio.playOrderFilled && audio.playOrderFilled();
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => onPlace(sel), reduced ? 250 : 1150);
  };
  const standard = () => { click(); replace(defaultSelections()); };
  const lawsOn = LAW_OPTIONS.filter((l) => sel.laws[l.key]).length;
  const summary = `${total} pieces a side · ${lawsOn} ${lawsOn === 1 ? "rule" : "rules"} · ${boardLabel(sel)} board${sel.missing ? ` · ${sel.missingCount} cut ${sel.missingCount === 1 ? "pair" : "pairs"}` : ""}`;

  return h("div", { className: "td-layer", "data-testid": "tienda-order", "data-filled": filled ? "true" : "false", role: "dialog", "aria-modal": "true", "aria-label": "Order form: custom rules", onClick: (e) => { if (e.target === e.currentTarget && !filled) onCancel(); } },
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
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "1 · Pieces", h("small", null, "quantity for each side — the other side gets the same")),
          pieceRows,
          h("div", { className: `td-total${over ? " over" : ""}`, "data-testid": "tienda-piece-total" },
            h("span", null, "Pieces per side"),
            h("span", null, over ? `${total} — ${MAX_PIECES} is the most a side can have` : `${total} of ${MAX_PIECES}`)),
          fitNote,
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "2 · Rules", h("small", null, "check each one you want")),
          lawRows,
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "3 · Board", h("small", null, "any width and length; each side starts in its two home rows")),
          boardRows,
          sizeRow,
          check("missing", !!sel.missing, "Missing squares", "Pairs of squares cut clean out of the board; nothing can stand on them or pass over them.", () => change((s) => { s.missing = !s.missing; if (s.missing) fillSpots(s, "missing"); })),
          missingRows,
          check("random", !!sel.random, "Shuffled start", "Pieces set out at random in each side's home rows, mirrored.", () => change((s) => { s.random = !s.random; })),
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "4 · Who's playing"),
          h(OpponentSection, { x, audio }),
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "5 · Carbon copies", h("small", null, "keep this order to use again (this browser only; not the opponent)")),
          h(CarbonCopies, { sel, audio, onLoad: (n) => replace(n) }),
        ),
      ),
      h("div", { className: "td-foot" },
        h("div", { className: "td-foot-total", "data-testid": "tienda-order-summary" }, summary, h("br"), h("b", null, fits ? "No charge — in-store demonstration" : "Won't fit this board — see Pieces")),
        h("div", { className: "td-foot-btns" },
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-order-cancel", onClick: onCancel, disabled: filled }, "Cancel"),
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-order-standard", onClick: standard, disabled: filled }, "Standard"),
          h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-order-place", disabled: over || !fits || filled, onClick: place }, "Place order & play"),
        ),
      ),
      filled && h("div", { className: "td-filled-stamp", "data-testid": "tienda-order-stamp", "aria-hidden": "true" }, h("b", null, "Order filled"), h("span", null, "Games & Hobby · Dept. 49")),
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
