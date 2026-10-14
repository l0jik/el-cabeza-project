/* Ciudad's buildings: every piece a building of the city at its exact game
   size, as the glass towers and cranes mock-ups drew them (the scratch
   city's BUILD.midvar; user, round 8: "I want the pieces to be the whitish
   with the gray blue ... more variety within the building colors and
   types, although still keeping with a consistent group ... a chato ...
   not always going to look the same").

   - Each side a family: the light side's walls in whites, its glass a
     grey-blue; the dark side's walls grey-blue slate, its glass near
     black. Each piece hashes its id for a model and a tint of its own
     from its side's family, so two pieces of a kind needn't look alike
     and the two sides always tell apart.
   - Five models, each keeping the piece's block: sections (the floors in
     unequal groups, each a few centimetres off the one below, ribbon
     windows over coloured spandrels), fins (one block, fins down its
     front), grid (punched windows, a pier every second bay), balcony
     (glass behind, a slab and a pale rail every floor), curtain (a glass
     curtain wall). A lobby lit behind glass, a flat roof, a plant room,
     sometimes an antenna.
   - The 1x3 Block is all glass (user: "some buildings are, like, entirely
     glass, like, maybe, like, a 1x3, which would be the tallest piece in
     the game"): a glass tower standing, a glass hall lying down; at night
     its crown lit and a red light on its mast.
   - Odd-shaped pieces: a column of the building's own facade on each of
     its cubes' squares, one box for every unbroken run up it, the faces
     pressed against a neighbour left out.
   - The Cabeza is the glass dome (a round stone hall, a glass dome on
     its roof ribbed in steel, lit inside at night, ciudad-rotundas.js), or
     one of the others offered for it with ?cabeza= (ciudad-cabezas.js).

   The windows by night (user, of the 10 PM city: "too random ... like
   black and white Rubik's cubes"; "cut the total lights on in the
   buildings by 20%, and occasionally change which lights are on"): lit
   by plan, worked out in the shader per window (cityPlanShader): offices
   by the floor, a whole floor or a run at one end, a desk or two on a
   dark one; homes by the flat (two or three windows, the same flats up
   the building), a room or two lit, now and then a television's blue; a
   stair lit up one side; one building in eight gone dark (the backdrop's,
   not the pieces'). A few flats and floors switch on or off now and
   then, each at its own pace. The facades' textures carry the day; a
   second canvas, the windows' shapes in white, is all the night needs.

   A building is made once per piece and pose and kept (the chassis
   rebuilds a piece's mesh every move and disposes only that mesh's own
   geometry and material; these are its children). Its walls are one
   atlas (every face of every box in one canvas): a building's facades
   are one draw. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";
import { quality } from "./tienda-quality.js";
import { cabezaFor, cabezaKind } from "./ciudad-cabezas.js";

export const PS = PIECE_SCALE;
export const CAB_D = DISC_DIAM * CABEZA_SCALE;
export const CAB_H = DISC_H * CABEZA_SCALE;

/* ------------------------------------------------------------ the families */

export const FAMILY = {
  light: {
    walls: ["#eceae4", "#f2f1ec", "#e2e2dc", "#dfe4e6", "#e8e4da"], glasses: ["#5a6e7a", "#66798a", "#4e6270"],
    accents: ["#b8c4cc", "#a8b6c0", "#c8ccc8", "#9aa8b2"], glassHi: "#b8c8d2", slab: "#f6f5f0", roof: "#d8d8d2",
    towerGlass: "#9fb2c0", towerHi: "#e4ecf2", towerFrame: "#eef0ee",
    lit: ["#ffdcaa", "#ffe6c0", "#ffd090", "#fff0d8", "#ffcf88"],
  },
  dark: {
    walls: ["#5e6e7e", "#546474", "#687886", "#4e5e6c", "#5a6a76"], glasses: ["#1e262e", "#26303a", "#222a32"],
    accents: ["#7e8e9a", "#6a7a88", "#8a9aa6", "#5a6a78"], glassHi: "#6a7a88", slab: "#4a5664", roof: "#44505c", mullion: "#3a4652",
    towerGlass: "#26323e", towerHi: "#5c7084", towerFrame: "#3a4652",
    lit: ["#e6eeff", "#d4e4ff", "#fff2e0", "#ffe2b4", "#cfe0ff"],
  },
};
// The pieces' seed: which model and tint each piece's id draws (the
// standard five of each side all different, and each kind unlike its
// counterpart across the board).
const SEED = 265;
const CROWN = "#f6f0e2";

/* ------------------------------------------------------------ small tools */

let seed = 7;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const rr = (a, b) => a + (b - a) * rnd();
export const pick = (a) => a[Math.floor(rnd() * a.length)];
export const reseed = (n) => { seed = (Math.abs(n) % 2147483646) + 1; for (let i = 0; i < 4; i++) rnd(); };
export const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// Colours as the materials want them (linear), from the hex a drawing names.
export const col = (c) => new THREE.Color(c).convertSRGBToLinear();
/* A shade of a colour, as the mock-ups made them (scratch city.js shade():
   the colour taken to linear, scaled, its hex read back as it was; so a
   shade drawn on a canvas is a little deeper than the number says. The
   stills the user chose were drawn so, and these are drawn the same). */
export const shade = (hex, k) => { const c = col(hex); c.multiplyScalar(k); c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b); return "#" + c.getHexString(); };

export function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
export function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }

/* ------------------------------------------------------------ the light of the hour */

/* What the time of day drives (ciudad-fx.js sets these): how far into the
   night (0 by day, 1 at ten), the clock (s, for the switching), the
   windows' strength. Shared by every material that lights by plan. */
