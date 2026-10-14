/* The game's server on Cloudflare Workers (user: "I don't want to have to
   pay any money, but I want it to all work"; chose Cloudflare): the same
   server as ../relay.js, the same messages and routes, on the free plan,
   where nothing sleeps and the storage lasts.

   One Worker takes every request and hands it to a Durable Object
   (Relay), two of them by name: "rooms" holds the games (each browser's
   WebSocket, hibernating between messages; the rooms and their turns in
   its SQLite storage) and "saves" the cloud saves (the same storage, its
   own). Nothing else runs; no packages.

   Deploying it, and the address the game then needs
   (wss://el-cabeza-relay.<your-subdomain>.workers.dev): ../README.md.

   What's the same as relay.js: every message and every answer, the
   codes, the limits. What differs: a player who comes back on a new
   connection before the old one closed (a phone changing networks) takes
   the seat over (relay.js does the same now); the browser's ping is
   answered by the platform without waking the object. */

const ROOM_IDLE_MS = 30 * 60 * 1000; // a room with nobody in it, kept this long for a reconnect
const ROOM_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a room nobody ever left properly
const MAX_ROOMS = 2000;
const MAX_SAVE_BYTES = 512 * 1024;
const MAX_MESSAGE_BYTES = 64 * 1024;
const DEAD_AFTER_MS = 70 * 1000; // the browser says ping every 20 s
// (no I, O, 0 or 1: nothing to misread over the phone)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SAVE_CODE = /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/;
const ROOM_CODE = /^[A-Z2-9]{6}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Save-Token",
  "Access-Control-Max-Age": "86400",
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
function code(n) { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALPHABET[x % ALPHABET.length]; return s; }
const saveCode = () => `${code(4)}-${code(4)}`;
function token() { const b = crypto.getRandomValues(new Uint8Array(18)); let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function normCode(c) { c = String(c || "").toUpperCase().trim(); if (!SAVE_CODE.test(c)) return null; c = c.replace("-", ""); return `${c.slice(0, 4)}-${c.slice(4)}`; }
const isSave = (s) => !!s && typeof s === "object" && !!s.keys && typeof s.keys === "object";
const other = (role) => (role === "host" ? "guest" : "host");
const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch (e) { /* gone */ } };

/* ------------------------------------------------------------ the Worker */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
      return env.RELAY.get(env.RELAY.idFromName("rooms")).fetch(request);
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      let rooms = null;
      try { rooms = (await (await env.RELAY.get(env.RELAY.idFromName("rooms")).fetch("https://relay/stats")).json()).rooms; } catch (e) { /* the count's a nicety */ }
      return json(200, { ok: true, service: "el-cabeza-relay", on: "cloudflare", rooms });
    }
    if (/^\/saves(\/|$)/.test(url.pathname)) return env.RELAY.get(env.RELAY.idFromName("saves")).fetch(request);
    return json(404, { error: "not found" });
  },
};

/* ------------------------------------------------------------ the Durable Object */

