/* The den's sound: a quiet room on a wet evening, and the game's wood.

   - The fire: a low roar of burning, and crackles and pops, never on a
     beat. It's where it is: nearer the camera, louder, and off to the
     side it's on (setFireListener, from den-fx.js every frame).
   - The mantel clock: tick, tock, quietly, on the device's own seconds;
     on the hour its chime plays the Westminster melody (the four phrases,
     no counting strokes) the way a 1970s electronic clock did it, a
     little chip through a tiny speaker, soft enough not to break anyone's
     concentration.
   - Rain against the glass door: a steady patter, drops on the glass, a
     drip from the eaves now and then. No wind, no thunder (user rule).
   - The stereo console: the record player or the 8-track, when a track
     is chosen (playMusic; the tracks themselves come later).
   - The pieces: Tienda's wood (wood-sfx.js), on a solid board (the
     player's choice for Standard), with a small room round them.

   Three switches for the sound menu (standard.js soundChannels): "room"
   (the fire, the clock, the rain), "stereo" (shown as Music) and "pieces". Everything but
   the music is made here, in the browser. Built on the first gesture; the
   room starts then, so the fire is already going on the setup screen. */

import { createWoodSfx } from "./wood-sfx.js";

export const hasAudio = true;

// The Westminster quarters, E major, an octave up (a small speaker can't
// do the low bells): the hour's four phrases, changes 2, 3, 4 and 5.
const GS = 830.61, FS = 739.99, E = 659.26, B = 493.88;
const HOUR_CHIME = [[E, GS, FS, B], [E, FS, GS, E], [GS, E, FS, B], [B, FS, GS, E]];

