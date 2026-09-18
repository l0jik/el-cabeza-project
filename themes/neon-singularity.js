/* The Singularity cinematic — Part 1 of SINGULARITY_DESIGN.md: the
   collapse of the board into a wormhole funnel, the hard silent cut to
   black, and the draggable Fresnel-glow sphere that follows. Split out
   of themes/neon.js (already 6000+ lines before this) as its own
   self-contained module; it touches neon.js at exactly four seams —
   see the comments at each call site in that file.

   State lives in two places that must agree on one shared object:

   - React state (`phase`, via useSingularityPhase, called from
     useSetupExtras) drives what the DOM overlay renders.
   - `three.current.singularity` (a plain object, NOT React state) is
     the bridge that lets useSingularityPhase's triggers reach the
     actual 3D animation, which runs inside mountAmbientEffects's own
     per-frame tick (see advanceSingularityScene, called from
     themes/neon.js's tick). Both hook invocations close over the
     identical `three.current` object — that's what makes the bridge
     work without new chassis plumbing beyond exposing `three` to
     useSetupExtras (see chassis/ElCabeza3D.jsx).

   Per the confirmed scope: the sphere is real (Fresnel shader, real
   drag physics, real starfield) but its surface carries simple
   placeholder DOM text rather than true UV-mapped, checkbox-driven
   MATTER/LAWS/TOPOLOGIES content — those rules systems don't exist yet,
   so real menu content would be inert regardless. */

import React from "react";
import * as THREE from "three";
import { SLAB_X, SLAB_Z } from "../engine/constants.js";

export const PHASES = { IDLE: "idle", COLLAPSING: "collapsing", BLACKOUT: "blackout", SPHERE: "sphere" };

const COLLAPSE_DURATION_MS = 3200;
// Progress fraction where the palette starts cooling toward uniform
// blue ("deeper collapse" in the design doc) — no separate phase, just
// a second curve read off the same progress value.
const COOL_BREAKPOINT = 0.55;
const BLACKOUT_DWELL_MS = 700;
const PULSE_SPEED = 1.1; // rad/s-ish — the sphere's slow breathing rate
// Same decay constant as the dock-piece drag-to-idle precedent
// (chassis/ElCabeza3D.jsx) this is deliberately ported from, EXCEPT the
// idle target here is zero, not a continuous wander — the sphere's
// resting mood is calm/trance-like, not restless.
const DRAG_DECAY = 0.9;

/* ---------------------------------------------------------------------
   Shaders. First custom ShaderMaterial usage in this codebase — kept
   small and commented since there's no prior art here to follow.
--------------------------------------------------------------------- */

// Pulls a subdivided plane's vertices radially toward its center and
// down in Z, scaled so the outer rim stays anchored (rigid) while the
// center does the moving — "board/pieces stay rigid, the floor plane
// warps into a funnel" per the design doc.
const WARP_VERTEX = `
  uniform float uProgress;
  uniform float uMaxRadius;
  uniform float uThroatDepth;
  varying float vRadial;
  void main() {
    vec3 pos = position;
    float r = length(pos.xy);
    float rNorm = clamp(r / uMaxRadius, 0.0, 1.0);
    vRadial = rNorm;
    float pull = uProgress * pow(1.0 - rNorm, 2.5);
    vec2 dir = r > 0.0001 ? normalize(pos.xy) : vec2(0.0);
    pos.xy -= dir * pull * uMaxRadius * 0.6;
    pos.z -= pull * uThroatDepth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Violet/cyan near the rim early on, cooling to a uniform blue past
// uCool — "deeper collapse: palette cools to a more uniform blue".
const WARP_FRAGMENT = `
  uniform float uProgress;
  uniform float uCool;
  varying float vRadial;
  void main() {
    vec3 violet = vec3(0.541, 0.361, 1.0);
    vec3 cyan = vec3(0.302, 0.910, 1.0);
    vec3 deepBlue = vec3(0.039, 0.102, 0.29);
    vec3 rimColor = mix(violet, cyan, vRadial);
    vec3 color = mix(rimColor, deepBlue, uCool);
    float alpha = mix(0.35, 1.0, uProgress) * (1.0 - vRadial * 0.3);
    gl_FragColor = vec4(color, alpha);
  }
