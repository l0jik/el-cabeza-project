/* The late-night commercial's soundtrack (den-commercial.js draws it,
   den-audio.js's tvCommercial plays this), redone from scratch (user: the
   old one had got too messed up).

   - One continuous jingle, a 1975 home organ with its rhythm box on the
     bossa nova preset: a proper tune (eight bars, C major, the "El
     Ca-be-za!" motif at the top and the end), with bass, chords and drums
     under it from the title to "...you never will!", up a step for the
     special orders, stopping dead for "only $7.97", then the sign-off.
   - The user's four voice recordings, each on its own scene, with its
     words on screen (CUES.chessVoice etc.). They're decoded ahead of time
     (loadAdVoices) and started on the audio clock, so they land exactly;
     where they couldn't be decoded (a page from disk), an <audio> element
     takes over, put forward to where it should be if it starts late.
     The music dips under each voice (the tune most, the band a little).
   - A few sound effects for the jokes: the stamp, the slide whistle, the
     snores, a cymbal, bells, the typewriter, a boing, Dale's phone, the
     cash register, the fanfare.
   - Clean TV (redone again, user: too dirty): the set's speaker only
     gently (a little low end off, the top a touch soft, barely any
     crunch), the faintest hum and wow. No dropouts; the sound only dips,
     for the frame, at the hidden Singularity frames (CUES.flash).

   All of it through `out`; stop() fades it at once. */

import { CUES as AD, COMMERCIAL_MS } from "./den-commercial.js";

// The recordings, beside the page (build/build.js).
const VOICES = {
  chess: "el-cabeza-den-ad-voice-3.mp3",    // "Take a hike, chess!"
  checkers: "el-cabeza-den-ad-voice-4.mp3", // "Get outta here, Checkers!"
  king: "el-cabeza-den-ad-voice.mp3",       // "El Cabeza is the new king!"
  kings: "el-cabeza-den-ad-voice-2.mp3",    // "the new king!" x3, at the sign-off
};
// Each line: where it starts, and how long its speech runs (measured).
const LINES = [
  ["chess", AD.chessVoice, 2.0],
  ["checkers", AD.checkersVoice, 2.2],
  ["king", AD.voice, 2.9],
  ["kings", AD.kings, 4.5],
];
const VOICE_LEVEL = 0.45;

/* The recordings, decoded once (ctx's sample rate), or, if that can't be
   done, <audio> elements already loading. */
const voiceStore = { ctx: null, buffers: {}, elements: {}, sources: new Map() };
export function loadAdVoices(ctx) {
  if (!ctx || voiceStore.ctx === ctx) return;
  voiceStore.ctx = ctx;
  Object.entries(VOICES).forEach(([k, url]) => {
    const element = () => {
      if (voiceStore.elements[k] || typeof Audio === "undefined") return;
      const el = new Audio(); el.src = url; el.preload = "auto";
      try { el.load(); } catch (e) { /* it'll load on play */ }
      voiceStore.elements[k] = el;
    };
    if (typeof fetch === "undefined" || (typeof location !== "undefined" && location.protocol === "file:")) { element(); return; }
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => new Promise((res, rej) => { const p = ctx.decodeAudioData(b, res, rej); if (p && p.then) p.then(res, rej); }))
      .then((buf) => { voiceStore.buffers[k] = buf; })
      .catch(() => element());
  });
}

