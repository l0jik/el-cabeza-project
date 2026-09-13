/*
 * wood-impact-synth.js
 * ---------------------------------------------------------------------
 * Procedural synthesis of wooden-game-piece impact sounds, for Standard
 * El Cabeza's currently-silent theme (see themes/standard.js — its
 * createAudio() is a set of no-op stubs; hasAudio is false). This is a
 * standalone script: it does not modify or get imported by the game
 * yet. Drop-in path once approved: replace createAudio() in
 * standard.js with something that constructs one AudioContext and
 * calls createWoodPercussion(ctx) below, wire hasAudio to true, and
 * pass piece geometry into playImpact() from the same call sites that
 * already call audioRef.current.playLanding(piece.w * piece.h * piece.z)
 * in chassis/ElCabeza3D.jsx.
 *
 * ACOUSTIC MODEL — what's real, and what's a reasonable approximation
 * ---------------------------------------------------------------------
 * A struck wooden block is, acoustically, closest to a free-free
 * vibrating bar (the same starting model used for xylophone/marimba
 * bar synthesis — see Chaigne & Doutaut, "Numerical Simulations of
 * Xylophones," JASA 1997). Three real properties of that model are used
 * directly here, not just approximated by ear:
 *
 * 1. FUNDAMENTAL FREQUENCY scales with the bar's own physical
 *    dimensions and material stiffness/density, not with loudness or
 *    an arbitrary "pitch knob":
 *
 *        f1 = 1.028 * (h / L^2) * sqrt(E / rho)
 *
 *    where L is the vibrating length, h the thickness in the direction
 *    of vibration, E the material's Young's modulus, and rho its
 *    density. For quartersawn white/red oak along the grain:
 *      E   ~ 11 GPa      (10-13 GPa across sources)
 *      rho ~ 750 kg/m^3  (700-770 kg/m^3 air-dried)
 *    giving a longitudinal wave speed sqrt(E/rho) ~ 3830 m/s — close to
 *    the ~3800-4200 m/s commonly cited for dense hardwoods, and much
 *    higher than softwoods (spruce ~3300-5000 m/s along grain but far
 *    lower across grain, which is part of why softwood knocks sound
 *    "hollower"/lower-pitched than a hardwood block of the same size).
 *
 * 2. MODAL RATIOS: a free-free uniform bar's flexural overtones sit at
 *    fixed, non-harmonic multiples of the fundamental — approximately
 *    1 : 2.756 : 5.404 : 8.933 : 13.34 (Rayleigh's classical free-free
 *    bar solution). Non-harmonic partials are exactly what makes a
 *    wood block read as "wood" rather than "bell" (harmonic) or "drum"
 *    (near-continuous/inharmonic in a different way) — this is the
 *    single biggest lever for authenticity here, more than any specific
 *    frequency value.
 *
 * 3. FREQUENCY-DEPENDENT DAMPING: wood's internal friction increases
 *    with frequency, so higher partials decay faster than the
 *    fundamental — the "brightness" of a knock collapses within the
 *    first few tens of milliseconds, leaving a longer, duller body tone
 *    ringing on. Modeled here as T60(f) = T60(f1) * (f1/f)^DAMPING_EXP,
 *    a standard heuristic in wood/bar physical-modeling synthesis.
 *
 * On top of the piece's own bar-like resonance:
 *
 * - IMPACT ATTACK is a very short (1-4 ms) burst of filtered noise —
 *   the broadband click of two irregular wooden surfaces' microscopic
 *   asperities colliding, not a tone at all. Its center frequency and
 *   brevity both track impact velocity: a harder hit is a shorter,
 *   higher, louder click.
 * - LANDING ORIENTATION changes effective contact area, which is
 *   modeled as an acoustic damping/coupling effect, not a pitch change:
 *   a broad face landing flat couples strongly into the slab and loses
 *   energy fast (a duller, shorter "thud"), while a corner or edge
 *   landing is close to a free boundary condition and rings longer and
 *   brighter — matching the real, easily-checked difference between
 *   tapping a wood block flat versus on a corner.
 * - THE SLAB ITSELF gets a separate, shared, low-frequency resonant
 *   body (three fixed low modes, long decay) added under every impact
 *   at low level — this is what makes every piece sound like it's
 *   landing on the SAME large object rather than each being its own
 *   isolated little sound.
 *
 * None of this needs a sample library — everything below is generated
 * from oscillators, noise, and filters at call time, so an unlimited
 * variety of piece sizes/orientations/velocities all sound distinct and
 * consistent with each other, with zero asset loading.
 */

