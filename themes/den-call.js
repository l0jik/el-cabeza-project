/* Home with the special order (apps/unified.jsx: "Home again. Confused.",
   the new pieces already on the table): a thought, and then a telephone
   call. (User: a thought bubble, "finally I can play a game now in
   peace"; then, while they're playing, the phone rings, a 1975 ring, and
   it's Big Glutts on the line: indiscernible talking, with pauses, and the
   words in pop-up text.)

   - The thought: once the scene change has faded up, a cloud over the
     room, its trail of little puffs dropping toward you (the player, below
     the picture), for about five seconds.
   - The ring: once a game is under way (a while after it begins, and after
     the thought), the avocado desk set on the credenza (den-room.js) rings:
     the user's recording of a Stromberg-Carlson 1543 (its first three rings,
     lo-fi as recorded, one after another; a synthesized two-gong bell if
     it can't load), two seconds on, four off, from where the phone is
     (den-audio.js phoneOutput / setPhoneListener), its handset shaking on
     the cradle with each ring. A tap on the slip takes the camera over to
     the phone and pauses the record (a fast fade; den-audio holdForPhone);
     a tap on the phone itself answers it (user): the handset lifts and
     swings up toward you. Hung up, the record fades back in where it was. Left ringing, it gives up
     after eight rings and tries again a while later.
   - The call: the receiver lifted (a clunk), the line open (a faint hiss),
     and the caller in your ear, down a telephone line (400 Hz - 3 kHz,
     a little crunch): a voice made of formants, vowel after vowel with a
     consonant's hiss here and there, syllables to the words' own counts
     and pauses at their commas and stops, the pitch falling through each
     sentence (rising for a question). Nobody could make out a word; the
     slip says what's said, line by line, the caller's and yours. The
     record, if one's on, is paused through the call.
   - The end: the caller hangs up (a click in your ear), you put the
     receiver down (a clunk and the bells' little tinkle).

   Test hooks (window.__EC_TEST_HOOKS__): __DEN_CALL__() reads the state;
   __DEN_CALL_NOW__() skips the waits. */

const INK = "#2E2118", RED = "#A8321F", PAPER = "#EFE6CD";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Helvetica Neue', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";

const THOUGHT = "Finally… now I can play a game in peace.";
const THOUGHT_MS = 5400;
const RING_AFTER_BEGIN = 14000; // the game under way this long
const RING_AFTER_THOUGHT = 6000;
const RING_ON = 2.0, RING_CYCLE = 6.0, RINGS = 8, CALL_BACK = 45000;

// The call, line by line: who, and what.
const SCRIPT = [
  { who: "you", text: "Hello?" },
  { who: "them", text: "Oh, good news! This is Big Glutts. We actually found the pieces you were looking for." },
  { who: "you", text: "Oh… I already have them." },
  { who: "them", text: "Oh. You do?" },
  { who: "them", text: "…", pause: 2.0 },
  { who: "them", text: "Well… you can come get these for free, if you like. We're sorry for any inconvenience." },
  { who: "you", text: "Okay. I'll be there." },
  { who: "click", text: "Click." },
];

