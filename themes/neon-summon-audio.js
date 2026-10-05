/* The summons' sound (Nova's first arrival in Neon; the user's pick "C6"
   from the sound mock-ups): the Monks' Hum (10G: an E minor hum from E1,
   five notes x three voices, the top two 6 dB down, no whistle) pitched
   down 7 semitones, fading in from silence and growing steadily louder
   over the build (gain = build^2) and never moving in pitch; and under it
   the lower, muffled thunder (9H: a dull thump and a low rumble, one hit
   with a long dark reverb, no sweep). When it claps is the scene's
   (neon-summon.js): on a growing share of its beats, each clap bringing
   a shock wave.

   Two mixes, chosen by device (summonMixFor):
   - "full" (a computer: headphones or real speakers): the whole range,
     peaks around -5 dBFS, nothing squeezed.
   - "phone" (a touch-only device): the lows a phone speaker can't play
     (under ~120 Hz, where most of this sound's energy is) taken out,
     since they only drive the speaker and the phone's own limiter into
     crunching; a soft ceiling on what's left, then 3 dB back; shorter
     reverbs. (Measured through the game's chain: full peaks -5.4 dBFS, phone
     about -10; neither reaches the output ceiling.)

   It plays at the soundscape's interface channel level (the sound
   menu's slider and mute apply) but on a way out of its own, outside
   master (themes/neon.js summonOutput), and is levelled to the mock-up
   page: that page ran at 0.716 into its output; the interface path is
   sfxOut 1.25 x master 7.08, so the same level needs 0.716 / 8.85.

   Its end (the player takes the invite): the hum and the thunder's bed
   go quickly (user: the fade was too slow), and one last clap of thunder
   answers, into a long reverb of its own that rings on through the toll,
   the fall into the wormhole and the cut to black (which silences master,
   not this), and dies away naturally as the sphere comes up. (User: "the
   reverb from the last thunderclap needs to continue until its cessation
   naturally".) */

const APPEAR_AT = 0.4, RING_AT = 1.7, WAVES_AT = 3.6, RAMP = 45;
// The last clap's reverb: toll 2 s + fall 3.6 s + black 0.9 s + the
// sphere's fade 2 s is 8.5 s; this runs a little past that.
const LAST_TAIL_S = 10;
/* On a phone (the "phone" mix) every reverb here is one channel and the
   last clap's tail shorter (user, an Android phone: the sound stopped dead
   at the tap into the wormhole). The tap starts three long reverbs at once
   (this tail, the toll's, the Singularity hum's) on top of the summons'
   own: measured, the reverbs went from 8% of a desktop core's real time to
   about 30%, which a phone's audio thread can't keep up with while the
   wormhole loads its GPU, so its sound drops out; this way about 10%
   (with neon.js's own reverbs lightened the same way). */
const LAST_TAIL_PHONE_S = 5.5;
const TO_GAME = 0.716 / (1.25 * Math.pow(10, 17 / 20));
const dB = (x) => Math.pow(10, x / 20);

// "phone" on a touch-only device, "full" otherwise. (localStorage
// "ec:summon-mix" = "phone" | "full" overrides, for trying both.)
export function summonMixFor() {
  try { const o = localStorage.getItem("ec:summon-mix"); if (o === "phone" || o === "full") return o; } catch (e) {}
  const mm = (q) => typeof window !== "undefined" && window.matchMedia && window.matchMedia(q).matches;
  return mm("(hover: none) and (pointer: coarse)") ? "phone" : "full";
}

function makeNoise(ctx, brown) {
  const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last; } else d[i] = w;
    peak = Math.max(peak, Math.abs(d[i]));
  }
  const x = Math.floor(ctx.sampleRate * 0.05); // the loop seam, crossfaded
  for (let i = 0; i < x; i++) { const a = i / x; d[len - x + i] = d[len - x + i] * (1 - a) + d[i] * a; }
  for (let i = 0; i < len; i++) d[i] *= 0.9 / peak;
  return b;
}
// (chans 1 on a phone: a phone's speaker is all but mono, and a one-channel
// reverb costs half: see LAST_TAIL_S.)
function makeImpulse(ctx, secs, decay, chans = 2) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(chans, len, ctx.sampleRate);
  for (let ch = 0; ch < chans; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}

