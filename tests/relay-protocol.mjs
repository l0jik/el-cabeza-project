/* The game's server, over the wire (server/relay.js, and the same server
   on Cloudflare, server/cloudflare/worker.js): the saves' HTTP and the
   rooms' WebSocket messages, as the browser sends them, with no browser.
   Run against the Node server (started here on a free port), or against
   any server with RELAY set:

     node tests/relay-protocol.mjs
     RELAY=ws://127.0.0.1:8790 node tests/relay-protocol.mjs      (wrangler dev)
     RELAY=wss://el-cabeza-relay.NAME.workers.dev node tests/relay-protocol.mjs */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The repository, wherever it's checked out (the Pages deploy runs this
// in test:engine with no /home/user/el-cabeza-project link).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
// The browser's WebSocket client is Node's own from 22 on; on an older
// Node the wire can't be tested from here, and that's said, not failed.
if (typeof WebSocket === "undefined") { console.log("relay-protocol: skipped, this Node has no WebSocket client (Node 22 or later has)"); process.exit(0); }

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const external = process.env.RELAY || "";
let relay = null, RELAY = external;
if (!external) {
  const dataDir = mkdtempSync(join(tmpdir(), "ec-relay-"));
  relay = spawn(process.execPath, [join(ROOT, "server/relay.js"), "--port", "0", "--data", dataDir], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const port = await new Promise((resolve, reject) => {
    let out = "";
    relay.stdout.on("data", (d) => { out += d; const m = /listening on (\d+)/.exec(out); if (m) resolve(parseInt(m[1], 10)); });
    relay.stderr.on("data", (d) => { out += d; });
    relay.on("exit", () => reject(new Error("relay exited: " + out)));
    setTimeout(() => reject(new Error("relay never listened: " + out)), 15000);
  });
  RELAY = `ws://127.0.0.1:${port}`;
}
const HTTP = RELAY.replace(/^ws/, "http").replace(/\/+$/, "");
console.log(`server: ${RELAY}`);

/* A socket that keeps what it's told, and answers "the next message of
   kind t" (or any) within a timeout. */
function connect() {
  const ws = new WebSocket(RELAY);
  const got = [];
  const waiting = [];
  let closed = null;
  const match = () => {
    for (let i = 0; i < waiting.length; i++) {
      const w = waiting[i];
      const at = got.findIndex((m) => !w.t || m.t === w.t);
      if (at >= 0) { const [m] = got.splice(at, 1); waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); return match(); }
    }
  };
  ws.addEventListener("message", (e) => { try { got.push(JSON.parse(e.data)); } catch (err) { got.push({ t: "?", raw: e.data }); } match(); });
  ws.addEventListener("close", (e) => { closed = { code: e.code, reason: e.reason }; });
  const opened = new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", () => reject(new Error("socket error")), { once: true }); });
  return {
    ws, opened,
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t, ms = 4000) => new Promise((resolve) => { const w = { t, resolve, timer: setTimeout(() => { const i = waiting.indexOf(w); if (i >= 0) waiting.splice(i, 1); resolve(null); }, ms) }; waiting.push(w); match(); }),
    silence: async (ms = 500) => { await wait(ms); const n = got.length; got.length = 0; return n === 0; },
    closed: () => closed,
    close: () => ws.close(1000),
  };
}
const open = async () => { const c = connect(); await c.opened; return c; };

