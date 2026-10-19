/* The frame-rate governor (chassis/device-fit.js) on made-up frame times
   (user: "We need to see how we can make the animations run more smoothly
   for low capability machines"): slow everywhere, it lowers the pixel
   ratio to its floor, then halves the shadow map, then holds the frames
   to 30 a second; slow only while something moves, it halves the shadow
   map first; with room again it gives them back one at a time, slowly;
   it remembers where it settled for the next visit, by tier and world;
   under the browser tests it only moves the pixel ratio unless asked.

   node tests/device-fit.smoke.mjs */
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

// A page without a page: the clock, storage, the window.
let clock = 0;
globalThis.performance = { now: () => clock };
const store = new Map();
globalThis.window = { devicePixelRatio: 2, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } };
globalThis.document = { hidden: false };
const timers = [];
globalThis.setTimeout = (f, ms) => { timers.push({ f, at: clock + ms }); return timers.length; };
globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].f = null; };
const runTimers = () => { for (const t of timers) if (t.f && t.at <= clock) { const f = t.f; t.f = null; f(); } };

const { createGovernor } = await import("../chassis/device-fit.js");
const Q = { tier: "mid", dprCap: 1.75, dprFloor: 1, shadowMap: 2048 };

function rig(opts = {}) {
  const renderer = { pr: 1.75, getPixelRatio() { return this.pr; }, setPixelRatio(v) { this.pr = v; }, setSize() {} };
  const light = { shadow: { mapSize: { x: 2048, y: 2048, set(a, b) { this.x = a; this.y = b; } }, map: { dispose() {} } } };
  const gov = createGovernor(renderer, () => ({ w: 400, h: 800 }), Q, { key: "test", light: () => light, ...opts });
  return { renderer, light, gov };
}
/* ms of play: a refresh every `refresh` ms; a frame drawn costs `cost`
   (the next refresh comes when it's done); busy(t): something moving. */
function play(r, ms, { cost = 16.7, refresh = 16.7, busy = () => false, busyCost = null } = {}) {
  const end = clock + ms;
  while (clock < end) {
    const now = clock;
    if (r.gov.skip(now)) { clock += refresh; runTimers(); continue; }
    const b = busy(now);
    r.gov.govern(now, b);
    const c = b && busyCost != null ? busyCost : cost;
    clock += Math.max(refresh, Math.ceil(c / refresh) * refresh);
    runTimers();
  }
}

console.log("[slow everywhere: 30 ms a frame]");
{
  clock = 1000; store.clear();
  const r = rig();
  check("starts at the tier's cap", r.renderer.pr === 1.75);
  play(r, 2500, { cost: 30 });
  check("within a few seconds the pixel ratio is lower", r.renderer.pr < 1.75, String(r.renderer.pr));
  play(r, 12000, { cost: 30 });
  const s = r.gov.state();
  check("...down to its floor, the shadow map halved twice (to 512), and held to 30", r.renderer.pr === 1 && s.shadowMap === 512 && r.light.shadow.mapSize.x === 512 && s.paced, JSON.stringify(s));
  // Held to 30: a frame every other refresh.
  let drawn = 0, skipped = 0;
  for (let i = 0; i < 60; i++) { if (r.gov.skip(clock)) skipped++; else drawn++; clock += 16.7; }
  check("...a frame drawn every other refresh", Math.abs(drawn - 30) <= 1 && Math.abs(skipped - 30) <= 1, `${drawn} drawn, ${skipped} skipped`);
  // Frames coming every 30 ms of themselves (a slow renderer, the browser
  // tests' own): still no more than 30 a second.
  let slowDrawn = 0;
  for (let i = 0; i < 100; i++) { if (!r.gov.skip(clock)) slowDrawn++; clock += 30; }
  check("...and frames every 30 ms of themselves: no more than 30 a second (not all 100 in 3 s)", slowDrawn <= 91 && slowDrawn >= 85, `${slowDrawn} drawn in 3 s`);
  runTimers();
  clock += 4000; runTimers();
  const saved = JSON.parse(store.get("el-cabeza:fit") || "{}")["mid|test"];
  check("...and remembered for the next visit", saved && saved.pr === 1 && saved.shadow === 512 && saved.paced === true, JSON.stringify(saved));
  const again = rig();
  check("the next visit starts where it settled", again.renderer.pr === 1 && again.gov.state().paced && again.gov.state().shadowMap === 512, JSON.stringify(again.gov.state()));
  // The first frame puts the remembered shadow size on the light.
  again.gov.govern(clock, false);
  check("...the shadow map made that size at its first frame", again.light.shadow.mapSize.x === 512, String(again.light.shadow.mapSize.x));
}

console.log("[room again: 10 ms a frame]");
{
  clock = 100000; store.clear();
  const r = rig();
  play(r, 15000, { cost: 30 });
  check("(slow first: held to 30)", r.gov.state().paced);
  play(r, 2000, { cost: 10 });
  check("no change at once (it waits)", r.gov.state().paced);
  play(r, 20000, { cost: 10 });
  check("the 30 a second comes off first", !r.gov.state().paced, JSON.stringify(r.gov.state()));
  play(r, 60000, { cost: 10 });
  const s = r.gov.state();
  check("...then the shadow map, then the pixel ratio, back to the cap", s.shadowMap === 2048 && r.renderer.pr > 1.74, JSON.stringify(s));
}

console.log("[slow only while something moves]");
{
  clock = 300000; store.clear();
  const r = rig();
  // At rest 12 ms; a roll of 400 ms every 1.5 s at 40 ms a frame.
  play(r, 9000, { cost: 12, busy: (t) => t % 1500 < 400, busyCost: 40 });
  const s = r.gov.state();
  check("the shadow map is what's halved, the pixel ratio kept", s.shadowMap < 2048 && r.renderer.pr === 1.75, JSON.stringify({ ...s, pr: r.renderer.pr }));
}

console.log("[the browser tests]");
{
  clock = 500000; store.clear();
  window.__EC_TEST_HOOKS__ = true;
  const r = rig();
  play(r, 20000, { cost: 120 });
  const s = r.gov.state();
  check("only the pixel ratio moves, nothing's remembered", r.renderer.pr === 1 && s.shadowMap === 2048 && !s.paced && !store.has("el-cabeza:fit"), JSON.stringify(s));
  window.__EC_TEST_FIT__ = true;
  const r2 = rig();
  play(r2, 20000, { cost: 120 });
  check("...unless a test asks (__EC_TEST_FIT__)", r2.gov.state().paced && r2.gov.state().shadowMap === 512, JSON.stringify(r2.gov.state()));
  delete window.__EC_TEST_HOOKS__; delete window.__EC_TEST_FIT__;
}

console.log(`\ndevice fit: ${checks} checks, ${fails} failed`);
if (fails) { console.log("DEVICE FIT SMOKE FAILED"); process.exit(1); }
