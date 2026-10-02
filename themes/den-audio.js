/* The den's sound: a quiet room on a wet evening, and the game's wood.

   - The fire: a recorded fireplace (the user's choice), looped and made
     warm, with a small room round it (tools/den_fire_loop.py). Until it
     has loaded, or if it can't be, a made one: a low roar, the flutter of
     flames, dry wood ticking, a pop now and then; never a hiss. It's where it is: nearer the camera, louder, and off to the
     side it's on (setFireListener, from den-fx.js every frame).
   - The mantel clock: tick, tock, quietly, on the device's own seconds;
     on the hour its chime plays the Westminster melody (the four phrases,
     no counting strokes) the way a 1970s electronic clock did it, a
     little chip through a tiny speaker, soft enough not to break anyone's
     concentration.
   - The stereo console: the record player or the 8-track, when a track
     is chosen (playMusic; the tracks themselves come later).
   - The television (den-tv.js): its switch, the tube warming up, the
     snow, the station's tone, the set going off (tvOn, tvHiss, tvTone,
     tvOff), behind the Music switch with the stereo.
   - The pieces: Tienda's wood (wood-sfx.js), on a solid board (the
     player's choice for Standard), with a small room round them.

   Three switches for the sound menu (standard.js soundChannels): "room"
   (the fire, the clock), "stereo" (shown as Music) and "pieces". Everything but
   the music is made here, in the browser. Built on the first gesture; the
   room starts then, so the fire is already going on the setup screen. */

import { createWoodSfx } from "./wood-sfx.js";
import { playCommercial, loadAdVoices, prepareCommercial } from "./den-ad-audio.js";

export const hasAudio = true;

// The Westminster quarters, E major, an octave up (a small speaker can't
// do the low bells): the hour's four phrases, changes 2, 3, 4 and 5.
const GS = 830.61, FS = 739.99, E = 659.26, B = 493.88;
const HOUR_CHIME = [[E, GS, FS, B], [E, FS, GS, E], [GS, E, FS, B], [B, FS, GS, E]];

