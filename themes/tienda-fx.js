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
   - Wood grain that follows a roll (wood-set.js followGrain).
   - Device fit: the tier's pixel-ratio cap and shadow size are applied
     at once, and a frame-rate governor then lowers the pixel ratio if
     the device can't hold a steady frame rate (and raises it again,
     within the cap, when it can). Paused while the tab is hidden.
   - A tube near the court that fails to strike now and then; the sound
     buzzes with it (tienda-audio.js). */

import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../engine/constants.js";
import { buildStore, buildTable, CEIL, storeRevisited } from "./tienda-store.js";
import { woodSet } from "./tienda.js";
import { quality } from "./tienda-quality.js";
import { ensurePaper, ensureNewsprint } from "./tienda-textures.js";

const FONT_FACES = ["800 40px 'Libre Franklin'", "900 40px 'Libre Franklin'", "700 40px 'Libre Franklin'", "600 40px 'Libre Franklin'", "700 40px 'Courier Prime'", "400 40px 'Courier Prime'", "700 40px 'Bodoni Moda'", "italic 700 40px 'Libre Franklin'"];

export function mountAmbientEffects(refs, { three, cam, windingDownRef, audio }) {
  const q = quality();
  let store = null, table = null, brass = null;
  let attachedTo = null, dims = "";
  let tuned = false;
  let revisitUntil = 0;
  let fogBefore = null, farBefore = null;
  ensurePaper();
  ensureNewsprint();

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

  /* ---- attach and size the store ---- */
  const camLocal = new THREE.Vector3();
  function build(t) {
    if (table) { t.boardGroup.remove(table.group); table.dispose(); }
    if (brass) { t.boardGroup.remove(brass.group); brass.dispose(); }
    table = buildTable(SLAB_X, SLAB_Z);
    brass = woodSet.buildBrass();
    t.boardGroup.add(table.group, brass.group);
    if (fontsDone) table.repaint();
    dims = `${SLAB_X}x${SLAB_Z}`;
  }
  /* The game's advertisement on its stand, by the table. Orbiting wide,
     the camera could come round behind it and the back of the stand
     filled the screen (the user's video: "just brown"). When the camera
     is in it, or looking through it at the table from close enough that
     it would cover about half the width of the screen, it fades away,
     and comes back once the view is clear. From further off its back is
     part of the room. */
  const camAhead = new THREE.Vector3(), camDir = new THREE.Vector3();
  const keyDir = new THREE.Vector3(), keyQuat = new THREE.Quaternion();
  let asideLast = 0;
  function standeeAside(t, now) {
    const S = store.standee;
    if (!S) return;
    t.camera.getWorldDirection(camDir);
    camAhead.copy(t.camera.position).add(camDir);
    t.boardGroup.worldToLocal(camAhead);
    camDir.subVectors(camAhead, camLocal).normalize();
    // The camera in the standee's frame: a across it, b out of its face.
    const c = Math.cos(S.ry), s = Math.sin(S.ry);
    const rx = camLocal.x - S.x, rz = camLocal.z - S.z;
    const a = rx * c - rz * s, b = rx * s + rz * c;
    const da = camDir.x * c - camDir.z * s, db = camDir.x * s + camDir.z * c;
    const wide = S.halfW + 2;
    let block = Math.abs(a) < wide && b > -5 && b < 6 && camLocal.y > S.yLo - 2 && camLocal.y < S.yHi + 2;
    if (!block && b < 0 && db > 1e-4) {
      const d = -b / db;
      if (d > 0) {
        const ha = a + da * d, hy = camLocal.y + camDir.y * d;
        if (Math.abs(ha) < wide && hy > S.yLo && hy < S.yHi) {
          const hfov = 2 * Math.atan(Math.tan((t.camera.fov * Math.PI) / 360) * t.camera.aspect);
          block = (2 * wide) / (2 * d * Math.tan(hfov / 2)) > 0.45;
        }
      }
    }
    const dt = Math.min(0.1, Math.max(0, (now - (asideLast || now)) / 1000));
    asideLast = now;
    const was = S.fade;
    S.fade = block ? Math.max(0, S.fade - dt / 0.25) : Math.min(1, S.fade + dt / 0.35);
    if (S.fade === was && S.fadeSet) return;
    S.fadeSet = true;
    S.parts.forEach((m) => {
      if (!m) return;
      m.visible = S.fade > 0.01;
      m.material.opacity = S.fade;
      m.material.depthWrite = S.fade > 0.99;
    });
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__TIENDA_STANDEE__ = S.fade;
  }
  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup) return false;
    tune(t);
    if (attachedTo !== t.boardGroup) {
      if (!store) store = buildStore();
      t.boardGroup.add(store.group);
      // Back after the story there's no board to frame, only the table
      // and its appliances: the view steps back to take in the table.
      if (storeRevisited()) revisitUntil = performance.now() + 3000;
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
      woodSet.followGrain(t); // the grain turns with the rolls (wood-set.js)
      /* Back after the whole story, El Cabeza is nowhere to be seen: the
         board, its pieces, their markers and the brass all go; only the
         store and the table (with its appliances) stay. Every frame, so
         anything the chassis adds to the board later goes too. */
      if (storeRevisited()) t.boardGroup.children.forEach((o) => { o.visible = o === store.group || (table && o === table.group); });
      // (Held through the first moments: the opening framing, fitted to
      // the board, runs after the store is up and would pull it back in.
      // After that the player zooms as they like.)
      if (now < revisitUntil && cam && cam.current) {
        if (cam.current.radius < 62) cam.current.radius = 62;
        if (cam.current.phi > 0.95) cam.current.phi = 0.95;
      }
      store.animate(now, { onFlicker: (ms) => { if (audio && audio.playTubeFlicker && !(windingDownRef && windingDownRef.current)) audio.playTubeFlicker(ms); } });
      // Above the drop ceiling, it steps aside.
      if (t.camera) {
        camLocal.copy(t.camera.position);
        t.boardGroup.worldToLocal(camLocal);
        const above = camLocal.y > CEIL - 3;
        store.group.children.forEach((o) => { if (o.name === "tienda-ceiling" || o.name === "tienda-troffers") o.visible = !above; });
        standeeAside(t, now);
      }
      // The table's cast shadow follows the key light (fixed in the world)
      // as the board, the table and the store turn under it.
      const key = t.lights && t.lights.key;
      if (table && table.setKeyDir && key) {
        keyDir.copy(key.position).sub(key.target.position).normalize();
        t.boardGroup.getWorldQuaternion(keyQuat).invert();
        keyDir.applyQuaternion(keyQuat);
        table.setKeyDir(keyDir);
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
      // Gone with the store (Nova's story moves on to the den).
      if (typeof window !== "undefined") { window.__TIENDA_STORE__ = false; delete window.__TIENDA_THREE__; }
    },
  };
}
