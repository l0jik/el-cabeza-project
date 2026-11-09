/* The way into the Singularity, recorded, for a machine whose audio can't
   make it live (user, on a Chromebook: "The sound when traveling through
   the black hole still isn't happening on the Chromebook"; themes/futuris.js
   WAY_IN and its way-in, themes/futuris-summon-audio.js's recorded clap).

   Each part is rendered offline in the browser from the game's own code
   (the full reverbs, every stage at unity: futuris.js renderWayIn,
   futuris-summon-audio.js renderLastClap, reached through the built page's
   test hooks), then here: the hum's and the fall's holds made to loop
   without a seam (their last WAY_IN.xfade seconds crossfaded into the run
   up to the loop's start), each raised by WAY_IN.scale for the encoder
   (the game takes it off again), the tails ended where they've died
   away, and written as MP3 (48 kHz stereo, 128 kbps) to assets/futuris/:

     way-in-bell.mp3   the toll's strike and its ring (the bell's bus)
     way-in-hum.mp3    the toll's hum, built over 2 s, then held (loop)
     way-in-fall.mp3   the fall: the hum, the roar, the pull, then held (loop)
     way-in-clap.mp3   the summons' last clap and its tails (its mix bus)

     npm run build && node tools/singularity_way_in.mjs \
       && FFMPEG=ffmpeg python3 tools/opus_twins.py && npm run build

   (The Opus twins after: opus_twins.py matches each MP3 in dist/ to its
   source.) Run it again whenever the toll, the hum, the roar, the pull or
   the last clap is changed in the code. */
import { chromium } from "playwright";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "futuris");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SR = 48000;

