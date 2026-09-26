/* Theme Lab: one audio manager, ten voices.

   One AudioContext for the whole page, made on the first user gesture
   (browsers refuse sound before one) and kept across theme switches:
   changing theme swaps the voice, it doesn't rebuild the audio graph.
   Every sound is a few short-lived nodes shaped by an envelope that
   starts and ends at zero (no clicks), disconnected when it ends; at
   most MAX_VOICES play at once, and anything past that is dropped
   rather than piled up. A global volume and mute sit on one master gain.

   Each direction's voice is its own synthesis, not one sample re-pitched:
   Swiss square clicks, Bauhaus warm triangles, De Stijl pulse trains,
   Elementarist sweeps, Brutalist distorted sawtooth and metal, New
   Typography type-bar strikes and a bell, Corporate Swiss terminal beeps
   and split-flap flutter, Neo-Brutalist pops, Minimal Mono's few low
   transients, and Fusion's analytic tone over an industrial thud.

   The chassis calls the methods of the object createLabAudio returns
   (the same interface every theme's audio has); the lab also calls
   playHover, playTurn and playTheme. */

const MAX_VOICES = 24;
const S = {
  ctx: null, master: null, comp: null, noise: null, curve: null,
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
export function startLabAudio() { const c = ensureCtx(); if (c && c.state === "suspended") c.resume(); return !!c; }

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
function tone({ type = "sine", f = 440, f2, dur = 0.1, a = 0.004, g = 0.1, delay = 0, filter, dist, det = 0.012 }) {
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
  bauhaus: {
    hover() { tone({ type: "triangle", f: 784, dur: 0.05, g: 0.025 }); },
    select() { tone({ type: "triangle", f: 392, dur: 0.22, g: 0.1, filter: { f: 2000 } }); tone({ type: "triangle", f: 587.3, dur: 0.2, g: 0.07, delay: 0.02, filter: { f: 2000 } }); },
    deselect() { tone({ type: "triangle", f: 587.3, f2: 392, dur: 0.18, g: 0.07 }); },
    blocked() { tone({ type: "triangle", f: 233, dur: 0.25, g: 0.08 }); tone({ type: "triangle", f: 247, dur: 0.25, g: 0.08 }); },
    roll(m, dur) { tone({ type: "triangle", f: 196, f2: 220, dur: Math.min(0.3, dur * 0.6), g: 0.06 }); },
    land(m) { tone({ type: "triangle", f: 130.8 - m * 30, dur: 0.25, g: 0.13, filter: { f: 700 } }); noise({ dur: 0.04, g: 0.06, filter: { type: "lowpass", f: 300 } }); },
    capture() { seq([392, 311, 261.6], (f, i) => tone({ type: "triangle", f, dur: 0.18, g: 0.09, delay: i * 0.09 })); },
    turn() { tone({ type: "triangle", f: 523.3, dur: 0.12, g: 0.05 }); },
    win() { seq([261.6, 329.6, 392, 523.3, 659.3], (f, i) => tone({ type: "triangle", f, dur: 0.24, g: 0.08, delay: i * 0.12 })); },
    open() { tone({ type: "triangle", f: 659.3, dur: 0.09, g: 0.05 }); },
    close() { tone({ type: "triangle", f: 493.9, dur: 0.09, g: 0.045 }); },
    theme() { seq([261.6, 392, 523.3], (f, i) => tone({ type: "triangle", f, dur: 0.2, g: 0.07, delay: i * 0.07 })); },
  },
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
  elementarism: {
    hover() { tone({ f: 2000, f2: 2600, dur: 0.03, g: 0.018 }); },
    select() { tone({ f: 500, f2: 1500, dur: 0.12, g: 0.07 }); },
    deselect() { tone({ f: 1500, f2: 500, dur: 0.12, g: 0.06 }); },
    blocked() { tone({ f: 300, f2: 180, dur: 0.15, g: 0.07 }); tone({ f: 292, f2: 172, dur: 0.15, g: 0.06 }); },
    roll(m, dur) { tone({ type: "sawtooth", f: 200, f2: 600, dur: Math.min(0.4, dur * 0.7), g: 0.03, filter: { f: 400, to: 2400, q: 4 } }); },
    land(m) { tone({ f: 900, f2: 120 - m * 30, dur: 0.09, g: 0.12 }); },
    capture() { tone({ f: 1800, f2: 200, dur: 0.25, g: 0.07 }); tone({ f: 200, f2: 1800, dur: 0.25, g: 0.05 }); },
    turn() { tone({ f: 700, f2: 1100, dur: 0.07, g: 0.05 }); },
    win() { seq([400, 500, 600, 800], (f, i) => tone({ f, f2: f * 3, dur: 0.1, g: 0.06, delay: i * 0.1 })); tone({ f: 600, f2: 2400, dur: 0.5, g: 0.06, delay: 0.42 }); },
    open() { tone({ f: 900, f2: 1400, dur: 0.05, g: 0.04 }); },
    close() { tone({ f: 1400, f2: 900, dur: 0.05, g: 0.035 }); },
    theme() { tone({ f: 300, f2: 1800, dur: 0.22, g: 0.06 }); },
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
    const pop = (f, g = 0.16, delay = 0) => tone({ f, f2: f * 0.3, dur: 0.035, a: 0.002, g, delay, det: 0.05 });
    return {
      hover() { pop(1600, 0.035); },
      select() { pop(900); },
      deselect() { pop(600, 0.12); },
      blocked() { tone({ type: "square", f: 150, dur: 0.08, g: 0.06, filter: { f: 800 } }); pop(300, 0.1, 0.02); },
      roll() { pop(500, 0.08); pop(700, 0.07, 0.06); },
      land() { pop(250, 0.2); tone({ f: 90, dur: 0.06, g: 0.1 }); },
      capture() { seq([1200, 900, 600], (f, i) => pop(f, 0.14, i * 0.05)); noise({ dur: 0.06, g: 0.06, delay: 0.15, filter: { type: "highpass", f: 2500 } }); },
      turn() { pop(1100, 0.1); },
      win() { seq([600, 800, 1000, 1200, 1600], (f, i) => pop(f, 0.14, i * 0.06)); tone({ f: 1600, dur: 0.3, g: 0.05, delay: 0.32 }); },
      open() { pop(1300, 0.08); },
      close() { pop(800, 0.07); },
      theme() { seq([700, 1100, 1500], (f, i) => pop(f, 0.12, i * 0.06)); },
    };
  })(),
  minimalMono: {
    hover() {},
    select() { tone({ f: 62, dur: 0.12, a: 0.008, g: 0.2, det: 0 }); },
    deselect() { tone({ f: 55, dur: 0.1, a: 0.008, g: 0.13, det: 0 }); },
    blocked() { seq([0, 0.1], (d) => tone({ f: 48, dur: 0.08, a: 0.006, g: 0.14, delay: d, det: 0 })); },
    roll() {},
    land() { noise({ dur: 0.05, g: 0.1, filter: { type: "lowpass", f: 180 } }); },
    capture() { tone({ f: 41, dur: 0.3, a: 0.01, g: 0.26, det: 0 }); },
    turn() { tone({ f: 70, dur: 0.06, a: 0.008, g: 0.07, det: 0 }); },
    win() { tone({ f: 55, dur: 0.6, a: 0.02, g: 0.18, det: 0 }); tone({ f: 82.4, dur: 0.6, a: 0.02, g: 0.14, delay: 0.25, det: 0 }); },
    open() {},
    close() {},
    theme() { tone({ f: 58, dur: 0.2, a: 0.01, g: 0.16, det: 0 }); },
  },
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
  return {
    ensureStarted() { startLabAudio(); },
    beginGameFadeIn() {}, setZoom() {}, setTension() {}, beginFadeOut() {}, resetWindDown() {},
    setMuted(m) { setLabMuted(m); },
    playSelect: guard(() => play("select")),
    playDeselect: guard(() => play("deselect")),
    playBlocked: guard(() => play("blocked")),
    playRollStart: guard((vol, durMs) => play("roll", massOf(vol), (durMs || 400) / 1000)),
    playLanding: guard((vol) => play("land", massOf(vol))),
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
}
