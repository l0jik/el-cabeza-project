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

   The sphere's surface carries real UV-mapped MATTER/LAWS/TOPOLOGIES
   text with a checkbox each (buildSphereTextTexture/drawSphereLabels),
   hit-tested via an actual raycast against the rotated geometry
   (hitTestSphereTap) rather than a flat DOM overlay — the interaction
   itself is real. What's NOT real: nothing is behind those checkboxes.
   MATTER/LAWS/TOPOLOGIES as rules systems don't exist yet, so a tap
   only flips the drawn checkbox and redraws the texture; there is no
   downstream state this feeds. */

import React from "react";
import * as THREE from "three";
import {
  SLAB_X, SLAB_Z, MIN_BOARD_DIM, MAX_BOARD_DIM, setActiveLaws, getBoardDimensions, ARCO_SIZES,
  setBlackHoles as setActiveBlackHoles, setMissingSquares as setActiveMissingSquares,
} from "../engine/constants.js";
import { pickBlackHoleSquares, pickMissingSquares, blackHoleRowAllowed, initialPiecesFor, missingSquaresKeepPath } from "../engine/rules.js";

// TOLLING is the lead-in the player triggers by clicking the revealed
// SINGULARITY invite: the cathedral bell tolls and a black curtain fades
// up over the still-visible board for SINGULARITY_TOLL_MS, then it hands
// off to COLLAPSING (which fades the curtain back out to reveal the warp).
export const PHASES = { IDLE: "idle", TOLLING: "tolling", COLLAPSING: "collapsing", BLACKOUT: "blackout", SPHERE: "sphere" };

// The bell-toll / fade-to-black lead-in length before the collapse begins.
const SINGULARITY_TOLL_MS = 2000;

