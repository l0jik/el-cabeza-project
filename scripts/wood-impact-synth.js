/*
 * wood-impact-synth.js
 * ---------------------------------------------------------------------
 * Fourth synthesis pass for Standard El Cabeza's wood-impact audio (see
 * git history for the first three). The first three all shared one
 * architecture — an exciter driven through a bank of PARALLEL RESONANT
 * BANDPASS FILTERS, one per acoustic "mode" — and each pass tuned that
 * architecture's own numbers down (lower Q, lower frequencies, harder
 * gating) trying to kill a persistent metallic "boing"/vibrato. It
 * never fully went away, because the architecture itself was the
 * problem, not any one parameter inside it: a resonant bandpass filter
 * excited by an impulse is, by construction, a decaying SINE WAVE at
 * its own center frequency — that's what a 2nd-order resonant filter's
 * impulse response IS, for any Q above the filter's own critically-
 * damped point. Lowering Q shortens and widens that sine's envelope,
 * lowering its frequency moves the pitch, gating its output clips the
 * tail short — but for however long it's audible, it's still a
 * sinusoid, which is exactly what a pitched, "ringing" percept is
 * built from. No amount of retuning a bandpass-filter bank removes
 * that; only NOT USING bandpass resonators for the body does.
 *
 * This pass drops modal (resonant-filter) synthesis entirely. There is
 * no bandpass filter anywhere in this file. Instead:
 *
 *   - The exciter is BROWN (red) noise — a leaky-integrated white
 *     noise source that already falls off at -6dB/octave before any
 *     filtering happens, per spec — plus, for a corner/edge strike
 *     only, a short asymmetric Hanning-windowed pulse layered in for
 *     the initial "tap." Real white/pink noise (the previous two
 *     passes' own exciters) still carries meaningfully more high-
 *     frequency energy than brown noise does at the source.
 *   - That's split into exactly two parallel paths, gated by two
 *     INDEPENDENT, FIXED-LENGTH amplitude envelopes rather than
 *     letting anything ring on its own terms:
 *       - a HIGH path (>~800Hz, via a plain highpass — not a
 *         resonant bandpass) carrying only the initial transient
 *         "clack," hard-gated to <=2ms and skipped outright for a
 *         flat/full-face strike (per spec, flat contact bypasses the
 *         transient burst entirely);
 *       - a LOW path carrying the "thunk" body, run through a
 *         DYNAMIC (envelope-following) 4th-order Butterworth LOWPASS
 *         whose own cutoff sweeps down over the first few
 *         milliseconds (not a fixed corner, and not a resonant peak —
 *         Q stays at the Butterworth-flat 0.541/1.307 pole pair, same
 *         as the previous pass's own master filter, just doing all
 *         the work here instead of being a second stage after a
 *         resonator bank), gated to 12-18ms.
 *   - A low shelf (+6dB, 80-160Hz) gives the low path its felt body
 *     weight; a broad notch (-4dB, 400-900Hz) removes the "hollow
 *     can" quality a flat, unshaped low-mid otherwise carries.
 *   - The sum passes through an asymmetric hard-knee saturator —
 *     tight tanh compression with a high threshold — which flattens
 *     any remaining transient peak into a denser "pop" rather than
 *     letting it ring, per spec.
 *
 * None of the surrounding physical parameter model changed: mass,
 * surface_area, and velocity still drive the same kind of energy/
 * frequency relationships as the earlier passes (heavier = lower and
 * deader; flatter contact = duller and heavier; harder velocity = more
 * energy and more saturation) — only the SIGNAL CHAIN that realizes
 * them changed. The public API (impact_event/roll_sequence, same
 * positional args/opts, same board_density/wood_dampening env knobs)
 * is unchanged from the previous pass — themes/standard.js needs no
 * changes here.
 */

