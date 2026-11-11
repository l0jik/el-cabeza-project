/* Theme Lab: one audio manager, nine voices.

   One AudioContext for the whole page, made on the first user gesture
   (browsers refuse sound before one) and kept across theme switches:
   changing theme swaps the voice, it doesn't rebuild the audio graph.
   Every sound is a few short-lived nodes shaped by an envelope that
   starts and ends at zero (no clicks), disconnected when it ends; at
   most MAX_VOICES play at once, and anything past that is dropped
   rather than piled up. A global volume and mute sit on one master gain.

   Each direction's voice is its own: Swiss square clicks, the Monolith's
   real stone (recordings, not synthesis: monolith-sounds.js), De Stijl pulse trains,
   an Elementarist struck bar in tritones, Brutalist distorted sawtooth and metal, New
   Typography type-bar strikes and a bell, Corporate Swiss terminal beeps
   and split-flap flutter, Neo-Brutalist pops, Minimal Mono's few low
   transients, and Fusion's analytic tone over an industrial thud.

   The chassis calls the methods of the object createLabAudio returns
   (the same interface every theme's audio has); the lab also calls
   playHover, playTurn and playTheme. */

import { fetchSoundBytes, decodeBytes } from "../../chassis/sound-files.js";
import { MONOLITH_FILES, HIT_COUNT, HITS, FALLS, DRAGS, attackIn, endIn, landingRate, landingLevel, landingDepth, slamOf, dragRate } from "./monolith-sounds.js";

const MAX_VOICES = 24;
const S = {
  ctx: null, master: null, comp: null, noise: null, curve: null, room: null, echo: null,
  volume: 0.8, muted: false, active: 0,
};
const listeners = new Set();

function ensureCtx() {
  if (S.ctx) return S.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    S.ctx = new AC();
    S.comp = S.ctx.createDynamicsCompressor();
    S.comp.threshold.value = -14; S.comp.ratio.value = 4; S.comp.attack.value = 0.004; S.comp.release.value = 0.18;
    S.master = S.ctx.createGain();
    S.master.gain.value = S.muted ? 0 : S.volume;
    S.comp.connect(S.master);
    S.master.connect(S.ctx.destination);
    const len = S.ctx.sampleRate;
    S.noise = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    S.curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; S.curve[i] = Math.tanh(x * 3.2) * 0.9; }
  } catch (e) {
    S.ctx = null;
  }
  return S.ctx;
}

function applyMaster() {
  if (!S.ctx) return;
  S.master.gain.setTargetAtTime(S.muted ? 0 : S.volume, S.ctx.currentTime, 0.04);
}

export function setLabVolume(v) { S.volume = Math.max(0, Math.min(1, v)); applyMaster(); listeners.forEach((f) => f()); }
export function setLabMuted(m) { S.muted = !!m; applyMaster(); listeners.forEach((f) => f()); }
export function labAudioState() { return { volume: S.volume, muted: S.muted, started: !!S.ctx && S.ctx.state === "running", active: S.active }; }
export function onLabAudio(f) { listeners.add(f); return () => listeners.delete(f); }
export function startLabAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
  // A voice of recordings already fetching (the Monolith's) decodes them
  // now there's a context, whoever's gesture made it (the Lab's own
  // controls make it too, not only the board).
  if (c) Object.values(VOICES).forEach((v) => { if (v.prepare) try { v.prepare(false); } catch (e) { /* silent, then */ } });
  return !!c;
}

/* ---------------------------------------------------------- primitives */

const jitter = (amt) => 1 + (Math.random() * 2 - 1) * amt;

function voiceSlot() {
  if (!S.ctx || S.ctx.state !== "running" || S.muted || S.volume <= 0) return false;
  if (S.active >= MAX_VOICES) return false;
  S.active++;
  return true;
}
/* Each voice is released exactly once: when its source ends, or, as a
   backstop (some browsers never fire 'ended' on a context with no
   output device), a little after it should have. */
function releaser(nodes, seconds) {
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    S.active = Math.max(0, S.active - 1);
    nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* already gone */ } });
  };
  setTimeout(release, (seconds + 0.25) * 1000);
  return release;
}

function filterNode(f) {
  const n = S.ctx.createBiquadFilter();
  n.type = f.type || "lowpass";
  n.frequency.value = f.f || 1000;
  n.Q.value = f.q ?? 0.7;
  return n;
}

/* A shaped oscillator: type, frequency (optionally gliding to f2), an
   attack/decay envelope, an optional filter and distortion. */
/* A small room (0.5 s), made once and kept: a voice may send into it
   (`verb`, the send's level); its tail rings on after the voice itself
   has ended and been let go, and dies away to nothing by itself. */
