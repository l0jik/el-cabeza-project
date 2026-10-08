/* The hall (user): home from the closed Big Glutts, the game goes on; four
   moves in, the hallway doorway starts throwing out light, flashing,
   bizarre, with slow booms like the thunder when Neon first came (the
   summons). The camera goes over to look at the doorway on its own;
   "Oh no… now what?"; and a choice: Investigate, or Just keep playing
   (this day's been weird enough already), in which case it dies down and
   comes back a few moves later.

   Investigating: the camera walks you (steps, sway, footsteps) to the
   doorway, through it, and round to the right, down the hall, where it's
   died down to a glow round a small rift hanging in the air, enough to
   feel safe going nearer; then all of a sudden it goes crazy again, to
   white (onEnding: den-ending.js, the void). The second time it comes
   (having kept playing) it's "Oh, for the love of…"; the third, no choice:
   you're dragged in, faster, straight on to the eruption (user). The
   count's kept with the story (`flares`: { get, set }). Moves count
   across games (user: a game that ended between the second time and the
   third left it stuck in the den: the count was the game's own move log,
   which a new game starts over, so it waited for a number the new game
   hadn't reached), and the second time's "Let me just finish one game!"
   is taken at its word: that game's end brings the third, a moment
   after (ctx.over).

   The den's lighting is baked, so the light here is drawn: a swirl filling
   the doorway, its spill on the floor, the wall round the door and the
   ceiling, sparks drifting out into the room, a flash over the whole
   screen; and in the hall, the rift and its glow. The sound is made here
   (the den's phoneOutput: straight to the master): booms, a hum, crackle,
   the roar at the end.

   createHall({ audio, onEnding, flares }) -> { arm(moves), tick(now, t, den, ctx),
   placeCamera(camera, t, den), state(), dispose() }. den-fx.js runs it. */

import * as THREE from "three";
import { FLOOR, CEIL, RZ, HALL } from "./den-room.js";

const FIRST_AFTER = 4;   // moves after coming home (user: at least four)
const CHOICE_HOLD_MS = 1500; // the choice takes no tap till then (wild taps; user)
const AGAIN_AFTER = 3;   // after "just keep playing": a few moves later
const OVER_HOLD_MS = 2000; // after "finish one game", its end: a moment, then the third
const LINE = "Oh no… now what?";
// ...and when it comes back, having kept playing (user).
const LINE_AGAIN = "Oh, for the love of…";
const INVESTIGATE = "Investigate";
const KEEP = "Just keep playing — this day's been weird enough already";
// ...and the second time (user).
const KEEP_AGAIN = "I should probably call an electrician about that tomorrow. Let me just finish one game!";

const DC = (HALL.DX0 + HALL.DX1) / 2, DW = HALL.DX1 - HALL.DX0, DH = HALL.DH;
const EY = FLOOR + 31; // eye height standing (8 ft = 49)
const RIFT = new THREE.Vector3(HALL.HX0 + 7, FLOOR + 24, RZ + 26);
// Looking at the doorway from the room, and the walk in.
const LOOK = { eye: new THREE.Vector3(34, FLOOR + 37, 22), at: new THREE.Vector3(DC, FLOOR + 19, RZ + 6) };
/* The walk in (user: the old one flew from point to point, stopping at
   each and turning on the spot, "stilted"; walk instead): one smooth path
   through these points, from wherever the camera is (the look at the
   doorway) down to standing eye height, across the floor, through the
   doorway, curving right along the hall toward the rift and a few steps
   nearer it, at a walking pace (easing off at the start and the end), the
   head looking where it's going and turning toward the rift as the path
   does, a step's rise and sway, and the footsteps. */
const PATH = [
  new THREE.Vector3(52, EY, 44),
  new THREE.Vector3(67, EY, 66),
  new THREE.Vector3(69, EY, 86),        // the doorway
  new THREE.Vector3(69.5, EY, 102),
  new THREE.Vector3(67.5, EY, 110.5),   // turning right
  new THREE.Vector3(64.5, EY - 0.6, 113.5), // a few steps nearer the rift
];
const WALK_END = 10200;                 // ms from the click: standing still there
// A step, in the den's units: about 22 in, a grown-up's careful step, ten
// of them down to the rift at about 64 a minute (user: "longer, fewer
// strides"; at 4.6, about 9 in, it was 23 at 153 a minute, "like a
// child walking").
const STRIDE = 11;
const CALM_UNTIL = 12600, ERUPT_MS = 3600; // then the eruption, to white
const ENDING_AT = CALM_UNTIL + ERUPT_MS;
/* The dolly zoom (user: dolly in, zoom out, on the rip before you're
   taken): from standing there, the camera goes in on the rift while the
   lens widens just as fast, so the rift holds its size and the hall
   round it stretches away; the white comes over its last moments. */
const DOLLY = [12000, 15800], DOLLY_IN = 0.62, DOLLY_MAX_FOV = 118;