// --------------------------- small helpers ----------------------------
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v) {
  return clamp(v, 0, 1);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function dbToGain(db) {
  return Math.pow(10, db / 20);
}

// ------------------------- tunable constants ---------------------------
// Sub-bass body: energy concentrated here, non-pitched (a shelf, not a
// resonant peak — no Q sharp enough to ring).
const BODY_SHELF_HZ = 120; // within the 80-160Hz band
const BODY_SHELF_DB = 6;
const BODY_SHELF_Q = 0.6; // 0.5-0.7, per spec — broad and flat

// "Hollow can"/boing removal: a broad, shallow notch, not a resonator.
const HOLLOW_NOTCH_HZ = 650; // within the 400-900Hz band
const HOLLOW_NOTCH_DB = -4;
const HOLLOW_NOTCH_Q = 0.9;

// The dynamic low-pass "absorption" sweep — this is what stands in for
// the previous passes' whole resonator bank. Light/soft contact starts
// higher and settles higher; heavy mass and flat contact both pull it
// down further (see impact_event below for exactly how they combine).
const SWEEP_START_HZ_DEFAULT = 1200;
const SWEEP_END_HZ_DEFAULT = 250;
const SWEEP_TIME_S_DEFAULT = 0.003;
const SWEEP_START_HZ_HEAVY = 600;
const SWEEP_END_HZ_HEAVY = 120;
const SWEEP_TIME_S_HEAVY = 0.004;
const FLAT_CONTACT_MAX_HZ = 400; // flat-face clamp, per spec
const ROLL_MAX_HZ = 800; // rolling clamp, per spec

// Textbook 2nd-order-section Q pair for a 4-pole Butterworth lowpass —
// see this constant's identical use (and derivation) in the previous
// pass; still the correct way to build a real 4th-order Butterworth
// (24dB/octave, maximally flat, no resonant bump) from two cascaded
// biquads sharing one swept cutoff.
const BUTTERWORTH_4TH_Q = [0.5412, 1.3066];

const HIGH_SPLIT_HZ = 800; // path split point, per spec
const HIGH_GATE_MS_DEFAULT = 2; // Stage 1: transients >800Hz, <=2ms
const LOW_GATE_MS_MIN = 12; // Stage 2: low body <200Hz, 12-18ms
const LOW_GATE_MS_MAX = 18;

// --------------------------- noise buffers -----------------------------
// Brown (red) noise: a leaky integrator over white noise, which is the
// standard way to generate it — each sample is mostly the previous
// sample plus a small white increment, so energy falls off at a
// genuine -6dB/octave (twice pink noise's -3dB/octave) rather than
// being a filtered approximation of that slope. Normalized to the
// buffer's own peak afterward so playback level stays consistent
// regardless of the leak/increment constants below.
const noiseBufferCache = new WeakMap();
function getBrownNoiseBuffer(ctx) {
  let buf = noiseBufferCache.get(ctx);
  if (!buf) {
    const len = Math.ceil(ctx.sampleRate * 0.25);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    let peak = 1e-6;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.985 + white * 0.06; // leak toward 0 + small white increment
      data[i] = brown;
      if (Math.abs(brown) > peak) peak = Math.abs(brown);
    }
    const norm = 0.9 / peak;
    for (let i = 0; i < len; i++) data[i] *= norm;
    noiseBufferCache.set(ctx, buf);
  }
  return buf;
}

// A single-cycle ASYMMETRIC Hanning-windowed pulse for the corner/edge
// "tap" — a Hanning window (0.5*(1-cos(2*pi*t))) is the standard smooth,
// side-lobe-free windowing shape; made asymmetric per spec by using a
// short rising quarter-window and a longer falling three-quarter
// window, rather than a symmetric full window, so it reads as a single
// percussive tap (fast up, slower settle) instead of a symmetric blip.
const impulseBufferCache = new WeakMap();
function getHanningPulseBuffer(ctx) {
  let buf = impulseBufferCache.get(ctx);
  if (!buf) {
    const len = Math.max(8, Math.round(ctx.sampleRate * 0.0009));
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const riseLen = Math.max(1, Math.round(len * 0.25));
    const fallLen = len - riseLen;
    for (let i = 0; i < len; i++) {
      if (i < riseLen) {
        // Rising quarter of a Hanning window: 0 -> 1.
        data[i] = 0.5 * (1 - Math.cos(Math.PI * (i / riseLen)));
      } else {
        // Falling three-quarter of a Hanning window: 1 -> 0.
        const t = (i - riseLen) / fallLen;
        data[i] = 0.5 * (1 + Math.cos(Math.PI * t));
      }
    }
    impulseBufferCache.set(ctx, buf);
  }
  return buf;
}

