/* Luna's sky: black, the stars, the Milky Way, and the Earth (the real
   Earth: Natural Earth's coastlines, rough climate zones for its colours,
   clouds wound round a few storms, city lights on its night side; the
   maps baked from the mock-ups' renderer into assets/luna/). It hangs in
   the world, not on the board: it stays where it is as the board turns,
   as the sun does (the chassis's key light), and it travels with the
   camera, so it is always as far off. Low over the horizon, so tilting
   the view down to the ground brings it up over the hills. */

import * as THREE from "three";
import { cv, tex, col } from "./luna-models.js";
import earthDayUrl from "../assets/luna/earth-day.jpg";
import earthCloudsUrl from "../assets/luna/earth-clouds.jpg";
import earthLightsUrl from "../assets/luna/earth-lights.jpg";
import earthRoughUrl from "../assets/luna/earth-rough.jpg";

// Where the Earth hangs: a little left of straight ahead (the camera always looks the same way; the board turns
// under it), five degrees over the horizon, so tilting down to the ground brings it up over the hills.
export const EARTH_DIR = new THREE.Vector3(Math.sin(-0.26) * Math.cos(0.087), Math.sin(0.087), -Math.cos(0.26) * Math.cos(0.087)).normalize();
// Its own light: the sun a little beyond it, from the right (the mock-ups').
const EARTH_SUN = new THREE.Vector3(0.85, 0.3, -0.3).normalize();

const SKY_VS = "varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }";
// black overhead; below the horizon (only ever seen past the ground's far edge) the distant dust
const SKY_FS = "varying vec3 vW; void main(){ vec3 d = normalize(vW); float g = smoothstep(0.004, -0.03, d.y); gl_FragColor = vec4(mix(vec3(0.0), vec3(0.075, 0.072, 0.068), g), 1.0); }";
const BAND_FS = "uniform sampler2D map; varying vec3 vW; varying vec2 vUv; void main(){ vec3 d = normalize(vW); vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb * smoothstep(-0.005, 0.05, d.y), 1.0); }";
const BAND_VS = "varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }";

/* The Milky Way: a long soft band, dense with faint stars, dust lanes
   along it; drawn round the equator of a sphere that is then tipped
   across the sky. */
