/* The end of the story (user): out of the hall's eruption, into the void.
   A person, seen from behind, is pulled out chest first, arms and legs
   trailing, into a dark like the Singularity's: stars, a violet haze, the
   black sphere ahead with its ring of light. They slow, and float. Then
   the words: their whole reality was inside it; the meaning of life, the
   universe and everything wasn't 42, it was this game (the lines are the
   user's to write: REVELATION, placeholders until then). Then the other
   realities (realities.js): the story's over, and every other version of
   the game is there to go to, or stay in the den.

   Its own canvas and renderer over everything (the den goes on drawing
   underneath, unseen). The figure is built here: a lean, faceless body,
   near black, its edges lit violet and cyan by the light ahead (a rim
   shader). The sound: the den's own sounds step out (awayFromDen) and a
   low drone comes in (phoneOutput's ear).

   createEnding({ audio, onFinish, onPick, onStay }) -> { start(),
   state(), skip(ms), dispose() }. den-fx.js starts it from den-hall.js. */

import * as THREE from "three";
import { createRealitiesMenu } from "./realities.js";

// PLACEHOLDER lines (user: "I'll write it"): replace with the user's own.
export const REVELATION = [
  "It was all inside it. All of it.",
  "The meaning of life, the universe, and everything…",
  "…it wasn't 42.",
  "It was El Cabeza.",
];

// The timeline (ms from the white).
const T = {
  unveil: [0, 1400],      // the white fading off the void
  pull: [0, 5200],        // yanked away, fast, then slowing
  words: 9000,            // the first line
  wordEach: 4300,         // each line's turn (in, hold, out)
  menuAfter: 900,         // after the last line
};
const MENU_AT = T.words + REVELATION.length * T.wordEach + T.menuAfter;

