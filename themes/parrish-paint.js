/* Parrish's paint: the frame, repainted.

   After the user's reference (Enya's "Orinoco Flow" video, 1988): the
   whole picture laid in loose, expressive paint (wide palette-knife and brush sweeps, mostly on the
   diagonal, flecks of gold leaf), the whole picture high-key, airy and
   misty: creams, sky blues, turquoise, sage, touches of rose and mauve.
   With the user's brief: hand-painted rotoscoping, so the paint moves with
   the footage (Loving Vincent).

   The "footage" is the live 3D scene, drawn to a texture with its depth;
   its alpha tells the subject (the board, the pieces, the pillar's top,
   the flowers, the butterflies: 1) from the world (0), see
   parrish-scene.js. Then:

     1. FLOW (a little under half the painting's size): which way the
        brush goes at every point (the structure tensor of the frame's
        brightness, as a doubled angle), how much of the subject is
        round the point (its alpha, softened), and the edge's strength.
     2. OIL (the painting's size, under the screen's): the colours laid
        down along that flow, a two-sided Kuwahara filter along the
        stroke (the world much more than the subject), then the palette:
        lifted, milky, pastel, cream in the lights. And the rotoscoped
        line round the subject's things where the depth jumps.
     3. The canvas, stroke by stroke: over the oil as an underpainting,
        the world in big strokes (palette-knife sweeps, flat and
        square-ended, scraped thin and ridged at their edges, leaning to
        the diagonal, a few in an accent colour: cream, lemon, sage,
        mauve, cobalt, rose, gold leaf), easing off over the board; the
        board and the pieces painted too (user: "they are a part of the
        painting, that move"), in their own palette-drawn colours and
        smaller brush strokes that keep to their edges, so the game reads.
        Each stroke coloured from the oil at its middle, cut short where
        the colour changes (much less strictly in the world).
     4. The finish multiplied over (the line, the canvas's weave, a pale
        varnish), and the glow added (the lights spreading, the mist).

   The motion (user: samples of each to review):
     "boil"  the scene moves smoothly, every frame; the strokes shift and
             are repainted 12 times a second (the subject's more, the
             world's big sweeps only a little), so the paint lives like a
             painted film's.
     "stop"  true stop-motion: the whole picture is a new painting 12
             times a second and held in between, the pieces' moves too.
   ?motion=boil|stop in the address picks one (the default is boil).
   With reduced motion asked for, the strokes don't move.

   Where the GPU can't read textures in its vertex stage, a per-pixel
   version of the strokes stands in (the dabs). */

import * as THREE from "three";

export const PAINT_FPS = 12;

export function motionMode() {
  try {
    const m = new URLSearchParams(window.location.search).get("motion");
    if (m === "stop" || m === "boil") return m;
  } catch (e) { /* no URL */ }
  return "boil";
}

const QUAD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const HASH = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 dirAt(vec4 f) { vec2 d2 = f.xy * 2.0 - 1.0; float a = 0.5 * atan(d2.y, d2.x); return vec2(cos(a), sin(a)); }
`;

const COMMON = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform vec2 uInvZ;      // 1/distance = uInvZ.x - uInvZ.y * depth
uniform float uHasDepth;
${HASH}
float invZ(vec2 uv) { return max(uInvZ.x - uInvZ.y * texture2D(tDepth, uv).x, 0.0); }
`;

/* 1. The flow, and how much subject is round each point. */
const FLOW_FRAG = COMMON + `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uSeed;
void main() {
  float L[25];
  float subj = 0.0;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
    vec2 o = vec2(float(i) - 2.0, float(j) - 2.0) * uTexel * 2.0;
    vec4 s = texture2D(tScene, vUv + o);
    L[j * 5 + i] = luma(s.rgb);
    subj += s.a;
  }
  subj /= 25.0;
  float E = 0.0, F = 0.0, G = 0.0;
  for (int j = 1; j < 4; j++) for (int i = 1; i < 4; i++) {
    float gx = L[j * 5 + i + 1] - L[j * 5 + i - 1];
    float gy = L[(j + 1) * 5 + i] - L[(j - 1) * 5 + i];
    float w = (i == 2 && j == 2) ? 2.0 : 1.0;
    E += w * gx * gx; F += w * gx * gy; G += w * gy * gy;
  }
  float disc = sqrt(max(0.0, 0.25 * (E - G) * (E - G) + F * F));
  float l1 = 0.5 * (E + G) + disc, l2 = 0.5 * (E + G) - disc;
  vec2 grad = vec2(F, l1 - E);
  if (dot(grad, grad) < 1e-10) grad = vec2(1.0, 0.0);
  grad = normalize(grad);
  vec2 t = vec2(-grad.y, grad.x);
  float aniso = (l1 - l2) / (l1 + l2 + 1e-4);
  float strength = sqrt(l1);
  // The painter's own sweep where nothing leads the brush: long strokes
  // on the rising diagonal, turning slowly across the picture.
  float lead = smoothstep(0.004, 0.03, strength) * smoothstep(0.05, 0.35, aniso);
  float a0 = 0.6 + (vnoise(vUv * vec2(2.0, 2.6) + uSeed * 0.002) - 0.5) * 1.1;
  vec2 d0 = vec2(cos(2.0 * a0), sin(2.0 * a0));
  vec2 d1 = vec2(t.x * t.x - t.y * t.y, 2.0 * t.x * t.y);
  vec2 d = normalize(mix(d0, d1, lead) + vec2(1e-5, 0.0));
  gl_FragColor = vec4(d * 0.5 + 0.5, subj, clamp(strength * 4.0, 0.0, 1.0));
}`;