const CSS = `
.den-thought { position: fixed; left: 50%; bottom: calc(24% + env(safe-area-inset-bottom)); z-index: 1180; width: min(82vw, 360px);
  transform: translateX(-50%); pointer-events: none; opacity: 0; transition: opacity 0.6s ease, transform 0.6s ease; }
.den-thought.on { opacity: 1; transform: translateX(-50%) translateY(-6px); }
.den-thought svg { display: block; width: 100%; height: auto; filter: drop-shadow(0 6px 14px rgba(10,6,3,0.45)); }
.den-thought p { position: absolute; left: 16%; right: 16%; top: 13%; height: 50%; margin: 0; display: flex; align-items: center; justify-content: center;
  text-align: center; color: ${INK}; font: italic 600 clamp(14px, 4.3vw, 17px)/1.3 ${FRANKLIN}; text-wrap: balance; }
.den-call { position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 1190; width: min(92vw, 440px);
  transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; padding: 10px 14px 11px; background: ${PAPER}; color: ${INK};
  border: 1.5px solid ${INK}; box-shadow: 0 6px 18px rgba(10,6,3,0.45); font: 400 14px/1.45 ${COURIER}; animation: denCallIn 0.35s ease both; }
.den-call .who { font: 700 11px/1 ${FRANKLIN}; letter-spacing: 0.12em; text-transform: uppercase; color: ${RED}; }
.den-call .who.you { color: ${INK}; opacity: 0.7; }
.den-call .said { min-height: 1.45em; }
.den-call .said.stage { font-style: italic; opacity: 0.75; }
.den-call.ringing { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
.den-call.ringing .said { font: 700 13px/1.3 ${FRANKLIN}; letter-spacing: 0.06em; text-transform: uppercase; animation: denCallShake 0.1s linear infinite; }
.den-call.ringing.quiet .said { animation: none; }
.den-call.tap { cursor: pointer; }
.den-call.tap:hover { background: #F6EEDA; }
.den-call.tap:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
.den-call .hint { font: italic 400 12px/1.3 ${COURIER}; opacity: 0.7; }
.den-call button { all: unset; cursor: pointer; padding: 7px 14px; background: ${INK}; color: ${PAPER}; font: 700 11.5px/1 ${FRANKLIN};
  letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
.den-call button:hover, .den-call button:focus-visible { background: ${RED}; }
.den-call button:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
@keyframes denCallIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes denCallShake { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(1.2px); } }
/* After the call: "Free pieces?! Nice!... Thank you, Big Glutts!" on a
   1975 card (as the store's "There's a story here..."): chunky Caprasimo
   over the decade's stripes, popping up with a bounce, the second line a
   beat after the first; it takes no taps and goes after a while. */
.den-yay { position: fixed; left: 50%; top: 22%; z-index: 1195; transform: translateX(-50%); pointer-events: none; width: min(86vw, 400px); }
.den-yay .card { position: relative; padding: 18px 22px 20px; background: #F3E6C4; border: 3px solid #4A2A14; border-radius: 16px;
  box-shadow: 6px 7px 0 #4A2A14, 0 14px 30px rgba(20,10,4,0.45); text-align: center; color: #4A2A14; transform: rotate(-3deg);
  animation: denYayIn 0.75s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
.den-yay .stripes { display: flex; height: 14px; margin: -18px -22px 14px; border-radius: 13px 13px 0 0; overflow: hidden; }
.den-yay .stripes i { flex: 1; } .den-yay .stripes i:nth-child(1) { background: #6B3A1E; } .den-yay .stripes i:nth-child(2) { background: #B4451F; }
.den-yay .stripes i:nth-child(3) { background: #E07B22; } .den-yay .stripes i:nth-child(4) { background: #E9B23A; }
.den-yay .l1 { display: block; font: 400 clamp(26px, 8vw, 38px)/1.05 'Caprasimo', 'Cooper Black', Georgia, serif; color: #B4451F; text-shadow: 2px 2px 0 #E9B23A; }
.den-yay .l2 { display: block; margin-top: 10px; font: 400 clamp(19px, 5.6vw, 26px)/1.15 'Caprasimo', 'Cooper Black', Georgia, serif;
  animation: denYayLine 0.6s cubic-bezier(0.2, 1.5, 0.4, 1) 1.1s both; }
.den-yay.off { transition: opacity 0.7s ease, transform 0.7s ease; opacity: 0; transform: translateX(-50%) translateY(-10px); }
@keyframes denYayIn { from { opacity: 0; transform: rotate(-3deg) scale(0.5); } to { opacity: 1; transform: rotate(-3deg) scale(1); } }
@keyframes denYayLine { from { opacity: 0; transform: translateY(8px) scale(0.85); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .den-thought, .den-call, .den-call.ringing .said, .den-yay .card, .den-yay .l2 { transition: none; animation: none; } }
`;
const YAY_MS = 5600;

