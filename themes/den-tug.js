/* The set taking the player, before the rush (den-fx.js startTugs; user:
   "Getting pulled into the TV against your will, it happens way too
   abruptly ... We need to come up with something else there"; of the
   options, "Combine 1 & 2": two warning tugs, then it takes you, and the
   room goes first).

   The timeline (TUG, ms from when the pull's due):
   - 0: the first tug. The view lurches at the set and snaps back, a
     thump in the dead tube; the papers on the coffee table shiver and
     slide a little its way.
   - 1400: the thought, "Did the TV just… pull me?" (one of the den's
     cards).
   - 4200: the second, harder, held a moment longer. The papers lift off
     the table one after another and fly into the glass, the Big Glutts
     circular last.
   - 6400: "Uh-oh…"
   - 6900: the third doesn't let go. The records go (the sleeve off the
     console, the one on the floor), then the newspaper, and the view is
     dragged across the room toward the set, catching twice as if it
     grabbed hold of something, shaking harder and harder.
   - 9500: the rush (den-fx.js startPull: the yell, the lens, the stretch,
     the dark closing in, Nova's way in at the glass), the drag going on
     into it.

   tugAt(ms) is the camera's part (how far toward the screen, 0 to 1 of
   the way, and how hard it shakes); createTugDebris the loose things,
   there in the room while the set lures, and gone into it. Den-local
   coordinates throughout (the den's group, which turns with the board). */

import * as THREE from "three";
import { tr } from "../chassis/i18n.js";
import { canvasTexture, repaint } from "./tienda-textures.js";
import { PIT_FLOOR, FLOOR, RZ } from "./den-room.js";

export const TUG = { tug1: 0, think: 1400, tug2: 4200, uhoh: 6400, drag: 6900, rush: 9500 };
export const TUG_THINK = "Did the TV just… pull me?";
export const TUG_UHOH = "Uh-oh…";
const DRAG_MS = TUG.rush - TUG.drag;

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const smooth = (u) => u * u * (3 - 2 * u);
// A hump over [c - w, c + w], 1 at c.
const bump = (u, c, w) => { const x = (u - c) / w; return Math.abs(x) >= 1 ? 0 : Math.cos((x * Math.PI) / 2) ** 2; };
// A tug: yanked toward the set (rise ms) and let go, springing back a
// little past where it was.
function tug(x, rise, peak, tau, period) {
  if (x < 0) return 0;
  if (x < rise) return peak * easeOut(x / rise);
  const y = x - rise;
  return peak * Math.exp(-y / tau) * Math.cos((2 * Math.PI * y) / period);
}

// The camera at `ms` into the build-up: { lurch, shake }.
export function tugAt(ms) {
  let lurch = tug(ms - TUG.tug1, 110, 0.09, 280, 760) + tug(ms - TUG.tug2, 150, 0.17, 380, 900);
  let shake = (ms >= TUG.tug1 ? 0.45 * Math.exp(-(ms - TUG.tug1) / 300) : 0) + (ms >= TUG.tug2 ? 0.75 * Math.exp(-(ms - TUG.tug2) / 380) : 0);
  if (ms >= TUG.drag) {
    // The third: at once, then dragged faster and faster, catching twice;
    // and on into the rush still gaining (v past 1), so the rush takes over
    // a view already on its way in, not one stopped dead (user: the last
    // part "happens too abruptly"), for a while at most.
    const d = ms - TUG.drag, u = clamp01(d / DRAG_MS), v = Math.min(d / DRAG_MS, 1.6);
    lurch += 0.1 * easeOut(clamp01(d / 140)) + 0.32 * v * v - 0.055 * bump(u, 0.36, 0.09) - 0.05 * bump(u, 0.7, 0.08);
    shake += 0.35 + 0.55 * u + 0.35 * bump(u, 0.36, 0.06) + 0.3 * bump(u, 0.7, 0.06);
  }
  return { lurch, shake: Math.min(1.2, shake) };
}

/* ---- the loose things ---- */

// Paper, lit by the room's own lights (the set's glow as they pass it).
function paperMat(map, disposables) {
  const m = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  disposables.push(m);
  return m;
}
// A sheet w x h lying flat (facing up), curled a little along its length.
function sheet(w, h, curl, disposables) {
  const g = new THREE.PlaneGeometry(w, h, 6, 6).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2); p.setY(i, curl * x * x); }
  g.computeVertexNormals();
  disposables.push(g);
  return g;
}
const draw = (w, h, paint) => canvasTexture(w, h, (g, W, H) => { g.setTransform(W / w, 0, 0, H / h, 0, 0); paint(g); }, { scale: false });

