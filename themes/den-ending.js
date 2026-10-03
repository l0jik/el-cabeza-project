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
  "\u2026it's **not** 42!",
  "It never was!!",
  "It's El Cabeza........",
  "....It was.....*always*...... El Cabeza.",
];
const md = (line) => line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");

/* How a line comes in (user: more dramatic, but not gauche): not all at
   once, but as it would be said, a phrase at a time. Each word condenses
   out of a blur of light; each dot of an ellipsis on its own, a breath
   apart; and after a run of dots, or a "!" or a ",", a pause, longer the
   longer the run. Returns the line's HTML: the spaces plain, every word
   and dot a <span class="ph"> with its own delay (--d, ms). */
const REVEAL_SPAN = 2000;   // the last word starts by this (it shows ~3.4 s)
function reveal(line) {
  const esc = (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] || c;
  const units = []; let em = false, strong = false, t = 0;
  for (let i = 0; i < line.length;) {
    if (line.startsWith("**", i)) { strong = !strong; i += 2; continue; }
    if (line[i] === "*") { em = !em; i++; continue; }
    const c = line[i];
    if (/\s/.test(c)) { let j = i; while (j < line.length && /\s/.test(line[j])) j++; units.push({ space: line.slice(i, j) }); i = j; continue; }
    if (c === "." || c === "\u2026") {
      // A run of dots: each its own, then the pause (a lone "." ends a sentence).
      let j = i; while (j < line.length && (line[j] === "." || line[j] === "\u2026")) j++;
      for (let k = i; k < j; k++) { units.push({ text: line[k], at: t, em, strong, dot: true }); t += line[k] === "\u2026" ? 150 : 55; }
      if (j - i > 1 || c === "\u2026") t += 240;
      i = j; continue;
    }
    let j = i; while (j < line.length && !/[\s.\u2026*]/.test(line[j])) j++;
    const w = line.slice(i, j);
    units.push({ text: w, at: t, em, strong }); t += 80;
    if (/[!,]$/.test(w) && /\s/.test(line[j] || "")) t += w.endsWith("!") ? 320 : 200;
    i = j;
  }
  const last = Math.max(1, ...units.filter((u) => u.text).map((u) => u.at));
  const k = Math.min(1, REVEAL_SPAN / last);
  return units.map((u) => {
    if (u.space) return u.space;
    let h = `<span class="ph${u.dot ? " dot" : ""}" style="--d:${Math.round(u.at * k)}ms">${u.text.replace(/[&<>]/g, esc)}</span>`;
    if (u.em) h = `<em>${h}</em>`;
    if (u.strong) h = `<strong>${h}</strong>`;
    return h;
  }).join("");
}

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
/* Then, on the black (user: like the opening of Star Wars, in neon blue):
   the last words crawl up and away into the dark, at an even pace, and
   only when they're gone does the switcher come. No skipping it. */
const CRAWL = [BLACK[1] + 1500, BLACK[1] + 1500 + 34000];
const MENU_AT = CRAWL[1] + 700;
const CRAWL_TEXT = [
  "The story's over.",
  "Every version of the game is here. Pick one, or stay in the den, because...",
  "...no matter where you are, *El Cabeza* will always be with you...",
  "It always has been.",
];

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
.den-ending .word.on { opacity: 1; transition: opacity 0.25s ease; }
/* Each word out of a blur of light, a little large, settling into place;
   brighter for a moment as it lands. (On "on": taken off, the line just
   fades as a whole.) */