`;

// A thin Fresnel rim sharpened into a "photon ring" (not a broad
// accretion-disk glow), modulated by a slow breathing pulse — mirrors
// the existing CSS-custom-property-driven turn-halo pulse, just via a
// shader uniform since this is a real 3D object.
const SPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SPHERE_FRAGMENT = `
  uniform float uPulsePhase;
  uniform float uPulseAmount;
  uniform vec3 uRimColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
    rim = pow(rim, 2.5);
    float breathe = 1.0 + uPulseAmount * sin(uPulsePhase);
    vec3 color = uRimColor * rim * breathe;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---------------------------------------------------------------------
   Lazy construction — built once on first collapse, then just
   shown/hidden on repeat visits (nothing about the sphere's state needs
   to persist across a fresh open, and there's no real menu content yet
   to warrant rebuilding from scratch each time).
--------------------------------------------------------------------- */

function buildWarpMesh() {
  const segs = 64;
  const geo = new THREE.PlaneGeometry(SLAB_X, SLAB_Z, segs, segs);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uMaxRadius: { value: Math.max(SLAB_X, SLAB_Z) * 0.5 },
      uThroatDepth: { value: Math.max(SLAB_X, SLAB_Z) * 0.6 },
      uCool: { value: 0 },
    },
    vertexShader: WARP_VERTEX,
    fragmentShader: WARP_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    wireframe: true, // the "wireframe wormhole throat" look, directly off the warped geometry
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.08; // just above the grid it's replacing
  mesh.visible = false;
  return mesh;
}

function makeGlowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Cheap additively-blended billboards on a parametric spiral — no
// shader needed, just per-frame position/opacity updates in the same
// tick that drives uProgress (the established pattern for theme-owned
// per-frame 3D effects, per the fxItems arrays elsewhere in this file).
function buildStreaks(count = 8) {
  const tex = makeGlowTexture();
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: tex,
      color: i % 2 ? 0x8a5cff : 0x4de8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.55, 0.55, 1);
    group.add(sprite);
    items.push({ sprite, material, baseAngle: (i / count) * Math.PI * 2, speed: 1.4 + Math.random() * 0.8 });
  }
  group.visible = false;
  return { group, items };
}

function buildStarfield() {
  const COUNT = 800;
  const RADIUS_MIN = 30, RADIUS_MAX = 55;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xdbe9ff,
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  points.visible = false;
  return points;
}

function buildSphere() {
  const geo = new THREE.SphereGeometry(6, 64, 48);
  const uniforms = {
    uPulsePhase: { value: 0 },
    uPulseAmount: { value: 0.22 },
    uRimColor: { value: new THREE.Vector3(0.4, 0.85, 1.0) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: SPHERE_VERTEX, fragmentShader: SPHERE_FRAGMENT });
  const mesh = new THREE.Mesh(geo, material);
  const group = new THREE.Group();
  group.add(mesh);
  group.visible = false;
  return { group, material, uniforms };
}

function ensureSingularityObjects(t) {
  const s = t.singularity;
  if (s.built) return;
  s.built = true;
  s.warpMesh = buildWarpMesh();
  t.boardGroup.add(s.warpMesh);
  s.streaks = buildStreaks();
  t.boardGroup.add(s.streaks.group);
  s.sphere = buildSphere();
  t.scene.add(s.sphere.group);
  s.starfield = buildStarfield();
  t.scene.add(s.starfield);

  // Snapshot the real grid's material opacities once so the collapse
  // can cross-fade them out and the escape hatch can restore them —
  // theme.makeGrid()'s LineSegments materials are already
  // transparent:true, so this is a direct opacity write, no
  // restructuring of the real board needed.
  if (!t.singularityGridMaterials) {
    t.singularityGridMaterials = [];
    t.boardGroup.traverse((obj) => {
      if (obj.isLineSegments && obj.material && obj.material.transparent && obj !== s.warpMesh) {
        if (obj.material.userData.singularityBaseOpacity === undefined) {
          obj.material.userData.singularityBaseOpacity = obj.material.opacity;
        }
        t.singularityGridMaterials.push(obj.material);
      }
    });
  }
}

