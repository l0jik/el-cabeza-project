/*
 * wood-impact-synth.js
 * ---------------------------------------------------------------------
 * Fifth synthesis pass for Standard El Cabeza's wood-impact audio (see
 * git history for the previous four). Replaces the granular/absorption-
 * matrix architecture with a much simpler, explicitly-specified recipe:
 * one pitch-dropping sine "body" (150Hz decaying toward 40Hz), a fast
 * exponential amplitude choke (kills sustain/ringing outright rather
 * than gating it after the fact), a short noise "click" transient, and
 * a literal boxcar moving-average filter as the final muffle — ported
 * directly from a reference offline (numpy/scipy) implementation into
 * real-time Web Audio nodes:
 *
 *   - Body: OscillatorNode (sine) whose frequency is driven by
 *     setValueCurveAtTime with a precomputed pitch_env(t) array —
 *     Web Audio integrates an oscillator's own instantaneous frequency
 *     into phase internally, which is exactly what the reference's
 *     manual `phase = cumsum(pitch_env) / sampleRate` does by hand.
 *   - Amplitude: a GainNode whose gain is likewise driven by a
 *     precomputed exp(-rate*t) curve — a real exponential choke, not a
 *     scheduled ramp to a floor, so there is never a residual tail to
 *     clip.
 *   - Click: a short noise buffer with the exp(-1500*t) envelope baked
 *     directly into its samples (noise * envelope, same as the
 *     reference), mixed in at low level for the initial transient.
 *   - Muffle: a ConvolverNode whose impulse response IS the reference's
 *     10-tap boxcar kernel (ones(10)/10) — the literal moving-average
 *     filter, not an approximation of one via a biquad.
 *
 * mass/surface_area/velocity/board_density/wood_dampening all modulate
 * this recipe's own constants (pitch range, decay rates, click amount)
 * rather than changing the architecture itself — the public API
 * (impact_event/roll_sequence, same positional args/opts, same env
 * knobs) is unchanged, so themes/standard.js needs no changes here.
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
// The reference recipe's own numbers — see the module comment above.
const PITCH_START_HZ = 150;
const PITCH_END_HZ = 40;
const PITCH_DECAY_RATE = 50; // pitch_env(t) = (START-END)*exp(-rate*t) + END
const AMP_DECAY_RATE = 120; // amp_env(t) = exp(-rate*t)
const CLICK_DECAY_RATE = 1500;
const CLICK_GAIN = 0.3;
const BASE_DURATION_S = 0.05; // "50 milliseconds is all you need"
const MUFFLE_KERNEL_SIZE = 10; // literal moving-average box width

// A curve is rendered until its envelope decays below this fraction of
// its own peak — the reference's fixed 50ms window already comfortably
// covers the default-ish case; this just keeps very slow (heavy/low-
// dampening) or very fast (micro-grain) variants from either clipping
// short or over-running with dead silence at the end of their buffer.
const ENVELOPE_FLOOR = 0.0008;

// --------------------------- shared buffers -----------------------------
// The moving-average "muffle" filter is the SAME literal kernel for
// every impact (it isn't a function of mass/velocity/etc. in the
// reference), so it's built once per context and reused.
const muffleBufferCache = new WeakMap();
function getMuffleImpulseResponse(ctx) {
  let buf = muffleBufferCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, MUFFLE_KERNEL_SIZE, ctx.sampleRate);
    const data = buf.getChannelData(0);
    data.fill(1 / MUFFLE_KERNEL_SIZE);
    muffleBufferCache.set(ctx, buf);
  }
  return buf;
}

/**
 * @param {AudioContext} ctx
 * @param {AudioNode} [destination] - defaults to ctx.destination; a
 *   caller wiring this into a larger graph (Standard theme's
 *   createAudio(), which needs one shared mute-capable gain node in
 *   front of every sound it makes) passes its own node here instead.
 * @param {object} [env]
 * @param {number} [env.board_density=0.5] - 0-1. Higher pulls the
 *   body's whole pitch range down further (a denser board reads as an
 *   even deader, lower thud).
 * @param {number} [env.wood_dampening=0.5] - 0-1. Higher speeds up the
 *   amplitude choke further — never slows it down; this knob can only
 *   ever remove more ringing, never add any back.
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
   * @param {boolean} [opts.isMicroGrain=false] - runs the same recipe
   *   compressed into a much shorter window, for rolling.
   */
  function impact_event(mass, surface_area, velocity, opts = {}) {
    const m = clamp(mass, 0.1, 1.0);
    const a = clamp01(surface_area);
    const v = clamp01(velocity);
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const gainMul = opts.gainMul != null ? opts.gainMul : 1;
    const isMicro = !!opts.isMicroGrain;
    const massT = clamp01((m - 0.1) / 0.9);

    // ---- energy / gain --------------------------------------------------
    // Same energy/loudness shaping as the previous passes — the
    // reference recipe is silent on how mass/velocity/contact should
    // scale level, so this keeps that continuity rather than making
    // every impact the same volume regardless of how it happened.
    const velocityEnergy = Math.pow(v, 1.4);
    const contactGainDb = lerp(-5, 4, a);
    const overallGain = clamp(0.42 * velocityEnergy * dbToGain(contactGainDb), 0, 1) * gainMul;

    // ---- pitch range: mass + board_density pull it down ------------------
    // Lighter pieces ring a bit higher/brighter, heavier ones lower and
    // duller; a denser board pulls the whole range down further on top
    // of that.
    const densityMul = 1 - boardDensity * 0.3;
    const pitchStart = PITCH_START_HZ * lerp(1.3, 0.65, massT) * densityMul;
    const pitchEnd = PITCH_END_HZ * lerp(1.2, 0.7, massT) * densityMul;
    const pitchDecayRate = PITCH_DECAY_RATE * (isMicro ? 3 : 1);

    // ---- amplitude choke: wood_dampening only ever SPEEDS this up --------
    // dampeningMul >= 1: 1.0 at wood_dampening=0 (the reference's own
    // rate), rising toward 1.6 as dampening rises — never slower than
    // the reference, only ever faster/shorter.
    const dampeningMul = lerp(1.0, 1.6, woodDampening);
    const ampDecayRate = lerp(150, 95, massT) * dampeningMul * (isMicro ? 2.4 : 1);

    // ---- click transient: skipped outright for a flat/full-face hit ------
    // (per the same "flat contact carries no meaningful high end"
    // reasoning as the previous passes), otherwise scaled by contact
    // sharpness and how hard the hit landed.
    const clickAmount = a > 0.85 ? 0 : lerp(1.4, 0.3, a) * lerp(0.5, 1.3, v) * (isMicro ? 0.55 : 1);
    const clickDecayRate = CLICK_DECAY_RATE * (isMicro ? 1.4 : 1);

    // ---- total render duration: long enough for BOTH envelopes to -------
    // decay to silence, short by design otherwise (the reference's own
    // 50ms floor, or less for a micro-grain).
    const ampTailS = -Math.log(ENVELOPE_FLOOR) / ampDecayRate;
    const clickTailS = clickAmount > 0 ? -Math.log(ENVELOPE_FLOOR) / clickDecayRate : 0;
    const floorS = isMicro ? 0.012 : BASE_DURATION_S;
    const durationS = Math.min(0.12, Math.max(floorS, ampTailS, clickTailS));

    const sampleRate = ctx.sampleRate;
    const n = Math.max(8, Math.ceil(sampleRate * durationS));

    // ================= 1. Body: pitch-dropping sine, exponentially choked =
    const pitchCurve = new Float32Array(n);
    const ampCurve = new Float32Array(n + 1); // GainNode curves need >=2 points; padded below anyway
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      pitchCurve[i] = (pitchStart - pitchEnd) * Math.exp(-pitchDecayRate * t) + pitchEnd;
      ampCurve[i] = Math.exp(-ampDecayRate * t);
    }
    ampCurve[n] = ampCurve[n - 1];

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueCurveAtTime(pitchCurve, t0, durationS);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueCurveAtTime(ampCurve, t0, durationS);

    const bodyLevel = ctx.createGain();
    bodyLevel.gain.value = overallGain;

    osc.connect(bodyGain).connect(bodyLevel);
    osc.start(t0);
    osc.stop(t0 + durationS + 0.005);

    const sum = ctx.createGain();
    sum.gain.value = 1;
    bodyLevel.connect(sum);

    // ================= 2. Click: noise * exp(-1500t), envelope baked in ===
    if (clickAmount > 0.01) {
      const clickLenS = Math.min(durationS, Math.max(0.002, clickTailS));
      const clickLen = Math.max(4, Math.ceil(sampleRate * clickLenS));
      const clickBuf = ctx.createBuffer(1, clickLen, sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickLen; i++) {
        const t = i / sampleRate;
        clickData[i] = (Math.random() * 2 - 1) * Math.exp(-clickDecayRate * t) * CLICK_GAIN;
      }
      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = clickBuf;
      const clickLevel = ctx.createGain();
      clickLevel.gain.value = overallGain * clickAmount;
      clickSrc.connect(clickLevel).connect(sum);
      clickSrc.start(t0);
      clickSrc.stop(t0 + clickLenS + 0.002);
    }

    // ================= 3. Muffle: literal 10-tap moving-average filter ====
    const muffle = ctx.createConvolver();
    muffle.normalize = false; // keep the exact ones(10)/10 weights, no auto-renormalizing
    muffle.buffer = getMuffleImpulseResponse(ctx);
    sum.connect(muffle).connect(master);
  }

  /**
   * A continuous tumble: an irregular (Poisson-like) train of micro-
   * impulses with decaying velocity and randomized contact geometry
   * per grain, optionally ending in one final, stronger rest impact.
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
      t += 0.025 + Math.random() * 0.03; // 25-55ms jittered interval
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
