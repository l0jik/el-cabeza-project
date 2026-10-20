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
     at once, and the shared frame-rate governor (chassis/device-fit.js,
     handed to the chassis as three.current.governor, which runs it each
     frame) lowers the pixel ratio, then the shadow map, then holds the
     frames to 30 a second if the device can't keep up (and gives them
     back when it can). Paused while the tab is hidden.
   - A tube near the court that fails to strike now and then; the sound
     buzzes with it (tienda-audio.js). */

import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../engine/constants.js";
import { buildStore, buildTable, CEIL, storeRevisited } from "./tienda-store.js";
import { woodSet } from "./tienda.js";
import { quality } from "./tienda-quality.js";
import { createGovernor } from "../chassis/device-fit.js";
import { ensurePaper, ensureNewsprint } from "./tienda-textures.js";

const FONT_FACES = ["800 40px 'Libre Franklin'", "900 40px 'Libre Franklin'", "700 40px 'Libre Franklin'", "600 40px 'Libre Franklin'", "700 40px 'Courier Prime'", "400 40px 'Courier Prime'", "700 40px 'Bodoni Moda'", "italic 700 40px 'Libre Franklin'"];

export const TRY_IT_EVENT = "el-cabeza:tienda-try-it";

/* The store's opening view (user, with a screenshot of it: "When you first
   open the box, this should be the zoom level that you see. You want to be
   able to see the placard on the table"): the table, the board and its Try
   it! card, from the aisle, the shelves and the 2-for-$5 stack beyond;
   matched to the user's screenshot. Held while the lid's on; then the
   player looks round as they like ("they can look around for a little
   bit"), and once they've been still a while the camera "will very gently
   glide back over to the table where the placard is going to be glowing
   the neon blue" (table.setGlow). Before the first game only. The card's
   cue comes LOOK_MS after the box is opened, once they've been still for
   IDLE_MS (user: "The timer for when the table tent card cues the user
   back to the table should be reduced by 9 seconds": LOOK_MS was 10 s). */
export const OPENING_VIEW = { theta: Math.PI - 0.1, phi: 1.25, radius: 66, target: [2.2, -2.87, 0] };
const LOOK_MS = 1000, IDLE_MS = 6000, GLIDE_MS = 3200;
/* The slow pan (user: "When tienda opens on first / new game the store
   should be slowly panning from left to right 120°. When the extreme
   right end is reached, it will just do a soft bounce and start to pan
   back toward the left side. When the user takes control of the screen,
   it will stop moving. If they stop moving the screen voluntarily, then
   it will after about 10 seconds ... return back to panning left and
   right."): from the opening view the camera goes round the table, 60°
   either side of it (PAN_HALF), slowly (PAN_SPEED, rad/s: the 120° in
   about 40 s), rightward first; past either end it runs into a soft
   spring (PAN_K, a little damped) that turns it back the other way. It
   turns through the lid, too. A finger or the mouse down on the scene, a
   drag, a pinch, the wheel, a view button, or anything opened over the
   store (the dock's menu, the catalog, Try it!'s flyer): it stops where
   it is. PAN_IDLE_MS after the last of them, with nothing open, it glides
   back onto its arc (at the opening framing, the nearest point of the
   arc) and turns on from there; the card still glows its cue at IDLE_MS.
   Not with reduced motion (the old gentle return then), nor under the
   tests unless one asks (__EC_TEST_PAN__): it moves everything on the
   screen. */
const PAN_HALF = Math.PI / 3, PAN_SPEED = 0.052, PAN_K = 4.4, PAN_DAMP = 0.6, PAN_IDLE_MS = 10000;
let boxOpenedAt = 0, storeQuiet = false, storyStore = false, lidUp = false;
/* (tienda-overlay.js, each time it draws: this is the story's store (only
   there: the store page on its own keeps its own camera), the lid's up,
   nothing's open over the store; and when the lid comes off, and goes
   back on with the story started over.) */
export function storeState({ story, lid, quiet }) { storyStore = !!story; lidUp = !!lid; storeQuiet = !!quiet; }
export function boxOpened() { if (!boxOpenedAt) boxOpenedAt = performance.now(); }
export function boxClosed() { boxOpenedAt = 0; }

