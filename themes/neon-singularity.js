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
import { SLAB_X, SLAB_Z, MIN_BOARD_DIM, MAX_BOARD_DIM } from "../engine/constants.js";

export const PHASES = { IDLE: "idle", COLLAPSING: "collapsing", BLACKOUT: "blackout", SPHERE: "sphere" };

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
/* Drag-to-idle decay. NOT the dock-piece precedent's own 0.9 (that
   value produces a long, floaty coast — fine for a small always-visible
   corner widget, wrong for this: at 0.9 the sphere took the better
   part of a second to noticeably slow and several more to fully settle,
   which read as loose/uncontrolled rather than calm. Raised sharply so
   released momentum dies out within a few frames — still a real coast,
   not an instant stop, just a short one. */
const DRAG_DECAY = 4.5;
// Radians of rotation per pixel of pointer movement while actively
// dragging — also reused (divided by dt) as the per-second coast
// velocity a release seeds, so live dragging and the momentum right
// after release always agree on how "fast" a given swipe was. Halved
// from an initial 0.01 per feedback that the sphere was too sensitive
// once a drag was recognized.
const DRAG_ROTATE_SENSITIVITY = 0.005;
// Accumulated pointer movement, in px, before a drag starts rotating
// the sphere at all — small enough to feel instant once a real drag
// begins, but enough to swallow the first few pixels of an unsteady
// touch-down that would otherwise read as an unwanted twitch.
const DRAG_DEAD_ZONE_PX = 3;

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
  return ROOT_LABEL_DEFS.find((d) => d.key === key)?.label || key.toUpperCase();
}
const TEXT_TEXTURE_W = 2048, TEXT_TEXTURE_H = 1024;
// The label band's total v-extent (title + status line), unchanged
// from the earlier fixed band's own width (0.82-0.58). WHERE that
// band sits (its center) is no longer a hardcoded guess — see
// DEFAULT_LABEL_CENTER_V and the BLACKOUT->SPHERE raycast below.
const LABEL_V_HALF_WIDTH_BAND = 0.12;
// A sphere has no equivalent of the horizontal auto-centering rotate
// for latitude: rotating the group to bring a given v to screen-center
// would tip the whole sphere over, changing which point reads as "up"
// — a much bigger visual change than the invisible yaw spin u-centering
// already does. So instead of trying to move the geometry, this reads
// where the camera is ALREADY looking (the same BLACKOUT->SPHERE
// raycast that sets the yaw, at hits[0].uv.y instead of .x) and uses
// THAT as the band's center — the sphere's camera elevation genuinely
// varies with viewport/device (board framing logic elsewhere sizes
// and angles the camera to fit), so a fixed v center that looked right
// on one viewport read as too high (or too low) on another; this
// setting is per-session real geometry instead of a fixed guess.
// 0.7 is the fallback for the handful of frames between a fresh
// collapse starting and that raycast actually landing.
const DEFAULT_LABEL_CENTER_V = 0.7;
// How far in u (as a fraction of the full 0..1 wrap) a tap can land
// from a label's center and still count as hitting it — comfortably
// under 1/6 (half of the 1/3 spacing between labels) so the gaps
// between labels stay genuinely neutral "bare sphere" space, which is
// exactly where the triple-tap-to-finalize gesture lives (see
// registerBareTap) without fighting a label's own hit region.
const LABEL_U_HALF_WIDTH = 0.13;

const DEFAULT_BOARD_DIM = 10; // matches the engine's fixed board before any TOPOLOGIES choice