/* ---------------------------------------------------------------------
   Per-frame advance — called every frame from themes/neon.js's
   mountAmbientEffects tick, regardless of phase (a no-op cost check
   when idle).
--------------------------------------------------------------------- */

function updateCollapseVisuals(t, u, dt) {
  const s = t.singularity;
  s.warpMesh.visible = true;
  s.warpMesh.material.uniforms.uProgress.value = u;
  s.warpMesh.material.uniforms.uCool.value = Math.max(0, (u - COOL_BREAKPOINT) / (1 - COOL_BREAKPOINT));

  const fadeU = Math.min(1, u / 0.2);
  t.singularityGridMaterials.forEach((m) => {
    m.opacity = m.userData.singularityBaseOpacity * (1 - fadeU);
  });

  s.streaks.group.visible = true;
  const outerR = s.warpMesh.material.uniforms.uMaxRadius.value * 0.9;
  const innerR = outerR * 0.08;
  s.streaks.items.forEach((it) => {
    const angle = it.baseAngle + u * it.speed * 6;
    const radius = outerR - (outerR - innerR) * Math.pow(u, 0.8);
    it.sprite.position.set(Math.cos(angle) * radius, 0.3 + u * 1.5, Math.sin(angle) * radius);
    it.material.opacity = Math.min(1, u * 2.5) * 0.35;
  });

  // Rigid per-mesh transforms only (translate/scale/tumble) — never
  // vertex deformation, per the design doc's "no per-piece mesh
  // deformation" constraint. A new array, not the chassis's anim.current
  // (a single-slot, one-piece-at-a-time mechanism — wrong shape for
  // ~10 pieces converging at once).
  if (!s.collapseItems) {
    s.collapseItems = (t.pieceGroup.children || []).map((mesh) => ({
      mesh,
      basePos: mesh.position.clone(),
      baseScale: mesh.scale.clone(),
      baseQuaternion: mesh.quaternion.clone(),
      tumbleAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      tumbleSpeed: 2 + Math.random() * 3,
    }));
  }
  const pull = Math.pow(u, 1.6);
  s.collapseItems.forEach((it) => {
    it.mesh.position.set(
      it.basePos.x * (1 - pull * 0.9),
      it.basePos.y - pull * 1.2,
      it.basePos.z * (1 - pull * 0.9)
    );
    const scale = Math.max(1 - pull * 0.7, 0.05);
    it.mesh.scale.set(it.baseScale.x * scale, it.baseScale.y * scale, it.baseScale.z * scale);
    it.mesh.rotateOnAxis(it.tumbleAxis, it.tumbleSpeed * dt * pull);
  });

  if (s.audio) s.audio.continueSingularityHumThroughCollapse(u);
}

function updateSphereVisuals(t, dt) {
  const s = t.singularity;
  s.sphere.group.visible = true;
  s.starfield.visible = true;

  if (!s.dragging) {
    const decay = Math.exp(-dt * DRAG_DECAY);
    s.dragVelocity.x *= decay;
    s.dragVelocity.y *= decay;
  }
  s.sphere.group.rotation.x += s.dragVelocity.x * dt;
  s.sphere.group.rotation.y += s.dragVelocity.y * dt;

  s.pulsePhase = (s.pulsePhase || 0) + dt * PULSE_SPEED;
  s.sphere.uniforms.uPulsePhase.value = s.pulsePhase;
}

