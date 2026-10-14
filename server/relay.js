#!/usr/bin/env node
/* The game's one small server (user: "implement online play against
   another person (it needs a small server)" and "saves that survive
   clearing the browser or carry to another device"; chose a relay the
   project writes itself, and cloud saves by code on the same server).
   Node alone, no packages: run it anywhere Node 18+ runs.

     node server/relay.js                 (port 8787, saves in ./data)
     PORT=80 DATA_DIR=/var/lib/cabeza node server/relay.js

   What it does:

   - Games. A WebSocket relay: the host opens a room and gets a six-letter
     code; the other player joins with it; from then on the server passes
     each finished turn (the piece-tagged steps the chassis plays them
     back from) to the other side, and keeps them, so a player whose
     connection drops picks up where the game is. The server never
     judges a move: both browsers run the same rules engine, so a turn
     one side makes legally plays out the same on the other. Messages,
     JSON, one an event:
       client: {t:"host", game}            server: {t:"hosted", code}
       client: {t:"join", code}            server: {t:"joined", code, game, turns, begun}
                                           host:   {t:"peer", present:true}
       client: {t:"resume", code, role, since}   server: {t:"resumed", game, turns, begun, peer}
                                           (a seat still held by an older line is taken over: the old one's closed)
       host:   {t:"setup", game}           guest:  {t:"setup", game}       (before it begins)
       host:   {t:"begin", game}           guest:  {t:"begin", game}
       either: {t:"turn", n, steps}        other:  {t:"turn", n, steps}
       either: {t:"leave"}                 other:  {t:"peer", present:false, left:true}
       either: {t:"ping"}                  server: {t:"pong"}
       server: {t:"error", code, message}
     A room lives while a player is in it, and ROOM_IDLE_MS after the
     last one goes (a dropped connection can come back).

   - Saves. Everything a browser keeps for the game, as one JSON record:
       POST /saves          body: the save          -> {code, token}
       PUT  /saves/:code    header x-save-token     -> {code, savedAt}   (the same code, updated)
       GET  /saves/:code                            -> {code, savedAt, save}
     Codes are eight letters (XXXX-XXXX); the token lets the browser that
     made a save update it. Saves are files under DATA_DIR/saves.

   Deploying it, and the address the game needs: server/README.md. */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.PORT || process.argv[process.argv.indexOf("--port") + 1] || "8787", 10) || 0;
const DATA_DIR = process.env.DATA_DIR || (process.argv.includes("--data") ? process.argv[process.argv.indexOf("--data") + 1] : path.join(process.cwd(), "data"));
const SAVES_DIR = path.join(DATA_DIR, "saves");
const ROOM_IDLE_MS = 30 * 60 * 1000; // a room with nobody in it, kept this long for a reconnect
const MAX_ROOMS = 2000;
const MAX_SAVE_BYTES = 512 * 1024;
const MAX_MESSAGE_BYTES = 64 * 1024;
const PING_EVERY_MS = 25 * 1000;
const DEAD_AFTER_MS = 70 * 1000;
// (no I, O, 0 or 1: nothing to misread over the phone)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
const saveCode = () => `${code(4)}-${code(4)}`;
const SAVE_CODE = /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/;
const ROOM_CODE = /^[A-Z2-9]{6}$/;

fs.mkdirSync(SAVES_DIR, { recursive: true });