export const PLAN_U = { uNight: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 1.15 } };
/* The night's lights fall off with how far they are from the one looking
   (user: "City lights at night should be dimmer the farther from the
   user's perspective they are"): uViewR the camera's distance from the
   board's middle (ciudad-fx.js sets it each frame); a light that near or
   nearer is as bright as it is, one farther fades as (near / far)^2.2
   (half as bright a quarter as far again, a quarter at twice as far), to
   no less than a tenth. */
export const FAR_U = { uViewR: { value: 12 } };
const FAR_GLSL = "uniform float uViewR; varying float vFarD;\nfloat cityFar(float d) { return clamp(pow((uViewR + 1.0) / max(d, 0.001), 2.2), 0.1, 1.0); }";
/* A material's night light, so faded: its emissive (mode "e": windows,
   lamp pools, lobbies) or its alpha ("a": glows, lamp heads, car lamps). */
export function farDim(mat, mode = "e") {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    shader.uniforms.uViewR = FAR_U.uViewR;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vFarD;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvFarD = length(mvPosition.xyz);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${FAR_GLSL}`);
    shader.fragmentShader = mode === "e"
      ? shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= cityFar(vFarD);")
      : shader.fragmentShader.replace("#include <alphatest_fragment>", "diffuseColor.a *= cityFar(vFarD);\n#include <alphatest_fragment>");
  };
  mat.customProgramCacheKey = () => `${prevKey}|far-${mode}`;
  mat.needsUpdate = true;
  return mat;
}
// Materials whose glow follows the night (lobbies, the Cabeza, crowns,
// beacons): each apply(n) sets its own.
export const TIMED = new Set();
export function applyNight(n) { TIMED.forEach((f) => f(n)); }
// Materials that show the sky in their glass (the env map of the hour).
export const ENV_MATS = new Set();
let ENV = null;
export function setEnv(t) {
  ENV = t;
  ENV_MATS.forEach((m) => { const was = !!m.envMap; m.envMap = t; if (was !== !!t) m.needsUpdate = true; });
}
export function glassy(m) { ENV_MATS.add(m); if (ENV) m.envMap = ENV; return m; }

/* ------------------------------------------------------------ the plan, in the shader */

const glslCol = (hex) => { const c = col(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
const pickFn = (name, list) => `vec3 ${name}(float r) {\n${list.map((h, i) => (i < list.length - 1 ? `  if (r < ${((i + 1) / list.length).toFixed(4)}) return ${glslCol(h)};` : `  return ${glslCol(h)};`)).join("\n")}\n}`;
const HOME_WARM = ["#ffc477", "#ffb862", "#ffd496", "#f5c27e", "#ffcf8a", "#ffdcaa"];
const HOME_COOL = ["#dfe6f2", "#cfdbee", "#f2dcb8", "#ffd8a0", "#c9d7ef"];
const OFFICE_LIT = ["#f0e2c4", "#e2e4ea", "#ead9b8", "#d9e0ea", "#f2dcb0"];

/* A window's light tonight: vec4(colour, strength), 0 where it's dark.
   vWin: (the window across its face, the floor from the top, the face,
   the face's windows); vSeed: the building. uKind: 0 offices, 1 homes;
   uPal: 0 the light side's warm homes, 1 the dark side's (cool or warm by
   building), 2 the city's own; uNoDark: 1 for the pieces (never one of
   the dark eighth). */
export const PLAN_GLSL = `
uniform float uNight, uTime, uGlow, uKind, uPal, uNoDark;
varying vec4 vWin; varying float vSeed;
float hp(float a, float b) { vec3 p3 = fract(vec3(a, b, a) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
${pickFn("officeCol", OFFICE_LIT)}
${pickFn("warmCol", HOME_WARM)}
${pickFn("coolCol", HOME_COOL)}
vec3 homeCol(float S, float r) {
  float b = hp(S, 3.0);
  bool warm = uPal < 0.5 || (uPal < 1.5 ? b >= 0.6 : b < 0.72);
  return warm ? warmCol(r) : coolCol(r);
}
// a group (a floor, a flat) switched over now and then: only some ever do,
// each for a while, at its own pace
float flick(float S, float k, float share) {
  float ever = step(hp(S, k + 0.5), share);
  float P = 90.0 + 210.0 * hp(S, k + 0.25);
  return ever * step(fract(uTime / P + hp(S, k + 0.75)), 0.15);
}
vec4 cityPlan() {
  float S = vSeed;
  float u = floor(vWin.x), fl = floor(vWin.y), face = vWin.z, n = max(1.0, vWin.w);
  float isDark = step(hp(S, 1.0), 0.12) * (1.0 - uNoDark);
  float occ = uKind < 0.5 ? 0.3 + 0.36 * (hp(S, 2.0) - 0.5) : min(0.95, 0.88 + 0.3 * (hp(S, 2.0) - 0.5));
  occ = mix(occ, 0.03, isDark);
  vec3 c; float a; float on;
  if (uKind < 0.5) {
    // offices, by the floor: a whole floor, or a run of it at one end; a desk or two on a dark one
    float floorOn = step(hp(S, 10.0 + fl), occ);
    floorOn = abs(floorOn - flick(S, 20.0 + fl, 0.12));
    float len = hp(S, 30.0 + fl) < 0.6 ? n : max(2.0, floor(n * (0.35 + 0.3 * hp(S, 40.0 + fl)) + 0.5));
    float inRun = hp(S, 50.0 + fl) < 0.5 ? step(u, len - 0.5) : step(n - len - 0.5, u);
    float desk = step(hp(S + face * 7.0, 60.0 + fl * 3.1 + u), 0.025);
    on = max(floorOn * inRun, desk * (1.0 - floorOn));
    c = officeCol(hp(S, 70.0 + fl));
    a = floorOn > 0.5 ? 0.46 + 0.26 * hp(S, 80.0 + fl) : 0.42;
  } else {
    // homes, by the flat: two or three windows, the same flats up the building
    float flatW = hp(S, 4.0) < 0.5 ? 3.0 : 2.0;
    float off = floor(hp(S, 5.0) * flatW);
    float stair = (isDark < 0.5 && hp(S, 6.0) < 0.35 && face < 0.5) ? floor(hp(S, 7.0) * n) : -1.0;
    if (u == stair) {
      on = step(hp(S, 90.0 + fl), 0.85); c = vec3(0.79, 0.83, 0.87); a = 0.36;
    } else {
      float apt = floor((u + off) / flatW) + face * 17.0;
      float k = fl * 31.0 + apt;
      float flatOn = step(hp(S, 100.0 + k), occ);
      flatOn = abs(flatOn - flick(S, 200.0 + k, 0.15));
      // a lit flat: one room at least, the others as they fall
      float first = floor(hp(S, 300.0 + k) * flatW), i = mod(u + off, flatW);
      float room = abs(i - first) < 0.5 ? 1.0 : step(hp(S + i * 3.0, 400.0 + k), 0.68);
      on = flatOn * room;
      c = hp(S, 500.0 + k) < 0.08 ? vec3(0.34, 0.46, 1.0) : homeCol(S, hp(S, 600.0 + k));
      a = 0.55 + 0.4 * hp(S, 700.0 + k);
    }
  }
  // (drawn on black at that strength on an sRGB canvas, as the stills were: its light goes as a^2.2)
  return vec4(c, pow(a, 2.2) * on);
}
`;
// Where the buildings round the board dissolve out of the camera's way
// (the view's target; ciudad-fx.js sets it each frame), as Noir's do.
export const FOCUS = { value: new THREE.Vector3() };
const SEE_GLSL = `
uniform vec3 uFocus; varying vec3 vSeeP;
float seeB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float seeB4(vec2 a){ return seeB2(0.5 * a) * 0.25 + seeB2(a); }
`;
const SEE_CUT = `
{
  vec3 seg = uFocus - cameraPosition; float L = length(seg); vec3 dir = seg / max(L, 1e-4);
  float t = dot(vSeeP - cameraPosition, dir);
  if (t > 0.0 && t < L - 1.5) {
    float d = length(vSeeP - (cameraPosition + dir * t)), r = 1.3 + 0.045 * t;
    float edge = smoothstep(r, r - 0.35, d);
    if (seeB4(gl_FragCoord.xy) < edge) discard;
  }
}`;

/* A facade material that lights its windows by plan: its emissive map
   the windows' shapes, white; the plan says which are lit, in what
   colour, how strongly, all scaled by the night. Optionally dissolving
   where it stands in the view (the backdrop). */
export function planMaterial(mat, { kind = 1, pal = 2, noDark = false, see = false, dim = 1 } = {}) {
  mat.emissive = new THREE.Color(1, 1, 1);
  mat.emissiveIntensity = 1;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, PLAN_U, { uKind: { value: kind }, uPal: { value: pal }, uNoDark: { value: noDark ? 1 : 0 }, uDim: { value: dim } });
    if (see) shader.uniforms.uFocus = FOCUS;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec4 aWin; attribute float aSeed; varying vec4 vWin; varying float vSeed;${see ? "\nvarying vec3 vSeeP;" : ""}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWin = aWin; vSeed = aSeed;")
      .replace("#include <project_vertex>", `#include <project_vertex>${see ? "\nvSeeP = (modelMatrix * vec4(transformed, 1.0)).xyz;" : ""}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uDim;\n${PLAN_GLSL}${see ? SEE_GLSL : ""}`)
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, uDim, uNight);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n{ vec4 lp = cityPlan(); totalEmissiveRadiance *= lp.rgb * (lp.a * uNight * uGlow); }")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>${see ? SEE_CUT : ""}`);
  };
  mat.customProgramCacheKey = () => (see ? "ciudad-plan-see" : "ciudad-plan");
  return farDim(mat);
}

