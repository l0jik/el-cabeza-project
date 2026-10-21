/* The splash videos (front page / the app's splash): the user's board photo
   morphing into poster 1, 2 or 5 of their collage, five ways each (user:
   "5 versions of a video that incorporate the game board morphing into these
   images"; "separate videos ... it'll be the board first and then the
   poster"; silent; for "the front page or the splash page for a mobile
   app"). 1080 x 1920, H.264, no sound. The only words are the name: EL
   CABEZA from the first second, then NOVA's own entrance once the poster has
   settled (user: "remove the taglines from all of them ... Make these look
   refined and classy"; lib/title.js).

   Frames are drawn in Chromium (tools/splash/splash.html, a canvas stepped
   one frame at a time) and piped to ffmpeg.

     node tools/splash/render.mjs posters [ids]            the posters as PNGs (v1 v2 v5 by default)
     node tools/splash/render.mjs still <version> <poster> <t> [<t> ...]
     node tools/splash/render.mjs video <version> <poster>
     node tools/splash/render.mjs all                      every version x poster
     node tools/splash/render.mjs rewind <version> <poster>  played back from 8.5 s to the start (REWIND)
   Options: --out DIR (default /tmp/splash-out), --fps N (default 60),
   --from S --to S (a part of a video, for checking), --keyframes S,S,...
   (key frames at these times as well, so a player can jump there at
   once: the app's title screen loops its last breath from one).

   Versions: tiles, sand, liquid, sweep, build. Posters: v1, v2, v5, and
   the logo posters L1 to L5 (lib/logos.js; their videos are the five pairs
   in LOGO_VIDEOS: `all logos` renders them).
   Needs an ffmpeg with libx264 (FFMPEG=path to use another;
   `pip install imageio-ffmpeg` has one). */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const OUT = opt("out", "/tmp/splash-out");
const FPS = Number(opt("fps", 60));
const FROM = Number(opt("from", 0));
const TO = opt("to", null);
const KEYFRAMES = opt("keyframes", null);
const FF = process.env.FFMPEG || "ffmpeg";
const VERSIONS = ["tiles", "sand", "liquid", "sweep", "build"];
const POSTERS = ["v1", "v2", "v5"];
// The logo posters, each with the version that brings it in.
const LOGO_VIDEOS = [["tiles", "L3"], ["sand", "L2"], ["liquid", "L1"], ["sweep", "L4"], ["build", "L5"]];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--disable-gpu-vsync"],
});
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("  page:", m.text()); });
await page.goto(`file://${DIR}/splash.html`);
await page.evaluate(() => window.SPLASH.ready);
const cdp = await ctx.newCDPSession(page);
const shot = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64");
const check = () => { if (errs.length) { console.error("page errors:", errs.join(" | ")); process.exit(1); } };

async function still(version, poster, t) {
  await page.evaluate(([v, p, tt]) => window.SPLASH.frame(v, p, tt), [version, poster, t]);
  check();
  const file = path.join(OUT, `${version}-${poster}-${t.toFixed(2)}.png`);
  fs.writeFileSync(file, await shot());
  return file;
}

async function video(version, poster) {
  const dur = await page.evaluate(([v, p]) => window.SPLASH.duration(v, p), [version, poster]);
  const end = TO == null ? dur : Math.min(dur, Number(TO));
  const n0 = Math.round(FROM * FPS), n1 = Math.round(end * FPS);
  const file = path.join(OUT, `${version}-${poster}${FROM || TO ? `-${FROM}-${end}` : ""}.mp4`);
  const ff = spawn(FF, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    // capped near 8 Mbit/s: Sand's half a million grains would otherwise run to 50 MB
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-profile:v", "high",
    ...(KEYFRAMES ? ["-force_key_frames", `0,${KEYFRAMES}`] : []), "-movflags", "+faststart", "-an", file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
  const t0 = Date.now();
  for (let f = n0; f < n1; f++) {
    await page.evaluate(([v, p, tt]) => window.SPLASH.frame(v, p, tt), [version, poster, f / FPS]);
    check();
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - n0) % (FPS * 2) === 0) process.stdout.write(`\r  ${version} ${poster}: ${f - n0}/${n1 - n0} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  }
  ff.stdin.end();
  await done;
  console.log(`\r  ${version} ${poster}: ${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${file}`);
  return file;
}

/* The title screen's way out (user: "When clicking begin on the splash
   screen, it should play the animation in reverse"): a video's own frames
   from the held logo (8.5 s, where the title screen's loop begins) back to
   its first, the board, quicker than it came: through the breath and the
   ghost's rise, NOVA closing back into its line, the emblem coming apart
   into the board, EL CABEZA's letters drawn off it. REWIND maps the
   rewind's seconds to the video's (a monotone cubic through them), eased
   in from the loop's own speed and set down gently on the board. */
const REWIND = [[0, 8.5], [0.45, 6.8], [0.95, 5.2], [2.25, 0.6], [2.75, 0]];
const REWIND_IN = 1.4, REWIND_OUT = 0.6; // the video's seconds a second, at its start and its end
function rewindAt(u) {
  const P = REWIND, n = P.length - 1;
  if (u <= P[0][0]) return P[0][1];
  if (u >= P[n][0]) return P[n][1];
  const h = [], d = [];
  for (let i = 0; i < n; i++) { h.push(P[i + 1][0] - P[i][0]); d.push((P[i + 1][1] - P[i][1]) / h[i]); }
  const m = [Math.max(d[0] * 3, -REWIND_IN)];
  for (let i = 1; i < n; i++) {
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
  }
  m.push(Math.max(d[n - 1] * 3, -REWIND_OUT));
  let i = 0;
  while (u > P[i + 1][0]) i++;
  const s = (u - P[i][0]) / h[i], s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * P[i][1] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * P[i + 1][1] + (s3 - s2) * h[i] * m[i + 1];
}
async function rewind(version, poster) {
  const last = REWIND[REWIND.length - 1][0], n1 = Math.round(last * FPS) + 1;
  const file = path.join(OUT, `${version}-${poster}-rewind.mp4`);
  const ff = spawn(FF, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-movflags", "+faststart", "-an", file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
  for (let f = 0; f < n1; f++) {
    await page.evaluate(([v, p, tt]) => window.SPLASH.frame(v, p, tt), [version, poster, Math.max(0, rewindAt(f / FPS))]);
    check();
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
  console.log(`  ${version} ${poster} rewind: ${n1} frames -> ${file}`);
  return file;
}

const [cmd, ...rest] = args;
if (cmd === "rewind") {
  await rewind(rest[0], rest[1]);
} else if (cmd === "posters") {
  for (const p of rest.length ? rest : POSTERS) {
    await page.evaluate((id) => window.SPLASH.poster(id), p);
    check();
    fs.writeFileSync(path.join(OUT, `poster-${p}.png`), await shot());
    console.log(path.join(OUT, `poster-${p}.png`));
  }
} else if (cmd === "still") {
  const [v, p, ...ts] = rest;
  for (const t of ts) console.log(await still(v, p, Number(t)));
} else if (cmd === "video") {
  await video(rest[0], rest[1]);
} else if (cmd === "all" && rest[0] === "logos") {
  for (const [v, p] of LOGO_VIDEOS) await video(v, p);
} else if (cmd === "all") {
  for (const v of rest.length ? rest : VERSIONS) for (const p of POSTERS) await video(v, p);
} else {
  console.log("usage: render.mjs posters [ids] | still <version> <poster> <t>... | video <version> <poster> | all [versions | logos]");
}
await browser.close();
