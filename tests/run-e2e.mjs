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
  ["e2e-outside-dismiss.mjs"], ["e2e-lab.mjs"], ["e2e-monolith.mjs"], ["e2e-gameplay.mjs", "standard"], ["e2e-gameplay.mjs", "futuris"],
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
  // Luna's rover drives all over the base, its crew out now and then for a rock.
  ["e2e-luna-rover.mjs"],
  // The Android app's own copy of the game, and its pages as the app shows them.
  ["e2e-app.mjs"],
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
  // The languages: the device's guessed, the title's EN · ES · VI line, the dock's badge.
  ["e2e-language.mjs"],
  // The menu lab (?menulab): ten fly-out menus round the dock's piece, each one working.
  ["e2e-menu-lab.mjs"],
  // The dock's menu everywhere (Calm Rings): a few wedges in fixed places, More for all of it, the corner fan in play; in each phase.
  ["e2e-rings.mjs"],
  // Its wedges' tooltips (user: "add pop-up tool-tips for the menu wedges ... globally"): every world's, then the keys, a finger held, in play and after a game.
  ["e2e-menu-tips.mjs", "worlds"], ["e2e-menu-tips.mjs", "more"],
  // Leave game (the game kept, the title's Continue), the game kept out of sight, Back asking first.
  ["e2e-leave.mjs"],
  // Futuris's glass against something solid in front of it (a black hole's orb): not painted over it.
  ["e2e-glass-layers.mjs"],
  ["e2e-see-lens.mjs"],
  ["e2e-store-records.mjs"],
  // Cromo on a phone: the board's surface from the dock's menu, mid-game too; the dark side's dots; the title clear of the corner tab.
  ["e2e-cromo.mjs"],
  // The result said to you: "You win" / "You lose" against the computer (placard, status, move log, the Lab), the winner's name for two people, in Spanish too.
  ["e2e-you-win.mjs"],
  // The slide-arrow lab (?arrowlab): five ways to draw the arrow a drag lights, each shown and put away; the game's own (the Path) without it.
  ["e2e-arrow-lab.mjs"],
  // A press on a piece wins over a marker hidden behind it (a tilted view); a click on a crush target still crushes.
  ["e2e-hidden-marker.mjs"],
  // The floors' seams closed (the store's aisles, the den's carpet): no corner of one piece partway along another's edge, where light lines flickered.
  ["e2e-floor-seams.mjs"],
  // Undo move: the last move alone, mid-turn or once the turn's over (the computer's reply with it), the button always to hand, Ctrl+Z.
  ["e2e-undo-move.mjs"],
  // The way into the Singularity on a slow machine: the collapse made ready during the toll; a 4 s freeze as it begins doesn't skip the fall or its sound.
  ["e2e-singularity-stall.mjs"],
  // A refused move says why (the Piece guide's X on the square aimed at and its note): the user's clip, too heavy to push and then not enough actions; a boxed-in piece; off with the guide; a phone; Spanish.
  ["e2e-why-not.mjs"],
  // The rules in every world: ?nova opens a world's Cabeza Nova menu whatever the story; Change rules on the Rules card in play (asked first) and in the menus between games; nothing without the story or the link; a phone; Spanish.
  ["e2e-change-rules.mjs"],
  // The piece card keeps off the chosen piece: in its own place till that covers it, then the corner that covers it least, left there while clear (the City on a phone, Luna on a computer).
  ["e2e-piece-card-place.mjs"],
  // Zoomed in, the view goes anywhere over the board (the screen kept over it), zoomed out as before; two fingers pull it to the edge; a pinch zooms toward the fingers (Futuris on a phone).
  ["e2e-zoom-pan.mjs"],
  // The picture gone (the Moto's white screen and sad face): lost and given back, no card; lost for good, a card that loads the page again; no WebGL at all, a card in place of the empty page.
  ["e2e-picture-out.mjs"],
  // The game's own things (Undo move, End turn, the points, its cards, the phone's bar) out of the way through the story's scenes: a visit to the set, home again and the bulb, the hall, the den looking round, the phone call.
  ["e2e-scene-aside.mjs"],
  // The way into the Singularity from recordings where the audio can't make it live (a Chromebook, a phone): the toll, the hum, the fall, the last clap; late recordings; a desktop live.
  ["e2e-way-in.mjs"],
];