const browser = await chromium.launch({ executablePath: process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(`file://${path.join(ROOT, "dist", "el-cabeza-futuris.html")}`);
await page.waitForFunction(() => !!window.__EC_RENDER_WAY_IN__ && !!window.__EC_RENDER_LAST_CLAP__, null, { timeout: 30000 });
/* TAKES renders of each, and the middle one by loudness kept: the reverbs'
   impulses and the strikes' noise are random, so one render's bell can
   come out a few dB under another's (one did: 3.5 dB under the bell made
   live); the middle take is a typical one. Loudness over each part's
   telling stretch: the bell's strike and first ring, the hum's build, the
   fall's collapse, the clap and its first second. */
const TAKES = Number(process.env.TAKES || 5);
const WINDOW = { bell: [0, 3], hum: [0.5, 2], fall: [0, 3.6], clap: [0, 1.5] };
// (The samples over as base64, a channel at a time.)
const got = await page.evaluate(async ({ SR, TAKES, WINDOW }) => {
  const b64 = (f) => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const rms = (chs, [a, b]) => { let s = 0, n = 0; for (const x of chs) for (let i = Math.round(a * SR); i < Math.min(x.length, Math.round(b * SR)); i++) { s += x[i] * x[i]; n++; } return Math.sqrt(s / Math.max(1, n)); };
  const takes = { bell: [], hum: [], fall: [], clap: [] };
  let way = null;
  for (let k = 0; k < TAKES; k++) {
    const w = await window.__EC_RENDER_WAY_IN__({ sampleRate: SR });
    const c = await window.__EC_RENDER_LAST_CLAP__({ sampleRate: SR });
    way = w.way;
    takes.bell.push(w.bell); takes.hum.push(w.hum); takes.fall.push(w.fall); takes.clap.push(c.clap);
  }
  const out = { way, loudness: {} };
  for (const [name, list] of Object.entries(takes)) {
    const scored = list.map((chs) => ({ chs, r: rms(chs, WINDOW[name]) })).sort((x, y) => x.r - y.r);
    const mid = scored[Math.floor(scored.length / 2)];
    out[name] = mid.chs.map(b64);
    out.loudness[name] = scored.map((x) => (20 * Math.log10(x.r)).toFixed(1));
  }
  return out;
}, { SR, TAKES, WINDOW });
await browser.close();
for (const [name, l] of Object.entries(got.loudness)) console.log(`${name}: ${TAKES} takes, loudness ${l.join(", ")} dB; kept the middle one`);
if (errs.length) { console.error("page errors:", errs); process.exit(1); }

const unpack = (chs) => chs.map((s) => { const b = Buffer.from(s, "base64"); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); });
const W = got.way;
const parts = { bell: unpack(got.bell), hum: unpack(got.hum), fall: unpack(got.fall), clap: unpack(got.clap) };

// A loop's last X seconds crossfaded (equal power) into the X seconds
// before its start: going round from its end to its start, no seam.
function bakeLoop(chs, [a, b], X) {
  const A = Math.round(a * SR), B = Math.round(b * SR), N = Math.round(X * SR);
  for (const x of chs) {
    const y = Float32Array.from(x);
    for (let i = 0; i < N; i++) { const k = (i / N) * (Math.PI / 2); y[B - N + i] = Math.cos(k) * x[B - N + i] + Math.sin(k) * x[A - N + i]; }
    x.set(y);
  }
}
// Kept up to `secs` (a loop's end, and a little past it).
const keep = (chs, secs) => chs.map((x) => x.slice(0, Math.min(x.length, Math.round(secs * SR))));
// A tail ended where it's died away (80 dB under its peak), the last 0.3 s faded.
function endTail(chs) {
  const peak = Math.max(...chs.map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  let last = 0;
  for (const x of chs) for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i]) > peak * 1e-4) { last = Math.max(last, i); break; }
  const n = Math.min(chs[0].length, last + Math.round(0.3 * SR));
  return chs.map((x) => { const y = x.slice(0, n), f = Math.round(0.3 * SR); for (let i = 0; i < f; i++) y[n - f + i] *= 1 - i / f; return y; });
}
const scaleBy = (chs, s) => chs.map((x) => x.map((v) => v * s));
const peakOf = (chs) => Math.max(...chs.map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const rmsOf = (chs) => Math.sqrt(chs.reduce((s, x) => s + x.reduce((t, v) => t + v * v, 0), 0) / chs.reduce((n, x) => n + x.length, 0));

bakeLoop(parts.hum, W.hum.loop, W.xfade);
bakeLoop(parts.fall, W.fall.loop, W.xfade);
const out = {
  bell: scaleBy(endTail(parts.bell), W.scale.bell),
  hum: scaleBy(keep(parts.hum, W.hum.loop[1] + 0.05), W.scale.hum),
  fall: scaleBy(keep(parts.fall, W.fall.loop[1] + 0.05), W.scale.fall),
  clap: endTail(parts.clap),
};

// A 32-bit float WAV, for the encoder.
function wav(chs) {
  const n = chs[0].length, c = chs.length, data = Buffer.alloc(n * c * 4);
  for (let i = 0; i < n; i++) for (let ch = 0; ch < c; ch++) data.writeFloatLE(chs[ch][i], (i * c + ch) * 4);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(c, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * c * 4, 28); h.writeUInt16LE(c * 4, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "way-in-"));
let bad = 0;
for (const [name, chs] of Object.entries(out)) {
  const p = peakOf(chs), r = rmsOf(chs);
  const dB = (v) => (20 * Math.log10(v)).toFixed(1);
  console.log(`way-in-${name}.mp3: ${(chs[0].length / SR).toFixed(2)} s, peak ${dB(p)} dBFS, rms ${dB(r)} dBFS`);
  if (p >= 0.98) { console.error(`  too hot for the encoder (peak ${p.toFixed(3)}): lower WAY_IN.scale.${name}`); bad++; continue; }
  const w = path.join(tmp, `${name}.wav`);
  fs.writeFileSync(w, wav(chs));
  const r2 = spawnSync(FFMPEG, ["-y", "-v", "error", "-i", w, "-c:a", "libmp3lame", "-b:a", "128k", "-ar", String(SR), "-map_metadata", "-1", path.join(OUT, `way-in-${name}.mp3`)], { stdio: "inherit" });
  if (r2.status !== 0) { console.error(`  ffmpeg failed for ${name}`); bad++; }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