console.log("The saves (HTTP)");
{
  const health = await (await fetch(`${HTTP}/health`)).json();
  check("GET /health answers ok", health && health.ok === true && health.service === "el-cabeza-relay", JSON.stringify(health));
  const pre = await fetch(`${HTTP}/saves`, { method: "OPTIONS", headers: { Origin: "https://l0jik.github.io", "Access-Control-Request-Method": "POST" } });
  check("OPTIONS /saves: the browser may (CORS for any origin, the token header allowed)", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "*" && /x-save-token/i.test(pre.headers.get("access-control-allow-headers") || ""), String(pre.status));
  const save = { keys: { "el-cabeza:story": JSON.stringify({ owned: true }), "el-cabeza:show-points": "0" }, madeAt: "2026-10-14T00:00:00Z" };
  const made = await fetch(`${HTTP}/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save) });
  const rec = await made.json();
  check("POST /saves: 201, a code (XXXX-XXXX), a token, savedAt", made.status === 201 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(rec.code || "") && typeof rec.token === "string" && rec.token.length >= 20 && !!rec.savedAt, JSON.stringify(rec));
  check("...with CORS on the answer", made.headers.get("access-control-allow-origin") === "*");
  const back = await (await fetch(`${HTTP}/saves/${rec.code}`)).json();
  check("GET /saves/:code gives it back, whole", back && back.code === rec.code && back.savedAt === rec.savedAt && JSON.stringify(back.save) === JSON.stringify(save), JSON.stringify(back));
  const lower = await (await fetch(`${HTTP}/saves/${rec.code.toLowerCase().replace("-", "")}`)).json();
  check("...typed in lower case without the dash too", lower && lower.code === rec.code);
  const wrong = await fetch(`${HTTP}/saves/${rec.code}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Save-Token": "not-it" }, body: JSON.stringify(save) });
  check("PUT with the wrong token: 403 not your save", wrong.status === 403 && /not your save/.test((await wrong.json()).error || ""), String(wrong.status));
  const save2 = { keys: { ...save.keys, "el-cabeza:show-points": "1" } };
  await wait(20);
  const put = await fetch(`${HTTP}/saves/${rec.code}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Save-Token": rec.token }, body: JSON.stringify(save2) });
  const putRec = await put.json();
  check("PUT with the token: 200, the same code, a later savedAt", put.status === 200 && putRec.code === rec.code && putRec.savedAt > rec.savedAt, JSON.stringify(putRec));
  const back2 = await (await fetch(`${HTTP}/saves/${rec.code}`)).json();
  check("...and the save's the new one", back2 && JSON.stringify(back2.save) === JSON.stringify(save2) && back2.savedAt === putRec.savedAt);
  const none = await fetch(`${HTTP}/saves/ZZZZ-ZZZZ`);
  check("GET an unknown code: 404 no save with that code", none.status === 404 && /no save/.test((await none.json()).error || ""), String(none.status));
  const bad = await fetch(`${HTTP}/saves/not-a-code`);
  check("GET a malformed code: 400 or 404", bad.status === 400 || bad.status === 404, String(bad.status));
  const notSave = await fetch(`${HTTP}/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hello: 1 }) });
  check("POST something that isn't a save: 400 not a save", notSave.status === 400 && /not a save/.test((await notSave.json()).error || ""), String(notSave.status));
  const notJson = await fetch(`${HTTP}/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" });
  check("POST what isn't JSON: 400", notJson.status === 400, String(notJson.status));
  const huge = await fetch(`${HTTP}/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: { big: "x".repeat(600 * 1024) } }) }).catch(() => null);
  check("POST a save over 512 KB: 413 save too large", !!huge && huge.status === 413, huge ? String(huge.status) : "no answer");
  const nowhere = await fetch(`${HTTP}/elsewhere`);
  check("GET anything else: 404", nowhere.status === 404, String(nowhere.status));
}

