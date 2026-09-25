/* The MATTER menu's piece models (themes/neon-singularity.js).

   Every piece type gets a finished 3D model in the Neon look: dark
   glass with a clear-coat, lit by a painted studio panorama, traced in
   cyan along its real corners. Two uses:

   - pieceThumb(type): a still of the model at a three-quarter angle,
     for the list. All the stills come from ONE short-lived WebGL
     context (rendered, copied to an image, released), so eleven rows
     cost no live contexts at all.
   - PieceViewer: the model live, turning slowly, dragged to turn it
     any way. It opens out of the list's still (the still's own screen
     rectangle is where it starts) onto a frameless stage over a blurred
     menu, and flies back into the same still when closed, so it is
     always clear which piece is being shown.

   Poses are each piece's first starting pose (themes/neon.js,
   PIECE_ORIENTATIONS), copied here rather than imported: neon.js
   imports this module's importer. */
import React from "react";
import * as THREE from "three";
import { makeRoundedBox, makePolycubeGeometry, makePolycubeSmooth } from "../engine/geometry.js";
import { PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";

const POSES = {
  cabeza: { disc: true },
  turrito: { w: 1, h: 1, z: 1 },
  flaco: { w: 1, h: 2, z: 1 },
  chato: { w: 1, h: 2, z: 2 },
  opa: { w: 2, h: 2, z: 2 },
  block1x3: { w: 1, h: 3, z: 1 },
  block2x3: { w: 2, h: 3, z: 1 },
  codo: { w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,0" },
  arcoChico: { w: 3, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,0;2,0,1" },
  arcoAlto: { w: 3, h: 1, z: 3, vox: "0,0,0;0,0,1;0,0,2;1,0,2;2,0,0;2,0,1;2,0,2" },
  arcoAncho: { w: 4, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,1;3,0,0;3,0,1" },
  rayo: { w: 3, h: 1, z: 2, vox: "0,0,0;1,0,0;1,0,1;2,0,1" },
  zeta: { w: 3, h: 1, z: 3, vox: "0,0,0;0,0,1;1,0,1;2,0,1;2,0,2" },
};
export function hasShowcase(type) { return !!POSES[type]; }

// The angle the still is taken from; the viewer opens at the same one,
// so the model leaves the list without a jump.
const START_AZ = 0.72, START_EL = 0.42;

/* The reflections: a dark studio with a broad soft top light, a cold
   cyan strip on one side and a warm one on the other. */
function studioEnvironment(renderer) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#2a3a48"); grd.addColorStop(0.5, "#0c131a"); grd.addColorStop(1, "#020406");
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#ffffff"; g.fillRect(300, 20, 420, 70);
  g.fillStyle = "#8ef3ff"; g.fillRect(60, 150, 60, 170);
  g.fillStyle = "#ffcf8a"; g.fillRect(880, 170, 44, 140);
  g.fillStyle = "#dffaff"; g.fillRect(560, 210, 20, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose(); tex.dispose();
  return env;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, "rgba(77,232,255,0.55)"); r.addColorStop(0.45, "rgba(77,232,255,0.12)"); r.addColorStop(1, "rgba(77,232,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/* The model: body, cyan outline, a soft pool of light beneath. Returns
   the group and its radius (for framing). */
function buildModel(type) {
  const pose = POSES[type];
  const group = new THREE.Group();
  let body, sharp;
  if (pose.disc) {
    const r = (DISC_DIAM * CABEZA_SCALE) / 2, hgt = DISC_H * CABEZA_SCALE * 1.4;
    body = new THREE.CylinderGeometry(r, r, hgt, 96);
    sharp = new THREE.CylinderGeometry(r * 1.002, r * 1.002, hgt * 1.002, 96);
  } else if (pose.vox) {
    const piece = { ...pose, type };
    body = makePolycubeSmooth(piece, PIECE_SCALE, 0.05); // one seamless solid, like the box pieces
    sharp = makePolycubeGeometry(piece, PIECE_SCALE);
  } else {
    body = makeRoundedBox(pose.w * PIECE_SCALE, pose.z * PIECE_SCALE, pose.h * PIECE_SCALE, 0.05);
    sharp = new THREE.BoxGeometry(pose.w * PIECE_SCALE * 1.002, pose.z * PIECE_SCALE * 1.002, pose.h * PIECE_SCALE * 1.002);
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#1b2833").convertSRGBToLinear(),
    roughness: 0.2, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06,
    emissive: new THREE.Color("#4DE8FF").convertSRGBToLinear(), emissiveIntensity: 0.07,
    envMapIntensity: 1.35,
  });
  const mesh = new THREE.Mesh(body, mat);
  group.add(mesh);
  const edges = new THREE.EdgesGeometry(sharp, 10);
  sharp.dispose();
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: "#8ef3ff", transparent: true, opacity: 0.95, toneMapped: false }));
  group.add(line);
  body.computeBoundingBox();
  const bb = body.boundingBox, size = new THREE.Vector3();
  bb.getSize(size);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = bb.min.y - 0.01;
  pool.scale.set(Math.max(size.x, size.z) * 1.5, Math.max(size.x, size.z) * 1.5, 1);
  group.add(pool);
  return { group, radius: size.length() / 2 };
}

function makeStage(renderer) {
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.add(new THREE.HemisphereLight("#bfefff", "#05080c", 0.5));
  const key = new THREE.DirectionalLight("#ffffff", 1.6); key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight("#4DE8FF", 1.4); rim.position.set(4, 2, -5); scene.add(rim);
  return scene;
}

function makeRenderer(canvas, w, h) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  r.setClearColor(0x000000, 0);
  return r;
}

