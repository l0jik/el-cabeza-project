/* The den's sound: a quiet room on a wet evening, and the game's wood.

   - The fire: a low roar of burning, and crackles and pops, never on a
     beat.
   - The clock on the mantel ticking the real seconds, tick and tock.
   - Rain against the glass door, now heavier, now lighter, a drop
     running now and then; rarely, thunder a long way off.
   - The pieces: Tienda's wood (wood-sfx.js), on a solid board (the
     player's choice for Standard), with a small room round them.

   Two switches for the sound menu (standard.js soundChannels): "room" (the
   fire, the clock, the rain) and "pieces". Everything is made here, in
   the browser; nothing is loaded. Built on the first gesture; the room
   starts then, so the fire is already going on the setup screen. */

import { createWoodSfx } from "./wood-sfx.js";

export const hasAudio = true;

export function createAudio() {
  let ctx = null, master = null, comp = null, roomBus = null, sfxBus = null, wood = null;
  let noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, roomOn = false, disposed = false;
  let zoom = 0.5;
  const channelOff = { room: false, pieces: false };
  const gates = { room: null, pieces: null };
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
      // The room (fire, clock, rain) and the pieces, each behind its switch.
      gates.room = ctx.createGain(); gates.room.gain.value = channelOff.room ? 0 : 1;
      roomBus = ctx.createGain(); roomBus.gain.value = 0;
      roomBus.connect(gates.room).connect(master);
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
          gates: { room: gates.room.gain.value, pieces: gates.pieces.gain.value },
          room: roomBus.gain.value,
        });
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
  const roomLevel = () => (windingDown ? 0.6 : 1) * (0.85 + 0.15 * (1 - zoom));

  /* ---------------- the fire ---------------- */
  function startFire() {
    const t = now();
    // The burning itself: a soft, low roar that breathes.
    const bed = ctx.createBufferSource(); bed.buffer = brownBuf; bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.05;
    bed.connect(lp).connect(bedGain).connect(roomBus); bed.start(t);
    const breathe = () => { if (!ctx || disposed) return; bedGain.gain.setTargetAtTime(0.035 + Math.random() * 0.04, now(), 0.4); lp.frequency.setTargetAtTime(380 + Math.random() * 320, now(), 0.5); later(breathe, 600 + Math.random() * 900); };
    breathe();
    // A faint hiss of sap.
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5200;
    const hissGain = ctx.createGain(); hissGain.gain.value = 0.004;
    hiss.connect(hp).connect(hissGain).connect(roomBus); hiss.start(t);
    // Crackles, now one, now a run of them; a pop now and then.
    const crackle = () => {
      if (!ctx || disposed) return;
      const t0 = now(), n = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 5) : 1;
      for (let i = 0; i < n; i++) {
        const at = t0 + i * (0.015 + Math.random() * 0.06), big = Math.random() < 0.12;
        const c = noise(at, 0.03), bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = big ? 700 + Math.random() * 500 : 1800 + Math.random() * 3200; bp.Q.value = big ? 3 : 1.2;
        const g = ctx.createGain(); const lvl = (big ? 0.09 : 0.02 + Math.random() * 0.045);
        g.gain.setValueAtTime(lvl, at); g.gain.exponentialRampToValueAtTime(0.0001, at + (big ? 0.05 : 0.012 + Math.random() * 0.02));
        c.connect(bp).connect(g).connect(roomBus);
      }
      later(crackle, 120 + Math.random() * (Math.random() < 0.2 ? 2200 : 700));
    };
    crackle();
  }

  /* ---------------- the clock ---------------- */
  function startClock() {
    let tick = true;
    const beat = () => {
      if (!ctx || disposed) return;
      const t = now() + 0.02;
      const f = tick ? 3100 : 2500;
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0065, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g).connect(roomBus); o.start(t); o.stop(t + 0.05);
      const c = noise(t, 0.01), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = tick ? 4200 : 3400; bp.Q.value = 2;
      const cg = ctx.createGain(); cg.gain.setValueAtTime(0.014, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
      c.connect(bp).connect(cg).connect(roomBus);
      tick = !tick;
      // On the next real second.
      later(beat, 1000 - (Date.now() % 1000) + 2);
    };
    later(beat, 1000 - (Date.now() % 1000) + 2);
  }

  /* ---------------- the rain ---------------- */
  function startRain() {
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.012;
    src.connect(bp).connect(lp).connect(g).connect(roomBus); src.start(t);
    // Heavier, lighter.
    const swell = () => { if (!ctx || disposed) return; g.gain.setTargetAtTime(0.006 + Math.random() * 0.016, now(), 3); later(swell, 5000 + Math.random() * 9000); };
    swell();
    // Drops striking the glass.
    const drop = () => {
      if (!ctx || disposed) return;
      const at = now() + 0.01;
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(3800 + Math.random() * 2600, at); o.frequency.exponentialRampToValueAtTime(1800, at + 0.02);
      const dg = ctx.createGain(); dg.gain.setValueAtTime(0.0035 + Math.random() * 0.004, at); dg.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
      o.connect(dg).connect(roomBus); o.start(at); o.stop(at + 0.04);
      later(drop, 60 + Math.random() * 420);
    };
    drop();
    // Thunder, a long way off, rarely.
    const thunder = () => {
      if (!ctx || disposed) return;
      const at = now() + 0.05, dur = 4 + Math.random() * 3;
      const n = noise(at, dur, true), tl = ctx.createBiquadFilter(); tl.type = "lowpass"; tl.frequency.value = 160;
      const tg = ctx.createGain(); tg.gain.setValueAtTime(0, at); tg.gain.linearRampToValueAtTime(0.09, at + 0.8); tg.gain.setTargetAtTime(0, at + 1.6, dur / 4);
      n.connect(tl).connect(tg).connect(roomBus);
      later(thunder, 110000 + Math.random() * 140000);
    };
    later(thunder, 45000 + Math.random() * 60000);
  }

  function startRoom() {
    ensureGraph();
    if (!ctx || roomOn) return;
    roomOn = true;
    startFire(); startClock(); startRain();
    roomBus.gain.setTargetAtTime(roomLevel(), now(), 1.2);
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
    // One of the two switches: "room" or "pieces".
    setChannelMuted(ch, off) {
      if (!(ch in channelOff)) return;
      channelOff[ch] = !!off;
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(off ? 0 : 1, now(), 0.05);
    },
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
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
}
