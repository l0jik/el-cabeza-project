/* Noir's sound: the street at night in the rain, and the picture house
   it's shown in.

   The street, on two sliders of the sound menu (noir.js soundChannels),
   with Pieces the third:
   - Rain: the rain (user: "make sure you get some better rain sounds ...
     it definitely will need its own volume toggle"): recordings, beside
     the page (RAIN_URL; tools/noir_sounds.py: kyles's rain on a street's
     pavement, and under it a Hollywood studio's own rain on concrete from
     the 1930s-60s), looped, with the roofs' low roar under it; and the
     thunder after the lightning (noir-fx.js calls thunder()), a studio's
     thunder clap or Fox's, never quite the same twice.
   - The city: the cars on the board (noir-traffic.js; user: "add car
     sounds, real recordings"): each one's engine, a 1951 Mercury flathead
     V8 idling (lonemonk, CC BY 4.0, credited on the About card), pitched
     up with its pace and revving as it pulls out of a turn, and its tyres
     on the wet street (Breviceps's pass-by, slowed to city speed); louder
     as it comes near the camera, to the side it's on, duller far off,
     fading as it dissolves (carSound, from noir-fx.js). And a gutter
     dripping, the El going over a few streets off, a siren far away.
   Until the recordings are here, or on a page opened from disk, made
   sounds stand in: the old noise rain (quieter), the made thunder; no
   cars.

   The cues (Pieces): a typewriter key to pick a piece up (the script
   being typed), a softer one to put it down, a knock at a door for a move
   that isn't allowed, stone grinding as a building tips, a thud and a
   splash where it lands, a press camera's flashbulb and a door slammed
   for a crush, a low jazz chord to win. The dock is a venetian blind going
   up and coming down; the projector starts the picture and runs it down. */

export const hasAudio = true;

