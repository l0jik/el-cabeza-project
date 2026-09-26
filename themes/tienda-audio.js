/* Tienda's sound: a store at half past seven.

   Nothing here is sampled or borrowed; it's all synthesized, and the
   music is written as it plays. Three layers:

   1. The store. The hum of the fluorescent fixtures (120 Hz and its
      harmonics, the ballasts' buzz above them), the air handling, and
      now and then something far off: a cart's wheels on the tile, a
      register ringing up a sale, the public-address chime and a voice
      you can't make out, a telephone at the service desk, someone's
      footsteps. Mostly, though, it's quiet.
   2. The music, from the ceiling speakers: instrumental arrangements of
      the kind these stores piped in (vibraphone or flute on the tune,
      electric piano, strings, a soft bass and brushes), newly composed
      from a few chord progressions and a phrase generator, so nothing
      recognizable. It's heard the way it was, through small paper-cone
      speakers in a big hard room, played off tape: thin, a little
      wavering, with a long tail. One arrangement ends, a moment of
      nothing, the next begins in another key.
   3. The game: wooden blocks on a lacquered folding board, the board's
      brass latches, paper for the menus.

   Contract with the chassis as the other themes: the store starts at
   Begin Game (or when the box is opened, see tienda-overlay.js), fades
   at the end of a game (the music stops first, leaving the hum), and
   comes back with the next. */

import { quality } from "./tienda-quality.js";

export const hasAudio = true;

/* ------------------------------------------------------------ music data */

const CHORD = {
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], maj6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  maj9: [4, 7, 11, 14], m9: [3, 7, 10, 14], dom9: [4, 10, 14, 7],
};
// [root in semitones above the key, chord type]; a bar each, or two to a
// bar where a bar is an array.
const TUNES = [
  {
    A: [[0, "maj7"], [9, "m7"], [2, "m7"], [7, "dom7"], [4, "m7"], [9, "dom7"], [2, "m7"], [7, "dom7"]],
    A2: [[0, "maj7"], [9, "m7"], [2, "m7"], [7, "dom7"], [5, "maj7"], [5, "m6"], [[2, "m7"], [7, "dom7"]], [0, "maj6"]],
    B: [[5, "maj7"], [5, "maj7"], [4, "m7"], [9, "dom7"], [2, "m7"], [2, "m9"], [7, "dom7"], [7, "dom9"]],
    lead: "vibes", tempo: 96, comp: [[0, 1.5], [2.5, 1]],
  },
  {
    A: [[2, "m7"], [7, "dom7"], [0, "maj7"], [0, "maj9"], [2, "m7"], [7, "dom7"], [0, "maj7"], [9, "dom7"]],
    A2: [[2, "m7"], [7, "dom7"], [4, "m7"], [9, "dom7"], [2, "m7"], [7, "dom7"], [0, "maj6"], [0, "maj6"]],
    B: [[7, "m7"], [0, "dom7"], [5, "maj7"], [5, "maj9"], [5, "m6"], [5, "m6"], [2, "m7"], [7, "dom7"]],
    lead: "flute", tempo: 92, comp: [[1, 1], [2.5, 1.5]],
  },
  {
    A: [[0, "maj7"], [5, "maj7"], [0, "maj7"], [5, "maj7"], [9, "m7"], [2, "dom7"], [2, "m7"], [7, "dom7"]],
    A2: [[0, "maj7"], [5, "maj7"], [4, "m7"], [9, "m7"], [2, "m7"], [7, "dom7"], [0, "maj9"], [0, "maj7"]],
    B: [[9, "m7"], [4, "dom7"], [9, "m7"], [4, "dom7"], [5, "maj7"], [5, "m6"], [2, "m7"], [7, "dom9"]],
    lead: "vibes", tempo: 100, comp: [[0, 1], [1.5, 1], [3, 0.8]],
  },
  {
    A: [[0, "maj6"], [2, "m7"], [4, "m7"], [2, "m7"], [0, "maj6"], [9, "m7"], [2, "m7"], [7, "dom7"]],
    A2: [[0, "maj6"], [2, "m7"], [4, "m7"], [9, "dom7"], [2, "m7"], [7, "dom7"], [0, "maj7"], [0, "maj6"]],
    B: [[5, "maj7"], [7, "dom7"], [4, "m7"], [9, "m7"], [2, "m7"], [7, "dom7"], [4, "m7"], [7, "dom9"]],
    lead: "flute", tempo: 88, comp: [[0.5, 1], [2, 1], [3.5, 0.5]],
  },
];
const KEYS = [53, 58, 51, 56, 48, 55, 50]; // F, Bb, Eb, Ab, C, G, D (the tonic, in the bass's octave + 12)
const SCALE = [0, 2, 4, 5, 7, 9, 11];
// Melody rhythms over two bars in eighth notes: [start, length].
const RHYTHMS = [
  [[0, 3], [3, 1], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 2], [2, 2], [4, 3], [7, 1], [8, 6], [14, 2]],
  [[1, 1], [2, 2], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4]],
  [[0, 4], [4, 2], [6, 2], [8, 8]],
  [[0, 1], [1, 1], [2, 2], [4, 4], [10, 2], [12, 4]],
];
const CADENCE = [[0, 2], [2, 2], [4, 4], [8, 8]];

function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* Builds one arrangement: every note with its start (in beats), length,
   instrument and level. */