const COLLAPSE_DURATION_MS = 3600;
// Progress fraction where the palette starts cooling toward uniform
// blue ("deeper collapse" in the design doc) — no separate phase, just
// a second curve read off the same progress value.
const COOL_BREAKPOINT = 0.55;
// How long pure black holds before the sphere fades up. The fade
// itself is deliberately slow (SPHERE_FADE_IN_MS) — the hard cut is
// the jarring beat; the reveal on the far side of it is the calm one.
const BLACKOUT_DWELL_MS = 900;
const SPHERE_FADE_IN_MS = 2000;
const PULSE_SPEED = 1.1; // rad/s-ish — the sphere's slow breathing rate
// How fast the sphere's ACTUAL angular velocity chases its target
// (see updateSphereVisuals) — one exponential-smoothing rate used for
// both easing up to speed while dragging (acceleration) and easing
// back down, whether that's toward a slower drag or toward zero after
// release (deceleration). Lower = weightier/smoother, higher = more
// instant. Per feedback that raw, unsmoothed pointer-driven rotation
// ("Radians of rotation per pixel... " applied directly every event)
// read as too sensitive/twitchy — this replaced that entirely rather
// than only smoothing the post-release coast.
const DRAG_VELOCITY_SMOOTHING = 9;
// After release only: a slightly gentler decay so a flick keeps coasting a
// little longer (a bit more momentum for spin-to-navigate). Dragging itself
// still uses DRAG_VELOCITY_SMOOTHING, so grab-feel is unchanged.
const RELEASE_VELOCITY_DECAY = 6.5;
const ZERO_DRAG_VELOCITY = { x: 0, y: 0 };
// Radians of rotation per pixel of pointer movement, per second of
// drag — the raw input this converts into a TARGET velocity that
// DRAG_VELOCITY_SMOOTHING above then eases the sphere toward, rather
// than applying directly. Halved from an initial 0.01 per earlier
// feedback that the sphere was too sensitive once a drag was
// recognized (see DRAG_VELOCITY_SMOOTHING's own comment for the
// smoothing pass added on top of that, later, for the same reason).
const DRAG_ROTATE_SENSITIVITY = 0.005;
// Accumulated pointer movement, in px, before a drag starts rotating
// the sphere at all. Raised from an original 3px, alongside the
// smoothing above, per feedback that the drag was too sensitive —
// matches TAP_MOVE_THRESHOLD_PX below exactly (see its own comment)
// so nothing can wobble the sphere on what still counts as a tap.
const DRAG_DEAD_ZONE_PX = 12;

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
  uniform float uTime;
  varying float vRadial;
  varying float vRoil;
  void main() {
    vec3 pos = position;
    float r = length(pos.xy);
    float rNorm = clamp(r / uMaxRadius, 0.0, 1.0);
    vRadial = rNorm;

    // Everything below is scaled by pull, so the outer rim stays put
    // while the middle does the collapsing.
    float pull = uProgress * pow(1.0 - rNorm, 2.2);

    // Swirl: the closer to the throat, the further round it has been
    // dragged. This is what turns a passive dent into something that
    // reads as actively spinning matter down a drain.
    float swirl = pull * 3.4;
    float cs = cos(swirl), sn = sin(swirl);
    pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;

    // Radial contraction toward the throat.
    vec2 dir = r > 0.0001 ? normalize(pos.xy) : vec2(0.0);
    pos.xy -= dir * pull * uMaxRadius * 0.72;

    // Roil: two interfering travelling waves riding the funnel wall, so
    // the surface churns rather than sliding smoothly down a cone.
    float roil = sin(r * 5.5 - uTime * 5.0) * 0.55 + sin(r * 11.0 + uTime * 3.1) * 0.28;
    vRoil = roil;
    pos.z -= pull * uThroatDepth + roil * pull * uMaxRadius * 0.14;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Violet/cyan near the rim early on, cooling to a uniform blue past
// uCool — "deeper collapse: palette cools to a more uniform blue".
const WARP_FRAGMENT = `
  uniform float uProgress;
  uniform float uCool;
  varying float vRadial;
  varying float vRoil;
  void main() {
    vec3 violet = vec3(0.541, 0.361, 1.0);
    vec3 cyan = vec3(0.302, 0.910, 1.0);
    vec3 deepBlue = vec3(0.039, 0.102, 0.29);
    vec3 rimColor = mix(violet, cyan, vRadial);
    vec3 color = mix(rimColor, deepBlue, uCool);
    // Wave crests flare brighter than troughs, so the roil in the
    // vertex stage reads as moving light and not just moving geometry.
    color += vec3(0.35, 0.55, 0.9) * max(vRoil, 0.0) * uProgress * 0.5;
    // Fades out at the very edge so the mesh doesn't hard-cut against
    // the board it overhangs.
    float edge = 1.0 - smoothstep(0.82, 1.0, vRadial);
    float alpha = mix(0.35, 1.0, uProgress) * (1.0 - vRadial * 0.3) * edge;
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
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    vUv = uv;
    gl_Position = projectionMatrix * mv;
  }
`;
// uTextMap is the MATTER/LAWS/TOPOLOGIES canvas texture (buildSphereTextTexture),
// equirectangular-mapped onto the same UV space THREE.SphereGeometry
// already provides — no custom UV authoring needed. Added additively
// (never blended/subtracted) so the texture's own black background
// contributes nothing and the text reads as the surface glowing from
// within, the same visual language as the rim itself.
const SPHERE_FRAGMENT = `
  uniform float uPulsePhase;
  uniform float uPulseAmount;
  uniform vec3 uRimColor;
  uniform sampler2D uTextMap;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
    rim = pow(rim, 2.5);
    float breathe = 1.0 + uPulseAmount * sin(uPulsePhase);
    vec3 color = uRimColor * rim * breathe;
    vec4 text = texture2D(uTextMap, vUv);
    color += text.rgb * text.a;
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
  const segs = 96;
  // Deliberately overhangs the real plate: the warp field reads as
  // something acting ON the board from outside it, and gives the blast
  // rings somewhere to travel out across.
  const spanX = SLAB_X * 1.35, spanZ = SLAB_Z * 1.35;
  const geo = new THREE.PlaneGeometry(spanX, spanZ, segs, segs);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uMaxRadius: { value: Math.max(spanX, spanZ) * 0.5 },
      uThroatDepth: { value: Math.max(spanX, spanZ) * 1.45 },
      uCool: { value: 0 },
      uTime: { value: 0 },
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

/* Shockwave rings that punch outward across the warp field each time
   the collapse "bites" — the blast-radius half of the splash. Pooled
   and reused rather than allocated per burst; a ring with opacity 0 is
   simply idle. */
function buildBlastRings(count = 5) {
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const geo = new THREE.RingGeometry(1, 1.06, 96);
    const material = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0x8a5cff : 0x4de8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
    items.push({ mesh, material, active: false, born: 0, life: 1 });
  }
  group.visible = false;
  return { group, items };
}

/* Digital artifact splash: small hard-edged shards flung out of the
   throat, each tumbling and fading. Deliberately unlit boxes with flat
   emissive-looking colors rather than sprites — they should read as
   fragments of the board's own geometry being torn off, not as soft
   particles. */
function buildDebris(count = 90) {
  const group = new THREE.Group();
  const items = [];
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0x8a5cff : i % 3 === 1 ? 0x4de8ff : 0xdfeaff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    group.add(mesh);
    items.push({ mesh, material, active: false, vel: new THREE.Vector3(), spin: new THREE.Vector3(), born: 0, life: 1 });
  }
  group.visible = false;
  return { group, items };
}

function spawnBlastRing(s, now, strength) {
  const ring = s.blastRings.items.find((r) => !r.active);
  if (!ring) return;
  ring.active = true;
  ring.born = now;
  ring.life = 700 + Math.random() * 500;
  ring.peak = 0.5 * strength;
  ring.maxScale = s.warpMesh.material.uniforms.uMaxRadius.value * (0.9 + Math.random() * 0.5);
  ring.mesh.position.set(0, 0.12 + Math.random() * 0.3, 0);
}

function spawnDebrisBurst(s, now, strength, count) {
  let spawned = 0;
  for (const d of s.debris.items) {
    if (spawned >= count) break;
    if (d.active) continue;
    d.active = true;
    d.born = now;
    d.life = 500 + Math.random() * 700;
    d.peak = 0.55 + Math.random() * 0.45;
    const angle = Math.random() * Math.PI * 2;
    const speed = (2.5 + Math.random() * 6) * strength;
    d.vel.set(Math.cos(angle) * speed, 2 + Math.random() * 5 * strength, Math.sin(angle) * speed);
    d.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    d.mesh.position.set(Math.cos(angle) * 0.35, 0.25, Math.sin(angle) * 0.35);
    d.mesh.scale.setScalar(0.5 + Math.random() * 1.4);
    d.mesh.visible = true;
    spawned++;
  }
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
  // A bare PointsMaterial with no sprite map draws every point as a
  // hard-edged square, not a soft dot — normally too small to notice,
  // but sizeAttenuation means a star that happens to land close to the
  // camera renders large enough for that square edge to actually read
  // as a small gray box. The same soft radial-gradient sprite the
  // streaks already use (makeGlowTexture) rounds every point off
  // regardless of how big any single one gets.
  const material = new THREE.PointsMaterial({
    map: makeGlowTexture(),
    color: 0xdbe9ff,
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.visible = false;
  return points;
}

/* MATTER / LAWS / TOPOLOGIES, distributed equally around the sphere's
   equator (not stacked — see the earlier single-column/stacked-list
   layouts this replaces) as three plain root labels, no checkbox on
   any of them. Each opens a real DOM holographic overlay (see
   renderCategoryOverlay) holding its actual sub-items; the root label
   itself just dims or glows depending on whether that category holds
   any user selection (isCategoryActive). Real UV-mapped canvas text,
   hit-tested against the actual rotated sphere geometry via a raycast
   (categoryAtUv) rather than a flat overlay, so the text still visibly
   distorts under rotation the way the design doc describes.

   The three u-slots themselves are fixed — one sits at u=0.5, which is
   the longitude the BLACKOUT->SPHERE auto-centering raycast (see
   advanceSingularityScene) rotates to face the camera, so whichever
   label occupies that slot is always the one greeting the player on
   settle; the other two sit a third of the way around in each
   direction, reached by dragging. WHICH label occupies which slot is
   randomized fresh each time the cinematic starts (see
   shuffleRootLabels/startCollapse) — every hold-to-commit reveals the
   three menus in a new arrangement rather than MATTER always greeting
   the player. Also note CanvasTexture's flipY (unchanged from the
   earlier layout) — canvas-Y = height*(1-v) samples at v, not
   canvas-Y = height*v. */
const ROOT_LABEL_DEFS = [
  { key: "matter", label: "MATTER" },
  { key: "laws", label: "LAWS" },
  { key: "topologies", label: "TOPOLOGY" },
];
const ROOT_LABEL_U_SLOTS = [0.5, 0.5 - 1 / 3, 0.5 + 1 / 3];

// A fresh random assignment of the three labels to the three fixed
// u-slots — called once per cinematic entry (startCollapse), so a
// re-hold after escaping (or a fresh game) can land on a different
// arrangement. Not called mid-cycle: the arrangement stays fixed for
// the whole time the sphere is up, exactly like the original static
// layout did, just re-rolled at the start of each new visit.
function shuffleRootLabels() {
  const defs = [...ROOT_LABEL_DEFS];
  for (let i = defs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [defs[i], defs[j]] = [defs[j], defs[i]];
  }
  return defs.map((def, i) => ({ ...def, u: ROOT_LABEL_U_SLOTS[i] }));
}

// The pre-shuffle layout (MATTER front, LAWS/TOPOLOGIES flanking) —
// used only as a placeholder before the first real shuffle exists
// (the very first texture draw, before t.singularity is even built;
// see buildSphereTextTexture) since it's overwritten within the same
// visit by the dirty-flag redraw once real state is available.
const DEFAULT_ROOT_LABELS = ROOT_LABEL_DEFS.map((def, i) => ({ ...def, u: ROOT_LABEL_U_SLOTS[i] }));

// A category's display word, e.g. for the overlay's own heading —
// looked up from ROOT_LABEL_DEFS rather than just uppercasing the key
// itself, since the two aren't always identical (the "topologies" key
// displays as "TOPOLOGY", singular).
function categoryDisplayLabel(key) {
  if (key === "configurations") return "CONFIGURATIONS";
  return ROOT_LABEL_DEFS.find((d) => d.key === key)?.label || key.toUpperCase();
}
const TEXT_TEXTURE_W = 2048, TEXT_TEXTURE_H = 1024;
// The label band's total v-extent (title + status line), unchanged
// from the earlier fixed band's own width (0.82-0.58).
const LABEL_V_HALF_WIDTH_BAND = 0.12;
// The sphere's actual geometric equator — not a guess: THREE.SphereGeometry's
// default UV mapping puts v=0.5 exactly at the midpoint between its two
// poles for a standard full sphere (thetaStart=0, thetaLength=Math.PI),
// regardless of camera position or the sphere's own current rotation.
// Earlier versions of this tried to derive the center from wherever the
// camera happened to be looking (via a raycast), which is a different
// thing entirely — that tracks the CAMERA's elevation, not the sphere's
// own equator, and is why the words sat too high (an elevated,
// downward-tilted camera looks at a point above true center). Fixed,
// not per-session state.
const LABEL_CENTER_V = 0.5;
// How far in u (as a fraction of the full 0..1 wrap) a tap can land
// from a label's center and still count as hitting it — comfortably
// under 1/6 (half of the 1/3 spacing between labels) so the gaps
// between labels stay genuinely neutral "bare sphere" space, which is
// exactly where the triple-tap-to-finalize gesture lives (see
// registerBareTap) without fighting a label's own hit region.
const LABEL_U_HALF_WIDTH = 0.13;

const DEFAULT_BOARD_DIM = 10; // matches the engine's fixed board before any TOPOLOGIES choice

// LAWS — the independent toggles from SINGULARITY_DESIGN.md's Part 2,
// plus Diagonal Slide (a modifier on Slide).
const LAWS_ITEMS = [
  { key: "splitMovement", label: "Split Movement", blurb: "Split a turn's points between up to two pieces instead of one." },
  { key: "slide", label: "Slide", blurb: "Move a piece one open square north, south, east or west without tipping it. Costs 2 points (a roll costs 1)." },
  { key: "diagonalSlide", label: "Diagonal Slide", blurb: "Slides may also go diagonally. Needs Slide." },
  { key: "blackHoleSquares", label: "Black Hole Squares", blurb: "Two linked squares. A one-square piece that enters one comes out beside the other, on the same side it went in. Ends the turn." },
  { key: "cantileverPivot", label: "Cantilever Pivot", blurb: "A piece balanced on one cube (only a Codo, Rayo or Zeta can be) turns a quarter turn around it. Costs 1 point." },
  { key: "threeActions", label: "3 Actions Per Turn", blurb: "3 action points per turn instead of 2." },
  { key: "shoving", label: "Shoving", blurb: "A piece moving into one with fewer cubes pushes it along. Costs 1 extra point." },
];

// The Shoving law's two game-start settings (selections.shove), shown
// under its checkbox: how far a shove pushes, and which moves shove.
const SHOVE_SETTINGS = [
  { key: "far", label: "Push distance", options: [{ value: false, label: "1 square" }, { value: true, label: "As far as it travels" }] },
  { key: "onRolls", label: "Shoves on", options: [{ value: false, label: "Slides only" }, { value: true, label: "Slides and rolls" }] },
];
// "Shoving (1 square, slides only)" etc. for the summary / variants.
function shovingLabel(selections) {
  const sh = selections.shove || {};
  return `Shoving (${sh.far ? "as far as it travels" : "1 square"}, ${sh.onRolls ? "slides and rolls" : "slides only"})`;
}
function lawLabel(item, selections) {
  return item.key === "shoving" ? shovingLabel(selections) : item.label;
}
// What setActiveLaws gets: the law checkboxes plus Shoving's settings.
function lawsForEngine(selections) {
  const sh = selections.shove || {};
  return { ...selections.laws, shoveFar: !!sh.far, shoveOnRolls: !!sh.onRolls };
}

// Footprints (col,row cells, all one layer) used only to draw the
// small isometric icon next to each MATTER item — see renderPieceIcon.
// The five originals match their real starting orientation in
// engine/rules.js's STARTING_LAYOUT (w x h in board cells); the four
// new types have no real engine geometry yet (SINGULARITY_DESIGN.md
// Part 2 describes them only as rules, not authored geometry), so
// these are representative shapes, not the eventual real footprint
// mask data — good enough for "what does this roughly look like",
// which is all a selection-menu icon needs to do.
const PIECE_FOOTPRINTS = {
  cabeza: [[0, 0]],
  turrito: [[0, 0]],
  flaco: [[0, 0], [0, 1]],
  chato: [[0, 0], [0, 1]],
  opa: [[0, 0], [1, 0], [0, 1], [1, 1]],
  codo: [[0, 0], [0, 1], [1, 1]],
  block1x3: [[0, 0], [0, 1], [0, 2]],
  block2x3: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  // The design doc's "non-convex shape with a genuine hollow/void" —
  // a 3-wide arch with its center cell empty is the simplest icon that
  // actually reads as an arch rather than a plain block.
  arch: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  rayo: [[0, 0], [1, 0], [1, 1], [2, 1]],
  zeta: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
};

// MATTER — the four new polycube types from the design doc, each a
// simple enable/disable checkbox.
// block1x3/block2x3 are real: plain rectangular boxes, so they place,
// roll, and collide exactly like the five originals with no new
// engine work (see generateAnomalySetup's own roster support in
// themes/neon.js). The L became the Codo, a real piece with its own
// roster counter (MATTER_ROSTER below), and so did the arch — the Arco,
// with a size choice (see ARCO_SIZES / the MATTER overlay).
const MATTER_NEW_PIECES = [
  { key: "block1x3", label: "1×3 Block", icon: "block1x3" },
  { key: "block2x3", label: "2×3 Block", icon: "block2x3" },
];

// MATTER also lets the roster of the five ORIGINAL pieces be
// customized via a scroll wheel each, not just the four new ones —
// this is the design doc's "custom piece rosters" idea (a player's own
// piece complement, e.g. all originals plus an extra Turrito) surfaced
// as a real per-piece count control. Cabeza is capped at the doc's own
// 1-2 range (at least one required, at most two allowed); the other
// four get a generous 0-4 each rather than the doc's overall "max 10
// pieces per side" being enforced live here — this pass is selections-
// only (see the module header), so the wheels just record a count.
const MATTER_ROSTER = [
  { key: "cabeza", label: "Cabeza", min: 1, max: 2, default: 1, icon: "cabeza" },
  { key: "chato", label: "Chato", min: 0, max: 4, default: 1, icon: "chato" },
  { key: "flaco", label: "Flaco", min: 0, max: 4, default: 1, icon: "flaco" },
  { key: "opa", label: "Opa", min: 0, max: 4, default: 1, icon: "opa" },
  { key: "turrito", label: "Turrito", min: 0, max: 4, default: 1, icon: "turrito" },
  // The Codo: MATTER's first odd-shaped piece (a 3-cube L — see
  // engine/shapes.js). Off by default; any count places it in a
  // randomized opening.
  { key: "codo", label: "Codo", min: 0, max: 4, default: 0, icon: "codo" },
  // The Arco (an arch — see engine/constants.js): one counter, and a
  // size choice (matter.arcoSize) that applies to every Arco in the game.
  { key: "arco", label: "Arco", min: 0, max: 4, default: 0, icon: "arch" },
  // The Rayo (4-cube S/Z) and the Zeta (5-cube Z): off by default.
  { key: "rayo", label: "Rayo", min: 0, max: 4, default: 0, icon: "rayo" },
  { key: "zeta", label: "Zeta", min: 0, max: 4, default: 0, icon: "zeta" },
];

// "Arco Alto" etc. for the summary / variants — the counter's label plus
// the chosen size.
function arcoLabel(selections) {
  const size = ARCO_SIZES.find((a) => a.key === selections.matter.arcoSize) || ARCO_SIZES[0];
  return `Arco ${size.label}`;
}
function rosterItemLabel(p, selections) {
  return p.key === "arco" ? arcoLabel(selections) : p.label;
}

function createDefaultSelections() {
  return {
    laws: Object.fromEntries(LAWS_ITEMS.map((i) => [i.key, false])),
    matter: {
      newPieces: Object.fromEntries(MATTER_NEW_PIECES.map((i) => [i.key, false])),
      roster: Object.fromEntries(MATTER_ROSTER.map((p) => [p.key, p.default])),
      // Opt-in random opening layout (Anomaly-style). Off = the standard
      // fixed formation; on = a fresh randomized placement at Begin Game.
      randomizeStart: false,
      // Which Arco every Arco in the game is (ARCO_SIZES key).
      arcoSize: "chico",
    },
    // missingSquares (the enable toggle) lives here, in topologies, not
    // as its own LAW — it changes the board's physical shape/playable
    // area rather than a movement rule, same category as rows/cols.
    topologies: { rows: DEFAULT_BOARD_DIM, cols: DEFAULT_BOARD_DIM, missingSquares: false },
    // Black Hole Squares placement: null = auto (random-but-fair, the
    // default), or { row, col } = a manually-chosen cell on the player's
    // side of the board, whose 180-degree mirror is the paired hole (see
    // the picker in renderPairedSquarePicker and buildBlackHolePlacement).
    blackHole: { manual: null, random: false },
    // Missing Squares placement — its own top-level field rather than
    // nested under topologies for the same reason blackHole isn't nested
    // under laws: the picker logic is generic and only visually lives
    // inside its category's overlay, not structurally bound to it.
    // `count` pairs (1-5) are wanted; `spots` holds the player's-side half
    // of each placed pair ({row,col,random}), hand-picked or rolled at
    // random — each one's 180-degree mirror is its partner.
    missingSquare: { spots: [], count: 1 },
    // The Shoving law's settings (only matter while it's on).
    shove: { far: false, onRolls: false },
  };
}

function isCategoryActive(key, selections) {
  if (key === "laws") return Object.values(selections.laws).some(Boolean);
  if (key === "matter") {
    if (selections.matter.randomizeStart) return true;
    if (Object.values(selections.matter.newPieces).some(Boolean)) return true;
    return MATTER_ROSTER.some((p) => selections.matter.roster[p.key] !== p.default);
  }
  if (key === "topologies") {
    return (
      selections.topologies.rows !== DEFAULT_BOARD_DIM ||
      selections.topologies.cols !== DEFAULT_BOARD_DIM ||
      selections.topologies.missingSquares
    );
  }
  return false;
}

function summarizeCategory(key, selections) {
  if (key === "laws") {
    const n = Object.values(selections.laws).filter(Boolean).length;
    return n ? `${n} LAW${n > 1 ? "S" : ""} ACTIVE` : "TAP TO CONFIGURE";
  }
  if (key === "matter") {
    return isCategoryActive("matter", selections) ? "ROSTER CUSTOMIZED" : "TAP TO CONFIGURE";
  }
  if (key === "topologies") {
    if (!isCategoryActive("topologies", selections)) return "TAP TO CONFIGURE";
    const { rows, cols, missingSquares } = selections.topologies;
    const sized = rows !== DEFAULT_BOARD_DIM || cols !== DEFAULT_BOARD_DIM;
    const n = selections.missingSquare.count;
    const missingText = n > 1 ? `MISSING SQUARES ×${n}` : "MISSING SQUARES";
    if (sized && missingSquares) return `${rows} × ${cols} · ${missingText}`;
    if (sized) return `${rows} × ${cols} BOARD`;
    return missingText;
  }
  return "";
}

// "Missing squares (3 pairs)" — each pair is a spot plus its mirror.
function missingSquaresLabel(count) {
  return `Missing squares (${count} pair${count === 1 ? "" : "s"})`;
}

/* The in-game Current Variants flyout's data: the specials this game
   actually started with, grouped by category, ACTIVE ones only, using
   the same label tables the sphere menu shows so names match. Returned
   as a flat list of {key,label,items} groups; a group is omitted when it
   has no active items, and an all-empty result renders as "Standard
   rules" (see VariantsFlyout). */
function buildVariantsSnapshot(selections) {
  const groups = [];
  const lawItems = LAWS_ITEMS.filter((i) => selections.laws[i.key]);
  const laws = lawItems.map((i) => lawLabel(i, selections));
  // keys: which rules card each item opens when tapped in the flyout.
  if (laws.length) groups.push({ key: "laws", label: "LAWS", items: laws, keys: lawItems.map((i) => i.key) });

  const matter = [];
  if (selections.matter.randomizeStart) matter.push("Randomized start");
  MATTER_NEW_PIECES.forEach((i) => { if (selections.matter.newPieces[i.key]) matter.push(i.label); });
  MATTER_ROSTER.forEach((p) => {
    const n = selections.matter.roster[p.key];
    if (n !== p.default) matter.push(`${n}× ${rosterItemLabel(p, selections)}`);
  });
  if (matter.length) groups.push({ key: "matter", label: "MATTER", items: matter });

  const { rows, cols, missingSquares } = selections.topologies;
  const topoItems = [];
  if (rows !== DEFAULT_BOARD_DIM || cols !== DEFAULT_BOARD_DIM) topoItems.push(`${rows} × ${cols} board`);
  if (missingSquares) topoItems.push(missingSquaresLabel(selections.missingSquare.count));
  if (topoItems.length) groups.push({ key: "topologies", label: "TOPOLOGY", items: topoItems });
  return groups;
}

// How many mirrored pairs of Missing Squares a game may have (5 pairs =
// 10 squares).
const MAX_MISSING_PAIRS = 5;

// The 180-degree point-symmetric partner of a cell — the paired hole for
// a manually-placed one, the same mirror createInitialPieces uses.
function mirrorCell(row, col, rows, cols) {
  return { row: rows - 1 - row, col: cols - 1 - col };
}

// Does any piece's footprint cover this cell?
function cellOccupied(pieces, r, c) {
  return (pieces || []).some((p) => r >= p.row && r < p.row + p.h && c >= p.col && c < p.col + p.w);
}

// Is this cell one of the OTHER paired-square feature's already-resolved
// squares? See buildPairedSquarePlacement's own comment for why.
function cellReserved(avoid, r, c) {
  return (avoid || []).some((a) => a.row === r && a.col === c);
}

/* Shared by Black Hole Squares and Missing Squares: the two paired
   squares for a game — the player's manual pick plus its mirror when one
   was placed AND both cells are free of pieces AND free of the OTHER
   feature's own squares (`avoid`, if both are active in the same game);
   otherwise the automatic random-but-fair pair (`pick`, either
   pickBlackHoleSquares or pickMissingSquares — same shape, different
   engine state). The fallback keeps a manual pick from ever landing on a
   piece or on the other feature's square — e.g. a randomized/custom
   opening the picker couldn't preview, a pick made stale by a later
   board-size change, or the two features' squares having been chosen to
   coincide. */
function buildPairedSquarePlacement(manual, rows, cols, pieces, avoid, pick, rowAllowed = () => true) {
  if (manual && manual.row < rows && manual.col < cols && rowAllowed(manual.row, rows)) {
    const m = mirrorCell(manual.row, manual.col, rows, cols);
    const distinct = !(m.row === manual.row && m.col === manual.col);
    if (
      distinct &&
      !cellOccupied(pieces, manual.row, manual.col) && !cellOccupied(pieces, m.row, m.col) &&
      !cellReserved(avoid, manual.row, manual.col) && !cellReserved(avoid, m.row, m.col)
    ) {
      return [{ row: manual.row, col: manual.col }, { row: m.row, col: m.col }];
    }
  }
  return pick(pieces || [], rows, cols, avoid || []);
}

function buildBlackHolePlacement(selections, rows, cols, pieces, avoid) {
  return buildPairedSquarePlacement(
    selections && selections.blackHole && selections.blackHole.manual,
    rows, cols, pieces, avoid, pickBlackHoleSquares, blackHoleRowAllowed
  );
}

/* Missing Squares' version, for up to five pairs: every chosen spot
   (hand-picked or rolled) that's still free of pieces and of `avoid` and
   keeps a path across the board is kept as-is, and any spot that isn't
   is replaced by a fresh random pair — so the game always gets `count`
   pairs when the board has room for them. */
function buildMissingSquaresPlacement(selections, rows, cols, pieces, avoid) {
  const ms = (selections && selections.missingSquare) || { spots: [], count: 1 };
  const out = [];
  (ms.spots || []).forEach((p) => {
    if (out.length >= ms.count * 2 || p.row >= rows || p.col >= cols) return;
    const m = mirrorCell(p.row, p.col, rows, cols);
    if (m.row === p.row && m.col === p.col) return;
    if (cellOccupied(pieces, p.row, p.col) || cellOccupied(pieces, m.row, m.col)) return;
    if (cellReserved(avoid, p.row, p.col) || cellReserved(avoid, m.row, m.col)) return;
    if (cellReserved(out, p.row, p.col)) return;
    const pair = [{ row: p.row, col: p.col }, m];
    if (!missingSquaresKeepPath([...out, ...pair], rows, cols)) return;
    out.push(...pair);
  });
  while (out.length < ms.count * 2) {
    const pair = pickMissingSquares(pieces || [], rows, cols, avoid || [], 200, out);
    if (!pair.length) break;
    out.push(...pair);
  }
  return out;
}

// Circular distance in u-space (u wraps at 0/1, since the sphere's
// longitude is a loop) — plain Math.abs would wrongly treat a label
// near u=0 and a tap near u=1 as far apart when they're actually
// adjacent on the sphere.
function circularUDist(a, b) {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

// Which root label (if any) a raycast hit's UV landed on — null for
// anywhere else on the sphere, including the gaps between labels,
// which is deliberately "bare sphere" (rotates on drag, counts toward
// triple-tap-to-finalize on a clean tap; see registerBareTap).
function categoryAtUv(uv, rootLabels) {
  if (uv.y < LABEL_CENTER_V - LABEL_V_HALF_WIDTH_BAND || uv.y > LABEL_CENTER_V + LABEL_V_HALF_WIDTH_BAND) return null;
  for (const entry of rootLabels || DEFAULT_ROOT_LABELS) {
    const u = ((entry.u % 1) + 1) % 1;
    if (circularUDist(uv.x, u) < LABEL_U_HALF_WIDTH) return entry.key;
  }
  return null;
}

function drawRootLabels(canvas, ctx, selections, rootLabels) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const titleFont = "700 88px 'Chakra Petch', sans-serif";
  const subFont = "400 28px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const y = canvas.height * (1 - LABEL_CENTER_V);
  for (const entry of rootLabels || DEFAULT_ROOT_LABELS) {
    const active = isCategoryActive(entry.key, selections);
    const u = ((entry.u % 1) + 1) % 1;
    const x = u * canvas.width;
    ctx.font = titleFont;
    if (active) {
      // Bright glow: a soft canvas shadow doubling as the "this
      // category holds a real selection" signal, since there's no
      // checkbox left on the root label to carry that any more.
      ctx.shadowColor = "rgba(142,243,255,0.9)";
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#dffaff";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(142,243,255,0.5)";
    }
    ctx.fillText(entry.label, x, y - 20);
    ctx.shadowBlur = 0;
    ctx.font = subFont;
    ctx.fillStyle = active ? "rgba(223,250,255,0.75)" : "rgba(142,243,255,0.4)";
    ctx.fillText(summarizeCategory(entry.key, selections), x, y + 34);
  }
}

function buildSphereTextTexture(markLabelsDirty) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXT_TEXTURE_W;
  canvas.height = TEXT_TEXTURE_H;
  const ctx = canvas.getContext("2d");
  drawRootLabels(canvas, ctx, createDefaultSelections(), DEFAULT_ROOT_LABELS);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  /* Canvas text drawn before the webfonts finish loading silently falls
     back to a generic sans-serif — a real, easy-to-miss bug with canvas
     text generally, not specific to this file. Rather than redrawing
     with these defaults again (the real, current selections live on
     t.singularity, not reachable from here), just flag dirty — the
     next frame's updateSphereVisuals redraws from whatever the actual
     current selections are and clears the flag. */
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (markLabelsDirty) markLabelsDirty(); });
  }
  return { canvas, ctx, texture };
}

/* ---- CONFIGURATIONS: saved rule presets ----
   A configuration is a named snapshot of the sphere's rule selections
   (LAWS, MATTER, TOPOLOGY, and hand-placed Black Hole / Missing Square
   spots) — NOT the opponent, which is remembered separately by the
   chassis. Stored in this browser's localStorage; every access is guarded
   so blocked storage just means "no saved configurations." */
const CONFIGS_KEY = "el-cabeza:configurations";
function loadConfigurations() {
  try {
    const list = JSON.parse(window.localStorage.getItem(CONFIGS_KEY) || "[]");
    return Array.isArray(list)
      ? list.filter((c) => c && typeof c.name === "string" && c.selections && typeof c.selections === "object")
      : [];
  } catch (e) { return []; }
}
function saveConfigurations(list) {
  try { window.localStorage.setItem(CONFIGS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
// Merge a saved selections object onto today's defaults, key by key, so a
// configuration saved before a newer option existed still loads cleanly
// (the new option just takes its default) and unknown keys are dropped.
function normalizeSelections(saved) {
  const d = createDefaultSelections();
  const pick = (base, src) => {
    const out = { ...base };
    if (src && typeof src === "object") {
      Object.keys(base).forEach((k) => { if (typeof src[k] === typeof base[k] || (base[k] === null && src[k] && typeof src[k] === "object")) out[k] = src[k]; });
    }
    return out;
  };
  const cell = (m) => (m && Number.isInteger(m.row) && Number.isInteger(m.col) ? { row: m.row, col: m.col } : null);
  const src = saved || {};
  const matterSrc = src.matter || {};
  return {
    laws: pick(d.laws, src.laws),
    matter: {
      newPieces: pick(d.matter.newPieces, matterSrc.newPieces),
      roster: pick(d.matter.roster, matterSrc.roster),
      randomizeStart: typeof matterSrc.randomizeStart === "boolean" ? matterSrc.randomizeStart : d.matter.randomizeStart,
      arcoSize: ARCO_SIZES.some((a) => a.key === matterSrc.arcoSize) ? matterSrc.arcoSize : d.matter.arcoSize,
    },
    topologies: pick(d.topologies, src.topologies),
    blackHole: { manual: cell(src.blackHole && src.blackHole.manual), random: !!(src.blackHole && src.blackHole.random) },
    missingSquare: normalizeMissingSquare(src.missingSquare, cell),
    // Same key order as createDefaultSelections, so a loaded
    // configuration compares equal to the live selections it came from.
    shove: pick(d.shove, src.shove),
  };
}
// Missing Squares' saved shape: { spots, count }. A configuration saved
// back when only one pair existed ({ manual, random }) loads as a single
// spot with a count of 1.
function normalizeMissingSquare(src, cell) {
  const m = src && typeof src === "object" ? src : {};
  const raw = Array.isArray(m.spots) ? m.spots : m.manual ? [{ ...m.manual, random: !!m.random }] : [];
  const spots = [];
  raw.forEach((q) => {
    const c = cell(q);
    if (c && !spots.some((o) => o.row === c.row && o.col === c.col)) spots.push({ ...c, random: !!q.random });
  });
  const n = Number.isInteger(m.count) ? m.count : spots.length || 1;
  const count = Math.min(MAX_MISSING_PAIRS, Math.max(1, n));
  return { spots: spots.slice(0, count), count };
}
// Short human summary for a saved configuration's list row.
function describeSelections(sel) {
  const groups = buildVariantsSnapshot(sel);
  return groups.length ? groups.map((g) => `${g.label}: ${g.items.join(", ")}`).join("  ·  ") : "Standard rules";
}

// The CONFIGURATIONS label: a flat decal fixed at the sphere's SOUTH pole
// (the three categories sit on the equator). Not painted into the sphere's
// equirectangular text texture — text there smears badly at a pole — but
// its own plane, a child of the sphere group so it rotates with it; drag
// the sphere upward to tip the pole toward you.
const CONFIG_LABEL_W = 7.2, CONFIG_LABEL_H = 2.6;
function drawConfigLabel(ctx, canvas, count) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const active = count > 0;
  ctx.font = "700 92px 'Chakra Petch', sans-serif";
  ctx.shadowColor = "rgba(142,243,255,0.9)";
  ctx.shadowBlur = active ? 36 : 0;
  ctx.fillStyle = active ? "#dffaff" : "rgba(142,243,255,0.55)";
  ctx.fillText("CONFIGURATIONS", canvas.width / 2, canvas.height * 0.42);
  ctx.shadowBlur = 0;
  ctx.font = "400 32px 'IBM Plex Mono', monospace";
  ctx.fillStyle = active ? "rgba(223,250,255,0.75)" : "rgba(142,243,255,0.4)";
  ctx.fillText(count ? `${count} SAVED` : "TAP TO SAVE ONE", canvas.width / 2, canvas.height * 0.78);
}
function buildConfigLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 370;
  const ctx = canvas.getContext("2d");
  drawConfigLabel(ctx, canvas, 0);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG_LABEL_W, CONFIG_LABEL_H),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.FrontSide })
  );
  // Plane faces +Z with text-up +Y; tip it so it faces -Y (outward at the
  // south pole) with text-up +Z — upright once the sphere is dragged up
  // (rotation.x toward -90deg) to bring the pole around to the camera.
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, -6.03, 0);
  mesh.renderOrder = 2;
  // Parented to a pivot on the pole axis that cancels the sphere's own
  // left/right spin every frame (see updateSphereVisuals), so the words
  // always read upright when the pole is tipped toward you instead of
  // coming around at whatever angle the sphere happened to be spun.
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return { pivot, mesh, canvas, ctx, texture };
}

function buildSphere(markLabelsDirty) {
  const geo = new THREE.SphereGeometry(6, 64, 48);
  const text = buildSphereTextTexture(markLabelsDirty);
  const uniforms = {
    uPulsePhase: { value: 0 },
    uPulseAmount: { value: 0.22 },
    uRimColor: { value: new THREE.Vector3(0.4, 0.85, 1.0) },
    uTextMap: { value: text.texture },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: SPHERE_VERTEX, fragmentShader: SPHERE_FRAGMENT });
  const mesh = new THREE.Mesh(geo, material);
  const group = new THREE.Group();
  group.add(mesh);
  const configLabel = buildConfigLabel();
  group.add(configLabel.pivot);
  group.visible = false;
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (markLabelsDirty) markLabelsDirty(); });
  }
  return { group, mesh, material, uniforms, text, configLabel };
}

function ensureSingularityObjects(t) {
  const s = t.singularity;
  if (s.built) return;
  s.built = true;
  /* All the collapse FX are parented to the SCENE, not to boardGroup —
     the board itself now folds and sinks into the funnel (see
     updateBoardFold), and anything parented to it would shrink right
     along with it instead of staying the fixed thing it falls into.
     Losing boardGroup's heading rotation costs nothing here: every one
     of these is radially symmetric about the throat. */
  s.warpMesh = buildWarpMesh();
  t.scene.add(s.warpMesh);
  s.streaks = buildStreaks();
  t.scene.add(s.streaks.group);
  s.blastRings = buildBlastRings();
  t.scene.add(s.blastRings.group);
  s.debris = buildDebris();
  t.scene.add(s.debris.group);
  s.sphere = buildSphere(() => { s.labelsDirty = true; });
  // A parent frame turned (on arrival, see faceSphereNorthPole) so the
  // camera always sits on its +Z side — the sphere's own tilt/spin (and
  // the drag that drives them) then read the same whichever side of the
  // board the camera happens to be on.
  s.sphereFrame = new THREE.Group();
  s.sphereFrame.add(s.sphere.group);
  t.scene.add(s.sphereFrame);
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
      if (obj.isLineSegments && obj.material && obj.material.transparent) {
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

function updateCollapseVisuals(t, u, dt, now) {
  const s = t.singularity;
  s.warpMesh.visible = true;
  s.warpMesh.material.uniforms.uProgress.value = u;
  s.warpMesh.material.uniforms.uCool.value = Math.max(0, (u - COOL_BREAKPOINT) / (1 - COOL_BREAKPOINT));
  s.warpMesh.material.uniforms.uTime.value = (now - s.collapseStartedAt) / 1000;

  updateBlastRings(s, u, now);
  updateDebris(s, dt, now);
  updateBoardFold(t, u);
  updateCollapseCamera(t, u, now);
  updateChromeSuction(s, u);

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

/* Rings fire on a schedule that tightens as the collapse accelerates,
   each one expanding and fading as it goes. Ring 0 fires almost
   immediately so the collapse opens with a bang rather than easing in. */
function updateBlastRings(s, u, now) {
  s.blastRings.group.visible = true;
  if (now >= (s.nextRingAt || 0)) {
    spawnBlastRing(s, now, 0.4 + u);
    // 620ms between early rings down to ~120ms at the throat.
    s.nextRingAt = now + 120 + 500 * (1 - u);
  }
  s.blastRings.items.forEach((r) => {
    if (!r.active) return;
    const frac = (now - r.born) / r.life;
    if (frac >= 1) {
      r.active = false;
      r.material.opacity = 0;
      return;
    }
    const scale = 0.25 + r.maxScale * Math.pow(frac, 0.55);
    r.mesh.scale.set(scale, scale, scale);
    r.material.opacity = r.peak * (1 - frac) * (1 - frac);
  });
}

/* Shards are thrown outward, arc over, and are then dragged back down
   and inward — the "splash" reads as material escaping the throat and
   being reclaimed by it, not as a fountain. */
function updateDebris(s, dt, now) {
  s.debris.group.visible = true;
  if (now >= (s.nextDebrisAt || 0)) {
    const u = Math.min(1, (now - s.collapseStartedAt) / COLLAPSE_DURATION_MS);
    spawnDebrisBurst(s, now, 0.5 + u, 5 + Math.floor(u * 10));
    s.nextDebrisAt = now + 90 + 260 * (1 - u);
  }
  s.debris.items.forEach((d) => {
    if (!d.active) return;
    const frac = (now - d.born) / d.life;
    if (frac >= 1) {
      d.active = false;
      d.mesh.visible = false;
      d.material.opacity = 0;
      return;
    }
    d.vel.y -= 14 * dt; // gravity
    // Pulled back toward the throat, harder the longer it's been out.
    d.vel.x -= d.mesh.position.x * 3.2 * dt;
    d.vel.z -= d.mesh.position.z * 3.2 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.spin.x * dt;
    d.mesh.rotation.y += d.spin.y * dt;
    d.material.opacity = d.peak * (1 - frac);
  });
}

/* Camera judder and pull-in. Written straight onto the live camera
   rather than the chassis's cam goal: this tick runs AFTER the
   chassis's own applyCamera() and before the render, so a per-frame
   offset here is purely visual and needs no cleanup — the next frame's
   applyCamera() recomputes the real position from scratch, which is
   also exactly what restores the camera on escape, for free. */
/* The board doesn't just sit there being warped around any more — it
   folds along both horizontal axes, tumbles, and sinks down the throat
   with everything still on it. rotation.y is deliberately untouched:
   that's the heading applyCamera rewrites every frame. */
function updateBoardFold(t, u) {
  const g = t.boardGroup;
  if (!g) return;
  const bite = Math.pow(u, 1.7);
  // Squashed harder across X than Z, so it creases rather than simply
  // shrinking — a plate buckling as it goes in, not a dissolve.
  g.scale.set(1 - 0.92 * bite, 1 - 0.6 * bite, 1 - 0.78 * bite);
  g.rotation.x = 0.9 * bite;
  g.rotation.z = -0.55 * bite;
  g.position.y = -14 * Math.pow(u, 2.4);
}

function updateCollapseCamera(t, u, now) {
  const camera = t.camera;
  if (!camera) return;
  const bite = Math.pow(u, 1.8);
  /* Flown down INTO the throat, but deliberately not through it. An
     earlier pass dove far harder (0.9 / -9) and the camera came out the
     far side into empty space, so the last ~0.5s before the cut — the
     climax — played as a blank black frame. This lands it just under
     the board's plane with the funnel walls wrapping the frame, and
     holds it there. */
  camera.position.multiplyScalar(1 - 0.72 * bite);
  camera.position.y -= 5.5 * Math.pow(u, 2);
  const shake = 0.35 + 2.4 * Math.pow(u, 2.6);
  camera.position.x += (Math.random() - 0.5) * shake;
  camera.position.y += (Math.random() - 0.5) * shake;
  camera.position.z += (Math.random() - 0.5) * shake;
  // Roll off-axis, with a judder that gets coarser as it goes — the
  // horizon stops being level, which is what sells "being pulled in"
  // over "zooming in".
  const roll = 1.5 * bite + Math.sin(now / 55) * 0.16 * bite + (Math.random() - 0.5) * 0.09 * bite;
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(0, -3.5 * bite, 0);
}

/* camera.up is persistent state, unlike camera.position — applyCamera()
   rewrites position every frame but reads `up` as it finds it, so the
   roll updateCollapseCamera applies would otherwise survive the
   cinematic and leave the board sitting at a dutch angle forever. */
function resetCameraRoll(t) {
  if (t.camera) t.camera.up.set(0, 1, 0);
}

/* Same class of persistent state as camera.up: applyCamera only ever
   rewrites boardGroup.rotation.y, so the fold's scale, position and
   other two rotation axes survive until something puts them back. */
function resetBoardFold(t) {
  const g = t.boardGroup;
  if (!g) return;
  g.scale.set(1, 1, 1);
  g.rotation.x = 0;
  g.rotation.z = 0;
  g.position.y = 0;
}

/* The masthead and dock get sucked in too, not just faded — scaled
   down toward the funnel's screen position (the viewport centre, where
   the board sits) while spinning and blurring out. Uses the standalone
   scale/rotate/translate CSS properties rather than `transform`, which
   React owns on these elements (the dock's own translateX(-50%)
   centring lives there) and would be clobbered by writing to it. */
function updateChromeSuction(s, u) {
  if (!s.chromeRefs) return;
  const bite = Math.pow(u, 1.3);
  const scale = Math.max(0.05, 1 - 0.95 * bite);
  const spin = 28 * bite;
  const blur = 7 * bite;
  const fade = Math.max(0, 1 - Math.pow(u, 0.75) * 1.25);
  // The masthead and the floating dock piece both get pulled into the
  // funnel. NOT the dock panel (cardRef): it's hidden during setup, and
  // its opacity is React-owned — animating it here and clearing it on
  // teardown left the panel stranded visible once the game began.
  [s.chromeRefs.titleWrapRef, s.chromeRefs.dockPieceMountRef].forEach((ref, i) => {
    const el = ref && ref.current;
    if (!el) return;
    el.style.transformOrigin = "50% 50%";
    el.style.scale = String(scale);
    el.style.rotate = `${i ? spin : -spin}deg`;
    el.style.filter = `blur(${blur}px)`;
    el.style.opacity = String(fade);
    el.style.pointerEvents = "none";
  });
}

/* Full-screen digital chaos over the last stretch of the collapse,
   painted into the chassis's existing FX overlay slot (a DOM layer
   sitting directly over the canvas). Hard strobing colour hits rather
   than a smooth wash — this is the bit that's meant to feel like the
   picture itself is breaking up right before the cut. Inline styles
   only, all cleared on the way out, so the theme's own class-driven
   VHS effect that shares this element is unaffected. */
const CHAOS_COLORS = ["#4de8ff", "#8a5cff", "#dfeaff", "#0b1a3a"];
function updateScreenChaos(s, u) {
  const el = s.chromeRefs && s.chromeRefs.fxOverlayRef && s.chromeRefs.fxOverlayRef.current;
  if (!el) return;
  if (u < 0.55) return;
  const bite = (u - 0.55) / 0.45;
  // Strobe probability and intensity both climb; between hits the
  // overlay drops back to fully transparent, so it reads as flicker.
  if (Math.random() < 0.15 + 0.7 * bite) {
    el.style.background = CHAOS_COLORS[Math.floor(Math.random() * CHAOS_COLORS.length)];
    // Climbs hard at the end: the frame right before the cut should be
    // barely legible, so the cut lands on something already breaking up
    // rather than on a clean picture.
    el.style.opacity = String(0.04 + Math.random() * (0.25 + 0.5 * bite * bite));
  } else {
    el.style.opacity = "0";
  }
}

function clearScreenChaos(s) {
  const el = s.chromeRefs && s.chromeRefs.fxOverlayRef && s.chromeRefs.fxOverlayRef.current;
  if (!el) return;
  el.style.background = "";
  /* Explicitly 0, NOT "" — the chassis sets opacity:0 on this element as
     a React inline style, so clearing the property outright doesn't
     restore that, it removes it, and the theme's own .ec-fx-overlay
     scanline layer underneath becomes permanently visible over the
     whole game. (Which is exactly what happened the first time.) */
  el.style.opacity = "0";
}

function updateSphereVisuals(t, dt) {
  const s = t.singularity;
  // Redrawn only on demand (a checkbox/drum change, a fonts-ready
  // callback, or the initial default paint), not every frame — the
  // canvas is cheap but there's no reason to touch it 60x/s when
  // nothing about the selections changed.
  if (s.labelsDirty && s.sphere) {
    drawRootLabels(s.sphere.text.canvas, s.sphere.text.ctx, s.selections, s.rootLabels);
    s.sphere.text.texture.needsUpdate = true;
    const cl = s.sphere.configLabel;
    drawConfigLabel(cl.ctx, cl.canvas, loadConfigurations().length);
    cl.texture.needsUpdate = true;
    s.labelsDirty = false;
  }

  // Finalizing (triple-tap) hides the sphere itself per the spec, but
  // the starfield stays as the summary menu's backdrop.
  s.sphere.group.visible = s.sphereMenuStage !== "summary";
  s.starfield.visible = true;
  if (s.sphereMenuStage === "summary") return; // nothing left to animate

  // The words are painted onto the sphere's surface at its fixed
  // geometric equator (LABEL_CENTER_V) — never re-centered here.
  // Dragging rotates the sphere itself, words and all, exactly like
  // spinning a globe: tilt it far enough and the equatorial band
  // rotates up toward a pole and out of legible view, rather than the
  // text sliding around to keep facing the camera. (An earlier version
  // of this function re-picked the latitude to draw on every frame to
  // chase wherever the camera looked — that made the words visibly
  // compress as the sphere tipped, since each frame sampled a
  // different, more pole-adjacent ring instead of the same ring just
  // turning away. This is the corrected model.)

  // Actual angular velocity eases toward a target every frame — the
  // SAME smoothing whether that target is "whatever the live drag
  // currently implies" (giving real acceleration: a sudden flick
  // doesn't instantly snap the sphere to full speed) or zero (giving
  // real deceleration: releasing, or simply holding still mid-drag,
  // eases the spin down instead of it either freezing solid or
  // dropping to zero the instant the last pointermove stops arriving).
  // Replaces the previous model, which applied each pointermove's
  // rotation directly and instantly — exactly what read as "too
  // sensitive," since every raw, sometimes-jittery browser pointer
  // event drove the sphere 1:1 with zero smoothing.
  const target = s.dragging ? s.dragTargetVelocity : ZERO_DRAG_VELOCITY;
  const smoothing = 1 - Math.exp(-dt * (s.dragging ? DRAG_VELOCITY_SMOOTHING : RELEASE_VELOCITY_DECAY));
  s.dragVelocity.x += (target.x - s.dragVelocity.x) * smoothing;
  s.dragVelocity.y += (target.y - s.dragVelocity.y) * smoothing;
  s.sphere.group.rotation.x += s.dragVelocity.x * dt;
  s.sphere.group.rotation.y += s.dragVelocity.y * dt;
  if (s.sphere.configLabel) s.sphere.configLabel.pivot.rotation.y = -s.sphere.group.rotation.y;

  s.pulsePhase = (s.pulsePhase || 0) + dt * PULSE_SPEED;
  s.sphere.uniforms.uPulsePhase.value = s.pulsePhase;
}

/* On arrival the sphere turns its NORTH pole straight at the camera.
   1. The parent frame turns so the camera sits on the frame's +Z side.
   2. With the sphere level, a raycast through its on-screen center finds
      which longitude faces the camera, and the spin (rotation.y) puts the
      front root label (u = 0.5) there.
   3. The tilt (rotation.x) then tips the north pole up to meet the
      camera's line of sight, elevation included. Dragging upward tips it
      back down to the equator, landing on that front label. */
function faceSphereNorthPole(t, s) {
  if (!s.sphere || !t.camera) return;
  const g = s.sphere.group;
  const d = t.camera.position.clone().sub(g.getWorldPosition(new THREE.Vector3()));
  if (s.sphereFrame) s.sphereFrame.rotation.y = Math.atan2(d.x, d.z);
  g.rotation.set(0, 0, 0);
  if (s.sphereFrame) s.sphereFrame.updateMatrixWorld(true);
  if (t.raycaster && t.pointer) {
    const ndc = g.getWorldPosition(new THREE.Vector3()).project(t.camera);
    t.pointer.set(ndc.x, ndc.y);
    t.raycaster.setFromCamera(t.pointer, t.camera);
    const hits = t.raycaster.intersectObject(s.sphere.mesh);
    if (hits.length && hits[0].uv) g.rotation.y = (hits[0].uv.x - 0.5) * Math.PI * 2;
  }
  // In the frame the camera is at (0, d.y, horizontal distance); tilting
  // by θ about X carries the pole (0,1,0) to (0, cos θ, sin θ).
  g.rotation.x = Math.atan2(Math.hypot(d.x, d.z), d.y);
  s.northPoleTilt = g.rotation.x;
}

function teardownSingularityScene(t) {
  const s = t.singularity;
  if (!s) return;
  if (s.warpMesh) s.warpMesh.visible = false;
  if (s.streaks) s.streaks.group.visible = false;
  if (s.sphere) s.sphere.group.visible = false;
  if (s.starfield) s.starfield.visible = false;
  if (s.blastRings) {
    s.blastRings.group.visible = false;
    s.blastRings.items.forEach((r) => { r.active = false; r.material.opacity = 0; });
  }
  if (s.debris) {
    s.debris.group.visible = false;
    s.debris.items.forEach((d) => { d.active = false; d.material.opacity = 0; d.mesh.visible = false; });
  }
  s.nextRingAt = 0;
  s.nextDebrisAt = 0;
  clearScreenChaos(s);
  resetCameraRoll(t);
  resetBoardFold(t);
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
  // Level the sphere again: a visit that tipped it up to the south-pole
  // CONFIGURATIONS label must not make the next visit open pole-first with
  // the equator labels out of view. (Spin around the pole is re-aimed on
  // arrival anyway.)
  if (s.sphere) s.sphere.group.rotation.x = 0;
  s.dragVelocity = { x: 0, y: 0 };
  s.dragTargetVelocity = { x: 0, y: 0 };
  s.dragging = false;
  s.pulsePhase = 0;
  // Every fresh visit starts back at the root labels, not wherever a
  // previous visit left off (mid-overlay, or past the triple-tap
  // finalize with the sphere hidden) — the same "each visit is
  // independent" reasoning teardown already applies to drag momentum
  // and pulse phase above.
  s.sphereMenuStage = "labels";
  s.activeCategory = null;
  s.selections = createDefaultSelections();
  s.tapTimestamps = [];
  s.labelsDirty = true;
  s.blackHolePicker = false;
  s.blackHolePickConfirm = null;
  s.missingSquaresPicker = false;
  s.missingSquaresPickConfirm = null;
  s.configHover = null;
  s.configNotice = null;
  s.configPendingDelete = null;
  s.loadedConfigName = null;
  if (t.singularityGridMaterials) {
    t.singularityGridMaterials.forEach((m) => { m.opacity = m.userData.singularityBaseOpacity; });
  }
  if (s.blackDivRef && s.blackDivRef.current) {
    s.blackDivRef.current.style.transition = "";
    s.blackDivRef.current.style.opacity = "0";
  }
  if (s.chromeRefs) {
    [s.chromeRefs.titleWrapRef, s.chromeRefs.dockPieceMountRef].forEach((ref) => {
      if (ref && ref.current) {
        const el = ref.current;
        el.style.transition = "";
        el.style.opacity = "";
        el.style.pointerEvents = "";
        // Everything updateChromeSuction touched, back to the stylesheet's
        // own values — note `transform` is deliberately never in this
        // list, because it's React's and was never written to.
        el.style.scale = "";
        el.style.rotate = "";
        el.style.filter = "";
        el.style.transformOrigin = "";
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
  // TOLLING is a pure DOM/audio lead-in (bell + fading black curtain over
  // the still-normal board) — no 3D scene work, no chrome suction, no
  // object building until the collapse proper begins.
  if (!s || !s.phase || s.phase === PHASES.IDLE || s.phase === PHASES.TOLLING) return;
  ensureSingularityObjects(t);
  const dt = s.lastTickAt ? Math.min((now - s.lastTickAt) / 1000, 0.05) : 0.016;
  s.lastTickAt = now;

  // The overlay only takes over the 3D canvas — the masthead and dock
  // are separate DOM layers stacked ABOVE it, so they have to be dealt
  // with explicitly or they'd still show through once the black cutout
  // fades for the sphere reveal. They're animated per-frame by
  // updateChromeSuction (below) rather than simply faded, so they get
  // pulled into the funnel along with everything else.
  if (chromeRefs && !s.chromeHidden) {
    s.chromeHidden = true;
    s.chromeRefs = chromeRefs;
    [chromeRefs.titleWrapRef, chromeRefs.dockPieceMountRef].forEach((ref) => {
      if (ref && ref.current) {
        // No CSS transition: every frame writes its own value, and a
        // transition would just smear them against each other.
        ref.current.style.transition = "none";
      }
    });
    // A direct sphere entry (enterSphereDirect, the RECONFIGURE path out
    // of the Win -> New Game dialog) skips the whole collapse that would
    // normally suck the masthead/dock away frame by frame across
    // COLLAPSING -- this is the first tick chromeRefs is available, and
    // the phase is ALREADY sphere, so snap them straight to updateChromeSuction's
    // own u=1 end state instead of leaving them lingering, fully visible,
    // behind the sphere overlay.
    if (s.phase === PHASES.SPHERE) updateChromeSuction(s, 1);
  }

  switch (s.phase) {
    case PHASES.COLLAPSING: {
      const u = Math.min(1, (now - s.collapseStartedAt) / COLLAPSE_DURATION_MS);
      updateCollapseVisuals(t, u, dt, now);
      updateScreenChaos(s, u);
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
        s.blastRings.group.visible = false;
        s.debris.group.visible = false;
        clearScreenChaos(s);
        resetCameraRoll(t);
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
        /* Faces the checklist toward wherever the camera actually ends
           up, rather than assuming a fixed "u=0.5 is front-facing"
           longitude. That assumption doesn't hold: the sphere's own
           group always starts at rotation.y=0, but the CAMERA's
           position depends on cam.current.theta, which carries over
           from whatever the board's heading was (itself dependent on
           which side was set to move first — see the turn-pill toggle)
           — so "front-facing" genuinely varies run to run. By now
           (BLACKOUT has fully elapsed) the chassis's own applyCamera()
           has long since reverted the camera to its normal resting
           position, so this raycast reads the real, final geometry. */
        // Aims the front label, then turns the north pole to the player
        // — see faceSphereNorthPole (the raycast goes through the
        // sphere's own on-screen center, not the viewport's, since UI
        // chrome can make the sphere sit off-center).
        faceSphereNorthPole(t, s);
        // The blackout div is opaque and sits above the main canvas —
        // it has to fade back down for the sphere/starfield (already
        // rendering underneath it) to actually become visible. A soft
        // reveal here (unlike the instant collapsing->blackout cut,
        // which must stay a hard cut) matches "after the transition
        // settles" reading as a settling-in, not another jarring snap.
        if (s.blackDivRef && s.blackDivRef.current) {
          s.blackDivRef.current.style.transition = `opacity ${SPHERE_FADE_IN_MS}ms ease`;
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
      sphereRotationX: s.sphere ? s.sphere.group.rotation.x : null,
      // How squarely the north pole faces the camera (1 = dead on).
      northPoleFacing: s.sphere && t.camera ? (() => {
        const c = s.sphere.group.getWorldPosition(new THREE.Vector3());
        const pole = new THREE.Vector3(0, 1, 0).transformDirection(s.sphere.group.matrixWorld);
        return pole.dot(t.camera.position.clone().sub(c).normalize());
      })() : null,
      stage: s.sphereMenuStage || null,
      activeCategory: s.activeCategory || null,
      selections: s.selections ? JSON.parse(JSON.stringify(s.selections)) : null,
      // This cycle's MATTER/LAWS/TOPOLOGIES -> u-slot arrangement (see
      // shuffleRootLabels) — exposed so tests can find a given category
      // deterministically instead of assuming a fixed layout.
      rootLabels: s.rootLabels ? s.rootLabels.map((r) => ({ key: r.key, u: r.u })) : null,
      // Where the south-pole CONFIGURATIONS label is on screen and whether it
      // currently faces the camera (so a test can drag it into view and tap it).
      configLabel: (() => {
        const cl = s.sphere && s.sphere.configLabel;
        if (!cl || !t.camera) return null;
        const wp = new THREE.Vector3();
        cl.mesh.getWorldPosition(wp);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(cl.mesh.getWorldQuaternion(new THREE.Quaternion()));
        const toCam = t.camera.position.clone().sub(wp).normalize();
        const ndc = wp.clone().project(t.camera);
        return { facing: n.dot(toCam), x: (ndc.x + 1) / 2 * window.innerWidth, y: (1 - ndc.y) / 2 * window.innerHeight };
      })(),
      collapseU: s.phase === PHASES.COLLAPSING
        ? Math.min(1, (now - s.collapseStartedAt) / COLLAPSE_DURATION_MS)
        : null,
    };
  }
}

/* ---------------------------------------------------------------------
   React-facing hook + overlay — the two seams useSetupExtras and
   renderExtraOverlays call into (themes/neon.js).
--------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   DOM widgets for the holographic overlays and the summary menu —
   real interactive controls (checkboxes, a 3D drum-roller tumbler),
   unlike the sphere's own canvas-texture root labels. State they touch
   lives on t.singularity (the same plain bridge object the 3D side
   already uses — see the module header), not React state: a checkbox
   click mutates it directly and then calls the bump() function stashed
   on the bridge (see useSingularityPhase) to force the one re-render
   that shows the change, the same "plain bridge, force a React render
   when something needs to be seen" split the whole file already uses
   for phase/setPhase.
--------------------------------------------------------------------- */

const overlayTitleStyle = {
  margin: "0 0 14px",
  fontFamily: "'Chakra Petch', sans-serif",
  fontWeight: 700,
  fontSize: 17,
  letterSpacing: "0.12em",
  color: "#66d9ff",
  textShadow: "0 0 16px rgba(102,217,255,0.5)",
  textAlign: "center",
};
const sectionLabelStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10.5,
  letterSpacing: "0.12em",
  color: "rgba(142,243,255,0.55)",
  textTransform: "uppercase",
  margin: "4px 0",
};
const chevronButtonStyle = {
  background: "transparent",
  border: "none",
  color: "rgba(142,243,255,0.7)",
  fontSize: 10,
  cursor: "pointer",
  padding: "2px 0",
  lineHeight: 1,
};

/* A small isometric-tile glyph built straight from a piece's footprint
   (PIECE_FOOTPRINTS) — so the MATTER menu shows what's actually being
   selected instead of naming it and hoping. Flat diamond tiles rather
   than extruded cubes deliberately: at the ~40px this renders at (nine
   of these on screen at once — four new pieces plus five roster
   wheels — leaves no room for a bigger one), a cube's side faces
   mostly just overlap their neighbors and blur the silhouette; a bare
   tile per occupied cell reads as the actual footprint shape at a
   glance, which is the one thing this icon needs to do. Same
   isometric placement math the real board's top-down camera angle
   already evokes, just drawn directly rather than rendered. */
const ISO_STEP_X = 13, ISO_STEP_Y = 8, ISO_TILE_W = 11, ISO_TILE_H = 6.5;
function isoTilePath(cx, cy) {
  const w = ISO_TILE_W, h = ISO_TILE_H;
  return `M ${cx},${cy - h} L ${cx + w},${cy} L ${cx},${cy + h} L ${cx - w},${cy} Z`;
}
function renderPieceIcon(footprintKey, size) {
  const cells = PIECE_FOOTPRINTS[footprintKey];
  if (!cells) return null;
  const h = React.createElement;
  const cols = cells.map((c) => c[0]);
  const rows = cells.map((c) => c[1]);
  const midCol = (Math.min(...cols) + Math.max(...cols)) / 2;
  const midRow = (Math.min(...rows) + Math.max(...rows)) / 2;
  const tiles = cells.map(([col, row], i) => {
    const cx = 50 + (col - midCol - (row - midRow)) * ISO_STEP_X;
    const cy = 32 + (col - midCol + (row - midRow)) * ISO_STEP_Y;
    return h("path", {
      key: i,
      d: isoTilePath(cx, cy),
      fill: "rgba(142,243,255,0.4)",
      stroke: "rgba(223,250,255,0.95)",
      strokeWidth: 1.5,
      strokeLinejoin: "round",
    });
  });
  return h(
    "svg",
    { width: size || 40, height: size || 40, viewBox: "0 0 100 64", style: { flexShrink: 0, display: "block" } },
    ...tiles
  );
}

/* A CSS-3D "drum roller" tumbler — a combination-lock-style wheel for
   an integer value, used for both TOPOLOGIES' board dimensions and
   MATTER's per-piece roster counts. Values clamp at min/max rather
   than wrapping — looping a board dimension or a piece count past its
   cap back around to the other end would read as a glitch, not a
   feature. Driven two ways, like a real date-picker wheel: a vertical
   drag (the actual "roll" feel the spec asks for) and +/- taps (what
   the e2e suite drives, since simulating an exact-value drag
   gesture reliably is much harder than clicking a button a known
   number of times). */
function DrumRoller({ id, label, value, min, max, onChange, compact, icon }) {
  const h = React.createElement;
  const dragRef = React.useRef(null);
  const ITEM_H = compact ? 28 : 36;
  const RADIUS = compact ? 44 : 58;
  const ANGLE_STEP = (2 * Math.asin(Math.min(1, ITEM_H / (2 * RADIUS))) * 180) / Math.PI;
  const clamp = (v) => Math.min(max, Math.max(min, v));

  function handlePointerDown(e) {
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startValue: value };
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dy = e.clientY - dragRef.current.startY;
    const steps = Math.round(dy / ITEM_H);
    const next = clamp(dragRef.current.startValue + steps);
    if (next !== value) onChange(next);
  }
  function handlePointerUp(e) {
    e.stopPropagation();
    dragRef.current = null;
  }

  const items = [];
  for (let d = -2; d <= 2; d++) {
    const v = value + d;
    if (v < min || v > max) continue;
    items.push(
      h(
        "div",
        {
          key: v,
          style: {
            position: "absolute", left: 0, right: 0, top: "50%", height: ITEM_H,
            lineHeight: `${ITEM_H}px`, textAlign: "center",
            transform: `translateY(-50%) rotateX(${-d * ANGLE_STEP}deg) translateZ(${RADIUS}px)`,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: d === 0 ? (compact ? 17 : 21) : 13,
            fontWeight: d === 0 ? 700 : 400,
            color: d === 0 ? "#dffaff" : "rgba(142,243,255,0.35)",
            backfaceVisibility: "hidden",
          },
        },
        String(v)
      )
    );
  }

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
    icon && renderPieceIcon(icon, compact ? 38 : 46),
    label && h("span", { style: { ...sectionLabelStyle, margin: 0 } }, label),
    h(
      "button",
      { type: "button", "data-testid": `${id}-inc`, onClick: (e) => { e.stopPropagation(); onChange(clamp(value + 1)); }, style: chevronButtonStyle },
      "▲"
    ),
    h(
      "div",
      {
        "data-testid": `${id}-drum`,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
        style: {
          position: "relative", width: compact ? 58 : 74, height: ITEM_H * 1.5,
          perspective: 300, overflow: "hidden", touchAction: "none", cursor: "ns-resize",
          background: "rgba(102,217,255,0.06)",
          border: "1px solid rgba(102,217,255,0.28)",
          borderRadius: 4,
        },
      },
      h("div", { style: { position: "absolute", inset: 0, transformStyle: "preserve-3d" } }, ...items)
    ),
    h(
      "button",
      { type: "button", "data-testid": `${id}-dec`, onClick: (e) => { e.stopPropagation(); onChange(clamp(value - 1)); }, style: chevronButtonStyle },
      "▼"
    ),
    h(
      "span",
      { "data-testid": `${id}-value`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(142,243,255,0.5)" } },
      String(value)
    )
  );
}

function renderCheckboxRow(item, checked, onToggle, testId, onInfo = null) {
  const h = React.createElement;
  return h(
    "div",
    {
      key: item.key,
      "data-testid": testId,
      "data-checked": checked ? "true" : "false",
      onClick: () => onToggle(),
      style: { display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 2px", cursor: "pointer" },
    },
    h("div", {
      style: {
        width: 24, height: 24, flexShrink: 0, marginTop: 2,
        border: `2px solid ${checked ? "#8ef3ff" : "rgba(142,243,255,0.5)"}`,
        background: checked ? "rgba(142,243,255,0.85)" : "transparent",
        borderRadius: 3,
      },
    }),
    item.icon && renderPieceIcon(item.icon, 40),
    h(
      "div",
      null,
      h(
        "div",
        { style: { fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 13.5, color: checked ? "#dffaff" : "rgba(207,216,220,0.9)", letterSpacing: "0.03em" } },
        item.label
      ),
      item.blurb &&
        h(
          "div",
          { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.58)", marginTop: 2, lineHeight: 1.4 } },
          item.blurb
        )
    ),
    // A small "i" at the row's end opens this rule's card (MOVES tab).
    onInfo &&
      h(
        "button",
        {
          type: "button",
          "data-testid": `${testId}-info`,
          "aria-label": `How ${item.label} works`,
          onClick: (e) => { e.stopPropagation(); onInfo(); },
          style: {
            marginLeft: "auto", flexShrink: 0, width: 20, height: 20, marginTop: 3, padding: 0, borderRadius: "50%", cursor: "pointer",
            border: "1px solid rgba(142,243,255,0.3)", background: "transparent", color: "rgba(142,243,255,0.6)",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, lineHeight: "18px", fontStyle: "italic",
          },
        },
        "i"
      )
  );
}

/* The Black Hole Squares placement control, shown under the LAWS
   checkboxes once that law is on. By default the two holes are placed
   automatically (random but fair); this lets the player instead pick the
   cell on their own side of the board, its 180-degree mirror becoming the
   paired hole. Reads/writes t.singularity.selections.blackHole directly,
   the same live-bridge pattern the checkboxes use. */
/* Shared by Black Hole Squares (LAWS) and Missing Squares (TOPOLOGIES):
   both place a manually-pickable, rotationally-mirrored pair of squares
   via an identical ghost-grid picker, differing only in text/testids and
   which selections field they read/write. `kind` picks one of these. */
const PAIRED_SQUARE_KINDS = {
  blackHole: {
    manualField: "blackHole",
    pickerFlag: "blackHolePicker",
    confirmFlag: "blackHolePickConfirm",
    title: "Place Black Hole",
    pairedNoun: "hole",
    cellPrefix: "bh-cell",
    placementTestid: "blackhole-placement",
    placeBtnTestid: "blackhole-place-btn",
    pickerTestid: "blackhole-picker",
    backdropTestid: "blackhole-picker-backdrop",
    cancelTestid: "blackhole-picker-cancel",
    confirmTestid: "blackhole-confirm",
  },
  missingSquare: {
    manualField: "missingSquare",
    pickerFlag: "missingSquaresPicker",
    confirmFlag: "missingSquaresPickConfirm",
    title: "Place Missing Square",
    pairedNoun: "missing square",
    cellPrefix: "missing-cell",
    placementTestid: "missing-placement",
    placeBtnTestid: "missing-place-btn",
    pickerTestid: "missing-picker",
    backdropTestid: "missing-picker-backdrop",
    cancelTestid: "missing-picker-cancel",
    confirmTestid: "missing-confirm",
  },
};

/* Generic accessors over the two features' selections shapes: Black
   Holes hold a single { manual, random } spot, Missing Squares a list of
   { row, col, random } spots (up to `count`). Each spot is the player's-
   side half of a pair; the 180-degree mirror is its partner. */
function otherPairedKind(kind) {
  return kind === "blackHole" ? "missingSquare" : "blackHole";
}
function pairedFeatureOn(sel, kind) {
  return kind === "blackHole" ? !!sel.laws.blackHoleSquares : !!sel.topologies.missingSquares;
}
function pairedCount(sel, kind) {
  return kind === "blackHole" ? 1 : sel.missingSquare.count;
}
function pairedSpots(sel, kind) {
  if (kind === "blackHole") {
    const b = sel.blackHole;
    return b.manual ? [{ row: b.manual.row, col: b.manual.col, random: !!b.random }] : [];
  }
  return sel.missingSquare.spots;
}
function setPairedSpots(sel, kind, spots) {
  if (kind === "blackHole") {
    const p = spots[0];
    sel.blackHole = p ? { manual: { row: p.row, col: p.col }, random: !!p.random } : { manual: null, random: true };
  } else {
    sel.missingSquare = { ...sel.missingSquare, spots: spots.map((p) => ({ row: p.row, col: p.col, random: !!p.random })) };
  }
}
// Every square (spots + mirrors) a list of spots covers on this board.
function spotCells(spots, rows, cols) {
  const out = [];
  spots.forEach((p) => {
    if (p.row < rows && p.col < cols) out.push({ row: p.row, col: p.col }, mirrorCell(p.row, p.col, rows, cols));
  });
  return out;
}
// Every square a feature currently covers — [] when it's off.
function pairedCells(sel, kind) {
  if (!pairedFeatureOn(sel, kind)) return [];
  const { rows, cols } = sel.topologies;
  return spotCells(pairedSpots(sel, kind), rows, cols);
}
// Rows a feature's spot may sit in: the player's side (the bottom
// floor(rows/2) rows — the mirror lands on top), and for Black Holes
// never either side's back two rows.
function pairedRowAllowed(kind, r, rows) {
  return r >= rows - Math.floor(rows / 2) && r < rows && (kind !== "blackHole" || blackHoleRowAllowed(r, rows));
}

/* "Random" is a real, concrete spot rolled NOW (and stored with
   random:true), not a deferral to Begin Game — so the other feature's
   picker, the summary and a saved configuration all see it. Rolled on the
   player's side (the mirror pairs on the far side), off the standard
   opening pieces for the chosen board size, off the other feature's
   squares, and — for Black Holes — out of both back two rows. Missing
   Squares also never wall off part of the board (missingSquaresKeepPath).
   A customized/randomized MATTER opening is placed around them at Begin
   Game; if a piece still ends up on one there, Begin falls back to a
   fresh roll.

   fillPairedSpots keeps every still-valid spot (hand-picked first, then
   random ones unless `rerollRandom`), trims to the feature's count —
   random spots go first — and fills any shortfall at random. */
function fillPairedSpots(s, kind, rerollRandom) {
  const sel = s.selections;
  const { rows, cols } = sel.topologies;
  const count = pairedCount(sel, kind);
  const pieces = initialPiecesFor(rows, cols);
  const avoid = pairedCells(sel, otherPairedKind(kind));
  const current = pairedSpots(sel, kind);
  const kept = [];
  const fits = (p) => {
    if (!pairedRowAllowed(kind, p.row, rows) || p.col >= cols) return false;
    const m = mirrorCell(p.row, p.col, rows, cols);
    if (cellOccupied(pieces, p.row, p.col) || cellOccupied(pieces, m.row, m.col)) return false;
    if (cellReserved(avoid, p.row, p.col) || cellReserved(avoid, m.row, m.col)) return false;
    if (kept.some((q) => q.row === p.row && q.col === p.col)) return false;
    return kind === "blackHole" || missingSquaresKeepPath(spotCells([...kept, p], rows, cols), rows, cols);
  };
  current.filter((p) => !p.random).forEach((p) => { if (kept.length < count && fits(p)) kept.push({ ...p, random: false }); });
  if (!rerollRandom) current.filter((p) => p.random).forEach((p) => { if (kept.length < count && fits(p)) kept.push({ ...p, random: true }); });
  const playerSideStart = rows - Math.floor(rows / 2);
  for (let tries = 0; kept.length < count && tries < 40; tries++) {
    const pair = kind === "blackHole"
      ? pickBlackHoleSquares(pieces, rows, cols, avoid)
      : pickMissingSquares(pieces, rows, cols, avoid, 200, spotCells(kept, rows, cols));
    if (!pair.length) break;
    const mine = pair.find((q) => q.row >= playerSideStart);
    if (mine) kept.push({ row: mine.row, col: mine.col, random: true });
  }
  setPairedSpots(sel, kind, kept);
  return kept.length === count;
}
/* The Random button: re-rolls just the random spots, keeping hand-picked
   ones — or, when every spot is hand-picked, re-rolls them all. */
function randomizePairedSpots(s, kind) {
  const spots = pairedSpots(s.selections, kind);
  const allHand = spots.length >= pairedCount(s.selections, kind) && spots.every((p) => !p.random);
  if (allHand) setPairedSpots(s.selections, kind, []);
  return fillPairedSpots(s, kind, true);
}
// When the board size changes, spots that were rolled at random re-roll
// for the new size; hand-picked spots stay while they still fit.
function rerollRandomPairedSquares(s) {
  if (s.selections.topologies.missingSquares) fillPairedSpots(s, "missingSquare", true);
  if (s.selections.laws.blackHoleSquares) fillPairedSpots(s, "blackHole", true);
}

// Opens a rules card in the chassis's INFO overlay (chassis/RulesCards.jsx
// listens for this event; the name must match its OPEN_RULES_EVENT).
function openRulesCard(tab, focus = null) {
  window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab, focus } }));
}

// Pieces that can ever stand balanced on one cube (so can Cantilever
// Pivot): checked against every orientation in engine/shapes.js.
const PIVOT_CAPABLE_ROSTER = ["codo", "rayo", "zeta"];

// A law that's on but can't do anything with the other settings, and
// why: shown under the law's own row. Shoving's own cases live in
// shoveWarning (under its settings).
function lawWarning(key, sel) {
  const laws = sel.laws || {};
  if (!laws[key]) return null;
  if (key === "diagonalSlide" && !laws.slide)
    return { testid: "law-warning-diagonalSlide", text: "Diagonal Slide only works with Slide. Turn on Slide." };
  if (key === "cantileverPivot") {
    const roster = (sel.matter && sel.matter.roster) || {};
    if (!PIVOT_CAPABLE_ROSTER.some((k) => roster[k] > 0))
      return { testid: "law-warning-cantileverPivot", text: "Only a Codo, Rayo or Zeta can pivot. Add one in MATTER." };
  }
  return null;
}
function renderLawWarning(w) {
  return React.createElement(
    "div",
    {
      key: w.testid,
      role: "status",
      "data-testid": w.testid,
      style: { margin: "0 0 8px 36px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, lineHeight: 1.45, color: "rgba(255,214,150,0.85)", borderLeft: "2px solid rgba(255,196,110,0.55)", paddingLeft: 8 },
    },
    w.text
  );
}

// Why the chosen Shoving settings can never shove, if they can't.
function shoveWarning(sel) {
  if (!sel.shove) return null;
  const laws = sel.laws || {};
  if (sel.shove.onRolls) {
    // Rolls shove for 2, but an Opa's move already costs 2: its shove is 3.
    const opas = (sel.matter && sel.matter.roster && sel.matter.roster.opa) || 0;
    if (opas > 0 && !laws.threeActions)
      return { testid: "shove-opa-needs-three", text: "An Opa's shove costs 3 points, so Opas can only shove with 3 Actions Per Turn." };
    return null;
  }
  if (!laws.slide) return { testid: "shove-needs-slide", text: "SLIDES ONLY requires the Slide law. Turn on Slide, or choose SLIDES AND ROLLS." };
  if (!laws.threeActions) return { testid: "shove-needs-three", text: "A shoving slide costs 3 points, so SLIDES ONLY requires 3 Actions Per Turn. Turn it on, or choose SLIDES AND ROLLS." };
  return null;
}

/* The Shoving law's two settings, directly under its checkbox (like
   Black Hole placement under its own): push distance and which moves
   shove. Each is a two-way segmented control. A note spells out the
   point cost, since a slide (2) plus a shove (1) needs 3 points. */
function renderShoveSettingsRow(t) {
  const s = t.singularity;
  const h = React.createElement;
  const sel = s.selections;
  if (!sel.shove) sel.shove = { far: false, onRolls: false };
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  return h(
    "div",
    {
      key: "shove-settings",
      "data-testid": "shove-settings",
      style: { margin: "0 0 6px 36px", padding: "9px 11px", border: "1px solid rgba(102,217,255,0.22)", borderRadius: 4, background: "rgba(102,217,255,0.05)", display: "flex", flexDirection: "column", gap: 8 },
    },
    ...SHOVE_SETTINGS.map((setting) =>
      h(
        "div",
        { key: setting.key, style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        h("div", { style: { ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(207,216,220,0.68)", minWidth: 96 } }, setting.label),
        h(
          "div",
          { role: "group", "aria-label": setting.label, style: { display: "flex", border: "1px solid rgba(102,217,255,0.35)", borderRadius: 4, overflow: "hidden" } },
          ...setting.options.map((opt, i) => {
            const on = !!sel.shove[setting.key] === opt.value;
            return h(
              "button",
              {
                key: String(opt.value),
                type: "button",
                "data-testid": `shove-${setting.key}-${opt.value ? "on" : "off"}`,
                "aria-pressed": on ? "true" : "false",
                onClick: () => {
                  sel.shove = { ...sel.shove, [setting.key]: opt.value };
                  if (s.audio && s.audio.playSelect) s.audio.playSelect();
                  s.labelsDirty = true; s.bump();
                },
                style: {
                  ...mono, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase",
                  padding: "6px 10px", cursor: "pointer", border: "none",
                  borderLeft: i ? "1px solid rgba(102,217,255,0.25)" : "none",
                  background: on ? "rgba(102,217,255,0.22)" : "transparent",
                  color: on ? "#dffaff" : "rgba(207,216,220,0.7)",
                },
              },
              opt.label
            );
          })
        )
      )
    ),
    h(
      "div",
      { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.68)", lineHeight: 1.45 } },
      "A shove adds 1 point: a shoving roll costs 2, a shoving slide 3, and an Opa shove 3 (its move already costs 2). Anything costing 3 needs 3 Actions Per Turn."
    ),
    // Slides-only shoving does nothing unless the Slide law is on, and
    // even then a shoving slide costs 3 points, so it needs 3 Actions.
    shoveWarning(sel) &&
      h(
        "div",
        {
          role: "status",
          "data-testid": shoveWarning(sel).testid,
          style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, lineHeight: 1.45, color: "rgba(255,214,150,0.85)", borderLeft: "2px solid rgba(255,196,110,0.55)", paddingLeft: 8 },
        },
        shoveWarning(sel).text
      )
  );
}

/* The Arco's size choice, under the roster counters: Chico / Alto /
   Ancho, one for every Arco in the game. A small segmented control; the
   chosen size is lit, with its shape spelled out beneath. */
function renderArcoSizeRow(t) {
  const s = t.singularity;
  const h = React.createElement;
  const sel = s.selections;
  const describe = {
    chico: "5 cubes · 3 wide, 2 tall · opening 1 wide",
    alto: "7 cubes · 3 wide, 3 tall · opening 1 wide, 2 tall",
    ancho: "6 cubes · 4 wide, 2 tall · opening 2 wide",
  };
  return h(
    "div",
    { "data-testid": "arco-size", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginTop: 8 } },
    h("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(207,216,220,0.68)" } }, "Arco size"),
    h(
      "div",
      { role: "group", "aria-label": "Arco size", style: { display: "flex", border: "1px solid rgba(102,217,255,0.35)", borderRadius: 4, overflow: "hidden" } },
      ...ARCO_SIZES.map((a, i) => {
        const on = sel.matter.arcoSize === a.key;
        return h(
          "button",
          {
            key: a.key,
            type: "button",
            "data-testid": `arco-size-${a.key}`,
            "aria-pressed": on ? "true" : "false",
            onClick: () => {
              sel.matter.arcoSize = a.key;
              if (s.audio && s.audio.playSelect) s.audio.playSelect();
              s.labelsDirty = true; s.bump();
            },
            style: {
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "6px 12px", cursor: "pointer", border: "none",
              borderLeft: i ? "1px solid rgba(102,217,255,0.25)" : "none",
              background: on ? "rgba(102,217,255,0.22)" : "transparent",
              color: on ? "#dffaff" : "rgba(207,216,220,0.7)",
            },
          },
          a.label
        );
      })
    ),
    h("div", { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.68)" } }, describe[sel.matter.arcoSize] || describe.chico)
  );
}

function renderPairedSquarePlacementRow(t, kind) {
  const k = PAIRED_SQUARE_KINDS[kind];
  const s = t.singularity;
  const h = React.createElement;
  const sel = s.selections;
  const spots = pairedSpots(sel, kind);
  const count = pairedCount(sel, kind);
  const multi = kind === "missingSquare";
  const openPicker = () => {
    s[k.pickerFlag] = true;
    s[k.confirmFlag] = null;
    s[`${k.pickerFlag}Pulse`] = 0; // no leftover caption pulse on reopen
    s[`${k.pickerFlag}WallPulse`] = 0;
    // The multi-spot picker edits a draft, committed on Done. The single
    // (Black Hole) picker commits as it goes, so Cancel puts back the spot
    // it opened with.
    if (multi) s.missingSquaresDraft = spots.map((p) => ({ ...p }));
    else s[`${k.pickerFlag}Orig`] = spots.map((p) => ({ ...p }));
    if (s.audio && s.audio.playSingularityOpen) s.audio.playSingularityOpen();
    s.bump();
  };
  const btn = (extra) => ({
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "7px 12px", borderRadius: 4, cursor: "pointer",
    border: "1px solid rgba(102,217,255,0.4)", background: "rgba(102,217,255,0.1)", color: "#dffaff",
    ...extra,
  });
  const where = (p) => `row ${p.row + 1}, column ${p.col + 1}${multi && p.random ? " (random)" : ""}`;
  let text;
  if (!spots.length) {
    text = "No free spot could be found — press Select to pick one on your side of the board, or to try Random there.";
  } else if (!multi) {
    text = `${spots[0].random ? "Placed at random" : "Placed"} on your side at ${where(spots[0])}. Its mirror on the far side is the paired ${k.pairedNoun}.`;
  } else {
    text = `Placed on your side at ${spots.map(where).join(" · ")}. Each one's mirror on the far side is its pair.`;
    if (spots.length < count) text += ` Only ${spots.length} of ${count} fit without walling off part of the board.`;
  }
  const countDrum = multi
    ? h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 8 } },
        h(DrumRoller, {
          id: "missing-count", label: "Pairs", value: count, min: 1, max: MAX_MISSING_PAIRS, compact: true,
          onChange: (v) => {
            sel.missingSquare = { ...sel.missingSquare, count: v };
            fillPairedSpots(s, "missingSquare", false);
            s.labelsDirty = true; s.bump();
          },
        }),
        h(
          "div",
          { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.8)", lineHeight: 1.45 } },
          `${count} on your side, mirrored on the far side — ${count * 2} missing squares in all.`
        )
      )
    : null;
  return h(
    "div",
    {
      key: k.placementTestid,
      "data-testid": k.placementTestid,
      style: { margin: "0 0 6px 36px", padding: "9px 11px", border: "1px solid rgba(102,217,255,0.22)", borderRadius: 4, background: "rgba(102,217,255,0.05)" },
    },
    countDrum,
    h(
      "div",
      { "data-testid": `${k.placementTestid}-text`, style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.8)", marginBottom: 7, lineHeight: 1.45 } },
      text
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      h("button", { type: "button", "data-testid": k.placeBtnTestid, onClick: openPicker, style: btn() }, "Select")
    )
  );
}

