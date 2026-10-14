/* The relay's client (server/relay.js; user: "implement online play
   against another person"): one WebSocket to the game's server, JSON
   messages each way, and a reconnect of its own when the line drops (a
   second and more between tries, up to ten), so a phone that sleeps or
   changes network picks the game back up (the chassis sends `resume` on
   each reopening, from onOpen(again = true)).

   createRelayClient(url, { onOpen(again), onMessage(msg), onClose(info) })
     .send(msg)  -> true if it went
     .close()    -> for good (no reconnect)
     .state()    -> "connecting" | "open" | "closed" | "down" */
export function createRelayClient(url, handlers = {}) {
  let ws = null, closed = false, opened = false, tries = 0, timer = null, state = "connecting";
  const ping = { timer: null };
  const open = () => {
    if (closed) return;
    state = "connecting";
    let sock;
    try { sock = new WebSocket(url); } catch (e) { state = "down"; schedule(); return; }
    ws = sock;
    sock.onopen = () => {
      if (sock !== ws) return;
      state = "open"; tries = 0;
      const again = opened; opened = true;
      // (a word now and then keeps a sleepy proxy from closing the line)
      clearInterval(ping.timer);
      ping.timer = setInterval(() => { try { if (sock.readyState === 1) sock.send(JSON.stringify({ t: "ping" })); } catch (e) { /* closing */ } }, 20000);
      if (handlers.onOpen) handlers.onOpen(again);
    };
    sock.onmessage = (e) => {
      if (sock !== ws) return;
      let msg = null;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg && msg.t && msg.t !== "pong" && handlers.onMessage) handlers.onMessage(msg);
    };
    sock.onclose = (e) => {
      if (sock !== ws) return;
      clearInterval(ping.timer);
      ws = null;
      if (closed) { state = "closed"; return; }
      state = "down";
      if (handlers.onClose) handlers.onClose({ code: e.code, reason: e.reason, again: true });
      schedule();
    };
    sock.onerror = () => { /* the close that follows says it */ };
  };
  const schedule = () => {
    if (closed) return;
    clearTimeout(timer);
    const wait = Math.min(10000, 1000 * Math.pow(2, Math.min(tries, 4))) + Math.random() * 300;
    tries += 1;
    timer = setTimeout(open, wait);
  };
  open();
  return {
    send(msg) {
      if (!ws || ws.readyState !== 1) return false;
      try { ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
    },
    close() {
      closed = true;
      clearTimeout(timer); clearInterval(ping.timer);
      const s = ws; ws = null; state = "closed";
      if (s) { try { s.close(1000); } catch (e) { /* gone */ } }
    },
    state: () => state,
  };
}

// ?join=CODE on any page (the link a host copies): the code, taken off
// the address, or null.
export function takeJoinParam() {
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("join");
    if (!c) return null;
    url.searchParams.delete("join");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const code = String(c).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return code.length === 6 ? code : null;
  } catch (e) { return null; }
}

// A link that joins a code on this page.
export function joinLink(code) {
  try {
    const url = new URL(window.location.href);
    ["join", "restore", "fresh", "switcher", "restart", "relay", "world"].forEach((k) => url.searchParams.delete(k));
    url.searchParams.set("join", code);
    return url.toString();
  } catch (e) { return ""; }
}

/* The game this tab is in, kept for a reload or a change of world (Nova
   remounts the chassis): { code, role, mySide, theirSide }. */
export const ONLINE_KEY = "el-cabeza:online";
export function keepOnlineSession(s) {
  try { if (s) window.sessionStorage.setItem(ONLINE_KEY, JSON.stringify(s)); else window.sessionStorage.removeItem(ONLINE_KEY); } catch (e) { /* this load only */ }
}
export function savedOnlineSession() {
  try { const s = JSON.parse(window.sessionStorage.getItem(ONLINE_KEY) || "null"); return s && s.code && s.role ? s : null; } catch (e) { return null; }
}
export const otherSide = (s) => (s === "dark" ? "light" : "dark");
