/* Parrish's sound: the sea round the pillar.

   Nature, until the user's own recording comes (MUSIC_URL): the sea's low
   swell, the surf breaking on the rocks and its foam hissing back, a
   breeze that comes and goes, gulls far off over the water, now and then
   a small bird. Each placed somewhere of its own, left or right, the far
   ones softer and duller.

   The pieces: the user's own recordings of instrumental stabs, cut into
   very small pieces (tools/parrish_stabs.py, one file beside the page,
   el-cabeza-parrish-stabs.mp3, fetched once): a lone note when a piece is
   picked up or put down, a scatter of bright ticks while it moves, a
   bass-weighted thump when it lands (lower the bigger the face it lands
   on), a full crash for a capture. Until the file's here (or if it
   can't be had) the wooden set's own knocks stand in (wood-sfx.js).

   The music: MUSIC_URL, a file beside the page, once the user's
   recording is here. With none, there's no music channel at all (no
   slider that does nothing); with one, it plays from Begin Game, looped,
   on its own channel.

   Every sound is made here, and all of it is kept low: it's a place to
   sit, not a soundtrack. */

import { createWoodSfx, landingSize } from "./wood-sfx.js";

export const hasAudio = true;

// The user's recording, when it comes: e.g. "el-cabeza-parrish-music.mp3"
// (beside the page; build/build.js copies it there).
export const MUSIC_URL = null;

