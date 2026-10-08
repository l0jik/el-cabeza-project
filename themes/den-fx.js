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
     off as the camera goes back to the board. The first time (the
     commercial's), home first: the set dark, the camera on the board, a
     thought; then the set switches itself on and the commercial locks
     in. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SLAB_MAX } from "../engine/constants.js";
import { buildDen, HALL, FLOOR, RZ } from "./den-room.js";
import { dealCard } from "./den-cards.js";
import { quality } from "./tienda-quality.js";
import { setCommercialOn, onJourneyChange } from "../engine/journey.js";
import { createDenCall } from "./den-call.js";
import { createTrip } from "./den-trip.js";
import { createHall } from "./den-hall.js";
import { createEnding, prewarmFigure, prefetchVoidMusic } from "./den-ending.js";
import { WORLDS } from "./realities.js";

const LID_FONTS = ["700 40px 'Bodoni Moda'", "500 40px 'Bodoni Moda'", "700 40px 'Libre Franklin'", "700 40px 'Courier Prime'"];

export function createDenEffects(woodSet, { viewPitch = null } = {}) {
  return function mountAmbientEffects(refs, { three, cam, audio, awaitingBeginRef, music = null, tv: novaTv = null, moves = null, over = null, beginGame = null, sheets = null }) {
    const q = quality();
    // Home with the special order (Nova): the thought, then the telephone
    // call from Big Glutts (den-call.js).
    /* ...and after it, the trip back to the store for the free pieces and
       home again (den-trip.js), ending in the Room view (as its button:
       standard.js freeCamera.dollhouse). */
    const roomView = () => {
      const btn = typeof document !== "undefined" && (document.querySelector('[data-testid="room-view-corner"]') || document.querySelector('[data-testid="room-view"]'));
      if (btn) { btn.click(); return; }
      if (!cam || !cam.current) return;
      cam.current.dollhouse = true; cam.current.phi = 0.78; cam.current.radius = 118;
      if (cam.current.target) cam.current.target.set(0, 0, 0);
      if (cam.current.view && cam.current.view.target) cam.current.view.target.set(0, 0, 0);
    };
    /* Back on the board when the set lets the camera go (after the
       commercial, or any watch of the set; user: always the coffee table
       with the game on it, not too close, not too far): square on to the
       nearest side, the board's own pitch and distance (Current Player
       View's, chassis boardView), its centre, out of the Room view. Set
       while the set still has the camera, so it's eased to unseen and
       the set lets go straight onto it. */
    function onTheBoard() {
      if (!cam || !cam.current) return;
      const c = cam.current, t = three.current, q = Math.PI / 2;
      const bv = t && t.boardView ? t.boardView() : null;
      c.theta = Math.round(c.theta / q) * q;
      c.phi = bv ? bv.phi : viewPitch != null ? viewPitch : c.phi;
      if (bv && bv.radius) c.radius = bv.radius;
      if (c.target) c.target.set(0, 0, 0);
      c.dollhouse = false;
      c.placed = true; // (the chassis's setup fit leaves it here)
      if (c.view) {
        c.view.theta = c.theta; c.view.phi = c.phi; c.view.radius = c.radius;
        if (c.view.target) c.view.target.set(0, 0, 0);
      }
    }
    /* The trip's leaving (user: it hovered close on the board too long):
       from the card going, the camera draws back and up toward the Room
       view while the picture fades, as far as it gets before the black.
       Into the Room view proper (the roof off) as it passes the room's
       walls, so it doesn't stop at them. */
    let pull = null;
    const PULL_MS = 6200;
    function tripPull(t, now) {
      if (!trip || !cam || !cam.current || trip.state().stage !== "leaving") { pull = null; return; }
      const c = cam.current;
      if (!pull) pull = { t0: now, r: c.radius, phi: c.phi, tgt: c.target.clone() };
      const x = Math.min(1, (now - pull.t0) / PULL_MS), k = x * x * (3 - 2 * x);
      c.radius = pull.r + (118 - pull.r) * k;
      c.phi = pull.phi + (0.78 - pull.phi) * k;
      c.target.copy(pull.tgt).multiplyScalar(1 - k);
      if (!c.dollhouse && c.view && t.cameraDistance) {
        const v = c.view, wall = t.cameraDistance(v.theta, v.phi, 1e6, v.target, false);
        if (v.radius >= wall - 0.05) c.dollhouse = true;
      }
    }
    // (Home from the trip, the hall's due: den-hall.js, below.)
    /* Home from the trip (user): a card, one of the user's ten lines at
       random (not the one shown last time), and a tap puts it away; the
       game's then yours, and the hall (den-hall.js) counts its moves only
       from there. */
    const HOME_LINES = [
      "Okay. I think I've had enough for one day. I'm just going to sit here and play my game.",
      "No more stores. No more phone calls. Just me, the fire, and El Cabeza.",
      "That was… weird. Whatever. I'm not leaving this room again tonight. Let's play.",
      "I don't know what happened over there, and I don't want to know. Game time.",
      "Enough adventure for one day. Feet up, game on.",
      "Big Glutts can stay closed. I've got everything I need right here.",
      "Deep breath. Nothing strange is going to happen in my own den. Let's just play.",
      "Some days you go looking for answers. Today I'm going looking for a win.",
      "Note to self: never answer the phone again. Now, where was I?",
      "Peace and quiet, a warm fire, and a game nobody else has ever heard of. Perfect.",
    ];
    const HOME_LINE_KEY = "el-cabeza:home-line";
    function homeCard(onDone) {
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc) { onDone(); return; }
      let last = -1;
      try { last = Number(localStorage.getItem(HOME_LINE_KEY)); } catch (e) { /* none */ }
      let i = Math.floor(Math.random() * HOME_LINES.length);
      if (i === last) i = (i + 1 + Math.floor(Math.random() * (HOME_LINES.length - 1))) % HOME_LINES.length;
      try { localStorage.setItem(HOME_LINE_KEY, String(i)); } catch (e) { /* this time only */ }
      /* One of the den's cards (den-cards.js), askance in the upper right
         and movable; a tap on it, or the first tap anywhere else (which
         goes on to do what it was for), puts it away. */
      /* Held for 3.8 s first (user: a play-tester tapping wildly put it
         away unread): till then no tap puts it away, taps elsewhere go
         nowhere, and "Tap to play" shows only once it's free (a drag
         still moves it). */
      const HOLD_MS = 3800;
      let done = false, held = true, c = null, holdTimer = 0;
      const swallow = (e) => { if (held && !(e.target instanceof Element && c.el.contains(e.target))) { e.stopPropagation(); e.preventDefault(); } };
      const unhook = () => {
        clearTimeout(holdTimer);
        doc.removeEventListener("pointerdown", elsewhere, true);
        for (const t of ["click", "mousedown", "touchstart"]) doc.removeEventListener(t, swallow, true);
      };
      const close = () => {
        if (done || held) return;
        done = true;
        unhook();
        c.remove(550);
        onDone();
      };
      const elsewhere = (e) => {
        if (e.target instanceof Element && c.el.contains(e.target)) return;
        if (held) swallow(e); else close();
      };
      c = dealCard(doc, { testid: "den-home-card", l1: HOME_LINES[i], hint: "Tap to play", role: "dialog", label: "Home again", onTap: close });
      c.el.setAttribute("data-line", String(i));
      c.el.classList.add("held");
      holdTimer = setTimeout(() => { held = false; c.el.classList.remove("held"); }, HOLD_MS);
      homeCardDrop = () => { done = true; unhook(); c.el.remove(); };
      doc.addEventListener("pointerdown", elsewhere, true);
      for (const t of ["click", "mousedown", "touchstart"]) doc.addEventListener(t, swallow, { capture: true, passive: false });
    }
    let homeCardTimer = 0, homeCardDrop = null;
    /* Then settle in (user): "we want them to start playing a game
       immediately". The light-bulb (focus) corner button glows and
       breathes, and it's the only thing that takes a tap (user: like the
       special-order note; a stray tap makes it throb). Its tap dims the
       room into focus and, with no game under way, the game begins with
       the settings as they are; a game already going carries on. The
       hall's moves count from there. (Nova's story only: the trip is.) */
    let settleDrop = null;
    /* After the commercial (Nova's story; user): the paper beside the
       board, the rules leaflet, is Big Glutts' special-order form now,
       glowing and throbbing in the Singularity's blue, and the only thing
       that takes a tap. Its tap brings the special-order note (tienda-
       overlay.js, which turns this on with html.ec-order-paper and hears
       ORDER_PAPER_TAKEN). A stray tap makes it throb harder. The paper
       stays an order form while the den's up (back from the store, the
       leaflet's itself again). */
    const ORDER_PAPER_TAKEN = "el-cabeza:order-paper-taken";
    let paper = null, paperTaken = false, paperRay = null;
    const paperV = new THREE.Vector3();
    function paperStyle(doc) {
      if (doc.getElementById("ec-order-paper-style")) return;
      const st = doc.createElement("style");
      st.id = "ec-order-paper-style";
      st.textContent = `
        .ec-order-halo { position: fixed; z-index: 1240; pointer-events: none; border-radius: 50%; transform: translate(-50%, -50%);
          border: 3px solid rgba(102, 217, 255, 0.95); background: radial-gradient(ellipse at center, rgba(102, 217, 255, 0.16), rgba(102, 217, 255, 0.04) 70%, transparent);
          box-shadow: 0 0 24px 8px rgba(102, 217, 255, 0.6), inset 0 0 18px 6px rgba(102, 217, 255, 0.4);
          animation: ecOrderHalo 1.6s ease-in-out infinite; }
        @keyframes ecOrderHalo { 0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); } }
        .ec-order-halo.throb { animation: ecOrderThrob 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both, ecOrderHalo 1.6s ease-in-out 0.9s infinite; }
        @keyframes ecOrderThrob { 0% { transform: translate(-50%, -50%) scale(1); } 28% { transform: translate(-50%, -50%) scale(1.45); box-shadow: 0 0 34px 14px rgba(102, 217, 255, 0.85); } 100% { transform: translate(-50%, -50%) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .ec-order-halo, .ec-order-halo.throb { animation: none; opacity: 1; } }`;
      doc.head.appendChild(st);
    }
    function paperStart() {
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc || paper || paperTaken || !den) return;
      paperStyle(doc);
      den.table.rules.orderForm(true, 0.5);
      const halo = doc.createElement("div");
      halo.className = "ec-order-halo";
      halo.setAttribute("data-testid", "den-order-paper");
      halo.setAttribute("aria-hidden", "true");
      doc.body.appendChild(halo);
      let swallow = false, endT = 0;
      const onPaper = (e) => {
        if (e.clientX == null) return false;
        const r = halo.getBoundingClientRect();
        if (r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
        const t = three.current;
        if (!t || !t.camera || !t.renderer) return false;
        const c = t.renderer.domElement.getBoundingClientRect();
        if (!paperRay) paperRay = new THREE.Raycaster();
        paperRay.setFromCamera({ x: ((e.clientX - c.left) / c.width) * 2 - 1, y: -((e.clientY - c.top) / c.height) * 2 + 1 }, t.camera);
        return paperRay.intersectObject(den.table.rules.leaflet, false).length > 0;
      };
      const throb = () => requestAnimationFrame(() => { halo.classList.remove("throb"); void halo.offsetWidth; halo.classList.add("throb"); });
      const onFull = (e) => !!(e.target instanceof Element && e.target.closest("[data-fullscreen-toggle]"));
      const EVENTS = ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "touchstart", "touchmove", "touchend", "wheel", "mousedown", "mouseup", "gesturestart"];
      const block = (e) => {
        if (onFull(e)) return;
        e.stopImmediatePropagation(); e.stopPropagation();
        if (e.cancelable && e.type !== "pointermove") e.preventDefault();
        // The paper's tap is held to its end, and a beat past it: on a
        // phone the browser sends the tap's mouse events (click and all)
        // a moment after touchend, and once let through they reached the
        // board as a tap on the leaflet and opened the rules over the note
        // (user, on a phone: the rules came up, the order note flashing
        // behind them).
        if (swallow) { if (e.type === "click" || e.type === "pointerup" || e.type === "touchend" || e.type === "mouseup") { clearTimeout(endT); endT = setTimeout(stop, 450); } return; }
        const down = e.type === "pointerdown" || (e.type === "touchstart" && !window.PointerEvent);
        if (!down) return;
        const pt = e.touches && e.touches[0] ? e.touches[0] : e;
        if (onPaper(pt)) {
          swallow = true; paperTaken = true;
          window.dispatchEvent(new CustomEvent(ORDER_PAPER_TAKEN));
          setTimeout(stop, 1500); // (in case the tap's end never comes)
        } else throb();
      };
      const blockKey = (e) => { if (e.key === "Tab") return; e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
      function stop() {
        if (!paper) return;
        EVENTS.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));
        window.removeEventListener("keydown", blockKey, true);
        halo.remove();
        den.table.rules.orderForm(true, 0);
        if (paper.back && cam && cam.current && cam.current.target) { cam.current.target.copy(paper.back.target); cam.current.radius = paper.back.radius; }
        paper = null;
      }
      EVENTS.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
      window.addEventListener("keydown", blockKey, true);
      rulesHover = false;
      // The camera eases over so the paper's in view beside the board (on
      // a phone it lay off the screen's edge): its aim moves partway
      // toward the paper, and it draws back (paperFrame) until the paper's
      // on screen; it goes back to the board once the paper's taken.
      let back = null;
      if (cam && cam.current && cam.current.target) {
        const c = cam.current, lp = den.table.rules.leaflet.getWorldPosition(new THREE.Vector3());
        back = { target: c.target.clone(), radius: c.radius };
        c.target.set(lp.x * 0.5, 0, lp.z * 0.5);
      }
      paper = { halo, stop, t0: performance.now(), back, aim: 0.5, lp: back ? den.table.rules.leaflet.getWorldPosition(new THREE.Vector3()) : null };
    }
    // Each frame: on (html.ec-order-paper) it starts; the halo follows the
    // paper on screen and the paper's own glow breathes with it.
    function paperFrame(t, now) {
      const want = typeof document !== "undefined" && document.documentElement.classList.contains("ec-order-paper");
      // (Once the set's let go of the camera: the board's view, the paper in it.)
      if (want && !paper && !paperTaken && !holdsCamera()) paperStart();
      if (!want && paper) paper.stop();
      if (!paper || !t.camera || !t.renderer) return;
      const lf = den.table.rules.leaflet, c = t.renderer.domElement.getBoundingClientRect();
      lf.updateWorldMatrix(true, false);
      const pos = lf.geometry.attributes.position;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
      for (let i = 0; i < pos.count; i++) {
        paperV.fromBufferAttribute(pos, i).applyMatrix4(lf.matrixWorld).project(t.camera);
        if (paperV.z > 1) behind = true;
        const sx = c.left + ((paperV.x + 1) / 2) * c.width, sy = c.top + ((1 - paperV.y) / 2) * c.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      // (Not all of it on screen yet: the camera draws back a little more.)
      const w = Math.max(56, (x1 - x0) * 1.35), hgt = Math.max(44, (y1 - y0) * 1.6);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, vw = window.innerWidth, vh = window.innerHeight, m = 10;
      // On a narrow phone, drawing back alone left the paper hanging off
      // the side (user: "pull the camera back so the order paper fits on
      // screen"): it also turns further toward the paper, and may draw
      // back further.
      const off = cx - w / 2 < m || cx + w / 2 > vw - m || cy - hgt / 2 < m || cy + hgt / 2 > vh - m || behind;
      if (paper.back && cam && cam.current && off) {
        if (cam.current.radius < paper.back.radius * 2.6) cam.current.radius *= 1.012;
        if (paper.lp && paper.aim < 0.85) {
          paper.aim = Math.min(0.85, paper.aim + 0.006);
          cam.current.target.set(paper.lp.x * paper.aim, 0, paper.lp.z * paper.aim);
        }
      }
      const st = paper.halo.style;
      st.left = `${cx}px`; st.top = `${cy}px`; st.width = `${w}px`; st.height = `${hgt}px`;
      st.display = behind ? "none" : "";
      den.table.rules.orderForm(true, 0.45 + 0.6 * (0.5 + 0.5 * Math.sin((now - paper.t0) / 260)));
    }
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_ORDER_PAPER__ = () => {
      if (!paper) return { on: false, taken: paperTaken };
      const r = paper.halo.getBoundingClientRect();
      return { on: true, taken: paperTaken, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    };
    function settleIn(onDone) {
      const doc = typeof document !== "undefined" ? document : null;
      const bulb = () => doc && doc.querySelector('[data-testid="focus-corner"]');
      if (!doc || !bulb()) { onDone(); return; }
      if (!doc.getElementById("ec-settle-style")) {
        const st = doc.createElement("style");
        st.id = "ec-settle-style";
        st.textContent = `
          html.ec-settle [data-testid="focus-corner"] { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;
            border-radius: 50% !important; color: #FFE9B8 !important; background: rgba(255, 196, 110, 0.28) !important;
            animation: ecSettleGlow 2.2s ease-in-out infinite; }
          @keyframes ecSettleGlow {
            0%, 100% { box-shadow: 0 0 0 3px rgba(255, 216, 150, 0.9), 0 0 18px 6px rgba(255, 168, 70, 0.55); }
            50% { box-shadow: 0 0 0 5px rgba(255, 224, 165, 1), 0 0 38px 16px rgba(255, 168, 70, 0.8); } }
          html.ec-settle [data-testid="focus-corner"].ec-settle-throb { animation: ecSettleThrob 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both, ecSettleGlow 2.2s ease-in-out 0.9s infinite; }
          @keyframes ecSettleThrob { 0% { transform: scale(1); } 28% { transform: scale(1.5); } 100% { transform: scale(1); } }
          @media (prefers-reduced-motion: reduce) { html.ec-settle [data-testid="focus-corner"], html.ec-settle [data-testid="focus-corner"].ec-settle-throb {
            animation: none; box-shadow: 0 0 0 4px rgba(255, 216, 150, 0.95), 0 0 26px 10px rgba(255, 168, 70, 0.7); } }`;
        doc.head.appendChild(st);
      }
      doc.documentElement.classList.add("ec-settle");
      const onBulb = (e) => !!(e.target instanceof Element && e.target.closest('[data-testid="focus-corner"], [data-fullscreen-toggle]'));
      const throb = () => requestAnimationFrame(() => { const b = bulb(); if (!b) return; b.classList.remove("ec-settle-throb"); void b.offsetWidth; b.classList.add("ec-settle-throb"); });
      const EVENTS = ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "touchstart", "touchmove", "touchend", "wheel", "mousedown", "mouseup", "gesturestart"];
      const block = (e) => {
        if (onBulb(e)) return;
        e.stopImmediatePropagation(); e.stopPropagation();
        if (e.cancelable && e.type !== "pointermove") e.preventDefault();
        if (e.type === "pointerdown" || (e.type === "touchstart" && !window.PointerEvent)) throb();
      };
      const blockKey = (e) => { if (e.key === "Tab") return; e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        EVENTS.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));
        window.removeEventListener("keydown", blockKey, true);
        doc.removeEventListener("click", onClick, true);
        doc.documentElement.classList.remove("ec-settle");
        const b = bulb(); if (b) b.classList.remove("ec-settle-throb");
        settleDrop = null;
      };
      // The bulb's own click goes through to it (focus on); if focus is
      // already on, that click is kept from turning it off again.
      const onClick = (e) => {
        if (!(e.target instanceof Element) || !e.target.closest('[data-testid="focus-corner"]')) return;
        const b = bulb();
        if (b && b.getAttribute("data-on") === "true") { e.stopImmediatePropagation(); e.stopPropagation(); }
        finish();
        // (A moment for the room to start dimming, then the game.)
        setTimeout(() => { if (beginGame) beginGame(); onDone(); }, 450);
      };
      EVENTS.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
      window.addEventListener("keydown", blockKey, true);
      doc.addEventListener("click", onClick, true);
      settleDrop = () => { finish(); };
    }
    const trip = novaTv ? createTrip({ audio, onReturn: () => {
      roomView();
      // (Not on a look at the scene alone: nothing's kept.)
      if (novaTv.hall && !preview) novaTv.hall.arm();
      // (Once the den's faded up from the black.)
      homeCardTimer = setTimeout(() => homeCard(() => settleIn(() => { if (hall) hall.arm(movesNow()); })), 3800);
    } }) : null;
    if (trip && novaTv.call) trip.load(); // (its pictures, well ahead of time)
    const call = novaTv && novaTv.call ? createDenCall({ audio, awaitingBegin: () => !!(awaitingBeginRef && awaitingBeginRef.current), onTrip: () => trip && trip.start(), onGoToPhone: () => phoneVisit(true), onPhoneDone: () => phoneVisit(false) }) : null;
    /* The end of the story (Nova). Home from the closed Big Glutts, four
       moves into the game the hall starts up (den-hall.js); investigated,
       it ends in the void (den-ending.js) and the other realities. After
       that (postStory) the set's knob glows and clicks through them, a
       picture of each on its screen. */
    let postStory = !!(novaTv && novaTv.ended && novaTv.ended());
    const movesNow = () => (moves ? moves() : 0);
    let ending = null, figWarm = false;
    /* A look at one scene without the story (Nova's ?scene=, read once):
       "revelation", straight into the void; "glutts", the trip back to
       the closed Big Glutts from the black just before the car pulls in;
       "hall", the hallway lighting up (its count kept in memory only, and
       after "keep playing" back in a few seconds, not a few moves, so the
       second time's words and the third's pull can be seen too); "lure",
       home before the Singularity, the set stirring a few seconds after
       the tap instead of 25 s (Nova keeps that visit in memory only);
       "commercial", the set on with the user's spot, as home from the
       Singularity the first time (no lure, no record on). A tap first
       (the sound needs one). Nothing's kept: the story stays where it
       was, and no hall otherwise. */
    const preview = (novaTv && novaTv.preview && novaTv.preview()) || null;
    const hallPreview = preview === "hall";
    const previewFlares = (() => { let n = 0; return { get: () => n, set: (v) => { n = v; } }; })();
    const hall = novaTv && (hallPreview || (novaTv.hall && !postStory && !preview))
      ? createHall({ audio, onEnding: (h) => startEnding(h), flares: hallPreview ? previewFlares : novaTv.hall.flares || null }) : null;
    let hallAgainAt = 0;
    if (hall && !hallPreview && novaTv.hall.due()) hall.arm(movesNow());
    function startEnding(h) {
      ending = createEnding({
        audio,
        onFinish: () => { if (preview) return; postStory = true; if (novaTv.ending) novaTv.ending.finish(); },
        // (Another place: Nova's cut takes over from the void.)
        onPick: (w) => { if (novaTv.ending) novaTv.ending.go(w); },
        onStay: () => { ending = null; if (hall) hall.finish(); roomView(); },
      });
      ending.start();
      if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => h && h.clear && h.clear());
    }
    let previewEl = null;
    if (preview && typeof document !== "undefined") {
      const d = document;
      previewEl = d.createElement("button");
      previewEl.type = "button";
      previewEl.setAttribute("data-testid", `den-${preview}-preview`);
      if (preview === "glutts" && trip) trip.load();
      previewEl.style.cssText = "position:fixed;inset:0;z-index:3000;border:0;margin:0;background:#000;color:#cfd6e6;cursor:pointer;" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:400 clamp(20px,5vw,30px)/1.3 Georgia,serif;letter-spacing:0.04em;-webkit-tap-highlight-color:transparent;";
      previewEl.innerHTML = '<span>' + ({ glutts: "Back to Big Glutts", hall: "The hallway", lure: "The television", commercial: "The commercial" }[preview] || "The revelation") + '</span><small style="font:600 12px/1 Arial,sans-serif;letter-spacing:0.22em;text-transform:uppercase;opacity:0.55">Tap to begin</small>';
      // (Its taps stay its own.)
      ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "wheel"].forEach((t) => previewEl.addEventListener(t, (e) => e.stopPropagation()));
      previewEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (audio && audio.ensureStarted) { try { audio.ensureStarted(); } catch (err) { /* no sound */ } }
        const fs = d.documentElement.requestFullscreen;
        if (fs && !d.fullscreenElement && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) { try { fs.call(d.documentElement).catch(() => {}); } catch (err) { /* stays as it is */ } }
        previewEl.remove(); previewEl = null;
        if (preview === "glutts") { if (trip) trip.start({ from: 8300 }); }
        else if (hallPreview) { if (hall) hall.now(movesNow()); }
        else if (preview === "lure") lureStart = performance.now() - LURE_WAIT + 3000;
        else if (preview === "commercial") { returning = true; commercialNext = true; }
        else startEnding(null);
      });
      d.body.appendChild(previewEl);
    }
    /* Home before the Singularity (Nova, the set still to lure you): a
       record or a tape already on, a random one, at 40% (user: normal
       music to hear before the set starts getting at it, low in the mix
       but heard; 40%, user), once the scene change has faded up. Through the
       stereo's own player (the chassis's `music`), so the chip and the
       turntable or the 8-track show it. Not if something's already on. */
    let autoMusic = !!(music && novaTv && novaTv.lure && novaTv.lure() && !novaTv.returning && preview !== "commercial"), autoMusicAt = 0;
    // (And the room's own sounds, the fire, the clock, the rain, at 87% on
    // that visit, user; otherwise as ever.)
    if (audio && audio.setRoomTrim) audio.setRoomTrim(autoMusic ? 0.87 : 1);
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
    let boardCaster = null, tableBlur = null, tableLocal = null, tableMaskKey = "";
    const FOG = { color: new THREE.Color(0x1c130c), bg: new THREE.Color(0x140d08), near: 150, far: 420 };
    const DARK = new THREE.Color(0x070403);
    // How much of the first darkening focus keeps: 60% (user: 40% less),
    // on the fog, the table and (standard.js) the veil alike.
    const FOCUS_DARK = 0.72; // (was 0.6; user: the room a little darker, the blur mostly gone)
    const FOCUS_LIFT = 0.975; // how far the room drops under the board (75% of the first 1.3, user)
    const corner = new THREE.Vector3();
    const blurOk = q.physical && typeof CSS !== "undefined" && CSS.supports && (CSS.supports("backdrop-filter", "blur(2px)") || CSS.supports("-webkit-backdrop-filter", "blur(2px)"));
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_FOCUS__ = () => ({ on: focusOn, w: fw, lift: den ? -den.group.position.y : 0, fogNear: three.current && three.current.scene && three.current.scene.fog ? three.current.scene.fog.near : null });
    function focusFrame(t, now) {
      const dt = lastFocusTick ? Math.min(0.1, (now - lastFocusTick) / 1000) : 0;
      lastFocusTick = now;
      const goal = focusOn && focusGoal === 0 && tvGoal === 0 && bookGoal === 0 && phoneGoal === 0 ? 1 : 0;
      fw += (goal - fw) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(goal - fw) < 0.002) fw = goal;
      const e = fw * fw * (3 - 2 * fw);
      const scene = t.scene;
      if (scene && scene.fog && scene.fog.isFog) {
        const camDist = camLocal.length();
        const reach = SLAB_MAX * 0.8;
        const d = e * FOCUS_DARK;
        scene.fog.near = FOG.near + (camDist + reach - FOG.near) * d;
        scene.fog.far = FOG.far + (camDist + reach + 46 - FOG.far) * d;
        scene.fog.color.copy(FOG.color).lerp(DARK, d);
        if (scene.background && scene.background.isColor) scene.background.copy(FOG.bg).lerp(DARK, d);
      }
      // The fire's flames (unfogged, drawn additively) go out with the room.
      if (!flames) { flames = []; den.groups.wallN.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial && o.material.blending === THREE.AdditiveBlending) flames.push({ o, v: o.visible }); }); }
      flames.forEach((f) => { f.o.visible = f.v && e < 0.45; });
      // The table and what's on it (too near for the fog) go down into the
      // dark with the room; the board, lit as ever, stays.
      if (e !== lastE) {
        lastE = e;
        if (!tableMats) { tableMats = new Map(); den.table.group.traverse((o) => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.color && !tableMats.has(m)) tableMats.set(m, m.color.clone()); }); }); }
        tableMats.forEach((base, m) => m.color.copy(base).multiplyScalar(1 - 0.58 * e)); // the coffee table at 42% (user: a little darker)
      }
      // The board's own shadow: the slab doesn't cast one, so with the board
      // off the table the pieces' shadows went straight through it onto
      // the table (user: "as if the board is transparent"). An unseen
      // block just under the board's face casts the whole board's shadow
      // instead, and so stops the pieces' (their shadows still fall on the
      // board's face, above it).
      boardShadow(t);
      // The float: the room (and the table) a little way down under the
      // board, and a slow drift.
      den.group.position.y = -(FOCUS_LIFT + Math.sin(now * 0.0011) * 0.12) * e;
      // The veil: the board's outline on screen stays clear.
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
      const boardPts = [];
      for (const [sx, sy, sz] of [[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1], [-1, 2.2, -1], [1, 2.2, -1], [-1, 2.2, 1], [1, 2.2, 1]]) {
        corner.set((sx * SLAB_X) / 2, sy, (sz * SLAB_Z) / 2);
        t.boardGroup.localToWorld(corner).project(t.camera);
        const px = ((corner.x + 1) / 2) * r.width, py = ((1 - corner.y) / 2) * r.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        boardPts.push([px, py]);
      }
      // The clear part: the board's whole outline on screen and a little
      // margin (an ellipse let the board's corners into the dark, user),
      // then a soft falloff into the veil (standard.js .den-focus-veil).
      const w = x1 - x0, hgt = y1 - y0, pad = Math.max(10, Math.max(w, hgt) * 0.05), soft = Math.max(50, Math.max(w, hgt) * 0.3);
      const set = (k, v) => veil.style.setProperty(k, `${v.toFixed(1)}px`);
      set("--ix0", x0 - pad); set("--ix1", x1 + pad); set("--ox0", x0 - pad - soft); set("--ox1", x1 + pad + soft);
      set("--iy0", y0 - pad); set("--iy1", y1 + pad); set("--oy0", y0 - pad - soft); set("--oy1", y1 + pad + soft);
      if (blurOk) tableBlurFrame(t, r, e, boardPts);
    }

    function hull(pts) {
      const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    }
    function grow(poly, by) {
      const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
      return poly.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [x + (dx / d) * by, y + (dy / d) * by]; });
    }
    /* The coffee table blurred more than the room (user: "blur the coffee
       table more. Anything underneath the board. Not the board itself.
       Don't add any additional shadows"): a blur alone, no darkening, in
       the table's outline on screen, with the board and the pieces on it
       cut out close. An SVG mask, rebuilt only when that shape moves. */
    function tableBlurFrame(t, r, e, boardPts) {
      if (!tableLocal) {
        const box = new THREE.Box3(), b = new THREE.Box3();
        den.table.group.updateMatrixWorld(true);
        den.table.group.traverse((o) => {
          if (!o.isMesh || !o.geometry || !o.visible) return;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!m || m.visible === false || m.isShaderMaterial) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          box.union(b);
        });
        if (box.isEmpty()) return;
        const inv = new THREE.Matrix4().copy(den.table.group.matrixWorld).invert();
        tableLocal = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) tableLocal.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
      }
      if (!tableBlur) {
        const mount = t.renderer.domElement.parentNode;
        if (!mount) return;
        tableBlur = document.createElement("div");
        tableBlur.className = "den-table-blur";
        tableBlur.setAttribute("aria-hidden", "true");
        mount.insertBefore(tableBlur, veil);
      }
      tableBlur.style.opacity = e.toFixed(3);
      tableBlur.style.visibility = e > 0 ? "visible" : "hidden";
      const toScreen = (v) => { v.project(t.camera); return [((v.x + 1) / 2) * r.width, ((1 - v.y) / 2) * r.height]; };
      const q2 = (v) => Math.round(v / 2) * 2;
      const tbl = hull(tableLocal.map((p) => toScreen(den.table.group.localToWorld(corner.copy(p)))).map(([x, y]) => [q2(x), q2(y)]));
      // Kept sharp: the board's own shape, and each piece's (one outline
      // round them all took in table behind the board too).
      const boxHull = (bb, obj) => {
        const out = [];
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
          corner.set(x, y, z); if (obj) obj.localToWorld(corner);
          out.push(toScreen(corner));
        }
        return grow(hull(out.map(([x, y]) => [q2(x), q2(y)])), 2);
      };
      const cuts = [];
      const slab = t.boardGroup.getObjectByName("ec-slab");
      if (slab && slab.geometry) { if (!slab.geometry.boundingBox) slab.geometry.computeBoundingBox(); cuts.push(boxHull(slab.geometry.boundingBox, slab)); }
      else cuts.push(grow(hull(boardPts), 2));
      // Each piece by its own outline: its meshes' boxes in their own frames
      // (a box squared to the room, round a piece turned with the board, is
      // bigger than the piece and left patches of table sharp round it).
      if (t.pieceGroup) t.pieceGroup.children.forEach((c) => {
        if (!c.visible) return;
        const outline = [];
        c.traverse((o) => {
          if (!o.isMesh || !o.geometry || !o.visible) return;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!m || m.visible === false || m.colorWrite === false) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
            corner.set(x, y, z); o.localToWorld(corner); outline.push(toScreen(corner));
          }
        });
        if (outline.length >= 3) cuts.push(grow(hull(outline.map(([x, y]) => [q2(x), q2(y)])), 1));
      });
      const W = Math.round(r.width), H = Math.round(r.height);
      const key = `${W}x${H}|${tbl.join(" ")}|${cuts.map((c) => c.map(([x, y]) => [Math.round(x), Math.round(y)]).join(" ")).join("|")}`;
      if (key === tableMaskKey) return;
      tableMaskKey = key;
      const pts = (poly) => poly.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" ");
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>`
        + `<defs><filter id='f' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='10'/></filter>`
        + `<mask id='m' maskUnits='userSpaceOnUse' x='0' y='0' width='${W}' height='${H}'><rect width='${W}' height='${H}' fill='black'/>`
        + `<polygon points='${pts(tbl)}' fill='white' filter='url(#f)'/>${cuts.map((c) => `<polygon points='${pts(c)}' fill='black'/>`).join("")}</mask></defs>`
        + `<rect width='${W}' height='${H}' fill='black' mask='url(#m)'/></svg>`;
      const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      tableBlur.style.webkitMaskImage = url;
      tableBlur.style.maskImage = url;
    }

    function boardShadow(t) {
      const slab = t.boardGroup && t.boardGroup.getObjectByName("ec-slab");
      if (!slab || !slab.geometry) return;
      if (boardCaster && boardCaster.parent === slab && boardCaster.userData.geo === slab.geometry) return;
      if (boardCaster) { boardCaster.parent && boardCaster.parent.remove(boardCaster); boardCaster.geometry.dispose(); }
      if (!slab.geometry.boundingBox) slab.geometry.computeBoundingBox();
      const bb = slab.geometry.boundingBox, top = bb.max.y - 0.15, h = Math.max(0.1, top - bb.min.y);
      const geo = new THREE.BoxGeometry(bb.max.x - bb.min.x, h, bb.max.z - bb.min.z);
      geo.translate((bb.max.x + bb.min.x) / 2, bb.min.y + h / 2, (bb.max.z + bb.min.z) / 2);
      if (!boardShadow.mat) boardShadow.mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
      boardCaster = new THREE.Mesh(geo, boardShadow.mat);
      boardCaster.name = "den-board-shadow";
      boardCaster.castShadow = true;
      boardCaster.receiveShadow = false;
      boardCaster.raycast = () => {};
      boardCaster.userData.geo = slab.geometry;
      slab.add(boardCaster);
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
    // And the set's, while it stirs (the lure, below): from the camera as
    // it's finally placed (after cameraOverride's visits).
    const tvPos = new THREE.Vector3(), tvCam = new THREE.Vector3();
    let lastTvEar = 0;
    function hearTv(camera) {
      const t = three.current, now = performance.now();
      if (!audio || !audio.setTvListener || !lure || lureDone || !den || !den.tv || !t || !t.boardGroup || now - lastTvEar < 100) return;
      lastTvEar = now;
      camera.updateMatrixWorld();
      tvPos.copy(den.tv.focus.target); t.boardGroup.localToWorld(tvPos);
      tvCam.copy(tvPos).applyMatrix4(camera.matrixWorldInverse);
      audio.setTvListener(tvPos.distanceTo(camera.position), tvCam.x / Math.max(1, Math.hypot(tvCam.x, tvCam.z)));
    }
    /* ---- the stereo console: the camera's visit, the machines ---- */
    let focusGoal = 0, focusW = 0, playing = null;
    const eye = new THREE.Vector3(), aim = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3();
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_STEREO__ = () => ({ focus: focusW, goal: focusGoal, playing });

    /* ---- the book by the chair ----
       A tap on it takes the camera over to the end table, right above the
       book and looking down on its cover, as close as the screen allows,
       the page the right way up (the user: "very clearly see the book...
       zoomed in as much as possible"). Any tap, or Escape, and it comes
       back; that tap does nothing else. */
    let bookGoal = 0, bookW = 0, bookHint = null, swallowUp = null;
    const bookUp = new THREE.Vector3(), Y_UP = new THREE.Vector3(0, 1, 0);
    function leaveBook() { if (bookGoal) { bookGoal = 0; return true; } return false; }
    const onBookDown = (e) => {
      if (!bookGoal || bookW < 0.3) return;
      leaveBook();
      swallowUp = e.pointerId;
      e.stopImmediatePropagation(); e.preventDefault();
    };
    const onBookUp = (e) => { if (swallowUp !== null && e.pointerId === swallowUp) { swallowUp = null; e.stopImmediatePropagation(); e.preventDefault(); } };
    const onBookKey = (e) => { if (e.key === "Escape" && leaveBook()) e.stopPropagation(); };
    let bookListenersOn = null;
    function bookListeners(t) {
      if (bookListenersOn || !t.renderer || typeof window === "undefined") return;
      bookListenersOn = t.renderer.domElement;
      bookListenersOn.addEventListener("pointerdown", onBookDown, true);
      bookListenersOn.addEventListener("pointerup", onBookUp, true);
      window.addEventListener("keydown", onBookKey, true);
    }
    function showBookHint(on) {
      if (typeof document === "undefined") return;
      if (!bookHint) {
        if (!on) return;
        bookHint = document.createElement("div");
        bookHint.className = "den-book-hint";
        bookHint.setAttribute("data-testid", "den-book-hint");
        bookHint.textContent = "Tap anywhere to go back to the game";
        document.body.appendChild(bookHint);
      }
      bookHint.classList.toggle("on", on);
    }
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__DEN_BOOK__ = () => ({ goal: bookGoal, w: bookW });

    /* ---- the telephone, ringing ----
       A tap on the ringing slip (den-call.js) takes the camera over to the
       credenza, in front of the phone and a little above it (user: right
       to where the phone is; then a tap on the phone lifts the receiver).
       It stays through the call and comes back as the receiver goes down;
       a tap anywhere but the phone, or Escape, comes back sooner (that tap
       does nothing else). */
    // (Eased on the clock, 1.6 s each way, the same on a slow device.)
    let phoneGoal = 0, phoneW = 0, phoneFrom = 0, phoneT0 = 0, phoneSwallow = null;
    const PHONE_MS = 1600;
    function phoneVisit(on) {
      const g = on ? 1 : 0;
      if (g === phoneGoal) return;
      phoneFrom = phoneW; phoneT0 = performance.now(); phoneGoal = g;
      if (on) bookGoal = 0;
    }
    const phoneRay = new THREE.Raycaster(), phoneNdc = new THREE.Vector2();
    const onPhoneDown = (e) => {
      if (!phoneGoal || phoneW < 0.3) return;
      const t = three.current, el = t && t.renderer && t.renderer.domElement;
      if (el && t.camera && den && den.phone && call && call.ringing()) {
        const r = el.getBoundingClientRect();
        phoneNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        phoneRay.setFromCamera(phoneNdc, t.camera);
        if (phoneRay.intersectObjects(den.phone.pickables, false)[0]) return;
      }
      phoneVisit(false);
      phoneSwallow = e.pointerId;
      e.stopImmediatePropagation(); e.preventDefault();
    };
    const onPhoneUp = (e) => { if (phoneSwallow !== null && e.pointerId === phoneSwallow) { phoneSwallow = null; e.stopImmediatePropagation(); e.preventDefault(); } };
    const onPhoneKey = (e) => { if (e.key === "Escape" && phoneGoal) { phoneVisit(false); e.stopPropagation(); } };
    let phoneListenersOn = null;
    function phoneListeners(t) {
      if (phoneListenersOn || !t.renderer || typeof window === "undefined") return;
      phoneListenersOn = t.renderer.domElement;
      phoneListenersOn.addEventListener("pointerdown", onPhoneDown, true);
      phoneListenersOn.addEventListener("pointerup", onPhoneUp, true);
      window.addEventListener("keydown", onPhoneKey, true);
    }
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__DEN_PHONE_VISIT__ = () => ({ goal: phoneGoal, w: phoneW });
      // (Where the phone is on screen, for a real tap on it.)
      window.__DEN_PHONE_AT__ = () => {
        const t = three.current, m = den && den.phone && den.phone.pickables[0];
        if (!t || !t.camera || !t.renderer || !m) return null;
        const v = new THREE.Vector3(); m.getWorldPosition(v); v.project(t.camera);
        const r = t.renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      };
    }

    /* ---- the television ---- */
    let tvGoal = 0, tvW = 0, tvDive = 0, tvPhase = "off", lastTick = 0, offAt = 0, onStage = false, lureEvents = 0, lastHaunt = null;
    let returning = !!(novaTv && novaTv.returning);
    // The first time back, the commercial is on (den-commercial.js, the
    // user's spot): the camera comes in close on the picture (tvWatch),
    // and the set goes off once it's aired (or when it's tapped).
    let commercialNext = !!(novaTv && novaTv.commercial);
    let tvWatch = 0;
    const AD_DELAY = 1000;
    // Back from Singularity, leaving the set (user: it cut away from the TV
    // too quickly): a moment at the set once it's off, then a slow start
    // that gathers speed toward the table and settles there (timed, not the
    // exponential ease the other visits use, which is fastest at the start).
    const TV_LEAVE_PAUSE = 700, TV_LEAVE_MS = 3400;
    let tvLeaveAt = 0;
    /* After the commercial (user: "Uhh, Okaaaay....."): a thought, one of
       the den's cards (den-cards.js), as the camera sets off back to the
       table (just after it leaves the set), for a few seconds. Whether it
       aired to its end or was switched off part way. */
    const OKAY = "Uhh, Okaaaay.....", OKAY_AFTER = 400, OKAY_MS = 3800;
    let okayAt = 0, okayEnd = 0, okayCard = null;
    function okayFrame(nowP) {
      if (okayAt && nowP >= okayAt) {
        okayAt = 0;
        const doc = typeof document !== "undefined" ? document : null;
        if (doc) { okayCard = dealCard(doc, { testid: "den-okay", l1: OKAY }); okayEnd = nowP + OKAY_MS; }
      }
      if (okayCard && nowP >= okayEnd) { okayCard.remove(700); okayCard = null; }
    }
    /* Into the commercial, the first time back from Singularity (user:
       the cut straight to it was "a bit abrupt"; picked: a pause with the
       set dark, a relieved thought, then the set waking by itself): home
       first, the camera on the board and the set dark; "Phew… I'm home.
       What just happened?!" (one of the den's cards); then the set
       switches itself on (the dot opens, snow) while the camera goes over
       to it, and out of the snow the picture locks into the commercial
       (den-tv.js showCommercial) on its first frame: a living room like
       this one (user: "Wait, is that my house?"). It holds there while the
       camera slowly pushes in on it and the thought comes and goes, then
       plays (its sound set to start with it, so they're as together as
       ever). Meanwhile the set's taps wait, and drags do, as while it has
       the camera. */
    const PHEW = "Phew… I'm home. What just happened?!", PHEW_AT = 800, PHEW_MS = 3200;
    const WAKE_AT = 2800, WAKE_TO_AD = 2000;
    const HOUSE = "Wait… is that my house?", HOUSE_HOLD = 4200, HOUSE_AT = 900, HOUSE_MS = 2600, PUSH_MS = 3800;
    let wake = null, phewCard = null, phewEnd = 0, houseAt = 0, houseCard = null, houseEnd = 0, pushAt = 0;
    function wakeFrame(now) {
      if (phewCard && now >= phewEnd) { phewCard.remove(700); phewCard = null; }
      if (houseAt && now >= houseAt) {
        houseAt = 0;
        const doc = typeof document !== "undefined" ? document : null;
        if (doc) { houseCard = dealCard(doc, { testid: "den-house", l1: HOUSE }); houseEnd = now + HOUSE_MS; }
      }
      if (houseCard && now >= houseEnd) { houseCard.remove(700); houseCard = null; }
      if (!wake || !den || !den.tv) return;
      if (wake.phewAt && now >= wake.phewAt) {
        wake.phewAt = 0;
        const doc = typeof document !== "undefined" ? document : null;
        if (doc) { phewCard = dealCard(doc, { testid: "den-phew", l1: PHEW }); phewEnd = now + PHEW_MS; }
      }
      if (!wake.woke && now >= wake.wakeAt) {
        wake.woke = true;
        wake.adAt = now + WAKE_TO_AD;
        if (den.tv.powerOn(now) && audio && audio.tvOn) audio.tvOn();
        tvGoal = 1; tvLeaveAt = 0;
      }
      if (wake.woke && now >= wake.adAt) {
        wake = null;
        // (Held on its first frame as it locks in, the push and the
        // thought, then on.)
        den.tv.showCommercial(now, HOUSE_HOLD);
        setCommercialOn(true);
        if (audio && audio.tvCommercial) audio.tvCommercial(HOUSE_HOLD / 1000);
        houseAt = now + HOUSE_AT; pushAt = now;
      }
    }
    const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    // How loud the snow hisses, by what's on the screen.
    const HISS = { warming: 1, snow: 1, resolving: 0.5, pattern: 0.1, dive: 0.08, commercial: 0.03, aired: 0.9 };
    /* The lure (Nova, home before the first Singularity, novaTv.lure):
       25 s in, left alone, the set starts to stir, and more often and more
       insistently as time goes on (den-tv.js haunt: static, a thump, a
       rolling bar, a dial turning, ghost pieces on the glass, a garbled
       voice, pieces of light drifting out of it), heard from its corner
       (audio.setTvListener) so the player turns to look, until it's turned
       on. The first tap on it (or the menu's Turn on the TV) only takes the
       camera over to watch (lureLook:
       it stirs at once and twice as often there); the second turns it on.
       A tap anywhere else, or Escape, and the camera goes back. (Of the
       scene links, only ?scene=lure's own: the hall, the trip, the
       revelation and the commercial come after the Singularity in the
       story, but a fresh visitor hasn't seen it, and the lure's look round
       and hold took the hall's taps.) */
    const lure = !!(novaTv && novaTv.lure && novaTv.lure()) && (!preview || preview === "lure");
    const LURE_WAIT = 25000, LURE_RAMP = 60000;
    let lureStart = 0, lureDone = false, lureLook = false, tvHint = null, lookSwallow = null;
    /* The first time home from Big Glutts, while the set's still to be
       noticed (user, with a screenshot from a phone: "the perspective they
       should see their den when that scene first opens"): the Room view
       from above the near side, the coffee table and its board at the
       foot of the screen, the sofa, the stereo wall and its painting, the
       set at the right edge. Fitted to the screenshot; inside the den's
       own limits (target height at yMax). Set on the first frame, after
       the chassis's setup fit, and marked placed so the fit leaves it;
       Begin Game (top-down), a view button or a drag takes it from
       there. */
    const OPENING = { theta: 3.1241, phi: 1.134, radius: 123.5, target: [0.7, 30, -11.97] };
    let openingDue = lure && !returning;
    function opening() {
      if (!openingDue) return;
      openingDue = false;
      if (!cam || !cam.current || !cam.current.target) return;
      const c = cam.current, [x, y, z] = OPENING.target;
      c.dollhouse = true; c.placed = true;
      c.theta = OPENING.theta; c.phi = OPENING.phi; c.radius = OPENING.radius; c.target.set(x, y, z);
      if (c.view) {
        c.view.theta = c.theta; c.view.phi = c.phi; c.view.radius = c.radius;
        if (c.view.target) c.view.target.set(x, y, z);
      }
    }
    /* And three times in all, for an instant, the Singularity itself on the
       dead tube (the commercial's subliminal frame): once a while after it
       starts stirring, and, once the camera's come over, soon after, then
       again (user: three times, briefer than the commercial's). */
    const FLASHES = 3;
    /* The blast (user: more extreme): once, a while into the lure (sooner
       if you're over watching), the set pours a cone of light out of its
       screen until everything goes white for a second, then fades back;
       and from then on it stirs harder and more often than before. */
    const BLAST_AFTER = 16000, BLAST_AFTER_LOOK = 5000;
    let blasted = false, whiteEl = null;
    function whiteOut(a) {
      if (typeof document === "undefined") return;
      if (a <= 0.002) { if (whiteEl) { whiteEl.remove(); whiteEl = null; } return; }
      if (!whiteEl) {
        whiteEl = document.createElement("div");
        whiteEl.setAttribute("data-testid", "den-whiteout");
        whiteEl.style.cssText = "position:fixed;inset:0;z-index:1400;pointer-events:none;background:radial-gradient(ellipse at 50% 45%, #ffffff 0%, #f6f9ff 55%, #e9efff 100%);opacity:0";
        document.body.appendChild(whiteEl);
      }
      whiteEl.style.opacity = String(Math.min(1, a));
    }
    let flashes = 0, nextFlashAt = 0;
    const tvLocked = (now) => lure && !lureDone && (!lureStart || now - lureStart < LURE_WAIT);
    function lookAtTv(on) {
      if (on === lureLook) return;
      lureLook = on;
      if (on) {
        letGoGlance();
        tvGoal = 1; tvLeaveAt = 0;
        const now = performance.now();
        // (Looked at before it's begun: it begins.)
        if (!lureStart || now - lureStart < LURE_WAIT) lureStart = now - LURE_WAIT;
        if (den && den.tv) den.tv.hauntSoon(now, 700);
        if (flashes < FLASHES) nextFlashAt = Math.min(nextFlashAt || Infinity, now + 2500 + Math.random() * 1500);
      } else {
        tvGoal = 0; tvLeaveAt = performance.now() + 200;
      }
      showTvHint(on);
    }
    function showTvHint(on) {
      if (typeof document === "undefined") return;
      if (!tvHint) {
        if (!on) return;
        tvHint = document.createElement("div");
        tvHint.className = "den-book-hint";
        tvHint.setAttribute("data-testid", "den-tv-hint");
        tvHint.textContent = "Tap the set to turn it on\nanywhere else to go back";
        tvHint.setAttribute("data-default", "1");
        tvHint.style.whiteSpace = "pre-line";
        tvHint.style.textAlign = "center";
        document.body.appendChild(tvHint);
      }
      // After the story: what the knob and the picture do.
      if (postStory) tvHint.textContent = chan >= 0
        ? `Channel ${String(chan + 2).padStart(2, "0")}: ${WORLDS[chan].name}\nthe dial: next channel \u00b7 the picture: go there`
        : "The dial: the channels\nanywhere else to go back";
      tvHint.classList.toggle("on", on);
    }
    // While watching: a tap off the set (or Escape) goes back, and does
    // nothing else; a tap on it goes through (pickScene, pressTv).
    const tvRay = new THREE.Raycaster(), tvNdc = new THREE.Vector2();
    const onLookDown = (e) => {
      if (!lureLook || tvW < 0.3) return;
      const t = three.current, el = t && t.renderer && t.renderer.domElement;
      if (el && t.camera && den && den.tv) {
        const r = el.getBoundingClientRect();
        tvNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        tvRay.setFromCamera(tvNdc, t.camera);
        if (tvRay.intersectObjects(den.tv.pickables, false)[0]) return;
      }
      lookAtTv(false);
      lookSwallow = e.pointerId;
      e.stopImmediatePropagation(); e.preventDefault();
    };
    const onLookUp = (e) => { if (lookSwallow !== null && e.pointerId === lookSwallow) { lookSwallow = null; e.stopImmediatePropagation(); e.preventDefault(); } };
    const onLookKey = (e) => { if (e.key === "Escape" && lureLook) { lookAtTv(false); e.stopPropagation(); } };
    /* The lure's look round (user): when the set starts acting up and the
       music goes wonky, the den takes the camera for a few seconds and the
       head turns, a little at random: to the stereo (the music), off
       toward the hall door, maybe back, then over the set (acting up),
       and back; "Huh? What's going on?" (one of the den's cards). And if
       the set's still not been touched when the blast comes: "!!", and
       the head turns to the set and stays there. Meanwhile nothing but a
       tap on the set (or the full-screen switch) does anything (user:
       "nothing can happen until they tap on it"); the tap takes the camera
       over to watch, as ever, and lets go. The camera turns where it
       stands, it isn't moved (glanceFrame, first in placeCamera, so the
       visit to the set blends on from it). */
    const HUH = "Huh? What's going on?", HUH_AT = 900, HUH_MS = 3400;
    // (The "!!" over the blast's white, den-fx.js whiteOut at 1400, and up till
    // a moment after it's gone: 5.6 s, den-tv.js blastState.)
    const BANG = "!!", BANG_AT = 400, BANG_MS = 7000, FIX_AT = 600, FIX_TURN = 1400;
    let glance = null, lureFix = false, lookedRound = false, lockOn = false;
    let huhAt = 0, huhCard = null, huhEnd = 0, bangAt = 0, bangCard = null, bangEnd = 0;
    const gA = new THREE.Vector3(), gB = new THREE.Vector3(), gOwn = new THREE.Vector3(), gDir = new THREE.Vector3();
    function startLookRound(now) {
      const j = () => 0.85 + Math.random() * 0.3;
      const keys = [{ at: "stereo", turn: 900 * j(), hold: 700 * j() }, { at: "hall", turn: 1000 * j(), hold: 450 * j() }];
      if (Math.random() < 0.5) keys.push({ at: "stereo", turn: 800 * j(), hold: 250 * j() });
      keys.push({ at: "tv", turn: 1200 * j(), hold: 1300 * j() });
      glance = { t0: now, keys, back: 1300, fix: false, release: 0, seen: [] };
      huhAt = now + HUH_AT;
      lureLock(true);
    }
    function startFix(now) {
      // (Nothing in the way: every sheet put away, the win placard too, and
      // the camera back from the console, the book or the phone, so it can
      // turn to the set and a tap can reach it.)
      if (sheets && sheets.close) sheets.close();
      focusGoal = 0; bookGoal = 0; phoneVisit(false);
      glance = { t0: now + FIX_AT, keys: [{ at: "tv", turn: FIX_TURN, hold: Infinity }], back: 0, fix: true, release: 0, seen: [] };
      lureFix = true; bangAt = now + BANG_AT;
      lureLock(true);
    }
    // Let go (a tap on the set, or the lure's over): eased back to its own look.
    function letGoGlance() {
      lureFix = false;
      if (glance && !glance.release) glance.release = performance.now();
      lureLock(false);
    }
    function glancePoint(t, at, out) {
      if (at === "tv") out.copy(den.tv.focus.target);
      else if (at === "stereo") out.copy(den.stereo.focus.target);
      else out.set((HALL.DX0 + HALL.DX1) / 2, FLOOR + 19, RZ + 4);
      return t.boardGroup.localToWorld(out);
    }
    function glanceFrame(camera, t) {
      if (!glance || !den || !den.tv || !den.stereo || !t || !t.boardGroup) return;
      const now = performance.now();
      camera.getWorldDirection(gDir);
      gOwn.copy(camera.position).addScaledVector(gDir, 60);
      let s = now - glance.t0, from = null, to = null, k = 0, prev = "own";
      for (const key of glance.keys) {
        if (s < key.turn) { from = prev; to = key.at; k = Math.max(0, s / key.turn); break; }
        s -= key.turn;
        if (s < key.hold) { from = to = key.at; k = 1; break; }
        s -= key.hold;
        prev = key.at;
      }
      if (from === null) {
        if (glance.fix) { from = to = prev; k = 1; }
        else if (s < glance.back) { from = prev; to = "own"; k = s / glance.back; }
        else { glance = null; if (!lureFix) lureLock(false); return; }
      }
      if (k >= 1 && glance.seen[glance.seen.length - 1] !== to) glance.seen.push(to);
      const pt = (at, out) => (at === "own" ? out.copy(gOwn) : glancePoint(t, at, out));
      pt(from, gA); pt(to, gB);
      gA.lerp(gB, k * k * (3 - 2 * k));
      if (glance.release) {
        const r = Math.min(1, (now - glance.release) / 1200);
        gA.lerp(gOwn, r * r * (3 - 2 * r));
        if (r >= 1) glance = null;
      }
      camera.lookAt(gA);
    }
    // While it has the head: only a tap on the set (or the full-screen
    // switch) goes through; everything else, keys too, waits.
    const overTv = (x, y) => {
      const t = three.current, el = t && t.renderer && t.renderer.domElement;
      if (!el || !t.camera || !den || !den.tv) return false;
      const r = el.getBoundingClientRect();
      tvNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      tvRay.setFromCamera(tvNdc, t.camera);
      return !!tvRay.intersectObjects(den.tv.pickables, false)[0];
    };
    // (The starts of things only: a finger already down when it began
    // still lifts, so no drag is left hanging.) A tap on the set is the
    // set's, pressed here at once (pressTv: over to watch, and the head let
    // go), whatever's over it or in front of it (a wall cut away, the
    // table), and the rest of that tap goes nowhere. Held on the set after
    // the blast, Enter or Space does the same from the keyboard.
    const LOCK_EVENTS = ["pointerdown", "click", "dblclick", "mousedown", "touchstart", "wheel", "contextmenu", "gesturestart"];
    const swallow = (e) => { e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
    const onLock = (e) => {
      if (e.target instanceof Element && e.target.closest("[data-fullscreen-toggle]")) return;
      swallow(e);
      if (e.type === "pointerdown" && e.isPrimary !== false && overTv(e.clientX, e.clientY)) { swallowRest(e.pointerId); pressTv(); }
    };
    const onLockKey = (e) => {
      if (e.key === "Tab") return;
      swallow(e);
      if (lureFix && (e.key === "Enter" || e.key === " ") && !e.repeat) pressTv();
    };
    /* The rest of that tap: its lift (the chassis takes a lift on the board
       for a tap even with no press, and on the set that's a second press,
       turning it on), and the mouse and touch events a browser makes of it,
       for a moment after. */
    const REST_EVENTS = ["pointerup", "pointercancel", "touchstart", "touchend", "mousedown", "mouseup", "click", "dblclick", "contextmenu"];
    let restId = null, restUntil = 0, restOn = false;
    const onRest = (e) => {
      if (e.type === "pointerup" || e.type === "pointercancel") {
        if (restId === null || e.pointerId !== restId) return;
        restId = null; restUntil = performance.now() + 700;
      } else if (restId === null && performance.now() > restUntil) { restOff(); return; }
      swallow(e);
    };
    function swallowRest(id) {
      restId = id; restUntil = Infinity;
      if (restOn || typeof window === "undefined") return;
      restOn = true;
      REST_EVENTS.forEach((ev) => window.addEventListener(ev, onRest, { capture: true, passive: false }));
    }
    function restOff() {
      if (!restOn || typeof window === "undefined") return;
      restOn = false; restId = null;
      REST_EVENTS.forEach((ev) => window.removeEventListener(ev, onRest, { capture: true }));
    }
    function lureLock(on) {
      if (on === lockOn || typeof window === "undefined") return;
      lockOn = on;
      const f = on ? "addEventListener" : "removeEventListener";
      LOCK_EVENTS.forEach((ev) => window[f](ev, onLock, { capture: true, passive: false }));
      window[f]("keydown", onLockKey, true);
    }
    /* The Singularity seen meanwhile, while the set's still luring (another
       tab; a test's shortcut): its reason gone, the lure stands down, as
       when the set's turned on, and lets go of the head. */
    const offJourney = onJourneyChange((seen) => {
      if (!seen || !lure || lureDone) return;
      lureDone = true; huhAt = 0; bangAt = 0;
      letGoGlance();
    });
    // Its two thoughts, each frame.
    function lureCards(now) {
      const doc = typeof document !== "undefined" ? document : null;
      if (huhAt && now >= huhAt) { huhAt = 0; if (doc) { huhCard = dealCard(doc, { testid: "den-huh", l1: HUH }); huhEnd = now + HUH_MS; } }
      if (huhCard && now >= huhEnd) { huhCard.remove(700); huhCard = null; }
      if (bangAt && now >= bangAt) { bangAt = 0; if (doc) { bangCard = dealCard(doc, { testid: "den-bang", l1: BANG, loud: true }); bangCard.el.style.zIndex = "1401"; bangEnd = now + BANG_MS; } }
      if (bangCard && now >= bangEnd) { bangCard.remove(700); bangCard = null; }
    }
    let lookListenersOn = null;
    /* While the set has the camera (watching it, the commercial, the way
       in and out), a drag, a pinch, a two-finger swipe or the wheel on the
       scene goes nowhere: the board's own camera underneath would take it,
       and when the set let go the view came back wherever that had been
       left (user: after the commercial, looking at the carpet). Taps still
       go through (to the set). Window, capture: ahead of the chassis's
       document-level gesture listeners and the canvas's own. */
    const holdsCamera = () => tvW > 0.02 || tvGoal > 0 || !!wake || !!glance;
    const onHoldMove = (e) => {
      if (paper) return; // (the order paper's own, while it's up)
      const t = three.current, el = t && t.renderer && t.renderer.domElement;
      if (!el || e.target !== el || !holdsCamera()) return;
      if (e.type === "pointermove" && !e.buttons && e.pointerType === "mouse") return; // (just hovering)
      e.stopImmediatePropagation();
      if (e.cancelable && e.type !== "pointermove") e.preventDefault();
    };
    /* And a touch that begins while the set has the camera starts nothing
       on the board either (user: after the commercial, the camera was left
       looking at the carpet): a finger put down then, still moving as the
       set let go, handed the board's camera all its travel in one jump.
       Only a tap on the set itself goes through (to turn its knob), and not
       during the commercial (a tap there switched it off half-way). */
    const holdSwallowed = new Set();
    const onHoldDown = (e) => {
      if (paper) return; // (the order paper's own, while it's up)
      const t = three.current, el = t && t.renderer && t.renderer.domElement;
      if (!el || e.target !== el) return;
      if (e.type === "pointerdown") {
        // (Looking at the set as it stirs, a tap elsewhere goes back:
        // onLookDown's, so left to it.)
        if (!holdsCamera() || lureLook) return;
        if (den && den.tv && den.tv.phase() !== "commercial" && t.camera) {
          const r = el.getBoundingClientRect();
          tvNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          tvRay.setFromCamera(tvNdc, t.camera);
          if (tvRay.intersectObjects(den.tv.pickables, false)[0]) return;
        }
        holdSwallowed.add(e.pointerId);
      } else if (!holdSwallowed.has(e.pointerId)) return;
      else if (e.type === "pointerup" || e.type === "pointercancel") holdSwallowed.delete(e.pointerId);
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault();
    };
    let holdOn = false;
    function holdListeners() {
      if (holdOn || typeof window === "undefined") return;
      holdOn = true;
      ["pointerdown", "pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, onHoldDown, true));
      window.addEventListener("pointermove", onHoldMove, true);
      window.addEventListener("wheel", onHoldMove, { capture: true, passive: false });
      window.addEventListener("touchmove", onHoldMove, { capture: true, passive: false });
    }
    function lookListeners(t) {
      if (!lure || lookListenersOn || !t.renderer || typeof window === "undefined") return;
      lookListenersOn = t.renderer.domElement;
      lookListenersOn.addEventListener("pointerdown", onLookDown, true);
      lookListenersOn.addEventListener("pointerup", onLookUp, true);
      window.addEventListener("keydown", onLookKey, true);
    }
    // (A tap on the set and the menu's "Turn on the TV" alike.)
    /* The channels: each world's picture (realities.js WORLDS, files beside
       the page) with the set's on-screen channel number and the world's
       name along the bottom. A picture the page may not draw from (opened
       from disk) leaves the card plain. */
    let chan = -1;
    const chanCache = [];
    function drawChannel(c, w, i, img) {
      const g = c.getContext("2d"), W = c.width, H = c.height;
      g.fillStyle = "#0c0915"; g.fillRect(0, 0, W, H);
      if (img) g.drawImage(img, 0, 0, W, H);
      else { g.fillStyle = "#2a1f3d"; g.fillRect(W * 0.08, H * 0.2, W * 0.84, H * 0.5); }
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, H * 0.8, W, H * 0.2);
      g.textBaseline = "middle"; g.fillStyle = "#f4f0e6"; g.textAlign = "left";
      g.font = `700 ${Math.round(H * 0.075)}px 'IBM Plex Sans', Arial, sans-serif`;
      g.fillText(w.name, W * 0.05, H * 0.9);
      g.textAlign = "right"; g.fillStyle = "#7dff86";
      g.font = `700 ${Math.round(H * 0.12)}px 'Courier Prime', 'Courier New', monospace`;
      g.fillText(String(i + 2).padStart(2, "0"), W * 0.95, H * 0.11);
    }
    function channelTex(i) {
      if (chanCache[i]) return chanCache[i];
      const w = WORLDS[i];
      const c = document.createElement("canvas"); c.width = 512; c.height = 384;
      drawChannel(c, w, i, null);
      const tex = new THREE.CanvasTexture(c);
      chanCache[i] = tex;
      const img = new Image();
      img.onload = () => {
        // (Only if the picture can go on the screen: a probe first.)
        try { const pc = document.createElement("canvas"); pc.width = pc.height = 2; const pg = pc.getContext("2d"); pg.drawImage(img, 0, 0, 2, 2); pg.getImageData(0, 0, 1, 1); } catch (e) { return; }
        drawChannel(c, w, i, img); tex.needsUpdate = true;
      };
      img.src = w.shot;
      return tex;
    }
    // The channel dial (after the story): the next reality, round and
    // round; the set comes on if it was off, and the camera over to watch.
    function nextChannel() {
      const set = den && den.tv;
      if (!set) return;
      if (!lureLook) lookAtTv(true);
      chan = (chan + 1) % WORLDS.length;
      const wasOn = set.isOn();
      if (set.showChannel(performance.now(), channelTex(chan), chan) && !wasOn && audio && audio.tvOn) audio.tvOn();
      showTvHint(true);
    }
    function goChannel() {
      const w = WORLDS[chan];
      if (!w) return;
      if (w.nova === "standard") { lookAtTv(false); return; } // (you're here)
      if (novaTv && novaTv.realities) novaTv.realities.go(w);
    }
    function pressTv() {
      const set = den && den.tv;
      if (!set) return false;
      // (Waking by itself into the commercial: the tap waits.)
      if (wake) return true;
      const now = performance.now();
      /* After the story the power knob is just that: on (to the channel
         it was on, or the first) and off. The dial does the channels. */
      if (postStory) {
        if (!lureLook) lookAtTv(true);
        if (set.isOn()) { if (set.powerOff(now) && audio && audio.tvOff) audio.tvOff(); }
        else { if (chan < 0) chan = 0; if (set.showChannel(now, channelTex(chan), chan) && audio && audio.tvOn) audio.tvOn(); }
        showTvHint(true);
        return true;
      }
      // The lure's first press: over to the set, to watch.
      if (lure && !lureDone && !set.isOn() && !lureLook) { lookAtTv(true); return true; }
      lureDone = true;
      if (lureLook) { lureLook = false; showTvHint(false); }
      // On its way in (the portal): half a second on, it can't be called
      // off (user); before that, a second tap still switches it off.
      if (set.isOn() && portalAt && now - portalAt >= PORTAL_LOCK_MS) return true;
      if (set.isOn()) {
        portalAt = 0;
        const ad = set.phase() === "commercial" || set.phase() === "aired";
        if (set.powerOff(now)) {
          // (Off in the middle of the commercial: the camera goes back the
          // slow way, as it does after it.)
          if (tvGoal && tvW > 0.9) { tvLeaveAt = performance.now() + TV_LEAVE_PAUSE; onTheBoard(); }
          if (ad) okayAt = performance.now() + TV_LEAVE_PAUSE + OKAY_AFTER;
          tvGoal = 0; offAt = 0;
          if (audio && audio.tvOff) audio.tvOff();
        }
        return true;
      }
      const portal = !!(novaTv && novaTv.portal && novaTv.portal());
      // If Nova can't go after all (something else under way), the set
      // goes off and the camera comes back.
      const enter = () => {
        if (novaTv.enter() !== false) return;
        portalAt = 0;
        if (set.powerOff(performance.now(), true) && audio && audio.tvOff) audio.tvOff();
        tvGoal = 0;
      };
      if (!set.powerOn(now, portal, portal ? enter : null)) return false;
      if (portal) { tvGoal = 1; portalAt = now; }
      if (audio && audio.tvOn) audio.tvOn();
      return true;
    }
    let portalAt = 0;
    const PORTAL_LOCK_MS = 500;
    if (novaTv && novaTv.register) novaTv.register({ press: pressTv });
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
      window.__DEN_TV__ = () => ({ portalAt, phase: den && den.tv ? den.tv.phase() : null, focus: tvW, goal: tvGoal, dive: tvDive, watch: tvWatch, waking: wake ? (wake.woke ? "woke" : "dark") : null, lureWaited: lureStart ? performance.now() - lureStart - LURE_WAIT : null, glance: glance ? (glance.fix ? "fix" : "round") : null, glanceAt: glance && glance.seen.length ? glance.seen[glance.seen.length - 1] : null, lock: lockOn, fixed: lureFix, ad: den && den.tv ? den.tv.commercialAt(performance.now()) : null, lure, locked: tvLocked(performance.now()), lureEvents, lastHaunt, looking: lureLook, flashes, blasted, white: whiteEl ? Number(whiteEl.style.opacity) : 0 });
      // Test-only: move the lure's clock on (ms).
      window.__DEN_LURE_SKIP__ = (ms) => { lureStart -= ms; };
      // Test-only: where the set is on the screen (its picture's middle),
      // and whether a tap there is over it.
      window.__DEN_TV_AT__ = () => {
        const t = three.current, el = t && t.renderer && t.renderer.domElement;
        if (!el || !t.camera || !t.boardGroup || !den || !den.tv) return null;
        const p = t.boardGroup.localToWorld(new THREE.Vector3().copy(den.tv.focus.target)).project(t.camera);
        const r = el.getBoundingClientRect();
        const x = r.left + ((p.x + 1) / 2) * r.width, y = r.top + ((1 - p.y) / 2) * r.height;
        return { x, y, over: overTv(x, y) };
      };
      // Test-only: as if back from the Singularity the first time: the
      // set on, the commercial.
      window.__DEN_TV_AIR__ = () => { returning = true; commercialNext = true; };
      window.__DEN_TRIP__ = () => (trip ? trip.state() : null);
      // The end of the story: the hall, the void, the channels after.
      window.__DEN_HALL__ = () => (hall ? hall.state() : null);
      window.__DEN_HALL_NOW__ = () => hall && hall.now(movesNow());
      window.__DEN_HALL_PICK__ = (which) => hall && hall.pick(which);
      window.__DEN_HALL_SKIP__ = (ms) => hall && hall.skipWalk(ms);
      window.__DEN_ENDING__ = () => (ending ? ending.state() : null);
      window.__DEN_ENDING_METER__ = () => (ending && ending.meter ? ending.meter() : null);
      window.__DEN_ENDING_SKIP__ = (ms) => ending && ending.skip(ms);
      window.__DEN_TV_CHANNEL__ = () => nextChannel();
      window.__DEN_CHANNEL__ = () => ({ post: postStory, chan, name: chan >= 0 ? WORLDS[chan].name : null, phase: den && den.tv ? den.tv.phase() : null });
      window.__DEN_TRIP_PIN__ = (ms) => trip && trip.pin(ms);
      window.__DEN_TV_BLAST_PIN__ = (b) => den && den.tv && den.tv.blastPinAt && den.tv.blastPinAt(b);
      // Test-only: the camera over at the set (or back), the set left as it is.
      window.__DEN_TV_LOOK__ = (on) => { tvGoal = on ? 1 : 0; };
      window.__DEN_TV_PRESS__ = pressTv;
      // Test-only: the lure's Singularity frame on the set, held (ms).
      window.__DEN_TV_FLASH__ = (ms) => !!(den && den.tv && den.tv.flash(performance.now(), ms));
    }
    const api = {
      armOnBegin() {},
      restart() {},
      tick(now) {
        if (!attach()) return;
        opening();
        const t = three.current;
        govern(now);
        woodSet.followGrain(t);
        if (t.camera) { camLocal.copy(t.camera.position); t.boardGroup.worldToLocal(camLocal); }
        den.animate(now, t.camera ? camLocal : null, { open: focusGoal > 0 && focusW > 0.6, playing });
        showRulesHint(t);
        paperFrame(t, now);
        focusFrame(t, now);
        listen(t, now);
        if (call) call.tick(now, t, den);
        tripPull(t, now);
        if (hall) {
          const ts = trip ? trip.state().stage : "idle";
          const busy = !!(awaitingBeginRef && awaitingBeginRef.current) || !!(call && call.busy && call.busy()) || (ts !== "idle" && ts !== "done")
            || !!(den.tv && den.tv.isOn()) || tvGoal > 0 || !!wake || phoneGoal > 0 || bookGoal > 0 || focusGoal > 0 || !!ending
            || (typeof document !== "undefined" && !!document.querySelector("[data-testid='story-cut']"));
          hall.tick(now, t, den, { moves: movesNow, busy, over: () => !!(over && over()) });
          // (The body for the void, made ahead in idle moments while the
          // choice is up, and its music fetched: den-ending.js.)
          if (!figWarm && hall.state().state === "flare") { figWarm = true; prewarmFigure(); prefetchVoidMusic(); }
          // (?scene=hall: kept playing, it's back in a few seconds.)
          if (hallPreview) {
            const hs = hall.state();
            if (hs.state !== "armed" || !hs.flares) hallAgainAt = 0;
            else if (!hallAgainAt) hallAgainAt = now + 4000;
            else if (now >= hallAgainAt) { hallAgainAt = 0; hall.now(movesNow()); }
          }
        }
        if (den.tv && den.tv.glowKnob) den.tv.glowKnob(postStory);
        if (autoMusic) {
          if (typeof document !== "undefined" && document.querySelector("[data-testid='story-cut']")) autoMusicAt = 0;
          else if (!autoMusicAt) autoMusicAt = now + 1200;
          else if (now >= autoMusicAt) {
            autoMusic = false;
            const list = music.tracks().filter((tr) => tr.medium === "record" || tr.medium === "8track");
            if (list.length && !music.playing()) music.play({ ...list[Math.floor(Math.random() * list.length)], level: 0.4 });
          }
        }
        // The television.
        const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
        lastTick = now;
        if (returning) {
          // Back from Singularity: the set is on, the camera at it; then,
          // once Nova's transition has finished showing the room (it ends
          // about 0.6 s after this), off. The first time, the commercial
          // is on instead, and the set goes off after it.
          returning = false;
          tvGoal = tvW = commercialNext ? 0 : 1;
          /* Under the set's hold, the board's own camera squares up, so
             the set lets go onto the board square on, at the usual
             pitch (user: it came back at an angle; the heading had come
             along from Neon): the nearest side's heading. The chassis
             eases its view there unseen while the set has the camera. */
          onTheBoard();
          if (commercialNext) {
            commercialNext = false;
            // Home first, the set dark; then it wakes (wakeFrame).
            wake = { phewAt: now + PHEW_AT, wakeAt: now + WAKE_AT, woke: false, adAt: 0 };
          } else {
            den.tv.showPattern(now);
            offAt = now + 1800;
          }
        }
        wakeFrame(now);
        lureCards(performance.now());
        if (den.tv.phase() === "aired" && !offAt) offAt = now + 650;
        if (offAt && now >= offAt) {
          offAt = 0;
          onTheBoard();
          portalAt = 0;
          const ad = den.tv.phase() === "aired";
          if (den.tv.powerOff(now) && audio && audio.tvOff) audio.tvOff();
          tvGoal = 0;
          tvLeaveAt = performance.now() + TV_LEAVE_PAUSE;
          if (ad) okayAt = tvLeaveAt + OKAY_AFTER;
        }
        okayFrame(performance.now());
        if (lure && !lureDone) {
          if (!lureStart) lureStart = now;
          const waited = now - lureStart - LURE_WAIT;
          if (waited >= 0) {
            // The look round, once, as it starts (when nothing else has the
            // camera, and no sheet's up), unless the set's been looked at
            // already.
            if (!lookedRound && !lureLook && !blasted && !glance && tvGoal === 0 && phoneGoal === 0 && bookGoal === 0 && focusGoal === 0 && !(sheets && sheets.up && sheets.up())) {
              lookedRound = true; startLookRound(performance.now());
            }
            if (!blasted && waited >= (lureLook ? BLAST_AFTER_LOOK : BLAST_AFTER) && den.tv.blast(now)) {
              blasted = true; lureEvents++; lastHaunt = "blast";
              if (audio && audio.tvHaunt) audio.tvHaunt("blast", 1);
              // Still not looked at: "!!", and the head turns to it and stays.
              if (!lureLook) startFix(performance.now());
            }
            // (After the blast, it's never quite settled again.)
            const level = Math.max(Math.min(1, waited / LURE_RAMP), blasted ? 0.85 : 0);
            den.tv.haunt(now, lureLook ? Math.max(level, 0.55) : level, (kind, strength) => { lureEvents++; lastHaunt = kind; if (audio && audio.tvHaunt) audio.tvHaunt(kind, strength); }, lureLook);
            if (!nextFlashAt && flashes < FLASHES) nextFlashAt = now + 12000 + Math.random() * 6000;
            if (nextFlashAt && now >= nextFlashAt && flashes < FLASHES && den.tv.flash(now)) {
              flashes++;
              if (audio && audio.tvHaunt) audio.tvHaunt("flash", 1);
              nextFlashAt = flashes < FLASHES ? now + (lureLook ? 5000 + Math.random() * 3000 : 15000 + Math.random() * 8000) : 0;
            }
          }
        }
        // The set's pull on the music (den-audio.js setTvPull): nothing
        // until it starts stirring, then more as the lure goes on; all of
        // it while you're over watching, or it's on.
        {
          let pull = 0;
          if (lure && !lureDone && lureStart) {
            const waited = now - lureStart - LURE_WAIT;
            if (waited >= 0) pull = Math.max(0.4, Math.min(1, waited / LURE_RAMP));
            if (lureLook) pull = 1;
          }
          if (den.tv.isOn()) pull = 1;
          if (audio && audio.setTvPull) audio.setTvPull(pull);
        }
        tvDive = den.tv.animate(now, dt);
        whiteOut(den.tv.blastState ? den.tv.blastState(now).white : 0);
        {
          const on = den.tv.phase() === "commercial";
          // (Waking into it counts: the order paper and the special order
          // wait for after it, as they always have.)
          if (!on && !wake) setCommercialOn(false);
          // In close on the picture: the slow push from the set onto its
          // first frame, as it locks in; else eased.
          if (pushAt) {
            const k = Math.min(1, Math.max(0, (now - pushAt) / PUSH_MS));
            tvWatch = Math.max(tvWatch, k * k * (3 - 2 * k));
            if (k >= 1 || !on) pushAt = 0;
          } else tvWatch += ((on ? 1 : 0) - tvWatch) * (1 - Math.exp(-dt * 1.2));
        }
        // While the camera visits the set, the title and the dock's piece
        // step aside (standard.js styleSheet, html.ec-tv-visit).
        bookListeners(t);
        phoneListeners(t);
        lookListeners(t);
        holdListeners();
        showBookHint(bookGoal === 1 && bookW > 0.6);
        const visiting = tvGoal > 0 || tvW > 0.02 || bookGoal > 0 || bookW > 0.02 || phoneGoal > 0 || phoneW > 0.02 || !!(hall && hall.active());
        if (visiting !== onStage && typeof document !== "undefined") { onStage = visiting; document.documentElement.classList.toggle("ec-tv-visit", visiting); }
        const ph = den.tv.phase();
        if (ph !== tvPhase) {
          if (audio && audio.tvHiss) audio.tvHiss(HISS[ph] || 0);
          if (ph === "pattern" && tvPhase === "resolving" && audio && audio.tvTone) audio.tvTone();
          tvPhase = ph;
        }
      },
      // The music menu opened (true) or closed: the camera goes over to the console, or back.
      setMusicFocus(on) { focusGoal = on ? 1 : 0; if (on) bookGoal = 0; },
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
        // (Once taken, the paper's the special-order form till the den's
        // left: not the rules, user. The box still is.)
        if (onTable && onTable.object.userData.rules) return paperTaken && onTable.object === den.table.rules.leaflet ? "orderPaper" : "rules";
        // The lamps (focus: the console's, the credenza's two, the ceiling's
        // two globes), each while its wall or the ceiling is there, and,
        // while the south wall is there, the stereo's machines and the
        // set: the nearest.
        const lamps = den.lamp.pickables.filter((m) => { const g = den.groups[m.userData.lampGroup]; return !g || g.visible; });
        const things = lamps.concat(den.book.pickables, den.groups.wallS.visible ? den.stereo.pickables.concat(den.tv.pickables) : [],
          call && call.ringing() && den.groups.wallW.visible && den.phone ? den.phone.pickables : []);
        const hits = raycaster.intersectObjects(things, false);
        let hit = hits[0];
        if (!hit) return null;
        // (The set's knobs sit just behind its tap-anywhere box: a tap on
        // one is the knob's.)
        const knob = hits.find((h) => h.object.userData.tv === "power" || h.object.userData.tv === "channel");
        if (knob && hit.object.userData.tv === "set" && knob.distance - hit.distance < 4) hit = knob;
        const nearer = raycaster.intersectObjects([slab, den.table.group].filter(Boolean), true)[0];
        if (nearer && nearer.distance < hit.distance) return null;
        if (hit.object.userData.focusLamp) return "lamp";
        if (hit.object.userData.book) return "book";
        if (hit.object.userData.phone) return "phone";
        if (hit.object.userData.tv) {
          if (postStory && hit.object.userData.tv === "channel") return "tvChannel";
          // (The picture: a tap on the glass itself.)
          const onGlass = den.tv.screen && raycaster.intersectObject(den.tv.screen, false).length > 0;
          return postStory && hit.object.userData.tv === "set" && onGlass && den.tv.phase() === "channel" && chan >= 0 ? "tvScreen" : "tv";
        }
        return hit.object.userData.music || null;
      },
      // What a tap on "rules" or "tv" does is the room's own: the rules
      // open at the Quick card (as How to play did; chassis/RulesCards.jsx
      // listens for the event, the name its OPEN_RULES_EVENT), the knob turns.
      sceneTap(what) {
        if (what === "orderPaper") return true; // (the order form: the note's up already)
        if (what === "rules") {
          rulesHover = false;
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "quick", focus: null } }));
          return true;
        }
        // A lamp: the room's lights down (focus) or up again; the chassis
        // keeps the state (its FOCUS_EVENT, a toggle).
        if (what === "book") {
          if (den && den.book.focus) bookGoal = bookGoal ? 0 : 1;
          return true;
        }
        if (what === "lamp") {
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("el-cabeza:focus", { detail: {} }));
          return true;
        }
        // The telephone, ringing: picked up.
        if (what === "phone") return call ? call.answer() : false;
        // After the story: the picture on the set is a way there.
        if (what === "tvScreen") { goChannel(); return true; }
        if (what === "tvChannel") { nextChannel(); return true; }
        if (what !== "tv") return false;
        pressTv();
        return true;
      },
      // Focus on (the chassis's switch, button, F key, or a lamp).
      setFocus(on) { focusOn = !!on; },
      // What's under the mouse: over the leaflet or the box, the "?".
      sceneHover(what) { rulesHover = what === "rules"; },
      /* After the chassis has set its camera: blend it toward the view of
         the console by how far into the visit it is (eased both ways). */
      placeCamera(camera, dtMs) {
        const t = three.current;
        // The hall first (the doorway, the walk in): over everything else.
        if (hall && hall.placeCamera(camera, t, den)) return true;
        glanceFrame(camera, t);
        focusW += (focusGoal - focusW) * (1 - Math.exp(-(dtMs / 1000) * 2.4));
        if (Math.abs(focusGoal - focusW) < 0.001) focusW = focusGoal;
        if (tvLeaveAt && tvGoal === 0) {
          const p = Math.max(0, Math.min(1, (performance.now() - tvLeaveAt) / TV_LEAVE_MS));
          tvW = 1 - easeInOutCubic(p);
          if (p >= 1) { tvLeaveAt = 0; tvW = 0; }
        } else {
          if (tvGoal > 0) tvLeaveAt = 0;
          tvW += (tvGoal - tvW) * (1 - Math.exp(-(dtMs / 1000) * 2.2));
          if (Math.abs(tvGoal - tvW) < 0.001) tvW = tvGoal;
        }
        if (den && t && t.boardGroup && tvW > 0) {
          /* The television: far enough back to have the set in view (on a
             tall screen its sides may go), a little above it; then, as the
             picture pulls, right up to the glass. */
          const f = den.tv.focus, dv = den.tv.dive;
          const vt = Math.tan((camera.fov * Math.PI) / 360);
          // Watching the commercial: in close, on the picture itself.
          const w = tvWatch * tvWatch * (3 - 2 * tvWatch);
          const halfH = f.halfH + (8.2 - f.halfH) * w, halfW = f.halfW + (10.6 - f.halfW) * w;
          const d = Math.min(70, Math.max(halfH / vt, halfW / (vt * camera.aspect)));
          const k = Math.max(tvDive, w);
          const lift = d * 0.1 * (1 - k);
          eye.set(f.target.x + (dv.x - f.target.x) * k, f.target.y + lift + (dv.y - f.target.y) * k, f.front - d);
          if (tvDive > 0) eye.z = f.front - d + (dv.eyeZ - (f.front - d)) * tvDive;
          aim.set(f.target.x + (dv.x - f.target.x) * k, f.target.y + (dv.y - f.target.y) * k, f.front);
          if (tvDive > 0) aim.lerp(dv.target, tvDive);
          t.boardGroup.localToWorld(eye); t.boardGroup.localToWorld(aim);
          // (The timed leave is already eased; the others ease here.)
          const e = tvLeaveAt ? tvW : tvW * tvW * (3 - 2 * tvW);
          camera.getWorldDirection(dir);
          look.copy(camera.position).addScaledVector(dir, camera.position.length());
          look.lerp(aim, e);
          camera.position.lerp(eye, e);
          camera.lookAt(look);
          return true;
        }
        if (phoneW !== phoneGoal) phoneW = phoneFrom + (phoneGoal - phoneFrom) * Math.min(1, (performance.now() - phoneT0) / PHONE_MS);
        if (den && t && den.phone && den.phone.point && phoneW > 0) {
          /* The phone: from the room, in front of it and a little above,
             the phone and some of the credenza round it in the frame (a
             tall screen steps back to keep its width). */
          const vt = Math.tan((camera.fov * Math.PI) / 360);
          const d = Math.min(60, Math.max(7 / vt, 10 / (vt * camera.aspect)));
          den.group.updateWorldMatrix(true, false);
          aim.copy(den.phone.point); aim.y -= 0.8;
          eye.copy(den.phone.point); eye.x += d * 0.93; eye.y += d * 0.37;
          den.group.localToWorld(aim); den.group.localToWorld(eye);
          const e = phoneW * phoneW * (3 - 2 * phoneW);
          camera.getWorldDirection(dir);
          look.copy(camera.position).addScaledVector(dir, camera.position.length());
          look.lerp(aim, e);
          camera.position.lerp(eye, e);
          camera.lookAt(look);
          return true;
        }
        bookW += (bookGoal - bookW) * (1 - Math.exp(-(dtMs / 1000) * 2.0));
        if (Math.abs(bookGoal - bookW) < 0.001) bookW = bookGoal;
        if (den && t && t.boardGroup && bookW > 0 && den.book.focus) {
          /* The book: straight over its cover, a touch toward its tail (where
             a reader would be), as near as fits it on screen with a little
             margin, turned so the cover reads the right way up. */
          const f = den.book.focus;
          const vt = Math.tan((camera.fov * Math.PI) / 360);
          const d = Math.max(camera.near * 4, (f.halfL * 1.18) / vt, (f.halfW * 1.18) / (vt * camera.aspect));
          den.group.updateWorldMatrix(true, false);
          aim.copy(f.center);
          eye.copy(f.center).addScaledVector(Y_UP, d).addScaledVector(f.head, -d * 0.1);
          den.group.localToWorld(aim); den.group.localToWorld(eye);
          bookUp.copy(f.head).transformDirection(den.group.matrixWorld);
          const e = bookW * bookW * (3 - 2 * bookW);
          camera.getWorldDirection(dir);
          look.copy(camera.position).addScaledVector(dir, camera.position.length());
          look.lerp(aim, e);
          camera.position.lerp(eye, e);
          camera.up.copy(Y_UP).lerp(bookUp, e).normalize();
          camera.lookAt(look);
          camera.up.copy(Y_UP);
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
        if (call) call.dispose();
        if (hall) hall.dispose();
        if (ending) { ending.dispose(); ending = null; }
        if (previewEl) { previewEl.remove(); previewEl = null; }
        chanCache.forEach((tx) => tx && tx.dispose());
        if (trip) trip.dispose();
        clearTimeout(homeCardTimer);
        if (homeCardDrop) homeCardDrop();
        if (settleDrop) settleDrop();
        if (paper) paper.stop();
        okayAt = 0;
        if (okayCard) { okayCard.el.remove(); okayCard = null; }
        wake = null; houseAt = 0; pushAt = 0;
        glance = null; lureFix = false; lureLock(false); restOff(); offJourney(); huhAt = 0; bangAt = 0;
        if (huhCard) { huhCard.el.remove(); huhCard = null; }
        if (bangCard) { bangCard.el.remove(); bangCard = null; }
        if (phewCard) { phewCard.el.remove(); phewCard = null; }
        if (houseCard) { houseCard.el.remove(); houseCard = null; }
        if (t && t.scene) { t.scene.fog = fogBefore; t.scene.background = bgBefore; }
        if (t && t.camera && farBefore) { t.camera.far = farBefore; t.camera.updateProjectionMatrix(); }
        if (novaTv && novaTv.register) novaTv.register(null);
        if (hintEl) { hintEl.remove(); hintEl = null; }
        if (veil) { veil.remove(); veil = null; }
        if (tableBlur) { tableBlur.remove(); tableBlur = null; }
        if (boardCaster) { boardCaster.parent && boardCaster.parent.remove(boardCaster); boardCaster.geometry.dispose(); boardCaster = null; }
        if (bookHint) { bookHint.remove(); bookHint = null; }
        if (bookListenersOn) {
          bookListenersOn.removeEventListener("pointerdown", onBookDown, true);
          bookListenersOn.removeEventListener("pointerup", onBookUp, true);
          window.removeEventListener("keydown", onBookKey, true);
          bookListenersOn = null;
        }
        if (phoneListenersOn) {
          phoneListenersOn.removeEventListener("pointerdown", onPhoneDown, true);
          phoneListenersOn.removeEventListener("pointerup", onPhoneUp, true);
          window.removeEventListener("keydown", onPhoneKey, true);
          phoneListenersOn = null;
        }
        if (typeof window !== "undefined") { delete window.__DEN_PHONE_VISIT__; delete window.__DEN_PHONE_AT__; }
        if (typeof document !== "undefined") document.documentElement.classList.remove("ec-tv-visit");
        setCommercialOn(false);
        if (tvHint) { tvHint.remove(); tvHint = null; }
        if (holdOn) {
          holdOn = false;
          window.removeEventListener("pointermove", onHoldMove, true);
          window.removeEventListener("wheel", onHoldMove, { capture: true });
          window.removeEventListener("touchmove", onHoldMove, { capture: true });
          ["pointerdown", "pointerup", "pointercancel"].forEach((ev) => window.removeEventListener(ev, onHoldDown, true));
        }
        if (lookListenersOn) {
          lookListenersOn.removeEventListener("pointerdown", onLookDown, true);
          lookListenersOn.removeEventListener("pointerup", onLookUp, true);
          window.removeEventListener("keydown", onLookKey, true);
          lookListenersOn = null;
        }
        if (typeof window !== "undefined") { window.__DEN_ROOM__ = false; delete window.__DEN_THREE__; delete window.__DEN_STEREO__; delete window.__DEN_TV__; delete window.__DEN_TV_PRESS__; delete window.__DEN_TV_BLAST_PIN__; delete window.__DEN_TRIP__; delete window.__DEN_TRIP_PIN__; ["__DEN_TV_CHANNEL__", "__DEN_HALL__", "__DEN_HALL_NOW__", "__DEN_HALL_PICK__", "__DEN_HALL_SKIP__", "__DEN_ENDING__", "__DEN_ENDING_SKIP__", "__DEN_CHANNEL__"].forEach((k) => { delete window[k]; }); }
        if (whiteEl) { whiteEl.remove(); whiteEl = null; }
      },
    };
    /* After the chassis has set its camera: blend it toward the view of
       the console, the set or the book (placeCamera); then the set's
       stirring is heard from where the camera ended up. */
    /* While the ending covers the screen, the den underneath isn't drawn
       (the chassis skips its own render when this says it's done): two
       full scenes a frame had been too much for a phone. */
    api.render = () => !!(ending && ending.covering && ending.covering());
    api.cameraOverride = (camera, dtMs) => {
      const placed = api.placeCamera(camera, dtMs);
      hearTv(camera);
      return placed;
    };
    return api;
  };
}
