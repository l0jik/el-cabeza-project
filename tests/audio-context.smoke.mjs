/* The audio context at the device's own rate, up to 48 kHz
   (themes/audio-context.js; user, on a laptop: the sound dropped out from
   the SINGULARITY tap until the sphere's ring). A sound card set to 96 or
   192 kHz runs every node, the long reverbs most of all, two or four times
   over; above 48 kHz the context is made again at 48 kHz.

   node tests/audio-context.smoke.mjs */
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };

const { makeAudioContext, MAX_RATE } = await import("../themes/audio-context.js");
// A stand-in: made at the device's rate unless given one; takes options or not.
function device(rate, { takesOptions = true } = {}) {
  const made = [];
  class AC {
    constructor(opts) {
      if (opts && !takesOptions) throw new TypeError("no options here");
      this.sampleRate = opts && opts.sampleRate ? opts.sampleRate : rate;
      this.closed = false;
      made.push(this);
    }
    close() { this.closed = true; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: AC };
  return made;
}

let made = device(48000);
let c = makeAudioContext();
check("a 48 kHz card: its own rate, one context", c.sampleRate === 48000 && made.length === 1 && !c.closed);
made = device(44100);
c = makeAudioContext();
check("a 44.1 kHz card: its own rate, one context", c.sampleRate === 44100 && made.length === 1);
made = device(192000);
c = makeAudioContext();
check("a 192 kHz card: made again at 48 kHz, the first closed", c.sampleRate === MAX_RATE && made.length === 2 && made[0].closed && !c.closed, JSON.stringify(made));
made = device(96000);
c = makeAudioContext();
check("a 96 kHz card: 48 kHz", c.sampleRate === 48000 && made[0].closed);
made = device(96000, { takesOptions: false });
c = makeAudioContext();
check("a browser that takes no rate: the device's, kept open", c.sampleRate === 96000 && made.length === 1 && !c.closed);
globalThis.window = {};
check("no Web Audio: none", makeAudioContext() === null);
delete globalThis.window;
check("no window: none", makeAudioContext() === null);

console.log(fails === 0 ? `\nAUDIO CONTEXT SMOKE PASSED (${checks})` : `\nAUDIO CONTEXT SMOKE FAILED (${fails} of ${checks})`);
process.exit(fails ? 1 : 0);