/* The ghost-grid picker: a board-sized grid where the player taps a cell
   on their own side (the near/bottom half) to place their half of a
   rotationally-mirrored pair (a Black Hole or a Missing Square — see
   `kind`/PAIRED_SQUARE_KINDS). The 180-degree mirror on the far side is
   the paired square and lights up with the pick. Choosing plays a select
   cue, flashes the chosen pair with a "SELECTED" confirmation, then
   closes back to the category overlay. Sized to the ACTUAL board
   (getBoardDimensions), since TOPOLOGIES' size is not applied to real
   play. The center row of an odd board self-mirrors, so it's excluded
   from the selectable side.

   Missing Squares take up to `count` spots, so their picker is
   multi-select over a draft (s.missingSquaresDraft): tap to add or
   remove a spot, tap a random one to keep it, then Done — any spots
   left open are filled at random. A square that would wall off part of
   the board (missingSquaresKeepPath) can't be picked. */
function renderPairedSquarePicker(t, kind) {
  const k = PAIRED_SQUARE_KINDS[kind];
  const s = t.singularity;
  if (!s || !s[k.pickerFlag]) return null;
  const h = React.createElement;
  // The TOPOLOGIES-chosen size, not the live engine size: the resize is
  // only applied at Begin Game, so during setup the grid must reflect the
  // board the game WILL play on (which finalizeSingularityBegin then makes
  // real, and buildBlackHolePlacement/buildMissingSquaresPlacement read
  // back as getBoardDimensions).
  const sel = s.selections;
  const { rows, cols } = sel.topologies;
  const multi = kind === "missingSquare";
  const count = pairedCount(sel, kind);
  const confirm = s[k.confirmFlag] || null;
  // The spots shown as chosen. Black Holes: a live confirm (a just-made
  // pick mid-flash), else the stored spot (reopened to change it) so the
  // player sees where it sits. Missing Squares: the working draft.
  let shown;
  if (multi) {
    shown = s.missingSquaresDraft || [];
  } else {
    const hl = confirm || pairedSpots(sel, kind)[0] || null;
    shown = hl ? [{ row: hl.row, col: hl.col, random: false }] : [];
  }
  const shownAt = (r, c) => shown.find((p) => p.row === r && p.col === c) || null;
  const mirrorOfShownAt = (r, c) => shown.find((p) => {
    const m = mirrorCell(p.row, p.col, rows, cols);
    return m.row === r && m.col === c;
  }) || null;
  const handCount = shown.filter((p) => !p.random).length;
  // Black Holes may never go in either side's back two rows (engine's
  // blackHoleRowAllowed), so those rows aren't pickable on your side —
  // and their mirrors are the far side's back rows, excluded with them.
  const backRowsBanned = kind === "blackHole";
  const selectableRow = (r) => pairedRowAllowed(kind, r, rows);

  // The OTHER paired feature's squares (spots and mirrors), if it's on —
  // shown in their in-game look and not pickable, so a Black Hole can't
  // be placed onto a Missing Square or vice versa.
  const otherKind = otherPairedKind(kind);
  const otherOn = pairedFeatureOn(sel, otherKind);
  const otherCells = pairedCells(sel, otherKind);
  const isOther = (r, c) => otherCells.some((o) => o.row === r && o.col === c);
  // In-game look underneath, with a red wash + red outline on top so the
  // cell reads as "this is that feature" AND "not allowed here."
  const redWash = "linear-gradient(rgba(255,70,70,0.3), rgba(255,70,70,0.3))";
  const otherStyle = {
    background: otherKind === "missingSquare"
      ? `${redWash}, rgba(215,236,245,0.85)`
      : `${redWash}, radial-gradient(circle, #07080b 45%, #aeb6c2 58%, #07080b 70%)`,
    border: "2px solid #ff5a5a",
    boxShadow: "0 0 9px rgba(255,90,90,0.75)",
  };
  // A tap on a blocked cell pulses the red caption below the grid (the
  // caption's key changes, restarting its CSS animation).
  const pulseKey = `${k.pickerFlag}Pulse`;
  const pulseBlocked = () => { s[pulseKey] = (s[pulseKey] || 0) + 1; s.bump(); };
  const wallPulseKey = `${k.pickerFlag}WallPulse`;
  const pulseWall = () => { s[wallPulseKey] = (s[wallPulseKey] || 0) + 1; if (s.audio && s.audio.playBlocked) s.audio.playBlocked(); s.bump(); };
  const fullPulseKey = `${k.pickerFlag}FullPulse`;
  const pulseFull = () => { s[fullPulseKey] = (s[fullPulseKey] || 0) + 1; s.bump(); };

  // Multi-select: the draft after adding a hand-picked spot at (r,c) — a
  // random spot gives way when the draft is already at the count — or
  // null when every spot is already hand-picked.
  const draftWith = (r, c) => {
    const d = shown.slice();
    if (d.length >= count) {
      let i = -1;
      d.forEach((p, j) => { if (p.random) i = j; });
      if (i < 0) return null;
      d.splice(i, 1);
    }
    d.push({ row: r, col: c, random: false });
    return d;
  };
  const wallsOff = (r, c) => {
    if (!multi) return false;
    const d = draftWith(r, c);
    return !!d && !missingSquaresKeepPath(spotCells(d, rows, cols), rows, cols);
  };

  const origKey = `${k.pickerFlag}Orig`;
  const close = () => {
    // Cancel: the single picker's Random commits as it goes, so put back
    // the spot it opened with (the multi picker only ever edits a draft).
    if (!multi && s[origKey]) { setPairedSpots(sel, kind, s[origKey]); s.labelsDirty = true; }
    s[origKey] = null;
    s[k.pickerFlag] = false; s[k.confirmFlag] = null; s.missingSquaresDraft = null; s.bump();
  };
  const finish = () => {
    if (!s[k.confirmFlag]) s[k.confirmFlag] = true;
    if (s.audio && s.audio.playSelect) s.audio.playSelect();
    s.bump();
    setTimeout(() => {
      s[k.pickerFlag] = false;
      s[k.confirmFlag] = null;
      s.missingSquaresDraft = null;
      s[origKey] = null;
      s.labelsDirty = true;
      s.bump();
    }, 780);
  };
  const pick = (r, c) => {
    if (confirm) return; // a pick is already confirming and about to close
    if (multi) {
      const at = shownAt(r, c);
      if (at && !at.random) {
        s.missingSquaresDraft = shown.filter((p) => p !== at); // tap again to remove
      } else if (at) {
        s.missingSquaresDraft = shown.map((p) => (p === at ? { ...p, random: false } : p)); // keep a random one
      } else {
        const d = draftWith(r, c);
        if (!d) { pulseFull(); return; }
        s.missingSquaresDraft = d;
      }
      if (s.audio && s.audio.playSelect) s.audio.playSelect();
      s.bump();
      return;
    }
    setPairedSpots(sel, kind, [{ row: r, col: c, random: false }]);
    s[k.confirmFlag] = { row: r, col: c };
    finish();
  };
  // Done (multi-select): commit the draft, then fill any open spots at
  // random; the flash shows the final layout, random fills included.
  const done = () => {
    if (confirm) return;
    if (!multi) {
      // Keep the spot shown (e.g. one Random just rolled).
      const spot = pairedSpots(sel, kind)[0];
      if (!spot) { close(); return; }
      s[k.confirmFlag] = { row: spot.row, col: spot.col };
      finish();
      return;
    }
    setPairedSpots(sel, kind, shown);
    fillPairedSpots(s, kind, false);
    s.missingSquaresDraft = pairedSpots(sel, kind).map((p) => ({ ...p }));
    finish();
  };
  // Random, right here on the grid so the roll is visible: re-rolls the
  // random spots and keeps hand-picked ones — or re-rolls them all when
  // every spot is hand-picked (randomizePairedSpots). The multi picker
  // rolls into its draft (committed on Done, dropped on Cancel); the
  // single picker's spot changes straight away (Cancel puts it back).
  const randomize = () => {
    if (confirm) return;
    if (multi) {
      const committed = pairedSpots(sel, kind).map((p) => ({ ...p }));
      setPairedSpots(sel, kind, shown);
      randomizePairedSpots(s, kind);
      s.missingSquaresDraft = pairedSpots(sel, kind).map((p) => ({ ...p }));
      setPairedSpots(sel, kind, committed);
    } else {
      randomizePairedSpots(s, kind);
      s.labelsDirty = true;
    }
    if (s.audio && s.audio.playSelect) s.audio.playSelect();
    s.bump();
  };

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const other = isOther(r, c);
      const selectable = selectableRow(r) && !other;
      const chosen = shownAt(r, c);
      const mirrorOf = mirrorOfShownAt(r, c);
      const walled = selectable && !chosen && wallsOff(r, c);
      const isRandom = !!((chosen || mirrorOf) && (chosen || mirrorOf).random);
      let onClick;
      if (!confirm) onClick = walled ? pulseWall : selectable ? () => pick(r, c) : other ? pulseBlocked : undefined;
      cells.push(h("div", {
        key: `${r}-${c}`,
        "data-testid": `${k.cellPrefix}-${r}-${c}`,
        "data-selectable": selectable && !walled ? "true" : "false",
        "data-occupied-by": other ? otherKind : undefined,
        "data-chosen": chosen ? (chosen.random ? "random" : "hand") : undefined,
        "data-wall-blocked": walled ? "true" : undefined,
        onClick,
        style: other ? {
          aspectRatio: "1 / 1",
          borderRadius: 2,
          boxSizing: "border-box",
          cursor: "not-allowed",
          ...otherStyle,
        } : {
          aspectRatio: "1 / 1",
          borderRadius: 2,
          boxSizing: "border-box",
          // A randomly-placed spot (Missing Squares) shows dashed, so it
          // reads as "placed for you — tap to keep it."
          border: walled
            ? "1px dashed rgba(255,90,90,0.75)"
            : (chosen || mirrorOf) && isRandom
              ? "1px dashed rgba(174,182,194,0.8)"
              : `1px solid ${selectable ? "rgba(102,217,255,0.4)" : "rgba(120,140,170,0.16)"}`,
          background: chosen
            ? (isRandom ? "rgba(7,8,11,0.62)" : "#07080b")
            : mirrorOf
              ? (isRandom ? "rgba(174,182,194,0.3)" : "rgba(174,182,194,0.55)")
              : walled ? "rgba(255,70,70,0.1)"
                : selectable ? "rgba(102,217,255,0.08)" : "rgba(40,50,66,0.28)",
          boxShadow: chosen
            ? (isRandom ? "inset 0 0 6px rgba(0,0,0,0.9)" : "0 0 12px rgba(174,182,194,0.85), inset 0 0 7px rgba(0,0,0,0.95)")
            : mirrorOf && !isRandom ? "0 0 9px rgba(174,182,194,0.55)" : "none",
          cursor: confirm ? "default" : walled ? "not-allowed" : selectable ? "pointer" : "default",
        },
      }));
    }
  }

  const label = (text, color) => h(
    "div",
    { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color, textAlign: "center" } },
    text
  );

  return h(
    "div",
    {
      "data-testid": k.backdropTestid,
      onPointerDown: (e) => { e.stopPropagation(); if (!confirm) close(); },
      style: { position: "fixed", inset: 0, zIndex: 2300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(2,5,10,0.55)" },
    },
    h(
      "div",
      {
        "data-testid": k.pickerTestid,
        onPointerDown: (e) => e.stopPropagation(),
        style: {
          width: "clamp(280px, 90%, 460px)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "rgba(4,10,18,0.96)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(102,217,255,0.4)",
          borderRadius: 6,
          padding: "18px 18px 16px",
          boxShadow: "0 0 44px rgba(77,232,255,0.2)",
          boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap: 10,
        },
      },
      h("h3", { style: overlayTitleStyle }, k.title),
      label("Mirror · far side", "rgba(174,182,194,0.55)"),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 3,
            width: "100%",
          },
        },
        ...cells
      ),
      label(
        multi ? `Your side · ${handCount} of ${count} selected` : "Your side · tap a square",
        confirm ? "rgba(142,243,255,0.5)" : "#8ef3ff"
      ),
      multi
        ? h(
            "div",
            {
              key: `full-hint-${s[fullPulseKey] || 0}`,
              "data-testid": `${k.pickerTestid}-hint`,
              style: {
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: "0.04em", lineHeight: 1.5,
                color: "rgba(207,216,220,0.65)", textAlign: "center", padding: "4px 6px", borderRadius: 4,
                animation: s[fullPulseKey] ? "ecBlockedPulse 0.9s ease-out" : "none",
              },
            },
            h("style", null, "@keyframes ecBlockedPulse{0%{background:rgba(255,70,70,0.55);box-shadow:0 0 18px rgba(255,90,90,0.9);transform:scale(1.04)}100%{background:rgba(255,70,70,0.08);box-shadow:none;transform:scale(1)}}"),
            handCount >= count
              ? `All ${count} are selected — tap one to remove it first, or press Random.`
              : `Tap up to ${count}; tap one again to remove it. Any left open are placed at random when you press Done. Dashed squares were placed at random — tap one to keep it.`
          )
        : null,
      backRowsBanned
        ? h("div", { "data-testid": `${k.pickerTestid}-backrows-note`, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", color: "rgba(207,216,220,0.68)", textAlign: "center" } }, "Black holes can't go in either side's back two rows.")
        : null,
      multi && cells.some((cEl) => cEl.props["data-wall-blocked"])
        ? h(
            "div",
            {
              key: `wall-note-${s[wallPulseKey] || 0}`,
              "data-testid": `${k.pickerTestid}-wall-note`,
              "data-pulse": String(s[wallPulseKey] || 0),
              style: {
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.45,
                color: "#ff6b6b", textAlign: "center", padding: "6px 8px", borderRadius: 4,
                border: "1px dashed rgba(255,90,90,0.55)", background: "rgba(255,70,70,0.08)",
                animation: s[wallPulseKey] ? "ecBlockedPulse 0.9s ease-out" : "none",
              },
            },
            h("style", null, "@keyframes ecBlockedPulse{0%{background:rgba(255,70,70,0.55);box-shadow:0 0 18px rgba(255,90,90,0.9);transform:scale(1.04)}100%{background:rgba(255,70,70,0.08);box-shadow:none;transform:scale(1)}}"),
            "┆ Red-dashed squares would wall off part of the board — there must always be a path through."
          )
        : null,
      otherOn && !otherCells.length
        ? h(
            "div",
            {
              "data-testid": `${k.pickerTestid}-random-note`,
              style: {
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.45,
                color: "#ff6b6b", textAlign: "center", padding: "6px 8px", borderRadius: 4,
                border: "1px solid rgba(255,90,90,0.45)", background: "rgba(255,70,70,0.08)",
              },
            },
            otherKind === "missingSquare"
              ? "Missing Squares are on but have no spot yet — set one in Topology to see it here (black holes will never land on them either way)."
              : "Black Holes are on but have no spot yet — set one in Laws to see it here (missing squares will never land on them either way)."
          )
        : null,
      otherCells.length
        ? h(
            "div",
            {
              key: `blocked-caption-${s[pulseKey] || 0}`,
              "data-testid": `${k.pickerTestid}-blocked-caption`,
              "data-pulse": String(s[pulseKey] || 0),
              style: {
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.45,
                color: "#ff6b6b", textAlign: "center", padding: "6px 8px", borderRadius: 4,
                border: "1px solid rgba(255,90,90,0.45)", background: "rgba(255,70,70,0.08)",
                animation: s[pulseKey] ? "ecBlockedPulse 0.9s ease-out" : "none",
              },
            },
            h("style", null, "@keyframes ecBlockedPulse{0%{background:rgba(255,70,70,0.55);box-shadow:0 0 18px rgba(255,90,90,0.9);transform:scale(1.04)}100%{background:rgba(255,70,70,0.08);box-shadow:none;transform:scale(1)}}"),
            otherKind === "missingSquare"
              ? "▮ Missing Squares (set in Topology) — black holes can't go here."
              : "● Black Holes (set in Laws) — missing squares can't go here."
          )
        : null,
      confirm
        ? h("div", { "data-testid": k.confirmTestid, style: { textAlign: "center", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", color: "#dffaff", textShadow: "0 0 10px rgba(142,243,255,0.7)" } }, "◇ SELECTED")
        : h(
            "div",
            { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" } },
            h(
              "button",
              { type: "button", "data-testid": `${k.pickerTestid}-random`, onClick: randomize, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 4, border: "1px dashed rgba(174,182,194,0.7)", background: "transparent", color: "#cfd8dc", cursor: "pointer" } },
              "Random"
            ),
            h(
              "button",
              { type: "button", "data-testid": `${k.pickerTestid}-done`, onClick: done, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 4, border: "1px solid rgba(102,217,255,0.5)", background: "rgba(102,217,255,0.14)", color: "#dffaff", cursor: "pointer" } },
              "Done"
            ),
            h(
              "button",
              { type: "button", "data-testid": k.cancelTestid, onClick: close, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 4, border: "1px solid rgba(207,216,220,0.3)", background: "transparent", color: "rgba(207,216,220,0.75)", cursor: "pointer" } },
              "Cancel"
            )
          )
    )
  );
}