const CSS = `
.den-hall-flash { position: fixed; inset: 0; z-index: 1335; pointer-events: none; opacity: 0; mix-blend-mode: screen;
  background: radial-gradient(ellipse at 68% 58%, rgba(176,204,255,0.95), rgba(80,120,255,0.32) 45%, rgba(20,40,100,0) 75%); }
.den-hall-white { position: fixed; inset: 0; z-index: 1345; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #eef4ff 55%, #dbe6ff 100%); }
.den-hall-block { position: fixed; inset: 0; z-index: 1330; background: transparent; }
.den-hall-say { position: fixed; left: 7%; bottom: 30%; z-index: 1350; max-width: min(78vw, 420px); padding: 14px 20px 15px; background: #fffdf6;
  color: #1d1610; border: 3px solid #1d1610; border-radius: 22px; box-shadow: 4px 5px 0 rgba(0,0,0,0.35); pointer-events: none;
  font: 400 clamp(24px, 6.4vw, 36px)/1.12 'Patrick Hand', 'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', cursive;
  opacity: 0; transform: scale(0.6) rotate(-2deg); transform-origin: 12% 110%; transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.2, 1.6, 0.4, 1); }
.den-hall-say::after { content: ""; position: absolute; left: 28px; bottom: -22px; width: 26px; height: 24px; background: #fffdf6;
  border-left: 3px solid #1d1610; border-bottom: 3px solid #1d1610; transform: skewX(-28deg) rotate(-12deg); border-bottom-left-radius: 6px; }
.den-hall-say.on { opacity: 1; transform: scale(1) rotate(-2deg); }
.den-hall-choice { position: fixed; left: 50%; bottom: calc(40px + env(safe-area-inset-bottom)); z-index: 1350; width: min(92vw, 460px);
  transform: translate(-50%, 12px); opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease;
  display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #EFE6CD; color: #2E2118; border: 1.5px solid #2E2118;
  box-shadow: 0 8px 22px rgba(10,6,3,0.5); font: 400 14px/1.4 'Libre Franklin', 'Franklin Gothic Medium', 'Helvetica Neue', Arial, sans-serif; }
.den-hall-choice.on { opacity: 1; transform: translate(-50%, 0); }
.den-hall-choice button { all: unset; box-sizing: border-box; cursor: pointer; padding: 11px 14px; text-align: center; border: 1.5px solid #2E2118; }
.den-hall-choice button.go { background: #2E2118; color: #EFE6CD; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.den-hall-choice button.go:hover, .den-hall-choice button.go:focus-visible { background: #A8321F; border-color: #A8321F; }
.den-hall-choice button.stay { font-style: italic; }
.den-hall-choice button.stay:hover, .den-hall-choice button.stay:focus-visible { background: rgba(46,33,24,0.08); }
.den-hall-choice button:focus-visible { outline: 2px solid #A8321F; outline-offset: 2px; }
.den-hall-choice button { transition: opacity 0.4s ease; }
.den-hall-choice[data-held] button { opacity: 0.5; cursor: default; }
/* While it's happening (user: the corner buttons and the points pill are
   only a distraction then): the page's own controls step out of the way. */
html.ec-hall-scene [data-testid="points-counter"], html.ec-hall-scene [data-testid="room-view-corner"], html.ec-hall-scene [data-testid="focus-corner"],
html.ec-hall-scene [data-testid="action-corner"], html.ec-hall-scene [data-testid="how-to-play"], html.ec-hall-scene button[aria-label$="full screen"],
html.ec-hall-scene [data-testid="music-chip"], html.ec-hall-scene [data-testid="dock-corner"], html.ec-hall-scene [data-testid="shell-bar"], html.ec-hall-scene [data-testid="shell-hint"], html.ec-hall-scene [data-testid="piece-card"],
html.ec-hall-scene [data-testid="tienda-special-note"] {
  opacity: 0 !important; pointer-events: none !important; transition: opacity 0.6s ease !important; }
/* A game that ends while it's on (the last move landing as the hall
   flares, or on the walk in): its placard waits till the scene's over
   (user: it came up under the scene's own blocker, whose taps it never
   got, so it couldn't be dismissed or used). After "keep playing", or
   back in the den from the void, it's there as ever. So does every other
   sheet of the game's that may be up as it starts, each as stuck there
   as the placard was (user: a Singularity game's NEW GAME choice, Retain
   or Reconfigure, the placard's New Game had brought up just before the
   pull, stayed over the whole walk): that choice, the end-turn question,
   the rules, the move log, the sound menu. */
html.ec-hall-scene [data-testid="victory-backdrop"], html.ec-hall-scene [data-testid="new-game-choice"],
html.ec-hall-scene [data-testid="end-turn-ask"], html.ec-hall-scene [data-testid="info-overlay"],
html.ec-hall-scene [data-testid="movelog-sheet"], html.ec-hall-scene [data-testid="sound-menu"] { opacity: 0 !important; pointer-events: none !important; }
@media (prefers-reduced-motion: reduce) { .den-hall-say, .den-hall-choice { transition: none; } }
`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };

