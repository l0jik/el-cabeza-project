/* Ciudad's scene life: the hour's light over the city, the city round
   the board (ciudad-city.js), the free blocks' lots and the cranes
   (ciudad-lots.js), the traffic and the people (ciudad-life.js).

   - The time of day (ciudad-time.js) sets the sky, the haze, the sun (the
     chassis's key light: its colour, its strength, where it stands), the
     sky's light and the ground's (the hemisphere), the exposure, the
     glass's reflections (the sky of the hour, as an environment map) and
     the night (the windows by plan, the lamps, the cars' lamps, the
     beacons). A change eases; the shadows follow the sun round.
   - The sun turns with the board, as Luna's and Noir's lights do: the
     chassis turns the board, not the camera, and a city turned under a
     still sun would swing every shadow in it as the view was dragged.
   - The sky follows the camera: the hour's gradient from the top of the
     sky down to the horizon, the sun's glow and disc by day, a cloud deck
     when it's overcast. The haze is the horizon's colour, kept a little
     beyond the board wherever the camera is.
   - The piece picked up stands in a pool of light; a building landing
     raises a little dust off the street. Nothing here touches play. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, BOARD_ROWS, BOARD_COLS } from "../engine/constants.js";
import { NOW, stepTime, timeOf } from "./ciudad-time.js";
import { PLAN_U, FOCUS, applyNight, setEnv, glowTex } from "./ciudad-models.js";
import { buildCity } from "./ciudad-city.js";
import { createLots } from "./ciudad-lots.js";
import { createLife } from "./ciudad-life.js";
import { quality } from "./tienda-quality.js";
import { PLAY } from "./ciudad.js";

// The sun as the first view of the board sees it (the board at theta PI,
// as Noir's moon): ciudad-time.js gives its direction in that frame.
const KEY_TURN = -Math.PI, UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------ the sky */

