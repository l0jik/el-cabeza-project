/* Tienda's scene life: the store built round the board, and what keeps
   it running well on whatever it's played on.

   - The store (tienda-store.js) and the display table hang off the
     chassis's boardGroup, so they turn with the board: turning the board
     reads as walking round the table. The table and the brass on the
     board's frame are rebuilt if the board changes size.
   - Distance: the camera's far plane is pushed out to the walls, and a
     faint haze of the store's own colour falls over the far end of the
     aisles. When the camera rises above the drop ceiling (a top-down
     view, zoomed right out) the ceiling steps aside.
   - Lettering: the signs are painted once at once, and again when the
     period fonts have arrived.
   - Wood grain that follows a roll (see grainTurns in tienda.js).
   - Device fit: the tier's pixel-ratio cap and shadow size are applied
     at once, and a frame-rate governor then lowers the pixel ratio if
     the device can't hold a steady frame rate (and raises it again,
     within the cap, when it can). Paused while the tab is hidden.
   - A tube near the court that fails to strike now and then; the sound
     buzzes with it (tienda-audio.js). */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_THICKNESS } from "../engine/constants.js";
import { buildStore, buildTable, CEIL } from "./tienda-store.js";
import { grainTurns, storeEnv } from "./tienda.js";
import { quality } from "./tienda-quality.js";
import { ensurePaper } from "./tienda-textures.js";

const FONT_FACES = ["800 40px 'Libre Franklin'", "900 40px 'Libre Franklin'", "700 40px 'Libre Franklin'", "600 40px 'Libre Franklin'", "700 40px 'Courier Prime'", "400 40px 'Courier Prime'", "700 40px 'Bodoni Moda'", "italic 700 40px 'Libre Franklin'"];

// Brass on the board's frame: latch plates at the middle of the two long
// edges, and the hinge barrels at the ends of the fold.
function buildBrass() {
  const q = quality();
  const group = new THREE.Group();
  group.name = "tienda-brass";
  const mat = q.physical
    ? new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.34, envMap: storeEnv(), envMapIntensity: 1.1 })
    : new THREE.MeshLambertMaterial({ color: 0xc9a24a });
  const y = -SLAB_THICKNESS / 2;
  const plate = (x, z, ry) => {
    const g = new THREE.BoxGeometry(1.1, SLAB_THICKNESS * 0.62, 0.05);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; group.add(m);
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.09), mat); k.position.set(x, y + 0.02, z); k.rotation.y = ry; group.add(k);
  };
  plate(0, SLAB_Z / 2 + 0.025, 0);
  plate(0, -SLAB_Z / 2 - 0.025, 0);
  [-1, 1].forEach((s) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.3, 12), mat);
    c.rotation.x = Math.PI / 2; c.position.set(s * (SLAB_X / 2 + 0.07), y + SLAB_THICKNESS * 0.1, 0); group.add(c);
  });
  return {
    group,
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); mat.dispose(); },
  };
}

