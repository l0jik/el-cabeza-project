/* The Android app's own copy of the game (user: "create the app version to
   have on this phone."): dist/'s files as the app ships them, into
   app-www/ (capacitor.config.json's webDir; npx cap sync android copies it
   into the app). Everything plays from inside the app, no network needed.

   Left out, as tools/app_size.mjs --android counts it: what only the
   website needs (the front page's versions, front* and dist/front/; the
   old addresses' redirects; the site's index, robots.txt and the APK
   itself), each recording's MP3 where its Opus twin is there (the
   WebView plays Opus; chassis/sound-files.js asks for the Opus), and the
   den spot's H.264 copy (its VP9 one plays; den-commercial.js passes over
   a missing one). Kept, unlike app_size.mjs: the title screen's MP4s,
   which it picks wherever H.264 plays, as it does in Android's WebView.

   Its index.html: the app opens on it, and it goes straight on to Nova,
   the page the site's own app (the web manifest) starts on.

     npm run build && node tools/app_www.mjs */
import { readdirSync, statSync, mkdirSync, rmSync, copyFileSync, writeFileSync } from "fs";

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../app-www/", import.meta.url).pathname;
const all = readdirSync(DIST).filter((f) => statSync(DIST + f).isFile());
const has = (f) => all.includes(f);
const webOnly = (f) => f.startsWith("front") || ["el-cabeza-unified.html", "el-cabeza-neon.html", "index.html", "robots.txt"].includes(f) || f.endsWith(".apk")
  || (f.endsWith(".mp3") && has(f.replace(/\.mp3$/, ".opus")))
  || (f === "el-cabeza-den-spot.mp4" && has("el-cabeza-den-spot.webm"));
const files = all.filter((f) => !webOnly(f));
if (!files.includes("el-cabeza-nova.html")) throw new Error("dist/ has no el-cabeza-nova.html: npm run build first");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const f of files) { copyFileSync(DIST + f, OUT + f); bytes += statSync(DIST + f).size; }
writeFileSync(OUT + "index.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>El Cabeza</title>
<style>html, body { margin: 0; height: 100%; background: #120C08; }</style>
<script>location.replace("el-cabeza-nova.html" + location.search + location.hash);</script>
</head>
<body></body>
</html>
`);
console.log(`app-www/: ${files.length + 1} files, ${(bytes / 1048576).toFixed(1)} MB`);
