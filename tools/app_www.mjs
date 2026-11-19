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

   Its fonts (user: "I want the APK to be able to run the game completely
   with everything without having access to the internet."): the website
   asks Google Fonts for its type; the app has its own copy of what Google
   sends (assets/fonts/app/, tools/app_fonts.mjs), as fonts/, and its pages'
   links are turned to it here: each Google Fonts link in a page or a
   script to its copy (fonts/q-<key>.css, the request kept after a "?"
   that the app's server passes over), the pages' word ahead to Google
   (preconnect) taken out; the links made as the game goes are
   chassis/font-links.js's fontsHref(). If a page asks for a font the copy
   hasn't got, this stops and says so: run tools/app_fonts.mjs again.

     npm run build && node tools/app_www.mjs */
import { readdirSync, statSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, existsSync } from "fs";
import { fontKey } from "../chassis/font-links.js";
import { FONTS_DIR, GOOGLE_LINK, linkQueries, familyQueries } from "./app_fonts.mjs";

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

// Its fonts: each Google Fonts link to the app's copy.
const PRECONNECT = /<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"(?: crossorigin)?>/g;
const asked = new Set();
for (const f of files) {
  if (!/\.(html|js|css)$/.test(f)) continue;
  const html = f.endsWith(".html");
  let text = readFileSync(OUT + f, "utf8");
  const before = text;
  if (!html) for (const q of familyQueries(text)) asked.add(q);
  text = text.replace(GOOGLE_LINK, (m, raw) => {
    if (raw.startsWith("${")) return m;
    const query = html ? raw.replace(/&amp;/g, "&") : raw;
    asked.add(query);
    return `fonts/q-${fontKey(query)}.css?${raw}`;
  });
  if (html) text = text.replace(PRECONNECT, "");
  // Nothing left to send to Google but fontsHref's own (the website's) way.
  const left = text.split("fonts.googleapis.com").length - 1 - (text.split('https://fonts.googleapis.com/css2?"').length - 1);
  if (left > 0 || text.includes("fonts.gstatic.com") || linkQueries(text, html).length) throw new Error(`${f} still sends to Google Fonts (${left} links)`);
  if (text !== before) writeFileSync(OUT + f, text);
}
const missing = [...asked].filter((q) => !existsSync(FONTS_DIR + `q-${fontKey(q)}.css`));
if (missing.length) throw new Error(`the app has no copy of these fonts (run node tools/app_fonts.mjs, which fetches them, and commit assets/fonts/app/):\n  ${missing.join("\n  ")}`);
mkdirSync(OUT + "fonts");
const fontFiles = new Set(["LICENSES.txt"]);
for (const q of asked) {
  const css = `q-${fontKey(q)}.css`;
  fontFiles.add(css);
  for (const m of readFileSync(FONTS_DIR + css, "utf8").matchAll(/url\(([^)]+)\)/g)) {
    if (!existsSync(FONTS_DIR + m[1])) throw new Error(`${css} names ${m[1]}, which isn't in assets/fonts/app/: run node tools/app_fonts.mjs`);
    fontFiles.add(m[1]);
  }
}
let fontBytes = 0;
for (const f of fontFiles) { copyFileSync(FONTS_DIR + f, OUT + "fonts/" + f); fontBytes += statSync(FONTS_DIR + f).size; }
console.log(`app-www/: ${files.length + 1} files, ${(bytes / 1048576).toFixed(1)} MB; fonts/: ${asked.size} requests' type, ${fontFiles.size} files, ${(fontBytes / 1048576).toFixed(1)} MB`);
