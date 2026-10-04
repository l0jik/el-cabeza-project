/* Parrish's paint: the frame, repainted as oil on canvas.

   The user's brief: live footage of the pieces, the board and the
   landscape, rotoscoped and animated frame by frame so it moves like an
   oil painting (after Maxfield Parrish). Here the "footage" is the live
   3D scene; each frame is drawn to a texture (its colours and its depth)
   and painted over in three passes:

     1. FLOW (a little under half the painting's size): which way the
        brush goes at every point. The structure tensor of the frame's
        brightness (gradients summed over a neighbourhood), stored as its
        orientation (a doubled angle, so it blends); with it how near the
        point is to the board (from the depth: the board and its pieces
        are painted finely, the far terrace and the sky broadly, as a
        painter leaves the distance loose) and how strong its edge is.
     2. OIL (the painting's size, under the screen's): the colours laid
        down along that flow, a two-sided Kuwahara filter running along
        the stroke: of the paint just to each side of the stroke the
        calmer side wins, so flat areas flatten into strokes of paint and
        edges stay sharp. Then the palette: glazed midtones, the shadows
        a little blue, the lights a little gold. And the rotoscoped line:
        where the depth jumps (a piece against the board, a column against
        the sky), the outline of the thing nearer.
     3. CANVAS (full size, to the screen): the brushstrokes themselves.
        Three layers of dabs (broad, medium, fine where there is detail),
        each dab one colour picked up from the oil at its middle, lying
        along the flow, with bristle streaks, its raised ridge lit from
        the upper left (impasto). A dab stops at an edge (it's laid
        only where its colour belongs), so the squares and the pieces
        keep their shapes. The outline traced in a broken umber line; the
        canvas weave under it all; a varnish vignette.

   The motion (user: samples of each to review):
     "boil"  the scene moves smoothly, every frame, but the strokes are
             repainted 12 times a second: each repainting lays them down
             anew (new places, a little turned, a little different in
             colour), so the paint boils like a painted film's.
     "stop"  true stop-motion: the whole picture is a new painting 12
             times a second and held in between, the pieces' moves too.
   ?motion=boil|stop in the address picks one (the default is boil).
   With reduced motion asked for, the strokes don't boil.

   Costs: passes 1 and 2 run below screen size (the painting gains from
   it), the heavy filter where there are fewest pixels; pass 3 is a few
   lookups a pixel. The device's tier (tienda-quality.js) sets the
   painting's size. */

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

const COMMON = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
uniform vec2 uInvZ;      // 1/distance = uInvZ.x - uInvZ.y * depth
uniform float uHasDepth;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// One over the distance from the camera (0 at the sky).
float invZ(vec2 uv) { return max(uInvZ.x - uInvZ.y * texture2D(tDepth, uv).x, 0.0); }
`;

/* 1. The flow. A 5x5 grid of brightness around the point (two texels
   apart), central differences at its inner 3x3, summed into the
   structure tensor. Out: (cos 2a, sin 2a) of the stroke's direction
   (along the edges), how near the board the point is, edge strength.
   Where there is no edge to follow (open sky, still water) a painter's
   own sweep takes over: long, nearly level strokes, slowly turning
   across the picture. */
const FLOW_FRAG = COMMON + `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uSeed;
uniform vec2 uFocus;     // full detail nearer than x, none beyond y
void main() {
  float L[25];
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
    vec2 o = vec2(float(i) - 2.0, float(j) - 2.0) * uTexel * 2.0;
    L[j * 5 + i] = luma(texture2D(tScene, vUv + o).rgb);
  }
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
  // The painter's own sweep where nothing leads the brush.
  float lead = smoothstep(0.004, 0.03, strength) * smoothstep(0.05, 0.35, aniso);
  float a0 = (vnoise(vUv * vec2(2.2, 3.0) + uSeed * 0.013) - 0.5) * 0.9 + (vnoise(vUv * 9.0 + 7.0) - 0.5) * 0.35;
  vec2 d0 = vec2(cos(2.0 * a0), sin(2.0 * a0));
  vec2 d1 = vec2(t.x * t.x - t.y * t.y, 2.0 * t.x * t.y);
  vec2 d = normalize(mix(d0, d1, lead) + vec2(1e-5, 0.0));
  // How near the board: from the depth (without it, a middling detail).
  float iz = invZ(vUv);
  float dist = iz > 1e-5 ? 1.0 / iz : 1e5;
  float detail = mix(0.55, 1.0 - smoothstep(uFocus.x, uFocus.y, dist), uHasDepth);
  gl_FragColor = vec4(d * 0.5 + 0.5, detail, clamp(strength * 4.0, 0.0, 1.0));
}`;

/* 2. The oil, and the outline. */
const OIL_FRAG = COMMON + `
uniform sampler2D tScene;
uniform sampler2D tFlow;
uniform vec2 uTexel;
uniform float uSeed;
vec2 dirAt(vec4 f) {
  vec2 d2 = f.xy * 2.0 - 1.0;
  float a = 0.5 * atan(d2.y, d2.x);
  return vec2(cos(a), sin(a));
}
/* The palette: Parrish's glazes. Dull colours given more colour (not the
   bright ones: vibrance), the shadows a little blue, the lights gold. */
