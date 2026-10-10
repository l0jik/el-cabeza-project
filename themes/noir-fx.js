/* Noir's scene life: the city round the board (noir-city.js), the night
   over it, the rain, and the print it is all seen on.

   - The city hangs on the chassis's boardGroup, so it turns with the
     board, and is laid out again whenever the board changes size. The
     moon (the key light) turns with it too, as Luna's sun does: the
     chassis turns the board, not the camera, and a city turned under a
     still light would swing every shadow in it as the view was dragged.
   - The sky follows the camera: low cloud lit from under by the city, a
     moon behind it, black overhead. The fog is the cloud's grey, kept a
     little beyond the board wherever the camera is.
   - Rain round the board, falling a little slanted; a ring on the wet
     street where a piece comes down; steam from a manhole by the kerb;
     three searchlights crossing the cloud from beyond the city; now and
     then lightning (and the thunder after it, noir-audio.js).
   - The piece picked up stands in a pool of light, as if a lamp just out
     of shot had found it.
   - Over the picture: a vignette and a fine moving grain, as on a print of
     the film. All of it rebuilds or disposes cleanly; nothing here touches
     play. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, OFF_X, OFF_Z, MARGIN } from "../engine/constants.js";
import { buildCity, glowTex, FOCUS } from "./noir-city.js";
import { quality } from "./tienda-quality.js";
import { PLAY } from "./noir.js";

// The fog: the same grey as the cloud low over the city (the sky's
// horizon, below), so the far blocks go into it without a seam. (Fog is
// mixed in after the output encoding in this three.js, as the sky's own
// shader writes its colour: the two are the same numbers.)
const FOG = 0x222225;
// The moon's light, as the dark side first sees it (the board at theta PI):
// high, from the front left, so faces read and shadows fall long.
const KEY_DIR = new THREE.Vector3(-7, 11, 5).normalize();
const KEY_TURN = -Math.PI, UP = new THREE.Vector3(0, 1, 0);
// The moon in the sky: ahead and to the right, low enough to come into a
// low view over the rooftops (the camera always looks down -z).
const MOON_DIR = new THREE.Vector3(0.42, 0.3, -0.86).normalize();

/* ------------------------------------------------------------ the sky */

