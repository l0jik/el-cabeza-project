/* The browser tests, in one list. Runs each (a fresh node process, as
   they're written to be run alone), keeps going past a failure, and ends
   with a table: what passed, what failed and how long each took, the
   tail of each failure's output. Exits 1 if anything failed.

   It replaces a single `&&` chain in package.json, where the first
   failure hid everything after it, and where a test could live in tests/
   without ever being run.

     node tests/run-e2e.mjs                 every test (build first: npm run build)
     node tests/run-e2e.mjs story den       only tests whose names contain "story" or "den"
     node tests/run-e2e.mjs --shard 1/2     every second test, from the first (2/2: the rest)

   Not here, on purpose: ai-sim.mjs (a simulator; minutes per run) and
   e2e-screenshot.mjs (a tool that saves screenshots). */
import { spawn } from "node:child_process";

// [script, ...args], in the order they've always run.
const E2E = [
  ["e2e-smoke.mjs", "standard"], ["e2e-smoke.mjs", "futuris"], ["e2e-smoke.mjs", "cromo"], ["e2e-smoke.mjs", "plano"], ["e2e-smoke.mjs", "luna"], ["e2e-smoke.mjs", "noir"], ["e2e-smoke.mjs", "lluvia"], ["e2e-smoke.mjs", "tienda"], ["e2e-smoke.mjs", "ciudad"],
  ["e2e-outside-dismiss.mjs"], ["e2e-lab.mjs"], ["e2e-gameplay.mjs", "standard"], ["e2e-gameplay.mjs", "futuris"],
  ["e2e-board-size.mjs"], ["e2e-ai-worker.mjs"], ["e2e-ai-split.mjs"], ["e2e-movelog.mjs"], ["e2e-replay.mjs"], ["e2e-undo-audio.mjs"], ["e2e-undo-wormhole.mjs"],
  ["e2e-lluvia.mjs"], ["e2e-odd-pieces.mjs"], ["e2e-shoving.mjs"], ["e2e-anomaly.mjs"], ["e2e-pivot.mjs"], ["e2e-pivot-drag.mjs"], ["e2e-points.mjs"], ["e2e-rules.mjs"],
  ["e2e-costs.mjs"], ["e2e-original.mjs"], ["e2e-nova-mobile.mjs"], ["e2e-ambient.mjs"], ["e2e-singularity.mjs"], ["e2e-tienda.mjs"],
  ["e2e-sound-channels.mjs"], ["e2e-nova-sound.mjs"], ["e2e-wood-sounds.mjs"], ["e2e-piece-guide.mjs"], ["e2e-den.mjs"], ["e2e-story.mjs"],
  ["e2e-store-nudge.mjs"], ["e2e-try-it.mjs"], ["e2e-store-opening.mjs"], ["e2e-dock-moments.mjs"], ["e2e-wake.mjs"], ["e2e-camera-glide.mjs"], ["e2e-pivot-guide.mjs"], ["e2e-fullscreen.mjs"],
  ["e2e-outline.mjs"], ["audio-bell.mjs"], ["e2e-now-playing.mjs"], ["e2e-split-three.mjs"], ["e2e-check-alert.mjs"],
  // (In tests/ but never in the chain until the 2026-10 audit; each passes.)
  ["e2e-gate.mjs"], ["e2e-ending.mjs"], ["e2e-hall-after-game.mjs"], ["e2e-summon.mjs"], ["e2e-den-spot.mjs"], ["e2e-den-return.mjs"], ["e2e-drag-latch.mjs"], ["e2e-journey.mjs"], ["e2e-tv-lure.mjs"], ["e2e-clerk.mjs"],
  // (Written for the in-game touch round and never added until the efficiency review.)
  ["e2e-touch-in-game.mjs"],
  // Noir's streets and its cars.
  ["e2e-noir-streets.mjs"],
  // Noir's recorded sounds (rain, thunder, the cars), its sliders, its credits.
  ["e2e-noir-sound.mjs"],
  // After a game, the corner piece calls till the dock's opened.
  ["e2e-dock-call.mjs"], ["e2e-hall-sound.mjs"],
  // Luna's pieces closed underneath (a roll showed them hollow).
  ["e2e-luna-floors.mjs"],
  // Interlocked odd shapes pressed together (two Arcos flickered).
  ["e2e-press.mjs"],
  // A finger whose lift never arrived (the den's settle-in): one finger panned.
  ["e2e-ghost-finger.mjs"],
  // The zoom-out glass held off through the den's phone call (the receiver floated up with it).
  ["e2e-den-phone.mjs"],
  // The corner menu: the game's rules at the top left, every world's look.
  ["e2e-corner-menu.mjs"],
  // Ciudad: the city at the hour picked, its lots and cranes, its streets.
  ["e2e-ciudad.mjs"], ["e2e-ciudad-sound.mjs"], ["e2e-gameplay.mjs", "ciudad"],
  // Hold to end a turn early (a tap on the moved piece only says so); the City's Cabezas to try.
  ["e2e-hold-to-end.mjs"], ["e2e-ciudad-cabezas.mjs"],
  // Slides (the Cabeza's, a slid block's): no roll's start or landing's knock, in any world.
  ["e2e-slide-sounds.mjs"],
  // Place pieces manually before a game: drag or tap, the bench, the mirror, every world.
  ["e2e-set-out.mjs"],
  // The pieces' close-ups, every piece in every world, solid from every side.
  ["e2e-closeups.mjs"],
  // Save & carry: a file, and a code on the game's server (run here on a free port).
  ["e2e-saves.mjs"],
  // Online play: two browsers through the relay (run here on a free port).
  ["e2e-online.mjs"],
  // The City on Nova's page (its chunk fetched as it's picked), in and out of it in place.
  ["e2e-nova-city.mjs"],
  // Two sets of black holes: a marker at each way out, the other set's taken by a tap.
  ["e2e-hole-sets.mjs"],
  // A new player's first game in the store: walked through, once.
  ["e2e-first-game-tour.mjs"],
  // ...and before it, the store's menu: only See the pieces and Try a Game.
  ["e2e-first-look.mjs"],
  // The store's slow pan at its opening; the set pulling the player in.
  ["e2e-store-pan.mjs"], ["e2e-tv-pull.mjs"],
  // Other realities from Futuris's sphere: the switcher on top, scrolling.
  ["e2e-realities-over-sphere.mjs"],
  // A slow machine: the governor's steps (floor, shadow map, 30 a second), kept; shaders compiled early.
  ["e2e-device-fit.mjs"],
  // Nova's title screen: the Horizon splash, held on the logo, its menu by the story's place.
  ["e2e-title.mjs"],
];

