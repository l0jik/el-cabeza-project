/* Parrish's sound: the sea round the pillar.

   Nature, until the user's own recording comes (MUSIC_URL): the sea's low
   swell, the surf breaking on the rocks and its foam hissing back, a
   breeze that comes and goes, gulls far off over the water, now and then
   a small bird. Each placed somewhere of its own, left or right, the far
   ones softer and duller.

   The pieces: the user's own recordings of instrumental stabs, cut into
   very small pieces, of which the user picked seventeen lone notes, ten
   short phrases of two or three stabs, and two longer hits
   (tools/parrish_stabs.py, one file beside the page,
   el-cabeza-parrish-stabs.mp3, fetched once). The notes, sorted by pitch,
   are the pieces' voice, and the deeper the note the bigger the piece
   (user): picked up and put down at its own pitch, silent as it moves,
   landing on the note for the face it lands on (the biggest, as often as
   not, on a deep pair of stabs), the two lowest muffled for a move that
   isn't allowed. The phrases of three: Begin Game, a game ended by hand,
   a capture (the deepest, with the bass). The brighter pairs: the rules
   opening and closing. The two longer hits are the two wins (user): a
   Cabeza reaching the far side, and the last Cabeza crushed. All of it
   in a long, soft hall (user: "think Enya"). Until the file's here (or if
   it can't be had) the wooden set's own knocks stand in (wood-sfx.js).

   The intro (user: "use this as intro music when Orinoco or Watermark
   are opened"): the user's opening of "Orinoco Flow" laid in a hall, its
   decay given 3 s to complete after the cut (user; INTRO_URL, beside the
   page; tools/parrish_bookends.py), once a visit. A browser lets a page
   sound only after a tap or a key, so it starts on the first one
   (whatever it's on), on the music channel; when a game begins it steps
   back under the game.

   The close (user: when Orinoco or Watermark are closed; "add reverb and
   extend the tail ... the decay completes even if already back in the
   theme switcher"): the user's end of "Orinoco Flow" laid in a long hall
   with about 7 s more of its ringing (OUTRO_URL; tools/parrish_bookends.py),
   played when the switcher opens over the page (it's a panel on this
   page, so the ringing carries on under it). The intro, if it's still
   going, gives way; the place's own sound steps back for it.

   The music: MUSIC_URL, a file beside the page, once the user's
   recording is here. With none, there's no music channel at all (no
   slider that does nothing); with one, it plays from Begin Game, looped,
   on its own channel.

   Every sound is made here, and all of it is kept low: it's a place to
   sit, not a soundtrack. */

import { createWoodSfx, landingSize } from "./wood-sfx.js";
import { REALITIES_OPEN_EVENT } from "./realities.js";

export const hasAudio = true;

// The user's recording, when it comes: e.g. "el-cabeza-parrish-music.mp3"
// (beside the page; build/build.js copies it there).
export const MUSIC_URL = null;
export const INTRO_URL = "el-cabeza-parrish-intro.mp3";
export const OUTRO_URL = "el-cabeza-parrish-outro.mp3";

