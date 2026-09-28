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
     (setMusicPlaying).
   - The television (den-tv.js): a tap on the set (pickScene "tv", then
     sceneTap) turns its knob, on or off, and the picture comes up or goes.
     In Nova (apps/unified.jsx hands in `tv`) it's the way into
     Singularity: once the test pattern is up the camera goes over to the
     set and into the picture, and Nova's own transition takes over
     (tv.enter). Back out of Singularity (tv.returning) the den comes up
     with the camera at the set, the pattern on it, and the set switches
     off as the camera goes back to the board. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_MAX } from "../engine/constants.js";
import { buildDen } from "./den-room.js";
import { quality } from "./tienda-quality.js";

const LID_FONTS = ["700 40px 'Bodoni Moda'", "500 40px 'Bodoni Moda'", "700 40px 'Libre Franklin'", "700 40px 'Courier Prime'"];

export function createDenEffects(woodSet) {
  return function mountAmbientEffects(refs, { three, audio, tv: novaTv = null }) {
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

    /* ---- the rules leaflet's "?" ----
       Under the mouse, over the leaflet on the coffee table (or the box):
       a "?" pops up above the leaflet, where it lies on screen, to say
       it's the rules, a tap away (standard.js styleSheet, .den-rules-hint). */
    let rulesHover = false, hintEl = null;
    const hintAt = new THREE.Vector3();
    function showRulesHint(t) {
      if (typeof document === "undefined") return;
      if (!hintEl) {
        if (!rulesHover) return;
        hintEl = document.createElement("div");
        hintEl.className = "den-rules-hint";
        hintEl.setAttribute("data-testid", "den-rules-hint");
        hintEl.setAttribute("aria-hidden", "true");
        hintEl.innerHTML = "<span>?</span>";
        document.body.appendChild(hintEl);
      }
      if (rulesHover && t.camera && t.renderer) {
        const r = t.renderer.domElement.getBoundingClientRect();
        den.table.rules.leaflet.getWorldPosition(hintAt).project(t.camera);
        hintEl.style.left = `${r.left + ((hintAt.x + 1) / 2) * r.width}px`;
        hintEl.style.top = `${r.top + ((1 - hintAt.y) / 2) * r.height}px`;
      }
      hintEl.classList.toggle("on", rulesHover && hintAt.z < 1);
    }

    /* ---- focus: just the board ----
       The room's lights go down round the board and it floats: the fog
       closes in to just past the board, going near-black, so the room
       sinks into the dark from the table's far edge out (every surface
       in it, the lamps' glows too, is fogged; the fire's flames, which
       aren't, go out); the room and the table drop a little away under
       the board, which hangs over its own shadow, drifting slowly; and a
       veil over the picture darkens (and, where the device can take it,
       blurs) everything outside an ellipse round the board on screen
       (standard.js styleSheet, .den-focus-veil). The music visit and the
       set's visit bring the room back while they last. */
    let focusOn = false, fw = 0, lastFocusTick = 0, veil = null, flames = null, tableMats = null, lastE = 0;
    const FOG = { color: new THREE.Color(0x1c130c), bg: new THREE.Color(0x140d08), near: 150, far: 420 };
    const DARK = new THREE.Color(0x070403);
    const FOCUS_LIFT = 1.3; // how far the room drops under the board
    const corner = new THREE.Vector3();
    const blurOk = q.physical && typeof CSS !== "undefined" && CSS.supports && (CSS.supports("backdrop-filter", "blur(2px)") || CSS.supports("-webkit-backdrop-filter", "blur(2px)"));
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_FOCUS__ = () => ({ on: focusOn, w: fw, lift: den ? -den.group.position.y : 0, fogNear: three.current && three.current.scene && three.current.scene.fog ? three.current.scene.fog.near : null });
    function focusFrame(t, now) {
      const dt = lastFocusTick ? Math.min(0.1, (now - lastFocusTick) / 1000) : 0;
      lastFocusTick = now;
      const goal = focusOn && focusGoal === 0 && tvGoal === 0 ? 1 : 0;
      fw += (goal - fw) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(goal - fw) < 0.002) fw = goal;
      const e = fw * fw * (3 - 2 * fw);
      const scene = t.scene;
      if (scene && scene.fog && scene.fog.isFog) {
        const camDist = camLocal.length();
        const reach = SLAB_MAX * 0.8;
        scene.fog.near = FOG.near + (camDist + reach - FOG.near) * e;
        scene.fog.far = FOG.far + (camDist + reach + 46 - FOG.far) * e;
        scene.fog.color.copy(FOG.color).lerp(DARK, e);
        if (scene.background && scene.background.isColor) scene.background.copy(FOG.bg).lerp(DARK, e);
      }
      // The fire's flames (unfogged, drawn additively) go out with the room.
      if (!flames) { flames = []; den.groups.wallN.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial && o.material.blending === THREE.AdditiveBlending) flames.push({ o, v: o.visible }); }); }
      flames.forEach((f) => { f.o.visible = f.v && e < 0.45; });
      // The table and what's on it (too near for the fog) go down into the
      // dark with the room; the board, lit as ever, stays.
      if (e !== lastE) {
        lastE = e;
        if (!tableMats) { tableMats = new Map(); den.table.group.traverse((o) => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.color && !tableMats.has(m)) tableMats.set(m, m.color.clone()); }); }); }
        tableMats.forEach((base, m) => m.color.copy(base).multiplyScalar(1 - 0.78 * e));
      }
      // The float: the room (and the table) a little way down under the
      // board, and a slow drift.
      den.group.position.y = -(FOCUS_LIFT + Math.sin(now * 0.0011) * 0.12) * e;
      // The veil: an ellipse round the board on screen stays clear.
      if (typeof document === "undefined" || !t.renderer || !t.camera) return;
      if (!veil) {
        if (e <= 0) return;
        const mount = t.renderer.domElement.parentNode;
        if (!mount) return;
        veil = document.createElement("div");
        veil.className = `den-focus-veil${blurOk ? " blur" : ""}`;
        veil.setAttribute("data-testid", "den-focus-veil");
        veil.setAttribute("aria-hidden", "true");
        mount.appendChild(veil);
      }
      veil.style.opacity = e.toFixed(3);
      veil.style.visibility = e > 0 ? "visible" : "hidden";
      if (e <= 0) return;
      const r = t.renderer.domElement.getBoundingClientRect();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [sx, sy, sz] of [[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1], [-1, 2.2, -1], [1, 2.2, -1], [-1, 2.2, 1], [1, 2.2, 1]]) {
        corner.set((sx * SLAB_X) / 2, sy, (sz * SLAB_Z) / 2);
        t.boardGroup.localToWorld(corner).project(t.camera);
        const px = ((corner.x + 1) / 2) * r.width, py = ((1 - corner.y) / 2) * r.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      veil.style.setProperty("--cx", `${((x0 + x1) / 2).toFixed(1)}px`);
      veil.style.setProperty("--cy", `${((y0 + y1) / 2).toFixed(1)}px`);
      veil.style.setProperty("--rx", `${Math.max(60, ((x1 - x0) / 2) * 1.3).toFixed(1)}px`);
      veil.style.setProperty("--ry", `${Math.max(60, ((y1 - y0) / 2) * 1.45).toFixed(1)}px`);
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
      flames = null; tableMats = null; lastE = -1; // focus finds the new room's fire and table
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

    /* ---- the television ---- */
    let tvGoal = 0, tvW = 0, tvDive = 0, tvPhase = "off", lastTick = 0, offAt = 0, onStage = false;
    let returning = !!(novaTv && novaTv.returning);
    // How loud the snow hisses, by what's on the screen.
    const HISS = { warming: 1, snow: 1, resolving: 0.5, pattern: 0.1, dive: 0.08 };
    function pressTv() {
      const set = den && den.tv;
      if (!set) return false;
      const now = performance.now();
      if (set.isOn()) {
        if (set.powerOff(now)) { tvGoal = 0; if (audio && audio.tvOff) audio.tvOff(); }
        return true;
      }
      const portal = !!(novaTv && novaTv.portal && novaTv.portal());
      // If Nova can't go after all (something else under way), the set
      // goes off and the camera comes back.
      const enter = () => {
        if (novaTv.enter() !== false) return;
        if (set.powerOff(performance.now(), true) && audio && audio.tvOff) audio.tvOff();
        tvGoal = 0;
      };
      if (!set.powerOn(now, portal, portal ? enter : null)) return false;
      if (portal) tvGoal = 1;
      if (audio && audio.tvOn) audio.tvOn();
      return true;
    }
    if (novaTv && novaTv.register) novaTv.register({ press: pressTv });
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__DEN_TV__ = () => ({ phase: den && den.tv ? den.tv.phase() : null, focus: tvW, goal: tvGoal, dive: tvDive });
      window.__DEN_TV_PRESS__ = pressTv;
    }
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
        showRulesHint(t);
        focusFrame(t, now);
        listen(t, now);
        // The television.
        const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
        lastTick = now;
        if (returning) {
          // Back from Singularity: the set is on, the camera at it; then,
          // once Nova's transition has finished showing the room (it ends
          // about 0.6 s after this), off.
          returning = false;
          den.tv.showPattern(now);
          tvGoal = tvW = 1;
          offAt = now + 1800;
        }
        if (offAt && now >= offAt) {
          offAt = 0;
          if (den.tv.powerOff(now) && audio && audio.tvOff) audio.tvOff();
          tvGoal = 0;
        }
        tvDive = den.tv.animate(now, dt);
        // While the camera visits the set, the title and the dock's piece
        // step aside (standard.js styleSheet, html.ec-tv-visit).
        const visiting = tvGoal > 0 || tvW > 0.02;
        if (visiting !== onStage && typeof document !== "undefined") { onStage = visiting; document.documentElement.classList.toggle("ec-tv-visit", visiting); }
        const ph = den.tv.phase();
        if (ph !== tvPhase) {
          if (audio && audio.tvHiss) audio.tvHiss(HISS[ph] || 0);
          if (ph === "pattern" && tvPhase === "resolving" && audio && audio.tvTone) audio.tvTone();
          tvPhase = ph;
        }
      },
      // The music menu opened (true) or closed: the camera goes over to the console, or back.
      setMusicFocus(on) { focusGoal = on ? 1 : 0; },
      setMusicPlaying(medium) { playing = medium || null; },
      // A tap in the room: "rules" on the leaflet or the box on the coffee
      // table, "record" or "8track" if it landed on one of the stereo's
      // machines, "tv" on the television.
      // The board and the coffee table stand in front of what's behind
      // them: a tap on the board (an empty square) with the set beyond it
      // is the board's, not the set's.
      pickScene(raycaster) {
        if (!den) return null;
        const t = three.current;
        const slab = t && t.boardGroup && t.boardGroup.getObjectByName("ec-slab");
        const onTable = raycaster.intersectObjects([slab].concat(den.table.rules.pickables).filter(Boolean), false)[0];
        if (onTable && onTable.object.userData.rules) return "rules";
        // The arc lamp by the chair (focus), and, while the south wall is
        // there, the stereo's machines and the set: the nearest.
        const things = den.lamp.pickables.concat(den.groups.wallS.visible ? den.stereo.pickables.concat(den.tv.pickables) : []);
        const hit = raycaster.intersectObjects(things, false)[0];
        if (!hit) return null;
        const nearer = raycaster.intersectObjects([slab, den.table.group].filter(Boolean), true)[0];
        if (nearer && nearer.distance < hit.distance) return null;
        if (hit.object.userData.focusLamp) return "lamp";
        return hit.object.userData.tv ? "tv" : hit.object.userData.music || null;
      },
      // What a tap on "rules" or "tv" does is the room's own: the rules
      // open at the Quick card (as How to play did; chassis/RulesCards.jsx
      // listens for the event, the name its OPEN_RULES_EVENT), the knob turns.
      sceneTap(what) {
        if (what === "rules") {
          rulesHover = false;
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "quick", focus: null } }));
          return true;
        }
        // The arc lamp: the room's lights down (focus) or up again; the
        // chassis keeps the state (its FOCUS_EVENT, a toggle).
        if (what === "lamp") {
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("el-cabeza:focus", { detail: {} }));
          return true;
        }
        if (what !== "tv") return false;
        pressTv();
        return true;
      },
      // Focus on (the chassis's switch, button, F key, or the lamp).
      setFocus(on) { focusOn = !!on; },
      // What's under the mouse: over the leaflet or the box, the "?".
      sceneHover(what) { rulesHover = what === "rules"; },
      /* After the chassis has set its camera: blend it toward the view of
         the console by how far into the visit it is (eased both ways). */
      cameraOverride(camera, dtMs) {
        const t = three.current;
        focusW += (focusGoal - focusW) * (1 - Math.exp(-(dtMs / 1000) * 2.4));
        if (Math.abs(focusGoal - focusW) < 0.001) focusW = focusGoal;
        tvW += (tvGoal - tvW) * (1 - Math.exp(-(dtMs / 1000) * 2.2));
        if (Math.abs(tvGoal - tvW) < 0.001) tvW = tvGoal;
        if (den && t && t.boardGroup && tvW > 0) {
          /* The television: far enough back to have the set in view (on a
             tall screen its sides may go), a little above it; then, as the
             picture pulls, right up to the glass. */
          const f = den.tv.focus, dv = den.tv.dive;
          const vt = Math.tan((camera.fov * Math.PI) / 360);
          const d = Math.min(70, Math.max(f.halfH / vt, f.halfW / (vt * camera.aspect)));
          const k = tvDive;
          eye.set(f.target.x + (dv.x - f.target.x) * k, f.target.y + d * 0.1 * (1 - k) + (dv.y - f.target.y) * k, f.front - d + (dv.eyeZ - (f.front - d)) * k);
          aim.copy(f.target).lerp(dv.target, k);
          t.boardGroup.localToWorld(eye); t.boardGroup.localToWorld(aim);
          const e = tvW * tvW * (3 - 2 * tvW);
          camera.getWorldDirection(dir);
          look.copy(camera.position).addScaledVector(dir, camera.position.length());
          look.lerp(aim, e);
          camera.position.lerp(eye, e);
          camera.lookAt(look);
          return true;
        }
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
        if (novaTv && novaTv.register) novaTv.register(null);
        if (hintEl) { hintEl.remove(); hintEl = null; }
        if (veil) { veil.remove(); veil = null; }
        if (typeof document !== "undefined") document.documentElement.classList.remove("ec-tv-visit");
        if (typeof window !== "undefined") { window.__DEN_ROOM__ = false; delete window.__DEN_THREE__; delete window.__DEN_STEREO__; delete window.__DEN_TV__; delete window.__DEN_TV_PRESS__; }
      },
    };
  };
}