// LAWS — the five independent toggles from SINGULARITY_DESIGN.md's
// Part 2, verbatim.
const LAWS_ITEMS = [
  { key: "splitMovement", label: "Split Movement", blurb: "Divide a turn's movement across multiple pieces instead of one." },
  { key: "slide", label: "Slide", blurb: "Move one open adjacent square without rolling, as a full turn action." },
  { key: "blackHoleSquares", label: "Black Hole Squares", blurb: "One or two linked squares — enter one, arrive at the other." },
  { key: "cantileverPivot", label: "Cantilever Pivot", blurb: "Pivot a cantilevered piece in place around its one grounded cell." },
  { key: "threeActions", label: "3 Actions Per Turn", blurb: "Raises the per-turn movement budget by one." },
];

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
  lPentomino: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  block1x3: [[0, 0], [0, 1], [0, 2]],
  block2x3: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  // The design doc's "non-convex shape with a genuine hollow/void" —
  // a 3-wide arch with its center cell empty is the simplest icon that
  // actually reads as an arch rather than a plain block.
  arch: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
};

// MATTER — the four new polycube types from the design doc, each a
// simple enable/disable checkbox.
// block1x3/block2x3 are real: plain rectangular boxes, so they place,
// roll, and collide exactly like the five originals with no new
// engine work (see generateAnomalySetup's own roster support in
// themes/neon.js). lPentomino/arch are non-convex — a genuine hollow
// in the arch, an L-shaped footprint — and need a collision system
// that checks actual solid cells against a roll's pivot edge rather
// than just a bounding rectangle, which doesn't exist yet; they stay
// selectable so the menu is honest about what MATTER will eventually
// include, but enabling one has no effect on the game that starts.
const MATTER_NEW_PIECES = [
  { key: "lPentomino", label: "L-Pentomino", icon: "lPentomino", blurb: "Not yet implemented — needs a non-convex collision system." },
  { key: "block1x3", label: "1×3 Block", icon: "block1x3" },
  { key: "block2x3", label: "2×3 Block", icon: "block2x3" },
  { key: "arch", label: "Arch", icon: "arch", blurb: "Not yet implemented — needs a non-convex collision system." },
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
];

function createDefaultSelections() {
  return {
    laws: Object.fromEntries(LAWS_ITEMS.map((i) => [i.key, false])),
    matter: {
      newPieces: Object.fromEntries(MATTER_NEW_PIECES.map((i) => [i.key, false])),
      roster: Object.fromEntries(MATTER_ROSTER.map((p) => [p.key, p.default])),
    },
    topologies: { rows: DEFAULT_BOARD_DIM, cols: DEFAULT_BOARD_DIM },
  };
}

