/* Cromo's scene life: the monolith under the board, and the few quiet
   motions that make polished metal feel real.

   - The monolith. The chassis builds the board as a thin slab; Cromo
     stands it on a cube of the same stone, as deep as the board is wide,
     whose faces fade to black toward the bottom (vertex colours), so the
     board is the lit top of something far bigger than the screen.
   - Light sweeps. Every so often a soft band of reflected light glides
     across the top face and down the cube's sides, the way a studio
     light rakes a machined surface as you turn it. Begin Game and the
     end of a game each get a slower, brighter one.
   - Landing shimmer. When a piece comes to rest, a faint ring of light
     spreads out from it across the metal and fades.

   All of it hangs off the chassis's boardGroup, so it turns with the
   board, and is rebuilt if the board changes size. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_THICKNESS } from "../engine/constants.js";
import { sideMaterial, applyStoneToScene, onStoneChange, getStone } from "./cromo.js";

const SWEEP_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// A soft band of light with a sharp core, lightly broken up along the
// brushing so it reads as a reflection on metal, not a spotlight.
const SWEEP_FRAG = `
  uniform float uPos, uStr, uWidth;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = dot(p, uDir) - uPos;
    float band = exp(-d * d / uWidth) * 0.65 + exp(-d * d / (uWidth * 0.06)) * 0.35;
    float grain = 0.82 + 0.18 * sin(vUv.x * 820.0 + sin(vUv.y * 37.0) * 3.0);
    gl_FragColor = vec4(vec3(1.0, 0.99, 0.97) * band * grain * uStr, 1.0);
  }
`;
// Landing shimmer: one thin ring, widening and fading.
const RING_FRAG = `
  uniform float uR, uStr;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float w = 0.035 + uR * 0.05;
    float ring = exp(-pow((r - uR) / w, 2.0));
    float inner = exp(-pow(r / max(uR, 0.001), 2.0) * 3.0) * 0.25;
    gl_FragColor = vec4(vec3(1.0) * (ring + inner) * uStr * step(r, 1.0), 1.0);
  }
`;

function sweepMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPos: { value: -3 }, uStr: { value: 0 }, uWidth: { value: 0.06 }, uDir: { value: new THREE.Vector2(0.8, 0.6) } },
    vertexShader: SWEEP_VERT, fragmentShader: SWEEP_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6,
  });
}

export function mountAmbientEffects(refs, { three, windingDownRef }) {
  const group = new THREE.Group();
  group.name = "cromo-fx";
  let attachedTo = null;
  let mono = null;
  let dims = "";
  let topSweep = null;
  const sideSweeps = [];
  const ripples = [];
  const lastPos = new Map();
  let nextSweep = performance.now() + 4000;
  let sweep = null; // { start, dur, peak, dir }
  let wasWinding = false;

  onStoneChange(() => applyStoneToScene(three.current, mono));

  function clear() {
    [mono, topSweep, ...sideSweeps].forEach((m) => {
      if (!m) return;
      group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    mono = null; topSweep = null; sideSweeps.length = 0;
  }

  // (Re)builds everything sized to the board.
  function build() {
    clear();
    const H = Math.max(SLAB_X, SLAB_Z);
    const geo = new THREE.BoxGeometry(SLAB_X, H, SLAB_Z, 1, 18, 1);
    const pos = geo.attributes.position, cols = [];
    for (let i = 0; i < pos.count; i++) {
      const depth = (H / 2 - pos.getY(i)) / H; // 0 at the top, 1 at the bottom
      const k = 1 - 0.9 * Math.pow(depth, 1.25);
      cols.push(k, k, k);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    mono = new THREE.Mesh(geo, sideMaterial(true));
    mono.name = "cromo-monolith";
    mono.position.y = -SLAB_THICKNESS - H / 2;
    mono.receiveShadow = true;
    group.add(mono);

    topSweep = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_X, SLAB_Z), sweepMaterial());
    topSweep.rotation.x = -Math.PI / 2;
    topSweep.position.y = 0.002;
    topSweep.renderOrder = 2;
    group.add(topSweep);

    // The cube's four sides, just proud of the faces, from the slab's
    // top edge down the whole cube.
    const fullH = H + SLAB_THICKNESS;
    [[0, SLAB_Z / 2, 0, SLAB_X], [Math.PI, -SLAB_Z / 2, 0, SLAB_X], [Math.PI / 2, 0, SLAB_X / 2, SLAB_Z], [-Math.PI / 2, 0, -SLAB_X / 2, SLAB_Z]].forEach(([ry, z, x, w]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, fullH), sweepMaterial());
      m.rotation.y = ry;
      m.position.set(x * 1.001, -fullH / 2, z * 1.001);
      m.material.uniforms.uDir.value.set(0.25, -0.97);
      m.material.uniforms.uWidth.value = 0.045;
      m.renderOrder = 2;
      sideSweeps.push(m);
      group.add(m);
    });
    dims = `${SLAB_X}x${SLAB_Z}`;
  }

  function startSweep(now, peak, dur) {
    const a = Math.random() * Math.PI * 2;
    sweep = { start: now, dur, peak, dir: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
    topSweep.material.uniforms.uDir.value.copy(sweep.dir);
  }

  function spawnRipple(x, z, size) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uR: { value: 0 }, uStr: { value: 0 } },
      vertexShader: SWEEP_VERT, fragmentShader: RING_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8,
    });
    const reach = size * 1.1 + 0.9;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2, reach * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.003, z);
    m.renderOrder = 3;
    group.add(m);
    ripples.push({ m, born: performance.now(), life: 1100 + size * 250, peak: getStone() === "shungite" ? 0.24 : 0.2 });
  }

  // Pieces coming to rest somewhere new: a piece whose square changed
  // and has then held still for a few frames. (A roll lifts the piece
  // onto a pivot, so it shows up as its id coming back somewhere else; a
  // slide may move it in place, which the stillness check waits out.)
  // Several changing at once is a new board or an undo, not a landing.
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
          const b = o.geometry.boundingBox;
          spawnRipple(o.position.x, o.position.z, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
        }
      }
    });
    const bulk = changed.length > 2;
    changed.forEach((rec) => { rec.bulk = bulk; });
  }

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup) return false;
    if (attachedTo !== t.boardGroup) {
      t.boardGroup.add(group);
      attachedTo = t.boardGroup;
    }
    if (dims !== `${SLAB_X}x${SLAB_Z}`) build();
    // The slab's own box outline would draw a line where it meets the
    // cube; the monolith continues the faces instead.
    const edges = t.boardGroup.getObjectByName("ec-slab-edges");
    if (edges) edges.visible = false;
    return true;
  }

  return {
    armOnBegin() {
      if (attach()) startSweep(performance.now(), 0.16, 3200);
      nextSweep = performance.now() + 9000;
    },
    restart() {
      wasWinding = false;
      nextSweep = performance.now() + 3000;
    },
    tick(now) {
      if (!attach()) return;
      const winding = !!(windingDownRef && windingDownRef.current);
      if (winding && !wasWinding) startSweep(now, 0.2, 4200); // the game's end: one slow, bright pass
      wasWinding = winding;
      if (!sweep && !winding && now > nextSweep) {
        startSweep(now, getStone() === "shungite" ? 0.075 : 0.06, 2600 + Math.random() * 900);
        nextSweep = now + 9000 + Math.random() * 7000;
      }
      if (sweep) {
        const u = (now - sweep.start) / sweep.dur;
        if (u >= 1) {
          sweep = null;
          topSweep.material.uniforms.uStr.value = 0;
          sideSweeps.forEach((m) => { m.material.uniforms.uStr.value = 0; });
        } else {
          const env = Math.sin(Math.PI * u);
          topSweep.material.uniforms.uPos.value = -1.6 + 3.2 * u;
          topSweep.material.uniforms.uStr.value = sweep.peak * env;
          // The sides follow a beat later, running down the cube.
          const us = Math.max(0, Math.min(1, (u - 0.15) / 0.85));
          sideSweeps.forEach((m) => {
            m.material.uniforms.uPos.value = -1.4 + 2.8 * us;
            m.material.uniforms.uStr.value = sweep.peak * 0.7 * Math.sin(Math.PI * us);
          });
        }
      }
      watchLandings();
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const u = (now - r.born) / r.life;
        if (u >= 1) {
          group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - u, 3);
        r.m.material.uniforms.uR.value = 0.08 + ease * 0.88;
        r.m.material.uniforms.uStr.value = r.peak * (1 - u) * Math.min(1, u * 8);
      }
    },
    dispose() {
      onStoneChange(null);
      ripples.forEach((r) => { group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); });
      ripples.length = 0;
      clear();
      if (attachedTo) attachedTo.remove(group);
    },
  };
}