.den-ending .word .ph { display: inline-block; }
.den-ending .word.on .ph { animation: den-ending-ph 1.5s cubic-bezier(0.22, 0.61, 0.24, 1) var(--d, 0ms) both; }
.den-ending .word.on .ph.dot { animation-duration: 1.1s; }
@keyframes den-ending-ph {
  0% { opacity: 0; filter: blur(9px); transform: translateY(0.18em) scale(1.08); text-shadow: 0 0 30px rgba(170,200,255,0.9), 0 2px 10px rgba(0,0,0,0); }
  38% { opacity: 1; filter: blur(1.5px); text-shadow: 0 0 26px rgba(190,215,255,0.95), 0 2px 10px rgba(0,0,0,0.5); }
  100% { opacity: 1; filter: blur(0); transform: none; text-shadow: 0 0 18px rgba(110,160,255,0.7), 0 2px 10px rgba(0,0,0,0.85); }
}
/* Behind the line, a faint light swelling as it begins, then settling. */
.den-ending .word::before { content: ""; position: absolute; left: -12%; right: -12%; top: -70%; bottom: -70%; z-index: -1; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(120,160,255,0.2), rgba(120,160,255,0.07) 45%, rgba(120,160,255,0) 72%); }
.den-ending .word.on::before { animation: den-ending-glow 3.2s ease-out both; }
@keyframes den-ending-glow { 0% { opacity: 0; transform: scale(0.7, 0.5); } 28% { opacity: 1; } 100% { opacity: 0.4; transform: scale(1, 1); } }
@media (prefers-reduced-motion: reduce) { .den-ending .word.on .ph, .den-ending .word.on::before { animation: none; } }
.den-ending.off { transition: opacity 1.2s ease; opacity: 0; }
/* The crawl: a plane tilted back into the dark, the words on it in neon
   blue, justified, the last line on its own; dissolving into the black as
   they go (the mask), not cut off. */
