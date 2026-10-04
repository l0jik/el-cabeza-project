/* Parrish's sound: the terrace at the golden hour.

   Nature (user: the music will be the user's own recording, sent later;
   until then, the place itself): a soft breeze that comes and goes in
   gusts, leaves stirring now and then, the still pool lapping at its
   rim with the odd drop, birds (songbirds' short phrases, swallows'
   twitter, a dove's coo from the trees below, each from somewhere of its
   own left or right, the far ones softer and duller), and as the light
   goes a few crickets.

   The pieces are the wooden set's own knocks (wood-sfx.js), on a solid
   board (the folding board flat on its marble plinth).

   The music: MUSIC_URL, a file beside the page, once the user's
   recording is here. With none, there's no music channel at all (no
   slider that does nothing); with one, it plays from Begin Game, looped,
   on its own channel.

   Every sound is made here (no recordings yet), and all of it is kept
   low: it's a place to sit, not a soundtrack. */

import { createWoodSfx } from "./wood-sfx.js";

export const hasAudio = true;

// The user's recording, when it comes: e.g. "el-cabeza-parrish-music.mp3"
// (beside the page; build/build.js copies it there).
export const MUSIC_URL = null;

export function createAudio() {
  let ctx = null, master = null, vol = null, wood = null, noiseBuf = null, verb = null;
  const gates = {}, chLevel = { nature: 1, pieces: 1, music: 1 };
  let muted = false, natureOn = false, disposed = false, windingDown = false;
  let natureBus = null, gust = null;
  const timers = new Set();
  let music = null;

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

  /* ---- the pool ---- */
  function lap() {
    const t = now(), dur = 0.35 + Math.random() * 0.5;
    const n = noise(t, dur);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 500 + Math.random() * 400; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.01, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g);
    place(g, Math.random() * 0.8 - 0.4, 0.05);
    // Now and then a drop.
    if (Math.random() < 0.3) {
      const o = ctx.createOscillator(), og = ctx.createGain(), t2 = t + dur * 0.5;
      o.frequency.setValueAtTime(1500 + Math.random() * 600, t2); o.frequency.exponentialRampToValueAtTime(700, t2 + 0.06);
      og.gain.setValueAtTime(0.0001, t2); og.gain.linearRampToValueAtTime(0.01, t2 + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.08);
      o.connect(og); place(og, Math.random() * 0.6 - 0.3, 0.1);
      o.start(t2); o.stop(t2 + 0.1);
    }
    later(1500 + Math.random() * 3200, lap);
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
    // A dove, low and slow, from the trees below: coo, COO-oo, coo.
    (t, out) => {
      const f = 470 + Math.random() * 60;
      [[0, 0.32, 1, 0.92], [0.5, 0.55, 1.06, 0.94], [1.2, 0.3, 1, 0.93]].forEach(([d, dur, a, b]) => note(t + d, f * a, f * b, dur, 0.05, out));
    },
  ];
  function bird() {
    const t = now();
    const kind = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2;
    const out = ctx.createGain(); out.gain.value = 1;
    place(out, Math.random() * 1.8 - 0.9, kind === 2 ? 0.55 : Math.random() * 0.7);
    SONGS[kind](t, out);
    // Sometimes the same bird again, a moment later.
    if (Math.random() < 0.35) later(500 + Math.random() * 900, () => { const o2 = ctx.createGain(); place(o2, Math.random() * 1.8 - 0.9, 0.4); SONGS[kind](now(), o2); });
    later(2600 + Math.random() * 7000, bird);
  }

  /* ---- crickets, as the light goes ---- */
  function crickets() {
    const t = now(), f = 4300 + Math.random() * 400, out = ctx.createGain();
    out.gain.value = 1;
    place(out, Math.random() * 1.4 - 0.7, 0.5 + Math.random() * 0.3);
    for (let c = 0; c < 6; c++) for (let p = 0; p < 3; p++) note(t + c * 0.55 + p * 0.022, f, f, 0.014, 0.006, out);
    later(6000 + Math.random() * 12000, crickets);
  }

  function startNature() {
    if (!ctx || natureOn) return;
    natureOn = true;
    natureBus.gain.setTargetAtTime(windingDown ? 0.5 : 1, now(), 1.2);
    startBreeze();
    later(800, leaves);
    later(400, lap);
    later(1200, bird);
    later(20000, crickets);
  }

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

  return {
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
    playSelect: cue(() => wood.select()),
    playDeselect: cue(() => wood.deselect()),
    playBlocked: cue(() => wood.blocked()),
    playRollStart: cue((units, durationMs) => wood.rollStart(units, durationMs)),
    playLanding: cue((units, contact) => wood.landing(units, contact)),
    playCapture: cue(() => wood.capture()),
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
    debugState() { return { ctx: !!ctx, ctxState: ctx ? ctx.state : null, natureOn, muted, levels: { ...chLevel }, music: !!MUSIC_URL }; },
    dispose() {
      disposed = true;
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (music) music.stopped = true;
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
}