/* 2. The oil, the palette, and the line. */
const OIL_FRAG = COMMON + `
uniform sampler2D tScene;
uniform sampler2D tFlow;
uniform vec2 uTexel;
uniform float uSeed;
uniform vec3 uLift;
uniform float uGamma;
uniform sampler2D tEcho;
uniform float uEchoK;
uniform vec3 uF0, uF1, uF2, uF3, uF4, uF5;
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0) * 5.0;
  if (x < 1.0) return mix(uF0, uF1, x);
  if (x < 2.0) return mix(uF1, uF2, x - 1.0);
  if (x < 3.0) return mix(uF2, uF3, x - 2.0);
  if (x < 4.0) return mix(uF3, uF4, x - 3.0);
  return mix(uF4, uF5, x - 4.0);
}
/* High-key and milky, as the reference: the darks lifted toward a soft
   blue-grey (the subject's less, so the wood keeps its depth), the dull
   colours given a little more colour, cream in the lights. */
vec3 grade(vec3 c, float subj) {
  float l = luma(c);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + 0.25 * (1.0 - smoothstep(0.1, 0.5, sat)));
  c = pow(clamp(c, 0.0, 1.0), vec3(mix(uGamma, 0.95, subj)));
  vec3 lift = mix(uLift, uLift * 0.75, subj);
  c = lift + (1.0 - lift) * c;
  c = mix(c, c * vec3(1.03, 1.0, 0.93), smoothstep(0.65, 1.0, l));
  return clamp(c, 0.0, 1.0);
}
void main() {
  vec4 f = texture2D(tFlow, vUv);
  float subj = f.z;
  vec2 t = dirAt(f);
  float wob = (hash12(floor(vUv * 64.0) + uSeed) - 0.5) * 0.18;
  t = vec2(t.x * cos(wob) - t.y * sin(wob), t.x * sin(wob) + t.y * cos(wob));
  vec2 n = vec2(-t.y, t.x);
  // Broad in the world, close in the subject.
  vec2 stepT = t * uTexel * mix(2.4, 1.35, subj);
  vec2 stepN = n * uTexel * mix(2.2, 1.2, subj);
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), s0 = vec3(0.0), s1 = vec3(0.0);
  float wsum = 0.0;
  for (int k = -3; k <= 3; k++) {
    float fk = float(k);
    float w = exp(-fk * fk / 8.0);
    vec2 base = vUv + stepT * fk;
    for (int r = 1; r <= 2; r++) {
      vec2 off = stepN * float(r);
      vec3 a = texture2D(tScene, base + off).rgb;
      vec3 b = texture2D(tScene, base - off).rgb;
      m0 += a * w; s0 += a * a * w;
      m1 += b * w; s1 += b * b * w;
    }
    wsum += w * 2.0;
  }
  m0 /= wsum; m1 /= wsum;
  vec3 v0 = abs(s0 / wsum - m0 * m0), v1 = abs(s1 / wsum - m1 * m1);
  float q0 = 1.0 / (1.0 + pow(dot(v0, vec3(1.0)) * 900.0, 2.0));
  float q1 = 1.0 / (1.0 + pow(dot(v1, vec3(1.0)) * 900.0, 2.0));
  vec3 c = (m0 * q0 + m1 * q1) / (q0 + q1);
  vec4 here = texture2D(tScene, vUv);
  c = mix(c, here.rgb, mix(0.1, 0.24, subj));
  // The afterimage: where a piece was a moment ago (and isn't now), what
  // it was, dissolving, as things move in the reference video.
  vec4 echo = texture2D(tEcho, vUv);
  c = mix(c, echo.rgb, echo.a * (1.0 - smoothstep(0.85, 0.95, here.a)) * uEchoK);
  // The board and the pieces are painted in the picture's own palette too:
  // their colours drawn toward the world's, light to its light, dark to
  // its dark (so a light piece stays light and a dark one dark).
  c = mix(c, ramp(clamp(luma(c) * 0.92 + 0.04, 0.0, 1.0)), mix(0.2, 0.34, subj));
  // The rotoscoped line, round the subject's things only: where the
  // nearness jumps away, on the near side.
  float line = 0.0;
  if (uHasDepth > 0.5) {
    float zc = invZ(vUv);
    float lap = invZ(vUv + vec2(uTexel.x, 0.0)) + invZ(vUv - vec2(uTexel.x, 0.0)) + invZ(vUv + vec2(0.0, uTexel.y)) + invZ(vUv - vec2(0.0, uTexel.y)) - 4.0 * zc;
    line = smoothstep(0.06, 0.2, -lap / max(zc, 1e-4)) * here.a;
  }
  gl_FragColor = vec4(grade(c, subj), line);
}`;