// A score sheet torn off a pad: the game's name, two columns, pencil.
const scoreSheet = (seed) => draw(256, 334, (g) => {
  g.fillStyle = "#F1EAD6"; g.fillRect(0, 0, 256, 334);
  g.fillStyle = "#A8321F"; g.font = "700 22px 'Bodoni Moda', Georgia, serif"; g.textAlign = "center";
  g.fillText("EL CABEZA", 128, 34);
  g.font = "600 11px 'Libre Franklin', Arial, sans-serif"; g.fillText("SCORE  ·  GAME No. ____", 128, 52);
  g.strokeStyle = "rgba(60,90,140,0.55)"; g.lineWidth = 1;
  for (let y = 70; y < 320; y += 18) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); }
  g.strokeStyle = "rgba(168,50,31,0.6)"; g.beginPath(); g.moveTo(128, 62); g.lineTo(128, 322); g.stroke();
  g.fillStyle = "#3A3A3A"; g.font = "italic 15px Georgia, serif"; g.textAlign = "left";
  g.fillText(tr("Me"), 46, 84); g.fillText(tr(seed % 2 ? "Uncle Rob" : "Walnut"), 150, 84);
  // Tallies in pencil.
  let r = seed;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  g.strokeStyle = "rgba(50,50,50,0.75)"; g.lineWidth = 1.6;
  for (let row = 0; row < 7; row++) for (const x0 of [30, 150]) {
    const n = 1 + Math.floor(rnd() * 5), y = 96 + row * 18;
    for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x0 + i * 7, y); g.lineTo(x0 + i * 7 + 2, y + 12); g.stroke(); }
    if (n === 5) { g.beginPath(); g.moveTo(x0 - 3, y + 9); g.lineTo(x0 + 32, y + 2); g.stroke(); }
  }
});
// The Big Glutts circular the box came home with.
const circular = () => draw(512, 400, (g) => {
  g.fillStyle = "#EDE6D2"; g.fillRect(0, 0, 512, 400);
  g.fillStyle = "#B4261C"; g.fillRect(0, 0, 512, 92);
  g.fillStyle = "#F6C431"; g.fillRect(0, 92, 512, 10);
  g.fillStyle = "#FFF1C8"; g.font = "900 54px 'Libre Franklin', Arial, sans-serif"; g.textAlign = "center";
  g.fillText("BIG GLUTTS", 256, 64);
  g.fillStyle = "#B4261C"; g.font = "800 30px 'Libre Franklin', Arial, sans-serif"; g.fillText(tr("FALL SAVINGS!"), 256, 142);
  const blocks = [["Toaster", "$11.88"], ["Lava lamp", "$8.99"], ["Fondue set", "$6.49"], ["EL CABEZA", "$7.97"]];
  blocks.forEach(([name, price], i) => {
    const x = 26 + (i % 2) * 238, y = 166 + Math.floor(i / 2) * 112;
    g.fillStyle = i === 3 ? "#F6C431" : "#D9CFB4"; g.fillRect(x, y, 222, 98);
    g.fillStyle = "#2A2420"; g.font = "700 22px 'Libre Franklin', Arial, sans-serif"; g.textAlign = "left"; g.fillText(tr(name), x + 12, y + 34);
    g.fillStyle = "#B4261C"; g.font = "900 34px 'Libre Franklin', Arial, sans-serif"; g.fillText(price, x + 12, y + 80);
  });
});
// The evening paper, folded.
const newspaper = () => draw(300, 400, (g) => {
  g.fillStyle = "#E4DFD2"; g.fillRect(0, 0, 300, 400);
  g.fillStyle = "#1E1E1E"; g.font = "700 30px 'Bodoni Moda', Georgia, serif"; g.textAlign = "center";
  g.fillText("The Evening Star", 150, 40);
  g.fillRect(14, 50, 272, 2); g.fillRect(14, 56, 272, 1);
  g.font = "800 21px Georgia, serif"; g.fillText(tr("STRANGE SIGNALS"), 150, 86); g.fillText(tr("ON CHANNEL 3"), 150, 110);
  g.fillStyle = "#9A968C"; g.fillRect(18, 124, 128, 92);
  g.fillStyle = "rgba(30,30,30,0.55)";
  for (let col = 0; col < 2; col++) for (let y = col ? 124 : 224; y < 388; y += 8) g.fillRect(col ? 156 : 18, y, 126 - (y % 40 === 0 ? 30 : 0), 3);
});
// Another record's sleeve, off the floor by the console.
const sleeveArt = () => draw(256, 256, (g) => {
  const bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, "#1C2B4A"); bg.addColorStop(1, "#3E1F4A");
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#F3E3B0"; g.beginPath(); g.arc(178, 84, 38, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1C2B4A"; g.beginPath(); g.arc(194, 74, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#F3E3B0"; g.font = "italic 700 26px 'Bodoni Moda', Georgia, serif"; g.textAlign = "left";
  g.fillText("Moonlight", 22, 196); g.fillText("Lounge", 22, 228);
});