/* ------------------------------------------------------------ HTTP: the saves */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Save-Token",
  "Access-Control-Max-Age": "86400",
};
function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { ...CORS, "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text), "Cache-Control": "no-store" });
  res.end(text);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (parseInt(req.headers["content-length"] || "0", 10) > limit) { req.resume(); req.on("end", () => reject(new Error("too large"))); req.on("error", () => reject(new Error("too large"))); return; }
    const chunks = []; let size = 0, over = false;
    req.on("data", (c) => {
      size += c.length;
      if (over) { if (size > limit * 4) req.destroy(); return; }
      if (size > limit) { over = true; chunks.length = 0; return; } // (drained, so the 413 gets through)
      chunks.push(c);
    });
    req.on("end", () => (over ? reject(new Error("too large")) : resolve(Buffer.concat(chunks).toString("utf8"))));
    req.on("error", () => reject(new Error(over ? "too large" : "bad request")));
  });
}
const savePath = (c) => path.join(SAVES_DIR, `${c.replace("-", "")}.json`);
function normCode(c) { c = String(c || "").toUpperCase().trim(); if (!SAVE_CODE.test(c)) return null; c = c.replace("-", ""); return `${c.slice(0, 4)}-${c.slice(4)}`; }
const token = () => crypto.randomBytes(18).toString("base64url");

async function handleHttp(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    send(res, 200, { ok: true, service: "el-cabeza-relay", rooms: rooms.size, uptime: Math.round(process.uptime()) });
    return;
  }
  const m = /^\/saves(?:\/([A-Za-z0-9-]{8,9}))?$/.exec(url.pathname);
  if (!m) { send(res, 404, { error: "not found" }); return; }
  try {
    if (req.method === "POST" && !m[1]) {
      const body = await readBody(req, MAX_SAVE_BYTES);
      const save = JSON.parse(body);
      if (!save || typeof save !== "object" || !save.keys || typeof save.keys !== "object") { send(res, 400, { error: "not a save" }); return; }
      let c; do { c = saveCode(); } while (fs.existsSync(savePath(c)));
      const rec = { code: c, token: token(), savedAt: new Date().toISOString(), save };
      fs.writeFileSync(savePath(c), JSON.stringify(rec));
      send(res, 201, { code: c, token: rec.token, savedAt: rec.savedAt });
      return;
    }
    const c = normCode(m[1]);
    if (!c) { send(res, 400, { error: "bad code" }); return; }
    if (req.method === "GET") {
      if (!fs.existsSync(savePath(c))) { send(res, 404, { error: "no save with that code" }); return; }
      const rec = JSON.parse(fs.readFileSync(savePath(c), "utf8"));
      send(res, 200, { code: rec.code, savedAt: rec.savedAt, save: rec.save });
      return;
    }
    if (req.method === "PUT") {
      if (!fs.existsSync(savePath(c))) { send(res, 404, { error: "no save with that code" }); return; }
      const rec = JSON.parse(fs.readFileSync(savePath(c), "utf8"));
      if ((req.headers["x-save-token"] || "") !== rec.token) { send(res, 403, { error: "not your save" }); return; }
      const body = await readBody(req, MAX_SAVE_BYTES);
      const save = JSON.parse(body);
      if (!save || typeof save !== "object" || !save.keys || typeof save.keys !== "object") { send(res, 400, { error: "not a save" }); return; }
      rec.save = save; rec.savedAt = new Date().toISOString();
      fs.writeFileSync(savePath(c), JSON.stringify(rec));
      send(res, 200, { code: rec.code, savedAt: rec.savedAt });
      return;
    }
    send(res, 405, { error: "method not allowed" });
  } catch (e) {
    send(res, e.message === "too large" ? 413 : 400, { error: e.message === "too large" ? "save too large" : "bad request" });
  }
}

/* ------------------------------------------------------------ WebSocket, by hand */

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const clients = new Set();

function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

