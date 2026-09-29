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
   - The television (den-tv.js): its switch, the tube warming up, the
     snow, the station's tone, the set going off (tvOn, tvHiss, tvTone,
     tvOff), behind the Music switch with the stereo.
   - The pieces: Tienda's wood (wood-sfx.js), on a solid board (the
     player's choice for Standard), with a small room round them.

   Three switches for the sound menu (standard.js soundChannels): "room"
   (the fire, the clock, the rain), "stereo" (shown as Music) and "pieces". Everything but
   the music is made here, in the browser. Built on the first gesture; the
   room starts then, so the fire is already going on the setup screen. */

import { createWoodSfx } from "./wood-sfx.js";
import { CUES as AD, COMMERCIAL_MS } from "./den-commercial.js";
// The commercial's voice-over, beside the page (build/build.js).
const AD_VOICE_URL = "el-cabeza-den-ad-voice.mp3";
const AD_KINGS_URL = "el-cabeza-den-ad-voice-2.mp3"; // "the new king!" x3, at the sign-off
const AD_CHESS_URL = "el-cabeza-den-ad-voice-3.mp3"; // "Take a hike, chess!"
const AD_CHECKERS_URL = "el-cabeza-den-ad-voice-4.mp3"; // "Get outta here, Checkers!"
const AD_VOICE_GAIN = 0.12;

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
  // Each channel's level on the sound menu's slider (0..1; 0 is off), heard
  // as its square so the slider moves about evenly in loudness.
  const channelLevel = { room: 1, stereo: 1, pieces: 1 };
  const chGain = (ch) => (channelOff[ch] ? 0 : channelLevel[ch] * channelLevel[ch]);
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
      gates.room = ctx.createGain(); gates.room.gain.value = chGain("room");
      roomBus = ctx.createGain(); roomBus.gain.value = 0;
      roomBus.connect(gates.room).connect(master);
      fireBus = ctx.createGain(); fireBus.gain.value = fireNear;
      firePan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (firePan) fireBus.connect(firePan).connect(roomBus); else fireBus.connect(roomBus);
      gates.stereo = ctx.createGain(); gates.stereo.gain.value = chGain("stereo");
      musicBus = ctx.createGain(); musicBus.gain.value = 0.9;
      musicBus.connect(gates.stereo).connect(master);
      const musicRoom = ctx.createGain(); musicRoom.gain.value = 0.12;
      gates.stereo.connect(musicRoom).connect(verb);
      gates.pieces = ctx.createGain(); gates.pieces.gain.value = chGain("pieces");
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
          haunt: { near: hauntNear, pan: hauntSide, distance: hauntDist },
          chimes,
          music: music ? { id: music.track.id, medium: music.track.medium, paused: music.el.paused, time: music.el.currentTime } : null,
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
  // The room (fire, clock, rain) steps back while a record or a tape
  // plays, as it would for someone listening (user: the music was lost
  // under the room's hiss of rain and fire).
  const MUSIC_DUCK = 0.35;
  const roomLevel = () => (windingDown ? 0.6 : 1) * (0.85 + 0.15 * (1 - zoom)) * (music && !music.el.paused ? MUSIC_DUCK : 1);
  const roomFollowMusic = () => { if (ctx && roomOn && roomBus) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.9); };

  /* ---------------- the fire ---------------- */
  function startFire() {
    const t = now();
    // The burning itself: a low, steady hearth rumble, well under the
    // crackles. It used to breathe (its level and brightness drifting
    // every second or so) and, louder and nearer since the fire follows
    // the listener, that rise and fall read as wind (user: no wind), so
    // it holds still now.
    const bed = ctx.createBufferSource(); bed.buffer = brownBuf; bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.022;
    bed.connect(lp).connect(bedGain).connect(fireBus); bed.start(t);
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
    roomFollowMusic();
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
    // A track already put through the console's treatment (track.treated:
    // tools/console_1974_turntable.py) has its hiss and crackle in it.
    if (!track.treated) {
      const bed = ctx.createBufferSource(); bed.buffer = noiseBuf; bed.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = track.medium === "8track" ? "highpass" : "bandpass"; bf.frequency.value = track.medium === "8track" ? 6000 : 2400;
      const bg = ctx.createGain(); bg.gain.value = track.medium === "8track" ? 0.0025 : 0.0018;
      bed.connect(bf).connect(bg).connect(musicBus); bed.start();
      extra.push(bed, bf, bg);
    }
    music = { el, src, extra, track };
    roomFollowMusic();
    el.addEventListener("ended", () => { if (music && music.el === el) { stopMusic(); if (onEnd) onEnd(); } });
    const p = el.play();
    if (p && p.catch) p.catch(() => { /* the first gesture will start it */ });
    return true;
  }

  // The needle lifted and set down again (the now-playing chip's pause):
  // the track keeps its place, and the room comes back up while it waits.
  function pauseMusic() {
    if (!music || music.el.paused) return;
    try { music.el.pause(); } catch (e) { /* gone */ }
    roomFollowMusic();
  }
  function resumeMusic() {
    if (!music || !music.el.paused) return;
    if (ctx && ctx.state === "suspended") ctx.resume();
    const p = music.el.play();
    if (p && p.catch) p.catch(() => { /* the next gesture */ });
    roomFollowMusic();
  }

  /* ---------------- the television (den-tv.js) ---------------- */
  // The set's own sounds, behind the Music switch with the stereo: the
  // power switch's click, the tube coming up (the degauss coil's thump,
  // the line whine high and faint), the snow's hiss, a station's tone, and
  // the set going off.
  let tv = null; // { bus, hissGain, whine, whineGain }
  function tvGraph() {
    ensureGraph();
    if (!ctx) return null;
    if (tv) return tv;
    const bus = ctx.createGain();
    bus.connect(gates.stereo);
    const hissGain = ctx.createGain(); hissGain.gain.value = 0;
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3800; bp.Q.value = 0.5;
    hiss.connect(bp).connect(hissGain).connect(bus);
    hiss.start();
    tv = { bus, hissGain, whine: null, whineGain: null, ad: null, adVoices: [] };
    return tv;
  }
  function tvClick(t) {
    burst(t, tv.bus, 0.22, 0.035, [["bandpass", 2400, 2]]);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(tv.bus); o.start(t); o.stop(t + 0.12);
  }
  function tvOn() {
    if (!tvGraph()) return;
    const t = now();
    tvClick(t);
    [60, 120, 180].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i ? "sine" : "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.12); g.gain.linearRampToValueAtTime(0.16 / (i + 1), t + 0.16); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(tv.bus); o.start(t + 0.12); o.stop(t + 1.2);
    });
    if (!tv.whine) {
      const o = ctx.createOscillator(); o.frequency.value = 15734;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.006, t + 1.2);
      o.connect(g).connect(tv.bus); o.start(t);
      tv.whine = o; tv.whineGain = g;
    }
  }
  function tvOff() {
    if (!tvGraph()) return;
    const t = now();
    tvClick(t);
    if (tv.ad) { tv.ad.gain.setTargetAtTime(0, t, 0.015); tv.ad = null; }
    tv.adVoices.forEach((el) => { try { el.pause(); } catch (e) { /* gone */ } });
    tv.adVoices = [];
    tv.hissGain.gain.setTargetAtTime(0, t, 0.05);
    if (tv.whine) {
      tv.whine.frequency.setTargetAtTime(9000, t, 0.4);
      tv.whineGain.gain.setTargetAtTime(0.0001, t + 0.05, 0.25);
      tv.whine.stop(t + 1.6);
      tv.whine = tv.whineGain = null;
    }
    burst(t + 0.42, tv.bus, 0.08, 0.06, [["lowpass", 500]]);
  }

  /* The set, off, stirring (den-tv.js haunt, den-fx.js's lure): the
     sounds of a set that shouldn't be making any, through its own small
     speaker, and part of the room (the Room channel, so it's heard with
     the music off). Placed at the set (setTvListener: louder near it, from
     its side of the room), so a player looking elsewhere turns to it
     (user). kind: flicker (a tick of static), pilot (a relay chattering),
     thump (the degauss coil kicking, a buzz), static (a breath of snow),
     roll (the hum of a vertical hold slipping), tune (a dial being turned:
     the band swept, a heterodyne whistle), ghost (a far-off warble, as if
     from another station), voice (a garbled announcer, words that aren't
     quite), phantom (a swell of static and a shimmer rising), flash (the
     Singularity's frame: a push of sub-bass and a glint). strength
     0 to 1. */
  let hauntBus = null, hauntPan = null, hauntNear = 1, hauntSide = 0, hauntDist = 0;
  function tvHaunt(kind, strength = 0.5) {
    ensureGraph();
    if (!ctx) return;
    if (!hauntBus) {
      hauntBus = ctx.createGain(); hauntBus.gain.value = hauntNear;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1600; bp.Q.value = 0.3;
      hauntPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (hauntPan) { hauntPan.pan.value = hauntSide; hauntBus.connect(bp).connect(hauntPan).connect(gates.room); }
      else hauntBus.connect(bp).connect(gates.room);
    }
    const t = now(), k = 0.5 + 0.5 * strength;
    const tone = (f, f2, dur, level, type = "sine", vib = 0, at = t) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f, at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
      if (vib) { const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(at); l.stop(at + dur + 0.1); }
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(level * k, at + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(hauntBus); o.start(at); o.stop(at + dur + 0.05);
      return o;
    };
    if (kind === "flicker") burst(t, hauntBus, 0.08 * k, 0.06, [["bandpass", 3600, 1.2]]);
    else if (kind === "pilot") { for (let i = 0; i < 5; i++) burst(t + i * (0.07 + Math.random() * 0.1), hauntBus, 0.06 * k, 0.014, [["bandpass", 4200, 3]]); }
    else if (kind === "thump") {
      tone(70, 38, 0.32, 0.3, "sine");
      tone(120, 90, 0.28, 0.07, "sawtooth");
      burst(t, hauntBus, 0.12 * k, 0.12, [["lowpass", 900]]);
      burst(t + 0.02, hauntBus, 0.05 * k, 0.2, [["bandpass", 3000, 0.8]], 0.01);
    } else if (kind === "static") { burst(t, hauntBus, 0.13 * k, 0.3 + 0.45 * strength, [["bandpass", 3200, 0.7]], 0.03); burst(t, hauntBus, 0.06 * k, 0.02, [["highpass", 2000]]); }
    else if (kind === "roll") { tone(60, 0, 1.4, 0.13, "triangle"); tone(120, 0, 1.2, 0.05); tone(15734, 15400, 1.3, 0.006); }
    else if (kind === "tune") {
      // The band swept by hand: noise through a moving filter, a whistle
      // that slides with it, a station almost caught.
      const s = noise(t, 1.3);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 4;
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.55); bp.frequency.exponentialRampToValueAtTime(900, t + 1.25);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * k, t + 0.08); g.gain.setValueAtTime(0.16 * k, t + 1.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      s.connect(bp).connect(g).connect(hauntBus);
      const w = tone(1100, 0, 1.25, 0.035, "sine");
      w.frequency.exponentialRampToValueAtTime(3400, t + 0.55); w.frequency.exponentialRampToValueAtTime(700, t + 1.25);
      tone(392, 0, 0.35, 0.03, "square", 0, t + 0.5);
    } else if (kind === "ghost") { tone(523, 494, 1.3, 0.04, "sine", 9); tone(659, 622, 1.2, 0.026, "sine", 7); burst(t, hauntBus, 0.07 * k, 0.45, [["bandpass", 2800, 0.8]], 0.08); }
    else if (kind === "voice") {
      // An announcer from nowhere: a low buzz through two formants that
      // jump from vowel to vowel, in syllables, the pitch sagging.
      const dur = 1.4, o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(128, t); o.frequency.linearRampToValueAtTime(96, t + dur);
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      f1.type = f2.type = "bandpass"; f1.Q.value = 7; f2.Q.value = 9;
      const vowels = [[730, 1090], [270, 2290], [570, 840], [300, 870], [660, 1720], [440, 1020]];
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      let at = t;
      while (at < t + dur - 0.1) {
        const [a, b] = vowels[Math.floor(Math.random() * vowels.length)], syl = 0.09 + Math.random() * 0.13;
        f1.frequency.setValueAtTime(a, at); f2.frequency.setValueAtTime(b, at);
        g.gain.linearRampToValueAtTime(0.22 * k, at + 0.02); g.gain.linearRampToValueAtTime(0.03 * k, at + syl);
        at += syl + (Math.random() < 0.25 ? 0.08 : 0.015);
      }
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(hauntBus);
      o.start(t); o.stop(t + dur + 0.05);
      burst(t, hauntBus, 0.05 * k, dur, [["bandpass", 3000, 0.6]], 0.1);
    } else if (kind === "flash") {
      // The Singularity for an instant: a sub-bass push and a glint, gone.
      tone(55, 40, 0.12, 0.22, "sine");
      tone(2400, 5200, 0.06, 0.025, "sine");
    } else if (kind === "phantom") { burst(t, hauntBus, 0.14 * k, 0.8, [["bandpass", 3000, 0.6]], 0.15); tone(220, 1760, 1.9, 0.04, "sine", 14); tone(330, 2640, 1.7, 0.024, "triangle", 10); }
  }

  /* The late-night commercial's sound (den-commercial.js, cued to its
     CUES): a home organ with its rhythm box on the bossa nova preset, a
     sad trombone for chess, the stamp, a slide whistle, a cymbal, bells
     for the special orders, the typewriter, a boing, the telephone for
     Dale, and the hum of the station's tape machine under it all. Through
     the set's own small speaker, and all of it stopped by tvOff. */
  function tvCommercial(delay = 0) {
    if (!tvGraph()) return;
    if (tv.ad) { tv.ad.gain.setTargetAtTime(0, now(), 0.02); tv.ad = null; }
    tv.adVoices.forEach((el) => { try { el.pause(); } catch (e) { /* gone */ } });
    tv.adVoices = [];
    const T = now() + 0.05 + delay;
    const out = ctx.createGain(); out.gain.value = 1;
    // The speaker: no lows, no highs, a little crunch.
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 260;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200;
    const sh = ctx.createWaveShaper(); const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8); }
    sh.curve = curve;
    // The station's videotape: wow and flutter (a delay line whose length
    // wanders, so the pitch does), and tearing (the sound dropping out and
    // buzzing where the picture rolls or the tracking goes).
    const wob = ctx.createDelay(0.1); wob.delayTime.value = 0.03;
    [[0.47, 0.0024], [6.8, 0.00035], [13.1, 0.00012]].forEach(([f, d]) => {
      const l = ctx.createOscillator(); l.frequency.value = f; const lg = ctx.createGain(); lg.gain.value = d;
      l.connect(lg).connect(wob.delayTime); l.start(T - 0.05); l.stop(T + COMMERCIAL_MS / 1000 + 1);
    });
    const tear = ctx.createGain(); tear.gain.value = 1;
    out.connect(wob).connect(tear).connect(hp).connect(lp).connect(sh).connect(tv.bus);
    tv.ad = out;
    const end = T + COMMERCIAL_MS / 1000;
    {
      // Where it tears: the picture's rolls (every other cut, as the
      // picture does it), and now and then where the tracking band is.
      const cuts = [AD.title, AD.chess, AD.king, AD.orders, AD.best, AD.dealer, AD.price, AD.close, AD.credit].filter((_, i) => i % 2 === 0);
      const at = cuts.map((c) => [c, 0.22]);
      for (let k = 0.6; k < AD.snow; k += 9) at.push([k + 0.4 + Math.random() * 1.6, 0.08 + Math.random() * 0.1]);
      for (let k = 3; k < AD.snow - 1; k += 4 + Math.random() * 4) at.push([k, 0.05 + Math.random() * 0.06]);
      // The subliminal frames: the sound just stops for them, no buzz.
      AD.flash.forEach((c, i) => at.push([c, i >= 3 ? 0.17 : 0.09, true]));
      at.sort((a, b) => a[0] - b[0]);
      let last = -1;
      at.forEach(([c, d, quiet]) => {
        if (c < last + 0.1 && !quiet) return;
        last = c + d;
        const t = T + c;
        if (quiet) { tear.gain.setValueAtTime(1, t - 0.005); tear.gain.linearRampToValueAtTime(0.03, t); tear.gain.setValueAtTime(0.03, t + d - 0.005); tear.gain.linearRampToValueAtTime(1, t + d); return; }
        tear.gain.setValueAtTime(1, t); tear.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.2, t + 0.012);
        tear.gain.setValueAtTime(0.25, t + d * 0.6); tear.gain.linearRampToValueAtTime(1, t + d);
        // The head's buzz: the field rate, raspy.
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 59.94;
        const bf = ctx.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 1400; bf.Q.value = 0.8;
        const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.035, t + 0.004); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + d);
        o.connect(bf).connect(bg).connect(hp); o.start(t); o.stop(t + d + 0.05);
        burst(t, hp, 0.03, d * 0.8, [["highpass", 2500]]);
      });
    }
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    // The home organ: square and triangle, a vibrato, keyed on and off.
    const organ = (t, notes, dur, level = 0.045) => {
      notes.forEach((m) => {
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + 0.012); g.gain.setValueAtTime(level, t + dur - 0.03); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        const vib = ctx.createOscillator(); vib.frequency.value = 6.2; const vg = ctx.createGain(); vg.gain.value = hz(m) * 0.006; vib.connect(vg);
        [["square", 0.35], ["triangle", 1]].forEach(([type, k]) => {
          const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); vg.connect(o.frequency);
          const og = ctx.createGain(); og.gain.value = k; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.02);
        });
        vib.start(t); vib.stop(t + dur + 0.02);
        g.connect(out);
      });
    };
    const tone = (t, f, d, level, type = "sine") => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); env(g, t, 0.003, level, d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); return o; };
    const bell = (t, m, level = 0.05) => { tone(t, hz(m), 1.1, level); tone(t, hz(m) * 2.76, 0.4, level * 0.35); tone(t, hz(m) * 5.4, 0.18, level * 0.15); };
    // The tape machine's hum, the whole way through.
    [60, 120, 180].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(0.008 / (i + 1), T + 0.3); g.gain.setValueAtTime(0.008 / (i + 1), T + AD.snow - 0.05); g.gain.linearRampToValueAtTime(0.0001, T + AD.snow); o.connect(g).connect(out); o.start(T); o.stop(T + AD.snow + 0.1); });
    // The rhythm box (bossa nova preset) and the organ's pedals, C F G C.
    const beat = 0.5, bar = beat * 4;
    const box = (from, to) => {
      for (let b = 0; from + b * bar < to - 0.01; b++) {
        const t0 = from + b * bar, root = [48, 53, 55, 48][b % 4];
        [0, 1.5, 2, 3.5].forEach((k) => { const t = T + t0 + k * beat; if (t0 + k * beat >= to) return; const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); const g = ctx.createGain(); env(g, t, 0.002, 0.07, 0.16); o.connect(g).connect(out); o.start(t); o.stop(t + 0.2); });
        [0, 0.75, 1.5, 2.5, 3].forEach((k) => { if (t0 + k * beat < to) tone(T + t0 + k * beat, 2500, 0.03, 0.02); });
        for (let k = 0; k < 8; k++) if (t0 + k * beat * 0.5 < to) burst(T + t0 + k * beat * 0.5, out, 0.012, 0.03, [["highpass", 7000]]);
        [0, 2].forEach((k) => { if (t0 + k * beat < to) organ(T + t0 + k * beat, [root - 12], beat * 1.6, 0.05); });
        [0.5, 1.5, 2.5, 3.5].forEach((k) => { if (t0 + k * beat < to) organ(T + t0 + k * beat, [root + 12, root + 16, root + 19].map((m) => (m > 72 ? m - 12 : m)), beat * 0.35, 0.018); });
      }
    };
    // (Not under the king's line: the voice has the scene to itself.)
    box(AD.title + 0.5, AD.stamp);
    box(AD.orders, AD.best);
    box(AD.dealer, AD.never);
    // "El Ca-be-za!" on the organ: G A C . E, at the top and at the end.
    const motif = (t) => [[67, 0, 0.22], [69, 0.25, 0.22], [72, 0.5, 0.22], [76, 0.8, 0.7]].forEach(([m, d, l]) => organ(T + t + d, [m, m - 12], l, 0.05));
    motif(AD.title + 0.05);
    organ(T + AD.title + 0.9, [60, 64, 67, 72], 0.9, 0.035);
    // The letters popping up.
    for (let i = 0; i < 9; i++) { const t = T + AD.title + 0.35 + i * 0.12; const o = tone(t, 500 + i * 70, 0.09, 0.03, "triangle"); o.frequency.exponentialRampToValueAtTime(900 + i * 90, t + 0.06); }
    // Chess: the sad trombone.
    [[55, 0], [54, 0.22], [53, 0.44], [52, 0.66]].forEach(([m, d], i) => {
      const t = T + AD.chess + 0.1 + d, l = i === 3 ? 0.4 : 0.2;
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m);
      if (i === 3) { const w = ctx.createOscillator(); w.frequency.value = 5; const wg = ctx.createGain(); wg.gain.value = 5; w.connect(wg).connect(o.frequency); w.start(t); w.stop(t + l); }
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.05); g.gain.setValueAtTime(0.05, t + l - 0.08); g.gain.linearRampToValueAtTime(0.0001, t + l);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + l + 0.02);
    });
    // The stamp, and the pawn run off on a slide whistle.
    [[AD.stamp], [AD.stamp2]].forEach(([at]) => { const t = T + at; burst(t, out, 0.22, 0.12, [["lowpass", 900]]); const o = tone(t, 120, 0.25, 0.12); o.frequency.exponentialRampToValueAtTime(50, t + 0.2); });
    [[AD.flee, 700, 2300], [AD.flee2, 2300, 600]].forEach(([at, f0, f1]) => { const t = T + at; const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.55); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.6); o.connect(g).connect(out); o.start(t); o.stop(t + 0.65); });
    // The sleepers: two snores, in turn, before the stamp wakes nobody.
    [0.25, 0.6].forEach((d, i) => {
      const t = T + AD.checker + d;
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(i ? 70 : 92, t); o.frequency.linearRampToValueAtTime(i ? 58 : 76, t + 0.35);
      const am = ctx.createOscillator(); am.frequency.value = 26; const amg = ctx.createGain(); amg.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.12); g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 700;
      am.connect(amg).connect(g.gain);
      o.connect(lpf).connect(g).connect(out); o.start(t); am.start(t); o.stop(t + 0.45); am.stop(t + 0.45);
    });
    // The king: a cymbal, then the voice (the user's recording, a file
    // beside the page: build/build.js), and a sparkle as it trails off.
    burst(T + AD.king, out, 0.06, 1.4, [["highpass", 5000]]);
    const voice = (url, at) => {
      const el = new Audio();
      el.src = url; el.preload = "auto";
      const vg = ctx.createGain(); vg.gain.value = AD_VOICE_GAIN;
      ctx.createMediaElementSource(el).connect(vg).connect(out);
      tv.adVoices.push(el);
      setTimeout(() => { if (tv && tv.ad === out) { const p = el.play(); if (p && p.catch) p.catch(() => { /* no sound, then */ }); } }, Math.max(0, (T + at - now()) * 1000));
    };
    voice(AD_CHESS_URL, AD.chessVoice);
    voice(AD_CHECKERS_URL, AD.checkersVoice);
    voice(AD_VOICE_URL, AD.voice);
    voice(AD_KINGS_URL, AD.kings);
    [3.2, 3.7].forEach((d, i) => bell(T + AD.voice + d, 88 + i * 3, 0.018));
    // Special orders: ta-daa, and a bell for each.
    organ(T + AD.orders, [55, 59, 62], 0.18, 0.04); organ(T + AD.orders + 0.2, [60, 64, 67, 72], 0.8, 0.04);
    AD.items.forEach((t, i) => bell(T + t, [79, 83, 86][i], 0.045));
    { const t = T + AD.assembly; const o = tone(t, 380, 0.45, 0.04, "triangle"); o.frequency.exponentialRampToValueAtTime(160, t + 0.4); }
    // The best thing: the typewriter, its bell at the end of the line.
    for (let i = 0; i < 37; i++) burst(T + AD.best + i / 18 + Math.random() * 0.012, out, 0.05, 0.025, [["bandpass", 2600, 1.4]]);
    bell(T + AD.best + 37 / 18 + 0.1, 96, 0.04);
    // ...sort of!!: boing.
    { const t = T + AD.sortOf; const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.08); o.frequency.exponentialRampToValueAtTime(180, t + 0.5); const w = ctx.createOscillator(); w.frequency.value = 14; const wg = ctx.createGain(); wg.gain.value = 30; w.connect(wg).connect(o.frequency); const g = ctx.createGain(); env(g, t, 0.01, 0.05, 0.55); o.connect(g).connect(out); o.start(t); w.start(t); o.stop(t + 0.6); w.stop(t + 0.6); }
    // The dealer's card: the motif again; Dale's telephone.
    motif(AD.dealer + 0.1);
    { const t = T + AD.standing + 0.2, d = 1.1; const o = ctx.createOscillator(); o.frequency.value = 1150; const o2 = ctx.createOscillator(); o2.frequency.value = 1420; const am = ctx.createOscillator(); am.type = "square"; am.frequency.value = 20; const amg = ctx.createGain(); amg.gain.value = 0.5; const g = ctx.createGain(); g.gain.value = 0.5; am.connect(amg).connect(g.gain); const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.03, t + 0.02); e.gain.setValueAtTime(0.03, t + d - 0.05); e.gain.linearRampToValueAtTime(0.0001, t + d); o.connect(g); o2.connect(g); g.connect(e).connect(out); [o, o2, am].forEach((x) => { x.start(t); x.stop(t + d + 0.02); }); }
    // "El Cabeza... only $7.97": the cash register (the key, the bell, the
    // drawer), and a fanfare stab for brand new for 1975.
    { const t = T + AD.only; burst(t, out, 0.12, 0.05, [["bandpass", 1800, 2]]); bell(t + 0.06, 100, 0.06); bell(t + 0.07, 105, 0.03); burst(t + 0.18, out, 0.08, 0.35, [["bandpass", 700, 1.2]]); }
    organ(T + AD.brandNew, [60, 64, 67, 72], 0.14, 0.04); organ(T + AD.brandNew + 0.16, [62, 65, 69, 74], 0.14, 0.04); organ(T + AD.brandNew + 0.32, [64, 67, 72, 76], 1.4, 0.04);
    // ...and the strobe's zaps, in time with its colours.
    for (let i = 0; i < 12; i++) { const t = T + AD.brandNew + 0.25 + i / 6; if (t >= T + AD.close - 0.1) break; const o = tone(t, 1600, 0.07, 0.012, "square"); o.frequency.exponentialRampToValueAtTime(700, t + 0.06); }
    // "Get yours now...": the organ runs up; "if not, you never will!":
    // it drops away to something low and minor, a little too sincere.
    for (let i = 0; i < 8; i++) organ(T + AD.close + i * 0.07, [60 + [0, 2, 4, 5, 7, 9, 11, 12][i]], 0.09, 0.03);
    organ(T + AD.close + 0.6, [48, 60, 64, 67], 1.0, 0.03);
    { const t = T + AD.never - 0.1; const o = tone(t, 660, 0.7, 0.03, "triangle"); o.frequency.exponentialRampToValueAtTime(90, t + 0.6); }
    organ(T + AD.never + 0.5, [40, 47, 52, 55, 59], 1.9, 0.03);
    // The sign-off: the big chord, held to the credit.
    organ(T + AD.credit + 0.1, [48, 60, 64, 67, 72], 1.1, 0.03);
    setTimeout(() => { if (tv && tv.ad === out) tv.ad = null; }, (end - now()) * 1000 + 500);
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
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(chGain(ch), now(), 0.05);
    },
    // The sound menu's slider for a channel: 0 (off) .. 1.
    setChannelLevel(ch, v) {
      if (!(ch in channelOff)) return;
      channelLevel[ch] = Math.max(0, Math.min(1, v));
      channelOff[ch] = channelLevel[ch] <= 0;
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(chGain(ch), now(), 0.04);
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
    /* Where the set is from the camera (den-fx.js, every frame, like the
       fire's): its stirring is loud beside it and faint across the room,
       and comes from its side. */
    setTvListener(distance, pan) {
      hauntDist = distance;
      hauntNear = Math.max(0.3, Math.min(2.2, Math.pow(55 / Math.max(distance, 10), 1.25)));
      hauntSide = Math.max(-0.9, Math.min(0.9, pan));
      if (!ctx || !hauntBus) return;
      hauntBus.gain.setTargetAtTime(hauntNear, now(), 0.2);
      if (hauntPan) hauntPan.pan.setTargetAtTime(hauntSide, now(), 0.2);
    },
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    tvOn,
    tvOff,
    tvCommercial,
    tvHaunt,
    // The snow's hiss, 0 (none) to 1 (a screen of it).
    tvHiss(level) { if (tvGraph()) tv.hissGain.gain.setTargetAtTime(level * 0.07, now(), 0.12); },
    // The station's tone as the test pattern comes up.
    tvTone() {
      if (!tvGraph()) return;
      const t = now(), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 1000;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.05); g.gain.setValueAtTime(0.022, t + 1.1); g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(tv.bus); o.start(t); o.stop(t + 1.5);
    },
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
    debugState() { return { ctx: !!ctx, ctxState: ctx ? ctx.state : null, muted, roomOn, channelsOff: { ...channelOff }, channelLevels: { ...channelLevel } }; },
    // Leaving the den (Nova's story): everything fades out over `secs`.
    fadeOutAll(secs = 2) {
      if (!ctx || !master) return;
      const t = now();
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + secs);
    },
    dispose() {
      disposed = true;
      stopMusic();
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
}
