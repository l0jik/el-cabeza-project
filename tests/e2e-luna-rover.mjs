/* Luna's rover drives all over, its crew getting out now and then for a
   sample of rock (user, of the rover parked by the base: "I want to see
   this rover slowly driving around, and I guess occasionally a driver or a
   second passenger get out and, I don't know, harvest some moon rock or
   something. Have it go all over the place."). themes/luna-rover.js.

   - At the start: on its way already, its tracks laid behind it; slow in
     real time (0.16 a second at most).
   - An hour of its time (window.__LUNA_ROVER_RUN__, nothing drawn
     between): all round the base (every one of eight sectors), out to 22
     at most, never by the board, never into anything standing (its middle
     always at least its own reach from every rock, the lander, the dish,
     the panels, the walkers), its height kept to the ground, many legs and
     many outings, some of them two of the crew; the tracks kept, capped.
   - One outing followed a quarter second at a time: the rover parked and
     still, its beacon blinking; one of the crew out of the hatch at the
     back, walking (the two strides in turn) round the rover, not through
     it, to the rock, kneeling at it, back with a sample case, in at the
     hatch; then it drives on, the beacon out.

   node tests/e2e-luna-rover.mjs */
import { chromium } from "playwright";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 30000) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, 250)); } };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-luna.html");
check("Luna's rover, for tests", !!(await poll(() => page.evaluate(() => typeof window.__LUNA_ROVER__ === "function" && typeof window.__LUNA_ROVER_RUN__ === "function"))));
const st = () => page.evaluate(() => window.__LUNA_ROVER__());

console.log("\nthe start");
const s0 = await st();
check(`on its way from where it stood parked (${s0.x.toFixed(1)}, ${s0.z.toFixed(1)}), its tracks laid behind it (${s0.track.join(" / ")} points)`, Math.hypot(s0.x - 7.4, s0.z + 5) < 1.5 && s0.track.every((n) => n > 50) && ["drive", "turn"].includes(s0.phase), JSON.stringify({ x: s0.x, z: s0.z, phase: s0.phase, track: s0.track }));
check(`its open ground found (${s0.openCells} cells of 0.25), made in ${s0.buildMs.toFixed(0)} ms`, s0.openCells > 5000, String(s0.openCells));
// a few seconds of real time, drawn: on the move (or turning to go)
await page.waitForTimeout(4000);
const s1 = await st();
check(`moving as it's drawn (${s1.odo.toFixed(2)} gone in 4 s, ${s1.phase})`, s1.odo > 0 || Math.abs(s1.ry - s0.ry) > 0.01, JSON.stringify({ odo: s1.odo, ry: [s0.ry, s1.ry], phase: s1.phase }));
const s2 = await page.evaluate(() => window.__LUNA_ROVER_RUN__(60));
check(`slow: at most ${s2.maxSpeed.toFixed(3)} a second (${s2.odo.toFixed(1)} in its first minute)`, s2.maxSpeed <= 0.161 && s2.odo > 3 && s2.odo < 10, JSON.stringify({ odo: s2.odo, maxSpeed: s2.maxSpeed }));

console.log("\nan hour of it");
const hour = await page.evaluate(() => {
  const at = [];
  let s;
  for (let k = 0; k < 720; k++) { s = window.__LUNA_ROVER_RUN__(5); at.push({ x: s.x, z: s.z, y: s.y, g: s.ground, phase: s.phase }); }
  return { s, at };
});
const H = hour.s;
check(`all round the base: every sector of eight (${H.sectors.join("")}), out to ${H.maxRadius.toFixed(1)} (no further than 22)`, H.sectors.length === 8 && H.maxRadius <= 22, JSON.stringify(H.visits.map((v) => Math.round(v))));
check(`never by the board (${H.boardHits} steps within its margin)`, H.boardHits === 0);
check(`never into anything standing: its middle at least ${H.minClear.toFixed(2)} from every rock, the lander, the dish, the panels, the walkers (its own reach 0.2)`, H.minClear >= 0.2, String(H.minClear));
check(`its height kept to the ground (at most ${H.worstLift.toFixed(3)} off where its wheels are)`, H.worstLift < 0.03 && hour.at.every((p) => Math.abs(p.y - p.g) < 0.08), String(H.worstLift));
check(`many legs and a long way (${H.legs} legs, ${H.odo.toFixed(0)} gone), none of them the long way round`, H.legs >= 20 && H.odo >= 300 && H.log.every((l) => l.L <= 1.7 * Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]) + 3 + 0.5 || l.L < 25), JSON.stringify(H.log.filter((l) => l.L > 1.7 * Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]) + 3.5).slice(0, 3)));
check(`the crew out now and then (${H.outings} outings, ${H.pairs} of them two; ${H.kneels} samples taken)`, H.outings >= 8 && H.pairs >= 1 && H.pairs < H.outings && H.kneels === H.outings, JSON.stringify({ outings: H.outings, pairs: H.pairs, kneels: H.kneels }));
check(`still while the crew's out (${H.movedWhileOut} steps moved)`, H.movedWhileOut === 0);
check(`the planning quick (${H.planMs.toFixed(1)} ms at worst)`, H.planMs < 120, String(H.planMs));
check(`its tracks kept, capped (${H.track.join(" / ")} points)`, H.track.every((n) => n > 4000 && n <= 6000), H.track.join("/"));