function teardownSingularityScene(t) {
  const s = t.singularity;
  if (!s) return;
  if (s.warpMesh) s.warpMesh.visible = false;
  if (s.streaks) s.streaks.group.visible = false;
  if (s.sphere) s.sphere.group.visible = false;
  if (s.starfield) s.starfield.visible = false;
  // Pieces were moved by direct mesh mutation (position/scale/rotation),
  // not through the normal pieces-state render path, so nothing else
  // restores them automatically — put every piece back exactly where
  // the collapse found it.
  if (s.collapseItems) {
    s.collapseItems.forEach((it) => {
      it.mesh.position.copy(it.basePos);
      it.mesh.scale.copy(it.baseScale);
      it.mesh.quaternion.copy(it.baseQuaternion);
    });
  }
  s.collapseItems = null;
  s.dragVelocity = { x: 0, y: 0 };
  s.dragging = false;
  s.pulsePhase = 0;
  if (t.singularityGridMaterials) {
    t.singularityGridMaterials.forEach((m) => { m.opacity = m.userData.singularityBaseOpacity; });
  }
  if (s.blackDivRef && s.blackDivRef.current) {
    s.blackDivRef.current.style.transition = "";
    s.blackDivRef.current.style.opacity = "0";
  }
  if (s.chromeRefs) {
    [s.chromeRefs.titleWrapRef, s.chromeRefs.cardRef].forEach((ref) => {
      if (ref && ref.current) {
        ref.current.style.transition = "";
        ref.current.style.opacity = "";
        ref.current.style.pointerEvents = "";
      }
    });
  }
  s.chromeHidden = false;
  if (typeof window !== "undefined") {
    window.__EC_TEST_SINGULARITY__ = { phase: PHASES.IDLE, sphereRotationY: null };
  }
}

export function advanceSingularityScene(t, now, chromeRefs) {
  const s = t.singularity;
  if (!s || !s.phase || s.phase === PHASES.IDLE) return;
  ensureSingularityObjects(t);
  const dt = s.lastTickAt ? Math.min((now - s.lastTickAt) / 1000, 0.05) : 0.016;
  s.lastTickAt = now;

  // The overlay only takes over the 3D canvas — the masthead and dock
  // are separate DOM layers stacked ABOVE it, so without this they'd
  // still show through once the black cutout fades for the sphere
  // reveal. Fades once per collapse start, not every frame.
  if (chromeRefs && !s.chromeHidden) {
    s.chromeHidden = true;
    s.chromeRefs = chromeRefs;
    [chromeRefs.titleWrapRef, chromeRefs.cardRef].forEach((ref) => {
      if (ref && ref.current) {
        ref.current.style.transition = "opacity 0.5s ease";
        ref.current.style.opacity = "0";
        ref.current.style.pointerEvents = "none";
      }
    });
  }

  switch (s.phase) {
    case PHASES.COLLAPSING: {
      const u = Math.min(1, (now - s.collapseStartedAt) / COLLAPSE_DURATION_MS);
      updateCollapseVisuals(t, u, dt);
      if (u >= 1) {
        // Land the visual cut and the audio cut on the SAME frame — no
        // cross-frame race between "screen looks black" and "sound goes
        // silent" (SINGULARITY_DESIGN.md: "the instant the black screen
        // is established... sudden, jarring, deliberate").
        s.phase = PHASES.BLACKOUT;
        s.blackoutStartedAt = now;
        t.boardGroup.visible = false;
        s.warpMesh.visible = false;
        s.streaks.group.visible = false;
        if (s.blackDivRef && s.blackDivRef.current) {
          s.blackDivRef.current.style.transition = "none";
          s.blackDivRef.current.style.opacity = "1";
        }
        if (s.audio) s.audio.cutSingularityAudioToSilence();
        if (s.setPhase) s.setPhase(PHASES.BLACKOUT);
      }
      break;
    }
    case PHASES.BLACKOUT: {
      if (now - s.blackoutStartedAt >= BLACKOUT_DWELL_MS) {
        s.phase = PHASES.SPHERE;
        // The blackout div is opaque and sits above the main canvas —
        // it has to fade back down for the sphere/starfield (already
        // rendering underneath it) to actually become visible. A soft
        // reveal here (unlike the instant collapsing->blackout cut,
        // which must stay a hard cut) matches "after the transition
        // settles" reading as a settling-in, not another jarring snap.
        if (s.blackDivRef && s.blackDivRef.current) {
          s.blackDivRef.current.style.transition = "opacity 1.4s ease";
          s.blackDivRef.current.style.opacity = "0";
        }
        if (s.setPhase) s.setPhase(PHASES.SPHERE);
      }
      break;
    }
    case PHASES.SPHERE: {
      updateSphereVisuals(t, dt);
      break;
    }
  }

  // Test-only hook (consistent with this codebase's data-testid
  // convention for otherwise-unobservable state) — Playwright can't
  // read React/Three internals directly, and there's no DOM property
  // for "is the sphere rotating." Only ever populated while the
  // cinematic is running.
  if (typeof window !== "undefined") {
    window.__EC_TEST_SINGULARITY__ = {
      phase: s.phase,
      sphereRotationY: s.sphere ? s.sphere.group.rotation.y : null,
    };
  }
}