/* 3 (fallback). Per-pixel dabs, where the vertex stage can't read
   textures: three layers of bricks of paint along the flow, each one the
   oil's colour at its middle, laid only where that colour belongs. */
const CANVAS_FRAG = COMMON + `
uniform sampler2D tOil;
uniform sampler2D tFlow;
uniform vec2 uRes;
uniform float uSeed;
uniform float uScale;
uniform float uLine;
vec4 dabs(vec2 px, vec2 t, vec3 here, float len, float wid, float layer, float cover, float tol, float jitter) {
  float jit = (hash12(vec2(layer * 13.1, uSeed)) - 0.5) * 0.35;
  vec2 tj = vec2(t.x * cos(jit) - t.y * sin(jit), t.x * sin(jit) + t.y * cos(jit));
  vec2 q = vec2(dot(px, tj), dot(px, vec2(-tj.y, tj.x)));
  float rowOff = hash12(vec2(layer, uSeed)) * 7.0;
  float row = floor(q.y / wid + rowOff);
  float shift = hash12(vec2(row, layer + uSeed * 0.37)) * len;
  vec2 g = vec2((q.x + shift) / len, q.y / wid + rowOff);
  vec2 cell = floor(g);
  vec2 lc = fract(g) - 0.5;
  vec2 rnd = hash22(cell + vec2(layer * 31.7, uSeed * 1.3));
  lc += (rnd - 0.5) * vec2(0.3, 0.25);
  float e = pow(abs(lc.x) * 2.0 / 1.15, 3.0) + pow(abs(lc.y) * 2.0 / 1.25, 2.0);
  float mask = (1.0 - smoothstep(0.55, 1.0, e)) * step(rnd.x, cover);
  vec2 cq = vec2((cell.x + 0.5) * len - shift, (cell.y + 0.5 - rowOff) * wid);
  vec2 cpx = tj * cq.x + vec2(-tj.y, tj.x) * cq.y;
  vec3 col = texture2D(tOil, cpx / uRes).rgb;
  mask *= 1.0 - smoothstep(tol * 0.5, tol, distance(col, here));
  col *= 1.0 + (rnd.y - 0.5) * jitter;
  float bristle = vnoise(vec2(lc.x * 2.5 + rnd.x * 10.0, lc.y * max(1.0, wid / 3.2) + rnd.y * 20.0));
  col *= 0.94 + 0.12 * bristle;
  return vec4(col, mask);
}
void main() {
  vec2 px = vUv * uRes;
  vec4 f = texture2D(tFlow, vUv);
  vec2 t = dirAt(f);
  float subj = f.z;
  vec4 oil = texture2D(tOil, vUv);
  vec3 col = oil.rgb;
  float s = uScale * mix(2.2, 0.6, subj);
  float tol = mix(0.45, 0.14, subj);
  vec4 d0 = dabs(px, t, oil.rgb, 34.0 * s, 10.0 * s, 1.0, 0.95, tol, 0.12);
  col = mix(col, d0.rgb, d0.w * 0.85);
  vec4 d1 = dabs(px + 17.0, t, oil.rgb, 21.0 * s, 7.0 * s, 2.0, 0.7, tol, 0.08);
  col = mix(col, d1.rgb, d1.w * 0.8);
  col = mix(col, col * vec3(0.45, 0.4, 0.42), oil.a * uLine);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* 3. The canvas, stroke by stroke. A grid of strokes for each layer, each
   one placed (off its grid point, shifting a little with each
   repainting), turned along the flow (the world's leaning to the rising
   diagonal), coloured from the oil at its middle (now and then an accent
   colour), cut short where the colour ahead or behind changes, narrowed
   where it changes beside it; laid only over its own part of the picture
   (the world's layers or the subject's). */
const STROKE_VERT = `
precision highp float;
uniform sampler2D tOil;
uniform sampler2D tFlow;
uniform vec2 uRes;
uniform float uSeed;
uniform float uLayer;
uniform float uSpacing;   // px between grid points
uniform vec2 uSize;       // a stroke's length and width, px
uniform vec2 uDetail;     // laid where the subject's share is within this
uniform vec3 uKeep;       // ... and where strength > x, with chance z
uniform float uTol;       // how far the colour may change under it
uniform float uJitter;    // how far each stroke's colour wanders
uniform float uDiag;      // how far it leans to the rising diagonal
uniform float uAccent;    // the chance of an accent colour
uniform float uBoil;      // how far it moves with each repainting
uniform float uBend;      // how far it curves
uniform float uAngle;     // how far its direction wanders
uniform float uScale;
attribute vec2 aCell;
varying vec2 vLocal;
varying vec3 vColor;
varying float vRnd;
varying vec2 vEnds;
varying vec2 vDir;
varying float vWid;
varying float vGold;
${HASH}
float off(vec2 p, vec3 c0, float tol) { return step(tol, distance(texture2D(tOil, p / uRes).rgb, c0)); }
uniform vec3 uA0, uA1, uA2, uA3, uA4, uA5, uA6, uA7;   // the look's accents, the last gold leaf
vec3 accent(float k) {
  if (k < 0.125) return uA0;
  if (k < 0.25) return uA1;
  if (k < 0.375) return uA2;
  if (k < 0.5) return uA3;
  if (k < 0.625) return uA4;
  if (k < 0.75) return uA5;
  if (k < 0.875) return uA6;
  return uA7;
}
void main() {
  vec2 rs = hash22(aCell + vec2(uLayer * 17.31, 3.7));
  vec2 rs2 = hash22(aCell.yx * 1.37 + vec2(uLayer * 5.13, 9.1));
  vec2 rs3 = hash22(aCell * 0.71 + vec2(uLayer * 2.9, 1.3));
  vec2 rb = hash22(aCell + vec2(uSeed * 0.917, uLayer * 7.7)) - 0.5;
  vec2 c = (aCell + 0.5 + (rs - 0.5) * 0.9 + rb * uBoil) * uSpacing;
  vec2 uv = c / uRes;
  vec4 f = texture2D(tFlow, uv);
  float subj = f.z, strength = f.w;
  float laid = step(uDetail.x, subj) * step(subj, uDetail.y) * step(uKeep.x, strength) * step(rs2.x, uKeep.z);
  vec2 t = dirAt(f);
  vec2 diag = vec2(0.8, 0.6);
  if (dot(t, diag) < 0.0) t = -t;
  t = normalize(mix(t, diag, uDiag) + vec2(1e-4, 0.0));
  float ang = (rs3.x - 0.5) * uAngle + rb.y * 0.25 * uBoil;
  t = vec2(t.x * cos(ang) - t.y * sin(ang), t.x * sin(ang) + t.y * cos(ang));
  vec2 n = vec2(-t.y, t.x);
  float k = uScale * (0.75 + 0.5 * rs2.y);
  float len = uSize.x * k * (0.6 + 0.9 * hash12(aCell * 1.91 + uLayer)), wid = uSize.y * k;
  float bend = (rs2.x - 0.5) * 2.0 * uBend;
  vec3 c0 = texture2D(tOil, uv).rgb;
  float fwd = 1.0 - 0.45 * off(c + t * len * 0.5, c0, uTol);
  fwd = min(fwd, 1.0 - 0.75 * off(c + t * len * 0.25, c0, uTol));
  float back = 1.0 - 0.45 * off(c - t * len * 0.5, c0, uTol);
  back = min(back, 1.0 - 0.75 * off(c - t * len * 0.25, c0, uTol));
  float side = 1.0 - 0.45 * max(off(c + n * wid * 0.5, c0, uTol), off(c - n * wid * 0.5, c0, uTol));
  float ax = position.x < 0.0 ? position.x * back : position.x * fwd;
  vec2 p = c + t * (ax * len * 0.5) + n * (position.y * wid * 0.5 * side + bend * ax * ax * len * 0.18);
  gl_Position = laid > 0.5 ? vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  vLocal = vec2(ax, position.y);
  vEnds = vec2(-back, fwd);
  vec3 col = c0 * (1.0 + (rs3.y - 0.5) * uJitter + rb.x * uJitter * 0.3 * uBoil);
  col *= 1.0 + (rs.y - 0.5) * uJitter * vec3(0.6, 0.0, -0.7);
  vGold = 0.0;
  if (rs2.y * 0.37 + rs3.x * 0.63 < uAccent) {
    float which = fract(rs.x * 7.13 + rs3.y * 3.1);
    col = mix(col, accent(which), 0.62);
    vGold = step(0.875, which);
  }
  vColor = col;
  vRnd = rs.x * 37.0 + rs2.y * 11.0;
  vDir = t;
  vWid = wid * side;
}`;
const STROKE_FRAG = `
precision highp float;
uniform sampler2D tFlow;
uniform vec2 uRes;
uniform float uKnife;
uniform float uClip;
uniform float uAlpha;
varying vec2 vLocal;
varying vec3 vColor;
varying float vRnd;
varying vec2 vEnds;
varying vec2 vDir;
varying float vWid;
varying float vGold;
${HASH}
void main() {
  // u: 0 where the brush or knife came down, 1 where it lifted; y across.
  float u = (vLocal.x - vEnds.x) / max(vEnds.y - vEnds.x, 1e-3);
  float y = vLocal.y;
  float grooves = max(1.0, vWid / 2.6);
  vec2 L = vec2(-0.7071, 0.7071);
  vec2 perp = vec2(-vDir.y, vDir.x);
  float a;
  vec3 col;
  if (uKnife > 0.5) {
    // A palette knife: flat and square-ended, the paint scraped thin in
    // streaks toward where it lifted, a ridge left along each edge.
    float ey = abs(y);
    a = 1.0 - smoothstep(0.55, 1.0, ey);
    float ragged = 0.12 * vnoise(vec2(y * 3.0 + vRnd, vRnd));
    a *= smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.8, 0.98, u + ragged));
    float streak = vnoise(vec2(u * 1.4 + vRnd, y * grooves * 0.55));
    a *= mix(1.0, smoothstep(0.12, 0.5, streak), 0.6 * smoothstep(0.25, 1.0, u));
    col = vColor * (0.92 + 0.16 * streak);
    float ridge = smoothstep(0.72, 0.95, ey);
    col *= 1.0 + dot(perp * sign(y), L) * 0.16 * ridge + 0.05 * ridge;
  } else {
    // A brush: rounded where it came down, tapering where it lifted, the
    // bristles' grooves along it, dry at its tail, its ridge lit.
    float halfW = mix(0.72, 1.0, smoothstep(0.0, 0.2, u)) * mix(1.0, 0.5, smoothstep(0.6, 1.0, u));
    a = 1.0 - smoothstep(0.62, 1.0, abs(y) / halfW);
    a *= smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.9, 1.0, u));
    float br = vnoise(vec2(u * 2.5 + vRnd, y * grooves + vRnd * 1.7));
    float dry = vnoise(vec2(u * 1.2 + vRnd * 2.3, y * grooves * 0.8 + vRnd));
    a *= 1.0 - smoothstep(0.5, 0.95, u) * smoothstep(0.4, 0.75, dry) * 0.9;
    col = vColor * (0.93 + 0.14 * br);
    col *= 1.0 + dot(perp * y * 0.9 + vDir * (u - 0.5) * 0.3, L) * 0.12;
  }
  // Gold leaf: broken, glinting.
  if (vGold > 0.5) {
    float g = hash12(floor(gl_FragCoord.xy / 3.0) + vRnd);
    col *= 0.8 + 0.5 * g;
    a *= smoothstep(0.25, 0.5, vnoise(gl_FragCoord.xy / 9.0 + vRnd));
  }
  // The world's strokes stop short of the subject.
  if (uClip > 0.5) a *= 1.0 - smoothstep(0.45, 0.85, texture2D(tFlow, gl_FragCoord.xy / uRes).z);
  a *= uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;