// Asymmetric hard-knee saturation curve: a tight tanh compression with
// a HIGH threshold (drive), so only genuine peaks get flattened into a
// denser "pop" — most of the waveform stays through this close to
// linear, per spec's "flattens peak transients... rather than letting
// resonant peaks ring out" (there's nothing left to ring by this stage
// anyway; this is the last line of defense against any transient spike
// escaping the envelopes above it). Deliberately asymmetric (a small
// DC-offset bias before the tanh) — real mechanical impacts compress
// harder in one direction (the initial compressive strike) than the
// other (the material's own rebound), which a symmetric curve can't
// express.
const saturationCurveCache = new Map();
function getSaturationCurve(amount) {
  const key = Math.round(amount * 100);
  let curve = saturationCurveCache.get(key);
  if (curve) return curve;
  // Odd length so index (n-1)/2 lands on EXACTLY x=0 — with an even
  // length no table sample sits at true silence, so once the signal
  // above has genuinely decayed to 0 it would still interpolate between
  // two off-zero samples and hold a tiny nonzero DC output forever.
  const n = 1025;
  curve = new Float32Array(n);
  const drive = 3 + amount * 9; // high threshold — mostly transparent until a real peak hits it
  const asymBias = 0.06;
  // Bias the tanh input for the asymmetric compression character, but
  // re-zero and separately renormalize each side around x=0 afterward —
  // an uncorrected bias here would make silence (x=0) map to a nonzero
  // constant, i.e. inject a DC offset that never decays no matter how
  // hard the envelopes above already gated the signal to zero.
  const zeroVal = Math.tanh(asymBias * drive);
  const posSpan = Math.tanh((1 + asymBias) * drive) - zeroVal;
  const negSpan = zeroVal - Math.tanh((-1 + asymBias) * drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const raw = Math.tanh((x + asymBias) * drive) - zeroVal;
    curve[i] = raw >= 0 ? raw / posSpan : raw / negSpan;
  }
  saturationCurveCache.set(key, curve);
  return curve;
}

/**
 * @param {AudioContext} ctx
 * @param {AudioNode} [destination] - defaults to ctx.destination; a
 *   caller wiring this into a larger graph (Standard theme's
 *   createAudio(), which needs one shared mute-capable gain node in
 *   front of every sound it makes) passes its own node here instead.
 * @param {object} [env]
 * @param {number} [env.board_density=0.5] - 0-1. Higher pulls the low
 *   path's absorption sweep endpoints further down (a denser board
 *   reads as an even deader, lower thud).
 * @param {number} [env.wood_dampening=0.5] - 0-1. Higher shortens both
 *   gate windows further below their own already-short defaults —
 *   never lengthens them; this knob can only ever remove more
 *   ringing, never add any back.
 */