function room() {
  if (S.room) return S.room;
  const c = S.ctx, n = Math.floor(c.sampleRate * 0.5), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let seed = 777 + ch * 101;
    for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; const r = i / n; d[i] = ((seed / 2147483647) * 2 - 1) * Math.exp(-6.9 * r) * (1 - r); }
  }
  S.room = c.createConvolver(); S.room.buffer = b;
  // (Its tail ~10 dB under the sound sent into it: heard, not washing it out.)
  const out = c.createGain(); out.gain.value = 4;
  S.room.connect(out).connect(S.comp);
  return S.room;
}

/* The plain's echo: what comes back off the stones standing round it, a
   little later and duller (two taps, a delay and a low-pass each, made
   once; no convolver, so a phone pays almost nothing for it). A voice
   sends into it with `echo`, the send's level. */
function plainEcho() {
  if (S.echo) return S.echo;
  const c = S.ctx, input = c.createGain();
  [[0.19, 1300, 0.42], [0.41, 800, 0.2]].forEach(([d, f, g]) => {
    const dl = c.createDelay(1); dl.delayTime.value = d;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = f;
    const gn = c.createGain(); gn.gain.value = g;
    input.connect(dl).connect(lp).connect(gn).connect(S.comp);
  });
  S.echo = input;
  return input;
}

/* A stretch of a recording: `at` seconds in, `len` of it, played at
   `rate` (slower is lower and longer, as a heavier stone sounds). Its own
   decay is the recording's; the envelope only opens and closes it without
   a click. `loop` ([start, end] in the buffer) holds it going round for
   `len` seconds, `swell` shaping that hold (a roll's grind rises and
   falls; a slide's holds). */
function sample({ buf, at = 0, len = 0.5, rate = 1, g = 0.3, delay = 0, a = 0.002, filter, echo = 0, loop, swell }) {
  if (!buf || !voiceSlot()) return;
  const c = S.ctx, t0 = c.currentTime + 0.005 + delay;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const dur = loop ? len : len / rate;
  const env = c.createGain();
  const peak = g * jitter(0.06);
  env.gain.setValueAtTime(0, t0);
  if (swell === "rise") { env.gain.linearRampToValueAtTime(peak, t0 + dur * 0.4); env.gain.linearRampToValueAtTime(0, t0 + dur); }
  else if (swell === "hold") { env.gain.linearRampToValueAtTime(peak, t0 + dur * 0.25); env.gain.setValueAtTime(peak, t0 + dur * 0.7); env.gain.linearRampToValueAtTime(0, t0 + dur); }
  else { env.gain.linearRampToValueAtTime(peak, t0 + a); env.gain.setValueAtTime(peak, t0 + Math.max(a, dur - 0.03)); env.gain.linearRampToValueAtTime(0, t0 + dur); }
  const chain = [src, env];
  let last = src;
  if (filter) { const fl = filterNode(filter); last.connect(fl); last = fl; chain.push(fl); }
  last.connect(env); env.connect(S.comp);
  if (echo > 0) { const send = c.createGain(); send.gain.value = echo; env.connect(send).connect(plainEcho()); chain.push(send); }
  if (loop) {
    src.loop = true; src.loopStart = loop[0]; src.loopEnd = loop[1];
    src.start(t0, loop[0] + Math.random() * (loop[1] - loop[0]) * 0.8);
  } else src.start(t0, at, len);
  src.stop(t0 + dur + 0.02);
  src.onended = releaser(chain, delay + dur + 0.05);
}

function tone({ type = "sine", f = 440, f2, dur = 0.1, a = 0.004, g = 0.1, delay = 0, filter, dist, det = 0.012, verb = 0 }) {
  if (!voiceSlot()) return;
  const c = S.ctx, t0 = c.currentTime + 0.005 + delay;
  const o = c.createOscillator();
  o.type = type;
  const fr = f * jitter(det);
  o.frequency.setValueAtTime(fr, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2 * jitter(det)), t0 + dur);
  const env = c.createGain();
  const peak = g * jitter(0.08);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(peak, t0 + a);
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + Math.max(a + 0.004, dur));
  env.gain.linearRampToValueAtTime(0, t0 + dur + 0.012);
  const chain = [o];
  let last = o;
  if (dist) { const w = c.createWaveShaper(); w.curve = S.curve; w.oversample = "2x"; last.connect(w); last = w; chain.push(w); }
  if (filter) { const fl = filterNode(filter); if (filter.to) fl.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur); last.connect(fl); last = fl; chain.push(fl); }
  last.connect(env); env.connect(S.comp); chain.push(env);
  if (verb > 0) { const send = c.createGain(); send.gain.value = verb; env.connect(send).connect(room()); chain.push(send); }
  o.start(t0); o.stop(t0 + dur + 0.03);
  o.onended = releaser(chain, delay + dur + 0.05);
}