const SKY_VS = "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SKY_FS = `
  uniform vec3 uC0, uC1, uC2, uC3, uFog, uSun; uniform float uSunGlow, uClouds, uTime;
  varying vec3 vD;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
  void main(){
    vec3 d = normalize(vD);
    // the gradient from the top of the sky (0) down to the horizon (1)
    float t = 1.0 - clamp(d.y / 0.62, 0.0, 1.0);
    vec3 col = t < 0.4 ? mix(uC0, uC1, t / 0.4) : (t < 0.75 ? mix(uC1, uC2, (t - 0.4) / 0.35) : mix(uC2, uC3, (t - 0.75) / 0.25));
    // the sun: its glow, and its disc, by day
    vec3 s3 = normalize(uSun); float s = max(dot(d, s3), 0.0);
    col += uSunGlow * (vec3(1.0, 0.9, 0.74) * pow(s, 48.0) * 0.42 + vec3(1.0, 0.84, 0.62) * pow(s, 6.0) * 0.12);
    col = mix(col, vec3(1.0, 0.98, 0.92), uSunGlow * smoothstep(0.99955, 0.9998, s) * step(0.0, s3.y));
    // cloud: thin wisps on a fair day, a deck when it's overcast
    if (uClouds > 0.01 && d.y > -0.05) {
      vec2 q = d.xz / max(0.1, d.y + 0.18) * 1.1 + vec2(uTime * 0.006, uTime * 0.002);
      float c = fbm(q), deck = smoothstep(0.38 - 0.25 * uClouds, 0.82, c) * min(1.0, uClouds * 1.15);
      vec3 cloud = mix(vec3(1.0), uC3, 0.45) * (0.92 + 0.08 * c);
      col = mix(col, cloud, deck * (uClouds > 0.6 ? 0.65 : 0.35) * smoothstep(-0.02, 0.25, d.y));
    }
    // under the horizon, the haze
    col = mix(col, uFog, smoothstep(0.02, -0.1, d.y));
    gl_FragColor = vec4(col, 1.0);
  }`;

function createSky() {
  const v3 = () => ({ value: new THREE.Vector3() });
  const uniforms = { uC0: v3(), uC1: v3(), uC2: v3(), uC3: v3(), uFog: v3(), uSun: v3(), uSunGlow: { value: 0 }, uClouds: { value: 0 }, uTime: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -10; dome.frustumCulled = false; dome.raycast = () => {};
  const group = new THREE.Group(); group.name = "ciudad-sky"; group.add(dome);
  return {
    group, uniforms,
    set(sunWorld) {
      [uniforms.uC0, uniforms.uC1, uniforms.uC2, uniforms.uC3].forEach((u, i) => u.value.set(...NOW.sky[i]));
      uniforms.uFog.value.set(...NOW.fog); uniforms.uSun.value.copy(sunWorld);
      uniforms.uSunGlow.value = NOW.sunGlow; uniforms.uClouds.value = NOW.clouds;
    },
    tick(camera, t) { group.position.copy(camera.position); uniforms.uTime.value = t; },
    dispose() { dome.geometry.dispose(); dome.material.dispose(); },
  };
}

/* The glass's reflections: the hour's sky (and the ground under it) as an
   environment map, made once an hour the first time it's wanted. */
function makeEnv(renderer, id) {
  const T = timeOf(id), es = new THREE.Scene(), c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256);
  T.sky.forEach(([t, color]) => g.addColorStop(t * 0.5, color));
  g.addColorStop(0.53, T.ground); g.addColorStop(1, T.night ? "#050506" : "#4a4741");
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
  if (!T.night) { const sd = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfffaf0 })); sd.position.set(...T.sun.dir).normalize().multiplyScalar(44); es.add(sd); }
  const pm = new THREE.PMREMGenerator(renderer);
  const out = pm.fromScene(es, 0).texture;
  pm.dispose(); t.dispose();
  es.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return out;
}

/* ------------------------------------------------------------ dust, the pool */

let PUFF_T = null;
function puffTexture() {
  if (PUFF_T) return PUFF_T;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  for (let i = 0; i < 7; i++) {
    const cx = 32 + (Math.random() - 0.5) * 20, cy = 32 + (Math.random() - 0.5) * 20, r = 12 + Math.random() * 12;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,0.3)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  PUFF_T = new THREE.CanvasTexture(c);
  return PUFF_T;
}

/* ------------------------------------------------------------ the lot */

export function mountAmbientEffects(refs, { three, cam, audio }) {
  const Q = quality();
  let city = null, lots = null, life = null, dims = "", attachedTo = null, fog = null, renderPrev = null, sky = null, fogPrev = null;
  let hemi = null, ambient = null, pool = null, lastVersion = -1, envId = null, moving = false;
  const envs = new Map();
  const puffs = [];
  const lastPos = new Map();
  const camLocal = new THREE.Vector3(), sunWorld = new THREE.Vector3(), keyPos = new THREE.Vector3(), tmp = new THREE.Vector3();

  function build(t) {
    for (const part of [city, lots, life]) if (part) { part.group.parent && part.group.parent.remove(part.group); part.dispose(); }
    city = buildCity({ EX: SLAB_X / 2, EZ: SLAB_Z / 2, tier: Q.tier });
    t.boardGroup.add(city.group);
    lots = createLots({ tier: Q.tier });
    t.boardGroup.add(lots.group);
    life = createLife({ EX: SLAB_X / 2, EZ: SLAB_Z / 2, tier: Q.tier, city });
    t.boardGroup.add(life.group);
    dims = `${BOARD_ROWS}x${BOARD_COLS}`;
    lastVersion = -1;
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__CIUDAD__ = { lots: () => lots.test(), life: () => life.test(), now: () => ({ id: NOW.id, night: NOW.night, exposure: NOW.exposure }) };
    }
  }

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup || !t.scene || !t.renderer) return false;
    if (attachedTo !== t.boardGroup) {
      attachedTo = t.boardGroup; dims = "";
      if (!renderPrev) {
        renderPrev = { enc: t.renderer.outputEncoding, exp: t.renderer.toneMappingExposure };
        t.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      if (!sky) { sky = createSky(); t.scene.add(sky.group); }
      hemi = null; ambient = null;
      t.scene.children.forEach((o) => { if (o.isHemisphereLight) hemi = o; else if (o.isAmbientLight) ambient = o; });
    }
    if (dims !== `${BOARD_ROWS}x${BOARD_COLS}`) build(t);
    if (!fog || t.scene.fog !== fog) { if (!fogPrev) fogPrev = { fog: t.scene.fog }; fog = new THREE.Fog(0xe2e0d8, 30, 90); t.scene.fog = fog; lastVersion = -1; }
    return true;
  }

  // The hour's light, set when it changes (every frame while it eases).
  function light(t) {
    const L = t.lights || {};
    if (L.key) {
      L.key.color.copy(NOW.sunColor); L.key.intensity = NOW.sunI;
      if (L.fill) L.fill.intensity = 0.08 * (1 - NOW.night) + 0.03;
      if (L.back) L.back.intensity = 0.12 * (1 - NOW.night) + 0.04;
    }
    if (hemi) { hemi.color.copy(NOW.hemiSky); hemi.groundColor.copy(NOW.hemiGround); hemi.intensity = NOW.hemiI; }
    if (ambient) ambient.intensity = 0;
    t.renderer.toneMappingExposure = NOW.exposure;
    fog.color.setRGB(...NOW.fog);
    PLAN_U.uNight.value = NOW.night;
    applyNight(NOW.night);
    if (lots) lots.night(NOW.night);
    if (city) city.night(NOW.night);
    if (life) life.night(NOW.night);
    // the glass shows the sky of the hour it's going to, from halfway there
    const want = NOW.changing && NOW.k < 0.5 ? NOW.fromId : NOW.id;
    if (want !== envId) {
      if (!envs.has(want)) envs.set(want, makeEnv(t.renderer, want));
      envId = want; setEnv(envs.get(want));
    }
  }

  // Where the sun stands now, in the world: the hour's direction, turned with the board.
  function placeSun(t) {
    sunWorld.copy(NOW.sunDir).applyAxisAngle(UP, t.boardGroup.rotation.y - KEY_TURN);
    if (t.lights && t.lights.key) {
      keyPos.copy(sunWorld).multiplyScalar(25);
      if (!t.lights.key.position.equals(keyPos)) t.lights.key.position.copy(keyPos);
    }
  }

  // A building landing raises a little dust off the street (as Noir's
  // ripples: a piece whose place changed and then held).
  function watchLandings(t, now) {
    if (!t.pieceGroup) return;
    const changed = [];
    moving = false;
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId, key = `${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`;
      const rec = lastPos.get(id);
      if (!rec) { lastPos.set(id, { key, still: 99, pending: false }); return; }
      if (rec.key !== key) { changed.push(rec); rec.key = key; rec.still = 0; rec.pending = true; moving = true; }
      else if (rec.pending && ++rec.still === 3) {
        rec.pending = false;
        if (!rec.bulk) dust(o.position.x, o.position.z, now);
      }
      if (rec.pending) moving = true;
    });
    const bulk = changed.length > 2;
    changed.forEach((rec) => { rec.bulk = bulk; });
  }
  function dust(x, z, now) {
    if (!attachedTo) return;
    const color = new THREE.Color(NOW.night > 0.5 ? 0x8a8a8c : 0xd8d4cc);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
      s.position.set(x, 0.06, z); s.raycast = () => {};
      attachedTo.add(s);
      puffs.push({ s, born: now, x, z, a: (i / 6) * Math.PI * 2 + Math.random() * 0.6, r: 0.42 + Math.random() * 0.16 });
    }
  }
  function tickPuffs(now) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i], u = (now - p.born) / 1300;
      if (u >= 1) { p.s.parent && p.s.parent.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); continue; }
      const out = p.r * (0.6 + 0.8 * Math.sqrt(u));
      p.s.position.set(p.x + Math.cos(p.a) * out, 0.05 + u * 0.18, p.z + Math.sin(p.a) * out);
      const sz = 0.25 + u * 0.55; p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = 0.42 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u);
    }
  }

  // The piece picked up, in a pool of light.
  function tickPool(t, now) {
    if (!pool) {
      pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xfff4e0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
      pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; pool.raycast = () => {}; pool.name = "ciudad-pool";
    }
    if (pool.parent !== t.boardGroup) t.boardGroup.add(pool);
    let target = null;
    if (PLAY.selectedId != null && t.pieceGroup) {
      for (const o of t.pieceGroup.children) if (o.userData && o.userData.kind === "piece" && o.userData.pieceId === PLAY.selectedId) { target = o; break; }
    }
    const want = target ? (0.32 + 0.3 * NOW.night) + 0.05 * Math.sin(now / 400) : 0;
    pool.material.opacity += (want - pool.material.opacity) * 0.15;
    if (target) {
      if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
      const b = target.geometry.boundingBox, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 2.2 + 0.6;
      pool.scale.set(s, s, 1);
      tmp.copy(target.position); pool.position.set(tmp.x, 0.018, tmp.z);
    }
  }

  return {
    // Free to wander the streets (ciudad.js freeCamera), the camera could
    // go into a block: kept above the roofs under it.
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
      stepTime(now);
      placeSun(t);
      if (NOW.version !== lastVersion) { lastVersion = NOW.version; light(t); }
      sky.set(sunWorld);
      PLAN_U.uTime.value = sec;
      if (t.camera) {
        const d = t.camera.position.length();
        fog.near = d + 3; fog.far = d + (NOW.clouds > 0.6 ? 48 : 56);
        sky.tick(t.camera, sec);
      }
      if (cam && cam.current && cam.current.view) FOCUS.value.copy(cam.current.view.target);
      watchLandings(t, now);
      lots.update(PLAY, now);
      lots.tick(now, NOW.night);
      life.tick(now, PLAY.pieces, moving);
      city.tick(sec);
      tickPuffs(now);
      tickPool(t, now);
      if (audio && audio.setHour) audio.setHour(NOW.id, NOW.night);
    },
    dispose() {
      puffs.forEach((p) => { p.s.parent && p.s.parent.remove(p.s); p.s.material.dispose(); }); puffs.length = 0;
      if (pool) { pool.parent && pool.parent.remove(pool); pool.geometry.dispose(); pool.material.dispose(); pool = null; }
      for (const part of [city, lots, life]) if (part) { part.group.parent && part.group.parent.remove(part.group); part.dispose(); }
      city = lots = life = null;
      if (typeof window !== "undefined" && window.__CIUDAD__) delete window.__CIUDAD__;
      if (sky) { sky.group.parent && sky.group.parent.remove(sky.group); sky.dispose(); sky = null; }
      setEnv(null); envs.forEach((e) => e.dispose()); envs.clear();
      const t = three.current;
      if (t && t.scene && t.scene.fog === fog) t.scene.fog = fogPrev ? fogPrev.fog : null;
      if (t && t.renderer && renderPrev) { t.renderer.outputEncoding = renderPrev.enc; t.renderer.toneMappingExposure = renderPrev.exp; }
    },
  };
}