class Client {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.parts = []; // a fragmented message's pieces
    this.partOp = 0;
    this.alive = Date.now();
    this.room = null;
    this.role = null;
    this.closed = false;
    socket.on("data", (d) => this.onData(d));
    socket.on("close", () => this.onClose());
    socket.on("error", () => this.onClose());
    socket.setNoDelay(true);
  }
  sendText(obj) {
    if (this.closed) return;
    try { this.socket.write(frame(0x1, Buffer.from(JSON.stringify(obj)))); } catch (e) { this.onClose(); }
  }
  ping() { if (!this.closed) try { this.socket.write(frame(0x9, Buffer.alloc(0))); } catch (e) { this.onClose(); } }
  close(codeNum = 1000) {
    if (this.closed) return;
    try { const b = Buffer.alloc(2); b.writeUInt16BE(codeNum, 0); this.socket.write(frame(0x8, b)); } catch (e) { /* gone */ }
    try { this.socket.end(); } catch (e) { /* gone */ }
    this.onClose();
  }
  onClose() {
    if (this.closed) return;
    this.closed = true;
    clients.delete(this);
    leaveRoom(this, false);
    try { this.socket.destroy(); } catch (e) { /* gone */ }
  }
  onData(d) {
    this.alive = Date.now();
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, at = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); at = 4; }
      else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(MAX_MESSAGE_BYTES * 4)) { this.close(1009); return; } len = Number(big); at = 10; }
      if (len > MAX_MESSAGE_BYTES * 4) { this.close(1009); return; }
      const maskAt = at; if (masked) at += 4;
      if (b.length < at + len) return;
      let payload = b.subarray(at, at + len);
      if (masked) { const m = b.subarray(maskAt, maskAt + 4); const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ m[i & 3]; payload = out; }
      this.buf = b.subarray(at + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { try { this.socket.write(frame(0xa, payload)); } catch (e) { this.onClose(); } continue; }
      if (op === 0xa) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        if (op !== 0x0) { this.parts = []; this.partOp = op; }
        this.parts.push(payload);
        if (!fin) continue;
        const whole = Buffer.concat(this.parts); this.parts = [];
        if (whole.length > MAX_MESSAGE_BYTES) { this.close(1009); return; }
        if (this.partOp === 0x1) this.onMessage(whole.toString("utf8"));
      }
    }
  }
  onMessage(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { this.sendText({ t: "error", code: "json", message: "not JSON" }); return; }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    handle(this, msg);
  }
}

/* ------------------------------------------------------------ the rooms */

/* A room: { code, game (the host's setup, as last sent), begun, turns:
   [{n, steps, by}], host: Client|null, guest: Client|null, emptySince } */
const rooms = new Map();
const other = (room, role) => (role === "host" ? room.guest : room.host);

