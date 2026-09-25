/* El Cabeza · Lluvia — the city.
   A procedural tech-noir city in Three.js r128, for the Lluvia design
   boards: shader-lit towers whose windows come from world position (so
   hundreds of instanced boxes cost a handful of draw calls), the
   Kurogane-Valdez ziggurat, flare stacks, holographic advertising,
   blade signs in kanji, katakana, Latin and a few Vietnamese ones in
   chữ tròn (each syllable bowed into a lit disc), spinners,
   searchlights, smog, clouds above and a wet street below that mirrors
   it all. Everything glows on its own: no lights, no shadows. The score
   is synth pads and brass; now and then a đàn bầu, a zither or a ghostly
   cải lương voice drifts in from a street speaker.

   LLUVIA.mount(canvas, opts) → controller
     opts.mode    "descent"  the flythrough from above the clouds down to
                             the plaza, then the city menu
                  "city"     the city menu straight away
                  "backdrop" a slow street-level view behind a board
     opts.onCue(name)   "clouds" | "below" | "street" | "city"
     opts.onPick(key)   a menu billboard was tapped: "matter" | "laws" | "topologies"
   controller: start() (call from a tap: it starts the sound too),
     skip(), setMuted(bool), select(key|null), cue(name), destroy(). */
import * as THREE from "three";

  var TAU = Math.PI * 2;
  var DESCENT_S = 24;

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var JP = "'Dela Gothic One', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'IPAGothic', 'Yu Gothic', sans-serif";
  // Vietnamese signs: chữ tròn, each syllable bowed into a lit disc (tronDisc).
  var TRON = "'Saira Extra Condensed', 'Arial Narrow', sans-serif";
  var LAT = "'Saira Extra Condensed', 'Saira Condensed', 'Arial Narrow', sans-serif";

  /* ---------------- materials ---------------- */
  var SHARED = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFog: { value: new THREE.Color("#1d1720") }, uFogD: { value: 0.0045 }, uHaze: { value: new THREE.Color("#3a2218") } };
  var FOG_GLSL = [
    "vec3 applyFog(vec3 col, vec3 w){",
    "  float d = length(w - uCam);",
    "  float f = 1.0 - exp(-pow(uFogD * d, 2.0));",
    "  float low = exp(-max(w.y, 0.0) / 40.0);",
    "  vec3 fc = mix(uFog, uHaze, low * 0.6);",
    "  return mix(col, fc, clamp(f, 0.0, 1.0));",
    "}"].join("\n");

  function towerMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: SHARED,
      side: THREE.DoubleSide,
      vertexShader: [
        "attribute float aSeed; attribute float aLit;",
        "varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vLit;",
        "void main(){",
        "  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);",
        "  vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vSeed = aSeed; vLit = aLit;",
        "  gl_Position = projectionMatrix * viewMatrix * w;",
        "}"].join("\n"),
      fragmentShader: [
        "uniform float uTime; uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD; uniform vec3 uHaze;",
        "varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vLit;",
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
        FOG_GLSL,
        "void main(){",
        "  vec3 n = normalize(vN);",
        "  vec3 col = vec3(0.028, 0.03, 0.038);",
        "  col += vec3(0.16, 0.07, 0.035) * exp(-max(vW.y, 0.0) / 14.0);",
        "  col += vec3(0.015, 0.02, 0.035) * max(n.y, 0.0);",
        "  if (abs(n.y) < 0.5) {",
        "    float u = abs(n.x) > 0.5 ? vW.z : vW.x;",
        "    vec2 g = vec2(u / 1.1, vW.y / 1.6);",
        "    vec2 cell = floor(g); vec2 f = fract(g);",
        "    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.72);",
        "    float h = hash(cell + vSeed * 91.7 + sign(n.x + n.z * 2.0) * 13.0);",
        "    float band = step(0.8, fract(vSeed * 7.1)) * step(0.55, fract(cell.y * 0.25 + vSeed));",
        "    float lit = max(step(1.0 - vLit, h), band * step(0.3, h));",
        "    vec3 wc = mix(vec3(1.0, 0.66, 0.32), vec3(0.72, 0.84, 1.0), step(0.72, fract(h * 7.3)));",
        "    wc = mix(wc, vec3(1.0, 0.28, 0.66), step(0.975, fract(h * 13.1)));",
        "    wc = mix(wc, vec3(0.3, 0.92, 1.0), step(0.972, fract(h * 17.7)));",
        "    float flick = 1.0 - 0.6 * step(0.985, fract(h * 5.1)) * step(0.5, fract(uTime * (1.3 + h * 4.0) + h * 9.0));",
        "    col += wc * win * lit * 0.62 * flick;",
        "    col += vec3(0.018, 0.022, 0.03) * win * (1.0 - lit);",
        "    col *= 0.85 + 0.15 * step(0.5, fract(vW.y / 7.6));",
        "  }",
        "  gl_FragColor = vec4(applyFog(col, vW), 1.0);",
        "}"].join("\n"),
    });
  }

  function glowMaterial(tex, color, opacity) {
    return new THREE.MeshBasicMaterial({ map: tex, color: color || 0xffffff, transparent: true, opacity: opacity == null ? 1 : opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  }

  var texCache = {};
  function radialTex(key, stops) {
    if (texCache[key]) return texCache[key];
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (s) { r.addColorStop(s[0], s[1]); });
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return (texCache[key] = new THREE.CanvasTexture(c));
  }
  function glowTex() { return radialTex("glow", [[0, "rgba(255,255,255,1)"], [0.2, "rgba(255,255,255,0.45)"], [0.55, "rgba(255,255,255,0.08)"], [1, "rgba(255,255,255,0)"]]); }
  function fireTex() { return radialTex("fire", [[0, "rgba(255,250,220,1)"], [0.18, "rgba(255,200,90,0.95)"], [0.45, "rgba(255,110,20,0.45)"], [1, "rgba(120,20,0,0)"]]); }
  function smokeTex() {
    if (texCache.smoke) return texCache.smoke;
    var S = 256, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d"), img = g.createImageData(S, S), r = rng(8), P = [], i;
    for (i = 0; i < 512; i++) P[i] = r();
    function n(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; function hh(a, b) { return P[((a * 73 + b * 151) & 511)]; } var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hh(xi, yi), hh(xi + 1, yi), u), lerp(hh(xi, yi + 1), hh(xi + 1, yi + 1), u), v); }
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var f = 0, a = 0.5, fr = 1 / 32, k;
      for (k = 0; k < 5; k++) { f += a * n(x * fr, y * fr); fr *= 2; a *= 0.5; }
      var d = Math.hypot(x / S - 0.5, y / S - 0.5) * 2;
      var al = Math.max(0, Math.min(1, (f - 0.35) * 2.2)) * Math.max(0, 1 - d);
      var o = (y * S + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = al * 255;
    }
    g.putImageData(img, 0, 0);
    return (texCache.smoke = new THREE.CanvasTexture(c));
  }
  function cloudTex() {
    if (texCache.cloud) return texCache.cloud;
    var S = 512, c = document.createElement("canvas"); c.width = c.height = S;
    var g = c.getContext("2d"), img = g.createImageData(S, S), r = rng(21), P = [], i;
    for (i = 0; i < 1024; i++) P[i] = r();
    function n(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; function hh(a, b) { return P[(((a % 64) + 64) % 64 * 17 + ((b % 64) + 64) % 64 * 97) & 1023]; } var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hh(xi, yi), hh(xi + 1, yi), u), lerp(hh(xi, yi + 1), hh(xi + 1, yi + 1), u), v); }
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var f = 0, a = 0.5, fr = 8 / S, k;
      for (k = 0; k < 6; k++) { f += a * n(x * fr, y * fr); fr *= 2; a *= 0.5; }
      var al = Math.max(0, Math.min(1, (f - 0.4) * 3.6));
      var o = (y * S + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = al * 255;
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
    return (texCache.cloud = t);
  }

  /* A neon sign: glowing tube text on a dark backing, vertical or horizontal. */
  function signTexture(text, color, vertical, backing, res) {
    var W = (vertical ? 128 : 512) * (res || 1), H = (vertical ? 512 : 128) * (res || 1);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    if (backing) { g.fillStyle = backing; g.fillRect(0, 0, W, H); }
    g.strokeStyle = color; g.globalAlpha = 0.5; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12); g.globalAlpha = 1;
    g.fillStyle = "#ffffff"; g.shadowColor = color; g.shadowBlur = 18; g.textAlign = "center"; g.textBaseline = "middle";
    // Vietnamese (its diacritics) is chữ tròn: each syllable a lit disc,
    // stacked down a vertical sign the way the kanji are.
    if (/[\u0100-\u024F\u1E00-\u1EFF]/.test(text) && !/[\u3000-\u9FFF]/.test(text)) {
      var col = tube(color);
      if (vertical) tronColumn(g, text, 14, 12, W - 28, H - 24, col, col, paler(col));
      else tronRow(g, text, 12, 10, W - 24, H - 20, col, col, paler(col));
      return new THREE.CanvasTexture(c);
    }
    var latin = /^[\x00-\x7FÀ-ſ·]+$/.test(text);
    if (vertical) {
      var chars = Array.from(text), step = (H - 40) / chars.length, fs = Math.min(W * 0.72, step * 0.86);
      g.font = "400 " + Math.round(fs) + "px " + (latin ? LAT : JP);
      chars.forEach(function (ch, i) { var y = 20 + step * (i + 0.5); g.fillStyle = color; g.fillText(ch, W / 2, y); g.shadowBlur = 4; g.fillStyle = "rgba(255,255,255,0.85)"; g.fillText(ch, W / 2, y); g.shadowBlur = 18; });
    } else {
      var fs2 = H * 0.62;
      g.font = (latin ? "700 " : "400 ") + Math.round(fs2) + "px " + (latin ? LAT : JP);
      var w = g.measureText(text).width; if (w > W - 40) { g.font = (latin ? "700 " : "400 ") + Math.round(fs2 * (W - 40) / w) + "px " + (latin ? LAT : JP); }
      g.fillStyle = color; g.fillText(text, W / 2, H / 2 + 4); g.shadowBlur = 4; g.fillStyle = "rgba(255,255,255,0.85)"; g.fillText(text, W / 2, H / 2 + 4);
    }
    return new THREE.CanvasTexture(c);
  }

  // Chữ Tròn: lay the letters out in a square, one tall row (two rows for
  // five letters or more), then map the square onto a disc so the outer
  // strokes bow along the rim. The disc is cached per word, as an alpha mask.
  var TRON_CACHE = {};
  function tronMask(word) {
    var S = 192, key = word;
    if (TRON_CACHE[key]) return TRON_CACHE[key];
    var src = document.createElement("canvas"); src.width = src.height = S;
    var g = src.getContext("2d"), letters = Array.from(word.normalize ? word.normalize("NFC") : word);
    var n = letters.length, rows = n >= 5 ? [letters.slice(0, Math.ceil(n / 2)), letters.slice(Math.ceil(n / 2))] : [letters];
    var pad = S * 0.06, rh = (S - pad * 2) / rows.length;
    g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
    rows.forEach(function (row, ri) {
      // Each letter's cell is as wide as its glyph wants (an i stays thin),
      // and the row is then stretched to the square's full width.
      g.font = "600 100px " + TRON;
      var ms = row.map(function (ch) {
        var m = g.measureText(ch), l = m.actualBoundingBoxLeft || 0, r = m.actualBoundingBoxRight || m.width;
        return { ch: ch, l: l, gw: Math.max(1, l + r), asc: m.actualBoundingBoxAscent || 70, gh: Math.max(1, (m.actualBoundingBoxAscent || 70) + (m.actualBoundingBoxDescent || 0)) };
      });
      var want = ms.map(function (q) { return Math.max(q.gw, 22) * (100 / q.gh); }), tot = want.reduce(function (a2, b2) { return a2 + b2; }, 0);
      var gapw = (S - pad * 2) * 0.03, avail = S - pad * 2 - gapw * (ms.length - 1), cx0 = pad;
      ms.forEach(function (q, ci) {
        var cw = avail * want[ci] / tot, bh = rh * 0.94, sy = bh / q.gh, sx = Math.min(cw / q.gw, sy * 1.7), bw = q.gw * sx;
        g.save(); g.translate(cx0 + (cw - bw) / 2 + q.l * sx, pad + ri * rh + (rh - bh) / 2 + q.asc * sy); g.scale(sx, sy); g.fillText(q.ch, 0, 0); g.restore();
        cx0 += cw + gapw;
      });
    });
    // Square -> disc (the inverse elliptical grid mapping), sampled per pixel.
    var sd = g.getImageData(0, 0, S, S).data, out = document.createElement("canvas"); out.width = out.height = S;
    var og = out.getContext("2d"), od = og.createImageData(S, S), R2 = 2 * Math.SQRT2, x, y;
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1;
      if (u * u + v * v > 1) continue;
      var t1 = 2 + u * u - v * v, t2 = 2 - u * u + v * v;
      var qx = 0.5 * Math.sqrt(Math.max(0, t1 + R2 * u)) - 0.5 * Math.sqrt(Math.max(0, t1 - R2 * u));
      var qy = 0.5 * Math.sqrt(Math.max(0, t2 + R2 * v)) - 0.5 * Math.sqrt(Math.max(0, t2 - R2 * v));
      var sxp = Math.min(S - 1, Math.max(0, Math.round((qx + 1) / 2 * S - 0.5))), syp = Math.min(S - 1, Math.max(0, Math.round((qy + 1) / 2 * S - 0.5)));
      var a = sd[(syp * S + sxp) * 4 + 3], o = (y * S + x) * 4;
      od.data[o] = od.data[o + 1] = od.data[o + 2] = 255; od.data[o + 3] = a;
    }
    og.putImageData(od, 0, 0);
    TRON_CACHE[key] = out; return out;
  }
  var TINT = document.createElement("canvas");
  // Draw one syllable as a chữ tròn disc of diameter d at (x, y). With a
  // glow colour it is a neon tube: coloured halo, paler core.
  function tronDisc(g, word, x, y, d, color, glow, core) {
    var mask = tronMask(word), S = mask.width;
    TINT.width = TINT.height = S; var tg = TINT.getContext("2d");
    tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = color; tg.fillRect(0, 0, S, S); tg.globalCompositeOperation = "source-over";
    g.save();
    if (glow) { g.shadowColor = glow; g.shadowBlur = d * 0.18; g.drawImage(TINT, x, y, d, d); g.shadowBlur = d * 0.06; }
    g.drawImage(TINT, x, y, d, d);
    if (core) { tg.globalCompositeOperation = "source-in"; tg.fillStyle = core; tg.fillRect(0, 0, S, S); tg.globalCompositeOperation = "source-over"; g.shadowBlur = 0; g.globalAlpha = 0.7; var k = d * 0.012; g.drawImage(TINT, x + k, y + k, d - 2 * k, d - 2 * k); }
    g.restore();
  }
  function tronRow(g, text, x, y, w, h, color, glow, core) {
    var words = text.split(" ").filter(function (q) { return q && q !== "·"; }), d = Math.min(h, w / words.length / 1.08), gap = (w - d * words.length) / (words.length + 1);
    words.forEach(function (wd, i) { tronDisc(g, wd, x + gap + i * (d + gap), y + (h - d) / 2, d, color, glow, core); });
  }
  function tronColumn(g, text, x, y, w, h, color, glow, core) {
    var words = text.split(" ").filter(function (q) { return q && q !== "·"; }), d = Math.min(w, h / words.length / 1.08), gap = (h - d * words.length) / (words.length + 1);
    words.forEach(function (wd, i) { tronDisc(g, wd, x + (w - d) / 2, y + gap + i * (d + gap), d, color, glow, core); });
  }
  // A neon tube colour: the sign's hue kept, but eased off full brightness.
  function tube(hex) { var c = new THREE.Color(hex).lerp(new THREE.Color("#8c7f6e"), 0.16).multiplyScalar(0.9); return "#" + c.getHexString(); }
  function paler(hex) { var c = new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.45); return "#" + c.getHexString(); }

  /* ---------------- animated screens ---------------- */
  function screen(w, h, draw) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var tex = new THREE.CanvasTexture(c);
    return { canvas: c, g: c.getContext("2d"), tex: tex, draw: draw, last: -1 };
  }
  function scanlines(g, W, H, a) { g.fillStyle = "rgba(0,0,0," + a + ")"; for (var y = 0; y < H; y += 4) g.fillRect(0, y, W, 2); }
  function wireCube(g, cx, cy, s, t, color, w) {
    var pts = [], i, j, a = t * 0.7, b = 0.55;
    for (i = 0; i < 8; i++) {
      var x = (i & 1 ? 1 : -1) * w, y = (i & 2 ? 1 : -1), z = (i & 4 ? 1 : -1);
      var x1 = x * Math.cos(a) - z * Math.sin(a), z1 = x * Math.sin(a) + z * Math.cos(a);
      var y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
      var p = 3 / (3 + z2 * 0.35); pts.push([cx + x1 * s * p, cy + y1 * s * p]);
    }
    g.strokeStyle = color; g.lineWidth = 3; g.shadowColor = color; g.shadowBlur = 14; g.beginPath();
    for (i = 0; i < 8; i++) for (j = i + 1; j < 8; j++) { var d = i ^ j; if (d === 1 || d === 2 || d === 4) { g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); } }
    g.stroke(); g.shadowBlur = 0;
  }
  var ADS = {
    kv: function (g, W, H, t) {
      g.fillStyle = "#07040c"; g.fillRect(0, 0, W, H);
      var hue = (t * 12) % 360, gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "hsla(" + (hue + 300) + ",90%,45%,0.55)"); gr.addColorStop(1, "hsla(" + (hue + 200) + ",90%,35%,0.35)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = "#ff5ac8"; g.shadowBlur = 20;
      g.font = "400 " + Math.round(W * 0.34) + "px " + JP; g.fillText("夢を", W / 2, H * 0.3); g.fillText("売る", W / 2, H * 0.5);
      g.shadowBlur = 0; g.font = "700 " + Math.round(W * 0.12) + "px " + LAT; g.fillStyle = "#ffe9f6"; g.fillText("WE SELL DREAMS", W / 2, H * 0.68);
      g.font = "700 " + Math.round(W * 0.16) + "px " + LAT; g.fillText("KUROGANE·VALDEZ", W / 2, H * 0.86);
      scanlines(g, W, H, 0.22);
    },
    skin: function (g, W, H, t) {
      g.fillStyle = "#020a10"; g.fillRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.38, r = W * 0.3, k;
      g.strokeStyle = "rgba(60,230,255,0.9)"; g.lineWidth = 2; g.shadowColor = "#23e6ff"; g.shadowBlur = 12;
      for (k = 0; k < 9; k++) { var yy = cy - r + (k / 8) * 2 * r, ww = Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy))); g.beginPath(); g.ellipse(cx, yy, ww, ww * 0.18, 0, 0, TAU); g.stroke(); }
      for (k = 0; k < 8; k++) { var a = t * 0.6 + (k / 8) * Math.PI; g.beginPath(); g.ellipse(cx, cy, Math.abs(Math.cos(a)) * r, r, 0, 0, TAU); g.stroke(); }
      g.shadowBlur = 0; g.textAlign = "center"; g.fillStyle = "#c8f8ff";
      g.font = "400 " + Math.round(W * 0.2) + "px " + JP; g.fillText("新しい肌", cx, H * 0.74);
      g.font = "700 " + Math.round(W * 0.11) + "px " + LAT; g.fillText("NUEVA PIEL · NEW SKIN", cx, H * 0.84);
      g.fillStyle = "#23e6ff"; g.font = "700 " + Math.round(W * 0.09) + "px " + LAT; g.fillText("PATCHED WHILE YOU WAIT", cx, H * 0.92);
      scanlines(g, W, H, 0.25);
    },
    cabeza: function (g, W, H, t) {
      g.fillStyle = "#0b0206"; g.fillRect(0, 0, W, H);
      wireCube(g, W / 2, H * 0.34, W * 0.2, t, "#ff3dbb", 1);
      wireCube(g, W / 2, H * 0.34, W * 0.1, -t * 1.3, "#23e6ff", 1);
      g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = "#ff1fae"; g.shadowBlur = 16;
      g.font = "700 " + Math.round(W * 0.2) + "px " + LAT; g.fillText("EL CABEZA", W / 2, H * 0.68);
      g.shadowBlur = 0; g.font = "400 " + Math.round(W * 0.16) + "px " + JP; g.fillStyle = "#ffd0ef"; g.fillText("頭を潰せ", W / 2, H * 0.8);
      g.font = "700 " + Math.round(W * 0.09) + "px " + LAT; g.fillText("CRUSH THEIR HEAD", W / 2, H * 0.9);
      scanlines(g, W, H, 0.22);
    },
    sleep: function (g, W, H, t) {
      g.fillStyle = "#100804"; g.fillRect(0, 0, W, H);
      var p = 0.5 + 0.5 * Math.sin(t * 0.8);
      var r = g.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.5);
      r.addColorStop(0, "rgba(255,180,80," + (0.6 + p * 0.3) + ")"); r.addColorStop(1, "rgba(255,120,20,0)");
      g.fillStyle = r; g.fillRect(0, 0, W, H);
      g.textAlign = "center"; g.fillStyle = "#ffe7c2"; g.font = "400 " + Math.round(W * 0.34) + "px " + JP; g.fillText("眠り", W / 2, H * 0.44);
      g.font = "700 " + Math.round(W * 0.12) + "px " + LAT; g.fillText("SUEÑO GARANTIZADO", W / 2, H * 0.66);
      g.fillStyle = "#ffb347"; g.fillText("SLEEP, GUARANTEED", W / 2, H * 0.76);
      scanlines(g, W, H, 0.2);
    },
  };
  var MENU = {
    matter: { title: "MATTER", jp: "物質", color: "#23e6ff" },
    laws: { title: "LAWS", jp: "法則", color: "#ff3dbb" },
    topologies: { title: "TOPOLOGIES", jp: "位相", color: "#ffb347" },
  };
  function menuDraw(key) {
    var m = MENU[key];
    return function (g, W, H, t, sel) {
      g.fillStyle = "#04040a"; g.fillRect(0, 0, W, H);
      var glow = sel ? 1 : 0.7, cx = W / 2, i;
      g.fillStyle = m.color; g.globalAlpha = 0.14 * glow; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      if (key === "matter") { wireCube(g, cx, H * 0.34, W * 0.22, t, m.color, 1); wireCube(g, cx - W * 0.2, H * 0.52, W * 0.09, t * 1.4, "#ffffff", 1); wireCube(g, cx + W * 0.2, H * 0.52, W * 0.09, -t, "#ffffff", 2); }
      if (key === "laws") {
        g.font = "600 " + Math.round(W * 0.07) + "px " + LAT; g.textAlign = "left"; g.fillStyle = m.color;
        var lines = ["SLIDE", "DIAGONAL SLIDE", "BLACK HOLES", "3 ACTIONS", "SHOVING", "CANTILEVER", "SPLIT MOVES"];
        for (i = 0; i < 12; i++) { var y = ((i * 0.09 + t * 0.05) % 1.08) * H * 0.62 + H * 0.08; g.globalAlpha = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (y - H * 0.08) / (H * 0.62))); g.fillText("› " + lines[i % lines.length], W * 0.12, y); }
        g.globalAlpha = 1;
      }
      if (key === "topologies") {
        g.strokeStyle = m.color; g.lineWidth = 2; g.shadowColor = m.color; g.shadowBlur = 8;
        for (i = 0; i <= 10; i++) {
          g.beginPath(); for (var k = 0; k <= 20; k++) { var u = k / 20, v = i / 10; var x = W * (0.12 + u * 0.76), y = H * (0.1 + v * 0.55) + Math.sin(u * 6 + t * 1.5 + v * 3) * 10 * Math.sin(v * Math.PI); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
          g.beginPath(); for (k = 0; k <= 20; k++) { var v2 = k / 20, u2 = i / 10; var x2 = W * (0.12 + u2 * 0.76) + Math.sin(v2 * 6 + t * 1.2) * 8 * Math.sin(u2 * Math.PI), y2 = H * (0.1 + v2 * 0.55); if (k) g.lineTo(x2, y2); else g.moveTo(x2, y2); } g.stroke();
        }
        g.shadowBlur = 0;
      }
      g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = m.color; g.shadowBlur = 22 * glow;
      g.font = "400 " + Math.round(W * 0.3) + "px " + JP; g.fillText(m.jp, cx, H * 0.8);
      g.font = "700 " + Math.round(W * (key === "topologies" ? 0.15 : 0.2)) + "px " + LAT; g.fillText(m.title, cx, H * 0.93);
      g.shadowBlur = 0;
      if (sel) { g.strokeStyle = "#fff"; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12); }
      else { g.strokeStyle = m.color; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12); }
      g.fillStyle = "rgba(255,255,255," + (0.04 + 0.04 * Math.sin(t * 20)) + ")"; g.fillRect(0, ((t * 90) % (H + 40)) - 20, W, 14);
      scanlines(g, W, H, 0.2);
    };
  }

  /* ---------------- the city ---------------- */
  function buildCity(scene, opts) {
    var r = rng(1977);
    var world = new THREE.Group(), mirror = new THREE.Group();
    scene.add(world); mirror.scale.y = -1; scene.add(mirror);
    var anim = { screens: [], flicker: [], flares: [], spinners: [], beams: [], steam: [], beacons: [], menu: {}, traffic: null, umbrellas: null };
    function both(obj, reflect) { world.add(obj); if (reflect !== false) { var c = obj.clone(); mirror.add(c); return c; } return null; }

    // Towers: a street grid with the avenue (x≈0, z>0) and the plaza kept clear.
    var boxes = [];
    function tower(x, z, w, d, h, lit) { boxes.push({ x: x, z: z, w: w, d: d, h: h, lit: lit != null ? lit : 0.06 + r() * 0.16, seed: r() }); }
    var cell = 30, gx, gz;
    for (gx = -16; gx <= 16; gx++) for (gz = -24; gz <= 14; gz++) {
      var bx = gx * cell, bz = gz * cell;
      if (Math.abs(bx) < 20 && bz > -40) continue;          // the avenue
      if (Math.hypot(bx, bz + 20) < 44) continue;            // the plaza
      if (Math.hypot(bx + 60, bz + 620) < 170) continue;     // the ziggurat's ground
      var dist = Math.hypot(bx, bz + 150);
      var n = 1 + Math.floor(r() * 3), k;
      for (k = 0; k < n; k++) {
        var w = 7 + r() * 11, d = 7 + r() * 11;
        var hmax = 30 + 170 * Math.exp(-dist / 380) + (r() < 0.05 ? 160 : 0);
        var h = 12 + Math.pow(r(), 1.6) * hmax;
        tower(bx + (r() - 0.5) * (cell - w - 6), bz + (r() - 0.5) * (cell - d - 6), w, d, h);
      }
    }
    // Megatowers that pierce the clouds.
    [[-120, -260], [90, -330], [-40, -420], [160, -150], [-210, -120], [230, -420], [20, -240]].forEach(function (p, i) { tower(p[0], p[1], 22 + (i % 3) * 6, 22 + (i % 2) * 8, 180 + i * 18, 0.2); });
    // The avenue's walls: lower, busier, older.
    for (gz = 0; gz < 16; gz++) {
      [-1, 1].forEach(function (s) { var z = 16 + gz * 20 + r() * 6; tower(s * (26 + r() * 4), z, 12 + r() * 4, 14 + r() * 4, 14 + r() * 60, 0.16); });
    }
    // The plaza's three menu towers and their neighbours.
    var MT = { matter: [-10.8, 5, 10, 10, 56], topologies: [13, -9, 11, 10, 82], laws: [-1, -46, 18, 15, 120] };
    Object.keys(MT).forEach(function (k) { var m = MT[k]; tower(m[0], m[1], m[2], m[3], m[4], 0.1); });
    [[-34, -34, 70], [34, -44, 100], [-30, 10, 40], [32, 4, 46]].forEach(function (p) { tower(p[0], p[1], 14, 14, p[2], 0.12); });

    // The ziggurat: Kurogane-Valdez headquarters.
    var ZX = -60, ZZ = -620, tier;
    for (tier = 0; tier < 7; tier++) { var s = 260 - tier * 34; boxes.push({ x: ZX, z: ZZ, w: s, d: s, h: 26 + tier * 30, y0: 0, lit: 0.4, seed: 0.91 + tier * 0.01 }); }

    var geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    var mat = towerMaterial();
    function instanced() {
      var im = new THREE.InstancedMesh(geo, mat, boxes.length), m4 = new THREE.Matrix4(), seeds = new Float32Array(boxes.length), lits = new Float32Array(boxes.length);
      boxes.forEach(function (b, i) { m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, 0, b.z); im.setMatrixAt(i, m4); seeds[i] = b.seed; lits[i] = b.lit; });
      geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
      geo.setAttribute("aLit", new THREE.InstancedBufferAttribute(lits, 1));
      im.frustumCulled = false;
      return im;
    }
    world.add(instanced()); mirror.add(instanced());

    // Rooftop beacons (red, blinking) on the tall ones.
    var beaconMat = glowMaterial(glowTex(), 0xff2a2a, 1);
    boxes.forEach(function (b) { if (b.h > 110 && r() < 0.7) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff3030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.position.set(b.x, b.h + 2, b.z); sp.scale.set(6, 6, 1); world.add(sp); anim.beacons.push({ s: sp, ph: r() * TAU }); } });

    // Ziggurat searchlights.
    var beamTex = (function () { var c = document.createElement("canvas"); c.width = 4; c.height = 256; var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.6, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0.6)"); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); })();
    var zTop = 26 + 6 * 30;
    for (var bi = 0; bi < 4; bi++) {
      var cone = new THREE.Mesh(new THREE.CylinderGeometry(22, 0.6, 320, 24, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xcfe0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      cone.geometry.translate(0, 160, 0);
      var pivot = new THREE.Group(); pivot.position.set(ZX + (bi - 1.5) * 20, zTop, ZZ); pivot.add(cone); world.add(pivot);
      anim.beams.push({ p: pivot, ph: bi * 1.7 });
    }
    // The ziggurat's crown.
    var crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc68a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    crown.position.set(ZX, zTop + 6, ZZ); crown.scale.set(90, 40, 1); world.add(crown);

    // Flare stacks in the industrial east.
    var fireM = function () { return new THREE.SpriteMaterial({ map: fireTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }); };
    for (var fi = 0; fi < 11; fi++) {
      var fx = 120 + r() * 260, fz = -40 + r() * 300, fh = 40 + r() * 50;
      var stack = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, fh, 8), new THREE.MeshBasicMaterial({ color: 0x0c0a0a }));
      stack.position.set(fx, fh / 2, fz); world.add(stack);
      var fl = new THREE.Sprite(fireM()); fl.position.set(fx, fh + 4, fz); world.add(fl);
      var fl2 = new THREE.Sprite(fireM()); fl2.material.color.set(0xff7a2a); fl2.position.set(fx, fh + 10, fz); world.add(fl2);
      anim.flares.push({ a: fl, b: fl2, base: 10 + r() * 8, next: r() * 6, burst: 0 });
    }

    // Holographic advertising on tower faces along the descent.
    function adScreen(kind, x, y, z, w, h, rotY) {
      var sc = screen(128, 256, ADS[kind]);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sc.tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, fog: false, depthWrite: false }));
      m.position.set(x, y, z); m.rotation.y = rotY || 0; world.add(m);
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, h * 1.5), glowMaterial(glowTex(), kind === "skin" ? 0x23e6ff : kind === "sleep" ? 0xffa040 : 0xff3dbb, 0.35)); gl.position.copy(m.position); gl.rotation.y = m.rotation.y; gl.position.z += 0.3; world.add(gl);
      var mm = m.clone(); mirror.add(mm); var gm = gl.clone(); mirror.add(gm);
      anim.screens.push(sc);
    }
    adScreen("kv", -27 + 6.2, 52, 110, 16, 32, Math.PI / 2 * 0.0 + 0.5);
    adScreen("skin", 27 - 6.2, 34, 170, 12, 24, -0.5);
    adScreen("cabeza", -21, 30, 60, 10, 20, 0.45);
    adScreen("sleep", 21, 44, 230, 12, 24, -0.4);
    adScreen("kv", 88, 150, -330 + 12, 26, 52, 0);
    adScreen("skin", -120, 130, -260 + 12, 22, 44, 0.2);
    adScreen("cabeza", 158, 120, -150 + 12, 20, 40, -0.2);

    // Blade signs along the avenue and around the plaza.
    // Mostly kanji and katakana, with a few Vietnamese signs in chữ tròn.
    var SIGNS = [["ラーメン", "#ff3dbb", 1], ["酒", "#ffb347", 1], ["Phở Bò", "#ff5a5a", 1], ["ホテル", "#23e6ff", 1], ["薬局", "#6dff9e", 1], ["義肢修理", "#23e6ff", 1], ["Nhà Thuốc", "#6dff9e", 1], ["営業中", "#ff5a5a", 1], ["麺", "#ffb347", 1], ["カベサ", "#ff3dbb", 1], ["Mưa", "#9fb4ff", 1], ["雨", "#9fb4ff", 1], ["電気", "#fff27a", 1],
      ["CANTINA 24H", "#ff5a5a", 0], ["FARMACIA", "#6dff9e", 0], ["NOODLES", "#ffb347", 0], ["HOTEL", "#23e6ff", 0], ["TACOS · タコス", "#ff3dbb", 0], ["BAR", "#ffb347", 0], ["REPAIRS", "#23e6ff", 0], ["KV", "#ff5ac8", 0]];
    var si = 0, zz;
    for (zz = 24; zz < 330; zz += 9 + r() * 10) {
      [-1, 1].forEach(function (s) {
        if (r() < 0.25) return;
        var spec = SIGNS[(si++) % SIGNS.length], vert = spec[2] === 1;
        var w = vert ? 2.4 + r() * 1.2 : 8 + r() * 5, h = vert ? w * (3 + r() * 1.5) : w * 0.26;
        var x = s * (vert ? 16.5 + r() * 2 : 19.6), y = (vert ? 6 + r() * 22 : 3.5 + r() * 18) + h / 2;
        var tex = signTexture(spec[0], spec[1], vert, "rgba(10,6,14,0.85)");
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false }));
        m.position.set(x, y, zz + r() * 4);
        if (!vert) m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; else m.rotation.y = (r() - 0.5) * 0.2;
        world.add(m);
        var vi = /[\u1E00-\u1EFF\u01A0-\u01B0\u0110\u0111]/.test(spec[0]);
        var gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, h * 1.6), glowMaterial(glowTex(), vi ? tube(spec[1]) : spec[1], vi ? 0.34 : 0.5));
        gl.position.copy(m.position); gl.rotation.copy(m.rotation); world.add(gl);
        var mm = m.clone(); mirror.add(mm); var gm = gl.clone(); gm.material = gl.material.clone(); gm.material.opacity = 0.7; mirror.add(gm);
        if (r() < 0.14) anim.flicker.push({ ms: [m.material, gl.material], ph: r() * 10 });
      });
    }
    // The noodle stall on the plaza corner.
    (function () {
      var tex = signTexture("ラーメン · NOODLES", "#ffb347", false, "rgba(30,12,4,0.9)");
      var m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false }));
      m.position.set(-11, 4.2, 22); m.rotation.y = 0.5; both(m);
      var awning = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      awning.position.set(-11, 2.6, 23); awning.rotation.set(-1.1, 0.5, 0); both(awning);
    })();

    // Hero signs: tall neon columns on the towers, kanji and chữ tròn, the size of the
    // film's big vertical signs, along the descent and over the plaza.
    function heroSign(text, color, x, y, z, w, h, rotY) {
      var tex = signTexture(text, color, true, "rgba(8,5,12,0.9)", 2);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false }));
      m.position.set(x, y, z); m.rotation.y = rotY || 0; world.add(m);
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.6, h * 1.3), glowMaterial(glowTex(), tube(color), 0.36));
      gl.position.copy(m.position); gl.rotation.copy(m.rotation); gl.translateZ(-0.3); world.add(gl);
      var mm = m.clone(); mirror.add(mm); var gm = gl.clone(); gm.material = gl.material.clone(); gm.material.opacity = 0.5; mirror.add(gm);
      if (r() < 0.5) anim.flicker.push({ ms: [m.material, gl.material], ph: r() * 10 });
    }
    heroSign("Điện Ảnh Sài Gòn", "#ffb347", -21, 74, 150, 6, 30, 0.35);
    heroSign("薬局", "#6dff9e", 17, 44, 112, 5, 22, -0.3);
    heroSign("Phở TPHCM", "#ff3dbb", -13.5, 20.5, 80, 3.6, 10.5, 0.2);
    heroSign("天国ホテル", "#23e6ff", -7.2, 56, -30, 3.2, 17, 0.12);
    heroSign("酒場", "#ff3dbb", 6.4, 70, -34, 3.4, 18, -0.15);

    // The three menu billboards.
    function menuBoard(key, x, y, z, w, h, rotY) {
      var sc = screen(192, 448, menuDraw(key));
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sc.tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide, fog: false }));
      m.position.set(x, y, z); m.rotation.y = rotY; m.userData.menu = key; world.add(m);
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, h * 1.35), glowMaterial(glowTex(), MENU[key].color, 0.45));
      gl.position.copy(m.position); gl.rotation.y = rotY; gl.translateZ(-0.2); world.add(gl);
      var mm = m.clone(); mirror.add(mm);
      sc.key = key; anim.screens.push(sc); anim.menu[key] = { mesh: m, glow: gl, sc: sc };
    }
    menuBoard("matter", -4.6, 16, 8, 5.8, 14, 0.22);
    menuBoard("topologies", 7, 33, -4, 6.8, 16, -0.3);
    menuBoard("laws", -1, 60, -38, 11, 26, 0);

    // Spinners: police and civilian cars in the air lanes.
    function spinnerMesh(police) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.6), new THREE.MeshBasicMaterial({ color: 0x14161c }));
      g.add(body);
      var hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff1d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); hl.position.set(1.9, 0, 0); hl.scale.set(5, 3, 1); g.add(hl);
      var tl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); tl.position.set(-1.9, 0, 0); tl.scale.set(2.6, 1.6, 1); g.add(tl);
      var bar = null;
      if (police) { bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3a6dff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); bar.position.set(0, 0.9, 0); bar.scale.set(3, 3, 1); g.add(bar); }
      var under = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false })); under.position.set(0, -0.8, 0); under.scale.set(4, 1.6, 1); g.add(under);
      return { g: g, bar: bar };
    }
    for (var sp = 0; sp < 16; sp++) {
      var s2 = spinnerMesh(sp % 4 === 0);
      world.add(s2.g);
      anim.spinners.push({ o: s2, bar: s2.bar, cx: (r() - 0.5) * 300, cz: -80 - r() * 300, rx: 60 + r() * 160, rz: 40 + r() * 120, y: 30 + r() * 90, sp: (0.03 + r() * 0.05) * (r() < 0.5 ? -1 : 1), ph: r() * TAU });
    }
    var flyby = spinnerMesh(true); world.add(flyby.g); flyby.g.visible = false; anim.flyby = flyby;

    // Traffic: streams of lights in the air lanes.
    var TN = 700, tpos = new Float32Array(TN * 3), tcol = new Float32Array(TN * 3), tdat = [];
    for (var ti = 0; ti < TN; ti++) {
      var lane = ti % 10, dir = lane % 2 ? 1 : -1, ly = 40 + (lane >> 1) * 22, lx = -220 + lane * 44;
      tdat.push({ x: lx + (r() - 0.5) * 6, y: ly + (r() - 0.5) * 3, z: -500 + r() * 900, v: dir * (18 + r() * 14) });
      var warm = dir > 0; tcol[ti * 3] = warm ? 1 : 1; tcol[ti * 3 + 1] = warm ? 0.85 : 0.2; tcol[ti * 3 + 2] = warm ? 0.6 : 0.2;
    }
    var tgeo = new THREE.BufferGeometry(); tgeo.setAttribute("position", new THREE.BufferAttribute(tpos, 3)); tgeo.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
    var tpts = new THREE.Points(tgeo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: glowTex() }));
    tpts.frustumCulled = false; world.add(tpts); anim.traffic = { pts: tpts, dat: tdat, pos: tpos };

    // Umbrellas: the lit handles of the crowd on the pavements.
    var UN = 120, upos = new Float32Array(UN * 6), ucol = new Float32Array(UN * 6), udat = [];
    for (var ui = 0; ui < UN; ui++) {
      var side = ui % 2 ? 1 : -1, c2 = [[0.3, 0.95, 1], [1, 0.3, 0.75], [1, 0.8, 0.4], [0.7, 1, 0.8]][ui % 4];
      udat.push({ x: side * (13.5 + r() * 3), z: -30 + r() * 330, v: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.8) });
      for (var e = 0; e < 2; e++) { ucol[ui * 6 + e * 3] = c2[0]; ucol[ui * 6 + e * 3 + 1] = c2[1]; ucol[ui * 6 + e * 3 + 2] = c2[2]; }
    }
    var ugeo = new THREE.BufferGeometry(); ugeo.setAttribute("position", new THREE.BufferAttribute(upos, 3)); ugeo.setAttribute("color", new THREE.BufferAttribute(ucol, 3));
    var ulines = new THREE.LineSegments(ugeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, fog: false }));
    ulines.frustumCulled = false; world.add(ulines); anim.umbrellas = { l: ulines, dat: udat, pos: upos };
    // Umbrella canopies: faint glowing discs above the handles.
    var canopy = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex(), fog: false }));
    canopy.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(UN * 3), 3)); canopy.geometry.setAttribute("color", new THREE.BufferAttribute(ucol.slice(0, UN * 3), 3));
    canopy.frustumCulled = false; world.add(canopy); anim.canopy = canopy;

    // Steam from the street.
    for (var st = 0; st < 22; st++) {
      var sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: 0x9a8a90, transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
      var sx = (r() - 0.5) * 30, sz = -20 + r() * 300; sm.position.set(sx, 2, sz); sm.scale.set(10, 10, 1); world.add(sm);
      anim.steam.push({ s: sm, x: sx, z: sz, ph: r() * 6 });
    }

    // Smog and clouds.
    function layer(y, color, opacity, flip, size, rep) {
      var t = cloudTex().clone(); t.needsUpdate = true; t.repeat.set(rep, rep);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, color: color, transparent: true, opacity: opacity, depthWrite: false, side: flip ? THREE.BackSide : THREE.FrontSide, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; world.add(m); return m;
    }
    anim.cloudTop = layer(150, 0x6f7a9e, 1, false, 3600, 6);
    anim.cloudTop2 = layer(158, 0xa4aed0, 0.5, false, 3600, 4);
    anim.cloudBot = layer(146, 0x6a4636, 0.85, true, 3600, 6);
    anim.smog = layer(62, 0x4a3530, 0.22, true, 1600, 3);
    anim.smog2 = layer(62, 0x4a3530, 0.16, false, 1600, 3);

    // The city's glow on the underside of the cloud deck.
    for (var cg = 0; cg < 26; cg++) {
      var gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: cg % 5 ? 0xff7a3a : 0xff3dbb, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.22, fog: false }));
      gs.position.set((r() - 0.5) * 900, 138, -700 + r() * 1100); var gz2 = 160 + r() * 220; gs.scale.set(gz2, gz2 * 0.5, 1); world.add(gs);
    }

    // Sky, moon, stars.
    var sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {}, vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: "varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.01,0.012,0.04); vec3 hor = vec3(0.10,0.07,0.16); vec3 low = vec3(0.16,0.07,0.05); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.5)) : mix(hor, low, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }" }));
    world.add(sky);
    var moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xd8e2ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    moon.position.set(-700, 900, -1600); moon.scale.set(220, 220, 1); world.add(moon);
    var spos = [], k2; for (k2 = 0; k2 < 900; k2++) { var a = r() * TAU, el = 0.15 + r() * 1.3; spos.push(Math.cos(a) * Math.cos(el) * 2400, Math.sin(el) * 2400, Math.sin(a) * Math.cos(el) * 2400); }
    var sgeo = new THREE.BufferGeometry(); sgeo.setAttribute("position", new THREE.Float32BufferAttribute(spos, 3));
    world.add(new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 2.2, color: 0xcfd8ff, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false })));

    // The wet street: dark asphalt over the mirrored city, clearer in the puddles.
    var street = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, uniforms: SHARED,
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: [
        "uniform float uTime; uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD; uniform vec3 uHaze; varying vec3 vW;",
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }",
        "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }",
        FOG_GLSL,
        "void main(){",
        "  float pud = smoothstep(0.52, 0.62, vnoise(vW.xz * 0.09) * 0.7 + vnoise(vW.xz * 0.4) * 0.3);",
        "  vec3 col = vec3(0.035, 0.033, 0.04) * (0.8 + 0.4 * hash(floor(vW.xz * 6.0)));",
        "  float lane = step(abs(vW.x), 0.14) * step(0.5, fract(vW.z / 6.0)) * step(-10.0, vW.z);",
        "  float cross = step(abs(vW.x), 12.0) * step(20.0, vW.z) * step(vW.z, 26.0) * step(0.5, fract(vW.x / 1.6));",
        "  col += vec3(0.5, 0.36, 0.1) * lane * 0.5 + vec3(0.35) * cross * 0.3;",
        "  float ripple = 0.0;",
        "  vec2 c = floor(vW.xz * 0.5); vec2 f = fract(vW.xz * 0.5) - 0.5; float ph = fract(uTime * 0.9 + hash(c));",
        "  ripple = smoothstep(0.04, 0.0, abs(length(f) - ph * 0.5)) * (1.0 - ph) * step(0.6, hash(c + 3.1));",
        "  float a = mix(0.8, 0.42, pud) - ripple * 0.15;",
        "  col += vec3(0.25, 0.3, 0.4) * ripple * pud;",
        "  gl_FragColor = vec4(applyFog(col, vW), a);",
        "}"].join("\n"),
    }));
    street.rotation.x = -Math.PI / 2; street.position.y = 0.01; street.renderOrder = 2; world.add(street);
    // The mirrored world renders first, under the street.
    mirror.traverse(function (o) { o.renderOrder = -1; });

    return anim;
  }

  /* Rain around the camera: streaks falling in a box that follows it. */
  function buildRain(scene) {
    var N = 4000, pos = new Float32Array(N * 6), r = rng(3), i;
    for (i = 0; i < N; i++) {
      var x = (r() - 0.5) * 80, y = r() * 60, z = (r() - 0.5) * 80, L = 0.9 + r() * 1.4;
      pos.set([x, y, z, x - 0.12, y - L, z + 0.05], i * 6);
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: SHARED.uTime, uCam: SHARED.uCam, uAmt: { value: 1 } },
      vertexShader: "uniform float uTime; uniform vec3 uCam; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime * 38.0, 60.0) - 30.0; p.x = mod(p.x - uCam.x + 40.0, 80.0) - 40.0; p.z = mod(p.z - uCam.z + 40.0, 80.0) - 40.0; vec3 w = p + uCam; vA = 1.0 - smoothstep(20.0, 40.0, length(p)); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }",
      fragmentShader: "uniform float uAmt; varying float vA; void main(){ gl_FragColor = vec4(0.62, 0.7, 0.95, 0.32 * vA * uAmt); }",
    });
    var lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 10; scene.add(lines);
    return mat;
  }

  /* ---------------- the camera paths ---------------- */
  var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
  var PATH = new THREE.CatmullRomCurve3([V(160, 300, 640), V(90, 230, 430), V(40, 168, 300), V(10, 128, 250), V(-12, 92, 200), V(-8, 58, 150), V(4, 30, 108), V(0, 13, 72), V(0, 7.5, 44), V(0, 6.5, 36)], false, "centripetal");
  var LOOK = new THREE.CatmullRomCurve3([V(-40, 140, -500), V(-30, 110, -400), V(-20, 80, -300), V(-10, 60, -220), V(0, 40, -120), V(0, 30, -40), V(0, 20, 0), V(0, 16, -10), V(0, 30, -20), V(-1, 33, -20)], false, "centripetal");
  var CITY_POS = V(-1, 6.5, 36), CITY_LOOK = V(-1, 33, -20);
  var BACKDROP_POS = V(0, 4, 150), BACKDROP_LOOK = V(0, 42, 20);
  // Time warp: linger above the clouds, glide down, settle slowly at the plaza.
  function pathT(u) { return smooth(u) * 0.35 + u * 0.65 - Math.pow(Math.max(0, u - 0.85) / 0.15, 2) * 0.0; }

  /* ---------------- the score ---------------- */
  // hooks.onThunder(delaySeconds): a thunderclap is scheduled (for a flash).
  function createScore(hooks) {
    hooks = hooks || {};
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
    master.gain.value = 0.9; comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // A long dark hall for everything to ring in.
    var rev = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 4.2), ir = ctx.createBuffer(2, len, ctx.sampleRate), ch, i;
    for (ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch), lp = 0; for (i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
    rev.buffer = ir; var wet = ctx.createGain(); wet.gain.value = 0.55; rev.connect(wet).connect(master);
    var noiseBuf = (function () { var b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), dd = b.getChannelData(0), k; for (k = 0; k < dd.length; k++) dd[k] = Math.random() * 2 - 1; return b; })();
    var now = function () { return ctx.currentTime; };
    function noise(t0, dur) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t0, Math.random() * 1.5); if (dur) s.stop(t0 + dur); return s; }
    var bus = master;
    function out(node, dry, send) { var g1 = ctx.createGain(); g1.gain.value = dry; node.connect(g1).connect(bus); var g2 = ctx.createGain(); g2.gain.value = send; node.connect(g2).connect(rev); }
    // The street speaker: in the synth score the Vietnamese instruments are
    // heard from a stall or an ad down the block, band-limited and far off.
    var street = ctx.createGain(), sHp = ctx.createBiquadFilter(), sLp = ctx.createBiquadFilter(), sPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    sHp.type = "highpass"; sHp.frequency.value = 320; sLp.type = "lowpass"; sLp.frequency.value = 2600; street.gain.value = 0.7;
    street.connect(sHp).connect(sLp); if (sPan) { sLp.connect(sPan).connect(master); } else sLp.connect(master);
    function far(fn, pan) { if (sPan) sPan.pan.setValueAtTime(pan || 0, now()); var b0 = bus; bus = street; try { fn(); } finally { bus = b0; } }
    var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

    // Beds: rain and a low drone, started once, then only faded.
    var rainG = ctx.createGain(); rainG.gain.value = 0;
    var rs = noise(now()), hp = ctx.createBiquadFilter(), lpf = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 500; lpf.type = "lowpass"; lpf.frequency.value = 6500;
    rs.connect(hp).connect(lpf).connect(rainG); out(rainG, 1, 0.15);
    var droneG = ctx.createGain(); droneG.gain.value = 0;
    var dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 150;
    [55, 55.35, 27.5].forEach(function (f, k) { var o = ctx.createOscillator(); o.type = k === 2 ? "sine" : "sawtooth"; o.frequency.value = f; o.connect(dlp); o.start(); });
    dlp.connect(droneG); out(droneG, 1, 0.3);
    var dripT = null;
    function drips(level) {
      clearInterval(dripT); if (!level) return;
      dripT = setInterval(function () {
        if (Math.random() > 0.55) return;
        var t0 = now(), s = noise(t0, 0.03), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = "bandpass"; bp.frequency.value = 2000 + Math.random() * 4000; bp.Q.value = 8;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * (0.3 + Math.random() * 0.7), t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
        s.connect(bp).connect(g); out(g, 1, 0.2);
      }, 70);
    }

    function thunder(t0, level) {
      if (hooks.onThunder) { try { hooks.onThunder(Math.max(0, t0 - ctx.currentTime), level); } catch (e) { /* a listener's problem */ } }
      var s = noise(t0, 5), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(120, t0 + 1.2);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.08); g.gain.setTargetAtTime(level * 0.5, t0 + 0.3, 0.3); g.gain.setTargetAtTime(0, t0 + 1.2, 1.1);
      s.connect(lp).connect(g); out(g, 1, 0.5);
    }
    function whoosh(t0, dur, level) {
      var s = noise(t0, dur + 0.2), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(250, t0); bp.frequency.exponentialRampToValueAtTime(1400, t0 + dur * 0.55); bp.frequency.exponentialRampToValueAtTime(300, t0 + dur);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + dur * 0.5); g.gain.linearRampToValueAtTime(0, t0 + dur);
      s.connect(bp).connect(g); out(g, 1, 0.3);
    }
    function flyby(t0, level, fromPan) {
      var s = noise(t0, 3), bp = ctx.createBiquadFilter(), o = ctx.createOscillator(), og = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      bp.type = "bandpass"; bp.Q.value = 1.6; bp.frequency.setValueAtTime(500, t0); bp.frequency.linearRampToValueAtTime(900, t0 + 1.1); bp.frequency.linearRampToValueAtTime(350, t0 + 2.6);
      o.type = "sawtooth"; o.frequency.setValueAtTime(170, t0); o.frequency.linearRampToValueAtTime(180, t0 + 1.1); o.frequency.exponentialRampToValueAtTime(105, t0 + 2.6); og.gain.value = 0.25;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 1.15); g.gain.linearRampToValueAtTime(0, t0 + 2.8);
      s.connect(bp).connect(g); o.connect(lp).connect(og).connect(g); o.start(t0); o.stop(t0 + 3);
      if (pan) { pan.pan.setValueAtTime(fromPan, t0); pan.pan.linearRampToValueAtTime(-fromPan, t0 + 2.6); g.connect(pan); out(pan, 1, 0.35); } else out(g, 1, 0.35);
    }

    /* ---- the synth score: detuned saw pads, a brass swell, FM bells ---- */
    function pad(t0, notes, dur, level, bright) {
      notes.forEach(function (m) {
        var f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 0.8;
        lp.frequency.setValueAtTime(bright ? 700 : 420, t0); lp.frequency.linearRampToValueAtTime(bright ? 2400 : 1200, t0 + dur * 0.45); lp.frequency.linearRampToValueAtTime(bright ? 900 : 500, t0 + dur);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + Math.min(2.2, dur * 0.35)); g.gain.setValueAtTime(level, t0 + dur - 1.6); g.gain.linearRampToValueAtTime(0, t0 + dur + 1.2);
        [-9, 0, 8].forEach(function (c) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = c; o.connect(lp); o.start(t0); o.stop(t0 + dur + 1.3); });
        lp.connect(g); out(g, 0.5, 0.75);
      });
    }
    // The brass swell: bright, vibrato arriving late, the way the old poly synths sang.
    function brass(t0, notes, dur, level) {
      notes.forEach(function (m, idx) {
        var f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), vib = ctx.createOscillator(), vg = ctx.createGain();
        lp.type = "lowpass"; lp.Q.value = 2.2;
        lp.frequency.setValueAtTime(260, t0); lp.frequency.exponentialRampToValueAtTime(3200, t0 + 1.4); lp.frequency.exponentialRampToValueAtTime(1500, t0 + dur);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.7); g.gain.setValueAtTime(level, t0 + dur - 1.5); g.gain.linearRampToValueAtTime(0, t0 + dur + 1.5);
        vib.frequency.value = 5.2 + idx * 0.07; vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(14, t0 + 2.2); vib.connect(vg);
        [["sawtooth", -6], ["sawtooth", 7], ["square", 0]].forEach(function (s) { var o = ctx.createOscillator(); o.type = s[0]; o.frequency.value = f; o.detune.value = s[1]; vg.connect(o.detune); o.connect(lp); o.start(t0); o.stop(t0 + dur + 1.6); });
        vib.start(t0); vib.stop(t0 + dur + 1.6);
        lp.connect(g); out(g, 0.55, 0.8);
      });
    }
    function bell(t0, f, level, dur) {
      var c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      c.frequency.value = f; m.frequency.value = f * 1.4; mg.gain.setValueAtTime(f * 2.2, t0); mg.gain.exponentialRampToValueAtTime(f * 0.05, t0 + dur);
      m.connect(mg).connect(c.frequency);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      c.connect(g); out(g, 0.6, 0.9); c.start(t0); m.start(t0); c.stop(t0 + dur + 0.1); m.stop(t0 + dur + 0.1);
    }
    function jingle(t0) { [76, 83, 80, 88].forEach(function (m, k) { bell(t0 + k * 0.16, mtof(m), 0.05, 1.6); }); }

    /* ---- the Vietnamese ensemble ----
       Pitches sit in the oán mode of cải lương (Hò Xự Xang Xê Cống on D),
       with its bent, untempered degrees: Xự a little sharp, Xê a little
       flat. */
    var OAN = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74];
    var BEND = { 53: 30, 65: 30, 57: -25, 69: -25, 77: 30, 81: -25 };
    var hz = function (m) { return mtof(m) * Math.pow(2, (BEND[m] || 0) / 1200); };

    // Đàn bầu: a single string played in harmonics, the rod bending the
    // pitch up and back, the vibrato widening as the note hangs.
    function danBau(t0, m, dur, bend, level) {
      var f = hz(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
      var vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = "sine"; o2.type = "triangle"; o.frequency.value = f; o2.frequency.value = f * 2;
      [o.detune, o2.detune].forEach(function (d) {
        d.setValueAtTime(0, t0);
        if (bend) { d.setValueAtTime(0, t0 + dur * 0.18); d.linearRampToValueAtTime(bend * 100, t0 + dur * 0.42); d.linearRampToValueAtTime(bend * 100 * 0.15, t0 + dur * 0.8); }
      });
      vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(0, t0 + dur * 0.25); vg.gain.linearRampToValueAtTime(22, t0 + dur * 0.7);
      vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.006); g.gain.setTargetAtTime(level * 0.55, t0 + 0.05, 0.25); g.gain.setTargetAtTime(0, t0 + dur * 0.75, dur * 0.2);
      g2.gain.value = 0.22; lp.type = "lowpass"; lp.frequency.value = 2600;
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp); out(lp, 0.55, 0.85);
      // the pluck
      var p = noise(t0, 0.03), pb = ctx.createBiquadFilter(), pg = ctx.createGain();
      pb.type = "bandpass"; pb.frequency.value = f * 4; pb.Q.value = 3; pg.gain.setValueAtTime(level * 1.2, t0); pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
      p.connect(pb).connect(pg); out(pg, 0.6, 0.3);
      [o, o2, vib].forEach(function (x) { x.start(t0); x.stop(t0 + dur + 0.3); });
    }
    function danBauPhrase(t0, notes, level) { var t = t0; notes.forEach(function (n) { danBau(t, n[0], n[1], n[2] || 0, level); t += n[1] * (n[3] || 0.72); }); return t; }
    var PHRASES = [
      [[69, 1.6, 2], [67, 1.1, -1], [62, 2.4, 3]],
      [[74, 1.2, 0], [72, 1.4, 2], [69, 1.1, 0], [67, 2.2, -2]],
      [[62, 1.4, 5], [65, 1.2, 0], [67, 1.6, 2], [62, 2.6, -1]],
      [[72, 1.0, 0], [74, 1.8, 3], [69, 2.4, -2]],
    ];
    // Đàn tranh: the zither, plucked and run down in glissandi.
    function danTranh(t0, m, level) {
      var f = hz(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.01;
      o.detune.setValueAtTime(40, t0); o.detune.exponentialRampToValueAtTime(1, t0 + 0.05);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      var g2 = ctx.createGain(); g2.gain.value = 0.3; o.connect(g); o2.connect(g2).connect(g); out(g, 0.6, 0.7);
      o.start(t0); o2.start(t0); o.stop(t0 + 1.7); o2.stop(t0 + 1.7);
    }
    function tranhRun(t0, notes, gap, level) { notes.forEach(function (m, k) { danTranh(t0 + k * gap, m, level * (1 - k * 0.04)); }); }
    // A ghostly voice: the wordless ngân of cải lương, far off, sung on "a"
    // through vowel formants, gliding between notes, drowned in the hall.
    function ghostVoice(t0, path, dur, level) {
      var src = ctx.createGain(), voices = [0, 9].map(function (dt) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = dt; o.connect(src); return o; });
      var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.6; vg.gain.value = 38; vib.connect(vg);
      voices.forEach(function (o) {
        vg.connect(o.detune);
        o.frequency.setValueAtTime(hz(path[0][0]), t0);
        path.forEach(function (pt) { o.frequency.setTargetAtTime(hz(pt[0]), t0 + pt[1] * dur, 0.12); });
      });
      var g = ctx.createGain();
      [[720, 9, 1], [1150, 10, 0.55], [2650, 12, 0.25]].forEach(function (fm) { var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; var fg = ctx.createGain(); fg.gain.value = fm[2]; src.connect(bp).connect(fg).connect(g); });
      var env = ctx.createGain();
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(level, t0 + 0.8); env.gain.setValueAtTime(level, t0 + dur - 1); env.gain.linearRampToValueAtTime(0, t0 + dur + 0.6);
      g.connect(env); out(env, 0.2, 1.1);
      voices.concat([vib]).forEach(function (o) { o.start(t0); o.stop(t0 + dur + 0.8); });
    }
    // Hát bội: the big drum (trống chầu), the small gong (thanh la), the
    // wooden clapper (song lang), the temple block (mõ), the kèn's wail.
    function trongChau(t0, level) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.35);
      g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      o.connect(g); out(g, 0.9, 0.4); o.start(t0); o.stop(t0 + 0.75);
      var n = noise(t0, 0.08), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 500;
      ng.gain.setValueAtTime(level * 0.6, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08); n.connect(lp).connect(ng); out(ng, 1, 0.3);
    }
    function thanhLa(t0, level) {
      [1, 1.47, 2.09, 2.93, 3.6].forEach(function (r, k) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(420 * r, t0); o.frequency.exponentialRampToValueAtTime(420 * r * 0.985, t0 + 2);
        g.gain.setValueAtTime(level / (k + 1.5), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2 - k * 0.3);
        o.connect(g); out(g, 0.7, 0.6); o.start(t0); o.stop(t0 + 2.3);
      });
    }
    function songLang(t0, level) {
      var n = noise(t0, 0.02), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = "bandpass"; bp.frequency.value = 2300; bp.Q.value = 7;
      g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.02); n.connect(bp).connect(g); out(g, 1, 0.3);
      var o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 1750; og.gain.setValueAtTime(level * 0.6, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035); o.connect(og); out(og, 1, 0.2); o.start(t0); o.stop(t0 + 0.04);
    }
    function mo(t0, f, level) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * 1.04, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.02);
      g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11); o.connect(g); out(g, 1, 0.35); o.start(t0); o.stop(t0 + 0.12);
    }
    function ken(t0, path, dur, level) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), mix = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = "sawtooth"; o2.type = "square"; o2.detune.value = 6; vib.frequency.value = 6.2; vg.gain.value = 30; vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
      [o, o2].forEach(function (x) { x.frequency.setValueAtTime(hz(path[0][0]), t0); path.forEach(function (pt) { x.frequency.setTargetAtTime(hz(pt[0]), t0 + pt[1] * dur, 0.09); }); x.connect(mix); });
      var g = ctx.createGain();
      [[1100, 3, 1], [2300, 5, 0.6]].forEach(function (fm) { var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; var fg = ctx.createGain(); fg.gain.value = fm[2]; mix.connect(bp).connect(fg).connect(g); });
      var env = ctx.createGain(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(level, t0 + 0.25); env.gain.setValueAtTime(level, t0 + dur - 0.5); env.gain.linearRampToValueAtTime(0, t0 + dur + 0.4);
      g.connect(env); out(env, 0.35, 0.95);
      [o, o2, vib].forEach(function (x) { x.start(t0); x.stop(t0 + dur + 0.5); });
    }
    function siren(t0, level) {
      var o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = 760; l.frequency.value = 0.55; lg.gain.value = 140; l.connect(lg).connect(o.frequency);
      lp.type = "lowpass"; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 1.5); g.gain.linearRampToValueAtTime(0, t0 + 5);
      o.connect(lp).connect(g); out(g, 0.3, 1); o.start(t0); l.start(t0); o.stop(t0 + 5.2); l.stop(t0 + 5.2);
    }

    var profile = "synth", ambOn = false; // the synth score; "oan" is the all-Vietnamese ensemble
    var ambT = null, ambI = 0;
    var CHORDS = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 69], [43, 50, 55, 58, 65], [45, 52, 57, 61, 64]];
    function ambient(on) {
      clearInterval(ambT); ambOn = on; if (!on) return;
      var oan = function () {
        var t = now() + 0.1, r2 = Math.random();
        if (r2 < 0.55) danBauPhrase(t, PHRASES[ambI % PHRASES.length], 0.05);
        else if (r2 < 0.75) tranhRun(t, [74, 72, 69, 67, 65, 62, 60, 57].slice(0, 5 + Math.floor(Math.random() * 3)), 0.09, 0.035);
        else ghostVoice(t, [[69, 0], [72, 0.3], [69, 0.6], [67, 0.85]], 5.5, 0.012);
        if (Math.random() < 0.5) { var k; for (k = 0; k < 4; k++) songLang(t + 1.5 + k * 0.9, 0.05); }
        if (Math.random() < 0.3) siren(now() + 2 + Math.random() * 3, 0.01);
        if (Math.random() < 0.3) flyby(now() + 1 + Math.random() * 4, 0.05, Math.random() < 0.5 ? -1 : 1);
        if (Math.random() < 0.12) thunder(now() + 3, 0.12);
        ambI++;
      };
      // The synth score: the pads carry it; every third bar or so a đàn
      // bầu, a zither or the ghost voice drifts in from down the street.
      var synth = function () {
        var t = now() + 0.05;
        pad(t, CHORDS[ambI % 4], 7.5, 0.018, false);
        if (ambI % 3 === 1 || Math.random() < 0.15) {
          var r3 = Math.random(), side = Math.random() < 0.5 ? -0.6 : 0.6;
          far(function () {
            if (r3 < 0.5) danBauPhrase(t + 2 + Math.random() * 2, PHRASES[(ambI >> 1) % PHRASES.length], 0.045);
            else if (r3 < 0.75) ghostVoice(t + 2.5, [[69, 0], [72, 0.3], [69, 0.6], [67, 0.85]], 5, 0.014);
            else tranhRun(t + 3, [74, 72, 69, 67, 65, 62].slice(0, 4 + Math.floor(Math.random() * 3)), 0.1, 0.032);
          }, side);
        }
        if (Math.random() < 0.3) siren(now() + 2 + Math.random() * 3, 0.012);
        if (Math.random() < 0.35) flyby(now() + 1 + Math.random() * 4, 0.05, Math.random() < 0.5 ? -1 : 1);
        if (Math.random() < 0.15) thunder(now() + 3, 0.12);
        ambI++;
      };
      var step = profile === "synth" ? synth : oan;
      step(); ambT = setInterval(step, profile === "synth" ? 7500 : 8000);
    }
    var DRONE = { oan: 0.04, synth: 0.06 };

    var api = {
      ctx: ctx,
      // The instruments, for a game's own cues (themes/lluvia-audio.js).
      inst: { ctx: ctx, master: master, rev: rev, out: out, noise: noise, far: far, mtof: mtof, hz: hz,
        pad: pad, brass: brass, bell: bell, jingle: jingle, danBau: danBau, danBauPhrase: danBauPhrase, PHRASES: PHRASES,
        tranhRun: tranhRun, ghostVoice: ghostVoice, trongChau: trongChau, thanhLa: thanhLa, songLang: songLang, mo: mo, ken: ken,
        thunder: thunder, whoosh: whoosh, flyby: flyby, siren: siren, drips: drips, ambient: ambient,
        rainG: rainG, droneG: droneG, CHORDS: CHORDS },
      resume: function () { if (ctx.state !== "running") ctx.resume(); },
      mute: function (m) { master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.08); },
      // "oan": the Vietnamese ensemble. "synth": the synth pads and brass,
      // the Vietnamese instruments only as colour from the street.
      setProfile: function (p) {
        if (p !== "synth" && p !== "oan") return;
        profile = p; droneG.gain.setTargetAtTime(DRONE[p], now(), 1.2);
        if (ambOn) ambient(true);
      },
      profile: function () { return profile; },
      descent: function () {
        var t = now() + 0.1;
        rainG.gain.setValueAtTime(0, t); rainG.gain.linearRampToValueAtTime(0.02, t + 6); rainG.gain.linearRampToValueAtTime(0.09, t + 12); rainG.gain.linearRampToValueAtTime(0.14, t + 18);
        setTimeout(function () { drips(0.05); }, 15000);
        setTimeout(function () { api.arrive(); }, (DESCENT_S - 1.2) * 1000);
        thunder(t + 0.3, 0.22); whoosh(t + 3.4, 3.2, 0.12); flyby(t + 9.6, 0.16, 1);
        if (profile === "synth") {
          droneG.gain.setTargetAtTime(0.07, t, 1.5);
          pad(t, [38, 45, 50, 53, 57], 6.5, 0.022, false);
          pad(t + 5.5, [34, 41, 46, 50, 57], 5, 0.02, false);
          brass(t + 6.8, [50, 57, 62, 65, 69, 74], 6.5, 0.02);
          // Passing the dream ad: its sung jingle, far off.
          far(function () { ghostVoice(t + 9.2, [[69, 0], [72, 0.35], [74, 0.55], [69, 0.8]], 3.6, 0.012); }, -0.4);
          pad(t + 11, [43, 50, 55, 58, 65], 6, 0.02, true);
          jingle(t + 12.5);
          siren(t + 14, 0.02);
          // Street level: a stall's đàn bầu and the clapper, under the brass.
          far(function () {
            danBauPhrase(t + 15.4, PHRASES[1], 0.05);
            [16, 16.9, 17.8, 18.4].forEach(function (d) { songLang(t + d, 0.045); });
          }, 0.5);
          brass(t + 18.2, [45, 52, 57, 61, 64, 69], 5, 0.017);
          return;
        }
        droneG.gain.setTargetAtTime(0.045, t, 1.5);
        tranhRun(t + 0.6, [74, 72, 69, 67, 65, 62, 60, 57, 55], 0.075, 0.05);
        danBauPhrase(t + 1.8, PHRASES[0], 0.06);
        ghostVoice(t + 3.6, [[69, 0], [72, 0.35], [74, 0.55], [69, 0.8]], 4.2, 0.016);
        trongChau(t + 6.8, 0.3); trongChau(t + 7.2, 0.26); trongChau(t + 7.45, 0.3); thanhLa(t + 7.6, 0.06);
        ken(t + 7.6, [[62, 0], [65, 0.2], [67, 0.45], [69, 0.7]], 3.6, 0.02);
        danBauPhrase(t + 11, PHRASES[1], 0.055);
        tranhRun(t + 12.5, [74, 72, 69, 72], 0.14, 0.04);
        siren(t + 14, 0.015);
        [16, 16.9, 17.8, 18.4].forEach(function (d) { songLang(t + d, 0.06); });
        ghostVoice(t + 18.2, [[74, 0], [72, 0.25], [69, 0.45], [67, 0.65], [62, 0.85]], 5, 0.02);
        danBau(t + 18.4, 62, 4.5, 3, 0.05);
      },
      arrive: function () {
        var t = now() + 0.05;
        rainG.gain.setTargetAtTime(0.13, t, 1); droneG.gain.setTargetAtTime(DRONE[profile], t, 1); drips(0.05);
        if (profile === "synth") {
          bell(t, 73.4, 0.12, 5); bell(t + 0.02, 146.8, 0.05, 4);
          pad(t, [38, 50, 57, 62, 65], 8, 0.02, false);
          far(function () { danBau(t + 1.4, 62, 5, 5, 0.04); }, -0.3);
          setTimeout(function () { ambient(true); }, 7000);
          return;
        }
        trongChau(t, 0.3); thanhLa(t + 0.02, 0.07); songLang(t + 0.6, 0.07);
        danBau(t + 0.4, 50, 5, 5, 0.06);
        setTimeout(function () { ambient(true); }, 6000);
      },
      city: function () { var t = now(); droneG.gain.setTargetAtTime(DRONE[profile], t, 1); rainG.gain.setTargetAtTime(0.13, t, 1); drips(0.05); ambient(true); },
      select: function () {
        var t = now() + 0.01;
        if (profile === "oan") { danBau(t, 74, 0.9, 2, 0.07); mo(t, 620, 0.1); return; } // a đàn bầu note bent up, over a temple block
        // Synth: the terminal blip and a low thump, with a đàn bầu harmonic ringing behind.
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.045); o.frequency.setValueAtTime(990, t + 0.09);
        g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000; o.connect(lp).connect(g); out(g, 1, 0.4); o.start(t); o.stop(t + 0.18);
        var th = ctx.createOscillator(), tg = ctx.createGain(); th.frequency.setValueAtTime(90, t); th.frequency.exponentialRampToValueAtTime(45, t + 0.25); tg.gain.setValueAtTime(0.12, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); th.connect(tg); out(tg, 1, 0.2); th.start(t); th.stop(t + 0.32);
        danBau(t + 0.06, 74, 1.1, 2, 0.03);
      },
      close: function () {
        var t = now() + 0.01;
        if (profile === "oan") { danBau(t, 69, 0.7, -2, 0.05); mo(t, 480, 0.07); return; } // the same string bent down, softer
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.setValueAtTime(990, t); o.frequency.setValueAtTime(660, t + 0.05);
        g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400; o.connect(lp).connect(g); out(g, 1, 0.4); o.start(t); o.stop(t + 0.14);
      },
      key: function () {
        var t = now() + 0.005;
        if (profile === "oan") { songLang(t, 0.07); return; } // the song lang's dry click
        var s2 = noise(t, 0.02), hp2 = ctx.createBiquadFilter(), g = ctx.createGain();
        hp2.type = "highpass"; hp2.frequency.value = 1800; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
        s2.connect(hp2).connect(g); out(g, 1, 0.1);
        var o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 180; og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); o.connect(og); out(og, 1, 0); o.start(t); o.stop(t + 0.05);
      },
      begin: function () {
        var t = now() + 0.02;
        if (profile === "oan") { trongChau(t, 0.3); trongChau(t + 0.3, 0.3); thanhLa(t + 0.32, 0.07); ken(t + 0.3, [[67, 0], [69, 0.3], [74, 0.6]], 2, 0.022); return; } // drum, gong and kèn
        brass(t, [50, 57, 62, 66, 69], 2.4, 0.02); bell(t, 73.4, 0.1, 4);
        trongChau(t, 0.18); thanhLa(t + 0.04, 0.035); // the drum and gong, low under the brass
      },
      stop: function () { ambient(false); drips(0); try { ctx.close(); } catch (e) { /* closed */ } },
    };
    return api;
  }

  /* ---------------- mount ---------------- */
  function mount(canvas, opts) {
    opts = opts || {};
    var mode = opts.mode || "city";
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    var dpr = opts.dpr || Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x05040a, 1);
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(mode === "backdrop" ? 58 : 62, 1, 0.5, 6000);
    var anim = buildCity(scene, opts);
    var rainMat = buildRain(scene);
    var score = null, muted = !!opts.muted, started = mode !== "descent", t0 = performance.now() / 1000, tStart = 0, cueDone = {}, selected = null, hover = null;
    var look = { yaw: 0, pitch: 0, vy: 0, vp: 0 }, drag = null;
    var inCity = mode === "city";
    var raf = 0, visible = true, destroyed = false, paused = false, lastFrame = 0;
    // opts.fps caps the frame rate (a backdrop behind a game board needn't
    // run at 60 and competes with the board for the GPU).
    var minGap = opts.fps ? 1000 / opts.fps - 2 : 0;

    function size() {
      var w = canvas.clientWidth || 390, h = canvas.clientHeight || 844;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    size();
    var ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(canvas);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible && !raf && !destroyed) raf = requestAnimationFrame(frame); }) : null; if (io) io.observe(canvas);

    function cue(name) { if (cueDone[name]) return; cueDone[name] = true; if (opts.onCue) opts.onCue(name); }
    var tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

    function placeCamera(t) {
      if (mode === "backdrop") {
        tmpP.copy(BACKDROP_POS); tmpP.x += Math.sin(t * 0.05) * 3; tmpP.z -= (t * 1.2) % 60;
        tmpL.copy(BACKDROP_LOOK); tmpL.z = tmpP.z - 130;
        cam.position.copy(tmpP); cam.lookAt(tmpL); return;
      }
      var dbg = window.__LLUVIA_U != null;
      var el = dbg ? window.__LLUVIA_U * DESCENT_S : (started ? t - tStart : 0);
      var u = inCity ? 1 : Math.min(dbg ? 0.9999 : 1, el / DESCENT_S);
      if (!inCity && u >= 1) { inCity = true; cue("city"); }
      if (!inCity) {
        var pu = pathT(u);
        PATH.getPoint(pu, tmpP); LOOK.getPoint(pu, tmpL);
        if (u > 0.2 && u < 0.3) cue("clouds");
        if (u > 0.33) cue("below");
        if (u > 0.78) cue("street");
        // Buffeting through the cloud deck.
        var shake = Math.max(0, 1 - Math.abs(tmpP.y - 150) / 25) * 0.6;
        tmpP.x += Math.sin(t * 23) * shake; tmpP.y += Math.sin(t * 19) * shake;
      } else {
        tmpP.copy(CITY_POS); tmpP.x += Math.sin(t * 0.13) * 0.8; tmpP.y += Math.sin(t * 0.21) * 0.25;
        tmpL.copy(CITY_LOOK);
      }
      cam.position.copy(tmpP); cam.lookAt(tmpL);
      if (inCity) { cam.rotateY(look.yaw); cam.rotateX(look.pitch); }
      // Flyby: a police spinner crossing close in front, right to left.
      var fb = anim.flyby; var fu = (el - 9.4) / 2.6;
      if (!inCity && fu > 0 && fu < 1) {
        fb.g.visible = true;
        var fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
        var right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
        fb.g.position.copy(cam.position).addScaledVector(fwd, 26).addScaledVector(right, lerp(40, -40, fu)).addScaledVector(cam.up, 3 - fu * 4);
        fb.g.lookAt(fb.g.position.clone().addScaledVector(right, -1)); fb.g.rotateY(Math.PI / 2);
      } else fb.g.visible = false;
    }

    function atmosphere(y) {
      // Above the clouds: clear and blue-black. In them: grey-out. Below: brown smog, orange low haze.
      var inCloud = Math.max(0, 1 - Math.abs(y - 150) / 14);
      var above = smooth((y - 150) / 20);
      var fog = new THREE.Color("#241a1f").lerp(new THREE.Color("#0b0d1d"), above).lerp(new THREE.Color("#8a8a98"), inCloud);
      SHARED.uFog.value.copy(fog);
      SHARED.uFogD.value = lerp(0.0085, 0.0012, above) + inCloud * 0.05;
      rainMat.uniforms.uAmt.value = 1 - above;
      anim.cloudTop.visible = anim.cloudTop2.visible = y > 120;
      anim.cloudBot.visible = y < 170;
    }

    function animate(t, dt) {
      SHARED.uTime.value = t; SHARED.uCam.value.copy(cam.position);
      atmosphere(cam.position.y);
      var i;
      anim.cloudTop.material.map.offset.x = t * 0.004; anim.cloudTop2.material.map.offset.y = t * 0.003; anim.cloudBot.material.map.offset.x = t * 0.004;
      anim.smog.material.map.offset.x = t * 0.006; anim.smog2.material.map.offset.y = -t * 0.005;
      // Screens at ~15 fps.
      var fr = Math.floor(t * 15);
      anim.screens.forEach(function (sc, k) { if ((fr + k) % 2 && sc.last >= 0) return; if (sc.last === fr) return; sc.last = fr; sc.draw(sc.g, sc.canvas.width, sc.canvas.height, t, sc.key && (sc.key === selected || sc.key === hover)); sc.tex.needsUpdate = true; });
      Object.keys(anim.menu).forEach(function (k) { var m = anim.menu[k], on = k === selected || k === hover; m.glow.material.opacity = lerp(m.glow.material.opacity, on ? 0.9 : 0.4 + 0.08 * Math.sin(t * 3 + k.length), 0.1); });
      anim.flicker.forEach(function (f) { var on = Math.sin(t * 7 + f.ph) > -0.3 || Math.sin(t * 31 + f.ph * 3) > 0.6; f.ms[0].opacity = on ? 1 : 0.15; f.ms[1].opacity = on ? 0.5 : 0.05; });
      anim.beacons.forEach(function (b) { b.s.material.opacity = Math.sin(t * 2.2 + b.ph) > 0.6 ? 1 : 0.1; });
      anim.beams.forEach(function (b) { b.p.rotation.z = Math.sin(t * 0.21 + b.ph) * 0.55; b.p.rotation.x = Math.cos(t * 0.17 + b.ph) * 0.4; });
      anim.flares.forEach(function (f) {
        if (t > f.next) { f.burst = 1; f.next = t + 3 + Math.random() * 6; }
        f.burst = Math.max(0, f.burst - dt * 0.9);
        var s = f.base * (0.9 + 0.2 * Math.sin(t * 17 + f.base)) * (1 + f.burst * 2.2);
        f.a.scale.set(s * 0.7, s, 1); f.b.scale.set(s * 1.2, s * 1.7, 1); f.b.material.opacity = 0.35 + f.burst * 0.6;
      });
      anim.spinners.forEach(function (s) {
        var a = s.ph + t * s.sp, x = s.cx + Math.cos(a) * s.rx, z = s.cz + Math.sin(a) * s.rz;
        s.o.g.position.set(x, s.y + Math.sin(t * 0.5 + s.ph) * 2, z);
        var dx = -Math.sin(a) * s.rx * s.sp, dz = Math.cos(a) * s.rz * s.sp; s.o.g.rotation.y = Math.atan2(-dz, dx);
        if (s.bar) s.bar.material.color.setHex(Math.sin(t * 9 + s.ph) > 0 ? 0x3a6dff : 0xff2a2a);
      });
      if (anim.flyby.bar) anim.flyby.bar.material.color.setHex(Math.sin(t * 11) > 0 ? 0x3a6dff : 0xff2a2a);
      var tr = anim.traffic; for (i = 0; i < tr.dat.length; i++) { var p = tr.dat[i]; p.z += p.v * dt; if (p.z > 400) p.z -= 900; if (p.z < -500) p.z += 900; tr.pos[i * 3] = p.x; tr.pos[i * 3 + 1] = p.y; tr.pos[i * 3 + 2] = p.z; }
      tr.pts.geometry.attributes.position.needsUpdate = true;
      var um = anim.umbrellas, cp = anim.canopy.geometry.attributes.position.array;
      for (i = 0; i < um.dat.length; i++) { var q = um.dat[i]; q.z += q.v * dt; if (q.z > 300) q.z = -30; if (q.z < -30) q.z = 300; var bob = Math.sin(t * 4 + i) * 0.05; um.pos.set([q.x, 0.9 + bob, q.z, q.x, 1.9 + bob, q.z], i * 6); cp[i * 3] = q.x; cp[i * 3 + 1] = 2.1 + bob; cp[i * 3 + 2] = q.z; }
      um.l.geometry.attributes.position.needsUpdate = true; anim.canopy.geometry.attributes.position.needsUpdate = true;
      anim.steam.forEach(function (s) { var k = ((t * 0.12 + s.ph) % 1); s.s.position.set(s.x + k * 3, 1 + k * 14, s.z); s.s.scale.set(6 + k * 16, 6 + k * 16, 1); s.s.material.opacity = 0.2 * Math.sin(k * Math.PI); });
    }

    var lastT = 0;
    function frame(ms) {
      raf = 0; if (destroyed) return;
      if (paused) return;
      if (minGap && ms && ms - lastFrame < minGap) { raf = requestAnimationFrame(frame); return; }
      lastFrame = ms || 0;
      var t = (window.__LLUVIA_T != null ? window.__LLUVIA_T : performance.now() / 1000 - t0);
      var dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
      placeCamera(t); animate(t, dt || 0.016);
      renderer.render(scene, cam);
      if (visible) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Picking and looking around, in the city.
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e) {
      var rc = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      var hits = ray.intersectObjects(Object.keys(anim.menu).map(function (k) { return anim.menu[k].mesh; }));
      return hits.length ? hits[0].object.userData.menu : null;
    }
    function down(e) { if (!inCity || mode !== "city" && mode !== "descent") return; drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, yaw: look.yaw, pitch: look.pitch }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    function move(e) {
      if (!inCity) return;
      if (drag) { look.yaw = Math.max(-0.35, Math.min(0.35, drag.yaw + (e.clientX - drag.sx) * 0.003)); look.pitch = Math.max(-0.2, Math.min(0.25, drag.pitch + (e.clientY - drag.sy) * 0.002)); return; }
      if (e.pointerType === "mouse") { var k = pick(e); if (k !== hover) { hover = k; canvas.style.cursor = k ? "pointer" : ""; } }
    }
    function up(e) {
      if (!drag) return; var moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy); drag = null;
      if (moved < 8) { var k = pick(e); if (k) { if (score) score.select(); if (opts.onPick) opts.onPick(k); } }
    }
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", function () { drag = null; });
    canvas.style.touchAction = "none";

    if (mode === "city") cue("city");

    var ctl = {
      start: function () {
        if (!score) { score = createScore(); if (score && muted) score.mute(true); }
        if (score) score.resume();
        if (mode === "descent" && !started) { started = true; tStart = performance.now() / 1000 - t0; if (score) score.descent(); }
        else if (mode === "city" && score) score.city();
      },
      skip: function () { if (!inCity) { inCity = true; cue("city"); if (score) { score.arrive(); } } },
      setMuted: function (m) { muted = m; if (score) score.mute(m); },
      select: function (k) { selected = k; },
      sound: function (name) { if (score && score[name]) score[name](); },
      setPaused: function (p) { paused = !!p; if (!paused && visible && !raf && !destroyed) raf = requestAnimationFrame(frame); },
      destroy: function () { destroyed = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); if (score) score.stop(); renderer.dispose(); },
    };
    return ctl;
  }

  function fontsReady(fn) {
    if (!document.fonts || !document.fonts.load) { fn(); return; }
    var done = false, go = function () { if (!done) { done = true; fn(); } };
    Promise.all([document.fonts.load("400 40px 'Dela Gothic One'", "物質法則位相ラーメン"), document.fonts.load("700 40px 'Saira Extra Condensed'", "MATTER"), document.fonts.load("600 40px 'Saira Extra Condensed'", "Phở Bò Nhà Thuốc Mưa Điện Ảnh Sài Gòn TPHCM")]).then(go, go);
    setTimeout(go, 1800);
  }

  export const LLUVIA = {
    mount: function (canvas, opts) {
      var box = { ctl: null, queue: [] };
      var proxy = {};
      ["start", "skip", "setMuted", "select", "sound", "destroy", "setPaused"].forEach(function (k) { proxy[k] = function () { var a = arguments; if (box.ctl) box.ctl[k].apply(null, a); else box.queue.push([k, a]); }; });
      fontsReady(function () { box.ctl = mount(canvas, opts); box.queue.forEach(function (q) { box.ctl[q[0]].apply(null, q[1]); }); });
      return proxy;
    },
    DESCENT_S: DESCENT_S,
  };
  export { createScore, DESCENT_S };
