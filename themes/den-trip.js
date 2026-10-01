/* The trip back to Big Glutts (user), after the call: "free pieces, come
   get them". The card fades as a car starts up and drives away; black;
   out of the black, the car arriving (an old 1970s car: a little squeal
   of tired brakes, the stop, the shift into park, the ignition off) as
   the picture fades up on Big Glutts in a strip mall, the camera panning
   past it (the user's picture, assets/den/trip/glutts-day.jpg).
   "What the...!??" The scene starts to warp and merge into the same
   place at a burning dusk with the Singularity's black sphere in the sky
   (glutts-dusk.jpg); nearly there: "Time to get the heck out of here!"
   Black again, and back home: the den, in the Room view.

   den-fx.js makes it (createTrip) and starts it from den-call.js's card
   (onTrip). The pictures are files beside the page (build/build.js). The
   car leaving and arriving are the user's recordings (CAR_URLS); the
   wind and the drone are made here, through the den's audio (phoneOutput's
   ear: straight to the master), while the den's own sounds step out
   (awayFromDen). */

const DAY_URL = "el-cabeza-trip-day.jpg";
const DUSK_URL = "el-cabeza-trip-dusk.jpg";
// The car, the user's recordings: leaving (tightened and faded right
// after the first acceleration, tools/den_car_away.py; 9.4 s from the
// card's fade) and arriving (faded in half way through, then the stop,
// the engine off, the door; tools/den_car_arrive.py; from T.arrive).
// driveAway / arrive below stand in until they're loaded, or if they
// can't be.
const CAR_URLS = { away: "el-cabeza-den-car-away.mp3", arrive: "el-cabeza-den-car-arrive.mp3" };
const CAR_LEVEL = 0.9;

// The timeline (ms from the card starting to fade).
// (All of it 1.75 times as long as it was, user: it went by too fast.)
const T = {
  blackIn: [1500, 6400],     // to black, the car pulling away (sooner and slower, user: it hovered on the board too long; den-fx.js pulls the camera back meanwhile)
  arrive: 9800,              // the car coming in (heard through the fade-in)
  fadeUp: [10200, 17000],    // up from black onto the store
  sweep: [10200, 20800],     // the look round: from the whole storefront, in close and along it
  rise: [20500, 30800],      // then up and out, to the sky and the sphere behind the building
  say1: [17500, 23100],      // "What the...!??"
  morph: [20300, 28700],     // into dusk, the sphere in the sky
  say2: [26600, 31200],      // "Time to get the heck out of here!"
  blackOut: [30500, 33100],  // to black
  home: 33300,               // the den, the Room view
  fadeHome: [33600, 36800],  // up from black, home
};
const LINES = ["What the…!??", "Time to get the heck out of here!"];

const CSS = `
.den-trip { position: fixed; inset: 0; z-index: 1350; pointer-events: auto; background: transparent; }
.den-trip canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.den-trip .black { position: absolute; inset: 0; background: #000; opacity: 0; }
.den-trip .say { position: absolute; left: 7%; bottom: 16%; max-width: min(78vw, 420px); padding: 14px 20px 15px; background: #fffdf6;
  color: #1d1610; border: 3px solid #1d1610; border-radius: 22px; box-shadow: 4px 5px 0 rgba(0,0,0,0.35);
  font: 400 clamp(24px, 6.4vw, 36px)/1.12 'Patrick Hand', 'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', cursive;
  opacity: 0; transform: scale(0.6) rotate(-2deg); transform-origin: 12% 110%; transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.2, 1.6, 0.4, 1); }
.den-trip .say::after { content: ""; position: absolute; left: 28px; bottom: -22px; width: 26px; height: 24px; background: #fffdf6;
  border-left: 3px solid #1d1610; border-bottom: 3px solid #1d1610; transform: skewX(-28deg) rotate(-12deg); border-bottom-left-radius: 6px; }
.den-trip .say.on { opacity: 1; transform: scale(1) rotate(-2deg); }
.den-trip .say.two { left: auto; right: 7%; bottom: 20%; transform-origin: 88% 110%; }
.den-trip .say.two::after { left: auto; right: 34px; transform: skewX(28deg) rotate(12deg); border-left: 0; border-right: 3px solid #1d1610; border-bottom-left-radius: 0; border-bottom-right-radius: 6px; }
.den-trip .say.two.on { transform: scale(1) rotate(1.5deg); }
@media (prefers-reduced-motion: reduce) { .den-trip .say { transition: none; } }
`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const span = (t, [a, b]) => clamp01((t - a) / (b - a));