const BASE_FRAG = COMMON + `
uniform sampler2D tOil;
void main() { gl_FragColor = vec4(texture2D(tOil, vUv).rgb, 1.0); }`;
// The finish, multiplied over the strokes (it can only darken).
const FINISH_FRAG = COMMON + `
uniform sampler2D tOil;
uniform sampler2D tFlow;
uniform vec2 uRes;
uniform float uSeed;
uniform float uScale;
uniform float uLine;
uniform vec3 uVig;
void main() {
  vec2 px = vUv * uRes;
  vec2 t = dirAt(texture2D(tFlow, vUv));
  float line = texture2D(tOil, vUv).a;
  float broken = 0.6 + 0.4 * smoothstep(0.3, 0.6, vnoise(vec2(dot(px, t), dot(px, vec2(-t.y, t.x))) * vec2(0.05, 0.4) / uScale + uSeed * 3.1));
  vec3 k = mix(vec3(1.0), vec3(0.45, 0.4, 0.44), line * broken * uLine);
  vec2 wv = px / (2.4 * max(uScale, 0.6));
  float weave = sin(wv.x * 3.14159) * sin(wv.y * 3.14159) * 0.5 + 0.5;
  k *= 1.0 - (weave * 0.5 + vnoise(wv * 0.9) * 0.5) * 0.03;
  // The edges darken toward crimson-umber, as the "Watermark" cover's.
  float v = length(vUv - 0.5);
  k *= mix(vec3(1.0), uVig, smoothstep(0.38, 0.76, v) * 0.7);
  gl_FragColor = vec4(k, 1.0);
}`;
// The afterimage's memory: the pieces as they are now, and, where they've
// gone, what they were, fading (and spreading a little, softly).
const ECHO_FRAG = COMMON + `
uniform sampler2D tPrev;
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uDecay;
void main() {
  vec4 p = texture2D(tPrev, vUv) * 0.4;
  p += (texture2D(tPrev, vUv + vec2(uTexel.x, 0.0)) + texture2D(tPrev, vUv - vec2(uTexel.x, 0.0)) + texture2D(tPrev, vUv + vec2(0.0, uTexel.y)) + texture2D(tPrev, vUv - vec2(0.0, uTexel.y))) * 0.15;
  vec4 cur = texture2D(tScene, vUv);
  // The pieces write alpha 1, the board 0.75 (parrish.js): only the pieces leave afterimages.
  float piece = smoothstep(0.85, 0.95, cur.a);
  gl_FragColor = vec4(mix(p.rgb, cur.rgb, piece), max(piece, p.a * uDecay));
}`;
// The glow: the lights, spread and added back (the reference's mist).
const BRIGHT_FRAG = COMMON + `
uniform sampler2D tOil;
void main() { vec3 c = texture2D(tOil, vUv).rgb; gl_FragColor = vec4(c * smoothstep(0.78, 1.0, luma(c)), 1.0); }`;
const BLUR_FRAG = COMMON + `
uniform sampler2D tSrc;
uniform vec2 uStep;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 0.2270;
  s += (texture2D(tSrc, vUv + uStep * 1.3846).rgb + texture2D(tSrc, vUv - uStep * 1.3846).rgb) * 0.3162;
  s += (texture2D(tSrc, vUv + uStep * 3.2308).rgb + texture2D(tSrc, vUv - uStep * 3.2308).rgb) * 0.0703;
  gl_FragColor = vec4(s, 1.0);
}`;
const GLOW_FRAG = COMMON + `
uniform sampler2D tSrc;
uniform float uGlow;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uGlow, 1.0); }`;

