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
import { setCommercialOn } from "../engine/journey.js";

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
      const goal = focusOn && focusGoal === 0 && tvGoal === 0 && bookGoal === 0 ? 1 : 0;
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

    /* ---- the television ---- */
    let tvGoal = 0, tvW = 0, tvDive = 0, tvPhase = "off", lastTick = 0, offAt = 0, onStage = false, lureEvents = 0, lastHaunt = null;
    let returning = !!(novaTv && novaTv.returning);
    // The first time back, the late-night commercial is on (den-commercial.js):
    // the camera comes in close enough to read it (tvWatch), and the set
    // goes off once it's aired (or when it's tapped).
    let commercialNext = !!(novaTv && novaTv.commercial);
    let tvWatch = 0;
    const AD_DELAY = 1000;
    // Back from Singularity, leaving the set (user: it cut away from the TV
    // too quickly): a moment at the set once it's off, then a slow start
    // that gathers speed toward the table and settles there (timed, not the
    // exponential ease the other visits use, which is fastest at the start).
    const TV_LEAVE_PAUSE = 700, TV_LEAVE_MS = 3400;
    let tvLeaveAt = 0;
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
       A tap anywhere else, or Escape, and the camera goes back. */
    const lure = !!(novaTv && novaTv.lure && novaTv.lure());
    const LURE_WAIT = 25000, LURE_RAMP = 60000;
    let lureStart = 0, lureDone = false, lureLook = false, tvHint = null, lookSwallow = null;
    /* And three times in all, for an instant, the Singularity itself on the
       dead tube (the commercial's subliminal frame): once a while after it
       starts stirring, and, once the camera's come over, soon after, then
       again (user: three times, briefer than the commercial's). */
    const FLASHES = 3;
    let flashes = 0, nextFlashAt = 0;
    const tvLocked = (now) => lure && !lureDone && (!lureStart || now - lureStart < LURE_WAIT);
    function lookAtTv(on) {
      if (on === lureLook) return;
      lureLook = on;
      if (on) {
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
        tvHint.style.whiteSpace = "pre-line";
        tvHint.style.textAlign = "center";
        document.body.appendChild(tvHint);
      }
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
    let lookListenersOn = null;
    function lookListeners(t) {
      if (!lure || lookListenersOn || !t.renderer || typeof window === "undefined") return;
      lookListenersOn = t.renderer.domElement;
      lookListenersOn.addEventListener("pointerdown", onLookDown, true);
      lookListenersOn.addEventListener("pointerup", onLookUp, true);
      window.addEventListener("keydown", onLookKey, true);
    }
    // (A tap on the set and the menu's "Turn on the TV" alike.)
    function pressTv() {
      const set = den && den.tv;
      if (!set) return false;
      const now = performance.now();
      // The lure's first press: over to the set, to watch.
      if (lure && !lureDone && !set.isOn() && !lureLook) { lookAtTv(true); return true; }
      lureDone = true;
      if (lureLook) { lureLook = false; showTvHint(false); }
      if (set.isOn()) {
        if (set.powerOff(now)) {
          // (Off in the middle of the commercial: the camera goes back the
          // slow way, as it does after it.)
          if (tvGoal && tvW > 0.9) tvLeaveAt = performance.now() + TV_LEAVE_PAUSE;
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
      window.__DEN_TV__ = () => ({ phase: den && den.tv ? den.tv.phase() : null, focus: tvW, goal: tvGoal, dive: tvDive, watch: tvWatch, ad: den && den.tv ? den.tv.commercialAt(performance.now()) : null, lure, locked: tvLocked(performance.now()), lureEvents, lastHaunt, looking: lureLook, flashes });
      // Test-only: move the lure's clock on (ms).
      window.__DEN_LURE_SKIP__ = (ms) => { lureStart -= ms; };
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
          // about 0.6 s after this), off. The first time, the commercial
          // is on instead, and the set goes off after it.
          returning = false;
          tvGoal = tvW = 1;
          if (commercialNext) {
            commercialNext = false;
            // (A second in, once Nova's transition has shown the room.)
            den.tv.showCommercial(now, AD_DELAY);
            tvWatch = 1;
            setCommercialOn(true);
            if (audio && audio.tvCommercial) audio.tvCommercial(AD_DELAY / 1000);
          } else {
            den.tv.showPattern(now);
            offAt = now + 1800;
          }
        }
        if (den.tv.phase() === "aired" && !offAt) offAt = now + 650;
        if (offAt && now >= offAt) {
          offAt = 0;
          if (den.tv.powerOff(now) && audio && audio.tvOff) audio.tvOff();
          tvGoal = 0;
          tvLeaveAt = performance.now() + TV_LEAVE_PAUSE;
        }
        if (lure && !lureDone) {
          if (!lureStart) lureStart = now;
          const waited = now - lureStart - LURE_WAIT;
          if (waited >= 0) {
            const level = Math.min(1, waited / LURE_RAMP);
            den.tv.haunt(now, lureLook ? Math.max(level, 0.55) : level, (kind, strength) => { lureEvents++; lastHaunt = kind; if (audio && audio.tvHaunt) audio.tvHaunt(kind, strength); }, lureLook);
            if (!nextFlashAt && flashes < FLASHES) nextFlashAt = now + 12000 + Math.random() * 6000;
            if (nextFlashAt && now >= nextFlashAt && flashes < FLASHES && den.tv.flash(now)) {
              flashes++;
              if (audio && audio.tvHaunt) audio.tvHaunt("flash", 1);
              nextFlashAt = flashes < FLASHES ? now + (lureLook ? 5000 + Math.random() * 3000 : 15000 + Math.random() * 8000) : 0;
            }
          }
        }
        tvDive = den.tv.animate(now, dt);
        {
          const on = den.tv.phase() === "commercial";
          if (!on) setCommercialOn(false);
          tvWatch += ((on ? 1 : 0) - tvWatch) * (1 - Math.exp(-dt * 1.2));
        }
        // While the camera visits the set, the title and the dock's piece
        // step aside (standard.js styleSheet, html.ec-tv-visit).
        bookListeners(t);
        lookListeners(t);
        showBookHint(bookGoal === 1 && bookW > 0.6);
        const visiting = tvGoal > 0 || tvW > 0.02 || bookGoal > 0 || bookW > 0.02;
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
        if (onTable && onTable.object.userData.rules) return "rules";
        // The lamps (focus: the console's, the credenza's two, the ceiling's
        // two globes), each while its wall or the ceiling is there, and,
        // while the south wall is there, the stereo's machines and the
        // set: the nearest.
        const lamps = den.lamp.pickables.filter((m) => { const g = den.groups[m.userData.lampGroup]; return !g || g.visible; });
        const things = lamps.concat(den.book.pickables, den.groups.wallS.visible ? den.stereo.pickables.concat(den.tv.pickables) : []);
        const hit = raycaster.intersectObjects(things, false)[0];
        if (!hit) return null;
        const nearer = raycaster.intersectObjects([slab, den.table.group].filter(Boolean), true)[0];
        if (nearer && nearer.distance < hit.distance) return null;
        if (hit.object.userData.focusLamp) return "lamp";
        if (hit.object.userData.book) return "book";
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
        if (typeof document !== "undefined") document.documentElement.classList.remove("ec-tv-visit");
        setCommercialOn(false);
        if (tvHint) { tvHint.remove(); tvHint = null; }
        if (lookListenersOn) {
          lookListenersOn.removeEventListener("pointerdown", onLookDown, true);
          lookListenersOn.removeEventListener("pointerup", onLookUp, true);
          window.removeEventListener("keydown", onLookKey, true);
          lookListenersOn = null;
        }
        if (typeof window !== "undefined") { window.__DEN_ROOM__ = false; delete window.__DEN_THREE__; delete window.__DEN_STEREO__; delete window.__DEN_TV__; delete window.__DEN_TV_PRESS__; }
      },
    };
    /* After the chassis has set its camera: blend it toward the view of
       the console, the set or the book (placeCamera); then the set's
       stirring is heard from where the camera ended up. */
    api.cameraOverride = (camera, dtMs) => {
      const placed = api.placeCamera(camera, dtMs);
      hearTv(camera);
      return placed;
    };
    return api;
  };
}
