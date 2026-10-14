/* Plano's sound: a drafting room over a city.

   Everything is synthesized. The game is played with the tools of a
   drawing office: a piece picked up is a pencil's tick on paper, a roll a
   long pencil stroke, a landing a ruler set down on the board (a dry tap,
   a little paper), a crush the rubber stamp coming down, a win the stamp
   twice and the desk bell. The menus turn pages and slide sheets.

   The ambience is the city below the window, far off: the low bed of
   traffic, now and then a car passing from one side to the other, the
   tram's bell, a bicycle bell, a horn a few streets away, a bird in the
   park, and in the room someone drawing for a moment. It fades in at
   Begin Game and out at the end, with the same wind-down contract as
   Cromo's and Neon's (beginFadeOut/resetWindDown). */

export const hasAudio = true;

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, wet = null, rev = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, ambRunning = false;
  let timers = [], menuVoice = null;
  let zoom = 0.5, volume = 1, vol = null, ambGain = null, trafficLp = null;

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
      // a small office: plaster and paper, a short soft room
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 0.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / len, 4); } }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.14; rev.connect(wet).connect(master);
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
  // a band of noise with an envelope: the stuff of paper and pencil
  function band(t0, dur, f, q, level, attack = 0.004, bus = sfx, send = 0.08, pan = 0) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, send, bus, pan);
  }
  // a pencil stroke: grainy high noise, the grain coming in little bursts
  function stroke(t0, dur, level, bus = sfx) {
    const s = noise(t0, dur + 0.05), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 1800; bp.type = "bandpass"; bp.frequency.value = 4200; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.02); g.gain.setValueAtTime(level, t0 + dur * 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
    // grain: the gain flutters as the point catches the tooth of the paper
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = "square"; lfo.frequency.value = 26 + Math.random() * 14; lg.gain.value = 0.35; am.gain.value = 0.65;
    lfo.connect(lg).connect(am.gain); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    s.connect(hp).connect(bp).connect(am).connect(g); out(g, 1, 0.06, bus);
  }
  // a ruler set down: a dry knock and a breath of paper
  function knock(t0, f, level) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.6, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.02);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(g); out(g, 1, 0.12); o.start(t0); o.stop(t0 + 0.12);
    band(t0, 0.03, 2600, 1.3, level * 0.8, 0.001);
    band(t0 + 0.004, 0.11, 5200, 0.9, level * 0.25, 0.01);
  }
  // the rubber stamp: a heavy dull thump, the slap of rubber on paper
  function stamp(t0, level) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(58, t0 + 0.08);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g); out(g, 1, 0.2); o.start(t0); o.stop(t0 + 0.25);
    band(t0, 0.06, 900, 1.1, level * 0.9, 0.002, sfx, 0.15);
    band(t0 + 0.01, 0.16, 3000, 0.7, level * 0.22, 0.01, sfx, 0.1);
  }
  // the desk bell: a few bright partials, ringing out
  function bell(t0, f, level, bus = sfx, pan = 0) {
    [[1, 1, 1.4], [2.76, 0.5, 0.7], [5.4, 0.25, 0.35], [8.9, 0.1, 0.2]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * a, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); out(g, 1, 0.35, bus, pan); o.start(t0); o.stop(t0 + d + 0.05);
    });
  }
  function pageTurn(t0, level, up = true) {
    const s = noise(t0, 0.32), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(up ? 1400 : 3400, t0); bp.frequency.exponentialRampToValueAtTime(up ? 3600 : 1300, t0 + 0.28);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.08); g.gain.linearRampToValueAtTime(0, t0 + 0.3);
    s.connect(bp).connect(g); out(g, 1, 0.12);
  }

  /* ---- the city below ---- */
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.7 + 0.4 * zoom; ambGain.connect(amb);
    // the traffic's low bed
    const tb = ctx.createBufferSource(); tb.buffer = brownBuf; tb.loop = true;
    trafficLp = ctx.createBiquadFilter(); trafficLp.type = "lowpass"; trafficLp.frequency.value = 380;
    const tg = ctx.createGain(); tg.gain.value = 0.05;
    tb.connect(trafficLp).connect(tg).connect(ambGain); tb.start();
    scheduleCity();
  }
  function scheduleCity() {
    // a car passing, left to right or back
    later(function car() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 2.2 + Math.random() * 1.8, dir = Math.random() < 0.5 ? -1 : 1;
      const s = noise(t, dur + 0.1, brownBuf), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      bp.type = "bandpass"; bp.Q.value = 0.7; bp.frequency.setValueAtTime(420, t); bp.frequency.linearRampToValueAtTime(560, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(320, t + dur);
      const lvl = 0.05 + Math.random() * 0.05;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.5); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(bp).connect(g);
      if (p) { p.pan.setValueAtTime(-0.8 * dir, t); p.pan.linearRampToValueAtTime(0.8 * dir, t + dur); g.connect(p).connect(ambGain); } else g.connect(ambGain);
      later(car, 2500 + Math.random() * 6500);
    }, 1800);
    // the tram's bell, two strokes
    later(function tram() {
      if (!ctx || windingDown) return;
      const t = now(), pan = Math.random() * 1.2 - 0.6;
      bell(t, 1180, 0.012, ambGain, pan); bell(t + 0.22, 1180, 0.01, ambGain, pan);
      later(tram, 28000 + Math.random() * 30000);
    }, 9000 + Math.random() * 8000);
    // a bicycle bell
    later(function bike() {
      if (!ctx || windingDown) return;
      const t = now(), pan = Math.random() * 1.4 - 0.7;
      bell(t, 2350, 0.007, ambGain, pan); bell(t + 0.12, 2350, 0.006, ambGain, pan);
      later(bike, 20000 + Math.random() * 26000);
    }, 15000 + Math.random() * 10000);
    // a horn a few streets away
    later(function horn() {
      if (!ctx || windingDown) return;
      const t = now(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 900;
      [[311, 1], [392, 0.8]].forEach(([f, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "square"; o.frequency.value = f; og.gain.value = a; o.connect(og).connect(lp); o.start(t); o.stop(t + 0.42); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.0055, t + 0.03); g.gain.setValueAtTime(0.0055, t + 0.32); g.gain.linearRampToValueAtTime(0, t + 0.42);
      lp.connect(g); out(g, 1, 0.4, ambGain, Math.random() * 1.6 - 0.8);
      later(horn, 35000 + Math.random() * 40000);
    }, 21000 + Math.random() * 20000);
    // a bird in the park
    later(function bird() {
      if (!ctx || windingDown) return;
      const t = now(), n = 2 + Math.floor(Math.random() * 3), base = 3000 + Math.random() * 1600, pan = Math.random() * 1.6 - 0.8;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t1 = t + i * 0.13;
        o.type = "sine"; o.frequency.setValueAtTime(base, t1); o.frequency.exponentialRampToValueAtTime(base * 1.35, t1 + 0.07);
        g.gain.setValueAtTime(0, t1); g.gain.linearRampToValueAtTime(0.004, t1 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.09);
        o.connect(g); out(g, 1, 0.3, ambGain, pan); o.start(t1); o.stop(t1 + 0.1);
      }
      later(bird, 14000 + Math.random() * 22000);
    }, 6000 + Math.random() * 8000);
    // in the room, someone drawing for a moment
    later(function drawing() {
      if (!ctx || windingDown) return;
      let t = now();
      for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) { const d = 0.15 + Math.random() * 0.45; stroke(t, d, 0.004, ambGain); t += d + 0.08 + Math.random() * 0.25; }
      later(drawing, 16000 + Math.random() * 20000);
    }, 11000 + Math.random() * 9000);
  }

  function beginGameFadeIn() {
    ensureStarted(); if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) { zoom = z; if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.7 + 0.4 * z, ctx.currentTime, 0.4); }
  function setTension(v) { if (trafficLp && ctx) trafficLp.frequency.setTargetAtTime(380 + 300 * v, ctx.currentTime, 1.2); }
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
    if (ambRunning) scheduleCity();
  }

  /* ---- cues ---- */
  const massOf = (v) => Math.max(1, Math.min(8, v || 1));
  function playSelect() { ensureGraph(); if (!ctx) return; const t = now(); band(t, 0.035, 5200, 1.4, 0.05, 0.001); knock(t, 1400, 0.012); }
  function playDeselect() { ensureGraph(); if (!ctx) return; band(now(), 0.07, 2200, 1.2, 0.03, 0.006); }
  function playBlocked() { ensureGraph(); if (!ctx) return; const t = now(); knock(t, 240, 0.05); knock(t + 0.1, 210, 0.04); }
  function playRollStart(volumeUnits, durationMs) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), dur = Math.max(0.15, (durationMs || 400) / 1000);
    stroke(now(), dur * 0.9, 0.012 + m * 0.0025);
  }
  function playLanding(volumeUnits) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), t = now();
    knock(t, 320 / Math.pow(m, 0.35), 0.06 + 0.012 * Math.log2(m));
  }
  function playCapture() { ensureGraph(); if (!ctx) return; const t = now(); stamp(t, 0.16); }
  function playWin() { ensureGraph(); if (!ctx) return; const t = now(); stamp(t, 0.12); stamp(t + 0.34, 0.13); bell(t + 0.72, 1568, 0.03); }
  function playPowerOn() {
    // a roll of drawings opened out on the table
    ensureStarted(); if (!ctx) return;
    const t = now(); pageTurn(t, 0.03, true); band(t + 0.18, 0.5, 2400, 0.6, 0.016, 0.12); knock(t + 0.62, 260, 0.04);
  }
  function playPowerOff() { ensureStarted(); if (!ctx) return; const t = now(); band(t, 0.6, 2200, 0.6, 0.016, 0.1); pageTurn(t + 0.3, 0.025, false); }
  function playDockOpen() { ensureGraph(); if (ctx) pageTurn(now(), 0.016, true); }
  function playDockClose() { ensureGraph(); if (ctx) pageTurn(now(), 0.014, false); }
  function playRulesOpen() { ensureGraph(); if (ctx) pageTurn(now(), 0.02, true); }
  function playRulesClose() { ensureGraph(); if (ctx) pageTurn(now(), 0.018, false); }
  function playRulesTab() { ensureGraph(); if (ctx) band(now(), 0.12, 3000 + Math.random() * 600, 0.9, 0.014, 0.01); }
  // the About card's voice: a quiet chord, held
  function playMenu() {
    ensureGraph(); if (!ctx) return;
    stopMenu();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(sfx); menuVoice = g;
    const t = now();
    [130.8, 196, 246.9, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f * (1 + i * 0.0006);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.006, t + 1.4);
      o.connect(og).connect(g); o.start(t);
      const snd = ctx.createGain(); snd.gain.value = 0.3; og.connect(snd).connect(rev);
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
