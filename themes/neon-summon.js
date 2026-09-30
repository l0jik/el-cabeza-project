/* The summons (Nova, the first arrival in Neon from the den's television,
   until the Singularity has been visited; user's choice, idea 5 of the
   mock-ups): the way in shows itself.

   Over the middle of the board, a small black sphere, the singularity.
   The pieces turn to face it; as they do, a small wormhole ring opens
   round it, a little larger than the sphere, blue, pulsing gently and
   slowly turning (nothing else orbits it: user). The pieces lift a
   little off the board and hover facing it, each bobbing on its own
   (they don't go to it). All the while the whole screen melts, very
   slowly and very slightly. Then, with each clap of thunder (user: the
   shock waves only blast out when the thunder hits), the singularity
   sends out a shock wave, a compression ring that runs out across the
   whole screen and warps it as it passes: seldom at first, then more
   often and more strongly (render(): the frame drawn to a texture and
   redrawn displaced, see the chassis's ambient render hook).

   Meanwhile the board takes no input (a shield over the canvas) and the
   dock is put away: the one thing that answers is the singularity. A
   tap on it opens the SINGULARITY invite (summonBridge.reveal, Neon's
   revealSingularity); the invite taken up, the toll begins, and this
   stands down (t.singularity.phase leaves "idle"), putting the pieces
   back as they were for the collapse.

   Its sound (themes/neon-summon-audio.js, the user's "C6"): a low hum
   growing from silence, and the thunder that brings each wave; a
   full-range mix on a computer, a phone-speaker mix on a phone. */

import * as THREE from "three";
import { getBoardDimensions } from "../engine/constants.js";
import { createSummonSound, summonMixFor } from "./neon-summon-audio.js";

// Set by Nova's Neon (apps/unified.jsx) each render: Neon's own reveal.
export const summonBridge = { reveal: null };

const WAVES = 6;
const APPEAR_AT = 0.4, TURN_AT = 1.3, TURN_S = 2.0, LIFT_AT = 1.7, LIFT_S = 2.0, RING_AT = 1.7, RING_S = 1.6, WAVES_AT = 3.6;
const ease = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