export function createTrip({ audio, onReturn }) {
  const doc = typeof document !== "undefined" ? document : null;
  let root = null, canvas = null, g = null, black = null, says = [], raf = 0, t0 = 0, stage = "idle", returned = false;
  const imgs = { day: null, dusk: null };
  let nodes = [], timers = [], pinned = null;
  const cars = { away: {}, arrive: {} }; // each { buf, loading, el, src }
  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };

  function load() {
    if (!doc || imgs.day) return;
    ["day", "dusk"].forEach((k) => {
      const im = new Image();
      im.decoding = "async";
      im.src = k === "day" ? DAY_URL : DUSK_URL;
      imgs[k] = im;
    });
    loadCar();
    if (!doc.querySelector("link[data-patrick-hand]")) {
      const l = doc.createElement("link"); l.rel = "stylesheet"; l.setAttribute("data-patrick-hand", "");
      l.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap";
      doc.head.appendChild(l);
    }
  }

  /* ---------------- the sound ---------------- */
  function out() {
    const o = audio && audio.phoneOutput ? audio.phoneOutput() : null;
    return o && o.ctx ? o : null;
  }
  // The recordings of the car (fetched and decoded; from disk, <audio>
  // elements, sent the same way when they play).
  function loadCar() {
    const fromDisk = typeof location !== "undefined" && location.protocol === "file:";
    Object.keys(cars).forEach((k) => {
      const c = cars[k];
      if (c.buf || c.el || c.loading) return;
      c.loading = true;
      if (fromDisk) {
        if (typeof Audio === "undefined") return;
        c.el = new Audio(CAR_URLS[k]); c.el.preload = "auto"; c.el.load();
        return;
      }
      const o = out();
      if (!o || typeof fetch === "undefined") { c.loading = false; return; }
      fetch(CAR_URLS[k]).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => o.ctx.decodeAudioData(b)).then((buf) => { c.buf = buf; }).catch(() => { /* the made one, then */ });
    });
  }
  const carReady = (k) => !!(cars[k].buf || (cars[k].el && cars[k].el.readyState >= 2));
  // Recording k at audio time t, if it's here (true); else nothing.
  function car(k, o, t) {
    const c = cars[k];
    if (c.buf) {
      const src = keep(o.ctx.createBufferSource()); src.buffer = c.buf;
      const gg = o.ctx.createGain(); gg.gain.value = CAR_LEVEL;
      src.connect(gg).connect(o.ear); src.start(t);
      return true;
    }
    if (c.el && c.el.readyState >= 2) {
      try {
        if (!c.src) { c.src = o.ctx.createMediaElementSource(c.el); const gg = o.ctx.createGain(); gg.gain.value = CAR_LEVEL; c.src.connect(gg).connect(o.ear); }
        const go = () => { try { c.el.currentTime = 0; const p = c.el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* fine */ } };
        const ms = (t - o.ctx.currentTime) * 1000;
        if (ms > 30) later(ms, go); else go();
        return true;
      } catch (e) { return false; }
    }
    return false;
  }
  const keep = (n) => { nodes.push(n); return n; };
  function noiseSrc(ctx, buf, t, dur) {
    const s = keep(ctx.createBufferSource()); s.buffer = buf; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
  }
  function burst(o, t, level, dur, filters, dest) {
    const { ctx, noise } = o;
    let n = noiseSrc(ctx, noise, t, dur + 0.05);
    filters.forEach(([type, f, q]) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; n.connect(b); n = b; });
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(level, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(gg).connect(dest);
  }
  /* A 1970s V8: the firing at f (a sawtooth, through a lowpass), the
     lope (a square at f/2 nudging the level), and the exhaust's puffs
     (noise, in time with it). `plan` is [time, f, level, cutoff, pan]
     points, ramped between. */
  function engine(o, plan, dest) {
    const { ctx, noise } = o;
    const tA = plan[0][0], tZ = plan[plan.length - 1][0];
    const saw = keep(ctx.createOscillator()); saw.type = "sawtooth";
    const lope = keep(ctx.createOscillator()); lope.type = "square";
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 2.2;
    const sh = ctx.createWaveShaper();
    { const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; c[i] = Math.tanh(2.2 * x); } sh.curve = c; }
    const lvl = ctx.createGain(); lvl.gain.value = 0;
    const am = ctx.createGain(); am.gain.value = 0.8;
    const lopeG = ctx.createGain(); lopeG.gain.value = 0.22;
    lope.connect(lopeG).connect(am.gain);
    const puff = noiseSrc(ctx, noise, tA, tZ - tA + 0.2);
    const pbp = ctx.createBiquadFilter(); pbp.type = "bandpass"; pbp.Q.value = 0.8;
    const pg = ctx.createGain(); pg.gain.value = 0.35;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    saw.connect(sh).connect(lp);
    puff.connect(pbp).connect(pg).connect(lp);
    lp.connect(am).connect(lvl);
    if (pan) lvl.connect(pan).connect(dest); else lvl.connect(dest);
    plan.forEach(([t, f, l, cut, p], i) => {
      const set = i === 0 ? "setValueAtTime" : "linearRampToValueAtTime";
      saw.frequency[set](f, t); lope.frequency[set](f / 2, t); pbp.frequency[set](f * 6, t);
      lvl.gain[set](l, t); lp.frequency[set](cut, t);
      if (pan) pan.pan[set](p || 0, t);
    });
    saw.start(tA); lope.start(tA); saw.stop(tZ + 0.1); lope.stop(tZ + 0.1);
  }
  function tone(o, t, f0, f1, dur, level, type, dest, vib = 0) {
    const { ctx } = o;
    const os = keep(ctx.createOscillator()); os.type = type || "sine";
    os.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vib) { const l = keep(ctx.createOscillator()); l.frequency.value = 6.5; const lg = ctx.createGain(); lg.gain.value = vib; l.connect(lg).connect(os.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(level, t + Math.min(0.06, dur * 0.3)); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(gg).connect(dest); os.start(t); os.stop(t + dur + 0.05);
  }
  // Starting up in the driveway and driving off (from t).
  function driveAway(o, t) {
    const { ctx } = o;
    const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(o.ear);
    // The starter: a whine, chugging with the compression, a few turns.
    {
      const s = keep(ctx.createOscillator()); s.type = "sawtooth"; s.frequency.setValueAtTime(150, t); s.frequency.linearRampToValueAtTime(190, t + 1.1);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 1.2;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.05, t + 0.05); gg.gain.setValueAtTime(0.05, t + 1.05); gg.gain.linearRampToValueAtTime(0.0001, t + 1.15);
      const ch = keep(ctx.createOscillator()); ch.type = "square"; ch.frequency.value = 9.5; const chg = ctx.createGain(); chg.gain.value = 0.025; ch.connect(chg).connect(gg.gain);
      s.connect(bp).connect(gg).connect(bus); s.start(t); ch.start(t); s.stop(t + 1.2); ch.stop(t + 1.2);
      for (let i = 0; i < 10; i++) burst(o, t + 0.05 + i * 0.105, 0.09, 0.08, [["lowpass", 420]], bus);
    }
    // It catches: a rev, settling to a lumpy idle; then into gear and off,
    // up through first, a shift, on into second, away into the distance.
    const c = t + 1.1;
    engine(o, [
      [c, 14, 0.0, 300, 0], [c + 0.08, 30, 0.2, 700, 0], [c + 0.5, 72, 0.24, 1400, 0], [c + 1.1, 36, 0.2, 700, 0],
      [c + 2.0, 33, 0.19, 650, 0], [c + 2.3, 38, 0.21, 800, 0.05], [c + 4.3, 74, 0.22, 1100, 0.3],
      [c + 4.6, 50, 0.17, 800, 0.38], [c + 6.6, 70, 0.12, 600, 0.6], [c + 8.4, 72, 0.0, 300, 0.75],
    ], bus);
    // The tyres on the drive, pulling away.
    { const n = noiseSrc(ctx, o.noise, c + 2.2, 3.4); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 0.6;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, c + 2.2); gg.gain.linearRampToValueAtTime(0.03, c + 2.7); gg.gain.linearRampToValueAtTime(0.0001, c + 5.5);
      n.connect(bp).connect(gg).connect(bus); }
  }
  // Pulling in and stopping (from t): approach, the brakes, park, off.
  function arrive(o, t) {
    const { ctx } = o;
    const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(o.ear);
    const b = t + 2.3; // braking
    const stop = b + 0.75;
    engine(o, [
      [t, 64, 0.0, 300, -0.6], [t + 1.4, 58, 0.14, 700, -0.35], [b, 50, 0.19, 1000, -0.1],
      [stop, 34, 0.2, 750, 0], [stop + 1.3, 33, 0.19, 700, 0], [stop + 1.32, 31, 0.19, 680, 0],
      [stop + 1.9, 33, 0.19, 700, 0], [stop + 1.95, 20, 0.12, 500, 0], [stop + 2.35, 9, 0.0, 300, 0],
    ], bus);
    // The brakes: a little squeal (tired, not dramatic), the tyres.
    tone(o, b + 0.15, 2650, 2500, 0.62, 0.02, "sine", bus, 28);
    tone(o, b + 0.2, 5300, 5000, 0.45, 0.005, "sine", bus, 50);
    { const n = noiseSrc(ctx, o.noise, b, 0.9); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, b); gg.gain.linearRampToValueAtTime(0.035, b + 0.15); gg.gain.linearRampToValueAtTime(0.0001, stop + 0.05);
      n.connect(bp).connect(gg).connect(bus); }
    // The car rocking back on its springs.
    tone(o, stop, 70, 45, 0.3, 0.07, "sine", bus);
    // Into park: the column shifter's clunk and click.
    tone(o, stop + 1.3, 95, 60, 0.16, 0.12, "sine", bus);
    burst(o, stop + 1.3, 0.09, 0.05, [["bandpass", 2200, 1.5]], bus);
    burst(o, stop + 1.36, 0.05, 0.03, [["highpass", 3000]], bus);
    // The key turned back: a click, the engine shuddering to a stop.
    burst(o, stop + 1.92, 0.06, 0.025, [["highpass", 3500]], bus);
    burst(o, stop + 2.2, 0.05, 0.12, [["lowpass", 300]], bus);
  }
  // Outside: a wind, the whole time there.
  function wind(o, t, dur) {
    const { ctx } = o;
    const n = noiseSrc(ctx, o.noise, t, dur);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.5;
    const sweep = keep(ctx.createOscillator()); sweep.frequency.value = 0.13; const sg = ctx.createGain(); sg.gain.value = 260; sweep.connect(sg).connect(lp.frequency);
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.05, t + 2.5); gg.gain.setValueAtTime(0.05, t + dur - 2); gg.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(gg).connect(o.ear); sweep.start(t); sweep.stop(t + dur + 0.1);
  }
  // The sky turning: a low drone that swells and beats as it merges.
  function drone(o, t, dur) {
    const { ctx } = o;
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.13, t + dur * 0.8); gg.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
    gg.connect(o.ear);
    [[38, "sine", 1], [57.3, "sine", 0.6], [76.6, "triangle", 0.25], [1530, "sine", 0.03]].forEach(([f, type, l]) => {
      const os = keep(ctx.createOscillator()); os.type = type; os.frequency.setValueAtTime(f, t); os.frequency.linearRampToValueAtTime(f * 0.94, t + dur);
      const og = ctx.createGain(); og.gain.value = l; os.connect(og).connect(gg); os.start(t); os.stop(t + dur + 1.4);
    });
  }

  /* ---------------- the picture ---------------- */
  function size() {
    if (!canvas) return;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  /* One frame. The camera: first the whole storefront, then in close and
     along it, to the right, down to eye level (taking it in); then, as the
     day turns to dusk and the sphere comes through behind the building,
     it tilts up and pulls back, slow and wide, until the sphere looms
     over the store. (Framing in the picture's own terms: a zoom over
     "cover the screen", and the point of the picture at the screen's
     middle; kept inside the picture.) The dusk picture comes through the
     day one in wavering bands, the day one wavering out; both are the
     same place from the same spot, so they line up. */
  function draw(now) {
    if (!g || !imgs.day || !imgs.day.complete) return;
    size();
    const W = canvas.width, H = canvas.height, t = now - t0;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const iw = imgs.day.naturalWidth || 1312, ih = imgs.day.naturalHeight || 597;
    const cover = Math.max(W / iw, H / ih);
    const sw = sm(span(t, T.sweep));
    const ri = span(t, T.rise), r = ri * ri * ri * (ri * (ri * 6 - 15) + 10); // (smoother still: slow out, slow in)
    // (A tall screen already crops the picture's sides: less zoom there.)
    // (User: zoomed out at first, then zoom and pan.) The whole storefront
    // as it fades up; then in, closer, and along it to the right; then
    // up and out again. (A tall screen already crops the sides: less zoom.)
    const tall = W < H, zs = tall ? 1.18 : 1.5;
    const zoom = 1 + (zs - 1) * sw - (zs - 1) * r;
    let cx = 0.36 + 0.46 * sw, cy = 0.5 + 0.14 * sw;        // from the middle, in and along the front, down to eye level
    cx += ((tall ? 0.3 : 0.36) - cx) * r; cy += (0.4 - cy) * r; // up, and toward the sphere
    const s = cover * zoom, dw = iw * s, dh = ih * s;
    const x = Math.min(0, Math.max(W - dw, W / 2 - cx * dw));
    const y = Math.min(0, Math.max(H - dh, H / 2 - cy * dh));
    const m = sm(span(t, T.morph));
    const wob = Math.sin(Math.PI * m); // the warp: none at either end, most in the middle
    const band = Math.max(3, Math.round(H / 140));
    const layer = (im, alpha, phase) => {
      if (!im || !im.complete || alpha <= 0.003) return;
      g.globalAlpha = alpha;
      if (wob < 0.01) { g.drawImage(im, x, y, dw, dh); return; }
      for (let yy = 0; yy < H; yy += band) {
        let off = wob * W * 0.03 * Math.sin(yy * 0.018 + t * 0.004 + phase) + wob * W * 0.012 * Math.sin(yy * 0.071 - t * 0.007);
        off = Math.max(W - dw - x, Math.min(-x, off)); // (never past the picture's edge)
        // (the source rows behind this band of the screen)
        const sy = ((yy - y) / dh) * ih, sh = (band / dh) * ih;
        g.drawImage(im, 0, sy, iw, sh, x + off, yy, dw, band);
      }
    };
    layer(imgs.day, 1, 0);
    layer(imgs.dusk, m, 2.1);
    g.globalAlpha = 1;
    // A darkening and a vignette as it turns.
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.35 + 0.25 * m})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (pinned != null) t0 = now - pinned;
    const t = now - t0;
    let b = 0;
    if (t < T.blackIn[0]) b = 0;
    else if (t < T.fadeUp[0]) b = sm(span(t, T.blackIn));
    else if (t < T.blackOut[0]) b = 1 - sm(span(t, T.fadeUp));
    else if (t < T.fadeHome[0]) b = sm(span(t, T.blackOut));
    else b = 1 - sm(span(t, T.fadeHome));
    if (black) black.style.opacity = String(b);
    if (canvas) canvas.style.opacity = t >= T.blackIn[1] && t < T.home ? "1" : "0";
    if (root) root.style.pointerEvents = t >= T.blackIn[0] ? "auto" : "none";
    says.forEach((el, i) => { const [a, z] = i ? T.say2 : T.say1; el.classList.toggle("on", t >= a && t < z); });
    if (t >= T.blackIn[1] && t < T.home) draw(now);
    stage = t < T.blackIn[1] ? "leaving" : t < T.home ? "store" : t < T.fadeHome[1] ? "home" : "done";
    if (!returned && t >= T.home) {
      returned = true;
      if (audio && audio.awayFromDen) audio.awayFromDen(false, 2);
      if (onReturn) onReturn();
    }
    if (t >= T.fadeHome[1] + 100) finish();
  }
  function finish() {
    cancelAnimationFrame(raf); raf = 0;
    if (root) { root.remove(); root = null; canvas = g = black = null; says = []; }
    stage = "done";
  }

  return {
    load,
    start() {
      if (!doc || stage !== "idle") return false;
      load();
      if (!doc.querySelector("style[data-den-trip]")) { const st = doc.createElement("style"); st.setAttribute("data-den-trip", ""); st.textContent = CSS; doc.head.appendChild(st); }
      root = doc.createElement("div"); root.className = "den-trip"; root.setAttribute("data-testid", "den-trip");
      root.style.pointerEvents = "none";
      canvas = doc.createElement("canvas"); canvas.style.opacity = "0"; g = canvas.getContext("2d");
      black = doc.createElement("div"); black.className = "black";
      root.appendChild(canvas); root.appendChild(black);
      LINES.forEach((txt, i) => { const el = doc.createElement("div"); el.className = "say" + (i ? " two" : ""); el.setAttribute("data-testid", `den-trip-say-${i + 1}`); el.setAttribute("role", "status"); el.textContent = txt; root.appendChild(el); says.push(el); });
      doc.body.appendChild(root);
      t0 = performance.now(); stage = "leaving";
      const o = out();
      if (o) {
        const ct = o.ctx.currentTime + 0.05, at = (ms) => ct + ms / 1000;
        if (!car("away", o, ct)) driveAway(o, ct);
        later(T.blackIn[0], () => audio && audio.awayFromDen && audio.awayFromDen(true, (T.blackIn[1] - T.blackIn[0]) / 1000));
        if (!car("arrive", o, at(T.arrive))) arrive(o, at(T.arrive));
        wind(o, at(T.arrive + 1500), (T.blackOut[1] - T.arrive - 1500) / 1000);
        drone(o, at(T.morph[0]), (T.blackOut[1] - T.morph[0]) / 1000);
      } else later(T.blackIn[0], () => audio && audio.awayFromDen && audio.awayFromDen(true));
      raf = requestAnimationFrame(frame);
      return true;
    },
    state: () => ({ stage, t: stage === "idle" ? 0 : performance.now() - t0, car: carReady("away") ? "recording" : null, arrival: carReady("arrive") ? "recording" : null }),
    // Test-only: hold it at ms in (starting it if need be), or null to go on.
    pin(ms) { if (stage === "idle") this.start(); pinned = ms; },
    dispose() {
      timers.forEach(clearTimeout); timers = [];
      nodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } });
      nodes = [];
      if (raf) cancelAnimationFrame(raf);
      if (root) { root.remove(); root = null; }
      Object.values(cars).forEach((c) => { if (c.el) { try { c.el.pause(); } catch (e) { /* fine */ } } });
      if (stage !== "idle" && stage !== "done" && audio && audio.awayFromDen) audio.awayFromDen(false, 0.3);
    },
  };
}
