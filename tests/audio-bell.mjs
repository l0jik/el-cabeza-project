/* Clipping check for the SINGULARITY bell toll (themes/neon.js,
   playSingularityBell) and everything else sounding in the same window.

   Every connection to ctx.destination is re-routed, before the page's
   own scripts run, through a tap: each source gets a ScriptProcessor
   that sees every sample it sends, and a summing node sees the final mix
   the speakers would get. Web Audio is floating point internally, so a
   sample only clips when the mix at the destination goes past ±1.0. That
   is exactly what is counted here, sample by sample, with no gaps
   between reads.

   The run: trigger the Singularity (five masthead taps + the invite
   click), then record the full toll → collapse → hard cut → sphere
   sequence until the bell's tail has rung out. The bell has its own bus
   (bellBus, straight to the destination), so it is measured on its own
   as well as in the mix.

   Pass = zero clipped samples in the final mix, the peak stays under
   HEADROOM_PEAK (about -2 dBFS), and little of the mix is subsonic
   (under 30 Hz: nothing a speaker plays, only what makes a phone's
   speaker crunch; the user heard it as clipping). */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "dist", "el-cabeza-neon.html");
const RECORD_MS = 26000; // toll 2s + collapse ~3.2s + the bell's ~21s ring-out
// Before the output stage (neon.js outStage) this sequence peaked at up to
// 0.98 with 15% of the mix under 30 Hz on the gauge below; after it,
// 0.5-0.65 and 3-4%; with the bell revoiced for small speakers (its
// strike was 77% under 80 Hz), 0.49-0.63 and 1.1-1.5%.
const HEADROOM_PEAK = 0.8;
const SUBSONIC_MAX = 0.06;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.addInitScript(() => {
  const BUCKET_S = 0.25;
  const taps = [];
  window.__EC_AUDIO_TAPS__ = taps;
  const makeMeter = (ctx, label) => {
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    const m = { label, kind: "", connectedAt: performance.now(), peak: 0, clipped: 0, samples: 0, sumSq: 0, buckets: [], t0: null, raw: label === "mix" ? [] : null, rawN: 0, sr: 0 };
    sp.onaudioprocess = (e) => {
      if (m.t0 === null) m.t0 = e.playbackTime;
      const n = e.inputBuffer.length;
      for (let ch = 0; ch < e.inputBuffer.numberOfChannels; ch++) {
        const d = e.inputBuffer.getChannelData(ch);
        for (let i = 0; i < n; i++) {
          const a = Math.abs(d[i]);
          if (a > m.peak) m.peak = a;
          if (a >= 1) m.clipped++;
          m.sumSq += d[i] * d[i];
          const b = Math.floor((e.playbackTime + i / e.inputBuffer.sampleRate - m.t0) / BUCKET_S);
          if (!(m.buckets[b] >= a)) m.buckets[b] = a;
        }
        m.samples += n;
        // The mix's first 8 s (the toll and the collapse), kept whole for
        // the subsonic check below.
        if (m.raw && ch === 0 && m.rawN < e.inputBuffer.sampleRate * 8) { m.raw.push(Float32Array.from(d)); m.rawN += n; m.sr = e.inputBuffer.sampleRate; }
      }
    };
    sp.connect(ctx.destination);
    taps.push(m);
    return sp;
  };
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    // The theme's own last stage (neon.js outStage: subsonic cut and
    // limiter) is what master and the bell's bus feed: meter each of
    // them there, and leave the path through that stage as it is.
    if (dest && dest.__ecOutput && !this.__isTap) {
      const sp = makeMeter(this.context, `source${taps.length}`);
      sp.__isTap = true;
      taps[taps.length - 1].kind = this.constructor.name;
      origConnect.call(this, sp);
      return origConnect.call(this, dest, ...rest);
    }
    if (dest instanceof AudioDestinationNode && !this.__isTap) {
      const ctx = this.context;
      if (!ctx.__sum) {
        ctx.__sum = ctx.createGain();
        ctx.__sum.__isTap = true;
        origConnect.call(ctx.__sum, dest);
        const spSum = makeMeter(ctx, "mix");
        spSum.__isTap = true;
        origConnect.call(ctx.__sum, spSum);
      }
      const sp = makeMeter(ctx, `source${taps.length}`);
      sp.__isTap = true;
      taps[taps.length - 1].kind = this.constructor.name;
      origConnect.call(this, sp);
      return origConnect.call(this, ctx.__sum, ...rest);
    }
    return origConnect.call(this, dest, ...rest);
  };
  // The meters themselves connect straight to the destination (their own
  // output is silence), bypassing the tap above.
  ScriptProcessorNode.prototype.connect = function (dest, ...rest) {
    return origConnect.call(this, dest, ...rest);
  };
});

await page.goto(`file://${file}`);
await page.waitForTimeout(1500);