function isCategoryActive(key, selections) {
  if (key === "laws") return Object.values(selections.laws).some(Boolean);
  if (key === "matter") {
    if (Object.values(selections.matter.newPieces).some(Boolean)) return true;
    return MATTER_ROSTER.some((p) => selections.matter.roster[p.key] !== p.default);
  }
  if (key === "topologies") {
    return selections.topologies.rows !== DEFAULT_BOARD_DIM || selections.topologies.cols !== DEFAULT_BOARD_DIM;
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
    const { rows, cols } = selections.topologies;
    return isCategoryActive("topologies", selections) ? `${rows} × ${cols} BOARD` : "TAP TO CONFIGURE";
  }
  return "";
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
function categoryAtUv(uv, rootLabels, centerV = DEFAULT_LABEL_CENTER_V) {
  if (uv.y < centerV - LABEL_V_HALF_WIDTH_BAND || uv.y > centerV + LABEL_V_HALF_WIDTH_BAND) return null;
  for (const entry of rootLabels || DEFAULT_ROOT_LABELS) {
    const u = ((entry.u % 1) + 1) % 1;
    if (circularUDist(uv.x, u) < LABEL_U_HALF_WIDTH) return entry.key;
  }
  return null;
}

function drawRootLabels(canvas, ctx, selections, rootLabels, centerV = DEFAULT_LABEL_CENTER_V) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const titleFont = "700 88px 'Chakra Petch', sans-serif";
  const subFont = "400 28px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const y = canvas.height * (1 - centerV);
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
  group.visible = false;
  return { group, mesh, material, uniforms, text };
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
  [s.chromeRefs.titleWrapRef, s.chromeRefs.cardRef].forEach((ref, i) => {
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
    drawRootLabels(s.sphere.text.canvas, s.sphere.text.ctx, s.selections, s.rootLabels, s.labelCenterV);
    s.sphere.text.texture.needsUpdate = true;
    s.labelsDirty = false;
  }

  // Finalizing (triple-tap) hides the sphere itself per the spec, but
  // the starfield stays as the summary menu's backdrop.
  s.sphere.group.visible = s.sphereMenuStage !== "summary";
  s.starfield.visible = true;
  if (s.sphereMenuStage === "summary") return; // nothing left to animate

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
  s.dragVelocity = { x: 0, y: 0 };
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
  if (!s || !s.phase || s.phase === PHASES.IDLE) return;
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
    [chromeRefs.titleWrapRef, chromeRefs.cardRef].forEach((ref) => {
      if (ref && ref.current) {
        // No CSS transition: every frame writes its own value, and a
        // transition would just smear them against each other.
        ref.current.style.transition = "none";
      }
    });
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
        if (t.raycaster && t.pointer && t.camera && s.sphere) {
          // Raycast through the sphere's own on-screen center, not the
          // viewport's — those aren't the same point once other UI
          // chrome (the BACK button, the hint bar at the bottom) makes
          // the sphere sit off-center within the viewport. Projecting
          // the sphere's actual world position to NDC first, then
          // raycasting through THAT, guarantees the ray passes through
          // whichever point is genuinely facing the camera along the
          // camera-to-sphere-center line — which is, by the sphere's
          // own symmetry, the exact middle of its silhouette on
          // screen, regardless of any such layout offset. (A first
          // attempt at this raycast at plain NDC (0,0) fixed the
          // per-viewport variance but still wasn't the sphere's own
          // visual center whenever the sphere itself sat off from
          // true viewport-center — exactly the "still not centered"
          // case reported after that fix.)
          const ndc = s.sphere.group.position.clone().project(t.camera);
          t.pointer.set(ndc.x, ndc.y);
          t.raycaster.setFromCamera(t.pointer, t.camera);
          const hits = t.raycaster.intersectObject(s.sphere.mesh);
          if (hits.length && hits[0].uv) {
            s.sphere.group.rotation.y = (hits[0].uv.x - 0.5) * Math.PI * 2;
            // Same hit, .y instead of .x: there's no rotation that can
            // bring a given LATITUDE to screen-center the way yaw does
            // for longitude (that would tip the whole sphere over), so
            // instead of moving the sphere, the label band itself gets
            // centered on wherever the camera is already looking. The
            // camera's elevation angle genuinely varies by viewport
            // (board-framing logic elsewhere sizes/angles it to fit),
            // which is exactly why a fixed v center read as too high on
            // some devices and too low on others (see LABEL_V_HALF_WIDTH_BAND).
            s.labelCenterV = hits[0].uv.y;
            s.labelsDirty = true; // redraw at the real center, not the fallback
          }
        }
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
      stage: s.sphereMenuStage || null,
      activeCategory: s.activeCategory || null,
      selections: s.selections ? JSON.parse(JSON.stringify(s.selections)) : null,
      // This cycle's MATTER/LAWS/TOPOLOGIES -> u-slot arrangement (see
      // shuffleRootLabels) — exposed so tests can find a given category
      // deterministically instead of assuming a fixed layout.
      rootLabels: s.rootLabels ? s.rootLabels.map((r) => ({ key: r.key, u: r.u })) : null,
      labelCenterV: typeof s.labelCenterV === "number" ? s.labelCenterV : null,
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

function renderCheckboxRow(item, checked, onToggle, testId) {
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
          { style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5, color: "rgba(207,216,220,0.5)", marginTop: 2, lineHeight: 1.4 } },
          item.blurb
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
      ...LAWS_ITEMS.map((item) =>
        renderCheckboxRow(
          item,
          sel.laws[item.key],
          () => { sel.laws[item.key] = !sel.laws[item.key]; s.labelsDirty = true; s.bump(); },
          `law-${item.key}`
        )
      )
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
      )
    );
  } else if (category === "topologies") {
    body = h(
      "div",
      { style: { display: "flex", gap: 22, justifyContent: "center", padding: "6px 0" } },
      h(DrumRoller, {
        id: "board-rows", label: "Rows", value: sel.topologies.rows, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM,
        onChange: (v) => { sel.topologies.rows = v; s.labelsDirty = true; s.bump(); },
      }),
      h(DrumRoller, {
        id: "board-cols", label: "Cols", value: sel.topologies.cols, min: MIN_BOARD_DIM, max: MAX_BOARD_DIM,
        onChange: (v) => { sel.topologies.cols = v; s.labelsDirty = true; s.bump(); },
      })
    );
  }

  return h(
    "div",
    {
      "data-testid": "category-overlay-backdrop",
      onPointerDown: (e) => { e.stopPropagation(); close(); },
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
  const rosterLine = MATTER_ROSTER.map((p) => `${sel.matter.roster[p.key]} ${p.label}`).join(" · ");
  const boardLine = `${sel.topologies.rows} × ${sel.topologies.cols}`;
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
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "TOPOLOGY  "), boardLine),
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "LAWS  "), lawsOn.length ? lawsOn.map((i) => i.label).join(", ") : "none"),
      h("div", { style: lineStyle }, h("span", { style: tagStyle }, "MATTER  "), piecesOn.length ? piecesOn.map((i) => i.label).join(", ") : "no new pieces"),
      h("div", { style: { ...lineStyle, fontSize: 10, color: "rgba(207,216,220,0.5)", paddingLeft: 4 } }, rosterLine)
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
    )
  );
}