/* A burst of filtered noise, same envelope rules. */
function noise({ dur = 0.03, a = 0.002, g = 0.1, delay = 0, filter = { type: "highpass", f: 2000 } }) {
  if (!voiceSlot()) return;
  const c = S.ctx, t0 = c.currentTime + 0.005 + delay;
  const src = c.createBufferSource();
  src.buffer = S.noise;
  src.playbackRate.value = jitter(0.1);
  const fl = filterNode(filter);
  if (filter.to) fl.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(g * jitter(0.1), t0 + a);
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + Math.max(a + 0.003, dur));
  env.gain.linearRampToValueAtTime(0, t0 + dur + 0.01);
  src.connect(fl); fl.connect(env); env.connect(S.comp);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.03);
  src.onended = releaser([src, fl, env], delay + dur + 0.05);
}

const seq = (list, fn) => list.forEach((x, i) => fn(x, i));

/* ---------------------------------------------------------- voices */

const VOICES = {
  swiss: {
    hover() { tone({ type: "square", f: 3136, dur: 0.006, g: 0.02, filter: { type: "highpass", f: 1500 } }); },
    select() { tone({ type: "square", f: 1760, dur: 0.018, g: 0.07, filter: { type: "highpass", f: 800 } }); tone({ type: "square", f: 2637, dur: 0.014, g: 0.05, delay: 0.03, filter: { type: "highpass", f: 800 } }); },
    deselect() { tone({ type: "square", f: 1318, dur: 0.016, g: 0.055, filter: { type: "highpass", f: 700 } }); },
    blocked() { seq([0, 0.07], (d) => tone({ type: "square", f: 220, dur: 0.045, g: 0.06, delay: d, filter: { f: 1200 } })); },
    roll() { tone({ type: "square", f: 440, f2: 392, dur: 0.06, g: 0.035, filter: { f: 2400 } }); },
    land(m) { tone({ type: "square", f: 180 - m * 40, dur: 0.03, g: 0.08, filter: { f: 900 } }); noise({ dur: 0.01, g: 0.04, filter: { type: "highpass", f: 3000 } }); },
    capture() { seq([1046, 784, 523], (f, i) => tone({ type: "square", f, dur: 0.05, g: 0.06, delay: i * 0.06, filter: { f: 3000 } })); },
    turn() { tone({ type: "square", f: 1568, dur: 0.012, g: 0.04, filter: { type: "highpass", f: 900 } }); },
    win() { seq([523, 659, 784, 1046], (f, i) => tone({ type: "square", f, dur: 0.09, g: 0.055, delay: i * 0.09, filter: { f: 3500 } })); },
    open() { tone({ type: "square", f: 2093, dur: 0.01, g: 0.04, filter: { type: "highpass", f: 1000 } }); },
    close() { tone({ type: "square", f: 1568, dur: 0.01, g: 0.035, filter: { type: "highpass", f: 1000 } }); },
    theme() { tone({ type: "square", f: 1046, dur: 0.02, g: 0.05 }); tone({ type: "square", f: 1568, dur: 0.02, g: 0.05, delay: 0.05 }); },
  },
  /* The Monolith: real stone, nothing synthesized (user: "I want real
     massive: thud / boom / scraping sounds ... per weight dictating
     pitch"). Recordings (monolith-sounds.js, tools/monolith_sounds.mjs),
     loaded once for the page and kept across switches; until they're in,
     it stays silent rather than stand in with a synthesizer.
     - a landing (user: "These are massive monolithic stones slamming
       down ... they need to be weighted appropriately as they fall"): one
       of five thumps on stone, lowered by the face it comes down on and a
       little by the whole piece (landingRate); under it the same thump an
       octave down, only its low end, more of it the deeper the face and
       the harder the fall (the weight); the grit where stone meets stone,
       dulled; after a hard fall the rubble it shakes loose; and the echo
       off the stones, longer the harder it lands. How loud, its cubes
       times how far it fell (slamOf: an Opa going over, a Flaco tipped
       off its end, hit hardest; a Turrito's roll least)
     - a roll: nothing as it tips (user: "Rolling should not make a slide
       sound"); its landing is its sound
     - a slide (the Cabeza, any slid block; user: "only for pieces slides
       or for the cabeza"): the edge grinding held for the glide (the
       door's slab for a heavy piece, stone rubbed on stone for a light
       one), lower as the piece is heavier, nothing struck at its end (the
       chassis's slidesGlide)
     - a crush: the concrete smash, a deep thump, rocks tumbling after
     - a win: the boom (the smash and a thump, slowed), the rockfall after */
  monolith: (() => {
    const L = { bytes: null, decoding: null, hits: null, falls: null, drags: null, attacks: [], ends: [] };
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    // (The knocks but the brightest, a rock thrown on rocks: a landing's
    // grit, lowered and dulled.)
    const GRIT = HITS.knock.filter((k) => k !== 6);
    const note = (part, info) => { if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__ && Array.isArray(window.__EC_TEST_MONOLITH__)) window.__EC_TEST_MONOLITH__.push({ part, ...info }); };
    const hit = (slot, rate, g, extra = {}) => {
      if (!L.hits) return;
      const at = L.attacks[slot] ?? slot;
      sample({ buf: L.hits, at, len: Math.max(0.05, (L.ends[slot] ?? slot + 0.95) - at), rate, g, ...extra });
    };
    const fall = (part, rate, g, extra = {}) => { if (L.falls) sample({ buf: L.falls, at: FALLS[part][0], len: FALLS[part][1], rate, g, ...extra }); };
    // A drag held for `secs`: the door's grind for a heavy piece, stone
    // rubbed on stone for a light one, the two together between.
    const drag = (units, secs, swell, level) => {
      if (!L.drags) return;
      const m = Math.max(1, Math.min(8, units || 1)), rate = dragRate(m), heavy = Math.min(1, Math.max(0, (m - 1.5) / 4));
      if (heavy < 1) sample({ buf: L.drags, loop: DRAGS.rub.loop, len: secs, rate: rate * 1.1, g: level * (1 - heavy), swell, a: 0.02 });
      if (heavy > 0) sample({ buf: L.drags, loop: DRAGS.grind.loop, len: secs, rate, g: level * heavy * 1.2, swell, a: 0.02 });
      note("drag", { units: m, rate, secs, swell });
    };
    return {
      // Fetched as soon as the direction is up; decoded once there's a
      // context. (fetch false: only decode, if they're already coming: the
      // page's context starting under another direction fetches nothing.)
      prepare(fetch = true) {
        if (!L.bytes) { if (!fetch) return; L.bytes = Promise.all(Object.values(MONOLITH_FILES).map((f) => fetchSoundBytes(f).catch(() => null))); }
        if (!S.ctx || L.decoding) return;
        L.decoding = L.bytes.then((list) => Promise.all(list.map((b) => (b ? decodeBytes(S.ctx, b).catch(() => null) : null)))).then(([hits, falls, drags]) => {
          L.hits = hits; L.falls = falls; L.drags = drags;
          if (hits) {
            const d = hits.getChannelData(0);
            L.attacks = Array.from({ length: HIT_COUNT }, (_, i) => attackIn(d, hits.sampleRate, i));
            L.ends = Array.from({ length: HIT_COUNT }, (_, i) => endIn(d, hits.sampleRate, i));
          }
          note("loaded", { hits: !!hits, falls: !!falls, drags: !!drags });
        });
      },
      hover() { hit(pick(HITS.knock), 1.55 * jitter(0.05), 0.05, { filter: { type: "highpass", f: 400 } }); },
      select() { hit(pick(HITS.knock), 1.1 * jitter(0.04), 0.22); hit(pick(HITS.thud), 1.45, 0.1); },
      deselect() { hit(pick(HITS.knock), 0.95 * jitter(0.04), 0.16); },
      blocked() { hit(pick(HITS.thud), 1.45, 0.2); hit(pick(HITS.thud), 1.32, 0.15, { delay: 0.11 }); },
      // (No roll: a stone going over its edge is silent till it lands.)
      slide(units, secs) { drag(units, Math.max(0.25, secs || 0.5), "hold", 0.14 + 0.2 * ((Math.max(1, Math.min(8, units || 1)) - 1) / 7)); },
      land(m, units, contact, fall) {
        const u = Math.max(1, Math.min(8, units || 1)), rate = landingRate(u, contact) * jitter(0.03);
        const slam = slamOf(u, fall), level = landingLevel(u, fall), deep = landingDepth(u, contact);
        const slot = pick(HITS.thud);
        // (Measured offline, scratch: a Turrito's roll a little over the
        // old cube's landing, an Opa's a few dB over the old Opa's, the
        // weight under them mostly below 120 Hz; on a phone's speaker the
        // body and the grit carry.)
        hit(slot, rate, 0.36 * level, { echo: 0.26 + 0.24 * slam });
        hit(slot, rate * 0.55, (0.18 + 0.34 * Math.max(deep, slam)) * level, { filter: { type: "lowpass", f: 140, q: 0.9 } });
        hit(pick(GRIT), rate * 0.95, (0.25 + 0.05 * slam) * level, { filter: { type: "lowpass", f: 3200 } });
        if (slam > 0.3) hit(pick(HITS.rubble), rate * 0.85, 0.3 * ((slam - 0.3) / 0.7) * level, { delay: 0.045 + Math.random() * 0.035, echo: 0.2 });
        note("land", { units, contact, fall, rate, level, slam });
      },
      // (A crush and a win at the other directions' loudest, measured
      // offline: the smash at full strength stood 10 dB over them.)
      capture() {
        fall("smash", 0.88, 0.24, { echo: 0.3 });
        const slot = pick(HITS.thud);
        hit(slot, 0.55, 0.3, { echo: 0.25 });
        // (Its weight under it, as a landing's, over the heaviest landing.)
        hit(slot, 0.3, 0.42, { filter: { type: "lowpass", f: 140, q: 0.9 } });
        fall("tumble", 1, 0.15, { delay: 0.16 });
        note("capture", {});
      },
      turn() { hit(pick(HITS.thud), 0.78, 0.09, { filter: { type: "lowpass", f: 520 }, echo: 0.45 }); },
      win() {
        fall("smash", 0.5, 0.3, { echo: 0.35 });
        hit(pick(HITS.thud), 0.45, 0.32);
        fall("rockfall", 0.82, 0.24, { delay: 0.28 });
        note("win", {});
      },
      open() { hit(pick(HITS.knock), 1.25, 0.08); },
      close() { hit(pick(HITS.knock), 1.05, 0.07); },
      theme() { hit(pick(HITS.thud), 0.6, 0.5, { echo: 0.35 }); hit(pick(HITS.rubble), 0.7, 0.3, { delay: 0.05 }); },
    };
  })(),
  destijl: {
    hover() { tone({ type: "square", f: 1760, dur: 0.008, g: 0.018, filter: { f: 2400 } }); },
    select() { seq([660, 660, 990], (f, i) => tone({ type: "square", f, dur: 0.02, g: 0.06, delay: i * 0.04, filter: { f: 1800 } })); },
    deselect() { seq([990, 660], (f, i) => tone({ type: "square", f, dur: 0.02, g: 0.05, delay: i * 0.04, filter: { f: 1800 } })); },
    blocked() { seq([0, 0.09], (d) => tone({ type: "square", f: 110, dur: 0.07, g: 0.07, delay: d, filter: { f: 700 } })); },
    roll() { seq([0, 0.05], (d) => tone({ type: "square", f: 330, dur: 0.02, g: 0.04, delay: d, filter: { f: 1400 } })); },
    land(m) { tone({ type: "sine", f: 90 - m * 20, dur: 0.08, g: 0.16 }); tone({ type: "square", f: 180, dur: 0.02, g: 0.04, filter: { f: 900 } }); },
    capture() { seq([1320, 990, 660, 330], (f, i) => tone({ type: "square", f, dur: 0.03, g: 0.06, delay: i * 0.045, filter: { f: 2400 } })); },
    turn() { tone({ type: "square", f: 880, dur: 0.03, g: 0.04, filter: { f: 2000 } }); tone({ type: "square", f: 1320, dur: 0.03, g: 0.03, filter: { f: 2400 } }); },
    win() { seq([523, 784, 523, 784, 523, 784, 1046], (f, i) => tone({ type: "square", f, dur: i === 6 ? 0.22 : 0.03, g: 0.05, delay: i * 0.07, filter: { f: 2600 } })); },
    open() { tone({ type: "square", f: 1320, dur: 0.015, g: 0.04, filter: { f: 2400 } }); },
    close() { tone({ type: "square", f: 990, dur: 0.015, g: 0.035, filter: { f: 2400 } }); },
    theme() { seq([660, 990, 1320], (f, i) => tone({ type: "square", f, dur: 0.02, g: 0.05, delay: i * 0.05, filter: { f: 2400 } })); },
  },
  brutalist: {
    hover() { noise({ dur: 0.01, g: 0.025, filter: { type: "bandpass", f: 4000, q: 8 } }); },
    select() { noise({ dur: 0.05, g: 0.16, filter: { type: "bandpass", f: 2400, q: 8 } }); tone({ type: "sawtooth", f: 110, dur: 0.06, g: 0.05, dist: true, filter: { f: 900 } }); },
    deselect() { noise({ dur: 0.04, g: 0.12, filter: { type: "bandpass", f: 1600, q: 8 } }); },
    blocked() { tone({ type: "sawtooth", f: 55, dur: 0.18, g: 0.1, dist: true, filter: { f: 400 } }); },
    roll(m, dur) { noise({ dur: Math.min(0.45, dur * 0.8), a: 0.03, g: 0.05, filter: { type: "lowpass", f: 400 } }); tone({ type: "sawtooth", f: 70, dur: Math.min(0.4, dur * 0.7), g: 0.03, dist: true, filter: { f: 300 } }); },
    land(m) { tone({ f: 55, f2: 40, dur: 0.22, g: 0.24 + m * 0.06 }); noise({ dur: 0.08, g: 0.16, filter: { type: "bandpass", f: 900, q: 3 } }); },
    capture() { tone({ type: "sawtooth", f: 80, f2: 40, dur: 0.45, g: 0.12, dist: true, filter: { f: 1200, to: 200 } }); noise({ dur: 0.25, g: 0.07, filter: { type: "highpass", f: 1500 } }); },
    turn() { noise({ dur: 0.03, g: 0.1, filter: { type: "bandpass", f: 3000, q: 12 } }); },
    win() { seq([110, 165, 220], (f) => tone({ type: "sawtooth", f, dur: 0.8, a: 0.02, g: 0.05, dist: true, filter: { f: 300, to: 2000 } })); },
    open() { noise({ dur: 0.04, g: 0.1, filter: { type: "bandpass", f: 1200, q: 6 } }); },
    close() { noise({ dur: 0.04, g: 0.09, filter: { type: "bandpass", f: 800, q: 6 } }); },
    theme() { tone({ f: 60, f2: 42, dur: 0.3, g: 0.22 }); noise({ dur: 0.1, g: 0.12, filter: { type: "bandpass", f: 1100, q: 4 } }); },
  },
  newTypography: (() => {
    const key = (g = 1, delay = 0) => { noise({ dur: 0.012, g: 0.14 * g, delay, filter: { type: "highpass", f: 2500 } }); noise({ dur: 0.03, g: 0.08 * g, delay, filter: { type: "bandpass", f: 900, q: 2 } }); };
    return {
      hover() { key(0.2); },
      select() { key(1); },
      deselect() { key(0.7); },
      blocked() { key(1); key(1, 0.05); tone({ f: 80, dur: 0.05, g: 0.08 }); },
      roll() { key(0.6); key(0.5, 0.06); },
      land() { key(1); tone({ f: 120, dur: 0.05, g: 0.06 }); },
      capture() { key(1); key(1, 0.04); key(1, 0.08); noise({ dur: 0.12, g: 0.05, delay: 0.12, filter: { type: "bandpass", f: 2400, to: 700, q: 3 } }); },
      turn() { noise({ dur: 0.15, g: 0.045, filter: { type: "bandpass", f: 800, to: 2400, q: 3 } }); },
      win() { tone({ f: 2093, dur: 0.9, a: 0.002, g: 0.1 }); tone({ f: 4186, dur: 0.5, a: 0.002, g: 0.03 }); },
      open() { key(0.6); },
      close() { key(0.5); },
      theme() { key(1); key(0.8, 0.07); key(0.9, 0.12); tone({ f: 2093, dur: 0.4, g: 0.05, delay: 0.2 }); },
    };
  })(),
  corporateSwiss: (() => {
    const flutter = (n, g = 0.04, delay = 0) => { for (let i = 0; i < n; i++) noise({ dur: 0.006, g, delay: delay + i * 0.018, filter: { type: "highpass", f: 3000 } }); };
    return {
      hover() { tone({ f: 2400, dur: 0.01, g: 0.015, det: 0 }); },
      select() { tone({ f: 1000, dur: 0.04, g: 0.06, det: 0 }); tone({ f: 1500, dur: 0.04, g: 0.05, delay: 0.05, det: 0 }); },
      deselect() { tone({ f: 1500, dur: 0.04, g: 0.05, det: 0 }); tone({ f: 1000, dur: 0.04, g: 0.045, delay: 0.05, det: 0 }); },
      blocked() { tone({ f: 440, dur: 0.12, g: 0.07, det: 0 }); tone({ type: "square", f: 220, dur: 0.12, g: 0.025, filter: { f: 600 }, det: 0 }); },
      roll() { flutter(6); },
      land() { tone({ f: 800, dur: 0.05, g: 0.06, det: 0 }); },
      capture() { seq([1200, 900, 600], (f, i) => tone({ f, dur: i === 2 ? 0.12 : 0.06, g: 0.07, delay: i * 0.08, det: 0 })); },
      turn() { flutter(12, 0.035); tone({ f: 1000, dur: 0.03, g: 0.04, delay: 0.23, det: 0 }); },
      win() { seq([1000, 1250, 1500, 2000], (f, i) => tone({ f, dur: 0.08, g: 0.06, delay: i * 0.1, det: 0 })); },
      open() { tone({ f: 1800, dur: 0.02, g: 0.035, det: 0 }); },
      close() { tone({ f: 1200, dur: 0.02, g: 0.03, det: 0 }); },
      theme() { flutter(16, 0.04); tone({ f: 1000, dur: 0.05, g: 0.05, delay: 0.3, det: 0 }); },
    };
  })(),
  neoBrutalist: (() => {
    const pop = (f, g = 0.16, delay = 0, verb = 0) => tone({ f, f2: f * 0.3, dur: 0.035, a: 0.002, g, delay, det: 0.05, verb });
    return {
      hover() { pop(1600, 0.035); },
      select() { pop(900); },
      deselect() { pop(600, 0.12); },
      blocked() { tone({ type: "square", f: 150, dur: 0.08, g: 0.06, filter: { f: 800 } }); pop(300, 0.1, 0.02); },
      roll() { pop(500, 0.08); pop(700, 0.07, 0.06); },
      // The thunk at the end of a move: 60% lower than it was (user), and
      // a little room round it (0.5 s) that always rings fully away.
      land() { pop(250, 0.08, 0, 0.8); tone({ f: 90, dur: 0.06, g: 0.04, verb: 0.8 }); },
      capture() { seq([1200, 900, 600], (f, i) => pop(f, 0.14, i * 0.05)); noise({ dur: 0.06, g: 0.06, delay: 0.15, filter: { type: "highpass", f: 2500 } }); },
      turn() { pop(1100, 0.1); },
      win() { seq([600, 800, 1000, 1200, 1600], (f, i) => pop(f, 0.14, i * 0.06)); tone({ f: 1600, dur: 0.3, g: 0.05, delay: 0.32 }); },
      open() { pop(1300, 0.08); },
      close() { pop(800, 0.07); },
      theme() { seq([700, 1100, 1500], (f, i) => pop(f, 0.12, i * 0.06)); },
    };
  })(),
  /* Minimal Mono (user: "Sounds on minimal mono seem like they are way
     too low ... does this sound volume setting match with other ones?"):
     the same master as every direction, but its notes are 41-82 Hz, which
     a phone's or a laptop's speaker hardly gives back and the ear hears
     faintly at any level (its pick-up and landing, against the other
     directions' median: 3% and 5% through a small speaker, 23% and 4% as
     heard on headphones, A-weighted). Each note now carries its 4th and
     8th partials, quietly, so it's heard at about the others' level (92%
     and 107% through a small speaker, 83% and 79% on headphones) and still
     reads as one low, plain note. The roll, a hover, the panel's open and
     close stay silent, as they were made. */
  minimalMono: (() => {
    const note = (f, dur, a, g, delay = 0) => {
      tone({ f, dur, a, g, delay, det: 0 });
      tone({ f: f * 4, dur, a, g: g * 0.3, delay, det: 0 });
      tone({ f: f * 8, dur: dur * 0.7, a, g: g * 0.2, delay, det: 0 });
    };
    return {
      hover() {},
      select() { note(62, 0.12, 0.008, 0.2); },
      deselect() { note(55, 0.1, 0.008, 0.13); },
      blocked() { seq([0, 0.1], (d) => note(48, 0.08, 0.006, 0.14, d)); },
      roll() {},
      land() { noise({ dur: 0.05, g: 0.1, filter: { type: "lowpass", f: 180 } }); note(98, 0.07, 0.004, 0.075); },
      capture() { note(41, 0.3, 0.01, 0.26); },
      turn() { note(70, 0.06, 0.008, 0.07); },
      win() { note(55, 0.6, 0.02, 0.18); note(82.4, 0.6, 0.02, 0.14, 0.25); },
      open() {},
      close() {},
      theme() { note(58, 0.2, 0.01, 0.16); },
    };
  })(),
  ultimateFusion: {
    hover() { tone({ f: 2400, dur: 0.01, g: 0.015, det: 0 }); },
    select() { tone({ f: 1200, dur: 0.03, g: 0.05, det: 0 }); noise({ dur: 0.03, g: 0.08, filter: { type: "bandpass", f: 2400, q: 6 } }); },
    deselect() { tone({ f: 900, dur: 0.03, g: 0.045, det: 0 }); },
    blocked() { tone({ type: "sawtooth", f: 60, dur: 0.15, g: 0.08, dist: true, filter: { f: 500 } }); tone({ f: 440, dur: 0.08, g: 0.04, det: 0 }); },
    roll(m, dur) { noise({ dur: Math.min(0.4, dur * 0.7), a: 0.03, g: 0.04, filter: { type: "lowpass", f: 500 } }); tone({ f: 600, f2: 900, dur: 0.1, g: 0.03 }); },
    land(m) { tone({ f: 55, dur: 0.2, g: 0.22 + m * 0.05 }); noise({ dur: 0.06, g: 0.1, filter: { type: "bandpass", f: 1200, q: 3 } }); tone({ f: 1600, dur: 0.02, g: 0.035, delay: 0.03, det: 0 }); },
    capture() { tone({ type: "sawtooth", f: 90, f2: 45, dur: 0.4, g: 0.09, dist: true, filter: { f: 900, to: 200 } }); seq([1200, 900], (f, i) => tone({ f, dur: 0.05, g: 0.05, delay: 0.05 + i * 0.07, det: 0 })); },
    turn() { tone({ f: 1000, dur: 0.03, g: 0.04, det: 0 }); noise({ dur: 0.02, g: 0.06, filter: { type: "bandpass", f: 2800, q: 10 } }); },
    win() { tone({ type: "sawtooth", f: 110, dur: 0.8, a: 0.03, g: 0.05, dist: true, filter: { f: 300, to: 1800 } }); seq([1000, 1500, 2000], (f, i) => tone({ f, dur: 0.08, g: 0.05, delay: 0.1 + i * 0.1, det: 0 })); },
    open() { tone({ f: 1500, dur: 0.02, g: 0.035, det: 0 }); },
    close() { tone({ f: 1000, dur: 0.02, g: 0.03, det: 0 }); },
    theme() { tone({ f: 55, dur: 0.25, g: 0.2 }); tone({ f: 1500, dur: 0.04, g: 0.05, delay: 0.08, det: 0 }); },
  },
};

