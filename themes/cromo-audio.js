/* Cromo's sound: dense metal and stone, kept quiet.

   Everything is synthesized. A piece landing is a struck block: a few
   inharmonic partials (the modes of a bar), each with its own decay, a
   short contact click, and a low thump for the heavier pieces. The
   partials depend on the board's stone: on TUNGSTEN they are a steel
   clank (many close, uneven partials like a plate's, all short, and a
   metallic scrape on the contact), on SHUNGITE short and dry, closer to
   a stone clack. A small, dry room adds a little space.

   (User: they sounded "too much like bells or chimes... metallic, but
   not so much reverb", and a bit quieter. Tungsten used to be a free
   bar's four sine modes ringing up to 5 s into a 1.6 s room: a bell.
   Now ~0.1-0.3 s decays, a 0.6 s room at under half the level, sends
   cut to about a third, and the cues a little quieter: rendered offline,
   a landing peaks ~4-5 dB lower and is silent (-40 dB) in 0.5 s, not 3.)

   The game's ambience is almost nothing: a low room tone, two drone
   partials beating slowly, and now and then a single far-off bowl
   strike deep in the reverb. It fades in at Begin Game and out at the
   end of a game, like Neon's, with the same wind-down contract the
   chassis expects (see beginFadeOut/resetWindDown). */

import { getStone } from "./cromo.js";

export const hasAudio = true;

