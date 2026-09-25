/* Tienda's printed matter: the box, and the catalog's order form.

   - The box lid, when the page opens: the game as it sat on the shelf in
     1975, its lid photograph, the price sticker. "Open the box" lifts the
     lid off and brings up the store's sound (the page's first real tap,
     which is what a phone needs before it will play anything).
   - The order form, for custom rules: the kind of mail-order page the
     catalogs printed, with items to tick and quantities to fill in —
     pieces for each side, the extra rules, the board. "Place order &
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
  PIECE_OPTIONS, LAW_OPTIONS, SIZES, MAX_PIECES,
  defaultSelections, cloneSelections, totalPieces, toggleLaw, beginCustomGame,
} from "./rules-selections.js";
import { ensurePaper } from "./tienda-textures.js";
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
  if (!x || !x.tiendaOverlay || !x.awaitingBegin) return null;
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
    onPlace: (sel) => beginCustomGame(sel, x, (s) => x.reopenOrder && x.reopenOrder(s)),
    audio: x.audio,
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
  .td-form-scroll { overflow: auto; -webkit-overflow-scrolling: touch; padding: clamp(14px, 3vw, 28px) clamp(14px, 3.4vw, 32px) 8px; }
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
  .td-row { display: grid; grid-template-columns: 5.2em minmax(0, 1fr) 4em auto; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid rgba(46,33,24,0.3); min-height: 52px; }
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
  @media (max-width: 560px) {
    .td-row { grid-template-columns: minmax(0, 1fr) auto; }
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
const Style = () => h("style", null, CSS);

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
  codo: ["49 T 4406", "35¢", "Three cubes in an L."],
  arco: ["49 T 4407", "55¢", "An arch of five."],
  rayo: ["49 T 4408", "45¢", "Four cubes, an S."],
  zeta: ["49 T 4409", "55¢", "Five cubes, a Z."],
};

function OrderForm({ initial, onChange, onCancel, onPlace, audio }) {
  const [sel, setSel] = React.useState(() => cloneSelections(initial || defaultSelections()));
  const change = (fn) => setSel((s) => { const n = cloneSelections(s); fn(n); onChange && onChange(n); return n; });
  const click = () => { audio && audio.playSelect && audio.playSelect(); };
  const total = totalPieces(sel), over = total > MAX_PIECES;
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pieceRows = PIECE_OPTIONS.map((p) => {
    const n = sel.counts[p.key];
    const [cat, price, note] = CATALOG[p.key] || ["", "", ""];
    const set = (v) => { click(); change((s) => { s.counts[p.key] = Math.max(p.min, Math.min(p.max, v)); }); };
    return h("div", { key: p.key, className: "td-row", "data-testid": `tienda-piece-${p.key}` },
      h("span", { className: "td-cat" }, cat),
      h("span", { className: "td-desc" }, p.name, h("span", null, note)),
      h("span", { className: "td-price" }, price),
      h("span", { className: "td-qty" },
        h("button", { type: "button", "aria-label": `Fewer ${p.name}`, "data-testid": `tienda-piece-${p.key}-dec`, disabled: n <= p.min, onClick: () => set(n - 1) }, "−"),
        h("output", { "aria-live": "polite", "aria-label": `${n} ${p.name}` }, String(n)),
        h("button", { type: "button", "aria-label": `More ${p.name}`, "data-testid": `tienda-piece-${p.key}-inc`, disabled: n >= p.max, onClick: () => set(n + 1) }, "+"),
      ),
    );
  });

  const check = (id, on, title, note, onToggle) => h("label", { key: id, className: "td-check", "data-testid": `tienda-${id}` },
    h("input", { type: "checkbox", checked: on, onChange: () => { click(); onToggle(); }, "data-testid": `tienda-${id}-input` }),
    h("span", { className: "td-box", "aria-hidden": "true" }, on ? "✕" : ""),
    h("span", null, h("b", null, title), note ? h("span", null, note) : null),
  );

  const lawRows = LAW_OPTIONS.map((l) => check(`law-${l.key}`, !!sel.laws[l.key], l.name, l.note, () => change((s) => toggleLaw(s, l.key))));

  const sizeRow = h("div", { className: "td-sizes", role: "group", "aria-label": "Board size" },
    SIZES.map((n) => h("button", { key: n, type: "button", className: "td-size", "aria-pressed": sel.size === n ? "true" : "false", "data-testid": `tienda-size-${n}`, onClick: () => { click(); change((s) => { s.size = n; }); } }, `${n} × ${n}`)));

  const place = () => { if (over) return; audio && audio.playPowerOn && audio.playPowerOn(); onPlace(sel); };
  const standard = () => { click(); const d = defaultSelections(); setSel(d); onChange && onChange(d); };
  const lawsOn = LAW_OPTIONS.filter((l) => sel.laws[l.key]).length;

  return h("div", { className: "td-layer", "data-testid": "tienda-order", role: "dialog", "aria-modal": "true", "aria-label": "Order form: custom rules", onClick: (e) => { if (e.target === e.currentTarget) onCancel(); } },
    h(Style),
    h("div", { className: "td-form" },
      h("div", { className: "td-stamp", "aria-hidden": "true" }, "Store use only"),
      h("div", { className: "td-form-scroll" },
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
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "2 · Rules", h("small", null, "check each one you want")),
          lawRows,
        ),
        h("div", { className: "td-sec" },
          h("div", { className: "td-sec-h" }, "3 · Board"),
          sizeRow,
          check("missing", !!sel.missing, "Missing squares", "Two squares cut out of the board.", () => change((s) => { s.missing = !s.missing; })),
          check("random", !!sel.random, "Shuffled start", "Pieces set out at random in each side's home rows, mirrored.", () => change((s) => { s.random = !s.random; })),
        ),
      ),
      h("div", { className: "td-foot" },
        h("div", { className: "td-foot-total" }, `${total} pieces a side · ${lawsOn} ${lawsOn === 1 ? "rule" : "rules"} · ${sel.size} × ${sel.size}`, h("br"), h("b", null, "No charge — in-store demonstration")),
        h("div", { className: "td-foot-btns" },
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-order-cancel", onClick: onCancel }, "Cancel"),
          h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-order-standard", onClick: standard }, "Standard"),
          h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-order-place", disabled: over, onClick: place }, "Place order & play"),
        ),
      ),
    ),
  );
}