// The slices of the stabs file: [start s, length s] (tools/parrish_stabs.py).
const STABS_URL = "el-cabeza-parrish-stabs.mp3";
const STABS = {
  s1n1: [0.1, 0.12], s1n2: [0.47, 0.12], s1n3: [0.84, 0.11], s1n4: [1.2, 0.11], s1n5: [1.56, 0.14], s1n6: [1.95, 0.12],
  s2n1: [2.32, 0.12], s2n2: [2.69, 0.12], s2n3: [3.06, 0.12], s2n4: [3.43, 0.12], s2n5: [3.8, 0.13],
  s3n3: [4.18, 0.12], s3n4: [4.55, 0.12], s3n5: [4.92, 0.12], s3n6: [5.29, 0.12],
  winEdge: [5.66, 0.42], winCapture: [6.33, 0.38],
  s5n6: [6.96, 0.2], s5n7: [7.41, 0.2],
  s5p9: [7.86, 0.44], s5p10: [8.55, 0.43], s5p11: [9.23, 0.51], s5p12: [9.99, 0.41], s5p13: [10.65, 0.72],
  s5p21: [11.62, 0.89], s5p22: [12.76, 0.74], s5p23: [13.75, 0.63],
};
// The seventeen notes, highest to lowest (as measured): A#5, D5 D5 D5
// C#5 C5, A4, E4 D#4 D4, C4 C4 C4, B3 B3, F3, D#3.
const NOTES = ["s5n7", "s1n4", "s3n4", "s1n1", "s1n3", "s2n3", "s5n6", "s2n2", "s1n6", "s3n5", "s3n6", "s3n3", "s1n2", "s2n4", "s2n1", "s1n5", "s2n5"];
// The biggest pieces land, as often as not, on two stabs rather than one
// (a weight that settles): the deeper pair the bigger (~D4, ~C4, ~D#3).
const PAIRS = [[6, "s5p9"], [8, "s5p13"], [10, "s5p12"]];
// Where a size falls among them: a single cube at the top, about twelve
// cubes' worth (a big piece on a broad face) at the bottom; then one of
// its neighbours now and then, so a piece doesn't always say the same.
function noteFor(size) {
  const t = Math.max(0, Math.min(1, Math.log(Math.max(1, size)) / Math.log(12)));
  const i = Math.round(t * (NOTES.length - 1)), r = Math.random();
  const j = r < 0.2 ? i - 1 : r > 0.8 ? i + 1 : i;
  return NOTES[Math.max(0, Math.min(NOTES.length - 1, j))];
}
// The hall: a long, soft tail (about 3.8 s to die away), its highs going
// first, after a breath of pre-delay; left and right drawn apart.
function makeHall(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 4.2), pre = Math.floor(sr * 0.028);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr, x = Math.random() * 2 - 1;
      lp += 0.12 * (x - lp);
      const dark = lp * 2.2 * Math.exp(-6.9 * t / 3.8), bright = x * 0.45 * Math.exp(-6.9 * t / 1.3);
      d[i] = (dark + bright) * Math.min(1, t / 0.006);
    }
    [0.011, 0.023, 0.037, 0.052, 0.071].forEach((e, k) => { const i = pre + Math.floor(sr * (e + ch * 0.0031 * (k + 1))); if (i < len) d[i] += (k % 2 ? -0.5 : 0.5) / (k + 1.5); });
  }
  return ir;
}