// The cloud: an ellipse ringed with puffs, outlined only on the outside
// (every shape stroked, then every shape filled over the strokes), and a
// trail of three puffs dropping toward the bottom of the screen.
function cloudSvg() {
  const shapes = [];
  const cx = 180, cy = 82, rx = 146, ry = 58, N = 15;
  shapes.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const r = 25 + 7 * Math.sin(i * 2.3) + 4 * Math.cos(i * 1.7);
    shapes.push(`<circle cx="${(cx + Math.cos(a) * rx * 0.93).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * 0.9).toFixed(1)}" r="${r.toFixed(1)}"/>`);
  }
  const trail = [[170, 172, 12], [160, 196, 7.5], [154, 214, 4.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`);
  const all = shapes.join("");
  return `<svg viewBox="0 0 360 224" aria-hidden="true">
    <g fill="none" stroke="${INK}" stroke-width="5">${all}</g>
    <g fill="#FBF6E8">${all}</g>
    <g fill="#FBF6E8" stroke="${INK}" stroke-width="3.5">${trail.join("")}</g>
  </svg>`;
}

// Vowels (F1, F2, F3 in Hz), a speaker's own.
const VOWELS = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410], [660, 1720, 2410], [520, 1190, 2390], [440, 1020, 2240], [390, 1990, 2550]];
const syllables = (w) => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g) || []).length);

export function createDenCall({ audio, awaitingBegin, onTrip = null, onGoToPhone = null, onPhoneDone = null }) {
  let stage = "cut"; // cut -> thought -> wait -> ringing -> call -> done
  let thoughtAt = 0, thoughtEnd = 0, playSince = 0, ringAt = 0, ringsDone = 0, ringStart = 0;
  let line = -1, lineEls = null, box = null, thoughtEl = null, styleEl = null;
  let out = null, ringNodes = [], callNodes = [], timers = [];
  let lastEar = 0, rushed = false, held = false;
  // The record paused for the phone (den-audio holdForPhone), and back after.
  const hold = (on) => { if (held === on) return; held = on; if (audio && audio.holdForPhone) audio.holdForPhone(on); };
  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const doc = typeof document !== "undefined" ? document : null;

  function style() {
    if (styleEl || !doc) return;
    styleEl = doc.createElement("style");
    styleEl.textContent = CSS;
    doc.head.appendChild(styleEl);
  }

  /* ---- the sound ---- */
  function output() {
    if (!out && audio && audio.phoneOutput) out = audio.phoneOutput();
    return out;
  }
  const track = (list, n) => { list.push(n); return n; };

  /* The bell itself: the user's recording of a Stromberg-Carlson 1543
     (assets/den/phone_ring.mp3: its first three rings, 6 s apart, as
     recorded, hiss and all; the talk at the end of the recording cut).
     Each ring plays one of the three in turn, so no two in a row are the
     same. Until it's loaded (or if it can't be), the synthesized bell
     below stands in. */
  const RING_URL = "el-cabeza-den-phone-ring.mp3", RING_SLOT = 6, RING_TAKES = 3, RING_LEVEL = 0.4;
  let ringBuf = null, ringLoading = false, takes = 0, ringEl = null, ringElGain = null, ringElStop = 0;
  function loadRing() {
    const o = output();
    if (ringBuf || ringEl || ringLoading || !o) return;
    ringLoading = true;
    // (A page opened from disk can't fetch: an <audio> element there,
    // sent through the same way, seeking to each ring's slot.)
    if (typeof location !== "undefined" && location.protocol === "file:") {
      if (typeof Audio === "undefined") return;
      const el = new Audio(RING_URL); el.preload = "auto";
      el.addEventListener("canplay", () => {
        if (ringEl) return;
        try { ringElGain = o.ctx.createGain(); ringElGain.gain.value = RING_LEVEL; o.ctx.createMediaElementSource(el).connect(ringElGain).connect(o.ring); ringEl = el; } catch (e) { /* the synthesized bell */ }
      }, { once: true });
      el.load();
      return;
    }
    if (typeof fetch === "undefined") return;
    fetch(RING_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => o.ctx.decodeAudioData(b)).then((buf) => { ringBuf = buf; }).catch(() => { /* the synthesized bell, then */ });
  }
  function ring(t) {
    const o = output();
    if (!o) return;
    if (ringBuf) {
      const src = o.ctx.createBufferSource(); src.buffer = ringBuf;
      const g = o.ctx.createGain(); g.gain.value = RING_LEVEL;
      src.connect(g).connect(o.ring);
      const k = takes++ % RING_TAKES;
      src.start(t, k * RING_SLOT, Math.min(RING_SLOT, ringBuf.duration - k * RING_SLOT));
      track(ringNodes, src); track(ringNodes, g);
      return;
    }
    if (ringEl) {
      const k = takes++ % RING_TAKES;
      try { ringElGain.gain.cancelScheduledValues(o.ctx.currentTime); ringElGain.gain.setValueAtTime(RING_LEVEL, o.ctx.currentTime); ringEl.currentTime = k * RING_SLOT; const pl = ringEl.play(); if (pl && pl.catch) pl.catch(() => {}); } catch (e) { /* fine */ }
      clearTimeout(ringElStop);
      ringElStop = setTimeout(() => { try { ringEl.pause(); } catch (e) { /* fine */ } }, RING_SLOT * 1000 - 60);
      return;
    }
    synthRing(t);
  }
  // A synthesized ring: both gongs, the clapper's twenty strikes a second. (Measured
  // near the phone at about -25 dB RMS: a ringer is meant to be heard
  // across the house; the caller in the ear about -22.)
  function synthRing(t) {
    const o = output();
    if (!o) return;
    const { ctx } = o;
    const bells = [[1070, 0], [1290, 0.025]];
    const click = ctx.createGain(); click.gain.value = 0;
    const ns = ctx.createBufferSource(); ns.buffer = o.noise; ns.loop = true;
    const nbp = ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = 2600; nbp.Q.value = 1.2;
    ns.connect(nbp).connect(click).connect(o.ring);
    ns.start(t); ns.stop(t + RING_ON + 0.1);
    track(ringNodes, ns);
    bells.forEach(([f, off]) => {
      const env = ctx.createGain(); env.gain.value = 0;
      env.connect(o.ring);
      [[1, 0.14], [2.32, 0.07], [4.25, 0.032], [6.63, 0.016]].forEach(([r, g], i) => {
        const osc = ctx.createOscillator(); osc.frequency.value = f * r * (1 + (i ? 0.002 * i : 0));
        const gg = ctx.createGain(); gg.gain.value = g;
        osc.connect(gg).connect(env);
        osc.start(t); osc.stop(t + RING_ON + 1.6);
        track(ringNodes, osc);
      });
      for (let k = 0; k < RING_ON * 20; k++) {
        const tk = t + k * 0.05 + off;
        env.gain.setTargetAtTime(1, tk, 0.0015);
        env.gain.setTargetAtTime(0.42, tk + 0.006, 0.028);
        if (!off) { click.gain.setValueAtTime(0.09, tk); click.gain.setTargetAtTime(0, tk, 0.003); }
      }
      env.gain.setTargetAtTime(0, t + RING_ON + 0.03, 0.32); // and it rings out
      track(ringNodes, env);
    });
  }
  function stopRinging() {
    const o = output();
    const now = o ? o.ctx.currentTime : 0;
    if (ringEl && ringElGain) { ringElGain.gain.setTargetAtTime(0, now, 0.05); clearTimeout(ringElStop); ringElStop = setTimeout(() => { try { ringEl.pause(); } catch (e) { /* fine */ } }, 300); }
    ringNodes.forEach((n) => {
      try {
        if (n.gain) { n.gain.cancelScheduledValues(now); n.gain.setTargetAtTime(0, now, 0.05); } else n.stop(now + 0.3);
      } catch (e) { /* already done */ }
    });
    ringNodes = [];
  }
  // A thud of the receiver (up or down), in the room; down, the bells
  // tinkle as it lands in the cradle.
  function clunk(t, down) {
    const o = output();
    if (!o) return;
    const { ctx } = o;
    const s = ctx.createBufferSource(); s.buffer = o.noise;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = down ? 700 : 520;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(down ? 0.32 : 0.22, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    s.connect(lp).connect(g).connect(o.ring); s.start(t); s.stop(t + 0.16);
    if (!down) return;
    [[1070, 0.018], [1290, 0.012]].forEach(([f, peak], i) => {
      const osc = ctx.createOscillator(); osc.frequency.value = f;
      const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t + 0.02 + i * 0.03); e.gain.exponentialRampToValueAtTime(peak, t + 0.025 + i * 0.03); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(e).connect(o.ring); osc.start(t + 0.02); osc.stop(t + 0.65);
    });
  }

  /* The line: everything the caller says (and the line's own hiss and
     clicks) goes through this, a telephone's band and a carbon
     microphone's crunch, into your ear. */
  let tel = null;
  function line_() {
    const o = output();
    if (!o) return null;
    if (tel) return tel;
    const { ctx } = o;
    const input = ctx.createGain(); input.gain.value = 1;
    const f = (type, fr, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; return b; };
    const sh = ctx.createWaveShaper();
    sh.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 1023) * 2 - 1) * 2.2) / Math.tanh(2.2));
    const outG = ctx.createGain(); outG.gain.value = 0.5;
    // (A lift at 1.8 kHz: a telephone's forward, nasal middle.)
    const mid = f("peaking", 1800, 1); mid.gain.value = 5;
    input.connect(f("highpass", 400, 0.7)).connect(f("highpass", 400, 0.7)).connect(mid).connect(sh)
      .connect(f("lowpass", 3000, 0.7)).connect(f("lowpass", 3000, 0.7)).connect(outG).connect(o.ear);
    const hiss = ctx.createBufferSource(); hiss.buffer = o.noise; hiss.loop = true;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hiss.connect(hg).connect(input); hiss.start();
    track(callNodes, hiss);
    tel = { input, hiss: hg, outG };
    return tel;
  }
  function lineClick(t, peak = 0.5) {
    const o = output(), L = line_();
    if (!o || !L) return;
    const s = o.ctx.createBufferSource(); s.buffer = o.noise;
    const g = o.ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    s.connect(g).connect(L.input); s.start(t); s.stop(t + 0.04);
  }

  /* The caller: a voice of formants, never words. Returns how long it
     speaks for (seconds). */
  function babble(text, t0) {
    const o = output(), L = line_();
    if (!o || !L) return 0;
    const { ctx } = o;
    const glottis = ctx.createOscillator(); glottis.type = "sawtooth";
    const jitter = ctx.createOscillator(); jitter.frequency.value = 5.5;
    const jg = ctx.createGain(); jg.gain.value = 4; jitter.connect(jg).connect(glottis.frequency);
    const amp = ctx.createGain(); amp.gain.value = 0;
    const forms = [[1, 9], [0.55, 12], [0.3, 14]].map(([g, q]) => {
      const b = ctx.createBiquadFilter(); b.type = "bandpass"; b.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = g * 7;
      glottis.connect(b).connect(gg).connect(amp);
      return b;
    });
    const hiss = ctx.createBufferSource(); hiss.buffer = o.noise; hiss.loop = true;
    const cbp = ctx.createBiquadFilter(); cbp.type = "bandpass"; cbp.frequency.value = 3200; cbp.Q.value = 1.5;
    const cons = ctx.createGain(); cons.gain.value = 0;
    hiss.connect(cbp).connect(cons).connect(L.input);
    amp.connect(L.input);
    const words = text.replace(/…/g, "… ").split(/\s+/).filter(Boolean);
    const sentences = [];
    let cur = [];
    words.forEach((w) => { cur.push(w); if (/[.!?]$/.test(w)) { sentences.push(cur); cur = []; } });
    if (cur.length) sentences.push(cur);
    const F0 = 205;
    let t = t0;
    glottis.frequency.setValueAtTime(F0, t0);
    sentences.forEach((sw) => {
      const total = sw.reduce((n, w) => n + syllables(w), 0);
      const question = /\?$/.test(sw[sw.length - 1]);
      let k = 0;
      sw.forEach((w, wi) => {
        const n = syllables(w), stress = Math.floor(Math.random() * n);
        for (let i = 0; i < n; i++, k++) {
          const p = k / Math.max(1, total - 1);
          const accent = i === stress && w.length > 3 ? 1.12 : 1;
          let f0 = F0 * (1.12 - 0.26 * p) * accent;
          if (question && k === total - 1) f0 = F0 * 1.35;
          const dur = (i === stress ? 0.17 : 0.12) + Math.random() * 0.06;
          const v = VOWELS[Math.floor(Math.random() * VOWELS.length)];
          if (Math.random() < 0.55) { // a consonant ahead of the vowel
            cons.gain.setTargetAtTime(0.1 + Math.random() * 0.08, t, 0.006);
            cons.gain.setTargetAtTime(0, t + 0.035 + Math.random() * 0.03, 0.01);
            t += 0.045;
          }
          glottis.frequency.setTargetAtTime(f0, t, 0.03);
          if (question && k === total - 1) glottis.frequency.setTargetAtTime(F0 * 1.55, t + 0.05, 0.08);
          forms.forEach((b, fi) => b.frequency.setTargetAtTime(v[fi] * (1 + (Math.random() - 0.5) * 0.08), t, 0.025));
          amp.gain.setTargetAtTime(0.09 * (i === stress ? 1 : 0.75), t, 0.018);
          amp.gain.setTargetAtTime(0.0, t + dur * 0.85, 0.028);
          t += dur;
        }
        const last = w[w.length - 1];
        t += /[,]/.test(last) ? 0.24 : /…/.test(w) ? 0.42 : /[.!?]/.test(last) && wi === sw.length - 1 ? 0 : 0.035 + Math.random() * 0.04;
      });
      t += 0.42;
    });
    glottis.start(t0); jitter.start(t0); hiss.start(t0);
    [glottis, jitter, hiss].forEach((s) => s.stop(t + 0.2));
    return t - t0;
  }

  /* ---- the slip on screen ---- */
  function showBox(kind) {
    style();
    if (!doc) return;
    if (!box) {
      box = doc.createElement("div");
      box.setAttribute("data-testid", "den-call");
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      doc.body.appendChild(box);
    }
    box.className = "den-call" + (kind === "ringing" ? " ringing" : "");
    box.setAttribute("data-stage", kind);
    if (kind === "ringing") {
      box.innerHTML = "";
      // A tap on the slip takes you over to the phone, on the credenza
      // (den-fx.js), and the record pauses; a tap on the phone answers it.
      const said = doc.createElement("span"); said.className = "said"; said.textContent = "The phone is ringing";
      const hint = doc.createElement("span"); hint.className = "hint"; hint.textContent = "tap to go to it";
      box.append(said, hint);
      box.classList.add("tap");
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");
      box.setAttribute("aria-label", "The phone is ringing. Go to it");
      box.onclick = () => goToPhone();
      box.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToPhone(); } };
    } else {
      box.innerHTML = "";
      box.classList.remove("tap");
      box.setAttribute("role", "status"); box.removeAttribute("tabindex"); box.removeAttribute("aria-label");
      box.onclick = null; box.onkeydown = null;
      const who = doc.createElement("span"); who.className = "who";
      const said = doc.createElement("span"); said.className = "said"; said.setAttribute("data-testid", "den-call-line");
      box.append(who, said);
      lineEls = { who, said };
    }
  }
  function say(i) {
    const s = SCRIPT[i];
    line = i;
    if (!lineEls) return;
    lineEls.who.textContent = s.who === "you" ? "You" : s.who === "click" ? "" : "Big Glutts, on the line";
    lineEls.who.className = "who" + (s.who === "you" ? " you" : "");
    lineEls.said.textContent = s.text;
    lineEls.said.className = "said" + (s.who === "click" ? " stage" : "");
    if (box) box.setAttribute("data-line", String(i));
  }
  function hideBox(ms = 0) {
    later(ms, () => { if (box) { box.remove(); box = null; lineEls = null; } });
  }

  /* ---- the call ---- */
  function goToPhone() {
    if (stage !== "ringing") return;
    hold(true);
    if (box) { const h = box.querySelector(".hint"); if (h) h.textContent = "tap the phone to pick it up"; }
    if (onGoToPhone) onGoToPhone();
  }
  function startRinging(now) {
    stage = "ringing"; ringStart = now; ringsDone = 0;
    showBox("ringing");
  }
  // "Free pieces?! Nice!... Thank you, Big Glutts!" (user).
  let yayEl = null;
  function yay() {
    if (!doc || yayEl) return;
    style();
    if (!doc.querySelector("link[data-caprasimo]")) {
      const l = doc.createElement("link"); l.rel = "stylesheet"; l.setAttribute("data-caprasimo", "");
      l.href = "https://fonts.googleapis.com/css2?family=Caprasimo&display=swap";
      doc.head.appendChild(l);
    }
    yayEl = doc.createElement("div");
    yayEl.className = "den-yay";
    yayEl.setAttribute("data-testid", "den-yay");
    yayEl.setAttribute("role", "status");
    yayEl.innerHTML = '<div class="card"><div class="stripes" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'
      + '<span class="l1">Free pieces?! Nice!\u2026</span><span class="l2">Thank you, Big Glutts!</span></div>';
    doc.body.appendChild(yayEl);
    const el = yayEl;
    // (It fades as the car starts up: the trip back to the store, den-trip.js.)
    later(YAY_MS, () => { el.classList.add("off"); if (onTrip) onTrip(); later(800, () => { el.remove(); if (yayEl === el) yayEl = null; }); });
  }
  function answer() {
    if (stage !== "ringing") return false;
    stopRinging();
    stage = "call";
    hs = { mode: "lift", t0: performance.now() };
    const o = output();
    if (!o) { stage = "done"; hideBox(); if (onPhoneDone) onPhoneDone(); return true; }
    hold(true);
    const { ctx } = o;
    let t = ctx.currentTime + 0.05;
    clunk(t, false);
    const L = line_();
    if (L) { L.hiss.gain.setTargetAtTime(0.0035, t + 0.2, 0.05); }
    lineClick(t + 0.25, 0.3);
    showBox("call");
    const base = performance.now() - ctx.currentTime * 1000;
    const at = (audioT, fn) => later(Math.max(0, (audioT * 1000 + base) - performance.now()), fn);
    t += 0.7;
    SCRIPT.forEach((s, i) => {
      const start = t;
      let dur;
      if (s.who === "them" && s.pause) dur = s.pause;
      else if (s.who === "them") dur = babble(s.text, start) + 0.35;
      else if (s.who === "you") dur = 0.55 + s.text.split(/\s+/).length * 0.32;
      else { lineClick(start, 0.8); if (L) L.hiss.gain.setTargetAtTime(0, start + 0.02, 0.02); dur = 1.6; }
      at(start, () => say(i));
      t = start + dur + 0.3;
    });
    // The receiver back on the cradle.
    const down = t - 0.2;
    at(down - 0.75, () => { hs = { mode: "down", t0: performance.now() }; });
    at(down, () => { clunk(output().ctx.currentTime + 0.02, true); hold(false); });
    at(down + 0.9, () => { stage = "done"; hideBox(); if (onPhoneDone) onPhoneDone(); });
    at(down + 1.5, () => yay());
    return true;
  }

  /* ---- the handset (den-room.js phone.handset) ----
     Ringing, it shakes on the cradle with each ring (the bell's two
     seconds on, as the recording's rings sound: the same 6 s cycle);
     answered, it lifts and swings up toward you, as if to your ear and
     mouth, and stays there (low and to the right, following the camera)
     through the call; at the end it goes back down onto the cradle as
     the clunk sounds. */
  let hs = { mode: "rest", t0: 0 };
  const hsV = { a: null, b: null, c: null, q: null, q2: null, e: null };
  function earPose(hand, cam, outPos, outQuat) {
    const { Vector3, Quaternion, Euler } = hsV.ctor;
    const parent = hand.parent;
    parent.updateMatrixWorld();
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    outPos.copy(cam.position).addScaledVector(fwd, 8.5).addScaledVector(up, -3.3).addScaledVector(right, 3.1);
    parent.worldToLocal(outPos);
    // Upright beside the face, the mouthpiece low, turned a little in.
    const wq = cam.quaternion.clone().multiply(new Quaternion().setFromEuler(new Euler(-1.25, 0.5, 0.35)));
    const pq = new Quaternion(); parent.getWorldQuaternion(pq);
    outQuat.copy(pq.invert().multiply(wq));
  }
  /* The handset's own avocado (its material's colour, kept the first
     time), brightened by k as it comes up out of the credenza's shade.
     (It was set to white x k, which lost the green: it showed cream, user.) */
  function tint(hand, k) {
    const c = hand.material && hand.material.color;
    if (!c) return;
    if (!hand.userData.baseColor) hand.userData.baseColor = c.clone();
    c.copy(hand.userData.baseColor).multiplyScalar(k);
  }
  let lastHand = null;

  function animateHandset(now, t, den) {
    const hand = den && den.phone && den.phone.handset;
    if (!hand || !t || !t.camera) return;
    lastHand = hand;
    if (!hsV.ctor) { const V = hand.position.constructor, Q = hand.quaternion.constructor; hsV.ctor = { Vector3: V, Quaternion: Q, Euler: hand.rotation.constructor }; hsV.a = new V(); hsV.q = new Q(); }
    const rest = hand.userData.rest;
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    if (hs.mode === "rest") {
      if (stage === "ringing") {
        const phase = (now - ringStart) % (RING_CYCLE * 1000);
        if (ringsDone > 0 && phase > 80 && phase < RING_ON * 1000 + 250) {
          // The bell's clapper rattling it: a fast, small shiver and hop.
          hand.position.copy(rest.position);
          hand.position.x += (Math.random() - 0.5) * 0.07; hand.position.z += (Math.random() - 0.5) * 0.09;
          hand.position.y += Math.abs(Math.sin(now * 0.125)) * 0.07;
          hand.quaternion.copy(rest.quaternion);
          hand.rotateX((Math.random() - 0.5) * 0.07); hand.rotateZ((Math.random() - 0.5) * 0.05);
          return;
        }
      }
      hand.position.copy(rest.position); hand.quaternion.copy(rest.quaternion);
      tint(hand, 1);
      return;
    }
    earPose(hand, t.camera, hsV.a, hsV.q);
    const light = (e) => tint(hand, 1 + 0.75 * e);
    if (hs.mode === "held") { hand.position.lerp(hsV.a, 0.25); hand.quaternion.slerp(hsV.q, 0.25); light(1); return; }
    const dur = hs.mode === "lift" ? 950 : 750;
    const k = Math.min(1, (now - hs.t0) / dur), e = ease(hs.mode === "lift" ? k : 1 - k);
    hand.position.copy(rest.position).lerp(hsV.a, e);
    hand.position.y += Math.sin(Math.PI * e) * 1.6; // (up off the cradle first)
    hand.quaternion.copy(rest.quaternion).slerp(hsV.q, e);
    light(e);
    if (k >= 1) hs = { mode: hs.mode === "lift" ? "held" : "rest", t0: now };
  }

  function tick(now, t, den) {
    animateHandset(now, t, den);
    if (stage === "done") return;
    // (Hurried along by the test hook.)
    const R = rushed ? 0.02 : 1;
    if (stage === "cut") {
      if (doc && doc.querySelector("[data-testid='story-cut']")) return;
      stage = "thought"; thoughtAt = now + 1200 * R; thoughtEnd = thoughtAt + THOUGHT_MS * (rushed ? 0.1 : 1);
    }
    if (stage === "thought") {
      if (now >= thoughtAt && !thoughtEl && doc && now < thoughtEnd) {
        style();
        thoughtEl = doc.createElement("div");
        thoughtEl.className = "den-thought";
        thoughtEl.setAttribute("data-testid", "den-thought");
        thoughtEl.setAttribute("role", "status");
        thoughtEl.innerHTML = cloudSvg();
        const p = doc.createElement("p"); p.textContent = THOUGHT; thoughtEl.appendChild(p);
        doc.body.appendChild(thoughtEl);
        requestAnimationFrame(() => requestAnimationFrame(() => thoughtEl && thoughtEl.classList.add("on")));
      }
      if (now >= thoughtEnd) {
        if (thoughtEl) { const el = thoughtEl; thoughtEl = null; el.classList.remove("on"); setTimeout(() => el.remove(), 700); }
        stage = "wait";
      }
      return;
    }
    if (stage === "wait") {
      loadRing(); // (the bell's recording, ahead of its moment)
      const playing = !awaitingBegin();
      if (!playing) { playSince = 0; return; }
      if (!playSince) playSince = now;
      if (!ringAt) ringAt = Math.max(playSince + RING_AFTER_BEGIN * R, thoughtEnd + RING_AFTER_THOUGHT * R);
      if (now >= ringAt) startRinging(now);
      return;
    }
    if (stage === "ringing") {
      const o = output();
      if (!o) return;
      // Each ring on the audio clock, scheduled as its moment comes round.
      const due = Math.floor((now - ringStart) / (RING_CYCLE * 1000)) + 1;
      while (ringsDone < Math.min(due, RINGS)) {
        ring(o.ctx.currentTime + 0.03);
        ringsDone++;
        if (box) box.classList.remove("quiet");
        later(RING_ON * 1000, () => { if (box && stage === "ringing") box.classList.add("quiet"); });
      }
      if (now - ringStart > RINGS * RING_CYCLE * 1000) {
        // Nobody's home: it tries again later.
        stopRinging(); hideBox();
        stage = "wait"; ringAt = now + CALL_BACK;
        hold(false);
        if (onPhoneDone) onPhoneDone();
      }
    }
    // The bell heard from where the camera is (every few frames).
    if (stage === "ringing" && den && den.phone && den.phone.point && t && t.camera && t.boardGroup && audio && audio.setPhoneListener && now - lastEar > 120) {
      lastEar = now;
      const p = den.phone.point.clone();
      den.group.localToWorld(p);
      const c = p.clone().applyMatrix4(t.camera.matrixWorldInverse);
      audio.setPhoneListener(p.distanceTo(t.camera.position), c.x / Math.max(1, Math.hypot(c.x, c.z)));
    }
  }

  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
    window.__DEN_CALL__ = () => ({ stage, rings: ringsDone, line, text: line >= 0 ? SCRIPT[line].text : null, thought: !!(doc && doc.querySelector("[data-testid='den-thought']")) });
    window.__DEN_CALL_NOW__ = () => { rushed = true; if (stage === "wait") ringAt = 1; };
    // (A tap on the phone, for the tests: the room's own tap goes through
    // den-fx.js pickScene/sceneTap to answer() too.)
    window.__DEN_CALL_PICKUP__ = () => answer();
    window.__DEN_CALL_HELD__ = () => held;
    window.__DEN_CALL_HANDSET__ = () => hs.mode;
    window.__DEN_CALL_HANDSET_COLOR__ = () => (lastHand && lastHand.material && lastHand.material.color ? lastHand.material.color.getHexString() : null);
  }

  return {
    tick,
    ringing: () => stage === "ringing",
    answer,
    dispose() {
      timers.forEach(clearTimeout); timers = [];
      if (yayEl) { yayEl.remove(); yayEl = null; }
      clearTimeout(ringElStop);
      if (ringEl) { try { ringEl.pause(); ringEl.removeAttribute("src"); } catch (e) { /* fine */ } }
      stopRinging();
      callNodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } });
      if (tel) { try { tel.outG.disconnect(); } catch (e) { /* fine */ } }
      hold(false);
      if (box) box.remove();
      if (thoughtEl) thoughtEl.remove();
      if (styleEl) styleEl.remove();
      if (typeof window !== "undefined") { delete window.__DEN_CALL__; delete window.__DEN_CALL_NOW__; delete window.__DEN_CALL_PICKUP__; delete window.__DEN_CALL_HELD__; delete window.__DEN_CALL_HANDSET__; delete window.__DEN_CALL_HANDSET_COLOR__; }
    },
  };
}