function compose(tuneIndex, key, seed) {
  const T = TUNES[tuneIndex];
  const r = rngOf(seed);
  const bars = [];
  const pushSection = (sec, name) => sec.forEach((c) => bars.push({ chords: Array.isArray(c[0]) ? c : [c], section: name }));
  // Intro (the last four bars of A2), then A A2 B A2, and a two-bar tag.
  T.A2.slice(4).forEach((c) => bars.push({ chords: Array.isArray(c[0]) ? c : [c], section: "intro" }));
  pushSection(T.A, "A"); pushSection(T.A2, "A2"); pushSection(T.B, "B"); pushSection(T.A2, "A3");
  bars.push({ chords: [[0, "maj7"]], section: "tag" }, { chords: [[0, "maj7"]], section: "tag" });

  const notes = [];
  const chordNotes = (root, type) => CHORD[type].map((iv) => key + root + iv);
  // Voice leading for the strings and piano: each chord's inversion
  // closest to the last one's.
  let lastVoicing = null;
  const voice = (root, type, lo, hi) => {
    const pcs = CHORD[type].map((iv) => (((key + root + iv) % 12) + 12) % 12);
    let best = null, bestCost = Infinity, lowest = null;
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = pcs.slice(inv).concat(pcs.slice(0, inv));
      let n = lo;
      while (n % 12 !== order[0]) n++;
      const v = [n];
      for (let k = 1; k < order.length; k++) { let m = v[k - 1] + 1; while (m % 12 !== order[k]) m++; v.push(m); }
      if (!lowest || v[v.length - 1] < lowest[lowest.length - 1]) lowest = v;
      if (v[v.length - 1] > hi + 10) continue;
      const cost = lastVoicing ? v.reduce((sum, x, i) => sum + Math.abs(x - lastVoicing[i]), 0) : Math.abs(v[0] - lo - 3);
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
    // A wide chord that won't fit in the range any way up: its most
    // compact voicing, an octave down if it still sits too high.
    if (!best) best = lowest[lowest.length - 1] > hi + 10 ? lowest.map((x) => x - 12) : lowest;
    lastVoicing = best;
    return best;
  };

  // Melodies: one for A (reused, so the tune is recognisable to itself),
  // one for B. Two-bar phrases: strong beats land on chord tones, the rest
  // step through the scale.
  const scaleNotes = [];
  for (let m = key; m < key + 60; m++) if (SCALE.includes(((m - key) % 12 + 12) % 12)) scaleNotes.push(m);
  const lead = T.lead;
  const lo = lead === "vibes" ? 67 : 69, hi = lead === "vibes" ? 84 : 86;
  function melodyFor(sectionBars, mseed) {
    const mr = rngOf(mseed);
    const out = [];
    let prev = lo + 5 + Math.floor(mr() * 5);
    for (let b = 0; b < sectionBars.length; b += 2) {
      const last = b + 2 >= sectionBars.length;
      const rh = last ? CADENCE : RHYTHMS[Math.floor(mr() * RHYTHMS.length)];
      const up = mr() < 0.5 ? 1 : -1;
      rh.forEach(([st, len], i) => {
        const bar = b + Math.floor(st / 8);
        const barChords = sectionBars[Math.min(bar, sectionBars.length - 1)].chords;
        const within = (st % 8) / 8;
        const ch = barChords[within >= 0.5 && barChords.length > 1 ? 1 : 0];
        const tones = chordNotes(ch[0], ch[1]);
        const strong = st % 4 === 0 || (last && i === rh.length - 1);
        const aim = prev + (i < rh.length / 2 ? up : -up) * (1 + Math.floor(mr() * 2));
        let pick;
        if (strong) {
          let bestD = Infinity;
          for (let o = -24; o <= 24; o += 12) tones.forEach((t) => { const c = t + o; if (c >= lo && c <= hi && Math.abs(c - aim) < bestD) { bestD = Math.abs(c - aim); pick = c; } });
          if (last && i === rh.length - 1) { // end on the root or the third
            let bd = Infinity;
            for (let o = -24; o <= 24; o += 12) [tones[0], tones[1]].forEach((t) => { const c = t + o; if (c >= lo && c <= hi && Math.abs(c - prev) < bd) { bd = Math.abs(c - prev); pick = c; } });
          }
        } else {
          const idx = scaleNotes.findIndex((m) => m >= aim);
          pick = idx >= 0 ? scaleNotes[idx] : aim;
          while (pick < lo) pick += 12;
          while (pick > hi) pick -= 12;
        }
        if (pick == null) pick = prev;
        // Not the same note three times running.
        if (pick === prev && out.length > 1 && out[out.length - 2].m === prev) {
          const i2 = scaleNotes.indexOf(pick);
          if (i2 >= 0) pick = scaleNotes[i2 + (pick > (lo + hi) / 2 ? -1 : 1)] || pick;
        }
        out.push({ bar: b + Math.floor(st / 8), beat: (st % 8) / 2, len: len / 2 * 0.92, m: pick, v: strong ? 1 : 0.8 });
        prev = pick;
      });
    }
    return out;
  }
  const sectionsOf = (name) => bars.filter((x) => x.section === name);
  const melA = melodyFor(sectionsOf("A"), seed * 7 + 1);
  const melA2 = melodyFor(sectionsOf("A2"), seed * 7 + 1); // same seed: the tune returns
  const melB = melodyFor(sectionsOf("B"), seed * 7 + 5);

  let offsetBar = 0;
  const firstBar = (name) => bars.findIndex((x) => x.section === name);
  const addMelody = (mel, section, instr) => {
    const fb = firstBar(section);
    mel.forEach((n) => notes.push({ at: (fb + n.bar) * 4 + n.beat, len: n.len, m: n.m, instr, v: n.v }));
  };
  addMelody(melA, "A", lead);
  addMelody(melA2, "A2", lead);
  addMelody(melB, "B", lead === "vibes" ? "flute" : "vibes");
  addMelody(melA2, "A3", lead);

  // Accompaniment, bar by bar.
  bars.forEach((bar, bi) => {
    const t0 = bi * 4;
    const half = bar.chords.length > 1;
    bar.chords.forEach((ch, ci) => {
      const at = t0 + ci * 2, span = half ? 2 : 4;
      const v = voice(ch[0], ch[1], 55, 64);
      // Strings: held, swelling in; fuller in B and the tag.
      const sv = bar.section === "B" || bar.section === "tag" ? 0.9 : 0.62;
      v.forEach((m) => notes.push({ at, len: span * (bar.section === "tag" && bi === bars.length - 1 ? 2.4 : 1), m, instr: "strings", v: sv }));
      // Electric piano comping.
      if (bar.section !== "tag") T.comp.forEach(([b, l]) => { if (b < span) v.forEach((m) => notes.push({ at: at + b, len: l, m: m + 12, instr: "epiano", v: 0.5 + r() * 0.15 })); });
      else if (ci === 0) v.forEach((m, k) => notes.push({ at: at + k * 0.12, len: 6, m: m + 12, instr: "epiano", v: 0.55 }));
      // Bass: the root, the fifth, and now and then a step into the next chord.
      const root = key - 24 + ((ch[0] % 12) + 12) % 12;
      const r0 = root < 34 ? root + 12 : root;
      notes.push({ at, len: half ? 1.6 : 1.8, m: r0, instr: "bass", v: 1 });
      if (!half && bar.section !== "tag") {
        notes.push({ at: at + 2, len: 1.5, m: r0 + 7 > 52 ? r0 - 5 : r0 + 7, instr: "bass", v: 0.85 });
        const next = bars[bi + 1];
        if (next && r() < 0.4) {
          const nr = key - 24 + ((next.chords[0][0] % 12) + 12) % 12;
          notes.push({ at: at + 3.5, len: 0.45, m: (nr < 34 ? nr + 12 : nr) - 1, instr: "bass", v: 0.7 });
        }
      }
    });
    // Brushes and a soft kick, out for the intro's first bars and the tag.
    if (bar.section !== "tag" && !(bar.section === "intro" && bi < 2)) {
      for (let b = 0; b < 4; b++) {
        if (b % 2 === 1) notes.push({ at: t0 + b, len: 0.3, instr: "brush", v: 1 });
        if (b % 2 === 0) notes.push({ at: t0 + b, len: 0.2, instr: "kick", v: 0.7 });
        notes.push({ at: t0 + b + 0.5, len: 0.15, instr: "sweep", v: 0.6 });
      }
    }
  });
  notes.sort((a, b) => a.at - b.at);
  return { notes, beats: bars.length * 4, tempo: T.tempo };
}

