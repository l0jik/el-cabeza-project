import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync, copyFileSync } from "fs";

// The den's records: the user's tracks, each through tools/console_1974_turntable.py.
const DEN_RECORDS = {
  "el-cabeza-den-record-1.mp3": "assets/den/1974_console_master.mp3",
  // The late-night commercial's voice-over (the user's recording, treated).
  "el-cabeza-den-ad-voice.mp3": "assets/den/commercial-king.mp3",
  "el-cabeza-den-ad-voice-2.mp3": "assets/den/commercial-new-king.mp3",
  "el-cabeza-den-ad-voice-3.mp3": "assets/den/commercial-chess.mp3",
  "el-cabeza-den-ad-voice-4.mp3": "assets/den/commercial-checkers.mp3",
  // ...and the whole soundtrack, voices and all, rendered once
  // (tools/den_ad_render.mjs; themes/den-ad-audio.js plays it).
  "el-cabeza-den-ad.mp3": "assets/den/ad-soundtrack.mp3",
  // The 8-track's tapes: the user's tracks through tools/den_8track_treatment.py.
  ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`el-cabeza-den-tape-${n}.mp3`, `assets/den/8track_${n}.mp3`])),
  // The fireplace: a recording, looped and warmed (tools/den_fire_loop.py).
  "el-cabeza-den-fire.mp3": "assets/den/fire_loop.mp3",
  // The telephone's bell (themes/den-call.js): the user's recording of a
  // Stromberg-Carlson 1543, its first three rings (the talk at its end cut).
  "el-cabeza-den-phone-ring.mp3": "assets/den/phone_ring.mp3",
  // The set messing up (den-audio.js tvHaunt): the user's recording of a
  // TV glitching, its dead stretches cut and levelled (tools/den_tv_glitch.py).
  "el-cabeza-den-tv-glitch.mp3": "assets/den/tv-glitch.mp3",
  // The void's pad (den-ending.js): the user's evolving drone pad from its
  // 2-minute mark (tools/den_void_pad.py).
  "el-cabeza-den-void-music.mp3": "assets/den/void-music.mp3",
  "el-cabeza-den-crawl-drone.mp3": "assets/den/crawl-drone.mp3",
  "el-cabeza-den-call-voice.mp3": "assets/den/call-voice.mp3",
  "el-cabeza-den-car-away.mp3": "assets/den/car-away.mp3",
  "el-cabeza-den-car-arrive.mp3": "assets/den/car-arrive.mp3",
  // (Getting out of the closed store: the steps back, the run, the door,
  // the car away; tools/den_trip_escape.py.)
  "el-cabeza-den-trip-escape.mp3": "assets/den/trip-escape.mp3",
  // The register tape printing and torn off, for Nova's purchase (the
  // user's recordings; tools/story_receipt.py; apps/unifiedTransition.jsx).
  "el-cabeza-story-receipt-print.mp3": "assets/story/receipt-print.mp3",
  "el-cabeza-story-receipt-tear.mp3": "assets/story/receipt-tear.mp3",
  // The trip back to Big Glutts after the call (den-trip.js; the user's pictures).
  "el-cabeza-trip-day.jpg": "assets/den/trip/glutts-day.jpg",
  "el-cabeza-trip-dusk.jpg": "assets/den/trip/glutts-dusk.jpg",
  // The other realities' pictures (themes/realities.js: the den's set after
  // the story, and the realities menu; tools/channel_shots.mjs).
  ...Object.fromEntries(["den", "neon", "store", "lluvia", "cromo", "lab-swiss", "lab-bauhaus", "lab-destijl", "lab-elementarism", "lab-brutalist",
    "lab-newTypography", "lab-corporateSwiss", "lab-neoBrutalist", "lab-minimalMono", "lab-ultimateFusion"].map((id) => [`el-cabeza-channel-${id}.jpg`, `assets/den/channels/${id}.jpg`])),
};