/* The holographic overlay a root-label tap opens — LAWS/MATTER get
   real checkboxes, TOPOLOGIES (and MATTER's own roster section) get
   drum rollers. Reads/writes t.singularity.selections directly (see
   the header comment above) rather than taking props from React
   state, since it's rendered straight from the bridge object by
   renderSingularityOverlay. Clicking outside its own panel (the
   backdrop) closes it and returns control to sphere rotation, per the
   spec — implemented as a full-screen backdrop with onPointerDown
   both closing AND stopping propagation, so it never also starts a
   sphere-rotate drag on the overlay div underneath it. */
/* The CONFIGURATIONS overlay: save the sphere's current rule selections
   under a name, and load / delete saved ones. Loading replaces the
   selections and jumps straight to the BEGIN GAME summary for review. */
function renderConfigurationsBody(t) {
  const s = t.singularity;
  const h = React.createElement;
  const configs = loadConfigurations();
  const suggested = `Configuration ${configs.length + 1}`;
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  const btn = (extra) => ({
    ...mono, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "7px 12px", borderRadius: 4, cursor: "pointer",
    border: "1px solid rgba(102,217,255,0.4)", background: "rgba(102,217,255,0.1)", color: "#dffaff",
    ...extra,
  });
  const ghost = { border: "1px solid rgba(207,216,220,0.3)", background: "transparent", color: "rgba(207,216,220,0.75)" };
  const notice = (text) => { s.configNotice = text; s.bump(); };

  const save = () => {
    const input = document.getElementById("ec-config-name");
    const name = ((input && input.value) || "").trim().slice(0, 40) || suggested;
    const entry = { id: `c${Date.now().toString(36)}`, name, savedAt: Date.now(), selections: JSON.parse(JSON.stringify(s.selections)) };
    const list = loadConfigurations();
    const idx = list.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    const replaced = idx >= 0;
    if (replaced) list[idx] = { ...entry, id: list[idx].id || entry.id }; else list.push(entry);
    if (!saveConfigurations(list)) { notice("Couldn't save — this browser is blocking storage."); return; }
    if (input) input.value = "";
    if (s.audio && s.audio.playSelect) s.audio.playSelect();
    s.labelsDirty = true;
    notice(replaced ? `Replaced “${name}”.` : `Saved “${name}”.`);
  };
  const load = (c) => {
    s.selections = normalizeSelections(JSON.parse(JSON.stringify(c.selections)));
    s.loadedConfigName = c.name;
    s.configNotice = null;
    s.configPendingDelete = null;
    s.activeCategory = null;
    s.sphereMenuStage = "summary";
    s.tapTimestamps = [];
    s.labelsDirty = true;
    if (s.audio && s.audio.playSelect) s.audio.playSelect();
    s.bump();
  };
  const remove = (c) => {
    const list = loadConfigurations().filter((x) => (x.id || x.name) !== (c.id || c.name));
    saveConfigurations(list);
    s.configPendingDelete = null;
    s.labelsDirty = true;
    notice(`Deleted “${c.name}”.`);
  };

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 12 } },
    h("div", { style: { ...sectionLabelStyle, textAlign: "center", margin: "-6px 0 2px" } }, "Saved presets"),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("input", {
        id: "ec-config-name",
        "data-testid": "config-name",
        type: "text",
        maxLength: 40,
        placeholder: suggested,
        "aria-label": "Configuration name",
        onKeyDown: (e) => { if (e.key === "Enter") save(); },
        style: {
          ...mono, flex: "1 1 auto", minWidth: 0, fontSize: 12, color: "#dffaff",
          background: "rgba(102,217,255,0.06)", border: "1px solid rgba(102,217,255,0.35)",
          borderRadius: 4, padding: "7px 10px", outline: "none",
        },
      }),
      h("button", { type: "button", "data-testid": "config-save", onClick: save, style: btn({ flexShrink: 0 }) }, "Save current")
    ),
    h(
      "div",
      { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(207,216,220,0.68)", lineHeight: 1.45 } },
      "Saves the current LAWS, MATTER and TOPOLOGY choices (not the opponent) in this browser. Saving under an existing name replaces it."
    ),
    s.configNotice
      ? h("div", { "data-testid": "config-notice", style: { ...mono, fontSize: 10.5, color: "#8ef3ff", textAlign: "center" } }, s.configNotice)
      : null,
    configs.length
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 4 } },
          ...configs.map((c) => {
            const key = c.id || c.name;
            const confirming = s.configPendingDelete === key;
            return h(
              "div",
              {
                key,
                "data-testid": "config-item",
                "data-name": c.name,
                style: { border: "1px solid rgba(102,217,255,0.22)", borderRadius: 4, background: "rgba(102,217,255,0.05)", padding: "9px 11px" },
              },
              h("div", { style: { fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", color: "#dffaff" } }, c.name),
              h("div", { style: { ...mono, fontSize: 10, color: "rgba(207,216,220,0.68)", margin: "4px 0 8px", lineHeight: 1.5 } }, describeSelections(normalizeSelections(c.selections))),
              confirming
                ? h(
                    "div",
                    { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
                    h("span", { style: { ...mono, fontSize: 10, color: "#ff6b6b" } }, "Delete this configuration?"),
                    h("button", { type: "button", "data-testid": "config-delete-confirm", onClick: () => remove(c), style: btn({ border: "1px solid #ff5a5a", background: "rgba(255,70,70,0.12)", color: "#ffb3b3" }) }, "Delete"),
                    h("button", { type: "button", onClick: () => { s.configPendingDelete = null; s.bump(); }, style: btn(ghost) }, "Keep")
                  )
                : h(
                    "div",
                    { style: { display: "flex", gap: 8 } },
                    h("button", { type: "button", "data-testid": "config-load", onClick: () => load(c), style: btn() }, "Load"),
                    h("button", { type: "button", "data-testid": "config-delete", "aria-label": `Delete ${c.name}`, onClick: () => { s.configPendingDelete = key; s.bump(); }, style: btn(ghost) }, "Delete")
                  )
            );
          })
        )
      : h("div", { "data-testid": "config-empty", style: { ...mono, fontSize: 11, color: "rgba(207,216,220,0.58)", textAlign: "center", marginTop: 4 } }, "No saved configurations yet.")
  );
}

function renderCategoryOverlay(t) {
  const s = t.singularity;
  if (!s || s.sphereMenuStage !== "overlay" || !s.activeCategory) return null;
  const h = React.createElement;
  const sel = s.selections;
  const category = s.activeCategory;
  const close = () => {
    s.activeCategory = null;
    s.sphereMenuStage = "labels";
    s.labelsDirty = true; // the label's own status line may have changed
    s.bump();
  };

  let body = null;
  if (category === "laws") {
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      // The Black Hole Squares manual-placement control sits DIRECTLY
      // below its own toggle (not appended after every law), so it reads
      // as that toggle's sub-option. Only shown when the law is on.
      ...LAWS_ITEMS.flatMap((item) => {
        const row = renderCheckboxRow(
          item,
          sel.laws[item.key],
          () => {
            sel.laws[item.key] = !sel.laws[item.key];
            // Turning Black Holes on with no spot yet rolls a real one now.
            if (item.key === "blackHoleSquares" && sel.laws.blackHoleSquares && !sel.blackHole.manual) fillPairedSpots(s, "blackHole", false);
            s.labelsDirty = true; s.bump();
          },
          `law-${item.key}`,
          () => openRulesCard("moves", item.key)
        );
        if (item.key === "blackHoleSquares" && sel.laws.blackHoleSquares) {
          return [row, renderPairedSquarePlacementRow(t, "blackHole")];
        }
        if (item.key === "shoving" && sel.laws.shoving) {
          return [row, renderShoveSettingsRow(t)];
        }
        const warning = lawWarning(item.key, sel);
        return warning ? [row, renderLawWarning(warning)] : [row];
      })
    );
  } else if (category === "matter") {
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: sectionLabelStyle }, "New Piece Types"),
      ...MATTER_NEW_PIECES.map((item) =>
        renderCheckboxRow(
          item,
          sel.matter.newPieces[item.key],
          () => { sel.matter.newPieces[item.key] = !sel.matter.newPieces[item.key]; s.labelsDirty = true; s.bump(); },
          `matter-piece-${item.key}`
        )
      ),
      h("div", { style: { ...sectionLabelStyle, marginTop: 10 } }, "Roster"),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", padding: "4px 0 2px" } },
        ...MATTER_ROSTER.map((p) =>
          h(DrumRoller, {
            key: p.key, id: `roster-${p.key}`, label: p.label, icon: p.icon,
            value: sel.matter.roster[p.key], min: p.min, max: p.max, compact: true,
            onChange: (v) => { sel.matter.roster[p.key] = v; s.labelsDirty = true; s.bump(); },
          })
        )
      ),
      renderArcoSizeRow(t),
      h("div", { style: { ...sectionLabelStyle, marginTop: 10 } }, "Setup"),
      renderCheckboxRow(
        { key: "randomizeStart", label: "Randomized Start", blurb: "Begin with a random Anomaly-style layout instead of the standard formation." },
        sel.matter.randomizeStart,
        () => { sel.matter.randomizeStart = !sel.matter.randomizeStart; s.labelsDirty = true; s.bump(); },
        "matter-randomize-start"
      )
    );
  } else if (category === "configurations") {
    body = renderConfigurationsBody(t);
  } else if (category === "topologies") {
    // Missing Squares' own manual-placement control sits directly below
    // its toggle (its own sub-option), same as Black Hole Squares' does
    // under LAWS — only shown once the toggle is on.
    const missingRow = renderCheckboxRow(
      { key: "missingSquares", label: "Missing Squares", blurb: "One to five rotationally-mirrored pairs of squares no piece can ever enter or pass through." },
      sel.topologies.missingSquares,
      () => {
        sel.topologies.missingSquares = !sel.topologies.missingSquares;
        if (sel.topologies.missingSquares) fillPairedSpots(s, "missingSquare", false);
        s.labelsDirty = true; s.bump();
      },
      "topo-missingSquares"
    );
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { display: "flex", gap: 22, justifyContent: "center", padding: "6px 0 14px" } },
        h(DrumRoller, {
          id: "board-rows", label: "Rows", value: sel.topologies.rows, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM,
          onChange: (v) => { sel.topologies.rows = v; rerollRandomPairedSquares(s); s.labelsDirty = true; s.bump(); },
        }),
        h(DrumRoller, {
          id: "board-cols", label: "Cols", value: sel.topologies.cols, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM,
          onChange: (v) => { sel.topologies.cols = v; rerollRandomPairedSquares(s); s.labelsDirty = true; s.bump(); },
        })
      ),
      ...(sel.topologies.missingSquares ? [missingRow, renderPairedSquarePlacementRow(t, "missingSquare")] : [missingRow])
    );
  }

  return h(
    "div",
    {
      "data-testid": "category-overlay-backdrop",
      onPointerDown: (e) => { e.stopPropagation(); close(); },
      // A real press anywhere on the overlay (capture phase, so it also
      // sees presses on the panel/controls that stopPropagation in bubble)
      // marks that a genuine interaction has begun.
      onPointerDownCapture: () => { s.categorySawPointerDown = true; },
      // Ghost-touch guard: swallow, in the capture phase (before any
      // control's own onClick), any click that arrives before such a real
      // press — i.e. the trailing click of the very tap that opened this
      // overlay. A deliberate tap always begins with its own pointerdown
      // on the overlay, so it passes through untouched.
      onClickCapture: (e) => {
        if (!s.categorySawPointerDown) { e.stopPropagation(); e.preventDefault(); }
      },
      style: { position: "fixed", inset: 0, zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center" },
    },
    h(
      "div",
      {
        "data-testid": "category-overlay",
        "data-category": category,
        onPointerDown: (e) => e.stopPropagation(),
        style: {
          width: "clamp(280px, 84%, 440px)",
          maxHeight: "72vh",
          overflowY: "auto",
          background: "rgba(4,10,18,0.94)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(102,217,255,0.35)",
          borderRadius: 6,
          padding: "20px 20px 18px",
          boxShadow: "0 0 40px rgba(77,232,255,0.16)",
          boxSizing: "border-box",
        },
      },
      h("h3", { style: overlayTitleStyle }, categoryDisplayLabel(category)),
      body,
      h(
        "div",
        { style: { marginTop: 16, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: "rgba(142,243,255,0.4)", letterSpacing: "0.08em" } },
        "TAP OUTSIDE TO CLOSE"
      )
    )
  );
}

