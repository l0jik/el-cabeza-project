/* Parrish's world: abstract paint (user: "no theme, zero theme"; the
   feeling and style of the references, Enya's "Orinoco Flow" video and
   the "Watermark" cover, not their things).

   The board and its pieces are the subject, kept clean; round them,
   above and below, nothing but colour: wide, slow, drifting fields in one
   of the two palettes (themes/parrish-looks.js), leaning on the
   diagonal, with patches of a second and third colour moving through
   them. parrish-paint.js turns them into palette-knife sweeps.

   The subject and the world are told apart for the paint by the alpha the
   scene writes: the board and the pieces write 1; the dome writes 0.

   The dome hangs off the chassis's boardGroup, so it turns with the board,
   and the light with it. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../engine/constants.js";
import { createPainter } from "./parrish-paint.js";
import { look, lookName } from "./parrish-looks.js";

/* ------------------------------------------------------------ the light */

const KEY_DIR = new THREE.Vector3(0.62, 0.72, 0.42).normalize();
const FILL_DIR = new THREE.Vector3(-0.6, 0.45, 0.65).normalize();
const BACK_DIR = new THREE.Vector3(-0.45, 0.4, -0.8).normalize();

/* What the lacquer and the wood reflect: the palette, in soft bands. */
let ENV = null;
export function parrishEnv() {
  if (ENV) return ENV;
  const L = look();
  const W = 512, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const rgb = (v) => `rgb(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)})`;
  const grad = g.createLinearGradient(0, 0, 0, H);
  [5, 4, 3, 2, 1, 0].forEach((k, i) => grad.addColorStop(i / 5, rgb(L.field[k])));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}

/* ------------------------------------------------------------ the dome */

const DOME_VERT = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DOME_FRAG = `
precision highp float;
uniform float uTime;
uniform vec3 uF0, uF1, uF2, uF3, uF4, uF5;
uniform vec3 uBlot, uBlot2;
uniform float uBias;
varying vec3 vDir;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 0.0)), h13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h13(i + vec3(0.0, 0.0, 1.0)), h13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 1.0)), h13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn3(p); p = p * 2.02 + vec3(5.1, 1.7, 9.3); a *= 0.5; } return s; }
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0) * 5.0;
  if (x < 1.0) return mix(uF0, uF1, x);
  if (x < 2.0) return mix(uF1, uF2, x - 1.0);
  if (x < 3.0) return mix(uF2, uF3, x - 2.0);
  if (x < 4.0) return mix(uF3, uF4, x - 3.0);
  return mix(uF4, uF5, x - 4.0);
}
void main() {
  vec3 d = normalize(vDir);
  // The fields lean: the noise drawn out along one diagonal.
  vec3 q = vec3(d.x * 1.2 + d.y * 0.9, d.y * 3.0 - d.x * 0.6, d.z * 1.2) * 1.4;
  float t = uTime * 0.012;
  vec3 w = vec3(fbm3(q * 1.3 + vec3(t, 0.0, 0.0)), fbm3(q * 1.3 + vec3(3.1, t, 7.0)), fbm3(q * 1.3 + vec3(9.0, 2.0, t)));
  float f = fbm3(q + w * 1.8 + vec3(0.0, t * 0.6, 0.0));
  // Lighter above, deeper below.
  f = f * 1.35 - 0.18 + d.y * 0.22 + uBias;
  vec3 col = ramp(f);
  col = mix(col, uBlot, smoothstep(0.62, 0.72, fbm3(q * 2.3 + w + 11.0)) * 0.65);
  col = mix(col, uBlot2, smoothstep(0.64, 0.74, fbm3(q * 1.9 - w + 23.0)) * 0.6);
  gl_FragColor = vec4(col, 0.0);
}`;

/* ------------------------------------------------------------ the effects */

const RAW = (() => { try { return new URLSearchParams(window.location.search).get("paint") === "raw"; } catch (e) { return false; } })();