export function mountAmbientEffects(refs, { three, cam, windingDownRef, awaitingBeginRef, audio, glideTo }) {
  const q = quality();
  let store = null, table = null, brass = null;
  let attachedTo = null, dims = "";
  let tuned = false;
  let revisitUntil = 0;
  let fogBefore = null, farBefore = null;
  // The opening view and its gentle return (OPENING_VIEW above).
  let framed = false, played = false, cardTapped = false;
  let lastGoal = null, lastInput = 0, glideUntil = 0, glowK = 0, glowOn = false, glowAt = null, lastTick = 0;
  const OPEN = [OPENING_VIEW.theta, OPENING_VIEW.phi, OPENING_VIEW.radius, ...OPENING_VIEW.target];
  const goalOf = () => { const c = cam.current; return [c.theta, c.phi, c.radius, c.target.x, c.target.y, c.target.z]; };
  const turnOf = (d) => ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const near = (a, b, eps) => !!(a && b) && a.every((v, i) => Math.abs(i === 0 ? turnOf(v - b[i]) : v - b[i]) < eps);
  // (The opening framing but for which way round: the pan's.)
  const nearFrame = (a, eps) => !!a && a.every((v, i) => i === 0 || Math.abs(v - OPEN[i]) < eps);
  // The slow pan (PAN_* above): on, its turning speed (rad/s) and which way
  // it's headed; when it may start again (after its glide back); a finger
  // or the mouse down on the scene; when anything was last open over it.
  let panOn = true, panW = 0, panDir = 1, panFrom = 0, busyAt = 0;
  const pressed = new Set();
  const reduceMotion = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const panOk = () => typeof window !== "undefined" && !(reduceMotion && reduceMotion.matches) && !(window.__EC_TEST_HOOKS__ && !window.__EC_TEST_PAN__);
  function pan(now, dt) {
    if (!panOk() || now < panFrom || !dt) return;
    const c = cam.current, off = turnOf(c.theta - OPENING_VIEW.theta);
    let acc;
    if (Math.abs(off) > PAN_HALF) {
      // The soft bounce: a spring past the end, and back the other way.
      acc = -PAN_K * (off - Math.sign(off) * PAN_HALF) - PAN_DAMP * panW;
      panDir = off > 0 ? -1 : 1;
    } else acc = (panDir * PAN_SPEED - panW) * 1.5;
    panW += acc * dt;
    c.theta += panW * dt;
  }
  // Back onto its arc (the nearest point of it, at the opening framing),
  // gliding, and on from there; at an end, back the other way.
  function panBack(now) {
    const c = cam.current, off = turnOf(c.theta - OPENING_VIEW.theta);
    const to = Math.max(-PAN_HALF, Math.min(PAN_HALF, off));
    if (to >= PAN_HALF - 0.05) panDir = -1;
    else if (to <= -PAN_HALF + 0.05) panDir = 1;
    // (Round from where it is, never a whole turn the long way; already
    // there, it simply goes on.)
    const view = { ...OPENING_VIEW, theta: c.theta - off + to };
    const there = Math.abs(off - to) < 0.01 && nearFrame(goalOf(), 0.02);
    if (!there && glideTo) glideTo(view, GLIDE_MS); else if (!there) frameOpening(view.theta);
    panOn = true; panW = 0; panFrom = now + (!there && glideTo ? GLIDE_MS : 0);
  }
  // (Test-only: put the pan this far round from the opening view, rad.)
  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__TIENDA_PAN_AT__ = (off) => {
    const c = cam && cam.current;
    if (!c) return;
    c.theta = OPENING_VIEW.theta + off;
    if (c.view) c.view.theta = c.theta;
    lastGoal = goalOf();
  };
  // (Window, capture: ahead of the chassis's own.)
  const onPress = (e) => { const t = three.current; if (t && t.renderer && e.target === t.renderer.domElement) { pressed.add(e.pointerId); lastInput = performance.now(); } };
  const onLift = (e) => { if (pressed.delete(e.pointerId)) lastInput = performance.now(); };
  const onWheel = (e) => { const t = three.current; if (t && t.renderer && e.target === t.renderer.domElement) lastInput = performance.now(); };
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("pointerup", onLift, true);
    window.addEventListener("pointercancel", onLift, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
  }
  function frameOpening(theta = OPENING_VIEW.theta) {
    const c = cam.current;
    c.theta = theta; c.phi = OPENING_VIEW.phi; c.radius = OPENING_VIEW.radius;
    c.target.set(OPENING_VIEW.target[0], OPENING_VIEW.target[1], OPENING_VIEW.target[2]);
    c.dollhouse = false;
    // (Placed: the chassis's pre-game fit leaves it be.)
    c.placed = true;
    if (c.view) { c.view.theta = c.theta; c.view.phi = c.phi; c.view.radius = c.radius; c.view.target.copy(c.target); }
  }
  function openingView(now) {
    const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
    lastTick = now;
    const first = storyStore && !!(table && table.tent && table.tent.length) && !storeRevisited() && !played;
    const waiting = !!(awaitingBeginRef && awaitingBeginRef.current);
    if (first && !waiting && framed) played = true;
    if (first && waiting && cam && cam.current) {
      if (!framed) { frameOpening(); framed = true; lastGoal = goalOf(); lastInput = now; }
      else {
        const g = goalOf();
        // The player moved it (a drag, a pinch, the wheel, a view button),
        // or has a finger on it.
        const moved = !near(g, lastGoal, 1e-5);
        if (moved || pressed.size) lastInput = now;
        if (lidUp) {
          // Held while the lid's on (a refit, a resize), turning.
          if (!nearFrame(g, 1e-4)) frameOpening(g[0]);
          pan(now, dt);
        } else if (boxOpenedAt) {
          const quiet = storeQuiet && !document.querySelector(".td-tryit, .td-special-note");
          if (!quiet) busyAt = now;
          if (panOk()) {
            if (panOn && (moved || pressed.size || !quiet)) { panOn = false; panW = 0; }
            else if (!panOn && quiet && now - Math.max(lastInput, busyAt) > PAN_IDLE_MS) panBack(now);
            if (panOn) pan(now, dt);
          }
          if (quiet && !cardTapped && now - boxOpenedAt > LOOK_MS && now - lastInput > IDLE_MS) {
            // (Without the pan, it glides back to the table itself.)
            if (!panOk() && !near(g, OPEN, 0.02) && now > glideUntil && glideTo) { glideTo(OPENING_VIEW, GLIDE_MS); glideUntil = now + GLIDE_MS; }
            if (!glowOn) glowAt = now - boxOpenedAt;
            glowOn = true;
          }
        }
        lastGoal = goalOf();
      }
    }
    // The card's glow: in over half a second, the nudges' slow pulse.
    const want = glowOn && !cardTapped && !played && waiting ? 1 : 0;
    glowK += (want - glowK) * Math.min(1, dt / 0.5);
    if (Math.abs(want - glowK) < 0.002) glowK = want;
    if (table && table.setGlow) table.setGlow(glowK, 0.5 + 0.5 * Math.sin((now / 2400) * Math.PI * 2));
    // (glowAt: how long after the box was opened the card's cue came, ms;
    // still: how long the camera had been still then.)
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__TIENDA_OPENING__ = { framed, glow: glowK, opened: !!boxOpenedAt, played, cardTapped, glowAt: glowAt === null ? null : Math.round(glowAt), still: Math.round(now - lastInput) };
      // (The pan: on, turning, which way, how far round from the opening
      // view (rad), and how long it's been still.)
      const c = cam && cam.current;
      window.__TIENDA_PAN__ = { ok: panOk(), on: panOn && first && waiting, w: +panW.toFixed(4), dir: panDir, off: c ? +turnOf(c.theta - OPENING_VIEW.theta).toFixed(4) : null, still: Math.round(now - Math.max(lastInput, busyAt)), gliding: now < panFrom };
    }
  }
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
  function tune(t) {
    if (tuned || !t.renderer) return;
    tuned = true;
    t.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dprCap));
    const size = t.getMountSize && t.getMountSize();
    if (size) t.renderer.setSize(size.w, size.h);
    const key = t.lights && t.lights.key;
    if (key && key.shadow && key.shadow.mapSize.x !== q.shadowMap) {
      key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    }
    t.governor = createGovernor(t.renderer, () => t.getMountSize && t.getMountSize(), q, {
      key: "tienda",
      light: () => t.lights && t.lights.key,
      onChange: ({ pixelRatio }) => { if (typeof window !== "undefined") window.__TIENDA_PIXEL_RATIO__ = pixelRatio; },
    });
    if (typeof window !== "undefined") { window.__TIENDA_PIXEL_RATIO__ = t.renderer.getPixelRatio(); window.__TIENDA_QUALITY__ = q.tier; }
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
      woodSet.followGrain(t); // the grain turns with the rolls (wood-set.js)
      /* Back after the whole story, El Cabeza is nowhere to be seen: the
         board, its pieces, their markers and the brass all go; only the
         store and the table (with its appliances) stay. Every frame, so
         anything the chassis adds to the board later goes too. */
      if (storeRevisited()) t.boardGroup.children.forEach((o) => { o.visible = o === store.group || (table && o === table.group); });
      openingView(now);
      // (Held through the first moments: the opening framing, fitted to
      // the board, runs after the store is up and would pull it back in.
      // After that the player zooms as they like.)
      if (now < revisitUntil && cam && cam.current) {
        if (cam.current.radius < 62) cam.current.radius = 62;
        if (cam.current.phi > 0.95) cam.current.phi = 0.95;
      }
      store.animate(now, { camera: t.camera, onFlicker: (ms) => { if (audio && audio.playTubeFlicker && !(windingDownRef && windingDownRef.current)) audio.playTubeFlicker(ms); } });
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
    /* The "Try it!" card on the table takes a tap (user): the store's own
       word on it, then the menu, Try a Game lit (tienda-overlay.js, on
       TRY_IT_EVENT). */
    pickScene(raycaster) {
      if (!table || !table.tent || !table.tent.length || !table.tent[0].visible) return null;
      return raycaster.intersectObjects(table.tent, false)[0] ? "tryIt" : null;
    },
    sceneTap(what) {
      if (what !== "tryIt") return false;
      cardTapped = true;
      try { window.dispatchEvent(new CustomEvent(TRY_IT_EVENT)); } catch (e) { /* no events */ }
      return true;
    },
    dispose() {
      const t = three.current;
      if (typeof window !== "undefined") {
        window.removeEventListener("pointerdown", onPress, true);
        window.removeEventListener("pointerup", onLift, true);
        window.removeEventListener("pointercancel", onLift, true);
        window.removeEventListener("wheel", onWheel, { capture: true });
      }
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