// The slices of the stabs file: [start s, length s] (tools/parrish_stabs.py).
const STABS_URL = "el-cabeza-parrish-stabs.mp3";
const STABS = {
  noteD5: [0.1, 0.12], noteC4: [0.47, 0.12], noteCs5: [0.84, 0.11], noteD5b: [1.2, 0.11], noteF3: [1.56, 0.14], noteDs4: [1.95, 0.12],
  thump1: [2.32, 0.16], thump2: [2.73, 0.16], thump3: [3.14, 0.16], thump4: [3.55, 0.16],
  tick1: [3.96, 0.045], tick2: [4.255, 0.045], tick3: [4.55, 0.045], tick4: [4.845, 0.045], tick5: [5.14, 0.04],
  crash: [5.43, 0.42],
};
const THUMPS = ["thump1", "thump2", "thump3", "thump4"], TICKS = ["tick1", "tick2", "tick3", "tick4", "tick5"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createAudio() {
  let ctx = null, master = null, vol = null, wood = null, noiseBuf = null, verb = null;
  const gates = {}, chLevel = { nature: 1, pieces: 1, music: 1 };
  let muted = false, natureOn = false, disposed = false, windingDown = false;
  let natureBus = null, gust = null;
  const timers = new Set();
  let music = null;
  // The stabs, once decoded: the buffer and each slice's real start.
  let stabs = null, stabsAsked = false, selects = 0;

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
  }

  function ensureGraph() {
    if (ctx || disposed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
      vol = ctx.createGain(); vol.gain.value = 1;
      master.connect(comp).connect(vol).connect(ctx.destination);
      ["nature", "pieces", "music"].forEach((k) => { const g = ctx.createGain(); g.gain.value = chLevel[k]; g.connect(master); gates[k] = g; });
      natureBus = ctx.createGain(); natureBus.gain.value = 0; natureBus.connect(gates.nature);
      // The open air: a short, soft, bright tail (there are no walls).
      verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1);
      }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      verb.connect(wet).connect(gates.nature);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      wood = createWoodSfx(ctx, gates.pieces, { board: "solid" });
      loadStabs();
    } catch (e) {
      ctx = null;
    }
  }
  const now = () => ctx.currentTime + 0.01;
  function noise(t, dur, loop = false) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = loop;
    s.start(t, Math.random() * 2);
    if (!loop) s.stop(t + dur + 0.05);
    return s;
  }
  // A sound placed somewhere: left/right, and how far (farther: softer,
  // duller, more of the air).
  function place(node, pan, far) {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 12000 - far * 8000;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = ctx.createGain(); g.gain.value = 1 - far * 0.65;
    node.connect(lp).connect(g);
    let out = g;
    if (p) { p.pan.value = pan; g.connect(p); out = p; }
    out.connect(natureBus);
    const s = ctx.createGain(); s.gain.value = 0.3 + far * 0.6; out.connect(s).connect(verb);
  }

  /* ---- the breeze ---- */
  function startBreeze() {
    const t = now();
    [-0.6, 0.6].forEach((pan) => {
      const n = noise(t, 0, true);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420 + Math.random() * 120; bp.Q.value = 0.45;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
      const g = ctx.createGain(); g.gain.value = 0.03;
      n.connect(bp).connect(lp).connect(g);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = pan; g.connect(p).connect(natureBus); } else g.connect(natureBus);
      (gust = gust || []).push({ g, bp });
    });
    const swell = () => {
      if (!ctx) return;
      const t2 = now(), dur = 2.5 + Math.random() * 4;
      gust.forEach(({ g, bp }) => {
        const level = 0.018 + Math.random() * Math.random() * 0.07;
        g.gain.setTargetAtTime(level, t2, dur / 3);
        bp.frequency.setTargetAtTime(360 + level * 4200 + Math.random() * 80, t2, dur / 3);
      });
      later(dur * 1000, swell);
    };
    swell();
  }

  /* ---- leaves ---- */
  function leaves() {
    const t = now(), dur = 0.8 + Math.random() * 1.6;
    const n = noise(t, dur);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400 + Math.random() * 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.016, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(hp).connect(g);
    place(g, Math.random() * 1.6 - 0.8, 0.3 + Math.random() * 0.5);
    later(3500 + Math.random() * 8000, leaves);
  }

  /* ---- the sea: its low swell, and the surf breaking on the rocks ---- */
  function seaBed() {
    const t = now();
    const n = noise(t, 0, true);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 340;
    const g = ctx.createGain(); g.gain.value = 0.02;
    n.connect(lp).connect(g).connect(natureBus);
    const breathe = () => {
      if (!ctx) return;
      const t2 = now(), dur = 4 + Math.random() * 4;
      g.gain.setTargetAtTime(0.014 + Math.random() * 0.016, t2, dur / 3);
      later(dur * 1000, breathe);
    };
    breathe();
  }
  function surf() {
    const t = now(), rise = 1.2 + Math.random() * 0.8, tail = 2.8 + Math.random() * 1.6, pan = Math.random() * 1.2 - 0.6;
    const n = noise(t, rise + tail + 0.3);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(2200, t + rise); lp.frequency.exponentialRampToValueAtTime(700, t + rise + tail);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 + Math.random() * 0.02, t + rise); g.gain.exponentialRampToValueAtTime(0.0001, t + rise + tail);
    n.connect(lp).connect(g);
    place(g, pan, 0.35);
    // The foam's hiss as it runs back.
    const n2 = noise(t + rise * 0.8, tail + 0.3);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2800;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + rise * 0.8); g2.gain.linearRampToValueAtTime(0.014, t + rise + 0.15); g2.gain.exponentialRampToValueAtTime(0.0001, t + rise + tail);
    n2.connect(hp).connect(g2);
    place(g2, pan * 0.8, 0.3);
    later(5500 + Math.random() * 6000, surf);
  }

  /* ---- birds ---- */
  function note(t, f0, f1, dur, level, out, vib = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 28 + Math.random() * 20; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.02);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.012, dur * 0.25));
    g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.18);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.1);
  }
  const SONGS = [
    // A songbird's phrase: a few clear notes, rising and falling.
    (t, out) => {
      const n = 3 + Math.floor(Math.random() * 4), base = 2300 + Math.random() * 900;
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = base * (1 + (Math.random() - 0.4) * 0.5), d = 0.06 + Math.random() * 0.1;
        note(tt, f, f * (Math.random() < 0.5 ? 1.25 : 0.8), d, 0.05, out, 40);
        tt += d + 0.03 + Math.random() * 0.06;
      }
    },
    // Swallows: a quick twitter, high.
    (t, out) => {
      const n = 5 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) { const f = 4200 + Math.random() * 1800; note(t + i * (0.045 + Math.random() * 0.03), f, f * 1.15, 0.03, 0.03, out); }
    },
    // A gull, far off over the water: a few falling cries.
    (t, out) => {
      const n = 2 + Math.floor(Math.random() * 3);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = 1450 + Math.random() * 350, d = 0.26 + Math.random() * 0.12;
        note(tt, f, f * 0.62, d, 0.026, out);
        note(tt, f * 2, f * 1.24, d, 0.009, out);
        tt += d + 0.12 + Math.random() * 0.2;
      }
    },
  ];
  function bird() {
    const t = now();
    const kind = Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 0 : 1;
    const out = ctx.createGain(); out.gain.value = 1;
    place(out, Math.random() * 1.8 - 0.9, kind === 2 ? 0.45 + Math.random() * 0.3 : Math.random() * 0.7);
    SONGS[kind](t, out);
    // Sometimes the same bird again, a moment later.
    if (Math.random() < 0.35) later(500 + Math.random() * 900, () => { const o2 = ctx.createGain(); place(o2, Math.random() * 1.8 - 0.9, 0.4); SONGS[kind](now(), o2); });
    later(2600 + Math.random() * 7000, bird);
  }

  function startNature() {
    if (!ctx || natureOn) return;
    natureOn = true;
    natureBus.gain.setTargetAtTime(windingDown ? 0.5 : 1, now(), 1.2);
    startBreeze();
    later(800, leaves);
    seaBed();
    later(400, surf);
    later(1200, bird);
      }

  /* ---- the pieces: the user's stabs, cut small ---- */
  function loadStabs() {
    if (stabsAsked || !ctx) return;
    stabsAsked = true;
    fetch(STABS_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (disposed) return;
      // Each slice's first sound, found in the decoded file itself (so an
      // encoder's delay at the head can't put the cuts off their attacks).
      const d = buf.getChannelData(0), sr = buf.sampleRate, at = {};
      Object.entries(STABS).forEach(([k, [s, len]]) => {
        let i = Math.max(0, Math.floor((s - 0.05) * sr));
        const end = Math.min(d.length, Math.floor((s + 0.05) * sr));
        while (i < end && Math.abs(d[i]) < 1e-3) i++;
        at[k] = [Math.max(0, i / sr - 0.001), len];
      });
      stabs = { buf, at };
    }).catch(() => { /* the wooden knocks stay */ });
  }
  // One slice, at t: its speed (and so its pitch), level, place, and how
  // much of its top is taken off.
  function stab(name, t, { rate = 1, level = 0.2, pan = 0, tone = 0 } = {}) {
    const [off, len] = stabs.at[name];
    const s = ctx.createBufferSource(); s.buffer = stabs.buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = level;
    let node = s;
    if (tone > 0) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = tone; node.connect(lp); node = lp; }
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g).connect(gates.pieces);
    s.start(t, off, len + 0.002);
  }
  const sfx = {
    select() { const t = now(); stab(selects++ % 2 ? "noteCs5" : "noteD5", t, { level: 0.2 }); },
    deselect() { stab("noteC4", now(), { level: 0.16, rate: 0.94 }); },
    blocked() { const t = now(); stab("noteF3", t, { level: 0.16, rate: 0.8, tone: 1400 }); stab("noteF3", t + 0.11, { level: 0.12, rate: 0.76, tone: 1200 }); },
    // On its way: bright ticks, a little lower for a heavier piece, at
    // the picture's own stop-motion beat (an eighth of a second).
    rollStart(units, durationMs) {
      const t = now(), dur = Math.max(0.15, (durationMs || 350) / 1000), m = Math.max(1, units || 1);
      const n = Math.max(2, Math.round(dur / 0.125) + 1);
      for (let i = 0; i < n; i++) {
        const tt = t + (i / (n - 1)) * (dur - 0.04);
        stab(pick(TICKS), tt, { level: (0.06 + 0.012 * Math.log2(m)) * (0.75 + 0.25 * Math.sin(Math.PI * i / (n - 1))), rate: (1.12 - 0.05 * Math.log2(m)) * (0.94 + Math.random() * 0.12), pan: (i % 2 ? 0.18 : -0.18) });
      }
    },
    // Weight in its loudness, the face it lands on in its pitch.
    landing(units, contact) {
      const m = Math.max(1, units || 1), size = landingSize(units, contact);
      if (typeof window !== "undefined" && Array.isArray(window.__EC_TEST_LANDINGS__)) window.__EC_TEST_LANDINGS__.push({ units, contact, size });
      stab(pick(THUMPS), now(), { level: 0.26 + 0.05 * Math.log2(m), rate: Math.max(0.6, Math.min(1.3, 1.25 / Math.pow(size, 0.22))) });
    },
    capture() {
      const t = now();
      stab("crash", t, { level: 0.34 });
      [0.1, 0.21, 0.29].forEach((d, i) => stab(pick(TICKS), t + d, { level: 0.07 / (i + 1), rate: 1.1 + i * 0.08, pan: i % 2 ? 0.25 : -0.25 }));
    },
  };
  // The stabs when they're here, the wooden knocks till then.
  const piece = (k) => (...args) => (stabs ? sfx[k](...args) : wood[k](...args));

  /* ---- the music (the user's recording, when it's here) ---- */
  function startMusic() {
    if (!MUSIC_URL || !ctx || music) return;
    music = { stopped: false };
    const m = music;
    fetch(MUSIC_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (m.stopped || disposed) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.setTargetAtTime(0.55, now(), 2);
      s.connect(g).connect(gates.music); s.start();
      m.src = s; m.g = g;
    }).catch(() => { /* no recording yet */ });
  }

  const cue = (fn) => (...args) => { ensureGraph(); if (wood) fn(...args); };

  const api = {
    ensureStarted() {
      ensureGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      startNature();
    },
    beginGameFadeIn() { windingDown = false; startNature(); startMusic(); if (ctx && natureBus) natureBus.gain.setTargetAtTime(1, now(), 1.2); },
    setZoom() {},
    setMuted(m) { muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.08); },
    setVolume(v) { if (ctx) vol.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now(), 0.05); },
    setChannelMuted(ch, off) { this.setChannelLevel(ch, off ? 0 : 1); },
    setChannelLevel(ch, v) {
      if (!(ch in chLevel)) return;
      chLevel[ch] = Math.max(0, Math.min(1, v));
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(chLevel[ch], now(), 0.04);
    },
    setTension() {},
    // The end of a game: the place quietens a little.
    beginFadeOut() { windingDown = true; if (ctx && natureBus) natureBus.gain.setTargetAtTime(0.5, now(), 1.5); },
    resetWindDown() { windingDown = false; if (ctx && natureBus) natureBus.gain.setTargetAtTime(1, now(), 0.8); },
    playSelect: cue(piece("select")),
    playDeselect: cue(piece("deselect")),
    playBlocked: cue(piece("blocked")),
    playRollStart: cue(piece("rollStart")),
    playLanding: cue(piece("landing")),
    playCapture: cue(piece("capture")),
    // A win: a harp's run, up through the scale's bright notes.
    playWin: cue(() => {
      const t = now();
      [587.33, 739.99, 880, 987.77, 1174.66, 1479.98].forEach((f, i) => {
        const tt = t + i * 0.09;
        [[1, 0.05, 1.6], [2, 0.012, 0.6], [3, 0.006, 0.3]].forEach(([k, lv, d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = f * k;
          g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(lv, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
          o.connect(g).connect(gates.pieces); o.start(tt); o.stop(tt + d + 0.05);
        });
      });
    }),
    playMenu() {}, fadeOutMenu() {}, stopMenu() {}, playRulesOpen() {}, playRulesClose() {}, playRulesTab() {}, playPowerOn() {},
    playPowerOff() {}, playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {},
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {}, playSingularityDismiss() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    playDockOpen() {}, playDockClose() {},
    // (Tests: what's running.)
    debugState() { return { ctx: !!ctx, ctxState: ctx ? ctx.state : null, natureOn, muted, levels: { ...chLevel }, music: !!MUSIC_URL, stabs: !!stabs }; },
    dispose() {
      disposed = true;
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (music) music.stopped = true;
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
  // (Tests: the sound itself, to drive and to listen to.)
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__PARRISH_AUDIO__ = api;
  return api;
}
