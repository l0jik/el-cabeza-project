/* The den's scene life (Standard): the room built round the board, and
   what keeps it running well on whatever it's played on.

   - The room (den-room.js), the coffee table and the brass on the board's
     frame hang off the chassis's boardGroup, so they turn with the board:
     turning the board reads as walking round the pit. All of it is
     rebuilt if the board changes size (the table and the pit follow it).
   - Distance: the camera's far plane goes out to the walls, a warm dark
     haze falls over the far side of the room, and whichever wall (or the
     ceiling) the camera has gone behind steps aside.
   - The fire, the lamps' glow, the rain on the glass and the clock's
     hands, every frame.
   - Wood grain that follows a roll (wood-set.js followGrain).
   - Device fit: the tier's pixel-ratio cap and shadow size at once, then
     a frame-rate governor lowers the pixel ratio if the device can't hold
     a steady frame rate (and raises it again, within the cap, when it can).
   - The fire's sound follows the camera: how far the fireplace is and
     which side it's on (audio.setFireListener).
   - The stereo console: while the music menu is open the camera glides
     over to it (cameraOverride, called by the chassis after its own
     camera each frame, blending from the chassis's view to the console's
     and back); a tap on the record player or the 8-track (pickScene)
     opens that menu; the turntable and the 8-track play along
     (setMusicPlaying). */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_MAX } from "../engine/constants.js";
import { buildDen } from "./den-room.js";
import { quality } from "./tienda-quality.js";

const LID_FONTS = ["700 40px 'Bodoni Moda'", "500 40px 'Bodoni Moda'", "700 40px 'Libre Franklin'", "700 40px 'Courier Prime'"];

export function createDenEffects(woodSet) {
  return function mountAmbientEffects(refs, { three, audio }) {
    const q = quality();
    let den = null, brass = null, attachedTo = null, dims = "";
    let tuned = false, fogBefore = null, farBefore = null, bgBefore = null;

    /* ---- the box lid's lettering, once its fonts are here ---- */
    let fontsDone = false;
    if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
      Promise.all(LID_FONTS.map((f) => document.fonts.load(f).catch(() => null)))
        .then(() => document.fonts.ready)
        .then(() => { fontsDone = true; if (den) den.repaint(); })
        .catch(() => { /* keep what's painted */ });
    }

    /* ---- device fit ---- */
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
      if (typeof window !== "undefined") window.__DEN_PIXEL_RATIO__ = pr;
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
      if (typeof window !== "undefined") window.__DEN_QUALITY__ = q.tier;
    }
    function govern(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      if (document.hidden || now < settleUntil || dt <= 0 || dt > 250) return;
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

    /* ---- attach, and rebuild for a new board size ---- */
    function build(t) {
      if (den) { t.boardGroup.remove(den.group); den.dispose(); }
      if (brass) { t.boardGroup.remove(brass.group); brass.dispose(); }
      den = buildDen(SLAB_MAX);
      brass = woodSet.buildBrass();
      t.boardGroup.add(den.group, brass.group);
      if (fontsDone) den.repaint();
      dims = `${SLAB_X}x${SLAB_Z}`;
    }
    function attach() {
      const t = three.current;
      if (!t || !t.boardGroup) return false;
      tune(t);
      if (attachedTo !== t.boardGroup) {
        attachedTo = t.boardGroup;
        if (t.scene) {
          fogBefore = t.scene.fog; bgBefore = t.scene.background;
          t.scene.fog = new THREE.Fog(0x1c130c, 150, 420);
          t.scene.background = new THREE.Color(0x140d08);
        }
        if (t.camera) { farBefore = t.camera.far; t.camera.far = 900; t.camera.updateProjectionMatrix(); }
        if (typeof window !== "undefined") {
          window.__DEN_ROOM__ = true;
          if (window.__EC_TEST_HOOKS__) window.__DEN_THREE__ = t; // tests: read the scene
        }
        dims = "";
      }
      if (dims !== `${SLAB_X}x${SLAB_Z}`) build(t);
      return true;
    }

    const camLocal = new THREE.Vector3();
    /* ---- the fire's sound, from where the camera is ---- */
    const firePos = new THREE.Vector3(), fireCam = new THREE.Vector3();
    let lastFire = 0;
    function listen(t, now) {
      if (!audio || !audio.setFireListener || !t.camera || now - lastFire < 100) return;
      lastFire = now;
      firePos.copy(den.firePoint); t.boardGroup.localToWorld(firePos);
      fireCam.copy(firePos).applyMatrix4(t.camera.matrixWorldInverse);
      audio.setFireListener(firePos.distanceTo(t.camera.position), fireCam.x / Math.max(1, Math.hypot(fireCam.x, fireCam.z)));
    }
    /* ---- the stereo console: the camera's visit, the machines ---- */
    let focusGoal = 0, focusW = 0, playing = null;
    const eye = new THREE.Vector3(), aim = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3();
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_STEREO__ = () => ({ focus: focusW, goal: focusGoal, playing });
    return {
      armOnBegin() {},
      restart() {},
      tick(now) {
        if (!attach()) return;
        const t = three.current;
        govern(now);
        woodSet.followGrain(t);
        if (t.camera) { camLocal.copy(t.camera.position); t.boardGroup.worldToLocal(camLocal); }
        den.animate(now, t.camera ? camLocal : null, { open: focusGoal > 0 && focusW > 0.6, playing });
        listen(t, now);
      },
      // The music menu opened (true) or closed: the camera goes over to the console, or back.
      setMusicFocus(on) { focusGoal = on ? 1 : 0; },
      setMusicPlaying(medium) { playing = medium || null; },
      // A tap in the room: "record" or "8track" if it landed on one of the machines.
      pickScene(raycaster) {
        if (!den || !den.groups.wallS.visible) return null;
        const hit = raycaster.intersectObjects(den.stereo.pickables, false)[0];
        return hit ? hit.object.userData.music : null;
      },
      /* After the chassis has set its camera: blend it toward the view of
         the console by how far into the visit it is (eased both ways). */
      cameraOverride(camera, dtMs) {
        const t = three.current;
        focusW += (focusGoal - focusW) * (1 - Math.exp(-(dtMs / 1000) * 2.4));
        if (Math.abs(focusGoal - focusW) < 0.001) focusW = focusGoal;
        if (!den || !t || !t.boardGroup || focusW <= 0) return false;
        const e = focusW * focusW * (3 - 2 * focusW);
        eye.copy(den.stereo.focus.eye); aim.copy(den.stereo.focus.target);
        // A tall screen: step back and aim lower, so the console sits in the
        // top of the frame, above the music panel.
        if (camera.aspect < 0.9) { eye.z -= 14; eye.y += 3; aim.y -= 10; }
        t.boardGroup.localToWorld(eye); t.boardGroup.localToWorld(aim);
        camera.getWorldDirection(dir);
        look.copy(camera.position).addScaledVector(dir, camera.position.length());
        look.lerp(aim, e);
        camera.position.lerp(eye, e);
        camera.lookAt(look);
        return true;
      },
      dispose() {
        const t = three.current;
        if (attachedTo) {
          if (den) attachedTo.remove(den.group);
          if (brass) attachedTo.remove(brass.group);
        }
        if (den) den.dispose();
        if (brass) brass.dispose();
        if (t && t.scene) { t.scene.fog = fogBefore; t.scene.background = bgBefore; }
        if (t && t.camera && farBefore) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
        if (typeof window !== "undefined") { window.__DEN_ROOM__ = false; delete window.__DEN_THREE__; delete window.__DEN_STEREO__; }
      },
    };
  };
}