// Trigger: five masthead taps reveal the invite; one click starts the toll.
const titleBox = await page.locator(".ec-title").first().boundingBox();
const tx = titleBox.x + titleBox.width / 2, ty = titleBox.y + titleBox.height / 2;
for (let attempt = 0; attempt < 3; attempt++) {
  for (let i = 0; i < 5; i++) { await page.mouse.click(tx, ty); await page.waitForTimeout(140); }
  await page.waitForTimeout(300);
  if (await page.evaluate(() => !!document.querySelector(".ec-singularity-invite-btn"))) break;
  await page.waitForTimeout(2700);
}
const clickAt = await page.evaluate(() => performance.now());
const b = await page.locator(".ec-singularity-invite-btn").boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(RECORD_MS);

const sub = await page.evaluate(() => {
  const m = window.__EC_AUDIO_TAPS__.find((x) => x.label === "mix");
  if (!m || !m.raw.length) return null;
  // Energy under 30 Hz against all of it: a 4th-order low-pass (two RBJ
  // biquads, Q 0.54 / 1.31) run over the samples.
  const sr = m.sr, w = (2 * Math.PI * 30) / sr;
  const coeffs = [0.54, 1.31].map((q) => {
    const a = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + a;
    return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 };
  });
  const st = coeffs.map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0 }));
  let all = 0, low = 0;
  for (const block of m.raw) for (let i = 0; i < block.length; i++) {
    let v = block[i];
    all += v * v;
    coeffs.forEach((k, j) => { const s = st[j]; const y = k.b0 * v + k.b1 * s.x1 + k.b2 * s.x2 - k.a1 * s.y1 - k.a2 * s.y2; s.x2 = s.x1; s.x1 = v; s.y2 = s.y1; s.y1 = y; v = y; });
    low += v * v;
  }
  return all ? low / all : null;
});
const taps = await page.evaluate(() =>
  window.__EC_AUDIO_TAPS__.map((m) => ({
    label: m.label, kind: m.kind, connectedAt: m.connectedAt, peak: m.peak, clipped: m.clipped,
    rms: m.samples ? Math.sqrt(m.sumSq / m.samples) : 0, buckets: m.buckets,
  }))
);
await browser.close();

const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : "-inf");
const mix = taps.find((t) => t.label === "mix");
// The audio graph is built at the click. Two gain nodes feed the
// destination: master (built first, by ensureGraph) and then the bell's
// own bus (built lazily by the bell itself, right after).
const gains = taps.filter((t) => t.label !== "mix" && t.kind === "GainNode");
const bell = gains.length >= 2 ? gains[gains.length - 1] : null;
if (process.env.EC_AUDIO_TIMELINE) console.log("  taps:", taps.map((t) => `${t.label}@${Math.round(t.connectedAt - clickAt)}ms peak=${t.peak.toFixed(2)}`).join(", "));
const others = taps.filter((t) => t !== mix && t !== bell);

console.log("[audio] per-source and mix levels over the whole sequence:");
for (const t of [mix, bell, ...others].filter(Boolean)) {
  const name = t === mix ? "final mix" : t === bell ? "bell bus" : t === gains[0] ? "master bus" : `${t.label} (${t.kind})`;
  console.log(`  ${name.padEnd(18)} peak ${t.peak.toFixed(3)} (${db(t.peak)} dBFS)  clipped samples ${t.clipped}  rms ${t.rms.toFixed(4)}`);
}
if (bell && process.env.EC_AUDIO_TIMELINE) {
  console.log("  bell peak per 0.25s:", bell.buckets.map((x) => (x || 0).toFixed(2)).join(" "));
  console.log("  mix  peak per 0.25s:", mix.buckets.map((x) => (x || 0).toFixed(2)).join(" "));
}

let failures = 0;
const check = (label, cond, detail) => {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && detail ? " — " + detail : ""}`);
};
check("the audio tap actually heard the sequence", !!mix && mix.peak > 0.01, JSON.stringify(mix && mix.peak));
check("the bell's own bus was found and is sounding", !!bell && bell.peak > 0.01, JSON.stringify(bell && bell.peak));
check("no clipped samples in the final mix", mix && mix.clipped === 0, `clipped=${mix && mix.clipped}`);
check("no clipped samples from the bell on its own", bell && bell.clipped === 0, `clipped=${bell && bell.clipped}`);
check(`final-mix peak stays under ${HEADROOM_PEAK} (headroom)`, mix && mix.peak < HEADROOM_PEAK, `peak=${mix && mix.peak}`);
// The bell rings on after the hard cut: its last second still has signal
// well after the rest of the mix went silent (~5.2s in).
const tail = bell ? bell.buckets.slice(40, 48).reduce((a, x) => Math.max(a, x || 0), 0) : 0;
check("the bell is still ringing out 10-12s after the click", tail > 0.001, `tailPeak=${tail}`);
check(`little of the mix is subsonic (under 30 Hz: ${sub === null ? "?" : (100 * sub).toFixed(1)}%, want under ${100 * SUBSONIC_MAX}%)`, sub !== null && sub < SUBSONIC_MAX);
check("no page errors", errors.length === 0, errors.join(" | "));

if (failures) {
  console.log(`\nAUDIO BELL TEST FAILED (${failures})`);
  process.exit(1);
}
console.log("\nAUDIO BELL TEST PASSED");
