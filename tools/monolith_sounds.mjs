/* The Monolith's recorded sound, cut from real recordings (user: "I want
   the sound palette to be non-synthesizer generated. I want real massive:
   thud / boom / scraping sounds"; themes/lab/monolith-sounds.js has the
   layout this writes and the game reads, and the weight rules).

   Nine CC0 recordings from freesound.org, in assets/monolith/src/ (its
   CREDITS.md says whose each is), into three files in assets/monolith/:

     monolith-hits.mp3    one hit a second (HIT_SLOT): five heavy thumps
                          on stone, four rocks and a brick knocked on stone,
                          two rubble thumps; each from just before its
                          attack, its tail faded, all to one peak
     monolith-falls.mp3   the concrete smash, a rockfall's blocky chunks,
                          rocks tumbling down stone (FALLS)
     monolith-drags.mp3   a stone door's slab grinding aside, and stone
                          rubbed on stone, each made a seamless loop (its
                          last XFADE seconds crossfaded, equal power, into
                          the XFADE before the loop's start; DRAGS)

   Nothing synthesized: cuts, fades, a high-pass under the rumble, and
   levels. 48 kHz; the hits and drags mono, the falls stereo.

     npm run build && node tools/monolith_sounds.mjs \
       && FFMPEG=ffmpeg python3 -I tools/opus_twins.py && npm run build

   (The Opus twins after: opus_twins.py matches each MP3 in dist/ to its
   source.) */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { HIT_SLOT, HIT_COUNT, FALLS, FALLS_LENGTH, DRAGS, DRAGS_LENGTH, XFADE } from "../themes/lab/monolith-sounds.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets", "monolith", "src");
const OUT = path.join(ROOT, "assets", "monolith");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SR = 48000;

const FILES = {
  thumps: "heavy-thumps-on-stone-vestibule-door-669719.mp3",
  rocks: "rocks-stones-impacts-nox-sound-567701.mp3",
  brick: "brick-dropped-on-bricks-jackthemurray-429402.mp3",
  rubble: "rubble-trouble-magnuswaker-758580.mp3",
  smash: "concrete-smash-magnuswaker-522098.mp3",
  rockfall: "rock-slide-blocky-chunks-betchkal-500638.mp3",
  tumble: "tumbling-rocks-fission9-488660.mp3",
  door: "heavy-stone-door-opens-postproddog-578491.mp3",
  friction: "friction-stone-loop-tim-verberne-576086.mp3",
};

// A recording decoded at SR: its channels (a mono one given as one).
const cache = {};
function load(key, channels = 1) {
  const id = `${key}:${channels}`;
  if (cache[id]) return cache[id];
  const r = spawnSync(FFMPEG, ["-v", "error", "-i", path.join(SRC, FILES[key]), "-ac", String(channels), "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`can't decode ${FILES[key]}: ${r.stderr}`);
  const all = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  const n = all.length / channels;
  const out = Array.from({ length: channels }, (_, c) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = all[i * channels + c]; return x; });
  cache[id] = out;
  return out;
}
const S = (t) => Math.round(t * SR);
const cut = (chs, a, b) => chs.map((x) => x.slice(Math.max(0, S(a)), Math.min(x.length, S(b))));
const peakOf = (chs) => chs.reduce((m, x) => x.reduce((q, v) => Math.max(q, Math.abs(v)), m), 0);
function gain(chs, g) { chs.forEach((x) => { for (let i = 0; i < x.length; i++) x[i] *= g; }); return chs; }
const normalize = (chs, to) => gain(chs, to / Math.max(1e-9, peakOf(chs)));
// Fades: in over `a` seconds (a straight ramp), out over the last `b` (a
// cosine, so a tail dies away rather than stopping).
function fades(chs, a, b) {
  chs.forEach((x) => {
    const na = S(a), nb = Math.min(x.length, S(b));
    for (let i = 0; i < na && i < x.length; i++) x[i] *= i / na;
    for (let i = 0; i < nb; i++) x[x.length - nb + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / nb);
  });
  return chs;
}
// A second-order high-pass (Butterworth, the RBJ cookbook's), run forward.
function highpass(chs, f) {
  const w = (2 * Math.PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / Math.SQRT2;
  const b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = (1 + cs) / 2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  chs.forEach((x) => {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
    }
  });
  return chs;
}
// The attack of the hit near `t`: the first sample above 5% of the
// window's peak, a few milliseconds before it.
function attackNear(chs, t) {
  const x = chs[0], a = Math.max(0, S(t - 0.06)), b = Math.min(x.length, S(t + 0.12));
  let pk = 0;
  for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(x[i]));
  for (let i = a; i < b; i++) if (Math.abs(x[i]) > pk * 0.05) return Math.max(0, i - S(0.003)) / SR;
  return t;
}
// A loop's last X crossfaded (equal power) into the X before its start.
function bakeLoop(chs, start, end, X) {
  const A = S(start), B = S(end), N = S(X);
  chs.forEach((x) => {
    const y = Float32Array.from(x);
    for (let i = 0; i < N; i++) { const k = (i / N) * (Math.PI / 2); y[B - N + i] = Math.cos(k) * x[B - N + i] + Math.sin(k) * x[A - N + i]; }
    x.set(y);
  });
  return chs;
}
function place(into, chs, at) {
  into.forEach((x, c) => x.set(chs[Math.min(c, chs.length - 1)].subarray(0, Math.max(0, Math.min(chs[0].length, x.length - S(at)))), S(at)));
}