/* out: { ctx, dest, resume } from the soundscape's summonOutput(). */
export function createSummonSound(out, { mix = "full" } = {}) {
  const { ctx, dest } = out;
  const phone = mix === "phone";
  const srcs = [];
  const O = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const G = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; };
  const PAN = (p) => { if (!ctx.createStereoPanner) return null; const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
  const chain = (...n) => { n = n.filter(Boolean); for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const hold = (o, t) => { o.start(t); srcs.push(o); return o; };
  const loop = (buf, t) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t, Math.random() * 3); srcs.push(s); return s; };
  const shot = (buf, t, dur) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t, Math.random() * 3); s.stop(t + dur + 0.05); return s; };
  const env = (t, a, peak, d) => {
    const g = G(0), p = g.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  };
  const lfo = (f, depth, param, t) => { const o = O("sine", f), g = G(depth); o.connect(g); g.connect(param); hold(o, t); };
  const noise = makeNoise(ctx, false), brown = makeNoise(ctx, true);

  /* ---- the output: the mix bus, the phone treatment, to the game ---- */
  const bus = G(1), toGame = G(TO_GAME);
  if (phone) {
    // Butterworth, 4th order, at 120 Hz (Q given in dB, as Web Audio's
    // high-pass Q is: -5.33 and +2.33).
    const h1 = F("highpass", 120, -5.33), h2 = F("highpass", 120, 2.33);
    // Soft ceiling: untouched below 0.18 (-15 dBFS, in the mock-up's own
    // units), then a smooth curve to 0.26 (-11.7). The curve covers -1..1
    // of the input; the input is scaled so that range is 0..0.5.
    const sh = ctx.createWaveShaper(), n = 4096, c = new Float32Array(n), K = 0.18, TOP = 0.26;
    for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * 0.5, ax = Math.abs(x); c[i] = Math.sign(x) * (ax <= K ? ax : K + (TOP - K) * Math.tanh((ax - K) / (TOP - K))) * 2; }
    sh.curve = c; sh.oversample = "4x";
    // (+3 dB after: the lows gone, there's room, and a phone speaker is small.)
    chain(bus, h1, h2, G(2), sh, G(0.5 * dB(3)), toGame, dest);
  } else chain(bus, toGame, dest);

  // The mock-up's shared room (its "send" of 0.3 on the mix).
  const room = ctx.createConvolver(); room.buffer = makeImpulse(ctx, phone ? 2.4 : 3.2, 2.6, phone ? 1 : 2);
  chain(room, bus);

  let t0 = 0, started = false, ended = false, lastUpdate = -1;
  // The whole: faded in as the sphere appears, then its trim (-1.6 dB).
  // The thunder's claps have their own fader (thWhole), so that at the
  // end the hum can go while the last clap rings on.
  const whole = G(0), thWhole = G(0), trim = G(dB(-1.6)), send = G(0.3);
  chain(whole, trim, bus); thWhole.connect(trim); trim.connect(send); send.connect(room);

  /* ---- the hum (10G at -7 semitones) ---- */
  const hum = G(0), humOut = G(dB(-9.5));
  function startHum(t) {
    const r = Math.pow(2, -7 / 12), notes = [41.2, 61.74, 82.41, 98, 123.47].map((f) => f * r), gains = [0, 0, 0, -6, -6];
    const src = G(1), n = notes.length * 3;
    notes.forEach((f, ni) => {
      const lv = dB(gains[ni]);
      for (let j = 0; j < 3; j++) {
        const osc = O("sawtooth", f); osc.detune.value = (Math.random() * 2 - 1) * 7;
        lfo(4.3 + Math.random() * 1.5, 2.5 + Math.random() * 3, osc.detune, t); // each voice's own vibrato
        const g = G(lv / Math.sqrt(n));
        lfo(0.05 + Math.random() * 0.12, 0.25 * lv / Math.sqrt(n), g.gain, t); // and breath
        chain(hold(osc, t), g, src);
      }
    });
    chain(src, F("lowpass", 380 * r), hum, humOut, whole);
  }

  /* ---- the thunder (9H) ---- */
  const thBed = G(0.08), thOut = G(dB(10)), thVerb = G(1);
  function startThunder(t) {
    chain(thOut, thWhole);
    chain(loop(brown, t), F("lowpass", 80), thBed, G(dB(10)), whole);
    const cv = ctx.createConvolver(); cv.buffer = makeImpulse(ctx, phone ? 3.5 : 5, 2.2, phone ? 1 : 2);
    chain(thVerb, cv, F("lowpass", 1200), G(0.9), thOut);
  }
  function thunderRing(t) {
    const lp = F("lowpass", 216); lp.frequency.setValueAtTime(216, t); lp.frequency.exponentialRampToValueAtTime(64, t + 2.4);
    chain(shot(brown, t, 2.6), lp, env(t, 0.5, 0.18, 2.0), thOut);
  }
  function thunderHit(t, s) {
    const crack = chain(shot(noise, t, 0.15), F("lowpass", 250), env(t, 0.015, 0.03 * s, 0.09));
    const lp = F("lowpass", 300); lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(70, t + 2.2);
    const rum = chain(shot(brown, t, 2.7), lp, env(t, 0.06, 0.32 * s, 2.6), PAN(Math.random() * 0.8 - 0.4));
    crack.connect(thOut); rum.connect(thOut); crack.connect(thVerb); rum.connect(thVerb);
    return [crack, rum];
  }
  // The last clap: a full one, and into a long, dark reverb of its own
  // (as well as the usual one), so it carries into the sphere.
  function lastClap(t) {
    const cv = ctx.createConvolver(); cv.buffer = phone ? makeImpulse(ctx, LAST_TAIL_PHONE_S, 1.5, 1) : makeImpulse(ctx, LAST_TAIL_S, 1.7);
    const verb = G(1.1);
    chain(verb, cv, F("lowpass", 900), G(1), thOut);
    thunderHit(t, 1).forEach((n) => n.connect(verb));
  }

  return {
    mix,
    get ctx() { return ctx; },
    // tau: the summons' own clock (seconds since it began) right now.
    // rate: how fast the summons' build clock runs against real time
    // (neon-summon.js BUILD); its moments land in real seconds.
    start(tau, when = ctx.currentTime, rate = 1) {
      if (started) return;
      started = true; t0 = when - tau / rate;
      const at = (x) => t0 + x / rate;
      const a = Math.max(when, at(APPEAR_AT));
      [whole, thWhole].forEach((w) => { w.gain.setValueAtTime(0, a); w.gain.linearRampToValueAtTime(1, Math.max(a + 0.05, at(APPEAR_AT + 0.9))); });
      startHum(when); startThunder(when);
      if (at(RING_AT) >= when) thunderRing(at(RING_AT));
    },
    // The build: the hum from silence to full (build^2), the thunder's bed.
    update(tau, when = ctx.currentTime) {
      if (!started || ended || tau - lastUpdate < 0.1) return;
      lastUpdate = tau;
      const b = Math.min(1, Math.max(0, (tau - APPEAR_AT) / (WAVES_AT - APPEAR_AT + RAMP))), k = Math.min(1, Math.max(0, (tau - WAVES_AT) / RAMP));
      hum.gain.linearRampToValueAtTime(b * b, when + 0.1);
      thBed.gain.setTargetAtTime(0.08 + 0.07 * k, when, 0.4);
    },
    // A clap of thunder (the scene decides when: neon-summon.js, where it
    // brings a shock wave with it).
    hit(strength, when = ctx.currentTime) {
      if (!started || ended) return;
      thunderHit(when, strength);
    },
    resume() { if (out.resume) out.resume(); },
    // fade: how fast the hum goes. last: the closing clap and its long
    // tail (the Singularity taking over); without it (leaving the theme)
    // everything goes together.
    end(fade = 0.35, { last = true } = {}) {
      if (ended) return;
      ended = true;
      const now = ctx.currentTime;
      const out = (g) => { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(0, now, fade / 4); };
      out(whole.gain);
      const clap = last && started && thWhole.gain.value > 0.01;
      if (clap) { const g = thWhole.gain; g.cancelScheduledValues(now); g.setValueAtTime(Math.max(g.value, 0.5), now); lastClap(now + 0.02); }
      else out(thWhole.gain);
      // The reverbs ring out, then it all goes.
      setTimeout(() => {
        srcs.forEach((s) => { try { s.stop(); } catch (e) {} });
        try { toGame.disconnect(); } catch (e) {}
      }, ((clap ? (phone ? LAST_TAIL_PHONE_S : LAST_TAIL_S) : 5) + fade + 0.5) * 1000);
    },
  };
}