/* ------------------------------------------------------------ facades */

/* Each style draws one face: bays across, floors down, a cell each (cw x
   ch px) on `x`; and every window's shape, white, on `m`. As the mock-ups
   drew them (FACADE.midmod, punch, fullglass, glass, brutal). */
export const STYLE_GRID = {
  midmod: { bay: PS / 6, floor: PS / 4, units: 2 }, punch: { bay: PS / 5, floor: PS / 4, units: 1 },
  fullglass: { bay: PS / 5, floor: PS / 4, units: 1 }, glass: { bay: PS / 6, floor: PS / 6, units: 1 },
  brutal: { bay: PS / 3, floor: PS / 4, units: 1 },
};
export const OFFICE = { glass: true, fullglass: true };
function speckle(x, w, h, n, colors, a0 = 0.04, a1 = 0.12, s0 = 1, s1 = 3) {
  for (let i = 0; i < n; i++) { x.globalAlpha = rr(a0, a1); x.fillStyle = colors[Math.floor(rnd() * colors.length)]; const s = rr(s0, s1); x.fillRect(rnd() * w, rnd() * h, s, s); }
  x.globalAlpha = 1;
}
export const FACADE = {
  midmod(x, m, bays, floors, cw, ch, pal) {
    // ribbon windows over a panel a bay (the side's colour), mullions every bay and a half
    const W2 = bays * cw, H2 = floors * ch, cols = pal.panels || [pal.wall];
    x.fillStyle = pal.wall; x.fillRect(0, 0, W2, H2);
    for (let f = 0; f < floors; f++) {
      const y0 = f * ch, R = pal.ribbon ?? 0.46, sp0 = 0.12 + R, sph = Math.max(0.06, 0.96 - sp0);
      for (let b = 0; b < bays; b++) { x.fillStyle = cols[(b * 3 + f * 2 + (pal.seedK || 0)) % cols.length]; x.fillRect(b * cw + 1, y0 + ch * sp0, cw - 2, ch * sph); }
      x.fillStyle = pal.glass; x.fillRect(0, y0 + ch * 0.08, W2, ch * R);
      x.fillStyle = pal.glassHi; x.globalAlpha = 0.35; x.fillRect(0, y0 + ch * 0.08, W2, ch * 0.08); x.globalAlpha = 1;
      x.fillStyle = pal.mullion || shade(pal.wall, 0.8); for (let b = 0; b <= bays * 2; b++) x.fillRect((b * cw) / 2 - 1, y0 + ch * 0.08, 2, ch * R);
      m.fillStyle = "#fff"; for (let b = 0; b < bays * 2; b++) m.fillRect((b * cw) / 2 + 1, y0 + ch * 0.1, cw / 2 - 2, ch * (R - 0.04));
    }
  },
  punch(x, m, bays, floors, cw, ch, pal) {
    // punched windows in a stone or render wall, the reveals shadowed, a pier every second bay
    const W2 = bays * cw, H2 = floors * ch;
    x.fillStyle = pal.wall; x.fillRect(0, 0, W2, H2);
    x.globalAlpha = 0.18; x.fillStyle = "#000"; for (let b = 2; b < bays; b += 2) x.fillRect(b * cw - 1, 0, 2, H2); x.globalAlpha = 1;
    m.fillStyle = "#fff";
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
      const X0 = b * cw + cw * 0.2, Y0 = f * ch + ch * 0.22, w = cw * 0.6, h = ch * 0.56;
      x.fillStyle = shade(pal.wall, 0.7); x.fillRect(X0 - 1, Y0 - 1, w + 2, h + 2);
      x.fillStyle = pal.glass; x.fillRect(X0 + 1, Y0 + 2, w - 1, h - 2);
      x.fillStyle = pal.glassHi; x.globalAlpha = 0.3; x.fillRect(X0 + 1, Y0 + 2, w * 0.4, h - 2); x.globalAlpha = 1;
      x.fillStyle = shade(pal.wall, 1.08); x.fillRect(X0 - 2, Y0 + h + 1, w + 4, 2);
      m.fillRect(X0 + 1, Y0 + 2, w - 1, h - 2);
    }
  },
  fullglass(x, m, bays, floors, cw, ch, pal) {
    // glass floor to ceiling: the sky's gradient, a pane here and there a shade off, a fine mullion grid, a streak of sky
    const W2 = bays * cw, H2 = floors * ch, gr = x.createLinearGradient(0, 0, W2 * 0.6, H2);
    gr.addColorStop(0, pal.glassHi); gr.addColorStop(0.55, pal.glass); gr.addColorStop(1, shade(pal.glass, 0.82));
    x.fillStyle = gr; x.fillRect(0, 0, W2, H2);
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) if (rnd() < 0.2) { x.globalAlpha = 0.1; x.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; x.fillRect(b * cw, f * ch, cw, ch); x.globalAlpha = 1; }
    x.fillStyle = pal.mullion; for (let b = 0; b <= bays; b++) x.fillRect(b * cw - 1, 0, 2, H2); for (let f = 0; f <= floors; f++) x.fillRect(0, f * ch - 1.5, W2, 3);
    x.globalAlpha = 0.13; x.fillStyle = "#fff"; x.beginPath(); x.moveTo(W2 * 0.08, 0); x.lineTo(W2 * 0.32, 0); x.lineTo(W2 * 0.78, H2); x.lineTo(W2 * 0.54, H2); x.closePath(); x.fill(); x.globalAlpha = 1;
    m.fillStyle = "#fff"; for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) m.fillRect(b * cw + 2, f * ch + 3, cw - 4, ch - 6);
  },
  glass(x, m, bays, floors, cw, ch, pal) {
    // a curtain wall: mullions, vision glass over spandrel panels, a streak of sky
    x.fillStyle = pal.mullion; x.fillRect(0, 0, bays * cw, floors * ch);
    m.fillStyle = "#fff";
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
      const X0 = b * cw + 3, Y0 = f * ch + 2, w = cw - 6, h = ch * 0.7;
      const g = x.createLinearGradient(X0, Y0, X0 + w * 0.6, Y0 + h);
      g.addColorStop(0, pal.glassHi); g.addColorStop(0.55, pal.glass); g.addColorStop(1, shade(pal.glass, 0.8));
      x.fillStyle = g; x.fillRect(X0, Y0, w, h);
      x.fillStyle = pal.spandrel; x.fillRect(X0, Y0 + h + 2, w, ch - h - 6);
      m.fillRect(X0, Y0, w, h);
    }
    x.globalAlpha = 0.12; x.fillStyle = "#fff";
    x.beginPath(); x.moveTo(bays * cw * 0.1, 0); x.lineTo(bays * cw * 0.35, 0); x.lineTo(bays * cw * 0.05, floors * ch); x.lineTo(0, floors * ch); x.fill(); x.globalAlpha = 1;
  },
  brutal(x, m, bays, floors, cw, ch, pal) {
    // board-marked concrete: plank lines, speckle, deep-set windows under a shadowed lintel
    x.fillStyle = pal.wall; x.fillRect(0, 0, bays * cw, floors * ch);
    for (let y = 0; y < floors * ch; y += 5) { x.globalAlpha = 0.06 + 0.05 * rnd(); x.fillStyle = "#000"; x.fillRect(0, y, bays * cw, 1); }
    x.globalAlpha = 1; speckle(x, bays * cw, floors * ch, bays * floors * 18, ["#000", "#fff"]);
    m.fillStyle = "#fff";
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
      const X0 = b * cw + 5, Y0 = f * ch + ch * 0.34, w = cw - 10, h = ch * 0.38;
      x.fillStyle = shade(pal.wall, 0.55); x.fillRect(X0 - 1, Y0 - 3, w + 2, 3);
      const g = x.createLinearGradient(0, Y0, 0, Y0 + h); g.addColorStop(0, pal.glassHi); g.addColorStop(1, pal.glass);
      x.fillStyle = g; x.fillRect(X0, Y0, w, h);
      x.fillStyle = shade(pal.wall, 0.8); x.fillRect(X0 + w / 2 - 1, Y0, 2, h);
      m.fillRect(X0, Y0, w, h);
    }
  },
};