// ---- Material constants (dense hardwood oak, along the grain) -------
const OAK_YOUNGS_MODULUS_PA = 11e9; // 11 GPa
const OAK_DENSITY_KG_M3 = 750;
const OAK_WAVE_SPEED_M_S = Math.sqrt(OAK_YOUNGS_MODULUS_PA / OAK_DENSITY_KG_M3); // ~3830 m/s

// Rayleigh free-free bar modal frequency ratios (dimensionless).
const BAR_MODE_RATIOS = [1, 2.756, 5.404, 8.933, 13.34];
const BAR_MODE_GAIN_EXPONENT = 1.35; // higher modes start quieter as well as decaying faster
const DAMPING_EXP = 0.62; // how much faster high partials die relative to the fundamental

// The receiving slab's own body resonance — a handful of fixed low
// modes shared by every impact, representing "one large piece of
// furniture," not the struck piece itself.
const SLAB_MODES_HZ = [92, 148, 213];
const SLAB_MODE_GAINS = [1, 0.62, 0.4];
const SLAB_T60_S = 0.55;

/**
 * Bar-model fundamental for a wooden piece of a given vibrating length.
 * @param {number} lengthM - characteristic vibrating dimension, meters.
 * @param {number} thicknessM - thickness in the direction of vibration, meters.
 */
function barFundamentalHz(lengthM, thicknessM) {
  const f1 = 1.028 * (thicknessM / (lengthM * lengthM)) * OAK_WAVE_SPEED_M_S;
  // Real wood blocks this small produce audible-range knocks; clamp to
  // keep pathological inputs (near-zero size) from generating
  // inaudible sub-bass or ultrasonic nonsense.
  return Math.max(70, Math.min(3200, f1));
}

/** T60 (seconds) for a given partial, scaling down from the fundamental's own T60. */
function partialT60(fundamentalT60, freqHz, fundamentalHz) {
  return fundamentalT60 * Math.pow(fundamentalHz / freqHz, DAMPING_EXP);
}

function makeNoiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * @param {AudioContext} ctx
 * @returns {{ playImpact: (params: object) => void, dispose: () => void }}
 */
