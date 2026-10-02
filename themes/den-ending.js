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
   phone). A drag looks round (there's nothing to find), and the picture's
   resolution steps down by itself if frames run slow, so it stays smooth
   (user: keep it rotatable, but the frame rate high). The
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
.den-ending { position: fixed; inset: 0; z-index: 1500; background: #000; overflow: hidden; touch-action: none; cursor: grab; }
.den-ending canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.den-ending .veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #f1ecff 55%, #e2d6ff 100%); pointer-events: none; }
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
const RIM_VERT = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const RIM_FRAG = `uniform vec3 uLight; uniform float uGlow; varying vec3 vN; varying vec3 vV;
void main(){ vec3 n = normalize(vN); float rim = pow(1.0 - abs(dot(n, vV)), 2.4);
  float toward = 0.35 + 0.65 * max(0.0, dot(n, uLight));
  vec3 c = vec3(0.012, 0.008, 0.02) + (mix(vec3(0.55, 0.35, 1.0), vec3(0.45, 0.9, 1.0), rim * rim) * rim * toward * 1.7 * uGlow);
  gl_FragColor = vec4(c, 1.0); }`;

function buildFigure(mat) {
  const fig = new THREE.Group();
  const geos = [];
  const mesh = (geo, parent = fig) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
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
  return { fig, geos, arms, legs, headG };
}
// Limbs trailing back from a body pulled chest first: `d` is where each
// points, in the body's own frame (its front is +z; turned to face the
// sphere, trailing is -z).
const Y_DOWN = new THREE.Vector3(0, -1, 0);
function pose(f, t, wild) {
  const fl = (a, b) => Math.sin(t * a + b) * wild;
  f.arms.forEach(({ j, k }, i) => {
    const s = i ? 1 : -1;
    const d = new THREE.Vector3(s * (0.45 + 0.1 * fl(1.7, i)), 0.55 + 0.12 * fl(2.3, 1 + i), -0.72 - 0.1 * fl(1.3, 2)).normalize();
    j.quaternion.setFromUnitVectors(Y_DOWN, d);
    k.rotation.x = -0.45 - 0.25 * fl(2.1, i);
  });
  f.legs.forEach(({ j, k }, i) => {
    const s = i ? 1 : -1;
    const d = new THREE.Vector3(s * (0.14 + 0.06 * fl(1.1, i + 3)), -0.62, -0.78 - 0.08 * fl(1.9, i)).normalize();
    j.quaternion.setFromUnitVectors(Y_DOWN, d);
    k.rotation.x = 0.35 + 0.2 * fl(1.6, i + 1);
  });
  f.headG.rotation.x = -0.5 - 0.1 * fl(1.2, 5); // head thrown back
}

// The chord's voices, low to high, and the chords they move through (Hz):
// D, D6/9, Bm7, Gmaj7, A, and round again. Each voice glides to its next
// note on its own time, a few seconds apart.
const CHORDS = [
  [73.42, 110.0, 146.83, 185.0, 220.0],
  [73.42, 110.0, 164.81, 185.0, 246.94],
  [61.74, 92.5, 146.83, 185.0, 220.0],
  [49.0, 73.42, 146.83, 185.0, 246.94],
  [55.0, 82.41, 138.59, 164.81, 220.0],
];
const CHORD_MS = 16000, VOICE_STAGGER = 3100, GLIDE_TC = 1.6;

function impulse(ctx, secs, decay) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

export function createEnding({ audio, onFinish, onPick, onStay }) {
  const doc = typeof document !== "undefined" ? document : null;
  let root = null, canvas = null, veil = null, dark = null, words = [], styleEl = null;
  let renderer = null, scene = null, camera = null, raf = 0, t0 = 0, stage = "idle", menu = null, finished = false;
  let fig = null, figMat = null, disposables = [], chord = null, skipMs = 0;
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
      const whole = ctx.createGain(); whole.gain.setValueAtTime(0.0001, t); whole.gain.linearRampToValueAtTime(0.14, t + 7);
      const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 9, 2.4);
      const wet = ctx.createGain(); wet.gain.value = 0.85; const dry = ctx.createGain(); dry.gain.value = 0.35;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.7;
      // The "oo" of a hum: two formants over the voices.
      const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 320; f1.Q.value = 2.2;
      const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 820; f2.Q.value = 3;
      const fg1 = ctx.createGain(); fg1.gain.value = 2.2; const fg2 = ctx.createGain(); fg2.gain.value = 0.9;
      const body = ctx.createGain(); body.gain.value = 0.55;
      const src = ctx.createGain();
      src.connect(f1).connect(fg1).connect(lp); src.connect(f2).connect(fg2).connect(lp); src.connect(body).connect(lp);
      lp.connect(dry).connect(whole); lp.connect(verb).connect(wet).connect(whole);
      whole.connect(o.ear);
      const all = [];
      const voices = CHORDS[0].map((f, vi) => {
        const oscs = [0, 1, 2].map(() => {
          const os = ctx.createOscillator(); os.type = "sawtooth"; os.frequency.value = f; os.detune.value = (Math.random() * 2 - 1) * 8;
          const vib = ctx.createOscillator(); vib.frequency.value = 3.8 + Math.random() * 1.4; const vg = ctx.createGain(); vg.gain.value = 2 + Math.random() * 2.5;
          vib.connect(vg).connect(os.detune);
          os.start(t); vib.start(t); all.push(os, vib);
          return os;
        });
        const g = ctx.createGain(); const lv = (vi >= 3 ? 0.55 : 1) / Math.sqrt(15);
        g.gain.value = lv;
        const breath = ctx.createOscillator(); breath.frequency.value = 0.04 + Math.random() * 0.07; const bg = ctx.createGain(); bg.gain.value = 0.3 * lv;
        breath.connect(bg).connect(g.gain); breath.start(t); all.push(breath);
        oscs.forEach((os) => os.connect(g)); g.connect(src);
        return { oscs, g };
      });
      chord = { ctx, whole, lp, voices, all, next: performance.now() + CHORD_MS, at: 0 };
    } else if (!on && chord) {
      const c = chord; chord = null;
      c.whole.gain.cancelScheduledValues(t); c.whole.gain.setValueAtTime(c.whole.gain.value, t); c.whole.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      setTimeout(() => c.all.forEach((x) => { try { x.stop(); } catch (e) { /* done */ } }), 11000);
    }
  }
  // Each frame: when it's time, the next chord, one voice at a time.
  function moveChord(now) {
    if (!chord || now < chord.next) return;
    chord.at = (chord.at + 1) % CHORDS.length;
    const target = CHORDS[chord.at], c = chord;
    target.forEach((f, vi) => {
      const when = c.ctx.currentTime + (vi * VOICE_STAGGER) / 1000 + Math.random() * 0.6;
      c.voices[vi].oscs.forEach((os) => os.frequency.setTargetAtTime(f, when, GLIDE_TC));
    });
    chord.next = now + CHORD_MS;
  }
  // As they go in: louder, brighter, an octave above joining; then gone.
  function swell(k) {
    if (!chord) return;
    const t = chord.ctx.currentTime;
    chord.whole.gain.setTargetAtTime(0.14 + 0.3 * k * k, t, 0.25);
    chord.lp.frequency.setTargetAtTime(520 + 2600 * k * k, t, 0.25);
  }

  function build() {
    style();
    root = doc.createElement("div"); root.className = "den-ending"; root.setAttribute("data-testid", "den-ending");
    canvas = doc.createElement("canvas"); root.appendChild(canvas);
    REVELATION.forEach((line, i) => { const w = doc.createElement("div"); w.className = "word"; w.setAttribute("data-testid", `den-ending-line-${i + 1}`); w.setAttribute("role", "status"); w.innerHTML = md(line); root.appendChild(w); words.push(w); });
    dark = doc.createElement("div"); dark.className = "dark"; root.appendChild(dark);
    veil = doc.createElement("div"); veil.className = "veil"; root.appendChild(veil);
    doc.body.appendChild(root);
    // A drag looks round (and eases back when let go).
    // (Kept here: the den's own page-wide listeners have nothing to do.)
    ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "wheel"].forEach((ev) => root.addEventListener(ev, (e) => e.stopPropagation()));
    root.addEventListener("pointerdown", (e) => { dragAt = { x: e.clientX, y: e.clientY, yaw: look.goalYaw, pitch: look.goalPitch }; root.setPointerCapture && root.setPointerCapture(e.pointerId); });
    root.addEventListener("pointermove", (e) => {
      if (!dragAt) return;
      look.goalYaw = dragAt.yaw - (e.clientX - dragAt.x) * 0.006;
      look.goalPitch = Math.max(-1.1, Math.min(1.1, dragAt.pitch + (e.clientY - dragAt.y) * 0.005));
    });
    const up = () => { dragAt = null; };
    root.addEventListener("pointerup", up); root.addEventListener("pointercancel", up);
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
    figMat = new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: RIM_FRAG, uniforms: { uLight: { value: new THREE.Vector3(0, 0, -1) }, uGlow: { value: 1 } } });
    fig = buildFigure(figMat);
    disposables.push(figMat, ...fig.geos);
    scene.add(fig.fig);
    scene.userData = { ringMat, ring, glow };
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
    fig.fig.rotation.set(-0.95 + 0.25 * ease + 0.05 * Math.sin(T1 * 0.7) + 0.6 * m, 0.25 * Math.sin(T1 * 0.23) * ease + Math.PI, 0.18 * Math.sin(T1 * 0.37) + 0.35 * ease * Math.sin(T1 * 0.13));
    pose(fig, T1, 1 - 0.6 * ease - 0.3 * m);
    // The camera: behind, following; easing round as it floats; looking
    // round where the drag says; at the end, in on the sphere.
    const lag = 14 + 22 * smooth(s / 4000) + 10 * ease;
    const orbit = 0.5 * ease * Math.sin(T1 * 0.08);
    const anchor = mergeFrom || figPos;
    camPos.set(anchor.x + Math.sin(orbit) * lag, anchor.y - 4 + 6 * ease, anchor.z + Math.cos(orbit) * lag);
    if (s < 1800) camPos.x += (Math.random() - 0.5) * (1 - s / 1800) * 1.5;
    aim.copy(anchor).lerp(sphereAt, 0.15 + 0.25 * ease);
    const z = smooth((s - ZOOM[0]) / (ZOOM[1] - ZOOM[0]));
    if (z > 0) {
      // (In, until the black of it fills everything.)
      tmp.copy(sphereAt).add(off.set(0, 0, 44));
      camPos.lerp(tmp, z * z);
      aim.lerp(sphereAt, z);
    }
    look.yaw += (look.goalYaw - look.yaw) * (1 - Math.exp(-dt * 6));
    look.pitch += (look.goalPitch - look.pitch) * (1 - Math.exp(-dt * 6));
    if (!dragAt) { look.goalYaw *= Math.exp(-dt * 0.35); look.goalPitch *= Math.exp(-dt * 0.35); }
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
    figMat.uniforms.uGlow.value = 0.9 + 0.2 * Math.sin(T1 * 1.3) + 1.6 * m * m;
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
      stayLabel: "Stay in the den",
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
    state: () => ({ stage, pixelRatio, look: { yaw: look.yaw, pitch: look.pitch }, t: stage === "idle" ? 0 : performance.now() - t0 + skipMs, line: words.findIndex((w) => w.classList.contains("on")) + 1, menuAt: MENU_AT, mergeAt: MERGE[0], figure: fig ? fig.fig.visible : null }),
    // Test-only: on by ms.
    skip(ms) { skipMs += ms; },
    dispose() {
      sound(false);
      teardown();
      if (styleEl) { styleEl.remove(); styleEl = null; }
    },
  };
}