// The Singularity's first visit, after the ring: the user's industrial
// drone, looped (tools/neon_sphere_drone.py; themes/neon-unease.js createDrone).
const SPHERE_FILES = { "el-cabeza-neon-sphere-drone.mp3": "assets/neon/sphere-drone.mp3" };
DEN_RECORDS["el-cabeza-neon-sphere-drone.mp3"] = SPHERE_FILES["el-cabeza-neon-sphere-drone.mp3"];

// The Games counter's photographs (themes/tienda-overlay.js ClerkScene).
const CLERK_SHOTS = ["clerk-hello", "clerk-sure", "clerk-go", "clerk-hmm", "clerk-sorry", "clerk-phone",
  "manager-1", "manager-2", "manager-3", "manager-4", "manager-5", "manager-6", "manager-7", "manager-8"];
const targets = [
  // The den's records (themes/standard.js DEN_TRACKS), files beside the
  // page like Tienda's reels: fetched when played. Nova's den reads the same.
  { name: "standard", entry: "apps/standard.jsx", title: "El Cabeza", files: DEN_RECORDS },
  { name: "neon", entry: "apps/neon.jsx", title: "Neon Cabeza", files: SPHERE_FILES },
  { name: "cromo", entry: "apps/cromo.jsx", title: "Cromo Cabeza" },
  { name: "lluvia", entry: "apps/lluvia.jsx", title: "Lluvia Cabeza", files: { "el-cabeza-lluvia-rain.mp3": "assets/lluvia/rain.mp3" } },
  // Parrish's piece sounds: the user's stabs, cut small (tools/parrish_stabs.py);
  // its intro and its close, the user's opening and end of "Orinoco Flow"
  // (each in a long hall, tools/parrish_bookends.py).
  { name: "parrish", entry: "apps/parrish.jsx", title: "Parrish Cabeza", head: '<meta name="theme-color" content="#0E1A3D">', files: { "el-cabeza-parrish-stabs.mp3": "assets/parrish/piece-stabs.mp3", "el-cabeza-parrish-intro.mp3": "assets/parrish/intro.mp3", "el-cabeza-parrish-outro.mp3": "assets/parrish/outro.mp3", "el-cabeza-parrish-hums.mp3": "assets/parrish/hums.mp3" } },
  { name: "nova", entry: "apps/unified.jsx", title: "El Cabeza Nova", viewport: "width=device-width,initial-scale=1,viewport-fit=cover", files: DEN_RECORDS },
  // Tienda's page can draw under a phone's
  // notch and home bar (the theme keeps its controls clear of them).
  // Its files beside the page: the store's reels (the 1974 Muzak tape and
  // the user's five mall tracks), each fetched when it's next up rather
  // than weighing down the page (the page plays without them, see
  // themes/tienda-audio.js). Nova's store reads the same files.
  { name: "lab", entry: "apps/lab.jsx", title: "El Cabeza · Theme Lab", head: '<meta name="theme-color" content="#F8F9FA">', viewport: "width=device-width,initial-scale=1,viewport-fit=cover" },
  { name: "tienda", entry: "apps/tienda.jsx", title: "El Cabeza · Tienda", head: '<meta name="theme-color" content="#2B2219">', viewport: "width=device-width,initial-scale=1,viewport-fit=cover", files: {
    "el-cabeza-tienda-muzak.mp3": "assets/tienda/muzak-1974.mp3",
    "el-cabeza-tienda-reel-2.mp3": "assets/tienda/reel-2-coupon-gloss-reverie.mp3",
    "el-cabeza-tienda-reel-3.mp3": "assets/tienda/reel-3-twilight-at-the-atrium.mp3",
    "el-cabeza-tienda-reel-4.mp3": "assets/tienda/reel-4-tuesday-morning-at-the-atrium.mp3",
    "el-cabeza-tienda-reel-5.mp3": "assets/tienda/reel-5-tuesday-night-at-the-emporium.mp3",
    "el-cabeza-tienda-reel-6.mp3": "assets/tienda/reel-6-midday-clearance-sale.mp3",
    // The revisited store's scene at the Games counter (the photographs,
    // tools/tienda_clerk_frames.py; Nova's store reads them too).
    ...Object.fromEntries(CLERK_SHOTS.map((n) => [`el-cabeza-${n}.jpg`, `assets/tienda/clerk/${n}.jpg`])),
  } },
];