/* Real Opponent/AI controls — aiPlayer/selectOpponent/aiDifficulty/
   setAiDifficulty/AI_DIFFICULTY/busy/aiThinking are the chassis's own
   state and setters, threaded through unchanged (see triggerBeginGame's
   own comment in chassis/ElCabeza3D.jsx), so picking one here is
   exactly as real as picking it on the normal dock — just styled to
   match the sphere's own holographic language instead of duplicating
   the dock's two-step picker/difficulty-row layout. */
function renderOpponentAiPicker(setupExtras) {
  const { aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY, busy, aiThinking } = setupExtras;
  if (!selectOpponent || !AI_DIFFICULTY) return null;
  const h = React.createElement;
  const locked = busy || aiThinking;
  const pillStyle = (active) => ({
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "7px 13px", borderRadius: 18,
    border: `1px solid ${active ? "#8ef3ff" : "rgba(102,217,255,0.3)"}`,
    background: active ? "rgba(142,243,255,0.18)" : "transparent",
    color: active ? "#dffaff" : "rgba(207,216,220,0.7)",
    cursor: locked ? "default" : "pointer", opacity: locked ? 0.5 : 1,
  });
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8, alignItems: "center", margin: "4px 0 6px" } },
    h(
      "div",
      { style: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" } },
      // aria-pressed needs the literal string "true"/"false", not a raw
      // JS boolean — React only writes aria-*/data-* attributes verbatim
      // (no boolean-attribute coercion the way it handles e.g. disabled),
      // so a bare boolean here gets silently dropped instead of stringified.
      h("button", { type: "button", "data-testid": "opponent-human", "aria-pressed": String(aiPlayer === null), disabled: locked, onClick: () => selectOpponent(null), style: pillStyle(aiPlayer === null) }, "Human"),
      h("button", { type: "button", "data-testid": "opponent-ai-dark", "aria-pressed": String(aiPlayer === "dark"), disabled: locked, onClick: () => selectOpponent("dark"), style: pillStyle(aiPlayer === "dark") }, "AI · Dark"),
      h("button", { type: "button", "data-testid": "opponent-ai-light", "aria-pressed": String(aiPlayer === "light"), disabled: locked, onClick: () => selectOpponent("light"), style: pillStyle(aiPlayer === "light") }, "AI · Light")
    ),
    aiPlayer !== null &&
      h(
        "div",
        { style: { display: "flex", gap: 5 } },
        ...Object.entries(AI_DIFFICULTY).map(([key, cfg]) =>
          h(
            "button",
            {
              type: "button", key, "data-testid": `ai-difficulty-${key}`, "aria-pressed": String(aiDifficulty === key), disabled: locked,
              onClick: () => setAiDifficulty(key),
              style: { ...pillStyle(aiDifficulty === key), padding: "4px 9px", fontSize: 9.5 },
            },
            cfg.label
          )
        )
      )
  );
}

