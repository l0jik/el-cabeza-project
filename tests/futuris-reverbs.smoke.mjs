/* Which devices get the Singularity's light reverbs (one channel, the long
   ones shorter; themes/futuris-summon-audio.js lightReverbsFor): a phone,
   and a computer that may not keep up with the full ones, a Chromebook or
   one with 4 GB or less or two cores or fewer, not an ordinary four-core
   one (user, on a Chromebook: no sound from the tap into the wormhole on,
   "the sound of going through the black hole and the 'ear-ringing' when you
   arrive are absent"). The full set needs about 30% of a desktop core's
   real time, the light about 9%.

   node tests/futuris-reverbs.smoke.mjs */
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

const { lightReverbsFor } = await import("../themes/futuris-summon-audio.js");
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null) };
function device({ ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0", cores = 8, memory = 8, touchOnly = false } = {}) {
  globalThis.window = { matchMedia: (q) => ({ matches: touchOnly && /pointer: coarse/.test(q) }), navigator: { userAgent: ua, hardwareConcurrency: cores, deviceMemory: memory } };
  return lightReverbsFor();
}
const CROS = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

check("a desktop with 8 cores and 8 GB: the full reverbs", device() === false);
check("a Chromebook: light, even with 8 cores and 8 GB", device({ ua: CROS }) === true);
check("a computer with 4 cores and 8 GB: the full reverbs (the test machines' own)", device({ cores: 4 }) === false);
check("...with 2 cores: light", device({ cores: 2 }) === true);
check("...with 4 GB: light", device({ memory: 4 }) === true);
check("a phone (touch only): light", device({ touchOnly: true }) === true);
check("a browser that doesn't say its cores or memory: full", device({ cores: undefined, memory: undefined }) === false);
store.set("ec:reverbs", "full");
check("the override \"full\" on a Chromebook: full", device({ ua: CROS }) === false);
store.set("ec:reverbs", "light");
check("the override \"light\" on a desktop: light", device() === true);
store.clear();
delete globalThis.window;
check("no window (a test in Node): full", lightReverbsFor() === false);

console.log(fails === 0 ? `\nFUTURIS REVERBS SMOKE PASSED (${checks})` : `\nFUTURIS REVERBS SMOKE FAILED (${fails} of ${checks})`);
process.exit(fails ? 1 : 0);