// The layers (px, on a screen 900 px across its short side): the world's
// three (knife, knife, brush), then the subject's two.
const LAYERS = [
  { layer: 1, spacing: 52, size: [240, 72], detail: [-1, 0.5], keep: [-1, 0, 1], tol: 0.6, jitter: 0.2, diag: 0.6, accent: 0.18, boil: 0.08, knife: 1, clip: 1, alpha: 0.82, bend: 0.35, angle: 0.9 },
  { layer: 2, spacing: 30, size: [110, 34], detail: [-1, 0.5], keep: [-1, 0, 0.85], tol: 0.45, jitter: 0.16, diag: 0.45, accent: 0.12, boil: 0.12, knife: 1, clip: 1, alpha: 0.82, bend: 0.35, angle: 0.9 },
  { layer: 3, spacing: 26, size: [64, 16], detail: [-1, 0.55], keep: [0.35, 0, 0.45], tol: 0.3, jitter: 0.1, diag: 0.3, accent: 0.05, boil: 0.2, knife: 0, clip: 1, alpha: 0.85, bend: 0.25, angle: 0.5 },
  // The board and the pieces, painted as the rest is, in brush strokes
  // that keep to their edges (so the game still reads).
  { layer: 4, spacing: 10, size: [36, 12], detail: [0.4, 2], keep: [-1, 0, 1], tol: 0.22, jitter: 0.13, diag: 0.12, accent: 0.06, boil: 0.3, knife: 0, clip: 0, alpha: 0.92, bend: 0.25, angle: 0.45 },
  { layer: 5, spacing: 6, size: [17, 6], detail: [0.4, 2], keep: [0.12, 0, 0.9], tol: 0.15, jitter: 0.09, diag: 0, accent: 0.03, boil: 0.35, knife: 0, clip: 0, alpha: 0.9, bend: 0.15, angle: 0.35 },
];