console.log("A game (WebSocket)");
{
  const A = await open();
  A.send({ t: "host", game: { board: 7, hostSide: "light" } });
  const hosted = await A.next("hosted");
  check("host -> hosted, a six-letter code, role host", !!hosted && /^[A-Z2-9]{6}$/.test(hosted.code || "") && hosted.role === "host", JSON.stringify(hosted));
  const CODE = hosted ? hosted.code : "ZZZZZZ";
  A.send({ t: "ping" });
  check("ping -> pong", !!(await A.next("pong")));
  A.send({ t: "whatever" });
  const unknown = await A.next("error");
  check("an unknown message -> error unknown", !!unknown && unknown.code === "unknown", JSON.stringify(unknown));
  A.ws.send("not json");
  const notJson = await A.next("error");
  check("what isn't JSON -> error json", !!notJson && notJson.code === "json", JSON.stringify(notJson));

  const B = await open();
  B.send({ t: "join", code: "ZZZZZZ" });
  const noRoom = await B.next("error");
  check("join a code that isn't a game -> error no-room", !!noRoom && noRoom.code === "no-room", JSON.stringify(noRoom));
  B.send({ t: "join", code: CODE.toLowerCase() });
  const joined = await B.next("joined");
  check("join (the code in lower case) -> joined: the host's game, no turns, not begun, the host there", !!joined && joined.code === CODE && joined.role === "guest" && joined.game && joined.game.board === 7 && Array.isArray(joined.turns) && joined.turns.length === 0 && joined.begun === false && joined.peer === true, JSON.stringify(joined));
  const peerIn = await A.next("peer");
  check("...the host told peer present", !!peerIn && peerIn.present === true, JSON.stringify(peerIn));

  const C = await open();
  C.send({ t: "join", code: CODE });
  const taken = await C.next("error");
  check("a third player joining -> error taken", !!taken && taken.code === "taken", JSON.stringify(taken));
  C.close();

  A.send({ t: "setup", game: { board: 9, hostSide: "dark" } });
  const setup = await B.next("setup");
  check("the host's setup reaches the guest", !!setup && setup.game && setup.game.board === 9, JSON.stringify(setup));
  B.send({ t: "setup", game: { board: 5 } });
  check("...the guest's setup goes nowhere (host only)", await A.silence(400));
  A.send({ t: "begin", game: { board: 9, hostSide: "dark", laws: ["x"] } });
  const begin = await B.next("begin");
  check("begin reaches the guest with the game", !!begin && begin.game && begin.game.laws && begin.game.laws[0] === "x", JSON.stringify(begin));

  A.send({ t: "turn", n: 1, steps: [{ pieceId: "d-flaco-1", dir: "N" }, { pieceId: "d-flaco-1", dir: "E" }] });
  const t1 = await B.next("turn");
  check("turn 1 from the host reaches the guest, its steps whole", !!t1 && t1.n === 1 && t1.steps.length === 2 && t1.steps[1].dir === "E", JSON.stringify(t1));
  B.send({ t: "turn", n: 1, steps: [{ pieceId: "l-cabeza", dir: "S" }] });
  const order = await B.next("error");
  check("turn 1 again (the wrong number) -> error turn-order, expected 2", !!order && order.code === "turn-order" && order.expected === 2, JSON.stringify(order));
  B.send({ t: "turn", n: 2, steps: Array.from({ length: 13 }, () => ({ pieceId: "l-cabeza", dir: "S" })) });
  const long = await B.next("error");
  check("thirteen steps -> error bad-turn", !!long && long.code === "bad-turn", JSON.stringify(long));
  B.send({ t: "turn", n: 2, steps: [{ pieceId: "l-cabeza" }] });
  const half = await B.next("error");
  check("a step without a direction -> error bad-turn", !!half && half.code === "bad-turn", JSON.stringify(half));
  B.send({ t: "turn", n: 2, steps: [{ pieceId: "l-cabeza", dir: "S" }] });
  const t2 = await A.next("turn");
  check("turn 2 from the guest reaches the host", !!t2 && t2.n === 2 && t2.steps[0].pieceId === "l-cabeza", JSON.stringify(t2));

  // The guest's line drops (no leave): the host's told, the seat's kept.
  B.ws.close(1000);
  const dropped = await A.next("peer");
  check("the guest's line drops: the host told peer absent, not left", !!dropped && dropped.present === false && !dropped.left, JSON.stringify(dropped));
  const B2 = await open();
  B2.send({ t: "resume", code: CODE, role: "guest", since: 1 });
  const resumed = await B2.next("resumed");
  check("resume as the guest since turn 1 -> resumed: the game, turn 2 only, begun, the host there", !!resumed && resumed.code === CODE && resumed.role === "guest" && resumed.game && resumed.game.board === 9 && resumed.turns.length === 1 && resumed.turns[0].n === 2 && resumed.turns[0].by === "host" === false && resumed.begun === true && resumed.peer === true, JSON.stringify(resumed));
  const peerBack = await A.next("peer");
  check("...the host told peer present again", !!peerBack && peerBack.present === true, JSON.stringify(peerBack));
  A.send({ t: "turn", n: 3, steps: [{ pieceId: "d-hombro-1", dir: "W" }] });
  const t3 = await B2.next("turn");
  check("the game goes on to the new line", !!t3 && t3.n === 3, JSON.stringify(t3));

  // The same seat taken up again before the old line closed (a phone
  // changing networks): the new line has it, the old one's closed.
  const B3 = await open();
  B3.send({ t: "resume", code: CODE, role: "guest", since: 3 });
  const resumed2 = await B3.next("resumed");
  check("resume on a new line while the old one's open -> resumed (the seat taken over)", !!resumed2 && resumed2.turns.length === 0 && resumed2.peer === true, JSON.stringify(resumed2));
  const peerAgain = await A.next("peer");
  check("...the host told peer present (the new line)", !!peerAgain && peerAgain.present === true, JSON.stringify(peerAgain));
  await wait(300);
  check("...the old line closed by the server", !!B2.closed(), JSON.stringify(B2.closed()));
  A.send({ t: "turn", n: 4, steps: [{ pieceId: "d-hombro-1", dir: "W" }] });
  const t4 = await B3.next("turn");
  check("...and the turns go to the new line", !!t4 && t4.n === 4, JSON.stringify(t4));

  // Resuming a game that's gone.
  const D = await open();
  D.send({ t: "resume", code: "ZZZZZZ", role: "host", since: 0 });
  const gone = await D.next("error");
  check("resume a code that isn't a game -> error no-room", !!gone && gone.code === "no-room", JSON.stringify(gone));
  D.close();

  // Leaving for good: the other side's told, the room's gone.
  B3.send({ t: "leave" });
  const left = await B3.next("left");
  check("leave -> left", !!left);
  const peerLeft = await A.next("peer");
  check("...the host told peer absent, left", !!peerLeft && peerLeft.present === false && peerLeft.left === true, JSON.stringify(peerLeft));
  A.send({ t: "turn", n: 5, steps: [{ pieceId: "d-hombro-1", dir: "W" }] });
  const noGame = await A.next("error");
  check("...a turn from the host now -> error no-room (the game's gone)", !!noGame && noGame.code === "no-room", JSON.stringify(noGame));
  const E = await open();
  E.send({ t: "join", code: CODE });
  const noMore = await E.next("error");
  check("...and the code can't be joined any more", !!noMore && noMore.code === "no-room", JSON.stringify(noMore));
  E.close();

  // Hosting again on the same line: a new code.
  A.send({ t: "host" });
  const hosted2 = await A.next("hosted");
  check("host again -> a new code", !!hosted2 && hosted2.code !== CODE && /^[A-Z2-9]{6}$/.test(hosted2.code || ""), JSON.stringify(hosted2));
  const F = await open();
  F.send({ t: "join", code: hosted2.code });
  const joined2 = await F.next("joined");
  check("...joinable, with no game yet (none sent)", !!joined2 && joined2.game === null && joined2.begun === false, JSON.stringify(joined2));
  await A.next("peer");
  A.send({ t: "leave" });
  await A.next("left");
  const hostLeft = await F.next("peer");
  check("the host leaving: the guest told peer absent, left", !!hostLeft && hostLeft.present === false && hostLeft.left === true, JSON.stringify(hostLeft));
  F.close(); A.close(); B3.close();
}

console.log(fails ? `\n${fails} check(s) failed` : "\nall relay checks passed");
if (relay) relay.kill();
process.exit(fails ? 1 : 0);
