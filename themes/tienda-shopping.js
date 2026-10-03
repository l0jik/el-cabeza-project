/* Shopping in the story's store (Nova, Tienda's games department), before
   the game's been bought. The player has no idea there's anything beyond
   the standard game here (user: "Your order: standard" tipped the hand),
   so nothing in the store talks of orders or rules; it only sells the
   game, the way a 1975 store would:

   - its price tag (top left, in a game), which unfolds into the shelf
     ticket: the game, the aisle, the price, and "Put one in the cart";
   - the cart: once one's in it, the tag becomes the cart ("Cart · 1
     item"), and "Check out" is the purchase (story.onPurchase); the
     dock's own button says the same (tienda.js);
   - the store's PA (on the first visit): a few moves into the first
     game, or a while after arriving, the chime and an announcement (its
     words as a caption, lettered as the clerk scene's PA is): El Cabeza
     in stock in Aisle 9, Register 3 open; a tap on it puts one in the
     cart;
   - closing time: later, the lights go down a step (a flicker, then
     dimmer, and they stay so), and the PA: the store closing in ten
     minutes, final purchases to the front; a tap on it checks out.

   The cart is kept for the page (module level) and emptied at each new
   visit; the PA's moments once each, per visit. */

import React from "react";

const h = React.createElement;
const INK = "#2E2118", RED = "#A33F33", PAPER = "#EFE6CD";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";
export const PRICE = "$7.97";

/* ---- the cart ---- */
const CART = { n: 0, subs: new Set(), bump: 0 };
const tell = () => CART.subs.forEach((f) => f());
export function cartCount() { return CART.n; }
export function addToCart() { if (!CART.n) { CART.n = 1; } CART.bump++; tell(); }
export function emptyCart() { if (CART.n || CART.bump) { CART.n = 0; tell(); } }
export function useCart() {
  const [, set] = React.useState(0);
  React.useEffect(() => { const f = () => set((k) => k + 1); CART.subs.add(f); return () => { CART.subs.delete(f); }; }, []);
  return CART.n;
}

/* ---- the PA's moments, once each a visit ---- */
const PA = { said: { instock: false, closing: false }, at: 0 };
export function resetShopping() { PA.said = { instock: false, closing: false }; PA.at = 0; emptyCart(); setDim(false); }
const LINES = {
  instock: "Attention shoppers: El Cabeza, the game of unparalleled intention, is now in stock in the Games Department, Aisle 9. Register 3 is open.",
  closing: "Attention shoppers: the store will be closing in ten minutes. Please bring your final purchases to the front registers. Thank you for shopping with us.",
};

/* ---- the lights going down (closing time) ---- */
const DIM_CSS = `
  .td-closing-dim { position: fixed; inset: 0; z-index: 2; pointer-events: none; background: rgba(14, 9, 4, 0.0); mix-blend-mode: multiply; transition: background-color 0.9s ease; }
  .td-closing-dim[data-on="true"] { background: rgba(14, 9, 4, 0.34); }
  .td-closing-dim[data-flick="true"] { transition: none; background: rgba(14, 9, 4, 0.62); }
`;
function setDim(on) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(".td-closing-dim");
  if (!on) { if (el) el.remove(); return; }
  if (!document.getElementById("td-closing-css")) { const st = document.createElement("style"); st.id = "td-closing-css"; st.textContent = DIM_CSS; document.head.appendChild(st); }
  if (!el) { el = document.createElement("div"); el.className = "td-closing-dim"; el.setAttribute("data-testid", "tienda-closing-dim"); document.body.appendChild(el); }
  // (A row of tubes going off: two quick flickers, then down a step.)
  const steps = [[0, true], [90, false], [260, true], [330, false], [520, true]];
  steps.forEach(([ms, flick]) => setTimeout(() => { if (el.isConnected) el.setAttribute("data-flick", flick ? "true" : "false"); }, ms));
  setTimeout(() => { if (el.isConnected) { el.setAttribute("data-flick", "false"); el.setAttribute("data-on", "true"); } }, 620);
}

