/* The journey: the extras are kept back until the player has been into
   the Singularity once (the user: the store and the den, and Neon before
   its sphere, are the classic game; the sphere unlocks the rest, for good,
   until Nova's "Start the story over").

   "The extras" are everything past the classic game: the pieces beyond
   the five, the laws, and the board's holes and cut squares. While they're
   locked, the rules cards (chassis/RulesCards.jsx, via ElCabeza3D.jsx)
   describe only the classic game, and the catalog's order form
   (themes/tienda-overlay.js) offers only the five pieces and the board's
   size. A theme opts in with `lockExtrasUntilSingularity` (Tienda,
   Standard and Neon, on their own pages and in Nova alike).

   Kept in localStorage, so it's the same on every page of the site: a
   visit to the sphere anywhere unlocks them everywhere. If storage is
   blocked, it lasts the visit. A change is announced on JOURNEY_EVENT (and
   another tab's, by the browser's own storage event). */

export const SINGULARITY_SEEN_KEY = "el-cabeza:singularity-seen";
export const JOURNEY_EVENT = "el-cabeza:journey";

// The classic game's pieces: the five in the box.
export const CLASSIC_PIECE_KEYS = ["cabeza", "turrito", "flaco", "chato", "opa"];

let seenThisVisit = false;
/* A preview (Nova's ?scene=summons): this visit plays the first trip
   through the set as if the sphere had never been seen, and remembers
   what happens in memory only, so the player's real journey (stored) is
   neither read nor changed. */
let preview = false;
export function journeyPreview() { preview = true; seenThisVisit = false; airedThisVisit = false; }

export function singularitySeen() {
  if (seenThisVisit) return true;
  if (preview) return false;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SINGULARITY_SEEN_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(JOURNEY_EVENT));
}

// The sphere has opened (themes/neon-singularity.js): the extras unlock.
export function markSingularitySeen() {
  if (singularitySeen()) return;
  seenThisVisit = true;
  if (!preview) try { localStorage.setItem(SINGULARITY_SEEN_KEY, "1"); } catch (e) { /* this visit only */ }
  announce();
}

// Nova's "Start the story over" (apps/unified.jsx): locked again.
// The one-time note that the catalog's special orders are open (the
// store's printed matter, themes/tienda-overlay.js), shown once per unlock.
export const SPECIAL_ORDER_NOTED_KEY = "el-cabeza:special-order-noted";
// The den's late-night commercial (themes/den-commercial.js): shown once,
// back out of Singularity the first time, in Nova.
export const COMMERCIAL_AIRED_KEY = "el-cabeza:commercial-aired";
export function forgetSingularity() {
  seenThisVisit = false;
  try { [SINGULARITY_SEEN_KEY, SPECIAL_ORDER_NOTED_KEY, COMMERCIAL_AIRED_KEY].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nothing kept */ }
  announce();
}
let airedThisVisit = false;
export function commercialAired() {
  if (airedThisVisit) return true;
  if (preview) return false;
  try { return localStorage.getItem(COMMERCIAL_AIRED_KEY) === "1"; } catch (e) { return false; }
}
export function markCommercialAired() {
  airedThisVisit = true;
  if (!preview) try { localStorage.setItem(COMMERCIAL_AIRED_KEY, "1"); } catch (e) { /* this visit only */ }
}
/* While the commercial is on, the catalog's own note that special orders
   are open waits (it would say the same thing over the top of it). */
let commercialOn = false;
export function isCommercialOn() { return commercialOn; }
export function setCommercialOn(on) {
  if (commercialOn === !!on) return;
  commercialOn = !!on;
  // (The page's own controls ghost while it plays: html.ec-commercial,
  // themes/standard.js.)
  if (typeof document !== "undefined") document.documentElement.classList.toggle("ec-commercial", commercialOn);
  announce();
}

// Calls back with singularitySeen() whenever it may have changed; returns
// the unsubscribe.
export function onJourneyChange(cb) {
  if (typeof window === "undefined") return () => {};
  const onEvent = () => cb(singularitySeen());
  const onStorage = (e) => { if (!e || e.key === null || e.key === SINGULARITY_SEEN_KEY) onEvent(); };
  window.addEventListener(JOURNEY_EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(JOURNEY_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