function renderLabelsHint() {
  const h = React.createElement;
  return h(
    "div",
    {
      style: {
        position: "absolute", left: "50%", bottom: "6%", transform: "translateX(-50%)",
        width: "clamp(240px, 74%, 400px)", textAlign: "center",
        background: "rgba(4,6,10,0.78)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(102,217,255,0.26)", borderRadius: 4,
        padding: "12px 18px", boxSizing: "border-box", pointerEvents: "none",
        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, lineHeight: 1.5,
        color: "rgba(207,216,220,0.8)",
      },
    },
    "Drag to rotate. Tap a glowing category to configure it. Triple-tap open space on the sphere to finish."
  );
}

// A persistent escape hatch across every sphere sub-stage (labels,
// an open overlay, the summary menu) — the touch equivalent of Escape,
// unchanged in spirit from the original single-stage placeholder card's
// own Back button, just no longer tied to that card's layout.
function renderBackButton(exitSingularity) {
  const h = React.createElement;
  return h(
    "button",
    {
      type: "button",
      "data-testid": "singularity-back-button",
      onClick: exitSingularity,
      style: {
        position: "absolute", left: 16, top: 16, zIndex: 2200,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: "#66d9ff", background: "rgba(4,6,10,0.6)",
        border: "1px solid rgba(102,217,255,0.4)", borderRadius: 3,
        padding: "7px 14px", cursor: "pointer", pointerEvents: "auto",
      },
    },
    "Back"
  );
}