/* `den`: the built room (den-room.js buildDen): its group, TW, the set
   (tv.dive.target, the glass) and the console (stereo.sleeve, the record
   sleeve on top). Returns { rustle(now), launch(now, wave), frame(now,
   onIn), put back(), state(), dispose() }. */
export function createTugDebris(den) {
  const disposables = [];
  const TW = den.TW, topY = -0.375 + 0.03;
  const mid = TW / 2 - 3.7;
  const items = [];
  const add = (id, wave, delay, mesh, flight) => {
    mesh.name = `den-tug-${id}`;
    mesh.castShadow = false; mesh.receiveShadow = true;
    den.group.add(mesh);
    const seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
    items.push({ id, seed, wave, delay, mesh, flight, own: true, phase: "rest", t0: 0, home: { p: mesh.position.clone(), q: mesh.quaternion.clone(), s: mesh.scale.clone() }, from: new THREE.Vector3(), q0: new THREE.Quaternion(), axis: new THREE.Vector3(), turns: 0, c1: new THREE.Vector3(), c2: new THREE.Vector3(), nudge: new THREE.Vector3() });
  };
  const texes = [];
  const flat = (geo, tex, x, y, z, yaw) => {
    disposables.push(tex); texes.push(tex);
    const m = new THREE.Mesh(geo, paperMat(tex, disposables));
    m.position.set(x, y, z); m.rotation.y = yaw;
    return m;
  };
  // Two score sheets beside the board (the stereo's side), the circular
  // on the far side, the paper on the pit's floor by the table.
  add("score-a", "tug2", 0, flat(sheet(4.3, 5.6, 0.08, disposables), scoreSheet(3), mid + 0.1, topY, 1.1, -0.3), 1150);
  add("score-b", "tug2", 170, flat(sheet(4.3, 5.6, 0.1, disposables), scoreSheet(8), mid - 0.5, topY + 0.012, -2.5, 0.35), 1250);
  add("circular", "tug2", 380, flat(sheet(7, 5.5, 0.12, disposables), circular(), -1.5, topY, TW / 2 - 3.4, 0.12), 1250);
  add("newspaper", "drag", 520, flat(sheet(7, 9.5, 0.3, disposables), newspaper(), -(TW / 2 + 4.5), PIT_FLOOR + 0.06, -3, 0.6), 1500);
  add("sleeve-floor", "drag", 1050, flat(sheet(6.3, 6.3, 0, disposables), sleeveArt(), 24, FLOOR + 0.06, RZ - 18, 0.4), 1250);
  // The console's own sleeve (the record that's on): taken over, its
  // place on the console kept to put it back.
  const sl = den.stereo && den.stereo.sleeve;
  if (sl) {
    const home = { parent: sl.parent, p: sl.position.clone(), q: sl.quaternion.clone(), s: sl.scale.clone() };
    den.group.attach(sl);
    add("sleeve-console", "drag", 150, sl, 1200);
    const it = items[items.length - 1];
    it.own = false; it.console = home;
  }

  const glass = new THREE.Vector3().copy(den.tv.dive.target);
  const front = new THREE.Vector3().copy(glass).add(new THREE.Vector3(0, 1.5, -14));
  const toward = new THREE.Vector3(), side = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion();
  let rustleAt = 0;

  // A bit of each: different every time, the same for one item.
  const R = (it, k) => { const s = Math.sin((it.seed * 12.9898 + k * 78.233) * 43758.5453); return s - Math.floor(s); };

  function rustle(now) {
    rustleAt = now;
    items.forEach((it) => {
      if (it.phase !== "rest") return;
      // Toward the set, along the floor: a short slide.
      toward.copy(glass).sub(it.mesh.position); toward.y = 0; toward.normalize();
      it.nudge.copy(toward).multiplyScalar(it.wave === "tug2" ? 0.7 + 0.5 * R(it, 1) : 0.25);
      it.from.copy(it.mesh.position); it.q0.copy(it.mesh.quaternion);
      it.axis.set(-toward.z, 0, toward.x);
      it.phase = "rustle"; it.t0 = now;
    });
  }
  function launch(now, wave) {
    items.forEach((it) => {
      if (it.wave !== wave || it.phase === "flying" || it.phase === "in") return;
      if (it.phase === "rustle") settle(it);
      it.phase = "waiting"; it.t0 = now + it.delay;
    });
  }
  function settle(it) {
    it.mesh.position.copy(it.from).add(it.nudge);
    it.mesh.quaternion.copy(it.q0);
    it.phase = "rest";
  }
  function takeOff(it, now) {
    it.phase = "flying"; it.t0 = now;
    it.from.copy(it.mesh.position); it.q0.copy(it.mesh.quaternion);
    // Up off its place, then round to come at the glass from the front.
    side.set(R(it, 2) - 0.5, 0, R(it, 3) - 0.5).multiplyScalar(10);
    it.c1.copy(it.from).lerp(glass, 0.2).add(side); it.c1.y = it.from.y + 7 + 6 * R(it, 4);
    it.c2.copy(front); it.c2.x += (R(it, 5) - 0.5) * 6; it.c2.y += (R(it, 6) - 0.3) * 5;
    it.axis.set(R(it, 7) - 0.5, R(it, 8) - 0.5, R(it, 9) - 0.5).normalize();
    it.turns = 1.5 + 2 * R(it, 10);
  }
  function frame(now, onIn) {
    items.forEach((it) => {
      if (it.phase === "rustle") {
        const k = clamp01((now - it.t0) / 850);
        it.mesh.position.copy(it.from).addScaledVector(it.nudge, easeOut(k));
        it.mesh.position.y = it.from.y + 0.25 * Math.sin(Math.PI * clamp01(k * 1.6)) * (it.wave === "tug2" ? 1 : 0.4);
        tilt.setFromAxisAngle(it.axis, 0.32 * Math.sin(Math.PI * clamp01(k * 1.3)) * Math.exp(-2 * k));
        it.mesh.quaternion.copy(it.q0).premultiply(tilt);
        if (k >= 1) settle(it);
      } else if (it.phase === "waiting" && now >= it.t0) takeOff(it, now);
      if (it.phase !== "flying") return;
      const k = clamp01((now - it.t0) / it.flight), e = Math.pow(k, 1.7), u = 1 - e;
      // (Cubic: from where it lay, up and round, in at the glass.)
      it.mesh.position.copy(it.from).multiplyScalar(u * u * u)
        .addScaledVector(it.c1, 3 * u * u * e).addScaledVector(it.c2, 3 * u * e * e).addScaledVector(glass, e * e * e);
      q.setFromAxisAngle(it.axis, it.turns * Math.PI * 2 * e + 0.35 * Math.sin(now * 0.02 + it.delay));
      it.mesh.quaternion.copy(it.q0).premultiply(q);
      it.mesh.scale.copy(it.home.s).multiplyScalar(k > 0.72 ? 1 - 0.85 * smooth((k - 0.72) / 0.28) : 1);
      if (k >= 1) {
        it.phase = "in"; it.mesh.visible = false;
        if (onIn) onIn(it.id);
      }
    });
  }
  // Back as they were (Nova couldn't go after all: the lure on again).
  function putBack() {
    items.forEach((it) => {
      it.phase = "rest"; it.mesh.visible = true;
      it.mesh.position.copy(it.home.p); it.mesh.quaternion.copy(it.home.q); it.mesh.scale.copy(it.home.s);
    });
    rustleAt = 0;
  }
  return {
    rustle, launch, frame, putBack,
    // (Their lettering again once the den's fonts are here: den-fx.js.)
    repaint: () => texes.forEach(repaint),
    state: () => items.map((it) => ({ id: it.id, phase: it.phase })),
    rustling: (now) => !!rustleAt && now - rustleAt < 900,
    dispose() {
      items.forEach((it) => {
        if (it.own) { den.group.remove(it.mesh); return; }
        // (The console's sleeve back on the console, as it was.)
        const h = it.console;
        if (h && h.parent) { h.parent.add(it.mesh); it.mesh.position.copy(h.p); it.mesh.quaternion.copy(h.q); it.mesh.scale.copy(h.s); it.mesh.visible = true; }
      });
      disposables.forEach((d) => d && d.dispose && d.dispose());
    },
  };
}
