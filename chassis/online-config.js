/* Where the game's server is (server/cloudflare/worker.js on Cloudflare
   Workers, or server/relay.js anywhere Node runs: the relay for online
   play and the store for cloud saves). PLACEHOLDER until it's deployed
   (user: "Use placeholder information until actual information can be
   inserted"): put the deployed server's wss:// address in RELAY_URL
   (wss://el-cabeza-relay.<subdomain>.workers.dev; server/README.md),
   rebuild, push. Until then the Online and cloud-save screens say the
   server isn't set up yet.

   For trying a server without a rebuild: ?relay=ws://... on any page
   (kept for the tab), or localStorage "el-cabeza:relay". */
export const RELAY_URL = "wss://PLACEHOLDER-el-cabeza-relay.example.com";
export const RELAY_IS_PLACEHOLDER = /PLACEHOLDER/.test(RELAY_URL);
const RELAY_KEY = "el-cabeza:relay";
const TAB_KEY = "el-cabeza:relay-tab";

// The address override for this tab (?relay=) or this browser, or "".
function overrideUrl() {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("relay");
    if (q) { try { window.sessionStorage.setItem(TAB_KEY, q); } catch (e) { /* this load only */ } url.searchParams.delete("relay"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); return q; }
  } catch (e) { /* no URL */ }
  try { const t = window.sessionStorage.getItem(TAB_KEY); if (t) return t; } catch (e) { /* none */ }
  try { const l = window.localStorage.getItem(RELAY_KEY); if (l) return l; } catch (e) { /* none */ }
  return "";
}
const override = overrideUrl();

// The relay's WebSocket address, or "" while only the placeholder's there.
export function relayUrl() {
  if (override) return override.replace(/^http/, "ws");
  return RELAY_IS_PLACEHOLDER ? "" : RELAY_URL;
}
// Is a server set up at all?
export function relayReady() { return !!relayUrl(); }
// The same server over HTTP, for the saves (/saves).
export function savesBaseUrl() {
  const u = relayUrl();
  return u ? u.replace(/^ws/, "http").replace(/\/+$/, "") : "";
}