vec3 grade(vec3 c) {
  float l = luma(c);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  vec3 g = mix(vec3(l), c, 1.0 + 0.4 * (1.0 - smoothstep(0.12, 0.55, sat)));
  g *= mix(vec3(0.88, 0.92, 1.1), vec3(1.0), smoothstep(0.03, 0.4, l));
  g = mix(g, g * vec3(1.07, 1.0, 0.86), smoothstep(0.55, 0.95, l));
  return clamp(g, 0.0, 1.0);
}
void main() {
  vec4 f = texture2D(tFlow, vUv);
  float detail = f.z;
  vec2 t = dirAt(f);
  // The stroke wanders a little from one repainting to the next.
  float wob = (hash12(floor(vUv * 64.0) + uSeed) - 0.5) * 0.18;
  t = vec2(t.x * cos(wob) - t.y * sin(wob), t.x * sin(wob) + t.y * cos(wob));
  vec2 n = vec2(-t.y, t.x);
  // Shorter, narrower strokes near the board.
  vec2 stepT = t * uTexel * mix(1.8, 0.85, detail);
  vec2 stepN = n * uTexel * mix(1.8, 0.8, detail);
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
  // Some of the stroke's own middle, so fine marks aren't lost (more of it
  // near the board: the grid's lines, the pieces' grain).
  vec3 mid = texture2D(tScene, vUv).rgb;
  c = mix(c, mid, mix(0.15, 0.42, detail));
  // The rotoscoped line: where the nearness (one over the distance) jumps
  // away round this point, the edge of something in front of what's
  // behind it. Only the near side is drawn, so the line sits on the
  // thing's own edge.
  float line = 0.0;
  if (uHasDepth > 0.5) {
    float zc = invZ(vUv);
    float lap = invZ(vUv + vec2(uTexel.x, 0.0)) + invZ(vUv - vec2(uTexel.x, 0.0)) + invZ(vUv + vec2(0.0, uTexel.y)) + invZ(vUv - vec2(0.0, uTexel.y)) - 4.0 * zc;
    float rel = -lap / max(zc, 1e-4);
    line = smoothstep(0.06, 0.2, rel);
  } else {
    float lx = luma(texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb) - luma(texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb);
    float ly = luma(texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb) - luma(texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb);
    line = smoothstep(0.18, 0.4, length(vec2(lx, ly)));
  }
  gl_FragColor = vec4(grade(c), line);
}`;

/* 3. The canvas: the brushstrokes, the outline, the weave. */
const CANVAS_FRAG = COMMON + `
uniform sampler2D tOil;
uniform sampler2D tFlow;
uniform vec2 uRes;       // the screen, in pixels
uniform float uSeed;
uniform float uScale;    // stroke size for this screen
uniform float uLine;     // the outline's strength
vec2 dirAt(vec4 f) {
  vec2 d2 = f.xy * 2.0 - 1.0;
  float a = 0.5 * atan(d2.y, d2.x);
  return vec2(cos(a), sin(a));
}
/* One layer of dabs: rotate the pixel into the stroke's frame, find the
   dab it lies in (a brick of len x wid, rows shifted, all reshuffled each
   repainting), its colour (the oil at its middle), its mask (a long oval,
   tapering at the ends; none where the dab's colour isn't this pixel's:
   a stroke stops at an edge) and its bristles. Returns the colour, mask
   in .w; in lit, how the raised paint of the stroke takes the light from
   the upper left (a ridge along the stroke: its side toward the light
   brighter, the other darker). */
