/* The end of the story (user): out of the hall's eruption, into the void.
   A person, seen from behind, is pulled out chest first, arms and legs
   trailing, into the dark: the ultimate reality, where there is nothing
   else (user: no stars anywhere, even looking round): only the black
   sphere, its plasma ring and halo pulsing blue. They slow, and float, and
   the words come (REVELATION, the user's own). Then they drift into the
   sphere and are one with it: a swell, the camera going in on it,
   crescendoing, to black; then the other realities (realities.js): the
   story's over, and every other version of the game is there to go to,
   or stay in the den.

   Its own canvas and renderer over everything; while it covers the
   screen the den underneath stops drawing (covering(), den-fx.js's
   render hook: drawing both had been halving the frame rate on a
   phone). The camera's its own: it can't be moved (user). The picture's
   resolution steps down by itself if frames run slow, so it stays smooth.
   Arriving, the body's spaghettified: drawn out toward the sphere, thin,
   wavering, a noodle of a person (the vertex shader's tidal stretch),
   then let go into a body again. Not a rag doll (user: this person is in
   awe, not lifeless): pulled, limbs trailing, then slowly, gracefully
   composing themselves: arms opening, palms out, the head lifting to the
   light; breathing, a hand reaching a little now and then; at the end,
   arms wide, taken in. A faint aura breathes round them. The
   figure is built here: a lean, faceless body, near black, its edges lit
   by the light ahead (a rim shader). The sound: the den's own sounds step
   out (awayFromDen) and a chord comes in (the Monks' Hum's kind of voice,
   low, hopeful but forbidding, in a vast reverb), moving a voice at a
   time, so slowly that five seconds can pass without a change: a melody
   played over eternity; it swells as they go in.

   createEnding({ audio, onFinish, onPick, onStay }) -> { start(),
   state(), skip(ms), dispose() }. den-fx.js starts it from den-hall.js. */

import * as THREE from "three";
import { createRealitiesMenu } from "./realities.js";

// The user's words, as written (*x* in italics, **x** in bold).
export const REVELATION = [
  "....my...... god......!",
  "I...... understand now!",
  "I understand.......... *everything* now!",
  "The meaning of life, the universe..... everything!\u2026",
  "\u2026it's **not** 42!  It never was!!",
  "It's El Cabeza........",
  "....It was.....*always*...... El Cabeza.",
];
const md = (line) => line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");

// The timeline (ms from the white).
const T = {
  unveil: [0, 1400],      // the white fading off the void
  pull: [0, 5200],        // yanked away, fast, then slowing
  words: 8000,            // the first line
  wordEach: 4700,         // each line's turn (in, hold, out); the last holds longer
  lastHold: 6200,
};
const WORDS_END = T.words + (REVELATION.length - 1) * T.wordEach + T.lastHold;
const MERGE = [WORDS_END + 400, WORDS_END + 9800];   // drifting into the sphere
const ZOOM = [MERGE[1] - 3200, MERGE[1] + 2600];      // in on it, crescendoing
const BLACK = [ZOOM[1] - 700, ZOOM[1] + 200];         // to black
const MENU_AT = BLACK[1] + 1600;

