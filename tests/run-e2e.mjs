/* The browser tests, in one list. Runs each (a fresh node process, as
   they're written to be run alone), keeps going past a failure, and ends
   with a table: what passed, what failed and how long each took, the
   tail of each failure's output. Exits 1 if anything failed.

   It replaces a single `&&` chain in package.json, where the first
   failure hid everything after it, and where a test could live in tests/
   without ever being run.

     node tests/run-e2e.mjs                 every test (build first: npm run build)
     node tests/run-e2e.mjs story den       only tests whose names contain "story" or "den"

   Not here, on purpose: ai-sim.mjs (a simulator; minutes per run) and
   e2e-screenshot.mjs (a tool that saves screenshots). */
import { spawn } from "node:child_process";

// [script, ...args], in the order they've always run.
const E2E = [
  ["e2e-smoke.mjs", "standard"], ["e2e-smoke.mjs", "neon"], ["e2e-smoke.mjs", "cromo"], ["e2e-smoke.mjs", "lluvia"], ["e2e-smoke.mjs", "tienda"],
  ["e2e-outside-dismiss.mjs"], ["e2e-lab.mjs"], ["e2e-gameplay.mjs", "standard"], ["e2e-gameplay.mjs", "neon"],
  ["e2e-board-size.mjs"], ["e2e-ai-worker.mjs"], ["e2e-ai-split.mjs"], ["e2e-movelog.mjs"], ["e2e-undo-audio.mjs"], ["e2e-undo-wormhole.mjs"],
  ["e2e-lluvia.mjs"], ["e2e-odd-pieces.mjs"], ["e2e-shoving.mjs"], ["e2e-anomaly.mjs"], ["e2e-pivot.mjs"], ["e2e-points.mjs"], ["e2e-rules.mjs"],
  ["e2e-costs.mjs"], ["e2e-original.mjs"], ["e2e-nova-mobile.mjs"], ["e2e-ambient.mjs"], ["e2e-singularity.mjs"], ["e2e-tienda.mjs"],
  ["e2e-sound-channels.mjs"], ["e2e-nova-sound.mjs"], ["e2e-wood-sounds.mjs"], ["e2e-piece-guide.mjs"], ["e2e-den.mjs"], ["e2e-story.mjs"],
  ["e2e-store-nudge.mjs"], ["e2e-dock-moments.mjs"], ["e2e-wake.mjs"], ["e2e-camera-glide.mjs"], ["e2e-pivot-guide.mjs"], ["e2e-fullscreen.mjs"],
  ["e2e-outline.mjs"], ["audio-bell.mjs"], ["e2e-now-playing.mjs"],
  // (In tests/ but never in the chain until the 2026-10 audit; each passes.)
  ["e2e-gate.mjs"], ["e2e-ending.mjs"], ["e2e-summon.mjs"], ["e2e-den-return.mjs"], ["e2e-drag-latch.mjs"], ["e2e-journey.mjs"], ["e2e-tv-lure.mjs"], ["e2e-clerk.mjs"],
];

const label = ([f, ...a]) => [f.replace(/\.mjs$/, ""), ...a].join(" ");
const only = process.argv.slice(2);
const list = only.length ? E2E.filter((t) => only.some((o) => label(t).includes(o))) : E2E;
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
    const tail = r.out.split("\n").filter((l) => l.trim() && !/agent-proxy|connect_rejected|For details: curl/.test(l)).slice(-25);
    console.log(tail.map((l) => `    ${l}`).join("\n"));
  }
}

const failed = results.filter((r) => r.code !== 0);
const mins = results.reduce((s, r) => s + r.secs, 0) / 60;
console.log(`\n${results.length - failed.length}/${results.length} passed in ${mins.toFixed(1)} min`);
if (failed.length) console.log(`failed: ${failed.map((r) => r.name).join(", ")}`);
process.exit(failed.length ? 1 : 0);