vec4 dabs(vec2 px, vec2 t, vec3 here, float len, float wid, float layer, float cover, float tol, float jitter, out float lit) {
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
  // Dabs overlap their bricks a little, and sit a little off centre.
  lc += (rnd - 0.5) * vec2(0.3, 0.25);
  float e = pow(abs(lc.x) * 2.0 / 1.15, 3.0) + pow(abs(lc.y) * 2.0 / 1.25, 2.0);
  float mask = (1.0 - smoothstep(0.55, 1.0, e)) * step(rnd.x, cover);
  // The dab's middle, back in screen space.
  vec2 cq = vec2((cell.x + 0.5) * len - shift, (cell.y + 0.5 - rowOff) * wid);
  vec2 cpx = tj * cq.x + vec2(-tj.y, tj.x) * cq.y;
  vec3 col = texture2D(tOil, cpx / uRes).rgb;
  // Laid only where its colour belongs.
  mask *= 1.0 - smoothstep(tol * 0.5, tol, distance(col, here));
  // Each dab mixed a touch differently on the palette: lighter or
  // darker, warmer or cooler (broken colour).
  col *= 1.0 + (rnd.y - 0.5) * jitter;
  float warm = hash12(cell + uSeed * 0.71) - 0.5;
  col *= 1.0 + warm * jitter * vec3(0.6, 0.0, -0.7);
  // The bristles: streaks along the stroke, a few pixels apart (never
  // finer than the screen can show).
  float bristle = vnoise(vec2(lc.x * 2.5 + rnd.x * 10.0, lc.y * max(1.0, wid / 3.2) + rnd.y * 20.0));
  col *= 0.94 + 0.12 * bristle;
  vec2 ridge = tj * lc.x * 0.5 + vec2(-tj.y, tj.x) * lc.y * 2.0;
  lit = dot(ridge, vec2(-0.7071, 0.7071));
  return vec4(col, mask);
}
void main() {
  vec2 px = vUv * uRes;
  vec4 f = texture2D(tFlow, vUv);
  vec2 t = dirAt(f);
  float detail = f.z, strength = f.w;
  vec4 oil = texture2D(tOil, vUv);
  vec3 base = oil.rgb;
  vec3 col = base;
  // Finer strokes, and a stricter eye for edges, near the board.
  float s = uScale * mix(1.0, 0.62, detail);
  float tol = mix(0.3, 0.14, detail);
  float l0, l1, l2, shade = 0.0, cover = 0.0;
  vec4 d0 = dabs(px, t, base, 34.0 * s, 10.0 * s, 1.0, 0.95, tol, 0.1, l0);
  col = mix(col, d0.rgb, d0.w * 0.85); shade = mix(shade, l0, d0.w); cover = max(cover, d0.w);
  vec4 d1 = dabs(px + 17.0, t, base, 21.0 * s, 7.0 * s, 2.0, 0.7, tol, 0.08, l1);
  col = mix(col, d1.rgb, d1.w * 0.8); shade = mix(shade, l1, d1.w); cover = max(cover, d1.w);
  // The fine strokes only where there's something to draw.
  vec4 d2 = dabs(px + 41.0, t, base, 12.0 * s, 4.2 * s, 3.0, 0.85 * smoothstep(0.25, 0.65, strength), tol, 0.04, l2);
  col = mix(col, d2.rgb, d2.w * 0.85); shade = mix(shade, l2, d2.w); cover = max(cover, d2.w);
  // The raised paint, lit from the upper left.
  col *= 1.0 + shade * 0.1;
  // The outline, in umber, broken and redrawn with each repainting.
  float broken = 0.55 + 0.45 * smoothstep(0.3, 0.6, vnoise(vec2(dot(px, t), dot(px, vec2(-t.y, t.x))) * vec2(0.05, 0.4) / uScale + uSeed * 3.1));
  col = mix(col, col * vec3(0.36, 0.28, 0.24), oil.a * broken * uLine);
  // The canvas: a weave, and the ground showing a little in the thin places.
  vec2 wv = px / (2.4 * max(uScale, 0.6));
  float weave = sin(wv.x * 3.14159) * sin(wv.y * 3.14159) * 0.5 + 0.5;
  float tooth = vnoise(wv * 0.9);
  float thin = 1.0 - cover;
  col *= 1.0 + ((weave * 0.5 + tooth * 0.5) - 0.5) * (0.02 + 0.035 * thin);
  // The varnish, darker and warmer to the corners.
  float v = length((vUv - 0.5) * vec2(1.0, uRes.y / uRes.x * 0.9));
  col = mix(col, col * vec3(0.8, 0.72, 0.62), smoothstep(0.5, 0.98, v) * 0.5);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* 3, stroke by stroke (where the GPU can read textures in its vertex
   stage, as nearly all can; the per-pixel dabs above are the fallback):
   a grid of brushstrokes for each layer, each one placed (jittered off its
   grid point, reshuffled with each repainting), turned along the flow,
   coloured from the oil at its middle, and cut short where the colour
   ahead of it or behind it changes, narrowed where it changes beside it
   (a stroke stops at an edge: the squares and the pieces keep their
   shapes). Then drawn as a real stroke: rounded where the brush came down,
   tapering where it lifted, the bristles' grooves along it, the paint
   running dry at its tail, its ridge lit from the upper left. Laid broad
   first, then finer where there's detail, over the oil as an
   underpainting; then the finish (the outline, the weave, the varnish)
   multiplied over it all. */
const STROKE_VERT = `
precision highp float;
uniform sampler2D tOil;
uniform sampler2D tFlow;
uniform vec2 uRes;
uniform float uSeed;
uniform float uLayer;
uniform float uSpacing;   // px between grid points
uniform vec2 uSize;       // a stroke's length and width, px
uniform vec3 uKeep;       // laid where max(strength, detail * y) > x, with chance z
uniform float uTol;       // how far the colour may change under it
uniform float uJitter;    // how far each stroke's colour wanders
uniform float uScale;
attribute vec2 aCell;
varying vec2 vLocal;
varying vec3 vColor;
varying float vRnd;
varying vec2 vEnds;
varying vec2 vDir;
varying float vWid;
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec2 dirAt(vec4 f) {
  vec2 d2 = f.xy * 2.0 - 1.0;
  float a = 0.5 * atan(d2.y, d2.x);
  return vec2(cos(a), sin(a));
}
float off(vec2 p, vec3 c0, float tol) { return step(tol, distance(texture2D(tOil, p / uRes).rgb, c0)); }
void main() {
  vec2 r1 = hash22(aCell + vec2(uLayer * 17.31, uSeed * 0.917));
  vec2 r2 = hash22(aCell.yx * 1.37 + vec2(uSeed * 0.531, uLayer * 5.13));
  vec2 r3 = hash22(aCell * 0.71 + vec2(uLayer * 2.9, uSeed * 1.71));
  vec2 c = (aCell + 0.5 + (r1 - 0.5) * 0.9) * uSpacing;
  vec2 uv = c / uRes;
  vec4 f = texture2D(tFlow, uv);
  float detail = f.z, strength = f.w;
  float laid = step(uKeep.x, max(strength, detail * uKeep.y)) * step(r2.x, uKeep.z);
  vec2 t = dirAt(f);
  float ang = (r3.x - 0.5) * 0.35;
  t = vec2(t.x * cos(ang) - t.y * sin(ang), t.x * sin(ang) + t.y * cos(ang));
  vec2 n = vec2(-t.y, t.x);
  // Smaller near the board, and a stricter eye for its edges.
  float k = uScale * mix(1.0, 0.62, detail) * (0.8 + 0.4 * r2.y);
  float len = uSize.x * k, wid = uSize.y * k;
  float tol = uTol * mix(1.0, 0.55, detail);
  vec3 c0 = texture2D(tOil, uv).rgb;
  float fwd = 1.0 - 0.45 * off(c + t * len * 0.5, c0, tol);
  fwd = min(fwd, 1.0 - 0.75 * off(c + t * len * 0.25, c0, tol));
  float back = 1.0 - 0.45 * off(c - t * len * 0.5, c0, tol);
  back = min(back, 1.0 - 0.75 * off(c - t * len * 0.25, c0, tol));
  float side = 1.0 - 0.45 * max(off(c + n * wid * 0.5, c0, tol), off(c - n * wid * 0.5, c0, tol));
  float ax = position.x < 0.0 ? -back : fwd;
  vec2 p = c + t * (ax * len * 0.5) + n * (position.y * wid * 0.5 * side);
  gl_Position = laid > 0.5 ? vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  vLocal = vec2(ax, position.y);
  vEnds = vec2(-back, fwd);
  // Each stroke mixed a touch differently on the palette: lighter or
  // darker, warmer or cooler (broken colour).
  vColor = c0 * (1.0 + (r3.y - 0.5) * uJitter) * (1.0 + (r1.y - 0.5) * uJitter * vec3(0.6, 0.0, -0.7));
  vRnd = r1.x * 37.0 + r2.y * 11.0;
  vDir = t;
  vWid = wid * side;
}`;
const STROKE_FRAG = `
precision highp float;
varying vec2 vLocal;
varying vec3 vColor;
varying float vRnd;
varying vec2 vEnds;
varying vec2 vDir;
varying float vWid;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  // u: 0 where the brush came down, 1 where it lifted; y: across, -1..1.
  float u = (vLocal.x - vEnds.x) / max(vEnds.y - vEnds.x, 1e-3);
  float y = vLocal.y;
  float halfW = mix(0.72, 1.0, smoothstep(0.0, 0.2, u)) * mix(1.0, 0.5, smoothstep(0.6, 1.0, u));
  float a = 1.0 - smoothstep(0.78, 1.0, abs(y) / halfW);
  a *= smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.9, 1.0, u));
  // The bristles' grooves, a few pixels apart (never finer than the
  // screen can show); toward the tail the paint runs dry between them.
  float grooves = max(1.0, vWid / 2.6);
  float br = vnoise(vec2(u * 2.5 + vRnd, y * grooves + vRnd * 1.7));
  float dry = vnoise(vec2(u * 1.2 + vRnd * 2.3, y * grooves * 0.8 + vRnd));
  a *= 1.0 - smoothstep(0.5, 0.95, u) * smoothstep(0.4, 0.75, dry) * 0.9;
  vec3 col = vColor * (0.93 + 0.14 * br);
  // The ridge of paint, lit from the upper left.
  vec2 nrm = vec2(-vDir.y, vDir.x) * y * 0.9 + vDir * (u - 0.5) * 0.3;
  col *= 1.0 + dot(nrm, vec2(-0.7071, 0.7071)) * 0.12;
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
vec2 dirAt(vec4 f) {
  vec2 d2 = f.xy * 2.0 - 1.0;
  float a = 0.5 * atan(d2.y, d2.x);
  return vec2(cos(a), sin(a));
}
void main() {
  vec2 px = vUv * uRes;
  vec2 t = dirAt(texture2D(tFlow, vUv));
  // The outline, in umber, broken and redrawn with each repainting.
  float line = texture2D(tOil, vUv).a;
  float broken = 0.55 + 0.45 * smoothstep(0.3, 0.6, vnoise(vec2(dot(px, t), dot(px, vec2(-t.y, t.x))) * vec2(0.05, 0.4) / uScale + uSeed * 3.1));
  vec3 k = mix(vec3(1.0), vec3(0.36, 0.28, 0.24), line * broken * uLine);
  // The canvas's weave and tooth, faintly through the paint.
  vec2 wv = px / (2.4 * max(uScale, 0.6));
  float weave = sin(wv.x * 3.14159) * sin(wv.y * 3.14159) * 0.5 + 0.5;
  k *= 1.0 - (weave * 0.5 + vnoise(wv * 0.9) * 0.5) * 0.035;
  // The varnish, darker and warmer to the corners.
  float v = length((vUv - 0.5) * vec2(1.0, uRes.y / uRes.x * 0.9));
  k *= mix(vec3(1.0), vec3(0.8, 0.72, 0.62), smoothstep(0.5, 0.98, v) * 0.5);
  gl_FragColor = vec4(k, 1.0);
}`;
// The layers: grid spacing and stroke size (px, on a screen 900 px across
// its short side), where each is laid, how strictly it keeps to its colour,
// how far its colour wanders.
const LAYERS = [
  { layer: 1, spacing: 9, size: [34, 11], keep: [-1, 0, 1], tol: 0.32, jitter: 0.12 },
  { layer: 2, spacing: 6.5, size: [22, 7.5], keep: [0.12, 0.3, 0.9], tol: 0.24, jitter: 0.1 },
  { layer: 3, spacing: 4.5, size: [13, 4.5], keep: [0.3, 0, 0.9], tol: 0.16, jitter: 0.06 },
];

/* The painter for one renderer. paint(r, scene, camera, beforeScene, focus)
   draws a frame through the three passes (beforeScene(r) runs first, for
   the pool's reflection; focus: [near, far], the distances over which the
   detail falls away); in stop mode a frame is only painted when its
   twelfth of a second is due, and the last one held between. */
export function createPainter(renderer, { quality, mode = motionMode() } = {}) {
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
  const mat = (frag, uniforms) => new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: frag, uniforms: { ...common(), ...uniforms }, depthTest: false, depthWrite: false,
  });
  const focus = new THREE.Vector2(20, 60);
  const flowMat = mat(FLOW_FRAG, { tScene: { value: sceneRT.texture }, uTexel: { value: new THREE.Vector2() }, uSeed: { value: 0 }, uFocus: { value: focus } });
  const oilMat = mat(OIL_FRAG, { tScene: { value: sceneRT.texture }, tFlow: { value: flowRT.texture }, uTexel: { value: new THREE.Vector2() }, uSeed: { value: 0 } });
  const res = new THREE.Vector2(), scaleU = { value: 1 };
  const canvasMat = mat(CANVAS_FRAG, {
    tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 },
    uScale: scaleU, uLine: { value: 0.75 },
  });

  // Stroke by stroke, where the vertex stage can read the oil and the flow.
  const strokes = !!(renderer.capabilities && renderer.capabilities.vertexTextures);
  const baseMat = mat(BASE_FRAG, { tOil: { value: oilRT.texture } });
  const finishMat = mat(FINISH_FRAG, { tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 }, uScale: scaleU, uLine: { value: 0.75 } });
  Object.assign(finishMat, {
    transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const strokeScene = new THREE.Scene();
  const layers = strokes ? LAYERS.map((def, i) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        tOil: { value: oilRT.texture }, tFlow: { value: flowRT.texture }, uRes: { value: res }, uSeed: { value: 0 }, uLayer: { value: def.layer },
        uSpacing: { value: def.spacing }, uSize: { value: new THREE.Vector2(def.size[0], def.size[1]) }, uKeep: { value: new THREE.Vector3(...def.keep) },
        uTol: { value: def.tol }, uJitter: { value: def.jitter }, uScale: scaleU,
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
      const cols = Math.ceil(W / sp), rows = Math.ceil(H / sp);
      L.mat.uniforms.uSpacing.value = sp;
      if (cols === L.cols && rows === L.rows) return;
      L.cols = cols; L.rows = rows;
      const quadGeo = new THREE.PlaneGeometry(2, 2);
      const geo = new THREE.InstancedBufferGeometry();
      geo.setIndex(quadGeo.index);
      geo.setAttribute("position", quadGeo.attributes.position);
      const cells = new Float32Array(cols * rows * 2);
      let k = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { cells[k++] = x; cells[k++] = y; }
      geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 2));
      geo.instanceCount = cols * rows;
      L.mesh.geometry.dispose();
      L.mesh.geometry = geo;
    });
  }

  const size = new THREE.Vector2();
  let lastFrame = -1, frames = 0, painted = 0, lastW = 0, lastH = 0;
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
    paint(r, scene, camera, beforeScene, focusRange) {
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
      if (beforeScene) beforeScene(r);
      r.setRenderTarget(sceneRT);
      r.autoClear = true;
      r.clear();
      r.render(scene, camera);
      invZ.set(1 / camera.near, (camera.far - camera.near) / (camera.near * camera.far));
      if (focusRange) focus.set(focusRange[0], focusRange[1]);
      flowMat.uniforms.uSeed.value = seed;
      oilMat.uniforms.uSeed.value = seed;
      canvasMat.uniforms.uSeed.value = seed;
      finishMat.uniforms.uSeed.value = seed;
      layers.forEach((L) => { L.mat.uniforms.uSeed.value = seed; });
      pass(r, flowMat, flowRT);
      pass(r, oilMat, oilRT);
      if (strokes) {
        // The underpainting, the strokes over it, the finish over all.
        pass(r, baseMat, null);
        r.autoClear = false;
        r.render(strokeScene, postCam);
        pass(r, finishMat, null);
      } else {
        pass(r, canvasMat, null);
      }
      r.setRenderTarget(prevTarget);
      r.autoClear = prevAuto;
      if (newPainting) painted++;
      stats.painted = painted; stats.frames = frames; stats.seed = seed;
      return true;
    },
    // (For tests: is the GPU path WebGL2.)
    isGL2,
    dispose() {
      [sceneRT, flowRT, oilRT].forEach((t) => t.dispose());
      if (sceneRT.depthTexture) sceneRT.depthTexture.dispose();
      noDepth.dispose();
      [flowMat, oilMat, canvasMat, baseMat, finishMat].forEach((m) => m.dispose());
      layers.forEach((L) => { L.mesh.geometry.dispose(); L.mat.dispose(); });
      quad.geometry.dispose();
    },
  };
}