/* The final "BEGIN GAME" menu a triple-tap reveals: every modifier
   picked across the three categories, the real Opponent/AI picker, and
   a Begin Game button wired to finalizeSingularityBegin (which fires
   the chassis's own real game-start path, then tears down the
   cinematic — see useSingularityPhase). */
function renderSummaryPanel(setupExtras) {
  const { three, finalizeSingularityBegin } = setupExtras;
  const t = three && three.current;
  if (!t || !t.singularity || t.singularity.sphereMenuStage !== "summary") return null;
  const sel = t.singularity.selections;
  const h = React.createElement;

  const lawsOn = LAWS_ITEMS.filter((i) => sel.laws[i.key]);
  const piecesOn = MATTER_NEW_PIECES.filter((i) => sel.matter.newPieces[i.key]);
  // An optional piece that's off (a default of 0, still at 0 — the Codo)
  // is left out rather than listed as "0 Codo".
  const rosterLine = MATTER_ROSTER
    .filter((p) => p.default > 0 || sel.matter.roster[p.key] > 0)
    .map((p) => `${sel.matter.roster[p.key]} ${rosterItemLabel(p, sel)}`)
    .join(" · ");
  const boardLine = `${sel.topologies.rows} × ${sel.topologies.cols}${sel.topologies.missingSquares ? `, ${missingSquaresLabel(sel.missingSquare.count)}` : ""}`;
  const lineStyle = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "rgba(207,216,220,0.85)", lineHeight: 1.7 };
  const tagStyle = { color: "#66d9ff", letterSpacing: "0.08em" };

  return h(
    "div",
    {
      "data-testid": "singularity-summary-menu",
      onPointerDown: (e) => e.stopPropagation(),
      style: {
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: "clamp(280px, 88%, 460px)", maxHeight: "84vh", overflowY: "auto",
        background: "rgba(4,10,18,0.92)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(102,217,255,0.35)", borderRadius: 6,
        padding: "26px 22px 22px", boxSizing: "border-box", pointerEvents: "auto",
        boxShadow: "0 0 60px rgba(77,232,255,0.18)",
      },
    },
    h("h2", { style: { ...overlayTitleStyle, fontSize: 19 } }, "BEGIN GAME"),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8, margin: "14px 0 18px" } },
      t.singularity.loadedConfigName
        ? h("div", { "data-testid": "summary-loaded-config", style: { ...lineStyle, color: "#dffaff" } }, h("span", { style: tagStyle }, "CONFIGURATION  "), t.singularity.loadedConfigName)
        : null,
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "TOPOLOGY  "), boardLine),
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "LAWS  "), lawsOn.length ? lawsOn.map((i) => lawLabel(i, sel)).join(", ") : "none"),
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "MATTER  "), piecesOn.length ? piecesOn.map((i) => i.label).join(", ") : "no new pieces"),
      h("div", { style: { ...lineStyle, fontSize: 10.5, color: "rgba(207,216,220,0.58)", paddingLeft: 4 } }, rosterLine)
    ),
    h("div", { style: { ...lineStyle, textAlign: "center" } }, h("span", { style: tagStyle }, "OPPONENT")),
    renderOpponentAiPicker(setupExtras),
    h(
      "button",
      {
        type: "button",
        "data-testid": "singularity-begin-game",
        onClick: finalizeSingularityBegin,
        style: {
          marginTop: 18, width: "100%",
          fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 14,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#04141c", background: "linear-gradient(135deg,#8ef3ff,#4de8ff)",
          border: "none", borderRadius: 4, padding: "13px 0", cursor: "pointer",
          boxShadow: "0 0 24px rgba(77,232,255,0.45)",
        },
      },
      "Begin Game"
    ),
    // Return to the sphere to change selections without abandoning setup:
    // unlike the top-left BACK (which exits to the dock), this keeps every
    // pick and just drops back to the rotating labels so a category can be
    // reopened, then a bare triple-tap comes back here to Begin.
    h(
      "button",
      {
        type: "button",
        "data-testid": "singularity-edit-settings",
        onClick: () => {
          t.singularity.sphereMenuStage = "labels";
          t.singularity.activeCategory = null;
          t.singularity.tapTimestamps = [];
          t.singularity.labelsDirty = true;
          if (t.singularity.bump) t.singularity.bump();
        },
        style: {
          marginTop: 10, width: "100%",
          fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 12,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#8ef3ff", background: "transparent",
          border: "1px solid rgba(102,217,255,0.5)", borderRadius: 4,
          padding: "10px 0", cursor: "pointer",
        },
      },
      "◂ Edit Settings"
    )
  );
}