const CSS = `
.den-ending { position: fixed; inset: 0; z-index: 1500; background: #000; overflow: hidden; }
.den-ending canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.den-ending .veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #f1ecff 55%, #e2d6ff 100%); pointer-events: none; }
.den-ending .word { position: absolute; left: 50%; bottom: 18%; width: min(88vw, 760px); transform: translateX(-50%); text-align: center; pointer-events: none;
  color: #efe8ff; font: 300 clamp(22px, 4.6vw, 38px)/1.3 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.04em; text-wrap: balance;
  text-shadow: 0 0 18px rgba(150,110,255,0.65), 0 2px 10px rgba(0,0,0,0.8); opacity: 0; transition: opacity 1.2s ease; }
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

export function createEnding({ audio, onFinish, onPick, onStay }) {
  const doc = typeof document !== "undefined" ? document : null;
  let root = null, canvas = null, veil = null, words = [], styleEl = null;
  let renderer = null, scene = null, camera = null, raf = 0, t0 = 0, stage = "idle", menu = null, finished = false;
  let fig = null, figMat = null, dust = null, disposables = [], drone = null, skipMs = 0;
  const sphereAt = new THREE.Vector3(0, 6, -420);

  function sound(on) {
    const o = audio && audio.phoneOutput ? audio.phoneOutput() : null;
    if (!o || !o.ctx) return;
    const { ctx } = o, t = ctx.currentTime;
    if (on && !drone) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.085, t + 5);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 1.4;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(lp.frequency);
      const oscs = [55, 82.41, 110.3, 164.8].map((f, i) => { const os = ctx.createOscillator(); os.type = i % 2 ? "triangle" : "sawtooth"; os.frequency.value = f; os.detune.value = (i - 1.5) * 6; os.connect(lp); return os; });
      const sh = ctx.createOscillator(); sh.frequency.value = 1318.5; const shg = ctx.createGain(); shg.gain.value = 0.006; sh.connect(shg).connect(g);
      lp.connect(g).connect(o.ear);
      [lfo, sh, ...oscs].forEach((x) => x.start(t));
      drone = { g, all: [lfo, sh, ...oscs], ctx };
    } else if (!on && drone) {
      const d = drone; drone = null;
      d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      setTimeout(() => d.all.forEach((x) => { try { x.stop(); } catch (e) { /* done */ } }), 1600);
    }
  }

  function build() {
    style();
    root = doc.createElement("div"); root.className = "den-ending"; root.setAttribute("data-testid", "den-ending");
    canvas = doc.createElement("canvas"); root.appendChild(canvas);
    REVELATION.forEach((line, i) => { const w = doc.createElement("div"); w.className = "word"; w.setAttribute("data-testid", `den-ending-line-${i + 1}`); w.setAttribute("role", "status"); w.textContent = line; root.appendChild(w); words.push(w); });
    veil = doc.createElement("div"); veil.className = "veil"; root.appendChild(veil);
    doc.body.appendChild(root);
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch (e) { renderer = null; }
    if (renderer) {
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x020108, 1);
    }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
    // The haze: a great sphere round everything, violet to black.
    const hazeGeo = new THREE.SphereGeometry(1800, 32, 16);
    const hazeMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){ float ahead = max(0.0, -vP.z); float band = exp(-abs(vP.y + 0.05) * 5.0);
          vec3 c = vec3(0.012, 0.006, 0.03) + vec3(0.22, 0.09, 0.42) * pow(ahead, 3.0) * 0.55 + vec3(0.08, 0.05, 0.2) * band * 0.4;
          gl_FragColor = vec4(c, 1.0); }` });
    scene.add(new THREE.Mesh(hazeGeo, hazeMat)); disposables.push(hazeGeo, hazeMat);
    // The stars.
    const N = 2600, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(500 + Math.random() * 900);
      sp.set([v.x, v.y, v.z], i * 3);
      const k = 0.5 + Math.random() * 0.5, tint = Math.random();
      sc.set([k * (0.8 + 0.2 * tint), k * 0.82, k], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(sg, sm)); disposables.push(sg, sm);
    // The black sphere, its glow, its ring.
    const glowTex = (() => { const c = doc.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); const gr = x.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, "rgba(220,190,255,1)"); gr.addColorStop(0.3, "rgba(150,90,255,0.6)"); gr.addColorStop(1, "rgba(40,10,90,0)"); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(300); glow.position.copy(sphereAt); scene.add(glow); disposables.push(glowTex, glow.material);
    const ringGeo = new THREE.RingGeometry(46, 118, 96, 1);
    const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vP;
        void main(){ float r = length(vP), a = atan(vP.y, vP.x); float k = clamp((r - 46.0) / 72.0, 0.0, 1.0);
          float bands = 0.6 + 0.4 * sin(r * 0.55 - uTime * 2.0 + a * 3.0);
          float f = pow(1.0 - k, 1.6) * smoothstep(0.0, 0.08, k) * bands;
          vec3 c = mix(vec3(1.0, 0.95, 1.0), vec3(0.55, 0.3, 1.0), k);
          gl_FragColor = vec4(c * f * 1.4, 1.0); }` });
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.copy(sphereAt); ring.rotation.x = 1.22; scene.add(ring); disposables.push(ringGeo, ringMat);
    const ballGeo = new THREE.SphereGeometry(40, 48, 32), ballMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const ball = new THREE.Mesh(ballGeo, ballMat); ball.position.copy(sphereAt); scene.add(ball); disposables.push(ballGeo, ballMat);
    // Dust streaking past while pulled.
    const D = 260, dp = new Float32Array(D * 6);
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    const dm = new THREE.LineBasicMaterial({ color: 0xb9a2ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const dl = new THREE.LineSegments(dg, dm); dl.frustumCulled = false; scene.add(dl); disposables.push(dg, dm);
    dust = { dl, dp, pts: Array.from({ length: D }, () => new THREE.Vector3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 80, -Math.random() * 400)) };
    // The figure.
    figMat = new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: RIM_FRAG, uniforms: { uLight: { value: new THREE.Vector3(0, 0, -1) }, uGlow: { value: 1 } } });
    fig = buildFigure(figMat);
    disposables.push(figMat, ...fig.geos);
    scene.add(fig.fig);
    scene.userData = { hazeMat, ringMat, ring };
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

  const figPos = new THREE.Vector3(), camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  let lastNow = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now(), s = now - t0 + skipMs, dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
    lastNow = now;
    const T1 = s / 1000;
    // The pull: from just ahead of you, away toward the sphere, fast and
    // then slowing; then floating, drifting.
    const p = clamp01(s / T.pull[1]);
    const dist = 26 + 210 * (1 - Math.pow(1 - p, 3)) + 4 * Math.max(0, T1 - T.pull[1] / 1000);
    figPos.set(Math.sin(T1 * 0.4) * 3, -3 + 2 * Math.sin(T1 * 0.31), -dist);
    fig.fig.position.copy(figPos);
    // Chest first: leaning into the pull, tumbling slowly once it eases.
    const ease = smooth((s - 2500) / 6000);
    fig.fig.rotation.set(-0.95 + 0.25 * ease + 0.05 * Math.sin(T1 * 0.7), 0.25 * Math.sin(T1 * 0.23) * ease + Math.PI, 0.18 * Math.sin(T1 * 0.37) + 0.35 * ease * Math.sin(T1 * 0.13));
    pose(fig, T1, 1 - 0.6 * ease);
    // The camera: behind, low, following; easing round as it floats.
    const lag = 14 + 22 * smooth(s / 4000) + 10 * ease;
    const orbit = 0.5 * ease * Math.sin(T1 * 0.08);
    camPos.set(figPos.x + Math.sin(orbit) * lag, figPos.y - 4 + 6 * ease, figPos.z + Math.cos(orbit) * lag);
    if (s < 1800) camPos.x += (Math.random() - 0.5) * (1 - s / 1800) * 1.5;
    camera.position.copy(camPos);
    tmp.copy(figPos).lerp(sphereAt, 0.15 + 0.25 * ease);
    camera.lookAt(tmp);
    // The light on the figure: from the sphere, in the camera's view.
    camera.updateMatrixWorld();
    tmp.copy(sphereAt).sub(figPos).normalize().transformDirection(camera.matrixWorldInverse);
    figMat.uniforms.uLight.value.copy(tmp);
    figMat.uniforms.uGlow.value = 0.9 + 0.2 * Math.sin(T1 * 1.3);
    scene.userData.hazeMat.uniforms.uTime.value = T1;
    scene.userData.ringMat.uniforms.uTime.value = T1;
    scene.userData.ring.rotation.z = T1 * 0.05;
    // The dust: past the camera at the pull's speed.
    const speed = 160 * (1 - p) + 4;
    for (let i = 0; i < dust.pts.length; i++) {
      const d = dust.pts[i];
      d.z += speed * dt * 1.4;
      if (d.z > camPos.z + 10) { d.z = camPos.z - 300 - Math.random() * 200; d.x = camPos.x + (Math.random() - 0.5) * 120; d.y = camPos.y + (Math.random() - 0.5) * 80; }
      const len = 0.5 + speed * 0.06;
      dust.dp.set([d.x, d.y, d.z, d.x, d.y, d.z - len], i * 6);
    }
    dust.dl.geometry.attributes.position.needsUpdate = true;
    dust.dl.material.opacity = 0.15 + 0.5 * (1 - p);
    // The white going off it.
    if (veil) veil.style.opacity = String(1 - smooth((s - T.unveil[0]) / (T.unveil[1] - T.unveil[0])));
    // The words, one at a time.
    words.forEach((w, i) => {
      const a = s - (T.words + i * T.wordEach);
      w.classList.toggle("on", a > 0 && a < T.wordEach - 1300);
    });
    if (s >= MENU_AT && stage === "void") openMenu();
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
    words = []; veil = null; stage = stage === "leaving" ? "done" : stage;
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
    state: () => ({ stage, t: stage === "idle" ? 0 : performance.now() - t0 + skipMs, line: words.findIndex((w) => w.classList.contains("on")) + 1, menuAt: MENU_AT }),
    // Test-only: on by ms.
    skip(ms) { skipMs += ms; },
    dispose() {
      sound(false);
      teardown();
      if (styleEl) { styleEl.remove(); styleEl = null; }
    },
  };
}