export function mountSummon(three, { delay = 1200, audio = null } = {}) {
  const t = three.current;
  if (!t || !t.boardGroup || !t.pieceGroup || !t.renderer) return null;
  // Its sound, through the soundscape's interface channel.
  let sound = null;
  try { const o = audio && audio.summonOutput && audio.summonOutput(); if (o) sound = createSummonSound(o, { mix: summonMixFor() }); } catch (e) { sound = null; }
  const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const disposables = [];
  let active = true, t0 = 0, readyAt = Infinity;

  /* ---- the board's measure ---- */
  const slab = t.boardGroup.getObjectByName("ec-slab");
  let span = 10, S = 1, top = 0;
  if (slab && slab.geometry) {
    slab.geometry.computeBoundingBox();
    const bb = slab.geometry.boundingBox;
    const w = (bb.max.x - bb.min.x) * slab.scale.x, d = (bb.max.z - bb.min.z) * slab.scale.z;
    span = Math.max(w, d);
    const { cols } = getBoardDimensions();
    S = w / Math.max(1, cols);
    top = slab.position.y + bb.max.y * slab.scale.y;
  }
  const R = S * 0.42; // the sphere
  const RING = R * 1.25; // (how far its glow reaches, for keeping it under the title)

  /* ---- the singularity: the Singularity's own sphere (user: "make it
     look like when you go to the singularity sphere"): black, its edge
     glowing blue in a thin Fresnel "photon ring" that breathes slowly
     (neon-singularity.js SPHERE_FRAGMENT: pow 2.5, the same blue, 22%
     breathing at 1.1 rad/s), and a halo hugging that edge just outside
     it (user: the ring sits directly on the edge of the black disk). ---- */
  const group = new THREE.Group();
  group.name = "ec-summon";
  // Nothing shows through it and nothing covers it: drawn last. (Marked
  // transparent, at full opacity, so it's sorted with the see-through
  // pieces, which three draws after everything solid; its renderOrder then
  // puts it last.)
  const sphereMat = new THREE.ShaderMaterial({
    uniforms: { uPulsePhase: { value: 0 }, uOpen: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uPulsePhase, uOpen, uTime; varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.5);
        // (Throbbing with the halo: the slow breath and the quick unsteady beat.)
        float pulse = 1.0 + 0.26 * sin(uPulsePhase) + 0.08 * sin(uTime * 7.3) * sin(uTime * 2.9);
        gl_FragColor = vec4(vec3(0.4, 0.85, 1.0) * rim * pulse * uOpen, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  sphereMat.toneMapped = false;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), sphereMat);
  sphere.renderOrder = 10;
  disposables.push(sphere.geometry, sphereMat);
  group.add(sphere);

  /* ---- the halo on its edge: a thin bright line right at the disk's
     edge and a soft glow falling away outside it, turning slowly (a
     little brighter in places, so the turning shows) ---- */
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 }, uRot: { value: 0 }, uPulsePhase: { value: 0 }, uR: { value: R }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    /* Alive (user: pulsating and vibrating, as if plasma jets were
       coming off it from a vast astronomical distance): the edge trembles
       (its radius shivers a percent or so) and flickers along its length;
       and here and there a thin jet flares out from it, ripples outward
       and dies away, the pattern drifting so no two moments match. All
       fine and faint: far off, not close. */
    fragmentShader: `precision highp float;
      uniform float uOpen, uRot, uPulsePhase, uR, uTime; varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float r = length(vP), a = atan(vP.y, vP.x);
        vec2 dir = vec2(cos(a), sin(a)); // (noise on the circle: no seam)
        // The tremble: the edge's radius shivering, finely and fast.
        float shiver = 0.010 * sin(a * 9.0 + uTime * 23.0) + 0.012 * (vnoise(dir * 7.0 + vec2(uTime * 6.0, 0.0)) - 0.5);
        float d = (r - uR * (1.0 + shiver)) / uR;    // 0 at the edge
        // The edge line, flickering along its length.
        float flick = 0.7 + 0.6 * vnoise(dir * 5.0 + vec2(0.0, uTime * 2.3));
        float line = exp(-pow(d / 0.045, 2.0)) * flick;
        float glow = d > 0.0 ? exp(-d / 0.16) * 0.55 : 0.0;
        // The jets: sparse, thin, of changing length, rippling outward.
        float j = vnoise(dir * 11.0 + vec2(uTime * 0.35, -uTime * 0.21));
        float jet = pow(max(0.0, j - 0.58) / 0.42, 2.5);
        float len = 0.18 + 0.5 * vnoise(dir * 3.0 + vec2(uTime * 0.5, 1.7));
        float streak = d > 0.0 ? jet * exp(-d / len) * (0.75 + 0.25 * sin(d * 60.0 - uTime * 9.0)) * 1.1 : 0.0;
        streak *= smoothstep(0.9, 0.55, d);
        float arcs = 0.84 + 0.11 * sin(a * 3.0 + uRot) + 0.05 * sin(a * 7.0 - uRot * 1.6);
        // The pulse: the slow breath, and a quicker unsteady throb on it.
        float pulse = 1.0 + 0.26 * sin(uPulsePhase) + 0.08 * sin(uTime * 7.3) * sin(uTime * 2.9);
        float k = (line + glow + streak) * arcs * uOpen * pulse;
        gl_FragColor = vec4(vec3(0.4, 0.85, 1.0) * k + vec3(0.25, 0.3, 0.35) * streak * 0.4 * uOpen, k);
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R * 1.9, 160, 1), ringMat);
  ring.renderOrder = 9;
  disposables.push(ring.geometry, ringMat);
  group.add(ring);
  group.visible = false;
  t.boardGroup.add(group);

  // Where it hangs: over the board's middle, high enough to stand clear
  // above the far pieces and well below the title (held about 60% of the
  // way up the screen, checked against the camera each frame).
  let height = span * 0.42;
  // (Where the title leaves little room, as on a wide screen, it may come
  // down low over the empty middle of the board, clear of both rows.)
  const minH = S * 0.9, maxH = span * 1.2;
  const world = new THREE.Vector3(), ndc = new THREE.Vector3(), ndcTop = new THREE.Vector3(), camUp = new THREE.Vector3(), wScale = new THREE.Vector3();
  let firstFit = true, lastNow = 0;
  function fits(h) {
    world.set(0, top + h, 0); t.boardGroup.localToWorld(world); ndc.copy(world).project(t.camera);
    if (ndc.y > 0.6) return false;
    if (titleLim >= 1) return true;
    ndcTop.copy(world).add(camUp).project(t.camera);
    return ndcTop.y <= titleLim;
  }
  let titleLim = 1; // the title's bottom (and a margin), in NDC
  function measureTitle() {
    titleLim = 1;
    const title = document.querySelector(".ec-title");
    if (!title) return;
    const cr = canvas.getBoundingClientRect(), tb = title.getBoundingClientRect().bottom + 14;
    if (tb <= cr.top || cr.height <= 0) return;
    titleLim = 1 - (2 * (tb - cr.top)) / cr.height;
    t.boardGroup.getWorldScale(wScale);
    camUp.set(0, 1, 0).applyQuaternion(t.camera.quaternion).multiplyScalar(RING * 1.3 * wScale.y);
  }

  /* ---- the pieces: turned toward it, lifted, bobbing ---- */
  const pieces = new Map(); // pieceId -> { parts: [{ obj, pos, quat }], c: Vector3, f, ph }
  // (Gathered once they're there: the pieces are built after this mounts.)
  const gather = () => t.pieceGroup.children.forEach((o) => {
    const id = o.userData && o.userData.pieceId;
    if (!id) return;
    if (!pieces.has(id)) pieces.set(id, { parts: [], c: null, f: 0.35 + Math.random() * 0.35, ph: Math.random() * Math.PI * 2 });
    const e = pieces.get(id);
    e.parts.push({ obj: o, pos: o.position.clone(), quat: o.quaternion.clone() });
    if (o.userData.kind === "piece" || !e.c) e.c = o.position.clone();
  });
  const Y = new THREE.Vector3(0, 1, 0), qFace = new THREE.Quaternion(), qT = new THREE.Quaternion(), qI = new THREE.Quaternion();
  const sLocal = new THREE.Vector3(), dir = new THREE.Vector3(), off = new THREE.Vector3();
  function placePieces(tau) {
    const turn = ease((tau - TURN_AT) / TURN_S), lift = ease((tau - LIFT_AT) / LIFT_S);
    // The singularity in the pieces' own frame.
    sLocal.set(0, top + height, 0); t.boardGroup.localToWorld(sLocal); t.pieceGroup.worldToLocal(sLocal);
    pieces.forEach((e) => {
      dir.copy(sLocal).sub(e.c).normalize();
      qFace.setFromUnitVectors(Y, dir);
      qT.copy(qI).slerp(qFace, 0.55 * turn);
      const bob = reduceMotion ? 0 : Math.sin(tau * Math.PI * 2 * e.f + e.ph) * S * 0.07 * lift;
      const up = lift * S * 0.3 + bob;
      e.parts.forEach((p) => {
        off.copy(p.pos).sub(e.c).applyQuaternion(qT);
        p.obj.position.copy(e.c).add(off); p.obj.position.y += up;
        p.obj.quaternion.copy(qT).multiply(p.quat);
      });
    });
  }
  function restorePieces() {
    pieces.forEach((e) => e.parts.forEach((p) => { p.obj.position.copy(p.pos); p.obj.quaternion.copy(p.quat); }));
  }

  /* ---- the shock waves: the frame redrawn, pushed outward in rings ---- */
  const renderer = t.renderer;
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const isGL2 = renderer.capabilities && renderer.capabilities.isWebGL2;
  const rt = isGL2 && THREE.WebGLMultisampleRenderTarget
    ? new THREE.WebGLMultisampleRenderTarget(size.x, size.y, { format: THREE.RGBAFormat })
    : new THREE.WebGLRenderTarget(size.x, size.y, { format: THREE.RGBAFormat });
  if (rt.samples !== undefined) rt.samples = window.devicePixelRatio > 2 ? 2 : 4;
  disposables.push(rt);
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 },
      uR: { value: new Array(WAVES).fill(-1) }, uS: { value: new Array(WAVES).fill(0) }, uPinch: { value: 0 },
      uMelt: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float;
      uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uAspect, uPinch, uMelt, uTime; uniform float uR[${WAVES}]; uniform float uS[${WAVES}];
      varying vec2 vUv;
      void main() {
        vec2 d = vUv - uCenter; d.x *= uAspect;
        float dist = length(d);
        vec2 dir = dist > 1e-5 ? d / dist : vec2(0.0);
        float off = 0.0, front = 0.0;
        for (int i = 0; i < ${WAVES}; i++) {
          float w = 0.035 + max(uR[i], 0.0) * 0.06;
          float x = (dist - uR[i]) / w;
          float g = exp(-x * x);
          off += uS[i] * x * g;       // compressed ahead of the front, drawn out behind it
          front += uS[i] * g;
        }
        off -= uPinch * exp(-dist * 7.0); // the space round it, drawn in a little
        vec2 o = dir * off; o.x /= uAspect;
        // The melt: a broad, slow wobble of the whole frame (a few pixels,
        // each swell taking half a minute or so).
        vec2 m = vec2(sin(vUv.y * 5.0 + uTime * 0.23 + 1.3 * sin(vUv.x * 3.0 + uTime * 0.17)),
                      cos(vUv.x * 4.0 - uTime * 0.19 + 1.3 * sin(vUv.y * 3.5 - uTime * 0.13))) * uMelt;
        m.x /= uAspect;
        vec4 c = texture2D(tDiffuse, vUv - o - m);
        c.r = texture2D(tDiffuse, vUv - o * 1.12 - m).r;
        c.b = texture2D(tDiffuse, vUv - o * 0.88 - m).b;
        float k = clamp(front * 9.0, 0.0, 0.22);
        gl_FragColor = c + vec4(vec3(0.3, 0.75, 1.0) * k, k); // a faint blue at the fronts
      }`,
    depthTest: false, depthWrite: false,
  });
  postMat.toneMapped = false;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  disposables.push(quad.geometry, postMat);
  const waves = []; // { born, strength }
  let thunder = 0, acc = 0.5; // (thunder so far: the test hook; the share's running sum)
  let nextWave = WAVES_AT;

  /* ---- the shield over the board, and the dock put away ---- */
  const canvas = renderer.domElement;
  const shield = document.createElement("div");
  shield.setAttribute("data-testid", "summon-shield");
  Object.assign(shield.style, { position: "fixed", zIndex: "3", touchAction: "none", background: "transparent", cursor: "default" });
  document.body.appendChild(shield);
  const style = document.createElement("style");
  // Hidden but still taking their space (visibility, not display: the
  // chassis fits the board between the title and the dock by measuring
  // the dock, and a dock with no box leaves the board unfitted, which is
  // what the Singularity's sphere sizes itself by: it came up huge).
  style.textContent = "html.ec-summon [data-dock-piece], html.ec-summon [data-testid=\"dock-panel\"], html.ec-summon .ec-shell-bar { visibility: hidden !important; pointer-events: none !important; }";
  document.head.appendChild(style);
  document.documentElement.classList.add("ec-summon");
  const ray = new THREE.Raycaster(), p2 = new THREE.Vector2();
  const hit = (e) => {
    if (!group.visible || !t.camera) return false;
    const r = canvas.getBoundingClientRect();
    p2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(p2, t.camera);
    sphere.getWorldPosition(world);
    // Generous: the sphere is small on a phone.
    return ray.ray.distanceToPoint(world) < R * 2.6 * group.scale.x;
  };
  const swallow = (e) => { e.stopPropagation(); if (e.cancelable && e.type !== "pointermove") e.preventDefault(); };
  const onMove = (e) => { swallow(e); shield.style.cursor = performance.now() >= readyAt && hit(e) ? "pointer" : "default"; };
  const onDown = (e) => {
    swallow(e);
    if (sound) sound.resume(); // (a phone starts the sound suspended until a tap)
    if (performance.now() < readyAt || !hit(e)) return;
    if (summonBridge.reveal) summonBridge.reveal();
  };
  ["pointerup", "click", "dblclick", "contextmenu", "wheel", "touchstart", "touchmove", "touchend"].forEach((ev) => shield.addEventListener(ev, swallow, { passive: false }));
  // (A phone counts a touch as a tap for starting sound only at its end:
  // wake the sound then too.)
  ["pointerup", "touchend", "click"].forEach((ev) => shield.addEventListener(ev, () => { if (sound) sound.resume(); }));
  shield.addEventListener("pointermove", onMove);
  shield.addEventListener("pointerdown", onDown);
  function fitShield() {
    const r = canvas.getBoundingClientRect();
    shield.style.left = `${r.left}px`; shield.style.top = `${r.top}px`; shield.style.width = `${r.width}px`; shield.style.height = `${r.height}px`;
  }

  function end(fade = 1.5) {
    if (!active) return;
    active = false;
    if (sound) sound.end(fade);
    restorePieces();
    group.visible = false;
    if (group.parent) group.parent.remove(group);
    shield.remove();
    style.remove();
    document.documentElement.classList.remove("ec-summon");
    if (typeof window !== "undefined") window.__EC_SUMMON__ = () => ({ active: false });
  }

  if (typeof window !== "undefined") {
    // Test-only: stand it down (the tests that need Neon's own menus).
    if (window.__EC_TEST_HOOKS__) window.__EC_SUMMON_END__ = () => end();
    window.__EC_SUMMON__ = () => {
      if (!active) return { active: false };
      sphere.getWorldPosition(world); ndc.copy(world).project(t.camera);
      const r = canvas.getBoundingClientRect();
      return {
        active, ready: performance.now() >= readyAt, waves: waves.length, height, S,
        sound: sound ? { mix: sound.mix, state: sound.ctx.state, thunder } : null,
        screen: { x: r.left + ((ndc.x + 1) / 2) * r.width, y: r.top + ((1 - ndc.y) / 2) * r.height },
        lifted: [...pieces.values()].map((e) => +(e.parts[0].obj.position.y - e.parts[0].pos.y).toFixed(3)),
      };
    };
  }

  let tau = 0;
  return {
    get active() { return active; },
    end,
    tick(now) {
      if (!active) return;
      // The Singularity itself has begun: stand down, pieces back.
      if (t.singularity && t.singularity.phase && t.singularity.phase !== "idle") { end(); return; }
      if (!t0) { t0 = now + delay; readyAt = t0 + TURN_AT * 1000; }
      fitShield();
      tau = Math.max(0, (now - t0) / 1000);
      if (now < t0) return;
      group.visible = true;
      if (sound) { sound.start(tau); sound.update(tau); }
      // Its height: about 60% of the way up the screen, and (on a wide
      // screen, where the camera stands back and 60% up is the title
      // itself) with the ring's top edge under the title's. Solved each
      // frame, eased toward.
      measureTitle();
      let lo = minH, hi = maxH;
      for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      height = firstFit ? lo : height + (lo - height) * Math.min(1, (now - lastNow) / 300);
      firstFit = false; lastNow = now;
      group.position.set(0, top + height, 0);
      // Appearing: out of nothing, then the ring opens as the pieces turn.
      const appear = ease((tau - APPEAR_AT) / 0.9);
      group.scale.setScalar(Math.max(0.001, appear));
      ringMat.uniforms.uOpen.value = ease((tau - RING_AT) / RING_S);
      ringMat.uniforms.uRot.value = tau * 0.35;
      ringMat.uniforms.uPulsePhase.value = sphereMat.uniforms.uPulsePhase.value = tau * 1.1; // the Singularity's breathing
      ringMat.uniforms.uTime.value = sphereMat.uniforms.uTime.value = reduceMotion ? 0 : tau;
      sphereMat.uniforms.uOpen.value = ringMat.uniforms.uOpen.value;
      // Facing the camera, whatever the board's turn.
      t.camera.getWorldQuaternion(qFace); group.getWorldQuaternion(qT);
      ring.quaternion.copy(qT.invert()).multiply(qFace);
      if (!pieces.size) gather();
      placePieces(tau);
      // The beats (every 3 s at first, every 1.1 s at full strength), and
      // on a growing share of them, spread evenly, thunder and its shock
      // wave: about one in six or seven at first, every one at full.
      if (tau >= nextWave) {
        const k = Math.min(1, (tau - WAVES_AT) / 45), strength = 0.35 + 0.65 * k;
        nextWave = tau + (3.0 - 1.9 * k);
        acc += 0.15 + 0.85 * Math.pow(k, 1.6);
        if (acc >= 1) {
          acc -= 1; thunder++;
          if (sound) sound.hit(strength);
          if (!reduceMotion) { waves.push({ born: tau, strength }); if (waves.length > WAVES) waves.shift(); }
        }
      }
      const uR = postMat.uniforms.uR.value, uS = postMat.uniforms.uS.value;
      for (let i = 0; i < WAVES; i++) {
        const w = waves[i];
        if (!w) { uR[i] = -1; uS[i] = 0; continue; }
        const r = (tau - w.born) * 0.5;
        const fade = Math.max(0, 1 - r / 1.7);
        uR[i] = r; uS[i] = 0.022 * w.strength * fade * Math.min(1, r / 0.08);
      }
      postMat.uniforms.uPinch.value = reduceMotion ? 0 : 0.004 * ease((tau - WAVES_AT) / 20);
      postMat.uniforms.uMelt.value = reduceMotion ? 0 : 0.003 * ease((tau - LIFT_AT) / 5);
      postMat.uniforms.uTime.value = tau;
      postMat.uniforms.uCenter.value.set((ndc.x + 1) / 2, (ndc.y + 1) / 2);
    },
    // The frame, drawn through the waves (the chassis's render hook).
    render(r, scene, camera) {
      if (!active || !group.visible) return false;
      r.getDrawingBufferSize(size);
      if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
      postMat.uniforms.uAspect.value = size.x / Math.max(1, size.y);
      r.setRenderTarget(rt);
      r.clear();
      r.render(scene, camera);
      r.setRenderTarget(null);
      r.render(postScene, postCam);
      return true;
    },
    dispose() {
      end(0.3);
      disposables.forEach((d) => d && d.dispose && d.dispose());
    },
  };
}