const CSS = `
.den-ending { position: fixed; inset: 0; z-index: 1500; background: #000; overflow: hidden; touch-action: none; cursor: default; }
.den-ending canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.den-ending .veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #eef4ff 55%, #dbe6ff 100%); pointer-events: none; }
.den-ending .dark { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }
.den-ending .word { position: absolute; left: 50%; bottom: 16%; width: min(90vw, 780px); transform: translateX(-50%); text-align: center; pointer-events: none;
  color: #e9f0ff; font: 300 clamp(22px, 4.6vw, 38px)/1.3 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.04em; text-wrap: balance;
  text-shadow: 0 0 18px rgba(110,160,255,0.7), 0 2px 10px rgba(0,0,0,0.85); opacity: 0; transition: opacity 1.3s ease; }
.den-ending .word em { font-style: italic; font-weight: 400; }
.den-ending .word strong { font-weight: 700; }
.den-ending .word.on { opacity: 1; }
.den-ending.off { transition: opacity 1.2s ease; opacity: 0; }
`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/* ---- the figure ---- */
// (The tidal stretch: along the way to the sphere (uDir) from the body's
// middle (uCenter), drawn out; across it, squeezed; a slow waver.)
const RIM_VERT = `uniform vec3 uCenter, uDir; uniform float uStretch, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 rel = wp.xyz - uCenter;
  float al = dot(rel, uDir);
  vec3 perp = rel - al * uDir;
  float st = uStretch;
  vec3 side = normalize(cross(uDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
  vec3 up = normalize(cross(side, uDir));
  float wav = sin(al * 0.09 + uTime * 2.1) * st * 2.2;
  // (Ahead of the camera, all of it: drawn out mostly toward the sphere.)
  float k = al > 0.0 ? 1.0 + 3.6 * st : 1.0 + 1.3 * st;
  vec3 w = uCenter + uDir * (al * k + 10.0 * st) + perp / (1.0 + 1.6 * st) + side * wav + up * wav * 0.4;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vW = w;
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
/* Black like the singularity, where it's solid (uSolid): the rest of the
   body falls away (discarded) to the wireframe under it, in drifting
   patches of noise, and a thin bright seam where the black meets it;
   more of it solid as time goes on, till it's all black (user). */
const NOISE3 = `float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`;
const RIM_FRAG = `uniform vec3 uLight; uniform float uGlow, uSolid, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW; ${NOISE3}
void main(){
  float d = 0.65 * n3(vW * 0.32 + vec3(0.0, uTime * 0.35, uTime * 0.2)) + 0.35 * n3(vW * 0.9 - vec3(uTime * 0.5));
  if (d > uSolid) discard;
  vec3 n = normalize(vN); float rim = pow(1.0 - abs(dot(n, vV)), 2.4);
  float toward = 0.35 + 0.65 * max(0.0, dot(n, uLight));
  vec3 c = vec3(0.004, 0.004, 0.008) + (mix(vec3(0.45, 0.45, 1.0), vec3(0.45, 0.9, 1.0), rim * rim) * rim * toward * 1.7 * uGlow);
  float seam = 1.0 - smoothstep(0.0, 0.035, uSolid - d);
  c += vec3(0.4, 0.75, 1.0) * seam * 0.7 * step(uSolid, 0.995);
  gl_FragColor = vec4(c, 1.0); }`;
// The wireframe under it: lines of light, flickering a little.
const WIRE_FRAG = `uniform float uWire, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ float f = 0.75 + 0.25 * sin(uTime * 9.0 + vW.y * 0.7);
  gl_FragColor = vec4(vec3(0.25, 0.6, 1.0) * uWire * f * 0.32, 1.0); }`;
// The plasma coming off them: soft motes of the singularity's own light.
const WISP_VERT = `attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha; gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const WISP_FRAG = `varying float vA;
void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); float a = smoothstep(0.5, 0.0, r); a = a * a * a;
  gl_FragColor = vec4(mix(vec3(0.25, 0.5, 1.0), vec3(0.85, 0.95, 1.0), a) * a * vA, 1.0); }`;

