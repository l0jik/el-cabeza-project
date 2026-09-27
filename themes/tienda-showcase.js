/* The order form's pieces in the round: sample the wares.

   Every piece on the form has a photograph in the catalog's manner: the
   block in its wood, lit from the upper left, standing on the page with
   a soft shadow under it. Tap one and the piece itself comes up off the
   page, large, turning slowly under the store's lights. Drag it to turn
   it any way; try it in walnut or in olive ash (Dark's wood and
   Light's); tap outside it and it goes back into its photograph.

   The same pattern as Neon's MATTER models (piece-showcase.js, whose
   poses it shares): all the photographs come from one short-lived WebGL
   context, and the viewer holds its own context only while it's open.
   The wood is the board's wood (tienda.js woodMaterial): the same grain
   shader, colours and lacquer, and the same renderer settings as the
   game, so a piece looks the same here as on the table. */

import React from "react";
import * as THREE from "three";
import { makeRoundedBox, makePolycubeSmooth } from "../engine/geometry.js";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";
import { POSES } from "./piece-showcase.js";
import { woodMaterial, WOODS, EDGE_RADIUS, lights as STORE_LIGHTS } from "./tienda.js";

const h = React.createElement;
// The form offers the small Arco.
const POSE_OF = { arco: "arcoChico" };
const poseKey = (type) => POSE_OF[type] || type;
export const hasWoodShowcase = (type) => !!POSES[poseKey(type)];

// The angle the photograph is taken from; the viewer opens at the same
// one, so the piece leaves the page without a jump.
const START_AZ = 0.62, START_EL = 0.46;

let shadowTex = null;
function contactShadow() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  r.addColorStop(0, "rgba(30,18,8,0.55)"); r.addColorStop(0.5, "rgba(30,18,8,0.2)"); r.addColorStop(1, "rgba(30,18,8,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/* The piece in its wood, and its shadow on the page. Returns the group,
   its radius (for framing), setWood(isDark) and dispose(). */
function buildWoodModel(type, isDark) {
  const pose = POSES[poseKey(type)];
  const group = new THREE.Group();
  let geo;
  if (pose.disc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2;
    geo = new THREE.CylinderGeometry(r, r, DISC_H * CABEZA_SCALE, 72);
  } else if (pose.vox) {
    geo = makePolycubeSmooth({ ...pose, type: poseKey(type) }, PIECE_SCALE, EDGE_RADIUS);
  } else {
    geo = makeRoundedBox(pose.w * PIECE_SCALE, pose.z * PIECE_SCALE, pose.h * PIECE_SCALE, EDGE_RADIUS);
  }
  geo.computeBoundingBox();
  const centre = new THREE.Vector3();
  geo.boundingBox.getCenter(centre);
  geo.translate(-centre.x, -centre.y, -centre.z);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = new THREE.Vector3();
  bb.getSize(size);
  const mat = woodMaterial({ isDark, pieceId: `showcase-${type}` });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  const shadowMat = new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = bb.min.y - 0.005;
  const span = Math.max(size.x, size.z) * 1.7;
  shadow.scale.set(span, span, 1);
  group.add(shadow);
  return {
    group,
    shadow,
    radius: size.length() / 2,
    setWood(dark) {
      const w = dark ? WOODS.dark : WOODS.light, u = mat.userData.wood;
      if (!u) return;
      u.uWoodLight.value.set(w.light); u.uWoodDark.value.set(w.dark); u.uWoodStreak.value.set(w.streak); u.uRingFreq.value = w.ringFreq;
      if ("clearcoat" in mat) mat.clearcoat = w.gloss;
    },
    dispose() { geo.dispose(); mat.dispose(); shadow.geometry.dispose(); shadowMat.dispose(); },
  };
}

// The studio: the store's own lights at the store's own strengths (so
// walnut here is the walnut on the table), the key from the upper left
// as catalog photographs were lit.
function makeStage() {
  const L = STORE_LIGHTS;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(L.ambient.color, L.ambient.intensity));
  scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
  const key = new THREE.DirectionalLight(L.key.color, L.key.intensity); key.position.set(-3, 6, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(L.fill.color, L.fill.intensity); fill.position.set(5, 2, 3); scene.add(fill);
  const back = new THREE.DirectionalLight(L.back.color, L.back.intensity); back.position.set(2, 4, -5); scene.add(back);
  return scene;
}

function makeRenderer(canvas, px) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(px, px, false);
  // As the game's renderer (chassis/ElCabeza3D.jsx).
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  r.setClearColor(0x000000, 0);
  return r;
}