/* ---- the drawn light ---- */
const NOISE = `
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// The doorway full of it: a swirl, brighter in the middle.
const DOOR_FRAG = `uniform float uTime, uAmt; uniform vec3 uA, uB; varying vec2 vUv; ${NOISE}
void main(){ vec2 p = (vUv - 0.5) * vec2(1.0, 2.2); float r = length(p), a = atan(p.y, p.x);
  float sw = fbm(vec2(a * 1.6 + uTime * 0.9 + r * 6.0, r * 3.0 - uTime * 1.3));
  float core = exp(-r * 4.0);
  vec3 c = mix(uA, uB, sw) * (0.35 + 0.9 * sw) + vec3(1.0) * core * 0.45;
  float edge = smoothstep(0.5, 0.42, abs(vUv.x - 0.5)) * smoothstep(0.5, 0.44, abs(vUv.y - 0.5));
  gl_FragColor = vec4(c * uAmt * edge, 1.0); }`;
// Its spill on a surface: falling off from a point (uFrom, in the plane's
// uv), stronger straight out (uDir), streaked by noise.
const SPILL_FRAG = `uniform float uTime, uAmt, uFall; uniform vec2 uFrom, uDir; uniform vec3 uA, uB; varying vec2 vUv; ${NOISE}
void main(){ vec2 d = vUv - uFrom; float r = length(d);
  float ahead = 0.55 + 0.45 * max(0.0, dot(normalize(d + 1e-5), uDir));
  float n = fbm(vec2(atan(d.y, d.x) * 3.0 + uTime * 0.7, r * 6.0 - uTime));
  float f = exp(-r / uFall) * ahead * (0.7 + 0.6 * n);
  // (Soft at the plane's own edges: no hard line where it ends.)
  float edge = smoothstep(0.0, 0.18, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  gl_FragColor = vec4(mix(uA, uB, n) * f * edge * uAmt, 1.0); }`;
/* The rift (user: not one pink slit, it read as something else): the
   fabric of space and time coming apart, and through it, spasming open
   and shut, portals in the shapes of the game's own pieces. A fine grid,
   the fabric, bent by the pull; cracks of white tearing across it, never
   the same twice (the noise's seed jumps, erratically); a cool halo. Over
   it, six portals at a time, each a piece's outline seen front on (the
   Cabeza's square, a Chato's slab, a Flaco's or Turrito's tower, an Opa's
   disc, a Codo's L, a Rayo's S, a Zeta's Z, an Arco's arch), opening for
   a moment somewhere in the tear, shuddering, gone; inside each, the
   void, a deep blue dark. Cool white and blue, a little violet. */
const RIFT_W = 22, RIFT_H = 30;
const RIFT_FRAG = `uniform float uTime, uAmt, uGrow; varying vec2 vUv; ${NOISE}
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float piece(vec2 p, float k){
  if (k < 0.5) return sdBox(p, vec2(0.62));                                   // Cabeza
  if (k < 1.5) return sdBox(p, vec2(0.72, 0.3));                              // Chato
  if (k < 2.5) return sdBox(p, vec2(0.26, 0.74));                             // Flaco, Turrito
  if (k < 3.5) return length(p) - 0.58;                                       // Opa
  if (k < 4.5) return min(sdBox(p - vec2(-0.22, 0.0), vec2(0.22, 0.66)), sdBox(p - vec2(0.22, -0.44), vec2(0.44, 0.22)));   // Codo
  if (k < 5.5) return min(sdBox(p - vec2(-0.22, -0.22), vec2(0.44, 0.22)), sdBox(p - vec2(0.22, 0.22), vec2(0.44, 0.22))); // Rayo
  if (k < 6.5) return min(min(sdBox(p - vec2(-0.44, 0.44), vec2(0.22, 0.22)), sdBox(p, vec2(0.22, 0.66))), sdBox(p - vec2(0.44, -0.44), vec2(0.22, 0.22))); // Zeta
  return max(sdBox(p, vec2(0.66, 0.5)), -sdBox(p - vec2(0.0, -0.32), vec2(0.28, 0.34)));                                    // Arco
}
void main(){
  vec2 p = (vUv - 0.5) * vec2(${(RIFT_W / RIFT_H).toFixed(4)}, 1.0);
  float t = uTime;
  // The fabric, drawn in toward the tear (a well) and bent by the pull,
  // and where it's coming apart.
  float r = length(p * vec2(1.0, 0.75));
  vec2 w = p - normalize(p + 1e-4) * (0.004 * (1.0 + 1.5 * uGrow)) / (r + 0.08)
    + 0.03 * (1.0 + uGrow) * vec2(fbm(p * 3.0 + t * 0.3) - 0.5, fbm(p * 3.0 - t * 0.27 + 7.0) - 0.5);
  float field = 1.0 - smoothstep(0.12 + 0.12 * uGrow, 0.34 + 0.08 * uGrow, r);
  vec2 g = abs(fract(w * 16.0) - 0.5);
  float grid = (1.0 - smoothstep(0.0, 0.035, min(g.x, g.y))) * field * field;
  // Its cracks: thin and jagged (a ridge of fine noise), in pieces, and
  // the seed jumps at odd moments, so they tear somewhere new.
  float jump = floor(t * 5.0 + 3.0 * hsh(vec2(floor(t * 2.3), 1.7)));
  vec2 cw = w * 9.0 + vec2(jump * 1.31, jump * 0.77);
  float ridge = 1.0 - abs(2.0 * fbm(cw) - 1.0);
  float crack = pow(ridge, 28.0) * step(0.42, vn(w * 5.0 + jump * 2.7)) * field * step(0.3, hsh(vec2(jump, 2.0)));
  float halo = exp(-r / (0.09 + 0.12 * uGrow)) * 0.55;
  // The portals.
  vec3 rims = vec3(0.0); float inside = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float rate = 0.7 + 1.3 * hsh(vec2(fi, 3.1));
    float x = t * rate + fi * 0.37, cell = floor(x), ph = fract(x);
    float alive = step(0.3, hsh(vec2(cell, fi)));
    vec2 c = (vec2(hsh(vec2(cell, fi + 11.0)), hsh(vec2(cell, fi + 23.0))) - 0.5) * vec2(0.42, 0.56) * (0.55 + 0.6 * uGrow);
    float sz = (0.035 + 0.045 * hsh(vec2(cell, fi + 5.0))) * (1.0 + 0.4 * uGrow);
    // The spasm: a shudder in its size, now and then; a flicker.
    float sp = 1.0 + 0.14 * sin(t * 47.0 + fi * 7.0) * step(0.55, hsh(vec2(floor(t * 11.0), fi)));
    float env = smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.62, 1.0, ph)) * (0.75 + 0.25 * step(0.2, hsh(vec2(floor(t * 23.0), fi + 3.0))));
    float k = floor(hsh(vec2(cell, fi + 31.0)) * 8.0);
    float an = (hsh(vec2(cell, fi + 41.0)) - 0.5) * 0.7;
    vec2 q = (p - c) / (sz * sp); q = mat2(cos(an), -sin(an), sin(an), cos(an)) * q;
    float d = piece(q, k) * sz * sp;
    float a = alive * env;
    rims += mix(vec3(0.8, 0.93, 1.0), vec3(0.62, 0.66, 1.0), hsh(vec2(cell, fi + 51.0))) * exp(-abs(d) / (0.003 + 0.002 * uGrow)) * a * 1.25;
    inside = max(inside, (1.0 - smoothstep(-0.002, 0.002, d)) * a);
  }
  vec3 c = (vec3(0.5, 0.78, 1.0) * grid * 0.12 + vec3(0.92, 0.97, 1.0) * crack * 1.8 + vec3(0.42, 0.6, 1.0) * halo) * (1.0 - inside)
    + rims + vec3(0.06, 0.16, 0.6) * inside * 0.4;
  // (Soft to the plane's own edges.)
  c *= smoothstep(0.5, 0.36, abs(vUv.x - 0.5)) * smoothstep(0.5, 0.36, abs(vUv.y - 0.5));
  gl_FragColor = vec4(c * uAmt, 1.0); }`;

function additive(frag, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
}

export function createHall({ audio, onEnding, flares: flareStore = null }) {
  const doc = typeof document !== "undefined" ? document : null;
  let state = "idle", need = FIRST_AFTER, t0 = 0, choiceAt = 0;
  /* The moves made since it was armed, over however many games: each
     frame, what the game's move log has grown by (a shorter log is a new
     game: counted on from its start). */
  let made = 0, seen = 0, overAt = 0;
  const countFrom = (moves) => { made = 0; seen = moves; overAt = 0; };
  const count = (moves) => { if (moves > seen) made += moves - seen; seen = moves; };
  let built = null, builtFor = null;
  let flashEl = null, whiteEl = null, sayEl = null, choiceEl = null, blockEl = null, styleEl = null;
  let choiceFreeAt = 0;
  let amt = 0, camW = 0, camGoal = 0, camFrom = 0, camT0 = 0;
  let nodes = [], hum = null, nextBoom = 0, walkFrom = null, ended = false, path = null, nextStep = 0;
  const colA = new THREE.Color(0x8a5cff), colB = new THREE.Color(0x5ce1ff);

  function style() {
    if (styleEl || !doc) return;
    styleEl = doc.createElement("style"); styleEl.textContent = CSS; doc.head.appendChild(styleEl);
    if (!doc.querySelector("link[data-patrick-hand]")) {
      const l = doc.createElement("link"); l.rel = "stylesheet"; l.setAttribute("data-patrick-hand", "");
      l.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap";
      doc.head.appendChild(l);
    }
  }
  const div = (cls) => { const d = doc.createElement("div"); d.className = cls; doc.body.appendChild(d); return d; };

  /* ---- the drawn light, in the den's own group ---- */
  function build(den) {
    unbuild();
    const g = new THREE.Group(); g.name = "den-hall";
    const U = () => ({ uTime: { value: 0 }, uAmt: { value: 0 }, uA: { value: colA }, uB: { value: colB } });
    const mats = [], geos = [];
    const plane = (w, h, mat) => { const geo = new THREE.PlaneGeometry(w, h); geos.push(geo); mats.push(mat); const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; g.add(m); return m; };
    // The doorway, a little into the hall (its jambs frame it).
    const door = plane(DW + 2, DH + 1, additive(DOOR_FRAG, U()));
    door.position.set(DC, FLOOR + DH / 2, RZ + 6); door.rotation.y = Math.PI;
    // The spill: the den's floor in front of the door, the south wall
    // round it, the ceiling above; and the hall's own floor and far wall.
    const spill = (w, h, from, dir, fall) => additive(SPILL_FRAG, { ...U(), uFrom: { value: new THREE.Vector2(...from) }, uDir: { value: new THREE.Vector2(...dir) }, uFall: { value: fall } });
    // (Each plane's uv: where the door, or the rift, is on it. Laid flat,
    // a plane's v runs away from +z; stood facing the room, its u runs
    // toward -x; facing up the hall, toward -z.)
    const floor = plane(80, 80, spill(80, 80, [0.5 + 12 / 80, 0.0], [0, 1], 0.32));
    floor.rotation.x = -Math.PI / 2; floor.position.set(DC - 12, FLOOR + 0.25, RZ - 40);
    const wall = plane(74, CEIL - FLOOR, spill(74, 49, [0.5 - 8 / 74, 0.42], [0, 0], 0.22));
    wall.rotation.y = Math.PI; wall.position.set(DC - 8, (FLOOR + CEIL) / 2, RZ - 0.35);
    const ceil = plane(72, 70, spill(72, 70, [0.5 + 8 / 72, 1.0], [0, -1], 0.24));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(DC - 8, CEIL - 0.25, RZ - 35);
    const hallFloor = plane(56, 28, spill(56, 28, [(RIFT.x - HALL.HX0) / 56, 0.25], [1, 0], 0.4));
    hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(HALL.HX0 + 28, FLOOR + 0.25, RZ + HALL.WT + 14);
    const hallEnd = plane(28, CEIL - FLOOR, spill(28, 49, [0.25, 24 / 49], [0, 0], 0.4));
    hallEnd.rotation.y = Math.PI / 2; hallEnd.position.set(HALL.HX0 + 0.35, (FLOOR + CEIL) / 2, RZ + 19);
    // The rift, facing back up the hall (+x).
    const rift = plane(RIFT_W, RIFT_H, additive(RIFT_FRAG, { uTime: { value: 0 }, uAmt: { value: 0 }, uGrow: { value: 0 } }));
    rift.position.copy(RIFT); rift.rotation.y = Math.PI / 2;
    // The sparks drifting out into the room.
    const N = 240, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const sparks = [];
    for (let i = 0; i < N; i++) sparks.push({ born: -1e9, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ph: Math.random() * 6.28 });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geos.push(pg);
    const dot = doc ? (() => { const c = doc.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() : null;
    const pm = new THREE.PointsMaterial({ size: 2.4, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    mats.push(pm);
    const points = new THREE.Points(pg, pm); points.frustumCulled = false; points.renderOrder = 6; g.add(points);
    den.group.add(g);
    built = { g, door, floor, wall, ceil, hallFloor, hallEnd, rift, points, pos, col, sparks, mats, geos, dot, den };
    builtFor = den;
  }
  function unbuild() {
    if (!built) return;
    if (built.g.parent) built.g.parent.remove(built.g);
    built.mats.forEach((m) => m.dispose()); built.geos.forEach((gg) => gg.dispose()); if (built.dot) built.dot.dispose();
    built = null; builtFor = null;
  }

  /* ---- the sound ---- */
  function out() { const o = audio && audio.phoneOutput ? audio.phoneOutput() : null; return o && o.ctx ? o : null; }
  const keep = (n) => { nodes.push(n); return n; };
  function noise(o, t, dur) { const s = keep(o.ctx.createBufferSource()); s.buffer = o.noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
  // A slow boom (the summons' thunder's kind): a sub thump, then the
  // rumble rolling on.
  function boom(s = 1) {
    const o = out(); if (!o) return;
    const { ctx } = o, t = ctx.currentTime + 0.02;
    const sub = keep(ctx.createOscillator()); sub.type = "sine";
    sub.frequency.setValueAtTime(58, t); sub.frequency.exponentialRampToValueAtTime(27, t + 1.4);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.55 * s, t + 0.04); sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    sub.connect(sg).connect(o.ear); sub.start(t); sub.stop(t + 3);
    const n = noise(o, t, 4.2), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(240, t); lp.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.42 * s, t + 0.3); ng.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
    n.connect(lp).connect(ng).connect(o.ear);
  }
  // A footstep: the carpet's soft thud, or in the hall the floorboards'
  // a little brighter, now and then a creak.
  function step(hall) {
    const o = out(); if (!o) return;
    const { ctx } = o, t = ctx.currentTime + 0.01;
    const n = noise(o, t, 0.16), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = hall ? 900 : 380;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(hall ? 0.16 : 0.12, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(lp).connect(g).connect(o.ear);
    const th = keep(ctx.createOscillator()); th.type = "sine"; th.frequency.setValueAtTime(hall ? 110 : 80, t); th.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    const tg = ctx.createGain(); tg.gain.setValueAtTime(0.0001, t); tg.gain.linearRampToValueAtTime(0.14, t + 0.008); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    th.connect(tg).connect(o.ear); th.start(t); th.stop(t + 0.15);
    if (hall && Math.random() < 0.3) {
      const c = keep(ctx.createOscillator()); c.type = "sawtooth"; c.frequency.setValueAtTime(320 + Math.random() * 140, t + 0.05); c.frequency.linearRampToValueAtTime(260, t + 0.32);
      const cb = ctx.createBiquadFilter(); cb.type = "bandpass"; cb.frequency.value = 700; cb.Q.value = 6;
      const cg = ctx.createGain(); cg.gain.setValueAtTime(0.0001, t + 0.05); cg.gain.linearRampToValueAtTime(0.025, t + 0.12); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      c.connect(cb).connect(cg).connect(o.ear); c.start(t + 0.05); c.stop(t + 0.36);
    }
  }
  function crackle(level) {
    const o = out(); if (!o) return;
    const { ctx } = o, t = ctx.currentTime + 0.01;
    const n = noise(o, t, 0.1), hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400;
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.05 * level, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(hp).connect(gg).connect(o.ear);
  }
  // The hum while it's going: two low saws and a wobble, its level set
  // each frame (setHum).
  function startHum() {
    const o = out(); if (!o || hum) return;
    const { ctx } = o, t = ctx.currentTime;
    const a = keep(ctx.createOscillator()); a.type = "sawtooth"; a.frequency.value = 55;
    const b = keep(ctx.createOscillator()); b.type = "sawtooth"; b.frequency.value = 82.7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 3;
    const wob = keep(ctx.createOscillator()); wob.frequency.value = 0.35; const wg = ctx.createGain(); wg.gain.value = 140; wob.connect(wg).connect(lp.frequency);
    const g = ctx.createGain(); g.gain.value = 0;
    a.connect(lp); b.connect(lp); lp.connect(g).connect(o.ear);
    [a, b, wob].forEach((x) => x.start(t));
    hum = { g, lp, ctx };
  }
  function setHum(level) { if (hum) hum.g.gain.setTargetAtTime(0.06 * level, hum.ctx.currentTime, 0.15); }
  // The roar at the end: everything rising to the white.
  function roar() {
    const o = out(); if (!o) return;
    const { ctx } = o, t = ctx.currentTime + 0.02, d = ERUPT_MS / 1000;
    const n = noise(o, t, d + 0.4), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(5200, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.35);
    n.connect(lp).connect(g).connect(o.ear);
    const sub = keep(ctx.createOscillator()); sub.type = "sawtooth"; sub.frequency.setValueAtTime(40, t); sub.frequency.exponentialRampToValueAtTime(120, t + d);
    const sl = ctx.createBiquadFilter(); sl.type = "lowpass"; sl.frequency.value = 400;
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.3, t + d); sg.gain.linearRampToValueAtTime(0.0001, t + d + 0.3);
    sub.connect(sl).connect(sg).connect(o.ear); sub.start(t); sub.stop(t + d + 0.4);
  }
  function stopSound(fade = 0.6) {
    if (hum) { const h = hum; h.g.gain.setTargetAtTime(0, h.ctx.currentTime, fade / 3); hum = null; setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } }), fade * 1000 + 300); }
  }

  /* ---- the words and the choice ---- */
  function showSay(on) {
    if (!doc) return;
    if (on && !sayEl) { style(); sayEl = div("den-hall-say"); sayEl.setAttribute("role", "status"); sayEl.setAttribute("data-testid", "den-hall-say"); sayEl.textContent = flares > 1 ? LINE_AGAIN : LINE; requestAnimationFrame(() => requestAnimationFrame(() => sayEl && sayEl.classList.add("on"))); }
    if (!on && sayEl) { const el = sayEl; sayEl = null; el.classList.remove("on"); setTimeout(() => el.remove(), 400); }
  }
  function showChoice(on) {
    if (!doc) return;
    if (on && !choiceEl) {
      style();
      choiceEl = div("den-hall-choice"); choiceEl.setAttribute("data-testid", "den-hall-choice"); choiceEl.setAttribute("role", "group"); choiceEl.setAttribute("aria-label", "The hall");
      const go = doc.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = INVESTIGATE; go.setAttribute("data-testid", "den-hall-investigate"); go.onclick = () => pick("investigate");
      const stay = doc.createElement("button"); stay.type = "button"; stay.className = "stay"; stay.textContent = flares > 1 ? KEEP_AGAIN : KEEP; stay.setAttribute("data-testid", "den-hall-keep"); stay.onclick = () => pick("keep");
      choiceEl.append(go, stay);
      // Held a moment (user: an impatient player tapping wildly could take
      // a choice unread, and Investigate is the way to the end): no tap
      // counts for CHOICE_HOLD_MS, the buttons dimmed till then.
      const el = choiceEl;
      el.setAttribute("data-held", "");
      choiceFreeAt = performance.now() + CHOICE_HOLD_MS;
      setTimeout(() => el.removeAttribute("data-held"), CHOICE_HOLD_MS);
      requestAnimationFrame(() => requestAnimationFrame(() => choiceEl && choiceEl.classList.add("on")));
      setTimeout(() => { try { go.focus({ preventScroll: true }); } catch (e) { /* fine */ } }, 60);
    }
    if (!on && choiceEl) { const el = choiceEl; choiceEl = null; el.classList.remove("on"); setTimeout(() => el.remove(), 400); }
  }
  function camTo(goal) { if (goal === camGoal) return; camFrom = camW; camGoal = goal; camT0 = performance.now(); }
  function pick(which) {
    if (state !== "flare" || performance.now() < choiceFreeAt) return;
    showChoice(false); showSay(false);
    if (which === "keep") {
      state = "settle"; t0 = performance.now(); camTo(0);
      if (blockEl) { blockEl.remove(); blockEl = null; }
      return;
    }
    state = "walk"; t0 = performance.now(); walkFrom = null; path = null; nextStep = 0;
  }
  /* The walk's clock: as it is; dragged, the walk itself goes 1.7 times
     as fast and, there, straight on to the eruption (no standing calm). */
  const DRAG = 1.7, DRAG_WALK = WALK_END / DRAG;
  function walkClock(now) {
    const r = now - t0;
    if (!dragged) return r;
    return r < DRAG_WALK ? r * DRAG : CALM_UNTIL - 400 + (r - DRAG_WALK);
  }

  // How many times it's come (kept with the story, so a visit later counts
  // on): the second time it says something else; the third there's no
  // choice, you're dragged in (user).
  let flares = flareStore ? flareStore.get() : 0, dragged = false;
  function flare(now, moves) {
    state = "flare"; t0 = now; countFrom(moves); nextBoom = now + 600; flares++; dragged = false;
    if (flareStore) flareStore.set(flares);
    camTo(1);
    startHum();
    if (doc && !flashEl) { style(); flashEl = div("den-hall-flash"); }
    // (The board's not to be touched while it's on: the choice first.)
    if (doc && !blockEl) blockEl = div("den-hall-block");
  }

  /* ---- each frame ---- */
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), dir = new THREE.Vector3(), look = new THREE.Vector3();
  function stepSparks(dt, now, level, toRoom) {
    const b = built;
    for (let i = 0; i < b.sparks.length; i++) {
      const s = b.sparks[i];
      let age = (now - s.born) / 1000;
      if (age > s.life) {
        if (level < 0.05 || Math.random() > 0.35) { b.pos[i * 3 + 1] = -9999; continue; }
        s.born = now; age = 0; s.life = 1.6 + Math.random() * 2.6;
        s.x = HALL.DX0 + 1 + Math.random() * (DW - 2); s.y = FLOOR + 2 + Math.random() * (DH - 4); s.z = RZ + 5;
        const sp = (6 + Math.random() * 16) * (0.5 + level * 0.6);
        s.vx = (Math.random() - 0.5) * 6; s.vy = (Math.random() - 0.3) * 4; s.vz = toRoom ? -sp : sp * 0.15;
      }
      s.x += (s.vx + Math.sin(now * 0.003 + s.ph) * 4) * dt; s.y += (s.vy + Math.cos(now * 0.0025 + s.ph) * 3) * dt; s.z += s.vz * dt;
      b.pos[i * 3] = s.x; b.pos[i * 3 + 1] = s.y; b.pos[i * 3 + 2] = s.z;
      const k = Math.sin(Math.PI * Math.min(1, age / s.life)) * Math.min(1.5, level);
      const c = (i % 3 === 0) ? colB : colA;
      b.col[i * 3] = (c.r * 0.6 + 0.4) * k; b.col[i * 3 + 1] = (c.g * 0.6 + 0.4) * k; b.col[i * 3 + 2] = (c.b * 0.6 + 0.4) * k;
    }
    b.points.geometry.attributes.position.needsUpdate = true;
    b.points.geometry.attributes.color.needsUpdate = true;
  }
  let lastNow = 0, strobe = 0, nextStrobe = 0;
  function tick(now, t, den, ctx) {
    const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016); lastNow = now;
    if (!den || ended || state === "over") return;
    if (state === "armed") {
      const moves = ctx && ctx.moves ? ctx.moves() : 0;
      count(moves);
      // (After "Let me just finish one game!": that game's end, too.)
      const over = flares >= 2 && !!(ctx && ctx.over && ctx.over());
      if (!over) overAt = 0; else if (!overAt) overAt = now;
      if ((made >= need || (overAt && now - overAt >= OVER_HOLD_MS)) && !(ctx && ctx.busy)) flare(now, moves);
    }
    if (state === "idle" || state === "armed") {
      if (built && amt > 0) amt = Math.max(0, amt - dt * 0.8);
      if (built && amt <= 0) { unbuild(); }
      if (!built) return;
    }
    if (!built || builtFor !== den) build(den);
    const s = state === "walk" ? walkClock(now) : now - t0;
    // How much light: up as it flares, a strobe on top; down if left
    // alone; in the hall, calm, then the eruption.
    let level = 0, wild = 0, grow = 0;
    if (state === "flare") {
      level = smooth(s / 1400) * (1 + 0.15 * Math.sin(now * 0.004)); wild = 1;
      if (flares >= 3) {
        // The third time: no words, no choice: pulled in.
        if (s > 2600) { pick("investigate"); dragged = true; }
      } else {
        if (s > 1100) showSay(true);
        if (s > 2400 && !choiceAt) { choiceAt = now; showChoice(true); }
      }
      if (now >= nextBoom) { boom(0.8 + Math.random() * 0.4); nextBoom = now + 3200 + Math.random() * 3200; }
    } else if (state === "settle") {
      level = 1 - smooth(s / 2600); wild = level;
      if (s > 2600) { state = "armed"; need = AGAIN_AFTER; choiceAt = 0; stopSound(); countFrom(ctx && ctx.moves ? ctx.moves() : 0); }
    } else if (state === "walk") {
      // Dying down as you go (to a glow you can walk up to).
      level = s < CALM_UNTIL ? 0.22 + 0.78 * (1 - smooth((s - 600) / 5200)) : 0.22;
      wild = s < CALM_UNTIL ? Math.max(0, 1 - s / 4200) : 0;
      if (s < 3200 && now >= nextBoom) { boom(0.6); nextBoom = now + 4000; }
      if (s >= CALM_UNTIL) {
        const e = clamp01((s - CALM_UNTIL) / ERUPT_MS);
        if (!hum && e < 0.05) startHum();
        if (!built.roared) { built.roared = true; roar(); boom(1.4); }
        level = 0.22 + 4 * e * e; wild = 1 + e; grow = e;
        if (whiteEl === null && doc) { style(); whiteEl = div("den-hall-white"); }
        if (whiteEl) whiteEl.style.opacity = String(clamp01((e - 0.72) / 0.26));
      }
      if (s >= ENDING_AT && !ended) {
        ended = true; state = "done";
        stopSound(0.2);
        // (The page's controls stay away till it's all over: finish().)
        if (onEnding) onEnding({ white: whiteEl, clear: () => cleanupDom(true) });
      }
    }
    // The strobe: hard flashes, now and then a burst of them.
    if (now >= nextStrobe) { strobe = Math.random() < 0.5 ? 1 : 0.35; nextStrobe = now + (40 + Math.random() * 160) / Math.max(0.4, wild || 0.4); if (wild > 0.3 && strobe > 0.9) crackle(wild); }
    strobe *= Math.exp(-dt * 18);
    amt = level * (1 - 0.35 * wild + 0.9 * wild * strobe);
    setHum(state === "walk" && s < CALM_UNTIL ? 0.35 + 0.65 * (1 - smooth(s / 5000)) : level);
    // Colours drifting violet - cyan - white.
    const hue = 0.5 + 0.5 * Math.sin(now * 0.0011);
    colA.setRGB(0.4 + 0.22 * hue * strobe, 0.46 + 0.25 * strobe, 1.0);
    colB.setRGB(0.36 + 0.4 * strobe, 0.88, 1.0);
    const T = now / 1000;
    built.mats.forEach((m) => { if (m.uniforms) { if (m.uniforms.uTime) m.uniforms.uTime.value = T; } });
    // (The doorway's own glow goes as you walk through it.)
    built.door.material.uniforms.uAmt.value = amt * 0.8 * (state === "walk" ? 1 - smooth((s - 1500) / 1500) : 1);
    [built.floor, built.wall, built.ceil].forEach((m, i) => { m.material.uniforms.uAmt.value = amt * [0.9, 0.85, 0.5][i]; });
    const inHall = state === "walk";
    built.hallFloor.material.uniforms.uAmt.value = inHall ? 0.3 * amt + 0.1 : 0.25 * amt;
    built.hallEnd.material.uniforms.uAmt.value = inHall ? 0.35 * amt + 0.12 : 0.25 * amt;
    built.rift.material.uniforms.uAmt.value = inHall ? 0.9 + 0.6 * grow + 0.2 * Math.sin(now * 0.006) : 0.6 * amt;
    built.rift.material.uniforms.uGrow.value = grow;
    built.rift.scale.setScalar(1 + 1.4 * grow * grow);
    stepSparks(dt, now, amt, !inHall || s >= CALM_UNTIL);
    if (flashEl) flashEl.style.opacity = String(clamp01(state === "walk" && s < CALM_UNTIL ? amt * 0.1 : amt * 0.24 * (0.4 + wild * strobe)));
    den.keepHall(state === "walk" || state === "done");
    sceneClass(state === "flare" || state === "walk" || state === "done" || (state === "settle" && s < 1200));
  }

  // The page's controls out of the way while it's on (CSS above).
  let sceneOn = false;
  function sceneClass(on) {
    if (on === sceneOn || !doc) return;
    sceneOn = on; style();
    doc.documentElement.classList.toggle("ec-hall-scene", on);
  }

  /* ---- the camera ---- */
  const wEye = new THREE.Vector3(), wAt = new THREE.Vector3();
  // Where the camera was last drawn from, and looking at, in the den (the
  // look at the doorway): the walk starts from there.
  const lastEye = new THREE.Vector3(), lastAt = new THREE.Vector3();
  let lastPlaced = false;
  // The lens before the dolly zoom widened it, given back after.
  let fovBase = null, fovCam = null;
  function restoreFov() {
    if (fovBase === null || !fovCam) return;
    fovCam.fov = fovBase; fovCam.updateProjectionMatrix();
    fovBase = null; fovCam = null;
  }
  function placeCamera(camera, t, den) {
    if (!den || !t || !t.boardGroup) return false;
    const now = performance.now();
    if (camGoal !== camW) camW = camFrom + (camGoal - camFrom) * smooth((now - camT0) / 1800);
    if (state === "walk" || (state === "done" && walkFrom)) {
      const s = state === "done" ? ENDING_AT : walkClock(now);
      if (!walkFrom) {
        // Where the camera was last drawn from (and what it was looking
        // at), in the den. (Not where the camera is now: the page puts its
        // own back each frame before this, and the walk had started with a
        // cut to it, low, by the lamp.)
        if (lastPlaced) walkFrom = { eye: lastEye.clone(), at: lastAt.clone() };
        else {
          tmpA.copy(camera.position); den.group.worldToLocal(tmpA);
          camera.getWorldDirection(dir); tmpB.copy(camera.position).addScaledVector(dir, 40); den.group.worldToLocal(tmpB);
          walkFrom = { eye: tmpA.clone(), at: tmpB.clone() };
        }
        lastPlaced = false;
      }
      if (!path) {
        const curve = new THREE.CatmullRomCurve3([walkFrom.eye.clone(), ...PATH.map((p) => p.clone())], false, "centripetal");
        path = { curve, L: curve.getLength() };
      }
      // How far along: easing off at the start and the end, a steady walk
      // between.
      const { curve, L } = path, TA = 900, TD = 1600, v = L / (WALK_END - TA / 2 - TD / 2);
      const tt = Math.min(s, WALK_END);
      const d = tt < TA ? 0.5 * v * tt * tt / TA : tt < WALK_END - TD ? v * (tt - TA / 2) : L - 0.5 * v * (WALK_END - tt) * (WALK_END - tt) / TD;
      const pace = tt < TA ? tt / TA : tt < WALK_END - TD ? 1 : Math.max(0, (WALK_END - tt) / TD);
      const u = clamp01(d / L);
      curve.getPointAt(u, wEye);
      // Looking where it's going (a little ahead, a little down), from
      // wherever it was looking; round the turn, at the rift.
      curve.getPointAt(Math.min(1, u + 16 / L), wAt);
      if (u + 16 / L > 1) { curve.getTangentAt(1, dir); wAt.addScaledVector(dir, (u + 16 / L - 1) * L); }
      wAt.y = EY - 3;
      wAt.lerp(walkFrom.at, 1 - smooth(s / 1400));
      wAt.lerp(RIFT, smooth((d - (L - 26)) / 20));
      // The steps: a rise and fall with each (lowest as the foot comes
      // down, highest over it, smooth both ways), a sway from foot to foot,
      // as much as it's walking; dragged, none (pulled along, a tremble).
      // Half a step in, so the first foot comes down as it gets going.
      const phase = (d / STRIDE + 0.5) * Math.PI;
      if (!dragged) {
        dir.copy(wAt).sub(wEye).setY(0).normalize();
        const k = pace, sp = Math.sin(phase);
        wEye.y += (sp * sp - 0.5) * 0.8 * k;
        wEye.x += -dir.z * sp * 0.35 * k; wEye.z += dir.x * sp * 0.35 * k;
        const n = Math.floor(d / STRIDE + 0.5);
        if (state === "walk" && n > nextStep && pace > 0.15) { nextStep = n; step(wEye.z > RZ); }
      } else if (s < WALK_END) {
        wEye.x += (Math.random() - 0.5) * 0.25; wEye.y += (Math.random() - 0.5) * 0.25;
      }
      // The dolly zoom: in on the rift, the lens widening to keep it the
      // same size (its distance times the lens's half-width held), looking
      // straight at it.
      const dz = smooth((s - DOLLY[0]) / (DOLLY[1] - DOLLY[0]));
      if (dz > 0) {
        if (fovBase === null) { fovBase = camera.fov; fovCam = camera; }
        wAt.lerp(RIFT, dz);
        tmpA.copy(RIFT).sub(wEye);
        const d0 = tmpA.length(), d = d0 * (1 - DOLLY_IN * dz);
        wEye.copy(RIFT).addScaledVector(tmpA.normalize(), -d);
        const half = Math.min(DOLLY_MAX_FOV / 2, Math.atan(Math.tan((fovBase * Math.PI) / 360) * (d0 / d)) * 180 / Math.PI);
        camera.fov = half * 2; camera.updateProjectionMatrix();
      }
      // (The shake only at the very end, so the dolly reads.)
      if (s > CALM_UNTIL) { const e = clamp01((s - CALM_UNTIL) / ERUPT_MS), q = clamp01((e - 0.62) / 0.38), j = 1.6 * q * q; wEye.x += (Math.random() - 0.5) * j; wEye.y += (Math.random() - 0.5) * j; wAt.x += (Math.random() - 0.5) * j * 2; }
      den.group.updateWorldMatrix(true, false);
      den.group.localToWorld(wEye); den.group.localToWorld(wAt);
      camera.position.copy(wEye); camera.lookAt(wAt);
      return true;
    }
    restoreFov();
    if (camW <= 0.0005) { lastPlaced = false; return false; }
    // Over to look at the doorway (blended with wherever the camera was).
    wEye.copy(LOOK.eye); wAt.copy(LOOK.at);
    den.group.updateWorldMatrix(true, false);
    den.group.localToWorld(wEye); den.group.localToWorld(wAt);
    const e = camW;
    camera.getWorldDirection(dir);
    look.copy(camera.position).addScaledVector(dir, camera.position.length());
    look.lerp(wAt, e);
    camera.position.lerp(wEye, e);
    camera.lookAt(look);
    lastEye.copy(camera.position); den.group.worldToLocal(lastEye);
    lastAt.copy(look); den.group.worldToLocal(lastAt);
    lastPlaced = true;
    return true;
  }

  function cleanupDom(keepScene = false) {
    if (!keepScene) sceneClass(false);
    [flashEl, whiteEl, blockEl].forEach((el) => el && el.remove());
    flashEl = whiteEl = blockEl = null;
    showSay(false); showChoice(false);
  }

  return {
    // Armed (home from the trip): counting from `moves`.
    arm(moves = 0) { if (state === "idle") { state = "armed"; countFrom(moves); need = FIRST_AFTER; } },
    tick,
    placeCamera,
    // Is it showing (the camera's, the screen's)?
    active: () => state === "flare" || state === "settle" || state === "walk",
    state: () => ({ state, need, made, amt, cam: camW, flares, dragged, fov: fovCam ? fovCam.fov : null, t: state === "idle" || state === "armed" ? 0 : performance.now() - t0 }),
    // Test-only: now (as if the moves were made), and the choice.
    now(moves = 0) { if (state === "idle" || state === "armed") flare(performance.now(), moves); },
    pick,
    // The ending's over (the void, den-ending.js): the hall as it was.
    finish() {
      restoreFov();
      state = "over"; walkFrom = null; camW = camGoal = 0;
      stopSound(0.1); cleanupDom();
      if (built && built.den) built.den.keepHall(false);
      unbuild();
    },
    // Test-only: skip the walk on to just before the eruption (or `ms`).
    skipWalk(ms = CALM_UNTIL - 300) { if (state === "walk") { dragged = false; t0 = performance.now() - ms; } },
    dispose() {
      restoreFov();
      stopSound(0.1);
      nodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } });
      nodes = [];
      cleanupDom();
      if (built && built.den) built.den.keepHall(false);
      unbuild();
      if (styleEl) { styleEl.remove(); styleEl = null; }
    },
  };
}