/* ------------------------------------------------------------ geometry in parts */

// Quads into arrays: position, normal, uv, the window coordinates, the seed.
export function sink() { return { pos: [], nor: [], uv: [], win: [], seed: [] }; }
export function quad(s, P, n, uv, win, sd) {
  // P: four corners counter-clockwise seen from outside (a, b, c, d); two triangles
  const I = [0, 1, 2, 0, 2, 3];
  for (const i of I) {
    s.pos.push(P[i][0], P[i][1], P[i][2]); s.nor.push(n[0], n[1], n[2]); s.uv.push(uv[i][0], uv[i][1]);
    if (win) s.win.push(win[i][0], win[i][1], win[i][2], win[i][3]);
    s.seed.push(sd || 0);
  }
}
export function geoOf(s) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(s.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(s.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(s.uv, 2));
  if (s.win.length) g.setAttribute("aWin", new THREE.Float32BufferAttribute(s.win, 4));
  if (s.seed.length) g.setAttribute("aSeed", new THREE.Float32BufferAttribute(s.seed, 1));
  g.computeBoundingSphere();
  return g;
}
/* The four walls of a box (X by Y by Z, its foot at y0, centred on
   cx, cz) into a sink: each face's uv the rectangle the atlas gives it,
   its windows counted across it and down from its top (fl0: the floor
   the box's top floor is in the building). hidden: faces left out. */