export function createAudio() {
  let ctx = null, master = null, comp = null, roomBus = null, sfxBus = null, wood = null;
  let fireBus = null, firePan = null, musicBus = null, verb = null;
  let phoneBus = null, phonePan = null, earBus = null, phoneNear = 1, phoneSide = 0;
  let noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, roomOn = false, disposed = false;
  let zoom = 0.5, fireNear = 1, lastChimeHour = null, chimes = 0;
  let music = null; // { el, src, extra: [nodes], track }
  const channelOff = { room: false, stereo: false, pieces: false };
  // Each channel's level on the sound menu's slider (0..1; 0 is off), heard
  // as its square so the slider moves about evenly in loudness.
  const channelLevel = { room: 1, stereo: 1, pieces: 1 };
  // (away: out of the den for a while, den-trip.js: its sounds fade out.)
  let away = false;
  const chGain = (ch) => (away || channelOff[ch] ? 0 : channelLevel[ch] * channelLevel[ch]);
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
      verb = ctx.createConvolver(); verb.buffer = ir;
      const verbOut = ctx.createGain(); verbOut.gain.value = 0.3;
      verb.connect(verbOut).connect(master);
      // The room (fire, clock), the music and the pieces, each behind its switch.
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
          fire: { near: fireNear, gain: fireBus.gain.value, pan: firePan ? firePan.pan.value : 0, recording: firePlaying ? (fireSrc ? "buffer" : "element") : null },
          haunt: { near: hauntNear, pan: hauntSide, distance: hauntDist },
          chimes,
          music: music ? { id: music.track.id, medium: music.track.medium, paused: music.el.paused, time: music.el.currentTime, duck: music.duck ? music.duck.gain.value : null, wobble: music.wobG ? music.wobG.gain.value : null, level: music.lvl ? music.lvl.gain.value : null } : null,
          tvPull,
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
  // The room (fire, clock) steps back while a record or a tape plays, as
  // it would for someone listening (user: the music was lost under it).
  const MUSIC_DUCK = 0.35;
  // (A trim on the room's sounds, set by the room: den-fx.js's first
  // visit, 87%, user.)
  let roomTrim = 1;
  const roomLevel = () => roomTrim * (windingDown ? 0.6 : 1) * (0.85 + 0.15 * (1 - zoom)) * (music && !music.el.paused ? MUSIC_DUCK : 1);
  const roomFollowMusic = () => { if (ctx && roomOn && roomBus) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.9); };

  /* ---------------- the fire ---------------- */
  /* Logs burning in the grate, and nothing hissing (user: the steady hiss
     made no sense there). The burning: a low hearth rumble and, over it,
     the soft flutter of the flames, both steady (a rise and fall read as
     wind). The crackle: dry wood ticking, each tick a few milliseconds of
     knock in the wood's own middle register, in little runs with quiet
     between; a pop now and then (a knock and a thump); and, every half
     minute or so, a log settling in the grate. */
  // The recording: seamless between FIRE_LOOP's two points (the file
  // carries a quarter second of the loop either side, for the decoder).
  const FIRE_URL = "el-cabeza-den-fire.mp3", FIRE_LOOP = [0.25, 70.25], FIRE_LEVEL = 0.2;
  let madeFire = null; // the made fire's gain, faded out once the recording plays
  function startFire() {
    startMadeFire();
    const begin = (node, fade = 2.5) => {
      const g = ctx.createGain(), t = now();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(FIRE_LEVEL, t + fade);
      node.connect(g).connect(fireBus);
      if (madeFire) { madeFire.gain.setTargetAtTime(0, t, fade / 3); madeFire.stopped = true; madeFire.sources.forEach((x) => x.stop(t + fade * 2)); }
      firePlaying = true;
    };
    // Decoded whole, it loops without a gap; where it can't be fetched (a
    // page opened from disk), an <audio> element, looping, stands in.
    const fromElement = () => {
      if (disposed || typeof Audio === "undefined") return;
      const el = new Audio(FIRE_URL); el.loop = true;
      el.addEventListener("canplay", () => { if (disposed || firePlaying) return; try { begin(ctx.createMediaElementSource(el)); } catch (e) { return; } const p = el.play(); if (p && p.catch) p.catch(() => {}); }, { once: true });
      fireEl = el;
    };
    // (A page opened from disk can't fetch at all, and says so in the
    // console: straight to the element there.)
    if (typeof location !== "undefined" && location.protocol === "file:") { fromElement(); return; }
    fetch(FIRE_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (disposed || !ctx) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      [s.loopStart, s.loopEnd] = [FIRE_LOOP[0], Math.min(FIRE_LOOP[1], buf.duration)];
      s.start(now(), FIRE_LOOP[0] + Math.random() * (FIRE_LOOP[1] - FIRE_LOOP[0] - 1));
      begin(s);
      fireSrc = s;
    }).catch(fromElement);
  }
  let firePlaying = false, fireSrc = null, fireEl = null;
  /* The made fire, for the moments before the recording plays (or if it
     can't): its own gain, so it can fade away under it. */
  function startMadeFire() {
    const t = now();
    const out = ctx.createGain(); out.connect(fireBus);
    madeFire = out;
    const bed = ctx.createBufferSource(); bed.buffer = brownBuf; bed.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.024;
    bed.connect(lp).connect(bedGain).connect(out); bed.start(t);
    out.sources = [bed];
    const flame = ctx.createBufferSource(); flame.buffer = brownBuf; flame.loop = true;
    const fb = ctx.createBiquadFilter(); fb.type = "bandpass"; fb.frequency.value = 420; fb.Q.value = 0.7;
    const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 900;
    const flameGain = ctx.createGain(); flameGain.gain.value = 0.02;
    flame.connect(fb).connect(fl).connect(flameGain).connect(out); flame.start(t, 1.3);
    out.sources.push(flame);
    // One tick of the wood: a knock, not a spit.
    const tick = (at, level) => {
      const f = 900 + Math.random() * 1700;
      burst(at, out, level, 0.002 + Math.random() * 0.004, [["bandpass", f, 4 + Math.random() * 4], ["lowpass", 3600]], 0.0003);
    };
    const crackle = () => {
      if (!ctx || disposed || out.stopped) return;
      const t0 = now() + 0.01;
      const r = Math.random();
      if (r < 0.1) {
        // A pop: the knock, and the thump of the log under it.
        burst(t0, out, 0.16, 0.006, [["bandpass", 1300 + Math.random() * 600, 3]], 0.0003);
        burst(t0, out, 0.22, 0.05, [["lowpass", 320]], 0.001);
        for (let i = 1; i < 4; i++) tick(t0 + 0.02 + i * (0.02 + Math.random() * 0.05), 0.04 + Math.random() * 0.04);
      } else {
        // A run of ticks, or one.
        const n = r < 0.55 ? 1 : 2 + Math.floor(Math.random() * 7);
        let at = t0;
        for (let i = 0; i < n; i++) { tick(at, 0.05 + Math.random() * 0.09); at += 0.008 + Math.random() * 0.045; }
      }
      later(crackle, 140 + Math.random() * (Math.random() < 0.3 ? 1600 : 520));
    };
    crackle();
    // A log settling: a soft, low shift and a few ticks after it.
    const settle = () => {
      if (!ctx || disposed || out.stopped) return;
      const at = now() + 0.02;
      const s = noise(at, 0.7, true);
      const slp = ctx.createBiquadFilter(); slp.type = "lowpass"; slp.frequency.value = 240;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.12, at + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
      s.connect(slp).connect(g).connect(out);
      for (let i = 0; i < 5; i++) tick(at + 0.1 + Math.random() * 0.5, 0.03 + Math.random() * 0.05);
      later(settle, 22000 + Math.random() * 30000);
    };
    later(settle, 9000 + Math.random() * 12000);
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

  function startRoom() {
    ensureGraph();
    if (!ctx || roomOn) return;
    roomOn = true;
    startFire(); startClock(); // (No rain any more: user.)
    roomBus.gain.setTargetAtTime(roomLevel(), now(), 1.2);
  }

  /* ---------------- the stereo console ---------------- */
  /* The set's pull on the music (user: a record at full blast drowned the
     television acting up). tvPull, 0 to 1, from den-fx.js each frame: 0
     until the set starts stirring, then from 0.4 up to 1 as the lure goes
     on, and 1 while it's on. The music drops (to about -7 dB at 0.4, -16 dB
     at 1) and starts to wander in pitch like a warped tape (a slow wobble
     of a short delay, about 1% at full); and each stir of the set knocks it
     (musicGlitch: a dropout, or the pitch sagging and coming back). */
  let tvPull = 0;
  const pullGain = (p) => 1 - 0.85 * Math.sqrt(Math.max(0, Math.min(1, p)));
  function setTvPull(p) {
    p = Math.max(0, Math.min(1, p || 0));
    if (Math.abs(p - tvPull) < 0.02 && !(p === 0 && tvPull !== 0)) return;
    tvPull = p;
    if (!ctx || !music || !music.duck) return;
    const t = now();
    music.duck.gain.setTargetAtTime(pullGain(p), t, 0.6);
    music.wobG.gain.setTargetAtTime(0.009 * p, t, 0.8);
    if (music.wowG) music.wowG.gain.setTargetAtTime(0.006 * p, t, 0.8);
    if (music.flutG) music.flutG.gain.setTargetAtTime(0.0007 * p, t, 0.8);
    if (music.crushG) { music.crushG.gain.setTargetAtTime(0.7 * p, t, 0.8); music.cleanG.gain.setTargetAtTime(1 - 0.5 * p, t, 0.8); }
  }
  function musicGlitch(kind, strength) {
    if (!ctx || !music || !music.duck || tvPull <= 0 || music.el.paused) return;
    const t = now(), s = Math.max(0.3, Math.min(1, strength || 0.5));
    // (All of it harder than it was, user: the music should freak out.)
    if (kind === "thump" || kind === "static" || kind === "phantom" || kind === "flash" || kind === "flicker" || kind === "surge" || kind === "blast") {
      // A dropout: the music gone for a moment; and, from the static,
      // the thump and the surge, stuttering back in, chopped.
      const d = music.drop.gain, hold = 0.08 + 0.35 * s;
      d.cancelScheduledValues(t); d.setValueAtTime(d.value, t);
      d.linearRampToValueAtTime(0.0, t + 0.02); d.setValueAtTime(0.0, t + 0.02 + hold);
      let at = t + 0.02 + hold;
      if (kind === "static" || kind === "thump" || kind === "surge") {
        for (let i = 0; i < 3 + Math.floor(3 * s); i++) { d.setValueAtTime(1, at); d.setValueAtTime(0.05, at + 0.04 + Math.random() * 0.05); at += 0.07 + Math.random() * 0.08; }
      }
      d.linearRampToValueAtTime(1, at + 0.12);
    }
    if (kind === "roll" || kind === "tune" || kind === "ghost" || kind === "voice" || kind === "flash" || kind === "pilot" || kind === "knob" || kind === "surge") {
      /* The warp: the pitch sags a long way (the delay drawn out: -8% at
         full strength) and comes back, sometimes overshooting into a
         lurch sharp, like a turntable grabbed and let go. */
      const w = music.warp.delayTime, base = 0.03;
      w.cancelScheduledValues(t); w.setValueAtTime(base, t);
      w.linearRampToValueAtTime(base + 0.04 * s, t + 0.25 + 0.2 * s);
      if (Math.random() < 0.5) { w.linearRampToValueAtTime(Math.max(0.004, base - 0.02 * s), t + 0.55 + 0.3 * s); w.linearRampToValueAtTime(base, t + 1.0 + 0.35 * s); }
      else w.linearRampToValueAtTime(base, t + 0.8 + 0.35 * s);
    }
  }
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
    handOverHold();
    stopMusic();
    const el = new Audio();
    el.src = track.url; el.loop = !!track.loop; el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = track.medium === "8track" ? 9000 : 13000;
    // (Then the set's pull: a warping delay, its duck, its dropouts.)
    const warp = ctx.createDelay(0.2); warp.delayTime.value = 0.03;
    /* The set's pull on it: a wow (0.55 Hz, and a slower 0.13 Hz under
       it, so it never settles), a flutter (7 Hz), all deeper as the pull
       grows (about 3% of pitch at full); and the sound itself going bad,
       crossfaded in with the pull: overdriven and squeezed into a
       telephone's band, like a set picking it up badly. */
    const wob = ctx.createOscillator(); wob.frequency.value = 0.55;
    const wobG = ctx.createGain(); wobG.gain.value = 0.009 * tvPull;
    wob.connect(wobG).connect(warp.delayTime); wob.start();
    const wow = ctx.createOscillator(); wow.frequency.value = 0.13;
    const wowG = ctx.createGain(); wowG.gain.value = 0.006 * tvPull;
    wow.connect(wowG).connect(warp.delayTime); wow.start();
    const flut = ctx.createOscillator(); flut.frequency.value = 7;
    const flutG = ctx.createGain(); flutG.gain.value = 0.0007 * tvPull;
    flut.connect(flutG).connect(warp.delayTime); flut.start();
    const cleanG = ctx.createGain(); cleanG.gain.value = 1 - 0.5 * tvPull;
    const crush = ctx.createWaveShaper();
    crush.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 1023) * 2 - 1) * 5) * 0.6);
    const cbp = ctx.createBiquadFilter(); cbp.type = "bandpass"; cbp.frequency.value = 1300; cbp.Q.value = 0.9;
    const crushG = ctx.createGain(); crushG.gain.value = 0.7 * tvPull;
    const duck = ctx.createGain(); duck.gain.value = pullGain(tvPull);
    const drop = ctx.createGain(); drop.gain.value = 1;
    src.connect(tone).connect(warp);
    warp.connect(cleanG).connect(duck);
    warp.connect(crush).connect(cbp).connect(crushG).connect(duck);
    // (track.level: a track put on by the room itself, below its usual
    // level: den-fx.js's first visit, at 40%.)
    const lvl = ctx.createGain(); lvl.gain.value = track.level != null ? track.level : 1;
    duck.connect(drop).connect(lvl).connect(musicBus);
    const extra = [tone, warp, wob, wobG, wow, wowG, flut, flutG, cleanG, crush, cbp, crushG, duck, drop, lvl];
    // A track already put through the console's treatment (track.treated:
    // tools/console_1974_turntable.py) has its hiss and crackle in it.
    if (!track.treated) {
      const bed = ctx.createBufferSource(); bed.buffer = noiseBuf; bed.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = track.medium === "8track" ? "highpass" : "bandpass"; bf.frequency.value = track.medium === "8track" ? 6000 : 2400;
      const bg = ctx.createGain(); bg.gain.value = track.medium === "8track" ? 0.0025 : 0.0018;
      bed.connect(bf).connect(bg).connect(musicBus); bed.start();
      extra.push(bed, bf, bg);
    }
    music = { el, src, extra, track, warp, wobG, wowG, flutG, cleanG, crushG, duck, drop, lvl };
    roomFollowMusic();
    el.addEventListener("ended", () => { if (music && music.el === el) { stopMusic(); if (onEnd) onEnd(); } });
    const p = el.play();
    if (p && p.catch) p.catch(() => { /* the first gesture will start it */ });
    return true;
  }

  // The needle lifted and set down again (the now-playing chip's pause):
  // the track keeps its place, and the room comes back up while it waits.
  function pauseMusic() {
    heldResume = false; // (paused by hand on the phone: it stays paused after)
    if (!music || music.el.paused) return;
    try { music.el.pause(); } catch (e) { /* gone */ }
    roomFollowMusic();
  }
  function resumeMusic() {
    handOverHold();
    if (!music || !music.el.paused) return;
    if (ctx && ctx.state === "suspended") ctx.resume();
    const p = music.el.play();
    if (p && p.catch) p.catch(() => { /* the next gesture */ });
    roomFollowMusic();
  }

  /* The phone (den-call.js; user: going to answer it, the music pauses,
     a fast fade out; hung up, it fades back in from where it was). The
     stereo's bus fades out over a third of a second and the track pauses
     at its place; on release it plays on from there and the bus comes back
     up over about two seconds. A track paused, played or changed by hand
     meanwhile is left as it was. */
  let phoneHeld = false, heldResume = false, heldTimer = null;
  const HELD_OUT = 0.35, HELD_IN = 2.2;
  // (A track started by hand while it's held: it's heard; the hold lets go of it.)
  function handOverHold() {
    heldResume = false;
    if (!phoneHeld || !ctx || !musicBus) return;
    clearTimeout(heldTimer);
    const g = musicBus.gain, t = now();
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.9, t + 0.6);
  }
  function holdForPhone(on) {
    if (!ctx || !musicBus) return;
    const g = musicBus.gain, t = now();
    if (on) {
      if (phoneHeld) return;
      phoneHeld = true;
      heldResume = !!(music && !music.el.paused);
      if (!heldResume) return;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + HELD_OUT);
      const el = music.el;
      clearTimeout(heldTimer);
      heldTimer = setTimeout(() => {
        if (phoneHeld && heldResume && music && music.el === el && !el.paused) { try { el.pause(); } catch (e) { /* gone */ } roomFollowMusic(); }
      }, HELD_OUT * 1000 + 40);
      return;
    }
    if (!phoneHeld) return;
    phoneHeld = false;
    clearTimeout(heldTimer);
    if (heldResume && music && music.el.paused) {
      if (ctx.state === "suspended") ctx.resume();
      const p = music.el.play();
      if (p && p.catch) p.catch(() => { /* the next gesture */ });
      roomFollowMusic();
    }
    heldResume = false;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.min(g.value, 0.9), t); g.linearRampToValueAtTime(0.9, t + HELD_IN);
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
    tv = { bus, hissGain, whine: null, whineGain: null, ad: null };
    loadAdVoices(ctx); // (the commercial's voices, decoded before it airs)
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
    if (tv.ad) { tv.ad.stop(); tv.ad = null; }
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
    musicGlitch(kind, strength);
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
    else if (kind === "knob") {
      // The knob turning by itself: the detent's clicks, a little way and
      // back, and the set's thump as if it nearly came on.
      for (let i = 0; i < 6; i++) burst(t + i * (0.06 + Math.random() * 0.05) + (i > 2 ? 0.25 : 0), hauntBus, 0.09 * k, 0.012, [["bandpass", 2600, 2.5]]);
      tone(62, 40, 0.35, 0.18, "sine", 0, t + 0.12);
    } else if (kind === "blast") {
      /* The blast (den-tv.js, 5.6 s, the white full at 2.8 s and held a
         second): a whine climbing out of the set and a roar swelling with
         the cone of light; at the white, a deep boom and a burst, then a
         high ring that fades as the room comes back. */
      const W = t + 2.8;
      { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(5200, W);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * k, W - 0.05); g.gain.linearRampToValueAtTime(0.0001, W + 0.03);
        o.connect(lp).connect(g).connect(hauntBus); o.start(t); o.stop(W + 0.1); }
      { const n = noise(t, 2.9); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.7;
        bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(2600, W);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * k, W - 0.02); g.gain.linearRampToValueAtTime(0.0001, W + 0.04);
        n.connect(bp).connect(g).connect(hauntBus); }
      tone(64, 26, 2.2, 0.5, "sine", 0, W);
      tone(110, 40, 1.2, 0.12, "triangle", 0, W);
      burst(W, hauntBus, 0.42 * k, 1.6, [["lowpass", 1400]], 0.004);
      burst(W, hauntBus, 0.16 * k, 0.9, [["highpass", 3000]], 0.002);
      tone(3950, 3900, 2.8, 0.02, "sine", 0, W + 0.1);
    } else if (kind === "surge") {
      // A surge through the dead set: a whine climbing to the flyback's
      // pitch, static rising under it, and a thump as it lets go.
      tone(180, 3200, 1.6, 0.05, "sawtooth", 18);
      tone(15734, 15500, 1.6, 0.012);
      burst(t, hauntBus, 0.16 * k, 1.6, [["bandpass", 2600, 0.6]], 0.9);
      tone(70, 36, 0.4, 0.28, "sine", 0, t + 1.55);
    }
  }

  /* The late-night commercial's sound: den-ad-audio.js (the jingle, the
     user's voices, the jokes, the set's small speaker), through the set's
     bus; tvOff (or another commercial) stops it. */
  function tvCommercial(delay = 0) {
    if (!tvGraph()) return;
    if (tv.ad) { tv.ad.stop(); tv.ad = null; }
    prepareCommercial(); // (if it isn't on its way already: late, then)
    const ad = playCommercial(ctx, tv.bus, { delay, noiseBuf });
    tv.ad = ad;
    setTimeout(() => { if (tv && tv.ad === ad) tv.ad = null; }, (ad.end - now()) * 1000 + 500);
  }

  const cue = (fn) => (...args) => { ensureGraph(); if (wood) fn(...args); };

  // Test-only: a track straight on (the panel's taps aside).
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_TEST_PLAY__ = (url) => playMusic({ id: "test", url, medium: "record", loop: true, treated: true });
  return {
    ensureStarted() {
      ensureGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      startRoom();
    },
    beginGameFadeIn() { windingDown = false; startRoom(); if (ctx) roomBus.gain.setTargetAtTime(roomLevel(), now(), 0.8); },
    setRoomTrim(v) { roomTrim = Math.max(0, Math.min(1, v)); roomFollowMusic(); },
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
    /* The telephone (den-call.js): the context, where its bell rings in
       the room (behind the room's switch, panned and levelled from where
       the camera is: setPhoneListener), and the earpiece (the caller, in
       your ear: straight to the master). null until there's sound. */
    phoneOutput() {
      ensureGraph();
      if (!ctx) return null;
      if (!phoneBus) {
        phoneBus = ctx.createGain(); phoneBus.gain.value = phoneNear;
        phonePan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (phonePan) { phonePan.pan.value = phoneSide; phoneBus.connect(phonePan).connect(gates.room); } else phoneBus.connect(gates.room);
        const send = ctx.createGain(); send.gain.value = 0.35;
        phoneBus.connect(send).connect(verb);
        earBus = ctx.createGain(); earBus.gain.value = 1;
        earBus.connect(master);
      }
      if (ctx.state === "suspended") ctx.resume();
      return { ctx, ring: phoneBus, ear: earBus, noise: noiseBuf };
    },
    // Where the phone is from the camera (den-call.js, every few frames).
    setPhoneListener(distance, pan) {
      phoneNear = Math.max(0.35, Math.min(2, Math.pow(60 / Math.max(distance, 10), 1.1)));
      phoneSide = Math.max(-0.85, Math.min(0.85, pan));
      if (!ctx || !phoneBus) return;
      phoneBus.gain.setTargetAtTime(phoneNear, now(), 0.2);
      if (phonePan) phonePan.pan.setTargetAtTime(phoneSide, now(), 0.2);
    },
    /* Out of the den (den-trip.js: the drive to the store and back): the
       room, the stereo and the pieces fade right out over `secs`, and come
       back the same way. The trip's own sounds go straight to the master
       (phoneOutput's ear). */
    awayFromDen(on, secs = 1.5) {
      away = !!on;
      if (!ctx) return;
      ["room", "stereo", "pieces"].forEach((ch) => { if (gates[ch]) gates[ch].gain.setTargetAtTime(chGain(ch), now(), secs / 3); });
    },
    holdForPhone,
    phoneHeld: () => phoneHeld,
    // On the phone: the record turned down under it (and back after).
    duckForCall(on) {
      if (!ctx || !musicBus) return;
      musicBus.gain.setTargetAtTime(on ? 0.22 : 0.9, now(), on ? 0.4 : 1.2);
    },
    /* The order stamped (the special order's "Take to store", the form's
       stamp landing 0.22 s into its fall, tienda-overlay.js tdStamp): a
       quick whoosh of air as it comes down, then the rubber smacking the
       paper (a dull thud, the paper's slap). */
    playOrderFilled() {
      ensureGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const t = now(), land = t + 0.21;
      const w = noise(t, 0.26), wb = ctx.createBiquadFilter(); wb.type = "bandpass"; wb.Q.value = 0.9;
      wb.frequency.setValueAtTime(500, t); wb.frequency.exponentialRampToValueAtTime(2400, land);
      const wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.07, land - 0.02); wg.gain.exponentialRampToValueAtTime(0.0001, land + 0.02);
      w.connect(wb).connect(wg).connect(sfxBus);
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(130, land); o.frequency.exponentialRampToValueAtTime(52, land + 0.12);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, land); og.gain.linearRampToValueAtTime(0.4, land + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, land + 0.16);
      o.connect(og).connect(sfxBus); o.start(land); o.stop(land + 0.2);
      burst(land, sfxBus, 0.3, 0.07, [["lowpass", 700]]);
      burst(land + 0.002, sfxBus, 0.12, 0.035, [["bandpass", 1900, 1.1]]);
    },
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    tvOn,
    tvOff,
    tvCommercial,
    tvHaunt,
    setTvPull,
    // (Test-only reading: the pull, and the music's level under it.)
    tvPullNow() { return { pull: tvPull, duck: music && music.duck ? music.duck.gain.value : null }; },
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
      if (fireEl) { try { fireEl.pause(); } catch (e) { /* gone */ } fireEl = null; }
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
}