const label = ([f, ...a]) => [f.replace(/\.mjs$/, ""), ...a].join(" ");

/* Each test's time on GitHub's runners, in seconds (the run on 2026-11-20
   for b522f06, its eight parts' logs): what --shard balances by. A test
   that isn't here counts as SECS_ELSE. Round-robin had put the store, the
   setup by hand, the menu's tooltips, the Lab and the replays, 48 minutes
   of them, in one part, which ran past its 60 minutes while another took
   18. Brought up to date from the logs when the parts drift apart. */
const SECS = {
  "e2e-smoke standard": 21, "e2e-smoke futuris": 10, "e2e-smoke cromo": 13, "e2e-smoke plano": 18, "e2e-smoke luna": 67, "e2e-smoke noir": 49, "e2e-smoke lluvia": 38, "e2e-smoke tienda": 19, "e2e-smoke ciudad": 50,
  "e2e-outside-dismiss": 118, "e2e-lab": 419, "e2e-monolith": 129, "e2e-gameplay standard": 37, "e2e-gameplay futuris": 25, "e2e-gameplay ciudad": 64,
  "e2e-board-size": 49, "e2e-ai-worker": 18, "e2e-ai-split": 34, "e2e-movelog": 14, "e2e-replay": 355, "e2e-undo-audio": 51, "e2e-undo-wormhole": 25,
  "e2e-lluvia": 469, "e2e-odd-pieces": 25, "e2e-shoving": 65, "e2e-anomaly": 7, "e2e-pivot": 34, "e2e-pivot-drag": 121, "e2e-points": 109, "e2e-rules": 75,
  "e2e-costs": 89, "e2e-original": 33, "e2e-nova-mobile": 103, "e2e-ambient": 29, "e2e-singularity": 223, "e2e-tienda": 785,
  "e2e-sound-channels": 53, "e2e-nova-sound": 36, "e2e-wood-sounds": 51, "e2e-piece-guide": 69, "e2e-den": 207, "e2e-story": 337,
  "e2e-store-nudge": 231, "e2e-try-it": 27, "e2e-store-opening": 20, "e2e-dock-moments": 620, "e2e-wake": 14, "e2e-camera-glide": 82, "e2e-pivot-guide": 67, "e2e-fullscreen": 72,
  "e2e-outline": 70, "audio-bell": 34, "e2e-now-playing": 206, "e2e-split-three": 60, "e2e-check-alert": 167,
  "e2e-gate": 311, "e2e-ending": 108, "e2e-hall-after-game": 133, "e2e-summon": 306, "e2e-den-spot": 78, "e2e-den-return": 50, "e2e-drag-latch": 115, "e2e-journey": 120, "e2e-tv-lure": 89, "e2e-clerk": 73,
  "e2e-touch-in-game": 640, "e2e-noir-streets": 52, "e2e-noir-sound": 90, "e2e-dock-call": 332, "e2e-hall-sound": 115, "e2e-luna-floors": 19, "e2e-luna-rover": 12,
  "e2e-app": 173, "e2e-press": 57, "e2e-ghost-finger": 53, "e2e-den-phone": 158, "e2e-corner-menu": 706, "e2e-ciudad": 126, "e2e-ciudad-sound": 137,
  "e2e-hold-to-end": 124, "e2e-ciudad-cabezas": 59, "e2e-slide-sounds": 201, "e2e-set-out": 858, "e2e-closeups": 160, "e2e-saves": 74, "e2e-online": 187,
  "e2e-nova-city": 100, "e2e-hole-sets": 35, "e2e-first-game-tour": 315, "e2e-first-look": 63, "e2e-store-pan": 80, "e2e-tv-pull": 114,
  "e2e-realities-over-sphere": 40, "e2e-device-fit": 134, "e2e-title": 165, "e2e-language": 47, "e2e-menu-lab": 259, "e2e-rings": 104,
  "e2e-menu-tips worlds": 456, "e2e-menu-tips more": 164, "e2e-leave": 111, "e2e-glass-layers": 17, "e2e-see-lens": 44, "e2e-store-records": 4,
  "e2e-cromo": 36, "e2e-you-win": 45, "e2e-arrow-lab": 75, "e2e-hidden-marker": 56, "e2e-floor-seams": 13, "e2e-undo-move": 51, "e2e-singularity-stall": 16,
  "e2e-why-not": 233, "e2e-change-rules": 233, "e2e-piece-card-place": 51, "e2e-zoom-pan": 39, "e2e-picture-out": 64, "e2e-scene-aside": 74, "e2e-way-in": 58,
};
const SECS_ELSE = 90;
const secsOf = (t) => SECS[label(t)] ?? SECS_ELSE;

