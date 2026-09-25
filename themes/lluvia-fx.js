/* Lluvia's scene life.

   - The city. A second canvas, laid under the board's own (which is
     transparent), runs the Lluvia city engine in its "backdrop" mode: a
     slow drift down the wet avenue. It renders at a modest resolution and
     frame rate, since it's scenery behind a game and shares the GPU.
   - Rain around the board: a few hundred wind-slanted streaks falling
     past it and recycling.
   - Drops on the board: small rings opening in the wet surface, a few a
     second, anywhere on it.
   - Splash: when a piece comes to rest, a wider ring spreads from it.
   - Lightning: when the score schedules thunder (themes/lluvia-bus.js),
     the sky flashes twice and the board catches the light. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../engine/constants.js";
import { LLUVIA } from "./lluvia-city.js";
import { bus } from "./lluvia-bus.js";

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = `
  uniform float uR, uStr;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float w = 0.05 + uR * 0.06;
    float ring = exp(-pow((r - uR) / w, 2.0));
    gl_FragColor = vec4(uColor * ring * uStr * step(r, 1.0), 1.0);
  }
`;

function ringMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uR: { value: 0 }, uStr: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: VERT, fragmentShader: RING_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8,
  });
}

export function mountAmbientEffects(refs, { three, windingDownRef }) {
  const group = new THREE.Group();
  group.name = "lluvia-fx";
  let attachedTo = null;

  /* ---- the city, behind the board ---- */
  let city = null, cityCanvas = null, vignette = null, flash = null;
  function mountCity() {
    const overlay = refs.fxOverlayRef && refs.fxOverlayRef.current;
    const layer = overlay && overlay.parentElement;
    if (!layer || cityCanvas) return;
    cityCanvas = document.createElement("canvas");
    cityCanvas.setAttribute("data-testid", "lluvia-city");
    cityCanvas.setAttribute("aria-hidden", "true");
    Object.assign(cityCanvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", filter: "brightness(0.62) saturate(1.05)" });
    vignette = document.createElement("div");
    Object.assign(vignette.style, { position: "absolute", inset: "0", pointerEvents: "none", background: "radial-gradient(ellipse 75% 70% at 50% 45%, rgba(5,4,10,0) 40%, rgba(5,4,10,0.7) 100%)" });
    flash = document.createElement("div");
    Object.assign(flash.style, { position: "absolute", inset: "0", pointerEvents: "none", background: "radial-gradient(ellipse at 50% 10%, rgba(210,220,255,0.55), rgba(160,170,255,0.12) 60%, rgba(0,0,0,0) 100%)", opacity: "0" });
    layer.insertBefore(flash, layer.firstChild);
    layer.insertBefore(vignette, flash);
    layer.insertBefore(cityCanvas, vignette);
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    city = LLUVIA.mount(cityCanvas, { mode: "backdrop", dpr: lowPower ? 0.6 : 0.85, fps: lowPower ? 24 : 30 });
  }

  /* ---- rain around the board ---- */
  const RAIN = 520, rainPos = new Float32Array(RAIN * 6), rainV = new Float32Array(RAIN);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb8c6ff, transparent: true, opacity: 0.26, depthWrite: false }));
  rain.frustumCulled = false;
  group.add(rain);
  const span = () => Math.max(SLAB_X, SLAB_Z) * 0.9 + 3;
  function resetDrop(i, anyHeight) {
    const sp = span(), x = (Math.random() - 0.5) * sp * 2, z = (Math.random() - 0.5) * sp * 2;
    const y = anyHeight ? Math.random() * 12 : 10 + Math.random() * 3, L = 0.25 + Math.random() * 0.35;
    rainV[i] = 11 + Math.random() * 6;
    rainPos.set([x, y, z, x - 0.04, y - L, z + 0.015], i * 6);
  }
  for (let i = 0; i < RAIN; i++) resetDrop(i, true);

  /* ---- drops and splashes on the board ---- */
  const rings = [];
  function spawnRing(x, z, reach, life, peak, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2, reach * 2), ringMaterial(color));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    m.renderOrder = 3;
    group.add(m);
    rings.push({ m, born: performance.now(), life, peak });
  }
  let nextDrop = 0;

  // A piece whose square changed and then held still: it has landed.
  // (Same rule as Cromo's shimmer; several at once is a new board.)
  const lastPos = new Map();
  function watchLandings() {
    const t = three.current;
    if (!t || !t.pieceGroup) return;
    const changed = [];
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId;
      const key = `${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`;
      const rec = lastPos.get(id);
      if (!rec) { lastPos.set(id, { key, still: 99, pending: false }); return; }
      if (rec.key !== key) { changed.push(rec); rec.key = key; rec.still = 0; rec.pending = true; }
      else if (rec.pending && ++rec.still === 4) {
        rec.pending = false;
        if (!rec.bulk) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox, size = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
          spawnRing(o.position.x, o.position.z, size * 1.2 + 1.1, 900, 0.34, id.startsWith("dark") ? 0x8ff4ff : 0xffb0e4);
        }
      }
    });
    const bulk = changed.length > 2;
    changed.forEach((rec) => { rec.bulk = bulk; });
  }

  /* ---- lightning ---- */
  let strikes = [];
  let hemi = null, hemiBase = 0;
  const offThunder = bus.on("thunder", (delay, level) => {
    const at = performance.now() + Math.max(0, delay * 1000 - 120); // light arrives before the sound
    const k = Math.min(1, 0.45 + (level || 0.12) * 3);
    strikes.push({ at, k }, { at: at + 170 + Math.random() * 120, k: k * 0.7 });
  });

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup) return false;
    if (attachedTo !== t.boardGroup) { t.boardGroup.add(group); attachedTo = t.boardGroup; }
    if (!hemi && t.scene) t.scene.traverse((o) => { if (!hemi && o.isHemisphereLight) { hemi = o; hemiBase = o.intensity; } });
    if (!cityCanvas) mountCity();
    return true;
  }

  let last = performance.now();
  return {
    armOnBegin() {},
    restart() {},
    tick(now) {
      if (!attach()) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      // Rain.
      for (let i = 0; i < RAIN; i++) {
        const d = rainV[i] * dt, o = i * 6;
        rainPos[o + 1] -= d; rainPos[o + 4] -= d;
        rainPos[o] -= d * 0.08; rainPos[o + 3] -= d * 0.08;
        if (rainPos[o + 4] < -1.5) resetDrop(i, false);
      }
      rainGeo.attributes.position.needsUpdate = true;
      // Drops on the board: a few a second, fewer once the game is over.
      const winding = !!(windingDownRef && windingDownRef.current);
      if (now > nextDrop) {
        spawnRing((Math.random() - 0.5) * SLAB_X * 0.94, (Math.random() - 0.5) * SLAB_Z * 0.94, 0.28 + Math.random() * 0.18, 650, 0.2, 0xc8d4ff);
        nextDrop = now + (winding ? 700 : 150) + Math.random() * 260;
      }
      watchLandings();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], u = (now - r.born) / r.life;
        if (u >= 1) { group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
        r.m.material.uniforms.uR.value = 0.06 + (1 - Math.pow(1 - u, 3)) * 0.86;
        r.m.material.uniforms.uStr.value = r.peak * (1 - u) * Math.min(1, u * 10);
      }
      // Lightning: two quick flashes, the board lit with them.
      let lit = 0;
      strikes = strikes.filter((s) => {
        const u = (now - s.at) / 220;
        if (u < 0) return true;
        if (u > 1) return false;
        lit = Math.max(lit, s.k * (1 - u) * (u < 0.15 ? u / 0.15 : 1));
        return true;
      });
      if (flash) flash.style.opacity = lit.toFixed(3);
      if (hemi) hemi.intensity = hemiBase * (1 + lit * 2.5);
    },
    dispose() {
      offThunder();
      rings.forEach((r) => { group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); });
      rainGeo.dispose(); rain.material.dispose();
      if (attachedTo) attachedTo.remove(group);
      if (city) city.destroy();
      [cityCanvas, vignette, flash].forEach((el) => el && el.remove());
    },
  };
}
