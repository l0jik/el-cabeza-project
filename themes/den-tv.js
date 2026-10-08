/* The den's television: a 1975 color console against the south wall
   (den-room.js places it; den-fx.js runs it).

   A walnut cabinet on a dark plinth: the picture tube's curved glass in a
   black bezel, a panel of brushed gold beside it (the brand, the VHF
   channel selector with its numbers round it, the UHF dial, the power
   knob with its pilot light), a speaker grille along the bottom, rabbit
   ears with a UHF loop on top, and a photograph in a frame.

   Turned on (power: the knob turns with a click), the tube warms up: a
   dot of light in the middle, pulled out into a line and open to the
   whole screen, snow, and then the test pattern comes in. In Nova the
   picture then pulls the camera in (dive: the pattern swirls toward its
   centre and turns to Singularity's colours) and den-fx.js hands over to
   Nova's own transition. Turned off, the picture collapses to a line and
   a dot that fades, as a tube does.

   The screen is a small shader (screenMaterial); the rest is lit like the
   stereo console, since the camera comes up close. Coordinates are the
   den's (den-room.js): +x is on the left as one faces the set. */

import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTexture, repaint } from "./tienda-textures.js";
import { paintWood } from "./wood-set.js";
import { quality } from "./tienda-quality.js";
import * as TX from "./den-textures.js";
import { createCommercial, createSingularityFrame, COMMERCIAL_MS } from "./den-commercial.js";

// The timeline, in ms from the moment the knob turns.
export const TV_TIMES = {
  raster: 1300, // the dot opens to the full screen
  snow: 1200, // then snow
  resolve: 800, // the test pattern comes in
  diveAfter: 700, // (Nova) the pattern holds, then the dive
  dive: 1900,
  enterAt: 1500, // into the dive, Nova's transition takes over
  collapse: 450, // switching off: the picture folds to a line, a dot
  afterglow: 1400, // and the dot fades
};

/* The test pattern: color bars with the reverse strip and the low band
   under them, a circle and cross-hair over it all, and the station's
   caption across the middle. */