export const FACES = ["px", "nx", "pz", "nz"];
export function wallsInto(s, X, Y, Z, y0, cx, cz, rects, wins, sd, hidden = {}) {
  const x0 = cx - X / 2, x1 = cx + X / 2, z0 = cz - Z / 2, z1 = cz + Z / 2, ya = y0, yb = y0 + Y;
  const corners = {
    px: [[x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1]],
    nx: [[x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0]],
    pz: [[x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1]],
    nz: [[x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0]],
  };
  const normals = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1] };
  FACES.forEach((k, i) => {
    if (hidden[k]) return;
    const r = rects[i], w = wins[i];
    quad(s, corners[k], normals[k], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]],
      [[0, w.f1, i, w.n], [w.n, w.f1, i, w.n], [w.n, w.f0, i, w.n], [0, w.f0, i, w.n]], sd);
  });
}

/* An atlas: the faces of a building's boxes, each box a row of four
   faces. Each face is drawn as its own facade (the style, its bays, its
   floors), so the windows fall where the cells do. */
function makeAtlas(cell) {
  const rows = [];
  return {
    add(box) { rows.push(box); return box; },
    // lay out and draw: { map, mask } textures, and each box's face rects
    draw() {
      let W = 0, H = 0;
      for (const b of rows) { b.px = b.faces.map((f) => f.bays * cell); b.w = b.px.reduce((a, c) => a + c, 0); b.h = b.floors * cell; b.y = H; H += b.h; W = Math.max(W, b.w); }
      W = Math.max(2, W); H = Math.max(2, H);
      const c = cv(W, H), x = c.getContext("2d"), mc = cv(W, H), m = mc.getContext("2d");
      m.fillStyle = "#000"; m.fillRect(0, 0, W, H);
      for (const b of rows) {
        let X = 0;
        b.rects = b.faces.map((f, i) => {
          const w = b.px[i];
          x.save(); m.save(); x.translate(X, b.y); m.translate(X, b.y);
          x.beginPath(); x.rect(0, 0, w, b.h); x.clip(); m.beginPath(); m.rect(0, 0, w, b.h); m.clip();
          FACADE[b.style](x, m, f.bays, b.floors, cell, cell, b.pal);
          x.restore(); m.restore();
          const r = { u0: X / W, u1: (X + w) / W, v1: 1 - b.y / H, v0: 1 - (b.y + b.h) / H };
          X += w;
          return r;
        });
      }
      const map = tex(c), mask = tex(mc);
      map.anisotropy = mask.anisotropy = 4;
      return { map, mask };
    },
  };
}

/* ------------------------------------------------------------ materials */

const MATS = new Map();
export function std(c, o = {}) {
  const key = c + JSON.stringify(o);
  let m = MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.8, metalness: 0.05, ...o });
    if ((o.metalness ?? 0) >= 0.3) { glassy(m); m.envMapIntensity = 0.7; }
    MATS.set(key, m);
  }
  return m;
}
// Roofs: the roof's grey, speckled, a seam now and then (a texture that
// tiles at the same scale on every roof).
const ROOF_T = new Map();
export function roofMat(c) {
  let m = ROOF_T.get(c);
  if (!m) {
    const s = 128, cc = cv(s, s), x = cc.getContext("2d");
    x.fillStyle = c; x.fillRect(0, 0, s, s);
    speckle(x, s, s, (s * s) / 30, ["#000", "#fff"], 0.03, 0.09, 1, 2);
    x.fillStyle = shade(c, 0.8); for (let y = 0; y < s; y += 32) x.fillRect(0, y, s, 1);
    const t = tex(cc); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });
    ROOF_T.set(c, m);
  }
  return m;
}
// A lobby's glass: lit from inside, a little by day, warmly at night.
const LOBBY = new Map();
export function lobbyMat(glass, lit) {
  const key = glass + lit;
  let m = LOBBY.get(key);
  if (!m) {
    m = farDim(glassy(new THREE.MeshStandardMaterial({ color: col(glass), roughness: 0.15, metalness: 0.4, emissive: col(lit), emissiveIntensity: 0.06 })));
    TIMED.add((n) => { m.emissiveIntensity = 0.06 + 0.26 * n; });
    LOBBY.set(key, m);
  }
  return m;
}
// Something lit only at night (a crown, a beacon's glow): its opacity the night's.
export function nightOnly(m, k = 1) {
  farDim(m, "a");
  m.transparent = true; m.opacity = 0; m.depthWrite = false;
  TIMED.add((n) => { m.opacity = n * k; m.visible = n > 0.01; });
  return m;
}
let GLOW_T = null;
export function glowTex() {
  if (!GLOW_T) {
    const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.4)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); GLOW_T = new THREE.CanvasTexture(c);
  }
  return GLOW_T;
}
// A glow at night (a sprite: a beacon, a lamp), invisible by day.
export function nightGlow(color, size, k = 0.8) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color: col(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  nightOnly(m, k);
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.raycast = () => {}; s.castShadow = false;
  return s;
}