export function createAudio() {
  let ctx = null, master = null, comp = null, roomBus = null, sfxBus = null, wood = null;
  let fireBus = null, firePan = null, musicBus = null;
  let noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, roomOn = false, disposed = false;
  let zoom = 0.5, fireNear = 1, lastChimeHour = null, chimes = 0;
  let music = null; // { el, src, extra: [nodes], track }
  const channelOff = { room: false, stereo: false, pieces: false };
  const gates = { room: null, stereo: null, pieces: null };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); return id; };
  const now = () => ctx.currentTime;

  function ensureGraph() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const bd = brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
      // A small room: the paneling and the shag keep it close and soft.
      const len = Math.floor(ctx.sampleRate * 0.6), ir = ctx.createBuffer(2, len, ctx.sampleRate), pre = Math.floor(ctx.sampleRate * 0.006);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) { lp = lp * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = lp * Math.pow(1 - (i - pre) / (len - pre), 2.4) * 2; }
      }
      const verb = ctx.createConvolver(); verb.buffer = ir;
      const verbOut = ctx.createGain(); verbOut.gain.value = 0.3;
      verb.connect(verbOut).connect(master);
      // The room (fire, clock, rain), the music and the pieces, each behind its switch.
      gates.room = ctx.createGain(); gates.room.gain.value = channelOff.room ? 0 : 1;
      roomBus = ctx.createGain(); roomBus.gain.value = 0;
      roomBus.connect(gates.room).connect(master);
      fireBus = ctx.createGain(); fireBus.gain.value = fireNear;
      firePan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (firePan) fireBus.connect(firePan).connect(roomBus); else fireBus.connect(roomBus);
      gates.stereo = ctx.createGain(); gates.stereo.gain.value = channelOff.stereo ? 0 : 1;
      musicBus = ctx.createGain(); musicBus.gain.value = 0.9;
      musicBus.connect(gates.stereo).connect(master);
      const musicRoom = ctx.createGain(); musicRoom.gain.value = 0.12;
      gates.stereo.connect(musicRoom).connect(verb);
      gates.pieces = ctx.createGain(); gates.pieces.gain.value = channelOff.pieces ? 0 : 1;
      sfxBus = ctx.createGain();
      sfxBus.connect(gates.pieces);
      gates.pieces.connect(master);
      const send = ctx.createGain(); send.gain.value = 0.22;
      gates.pieces.connect(send).connect(verb);
      wood = createWoodSfx(ctx, sfxBus, { board: "solid" });
      if (typeof window !== "undefined") {
        window.__DEN_AUDIO__ = () => ({
          ctx: !!ctx, ctxState: ctx ? ctx.state : null, roomOn, windingDown, muted,
          channelsOff: { ...channelOff },
          gates: { room: gates.room.gain.value, stereo: gates.stereo.gain.value, pieces: gates.pieces.gain.value },
          room: roomBus.gain.value,
          fire: { near: fireNear, gain: fireBus.gain.value, pan: firePan ? firePan.pan.value : 0 },
          chimes,
          music: music ? { id: music.track.id, medium: music.track.medium, paused: music.el.paused } : null,
        });
        if (window.__EC_TEST_HOOKS__) window.__DEN_CHIME_NOW__ = () => { ensureGraph(); if (ctx && roomOn) chime(); return chimes; };
      }
    } catch (e) {
      ctx = null;
    }
  }
  function noise(t0, dur, brown = false) {
    const s = ctx.createBufferSource();
    s.buffer = brown ? brownBuf : noiseBuf; s.loop = true;
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
    return s;
  }
  // A short burst of noise, shaped by `env` (attack, hold, decay seconds),
  // into `out` through the filters given ([type, freq, Q] each, in series).
  function burst(t, out, level, decay, filters, attack = 0.001) {
    const s = noise(t, decay + 0.05);
    let node = s;
    for (const [type, f, Q] of filters) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q) b.Q.value = Q; node.connect(b); node = b; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g).connect(out);
  }
  const roomLevel = () => (windingDown ? 0.6 : 1) * (0.85 + 0.15 * (1 - zoom));

  /* ---------------- the fire ---------------- */
  function startFire() {
    const t = now();
    // The burning itself: a soft, low roar that breathes.
    const bed = ctx.createBufferSource(); bed.buffer = brownBuf; bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.05;
    bed.connect(lp).connect(bedGain).connect(fireBus); bed.start(t);
    const breathe = () => { if (!ctx || disposed) return; bedGain.gain.setTargetAtTime(0.04 + Math.random() * 0.04, now(), 0.4); lp.frequency.setTargetAtTime(380 + Math.random() * 320, now(), 0.5); later(breathe, 600 + Math.random() * 900); };
    breathe();
    // A faint hiss of sap.
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5200;
    const hissGain = ctx.createGain(); hissGain.gain.value = 0.005;
    hiss.connect(hp).connect(hissGain).connect(fireBus); hiss.start(t);
    // Crackles, now one, now a run of them; a pop now and then. A little
    // louder than they were (user: "hear the crackle a bit more").
    const crackle = () => {
      if (!ctx || disposed) return;
      const t0 = now(), n = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 5) : 1;
      for (let i = 0; i < n; i++) {
        const at = t0 + i * (0.015 + Math.random() * 0.06), big = Math.random() < 0.12;
        const f = big ? 700 + Math.random() * 500 : 1800 + Math.random() * 3200;
        burst(at, fireBus, big ? 0.14 : 0.035 + Math.random() * 0.07, big ? 0.05 : 0.012 + Math.random() * 0.02, [["bandpass", f, big ? 3 : 1.2]], 0.0008);
      }
      later(crackle, 110 + Math.random() * (Math.random() < 0.2 ? 2000 : 650));
    };
    crackle();
  }

  /* ---------------- the clock ---------------- */
  // Tick, tock: the escapement's click ringing the clock's wooden case,
  // the tick a little higher than the tock. Quiet.
  function tickTock(t, tock) {
    burst(t, roomBus, tock ? 0.05 : 0.042, tock ? 0.03 : 0.022, [["highpass", 380, 0.7], ["bandpass", tock ? 1350 : 1900, 7]]);
    burst(t, roomBus, tock ? 0.04 : 0.028, tock ? 0.045 : 0.03, [["bandpass", tock ? 520 : 690, 6]]);
  }
  // The hour: the Westminster melody from a chime chip — a bright square
  // wave dying away like a bell — through a speaker the size of a coin.
  function chime() {
    const t0 = now() + 0.05;
    chimes++;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 460; hp.Q.value = 0.8;
    const peak = ctx.createBiquadFilter(); peak.type = "peaking"; peak.frequency.value = 1900; peak.Q.value = 1.4; peak.gain.value = 7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3600;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    shaper.curve = curve;
    const out = ctx.createGain(); out.gain.value = 0.2;
    hp.connect(peak).connect(lp).connect(shaper).connect(out).connect(roomBus);
    const beat = 0.62, phrase = 4 * beat + 0.95;
    HOUR_CHIME.forEach((notes, p) => notes.forEach((f, i) => {
      const at = t0 + p * phrase + i * beat, ring = i === 3 ? 1.6 : 1.0;
      [[f, "square", 0.05], [f * 2, "triangle", 0.025]].forEach(([freq, type, lvl]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(lvl, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
        o.connect(g).connect(hp); o.start(at); o.stop(at + ring + 0.05);
      });
    }));
  }
  function startClock() {
    let tock = false;
    const beat = () => {
      if (!ctx || disposed) return;
      tickTock(now() + 0.02, tock);
      tock = !tock;
      // On the device's hour, once.
      const d = new Date();
      if (d.getMinutes() === 0 && d.getSeconds() < 3 && lastChimeHour !== d.getHours()) { lastChimeHour = d.getHours(); chime(); }
      // On the next real second.
      later(beat, 1000 - (Date.now() % 1000) + 2);
    };
    later(beat, 1000 - (Date.now() % 1000) + 2);
  }

  /* ---------------- the rain ---------------- */
  function startRain() {
    const t = now();
    // A steady hiss of rain on the patio: it doesn't rise and fall (that
    // read as wind).
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1300;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7200;
    const g = ctx.createGain(); g.gain.value = 0.008;
    src.connect(hp).connect(lp).connect(g).connect(roomBus); src.start(t);
    // Patter on the glass: many small clicks.
    const patter = () => {
      if (!ctx || disposed) return;
      burst(now() + 0.01, roomBus, 0.006 + Math.random() * 0.01, 0.006 + Math.random() * 0.008, [["bandpass", 2600 + Math.random() * 4200, 2.5]], 0.0005);
      later(patter, 25 + Math.random() * 110);
    };
    patter();
    // A drip from the eaves onto the patio now and then.
    const drip = () => {
      if (!ctx || disposed) return;
      const at = now() + 0.01;
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(1300 + Math.random() * 500, at); o.frequency.exponentialRampToValueAtTime(650, at + 0.045);
      const dg = ctx.createGain(); dg.gain.setValueAtTime(0.004 + Math.random() * 0.004, at); dg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
      o.connect(dg).connect(roomBus); o.start(at); o.stop(at + 0.08);
      later(drip, 900 + Math.random() * 3200);
    };
    later(drip, 1200);
  }

  function startRoom() {
    ensureGraph();
    if (!ctx || roomOn) return;
    roomOn = true;
    startFire(); startClock(); startRain();
    roomBus.gain.setTargetAtTime(roomLevel(), now(), 1.2);
  }

  /* ---------------- the stereo console ---------------- */
  function stopMusic() {
    if (!music) return;
    const m = music;
    music = null;
    try { m.el.pause(); } catch (e) { /* gone */ }
    try { m.src.disconnect(); } catch (e) { /* gone */ }
    m.extra.forEach((n) => { try { n.stop ? n.stop() : null; n.disconnect(); } catch (e) { /* gone */ } });
  }
  // A track on the record player (a little surface noise) or the 8-track
  // (a little tape hiss, the top rolled off).
  function playMusic(track, onEnd) {
    ensureGraph();
    if (!ctx || !track || !track.url) return false;
    stopMusic();
    const el = new Audio();
    el.src = track.url; el.loop = !!track.loop; el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = track.medium === "8track" ? 9000 : 13000;
    src.connect(tone).connect(musicBus);
    const extra = [tone];
    const bed = ctx.createBufferSource(); bed.buffer = noiseBuf; bed.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = track.medium === "8track" ? "highpass" : "bandpass"; bf.frequency.value = track.medium === "8track" ? 6000 : 2400;
    const bg = ctx.createGain(); bg.gain.value = track.medium === "8track" ? 0.0025 : 0.0018;
    bed.connect(bf).connect(bg).connect(musicBus); bed.start();
    extra.push(bed, bf, bg);
    music = { el, src, extra, track };
    el.addEventListener("ended", () => { if (music && music.el === el) { stopMusic(); if (onEnd) onEnd(); } });
    const p = el.play();
    if (p && p.catch) p.catch(() => { /* the first gesture will start it */ });
    return true;
  }

  const cue = (fn) => (...args) => { ensureGraph(); if (wood) fn(...args); };

  return {
    ensureStarted() {
      ensureGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      startRoom();
    },
    beginGameFadeIn() { windingDown = false; startRoom(); if (ctx) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.8); },
    setZoom(z) { zoom = z; if (ctx && roomOn) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.5); },
    setMuted(m) { muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.08); },
    // One of the switches: "room", "stereo" or "pieces".
    setChannelMuted(ch, off) {
      if (!(ch in channelOff)) return;
      channelOff[ch] = !!off;
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(off ? 0 : 1, now(), 0.05);
    },
    /* Where the fire is from the camera (den-fx.js, every frame): its
       distance in board units and which side it's on (-1 left .. 1 right).
       Nearer is louder: about as it is from the middle of the pit (70
       units), twice that close enough to warm your hands, half across the
       room. */
    setFireListener(distance, pan) {
      fireNear = Math.max(0.35, Math.min(2.5, Math.pow(70 / Math.max(distance, 12), 1.2)));
      if (!ctx) return;
      fireBus.gain.setTargetAtTime(fireNear, now(), 0.25);
      if (firePan) firePan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), now(), 0.25);
    },
    playMusic,
    stopMusic,
    musicPlaying() { return music ? music.track.id : null; },
    setTension() {},
    // The end of a game: the room settles a little.
    beginFadeOut() { windingDown = true; if (ctx && roomOn) roomBus.gain.setTargetAtTime(roomLevel(), now(), 1.5); },
    resetWindDown() { windingDown = false; if (ctx && roomOn) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.8); },
    playSelect: cue(() => wood.select()),
    playDeselect: cue(() => wood.deselect()),
    playBlocked: cue(() => wood.blocked()),
    playRollStart: cue((units, durationMs) => wood.rollStart(units, durationMs)),
    // units: the piece's cubes; contact: the squares its landing face covers.
    playLanding: cue((units, contact) => wood.landing(units, contact)),
    playCapture: cue(() => wood.capture()),
    // A win: a marimba's two soft notes, up a fifth.
    playWin: cue(() => {
      const t = now();
      [[523.25, 0], [783.99, 0.18], [1046.5, 0.36]].forEach(([f, d]) => {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.frequency.value = f * 4;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.1);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.012, t + d); g2.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
        o.connect(g).connect(sfxBus); o2.connect(g2).connect(sfxBus);
        o.start(t + d); o2.start(t + d); o.stop(t + d + 1.2); o2.stop(t + d + 0.3);
      });
    }),
    playMenu() {}, fadeOutMenu() {}, stopMenu() {}, playRulesOpen() {}, playRulesClose() {}, playRulesTab() {}, playPowerOn() {},
    playPowerOff() {}, playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {},
    /* Singularity is Neon's, but the chassis calls every audio method on
       every theme, so these are here as no-ops. */
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {},
    playSingularityDismiss() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    playDockOpen() {}, playDockClose() {},
    debugState() { return { ctx: !!ctx, ctxState: ctx ? ctx.state : null, muted, roomOn, channelsOff: { ...channelOff } }; },
    dispose() {
      disposed = true;
      stopMusic();
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
}
