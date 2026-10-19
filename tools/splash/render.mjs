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

     node tools/splash/render.mjs posters                  the three posters as PNGs
     node tools/splash/render.mjs still <version> <poster> <t> [<t> ...]
     node tools/splash/render.mjs video <version> <poster>
     node tools/splash/render.mjs all                      every version x poster
   Options: --out DIR (default /tmp/splash-out), --fps N (default 60),
   --from S --to S (a part of a video, for checking).

   Versions: tiles, sand, liquid, sweep, build. Posters: v1, v2, v5.
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
const FF = process.env.FFMPEG || "ffmpeg";
const VERSIONS = ["tiles", "sand", "liquid", "sweep", "build"];
const POSTERS = ["v1", "v2", "v5"];
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
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", "-an", file], { stdio: ["pipe", "inherit", "inherit"] });
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

const [cmd, ...rest] = args;
if (cmd === "posters") {
  for (const p of POSTERS) {
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
} else if (cmd === "all") {
  for (const v of rest.length ? rest : VERSIONS) for (const p of POSTERS) await video(v, p);
} else {
  console.log("usage: render.mjs posters | still <version> <poster> <t>... | video <version> <poster> | all [versions]");
}
await browser.close();
