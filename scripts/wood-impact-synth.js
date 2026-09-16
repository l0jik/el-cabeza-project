/*
 * wood-impact-synth.js
 * ---------------------------------------------------------------------
 * Third synthesis pass for Standard El Cabeza's wood-impact audio (see
 * git history for the first two: additive sine-mode synthesis, reverted
 * as "wildly off the mark"; then a parallel-bandpass modal-resonator
 * bank that fixed the tone problem but introduced a NEW one — the
 * piece modes used Q=12-18 at 800-4800Hz, which is a narrow-bandpass
 * filter ringing on a broadband impulse, i.e. a sine oscillator with
 * extra steps. That reads as a metallic "boing"/vibrato, not a wooden
 * knock, no matter how the envelope around it is shaped: the ringing
 * IS the filter's own impulse response at high Q, not something an
 * amplitude envelope layered on top can hide.
 *
 * This pass keeps the exact same architecture (exciter -> parallel
 * resonator bank -> contact-driven lowpass -> master damping lowpass
 * -> saturation) and the exact same public API (impact_event/
 * roll_sequence, same positional args, same opts), but rebuilds the
 * resonator bank's own numbers around ONE rule: wood is a heavily
 * damped material, so nothing in this file is allowed to ring long
 * enough, or narrowly enough, to sound pitched.
 *
 *   - Every mode's Q is now <=4.0 (<=2.0 for anything touched by a
 *     rolling micro-grain — see MICRO_GRAIN_Q_CAP). A resonant biquad's
 *     own T60 is 6.91*Q/(pi*f); at these Q values every mode's natural
 *     ring-down is already inside (usually well inside) the spec's own
 *     stated decay ceilings without needing a separate envelope on top
 *     — same "the filter's ring-down IS the envelope" principle the
 *     previous pass used, just tuned so that ring-down is short and
 *     wide instead of long and narrow.
 *   - Every piece mode's frequency band dropped roughly an octave
 *     (was 800-4800Hz, now 220-2200Hz across the three piece modes),
 *     per explicit correction — the old fundamentals were simply
 *     pitched too high to read as a heavy object.
 *   - The single master damping lowpass (previously a plain biquad
 *     sweeping 9000->2500Hz over 250ms) is now a true cascaded 4th-
 *     order Butterworth (two 2nd-order sections at the textbook
 *     Q1=0.541/Q2=1.307 pole pair for a 4-pole Butterworth response —
 *     see BUTTERWORTH_4TH_Q below) sweeping 1800->600Hz over just
 *     10ms: steeper rolloff (24dB/oct vs. the old 12dB/oct single
 *     biquad) AND a much faster close, which is most of what actually
 *     kills the sustained "boing" tail on top of the lower per-mode Qs.
 *
 * PARAMETER MODEL (unchanged from the previous pass; see that file's
 * own history for the physical reasoning behind the shape of each) —
 * every impact is driven by three 0-1 inputs (mass floors at 0.1):
 *   mass, surface_area, velocity
 * plus two global environment knobs, renamed to match this pass's own
 * spec (no external caller reads the old names — see themes/
 * standard.js, which only ever calls impact_event/roll_sequence):
 *   board_density   - was board_thickness. Same direction (higher =
 *                      lower/slower board modes), renamed because the
 *                      new spec frames it as "pulls cutoff frequencies
 *                      lower" rather than a physical slab dimension.
 *   wood_dampening  - was wood_density. Explicitly a ONE-DIRECTIONAL
 *                      damping knob now: raising it can only ever pull
 *                      Q values further DOWN toward zero ringing, never
 *                      up past this file's own per-mode ceilings — see
 *                      applyDampening below. The previous pass's
 *                      wood_density could push Q up to 20 at full
 *                      density, which is exactly the kind of knob that
 *                      could reintroduce the ringing this pass exists
 *                      to remove.
 *
 * None of this loads any audio asset — everything is generated from
 * noise, a tiny synthesized impulse, filters, and gain envelopes at
 * call time.
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
// No literature formula for the exact curve is claimed here (only the
// direction and the band are physically motivated) — see this file's
// header note.
function freqForMass(loFreq, hiFreq, mass) {
  const t = clamp01((mass - 0.1) / 0.9);
  return lerp(hiFreq, loFreq, t);
}

// ----------------------- mode bands (Hz, Q) ----------------------------
// Piece modes — a heavy wooden mass's own three resonances, ALL dropped
// roughly an octave from the previous pass and ALL kept at Q<=4 per the
// correction directive ("no ringing/boing/vibrato"). Mode 1 is the
// broad, non-pitched thud that carries most of the perceived pitch;
// Mode 2 is a quieter secondary "knock" a fifth-ish above it (kept
// non-integer/jittered so the two never fuse into one clean tone); Mode
// 3 is the only piece mode allowed above 1.5kHz, and only ever briefly
// — its own Q=1.0 gives it a ~1.1-1.8ms T60 across its whole band, so
// "heavily attenuated after 1.5ms" per spec is just what a resonator
// this low-Q already does on its own, no extra envelope required.
const PIECE_MODE1_HZ = [220, 380]; // Fundamental Body
const PIECE_MODE1_Q = [2.5, 4.0];
const PIECE_MODE2_HZ = [550, 800]; // Wood Knock
const PIECE_MODE2_Q = 2.0;
const PIECE_MODE3_HZ = [1400, 2200]; // Surface Snap
const PIECE_MODE3_Q = 1.0;

// Board modes: the thick play-surface's own body, shared by every
// impact regardless of which piece struck it. Renamed to match this
// pass's spec (Sub-Thud / Cavity Warmth) and dropped in range vs. the
// previous pass's Low/Body pair, same "roughly an octave down" move as
// the piece modes above.
const BOARD_SUB_THUD_HZ = [70, 140];
const BOARD_SUB_THUD_Q = 3.0;
const BOARD_CAVITY_HZ = [180, 260];
const BOARD_CAVITY_Q = 2.0;

// Textbook 2nd-order-section Q pair for a 4-pole Butterworth lowpass:
// Qk = 1 / (2*cos((2k-1)*pi/(2*N))) for k=1..N/2, N=4. Cascading two
// biquad lowpasses at the SAME cutoff with these two Qs gives a true
// 24dB/octave 4th-order Butterworth response (maximally flat passband,
// no resonant bump at the corner) — not an approximation, an exact
// factorization of the 4th-order Butterworth polynomial into two
// 2nd-order sections.
const BUTTERWORTH_4TH_Q = [0.5412, 1.3066];
const MASTER_LP_START_HZ = 1800;
const MASTER_LP_END_HZ = 600;
const MASTER_LP_SWEEP_S = 0.01; // 10ms, per spec

// Contact-driven secondary lowpass (separate from the master Butterworth
// above): a flat/full-face strike couples almost none of its energy
// above the low-mids into the air, so this pulls the cutoff much lower
// than an edge/corner strike, which is allowed a brief bright spike
// before this same stage muffles it.
const FLAT_CONTACT_LP_HZ = 1200;
const EDGE_CONTACT_LP_HZ = 2500;

// Every mode's Q is scaled by wood_dampening/mass through this, and
// EVERY result is clamped back down to the mode's own ceiling — this
// is what makes wood_dampening a one-directional "can only reduce
// ringing" knob rather than the previous pass's wood_density, which
// could push Q up past what the "no boing" correction actually allows.
function applyDampening(baseQ, dampeningMul, ceiling) {
  return Math.min(ceiling, baseQ * dampeningMul);
}

// Hard ceiling for anything a ROLLING micro-grain touches — per spec,
// "Each micro-grain uses Q<=2.0" regardless of what a single discrete
// impact's own mode ceilings allow, so tumbling never drifts toward a
// metallic click-train even where mass/dampening would otherwise permit
// a higher Q on a single solid impact.
const MICRO_GRAIN_Q_CAP = 2.0;

// --------------------------- noise buffers -----------------------------
// One shared PINK-noise buffer per AudioContext (impacts only ever read
// short slices near its start, at varying gains — a fresh buffer per
// hit would be wasted allocation for no audible gain). Pink noise (a
// steady -3dB/octave spectral tilt, generated with the standard Paul
// Kellet "economy" running-sum method) replaces the previous pass's
// flat white noise per spec: white noise's flat spectrum overweights
// exactly the high frequencies this pass is trying to suppress, so
// every mode fed by it started from a brighter place than it needed
// to; pink noise's own tilt is already headed the right direction
// before any filtering happens at all.
const noiseBufferCache = new WeakMap();
function getNoiseBuffer(ctx) {
  let buf = noiseBufferCache.get(ctx);
  if (!buf) {
    const len = Math.ceil(ctx.sampleRate * 0.25);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Paul Kellet's economy pink noise filter — seven running sums at
    // geometrically-spaced decay rates, summed with a white component.
    // Normalized by 0.11 (the standard scaling for this filter's own
    // output range) so the buffer stays within [-1, 1] like the old
    // white-noise buffer did.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = clamp(pink * 0.11, -1, 1);
    }
    noiseBufferCache.set(ctx, buf);
  }
  return buf;
}

// A single-cycle ASYMMETRIC impulse (fast linear rise, slower curved
// fall, all inside ~0.6ms) layered under the pink-noise burst below —
// per spec, "a single-cycle asymmetric impulse combined with pink
// noise," not noise alone. This is what gives the exciter a little of
// its own percussive shape/click independent of whatever the noise
// buffer's random content happens to be at playback time, the same way
// a real strike has both a broadband hiss-like component AND a single
// sharp mechanical click at the moment of contact.
const impulseBufferCache = new WeakMap();
function getImpulseBuffer(ctx) {
  let buf = impulseBufferCache.get(ctx);
  if (!buf) {
    const len = Math.max(8, Math.round(ctx.sampleRate * 0.0006));
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const riseLen = Math.max(1, Math.round(len * 0.18)); // fast rise
    for (let i = 0; i < len; i++) {
      if (i < riseLen) {
        data[i] = i / riseLen; // linear rise
      } else {
        const t = (i - riseLen) / (len - riseLen);
        data[i] = (1 - t) * (1 - t); // curved (asymmetric) fall
      }
    }
    impulseBufferCache.set(ctx, buf);
  }
  return buf;
}

// Soft-clip curve (tanh-based), amount in [0, 1] controlling drive —
// low amount stays within a few percent THD; only a hard, high-velocity
// strike pushes drive high enough to visibly round the waveform.
const saturationCurveCache = new Map();
function getSaturationCurve(amount) {
  const key = Math.round(amount * 100);
  let curve = saturationCurveCache.get(key);
  if (curve) return curve;
  const n = 512;
  curve = new Float32Array(n);
  const drive = 1 + amount * 8;
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
 * @param {number} [env.board_density=0.5] - 0-1, see header comment.
 * @param {number} [env.wood_dampening=0.5] - 0-1, see header comment.
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

  // A biquad resonator excited by a brief impulse rings at `freq`, with
  // a decay rate set by `q` — this IS the modal synthesis: no manual
  // gain envelope is layered on top, the ring-down is the filter's own
  // impulse response. Nothing here needs explicit disposal: once the
  // exciter's own noise BufferSource stops, this filter/gain pair just
  // receives silence and is garbage-collected once nothing references it.
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
   * velocity are all 0-1 (mass floors at 0.1 internally).
   * @param {number} mass
   * @param {number} surface_area
   * @param {number} velocity
   * @param {object} [opts]
   * @param {number} [opts.when] - AudioContext time; defaults to now.
   * @param {number} [opts.gainMul=1] - extra linear gain multiplier
   *   (used by roll_sequence for its own per-grain +/-4dB jitter).
   * @param {boolean} [opts.isMicroGrain=false] - shortens the exciter's
   *   own decay to the spec's 2-5ms rolling-grain range instead of the
   *   8-14ms main-impact range, and caps every mode's Q at
   *   MICRO_GRAIN_Q_CAP regardless of mass/dampening.
   */
  function impact_event(mass, surface_area, velocity, opts = {}) {
    const m = clamp(mass, 0.1, 1.0);
    const a = clamp01(surface_area);
    const v = clamp01(velocity);
    const t0 = opts.when != null ? opts.when : ctx.currentTime;
    const gainMul = opts.gainMul != null ? opts.gainMul : 1;

    // ---- energy / gain -------------------------------------------------
    // Kinetic energy ~ v^2, but perceived loudness is compressive; 1.4
    // is a tuning exponent, not a derived constant (see header note).
    // Board coupling uses the spec's explicit G_body ~ m^1.8 (was m^2 in
    // the previous pass); the piece's own resonance gets a gentler
    // sqrt(m) lift.
    const velocityEnergy = Math.pow(v, 1.4);
    const pieceMassGain = Math.pow(m, 0.5);
    const boardMassGain = Math.pow(m, 1.8); // G_body ∝ m^1.8, per spec
    // Flat contact: avg +4dB. Point/edge: avg -5dB.
    const contactGainDb = lerp(-5, 4, a);
    const contactGain = dbToGain(contactGainDb);

    const overallPeak = clamp(0.34 * velocityEnergy * contactGain, 0, 1);
    const piecePeak = overallPeak * pieceMassGain * gainMul;
    const boardPeak = overallPeak * boardMassGain * gainMul;

    // ---- damping / Q (wood_dampening + mass, ONE-DIRECTIONAL) ----------
    // Heavier pieces damp their own high modes faster (per spec: T60<8ms
    // above 1.5kHz for heavy pieces), and wood_dampening only ever pulls
    // Q further down from a mode's own ceiling — see applyDampening.
    // dampeningMul in (0, 1]: 1.0 at wood_dampening=0/mass=0 (no extra
    // reduction beyond each mode's stated ceiling), shrinking toward
    // ~0.4 as dampening/mass rise toward 1.
    const dampeningMul = lerp(1.0, 0.4, clamp01(0.6 * woodDampening + 0.4 * m));
    // Heavier pieces also close the master lowpass faster than 10ms —
    // "heavier pieces increase high-frequency attenuation speed."
    const hfCloseSpeedMul = lerp(1.0, 1.8, m);

    // ---- contact-driven frequency shift ---------------------------------
    // Flat (a=1): central resonance down ~15%. Point/edge (a=0): up ~20%.
    const contactFreqMul = 1 + lerp(0.2, -0.15, a);

    const sum = ctx.createGain();
    sum.gain.value = 1;

    // ================= 1. Exciter (impact force) =========================
    // Pink-noise burst — the broadband "crack" of two wooden surfaces
    // meeting, already spectrally tilted away from harsh highs (see
    // getNoiseBuffer) — plus the single-cycle asymmetric impulse mixed
    // in underneath (see getImpulseBuffer), both gated by the same
    // envelope. Attack 0.1-0.5ms and decay 2-5ms (micro-grain) / 8-14ms
    // (main impact), both tightened from the previous pass per spec.
    const attackS = lerp(0.0001, 0.0005, 1 - v); // harder hits snap faster
    const decayS = opts.isMicroGrain
      ? lerp(0.005, 0.002, v) // 2-5ms, rolling micro-impacts
      : lerp(0.014, 0.008, v); // 8-14ms, main impacts

    const exciterGain = ctx.createGain();
    exciterGain.gain.setValueAtTime(0, t0);
    exciterGain.gain.linearRampToValueAtTime(1, t0 + attackS);
    if (opts.isMicroGrain) {
      exciterGain.gain.linearRampToValueAtTime(0, t0 + attackS + decayS);
    } else {
      exciterGain.gain.exponentialRampToValueAtTime(0.001, t0 + attackS + decayS);
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(ctx);
    noiseSrc.connect(exciterGain);
    noiseSrc.start(t0);
    noiseSrc.stop(t0 + attackS + decayS + 0.02);

    const impulseGain = ctx.createGain();
    impulseGain.gain.value = 0.6; // under the noise, not over it
    const impulseSrc = ctx.createBufferSource();
    impulseSrc.buffer = getImpulseBuffer(ctx);
    impulseSrc.connect(impulseGain).connect(exciterGain);
    impulseSrc.start(t0);

    // Edge/point contact: a brief (<=1.0ms), band-limited-to-2.5kHz
    // bright spike standing in for a corner catching first — muffled
    // hard immediately after via its own lowpass, per spec, rather than
    // left to the noise burst's slower decay. Scaled by piecePeak (not
    // just spikeAmount) so a soft, low-mass tap on a corner still
    // sounds quiet, just with proportionally more of its (small) energy
    // up in the spike than the body.
    const spikeAmount = 1 - a;
    if (spikeAmount > 0.05) {
      const spikeSrc = ctx.createBufferSource();
      spikeSrc.buffer = getNoiseBuffer(ctx);
      spikeSrc.playbackRate.value = 1.6; // brighter than the main burst, still pink-tilted
      const spikeLp = ctx.createBiquadFilter();
      spikeLp.type = "lowpass";
      spikeLp.Q.value = 0.707;
      spikeLp.frequency.value = EDGE_CONTACT_LP_HZ;
      const spikeGain = ctx.createGain();
      const spikePeak = spikeAmount * piecePeak * 1.6;
      spikeGain.gain.setValueAtTime(0, t0);
      spikeGain.gain.linearRampToValueAtTime(spikePeak, t0 + 0.0003);
      spikeGain.gain.exponentialRampToValueAtTime(Math.max(0.00001, spikePeak * 0.001), t0 + 0.001);
      spikeSrc.connect(spikeLp).connect(spikeGain).connect(sum);
      spikeSrc.start(t0);
      spikeSrc.stop(t0 + 0.0015);
    }

    // ================= 2. Resonator bank (low-Q, no ringing) ============
    const qCeiling = (base) => (opts.isMicroGrain ? Math.min(MICRO_GRAIN_Q_CAP, base) : base);

    // Piece Mode 1 (Fundamental Body) — broad, non-pitched thud. No
    // pitch-bend on this one (a previous pass swept it 3-8% over the
    // first 2ms as a "surface give" cue) — removed per feedback that
    // ANY frequency motion on a resonant mode reads as vibrato once the
    // rest of the ringing is cleaned up; a static frequency is the only
    // way to be certain none is left.
    const mode1Freq = freqForMass(...PIECE_MODE1_HZ, m) * contactFreqMul;
    const mode1QBase = lerp(PIECE_MODE1_Q[0], PIECE_MODE1_Q[1], clamp01((m - 0.1) / 0.9));
    const mode1Q = qCeiling(applyDampening(mode1QBase, dampeningMul, PIECE_MODE1_Q[1]));
    addResonator(exciterGain, sum, { freq: mode1Freq, q: mode1Q, gain: piecePeak * 0.9 });

    // Piece Mode 2 (Wood Knock) — quieter secondary knock, jittered
    // +/-5% per hit so it never sounds like the exact same tone twice.
    const mode2Freq = freqForMass(...PIECE_MODE2_HZ, m) * contactFreqMul * (0.95 + Math.random() * 0.1);
    const mode2Q = qCeiling(applyDampening(PIECE_MODE2_Q, dampeningMul, PIECE_MODE2_Q));
    addResonator(exciterGain, sum, { freq: mode2Freq, q: mode2Q, gain: piecePeak * 0.35 });

    // Piece Mode 3 (Surface Snap) — the only piece mode above 1.5kHz,
    // Q=1.0 fixed (already the lowest of the bank; dampening can only
    // push it lower here too, never higher). Dominant on point/edge
    // contact, nearly silent flat.
    const mode3Freq = freqForMass(...PIECE_MODE3_HZ, m);
    const mode3Q = qCeiling(applyDampening(PIECE_MODE3_Q, dampeningMul, PIECE_MODE3_Q));
    addResonator(exciterGain, sum, {
      freq: mode3Freq,
      q: mode3Q,
      gain: piecePeak * (0.2 + spikeAmount * 0.9),
    });

    // Board Sub-Thud — board_density shifts this down (denser/thicker
    // slab, lower body pitch) and the mass^1.8 board coupling from above.
    const boardSubFreq = freqForMass(...BOARD_SUB_THUD_HZ, m) / (1 + boardDensity * 0.5);
    const boardSubQ = qCeiling(applyDampening(BOARD_SUB_THUD_Q, dampeningMul, BOARD_SUB_THUD_Q));
    addResonator(exciterGain, sum, {
      freq: boardSubFreq,
      q: boardSubQ,
      gain: boardPeak * (0.55 + 0.45 * a), // flat contact couples into the board harder
    });

    // Board Cavity Warmth.
    const boardCavityFreq = freqForMass(...BOARD_CAVITY_HZ, m) / (1 + boardDensity * 0.35);
    const boardCavityQ = qCeiling(applyDampening(BOARD_CAVITY_Q, dampeningMul, BOARD_CAVITY_Q));
    addResonator(exciterGain, sum, {
      freq: boardCavityFreq,
      q: boardCavityQ,
      gain: boardPeak * 0.3 * (0.5 + 0.5 * a),
    });

    // ================= 2b. Hard resonator gate (kills vibrato/echo) =====
    // A biquad bandpass, once excited, keeps ringing on ITS OWN terms
    // after the exciter's own envelope has already finished — governed
    // by the pole locations (T60 = 6.91*Q/(pi*f)), not by whatever
    // envelope was fed into it. That's a real, separate problem from
    // the Q-value correction above: T60 scales with 1/f, so even a
    // "low," spec-compliant Q reads as a MUCH longer absolute ring at
    // the low end of this bank than at the high end — Board Sub-Thud at
    // ~90Hz, Q up to 3.0, rings for close to 90ms on its own, and that
    // tail sits well past the very next rolling micro-grain (grains
    // land every 20-50ms), so several overlap and beat against each
    // other. That's precisely what reads as a lingering "vibrato/echo"
    // rather than a clean, dry knock, no matter how correct each mode's
    // own Q number is in isolation.
    //
    // The fix is a hard, FREQUENCY-INDEPENDENT amplitude gate on the
    // resonator bank's own combined output — the same principle real
    // damping cloth under a physical board uses: it absorbs vibrational
    // energy on a fixed timescale, not one that gets longer just
    // because a particular mode happens to be low-pitched. This forces
    // every mode's audible tail into the same tight window regardless
    // of its own natural T60, rather than trying to fight the T60=Q/f
    // relationship through Q alone.
    const gateWindowS = opts.isMicroGrain ? 0.006 : 0.014;
    const resonatorGate = ctx.createGain();
    resonatorGate.gain.setValueAtTime(1, t0);
    resonatorGate.gain.setValueAtTime(1, t0 + gateWindowS * 0.35);
    resonatorGate.gain.exponentialRampToValueAtTime(0.001, t0 + gateWindowS);
    sum.connect(resonatorGate);

    // ================= 3. Contact-driven lowpass =========================
    // Flat-face impact: cutoff pulled hard down to 1.2kHz (was 3kHz in
    // the previous pass). Edge/corner: left open enough (2.5kHz) for
    // the spike above to actually be heard before the master Butterworth
    // below finishes muffling everything regardless.
    const contactLp = ctx.createBiquadFilter();
    contactLp.type = "lowpass";
    contactLp.Q.value = 0.707;
    contactLp.frequency.value = lerp(EDGE_CONTACT_LP_HZ, FLAT_CONTACT_LP_HZ, a);
    resonatorGate.connect(contactLp);

    // ================= 4. Master muffled lowpass (4th-order Butterworth) =
    // Two cascaded 2nd-order sections at the exact 4-pole Butterworth Q
    // pair (see BUTTERWORTH_4TH_Q), both swept from 1800Hz down to
    // 600Hz over just 10ms — a steep 24dB/octave close, sped up further
    // for heavier pieces (hfCloseSpeedMul), modeling near-instant
    // acoustic damping rather than the previous pass's slower single-
    // biquad sweep. This is the single biggest lever against sustained
    // tail ringing: even a mode that decayed a little slowly on its own
    // gets cut off hard here regardless.
    const closeTimeS = MASTER_LP_SWEEP_S / hfCloseSpeedMul;
    let tail = contactLp;
    for (const q of BUTTERWORTH_4TH_Q) {
      const stage = ctx.createBiquadFilter();
      stage.type = "lowpass";
      stage.Q.value = q;
      stage.frequency.setValueAtTime(MASTER_LP_START_HZ, t0);
      stage.frequency.exponentialRampToValueAtTime(MASTER_LP_END_HZ, t0 + closeTimeS);
      tail.connect(stage);
      tail = stage;
    }

    // ================= 5. Saturation (soft clip) =========================
    // Drive scales with velocity only — a gentle tap stays clean, a
    // hard strike audibly (but mildly) compresses.
    const shaper = ctx.createWaveShaper();
    shaper.curve = getSaturationCurve(v * 0.5);
    shaper.oversample = "2x";
    tail.connect(shaper).connect(master);
  }

  /**
   * A continuous tumble: an irregular (Poisson-like) train of
   * micro-impacts with decaying velocity and randomized contact
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
      const grainContact = 0.1 + Math.random() * 0.6; // 0.1-0.7, per spec
      const grainGainDb = (Math.random() * 2 - 1) * 4; // +/-4dB
      impact_event(m, grainContact, vAtT, {
        when: t0 + t,
        gainMul: dbToGain(grainGainDb),
        isMicroGrain: true,
      });
      t += 0.02 + Math.random() * 0.03; // 20-50ms jittered Poisson interval, per spec
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
