/* Ciudad's sound: the city at the hour it is, and the buildings moving.

   The city (the sound menu's "The city"), following the time of day
   (setHour, from ciudad-fx.js), is recorded (user: "find real sounds, not
   synthesized for the city"): one loop an hour, made by
   tools/ciudad_sounds.py from recordings of real streets (a park in Tel
   Aviv in the morning with its birds, a busy street in Szczecin in the
   afternoon, the high street of Gandia at seven in the evening, a street
   at work with a tram going by and the wind over it when it's overcast,
   New York's traffic far off with crickets and a restaurant at ten at
   night; assets/ciudad/src/CREDITS.md). The hour's loop is fetched when
   it's wanted and the one playing crossfaded into it over the light's own
   change (2.4 s).

   Opened from disk (a browser won't fetch a file beside the page), or if
   the recordings can't be had, the city is made here instead, as it was
   at first:
   - by day the traffic's low roar, a car going by now and then (to one
     side and the other), a bus's brakes, a crossing's beeps, birds (most
     in the morning), now and then a clank from the building sites;
   - overcast, the wind between the towers over it all, fewer birds;
   - at ten at night the roar down low, a car now and then, a siren far
     across the city, a door, someone's footsteps, the wind.
   (filtered noise, oscillators), each part's level eased as the hour
   changes.

   The pieces (the sound menu's "Pieces"): a crossing button's click to
   pick a building up, a softer one to put it down, a car's horn for a
   move that isn't allowed, hydraulics and steel as a building tips, a
   heavy footing coming down on the street, a demolition for a crush, a
   bright chord and a cheer to win. The dock a lift's doors and its
   chime; the rules a page turned. */

export const hasAudio = true;

// The city's recordings: one loop an hour, beside the page (build.js).
const BED_URL = (id) => `el-cabeza-ciudad-city-${id}.mp3`;
// (their files the loop with LOOP_PAD of its own end before it and of its
// start after it: tools/ciudad_sounds.py)
const LOOP_PAD = 0.3;
// The recordings made at the city's own loudness by the hour (the
// afternoon -20 dBFS, 10 PM -27); brought down to sit under the pieces'
// cues where the made city did. Measured on the city's channel (its mean
// over 12 s, calibrate in the scratch notes of that round): the made
// afternoon -37.8 dBFS, its 10 PM -43.5; the recordings at 0.1 were 5 dB
// under that, so this, 4 dB up, leaves them a dB under the made city's
// level (they sound the fuller for their middle frequencies, the made
// city's level being mostly its low roar).
const BED_GAIN = 0.16;
// The hour's change, as the light's (ciudad-time.js).
const BED_XFADE = 2.4;

// The made city (from disk), how each hour sounds: the roar, passing cars
// (a minute), birds (a minute), the sites' clanks (a minute), wind, sirens
// (an hour).
const HOURS = {
  morning: { roar: 0.05, cars: 7, birds: 22, clank: 3, wind: 0.0, sirens: 2, beeps: 2 },
  afternoon: { roar: 0.065, cars: 10, birds: 9, clank: 4, wind: 0.004, sirens: 4, beeps: 3 },
  golden: { roar: 0.06, cars: 9, birds: 12, clank: 1, wind: 0.004, sirens: 4, beeps: 2 },
  overcast: { roar: 0.055, cars: 8, birds: 3, clank: 2, wind: 0.02, sirens: 4, beeps: 2 },
  night: { roar: 0.03, cars: 4, birds: 0, clank: 0, wind: 0.01, sirens: 14, beeps: 0 },
};