export function createAudio() {
  let ctx = null, master = null, vol = null, wood = null, noiseBuf = null, verb = null;
  const gates = {}, chLevel = { nature: 1, pieces: 1, music: 1 };
  let muted = false, natureOn = false, disposed = false, windingDown = false;
  let natureBus = null, gust = null;
  const timers = new Set();
  let music = null;
  // The stabs, once decoded: the buffer and each slice's real start.
  let intro = null, outro = null;
  let stabs = null, stabsAsked = false, hallIn = null, pendingCapture = null, wonAt = -1e9;

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
  }

  function ensureGraph() {
    if (ctx || disposed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
      vol = ctx.createGain(); vol.gain.value = 1;
      master.connect(comp).connect(vol).connect(ctx.destination);
      ["nature", "pieces", "music"].forEach((k) => { const g = ctx.createGain(); g.gain.value = chLevel[k]; g.connect(master); gates[k] = g; });
      natureBus = ctx.createGain(); natureBus.gain.value = 0; natureBus.connect(gates.nature);
      // The open air: a short, soft, bright tail (there are no walls).
      verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1);
      }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      verb.connect(wet).connect(gates.nature);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      wood = createWoodSfx(ctx, gates.pieces, { board: "solid" });
      // The pieces' hall.
      const hall = ctx.createConvolver(); hall.buffer = makeHall(ctx);
      hallIn = ctx.createGain(); hallIn.gain.value = 0.8;
      hallIn.connect(hall).connect(gates.pieces);
      loadStabs();
    } catch (e) {
      ctx = null;
    }
  }
  const now = () => ctx.currentTime + 0.01;
  function noise(t, dur, loop = false) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = loop;
    s.start(t, Math.random() * 2);
    if (!loop) s.stop(t + dur + 0.05);
    return s;
  }
  // A sound placed somewhere: left/right, and how far (farther: softer,
  // duller, more of the air).
  function place(node, pan, far) {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 12000 - far * 8000;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = ctx.createGain(); g.gain.value = 1 - far * 0.65;
    node.connect(lp).connect(g);
    let out = g;
    if (p) { p.pan.value = pan; g.connect(p); out = p; }
    out.connect(natureBus);
    const s = ctx.createGain(); s.gain.value = 0.3 + far * 0.6; out.connect(s).connect(verb);
  }

  /* ---- the breeze ---- */
  function startBreeze() {
    const t = now();
    [-0.6, 0.6].forEach((pan) => {
      const n = noise(t, 0, true);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420 + Math.random() * 120; bp.Q.value = 0.45;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
      const g = ctx.createGain(); g.gain.value = 0.03;
      n.connect(bp).connect(lp).connect(g);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = pan; g.connect(p).connect(natureBus); } else g.connect(natureBus);
      (gust = gust || []).push({ g, bp });
    });
    const swell = () => {
      if (!ctx) return;
      const t2 = now(), dur = 2.5 + Math.random() * 4;
      gust.forEach(({ g, bp }) => {
        const level = 0.018 + Math.random() * Math.random() * 0.07;
        g.gain.setTargetAtTime(level, t2, dur / 3);
        bp.frequency.setTargetAtTime(360 + level * 4200 + Math.random() * 80, t2, dur / 3);
      });
      later(dur * 1000, swell);
    };
    swell();
  }

  /* ---- leaves ---- */
  function leaves() {
    const t = now(), dur = 0.8 + Math.random() * 1.6;
    const n = noise(t, dur);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400 + Math.random() * 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.016, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(hp).connect(g);
    place(g, Math.random() * 1.6 - 0.8, 0.3 + Math.random() * 0.5);
    later(3500 + Math.random() * 8000, leaves);
  }

  /* ---- the sea: its low swell, and the surf breaking on the rocks ---- */
  function seaBed() {
    const t = now();
    const n = noise(t, 0, true);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 340;
    const g = ctx.createGain(); g.gain.value = 0.02;
    n.connect(lp).connect(g).connect(natureBus);
    const breathe = () => {
      if (!ctx) return;
      const t2 = now(), dur = 4 + Math.random() * 4;
      g.gain.setTargetAtTime(0.014 + Math.random() * 0.016, t2, dur / 3);
      later(dur * 1000, breathe);
    };
    breathe();
  }
  function surf() {
    const t = now(), rise = 1.2 + Math.random() * 0.8, tail = 2.8 + Math.random() * 1.6, pan = Math.random() * 1.2 - 0.6;
    const n = noise(t, rise + tail + 0.3);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(2200, t + rise); lp.frequency.exponentialRampToValueAtTime(700, t + rise + tail);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 + Math.random() * 0.02, t + rise); g.gain.exponentialRampToValueAtTime(0.0001, t + rise + tail);
    n.connect(lp).connect(g);
    place(g, pan, 0.35);
    // The foam's hiss as it runs back.
    const n2 = noise(t + rise * 0.8, tail + 0.3);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2800;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + rise * 0.8); g2.gain.linearRampToValueAtTime(0.014, t + rise + 0.15); g2.gain.exponentialRampToValueAtTime(0.0001, t + rise + tail);
    n2.connect(hp).connect(g2);
    place(g2, pan * 0.8, 0.3);
    later(5500 + Math.random() * 6000, surf);
  }

  /* ---- birds ---- */
  function note(t, f0, f1, dur, level, out, vib = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 28 + Math.random() * 20; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.02);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.012, dur * 0.25));
    g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.18);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.1);
  }
  const SONGS = [
    // A songbird's phrase: a few clear notes, rising and falling.
    (t, out) => {
      const n = 3 + Math.floor(Math.random() * 4), base = 2300 + Math.random() * 900;
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = base * (1 + (Math.random() - 0.4) * 0.5), d = 0.06 + Math.random() * 0.1;
        note(tt, f, f * (Math.random() < 0.5 ? 1.25 : 0.8), d, 0.05, out, 40);
        tt += d + 0.03 + Math.random() * 0.06;
      }
    },
    // Swallows: a quick twitter, high.
    (t, out) => {
      const n = 5 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) { const f = 4200 + Math.random() * 1800; note(t + i * (0.045 + Math.random() * 0.03), f, f * 1.15, 0.03, 0.03, out); }
    },
    // A gull, far off over the water: a few falling cries.
    (t, out) => {
      const n = 2 + Math.floor(Math.random() * 3);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = 1450 + Math.random() * 350, d = 0.26 + Math.random() * 0.12;
        note(tt, f, f * 0.62, d, 0.026, out);
        note(tt, f * 2, f * 1.24, d, 0.009, out);
        tt += d + 0.12 + Math.random() * 0.2;
      }
    },
  ];
  function bird() {
    const t = now();
    const kind = Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 0 : 1;
    const out = ctx.createGain(); out.gain.value = 1;
    place(out, Math.random() * 1.8 - 0.9, kind === 2 ? 0.45 + Math.random() * 0.3 : Math.random() * 0.7);
    SONGS[kind](t, out);
    // Sometimes the same bird again, a moment later.
    if (Math.random() < 0.35) later(500 + Math.random() * 900, () => { const o2 = ctx.createGain(); place(o2, Math.random() * 1.8 - 0.9, 0.4); SONGS[kind](now(), o2); });
    later(2600 + Math.random() * 7000, bird);
  }

  function startNature() {
    if (!ctx || natureOn) return;
    natureOn = true;
    natureBus.gain.setTargetAtTime(windingDown ? 0.5 : 1, now(), 1.2);
    startBreeze();
    later(800, leaves);
    seaBed();
    later(400, surf);
    later(1200, bird);
      }

  /* ---- the pieces: the user's stabs, cut small ---- */
  function loadStabs() {
    if (stabsAsked || !ctx) return;
    stabsAsked = true;
    fetch(STABS_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (disposed) return;
      // Each slice's first sound, found in the decoded file itself (so an
      // encoder's delay at the head can't put the cuts off their attacks).
      const d = buf.getChannelData(0), sr = buf.sampleRate, at = {};
      Object.entries(STABS).forEach(([k, [s, len]]) => {
        let i = Math.max(0, Math.floor((s - 0.05) * sr));
        const end = Math.min(d.length, Math.floor((s + 0.05) * sr));
        while (i < end && Math.abs(d[i]) < 1e-3) i++;
        at[k] = [Math.max(0, i / sr - 0.001), len];
      });
      stabs = { buf, at };
    }).catch(() => { /* the wooden knocks stay */ });
  }
  // One slice, at t: its speed (and so its pitch), level, place, how much
  // of its top is taken off, and (dur) only its first instants, faded out
  // over their last 15 ms. Into the room dry and, more, into the hall.
  function stab(name, t, { rate = 1, level = 0.2, pan = 0, tone = 0, dur = 0, wet = 1 } = {}) {
    const [off, full] = stabs.at[name];
    const len = dur > 0 ? Math.min(full, dur) : full;
    const s = ctx.createBufferSource(); s.buffer = stabs.buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = level;
    if (dur > 0) { const end = t + len / rate; g.gain.setValueAtTime(level, Math.max(t, end - 0.015)); g.gain.linearRampToValueAtTime(0, end); }
    let node = s;
    if (tone > 0) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = tone; node.connect(lp); node = lp; }
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g);
    g.connect(gates.pieces);
    if (hallIn && wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(hallIn); }
    s.start(t, off, len + 0.002);
  }
  const sfx = {
    // Picked up and put down at the piece's own pitch (its cubes).
    select(units) { stab(noteFor(units || 1), now(), { level: 0.17 }); },
    deselect(units) { stab(noteFor(units || 1), now(), { level: 0.12, rate: 0.94, tone: 2400 }); },
    blocked() { const t = now(); stab("s2n5", t, { level: 0.15, tone: 1200 }); stab("s1n5", t + 0.11, { level: 0.11, tone: 1000 }); },
    // On its way: nothing (user: the run of note-heads as it moved
    // stuttered); it's heard when it lands.
    rollStart() {},
    // Landing on the note for the face it lands on (and the piece), as
    // loud as the piece is heavy.
    landing(units, contact) {
      const m = Math.max(1, units || 1), size = landingSize(units, contact);
      if (typeof window !== "undefined" && Array.isArray(window.__EC_TEST_LANDINGS__)) window.__EC_TEST_LANDINGS__.push({ units, contact, size });
      const pair = PAIRS.filter(([at]) => size >= at).pop();
      if (pair && Math.random() < 0.5) { stab(pair[1], now(), { level: 0.15 + 0.03 * Math.log2(m) }); return; }
      stab(noteFor(size), now(), { level: 0.17 + 0.03 * Math.log2(m) });
    },
    // A capture: three stabs, the deepest of the phrases, with the bass in
    // them. Held back a moment: if the game is won by it, the win's own
    // hit plays instead.
    capture() {
      if (pendingCapture) clearTimeout(pendingCapture);
      pendingCapture = setTimeout(() => {
        pendingCapture = null;
        if (disposed || !stabs) return;
        stab("s5p23", now(), { level: 0.24 });
      }, 40);
    },
    // The two wins (user): the last Cabeza crushed (the game calls the
    // capture, then the win, at once), or a Cabeza at the far side.
    win() {
      wonAt = ctx.currentTime;
      if (pendingCapture) { clearTimeout(pendingCapture); pendingCapture = null; stab("winCapture", now(), { level: 0.32 }); return; }
      stab("winEdge", now(), { level: 0.32 });
    },
  };
  // The stabs when they're here, the wooden knocks till then.
  const piece = (k) => (...args) => (stabs ? sfx[k](...args) : wood[k](...args));

  /* ---- the intro: the opening of "Orinoco Flow", once a visit ---- */
  function playIntro() {
    if (intro || disposed) return;
    ensureGraph();
    if (!ctx) return;
    intro = { stopped: false };
    const it = intro;
    if (ctx.state === "suspended") ctx.resume();
    fetch(INTRO_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (it.stopped || disposed) return;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.6;
      s.connect(g).connect(gates.music);
      s.start(now());
      it.src = s; it.g = g;
      s.onended = () => { it.done = true; };
    }).catch(() => { /* no intro, then */ });
  }
  /* ---- the close: the end of "Orinoco Flow", ringing on ---- */
  let outroBuf = null;
  function playOutro() {
    if (disposed) return;
    ensureGraph();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    // The intro gives way; the place's sound steps back.
    if (intro && intro.g) intro.g.gain.setTargetAtTime(0, now(), 0.25);
    if (natureBus) natureBus.gain.setTargetAtTime(0.35, now(), 0.8);
    if (outro && outro.src) { try { outro.src.stop(); } catch (e) { /* ended */ } }
    const o = (outro = { stopped: false });
    const go = (buf) => {
      if (o.stopped || disposed) return;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.7;
      s.connect(g).connect(gates.music); s.start(now());
      o.src = s;
      s.onended = () => { o.done = true; if (!windingDown && natureBus && outro === o) natureBus.gain.setTargetAtTime(natureOn ? 1 : 0, now(), 1.5); };
    };
    if (outroBuf) { go(outroBuf); return; }
    fetch(OUTRO_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => { outroBuf = buf; go(buf); }).catch(() => { /* no close, then */ });
  }
  const onRealities = () => playOutro();
  if (typeof window !== "undefined" && OUTRO_URL) window.addEventListener(REALITIES_OPEN_EVENT, onRealities);

  // The first tap or key anywhere on the page starts it.
  const firstGesture = () => { offGesture(); playIntro(); };
  const offGesture = () => ["pointerdown", "keydown", "touchend"].forEach((e) => window.removeEventListener(e, firstGesture, true));
  if (typeof window !== "undefined" && INTRO_URL) ["pointerdown", "keydown", "touchend"].forEach((e) => window.addEventListener(e, firstGesture, true));

  /* ---- the music (the user's recording, when it's here) ---- */
  function startMusic() {
    if (!MUSIC_URL || !ctx || music) return;
    music = { stopped: false };
    const m = music;
    fetch(MUSIC_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
      if (m.stopped || disposed) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.setTargetAtTime(0.55, now(), 2);
      s.connect(g).connect(gates.music); s.start();
      m.src = s; m.g = g;
    }).catch(() => { /* no recording yet */ });
  }

  const cue = (fn) => (...args) => { ensureGraph(); if (wood) fn(...args); };

  const api = {
    ensureStarted() {
      ensureGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      startNature();
    },
    beginGameFadeIn() {
      windingDown = false; startNature(); startMusic();
      // The intro, if it's still playing, steps back under the game.
      if (intro && intro.g && !intro.done) intro.g.gain.setTargetAtTime(0.25, now(), 0.6);
      if (ctx && natureBus) natureBus.gain.setTargetAtTime(1, now(), 1.2);
    },
    setZoom() {},
    setMuted(m) { muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.08); },
    setVolume(v) { if (ctx) vol.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now(), 0.05); },
    setChannelMuted(ch, off) { this.setChannelLevel(ch, off ? 0 : 1); },
    setChannelLevel(ch, v) {
      if (!(ch in chLevel)) return;
      chLevel[ch] = Math.max(0, Math.min(1, v));
      if (ctx && gates[ch]) gates[ch].gain.setTargetAtTime(chLevel[ch], now(), 0.04);
    },
    setTension() {},
    // The end of a game: the place quietens a little.
    beginFadeOut() { windingDown = true; if (ctx && natureBus) natureBus.gain.setTargetAtTime(0.5, now(), 1.5); },
    resetWindDown() { windingDown = false; if (ctx && natureBus) natureBus.gain.setTargetAtTime(1, now(), 0.8); },
    playSelect: cue(piece("select")),
    playDeselect: cue(piece("deselect")),
    playBlocked: cue(piece("blocked")),
    playRollStart: cue(piece("rollStart")),
    playLanding: cue(piece("landing")),
    playCapture: cue(piece("capture")),
    // A win: the user's own hits once they're here (sfx.win), a harp's run
    // up through the scale's bright notes till then.
    playWin: cue(() => {
      if (stabs) { sfx.win(); return; }
      const t = now();
      [587.33, 739.99, 880, 987.77, 1174.66, 1479.98].forEach((f, i) => {
        const tt = t + i * 0.09;
        [[1, 0.05, 1.6], [2, 0.012, 0.6], [3, 0.006, 0.3]].forEach(([k, lv, d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = f * k;
          g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(lv, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
          o.connect(g).connect(gates.pieces); o.start(tt); o.stop(tt + d + 0.05);
        });
      });
    }),
    // Begin Game: three soft stabs. A game ended by hand: three deeper ones
    // (a won game has its own win, so nothing more then). The rules, opened
    // and closed: the brighter pairs, quietly; a tab, the top note, softer.
    playPowerOn: cue(() => { if (stabs) stab("s5p21", now(), { level: 0.16 }); }),
    playPowerOff: cue(() => { if (stabs && ctx.currentTime - wonAt > 2.5) stab("s5p22", now(), { level: 0.16 }); }),
    playRulesOpen: cue(() => { if (stabs) stab("s5p10", now(), { level: 0.09 }); }),
    playRulesClose: cue(() => { if (stabs) stab("s5p11", now(), { level: 0.08 }); }),
    playRulesTab: cue(() => { if (stabs) stab("s5n7", now(), { level: 0.05, tone: 3500 }); }),
    playMenu() {}, fadeOutMenu() {}, stopMenu() {},
    playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {},
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {}, playSingularityDismiss() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    playDockOpen() {}, playDockClose() {},
    // (Tests: what's running.)
    debugState() { return { ctx: !!ctx, ctxState: ctx ? ctx.state : null, natureOn, muted, levels: { ...chLevel }, music: !!MUSIC_URL, stabs: !!stabs, intro: intro ? (intro.done ? "ended" : intro.src ? "playing" : "loading") : null, outro: outro ? (outro.done ? "ended" : outro.src ? "playing" : "loading") : null }; },
    dispose() {
      disposed = true;
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      if (pendingCapture) clearTimeout(pendingCapture);
      if (music) music.stopped = true;
      offGesture();
      if (typeof window !== "undefined") window.removeEventListener(REALITIES_OPEN_EVENT, onRealities);
      if (outro) { outro.stopped = true; try { if (outro.src) outro.src.stop(); } catch (e) { /* ended */ } }
      if (intro) { intro.stopped = true; try { if (intro.src) intro.src.stop(); } catch (e) { /* ended */ } }
      if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
    },
  };
  // (Tests: the sound itself, to drive and to listen to.)
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__PARRISH_AUDIO__ = api;
  return api;
}