/* ---- the look ---- */
const CSS = `
  .td-shop { position: fixed; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); z-index: 40;
    display: flex; flex-direction: column; align-items: flex-start; gap: 6px; max-width: calc(100vw - 24px); }
  .td-shop-tag { position: relative; display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 6px 12px 6px 22px; border: 1px solid rgba(46,33,24,0.45);
    border-radius: 2px 10px 10px 2px; background-color: ${PAPER}; background-image: var(--tienda-paper); color: ${INK}; cursor: pointer;
    font: 800 11px/1 ${FRANKLIN}; letter-spacing: 0.14em; text-transform: uppercase; box-shadow: 0 3px 8px rgba(20,12,6,0.35); opacity: 0.86; }
  .td-shop-tag::before { content: ""; position: absolute; left: 8px; top: 50%; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%;
    background: #3a2a1d; box-shadow: inset 0 0 0 1.5px #c9a24a; }
  .td-shop-tag small { font: 700 12px/1 ${COURIER}; letter-spacing: 0; text-transform: none; color: ${RED}; }
  .td-shop[data-open="true"] .td-shop-tag { opacity: 1; }
  .td-shop-tag:focus-visible, .td-shop-go:focus-visible, .td-pa:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
  .td-shop-paper { min-width: 210px; max-width: min(280px, calc(100vw - 24px)); padding: 12px 14px; background: #F4F0E4; background-image: var(--tienda-paper);
    color: ${INK}; font: 400 12px/1.5 ${COURIER}; box-shadow: 0 10px 26px rgba(20,12,6,0.45); }
  .td-shop-paper b { display: block; font: 800 15px/1.15 ${FRANKLIN}; letter-spacing: 0.06em; text-transform: uppercase; }
  .td-shop-paper .td-shop-price { display: block; margin-top: 4px; font: 700 18px/1 ${COURIER}; color: ${RED}; }
  .td-shop-go { all: unset; display: inline-block; margin-top: 8px; min-height: 30px; cursor: pointer; font: 700 12px/30px ${COURIER}; color: ${RED}; text-decoration: underline; }
  /* The cart, once something's in it. */
  .td-cart { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 4px 6px 4px 10px; background: ${INK}; color: ${PAPER}; border-radius: 3px;
    box-shadow: 0 4px 10px rgba(20,12,6,0.4); font: 800 11px/1 ${FRANKLIN}; letter-spacing: 0.14em; text-transform: uppercase; }
  .td-cart svg { flex: none; }
  .td-cart button { all: unset; cursor: pointer; padding: 8px 10px; background: ${RED}; color: #FFF4E2; border-radius: 2px; font: 800 11px/1 ${FRANKLIN}; letter-spacing: 0.14em; }
  .td-cart button:focus-visible { outline: 2px solid ${PAPER}; outline-offset: 2px; }
  .td-cart[data-bump="true"] { animation: tdCartIn 0.5s cubic-bezier(.2,1.5,.4,1) both; }
  @keyframes tdCartIn { from { transform: translateY(-8px) scale(0.92); opacity: 0; } to { transform: none; opacity: 1; } }
  /* The PA's words, lettered as the clerk scene's PA is; a tap acts on them. */
  .td-pa { all: unset; box-sizing: border-box; position: fixed; z-index: 41; left: 50%; top: max(64px, calc(env(safe-area-inset-top) + 56px)); transform: translateX(-50%) rotate(-0.6deg);
    width: min(440px, calc(100vw - 28px)); padding: 9px 12px 8px 40px; background: #F3D85A; color: #17110D; border: 2px solid #17110D; box-shadow: 3px 3px 0 rgba(23,17,13,0.85);
    font: 700 12.5px/1.3 'Comic Neue', 'Comic Sans MS', ${COURIER}; letter-spacing: 0.03em; text-transform: uppercase; cursor: pointer;
    animation: tdPaIn 0.4s ease both; }
  .td-pa::before { content: ""; position: absolute; left: 11px; top: 50%; width: 18px; height: 18px; margin-top: -9px;
    background: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2317110D' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10v4h4l5 4V6L7 10z'/%3E%3Cpath d='M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12'/%3E%3C/svg%3E"); }
  .td-pa small { display: block; margin-top: 4px; font: 700 10.5px/1 ${COURIER}; letter-spacing: 0.06em; text-transform: none; text-decoration: underline; }
  .td-pa[data-going="true"] { transition: opacity 0.6s ease; opacity: 0; }
  @keyframes tdPaIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px) rotate(-0.6deg); } to { opacity: 1; transform: translateX(-50%) rotate(-0.6deg); } }
  @media (prefers-reduced-motion: reduce) { .td-pa, .td-cart[data-bump="true"] { animation: none; } }
`;
const cartIcon = () => h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
  h("path", { d: "M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.4-1l1.6-6.3H6.2" }), h("circle", { cx: 9.5, cy: 19.5, r: 1.4 }), h("circle", { cx: 17, cy: 19.5, r: 1.4 }));