export function createAudio() {
  let ctx = null, master = null, sfx = null, amb = null, intro = null, rev = null, wet = null, noiseBuf = null, brownBuf = null;
  let muted = false, windingDown = false, ambRunning = false, zoom = 0.5, volume = 1, vol = null, ambGain = null;
  let timers = [], menuVoice = null, hour = "morning", night = 0, roarG = null, windG = null, roarLp = null;
  // the city recorded: "loading" till the hour's loop is in, then
  // "recording"; "made" from disk or if none could be had
  let city = null, bedNow = null, meter = null;
  const beds = {};
  const CH = {}, levels = { city: 1, pieces: 1 };

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
      ambGain = ctx.createGain(); ambGain.gain.value = 0.75 + 0.35 * zoom; ambGain.connect(amb);
      // the street between the towers: a short, bright echo off the glass
      rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / len, 3); } }
      rev.buffer = ir;
      wet = ctx.createGain(); wet.gain.value = 0.18; rev.connect(wet).connect(master);
      const channel = (key, dest, pre) => {
        const gate = ctx.createGain(), send = ctx.createGain();
        gate.gain.value = levels[key]; send.gain.value = levels[key];
        gate.connect(dest); send.connect(rev);
        if (pre) pre.connect(gate);
        return { bus: pre || gate, gate, send };
      };
      sfx = ctx.createGain(); sfx.gain.value = 0.75;
      CH.pieces = channel("pieces", master, sfx);
      CH.city = channel("city", ambGain);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const bd = brownBuf.getChannelData(0); let b = 0; for (let i = 0; i < bd.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = b * 3.5; }
    } catch (e) { ctx = null; }
    // (the hour's recording on its way from the start, so it's here by the game)
    if (ctx && fetchable()) bed(hour);
  }
  function ensureStarted() { ensureGraph(); if (ctx && ctx.state === "suspended") ctx.resume(); }
  const now = () => ctx.currentTime + 0.005;

  /* ---- the city recorded ---- */
  // (Not from disk: a browser won't fetch a file beside a page opened from disk.)
  const fetchable = () => typeof fetch === "function" && !(typeof location !== "undefined" && location.protocol === "file:");
  function fetchBuffer(url) {
    return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((ab) => ctx.decodeAudioData(ab));
  }
  // A loop: from its first sound + LOOP_PAD to its last - LOOP_PAD (an
  // encoder's padding left out), as Noir's.
  function loopOf(buf) {
    const d = buf.getChannelData(0), lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
    let a = 0, z = d.length - 1;
    while (a < lim && Math.abs(d[a]) < 1e-4) a++;
    while (z > d.length - lim && Math.abs(d[z]) < 1e-4) z--;
    return { buf, start: a / buf.sampleRate + LOOP_PAD, end: (z + 1) / buf.sampleRate - LOOP_PAD };
  }
  function bed(id) {
    if (!beds[id]) { beds[id] = fetchBuffer(BED_URL(id)).then(loopOf); beds[id].catch(() => {}); }
    return beds[id];
  }
  // The hour's loop in, the one before out, over `secs`; if the hour's
  // been changed again by the time it's in, that change's own call plays.
  function playBed(id, secs) {
    bed(id).then((clip) => {
      if (!ctx || !ambRunning || hour !== id || (bedNow && bedNow.id === id)) return;
      city = "recording";
      const t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = clip.buf; s.loop = true; s.loopStart = clip.start; s.loopEnd = clip.end;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(BED_GAIN, t + secs);
      s.connect(g).connect(CH.city.bus);
      s.start(t, clip.start + Math.random() * Math.max(0, clip.end - clip.start - 1));
      if (bedNow) {
        const old = bedNow;
        old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + secs);
        try { old.s.stop(t + secs + 0.1); } catch (e) { /* stopped */ }
      }
      bedNow = { id, s, g };
    }).catch(() => {
      // (none to be had: the made city stands in, unless one's playing)
      if (city !== "recording" && ambRunning) startMade();
    });
  }
  // The city channel's level now (dBFS), for the tests.
  function cityLevel() {
    if (!ctx || !CH.city) return null;
    if (!meter) { meter = ctx.createAnalyser(); meter.fftSize = 16384; CH.city.gate.connect(meter); }
    const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
    let e = 0; for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    return 20 * Math.log10(Math.sqrt(e / d.length) + 1e-12);
  }

  /* ---- pieces of sound ---- */
  function out(node, dry, send, chan = CH.pieces, pan = 0) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); n = p; }
    const g1 = ctx.createGain(); g1.gain.value = dry; n.connect(g1).connect(chan.bus);
    const g2 = ctx.createGain(); g2.gain.value = send; n.connect(g2).connect(chan.send);
  }
  function noise(t0, dur, buf = noiseBuf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, Math.random() * 1.5); s.stop(t0 + dur); return s; }
  function band(t0, dur, f, q, level, attack = 0.004, chan = CH.pieces, send = 0.08, pan = 0) {
    const s = noise(t0, dur + 0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp).connect(g); out(g, 1, send, chan, pan);
  }
  function thud(t0, f, level, send = 0.25, chan = CH.pieces, pan = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.8, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(g); out(g, 1, send, chan, pan); o.start(t0); o.stop(t0 + 0.34);
    const s = noise(t0, 0.2, brownBuf), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 520;
    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(level * 0.8, t0 + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    s.connect(lp).connect(ng); out(ng, 1, send * 0.7, chan, pan);
  }
  function tone(t0, f, level, dur, type = "sine", chan = CH.pieces, send = 0.2, pan = 0, f1 = null) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); out(g, 1, send, chan, pan); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // a bell-like note (a few decaying partials), for chimes and chords
  function bell(t0, f, level, dur, chan = CH.pieces, send = 0.4) {
    [[1, 1, 1], [2.01, 0.4, 0.6], [3.02, 0.18, 0.4], [4.2, 0.08, 0.25]].forEach(([r, a, d]) => tone(t0, f * r, level * a, dur * d, "sine", chan, send));
  }

  /* ---- the city ---- */
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
  const H = () => HOURS[hour] || HOURS.morning;
  // every so often, on average n a minute (n an hour for sirens), something
  function every(perMin, fn, perHour = false) {
    const go = () => {
      const rate = perHour ? perMin / 60 : perMin;
      if (rate > 0 && ambRunning && !windingDown) fn();
      const mean = rate > 0 ? 60000 / rate : 20000;
      later(go, mean * (0.4 + Math.random() * 1.2));
    };
    later(go, 1500 + Math.random() * 6000);
  }
  function startAmbience() {
    if (ambRunning || !ctx) return;
    ambRunning = true;
    if (fetchable()) { city = "loading"; playBed(hour, 2.5); } else startMade();
  }
  // The made city (from disk, or no recording to be had).
  function startMade() {
    if (city === "made" || !ctx) return;
    city = "made";
    // the traffic's roar: low, swelling a little as the city breathes
    const r = ctx.createBufferSource(); r.buffer = brownBuf; r.loop = true;
    roarLp = ctx.createBiquadFilter(); roarLp.type = "lowpass"; roarLp.frequency.value = 420;
    roarG = ctx.createGain(); roarG.gain.value = H().roar;
    r.connect(roarLp).connect(roarG).connect(CH.city.bus); r.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.04; lg.gain.value = 0.012; lfo.connect(lg).connect(roarG.gain); lfo.start();
    // the wind between the towers
    const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
    const wb = ctx.createBiquadFilter(); wb.type = "bandpass"; wb.frequency.value = 700; wb.Q.value = 0.5;
    windG = ctx.createGain(); windG.gain.value = H().wind;
    w.connect(wb).connect(windG).connect(CH.city.bus); w.start();
    const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.07; wlg.gain.value = 300; wl.connect(wlg).connect(wb.frequency); wl.start();
    scheduleCity();
  }
  function scheduleCity() {
    every(1, () => { if (Math.random() < H().cars / 12) passBy(); });
    every(1, () => { if (Math.random() < H().birds / 30) birds(); });
    every(1, () => { if (Math.random() < H().clank / 6) clank(); });
    every(1, () => { if (Math.random() < H().beeps / 6) crossing(); });
    every(1, () => { if (Math.random() < H().sirens / 40) siren(); });
    every(1, () => { if (night > 0.5 && Math.random() < 0.2) steps(); });
  }
  // a car going by, from one side to the other: its tyres' hiss and its engine, rising and falling
  function passBy() {
    const t = now(), dur = 3.2 + Math.random() * 2.5, dir = Math.random() < 0.5 ? -1 : 1, lvl = 0.035 + Math.random() * 0.03;
    const s = noise(t, dur + 0.1, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.5); g.gain.linearRampToValueAtTime(0, t + dur);
    let n = s.connect(lp).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.8 * dir, t); p.pan.linearRampToValueAtTime(0.8 * dir, t + dur); n = n.connect(p); }
    n.connect(CH.city.bus);
    const o = ctx.createOscillator(), og = ctx.createGain(), f = 55 + Math.random() * 30;
    o.type = "sawtooth"; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + dur);
    const olp = ctx.createBiquadFilter(); olp.type = "lowpass"; olp.frequency.value = 260;
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(lvl * 0.35, t + dur * 0.5); og.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(olp).connect(og).connect(CH.city.bus); o.start(t); o.stop(t + dur + 0.05);
  }
  // birds: a few quick chirps, somewhere up in the trees
  function birds() {
    const t = now(), n = 2 + Math.floor(Math.random() * 5), base = 2600 + Math.random() * 1800, pan = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < n; i++) {
      const t1 = t + i * (0.09 + Math.random() * 0.12), f = base * (0.9 + Math.random() * 0.25);
      tone(t1, f, 0.012 + Math.random() * 0.008, 0.06 + Math.random() * 0.05, "sine", CH.city, 0.25, pan, f * (Math.random() < 0.5 ? 1.35 : 0.75));
    }
  }
  // a clank from a building site: steel on steel, far off
  function clank() {
    const t = now(), pan = Math.random() * 1.2 - 0.6, f = 520 + Math.random() * 380;
    [[1, 1], [2.76, 0.4], [5.4, 0.2]].forEach(([r, a]) => tone(t, f * r, 0.014 * a, 0.5, "triangle", CH.city, 0.5, pan));
    if (Math.random() < 0.5) [[1, 1], [2.76, 0.4]].forEach(([r, a]) => tone(t + 0.42, f * 1.05 * r, 0.01 * a, 0.4, "triangle", CH.city, 0.5, pan));
  }
  // a crossing's beeps, the walk sign on
  function crossing() {
    const t = now(), pan = Math.random() * 1.2 - 0.6;
    for (let i = 0; i < 6; i++) tone(t + i * 0.32, 2400, 0.006, 0.05, "square", CH.city, 0.3, pan);
  }
  // a siren far off across the city: a wail rising and falling, dull with distance
  function siren() {
    const t = now(), dur = 6 + Math.random() * 4, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.setValueAtTime(620, t);
    for (let k = 0; k < dur / 1.6; k++) { o.frequency.linearRampToValueAtTime(980, t + k * 1.6 + 0.8); o.frequency.linearRampToValueAtTime(620, t + k * 1.6 + 1.6); }
    lp.type = "lowpass"; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.008, t + 1.5); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp).connect(g); out(g, 1, 0.6, CH.city, Math.random() * 1.6 - 0.8); o.start(t); o.stop(t + dur + 0.1);
  }
  // someone walking home: a few footsteps going by
  function steps() {
    const t = now(), n = 6 + Math.floor(Math.random() * 6), pan0 = Math.random() < 0.5 ? -0.6 : 0.6;
    for (let i = 0; i < n; i++) band(t + i * 0.42, 0.05, 1500, 1.4, 0.01 * Math.sin((Math.PI * (i + 1)) / (n + 1)), 0.002, CH.city, 0.4, pan0 * (1 - (2 * i) / n));
  }
  function setHour(id, n) {
    night = n || 0;
    if (id === hour) return;
    hour = HOURS[id] ? id : "morning";
    if (!ctx) return;
    if (city === "recording" || city === "loading") { playBed(hour, BED_XFADE); return; }
    if (!roarG) return;
    const t = ctx.currentTime;
    roarG.gain.setTargetAtTime(H().roar, t, 1.2);
    windG.gain.setTargetAtTime(H().wind, t, 1.2);
    roarLp.frequency.setTargetAtTime(hour === "night" ? 300 : 420, t, 1.2);
  }

  function beginGameFadeIn() {
    ensureStarted(); if (!ctx) return;
    startAmbience();
    const t0 = ctx.currentTime;
    master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(muted ? 0 : 1, t0);
    intro.gain.cancelScheduledValues(t0); intro.gain.setValueAtTime(0, t0); intro.gain.linearRampToValueAtTime(1, t0 + 3);
  }
  function setZoom(z) { zoom = z; if (ambGain && ctx) ambGain.gain.setTargetAtTime(0.75 + 0.35 * z, ctx.currentTime, 0.4); }
  function setTension() {}
  function setMuted(m) { muted = m; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.08); }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (vol && ctx) vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
  function setChannelLevel(key, v) {
    if (!(key in levels)) return;
    levels[key] = Math.max(0, Math.min(1, v));
    const c = CH[key];
    if (c && ctx) { c.gate.gain.setTargetAtTime(levels[key], ctx.currentTime, 0.04); c.send.gain.setTargetAtTime(levels[key], ctx.currentTime, 0.04); }
  }
  function setChannelMuted(key, off) { setChannelLevel(key, off ? 0 : 1); }
  function beginFadeOut(seconds) {
    if (windingDown) return;
    windingDown = true;
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
  }

  /* ---- cues ---- */
  const massOf = (v) => Math.max(1, Math.min(8, v || 1));
  // a crossing's push button: its click and a short tone
  function playSelect() { ensureGraph(); if (!ctx) return; const t = now(); band(t, 0.025, 3800, 2, 0.05, 0.001); tone(t + 0.02, 1320, 0.02, 0.09, "sine", CH.pieces, 0.15); }
  function playDeselect() { ensureGraph(); if (!ctx) return; const t = now(); band(t, 0.02, 3000, 2, 0.03, 0.001); }
  // a car's horn, twice, short (not that way)
  function playBlocked() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    for (const t1 of [t, t + 0.17]) { tone(t1, 415, 0.022, 0.11, "sawtooth", CH.pieces, 0.2); tone(t1, 523, 0.016, 0.11, "sawtooth", CH.pieces, 0.2); }
  }
  // hydraulics and steel as the building tips: a low hum rising, a creak
  function playRollStart(volumeUnits, durationMs) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), dur = Math.max(0.15, (durationMs || 400) / 1000), t = now();
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(70 / Math.pow(m, 0.2), t); o.frequency.linearRampToValueAtTime(110 / Math.pow(m, 0.2), t + dur);
    lp.type = "lowpass"; lp.frequency.value = 300;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03 + m * 0.004, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp).connect(g); out(g, 1, 0.2); o.start(t); o.stop(t + dur + 0.05);
    band(t + dur * 0.2, dur * 0.7, 900 + Math.random() * 400, 9, 0.02, 0.05);
  }
  // a heavy footing down on the street, a little grit after it
  function playLanding(volumeUnits) {
    ensureGraph(); if (!ctx) return;
    const m = massOf(volumeUnits), t = now();
    thud(t, 95 / Math.pow(m, 0.3), 0.1 + 0.015 * Math.log2(m));
    band(t + 0.02, 0.25, 2600, 0.8, 0.012 + 0.002 * m, 0.003, CH.pieces, 0.15);
  }
  // a demolition: a deep blow, then the rubble coming down
  function playCapture() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    thud(t, 55, 0.24, 0.5);
    const s = noise(t + 0.05, 1.4, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(2200, t + 0.05); lp.frequency.exponentialRampToValueAtTime(300, t + 1.4);
    g.gain.setValueAtTime(0, t + 0.05); g.gain.linearRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    s.connect(lp).connect(g); out(g, 1, 0.35);
    for (let i = 0; i < 9; i++) thud(t + 0.15 + Math.random() * 0.9, 120 + Math.random() * 200, 0.02 + Math.random() * 0.02, 0.2);
  }
  // the ribbon cut: a bright chord, bells, and a cheer from the street
  function playWin() {
    ensureGraph(); if (!ctx) return;
    const t = now();
    [261.6, 329.6, 392, 523.3].forEach((f, i) => bell(t + i * 0.08, f, 0.035, 3.2));
    bell(t + 0.45, 784, 0.025, 2.4);
    const s = noise(t + 0.3, 2.6), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0, t + 0.3); g.gain.linearRampToValueAtTime(0.03, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    s.connect(bp).connect(g); out(g, 1, 0.4);
  }
  // the city coming up (the power on), going down (off): its roar swells, falls
  function hum(t0, dur, up) {
    const s = noise(t0, dur + 0.1, brownBuf), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(up ? 120 : 600, t0); lp.frequency.exponentialRampToValueAtTime(up ? 600 : 120, t0 + dur);
    g.gain.setValueAtTime(up ? 0 : 0.06, t0); g.gain.linearRampToValueAtTime(up ? 0.06 : 0, t0 + dur);
    s.connect(lp).connect(g); out(g, 1, 0.2);
  }
  function playPowerOn() { ensureStarted(); if (ctx) hum(now(), 1.4, true); }
  function playPowerOff() { ensureStarted(); if (ctx) hum(now(), 1.3, false); }
  // a lift: its doors sliding, its chime
  function playDockOpen() { ensureGraph(); if (!ctx) return; const t = now(); band(t, 0.35, 900, 0.7, 0.015, 0.05); bell(t + 0.05, 1046.5, 0.012, 0.9); }
  function playDockClose() { ensureGraph(); if (!ctx) return; const t = now(); band(t, 0.3, 700, 0.7, 0.013, 0.05); bell(t + 0.05, 784, 0.01, 0.8); }
  function page(t0, level) { const s = noise(t0, 0.25), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = "bandpass"; bp.frequency.setValueAtTime(1800, t0); bp.frequency.linearRampToValueAtTime(4200, t0 + 0.2); bp.Q.value = 0.6; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24); s.connect(bp).connect(g); out(g, 1, 0.08); }
  function playRulesOpen() { ensureGraph(); if (ctx) page(now(), 0.03); }
  function playRulesClose() { ensureGraph(); if (ctx) page(now(), 0.025); }
  function playRulesTab() { ensureGraph(); if (ctx) band(now(), 0.025, 3400, 2, 0.03, 0.001); }
  // the About card's voice: a soft open chord, held
  function playMenu() {
    ensureGraph(); if (!ctx) return;
    stopMenu();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(sfx); menuVoice = g;
    const t = now();
    [196, 293.7, 392, 493.9, 587.3].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f * (1 + i * 0.0008);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.004, t + 1.8);
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
    setChannelLevel, setChannelMuted, setHour,
    playSelect, playDeselect, playBlocked, playRollStart, playLanding, playCapture, playWin,
    // The Cabeza's moves (it only slides, the chassis's slidesOnly): the rumble of a building moved, no landing.
    playSlide: playRollStart,
    playMenu, fadeOutMenu, stopMenu, playRulesOpen, playRulesClose, playRulesTab,
    playPowerOn, playPowerOff, playDockOpen, playDockClose,
    debugState: () => ({ ctx: !!ctx, ambience: ambRunning, hour, night, levels: { ...levels }, city, bed: bedNow && bedNow.id, fetched: Object.keys(beds) }),
    cityLevel,
    playFlicker: noop, playArc: noop, playGlitch: noop,
    playSingularityOpen: noop, playSingularityClose: noop, playSingularityBell: noop, playSingularityDismiss: noop,
    startSingularityHum: noop, updateSingularityHum: noop, stopSingularityHum: noop,
    continueSingularityHumThroughCollapse: noop, startSingularityCollapseRoar: noop,
    cutSingularityAudioToSilence: noop, resumeAudioAfterSingularity: noop,
    dispose() { clearTimers(); if (bedNow) { try { bedNow.s.stop(); } catch (e) { /* stopped */ } bedNow = null; } if (ctx) { try { ctx.close(); } catch (e) { /* closed */ } } },
  };
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__CIUDAD_AUDIO__ = api;
  return api;
}