function buildFigure(mat) {
  const fig = new THREE.Group();
  const geos = [];
  const meshes = [];
  const mesh = (geo, parent = fig) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); parent.add(m); meshes.push(m); return m; };
  // The torso: chest, ribs, waist; flattened front to back.
  const torso = new THREE.LatheGeometry([[0.01, 0], [1.9, 0.2], [2.15, 1.6], [2.3, 3.6], [2.75, 5.6], [2.6, 7.0], [1.6, 7.9], [0.6, 8.2], [0.01, 8.25]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
  torso.scale(1, 1, 0.6);
  mesh(torso);
  const hips = new THREE.SphereGeometry(1, 20, 14); hips.scale(2.25, 1.55, 1.35); hips.translate(0, 0.1, 0); mesh(hips);
  const neck = new THREE.CylinderGeometry(0.62, 0.72, 1.4, 14); neck.translate(0, 8.75, 0); mesh(neck);
  const headG = new THREE.Group(); headG.position.set(0, 9.4, 0); fig.add(headG);
  const head = new THREE.SphereGeometry(1, 22, 18); head.scale(1.35, 1.6, 1.45); head.translate(0, 1.3, 0.05); mesh(head, headG);
  // A limb: two segments from a joint, along -y, with round joints.
  const limb = (parent, at, len1, len2, r0, r1, r2, bend, endGeo) => {
    const j = new THREE.Group(); j.position.copy(at); parent.add(j);
    const a = new THREE.CylinderGeometry(r0, r1, len1, 14); a.translate(0, -len1 / 2, 0); mesh(a, j);
    const ball = new THREE.SphereGeometry(r0, 14, 10); mesh(ball, j);
    const k = new THREE.Group(); k.position.set(0, -len1, 0); k.rotation.x = bend; j.add(k);
    const kb = new THREE.SphereGeometry(r1, 14, 10); mesh(kb, k);
    const b = new THREE.CylinderGeometry(r1, r2, len2, 14); b.translate(0, -len2 / 2, 0); mesh(b, k);
    if (endGeo) { endGeo.translate(0, -len2, 0); mesh(endGeo, k); }
    return { j, k };
  };
  const hand = () => { const g = new THREE.SphereGeometry(1, 12, 10); g.scale(0.42, 0.75, 0.22); g.translate(0, -0.55, 0); return g; };
  const foot = () => { const g = new THREE.SphereGeometry(1, 12, 10); g.scale(0.5, 0.36, 1.25); g.translate(0, -0.15, 0.55); return g; };
  const arms = [-1, 1].map((s) => limb(fig, new THREE.Vector3(s * 2.55, 7.1, 0), 3.9, 3.6, 0.62, 0.5, 0.4, -0.5, hand()));
  const legs = [-1, 1].map((s) => limb(fig, new THREE.Vector3(s * 1.15, -0.4, 0), 5.6, 5.3, 0.95, 0.68, 0.5, 0.35, foot()));
  return { fig, geos, arms, legs, headG, meshes };
}
/* The body's pose: `d` is where each limb points, in the body's own frame
   (its front is +z; turned to face the sphere, trailing is -z). Three
   held shapes, blended: pulled (limbs trailing back), in awe (arms open
   to the sides and a little forward, palms out, legs loose together, the
   head lifted to the light) and taken (arms wide, the head back, given
   to it). `awe` and `taken` 0..1; `t` in seconds, for the slow life in
   it: a breath (about 7 s), one hand reaching a little toward the light
   now and then, never twitching. */
const Y_DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function aimLimb(j, pulled, awe, taken, a, m) {
  _a.copy(pulled).lerp(awe, a).lerp(taken, m).normalize();
  j.quaternion.setFromUnitVectors(Y_DOWN, _a);
}
function pose(f, t, a, m) {
  const breath = Math.sin((t * Math.PI * 2) / 7.2);
  f.arms.forEach(({ j, k }, i) => {
    const s = i ? 1 : -1;
    // (The right hand reaches, slowly, every so often; the left follows a little.)
    const reach = Math.pow(Math.max(0, Math.sin(t * 0.21 + (i ? 0 : 2.4))), 3) * (i ? 1 : 0.45);
    _b.set(s * 0.45, 0.55, -0.72);                                                        // pulled
    _c.set(s * (0.68 - 0.25 * reach), -0.3 + 0.06 * breath + 0.36 * reach, 0.5 + 0.4 * reach); // in awe
    aimLimb(j, _b, _c, new THREE.Vector3(s * 0.85, 0.42, 0.32), a, m);
    k.rotation.x = -0.45 * (1 - a) - (0.2 - 0.08 * reach) * a * (1 - m) - 0.1 * m;
    // (The hand turned palm out as it opens.)
    k.rotation.y = s * 0.5 * a;
  });
  f.legs.forEach(({ j, k }, i) => {
    const s = i ? 1 : -1;
    const sway = Math.sin(t * 0.33 + i * 1.7) * 0.05;
    _b.set(s * 0.14, -0.62, -0.78);
    _c.set(s * 0.06 + sway, -0.97, -0.12 - (i ? 0.08 : 0));
    aimLimb(j, _b, _c, new THREE.Vector3(s * 0.16, -0.9, -0.3), a, m);
    k.rotation.x = 0.35 * (1 - a) + (i ? 0.38 : 0.24) * a;
  });
  f.headG.rotation.x = -0.5 * (1 - a) + (-0.2 - 0.04 * breath) * a * (1 - m) - 0.42 * m;
  f.headG.rotation.y = 0.08 * Math.sin(t * 0.17) * a;
}

/* The chord's voices, low to high, and the chords they move through (Hz)
   (user, the first brief: the monks' hum, but an optimistic chord, very
   low and still haunting, a melody played over eternity; and again: more
   optimistic, it had gone dark). Over a held low D, only major colours:
   Dmaj9, G/D, Dsus2, D, A/D (a lift, the major seventh in it), round
   again. Each voice glides to its next note on its own time, seconds
   apart, so nothing seems to change for a long while. */
const CHORDS = [
  [73.42, 110.0, 185.0, 277.18, 329.63],
  [73.42, 123.47, 196.0, 246.94, 293.66],
  [73.42, 110.0, 164.81, 220.0, 329.63],
  [73.42, 110.0, 185.0, 220.0, 369.99],
  [73.42, 138.59, 164.81, 220.0, 329.63],
];
const CHORD_MS = 17000, VOICE_STAGGER = 3300, GLIDE_TC = 1.9;

function impulse(ctx, secs, decay) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

export function createEnding({ audio, onFinish, onPick, onStay }) {
  const doc = typeof document !== "undefined" ? document : null;
  let root = null, canvas = null, veil = null, dark = null, words = [], styleEl = null;
  let renderer = null, scene = null, camera = null, raf = 0, t0 = 0, stage = "idle", menu = null, finished = false;
  let fig = null, figMat = null, disposables = [], chord = null, skipMs = 0, wisps = null;
  let look = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0 }, dragAt = null;
  // Resolution held to the frame rate: an average of frame times; slow for
  // a while, a step down (never below 1).
  let pixelRatio = 1, frameAvg = 16.7, slowFor = 0;
  const sphereAt = new THREE.Vector3(0, 6, -420);

  /* ---- the sound: the chord ---- */
  function sound(on) {
    const o = audio && audio.phoneOutput ? audio.phoneOutput() : null;
    if (!o || !o.ctx) return;
    const { ctx } = o, t = ctx.currentTime;
    if (on && !chord) {
      /* Two gains in series: `fade`, the slow fade up (and down at the
         end), and `whole`, the level the swell moves (user: the volume
         was odd at the start: the swell had been re-aimed every frame on
         the same gain the fade-up was ramping, and they fought). */
      // (Evenly in loudness: from a whisper, -34 dB, up over ~7 s.)
      const fade = ctx.createGain(); fade.gain.setValueAtTime(0.0001, t); fade.gain.linearRampToValueAtTime(0.02, t + 0.6); fade.gain.exponentialRampToValueAtTime(1, t + 7.2);
      const whole = ctx.createGain(); whole.gain.value = 0.15;
      // (A vast room, user: way more reverb, much fuller.)
      const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 16, 1.6);
      const wet = ctx.createGain(); wet.gain.value = 1.45; const dry = ctx.createGain(); dry.gain.value = 0.2;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.6;
      // The "oo" of a hum (two formants), and over it a little of an
      // "aah" (two higher ones): warmer, and lighter, more hopeful.
      const band = (f, q, g) => { const b = ctx.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = f; b.Q.value = q; const gg = ctx.createGain(); gg.gain.value = g; b.connect(gg).connect(lp); return b; };
      const src = ctx.createGain();
      [band(320, 2.2, 2.0), band(820, 3, 0.9), band(700, 3, 0.7), band(1150, 4, 0.45)].forEach((b) => src.connect(b));
      const body = ctx.createGain(); body.gain.value = 0.5; src.connect(body).connect(lp);
      lp.connect(dry).connect(whole); lp.connect(verb).connect(wet).connect(whole);
      whole.connect(fade).connect(o.ear);
      const all = [];
      const voices = CHORDS[0].map((f, vi) => {
        // Five detuned saws a voice (fuller), each with its own vibrato.
        const oscs = [0, 1, 2, 3, 4].map(() => {
          const os = ctx.createOscillator(); os.type = "sawtooth"; os.frequency.value = f; os.detune.value = (Math.random() * 2 - 1) * 11;
          const vib = ctx.createOscillator(); vib.frequency.value = 3.6 + Math.random() * 1.6; const vg = ctx.createGain(); vg.gain.value = 2 + Math.random() * 2.5;
          vib.connect(vg).connect(os.detune);
          os.start(t); vib.start(t); all.push(os, vib);
          return os;
        });
        // (The top two voices with a faint octave above them: light.)
        if (vi >= 3) {
          const up = ctx.createOscillator(); up.type = "triangle"; up.frequency.value = f * 2; oscs.push(up);
          const ug = ctx.createGain(); ug.gain.value = 0.12; up.connect(ug); up.start(t); all.push(up);
          up._g = ug;
        }
        const g = ctx.createGain(); const lv = (vi >= 3 ? 0.6 : 1) / Math.sqrt(25);
        g.gain.value = lv;
        const breath = ctx.createOscillator(); breath.frequency.value = 0.04 + Math.random() * 0.07; const bg = ctx.createGain(); bg.gain.value = 0.3 * lv;
        breath.connect(bg).connect(g.gain); breath.start(t); all.push(breath);
        // Spread across the room, low in the middle, the rest to the sides.
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) pan.pan.value = [0, -0.45, 0.45, -0.7, 0.7][vi];
        oscs.forEach((os) => (os._g ? os._g : os).connect(g));
        if (pan) g.connect(pan).connect(src); else g.connect(src);
        return { oscs, g };
      });
      // Under it all, the low D an octave down, a breath of it.
      { const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 36.71; const sg = ctx.createGain(); sg.gain.value = 0.05;
        sub.connect(sg).connect(lp); sub.start(t); all.push(sub); }
      // A shimmer high above it, all reverb, barely there: two sines (a D
      // and an A), each swelling and fading on its own long breath.
      [1174.66, 1760].forEach((f, i) => {
        const os = ctx.createOscillator(); os.type = "sine"; os.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.004;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 1 / (17 + 6 * i); const lg = ctx.createGain(); lg.gain.value = 0.004;
        lfo.connect(lg).connect(g.gain);
        os.connect(g).connect(verb);
        os.start(t); lfo.start(t); all.push(os, lfo);
      });
      chord = { ctx, fade, whole, lp, voices, all, next: performance.now() + CHORD_MS, at: 0 };
    } else if (!on && chord) {
      const c = chord; chord = null;
      c.fade.gain.cancelScheduledValues(t); c.fade.gain.setValueAtTime(Math.max(0.0001, c.fade.gain.value), t); c.fade.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      setTimeout(() => c.all.forEach((x) => { try { x.stop(); } catch (e) { /* done */ } }), 14000);
    }
  }
  // Each frame: when it's time, the next chord, one voice at a time.
  function moveChord(now) {
    if (!chord || now < chord.next) return;
    chord.at = (chord.at + 1) % CHORDS.length;
    const target = CHORDS[chord.at], c = chord;
    target.forEach((f, vi) => {
      const when = c.ctx.currentTime + (vi * VOICE_STAGGER) / 1000 + Math.random() * 0.6;
      c.voices[vi].oscs.forEach((os) => os.frequency.setTargetAtTime(os._g ? f * 2 : f, when, GLIDE_TC));
    });
    chord.next = now + CHORD_MS;
  }
  // As they go in: louder, brighter, an octave above joining; then gone.
  function swell(k) {
    if (!chord) return;
    const t = chord.ctx.currentTime;
    chord.whole.gain.setTargetAtTime(0.15 + 0.3 * k * k, t, 0.25);
    chord.lp.frequency.setTargetAtTime(900 + 2400 * k * k, t, 0.25);
  }

  function build() {
    style();
    root = doc.createElement("div"); root.className = "den-ending"; root.setAttribute("data-testid", "den-ending");
    canvas = doc.createElement("canvas"); root.appendChild(canvas);
    REVELATION.forEach((line, i) => { const w = doc.createElement("div"); w.className = "word"; w.setAttribute("data-testid", `den-ending-line-${i + 1}`); w.setAttribute("role", "status"); w.innerHTML = md(line); root.appendChild(w); words.push(w); });
    dark = doc.createElement("div"); dark.className = "dark"; root.appendChild(dark);
    veil = doc.createElement("div"); veil.className = "veil"; root.appendChild(veil);
    doc.body.appendChild(root);
    // The camera can't be moved (user); touches here go nowhere (the
    // den's own page-wide listeners have nothing to do).
    ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "wheel"].forEach((ev) => root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === "wheel" || ev === "touchmove") e.preventDefault(); }, ev === "wheel" || ev === "touchmove" ? { passive: false } : undefined));
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
    // (A phone starts a little under its full density; frames that run
    // slow step it down further, see frame().)
    const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    pixelRatio = Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1);
    if (renderer) { renderer.setPixelRatio(pixelRatio); renderer.setClearColor(0x000000, 1); }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
    // The sphere: black; round it a halo and the plasma ring, pulsing blue.
    const glowTex = (() => { const c = doc.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); const gr = x.createRadialGradient(128, 128, 34, 128, 128, 128); gr.addColorStop(0, "rgba(200,225,255,1)"); gr.addColorStop(0.28, "rgba(90,150,255,0.6)"); gr.addColorStop(1, "rgba(10,30,90,0)"); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(300); glow.position.copy(sphereAt); scene.add(glow); disposables.push(glowTex, glow.material);
    const ringGeo = new THREE.RingGeometry(46, 122, 128, 1);
    const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uPulse: { value: 1 }, uFlare: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime, uPulse, uFlare; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ float r = length(vP), a = atan(vP.y, vP.x); float k = clamp((r - 46.0) / 76.0, 0.0, 1.0);
          float plasma = n(vec2(a * 6.0 + uTime * 0.6, r * 0.18 - uTime * 0.9)) * 0.6 + n(vec2(a * 15.0 - uTime * 1.1, r * 0.4)) * 0.4;
          float bands = 0.55 + 0.45 * sin(r * 0.5 - uTime * 1.6 + a * 3.0 + plasma * 3.0);
          float f = pow(1.0 - k, 1.7) * smoothstep(0.0, 0.07, k) * bands * (0.7 + 0.6 * plasma);
          vec3 c = mix(vec3(0.92, 0.97, 1.0), vec3(0.2, 0.45, 1.0), pow(k, 0.7));
          gl_FragColor = vec4(c * f * (1.25 * uPulse + 2.5 * uFlare), 1.0); }` });
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.copy(sphereAt); ring.rotation.x = 1.22; scene.add(ring); disposables.push(ringGeo, ringMat);
    const ballGeo = new THREE.SphereGeometry(40, 48, 32), ballMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const ball = new THREE.Mesh(ballGeo, ballMat); ball.position.copy(sphereAt); scene.add(ball); disposables.push(ballGeo, ballMat);
    // The figure.
    // (One set of uniforms for the body and its wireframe, so they stretch,
    // move and dissolve together.)
    const figU = {
      uLight: { value: new THREE.Vector3(0, 0, -1) }, uGlow: { value: 1 },
      uCenter: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uStretch: { value: 1 }, uTime: { value: 0 },
      uSolid: { value: 0.2 }, uWire: { value: 0.8 } };
    figMat = new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: RIM_FRAG, uniforms: figU });
    fig = buildFigure(figMat);
    disposables.push(figMat, ...fig.geos);
    // The wireframe under the black (user: the body warping, morphing
    // between the singularity's black and a wireframe mesh, then slowly
    // all black).
    const wireMat = new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: WIRE_FRAG, uniforms: figU, wireframe: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    disposables.push(wireMat);
    fig.meshes.forEach((m) => { const w = new THREE.Mesh(m.geometry, wireMat); w.renderOrder = 1; m.add(w); });
    scene.add(fig.fig);
    // The plasma coming off them (user: the singularity's own wisps,
    // rising from the body more and more as they go into it): a pool of
    // motes, each born at a point on the body, drifting off and up in a
    // slow curl, growing, fading.
    {
      const N = 700, pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aAlpha", new THREE.BufferAttribute(al, 1));
      g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
      const mat = new THREE.ShaderMaterial({ vertexShader: WISP_VERT, fragmentShader: WISP_FRAG, uniforms: { uScale: { value: 400 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
      disposables.push(g, mat);
      wisps = { N, pos, al, sz, g, mat, pts, p: Array.from({ length: N }, () => ({ life: 0, age: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ph: Math.random() * 6.28, size: 1 })), carry: 0, next: 0 };
    }
    // A faint aura round them, breathing (user: subtle, ethereal).
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fc4ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    aura.scale.setScalar(34); scene.add(aura); disposables.push(aura.material);
    scene.userData = { ringMat, ring, glow, aura };
    resize();
    window.addEventListener("resize", resize);
  }
  function style() {
    if (styleEl || !doc) return;
    styleEl = doc.createElement("style"); styleEl.textContent = CSS; doc.head.appendChild(styleEl);
  }
  function resize() {
    if (!root || !camera) return;
    const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h); camera.fov = camera.aspect < 0.8 ? 70 : 55; camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(w, h, false);
  }

  const figPos = new THREE.Vector3(), camPos = new THREE.Vector3(), tmp = new THREE.Vector3(), aim = new THREE.Vector3(), off = new THREE.Vector3();
  // The plasma off the body: more and more of it from ~4 s, most as they
  // go in; each mote born on the body, drifting out and up in a slow
  // curl (pulled a little toward the sphere), growing as it fades.
  const wv = new THREE.Vector3(), wc = new THREE.Vector3();
  function stepWisps(s, dt, m) {
    if (!wisps || !fig) return;
    const W = wisps;
    const grow = smooth((s - 4000) / 22000);
    const rate = fig.fig.visible ? 3 + 55 * grow + 110 * m : 0;
    W.carry += rate * dt;
    fig.fig.updateMatrixWorld(true);
    wc.copy(sphereAt).sub(figPos).normalize();
    const shrink = fig.fig.scale.x;
    for (let i = 0; i < W.N && W.carry >= 1; i++) {
      const p = W.p[(W.next + i) % W.N];
      if (p.age < p.life) continue;
      W.carry -= 1; W.next = (W.next + i + 1) % W.N; i = -1;
      const mesh = fig.meshes[(Math.random() * fig.meshes.length) | 0];
      const at = mesh.geometry.attributes.position, k = (Math.random() * at.count) | 0;
      wv.fromBufferAttribute(at, k).applyMatrix4(mesh.matrixWorld);
      p.x = wv.x; p.y = wv.y; p.z = wv.z;
      wv.sub(figPos).normalize();
      const sp = (2.5 + 4 * Math.random()) * shrink;
      p.vx = wv.x * sp + wc.x * 1.5; p.vy = wv.y * sp + 2.2 * shrink + wc.y * 1.5; p.vz = wv.z * sp + wc.z * 1.5;
      p.age = 0; p.life = 2.2 + 2 * Math.random(); p.size = (0.8 + 1.3 * Math.random()) * shrink; p.ph = Math.random() * 6.28;
    }
    W.carry = Math.min(W.carry, 3);
    for (let i = 0; i < W.N; i++) {
      const p = W.p[i];
      if (p.age >= p.life) { W.al[i] = 0; continue; }
      p.age += dt;
      const u = p.age / p.life, c = Math.sin(p.ph + p.age * 1.7) * 1.6;
      p.x += (p.vx + c) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(p.ph + p.age * 1.3) * 1.6) * dt;
      p.vx *= 1 - 0.4 * dt; p.vy *= 1 - 0.25 * dt; p.vz *= 1 - 0.4 * dt;
      W.pos[i * 3] = p.x; W.pos[i * 3 + 1] = p.y; W.pos[i * 3 + 2] = p.z;
      W.al[i] = Math.sin(Math.PI * Math.min(1, u)) * 0.32;
      W.sz[i] = p.size * (1 + 2.4 * u);
    }
    W.g.attributes.position.needsUpdate = true; W.g.attributes.aAlpha.needsUpdate = true; W.g.attributes.aSize.needsUpdate = true;
    if (renderer && camera) W.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  let mergeFrom = null, lastNow = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now(), s = now - t0 + skipMs, rawMs = lastNow ? now - lastNow : 16.7, dt = Math.min(0.05, rawMs / 1000);
    lastNow = now;
    if (rawMs < 250) {
      frameAvg += (rawMs - frameAvg) * 0.1;
      slowFor = frameAvg > 24 ? slowFor + rawMs : 0;
      if (slowFor > 900 && pixelRatio > 1 && renderer) {
        pixelRatio = Math.max(1, Math.round((pixelRatio - 0.25) * 100) / 100);
        renderer.setPixelRatio(pixelRatio); resize(); slowFor = 0; frameAvg = 16.7;
      }
    }
    const T1 = s / 1000;
    moveChord(now);
    // The pull: from just ahead of you, away toward the sphere, fast and
    // then slowing; then floating, drifting.
    const p = clamp01(s / T.pull[1]);
    // (The drift levels off well short of it: the words take ~40 s.)
    const dist = 26 + 210 * (1 - Math.pow(1 - p, 3)) + 70 * (1 - Math.exp(-Math.max(0, T1 - T.pull[1] / 1000) / 18));
    figPos.set(Math.sin(T1 * 0.4) * 3, -3 + 2 * Math.sin(T1 * 0.31), -dist);
    // Then into the sphere: drifting in, slowly and then faster, smaller
    // as it goes, until it's one with it.
    const m = clamp01((s - MERGE[0]) / (MERGE[1] - MERGE[0]));
    if (m > 0) {
      if (!mergeFrom) mergeFrom = figPos.clone();
      figPos.copy(mergeFrom).lerp(sphereAt, m * m * m);
    }
    fig.fig.position.copy(figPos);
    fig.fig.scale.setScalar(1 - 0.85 * m * m);
    fig.fig.visible = m < 0.995;
    const ease = smooth((s - 2500) / 6000);
    // Composing themselves, slowly: upright-ish, leaning toward the light,
    // a slow sway; at the end, given to it.
    const awe = smooth((s - 2200) / 7000);
    fig.fig.rotation.set(-0.95 + 0.6 * awe + 0.03 * Math.sin(T1 * 0.35) + 0.25 * m, Math.PI + 0.12 * Math.sin(T1 * 0.11) * awe, 0.05 * Math.sin(T1 * 0.17) * awe);
    pose(fig, T1, awe, smooth(m * 1.6));
    // Spaghettified on the way in, let go into a body again.
    const stretch = 1 - smooth((s - 1100) / 2700);
    figMat.uniforms.uStretch.value = stretch;
    figMat.uniforms.uTime.value = T1;
    figMat.uniforms.uCenter.value.copy(figPos);
    figMat.uniforms.uDir.value.copy(sphereAt).sub(figPos).normalize();
    const aura = scene.userData.aura;
    aura.position.copy(figPos);
    aura.scale.setScalar((30 + 3 * Math.sin((T1 * Math.PI * 2) / 7.2)) * (1 - 0.8 * m));
    aura.material.opacity = (0.06 + 0.025 * Math.sin((T1 * Math.PI * 2) / 7.2)) * smooth((s - 3000) / 5000) * (1 - m);
    // The camera: behind, following; easing round as it floats; looking
    // round where the drag says; at the end, in on the sphere.
    const lag = 14 + 22 * smooth(s / 4000) + 10 * ease;
    const orbit = 0.5 * ease * Math.sin(T1 * 0.08);
    const anchor = mergeFrom || figPos;
    camPos.set(anchor.x + Math.sin(orbit) * lag, anchor.y - 4 + 6 * ease, anchor.z + Math.cos(orbit) * lag);
    if (s < 1800) camPos.x += (Math.random() - 0.5) * (1 - s / 1800) * 1.5;
    // (While they're drawn out, the camera's out to one side and a little
    // above, so the whole long strand of them reads, reaching for the
    // sphere; it eases in behind as they come back into a body.)
    const outSide = 1 - smooth((s - 1600) / 3600);
    camPos.x += 26 * outSide; camPos.y += 7 * outSide; camPos.z -= 6 * outSide;
    aim.copy(anchor).lerp(sphereAt, 0.15 + 0.25 * ease);
    const z = smooth((s - ZOOM[0]) / (ZOOM[1] - ZOOM[0]));
    if (z > 0) {
      // (In, until the black of it fills everything.)
      tmp.copy(sphereAt).add(off.set(0, 0, 44));
      camPos.lerp(tmp, z * z);
      aim.lerp(sphereAt, z);
    }
    camera.position.copy(camPos);
    off.set(Math.sin(look.yaw) * Math.cos(look.pitch), Math.sin(look.pitch), -Math.cos(look.yaw) * Math.cos(look.pitch));
    camera.up.set(0, 1, 0);
    tmp.copy(aim).sub(camPos);
    const len = tmp.length();
    // Look along the aim, turned by the drag (yaw about up, pitch about the side).
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tmp.normalize());
    off.applyQuaternion(q);
    camera.lookAt(tmp.copy(camPos).addScaledVector(off, len));
    // The light on the figure: from the sphere, in the camera's view.
    camera.updateMatrixWorld();
    tmp.copy(sphereAt).sub(figPos).normalize().transformDirection(camera.matrixWorldInverse);
    figMat.uniforms.uLight.value.copy(tmp);
    // Wireframe and black, morphing, then all black (slowly, ~2 s to ~19 s).
    const solidP = smooth((s - 2000) / 17000);
    const solid = Math.min(1, Math.max(0.05, 0.18 + 0.82 * solidP + 0.16 * Math.sin(T1 * 1.3) * Math.sin(T1 * 0.47) * (1 - solidP)));
    figMat.uniforms.uSolid.value = solidP >= 0.999 ? 1 : solid;
    figMat.uniforms.uWire.value = 0.85 * Math.pow(1 - solidP, 1.2);
    figMat.uniforms.uGlow.value = (0.9 + 0.12 * Math.sin((T1 * Math.PI * 2) / 7.2)) * (1 - 0.45 * solidP) + 1.2 * stretch + 1.6 * m * m;
    stepWisps(s, dt, m);
    // The plasma and the halo, breathing; flaring as they're taken in.
    const pulse = 0.82 + 0.18 * Math.sin(T1 * 0.9) + 0.08 * Math.sin(T1 * 2.3);
    const flare = Math.exp(-Math.pow((m - 0.97) / 0.05, 2));
    scene.userData.ringMat.uniforms.uTime.value = T1;
    scene.userData.ringMat.uniforms.uPulse.value = pulse;
    scene.userData.ringMat.uniforms.uFlare.value = flare + 0.6 * z;
    scene.userData.ring.rotation.z = T1 * 0.05;
    scene.userData.glow.scale.setScalar(300 * (0.94 + 0.08 * pulse) * (1 + 0.5 * flare));
    // The sound swells with it.
    if (stage === "void") swell(Math.max(m * 0.7, z));
    // The white going off it; the black at the end.
    if (veil) veil.style.opacity = String(1 - smooth((s - T.unveil[0]) / (T.unveil[1] - T.unveil[0])));
    if (dark) dark.style.opacity = String(smooth((s - BLACK[0]) / (BLACK[1] - BLACK[0])));
    // The words, one at a time (the last held longer).
    words.forEach((w, i) => {
      const a = s - (T.words + i * T.wordEach), hold = i === words.length - 1 ? T.lastHold : T.wordEach;
      w.classList.toggle("on", a > 0 && a < hold - 1300);
    });
    if (s >= BLACK[1] && stage === "void") { stage = "black"; sound(false); }
    if (s >= MENU_AT && stage === "black") openMenu();
    if (renderer) renderer.render(scene, camera);
  }
  function openMenu() {
    stage = "menu";
    if (!finished) { finished = true; if (onFinish) onFinish(); }
    menu = createRealitiesMenu({
      title: "Other realities",
      sub: "The story's over. Every version of the game is here. Pick one, or stay in the den.",
      currentId: "den",
      // (A moment to read it first: taps still coming from the scene went
      // straight to a world, user; and two seconds more, so the words at
      // the top are read, user.)
      lockMs: typeof window !== "undefined" && typeof window.__EC_TEST_REALITIES_LOCK__ === "number" ? window.__EC_TEST_REALITIES_LOCK__ : 5500,
      onPick: (w) => { if (w.nova === "standard") { leave(); return; } stage = "going"; if (onPick) onPick(w); },
      onStay: () => leave(),
    });
  }
  function leave() {
    stage = "leaving";
    sound(false);
    if (audio && audio.awayFromDen) audio.awayFromDen(false, 1.5);
    if (root) root.classList.add("off");
    setTimeout(() => { teardown(); if (onStay) onStay(); }, 1250);
  }
  function teardown() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener("resize", resize);
    if (menu) { menu.close(); menu = null; }
    disposables.forEach((d) => d && d.dispose && d.dispose()); disposables = [];
    if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer = null; }
    if (root) { root.remove(); root = null; }
    words = []; veil = null; dark = null; stage = stage === "leaving" ? "done" : stage;
  }

  return {
    start() {
      if (!doc || stage !== "idle") return false;
      build();
      if (audio && audio.awayFromDen) audio.awayFromDen(true, 0.6);
      sound(true);
      t0 = performance.now(); stage = "void";
      raf = requestAnimationFrame(frame);
      return true;
    },
    // Whether it covers the screen (the den needn't draw underneath).
    covering: () => !!root && (stage === "void" || stage === "black" || stage === "menu" || stage === "going"),
    state: () => ({ stage, pixelRatio, look: { yaw: look.yaw, pitch: look.pitch }, t: stage === "idle" ? 0 : performance.now() - t0 + skipMs, line: words.findIndex((w) => w.classList.contains("on")) + 1, menuAt: MENU_AT, mergeAt: MERGE[0], figure: fig ? fig.fig.visible : null, solid: figMat ? figMat.uniforms.uSolid.value : null, level: chord ? chord.fade.gain.value * chord.whole.gain.value : 0, wisps: wisps ? wisps.al.reduce((n, a) => n + (a > 0 ? 1 : 0), 0) : 0 }),
    // Test-only: on by ms.
    skip(ms) { skipMs += ms; },
    dispose() {
      sound(false);
      teardown();
      if (styleEl) { styleEl.remove(); styleEl = null; }
    },
  };
}