export class Relay {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec("CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, game TEXT, begun INTEGER NOT NULL DEFAULT 0, empty_since INTEGER NOT NULL DEFAULT 0, made_at INTEGER NOT NULL)");
      this.sql.exec("CREATE TABLE IF NOT EXISTS turns (code TEXT NOT NULL, n INTEGER NOT NULL, made_by TEXT NOT NULL, steps TEXT NOT NULL, PRIMARY KEY (code, n))");
      this.sql.exec("CREATE TABLE IF NOT EXISTS saves (code TEXT PRIMARY KEY, token TEXT NOT NULL, saved_at TEXT NOT NULL, save TEXT NOT NULL)");
    });
    // The browser's keepalive, answered by the platform without waking this object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ seenAt: Date.now() });
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/stats") return json(200, { rooms: this.count("rooms"), sockets: this.ctx.getWebSockets().length });
    if (url.pathname.startsWith("/saves")) return this.saves(request, url);
    return json(404, { error: "not found" });
  }

  /* ---------------------------------------------------------- the saves */

  async saves(request, url) {
    const m = /^\/saves(?:\/([A-Za-z0-9-]{8,9}))?$/.exec(url.pathname);
    if (!m) return json(404, { error: "not found" });
    try {
      if (request.method === "POST" && !m[1]) {
        const save = await this.readSave(request);
        if (!save) return json(400, { error: "not a save" });
        let c; do { c = saveCode(); } while (this.saveRow(c));
        const rec = { code: c, token: token(), savedAt: new Date().toISOString() };
        this.sql.exec("INSERT INTO saves (code, token, saved_at, save) VALUES (?, ?, ?, ?)", c, rec.token, rec.savedAt, JSON.stringify(save));
        return json(201, rec);
      }
      const c = normCode(m[1]);
      if (!c) return json(400, { error: "bad code" });
      const row = this.saveRow(c);
      if (request.method === "GET") {
        if (!row) return json(404, { error: "no save with that code" });
        return json(200, { code: row.code, savedAt: row.saved_at, save: JSON.parse(row.save) });
      }
      if (request.method === "PUT") {
        if (!row) return json(404, { error: "no save with that code" });
        if ((request.headers.get("x-save-token") || "") !== row.token) return json(403, { error: "not your save" });
        const save = await this.readSave(request);
        if (!save) return json(400, { error: "not a save" });
        const savedAt = new Date().toISOString();
        this.sql.exec("UPDATE saves SET save = ?, saved_at = ? WHERE code = ?", JSON.stringify(save), savedAt, c);
        return json(200, { code: c, savedAt });
      }
      return json(405, { error: "method not allowed" });
    } catch (e) {
      const big = !!e && e.message === "too large";
      return json(big ? 413 : 400, { error: big ? "save too large" : "bad request" });
    }
  }
  saveRow(c) { return this.sql.exec("SELECT code, token, saved_at, save FROM saves WHERE code = ?", c).toArray()[0] || null; }
  async readSave(request) {
    if (parseInt(request.headers.get("content-length") || "0", 10) > MAX_SAVE_BYTES) throw new Error("too large");
    const text = await request.text();
    if (text.length > MAX_SAVE_BYTES) throw new Error("too large");
    const save = JSON.parse(text);
    return isSave(save) ? save : null;
  }

  /* ---------------------------------------------------------- the sockets */

  async webSocketMessage(ws, message) {
    if (typeof message !== "string") return;
    if (message.length > MAX_MESSAGE_BYTES) { this.drop(ws, 1009, "too big"); return; }
    let msg;
    try { msg = JSON.parse(message); } catch (e) { send(ws, { t: "error", code: "json", message: "not JSON" }); return; }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    this.touch(ws);
    this.handle(ws, msg);
  }
  async webSocketClose(ws, codeNum, reason) {
    this.leave(ws, false);
    try { ws.close(codeNum, reason); } catch (e) { /* closed already */ }
  }
  async webSocketError(ws) { this.leave(ws, false); }

  att(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  setAtt(ws, a) { try { ws.serializeAttachment(a); } catch (e) { /* 2 KB is plenty for this */ } }
  touch(ws) { const a = this.att(ws); a.seenAt = Date.now(); this.setAtt(ws, a); }
  // When this socket last said anything (its pings count, though they never wake us).
  lastSeen(ws) {
    let t = this.att(ws).seenAt || 0;
    try { const d = this.ctx.getWebSocketAutoResponseTimestamp(ws); if (d) t = Math.max(t, d.getTime()); } catch (e) { /* none yet */ }
    return t;
  }
  alive(ws) { return Date.now() - this.lastSeen(ws) < DEAD_AFTER_MS; }
  drop(ws, codeNum, reason) { this.leave(ws, false); try { ws.close(codeNum, reason); } catch (e) { /* gone */ } }
  // The live socket in a room's seat, if any (one with no word in DEAD_AFTER_MS is dropped on the way).
  seat(roomCode, role, except = null) {
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue;
      const a = this.att(w);
      if (a.code !== roomCode || a.role !== role) continue;
      if (!this.alive(w)) { this.drop(w, 1001, "no word in a while"); continue; }
      return w;
    }
    return null;
  }

  /* ---------------------------------------------------------- the rooms */

  room(c) { return this.sql.exec("SELECT code, game, begun, empty_since, made_at FROM rooms WHERE code = ?", c).toArray()[0] || null; }
  count(table) { return this.sql.exec(`SELECT count(*) AS n FROM ${table}`).one().n; }
  turnCount(c) { return this.sql.exec("SELECT count(*) AS n FROM turns WHERE code = ?", c).one().n; }
  turnsAfter(c, since) { return this.sql.exec("SELECT n, made_by, steps FROM turns WHERE code = ? AND n > ? ORDER BY n", c, since).toArray().map((r) => ({ n: r.n, steps: JSON.parse(r.steps), by: r.made_by })); }
  deleteRoom(c) { this.sql.exec("DELETE FROM turns WHERE code = ?", c); this.sql.exec("DELETE FROM rooms WHERE code = ?", c); }
  game(row) { return row && row.game ? JSON.parse(row.game) : null; }

  // Out of its room: for good (left: the room goes, the other side's told
  // so) or dropped (the seat's kept for a reconnect).
  leave(ws, left) {
    const a = this.att(ws);
    if (!a.code) return;
    const { code: c, role } = a;
    this.setAtt(ws, { seenAt: a.seenAt || Date.now() });
    const peer = this.seat(c, other(role), ws);
    if (left) {
      if (peer) { send(peer, { t: "peer", present: false, left: true }); this.setAtt(peer, { seenAt: this.att(peer).seenAt || Date.now() }); }
      this.deleteRoom(c);
      return;
    }
    if (peer) { send(peer, { t: "peer", present: false, left: false }); return; }
    this.sql.exec("UPDATE rooms SET empty_since = ? WHERE code = ?", Date.now(), c);
    this.armSweep();
  }
  // The sweep (alarm) set if none is: empty rooms go after ROOM_IDLE_MS, any room after ROOM_MAX_AGE_MS.
  armSweep() {
    this.ctx.storage.getAlarm().then((at) => { if (at === null) return this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS + 1000); }).catch(() => { /* next time */ });
  }
  async alarm() {
    const now = Date.now();
    for (const r of this.sql.exec("SELECT code FROM rooms WHERE (empty_since > 0 AND empty_since < ?) OR made_at < ?", now - ROOM_IDLE_MS, now - ROOM_MAX_AGE_MS).toArray()) this.deleteRoom(r.code);
    let next = Infinity;
    for (const r of this.sql.exec("SELECT empty_since, made_at FROM rooms").toArray()) next = Math.min(next, r.empty_since > 0 ? r.empty_since + ROOM_IDLE_MS : r.made_at + ROOM_MAX_AGE_MS);
    if (next < Infinity) await this.ctx.storage.setAlarm(Math.max(next + 1000, now + 5000));
  }

  handle(ws, msg) {
    const a = this.att(ws);
    const here = a.code ? this.room(a.code) : null;
    if (a.code && !here) this.setAtt(ws, { seenAt: a.seenAt }); // (its room swept away)
    const inRoom = !!here;
    switch (msg.t) {
      case "ping": send(ws, { t: "pong" }); return;
      case "host": {
        if (this.count("rooms") >= MAX_ROOMS) { send(ws, { t: "error", code: "full", message: "the server is full" }); return; }
        if (inRoom) this.leave(ws, true);
        let c; do { c = code(6); } while (this.room(c));
        this.sql.exec("INSERT INTO rooms (code, game, begun, empty_since, made_at) VALUES (?, ?, 0, 0, ?)", c, msg.game ? JSON.stringify(msg.game) : null, Date.now());
        this.setAtt(ws, { code: c, role: "host", seenAt: Date.now() });
        this.armSweep();
        send(ws, { t: "hosted", code: c, role: "host" });
        return;
      }
      case "join": {
        const c = String(msg.code || "").toUpperCase().trim();
        if (!(ROOM_CODE.test(c) && this.room(c))) { send(ws, { t: "error", code: "no-room", message: "no game with that code" }); return; }
        if (inRoom) this.leave(ws, true);
        const r = this.room(c);
        if (!r) { send(ws, { t: "error", code: "no-room", message: "no game with that code" }); return; }
        if (this.seat(c, "guest", ws)) { send(ws, { t: "error", code: "taken", message: "that game already has two players" }); return; }
        this.setAtt(ws, { code: c, role: "guest", seenAt: Date.now() });
        this.sql.exec("UPDATE rooms SET empty_since = 0 WHERE code = ?", c);
        const host = this.seat(c, "host", ws);
        send(ws, { t: "joined", code: c, role: "guest", game: this.game(r), turns: this.turnsAfter(c, 0), begun: !!r.begun, peer: !!host });
        if (host) send(host, { t: "peer", present: true });
        return;
      }
      case "resume": {
        const c = String(msg.code || "").toUpperCase().trim();
        const role = msg.role === "host" ? "host" : "guest";
        if (!(ROOM_CODE.test(c) && this.room(c))) { send(ws, { t: "error", code: "no-room", message: "that game is gone" }); return; }
        if (inRoom && a.code !== c) this.leave(ws, true);
        const r = this.room(c);
        if (!r) { send(ws, { t: "error", code: "no-room", message: "that game is gone" }); return; }
        const holder = this.seat(c, role, ws);
        if (holder) {
          // The same player back on a new line before the old one closed
          // (a phone changing networks): the new line takes the seat.
          this.setAtt(holder, { seenAt: Date.now() });
          send(holder, { t: "error", code: "replaced", message: "this seat was taken up from another connection" });
          try { holder.close(4001, "replaced"); } catch (e) { /* gone */ }
        }
        this.setAtt(ws, { code: c, role, seenAt: Date.now() });
        this.sql.exec("UPDATE rooms SET empty_since = 0 WHERE code = ?", c);
        const since = Math.max(0, parseInt(msg.since, 10) || 0);
        const peer = this.seat(c, other(role), ws);
        send(ws, { t: "resumed", code: c, role, game: this.game(r), turns: this.turnsAfter(c, since), begun: !!r.begun, peer: !!peer });
        if (peer) send(peer, { t: "peer", present: true });
        return;
      }
      case "setup":
      case "begin": {
        if (!inRoom || a.role !== "host") return;
        const gameText = msg.game ? JSON.stringify(msg.game) : (here.game || null);
        if (msg.t === "begin") { this.sql.exec("UPDATE rooms SET game = ?, begun = 1 WHERE code = ?", gameText, a.code); this.sql.exec("DELETE FROM turns WHERE code = ?", a.code); }
        else this.sql.exec("UPDATE rooms SET game = ? WHERE code = ?", gameText, a.code);
        const peer = this.seat(a.code, "guest", ws);
        if (peer) send(peer, { t: msg.t, game: gameText ? JSON.parse(gameText) : null });
        return;
      }
      case "turn": {
        if (!inRoom) { send(ws, { t: "error", code: "no-room", message: "not in a game" }); return; }
        const n = parseInt(msg.n, 10);
        const expected = this.turnCount(a.code) + 1;
        if (n !== expected) { send(ws, { t: "error", code: "turn-order", message: `expected turn ${expected}`, expected }); return; }
        if (!Array.isArray(msg.steps) || msg.steps.length === 0 || msg.steps.length > 12) { send(ws, { t: "error", code: "bad-turn", message: "a turn is one to twelve steps" }); return; }
        const steps = msg.steps.map((s) => ({ pieceId: String((s && s.pieceId) || ""), dir: String((s && s.dir) || "") })).filter((s) => s.pieceId && s.dir);
        if (steps.length !== msg.steps.length) { send(ws, { t: "error", code: "bad-turn", message: "a step is a piece and a direction" }); return; }
        this.sql.exec("INSERT INTO turns (code, n, made_by, steps) VALUES (?, ?, ?, ?)", a.code, n, a.role, JSON.stringify(steps));
        const peer = this.seat(a.code, other(a.role), ws);
        if (peer) send(peer, { t: "turn", n, steps });
        return;
      }
      case "leave": {
        if (inRoom) this.leave(ws, true);
        send(ws, { t: "left" });
        return;
      }
      default:
        send(ws, { t: "error", code: "unknown", message: `unknown message ${msg.t}` });
    }
  }
}