/* ------------------------------------------------------------ a building in parts */

/* What a building is made of, gathered then made into as few meshes as
   it can be: its walls (one atlas, one material), and its plain parts
   (slabs, roofs, plant rooms, rails) merged by material. */
export function builder(sd, style, look, side, cell) {
  const atlas = makeAtlas(cell), walls = [], parts = new Map(), extra = [];
  const add = (geo, mat) => { const g = geo.index ? geo.toNonIndexed() : geo; if (geo !== g) geo.dispose(); (parts.get(mat) || parts.set(mat, []).get(mat)).push(g); };
  return {
    box(w, h, d, mat, x, y, z, rot = null) { const g = new THREE.BoxGeometry(w, h, d); if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(x, y, z); add(g, mat); },
    cyl(rt, rb, h, seg, mat, x, y, z) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); add(g, mat); },
    geo(g, mat) { add(g, mat); },
    extra(o) { extra.push(o); },
    // a box's four walls in a style (its windows counted from fl0 down; hidden faces left out)
    walls(X, Y, Z, y0, st, pal, o = {}) {
      const G = STYLE_GRID[st], floors = Math.max(1, Math.round(Y / G.floor));
      const faces = [Z, Z, X, X].map((len) => ({ bays: Math.max(1, Math.round(len / G.bay)) }));
      const box = atlas.add({ style: st, pal, floors, faces });
      walls.push({ box, X, Y, Z, y0, cx: o.dx || 0, cz: o.dz || 0, fl0: o.fl0 || 0, hidden: o.hidden || {}, units: G.units });
      /* ...and a floor under them (user, of the pieces' close-ups: the
         Hombro and the Flaco "having transparency issues"): walls alone
         are open beneath, and one-sided, so a building turned over, or
         rolling, or an odd piece's overhang seen from below, showed
         straight through; and round a lobby set in from them, a slit. */
      // (A hair inside them: their faces and its sides never share a plane.)
      const floor = new THREE.BoxGeometry(X - 0.002, 0.006, Z - 0.002);
      floor.translate(o.dx || 0, y0 + 0.003, o.dz || 0);
      add(floor, std(pal.slab || pal.mullion || "#b9b4aa", { roughness: 0.85 }));
    },
    finish() {
      const g = new THREE.Group();
      if (walls.length) {
        const { map, mask } = atlas.draw(), s = sink();
        for (const w of walls) {
          const wins = w.box.faces.map((f) => ({ n: f.bays * w.units, f0: w.fl0, f1: w.fl0 + w.box.floors }));
          wallsInto(s, w.X, w.Y, w.Z, w.y0, w.cx, w.cz, w.box.rects, wins, sd, w.hidden);
        }
        const isGlass = !!OFFICE[style];
        const mat = planMaterial(new THREE.MeshStandardMaterial({
          map, emissiveMap: mask, roughness: isGlass ? 0.07 : look.rough ?? 0.9, metalness: isGlass ? 0.72 : 0.05, envMapIntensity: 1.1,
        }), { kind: isGlass ? 0 : 1, pal: side === "light" ? 0 : 1, noDark: true });
        if (isGlass) glassy(mat);
        mat.userData.ciudadOwn = true;
        const m = new THREE.Mesh(geoOf(s), mat);
        m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
        g.add(m);
      }
      for (const [mat, geos] of parts) {
        const merged = BufferGeometryUtils.mergeBufferGeometries(geos);
        geos.forEach((q) => q.dispose());
        const m = new THREE.Mesh(merged, mat);
        m.castShadow = !mat.transparent; m.receiveShadow = true; m.raycast = () => {};
        g.add(m);
      }
      extra.forEach((o) => g.add(o));
      return g;
    },
  };
}

/* Which model and tints a piece takes: from its id, as the mock-ups' did
   (an id ending -0..-4 names the model). */
const VAR_MODELS = ["sections", "grid", "fins", "balcony", "curtain"];
export function pieceLook(id, side) {
  const pal = FAMILY[side], h = strHash(id + ":" + SEED), forced = /-(\d)$/.exec(id);
  const pickA = (arr, k) => arr[(h >>> k) % arr.length];
  const model = forced ? VAR_MODELS[(+forced[1]) % VAR_MODELS.length] : pickA(VAR_MODELS, 3);
  const wall = pickA(pal.walls, 7), glass = pickA(pal.glasses, 11), accent = pickA(pal.accents, 13);
  return {
    model,
    look: { ...pal, wall, glass, glassHi: pal.glassHi, mullion: pal.mullion || shade(wall, 0.85), slab: pal.slab || shade(wall, 1.05), roof: pal.roof || shade(wall, 0.92), spandrel: accent, bands: [wall, accent, wall, wall], panels: [accent], seedK: h % 7 },
    lit: pickA(pal.lit, 17),
  };
}

export const cellPx = () => (quality().tier === "low" ? 28 : 40);
export const seedOf = (id) => (strHash(id) % 997) + 1;

/* ------------------------------------------------------------ the models */