/* --shard i/n: the i-th (1-based) of n parts, so a long run can be split,
   here into two under the 2-hour limit of a background task, or across
   machines (.github/workflows/e2e.yml). The parts as even as their times
   allow: the longest test first, each to the part with the least time so
   far (a tie to the earlier part), every part's own run in the list's
   order. The same on every machine, every test in exactly one part.
   --plan prints the parts and their times without running anything. */
const shardArg = process.argv.slice(2).find((a) => /^--shard[= ]?\d+\/\d+$/.test(a) || a === "--shard");
let shard = null;
{
  const args = process.argv.slice(2);
  const i = args.indexOf("--shard");
  const spec = i >= 0 ? args[i + 1] : shardArg && shardArg.replace(/^--shard=?/, "");
  const m = spec && spec.match(/^(\d+)\/(\d+)$/);
  if (m) shard = { k: Number(m[1]), n: Number(m[2]) };
}
const only = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--shard") && a !== "--plan" && all[i - 1] !== "--shard");
let list = only.length ? E2E.filter((t) => only.some((o) => label(t).includes(o))) : E2E;
function parts(tests, n) {
  const load = Array(n).fill(0), of = new Map();
  tests.map((t, i) => ({ t, i })).sort((a, b) => secsOf(b.t) - secsOf(a.t) || a.i - b.i).forEach(({ t, i }) => {
    let k = 0;
    for (let j = 1; j < n; j++) if (load[j] < load[k]) k = j;
    load[k] += secsOf(t);
    of.set(i, k);
  });
  return Array.from({ length: n }, (_, k) => tests.filter((t, i) => of.get(i) === k));
}
if (process.argv.includes("--plan")) {
  const n = shard ? shard.n : 1;
  parts(list, n).forEach((p, k) => console.log(`${k + 1}/${n}: ${(p.reduce((s, t) => s + secsOf(t), 0) / 60).toFixed(1)} min, ${p.length} tests: ${p.map(label).join(", ")}`));
  process.exit(0);
}
if (shard) list = parts(list, shard.n)[shard.k - 1];
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
    // passes after its miss). And a test that threw: its error, what it was
    // waiting for and the test's own line (e2e-dock-moments on 6974393: a
    // click's long call log pushed all three out of the tail).
    const above = lines.slice(0, -25).filter((l) => /^\s*FAIL\b|^\s*\w*Error\b|waiting for (locator|getBy|selector)|tests\/[\w-]+\.mjs:\d+/.test(l)).slice(0, 40);
    if (above.length) console.log([...above, "..."].map((l) => `    ${l}`).join("\n"));
    console.log(tail.map((l) => `    ${l}`).join("\n"));
  }
}

const failed = results.filter((r) => r.code !== 0);
const mins = results.reduce((s, r) => s + r.secs, 0) / 60;
console.log(`\n${results.length - failed.length}/${results.length} passed in ${mins.toFixed(1)} min`);
if (failed.length) console.log(`failed: ${failed.map((r) => r.name).join(", ")}`);
process.exit(failed.length ? 1 : 0);