/* The sphere's how-to text, hidden behind a short, faint line at the
   bottom middle of the screen: hovering it (or tapping it, on touch)
   shows the instructions just above it, with a link into the rules cards
   (chassis/RulesCards.jsx). Its pointerdown is stopped so a tap on it
   never starts a sphere drag or counts toward the triple-tap finish. */
const LABELS_HINT_TEXT =
  "The sphere opens with its north pole toward you — drag upward to bring the glowing categories round. Tap one to configure it. Saved CONFIGURATIONS sit at the south pole — keep dragging upward to reach them. Triple-tap open space on the sphere to finish.";
function LabelsHint() {
  const h = React.createElement;
  const [hover, setHover] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const open = hover || pinned;
  return h(
    "div",
    {
      "data-testid": "sphere-help",
      style: { position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" },
      onPointerDown: (e) => e.stopPropagation(),
      onPointerUp: (e) => e.stopPropagation(),
      onPointerMove: (e) => e.stopPropagation(),
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
    },
    open &&
      h(
        "div",
        {
          "data-testid": "sphere-help-text",
          style: {
            position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
            width: "min(400px, calc(100vw - 32px))", textAlign: "center",
            paddingBottom: 10, boxSizing: "border-box",
          },
        },
        h(
          "div",
          {
            style: {
              background: "rgba(4,6,10,0.82)", backdropFilter: "blur(6px)",
              border: "1px solid rgba(102,217,255,0.26)", borderRadius: 4,
              padding: "12px 18px 10px", boxSizing: "border-box",
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, lineHeight: 1.5,
              color: "rgba(207,216,220,0.8)",
            },
          },
          LABELS_HINT_TEXT,
          h(
            "button",
            {
              type: "button",
              "data-testid": "sphere-help-rules",
              onClick: (e) => { e.stopPropagation(); openRulesCard("quick"); },
              style: {
                display: "block", margin: "8px auto 0", padding: "2px 6px", background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8ef3ff",
              },
            },
            "Game rules ›"
          )
        )
      ),
    h(
      "button",
      {
        type: "button",
        "data-testid": "sphere-help-button",
        "aria-label": "How the sphere works, and the game rules",
        "aria-expanded": open ? "true" : "false",
        onFocus: () => setHover(true),
        onBlur: (e) => { if (!e.currentTarget.parentElement.contains(e.relatedTarget)) { setHover(false); setPinned(false); } },
        onClick: (e) => { e.stopPropagation(); setPinned((p) => !p); },
        // A plain line, longer than an em dash, in place of a "?".
        style: { width: 44, height: 18, padding: 0, background: "transparent", border: "none", cursor: "help", display: "flex", alignItems: "center", justifyContent: "center" },
      },
      h("span", {
        style: {
          display: "block", width: 34, height: 1.5, borderRadius: 1,
          background: open ? "rgba(142,243,255,0.85)" : "rgba(142,243,255,0.35)",
          boxShadow: open ? "0 0 8px rgba(77,232,255,0.45)" : "none",
          transition: "background 160ms ease, box-shadow 160ms ease",
        },
      })
    )
  );
}

// A persistent escape hatch across every sphere sub-stage (labels,
// an open overlay, the summary menu) — the touch equivalent of Escape,
// unchanged in spirit from the original single-stage placeholder card's
// own Back button, just no longer tied to that card's layout.
// Ghosted until hovered, focused or pressed, with a quick fade either way.
function BackButton({ onExit }) {
  const h = React.createElement;
  const [lit, setLit] = React.useState(false);
  return h(
    "button",
    {
      type: "button",
      "data-testid": "singularity-back-button",
      "data-lit": lit ? "true" : "false",
      onClick: onExit,
      onMouseEnter: () => setLit(true),
      onMouseLeave: () => setLit(false),
      onFocus: () => setLit(true),
      onBlur: () => setLit(false),
      onPointerDown: () => setLit(true),
      style: {
        position: "absolute", left: 16, top: 16, zIndex: 2200,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: "#66d9ff", background: "rgba(4,6,10,0.6)",
        border: "1px solid rgba(102,217,255,0.4)", borderRadius: 3,
        padding: "7px 14px", cursor: "pointer", pointerEvents: "auto",
        opacity: lit ? 1 : 0.28,
        transition: "opacity 160ms ease",
      },
    },
    "Back"
  );
}
function renderBackButton(exitSingularity) {
  return React.createElement(BackButton, { key: "singularity-back", onExit: exitSingularity });
}

/* Missing Squares first, then Black Hole Squares avoiding them — both
   against the pieces actually on the board. `prev` (a replay's last
   placement) is kept when still clear of every piece, so a persisted
   layout stays put game to game; otherwise it re-resolves. */
function resolvePairedSquares(sel, laws, placedPieces, prev) {
  const { rows, cols } = getBoardDimensions();
  const clear = (list) => list.length > 0 && list.every((q) => !cellOccupied(placedPieces, q.row, q.col));
  const missing = sel.topologies.missingSquares
    ? (prev && clear(prev.missing) ? prev.missing : buildMissingSquaresPlacement(sel, rows, cols, placedPieces))
    : [];
  const holesClear = (list) => clear(list) && !list.some((h) => missing.some((m) => m.row === h.row && m.col === h.col));
  const holes = laws.blackHoleSquares
    ? (prev && holesClear(prev.holes) ? prev.holes : buildBlackHolePlacement(sel, rows, cols, placedPieces, missing))
    : [];
  return { missing, holes };
}

export function useSingularityPhase({
  three, audio,
  aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY,
  busy, aiThinking, triggerBeginGame, applyMatterRoster,
  // Black Hole Squares LAW — see finalizeSingularityBegin below.
  pieces, setBlackHoles,
  // Missing Squares TOPOLOGIES option — same reasoning, see
  // finalizeSingularityBegin below.
  setMissingSquares,
  // Current Variants flyout snapshot setter — see finalizeSingularityBegin.
  setCurrentVariants,
  // TOPOLOGIES board resize — see finalizeSingularityBegin.
  applyBoardResize,
}) {
  const [phase, setPhase] = React.useState(PHASES.IDLE);
  const blackDivRef = React.useRef(null);
  const tollTimerRef = React.useRef(null); // the toll -> collapse handoff timer
  const phaseSetterRef = React.useRef(setPhase);
  phaseSetterRef.current = setPhase;
  const dragStateRef = React.useRef({ lastX: 0, lastY: 0, lastT: 0, moved: 0 });

  // Forces the one re-render the DOM overlays (category checkboxes,
  // drum rollers, the summary menu) need after a plain mutation of
  // t.singularity's own fields — see the module comment above these
  // widgets. Stashed on the bridge object itself (mirroring
  // t.singularity.setPhase just below) so plain functions outside this
  // hook's closure (renderCategoryOverlay et al.) can reach it too.
  const [, setRenderTick] = React.useState(0);
  const bumpRef = React.useRef(() => {});
  bumpRef.current = () => setRenderTick((n) => n + 1);
  const bridge = three && three.current;
  if (bridge) {
    bridge.singularity = bridge.singularity || {};
    bridge.singularity.bump = () => bumpRef.current();
  }

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
  /* The bell-toll lead-in the SINGULARITY invite click fires (see
     themes/neon.js's commitSingularity): the cathedral bell tolls, a
     drone begins building, and a black curtain fades up over the
     still-visible board across SINGULARITY_TOLL_MS. When it's fully
     black, startCollapse takes over — and immediately fades the curtain
     back out so the collapse warp is what re-emerges from the dark,
     matching the user's "2s black -> then the collapse animation". */
  function startSingularityToll() {
    const t = three && three.current;
    if (!t) return;
    t.singularity = t.singularity || {};
    t.singularity.phase = PHASES.TOLLING;
    t.singularity.audio = audio;
    t.singularity.blackDivRef = blackDivRef;
    t.singularity.setPhase = (p) => phaseSetterRef.current(p);
    // The single enormous funereal toll, plus a drone that swells under
    // it for the whole lead-in (the collapse roar joins at startCollapse;
    // all three hard-cut together at the event horizon).
    if (audio.playSingularityBell) audio.playSingularityBell();
    if (audio.startSingularityHum) {
      audio.startSingularityHum();
      const humStart = performance.now();
      const humStep = () => {
        if (!t.singularity || t.singularity.phase !== PHASES.TOLLING) return;
        const p = Math.min(1, (performance.now() - humStart) / SINGULARITY_TOLL_MS);
        if (audio.updateSingularityHum) audio.updateSingularityHum(p);
        if (p < 1) requestAnimationFrame(humStep);
      };
      requestAnimationFrame(humStep);
    }
    setPhase(PHASES.TOLLING);
    // The black curtain only exists once the overlay has mounted for the
    // TOLLING phase — wait a frame (two, to be safe past React's commit)
    // before driving its fade so the transition actually takes.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (blackDivRef.current) {
        blackDivRef.current.style.transition = `opacity ${SINGULARITY_TOLL_MS}ms ease-in`;
        blackDivRef.current.style.opacity = "1";
      }
    }));
    clearTimeout(tollTimerRef.current);
    tollTimerRef.current = setTimeout(() => {
      tollTimerRef.current = null;
      startCollapse();
    }, SINGULARITY_TOLL_MS);
  }

  function startCollapse() {
    const t = three && three.current;
    if (!t) return;
    t.singularity = t.singularity || {};
    t.singularity.phase = PHASES.COLLAPSING;
    t.singularity.collapseStartedAt = performance.now();
    // If we arrived from the toll the curtain is fully black — fade it
    // back out so the collapsing board re-emerges from the dark rather
    // than the whole warp happening unseen behind an opaque curtain.
    if (blackDivRef.current) {
      blackDivRef.current.style.transition = "opacity 650ms ease-out";
      blackDivRef.current.style.opacity = "0";
    }
    t.singularity.lastTickAt = null;
    t.singularity.dragVelocity = { x: 0, y: 0 };
    t.singularity.dragTargetVelocity = { x: 0, y: 0 };
    t.singularity.dragging = false;
    t.singularity.audio = audio;
    t.singularity.blackDivRef = blackDivRef;
    t.singularity.setPhase = (p) => phaseSetterRef.current(p);
    // Every fresh entry starts back at the root labels with a clean
    // slate — see teardownSingularityScene's matching reset on exit.
    // A fresh random MATTER/LAWS/TOPOLOGIES arrangement too, so which
    // menu greets the player (and where the other two sit) isn't the
    // same every time.
    t.singularity.rootLabels = shuffleRootLabels();
    t.singularity.sphereMenuStage = "labels";
    t.singularity.activeCategory = null;
    t.singularity.selections = createDefaultSelections();
    t.singularity.tapTimestamps = [];
    t.singularity.labelsDirty = true;
    t.singularity.blackHolePicker = false;
    t.singularity.blackHolePickConfirm = null;
    t.singularity.missingSquaresPicker = false;
    t.singularity.missingSquaresPickConfirm = null;
    t.singularity.configHover = null;
    t.singularity.configNotice = null;
    t.singularity.configPendingDelete = null;
    t.singularity.loadedConfigName = null;
    // The roar layer runs alongside the hum for the whole collapse; the
    // hard cut stops it along with everything else.
    audio.startSingularityCollapseRoar();
    setPhase(PHASES.COLLAPSING);
  }

  /* RECONFIGURE entry point for the Win -> New Game dialog (see chassis's
     handleReset/resetGame and t.reconfigureSingularitySetup below): jumps
     straight to the sphere's root-label stage, pre-populated with a prior
     game's selections, skipping the discovery gesture AND the whole
     toll/collapse/blackout cinematic -- the player just finished a
     Singularity game and explicitly asked to reconfigure it, so the
     ceremony of "discovering" the sphere again would be pointless friction
     rather than payoff. Deliberately replicates only the END STATE the
     normal collapsing->blackout->sphere path leaves behind (board hidden,
     audio silent, chrome sucked away, phase SPHERE) rather than animating
     through it -- see advanceSingularityScene's own chrome-suction block
     for the one matching snap this needs on the far side. */
  function enterSphereDirect(prefilledSelections) {
    const t = three && three.current;
    if (!t) return;
    t.singularity = t.singularity || {};
    const s = t.singularity;
    s.audio = audio;
    s.blackDivRef = blackDivRef;
    s.setPhase = (p) => phaseSetterRef.current(p);
    s.lastTickAt = null;
    s.dragVelocity = { x: 0, y: 0 };
    s.dragTargetVelocity = { x: 0, y: 0 };
    s.dragging = false;
    s.pulsePhase = 0;
    s.collapseItems = null;
    // Same fresh-arrangement/root-labels reset startCollapse gives a
    // discovery visit -- reconfiguring shouldn't always land on the same
    // MATTER/LAWS/TOPOLOGIES layout either.
    s.rootLabels = shuffleRootLabels();
    s.sphereMenuStage = "labels";
    s.activeCategory = null;
    s.selections = prefilledSelections
      ? JSON.parse(JSON.stringify(prefilledSelections))
      : createDefaultSelections();
    s.tapTimestamps = [];
    s.labelsDirty = true;
    s.blackHolePicker = false;
    s.blackHolePickConfirm = null;
    s.missingSquaresPicker = false;
    s.missingSquaresPickConfirm = null;
    s.configHover = null;
    s.configNotice = null;
    s.configPendingDelete = null;
    s.loadedConfigName = null;
    // No collapse ran to hide the board or cut the audio -- do both
    // directly, landing in exactly the state the collapsing->blackout
    // edge produces on the normal path (see advanceSingularityScene).
    if (t.boardGroup) t.boardGroup.visible = false;
    resetCameraRoll(t);
    audio.cutSingularityAudioToSilence();
    if (blackDivRef.current) {
      blackDivRef.current.style.transition = "none";
      blackDivRef.current.style.opacity = "0";
    }
    // Faces the sphere toward the camera immediately, the same raycast
    // the blackout->sphere transition performs once the camera has
    // settled back to its resting position (already true here -- no
    // collapse camera roll ran to unsettle it).
    faceSphereNorthPole(t, s);
    // Lets the next tick's chrome-suction block (advanceSingularityScene)
    // know this is a fresh, not-yet-hidden arrival so it snaps the
    // masthead/dock straight to their fully-sucked-away end state -- see
    // that block's own comment.
    s.chromeHidden = false;
    s.phase = PHASES.SPHERE;
    setPhase(PHASES.SPHERE);
  }

  function exitSingularity() {
    // Cancel a pending toll->collapse handoff so an Escape during the
    // lead-in doesn't fire the collapse a beat after we've bailed out.
    clearTimeout(tollTimerRef.current);
    tollTimerRef.current = null;
    const t = three && three.current;
    if (t) {
      teardownSingularityScene(t);
      if (t.boardGroup) t.boardGroup.visible = true;
      if (t.singularity) t.singularity.phase = PHASES.IDLE;
    }
    /* Escaping mid-collapse has to kill the hum and the roar, which are
       still running — only the event-horizon cut stops them on the
       normal path, and it hasn't happened yet. Cutting first and then
       restoring the master level does both jobs regardless of which
       phase the exit came from. This is also the path a real triple-tap
       finalize takes (see finalizeSingularityBegin below) — resuming
       audio here is exactly "audio only returns once a game has
       actually begun" per the design doc, whether that's an Escape
       abandoning the whole thing or a real Begin Game commit. */
    audio.cutSingularityAudioToSilence();
    audio.resumeAudioAfterSingularity();
    setPhase(PHASES.IDLE);
  }

  // The summary menu's real BEGIN GAME button: fire the exact same
  // game-start path the dock's own Begin Game button does (Opponent/AI
  // were already applied live as they were picked, via the real
  // selectOpponent/setAiDifficulty setters below), then tear the
  // cinematic down so what's left is an already-armed game, not a
  // fresh, untouched setup screen. LAWS/MATTER/TOPOLOGIES' own
  // selections are NOT threaded any further than this summary — see
  // the module header for why this pass stops at "real selections,
  // real menu" rather than also building the rules/board-resize
  // engines behind them.
  function finalizeSingularityBegin() {
    // Marks the game about to start as Singularity-originated — read by
    // themes/neon.js's own board-FX tick (applySingularityBoardPalette)
    // for as long as this game is active, and cleared only by the chassis's
    // "Reset rules" control now (see deactivateSingularityBoardFx). Set
    // before triggerBeginGame so the retint is already in place the instant
    // the board becomes visible, not one frame later.
    const t = three && three.current;
    if (t) t.singularityGameActive = true;
    const liveSel = t && t.singularity && t.singularity.selections;
    if (liveSel) {
      // Snapshot the selections so a later New Game replays THIS game's
      // setup even if the sphere is reopened and fiddled with without
      // beginning again — selections are plain data, so a JSON clone is a
      // safe deep copy.
      const sel = JSON.parse(JSON.stringify(liveSel));
      const matterActive = isCategoryActive("matter", sel);

      // TOPOLOGIES first: board size must be applied before any pieces or
      // holes, since piece placement and hole placement both read the live
      // engine dimensions. Still awaiting Begin here, so the plate rebuild
      // + camera refit runs while the board is hidden.
      if (applyBoardResize) applyBoardResize(sel.topologies.rows, sel.topologies.cols);
      // MATTER's chosen roster (custom counts of the five originals; the
      // two rectangular new types) placed via the same Anomaly generator
      // the plain button uses. Randomized only when the player opted in or
      // customized — a plain default game keeps the standard formation.
      // A randomized opening is placed around the spots already chosen on
      // the sphere (hand-picked or rolled), so what was shown is what plays.
      const chosenSpots = [
        ...(sel.topologies.missingSquares ? sel.missingSquare.spots.map((p) => ({ row: p.row, col: p.col })) : []),
        ...(sel.laws.blackHoleSquares && sel.blackHole.manual ? [sel.blackHole.manual] : []),
      ];
      const placedPieces = (applyMatterRoster && applyMatterRoster(sel.matter, matterActive, chosenSpots)) || pieces;
      // LAWS: the sphere's checkboxes are plain booleans shaped like
      // ACTIVE_LAWS; this is where they actually take effect (and get
      // forwarded to the AI worker via setActiveLaws' shared mechanism).
      const laws = setActiveLaws(lawsForEngine(sel));
      // Missing Squares: resolved BEFORE Black Hole Squares below so the
      // two never land on the same cell — whichever is active second
      // treats the first's placement as reserved too (buildBlackHole-
      // Placement's own avoid param). Set on both the engine module state
      // and the chassis React copy from the same list, so enforced == drawn.
      // Placed against the pieces actually just placed (placedPieces), not
      // the render-time `pieces` — so no piece ever starts on one.
      const { missing, holes } = resolvePairedSquares(sel, laws, placedPieces, null);
      setActiveMissingSquares(missing);
      if (setMissingSquares) setMissingSquares(missing);
      // Black Hole Squares: ON always means the two-hole wormhole version.
      // Resolved ONCE here and reused on replay so the layout stays
      // identical game to game. Set on both the engine module state and the
      // chassis React copy from the same list, so enforced == drawn.
      setActiveBlackHoles(holes);
      if (setBlackHoles) setBlackHoles(holes);
      // Snapshot the active specials for the in-game Current Variants
      // flyout (and, now, as the signal the chassis uses to show its Reset
      // rules control — a null snapshot means a plain game).
      const variants = buildVariantsSnapshot(sel);
      if (setCurrentVariants) setCurrentVariants(variants);

      // Register a replay of exactly this setup on three.current so the
      // chassis (a different module) can re-run it when New Game persists
      // the Singularity rules instead of resetting to a vanilla game — see
      // handleReset's keepSingularity branch. Board size + roster are
      // re-derived each time (a fresh, possibly re-randomized opening),
      // while the resolved missing squares/holes/variants are reused
      // verbatim.
      let lastSquares = { missing, holes };
      t.reapplySingularitySetup = () => {
        t.singularityGameActive = true;
        if (applyBoardResize) applyBoardResize(sel.topologies.rows, sel.topologies.cols);
        // A re-randomized opening avoids the previous squares; if a piece
        // still lands on one (e.g. the fixed formation), they re-resolve.
        const replayPieces =
          (applyMatterRoster && applyMatterRoster(sel.matter, matterActive, [...lastSquares.missing, ...lastSquares.holes])) || pieces;
        const replayLaws = setActiveLaws(lawsForEngine(sel));
        lastSquares = resolvePairedSquares(sel, replayLaws, replayPieces, lastSquares);
        setActiveMissingSquares(lastSquares.missing);
        if (setMissingSquares) setMissingSquares(lastSquares.missing);
        setActiveBlackHoles(lastSquares.holes);
        if (setBlackHoles) setBlackHoles(lastSquares.holes);
        if (setCurrentVariants) setCurrentVariants(variants);
      };
      // The Win -> New Game dialog's RECONFIGURE path: re-enters the
      // sphere pre-populated with THIS game's real, structured selections
      // (sel itself -- not buildVariantsSnapshot's lossy display strings,
      // which is all setCurrentVariants above ever gets). The chassis
      // calls resetGame(false) (a vanilla reset back to pre-game setup)
      // immediately before this, so the sphere opens over a clean board
      // rather than the just-finished one.
      t.reconfigureSingularitySetup = () => enterSphereDirect(sel);
    }
    if (triggerBeginGame) triggerBeginGame();
    exitSingularity();
  }

  React.useEffect(() => {
    if (phase === PHASES.IDLE) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // A rules card open over the sphere takes this Escape for itself.
      if (document.querySelector('[data-testid="info-overlay"][data-open="true"]')) return;
      exitSingularity();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Drag-rotate the sphere — a direct port of the dock-piece pointer
  // pattern (chassis/ElCabeza3D.jsx), retargeted at the sphere group's
  // own rotation. Live velocity is stashed on t.singularity so the tick
  // (in mountAmbientEffects, a different closure) can decay it each
  // frame when not actively dragging. Only active while still browsing
  // the root labels — once an overlay or the summary menu is showing,
  // their own DOM stops propagation before it ever reaches here (belt),
  // and this stage check is the suspenders.
  // A tap (as opposed to a drag) under this much total pointer movement
  // either opens a category (hit a root label) or counts toward the
  // triple-tap-to-finalize gesture (hit bare sphere) — see
  // handleSphereTap. Kept exactly equal to DRAG_DEAD_ZONE_PX: anything
  // under it neither rotates the sphere nor fails to count as a tap,
  // so there's no gap where a touch can wobble the sphere yet still
  // resolve as a tap.
  const TAP_MOVE_THRESHOLD_PX = DRAG_DEAD_ZONE_PX;

  function handlePointerDown(ev) {
    const t = three && three.current;
    if (!t || !t.singularity || t.singularity.phase !== PHASES.SPHERE) return;
    if (t.singularity.sphereMenuStage !== "labels") return;
    t.singularity.dragging = true;
    t.singularity.dragTargetVelocity = { x: 0, y: 0 };
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY, lastT: performance.now(), moved: 0 };
  }
  // Hovering the south-pole CONFIGURATIONS label (mouse only — touch has
  // no hover; its overlay subtitle carries the same "saved presets" hint).
  function updateConfigHover(t, ev) {
    const s = t.singularity;
    const sphere = s.sphere;
    let hover = null;
    if (ev.pointerType === "mouse" && s.phase === PHASES.SPHERE && s.sphereMenuStage === "labels" && sphere && sphere.configLabel && t.raycaster) {
      t.pointer.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
      t.raycaster.setFromCamera(t.pointer, t.camera);
      if (t.raycaster.intersectObject(sphere.configLabel.mesh).length) hover = { x: ev.clientX, y: ev.clientY };
    }
    const was = s.configHover;
    s.configHover = hover;
    if (!!was !== !!hover || (hover && was && (Math.abs(was.x - hover.x) > 6 || Math.abs(was.y - hover.y) > 6))) s.bump();
  }

  function handlePointerMove(ev) {
    const t = three && three.current;
    if (t && t.singularity && !t.singularity.dragging) updateConfigHover(t, ev);
    if (!t || !t.singularity || !t.singularity.dragging) return;
    const drag = dragStateRef.current;
    const now = performance.now();
    const dt = Math.max((now - drag.lastT) / 1000, 1 / 120);
    const dx = ev.clientX - drag.lastX;
    const dy = ev.clientY - drag.lastY;
    const moved = drag.moved + Math.abs(dx) + Math.abs(dy);
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY, lastT: now, moved };
    // Dead zone: the first several px of a drag don't rotate anything,
    // so an unsteady touch-down doesn't visibly nudge the sphere. Once
    // past it, every further px counts — this only ever suppresses the
    // very start of a gesture, not ongoing sensitivity (that's
    // DRAG_VELOCITY_SMOOTHING's job, applied every frame in
    // updateSphereVisuals).
    if (moved < DRAG_DEAD_ZONE_PX) { t.singularity.dragTargetVelocity = { x: 0, y: 0 }; return; }
    /* Time-normalized "speed physics" — the same pattern the dock-piece
       preview this was ported from actually uses (chassis/ElCabeza3D.jsx,
       (dx * sensitivity) / dt), NOT a plain delta*scale. That distinction
       matters here specifically: a naive delta*scale reads the raw size
       of whatever pointermove event happened to fire, and touch input
       can coalesce a fast real swipe into one single large-delta event —
       which would otherwise read as one enormous one-frame "velocity."
       Dividing by dt makes this genuine speed, robust to however few or
       many events the browser chose to deliver. This is only the
       TARGET the sphere's actual velocity eases toward each frame
       (updateSphereVisuals) — it is not applied to rotation directly
       here, which is what made every raw pointer event feel instant
       and twitchy before. */
    t.singularity.dragTargetVelocity = {
      x: (dy * DRAG_ROTATE_SENSITIVITY) / dt,
      y: (dx * DRAG_ROTATE_SENSITIVITY) / dt,
    };
  }
  function handlePointerUp(ev) {
    const t = three && three.current;
    if (!t || !t.singularity) return;
    const wasTap = ev && ev.type === "pointerup" && dragStateRef.current.moved < TAP_MOVE_THRESHOLD_PX;
    t.singularity.dragging = false;
    if (wasTap && t.singularity.sphereMenuStage === "labels") handleSphereTap(t, ev.clientX, ev.clientY);
  }

  // Opening a category is a real state transition (labels -> overlay),
  // not just a texture redraw — see renderCategoryOverlay for the DOM
  // side of it.
  function openCategoryOverlay(t, category) {
    const s = t.singularity;
    s.activeCategory = category;
    s.sphereMenuStage = "overlay";
    s.tapTimestamps = [];
    s.configHover = null;
    // Any edit path invalidates "you're looking at configuration X".
    if (category !== "configurations") s.loadedConfigName = null;
    // Ghost-touch guard (see renderCategoryOverlay's capture handlers):
    // the tap that opened this overlay fires a trailing `click` once the
    // panel has rendered under the finger, which would otherwise toggle
    // whatever control landed there. That ghost click has NO preceding
    // pointerdown on the overlay (the opening press was on the sphere), so
    // start "hasn't seen a fresh press yet" and only let a click through
    // once a real pointerdown has landed on the overlay.
    s.categorySawPointerDown = false;
    s.bump();
  }

  // Three quick taps on BARE sphere (i.e. not on a root label — see
  // categoryAtUv/handleSphereTap) finalize every selection and reveal
  // the summary menu. Deliberately gated on landing outside a label's
  // own hit region rather than counted regardless of where the tap
  // lands: a label tap already has its own immediate, unambiguous
  // meaning (open that category), so routing it into a timing-based
  // triple-tap counter instead would make the two gestures race each
  // other. The gaps between labels are exactly the "bare sphere" this
  // gesture is meant to live on.
  const TRIPLE_TAP_WINDOW_MS = 650;
  function registerBareTap(t) {
    const s = t.singularity;
    const now = performance.now();
    s.tapTimestamps = (s.tapTimestamps || []).filter((ts) => now - ts < TRIPLE_TAP_WINDOW_MS);
    s.tapTimestamps.push(now);
    if (s.tapTimestamps.length >= 3) {
      s.tapTimestamps = [];
      s.sphereMenuStage = "summary";
      s.bump();
    }
  }

  // Raycasts the real, currently-rotated sphere geometry (not a flat
  // screen-space hitbox) using the same raycaster/pointer objects the
  // chassis already keeps on three.current for its own piece-picking —
  // this is what makes a label's hit-test agree with wherever it
  // actually is after however much dragging has happened.
  function handleSphereTap(t, clientX, clientY) {
    const sphere = t.singularity.sphere;
    if (!t.raycaster || !t.pointer || !t.camera || !sphere) return;
    t.pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    t.raycaster.setFromCamera(t.pointer, t.camera);
    // The south-pole CONFIGURATIONS label sits just outside the sphere's
    // surface, so it's tested first.
    if (sphere.configLabel && t.raycaster.intersectObject(sphere.configLabel.mesh).length) {
      openCategoryOverlay(t, "configurations");
      audio.playSelect();
      return;
    }
    const hits = t.raycaster.intersectObject(sphere.mesh);
    if (!hits.length || !hits[0].uv) return;
    const category = categoryAtUv(hits[0].uv, t.singularity.rootLabels);
    if (category) {
      openCategoryOverlay(t, category);
      audio.playSelect();
    } else {
      registerBareTap(t);
    }
  }

  return {
    singularityPhase: phase,
    startSingularityToll,
    startCollapse,
    exitSingularity,
    finalizeSingularityBegin,
    blackDivRef,
    handleSingularityPointerDown: handlePointerDown,
    handleSingularityPointerMove: handlePointerMove,
    handleSingularityPointerUp: handlePointerUp,
    // Passed straight through so renderCategoryOverlay/renderSummaryPanel
    // (plain functions, not part of this hook's own closure) can read
    // the live bridge object and drive the real Opponent/AI/Begin Game
    // controls — see their own comments.
    three,
    aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY, busy, aiThinking,
  };
}

