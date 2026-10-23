/* The title screen's sounds (user: "I also want to add some audio to the
   splash screen... When BEGIN is clicked, perhaps a tiny acknowledgement,
   and when the pieces are placed on the board, each appropriate wood sound
   for the specific position they land in can also call in succession as
   they land, perhaps with some rarefied processing"):
     begin     a single soft knock with its octave ghost, in an airy room
     landings  the way out (the splash played back, render.mjs rewind):
               each piece's knock as it comes back to its square, in the
               order they come (lib/v-build.js landingsOf, timed by
               lib/rewind.js), across the board as it lies (its column,
               left to right, the board's width as most of the stereo's;
               the far rows a little softer and further into the room), as the game
               lands it (the face it comes down on and its cubes:
               themes/wood-sfx.js landingSize; a Cabeza brushes, never
               knocks), with a ghost an octave up in a high, light room.
   Rendered offline in Chromium with the game's own knocks (sounds.html),
   encoded with ffmpeg (FFMPEG= one with libmp3lame).
     node tools/splash/sounds.mjs [--out DIR]   -> begin.mp3, landings.mp3 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewindTimeOf, REWIND_LEN } from "./lib/rewind.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const OUT = oi >= 0 ? args[oi + 1] : "/tmp/splash-out";
const FF = process.env.FFMPEG || "ffmpeg";
fs.mkdirSync(OUT, { recursive: true });

// The pieces as the game has them (engine/rules.js): cubes, and the face they come down on.
const BODY = { turrito: { units: 1, contact: 1 }, flaco: { units: 2, contact: 2 }, chato: { units: 4, contact: 2 }, opa: { units: 8, contact: 4 }, cabeza: { units: 1, contact: 1 } };
// The room: long and light (the lows off it), and the ghosts only there.
const ROOM = { secs: 3.6, decay: 2.4, send: 0.55, wet: 0.5, ghost: 0.35 };

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`file://${DIR}/splash.html`);
await page.evaluate(() => window.SPLASH.ready);
const { landings, settle } = await page.evaluate(() => window.SPLASH.landings("L5"));
const knocks = landings
  .map((l) => ({ ...BODY[l.kind], kind: l.kind, at: rewindTimeOf(l.at), pan: ((l.col - 4.5) / 4.5) * 0.9, level: 0.8 + 0.2 * (l.row / 9), send: 1 + 0.6 * (1 - l.row / 9), col: l.col, row: l.row, side: l.side }))
  .sort((a, b) => a.at - b.at);
for (const k of knocks) console.log(`  ${k.at.toFixed(3)} s  ${k.side} ${k.kind} at column ${k.col}, row ${k.row}`);
console.log(`  (all down together at ${rewindTimeOf(settle).toFixed(3)} s; the rewind's ${REWIND_LEN} s)`);

await page.goto(`file://${DIR}/sounds.html`);
await page.waitForFunction(() => window.SOUNDS && window.SOUNDS.ready);
const plans = {
  landings: { secs: REWIND_LEN + ROOM.secs, knocks, room: ROOM, board: "solid", peak: 0.5 },
  // (tiny: user, "perhaps a tiny acknowledgement")
  begin: { secs: 1.6, knocks: [{ at: 0.02, kind: "turrito", units: 1, contact: 1, pan: 0, level: 0.9 }], room: { ...ROOM, secs: 1.5 }, board: "solid", peak: 0.24 },
};
for (const [name, plan] of Object.entries(plans)) {
  const r = await page.evaluate((p) => window.SOUNDS.render(p), plan);
  const pcm = Buffer.from(r.data, "base64");
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVE", 8);
  head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
  head.writeUInt32LE(r.rate, 24); head.writeUInt32LE(r.rate * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
  const wav = path.join(OUT, `${name}.wav`), mp3 = path.join(OUT, `${name}.mp3`);
  fs.writeFileSync(wav, Buffer.concat([head, pcm]));
  const ff = spawnSync(FF, ["-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "112k", mp3]);
  if (ff.status) { console.error(String(ff.stderr)); process.exit(1); }
  console.log(`${name}: peak ${r.peak.toFixed(3)} raised x${r.gain.toFixed(2)} -> ${mp3} (${fs.statSync(mp3).size} bytes)`);
}
if (errs.length) { console.error("page errors:", errs.join(" | ")); process.exit(1); }
await browser.close();