export function playCommercial(ctx, dest, { delay = 0, noiseBuf = null } = {}) {
  loadAdVoices(ctx);
  const T = ctx.currentTime + 0.05 + delay;
  const END = T + COMMERCIAL_MS / 1000;
  const nodes = [];
  const timers = [];
  const playing = [];
  const keep = (n) => { nodes.push(n); return n; };
  let stopped = false;

  // ---------------- the set's speaker ----------------
  const out = ctx.createGain(); out.gain.value = 1;
  const cut = ctx.createGain(); cut.gain.value = 1; // the hidden frames
  const wow = ctx.createDelay(0.05); wow.delayTime.value = 0.012;
  { const l = keep(ctx.createOscillator()); l.frequency.value = 0.31; const lg = ctx.createGain(); lg.gain.value = 0.00025; l.connect(lg).connect(wow.delayTime); l.start(T - 0.05); l.stop(END + 1); }
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120; hp.Q.value = 0.6;
  const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 1700; pk.Q.value = 0.8; pk.gain.value = 1.5;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7500; lp.Q.value = 0.5;
  const sh = ctx.createWaveShaper();
  { const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; c[i] = Math.tanh(x * 1.05) / Math.tanh(1.05); } sh.curve = c; }
  out.connect(wow).connect(hp).connect(pk).connect(lp).connect(sh).connect(cut).connect(dest);
  // The hum under it, faint, the whole way.
  [[60, 0.0018], [120, 0.0008]].forEach(([f, l]) => {
    const o = keep(ctx.createOscillator()); o.frequency.value = f; const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(l, T + 0.2); g.gain.setValueAtTime(l, T + AD.snow - 0.1); g.gain.linearRampToValueAtTime(0.0001, T + AD.snow);
    o.connect(g).connect(out); o.start(T); o.stop(T + AD.snow + 0.1);
  });
  // The hidden frames: the sound gone for the frame (or two), then back.
  AD.flash.forEach((c, i) => {
    const a = T + c, d = i >= 3 ? 4 / 24 : 2 / 24;
    cut.gain.setValueAtTime(1, a - 0.004); cut.gain.linearRampToValueAtTime(0.25, a); cut.gain.setValueAtTime(0.25, a + d - 0.004); cut.gain.linearRampToValueAtTime(1, a + d);
  });

  // ---------------- the band ----------------
  // The tune and the band on buses of their own, to dip under the voices.
  const lead = ctx.createGain(); lead.gain.value = 1; lead.connect(out);
  const band = ctx.createGain(); band.gain.value = 1; band.connect(out);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const noise = (t, d) => { const s = keep(ctx.createBufferSource()); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + d); return s; };
  const hit = (t, level, decay, filters, to = band, attack = 0.001) => {
    if (!noiseBuf) return;
    let n = noise(t, decay + attack + 0.05);
    filters.forEach(([type, f, Q]) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q) b.Q.value = Q; n.connect(b); n = b; });
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    n.connect(g).connect(to);
  };
  const tone = (t, f, d, level, type = "sine", to = out, attack = 0.004) => {
    const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + d);
    o.connect(g).connect(to); o.start(t); o.stop(t + attack + d + 0.05); return o;
  };
  // The organ: a drawbar-ish square and triangle, the vibrato on, keyed.
  const organ = (t, notes, dur, level, to = band) => {
    notes.forEach((m) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + 0.01);
      g.gain.setValueAtTime(level, Math.max(t + 0.011, t + dur - 0.04)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const vib = keep(ctx.createOscillator()); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = hz(m) * 0.005; vib.connect(vg);
      [["square", 0.28], ["triangle", 1]].forEach(([type, k]) => {
        const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = hz(m); vg.connect(o.frequency);
        const og = ctx.createGain(); og.gain.value = k; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.02);
      });
      vib.start(t); vib.stop(t + dur + 0.02);
      g.connect(to);
    });
  };
  // The bass: the organ's pedal, round, an octave up (a small speaker).
  const bass = (t, m, dur, level = 0.11) => {
    const o = keep(ctx.createOscillator()); o.type = "sawtooth"; o.frequency.value = hz(m);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700; f.Q.value = 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + 0.012); g.gain.exponentialRampToValueAtTime(level * 0.4, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(band); o.start(t); o.stop(t + dur + 0.02);
  };
  // The rhythm box: a soft kick, a rim click (the bossa clave), the hat.
  const kick = (t) => { const o = keep(ctx.createOscillator()); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.1); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g).connect(band); o.start(t); o.stop(t + 0.2); };
  const rim = (t) => { tone(t, 1900, 0.035, 0.03, "triangle", band, 0.001); hit(t, 0.03, 0.02, [["bandpass", 2600, 3]]); };
  const hat = (t, l = 0.018) => hit(t, l, 0.03, [["highpass", 7500]]);

  const BEAT = 0.5, BAR = 4 * BEAT;
  // The tune: eight bars (beat, note, beats), and its chords (voicing, bass).
  const MELODY = [
    [[0, 76, 1.5], [1.5, 74, 0.5], [2, 72, 1], [3, 76, 1]],
    [[0, 76, 1.5], [1.5, 77, 0.5], [2, 79, 2]],
    [[0, 77, 1], [1, 76, 0.5], [1.5, 74, 0.5], [2, 72, 1], [3, 74, 1]],
    [[0, 71, 1.5], [1.5, 72, 0.5], [2, 74, 2]],
    [[0, 76, 1.5], [1.5, 74, 0.5], [2, 72, 1], [3, 79, 1]],
    [[0, 81, 1.5], [1.5, 79, 0.5], [2, 76, 2]],
    [[0, 77, 1], [1, 77, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 71, 1]],
    [[0, 72, 3], [3, 67, 1]],
  ];
  const C = [[60, 64, 67], 48], Am = [[57, 60, 64], 45], Dm = [[57, 62, 65], 50], G7 = [[55, 59, 62, 65], 43], F = [[57, 60, 65], 41];
  const CHORDS = [C, Am, Dm, G7, C, Am, [F, G7], C];
  // One bar of the band and the tune: bar i of the eight, up `key`
  // semitones, from time t (the tune left out if `tune` is false).
  const playBar = (t, i, key = 0, { tune = true, until = Infinity } = {}) => {
    const ch = CHORDS[i % 8];
    const halves = Array.isArray(ch[0][0]) ? ch : [ch, ch];
    [0, 1].forEach((h) => {
      const [voicing, root] = halves[h], t0 = t + h * 2 * BEAT;
      if (t0 >= until) return;
      // The bossa bass: root on the one, the fifth on the "and" of two.
      bass(t0, root + key, BEAT * 1.4);
      if (t0 + 1.5 * BEAT < until) bass(t0 + 1.5 * BEAT, root + 7 + key, BEAT * 0.5, 0.08);
      // The organ's chords on the offbeats, short.
      [0.5, 1.5].forEach((k) => { if (t0 + k * BEAT < until) organ(t0 + k * BEAT, voicing.map((m) => m + key), BEAT * 0.4, 0.016); });
    });
    // The rhythm box: kick on 1 and 3, the clave (3-2), the hats in eighths.
    [0, 2].forEach((k) => { if (t + k * BEAT < until) kick(t + k * BEAT); });
    [0, 0.75, 1.5, 2.5, 3].forEach((k) => { if (t + k * BEAT < until) rim(t + k * BEAT); });
    for (let k = 0; k < 8; k++) if (t + k * 0.5 * BEAT < until) hat(t + k * 0.5 * BEAT, k % 2 ? 0.011 : 0.018);
    if (tune) MELODY[i % 8].forEach(([b, m, d]) => { const s = t + b * BEAT; if (s < until) organ(s, [m + key], Math.min(d * BEAT * 0.92, until - s), 0.05, lead); });
  };
  // "El Ca-be-za!": G A C . E, with the chord under the last.
  const motif = (t, key = 0, level = 0.055) => {
    [[67, 0, 0.22], [69, 0.25, 0.22], [72, 0.5, 0.22], [76, 0.8, 0.75]].forEach(([m, d, l]) => organ(t + d, [m + key, m - 12 + key], l, level, lead));
    organ(t + 0.8, [60, 64, 67].map((m) => m + key), 0.75, 0.02);
  };

  // The slate: the station's tone, then the title's motif and the letters
  // popping up.
  tone(T + 0.3, 1000, 1.4, 0.022, "sine", out, 0.02);
  motif(T + AD.title + 0.05);
  for (let i = 0; i < 9; i++) { const t = T + AD.title + 1.0 + i * 0.1; const o = tone(t, 520 + i * 60, 0.08, 0.018, "triangle"); o.frequency.exponentialRampToValueAtTime(880 + i * 80, t + 0.06); }
  // The band comes in a bar before the tune: the groove from G0.
  const G0 = AD.title + 1.4; // bars from here, 2 s each (AD.orders falls on bar 7)
  const at = (bar) => T + G0 + bar * BAR;
  // Bars 0-6: the tune in C (a bar of groove first while the letters land).
  playBar(at(0), 7, 0, { tune: false });
  for (let b = 1; b < 7; b++) playBar(at(b), b - 1);
  // Special orders (bar 7, AD.orders): up a step, and a ta-daa on the way.
  organ(T + AD.orders - 0.2, [59, 62, 67], 0.16, 0.03, lead);
  organ(T + AD.orders, [62, 66, 69, 74], 0.7, 0.03, lead);
  // (A bar of groove under the bells, then the tune from its top.)
  playBar(at(7), 0, 2, { tune: false });
  for (let b = 0; b < 3; b++) playBar(at(8 + b), b, 2);
  // The dealer's card (bar 11, about AD.dealer): its turn home (the G7, in
  // C), the tune's second half, through the price card until it stops
  // dead for "only".
  const stopAt = T + AD.only - 0.06;
  for (let b = 0; b < 3; b++) playBar(at(11 + b), 3 + b, 0, { until: stopAt });
  // "...only $7.97": nothing but the cash register; then "brand new for
  // 1975": the fanfare, and the band back with the tune's cadence.
  organ(T + AD.brandNew, [60, 64, 67, 72], 0.14, 0.035, lead);
  organ(T + AD.brandNew + 0.16, [62, 65, 69, 74], 0.14, 0.035, lead);
  organ(T + AD.brandNew + 0.32, [64, 67, 72, 76], 1.2, 0.035, lead);
  // (The tune's cadence, F to G7, then a bar of the band vamping on the big
  // chord, across the 1975 card, a second longer now.)
  playBar(T + AD.brandNew + 0.3, 6, 0, { until: T + AD.close + 0.05 });
  playBar(T + AD.brandNew + 2.3, 7, 0, { tune: false, until: T + AD.close + 0.05 });
  // "Get yours now...": the organ runs up to the big chord; "if not, you
  // never will!": it drops to something minor and a little too sincere.
  for (let i = 0; i < 8; i++) organ(T + AD.close + i * 0.07, [60 + [0, 2, 4, 5, 7, 9, 11, 12][i]], 0.09, 0.03, lead);
  organ(T + AD.close + 0.6, [60, 64, 67, 72], 0.9, 0.03);
  bass(T + AD.close + 0.6, 48, 0.9);
  organ(T + AD.never + 0.1, [57, 60, 64, 71], 1.0, 0.026);
  bass(T + AD.never + 0.1, 45, 1.0, 0.08);
  organ(T + AD.never + 1.1, [56, 60, 63, 68], 1.0, 0.024);
  bass(T + AD.never + 1.1, 44, 1.0, 0.07);
  // The sign-off: the motif, soft, and the big chord held under "the new
  // king!", fading.
  motif(T + AD.credit, 0, 0.04);
  {
    const t = T + AD.credit + 0.8, g = ctx.createGain();
    g.gain.setValueAtTime(1, t); g.gain.setValueAtTime(1, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + 4.6);
    g.connect(band);
    organ(t, [48, 60, 64, 67, 72], 4.6, 0.022, g);
  }

  // ---------------- the jokes ----------------
  // Chess: the sad trombone (before the line).
  [[55, 0], [54, 0.2], [53, 0.4], [52, 0.6]].forEach(([m, d], i) => {
    const t = T + AD.chess + 0.12 + d, l = i === 3 ? 0.45 : 0.18;
    const o = keep(ctx.createOscillator()); o.type = "sawtooth"; o.frequency.value = hz(m);
    if (i === 3) { const w = keep(ctx.createOscillator()); w.frequency.value = 5; const wg = ctx.createGain(); wg.gain.value = 4; w.connect(wg).connect(o.frequency); w.start(t); w.stop(t + l); }
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1000; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.04); g.gain.setValueAtTime(0.045, t + l - 0.06); g.gain.linearRampToValueAtTime(0.0001, t + l);
    o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + l + 0.02);
  });
  // The stamp (twice), and the pawn and the sleepers run off on a slide
  // whistle.
  [AD.stamp, AD.stamp2].forEach((c) => { const t = T + c; hit(t, 0.2, 0.1, [["lowpass", 900]], out); const o = tone(t, 120, 0.22, 0.1); o.frequency.exponentialRampToValueAtTime(50, t + 0.18); });
  [[AD.flee, 700, 2300], [AD.flee2, 2300, 600]].forEach(([c, f0, f1]) => {
    const t = T + c, o = keep(ctx.createOscillator()); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.6);
  });
  // The sleepers' snores, before the stamp wakes nobody.
  [0.3, 0.7].forEach((d, i) => {
    const t = T + AD.checker + d, o = keep(ctx.createOscillator()); o.type = "sawtooth";
    o.frequency.setValueAtTime(i ? 72 : 92, t); o.frequency.linearRampToValueAtTime(i ? 60 : 76, t + 0.32);
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.12); g.gain.linearRampToValueAtTime(0.0001, t + 0.36);
    o.connect(lpf).connect(g).connect(out); o.start(t); o.stop(t + 0.4);
  });
  // The king: a cymbal swell into the line; a sparkle after it.
  hit(T + AD.king - 0.6, 0.05, 0.9, [["highpass", 5000]], out, 0.6);
  [0, 0.12, 0.24].forEach((d, i) => tone(T + AD.voice + 3.1 + d, hz(91 + i * 4), 0.5, 0.012));
  // Special orders: a bell for each, and "some assembly required" bonks.
  const bell = (t, m, level) => { tone(t, hz(m), 1.0, level); tone(t, hz(m) * 2.76, 0.35, level * 0.3); };
  AD.items.forEach((c, i) => bell(T + c, [79, 83, 86][i] + 2, 0.04));
  { const t = T + AD.assembly; const o = tone(t, 380, 0.4, 0.03, "triangle"); o.frequency.exponentialRampToValueAtTime(160, t + 0.36); }
  // The best thing: a line on the typewriter, its bell at the end.
  for (let i = 0; i < 28; i++) hit(T + AD.best + 0.1 + i / 16 + Math.random() * 0.01, 0.035, 0.022, [["bandpass", 2600, 1.4]], out);
  bell(T + AD.best + 0.1 + 28 / 16 + 0.08, 96, 0.03);
  // ...sort of!!: boing.
  {
    const t = T + AD.sortOf, o = keep(ctx.createOscillator()); o.type = "triangle";
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.08); o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
    const w = keep(ctx.createOscillator()); w.frequency.value = 14; const wg = ctx.createGain(); wg.gain.value = 30; w.connect(wg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(out); o.start(t); w.start(t); o.stop(t + 0.6); w.stop(t + 0.6);
  }
  // Dale, standing by: his telephone, one ring.
  {
    const t = T + AD.standing + 0.2, d = 1.0, g = ctx.createGain(), e = ctx.createGain();
    const am = keep(ctx.createOscillator()); am.type = "square"; am.frequency.value = 20; const amg = ctx.createGain(); amg.gain.value = 0.5; g.gain.value = 0.5; am.connect(amg).connect(g.gain);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.022, t + 0.02); e.gain.setValueAtTime(0.022, t + d - 0.05); e.gain.linearRampToValueAtTime(0.0001, t + d);
    [1150, 1420].forEach((f) => { const o = keep(ctx.createOscillator()); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + d + 0.02); });
    g.connect(e).connect(out); am.start(t); am.stop(t + d + 0.02);
  }
  // "...only $7.97": the cash register (the key, the bell, the drawer).
  { const t = T + AD.only; hit(t, 0.1, 0.05, [["bandpass", 1800, 2]], out); bell(t + 0.06, 100, 0.05); hit(t + 0.2, 0.07, 0.3, [["bandpass", 700, 1.2]], out); }
  // "...you never will!": a falling whistle into the minor chord.
  { const t = T + AD.never - 0.1; const o = tone(t, 660, 0.6, 0.022, "triangle"); o.frequency.exponentialRampToValueAtTime(110, t + 0.55); }

  // ---------------- the voices ----------------
  // The music down under each line (lines close together taken as one).
  const windows = LINES.map(([, c, len]) => [T + c, T + c + len])
    .reduce((m, w) => { const l = m[m.length - 1]; if (l && w[0] <= l[1] + 0.8) l[1] = Math.max(l[1], w[1]); else m.push(w.slice()); return m; }, []);
  windows.forEach(([a, z]) => {
    [[lead, 0.18], [band, 0.55]].forEach(([bus, lo]) => {
      bus.gain.setValueAtTime(1, a - 0.2); bus.gain.linearRampToValueAtTime(lo, a);
      bus.gain.setValueAtTime(lo, z); bus.gain.linearRampToValueAtTime(1, z + 0.45);
    });
  });
  const vbus = ctx.createGain(); vbus.gain.value = VOICE_LEVEL; vbus.connect(out);
  LINES.forEach(([k, c]) => {
    const when = T + c;
    const buf = voiceStore.buffers[k];
    if (buf) {
      const s = keep(ctx.createBufferSource()); s.buffer = buf; s.connect(vbus); s.start(when);
      return;
    }
    const el = voiceStore.elements[k];
    if (!el) return;
    let src = voiceStore.sources.get(el);
    try { if (!src) { src = ctx.createMediaElementSource(el); voiceStore.sources.set(el, src); } } catch (e) { return; }
    try { src.disconnect(); } catch (e) { /* not connected */ }
    src.connect(vbus);
    timers.push(setTimeout(() => {
      if (stopped) return;
      // (Late, as an element can be: started from where it should be.)
      try { el.currentTime = Math.max(0, ctx.currentTime - when); } catch (e) { /* from the top */ }
      const p = el.play(); if (p && p.catch) p.catch(() => { /* no sound, then */ });
      playing.push(el);
    }, Math.max(0, (when - ctx.currentTime) * 1000 - 20)));
  });

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, 0.015);
      timers.forEach(clearTimeout);
      playing.forEach((el) => { try { el.pause(); } catch (e) { /* gone */ } });
      setTimeout(() => {
        nodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } });
        try { out.disconnect(); } catch (e) { /* gone */ }
      }, 200);
    },
    end: END,
  };
}