/* ---------------------------------------------------------------------
   React-facing hook + overlay — the two seams useSetupExtras and
   renderExtraOverlays call into (themes/neon.js).
--------------------------------------------------------------------- */

export function useSingularityPhase({ three, audio }) {
  const [phase, setPhase] = React.useState(PHASES.IDLE);
  const blackDivRef = React.useRef(null);
  const phaseSetterRef = React.useRef(setPhase);
  phaseSetterRef.current = setPhase;
  const dragStateRef = React.useRef({ lastX: 0, lastY: 0 });

  // startCollapse (below) is what actually wires the bridge object onto
  // three.current — not a mount-time effect here, deliberately: this
  // hook's own effects run (in React's per-component ordering) before
  // the chassis's scene-setup effect that assigns three.current its
  // real value, so anything written here at mount time would land on
  // the ref's placeholder object and be discarded when the chassis
  // replaces it. startCollapse runs long after mount (on a real user
  // gesture), by which point three.current is already the final object,
  // so it re-establishes every bridge field fresh each time rather than
  // relying on an earlier write surviving.
  function startCollapse() {
    const t = three && three.current;
    if (!t) return;
    t.singularity = t.singularity || {};
    t.singularity.phase = PHASES.COLLAPSING;
    t.singularity.collapseStartedAt = performance.now();
    t.singularity.lastTickAt = null;
    t.singularity.dragVelocity = { x: 0, y: 0 };
    t.singularity.dragging = false;
    t.singularity.audio = audio;
    t.singularity.blackDivRef = blackDivRef;
    t.singularity.setPhase = (p) => phaseSetterRef.current(p);
    setPhase(PHASES.COLLAPSING);
  }

  function exitSingularity() {
    const t = three && three.current;
    if (t) {
      teardownSingularityScene(t);
      if (t.boardGroup) t.boardGroup.visible = true;
      if (t.singularity) t.singularity.phase = PHASES.IDLE;
    }
    audio.resumeAudioAfterSingularity();
    setPhase(PHASES.IDLE);
  }

  React.useEffect(() => {
    if (phase === PHASES.IDLE) return;
    const onKey = (e) => { if (e.key === "Escape") exitSingularity(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Drag-rotate the sphere — a direct port of the dock-piece pointer
  // pattern (chassis/ElCabeza3D.jsx), retargeted at the sphere group's
  // own rotation. Live velocity is stashed on t.singularity so the tick
  // (in mountAmbientEffects, a different closure) can decay it each
  // frame when not actively dragging.
  function handlePointerDown(ev) {
    const t = three && three.current;
    if (!t || !t.singularity || t.singularity.phase !== PHASES.SPHERE) return;
    t.singularity.dragging = true;
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY };
  }
  function handlePointerMove(ev) {
    const t = three && three.current;
    if (!t || !t.singularity || !t.singularity.dragging) return;
    const drag = dragStateRef.current;
    const dx = ev.clientX - drag.lastX;
    const dy = ev.clientY - drag.lastY;
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY };
    if (t.singularity.sphere) {
      t.singularity.sphere.group.rotation.y += dx * 0.01;
      t.singularity.sphere.group.rotation.x += dy * 0.01;
    }
    // Velocity in "radians per pointermove event" terms is good enough
    // here — it's only used to seed the decay-to-zero coast afterward,
    // not for physical accuracy.
    t.singularity.dragVelocity = { x: dy * 0.6, y: dx * 0.6 };
  }
  function handlePointerUp() {
    const t = three && three.current;
    if (t && t.singularity) t.singularity.dragging = false;
  }

  return {
    singularityPhase: phase,
    startCollapse,
    exitSingularity,
    blackDivRef,
    handleSingularityPointerDown: handlePointerDown,
    handleSingularityPointerMove: handlePointerMove,
    handleSingularityPointerUp: handlePointerUp,
  };
}

export function renderSingularityOverlay(setupExtras) {
  if (!setupExtras) return null;
  const {
    singularityPhase: phase,
    exitSingularity,
    blackDivRef,
    handleSingularityPointerDown,
    handleSingularityPointerMove,
    handleSingularityPointerUp,
  } = setupExtras;
  if (!phase || phase === PHASES.IDLE) return null;
  const h = React.createElement;
  return h(
    "div",
    {
      "data-testid": "singularity-overlay",
      "data-singularity-phase": phase,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        // Nothing to interact with during collapse/blackout — letting
        // pointer events pass through would be harmless anyway (the
        // board is about to be hidden), but capturing them from the
        // sphere phase onward is what keeps the chassis's own
        // orbit-drag/wheel handlers from firing underneath, with zero
        // chassis changes: this div simply sits in front of the main
        // canvas in DOM stacking order.
        pointerEvents: phase === PHASES.SPHERE ? "auto" : "none",
      },
      // Stops this from also bubbling to the chassis's document-level
      // "pointerdown outside the dock card" listener (see the fix in
      // the info-popup this overlay replaces) — same reasoning, same
      // fix, applied here too.
      onPointerDown: (e) => {
        e.stopPropagation();
        handleSingularityPointerDown(e);
      },
      onPointerMove: handleSingularityPointerMove,
      onPointerUp: handleSingularityPointerUp,
      onPointerCancel: handleSingularityPointerUp,
    },
    h("div", {
      ref: blackDivRef,
      style: { position: "absolute", inset: 0, background: "#000", opacity: 0 },
    }),
    phase === PHASES.SPHERE &&
      h(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            bottom: "8%",
            transform: "translateX(-50%)",
            width: "clamp(260px, 78%, 440px)",
            textAlign: "center",
            background: "rgba(4,6,10,0.82)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(102,217,255,0.28)",
            borderRadius: 4,
            padding: "20px 22px",
            boxSizing: "border-box",
            pointerEvents: "auto",
          },
        },
        h(
          "h2",
          {
            style: {
              margin: "0 0 8px",
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: "0.12em",
              color: "#66d9ff",
              textShadow: "0 0 16px rgba(102,217,255,0.5)",
            },
          },
          "SINGULARITY"
        ),
        h(
          "p",
          {
            style: {
              margin: "0 0 16px",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "rgba(207,216,220,0.85)",
            },
          },
          "An experimental rules variant, not yet playable. MATTER, LAWS, and TOPOLOGIES will live here, mapped onto this sphere's own surface, once those systems exist."
        ),
        h(
          "button",
          {
            "data-testid": "singularity-back-button",
            onClick: exitSingularity,
            style: {
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#66d9ff",
              background: "transparent",
              border: "1px solid rgba(102,217,255,0.4)",
              borderRadius: 3,
              padding: "8px 18px",
              cursor: "pointer",
            },
          },
          "Back"
        )
      )
  );
}