.den-ending .crawl { position: absolute; inset: 0; overflow: hidden; pointer-events: none; display: none; opacity: 0;
  perspective: 300px; perspective-origin: 50% 0%;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 16%, #000 46%); mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 16%, #000 46%); }
.den-ending .crawl.on { display: block; }
.den-ending .crawl .plane { position: absolute; left: 50%; bottom: 0; height: 100%; width: min(84vw, 600px); transform-origin: 50% 100%; transform: translateX(-50%) rotateX(24deg); }
.den-ending .crawl .text { position: absolute; left: 0; right: 0; top: 100%; will-change: transform;
  color: #6fd6ff; font: 600 clamp(19px, 5vw, 34px)/1.42 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.02em;
  text-align: justify; hyphens: none; text-shadow: 0 0 6px rgba(80,200,255,0.75), 0 0 22px rgba(30,130,255,0.55); }
.den-ending .crawl .text p { margin: 0 0 1.1em; }
.den-ending .crawl .text p.last { text-align: center; margin-top: 2.2em; font-weight: 500; }
.den-ending .crawl .text em { font-style: italic; }
`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/* ---- the figure ---- */
// (The tidal stretch: along the way to the sphere (uDir) from the body's
// middle (uCenter), drawn out; across it, squeezed; a slow waver.)
const RIM_VERT = `uniform vec3 uCenter, uDir; uniform float uStretch, uTime; attribute vec3 rest; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vR;
void main(){
  vR = rest;
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
/* The wireframe under it: lines of light, flickering a little. Drawn on
   the one skin, not its triangles (user: seamless): a lattice of fine
   lines where the body, as it was at rest, crosses evenly spaced planes,
   rings round it and lines down it, so they ride with it as it moves,
   about a pixel wide whatever the distance. */
const WIRE_FRAG = `uniform float uWire, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vR;
void main(){
  vec3 q = vR * vec3(1.5, 2.1, 1.5);
  vec3 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec3(1e-4));
  float l = clamp(1.15 - min(min(g.x, g.y), g.z), 0.0, 1.0);
  if (l < 0.01) discard;
  float f = 0.75 + 0.25 * sin(uTime * 9.0 + vW.y * 0.7);
  gl_FragColor = vec4(vec3(0.25, 0.6, 1.0) * uWire * f * 0.36 * l, 1.0); }`;
/* The plasma coming off them (user: not snow or glitter: diaphanous,
   nebulous, gauzy, gossamer, vaporous): veils, not motes. Each is a soft
   panel facing the camera, large and very faint, with no edge of its own:
   drifting noise inside a wide soft falloff, stretched a little along its
   own angle, and a few fine filaments through it (the gossamer). They
   overlap into a haze. (Instanced quads, not points: a point that big
   isn't drawn on every phone.) */
const WISP_VERT = `attribute vec3 iPos; attribute float iSize, iAlpha, iSeed, iAng;
varying vec2 vP; varying float vA, vSeed;
void main(){ vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float c = cos(iAng), s = sin(iAng); vec2 q = position.xy * vec2(1.7, 1.0);
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y) * iSize;
  vP = position.xy; vA = iAlpha; vSeed = iSeed; gl_Position = projectionMatrix * mv; }`;
const WISP_FRAG = `uniform float uTime; varying vec2 vP; varying float vA, vSeed;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
void main(){
  vec2 p = vP * 2.0;
  float fall = 1.0 - smoothstep(0.15, 1.0, length(p));
  if (fall <= 0.0) discard;
  vec2 o = vec2(vSeed * 7.13, vSeed * 3.71) + vec2(uTime * 0.07, -uTime * 0.05);
  float n = fbm(p * 1.6 + o);
  float mist = smoothstep(0.32, 0.78, n) * fall * fall;
  float fil = pow(1.0 - abs(2.0 * fbm(p * vec2(4.5, 1.4) + o * 1.7) - 1.0), 9.0) * fall;
  float a = (mist + 0.45 * fil) * vA;
  gl_FragColor = vec4(mix(vec3(0.42, 0.55, 1.0), vec3(0.85, 0.92, 1.0), mist) * a, 1.0); }`;

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

/* The body (user: one seamless mesh, smooth joints, not a wooden doll;
   still alive, floating): one skin over a skeleton. The skeleton is the
   same jointed groups the pose moves (shoulders and hips `j`, elbows and
   knees `k`, the head); the skin is the smooth union of the body's parts
   (soft ellipsoids and tapering limbs, blended where they meet) as a
   distance field, made into one closed surface (surface nets, each vertex
   settled onto the surface), in a rest pose with the arms and legs a
   little out. Each vertex follows the bones it's near (weights from how
   far it is from each bone's own part, so a joint bends as one smooth
   skin), skinned each frame (skin()). `rest`: each vertex's rest
   position, for the wireframe's lines, which stay on the body. */
const SKIN_CELL = 0.17, SKIN_SIGMA = 0.32;
// The skeleton in its rest pose, and the body's parts round it.
function figRig() {
  const fig = new THREE.Group();
  const headG = new THREE.Group(); headG.position.set(0, 9.4, 0); fig.add(headG);
  const limb = (at, len1, bend) => {
    const j = new THREE.Group(); j.position.copy(at); fig.add(j);
    const k = new THREE.Group(); k.position.set(0, -len1, 0); k.rotation.x = bend; j.add(k);
    return { j, k };
  };
  const ARM = [3.9, 3.6, 0.62, 0.5, 0.4], LEG = [5.6, 5.3, 0.95, 0.68, 0.5];
  const arms = [-1, 1].map((s) => limb(new THREE.Vector3(s * 2.55, 7.1, 0), ARM[0], 0));
  const legs = [-1, 1].map((s) => limb(new THREE.Vector3(s * 1.15, -0.4, 0), LEG[0], 0));
  // The rest pose: arms out and down, legs a little apart, straight.
  [arms, legs].forEach((set, li) => set.forEach(({ j }, i) => {
    const s = i ? 1 : -1;
    j.quaternion.setFromUnitVectors(Y_DOWN, new THREE.Vector3(s * (li ? 0.1 : 0.8), li ? -1 : -0.6, 0).normalize());
  }));
  fig.updateMatrixWorld(true);
  const bones = [fig, headG, arms[0].j, arms[0].k, arms[1].j, arms[1].k, legs[0].j, legs[0].k, legs[1].j, legs[1].k];
  const restInv = bones.map((b) => (b === fig ? new THREE.Matrix4() : b.matrixWorld.clone().invert()));
  // The parts, as distance functions in the body's rest frame, each with
  // its bone.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // (Each with its bounds, a box, so a point far from it needn't ask it.)
  const ell = (inv, c, r) => Object.assign((x, y, z) => {
    const e = inv.elements;
    const px = e[0] * x + e[4] * y + e[8] * z + e[12] - c.x, py = e[1] * x + e[5] * y + e[9] * z + e[13] - c.y, pz = e[2] * x + e[6] * y + e[10] * z + e[14] - c.z;
    const k0 = Math.hypot(px / r.x, py / r.y, pz / r.z), k1 = Math.hypot(px / (r.x * r.x), py / (r.y * r.y), pz / (r.z * r.z));
    return k1 > 1e-6 ? (k0 * (k0 - 1)) / k1 : -Math.min(r.x, r.y, r.z);
  }, { box: (() => { const w = c.clone().applyMatrix4(inv.clone().invert()), R = Math.max(r.x, r.y, r.z); return [w.x - R, w.y - R, w.z - R, w.x + R, w.y + R, w.z + R]; })() });
  const cone = (a, b, r1, r2) => { const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, bb = bx * bx + by * by + bz * bz, R = Math.max(r1, r2);
    return Object.assign((x, y, z) => { const t = Math.max(0, Math.min(1, ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / bb));
      return Math.hypot(x - a.x - bx * t, y - a.y - by * t, z - a.z - bz * t) - (r1 + (r2 - r1) * t); },
    { box: [Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R] }); };
  const I = new THREE.Matrix4();
  const at = (o, x, y, z) => V(x, y, z).applyMatrix4(o.matrixWorld);
  const parts = [   // [bone, fn, blend]
    [0, ell(I, V(0, 0.5, 0), V(2.25, 1.6, 1.35)), 0],      // hips
    [0, ell(I, V(0, 3.1, 0), V(2.15, 2.4, 1.28)), 1.1],    // waist
    [0, ell(I, V(0, 5.6, 0), V(2.75, 2.2, 1.62)), 1.1],    // chest
    [0, ell(I, V(0, 7.5, 0), V(2.1, 0.85, 1.15)), 0.8],    // shoulders
    [1, cone(V(0, 7.9, 0), V(0, 10.1, 0.05), 0.74, 0.62), 0.6],  // neck
    [1, ell(restInv[1], V(0, 1.3, 0.05), V(1.35, 1.6, 1.45)), 0.5],  // head
  ];
  [[arms, ARM, (k) => ell(restInv[bones.indexOf(k)], V(0, -ARM[1] - 0.55, 0), V(0.44, 0.78, 0.27)), 0.22],
   [legs, LEG, (k) => ell(restInv[bones.indexOf(k)], V(0, -LEG[1] - 0.2, 0.5), V(0.52, 0.38, 1.25)), 0.3]].forEach(([set, L, end, eb]) => set.forEach(({ j, k }) => {
    const J = at(j, 0, 0, 0), K = at(k, 0, 0, 0), E = at(k, 0, -L[1], 0);
    parts.push([bones.indexOf(j), cone(J, K, L[2], L[3]), 0.7]);
    parts.push([bones.indexOf(k), cone(K, E, L[3], L[4]), 0.25]);
    parts.push([bones.indexOf(k), end(k), eb]);
  }));
  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // (Far from every part, just "outside": only the sign matters there.)
  const PAD = 1.4, BX = parts.map(([, fn]) => fn.box);
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < parts.length; i++) {
      const b = BX[i];
      if (x < b[0] - PAD || y < b[1] - PAD || z < b[2] - PAD || x > b[3] + PAD || y > b[4] + PAD || z > b[5] + PAD) continue;
      d = smin(d, parts[i][1](x, y, z), parts[i][2]);
    }
    return d > PAD ? PAD : d;
  };
  return { fig, headG, arms, legs, bones, restInv, parts, sdf };
}
/* The skin (the same every time, so made once and kept): built a slice at
   a time (a generator), so it can be made ahead, in moments the page is
   idle (prewarmFigure, while the hall's choice is up), or all at once. */