function aim(camera, radius, az, el, fit) {
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * fit;
  camera.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
  camera.lookAt(0, 0, 0);
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  if (scene.environment) scene.environment.dispose();
}

/* ---------- stills for the list ---------- */
const thumbs = new Map();
const THUMB_PX = 168;

/* Renders stills for any of `types` not yet made, in one WebGL context
   that is released straight after. Returns false when WebGL isn't
   available (the list then keeps its flat footprint icons). */
export function ensureThumbs(types) {
  const todo = types.filter((t) => POSES[t] && !thumbs.has(t));
  if (!todo.length) return true;
  let renderer = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = THUMB_PX;
    renderer = makeRenderer(canvas, THUMB_PX, THUMB_PX);
    const scene = makeStage(renderer);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    todo.forEach((type) => {
      const { group, radius } = buildModel(type);
      scene.add(group);
      aim(camera, radius, START_AZ, START_EL, 1.15);
      renderer.render(scene, camera);
      thumbs.set(type, canvas.toDataURL("image/png"));
      scene.remove(group);
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    });
    disposeScene(scene);
    return true;
  } catch (e) {
    return false;
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
}
export function pieceThumb(type) { return thumbs.get(type) || null; }

/* ---------- the viewer ---------- */
const OPEN_MS = 420;

/* type/name/detail describe the piece; fromRect is the list still's
   screen rectangle (the viewer grows out of it and returns to it);
   closing is set by the caller to play the return, after which
   onClosed fires. */
export function PieceViewer({ type, name, detail, fromRect, closing, onClose, onClosed }) {
  const h = React.createElement;
  const canvasRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const size = Math.round(Math.min(window.innerWidth * 0.82, window.innerHeight * 0.56, 460));

  // Where the stage sits when it is still the list's still: centred on
  // the still, scaled down to its size.
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.44;
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

  // The live model: turns slowly on its own; a drag turns it any way,
  // with a little carry after release.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !POSES[type]) return undefined;
    const px = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    let renderer;
    try { renderer = makeRenderer(canvas, px, px); } catch (e) { return undefined; }
    const scene = makeStage(renderer);
    const { group, radius } = buildModel(type);
    scene.add(group);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    aim(camera, radius, START_AZ, START_EL, 1.15);
    // The model turns (not the camera), so the lights stay put and the
    // reflections slide across it the way they would on a real object.
    const st = { yaw: 0, pitch: 0, vy: 0, vp: 0, drag: null, last: performance.now(), raf: 0 };
    const spin = 0.35; // radians a second when left alone
    function frame(now) {
      const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
      if (!st.drag) {
        st.yaw += (spin + st.vy) * dt;
        st.pitch += st.vp * dt;
        st.vy *= Math.exp(-dt * 2.2); st.vp *= Math.exp(-dt * 2.2);
        st.pitch *= Math.exp(-dt * 0.8); // settles back upright
      }
      group.rotation.set(st.pitch, st.yaw, 0, "YXZ");
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
    if (typeof window !== "undefined") window.__EC_PIECE_VIEWER__ = { type, yaw: () => st.yaw };
    return () => {
      cancelAnimationFrame(st.raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      disposeScene(scene);
      renderer.dispose(); renderer.forceContextLoss();
      if (window.__EC_PIECE_VIEWER__ && window.__EC_PIECE_VIEWER__.type === type) delete window.__EC_PIECE_VIEWER__;
    };
  }, [type]);

  const ease = `${OPEN_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  return h(
    "div",
    {
      "data-testid": "piece-viewer",
      "data-piece": type,
      "data-state": closing ? "closing" : shown ? "open" : "opening",
      role: "dialog",
      "aria-label": `${name} in 3D`,
      onPointerDown: (e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose && onClose(); },
      onClick: (e) => e.stopPropagation(),
      style: {
        position: "fixed", inset: 0, zIndex: 2300,
        background: shown ? "rgba(2,6,10,0.42)" : "rgba(2,6,10,0)",
        backdropFilter: shown ? "blur(9px)" : "blur(0px)",
        WebkitBackdropFilter: shown ? "blur(9px)" : "blur(0px)",
        transition: `background ${ease}, backdrop-filter ${ease}, -webkit-backdrop-filter ${ease}`,
      },
    },
    h("canvas", {
      ref: canvasRef,
      "data-testid": "piece-viewer-canvas",
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
          position: "fixed", left: 0, right: 0, top: cy + size / 2 + 6, padding: "0 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center",
          opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(8px)",
          transition: `opacity ${ease}, transform ${ease}`, pointerEvents: "none",
        },
      },
      h("div", { style: { fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", color: "#dffaff", textShadow: "0 0 18px rgba(77,232,255,0.45)" } }, name.toUpperCase()),
      detail && h("div", { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "rgba(207,216,220,0.85)", maxWidth: 360, lineHeight: 1.45 } }, detail),
      h("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "rgba(142,243,255,0.55)", marginTop: 4 } }, "DRAG TO TURN · TAP OUTSIDE TO CLOSE")
    )
  );
}