// The recordings beside the page (tools/noir_sounds.py). A loop's file
// has LOOP_PAD of its own end before the loop and of its start after it.
const RAIN_URL = "el-cabeza-noir-rain.mp3";
const THUNDER_URLS = ["el-cabeza-noir-thunder-1.mp3", "el-cabeza-noir-thunder-2.mp3"];
const CAR_URLS = { engine: "el-cabeza-noir-car-engine.mp3", rev: "el-cabeza-noir-car-rev.mp3", tyres: "el-cabeza-noir-car-tyres.mp3" };
const LOOP_PAD = 0.3;
// Their places in the mix. The rain about as loud as it was (A-weighted;
// tension takes it up to 30% louder, heavier rain); a car near the camera
// a little over the rain, at a usual distance well under it.
const RAIN_GAIN = 0.19;
const THUNDER_GAIN = 0.42;
const CAR_GAIN = 0.24, ENGINE_LEVEL = 0.8, TYRE_LEVEL = 1.1;
// The made rain, standing in: its pavement band closes above this (Hz),
// calm; tension opens it a little.
const RAIN_LP = 3600;

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, wet = null, rev = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, ambRunning = false, rainOn = false;
  let timers = [], menuVoice = null;
  let zoom = 0.5, volume = 1, vol = null, ambGain = null, rainLp = null, rainBus = null;
  // The sound menu's channels: each a gate for its sounds and one for
  // their echo (so a channel turned down takes its echo with it).
  const CH = {}, levels = { rain: 1, city: 1, pieces: 1 };
  let rainClip = null, thunderBufs = null, carBufs = null, car = null, carN = 0;

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
      intro = ctx.createGain(); intro.gain.value = 0; intro.connect(master);
      amb = ctx.createGain(); amb.gain.value = 1; amb.connect(intro);
      // the street's sounds come up as the camera comes in (setZoom)
      ambGain = ctx.createGain(); ambGain.gain.value = 0.7 + 0.4 * zoom; ambGain.connect(amb);
      // a street between tall buildings: a long, dark echo
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.72 + (Math.random() * 2 - 1) * 0.28; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.2; rev.connect(wet).connect(master);
      const channel = (key, dest, pre) => {
        const gate = ctx.createGain(), send = ctx.createGain();
        gate.gain.value = levels[key]; send.gain.value = levels[key];
        gate.connect(dest); send.connect(rev);
        if (pre) pre.connect(gate);
        return { bus: pre || gate, gate, send };
      };
      sfx = ctx.createGain(); sfx.gain.value = 0.75;
      CH.pieces = channel("pieces", master, sfx);
      CH.rain = channel("rain", ambGain);
      CH.city = channel("city", ambGain);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const bd = brownBuf.getChannelData(0); let b = 0; for (let i = 0; i < bd.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = b * 3.5; }
    } catch (e) { ctx = null; }
    // (The recordings on their way from the start, so they're here by the game.)
    loadRecordings();
  }
  function ensureStarted() { ensureGraph(); if (ctx && ctx.state === "suspended") ctx.resume(); }
  const now = () => ctx.currentTime + 0.005;

  /* ---- the recordings ---- */
  // (Not from disk: a browser won't fetch a file beside a page opened from disk.)
  const fetchable = () => typeof fetch === "function" && !(typeof location !== "undefined" && location.protocol === "file:");
  function fetchBuffer(url) {
    return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((ab) => ctx.decodeAudioData(ab));
  }
  // A loop: from its first sound + LOOP_PAD to its last - LOOP_PAD (an
  // encoder's padding left out; the pads are the loop's own, so the
  // points needn't fall on the very sample).
  function loopOf(buf) {
    const d = buf.getChannelData(0), lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
    let a = 0, z = d.length - 1;
    while (a < lim && Math.abs(d[a]) < 1e-4) a++;
    while (z > d.length - lim && Math.abs(d[z]) < 1e-4) z--;
    return { buf, start: a / buf.sampleRate + LOOP_PAD, end: (z + 1) / buf.sampleRate - LOOP_PAD };
  }
  function loadRecordings() {
    if (rainClip || !ctx) return;
    if (!fetchable()) { rainClip = Promise.reject(new Error("no recordings from disk")); rainClip.catch(() => {}); return; }
    rainClip = fetchBuffer(RAIN_URL).then(loopOf);
    rainClip.catch(() => { /* the made rain stays */ });
    Promise.all(THUNDER_URLS.map((u) => fetchBuffer(u).catch(() => null))).then((bs) => { thunderBufs = bs.filter(Boolean); });
    Promise.all([fetchBuffer(CAR_URLS.engine), fetchBuffer(CAR_URLS.tyres), fetchBuffer(CAR_URLS.rev).catch(() => null)])
      .then(([e, t, r]) => { carBufs = { engine: loopOf(e), tyres: loopOf(t), rev: r }; })
      .catch(() => { /* no cars heard */ });
  }
  function looping(clip, rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = clip.buf; s.loop = true; s.loopStart = clip.start; s.loopEnd = clip.end; s.playbackRate.value = rate;
    s.start(now(), clip.start + Math.random() * Math.max(0, clip.end - clip.start - 0.5));
    return s;
  }

  /* ---- pieces of sound ---- */
  // A sound out to a channel (CH.pieces unless said): `dry` of it to the
  // channel, `send` of it to the echo, panned if `pan`.
  function out(node, dry, send, chan = CH.pieces, pan = 0) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); n = p; }
    const g1 = ctx.createGain(); g1.gain.value = dry; n.connect(g1).connect(chan.bus);
    const g2 = ctx.createGain(); g2.gain.value = send; n.connect(g2).connect(chan.send);
  }
  function noise(t0, dur, buf = noiseBuf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, Math.random() * 1.5); s.stop(t0 + dur); return s; }
  // a band of noise with an envelope
  function band(t0, dur, f, q, level, attack = 0.004, chan = CH.pieces, send = 0.08, pan = 0) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, send, chan, pan);
  }
  // a dull knock or thud: a falling sine and a puff of low noise
  function thud(t0, f, level, send = 0.25, chan = CH.pieces, pan = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.8, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(g); out(g, 1, send, chan, pan); o.start(t0); o.stop(t0 + 0.32);
    const s = noise(t0, 0.18, brownBuf), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 500;
    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(level * 0.8, t0 + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    s.connect(lp).connect(ng); out(ng, 1, send * 0.7, chan, pan);
  }
  // a typewriter key: the type bar's click and the platen's knock
  function typeKey(t0, level, pan = 0) {
    band(t0, 0.03, 3200 + Math.random() * 900, 1.4, level, 0.001, CH.pieces, 0.05, pan);
    band(t0 + 0.012, 0.05, 900, 1.2, level * 0.6, 0.001, CH.pieces, 0.05, pan);
    thud(t0 + 0.01, 160, level * 0.35, 0.05, CH.pieces, pan);
  }
  // water: a splash on the wet street
  function splash(t0, level, pan = 0) {
    const s = noise(t0, 0.5), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2400, t0); hp.frequency.exponentialRampToValueAtTime(900, t0 + 0.35);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    s.connect(hp).connect(g); out(g, 1, 0.2, CH.pieces, pan);
  }
  // a soft piano-ish note (a few decaying partials), for the chords
  function note(t0, f, level, dur, chan = CH.pieces, send = 0.45) {
    [[1, 1, 1], [2.0, 0.42, 0.7], [3.0, 0.16, 0.45], [4.01, 0.08, 0.3]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * a, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * d);
      o.connect(g); out(g, 1, send, chan); o.start(t0); o.stop(t0 + dur * d + 0.05);
    });
  }

  /* ---- the street ---- */
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    // The rain: the recording once it's here (RAIN_URL), fading in over
    // 2 s from a random place in it. Till then the made rain stands in
    // (standIn), quieter: a wash on the pavement (noise, its band centred
    // at 1.9 kHz and closed above 3.6, kept dark as an old picture's
    // soundtrack is: user, "Reduce the hiss on Noir"), coming and going.
    // Under both, the roofs' duller roar, low, for the weight of it.
    const standIn = ctx.createGain(); standIn.gain.value = 0.6; standIn.connect(CH.rain.bus);
    const rb = ctx.createBufferSource(); rb.buffer = noiseBuf; rb.loop = true;
    const rbp = ctx.createBiquadFilter(); rbp.type = "bandpass"; rbp.frequency.value = 1900; rbp.Q.value = 0.7;
    rainLp = ctx.createBiquadFilter(); rainLp.type = "lowpass"; rainLp.frequency.value = RAIN_LP;
    const rg = ctx.createGain(); rg.gain.value = 0.042;
    rb.connect(rbp).connect(rainLp).connect(rg).connect(standIn); rb.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 0.011; lfo.connect(lg).connect(rg.gain); lfo.start();
    const rr = ctx.createBufferSource(); rr.buffer = brownBuf; rr.loop = true;
    const rrl = ctx.createBiquadFilter(); rrl.type = "lowpass"; rrl.frequency.value = 700;
    const rrg = ctx.createGain(); rrg.gain.value = 0.04; rr.connect(rrl).connect(rrg).connect(CH.rain.bus); rr.start();
    rainBus = ctx.createGain(); rainBus.gain.value = RAIN_GAIN; rainBus.connect(CH.rain.bus);
    const c = ctx;
    (rainClip || Promise.reject(new Error("none"))).then((clip) => {
      if (c !== ctx || c.state === "closed") return;
      const src = looping(clip), g = c.createGain(), t = now();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 2);
      src.connect(g).connect(rainBus);
      standIn.gain.setTargetAtTime(0, t, 0.6);
      setTimeout(() => { try { rb.stop(); lfo.stop(); } catch (e) { /* stopped */ } }, 5000);
      rainOn = true;
    }).catch(() => { /* the made rain stays */ });
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
        o.connect(g); out(g, 1, 0.4, CH.city, pan); o.start(tt); o.stop(tt + 0.08);
      }
      later(drip, 2500 + Math.random() * 5000);
    }, 2000);
    // (The cars are the board's own now: carSound.)
    // the El going over, a few streets off: a rumble and the wheels' clatter on the joints
    later(function el() {
      if (!ctx || windingDown) return;
      const t = now(), dur = 7 + Math.random() * 3, pan = -0.4;
      const s = noise(t, dur + 0.2, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 260;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(lp).connect(g); out(g, 1, 0.3, CH.city, pan);
      for (let tt = t + 0.3; tt < t + dur - 0.3; tt += 0.42 + Math.random() * 0.08) {
        const k = Math.sin(Math.PI * (tt - t) / dur);
        band(tt, 0.08, 700, 2, 0.012 * k, 0.002, CH.city, 0.2, pan); band(tt + 0.11, 0.08, 620, 2, 0.01 * k, 0.002, CH.city, 0.2, pan);
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
      o.connect(lp).connect(g); out(g, 1, 0.6, CH.city, 0.5); o.start(t); o.stop(t + dur + 0.1);
      later(siren, 60000 + Math.random() * 60000);
    }, 40000 + Math.random() * 30000);
  }

  /* The thunder, after the lightning: one of the recorded claps, a little
     deeper or higher, nearer or further (duller) each time; made (a crack
     far off and the long roll) until they're here. */
  function thunder() {
    if (!ctx || windingDown || !ambRunning) return;
    const t = now(), pan = Math.random() * 0.8 - 0.4;
    if (thunderBufs && thunderBufs.length) {
      const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = thunderBufs[Math.floor(Math.random() * thunderBufs.length)];
      s.playbackRate.value = 0.86 + Math.random() * 0.22;
      const far = Math.random();
      lp.type = "lowpass"; lp.frequency.value = 4200 - far * 2800;
      g.gain.value = THUNDER_GAIN * (1 - far * 0.45);
      s.connect(lp).connect(g); out(g, 1, 0.35, CH.rain, pan);
      s.start(t);
      return;
    }
    const dur = 5 + Math.random() * 3;
    const s = noise(t, dur + 0.2, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.08);
    for (let tt = t + 0.4; tt < t + dur * 0.7; tt += 0.3 + Math.random() * 0.5) g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.1, tt);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp).connect(g); out(g, 1, 0.5, CH.rain, pan);
  }

  /* A car on the board (noir-fx.js, from noir-traffic.js, a few times a
     second; null when there's none): { n (which car), v (its pace, street
     units a second: 0.38 turning, 0.62 down a street, 0.78 on the ring
     street), gain (0..1: its fade as it dissolves, and how near the
     camera it is), pan (-1..1), cutoff (Hz: further, duller) }. */
  function carSound(s) {
    if (!ctx || !ambRunning || windingDown || !carBufs) { if (car) stopCar(); return; }
    if (!s) { if (car) stopCar(); return; }
    if (!car || car.n !== s.n) { if (car) stopCar(); startCar(s); }
    const t = now();
    car.out.gain.setTargetAtTime(CAR_GAIN * Math.max(0, Math.min(1, s.gain)), t, 0.08);
    if (car.pan) car.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, s.pan || 0)), t, 0.08);
    car.lp.frequency.setTargetAtTime(Math.max(600, Math.min(12000, s.cutoff || 8000)), t, 0.1);
    // the engine's pitch with its pace (its idle at 1: 1.1 turning, 1.32
    // down a street, 1.47 on the ring street); the tyres louder and a
    // little higher the faster it goes
    car.eng.playbackRate.setTargetAtTime(0.75 + 0.92 * s.v, t, 0.35);
    car.tyr.playbackRate.setTargetAtTime(0.75 + 0.4 * s.v, t, 0.35);
    car.tyrG.gain.setTargetAtTime(TYRE_LEVEL * Math.min(1.2, s.v / 0.62), t, 0.3);
    // pulling out of a turn (its pace picking up past a turn's): the rev
    if (car.lastV < 0.45 && s.v >= 0.45 && carBufs.rev && t > car.revUntil) revCar(t);
    car.lastV = s.v;
  }
  function startCar(s) {
    const t = now(), outG = ctx.createGain(), lp = ctx.createBiquadFilter();
    outG.gain.value = 0; lp.type = "lowpass"; lp.frequency.value = s.cutoff || 8000;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    outG.connect(lp);
    const tail = pan ? (lp.connect(pan), pan) : lp;
    tail.connect(CH.city.bus);
    const snd = ctx.createGain(); snd.gain.value = 0.12; tail.connect(snd).connect(CH.city.send);
    const engG = ctx.createGain(); engG.gain.value = ENGINE_LEVEL; engG.connect(outG);
    const tyrG = ctx.createGain(); tyrG.gain.value = 0; tyrG.connect(outG);
    const eng = looping(carBufs.engine, 0.75 + 0.92 * s.v), tyr = looping(carBufs.tyres, 0.75 + 0.4 * s.v);
    eng.connect(engG); tyr.connect(tyrG);
    car = { n: s.n, out: outG, lp, pan, eng, tyr, engG, tyrG, lastV: s.v, revUntil: 0, born: t };
  }
  function revCar(t) {
    const r = ctx.createBufferSource(), rg = ctx.createGain(), d = carBufs.rev.duration;
    r.buffer = carBufs.rev; r.connect(rg).connect(car.out);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(ENGINE_LEVEL, t + 0.15);
    rg.gain.setValueAtTime(ENGINE_LEVEL, t + d - 0.35); rg.gain.linearRampToValueAtTime(0, t + d);
    // the steady engine steps back under it, and comes back as it ends:
    // up through the gear, and the change up
    car.engG.gain.cancelScheduledValues(t);
    car.engG.gain.setTargetAtTime(ENGINE_LEVEL * 0.12, t, 0.06);
    car.engG.gain.setTargetAtTime(ENGINE_LEVEL, t + d - 0.4, 0.12);
    r.start(t); r.stop(t + d + 0.05);
    car.rev = r; car.revUntil = t + d;
  }
  function stopCar() {
    if (!car || !ctx) { car = null; return; }
    const c = car, t = ctx.currentTime;
    car = null;
    c.out.gain.cancelScheduledValues(t); c.out.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => { [c.eng, c.tyr, c.rev].forEach((x) => { if (x) try { x.stop(); } catch (e) { /* stopped */ } }); try { c.out.disconnect(); } catch (e) { /* gone */ } }, 600);
  }

  function beginGameFadeIn() {
    ensureStarted(); if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) { zoom = z; if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.7 + 0.4 * z, ctx.currentTime, 0.4); }
  // tension: the rain heavier (the recording up to 30% louder; the made
  // rain, while it stands in, brighter: 5 kHz at the most)
  function setTension(v) {
    if (!ctx) return;
    if (rainLp) rainLp.frequency.setTargetAtTime(RAIN_LP + 1400 * v, ctx.currentTime, 1.2);
    if (rainBus) rainBus.gain.setTargetAtTime(RAIN_GAIN * (1 + 0.3 * Math.max(0, Math.min(1, v))), ctx.currentTime, 1.2);
  }
  function setMuted(m) { muted = m; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08); }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (vol && ctx) vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
  // The sound menu's sliders (chassis: theme.soundChannels; "All sounds"
  // comes multiplied in): a channel and its echo together.
  function setChannelLevel(key, v) {
    if (!(key in levels)) return;
    levels[key] = Math.max(0, Math.min(1, v));
    const c = CH[key];
    if (c && ctx) { c.gate.gain.setTargetAtTime(levels[key], ctx.currentTime, 0.04); c.send.gain.setTargetAtTime(levels[key], ctx.currentTime, 0.04); }
  }
  function setChannelMuted(key, off) { setChannelLevel(key, off ? 0 : 1); }
  function beginFadeOut(seconds) {
    if (windingDown) return;
    windingDown = true; clearTimers(); stopCar();
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
    band(t, 0.06, 2600, 0.8, 0.12, 0.001, CH.pieces, 0.3);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(4200, t + 0.02); o.frequency.exponentialRampToValueAtTime(9000, t + 0.6);
    g.gain.setValueAtTime(0, t + 0.02); g.gain.linearRampToValueAtTime(0.008, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); out(g, 1, 0.1); o.start(t); o.stop(t + 0.65);
    thud(t + 0.35, 70, 0.2, 0.45); band(t + 0.35, 0.12, 1800, 1.5, 0.05, 0.001, CH.pieces, 0.3);
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
      band(tt, 0.02, 2400, 3, lvl, 0.001, CH.pieces, 0.05);
      tt += 1 / rate;
    }
  }
  function playPowerOn() { ensureStarted(); if (ctx) projector(now(), 1.4, true); }
  function playPowerOff() { ensureStarted(); if (ctx) projector(now(), 1.3, false); }
  // a venetian blind: its slats clattering as the cord is pulled
  function blind(t0, up) {
    for (let i = 0; i < 9; i++) band(t0 + i * 0.022 * (up ? 1 : 1.25), 0.03, up ? 2600 + i * 120 : 3600 - i * 120, 2.5, 0.016, 0.001, CH.pieces, 0.08);
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
      const snd = ctx.createGain(); snd.gain.value = 0.5; og.connect(snd).connect(CH.pieces.send);
      g._oscs = (g._oscs || []).concat(o);
    });
  }
  function fadeOutMenu() { if (!menuVoice || !ctx) return; const g = menuVoice; menuVoice = null; const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.35); (g._oscs || []).forEach((o) => o.stop(t + 2)); }
  function stopMenu() { if (!menuVoice || !ctx) return; const g = menuVoice; menuVoice = null; g.gain.setValueAtTime(0, ctx.currentTime); (g._oscs || []).forEach((o) => { try { o.stop(); } catch (e) { /* stopped */ } }); }

  const noop = () => {};
  const api = {
    ensureStarted, beginGameFadeIn, setZoom, setMuted, setVolume, setTension, beginFadeOut, resetWindDown,
    setChannelLevel, setChannelMuted,
    playSelect, playDeselect, playBlocked, playRollStart, playLanding, playCapture, playWin,
    playMenu, fadeOutMenu, stopMenu, playRulesOpen, playRulesClose, playRulesTab,
    playPowerOn, playPowerOff, playDockOpen, playDockClose,
    // the thunder after noir-fx.js's lightning; the car on the board
    thunder, carSound,
    // (Tests: what's playing.)
    debugState: () => ({
      ctx: !!ctx, ambience: ambRunning, rain: rainOn ? "recording" : ambRunning ? "made" : null,
      thunder: thunderBufs ? thunderBufs.length : 0, carsReady: !!carBufs,
      car: car ? { n: car.n, rate: +car.eng.playbackRate.value.toFixed(3), gain: +car.out.gain.value.toFixed(4), revving: ctx.currentTime < car.revUntil } : null,
      levels: { ...levels },
    }),
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker: noop, playArc: noop, playGlitch: noop,
    playSingularityOpen: noop, playSingularityClose: noop, playSingularityBell: noop, playSingularityDismiss: noop,
    startSingularityHum: noop, updateSingularityHum: noop, stopSingularityHum: noop,
    continueSingularityHumThroughCollapse: noop, startSingularityCollapseRoar: noop,
    cutSingularityAudioToSilence: noop, resumeAudioAfterSingularity: noop,
    dispose() { clearTimers(); stopCar(); if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } } },
  };
  // (Tests: the sound itself.)
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__NOIR_AUDIO__ = api;
  return api;
}