export function mountAmbientEffects(refs, { three, windingDownRef, audio }) {
  const q = quality();
  let store = null, table = null, brass = null;
  let attachedTo = null, dims = "";
  let tuned = false;
  let fogBefore = null, farBefore = null;
  ensurePaper();

  /* ---- lettering in the period fonts, once they're here ---- */
  let fontsDone = false;
  if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
    const t0 = performance.now();
    Promise.all(FONT_FACES.map((f) => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready)
      .then(() => { fontsDone = true; if (store) store.repaintSigns(); if (table) table.repaint(); })
      .catch(() => { /* fall back to what's painted */ });
    // In case a font never answers, repaint once anyway after a while.
    setTimeout(() => { if (!fontsDone && store) { store.repaintSigns(); if (table) table.repaint(); } }, Math.max(0, 4000 - (performance.now() - t0)));
  }

  /* ---- device fit: pixel ratio, shadows, the frame-rate governor ---- */
  let pr = 1;
  const frames = [];
  let lastFrame = 0, lastJudged = 0, lastRaise = 0, settleUntil = 0;
  function setPixelRatio(v) {
    const t = three.current;
    if (!t || !t.renderer) return;
    pr = Math.max(q.dprFloor, Math.min(v, q.dprCap, window.devicePixelRatio || 1));
    t.renderer.setPixelRatio(pr);
    const size = t.getMountSize && t.getMountSize();
    if (size) t.renderer.setSize(size.w, size.h);
    settleUntil = performance.now() + 1500;
    frames.length = 0;
    if (typeof window !== "undefined") window.__TIENDA_PIXEL_RATIO__ = pr;
  }
  function tune(t) {
    if (tuned || !t.renderer) return;
    tuned = true;
    setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dprCap));
    const key = t.lights && t.lights.key;
    if (key && key.shadow && key.shadow.mapSize.x !== q.shadowMap) {
      key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    }
    if (typeof window !== "undefined") window.__TIENDA_QUALITY__ = q.tier;
  }
  function govern(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    if (document.hidden || now < settleUntil || dt <= 0 || dt > 250) return; // tab away, a hitch, or just changed
    frames.push(dt);
    if (frames.length > 120) frames.shift();
    if (now - lastJudged < 2000 || frames.length < 60) return;
    lastJudged = now;
    const sorted = frames.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const slow = sorted[Math.floor(sorted.length * 0.9)];
    if (median > 1000 / 42 && pr > q.dprFloor + 0.01) setPixelRatio(pr - 0.2);
    else if (slow < 1000 / 56 && pr < Math.min(q.dprCap, window.devicePixelRatio || 1) - 0.01 && now - lastRaise > 8000) { lastRaise = now; setPixelRatio(pr + 0.15); }
  }

  /* ---- wood grain that follows a roll ---- */
  const seen = new Map(); // pieceId -> { mesh, rel: THREE.Quaternion }
  const qBoard = new THREE.Quaternion(), qMesh = new THREE.Quaternion(), mTmp = new THREE.Matrix4(), m3 = new THREE.Matrix3();
  function snapTurn(quat) {
    mTmp.makeRotationFromQuaternion(quat);
    const e = mTmp.elements;
    // Round to the nearest quarter-turn rotation; identity means no roll.
    let identity = true;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const v = Math.round(e[c * 4 + r]);
      e[c * 4 + r] = v;
      if (v !== (r === c ? 1 : 0)) identity = false;
    }
    return identity ? null : m3.setFromMatrix4(mTmp).clone();
  }
  function followGrain(t) {
    if (!t.pieceGroup || !t.boardGroup) return;
    t.boardGroup.getWorldQuaternion(qBoard).invert();
    const live = new Set();
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId;
      live.add(id);
      const rec = seen.get(id);
      if (rec && rec.mesh !== o) {
        // A new mesh for this piece: if the old one ended turned, the
        // block rolled; carry the grain through the turn.
        const R = snapTurn(rec.rel);
        if (R) {
          const prev = grainTurns.get(id) || new THREE.Matrix3();
          const next = prev.clone().multiply(R.transpose());
          grainTurns.set(id, next);
          const u = o.material && o.material.userData && o.material.userData.wood;
          if (u) u.uGrainTurn.value.copy(next);
        }
      }
      o.getWorldQuaternion(qMesh);
      const rel = qBoard.clone().multiply(qMesh);
      seen.set(id, { mesh: o, rel });
    });
    // Pieces gone (crushed, or a new game): forget them.
    seen.forEach((v, id) => { if (!live.has(id)) seen.delete(id); });
  }

  /* ---- attach and size the store ---- */
  const camLocal = new THREE.Vector3();
  function build(t) {
    if (table) { t.boardGroup.remove(table.group); table.dispose(); }
    if (brass) { t.boardGroup.remove(brass.group); brass.dispose(); }
    table = buildTable(SLAB_X, SLAB_Z);
    brass = buildBrass();
    t.boardGroup.add(table.group, brass.group);
    if (fontsDone) table.repaint();
    dims = `${SLAB_X}x${SLAB_Z}`;
  }
  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup) return false;
    tune(t);
    if (attachedTo !== t.boardGroup) {
      if (!store) store = buildStore();
      t.boardGroup.add(store.group);
      attachedTo = t.boardGroup;
      if (t.scene) { fogBefore = t.scene.fog; t.scene.fog = new THREE.Fog(0xcbc3ad, 260, 1150); }
      if (t.camera) { farBefore = t.camera.far; t.camera.far = 1600; t.camera.updateProjectionMatrix(); }
      if (typeof window !== "undefined") {
        window.__TIENDA_STORE__ = true;
        if (window.__EC_TEST_HOOKS__) window.__TIENDA_THREE__ = t; // tests: read the scene
      }
    }
    if (dims !== `${SLAB_X}x${SLAB_Z}`) build(t);
    return true;
  }

  return {
    armOnBegin() {},
    restart() {},
    tick(now) {
      if (!attach()) return;
      const t = three.current;
      govern(now);
      followGrain(t);
      store.animate(now, { onFlicker: (ms) => { if (audio && audio.playTubeFlicker && !(windingDownRef && windingDownRef.current)) audio.playTubeFlicker(ms); } });
      // Above the drop ceiling, it steps aside.
      if (t.camera) {
        camLocal.copy(t.camera.position);
        t.boardGroup.worldToLocal(camLocal);
        const above = camLocal.y > CEIL - 3;
        store.group.children.forEach((o) => { if (o.name === "tienda-ceiling" || o.name === "tienda-troffers") o.visible = !above; });
      }
    },
    dispose() {
      const t = three.current;
      if (attachedTo) {
        attachedTo.remove(store.group);
        if (table) attachedTo.remove(table.group);
        if (brass) attachedTo.remove(brass.group);
      }
      if (store) store.dispose();
      if (table) table.dispose();
      if (brass) brass.dispose();
      if (t && t.scene) t.scene.fog = fogBefore;
      if (t && t.camera && farBefore) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
    },
  };
}
