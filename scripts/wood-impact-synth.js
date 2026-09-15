/*
 * wood-impact-synth.js
 * ---------------------------------------------------------------------
 * Second synthesis attempt for Standard El Cabeza's wood-impact audio
 * (see this file's own git history for the first: additive sine-mode
 * synthesis, reverted for reading "wildly off the mark"). This attempt
 * uses a structurally different technique per explicit spec: an
 * EXCITER (a short noise/transient burst standing in for the physical
 * impact force) driven through a bank of PARALLEL RESONANT BANDPASS
 * FILTERS (one per acoustic mode, piece and board alike). A bandpass
 * biquad excited by a brief impulse rings and decays on its own, at a
 * rate set entirely by its own Q — this is genuine modal synthesis via
 * filtering, not manually-enveloped oscillators, and is far closer to
 * how a real struck object's resonances actually behave: driven by a
 * broadband event, not by picking one clean tone per partial up front.
 * That's very likely why the first attempt read as synthetic — pure
 * summed sine tones read as "a chord," not "a knock."
 *
 * PARAMETER MODEL
 * ---------------------------------------------------------------------
 * Every impact is driven by three inputs, all normalized 0-1 (mass is
 * clamped to [0.1, 1.0] since a literal 0 mass has no physical meaning
 * here):
 *   mass         - m in [0.1, 1.0]. Heavier pieces: lower-pitched modes
 *                  (within each mode's own stated frequency band — see
 *                  MODE_BANDS below), and — specifically for the BOARD's
 *                  own modes, not the piece's — quadratically more
 *                  energy (a heavy piece couples harder into the slab
 *                  it lands on than a light one, disproportionately so).
 *   surface_area - contact area in [0, 1]. 0 = a corner/edge strike
 *                  (small contact patch: brighter, louder ring, sharp
 *                  high-mode emphasis, near-instant transient). 1 = a
 *                  flat-face strike (large contact patch: duller, more
 *                  damped, more energy transferred into the board).
 *   velocity     - impact speed in [0, 1]. Drives overall energy, click
 *                  brightness/brevity, the fundamental's pitch-drop
 *                  depth, and how hard the final mix gets soft-clipped.
 *
 * Two GLOBAL environment knobs (not per-impact) round out the model,
 * exactly as spec'd — a physical property of the BOARD/material, not of
 * any one piece or strike:
 *   board_thickness - shifts the board's own resonant modes down and
 *                      lengthens their decay as it increases (a thicker
 *                      slab is both lower-pitched and slower to stop
 *                      ringing).
 *   wood_density    - raises Q (narrower, more sustained resonance) on
 *                      the low-frequency modes and speeds up high-
 *                      frequency damping as it increases (denser
 *                      hardwood: a longer-ringing fundamental body tone
 *                      but a shorter-lived bright "click" than a softer
 *                      wood would produce).
 *
 * Two numbers below have no single canonical formula in acoustics
 * literature (the physical-modeling justification for the RATIOS and
 * BAND EDGES is real — see the per-section comments — but "exactly how
 * loud" and "exactly how much mass shifts pitch" are inherently
 * tuning choices, not derivable constants) — both are called out at
 * their definition:
 *   - freqForMass(): mass moves a mode's frequency somewhere inside its
 *     stated band, inversely (heavier = lower); a linear interpolation
 *     across the band was the simplest monotonic mapping satisfying
 *     "scales inversely with mass" without inventing an unstated
 *     absolute-frequency formula.
 *   - impactEnergy(): kinetic energy scales with v^2, but loudness is
 *     perceived compressively, not linearly with energy; a fractional
 *     exponent (1.4) between the two is the standard choice for "harder
 *     hit reads as clearly louder" without an instant jump to clipping.
 *
 * None of this loads any audio asset — everything is generated from
 * noise, filters, and gain envelopes at call time.
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

// Linear interpolation across [loFreq, hiFreq] keyed INVERSELY by mass:
// heaviest (mass=1) lands on loFreq, lightest (mass=0.1) lands on hiFreq.
// See freqForMass's own header note on why linear-in-mass, not a derived
// physical formula: the spec states the direction and the band, not an
// exact curve.
function freqForMass(loFreq, hiFreq, mass) {
  const t = clamp01((mass - 0.1) / 0.9);
  return lerp(hiFreq, loFreq, t);
}

// ----------------------- mode bands (Hz, Q) ----------------------------
// Piece modes: a compact struck-object resonance set. Mode 1 is the
// audible "pitch" of the knock; Mode 2 is a deliberately inharmonic
// upper partial (real struck-wood partials are NOT integer multiples of
// the fundamental — see the first attempt's own header comment on
// Rayleigh free-free bar ratios, still true here even though the
// synthesis technique changed); Mode 3 is the fast, bright "edge click"
// that dominates a corner/edge strike and all but disappears on a flat
// one.
const PIECE_MODE1_HZ = [800, 1200];
const PIECE_MODE1_Q = [12, 18];
const PIECE_MODE2_HZ = [1800, 2400];
const PIECE_MODE2_Q = [8, 12];
const PIECE_MODE3_HZ = [3500, 4800];
// Q=5 at 3.5-4.8kHz gives T60 = 6.91*Q/(pi*f) =~ 2.4-3.3ms on its own —
// comfortably under the spec's <10ms ceiling with no extra envelope
// needed; the ring-down IS the filter's own impulse response (see
// addResonator's header comment).
const PIECE_MODE3_Q = 5;

// Board modes: the thick play-surface's own body, shared by every
// impact regardless of which piece struck it — this is what makes every
// piece sound like it landed on the SAME large object.
const BOARD_LOW_HZ = [120, 220];
const BOARD_LOW_Q = [6, 10];
const BOARD_BODY_HZ = [350, 450];
const BOARD_BODY_Q = 8;

const DYNAMIC_DAMPING_START_HZ = 9000; // closing lowpass starts here...
const DYNAMIC_DAMPING_END_HZ = 2500; // ...and settles at the spec'd 2.5kHz

// --------------------------- noise buffers -----------------------------
// One shared white-noise buffer per AudioContext (impacts only ever read
// short slices near its start, at varying playback rates/gains — a
// fresh buffer per hit would be wasted allocation for no audible gain).
const noiseBufferCache = new WeakMap();
function getNoiseBuffer(ctx) {
  let buf = noiseBufferCache.get(ctx);
  if (!buf) {
    const len = Math.ceil(ctx.sampleRate * 0.25);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBufferCache.set(ctx, buf);
  }
  return buf;
}

// Soft-clip curve (tanh-based), amount in [0, 1] controlling drive —
// low amount stays within a few percent THD (the spec's <=3% ceiling
// for a typical, non-maximal hit); only a hard, high-velocity strike
// pushes drive high enough to visibly round the waveform.
const saturationCurveCache = new Map();
function getSaturationCurve(amount) {
  const key = Math.round(amount * 100);
  let curve = saturationCurveCache.get(key);
  if (curve) return curve;
  const n = 512;
  curve = new Float32Array(n);
  const drive = 1 + amount * 8; // amount=0 -> ~linear, amount=1 -> audibly compressed
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
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
 * @param {number} [env.board_thickness=0.5] - 0-1, see header comment.
 * @param {number} [env.wood_density=0.5] - 0-1, see header comment.
 */