function aim(camera, radius, az, el) {
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.12;
  camera.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
  camera.lookAt(0, 0, 0);
}

/* ---------- the photographs ---------- */
const photos = new Map();
const PHOTO_PX = 176;

/* Makes the photographs for any of `types` not yet taken, in walnut, in
   one WebGL context released straight after. False without WebGL (the
   form then shows no photographs). */
export function ensureWoodPhotos(types) {
  const todo = types.filter((t) => hasWoodShowcase(t) && !photos.has(t));
  if (!todo.length) return true;
  let renderer = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PHOTO_PX;
    renderer = makeRenderer(canvas, PHOTO_PX);
    const scene = makeStage();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
    todo.forEach((type) => {
      const model = buildWoodModel(type, true);
      scene.add(model.group);
      aim(camera, model.radius, START_AZ, START_EL);
      renderer.render(scene, camera);
      photos.set(type, canvas.toDataURL("image/png"));
      scene.remove(model.group);
      model.dispose();
    });
    return true;
  } catch (e) {
    return false;
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
}
export const woodPhoto = (type) => photos.get(type) || null;

/* ---------- the viewer ---------- */
const OPEN_MS = 440;
const PAPER = "#EFE6CD";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";

/* type/name/detail/cat/price describe the piece; fromRect is its
   photograph's screen rectangle (the piece rises out of it and goes back
   into it); closing is set by the caller to play the return, after
   which onClosed fires. */
