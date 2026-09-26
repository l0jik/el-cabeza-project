/* Theme Lab: what a design direction adds around the play, frame by
   frame. The chassis calls mountAmbientEffects once, after it has built
   the scene, and its tick every frame; nothing here changes the game.

     - the ground: the composition the board is set into
     - selection and hover: each direction marks a chosen piece its own
       way (the chassis itself only shows its moves)
     - landing and capture: a short mark where a piece comes to rest, or
       where one was taken
     - Neo-Brutalism's hard offset shadow under every piece
     - the renderer's tone mapping and exposure, per direction (the flat
       graphic directions want their whites white) */

import * as THREE from "three";
import { SQUARE_SIZE } from "../../engine/constants.js";
import { repaintWhenFontsReady } from "./paint.js";

const hex = (css) => new THREE.Color(css).getHex();

export function createAmbient(spec, scene, live) {
  const C = spec.colors;

  return function mountAmbientEffects(refs, { three }) {
    const t = three.current;
    const disposers = [];
    const renderer = t.renderer;
    const prevTone = renderer.toneMapping, prevExp = renderer.toneMappingExposure;
    const L = spec.lighting;
    renderer.toneMapping = L.toneMapping === "none" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = L.exposure ?? 1;

    // Board, ground and piece marks were painted at once; paint them
    // again in the direction's own faces when those have arrived.
    let alive = true;
    repaintWhenFontsReady(spec).then(() => { if (!alive) return; });
    disposers.push(() => { alive = false; });

    const ground = scene.buildGround();
    t.scene.add(ground);
    disposers.push(() => { t.scene.remove(ground); ground.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) { if (o.material.map && !o.material.map.__shared) o.material.map.dispose(); o.material.dispose(); } }); });

    const fx = new THREE.Group();
    fx.name = `lab-${spec.id}-fx`;
    t.scene.add(fx);

    /* ---------- marker shapes: built for a footprint of w x d */
    const flat = (boxes, color, opacity = 1, y = 0.06) => {
      const g = scene.boxesGeometry(boxes.map((b) => ({ h: 0, y: 0, ...b })));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.position.y = y;
      return m;
    };
    const frame = (w, d, th, color, opacity, y, pad = 0.06) => {
      const W = w / 2 + pad, D = d / 2 + pad;
      return flat([
        { x: 0, z: -D + th / 2, w: W * 2, d: th }, { x: 0, z: D - th / 2, w: W * 2, d: th },
        { x: -W + th / 2, z: 0, w: th, d: D * 2 }, { x: W - th / 2, z: 0, w: th, d: D * 2 },
      ], color, opacity, y);
    };
    const corners = (w, d, th, len, color, opacity, y, pad = 0.07) => {
      const W = w / 2 + pad, D = d / 2 + pad, b = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        b.push({ x: sx * (W - len / 2), z: sz * (D - th / 2), w: len, d: th }, { x: sx * (W - th / 2), z: sz * (D - len / 2), w: th, d: len });
      });
      return flat(b, color, opacity, y);
    };

    function buildSelection(kind, w, d, hover) {
      const g = new THREE.Group();
      const a = hover ? 0.45 : 1;
      const add = (m) => { g.add(m); return m; };
      switch (kind) {
        case "redFrame": add(frame(w, d, 0.035, hex(C.accentPrimary), a, 0.058)); break;
        case "yellowDisc": {
          const r = Math.min(w, d) * 0.5 + 0.14;
          const m = new THREE.Mesh(new THREE.CircleGeometry(r, 56), new THREE.MeshBasicMaterial({ color: hex(C.accentTertiary), transparent: true, opacity: 0.9 * a, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.position.y = 0.057; add(m);
          break;
        }
        case "yellowField":
          add(flat([{ x: 0, z: 0, w: w + 0.16, d: d + 0.16 }], 0x0e0e0e, a, 0.055));
          add(flat([{ x: 0, z: 0, w: w + 0.06, d: d + 0.06 }], hex(C.accentTertiary), a, 0.057));
          break;
        case "diagonalFrame": {
          const f = frame(w * 0.9, d * 0.9, 0.03, hex(C.accentPrimary), a, 0.058, 0.12);
          f.rotation.y = Math.PI / 4; add(f);
          add(flat([{ x: 0, z: 0, w: Math.hypot(w, d) * 1.2, d: 0.02 }], hex(C.accentPrimary), a * 0.7, 0.057)).rotation.y = -Math.PI / 4;
          break;
        }
        case "hardFrame":
          add(frame(w, d, 0.09, 0x111111, a, 0.057, 0.1)).position.set(0.07, 0.056, 0.07);
          add(frame(w, d, 0.09, hex(C.accentSecondary), a, 0.058, 0.1));
          break;
        case "redUnderline":
          add(flat([{ x: 0, z: d / 2 + 0.12, w: w + 0.2, d: 0.07 }], hex(C.accentPrimary), a, 0.058));
          add(flat([{ x: 0, z: -d / 2 - 0.1, w: w + 0.2, d: 0.018 }], 0x141210, a, 0.058));
          break;
        case "yellowBrackets": add(corners(w, d, 0.035, Math.min(w, d) * 0.34, hex(C.accentPrimary), a, 0.058)); break;
        case "popFrame":
          add(frame(w, d, 0.08, 0x000000, a, 0.056, 0.1)).position.set(0.09, 0.055, 0.09);
          add(frame(w, d, 0.08, 0x000000, a, 0.057, 0.1));
          add(frame(w, d, 0.05, hex(C.accentSecondary), a, 0.058, 0.085));
          break;
        case "quietCorners": add(corners(w, d, 0.012, 0.09, 0x000000, 0.7 * a, 0.058, 0.09)); break;
        case "machineFrame": {
          add(frame(w, d, 0.08, 0x1a1a1a, a, 0.056, 0.11));
          const W = w / 2 + 0.11, stripes = [];
          for (let x = -W; x < W; x += 0.16) stripes.push({ x: x + 0.04, z: -(d / 2 + 0.11) + 0.04, w: 0.07, d: 0.08 }, { x: x + 0.04, z: d / 2 + 0.11 - 0.04, w: 0.07, d: 0.08 });
          add(flat(stripes, hex(C.accentSecondary), a, 0.058));
          add(flat([{ x: -W - 0.06, z: 0, w: 0.06, d: d * 0.6 }], hex(C.accentPrimary), a, 0.058));
          break;
        }
        default: add(frame(w, d, 0.03, hex(C.accentPrimary), a, 0.058));
      }
      return g;
    }

    /* Footprint of a piece mesh on the board: world centre and w x d. */
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    function footprint(mesh) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      box.makeEmpty();
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(v);
      }
      return { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, w: box.max.x - box.min.x, d: box.max.z - box.min.z, h: box.max.y };
    }
    const snap = (n) => Math.round(n / SQUARE_SIZE) * SQUARE_SIZE;

    const markers = { select: null, hover: null };
    const markerCache = new Map();
    function markerFor(which, w, d) {
      const key = `${which}:${snap(w).toFixed(2)}x${snap(d).toFixed(2)}`;
      if (!markerCache.has(key)) {
        const m = buildSelection(spec.selection, Math.max(SQUARE_SIZE * 0.6, snap(w) - 0.1), Math.max(SQUARE_SIZE * 0.6, snap(d) - 0.1), which === "hover");
        m.visible = false; fx.add(m);
        markerCache.set(key, m);
      }
      return markerCache.get(key);
    }

    /* ---------- landing, capture */
    const bursts = [];
    function burst(kind, fp, color) {
      if (!kind) return;
      const g = new THREE.Group();
      g.position.set(fp.x, 0, fp.z);
      const w = Math.max(SQUARE_SIZE * 0.8, snap(fp.w)), d = Math.max(SQUARE_SIZE * 0.8, snap(fp.d));
      let upd = () => {};
      const mats = [];
      const reg = (m) => { m.traverse((o) => o.material && mats.push(o.material)); g.add(m); return m; };
      if (kind === "tick") reg(frame(w - 0.1, d - 0.1, 0.03, color ?? hex(C.accentPrimary), 1, 0.058, 0.02));
      else if (kind === "ring" || kind === "capture") {
        const r = Math.max(w, d) * 0.5;
        const m = reg(new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 56), new THREE.MeshBasicMaterial({ color: color ?? hex(C.accentTertiary || C.accentPrimary), transparent: true, depthWrite: false })));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.058;
        upd = (k) => m.scale.setScalar(1 + k * 0.7);
      } else if (kind === "depress") {
        reg(flat([{ x: 0, z: 0, w: w + 0.08, d: d + 0.08 }], 0x000000, 0.3, 0.055));
        const f = reg(frame(w - 0.08, d - 0.08, 0.05, 0x0e0e0e, 1, 0.056, 0.02));
        upd = (k) => f.scale.setScalar(1 - 0.06 * Math.sin(Math.min(1, k * 2) * Math.PI));
      } else if (kind === "streak") {
        const m = reg(flat([{ x: 0, z: 0, w: Math.hypot(w, d) * 1.5, d: 0.05 }], hex(C.accentPrimary), 1, 0.058));
        m.rotation.y = Math.PI / 4;
        upd = (k) => { m.scale.x = 0.3 + k * 1.2; };
      } else if (kind === "dust") {
        const n = 18, pts = [];
        for (let i = 0; i < n; i++) {
          const s = 0.03 + Math.random() * 0.05;
          const q = reg(flat([{ x: 0, z: 0, w: s, d: s }], 0x6a6660, 0.9, 0.058));
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
          pts.push([q, Math.cos(a), Math.sin(a)]);
        }
        upd = (k) => pts.forEach(([q, cx, cz]) => q.position.set(cx * (w / 2 + k * 0.5), 0.058, cz * (d / 2 + k * 0.5)));
      } else if (kind === "inkBlot") {
        reg(flat([{ x: 0, z: d / 2 + 0.1, w, d: 0.08 }], hex(C.accentPrimary), 1, 0.058));
      } else if (kind === "scan") {
        const m = reg(flat([{ x: 0, z: 0, w: w + 0.2, d: 0.03 }], hex(C.accentPrimary), 1, 0.058));
        upd = (k) => { m.position.z = -d / 2 + k * d; };
      } else if (kind === "pop") {
        const m = reg(frame(w - 0.1, d - 0.1, 0.07, 0x000000, 1, 0.058, 0.02));
        upd = (k) => m.scale.setScalar(1 + 0.25 * Math.sin(Math.min(1, k * 1.6) * Math.PI));
      } else if (kind === "clamp") {
        const parts = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([sx, sz]) => {
          const q = reg(flat([{ x: 0, z: 0, w: sz ? w * 0.5 : 0.08, d: sx ? d * 0.5 : 0.08 }], hex(C.accentSecondary), 1, 0.058));
          parts.push([q, sx, sz]);
        });
        upd = (k) => { const e = Math.sin(Math.min(1, k * 1.4) * Math.PI); parts.forEach(([q, sx, sz]) => q.position.set(sx * (w / 2 + 0.3 - e * 0.22), 0.058, sz * (d / 2 + 0.3 - e * 0.22))); };
      }
      fx.add(g);
      bursts.push({ g, mats, upd, born: performance.now(), dur: kind === "capture" ? 900 : 620 });
    }

    /* ---------- Neo-Brutalism: hard shadows under every piece */
    const hardShadows = new Map();
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false });
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);

    /* ---------- tracking the piece meshes */
    const lastMesh = new Map(); // pieceId -> { mesh, fp }
    let lastSig = "";
    let armed = false;

    function tick(now) {
      const game = live.game;
      const group = t.pieceGroup;
      if (!group) return;
      const meshes = new Map();
      group.children.forEach((o) => { if (o.userData && o.userData.kind === "piece") meshes.set(o.userData.pieceId, o); });

      // Selection and hover.
      const sel = game && game.selectedId;
      const hov = game && game.hoveredId !== sel ? game.hoveredId : null;
      [["select", sel], ["hover", hov]].forEach(([which, id]) => {
        const m = id && meshes.get(id);
        const prev = markers[which];
        if (!m) { if (prev) prev.visible = false; markers[which] = null; return; }
        const fp = footprint(m);
        const marker = markerFor(which, fp.w, fp.d);
        if (prev && prev !== marker) prev.visible = false;
        marker.visible = true;
        marker.position.set(fp.x, 0, fp.z);
        markers[which] = marker;
      });

      // Landings and captures: a piece whose mesh was rebuilt has landed
      // somewhere new; one whose id is gone was taken.
      const sig = [...meshes.keys()].sort().join(",");
      meshes.forEach((m, id) => {
        const prev = lastMesh.get(id);
        if (armed && prev && prev.mesh !== m) {
          const fp = footprint(m);
          if (Math.abs(fp.x - prev.fp.x) > 0.01 || Math.abs(fp.z - prev.fp.z) > 0.01) burst(spec.landing, fp);
        }
        if (!prev || prev.mesh !== m) lastMesh.set(id, { mesh: m, fp: footprint(m) });
      });
      if (sig !== lastSig) {
        lastMesh.forEach((entry, id) => {
          if (!meshes.has(id)) {
            if (armed && game && game.status === "playing") burst("capture", entry.fp, hex(C.accentPrimary));
            lastMesh.delete(id);
          }
        });
        lastSig = sig;
      }
      armed = true;

      if (spec.pieces.hardShadow) {
        meshes.forEach((m, id) => {
          let s = hardShadows.get(id);
          if (!s) { s = new THREE.Mesh(shadowGeo, shadowMat); fx.add(s); hardShadows.set(id, s); }
          const fp = footprint(m);
          const lift = Math.max(0, fp.h - 0.8);
          s.scale.set(fp.w * 0.98, 1, fp.d * 0.98);
          s.position.set(fp.x + 0.12 + lift * 0.1, 0.053, fp.z + 0.12 + lift * 0.1);
        });
        hardShadows.forEach((s, id) => { if (!meshes.has(id)) { fx.remove(s); hardShadows.delete(id); } });
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        const k = (now - b.born) / b.dur;
        if (k >= 1) { fx.remove(b.g); b.g.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }); bursts.splice(i, 1); continue; }
        b.upd(k);
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        b.mats.forEach((m) => { if (m.userData.base === undefined) m.userData.base = m.opacity; m.opacity = m.userData.base * fade; });
      }
    }

    return {
      armOnBegin() {},
      restart() {},
      tick,
      dispose() {
        renderer.toneMapping = prevTone; renderer.toneMappingExposure = prevExp;
        disposers.forEach((d) => d());
        t.scene.remove(fx);
        fx.traverse((o) => { if (o.geometry && o.geometry !== shadowGeo) o.geometry.dispose(); if (o.material && o.material !== shadowMat) o.material.dispose(); });
        shadowGeo.dispose(); shadowMat.dispose();
      },
    };
  };
}