/* The in-game Current Variants reference — a compact top-left HUD emblem
   that reports which Singularity categories this game is running under.
   Collapsed, it's a dimmed stack of three checkbox rows (one per
   category: LAWS / MATTER / TOPOLOGY), each row a small square + an
   abstract glyph; a category with active variants shows its box filled
   and glowing blue, an inactive one shows it muted/unchecked. A
   continuous 0.5s hover or press-and-hold brightens the emblem to full
   and flies a panel out to the right/below listing the active variants;
   leaving the combined zone starts a 0.5s buffer — return within it and
   it stays open, otherwise it collapses back to the dimmed emblem.
   `groups` is buildVariantsSnapshot's output (or null/empty for a plain
   game -> "Standard rules"). */

// Category order + glyphs for the three emblem rows. Keys match
// buildVariantsSnapshot's group keys so a row lights up iff that group
// carries active items.
const VARIANT_ROWS = [
  { key: "laws", glyph: "⌬" },
  { key: "matter", glyph: "⍝" },
  { key: "topologies", glyph: "⏣" },
];
const VARIANT_HOLD_MS = 500; // continuous hover/hold before opening
const VARIANT_EXIT_MS = 500; // buffer before collapsing after leaving

function VariantsFlyout({ groups }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(false);
  const openTimer = React.useRef(null);
  const exitTimer = React.useRef(null);

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
  };
  React.useEffect(() => clearTimers, []);

  // Pointer entered the combined zone (emblem or open panel). Cancel any
  // pending collapse; if still closed, arm the 500ms open timer.
  const onEnter = () => {
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
    if (open) return;
    if (openTimer.current) return;
    openTimer.current = setTimeout(() => { openTimer.current = null; setOpen(true); }, VARIANT_HOLD_MS);
  };
  // Pointer left the combined zone. Cancel a not-yet-fired open; if
  // already open, arm the 500ms exit buffer.
  const onLeave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (!open) return;
    if (exitTimer.current) return;
    exitTimer.current = setTimeout(() => { exitTimer.current = null; setOpen(false); }, VARIANT_EXIT_MS);
  };

  const active = Array.isArray(groups) && groups.length > 0;
  const groupByKey = {};
  if (active) groups.forEach((g) => { groupByKey[g.key] = g; });

  const accent = "#3b82f6";
  const accentGlow = "rgba(59,130,246,0.55)";
  const idleOpacity = 0.4;

  // --- Collapsed emblem: three checkbox rows -------------------------
  const emblemRows = VARIANT_ROWS.map((row) => {
    const on = !!groupByKey[row.key];
    const box = h("span", {
      style: {
        width: 11, height: 11, flex: "0 0 auto", borderRadius: 2,
        border: on ? `1px solid ${accent}` : "1px solid rgba(160,174,192,0.5)",
        background: on ? accent : "transparent",
        boxShadow: on && open ? `0 0 7px ${accentGlow}` : "none",
      },
    });
    const glyph = h("span", {
      style: {
        fontFamily: "'Chakra Petch', sans-serif", fontSize: 12, lineHeight: 1,
        color: on ? (open ? "#dbeafe" : accent) : "rgba(160,174,192,0.65)",
        textShadow: on && open ? `0 0 8px ${accentGlow}` : "none",
      },
    }, row.glyph);
    return h("div", {
      key: row.key,
      style: { display: "flex", alignItems: "center", gap: 6 },
    }, box, glyph);
  });

  const emblem = h(
    "div",
    {
      title: "Currently selected singularity variants",
      style: {
        display: "flex", flexDirection: "column", gap: 4,
        padding: "6px 8px", borderRadius: 5,
        background: open ? "rgba(7,15,26,0.95)" : "rgba(10,14,22,0.72)",
        border: open ? `1px solid ${accent}` : "1px solid rgba(120,140,170,0.28)",
        boxShadow: open ? `0 0 16px ${accentGlow}` : "none",
        opacity: open ? 1 : idleOpacity,
        transition: "opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
        cursor: "default", userSelect: "none",
      },
    },
    emblemRows
  );

  // --- Expanded panel: the active variant details --------------------
  const panel = open && h(
    "div",
    {
      style: {
        marginTop: 6, background: "rgba(7,15,26,0.96)",
        border: `1px solid ${accent}`, borderRadius: 5,
        padding: "8px 6px", minWidth: 184, maxWidth: 248,
        boxShadow: `0 8px 26px rgba(0,0,0,0.55), 0 0 14px ${accentGlow}`,
      },
    },
    active
      ? groups.map((g) =>
          h(
            "div",
            { key: g.key, style: { padding: "3px 8px 5px" } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 } },
              h("span", { style: { fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd" } }, g.label),
              h("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(147,197,253,0.55)" } }, String(g.items.length))
            ),
            h(
              "ul",
              { style: { margin: "3px 0 0", padding: "0 0 0 12px", listStyle: "none" } },
              g.items.map((it, idx) =>
                h(
                  "li",
                  { key: idx, style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, lineHeight: 1.55, color: "rgba(223,244,255,0.9)" } },
                  // A law opens its rules card (the MOVES tile for it).
                  g.keys && g.keys[idx]
                    ? h(
                        "button",
                        {
                          type: "button",
                          "data-testid": `variants-law-${g.keys[idx]}`,
                          onClick: () => openRulesCard("moves", g.keys[idx]),
                          style: { all: "unset", cursor: "pointer", borderBottom: "1px dotted rgba(147,197,253,0.45)" },
                        },
                        "• " + it
                      )
                    : "• " + it
                )
              )
            )
          )
        )
      : h(
          "div",
          { style: { padding: "3px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(200,214,230,0.75)" } },
          "Standard rules"
        ),
    open &&
      h(
        "button",
        {
          type: "button",
          "data-testid": "variants-rules",
          onClick: () => openRulesCard("game"),
          style: { all: "unset", cursor: "pointer", display: "block", padding: "6px 8px 2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd" },
        },
        "Rules ›"
      )
  );

  return h(
    "div",
    {
      "data-testid": "variants-flyout",
      "data-open": open ? "true" : "false",
      onMouseEnter: onEnter,
      onMouseLeave: onLeave,
      onPointerDown: onEnter,
      onPointerUp: onLeave,
      style: {
        position: "absolute", top: 12, left: 12, zIndex: 40,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        pointerEvents: "auto",
      },
    },
    emblem,
    panel
  );
}

export function renderVariantsFlyout(setupExtras) {
  // Only during an actual in-progress game: not on the setup dock
  // (awaitingBegin), not through the Singularity cinematic, and not once
  // the game has ended (isPlaying goes false on a win).
  if (!setupExtras || !setupExtras.isPlaying || setupExtras.awaitingBegin) return null;
  return React.createElement(VariantsFlyout, { groups: setupExtras.currentVariants, key: "variants-flyout" });
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
    three,
  } = setupExtras;
  if (!phase || phase === PHASES.IDLE) return null;
  const h = React.createElement;
  const t = three && three.current;
  const stage = t && t.singularity ? t.singularity.sphereMenuStage : "labels";

  return h(
    "div",
    {
      "data-testid": "singularity-overlay",
      "data-singularity-phase": phase,
      "data-singularity-stage": phase === PHASES.SPHERE ? stage : undefined,
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
        // Without this, a touch browser spends the first several
        // pixels of every drag deciding whether this is a page scroll
        // before recognizing it as a custom gesture at all — exactly
        // the "initial touch doesn't react, then catches up all at
        // once" feel reported against this drag. None of that
        // scroll/zoom behavior is wanted here regardless.
        touchAction: "none",
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
    phase === PHASES.SPHERE && renderBackButton(exitSingularity),
    phase === PHASES.SPHERE && stage === "labels" && h(LabelsHint, { key: "sphere-help" }),
    phase === PHASES.SPHERE && stage === "labels" && t && t.singularity.configHover &&
      h("div", {
        "data-testid": "config-hover-hint",
        style: {
          position: "fixed", left: t.singularity.configHover.x + 14, top: t.singularity.configHover.y + 14,
          pointerEvents: "none", zIndex: 2050,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.08em",
          color: "#dffaff", background: "rgba(4,10,18,0.9)", border: "1px solid rgba(102,217,255,0.45)",
          borderRadius: 3, padding: "4px 8px",
        },
      }, "saved presets"),
    phase === PHASES.SPHERE && stage === "overlay" && t && renderCategoryOverlay(t),
    phase === PHASES.SPHERE && stage === "overlay" && t && renderPairedSquarePicker(t, "blackHole"),
    phase === PHASES.SPHERE && stage === "overlay" && t && renderPairedSquarePicker(t, "missingSquare"),
    phase === PHASES.SPHERE && stage === "summary" && renderSummaryPanel(setupExtras)
  );
}