const massOf = (vol) => Math.max(0, Math.min(1, (Math.max(1, Math.min(8, vol || 1)) - 1) / 7));

export function playLabVoice(voiceId, event, ...args) {
  const v = VOICES[voiceId];
  if (!v || !v[event] || !S.ctx) return;
  try { v[event](...args); } catch (e) { /* a sound is never worth an error */ }
}

/* The chassis's audio interface, speaking with one direction's voice. */
export function createLabAudio(voiceId) {
  const play = (event, ...args) => playLabVoice(voiceId, event, ...args);
  let disposed = false;
  const guard = (fn) => (...a) => { if (!disposed) fn(...a); };
  // A voice made of recordings (the Monolith's) starts fetching them now,
  // and decodes them once the page has its context.
  const prepare = () => { const v = VOICES[voiceId]; if (v && v.prepare) try { v.prepare(); } catch (e) { /* silent, then */ } };
  prepare();
  const audio = {
    ensureStarted() { startLabAudio(); prepare(); },
    // (Begin Game is a press: the sound starts there, the first piece
    // picked up heard, and the Monolith's recordings decoded by then.)
    beginGameFadeIn() { startLabAudio(); prepare(); },
    setZoom() {}, setTension() {}, beginFadeOut() {}, resetWindDown() {},
    setMuted(m) { setLabMuted(m); },
    setVolume(v) { setLabVolume(v); }, // (the dock's fader)
    playSelect: guard(() => play("select")),
    playDeselect: guard(() => play("deselect")),
    playBlocked: guard(() => play("blocked")),
    // (The piece's cubes and, landing, the face it comes down on, for a
    // voice that pitches by them: the Monolith's, as the wooden pieces do.)
    playRollStart: guard((vol, durMs) => play("roll", massOf(vol), (durMs || 400) / 1000, vol)),
    // (And how far it fell, rolled over: the Monolith's weight by it.)
    playLanding: guard((vol, contact, fall) => play("land", massOf(vol), vol, contact, fall)),
    playCapture: guard(() => play("capture")),
    playWin: guard(() => play("win")),
    playMenu: guard(() => play("open")), fadeOutMenu() {}, stopMenu() {},
    playRulesOpen: guard(() => play("open")), playRulesClose: guard(() => play("close")), playRulesTab: guard(() => play("hover")),
    playPowerOn: guard(() => play("theme")), playPowerOff: guard(() => play("close")),
    playDockOpen: guard(() => play("open")), playDockClose: guard(() => play("close")),
    playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {},
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {}, playSingularityDismiss() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    // The lab's own cues (not called by the chassis).
    playHover: guard(() => play("hover")),
    playTurn: guard(() => play("turn")),
    playTheme: guard(() => play("theme")),
    // Theme switches keep the shared context; only this voice goes quiet.
    dispose() { disposed = true; },
  };
  // A glide (the Cabeza, a slid block) where the voice has one: the chassis
  // plays it instead of a roll and a landing where the theme says its
  // slides glide (slidesGlide), and nothing where a voice has none.
  if (VOICES[voiceId] && VOICES[voiceId].slide) audio.playSlide = guard((vol, durMs) => play("slide", vol, (durMs || 500) / 1000));
  return audio;
}
