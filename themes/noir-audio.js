/* Noir's sound: the street at night in the rain, and the picture house
   it's shown in. All synthesized (Web Audio), as the other worlds'.

   The street: rain on the pavement and the roofs, gutters running and
   dripping, a car hissing by on the wet road now and then, the El going
   over a few streets off, a siren far away, the thunder after the
   lightning (noir-fx.js calls thunder()).

   The cues: a typewriter key to pick a piece up (the script being
   typed), a softer one to put it down, a knock at a door for a move that
   isn't allowed, stone grinding as a building tips, a thud and a splash
   where it lands, a press camera's flashbulb and a door slammed for a
   crush, a low jazz chord to win. The dock is a venetian blind going up
   and coming down; the projector starts the picture and runs it down. */

export const hasAudio = true;

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, wet = null, rev = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, ambRunning = false;
  let timers = [], menuVoice = null;
  let zoom = 0.5, volume = 1, vol = null, ambGain = null, rainLp = null;

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
      // a street between tall buildings: a long, dark echo
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.72 + (Math.random() * 2 - 1) * 0.28; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.2; rev.connect(wet).connect(master);
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
  // a dull knock or thud: a falling sine and a puff of low noise
  function thud(t0, f, level, send = 0.25, bus = sfx, pan = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.8, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(g); out(g, 1, send, bus, pan); o.start(t0); o.stop(t0 + 0.32);
    const s = noise(t0, 0.18, brownBuf), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 500;
    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(level * 0.8, t0 + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    s.connect(lp).connect(ng); out(ng, 1, send * 0.7, bus, pan);
  }
  // a typewriter key: the type bar's click and the platen's knock
  function typeKey(t0, level, pan = 0) {
    band(t0, 0.03, 3200 + Math.random() * 900, 1.4, level, 0.001, sfx, 0.05, pan);
    band(t0 + 0.012, 0.05, 900, 1.2, level * 0.6, 0.001, sfx, 0.05, pan);
    thud(t0 + 0.01, 160, level * 0.35, 0.05, sfx, pan);
  }
  // water: a splash on the wet street
  function splash(t0, level, pan = 0) {
    const s = noise(t0, 0.5), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2400, t0); hp.frequency.exponentialRampToValueAtTime(900, t0 + 0.35);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    s.connect(hp).connect(g); out(g, 1, 0.2, sfx, pan);
  }
  // a soft piano-ish note (a few decaying partials), for the chords
  function note(t0, f, level, dur, bus = sfx, send = 0.45) {
    [[1, 1, 1], [2.0, 0.42, 0.7], [3.0, 0.16, 0.45], [4.01, 0.08, 0.3]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * a, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * d);
      o.connect(g); out(g, 1, send, bus); o.start(t0); o.stop(t0 + dur * d + 0.05);
    });
  }

  /* ---- the street ---- */
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.7 + 0.4 * zoom; ambGain.connect(amb);
    // the rain: a steady hiss on the pavement, a duller roar on the roofs
    const rb = ctx.createBufferSource(); rb.buffer = noiseBuf; rb.loop = true;
    const rbp = ctx.createBiquadFilter(); rbp.type = "bandpass"; rbp.frequency.value = 3600; rbp.Q.value = 0.5;
    rainLp = ctx.createBiquadFilter(); rainLp.type = "lowpass"; rainLp.frequency.value = 7000;
    const rg = ctx.createGain(); rg.gain.value = 0.045;
    rb.connect(rbp).connect(rainLp).connect(rg).connect(ambGain); rb.start();
    const rr = ctx.createBufferSource(); rr.buffer = brownBuf; rr.loop = true;
    const rrl = ctx.createBiquadFilter(); rrl.type = "lowpass"; rrl.frequency.value = 700;
    const rrg = ctx.createGain(); rrg.gain.value = 0.05; rr.connect(rrl).connect(rrg).connect(ambGain); rr.start();
    // the rain coming and going a little
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 0.012; lfo.connect(lg).connect(rg.gain); lfo.start();
    scheduleStreet();
  }
  function scheduleStreet() {
    // a gutter dripping: drops, a few at a time
    later(function drip() {
      if (!ctx || windingDown) return;
      const t = now(), pan = Math.random() * 1.6 - 0.8, n = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + i * (0.3 + Math.random() * 0.5), f = 900 + Math.random() * 700;
        o.type = "sine"; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 1.9, tt + 0.03);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.006, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
        o.connect(g); out(g, 1, 0.4, ambGain, pan); o.start(tt); o.stop(tt + 0.08);
      }
      later(drip, 2500 + Math.random() * 5000);
    }, 2000);
    // a car going by on the wet road, its tyres hissing, left to right or back
    later(function car() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 3.2 + Math.random() * 1.6, dir = Math.random() < 0.5 ? 1 : -1;
      const s = noise(t, dur + 0.1), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = 0.7; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(2600, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.5); g.gain.linearRampToValueAtTime(0, t + dur);
      let n2 = g;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.8 * dir, t); p.pan.linearRampToValueAtTime(0.8 * dir, t + dur); g.connect(p); n2 = p; }
      s.connect(bp).connect(g); const o2 = ctx.createGain(); o2.gain.value = 1; n2.connect(o2).connect(ambGain);
      // the engine under it, low
      const o = ctx.createOscillator(), eg = ctx.createGain(), elp = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(52, t); o.frequency.linearRampToValueAtTime(48, t + dur);
      elp.type = "lowpass"; elp.frequency.value = 180;
      eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(0.012, t + dur * 0.5); eg.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(elp).connect(eg).connect(ambGain); o.start(t); o.stop(t + dur + 0.05);
      later(car, 14000 + Math.random() * 22000);
    }, 6000 + Math.random() * 6000);
    // the El going over, a few streets off: a rumble and the wheels' clatter on the joints
    later(function el() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 7 + Math.random() * 3, pan = -0.4;
      const s = noise(t, dur + 0.2, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 260;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(lp).connect(g); out(g, 1, 0.3, ambGain, pan);
      for (let tt = t + 0.3; tt < t + dur - 0.3; tt += 0.42 + Math.random() * 0.08) {
        const k = Math.sin(Math.PI * (tt - t) / dur);
        band(tt, 0.08, 700, 2, 0.012 * k, 0.002, ambGain, 0.2, pan); band(tt + 0.11, 0.08, 620, 2, 0.01 * k, 0.002, ambGain, 0.2, pan);
      }
      later(el, 38000 + Math.random() * 30000);
    }, 15000 + Math.random() * 10000);
    // a siren, far off across the city
    later(function siren() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 6 + Math.random() * 3, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(520, t);
      for (let tt = t, up = true; tt < t + dur; tt += 1.4, up = !up) o.frequency.linearRampToValueAtTime(up ? 760 : 520, tt + 1.4);
      lp.type = "lowpass"; lp.frequency.value = 1100;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.008, t + 1.5); g.gain.setValueAtTime(0.008, t + dur - 2); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(lp).connect(g); out(g, 1, 0.6, ambGain, 0.5); o.start(t); o.stop(t + dur + 0.1);
      later(siren, 60000 + Math.random() * 60000);
    }, 40000 + Math.random() * 30000);
  }

  // The thunder, after the lightning: a crack far off, then the long roll.
  function thunder() {
    if (!ctx || windingDown || !ambGain) return;
    const t = now(), dur = 5 + Math.random() * 3;
    const s = noise(t, dur + 0.2, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.08);
    for (let tt = t + 0.4; tt < t + dur * 0.7; tt += 0.3 + Math.random() * 0.5) g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.1, tt);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp).connect(g); out(g, 1, 0.5, ambGain, Math.random() * 0.6 - 0.3);
  }

  function beginGameFadeIn() {
    ensureStarted(); if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) { zoom = z; if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.7 + 0.4 * z, ctx.currentTime, 0.4); }
  // tension: the rain heavier and brighter
  function setTension(v) { if (rainLp && ctx) rainLp.frequency.setTargetAtTime(7000 + 4000 * v, ctx.currentTime, 1.2); }
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
    if (ambRunning) scheduleStreet();
  }

  /* ---- cues ---- */
  const massOf = (v) => Math.max(1, Math.min(8, v || 1));
  function playSelect() { ensureGraph(); if (!ctx) return; typeKey(now(), 0.06); }
  function playDeselect() { ensureGraph(); if (!ctx) return; typeKey(now(), 0.035); }
  function playBlocked() {
    // two knocks at a door
    ensureGraph(); if (!ctx) return;
    const t = now(); thud(t, 140, 0.07, 0.2); thud(t + 0.16, 130, 0.06, 0.2);
  }
  function playRollStart(volumeUnits, durationMs) {
    // stone grinding as the building tips
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), dur = Math.max(0.15, (durationMs || 400) / 1000), t = now();
    const s = noise(t, dur + 0.05, brownBuf), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 260 / Math.pow(m, 0.25); bp.Q.value = 0.9;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 + m * 0.01, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp).connect(g); out(g, 1, 0.2);
  }
  function playLanding(volumeUnits) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), t = now();
    thud(t, 110 / Math.pow(m, 0.3), 0.09 + 0.015 * Math.log2(m));
    splash(t + 0.01, 0.03 + 0.005 * m);
  }
  function playCapture() {
    // a press camera's flashbulb (the pop and its whine), then a door slammed
    ensureGraph(); if (!ctx) return;
    const t = now();
    band(t, 0.06, 2600, 0.8, 0.12, 0.001, sfx, 0.3);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(4200, t + 0.02); o.frequency.exponentialRampToValueAtTime(9000, t + 0.6);
    g.gain.setValueAtTime(0, t + 0.02); g.gain.linearRampToValueAtTime(0.008, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); out(g, 1, 0.1); o.start(t); o.stop(t + 0.65);
    thud(t + 0.35, 70, 0.2, 0.45); band(t + 0.35, 0.12, 1800, 1.5, 0.05, 0.001, sfx, 0.3);
  }
  function playWin() {
    // the end title's chord: low, a minor ninth, let ring
    ensureGraph(); if (!ctx) return;
    const t = now();
    [110, 130.8, 164.8, 196, 246.9].forEach((f, i) => note(t + i * 0.05, f, 0.05, 4.5));
    note(t + 0.6, 493.9, 0.03, 3.5); note(t + 0.9, 440, 0.025, 3.5);
  }
  // the projector: the motor coming up and the film gate's clatter at 24 frames
  function projector(t0, dur, up) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 600;
    o.frequency.setValueAtTime(up ? 30 : 96, t0); o.frequency.exponentialRampToValueAtTime(up ? 96 : 28, t0 + dur);
    g.gain.setValueAtTime(up ? 0 : 0.02, t0); g.gain.linearRampToValueAtTime(up ? 0.02 : 0, t0 + dur);
    o.connect(lp).connect(g); out(g, 1, 0.15); o.start(t0); o.stop(t0 + dur + 0.05);
    for (let tt = t0, k = 0; tt < t0 + dur; k++) {
      const u = (tt - t0) / dur, rate = up ? 6 + 18 * u : 24 - 18 * u, lvl = 0.02 * (up ? Math.min(1, u * 2) : 1 - u);
      band(tt, 0.02, 2400, 3, lvl, 0.001, sfx, 0.05);
      tt += 1 / rate;
    }
  }
  function playPowerOn() { ensureStarted(); if (ctx) projector(now(), 1.4, true); }
  function playPowerOff() { ensureStarted(); if (ctx) projector(now(), 1.3, false); }
  // a venetian blind: its slats clattering as the cord is pulled
  function blind(t0, up) {
    for (let i = 0; i < 9; i++) band(t0 + i * 0.022 * (up ? 1 : 1.25), 0.03, up ? 2600 + i * 120 : 3600 - i * 120, 2.5, 0.016, 0.001, sfx, 0.08);
  }
  function playDockOpen() { ensureGraph(); if (ctx) blind(now(), true); }
  function playDockClose() { ensureGraph(); if (ctx) blind(now(), false); }
  // the rules: a page turned, a key typed
  function page(t0, level) { const s = noise(t0, 0.25), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = "bandpass"; bp.frequency.setValueAtTime(1800, t0); bp.frequency.linearRampToValueAtTime(4200, t0 + 0.2); bp.Q.value = 0.6; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24); s.connect(bp).connect(g); out(g, 1, 0.08); }
  function playRulesOpen() { ensureGraph(); if (ctx) page(now(), 0.03); }
  function playRulesClose() { ensureGraph(); if (ctx) page(now(), 0.025); }
  function playRulesTab() { ensureGraph(); if (ctx) typeKey(now(), 0.025); }
  // the About card's voice: the end title's chord, held soft
  function playMenu() {
    ensureGraph(); if (!ctx) return;
    stopMenu();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(sfx); menuVoice = g;
    const t = now();
    [110, 164.8, 196, 246.9, 293.7].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f * (1 + i * 0.0008);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.0045, t + 1.8);
      o.connect(og).connect(g); o.start(t);
      const snd = ctx.createGain(); snd.gain.value = 0.5; og.connect(snd).connect(rev);
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
    // the thunder after noir-fx.js's lightning
    thunder,
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker: noop, playArc: noop, playGlitch: noop,
    playSingularityOpen: noop, playSingularityClose: noop, playSingularityBell: noop, playSingularityDismiss: noop,
    startSingularityHum: noop, updateSingularityHum: noop, stopSingularityHum: noop,
    continueSingularityHumThroughCollapse: noop, startSingularityCollapseRoar: noop,
    cutSingularityAudioToSilence: noop, resumeAudioAfterSingularity: noop,
    dispose() { clearTimers(); if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } } },
  };
}