function testPattern() {
  // Drawn in a 512 x 384 frame (the screen's 4:3) scaled to whatever size
  // the canvas is given (a power of two), so the circle stays round.
  return canvasTexture(512, 384, (g, CW, CH) => {
    g.setTransform(CW / 512, 0, 0, CH / 384, 0, 0);
    const W = 512, H = 384;
    const bars = ["#C0C0C0", "#C0C000", "#00C0C0", "#00C000", "#C000C0", "#C00000", "#0000C0"];
    const rev = ["#0000C0", "#131313", "#C000C0", "#131313", "#00C0C0", "#131313", "#C0C0C0"];
    const bw = W / 7;
    bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.floor(i * bw), 0, Math.ceil(bw) + 1, H * 0.67); });
    rev.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.floor(i * bw), H * 0.67, Math.ceil(bw) + 1, H * 0.08); });
    [["#00214C", 1.25], ["#FFFFFF", 1.25], ["#32006A", 1.25], ["#131313", 1.25], ["#090909", 0.34], ["#131313", 0.33], ["#1D1D1D", 0.33], ["#131313", 1]]
      .reduce((x, [c, w]) => { g.fillStyle = c; g.fillRect(x, H * 0.75, bw * w + 1, H * 0.25); return x + bw * w; }, 0);
    // The circle and the cross-hair.
    g.strokeStyle = "rgba(255,255,255,0.92)"; g.lineWidth = 3;
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.36, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2, H * 0.1); g.lineTo(W / 2, H * 0.9); g.moveTo(W * 0.24, H / 2); g.lineTo(W * 0.76, H / 2); g.stroke();
    for (let i = -4; i <= 4; i++) { if (!i) continue; g.beginPath(); g.moveTo(W / 2 + i * H * 0.08, H / 2 - 6); g.lineTo(W / 2 + i * H * 0.08, H / 2 + 6); g.stroke(); }
    // The station's caption.
    g.fillStyle = "#0A0A0A"; g.fillRect(W * 0.3, H * 0.41, W * 0.4, H * 0.18);
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2; g.strokeRect(W * 0.3, H * 0.41, W * 0.4, H * 0.18);
    g.fillStyle = "#F4F4F4"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${Math.round(H * 0.075)}px 'Courier Prime', 'Courier New', monospace`;
    g.fillText("SINGULARITY", W / 2, H * 0.475);
    g.font = `700 ${Math.round(H * 0.04)}px 'Courier Prime', 'Courier New', monospace`;
    g.fillText("CANAL 99  ·  TEST", W / 2, H * 0.545);
  }, { scale: false });
}

/* The picture tube's face. uRaster: 0 a dot, then a line, 1 the whole
   screen (the beam's light squeezed into less screen is brighter); uSnow
   and uPattern: what's on it; uDive: the pull toward the pattern's centre;
   uGlow: how bright; uDot: the afterglow's dot, switching off. */
function screenMaterial(pattern) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: pattern },
      uTime: { value: 0 },
      uRaster: { value: 0 },
      uSnow: { value: 0 },
      uPattern: { value: 0 },
      uDive: { value: 0 },
      uGlow: { value: 0 },
      uDot: { value: 0 },
      // The set, off, haunted (the lure, below): a bright bar rolling down,
      // the picture torn sideways.
      uLine: { value: -1 },
      uLineAmt: { value: 0 },
      uTear: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uTime, uRaster, uSnow, uPattern, uDive, uGlow, uDot, uLine, uLineAmt, uTear;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        // Torn: each band of lines pushed sideways by its own amount.
        float band = floor(vUv.y * 38.0 + floor(uTime * 9.0) * 3.0);
        c.x += uTear * (fract(sin(band * 91.7) * 4375.5) - 0.5) * 0.12;
        // The dead tube: dark glass, grey-green, a sheen of the room on it.
        vec3 col = vec3(0.055, 0.065, 0.06) + 0.05 * smoothstep(0.55, 0.0, length(c * vec2(1.0, 1.3)));
        col += 0.09 * smoothstep(0.07, 0.0, abs(c.x * 0.55 + c.y - 0.2)) * smoothstep(0.5, 0.2, abs(c.x));
        // The raster: wide first, then tall.
        float rx = clamp(uRaster * 2.2, 0.0, 1.0);
        float ry = clamp((uRaster - 0.4) / 0.6, 0.0, 1.0);
        float hw = mix(0.006, 0.5, rx), hh = mix(0.0045, 0.5, ry * ry);
        float inside = (1.0 - smoothstep(hw - 0.004, hw, abs(c.x))) * (1.0 - smoothstep(hh - 0.004, hh, abs(c.y)));
        // Snow, and the pattern (pulled in and turned by the dive).
        float n = hash(floor(vUv * vec2(170.0, 128.0)) + floor(uTime * 24.0) * 7.13);
        vec3 snow = vec3(n * 0.85 + 0.1);
        vec2 p = c * (1.0 - 0.82 * uDive);
        float a = uDive * uDive * 5.0 * (0.6 - length(p));
        p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
        vec3 pat = texture2D(uTex, p + 0.5).rgb;
        pat = mix(pat, vec3(pat.b * 0.5 + pat.r * 0.3, pat.g * 0.7 + pat.b * 0.5, pat.r * 0.8 + pat.g * 0.6) * 1.35, uDive);
        vec3 pic = mix(snow, pat, uPattern);
        pic = mix(pic, snow, uSnow * uPattern * 0.35);
        float scan = 0.8 + 0.2 * sin(vUv.y * 3.14159 * 260.0);
        float vig = smoothstep(0.78, 0.2, length(c * vec2(1.0, 1.25)));
        float squeeze = 1.0 + 2.5 * (1.0 - rx * ry);
        col += inside * pic * scan * vig * uGlow * squeeze;
        col += vec3(0.85, 0.92, 1.0) * uDot * (1.0 - smoothstep(0.004, 0.03, length(c * vec2(1.0, 1.33))));
        col += vec3(0.7, 0.85, 1.0) * uLineAmt * smoothstep(0.035, 0.0, abs(vUv.y - uLine)) * vig;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const clamp01 = (u) => Math.max(0, Math.min(1, u));

export function buildTelevision(yF, RZ, X = -40) {
  const q = quality();
  const group = new THREE.Group();
  group.name = "den-tv";
  const disposables = [];
  const lit = (o) => { const m = q.physical ? new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }) : new THREE.MeshLambertMaterial(o); disposables.push(m); return m; };
  const add = (geo, mat, parent = group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); disposables.push(geo); return m; };

  const D = 13, CZ = RZ - D / 2 - 1, FRONT = CZ - D / 2;
  const BASE = yF + 2.5, TOP = yF + 22.5;
  const SX = X + 4.5, SY = yF + 15; // the screen's middle
  const PX = X - 11.75; // the control panel's middle

  const grain = canvasTexture(512, 256, (g, W, H) => paintWood(g, 0, 0, W, H, { base: "#5A3920", grain: "#2A170B", figure: "#4A2F1B", horizontal: true, seed: 1975, density: 0.75 }));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  disposables.push(grain);
  const walnut = lit({ map: grain, color: 0xe8d4c0, roughness: 0.38 });
  const walnutDark = lit({ color: 0x2a180c, roughness: 0.6 });
  const bezel = lit({ color: 0x141110, roughness: 0.3 });
  const chrome = lit({ color: 0xdedcd6, roughness: 0.18, metalness: q.physical ? 0.3 : 0 });
  const black = lit({ color: 0x121010, roughness: 0.5 });
  const brushed = canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = "#C9A55C"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,246,220" : "70,50,20"},${0.04 + Math.random() * 0.07})`; g.fillRect(0, y, W, 1); }
  });
  disposables.push(brushed);
  const gold = lit({ map: brushed, color: 0xfff4de, roughness: 0.3, metalness: q.physical ? 0.3 : 0 });

  /* ---- the cabinet ---- */
  add(new THREE.BoxGeometry(34, 2.5, 11).translate(X, yF + 1.25, CZ + 0.6), walnutDark);
  add(new THREE.BoxGeometry(36, TOP - BASE, D).translate(X, (BASE + TOP) / 2, CZ), walnut);
  add(new THREE.BoxGeometry(37, 1.1, D + 1).translate(X, TOP + 0.55, CZ - 0.3), walnut);
  // A dark reveal under the top's lip, and the grille band along the bottom.
  add(new THREE.BoxGeometry(35.6, 0.3, 0.2).translate(X, TOP - 0.2, FRONT - 0.1), walnutDark);
  const cloth = TX.grilleCloth(); cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping; cloth.repeat.set(8, 1); disposables.push(cloth);
  add(new THREE.PlaneGeometry(33, 3.8).rotateY(Math.PI).translate(X, BASE + 2.9, FRONT - 0.04), lit({ map: cloth, color: 0xe2d2b8, roughness: 0.95 }));
  [[0, 2.1, 34, 0.5], [0, -2.1, 34, 0.5], [-16.75, 0, 0.5, 4.7], [16.75, 0, 0.5, 4.7]].forEach(([dx, dy, w, h]) => add(new THREE.BoxGeometry(w, h, 0.4).translate(X + dx, BASE + 2.9 + dy, FRONT - 0.15), walnut));

  /* ---- the picture tube: its bezel and the curved glass ---- */
  const rr = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const face = rr(20.4, 15.4, 1.4);
  face.holes.push(rr(17.2, 12.6, 1.9));
  const bezelGeo = new THREE.ExtrudeGeometry(face, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 6 });
  bezelGeo.rotateY(Math.PI).translate(SX, SY, FRONT + 0.1);
  add(bezelGeo, bezel);
  // A thin chrome line round the window.
  const trim = rr(17.8, 13.2, 2.0);
  trim.holes.push(rr(17.2, 12.6, 1.9));
  add(new THREE.ShapeGeometry(trim, 6).rotateY(Math.PI).translate(SX, SY, FRONT - 0.95), chrome);
  // The glass: a pillow, bulging out of the window toward the room.
  const glassGeo = new THREE.PlaneGeometry(17.6, 13, 24, 18);
  {
    const p = glassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / 8.8, v = p.getY(i) / 6.5;
      p.setZ(i, 1.5 * (1 - u * u) * (1 - v * v) + 0.1);
    }
    glassGeo.computeVertexNormals();
  }
  glassGeo.rotateY(Math.PI).translate(SX, SY, FRONT - 0.3);
  const pattern = testPattern();
  disposables.push(pattern);
  const screen = screenMaterial(pattern);
  disposables.push(screen);
  const glass = add(glassGeo, screen);
  glass.userData.tv = "screen";
  // The picture's light on the room: a halo in front of the glass.
  const haloTex = canvasTexture(128, 128, (g, W) => {
    const rg = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    rg.addColorStop(0, "rgba(220,232,255,1)"); rg.addColorStop(0.35, "rgba(160,190,255,0.45)"); rg.addColorStop(1, "rgba(120,150,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, W);
  }, { scale: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  disposables.push(halo.geometry, halo.material, haloTex);
  halo.rotation.y = Math.PI; halo.position.set(SX, SY, FRONT - 2.2);
  halo.renderOrder = 3;
  group.add(halo);
  // And on what's lit near it (the set, the console), where the device
  // can afford another light.
  const screenLight = q.physical ? new THREE.PointLight(0xa8c0ff, 0, 46, 2) : null;
  if (screenLight) { screenLight.position.set(SX, SY, FRONT - 7); group.add(screenLight); }
  /* The blast (den-fx.js, once while it lures, user): a cone of light
     pouring out from the screen's edges into the room, growing until all
     goes white. A frustum from the tube's outline (v 0) flaring out to
     BLAST_SPREAD times it (v 1), uLen long; brightest at the glass and
     along its edges, with rays through it. */
  const BLAST_SPREAD = 5.2;
  const coneGeo = new THREE.BufferGeometry();
  {
    const HW = 8.8, HH = 6.5, NV = 24, pos = [], uv = [], idx = [];
    const corners = [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH]];
    for (let side = 0; side < 4; side++) {
      const a = corners[side], b = corners[(side + 1) % 4], base = pos.length / 3;
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= 1; i++) {
        const c = i ? b : a;
        pos.push(c[0], c[1], 0); uv.push(side + i, j / NV);
      }
      for (let j = 0; j < NV; j++) { const r0 = base + j * 2, r1 = r0 + 2; idx.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1); }
    }
    coneGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    coneGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    coneGeo.setIndex(idx);
  }
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 0 }, uLen: { value: 1 }, uTime: { value: 0 }, uSpread: { value: BLAST_SPREAD } },
    vertexShader: `
      uniform float uLen, uSpread; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.xy *= mix(1.0, uSpread, uv.y);
        p.z = -uv.y * uLen;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uAmt, uTime; varying vec2 vUv;
      void main() {
        float along = pow(1.0 - vUv.y, 0.9);
        float u = fract(vUv.x);
        float edge = 0.8 + 0.2 * pow(abs(u - 0.5) * 2.0, 2.0);
        float rays = 0.55 + 0.45 * abs(sin(vUv.x * 23.0 + uTime * 2.3) * sin(vUv.x * 9.0 - uTime * 1.3 + vUv.y * 2.0));
        float a = clamp(uAmt * along * edge * rays, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.86, 0.91, 1.0) * a, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(SX, SY, FRONT - 0.6);
  cone.visible = false; cone.renderOrder = 4; cone.frustumCulled = false;
  group.add(cone);
  disposables.push(coneGeo, coneMat);

  /* ---- the control panel ---- */
  add(new THREE.BoxGeometry(9.6, 13.2, 0.4).translate(PX, SY, FRONT - 0.2), gold);
  /* The panel's printing, laid out with the knobs (a height f down the
     panel is y = SY + (0.5 - f) * 13.2): the brand; the VHF channels round
     the selector (f 0.37); the UHF dial's scale over its knob (f 0.705);
     the power knob, its labels and the pilot light along the bottom
     (f 0.88). */
  const panelTex = canvasTexture(256, 352, (g, CW, CH) => {
    // In a 256 x 352 frame (the panel's shape), scaled to the canvas's own
    // (power-of-two) size, so the lettering keeps its proportions.
    g.clearRect(0, 0, CW, CH);
    g.setTransform(CW / 256, 0, 0, CH / 352, 0, 0);
    const W = 256, H = 352;
    g.fillStyle = "#2B1B0E"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${Math.round(W * 0.15)}px 'Bodoni Moda', Georgia, serif`;
    g.fillText("Aurora", W / 2, H * 0.06);
    g.font = `700 ${Math.round(W * 0.05)}px 'Libre Franklin', Arial, sans-serif`;
    g.fillText("SOLID STATE COLOR", W / 2, H * 0.12);
    const cy = H * 0.37, r = W * 0.25;
    g.font = `700 ${Math.round(W * 0.065)}px 'Libre Franklin', Arial, sans-serif`;
    for (let ch = 2; ch <= 13; ch++) {
      const a = -Math.PI / 2 + ((ch - 2) / 12) * Math.PI * 2;
      g.fillText(String(ch), W / 2 + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    const uy = H * 0.705;
    g.strokeStyle = "#2B1B0E"; g.lineWidth = 2;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * (0.8 + (i / 20) * 1.4), r0 = W * 0.15, r1 = W * (i % 5 ? 0.17 : 0.19);
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0, uy + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * r1, uy + Math.sin(a) * r1); g.stroke();
    }
    g.font = `700 ${Math.round(W * 0.05)}px 'Libre Franklin', Arial, sans-serif`;
    g.fillText("UHF", W / 2, H * 0.795);
    g.fillText("VOLUME", W * 0.57, H * 0.855);
    g.fillText("OFF · ON", W * 0.57, H * 0.905);
  }, { scale: false });
  disposables.push(panelTex);
  const printMat = new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, color: 0xb8a890, depthWrite: false, fog: true });
  disposables.push(printMat);
  const print = add(new THREE.PlaneGeometry(9.6, 13.2).rotateY(Math.PI).translate(PX, SY, FRONT - 0.42), printMat);
  print.renderOrder = 1;
  // A knob: a skirt, a body, a pointer. Returns the body's group (it turns).
  const knob = (x, y, r, depth) => {
    const k = new THREE.Group();
    k.position.set(x, y, FRONT - 0.4);
    group.add(k);
    add(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.25, 32).rotateX(Math.PI / 2).translate(0, 0, -0.12), chrome, k);
    add(new THREE.CylinderGeometry(r, r * 0.9, depth, 24).rotateX(Math.PI / 2).translate(0, 0, -0.25 - depth / 2), black, k);
    add(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.08, 24).rotateX(Math.PI / 2).translate(0, 0, -0.26 - depth), chrome, k);
    add(new THREE.BoxGeometry(0.16, r * 0.8, 0.1).translate(0, r * 0.45, -0.3 - depth), chrome, k);
    return k;
  };
  // (A knob turned by +a turns clockwise as one faces the set.)
  const at = (f) => SY + (0.5 - f) * 13.2;
  const vhf = knob(PX, at(0.37), 1.4, 1.3);
  vhf.rotation.z = (3 / 12) * Math.PI * 2; // on channel 5
  const uhf = knob(PX, at(0.705), 0.85, 1.0);
  uhf.rotation.z = 0.8;
  // The power knob left of its labels, the pilot light right of them (a
  // point f across the printing is x = PX - (f - 0.5) * 9.6: the panel
  // faces the room, so its left is +x).
  const power = knob(PX + 2.2, at(0.88), 0.95, 1.1);
  power.rotation.z = -0.9;
  /* After the story (Nova, den-fx.js): the channel dial (the big knob
     with the numbers round it; user) glows, and each turn of it clicks
     the set over to another channel, another reality. The glow: a soft
     disc of light round it, breathing. */
  const knobGlowTex = (() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, "rgba(255,236,190,1)"); g.addColorStop(0.35, "rgba(255,190,110,0.55)"); g.addColorStop(1, "rgba(255,150,60,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const knobGlowMat = new THREE.MeshBasicMaterial({ map: knobGlowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  disposables.push(knobGlowMat); if (knobGlowTex) disposables.push(knobGlowTex);
  const knobGlow = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4).rotateY(Math.PI), knobGlowMat);
  knobGlow.position.set(PX, at(0.37), FRONT - 1.9); knobGlow.renderOrder = 4; knobGlow.visible = false;
  disposables.push(knobGlow.geometry);
  group.add(knobGlow);
  let knobGlowOn = false, chanAt = 0, chanBlip = 0;
  const pilotMat = new THREE.MeshBasicMaterial({ color: 0x3a0d08, fog: true });
  disposables.push(pilotMat);
  add(new THREE.CircleGeometry(0.28, 16).rotateY(Math.PI).translate(PX - 2.6, at(0.88), FRONT - 0.45), pilotMat);
  add(new THREE.TorusGeometry(0.34, 0.07, 6, 16).rotateY(Math.PI).translate(PX - 2.6, at(0.88), FRONT - 0.45), chrome);

  /* ---- on top: the rabbit ears, a photograph ---- */
  const earsX = SX + 2;
  add(new THREE.SphereGeometry(1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(earsX, TOP + 1.1, CZ + 2), black);
  add(new THREE.TorusGeometry(2.2, 0.07, 6, 32).translate(earsX, TOP + 3.3, CZ + 1.6), chrome);
  [-1, 1].forEach((s) => {
    const rod = new THREE.Group();
    rod.position.set(earsX, TOP + 1.8, CZ + 2);
    rod.rotation.z = s * 0.52; rod.rotation.x = 0.16;
    group.add(rod);
    add(new THREE.CylinderGeometry(0.05, 0.09, 15, 6).translate(0, 7.5, 0), chrome, rod);
    add(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 15, 0), chrome, rod);
  });
  const photo = canvasTexture(128, 160, (g, CW, CH) => {
    g.setTransform(CW / 128, 0, 0, CH / 160, 0, 0);
    const W = 128, H = 160;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#C8B08A"); sky.addColorStop(0.55, "#A88B62"); sky.addColorStop(1, "#6E5436");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Two figures on a beach, arm in arm, as a snapshot of the time.
    g.fillStyle = "rgba(60,40,24,0.85)";
    [0.4, 0.6].forEach((x) => { g.beginPath(); g.arc(W * x, H * 0.46, W * 0.07, 0, 7); g.fill(); g.fillRect(W * (x - 0.09), H * 0.53, W * 0.18, H * 0.38); });
    g.fillStyle = "rgba(255,240,210,0.12)"; g.fillRect(0, 0, W, H * 0.3);
  }, { scale: false });
  disposables.push(photo);
  const frame = new THREE.Group();
  frame.position.set(X - 10, TOP + 1.1, CZ + 1);
  frame.rotation.x = 0.18; frame.rotation.y = 0.25;
  group.add(frame);
  add(new THREE.BoxGeometry(4.6, 5.8, 0.4).translate(0, 2.9, 0), lit({ color: 0xc99a3e, roughness: 0.35, metalness: q.physical ? 0.3 : 0 }), frame);
  add(new THREE.PlaneGeometry(3.8, 5).rotateY(Math.PI).translate(0, 2.9, -0.21), lit({ map: photo, roughness: 0.6 }), frame);

  /* The parts that never move or change, merged by material: dozens of
     pieces, a dozen draw calls. The screen, its halo, the printing (drawn
     over the panel), the power knob and the channel dial (they turn) stay
     as they are. */
  {
    const keep = new Set([glass, halo, print, cone]); // (and the blast's cone, which moves)
    power.traverse((o) => keep.add(o));
    vhf.traverse((o) => keep.add(o)); // (the channel dial turns, after the story)
    group.updateMatrixWorld(true);
    const byMat = new Map();
    const statics = [];
    group.traverse((o) => { if (o.isMesh && !keep.has(o) && !Array.isArray(o.material)) statics.push(o); });
    statics.forEach((m) => {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      Object.keys(flat.attributes).forEach((k) => { if (!["position", "normal", "uv"].includes(k)) flat.deleteAttribute(k); });
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(flat);
      m.parent.remove(m);
    });
    byMat.forEach((geos, mat) => {
      const merged = geos.length > 1 ? BufferGeometryUtils.mergeBufferGeometries(geos, false) : geos[0];
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      disposables.push(merged);
      group.add(new THREE.Mesh(merged, mat));
    });
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // What a tap can land on: the knob, and (a bigger mark to hit from
  // across the room) the whole face of the set.
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(hitMat);
  const hit = add(new THREE.BoxGeometry(36, 20, 2).translate(X, (BASE + TOP) / 2, FRONT - 1), hitMat);
  hit.userData.tv = "set";
  const pickables = [hit];
  power.traverse((o) => { if (o.isMesh) { o.userData.tv = "power"; pickables.push(o); } });
  // (The channel dial: after the story, the channels; den-fx.js. Its
  // parts merged by material, two draw calls, turning as one.)
  {
    const byMat = new Map();
    vhf.children.slice().forEach((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone(); m.updateMatrix(); g.applyMatrix4(m.matrix);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(g);
      vhf.remove(m); m.geometry.dispose();
    });
    byMat.forEach((geos, mat) => {
      const keepAttrs = ["position", "normal", "uv"];
      geos.forEach((gg) => Object.keys(gg.attributes).forEach((k) => { if (!keepAttrs.includes(k)) gg.deleteAttribute(k); }));
      const merged = BufferGeometryUtils.mergeBufferGeometries(geos.map((gg) => (gg.index ? gg.toNonIndexed() : gg)), false);
      disposables.push(merged);
      const mm = new THREE.Mesh(merged, mat); mm.userData.tv = "channel"; vhf.add(mm); pickables.push(mm);
    });
  }

  /* ---- the set's life ---- */
  // The commercial (den-commercial.js: the user's spot, a video), made
  // when it's first shown.
  let commercial = null;
  let phase = "off", t0 = 0, portal = false, entered = false, onEnter = null;
  let knobA = -0.9, knobGoal = -0.9;
  const u = screen.uniforms;
  const since = (now) => now - t0;
  function set(p, now) {
    // (Off the commercial, its video stops too.)
    if (phase === "commercial" && p !== "commercial" && commercial) commercial.pause();
    phase = p; t0 = now;
  }

  /* ---- the set, off, haunted (Nova, the first time home: den-fx.js's
     lure, until the knob's turned) ----
     Now and then, more often and more strongly as `level` rises (0 to 1),
     something happens on the dead tube: a breath of snow, a bright bar
     rolling down, the picture torn, a ghost of a strange piece on the
     glass, the pilot light stuttering, a thump that lights the tube, the
     picture rolling as if a dial were being turned, a garbled voice with
     the ghost; and, stronger, pieces made of light
     drifting out of the screen into the room and fading. Each event says
     what it is (onEvent) for its sound. */
  const ghosts = [];
  const ghostTex = (seed) => canvasTexture(512, 384, (g, CW, CH) => {
    g.setTransform(CW / 512, 0, 0, CH / 384, 0, 0);
    g.fillStyle = "#050608"; g.fillRect(0, 0, 512, 384);
    let r = seed;
    const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    // A piece of cubes seen from above and to one side, drawn in light,
    // the red and the blue a little apart (a set's convergence off).
    const cells = [];
    const n = 3 + Math.floor(rnd() * 4);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cells.push([cx, cy, cz]); const d = Math.floor(rnd() * 3); if (d === 0) cx += rnd() < 0.5 ? 1 : -1; else if (d === 1) cy += 1; else cz += rnd() < 0.5 ? 1 : -1; }
    const S = 44, ox = 256, oy = 230;
    const iso = (x, y, z) => [ox + (x - z) * S * 0.87, oy + (x + z) * S * 0.5 - y * S];
    const cube = (x, y, z) => {
      const P = (a, b, c) => iso(x + a, y + b, z + c);
      const faces = [[P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)]];
      faces.forEach((f) => { g.beginPath(); f.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); g.stroke(); });
    };
    [["rgba(255,60,120,0.55)", -4], ["rgba(60,220,255,0.75)", 4], ["rgba(235,245,255,0.9)", 0]].forEach(([c, dx]) => {
      g.save(); g.translate(dx, 0);
      g.strokeStyle = c; g.lineWidth = dx ? 3 : 2; g.fillStyle = "rgba(90,200,255,0.06)";
      cells.slice().sort((a, b) => a[0] + a[2] - (b[0] + b[2]) || a[1] - b[1]).forEach(([x, y, z]) => cube(x, y, z));
      g.restore();
    });
  }, { scale: false });
  const ghostTexs = [ghostTex(1975), ghostTex(4411), ghostTex(9001)];
  ghostTexs.forEach((t) => disposables.push(t));
  // The pieces of light that come out of the screen.
  const phantomMat = (color) => { const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }); disposables.push(m); return m; };
  const PHANTOM_SHAPES = [[[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], [[0, 0, 0], [0, 1, 0], [1, 0, 0]], [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 2, 0]], [[0, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0]]];
  function makePhantom(shape, color) {
    const geos = shape.map(([x, y, z]) => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 1.3, 1.3).translate(x * 1.3, y * 1.3, z * 1.3)));
    const merged = BufferGeometryUtils.mergeBufferGeometries(geos, false);
    geos.forEach((gg) => gg.dispose());
    merged.center();
    disposables.push(merged);
    const lines = new THREE.LineSegments(merged, phantomMat(color));
    lines.visible = false;
    lines.renderOrder = 4;
    group.add(lines);
    return { lines, born: 0, life: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), spin: new THREE.Vector3(), peak: 0 };
  }
  const phantoms = PHANTOM_SHAPES.map((sh, i) => makePhantom(sh, [0x5ad8ff, 0xff5aa8, 0x9dffcf, 0xb89bff, 0x5ad8ff][i]));
  let haunt = null; // the event on the tube now: { kind, at, dur, strength, tex }
  // The Singularity for an instant (the commercial's subliminal frame,
  // den-commercial.js), shown for at least one rendered frame.
  let flashTex = null, flashUntil = 0, flashShown = true;
  let nextHaunt = 0, pilotStutter = 0, knobWiggle = 0, surgeLight = 0;
  let blastAt = 0, blastPin = null; // (the blast's start, once; a test can hold it at a moment)
  const BLAST_MS = 5600;
  // The blast's shape at time now: the cone (0..1), its reach (0..1), and
  // the white (0..1) that den-fx.js lays over everything.
  function blastState(now) {
    if (!blastAt) return { on: false, cone: 0, reach: 0, white: 0 };
    const b = (now - blastAt) / BLAST_MS;
    if (b >= 1 || b < 0) return { on: false, cone: 0, reach: 0, white: 0 };
    const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
    const cone = b < 0.62 ? Math.pow(sm(b / 0.5), 1.6) : 1 - sm((b - 0.62) / 0.3);
    const reach = sm(b / 0.48);
    // White: in from 0.36, full by 0.5, held about a second, gone by 1.
    const white = b < 0.5 ? Math.pow(sm((b - 0.36) / 0.14), 1.5) : b < 0.68 ? 1 : 1 - sm((b - 0.68) / 0.32);
    return { on: true, b, cone, reach, white };
  }
  function spawnPhantom(now, strength) {
    const p = phantoms.find((x) => !x.lines.visible);
    if (!p) return;
    p.born = now; p.life = 1800 + Math.random() * 1400; p.peak = 0.3 + 0.55 * strength;
    p.from.set(SX + (Math.random() - 0.5) * 9, SY + (Math.random() - 0.5) * 6, FRONT - 0.8);
    p.to.set(p.from.x + (Math.random() - 0.5) * 10, p.from.y + (Math.random() - 0.3) * 6, FRONT - 7 - Math.random() * 9);
    p.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    p.lines.position.copy(p.from);
    p.lines.visible = true;
  }
  function stepPhantoms(now) {
    for (const p of phantoms) {
      if (!p.lines.visible) continue;
      const k = (now - p.born) / p.life;
      if (k >= 1) { p.lines.visible = false; p.lines.material.opacity = 0; continue; }
      const e = 1 - (1 - k) * (1 - k);
      p.lines.position.lerpVectors(p.from, p.to, e);
      p.lines.rotation.set(p.spin.x * k * 2, p.spin.y * k * 2, p.spin.z * k * 2);
      p.lines.scale.setScalar(0.5 + 1.1 * e);
      // In fast, out slowly, with a flicker.
      const env = Math.min(1, k / 0.12) * (1 - Math.max(0, (k - 0.35) / 0.65));
      p.lines.material.opacity = p.peak * env * (0.75 + 0.25 * Math.random());
    }
  }
  // Pick the next event, weighted by how far the lure has come (and never
  // the same one twice running: it keeps changing, user).
  let lastKind = "";
  function nextEvent(now, level, onEvent) {
    /* (Weirder and stronger than it was, user: the ghosts and the pieces
       of light come sooner and more often, and two more: the knob
       turning by itself, and a surge that floods the room with the
       tube's light.) */
    const strength = 0.6 + 0.4 * level;
    const kinds = [["flicker", 0.6], ["pilot", 0.4], ["thump", 1], ["static", 1], ["roll", 0.7], ["knob", 0.5 + 0.5 * level]];
    if (level > 0.05) kinds.push(["tune", 1], ["ghost", 0.7 + 0.8 * level]);
    if (level > 0.12) kinds.push(["voice", 0.6 + 0.8 * level], ["surge", 0.4 + 0.8 * level]);
    if (level > 0.2) kinds.push(["phantom", 0.6 + 1.4 * level]);
    const pool = kinds.filter(([k]) => k !== lastKind);
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total, kind = pool[0][0];
    for (const [k, w] of pool) { if ((r -= w) <= 0) { kind = k; break; } }
    lastKind = kind;
    const dur = { flicker: 160, pilot: 900, thump: 380, static: 320 + 500 * level, roll: 1400, tune: 1300, ghost: 700 + 900 * level, voice: 1500, phantom: 900, knob: 900, surge: 1650 }[kind];
    if (kind === "pilot") pilotStutter = now + dur;
    else haunt = { kind, at: now, dur, strength, tex: ghostTexs[Math.floor(Math.random() * ghostTexs.length)] };
    if (kind === "phantom") { spawnPhantom(now, strength); if (level > 0.35 && Math.random() < 0.7) spawnPhantom(now + 120, strength); if (level > 0.7 && Math.random() < 0.6) spawnPhantom(now + 260, strength); }
    if (onEvent) onEvent(kind, strength);
  }

  return {
    group,
    pickables,
    // The glass itself (a tap on the picture, after the story: den-fx.js).
    screen: glass,
    // Where the camera goes to look (den-local): the screen's middle, and
    // how much of the set must be in view (half its width and height).
    focus: { target: new THREE.Vector3(SX - 3, SY + 0.5, FRONT), halfW: 22, halfH: 15, front: FRONT },
    // The dive's end: right up to the glass.
    dive: { target: new THREE.Vector3(SX, SY, FRONT - 1), eyeZ: FRONT - 7.5, x: SX, y: SY },
    phase: () => phase,
    isOn: () => phase !== "off" && phase !== "closing",
    /* Turned on: `withPortal` (Nova) dives into the picture once the
       pattern is up and calls enter() partway into the dive. */
    powerOn(now, withPortal = false, enter = null) {
      if (phase !== "off" && phase !== "closing") return false;
      haunt = null;
      u.uTex.value = pattern;
      portal = !!withPortal; onEnter = enter; entered = false;
      knobGoal = -0.9 + 0.75;
      set("warming", now);
      return true;
    },
    // (Not once the dive has begun, unless `force`: Nova couldn't go.)
    powerOff(now, force = false) {
      if (phase === "off" || phase === "closing" || (phase === "dive" && !force)) return false;
      knobGoal = -0.9;
      set("closing", now);
      return true;
    },
    /* Already on, showing the pattern (back out of Singularity), about to
       be switched off by powerOff. */
    showPattern(now) {
      knobA = knobGoal = -0.9 + 0.75;
      portal = false;
      u.uTex.value = pattern;
      set("pattern", now - TV_TIMES.resolve);
    },
    /* Already on (back out of Singularity the first time, in Nova), and
       the commercial is on (held on its first frame for `delay`): then
       snow ("aired"), for den-fx.js to switch it off. */
    showCommercial(now, delay = 0) {
      knobA = knobGoal = -0.9 + 0.75;
      portal = false;
      if (!commercial) { commercial = createCommercial(); disposables.push(commercial); }
      commercial.reset();
      commercial.draw(0);
      u.uTex.value = commercial.texture;
      set("commercial", now + delay);
    },
    /* The lure (den-fx.js): called each frame while the set's off and
       waiting to be noticed, with how far along it is (0 to 1), and
       whether the camera's come over to look (`watched`). Something every
       9 s or so at first, then more often and more strongly (every few
       seconds, in flurries). */
    haunt(now, level, onEvent, watched = false) {
      if (phase !== "off") return;
      if (!nextHaunt) { nextHaunt = now + 400; return; }
      if (now < nextHaunt || haunt) return;
      nextEvent(now, level, onEvent);
      // Every 9 s or so at first, every 2.5 s at the end; now and then (more
      // as it goes on) another straight after, a flurry. Watched close up,
      // twice as often.
      let gap = (6500 - 4700 * level) * (0.7 + Math.random() * 0.6);
      if (Math.random() < 0.25 + 0.5 * level) gap = 300 + Math.random() * 450;
      nextHaunt = now + gap * (watched ? 0.5 : 1);
    },
    // The Singularity on the dead tube for an instant (den-fx.js: three
    // times in all while it lures).
    flash(now, ms = 45) {
      if (phase !== "off") return false;
      if (!flashTex) { flashTex = createSingularityFrame(); disposables.push(flashTex); }
      flashUntil = now + ms; flashShown = false;
      return true;
    },
    // The blast (once): the cone of light out of the dead set, building to
    // white (den-fx.js lays the white over everything, from blastState).
    blast(now) {
      if (phase !== "off" || blastAt) return false;
      blastAt = now; haunt = null;
      return true;
    },
    blastState,
    // Test-only: hold the blast at b (0..1), or null to let it go.
    blastPinAt(b) { blastPin = b; if (b == null) blastAt = blastAt || 1; },
    // After the story: the knob glowing, and the set on a channel (a
    // picture: `tex`), its dial turned to channel n; off from a channel
    // with powerOff as ever.
    glowKnob(on) { knobGlowOn = !!on; },
    showChannel(now, tex, n = 0) {
      if (phase === "warming" || phase === "dive") return false;
      haunt = null; portal = false;
      knobA = knobGoal = -0.9 + 0.75;
      u.uTex.value = tex;
      vhf.rotation.z = ((3 + n) / 12) * Math.PI * 2;
      set("channel", now);
      return true;
    },
    // Something soon (the camera's just come over to look).
    hauntSoon(now, ms = 600) { if (!nextHaunt || nextHaunt > now + ms) nextHaunt = now + ms; },
    // How far into the commercial (ms), or null if it isn't on.
    commercialAt: (now) => (phase === "commercial" ? Math.max(0, since(now)) : null),
    // Each frame: the knob, the pilot light and the picture. Returns the
    // dive's progress (0 to 1), for the camera.
    animate(now, dt) {
      knobA += (knobGoal - knobA) * (1 - Math.exp(-dt * 18));
      power.rotation.z = knobA + knobWiggle;
      knobWiggle = 0;
      u.uTime.value = now / 1000;
      const s = since(now);
      let raster = 0, snow = 0, pat = 0, dive = 0, glow = 0, dot = 0;
      if (phase === "warming") {
        raster = ease(clamp01(s / TV_TIMES.raster)); snow = 1; glow = 0.55 + 0.45 * raster;
        if (s >= TV_TIMES.raster) set("snow", now);
      } else if (phase === "snow") {
        raster = 1; snow = 1; glow = 1;
        if (s >= TV_TIMES.snow) set("resolving", now);
      } else if (phase === "resolving") {
        raster = 1; glow = 1; pat = ease(clamp01(s / TV_TIMES.resolve)); snow = 1 - 0.85 * pat;
        if (s >= TV_TIMES.resolve) set("pattern", now);
      } else if (phase === "pattern") {
        raster = 1; glow = 1; pat = 1; snow = 0.15;
        if (portal && s >= TV_TIMES.diveAfter) set("dive", now);
      } else if (phase === "dive") {
        raster = 1; glow = 1; pat = 1; snow = 0.1;
        dive = ease(clamp01(s / TV_TIMES.dive));
        if (!entered && s >= TV_TIMES.enterAt) { entered = true; if (onEnter) onEnter(); }
      } else if (phase === "commercial") {
        // A clean picture (user); snow until the spot has one (still
        // loading, or from disk).
        commercial.draw(Math.max(0, s) / 1000);
        const on = commercial.ready();
        raster = 1; glow = 1; pat = on ? 1 : 0; snow = on ? 0 : 1;
        if (s >= COMMERCIAL_MS) set("aired", now);
      } else if (phase === "channel") {
        // Another reality on the set (after the story): a clean picture,
        // a burst of snow as it clicks over.
        raster = 1; glow = 1; pat = 1;
        chanBlip = s < 320 ? 1 - s / 320 : 0;
        snow = 0.04 + 0.95 * chanBlip;
      } else if (phase === "aired") {
        raster = 1; glow = 1; snow = 1;
      } else if (phase === "closing") {
        const c = clamp01(s / TV_TIMES.collapse);
        raster = 1 - ease(c); pat = 1; snow = 0.3; glow = 1;
        dot = c >= 1 ? Math.max(0, 1 - (s - TV_TIMES.collapse) / TV_TIMES.afterglow) : 0;
        if (c >= 1) glow = 0;
        if (s >= TV_TIMES.collapse + TV_TIMES.afterglow) set("off", now);
      }
      // Off, and haunted: the event on the tube now.
      let line = -1, lineAmt = 0, tear = 0;
      if (phase === "off" && haunt) {
        const k = (now - haunt.at) / haunt.dur;
        if (k >= 1) {
          haunt = null;
          u.uTex.value = pattern;
        } else {
          const h = haunt, env = Math.sin(Math.PI * Math.min(1, k)) * h.strength;
          raster = 1;
          if (h.kind === "flicker") { snow = 1; glow = 0.4 * env * (Math.random() < 0.5 ? 1 : 0.3); }
          else if (h.kind === "thump") { snow = 1; glow = 0.85 * Math.pow(1 - k, 2) * h.strength; tear = 0.6 * (1 - k); }
          else if (h.kind === "static" || h.kind === "phantom") { snow = 1; glow = 0.62 * env; tear = 0.45 * env; }
          else if (h.kind === "roll") { snow = 1; glow = 0.24 * env; line = 1 - k; lineAmt = 0.8 * env; }
          else if (h.kind === "tune") { snow = 1; glow = 0.5 * env; tear = 0.5 * env * (Math.random() < 0.4 ? 1 : 0.3); line = (k * 2.3) % 1; lineAmt = 0.6 * env; }
          else if (h.kind === "ghost" || h.kind === "voice") {
            // The ghost of a piece, and now and then it jumps, rolls and
            // doubles: the set half catching something.
            u.uTex.value = h.tex; pat = 0.95; snow = 0.5; glow = 0.6 * env;
            tear = 0.7 * env * (Math.random() < 0.35 ? 1 : 0.2);
            if (Math.random() < 0.25) { line = Math.random(); lineAmt = 0.7 * env; }
          } else if (h.kind === "knob") {
            // The knob turns a little way by itself, clicking, and back;
            // the tube nearly lights.
            snow = 0.8; glow = 0.3 * env; tear = 0.25 * env;
            knobWiggle = 0.32 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (k < 0.62 ? 1 : 0) + 0.06 * Math.sin(k * 40) * env;
          } else if (h.kind === "surge") {
            // Building to a glare that floods the room, then gone.
            const up = Math.min(1, k / 0.85);
            snow = 1; glow = (0.3 + 1.1 * up * up) * h.strength * (k < 0.9 ? 1 : (1 - k) * 10); tear = 0.8 * up; line = (k * 5.3) % 1; lineAmt = 0.5 * up;
            surgeLight = 1.8 * up * up * h.strength * (k < 0.9 ? 1 : (1 - k) * 10);
          }
        }
      }
      // The blast: the tube flaring to a glare, the cone of light pouring
      // out of it, the room flooded; then fading back.
      if (blastPin != null) blastAt = now - blastPin * BLAST_MS;
      const B = blastState(now);
      cone.visible = B.on && B.cone > 0.002;
      if (B.on) {
        const jit = 0.85 + 0.15 * Math.random();
        coneMat.uniforms.uAmt.value = 1.6 * B.cone * jit;
        coneMat.uniforms.uLen.value = 12 + 150 * B.reach;
        coneMat.uniforms.uTime.value = now / 1000;
        raster = 1; snow = 1 - 0.7 * B.cone; glow = Math.max(glow, 0.6 + 2.6 * B.cone * jit);
        tear = Math.max(tear, 0.7 * (1 - B.cone) * (B.b < 0.5 ? 1 : 0.4));
        line = (now * 0.0021) % 1; lineAmt = 0.4 * (1 - B.cone);
        surgeLight = Math.max(surgeLight, 9 * B.cone * jit);
      }
      if (phase === "off" && flashTex && (now < flashUntil || !flashShown)) {
        flashShown = true;
        u.uTex.value = flashTex.texture;
        raster = 1; pat = 1; snow = 0.12; glow = 0.85; line = -1; tear = 0;
      } else if (flashTex && u.uTex.value === flashTex.texture && !(haunt && (haunt.kind === "ghost" || haunt.kind === "voice"))) u.uTex.value = pattern;
      if (phase === "channel" && chanBlip > 0) { tear = Math.max(tear, 0.7 * chanBlip); line = (now * 0.003) % 1; lineAmt = 0.5 * chanBlip; }
      // The knob's glow, breathing.
      knobGlow.visible = knobGlowOn;
      if (knobGlowOn) knobGlowMat.opacity = 0.55 + 0.35 * Math.sin(now * 0.004);
      u.uLine.value = line; u.uLineAmt.value = lineAmt; u.uTear.value = tear;
      stepPhantoms(now);
      // The picture flickers a little, the snow more.
      const flick = glow * (0.94 + 0.06 * Math.sin(now * 0.05) * Math.sin(now * 0.013)) * (1 + snow * 0.08 * (Math.random() - 0.5));
      u.uRaster.value = raster; u.uSnow.value = snow; u.uPattern.value = pat; u.uDive.value = dive; u.uGlow.value = flick; u.uDot.value = dot;
      const light = Math.max(dot * 0.5, flick * (0.55 + 0.45 * raster));
      if (screenLight) screenLight.intensity = light * 0.9 + surgeLight;
      surgeLight = 0;
      halo.material.opacity = Math.min(1, light * 0.16 + (B.on ? 0.8 * B.cone : 0));
      const stutter = phase === "off" && now < pilotStutter && Math.sin(now * 0.09) * Math.sin(now * 0.023) > 0.2;
      pilotMat.color.setHex(stutter || !(phase === "off" || (phase === "closing" && s > TV_TIMES.collapse)) ? 0xff3a1c : 0x3a0d08);
      return dive;
    },
    // The panel's printing and the pattern's caption, again once their
    // fonts have loaded (den-fx.js, via den-room's repaint).
    repaint() { repaint(panelTex); repaint(pattern); },
    dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); },
  };
}