export function createWoodPercussion(ctx) {
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const clickNoise = makeNoiseBuffer(ctx, 0.06);

  /**
   * @param {object} params
   * @param {number} [params.sizeM=0.045] - piece's characteristic footprint dimension, meters
   *   (e.g. derived from PIECE_SCALE * max(w, h, z) in engine units — see integration note above).
   * @param {number} [params.massKg=0.12] - piece mass in kilograms; scales loudness and the
   *   slab's own contribution (heavier pieces excite the slab body more).
   * @param {number} [params.velocityMS=0.9] - impact velocity in m/s. Higher = louder, sharper
   *   attack, brighter (more high-partial energy); lower = a gentle, muted tap.
   * @param {number} [params.contactFrac=0.5] - 0 = landing on a corner/edge (small contact
   *   area, rings freely, brightest/longest), 1 = landing flat on a broad face (large contact
   *   area, heavily damped into the slab, dullest/shortest).
   * @param {number} [params.when] - AudioContext time to schedule the sound at; defaults to now.
   */
  function playImpact({
    sizeM = 0.045,
    massKg = 0.12,
    velocityMS = 0.9,
    contactFrac = 0.5,
    when,
  } = {}) {
    const t0 = when != null ? when : ctx.currentTime;
    const clampedVel = Math.max(0.15, Math.min(3.5, velocityMS));
    const clampedContact = Math.max(0, Math.min(1, contactFrac));

    // Impact energy grows faster than linearly with velocity (kinetic
    // energy ~ v^2), but ears perceive loudness compressively — a
    // velocity exponent around 1.3-1.6 reads as "harder hit = notably
    // louder" without immediately clipping.
    const energy = Math.pow(clampedVel / 0.9, 1.45);
    const massFactor = Math.pow(Math.max(0.03, massKg) / 0.12, 0.35);
    const overallPeak = Math.min(1, 0.22 * energy * massFactor);

    // Flat-face landings couple more energy into the slab and lose it
    // faster from the piece's own resonance; corner/edge landings keep
    // more energy ringing in the piece itself, longer.
    const pieceT60Scale = 1.35 - 0.9 * clampedContact; // 0.45x (flat) .. 1.35x (corner)
    const slabCouplingScale = 0.55 + 0.9 * clampedContact; // flat couples into the slab harder

    // -------------------- 1. Contact click (attack) -------------------
    const clickDurS = 0.0035 - 0.0018 * (clampedVel / 3.5); // harder hit = shorter, snappier click
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickNoise;
    const clickFilt = ctx.createBiquadFilter();
    clickFilt.type = "bandpass";
    // A harder impact excites higher-frequency surface noise.
    clickFilt.frequency.value = 2600 + clampedVel * 1400;
    clickFilt.Q.value = 1.1;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0, t0);
    clickGain.gain.linearRampToValueAtTime(overallPeak * 0.9, t0 + 0.0006);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.004, clickDurS));
    clickSrc.connect(clickFilt).connect(clickGain).connect(master);
    clickSrc.start(t0);
    clickSrc.stop(t0 + clickDurS + 0.02);

    // ---------------- 2. The piece's own bar resonance -----------------
    // Two independent vibrating axes (the piece's two in-plane
    // dimensions differ slightly at a real block's actual footprint,
    // even for a "square" piece, once you account for a real physical
    // object's manufacturing variance) — a second, detuned copy of the
    // mode set is layered in at lower level, which is what keeps a
    // synthesized block from sounding like a single pure idealized bar.
    const lengthPrimary = Math.max(0.012, sizeM);
    const lengthSecondary = lengthPrimary * (0.88 + Math.random() * 0.1);
    const thickness = lengthPrimary * 0.42; // typical block-piece proportions

    [
      { length: lengthPrimary, levelMul: 1 },
      { length: lengthSecondary, levelMul: 0.45 },
    ].forEach(({ length, levelMul }) => {
      const fundamental = barFundamentalHz(length, thickness);
      const fundamentalT60 = (0.09 + 0.05 * massFactor) * pieceT60Scale;

      BAR_MODE_RATIOS.forEach((ratio, i) => {
        const freq = fundamental * ratio * (0.99 + Math.random() * 0.02);
        const modeGain = overallPeak * levelMul * Math.pow(ratio, -BAR_MODE_GAIN_EXPONENT) * (0.55 + energy * 0.45);
        const t60 = partialT60(fundamentalT60, freq, fundamental);
        // Time to decay to ~1% (a practical "silent" floor) from a T60.
        const tailS = t60 * (Math.log(0.01) / Math.log(0.5));

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t0);
        // A brief, tiny downward pitch glide on the fundamental only —
        // real struck bars sag slightly in pitch in the first instant
        // as the strike's own deformation relaxes.
        if (i === 0) {
          osc.frequency.setValueAtTime(freq * 1.012, t0);
          osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.02);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(modeGain, t0 + 0.0015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, tailS));
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + tailS + 0.05);
      });
    });

    // -------------------- 3. Shared oak-slab body tone ------------------
    const slabPeak = overallPeak * 0.5 * slabCouplingScale;
    SLAB_MODES_HZ.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * (0.995 + Math.random() * 0.01);
      const g = ctx.createGain();
      const peak = slabPeak * SLAB_MODE_GAINS[i];
      const t60 = SLAB_T60_S * (1 - 0.15 * i);
      const tailS = t60 * (Math.log(0.01) / Math.log(0.5));
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + tailS);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + tailS + 0.05);
    });
  }

  return {
    playImpact,
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
 *   const wood = createWoodPercussion(ctx);
 *   // A small piece (Cabeza-sized disc), gentle flat landing:
 *   wood.playImpact({ sizeM: 0.032, massKg: 0.05, velocityMS: 0.5, contactFrac: 0.9 });
 *   // A large piece (Opa-sized double block), hard corner landing, 400ms later:
 *   setTimeout(() => wood.playImpact({
 *     sizeM: 0.07, massKg: 0.4, velocityMS: 2.2, contactFrac: 0.1,
 *   }), 400);
 */