function joinRoom(client, room, role, takeOver = false) {
  const slot = room[role];
  if (slot && slot !== client && !slot.closed) {
    if (!takeOver) return false;
    // The same player back on a new line before the old one closed (a
    // phone changing networks): the new line takes the seat.
    slot.room = null;
    slot.sendText({ t: "error", code: "replaced", message: "this seat was taken up from another connection" });
    slot.close(4001);
  }
  room[role] = client;
  client.room = room; client.role = role;
  room.emptySince = 0;
  return true;
}
function leaveRoom(client, left) {
  const room = client.room;
  if (!room) return;
  if (room[client.role] === client) room[client.role] = null;
  const peer = other(room, client.role);
  client.room = null;
  if (peer && !peer.closed) peer.sendText({ t: "peer", present: false, left: !!left });
  if (left) { rooms.delete(room.code); if (peer) { peer.room = null; } return; }
  if (!room.host && !room.guest) room.emptySince = Date.now();
}
function handle(client, msg) {
  const room = client.room;
  switch (msg.t) {
    case "ping": client.sendText({ t: "pong" }); return;
    case "host": {
      if (rooms.size >= MAX_ROOMS) { client.sendText({ t: "error", code: "full", message: "the server is full" }); return; }
      if (room) leaveRoom(client, true);
      let c; do { c = code(6); } while (rooms.has(c));
      const r = { code: c, game: msg.game || null, begun: false, turns: [], host: null, guest: null, emptySince: 0, madeAt: Date.now() };
      rooms.set(c, r);
      joinRoom(client, r, "host");
      client.sendText({ t: "hosted", code: c, role: "host" });
      return;
    }
    case "join": {
      const c = String(msg.code || "").toUpperCase().trim();
      const r = ROOM_CODE.test(c) ? rooms.get(c) : null;
      if (!r) { client.sendText({ t: "error", code: "no-room", message: "no game with that code" }); return; }
      if (room) leaveRoom(client, true);
      if (!joinRoom(client, r, "guest")) { client.sendText({ t: "error", code: "taken", message: "that game already has two players" }); return; }
      client.sendText({ t: "joined", code: c, role: "guest", game: r.game, turns: r.turns, begun: r.begun, peer: !!(r.host && !r.host.closed) });
      if (r.host && !r.host.closed) r.host.sendText({ t: "peer", present: true });
      return;
    }
    case "resume": {
      const c = String(msg.code || "").toUpperCase().trim();
      const r = ROOM_CODE.test(c) ? rooms.get(c) : null;
      const role = msg.role === "host" ? "host" : "guest";
      if (!r) { client.sendText({ t: "error", code: "no-room", message: "that game is gone" }); return; }
      if (room && room !== r) leaveRoom(client, true);
      joinRoom(client, r, role, true);
      const since = Math.max(0, parseInt(msg.since, 10) || 0);
      const peer = other(r, role);
      client.sendText({ t: "resumed", code: c, role, game: r.game, turns: r.turns.slice(since), begun: r.begun, peer: !!(peer && !peer.closed) });
      if (peer && !peer.closed) peer.sendText({ t: "peer", present: true });
      return;
    }
    case "setup":
    case "begin": {
      if (!room || client.role !== "host") return;
      room.game = msg.game || room.game;
      if (msg.t === "begin") { room.begun = true; room.turns = []; }
      const peer = other(room, client.role);
      if (peer && !peer.closed) peer.sendText({ t: msg.t, game: room.game });
      return;
    }
    case "turn": {
      if (!room) { client.sendText({ t: "error", code: "no-room", message: "not in a game" }); return; }
      const n = parseInt(msg.n, 10);
      if (n !== room.turns.length + 1) { client.sendText({ t: "error", code: "turn-order", message: `expected turn ${room.turns.length + 1}`, expected: room.turns.length + 1 }); return; }
      if (!Array.isArray(msg.steps) || msg.steps.length === 0 || msg.steps.length > 12) { client.sendText({ t: "error", code: "bad-turn", message: "a turn is one to twelve steps" }); return; }
      const steps = msg.steps.map((s) => ({ pieceId: String(s.pieceId || ""), dir: String(s.dir || "") })).filter((s) => s.pieceId && s.dir);
      if (steps.length !== msg.steps.length) { client.sendText({ t: "error", code: "bad-turn", message: "a step is a piece and a direction" }); return; }
      const rec = { n, steps, by: client.role };
      room.turns.push(rec);
      const peer = other(room, client.role);
      if (peer && !peer.closed) peer.sendText({ t: "turn", n, steps });
      return;
    }
    case "leave": {
      if (room) leaveRoom(client, true);
      client.sendText({ t: "left" });
      return;
    }
    default:
      client.sendText({ t: "error", code: "unknown", message: `unknown message ${msg.t}` });
  }
}

/* ------------------------------------------------------------ the server */

const server = http.createServer((req, res) => { handleHttp(req, res); });
server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (String(req.headers.upgrade || "").toLowerCase() !== "websocket" || !key) { socket.write("HTTP/1.1 400 Bad Request\r\n\r\n"); socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  clients.add(new Client(socket));
});
const housekeeping = setInterval(() => {
  const now = Date.now();
  for (const c of clients) {
    if (now - c.alive > DEAD_AFTER_MS) c.close(1001);
    else c.ping();
  }
  for (const [c, r] of rooms) if (!r.host && !r.guest && r.emptySince && now - r.emptySince > ROOM_IDLE_MS) rooms.delete(c);
}, PING_EVERY_MS);
housekeeping.unref();

server.listen(PORT, () => {
  const { port } = server.address();
  console.log(`el-cabeza relay listening on ${port} (saves in ${SAVES_DIR})`);
});
process.on("SIGTERM", () => { server.close(); for (const c of clients) c.close(1001); process.exit(0); });