const SKY_VS = "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_FS = `
  uniform vec3 uMoon; uniform float uTime, uFlash;
  varying vec3 vD;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
  void main(){
    vec3 d = normalize(vD);
    float up = clamp(d.y, -0.2, 1.0);
    // the city's glow on the underside of the cloud, near the horizon
    vec3 col = mix(vec3(0.133, 0.133, 0.145), vec3(0.02, 0.02, 0.022), smoothstep(-0.02, 0.55, up));
    // the cloud: drifting, thicker low
    vec2 q = d.xz / max(0.12, d.y + 0.25) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
    float c = fbm(q);
    col += vec3(0.07) * smoothstep(0.45, 0.85, c) * (1.0 - smoothstep(0.1, 0.8, up));
    // the moon behind it, its halo; the cloud passing over dims it
    float m = dot(d, normalize(uMoon));
    float cover = smoothstep(0.35, 0.75, fbm(q * 0.7 + 3.0));
    col += vec3(0.95) * smoothstep(0.99945, 0.9997, m) * (1.0 - 0.55 * cover);
    col += vec3(0.55) * pow(max(m, 0.0), 220.0) * (1.0 - 0.4 * cover) + vec3(0.12) * pow(max(m, 0.0), 18.0);
    col += vec3(uFlash) * (0.35 + 0.65 * c) * smoothstep(-0.1, 0.4, up);
    gl_FragColor = vec4(col, 1.0);
  }`;

function createSky() {
  const uniforms = { uMoon: { value: MOON_DIR.clone() }, uTime: { value: 0 }, uFlash: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -10; dome.frustumCulled = false; dome.raycast = () => {};
  const group = new THREE.Group(); group.name = "noir-sky"; group.add(dome);
  return {
    group, uniforms,
    tick(camera, t) { group.position.copy(camera.position); uniforms.uTime.value = t; },
    dispose() { dome.geometry.dispose(); dome.material.dispose(); },
  };
}

/* ------------------------------------------------------------ the rain */

const RAIN_VS = `
  uniform float uTime; uniform vec3 uBox; attribute vec4 aSeed; attribute float aEnd; varying float vA;
  void main(){
    float speed = 7.5 + aSeed.w * 4.0;
    float y = mod(aSeed.y * uBox.y - uTime * speed, uBox.y);
    vec3 p = vec3((aSeed.x - 0.5) * uBox.x, y, (aSeed.z - 0.5) * uBox.z);
    p += vec3(0.05, -0.36, 0.02) * aEnd; // the streak, a little slanted
    p.x += (uBox.y - y) * 0.05;          // the wind
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (0.55 + 0.45 * aSeed.w) * smoothstep(0.0, 0.6, y) * (1.0 - aEnd * 0.6);
  }`;
const RAIN_FS = "uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.82), uOpacity * vA); }";

function createRain(n, box) {
  const seeds = new Float32Array(n * 2 * 4), ends = new Float32Array(n * 2), pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    seeds.set(s, i * 8); seeds.set(s, i * 8 + 4); ends[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  g.setAttribute("aEnd", new THREE.BufferAttribute(ends, 1));
  const uniforms = { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(box[0], box[1], box[2]) }, uOpacity: { value: 0.3 } };
  const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, fog: false }));
  lines.frustumCulled = false; lines.raycast = () => {}; lines.name = "noir-rain";
  return { lines, uniforms, dispose() { g.dispose(); lines.material.dispose(); } };
}

/* ------------------------------------------------------------ searchlights */

const BEAM_VS = "varying float vT; varying vec3 vN, vV; void main(){ vT = uv.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }";
const BEAM_FS = "uniform float uK; varying float vT; varying vec3 vN, vV; void main(){ float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.7); float a = uK * (1.0 - vT) * (1.0 - vT) * (0.35 + 0.65 * edge); gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a, a); }";

function createBeams() {
  const group = new THREE.Group(); group.name = "noir-searchlights";
  // a long open cone, its base at the lamp, widening up into the cloud
  const geo = new THREE.CylinderGeometry(3.2, 0.16, 70, 24, 1, true);
  geo.translate(0, 35, 0);
  const mat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0.16 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beams = [[-34, -40, 0.3, 0.0], [30, -46, -0.35, 2.1], [-6, -54, 0.12, 4.0]].map(([x, z, lean, ph]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.userData = { lean, ph }; m.raycast = () => {}; m.frustumCulled = false; group.add(m); return m;
  });
  return {
    group,
    tick(t) {
      beams.forEach((m) => {
        const { lean, ph } = m.userData;
        m.rotation.z = lean + 0.32 * Math.sin(t * 0.11 + ph);
        m.rotation.x = 0.25 * Math.sin(t * 0.07 + ph * 1.7) - 0.18;
      });
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/* ------------------------------------------------------------ steam, ripples, the pool */

let PUFF_T = null;
function puffTexture() {
  if (PUFF_T) return PUFF_T;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  for (let i = 0; i < 6; i++) {
    const cx = 32 + (Math.random() - 0.5) * 18, cy = 32 + (Math.random() - 0.5) * 18, r = 14 + Math.random() * 12;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,0.32)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  PUFF_T = new THREE.CanvasTexture(c);
  return PUFF_T;
}
let RING_T = null;
function ringTexture() {
  if (RING_T) return RING_T;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.stroke();
  x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 2; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke();
  RING_T = new THREE.CanvasTexture(c);
  return RING_T;
}

/* ------------------------------------------------------------ the print: vignette and grain */

function mountPrint(refs) {
  const overlay = refs.fxOverlayRef && refs.fxOverlayRef.current, layer = overlay && overlay.parentElement;
  if (!layer || typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 160;
  const x = c.getContext("2d"), img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  const style = document.createElement("style");
  style.textContent = "@keyframes noir-grain { 0% { background-position: 0 0; } 20% { background-position: -47px 23px; } 40% { background-position: 31px -61px; } 60% { background-position: -73px -17px; } 80% { background-position: 59px 41px; } 100% { background-position: 0 0; } }"
    + " @media (prefers-reduced-motion: reduce) { .noir-grain { animation: none !important; } }";
  document.head.appendChild(style);
  const vignette = document.createElement("div");
  vignette.className = "noir-vignette"; vignette.setAttribute("aria-hidden", "true");
  Object.assign(vignette.style, { position: "absolute", inset: "0", pointerEvents: "none", background: "radial-gradient(ellipse 80% 75% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)" });
  const grain = document.createElement("div");
  grain.className = "noir-grain"; grain.setAttribute("aria-hidden", "true");
  Object.assign(grain.style, { position: "absolute", inset: "0", pointerEvents: "none", opacity: "0.07", backgroundImage: `url(${c.toDataURL()})`, backgroundSize: "160px 160px", animation: "noir-grain 0.6s steps(5) infinite" });
  const flash = document.createElement("div");
  flash.className = "noir-flash"; flash.setAttribute("aria-hidden", "true");
  Object.assign(flash.style, { position: "absolute", inset: "0", pointerEvents: "none", opacity: "0", background: "radial-gradient(ellipse at 60% 0%, rgba(235,238,245,0.5), rgba(200,205,215,0.12) 60%, rgba(0,0,0,0) 100%)" });
  // over the picture, under the chassis's own overlay
  layer.insertBefore(vignette, overlay); layer.insertBefore(grain, overlay); layer.insertBefore(flash, overlay);
  return {
    flash(v) { flash.style.opacity = String(v); },
    dispose() { [vignette, grain, flash, style].forEach((el) => el.parentNode && el.parentNode.removeChild(el)); },
  };
}

/* ------------------------------------------------------------ the lot */

export function mountAmbientEffects(refs, { three, cam, audio }) {
  const Q = quality();
  let city = null, dims = "", attachedTo = null, fog = null, renderPrev = null, sky = null, rain = null, beams = null, print = null, fogPrev = null;
  let pool = null, steam = null;
  const ripples = [];
  const lastPos = new Map();
  const camLocal = new THREE.Vector3(), keyPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  let nextFlash = 0, flashT = -1, thunderAt = 0;

  function build(t) {
    if (city) { city.group.parent && city.group.parent.remove(city.group); city.dispose(); city = null; }
    city = buildCity({ EX: SLAB_X / 2, EZ: SLAB_Z / 2, tier: Q.tier });
    t.boardGroup.add(city.group);
    if (rain) { rain.lines.parent && rain.lines.parent.remove(rain.lines); rain.dispose(); }
    const span = Math.max(SLAB_X, SLAB_Z) + 10;
    rain = createRain(Q.tier === "low" ? 700 : 1500, [span, 9, span]);
    t.boardGroup.add(rain.lines);
    if (!beams) { beams = createBeams(); }
    if (beams.group.parent !== t.boardGroup) t.boardGroup.add(beams.group);
    // steam from a manhole in the street just off the board's near corner
    if (steam) { steam.group.parent && steam.group.parent.remove(steam.group); steam.dispose(); }
    steam = createSteam([[OFF_X + MARGIN + 0.9, OFF_Z - 1.6], [-(OFF_X + MARGIN + 0.9), -OFF_Z + 2.3]]);
    t.boardGroup.add(steam.group);
    dims = `${SLAB_X}x${SLAB_Z}`;
  }

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup || !t.scene || !t.renderer) return false;
    if (attachedTo !== t.boardGroup) {
      attachedTo = t.boardGroup; dims = "";
      if (!renderPrev) {
        renderPrev = { enc: t.renderer.outputEncoding, exp: t.renderer.toneMappingExposure };
        t.renderer.outputEncoding = THREE.sRGBEncoding; t.renderer.toneMappingExposure = 0.95;
      }
      if (!sky) { sky = createSky(); t.scene.add(sky.group); }
      if (!print) print = mountPrint(refs);
    }
    if (dims !== `${SLAB_X}x${SLAB_Z}`) build(t);
    if (!fog || t.scene.fog !== fog) { if (!fogPrev) fogPrev = { fog: t.scene.fog }; fog = new THREE.Fog(FOG, 30, 90); t.scene.fog = fog; }
    // the moon turns with the board (see the header)
    if (t.lights && t.lights.key) {
      keyPos.copy(KEY_DIR).applyAxisAngle(UP, t.boardGroup.rotation.y - KEY_TURN).multiplyScalar(25);
      if (!t.lights.key.position.equals(keyPos)) t.lights.key.position.copy(keyPos);
    }
    return true;
  }

  function createSteam(spots) {
    const group = new THREE.Group(); group.name = "noir-steam";
    const mat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xbdbdbd, transparent: true, opacity: 0.0, depthWrite: false });
    const puffs = [];
    spots.forEach(([x, z], si) => {
      for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(mat.clone()); s.userData = { x, z, ph: i / 9 + si * 0.37, k: 0.8 + Math.random() * 0.5 }; s.raycast = () => {}; group.add(s); puffs.push(s); }
    });
    return {
      group,
      tick(t) {
        puffs.forEach((s) => {
          const u = (t * 0.16 * s.userData.k + s.userData.ph) % 1;
          s.position.set(s.userData.x + u * 0.5 + Math.sin(t * 0.7 + s.userData.ph * 9) * 0.08, 0.05 + u * 1.5, s.userData.z + u * 0.2);
          const sz = 0.25 + u * 1.1; s.scale.set(sz, sz, 1);
          s.material.opacity = 0.5 * Math.sin(Math.PI * u) * (1 - u * 0.4);
        });
      },
      dispose() { puffs.forEach((s) => s.material.dispose()); mat.dispose(); },
    };
  }

  // A ring on the wet street where a piece comes down (as Plano's red
  // pencil watches for landings: a piece whose place changed and then held).
  function watchLandings(t) {
    if (!t.pieceGroup) return;
    const changed = [];
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId, key = `${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`;
      const rec = lastPos.get(id);
      if (!rec) { lastPos.set(id, { key, still: 99, pending: false }); return; }
      if (rec.key !== key) { changed.push(rec); rec.key = key; rec.still = 0; rec.pending = true; }
      else if (rec.pending && ++rec.still === 3) {
        rec.pending = false;
        if (!rec.bulk) { spawnRipple(o.position.x, o.position.z, 0.9, 0); spawnRipple(o.position.x, o.position.z, 0.7, 180); }
      }
    });
    const bulk = changed.length > 2;
    changed.forEach((rec) => { rec.bulk = bulk; });
  }
  function spawnRipple(x, z, size, delay) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0xe8e8e8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.renderOrder = 3; m.raycast = () => {};
    attachedTo.add(m);
    ripples.push({ m, born: performance.now() + delay, size });
  }

  // The piece picked up, in a pool of light.
  function tickPool(t, now) {
    if (!pool) {
      pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xfafafa, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
      pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; pool.raycast = () => {}; pool.name = "noir-pool";
    }
    if (pool.parent !== t.boardGroup) t.boardGroup.add(pool);
    let target = null;
    if (PLAY.selectedId != null && t.pieceGroup) {
      for (const o of t.pieceGroup.children) if (o.userData && o.userData.kind === "piece" && o.userData.pieceId === PLAY.selectedId) { target = o; break; }
    }
    const want = target ? 0.55 + 0.05 * Math.sin(now / 400) : 0;
    pool.material.opacity += (want - pool.material.opacity) * 0.15;
    if (target) {
      if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
      const b = target.geometry.boundingBox, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 2.4 + 0.6;
      pool.scale.set(s, s, 1);
      tmp.copy(target.position); pool.position.set(tmp.x, 0.018, tmp.z);
    }
  }

  return {
    // Free to wander the streets (noir.js freeCamera), the camera could go
    // into a block: kept above the roofs under it, and off the street.
    cameraOverride(camera) {
      if (!city || !attachedTo) return;
      camLocal.copy(camera.position); attachedTo.worldToLocal(camLocal);
      const need = Math.max(0.35, city.roofAt(camLocal.x, camLocal.z) + 0.45);
      if (camera.position.y < need) { camera.position.y = need; camera.updateMatrixWorld(); if (sky) sky.tick(camera, performance.now() / 1000); }
    },
    armOnBegin() { attach(); },
    restart() {},
    tick(now) {
      if (!attach()) return;
      const t = three.current, sec = now / 1000;
      // the fog keeps its distance from wherever the camera is
      if (t.camera) {
        const d = t.camera.position.length();
        fog.near = d + 2; fog.far = d + 52;
        camLocal.copy(t.camera.position); t.boardGroup.worldToLocal(camLocal);
        sky.tick(t.camera, sec);
      }
      city.tick(sec);
      // what the view looks at, for the buildings to clear out of its way
      if (cam && cam.current && cam.current.view) FOCUS.value.copy(cam.current.view.target);
      rain.uniforms.uTime.value = sec;
      beams.tick(sec);
      steam.tick(sec);
      watchLandings(t);
      tickPool(t, now);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i], u = (now - r.born) / 1100;
        if (u < 0) continue;
        if (u >= 1) { r.m.parent && r.m.parent.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ripples.splice(i, 1); continue; }
        const s = r.size * (0.5 + u * 1.6); r.m.scale.set(s, s, 1);
        r.m.material.opacity = 0.55 * (1 - u);
      }
      // lightning now and then, the cloud lit from inside; the thunder follows
      if (!nextFlash) nextFlash = now + 9000 + Math.random() * 20000;
      if (now > nextFlash && flashT < 0) { flashT = now; thunderAt = now + 900 + Math.random() * 1800; nextFlash = now + 22000 + Math.random() * 40000; }
      if (flashT >= 0) {
        const u = (now - flashT) / 520;
        const v = u >= 1 ? 0 : (u < 0.12 ? 1 : u < 0.22 ? 0.25 : u < 0.32 ? 0.8 : Math.max(0, 0.8 * (1 - (u - 0.32) / 0.68)));
        sky.uniforms.uFlash.value = v * 0.55;
        if (print) print.flash(v * 0.85);
        if (u >= 1) flashT = -1;
      }
      if (thunderAt && now > thunderAt) { thunderAt = 0; if (audio && audio.thunder) audio.thunder(); }
    },
    dispose() {
      ripples.forEach((r) => { r.m.parent && r.m.parent.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); });
      ripples.length = 0;
      if (pool) { pool.parent && pool.parent.remove(pool); pool.geometry.dispose(); pool.material.dispose(); pool = null; }
      if (city) { city.group.parent && city.group.parent.remove(city.group); city.dispose(); city = null; }
      if (rain) { rain.lines.parent && rain.lines.parent.remove(rain.lines); rain.dispose(); rain = null; }
      if (beams) { beams.group.parent && beams.group.parent.remove(beams.group); beams.dispose(); beams = null; }
      if (steam) { steam.group.parent && steam.group.parent.remove(steam.group); steam.dispose(); steam = null; }
      if (sky) { sky.group.parent && sky.group.parent.remove(sky.group); sky.dispose(); sky = null; }
      if (print) { print.dispose(); print = null; }
      const t = three.current;
      if (t && t.scene && t.scene.fog === fog) t.scene.fog = fogPrev ? fogPrev.fog : null;
      if (t && t.renderer && renderPrev) { t.renderer.outputEncoding = renderPrev.enc; t.renderer.toneMappingExposure = renderPrev.exp; }
    },
  };
}