const label = ([f, ...a]) => [f.replace(/\.mjs$/, ""), ...a].join(" ");
/* --shard i/n: every n-th test from the i-th (1-based), so a long run can
   be split, here into two under the 2-hour limit of a background task,
   or across machines (.github/workflows/e2e.yml). The round-robin keeps
   the long tests spread out. */
const shardArg = process.argv.slice(2).find((a) => /^--shard[= ]?\d+\/\d+$/.test(a) || a === "--shard");
let shard = null;
{
  const args = process.argv.slice(2);
  const i = args.indexOf("--shard");
  const spec = i >= 0 ? args[i + 1] : shardArg && shardArg.replace(/^--shard=?/, "");
  const m = spec && spec.match(/^(\d+)\/(\d+)$/);
  if (m) shard = { k: Number(m[1]), n: Number(m[2]) };
}
const only = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--shard") && all[i - 1] !== "--shard");
let list = only.length ? E2E.filter((t) => only.some((o) => label(t).includes(o))) : E2E;
if (shard) list = list.filter((t, i) => i % shard.n === shard.k - 1);
if (!list.length) { console.error(`no test matches: ${only.join(" ")}`); process.exit(2); }

function run([file, ...args]) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [`tests/${file}`, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const keep = (d) => { out += d; if (out.length > 200000) out = out.slice(-100000); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("close", (code) => resolve({ code, secs: (Date.now() - t0) / 1000, out }));
  });
}

const results = [];
for (const t of list) {
  process.stdout.write(`${label(t)} … `);
  const r = await run(t);
  results.push({ name: label(t), ...r });
  console.log(`${r.code === 0 ? "pass" : "FAIL"} (${r.secs.toFixed(0)} s)`);
  if (r.code !== 0) {
    const lines = r.out.split("\n").filter((l) => l.trim() && !/agent-proxy|connect_rejected|For details: curl/.test(l));
    const tail = lines.slice(-25);
    // Every failed check too, with what it says about itself, however far
    // above the tail it is (GitHub's log of e2e-summon, #17, had only the
    // passes after its miss).
    const above = lines.slice(0, -25).filter((l) => /^\s*FAIL\b/.test(l));
    if (above.length) console.log([...above, "..."].map((l) => `    ${l}`).join("\n"));
    console.log(tail.map((l) => `    ${l}`).join("\n"));
  }
}

const failed = results.filter((r) => r.code !== 0);
const mins = results.reduce((s, r) => s + r.secs, 0) / 60;
console.log(`\n${results.length - failed.length}/${results.length} passed in ${mins.toFixed(1)} min`);
if (failed.length) console.log(`failed: ${failed.map((r) => r.name).join(", ")}`);
process.exit(failed.length ? 1 : 0);