export function useSingularityPhase({
  three, audio,
  aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY,
  busy, aiThinking, triggerBeginGame, applyMatterRoster,
}) {
  const [phase, setPhase] = React.useState(PHASES.IDLE);
  const blackDivRef = React.useRef(null);
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
    // The roar layer runs alongside the hum for the whole collapse; the
    // hard cut stops it along with everything else.
    audio.startSingularityCollapseRoar();
    setPhase(PHASES.COLLAPSING);
  }

  function exitSingularity() {
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
    // for as long as this game is active, and cleared by chassis's New
    // Game reset (see deactivateSingularityBoardFx). Set before
    // triggerBeginGame so the retint is already in place the instant
    // the board becomes visible, not one frame later.
    const t = three && three.current;
    if (t) t.singularityGameActive = true;
    // MATTER's chosen roster (the two rectangular new piece types plus
    // any custom counts of the five originals) actually gets placed
    // here, via the same Anomaly generator the plain button already
    // uses — see applyMatterRoster/buildRosterFromSelections in
    // themes/neon.js. LAWS/TOPOLOGIES and MATTER's two non-convex
    // pieces (L-Pentomino/Arch) still aren't wired to anything real;
    // this is the one category with a real gameplay effect so far.
    if (t && t.singularity && t.singularity.selections && applyMatterRoster) {
      applyMatterRoster(t.singularity.selections.matter);
    }
    if (triggerBeginGame) triggerBeginGame();
    exitSingularity();
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
  // frame when not actively dragging. Only active while still browsing
  // the root labels — once an overlay or the summary menu is showing,
  // their own DOM stops propagation before it ever reaches here (belt),
  // and this stage check is the suspenders.
  // A tap (as opposed to a drag) under this much total pointer movement
  // either opens a category (hit a root label) or counts toward the
  // triple-tap-to-finalize gesture (hit bare sphere) — see
  // handleSphereTap.
  const TAP_MOVE_THRESHOLD_PX = 6;

  function handlePointerDown(ev) {
    const t = three && three.current;
    if (!t || !t.singularity || t.singularity.phase !== PHASES.SPHERE) return;
    if (t.singularity.sphereMenuStage !== "labels") return;
    t.singularity.dragging = true;
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY, lastT: performance.now(), moved: 0 };
  }
  function handlePointerMove(ev) {
    const t = three && three.current;
    if (!t || !t.singularity || !t.singularity.dragging) return;
    const drag = dragStateRef.current;
    const now = performance.now();
    const dt = Math.max((now - drag.lastT) / 1000, 1 / 120);
    const dx = ev.clientX - drag.lastX;
    const dy = ev.clientY - drag.lastY;
    const moved = drag.moved + Math.abs(dx) + Math.abs(dy);
    dragStateRef.current = { lastX: ev.clientX, lastY: ev.clientY, lastT: now, moved };
    // Dead zone: the first few px of a drag don't rotate anything, so
    // an unsteady touch-down doesn't visibly nudge the sphere. Once
    // past it, every further px counts — this only ever suppresses the
    // very start of a gesture, not ongoing sensitivity.
    if (moved < DRAG_DEAD_ZONE_PX) return;
    if (t.singularity.sphere) {
      t.singularity.sphere.group.rotation.y += dx * DRAG_ROTATE_SENSITIVITY;
      t.singularity.sphere.group.rotation.x += dy * DRAG_ROTATE_SENSITIVITY;
    }
    /* Time-normalized "speed physics" — the same pattern the dock-piece
       preview this was ported from actually uses (chassis/ElCabeza3D.jsx,
       (dx * sensitivity) / dt), NOT a plain delta*scale. That distinction
       matters here specifically: a naive delta*scale reads the raw size
       of whatever pointermove event happened to fire, and touch input
       can coalesce a fast real swipe into one single large-delta event —
       which would read as one enormous one-frame "velocity" and blow
       straight past DRAG_DECAY's friction tuning regardless of how high
       it's set. Dividing by dt makes this genuine speed, robust to
       however few or many events the browser chose to deliver. */
    t.singularity.dragVelocity = {
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
    const hits = t.raycaster.intersectObject(sphere.mesh);
    if (!hits.length || !hits[0].uv) return;
    const category = categoryAtUv(hits[0].uv, t.singularity.rootLabels, t.singularity.labelCenterV);
    if (category) {
      openCategoryOverlay(t, category);
      audio.playSelect();
    } else {
      registerBareTap(t);
    }
  }

  return {
    singularityPhase: phase,
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
    phase === PHASES.SPHERE && stage === "labels" && renderLabelsHint(),
    phase === PHASES.SPHERE && stage === "overlay" && t && renderCategoryOverlay(t),
    phase === PHASES.SPHERE && stage === "summary" && renderSummaryPanel(setupExtras)
  );
}
