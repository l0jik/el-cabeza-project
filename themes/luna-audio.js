/* Luna's sound: the inside of the moon base.

   Everything is synthesized. No air outside, so what is heard is the
   base: a piece picked up is a console's beep, a roll a servo's whir, a
   landing the thud of the structure taking the weight (and the hiss of a
   seal), a crush a heavy clunk and air venting, a win the radio's
   Quindar tones round a chime (the beeps that opened and closed Apollo's
   transmissions: 2525 Hz in, 2475 Hz out). The menus are pneumatic sighs
   and soft chirps.

   The ambience is life support: the air handlers' steady rush, a low
   hum, now and then an instrument's beep, a pump cycling, an airlock
   somewhere, and the radio: a Quindar tone, a burst of static and band-
   limited chatter, the tone out. It fades in at Begin Game and out at the
   end, with the same wind-down contract as the other worlds'
   (beginFadeOut/resetWindDown). */

export const hasAudio = true;

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, wet = null, rev = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, ambRunning = false;
  let timers = [], menuVoice = null;
  let zoom = 0.5, volume = 1, vol = null, ambGain = null, airLp = null;

  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
      vol = ctx.createGain(); vol.gain.value = volume;
      master.connect(comp).connect(vol).connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = 0.75; sfx.connect(master);
      intro = ctx.createGain(); intro.gain.value = 0; intro.connect(master);
      amb = ctx.createGain(); amb.gain.value = 1; amb.connect(intro);
      // a small metal module: a short bright ring
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 0.7), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.35 + (Math.random() * 2 - 1) * 0.65; d[i] = lp * Math.pow(1 - i / len, 3.2); } }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.16; rev.connect(wet).connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const bd = brownBuf.getChannelData(0); let b = 0; for (let i = 0; i < bd.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = b * 3.5; }
    } catch (e) { ctx = null; }
  }
  function ensureStarted() { ensureGraph(); if (ctx && ctx.state === "suspended") ctx.resume(); }
  const now = () => ctx.currentTime + 0.005;
  function out(node, dry, send, bus = sfx, pan = 0) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); n = p; }
    const g1 = ctx.createGain(); g1.gain.value = dry; n.connect(g1).connect(bus);
    const g2 = ctx.createGain(); g2.gain.value = send; n.connect(g2).connect(rev);
  }
  function noise(t0, dur, buf = noiseBuf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, Math.random() * 1.5); s.stop(t0 + dur); return s; }
  // a band of noise with an envelope
  function band(t0, dur, f, q, level, attack = 0.004, bus = sfx, send = 0.08, pan = 0) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, send, bus, pan);
  }
  // a console's beep: a pure tone, quick in and out
  function beep(t0, f, dur, level, bus = sfx, pan = 0, send = 0.12) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.006); g.gain.setValueAtTime(level, t0 + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); out(g, 1, send, bus, pan); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // the structure taking a weight: a low thump, dull
  function thud(t0, f, level) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.8, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(g); out(g, 1, 0.22); o.start(t0); o.stop(t0 + 0.35);
    const s = noise(t0, 0.2, brownBuf), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 420;
    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(level * 0.9, t0 + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    s.connect(lp).connect(ng); out(ng, 1, 0.15);
  }
  // air through a valve: a hiss, its pitch falling as the pressure goes
  function hiss(t0, dur, level, fFrom = 5200, fTo = 1600, bus = sfx, pan = 0) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.Q.value = 0.8; bp.frequency.setValueAtTime(fFrom, t0); bp.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + Math.min(0.05, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, 0.1, bus, pan);
  }
  // a servo's whir: a buzzing tone rising and settling, through a lowpass
  function whir(t0, dur, level) {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(140, t0); o.frequency.linearRampToValueAtTime(260, t0 + dur * 0.45); o.frequency.linearRampToValueAtTime(190, t0 + dur);
    lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 2;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.04); g.gain.setValueAtTime(level, t0 + dur * 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(lp).connect(g); out(g, 1, 0.08); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // the radio's Quindar tone
  function quindar(t0, inbound, level, bus = sfx, pan = 0) { beep(t0, inbound ? 2525 : 2475, 0.25, level, bus, pan, 0.05); }
  // a chime: a few soft partials ringing out
  function chime(t0, f, level, bus = sfx) {
    [[1, 1, 1.6], [2.0, 0.35, 0.9], [3.01, 0.15, 0.5]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * a, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); out(g, 1, 0.3, bus); o.start(t0); o.stop(t0 + d + 0.05);
    });
  }

  /* ---- life support ---- */
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.7 + 0.4 * zoom; ambGain.connect(amb);
    // the air handlers' steady rush
    const ab = ctx.createBufferSource(); ab.buffer = brownBuf; ab.loop = true;
    airLp = ctx.createBiquadFilter(); airLp.type = "lowpass"; airLp.frequency.value = 520;
    const ag = ctx.createGain(); ag.gain.value = 0.06;
    ab.connect(airLp).connect(ag).connect(ambGain); ab.start();
    const hb = ctx.createBufferSource(); hb.buffer = noiseBuf; hb.loop = true;
    const hbp = ctx.createBiquadFilter(); hbp.type = "bandpass"; hbp.frequency.value = 1900; hbp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.006; hb.connect(hbp).connect(hg).connect(ambGain); hb.start();
    // the hum of the base's power, and its harmonics, breathing a little
    [[58, 0.012], [116, 0.006], [174, 0.003]].forEach(([f, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = a;
      lfo.frequency.value = 0.07 + Math.random() * 0.05; lg.gain.value = a * 0.35; lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(ambGain); o.start();
    });
    scheduleBase();
  }
  function scheduleBase() {
    // an instrument's beep, somewhere in the module
    later(function blip() {
      if (!ctx || windingDown) return;
      const t = now(), pan = Math.random() * 1.4 - 0.7, f = [880, 1320, 1760, 1175][Math.floor(Math.random() * 4)], n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) beep(t + i * 0.16, f, 0.07, 0.006, ambGain, pan, 0.25);
      later(blip, 7000 + Math.random() * 12000);
    }, 4000 + Math.random() * 5000);
    // a pump cycling: a soft pulsing for a few seconds
    later(function pump() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 3 + Math.random() * 3, s = noise(t, dur + 0.1, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 300;
      lfo.frequency.value = 2.2; lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + dur + 0.1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.6); g.gain.setValueAtTime(0.03, t + dur - 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(lp).connect(am).connect(g); out(g, 1, 0.2, ambGain, Math.random() * 1.2 - 0.6);
      later(pump, 22000 + Math.random() * 26000);
    }, 12000 + Math.random() * 10000);
    // an airlock cycling, far off down a corridor
    later(function airlock() {
      if (!ctx || windingDown) return;
      const t = now(), pan = Math.random() * 1.6 - 0.8;
      thud(t, 90, 0.025); hiss(t + 0.25, 2.4, 0.012, 3800, 900, ambGain, pan); thud(t + 2.9, 80, 0.02);
      later(airlock, 45000 + Math.random() * 40000);
    }, 30000 + Math.random() * 25000);
    // the radio: a Quindar tone, static and chatter, the tone out
    later(function radio() {
      if (!ctx || windingDown) return;
      const t = now(), pan = -0.35 + Math.random() * 0.2, dur = 1.6 + Math.random() * 2.2;
      quindar(t, true, 0.008, ambGain, pan);
      // chatter: noise shaped by a jittering band, as a voice through a narrow radio
      const s = noise(t + 0.3, dur, noiseBuf), bp = ctx.createBiquadFilter(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 3.5; hp.type = "highpass"; hp.frequency.value = 400;
      let tt = t + 0.3;
      while (tt < t + 0.3 + dur) { const seg = 0.06 + Math.random() * 0.14; bp.frequency.setValueAtTime(500 + Math.random() * 1400, tt); g.gain.setValueAtTime(Math.random() < 0.25 ? 0.001 : 0.012 + Math.random() * 0.01, tt); tt += seg; }
      g.gain.setValueAtTime(0, t + 0.3 + dur);
      s.connect(hp).connect(bp).connect(g); out(g, 1, 0.05, ambGain, pan);
      band(t + 0.3, dur, 3000, 0.4, 0.002, 0.05, ambGain, 0, pan);
      quindar(t + 0.4 + dur, false, 0.008, ambGain, pan);
      later(radio, 26000 + Math.random() * 30000);
    }, 9000 + Math.random() * 8000);
  }

  function beginGameFadeIn() {
    ensureStarted(); if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) { zoom = z; if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.7 + 0.4 * z, ctx.currentTime, 0.4); }
  function setTension(v) { if (airLp && ctx) airLp.frequency.setTargetAtTime(520 + 380 * v, ctx.currentTime, 1.2); }
  function setMuted(m) { muted = m; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08); }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (vol && ctx) vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
  function beginFadeOut(seconds) {
    if (windingDown) return;
    windingDown = true; clearTimers();
    if (!master || !ctx) return;
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(master.gain.value, t0); master.gain.linearRampToValueAtTime(0, t0 + (seconds || 3));
  }
  function resetWindDown(restoreVolume) {
    if (!windingDown) return;
    windingDown = false;
    if (restoreVolume === true && ctx && ctx.state !== "running") { try { ctx.resume(); } catch (e) { /* closed */ } }
    if (master && ctx) {
      const t0 = ctx.currentTime;
      master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(master.gain.value, t0);
      if (restoreVolume === true) master.gain.linearRampToValueAtTime(muted ? 0 : 1, t0 + 0.6);
      else if (restoreVolume === "sfxOnly") { master.gain.setValueAtTime(muted ? 0 : 1, t0); intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); }
    }
    if (ambRunning) scheduleBase();
  }

  /* ---- cues ---- */
  const massOf = (v) => Math.max(1, Math.min(8, v || 1));
  function playSelect() { ensureGraph(); if (!ctx) return; const t = now(); beep(t, 1320, 0.06, 0.04); beep(t + 0.07, 1760, 0.05, 0.03); }
  function playDeselect() { ensureGraph(); if (!ctx) return; beep(now(), 880, 0.07, 0.03); }
  function playBlocked() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    [0, 0.13].forEach((d) => { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "square"; o.frequency.value = 170; lp.type = "lowpass"; lp.frequency.value = 900; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.03, t + d + 0.005); g.gain.setValueAtTime(0.03, t + d + 0.08); g.gain.linearRampToValueAtTime(0, t + d + 0.1); o.connect(lp).connect(g); out(g, 1, 0.05); o.start(t + d); o.stop(t + d + 0.12); });
  }
  function playRollStart(volumeUnits, durationMs) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), dur = Math.max(0.15, (durationMs || 400) / 1000);
    whir(now(), dur * 0.95, 0.012 + m * 0.003);
  }
  function playLanding(volumeUnits) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), t = now();
    thud(t, 120 / Math.pow(m, 0.3), 0.08 + 0.015 * Math.log2(m));
    hiss(t + 0.06, 0.35, 0.008, 4200, 2200);
  }
  function playCapture() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    thud(t, 60, 0.16); thud(t + 0.09, 48, 0.1);
    hiss(t + 0.12, 1.8, 0.03, 6000, 700);
  }
  function playWin() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    quindar(t, true, 0.03);
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => chime(t + 0.42 + i * 0.16, f, 0.035));
    quindar(t + 1.5, false, 0.03);
  }
  function playPowerOn() {
    // systems coming up: a rising tone, the air starting, a few beeps
    ensureStarted(); if (!ctx) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 1.0);
    o.connect(g); out(g, 1, 0.2); o.start(t); o.stop(t + 1.05);
    hiss(t + 0.2, 0.9, 0.012, 2600, 4200);
    [0, 0.12, 0.24].forEach((d, i) => beep(t + 0.95 + d, [1320, 1568, 1976][i], 0.06, 0.025));
  }
  function playPowerOff() {
    ensureStarted(); if (!ctx) return;
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
    g.gain.setValueAtTime(0.03, t); g.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(g); out(g, 1, 0.2); o.start(t); o.stop(t + 1.25);
    hiss(t, 1.0, 0.01, 3400, 900);
  }
  function playDockOpen() { ensureGraph(); if (ctx) hiss(now(), 0.28, 0.014, 2600, 4800); }
  function playDockClose() { ensureGraph(); if (ctx) hiss(now(), 0.26, 0.012, 4800, 2200); }
  function playRulesOpen() { ensureGraph(); if (!ctx) return; const t = now(); hiss(t, 0.3, 0.014, 2400, 4600); beep(t + 0.2, 1568, 0.05, 0.016); }
  function playRulesClose() { ensureGraph(); if (ctx) hiss(now(), 0.28, 0.012, 4600, 2000); }
  function playRulesTab() { ensureGraph(); if (ctx) beep(now(), 1175 + Math.random() * 200, 0.04, 0.014); }
  // the About card's voice: a quiet chord, held, as the sky
  function playMenu() {
    ensureGraph(); if (!ctx) return;
    stopMenu();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(sfx); menuVoice = g;
    const t = now();
    [110, 164.8, 220, 277.2, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f * (1 + i * 0.0008);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.005, t + 1.8);
      o.connect(og).connect(g); o.start(t);
      const snd = ctx.createGain(); snd.gain.value = 0.4; og.connect(snd).connect(rev);
      g._oscs = (g._oscs || []).concat(o);
    });
  }
  function fadeOutMenu() { if (!menuVoice || !ctx) return; const g = menuVoice; menuVoice = null; const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.35); (g._oscs || []).forEach((o) => o.stop(t + 2)); }
  function stopMenu() { if (!menuVoice || !ctx) return; const g = menuVoice; menuVoice = null; g.gain.setValueAtTime(0, ctx.currentTime); (g._oscs || []).forEach((o) => { try { o.stop(); } catch (e) { /* stopped */ } }); }

  const noop = () => {};
  return {
    ensureStarted, beginGameFadeIn, setZoom, setMuted, setVolume, setTension, beginFadeOut, resetWindDown,
    playSelect, playDeselect, playBlocked, playRollStart, playLanding, playCapture, playWin,
    playMenu, fadeOutMenu, stopMenu, playRulesOpen, playRulesClose, playRulesTab,
    playPowerOn, playPowerOff, playDockOpen, playDockClose,
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker: noop, playArc: noop, playGlitch: noop,
    playSingularityOpen: noop, playSingularityClose: noop, playSingularityBell: noop, playSingularityDismiss: noop,
    startSingularityHum: noop, updateSingularityHum: noop, stopSingularityHum: noop,
    continueSingularityHumThroughCollapse: noop, startSingularityCollapseRoar: noop,
    cutSingularityAudioToSilence: noop, resumeAudioAfterSingularity: noop,
    dispose() { clearTimers(); if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } } },
  };
}
