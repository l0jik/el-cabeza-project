/* Ciudad's times of day (user: "implement city as it currently is. Maybe
   just have a toggle switch to switch between the different times of day.
   It's all essentially the same map ... they can basically play in that
   city and change the time of day that they're playing").

   The five of the mock-ups (the scratch city's presets vv1 to vv4 and
   TEN_PM, as the glass towers page showed them): Morning, Afternoon,
   Golden Hour, Overcast and 10 PM. One city, one map; a time is its
   light: the sky, the sun (its colour, its strength and where it stands),
   the light from the sky and back off the ground, the haze, the
   exposure, and how far into the night it is (windows lit by plan, the
   street lamps and their pools, the cars' lamps, the cranes' beacons, the
   glass towers' crowns).

   The time chosen is kept (this browser) and can be given in the address
   (?time=morning, afternoon, golden, overcast or night). A change eases
   over a couple of seconds: every number goes from where it is to where
   it's going, the sun swinging across the sky, the windows coming on.

   Colours: the sky and the haze are written to the screen as they are
   (the sky's shader writes its colour; this three.js mixes the fog in
   after the output's encoding), so they stay as the hex says; the lights
   are linear, as the materials are (ciudad-models.js col()). */

import * as THREE from "three";

// Where each of the sky's four colours sits: the top of the sky (0) down
// to the horizon (1), as the mock-ups' gradients ran.
export const SKY_AT = [0, 0.4, 0.75, 1];

/* Each time as the mock-ups had it. sun.dir is where the sun stands as
   the first view of the board sees it (the camera to the south, looking
   north; x to the right, y up), as the mock-ups' cameras saw it. */
export const TIMES = [
  {
    id: "morning", name: "Morning", clock: "8:40 AM",
    sky: [[0, "#6a94c4"], [0.55, "#aec4d8"], [1, "#e6e2d8"]], fog: "#e2e0d8",
    sun: { color: "#fff4e4", i: 2.4, dir: [-9, 12, 7] }, hemi: ["#dce6f0", "#7a7468", 0.55], exposure: 1.0,
    night: 0, sunGlow: 0.55, clouds: 0.25, ground: "#6a665e",
  },
  {
    id: "afternoon", name: "Afternoon", clock: "2:10 PM",
    sky: [[0, "#6a94c4"], [0.55, "#aec4d8"], [1, "#e6e2d8"]], fog: "#e4e0d6",
    sun: { color: "#ffe8cc", i: 2.4, dir: [10, 10, 6] }, hemi: ["#dce6f0", "#7a7468", 0.55], exposure: 1.0,
    night: 0, sunGlow: 0.5, clouds: 0.3, ground: "#6a665e",
  },
  {
    id: "golden", name: "Golden Hour", clock: "7:05 PM",
    sky: [[0, "#5a7eb0"], [0.5, "#c8b4a0"], [1, "#f4d2a8"]], fog: "#f0d4b0",
    sun: { color: "#ffc088", i: 2.6, dir: [-14, 7, -3] }, hemi: ["#e8d0b8", "#5a5248", 0.45], exposure: 1.0,
    night: 0, sunGlow: 1, clouds: 0.35, ground: "#5e5446",
  },
  {
    id: "overcast", name: "Overcast", clock: "3:30 PM",
    sky: [[0, "#9aa6b2"], [0.6, "#c4ccd2"], [1, "#e0e2e0"]], fog: "#d8dcdc",
    sun: { color: "#f4f6f8", i: 1.1, dir: [-6, 14, 5] }, hemi: ["#e4e8ec", "#6a6c6e", 0.95], exposure: 1.0,
    night: 0, sunGlow: 0, clouds: 1, ground: "#62645f",
  },
  {
    // (10 PM: the moon's light, cool and low; everything else the city's own)
    id: "night", name: "10 PM", clock: "10:00 PM",
    sky: [[0, "#03060d"], [0.5, "#0a1324"], [0.82, "#1c2640"], [1, "#3a3452"]], fog: "#141a2c",
    sun: { color: "#9db2dc", i: 0.3, dir: [-9, 14, 7] }, hemi: ["#283858", "#0a0a0c", 0.42], exposure: 1.2,
    night: 1, sunGlow: 0, clouds: 0, ground: "#0c0c0e",
  },
];
const BY_ID = Object.fromEntries(TIMES.map((t) => [t.id, t]));
export const DEFAULT_TIME = "morning";
const KEY = "elcabeza.ciudad.time";
// How long a change of time takes, ms.
export const EASE_MS = 2400;

/* ------------------------------------------------------------ colours */