export function createWoodImpactEngine(ctx, destination, env = {}) {
  let boardDensity = clamp01(env.board_density ?? 0.5);
  let woodDampening = clamp01(env.wood_dampening ?? 0.5);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(destination || ctx.destination);

  function setBoardDensity(v) {
    boardDensity = clamp01(v);
  }
  function setWoodDampening(v) {
    woodDampening = clamp01(v);
  }

  /**
   * Single impact: a corner strike, a flat landing, one grain of a
   * tumble — anything that's ONE contact event. mass/surface_area/
   * velocity are all 0-1 (mass floors at 0.1 internally).
   * @param {number} mass
   * @param {number} surface_area
   * @param {number} velocity
   * @param {object} [opts]
   * @param {number} [opts.when] - AudioContext time; defaults to now.
   * @param {number} [opts.gainMul=1] - extra linear gain multiplier
   *   (used by roll_sequence for its own per-grain +/-4dB jitter).
   * @param {boolean} [opts.isMicroGrain=false] - shortens both gate
   *   windows and clamps the sweep to ROLL_MAX_HZ, per the rolling
   *   spec (1-3ms grains, cutoffs kept below 800Hz).
   */
  function impact_event(mass, surface_area, velocity, opts = {}) {
    const m = clamp(mass, 0.1, 1.0);
    const a = clamp01(surface_area);
    const v = clamp01(velocity);
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const gainMul = opts.gainMul != null ? opts.gainMul : 1;

    // ---- energy / gain -------------------------------------------------
    // Kinetic energy ~ v^2, perceived loudness is compressive — 1.4 is a
    // tuning exponent, not a derived constant (unchanged reasoning from
    // earlier passes). Board coupling keeps the m^1.8 relationship;
    // flat contact still couples harder into the board than a point one.
    const velocityEnergy = Math.pow(v, 1.4);
    const pieceMassGain = Math.pow(m, 0.5);
    const boardMassGain = Math.pow(m, 1.8);
    const contactGainDb = lerp(-5, 4, a); // flat: +4dB avg, edge: -5dB avg
    const contactGain = dbToGain(contactGainDb);
    const overallPeak = clamp(0.36 * velocityEnergy * contactGain, 0, 1);
    const bodyPeak = overallPeak * lerp(pieceMassGain, boardMassGain, 0.5) * gainMul;

    // ---- dampening: wood_dampening only ever SHORTENS the gates --------
    // dampeningShrink in (0, 1]: 1.0 at wood_dampening=0 (gates run their
    // full default length), shrinking toward ~0.55 as dampening rises —
    // one-directional, same principle as the previous pass's own
    // applyDampening: this knob can pull decay shorter, never longer.
    const dampeningShrink = lerp(1.0, 0.55, clamp01(0.6 * woodDampening + 0.4 * m));

    const highGateS = (opts.isMicroGrain ? 0.0015 : HIGH_GATE_MS_DEFAULT / 1000) * dampeningShrink;
    const lowGateMsBase = opts.isMicroGrain ? LOW_GATE_MS_MIN : lerp(LOW_GATE_MS_MIN, LOW_GATE_MS_MAX, v);
    const lowGateS = (lowGateMsBase / 1000) * dampeningShrink;

    // ---- dynamic absorption sweep endpoints -----------------------------
    // Heavy mass pushes the sweep down toward SWEEP_*_HZ_HEAVY (per
    // spec); board_density pulls both endpoints down further on top of
    // that. Flat contact clamps the whole sweep at FLAT_CONTACT_MAX_HZ
    // and skips the high path outright (see below) rather than merely
    // biasing the sweep like mass does — a full-face strike genuinely
    // has no meaningful high-frequency content to carry, not just less.
    const massT = clamp01((m - 0.1) / 0.9);
    let sweepStart = lerp(SWEEP_START_HZ_DEFAULT, SWEEP_START_HZ_HEAVY, massT);
    let sweepEnd = lerp(SWEEP_END_HZ_DEFAULT, SWEEP_END_HZ_HEAVY, massT);
    let sweepTimeS = lerp(SWEEP_TIME_S_DEFAULT, SWEEP_TIME_S_HEAVY, massT);
    const densityMul = 1 - boardDensity * 0.35;
    sweepStart *= densityMul;
    sweepEnd *= densityMul;
    if (a > 0.7) {
      // Flat/full-face: clamp hard at FLAT_CONTACT_MAX_HZ regardless of
      // what mass alone would have allowed.
      sweepStart = Math.min(sweepStart, FLAT_CONTACT_MAX_HZ);
      sweepEnd = Math.min(sweepEnd, FLAT_CONTACT_MAX_HZ * 0.6);
    }
    if (opts.isMicroGrain) {
      sweepStart = Math.min(sweepStart, ROLL_MAX_HZ);
      sweepEnd = Math.min(sweepEnd, ROLL_MAX_HZ * 0.4);
    }

    const sum = ctx.createGain();
    sum.gain.value = 1;

    // ================= 1. Exciter (brown noise + optional tap) ==========
    // Attack 0.05-0.2ms (harder hits snap faster), per spec.
    const attackS = lerp(0.0002, 0.00005, v);
    const burstLenS = opts.isMicroGrain
      ? lerp(0.003, 0.001, v) // 1-3ms rolling micro-impulses, per spec
      : lerp(0.02, 0.012, v); // generous enough to feed both gate stages below

    const exciterGain = ctx.createGain();
    exciterGain.gain.setValueAtTime(0, t0);
    exciterGain.gain.linearRampToValueAtTime(1, t0 + attackS);
    exciterGain.gain.setValueAtTime(1, t0 + attackS + burstLenS);
    exciterGain.gain.linearRampToValueAtTime(0, t0 + attackS + burstLenS + 0.001);

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getBrownNoiseBuffer(ctx);
    noiseSrc.connect(exciterGain);
    noiseSrc.start(t0);
    noiseSrc.stop(t0 + attackS + burstLenS + 0.01);

    // Corner/edge tap: skipped outright for a mostly-flat strike, per
    // spec ("bypasses the transient high-frequency burst entirely").
    const tapAmount = a < 0.7 ? 1 - a : 0;
    let tapSrc = null;
    if (tapAmount > 0.05) {
      tapSrc = ctx.createBufferSource();
      tapSrc.buffer = getHanningPulseBuffer(ctx);
      tapSrc.playbackRate.value = 1.0 + (1 - a) * 0.4;
      const tapGain = ctx.createGain();
      tapGain.gain.value = tapAmount;
      tapSrc.connect(tapGain).connect(sum);
      tapSrc.start(t0);
      tapSrc.stop(t0 + 0.0015);
    }

    // ================= 2. Two-band envelope-followed absorption =========
    // HIGH path: transient "clack," >HIGH_SPLIT_HZ, hard-gated to
    // <=2ms. A plain (non-resonant) highpass — no Q sharp enough here
    // to ring — so this carries texture/edge, never pitch. Skipped
    // entirely (bodyPeak's high contribution zeroed via tapAmount/
    // contact logic below) on a flat strike.
    if (tapAmount > 0.02) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.Q.value = 0.707;
      hp.frequency.value = HIGH_SPLIT_HZ;
      const highGate = ctx.createGain();
      const highPeak = bodyPeak * (0.5 + tapAmount * 0.9);
      highGate.gain.setValueAtTime(highPeak, t0);
      highGate.gain.setValueAtTime(highPeak, t0 + attackS);
      highGate.gain.exponentialRampToValueAtTime(Math.max(0.00001, highPeak * 0.001), t0 + attackS + highGateS);
      exciterGain.connect(hp).connect(highGate).connect(sum);
    }

    // LOW path: the "thunk" body. Dynamic (envelope-following) 4th-
    // order Butterworth lowpass — cascaded 2nd-order sections at the
    // exact 4-pole Q pair, cutoff swept from sweepStart down to
    // sweepEnd over sweepTimeS — carries everything below that moving
    // cutoff, gated to lowGateS. This single dynamic sweep is what
    // replaces the previous passes' whole resonator bank: there is no
    // fixed-frequency peak anywhere in this path for a listener's ear
    // to lock onto as "a pitch," only a moving, always-lowpass boundary.
    let lowTail = exciterGain;
    for (const q of BUTTERWORTH_4TH_Q) {
      const stage = ctx.createBiquadFilter();
      stage.type = "lowpass";
      stage.Q.value = q;
      stage.frequency.setValueAtTime(sweepStart, t0);
      stage.frequency.exponentialRampToValueAtTime(Math.max(20, sweepEnd), t0 + sweepTimeS);
      lowTail.connect(stage);
      lowTail = stage;
    }

    // Sub-bass body shelf (+6dB, 80-160Hz, broad/flat Q) — the felt
    // "weight" of the thunk, per spec. A shelf, not a peak: it has no
    // resonant behavior of its own to ring.
    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = BODY_SHELF_HZ;
    shelf.Q.value = BODY_SHELF_Q;
    shelf.gain.value = BODY_SHELF_DB;
    lowTail.connect(shelf);
    lowTail = shelf;

    // "Hollow can"/boing removal — a broad, shallow notch, not a
    // resonator (negative gain on a peaking filter widens rather than
    // narrows the audible dip, the opposite character of a resonant
    // boost).
    const notch = ctx.createBiquadFilter();
    notch.type = "peaking";
    notch.frequency.value = HOLLOW_NOTCH_HZ;
    notch.Q.value = HOLLOW_NOTCH_Q;
    notch.gain.value = HOLLOW_NOTCH_DB;
    lowTail.connect(notch);
    lowTail = notch;

    const lowGate = ctx.createGain();
    const lowPeak = bodyPeak * (a > 0.7 ? 1.15 : 0.85); // flat contact carries more of its energy here
    lowGate.gain.setValueAtTime(lowPeak, t0);
    lowGate.gain.setValueAtTime(lowPeak, t0 + attackS);
    lowGate.gain.exponentialRampToValueAtTime(Math.max(0.00001, lowPeak * 0.001), t0 + attackS + lowGateS);
    lowTail.connect(lowGate).connect(sum);

    // ================= 3. Asymmetric hard-knee saturation ================
    const shaper = ctx.createWaveShaper();
    shaper.curve = getSaturationCurve(v * 0.6);
    shaper.oversample = "2x";
    sum.connect(shaper).connect(master);
  }

  /**
   * A continuous tumble: an irregular (Poisson-like) train of brown-
   * noise micro-impulses with decaying velocity and randomized contact
   * geometry per grain, optionally ending in one final, stronger rest
   * impact.
   * @param {number} duration_sec
   * @param {number} mass
   * @param {number} initial_velocity
   * @param {object} [opts]
   * @param {number} [opts.when] - AudioContext time to start at; defaults to now.
   * @param {boolean} [opts.endWithRestImpact=true] - a caller that
   *   already has its own separately-timed landing cue passes false
   *   here so the two don't both land a loud final hit within the same
   *   few frames.
   */
  function roll_sequence(duration_sec, mass, initial_velocity, opts = {}) {
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const endWithRestImpact = opts.endWithRestImpact !== false;
    const m = clamp(mass, 0.1, 1.0);
    const v0 = clamp01(initial_velocity);

    // Velocity decays exponentially over the tumble — "losing energy,"
    // not a linear ramp to zero.
    const tau = duration_sec * 0.42;
    let t = 0;
    while (t < duration_sec) {
      const vAtT = v0 * Math.exp(-t / tau);
      if (vAtT < 0.04) break; // too quiet to bother scheduling further grains
      const grainContact = 0.1 + Math.random() * 0.6; // 0.1-0.7
      const grainGainDb = (Math.random() * 2 - 1) * 4; // +/-4dB
      impact_event(m, grainContact, vAtT, {
        when: t0 + t,
        gainMul: dbToGain(grainGainDb),
        isMicroGrain: true,
      });
      t += 0.025 + Math.random() * 0.03; // 25-55ms jittered interval, per spec
    }

    if (endWithRestImpact) {
      // The final settle: a flatter, more definitive contact than any
      // mid-tumble grain, at a velocity below the initial one but above
      // the trailing grains — a real "clunk" as it finally sits still.
      impact_event(m, 0.85, Math.max(0.3, v0 * 0.55), { when: t0 + duration_sec });
    }
  }

  return {
    impact_event,
    roll_sequence,
    setBoardDensity,
    setWoodDampening,
    dispose() {
      master.disconnect();
    },
  };
}

/*
 * ---------------------------------------------------------------------
 * Minimal manual smoke test (uncomment and run in a browser console /
 * a page with a user-gesture-unlocked AudioContext) — not part of the
 * exported API:
 *
 *   const ctx = new (window.AudioContext || window.webkitAudioContext)();
 *   const wood = createWoodImpactEngine(ctx);
 *   // A light piece, glancing corner tap:
 *   wood.impact_event(0.2, 0.15, 0.4);
 *   // A heavy piece tumbling for 500ms then settling:
 *   setTimeout(() => wood.roll_sequence(0.5, 0.9, 0.8), 600);
 */