/* The tag (in a game) or the cart (once one's in it), top left. */
export function ShopCorner({ inGame, audio, onPurchase }) {
  const n = useCart();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const lastBump = React.useRef(CART.bump);
  const bumped = CART.bump !== lastBump.current;
  React.useEffect(() => { lastBump.current = CART.bump; });
  React.useEffect(() => {
    const fold = () => setOpen(false);
    window.addEventListener("td-pa-speak", fold);
    return () => window.removeEventListener("td-pa-speak", fold);
  }, []);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && e.target && rootRef.current.contains(e.target)) return; setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown, true); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown, true); window.removeEventListener("keydown", onKey); };
  }, [open]);
  const sel = () => { audio && audio.playSelect && audio.playSelect(); };
  if (n) {
    return h("div", { ref: rootRef, className: "td-shop", "data-testid": "tienda-shop" }, h("style", null, CSS),
      h("div", { className: "td-cart", "data-testid": "tienda-cart", "data-bump": bumped ? "true" : "false", role: "status", "aria-label": `Cart: ${n} item` },
        cartIcon(), h("span", null, `Cart · ${n} item`),
        h("button", { type: "button", "data-testid": "tienda-cart-checkout", onClick: () => { sel(); onPurchase && onPurchase(); } }, `Check out · ${PRICE}`)));
  }
  if (!inGame) return null;
  return h("div", { ref: rootRef, className: "td-shop", "data-testid": "tienda-shop", "data-open": open ? "true" : "false" }, h("style", null, CSS),
    h("button", { type: "button", className: "td-shop-tag", "data-testid": "tienda-price-tag", "aria-expanded": open ? "true" : "false",
      onClick: () => { setOpen((o) => !o); audio && audio.playMenu && audio.playMenu(); } }, "El Cabeza", h("small", null, PRICE)),
    open && h("div", { className: "td-shop-paper", "data-testid": "tienda-price-paper" },
      h("b", null, "El Cabeza"),
      h("span", null, "A Game of Unparalleled Intention. Games Dept. · Aisle 9."),
      h("span", { className: "td-shop-price" }, PRICE),
      h("button", { type: "button", className: "td-shop-go", "data-testid": "tienda-price-cart", onClick: () => { sel(); addToCart(); setOpen(false); } }, "Put one in the cart ›")));
}

/* The PA, on the first visit: in stock (a few moves into the first game,
   or a while after arriving), then, later, closing time. */
const IN_STOCK_MOVES = 4, IN_STOCK_MS = 75000, CLOSING_MS = 120000, CLOSING_MIN_MS = 35000;
export function StorePA({ active, game, audio, onPurchase }) {
  const [say, setSay] = React.useState(null);   // "instock" | "closing" | null
  const [going, setGoing] = React.useState(false);
  const arrivedAt = React.useRef(performance.now());
  const moves = game && game.log ? game.log.length : 0;
  const finished = !!(game && (game.status === "finished" || game.status === "ended"));
  const t = (k, d) => (typeof window !== "undefined" && typeof window[k] === "number" ? window[k] : d);
  const speak = React.useCallback((which) => {
    PA.said[which] = true; PA.at = performance.now();
    // (The price tag folds itself away, so the words don't cover it.)
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("td-pa-speak"));
    if (audio && audio.playPage) audio.playPage();
    if (which === "closing") setDim(true);
    setGoing(false); setSay(which);
  }, [audio]);
  // In stock: four moves into a game, or a while after arriving.
  React.useEffect(() => {
    if (!active || PA.said.instock) return undefined;
    if (moves >= IN_STOCK_MOVES) { speak("instock"); return undefined; }
    const id = setTimeout(() => speak("instock"), Math.max(0, t("__EC_TEST_PA_MS__", IN_STOCK_MS) - (performance.now() - arrivedAt.current)));
    return () => clearTimeout(id);
  }, [active, moves, speak]);
  // Closing time: a while after that, or when a game ends (not too soon).
  React.useEffect(() => {
    if (!active || !PA.said.instock || PA.said.closing) return undefined;
    const since = performance.now() - PA.at, min = t("__EC_TEST_CLOSING_MIN_MS__", CLOSING_MIN_MS);
    if (finished && since >= min) { speak("closing"); return undefined; }
    const wait = finished ? min - since : t("__EC_TEST_CLOSING_MS__", CLOSING_MS) - since;
    const id = setTimeout(() => speak("closing"), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [active, finished, say, speak]);
  // The words stay a while, then go.
  React.useEffect(() => {
    if (!say) return undefined;
    const a = setTimeout(() => setGoing(true), say === "closing" ? 12000 : 10000);
    const b = setTimeout(() => { setSay(null); setGoing(false); }, say === "closing" ? 12700 : 10700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [say]);
  React.useEffect(() => { if (!active) setSay(null); }, [active]);
  if (!active || !say) return null;
  return h("button", {
    type: "button", className: "td-pa", "data-testid": `tienda-pa-${say}`, "data-going": going ? "true" : "false", role: "status", "aria-live": "polite",
    onClick: () => {
      audio && audio.playSelect && audio.playSelect();
      setSay(null);
      if (say === "closing") { addToCart(); onPurchase && onPurchase(); } else addToCart();
    },
  }, h("style", null, CSS), LINES[say], h("small", null, say === "closing" ? "Take it to the register ›" : "Put one in the cart ›"));
}

export function useShoppingVisit(active) {
  // (A fresh visit: an empty cart, the PA's moments still to come, the
  // lights up; and the lights up again once it's over.)
  React.useEffect(() => {
    if (!active) return undefined;
    resetShopping();
    return () => setDim(false);
  }, [active]);
}

if (typeof window !== "undefined") window.__TIENDA_SHOP__ = () => ({ cart: CART.n, said: { ...PA.said }, dim: !!document.querySelector('.td-closing-dim[data-on="true"]') });