const MODES = {
  // Steel plate: many close, uneven partials, all damped fast (a clank,
  // not a ring), and a metallic scrape on the contact.
  tungsten: { ratios: [1, 1.47, 2.09, 2.56, 3.39, 4.18, 5.43], decays: [0.2, 0.13, 0.1, 0.075, 0.055, 0.042, 0.032], amps: [1, 0.75, 0.62, 0.48, 0.36, 0.26, 0.18], click: 1, scrape: 0.62 },
  // Stone: denser, closer partials, heavily damped.
  shungite: { ratios: [1, 2.31, 3.87, 6.12], decays: [0.22, 0.1, 0.065, 0.04], amps: [1, 0.5, 0.32, 0.18], click: 0.9, scrape: 0 },
};

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, wet = null, rev = null, noiseBuf = null;
  let muted = false, windingDown = false, ambRunning = false;
  let bowlTimer = null, menuVoice = null;
  let zoom = 0.5;
  // The player's volume (the dock's fader), after everything else.
  let volume = 1, vol = null;
  let droneLp = null, ambGain = null;

  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
      vol = ctx.createGain(); vol.gain.value = volume;
      master.connect(comp).connect(vol).connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(master); // (30% down, user)
      intro = ctx.createGain(); intro.gain.value = 0; intro.connect(master);
      amb = ctx.createGain(); amb.gain.value = 1; amb.connect(intro);
      // A small, dry room: 0.6 s of darker filtered noise, dying fast
      // (was 1.6 s and bright, which rang every hit out like a chime).
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 0.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, 4.5); }
      }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.12;
      rev.connect(wet).connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
    }
  }

  function ensureStarted() {
    ensureGraph();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  const now = () => ctx.currentTime + 0.005;

  // Send a node to the dry bus and the room.
  function out(node, dry, send, bus = sfx) {
    const g1 = ctx.createGain(); g1.gain.value = dry; node.connect(g1).connect(bus);
    const g2 = ctx.createGain(); g2.gain.value = send; node.connect(g2).connect(rev);
  }
  function noise(t0, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur);
    return s;
  }

  /* One struck block. f0 in Hz; level is the peak of the fundamental. */
  function strike(t0, f0, level, opts = {}) {
    const m = MODES[opts.stone || getStone()] || MODES.tungsten;
    const sus = opts.sustain || 1;
    const sum = ctx.createGain(); sum.gain.value = 1;
    m.ratios.forEach((r, i) => {
      const f = f0 * r * (1 + (Math.random() - 0.5) * 0.004);
      if (f > 16000) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const a = level * m.amps[i], d = m.decays[i] * sus;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(a, t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.00005, t0 + d * 4);
      o.connect(g).connect(sum);
      o.start(t0); o.stop(t0 + d * 4 + 0.05);
    });
    out(sum, 1, opts.send != null ? opts.send : 0.15, opts.bus);
    // The metal in it: a narrow band of noise up among the partials,
    // gone in a few hundredths of a second (a scrape, not a tone).
    if (m.scrape) {
      const sc = noise(t0, 0.06), sbp = ctx.createBiquadFilter(), sg = ctx.createGain();
      sbp.type = "bandpass"; sbp.frequency.value = Math.min(11000, f0 * 3.3); sbp.Q.value = 7;
      sg.gain.setValueAtTime(level * m.scrape * 2.2, t0);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05 * sus + 0.01);
      sc.connect(sbp).connect(sg);
      out(sg, 1, 0.05, opts.bus);
    }
    // Contact click: a few ms of noise, band-passed high.
    const c = noise(t0, 0.012), bp = ctx.createBiquadFilter(), cg = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = Math.min(9000, f0 * 5.5); bp.Q.value = 1.4;
    cg.gain.setValueAtTime(level * 0.9 * m.click, t0);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
    c.connect(bp).connect(cg);
    out(cg, 1, 0.06, opts.bus);
  }
  // The low body of a heavy piece meeting the monolith.
  function thump(t0, f, level, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f * 1.5, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.04);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); out(g, 1, 0.12);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function airSlide(t0, dur, from, to, level) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(from, t0); bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + dur * 0.35); g.gain.linearRampToValueAtTime(0, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, 0.3);
  }

  /* ---- ambience ---- */
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.8 + 0.3 * zoom; ambGain.connect(amb);
    // Room tone: noise, low-passed hard.
    const rn = ctx.createBufferSource(); rn.buffer = noiseBuf; rn.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 170;
    const rg = ctx.createGain(); rg.gain.value = 0.02;
    rn.connect(lp).connect(rg).connect(ambGain); rn.start();
    // Two drone partials a hair apart, beating slowly, and an octave.
    droneLp = ctx.createBiquadFilter(); droneLp.type = "lowpass"; droneLp.frequency.value = 240;
    const dg = ctx.createGain(); dg.gain.value = 0.012;
    [[55, 1], [55.35, 1], [110.2, 0.35]].forEach(([f, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f; og.gain.value = a;
      o.connect(og).connect(droneLp); o.start();
    });
    droneLp.connect(dg).connect(ambGain);
    scheduleBowl();
  }
  // A single far bowl, now and then, almost all reverb.
  function scheduleBowl() {
    clearTimeout(bowlTimer);
    bowlTimer = setTimeout(() => {
      if (!ctx || windingDown) return;
      const notes = [110, 123.5, 146.8, 164.8];
      strike(now(), notes[Math.floor(Math.random() * notes.length)], 0.02, { stone: "tungsten", sustain: 3, send: 1.2, bus: amb });
      scheduleBowl();
    }, 22000 + Math.random() * 26000);
  }

  function beginGameFadeIn() {
    ensureStarted();
    if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0);
    master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0);
    intro.gain.setValueAtTime(0, t0);
    intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) {
    zoom = z;
    if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.8 + 0.3 * z, ctx.currentTime, 0.4);
  }
  function setTension(v) {
    if (droneLp && ctx) droneLp.frequency.setTargetAtTime(240 + 380 * v, ctx.currentTime, 1.2);
  }
  function setMuted(m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08);
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (vol && ctx) vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }
  function beginFadeOut(seconds) {
    if (windingDown) return;
    windingDown = true;
    clearTimeout(bowlTimer);
    if (!master || !ctx) return;
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0);
    master.gain.setValueAtTime(master.gain.value, t0);
    master.gain.linearRampToValueAtTime(0, t0 + (seconds || 3));
  }
  /* Same three callers as Neon's: true = straight back into play (an
     undone ending), "sfxOnly" = a fresh setup screen (UI sounds back,
     ambience silent until Begin Game), anything else = leave it. */
  function resetWindDown(restoreVolume) {
    if (!windingDown) return;
    windingDown = false;
    if (restoreVolume === true && ctx && ctx.state !== "running") { try { ctx.resume(); } catch (e) { /* closed */ } }
    if (master && ctx) {
      const t0 = ctx.currentTime;
      master.gain.cancelScheduledValues(t0);
      master.gain.setValueAtTime(master.gain.value, t0);
      if (restoreVolume === true) master.gain.linearRampToValueAtTime(muted ? 0 : 1, t0 + 0.6);
      else if (restoreVolume === "sfxOnly") {
        master.gain.setValueAtTime(muted ? 0 : 1, t0);
        intro.gain.cancelScheduledValues(t0);
        intro.gain.setValueAtTime(0, t0);
      }
    }
    if (ambRunning) scheduleBowl();
  }

  /* ---- cues ---- */
  const massOf = (v) => Math.max(1, Math.min(8, v || 1));
  function playSelect() { ensureGraph(); if (!ctx) return; strike(now(), 2900, 0.035, { stone: "tungsten", sustain: 0.5, send: 0.08 }); }
  function playDeselect() { ensureGraph(); if (!ctx) return; strike(now(), 2150, 0.026, { stone: "tungsten", sustain: 0.45, send: 0.08 }); }
  function playBlocked() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    strike(t, 170, 0.05, { stone: "shungite", send: 0.1 });
    strike(t + 0.09, 150, 0.04, { stone: "shungite", send: 0.1 });
  }
  function playRollStart(volumeUnits, durationMs) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), dur = Math.max(0.15, (durationMs || 400) / 1000);
    airSlide(now(), dur, 1100 / Math.sqrt(m), 520 / Math.sqrt(m), 0.006 + m * 0.0016);
  }
  function playLanding(volumeUnits) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), t = now();
    const f0 = 640 / Math.pow(m, 0.45);
    strike(t, f0, 0.055 + 0.018 * Math.log2(m));
    thump(t, 48 + 22 / m, 0.05 * Math.sqrt(m), 0.1 + 0.03 * m);
  }
  function playCapture() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    strike(t, 98, 0.09, { stone: "tungsten", sustain: 1.8, send: 0.3 });
    thump(t, 42, 0.16, 0.5);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(880, t + 0.05); o.frequency.exponentialRampToValueAtTime(330, t + 1.4);
    g.gain.setValueAtTime(0, t + 0.05); g.gain.linearRampToValueAtTime(0.01, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g); out(g, 0.6, 0.35); o.start(t + 0.05); o.stop(t + 1.6);
  }
  function playWin() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    [220, 329.6, 440, 659.3].forEach((f, i) => strike(t + i * 0.19, f, 0.04, { stone: "tungsten", sustain: 1.6, send: 0.3 }));
  }
  function playPowerOn() {
    ensureStarted(); if (!ctx) return;
    const t = now();
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 55;
    lp.type = "lowpass"; lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.05);
    o.connect(lp).connect(g); out(g, 1, 0.5); o.start(t); o.stop(t + 1.1);
    strike(t + 0.95, 440, 0.035, { stone: "tungsten", sustain: 1.3, send: 0.25 });
  }
  function playPowerOff() {
    ensureStarted(); if (!ctx) return;
    const t = now();
    strike(t, 330, 0.03, { stone: "tungsten", sustain: 1.2, send: 0.25 });
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 55;
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1600, t + 0.1); lp.frequency.exponentialRampToValueAtTime(110, t + 1.1);
    g.gain.setValueAtTime(0, t + 0.1); g.gain.linearRampToValueAtTime(0.016, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 1.15);
    o.connect(lp).connect(g); out(g, 1, 0.5); o.start(t + 0.1); o.stop(t + 1.2);
  }
  function playDockOpen() { ensureGraph(); if (ctx) airSlide(now(), 0.24, 520, 1500, 0.014); }
  function playDockClose() { ensureGraph(); if (ctx) airSlide(now(), 0.22, 1400, 480, 0.012); }
  function playRulesOpen() { ensureGraph(); if (ctx) strike(now(), 1318.5, 0.022, { stone: "tungsten", sustain: 0.7, send: 0.2 }); }
  function playRulesClose() { ensureGraph(); if (ctx) strike(now(), 987.8, 0.018, { stone: "tungsten", sustain: 0.6, send: 0.2 }); }
  function playRulesTab() { ensureGraph(); if (ctx) strike(now(), 2637 * (1 + (Math.random() - 0.5) * 0.02), 0.014, { stone: "tungsten", sustain: 0.45, send: 0.1 }); }
  // The About card's "menu" voice: a quiet sustained chord of struck bars.
  function playMenu() {
    ensureGraph(); if (!ctx) return;
    stopMenu();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(sfx);
    menuVoice = g;
    const t = now();
    [146.8, 220, 293.7].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f * (1 + i * 0.0007);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.008, t + 1.2);
      o.connect(og).connect(g); o.start(t);
      const snd = ctx.createGain(); snd.gain.value = 0.25; og.connect(snd).connect(rev);
      g._oscs = (g._oscs || []).concat(o);
    });
  }
  function fadeOutMenu() {
    if (!menuVoice || !ctx) return;
    const g = menuVoice; menuVoice = null;
    const t = ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.35);
    (g._oscs || []).forEach((o) => o.stop(t + 2));
  }
  function stopMenu() {
    if (!menuVoice || !ctx) return;
    const g = menuVoice; menuVoice = null;
    g.gain.setValueAtTime(0, ctx.currentTime);
    (g._oscs || []).forEach((o) => { try { o.stop(); } catch (e) { /* stopped */ } });
  }
  // The stone switch: each stone struck once, so you hear what you chose.
  function playStone(key) {
    ensureGraph(); if (!ctx) return;
    const t = now();
    if (key === "shungite") { strike(t, 260, 0.06, { stone: "shungite", send: 0.1 }); thump(t, 70, 0.05, 0.12); }
    else strike(t, 392, 0.05, { stone: "tungsten", sustain: 1.2, send: 0.2 });
  }

  const noop = () => {};
  return {
    ensureStarted, beginGameFadeIn, setZoom, setMuted, setVolume, setTension, beginFadeOut, resetWindDown,
    playSelect, playDeselect, playBlocked, playRollStart, playLanding, playCapture, playWin,
    playMenu, fadeOutMenu, stopMenu, playRulesOpen, playRulesClose, playRulesTab,
    playPowerOn, playPowerOff, playDockOpen, playDockClose, playStone,
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker: noop, playArc: noop, playGlitch: noop,
    playSingularityOpen: noop, playSingularityClose: noop, playSingularityBell: noop, playSingularityDismiss: noop,
    startSingularityHum: noop, updateSingularityHum: noop, stopSingularityHum: noop,
    continueSingularityHumThroughCollapse: noop, startSingularityCollapseRoar: noop,
    cutSingularityAudioToSilence: noop, resumeAudioAfterSingularity: noop,
    dispose() {
      clearTimeout(bowlTimer);
      if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } }
    },
  };
}
