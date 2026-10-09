/* Plano's scene life: the city round the board (plano-city.js), the fog
   that lets the sheet run out to nothing, and the red pencil.

   - The city hangs on the chassis's boardGroup, so it turns with the
     board, and is laid out again whenever the board changes size.
   - The fog is the sheet's own blue, kept a little beyond the board
     wherever the camera is, so the far city fades without ever touching
     the game.
   - Red pencil: when a piece comes to rest on a new square, a quick
     circle is sketched round it on the board, as a checker marks a
     drawing, and fades.

   All of it rebuilds or disposes cleanly; nothing here touches play. */

import * as THREE from "three";
import { SLAB_X, SLAB_Z, SQUARE_SIZE, OFF_X, OFF_Z } from "../engine/constants.js";
import { buildCity } from "./plano-city.js";
import { quality } from "./tienda-quality.js";
import { PLAY } from "./plano.js";

const PAPER = 0x1d4c8a;
const FONTS = {
  hand: "'Architects Daughter', 'DejaVu Sans Mono', monospace",
  mono: "'IBM Plex Mono', 'DejaVu Sans Mono', monospace",
};

// A pencil circle, drawn twice round and not quite closed, as by hand.
let PENCIL_TEX = null;
function pencilTexture() {
  if (PENCIL_TEX) return PENCIL_TEX;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d");
  x.strokeStyle = "#ff8f73"; x.lineCap = "round"; x.lineJoin = "round";
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let pass = 0; pass < 2; pass++) {
    x.lineWidth = pass ? 7 : 10; x.globalAlpha = pass ? 0.75 : 0.95;
    x.beginPath();
    const a0 = -0.6 + pass * 0.4, a1 = a0 + Math.PI * 2 * (1.04 + pass * 0.06);
    for (let k = 0; k <= 72; k++) {
      const a = a0 + ((a1 - a0) * k) / 72, r = 104 - pass * 6 + Math.sin(a * 3 + pass) * 3 + (rnd() - 0.5) * 2.2;
      const px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r * 0.97;
      k ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  PENCIL_TEX = new THREE.CanvasTexture(c);
  return PENCIL_TEX;
}

export function mountAmbientEffects(refs, { three }) {
  const Q = quality();
  let city = null, dims = "", attachedTo = null, fog = null;
  const marks = [];
  const lastPos = new Map();
  const camLocal = new THREE.Vector3();
  let fontsAsked = false;

  let shade = null;
  function build(t) {
    if (city) { city.group.parent && city.group.parent.remove(city.group); city.dispose(); city = null; }
    // the pieces' shadows on the unlit board: a layer that draws only shadow
    if (shade) { shade.parent && shade.parent.remove(shade); shade.geometry.dispose(); shade.material.dispose(); }
    shade = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_X, SLAB_Z), new THREE.ShadowMaterial({ color: 0x08183a, opacity: 0.32, depthWrite: false }));
    shade.rotation.x = -Math.PI / 2; shade.position.y = 0.0015; shade.receiveShadow = true; shade.renderOrder = 1; shade.raycast = () => {}; shade.name = "plano-shadows";
    t.boardGroup.add(shade);
    city = buildCity({ EX: SLAB_X / 2, EZ: SLAB_Z / 2, sq: SQUARE_SIZE, gx: OFF_X, gz: OFF_Z, renderer: t.renderer, tier: Q.tier, fonts: FONTS });
    t.boardGroup.add(city.group);
    dims = `${SLAB_X}x${SLAB_Z}`;
    if (!fontsAsked && typeof document !== "undefined" && document.fonts && document.fonts.load) {
      fontsAsked = true;
      // the plan's lettering, once its faces have arrived
      Promise.all([document.fonts.load("40px 'Architects Daughter'"), document.fonts.load("600 40px 'IBM Plex Mono'")])
        .then(() => { if (city) city.redraw(); })
        .catch(() => {});
    }
  }

  function attach() {
    const t = three.current;
    if (!t || !t.boardGroup || !t.scene) return false;
    if (attachedTo !== t.boardGroup) { attachedTo = t.boardGroup; dims = ""; }
    if (dims !== `${SLAB_X}x${SLAB_Z}`) build(t);
    if (!fog || t.scene.fog !== fog) { fog = new THREE.Fog(PAPER, 30, 90); t.scene.fog = fog; }
    return true;
  }

  function spawnMark(x, z, size) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: pencilTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 })
    );
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * Math.PI * 2;
    const s = size * 2.2 + 0.5; m.scale.set(s, s, 1);
    m.position.set(x, 0.035, z); m.renderOrder = 3;
    attachedTo.add(m);
    marks.push({ m, born: performance.now(), s });
  }

  // Pieces come to rest somewhere new (as Cromo's landings): a piece whose
  // place changed and then held still a few frames; many at once is a new
  // board or an undo, not a landing.
  function watchLandings() {
    const t = three.current;
    if (!t || !t.pieceGroup) return;
    const changed = [];
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const id = o.userData.pieceId, key = `${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`;
      const rec = lastPos.get(id);
      if (!rec) { lastPos.set(id, { key, still: 99, pending: false }); return; }
      if (rec.key !== key) { changed.push(rec); rec.key = key; rec.still = 0; rec.pending = true; }
      else if (rec.pending && ++rec.still === 4) {
        rec.pending = false;
        if (!rec.bulk) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          spawnMark(o.position.x, o.position.z, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
        }
      }
    });
    const bulk = changed.length > 2;
    changed.forEach((rec) => { rec.bulk = bulk; });
  }

  return {
    armOnBegin() { attach(); },
    restart() {},
    tick(now) {
      if (!attach()) return;
      const t = three.current;
      // the fog keeps its distance from wherever the camera is
      if (t.camera) {
        const d = t.camera.position.length();
        fog.near = d + 6; fog.far = d + 70;
        camLocal.copy(t.camera.position); t.boardGroup.worldToLocal(camLocal);
      }
      city.tick(now / 1000, t.camera ? camLocal : null);
      watchLandings();
      // the piece picked up is lined and washed in red pencil
      if (t.pieceGroup) t.pieceGroup.children.forEach((o) => {
        if (!o.userData || !o.material || !o.material.color) return;
        const picked = o.userData.pieceId != null && o.userData.pieceId === PLAY.selectedId;
        if (o.userData.kind === "shell") {
          const want = picked ? 0xff7a5c : o.userData.isDark ? 0xeef6ff : 0x0f2a52;
          if (o.material.color.getHex() !== want) o.material.color.setHex(want);
        } else if (o.userData.kind === "piece" && o.material.emissive) {
          const want = picked ? 0x5a1c10 : 0x000000;
          if (o.material.emissive.getHex() !== want) o.material.emissive.setHex(want);
        }
      });
      for (let i = marks.length - 1; i >= 0; i--) {
        const k = marks[i], u = (now - k.born) / 2200;
        if (u >= 1) { k.m.parent && k.m.parent.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); marks.splice(i, 1); continue; }
        k.m.material.opacity = u < 0.12 ? u / 0.12 : u > 0.55 ? 1 - (u - 0.55) / 0.45 : 1;
        const g = 0.92 + 0.1 * Math.min(1, u * 4); k.m.scale.set(k.s * g, k.s * g, 1);
      }
    },
    dispose() {
      marks.forEach((k) => { k.m.parent && k.m.parent.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); });
      marks.length = 0;
      if (city) { city.group.parent && city.group.parent.remove(city.group); city.dispose(); city = null; }
      if (shade) { shade.parent && shade.parent.remove(shade); shade.geometry.dispose(); shade.material.dispose(); shade = null; }
      const t = three.current;
      if (t && t.scene && t.scene.fog === fog) t.scene.fog = null;
    },
  };
}