/* The painter for one renderer. paint(r, scene, camera, beforeScene)
   draws a frame through the passes (beforeScene(r) runs first, if
   given); in stop mode a frame is only painted when its twelfth of a
   second is due, and the last one held between. */
export function createPainter(renderer, { quality, mode = motionMode(), look } = {}) {
  const L = look || { lift: [0.15, 0.19, 0.27], gamma: 0.86, glow: 0.22, vignette: [0.6, 0.5, 0.58], accents: [[0.96, 0.93, 0.84], [0.97, 0.91, 0.62], [0.6, 0.75, 0.6], [0.66, 0.52, 0.62], [0.24, 0.42, 0.76], [0.9, 0.58, 0.56], [0.42, 0.7, 0.72], [0.86, 0.7, 0.38]] };
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const q = quality ? quality() : { tier: "high" };
  // The painting's size, against the drawing buffer's.
  const SCALE = q.tier === "low" ? 0.55 : q.tier === "mid" ? 0.62 : 0.72;
  const isGL2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
  const hasDepth = isGL2 || !!(renderer.extensions && renderer.extensions.has && renderer.extensions.has("WEBGL_depth_texture"));
  let reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* no media queries */ }
  const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true });
  if (hasDepth) {
    sceneRT.depthTexture = new THREE.DepthTexture(4, 4);
    sceneRT.depthTexture.type = isGL2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
  }
  const flowRT = new THREE.WebGLRenderTarget(4, 4, opts);
  const oilRT = new THREE.WebGLRenderTarget(4, 4, opts);
  const glowA = new THREE.WebGLRenderTarget(4, 4, opts);
  let echoA = new THREE.WebGLRenderTarget(4, 4, opts), echoB = new THREE.WebGLRenderTarget(4, 4, opts);
  const glowB = new THREE.WebGLRenderTarget(4, 4, opts);
  // (Without a depth texture, a 1x1 stand-in so the samplers are bound.)
  const noDepth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  noDepth.needsUpdate = true;
  const depthTex = hasDepth ? sceneRT.depthTexture : noDepth;

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const invZ = new THREE.Vector2(1, 0);
  const common = () => ({ tDepth: { value: depthTex }, uInvZ: { value: invZ }, uHasDepth: { value: hasDepth ? 1 : 0 } });
  const mat = (frag, uniforms, extra) => new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: frag, uniforms: { ...common(), ...uniforms }, depthTest: false, depthWrite: false, ...(extra || null),
  });
  const res = new THREE.Vector2(), scaleU = { value: 1 }, glowStep = new THREE.Vector2();
  const flowMat = mat(FLOW_FRAG, { tScene: { value: sceneRT.texture }, uTexel: { value: new THREE.Vector2() }, uSeed: { value: 0 } });
  const oilMat = mat(OIL_FRAG, { tScene: { value: sceneRT.texture }, tFlow: { value: flowRT.texture }, uTexel: { value: new THREE.Vector2() }, uSeed: { value: 0 },
    uLift: { value: v3(L.lift) }, uGamma: { value: L.gamma },
    ...Object.fromEntries((L.field || [[0, 0, 0], [0.2, 0.2, 0.2], [0.4, 0.4, 0.4], [0.6, 0.6, 0.6], [0.8, 0.8, 0.8], [1, 1, 1]]).map((c, i) => [`uF${i}`, { value: v3(c) }])), tEcho: { value: echoA.texture }, uEchoK: { value: 0.92 } });
  const echoMat = mat(ECHO_FRAG, { tPrev: { value: echoA.texture }, tScene: { value: sceneRT.texture }, uTexel: { value: new THREE.Vector2() }, uDecay: { value: 0.9 } });
  const canvasMat = mat(CANVAS_FRAG, { tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 }, uScale: scaleU, uLine: { value: 0.35 } });
  const baseMat = mat(BASE_FRAG, { tOil: { value: oilRT.texture } });
  const rawMat = mat(BASE_FRAG, { tOil: { value: null } });
  const finishMat = mat(FINISH_FRAG, { tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 }, uScale: scaleU, uLine: { value: 0.35 }, uVig: { value: v3(L.vignette) } }, {
    transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const brightMat = mat(BRIGHT_FRAG, { tOil: { value: oilRT.texture } });
  const blurMat = mat(BLUR_FRAG, { tSrc: { value: null }, uStep: { value: glowStep } });
  const glowMat = mat(GLOW_FRAG, { tSrc: { value: glowA.texture }, uGlow: { value: L.glow } }, {
    transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });

  // Stroke by stroke, where the vertex stage can read the oil and the flow.
  const strokes = !!(renderer.capabilities && renderer.capabilities.vertexTextures);
  const strokeScene = new THREE.Scene();
  const layers = strokes ? LAYERS.map((def, i) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 }, uLayer: { value: def.layer },
        uSpacing: { value: def.spacing }, uSize: { value: new THREE.Vector2(def.size[0], def.size[1]) }, uDetail: { value: new THREE.Vector2(def.detail[0], def.detail[1]) },
        uKeep: { value: new THREE.Vector3(...def.keep) }, uTol: { value: def.tol }, uJitter: { value: def.jitter }, uDiag: { value: def.diag },
        uAccent: { value: def.accent }, uBoil: { value: reduced ? 0 : def.boil }, uKnife: { value: def.knife }, uClip: { value: def.clip }, uAlpha: { value: def.alpha }, uBend: { value: def.bend }, uAngle: { value: def.angle }, uScale: scaleU,
        ...Object.fromEntries(L.accents.map((c, k) => [`uA${k}`, { value: v3(c) }])),
      },
    });
    const mesh = new THREE.Mesh(new THREE.InstancedBufferGeometry(), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = i;
    strokeScene.add(mesh);
    return { def, mesh, mat: m, cols: 0, rows: 0 };
  }) : [];
  // A grid of stroke places for each layer, for this screen.
  function sizeLayers(W, H) {
    layers.forEach((L) => {
      const sp = L.def.spacing * scaleU.value;
      const cols = Math.ceil(W / sp) + 1, rows = Math.ceil(H / sp) + 1;
      L.mat.uniforms.uSpacing.value = sp;
      if (cols === L.cols && rows === L.rows) return;
      L.cols = cols; L.rows = rows;
      const quadGeo = new THREE.PlaneGeometry(2, 2, 8, 1);
      const geo = new THREE.InstancedBufferGeometry();
      geo.setIndex(quadGeo.index);
      geo.setAttribute("position", quadGeo.attributes.position);
      const cells = new Float32Array(cols * rows * 2);
      let k = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { cells[k++] = x - 0.5; cells[k++] = y - 0.5; }
      geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 2));
      geo.instanceCount = cols * rows;
      L.mesh.geometry.dispose();
      L.mesh.geometry = geo;
    });
  }

  const size = new THREE.Vector2();
  let lastFrame = -1, frames = 0, painted = 0, lastW = 0, lastH = 0, lastEcho = 0;
  const stats = { mode, painted: 0, frames: 0, seed: 0, scale: SCALE, size: [0, 0], depth: hasDepth, reduced, strokes, strokeCount: 0 };

  function fit(r) {
    r.getDrawingBufferSize(size);
    const W = Math.max(2, Math.round(size.x)), H = Math.max(2, Math.round(size.y));
    if (W === lastW && H === lastH) return false;
    lastW = W; lastH = H;
    const pw = Math.max(2, Math.round(W * SCALE)), ph = Math.max(2, Math.round(H * SCALE));
    sceneRT.setSize(pw, ph);
    oilRT.setSize(pw, ph);
    flowRT.setSize(Math.max(2, Math.round(pw * 0.5)), Math.max(2, Math.round(ph * 0.5)));
    const gw = Math.max(2, Math.round(W / 4)), gh = Math.max(2, Math.round(H / 4));
    glowA.setSize(gw, gh); glowB.setSize(gw, gh);
    echoA.setSize(pw, ph); echoB.setSize(pw, ph);
    echoMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    flowMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    oilMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    res.set(W, H);
    // Strokes sized to the picture: about the same share of it on a phone
    // as on a monitor.
    scaleU.value = Math.max(0.6, Math.min(W, H) / 900);
    sizeLayers(W, H);
    stats.strokeCount = layers.reduce((n, L) => n + L.cols * L.rows, 0);
    stats.size = [W, H];
    return true;
  }
  function pass(r, m, target) {
    quad.material = m;
    r.setRenderTarget(target);
    r.render(postScene, postCam);
  }

  return {
    mode,
    stats,
    /* Returns true when it has drawn (or is holding) the frame. */
    paint(r, scene, camera, beforeScene, raw) {
      const resized = fit(r);
      frames++;
      const frame = Math.floor(performance.now() / (1000 / PAINT_FPS));
      // Stop-motion: hold the last painting until the next is due.
      if (mode === "stop" && frame === lastFrame && !resized) { stats.frames = frames; return true; }
      const seed = reduced ? 7 : frame % 997;
      const newPainting = frame !== lastFrame;
      lastFrame = frame;
      const prevTarget = r.getRenderTarget();
      const prevAuto = r.autoClear;
      const prevAlpha = r.getClearAlpha();
      if (beforeScene) beforeScene(r);
      // The footage: its alpha (the subject) cleared to 0.
      r.setRenderTarget(sceneRT);
      r.autoClear = true;
      r.setClearAlpha(0);
      r.clear();
      r.render(scene, camera);
      r.setClearAlpha(prevAlpha);
      invZ.set(1 / camera.near, (camera.far - camera.near) / (camera.near * camera.far));
      [flowMat, oilMat, canvasMat, finishMat].forEach((m) => { m.uniforms.uSeed.value = seed; });
      layers.forEach((L) => { L.mat.uniforms.uSeed.value = seed; });
      if (raw) { rawMat.uniforms.tOil.value = sceneRT.texture; pass(r, rawMat, null); r.setRenderTarget(prevTarget); r.autoClear = prevAuto; return true; }
      pass(r, flowMat, flowRT);
      oilMat.uniforms.tEcho.value = echoA.texture;
      pass(r, oilMat, oilRT);
      // The afterimage remembers this painting (its half-life about six tenths of a second).
      const nowMs = performance.now();
      echoMat.uniforms.uDecay.value = lastEcho ? Math.pow(0.5, Math.min(0.5, (nowMs - lastEcho) / 1000) / 0.6) : 0;
      lastEcho = nowMs;
      echoMat.uniforms.tPrev.value = echoA.texture;
      pass(r, echoMat, echoB);
      const sw = echoA; echoA = echoB; echoB = sw;
      // The glow, spread at a quarter size.
      pass(r, brightMat, glowA);
      blurMat.uniforms.tSrc.value = glowA.texture; glowStep.set(1 / glowA.width, 0); pass(r, blurMat, glowB);
      blurMat.uniforms.tSrc.value = glowB.texture; glowStep.set(0, 1 / glowA.height); pass(r, blurMat, glowA);
      if (strokes) {
        // The underpainting, the strokes over it, the finish over all.
        pass(r, baseMat, null);
        r.autoClear = false;
        r.render(strokeScene, postCam);
        pass(r, finishMat, null);
      } else {
        pass(r, canvasMat, null);
        r.autoClear = false;
      }
      pass(r, glowMat, null);
      r.setRenderTarget(prevTarget);
      r.autoClear = prevAuto;
      if (newPainting) painted++;
      stats.painted = painted; stats.frames = frames; stats.seed = seed;
      return true;
    },
    // (For tests: is the GPU path WebGL2.)
    isGL2,
    dispose() {
      [sceneRT, flowRT, oilRT, glowA, glowB, echoA, echoB].forEach((t) => t.dispose());
      if (sceneRT.depthTexture) sceneRT.depthTexture.dispose();
      noDepth.dispose();
      [flowMat, oilMat, echoMat, canvasMat, baseMat, rawMat, finishMat, brightMat, blurMat, glowMat].forEach((m) => m.dispose());
      layers.forEach((L) => { L.mesh.geometry.dispose(); L.mat.dispose(); });
      quad.geometry.dispose();
    },
  };
}