// The flat roof, the low plant room, the antenna now and then.
function topOf(b, X, Y, Z, look, at = [0, 0], antenna = true) {
  b.box(X - 0.02, 0.03, Z - 0.02, roofMat(look.roof), at[0], Y + 0.015, at[1]);
  b.box(Math.min(0.24, X * 0.3), 0.06, Math.min(0.16, Z * 0.24), std(look.wall, { roughness: 0.7 }), at[0] - X * 0.18, Y + 0.06, at[1] + Z * 0.14);
  if (antenna && Y > 1.2) b.box(0.01, 0.26, 0.01, std("#8a8e92", { metalness: 0.5 }), at[0] + X * 0.22, Y + 0.16, at[1] - Z * 0.2);
}

/* Sections (and fins: one section, fins down its front): the floors in
   unequal groups, each moved a few centimetres as one block (the first
   true to the piece, the next to one side, then back or across). */
function sectionsModel(b, X, Y, Z, look, o) {
  const amp = o.fins ? 0 : 0.04, lob = Math.min(0.12, Y * 0.18), floors = Math.max(1, Math.round((Y - lob) / (PS / 4))), fh = (Y - lob) / floors;
  b.box(X - 0.1, lob, Z - 0.1, lobbyMat(look.glass, o.lit), 0, lob / 2, 0);
  const long = X >= Z, k0 = (look.seedK || 0) + o.id.length, seq = o.fins ? [99] : [3, 2, 4, 2, 3, 4], steps = [0, 1, -1, 1, 0, -1];
  const secs = []; for (let f = 0, si = k0; f < floors; si++) { const n = Math.min(floors - f, seq[si % seq.length]); secs.push([f, n]); f += n; }
  if (secs.length > 1 && secs[secs.length - 1][1] === 1) { const last = secs.pop(); secs[secs.length - 1][1] += last[1]; }
  const slab = std(look.slab, { roughness: 0.6 }), finM = std(look.slab, { roughness: 0.6 });
  let last = [0, 0];
  secs.forEach(([f0, n], k) => {
    const st = steps[(k + k0) % steps.length] * amp, across = (k + k0) % 4 === 3, dx = (long !== across) ? st : 0, dz = (long !== across) ? 0 : st;
    const y0 = lob + f0 * fh, h = n * fh, spal = { ...look, panels: [look.bands[(k + k0) % look.bands.length]] };
    b.walls(X - 0.07, h - 0.03, Z - 0.07, y0, "midmod", spal, { dx, dz, fl0: floors - f0 - n });
    b.box(X - 0.02, 0.03, Z - 0.02, slab, dx, y0 + h - 0.015, dz);
    if (o.fins) for (let t = -X / 2 + 0.07; t < X / 2 - 0.05; t += 0.11) b.box(0.012, h - 0.03, 0.04, finM, t + dx, y0 + (h - 0.03) / 2, Z / 2 - 0.02 + dz);
    last = [dx, dz];
  });
  b.box(X - 0.01, 0.03, Z - 0.01, roofMat(look.roof), last[0], Y + 0.015, last[1]);
  b.box(Math.min(0.26, X * 0.32), 0.07, Math.min(0.18, Z * 0.26), std(look.wall, { roughness: 0.7 }), last[0] - X * 0.18, Y + 0.065, last[1] + Z * 0.14);
  if (Y > 1.2) b.box(0.01, 0.28, 0.01, std("#8a8e92", { metalness: 0.5 }), last[0] + X * 0.22, Y + 0.17, last[1] - Z * 0.2);
}
function gridModel(b, X, Y, Z, look, o) {
  const lob = Math.min(0.12, Y * 0.18);
  b.box(X - 0.1, lob, Z - 0.1, lobbyMat(look.glass, o.lit), 0, lob / 2, 0);
  b.walls(X - 0.05, Y - lob, Z - 0.05, lob, "punch", look);
  b.box(X - 0.03, 0.03, Z - 0.03, std(look.slab, { roughness: 0.6 }), 0, lob + 0.015, 0);
  topOf(b, X, Y, Z, look, [0, 0], strHash(o.id) % 2 === 1);
}
function curtainModel(b, X, Y, Z, look, o) {
  const lob = Math.min(0.12, Y * 0.18);
  b.box(X - 0.1, lob, Z - 0.1, lobbyMat(look.glass, o.lit), 0, lob / 2, 0);
  b.walls(X - 0.05, Y - lob, Z - 0.05, lob, "glass", { ...look, glassHi: look.glassHi || "#a8bcc8" });
  b.box(X - 0.03, 0.025, Z - 0.03, std(look.slab, { roughness: 0.6 }), 0, lob + 0.012, 0);
  topOf(b, X, Y, Z, look, [0, 0], strHash(o.id) % 2 === 1);
}
function balconyModel(b, X, Y, Z, look, o) {
  // glass behind, a slab and a pale rail every floor on the long faces
  const lob = Math.min(0.12, Y * 0.18), floors = Math.max(1, Math.round((Y - lob) / (PS / 4))), fh = (Y - lob) / floors, long = X >= Z;
  b.box(X - 0.1, lob, Z - 0.1, lobbyMat(look.glass, o.lit), 0, lob / 2, 0);
  b.walls(X - 0.09, Y - lob, Z - 0.09, lob, "midmod", { ...look, panels: [look.wall], ribbon: 0.7 });
  const slab = std(look.slab, { roughness: 0.6 }), rail = std(look.slab, { roughness: 0.4, transparent: true, opacity: 0.85 });
  for (let f = 1; f <= floors; f++) {
    const y = lob + f * fh - 0.012;
    b.box(X - 0.02, 0.022, Z - 0.02, slab, 0, y, 0);
    if (f < floors) for (const sg of [-1, 1]) {
      if (long) b.box(X - 0.04, 0.03, 0.006, rail, 0, y + 0.026, sg * (Z / 2 - 0.013));
      else b.box(0.006, 0.03, Z - 0.04, rail, sg * (X / 2 - 0.013), y + 0.026, 0);
    }
  }
  topOf(b, X, Y, Z, look, [0, 0], strHash(o.id) % 2 === 1);
}
/* The glass tower (and, lying down, a glass hall): a dark lobby, glass
   floor to ceiling, a crisp parapet, an antenna; at night the crown lit
   under the parapet and the mast's red light on. */