mkdirSync("dist", { recursive: true });

/* Bundled once, shared by all three targets (identical AI code
   regardless of theme) — see engine/ai-worker.js's own header comment
   for why this is embedded as inert script text rather than shipped as
   a second file: the whole point of this build is one self-contained
   HTML page per theme. Plain JS, no JSX loader needed. */
const workerResult = await esbuild.build({
  entryPoints: ["engine/ai-worker.js"],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  logLevel: "warning",
});
const workerJs = workerResult.outputFiles[0].text;
// </script sequences inside the bundled worker text would otherwise
// prematurely close this holder tag when the browser parses the HTML.
const workerJsEscaped = workerJs.replace(/<\/script/gi, "<\\/script");

for (const t of targets) {
  const result = await esbuild.build({
    entryPoints: [t.entry],
    bundle: true,
    write: false,
    format: "iife",
    // Sound files (assets/) are inlined as data: URLs, keeping each page a
    // single self-contained file.
    loader: { ".js": "jsx", ".mp3": "dataurl", ".jpg": "dataurl", ".webp": "dataurl" },
    // Every page minified (2026-10 audit): Nova's script went from 3.9 MB
    // to 2.5 MB (1.27 to 1.11 MB gzipped), less for a phone to download
    // and parse. The code's long comments are what it mostly sheds; no
    // code here depends on function or class names.
    minify: true,
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "warning",
    // Without this, react/react-dom's own package.json branches on
    // process.env.NODE_ENV to pick cjs/react.development.js — esbuild
    // leaves that check untouched with no define, so it evaluates to
    // undefined at runtime and always takes the DEVELOPMENT branch.
    // That build does real per-render work a shipped build shouldn't
    // pay for: Object.freeze() on every element and props object,
    // prop-type/key/ref validation, and the warning-formatting
    // machinery behind every dev-only console.error/warn call — on
    // every re-render, for the app's whole lifetime, not just at
    // startup. `define` here makes esbuild dead-code-eliminate that
    // branch entirely, so only the production build gets bundled.
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const js = result.outputFiles[0].text;
  // type="application/x-ai-worker" (not a JS mimetype) keeps the browser
  // from ever trying to execute this inline — chassis/ElCabeza3D.jsx
  // reads its textContent and turns it into a real Worker via a Blob URL.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="${t.viewport || "width=device-width,initial-scale=1"}">${t.head || ""}<meta name="robots" content="noindex, nofollow"><title>${t.title}</title></head><body style="margin:0"><div id="root"></div><script type="application/x-ai-worker" id="ai-worker-src">${workerJsEscaped}</script><script>${js}</script></body></html>`;
  writeFileSync(`dist/el-cabeza-${t.name}.html`, html);
  Object.entries(t.files || {}).forEach(([to, from]) => copyFileSync(from, `dist/${to}`));
  console.log(`built dist/el-cabeza-${t.name}.html (${(js.length / 1024).toFixed(0)}kb JS, ${(workerJs.length / 1024).toFixed(0)}kb worker)`);
}

/* Nova used to be published as el-cabeza-unified.html, and that link has
   been shared. Keep it working: a tiny page that forwards to Nova at
   once, keeping any ?query or #hash. */
writeFileSync(
  "dist/el-cabeza-unified.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>El Cabeza Nova</title>
<meta http-equiv="refresh" content="0; url=el-cabeza-nova.html">
<link rel="canonical" href="el-cabeza-nova.html">
<script>location.replace("el-cabeza-nova.html" + location.search + location.hash);</script>
</head><body style="background:#111;color:#eee;font-family:system-ui,sans-serif">
<p>El Cabeza Unified is now <a href="el-cabeza-nova.html" style="color:#7cf">El Cabeza Nova</a>.</p>
</body></html>
`
);
console.log("built dist/el-cabeza-unified.html (redirect to Nova)");