console.log("\nan outing, a quarter second at a time");
const out = await page.evaluate(() => {
  // on to the next stop
  let s = window.__LUNA_ROVER__();
  for (let k = 0; k < 3000 && s.phase === "parked"; k++) s = window.__LUNA_ROVER_RUN__(0.5);
  for (let k = 0; k < 6000 && s.phase !== "parked"; k++) s = window.__LUNA_ROVER_RUN__(0.5);
  const park = { x: s.x, z: s.z, ry: s.ry }, rock = s.rock, seen = [];
  const fx = Math.cos(park.ry), fz = -Math.sin(park.ry), bx = Math.sin(park.ry), bz = Math.cos(park.ry);
  const local = (p) => ({ lx: (p.x - park.x) * fx + (p.z - park.z) * fz, lz: (p.x - park.x) * bx + (p.z - park.z) * bz });
  for (let k = 0; k < 400; k++) {
    s = window.__LUNA_ROVER_RUN__(0.25);
    seen.push({ phase: s.phase, x: s.x, z: s.z, poses: s.poses, at: s.crewAt.map((c) => c && { ...c, ...local(c) }), beacon: s.beacon, speed: s.speed });
    if (s.phase !== "parked" && k > 4) break;
  }
  return { park, rock, seen, end: window.__LUNA_ROVER__() };
});
const S = out.seen, parked = S.filter((x) => x.phase === "parked"), poses = new Set(S.flatMap((x) => x.poses.filter(Boolean)));
const firsts = [0, 1].map((i) => S.find((x) => x.at[i]));
const lasts = [0, 1].map((i) => [...S].reverse().find((x) => x.at[i]));
const who = [0, 1].filter((i) => firsts[i]);
check(`stopped by a rock (r ${out.rock && out.rock.r.toFixed(2)}, ${out.rock && Math.hypot(out.rock.x - out.park.x, out.rock.z - out.park.z).toFixed(2)} off), still all the while (${parked.length} looks)`, !!out.rock && parked.length > 20 && parked.every((x) => Math.hypot(x.x - out.park.x, x.z - out.park.z) < 1e-6 && x.speed === 0));
check("...its beacon blinking while it's stopped", parked.some((x) => x.beacon > 0.5) && parked.some((x) => x.beacon < 0.2));
check(`...${who.length === 2 ? "two" : "one"} of the crew out at the hatch, at the back`, who.length >= 1 && who.every((i) => firsts[i].at[i].lx < -0.2 && Math.abs(firsts[i].at[i].lz) < 0.05), JSON.stringify(who.map((i) => firsts[i].at[i])));
check(`...walking, the two strides in turn (${[...poses].join(", ")})`, poses.has("walk") && poses.has("walk2"));
check("...round the rover, never through it", S.every((x) => x.at.every((c) => !c || !(c.lx > -0.21 && c.lx < 0.21 && Math.abs(c.lz) < 0.15))), JSON.stringify(S.flatMap((x) => x.at.filter((c) => c && c.lx > -0.21 && c.lx < 0.21 && Math.abs(c.lz) < 0.15)).slice(0, 3)));
const kneeling = S.filter((x) => x.poses.includes("kneel"));
const kneelAt = kneeling.length && kneeling[0].at[kneeling[0].poses.indexOf("kneel")];
check(`...kneeling at the rock a while (${(kneeling.length / 4).toFixed(1)} s, ${kneelAt && (Math.hypot(kneelAt.x - out.rock.x, kneelAt.z - out.rock.z) - out.rock.r).toFixed(2)} from its side)`, kneeling.length >= 16 && !!kneelAt && Math.hypot(kneelAt.x - out.rock.x, kneelAt.z - out.rock.z) - out.rock.r < 0.12);
check("...back with a sample case", poses.has("carry") && (poses.has("walkC") || poses.has("walk2C")));
check("...and in at the hatch again, every one of them", who.every((i) => lasts[i].at[i].lx < -0.2 && Math.abs(lasts[i].at[i].lz) < 0.06) && S[S.length - 1].at.every((c) => !c), JSON.stringify(who.map((i) => lasts[i].at[i])));
check(`then on its way, the beacon out (${out.end.phase})`, ["drive", "turn"].includes(out.end.phase) && out.end.beacon === 0 && out.end.out === 0);
check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