const hex3 = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
// a gradient's colour at t, from its stops ([t, hex], ...)
function gradAt(stops, t) {
  if (t <= stops[0][0]) return hex3(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / Math.max(1e-6, t1 - t0), a = hex3(c0), b = hex3(c1);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return hex3(stops[stops.length - 1][1]);
}
const lin = (h) => new THREE.Color(h).convertSRGBToLinear();

/* A time as plain numbers, ready to mix: the sky's four colours and the
   haze as they show (sRGB), the lights linear. */
function resolve(t) {
  const d = new THREE.Vector3(...t.sun.dir).normalize();
  return {
    sky: SKY_AT.map((a) => gradAt(t.sky, a)),
    fog: hex3(t.fog),
    sunColor: lin(t.sun.color), sunI: t.sun.i, sunDir: d,
    hemiSky: lin(t.hemi[0]), hemiGround: lin(t.hemi[1]), hemiI: t.hemi[2],
    exposure: t.exposure, night: t.night, sunGlow: t.sunGlow, clouds: t.clouds,
    ground: hex3(t.ground),
  };
}
function copy(s) {
  return {
    sky: s.sky.map((c) => c.slice()), fog: s.fog.slice(), sunColor: s.sunColor.clone(), sunI: s.sunI, sunDir: s.sunDir.clone(),
    hemiSky: s.hemiSky.clone(), hemiGround: s.hemiGround.clone(), hemiI: s.hemiI, exposure: s.exposure, night: s.night,
    sunGlow: s.sunGlow, clouds: s.clouds, ground: s.ground.slice(),
  };
}
const mixN = (a, b, k) => a + (b - a) * k;
const mix3 = (out, a, b, k) => { out[0] = mixN(a[0], b[0], k); out[1] = mixN(a[1], b[1], k); out[2] = mixN(a[2], b[2], k); return out; };

/* ------------------------------------------------------------ the time now */

function fromAddress() {
  try {
    const v = new URLSearchParams(window.location.search).get("time");
    if (!v) return null;
    const k = v.toLowerCase().replace(/[^a-z0-9]/g, "");
    return { morning: "morning", am: "morning", afternoon: "afternoon", pm: "afternoon", golden: "golden", goldenhour: "golden", sunset: "golden", overcast: "overcast", cloudy: "overcast", night: "night", "10pm": "night", ten: "night" }[k] || null;
  } catch (e) { return null; }
}
function fromStore() {
  try { const v = window.localStorage.getItem(KEY); return v && BY_ID[v] ? v : null; } catch (e) { return null; }
}
function store(id) { try { window.localStorage.setItem(KEY, id); } catch (e) { /* private window */ } }

const START = (typeof window !== "undefined" && (fromAddress() || fromStore())) || DEFAULT_TIME;

/* NOW: the light this frame, mixed, for the scene to read (ciudad-fx.js).
   Its numbers change only while a time is coming in. */
export const NOW = { id: START, fromId: START, k: 1, ...copy(resolve(BY_ID[START])), changing: false, version: 0 };
let from = copy(NOW), to = resolve(BY_ID[START]), t0 = 0, easing = false;
const listeners = new Set();

export const timeId = () => NOW.id;
export const timeOf = (id) => BY_ID[id] || BY_ID[DEFAULT_TIME];
export function onTimeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* Go to a time: eased from wherever the light is now (a change in the
   middle of another goes on from there), or at once. Kept for next time. */
export function setTime(id, { instant = false, keep = true } = {}) {
  if (!BY_ID[id]) return;
  const same = id === NOW.id && !easing;
  if (!same) NOW.fromId = NOW.changing && NOW.k < 0.5 ? NOW.fromId : NOW.id;
  NOW.id = id;
  if (keep) store(id);
  if (same && !instant) return;
  from = copy(NOW); to = resolve(BY_ID[id]);
  if (instant) { Object.assign(NOW, copy(to)); NOW.changing = false; NOW.k = 1; NOW.fromId = id; easing = false; NOW.version++; }
  else { t0 = -1; easing = true; NOW.changing = true; NOW.k = 0; }
  listeners.forEach((fn) => { try { fn(id); } catch (e) { /* a listener's own trouble */ } });
}
// The next time along (the order of the list), for a key or a test.
export function nextTime(step = 1) {
  const i = TIMES.findIndex((t) => t.id === NOW.id);
  return TIMES[(i + step + TIMES.length) % TIMES.length].id;
}

/* Each frame: the light moves on toward the time it's going to. Returns
   true while it's changing. */
export function stepTime(now) {
  if (!easing) return false;
  if (t0 < 0) t0 = now;
  const u = Math.min(1, (now - t0) / EASE_MS), k = u * u * (3 - 2 * u);
  NOW.k = k;
  NOW.sky.forEach((c, i) => mix3(c, from.sky[i], to.sky[i], k));
  mix3(NOW.fog, from.fog, to.fog, k); mix3(NOW.ground, from.ground, to.ground, k);
  NOW.sunColor.copy(from.sunColor).lerp(to.sunColor, k); NOW.sunI = mixN(from.sunI, to.sunI, k);
  NOW.sunDir.copy(from.sunDir).lerp(to.sunDir, k).normalize();
  NOW.hemiSky.copy(from.hemiSky).lerp(to.hemiSky, k); NOW.hemiGround.copy(from.hemiGround).lerp(to.hemiGround, k); NOW.hemiI = mixN(from.hemiI, to.hemiI, k);
  NOW.exposure = mixN(from.exposure, to.exposure, k);
  // (the windows come on a little behind the sky going dark, and go out ahead of the dawn)
  const kn = to.night > from.night ? Math.max(0, (k - 0.25) / 0.75) : Math.min(1, k / 0.75);
  NOW.night = mixN(from.night, to.night, kn);
  NOW.sunGlow = mixN(from.sunGlow, to.sunGlow, k); NOW.clouds = mixN(from.clouds, to.clouds, k);
  NOW.version++;
  if (u >= 1) { easing = false; NOW.changing = false; }
  return true;
}

// The test hook (window.__EC_TEST_HOOKS__): read and set the time.
if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
  window.__CIUDAD_TIME__ = { get: () => ({ id: NOW.id, night: NOW.night, changing: NOW.changing, exposure: NOW.exposure }), set: (id, instant) => setTime(id, { instant: !!instant }) };
}