/* ---------------------------------------------------------------- hits */
// [recording, near-attack second, length, tail fade, high-pass Hz]
const HIT_CUTS = [
  ["thumps", 0.66, 0.85, 0.35, 25], ["thumps", 1.86, 0.85, 0.35, 25], ["thumps", 3.18, 0.85, 0.35, 25],
  ["thumps", 4.55, 0.85, 0.35, 25], ["thumps", 5.84, 0.85, 0.35, 25],
  ["rocks", 1.52, 0.4, 0.2, 90], ["rocks", 4.08, 0.4, 0.2, 90], ["rocks", 12.36, 0.4, 0.2, 90], ["brick", 0.77, 0.5, 0.3, 90],
  ["rubble", 0.08, 0.27, 0.09, 30], ["rubble", 0.64, 0.36, 0.14, 30],
];
const hits = [new Float32Array(S(HIT_COUNT * HIT_SLOT))];
HIT_CUTS.forEach(([key, near, len, tail, hp], slot) => {
  const src = load(key, 1);
  const at = attackNear(src, near);
  const h = normalize(fades(highpass(cut(src, at, at + len), hp), 0.0015, tail), 0.708);
  place(hits, h, slot * HIT_SLOT);
});

/* --------------------------------------------------------------- falls */
const falls = [new Float32Array(S(FALLS_LENGTH)), new Float32Array(S(FALLS_LENGTH))];
{
  const smash = load("smash", 2);
  place(falls, normalize(fades(highpass(cut(smash, 0, 1.6), 25), 0.001, 0.35), 0.891), FALLS.smash[0]);
  const rf = load("rockfall", 1);
  place(falls, normalize(fades(highpass(cut(rf, 4.9, 4.9 + FALLS.rockfall[1]), 30), 0.25, 2.2), 0.708), FALLS.rockfall[0]);
  const tb = load("tumble", 2);
  place(falls, normalize(fades(highpass(cut(tb, 1.38, 1.38 + FALLS.tumble[1]), 40), 0.005, 0.8), 0.708), FALLS.tumble[0]);
}

/* --------------------------------------------------------------- drags */
const drags = [new Float32Array(S(DRAGS_LENGTH))];
{
  // The door's slab grinding steadily aside (its first heave left out).
  const g = highpass(cut(load("door", 1), 6.2, 6.2 + DRAGS.grind.len), 30);
  bakeLoop(g, DRAGS.grind.loop[0] - DRAGS.grind.at, DRAGS.grind.loop[1] - DRAGS.grind.at, XFADE);
  place(drags, normalize(fades(g, 0.02, 0.2), 0.5), DRAGS.grind.at);
  // Stone rubbed on stone.
  const r = highpass(cut(load("friction", 1), 0.05, 0.05 + DRAGS.rub.len - 0.3), 60);
  bakeLoop(r, DRAGS.rub.loop[0] - DRAGS.rub.at, DRAGS.rub.loop[1] - DRAGS.rub.at, XFADE);
  place(drags, normalize(fades(r, 0.02, 0.2), 0.5), DRAGS.rub.at);
}

/* -------------------------------------------------------------- write */
function wav(chs) {
  const n = chs[0].length, c = chs.length, data = Buffer.alloc(n * c * 4);
  for (let i = 0; i < n; i++) for (let ch = 0; ch < c; ch++) data.writeFloatLE(chs[ch][i], (i * c + ch) * 4);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(c, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * c * 4, 28); h.writeUInt16LE(c * 4, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-"));
let bad = 0;
for (const [name, chs, kbps] of [["monolith-hits", hits, "128k"], ["monolith-falls", falls, "160k"], ["monolith-drags", drags, "112k"]]) {
  const p = peakOf(chs);
  console.log(`${name}.mp3: ${(chs[0].length / SR).toFixed(2)} s, ${chs.length === 1 ? "mono" : "stereo"}, peak ${(20 * Math.log10(p)).toFixed(1)} dBFS`);
  if (p >= 0.98) { console.error(`  too hot (peak ${p.toFixed(3)})`); bad++; continue; }
  const w = path.join(tmp, `${name}.wav`);
  fs.writeFileSync(w, wav(chs));
  const r = spawnSync(FFMPEG, ["-y", "-v", "error", "-i", w, "-c:a", "libmp3lame", "-b:a", kbps, "-ar", String(SR), "-map_metadata", "-1", path.join(OUT, `${name}.mp3`)], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`  ffmpeg failed for ${name}`); bad++; }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