export function WoodPieceViewer({ type, name, detail, cat, price, fromRect, closing, onClose, onClosed, audio }) {
  const canvasRef = React.useRef(null);
  const modelRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [dark, setDark] = React.useState(true);
  const darkRef = React.useRef(true);
  const vw = window.innerWidth, vh = window.innerHeight;
  const size = Math.round(Math.min(vw * 0.84, vh * 0.54, 480));
  const cx = vw / 2, cy = vh * 0.42;
  const from = fromRect
    ? `translate(${fromRect.left + fromRect.width / 2 - cx}px, ${fromRect.top + fromRect.height / 2 - cy}px) scale(${fromRect.width / size})`
    : "scale(0.2)";
  const shown = open && !closing;

  React.useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  React.useEffect(() => {
    if (!closing) return undefined;
    const id = setTimeout(() => onClosed && onClosed(), OPEN_MS);
    return () => clearTimeout(id);
  }, [closing]);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose && onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  React.useEffect(() => { darkRef.current = dark; if (modelRef.current) modelRef.current.setWood(dark); }, [dark]);

  // The piece: turns slowly on its own; a drag turns it any way, with a
  // little carry after release, and it settles back upright.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasWoodShowcase(type)) return undefined;
    const px = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    let renderer;
    try { renderer = makeRenderer(canvas, px); } catch (e) { return undefined; }
    const scene = makeStage();
    const model = buildWoodModel(type, dark);
    modelRef.current = model;
    scene.add(model.group);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
    aim(camera, model.radius, START_AZ, START_EL);
    const st = { yaw: 0, pitch: 0, vy: 0, vp: 0, drag: null, last: performance.now(), raf: 0 };
    const spin = 0.32;
    function frame(now) {
      const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
      if (!st.drag) {
        st.yaw += (spin + st.vy) * dt;
        st.pitch += st.vp * dt;
        st.vy *= Math.exp(-dt * 2.2); st.vp *= Math.exp(-dt * 2.2);
        st.pitch *= Math.exp(-dt * 0.8);
      }
      model.group.rotation.set(st.pitch, st.yaw, 0, "YXZ");
      // The shadow stays on the floor of the stage, fading as it tips.
      model.shadow.material.opacity = Math.max(0, 1 - Math.abs(st.pitch) * 1.3);
      renderer.render(scene, camera);
      st.raf = requestAnimationFrame(frame);
    }
    st.raf = requestAnimationFrame(frame);
    function down(e) { st.drag = { x: e.clientX, y: e.clientY, t: performance.now() }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    function move(e) {
      if (!st.drag) return;
      const now = performance.now(), dt = Math.max(1, now - st.drag.t) / 1000;
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
      st.yaw += dx * 0.012; st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + dy * 0.012));
      st.vy = (dx * 0.012) / dt - spin; st.vp = (dy * 0.012) / dt;
      st.drag = { x: e.clientX, y: e.clientY, t: now };
    }
    function up() { st.drag = null; }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    window.__TIENDA_PIECE_VIEWER__ = { type, yaw: () => st.yaw, wood: () => (darkRef.current ? "walnut" : "ash") };
    return () => {
      cancelAnimationFrame(st.raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      model.dispose();
      modelRef.current = null;
      renderer.dispose(); renderer.forceContextLoss();
      if (window.__TIENDA_PIECE_VIEWER__ && window.__TIENDA_PIECE_VIEWER__.type === type) delete window.__TIENDA_PIECE_VIEWER__;
    };
  }, [type]);

  const ease = `${OPEN_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  const woodBtn = (isDark, label) => h("button", {
    type: "button",
    "aria-pressed": dark === isDark ? "true" : "false",
    "data-testid": `tienda-viewer-${isDark ? "walnut" : "ash"}`,
    onClick: (e) => { e.stopPropagation(); if (dark !== isDark) { setDark(isDark); audio && audio.playSelect && audio.playSelect(); } },
    style: {
      pointerEvents: "auto", minWidth: 96, minHeight: 44, padding: "0 14px", borderRadius: 2, cursor: "pointer",
      font: `800 12px/1 ${FRANKLIN}`, letterSpacing: "0.12em", textTransform: "uppercase",
      border: `1.5px solid ${PAPER}`, background: dark === isDark ? PAPER : "transparent", color: dark === isDark ? "#2E2118" : PAPER,
    },
  }, label);
  return h(
    "div",
    {
      "data-testid": "tienda-piece-viewer",
      "data-piece": type,
      "data-state": closing ? "closing" : shown ? "open" : "opening",
      role: "dialog",
      "aria-label": `${name}, in 3D`,
      onPointerDown: (e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose && onClose(); },
      onClick: (e) => e.stopPropagation(),
      style: {
        position: "fixed", inset: 0, zIndex: 1300,
        background: shown ? "rgba(26,18,11,0.6)" : "rgba(26,18,11,0)",
        backdropFilter: shown ? "blur(6px)" : "blur(0px)",
        WebkitBackdropFilter: shown ? "blur(6px)" : "blur(0px)",
        transition: `background ${ease}, backdrop-filter ${ease}, -webkit-backdrop-filter ${ease}`,
      },
    },
    h("canvas", {
      ref: canvasRef,
      "data-testid": "tienda-piece-viewer-canvas",
      "aria-label": `${name}: drag to turn`,
      style: {
        position: "fixed", left: cx - size / 2, top: cy - size / 2, width: size, height: size,
        touchAction: "none", cursor: "grab",
        transform: shown ? "none" : from,
        transition: `transform ${ease}`,
      },
    }),
    h(
      "div",
      {
        style: {
          position: "fixed", left: 0, right: 0, top: Math.min(cy + size / 2 + 4, vh - 190), padding: "0 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center",
          opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(8px)",
          transition: `opacity ${ease}, transform ${ease}`, pointerEvents: "none",
        },
      },
      h("div", { style: { font: `400 12px/1.2 ${COURIER}`, color: "rgba(239,230,205,0.75)" } }, [cat, price].filter(Boolean).join("  ·  ")),
      h("div", { style: { font: `900 clamp(24px, 5vw, 32px)/1 ${FRANKLIN}`, letterSpacing: "0.04em", color: PAPER, textTransform: "uppercase" } }, name),
      detail && h("div", { style: { font: `400 14px/1.4 ${FRANKLIN}`, color: "rgba(239,230,205,0.88)", maxWidth: 360 } }, detail),
      h("div", { role: "group", "aria-label": "Wood", style: { display: "flex", gap: 8, marginTop: 6 } }, woodBtn(true, "Walnut"), woodBtn(false, "Olive ash")),
      h("div", { style: { font: `400 11px/1.3 ${COURIER}`, letterSpacing: "0.1em", color: "rgba(239,230,205,0.6)", marginTop: 2 } }, "DRAG TO TURN  ·  TAP OUTSIDE TO PUT IT BACK"),
    ),
  );
}