function* skinData({ parts, sdf, bones }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // The surface (surface nets over a grid round the rest pose).
  const lo = V(-9.6, -12.6, -2.4), h = SKIN_CELL;
  const nx = Math.ceil(19.2 / h) + 1, ny = Math.ceil(25.6 / h) + 1, nz = Math.ceil(5.6 / h) + 1;
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = sdf(lo.x + i * h, lo.y + j * h, lo.z + k * h); yield; }
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cv[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    cellV[cid(i, j, k)] = pos.length / 3;
    pos.push(lo.x + (i + sx / n) * h, lo.y + (j + sy / n) * h, lo.z + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if (i < nx - 1 && f0 !== (F[id(i + 1, j, k)] < 0)) quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], !f0);
    if (j < ny - 1 && f0 !== (F[id(i, j + 1, k)] < 0)) quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i - 1, j, k)], cellV[cid(i, j, k)], cellV[cid(i, j, k - 1)], !f0);
    if (k < nz - 1 && f0 !== (F[id(i, j, k + 1)] < 0)) quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], !f0);
  }
  // Each vertex settled onto the surface; its normal from the field.
  const N = pos.length / 3, rest = new Float32Array(pos), nrm = new Float32Array(N * 3), e = 0.03;
  const grad = (x, y, z) => [sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)];
  for (let v = 0; v < N; v++) {
    if (v % 1500 === 0) yield;
    let x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
    for (let it = 0; it < 2; it++) { const d = sdf(x, y, z), g = grad(x, y, z), gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]; if (gg < 1e-9) break; const s = (d * 2 * e) / gg; x -= g[0] * s; y -= g[1] * s; z -= g[2] * s; }
    rest[v * 3] = x; rest[v * 3 + 1] = y; rest[v * 3 + 2] = z;
    const g = grad(x, y, z), gl = Math.hypot(g[0], g[1], g[2]) || 1;
    nrm[v * 3] = g[0] / gl; nrm[v * 3 + 1] = g[1] / gl; nrm[v * 3 + 2] = g[2] / gl;
  }
  // The weights: up to three bones a vertex, by nearness to each bone's
  // own part(s).
  const NB = 3, wb = new Uint8Array(N * NB), ww = new Float32Array(N * NB), dB = new Float32Array(bones.length);
  for (let v = 0; v < N; v++) {
    if (v % 3000 === 0) yield;
    const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
    dB.fill(1e9);
    parts.forEach(([b, fn]) => { dB[b] = Math.min(dB[b], fn(x, y, z)); });
    const w = Array.from(dB, (d, b) => [Math.exp(-Math.pow(Math.max(0, d) / SKIN_SIGMA, 2)), b]).sort((p, q) => q[0] - p[0]).slice(0, NB);
    const sum = w.reduce((s, p) => s + p[0], 0) || 1;
    w.forEach(([wt, b], c) => { wb[v * NB + c] = b; ww[v * NB + c] = wt / sum; });
  }
  return { N, NB, rest, nrm, idx, wb, ww };
}
let FIG_DATA = null, FIG_GEN = null;
function figData() {
  if (FIG_DATA) return FIG_DATA;
  if (!FIG_GEN) FIG_GEN = skinData(figRig());
  let r; while (!(r = FIG_GEN.next()).done);
  FIG_DATA = r.value; FIG_GEN = null;
  return FIG_DATA;
}
export function prewarmFigure() {
  if (FIG_DATA || FIG_GEN) return;
  FIG_GEN = skinData(figRig());
  const step = () => {
    if (FIG_DATA || !FIG_GEN) return;
    const end = performance.now() + 6;
    while (performance.now() < end) { const r = FIG_GEN.next(); if (r.done) { FIG_DATA = r.value; FIG_GEN = null; return; } }
    setTimeout(step, 24);
  };
  setTimeout(step, 0);
}
function buildFigure(mat) {
  const { fig, headG, arms, legs, bones, restInv } = figRig();
  const { N, NB, rest, nrm, idx, wb, ww } = figData();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rest), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nrm), 3));
  geo.setAttribute("rest", new THREE.BufferAttribute(rest, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const body = new THREE.Mesh(geo, mat); body.frustumCulled = false; fig.add(body);
  // Skinned, each frame, to wherever the pose has put the bones.
  const M = new Float32Array(bones.length * 12), figInv = new THREE.Matrix4(), bm = new THREE.Matrix4();
  const P = geo.attributes.position.array, Nn = geo.attributes.normal.array;
  function skin() {
    fig.updateMatrixWorld(true);
    figInv.copy(fig.matrixWorld).invert();
    bones.forEach((b, i) => {
      if (b === fig) bm.identity(); else bm.multiplyMatrices(figInv, b.matrixWorld).multiply(restInv[i]);
      const el = bm.elements; M.set([el[0], el[1], el[2], el[4], el[5], el[6], el[8], el[9], el[10], el[12], el[13], el[14]], i * 12);
    });
    for (let v = 0; v < N; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2], nx0 = nrm[v * 3], ny0 = nrm[v * 3 + 1], nz0 = nrm[v * 3 + 2];
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
      for (let c = 0; c < NB; c++) {
        const w = ww[v * NB + c]; if (w < 1e-4) continue;
        const o = wb[v * NB + c] * 12;
        px += w * (M[o] * x + M[o + 3] * y + M[o + 6] * z + M[o + 9]);
        py += w * (M[o + 1] * x + M[o + 4] * y + M[o + 7] * z + M[o + 10]);
        pz += w * (M[o + 2] * x + M[o + 5] * y + M[o + 8] * z + M[o + 11]);
        qx += w * (M[o] * nx0 + M[o + 3] * ny0 + M[o + 6] * nz0);
        qy += w * (M[o + 1] * nx0 + M[o + 4] * ny0 + M[o + 7] * nz0);
        qz += w * (M[o + 2] * nx0 + M[o + 5] * ny0 + M[o + 8] * nz0);
      }
      P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz;
      const ql = Math.hypot(qx, qy, qz) || 1;
      Nn[v * 3] = qx / ql; Nn[v * 3 + 1] = qy / ql; Nn[v * 3 + 2] = qz / ql;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
  }
  return { fig, geos: [geo], arms, legs, headG, meshes: [body], skin, verts: N };
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
const PAD_URL = "el-cabeza-den-void-pad.mp3", PAD_LEVEL = 1.1;

function impulse(ctx, secs, decay) {
  const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

export function createEnding({ audio, onFinish, onPick, onStay }) {
  const doc = typeof document !== "undefined" ? document : null;
  let root = null, canvas = null, veil = null, dark = null, words = [], styleEl = null, crawl = null, crawlText = null, crawlP = 0;
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
      /* The way out (user: it clipped on a phone): the hum and the pad
         together (mix), the fade, then on a phone everything under 120 Hz
         taken out (a phone's speaker can't play it, and it only drives
         the speaker into crunch), then a limiter, so nothing past it ever
         clips, whatever the device. */
      const phone = typeof window !== "undefined" && !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
      const mix = ctx.createGain(); mix.gain.value = 1;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -12; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.3;
      const post = ctx.createGain(); post.gain.value = phone ? 1.1 : 0.95;
      let tail = fade;
      if (phone) [0, 1].forEach(() => { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120; hp.Q.value = 0.707; tail.connect(hp); tail = hp; });
      mix.connect(fade); tail.connect(lim).connect(post);
      const meter = typeof window !== "undefined" && window.__EC_TEST_HOOKS__ ? { out: ctx.createAnalyser(), hum: ctx.createAnalyser(), pad: ctx.createAnalyser() } : null;
      if (meter) { Object.values(meter).forEach((an) => { an.fftSize = 4096; }); post.connect(meter.out); whole.connect(meter.hum); }
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
      whole.connect(mix); post.connect(o.ear);
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
      // (Not on a phone: it can't play it.)
      if (!phone) { const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 36.71; const sg = ctx.createGain(); sg.gain.value = 0.05;
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
      /* The pad (user's recording, from its 2-minute mark: the higher,
         evolving, heavenly part over the hum's low end): fetched, then
         faded up from a couple of seconds in, a little of it into the
         room's reverb too. (From disk, file:, there's no fetching: the
         hum alone there.) */
      const padG = ctx.createGain(); padG.gain.value = 0.0001;
      const padSend = ctx.createGain(); padSend.gain.value = 0.25;
      padG.connect(mix); padG.connect(padSend).connect(verb);
      if (meter) padG.connect(meter.pad);
      const c0 = { ctx, fade, whole, lp, verb, mix, voices, all, padG, padLevel: PAD_LEVEL, meter, phone, next: performance.now() + CHORD_MS, at: 0 };
      if (typeof location !== "undefined" && location.protocol !== "file:" && typeof fetch !== "undefined") {
        fetch(PAD_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((buf) => {
          if (chord !== c0) return;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const at = Math.max(ctx.currentTime + 0.05, t + 2);
          padG.gain.setValueAtTime(0.0001, at); padG.gain.exponentialRampToValueAtTime(PAD_LEVEL, at + 9);
          src.connect(padG); src.start(at); all.push(src); c0.padOn = true;
        }).catch(() => { /* the hum alone */ });
      }
      chord = c0;
    } else if (!on && chord) {
      const c = chord; chord = null;
      c.fade.gain.cancelScheduledValues(t); c.fade.gain.setValueAtTime(Math.max(0.0001, c.fade.gain.value), t); c.fade.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      setTimeout(() => c.all.forEach((x) => { try { x.stop(); } catch (e) { /* done */ } }), 14000);
    }
  }
  /* As each line begins, a quiet bloom high up, felt more than heard:
     an open fifth and its octave (A, E, A: at home in every chord here),
     one after another, swelling into the room's reverb and dying away. */
  function bloom() {
    if (!chord) return;
    const { ctx, verb, mix } = chord, t = ctx.currentTime;
    [[880, 0.03], [1318.51, 0.022], [1760, 0.012]].forEach(([f, peak], i) => {
      const at = t + 0.05 + i * 0.16;
      const os = ctx.createOscillator(); os.type = "sine"; os.frequency.value = f; os.detune.value = (Math.random() * 2 - 1) * 4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + 5);
      const dry = ctx.createGain(); dry.gain.value = 0.06;
      os.connect(g); g.connect(verb); g.connect(dry).connect(mix);
      os.start(at); os.stop(at + 5.2);
    });
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
    if (chord.padOn && k > 0.01) chord.padG.gain.setTargetAtTime(chord.padLevel * (1 + 1.2 * k * k), t, 0.25);
    chord.lp.frequency.setTargetAtTime(900 + 2400 * k * k, t, 0.25);
  }

  function build() {
    style();
    root = doc.createElement("div"); root.className = "den-ending"; root.setAttribute("data-testid", "den-ending");
    canvas = doc.createElement("canvas"); root.appendChild(canvas);
    REVELATION.forEach((line, i) => { const w = doc.createElement("div"); w.className = "word"; w.setAttribute("data-testid", `den-ending-line-${i + 1}`); w.setAttribute("role", "status"); w.innerHTML = reveal(line); root.appendChild(w); words.push(w); });
    dark = doc.createElement("div"); dark.className = "dark"; root.appendChild(dark);
    crawl = doc.createElement("div"); crawl.className = "crawl"; crawl.setAttribute("data-testid", "den-ending-crawl"); crawl.setAttribute("aria-live", "polite");
    crawlText = doc.createElement("div"); crawlText.className = "text";
    crawlText.innerHTML = CRAWL_TEXT.map((t, i) => `<p${i === CRAWL_TEXT.length - 1 ? ' class="last"' : ""}>${md(t)}</p>`).join("");
    const plane = doc.createElement("div"); plane.className = "plane"; plane.appendChild(crawlText); crawl.appendChild(plane); root.appendChild(crawl);
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
    const wireMat = new THREE.ShaderMaterial({ vertexShader: RIM_VERT, fragmentShader: WIRE_FRAG, uniforms: figU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, extensions: { derivatives: true } });
    disposables.push(wireMat);
    fig.meshes.forEach((m) => { const w = new THREE.Mesh(m.geometry, wireMat); w.renderOrder = 1; w.frustumCulled = false; m.add(w); });
    scene.add(fig.fig);
    // The plasma coming off them (user: the singularity's own wisps,
    // rising from the body more and more as they go into it): a pool of
    // motes, each born at a point on the body, drifting off and up in a
    // slow curl, growing, fading.
    {
      const N = 260, pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N), seed = new Float32Array(N), ang = new Float32Array(N);
      const base = new THREE.PlaneGeometry(1, 1);
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index; g.setAttribute("position", base.attributes.position);
      g.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
      g.setAttribute("iSize", new THREE.InstancedBufferAttribute(sz, 1));
      g.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(al, 1));
      g.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seed, 1));
      g.setAttribute("iAng", new THREE.InstancedBufferAttribute(ang, 1));
      g.instanceCount = N;
      const mat = new THREE.ShaderMaterial({ vertexShader: WISP_VERT, fragmentShader: WISP_FRAG, uniforms: { uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const veils = new THREE.Mesh(g, mat); veils.frustumCulled = false; veils.renderOrder = 2; scene.add(veils);
      disposables.push(base, g, mat);
      wisps = { N, pos, al, sz, seed, ang, g, mat, veils, p: Array.from({ length: N }, () => ({ life: 0, age: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ph: Math.random() * 6.28, size: 1, spin: 0, a0: 0 })), carry: 0, next: 0 };
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
    const rate = fig.fig.visible ? 1.5 + 18 * grow + 30 * m : 0;
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
      const sp = (0.8 + 1.2 * Math.random()) * shrink;
      p.vx = wv.x * sp + wc.x * 0.8; p.vy = wv.y * sp + 1.1 * shrink + wc.y * 0.8; p.vz = wv.z * sp + wc.z * 0.8;
      p.age = 0; p.life = 5 + 3.5 * Math.random(); p.size = (3 + 3.5 * Math.random()) * shrink; p.ph = Math.random() * 6.28;
      p.a0 = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 0.25;
      W.seed[(W.next + W.N - 1) % W.N] = Math.random() * 10;
    }
    W.carry = Math.min(W.carry, 3);
    for (let i = 0; i < W.N; i++) {
      const p = W.p[i];
      if (p.age >= p.life) { W.al[i] = 0; continue; }
      p.age += dt;
      const u = p.age / p.life, c = Math.sin(p.ph + p.age * 0.6) * 0.7;
      p.x += (p.vx + c) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(p.ph + p.age * 0.5) * 0.7) * dt;
      p.vx *= 1 - 0.15 * dt; p.vy *= 1 - 0.1 * dt; p.vz *= 1 - 0.15 * dt;
      W.pos[i * 3] = p.x; W.pos[i * 3 + 1] = p.y; W.pos[i * 3 + 2] = p.z;
      // (Comes up slowly, lingers, thins away; swells as it goes.)
      W.al[i] = Math.pow(Math.sin(Math.PI * Math.min(1, u)), 1.4) * 0.34;
      W.sz[i] = p.size * (1 + 1.6 * u);
      W.ang[i] = p.a0 + p.spin * p.age;
    }
    ["iPos", "iAlpha", "iSize", "iAng", "iSeed"].forEach((k) => { W.g.attributes[k].needsUpdate = true; });
    W.mat.uniforms.uTime.value = s / 1000;
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
    if (fig.fig.visible) fig.skin();
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
      const on = a > 0 && a < hold - 1300;
      if (on && !w.classList.contains("on") && stage === "void") bloom();
      w.classList.toggle("on", on);
    });
    if (s >= BLACK[1] && stage === "void") { stage = "black"; sound(false); }
    // The crawl, at an even pace from below the screen to far off in the
    // dark (its last line just gone into the distance as it ends).
    if (crawl && stage === "black" && s >= CRAWL[0]) {
      crawl.classList.add("on");
      crawlP = clamp01((s - CRAWL[0]) / (CRAWL[1] - CRAWL[0]));
      const vh = crawl.clientHeight || 600, H = crawlText.offsetHeight || 400;
      crawlText.style.transform = `translateY(${-crawlP * (H + vh * 0.8)}px)`;
      crawl.style.opacity = String(smooth((s - CRAWL[0]) / 900));
    }
    if (s >= MENU_AT && stage === "black") { if (crawl) crawl.classList.remove("on"); openMenu(); }
    // (Under the black, nothing to draw.)
    if (renderer && s < BLACK[1] + 300) renderer.render(scene, camera);
  }
  function openMenu() {
    stage = "menu";
    if (!finished) { finished = true; if (onFinish) onFinish(); }
    menu = createRealitiesMenu({
      title: "Other realities",
      // (Its words were the crawl: here, quiet, just the choices.)
      sub: "",
      currentId: "den",
      // (A moment first: taps made during the crawl mustn't land on a
      // world as it comes, user.)
      lockMs: typeof window !== "undefined" && typeof window.__EC_TEST_REALITIES_LOCK__ === "number" ? window.__EC_TEST_REALITIES_LOCK__ : 2200,
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
    words = []; veil = null; dark = null; crawl = null; crawlText = null; stage = stage === "leaving" ? "done" : stage;
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
    state: () => ({ stage, pixelRatio, look: { yaw: look.yaw, pitch: look.pitch }, t: stage === "idle" ? 0 : performance.now() - t0 + skipMs, line: words.findIndex((w) => w.classList.contains("on")) + 1, menuAt: MENU_AT, crawlAt: CRAWL[0], crawl: crawlP, mergeAt: MERGE[0], figure: fig ? fig.fig.visible : null, solid: figMat ? figMat.uniforms.uSolid.value : null, level: chord ? chord.fade.gain.value * chord.whole.gain.value : 0, wisps: wisps ? wisps.al.reduce((n, a) => n + (a > 0 ? 1 : 0), 0) : 0 }),
    // Test-only: on by ms.
    skip(ms) { skipMs += ms; },
    // Test-only: the sound's peak and loudness (dBFS) out of the scene, and the hum's and the pad's.
    meter() {
      if (!chord || !chord.meter) return null;
      const read = (an) => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let pk = 0, ss = 0; for (const v of d) { pk = Math.max(pk, Math.abs(v)); ss += v * v; } return { peak: 20 * Math.log10(pk + 1e-9), rms: 10 * Math.log10(ss / d.length + 1e-12) }; };
      return { out: read(chord.meter.out), hum: read(chord.meter.hum), pad: read(chord.meter.pad), padOn: !!chord.padOn, phone: chord.phone };
    },
    dispose() {
      sound(false);
      teardown();
      if (styleEl) { styleEl.remove(); styleEl = null; }
    },
  };
}