function towerModel(b, X, Y, Z, look, side) {
  const F = FAMILY[side], gl = { ...look, glass: F.towerGlass, glassHi: F.towerHi, mullion: F.towerFrame };
  const lob = Math.min(0.14, Y * 0.06);
  b.box(X - 0.1, lob, Z - 0.1, std(shade(gl.glass, 0.5), { roughness: 0.2, metalness: 0.5 }), 0, lob / 2, 0);
  b.walls(X - 0.04, Y - lob, Z - 0.04, lob, "fullglass", gl);
  b.box(X - 0.02, 0.04, Z - 0.02, std(gl.mullion, { metalness: 0.6, roughness: 0.35 }), 0, Y + 0.02, 0);
  const tall = Y > 1.5, ax = X * 0.18, az = -Z * 0.16, mast = tall ? 0.36 : 0.16;
  b.box(0.012, mast, 0.012, std("#9aa0a6", { metalness: 0.6 }), ax, Y + 0.04 + mast / 2, az);
  b.box(X - 0.03, 0.022, Z - 0.03, nightOnly(new THREE.MeshBasicMaterial({ color: col(CROWN), toneMapped: false })), 0, Y - 0.03, 0);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: col("#ff2a1a") }));
  red.position.set(ax, Y + 0.05 + mast, az); red.raycast = () => {};
  const glow = nightGlow("#ff3a28", 0.16, 0.8); glow.position.copy(red.position);
  b.extra(red); b.extra(glow);
}

/* An odd-shaped piece: a column of the building on each of its cubes'
   squares (a box for every unbroken run up it, full width so neighbours
   meet flush), its faces against a neighbour left out; a roof on each
   column's top, a plant room on the highest. */
function voxModel(b, piece, look, st) {
  const cells = piece.vox.split(";").map((s) => s.split(",").map(Number));
  const has = new Set(cells.map((c) => c.join(",")));
  const X = piece.w * PS, Z = piece.h * PS, cols = new Map();
  for (const [x, y, z] of cells) { const k = `${x},${y}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(z); }
  let best = null;
  for (const [k, zs] of cols) {
    const [x, y] = k.split(",").map(Number);
    zs.sort((a, c) => a - c);
    const runs = [];
    for (const z of zs) { const r = runs[runs.length - 1]; if (r && z === r[1] + 1) r[1] = z; else runs.push([z, z]); }
    for (const [z0, z1] of runs) {
      const full = (dx, dy) => { for (let z = z0; z <= z1; z++) if (!has.has(`${x + dx},${y + dy},${z}`)) return false; return true; };
      const cx = -X / 2 + PS * (x + 0.5), cz = -Z / 2 + PS * (y + 0.5), h = (z1 - z0 + 1) * PS;
      b.walls(PS, h, PS, z0 * PS, st, look, { dx: cx, dz: cz, fl0: (4 - z1) * 4, hidden: { px: full(1, 0), nx: full(-1, 0), pz: full(0, 1), nz: full(0, -1) } });
      if (!has.has(`${x},${y},${z1 + 1}`)) {
        b.box(PS + 0.006, 0.025, PS + 0.006, roofMat(look.roof), cx, (z1 + 1) * PS + 0.0125, cz);
        if (!best || z1 > best[2]) best = [cx, cz, z1];
      }
    }
  }
  if (best) b.box(0.2, 0.06, 0.14, std(look.wall, { roughness: 0.7 }), best[0] - 0.12, (best[2] + 1) * PS + 0.055, best[1] + 0.1);
}

/* ------------------------------------------------------------ the pieces, for the chassis */

function pieceBuilding(piece, side) {
  const { model, look, lit } = pieceLook(piece.id, side);
  const tower = piece.type === "block1x3";
  const st = tower ? "fullglass" : model === "grid" ? "punch" : model === "curtain" ? "glass" : "midmod";
  const b = builder(seedOf(piece.id), st, look, side, cellPx());
  reseed(strHash(`${piece.id}|${piece.w}|${piece.h}|${piece.z}`));
  if (piece.vox) {
    const vl = tower ? { ...look, glass: FAMILY[side].towerGlass, glassHi: FAMILY[side].towerHi, mullion: FAMILY[side].towerFrame } : look;
    voxModel(b, piece, st === "midmod" ? { ...vl, ribbon: model === "balcony" ? 0.7 : 0.46 } : vl, st);
    return b.finish();
  }
  const X = piece.w * PS, Y = piece.z * PS, Z = piece.h * PS, o = { id: piece.id, lit };
  if (tower) towerModel(b, X, Y, Z, look, side);
  else if (model === "sections") sectionsModel(b, X, Y, Z, look, o);
  else if (model === "fins") sectionsModel(b, X, Y, Z, look, { ...o, fins: true });
  else if (model === "grid") gridModel(b, X, Y, Z, look, o);
  else if (model === "curtain") curtainModel(b, X, Y, Z, look, o);
  else balconyModel(b, X, Y, Z, look, o);
  return b.finish();
}

// A piece's building, made once per piece and pose and kept.
const BUILT = new Map();
export function buildingFor(piece, side) {
  const key = piece.type === "cabeza" ? `${piece.id}|cab|${cabezaKind()}|${side}` : `${piece.id}|${side}|${piece.type}|${piece.w}|${piece.h}|${piece.z}|${piece.vox || ""}`;
  let b = BUILT.get(key);
  if (!b) {
    b = piece.type === "cabeza" ? cabezaFor(side) : pieceBuilding(piece, side);
    b.userData.ciudadBuilding = true;
    BUILT.set(key, b);
  }
  return b;
}