export function createWoodImpactEngine(ctx, destination, env = {}) {
  let boardThickness = clamp01(env.board_thickness ?? 0.5);
  let woodDensity = clamp01(env.wood_density ?? 0.5);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(destination || ctx.destination);

  function setBoardThickness(v) {
    boardThickness = clamp01(v);
  }
  function setWoodDensity(v) {
    woodDensity = clamp01(v);
  }

  // A biquad resonator excited by a brief impulse rings at `freq`, with
  // a decay rate set by `q` — this IS the modal synthesis: no manual
  // gain envelope is layered on top, the ring-down is the filter's own
  // impulse response. Nothing here needs explicit disposal: once the
  // exciter's own noise BufferSource stops (it schedules its own
  // stop() below), this filter/gain pair just receives silence and is
  // garbage-collected once nothing references it.
  function addResonator(input, sum, { freq, q, gain }) {
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    input.connect(filt).connect(g).connect(sum);
    return filt;
  }

  /**
   * Single impact: a corner strike, a flat landing, one grain of a
   * tumble — anything that's ONE contact event. mass/surface_area/
   * velocity are all 0-1 (mass floors at 0.1 internally, per the
   * physical domain stated in the spec).
   * @param {number} mass
   * @param {number} surface_area
   * @param {number} velocity
   * @param {object} [opts]
   * @param {number} [opts.when] - AudioContext time; defaults to now.
   * @param {number} [opts.gainMul=1] - extra linear gain multiplier
   *   (used by roll_sequence for its own per-grain ±4dB jitter).
   * @param {boolean} [opts.isMicroGrain=false] - shortens the exciter's
   *   own decay to the spec's 3-8ms rolling-grain range instead of the
   *   10-20ms main-impact range.
   */
  function impact_event(mass, surface_area, velocity, opts = {}) {
    const m = clamp(mass, 0.1, 1.0);
    const a = clamp01(surface_area);
    const v = clamp01(velocity);
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const gainMul = opts.gainMul != null ? opts.gainMul : 1;

    // ---- energy / gain -------------------------------------------------
    // Kinetic energy ~ v^2, but perceived loudness is compressive; 1.4
    // is a tuning exponent (see this file's header note), not a derived
    // constant. Board coupling gets the spec's own explicit m^2 term;
    // the piece's own resonance gets a gentler sqrt(m) lift (a heavier
    // piece still hits harder at the same velocity — real KE scales
    // with mass too — just not as steeply as the board's own coupling).
    const velocityEnergy = Math.pow(v, 1.4);
    const pieceMassGain = Math.pow(m, 0.5);
    const boardMassGain = m * m; // G_board ∝ m^2, per spec
    // Flat contact: +3..+6dB (avg +4.5). Point/edge: -4..-6dB (avg -5).
    const contactGainDb = lerp(-5, 4.5, a);
    const contactGain = dbToGain(contactGainDb);

    const overallPeak = clamp(0.34 * velocityEnergy * contactGain, 0, 1);
    const piecePeak = overallPeak * pieceMassGain * gainMul;
    const boardPeak = overallPeak * boardMassGain * gainMul;

    // ---- damping / Q (wood_density, blended lightly with mass) --------
    // Spec text ties "denser -> higher low-freq Q, faster HF damping" to
    // wood generally, then separately names wood_density as the global
    // knob for exactly that. Both per-piece mass and the global density
    // plausibly matter physically, so this blends them (density
    // weighted higher, since it's the knob explicitly named for this)
    // rather than picking one and ignoring the other's own wording.
    const density = clamp01(0.65 * woodDensity + 0.35 * m);
    const qLowMul = lerp(0.85, 1.15, density); // Q=15-20 low end scales with density
    const hfDampingMul = lerp(0.75, 1.35, density); // higher density -> faster HF closure

    // ---- contact-driven frequency/emphasis shift -----------------------
    // Flat (a=1): central resonance down 15-20% (avg 17.5%). Point/edge
    // (a=0): central resonance up 25%.
    const contactFreqMul = 1 + lerp(0.25, -0.175, a);

    const sum = ctx.createGain();
    sum.gain.value = 1;

    // ================= 1. Exciter (impact force) =======================
    // Non-linear impulse: shaped white noise (the broadband "crack" of
    // two wooden surfaces meeting) plus, for lower contact area, a tiny
    // extra sharp spike standing in for the "asymmetric grain" of a
    // corner catching first.
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(ctx);
    const attackS = 0.0008; // <= 1ms exponential-feeling rise
    const decayS = opts.isMicroGrain
      ? lerp(0.008, 0.003, v) // 3-8ms linear, rolling micro-impacts
      : lerp(0.02, 0.01, v); // 10-20ms exponential, main impacts
    const exciterGain = ctx.createGain();
    exciterGain.gain.setValueAtTime(0, t0);
    exciterGain.gain.linearRampToValueAtTime(1, t0 + attackS);
    if (opts.isMicroGrain) {
      exciterGain.gain.linearRampToValueAtTime(0, t0 + attackS + decayS);
    } else {
      exciterGain.gain.exponentialRampToValueAtTime(0.001, t0 + attackS + decayS);
    }
    noiseSrc.connect(exciterGain);
    noiseSrc.start(t0);
    noiseSrc.stop(t0 + attackS + decayS + 0.02);

    // Edge/point contact: emphasize the spike (an ultra-fast, <1ms burst
    // separate from the main noise decay) rather than the broad body.
    // Scaled by piecePeak (not just spikeAmount) — a gentle low-mass,
    // low-velocity tap on a corner should still be QUIET, just with
    // proportionally more of its (small) energy up in the spike rather
    // than the body; spikeAmount alone, unscaled, would make every
    // point-contact hit loud regardless of how soft the actual strike was.
    const spikeAmount = 1 - a;
    if (spikeAmount > 0.05) {
      const spikeSrc = ctx.createBufferSource();
      spikeSrc.buffer = getNoiseBuffer(ctx);
      spikeSrc.playbackRate.value = 2.2; // brighter/shorter than the main burst
      const spikeGain = ctx.createGain();
      const spikePeak = spikeAmount * piecePeak * 1.6;
      spikeGain.gain.setValueAtTime(0, t0);
      spikeGain.gain.linearRampToValueAtTime(spikePeak, t0 + 0.0004);
      spikeGain.gain.exponentialRampToValueAtTime(Math.max(0.00001, spikePeak * 0.001), t0 + 0.0009);
      spikeSrc.connect(spikeGain).connect(sum); // straight to the mix, unfiltered
      spikeSrc.start(t0);
      spikeSrc.stop(t0 + 0.002);
    }

    // ================= 2. Resonator bank ================================
    // Piece Mode 1 (fundamental) — carries the transient pitch-drop:
    // 5-10% (scaled by velocity — a harder hit deforms the surface more)
    // over the first 3ms, modeling elastic relaxation right at contact.
    const mode1Freq = freqForMass(...PIECE_MODE1_HZ, m) * contactFreqMul;
    const mode1Q = lerp(PIECE_MODE1_Q[0], PIECE_MODE1_Q[1], clamp01((m - 0.1) / 0.9)) * qLowMul;
    const mode1 = addResonator(exciterGain, sum, { freq: mode1Freq, q: mode1Q, gain: piecePeak * 0.85 });
    const pitchDropPct = lerp(0.05, 0.1, v);
    mode1.frequency.setValueAtTime(mode1Freq * (1 + pitchDropPct), t0);
    mode1.frequency.exponentialRampToValueAtTime(mode1Freq, t0 + 0.003);

    // Piece Mode 2 (inharmonic overtone) — offset from mode1 by a
    // non-integer ratio (~2.15x, jittered) so the two never read as a
    // single harmonic tone.
    const mode2Freq = freqForMass(...PIECE_MODE2_HZ, m) * contactFreqMul * (2.05 + Math.random() * 0.2);
    const mode2Q = lerp(PIECE_MODE2_Q[0], PIECE_MODE2_Q[1], clamp01((m - 0.1) / 0.9));
    addResonator(exciterGain, sum, { freq: clamp(mode2Freq, PIECE_MODE2_HZ[0] * 0.7, PIECE_MODE2_HZ[1] * 1.6), q: mode2Q, gain: piecePeak * 0.4 });

    // Piece Mode 3 (edge click) — low Q, fast damping regardless of
    // anything else; dominant on point/edge contact, nearly silent flat.
    const mode3Freq = freqForMass(...PIECE_MODE3_HZ, m);
    addResonator(exciterGain, sum, {
      freq: mode3Freq,
      q: PIECE_MODE3_Q,
      gain: piecePeak * (0.25 + spikeAmount * 1.1),
    });

    // Board Low Thud — board_thickness shifts this down (thicker slab,
    // lower body pitch) and the mass^2 board coupling from above.
    const boardLowFreq = freqForMass(...BOARD_LOW_HZ, m) / (1 + boardThickness * 0.5);
    const boardLowQ = lerp(BOARD_LOW_Q[0], BOARD_LOW_Q[1], 0.5) * qLowMul * (1 + boardThickness * 0.3);
    addResonator(exciterGain, sum, {
      freq: boardLowFreq,
      q: boardLowQ,
      gain: boardPeak * (0.5 + 0.5 * a), // flat contact couples into the board harder
    });

    // Board Body Resonance.
    const boardBodyFreq = freqForMass(...BOARD_BODY_HZ, m) / (1 + boardThickness * 0.35);
    addResonator(exciterGain, sum, {
      freq: boardBodyFreq,
      q: BOARD_BODY_Q * qLowMul,
      gain: boardPeak * 0.32 * (0.5 + 0.5 * a),
    });

    // Flat-face impact per spec: an ADDITIONAL steep lowpass (this
    // biquad's own natural 12dB/oct rolloff) above ~3kHz, damping the
    // high edge click a broad face landing shouldn't carry much of.
    let tail = sum;
    if (a > 0.02) {
      const flatLp = ctx.createBiquadFilter();
      flatLp.type = "lowpass";
      flatLp.frequency.value = lerp(20000, 3000, a);
      flatLp.Q.value = 0.707;
      tail.connect(flatLp);
      tail = flatLp;
    }

    // ================= 3. Dynamic damping (closing lowpass) =============
    // A 2nd-order (biquad) lowpass whose OWN cutoff sweeps down over the
    // impact's life, so high-frequency content dies out measurably
    // faster than low-frequency content — "frequency-dependent decay,"
    // not just a static filter — sped up further by wood_density (denser
    // wood damps its own highs faster).
    const dampLp = ctx.createBiquadFilter();
    dampLp.type = "lowpass";
    dampLp.Q.value = 0.707;
    const closeTimeS = 0.25 / hfDampingMul;
    dampLp.frequency.setValueAtTime(DYNAMIC_DAMPING_START_HZ, t0);
    dampLp.frequency.exponentialRampToValueAtTime(DYNAMIC_DAMPING_END_HZ, t0 + closeTimeS);
    tail.connect(dampLp);

    // ================= 4. Saturation (soft clip) =========================
    // Drive scales with velocity only — a gentle tap should stay clean,
    // a hard strike should audibly (but only mildly, <=3% THD at
    // moderate velocity) compress, per spec.
    const shaper = ctx.createWaveShaper();
    shaper.curve = getSaturationCurve(v * 0.5);
    shaper.oversample = "2x";
    dampLp.connect(shaper).connect(master);
  }

  /**
   * A continuous tumble: an irregular (jittered, Poisson-like) train of
   * micro-impacts with decaying velocity and randomized contact
   * geometry per grain, per spec's "Rolling Exciter Logic" — optionally
   * ending in one final, stronger rest impact.
   * @param {number} duration_sec
   * @param {number} mass
   * @param {number} initial_velocity
   * @param {object} [opts]
   * @param {number} [opts.when] - AudioContext time to start at; defaults to now.
   * @param {boolean} [opts.endWithRestImpact=true] - per spec, the
   *   sequence concludes with a final rest impact; a caller that already
   *   has its OWN separately-timed landing cue (see themes/standard.js's
   *   playLanding, fired exactly when the piece visually stops — this
   *   sequence starts when the roll STARTS instead, see playRollStart)
   *   passes false here so the two don't both land a loud final hit
   *   within the same few frames.
   */
  function roll_sequence(duration_sec, mass, initial_velocity, opts = {}) {
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const endWithRestImpact = opts.endWithRestImpact !== false;
    const m = clamp(mass, 0.1, 1.0);
    const v0 = clamp01(initial_velocity);

    // Velocity decays over the tumble — an exponential falloff reads as
    // "losing energy," not a linear ramp to zero (real rolling objects
    // decelerate faster while fast, slower as they near rest).
    const tau = duration_sec * 0.42;
    let t = 0;
    while (t < duration_sec) {
      const vAtT = v0 * Math.exp(-t / tau);
      if (vAtT < 0.04) break; // too quiet to bother scheduling further grains
      const grainContact = 0.1 + Math.random() * 0.8; // 0.1-0.9, per spec
      const grainGainDb = (Math.random() * 2 - 1) * 4; // +/-4dB, per spec
      impact_event(m, grainContact, vAtT, {
        when: t0 + t,
        gainMul: dbToGain(grainGainDb),
        isMicroGrain: true,
      });
      t += 0.015 + Math.random() * 0.03; // 15-45ms jittered interval, per spec
    }

    if (endWithRestImpact) {
      // The final settle: a flatter, more definitive contact than any
      // mid-tumble grain, at a velocity below the initial one (the
      // piece has been losing energy the whole time) but above the
      // trailing grains (a real "clunk" as it finally sits still, not
      // just the last of a fading rattle).
      impact_event(m, 0.85, Math.max(0.3, v0 * 0.55), { when: t0 + duration_sec });
    }
  }

  return {
    impact_event,
    roll_sequence,
    setBoardThickness,
    setWoodDensity,
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