export function createParrishEffects(woodSet, { quality }) {
  return function mountAmbientEffects(refs, { three }) {
    const L = look();
    let attachedTo = null, brass = null, dims = "";
    let painter = null;
    let farBefore = null;
    const keyBase = { key: null, fill: null, back: null };
    const lightBase = {};

    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          ...Object.fromEntries(L.field.map((c, i) => [`uF${i}`, { value: v3(c) }])),
          uBlot: { value: v3(L.blot) }, uBlot2: { value: v3(L.blot2) }, uBias: { value: L.bias || 0 },
        },
        vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    dome.name = "parrish-dome";

    function build() {
      const t = three.current;
      if (brass) { if (brass.group.parent) brass.group.parent.remove(brass.group); brass.dispose(); brass = null; }
      if (!dome.parent) t.boardGroup.add(dome);
      brass = woodSet.buildBrass();
      t.boardGroup.add(brass.group);
      dims = `${SLAB_X}x${SLAB_Z}`;
    }

    /* The pixel ratio. A painting needs no more than about one pixel to
       the screen's point (the strokes are wider than any pixel), and every
       pixel costs several passes: capped by the device's tier, lowered a
       step when the frames run slow, raised again when there's room (as
       the den does, den-fx.js govern). */
    const q = quality();
    const PR = q.tier === "low" ? { cap: 1, floor: 0.7 } : q.tier === "mid" ? { cap: 1.25, floor: 0.85 } : { cap: 1.5, floor: 1 };
    let pr = 1, prBefore = null;
    const frameTimes = [];
    let lastFrameAt = 0, lastJudged = 0, lastRaise = 0, settleUntil = 0;
    function setPixelRatio(v) {
      const t = three.current;
      if (!t || !t.renderer) return;
      pr = Math.max(PR.floor, Math.min(v, PR.cap, window.devicePixelRatio || 1));
      t.renderer.setPixelRatio(pr);
      const sz = t.getMountSize && t.getMountSize();
      if (sz) t.renderer.setSize(sz.w, sz.h);
      settleUntil = performance.now() + 1500;
      frameTimes.length = 0;
      if (typeof window !== "undefined") window.__PARRISH_PIXEL_RATIO__ = pr;
    }
    function govern(now) {
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      if (document.hidden || now < settleUntil || dt <= 0 || dt > 250) return;
      frameTimes.push(dt);
      if (frameTimes.length > 120) frameTimes.shift();
      if (now - lastJudged < 2000 || frameTimes.length < 60) return;
      lastJudged = now;
      const sorted = frameTimes.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const slow = sorted[Math.floor(sorted.length * 0.9)];
      if (median > 1000 / 42 && pr > PR.floor + 0.01) setPixelRatio(pr - 0.15);
      else if (slow < 1000 / 56 && pr < Math.min(PR.cap, window.devicePixelRatio || 1) - 0.01 && now - lastRaise > 8000) { lastRaise = now; setPixelRatio(pr + 0.1); }
    }

    function attach() {
      const t = three.current;
      if (!t || !t.boardGroup || !t.renderer) return false;
      if (attachedTo !== t.boardGroup) {
        attachedTo = t.boardGroup;
        dims = "";
        if (dome.parent) dome.parent.remove(dome);
        if (prBefore == null) { prBefore = t.renderer.getPixelRatio(); setPixelRatio(Math.min(window.devicePixelRatio || 1, PR.cap)); }
        if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__PARRISH_THREE__ = t; // tests: read the scene
      }
      if (dims !== `${SLAB_X}x${SLAB_Z}`) build();
      if (t.camera && farBefore == null) { farBefore = t.camera.far; t.camera.far = 2400; t.camera.updateProjectionMatrix(); }
      if (!painter) painter = createPainter(t.renderer, { quality, look: L });
      if (t.lights && !keyBase.key) {
        ["key", "fill", "back"].forEach((k) => {
          const l = t.lights[k];
          if (!l) return;
          keyBase[k] = l.position.clone();
          lightBase[k] = [l.color.getHex(), l.intensity];
          const [c, i] = L.lights[k];
          l.color.setHex(c); l.intensity = i;
        });
      }
      return true;
    }

    const yAxis = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    // The light goes round with the world: the chassis's lights follow it.
    function placeLights() {
      const t = three.current;
      if (!t.lights) return;
      const yaw = t.boardGroup.rotation.y;
      const set = (light, dir, dist) => { if (light) light.position.copy(tmp.copy(dir).applyAxisAngle(yAxis, yaw).multiplyScalar(dist)); };
      set(t.lights.key, KEY_DIR, 15);
      set(t.lights.fill, FILL_DIR, 13);
      set(t.lights.back, BACK_DIR, 13);
    }

    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__PARRISH__ = () => ({ painter: painter ? { ...painter.stats } : null, world: !!dome.parent, mode: painter ? painter.mode : null, look: lookName() });
    }

    return {
      armOnBegin() {},
      restart() {},
      tick(now) {
        if (!attach()) return;
        const t = three.current;
        dome.material.uniforms.uTime.value = now / 1000;
        placeLights();
        woodSet.followGrain(t);
        govern(now);
      },
      // The frame through the paint (the chassis's render hook).
      render(r, scn, camera) {
        if (!painter || !dome.parent) return false;
        // (?paint=raw: the footage, unpainted, for comparing.)
        return painter.paint(r, scn, camera, null, RAW);
      },
      dispose() {
        const t = three.current;
        if (dome.parent) dome.parent.remove(dome);
        if (brass && brass.group.parent) brass.group.parent.remove(brass.group);
        if (brass) brass.dispose();
        dome.geometry.dispose(); dome.material.dispose();
        if (painter) painter.dispose();
        if (t && t.camera && farBefore != null) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
        if (t && t.lights) ["key", "fill", "back"].forEach((k) => {
          const l = t.lights[k];
          if (!l) return;
          if (keyBase[k]) l.position.copy(keyBase[k]);
          if (lightBase[k]) { l.color.setHex(lightBase[k][0]); l.intensity = lightBase[k][1]; }
        });
        if (t && t.renderer && prBefore != null) { t.renderer.setPixelRatio(prBefore); const sz = t.getMountSize && t.getMountSize(); if (sz) t.renderer.setSize(sz.w, sz.h); }
      },
    };
  };
}