function milkyWayTexture(tier) {
  let s = 9177; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * rnd(), pick = (a) => a[Math.floor(rnd() * a.length)];
  const W = tier === "low" ? 2048 : 4096, H = W / 2, c = cv(W, H), x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const width = 0.1 * H, glow = 2.6, cy0 = H / 2, along = (t) => [t, cy0 + Math.sin((t / W) * Math.PI * 4 + 1.3) * H * 0.02];
  x.globalCompositeOperation = "lighter";
  for (let k = 0; k < 1400; k++) {
    const t = rnd() * W, [bx, by] = along(t), off = (rnd() + rnd() + rnd() - 1.5) * width, rad = rr(18, 70) * (W / 2048);
    const g = x.createRadialGradient(bx, by + off, 0, bx, by + off, rad), tint = pick(["150,170,220", "190,200,235", "220,215,230", "235,210,190"]), al = rr(0.008, 0.028) * glow;
    g.addColorStop(0, `rgba(${tint},${al})`); g.addColorStop(1, `rgba(${tint},0)`); x.fillStyle = g; x.fillRect(bx - rad, by + off - rad, rad * 2, rad * 2);
  }
  const dots = tier === "low" ? 9000 : 16000;
  for (let k = 0; k < dots; k++) {
    const t = rnd() * W, [bx, by] = along(t), off = (rnd() + rnd() + rnd() + rnd() - 2) * width * 0.8;
    x.globalAlpha = rr(0.15, 0.6); x.fillStyle = pick(["#ffffff", "#dfe8ff", "#fff1d8", "#cfdcff"]); x.fillRect(bx, by + off, rr(0.6, 1.2), rr(0.6, 1.2));
  }
  x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
  for (let k = 0; k < 240; k++) {
    const t = rnd() * W, [bx, by] = along(t), off = (rnd() - 0.5) * width * 0.5, rad = rr(10, 40) * (W / 2048);
    const g = x.createRadialGradient(bx, by + off, 0, bx, by + off, rad);
    g.addColorStop(0, "rgba(0,0,0,0.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(bx - rad, by + off - rad, rad * 2, rad * 2);
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping;
  return t;
}

/* The stars: points of light all over the sky above the horizon, a few
   bright, in the colours stars are. Three sizes. */
function stars(tier, pr) {
  let s = 3141; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = (a) => a[Math.floor(rnd() * a.length)];
  const n = tier === "low" ? 1600 : 2800, sets = [[[], []], [[], []], [[], []]];
  const tints = ["#ffffff", "#ffffff", "#dfe8ff", "#cdd9ff", "#fff1d8", "#ffd9a8", "#ffc4a0"].map((c) => col(c));
  for (let i = 0; i < n; i++) {
    const y = -0.02 + rnd() * 1.02, r = Math.sqrt(Math.max(0, 1 - y * y)), a = rnd() * Math.PI * 2, size = rnd() < 0.05 ? 2 : rnd() < 0.3 ? 1 : 0;
    const b = (0.25 + 0.75 * rnd()) * (size === 2 ? 1 : 0.85), c = pick(tints);
    sets[size][0].push(Math.cos(a) * r * 140, y * 140, Math.sin(a) * r * 140); sets[size][1].push(c.r * b, c.g * b, c.b * b);
  }
  const g = new THREE.Group();
  sets.forEach(([p, c], i) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: [1.1, 1.7, 2.6][i] * pr, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; pts.renderOrder = -28; g.add(pts);
  });
  return g;
}

const EARTH_VS = "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }";
const EARTH_FS = [
  "uniform sampler2D dayMap; uniform sampler2D lightMap; uniform sampler2D cloudMap; uniform sampler2D roughMap; uniform vec3 sunDir; uniform float lights; uniform float ready;",
  "varying vec2 vUv; varying vec3 vN; varying vec3 vV;",
  "void main(){",
  "  vec3 N = normalize(vN), V = normalize(vV), L = normalize(sunDir);",
  "  float ndl = dot(N, L), day = smoothstep(-0.06, 0.2, ndl);",
  "  vec3 g = texture2D(dayMap, vUv).rgb; g = g * g;",
  "  float cl = texture2D(cloudMap, vUv).r;",
  "  float clShadow = texture2D(cloudMap, vUv + vec2(-0.004, 0.003)).r;",
  "  vec3 surf = mix(g * (1.0 - 0.35 * clShadow), vec3(0.92, 0.94, 0.97), cl * 0.92);",
  "  float rough = texture2D(roughMap, vUv).r;",
  "  vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0), spec = (pow(nh, 260.0) * 0.9 + pow(nh, 22.0) * 0.07) * (1.0 - rough) * (1.0 - cl);",
  "  vec3 lit = surf * (max(ndl, 0.0) * 1.25 + 0.012) + vec3(1.0, 0.93, 0.8) * spec * day;",
  "  float lt = texture2D(lightMap, vUv).r; vec3 night = vec3(lt, lt * 0.78, lt * 0.45); night = night * night * (1.0 - day) * (1.0 - cl * 0.85) * lights;",
  "  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);",
  "  vec3 c = lit + night + vec3(0.18, 0.42, 1.0) * rim * 0.55 * smoothstep(-0.2, 0.4, ndl);",
  "  gl_FragColor = vec4(sqrt(max(c, 0.0)) * ready, 1.0);",
  "}",
].join("\n");
const ATM_VS = "varying vec3 vNv; varying vec3 vNw; void main(){ vNv = normalize(normalMatrix * normal); vNw = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const ATM_FS = "uniform vec3 sunDir; uniform vec3 glow; uniform float ready; varying vec3 vNv; varying vec3 vNw; void main(){ float k = pow(max(0.0, 0.55 - vNv.z), 5.0) * 1.5; float day = smoothstep(-0.35, 0.5, dot(normalize(vNw), sunDir)); float a = k * (0.07 + 0.93 * day) * ready; gl_FragColor = vec4(glow * a, a); }";

function earth(tier) {
  const dist = 120, R = dist * Math.tan((3.6 * Math.PI) / 180), g = new THREE.Group();
  const loader = new THREE.TextureLoader(), maps = {}, uniforms = {
    dayMap: { value: null }, lightMap: { value: null }, cloudMap: { value: null }, roughMap: { value: null },
    sunDir: { value: EARTH_SUN.clone() }, lights: { value: 1.3 }, ready: { value: 0 },
  };
  let loaded = 0;
  [["dayMap", earthDayUrl], ["cloudMap", earthCloudsUrl], ["lightMap", earthLightsUrl], ["roughMap", earthRoughUrl]].forEach(([k, url]) => {
    maps[k] = loader.load(url, () => { if (++loaded === 4) { uniforms.ready.value = 1; atmU.ready.value = 1; } });
    maps[k].wrapS = THREE.RepeatWrapping; uniforms[k].value = maps[k];
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, tier === "low" ? 64 : 112, tier === "low" ? 32 : 56), new THREE.ShaderMaterial({ uniforms, vertexShader: EARTH_VS, fragmentShader: EARTH_FS, fog: false }));
  const atmU = { sunDir: { value: EARTH_SUN.clone() }, glow: { value: col("#6fb4ff") }, ready: { value: 0 } };
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 72, 36), new THREE.ShaderMaterial({ uniforms: atmU, vertexShader: ATM_VS, fragmentShader: ATM_FS, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ball.renderOrder = -27; atm.renderOrder = -26;
  // the face toward us: the Atlantic, the Americas' east and Africa and Europe's west, the axis tipped
  const toUs = EARTH_DIR.clone().negate();
  g.quaternion.setFromAxisAngle(toUs, 0.41).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.91 + Math.atan2(-EARTH_DIR.x, -EARTH_DIR.z) - 0.31));
  g.add(ball, atm);
  g.userData.offset = EARTH_DIR.clone().multiplyScalar(dist);
  g.userData.dispose = () => { Object.values(maps).forEach((t) => t.dispose()); ball.geometry.dispose(); ball.material.dispose(); atm.geometry.dispose(); atm.material.dispose(); };
  return g;
}

export function createSky({ tier, pixelRatio }) {
  const group = new THREE.Group(); group.name = "luna-sky";
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -30; dome.frustumCulled = false;
  const bandTex = milkyWayTexture(tier);
  const band = new THREE.Mesh(new THREE.SphereGeometry(146, 96, 48), new THREE.ShaderMaterial({ uniforms: { map: { value: bandTex } }, vertexShader: BAND_VS, fragmentShader: BAND_FS, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  // tipped across the sky, rising from the right of the view up over the left
  band.rotation.set(0.25, 0.9, 0.95); band.renderOrder = -29; band.frustumCulled = false;
  const starField = stars(tier, pixelRatio);
  const theEarth = earth(tier);
  group.add(dome, band, starField, theEarth);
  [dome, band].forEach((m) => { m.raycast = () => {}; });
  return {
    group,
    tick(camera) {
      group.position.copy(camera.position);
      theEarth.position.copy(theEarth.userData.offset);
    },
    dispose() {
      group.parent && group.parent.remove(group);
      dome.geometry.dispose(); dome.material.dispose(); band.geometry.dispose(); band.material.dispose(); bandTex.dispose();
      starField.children.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
      theEarth.userData.dispose();
    },
  };
}