/* ------------------------------------------------------------ the engine */

export function createAudio({ tapeUrl = null } = {}) {
  const q = quality();
  let ctx = null, master = null, comp = null;
  let storeBus = null, musicBus = null, ambBus = null, farBus = null, sfxBus = null;
  let bigVerb = null, smallVerb = null, wow = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, storeOn = false;
  let humGain = null, buzzGain = null, hvacGain = null;
  let schedTimer = null, eventTimer = null, windTimer = null;
  let zoom = 0.5, tension = 0;
  let playing = null; // what the ceiling speakers are on: "tape", "piece", or "wait-tape" (decoding)
  let piece = null, pieceStart = 0, nextIdx = 0, tuneNo = Math.floor(Math.random() * TUNES.length), keyNo = Math.floor(Math.random() * KEYS.length);

  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
      master.connect(comp).connect(ctx.destination);

      // Noise, white and brown.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const bd = brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }

      // The store's air: a long, dark tail (the sales floor), and a small
      // one (the table, the near shelves).
      const ir = (secs, dark, pre) => {
        const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
        const preN = Math.floor(ctx.sampleRate * pre);
        for (let ch = 0; ch < 2; ch++) {
          const d = b.getChannelData(ch);
          let lp = 0;
          for (let i = preN; i < len; i++) { lp = lp * dark + (Math.random() * 2 - 1) * (1 - dark); d[i] = lp * Math.pow(1 - (i - preN) / (len - preN), 2.2) * 2.2; }
        }
        return b;
      };
      bigVerb = ctx.createConvolver(); bigVerb.buffer = ir(q.tier === "low" ? 1.8 : 2.6, 0.72, 0.035);
      smallVerb = ctx.createConvolver(); smallVerb.buffer = ir(0.6, 0.35, 0.005);
      const bigOut = ctx.createGain(); bigOut.gain.value = 0.55;
      bigVerb.connect(bigOut).connect(master);
      const smallOut = ctx.createGain(); smallOut.gain.value = 0.35;
      smallVerb.connect(smallOut).connect(master);

      // Buses.
      storeBus = ctx.createGain(); storeBus.gain.value = 0; storeBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(storeBus);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.22; sfxBus.connect(sfxSend).connect(smallVerb);
      const sfxBig = ctx.createGain(); sfxBig.gain.value = 0.1; sfxBus.connect(sfxBig).connect(bigVerb);

      // Far-off things: muffled, mostly room.
      farBus = ctx.createGain(); farBus.gain.value = 1;
      const farLp = ctx.createBiquadFilter(); farLp.type = "lowpass"; farLp.frequency.value = 1900;
      const farDry = ctx.createGain(); farDry.gain.value = 0.22;
      const farWet = ctx.createGain(); farWet.gain.value = 0.9;
      farBus.connect(farLp); farLp.connect(farDry).connect(storeBus); farLp.connect(farWet).connect(bigVerb);

      // The ceiling speakers: thin (paper cones, no low end, rolled off
      // top), a slight crunch, several speakers at once down the aisle
      // (short delays), then the room.
      musicBus = ctx.createGain(); musicBus.gain.value = 0;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 210; hp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4300; lp.Q.value = 0.6;
      const cone = ctx.createBiquadFilter(); cone.type = "peaking"; cone.frequency.value = 1400; cone.Q.value = 0.9; cone.gain.value = 4;
      const shaper = ctx.createWaveShaper(); const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4); }
      shaper.curve = curve;
      const spk = ctx.createGain(); spk.gain.value = 1;
      musicBus.connect(hp).connect(lp).connect(cone).connect(shaper).connect(spk);
      const musicOut = ctx.createGain(); musicOut.gain.value = 0.8; spk.connect(musicOut).connect(storeBus);
      [0.013, 0.027, 0.041].forEach((d, i) => {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = d;
        const g = ctx.createGain(); g.gain.value = 0.26 - i * 0.06;
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { pan.pan.value = i % 2 ? 0.5 : -0.5; spk.connect(dl).connect(g).connect(pan).connect(storeBus); } else spk.connect(dl).connect(g).connect(storeBus);
      });
      const musicWet = ctx.createGain(); musicWet.gain.value = 0.7; spk.connect(musicWet).connect(bigVerb);

      // Tape wow: the music's oscillators all waver together, a little.
      wow = ctx.createGain(); wow.gain.value = 1;
      const w1 = ctx.createOscillator(), wg = ctx.createGain(); w1.frequency.value = 0.55; wg.gain.value = 5; w1.connect(wg).connect(wow); w1.start();
      const w2 = ctx.createOscillator(), wg2 = ctx.createGain(); w2.frequency.value = 5.8; wg2.gain.value = 1.2; w2.connect(wg2).connect(wow); w2.start();
    } catch (e) {
      ctx = null;
    }
  }
  const now = () => ctx.currentTime + 0.01;
  function ensureStarted() {
    ensureGraph();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  function ramp(param, v, secs) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + Math.max(0.01, secs));
  }
  function noise(t0, dur, brown = false) {
    const s = ctx.createBufferSource();
    s.buffer = brown ? brownBuf : noiseBuf; s.loop = true;
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
    return s;
  }
  const pitched = (o) => { if (wow) wow.connect(o.detune); return o; };
  const panner = (v) => { if (!ctx.createStereoPanner) return ctx.createGain(); const p = ctx.createStereoPanner(); p.pan.value = v; return p; };

  /* ---------------- the store: hum, air, far-off things ---------------- */

  function startAmbience() {
    const t = now();
    // Fluorescent hum: 120 Hz and harmonics, and the ballasts' buzz.
    humGain = ctx.createGain(); humGain.gain.value = 0;
    humGain.connect(ambBus);
    [[120, 0.0055], [240, 0.0032], [360, 0.0016], [480, 0.0008]].forEach(([f, a]) => {
      const o = ctx.createOscillator(); o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002);
      const g = ctx.createGain(); g.gain.value = a;
      o.connect(g).connect(humGain); o.start(t);
    });
    const wobble = ctx.createOscillator(), wg = ctx.createGain(); wobble.frequency.value = 0.13; wg.gain.value = 0.18;
    wobble.connect(wg).connect(humGain.gain); wobble.start(t);
    buzzGain = ctx.createGain(); buzzGain.gain.value = 0.0007;
    const saw = ctx.createOscillator(); saw.type = "sawtooth"; saw.frequency.value = 120;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 2.5;
    saw.connect(bp).connect(buzzGain).connect(humGain); saw.start(t);
    humGain.gain.setValueAtTime(0, t); humGain.gain.linearRampToValueAtTime(1, t + 2.5);
    // Air handling: a low rumble and a little hiss from the vents.
    hvacGain = ctx.createGain(); hvacGain.gain.value = 0;
    const rum = noise(t, 1e6, true);
    const rlp = ctx.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 320;
    const rg = ctx.createGain(); rg.gain.value = 0.05;
    rum.connect(rlp).connect(rg).connect(hvacGain);
    const hiss = noise(t, 1e6);
    const hbp = ctx.createBiquadFilter(); hbp.type = "bandpass"; hbp.frequency.value = 1300; hbp.Q.value = 0.5;
    const hg = ctx.createGain(); hg.gain.value = 0.0045;
    hiss.connect(hbp).connect(hg).connect(hvacGain);
    hvacGain.connect(ambBus);
    hvacGain.gain.setValueAtTime(0, t); hvacGain.gain.linearRampToValueAtTime(1, t + 4);
    scheduleEvent(12000 + Math.random() * 10000);
  }

  // Something happens somewhere in the store, now and then.
  function scheduleEvent(ms) {
    clearTimeout(eventTimer);
    eventTimer = setTimeout(() => {
      if (!ctx || !storeOn) return;
      if (!muted && document.visibilityState === "visible") {
        const r = Math.random();
        if (r < 0.26) farCart();
        else if (r < 0.46) farRegister();
        else if (r < 0.64) farSteps();
        else if (r < 0.76) farPhone();
        else if (r < 0.9) paAnnouncement();
        else farDoor();
      }
      scheduleEvent(24000 + Math.random() * 38000);
    }, ms);
  }
  function farCart() {
    const t = now(), dur = 3 + Math.random() * 3;
    const pan = panner(Math.random() * 1.6 - 0.8);
    pan.connect(farBus);
    const env = ctx.createGain(); env.gain.value = 0;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + dur * 0.35); env.gain.linearRampToValueAtTime(0, t + dur);
    env.connect(pan);
    // Wheels: a rattle at the wheel's click rate, and the rumble.
    const n = noise(t, dur), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 1.2;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = 8 + Math.random() * 4;
    const lg = ctx.createGain(); lg.gain.value = 0.06; lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + dur);
    n.connect(bp).connect(am).connect(env);
    const rb = noise(t, dur, true), rlp = ctx.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 220;
    const rg = ctx.createGain(); rg.gain.value = 0.6; rb.connect(rlp).connect(rg).connect(env);
  }
  function tick(t, f, level, dest, decay = 0.03) {
    const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = f * 1.5; f1.Q.value = 3;
    o.connect(f1).connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.02);
  }
  function bell(t, f, level, dest, decay = 1.4) {
    [[1, 1], [2.76, 0.4], [5.4, 0.18]].forEach(([k, a]) => {
      const o = ctx.createOscillator(); o.frequency.value = f * k;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + decay / k);
      o.connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.1);
    });
  }
  function farRegister() {
    const t0 = now();
    const pan = panner(Math.random() * 1.2 - 0.6); pan.connect(farBus);
    // Keys going down, then the bell, then the drawer.
    const keys = 5 + Math.floor(Math.random() * 4);
    let t = t0;
    for (let i = 0; i < keys; i++) { tick(t, 900 + Math.random() * 300, 0.18, pan); t += 0.16 + Math.random() * 0.18; }
    t += 0.25;
    bell(t, 2630, 0.12, pan, 1.6);
    const d = noise(t + 0.08, 0.35), dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 900;
    const dg = ctx.createGain(); dg.gain.setValueAtTime(0.3, t + 0.08); dg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    d.connect(dlp).connect(dg).connect(pan);
  }
  function farSteps() {
    const pan = panner(Math.random() * 1.4 - 0.7); pan.connect(farBus);
    let t = now();
    const n = 4 + Math.floor(Math.random() * 6), gap = 0.52 + Math.random() * 0.12;
    for (let i = 0; i < n; i++) {
      const k = 0.5 + 0.5 * Math.sin((i / (n - 1)) * Math.PI);
      const s = noise(t, 0.08), hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = 1800; hp.Q.value = 1.4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.2 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      s.connect(hp).connect(g).connect(pan);
      t += gap;
    }
  }
  function farPhone() {
    // The service desk telephone: a bell rung by its striker, two
    // seconds on and four off, until somebody gets it (or doesn't).
    const pan = panner(-0.3 + Math.random() * 0.6); pan.connect(farBus);
    const rings = 2 + Math.floor(Math.random() * 3);
    for (let r = 0; r < rings; r++) {
      const t = now() + r * 6;
      [1040, 1320].forEach((f) => {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0;
        const am = ctx.createOscillator(); am.type = "square"; am.frequency.value = 20;
        const ag = ctx.createGain(); ag.gain.value = 0.02;
        am.connect(ag).connect(g.gain);
        g.gain.setValueAtTime(0.02, t); g.gain.setValueAtTime(0, t + 2);
        o.connect(g).connect(pan); o.start(t); o.stop(t + 2.1); am.start(t); am.stop(t + 2.1);
      });
    }
  }
  function farDoor() {
    const pan = panner(Math.random() * 1.2 - 0.6); pan.connect(farBus);
    const t = now();
    const n = noise(t, 0.25, true), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(lp).connect(g).connect(pan);
    tick(t + 0.05, 1500, 0.12, pan, 0.02);
  }
  // The public-address chime, and a voice you can't quite make out.
  function paAnnouncement(closing = false) {
    const t0 = now();
    const pa = ctx.createGain(); pa.gain.value = 1;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 0.7;
    pa.connect(bp).connect(farBus);
    bell(t0, 783.99, 0.1, pa, 1.8); // G
    bell(t0 + 0.62, 622.25, 0.1, pa, 2.2); // E-flat
    // The voice: a buzz through three moving formants, in syllables.
    const t1 = t0 + 1.8, dur = closing ? 4.5 : 3.2 + Math.random() * 1.6;
    const src = ctx.createOscillator(); src.type = "sawtooth";
    const f0 = 118 + Math.random() * 20;
    src.frequency.setValueAtTime(f0, t1);
    const env = ctx.createGain(); env.gain.value = 0;
    const formants = [ctx.createBiquadFilter(), ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    const sum = ctx.createGain(); sum.gain.value = 0.9;
    formants.forEach((f, i) => { f.type = "bandpass"; f.Q.value = 7 + i * 3; src.connect(f).connect(sum); });
    sum.connect(env).connect(pa);
    const VOW = [[700, 1200, 2600], [400, 2000, 2600], [500, 900, 2400], [300, 870, 2240], [600, 1700, 2500]];
    let t = t1;
    while (t < t1 + dur) {
      const syl = 0.11 + Math.random() * 0.13, v = VOW[Math.floor(Math.random() * VOW.length)];
      formants.forEach((f, i) => f.frequency.setTargetAtTime(v[i], t, 0.02));
      src.frequency.setTargetAtTime(f0 * (0.9 + Math.random() * 0.25), t, 0.05);
      env.gain.setTargetAtTime(0.5 + Math.random() * 0.3, t, 0.015);
      env.gain.setTargetAtTime(0.05, t + syl * 0.75, 0.02);
      t += syl + (Math.random() < 0.18 ? 0.25 : 0.02);
    }
    env.gain.setTargetAtTime(0, t, 0.05);
    src.start(t1); src.stop(t + 0.3);
  }

  /* ---------------- the music ---------------- */

  function voiceNote(n, t, secPerBeat) {
    const dur = n.len * secPerBeat;
    const dest = musicBus;
    if (n.instr === "vibes") {
      // Struck bar and resonator; the motor's tremolo.
      const f = mtof(n.m), g = ctx.createGain(), trem = ctx.createGain();
      trem.gain.value = 0.75;
      const tl = ctx.createOscillator(), tg = ctx.createGain(); tl.frequency.value = 5.2; tg.gain.value = 0.25; tl.connect(tg).connect(trem.gain);
      [[1, 1], [4, 0.14], [10.1, 0.04]].forEach(([k, a]) => {
        const o = pitched(ctx.createOscillator()); o.frequency.value = f * k;
        const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.085 * a * n.v, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.6, dur * 1.8) / k);
        o.connect(og).connect(g); o.start(t); o.stop(t + dur * 1.8 + 0.1);
      });
      g.connect(trem).connect(dest); tl.start(t); tl.stop(t + dur * 1.8 + 0.1);
    } else if (n.instr === "flute") {
      const f = mtof(n.m);
      const o = pitched(ctx.createOscillator()); o.type = "triangle"; o.frequency.value = f;
      const o2 = pitched(ctx.createOscillator()); o2.frequency.value = f * 2;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = f * 0.006;
      vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * n.v, t + 0.07); g.gain.setValueAtTime(0.05 * n.v, t + Math.max(0.08, dur - 0.08)); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
      const g2 = ctx.createGain(); g2.gain.value = 0.18;
      const br = noise(t, dur), bbp = ctx.createBiquadFilter(); bbp.type = "bandpass"; bbp.frequency.value = f * 2; bbp.Q.value = 2;
      const bg = ctx.createGain(); bg.gain.value = 0.012 * n.v;
      o.connect(g); o2.connect(g2).connect(g); br.connect(bbp).connect(bg).connect(g);
      g.connect(dest);
      [o, o2, vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); });
    } else if (n.instr === "epiano") {
      // A tine piano: sine carrier, a sine modulator at the same pitch
      // whose depth falls away quickly.
      const f = mtof(n.m);
      const c = pitched(ctx.createOscillator()), m = pitched(ctx.createOscillator()), mg = ctx.createGain();
      c.frequency.value = f; m.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.3, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.3);
      m.connect(mg).connect(c.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022 * n.v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.009 * n.v, t + 0.6); g.gain.setTargetAtTime(0, t + dur, 0.12);
      c.connect(g).connect(dest);
      [c, m].forEach((x) => { x.start(t); x.stop(t + dur + 0.7); });
    } else if (n.instr === "strings") {
      const f = mtof(n.m), g = ctx.createGain();
      const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 1700; lpf.Q.value = 0.4;
      [-6, 0, 7].forEach((det) => {
        const o = pitched(ctx.createOscillator()); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
        o.connect(lpf); o.start(t); o.stop(t + dur + 1.3);
      });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.0085 * n.v, t + 0.45); g.gain.setValueAtTime(0.0085 * n.v, t + Math.max(0.5, dur - 0.1)); g.gain.linearRampToValueAtTime(0, t + dur + 1.1);
      lpf.connect(g).connect(dest);
    } else if (n.instr === "bass") {
      const f = mtof(n.m);
      const o = pitched(ctx.createOscillator()); o.type = "triangle"; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.frequency.value = f;
      const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.setValueAtTime(900, t); lpf.frequency.exponentialRampToValueAtTime(380, t + 0.25);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * n.v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.04 * n.v, t + 0.4); g.gain.setTargetAtTime(0, t + dur, 0.06);
      o.connect(lpf); o2.connect(lpf); lpf.connect(g).connect(dest);
      [o, o2].forEach((x) => { x.start(t); x.stop(t + dur + 0.4); });
    } else if (n.instr === "brush" || n.instr === "sweep") {
      const brush = n.instr === "brush";
      const s = noise(t, 0.35), bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = brush ? 4200 : 6500; bpf.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((brush ? 0.03 : 0.008) * n.v, t + (brush ? 0.03 : 0.05)); g.gain.exponentialRampToValueAtTime(0.0005, t + (brush ? 0.28 : 0.14));
      s.connect(bpf).connect(g).connect(dest);
    } else if (n.instr === "kick") {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.09 * n.v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
      o.connect(g).connect(dest); o.start(t); o.stop(t + 0.25);
    }
  }

  function nextPiece(startAt) {
    tuneNo = (tuneNo + 1 + Math.floor(Math.random() * (TUNES.length - 1))) % TUNES.length;
    keyNo = (keyNo + 2 + Math.floor(Math.random() * 3)) % KEYS.length;
    piece = compose(tuneNo, KEYS[keyNo], Math.floor(Math.random() * 1e6));
    piece.gap = 3.5 + Math.random() * 3;
    pieceStart = startAt;
    nextIdx = 0;
    playing = "piece";
  }

  /* ---------------- the tape ---------------- */
  // A real recording of the time (assets/tienda/muzak-1974.mp3), played
  // the way the store would have had it: off a tape machine running a
  // little slow and wavering, through the same ceiling speakers, and
  // heard as if from across the empty sales floor (darker, and more of
  // the room than the speaker). It takes turns with the arrangements
  // written above, and picks up where it left off after a game.
  // Decoded once, when the store's sound first starts; if the file can't
  // be had (the page opened on its own, offline), the arrangements play.
  const TAPE_RATE = 0.94;   // about a semitone flat, a touch slow
  const TAPE_LEVEL = 0.21;  // a little under the arrangements (measured through the chain)
  // Opened straight from disk, the browser won't fetch a file beside the
  // page at all: don't try (it would only log an error).
  let tape = tapeUrl && typeof location !== "undefined" && location.protocol === "file:" ? { failed: true } : null; // { buffer } once decoded, { failed } if it can't be
  let tapeLoading = false, tapeIn = null, tapeRate = null, tapeSrc = null;
  let tapePos = 0, tapeOffset = 0, tapeStartedAt = 0, tapeEndsAt = 0, tapeGap = 5, tapeWaitUntil = 0;
  function tapeBytes(url) {
    if (!/^data:/.test(url)) return fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    const bin = atob(url.slice(url.indexOf(",") + 1)), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return Promise.resolve(out.buffer);
  }
  // The file is fetched a little after the page has drawn (not at all on
  // a connection asking to save data, until the store's sound starts),
  // and decoded when it's first wanted.
  let tapeFetch = null;
  const fetchTape = () => tapeFetch || (tapeFetch = tapeBytes(tapeUrl));
  if (tapeUrl && !tape && typeof window !== "undefined") {
    const conn = window.navigator && window.navigator.connection;
    if (!(conn && conn.saveData)) setTimeout(() => { fetchTape().catch(() => {}); }, 2500);
  }
  function loadTape() {
    if (tape || tapeLoading || !tapeUrl || !ctx) return;
    tapeLoading = true;
    fetchTape()
      .then((bytes) => new Promise((res, rej) => ctx.decodeAudioData(bytes.slice(0), res, rej)))
      .then((buffer) => { tape = { buffer }; })
      .catch(() => { tape = { failed: true }; })
      .then(() => { tapeLoading = false; });
  }
  function tapeGraph() {
    if (tapeIn) return;
    tapeIn = ctx.createGain(); tapeIn.gain.value = 0;
    const dark = ctx.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 3100; dark.Q.value = 0.5;
    tapeIn.connect(dark).connect(musicBus);
    // More of the room: an extra send to the sales floor's long tail.
    const far = ctx.createGain(); far.gain.value = 0.6;
    dark.connect(far).connect(bigVerb);
    // The capstan's wow and flutter, from the same slow wobble as the
    // arrangements (it's in cents; here it bends the tape's speed).
    tapeRate = ctx.createGain(); tapeRate.gain.value = TAPE_RATE * 0.000578 * 1.6;
    if (wow) wow.connect(tapeRate);
  }
  function startTape(at) {
    tapeGraph();
    const src = ctx.createBufferSource();
    src.buffer = tape.buffer;
    src.playbackRate.value = TAPE_RATE;
    tapeRate.connect(src.playbackRate);
    src.connect(tapeIn);
    src.onended = () => { try { tapeRate.disconnect(src.playbackRate); src.disconnect(); } catch (e) { /* gone */ } };
    tapeOffset = tapePos < tape.buffer.duration - 8 ? tapePos : 0;
    src.start(at, tapeOffset);
    tapeIn.gain.cancelScheduledValues(at);
    tapeIn.gain.setValueAtTime(0, at);
    tapeIn.gain.linearRampToValueAtTime(TAPE_LEVEL, at + (tapeOffset > 0 ? 1.5 : 0.05));
    tapeSrc = src; tapeStartedAt = at;
    tapeEndsAt = at + (tape.buffer.duration - tapeOffset) / TAPE_RATE;
    tapeGap = 4 + Math.random() * 3;
    playing = "tape";
  }
  function stopTape(secs) {
    if (!tapeSrc) return;
    const t = ctx.currentTime;
    tapePos = t >= tapeEndsAt ? 0 : tapeOffset + Math.max(0, t - tapeStartedAt) * TAPE_RATE;
    ramp(tapeIn.gain, 0, secs);
    try { tapeSrc.stop(t + secs + 0.05); } catch (e) { /* already stopped */ }
    tapeSrc = null;
  }
  const tapeReady = () => !!(tape && tape.buffer) && !(typeof window !== "undefined" && window.__TIENDA_MUSIC_ONLY__ === "arrangements");

  function schedule() {
    if (!ctx) return;
    if (playing === "wait-tape") {
      // The first time, give the tape a moment to decode.
      if (tapeReady()) startTape(ctx.currentTime + 0.3);
      else if ((tape && tape.failed) || !tapeUrl || ctx.currentTime > tapeWaitUntil) nextPiece(ctx.currentTime + 0.3);
      return;
    }
    if (playing === "tape") {
      if (ctx.currentTime > tapeEndsAt + tapeGap) {
        tapeSrc = null; tapePos = 0;
        if (typeof window !== "undefined" && window.__TIENDA_MUSIC_ONLY__ === "tape") startTape(ctx.currentTime + 0.3);
        else nextPiece(ctx.currentTime + 0.3);
      }
      return;
    }
    if (!piece) return;
    const spb = 60 / piece.tempo;
    const horizon = ctx.currentTime + 0.4;
    while (nextIdx < piece.notes.length) {
      const n = piece.notes[nextIdx];
      const t = pieceStart + n.at * spb;
      if (t > horizon) break;
      if (t > ctx.currentTime - 0.05) voiceNote(n, Math.max(t, ctx.currentTime + 0.005), spb);
      nextIdx++;
    }
    // A pause between arrangements, then the tape again, or the next one.
    if (nextIdx >= piece.notes.length && ctx.currentTime > pieceStart + piece.beats * spb + piece.gap) {
      if (tapeReady()) { piece = null; startTape(ctx.currentTime + 0.3); } else nextPiece(ctx.currentTime + 0.3);
    }
  }
  function startMusic() {
    if (typeof window !== "undefined" && window.__TIENDA_MUSIC_ONLY__ === "none") return; // tests: the store without music
    loadTape();
    // Back before the fade had finished (an undo at the end of a game):
    // the tape's still running, so just bring it up again.
    if (playing === "tape" && tapeSrc) ramp(tapeIn.gain, TAPE_LEVEL, 1.5);
    if (!playing) {
      if (tapeUrl && !(tape && tape.failed) && !(typeof window !== "undefined" && window.__TIENDA_MUSIC_ONLY__ === "arrangements")) { playing = "wait-tape"; tapeWaitUntil = ctx.currentTime + 8; }
      else nextPiece(ctx.currentTime + 1.2);
    }
    clearInterval(schedTimer);
    schedTimer = setInterval(schedule, 90);
    ramp(musicBus.gain, 1, 3);
  }
  function stopMusic(secs) {
    if (!ctx) return;
    ramp(musicBus.gain, 0, secs);
    if (tapeIn) ramp(tapeIn.gain, 0, secs);
    const id = schedTimer;
    setTimeout(() => {
      if (schedTimer !== id) return;
      clearInterval(schedTimer); schedTimer = null; piece = null;
      stopTape(0.05);
      playing = null;
    }, secs * 1000 + 200);
  }

  function startStore() {
    ensureStarted();
    if (!ctx) return;
    if (!storeOn) {
      storeOn = true;
      startAmbience();
    }
    ramp(storeBus.gain, zoomLevel(), 2.5);
    startMusic();
  }
  const zoomLevel = () => 0.85 + 0.15 * (1 - zoom);

  /* ---------------- the game's own sounds ---------------- */

  // A hardwood block struck: a few close modes, short, and a knock of
  // the hollow board (and the table under it) below.
  function woodHit(t, { size = 1, level = 0.12, bright = 1, board = 1 } = {}) {
    const base = 1650 / Math.sqrt(size) * bright;
    [[1, 1, 0.05], [1.58, 0.55, 0.035], [2.43, 0.3, 0.022], [3.6, 0.15, 0.015]].forEach(([k, a, d]) => {
      const o = ctx.createOscillator(); o.frequency.value = base * k * (1 + (Math.random() - 0.5) * 0.03);
      const g = ctx.createGain(); g.gain.setValueAtTime(level * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * (0.8 + size * 0.15));
      o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.2);
    });
    // The contact click.
    const c = noise(t, 0.02), chp = ctx.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 2500;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(level * 0.6, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(chp).connect(cg).connect(sfxBus);
    if (board > 0) {
      // The folding board: a hollow, boxy knock; the table, a low thud.
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(230 / Math.sqrt(size * 0.6 + 0.4), t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(level * 0.9 * board, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.15);
      const th = ctx.createOscillator(); th.frequency.setValueAtTime(90, t); th.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      const tg = ctx.createGain(); tg.gain.setValueAtTime(level * 0.7 * board * Math.min(1.6, size * 0.5), t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      th.connect(tg).connect(sfxBus); th.start(t); th.stop(t + 0.18);
    }
  }
  function paper(t, dur, level, lo = 1500) {
    const n = noise(t, dur), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = lo * 2; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    // Crinkles: a flurry of small bursts inside the envelope.
    let tt = t;
    while (tt < t + dur) { g.gain.setValueAtTime(level * (0.3 + Math.random() * 0.7), tt); g.gain.setTargetAtTime(level * 0.1, tt + 0.004, 0.012); tt += 0.012 + Math.random() * 0.03; }
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    n.connect(bp).connect(g).connect(sfxBus);
  }
  function latch(t, level = 0.1) {
    tick(t, 3200, level, sfxBus, 0.018);
    bell(t + 0.005, 4200, level * 0.25, sfxBus, 0.18);
  }
  const mass = (v) => Math.max(1, Math.min(8, v || 1));

  /* ---------------- the flickering tube ---------------- */
  function playTubeFlicker(ms) {
    if (!ctx || !storeOn || !buzzGain) return;
    const t = now(), dur = ms / 1000;
    // The starter's tink, then the ballast buzzing in fits.
    tick(t, 5200, 0.02, farBus, 0.01);
    const g = buzzGain.gain;
    g.cancelScheduledValues(t);
    let tt = t;
    while (tt < t + dur) { g.setValueAtTime(0.0007 + Math.random() * 0.006, tt); tt += 0.03 + Math.random() * 0.09; }
    g.setValueAtTime(0.0007, t + dur);
  }

  const api = {
    ensureStarted,
    startStore,
    beginGameFadeIn() {
      windingDown = false;
      clearTimeout(windTimer);
      startStore();
    },
    setZoom(z) {
      zoom = z;
      if (ctx && storeOn && !windingDown) storeBus.gain.setTargetAtTime(zoomLevel(), ctx.currentTime, 0.4);
    },
    setMuted(m) {
      muted = m;
      if (ctx) ramp(master.gain, m ? 0 : 1, 0.15);
    },
    setTension(v) {
      tension = v;
      // A position that's getting tight makes the lights hum a little louder.
      if (ctx && humGain && !windingDown) humGain.gain.setTargetAtTime(1 + tension * 0.8, ctx.currentTime, 2);
    },
    // The end of a game: the tape runs out, and there's just the hum and
    // the air; a while later, the chime and an announcement.
    beginFadeOut(seconds) {
      if (windingDown) return;
      windingDown = true;
      if (!ctx) return;
      stopMusic(Math.max(1.5, seconds || 3));
      clearTimeout(windTimer);
      windTimer = setTimeout(() => { if (windingDown && storeOn && !muted) paAnnouncement(true); }, 7000 + Math.random() * 3000);
    },
    resetWindDown(restoreVolume) {
      if (!windingDown) return;
      windingDown = false;
      clearTimeout(windTimer);
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      if (restoreVolume === true) startStore();
    },
    playSelect() { ensureGraph(); if (!ctx) return; woodHit(now(), { size: 0.8, level: 0.07, bright: 1.15, board: 0.2 }); },
    playDeselect() { ensureGraph(); if (!ctx) return; woodHit(now(), { size: 0.9, level: 0.06, board: 0.5 }); },
    playBlocked() { ensureGraph(); if (!ctx) return; const t = now(); woodHit(t, { size: 1.6, level: 0.06, bright: 0.7, board: 0.6 }); woodHit(t + 0.11, { size: 1.8, level: 0.05, bright: 0.65, board: 0.6 }); },
    playRollStart(volumeUnits, durationMs) {
      ensureGraph(); if (!ctx) return;
      const m = mass(volumeUnits), t = now(), dur = Math.max(0.15, (durationMs || 350) / 1000);
      // The edge dragging over the lacquer as it tips.
      const n = noise(t, dur), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900 / Math.sqrt(m); bp.Q.value = 1.1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012 + m * 0.003, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      n.connect(bp).connect(g).connect(sfxBus);
    },
    playLanding(volumeUnits) {
      ensureGraph(); if (!ctx) return;
      const m = mass(volumeUnits);
      woodHit(now(), { size: m, level: 0.09 + 0.03 * Math.log2(m), bright: 1, board: 1 });
    },
    playCapture() {
      ensureGraph(); if (!ctx) return;
      const t = now();
      woodHit(t, { size: 4, level: 0.2, board: 1.4 });
      // The crushed piece knocked over: a few small bounces.
      [0.09, 0.2, 0.28, 0.34].forEach((d, i) => woodHit(t + d, { size: 0.9, level: 0.06 / (i + 1), bright: 1.2, board: 0.3 }));
    },
    playWin() {
      ensureStarted(); if (!ctx) return;
      const t = now();
      // A vibraphone rising through a major ninth, as the tape would end on.
      [60, 64, 67, 71, 74].forEach((m, i) => voiceNote({ instr: "vibes", m: m + 12, len: 3, v: 0.9 }, t + i * 0.16, 0.6));
      bell(t + 1.2, 1046.5, 0.035, sfxBus, 2.4);
    },
    playMenu() { ensureGraph(); if (!ctx) return; paper(now(), 0.25, 0.05); },
    fadeOutMenu() {}, stopMenu() {},
    playRulesOpen() { ensureGraph(); if (!ctx) return; const t = now(); paper(t, 0.32, 0.06); paper(t + 0.28, 0.2, 0.04, 1100); },
    playRulesClose() { ensureGraph(); if (!ctx) return; paper(now(), 0.24, 0.05, 1100); },
    playRulesTab() { ensureGraph(); if (!ctx) return; paper(now(), 0.14, 0.05, 1800); },
    // Begin Game: the board's latches, and the store comes up.
    playPowerOn() { ensureStarted(); if (!ctx) return; const t = now(); latch(t, 0.08); latch(t + 0.14, 0.07); woodHit(t + 0.32, { size: 3, level: 0.06, board: 1.2 }); },
    playPowerOff() { ensureGraph(); if (!ctx) return; const t = now(); woodHit(t, { size: 5, level: 0.07, bright: 0.6, board: 1 }); latch(t + 0.2, 0.06); },
    playDockOpen() { ensureGraph(); if (!ctx) return; paper(now(), 0.18, 0.035, 1300); },
    playDockClose() { ensureGraph(); if (!ctx) return; paper(now(), 0.14, 0.028, 1300); },
    playTubeFlicker,
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {}, playSingularityBell() {}, playSingularityDismiss() {},
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    // For tests: what's playing.
    debugState() {
      return {
        ctx: !!ctx, storeOn, windingDown, music: !!schedTimer, playing, tune: tuneNo, key: keyNo, notes: piece ? piece.notes.length : 0,
        tape: tape ? (tape.failed ? "failed" : "ready") : tapeLoading ? "loading" : "none",
        tapeTime: ctx && playing === "tape" ? tapeOffset + Math.max(0, ctx.currentTime - tapeStartedAt) * TAPE_RATE : tapePos,
        tapeLength: tape && tape.buffer ? tape.buffer.duration : 0,
      };
    },
    dispose() {
      clearInterval(schedTimer); clearTimeout(eventTimer); clearTimeout(windTimer);
      if (tapeSrc) { try { tapeSrc.stop(); } catch (e) { /* stopped */ } tapeSrc = null; }
      tape = null;
      if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } }
      ctx = null;
    },
  };
  // Tests read the sound's state (see tests/e2e-tienda.mjs).
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__TIENDA_AUDIO__ = () => api.debugState();
  return api;
}

// Exported for the offline check in tests (tests/tienda-music.smoke.mjs).
export { compose as composeArrangement, TUNES, KEYS };
